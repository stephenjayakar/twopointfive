# Grab, interrogate, human shield (C7) + state-aware interrogation dialogue (C7b) — design

Design-only lane (`grab-design`), no code. Everything below is sized against the tree at `45582d6` and cites the code it
leans on. Where I say "today" I mean that commit; the input pass (STATUS §F C2–C6/C9/C10: Space = interact on the top-left
panel, LMB = melee when holstered, E = holster, Q = wall, C = crouch) is in flight in `player.ts`/`game.ts updateDoors`
and has not landed, so control bindings are given in the NEW scheme with a note on where today's F/hover path plugs in.

## 0. Headline findings (read these even if nothing else)

1. **Do not add `'held'` or `'ko'` to `GuardState`.** There are ~130 `state === 'dead'` / `!== 'dead'` tests across
   `guards.ts` (39), `soak.ts` (25), `player.ts`, `squad.ts`, `demo.ts`, `tour.ts`… every one of them means "is this man out
   of the picture". A held man is handled the way a scripted man is — an early branch at the top of `updateGuard`
   (`guards.ts:456` does exactly this for `gd.script`) keyed on a new `Guard.held` object, with his `state` left as it was
   (so his knowledge survives the hold). A choked/struck man IS `state = 'dead'` for every existing purpose (rollcall,
   lockdown roles, bodyInView, lasers, capsules) plus a new `downKind: 'shot' | 'struck' | 'choked'` that only the
   found-body line, the debrief and a future wake-up read. (`Guard.hold` already exists and means "scripted: stand your
   ground", `game.ts:137` — the new field must not be called `hold`.)
2. **The shield needs one real change in combat and one in the AI, and both are small and local.** (a) A guard's round
   only ever tests the player (`combat.ts:45`: `else { bodyHit(g.player.char …) }`) — colleagues are transparent to each
   other's fire, which muzzle discipline hides. The held man must be tested first in that branch. (b) Muzzle discipline's
   fallback when no side-step opens the line is to *push up the path toward Sam* (`guards.ts:651`,
   `st === 'none' && dist > LINE_PUSH_MIN_M → goTo(pc.pos)`); with a colleague pinned 0.4 m in front of Sam `lineGeom`
   gives t ≈ 0.93–0.97 → `lineStep` returns `'none'` every time → every observer walks straight onto the pair. A
   `standoff` branch has to intercept before that line.
3. **The light meter will drop while you hold a man between you and a light, and that is correct but dangerous for the
   AI.** The player's probes skip only `PLAYER_ID` capsules (`game.ts:442`, `probe.ts:34`, `common.wgsl:206
   occludedCapsules`), so the held body genuinely shades Sam's chest/head → `player.visibility` falls → `sightGain`
   (`guards.ts:130`) may never take a colleague facing the pair to 0.85. Colleagues must key off *the held man in view*
   (a `heldInView` twin of `bodyInView`, `guards.ts:141`, which already ignores lighting for corpses — precedent), not off
   Sam's meter. One model for picture and AI is preserved: they see their colleague, torch flailing, plainly.
4. **The takedown gate is the grab gate, verbatim** (`player.ts:652`: `dd < 1.05 && behind(cos < −0.25) && state !== 'alert'
   && !sprinting && !segmentBlocked && !segmentBlockedDynamic` at 1.0 m height). The `takedown-through-wall` probe
   (`tools/qa/probes.ts:358`) becomes a two-verb probe for free.
5. **Nothing drops on the grab; the torch stays in his raised hand.** `killGuard` drops the hand item (`combat.ts:118`) and a
   clatter is a `who: 0` noise colleagues investigate (`combat.ts:133`) — dropping on grab would make every grab semi-loud.
   Keeping it gives the renderer moment this project likes: a live spot light waving across the ceiling for as long as
   you hold him, going dark when he is choked out (the existing dropped-torch death, `guards.ts:745`). A man grabbed with his
   pistol drawn (heightened floor, `Guard.drawn`) keeps it too, pinned and useless — and has it in his hand if you let him go.
6. **"Use him at a keypad" already half-exists**: living guards' door contacts carry `key: true` (`game.ts:464`), so a held
   man walked into a locked leaf unlatches it. Keep it deliberately (message: "his key turns the lock"), it is the Chaos
   Theory retinal-scanner beat at zero cost. Listed as a verify-and-message slice, not new mechanics.
7. **There is no way back from a ragdoll** (`character.ts:768 ragdollize` sets `alive=false`, `update()` returns into
   `updateRagdoll` forever) and none of the 46 clips in the UAL library is a get-up (nearest: `Sitting_Exit`). "KO'd men wake
   after N minutes" is therefore not a cheap option; it is parked in §6 as future with what it would take.
8. **The dialogue system is a pure function over state the AI mostly already keeps** — `awareness/lastKnown/lastSeenT`
   (`game.ts:136`), `sightT` (faint glimpse, `game.ts:171`), `found/missedAt/missingRaised` (`game.ts:140–144`),
   `bodyDuty` (`:159`), `task` incl. `checkOn` (`:174`), `leader/post/drawn` (`:178`), `callsign` (`:135`), floor
   `escalation` + `rollcallState()` (`guards.ts:862`). What is missing is *event memory*: hearing leaves no trace but a
   decaying `awareness`, and nobody remembers having SEEN Sam shoot or drop anyone. Three fields fix it (§4.2). Estimated
   engine: ~2 days; the writing is the long pole and is the maintainer's.

## 1. Player verbs and states

### 1.1 Grab (from behind)

* **Offer**: same predicate as the takedown marker (`buildInteractables`, `player.ts:646–655`); the guard `Interactable`
  gains a second option. New scheme: the panel row for a guard in reach reads `SPACE grab him · LMB take him down`; C4 already
  puts the strike on LMB-when-holstered, so **Space = grab** is the primary (highlighted) row and the cross stays one click
  away. Pistol drawn: `SPACE grab him (pistol to his head)` — same verb, shield variant chosen by `pl.slot === 1 && !holstered`
  at grab time (today: `slot === 1`; after C3: the E-toggled holster flag). Today's plumbing: the `input.hit('KeyF') &&
  hover.kind === 'guard'` line in `game.ts:482` calls `startGrab` instead of `startTakedown`; takedown moves to `lmbHit()`
  in the slot-1-holstered branch of `updatePlayer` (`player.ts:183`).
* **Not offered**: alert guard ("no grab while he is onto you", as takedown), while `pl.dragging/kick/picking/takedown/wall`
  (grab calls `releaseWall`, `player.ts:418`, and drops a dragged body like `startTakedown` does, `:499–500`), crouched is
  fine to *start* from (you rise into it: `pl.crouch = false`), sprinting no.
* **Beat** (`startGrab/updateGrab`, mirrors `startTakedown/updateTakedown`, `player.ts:497–522`): t = 0 lock both (guard:
  `speed 0, path [], reactT ≥ 1`, bubble cut — if `gd.bubble` is younger than 0.8 s log it as killGuard does, `combat.ts:112`);
  0–0.25 s Sam closes to **0.38 m** behind on the guard's `bodyYaw` axis (takedown uses 0.55, `:513`) via the same
  `lerp + collidePlayer`; 0.25–0.45 s the guard is spun `+15°` and pulled upright, arm comes round (anim §3); at 0.45 s
  `pl.holding = { g, t, variant, talk, chokeT: -1 }`, `gd.held = { since: g.time, agitation0 }`. Sound: `bodyHit` at 0.35
  volume + a new short `grabMuffle`; hearing event `prop` level **0.12** at the pair (a scuffle the same room hears at ≤ 4 m
  through `hearingCheck`'s door/prop branch, `guards.ts:75` — quieter than the takedown thud's 0.3, `player.ts:518`).

### 1.2 Held state (Sam)

* **Movement**: `updateHold` replaces the free-movement block the way `moveOnWall` does (`player.ts:90`). Pace
  `T.playerWalk × 0.55 ≈ 0.85 m/s` forward/strafe, `× 0.45` backward (drag is `playerCrouch × 0.6 = 0.6`, `:97` — too slow to
  reposition a shield). No sprint (Shift = shove, below), no crouch (`C` ignored; CT never let you crouch with a body up), no
  Q. **Turning is rate-limited**: `bodyYaw` follows `aimYaw` at ≤ 2.6 rad/s (free aim eases at rate 16, `:160`) — a flanker
  who commits gets his half-second before the shield comes round. Sam faces the cursor; the guard is placed every frame at
  `sam.pos + fwd × 0.38`, `bodyYaw = sam.bodyYaw`, *before* `updateGuard` runs (update order is player → guards,
  `game.ts:407–408`, so the held branch in `updateGuard` only poses him).
* **Collision of the pair**: after `collidePlayer` (`player.ts:33`), run `col.collideCircle(guardPos, 0.3, 0.2, 1.7)`; if it
  moved him, translate Sam by the same delta and re-settle Sam (rigid pair, wall wins). `keepOffGuards` (`:245`) must
  `continue` on `gd === pl.holding.g` (it would shove Sam 0.55 m off him every frame, `KEEP_OFF`, `:22`). Other guards stay
  solid to Sam as today; the guards' own separation (`guards.ts:725`) pushes *them* off the held man — fine.
* **Doors**: Sam's contact + the held man's keyed contact both go in (`game.ts:462–464` unchanged) → plain doors push open
  ahead of the pair, **locked doors unlatch for his key** (finding 6; `g.msg` once per door). Door leaves shoving the pair:
  `settlePlayer` already re-settles Sam after `doors.update` (`game.ts:507`); the guard is re-placed from Sam next frame.
* **What ends the hold involuntarily**: Sam hit (`hitPlayer`, `combat.ts:137` → `releaseHeld('shot')`: the guard staggers
  free, §1.5), the held man killed by a round (§1.3), `cancelActions`/`teleportPlayer`/`restartEncounter`/`resetGuards`
  (`player.ts:718`, `guards.ts:769` — add `holding = null` beside `takedown = null`), the tour taking the puppet.
* **Light/AI side-effects while holding** (no code, just consequences to expect): meter drops when the light is ahead
  (finding 3); the rail light is off unless the shield variant is up; footsteps: Sam's step events continue at walk loudness
  0.35 (`:227`) and the guard's shuffling adds nothing (his `audio.footstep` is presentation only, `guards.ts:733`).

### 1.3 The shield (incoming fire)

* `fireWeapon(…, isPlayer=false)` (`combat.ts:45`): before testing the player, `bodyHit(held.char, muzzle, dir, tHit, contact)`;
  nearer hit wins. A hit **kills the held man** (`killGuard(g, held, dir, false, 'shot', by = shooter.id)`; `killGuard`
  gains `how` and `by` so `tally` (`combat.ts:116`, which assumes only the player kills) skips it and the debrief can say
  "shot by his own side: 1"). Sam is left holding a corpse for 0.3 s, then auto-release into the ragdoll (no shove).
  Recommendation: test **only the held man**, not all colleagues — muzzle discipline exists precisely so friendly fire never
  needs simulating; keep the model honest where the player can see it.
* Geometry check: guard spread is `0.05 + …` rad (`combat.ts:22`) ≈ 0.3 m at 6 m; the held cylinder is r 0.28 soles-to-crown
  (`character.ts:862`) 0.38 m ahead of Sam's → from inside ±50° of the pair's facing Sam's chest is fully masked, his head
  (offset ~0.12 m to the gun side in the hold pose) is not. From the flank both are open. That asymmetry is the game.
* Player fire in the shield variant (`combat.ts:44` loop over guards) must **skip the held man**: the muzzle sits beside his
  right ear, inside 0.28 m of his hip axis → `bodyHit`'s contact rule (`combat.ts:106`) would put Sam's own round in him.
* Lasers already stop on the nearest living body (`combat.ts:180`) → hunting men's dots sit on their colleague's chest. Free,
  and it reads.

### 1.4 Interrogate (Space while holding)

* Each **tap** of Space = one exchange: the panel's primary row is the *question Sam is putting* (text changes per stage:
  "make him talk" → "lean on him" → "ask what he knows" → "he's got nothing left", greyed), the guard answers in his bubble
  (§4). Presses are accepted when the previous bubble has ≤ 0.5 s left or after 1.2 s, whichever is later; a press during a
  line skips it to the end (sets `bubble.dur`). Sam's side optionally also goes to the log as `you ▸ where's your partner?`
  (`g.msg`) — cheap, and the maintainer may want to write those too.
  * **As built (Aug 8):** the exchange has two speakers. Sam's line goes up over SAM first (`dialogue.ts SAM_LINES` /
    `samLineFor`: opener · pressure · the ask — worded for the very thing the man is about to give when `peekGive` says he
    will · the last word to a dry man; coloured by the gun / arm variant, the floor and the man), a bubble in his own tint
    for `samBeat` (0.9‥1.4 s); the man's answer runs through `Game.interrogate` unchanged when it ends. A tap while Sam
    speaks does nothing; inside the first 1.2 s of an answer it only cuts the line short; after that it cuts in with the
    next question. Nothing on the man's side (stage, `given`) moves until he actually answers.
