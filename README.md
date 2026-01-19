# Randomization Tool (Client Only)

A 100% client-side MVP for experiment randomization. Everything runs in the browser. CSV files never leave your machine.

## How to run locally

Option 1: Open `index.html` directly in a modern browser.

Option 2 (recommended for large files):

```bash
python -m http.server
```

Then visit `http://localhost:8000`.

## Deploy to Cloudflare Pages

1. Create a new Cloudflare Pages project.
2. Set the build command to `None` (or leave empty).
3. Set the output directory to the repo root.
4. Deploy. The app is static and uses `index.html`, `styles.css`, and `app.js`.

## Usage

1. Upload a CSV (must include a header row).
2. Select the randomization unit column (required).
3. Optional: choose stratification columns.
4. Set the treatment ratio, seed, and labels.
5. Click Randomize, preview the first 20 rows, then download the randomized CSV.

## Randomization rules

- Randomization happens at the unit level: each unique unit gets exactly one assignment.
- Stratification uses a stable key from the selected column values, including a null marker for empty values.
- For each stratum, assignments are shuffled with a seeded PRNG (mulberry32) using a hash of the global seed and stratum key.
- Leftover units from odd splits are randomized, not forced to treatment or control.
- Output preserves original row order and appends a new assignment column.

## Limitations

- This MVP loads the parsed CSV into memory. Large files (~50MB) should work in modern browsers, but very large files may be slow.
- If the assignment column already exists in the input CSV, the app will error (by design for this MVP).