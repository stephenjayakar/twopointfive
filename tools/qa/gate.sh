#!/bin/sh
# Run probe families and report EVERY sub-family verdict (a family prints several '=== name: … ===' lines; reading only the last one hid a red
# breach-run for a day — review 08-10 #2/#4). Counts check lines in BOTH shapes the probe files print ('- PASS — …' and the two-space '  PASS …' of the
# editor / level probes). A family is RED when any FAIL / error line appears, probes.ts exits non-zero (1 = a probe failed, 2 = unknown family — nothing
# ran), or it printed neither a verdict line nor a single counted check (an ERROR: a green made of nothing). Exit 0 all green, 1 any red, 2 if the only
# red was an unknown family name.  Usage: tools/qa/gate.sh fam1 fam2 …   (GATE_TIMEOUT=secs overrides the 1500 s cap per family; `all-quick` = the union of
# the gate lists lanes are told to run, see probes.ts)
# The per-family time cap wants a timeout(1) binary — GNU coreutils' `timeout` or Homebrew's `gtimeout`; a stock macOS has neither and the gate used to die on
# its first line there. With neither on the PATH a perl alarm stands in (exit 142 on the cap instead of 124), and failing that the family runs uncapped, said so.
cap=${GATE_TIMEOUT:-1500}
if command -v timeout >/dev/null 2>&1; then capped() { timeout "$cap" "$@"; }
elif command -v gtimeout >/dev/null 2>&1; then capped() { gtimeout "$cap" "$@"; }
elif command -v perl >/dev/null 2>&1; then capped() { perl -e 'alarm(shift @ARGV); exec @ARGV or die "exec: $!"' "$cap" "$@"; }
else echo "  (gate.sh: no timeout / gtimeout / perl on the PATH — families run with no time cap)"; capped() { "$@"; }; fi
rc=0
for fam in "$@"; do
  case "$fam" in all|all-quick) [ -z "$GATE_TIMEOUT" ] && cap=14400 ;; *) cap=${GATE_TIMEOUT:-1500} ;; esac   # (the whole-tree sets are one probes.ts process: 25 min would cap them mid-run)
  out=$(capped bun run tools/qa/probes.ts "$fam" 2>&1); st=$?
  ver=$(printf '%s\n' "$out" | grep -iE "^=== .*(ALL PASS|FAIL)" | sed 's/^=== //; s/ ===$//')
  nf=$(printf '%s\n' "$out" | grep -cE "^=== .*FAIL|^- FAIL —|^  FAIL |^error:|^!! FAIL|Cannot find module")
  np=$(printf '%s\n' "$out" | grep -cE "^- PASS —|^  PASS "); nfl=$(printf '%s\n' "$out" | grep -cE "^- FAIL —|^  FAIL ")
  if [ -n "$ver" ]; then printf '%s\n' "$ver" | sed "s/^/  $fam · /"; fi
  echo "  $fam · ${np} PASS / ${nfl} FAIL check lines (exit $st)"
  if [ $st -eq 2 ]; then
    echo "  $fam · *** ERROR: unknown probe family '$fam' (probes.ts exit 2 — nothing ran) ***"; printf '%s\n' "$out" | grep -E "^error:" | head -2 | cut -c1-260 | sed 's/^/      /'
    [ $rc -eq 0 ] && rc=2; continue
  fi
  printf '%s\n' "$out" | grep -E "^  the reds against the list|^    (EXPECTED RED|NEW RED|GREEN AGAIN) " | cut -c1-240 | sed "s/^/  $fam ·/"   # (probes.ts's table of this run's reds against tools/qa/expected-red.ts: old and explained / NEW / green again — for the reader; red stays red)
  if [ $st -eq 124 ] || [ $st -eq 142 ]; then echo "  $fam · *** ERROR: the family hit the ${cap} s time cap (exit $st) ***"; fi
  [ $st -ne 0 ] && nf=$((nf+1))
  if [ -z "$ver" ] && [ "$np" -eq 0 ]; then nf=$((nf+1)); echo "  $fam · *** ERROR: no verdict line and no counted check — nothing here says PASS ***"; fi
  if [ "$nf" -gt 0 ]; then rc=1; echo "  $fam · *** $nf FAIL/ERROR line(s) (exit $st) ***"; printf '%s\n' "$out" | grep -E "FAIL —|^  FAIL |^=== .*FAIL|^error:|^!! FAIL|Cannot find" | head -6 | cut -c1-260 | sed 's/^/      /'; fi
done
exit $rc
