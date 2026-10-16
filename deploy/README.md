# Deploying FDPIS

FDPIS deploys as two halves:

| Half | What | Host | Plan |
|---|---|---|---|
| Frontend | Next.js 14 app in `fdpis-web/` | Vercel | Hobby (free) |
| Backend | FastAPI model server (`api/`), slim artifacts | Render web service from a Docker image | Free (512 MB RAM, sleeps after 15 min idle) |

```
browser ──► Vercel (fdpis-web, static + client JS)
   │
   └──── fetch(NEXT_PUBLIC_API_URL/api/...) ──► Render: uvicorn api.main:app (slim)
                                                CORS: ALLOWED_ORIGINS only
```

The frontend contains no model logic. Every number on the site comes from the
API, apart from a few fixed explanatory figures listed under
[Stale numbers](#stale-numbers).

## Backend

### Why a slim build

The full API needs about 1.9 GB of resident memory (3.7 GB peak at startup)
because it loads all 1.72M flights. Render free has 512 MB. `api/slim.py` builds
a serving set:
- test-split days only (2025-07-19 … 07-31), which is what the site offers;
- only the 39 columns the API reads;
- every startup constant precomputed from the full data.

With that and the memory settings in `deploy/backend/Dockerfile`, peak RSS is
**369 MB** under a worst-case stress run. Details, sizes and the full memory
breakdown are in [`ARTIFACT_MANIFEST.md`](ARTIFACT_MANIFEST.md).

Parity with the full API is proven, not assumed:
- `python deploy/compare_apis.py <full> <slim> --served-subset` covers every
  served date: 318 comparisons, 0 differences. The only intended change is that
  `/api/dates` lists 13 days.
- `docker build --target test` followed by `docker run` executes
  `api/test_parity.py` and the 38 Layer 5 tests against the slim artifacts.

### Build and test locally

```bash
python deploy/build_space.py              # copies api/ + results, builds deploy/backend/slim/
cd deploy/backend
docker build --target test -t fdpis-test . && docker run --rm --memory=512m fdpis-test
docker build --target runtime -t fdpis-api .
sh ../measure_container.sh fdpis-api 7863 # peak RSS under a 512 MB limit
```

The full local API (`uvicorn api.main:app --port 8000`, no `FDPIS_SLIM_DIR`) is
the reference for `compare_apis.py`.

### Deploy / redeploy on Render

The image contains the slim data and model artifacts. They are gitignored and
must not be committed, so Render runs a **prebuilt image from a registry**
rather than building from this repository.

1. Push the runtime image to a public registry:
   ```bash
   docker tag fdpis-api <registry>/<user>/fdpis-api:<tag>
   docker push <registry>/<user>/fdpis-api:<tag>
   ```
2. Render service: name `fdpis-api`, type *Web Service*, runtime *Image*, image
   `<registry>/<user>/fdpis-api:<tag>`, region *Singapore*, plan *Free*,
   health check `/api/health`.
3. Environment: `ALLOWED_ORIGINS=https://<vercel-domain>,http://localhost:3000`.
   Everything else is baked into the image. Render injects `PORT`.
4. Redeploy after a change: rebuild, push a new tag, then point the service at
   it (dashboard or Render API `PATCH /v1/services/{id}`) and trigger a deploy.

Rule changes (`api/layer5/rules/*.json`) and code changes need a rebuild.
Model or data changes also need `python deploy/build_space.py`. If the xgboost
version changes, the `test` stage must pass before deploying.

### Updating artifacts

1. Re-run the notebooks or `api/layer5/backtest.py` that produce the changed
   `results/` files.
2. Run `python deploy/build_space.py`, which rebuilds `slim/` from the full data
   by calling the real `load_bundle()`.
3. Run the `test` stage and `compare_apis.py --served-subset` against a full
   local API, then redeploy.

### Hardening

- **Read-only API.** The only write is `POST /api/alerts/{id}/notify`, which
  appends to an in-memory outbox:
  - capped at 200 records, oldest dropped;
  - never written to disk;
  - every record is labelled "SIMULATED — not sent".
- **Request limits.** Bodies over 16 KB are rejected with 413, including
  chunked bodies.
- **CORS** comes from `ALLOWED_ORIGINS`, with methods GET/POST/OPTIONS and only
  the `Content-Type` header.
- **Runtime.** The container runs as non-root uid 1000 with no reload, no
  debug, and no `Server` header.
- **Known residual risk.** The alert-id registry (`api/layer5/engine.py`)
  grows with each distinct alert. Arbitrary `POST /api/recommendations` traffic
  could grow it slowly (about 1–2 KB per alert). A restart clears it, and on
  the free plan Render restarts idle services anyway.

## Frontend

- `NEXT_PUBLIC_API_URL` is the only backend address, used in
  `fdpis-web/lib/api/client.ts`. It is baked in at build time, so changing it
  needs a redeploy.
- Vercel project: name `fdpis`, root directory `fdpis-web`, framework Next.js.
  Set `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com` for
  Production.
- Deploy from the CLI:
  ```bash
  npx vercel --cwd fdpis-web --prod --token $VERCEL_TOKEN
  ```
  Alternatively, link the GitHub repo in the Vercel dashboard so every push
  to `main` deploys.

### Cold start

Render free sleeps after 15 minutes without traffic. The first request then
waits for the container to start and load the models: about 3 s locally, and
usually 30–60 s on Render, including the wake-up. `lib/api/client.ts` handles this:
- Until the server has answered once, a request that fails at the network
  level, gets a 502/503/504, or takes longer than 5 s switches the app to a
  "waking" state.
- `components/WakeBanner.tsx` then shows *"Waking up the model server — this
  takes about a minute on first visit"* with an elapsed-seconds counter.
- Failed requests retry with backoff (2 s, ×1.5, capped at 15 s) for up to
  3 minutes. Notify is never retried.
- After 3 minutes the page shows a plain "model server not reachable, retry"
  card, never a blank page or a raw error.

In a real-time test (the backend started 20 s after the page), the banner
appeared and content rendered at 27 s.

## Where each token is used

| Token | Used by | Where it lives |
|---|---|---|
| `RENDER_API_KEY` | Creating/updating the Render service and its env vars via `api.render.com` | Your shell environment only |
| `VERCEL_TOKEN` | `npx vercel ... --token` for deploys and project env vars | Your shell environment only |
| Registry credential (Docker Hub access token or GitHub PAT with `write:packages`) | `docker push` of the backend image | `docker login` credential store |

No token is written to any file in this repo, passed to the containers, or
committed.

## Verification

```bash
node deploy/verify_site.mjs https://<site> deploy/screenshots
```

This is real-time headless Chrome over the DevTools protocol. It checks every
page at 1440 px and 390 px for:
- time to meaningful content;
- console errors and failed requests (wake-up retries are counted separately);
- horizontal overflow, naming the element at fault.

It saves full-page screenshots. On `/alerts` it also checks that the FAA→DGCA
switch changes the rows and that Acknowledge → Notify lands a SIMULATED record
in the outbox.

## Stale numbers

All headline metrics come from `/api/performance`. The figures below are still
written into the frontend; each was checked against `AUDIT_REPORT.md` and is
current:

| Figure | File | Value |
|---|---|---|
| depth correlations 0.674 / 0.428 / 0.327 / 0.233 / 0.226 | `components/cascade/CascadeChain.tsx`, `CascadeExplorer.tsx` | match |
| base delay rate 15.6% | `components/performance/RankingChart.tsx` | match |
| top-1% precision 78.1% | `components/briefing/BriefingView.tsx` | match (0.781) |
| ablation lift +0.0367 | `app/performance/page.tsx` | match |

The DOT-attribution agreement ("89%") is now computed from the API value.
