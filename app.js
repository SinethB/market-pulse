/* =========================================================
   MARKET PULSE — app.js
   Sections:
     1. Utilities
     2. Data Engine (parse, detect, map)
     3. Analytics Engine (pure functions)
     4. Insight Engine (rule-based)
     5. Visualization Layer (Chart.js)
     6. App Controller (state + wiring)
   ========================================================= */

/* ---------- 1. Utilities ---------- */

const fmtCurrency = (n) => {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "Rs. " + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "Rs. " + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "Rs. " + (n / 1e3).toFixed(1) + "K";
  return "Rs. " + n.toFixed(0);
};

const fmtNumber = (n) => {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US");
};

const fmtPct = (n) => (isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");

const toNumber = (v) => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
};

const parseDate = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + v * 86400000);
  }
  if (!v) return null;
  // Try ISO first
  const iso = new Date(v);
  if (!isNaN(iso)) return iso;
  // DD/MM/YYYY or MM/DD/YYYY — try DD/MM first (common in LK/IN/EU)
  const m = String(v).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    let d1 = parseInt(a, 10), d2 = parseInt(b, 10);
    y = parseInt(y, 10);
    if (y < 100) y += 2000;
    // If first > 12, definitely DD/MM
    const day = d1 > 12 ? d1 : d2 > 12 ? d2 : d1;
    const month = d1 > 12 ? d2 : d2 > 12 ? d1 : d2;
    return new Date(y, month - 1, day);
  }
  return null;
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const unique = (arr) => Array.from(new Set(arr));

const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);

const showToast = (msg, type = "") => {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + type;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add("hidden"), 3000);
};

/* ---------- 2. Data Engine ---------- */

/**
 * Column role detection heuristics.
 * Returns { revenue, date, product, region, category, customer } column names.
 */
function detectColumns(rows) {
  if (!rows.length) return {};
  const cols = Object.keys(rows[0]);
  const sample = rows.slice(0, 200);

  const score = { revenue: {}, date: {}, product: {}, region: {}, category: {}, customer: {} };

  for (const col of cols) {
    const values = sample.map(r => r[col]).filter(v => v !== "" && v != null);
    if (!values.length) continue;

    const numericCount = values.filter(v => !isNaN(toNumber(v)) && toNumber(v) > 0).length;
    const dateCount = values.filter(v => parseDate(v) instanceof Date && !isNaN(parseDate(v))).length;
    const numericRatio = numericCount / values.length;
    const dateRatio = dateCount / values.length;
    const distinct = unique(values).length;
    const cardinality = distinct / values.length;

    const lc = col.toLowerCase();

    // Revenue
    if (numericRatio > 0.85) {
      let s = 0;
      if (/revenue|sales|amount|total|price|value|turnover|gmv/.test(lc)) s += 3;
      if (numericCount > 0) {
        const avg = sum(values.map(toNumber).filter(n => !isNaN(n))) / numericCount;
        if (avg > 100) s += 1;
      }
      score.revenue[col] = s;
    }

    // Date
    if (dateRatio > 0.85) {
      let s = 2;
      if (/date|time|day|month|year|created/.test(lc)) s += 3;
      score.date[col] = s;
    }

    // Product / Customer / Region / Category — string columns
    if (numericRatio < 0.3 && dateRatio < 0.3) {
      // Region
      if (/region|state|province|city|district|area|zone|country/.test(lc)) {
        score.region[col] = 4;
      } else if (distinct >= 2 && distinct <= 12) {
        score.region[col] = 2;
      }
      // Category
      if (/category|segment|type|group|department|class|line/.test(lc)) {
        score.category[col] = 4;
      } else if (distinct >= 3 && distinct <= 15 && cardinality < 0.2) {
        score.category[col] = 1.5;
      }
      // Product
      if (/product|item|sku|name|title/.test(lc)) {
        score.product[col] = 4;
      } else if (distinct > 8) {
        score.product[col] = 1;
      }
      // Customer
      if (/customer|client|user|buyer|account|id/.test(lc)) {
        score.customer[col] = 4;
      } else if (distinct > 5 && cardinality > 0.05 && cardinality < 0.8) {
        score.customer[col] = 1;
      }
    }
  }

  const pick = (role) => {
    const entries = Object.entries(score[role]).sort((a, b) => b[1] - a[1]);
    return entries.length && entries[0][1] > 0 ? entries[0][0] : "";
  };

  // Avoid collisions: assign unique columns greedily by score
  const chosen = {};
  const used = new Set();
  const priority = ["revenue", "date", "product", "customer", "category", "region"];
  for (const role of priority) {
    const entries = Object.entries(score[role])
      .filter(([c]) => !used.has(c))
      .sort((a, b) => b[1] - a[1]);
    if (entries.length && entries[0][1] > 0) {
      chosen[role] = entries[0][0];
      used.add(entries[0][0]);
    } else {
      chosen[role] = "";
    }
  }
  return chosen;
}

