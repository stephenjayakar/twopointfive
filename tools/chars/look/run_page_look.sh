#!/bin/sh
# The look set against one served tree: PORT=<dev server port> OUT=<folder> sh tools/chars/look/run_page_look.sh
# The FAST set (what the base was shot with): two boots, four stills, quality medium, 8 drawn frames a still, 960x540, seed 7:
#   top-squad-vs-defenders · close-operators · close-defenders (page ?roomclear=1&squad4) · close-staff-civilians (the plain night)
# One Chromium, one page at a time. SET=full FRAMES=20 QUALITY=high gives the long eight-still set instead (hours on a shared box).
set -u
: "${PORT:?PORT=the dev server port}" "${OUT:?OUT=the output folder}"
D=$(dirname "$0")
SET=${SET:-fast} QUALITY=${QUALITY:-medium} FRAMES=${FRAMES:-8} SIZE=${SIZE:-960x540} SEED=${SEED:-7} exec node "$D/look-stills.cjs"
