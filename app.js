/* ============================================================
   MARKET PULSE — Sales & Market Intelligence (demo)
   Self-contained: data generation + analytics + insights + UI.
   No backend, no external data files — everything below is
   synthetic and generated deterministically in the browser.
   ============================================================ */

/* ---------- 1. Deterministic PRNG (so the demo is reproducible) ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260118);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickWeighted = (arr) => { // arr = [{item, w}]
  const total = arr.reduce((s, a) => s + a.w, 0);
  let r = rand() * total;
  for (const a of arr) { r -= a.w; if (r <= 0) return a.item; }
  return arr[arr.length - 1].item;
};

/* ---------- 2. Reference data ---------- */
const REGIONS = [
  { id: 'western',  name: 'Western',  district: 'Colombo', x: 96,  y: 236, weight: 46, growthTilt: -0.4 },
  { id: 'central',  name: 'Central',  district: 'Kandy',   x: 128, y: 150, weight: 22, growthTilt: 0.6 },
  { id: 'southern', name: 'Southern', district: 'Galle',   x: 84,  y: 306, weight: 19, growthTilt: 0.3 },
  { id: 'northern', name: 'Northern', district: 'Jaffna',  x: 76,  y: 30,  weight: 13, growthTilt: 1.1 },
];

const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', share: 30, growthTilt: 0.1 },
  { id: 'home',        name: 'Home & Living', share: 24, growthTilt: 0.05 },
  { id: 'lifestyle',   name: 'Lifestyle', share: 8,  growthTilt: 1.4 }, // small share, fast growth -> "opportunity"
  { id: 'fashion',     name: 'Fashion',   share: 18, growthTilt: 0.2 },
  { id: 'grocery',     name: 'Grocery',   share: 15, growthTilt: 0.15 },
  { id: 'sports',      name: 'Sports & Outdoor', share: 5, growthTilt: 0.5 },
];

const PRODUCT_NAMES = {
  electronics: ['SmartBuds X2','Prime Soundbar','VoltCharge 65W','PixelView 24"','NanoTab 10','HomeCam Mini'],
  home:        ['CeramaTile Classic','LuxeCushion Set','AquaFlow Tap','GlowLamp LED','WeaveRug Compact','StoneTop Board'],
  lifestyle:   ['UrbanBackpack','WellnessBand','TravelKit Pro','ZenCandle Trio','PureBottle 1L'],
  fashion:     ['Denim Fit 32','Linen Shirt M','SprintRunner Shoe','SilkScarf Print','ClassicWatch S'],
  grocery:     ['OrganicTea 250g','SpiceBox Mix','ColdPress Oil 1L','WholeGrain Pack','FreshBrew Coffee'],
  sports:      ['CourtGrip Racket','TrailRunner Bag','YogaMat Flex','CampLight Solar','HydroPack 2L'],
};

const YEARS = [2024, 2025, 2026];
const START_DATE = new Date(2024, 0, 1);
const END_DATE = new Date(2026, 8, 20); // matches "today"

