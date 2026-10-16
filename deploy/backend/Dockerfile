# FDPIS API for a 512 MB host (Render free).
#
# Build context: the REPOSITORY ROOT. Code comes from api/, data from the
# committed deploy/backend/artifacts/ (rebuild with `python deploy/build_space.py`).
#
#   docker build -f deploy/backend/Dockerfile -t fdpis-api .
#   docker build -f deploy/backend/Dockerfile.test -t fdpis-test . && docker run --rm fdpis-test

FROM python:3.11-slim

# libgomp1: OpenMP runtime for the xgboost wheel.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 app
WORKDIR /home/app/fdpis

COPY deploy/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app deploy/backend/artifacts/results/ results/
COPY --chown=app:app deploy/backend/artifacts/slim/ slim/
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

USER app
EXPOSE 10000
# Render injects PORT (default 10000).
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --no-server-header --log-level info"]
