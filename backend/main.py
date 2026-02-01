"""Power analysis API for binary (yes/no) outcomes."""

import math
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
from scipy.optimize import brentq
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

app = FastAPI(title="Power Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

Alternative = Literal["two-sided", "larger", "smaller"]

EPSILON = 1e-9


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SampleSizeRequest(BaseModel):
    baseline_rate: float = Field(gt=0, lt=1)
    mde: float
    alpha: float = Field(gt=0, lt=1)
    power: float = Field(gt=0, lt=1)
    alternative: Alternative

    @model_validator(mode="after")
    def validate_mde(self):
        _validate_mde_sign(self.mde, self.alternative)
        _validate_treatment_rate(self.baseline_rate, self.mde)
        return self


class SampleSizeResponse(BaseModel):
    sample_size_per_group: int
    total_sample_size: int
    achieved_power_at_ceil: float
    inputs: dict


class MDERequest(BaseModel):
    baseline_rate: float = Field(gt=0, lt=1)
    sample_size_per_group: int = Field(gt=0)
    alpha: float = Field(gt=0, lt=1)
    power: float = Field(gt=0, lt=1)
    alternative: Alternative


class MDEResponse(BaseModel):
    mde: float
    inputs: dict


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_mde_sign(mde: float, alternative: Alternative) -> None:
    if mde == 0:
        raise HTTPException(status_code=422, detail="MDE must be nonzero.")
    if alternative == "larger" and mde < 0:
        raise HTTPException(
            status_code=422,
            detail="MDE must be positive when alternative is 'larger'.",
        )
    if alternative == "smaller" and mde > 0:
        raise HTTPException(
            status_code=422,
            detail="MDE must be negative when alternative is 'smaller'.",
        )


def _validate_treatment_rate(baseline: float, mde: float) -> None:
    treatment = baseline + mde
    if treatment <= 0 or treatment >= 1:
        raise HTTPException(
            status_code=422,
            detail=f"Treatment rate (baseline + MDE = {treatment:.4f}) must be between 0 and 1 exclusive.",
        )


# ---------------------------------------------------------------------------
# Statistical helpers
# ---------------------------------------------------------------------------

def _effect_size(baseline: float, mde_magnitude: float) -> float:
    """Cohen's h effect size from baseline and absolute MDE."""
    return abs(proportion_effectsize(baseline, baseline + mde_magnitude))


def _statsmodels_alt(alternative: Alternative) -> str:
    """Map our alternative labels to statsmodels convention."""
    if alternative == "two-sided":
        return "two-sided"
    # statsmodels NormalIndPower uses "larger" for one-sided
    return "larger"


def _compute_power(effect_size: float, n: int, alpha: float, alternative: Alternative) -> float:
    analysis = NormalIndPower()
    return analysis.solve_power(
        effect_size=effect_size,
        nobs1=n,
        alpha=alpha,
        ratio=1.0,
        alternative=_statsmodels_alt(alternative),
    )


def _max_mde_magnitude(baseline: float, alternative: Alternative) -> float:
    """Maximum feasible |MDE| given baseline and alternative."""
    if alternative == "larger":
        return 1.0 - baseline - EPSILON
    if alternative == "smaller":
        return baseline - EPSILON
    # two-sided: bounded by whichever side is tighter
    return min(1.0 - baseline, baseline) - EPSILON


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/power/sample-size", response_model=SampleSizeResponse)
def solve_sample_size(req: SampleSizeRequest):
    effect = _effect_size(req.baseline_rate, abs(req.mde))

    analysis = NormalIndPower()
    n_raw = analysis.solve_power(
        effect_size=effect,
        alpha=req.alpha,
        power=req.power,
        ratio=1.0,
        alternative=_statsmodels_alt(req.alternative),
    )
    n = math.ceil(n_raw)

    achieved = _compute_power(effect, n, req.alpha, req.alternative)

    return SampleSizeResponse(
        sample_size_per_group=n,
        total_sample_size=n * 2,
        achieved_power_at_ceil=round(achieved, 4),
        inputs={
            "baseline_rate": req.baseline_rate,
            "mde": req.mde,
            "alpha": req.alpha,
            "power": req.power,
            "alternative": req.alternative,
        },
    )


@app.post("/api/power/mde", response_model=MDEResponse)
def solve_mde(req: MDERequest):
    max_mag = _max_mde_magnitude(req.baseline_rate, req.alternative)

    # Check attainability at maximum feasible MDE
    max_effect = _effect_size(req.baseline_rate, max_mag)
    max_power = _compute_power(max_effect, req.sample_size_per_group, req.alpha, req.alternative)

    if max_power < req.power:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Target power {req.power} is not attainable with "
                f"N={req.sample_size_per_group} per group. Maximum achievable "
                f"power at the largest feasible MDE is {max_power:.4f}."
            ),
        )

    # Binary search on MDE magnitude using brentq
    def objective(magnitude: float) -> float:
        effect = _effect_size(req.baseline_rate, magnitude)
        achieved = _compute_power(effect, req.sample_size_per_group, req.alpha, req.alternative)
        return achieved - req.power

    mde_magnitude = brentq(objective, EPSILON, max_mag, xtol=1e-6)

    # Apply sign convention
    if req.alternative == "smaller":
        mde_signed = -round(mde_magnitude, 6)
    else:
        # "larger" → positive, "two-sided" → positive magnitude
        mde_signed = round(mde_magnitude, 6)

    return MDEResponse(
        mde=mde_signed,
        inputs={
            "baseline_rate": req.baseline_rate,
            "sample_size_per_group": req.sample_size_per_group,
            "alpha": req.alpha,
            "power": req.power,
            "alternative": req.alternative,
        },
    )


BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")
