# Coding Agent Reference - Foundations Experimentation

## Project Overview
A 100% client-side experiment randomization tool. Users upload CSV files, configure randomization parameters, and download results with assignment columns. **Critical**: All processing happens in the browser - no server, no uploads, no tracking.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **CSV Parsing**: PapaParse 5.4.1 (CDN)
- **Deployment**: Static files (can deploy to Cloudflare Pages)
- **No build process**: Direct browser execution

## File Structure
```
.
├── index.html          # UI structure and layout
├── app.js              # Core randomization logic (445 lines)
├── styles.css          # Modern card-based styling
└── README.md           # User documentation
```

## Architecture

### State Management (app.js:28-38)
Single global `state` object tracks:
- `file`, `filename`: Uploaded CSV
- `headers`, `rows`: Parsed data
- `unitColumn`, `assignmentColumn`: Column selections
- `assignments`: Map of unit → treatment/control label
- `randomized`: Boolean flag

### UI Elements (app.js:4-26)
All DOM elements cached in `els` object at initialization.

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

## Important Implementation Details

### Validation Rules
1. **Blank units** (app.js:314-327): Unit column cannot have empty values
2. **Stratum consistency** (app.js:335-340): Each unit must map to exactly one stratum
3. **Column conflicts** (app.js:293-295): Assignment column cannot already exist
4. **Ratio bounds** (app.js:296-298): Treatment ratio must be 0-1
5. **Seed type** (app.js:299-301): Must be an integer

### Output Format
- Original CSV columns preserved in order
- New assignment column appended to the right
- Original row order maintained (critical for reproducibility)

### Error Handling
- Shows first 20 examples of errors (MAX_EXAMPLES constant)
- Errors displayed in dedicated error box with structured list
- Status indicator shows current operation state

## Code Patterns

### Async UI Updates
```javascript
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
await tick(); // Yield to browser for UI updates
```

### Hidden State Management
Elements toggled with `.hidden` class:
- `configCard`: Shows after CSV parsed
- `previewSection`: Shows after file loaded
- `registryModal`: Pro version upsell

### Button States
Download/Save buttons disabled until randomization complete:
```javascript
els.downloadBtn.disabled = !state.randomized;
els.saveRegistryBtn.disabled = !state.randomized;
```

## Design Philosophy

### Privacy-First
- No network requests (except CDN for PapaParse)
- All file processing in-memory
- No analytics, tracking, or data collection

### Reproducibility
- Same seed + same data = same results
- Deterministic sorting before shuffling
- Stable hash functions

### User Trust
- Preview shows first 20 rows before download
- Clear status messages throughout workflow
- Detailed error messages with row examples

## Common Modification Scenarios

### Adding New Validation
Add to validation block in randomize handler (app.js:286-309)

### Changing Randomization Algorithm
Modify stratum processing loop (app.js:373-392)
- Keep seed generation for reproducibility
- Maintain unit sorting for determinism

### Adding New Export Formats
Extend download handler (app.js:410-430)
- Current: CSV via PapaParse.unparse
- Alternative: Could add JSON, Excel, etc.

### UI Enhancements
- **HTML**: Modify structure in index.html
- **Styling**: Use CSS variables in styles.css:1-13
- **Interactivity**: Add event listeners in app.js

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

## Testing Checklist
When making changes, verify:
1. Empty CSV handling
2. CSV with missing headers
3. Blank values in unit column
4. Units spanning multiple strata
5. Treatment ratio edge cases (0, 1, 0.5)
6. Seed reproducibility
7. Large file performance (~50MB)
8. Download preserves original row order

## Git Status (as of last check)
- Branch: main
- Recent commits focus on styling and randomization tool
- Clean working directory

## Contact/Support
Users directed to: https://github.com/anthropics/claude-code/issues