/* ---------- 3. Generate a synthetic customer base + order history ---------- */
function buildDataset() {
  const customers = [];
  const CUSTOMER_COUNT = 3400;
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const region = pickWeighted(REGIONS.map(r => ({ item: r, w: r.weight })));
    const ordersForCustomer = rand() < 0.62 ? 1 : Math.min(6, 2 + Math.floor(-Math.log(rand()) * 1.4));
    customers.push({ id: 'C' + (10000 + i), region, orderCount: ordersForCustomer });
  }

  // Give a few "hero" products a Pareto-style dominant share within each category
  const products = [];
  CATEGORIES.forEach(cat => {
    const names = PRODUCT_NAMES[cat.id];
    names.forEach((name, idx) => {
      products.push({
        id: cat.id + '-' + idx,
        name, category: cat,
        basePrice: 900 + Math.floor(rand() * 8500),
        popularity: idx === 0 ? 5.5 : idx === 1 ? 3 : 1, // first product in list = hero product
      });
    });
  });

  const totalDays = Math.round((END_DATE - START_DATE) / 86400000);
  const orders = [];
  let orderSeq = 1;

  customers.forEach(cust => {
    let priorOrderCount = 0;
    for (let o = 0; o < cust.orderCount; o++) {
      const dayOffset = Math.floor(rand() * totalDays);
      const date = new Date(START_DATE.getTime() + dayOffset * 86400000);
      const monthIndex = (date.getFullYear() - 2024) * 12 + date.getMonth(); // 0..32
      const timeProgress = monthIndex / 32; // 0 -> 1 across the whole window

      const cat = pickWeighted(CATEGORIES.map(c => {
        // categories with higher growthTilt gain relative share over time
        const w = c.share * (1 + c.growthTilt * timeProgress * 0.8);
        return { item: c, w: Math.max(0.5, w) };
      }));
      const catProducts = products.filter(p => p.category.id === cat.id);
      const product = pickWeighted(catProducts.map(p => ({ item: p, w: p.popularity })));

      // regional revenue trend: some regions trend up, western trends down in recent months
      const regionTrend = 1 + cust.region.growthTilt * timeProgress * 0.5;
      const seasonal = 1 + 0.12 * Math.sin((date.getMonth() / 12) * Math.PI * 2);
      const qty = 1 + Math.floor(rand() * 3);
      const priceNoise = 0.85 + rand() * 0.3;
      const revenue = Math.round(product.basePrice * qty * priceNoise * regionTrend * seasonal);

      orders.push({
        id: 'ORD' + (100000 + orderSeq++),
        date,
        year: date.getFullYear(),
        month: date.getMonth(),
        region: cust.region.id,
        district: cust.region.district,
        category: cat.id,
        product: product.name,
        productId: product.id,
        customerId: cust.id,
        customerType: priorOrderCount === 0 ? 'new' : 'repeat',
        quantity: qty,
        revenue,
      });
      priorOrderCount++;
    }
  });

  orders.sort((a, b) => a.date - b.date);
  return orders;
}

const ALL_ORDERS = buildDataset();

/* ---------- 4. Filter state ---------- */
const state = { year: '2026', region: 'all', category: 'all' };

function filteredOrders() {
  return ALL_ORDERS.filter(o => {
    if (state.year !== 'all' && String(o.year) !== state.year) return false;
    if (state.region !== 'all' && o.region !== state.region) return false;
    if (state.category !== 'all' && o.category !== state.category) return false;
    return true;
  });
}

function periodLabel() {
  return state.year === 'all' ? '2024 – 2026 YTD' : (state.year === '2026' ? '2026 YTD' : state.year);
}

/* ---------- 5. Aggregation helpers ---------- */
function fmtRs(n) {
  if (n >= 1e7) return 'Rs. ' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e5) return 'Rs. ' + (n / 1e3).toFixed(0) + 'K';
  return 'Rs. ' + n.toLocaleString();
}
function fmtNum(n) { return n.toLocaleString(); }

function computeKPIs(orders) {
  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const orderCount = orders.length;
  const customers = new Set(orders.map(o => o.customerId)).size;
  const aov = orderCount ? revenue / orderCount : 0;

  // previous equivalent period for a simple delta signal
  let prev = [];
  if (state.year !== 'all') {
    const prevYear = String(Number(state.year) - 1);
    prev = ALL_ORDERS.filter(o => {
      if (String(o.year) !== prevYear) return false;
      if (state.region !== 'all' && o.region !== state.region) return false;
      if (state.category !== 'all' && o.category !== state.category) return false;
      return true;
    });
  }
  const prevRevenue = prev.reduce((s, o) => s + o.revenue, 0);
  const delta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  return { revenue, orderCount, customers, aov, delta };
}

function monthKey(o) { return o.year + '-' + String(o.month + 1).padStart(2, '0'); }

function computeTrend(orders) {
  const map = {};
  orders.forEach(o => { const k = monthKey(o); map[k] = (map[k] || 0) + o.revenue; });
  const keys = Object.keys(map).sort();
  return { labels: keys, values: keys.map(k => map[k]) };
}

function computeRegionRevenue(orders) {
  const map = {};
  orders.forEach(o => { map[o.region] = (map[o.region] || 0) + o.revenue; });
  return REGIONS.map(r => ({ name: r.name, id: r.id, value: map[r.id] || 0 }));
}

function computeProductPerformance(orders, limit = 8) {
  const map = {};
  orders.forEach(o => { map[o.product] = (map[o.product] || 0) + o.revenue; });
  const total = orders.reduce((s, o) => s + o.revenue, 0) || 1;
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
}

