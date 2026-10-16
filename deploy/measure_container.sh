#!/bin/sh
# Peak RSS of the API under a hard 512 MB limit while serving the heaviest endpoints.
# usage: sh deploy/measure_container.sh <image> <port>
IMG=$1; PORT=$2; B=http://127.0.0.1:$PORT
docker rm -f fdpis-mem >/dev/null 2>&1
docker run -d --name fdpis-mem --memory=512m --memory-swap=512m -p $PORT:10000 \
  -e ALLOWED_ORIGINS=http://localhost:3000 "$IMG" >/dev/null
t0=$(date +%s)
until [ "$(curl -s -o /dev/null -w '%{http_code}' $B/api/health)" = 200 ]; do sleep 0.5; done
echo "ready after $(( $(date +%s) - t0 ))s"
m() { printf '%-44s %s\n' "$1" "$(docker exec fdpis-mem sh -c "grep -E 'VmRSS|VmHWM' /proc/1/status | tr -s ' \t' ' ' | tr '\n' ' '")"; }
m "after startup"
for d in 2025-07-19 2025-07-25 2025-07-31; do for p in faa_part117 dgca_fdtl; do
  curl -s -o /dev/null "$B/api/alerts?date=$d&profile=$p"; m "alerts $d $p"; done; done
curl -s -o /dev/null "$B/api/alerts?date=2025-07-25&profile=dgca_fdtl&crew_model=inferred_blocks"; m "alerts inferred_blocks"
for d in 2025-07-19 2025-07-25 2025-07-31; do curl -s -o /dev/null "$B/api/briefing?date=$d&limit=5000"; curl -s -o /dev/null "$B/api/rotations?date=$d"; done; m "briefing x3 (limit 5000) + rotations x3"
# Fill the feed cache: every served date x both profiles (26 entries of 32).
for d in $(curl -s $B/api/dates | python -c "import sys,json;print(' '.join(x['date'] for x in json.load(sys.stdin)))"); do
  for p in faa_part117 dgca_fdtl; do curl -s -o /dev/null "$B/api/alerts?date=$d&profile=$p"; done; done
m "feed cache full (13 dates x 2 profiles)"
docker inspect fdpis-mem --format 'OOMKilled={{.State.OOMKilled}} running={{.State.Running}}'
# Worst case: every served date x every carrier through briefing (LRU) and the
# alert feed (32-entry cache), cycling both caches several times over.
CARRIERS=$(curl -s $B/api/carriers | python -c "import sys,json;print(' '.join(x['carrier'] for x in json.load(sys.stdin)))")
for d in $(curl -s $B/api/dates | python -c "import sys,json;print(' '.join(x['date'] for x in json.load(sys.stdin)))"); do
  for c in $CARRIERS; do
    curl -s -o /dev/null "$B/api/briefing?date=$d&carrier=$c"
    curl -s -o /dev/null "$B/api/alerts?date=$d&carrier=$c&profile=dgca_fdtl"
  done
  curl -s -o /dev/null "$B/api/briefing?date=$d&limit=5000"
done
m "stress: all dates x all carriers"
docker inspect fdpis-mem --format 'OOMKilled={{.State.OOMKilled}} running={{.State.Running}}'
