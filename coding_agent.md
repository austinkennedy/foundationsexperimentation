# Coding Agent Reference - Foundations Experimentation

## Project Overview
An experiment tooling suite with two pages:
1. **Randomization Tool** — 100% client-side. Users upload CSV files, configure randomization parameters, and download results with assignment columns. All processing happens in the browser.
2. **Power Analysis Tool** — Binary (yes/no) outcome power calculator. Users configure experiment parameters and a Python FastAPI backend computes required sample size or minimum detectable effect.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **CSV Parsing**: PapaParse 5.4.1 (CDN) — randomization page only
- **Backend**: Python FastAPI (power analysis only)
- **Statistical Libraries**: statsmodels, scipy
- **Deployment**: Static files for frontend; FastAPI backend requires a Python server
- **No build process**: Direct browser execution for frontend

## File Structure
```
.
├── index.html              # Randomization page UI
├── app.js                  # Randomization logic (445 lines)
├── power.html              # Power analysis page UI
├── power.js                # Power analysis frontend logic
├── styles.css              # Shared styling (card-based, responsive)
├── README.md               # User documentation
├── coding_agent.md         # This file
└── backend/
    ├── main.py             # FastAPI app with power analysis endpoints
    ├── requirements.txt    # Python dependencies
    └── venv/               # Python virtual environment (gitignored)
```

## Navigation
Both pages share a `<nav class="site-nav">` bar at the top with pill-shaped links. The active page gets `.nav-link--active`. Navigation is plain HTML links (no SPA routing).

## Architecture

### Randomization Page (index.html + app.js)

#### State Management (app.js:28-38)
Single global `state` object tracks:
- `file`, `filename`: Uploaded CSV
- `headers`, `rows`: Parsed data
- `unitColumn`, `assignmentColumn`: Column selections
- `assignments`: Map of unit → treatment/control label
- `randomized`: Boolean flag

#### UI Elements (app.js:4-26)
All DOM elements cached in `els` object at initialization.

### Power Analysis Page (power.html + power.js)

#### Frontend (power.js)
- DOM elements cached in `els` object (same pattern as app.js)
- Mode toggle: "Solve for sample size" vs "Solve for MDE" — shows/hides MDE or sample-size input via `.hidden`
- Client-side validation before API call
- `fetch()` calls to FastAPI backend
- Results rendered as styled key-value pairs in `.results-summary` grid
- `const API_BASE` at top of file — configurable for deployment

#### Backend (backend/main.py)
FastAPI app with CORS middleware. Two POST endpoints:

**`POST /api/power/sample-size`**
- Input: baseline_rate, mde, alpha, power, alternative
- Output: sample_size_per_group, total_sample_size, achieved_power_at_ceil, inputs echo
- Uses `math.ceil()` on raw N so achieved power meets or exceeds target

**`POST /api/power/mde`**
- Input: baseline_rate, sample_size_per_group, alpha, power, alternative
- Output: mde (signed), inputs echo
- Binary search via `scipy.optimize.brentq` on MDE magnitude
- Feasibility check: if target power is unattainable at max feasible MDE, returns 422 with max achievable power

#### Statistical Approach
- **Test**: Two-proportions z-test (normal approximation)
- **Effect size**: Cohen's h via `statsmodels.stats.proportion.proportion_effectsize`
- **Solver**: `statsmodels.stats.power.NormalIndPower.solve_power()`
- **MDE search**: `brentq` on magnitude (power is monotonic in |MDE|), sign applied at the end

#### Alternative Hypothesis Options
- `"two-sided"` — MDE can be positive or negative (abs used for effect size, MDE solver returns positive magnitude)
- `"larger"` — MDE must be positive (treatment rate > baseline)
- `"smaller"` — MDE must be negative (treatment rate < baseline)

## Key Algorithms

### 1. Randomization Flow (app.js:270-408)
```javascript
// Validation → Stratum grouping → Seeded shuffle → Assignment
1. Validate inputs (unit column, ratios, seed)
2. Group units by stratification columns
3. For each stratum:
   - Sort units alphabetically (deterministic)
   - Create treatment/control labels based on ratio
   - Shuffle with seeded PRNG
   - Assign to units
```

### 2. Seeded Random Number Generation
- **fnv1a** (app.js:128-135): Hash function to create seeds from strings
- **mulberry32** (app.js:137-145): Seeded PRNG for deterministic shuffling
- Seed format: `${globalSeed}|${stratumKey}` ensures same results for same inputs

### 3. Stratification (app.js:329-340)
- Units with same stratification column values grouped together
- Blank values marked as `NULL_SENTINEL` = `"__NULL__"`
- Validation ensures each unit maps to only ONE stratum

### 4. CSV Processing (app.js:211-268)
- Uses PapaParse with `worker: true` for large files
- Validates headers exist
- Preserves original row order in output

### 5. Power Analysis (backend/main.py)
- MDE feasibility bounds:
  - `"larger"`: max |MDE| = 1 - baseline - epsilon
  - `"smaller"`: max |MDE| = baseline - epsilon
  - `"two-sided"`: max |MDE| = min(1 - baseline, baseline) - epsilon
- Not-attainable check before binary search prevents infinite loops
- `brentq` tolerance: 1e-6

## Important Implementation Details

### Validation Rules (Randomization)
1. **Blank units** (app.js:314-327): Unit column cannot have empty values
2. **Stratum consistency** (app.js:335-340): Each unit must map to exactly one stratum
3. **Column conflicts** (app.js:293-295): Assignment column cannot already exist
4. **Ratio bounds** (app.js:296-298): Treatment ratio must be 0-1
5. **Seed type** (app.js:299-301): Must be an integer

