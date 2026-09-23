const state = {
  allRows: [],
  filteredRows: [],
  charts: {},
  map: null,
  markers: [],
};

const districtCoords = {
  Colombo: [6.9271, 79.8612], Gampaha: [7.0873, 80.0144], Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337], Matale: [7.4675, 80.6234], "Nuwara Eliya": [6.9497, 80.7891],
  Galle: [6.0329, 80.2168], Matara: [5.9549, 80.5550], Hambantota: [6.1429, 81.1212],
  Jaffna: [9.6615, 80.0255], Kilinochchi: [9.3803, 80.3770], Mannar: [8.9810, 79.9044],
  Vavuniya: [8.7542, 80.4982], Mullaitivu: [9.2671, 80.8128], Batticaloa: [7.7170, 81.7000],
  Ampara: [7.2917, 81.6720], Trincomalee: [8.5874, 81.2152], Kurunegala: [7.4863, 80.3623],
  Puttalam: [8.0362, 79.8283], Anuradhapura: [8.3114, 80.4037], Polonnaruwa: [7.9403, 81.0188],
  Badulla: [6.9934, 81.0550], Monaragala: [6.8728, 81.3507], Ratnapura: [6.7056, 80.3847],
  Kegalle: [7.2513, 80.3464],
};

const $ = (id) => document.getElementById(id);
const unique = (arr) => [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b)));

