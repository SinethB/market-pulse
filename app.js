const state = {
  allRows: [],
  filteredRows: [],
  schema: {},
  sourceName: "Synthetic demo dataset",
  sourceType: "demo",
  charts: {},
  rawHeaders: [],
  rawRows: []
};

const fields = [
  {
    key: "date",
    label: "Date",
    required: true,
    aliases: ["date", "invoice date", "order date", "transaction date", "billing date"]
  },
  {
    key: "revenue",
    label: "Revenue",
    required: true,
    aliases: ["revenue", "sales", "net sales", "sales value", "net value", "amount", "total"]
  },
  {
    key: "region",
    label: "Region",
    required: false,
    aliases: ["region", "province", "area", "zone"]
  },
  {
    key: "district",
    label: "District",
    required: false,
    aliases: ["district", "district name"]
  },
  {
    key: "category",
    label: "Category",
    required: false,
    aliases: ["category", "product category", "division", "type"]
  },
  {
    key: "product",
    label: "Product",
    required: false,
    aliases: ["product", "product name", "item", "item description", "sku", "material"]
  },
  {
    key: "customer",
    label: "Customer",
    required: false,
    aliases: ["customer", "customer id", "customer code", "client", "account"]
  },
  {
    key: "units",
    label: "Units",
    required: false,
    aliases: ["units", "quantity", "qty", "volume"]
  }
];

const $ = id => document.getElementById(id);

const fmtMoney = value => {
  return new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(value);
};

const norm = value => {
  return String(value ?? "").trim();
};

