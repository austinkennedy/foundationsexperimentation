const NULL_SENTINEL = "__NULL__";
const MAX_EXAMPLES = 20;

const els = {
  fileInput: document.getElementById("csvFile"),
  fileName: document.getElementById("fileName"),
  fileStats: document.getElementById("fileStats"),
  status: document.getElementById("status"),
  errorBox: document.getElementById("errorBox"),
  configCard: document.getElementById("configCard"),
  unitColumn: document.getElementById("unitColumn"),
  assignmentColumn: document.getElementById("assignmentColumn"),
  treatmentRatio: document.getElementById("treatmentRatio"),
  seed: document.getElementById("seed"),
  treatmentLabel: document.getElementById("treatmentLabel"),
  controlLabel: document.getElementById("controlLabel"),
  stratList: document.getElementById("stratList"),
  randomizeBtn: document.getElementById("randomizeBtn"),
  previewSection: document.getElementById("previewSection"),
  previewStats: document.getElementById("previewStats"),
  previewTable: document.getElementById("previewTable"),
  downloadBtn: document.getElementById("downloadBtn")
};

const state = {
  file: null,
  filename: "",
  headers: [],
  rows: [],
  unitColumn: "",
  assignmentColumn: "",
  outputHeaders: [],
  assignments: new Map(),
  randomized: false
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setStatus(message, isError) {
  els.status.textContent = message;
  if (isError) {
    els.status.classList.add("error-state");
  } else {
    els.status.classList.remove("error-state");
  }
}

function clearErrors() {
  els.errorBox.innerHTML = "";
  els.errorBox.classList.add("hidden");
}

function showErrors(messages) {
  els.errorBox.innerHTML = "";
  const title = document.createElement("div");
  title.textContent = "Fix these issues:";
  const list = document.createElement("ul");
  messages.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });
  els.errorBox.append(title, list);
  els.errorBox.classList.remove("hidden");
  setStatus("Needs fixes", true);
}

function resetStateForNewFile() {
  state.file = null;
  state.filename = "";
  state.headers = [];
  state.rows = [];
  state.unitColumn = "";
  state.assignmentColumn = "";
  state.outputHeaders = [];
  state.assignments = new Map();
  state.randomized = false;
  els.fileStats.textContent = "";
  els.configCard.classList.add("hidden");
  els.previewSection.classList.add("hidden");
  els.downloadBtn.disabled = true;
  els.previewTable.innerHTML = "";
  els.previewStats.textContent = "";
}

function populateColumnInputs(headers) {
  els.unitColumn.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a column";
  els.unitColumn.appendChild(placeholder);
  headers.forEach((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    els.unitColumn.appendChild(option);
  });

  els.stratList.innerHTML = "";
  headers.forEach((header, index) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = header;
    input.id = `strat_${index}`;
    const span = document.createElement("span");
    span.textContent = header;
    label.appendChild(input);
    label.appendChild(span);
    els.stratList.appendChild(label);
  });
}

