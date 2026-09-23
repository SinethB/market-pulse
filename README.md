# Market Pulse — Sales & Market Intelligence

A compact portfolio-ready analytics web app built with **HTML, CSS, JavaScript, Chart.js and Leaflet**.

It transforms a synthetic Sri Lankan retail transaction dataset into an interactive executive-style dashboard.

## What it demonstrates

- Browser-based data loading and aggregation
- KPI calculations
- Monthly trend analysis
- Category and regional mix analysis
- District-level geographic visualisation
- Product ranking
- Rule-based business insight generation
- Responsive dashboard UI
- Static deployment with GitHub Pages

## Tech stack

HTML5 · CSS3 · Vanilla JavaScript · Chart.js · Leaflet · Papa Parse · OpenStreetMap

No backend or database is required.

## Dataset

`data/sales-data.csv` is **synthetic**. It does not represent LankaTiles, CDB, or any real customer/company data.

The dataset contains fictional transactions across Sri Lankan districts, regions, product categories and customers.

## Run locally

Because the browser fetches the CSV file, use a small HTTP server.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deploy with GitHub Pages

1. Create a public repository, for example `market-pulse`.
2. Upload `index.html`, `styles.css`, `app.js`, `data/sales-data.csv` and `README.md`.
3. Commit to `main`.
4. Open **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Select **main** and **/(root)**.
7. Save.

The app will be available at `https://YOUR_USERNAME.github.io/market-pulse/`.

## Portfolio note

This is intentionally a small application rather than a full analytics platform. The goal is to demonstrate how an analytical idea can be converted into an interactive, decision-oriented product that can be shared publicly.
