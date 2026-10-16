"""Assemble deploy/backend/, the Docker build context for the hosted API.

Copies the API code, the small result files the API reads, and builds the slim
serving artifacts (api/slim.py) next to the committed Dockerfile and
requirements. The copies are gitignored; only this script, the Dockerfile,
requirements and docs are tracked. See deploy/ARTIFACT_MANIFEST.md.

    python deploy/build_space.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CTX = ROOT / "deploy" / "backend"

# Read at runtime by the slim deployment (besides slim/, built below).
RUNTIME = [
    "results/layer4/config.json",                       # Layer 4 features, levels, gate
    "results/candidates/weather_b/comparison.csv",      # /api/performance
    "results/layer5/actionable_metrics.csv",
    "results/layer5/naive_comparison.csv",
    "results/layer5/lead_time_summary.csv",
    "results/layer5/backtest_meta.csv",
    "results/layer5/three_band.csv",
    "results/layer5/recall_precision_sets.csv",
]
# Only in the Docker `test` stage: api/test_parity.py reloads the Layer 3 model
# from its original JSON and replays the saved notebook-5 chains.
TEST_ONLY = [
    "results/xgb_primary_classifier.json",
    "results/layer4/cascade_chains_integrated.parquet",
]
# backtest.py writes results; it never runs in the deployment.
API_EXCLUDE = {"backtest.py", "__pycache__", ".gitignore", "requirements.txt"}


def copy(rel: str, dst_root: Path) -> int:
    src, dst = ROOT / rel, dst_root / rel
    if not src.exists():
        raise SystemExit(f"missing artifact: {rel}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return src.stat().st_size


def main():
    for d in ("api", "results", "slim", "testdata", "data"):
        shutil.rmtree(CTX / d, ignore_errors=True)
    shutil.copytree(ROOT / "api", CTX / "api",
                    ignore=lambda _d, names: [n for n in names if n in API_EXCLUDE])
    for rel in RUNTIME:
        print(f"{copy(rel, CTX) / 1e6:9.3f} MB  {rel}")
    for rel in TEST_ONLY:
        print(f"{copy(rel, CTX / 'testdata') / 1e6:9.3f} MB  testdata/{rel}")
    env = {k: v for k, v in os.environ.items() if k != "FDPIS_SLIM_DIR"}
    subprocess.run([sys.executable, "-m", "api.slim", "build", str(CTX / "slim")],
                   cwd=ROOT, env=env, check=True)
    for f in sorted((CTX / "slim").iterdir()):
        print(f"{f.stat().st_size / 1e6:9.3f} MB  slim/{f.name}")


if __name__ == "__main__":
    main()
