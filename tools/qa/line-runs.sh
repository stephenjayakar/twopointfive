#!/bin/sh
# Play-throughs with the line-of-fire watcher on (tools/qa/line-watch.ts), one JSON a run into a folder — resumable (a run whose file is there is skipped) and
# ordered seed by seed across the scenarios, so a folder stopped early is still an even sample of every level.
#   sh tools/qa/line-runs.sh <out dir> [seeds, default 1-144] [scenarios, comma list, default every one] [jobs, default 4] [--set JSON for playthrough.ts]
#   env passes through (PT_NOISE=1, PT_STAND=1 …); PT_LINE and PT_DIGEST are set here. Then: bun run tools/qa/line-tally.ts <out dir>
# A folder is ONE arm of ONE build: its `arm.txt` holds the commit, the PT_* environment and the --set it was started with, and a resume under anything
# else is refused (exit 2). What a failed run printed is in the folder's errors.log.
set -e
D=${1:?out dir}; SEEDS=${2:-1-144}; SCNS=${3:-night-breach,room-clear-pair,room-clear-four,hostage-rescue,records-pair,depot-four,block-four,block-squads,warehouse-four,compound-four,barracks-four,rescue-registry}; JOBS=${4:-4}; SET=${5:-'{}'}
HERE=$(cd "$(dirname "$0")" && pwd); mkdir -p "$D"
ARM="commit $(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo unknown)$(git -C "$HERE" diff --quiet HEAD -- src tools/qa/playthrough.ts tools/qa/line-watch.ts tools/qa/headless.ts 2>/dev/null || echo ' +local changes') · env $(env | grep '^PT_' | grep -v '^PT_LINE=\|^PT_DIGEST=' | sort | tr '\n' ' ')· set $SET"
if [ -f "$D/arm.txt" ]; then [ "$(cat "$D/arm.txt")" = "$ARM" ] || { echo "$D holds another arm: $(cat "$D/arm.txt") — this one is: $ARM" >&2; exit 2; }; else echo "$ARM" > "$D/arm.txt"; fi
A=${SEEDS%-*}; B=${SEEDS#*-}
for seed in $(seq "$A" "$B"); do for scn in $(echo "$SCNS" | tr , ' '); do echo "$scn:$seed"; done; done |
  PT_LINE=1 PT_DIGEST=1 xargs -P "$JOBS" -I@RUN@ sh -c 'f="$0/$(echo "@RUN@" | tr : -).json"; [ -s "$f" ] || bun run "$1/playthrough.ts" --one "@RUN@" --out "$f" --set "$2" 2>>"$0/errors.log" || echo "failed @RUN@" | tee -a "$0/errors.log" >&2' "$D" "$HERE" "$SET"
N=$(ls "$D" | grep -c '\.json$' || true); echo "$N runs in $D"; [ "$N" -gt 0 ]