* **How many**: 3 staged presses (reaction → pressure → the one useful thing or the admission he has none) then an
  "exhausted" pool that can be tapped indefinitely (varied brush-offs, rising agitation). Stage never goes backwards for
  that man this encounter (`gd.talk.stage` persists through release/re-grab: "again?" lines).

### 1.5 Resolve

| verb | new-scheme input | time | noise (`events` level) | result |
|---|---|---|---|---|
| choke out | **hold Space ≥ 0.35 s**, or **LMB when holstered** (C4: LMB = melee) | 3.0 s (release early = abort, he gasps, agitation +0.2) | 0.15 during, 0.3 thud at the fold (= takedown, `player.ts:518`) | `killGuard(…, quiet=true, 'choked')` → ragdoll fold (`ragdollize quiet`, `character.ts:783`), torch drops and dies |
| pistol-whip KO | **hold Space** or a dedicated LMB *double-click* when drawn (single LMB fires past him) | 0.6 s | 0.35 | `killGuard(…, true, 'struck')`; a `Hit_Head` flinch on him first (clip exists, unused) |
| shove / release | **Shift** (consistent: Shift already drops a dragged body `:92` and steps off the wall `:89`) | 0.8 s stagger | 0.25 + whatever he then shouts | he stumbles 1.2 m forward (`anim.hit()` + root push through his own `collideCircle`), then §2.3 |
| fire past him | LMB, shield variant | — | 1.0 (a shot is a shot, `combat.ts:70`) | normal `fireWeapon` from the offset muzzle; the whole floor converges on a man holding a hostage — intended |
| holster / draw | E | 0.5 s | — | toggles variant; the left arm never leaves his neck |
| use his key | walk him into the locked leaf | — | door sounds as authored | finding 6 |

