# GridDeploy ⚡🌍

**Carbon-aware cloud region picker. Same workload, 10-20x less CO₂ — just by choosing the right region and the right time.**

Every time you run a batch job, train a model, or deploy a workload, that computation burns electricity. That electricity comes from a grid that's anywhere from 95% clean (France, nuclear) to 85% coal (parts of India, Poland). No developer thinks about this. No tool shows it.

**GridDeploy is that tool.**

---

## What It Does

| Feature | What it solves |
|---------|---------------|
| **Live Carbon Map** | Pulls real-time carbon intensity for 27 cloud regions across AWS/GCP/Azure |
| **Carbon ROI** | Shows carbon savings AND cost savings side-by-side — the enterprise financial argument |
| **GreenOps PR Bot** | A GitHub Action that auto-comments on PRs deploying to dirty-grid regions |
| **ML Time-Shifting** | Delays heavy batch/ML jobs to when the grid peaks with renewables |
| **Config Parser** | Paste Terraform/CDK/YAML → get the cleanest alternative with one click |
| **Carbon Budget** | Monthly CO₂ tracking with warnings at 80% — ongoing sustainability management |

---

## Quick Start

```bash
git clone <this-repo>
cd eio2
npm install
npm run dev
```

Opens at `http://localhost:5173/`. No backend. No API keys. No framework dependencies.

---

## Architecture

```
src/
├── main.js                    # App orchestrator: shell, events, analysis flow
├── data/
│   └── regions.js             # Region definitions, pricing, fallback data, color scales
├── utils/
│   ├── api.js                 # Electricity Maps API: fetch, cache, fallback
│   ├── carbon.js              # Carbon math: emissions, ROI, equivalents
│   └── budget.js              # Budget tracker: localStorage CRUD, monthly reset
├── components/
│   ├── worldMap.js            # SVG world map with TopoJSON, markers, tooltips
│   ├── rankings.js            # Sorted results table with Carbon ROI cards
│   ├── forecast.js            # 24h forecast bar chart + GridDeploy Cron
│   ├── configParser.js        # Terraform/CDK/GH Actions region parser
│   ├── budget.js              # Budget header bar + history modal
│   └── integrate.js           # GreenOps PR Bot + Carbon-Aware Deploy actions
└── styles/
    └── main.css               # Full design system: dark theme, responsive
```

---

## Features in Detail

### 1. Carbon ROI Metric

> "Rerouting this workload to ca-central-1 saves **100% on carbon** AND **costs only $11/year more**."

Every analysis shows two side-by-side cards:
- **🌿 Carbon Savings** — percentage, kg/run, kg/year, km-driven and trees-planted equivalents
- **💰 Cost Impact** — real per-region GPU pricing (AWS p3.2xlarge / GCP a2-highgpu / Azure NC6s_v3), annual dollar difference

When green is also cheaper, you get a **🏆 Win-Win** badge. The business case writes itself.

### 2. GreenOps PR Bot (GitHub Action)

A deployable GitHub Action that scans PRs for Terraform/YAML/config files:

```yaml
# .github/workflows/griddeploy-pr-bot.yml
name: GridDeploy GreenOps Bot
on:
  pull_request:
    paths: ['**.tf', '**.yml', '**.yaml', '**.json']
```

When a dev opens a PR deploying to `us-east-1` (342 gCO₂/kWh), the bot comments:

> ⚠️ **GridDeploy Carbon Alert**
>
> Your PR deploys to **us-east-1** (N. Virginia) — currently at **342 gCO₂/kWh**.
>
> 🌱 **Suggestion:** Change to `ca-central-1` (Montreal — 2 gCO₂/kWh).
> 📉 **Impact:** Saving ~**0.9 tons** of CO₂ per year.

The Integrate tab shows a **live preview** of exactly what this PR comment looks like — styled to match GitHub's UI.

### 3. ML Time-Shifting / GridDeploy Cron

Instead of just choosing *where* to run, choose *when*. AI training runs consume massive power.

The forecast tab now generates:
- **Run now vs delay comparison** — CO₂ for current hour vs optimal window
- **Ready-to-paste cron expressions** for crontab, GitHub Actions `on: schedule`, and Kubernetes CronJob
- **Annual impact** — "Running daily at 2:00 instead of 14:00 saves 180 kg CO₂/year"

### 4. Terraform / Config Parser

Paste any of:
- `provider "aws" { region = "us-east-1" }`
- `region: "ap-south-1"` (AWS CDK)
- GitHub Actions workflow YAML
- Raw region string like `eu-west-1`

The parser extracts the region with regex, looks up its live carbon intensity, shows the **top 3 cleaner alternatives** with percentage savings, and generates the **modified config** with a copy button.

### 5. Carbon Budget Tracker

- Set a monthly CO₂ budget (default 50 kg)
- Every analysis logs to `localStorage` with timestamp, region, CO₂, workload label
- Persistent header bar: `Budget: 14.43 / 10.0 kg CO₂` with progress bar
- **Warning at 80%**, **red alert when exceeded**
- History modal with full run log and equivalents
- Auto-resets on the 1st of each calendar month

### 6. Carbon-Aware Deploy Action

A second GitHub Action for CI/CD pipelines:

```yaml
- name: Find cleanest region
  id: griddeploy
  run: |
    # Queries Electricity Maps for live carbon intensity
    # Picks the zone with lowest gCO₂/kWh
    echo "region=$BEST_ZONE" >> $GITHUB_OUTPUT
    
- name: Deploy
  run: terraform apply -var="region=${{ steps.griddeploy.outputs.region }}"
```

Zero dependencies. Uses only `curl`, `python3`, and `bc` — all pre-installed on `ubuntu-latest`.

---

## Data Sources

| Source | What | Free Tier |
|--------|------|-----------|
| [Electricity Maps API](https://api.electricitymap.org/v3) | Real-time carbon intensity per grid zone | ✅ No key required |
| [world-atlas](https://unpkg.com/world-atlas@2) | TopoJSON world geometry for SVG map | ✅ |
| Public cloud pricing pages | GPU instance pricing per region | ✅ Hardcoded |

---

## Design Decisions

- **No AI APIs** — Pure math + public grid data. Zero LLM costs.
- **localStorage caching** — 60-min cache per zone, static fallback for offline/rate-limited scenarios
- **Real pricing** — Not toy numbers. Actual on-demand GPU rates from AWS/GCP/Azure pricing pages.
- **Single responsibility components** — Each `.js` file owns one feature, composable from `main.js`
- **Dark theme** — System-UI fonts, CSS variables, HSL-calibrated carbon color scale (green→red)
- **Progressive enhancement** — App works fully offline with fallback data; live data is a bonus

---

## Tech Stack

- **Vite** — Dev server + bundler
- **Vanilla JS** — No framework, no React, no Vue
- **TopoJSON + D3-geo concepts** — SVG world map rendering
- **Electricity Maps API** — Real-time grid carbon data
- **localStorage** — Caching + budget tracking persistence

---

## License

MIT