/**
 * Normalize raw rows using the mapping.
 * Produces objects with canonical keys: revenue, date, product, region, category, customer.
 */
function normalizeRows(rawRows, mapping) {
  const out = [];
  let skipped = 0;
  for (const r of rawRows) {
    const revenue = mapping.revenue ? toNumber(r[mapping.revenue]) : NaN;
    if (!isFinite(revenue)) { skipped++; continue; }

    const date = mapping.date ? parseDate(r[mapping.date]) : null;

    out.push({
      revenue,
      date: date && !isNaN(date) ? date : null,
      year: date && !isNaN(date) ? date.getFullYear() : null,
      monthKey: date && !isNaN(date) ? monthKey(date) : null,
      product: mapping.product ? String(r[mapping.product] ?? "Unknown") : "Unknown",
      region: mapping.region ? String(r[mapping.region] ?? "Unknown") : "Unknown",
      category: mapping.category ? String(r[mapping.category] ?? "Unknown") : "Unknown",
      customer: mapping.customer ? String(r[mapping.customer] ?? "Unknown") : null,
    });
  }
  return { rows: out, skipped };
}

/* ---------- 3. Analytics Engine ---------- */

function filterRows(rows, f) {
  return rows.filter(r => {
    if (f.year && f.year !== "all" && String(r.year) !== f.year) return false;
    if (f.region && f.region !== "all" && r.region !== f.region) return false;
    if (f.category && f.category !== "all" && r.category !== f.category) return false;
    return true;
  });
}

function computeKPIs(rows) {
  const revenue = sum(rows, r => r.revenue);
  const orders = rows.length;
  const customers = unique(rows.filter(r => r.customer).map(r => r.customer)).length;
  const aov = orders > 0 ? revenue / orders : 0;
  return { revenue, orders, customers, aov };
}

function revenueTrend(rows) {
  const byMonth = {};
  for (const r of rows) {
    if (!r.monthKey) continue;
    byMonth[r.monthKey] = (byMonth[r.monthKey] || 0) + r.revenue;
  }
  const keys = Object.keys(byMonth).sort();
  return { labels: keys, values: keys.map(k => byMonth[k]) };
}

