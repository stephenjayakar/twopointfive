# Probe restaging — the four stale families (lane fix/probe-restage, 08-12)

## WHERE I AM / NEXT (resume block — keep current)
- worktree `.worktrees/restage`, branch `fix/probe-restage` from main 49c7ad9. Scratch bisect worktree `.worktrees/restage-bisect` (detached, disposable — `git worktree remove` it).
- status: DONE — [x] teams (dd5e31a)  [x] carbine (baa68c5)  [x] ko-witness (0369fed)  [x] ai-pass (d617b57: missing + tactics-identity)  [x] typecheck clean
  [x] gate.sh ko-witness carbine teams ai-pass → exit 0   [x] gate.sh player doors qrf civilians → exit 0   [x] ledger P3.1 / P3.3 / P3.8 lines (b0bc415)
- next: merge `fix/probe-restage` to main (probe / doc files only — no game code); the maintainer answers §Question; then the civilians-ON variants get written.

## Summary (10 lines)
Main exited 1 in `ko-witness`, `carbine`, `teams`, `ai-pass`. Every red was a STALE EXPECTATION or a SPOILED STAGING, none a game bug; no game code was touched.
- `teams-table`: civilians are a fifth side since d7c3289 → the table wants 25 pairs (the nine civilian pairs neutral) and five sides.
- `carbine-fire (7)`: neither the 9 mm re-deal nor the probe's 12 was off by one — the probe read the box two frames after the deal and Reyes had already fired one
  round of the fresh pistol in them (11 + 1 = the twelve all told). The check now counts the settle frames' rounds; the all-told loads are derived from weapons.ts.
- `ko-kinds (b)`: the log line over a shot man is 'guard down — dead' since the KO-vs-dead wording pass 7ecfb42 (exact match kept, plus no breathing line over him).
- `witness (a)`: the Five-seveN is SUPPRESSED since 8b3f69d (level 0.6 = an odd noise within ≈ 7.5 m, not gunfire) → B sees the act + hears a small noise at the
  muzzle, never alert; C on the lot hears nothing of it and knows only the call. The loud carry to the lot stays covered by (d) / (e).
- `ko-rollcall` ×2 and `missing (A)`: SPOILED BY CIVILIANS — the late worker comes on the body first (measured below). Restaged with civilians OFF; a civilians-ON
  variant awaits the maintainer's answer (§Question). TODOs left in ko-probes.ts / ai-probes.ts.
- EXTRA red found in `ai-pass`, not in the brief: `tactics-identity` (digest 8e0cb169 ≠ bc835744) — BISECTED to 7fb3061 (the cursor aim ray stops on glass), an
  intended player-side change; re-frozen with the provenance written on the literal. Not a tactics regression (§tactics-identity).