function getSelectedStratColumns() {
  return Array.from(els.stratList.querySelectorAll("input:checked")).map(
    (input) => input.value
  );
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function fnv1a(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function renderPreview() {
  const previewRows = state.rows.slice(0, 20);
  els.previewTable.innerHTML = "";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  state.outputHeaders.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  previewRows.forEach((row) => {
    const tr = document.createElement("tr");
    const unitKey = String(row[state.unitColumn] ?? "");
    state.outputHeaders.forEach((header) => {
      const td = document.createElement("td");
      if (header === state.assignmentColumn) {
        td.textContent = state.assignments.get(unitKey) ?? "";
      } else {
        td.textContent = row[header] ?? "";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  els.previewTable.appendChild(thead);
  els.previewTable.appendChild(tbody);
}

function buildOutputCsv() {
  const data = new Array(state.rows.length);
  for (let i = 0; i < state.rows.length; i += 1) {
    const row = state.rows[i];
    const unitKey = String(row[state.unitColumn] ?? "");
    const outputRow = new Array(state.outputHeaders.length);
    for (let c = 0; c < state.outputHeaders.length; c += 1) {
      const header = state.outputHeaders[c];
      if (header === state.assignmentColumn) {
        outputRow[c] = state.assignments.get(unitKey) ?? "";
      } else {
        outputRow[c] = row[header] ?? "";
      }
    }
    data[i] = outputRow;
  }

  return Papa.unparse({
    fields: state.outputHeaders,
    data
  });
}

els.fileInput.addEventListener("change", () => {
  clearErrors();
  resetStateForNewFile();
  const file = els.fileInput.files[0];
  if (!file) {
    els.fileName.textContent = "No file selected";
    setStatus("Idle");
    return;
  }

  state.file = file;
  state.filename = file.name || "data.csv";
  els.fileName.textContent = state.filename;
  setStatus("Parsing CSV...");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    worker: true,
    complete: (results) => {
      if (results.errors && results.errors.length > 0) {
        const examples = results.errors.slice(0, MAX_EXAMPLES).map((err) =>
          `Row ${err.row}: ${err.message}`
        );
        showErrors([
          "CSV parsing failed. Please check formatting.",
          ...examples
        ]);
        return;
      }

      const headers = results.meta.fields || [];
      if (headers.length === 0) {
        showErrors(["CSV has no headers. Please include a header row."]);
        return;
      }

      state.headers = headers;
      state.rows = results.data;
      populateColumnInputs(headers);
      els.configCard.classList.remove("hidden");
      els.fileStats.textContent = `${state.rows.length} rows, ${headers.length} columns`;
      setStatus("Loaded. Configure and randomize.");
    },
    error: (error) => {
      showErrors(["CSV parsing failed.", error.message]);
    }
  });
});

els.randomizeBtn.addEventListener("click", async () => {
  clearErrors();
  if (!state.rows.length) {
    showErrors(["Upload a CSV file before randomizing."]);
    return;
  }

  const unitColumn = els.unitColumn.value;
  const assignmentColumn = els.assignmentColumn.value.trim();
  const ratio = parseFloat(els.treatmentRatio.value);
  const seedValue = Number(els.seed.value);
  const seedInput = Number.isInteger(seedValue) ? seedValue : NaN;
  const treatmentLabel = els.treatmentLabel.value.trim();
  const controlLabel = els.controlLabel.value.trim();
  const stratColumns = getSelectedStratColumns();

  const errors = [];
  if (!unitColumn) {
    errors.push("Select a randomization unit column.");
  }
  if (!assignmentColumn) {
    errors.push("Assignment column name cannot be empty.");
  }
  if (state.headers.includes(assignmentColumn)) {
    errors.push("Assignment column already exists in the CSV header.");
  }
  if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
    errors.push("Treatment ratio must be a number between 0 and 1.");
  }
  if (Number.isNaN(seedInput)) {
    errors.push("Seed must be an integer.");
  }
  if (!treatmentLabel || !controlLabel) {
    errors.push("Treatment and control labels cannot be empty.");
  }

  if (errors.length > 0) {
    showErrors(errors);
    return;
  }

  setStatus("Validating...");
  await tick();

  const blankUnitRows = [];
  const unitStratum = new Map();
  const mismatchUnits = new Set();

  for (let i = 0; i < state.rows.length; i += 1) {
    const row = state.rows[i];
    const rawUnit = row[unitColumn];
    const unitKey = rawUnit === null || rawUnit === undefined ? "" : String(rawUnit);
    if (unitKey.trim() === "") {
      if (blankUnitRows.length < MAX_EXAMPLES) {
        blankUnitRows.push(i + 1);
      }
      continue;
    }

    const stratValues = stratColumns.map((col) => {
      const value = row[col];
      return isBlank(value) ? NULL_SENTINEL : String(value);
    });
    const stratumKey = JSON.stringify(stratValues);

    if (unitStratum.has(unitKey) && unitStratum.get(unitKey) !== stratumKey) {
      mismatchUnits.add(unitKey);
    } else {
      unitStratum.set(unitKey, stratumKey);
    }
  }

  if (blankUnitRows.length > 0) {
    showErrors([
      "Randomization unit column has empty values.",
      `Example row numbers: ${blankUnitRows.join(", ")}`
    ]);
    return;
  }

  if (mismatchUnits.size > 0) {
    const examples = Array.from(mismatchUnits).slice(0, MAX_EXAMPLES);
    showErrors([
      "Some units map to multiple strata. Ensure stratification columns are consistent per unit.",
      `Example unit IDs: ${examples.join(", ")}`
    ]);
    return;
  }

  const stratumUnits = new Map();
  unitStratum.forEach((stratumKey, unitKey) => {
    if (!stratumUnits.has(stratumKey)) {
      stratumUnits.set(stratumKey, []);
    }
    stratumUnits.get(stratumKey).push(unitKey);
  });

  setStatus(`Randomizing ${unitStratum.size} units across ${stratumUnits.size} strata...`);
  await tick();

  const assignments = new Map();
  const combinedSeedBase = String(seedInput);

  for (const [stratumKey, units] of stratumUnits.entries()) {
    const unitsSorted = [...units].sort((a, b) => a.localeCompare(b));
    const n = unitsSorted.length;
    const k = Math.floor(n * ratio);
    const labels = [];
    for (let i = 0; i < k; i += 1) {
      labels.push(treatmentLabel);
    }
    for (let i = k; i < n; i += 1) {
      labels.push(controlLabel);
    }

    const seed = fnv1a(`${combinedSeedBase}|${stratumKey}`);
    const rng = mulberry32(seed);
    shuffle(labels, rng);

    for (let i = 0; i < n; i += 1) {
      assignments.set(unitsSorted[i], labels[i]);
    }
  }

  state.unitColumn = unitColumn;
  state.assignmentColumn = assignmentColumn;
  state.outputHeaders = [...state.headers, assignmentColumn];
  state.assignments = assignments;
  state.randomized = true;

  els.previewStats.textContent = `${state.rows.length} rows, ${unitStratum.size} units, ${
    stratumUnits.size
  } strata`;
  renderPreview();
  els.previewSection.classList.remove("hidden");
  els.downloadBtn.disabled = false;
  setStatus("Ready to download.");
});

els.downloadBtn.addEventListener("click", async () => {
  if (!state.randomized) {
    showErrors(["Randomize the file before downloading."]);
    return;
  }
  setStatus("Preparing CSV...");
  await tick();

  const csv = buildOutputCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `randomized_${state.filename}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Download complete.");
});
