#!/bin/sh
# A resumable queue of scripted play-throughs, one JSON a run (tools/qa/playthrough.ts --one), for the doorway tallies (tools/qa/door-tally.ts).
#   sh tools/qa/door-runs.sh <out dir> <seeds a-b> <jobs> '<--set json>' [scenario ids, comma separated]
# Seed-major order (every scenario's seed 1, then every scenario's seed 2 …), so a queue stopped half way is still even across the levels; a run whose
# file exists is skipped, so the same line picks a stopped queue up. Each run carries PT_DIGEST.
OUT=$1; SEEDS=$2; JOBS=${3:-4}; SET=${4:-'{}'}
SCNS=${5:-night-breach,room-clear-pair,room-clear-four,hostage-rescue,records-pair,depot-four,block-four,block-squads,warehouse-four,compound-four,barracks-four,rescue-registry}
A=${SEEDS%-*}; B=${SEEDS#*-}; mkdir -p "$OUT"; HERE=$(cd "$(dirname "$0")" && pwd)
s=$A; while [ "$s" -le "$B" ]; do for scn in $(echo "$SCNS" | tr ',' ' '); do [ -s "$OUT/$scn-$s.json" ] || echo "$scn:$s"; done; s=$((s + 1)); done |
  PT_DIGEST=1 xargs -P "$JOBS" -I@@ sh -c 'f="$0/$(echo "$1" | tr ":" "-").json"; bun run "$2/playthrough.ts" --one "$1" --out "$f.tmp" --set "$3" 2>/dev/null && mv "$f.tmp" "$f"' "$OUT" @@ "$HERE" "$SET"
