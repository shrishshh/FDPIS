# FDPIS — Flight Delay Propagation Intelligence System

A web front end for a machine-learning system that predicts how a single flight
delay cascades through an airline's aircraft rotation network.

Four screens:

| Route | What it is |
|---|---|
| `/` | Landing page — the pitch and the validated headline numbers |
| `/briefing` | The 05:00 operations view: every leg of the day ranked by delay risk |
| `/cascade/[flightId]` | Cascade explorer: one delayed flight, and what it breaks downstream |
| `/live` | Live delay entry: enter an observed delay and watch it propagate |
| `/performance` | Model performance and known limitations, for academic review |

**All data on screen is generated demo data.** Nothing is disguised as a live
feed — the nav carries a permanent `Demo data` badge, and every page that shows
fixtures says so.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build (also type-checks)
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
```

Requires Node 18.17 or newer. Built with Next.js 14 (App Router), TypeScript,
Tailwind CSS, Recharts and lucide-react.

---

## Architecture

The one rule this codebase enforces: **no component ever imports mock data.**

```
app/ , components/          →  import only from  lib/api/
lib/api/                    →  the data boundary; returns typed Promises
lib/mock/                   →  fixture generation (today's implementation)
lib/types.ts                →  the response contract, shared by both sides
```

Every data-access function is `async` and returns a type from `lib/types.ts`,
for example:

```ts
export async function getRiskList(
  date: string,
  filters?: RiskFilters,
): Promise<Flight[]>
```

Connecting the real backend means replacing the **bodies** of those functions
with `fetch()` calls. No component, page, prop or type has to change.

### Fixture determinism

All fixtures are generated from a fixed seed (`NETWORK_SEED` in
`lib/mock/network.ts`) using a mulberry32 PRNG — no `Math.random`, no `Date.now`.
The demo is byte-identical on every run and on every machine, so a rehearsed
walkthrough shows the same flights every time.

Rotations are geographically valid by construction: leg *n*'s destination is
always leg *n+1*'s origin, block times are derived from great-circle distance,
regional carriers only fly short sectors, and ground times are real gaps in the
schedule rather than decoration.

### The confidence boundary

The propagation model's correlation with observed delay falls below 0.33 beyond
depth 2. The UI therefore publishes **numbers for hops 1–2 only**; hop 3 and
beyond render as "cascade likely continues" with no figure, behind a visible
boundary marker. No recommendation is ever triggered from a hop past that
boundary. This is deliberate and should not be "fixed" — see
`MODEL_CONFIDENCE_DEPTH` in `lib/mock/cascade.ts`.

---

## Connecting the FastAPI backend

### Files you change

Only these. Nothing else in the repository needs to be touched.

| File | Change |
|---|---|
| `lib/api/config.ts` | Set `USING_MOCK_DATA = false`, point `API_BASE_URL` at the service, delete `simulateLatency` |
| `lib/api/flights.ts` | Replace 4 function bodies with `fetch()` |
| `lib/api/rotations.ts` | Replace 3 function bodies with `fetch()` |
| `lib/api/cascade.ts` | Replace 2 function bodies with `fetch()` |
| `lib/api/performance.ts` | Replace 1 function body with `fetch()` |
| `lib/types.ts` | Only if the API response shape genuinely differs |
| `lib/mock/` | Delete the whole directory once nothing imports it |

Set the base URL with an environment variable:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Endpoint map

Each function already carries the intended endpoint in its doc comment.

| Function | Suggested endpoint | Returns |
|---|---|---|
| `getRiskList(date, filters)` | `GET /api/v1/risk?date=&carrier=&origin=&min_risk=` | `Flight[]` |
| `getFlight(flightId)` | `GET /api/v1/flights/{flight_id}` | `Flight \| null` |
| `getBriefingSummary(date)` | `GET /api/v1/briefing/summary?date=` | `BriefingSummary` |
| `getFilterOptions()` | `GET /api/v1/reference/filters` | `FilterOptions` |
| `listRotations()` | `GET /api/v1/rotations?date=` | `RotationSummary[]` |
| `getRotation(tail)` | `GET /api/v1/rotations/{tail}?date=` | `Rotation` |
| `getPresetScenarios()` | `GET /api/v1/scenarios` (or drop in production) | `PresetScenario[]` |
| `getCascadeForFlight(flightId)` | `GET /api/v1/cascade/{flight_id}` | `Cascade` |
| `simulateCascade(request)` | `POST /api/v1/cascade/simulate` | `Cascade` |
| `getModelPerformance()` | `GET /api/v1/model/performance` | `ModelPerformance` |

`POST /api/v1/cascade/simulate` body:

```json
{ "tail": "N974AA", "leg_index": 2, "observed_delay_min": 90 }
```

### Worked example

Before:

```ts
export async function getRiskList(
  date: string = DEMO_DATE,
  filters: RiskFilters = {},
): Promise<Flight[]> {
  await simulateLatency();
  return getAllFlights().filter(/* ... */);
}
```

After:

```ts
export async function getRiskList(
  date: string,
  filters: RiskFilters = {},
): Promise<Flight[]> {
  const params = new URLSearchParams({ date });
  if (filters.carrier) params.set("carrier", filters.carrier);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.minRisk != null) params.set("min_risk", String(filters.minRisk));

  const res = await fetch(`${API_BASE_URL}/api/v1/risk?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Risk list failed: ${res.status}`);
  return res.json();
}
```

### Notes for the backend

- **Times are local wall-clock ISO strings without a timezone**, e.g.
  `"2026-09-09T13:51:00"`. The UI slices the string rather than parsing dates, so
  server and client always render identical markup. Send station-local times.
- **`turnaroundSlackMin` belongs to the turn *before* a leg departs** — the buffer
  available to absorb an inbound delay. The first leg of an aircraft's day
  carries its overnight ground time.
- **`Cascade.nodes` must include hops past the confidence depth** with
  `quantitative: false`. The UI hides their figures itself; do not truncate the
  list, or the operator loses the fact that the rotation continues.
- **`simulateCascade` must be fast.** It runs on every keystroke of the live
  demo and is the only call with no artificial latency in front of it.

---

## Project layout

```
app/
  page.tsx                     landing
  briefing/page.tsx            morning briefing
  cascade/page.tsx             cascade picker
  cascade/[flightId]/page.tsx  cascade explorer
  live/page.tsx                live delay entry
  performance/page.tsx         model performance
components/
  Nav.tsx  Logo.tsx  PageHeader.tsx  MetricCard.tsx  Risk.tsx  Tooltip.tsx
  briefing/   ranked flight table
  cascade/    chain visualisation + recommendation panel
  live/       rotation timeline + delay console
  performance/ Recharts panels
lib/
  types.ts                     the contract
  format.ts                    formatting + severity presentation
  api/                         THE DATA BOUNDARY
  mock/                        fixtures (delete after integration)
```

## Design notes

- Light theme only, one accent colour (deep teal). Risk colours — green, amber,
  orange, red — appear only where they carry meaning, always alongside a number
  or a label, never as the sole carrier of information.
- All metrics use tabular numerals so columns of figures line up.
- Charts are single-measure panels; there is no dual-axis chart anywhere. Where
  two measures of different scale appear together (AUC and precision, MAE and
  correlation) they are drawn as small multiples instead.
- The AUC bar chart plots AUC above the 0.500 chance baseline so the bars keep a
  true zero origin, with the absolute AUC labelled on each bar.
- Layout is responsive but tuned for a 1920×1080 projector: large type, high
  contrast, and a cascade chain that fits on screen without scrolling for a
  typical three-hop case.
