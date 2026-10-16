#!/bin/sh
# The whole look set for one tree:   REPO=<tree> OUT=<final dir> [WORK=<local scratch>] [SPP=48] [SHOTS="swatches lineup topdown close head"] sh run_blender_look.sh
# Renders into WORK (local disk, a fresh folder unless given) and copies the finished PNGs + look.json to OUT at the end of each step.
# Exits 1 when the dump or any sheet family failed (the families after a failed one still run).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO:-$HERE/../../..}
OUT=${OUT:?OUT=<dir for the PNGs>}
WORK=${WORK:-$(mktemp -d "${TMPDIR:-/tmp}/look-work.XXXXXX")}
PY=${PY:-python3}
SPP=${SPP:-48}
SHOTS=${SHOTS:-"swatches lineup topdown close head"}
mkdir -p "$WORK" "$OUT"
t0=$(date +%s)
bad=""
echo "== dump (bun) from $REPO, work in $WORK"
REPO="$REPO" OUT="$WORK" bun run "$HERE/dump_look.ts" || exit 1
cp "$WORK/look.json" "$OUT/look.json"
for s in $SHOTS; do
  t1=$(date +%s)
  echo "== $s"
  # one Blender process per sheet family (a long-lived one slows down); its whole output is kept in WORK/_<family>.log
  REPO="$REPO" LOOK="$WORK" "$PY" -I "$HERE/render_look.py" "$WORK" "$s" --spp "$SPP" > "$WORK/_$s.log" 2>&1
  rc=$?
  grep -E "DONE|FAILED|Error|error|Traceback|look.json" "$WORK/_$s.log"
  if [ $rc -ne 0 ] || grep -q "FAILED" "$WORK/_$s.log"; then bad="$bad $s"; echo "   $s FAILED (exit $rc): tail of $WORK/_$s.log"; tail -n 5 "$WORK/_$s.log"; fi
  for f in "$WORK"/*.png; do
    [ -e "$f" ] || continue
    case "$(basename "$f")" in _*) ;; *) { [ ! -e "$OUT/$(basename "$f")" ] || [ "$f" -nt "$OUT/$(basename "$f")" ]; } && cp "$f" "$OUT/";; esac
  done
  echo "   $s: $(( $(date +%s) - t1 )) s"
done
echo "== all: $(( $(date +%s) - t0 )) s -> $OUT"
ls "$OUT"
[ -z "$bad" ] || { echo "FAILED:$bad"; exit 1; }
