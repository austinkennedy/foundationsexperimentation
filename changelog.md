# Changelog

## 2025-02-01

### Added
- **Power Analysis Tool** (`power.html`, `power.js`) — a new page for computing sample size or minimum detectable effect (MDE) for experiments with binary (yes/no) outcomes.
  - Two modes: "Solve for sample size" (given MDE) and "Solve for MDE" (given N per group).
  - Supports two-sided, one-sided larger, and one-sided smaller alternative hypotheses.
  - Client-side input validation before API calls.
  - Results displayed as styled key-value cards with echoed inputs from the server.

- **FastAPI backend** (`backend/main.py`, `backend/requirements.txt`) — Python API powering the power analysis calculations.
  - `POST /api/power/sample-size` — returns required N per group (ceiling-rounded) with achieved power.
  - `POST /api/power/mde` — returns minimum detectable effect via binary search (`scipy.optimize.brentq`) on effect size magnitude.
  - Feasibility bounds check: returns a clear 422 error when target power is not attainable at the maximum feasible MDE.
  - Signed MDE handling: sign matches the requested alternative hypothesis across both endpoints.
  - Pydantic request validation and normalized response payloads (inputs echoed back).
  - Statistical method: two-proportions z-test with Cohen's h (arcsine transformation) via statsmodels.

- **Site navigation** — shared `<nav class="site-nav">` bar added to both `index.html` and `power.html` with pill-shaped links and an active-page indicator.

- **New CSS components** (appended to `styles.css`):
  - `.site-nav`, `.nav-links`, `.nav-link`, `.nav-link--active` for navigation.
  - `.results-summary`, `.result-item`, `.result-label`, `.result-value` for power analysis results display.
  - Responsive rules for navigation and results grid at < 900px.

### Changed
- `index.html` — replaced standalone `.brand` div with the shared navigation bar.
- `coding_agent.md` — updated to document the full two-page architecture, power analysis backend, validation rules, testing checklist, and run instructions.

## 2026-03-07

### Added
- **Render deployment** — FastAPI backend now hosted at `https://foundationsexperimentation.onrender.com`.
  - Removed static file mount from `backend/main.py` (was incompatible with Render's `backend/` root directory).
  - Added production frontend origins (`https://foundationsexperimentation.com`, `https://www.foundationsexperimentation.com`) to CORS allowlist.
  - `power.js` `API_BASE` updated to point to the Render URL.
  - Improved error handling in `power.js`: error responses with empty or non-JSON bodies no longer crash the client.
  - Added cold-start warning to status message (free tier spins down after 15 min inactivity).
