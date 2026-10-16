# FDPIS: Flight Delay Propagation Intelligence System

## Live demo

- **Web app:** https://fdpis.vercel.app
- **Model API:** https://fdpis-api.onrender.com (OpenAPI docs at
  [`/docs`](https://fdpis-api.onrender.com/docs), health at
  [`/api/health`](https://fdpis-api.onrender.com/api/health))

The API runs on a free instance that sleeps after 15 minutes idle. The first
visit wakes it, which takes about 45 s, and the site shows a "waking up" banner
meanwhile. The demo serves the held-out test split (2025-07-19 … 07-31).

> Research prototype. US BTS on-time data, Jan/Apr/Jul 2025. Not an operational
> system. Crew alerts use a hypothetical one-crew-per-aircraft model;
> notifications are simulated.

## What it does

One late aircraft is never one late flight. FDPIS works in layers:

1. **Data and rotation graph.** Builds every aircraft's daily rotation from BTS
   on-time records.
2. **Layer 3, primary risk.** Ranks each departure by delay risk before the day
   begins (XGBoost, 32 features).
3. **Layer 4, propagation.** Pushes an observed delay down the rest of that
   aircraft's rotation using a hurdle gate plus quantile models, with an interval
   to depth 2.
4. **Layer 5, actions.** Checks the projected chain against FAA Part 117 or DGCA
   FDTL duty rules, kept as data with their regulatory sources, and raises
   dated crew alerts with simulated notifications.

## Results (held-out test split)

All figures are from [`AUDIT_REPORT.md`](AUDIT_REPORT.md), which also covers the
limitations.

| Layer | Metric | Value |
|---|---|---|
| 3 | ROC AUC / PR-AUC | 0.6924 / 0.3339 |
| 3 | Precision at top 1% (carrier-weighted) | 0.781 (0.696) |
| 4 | Gate AUC / cascade MAE | 0.9272 / 8.35 min |
| 5 | Actionable recall at 85% precision (LIKELY only, FAA) | 30% |

## Repository

| Path | What |
|---|---|
| `fdpis_*.ipynb` | Data preparation, modelling, propagation, diagnostics and weather studies (notebooks 1–8) |
| `api/` | FastAPI model server and the Layer 5 rule engine (`api/layer5/`, rules in `api/layer5/rules/*.json`) |
| `fdpis-web/` | Next.js 14 frontend |
| `deploy/` | Deployment: slim serving build, Dockerfiles, parity and verification tools ([`deploy/README.md`](deploy/README.md)) |
| `AUDIT_REPORT.md` | Every reported number and how it was produced |

`data/` and `results/` are produced by the notebooks and are not committed.
The deployment's slim artifacts in `deploy/backend/artifacts/` are committed.

## Run locally

```bash
# API: full artifacts, after running the notebooks
uvicorn api.main:app --port 8000

# API: the deployed slim build (test split), from a clean clone, no notebooks needed
docker build -f deploy/backend/Dockerfile -t fdpis-api .
docker run --rm -p 8000:10000 fdpis-api

# Frontend
cd fdpis-web && npm ci && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Team

Shrish Singh Sourya, Ashish Pathak, Ssunavya Jain. Guide: Prof. Anuradha G.,
VIT Vellore.