Panel while holding (one `Interactable` of a new kind `'held'`, always primary, built in `buildInteractables`; `line2` in
the existing two-space convention that `overlay.ts:17 parseOpts` splits): `SPACE  <question>  ·  hold SPACE  choke him out
(quiet)  ·  SHIFT  shove him off — he WILL shout  ·  E  pistol to his head` (drawn: `LMB  fire past him  ·  E  holster`).
Doors in reach still list below it as today (`deriveInteractions`, `overlay.ts:197`), and Space on a *door* row needs the
↑/↓ highlight from C6 — until that lands, doors are pushed open by walking the pair into them, which is what you do anyway.

### 1.6 Edge cases

Partner walks in → §2.2 standoff. Sam shot from a flank while holding → hold ends, one-hit rule unchanged (`Player.MAX_HITS
= 1`, `game.ts:97`) so this is simply death; with `godMode` the release path runs. Held man's leader/follower: pairing logic
reads positions only (`followLeader`, `guards.ts:1153`) — a follower whose leader is held closes up to "his station behind
him", i.e. walks to within 1.4 m of Sam's back and, per §2.2, sees the hold → standoff at point blank; good drama, no special
case. Grabbing a man mid-`bodyDuty`/`task`/`script`: `startGrab` clears `script` via `endGuardScript(gd, gd.state)`
(`squad.ts:92`; the live `Clearing` notices a man leaving his script and dissolves, `squad.ts:413/465`), nulls `bodyDuty`,
keeps `task` (he can talk about his errand). Dazzled man: grabbable under the identical gate (tempting to waive the from-behind
test while `time < dazzledUntil`; don't — finding 4 is worth more than the convenience). Tour/puppet: `g.puppet` set → hold
continues, Space taps come from `this.key('Space')`. Blackout mid-hold: nothing special. Restart under a hold: covered by `resetGuards`.

## 2. Guard side

### 2.1 The held man

`Guard.held: { since: number; variant: 'arm' | 'pistol'; chokeT: number } | null`. `updateGuard` order becomes dead → **held**
→ script → AI. The held branch: `speed = |pairVel|`, `anim.reverse` when Sam backpedals, `upper 'none'`, `stance 'none'`,
new `anim.heldPose = true` (§3), `c.update(dt)`, `attachFlashlight` (torch beam follows the flailing hand: `torchCarryDir`
reads the hand, `guards.ts:741`), **no perception, no hearing** (he knows exactly where you are; on release that is written
in directly, §2.3), awareness frozen. He does not answer the radio: `updateRollcall`'s `answers` filter (`guards.ts:956`) and
`silent()` (`:958`) gain `&& !x.held` / `|| !!x.held` — a held man is *asked for by callsign while you hold him*, which the
dialogue picks up (§4.5), and at `SEND` somebody is sent down his route toward you. `radioCaller`/`pickChecker`/`spokesman`
(`:869/:883/:813`) exclude him. `colleagueInLine` (`:332`) counts him (alive, not dead) — that is what makes them hold fire.

### 2.2 Colleagues: the standoff

New per-observer record `gd.standoff: { pair: Guard; since: number; side: -1|1; orbitGoal: Vec3|null } | null`, entered from
two places: (i) `heldInView(g, gd)` in the perception block next to the body check (`guards.ts:488`): held colleague within
14 m, inside the 60° chest cone, LOS from eye to the held man's chest — lighting ignored exactly as `bodyInView` ignores it;
(ii) hearing Sam fire from the hold (they converge as today and (i) fires on arrival). Entering: `awareness = 1`,
`lastKnown = pair`, `lastSeenT = now` (he has eyes on Sam's arm at least), state → `alert` through the normal transition
(`:535`, "CONTACT!" replaced by the standoff bark, §4.6), `witness.sawHeld = {who, t}` on the observer, and the first
observer radios it (`say(…, true)` + `raiseEscalation` is NOT called directly — the alert episode does that when it ends, as
for any alarm; a hostage is not a body).

Alert-branch behaviour while `standoff && pair.held` (inserted before `guards.ts:646`):
* **Never the push.** Hold ≥ 3.5 m: if nearer, back-pedal along −toPair 1 m (nav-checked like `lineStep` candidates, `:388`).
* **Fire rule**: aim point = Sam's *head*; fire only if `lineGeom(shoulder → head, held)` clears the held man's axis by
  ≥ `MUZZLE_CLEAR_M` (0.35) **and** the observer stands > 55° off the pair's facing. Inside that cone `muzzleDown` would drop
  him to low ready (`muzzleCheck`, `:353`); for the picture we want the pistol *up and silent*, so while `standoff` the pose
  override at `:729` uses `upper 'aim'`, `stance 'highReady'` when `muzzleDown` (reads as "gun on you, finger off").
* **Flank**: after 2 s without a line, pick `orbitGoal` on a 4.5 m circle round the pair at ±75° from the pair's facing
  (side = shorter walkable, `nav.findPath` length as `squad.ts:371 pathLen`), walk it at `guardInvestigate` with the aim held
  on the pair (twist clamp ±1.5 rad, `:722`, covers a perpendicular walk); re-pick every 2.5 s as Sam turns. Two observers
  take opposite sides (second man reads the first's `standoff.side`).
* **Barks** every 4–6 s from the standoff pools (§4.6), radio line once per observer per 20 s.
* **Exit**: hold ends (release/choke/kill) → `standoff = null`, ordinary alert with a fresh `lastSeenT` → they fire within
  `fireCd`. Sam breaks LOS through a door → ordinary chase (`leadFix`, `:280`) — they come through after him.
Knowledge gating holds: a man two rooms away who heard nothing knows nothing; one who hears "he's got Novak" on the net gets
`awareness ≥ 0.45, lastKnown = pair` like the body call-out does for non-finders (`:502–507`), not `sawHeld`.

### 2.3 The released man

`releaseHeld(why)`: `held = null`, stagger 0.8 s (`reactT = 0.8`, `anim.hit()`), then `awareness = 1, lastKnown = sam,
lastSeenT = now, sightPos/sightVel` seeded → `alert`. Torch man: `drawn` is floor-level today (`guards.ts:458`), so add
`gd.drawOverride = true` → pistol out after the stagger + 0.5 s draw → he is a point-blank shooter ~1.3 s after you let go.
Pistol man: has it in hand already → 0.8 s. Either way release is the loud, dangerous option by construction; its payoffs are
(a) shoving him into a colleague's line (he is a `colleagueInLine` body for ~1 s), (b) the dialogue showcase of a man who now
knows everything (K4, §4). `witness.wasHeld++` on him.

### 2.4 KO vs dead

Today there is no distinction: the takedown calls `killGuard(quiet=true)` → `'dead'`, tallied as `takedowns` not `kills`
(`combat.ts:116`), and `missionRating` (`game.ts:79`) only cares about kills/bodies/alerts — so scoring already treats the
cross as non-lethal. Make it explicit: `Guard.downKind`, set by `killGuard`'s new `how`; the cross becomes `'struck'`.
Readers: (1) body discovery line (`guards.ts:496`): "`{callsign}`'s down — he's breathing. radioing it in" vs "man down!"
(no kneel-and-check animation implied; the line carries it); escalation identical (CT: a sleeping guard found is an alarm). (2) `BODY_LINES` in the room clear
(`squad.ts:326`) get a breathing variant. (3) Debrief card: "knocked out N · killed M". (4) Radio check: unchanged — an
unconscious man fails the sound-off exactly like a dead one (`silent()` keys on `'dead'`). (5) Future wake-up reads it (§6).

## 3. Animation plan

All procedural, in the style of the existing layers (IK on a pose copy, blended through a mask; `character.ts:391–394`
conventions). The two bodies are kinematically locked at a fixed offset and yaw, so **cross-character contact points are
constants in each figure's model space** — no bone hand-off between characters is needed, which is what makes this cheap.

| piece | who | how | reuses | effort |
|---|---|---|---|---|
| grab reach + spin (0.45 s one-shot) | Sam | `grabT` clock like `strikeT` (`:231`); left hand IK along a 3-key `curve3` path (hang → past his left shoulder → throat point `[0.06, 1.47, 0.40]`), right hand to his right upper arm `[-0.24, 1.32, 0.33]`; chest yaw −12° → 0 | `throwLayer`'s keyed hand paths + `swivelPole` (`:61`, `:667`), `armsMask` | 0.75 d |
| hold idle / walk, arm variant | Sam | `holdLayer(w)`: both hands IK-held at those constants every frame over whatever the legs do (walk/back-pedal cycles untouched, feet not re-planted); spine pitched +4°, head yawed 20° to the gun side (he looks past the man's ear: `lookAt`, `:420`); fingers via `hand()` (`:401`) | `lockpickLayer` structure (`:594`) minus the crouch | 0.5 d |
| hold, pistol variant | Sam | `STANCES.shield = { fwd 0.34, up 0.13, side −0.27, pitch 0, lean 3, tuck 0.5 … }` solved by a **one-handed** `carryArms` (right arm through `armRMask`, `:211`, which exists; left stays on the throat); aim/fire clips are two-handed, so while `holding` the aim layer weight is forced 0 and `gunDir = aimDir()` still drives muzzle/light/laser (`:757–759`) | `carryArms` (`:461`), stance springs | 1 d |
| held pose (standing/walking/back-pedal) | guard | `heldLayer(w)`: neck pitch −14° (head pulled back), spine1–3 pitch −3° each (arched), clavicles up 8°; **torch/pistol hand** IK'd up and out `[−0.32, 1.55, 0.15]` with a slow ±6 cm wander (the beam on the ceiling), left hand clawing at the forearm across his throat `[0.10, 1.42, 0.30]`; legs = his own walk cycle at pair speed, `reverse` mirrored from Sam | `signalLayer` arm IK + staggered envelopes (`:543`) | 0.75 d |
| struggle idle | guard | additive noise on the above: shoulder roll ±4° at 0.7 Hz, a 0.2 s jerk every 3–6 s (seeded), amplitude × agitation (§4.3) — the body language matches the lines | — | 0.25 d |
| choke-out (3 s) | both | Sam: left elbow closes (throat target moves 6 cm toward his own chest), lean back 6°; guard: hands both to the forearm, knees soften (`squat` 0.05→0.12 via the stance spring trick, `:445`), head lolls at 2.4 s; at 3.0 s `ragdollize(quiet)` with `dir = −pairFwd × 0.3` so he folds at Sam's feet, not away | stance `squat`, `ragdollize` (`:768`) | 0.5 d |
| pistol-whip | Sam + guard | Sam: `Punch_Jab` clip on `armRMask` (clip exists, unused) retimed to 0.6 s; guard: `Hit_Head` (exists, unused) then `ragdollize(quiet)` | one-shot clip layering as `strikeT` (`:364–369`) | 0.25 d |
| release shove | both | Sam: `Push_Loop` first 0.4 s on `armsMask` (exists) or the jab; guard: `anim.hit()` + root velocity 1.5 m/s decaying, his own `collideCircle` | `Hit_Chest` layer (`:370`) | 0.25 d |
| viewer page | — | "Grab" section: second mannequin at the offset, buttons grab / hold-arm / hold-pistol / choke / whip / shove, sliders for the six contact constants → "copy constants" into a `HOLD` block in `rigProps.ts` like `RIG` | viewer patterns | 0.5 d |

Total animation ≈ 4.75 days, of which the arm-variant hold + held pose + choke (2 d) are needed for slice 1 to read; the
rest can trail. Nothing needs a new clip; three unused library clips (`Punch_Jab`, `Hit_Head`, `Push_Loop`) get used.
Ragdoll hand-off for the drop is the existing `killGuard → ragdollize(quiet)` path — the choke only changes `dir` and delays it.

## 4. The dialogue system (C7b)

### 4.1 State available today, per guard (file:line)

`awareness`, `lastKnown`, `lastSeenT` (last *real* sighting, −100 never) — `game.ts:136`; `sightPos/sightVel/sightT` (last
*faint* glimpse, −100 never) — `:171`; `sawPlayerThisFrame` `:166`; `state` `:133`; `callsign` `:135`; `routeI` `:136` (→
`level.routes[i].name`: corridor / cubicles / lobby_break, `level.ts:610–612`); `found`, `missedAt`, `missingRaised` `:140–144`
(the floor's knowledge of *him*); `bodyDuty {body, role finder|called, stage}` `:159` (he stood over / was called to a named
body); `sawBodyT` `:167`; `task` (`breaker | rack | checkOn{who}`) `:174`; `drawn`, `leader`, `post` `:178`; `dazzledUntil`
`:165`; `shots`, `reloadT` `:164` (he has fired at you); `muzzleDown/lineBarkT` `:148`; `bubble` `:139`. Floor: `g.escalation`,
`g.escalationT`, `g.alarm {episode, pos, placed, raisedAt}` (`game.ts:217–218`), `rollcallState(g) {nextAt, stage, caller,
missing, checks}` (`guards.ts:859`), `g.blackout`, `g.mission {stage, pulled, sweepAt}`, `g.clearing` / `g.clearedAt`, doors'
`lockBroken/noticed` (`doorTamper`, `guards.ts:163`).

What is **not** there: any memory of *what he heard* (hearingCheck raises `awareness` and moves `lastKnown`, `guards.ts:39–85`,
then it decays at 0.1/s on patrol, `:530`); any memory of having *seen Sam act* (kill, takedown, grab); peak awareness; how
he came to be alert (sight vs sound vs net).

### 4.2 Fields to add (three, all written where the event already happens)

```ts
/** What this man has personally perceived this encounter — written at the event, read only by dialogue / debrief. */
witness: {
  heard: { shots: number; lastShotT: number; kick: number; bang: number; small: number; smallWhere: Vec3 | null };  // hearingCheck, at each awareness raise
  peakAwareness: number; alertedBy: 'sight' | 'sound' | 'net' | 'body' | 'held' | null; alertT: number;              // the :535 transition
  sawAct: { kind: 'shot' | 'struck' | 'choked' | 'grab'; victim: Guard; t: number } | null;                          // killGuard / startGrab: for each living o ≠ victim with actInView(o, victim.pos)
  sawBody: Guard | null; calledToBody: Guard | null;                                                                // :494 finder / :506 called
  sawHeld: { who: Guard; t: number } | null; wasHeld: number; dazzled: number;                                       // §2.2 / releaseHeld / detonateStun :242
}
talk: { stage: number; said: Set<string>; lastT: number };   // interrogation progress, survives release/re-grab
```
plus a level-side constant `TEMPERAMENT: Record<callsign, 'steady' | 'nervy' | 'hard'>` next to `CALLSIGNS` (`game.ts:128`;
proposal: Kowalski steady, Novak nervy, Reyes hard, Okafor steady, Lindqvist nervy, Brandt hard). `actInView(o, p)` is
`bodyInView`'s geometry against a point (12 m, 60° cone, LOS) OR `o.sawPlayerThisFrame` at that instant — a man who is
watching Sam when Sam fires saw the shot even if the victim is round a corner from him ("saw you shoot", not "saw him fall").

### 4.3 Axes

* **Knowledge of you, K0–K4** (highest true wins): K4 `sawAct || sawHeld`; K3 `lastSeenT ≥ 0 || alertedBy === 'sight'` (he
  had you clearly enough to be licensed to shoot); K2 `sightT ≥ 0` (a glimpse moved his fix) ; K1 `heard.shots + kick + bang
  > 0 || heard.small > 0 || alertedBy === 'net' | 'body'` (knows *someone* is here); K0 otherwise — never perceived you.
* **Agitation A ∈ [0,1] → calm < 0.3 ≤ rattled < 0.6 ≤ panicked**: `0.22·escalation + 0.3·[sawAct] + 0.2·[sawBody] +
  0.12·[calledToBody] + 0.15·[heard.shots>0] + 0.1·knownMissing + 0.2·[alert within 60 s] + 0.1·[variant pistol] + heldTerm +
  bias`, where `heldTerm = +0.04 per 10 s held` for nervy, `−0.03 per 10 s` for steady/hard (they settle), `bias` = nervy +0.15,
  hard −0.1; +0.2 for an aborted choke. Also drives the struggle amplitude (§3) so body and mouth agree.
* **Temperament T**: steady (professional, bargains, gives facts plainly at stage 3), nervy (over-talks, gives the fact at
  stage 2, unreliable extras), hard (defiant; gives the fact only at A ≥ rattled — the pistol variant is what gets him there —
  else his stage 3 is a refusal). For hard, "panicked" pools are written as cold fury, not pleading.

### 4.4 Selection

Line record: `{ id, k: K|'*', a: Bucket|'*', t: T|'*', stage: 1|2|3|'x', text, needs?: Need[], w?: number }` in a new
`src/game/dialogue.ts` (data + picker; no game imports beyond types). `needs` are fact predicates by name (`'lockdown'`,
`'missingKnown'`, `'sawShot'`, `'sawTakedown'`, `'heardShots'`, `'blackout'`, `'heldLong'`, `'reGrab'`, `'rollcallAskingMe'`,
`'partnerKnown'`, `'drivePulledKnown'` …) evaluated against `(g, gd)`; a line is eligible iff cell matches (exact or `*`) and
all needs hold and every `{token}` it uses resolves non-empty. Pool = eligible lines for `(K, A, T, stage)`; if empty, widen
T→`*`, then A→`*` (never K — knowledge is the one axis that must not leak). Weight = `w · (said.has(id) ? 0 : 1) ·
(recentGlobal.has(id) ? 0.25 : 1) · (needs.length ? 1.6 : 1)` (specific beats generic). Pick with the game's seeded stream
(`fxSeed`-style counter, `game.ts:233`) so soaks replay. **Stage 3 is special**: first try the INTEL generator (§4.5); if he
knows nothing useful *or* T/A say he will not give it, fall to the stage-3 "nothing / refusal" pool. Stage ≥ 4 → `'x'` pool.
Colleague standoff barks and the KO/breathing body lines go through the same picker with their own `stage` keys
(`'standoff'`, `'standoffRadio'`, `'foundKO'`), so temperament colours the whole floor's speech over time, not just the hostage's.

Tokens (resolver table, each returns `string | null`): `{partner}` (lockdown leader/follower, else the `checkOn.who` he
walked for, else the roster neighbour), `{partnerRoute}`/`{hisRoute}` ("the corridor", "the cubicle farm", "the lobby and
break room" — a 3-entry prettifier over `route.name`), `{room}` (a `roomName(p)` over `clearPlans[].bounds` + the mission's
`serverRoom` rect + corridor/lobby/lot rectangles — new 15-line helper, also useful to barks), `{victim}`, `{missing}` (first
guard with `missedAt ≥ 0 || missingRaised`), `{bodyName}`, `{caller}` (`rollcallState.caller`), `{checkEta}` ("a minute or
two" / "any second" from `nextAt − time`, coarse on purpose), `{chokepoint}` (nearest `level.chokepoints` name), `{door}` (a
`locked` door whose frame is within 3 m of any waypoint of his route: server/storage for corridor, none for cubicles),
`{heardWhere}` (`roomName(heard.smallWhere)`), `{n}`.

### 4.5 INTEL: what he can give, gated by what he plausibly knows

Ordered by usefulness; the generator returns the first item that is *true now*, *known to him*, and *not yet given*:
1. **Radio-check cadence** — always known (it is his routine): "check every {90|45} s-ish, next in {checkEta}; no answer →
   they send someone down the silent man's route" (true: `ROLLCALL_*`, `guards.ts:848–850`, `sendCheckOn :892`). Tells the
   player how long a choked man stays unnoticed. If `rollcallAskingMe` (R.stage==='asked' && R.missing===him while held): the
   urgent variant.
2. **Where the others are supposed to be** — his own route + `{partner}`'s; in lockdown, the pair/post deal (`assignLockdown`,
   `:1123`: "they pair the two nearest, third man takes the junction nearest the last scare" — he knows the drill, and
   `{chokepoint}` resolves to where the post man actually stands if `gd.post`/colleague `.post` is set).
3. **Keys/doors** — only if `{door}` resolves for his route: "{door}'s keyed, we all carry one" (→ finding 6 as a hint).
4. **What the floor knows about you** — only facts he has: `missingKnown` ("they can't raise {missing}"), `calledToBody`,
   lockdown clears (`g.clearing` summary: "{partner} and … are doing the rooms off your last position, {room} first" — only if
   he heard the order, i.e. he was alive and not held when `planClears` ran: timestamp compare), drive pulled (`m.pulled &&
   sweep sent`: "rack six dropped off, they sent {who}").
5. Nothing — K0 calm men often genuinely have only (1) and (2); that is the design, not a gap.
Never: door codes (there are none — locks are keys), the drive's location before it is pulled (IT's business, flavour only),
anything about Sam he did not perceive.

### 4.6 Surfacing

`say()` (`guards.ts:762`) with two tweaks: an optional `dur` (interrogation lines run `clamp(1.2 + 0.07·len, 2.5, 6.5)` s
against today's 4 s cap) and the log prefix = callsign for held/standoff speech ("Kowalski: …" instead of "guard: …"). Bubble
CSS `max-width 190px` (`index.html:176`) → 240 px for `.bubble.held`. Hard limits for writers: **≤ 90 characters, one
sentence or two fragments, no line depends on a previous line having been shown** (pools are sampled, not sequenced), tokens
only from the table above. `bubbles.ts:16` hides bubbles of `'dead'` men — correct (a choked man's last line is cut; log it as
`killGuard` does).

### 4.7 Worked sample — DRAFT PLACEHOLDERS for the maintainer to rewrite in their voice

(cell = K/A/T, stage; `*` = any; needs in brackets. ~45 lines spread over the matrix, including the two cases from the note.)

**K0 — never knew you were there (startled, knows nothing)**
1. K0/\*/steady s1 — "Wh— okay. Okay. I'm not moving."
2. K0/\*/nervy s1 — "Jesus— where did you— don't. Please don't."
3. K0/\*/hard s1 — "…You're making a mistake, friend."
4. K0/calm/steady s2 — "I don't know who you are. I walk {hisRoute}. That's the whole job."
5. K0/\*/nervy s2 — "I didn't see you, I haven't seen your face, I don't want to."
6. K0/\*/hard s2 — "You want the tour, ask at reception."
7. K0/\*/steady s3 [intel:routes] — "It's me on {hisRoute}, {partner} has {partnerRoute}. That's everyone till six."
8. K0/\*/nervy s3 [intel:rollcall] — "They call a radio check every couple of minutes. I don't answer, they come looking. That's all I know."
9. K0/rattled+/hard s3 [intel:door] — "…Fine. {door}'s keyed. We all carry one. Use mine and go."
10. K0/calm/hard s3 (refusal) — "Nothing. I've got nothing for you and you know it."
11. K0/\*/\* x — "I've told you. I just do nights."
12. K0/\*/nervy x — "Please. My arm. I answered you."

**K1 — heard something, never saw you**
13. K1/\*/steady s1 [heardSmall] — "So that was you. By {heardWhere}. I called it nothing."
14. K1/\*/nervy s1 — "I knew it— I knew I heard something—"
15. K1/\*/hard s1 — "Should've trusted my ears."
16. K1/\*/\* s1 [heardShots] — "Those were shots. That was you? …Who's down?"
17. K1/\*/steady s2 — "{partner}'s going to love this. I told him it was the vending machine."
18. K1/rattled/\* s3 [intel:lockdownDrill] — "After a scare they pair us and put a man on the {chokepoint}. You won't walk out the front."

**K2 — glimpsed you**
19. K2/\*/steady s1 — "Something moved in {room}. I told myself it was the light."
20. K2/\*/nervy s2 — "You were right there. I walked past you. Oh, god."
21. K2/\*/hard s2 — "Next time the torch goes on you properly."

**K3 — saw you clearly / hunted you**
22. K3/rattled/steady s1 — "Everyone on this floor is looking for you. You know that."
23. K3/panicked/nervy s1 — "They're coming— they're all coming, you heard the radio—"
24. K3/\*/hard s1 — "You're the one from {room}. You don't leave this building."
25. K3/\*/steady s2 — "Walk away now and I stay quiet for one minute. That's the offer."
26. K3/\*/steady s3 [intel:clearing, lockdown] — "It's locked down. {partner}'s clearing rooms off your last position. {room} first."
27. K3/\*/\* x — "That's it. That's everything. Do what you're going to do."

**K4 — saw you hurt someone (agitated, hostile, names it)**
28. K4/\*/steady s1 [sawShot] — "You shot {victim}. I watched you do it. Don't talk to me."
29. K4/panicked/nervy s1 [sawShot] — "Oh god. {victim}— is he— you didn't have to do that—"
30. K4/\*/hard s1 [sawShot] — "{victim} has kids. Remember that when they find you."
31. K4/\*/steady s1 [sawTakedown] — "Is {victim} breathing? …Tell me he's breathing."
32. K4/\*/steady s2 — "What do you want from me? You've shown me what you are."
33. K4/rattled+/nervy s2 [intel:rollcall] — "Okay! Okay. Check's in {checkEta}. When {victim} doesn't answer they send someone round. That's all I have."
34. K4/\*/hard s3 (refusal) — "No."
35. K4/\*/nervy x — "Please. I answered. Please."

**Floor-state colour (any K; `needs` do the gating)**
36. \*/\*/steady s2 [missingKnown] — "{missing} hasn't answered in a while. That was you as well, wasn't it."
37. \*/\*/hard s2 [lockdown] — "Hear that? Pairs. Doors. You're in a box now."
38. \*/\*/hard s2 [calledToBody] — "I stood over {bodyName} ten minutes ago. I'm not telling you a thing."
39. \*/\*/steady s2 [calledToBody] — "After {bodyName} they said weapons out. Should've listened."
40. \*/\*/\* s2 [blackout] — "You did the lights too? …Course you did."
41. \*/\*/steady x [heldLong] — "My arm's gone dead. Whatever this is, finish it."
42. \*/\*/\* s1 [reGrab] — "Again? —okay. Okay. Same as before. I'm not fighting."
43. \*/\*/\* s\* [rollcallAskingMe] — "That's me they're calling. I don't answer, {caller} sends someone down {hisRoute}."

**Colleague standoff (speaker = observer; stage 'standoff' / 'standoffRadio')**
44. steady — "Let him go. Let him go and we talk about it."
45. nervy — "{victim}! —I can't— I haven't got a line—"   (`{victim}` = the held man here)
46. hard — "You've got nowhere to take him."
47. radio, \* — "he's got {victim} — {room}. nobody push him."

**Found KO'd body (stage 'foundKO', replaces 'man down!')**
48. steady — "{bodyName}'s down— he's breathing. Radioing it in."
49. nervy — "It's {bodyName}— he's alive, he's alive— somebody get up here."

## 5. Harness plan (`tools/qa/`)

Probes (`probes.ts`, each a staged situation like `takedownThroughWall :358` / `armAlert :1343`):
1. **`grab-gate`** — the three through-wall cases of `takedownThroughWall` plus an open-floor positive and an alert-guard
   negative: the guard row offers grab iff it offers takedown; after `startGrab` + 60 frames the pair stands on Sam's side of
   the wall, guard `held`, 0.38 ± 0.03 m apart, same yaw.
2. **`shield-blocks`** — pair at a fixed spot; a parked observer made alert (`armAlert`) at 6 m, bearings 0°/30°/60°/90°/150°
   off the pair's facing; call `fireWeapon(g, obs.char, samChest, false)` 40× per bearing (seeded): report hits on held vs Sam.
   PASS: 0°–30° Sam hits = 0; 90°+ Sam hits > 0.
3. **`standoff-discipline`** — same staging but let the AI run 20 s per bearing: PASS: `obs.shots === 0` whenever
   `lineGeom(shoulder→samHead, held).d < clear` at any frame he could have fired; at 90° he fires within 6 s; he never comes
   inside 3.3 m; with two observers their `standoff.side` differ.
4. **`ko-rollcall`** — choke guard 0, park the rest deaf/blind on their routes, run to the next check: PASS: `R.missing ===
   g0`, a checker is sent, `checkOnDone` raises 'missing'; variant: hold (not choke) g0 across a check → he is not in `answers`
   and is asked for by callsign; release him → next check idles normally.
5. **`dialogue-gating`** — no world needed beyond `standUp()`: synthesize witness vectors for the 5 K levels × 3 A × 3 T, run
   the picker 300× per cell over all stages (seeded): PASS: no picked line's `k` exceeds the guard's K; every token resolved
   non-empty; no `id` repeats within one guard's session until its pool is exhausted; the INTEL generator never emits item 3
   for the cubicles man (no keyed door on his route) nor item 4's clearing line for a man grabbed before `planClears` ran.
   Plus a **lint** over the line table at load (dev only): unknown tokens, unknown needs, > 90 chars, duplicate ids.
6. **`hold-doors`** — walk the pair into `server` from the corridor: the leaf unlatches (his key), message shown once; into
   `conference` (unlocked): pushes open; a leaf slammed into the pair (stage a guard bashing through) → hold survives or ends
   with 'pushed apart', never a man inside the leaf/box (`clipWatch`, `probes.ts:598`, extended to the held man).

Soak (`soak.ts`): stimuli `grabNearest` (teleport 0.6 m behind a calm guard facing away, `startGrab`), `interrogate×k`,
`choke`, `whip`, `shove`, `fireFromHold`, `shotWhileHolding` (direct `hitPlayer` under godMode off/on); invariants: at most one
`held` and `player.holding?.g === thatGuard` both ways; held ⇒ no `script`, no path progress, not inside statics, within 0.5 m
of Sam; hold cleared by down/restart/reset/teleport within the frame; no observer fires a round whose segment passes within
`clear` of a held colleague (checked at each `guardShot` event); `downKind` set on every `'dead'` man; talk stage monotone per
guard; barks/min budget unchanged (interrogation lines excluded from the repeat-smell counter or it will flag the 'x' pool).
Tour (`tour.ts`): if slice 8 lands, assert the stop's guard ends `dead/choked`, Sam `hitFlash` never spikes, ≥ 2 lines said.

## 6. Staging — mergeable slices, effort, files (for laning)

| # | slice (each shippable + testable alone) | effort | files | lane notes |
|---|---|---|---|---|
| **1** | **Grab → hold (arm variant) → choke-out.** Space/F on the guard row grabs (takedown → LMB), slow paired movement with turn limit + pair collision, hold-Space/LMB chokes (3 s) into the existing quiet ragdoll; torch stays lit in the raised hand; `Guard.held` early branch; `keepOffGuards` exemption; rollcall exclusion of held; crude `holdLayer`/`heldLayer`; panel row. Colleagues react as today (they see Sam or don't). Probes 1, 4(hold variant), 6. **This already reads in the game.** | 2.5 d | `player.ts` (startGrab/updateHold/releaseHeld, interactables, keepOff), `game.ts` (Player.holding, Guard.held, Interactable kind, reset paths), `guards.ts` (held branch ≈ 25 lines at :456, rollcall filters), `character.ts` (2 layers), `overlay.ts` (strings only), `index.html` (.bubble.held), probes | **serial with the input pass** (same functions in player.ts / updateDoors) — land after it, or write against F and let the pass move it |
| 2 | KO vs dead bookkeeping: `killGuard(how, by)`, `downKind`, cross = 'struck', found-body + BODY_LINES breathing variants, debrief columns. Probe 4 (choke variant). | 0.75 d | `combat.ts`, `guards.ts` (:496, BODY cap), `squad.ts` (:326), `mission.ts`/`menu.ts` debrief, `player.ts` (takedown call site) | small; can go before 1 |
| 2b | `witness` record + `TEMPERAMENT` table, written at the existing event sites, read by nobody yet (panel debug row prints it). | 0.5 d | `game.ts` (field), `guards.ts` (hearingCheck :39–85, :494/:506, :535), `combat.ts` (killGuard, detonateStun :242) | unblocks 5 in parallel with 3 |
| 3 | Human shield proper: guard-branch hit test on the held man, player fire skips him, `heldInView` + `standoff` behaviour (hold ≥ 3.5 m, fire rule, orbit, radio), placeholder barks. Probes 2, 3; soak stimuli. | 2 d | `combat.ts` (:44–45, killGuard by), `guards.ts` (perception block :488, alert branch before :646, pose override :729) | serial after 1 (guards.ts alert branch — same region the AI lanes keep touching: schedule when no aim/muzzle lane is open) |
| 4 | Pistol variant + E toggle while holding + fire-past-him + pistol-whip KO; one-handed `carryArms`, `STANCES.shield`; viewer "Grab" section with the second mannequin and copy-constants. | 1.5 d | `character.ts`, `viewer.ts`, `rigProps.ts` (HOLD block), `player.ts` (small) | **parallel lane** (character.ts + viewer, like wall-pose) once 1 has fixed the contact constants' names |
| 5 | Dialogue engine: `dialogue.ts` (table format, needs/tokens resolvers, K/A/T functions, picker, INTEL generator, lint), Space staging + panel question text, `say(dur)` + callsign prefix, `roomName()`. Ships with the ~45 draft lines. Probe 5. | 2 d | new `src/game/dialogue.ts`, `guards.ts` (say signature), `player.ts` (tap handling), `overlay.ts`/`bubbles.ts` (class), `level.ts` (room rects export if needed) | parallel with 3/4 after 2b; only touchpoint in guards.ts is `say` |
| 6 | Writing pass: fill the matrix (target ~250 lines: 5 K × 3 T × stages with A variants where they matter + floor-colour + standoff + foundKO), Sam's question strings, retune durations. | maintainer, ongoing | `dialogue.ts` data only | no collisions |
| 7 | Release/shove: stagger, `drawOverride`, instant-witness K4 lines, shove-into-line. Soak stimulus. | 1 d | `player.ts`, `guards.ts` (release → alert seed, drawn override at :458) | after 3 |
| 8 | Tour stop: grab the cubicles man at stop 4's spot, two taps, choke, drag — extends the takedown+drag beat (`demo.ts:104–110`) using `this.key('Space')`. | 0.5 d | `demo.ts`, `tour.ts` assertion | after 1+5 |
| 9 | Future / say the word: (a) held man forced to answer the check ("all quiet") buying one interval, nervy men fluffing it; (b) wake-up after N min — needs `Character.revive()` (drop `ragdoll/rd`, `alive = true`, pose blend from the baked ragdoll pose to `Crouch_Idle` over ~1.2 s while lifting the pelvis, then `Sitting_Exit`-ish rise; ≈ 1.5 d and it will look procedural), then `state = 'suspicious'`, radios "…something hit me", floor +1; (c) friendly fire for all colleagues (flagged); (d) player speech bubbles. | — | — | — |

Critical path to "grab a man, hear him talk from his actual state, choke him out, watch the floor deal with it": 2 → 1 → 2b →
(3 ∥ 5) ≈ **7.5 working days** of engineering, then writing. Slice 1 alone (2.5 d) is the smallest thing that reads well.

## 7. Where today's code will fight this (so nobody is surprised)

1. `GuardState` sprawl (finding 1) — resist new states; `held`/`downKind`/`standoff` are side records.
2. `combat.ts:45` guard rounds test only the player; `killGuard` (`:116`) assumes player agency; `bodyHit`'s contact rule
   (`:106`) will shoot the hostage with Sam's own gun unless the loop skips him.
3. `guards.ts:648–653` muzzle-discipline fallback walks the shooter onto the pair; `lineStep`'s `t > 0.97 → 'none'` (`:380`)
   guarantees it at range.
4. Light meter shading by the held body (finding 3) — colleagues need `heldInView`; do not "fix" the probe.
5. `keepOffGuards` (`player.ts:245`) vs a 0.38 m hold; and `KEEP_OFF`-based bump perception in `squad.ts:359` (`< 0.62 m ⇒
   awareness 1`) — irrelevant to the held man (no perception) but a scripted colleague brushing the pair will light up: fine.
6. Rollcall treats every non-dead man as answering (`guards.ts:947/956/958/965/978`) — five predicates to touch, keep them
   in one helper `answersRadio(x)`.
7. `Interactable.line2` is a display string parsed back into rows (`overlay.ts:15–28`); the held row's five options fit the
   convention but "hold SPACE" as a key label relies on the two-space split — if the input pass introduces structured options,
   build the held row on that instead.
8. `say()`'s 4 s cap and 190 px bubbles (`guards.ts:763`, `index.html:176`); `bubbles.ts:16` keys bubble colour off `state`
   — a held man mid-'patrol' state speaks in calm green while terrified: add `.held` styling keyed off `gd.held`.
9. `Guard.drawn` is recomputed from the floor level every frame (`guards.ts:458`) — a released torch man drawing his pistol
   needs an override flag or he re-holsters next frame.
10. `demo.ts:108` presses `KeyF` on `hover.kind === 'guard'` for the takedown beat — whichever verb ends up primary on that
    row changes what the tour does; pin the beat to an explicit call (`startTakedown`) when slice 1 lands.
11. `resetGuards` (`guards.ts:768–776`) rebuilds `Guard` objects: `witness`/`talk` die with them (correct), but `player.holding`
    must be nulled there beside `takedown` (`:769`) or Sam holds a man who no longer exists (the `updateTakedown` guard at
    `player.ts:510` exists for exactly this history).
12. The soak's "nobody stuck 4 s while ordered to move" smell will fire for standoff observers holding position by design —
    tag `standoff` as a purposeful stand like `pinned`.
