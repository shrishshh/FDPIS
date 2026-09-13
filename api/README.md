# FDPIS API

FastAPI service exposing the trained FDPIS models: the Layer 3 delay-risk
classifier and the Layer 4 multi-hop cascade propagation models.

## Running it

From the **project root** (`D:\FDPIS`), not from `api/`:

```bash
conda activate fdpis
pip install -r api/requirements.txt      # fastapi + uvicorn; the rest is already there
uvicorn api.main:app --reload
```

Serves on `http://127.0.0.1:8000`. Interactive docs at `/docs`.

Startup takes a few seconds: it loads a 94 MB parquet, five XGBoost models, and
recomputes the cascade-context primary-delay lookups. Everything is cached in
process; requests never touch disk.

### Verify parity before trusting it

```bash
conda run -n fdpis python -m api.test_parity
```

Three checks - Layer 3 scoring, Layer 4 propagation, and the recomputed
constants. If any fails the API has training/serving skew and must not be
connected to the frontend.

## Two design decisions

**Features are read from `data/processed.parquet`, not recomputed.** Notebook 1
engineered every feature once; reimplementing that pipeline here would risk
training/serving skew - features computed slightly differently at serve time,
producing silently wrong predictions. Two exceptions, both unavoidable:

- the six cyclical transforms (`DEP_HOUR_SIN` etc.) are computed by notebook 2,
  not notebook 1, so `features.add_cyclical()` reproduces them exactly;
- four Layer 4 features (`SLACK_DEFICIT`, `DELAY_TO_SLACK_RATIO`,
  `PROJECTED_HOUR_ARRIVALS`, `ARRIVAL_CONGESTION_DELTA`) derive from the
  *observed inbound delay*, which is user input, so they are built per request
  using notebook 5's formulas verbatim.

**Consequence: the API serves historical flights from the dataset, not live
flights.** That is correct for a demo and review. Every response carrying ground
truth labels it (`actual_delay_minutes`, `actually_delayed_15`,
`observed_delay_source`), and `/api/health` returns `using_historical_data: true`.
Live ingestion is a separate concern.

**Risk lists are computed on demand and cached per (date, carrier).** A day is
about 19,000 flights and scores in well under a second; `functools.lru_cache`
makes repeats instant. Propagation is always fresh - it depends on user input.

## The confidence boundary

Propagation correlation with observed delay by depth: **0.674 / 0.428 / 0.327 /
0.233 / 0.226**. Past depth 2 it is under 0.33, which is not enough to publish a
figure. So for depth 3+ the API returns:

```json
{ "depth": 3, "total_delay": null, "confidence": "low", "correlation_at_depth": 0.327 }
```

`inherited_delay`, `fresh_delay` and the interval bounds are also `null`. The
chain is still traversed and returned so the UI can show that the cascade
continues - it just carries no number. `correlation_at_depth` is on every hop so
the frontend can explain why.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Model status, row counts, date range, OOV counts, constants |
| GET | `/api/dates` | Available dates with flight counts |
| GET | `/api/carriers` | Carriers with flight counts |
| GET | `/api/briefing` | Ranked risk list for a date |
| GET | `/api/briefing/summary` | Counts for the summary strip |
| GET | `/api/rotation/{tail}/{date}` | One aircraft's full day |
| GET | `/api/rotations` | Tails operating a date, for the tail picker |
| POST | `/api/propagate` | Cascade from a user-entered delay |
| GET | `/api/cascade/{tail}/{date}/{leg_num}` | Cascade from the historical actual delay |
| GET | `/api/performance` | Published model metrics |

Errors: `404` unknown date/tail/leg, `422` malformed input, `503` models not loaded.

### Examples

```bash
curl 'http://127.0.0.1:8000/api/health'
curl 'http://127.0.0.1:8000/api/dates'
curl 'http://127.0.0.1:8000/api/carriers'
curl 'http://127.0.0.1:8000/api/briefing?date=2025-07-25&carrier=AA&limit=5'
curl 'http://127.0.0.1:8000/api/briefing/summary?date=2025-07-25&carrier=AA'
curl 'http://127.0.0.1:8000/api/rotations?date=2025-07-25&carrier=AA&min_legs=5'
curl 'http://127.0.0.1:8000/api/rotation/N700UW/2025-07-25'
curl 'http://127.0.0.1:8000/api/cascade/N700UW/2025-07-25/2'

curl -X POST 'http://127.0.0.1:8000/api/propagate' \
  -H 'Content-Type: application/json' \
  -d '{"tail":"N700UW","date":"2025-07-25","leg_num":2,"observed_delay_minutes":90}'
```