### Validation Rules (Power Analysis)
Validated on both frontend (power.js) and backend (Pydantic models in main.py):

| Field | Constraint |
|-------|-----------|
| baseline_rate | 0 < x < 1 |
| mde | nonzero; 0 < baseline + mde < 1; sign must match alternative |
| alpha | 0 < x < 1 |
| power | 0 < x < 1 |
| sample_size_per_group | positive integer |
| alternative | "two-sided", "larger", or "smaller" |

### Output Format (Randomization)
- Original CSV columns preserved in order
- New assignment column appended to the right
- Original row order maintained (critical for reproducibility)

### Response Payloads (Power Analysis)
Both endpoints return normalized `inputs` echo + computed outputs, so the frontend renders server values directly without re-deriving.

### Error Handling
- **Randomization**: Shows first 20 examples of errors (MAX_EXAMPLES constant), displayed in error box
- **Power analysis**: Backend returns 422 with `detail` string; frontend displays in error box

## Code Patterns

### Async UI Updates (app.js)
```javascript
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
await tick(); // Yield to browser for UI updates
```

### Hidden State Management
Elements toggled with `.hidden` class on both pages:
- Randomization: `configCard`, `previewSection`, `registryModal`
- Power analysis: `mdeLabel`, `sampleSizeLabel` (mode toggle), `resultsCard`, `errorBox`

### Button States
Randomization: Download/Save buttons disabled until randomization complete.
Power analysis: Calculate button disabled during API call.

## Design Philosophy

### Privacy-First
- Randomization page: No network requests (except CDN for PapaParse)
- Power analysis page: Only contacts the backend API (no third-party services)
- No analytics, tracking, or data collection

### Reproducibility
- Same seed + same data = same randomization results
- Deterministic sorting before shuffling
- Stable hash functions

### User Trust
- Preview shows first 20 rows before download
- Clear status messages throughout workflow
- Detailed error messages with row examples (randomization) or server detail messages (power analysis)

## Common Modification Scenarios

### Adding New Validation (Randomization)
Add to validation block in randomize handler (app.js:286-309)

### Changing Randomization Algorithm
Modify stratum processing loop (app.js:373-392)
- Keep seed generation for reproducibility
- Maintain unit sorting for determinism

### Adding New Export Formats
Extend download handler (app.js:410-430)
- Current: CSV via PapaParse.unparse
- Alternative: Could add JSON, Excel, etc.

### Adding New Power Analysis Outcome Types
- Add new endpoint(s) in backend/main.py
- Add new Pydantic request/response models
- Extend mode selector in power.html and power.js
- Use appropriate statsmodels solver for the outcome type

### Adding New Pages/Tools
- Create new `.html` and `.js` files
- Add a nav link in the `<nav class="site-nav">` block on all pages
- Reuse styles.css (card-based layout, form-grid, etc.)

### UI Enhancements
- **HTML**: Modify structure in index.html or power.html
- **Styling**: Use CSS variables in styles.css:1-13
- **Interactivity**: Add event listeners in app.js or power.js

## Modal System
- Registry modal (index.html:117-131): Currently just a "Pro version" placeholder
- Click handlers support `data-close="true"` attribute (app.js:440-444)

## Styling System

### CSS Variables (styles.css:1-13)
```css
--ink: #111827      /* Primary text */
--muted: #4b5563    /* Secondary text */
--accent: #245bdb   /* Primary action color */
--surface: #ffffff  /* Card background */
--paper: #f5f7fb    /* Page background */
```

### Grid System
- Two-column layout for sections (`.section-grid`)
- Responsive: Collapses to single column < 900px
- Cards can span full width with `.wide` class

### Navigation Styles (styles.css)
- `.site-nav`: Flex row, space-between, collapses to column on mobile
- `.nav-link`: Pill-shaped, ghost-style border
- `.nav-link--active`: Filled accent background

### Results Display Styles (styles.css)
- `.results-summary`: 2-column grid (1-column on mobile)
- `.result-value.highlight`: Accent-colored for primary outputs

## Testing Checklist

### Randomization
1. Empty CSV handling
2. CSV with missing headers
3. Blank values in unit column
4. Units spanning multiple strata
5. Treatment ratio edge cases (0, 1, 0.5)
6. Seed reproducibility
7. Large file performance (~50MB)
8. Download preserves original row order

### Power Analysis
1. Sample size basics: baseline=0.10, MDE=0.02, alpha=0.05, power=0.80, two-sided → ~3,835 per group
2. Round-trip consistency: N from step 1 → MDE solver → MDE ≈ 0.02
3. One-sided "larger": positive MDE, smaller N than two-sided
4. One-sided "smaller": negative MDE, returns negative signed MDE
5. Not-attainable MDE: baseline=0.50, N=10, power=0.99 → 422 error
6. Validation: baseline + MDE > 1 → error
7. Validation: sign mismatch (e.g., "larger" with negative MDE) → error
8. Mode toggle shows/hides correct inputs
9. Responsive layout at < 900px

### Cross-Page
1. Nav links work on both pages
2. Active state highlights correctly on each page

## Running Locally
```bash
# Backend (power analysis)
cd backend
venv\Scripts\activate          # Windows
uvicorn main:app --reload --port 8000

# Frontend (both pages)
python -m http.server 3000     # from project root
# Visit http://localhost:3000/index.html or http://localhost:3000/power.html
```

## Contact/Support
Users directed to: https://github.com/anthropics/claude-code/issues
