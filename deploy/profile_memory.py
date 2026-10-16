"""Memory breakdown of the API process, step by step. Linux only (/proc).

Run inside the runtime image:
    docker run --rm -v <this file>:/home/app/fdpis/profile_memory.py:ro fdpis-api \
        python profile_memory.py
Unset FDPIS_SLIM_DIR to profile the full artifacts instead.
"""
from __future__ import annotations

import gc
import os
import sys

sys.path.insert(0, os.getcwd())


def _status(key: str) -> float:
    with open("/proc/self/status") as fh:
        for line in fh:
            if line.startswith(key):
                return int(line.split()[1]) / 1024
    return float("nan")


last = _status("VmRSS:")


def step(label: str):
    global last
    gc.collect()
    now = _status("VmRSS:")
    print(f"{label:<40} rss {now:6.0f} MB  ({now - last:+5.0f})  peak {_status('VmHWM:'):6.0f} MB",
          flush=True)
    last = now


step("python start")
import numpy  # noqa: E402,F401
step("import numpy")
import pandas  # noqa: E402,F401
step("import pandas")
import pyarrow.parquet  # noqa: E402,F401
step("import pyarrow.parquet")
import xgboost  # noqa: E402,F401
step(f"import xgboost (sklearn loaded: {'sklearn' in sys.modules})")
import fastapi, pydantic, uvicorn  # noqa: E401,E402,F401
step("import fastapi + pydantic + uvicorn")
from api import main  # noqa: E402
step("import api.main (all modules)")
from api.layer5 import tz  # noqa: E402
tz._airports() if hasattr(tz, "_airports") else None
step("airportsdata table")

from api.models import load_bundle  # noqa: E402
b = load_bundle()
step("load_bundle()")
print(f"    df: {len(b.df):,} rows x {b.df.shape[1]} cols = "
      f"{b.df.memory_usage(deep=True).sum() / 2**20:.0f} MB (deep)")
print(f"PEAK RSS (VmHWM): {_status('VmHWM:'):.0f} MB")
