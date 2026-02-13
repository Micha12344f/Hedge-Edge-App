---
name: seed-demo-screenshots
description: |
  Seeds the Hedge-Edge-App with realistic mock trading data for screenshot capture.
  Writes coordinated demo data (accounts, copier groups, relationships, trade history,
  positions, metrics) into the app's localStorage keys so the UI renders a fully
  populated dashboard without any backend or MT5 connection.
---

# Seed Demo Screenshots

## Objective
Populate every page of the Hedge-Edge-App with realistic, coordinated mock data so screenshots can be captured for the landing page. The app must look like a real, active trading dashboard with multiple accounts, open positions, copier groups, and trade history.

## When to Use This Skill
- Before capturing screenshots of the Hedge-Edge-App for marketing
- When demonstrating the app UI to stakeholders
- To test UI layouts with realistic data volumes
- When a new version of the frontend needs visual QA

## Input Specification

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| app_port | number | No | Vite dev server port (default: 5173) |
| clear_existing | boolean | No | Whether to wipe existing localStorage first (default: true) |

## Step-by-Step Process

1. **Validate resources**: Ensure all JSON data files exist in `tmp/`
2. **Cross-reference check**: Verify all UUIDs in copier groups and positions reference valid account IDs
3. **Generate seeder page**: Build `tmp/seed-demo-data.html` that injects all data into localStorage
4. **Start the app**: Launch the Vite dev server from `Hedge-Edge-Front-end/`
5. **Open seeder**: Navigate to the seeder HTML page to populate localStorage
6. **Verify**: Confirm the app dashboard renders with all mock data

## Execution Scripts

- [seed_localStorage.js](./execution/seed_localStorage.js) — Node.js script that generates the HTML seeder page from JSON resources
- [launch_app.ps1](./execution/launch_app.ps1) — PowerShell script to start the Vite dev server

## Resources

All mock data lives in the `tmp/` folder at the framework root:

| File | Target localStorage Key |
|---|---|
| `demo-accounts-preview.json` | `hedge_edge_demo_accounts` |
| `demo-copier-groups.json` | `hedge_edge_copier_groups` |
| `demo-relationships.json` | `hedge_edge_relationships` |
| `demo-trade-history.json` | `hedge_edge_trade_history` |
| `demo-positions.json` | (reference only — positions come via IPC in live mode) |
| `demo-metrics.json` | (reference only — metrics come via IPC in live mode) |
| `demo-hedge-stats.json` | (reference only — computed at runtime) |
| `demo-chart-data.json` | (reference only — computed from trade history) |

## Expected Output

After execution:
- `tmp/seed-demo-data.html` exists and can be opened in a browser
- The Hedge-Edge-App dev server is running at `http://localhost:5173`
- Opening the seeder page writes all demo data to localStorage
- Navigating to the app shows:
  - **Dashboard Overview**: 6 account cards with balances, P/L, hedge stats
  - **Accounts (Hedge Map)**: Visual graph of linked accounts with copier relationships
  - **Trade Copier**: Active copier groups with leader→follower configs
  - **Analytics**: Trade history charts with 30 days of data per account

## Definition of Done

- [ ] All 6 demo accounts appear on the Dashboard Overview
- [ ] Copier groups show on the Trade Copier page with correct leader/follower mappings
- [ ] Hedge Map on Accounts page shows account nodes and relationship edges
- [ ] Trade history populates the Analytics charts
- [ ] No console errors related to missing or malformed data
- [ ] Screenshots can be captured from each app page
