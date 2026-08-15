#!/bin/sh
# Wait until the GPU has been idle (Device Utilization < LIMIT %) for N consecutive samples DT seconds apart — other lanes' pages share this
# GPU, and a take that overlaps one of their measurements is worthless (docs/internal/trace-perf.md §0). Prints the samples; exits 0 when quiet,
# 1 after MAX samples without a quiet run.   usage: tools/qa/gpu-quiet.sh [N=5] [LIMIT=8] [DT=2] [MAX=150]
N=${1:-5}; LIMIT=${2:-8}; DT=${3:-2}; MAX=${4:-150}
run=0; i=0
while [ $i -lt $MAX ]; do
  u=$(ioreg -r -d 1 -w 0 -c AGXAccelerator 2>/dev/null | grep -o '"Device Utilization %"=[0-9]*' | head -1 | grep -o '[0-9]*$')
  u=${u:-0}
  printf "%s " "$u"
  if [ "$u" -lt "$LIMIT" ]; then run=$((run + 1)); else run=0; fi
  if [ $run -ge $N ]; then echo " → quiet"; exit 0; fi
  i=$((i + 1)); sleep "$DT"
done
echo " → gave up (busy)"; exit 1