function formatMoney(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rs. ${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}Rs. ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}Rs. ${(abs / 1e3).toFixed(0)}K`;
  return `${sign}Rs. ${abs.toFixed(0)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function groupSum(rows, key) {
  const totals = new Map();
  rows.forEach((row) => {
    totals.set(row[key], (totals.get(row[key]) || 0) + Number(row.revenue || 0));
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function setOptions(id, values) {
  $(id).innerHTML = '<option value="ALL">All</option>' +
    values.map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${value}</option>`).join("");
}

async function loadData() {
  const response = await fetch("data/sales-data.csv");
  if (!response.ok) throw new Error("Unable to load dataset");

  const text = await response.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  state.allRows = parsed.data.filter((row) => row.transaction_id);

  setOptions("yearFilter", unique(state.allRows.map((r) => r.year)));
  setOptions("regionFilter", unique(state.allRows.map((r) => r.region)));
  setOptions("categoryFilter", unique(state.allRows.map((r) => r.category)));
  setOptions("districtFilter", unique(state.allRows.map((r) => r.district)));

  ["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach((id) => {
    $(id).addEventListener("change", applyFilters);
  });

  $("sampleBtn").addEventListener("click", () => {
    ["yearFilter", "regionFilter", "categoryFilter", "districtFilter"].forEach((id) => {
      $(id).value = "ALL";
    });
    applyFilters();
  });

  $("insightBtn").addEventListener("click", renderInsights);
  applyFilters();
}

function applyFilters() {
  const year = $("yearFilter").value;
  const region = $("regionFilter").value;
  const category = $("categoryFilter").value;
  const district = $("districtFilter").value;

  state.filteredRows = state.allRows.filter((row) =>
    (year === "ALL" || String(row.year) === year) &&
    (region === "ALL" || row.region === region) &&
    (category === "ALL" || row.category === category) &&
    (district === "ALL" || row.district === district)
  );

  $("rowCount").textContent = `${formatNumber(state.filteredRows.length)} records`;
  updateDashboard();
}

function updateDashboard() {
  updateKPIs();
  renderCharts();
  renderProducts();
  renderMap();
  renderInsights();
}

function updateKPIs() {
  const rows = state.filteredRows;
  const revenue = sum(rows, "revenue");
  const orders = sum(rows, "orders");
  const customers = new Set(rows.map((r) => r.customer_id)).size;
  const aov = orders ? revenue / orders : 0;

  $("kpiRevenue").textContent = formatMoney(revenue);
  $("kpiOrders").textContent = formatNumber(orders);
  $("kpiCustomers").textContent = formatNumber(customers);
  $("kpiAOV").textContent = formatMoney(aov);

  const year = $("yearFilter").value;
  let previousRows = [];

  if (year !== "ALL") {
    const previousYear = Number(year) - 1;
    previousRows = state.allRows.filter((row) =>
      Number(row.year) === previousYear &&
      ($("regionFilter").value === "ALL" || row.region === $("regionFilter").value) &&
      ($("categoryFilter").value === "ALL" || row.category === $("categoryFilter").value) &&
      ($("districtFilter").value === "ALL" || row.district === $("districtFilter").value)
    );
  }

  const previousRevenue = sum(previousRows, "revenue");
  const previousOrders = sum(previousRows, "orders");
  const growth = previousRevenue ? ((revenue / previousRevenue) - 1) * 100 : null;
  const previousAov = previousOrders ? previousRevenue / previousOrders : 0;
  const aovGrowth = previousAov ? ((aov / previousAov) - 1) * 100 : null;

  $("kpiRevenueMeta").textContent = growth === null
    ? "select a year to compare"
    : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs ${Number(year) - 1}`;
  $("kpiOrdersMeta").textContent = `${formatNumber(orders)} filtered transactions`;
  $("kpiCustomersMeta").textContent = `${formatNumber(customers)} unique customers`;
  $("kpiAOVMeta").textContent = aovGrowth === null
    ? "revenue ÷ orders"
    : `${aovGrowth >= 0 ? "+" : ""}${aovGrowth.toFixed(1)}% vs prior year AOV`;
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#9aada4", font: { family: "Manrope", size: 11 } },
      },
      tooltip: {
        backgroundColor: "#0b1711",
        titleColor: "#eff8f2",
        bodyColor: "#a9b9b1",
        borderColor: "rgba(220,240,228,.12)",
        borderWidth: 1,
        displayColors: false,
      },
    },
    scales: {
      x: {
        ticks: { color: "#667a70", font: { family: "DM Mono", size: 9 } },
        grid: { color: "rgba(220,240,228,.06)" },
      },
      y: {
        ticks: { color: "#667a70", font: { family: "DM Mono", size: 9 } },
        grid: { color: "rgba(220,240,228,.06)" },
      },
    },
  };
}

function destroyChart(name) {
  if (state.charts[name]) state.charts[name].destroy();
}

function renderCharts() {
  const rows = state.filteredRows;
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthly = monthLabels.map((_, index) =>
    rows.filter((r) => Number(r.month) === index + 1).reduce((total, r) => total + Number(r.revenue), 0)
  );

  destroyChart("trend");
  state.charts.trend = new Chart($("trendChart"), {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{
        data: monthly,
        borderColor: "#b7f34a",
        backgroundColor: "rgba(183,243,74,.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 2.5,
        pointBackgroundColor: "#b7f34a",
        pointBorderWidth: 0,
      }],
    },
    options: {
      ...chartOptions(),
      plugins: {
        ...chartOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...chartOptions().plugins.tooltip,
          callbacks: { label: (ctx) => formatMoney(ctx.raw) },
        },
      },
      scales: {
        ...chartOptions().scales,
        y: {
          ...chartOptions().scales.y,
          ticks: {
            ...chartOptions().scales.y.ticks,
            callback: (value) => formatMoney(value).replace("Rs. ", ""),
          },
        },
      },
    },
  });

  const categories = groupSum(rows, "category").slice(0, 6);
  destroyChart("category");
  state.charts.category = new Chart($("categoryChart"), {
    type: "doughnut",
    data: {
      labels: categories.map((x) => x[0]),
      datasets: [{
        data: categories.map((x) => x[1]),
        backgroundColor: ["#b7f34a", "#8fcf73", "#6fae82", "#568e86", "#3d6e7a", "#315363"],
        borderColor: "#102019",
        borderWidth: 2,
      }],
    },
    options: {
      ...chartOptions(),
      cutout: "68%",
      plugins: {
        ...chartOptions().plugins,
        tooltip: {
          ...chartOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.raw)}` },
        },
      },
    },
  });

  const regions = groupSum(rows, "region").slice(0, 9);
  destroyChart("region");
  state.charts.region = new Chart($("regionChart"), {
    type: "bar",
    data: {
      labels: regions.map((x) => x[0]),
      datasets: [{
        data: regions.map((x) => x[1]),
        backgroundColor: "rgba(183,243,74,.78)",
        borderRadius: 2,
        barThickness: 18,
      }],
    },
    options: {
      ...chartOptions(),
      indexAxis: "y",
      plugins: {
        ...chartOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...chartOptions().plugins.tooltip,
          callbacks: { label: (ctx) => formatMoney(ctx.raw) },
        },
      },
      scales: {
        x: {
          ...chartOptions().scales.x,
          ticks: {
            ...chartOptions().scales.x.ticks,
            callback: (value) => formatMoney(value).replace("Rs. ", ""),
          },
        },
        y: {
          ...chartOptions().scales.y,
          ticks: { ...chartOptions().scales.y.ticks, color: "#93a79d" },
        },
      },
    },
  });
}

function renderProducts() {
  const products = groupSum(state.filteredRows, "product").slice(0, 6);
  const max = products.length ? products[0][1] : 1;
  $("productList").innerHTML = products.map((item, index) => `
    <div class="rank-row">
      <div class="rank-top">
        <span class="rank-name">${String(index + 1).padStart(2, "0")} · ${item[0]}</span>
        <span class="rank-value">${formatMoney(item[1])}</span>
      </div>
      <div class="rank-track"><div class="rank-fill" style="width:${(item[1] / max * 100).toFixed(1)}%"></div></div>
    </div>
  `).join("");
}

function initMap() {
  if (state.map) return;
  state.map = L.map("map", { zoomControl: true, attributionControl: false }).setView([7.8, 80.75], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    opacity: 0.22,
    maxZoom: 12,
    attribution: "© OpenStreetMap",
  }).addTo(state.map);
}

function markerColor(revenue, max) {
  const ratio = max ? revenue / max : 0;
  if (ratio > 0.7) return "#b7f34a";
  if (ratio > 0.4) return "#8fcf73";
  if (ratio > 0.2) return "#5f9e7b";
  return "#3f716d";
}

function renderMap() {
  initMap();
  state.markers.forEach((marker) => state.map.removeLayer(marker));
  state.markers = [];

  const districtTotals = Object.fromEntries(groupSum(state.filteredRows, "district"));
  const values = Object.values(districtTotals).map(Number);
  const max = Math.max(...values, 1);

  Object.entries(districtCoords).forEach(([district, coords]) => {
    const revenue = Number(districtTotals[district] || 0);
    const ratio = revenue / max;
    const radius = revenue ? 5 + ratio * 20 : 3;
    const marker = L.circleMarker(coords, {
      radius,
      fillColor: revenue ? markerColor(revenue, max) : "#30453e",
      color: revenue ? "#d9f3c0" : "#4a5e55",
      weight: 0.7,
      opacity: 0.8,
      fillOpacity: 0.75,
    }).addTo(state.map);
    marker.bindPopup(`<strong>${district}</strong><br><span style="color:#9aada4">Revenue</span> ${formatMoney(revenue)}`);
    state.markers.push(marker);
  });
}

function renderInsights() {
  const rows = state.filteredRows;
  const revenue = sum(rows, "revenue");
  const regions = groupSum(rows, "region");
  const categories = groupSum(rows, "category");
  const districts = groupSum(rows, "district");
  const products = groupSum(rows, "product");
  const year = $("yearFilter").value;

  let previousRows = [];
  if (year !== "ALL") {
    const previousYear = Number(year) - 1;
    previousRows = state.allRows.filter((row) =>
      Number(row.year) === previousYear &&
      ($("regionFilter").value === "ALL" || row.region === $("regionFilter").value) &&
      ($("categoryFilter").value === "ALL" || row.category === $("categoryFilter").value) &&
      ($("districtFilter").value === "ALL" || row.district === $("districtFilter").value)
    );
  }

  const previousRevenue = sum(previousRows, "revenue");
  const insights = [];

  if (previousRevenue) {
    const growth = (revenue / previousRevenue - 1) * 100;
    insights.push({
      type: growth >= 0 ? "↑ GROWTH" : "↓ PRESSURE",
      title: `Revenue is ${growth >= 0 ? "up" : "down"} ${Math.abs(growth).toFixed(1)}%`,
      body: `Compared with ${Number(year) - 1}, the selected view has ${formatMoney(Math.abs(revenue - previousRevenue))} of ${growth >= 0 ? "additional" : "lower"} revenue.`,
    });
  } else {
    insights.push({
      type: "◆ SIGNAL",
      title: "Baseline view loaded",
      body: "Select a specific year to compare the current view with the previous year.",
    });
  }

  if (regions.length) {
    const [name, value] = regions[0];
    const share = revenue ? value / revenue * 100 : 0;
    insights.push({ type: "● CONCENTRATION", title: `${name} leads the market`, body: `${name} contributes ${share.toFixed(1)}% of filtered revenue at ${formatMoney(value)}.` });
  }

  if (categories.length) {
    const [name, value] = categories[0];
    const secondName = categories[1]?.[0];
    const secondValue = categories[1]?.[1] || 0;
    const gap = secondValue ? (value / secondValue - 1) * 100 : 0;
    insights.push({ type: "◆ MIX", title: `${name} is the leading category`, body: `${name} generates ${formatMoney(value)}${secondName ? `, ${gap.toFixed(1)}% ahead of ${secondName}` : ""}.` });
  }

  if (districts.length) {
    const lowest = [...districts].sort((a, b) => a[1] - b[1])[0];
    const highest = districts[0];
    insights.push({ type: "↑ OPPORTUNITY", title: `${lowest[0]} has the lightest revenue footprint`, body: `${lowest[0]} contributes ${formatMoney(lowest[1])}; compare with ${highest[0]} at ${formatMoney(highest[1])} to identify expansion potential.` });
  }

  if (products.length) {
    const topFive = products.slice(0, 5).reduce((total, item) => total + item[1], 0);
    const concentration = revenue ? topFive / revenue * 100 : 0;
    insights.push({
      type: concentration > 45 ? "⚠ RISK" : "◎ PORTFOLIO",
      title: `Top 5 products represent ${concentration.toFixed(1)}% of revenue`,
      body: concentration > 45 ? "Revenue is relatively concentrated in a small product set; product mix deserves attention." : "Revenue is spread across a broader product mix, reducing concentration pressure.",
    });
  }

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthlyTotals = Array.from({ length: 12 }, (_, index) =>
    rows.filter((r) => Number(r.month) === index + 1).reduce((total, r) => total + Number(r.revenue), 0)
  );
  const strongestMonthIndex = monthlyTotals.indexOf(Math.max(...monthlyTotals));
  if (strongestMonthIndex >= 0) {
    insights.push({ type: "◇ SEASONAL", title: `${months[strongestMonthIndex]} is the strongest month`, body: `The highest monthly revenue in the current view is ${formatMoney(monthlyTotals[strongestMonthIndex])}.` });
  }

  $("insightGrid").innerHTML = insights.slice(0, 6).map((item) => `
    <article class="insight">
      <div class="type">${item.type}</div>
      <h3>${item.title}</h3>
      <p>${item.body}</p>
    </article>
  `).join("");
}

loadData().catch((error) => {
  console.error(error);
  $("rowCount").textContent = "dataset error";
  $("insightGrid").innerHTML = `<article class="insight"><div class="type">ERROR</div><h3>Dataset could not be loaded.</h3><p>Check that <code>data/sales-data.csv</code> exists in the repository root and that GitHub Pages is serving from the repository root.</p></article>`;
});
