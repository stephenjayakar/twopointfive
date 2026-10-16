# Rifles — carbines for the guards, suppression both ways, and a slimmer SC-20K (design, rev 2)

Design-only lane (`rifles-design`, reworking `f2000-design`'s doc), no code. Sized against the tree at `8ded9ea` ("today"); every claim
cites the code it leans on. Rev 1 was an SC-20K-for-Sam design with four launcher loads, a sticky-camera view and CS gas in the smoke
solver. The maintainer's answers (§0) move the centre of gravity: **the rifles that matter are the guards'**, and **the mechanic that
matters is suppression** — the guards' bursts pinning Sam, Sam's rounds pinning them — with the SC-20K cut down to the rifle, a foregrip and
the ring-airfoil launcher. Rev 1's analysis is kept (findings that still bear are in §1; the cut attachments, the sticky-cam cut/PiP study
and the gas-in-the-solver study are in Appendix B, not deleted). The plan is re-sliced into lanes R0–R7 that can run in parallel (§10).

## 0. What the maintainer decided (verbatim) and what it does to the plan

> "fn2000 feedback — i think the main value of this is to give guards some rifles (maybe more AK variants depending on our setting) rather
> than us. and the main value for us is suppression (which we'll want to simulate for the guards). 1. so it's okay if it's not materially
> louder than the pistol in our demo. 2. let's only have the ringfoil and foregrip as secondaries, keep it simple"

Decided separately the same morning: **dropped magazines / weapons are not lootable** ("we'll assume that the magazines/calibers don't
match") — the `no-mag-pickup` lane is removing the one pickup that exists (`player.ts:1096–1099`, the dropped pistol's magazine row).

Consequences, in order of weight:
1. **New feature: a guard carbine** — an AKS-74U-style short AK for this setting, other AK variants as rows of a `WeaponDef` table (§2, §3).
   Two-hand long-gun carriage and aim, short bursts, a 30-round box, a bigger flash, the rifle falling out of dying hands as a physical, un-lootable
   prop. One-shot lethality both ways stays exactly as it is (`Player.MAX_HITS = 1`, `game.ts:110`).
2. **New system: suppression**, one scalar per character fed by the rounds `fireWeapon` already traces, read by the guard AI (they duck, stop
   advancing, shoot worse) AND by Sam's picture / sound / spread (§4). One model for presentation and AI, per CLAUDE.md.
3. **SC-20K slimmed** (§5): rifle (semi/auto) + foregrip (RMB held = brace) + ring airfoil (RMB press = non-lethal ranged knockout). Sticky
   shocker, sticky camera, gas grenade, shotgun, 20 mm: out of v1 → Appendix B. It is **not louder than the Five-seveN** (same hearing branch,
   `level 1`) — which is also Chaos Theory canon: the SC-20K is integrally suppressed.
4. **No ammunition scavenging of any kind**: no ring retrieval, no rifle pickup, no magazines. Counts are what you brought.
5. Rev 1's open questions are closed or obsolete (Appendix A); five genuinely open decisions remain, each with a default so work proceeds (§11).

## 1. Headline findings (read these even if nothing else)

Kept from rev 1 where they still bear (renumbered), plus what the new centre of gravity turned up.

1. **"Louder" has nowhere to go in the hearing model — for the AK as much as for the SC-20K — and the maintainer has said that is fine.**
   Any `shot`/`guardShot` event with `level ≥ 1` is gunfire with an 80 m straight-line gate (`guards.ts:52–54`): the whole floor and the lot go
   to awareness 0.92 on one round, suppressed Five-seveN included (`combat.ts:87`). A colleague's round additionally tells every man where Sam
   IS (`guards.ts:73`: `guardShot → lastKnown = player pos`). So a carbine burst cannot be "heard further"; what it changes is (a) presentation
   — a harder, longer synthesized report, three of them overlapping, a much bigger flash — (b) the calm men's announce line (`:80`), and (c) for
   Sam's own rifle nothing at all (level 1, same branch). The brief's "pistol ≈ 40 m" is the kicked door (`:54`, `kick ? 40`); shots are 80.
2. **The guards' whole fire loop is one call in two places, with `fireCd` as the only cadence state.** Alert hold-and-fire:
   `guards.ts:1505–1516` (`fireCd -= dt`; gates `!shield && fireCd ≤ 0 && facingErr < 0.25 && !blocked && !twisted && !poked && !muzzleDown &&
   !roundPastColleague`; then `fireCd = 0.55 + rand·0.5; fireWeapon(g, c, aimAt, false); shots++`; `shots ≥ 12 → reloadT 1.7 + 'reloading!'`).
   Standoff flank shot: `:827–834` (same shape, `STANDOFF_SHOT_SECS 1.2`, off under muzzle discipline). A burst is a three-field record
   (`left`, `nextT`, `idx`) consulted at those two sites before the single-shot path — every existing gate is re-asked per round, so a colleague
   stepping into the line mid-burst (`muzzleCheck`, `:1483`) or the shield coming up (`shieldUp`, `:563`) ends the burst. No new branch.
3. **The suppression signal is already computed for every round.** `fireWeapon` has `muzzle`, `dir`, `tHit` and `hitP` after its hit scan
   (`combat.ts:40–61`) for player and guard rounds alike; the closest approach of that segment to a chest is six flops per living character, the
   impact term is `dist(hitP, chest)`. No new rays, no new events: one call appended after the scan (§4.1). The bullet-wake loop that shoves
   smoke along the same segment (`:64`) is the precedent for "per-round work along the trace".
4. **Every guard reaction suppression needs is an existing lever.** Rooted-and-staring is `reactT` (the dazzle reuses it, `combat.ts:272`);
   gun-down-and-posed is `muzzleDown → upper 'none' + stance 'lowReady'` (`guards.ts:1620`); the animator takes `crouchTarget` from guards
   already (`:1620` writes 0; `GuardScript.crouch` drives it in the room-clear drill); "shoots worse" is one factor in the guard spread line
   (`combat.ts:24–27`); "not yet" is `fireCd`; the flinch is `anim.hit()`. And because `canSee`'s eye is `bones.head` (`guards.ts:879`), a man
   who ducks behind a partition *physically loses his line* and must re-acquire when he comes up (`sightGain ×2.2` when alert, `:142`) — the
   most important consequence of being suppressed falls out of the sight model with no rule.
5. **Sam-side treatment hooks exist and are cheap.** `PostParams` has a spare float (`post.wgsl:5` `_unused`, written 0 at `passes.ts:411`);
   the hit vignette is already a radial mask keyed off `frame.post.z = settings.hitFlash` (`post.wgsl:77`, `engine.ts:192`, fed from
   `player.hitFlash` in `main.ts:190`) — suppression is its grey sibling; grain is a live uniform (`passes.grain`, `:83`, rewritten every frame at
   `:412`); `FollowCamera` already accepts a world-space nudge (`peekOffset`, `camera.ts:19`) — a `shake` offset applied in `rebuild()` after
   smoothing is five lines; Sam's spread is already a `fireWeapon` parameter used for the one-handed hostage shot (`HOLD_SPREAD 0.09`,
   `player.ts:46`, `:725`).
6. **There is no rifle clip in the animation library — for the guards either — so the long-gun hold is procedural, and it is ONE solve shared by
   the AK and the SC-20K.** `carryArms` (`character.ts:1044`) moves both hands by one rigid transform of `Pistol_Aim_Neutral`'s grip; a long gun
   needs the support hand IK'd to a point on the bore axis ahead of the firing hand (handguard), the firing hand pulled back toward the shoulder
   pocket, the head to the stock. Guards and Sam run the same `CharacterAnimator`, so R1 does it once, in the viewer, and both weapons read it.
   This is still the long pole (~2.5 d) and still isolated in `character.ts` + `rigProps.ts` + the viewer.
7. **Guards are one-per-`PatrolRoute`** (`game.ts:433–435`), three on this level (`level.ts:716–719`: corridor = Kowalski, cubicles = Novak,
   lobby_break = Reyes; callsigns by roster, `game.ts:286`). So "which guards carry rifles" is a field on the route (`PatrolRoute.weapon`,
   `level.ts:23`) plus a sandbox knob — data, not code paths.
8. **What a dying hand lets go of is already parameterised** — `dropFromHand(g, c, kind, …)` (`combat.ts:154`) with `Item` shapes per kind
   (`throwables.ts:135–150`) and the dying light riding the tumbling item (`guards.ts:1636–1640`). A `'rifle'` kind is a longer three-box item;
   "not lootable" costs nothing (only `'pistol'` items ever produced a row, `player.ts:1096`, and that row is going).
9. **The muzzle constant and the body circle** (rev 1 finding 8) bite the guards too: `Character.muzzle = handR + gunDir·0.26`
   (`character.ts:1742`) must become per-character (`muzzleAhead` ≈ 0.50 for the AKS-74U, 0.52 for the bullpup); `armThrough` (`combat.ts:94`)
   then puts more guard rounds "into the jamb" at doorways — correct, and `poked` (`guards.ts:1480`) already makes him step clear.
10. **A burst strobe-lights the shooter** (rev 1 finding 2, now mostly about guards): muzzle flashes are real transient lights the probe behind
    the light meter sees; a guard's burst lights *Sam* if he is within the flash's 8–10 m and in line — his meter jumps for three frames ×3. That
    is physically right (you are lit by the man shooting at you) and needs no rule; it wants one probe (`carbine-flashmeter`, §9) so nobody is
    surprised when a pinned Sam's meter pulses.
11. **One-shot stays; bursts make *exposure time* the currency, and the fairness levers are all data** (§3.4): the reaction beat before a
    first round (`reactT ≥ 0.35`, `fireCd 0.6–1.0` on going alert, `guards.ts:1372`), first-round accuracy then per-round spread growth, burst
    length, the gap between bursts, and — proposed — an opening burst at range that is *deliberately* suppressive (aimed at the cover's edge,
    not the head), which is both the fairness valve and the thing that puts the suppression system on screen in the first second of a fight.

## 2. Weapons as data — the `WeaponDef` table (lane R0)

Today the Five-seveN is a class with literals (`weapons.ts:4–68`), the guards' 9 mm is not modelled at all (`Guard.shots`/`reloadT` ints,
`game.ts:253`; "12 rounds then 1.7 s", `guards.ts:1515`), and `fireWeapon` picks flash card, light gain, voice and event by `isPlayer`
(`combat.ts:30, 36, 38, 87`). R0 makes the weapon a value both sides carry, with defaults that reproduce today bit-for-bit.

```ts
// weapons.ts
export type WeaponId = 'fiveseven' | 'guard9mm' | 'aks74u' | 'ak74m' | 'akms' | 'sc20k';
export type FireMode = 'semi' | 'auto' | 'burst';
export interface WeaponDef {
  id: WeaponId; name: string; short: string;            // 'AKS-74U carbine', 'AKS-74U'
  cls: 'pistol' | 'carbine' | 'rifle';                   // rig group + pose family (rigProps / character longGun)
  magCapacity: number; spareMags: number;                // guards: spareMags Infinity (they never run dry; the reload is the beat)
  reload: { dur: number; out: number; in_: number; rack: number };   // staged, today's pistol = {1.6, 0.38, 1.02, 1.38}
  modes: FireMode[]; cd: number;                         // single-shot cadence floor (pistol 0.22 player / 0.55–1.05 guard AI)
  burst?: { min: number; max: number; interval: number; gapMin: number; gapMax: number };   // guard AI bursts (§3.3)
  spread: { base: number; moveK: number; rangeK: number; rangeFrom: number; perRound: number; cap: number };   // guard model (:24–27) generalised; player uses spreadStill/Walk (§5)
  report: { level: number; voice: SfxName; flashGain: number; flashRange: number; card: { h: Vec3; emissive: Vec3; ahead: number }; announce: string };
  tracer?: { every: number; lastN: number; color: Vec3 };   // §3.3 / R6
  muzzleAhead: number;                                   // Character.muzzle = handR + gunDir·this
  light: 'rail' | 'handguard' | 'none';                  // where the weapon light sits (rigProps), if any
  drop: ItemKind;                                        // what leaves the hand: 'pistol' | 'rifle'
  suppressFirst?: boolean;                               // §3.4: opening burst at range is laid beside the target
}
export const WEAPONS: Record<WeaponId, WeaponDef>;
export class Firearm { constructor(readonly def: WeaponDef) …; chamber; mag; spare[]; infinite; reloadT; mode; burst: {left,nextT,idx}|null; consecutive; shotsFired;
  canFire(); fire(); startReload(ev); cancelReload(); update(dt); spareSorted(); }
export class Pistol extends Firearm { lightOn = false }   // def = WEAPONS.fiveseven — every `pl.pistol.*` site keeps compiling
```