`GET /api/briefing?date=2025-07-25&carrier=AA&limit=1`:

```json
{
  "date": "2025-07-25", "carrier": "AA", "total_matching": 2907, "returned": 1,
  "flights": [{
    "flight_id": "AA1543-N981UY-3", "carrier": "AA", "flight_number": "AA1543",
    "tail": "N981UY", "origin": "ORD", "dest": "SAN",
    "scheduled_dep": "17:00", "scheduled_arr": "19:16",
    "leg_num": 3, "total_legs": 4, "available_slack": 0.0,
    "risk_score": 91, "risk_band": "high",
    "actual_delay_minutes": 139.0, "actually_delayed_15": true
  }]
}
```

`POST /api/propagate`, abridged - note `total_delay: null` at depth 3:

```json
{
  "tail": "N700UW", "date": "2025-07-25", "origin_leg": 2,
  "observed_delay_minutes": 90.0, "observed_delay_source": "user_input",
  "hops": [
    { "depth": 1, "leg_num": 3, "origin": "PNS", "dest": "DFW",
      "available_slack": 0.0, "inbound_delay": 90.0,
      "inherited_delay": 84.23, "fresh_delay": 10.94, "total_delay": 95.17,
      "interval_low": 71.36, "interval_high": 119.91,
      "gate_probability": 0.9884, "absorbed": false,
      "confidence": "high", "correlation_at_depth": 0.674 },
    { "depth": 3, "leg_num": 5, "origin": "ELP", "dest": "DFW",
      "total_delay": null, "interval_low": null, "interval_high": null,
      "gate_probability": 0.9947, "confidence": "low",
      "correlation_at_depth": 0.327 }
  ],
  "summary": { "legs_affected": 5, "deepest_hop": 5, "quantified_hops": 2,
               "low_confidence_hops": 3, "total_delay_minutes_added": 189.46,
               "confidence_depth": 2 }
}
```

`risk_band` is a percentile **within the requested day**: top 10% `high`, next
30% `medium`, the rest `low`.

## Layout

```
api/
  main.py              FastAPI app, CORS, lifespan model loading, endpoints
  models.py            ModelBundle - loads artifacts, derives startup constants
  features.py          Feature assembly for Layer 3 and Layer 4
  propagation.py       Multi-hop traversal, ported from notebook 5
  schemas.py           Pydantic request/response models
  config.py            Paths and constants, each traced to its notebook
  performance_data.py  Published metrics served by /api/performance
  test_parity.py       Notebook-parity harness
```

Nothing imports from the notebooks; the logic was read and re-expressed. No
notebook was modified.

## Propagation behaviour

Ported from `fdpis_5_integration.ipynb` and preserved deliberately:

- **absorption** - `propagated = magnitude if gate fires else 0`
- **gate threshold** - read from `config.json` (0.30), never hardcoded
- **asymmetric intervals** - lower bound only at `gate_prob >= 0.60`, upper at `>= 0.10`
- **primary delay** - cascade-context empirical expectation added per hop
- **SHRINK 0.510** applied to the *reported* total; the *full* expectation is what
  propagates forward. These are different on purpose - do not "fix" it
- **RECOVERY_RATE 0.895** converts a departure delay to the next hop's arrival delay
- **continuity** - only propagates where `CONTINUOUS_ROTATION` holds
- **breadth-first**, max depth 5

## Category levels and out-of-vocabulary

Layer 4 categoricals are built from `category_levels` persisted in
`results/layer4/config.json` - the exact levels used at training. Startup fails
if that key is absent rather than silently falling back.

Layer 3 has its own levels, rebuilt at startup from notebook 2's training split
(`primary` flights before the train cutoff), because that is what its model saw.

`/api/health` reports out-of-vocabulary counts: **665 ORIGIN rows and 289 DEST
rows** of 1,718,426 carry an airport absent from Layer 4 training. Those become
`NaN`, which XGBoost routes through its default branch. The count is surfaced
rather than hidden.

## Parity results

```
check_layer3     PASS  max abs diff 0.000e+00 vs tolerance 1e-06
check_layer4     PASS  max abs diff 0.004968 min vs tolerance 0.01
check_constants  PASS  constants match notebook 5
```

Layer 3 is bit-identical. Layer 4's residual is API response rounding to two
decimals against full-precision saved values. Constants: PRIMARY_MEAN 21.5521,
PRIMARY_MEDIAN 11.0000, SHRINK 0.5104, RECOVERY_RATE 0.8952.
