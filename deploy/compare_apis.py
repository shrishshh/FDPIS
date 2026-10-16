"""Compare two FDPIS API deployments endpoint by endpoint.

Exact byte equality is reported first; on mismatch the JSON is compared
numerically (abs tol 1e-6) and every differing path is listed.

    python deploy/compare_apis.py http://127.0.0.1:8000 http://127.0.0.1:7860 [dates...]
    python deploy/compare_apis.py <full> <slim> --served-subset --quiet   # every served date
"""
from __future__ import annotations

import http.client
import json
import sys
import time
import urllib.error
import urllib.request


RETRIES: list[str] = []


def fetch(base: str, path: str, body=None, attempts: int = 3):
    """GET/POST and return the body. A transport failure (connection reset, a
    truncated chunked body, a timeout) is retried up to `attempts` times and
    recorded in RETRIES; HTTP errors are not retried."""
    for i in range(attempts):
        req = urllib.request.Request(base + path, method="POST" if body is not None else "GET",
                                     data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json",
                                              "User-Agent": "fdpis-compare"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError:
            raise
        except (http.client.HTTPException, OSError) as e:
            RETRIES.append(f"{base}{path}: {type(e).__name__}")
            print(f"RETRY {i + 1}/{attempts} {base}{path}: {type(e).__name__}", flush=True)
            if i == attempts - 1:
                raise
            time.sleep(5)


def diff(a, b, path="$", out=None, tol=1e-6):
    out = [] if out is None else out
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}.{k}: key only on one side")
            else:
                diff(a[k], b[k], f"{path}.{k}", out, tol)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append(f"{path}: length {len(a)} vs {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{path}[{i}]", out, tol)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) \
            and not isinstance(a, bool) and not isinstance(b, bool):
        if abs(a - b) > tol:
            out.append(f"{path}: {a} vs {b}")
    elif a != b:
        out.append(f"{path}: {a!r} vs {b!r}")
    return out


# Fields that legitimately differ between two processes.
# Alert ids come from a process-local registry (api/layer5/engine.AlertRegistry) and
# depend on which feeds that process has already served; they are not model output.
VOLATILE = {"created_utc", "id", "alert_id"}


def strip(o):
    if isinstance(o, dict):
        return {k: strip(v) for k, v in o.items() if k not in VOLATILE}
    if isinstance(o, list):
        return [strip(v) for v in o]
    return o


def _check(a, b, p, body, verbose):
    ra, rb = fetch(a, p, body), fetch(b, p, body)
    if ra == rb:
        if verbose:
            print(f"IDENTICAL  {len(ra):>8} B  {p}")
        return "identical", None
    d = diff(strip(json.loads(ra)), strip(json.loads(rb)))
    if not d:
        if verbose:
            print(f"EQUAL@1e-6 {len(ra):>8} B  {p}  (only volatile fields or <1e-6 differ)")
        return "equal", None
    print(f"DIFFERENT  {p}: {len(d)} differences")
    for line in d[:10]:
        print("    ", line)
    return "different", d


def main(a: str, b: str, dates: list[str] | None = None, served_subset: bool = False,
         per_day: int = 3, verbose: bool = True) -> int:
    """a = reference (full) API, b = candidate. With served_subset, b may serve only
    some of a's dates: /api/dates must then be a's list filtered to b's dates, with
    identical flight counts, and every per-date endpoint is compared on b's dates."""
    da = json.loads(fetch(a, "/api/dates"))
    db = json.loads(fetch(b, "/api/dates"))
    counts = {"identical": 0, "equal": 0, "different": 0}
    if served_subset:
        served = {d["date"] for d in db}
        ok = [d for d in da if d["date"] in served] == db and len(db) > 0
        print(f"{'SUBSET OK ' if ok else 'DIFFERENT '} /api/dates: candidate serves "
              f"{len(db)} of {len(da)} dates, counts identical: {ok}")
        counts["identical" if ok else "different"] += 1
        dates = dates or [d["date"] for d in db]
        globals_ = ["/api/health", "/api/carriers", "/api/performance", "/api/rules",
                    "/api/rules?profile=dgca_fdtl"]
    else:
        dates = dates or [d["date"] for d in da][-1:]
        globals_ = ["/api/health", "/api/dates", "/api/carriers", "/api/performance",
                    "/api/rules", "/api/rules?profile=dgca_fdtl"]
    jobs = [(p, None) for p in globals_]
    for d in dates:
        rots = json.loads(fetch(a, f"/api/rotations?date={d}"))
        carrier = rots[0]["carrier"] if rots and "carrier" in rots[0] else None
        jobs += [(f"/api/briefing?date={d}", None),
                 (f"/api/briefing?date={d}&limit=5000", None),
                 (f"/api/briefing/summary?date={d}", None),
                 (f"/api/rotations?date={d}", None),
                 (f"/api/alerts?date={d}&profile=faa_part117", None),
                 (f"/api/alerts?date={d}&profile=dgca_fdtl", None),
                 (f"/api/alerts?date={d}&profile=faa_part117&seed_on=arrival", None)]
        if carrier:
            jobs += [(f"/api/briefing?date={d}&carrier={carrier}", None),
                     (f"/api/alerts?date={d}&carrier={carrier}&profile=dgca_fdtl", None)]
        # Spread the sampled rotations across the list, not just the busiest.
        step = max(1, len(rots) // per_day)
        for r in rots[::step][:per_day]:
            t = r.get("tail") or r.get("tail_number")
            jobs += [(f"/api/rotation/{t}/{d}", None), (f"/api/flights/{t}/{d}/1", None),
                     (f"/api/cascade/{t}/{d}/1", None),
                     ("/api/recommendations", {"tail": t, "date": d, "leg_num": 1,
                                               "arrival_delay": 150, "profile": "faa_part117"}),
                     ("/api/recommendations", {"tail": t, "date": d, "leg_num": 1,
                                               "departure_delay": 90, "profile": "dgca_fdtl"})]
    for n, (p, body) in enumerate(jobs, 1):
        counts[_check(a, b, p, body, verbose)[0]] += 1
        if n % 25 == 0:
            print(f"... {n}/{len(jobs)}", flush=True)
    total = sum(counts.values())
    print(f"RESULT: {total} comparisons over {len(dates)} date(s): "
          f"{counts['identical']} byte-identical, {counts['equal']} equal within 1e-6 "
          f"(volatile ids only), {counts['different']} different; "
          f"{len(RETRIES)} transport retr{'y' if len(RETRIES) == 1 else 'ies'}")
    return counts["different"]


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    flags = {x for x in sys.argv[1:] if x.startswith("--")}
    sys.exit(1 if main(args[0], args[1], args[2:] or None,
                       served_subset="--served-subset" in flags,
                       verbose="--quiet" not in flags) else 0)