The table (v1 builds the first three; the rest are rows so "AK variants depending on our setting" is a data change):

| id | name | cls | mag | cadence | burst (AI) | spread base / perRound | report: level · flashGain · voice | muzzleAhead | light | drop |
|---|---|---|---|---|---|---|---|---|---|---|
| `fiveseven` | FN Five-seveN (suppressed) | pistol | 10 (+3 spare) | 0.22 s | — | 0 (Sam is dead-on) | 1 · 0.45 · `pistolSuppressed` | 0.26 | rail | pistol |
| `guard9mm` | 9 mm service pistol | pistol | 12 (∞ spare) | 0.55–1.05 s | — | 0.05 / 0 | 1 · 1.0 · `pistolLoud` | 0.26 | rail (lens) | pistol |
| **`aks74u`** | AKS-74U-style carbine (5.45×39, 206 mm barrel) | carbine | 30 (∞) | 0.1 s (600 rpm) | 2–4, gap 0.9–1.6 s | 0.035 / +0.03, cap 0.16 | 1 · **1.7**, range 10 · `carbine` | 0.50 | handguard | rifle |
| `ak74m` | AK-74M-style rifle (415 mm barrel, brake) | rifle | 30 | 0.1 s | 2–4 | 0.03 / +0.025 | 1 · 1.1 · `carbine` (lower) | 0.66 | handguard | rifle |
| `akms` | AKMS-style (7.62×39) | rifle | 30 | 0.1 s (600) | 2–3 | 0.04 / +0.04 | 1 · 1.3 · `carbineHeavy` | 0.62 | none | rifle |
| `sc20k` | SC-20K (5.56 bullpup, suppressed) | rifle | 30 (+2 spare) | semi 0.11 / auto 0.075 | — (player) | see §5 | 1 · 0.55 · `rifleSuppressed` | 0.52 | none | rifle |