function topProducts(rows, n = 8) {
  const map = {};
  for (const r of rows) map[r.product] = (map[r.product] || 0) + r.revenue;
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

function groupBy(rows, key) {
  const map = {};
  for (const r of rows) {
    const k = r[key] || "Unknown";
    if (!map[k]) map[k] = { revenue: 0, orders: 0, customers: new Set() };
    map[k].revenue += r.revenue;
    map[k].orders += 1;
    if (r.customer) map[k].customers.add(r.customer);
  }
  return Object.entries(map)
    .map(([label, v]) => ({ label, revenue: v.revenue, orders: v.orders, customers: v.customers.size }))
    .sort((a, b) => b.revenue - a.revenue);
}

function growthByGroup(rows, key) {
  // Compare last full month vs previous full month for each group
  const byMonth = {};
  for (const r of rows) {
    if (!r.monthKey) continue;
    if (!byMonth[r.monthKey]) byMonth[r.monthKey] = {};
    const g = r[key] || "Unknown";
    byMonth[r.monthKey][g] = (byMonth[r.monthKey][g] || 0) + r.revenue;
  }
  const months = Object.keys(byMonth).sort();
  if (months.length < 2) return [];
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const groups = unique([...Object.keys(byMonth[last] || {}), ...Object.keys(byMonth[prev] || {})]);
  return groups.map(g => {
    const l = (byMonth[last] || {})[g] || 0;
    const p = (byMonth[prev] || {})[g] || 0;
    const growth = p > 0 ? (l - p) / p : (l > 0 ? 1 : 0);
    return { label: g, last: l, prev: p, growth };
  });
}

function repeatVsOneTime(rows) {
  if (!rows.length || !rows[0].customer) return null;
  const byCustomer = {};
  for (const r of rows) {
    if (!r.customer) continue;
    if (!byCustomer[r.customer]) byCustomer[r.customer] = { revenue: 0, orders: 0 };
    byCustomer[r.customer].revenue += r.revenue;
    byCustomer[r.customer].orders += 1;
  }
  const repeat = [], oneTime = [];
  for (const c of Object.values(byCustomer)) {
    (c.orders > 1 ? repeat : oneTime).push(c.revenue / c.orders);
  }
  if (!repeat.length || !oneTime.length) return null;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rAvg = avg(repeat), oAvg = avg(oneTime);
  return {
    repeatAOV: rAvg,
    oneTimeAOV: oAvg,
    ratio: oAvg > 0 ? rAvg / oAvg : 0,
    repeatCount: repeat.length,
    oneTimeCount: oneTime.length,
  };
}

function concentration(rows, n = 5) {
  const map = {};
  for (const r of rows) map[r.product] = (map[r.product] || 0) + r.revenue;
  const total = sum(Object.values(map));
  const sorted = Object.values(map).sort((a, b) => b - a);
  const topN = sum(sorted.slice(0, n));
  return { share: total > 0 ? topN / total : 0, topNRevenue: topN, total, n };
}

/* ---------- 4. Insight Engine ---------- */

function ruleGrowth(rows) {
  const g = growthByGroup(rows, "category");
  if (!g.length) return null;
  const best = g.filter(x => x.prev > 0).sort((a, b) => b.growth - a.growth)[0];
  if (!best || best.growth < 0.1) return null;
  return {
    type: "growth",
    tag: "↑ GROWTH",
    title: `${best.label} is accelerating`,
    body: `Revenue grew ${fmtPct(best.growth)} in the latest month compared with the previous month (${fmtCurrency(best.last)} vs ${fmtCurrency(best.prev)}).`,
  };
}

function ruleDecline(rows) {
  const g = growthByGroup(rows, "category");
  if (!g.length) return null;
  const worst = g.filter(x => x.prev > 0).sort((a, b) => a.growth - b.growth)[0];
  if (!worst || worst.growth > -0.05) return null;
  return {
    type: "warn",
    tag: "⚠ DECLINE",
    title: `${worst.label} is slowing`,
    body: `Revenue fell ${fmtPct(Math.abs(worst.growth))} month-over-month (${fmtCurrency(worst.last)} vs ${fmtCurrency(worst.prev)}). Worth investigating.`,
  };
}

function ruleConcentration(rows) {
  const c = concentration(rows, 5);
  if (c.share < 0.4) return null;
  return {
    type: "risk",
    tag: "⚠ CONCENTRATION",
    title: `Top 5 products drive ${fmtPct(c.share)} of revenue`,
    body: `${fmtCurrency(c.topNRevenue)} of ${fmtCurrency(c.total)} comes from just 5 products. Consider broadening the portfolio or hedging supply.`,
  };
}

function ruleOpportunity(rows) {
  const growth = growthByGroup(rows, "region");
  const revenue = groupBy(rows, "region");
  if (!growth.length || !revenue.length) return null;
  const totalRev = sum(revenue, r => r.revenue);
  const candidates = growth.filter(g => {
    const share = (revenue.find(r => r.label === g.label)?.revenue || 0) / totalRev;
    return g.growth > 0.1 && share < 0.15 && g.last > 0;
  });
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => b.growth - a.growth)[0];
  const share = (revenue.find(r => r.label === best.label)?.revenue || 0) / totalRev;
  return {
    type: "opportunity",
    tag: "◆ OPPORTUNITY",
    title: `${best.label} is growing but under-scaled`,
    body: `Revenue grew ${fmtPct(best.growth)} while representing only ${fmtPct(share)} of total. Room to invest.`,
  };
}

