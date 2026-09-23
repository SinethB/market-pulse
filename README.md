# Market Pulse

**Instant Business Intelligence from any CSV or Excel file. Runs entirely in your browser.**

Upload a sales file → get KPIs, charts, and rule-based insights in seconds.
No signup. No backend. No data leaves your device.

## Live Demo
https://sinethb.github.io/market-pulse/

## Features

- 📁 **Upload CSV / XLSX** or use the built-in Sri Lankan demo dataset
- 🎯 **Auto-detects** revenue, date, product, region, category, and customer columns
- 📊 **KPIs**: Revenue, Orders, Customers, Avg Order Value
- 📈 **Charts**: Revenue trend, Top Products, Revenue by Region, Category Mix
- 🧠 **Insight Engine** (rule-based, no LLM):
  - ↑ Growth — fastest-growing category
  - ⚠ Decline — steepest faller
  - ⚠ Concentration — top-5 product share
  - ◆ Opportunity — high-growth, low-share regions
  - ◆ Customer signal — repeat vs one-time AOV
  - ● Trend — 3-month momentum
- 🔍 **Filters**: Year, Region, Category — everything recomputes live
- 📋 **Copy insights** to clipboard as plain text

## Tech

HTML + CSS + vanilla JavaScript. No build step.

Libraries via CDN:
- [Chart.js](https://www.chartjs.org/) — charts
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [SheetJS](https://sheetjs.com/) — XLSX parsing

## Architecture
