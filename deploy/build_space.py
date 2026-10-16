"""Build the hosted API's artifacts into deploy/backend/artifacts/.

The Docker build context is the repository root: the image takes its code from
api/ and its data from deploy/backend/artifacts/, which is COMMITTED (Render
builds from the GitHub repo; about 45 MB, every file < 10 MB). It holds the slim
serving set built by api/slim.py plus the small result files the API reads.
Files only the test image needs go to deploy/backend/testdata/ (gitignored).
See deploy/ARTIFACT_MANIFEST.md.

    python deploy/build_space.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "deploy" / "backend"
ARTIFACTS = BACKEND / "artifacts"
TESTDATA = BACKEND / "testdata"

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


def copy(rel: str, dst_root: Path) -> int:
    src, dst = ROOT / rel, dst_root / rel
    if not src.exists():
        raise SystemExit(f"missing artifact: {rel}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return src.stat().st_size


def main():
    for d in (ARTIFACTS, TESTDATA):
        shutil.rmtree(d, ignore_errors=True)
    for rel in RUNTIME:
        print(f"{copy(rel, ARTIFACTS) / 1e6:9.3f} MB  artifacts/{rel}")
    for rel in TEST_ONLY:
        print(f"{copy(rel, TESTDATA) / 1e6:9.3f} MB  testdata/{rel}")
    env = {k: v for k, v in os.environ.items() if k != "FDPIS_SLIM_DIR"}
    subprocess.run([sys.executable, "-m", "api.slim", "build", str(ARTIFACTS / "slim")],
                   cwd=ROOT, env=env, check=True)
    # Default alert feeds, computed by the serving code on the slim bundle in a
    # fresh process (fresh alert registry), exactly as the server would.
    subprocess.run([sys.executable, "-m", "api.slim", "feeds", str(ARTIFACTS / "slim")],
                   cwd=ROOT, env={**env, "FDPIS_SLIM_DIR": str(ARTIFACTS / "slim")}, check=True)
    for f in sorted((ARTIFACTS / "slim").iterdir()):
        print(f"{f.stat().st_size / 1e6:9.3f} MB  artifacts/slim/{f.name}")


if __name__ == "__main__":
    main()