const cleanKey = value => {
  return norm(value)
    .toLowerCase()
    .replace(/[_\-\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* ---------------------------------------------------
   DATE / NUMBER PARSING
--------------------------------------------------- */

function parseDate(value) {
  if (value instanceof Date && !isNaN(value)) {
    return value;
  }
  const text = norm(value);
  if (!text) return null;

  // Excel serial date
  if (/^\d+(\.\d+)?$/.test(text)) {
    const number = Number(text);
    if (number > 20000 && number < 80000) {
      return new Date(Math.round((number - 25569) * 86400 * 1000));
    }
  }

  const date = new Date(text);
  return isNaN(date) ? null : date;
}

function parseNum(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = norm(value).replace(/[,\s₨$£€]/g, "");
  if (!text) return null;

  const number = Number(text.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

/* ---------------------------------------------------
   HELPERS
--------------------------------------------------- */

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en", {
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function groupSum(rows, field) {
  const output = {};
  rows.forEach(row => {
    const key = norm(row[field]);
    if (!key) return;
    output[key] = (output[key] || 0) + row.revenue;
  });
  return output;
}

/* ---------------------------------------------------
   CHARTS
--------------------------------------------------- */

function destroyCharts() {
  Object.values(state.charts).forEach(chart => chart?.destroy());
  state.charts = {};
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#9fb0a6", font: { size: 10 } }
      }
    },
    scales: {
      x: {
        ticks: { color: "#7f9287", font: { size: 9 } },
        grid: { color: "#1c2b23" }
      },
      y: {
        ticks: { color: "#7f9287", font: { size: 9 } },
        grid: { color: "#1c2b23" }
      }
    }
  };
}

function canvasMessage(canvasId, message) {
  const canvas = $(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#8fa196";
  ctx.font = "12px Manrope";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.clientWidth / 2, 100);
}

/* ---------------------------------------------------
   DASHBOARD CHARTS
--------------------------------------------------- */

function renderCharts() {
  destroyCharts();
  const rows = state.filteredRows;

  /* Revenue trend */
  const trend = {};
  rows.forEach(row => {
    const key = monthKey(row._date);
    trend[key] = (trend[key] || 0) + row.revenue;
  });

  const trendKeys = Object.keys(trend).sort();

  if (trendKeys.length) {
    state.charts.trend = new Chart($("trendChart"), {
      type: "line",
      data: {
        labels: trendKeys.map(monthLabel),
        datasets: [{
          label: "Revenue",
          data: trendKeys.map(key => trend[key]),
          borderColor: "#b9f36a",
          backgroundColor: "rgba(185,243,106,.08)",
          fill: true,
          tension: .35,
          pointRadius: 2
        }]
      },
      options: baseChartOptions()
    });
  } else {
    canvasMessage("trendChart", "No date values available");
  }

  /* Category */
  const category = groupSum(rows, "category");

  if (Object.keys(category).length) {
    state.charts.category = new Chart($("categoryChart"), {
      type: "doughnut",
      data: {
        labels: Object.keys(category),
        datasets: [{
          data: Object.values(category),
          backgroundColor: ["#b9f36a", "#83a9d6", "#d0a875", "#9b8bc7", "#6fae91", "#d27d7d"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#9fb0a6", font: { size: 9 } }
          }
        }
      }
    });
  } else {
    canvasMessage("categoryChart", "Map Category to enable this view");
  }

  /* Region */
  const region = groupSum(rows, "region");

  if (Object.keys(region).length) {
    state.charts.region = new Chart($("regionChart"), {
      type: "bar",
      data: {
        labels: Object.keys(region),
        datasets: [{
          label: "Revenue",
          data: Object.values(region),
          backgroundColor: "#789e83",
          borderRadius: 5
        }]
      },
      options: { ...baseChartOptions(), indexAxis: "y" }
    });
  } else {
    canvasMessage("regionChart", "Map Region to enable this view");
  }

  /* Product */
  const products = Object.entries(groupSum(rows, "product"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (products.length) {
    state.charts.product = new Chart($("productChart"), {
      type: "bar",
      data: {
        labels: products.map(item => item[0]),
        datasets: [{
          label: "Revenue",
          data: products.map(item => item[1]),
          backgroundColor: "#8ab46d",
          borderRadius: 5
        }]
      },
      options: { ...baseChartOptions(), indexAxis: "y" }
    });
  } else {
    canvasMessage("productChart", "Map Product to enable this view");
  }
}

/* ---------------------------------------------------
   KPIs
--------------------------------------------------- */

function renderKPIs() {
  const rows = state.filteredRows;
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const transactions = rows.length;
  let customers = null;

  if (state.schema.customer) {
    customers = new Set(rows.map(row => norm(row.customer)).filter(Boolean)).size;
  }

  $("kpiRevenue").textContent = fmtMoney(revenue);
  $("kpiOrders").textContent = transactions.toLocaleString();
  $("kpiCustomers").textContent = customers === null ? "—" : customers.toLocaleString();
  $("kpiCustomersSub").textContent = customers === null ? "Map Customer to enable" : "Unique customers";
  $("kpiAov").textContent = transactions ? fmtMoney(revenue / transactions) : "—";

  const months = new Set(rows.map(row => monthKey(row._date))).size;
  $("trendNote").textContent = `${months} month${months === 1 ? "" : "s"} in selection`;
}

/* ---------------------------------------------------
   DISTRICT VIEW
--------------------------------------------------- */

function renderMap() {
  const box = $("districtMap");
  box.innerHTML = "";

  if (!state.schema.district) {
    $("mapNote").textContent = "District column not mapped";
    box.innerHTML = `
      <div class="insight" style="grid-column:1/-1">
        <span class="tag">GEOGRAPHY UNAVAILABLE</span>
        <strong>No District column mapped</strong>
        <p>The dashboard continues to work, but district-level analysis requires a District field.</p>
      </div>
    `;
    return;
  }

  $("mapNote").textContent = "District contribution";
  const districts = Object.entries(groupSum(state.filteredRows, "district"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const max = districts[0]?.[1] || 1;

  districts.forEach(([name, value]) => {
    const cell = document.createElement("div");
    cell.className = "district-cell";
    const alpha = .15 + .65 * (value / max);
    cell.style.background = `rgba(185,243,106,${alpha})`;
    cell.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>Rs. ${fmtMoney(value)}</span>
    `;
    box.appendChild(cell);
  });
}

/* ---------------------------------------------------
   INSIGHTS
--------------------------------------------------- */

function renderInsights() {
  const rows = state.filteredRows;
  const cards = [];
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const category = Object.entries(groupSum(rows, "category")).sort((a, b) => b[1] - a[1]);
  const product = Object.entries(groupSum(rows, "product")).sort((a, b) => b[1] - a[1]);
  const region = Object.entries(groupSum(rows, "region")).sort((a, b) => b[1] - a[1]);

  if (category.length) {
    cards.push(["CATEGORY", "Leading category", `${category[0][0]} contributes ${(category[0][1] / Math.max(total, 1) * 100).toFixed(1)}% of filtered revenue.`]);
  }

  if (product.length) {
    cards.push(["PRODUCT", "Top product", `${product[0][0]} is the highest-revenue product in the current selection.`]);
  }

  if (region.length) {
    cards.push(["REGION", "Leading region", `${region[0][0]} contributes Rs. ${fmtMoney(region[0][1])} in the current selection.`]);
  }

  const monthly = {};
  rows.forEach(row => {
    const key = monthKey(row._date);
    monthly[key] = (monthly[key] || 0) + row.revenue;
  });

  const months = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));

  if (months.length >= 2) {
    const previous = months[months.length - 2][1];
    const latest = months[months.length - 1][1];
    const change = ((latest - previous) / Math.max(Math.abs(previous), 1)) * 100;
    cards.push(["TREND", "Latest month movement", `${change >= 0 ? "Revenue increased" : "Revenue decreased"} ${Math.abs(change).toFixed(1)}% versus the previous month.`]);
  }

  if (state.schema.customer) {
    const customers = new Set(rows.map(row => norm(row.customer)).filter(Boolean)).size;
    cards.push(["CUSTOMER", "Customer base", `${customers.toLocaleString()} unique customers are represented in the current selection.`]);
  }

  if (!cards.length) {
    cards.push(["DATA", "More mappings available", "Map optional columns such as Category, Product, Region or Customer to unlock more insights."]);
  }

  $("insightsGrid").innerHTML = cards.slice(0, 6).map(card => `
    <article class="insight">
      <span class="tag">${card[0]}</span>
      <strong>${escapeHtml(card[1])}</strong>
      <p>${escapeHtml(card[2])}</p>
    </article>
  `).join("");
}

/* ---------------------------------------------------
   DASHBOARD
--------------------------------------------------- */

function renderDashboard() {
  renderKPIs();
  renderCharts();
  renderMap();
  renderInsights();

  $("rowCount").textContent = state.allRows.length.toLocaleString();
  $("datasetName").textContent = state.sourceName;

  const dates = state.allRows.map(row => row._date).sort((a, b) => a - b);
  $("periodValue").textContent = dates.length
    ? `${dates[0].toLocaleDateString()} – ${dates[dates.length - 1].toLocaleDateString()}`
    : "—";

  $("dataStatusText").textContent = state.sourceType === "demo" ? "Demo ready" : "User data loaded";
  $("modeBadge").textContent = state.sourceType === "demo" ? "DEMO DATA" : "YOUR DATA";
  $("modeBadge").className = `mode-badge ${state.sourceType === "demo" ? "demo" : "user"}`;
}

/* ---------------------------------------------------
   FILTERS
--------------------------------------------------- */

function uniqueSorted(rows, key) {
  return [...new Set(rows.map(row => norm(row[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateFilters() {
  const filters = [
    {
      id: "yearFilter",
      label: "All years",
      values: [...new Set(state.allRows.map(row => row._date.getFullYear()))].sort((a, b) => a - b)
    },
    { id: "regionFilter", label: "All regions", values: uniqueSorted(state.allRows, "region") },
    { id: "categoryFilter", label: "All categories", values: uniqueSorted(state.allRows, "category") },
    { id: "districtFilter", label: "All districts", values: uniqueSorted(state.allRows, "district") }
  ];

  filters.forEach(filter => {
    const select = $(filter.id);
    select.innerHTML = `<option value="">${filter.label}</option>` +
      filter.values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  });
}

function applyFilters() {
  const year = $("yearFilter").value;
  const region = $("regionFilter").value;
  const category = $("categoryFilter").value;
  const district = $("districtFilter").value;

  state.filteredRows = state.allRows.filter(row =>
    (!year || String(row._date.getFullYear()) === year) &&
    (!region || row.region === region) &&
    (!category || row.category === category) &&
    (!district || row.district === district)
  );

  renderDashboard();
}

/* ---------------------------------------------------
   NORMALIZE USER DATA
--------------------------------------------------- */

function normalizeRows(rawRows, mapping) {
  return rawRows.map((raw, index) => {
    const date = parseDate(raw[mapping.date]);
    const revenue = parseNum(raw[mapping.revenue]);

    return {
      _sourceIndex: index + 2,
      _date: date,
      revenue,
      region: mapping.region ? norm(raw[mapping.region]) : "",
      district: mapping.district ? norm(raw[mapping.district]) : "",
      category: mapping.category ? norm(raw[mapping.category]) : "",
      product: mapping.product ? norm(raw[mapping.product]) : "",
      customer: mapping.customer ? norm(raw[mapping.customer]) : "",
      units: mapping.units ? parseNum(raw[mapping.units]) : null
    };
  });
}

/* ---------------------------------------------------
   VALIDATION
--------------------------------------------------- */

function validateRows(rows) {
  const invalidDate = rows.filter(row => !row._date).length;
  const invalidRevenue = rows.filter(row => row.revenue === null).length;
  const negative = rows.filter(row => row.revenue !== null && row.revenue < 0).length;
  const seen = new Set();
  const duplicates = new Set();

  rows.forEach(row => {
    const signature = [row._date?.toISOString().slice(0, 10), row.revenue, row.product, row.customer].join("|");
    if (seen.has(signature)) {
      duplicates.add(signature);
    } else {
      seen.add(signature);
    }
  });

  const problems = [];
  if (invalidDate) problems.push(`${invalidDate.toLocaleString()} rows have invalid or missing dates.`);
  if (invalidRevenue) problems.push(`${invalidRevenue.toLocaleString()} rows have invalid or missing revenue.`);
  if (negative) problems.push(`${negative.toLocaleString()} rows contain negative revenue values.`);
  if (duplicates.size) problems.push(`${duplicates.size.toLocaleString()} repeated transaction signatures detected.`);

  return { invalidDate, invalidRevenue, negative, duplicates: duplicates.size, problems };
}

/* ---------------------------------------------------
   COLUMN MAPPING UI
--------------------------------------------------- */

function showMapping(headers, fileName) {
  state.rawHeaders = headers;
  $("mappingFileName").textContent = fileName;
  const grid = $("mappingGrid");

  grid.innerHTML = fields.map(field => {
    const exactGuess = headers.find(header => field.aliases.some(alias => cleanKey(header) === cleanKey(alias)));
    const partialGuess = headers.find(header => field.aliases.some(alias => cleanKey(header).includes(cleanKey(alias))));
    const guess = exactGuess || partialGuess;

    return `
      <div class="mapping-row">
        <label>
          ${field.label}
          ${field.required ? `<span class="required">REQUIRED</span>` : ""}
        </label>
        <select data-field="${field.key}">
          <option value="">— Not mapped —</option>
          ${headers.map(header => `
            <option value="${escapeHtml(header)}" ${header === guess ? "selected" : ""}>
              ${escapeHtml(header)}
            </option>
          `).join("")}
        </select>
      </div>
    `;
  }).join("");

  $("mappingPanel").classList.remove("hidden");
  $("requirementsPanel").classList.add("hidden");
  $("mappingPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------
   READ FILE
--------------------------------------------------- */

async function readFile(file) {
  $("fileError").classList.add("hidden");

  try {
    let rows, headers;

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length) throw new Error("The CSV contains parsing errors.");
      rows = parsed.data;
      headers = parsed.meta.fields || [];
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      headers = rows.length ? Object.keys(rows[0]) : [];
    }

    if (!headers.length || !rows.length) throw new Error("No usable rows or columns were found.");

    state.rawRows = rows;
    showMapping(headers, file.name);
  } catch (error) {
    $("fileError").textContent = error.message || "Could not read the file.";
    $("fileError").classList.remove("hidden");
  }
}

/* ---------------------------------------------------
   GET MAPPING
--------------------------------------------------- */

function mappingFromUI() {
  const mapping = {};
  document.querySelectorAll("#mappingGrid select").forEach(select => {
    mapping[select.dataset.field] = select.value;
  });
  return mapping;
}

/* ---------------------------------------------------
   VALIDATE & BUILD
--------------------------------------------------- */

function validateAndBuild() {
  const mapping = mappingFromUI();
  const missing = fields.filter(field => field.required && !mapping[field.key]).map(field => field.label);
  const box = $("validationBox");

  if (missing.length) {
    box.className = "validation-box bad";
    box.innerHTML = `
      <strong>Missing required mapping</strong>
      <ul>${missing.map(item => `<li>${item} is required.</li>`).join("")}</ul>
    `;
    box.classList.remove("hidden");
    return;
  }

  const rows = normalizeRows(state.rawRows, mapping);
  const validation = validateRows(rows);
  const valid = rows.filter(row => row._date && row.revenue !== null);

  if (!valid.length) {
    box.className = "validation-box bad";
    box.innerHTML = `
      <strong>No valid analytical rows found.</strong>
      <ul>
        <li>Check the Date mapping.</li>
        <li>Check the Revenue mapping.</li>
      </ul>
    `;
    box.classList.remove("hidden");
    return;
  }

  const warnings = validation.problems.length
    ? `<ul>${validation.problems.map(problem => `<li>${escapeHtml(problem)}</li>`).join("")}</ul>`
    : `<ul><li>No date/revenue validation issues detected.</li></ul>`;

  box.className = "validation-box ok";
  box.innerHTML = `
    <strong>${valid.length.toLocaleString()} usable rows ready.</strong>
    ${warnings}
    <p style="margin:9px 0 0; color:#b9f36a;">Your data will now replace the demo dataset.</p>
  `;
  box.classList.remove("hidden");

  state.allRows = valid;
  state.schema = mapping;
  state.sourceName = $("mappingFileName").textContent;
  state.sourceType = "user";

  populateFilters();
  ["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach(id => $(id).value = "");
  
  state.filteredRows = state.allRows.slice();
  renderDashboard();

  setTimeout(() => {
    $("mappingPanel").classList.add("hidden");
    $("dashboard").scrollIntoView({ behavior: "smooth" });
  }, 350);
}

/* ---------------------------------------------------
   LOAD DEMO DATA
--------------------------------------------------- */

async function loadDemo() {
  try {
    // Note the added './' here to guarantee it finds the file on GitHub Pages
    const response = await fetch("./data/sales-data.csv"); 
    const text = await response.text();
    
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    });

    const mapping = {
      date: "Date",
      revenue: "Revenue",
      region: "Region",
      district: "District",
      category: "Category",
      product: "Product",
      customer: "Customer",
      units: "Units"
    };

    state.rawRows = parsed.data;
    state.allRows = normalizeRows(parsed.data, mapping).filter(row => row._date && row.revenue !== null);
    state.schema = mapping;
    state.sourceName = "Synthetic demo dataset";
    state.sourceType = "demo";

    populateFilters();
    ["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach(id => $(id).value = "");
    state.filteredRows = state.allRows.slice();
    renderDashboard();

  } catch (error) {
    console.error(error);
    $("dataStatusText").textContent = "Demo file unavailable";
  }
}

/* ---------------------------------------------------
   UPLOAD UI
--------------------------------------------------- */

function openUpload() {
  $("uploadSection").scrollIntoView({ behavior: "smooth", block: "start" });
  $("fileInput").click();
}

/* ---------------------------------------------------
   EVENTS
--------------------------------------------------- */

$("uploadTopBtn").addEventListener("click", openUpload);
$("uploadHeroBtn").addEventListener("click", openUpload);
$("chooseFileBtn").addEventListener("click", () => $("fileInput").click());

$("fileInput").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) readFile(file);
});

$("dropZone").addEventListener("dragover", event => {
  event.preventDefault();
  $("dropZone").style.borderColor = "#b9f36a";
});

$("dropZone").addEventListener("dragleave", () => {
  $("dropZone").style.borderColor = "";
});

$("dropZone").addEventListener("drop", event => {
  event.preventDefault();
  $("dropZone").style.borderColor = "";
  const file = event.dataTransfer.files?.[0];
  if (file) readFile(file);
});

$("validateBtn").addEventListener("click", validateAndBuild);

$("cancelUploadBtn").addEventListener("click", () => {
  $("mappingPanel").classList.add("hidden");
});

$("loadDemoBtn").addEventListener("click", loadDemo);

$("resetFilters").addEventListener("click", () => {
  ["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach(id => $(id).value = "");
  applyFilters();
});

["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach(id =>
  $(id).addEventListener("change", applyFilters)
);

$("schemaBtn").addEventListener("click", () => {
  $("requirementsPanel").classList.toggle("hidden");
  $("requirementsPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    $(button.dataset.scroll).scrollIntoView({ behavior: "smooth" });
  });
});

/* ---------------------------------------------------
   START
--------------------------------------------------- */
loadDemo();
