# Market Pulse — Sales & Market Intelligence (Demo)

A self-contained, interactive business intelligence dashboard built with plain HTML/CSS/JS
and [Chart.js](https://www.chartjs.org/). It runs entirely in the browser — no backend,
no database, no API keys — and uses a synthetic Sri Lanka retail dataset generated
in-browser (nothing real, nothing uploaded).

**Live demo:** `https://sinethb.github.io/market-pulse/` (once deployed — see below)

## What it does

- KPI cards (revenue, orders, customers, average order value) with a year-over-year delta
- Monthly revenue trend chart
- Revenue-by-region doughnut chart
- A clickable stylized Sri Lanka map — click a district (or its legend row) to filter
  the whole dashboard to that region
- Top-products bar chart
- An **Insight Engine**: a rules-based analysis layer that reads the currently filtered
  data and surfaces things like:
  - *Market signal* — a region that's concentrated but declining (or accelerating)
  - *Product opportunity* — a category growing fast off a small base
  - *Customer signal* — repeat vs. one-time customer value
  - *Concentration risk* — how much revenue sits in the top few products
  - *Regional opportunity* — a fast-growing, under-represented region

Everything recomputes live as you change the Year / Region / Category filters — nothing
is precomputed or hardcoded.

## Why it's reliable to run

- **No CSV fetch.** The dataset is generated with a seeded random number generator
  directly in `app.js`. Fetching a local CSV via `fetch()` fails with a CORS error the
  moment someone opens `index.html` by double-clicking it (no local server) — this
  design sidesteps that failure mode entirely, and also means the repo has no data file
  to keep in sync.
- **No map tile / geojson dependency.** The map is a small inline SVG with four
  positioned points, not a Leaflet + external-geojson map — one less network call that
  could fail or block on GitHub Pages.
- **One external dependency**: Chart.js, loaded from the `cdnjs` CDN in `index.html`.
  If you want a fully offline-capable copy, download
  `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js` into the repo
  and change the `<script src="...">` tag to point at the local file.

## Run it locally

Just open `index.html` in a browser — double-click works, no server required.

(If you prefer a local server anyway: `python3 -m http.server` from this folder, then
visit `http://localhost:8000`.)

## Deploy to GitHub Pages

1. Create a new **public** repository on GitHub, e.g. `market-pulse`.
2. Upload these files to the repo root (or push via git — see below), keeping the
   folder flat: `index.html`, `styles.css`, `app.js`, `README.md`.
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Branch: `main` (or `master`), folder: `/ (root)`. Save.
6. GitHub will publish it in a minute or two at:
   `https://<your-username>.github.io/market-pulse/`

### Or via git from the command line

```bash
cd market-pulse
git init
git add .
git commit -m "Market Pulse: initial dashboard"
git branch -M main
git remote add origin https://github.com/sinethb/market-pulse.git
git push -u origin main
```

Then enable Pages as in step 3–6 above.

## Project structure

```
market-pulse/
├── index.html    # page structure, filter bar, layout
├── styles.css    # dark BI dashboard theme
├── app.js        # data generation + analytics + insight engine + rendering
└── README.md
```

## Notes / possible next steps

- Swap the synthetic generator for a real (anonymized) CSV once you're ready — keep the
  same `orders` array shape (`date, region, category, product, customerId,
  customerType, revenue, quantity`) and the rest of the app keeps working unchanged.
- The insight thresholds (e.g. "> 20% growth", "> 40% concentration") live near the top
  of `generateInsights()` in `app.js` and are easy to tune.
- The map is intentionally stylized rather than geographically precise — swappable for
  a real Sri Lanka geojson + Leaflet later without touching the analytics layer.
