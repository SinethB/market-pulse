# Market Pulse — Sales & Market Intelligence

Market Pulse is a lightweight, self-service business intelligence dashboard that transforms transaction-level CSV or Excel data into an interactive management view.

The project demonstrates a practical analytics workflow:

**Data → Validation → Standardized Schema → Analysis → Visualization → Business Insights**

---

## Overview

Market Pulse is designed around a simple idea:

> A dashboard should not only show charts — it should help turn business data into useful observations.

The application starts with a synthetic demonstration dataset so visitors can immediately explore the dashboard.

Users can then upload their own CSV or Excel data, map their columns to the Market Pulse analytics schema, validate the dataset, and generate the dashboard using their own data.

No backend database is required.

---

## Demo-first experience

When the application opens, it automatically loads a **synthetic demo dataset**.

This allows users to explore:

- Revenue KPIs
- Transaction volume
- Customer metrics
- Average Order Value
- Revenue trends
- Category performance
- Regional performance
- Product performance
- District contribution
- Automated business observations
- Interactive filters

The dashboard clearly identifies the dataset as:

**DEMO DATA**

The demo dataset is synthetic and is not sourced from private company or customer information.

---

## Analyze your own data

After exploring the demo, users can select:

**Analyze Your Data**

They can upload:

- CSV
- XLSX
- XLS

The application then guides them through three steps:

### 1. Upload

Select or drag and drop a transaction file.

### 2. Map columns

Connect the user's source columns to the Market Pulse analytical fields.

For example:

| User's column | Market Pulse field |
|---|---|
| Invoice Date | Date |
| Net Sales | Revenue |
| Province | Region |
| District Name | District |
| Product Group | Category |
| Item Description | Product |
| Customer Code | Customer |
| Quantity | Units |

The source file does not need to use the exact Market Pulse column names.

### 3. Validate & build

The application validates the core analytical fields before replacing the demo dataset.

Once validation succeeds, the dashboard switches from:

**DEMO DATA**

to:

**YOUR DATA**

and all dashboard calculations are regenerated from the uploaded dataset.

---

# Supported data schema

Only two fields are required.

| Field | Required | Purpose |
|---|---:|---|
| Date | Yes | Time-series analysis and period filtering |
| Revenue | Yes | Revenue, AOV and rankings |
| Region | No | Regional analysis |
| District | No | District analysis |
| Category | No | Category mix |
| Product | No | Product performance |
| Customer | No | Unique customer KPI |
| Units | No | Volume-related analysis |

Optional fields unlock additional dashboard capabilities.

For example:

A file containing only:

```text
Date
Revenue
