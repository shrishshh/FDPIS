# Artifact manifest: what the deployed API reads

The hosted API targets a **512 MB** instance (Render free). It serves the full
model stack from a *slim* artifact set built by `api/slim.py` and assembled into
`deploy/backend/` by `python deploy/build_space.py`. Keep this file, `api/slim.py`
and `deploy/build_space.py` in sync.

## How the list was established

1. **Static trace.** Grepped `api/` for every path (`read_parquet`, `read_csv`,
   `open(`, `load_model`) and every parquet column name.
   - Paths come from `api/config.py`, `api/performance_data.py` and
     `api/layer5/engine.py` (rule JSON ships inside `api/`).
   - `api/layer5/backtest.py` is an offline script that the API never imports,
     so it is left out of the image.
2. **Dynamic trace.** Started uvicorn on the full artifacts and called every endpoint:
   - health, dates, carriers, performance and rules;
   - briefing, summary, rotations, rotation, flights and cascade;
   - recommendations, all alert-feed variants, notify and notifications.
3. **Proof by parity.** The slim container contains only the files below.
   - `deploy/compare_apis.py --served-subset` compares it with the full local API
     on every served date: 318 comparisons, 0 differences
     (output in `deploy/parity_slim.txt`).
   - `api/test_parity.py` and all 38 tests in `api/layer5/test_rules.py` pass
     inside the Docker `test` stage.

## Runtime files (in the image)

| File | Size | What it is |
|---|---:|---|
| `slim/flights.parquet` | 7.57 MB | Test-split flights only (2025-07-19 … 07-31, 262,171 rows); the 39 columns the API reads. int64 columns stored as int32; floats unchanged. |
| `slim/layer3.ubj` | 5.21 MB | Layer 3 classifier (binary UBJ copy of `results/xgb_primary_classifier.json`) |
| `slim/gate.ubj` | 7.12 MB | Layer 4 hurdle gate |
| `slim/hurdle_lower.ubj` | 9.84 MB | Layer 4 q10 |
| `slim/hurdle_median.ubj` | 9.75 MB | Layer 4 median |
| `slim/hurdle_upper.ubj` | 5.10 MB | Layer 4 q90 |
| `slim/lk_origin_hour.parquet` | 0.03 MB | expected-primary lookup (notebook 5), computed from the **training** split |
| `slim/lk_carrier_hour.parquet` | 0.01 MB | ditto |
| `slim/lk_route.parquet` | 0.06 MB | ditto |
| `slim/meta.json` | 0.01 MB | Startup constants computed by the real `load_bundle()` on the full data: Layer 3 category levels, recovery rate, primary mean/median/shrink, train/val split dates, out-of-vocabulary counts, dataset-wide health and carrier counts |
| `results/layer4/config.json` | 0.01 MB | Layer 4 features, category levels, gate threshold |
| `results/candidates/weather_b/comparison.csv` | <0.01 MB | `/api/performance` weather section |
| `results/layer5/{actionable_metrics,naive_comparison,lead_time_summary,backtest_meta,three_band,recall_precision_sets}.csv` | <0.01 MB each | `/api/performance` Layer 5 sections |
| `api/layer5/rules/{faa_part117,dgca_fdtl}.json` | (code) | rule engine |

Total: **44.6 MB** (43 MB on disk). The full build used 135.8 MB.

## Test-stage only (`docker build --target test`)

| File | Size | Read by |
|---|---:|---|
| `results/xgb_primary_classifier.json` | 5.47 MB | `test_parity` check 1: reloads the original model through the sklearn wrapper, which also proves the raw-Booster serving path matches it |
| `results/layer4/cascade_chains_integrated.parquet` | 3.05 MB | `test_parity` check 2 |

## What changed in output

Only `/api/dates` changes: it lists the **13 served days** instead of all 92,
and each listed day keeps the same flight count as the full API. Every other
endpoint is byte-identical or differs only in process-local alert ids.

`/api/health` and `/api/carriers` still describe the whole dataset (1,718,426
rows, 92 days, full carrier counts), read from `meta.json`. Every served-day
endpoint is identical because whole days are kept, and the only cross-day lookup
in the code is D+1 for minimum rest. For 07-31 that day is missing from the full
data too.

## Memory

All figures are resident memory of the uvicorn process in the runtime container
under a hard 512 MB limit, measured by `deploy/measure_container.sh`.

| Step | Full build | Slim build |
|---|---:|---|
| numpy + pandas | 107 MB | 108 MB |
| xgboost import | 96 MB (pulls in scikit-learn + scipy) | 34 MB (scikit-learn not installed) |
| fastapi / pydantic / uvicorn / api modules / airportsdata | 23 MB | 31 MB |
| flight frame | 978 MB (1.72M × 71) | 61 MB (262k × 39, int32) |
| 5 models | 163 MB until the JSON-parse heap is released, then ~18 MB | ~18 MB (UBJ + `malloc_trim`) |
| **after startup** | 1,864 MB (peak 3,705 MB) | **274 MB (peak 359 MB)** |
| after 6 day feeds (both profiles), `inferred_blocks`, 3 × briefing(5000) | n/a | 341 MB |
| after filling the feed cache (13 dates × 2 profiles) | n/a | 345 MB |
| after stress: every date × every carrier through briefing + alerts | n/a | 340 MB |
| **peak (VmHWM) over the whole run** | n/a | **369 MB** |

The levers, in order of effect:
1. Test-split rows and the 39 used columns only.
2. Arrow on the system allocator (`ARROW_DEFAULT_MEMORY_POOL=system`). The
   mimalloc pool kept about 120 MB of read buffers resident.
3. `malloc_trim` after model load and after every request (`MALLOC_TRIM_AFTER_REQUEST=1`).
4. No scikit-learn in the runtime image; models served through raw Boosters.
5. Arrow→pandas conversion with `self_destruct`, so startup never holds two copies.
6. `BRIEFING_CACHE_SIZE=8` (each cached day is about 6.5 MB).
7. `OMP_NUM_THREADS=1` and `MALLOC_ARENA_MAX=2`.

Day-feed latency in the container (1 thread):
- 3.2–3.7 s for FAA and 4.8 s for DGCA, uncached;
- after that, the 32-entry feed cache answers instantly.

Render free runs on a fraction of a CPU, so expect slower uncached feeds there.