## The one design question for the maintainer (NOT decided here)
Since the civilians merged (d7c3289), in the missing-man staging (Reyes down behind the reception desk at (7.6, 16.1), Sam gone, calm floor, seed 201) the late
worker's loop brings him on the body BEFORE the shift's own process completes: radio check +89.4 s → Reyes asked for +93.4 → Kowalski sent round the route +97.4 →
**Owen '→ alarmed [body, armed]' at +113.5 s, runs to Novak, tells him at +119.6, control puts the floor up on cause 'civilian' ("copy — somebody's on the floor who
shouldn't be…") at +122.4** — the walk never reaches the desk, `victim.found` stays false inside the probe's window, no 'not at his post'. With civilians off the
walk finds him at +159.5 s and the floor goes up on the body, as the probes were written.
**Question:** is "a civilian came on him and it reached the net first" a legitimate THIRD outcome of the missing-man / rollcall staging (beside 'found on the walk'
and 'not at his post')? If YES: add `koRollcallCivilians` / `missing (A2)` with them on, expecting cause 'civilian' before the walk and the finder's words checked when
Novak's search reaches the body. If NO (the shift should get there first, or a civilian's report should hand the sent man the body directly): that is a game change
for the civilians / rollcall code, not a probe change. Until answered: `ko-rollcall` and `missing (A)/(B)` run with `tune.civilians = false; civilians.length = 0`
(the devices / teams probes' idiom); `missing (D)/(C)` keep civilians on (bodies where no civilian goes — that nothing leaks there is worth holding).

## Per probe: what was stale, the evidence, what changed
### teams-table (teams-probes.ts) — dd5e31a
- Stale: `want` listed 16 pairs and asserted 4 sides. Evidence: `src/game/teams.ts` head comment + `TEAMS`/`HOSTILE` carry `civilian` since d7c3289 ("hostile to
  NOBODY and nobody hostile to them … so a held / downed civilian's Guard record has a side to name"); CLAUDE.md civilians bullet.
- Now: 25 pairs (the 16 unchanged + 9 civilian pairs all false), an explicit 'civilian row and column neutral' line, five sides in this order and no more.
### carbine-fire (7) (carbine-fire-probes.ts) — baa68c5
- Not stale in intent, fragile in measurement: the literal `roundsReady === 12` after `carbineGuards = 'none'; step; step`. weapons.ts: guard9mm magCapacity 12,
  topUp false → constructor `mag = 11, chamber = 1` = 12 all told ("a guard's twelve, all told, never thirteen"); game.ts's deal makes `new Firearm` at the TOP of the
  first frame after the knob moves, so the alert Reyes can fire the fresh gun in the two settle frames — seed 4708 does today (measured: 11 in the box + 1 guard9mm
  round in the settle frames). The fight's frame timing moved since the probe was frozen; which commit was not bisected (not needed: the invariant is exact either way).
- Now: `roundsReady + rounds seen in the settle frames === all-told` for both flips (30 / 12 derived from the rows), chamber 1, no round of the OLD row after the
  deal, the rows' all-told values asserted (30 / 12) so a row change is named, not mis-read.
### ko-kinds (b) (ko-probes.ts) — 0369fed
- Stale literal: `'guard down'`. Evidence: 7ecfb42 (08-09) rewrote combat.ts killGuard's default lines: 'guard down' → 'guard down — dead' (and the out-cold /
  choked lines gained 'breathing'); CLAUDE.md: "'out cold — breathing' on his body row and in the log". Now: exact `'guard down — dead'` + no breathing/out-cold
  line in the first second over a shot man.
### witness (a) (ko-probes.ts) — 0369fed
- Stale premise: a LOUD Five-seveN. Evidence: 8b3f69d "the suppressed pistol is an odd noise nearby, not a gunshot floor-wide"; weapons.ts fiveseven `report
  { level: 0.6, loud: false }`; guards.ts hearingCheck: `gunfire = level ≥ 1`; a sub-gunshot 'shot' is heard within `7 × carry × max(0.3, level/0.6) + 0.5` m as
  `small()` (suspicion 0.5, placed at the source through open air, no radio), never `H.shots`, never 0.92.
- Now asserted: premise (Sam's pistol row suppressed, level < 1; the filed event level 0.6, not loud, that row's id); B: sawAct shot/A at once, `heard.small ≥ 1`
  one frame later placed within 1 m of Sam, `heard.shots === 0`, never alert, peak ≥ 0.5; C: no sawAct, `shots/small/bang === 0`, `alertedBy null`, peak < 0.9,
  `calledToBody` = A dead; B `sawBody` A not breathing. Loud carry to the lot: (e) (a level-1 shot → B and C `heard.shots 1`) and (d) (charges) unchanged.
### ko-rollcall (ko-probes.ts) — 0369fed · missing (A)/(B) (ai-probes.ts) — d617b57
- Spoiled staging (civilians), see §Question. Change: civilians off after standUp; labels say so; TODO comments name the parked variant.
### tactics-identity (tactics-probes.ts) — d617b57 (outside the brief; red inside ai-pass)
- Symptom: digest 8e0cb169 vs literal bc835744, "states every 5 s" identical. Bisection (scratch worktree, first-parent, `probes.ts tactics-identity` per commit):
  6784f19 ✓ 0513c00 ✓ cfd0047 ✓ 2005ebf ✓ a4487b7 ✓ cb0d87b ✓ **7fb3061 ✗** 49c7ad9 ✗ (59b4770 printed nothing — between two good commits, not pursued).
  7fb3061 = `BoxWorld.raycast`'s default `skipFlags` lost `BoxFlag.Glass` ("The aim ray stops on glass", the maintainer's ask). Its only default-flags caller is
  player.ts:1288 (the cursor aim ray; combat.ts's laser dot and devices.ts pass flags explicitly). Restoring `NoShadow|NoPrimary|Glass` on that one call at HEAD →
  bc835744 exactly. So the drift = Sam's cursor aim point landing on a pane in the seeded staging → his facing / pose → the men's per-frame sight and aim numbers by a
  hair; an INTENDED player-side change, tactics on or off alike. Re-frozen to 8e0cb169 with this provenance on the literal (which also corrects P3.3's false
  provenance note: bc835744 had been written inside merge 78eebd3 unrecorded).

## Gate (verbatim, filled from the runs)
`sh tools/qa/gate.sh ko-witness carbine teams ai-pass` on b0bc415 → **GATE EXIT 0**:
```
  ko-witness · ko-kinds: ALL PASS · ko-rollcall: ALL PASS · witness: ALL PASS · probes.ts ko-witness: ALL PASS · 3 probes run · 12 PASS / 0 FAIL check lines (exit 0)
  carbine · carbine-rig: ALL PASS · carbine-fire: ALL PASS · probes.ts carbine: ALL PASS · 2 probes run · 12 PASS / 0 FAIL check lines (exit 0)
  teams · teams-identity / teams-table / teams-fight / teams-player / teams-dark / teams-despawn: ALL PASS · probes.ts teams: ALL PASS · 6 probes run · 57 PASS / 0 FAIL (exit 0)
  ai-pass · muzzle / missing / scrum / devices-vision / tactics-flank / tactics-door / tactics-identity / civilians-identity / needs-identity / needs-telegraph /
            needs-interrupts: ALL PASS · probes.ts ai-pass: ALL PASS · 12 probes run · 37 PASS / 0 FAIL check lines (exit 0)
```
`sh tools/qa/gate.sh player doors qrf civilians` (neighbours) on b0bc415 → **GATE EXIT 0**:
```
  player · 20 probes ALL PASS · 166 PASS / 0 FAIL check lines (exit 0)
  doors · aim-door / aim-door-chase / aim-door-sweep / door-rules: ALL PASS · 6 probes run · 14 PASS / 0 FAIL (exit 0)
  qrf · trigger / timeline / element / wave / reset / gating / limits / perimeter: ALL PASS · 8 probes run · 41 PASS / 0 FAIL (exit 0)
  civilians · spots / sight / phone / comply / scoring / hearing / determinism / identity: ALL PASS · 8 probes run · 41 PASS / 0 FAIL (exit 0)
```
`bun run typecheck` clean.

## Deliberately not done
- No game code changed. No decision taken on the civilians question. `missing (D)/(C)` left with civilians on. The carbine timing drift not bisected (the new check
  is exact regardless). P3.3's other half (teams-probes.ts:99 provenance) untouched — not in these families' reds.