function ruleRepeat(rows) {
  const r = repeatVsOneTime(rows);
  if (!r || r.ratio < 1.2) return null;
  return {
    type: "opportunity",
    tag: "◆ CUSTOMER SIGNAL",
    title: `Repeat customers spend ${r.ratio.toFixed(2)}× more`,
    body: `Average order value: ${fmtCurrency(r.repeatAOV)} (repeat, n=${r.repeatCount}) vs ${fmtCurrency(r.oneTimeAOV)} (one-time, n=${r.oneTimeCount}). Retention is your highest-leverage lever.`,
  };
}

function ruleTrend(rows) {
  const t = revenueTrend(rows);
  if (t.values.length < 3) return null;
  const last = t.values.slice(-3);
  const slope = last[2] - last[0];
  if (slope === 0) return null;
  const dir = slope > 0 ? "upward" : "downward";
  const type = slope > 0 ? "growth" : "warn";
  return {
    type,
    tag: slope > 0 ? "↑ TREND" : "⚠ TREND",
    title: `3-month trend is ${dir}`,
    body: `Latest three months: ${last.map(v => fmtCurrency(v)).join(" → ")}. ${
      slope > 0 ? "Momentum is positive." : "Consider interventions before it compounds."
    }`,
  };
}

const RULES = [ruleGrowth, ruleDecline, ruleConcentration, ruleOpportunity, ruleRepeat, ruleTrend];

function generateInsights(rows) {
  const insights = [];
  for (const rule of RULES) {
    try {
      const r = rule(rows);
      if (r) insights.push(r);
    } catch (e) {
      console.warn("Insight rule failed:", e);
    }
  }
  return insights.slice(0, 6);
}

/* ---------- 5. Visualization Layer ---------- */

Chart.defaults.color = "#8b9bb0";
Chart.defaults.borderColor = "#22303f";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const chartRegistry = {};

function destroyChart(id) {
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
    delete chartRegistry[id];
  }
}

function renderTrendChart(rows) {
  destroyChart("trendChart");
  const t = revenueTrend(rows);
  const ctx = document.getElementById("trendChart");
  chartRegistry.trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: t.labels,
      datasets: [{
        label: "Revenue",
        data: t.values,
        borderColor: "#3ddc97",
        backgroundColor: "rgba(61,220,151,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { ticks: { callback: v => fmtCurrency(v) }, grid: { color: "#1b2531" } },
      }
    }
  });
}

function renderProductsChart(rows) {
  destroyChart("productsChart");
  const top = topProducts(rows, 8);
  const ctx = document.getElementById("productsChart");
  chartRegistry.productsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(p => p.label),
      datasets: [{
        label: "Revenue",
        data: top.map(p => p.value),
        backgroundColor: "#4aa3ff",
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { callback: v => fmtCurrency(v) }, grid: { color: "#1b2531" } },
        y: { grid: { display: false } },
      }
    }
  });
}

function renderRegionChart(rows) {
  destroyChart("regionChart");
  const g = groupBy(rows, "region");
  const ctx = document.getElementById("regionChart");
  chartRegistry.regionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: g.map(x => x.label),
      datasets: [{
        label: "Revenue",
        data: g.map(x => x.revenue),
        backgroundColor: ["#3ddc97", "#4aa3ff", "#ffb454", "#c084fc", "#ff6b6b"],
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => fmtCurrency(v) }, grid: { color: "#1b2531" } },
      }
    }
  });
}

