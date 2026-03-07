# Foundations Experimentation Tools

A suite of experiment tooling hosted at **[foundationsexperimentation.com](https://foundationsexperimentation.com)**.

## Tools

### Randomization Tool (`index.html`)
100% client-side experiment randomization. Upload a CSV, configure parameters, and download results with an assignment column. CSV files never leave your machine.

### Power Analysis Tool (`power.html`)
Compute required sample size or minimum detectable effect (MDE) for binary (yes/no) outcomes. Powered by a Python FastAPI backend.

---

## Running Locally

### Frontend (both tools)
```bash
python -m http.server 3000   # from project root
# Visit http://localhost:3000/index.html or http://localhost:3000/power.html
```

Or open `index.html` directly in a browser (works for the randomization tool; power analysis requires the backend).

### Backend (power analysis only)
```bash
cd backend
venv\Scripts\activate        # Windows
uvicorn main:app --reload --port 8000
```

Set `API_BASE = ""` in `power.js` to route power analysis requests to the local backend instead of the hosted one.

---

## Deployment

| Layer | Host | URL |
|---|---|---|
| Frontend | Cloudflare Pages | `https://foundationsexperimentation.com` |
| Backend | Render (free tier) | `https://foundationsexperimentation.onrender.com` |

Frontend deploys automatically on push. Backend redeploys in ~1-3 min after push. The backend free tier spins down after 15 min of inactivity — the first request after idle may take ~30s.

---

## Randomization Tool — Usage

1. Upload a CSV (must include a header row).
2. Select the randomization unit column (required).
3. Optional: choose stratification columns.
4. Set the treatment ratio, seed, and labels.
5. Click Randomize, preview the first 20 rows, then download the randomized CSV.

### Randomization Rules
- Each unique unit gets exactly one assignment.
- Stratification uses a stable key from selected column values (empty values are marked as a null sentinel).
- Assignments are shuffled with a seeded PRNG (mulberry32) using a hash of the global seed and stratum key — same inputs always produce the same output.
- Leftover units from odd splits are randomized, not forced to treatment or control.
- Output preserves original row order and appends a new assignment column.

### Limitations
- The parsed CSV is loaded into memory. Files up to ~50MB work in modern browsers; very large files may be slow.
- If the assignment column already exists in the input CSV, the tool will error (by design).

---

## Power Analysis Tool — Usage

1. Choose a mode: **Solve for sample size** (given MDE) or **Solve for MDE** (given N per group).
2. Enter baseline rate, MDE or sample size, alpha, power, and alternative hypothesis.
3. Click Calculate — results show the computed value alongside echoed inputs.

### Statistical Method
Two-proportions z-test using Cohen's h (arcsine transformation) via `statsmodels`. MDE is found via binary search (`scipy.optimize.brentq`).
