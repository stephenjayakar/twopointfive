# The day showcase's loud half (Director program `breach`, past the drill's cut) — lane notebook

## WHERE I AM / NEXT (resume block — keep ≤ 15 lines, update on every commit)
- Worktree `.worktrees/day`, branch `feat/day-loud` from main @dda9a26; dev server :5264 (`PORT=5264 bun run tools/serve.ts` in the worktree — restart it to re-bundle after a
  script edit), shots land in the MAIN checkout's `docs/shots/day_loud_*.jpg` through the sink on :5174. Spec: docs/design/showcases.md § DAY 0:55‥2:25 + Decisions 2 / 5 / 6.
- DONE: the loud half in `levels/office.script.ts` (`loudHalf` = the spine + `loudBeats` = Blue Two's thread, the four hostiles', the trading's camera cuts; § 1), the Director's
  additions (§ 3), `tools/qa/day-probes.ts` (= `probes.ts day`: day-run / day-destruction / day-restore, + `trace` — the harness every mark and line of fire was walked with),
  breach-probes' length window and director-probes' digest re-shaped (prefix identity against the pre-port fixture + a whole-show fixture `tools/qa/fixtures/day-beats-main.json`),
  twelve framings placed by eye on :5264 (§ 1, `docs/shots/day_loud_01‥24_*.jpg`), GPU cost at high (§ 5), this notebook.
- REVIEWED (a background reviewer over the three content commits) and its findings applied at bd6601d: cues between beats are FLAGS (a `c.on('signal')` inside a burst's wait misses
  the one tick a signal is fresh — Blue Two could hang the second act at a few percent of page runs), the aisle's mouth is never two men's at once, no flinch on the operatives, no
  double kick dust, hand-over drops kicks / tracks / bursts, god structural to showcase runs, finished bursts pruned, BreachDrill returns once done, the digest refuses anything new
  before the cut, day-run's second seed on the Director's second rng stream (`--pre N` on the trace: serials 2 / 3 / 4 all finish, 4/4 down, ≥ 0.54 m, nothing late).
- GATES at 48c59dc: typecheck ✓ · `sh tools/qa/gate.sh day director breach night` EXIT 0 (day 11 / director 12 / breach 17 / night 13 check lines, 0 FAIL) · `tour.ts --runs 1 --quiet`
  PASS · `bun run build` ✓ · the page on :5264 at high (`?paused&mute&quality=high`, stepped): the show end to end FOUR times (three in one page + one from `?breach` at boot on the
  reviewed bundle: finished, 132 s, h1‥h4 ok, bang heard, both out, exfil:cut, no late / capped rows), P (`director.stop()`) at 60 s inside the firefight → three staff on patrol with
  torches, chaos null, no debris / hidden static / decal, camera free, input unlocked, every leaf at its authored angle with its closer rearmed, night, Sam at the spawn; an error trap
  (window error / unhandledrejection / GPU uncapturederror / console.error) over two whole runs caught nothing.
- NOT done (§ 7): the 10:02 opening chapter with the civilians; glassbreak by EYE (built for both: off = the panes star, 4‥5 a run; `tune.glassBreak` on — headless — the corridor
  pane One fires into (box 113, annealed) takes 3 impacts, two in one spot, and drops a cell at L 15, as decision 5 hoped; nobody has looked at it in the page).
- NEXT: the lead's merge (clean onto today's main per the reviewer's merge-tree; note main's chapter SEEK will fast-forward up to ~110 s of firefight at chaos 0.8 to reach a late
  chapter, and a seek back re-rolls the loud half's waits — the Director's dice key on the run serial); the maintainer's eye on § 6.

## 0. Ten-line summary

