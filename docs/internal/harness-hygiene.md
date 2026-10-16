# Harness hygiene (lane fix/harness-hygiene, from main @ efbe557)

The probe files' own hygiene — review-ledger Wave 3 (ii) items P3.5 · P3.7 · P3.9 · P3.10 · P3.11 · P3.12 · P3.15 · P3.16 · P3.17 · P3.18 · P3.19 · P3.20.
Headless only: tools/qa/**, tools/*.sh, docs/**, CLAUDE.md. No game / render code touched. All twelve items FIXED (hashes below and on the ledger lines);
P3.13 (a presets probe + identity battery) and P3.3/P3.4's teams-probes half were not in this lane's brief and stay OPEN.

## Where I am / next
- [x] P3.5  vacuity floors: wall-clip speed/doors/shove/moves/ends + wall-snap sweep (`ranAtLeast`, ~half the 08-12 counts) — 99a76d3
- [x] P3.7  corpse / follower-corpse / takedown-wall → counted `- PASS/FAIL —` lines + returned verdicts — 03b47a5
- [x] P3.9  reclear / picked-door / body-clear assert too; leaf-wedge, silent-repair, dead-script, motion → `repros` (out of `all`) — a351d80
- [x] P3.10 tour-seed4242.log deleted (tour.ts has no diff mode), CLAUDE.md + architecture-review fixed — 1d37644
- [x] P3.11 checkpoint-probes: an un-stageable refusal case = a STAGING fail — 6c9ee8f
- [x] P3.12 quality-plan under `perf` (runScript child, shared with attract) — 2943e66
- [x] P3.15 run() snapshots / restores journal.ts knobTables round every probe (+ selftest-knobs) — e7d718b (+ wind pins its own profile, 60db667)
- [x] P3.16 frame-layout literal reader + count guard; glass panes / bangs and dialogue-shapes floors — 7ef8f4b
- [x] P3.17 door-hands pageCase reseed — 4233d86
- [x] P3.18 gate.sh timeout fallback (timeout → gtimeout → perl alarm → uncapped + warning), `all-quick`, checkpoints banner after checkpoint-civilians — eab72b0 + 8910206
- [x] P3.19 wind / weapons baseline PROVENANCE blocks; wind-identity pins civilians on + greet on — 60db667
- [x] P3.20 head comment = usage as it is + a name index from the new `probes.ts list`; perf-flags label; wall-shelf-pop into wall-snap / player / all — 538c068
- next (not this lane): P3.13; teams-probes.ts:99 provenance; the corpse remark observation below for the guards lane.

## Method
One commit per item; after each, the narrowest family that covers it. At the end: typecheck, `gate.sh perf player selector journal ui`,
`probes.ts repros`, `probes.ts selftest` / `selftest-quiet` (red paths still red), and one timed `gate.sh all-quick`.

## Decisions worth knowing
- **P3.9 — which converted, which moved.** Converted to asserting probes (their head comments state the expectation and it holds today): corpse (body found in every
  case; no generic 'clear here' / 'must have been nothing' within 4 m of it; a staging with no victim = FAIL), follower-corpse (found within 40 s both ways; the follower
  never keeps the corpse as leader; the still-leader fallback turns him to face a held leader), takedown-wall (a solid between them + within 1.05 m = staged; the row is
  not offered through the wall; a forced lunge never lands beyond it), reclear (rooms called clear skipped inside the minute, brought back by a fix inside them, back after
  65 s), picked-door (the tampered door's room taken first — jumping the queue in case b — and remarked on), body-clear (the body-dealt clear gets past muster). Moved to
  `repros` (pure who-does-what tables, nothing to assert): leaf-wedge, silent-repair, dead-script, motion (motion still prints under `ai-pass`, whose other members carry
  that family's verdict). `repros` reads NO VERDICT under the runner and ERROR under gate.sh — by design; do not gate on it.
- **P3.15 — the smaller change was the runner, not the files.** journal.ts already names the module knob singletons (`knobTables()`: AIM TRAINED AI_TUNE BODY_LIGHT
  GUARD_EYE NEEDS WHISTLE WET WIND CIV CHAOS RING LAUNCHER GLASS TALK_TUNE HOLD SUPPRESSION RIFLE_SPREAD OVERHEAR SCORE BADGE CKPT); probes.ts `run()` deep-copies them
  before a probe and deep-assigns them back after it (journal's assignDeep rule, re-stated locally — no game code touched). Every present and future probe file is
  covered; `selftest-knobs` scribbles on three tables in one probe and checks the next sees them restored. A probe's OWN internal consistency (civilians-identity flipping
  greet between its variants) stays its business.
- **P3.18 — the cap.** `capped()` is chosen once at start: `timeout`, else `gtimeout`, else `perl -e 'alarm(shift); exec @ARGV'` (exit 142 on the cap instead of 124 —
  both are named as 'hit the time cap'), else no cap with a printed warning. This Mac has Homebrew's timeout + gtimeout; the perl path was exercised by running with
  PATH=/usr/bin:/bin (a 1 s cap on `corpse` → exit 142, family red, gate exit 1). `all` / `all-quick` get a 4 h cap (one probes.ts process), everything else 1500 s;
  GATE_TIMEOUT overrides both.
- **takedown-wall's restaging** found that `teleportPlayer` snaps a spot the player's circle cannot hold to the nearest free NAV CELL CENTRE (up to half a metre off) —
  the old case 1 measured reach, not the wall (1.23 m off, 'get closer' regardless), and case 2's manager-office side is furniture-lined. Spots now: conference room
  (12.0, 9.45) behind the corridor man at z 10.45; cubicle aisle (27.45, 20.6) behind a man at (28.4, 20.6) inside the break room's 12 cm partition; corridor (30.5, 11.7)
  behind the man inside the break room's north wall. The staging check FAILS a case whose spot drifts past 1.05 m again.

## Observations handed on (not this lane's to fix)
- **corpse: the second man's remark and the closing line read ×0 in all four cases** even with the counter widened to both wordings ('…christ. — stay sharp' /
  "…he's out cold. someone did this by hand. — stay sharp"; 'no sign of him…'). The lines are still in guards.ts bodyAftermath; in these seeded runs the second man's
  first words are 'clear here — staying on it' at 11 m and then the radio traffic of the lockdown. Whether the remark stage still fires over a KO'd body (killGuard quiet
  = out cold since the KO change) is a question for the guards lane — the probe now prints the count as information beside its two assertions.
- A forced `startTakedown` (bypassing the row) DOES drop a man through a 12 cm partition — unreachable in play (the row is not offered), printed as information.

## Verification (this tree)
- `bun run typecheck` clean.
- Per item: takedown-wall 9/9, corpse 8/8, follower-corpse 5/5, reclear 4/4, picked-door 8/8, body-clear 6/6, wall-clip-shove (floors print), frame-layout, glass-shot,
  glass-blast, dialogue-shapes, door-hands, checkpoints (6 probes, banner last), quality-plan → `gate.sh perf` 64 check lines, selftest-knobs, wind-identity (354b99f6
  reproduced with the profile pinned), weapons-identity, wall-shelf-pop — all green; `probes.ts nosuch` exit 2; gate.sh on capped / green / red / quiet / unknown = 1 / 0 / 1 / 1 / 2.
- Final gates: see the Log.

## Log
- 08-12 02:10 lane starts on efbe557; notebook skeleton 4abb6de.
- 02:15–02:45 items landed one commit each (list above); wall-clip counts measured on the pre-change tree: speed 172 statics / 372 spots / 3600 runs, doors 10 / 704 /
  9120, shove 64, moves stand-up 2050+2053 · takedown 632+632 · kick/pick 241 ×4 · comes-through 336 ×4 · drag 1+1, ends 3784, sweep 687 holds / 936 refusals per rate.