function computeCategoryRevenue(orders) {
  const map = {};
  orders.forEach(o => { map[o.category] = (map[o.category] || 0) + o.revenue; });
  const total = orders.reduce((s, o) => s + o.revenue, 0) || 1;
  return CATEGORIES.map(c => ({ name: c.name, id: c.id, value: map[c.id] || 0, pct: ((map[c.id] || 0) / total) * 100 }));
}

/* ---------- 6. Insight Engine ---------- */
function generateInsights(orders) {
  const insights = [];
  if (orders.length < 20) {
    return insights; // not enough data in this filter slice to say anything meaningful
  }

  // Sort months for time-based comparisons
  const trend = computeTrend(orders);
  const n = trend.values.length;

  // --- Market signal: concentration in top region vs its recent trend ---
  const regionRev = computeRegionRevenue(orders).sort((a, b) => b.value - a.value);
  const totalRev = regionRev.reduce((s, r) => s + r.value, 0) || 1;
  if (regionRev[0]) {
    const topShare = (regionRev[0].value / totalRev) * 100;
    if (n >= 4) {
      const recent = orders.filter(o => o.region === regionRev[0].id).sort((a, b) => a.date - b.date);
      const half = Math.floor(recent.length / 2);
      const firstHalfRev = recent.slice(0, half).reduce((s, o) => s + o.revenue, 0);
      const secondHalfRev = recent.slice(half).reduce((s, o) => s + o.revenue, 0);
      if (firstHalfRev > 0) {
        const change = ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100;
        if (topShare > 30 && change < -3) {
          insights.push({
            type: 'risk',
            tag: 'Market signal',
            text: `${regionRev[0].name} region contributes ${topShare.toFixed(0)}% of revenue but shows a ${Math.abs(change).toFixed(0)}% decline comparing the first vs. second half of the selected period.`,
          });
        } else if (topShare > 30 && change > 3) {
          insights.push({
            type: 'growth',
            tag: 'Market signal',
            text: `${regionRev[0].name} region leads with ${topShare.toFixed(0)}% of revenue and is still accelerating — up ${change.toFixed(0)}% comparing the first vs. second half of the period.`,
          });
        }
      }
    }
  }

  // --- Product opportunity: category with high growth, low share ---
  const catRev = computeCategoryRevenue(orders);
  catRev.forEach(cat => {
    const catOrders = orders.filter(o => o.category === cat.id).sort((a, b) => a.date - b.date);
    if (catOrders.length < 8) return;
    const half = Math.floor(catOrders.length / 2);
    const firstHalf = catOrders.slice(0, half).reduce((s, o) => s + o.revenue, 0);
    const secondHalf = catOrders.slice(half).reduce((s, o) => s + o.revenue, 0);
    if (firstHalf > 0) {
      const growth = ((secondHalf - firstHalf) / firstHalf) * 100;
      if (growth > 20 && cat.pct < 15) {
        insights.push({
          type: 'opportunity',
          tag: 'Product opportunity',
          text: `${cat.name} shows ${growth.toFixed(0)}% growth comparing the first vs. second half of the period, while representing only ${cat.pct.toFixed(0)}% of total revenue.`,
        });
      }
    }
  });

  // --- Customer signal: repeat vs one-time AOV ---
  const repeatOrders = orders.filter(o => o.customerType === 'repeat');
  const newOrders = orders.filter(o => o.customerType === 'new');
  if (repeatOrders.length >= 10 && newOrders.length >= 10) {
    const repeatAOV = repeatOrders.reduce((s, o) => s + o.revenue, 0) / repeatOrders.length;
    const newAOV = newOrders.reduce((s, o) => s + o.revenue, 0) / newOrders.length;
    if (newAOV > 0) {
      const ratio = repeatAOV / newAOV;
      if (ratio > 1.15) {
        insights.push({
          type: 'growth',
          tag: 'Customer signal',
          text: `Repeat customers generate ${ratio.toFixed(1)}× higher average order value than one-time customers (${fmtRs(repeatAOV)} vs. ${fmtRs(newAOV)}).`,
        });
      }
    }
  }

  // --- Risk: product concentration ---
  const productPerf = computeProductPerformance(orders, 5);
  const top5Share = productPerf.reduce((s, p) => s + p.pct, 0);
  if (top5Share > 40) {
    insights.push({
      type: 'risk',
      tag: 'Concentration risk',
      text: `The top 5 products account for ${top5Share.toFixed(0)}% of revenue in the current selection, indicating meaningful concentration risk.`,
    });
  }

  // --- Opportunity: highest-growth region below-average share ---
  const avgShare = 100 / REGIONS.length;
  REGIONS.forEach(r => {
    const rOrders = orders.filter(o => o.region === r.id).sort((a, b) => a.date - b.date);
    if (rOrders.length < 8) return;
    const half = Math.floor(rOrders.length / 2);
    const firstHalf = rOrders.slice(0, half).reduce((s, o) => s + o.revenue, 0);
    const secondHalf = rOrders.slice(half).reduce((s, o) => s + o.revenue, 0);
    const share = ((regionRev.find(x => x.id === r.id)?.value || 0) / totalRev) * 100;
    if (firstHalf > 0) {
      const growth = ((secondHalf - firstHalf) / firstHalf) * 100;
      if (growth > 15 && share < avgShare) {
        insights.push({
          type: 'opportunity',
          tag: 'Regional opportunity',
          text: `${r.name} region is growing fastest (${growth.toFixed(0)}%) but still holds only ${share.toFixed(0)}% of total revenue — below the ${avgShare.toFixed(0)}% average share.`,
        });
      }
    }
  });

  // De-duplicate by text, cap at 5, prioritize variety of types
  const seen = new Set();
  const unique = insights.filter(i => (seen.has(i.text) ? false : (seen.add(i.text), true)));
  return unique.slice(0, 5);
}