The DAY showcase no longer cuts on the held stack. From the drill's `cut` (show second 27.7) program `breach` runs **the loud half** for another 104 s (the whole show 2:12):
Blue Two boots the corridor door (a real kick: `c.doors.kick` → doors.ts `kickIn` on the animator's impact frame), Blue One goes through it onto a knee in the corridor, Control
puts four armed men in the lobby (spawned there, out of every line — the room's three dead leave the world at that moment: the budgets are 8 characters and 64 steady lights),
two come up the corridor and One's rounds star the conference room's glass beside the first before they take him, the second ducks into the cubicles; the pair fall back
onto the break room's west DOORWAY (One) and the south-east block's aisle corner (Two) and trade **real rounds** down the middle aisle with the two behind the west caps
who lean out of their ends by turns; Two bowls the stun charge down the aisle (the flash, the bang, a ceiling tile out of the grid), One drops the last of them as he reels
out; the man who worked round the SOUTH aisle is fought in the sun off the frontage — the monitor and the paper stack on the desk behind him go — and dropped in the shaft;
smoke into that aisle, bounds back through the break room (one covers, one moves), One's own can on the south door's threshold, out into the lot behind the van, cut, night
back bit for bit. Every hostile drops to an OPERATIVE's round (h1‥h4 `ok: true`, both seeds); the opposition's 165 rounds are laid BY DOCTRINE on the jambs, walls, leaf and
carpet about the pair — traced: none passes inside 0.58 m of an operative's chest — and the pair carry a net besides (`Guard.god`); destruction runs at the program's OWN
chaos 0.8 (`c.chaos`) and none of it outlives the veil. Deterministic under the harness: seeds 11 and 12 log every loud beat on the same frame.

## 1. The beats as built (seed 11, `bun run tools/qa/day-probes.ts trace`; L = seconds since it went loud = show − 28.0)

| L | show | lower third / set-up (`LS.*`) | what happens (notes in `director.log`) |
|---|---|---|---|
| 0.0 | 28.0 | **10:03 · corridor** · `door` (low in the corridor east of the door, west along it) | `loud`, `chaos 0.80`; the west door's leaf laid back on the cubicle side (`doors.open(w, 1.9)` — it has no closer, the breach's boot left it swinging into One's line); One covers, Two steps square to the leaf by the lock (`doors.kickSpot`) |
| 1.3 | 29.3 | | `kick:start` → impact +0.38 → `kick breakroom_n` (kickIn: keep torn, leaf flung north across the corridor at 9 rad/s, the crack the floor hears, jamb plaster + scuff); `door:kicked` 1.8 |
| 1.9 | 29.9 | | One straight through on the boot at 3 m/s while the leaf still flies (its closer wakes 2 s after the last touch: a man in the opening later wears the leaf — the first page run did) → `one:corridor` 3.45 at (29.85, 11.37): a knee a stride west of the hinge, south of the manager's ajar leaf's tip so his line to the arch is clear; Two off the kick to the HINGE side, muzzle NW across the opening, lowered while One passes (hot off: squad.ts's own rule) |
| 2.8 / 5.8 | | | radio: One 'corridor door is open…' · CONTROL 'hold there. Four armed men just came through the front…cleared hot.' |
| 7.0 | 35.0 | | Tango 1‥3 despawned; `Red 1‥4` spawned in the lobby (5.3‥6.2, 13.5‥21.9) — `hostiles {n: 4}` |
| 10.4 | | | One 'Copy, four. Two — take the west door…' → `signal:twoWest`: Two down the room's west wall and square out through the west door to the block corner (`two:set` 14.1 at (26.5, 18.6)) |
| 10.6 | 38.6 | | the four move (`red1‥4` beats): Red 1 / 2 through the arch and up the corridor's two sides at a run; Red 3 / 4 across the lobby and in by its east opening onto the middle aisle |
| 12.0 | 40.0 | `corridor` (over One's shoulder, the length of it) | `contact` (Red 1 in the arch) · One 'Contact front — two in the corridor!' |
| 13.1 | 41.1 | `glass` (from INSIDE the conference room out through its glazing at the two kneeling against it) | Red 1 kneels in front of the glass (`h1:set`), Red 2 on the south side; their bursts go high up the corridor into its east end wall and into the manager's ajar leaf 4 m in front of One (splinters); One's three pairs into the panes beside and over Red 1's head (`glass` 14.6 — laid on the panes' middles at spread 0.005: at that graze a hair of spread walks a round a metre along the wall) → 4‥5 stars |
| 16.3 | 44.3 | | `h1:down {ok: true}` — One's burst into him (tracked chest); his rifle out of his hands against the glass |
| 17.5 | 45.5 | `corridor` | Red 2's burst into the leaf, his dash for the cubicles' NW doorway (`h2:ducked` 18.5), One's three into the wall beside it; One 'One down in the corridor. Second man's into the cubicles — coming to you.' (`one:shift` 19.9) |
| 20.7 | 48.7 | **10:04 · cubicles** · `aisles` (from inside the break room west through its west door, the frame the frame's edge) | Red 4 up the middle aisle at a run to a knee at the west blocks' line (`h4:knee` 14.9): a wide burst that climbs into the NE block's aisle-side monitor (cracked), then four into the carpet short of Two and three high into the wall past his shoulder; Two: 'contact, middle aisle!', four into the carpet at the man's knee; Red 4 across the mouth and down behind the SE block's west cap (`h4:cap` 18.0), Two's rounds chasing him into the carpet and the chair; Red 2 along the north aisle and down behind the NE block's west cap (`h2:cap` 20.5); One back through the north doorway, across the room and past the lens onto his knee in the west doorway (`one:door` 23.5 at (29.1, 17.5)) |
| 27.0 | 55.0 | `reverse` (from behind the man at the west blocks' line, up the aisle at the doorway: One backlit in it, Two on the corner, both lasers at the lens) | THE TRADING (L 23‥40): Red 2 and Red 4 lean out of their caps' ends into the aisle BY TURNS (a claim / show handshake on flags: never both in the mouth), each show a burst laid low at the door's jambs / the carpet before it / the wall high past Two; behind the cap Red 2 stands to fire high over everything into the wall north of the door; One and Two answer into the carpet at whichever end a man has just shown at, One's into the carton in the aisle (it hops) once nobody kneels behind it (cardboard is concealment, not cover: combat.ts sends the round on into the man behind — the first cut killed Red 4 that way) |
| 37 / 40.1 | 68.2 | `aislesHi` (high from outside the door over the east blocks onto the mouth) | `h2Kill` armed at L 37: Red 2's next show is the one One is up waiting on → `h2:down {ok}` 44.2 |
| 45.2 | 73.2 | `bang` (the same height swung onto the mouth) | `signal:bang` → Two up off his knee, 'Banging the aisle —', the charge bowled 5.5 m down the aisle onto its mouth (`stimulus.charge flash`, fuse 1.1) → `bang {heard: true}` 48.7: detonateStun's flash / burst / the bang the floor hears, destruction's bangHeat 9 → E 14.4 → **the tile over it drops**, ceiling dust, the impulse; Red 4 reels up and out into the aisle blind (ordered: a scripted man has no daze of his own) → `h4:down {ok}` 50.4 by One |
| 51 | 79 | | `signal:twoSouth` → Two 'shifting south': down the block's east side, come at his south post from the EAST so he settles onto its line (26.45, 23.3) — a hand south of the aisle's middle, or the block's spine end takes his low line onto the far desk (`two:south` 53.4) |
| 53.4 | 81.4 | `south` (low behind Two's shoulder up the south aisle INTO the sun) | Red 3 has come the long way — the lobby, the west aisle, east along the south aisle through the shafts — to a knee at the SW block's far corner (`h3:post` L 16.9); his opening burst goes wide left across the SE block's south desks and **kills the lit monitor there** (monitor8, seDeskS8), then his threes go into the sunlit floor short of Two's post (dust IN the shaft), high into the wall past it, into the block's cap end (the spine stops those); Two rises for each of three bursts (a stand-then-fire wait of 0.45 s: fired on the order the crouch blend puts the first rounds into the chair backs) — the desk end over the man's shoulder, **the paper stack** (5 at spread 0.004 through the point a hand over it: `papers 2, sheets 57`), the spine beyond; after `LT.h3KillAfter` 9.5 s of it the man's next lean-out south of the desk is the one Two waits on → `h3:down {ok}` 65.8, in the shaft |
| 66.7 | 94.7 | `room` (a slow swing over the wrecked farm) | `downs {n: 4}`; One 'Control, Blue One — four down, no friendly casualties. Breaking contact south.' (the count is read, not asserted: 'N down and they've gone quiet' otherwise) · CONTROL '…Exfil south side into the lot — your vehicle is two minutes out. Go now.' |
| 78.0 | 106.0 | **smoke and out** · `smoke` (the south aisle, pulling out) | `signal:smoke` → Two up, his can into the south aisle 3.5 m west of him (`charge smoke`) — the plume climbs white through the shafts; 'Smoke out —', 'Two moving!' / One 'Covering!' + a pair into the carpet at the mouth; Two back up the block's east side onto the west door's south jamb (`two:door` 82.9) 'Set on the door — come to me.' |
| 82.9 | 110.9 | `peel` (from the room's south end NW across it) | One 'One moving!' — off the doorway past Two and the lens to the room's middle, down on a knee covering back on the west door (`one:in` 85.5) 'Last man — go, get the door.'; Two across to the south door (`two:ext` 88.6) 'Door! Coming out —' and through it, the leaf left standing out into the lot on its stay (`doors.open(ext, 1.7, {hold})` — its closer would shut it on One and on the smoke); One's own can onto the threshold (`smoke2` 88.9) |
| 89.7 | 117.7 | **10:05 · south lot** · `lot` (outside, low off the asphalt behind the van, pulling out) | `two:outside` 90.2; One out and both east along the wall behind the parked van, down on their knees covering the door they came out of (`out {one: true, two: true}` 92.5); One 'Control, Blue One — both out, south side, moving to the pickup. Nobody followed us out.'; held 7.5 s on the smoke standing in the sunlit doorway; `exfil:cut` 103.6 → `finish` → the runtime's veil 0.35 s, hold 0.5, restore (cast out, chaos null, day out, aftermath + smoke cleared, restartEncounter, camera / flags / input back) |

Show length 132.1 s (7928 frames); the drill's `cut` still on frame 1656 (27.6 s) — everything before it is what it was, frame for frame (§ 4).

## 2. What is scripted, what is real, what is guaranteed

- **Real:** every round (director.ts `stimulus.burst` → combat.ts `fireWeapon` with `steady` and the burst's own spread: hits, kills, suppression scalars, marks, heat, glass stars,
  hearing all follow), the kick, the charge and both cans (items on their fuses → detonateStun / the solver), the doors, destruction (decals, sheets, the dead monitor, dust puffs
  into the smoke solver, knock-offs, the tiles), the ragdolls and dropped rifles, the sun and every light. Who shoots whom is real: the four die when an operative's burst finds
  them, and the trace names the round (`Blue One→Red 1@44.2 · →Red 2@71.9 · →Red 4@78.4 · Blue Two→Red 3@93.5`, seed 11).
- **Scripted:** everybody's feet and muzzles (squad.ts's runner behind `Guard.script` — no perception either side; the shift is benched, Sam parked invisible in god mode as the
  breach always had him); WHERE the opposition's rounds go (places, § 3 of the script's LOUD table: `inOneCorr / inOneDoor / inOneDoorHi / inTwoMid / inTwoSouth`); WHEN a man is
  dropped (each hostile beat leans its man out on a claim/show handshake; the spine arms `h2Kill` / `h3Kill` on its clock and the next show is met by `drop()` = 4 rounds at the
  tracked chest at spread 0.006, then 4 at the head if he somehow stands — he never has); Red 4's reel out of his cap after the bang (a scripted man has no daze); the flinches
  (`GuardScript.flinch` on the opposition only: the animator's start throws a muzzle about for half a second, which is what amateurs' rounds may do — on the pair it sent aimed
  rounds into the manager's leaf).
- **Guaranteed:** the operatives cannot die — by DOCTRINE (no hostile round is ever laid through an opening a man of ours is beyond or along a line that runs up his post; the
  probe holds the nearest pass ≥ 0.45 m — measured 0.58 / 0.60 m on the two seeds) and by a NET (`LoadoutSpec.god` → `Guard.god`: fireWeapon's victim loop passes such a man as
  it passes a colleague; showcase casts only — the lint refuses it in a script with a play program). The downs are NOT forced: no killGuard by hand anywhere in the loud half; if a
  burst and its follow-up both failed the show would go on with the man up, One's count line would say so ('N down and they've gone quiet'), and day-run would go red. The show
  never hangs: every wait on a system is `untilT` with a clock, every leg has a cap that costs a log line, never the show.

## 3. What the Director grew (all defaults = what it was; documented at their sites and in director.ts's head comment)

`c.chaos(k | null)` (showcase-only, in `SHOWCASE_VERBS`; destruction.ts `Destruction.showChaos` read by `chaosOf` even under `touring`; `restoreChaos` nulls it in `exitShow` /
`handOver` before the restore) · `c.doors.kick(door, by, {leg})` + `c.doors.kickSpot(door, by)` (a cause: `anim.kickDoor` now, `Run.kicks` → doors.ts `kickIn` + kickDustFx +
kickScuff on the impact frame) · `c.doors.open(d, angle?, {hold})` (hold = `quietT −3600`: a leaf on its stay, its closer off for the program; Door.reset rearms it) · `c.order(u,
{aimAt: unit})` TRACKS the man (`Run.tracks`, his chest eased at 14/s into the ordered vector until the next aim order — was a one-off copy) · `OrderPatch.flinch` → `GuardScript.flinch`
(suppression.ts: the anim start alone on the rising edge for a scripted man ordered to; the AI's reactions untouched) · `LoadoutSpec.god` → `Guard.god` (combat.ts victim loop) ·
`LOG_CAP` 400 → 2500 (a day run is ~460 rows headless, ~530 in the page with the camera's rows; the probes read the whole run back at the end). Nothing in guards.ts / the AI changed; a level without the script is the game exactly.

## 4. Probe verdicts (headless, at HEAD)

```
sh tools/qa/gate.sh day director breach night   →  EXIT 0
  day · day-run: ALL PASS            seed 11 / 12: 132.1 s of show, loud at 28.03; 'loud → door:kicked → one:corridor → hostiles → contact → glass → h1:down → one:shift →
                                     one:door → h2:down → bang → h4:down → h3:down → radio:clear → smoke → one:in → smoke2 → out → exfil:cut' in order; rounds 83 / 165; all four
                                     dropped by an operative's round; nearest hostile pass 0.58 / 0.60 m; nothing NaN, ≤ 7 characters, ≤ 49/64 lights, camera pinned every frame
                                     and free after, all set-ups cut to; the two seeds land every loud beat 0.00 s apart
  day · day-destruction: ALL PASS    chaos read 0.8 under the show; decals 43 · puffs 130 · papers 2 (57 sheets) · screens 6 (1 lit dead) · knocks 2 · tiles 2 · panes starred 5;
                                     after the veil: showChaos null, chaosOf 0, no debris / hidden static, all 782 statics' flags as before, no decal / star / broken screen, no cast, night
  day · day-restore: ALL PASS        run to the end, and P at 62 s inside the firefight: breach-restore's own checks + chaos back + nothing broken left
  director · director-breach-digest: ALL PASS   the pre-port fixture's 46 beats (main @c988fb4) at their old frames in their old order — the first half frame-identical, cut@f1656 —
                                     nothing new at or before the cut — and the whole show's 60 beats identical to tools/qa/fixtures/day-beats-main.json (frozen on this branch, --write; two seeds)
  director-lint / showcase-scan / scheduler, breach-daylight / run / restore / tour, clear-doctrine, night-run / restore / tour: ALL PASS
bun run tools/qa/tour.ts --runs 1 --quiet  →  PASS ·  bun run build  →  ok ·  typecheck clean
```
breach-run's 'show length' window moved from 26‥48 s to 118‥150 s (it always ran the whole show); day-probes.ts holds the loud half's own beats. `trace --rounds` prints every
round's shooter, where it stopped, whom it went into and how near each operative it passed — the loop the marks were placed with (a blocked lane shows as rounds stopping at
x 23.0: the blocks' N–S spines take everything crossing a block under 1.4 m, which is why every lane in the LOUD table is a middle-aisle, south-aisle or corridor line).

## 5. GPU cost (M4 Max, high, 1368×770 internal → 1777×1000, serialized frames per CLAUDE.md 'GPU timing', union of the compute passes, GPU quiet before the take)

See the table filled in below (§ 5.1). The loud minute is the budgeted stress case: eight smoke domains live through the exchange (muzzle gas + destruction's dust puffs), ~2.5‥4.4 k
particle slots (brass, chips, fluff, sheets), 44‥49 lights uploaded (the flashes are transients).

### 5.1 numbers (docs/perf/day-showcase-high.json — one boot at high, `?paused`, GPU quiet before; ms, union of the compute passes; smoke = live solver domains, slots = particle pool)

| window (show s) | union mean | p50 | p95 | max | smoke dom | particle slots | lights | heaviest passes (mean ms) |
|---|---|---|---|---|---|---|---|---|
| NIGHT: the calm floor at the spawn (baseline, before the show) | 10.4 | 10.3 | 10.7 | 10.8 | 0 | 3.3 k (rain) | 37 | direct 3.8 · gather 1.1 · softblur 1.0 · sharpU 0.8 |
| day: the drill's approach — the sunlit floor, nothing in the air (5) | 15.6 | 15.7 | 16.1 | 16.2 | 0 | 0 | 45 | direct 5.6 · gather 2.0 · sharpU 1.4 · softblur 1.2 · probe 0.9 |
| **THE EXCHANGE — aisle trading, both sides firing (58‥63 = L 30‥35)** | **22.9** | 20.3 | **30.3** | 41.9 | 8 / 8 | 2.6 k (3.0 k) | 45‥49 | direct 6.2 · volumetrics 4.1 · smoke 2.9 · gather 2.2 · probe 1.35 · sharpU 1.25 |
| the charge's aftermath + the south aisle (81‥85 = L 53‥57) | 22.7 | 21.4 | 30.3 | 34.1 | 7‥8 | 4.4 k (4.6 k) | 44‥49 | direct 6.5 · volumetrics 4.1 · smoke 2.6 · gather 2.1 |
| smoke in the shafts (112‥116) | 17.4 | 17.4 | 17.8 | 18.4 | 3‥5 | 2.5 k | 44 | direct 4.8 · volumetrics 2.3 · gather 1.8 · smoke 1.2 |
| outside: the lot, smoke out of the door (124‥128) | 13.5 | 13.6 | 14.0 | 14.2 | 2‥3 | 1.6 k | 44 | direct 3.2 · volumetrics 2.2 · gather 1.6 |

The loud minute at high is ≈ 23 ms union with a p95 of 30 — the budgeted stress case ('~25 ms like the measured loud minute', docs/design/showcases.md), not past it: nothing was capped
for cost. Daylight itself is +5 ms over the night floor (the sun through direct + gather); the exchange adds +7 on top, most of it the eight live smoke domains (muzzle gas + destruction's
dust puffs: volumetrics 0.7 → 4.1, smoke 0 → 2.9) and a little direct (the flashes are lights). The character count is 7 throughout the loud half (the room's dead are gone).

## 6. Taste constants (one-liners for the maintainer)

- `c.chaos(0.8)` for the loud half (decision 6; default play stays 0.5) — levels/office.script.ts `loudHalf`.
- Cast: 2 operatives + 4 hostiles ('Red 1‥4' on the TANGO loadout: aks74u, olive over black); the room's three dead despawned at L 7 to make the budgets.
- Clocks `LT`: after 0.35 · kick 1.3 · radio 2.8 / 5.8 / 10.4 · spawn 7.0 · hGo 10.6 · h2KillAt 37 · bangAt 45 · h3KillAfter 9.5; the room hold 2.2 + 5.0 + 3.6 s; the smoke hold 6.0 s;
  the lot hold 7.5 s after the last line. Whole show 2:12 (the brief said ≈ 2:20‥2:40; the corridor could take another exchange, the lot another five seconds of smoke).
- Rounds: bursts of 2‥5 at cadence 0.10‥0.16 s, spread 0.012 (glass 0.005, drops 0.006 / 0.004, the paper burst 0.004); ≈ 83 operative / 165 hostile rounds a run.
- The words `LL` (radio + barks only, decision 2): eleven radio lines (One ×6, Two ×3, Control ×2) and eight barks.
- Framings `LS` (twelve, § 1); the reverse (`reverse`) and the glass insert (`glass`) are the two the stills argue for; `south` / `smoke` sit a hand inside the south wall by construction.
- Lasers stay ON for the pair (state 'search' since the drill's bang — combat.ts handProps): red lines down the aisle at the lens in the reverse; say if that reads as too much by day.
- The kicked corridor door is left to its closer (it swings back across One over L 4‥8 and hides him from the `door` set-up until it does) — pinning it open would pin the drama too.

## 7. What I did NOT do, and why

- **The 10:02 opening ('the floor': sun across the cubicles, the cleaner's cart, two staff at desks)** — the brief scoped this lane to the loud half; civilians are hidden under
  `touring` (`civiliansOnFloor`) and would need their own allowance like chaos got. The show still opens on the breach's establishing shot.
- **glassbreak on** — decision 5 is the maintainer's to judge; nothing forces it. With `?glassbreak` the same rounds go into annealed conference panes (glass.ts → glassBreak.hit) and
  one should hole; not verified by eye in this lane (the stills are with it off: stars).
- **A reload for the operatives** — the Director's burst rearms a dry gun silently (`tickBursts`); at ~40‥45 rounds a man in 30-round magazines One reloads by magic once. A visible
  reload wants a runner verb (guards.ts has the AI's); left.
- **The hostiles' own daze / suppression behaviour** — scripted men have neither; Red 4's reel is ordered, the flinch is the anim alone. Handing them to the AI (`drill.exchange`)
  makes the fight emergent and the operatives mortal — the opposite of a show that must peel back and exit.
- **STATUS.md / the board** — the lead's, at the merge.
- Not touched: guards.ts, the AI, the level JSON, any shader.