function renderCategoryChart(rows) {
  destroyChart("categoryChart");
  const g = groupBy(rows, "category");
  const ctx = document.getElementById("categoryChart");
  chartRegistry.categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: g.map(x => x.label),
      datasets: [{
        data: g.map(x => x.revenue),
        backgroundColor: ["#3ddc97", "#4aa3ff", "#ffb454", "#c084fc", "#ff6b6b"],
        borderColor: "#131b26",
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { boxWidth: 10, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${fmtCurrency(ctx.raw)}`,
          }
        }
      },
      cutout: "60%",
    }
  });
}

/* ---------- 6. App Controller ---------- */

const state = {
  rawRows: [],
  columns: [],
  mapping: {},
  normalized: [],
  filters: { year: "all", region: "all", category: "all" },
};

const $ = (id) => document.getElementById(id);

async function loadDemo() {
  try {
    const res = await fetch("data/demo.csv");
    if (!res.ok) throw new Error("Demo file not found");
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    handleRawData(parsed.data);
    showToast("Demo dataset loaded", "success");
  } catch (e) {
    showToast("Could not load demo. Did you add data/demo.csv?", "error");
    console.error(e);
  }
}

function handleRawData(rows) {
  if (!rows.length) { showToast("File appears empty", "error"); return; }
  state.rawRows = rows;
  state.columns = Object.keys(rows[0]);

  const detected = detectColumns(rows);
  state.mapping = detected;
  renderMapper();
  $("mapperSection").classList.remove("hidden");
  $("dropZone").classList.add("hidden");

  applyMapping();
}

function renderMapper() {
  const select = (id, role) => {
    const el = $(id);
    el.innerHTML = `<option value="">— none —</option>` +
      state.columns.map(c =>
        `<option value="${c}" ${state.mapping[role] === c ? "selected" : ""}>${c}</option>`
      ).join("");
  };
  select("mapRevenue", "revenue");
  select("mapDate", "date");
  select("mapProduct", "product");
  select("mapRegion", "region");
  select("mapCategory", "category");
  select("mapCustomer", "customer");
}

function applyMapping() {
  state.mapping = {
    revenue: $("mapRevenue").value,
    date: $("mapDate").value,
    product: $("mapProduct").value,
    region: $("mapRegion").value,
    category: $("mapCategory").value,
    customer: $("mapCustomer").value,
  };
  if (!state.mapping.revenue) {
    showToast("Please select a Revenue column", "error");
    return;
  }
  const { rows, skipped } = normalizeRows(state.rawRows, state.mapping);
  if (!rows.length) {
    showToast("No valid rows after mapping", "error");
    return;
  }
  state.normalized = rows;
  state.filters = { year: "all", region: "all", category: "all" };
  populateFilters();
  renderAll();
  if (skipped > 0) showToast(`${skipped} rows skipped (no revenue)`, "");
}

function populateFilters() {
  const rows = state.normalized;
  const years = unique(rows.map(r => r.year).filter(Boolean)).sort();
  const regions = unique(rows.map(r => r.region)).sort();
  const categories = unique(rows.map(r => r.category)).sort();

  const fill = (id, items, current) => {
    const el = $(id);
    el.innerHTML = `<option value="all">All</option>` +
      items.map(x => `<option value="${x}" ${current === String(x) ? "selected" : ""}>${x}</option>`).join("");
  };
  fill("filterYear", years, state.filters.year);
  fill("filterRegion", regions, state.filters.region);
  fill("filterCategory", categories, state.filters.category);

  $("filtersSection").classList.remove("hidden");
}

function renderAll() {
  const rows = filterRows(state.normalized, state.filters);
  $("rowCountHint").textContent = `${rows.length.toLocaleString()} rows · ${fmtCurrency(sum(rows, r => r.revenue))} revenue`;

  // KPIs
  const k = computeKPIs(rows);
  $("kpiRevenue").textContent = fmtCurrency(k.revenue);
  $("kpiOrders").textContent = fmtNumber(k.orders);
  $("kpiCustomers").textContent = fmtNumber(k.customers);
  $("kpiAov").textContent = fmtCurrency(k.aov);

  // KPIs subs — very light deltas based on first/last month
  const t = revenueTrend(rows);
  if (t.values.length >= 2) {
    const last = t.values[t.values.length - 1];
    const prev = t.values[t.values.length - 2];
    const delta = prev > 0 ? (last - prev) / prev : 0;
    const sign = delta >= 0 ? "+" : "";
    const cls = delta >= 0 ? "pos" : "neg";
    $("kpiRevenueSub").textContent = `${sign}${(delta * 100).toFixed(1)}% MoM`;
    $("kpiRevenueSub").className = "kpi-sub " + cls;
  } else {
    $("kpiRevenueSub").textContent = "—";
    $("kpiRevenueSub").className = "kpi-sub";
  }
  $("kpiOrdersSub").textContent = "Total transactions";
  $("kpiCustomersSub").textContent = "Unique customers";
  $("kpiAovSub").textContent = "Revenue / orders";

  // Charts
  renderTrendChart(rows);
  renderProductsChart(rows);
  renderRegionChart(rows);
  renderCategoryChart(rows);

  // Reveal sections
  $("kpiSection").classList.remove("hidden");
  $("chartsSection").classList.remove("hidden");
  $("insightsSection").classList.remove("hidden");
}

function renderInsights() {
  const rows = filterRows(state.normalized, state.filters);
  const insights = generateInsights(rows);
  const list = $("insightsList");
  if (!insights.length) {
    list.innerHTML = `<p class="muted">Not enough data or no significant signals detected for this view.</p>`;
    return;
  }
  list.innerHTML = insights.map(i => `
    <div class="insight ${i.type}">
      <div class="insight-tag">${i.tag}</div>
      <div class="insight-title">${i.title}</div>
      <div class="insight-body">${i.body}</div>
    </div>
  `).join("");
}

function copyInsights() {
  const list = $("insightsList");
  const text = Array.from(list.querySelectorAll(".insight")).map(el => {
    const tag = el.querySelector(".insight-tag")?.textContent || "";
    const title = el.querySelector(".insight-title")?.textContent || "";
    const body = el.querySelector(".insight-body")?.textContent || "";
    return `${tag} — ${title}\n${body}`;
  }).join("\n\n");
  if (!text) { showToast("Nothing to copy yet", ""); return; }
  navigator.clipboard.writeText(text)
    .then(() => showToast("Insights copied", "success"))
    .catch(() => showToast("Copy failed", "error"));
}

/* ---------- File handling ---------- */

function handleFile(file) {
  const name = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      let rows = [];
      if (name.endsWith(".csv")) {
        const text = typeof e.target.result === "string" ? e.target.result : new TextDecoder().decode(e.target.result);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        rows = parsed.data;
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        showToast("Unsupported file type", "error");
        return;
      }
      handleRawData(rows);
      showToast(`Loaded ${rows.length.toLocaleString()} rows`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to parse file: " + err.message, "error");
    }
  };

  if (name.endsWith(".csv")) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

/* ---------- Wire-up ---------- */

document.addEventListener("DOMContentLoaded", () => {
  // Demo + upload
  $("loadDemoBtn").addEventListener("click", loadDemo);
  $("browseBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & drop
  const dz = $("dropZone");
  ["dragenter", "dragover"].forEach(evt =>
    dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.remove("dragover"); })
  );
  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Mapping
  $("applyMappingBtn").addEventListener("click", applyMapping);

  // Filters
  ["filterYear", "filterRegion", "filterCategory"].forEach(id => {
    $(id).addEventListener("change", (e) => {
      const key = id.replace("filter", "").toLowerCase();
      state.filters[key] = e.target.value;
      renderAll();
      renderInsights();
    });
  });
  $("resetFiltersBtn").addEventListener("click", () => {
    state.filters = { year: "all", region: "all", category: "all" };
    $("filterYear").value = "all";
    $("filterRegion").value = "all";
    $("filterCategory").value = "all";
    renderAll();
    renderInsights();
  });

  // Insights
  $("regenInsightsBtn").addEventListener("click", renderInsights);
  $("copyInsightsBtn").addEventListener("click", copyInsights);

  // Auto-load demo on start
  loadDemo();
});