/* ---------- 7. Rendering ---------- */
let chartTrend, chartRegion, chartProducts;
const CHART_COLORS = ['#35d0ba', '#ffb648', '#7c9bff', '#ff7a7a', '#c084fc', '#5eead4'];

function renderKPIs(kpis) {
  const el = document.getElementById('kpi-row');
  const deltaHtml = kpis.delta === null
    ? `<span class="kpi-delta flat">vs. prior year: n/a</span>`
    : `<span class="kpi-delta ${kpis.delta >= 0 ? 'up' : 'down'}">${kpis.delta >= 0 ? '▲' : '▼'} ${Math.abs(kpis.delta).toFixed(1)}% vs. prior year</span>`;

  el.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Revenue</div>
      <div class="kpi-value">${fmtRs(kpis.revenue)}</div>
      ${deltaHtml}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Orders</div>
      <div class="kpi-value">${fmtNum(kpis.orderCount)}</div>
      <span class="kpi-delta flat">${periodLabel()}</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Customers</div>
      <div class="kpi-value">${fmtNum(kpis.customers)}</div>
      <span class="kpi-delta flat">unique buyers</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg. Order Value</div>
      <div class="kpi-value">${fmtRs(Math.round(kpis.aov))}</div>
      <span class="kpi-delta flat">per order</span>
    </div>`;
}

function renderTrend(trend) {
  document.getElementById('trend-sub').textContent = `Monthly revenue · ${periodLabel()}`;
  const ctx = document.getElementById('chart-trend');
  const data = {
    labels: trend.labels,
    datasets: [{
      label: 'Revenue',
      data: trend.values,
      borderColor: '#35d0ba',
      backgroundColor: 'rgba(53,208,186,0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointBackgroundColor: '#35d0ba',
    }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtRs(c.parsed.y) } } },
    scales: {
      x: { ticks: { color: '#5c6b8f', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#5c6b8f', callback: (v) => fmtRs(v) }, grid: { color: 'rgba(255,255,255,0.06)' } },
    },
  };
  if (chartTrend) { chartTrend.data = data; chartTrend.options = opts; chartTrend.update(); }
  else chartTrend = new Chart(ctx, { type: 'line', data, options: opts });
}

function renderRegionChart(regionData) {
  const ctx = document.getElementById('chart-region');
  const data = {
    labels: regionData.map(r => r.name),
    datasets: [{ data: regionData.map(r => r.value), backgroundColor: CHART_COLORS, borderColor: '#0b1220', borderWidth: 2 }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { color: '#93a1c2', boxWidth: 10, padding: 14, font: { size: 11.5 } } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtRs(c.parsed)}` } },
    },
  };
  if (chartRegion) { chartRegion.data = data; chartRegion.options = opts; chartRegion.update(); }
  else chartRegion = new Chart(ctx, { type: 'doughnut', data, options: opts });
}