Real AKS-74U cyclic is ~650–735 rpm; 600 (one round per 6 frames at 60 Hz) is chosen so each flash owns its frames and the burst reads as
discrete cracks from this camera. The famously large fireball of the short barrel is the renderer's gift: `flashGain 1.7` on `shot.lightPower
90` (`effects.ts:68`) with `flashRange 10`, and a flash card twice the guard pistol's (`card.h [0.04, 0.04, 0.12]`, emissive `[110, 60, 18]`,
cf. `combat.ts:30`). All flash numbers UNTUNED → viewer pass (house rule: `effects.ts` is authored data).

**R0's contract is "no behaviour change":** `fireWeapon(g, shooter, target, opts: { weapon: WeaponDef; isPlayer: boolean; spread?: number })`
reads card / gain / voice / level / muzzleAhead from the def, and with `fiveseven` / `guard9mm` produces today's numbers exactly; `Guard` gains
`weapon: Firearm` (def from `route.weapon ?? 'guard9mm'`) and the alert branch's `shots ≥ 12 → reloadT 1.7` becomes `weapon.mag === 0 →
weapon.startReload()` with `guard9mm.reload.dur = 1.7`, `magCapacity 12`; `Character.muzzleAhead` defaults 0.26. Pistol probes, gunhold /
standoff / discipline families and the tour must pass unchanged, and a pixel A/B of one scripted shot must be at the noise floor.

## 3. The guard carbine (lanes R1 rig + poses, R2 behaviour)

### 3.1 What it is

An AKS-74U-pattern carbine: stamped receiver, short barrel with the conical booster, wood handguard, triangle side-folding stock (carried
unfolded — they are on shift, not in a car), orange bakelite 30-round box. From this camera the tells are the curved magazine, the length
(0.73 m against the pistol's 0.2), the two-handed carriage, and the fireball. Numbers in the `aks74u` row above.

### 3.2 How it changes the man carrying it

**Carriage by state** (the pose family `cls: 'carbine'` selects; names are `STANCES` entries R1 adds beside `highReady/lowReady/stack/wall`,
`character.ts:219–229`, all driven through the existing stance springs so they morph rather than cut):

| guard state today | pistol man today | carbine man |
|---|---|---|
| calm patrol (`lvl 0`) | torch in the right hand, pistol holstered (`combat.ts:193–196`) | **`patrolLong`**: carbine on its sling across the front, right hand on the grip, support hand on the handguard, muzzle down ~35° and a little left; **the weapon light on the handguard is his torch** (beam = bore, pooling on the floor ahead exactly like the drawn-pistol men at `aimPitch −0.26`, `guards.ts:1417`). No hand torch for riflemen. |
| heightened / drawn (`gd.drawn`, `:1288`) | pistol at low ready, weapon light | **`lowLong`**: stock in the shoulder pocket, muzzle depressed ~30°, elbows in — the long-gun low ready |
| suspicious / alert aim (`upper 'aim'`) | `Pistol_Aim_Neutral` arms + aim twist | **`shoulder`**: stock in the pocket, cheek on the comb (head yaw 8° into the stock, pitch +3°), support arm extended to the handguard, firing elbow down; the aim twist / pitch machinery unchanged |
| `muzzleDown` (colleague in the line, `:1620`) | `lowReady` | `lowLong` |
| suppressed head-down (§4.2, new) | crouch + `lowReady` | crouch + `lowLong`, head ducked (headPitch 10) |
| sprint / chase legs | arms from the run clip | `portLong`: gun across the chest, muzzle up-left ~50°, both hands on |
| dead | pistol or torch dropped, sidearm on the thigh if he died on patrol (`:192`) | the **carbine dropped** (§3.5); his sidearm stays holstered on the body (riflemen wear one too: `holsterBoxes` as today) |

**What R1 writes** (list, do not write here):
* `rigProps.ts`: `RIG.carbine` group in the same `Seg`/`Adj` grammar as `RIG.guardPistol` (`rigProps.ts:96–102`), laid along `gunDir` from
  `handR`: `receiver {l0 −0.08, l1 0.20, thick .022, tall .032}`, `cover` (the ribbed top, a hair proud), `handguard {l0 0.20, l1 0.34, thick
  .026, tall .028}` in a wood albedo `[0.16, 0.09, 0.04]`, `barrel {l0 0.34, l1 0.44, thick .009}`, `booster {l0 0.44, l1 0.50, thick .016}`,
  `mag` as two canted segs (the curve) in bakelite `[0.28, 0.12, 0.04]` hung under `l 0.10–0.16`, `grip` (reuse the pistol grip numbers),
  `stock` as two thin segs from `l −0.08` back to `−0.33` (the triangle), `lens` on the handguard's right at `l 0.30` (lit = his light colour ×
  `lensGlow`), `lightAhead 0.32`, group `adj`. ~11 boxes (pistol 3). `RigOpts` gains `weapon: 'pistol' | 'carbine'`; the guard branch of
  `rigBoxes` (`:271–285`) grows a third arm; `rigTorchPos` (`:327`) returns the handguard lens for a carbine; `COL` gains `wood`, `bakelite`.
* `character.ts`: `longGun: boolean` on the animator (set by whoever poses him from `weapon.def.cls !== 'pistol'`); `carryArms` (`:1044`) with
  `longGun` → firing hand target pulled back to `chest + [side −0.06, up +0.19, fwd +0.16]` (per stance row), **support hand IK'd to `handR +
  gunDir·0.27 − gunUnder·0.03`** instead of the rigid clip offset (finding 6), elbows through the existing swivel/pole arguments (support elbow
  low and under, not winged); the aim layer (`upper === 'aim'`) gets the same retarget applied over `Pistol_Aim_Neutral` so the shouldered aim is
  the clip's body with long-gun arms; `STANCES.shoulder / lowLong / patrolLong / portLong`; recoil: the existing `fire()` kick layer scaled ×0.6
  in translation plus 1.2° of muzzle climb per burst round decaying at 10/s (reads as the burst walking up); reload: `Pistol_Reload` retimed to
  the def's `reload.dur` with the support hand sent to the mag well (rock-and-lock reads different enough at this size).
* `Character.muzzleAhead` (finding 9) — if R0 has not landed first, R1 adds it (one field, one line at `:1742`; whichever lane is second rebases).
* Viewer (`viewer.ts` / `viewer.html`): a "Carbine" section — guard kit selector pistol / torch / **carbine**, stance buttons for the four long
  stances × stand/crouch, walk/aim toggles, the `RIG.carbine` sliders + gizmo, a fire button (flash + card + climb), copy-constants emitting the
  group with the rest (`rigSource`, `:133`). **The viewer is the acceptance surface for R1**; the game only flips `RigOpts.weapon`.

**Torch stays separate?** No — for riflemen the light is on the gun (above). It keeps "the light is where the muzzle points" true for every
drawn man on the floor, it means a rifleman's beam sweeping onto you IS his muzzle sweeping onto you (the threat-proximity read at
`game.ts:603–607` needs nothing), and when he dies the light leaves with the rifle and dies on the floor through the existing path
(`attachFlashlight`, `guards.ts:1636–1640` — the beam already rides `gd.dropped` whatever its kind). The grab: `torchLostAt` (`:1637`) is
"knocked out of a living hand" — a slung carbine is not knocked away; for a held rifleman the light simply goes off (`gd.held` → `fl.enabled =
false`) and the carbine hangs on its sling in the arm variant (rig: `patrolLong` boxes while `held`). No new light code.

### 3.3 Fire behaviour — bursts, report, reload, tracers

**Bursts** (R2, at the two sites of finding 2). With `weapon.def.burst` present:
```
if (!w.burst && fireCd ≤ 0 && ‹all today's gates›)          → w.burst = { left: N, nextT: 0, idx: 0 },  N = 2 + ⌊rand·3⌋ clipped to [min,max] (2–4, mode 3)
if (w.burst) { nextT -= dt;
  if (‹any per-round gate fails: shield ∨ muzzleDown ∨ poked ∨ twisted ∨ roundPastColleague›) → end burst, fireCd = 0.4        // a man crossing ends it; no round leaks
  else if (nextT ≤ 0 && w.fire()) { fireWeapon(…, { spread: guardSpread + def.spread.perRound·idx }); idx++; left--; nextT += def.burst.interval (0.1);
       if (left == 0 ∨ w.mag == 0) → end burst, fireCd = gapMin + rand·(gapMax−gapMin) (0.9–1.6 s) } }
if (w.mag == 0 && !w.reloading) → w.startReload(); say 'changing mag!'; anim.reload()                                        // 30 rounds ≈ 10 bursts ≈ 25 s of fight
```
`facingErr < 0.25` and `blocked` are asked at burst START only (the burst commits to the line it began on; the aim point keeps tracking, so a
burst follows a running Sam but does not stop because he crossed behind a mullion for one frame — the rounds hit the mullion, which is what
bursts do, and feeds his suppression). First-round accuracy then growth: guard spread today is `0.05 + min(0.06, v·0.014) + max(0, range−8)·
0.006` (`combat.ts:26`); the carbine's `base 0.035` is tighter (a shouldered long gun beats a pistol at arm's length), `perRound +0.03` opens
it fast: at 10 m round 1 is ± 0.24 m, round 3 ± 0.55 m, round 4 ± 0.7 m — a torso, then the partition, then the ceiling tile. `consecutive`
resets when the burst ends. The standoff site keeps single rounds even for a rifleman (`burst` ignored inside `standoffAlert`: a deliberate
shot past a colleague's head is not a burst) — and under muzzle discipline it never fires anyway.

**Report.** Event `{kind:'guardShot', level: 1, loud: true}` per round — same branch, same reach (finding 1; maintainer: fine). Three things
differ: the announce line for calm men becomes def-driven (`report.announce`: *"automatic fire — {where}! move!"* vs today's *"shots fired! on
me!"*, `guards.ts:80`; `{where}` from `roomName`, `dialogue.ts`); `H.shots` counts rounds so a burst is "heard 3 shots" in the witness line
(`:66`, `:197`) — right; and the audio voice `carbine`: `pistolLoud`'s recipe (`sfx.ts:38–45`) with a harder 0.4 ms crack, the body an octave
lower (55 Hz thump), `tanh` driven harder, and a 0.6 s slap tail — three instances 0.1 s apart overlap into the ripping sound; the mixer's
propagation (occlusion low-pass, routed doorway source, reverb send — `audio.ts:69–80`) does the rest, so a burst two rooms away is a muffled
triple thump from the doorway. `reactT` for far calm men is set once per burst, not per round (`:79` already guards this: "a colleague's
continuing fire must not keep re-rooting men"). Hearing radius: unchanged 80 m gate = every guard indoors and in the lot hears any burst; what a
burst "does to the floor" is therefore what a pistol shot does today (everyone to 0.92, converge on the shooter's fix of Sam) — the difference
the player feels is on screen and in the speakers, and in §4.

**Reload**: `aks74u.reload = {dur 2.6, out 0.7, in_ 1.7, rack 2.2}`; at `out` the empty box drops as a `'mag'` item with `fill` sized/coloured
for a 30-round bakelite box (`throwables.ts` mag branch: `fill > 1` → the long orange box) — physical, clatters (`magDrop` at rate 0.8), **not
lootable** (no row exists for mags; nothing to remove). Bark `'changing mag!'`; `fireCd ≥ 0.5` after `done`. Guards' `spare` is infinite.

**Tracers** (R6, optional, flag `fx.flags.tracers`, default ON for `cls !== 'pistol'` defs that declare `tracer`): `aks74u.tracer = { every: 3,
lastN: 3, color: [1.0, 0.42, 0.12] }` — every third round, and **the last three in the box** (a real practice: the shooter's cue to reload —
here it is *Sam's* cue that the man is about to go dry, readable from cover). A tracer is an emissive streak box from `muzzle + dir·1.5` (tracer
ignition distance) to `hitP`, built exactly like the laser line (`laserBoxes`, `combat.ts:213–215`: `hw = max(0.004, 0.6·mPerPx)`, emissive
scaled by `0.004/hw` so a widened line carries the same light, `NoShadow | Dynamic` so no ray, cache or sight line ever sees it), pushed to
`g.fx` with `ttl 0.06` and a new `fade: true` (emissive × remaining/initial each frame — `fx` entries are `{box, ttl}` today, `game.ts:350`,
`:629`). At 600 rpm with 1-in-3 there is at most one streak alive; a whole magazine dumps ≤ 4. Optional under `fx.flags.tracerLights`: one
`lights.flash(mid, color, 2.5, 2.5, 0.04)` at the segment midpoint so the haze glows along the path for a frame (transients are cheap in the
tile-culled direct pass; measure direct-pass ms during a mag dump on/off in R6's acceptance and default it by the number). Through smoke the
existing bullet wake (`combat.ts:64`) already parts the field along the same segment — a tracer through the break-room haze is the shot for
the board. Ricochet sparks off statics: `sparks.emitCone(hitP, reflect(dir, n), {count 5, speed 9, cone 0.5, life 0.12})` for carbine
rounds only (`col.raycast` returns the normal) — cheap, and it marks where the burst went for a player reading it from above.

### 3.4 One-shot lethality stays — how a burst stays fair

Sam dies to one round (`MAX_HITS 1`) and must keep doing so (Chaos Theory tie-breaker; the guards die to one of his). A 3-round burst at a
0.05-spread pistol's accuracy would simply be three lottery tickets per trigger pull. The levers, all data in `WeaponDef` / `SUP` and all
proposed ON:

* **Reaction beat unchanged**: going alert sets `reactT ≥ 0.35` and `fireCd 0.6–1.0` (`guards.ts:1372`); a burst cannot start before a
  single shot could today. The tour's firefight beat is built on this (`demo.ts:229`: "their reaction beat is ≥ 0.8 s after they see him").
* **First-round accuracy, then growth** (§3.3): only round 1 of a burst is truly aimed; exposure *time* is what kills — a head over the
  partition for 0.15 s meets one aimed round (as today), a Sam who stands in the open for 0.4 s meets three.
* **Longer gaps than the pistol's cadence**: 0.9–1.6 s between bursts against 0.55–1.05 s between pistol rounds → rounds-per-second at Sam
  roughly doubles (≈ 2.4 vs 1.25 /s) but *aimed* rounds per second drops (0.8 vs 1.25 /s). The danger moves from "any moment" to "the first
  crack of each burst", which a player can learn to move between.
* **`suppressFirst`** (open decision 4, default ON): when a rifleman's *first* burst of an engagement starts with Sam ≥ 10 m away and some
  static within 1.2 m of Sam along the line (he is near cover — `col.raycast` from Sam's chest ± perpendicular), the burst's aim point is laid
  **0.6 m to the cover side and 0.3 m high** of the chest: it hammers the partition edge / jamb beside him. It costs the guard nothing he had
  (today's first pistol round at 12 m with Sam walking is ± 0.6 m per axis anyway, `combat.ts:26–28`), it is what trained men do (fix, then manoeuvre — and the flank logic
  exists), and it guarantees the player's first experience of a carbine is the screen greying and splinters flying, not a reload screen.
  Subsequent bursts are aimed. A guard with `sup ≥ SUP.flinch` himself never gets the courtesy (he is already in a fight).
* **Suppressed men shoot worse and later** (§4.2) — Sam's own two rounds into the jamb are now worth something even when they kill nobody.
* Not proposed: damage falloff, armour, a second hit point. (Rejected in rev 1 too; the maintainer's difficulty note of 08-08 was answered
  with the crouch-speed knob, not hit points.)

### 3.5 Who carries one, and what drops

**Who** (open decision 1): `PatrolRoute.weapon?: WeaponId` in `level.ts`; default this level **Reyes** (`lobby_break` — front of house, the
'hard' one, and his long loop takes him down the corridor and through the break room, so the carbine is met everywhere without arming the
radio NCO the player meets most). Sandbox knob *Game ▸ rifles*: `authored | none | all` (re-deals `gd.weapon` live; `all` is the soak's stress
setting and the "AK night" screenshot). The lockdown pair / post logic (`assignLockdown`) is untouched — whoever has the carbine keeps it; a
later, physically-motivated option is an **arms locker** errand at lockdown (the post man fetches a carbine from the storage room the way the
breaker errand works, `GuardTask`, `game.ts:201`) — listed in Appendix B, not scheduled.

**Drops**: `killGuard` (`combat.ts:141–145`) chooses `torch` vs `pistol` by `state === 'patrol' && !drawn`; with a weapon def it becomes
`def.drop` for anything in the hands (a rifleman on calm patrol has the carbine in hand, not a torch) → `dropFromHand(g, c, 'rifle', gunDir,
dir)`: `ItemKind += 'rifle'` (`throwables.ts:8`), radius 0.06, restitution 0.18, friction 0.55, life 240, boxes = receiver + handguard/barrel +
mag + stock (four segs along `yaw`, tumbling like the pistol, `:135–150`), `magDrop` at rate 0.6 on hard bounces + the same `'prop'` clatter
events (`combat.ts:160`). The weapon light rides it and sputters out (`attachFlashlight`, unchanged). **No interaction row, no ammo, no pickup**
— it lies there lit by whatever lights it, which is the point. The FIFO cap (`throwables.ts:46`) may evict it after 32 newer items like any
dropped pistol; fine.

### 3.6 Failure cases

Burst across a door that swings shut mid-burst (rounds into the leaf — `col.raycast` includes leaves, correct); rifleman pressed to a jamb
(`armThrough` with `muzzleAhead 0.5` trips more often → `poked` → he steps clear, `guards.ts:1480–1481`; verify he does not oscillate: probe);
burst started the frame before `shieldUp` (per-round gate ends it: at most the round already fired); rifleman in the standoff (single rounds
only, or none under discipline); rifleman dazzled mid-burst (`canShoot` false → burst ends); reload interrupted by a chase (`reloadT` runs on
while he moves, as today's does; he cannot fire till `done`); `infiniteAmmo` sandbox flag (player only today, `player.ts:273` — leave guards
out); rifles `all` + room clear drill (`squad.ts` poses via `GuardScript.upper 'aim'` → `shoulder` through the same `longGun` flag; the drill's
timings do not depend on cadence); tour beats that pin pistol men (`demo.ts:216–218`) are unaffected unless the beat assigns a carbine (§8).

## 4. Suppression — one scalar, both ways (lanes R3 core + guards, R4 Sam)

### 4.1 Definition (new `src/game/suppression.ts`)

Per living character a scalar `sup ∈ [0, 1]` (stored on `Guard.sup` and `Player.sup`, plus `supKick` — the last increment's envelope for
pulses — and for guards `supT`, the head-down clock). Fed **per round** from inside `fireWeapon`, right after the hit scan and before the
effects (`combat.ts:61`, one appended call: `noteRound(g, shooter, muzzle, dir, tHit, hitGuard, playerHit)`), decayed once a frame
(`updateSuppression(g, dt)` at the top of the guards/player block, `game.ts:611`).

```
for each living character X ∉ {shooter, the character this round hit}:
  C  = X.bones.chest                                   (Sam: chest; crouched it is lower — being small helps, physically)
  s* = clamp(dot(C − muzzle, dir), 0, tHit)            closest point parameter along the round's actual travel
  if s* < SUP.minTravel (1.5 m): continue               the first metre and a half out of a muzzle suppresses nobody (shoulder-to-shoulder colleagues, the hostage under Sam's own gun)
  dNear = |muzzle + dir·s* − C|                         how close it passed (or stopped short: s* = tHit when the round ended in the cover in front of X)
  dHit  = |hitP − C|                                    how close it struck
  add   = SUP.wNear·(1 − dNear/SUP.nearR)⁺ + SUP.wHit·(1 − dHit/SUP.hitR)⁺        wNear 0.4, nearR 1.8 m; wHit 0.3, hitR 2.5 m
  if X is head-down already (guard supT > 0): add ×0.5  diminishing returns: you cannot pin-lock a man forever with a metronome (see 4.5)
  X.sup = min(1, X.sup + add·keen(X));  X.supKick = max(X.supKick, add)          keen: temperament, below
decay per frame: sup ×= 2^(−dt / SUP.halfLife) (1.1 s → from 1.0 to under 0.3 in ~2 s, gone in ~3.5); supKick decays at 8/s
```
Worked through: two Five-seveN rounds into the jamb 0.6 m from a covering guard's chest = (0.27 + 0.23)·2 ≈ 1.0 → pinned; one round ≈ 0.5 →
flinch. A 3-round carbine burst into the partition Sam is behind, impacts 0.4–0.9 m from his chest ≈ 0.45–0.55 per round → 1.0 by round two.
A burst passing 3 m wide of everyone: nothing. No line-of-sight test on purpose: a round through the fabric partition beside your head
suppresses you whether or not you saw the shooter — it is ballistic, not visual, and not acoustic either: **suppression does not route through
`SoundPaths`**; only its *sounds* do (4.3), like every other sound.

`SUP` (all in `suppression.ts`, panel-tunable): `{ nearR 1.8, hitR 2.5, wNear 0.4, wHit 0.3, minTravel 1.5, halfLife 1.1, flinch 0.3, pinned
0.6, headDown [0.9, 1.5], displaceAfter 4, spreadK 1.5, gapK 1.0, samSpread 0.07, samReticleK 2.2 }`. Temperament (`TEMPERAMENT`,
`game.ts:149` — nothing reads it yet; this would be its first mechanical reader): `hard` accrues ×0.8, `nervy` ×1.25, `steady` ×1.

Interactions that fall out rather than need rules: **muzzle discipline** — while Sam holds a living man nobody fires (`shieldUp`,
`guards.ts:563`), so nobody suppresses Sam, and Sam's rounds past the hostage's ear DO suppress the watchers (they flinch and crouch but the
discipline already holds their fire — the standoff gets visibly uglier for them, which is the hold's whole promise); the **hostage** himself is
inside `minTravel` of Sam's muzzle and accrues nothing from Sam, but his colleagues' rounds past the pair (discipline OFF mode) rattle him —
harmless and true. **Stun canister**: not suppression (dazzle already roots and blinds, `combat.ts:267–276`); left separate. **AI off**
(`aiEnabled`): the scalar still integrates (it is physics), reactions are skipped with the rest of the AI. **godMode**: still suppressed —
it is not damage. **Tour puppet**: Sam's `sup` integrates (the firefight beat's screen SHOULD grey — free production value) but `samSpread` is
not applied to puppet-fired rounds (`g.puppet` non-null → spread 0), so the beat's scripted double-tap still lands (`demo.ts:228`).

### 4.2 Effect on guards — the player's payoff (R3)

Read in `updateGuard`'s alert branch and in `standoffAlert`; nowhere else needs it (calm men hearing gunfire go alert through
`hearingCheck` regardless, and a searching man fired upon is alert next frame).

* `sup ≥ SUP.flinch` (0.3), on the rising edge: `anim.hit()` (the flinch), bark from a small pool (*"taking fire!"*, *"christ—"*, *"he's
  shooting!"* — writing is the maintainer's), `fireCd = max(fireCd, 0.25)`. While `flinch ≤ sup < pinned` he keeps fighting, worse: guard
  spread × `(1 + SUP.spreadK·sup)` (the factor goes on the guard line in `fireWeapon`, `combat.ts:26`), burst gap × `(1 + SUP.gapK·sup)`, and
  `closing` (`guards.ts:1494`) drops from `guardChase` to `guardInvestigate` pace (he advances, but not at a run into fire).
* `sup ≥ SUP.pinned` (0.6): **head down**. `supT = rand(headDown)` (0.9–1.5 s), any burst in progress ends, and while `supT > 0 || sup ≥ pinned`:
  `crouchTarget 1`, `upper 'none'`, `stance 'lowReady'/'lowLong'`, `headPitch` ducked, `speed → 0` (no closing, no `lineStep`, no push up the
  path), `fireCd = max(fireCd, 0.6)` so the first round after coming up is a beat late, `aimAt` still tracked (eyes toward the threat). This
  sits as a sub-branch right after the `reactT > 0` branch (`guards.ts:1464`) and before the standoff / canShoot branches, shaped like it.
  Because his eye drops with the crouch (finding 4), behind a 1.3 m partition or a desk he *loses sight of Sam* for the duration and must
  re-acquire on coming up — Sam's window to move is real and visible (the laser goes off him: `laserBoxes` follows the lowered gun).
* Pinned for more than `SUP.displaceAfter` (4 s cumulative without `sup` dropping under `flinch`): he **displaces** instead of squatting
  forever — `lineStep`'s side-step search (`guards.ts:453`) toward the side with a static between him and Sam's last fix, else back up his path
  2–3 m (`goTo` the previous path node); bark *"moving!"*. This and the ×0.5 accrual while head-down are the anti-lock: two rounds buy ~1.5–2 s,
  the next two buy ~1 s, and by the third pair he has shifted somewhere you have to find again.
* In the standoff (`standoffAlert`, `guards.ts:784`): pinned → `restT` held (no orbit progress), crouch, no flank shot even with discipline
  OFF; flinch → orbit pace × 0.5. He does not leave the standoff (his colleague is still in Sam's arm).
* Body-duty / found-body script men who come under fire are alert next frame anyway (gunfire) — no special case.
* Barks throttle through the existing per-man / floor clocks (`standoffBark`'s pattern); one *"he's got us pinned!"* floor line when two men
  are pinned within 2 s of each other (spokesman pattern, `raiseEscalation`).

The economy this creates: Sam has 10+1 rounds and three spare tens. Two rounds into a jamb to cross a corridor a rifleman is covering is a
fifth of a magazine for ~1.5 s of safety — a real decision, cheaper than a stun canister, louder than everything. It also gives the pistol a
use in a gunfight that is not "win the lottery first".

### 4.3 Effect on Sam — the guards' payoff (R4)

Continuous in `sup` (no thresholds except sound gating); nothing here does damage, slows him, or touches sprint / crouch / interact.

* **Spread**: `fireWeapon(…, { spread: SUP.samSpread·sup })` at the two player fire sites (`player.ts:241`, and added to `HOLD_SPREAD` at
  `:725`): dead-on at 0 (today, exactly), ± ~2° at full — a torso at 8 m mostly, a head sometimes, a fixture rarely. **The reticle shows it**:
  the snap ring (`overlay.ts` reticle) is drawn with radius × `(1 + SUP.samReticleK·sup)` and a faint fill, so the honesty rule holds — the
  player sees the cone the round will be drawn from. No hidden aim wobble (rejected: moving the aim point off the drawn reticle is a lie).
* **Picture** (all under `settings.suppressionFx`, default on; off = today's untouched path so the pixel A/B stays possible): `main.ts` copies
  `player.sup` / `player.supKick` into `settings` beside `hitFlash` (`main.ts:190`); `PostParams._unused` (`post.wgsl:5`) becomes `suppress` =
  `sup + 0.5·supKick`: (1) saturation lerps from `post.saturation` toward 0.5 by `0.6·sup` inside `agx()` (`post.wgsl:38` already has the
  lerp), (2) a **grey-blue vignette** using the hit flash's radial mask (`:77`) at `0.28·suppress`, tinted `[0.08, 0.09, 0.11]`, so a near burst
  *pulses* the edges in with each `supKick` and they breathe back out over the half-life, (3) grain `passes.grain + 0.03·sup` (`passes.ts:83`,
  written per frame at `:412` already), (4) **camera micro-shake**: `FollowCamera.shake: Vec3` added to `pos`/`target` in `rebuild()` after the
  damping (`camera.ts:34–42`) — amplitude `0.035·supKick + 0.01·sup` m at ~11 Hz from two sines, i.e. a jolt per close round and a faint
  tremor while pinned; zero when `sup` is (bit-identical stills). Night vision on: (2)–(4) apply, (1) is meaningless in the tube and skipped.
* **Sound** (synthesized, `sfx.ts` — new voices, played from `noteRound` at the round's closest point to *Sam's* head so HRTF puts it on the
  correct side and the mixer's propagation muffles it if a wall was between): `crack` when `dNear < 1.8 m` and the round travelled > 6 m — the
  supersonic snap: a 0.3 ms full-band click into a 2.8 kHz ring, 25 ms, very dry, gain by `(1 − dNear/1.8)`; it arrives *before* the muzzle
  report in reality — play it immediately and let the report's own propagation delay stand as is (we do not simulate flight time; the ordering
  still comes out right because the report is routed and reverberant and the crack is at his ear); `whizz` when `1.8 ≤ dNear < 4 m` — band-passed
  noise swept 1.4 kHz → 500 Hz over 0.14 s (the subsonic-sounding pass-by everybody knows from films; physically it is the ricochet /
  destabilised round, close enough); impacts already have `bulletImpact` (`combat.ts:67`) — for carbine rounds within `hitR` of Sam add
  `debris`: a short burst of low-passed noise grains (plaster / chipboard spatter), 0.2 s. While `sup > 0.5` the mixer ducks its master high
  shelf by `4·sup` dB with a 0.3 s release (the `earRing` precedent for the stun charge, `combat.ts:264`) — the world goes slightly cotton-wool
  under fire and opens back up as it decays. No HUD meter (Chaos Theory had none; the picture and the reticle are the meter).
* The light meter genuinely pulses when the burst's flashes reach him (finding 10) — not part of this system, but it will read as part of it.

### 4.4 One-model audit

The same `sup` a guard's behaviour branches on is the one the panel prints; Sam's `sup` drives his spread, his reticle, his picture and
his mix; both are computed by one function from the segments the hit scan actually traced (a round that stopped in a door leaf suppresses
from where it stopped); the sounds are emitted at those closest points and propagate like all sound; nothing is inferred from AI state
("he is shooting at me" is not an input — rounds are). What the player learns by feel (two close rounds pin a man ~1.5 s; a burst into my
cover greys me for ~2 s) is literally the guards' rule with the same constants.

### 4.5 Failure cases

Pin-lock (handled: ×0.5 accrual head-down + displacement at 4 s); two riflemen suppressing *each other* shoulder to shoulder (handled:
`minTravel`; a man 3 m *ahead* of a colleague is protected by `muzzleCheck` lowering the rear gun, `MUZZLE_CLEAR_M 0.35` within 8 m,
`guards.ts:364`); Sam suppressing a man he cannot see through two partitions by shooting the wall near him (allowed — he had to know where
to put them; the rounds are loud, the floor converges: self-balancing); a pinned guard whose crouch puts his head *inside* a desk-height prop
(props are not statics; `crouchTarget` only poses — no collision change); head-down guard and the body-discovery cone (`bodyInView` uses
`chestDir`, unaffected); `sup` on dead / ragdolled / held men (skipped: `state === 'dead'`, `gd.held` accrue nothing and read nothing);
restart / `resetGuards` / `clearAftermath` zero everything (fresh `Guard`s; `Player.sup = 0` in `restartEncounter` and `cancelActions`);
Sam down → `sup` frozen then zeroed on restart (the post effect must not stick on the death screen: `down → settings.suppress = 0`);
`?paused` determinism (the shake uses `g.time`, not wall clock; `sup` is 0 at boot: stills bit-identical with the flag on).

## 5. Sam's SC-20K, slimmed (lane R5): rifle + foregrip + ring airfoil

What survives of rev 1 §2–§6, restated short. It lands AFTER the guard lanes (§10) and reuses R0's `Firearm`, R1's `longGun` solve and
R3's stagger-adjacent plumbing.

**Controls** (compose with `player.ts:233–246` slot actions and the equipment block; `4`, `X`, `B` are free in the game today):

| input | with the SC-20K up (slot 4) | notes |
|---|---|---|
| `4` | draw the rifle off the sling (0.55 s, no fire meanwhile); `4` again while up = toggle the secondary | `1/2/3` unchanged; any other slot slings it (0.4 s) |
| `X` | toggle the secondary: **foregrip ↔ ring airfoil** (0.25 s click-clack, RMB dead meanwhile; airfoil at 0 → foregrip only, message says so) | two entries, so "cycle" is a toggle; works slung too |
| `LMB` | fire: SEMI one per click (cd 0.11 s) / AUTO while held (0.075 s, 800 rpm) | dry: click + 'empty — R' as the pistol (`player.ts:243`) |
| `B` | SEMI ↔ AUTO | no burst stop for Sam (rev 1 Q10: no) |
| `RMB` | **foregrip selected → held = brace** (camera `desiredDistance ×0.67`, `aimLead 0.18 → 0.32`, spread ×0.5, pace clamped to the slowest notch, no sprint; release eases back over 0.25 s) · **airfoil selected → press = launch one ring** along the previewed flat arc (cd 0.9 s, hand-cycled launcher) | pistol up: OCP as today (`:245`). Rifle up: no OCP ("OCP is on the Five-seveN — press 1") |
| `R` / `E` / `Q` / `G` | reload the weapon in hand (2.4 s staged: out 0.5 / in 1.5 / rack 2.0) · sling ↔ unsling (= `holstered`) · wall hold allowed, rifle tucked to `highReady` · quick-throw slings first | as rev 1 |
| `Space` behind a man | the rifle goes to the sling and the hold is the ARM variant (`grabVariant`, `player.ts:628` — `slot === 1 && !holstered ? 'gun' : 'arm'` already yields 'arm' for slot 4); row text says so | rev 1 Q6 default, uncontested |
| `L` | nothing — no light on the SC-20K (message once) | rev 1 Q7: keep it simple |

**The rifle** (`WEAPONS.sc20k`, §2 row): 30+1, spare `[30, 30]`; spread (the `fireWeapon` parameter): still 0.010, walking 0.028, crouched
×0.7, braced ×0.5, AUTO +0.011 per consecutive round (reset after 0.25 s idle) capped +0.08, **plus `SUP.samSpread·sup`** (§4.3) — Sam's
pistol stays dead-on at `sup 0`; the rifle trades precision per round for volume. **Report: level 1, `flashGain 0.55`, voice
`rifleSuppressed`** (the `pistolSuppressed` recipe, `sfx.ts:29–36`, with a deeper 50 Hz thump and a longer 0.2 s hiss tail) — *not materially
louder than the pistol*, per the answer and per canon. Muzzle `muzzleAhead 0.52`; case ejection forward-right at the front of the handguard
(the F2000's ejection tube — the `eject` wisp track at `handR + gunDir·0.40 + right·0.04`, `combat.ts:35`: the one tell an F2000 spotter looks
for). Flash card `h [0.03, 0.03, 0.09]`, emissive `[60, 34, 12]` UNTUNED. Tracers: none by default (`tracer` absent; open decision 5). Wall
tuck (rev 1 finding 8): `col.raycast(chest, aimDirFlat, 0.8)` per frame while up → `stance 'highReady'`, fire refused ('no shot — muzzle up'),
clears 0.15 s after the ray clears. Self-illumination on AUTO (finding 10) is a consequence, not code. Rig: `RIG.sc20k` (rev 1 §5's bullpup
segs: stock, mag behind the grip, receiver hump, optic housing, barrel, **launcher tube** under the handguard, eject point at `l 0.40`; ~7
boxes) + `slungBoxes` off `chest`/`spine2` (muzzle down-left past the hip, butt behind the right shoulder) drawn whenever `hasRifle && (slot !==
4 || holstered || hideHeldItem)`; poses = R1's `longGun` family plus `STANCES.braced` (fwd 0.14, up 0.18, lean 10, tuck 1, headPitch 4, squat
0.02) and the draw/sling transition (right hand over the right shoulder, 3-key curve like the throw's, boxes swapped at the midpoint).

**Foregrip**: no ammo, always available, the default selection; HUD tag `BRACE`; braced → `anim.stance 'braced'`, `deliberate 1`. It is where
the camera pull-in the maintainer once floated earns its place without a chord.

**Ring airfoil** (the launcher's only load in v1; new small `launcher.ts` — the rev 1 `LOADS` table collapses to one entry, keep the shape so
Appendix B's loads could register later): carried **5** (open decision 3), **not retrievable** (no scavenging; the spent ring still drops as
a `'ring'` item for the picture — three crossed thin boxes — and is never a row). Muzzle 40 m/s, gravity on, radius 0.03, life 1.5 s, 4
substeps/frame: segment vs every living man's **head sphere** (r 0.16 at `bones.head + [0, 0.05, 0]`, CT-generous) then torso cylinder
(`Character.rayHit`), then `col.raycast` + `props.raycast` (props take impulse J = 3; a carton hops), leaves via the static raycast. Auto-aim
snaps to the **head** of the man under the reticle with one iteration of lead on his ground velocity; the preview is the canisters' polyline
restyled (nearly flat: ~3° at 15 m). **Head → `killGuard(g, gd, dir, true, 'struck', 'player', 'ring to the head — out cold')`** (quiet fold,
what he held laid down, light dies — the takedown's physical path; `isBreathing` true → the breathing found-body lines, `game.ts:160`);
**torso → stagger**: `gd.staggerUntil = time + 3.0`, `reactT ≥ 3`, `anim.hit()`, awareness `≥ 0.7`, `lastKnown = his pos − dir·4` (he felt
which side it came from and comes out of it `suspicious` walking *toward the shooter's side*), `fireCd ≥ 1.5`, bark *"agh — what the—"*; a
second ring on a staggered man = KO. Stagger is handled beside dazzle (`guards.ts:1385–1386`, `canShoot` at `:1461`: add `|| staggered`) — he is
rooted and cannot fire but CAN see. Launch noise `'prop'` level 0.45 at Sam (`guards.ts:82–86` branch: a man at 1 m turns, at 5 m two thumps
make him curious, beyond ~9 m nothing — CT's near-silent launcher in this game's terms); ring on a static `'prop'` 0.3 at the impact (a clack
the room hears); audio `launcher` (the `throw` body + a low `magOut`-ish thunk) and `canisterBounce` pitched up for the clack. Refused
point-blank into a held man; a crouched shot up at a head past a desk edge clacks into the desk (the preview showed it). Witnesses: `witnessKill`
as is; a `sawDrop` flavour line (*"something hit {victim} in the head and he just… folded"*).

**HUD**: slot-4 row `4  SC-20K · AUTO  ▮×30 +1  ▮▮` and a second line `RMB ▸ BRACE  ◦ RING 5 · X` (two entries; the selected one bright);
`.slot.holstered::after` reads `slung · E` for slot 4; gadgets strip greys `RMB OCP (pistol)` while the rifle is up and shows `B SEMI/AUTO`;
`hasRifle === false` → no row. `overlay.updateEquip`'s change key must list mode / selected / ring count / braced (rev 1 §11 item 13).
Start card: *Loadout: Five-seveN only / + SC-20K* → `Player.hasRifle` (open decision 2, default: in the kit).

### 5.1 As built (lane R5) — where the build departs from the table above

The maintainer's follow-ups after this section was written re-cut the controls, and the build follows them: **`X` flips between the two
FIREARMS** (pistol ↔ rifle; `4` also selects the rifle) rather than toggling a secondary; **`B` puts the ring-airfoil LAUNCHER up** with the
rifle in the hands (LMB then fires a ring; it stays up until `B` again or the rings run out) rather than the airfoil being an RMB press;
**RMB held with the rifle up is always the brace** (spread × 0.45, pace capped at 0.55 of the walk, shouldered — no camera pull-in yet: the
follow camera has no cheap hook for it); **`Z` is the selector, SEMI ↔ AUTO** ("we'll want a way for even the SC20K to be full auto for
suppression" — SEMI 0.2 s a round, AUTO 0.1 s under a held trigger with the string opening +0.012 rad a round to +0.08, `WeaponDef.auto`);
**`L` works the rifle's own fore-end light** (the row's `light: 'handguard'`; one `Player.light` posed off whichever gun is in the hand) rather
than nothing; the grab **slings the rifle on the key's frame** and the reach covers it (no separate 0.3 s beat); a G quick-throw slings it and
it stays slung. Numbers that moved: cd 0.2 (not 0.11), the ring 30 m/s with drag 0.4 and radius 0.04 (not 40 / 0.03), the KO line = the hit
no lower than 7 cm under the neck joint on `Character.rayHit`'s cylinder (head, neck, top of the chest — not a separate head sphere), the
stagger 1.5 s and ALERT after it (awareness 0.92, his fix 4 m back up the ring's line) rather than 3 s and suspicious, the launch / clack /
fold noises 0.45 / 0.3 / 0.3 as here. No wall-tuck yet (the muzzle-through-a-panel case is armThrough's, as for every gun). Files: `weapons.ts`
(row + `Rifle` + `LAUNCHER`), `player.ts` (kit, `armRifle`, `poseGunLight`, `rifleSpread`), `launcher.ts` (new), `rigProps.ts` (`RIG.sc20k` +
`slung`), `combat.ts` (`firearmOf`, `hitPlayer`, `handProps`), `guards.ts` (3 lines: `staggered`), `game.ts` (`Player` fields, `Game.rings`,
`sc20k` loadout), `overlay.ts` / `index.html` / `menu.ts` / `bindings.ts`, the viewer, `tools/qa/sc20k-probes.ts` + `soak.ts --rifle-per-min`.

## 6. Controls, menu, README (what changes for the player-facing text)

`menu.ts CONTROLS` and README: one new line `4 · X · B` (rifle / secondary / fire mode) and the mouse row gains "RMB: OCP (pistol) · brace or
ring airfoil (SC-20K)"; the features prose gains two sentences (guards' carbines and bursts; suppression both ways — "put two rounds into the
door frame beside him and he will get his head down"). Nothing about suppression is a control. Tab panel: *Game ▸ rifles* (authored/none/all),
*Game ▸ suppression* (on/off, the `SUP` numbers, a live read-out `Sam 0.00 · Reyes 0.71 head-down 0.6 s`), *Effects ▸ tracers / tracer lights /
ricochet sparks*, *LOSSY-style row not needed* (suppressionFx is a look, listed under Graphics with hit flash).

## 7. AI tables (rev 2)

**Hearing** (all through `hearingCheck`'s existing branches; levels are `GameEvent.level`):

| source | event | reach (as `guards.ts:42–92` computes it) | reaction |
|---|---|---|---|
| carbine round (guard) | `guardShot`, level 1, loud — ×N per burst | 80 m gate: whole floor + lot | alert 0.92, `lastKnown = Sam's true pos` (`:73`), far calm men `reactT` once (`:79`), announce *"automatic fire — {where}!"* once (`:80`, `announced` per event → gate on the burst's first event) |
| SC-20K round (Sam) | `shot`, level 1, loud | same | exactly the Five-seveN's: converge on a placed fix with the walled-off error (`:75`) |
| ring launch | `prop` 0.45, who = player, at Sam | `a > 0.08` inside ≈ 9 m of path | 'huh?' toward Sam's side |
| ring on a static / prop | `prop` 0.3 at impact | ≈ 6 m | glance, `small()` memory |
| carbine mag / rifle hitting the floor | `prop` 0.2–0.5 by bounce speed, who 0 (`combat.ts:160`) | ≈ 4–8 m | as the dropped pistol's clatter today |
| Sam's `crack`/`whizz`/`debris` | audio only | — | not events (the round that caused them already was one) |

**Reactions** (new code, small and local): bursts (§3.3, R2) at the two fire sites; suppression flinch / head-down / displace / standoff
pause (§4.2, R3) as one sub-branch + three factors; stagger beside dazzle (§5, R5, two lines); `killGuard`'s drop by `def.drop` (R2);
`witnessSummary` wording learns nothing new (`'struck'` exists); found-body flow unchanged (a ring KO is a breathing body). Dialogue pool
additions (placeholders, the maintainer writes): the suppression barks, `'changing mag!'`, the airfoil `sawDrop` line, and for hard men under
Sam's fire *"that all you've got?"* when his `sup` decays from ≥ pinned to 0 without him being hit. **Escalation bookkeeping**: nothing new —
gunfire already raises everything it can; ring KOs tally as `knockouts` (`combat.ts:142`).

**Guards facing Sam's rifle** have no ranged-threat model and get none: their answer to volume of fire IS the suppression reaction now, plus
the existing cover/close/flank logic. **Guards with rifles facing the hold**: discipline holds every round (`shieldUp`), carbine or not — a
rifleman in the ring is the same man with a longer gun at `lowLong`.

## 8. Tour beat (lane R7)

**Extend 'Firefight' (stop 7, `demo.ts:212`) by ~7 s rather than add a stop** — the beat already stages the pair at the end caps with Sam
hull-down, and its caption already says "one hit drops anyone". Changes: the beat hands **posted[0] the carbine** on `enter` (`gd.weapon = new
Firearm(WEAPONS.aks74u)`, restored on `exit`), so the opening exchange is Sam's double-tap answered by a *burst* into his end cap — tracers over
the partition, splinter sparks, the screen greying and shaking once (Sam's `sup` → the post treatment; `godMode` keeps him safe as today, and
`suppressFirst` lays that first burst on the cap edge anyway). New phase between today's 0 and 1 (t 1.45 → 3.2): Sam pops up and puts **two
rounds into the cap beside the rifleman** (`puppet.aim` = cap edge 0.5 m off the man's chest, not the man) → his `sup` crosses `pinned`, he
ducks out of sight behind his cap, his laser drops — caption swap for those seconds: *"Two rounds into his cover and he gets his head down —
the same number that greys Sam's screen when the burst comes back. One rule, both ways."* — then the existing shift-west / stun / flank plays
out unchanged (the pinned man is up again by the time the can lands: `headDown ≤ 1.5 s`). `tour.ts` assertions: posted[0] fired ≥ 1 burst of
≥ 2 rounds within the first 3 s; his `supT > 0` at some frame in (1.6, 3.4); Sam's `sup` peaked ≥ 0.6; `hitFlash` never spikes (as today);
stop count unchanged (13). If R5 has landed: the 'Takedown' stop's alternate take drops the corridor man with a ring from 10 m instead of the
cross (`title: 'Ring airfoil'`, 8 s, one assertion: `dead/struck`, `player.shots` unchanged) — optional, only if the stop budget allows.
Board shots: `board_burst.jpg` (tracers over the cubicles in haze, tile crops of the streak edges and the flash shadows per CLAUDE.md),
`board_pinned.jpg` (the greyed, vignetted frame with debris sparks).

## 9. QA (`tools/qa/`) — probe families per lane, soak, tour

One file per family in the house pattern (`weapons-probes.ts`, `carbine-probes.ts`, `suppression-probes.ts`, `sc20k-probes.ts`,
`tracer-probes.ts`), registered in `probes.ts` like the grab family (`probes.ts:1889–1892`). All headless unless marked browser-only.

* **`weapons`** (R0): `pistol-identity` (record today's numbers first, then assert after the refactor: 20 clicks in 20 frames → rounds; reload
  stage callbacks at 0.38 / 1.02 / 1.38, done 1.6; empties drop a `'mag'`, partial back to `spare`; sprint cancels), `guard-identity` (an alert
  pinned guard with LOS fires single rounds 0.55–1.05 s apart, reloads 1.7 s after the 12th, `'reloading!'` once), `event-identity` (one player
  round → exactly one `shot` level 1; one guard round → one `guardShot` level 1), `muzzle-identity` (`char.muzzle` == `handR + gunDir·0.26`
  for both defs).
* **`carbine`** (R2): `burst-cadence` (rifleman alert with LOS at 8 m, 20 s seeded: every burst 2–4 rounds, intra-burst interval 0.1 s ± 1
  frame, gaps 0.9–1.6 s (+ spread/gap factors at `sup 0`), ≤ 1 round per frame), `burst-gates` (colleague scripted across the line mid-burst →
  0 further rounds that burst, `muzzleDown` set; `shieldUp` mid-burst → same; dazzled mid-burst → same), `burst-spread` (1000 seeded bursts at
  a 10 m wall: RMS radius of round k grows monotonically with k and matches `base + perRound·k` ± 10 %), `carbine-reload` (30 rounds → reload
  2.6 s, no round inside it, one `'mag'` item with the 30-box fill, `'changing mag!'` once), `carbine-hearing` (one burst anywhere indoors →
  every living guard `awareness ≥ 0.92`, exactly one announce line, `H.shots` += rounds, far men's `reactT` raised once not thrice),
  `one-shot-unchanged` (Sam standing in the open at 8 m: down on the FIRST round that hits, `hitsLeft` 1 → 0, never "hit — one more"),
  `suppress-first` (first burst of an engagement at 12 m with a partition 0.8 m beside Sam: all rounds' `hitP` within 1.2 m of the cover-side
  aim point and none in Sam; second burst aimed at the chest; flag off → first burst aimed), `rifle-drop` (kill a rifleman: exactly one `'rifle'`
  item, no `'pistol'`/`'torch'` item, his light `enabled` false within 0.9 s, holster boxes still drawn on the body, zero interactable rows for
  the item at 0.5 m), `jamb-poke` (rifleman pressed to the manager's jamb aiming through: `poked` → steps clear within 2 s, ≤ 2 direction
  reversals — no oscillation with the longer muzzle), `carbine-flashmeter` (browser-only, documented: `?paused`, dark aisle, rifleman fires a
  burst at a wall 3 m from Sam → log `player.visibility` per frame; PASS = a measurable pulse, recorded, no threshold — finding 10's "nobody
  surprised").
* **`suppression`** (R3): `sup-math` (synthetic `noteRound` calls: rounds passing at 0.3 / 1.0 / 1.7 / 2.5 m and impacts at 0.5 / 2.0 / 3.0 m
  → increments match the formula ± 1e-6; `minTravel` exclusion: a round from 1.0 m away adds 0; shooter and hit character excluded; decay
  half-life 1.1 s ± 2 frames; clamp at 1), `sup-pin` (alert pistol guard covering the corridor from the cubicle door with LOS to a god-mode Sam
  at 9 m; Sam fires two rounds into the jamb 0.6 m from his chest 0.25 s apart → within 2 frames of the second: `crouchTarget 1`, `upper
  'none'`, no round from him for ≥ 0.9 s, `canSee` false while down if the geometry says so; he fires again within 3 s of coming up), `sup-flinch`
  (one round → `anim.hit` once, keeps firing, seeded RMS spread over 200 rounds at `sup≈0.45` ≈ ×1.67 of baseline), `sup-lock` (two rounds every
  1.2 s for 12 s: cumulative head-down time < 60 % of the window AND he displaces ≥ 2 m at least once — the anti-lock works), `sup-standoff`
  (discipline OFF: observer pinned → no orbit metres gained, no flank shot for the duration; discipline ON + hostage held → guards fire 0
  rounds in 10 s → `player.sup` stays 0), `sup-friendly` (two riflemen shoulder to shoulder firing at Sam for 10 s: neither's `sup` exceeds
  0.1; a man scripted 3 m ahead in the line: rear man `muzzleDown`, front man `sup` < flinch), `sup-reset` (restart / resetGuards / player down →
  all zero; dead and held men accrue nothing).
* **`suppression-sam`** (R4): `sam-sup` (3-round burst scripted past Sam at 0.5 m → `sup ≥ 0.6`, `supKick > 0`; decays under 0.1 within 4 s),
  `sam-spread` (200 seeded player rounds at a 10 m wall: RMS 0 at `sup 0` — dead-on unchanged — and ≈ `0.07`-equivalent at `sup 1`; puppet
  non-null → 0 at any `sup`), `sam-untouched` (sprint speed, crouch speed, lockpick timing, `hitsLeft` identical at `sup 1` vs 0), `sam-settings`
  (`settings.suppress` tracks `player.sup` each frame like `hitFlash`; `down` → 0), and browser-only: pixel A/B `suppressionFx` off vs today's
  build = noise floor; on at `sup 0` = noise floor (the "zero when zero" promise); a capture at `sup 1` for the board with tile crops of the
  vignette edge and grain.
* **`sc20k`** (R5): rev 1's `rifle-cadence / rifle-reload / rifle-spread / rifle-walltuck / rifle-slot` and `airfoil-head / airfoil-lead /
  airfoil-torso / airfoil-blockers` unchanged in intent (numbers per §5), plus `sc20k-noise` (one round: identical guard reactions to a
  Five-seveN round — same awareness, same placement-error distribution over 200 seeds), `secondary-toggle` (X / 4-again: two states, RMB dead
  0.25 s, brace drops on toggling, airfoil at 0 → foregrip forced with a message), `no-scavenge` (spent ring within reach: zero rows; dropped
  rifle: zero rows; `launcher.ammo` never increases).
* **`tracers`** (R6): `tracer-count` (30-round scripted mag: streaks pushed == ⌈rounds/every⌉ + lastN overlap handled once; `fx` alive ≤ 4 at
  any frame; every streak `NoShadow|Dynamic`, `hw ≥ 0.6·mPerPx`, emissive × fade monotone ↓), `tracer-flag` (flag off → zero streaks, zero
  path flashes; pistol defs → zero regardless), browser-only: direct-pass ms during a mag dump with `tracerLights` on/off (CLAUDE.md's serialised
  `__runFrames` timing recipe), tile crops of a streak crossing the break-room haze.
* **Soak** (`soak.ts`, append-only named sections per lane — rev 1 §11 item 15 stands): stimuli `armAll` (every guard a carbine for the seed),
  `pinNearest` (two player rounds at the static nearest the nearest alert guard), `standInFire` (god-mode Sam upright in a rifleman's LOS 3 s),
  `magDumpSam` (R5), `ringNearest` (R5); invariants: `burst.left ∈ [0, 4]`, ≤ 1 round per guard per frame, `sup ∈ [0, 1]` for everyone and 0 for
  dead/held, `supT` never set on a non-alert man, `settings.suppress === 0` whenever `player.sup === 0`, `'rifle'` items only ever from
  riflemen, `guardShot` events this frame == guard rounds this frame, tracer `fx` ≤ 12, and the existing "no character inside a static"
  family extended to displacing men.
* **Tour** (`tour.ts`): §8's assertions; 13 stops still.

## 10. Lanes — parallel, with file ownership and verification seams

Ownership is by file; where a file is unavoidably shared it is by *function or line range*, named. **R0 lands first and alone (1 d).** After
it **R1 ∥ R2 ∥ R3 ∥ R6** have pairwise-disjoint write sets; **R4** needs R3's fields (or starts against a panel slider writing `Player.sup`);
**R5** needs R1's `longGun` (rigProps/character are R1's until it merges); **R7** last.

| # | lane (each shippable + testable alone) | effort | files OWNED (write) | toggle / seam | probe (headless) | risk |
|---|---|---|---|---|---|---|
| **R0** | **WeaponDef refactor, no behaviour change.** `WeaponDef`/`WEAPONS`/`Firearm`, `Pistol extends Firearm`; `fireWeapon(g, shooter, target, opts)` reading the shooter's def with today's numbers as the two defs; `Guard.weapon: Firearm` replacing `shots`/`reloadT` at `guards.ts:1512–1516` (and the standoff's `gd.shots++`); `Character.muzzleAhead`; `PatrolRoute.weapon?` (parsed, unused); `killGuard` drop kind via `def.drop` (still 'pistol'/'torch'). | 1 d | `weapons.ts`, `combat.ts` (`fireWeapon` signature + body, `killGuard` drop line), `guards.ts` (**only** `:827–834`, `:1512–1516` and the `Guard.weapon` reads), `game.ts` (`Guard` fields, ctor from route), `character.ts` (**only** `muzzleAhead` + `:1742`), `player.ts` (the three `fireWeapon` call shapes `:241`, `:725`, and `hitPlayer`'s caller if any), `scene/level.ts` (`PatrolRoute.weapon` type only), `tools/qa/weapons-probes.ts` | none — identity is the seam | `weapons` family; `gunhold`, `standoff`, `discipline`, `player`, `grab` green; tour 3/3; soak 1–3; one-shot pixel A/B at noise floor | the ~20 `pl.pistol.*` sites and `demo.ts rearm()` (`chamber = 1`) must mean what they meant; guard reload semantics (12 → `magCapacity`) silently changing cadence — the identity probe records first |
| **R1** | **Guard carbine rig + long-gun poses, viewer first.** `RIG.carbine`, `RigOpts.weapon`, guard branch of `rigBoxes`, `rigTorchPos` for the handguard lens, `COL.wood/bakelite`; `longGun` retarget in `carryArms` + aim layer, `STANCES.shoulder/lowLong/patrolLong/portLong`, climb, reload retime; viewer "Carbine" section + copy-constants. Then live: `handProps` passes `weapon` from `gd.weapon.def.cls` (3 lines), `attachFlashlight` origin (already via `rigTorchPos`), `updateGuard` sets `anim.longGun` + picks the long stance names where it writes `stance` (`:1620`, 2 lines — **coordinate with R3**, who adds a sub-branch above; R1 touches only the final pose write). | 2.5 d | `rigProps.ts`, `character.ts` (all but R0's field), `viewer.ts`, `viewer.html`, `combat.ts` (**only** `handProps` `:181–199`), `guards.ts` (**only** the pose write at `:1620` + `attachFlashlight` if needed) | `PatrolRoute.weapon` unset for everyone until R2's knob → nothing visible in play; viewer toggle is the surface | `rig-carbine`: for every long stance × stand/crouch × 8 yaws × pitch −40…+30: box count 11, owner byte = id, all finite; support hand within 3 cm of the handguard point; firing hand behind support hand along `gunDir`; no elbow above shoulder (FK heights) | finding 6 — support hand leaving the gun / elbow flips at steep pitch; the crouched `lowLong` meeting the knee; ragdolled rifleman (boxes follow `handR` — the carbine has left the hand by then: `dropped` → not drawn, as the pistol) |
| **R2** | **Bursts + report + reload + drops + who carries.** Burst record and the per-round gate loop at both fire sites; `report.announce`; `carbine` + `magDropSteel` voices; `aks74u`/`ak74m`/`akms` rows + `carbineShot` multipliers UNTUNED; `'rifle'` item kind + boxes + 30-box mag fill; `killGuard` in-hand logic for riflemen on patrol; `suppressFirst` aim offset (reads nothing from R3); `level.ts` gives Reyes the carbine; Tab *Game ▸ rifles*. | 1.5 d | `guards.ts` (**only** the two fire sites + `:80` announce + `:141–145` via combat), `combat.ts` (`killGuard`/`dropFromHand` kinds; `fireWeapon` guard-spread line gains `perRound·idx` — **the spread line `:26` is shared with R3's `spreadK` factor: R2 writes `(base + move + range + perRound·idx)`, R3 appends `·(1 + spreadK·sup)`; two commits, one line, named here so the second rebases knowingly**), `weapons.ts` (rows only), `throwables.ts` (`'rifle'` kind, radii, boxes; mag fill variant), `effects.ts` (`carbineShot` block only), `audio/sfx.ts` (two voices, append), `scene/level.ts` (route weapon values), `ui/bindings.ts` (Game ▸ rifles row), `tools/qa/carbine-probes.ts`, `soak.ts` (own section) | *Game ▸ rifles* `none` = today; `authored` default | `carbine` family (§9); soak with `armAll` seeds clean; browser: Reyes walks his loop with the carbine (silhouette, beam from the handguard), a burst down the corridor at night — flash on the walls ×3, brass, the box hitting the floor on reload, the rifle tumbling lit when he drops (tile crops) | a round leaking past a colleague mid-burst (per-round gates + probe); burst × tour Firefight timing if a beat later arms the pinned pair (R7 owns that); until R1 merges the carbine renders as the pistol rig (functional, ugly — R2 develops headless) |
| **R3** | **Suppression core + guard reactions.** `suppression.ts` (`SUP`, `noteRound`, `updateSuppression`, `headDown(gd)`, `summary()`), fields on `Guard`/`Player`, the one call in `fireWeapon`, the update call in `game.update`, the alert sub-branch (flinch / head-down / displace), standoff pause, spread + gap factors, barks (placeholders), temperament factor, Tab *Game ▸ suppression* + read-out. | 2 d | `suppression.ts` (new), `game.ts` (fields, update call, panel summary line), `combat.ts` (**only** the appended `noteRound` call after `:61` and the `·(1 + spreadK·sup)` factor on `:26`), `guards.ts` (the new sub-branch after `:1464`, `closing` pace factor at `:1494`, `standoffAlert` pause lines, bark pool entries), `ui/bindings.ts` (Game ▸ suppression rows), `tools/qa/suppression-probes.ts`, `soak.ts` (own section) | `tune.suppression` (off = scalar computed and printed, reactions skipped) | `suppression` family (§9); soak `pinNearest`/`standInFire` clean; browser: pin the corridor man from the cubicle door — he ducks, laser off you, comes up late; keep doing it — he shifts | pin-lock trivialising fights (anti-lock + `sup-lock` probe); head-down pose vs `muzzleDown` pose precedence (head-down wins; both are 'lowReady'); the sub-branch starving `standoffUpkeep`/body-duty transitions (it sits inside `case 'alert'` only) |
| **R4** | **Suppression on Sam.** `samSpread` at the two player fire sites (puppet-exempt), reticle radius by `sup` in the overlay, `settings.suppress`/`supKick` plumbing (`engine.ts` settings + `main.ts:190` + `frame`/`PostParams` third float), `post.wgsl` desat + grey vignette, grain bump in `passes.ts`, `FollowCamera.shake`, `crack`/`whizz`/`debris` voices + the play calls inside `noteRound` (behind an `audio` hook R3 leaves as a no-op), master high-shelf duck in `audio.ts`, pause-menu Graphics toggle. | 1.5 d | `player.ts` (**only** the `spread` args at `:241`/`:725` + `cancelActions`/down zeroing), `ui/overlay.ts` (reticle radius), `engine.ts` (settings fields, `post` packing), `render/passes.ts` (`postParams` third float, grain add), `render/shaders/post.wgsl`, `game/camera.ts` (`shake`), `main.ts` (settings copy), `audio/sfx.ts` (three voices, append), `audio/audio.ts` (shelf duck), `ui/menu.ts` (toggle), `suppression.ts` (**only** the audio hook body — R3 exports the stub), `tools/qa/suppression-sam-probes.ts` | `settings.suppressionFx` (picture) + `tune.suppression` (spread) — both off = today's untouched path | `suppression-sam` family (§9); pixel A/B off-vs-today and on-at-zero both at noise floor; browser: stand god-mode in Reyes's fire — pulses, grey, shake, cracks on the correct side, mix ducks and recovers | `post.wgsl` NV path ordering (apply vignette/shake under NV, skip desat); shake breaking `?paused` determinism (uses `g.time`; zero at zero); the third `PostParams` float is also what Appendix B's sticky-cam wanted — it is free now, note the claim |
| **R5** | **Sam's SC-20K slim**: slot 4 + `hasRifle` + the `slot` union widening (rev 1 finding 10: every `slot ===` test at once), `Rifle` modes/cadence/staged reload, brace, wall tuck, X toggle, RMB dispatch, `launcher.ts` (ring only: integrator, head/torso tests, stagger fields, `'ring'` item), `RIG.sc20k` + `slungBoxes` + `braced` stance + draw/sling transition (on top of R1's `longGun`), HUD slot-4 row + strip-of-two + start-card loadout toggle, `rifleSuppressed`/`launcher` voices, `sc20kShot` block, stagger beside dazzle, tour `rearm()` top-up. | 4 d | `weapons.ts` (`sc20k` row, `Rifle`, `Launcher`), `player.ts` (equipment block, slot actions generalised to `weapon()`, brace lines in the aim block, wall tuck, `grabVariant` text, `hitPlayer` drop via `def.drop`), `launcher.ts` (new), `game.ts` (`Player` fields, no-op call sites, `clearAftermath` additions), `rigProps.ts` + `character.ts` (**after R1 merges**: `RIG.sc20k`, `slungBoxes`, `STANCES.braced`, transition), `combat.ts` (`handProps` player branch: `rifle: 'hand'|'slung'`), `guards.ts` (**only** `staggerUntil` beside dazzle, 2 lines), `throwables.ts` (`'ring'` kind), `effects.ts` (`sc20kShot` block), `audio/sfx.ts` (append), `ui/overlay.ts` + `index.html` + `ui/menu.ts` (slot-4 row, strip, CONTROLS), `demo.ts` (`rearm` only), `tools/qa/sc20k-probes.ts`, `soak.ts` (own section) | start-card `hasRifle` (false = three-slot kit exactly as shipped); tour sets true | `sc20k` family (§9); `player`/`grab`/`gunhold` green with `hasRifle` both ways; browser: draw, brace pull-in on the penumbrae, AUTO down the aisle lighting Sam up (meter), ring KO at 12 m, stagger → KO, slung rifle on the back through every existing tour stop without clipping the holster or the drag pose | the union widening touching `overlay`/`combat`/`demo`; RMB overload edge cases (brace held while toggling → no accidental launch: launches on the press edge only); R1 slipping delays R5's rig half (its gameplay half can proceed with the pistol rig) |
| **R6** | **Tracers** (+ ricochet sparks, + optional path flashes): `def.tracer` read in `fireWeapon`, streak `fx` with `fade`, `fx.flags.tracers/tracerLights/ricochet`, Effects panel rows, the ms measurement. | 0.75 d | `combat.ts` (**only** an appended block after the impact flash `:66`, and the `fx` push helper), `game.ts` (**only** `:629` fade handling + the `fx` entry type at `:350`), `effects.ts` (`tracer` block: colour, hw rule, ignition distance, spark numbers), `sparks.ts` (only if `emitCone` needs a variant — probably not), `ui/bindings.ts` (Effects rows), `tools/qa/tracer-probes.ts` | `fx.flags.tracers` (off = today) | `tracers` family (§9); browser: mag dump down the corridor in haze, tile crops; direct-pass ms on/off for `tracerLights` decides its default | fireflies: none possible (NoShadow, raster + bloom only, like sparks/lasers); `fade` changing existing `fx` users (default `fade` undefined = today's hard cut) |
| **R7** | **Tour + README + board**: Firefight extension (§8), optional 'Ring airfoil' take if R5 landed, `tour.ts` assertions, README/menu prose, `docs/roadmap.json` log + the two board shots, artifact republish. | 1 d | `demo.ts` (Firefight beat; Takedown alt), `tools/qa/tour.ts`, `README.md`, `ui/menu.ts` (prose only — R5 owns CONTROLS rows), `docs/roadmap.json`, `docs/shots/` | — | tour 3/3 headless with the new assertions; browser: the two captures graded by tile crops | the burst's timing vs the beat's crouch at t 1.45 (`suppressFirst` + `godMode` make it safe; assert `hitFlash` never spikes as today) |
| later | Appendix B items; arms-locker errand at lockdown; `ak74m`/`akms` rows built and graded; guards' tracer loadouts per setting; suppression from the stun charge's overpressure; a rifleman's bipod/lean at a post. | — | — | — | — | — |

Critical path to "a guard with an AK bursts at Sam, the screen greys, Sam puts two into the jamb and the man gets his head down, tracers in
the haze": **R0 → (R1 ∥ R2 ∥ R3 ∥ R6) → R4 → R7 ≈ 10.25 engineer-days, ≈ 5 days of wall clock with four lanes.** The SC-20K (R5) adds 4 d and
can start its gameplay half the day R0 lands. Smallest thing that reads well on its own: R0 + R2 + R3 (bursts you can hear and a man who ducks
when you shoot his door frame, ≈ 4.5 d, pistol rig on the rifleman until R1).

## 11. Decisions still open (five, each with the default work proceeds on)

1. **Which guards carry the carbine by default?** Default: **Reyes only** (`lobby_break`), Kowalski and Novak keep pistols; *Game ▸ rifles*
   `none/authored/all` in the panel; tour beats arm whom they need. (Alternative: Kowalski — the corridor is the best tracer geometry, but he is
   the man the player meets most and the 08-08 note was "too hard".)
2. **Does Sam start with the SC-20K, or is it opt-in?** Default: **in the kit** (`hasRifle = true`) with a start-card loadout toggle to drop it;
   the tour forces it on. (It lands last anyway — R5 — so this can be re-decided after playing the guard lanes.)
3. **Ring airfoil count.** Default: **5, not retrievable** (no scavenging of anything; the spent ring is scenery). CT missions gave 5–10.
4. **`suppressFirst` — a rifleman's opening burst at ≥ 10 m is laid on the cover beside Sam, not on him.** Default: **ON** (the fairness valve
   and the suppression showcase in one; later bursts are aimed). OFF = every burst aimed from the first.
5. **Tracers.** Default: **carbine 1-in-3 plus the last three of the box, ON; SC-20K none; path flashes OFF until measured** (< 0.3 ms during a
   dump → ON). Say if guards' tracers should be every round (more spectacular, less plausible) or none (a darker fight).

## 12. Where today's code will fight this (so nobody is surprised)

1. `fireWeapon` hard-codes the pistol by `isPlayer` in four places (`combat.ts:30` card, `:36` gain, `:38` voice, `:87` event) and its guard
   spread is a literal line (`:26`) — R0's options bag must default so the three existing call shapes (`player.ts:241`, `:725`, `guards.ts:1514`
   / `:831`) mean what they meant; R2 and R3 then each add ONE term to `:26` (named in §10).
2. `Guard.shots`/`reloadT` are bare ints read by the alert branch, the standoff (`S.shots`), `standoffSummary` and at least one probe — grep before
   deleting; `Firearm` should expose `shotsFired` so the summaries keep a number.
3. `killGuard` decides what was in the hand from `state === 'patrol' && !drawn` (`combat.ts:141`) and `handProps` decides torch-vs-pistol the
   same way (`:193–195`) and so does `attachFlashlight` (`guards.ts:1632`) — three copies of "what is he holding"; a rifleman breaks all three the
   same way (he holds the carbine in every state). Make it one function `inHand(gd): 'torch' | 'pistol' | 'carbine' | null` in R0 and have the
   three read it, or R1/R2 will each patch two of the three.
4. `Character.muzzle`'s constant (`character.ts:1742`) and everything measured from it: `armThrough` (`combat.ts:94`), `laserBoxes` (`:205`),
   the eject port offset (`:35`, `handR + gunDir·0.06` — per-def too: the AK ejects well ahead of the hand, the F2000 at the front), the shot's
   smoke-domain anchor (`effects.ts:143`: "the ejection port sits 0.20 m BEHIND the muzzle" is a pistol fact baked into a comment and a 0.38).
5. `carryArms`' rigid two-hand grip (finding 6) — the support hand must be re-targeted, not offset, or it floats beside the handguard at every
   pitch; and the aim layer is a CLIP (`Pistol_Aim_Neutral` arms at full weight when `upper === 'aim'`), so the long-gun retarget has to run
   over the aim layer too, not only over the stance carry, or a rifleman snaps to a pistol hold the moment he aims.
6. `rigBoxes`' guard branch is an if/else on `o.torch` (`rigProps.ts:273–285`) with box counts baked into the `meta` pushes (viewer gizmo) —
   the third arm must push its own counts or the viewer's node list desyncs.
7. `hearingCheck`'s per-event `announced` flag and per-event `H.shots++` (`guards.ts:66`, `:80`): a burst is N events. The announce must key on
   the burst (first event carries `burstId`; later ones inherit `announced`), the count should stay per round. `reactT` is already once (`:79`).
8. `fireCd` is shared state between the alert branch and `standoffAlert` (both decrement it, `:827`, `:1505`, and the shield floors it, `:834`,
   `:1511`) — the burst record must be cleared wherever `fireCd` is floored for the shield, or a burst begun the frame before a grab resumes
   the frame the hold ends, ahead of the release beat.
9. The alert branch's movement sub-branches (`closing` / `lineStep` / hold, `:1492–1502`) each write `moveSpeed` and `gd.speed`; the head-down
   sub-branch must sit ABOVE them and `break`-equivalently skip them (shape it like the `reactT` branch, which already does), or a pinned man
   slides along his path crouched.
10. `c.anim.crouchTarget = 0` is written unconditionally for guards at `:1620` — the head-down crouch has to be threaded through that final
    write (a `crouch` local like `upper`/`moveSpeed`), not set earlier and stomped.
11. `PostParams` is 16 bytes with the third float free (`passes.ts:211`, `:411`) — enough for `suppress`; if `supKick` wants its own float the
    buffer grows to 32 and the WGSL struct with it (alignment: vec4 pairs). Prefer packing `sup + 0.5·kick` into the one float (§4.3).
12. `FollowCamera.rebuild()` can run more than once a frame (`camera.ts:22` comment) — the shake must be a pure function of `g.time`, not
    accumulate per call, or a second rebuild doubles it.
13. `overlay.updateEquip`'s hand-listed change key (rev 1 §11 item 13) — slot-4 fields, and now the reticle radius input (`sup` bucketed to
    0.1) or the ring redraws every frame / never.
14. `Throwables`' FIFO cap of 32 evicting `mag`/fired first (`throwables.ts:46`): a mag-dumping rifleman produces a `'mag'` every 25 s and Sam's
    AUTO produces empties too — fine, they are exactly what the cap is for; `'rifle'`/`'ring'` items are ordinary and may be evicted (nothing is
    lootable, so nothing of value is lost — the rev 1 "never evict pickups" rule is moot).
15. The tour's `rearm()` (`demo.ts:88`) and every beat that sets `slot = 1`, plus the Firefight beat's direct pokes at `g.player.pistol.mag/
    chamber` (`demo.ts:214`) — R0 keeps `pistol` as a name; R7 arms posted[0] and must disarm on `exit`/`release()` (`:86`) so no later stop
    inherits a carbine.
16. `soak.ts` is one file four lanes extend — append-only named sections per lane, merged in R-order (rev 1's rule, still the cheapest fix).

## Appendix A — rev 1's open questions (§10 there), resolved

| # | rev 1 question | status | resolution |
|---|---|---|---|
| 1 | Kit order / presence of the SC-20K | **open → §11.2** | slot 4 appended (no re-ordering); default in the kit with a start-card toggle |
| 2 | Which attachments make v1 | **answered** | *"only the ringfoil and foregrip as secondaries, keep it simple"* — shocker, camera, gas, shotgun, 20 mm → Appendix B |
| 3 | PiP vs cut for the sticky camera | **obsolete** | no camera in v1; the cut-not-PiP analysis is kept in Appendix B for the day it returns |
| 4 | Does gas affect Sam | **obsolete** | no gas in v1 (Appendix B keeps the half-rate proposal) |
| 5 | Rifle loudness vs the pistol | **answered** | *"okay if it's not materially louder than the pistol"* — SC-20K at level 1, `flashGain 0.55`, suppressed voice; the pistol stays floor-loud; the guards' carbine is level 1 too (finding 1) with a bigger flash and report |
| 6 | Grab with the rifle up | **default stands** | arm variant, rifle to the sling (uncontested; simplest) |
| 7 | `L` with the rifle | **default stands** | nothing (keep it simple) |
| 8 | Retrieval bookkeeping (rings, cams) | **answered by the scavenging call** | nothing is retrievable or lootable in v1; counts are what you brought |
| 9 | Shocker chaining | **obsolete** | no shocker (Appendix B keeps the contact-chain adaptation) |
| 10 | Burst stop for Sam | **closed: no** | bursts are the guards' behaviour; Sam has SEMI/AUTO |
| 11 | Tracer path-light threshold | **open → §11.5** | measured in R6; default off until < 0.3 ms |
| 12 | One two-cut tour stop or two | **obsolete** | no gas/cam beat; §8 extends Firefight instead (13 stops) |
| — | (separate) magazines from dropped pistols | **answered** | not lootable — calibres don't match; lane `no-mag-pickup` removes the row |

## Appendix B — later (cut from v1; analysis kept so it need not be redone)

(Condensed from rev 1 §3.4–§3.6 and findings 3–5; the shader / smoke line references in this appendix are rev 1's, against `628432d` —
re-check them before building any of it.)

**B.1 Sticky shocker** (rev 1 §3.4). Adhesive dart, 40 m/s, sticks on first contact; on a man anywhere = KO (`DownKind 'shocked'`, breathing)
with 1.2 s of ragdoll twitch (`rag.addVelocity` on random limbs every 0.08 s); on a surface = 1 s of arcing and spent. Three blue-white
`lights.flash(p, [0.55,0.7,1], 14, 5, 0.06)` at 0/0.22/0.5 s + two spark bursts — the renderer moment (a corridor lit blue for a quarter
second, hard shadows swinging off the falling man). CT chained it through water; the adaptation was **contact**: a second man within 1.1 m
centre-to-centre with no `solidBetween` takes it too, and a dart on the floor within 0.5 m of a man's feet gets him. Noise: `prop` 0.4 at the
dart + a seen-not-heard `flash` event (the `lightOut` twin, `guards.ts:51`) pulling a calm man over to a scorch mark. New `DownKind`s are free
everywhere that matters (`isBreathing` is `downKind !== 'shot'`). ≈ 0.75 d on top of a launcher framework.

**B.2 Sticky camera** (rev 1 §3.5, finding 4). Plant on statics (normal from the hit face; ceiling allowed — it is real geometry to rays,
only `NoPrimary` to the raster), `V` to look through it, LMB lure chirp (`prop` 0.65, `who 0` — "a clatter the room cannot explain" — pulling a
calm man to `heardAt`, i.e. the cam or the doorway the sound came through), RMB one gas puff. **The view is a full-screen CUT, not PiP**: every
lighting pass is a per-camera screen-space chain with ~30 sized targets and temporal histories keyed to one GBuffer + frame UBO
(`passes.ts`); a 400×250 inset needs a second GBuffer + `LightingPasses` + UBO/bind group (≈ 1/16 per-pixel work + ~1 ms of fixed per-pass
overhead for ~10 extra passes ≈ 10–12 % of a 'high' frame) and days of `engine.ts` surgery with a permanent two-of-everything tax; the cut
needs `FollowCamera` posed at the cam (any eye is expressible), the ceiling rasterised while the eye is under it (a second `visible` index
list including `NoPrimary`, chosen per frame, `boxes.ts:173`), `near 0.1`, history reset on enter/exit as on any tour cut, and a `camFx`
scanline/vignette/barrel look via the spare `PostParams` float (which R4 now claims for `suppress` — a returning sticky cam packs both or
grows the struct, §12 item 11). ≈ 1 d for the cut, 0 ms; PiP stays documented, not planned. Stretch: an IR illuminator light bit honoured only
under `FLAG_NV` and never by the probe (humans do not see 850 nm) — physically exact, ~1 d across four shaders with an NV-off bit-identity A/B.

**B.3 Gas grenade + CS gas in the smoke solver** (rev 1 §3.6, finding 3). The solver can carry an agent concentration almost free: `densA/densB`
are `rgba16float` with density `.x`, temperature `.y`; `advectScalars` MacCormack-advects and stores the whole `vec4`, occupancy keeps a brick on
`any(d != 0)`, the flush is component-wise; only `injectDecay` is channel-aware and the emitter record has two spare words. So agent = `.z`: one
emitter word, one decay line (`agentDecay 0.05/s`, half-life 14 s), the edge band on `.z`, `smokeAgentAt()` beside `smokeDensityAt`
(`common.wgsl:499`), probe query kind 2, and the one trap — the render occupancy test is `.x != 0` only (`smoke.wgsl:548`) and must widen to
`.x != 0 || .z != 0` in the same commit (still lossless). Doses game-side (`gas.ts`): one probe query per living head (≤ 7 of the probe's 32),
`Game.gasAt` swappable like `lightAt` for the headless table; cough at 0.25 (slow, spread ×2.5, cannot radio, flees to a clean cell ≥ 3 m from
the pop), KO at 1.0 (`'gassed'`, breathing); a man reaching clean air radios *"gas!"* and raises the floor like a found body; `goTo` refuses
goals inside a live gas domain for 25 s (`Domain.tag`). Sam at half rate with a cough the guards hear (`prop` 0.4 at Sam — his own gas can give
him away) and down at 1.0, godMode exempt — or immune (was rev 1 Q4). The canister flies as a `Throwables` item (`'gasnade'`, bounces off the
jamb into the room, bursts on the second bounce or 1.5 s after the first) with a coarse-lattice emitter set UNTUNED (`burst` + `feed`, pale
visible cloud so sight lines degrade through the existing `smokeTrans` with no extra rule; optional volumetric albedo tint toward
`[0.86, 0.9, 0.6]` by agent/density). Guards must refuse gas when `smoke.params.enabled` is off. ≈ 2.5 d solver+doses, +1.5 d AI words/flee.
The tour beat drafted for it (crack `breakroom_n` with hold-Space, canister through the gap, the cloud leaking along the floor into the
corridor, Reyes coughing and folding under the panels with the sodium wedge through `breakroom_ext`) is the best renderer beat in this
document and the reason to come back to it.

**B.4 SC-20K shotgun and 20 mm 'sniper' modules** — lethal variety the demo does not need; the shotgun would want a pellet fan through
`fireWeapon` (8 × spread 0.12, each a full trace: 8× the direct cost of a shot for one frame — fine) and the 20 mm a camera mode.

**B.5 5.56 / 5.45 through partitions** — physically right for fabric-over-chipboard, but the firefight beat, the guards' `clearShot` cover
model and suppression's "the round stopped in your cover" term all assume partitions stop rounds; a thin-static continuation in
`col.raycast` plus teaching `clearShot` about it is its own design note.

**B.6 Arms locker at lockdown** — the post man (or the pair's #2) runs a `GuardTask` to the storage room and comes back with a carbine
(`gd.weapon` swapped at the locker, the pistol holstered): escalation you can watch happen and interdict (the storage door is lockable and
the breaker is in there). Cheap after R2; needs one locker prop and one line.

**B.7 Guards spotting planted cameras, cams riding door leaves, waking KO'd men** (grab doc 9b), **the pistol made room-loud instead of
floor-loud** (rebalances every beat — its own note), **PiP** — all as rev 1 listed them.
