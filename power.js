/* Power Analysis – frontend logic */

// const API_BASE = "http://localhost:8000";
const API_BASE = "https://foundationsexperimentation.onrender.com";

// ---------------------------------------------------------------------------
// DOM cache
// ---------------------------------------------------------------------------
const els = {
  mode: document.getElementById("mode"),
  baselineRate: document.getElementById("baselineRate"),
  mde: document.getElementById("mde"),
  mdeLabel: document.getElementById("mdeLabel"),
  sampleSizeInput: document.getElementById("sampleSizeInput"),
  sampleSizeLabel: document.getElementById("sampleSizeLabel"),
  alpha: document.getElementById("alpha"),
  power: document.getElementById("power"),
  alternative: document.getElementById("alternative"),
  calculateBtn: document.getElementById("calculateBtn"),
  status: document.getElementById("status"),
  errorBox: document.getElementById("errorBox"),
  resultsCard: document.getElementById("resultsCard"),
  resultsSummary: document.getElementById("resultsSummary"),
};

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function setStatus(text) {
  els.status.textContent = text;
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.classList.remove("hidden");
}

function clearError() {
  els.errorBox.textContent = "";
  els.errorBox.classList.add("hidden");
}

function hideResults() {
  els.resultsCard.classList.add("hidden");
  els.resultsSummary.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Mode toggle
// ---------------------------------------------------------------------------
els.mode.addEventListener("change", () => {
  const isMDE = els.mode.value === "mde";
  els.mdeLabel.classList.toggle("hidden", isMDE);
  els.sampleSizeLabel.classList.toggle("hidden", !isMDE);
  hideResults();
  clearError();
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate() {
  const baseline = parseFloat(els.baselineRate.value);
  const alpha = parseFloat(els.alpha.value);
  const power = parseFloat(els.power.value);
  const alt = els.alternative.value;
  const mode = els.mode.value;

  if (isNaN(baseline) || baseline <= 0 || baseline >= 1) {
    return "Baseline rate must be between 0 and 1 (exclusive).";
  }
  if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
    return "Alpha must be between 0 and 1 (exclusive).";
  }
  if (isNaN(power) || power <= 0 || power >= 1) {
    return "Power must be between 0 and 1 (exclusive).";
  }

  if (mode === "sample_size") {
    const mde = parseFloat(els.mde.value);
    if (isNaN(mde) || mde === 0) {
      return "MDE must be a nonzero number.";
    }
    if (alt === "larger" && mde < 0) {
      return "MDE must be positive when test type is 'One-sided (larger)'.";
    }
    if (alt === "smaller" && mde > 0) {
      return "MDE must be negative when test type is 'One-sided (smaller)'.";
    }
    const treatment = baseline + mde;
    if (treatment <= 0 || treatment >= 1) {
      return `Treatment rate (baseline + MDE = ${treatment.toFixed(4)}) must be between 0 and 1.`;
    }
  } else {
    const n = parseInt(els.sampleSizeInput.value, 10);
    if (isNaN(n) || n <= 0) {
      return "Sample size per group must be a positive integer.";
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
async function solveSampleSize() {
  const body = {
    baseline_rate: parseFloat(els.baselineRate.value),
    mde: parseFloat(els.mde.value),
    alpha: parseFloat(els.alpha.value),
    power: parseFloat(els.power.value),
    alternative: els.alternative.value,
  };

  const res = await fetch(`${API_BASE}/api/power/sample-size`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "Calculation failed.";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

async function solveMDE() {
  const body = {
    baseline_rate: parseFloat(els.baselineRate.value),
    sample_size_per_group: parseInt(els.sampleSizeInput.value, 10),
    alpha: parseFloat(els.alpha.value),
    power: parseFloat(els.power.value),
    alternative: els.alternative.value,
  };

  const res = await fetch(`${API_BASE}/api/power/mde`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "Calculation failed.";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Render results
// ---------------------------------------------------------------------------
function renderResultItems(items) {
  els.resultsSummary.innerHTML = "";
  for (const [label, value, highlight] of items) {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML =
      `<span class="result-label">${label}</span>` +
      `<span class="result-value${highlight ? " highlight" : ""}">${value}</span>`;
    els.resultsSummary.appendChild(div);
  }
  els.resultsCard.classList.remove("hidden");
}

function renderSampleSizeResult(data) {
  renderResultItems([
    ["Sample size per group", data.sample_size_per_group.toLocaleString(), true],
    ["Total sample size", data.total_sample_size.toLocaleString(), true],
    ["Achieved power", data.achieved_power_at_ceil.toFixed(4), false],
    ["Baseline rate", data.inputs.baseline_rate, false],
    ["MDE", data.inputs.mde, false],
    ["Alpha", data.inputs.alpha, false],
    ["Alternative", data.inputs.alternative, false],
  ]);
}

function renderMDEResult(data) {
  renderResultItems([
    ["Minimum detectable effect", data.mde, true],
    ["Baseline rate", data.inputs.baseline_rate, false],
    ["Sample size per group", data.inputs.sample_size_per_group.toLocaleString(), false],
    ["Power", data.inputs.power, false],
    ["Alpha", data.inputs.alpha, false],
    ["Alternative", data.inputs.alternative, false],
  ]);
}

// ---------------------------------------------------------------------------
// Calculate handler
// ---------------------------------------------------------------------------
els.calculateBtn.addEventListener("click", async () => {
  clearError();
  hideResults();

  const err = validate();
  if (err) {
    showError(err);
    return;
  }

  setStatus("Calculating… (first request may take ~30s if server is waking up)");
  els.calculateBtn.disabled = true;

  try {
    if (els.mode.value === "sample_size") {
      const data = await solveSampleSize();
      renderSampleSizeResult(data);
    } else {
      const data = await solveMDE();
      renderMDEResult(data);
    }
    setStatus("Done");
  } catch (e) {
    showError(e.message);
    setStatus("Error");
  } finally {
    els.calculateBtn.disabled = false;
  }
});