function renderProductChart(products) {
  const ctx = document.getElementById('chart-products');
  const data = {
    labels: products.map(p => p.name),
    datasets: [{
      data: products.map(p => p.value),
      backgroundColor: '#35d0ba',
      borderRadius: 4,
      barThickness: 14,
    }],
  };
  const opts = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtRs(c.parsed.x) } } },
    scales: {
      x: { ticks: { color: '#5c6b8f', callback: (v) => fmtRs(v) }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: '#93a1c2', font: { size: 11.5 } }, grid: { display: false } },
    },
  };
  if (chartProducts) { chartProducts.data = data; chartProducts.options = opts; chartProducts.update(); }
  else chartProducts = new Chart(ctx, { type: 'bar', data, options: opts });
}

function renderMap(regionData) {
  const totalRev = regionData.reduce((s, r) => s + r.value, 0) || 1;
  const g = document.getElementById('lk-points');
  g.innerHTML = REGIONS.map(r => {
    const active = state.region === r.id;
    return `<g class="region-dot${active ? ' active' : ''}" data-region="${r.id}">
      <circle class="halo" cx="${r.x}" cy="${r.y}" r="16"></circle>
      <circle class="core" cx="${r.x}" cy="${r.y}" r="${active ? 7 : 5.5}"></circle>
      <text x="${r.x + 11}" y="${r.y + 4}">${r.district}</text>
    </g>`;
  }).join('');
  g.querySelectorAll('.region-dot').forEach(node => {
    node.addEventListener('click', () => {
      const id = node.getAttribute('data-region');
      state.region = (state.region === id) ? 'all' : id;
      document.getElementById('filter-region').value = state.region;
      refresh();
    });
  });

  const legend = document.getElementById('map-legend');
  legend.innerHTML = regionData.map(r => {
    const pct = ((r.value / totalRev) * 100).toFixed(0);
    const active = state.region === r.id;
    return `<div class="legend-row${active ? ' active' : ''}" data-region="${r.id}">
      <span class="lr-name"><span class="lr-dot"></span>${r.name}</span>
      <span class="lr-value">${fmtRs(r.value)} · ${pct}%</span>
    </div>`;
  }).join('');
  legend.querySelectorAll('.legend-row').forEach(node => {
    node.addEventListener('click', () => {
      const id = node.getAttribute('data-region');
      state.region = (state.region === id) ? 'all' : id;
      document.getElementById('filter-region').value = state.region;
      refresh();
    });
  });
}

const ICONS = { growth: '↑', opportunity: '◆', risk: '⚠' };
function renderInsights(orders) {
  const grid = document.getElementById('insights-grid');
  const insights = generateInsights(orders);
  if (insights.length === 0) {
    grid.innerHTML = `<div class="insights-empty">Not enough data in this filter combination to generate reliable insights — try widening the filters.</div>`;
    return;
  }
  grid.innerHTML = insights.map(i => `
    <div class="insight-card type-${i.type}">
      <span class="ic-tag">${ICONS[i.type] || '·'} ${i.tag}</span>
      <p>${i.text}</p>
    </div>`).join('');
}

/* ---------- 8. Wire it all up ---------- */
function refresh() {
  const orders = filteredOrders();
  renderKPIs(computeKPIs(orders));
  renderTrend(computeTrend(orders));
  const regionData = computeRegionRevenue(orders);
  renderRegionChart(regionData);
  renderMap(regionData);
  renderProductChart(computeProductPerformance(orders));
  renderInsights(orders);
}

function populateCategoryFilter() {
  const sel = document.getElementById('filter-category');
  CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function init() {
  populateCategoryFilter();

  document.getElementById('filter-year').addEventListener('change', (e) => { state.year = e.target.value; refresh(); });
  document.getElementById('filter-region').addEventListener('change', (e) => { state.region = e.target.value; refresh(); });
  document.getElementById('filter-category').addEventListener('change', (e) => { state.category = e.target.value; refresh(); });
  document.getElementById('reset-filters').addEventListener('click', () => {
    state.year = '2026'; state.region = 'all'; state.category = 'all';
    document.getElementById('filter-year').value = '2026';
    document.getElementById('filter-region').value = 'all';
    document.getElementById('filter-category').value = 'all';
    refresh();
  });
  document.getElementById('generate-insights').addEventListener('click', () => renderInsights(filteredOrders()));

  refresh();
}

document.addEventListener('DOMContentLoaded', init);
