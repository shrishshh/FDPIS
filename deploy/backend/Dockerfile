# FDPIS API for a 512 MB host (Render free). Build context: deploy/backend/,
# assembled by `python deploy/build_space.py`.
#
#   docker build -t fdpis-api .                 # runtime image (what Render runs)
#   docker build --target test -t fdpis-test .  # + scikit-learn and parity files
#   docker run --rm fdpis-test                  # test_parity + layer5 tests

FROM python:3.11-slim AS base

# libgomp1: OpenMP runtime for the xgboost wheel.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 app
WORKDIR /home/app/fdpis

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app results/ results/
COPY --chown=app:app slim/ slim/
COPY --chown=app:app api/ api/

# FDPIS_SLIM_DIR: serve the precomputed slim artifacts (api/slim.py).
# One OpenMP thread and two malloc arenas keep resident memory flat. Arrow on the
# system allocator: its default mimalloc pool keeps ~120 MB of parquet read
# buffers resident that malloc_trim cannot return. Briefing cache: 8 scored days
# (~6.5 MB each) instead of 64, so date x carrier browsing cannot exhaust memory.
# MALLOC_TRIM_AFTER_REQUEST returns each request's freed working set to the OS.
ENV FDPIS_SLIM_DIR=/home/app/fdpis/slim \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OMP_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2 \
    ARROW_DEFAULT_MEMORY_POOL=system \
    BRIEFING_CACHE_SIZE=8 \
    MALLOC_TRIM_AFTER_REQUEST=1


FROM base AS test
COPY requirements-test.txt .
RUN pip install --no-cache-dir -r requirements-test.txt
COPY --chown=app:app testdata/results/ results/
USER app
CMD ["sh", "-c", "python -m api.test_parity && python -m unittest api.layer5.test_rules"]


FROM base AS runtime
USER app
EXPOSE 10000
# Render injects PORT (default 10000).
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --no-server-header --log-level info"]
