# The player: kit, guns, hands

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 261–270 -->
- **A raised gun comes down at a wall** (`src/game/gunwall.ts`, `GUNWALL.on`: on in the page, `?nogunwall` = off = the build before it; frozen stand off, `TPS_GUNWALL=1`; Tab ▸
  'guns come down at walls'). A gun that is up (the aim, the high port) and whose own line meets a static or a leaf inside its reach goes to the low ready through `Guard.muzzleDown`
  (the bit `guards.ts muzzleCheck` sets for a colleague in the line — pose, fire gates and the laser already read it), with a lead for his closing speed and a down / up band; the
  low carriages are then pulled in by the room they have (`CharacterAnimator.gunWall` 0‥2 toward `character.ts WALL_TUCK`). A man with an enemy in his sights (`hot`: the alert
  branch, a script's `over` — and, `GUNWALL.fightS` 5 s, EVERY man while anybody on the floor is in a fight and that long after: Tab row 'in a fight, guns stay up at walls', 0 = only
  the man with the target; a hot man's gun is back up the frame the wall lets go. Measured over 39 shipped runs: fightS 0 leaves a gun in a wall on 1.2 % of armed man-frames
  and the team wiped in 12 runs, fightS 5 on 1.7 % and wiped in 6; the rule off 3.1 % and 7) is lowered only when the gun IS in the wood — that round died in the panel anyway (`combat.ts armThrough`) — and then moves for a line (guards.ts
  `poked`, `roomfight.ts` walkOn / sideStep); pinned men and showcases are left alone; Sam: the same test, no round while it is down — except his breaching shotgun laid on a LOCK (`breachAim`: the raised gun's line meets a locked, latched leaf
  within the pattern's `latchM` of its latch edge): it stays up pressed to the leaf and the shell goes, as a teammate's always did (`probes.ts shotgun-door` under `TPS_GUNWALL=1`). Checked by `probes.ts gunwall` (also under
  `player`) and counted in every play-through by `tools/qa/gunwall-watch.ts` (`PT_GUNWALL=1` → `gunwall` in the run's JSON; `PT_GUNWALL_TRACE='Red Two:21:23'` = that man frame by frame).

<!-- was CLAUDE.md lines 328–357 -->
- **Three small player rules from the 10-10 play notes** (each a `FROZEN_HOLDS` row, in the knob registry and a journal's tables; `probes.ts startfile` / `autoreload` / `quickthrow`): (1) THE TEAM
  STARTS FALLEN IN (`src/game/startfile.ts START.fallIn`: on in the page, `?nofallin`; frozen stand off, `TPS_FALLIN=1`): the night breach and every room clear stage the men on the menu's own
  'fall in' (`teamStartsFallenIn`, unspoken, not on `orders.log`) (Tab ▸ Sandbox ▸ Night breach ▸ 'team starts fallen in', read at the next staging); the RESCUE is not staged so — its men are held until its clock starts and fall in then (staged fallen in, a man of the pair shot a
  roamer through the conference glass before Sam moved). (2) A DRY GUN RELOADS ITSELF (`src/game/autoreload.ts RELOAD {auto, delay 0.25}`: on in the page, `?noautoreload`; frozen off,
  `TPS_AUTORELOAD=1`): the gun in the PLAYER's hands, empty with a magazine left, starts its reload through the R key's own line of player.ts a beat after the last round (asked every frame, nothing
  latched: a reload a sprint / holster took away starts again); R is still his for a part-spent magazine; AI men always reloaded by themselves. Tab ▸ Sandbox ▸ Weapons & rifles ▸ 'reload by itself when dry' + 'auto reload delay s'. (3) THE G QUICK THROW IS GONE FROM THE PAGE
  (`src/game/quickthrow.ts QUICKTHROW.on`: off in the page, `?quickthrow`; the one row the FROZEN stand has ON — its probes and a recorded session press G (the soak does not) — `TPS_QUICKTHROW=0`): a
  can is thrown from its slot (3 / 4 / 5) with a click; the order menu's own G row (`FRAG.orderKey`) stays. Tab ▸ Sandbox ▸ Player, doors & props ▸ 'G quick throw'. Training 4 lost its quick-throw step.
- **THE LAST MAGAZINE, SEATED AND NOT RACKED, IS STILL A RELOAD** (`src/game/autoreload.ts RELOAD.lastMag`: on in the page, `?nolastmag`; frozen off, `TPS_LASTMAG=1`; a
  `FROZEN_HOLDS` row, in `RELOAD`'s registered table, and a journal from before the key replays with it off). The flaw: a reload of the last magazine broken off between
  'magazine in' and the rack (a sprint, a holster, a takedown: a half-second window on the plain row) left a full magazine under an empty chamber with nothing spare;
  `Firearm.startReload` refused it for want of a spare ('no spare magazines' over a full gun), the dry-gun rule skipped it for the same reason, and the gun never fired
  again. On: `startReload` takes that one state (the magazine comes out to the spares, goes back in, the handle is racked: mag 29, a round up), and `autoReloadDue` counts it
  as a reload to come (with the dry-gun rule off, a click there still says 'reloading…' until R is pressed: player.ts's own line, not touched). Any Firearm, so an AI man's gun in that state too; no man was found who reaches it. Check: `tools/qa/autoreload-check.ts`
  lines (5c) and (5d) (`probes.ts autoreload`), `LASTMAG_BREAK=1` must fail (5c); run on both stands. No Tab row. Measured: nothing; the state was made by the check's
  own sprint. Nobody has played it, and it has never been seen on a GPU.
- **The player and his own side** (`src/game/friends.ts FRIENDS {noSnap, lowReady, reachM 8, pastM, clearM, upSecs 0.25, quietS 5}`; two `FROZEN_HOLDS` rows, in the knob registry and a
  journal's tables; `probes.ts friends` = tools/qa/friends-check.ts, also under `player`, passes on both stands, `FRIENDS_BREAK=1` must fail). (1) NO RETICLE ON A FRIEND (`noSnap`: on in the page,
  `?friendsnap`; frozen stand off, `TPS_FRIENDS=1`; Tab ▸ Player, doors & props ▸ 'no aim ring on teammates'): player.ts `updateAim`'s three loops pass over a man not hostile to the player
  (`friendNoSnap`) — no ring, no snap point, never `g.aimGuard`; the cursor's own ray landing on his body first is kept as `g.aimFriend` (the nearest body on the ray decides: a hostile behind
  him is not ringed through him — and the LIGHT the reticle had on a fixture's dot before the ray found that hostile is put back, so the right button's OCP still takes it). (2) SAM'S GUN COMES DOWN OFF A FRIEND OUT OF A FIGHT (`lowReady`: on in the page, `?nomuzzle`; frozen off, `TPS_MUZZLE=1`; Tab row 'gun lowers off a
  teammate'): `samOffFriend` is a third term of player.ts's `walled` seam (the one a wall and a stun lower his gun by: low carriage, no round or launcher, a line on a click — 'gun down — <callsign>
  is in your line'): a raised gun with a teammate or a rescue's hostage in the line it is held along, no farther than what it is aimed at (a friend BEYOND the man under the reticle does not
  lower it), nothing solid between — or, the aim free, the cursor on his body — while nobody is in a fight (`friendsInFight`: inside `quietS` of Sam's last round or of the last loud thing in a
  living teammate's ears, or a man hostile to him alert / searching). Down at once, up `upSecs` after; never on the wall hold, with a man held or hauled, under a show / puppet. State
  `Player.friendLow / friendT`, not saved. Never played by anybody.
- **Friendly fire** (`src/game/friendlyfire.ts FRIENDLYFIRE {on, coneK 0.75, bodyM 0.34, sureM 0.2, care, words, nearM 0.6}`: on in the page, `?nofriendlyfire`; frozen stand off,
  `TPS_FRIENDLYFIRE=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables; Tab ▸ Player, doors & props ▸ 'friendly fire'; `probes.ts friendlyfire` =
  tools/qa/friendlyfire-check.ts, also under `player`: 13 lines, passes on both stands, `FRIENDLYFIRE_BREAK=1` — the bodies without the care — fails 7 on each). Until this rule a round found
  only men of a side hostile to the shooter's. On, for Sam's side (Sam and his operatives; never the night staff, a defender, a civilian or a show's cast): (1) BODIES — combat.ts `fireWeapon`
  scans the men of the shooter's own side too (`ffBody`: living, on his feet): Sam's round into a teammate does what a defender's round does to him (wounds.ts decides by where it landed;
  the log's '<callsign> down — your round', or '<callsign> hit, down and breathing — your round'; a mate's round names the mate), a teammate's round finds Sam and the other teammates the
  same way. Only the ENTERING hit counts on a man of his own side (a muzzle already past a mate's shoulder is past him). A teammate he downs is not a kill or a knockout on the card. God mode
  keeps Sam's own body out of it and nothing else: his rounds still down a teammate. (2) THE CARE — `friendInCone`: a teammate does not press with a friend anywhere his round COULD go — the
  cone `coneK` × the spread the round is about to be given, a body `bodyM` wide, as far as the round flies through what it pierces (glass; a thin wall or a leaf while wallpen is live), past
  the man he is on unless the round cannot miss that man (`sureM`); asked of the friend's middle, head and both edges of his column; no foreknowledge of the die. Two seams: the room fight's
  gate (roomfight.ts `tickOp`, beside its own `friendInLine`: the same hold, side step and letting go; `sideStep` vets a spot with the cone too) and `fireWeapon` itself for every other place a
  teammate's round is born (`ffUnpressed`: not pressed, counted; a lock shell at arm's length is exempt). (3) WORDS — `ffPast`: a teammate the player's lead round passes within `nearM` of
  his head or chest says suppression.ts's 'watch your fire!' lines on their own clocks. The reticle was already enemies-only (friends.ts `noSnap`, above; civilians were never in its
  loops) — the check sweeps the cursor over a teammate and a defender to say so. The low ready (above) is kept: out of a fight his gun still comes down off a teammate. MEASURED (headless,
  the shipped stand, hard, a scripted commander who never fires; 8 squad missions × seeds 1-5, 40 runs an arm): on — 0 rounds of a teammate's into a friend in 268 room-fight rounds, the
  cone held 28 frames that the lane had not (all in the pair's room clear), 0 unpressed; off, and on without the care — 272 rounds, 0 into a friend either, the two arms the same to the
  last digit: these missions never put a friend in a teammate's round as it was, so the play does not show the care working — the staged check does (care off: the round goes into Sam, into
  the mate). Ends, men up and hostiles left are the same in all three arms (25 of 40 won, 61 of 130 up); seven of eight missions are the same to the last digit on and off. The real page on
  the software adapter: one click at a teammate three metres off downs him and names Sam's round; with `?nofriendlyfire` five rounds pass through him. NOT DONE: the net in `fireWeapon`
  returns after its caller has spent the round (cover fire, the fight AI's own trigger: the count is not given back); teammates do not keep out of SAM's line of fire; defenders among
  themselves and the squad's rounds past a hostage are as they were. Never seen on a GPU, never played by anybody.
- **A blast does to the player what it does to anybody** (`src/game/samstun.ts SAMSTUN {on, blindRoots, fade}`: on in the page, `?nosamstun`; frozen stand off, `TPS_SAMSTUN=1`; a `FROZEN_HOLDS` row, in the
  knob registry and a journal's tables; `probes.ts samstun` = a guard and Sam the same distance from one blast). Two stamps on `Player`, the Guard's own names: `staggerUntil` (frag.ts `blast` on a
  'wounded' player — written whatever the switch says, under `FRAG.samStun` — and a defender's stun canister in a room fight) = feet rooted (`samRooted` before the walk keys), the gun at the low
  ready through player.ts's `walled` seam, no round or throw, `anim.clutch`; `dazzledUntil` (combat.ts `detonateStun`, the guards' own rule copied for his eyes: the night game's line of sight inside
  `bang.dazzleRadius`, or the room fight's `FLASH` — A CAN HE HAS A LINE TO is a defender's count on him whoever threw it, the full `secs` + `stagger` (`SAMSTUN.ownSeen`, on; the maintainer: "it should totally be possible to flash yourself with a bad entry" — a teammate is spared his own side's can because the drill turns his head, nobody turns the player's; off = the own-side rule his teammates get: only inside `ownM` for `ownSecs`, no stagger); with no line his own side's can is that own-side rule and a defender's the concussion's half) = the picture white (`#blind`,
  overlay.ts `samBlind`, clearing over `fade`), the reticle takes nobody, `sup.v` held up, `anim.dazzle`; his FEET AND TRIGGER STAY HIS while blind (`blindRoots` = rooted too, as a blinded AI man is).
  FOLDED, HIS HANDS DO NOTHING: no Space row is performed (interact.ts), no takedown or grab starts (game.ts updateDoors), a man in his arm goes loose (`freeHeld`), Q neither takes nor leaves a wall, and
  on the rifle stack (player.ts `stackUp` / `stackLean`) the rifle stays at the low ready and he neither steps out round the corner nor back in — he stands where it caught him (`samstun-check` line 13) —, and `foldCancels` (also called by frag.ts while the switch is on) puts a can in the wind-up back on his belt and stops every sustained verb (`cancelSustained`). `samStunPose` runs right after the down test
  in EVERY player state and takes its pose off when the stun ends or the switch is thrown (`Player.stunPosed`). WHOSE CAN: `detonateStun(g, it, borrowed, sam?: { side, spare })` — a caller that swaps the
  thrower off `g.guards` for the call says whose can it is (teamOfId would answer 'guard'): doortools.ts `bang` passes `side: 'operative'` and `spare` = Sam on the team's side of the door inside 5 m (the test it spares its own men by: with no line to the can nothing reaches him there, not the own-side rule either — WATCHED through the doorway it is the full count all the same, unless `ownSeen` is off), breach.ts's drill `side: 'operative'`; a NEW caller that swaps the list must pass it too. The guard loop's own `side` is untouched (frozen digests).
  God mode changes none of it; never under `g.puppet` / `touring`. Both stamps ride a checkpoint only while running (`stagU / dazU / dazAt`). Tab ▸ Sandbox ▸ Player, doors & props ▸ 'blasts stun the player too' (+ all-knobs rows 'blinded: feet rooted too', 'your own flash blinds you in full'). Not done: the native overlay has no white,
  a blind Sam still lifts the fog of war, R and the digits still work while folded, and beyond a blown door he is dazzled, never felled, whatever the squad's size. A DOOR CHARGE (doortools.ts `blow`, which borrows `detonateStun` with the guard list emptied: the can's rule is skipped for him there, `!borrowed`) dazzles him as it does a teammate: within `backblastM` on its own side, or beyond the door inside `stunM`, with nothing solid between, for `backblastSecs` — never felled. A WALL CHARGE (wallcharge.ts `blow`, the same borrowed call) does the same by the wall charge's own numbers: on its side inside the reach with a line to it he is blind the seconds a teammate standing there gets (`safeSecs` by distance under `WALLCHARGE.safe`, else `backblastSecs` inside `backblastM`), beyond a wall it opened inside `stunM` he is dazzled `backblastSecs`, never felled — on top of the knock and the held trigger `WALLCHARGE.safe` gives him whatever this switch says (`wallsafe-check`'s 'stun rule' lines). Never seen on a GPU.

<!-- was CLAUDE.md lines 1929–2033 -->
- **Sam's kit + his FN2000** (docs/internal/sc20k-design.md §5, lane R5; re-slotted 08-08): `Player.slot` is a `SlotKind` ('pistol' | 'rifle' |
  'smoke' | 'flash' | 'frag'); the digits and the kit column's numbering are `KIT_ORDER`'s alone (game.ts: 1 pistol · 2 rifle · 3 smoke · 4 stun · 5 frag (frag.ts; G never throws one) — stable
  per item: a kit without the rifle keeps 3 / 4 and shows row 2 greyed). Every "what is in his hand" rule reads an accessor, never a digit:
  `pistolUp` (= the old `slot === 1 && !holstered`), `rifleSel`, `rifleUp`, `gunInHand()`, `firearm`, `canisterSel` (THE rule for a can in the
  fist: player.ts throws by it and combat.ts `handProps` draws by it — the 08-08 'smoke can beside the rifle' bug was the fist keyed to 'any slot but
  1'), `braced` (a getter: rifleUp && !sprinting && !kick — the rifle is braced and SHOULDERED whenever it is in the hands; no brace input, no pace
  cap; RIFLE_SPREAD.braceK 0.45 is simply its in-hand steadiness, aim.ts reads it via `AIM_HOOKS.playerExternalK`). The row is `weapons.ts` `fn2000`
  (id/short 'FN2000'; SEMI 0.2 s / AUTO 0.1 s per `auto`, 30+1 [30,30], reload 2.4 staged 0.5/1.5/2.0, level 1, voice `rifleSuppressed`,
  `muzzleFx.sc20k` UNTUNED; `rig: 'sc20k'` — the rig group / `RIG.sc20k` / `SC20K_TAG` / the design doc keep the old name) carried as `Player.rifle:
  Rifle` (+ `lightOn`, `mode` on Z, `attachments: RifleAttachment[]` = ['ring', 'he40'] (weapons.ts; he40.ts = the 40 mm round) + `attIdx` → `attachment` (one of the two is ALWAYS up on a rifle, ring on a fresh one; −1 only on the shotgun, which has none), `cycleAttachment()` (flips the two),
  `rings`/`ringCd`); `Player.hasRifle`: the FN2000 is always in the kit now (`Game.fn2000` / `setLoadout` stay for the harness only). Keys (player.ts): `1‥5` select (2 AGAIN with the rifle up = flip its launcher's load, ring ⇄ 40 mm, never 'none'; 2 with it slung = draw), `E` holster /
  sling, `Z`, `L` (light of the selected gun), `R`, `G` quick-throw (slings the rifle; GONE from the page — quickthrow.ts, frozen stand only) — `X` / `T` / `B` (and the middle mouse button) are the squad orders' keys (the *Squad orders* bullet: dead keys with no operative unit on the floor). Buttons: LMB = rounds from the
  gun in hand (always rounds off the rifle) / a throw with a can up / the takedown holstered-behind (non-lethal: killGuard quiet 'struck'); RMB
  with the pistol = `g.ocp` on the snapped light (the reticle takes a LIGHT only with the cursor within `AIM.player.lightSnapPx` 14 px of its dot or on the fixture's own drawn
  box, keeps it while the cursor stays put, and takes a man from aim.ts `SNAP_PX` 60 px — Tab ▸ Sandbox ▸ 'aim ▸ you: snap to lights, px'; the headless harness stands at 60,
  the reach every frozen digest was recorded under: standup.ts; `probes.ts aim-snap`) OR the lit torch of `aimGuard` (lighting.ts `ocpable(g)` is the one test — a man with no light
  burning: no affordance, nothing happens); RMB with the rifle = its launcher, whichever load is up ('ring' → `fireRing` at `ringAimPoint`, 'he40' → he40.ts `fireShell`): the PRESS begins it
  (`Player.launchHeld`, the arc previewed while the button is down), LETTING GO sends the round — a tap fires at once, a click inside the equip beat goes as the beat ends,
  Esc / blur / an order menu / a frozen frame / the rifle leaving the hands drop it unsent (`player.ts launchCancel`); the shotgun has no launcher: nothing, one-time msg over a light, `Player.ocpHinted`). overlay.ts no longer words the right button beside the reticle (the
  `<i>` in `.reticle` carries ONE word, the 40 mm's '40 MM · TOO CLOSE TO ARM'; 'RMB  OCP' / 'RMB  RING' / 'RMB  40 MM' went on the 10-11 play note); the kit column (each gun's magazine pips on a line of their own under its row: index.html `#equip .rounds`) = strip `L LIGHT · N NIGHT VISION`, row 1 pistol + `span.tag.ocp` meter,
  row 2 rifle (`tag on` mode, two `tag rings`, the load that is up lit; `.slot.absent` without the loadout), rows 3 / 4 cans, row 5 the frag grenade (`KIT_ORDER`). `holstered` with the rifle
  selected = SLUNG; `equipT` = RIFLE_EQUIP_SECS of no fire after any change involving the rifle; the grab, the wall, a G quick-throw sling it
  (setHolstered); `armRifle` arms `anim.longGun` with `sc20kGrip`/`sc20kMuzzleAhead`, sets `anim.longSteady = 1` and FORCES `longStance` (sprint / kick / door →
  portLong, aiming → shoulder — always, in the hands; lowLong / patrolLong only if the brace rule is ever relaxed) — the R1 solve, one LONG table per
  POSTURE for both long guns (`LONG` standing, `LONG_CROUCH` crouched, lerped channel by channel by the crouch shown ahead of the carriage springs,
  character.ts `longTargets`; + `LongShape.steady` × `anim.longSteady`, guards' `longSteady` 0; the viewer's *copy LONG tables* pastes LONG + LONG_CROUCH +
  LONG_STEADY over the three statements); `poseGunLight` poses the ONE `Player.light` off whichever gun is in hand. rigProps `RIG.sc20k` (11 boxes tagged
  `SC20K_TAG`, `gripL` = the fist round the foregrip post, `slung {off, bore, roll, follow}` = flat across the BACK in the back's own frame: spine line hips →
  shoulder-mid × the hip / shoulder lines blended by `follow`, off the mid-back joint), `RigOpts.rifle 'hand'|'slung'|null` — combat.ts `handProps` puts it
  in exactly one place (and passes rigProps' `slot` as 1 = pistol in hand / 0 = not: it never was the kit's number). QA for how it is held: `probes.ts
  rifle-carry` (sway bounds per gait, both hands through sprint/stop/wall transitions, slung geometry). launcher.ts `RING` (30 m/s,
  drag, gravity; `Character.rayHit` body: at/above neck−0.07 → `killGuard(…'struck')` quiet + 'prop' 0.3, lower → `staggerGuard`
  (Guard.staggerUntil 1.5 s: guards.ts roots him like the dazzle, gun lowered, no round; awareness 0.92 → alert; fix 4 m back up the line; yelp),
  statics/props → clack 'prop' 0.3 who 0 + a 'ring' item; launch 'prop' 0.45; never suppression, never lethal, rings never rise), `ringSolve` =
  the preview (throwPreview polyline), `Game.rings` stepped after the player. A man out cold (struck / choked / ringed) shows 'zz' over him,
  'out cold — breathing' on his body row and in the log, 'knocked out (breathing)' on the debrief card.
  QA: `probes.ts fn2000` (alias `sc20k`: rifle-cadence/reload/spread/slot/suppression + `kit-slots` — digits, fist per slot, column, RMB matrix,
  loadout off — + `airfoil` head/torso/miss/preview/hostage; kit-slots is in `player` too), `soak.ts --rifle-per-min N`.
- **The issue kit = 2010s GWOT over the Splinter Cell kit** (`src/game/gear.ts`, ONE switch `GEAR.on`: ON in the page — `?oldgear` = the kit as the bullet above has
  it, Tab ▸ Sandbox ▸ Player, doors & props ▸ '2010s issue kit', `__gear` — OFF in the module and on the frozen harness stand, `TPS_GEAR=1`; a `FROZEN_HOLDS` row, in
  the knob registry and a journal's tables). WORDS AND DRAWN BOXES, AND ONE NUMBER (the maintainer, 10-10: "yeah switch to 15 rounds for the glock, 40mm sponge
  round sgtm (and redo the assets), and just call it the mk18"): off = the build by run digest; on = the same RUNS, but the digest's `player.pistol` field reads
  `1+15/15,15,15` for `1+10/10,10,10`, so the folded digest words differ from off (two scripted runs: every other field equal). SO EVERY FROZEN-DIGEST PROBE IS RED UNDER `TPS_GEAR=1` by the fifteen alone (e.g. `shotgun-identity`): never gate with that word up; a `TPS_GEAR=1` run of a family is for its word and picture checks. The
  rifle row reads Mk 18 and the pistol row Glock 19, 9×19 mm, through getters on the rows (`weapons.ts`; every number of both rows untouched BUT THE GLOCK'S
  MAGAZINE: `magCapacity` is a getter, 15 under the kit — `gear.ts GEAR_MAG` — and 10 without, in the gun and in each of the three spares; a gun is loaded when
  it is made, so `standup.ts` writes `TPS_GEAR` BEFORE `new Game`, and a new literal 10 for Sam's pistol is a bug: read `def.magCapacity`. A checkpoint's counts
  load as saved, clamped to the row's — one saved at 10 keeps its tens under the kit. The Tab row flipped on a running game: the magazines carried keep their
  rounds, `Firearm.fit()` puts away what is over ten when the kit comes OFF, a restart or 'refill ammo' loads the new size; the calibre also sizes the pistol's
  bullet-hole decal: a 9 mm's); the rifle is DRAWN as an M4-pattern carbine (`rigProps.ts RIG.m4` = only the parts that
  differ: receiver, stock, buffer tube, magazine AHEAD of the grip, handguard, rail, sight, laser box, the 40 mm tube; `sc20kBoxes(…, M)` ← `rifleM4()`, 14 boxes
  under `SC20K_TAG`, the first eleven the bullpup's parts in their order) on the bullpup's own grip, post, light, can, sling and group frame, which are DRAWN FROM
  `RIG.sc20k` (the viewer's group node and those parts keep their `sc20k` paths) — so `sc20kGrip / sc20kMuzzleAhead / sc20kLightPose / sc20kLauncherMuzzle`, every row id (`fn2000`, `fiveseven`), rig group and
  save key keep their old names and values; the reload's support hand works the carbine's marks (`anim.reloadBack` false: arms only); the goggles are two tubes on a
  bridge whose glass NEVER emits, up or down (`RIG.goggles.tubes`, six boxes — the maintainer: "i don't think we need the NVG to glow in the dark"); the dropped
  rifle is `throwables.ts M4_ITEM`; the ring airfoil is WORDED AND DRAWN a 40 mm sponge round (`throwables.ts SPONGE_ITEM` / `spongeBoxes`: a 44 × 76 mm slug —
  blue foam nose, black body, grey driving band — nose first along its flight from `launcher.ts ringBoxes`, on its side where the `'ring'` item stops; three boxes
  under the ring's own flags, as the ring's three slats; the flight, rule, counts, item kind and the `'ring to the head'` log line the chronicle keys on are
  untouched), and the kit column's second launcher tag reads `HE ×3` for `40MM ×3` (`shellTag()`; the reticle's and the draw line's '40 MM' are as they were). A chronicle row WRITES a weapon by its old name whichever kit is issued (`plainShort(def)`: saves and recordings read the same
  on and off) and is worded where it is shown. The OCP stays. Every player-facing line that names the kit goes through `gearText()` WHERE IT IS SHOWN (kit card, HUD column and
  reticle word, controls list, captions, the debrief's rows) — a new line that says FN2000 / Five-seveN / ring airfoil needs the same. QA: `bun run
  tools/qa/gear-check.ts` (`GEAR_BREAK=1` must fail; it holds the fifteen, the Mk 18 and the slug both ways); the fn2000 family's WORD checks ask for their lines
  through `gearText` / `ringTag`, so `TPS_GEAR=1 probes.ts fn2000` and `he40` are green as the frozen stand's are; rifle-slot, nvg-rig and the soak's rifle-box
  count follow the switch. Not seen on a GPU; `RIG.m4` / the tubes are first-pass numbers for the viewer.
- **The player's aim has weight** (`src/game/aimweight.ts`, table `AIMWEIGHT {on, rate 11, smooth 0.05, heft 1.5, bare 1.25, onM 0.3, reach 18, launchWait 0.5}`; `AIMWEIGHT.on` — ON in the page, `?noaimweight` = the gun eased onto the cursor as it was; OFF in the module and on the frozen stand, `TPS_AIMWEIGHT=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table replays with it off; Tab ▸ Player & weapons ▸ Player, doors & props ▸ 'aim has weight' + 'aim ▸ turn rad/s' / 'aim ▸ settle s', under all knobs 'aim ▸ on cursor m' / 'aim ▸ gun weight' / 'aim ▸ launcher s' / 'aim ▸ empty hands ×'). The maintainer, 10-12: "we should have limited turning rate + the aiming circle can lag behind the cursor (like helldivers 2)". TWO MARKS, TWO MEANINGS: the CURSOR is where he wants to aim (`g.aimPoint`, moved the frame the mouse does; the camera's lead, the order menu and the wall hold's step-out still read it), the CIRCLE is where the gun points. `aimWeighTurn` (the plain aim branch of player.ts, in place of its exponential ease) steps `Character.aimYaw` toward the cursor's bearing by a critically damped spring with a TOP RATE = `rate` rad/s × the handling of what is in his hands (weapons.ts `handlingOf`: pistol 1, rifle 0.8) raised to `heft`, empty hands `bare`; stepped in slices of 1/240 s at most (the same swing at 60, 120 and 144 frames a second), never past the point. A half turn: rifle 0.47 s, pistol 0.37 s, empty hands 0.33 s; a 7° correction lands in 0.12 s. WHAT LEAVES THE GUN MID-SWING GOES WHERE THE CIRCLE IS (`aimWeighShot` at the pistol's and the rifle's round sites and the launcher's, whichever load is up — ring, 40 mm or sticky camera: the target turned about him by what the gun still owes, range, height and a launcher's lead kept); once the circle is within `onM` across the line of the cursor every shot is the one the build fired before, to the bit. A LAUNCHER'S LOAD WAITS FOR THE GUN (`launchWait` 0.5 s; 0 = sent on the release frame; a recording whose AIMWEIGHT table lacks the key replays with 0): the right button let go of mid-swing keeps the load (`Player.launchHeld`), its arc drawn, and sends it the frame the circle is on the cursor or when the wait runs out (`aimWeighLaunch`); a frame the gun is down for a wall or a friend sends and draws nothing but keeps the load, the wait's clock running on (`aimWeighLaunchKeep`), and at the wait's end with the gun still down it is dropped unsent. THE HUD (overlay.ts off `aimGunPoint` / `aimGunOn`): the aim ring `.reticle.aim` is drawn at the circle, class `trail` (quieter) while it is off the cursor, with a small dot `.aimwish` on what the reticle snapped to (or the circle small, `.aimwish.gun`, while the ring is busy on a row's thing). LEFT AS THEY WERE: the pistol's OCP (takes the snapped light at once), a thrown can (goes to the cursor), the wall hold and the rifle stack, a man in his arm, a sprint (each drives his facing itself: `aimWeighBegin`, first in his update, marks the frame unweighed and the next weighted frame starts from rest), every other man's turning (TURN is theirs), the camera's lead. On hard the fog's cone follows his gaze, which follows the gun: a flick behind opens that view only as the gun comes round (the half-turn times above). Never under a puppet or a show, never with Sam down; the player only. No dice, no camera, no pixels: radians, seconds and metres off `Player.aimw` (`AimWeight`), which rides a checkpoint's player slice (`aw`) only while a swing runs. On = NOT the off game by digest wherever the player turns (its owner's reading, not re-run since: shipped-stand runs with a scripted commander move; the frozen stand's do not). `bun run tools/qa/aimweight-check.ts` (`probes.ts aimweight`, also under `player`; ten checks; passes on both stands; `AIMWEIGHT_BREAK=1` must fail), `PORT=<dev server> node tools/qa/aimweight-page.cjs [outDir]` (the real page on the software adapter: the HUD's circle trails a flicked cursor and lands on it, and under `?noaimweight` sits on it the frame it moves; about 35 min). Never seen on a GPU or played by anybody: the rate, the settle and the wait are first-pass numbers.
- **Kit handling = Sam's hands carry his kit** (`src/game/kitanim.ts` = the game's half, `character.ts KIT` + `kitSwap / kitLayer / pistolReloadArm` = the hands, `rigProps.ts KitDraw` = the
  drawer; `KITANIM.on` — ON in the page, `?nokitanim` = the kit jumping between hand and holster on the key's frame as it was; OFF on the harness's frozen stand, `TPS_KITANIM=1`; Tab ▸ Kit
  handling). EQUIP: `kitTick(g)` (updatePlayer, right after the keys — so the lock-out lands on the key's frame — and AGAIN at its end, `kitTick(g, true)`, for what the
  frame did to his hands after the keys: off a wall, a sling for a throw, the last can away; also from the hold / takedown / kick / pick / keypad / down branches) compares `kitInHand(g)` (pistol | rifle | can | knife | null, the drawer's rules said once)
  with `Player.kitWas` and on a change calls `an.kitSwap(from, to, shown)`: the right arm by IK carries the old thing to where it LIVES (pistol → `holsterFrameOf`, rifle → `KIT.apex` over the
  right shoulder while the drawer takes it down onto the sling, can → `KIT.belt`, knife → `sheathFist`), goes on empty to the next (`reach`, + `far` between shoulder and hip) and brings it up
  (`draw`); the start is the hand AS DRAWN (world wrists + `handFrameR()`, taken back through the chest twist: changing guns re-stands the trunk under the arms). The animator's outputs
  `kitHold` (undefined = no errand) / `kitStow` / `kitRoll` are what `kitShow()` hands combat.ts `handPropsRaw` → rigBoxes: the HAND's word replaces the slot's while a swap runs. A gun's
  fire lock-out `Player.equipT` = the swap's own length − `KITANIM.early` (was 0 for the pistol, 0.45 s for the rifle; `kitLockMax(KIT)` bounds it for the soak; an errand cancelled leaves at most `KITANIM.plainLock`). Anything that takes his
  arms (a hold, takedown, drag, kick, lock work, a throw, going down) cancels the errand — NOT the wall hold: taking a wall with the pistol up, coming off one, E on the stack are carried by hand like any change (the wall's arms take over once the thing is away); a thrown can's successor is FETCHED; a can of another kind is a swap of its own
  (`Player.kitCan` = the kind the fist shows); a hold's knife is sheathed by hand once the hold lets go. While `an.kitBusy` — or a kit lock-out still runs (`equipT` > 0: the swing of the throw that handed the slot to the pistol) — no reload starts (`reloadInHand`, so a rule that reloads a dry gun by itself waits too) and the pistol's OCP does nothing; while `an.kitBusy` also: no LMB throw of a can not
  yet in the fist, no checkpoint (`savestate.ts playerBusy`), and the gun light / lit lens / Sam's IR laser are off until the gun is UP (`kitGunUp`); a gun leaving the hand abandons
  its magazine change.
  RELOAD: `reloadInHand(g, sprinting)` (player.ts — THE one entry: the R key and anything automatic call it) asks `kitReload(g, gun, long)` → kind off what the weapon will DO (`tactical` = rounds
  left in the magazine: it is put away at `KIT.mag.dump`, out round his side by `KIT.mag.via`, then the fresh one, slower — with the rack on its end if nothing is chambered; `empty` =
  dry magazine, nothing up: drop, fresh, slide / handle; `dry` = a round still up: no slide, quicker) → the
  beat `KITANIM.beats[pistol|rifle][kind]` scaled to the weapon row → `Firearm.startReload(ev, beat)` (weapons.ts: a per-reload row over `def.reload`) + `anim.reload(dur, beat)` (`ReloadBeat
  .keep / .hand`); `an.reloadShow` → the magazine box in the support hand / out of the rifle; `an.kitGunFree` → `Character.gunDir` stays with the HAND through a pistol's change (an aimed pistol
  is otherwise drawn along the aim — which flipped the gun a frame when the aim state changed mid-reload). The magazine BOOKS are the build's own (a part magazine goes back among the spares). CLOSE:
  `an.closeK` 0‥1 by distance to the close-in mode's man (`kitCloseness(d)`: 0 at close.ts `CLOSE.modeM` → 1 at `KITANIM.closeNear` 1.1): `creepLayer` scales the carriage (`KIT.close.far` at the edge → all of it in reach) and moves
  the right hand to hover off the hilt, fingers / wrists alive on the layer's clock; `readyLayer` re-seats the fist on the hilt. THE FREE (left) HAND stays with the crouch on the way in (`KIT.close.left` 0.3 of the
  creep layer's lift) and goes out for the man only once the knife hand is on the hilt (`leftAt / leftIn / leftOut`, the tell's own reach gated in `readyLayer`). GRIPS (`KITANIM.grips`, on with
  the switch; Tab row 'grips ▸ things sit in his hands'): `rigProps.ts GRIPFIT` + `RigOpts.fit` draw what Sam holds IN his hands — the can in the fist's hollow along the thumb's line (it stood on
  the wrist joint) with the fingers open round it (`anim.gripCan`, `HAND.can`), the pistol's and rifle's grips in the palm (`fitFrame` on the gun group), the support wrist moved so the foregrip
  post is in the hook of its fingers (`sc20kGrip(rig, fit)`), a magazine across the left palm (`handFrameL`). PICTURE ONLY: muzzle, bore, gun light and every other man's rig are untouched (a
  beam starts ~3 cm beside the drawn barrel). Measure a grip with the hand's own frame against the finger joints, then look at it on the mesh: `tools/qa/pose-mesh.ts … --fit`. Needs MOVES on for the reload hands (as shipped). Sam only;
  nothing under the tour; no dice, no state outside the Player / his animator (a load = a fresh Player: no errand pending). WHAT AN ARM CAN DO: a rifle errand keeps the elbow `KIT.elbowMin`°
  open (a path that cuts past the shoulder goes round it: `KIT.over / up / top`), the hand within `KIT.wristMax`° of its forearm (what it carries turns with it: `an.kitLie` → the drawer),
  the trunk re-stood at `KIT.trunk` 1/s; `tools/qa/kitanim-joints.ts` measures every change against those (`kitanim-joints`). THE SLING (`KITANIM.sling` 0 by the mission · 1 in front · 2 on
  his back; `kitSlingFront(g)` = a squad's loud mission, never a quiet one or the solo night — `scenarioRun.ts activeScenario`): in front the rifle is let down to hang on his chest
  (`rigProps.ts SLING_FRONT`, the hand's place there `slingFrontHand`, its own times `KIT.front`: 0.47 s to the first round against 0.66 off the back) and swings up onto his thighs in a crouch
  (`SLING_REST` + `slingSwing`, eased on the game's clock by `kitSlingRest` → `Player.slingRest`, picture only, not saved; the hand's errand takes the same swing: `an.kitRest`). The lock-out
  times hang on it, so it is a fact of the mission, not of the picture. AN EARLY CLICK IS KEPT (`KITANIM.clickKeep` 0.35 s, 0 = dropped as before; `kitClick(g, input)` right after
  `kitTick` in updatePlayer): a left click inside the last 0.35 s of a kit change's lock-out is stamped on `Player.kitOwed` and put back in the tick's input the frame the gun is up — the
  wall stack's own rule for its rise; dropped with the errand, the orders menu up, a takedown / kick / lock beat, or once stale; it is the click of THE THING HE WAS FETCHING (`Player.kitOwedFor`, a can by its kind: a click for the rifle never fires the pistol he changed to, one for the smoke never throws the frag). A can picked while another kind is still in the fist is not thrown until IT is the can in the fist (`Player.kitCan`), and the pistol the last can hands the slot to fires nothing until it is drawn after the swing. A CAN the same (`KITANIM.throwKeep` 1.0 s, 0 = dropped as before): a left click while the can is still coming to the fist is thrown the frame it is there. The kitanim probes stand him on open floor (the lobby, cursor far out): at a wall the guns-at-walls rule keeps his gun down. NIGHT VISION (`KITANIM.nv`; Tab row 'night vision ▸ by hand or a nod'): N still flips `Player.nv`, its sound and its
  word on the key's frame — `kitNv(g)` (player.ts `nvKey`, the one N site: the key + the picture's ease, also called for the ease alone from the takedown / kick / lock / keypad beats) only asks the animator `nvFlip(down, hand)`: with the left hand FREE (`nvHandFree`: hands empty, the pistol at its relaxed
  carry, a can in the fist) the arm goes to the goggles by IK and swings them (`KIT.nv.hand`, 0.92 s), else a toss of the head (`KIT.nv.nod`, 0.36 s: a pitch of the HEAD JOINT alone, in the upright plane of his gaze as drawn — `bones.head` does not move and his gaze on the plan does not turn, so the eye, the fog's cone and the meter read him the same; the rifle
  up, the pistol at the aim, a man in his arm, a reload, a throw, a kit change, a wall); `an.nvShown` 0‥1 → `RigOpts.nvK` → `gogglesBoxes(…, k)` draws them part way, and `kitNvEye(g)` is what
  `Player.nvAmount` (the tube's picture) eases to: on from the frame they start down, off once they are up. A kit change takes the arm from a flip (the goggles still arrive); a reload takes it faster (`KIT.nv.hand.clear`: the hand is the reload's before the magazine leaves); N again inside a nod carries the head on (`nod.carry`); `an.nvCancel()` lets a flip go when he goes down (`ragdollize`) or the part stops being live (a show: `kitNvEye`). `Player.nv` and everything that reads it are the key's; what is NOT nothing is his body as drawn — the left arm at his brow is in `Character.capsules()` for the 0.9 s of a hand flip (a tripwire could meet it) — so no checkpoint is written mid-flip (`an.nvBusy` → `playerBusy`). The probe's staged runs digest the same with the part on and off. `SLING_FRONT`, `SLING_REST`, `KIT.front`, `KIT.nv` and `NV_SWING` are FIRST-PASS numbers placed against the mesh offline, never seen in the
  renderer — they sit outside `RIG` until the viewer has had them. QA: `probes.ts kitanim` (off / equip / midswap / reload / close / harness / edges / joints / sling / nv) — its rig holds other parts' key rules at the frozen stand's values where the tables exist (a dry gun reloading itself off, the G quick throw on: `world()`), so on any stand it asks about the hands alone,
  `bun run tools/qa/kitanim-strip.ts` → docs/shots/kitanim/*.png (stick figures + prop boxes, before / after rows), `tools/qa/pose-mesh.ts` situations `sling-*` / `nv-*` on the mesh.
- **PACK SIDE = a long thing on a back that wears a pack stands at the pack's side** (`src/game/packside.ts PACKSIDE`, the maintainer, 10-18, of Sam's slung rifle through his radio
  and the breacher's back: "maybe we find a way to put equipment on the side of it? like a hammer would be on a strap to the side of a pack?"). Switch `PACKSIDE.on`: ON in the page
  (`?packside=0` puts it off; Tab row 'packs ▸ back tools ride at the side'), OFF in the module and on the frozen stand (`FROZEN_HOLDS 'PACKSIDE.on'`, `TPS_PACKSIDE=1`), in the knob
  registry and the journal (a recording from before the key replays with it off). LOOKS ONLY: boxes and a part mask; a run with it on digests as the run with it off. THE CAUSE: the
  operators' back kit is worn mesh (`kit_*`, rigid on the chest joint) and the big slot's hammer / shotgun and Sam's slung rifle are boxes laid diagonally across a BARE back off the
  back's own frame, so on a man with a pack they lay inside it (77 of 120 measured poses, to 8.5 cm deep; the slung rifle 5.2 cm into the radio). THE RULE: (1) with a `kit_*` part
  worn, the tool stands UPRIGHT AT THE PACK'S RIGHT FACE — the hammer handle down, its head across just over the pack's top corner; the shotgun muzzle down, flat to the face — placed
  in the mesh's BIND space off the pack's own extents (`packOf`, read off the part once a cast) and carried by the chest joint's skin matrix, the one the pack's vertices ride
  (`rigProps.ts packSideBind` → `bigBoxes`); it turns about its top end, in the pack's upright plane only, until its lower end rests on the line of his back (`sidePitch`: the rearmost
  of his trunk and seat under it, a few degrees — his own upper back is the limit); (2) a rifle across that back goes to the pack's LEFT the same way (`sc20kFrame` 'slung'); (3) THE
  BREACHER'S MODELLED RAM IS WORN ONLY WHILE HE CARRIES NO REAL TOOL (`PACKSIDE.ram`, `cast.ts castParts` → `packMask`): with a hammer or a shotgun in his big slot he is drawn in the
  small assault pack (the cast holds 32 parts, its cap: no new part); (4) the hand that takes the hammer's handle is DRAWN going to the same place, in the picture only
  (`combat.ts hammerSide` → `CharacterAnimator.bigSide`, the chest joint's own space → `Character.packSidePass`, a two-bone override after `inHandPass`: the arm the
  simulation reads, `bigLayer`'s, is the rule-off arm to the bit; the pass keeps `simHandR` as `inHandPass` does, so `handFrameR(true)` — what a kit swap starts from — is the
  animator's hand, and `ragdollize` lets the override go). The workbench holds the rule off unless `?packside=1` (its across-the-back gizmos would move nothing). A man with no pack (the sneaking suit, the mannequin) carries everything where he always did.
  QA: `probes.ts packside` (`tools/qa/packside-check.ts`, 12 lines, both stands; `PACKSIDE_BREAK=1` fails (3) to (7)) samples every box of the tool each 1.5 cm against the SKINNED
  worn mesh by ray parity, pack and body apart: five operators x hammer / shotgun x twelve poses + Sam's rifle alone and beside each tool — rule on, 0 samples inside any pack, the
  worst into the man 1.3 cm (the hammer's head under the back of the helmet, the hydration-carrier man crouched), top end fixed against the pack's vertices to under a millimetre,
  each long gun's own model (gunlook.ts) slung there in the stand-in's place: 0 samples into the radio, him or the tool, five models x 36 poses (line 5b),
  the fist 1.0 cm from the handle on the draw (0.7 cm across a bare back), his wrist as the game reads it identical on and off. `bigslot-check` holds the rule off: its lines
  are about a bare back. NOT DONE / NOT SEEN: in a crouch the pack lies flat on a bent back and the tool lies along it — a long
  handle stands out behind him (the pictures say so); with kit handling on and the rifle kept on his back, Sam's rifle still crosses the radio for a few frames as it is slung or
  unslung (the hand goes over the right shoulder, the rifle rests at the pack's left); the kit figure draws no big tool and does not apply `packMask` (it shows the breacher's ram);
  the swapped mask's fit is solved on first use, not with the cast's pre-solved set, and the worn mask is a frame behind a change of tool; `PACKSIDE`'s numbers are first-pass, placed against the mesh offline, judged on stills from the
  offline pose tool only — never seen in the renderer, on a GPU, or played.
- **IN HAND = what a man holds is in the hand that holds it** (`src/game/inhand.ts INHAND`, the maintainer, 10-18, of a teammate crouched on the rear with his sidearm out: "gun not
  aligned to hand for partner. we should do a pass for all the attachment points"). Switch `INHAND.on`: ON in the page (`?inhand=0` puts it off; Tab row 'in hand ▸ a pistol stays in the
  fist'), OFF in the module and on the frozen stand (`FROZEN_HOLDS 'INHAND.on'`, `TPS_INHAND=1`), in the knob registry and the journal (a recording from before the key replays with it
  off). LOOKS ONLY — every man, both sides. THE CAUSE: a pistol was laid out from the wrist joint along `Character.gunDir` (the analytic aim line in an aim) with its top to the world's
  up, so the gun stood where the simulation points and the hand where the clip put it: fine standing still, 3.5‥5 cm off the palm and 17‥22° across the hand in a crouched aim, 8‥9.5 cm
  and ~50° for the 0.2 s an aim takes to come up or let go (and through a guard's reload and his torch ↔ sidearm swap). THE RULE: (1) the drawer lays a PISTOL out in the hand bone's own
  frame (`Character.gripFrameR`, `rigProps.ts pistolFrame`, `RigOpts.inHand`, with `GRIPFIT.pistol`; the 9 mm moved by `GRIPFIT.guardPistol` to where the fitted Glock sits; a teammate's
  kit takes Sam's `fit`); (2) `Character.inHandPass` poses the SKELETON a second time after `bones` / `gunDir` / `muzzle` were read (as `breathe` does): the gun hand is turned at the
  wrist onto the simulation's line by `from`‥`to` of the aim clip's weight (`anim.aimShown`), never more than `wrist`°, and a support hand within `both` m is carried round with it, its
  arm re-solved. The drawer says what is in his right hand a frame behind (`Character.inHand`, an `InHandWord`: pistol / torch / long; as `anim.gripCan` is). IT STANDS DOWN while
  anything else has the gun arm (`anim.gunArmOwn`: reload, blow, flinch, throw, kit errand, swap, hold, signal, a look-only move) and comes and goes at `rate` /s, never in a frame —
  bar a SHOT: the hand is on the line at once and in full, so the flash leaves the drawn barrel. A game rule that starts from the hand's frame asks for it as the animator posed it
  (`handFrameR(true)`: kit handling's errands, kitanim.ts). THE PASS OVER THE REST (measured on the worn mesh of all 14 cast variants × loadouts × poses, 809 groups —
  `tools/qa/attach-mesh.ts [--inhand]`; and per frame of 24 played missions, 120 thousand frames — `tools/qa/attach-play.ts`): where the simulation places a thing's light or muzzle
  the THING stays and the HAND goes to it. A calm patrol's TORCH stood 8‥12 cm beside his fist (`INHAND.torch`: the fist's thumb line turned along it and the right arm re-solved so
  the fist is round its body — `rigProps.torchHold`; torch, lens and light untouched); a teammate's rifle and a defender's carbine had the grip 4.2 cm short of the palm
  (`INHAND.long`: the trigger hand moved onto it — `rigProps.longHold`, `GRIPFIT.long` the other way round; gun, muzzle, weapon light and the hand on the fore-end untouched; Sam's own
  rifle keeps kit handling's fit, and gets this only with that off); a defender's holster a third inside his long shirt (`holsterOut` 3 cm, defenders only); the torch on a belt three
  quarters inside the man (`belt`, `handwork.ts beltTorch`). A man who dies is let go of first (`ragdollize`). CHECK: `bun run tools/qa/inhand-check.ts` (probe `inhand`, family
  `kitanim`; 17 lines, both stands; `INHAND_BREAK=1` must fail): bench scripts for both sides' pistols (grip to the fist's hollow 1.7 cm a teammate's / 2.4 cm a defender's at worst, was
  8‥9; on the simulation's line to 2.6° once the aim shows — the 9 mm's own rake; the two-hand hold's spacing and both arms' bone lengths unchanged to the millimetre; the rule adds
  under 8° a frame to either hand through aims, a reload, a flinch, a blow and a kit errand; a shot from a crouched low ready: bore 2.6° off the round's line and the grip in the fist,
  was 8 cm out of it; a fifth of a second into anything that takes the arm the hand is the animator's own to 0.1°), torch (the fist's hollow to its line 12.4 cm → 1.2, its boxes
  bit-equal), long guns (4.2 → 1.0 cm, boxes and fore-end hand bit-equal), every joint the game reads / gunDir / muzzle the same in every frame of every script, and the mission the
  shot was taken in (lights-out, duo, the teammate's sidearm: 9.1 cm → 1.7 cm over 1080 frames; then the player's own pistol drawn, swapped for a can and back, reloaded, fired: the
  run's digest equal off and on). One seed. PAGE (software adapter): `PORT=<port> node tools/qa/inhand-page.cjs` — the switch on, the men shown told and posed, no page
  error; `?inhand=0` off. STILLS: `tools/qa/pose-mesh.ts <variant> pistol-crouch|pistol-crouch-up|pistol-aside|torch|rifle-aim … --inhand`. LEFT ALONE, measured: the
  torch a whistle's soft answer raised was drawn in the hanging RIGHT hand while the clip lifted the LEFT (MENDED since, as a rule of its own that moves the light with the hand:
  GUN HAND's `whistle` key, `docs/agents/stealth.md`); Sam's slung rifle runs 5‥8 cm into his radio pack — only with the sneaking suit or kit handling switched off, or on the frozen stand (as the page ships a quiet mission wears the suit with no pack and a loud one hangs the rifle in front on its sling: cast.ts `sneakSuit`, kitanim.ts `kitSlingFront`); the breacher's kit mesh already carries a long tool and the hammer and
  shotgun cross it; a hammer between hands and back, and a teammate's rifle as it comes off (the big slot's own
  moves: MENDED since, the bullet 'stay in a hand on the way' below); a torch is beside the fist for the frames of the torch ↔ sidearm swap (the swap's reach for the belt is the animator's, game state, and goes to the torch's OLD place: the look-only
  pass draws the hand the 7.5 cm further out to where the torch now hangs — `anim.swapBelt`, check line 17: 1.4 cm from the old place, 1.7 cm from the new); through a long gun's
  reload the TRIGGER hand and the body played the pistol's clip (MENDED since under `GUNHAND.longReload`: `docs/agents/anim.md`, *A long gun reloads with a move of its own* —
  with that switch off, the frozen stand, it is as it was); a defender threw overhand with the carbine in the throwing fist (MENDED since under its own switch: `GUNHAND.throwFree`,
  enemies.md 'A defender throws with his free hand' — IN HAND's long hold stays on the grip through that throw). THE VIEWER draws by the rule too (`src/viewer/runtime.ts` says the staged man's
  word as combat.ts does; the workbench raises the switch as the page does, `?inhand=0` there too; page line: `HALF=bench … inhand-page.cjs`), so a rig number fitted there is judged on
  the picture the game draws. The Team & kit figure (`src/ui/kitFigure.ts`) still draws without it. NEVER SEEN ON A GPU OR IN PLAY: judged on Blender
  Workbench sheets of the skinned cast and by the numbers above.
- **The rifle family's probes read the page's rules where they are live** (`tools/qa/fn2000-probes.ts`, 10-16; tests only, no game code). `kit-slots`, `rifle-cadence`,
  `rifle-reload` and `rifle-slot` pinned the old kit's beats and were red on the SHIPPED stand. Now: a kit change carried by hand is waited out (`kitWait`: `stage()`, kit-slots'
  `settle`, rifle-slot's `run`; one that never ends is a FAIL or a throw) and where the rifle is drawn / what the animator holds is not asked mid-change (`kitMid`: never the bare
  lock-out); rifle-cadence (e) wants the lock-out to be the errand's own length less `KITANIM.early`; rifle-reload wants `kitReload`'s kind and times within a frame (the times
  themselves are `KITANIM.beats`, authored, pinned by nothing here); the foregrip reference is the fitted grip (`sc20kGrip(…, KITANIM.grips)`); kit-slots reads the 40 mm count as
  issued (three built, or his card's), holds the calm torch rule off for its lit-torch line only, and clicks the RIGHT button for the knockout where `closeLethal`; the two wall
  lines want the stack (rifle in his hands, low) under `WALLSNAP`. Measured: `probes.ts fn2000` 17 of 17 on the frozen stand and with `TPS_KITANIM=1`; on the shipped stand 16
  of 17. STILL RED there, not kit handling's: `rifle-carry` (3), the slung carbine 0.0‥0.2 cm off the skin (want ≥ 0.3‥0.5) — red with `TPS_KITANIM=0` too, 0.5 with `TPS_GEAR=0`:
  the issue kit's carbine on the back. Not asked by anything: the OCP on a torch the calm torch rule has put out. Headless only; never seen on a GPU.

<!-- was CLAUDE.md lines 2564–2610 -->
- **A throw reads its distance** (the maintainer, 10-16, over a can thrown at a wall two steps off with the full wind-up: "we should have different
  animations based on how far you're throwing something"). `CharacterAnimator.throwItem(dist?, speed?)` takes the metres over the floor to where the arc
  ends (`ThrowSolution.land`, the preview's own end) and, where the caller has it, the speed over the floor the thing leaves at; `character.ts THROW_BY`
  picks the swing. Under `toss` 3 m and under `tossFast` 7.3 m/s: an UNDERHAND TOSS (`THR_LOW`: back past the hip and through, the wrist never above the
  shoulder, let go rising at chest height; `tossMin` of its backswing at arm's length). From a hand up on a gun there is no backswing to whip into (past
  what `tossIn` m/s reaches, the hand drops on one arc to the swing's low point and scoops), and the other arm, left alone otherwise, is let down from
  the support grip to hang (`thrHang`, read once on the throw's first frame). To `full` 10 m: the overhand SHORT-ARMED (the body's turn from `turnMin`,
  the hand's path drawn in toward `pivot` from `armMin` but back at its authored size for `through` s either side of the release, the balance arm's path
  and turn toward the pose underneath from `offMin`, all by a smoothstep of the distance). 10 m and over: the overhand as authored. A HARD throw a near
  wall stops (the cursor far out, `land` two steps off) is the shortest overhand, not a toss: the speed says no toss, the distance says how much arm. No
  distance, or the switch off = the one overhand, the code path that scales nothing (compared with the file before the table over 1,650 poses-by-frame
  cases in review: no difference). ONE CLOCK: every swing is `THROW_DUR` long and lets go at `THROW_RELEASE`, so the can is not touched — the same frame,
  the same `throwOrigin` (shoulder height and 0.32 m ahead: a toss's hand lets go 0.2 to 0.35 m from where the can appears, an overhand's 0.2 to 0.45 m,
  as before; a can that starts at the hand is the flight's own change and was not made), the same arc. ONE CAN: with the switch on the fist drops its can
  the frame the thrown one is in the air (`combat.ts handPropsRaw`; `throwing` runs three frames past the release and the fist showed the next can under
  the one just thrown); a wind-up called off keeps its can. THE BODY IS SEEN: the swing moves bones the sight and light code read, so with somebody
  watching a run can differ off and on — the picture and the AI on one model. Who tells the animator: the player (`player.ts doThrow`, distance and
  speed), the stun thrown at a covered lane (`lanes.ts`, both), a defender's frag (`frag.ts`, the distance to the wind-up's `at`); the team's `tossItem`
  (the support hand, round a door frame) is a toss already and is not touched. Switch `THROW_BY.on` — ON in the page (`?nothrowby` = one swing for every
  throw), OFF in the module and on the frozen stand (`TPS_THROWBY=1`), `FROZEN_HOLDS['THROW_BY.on']`; a registered knob table, in `JOURNAL_KNOBS` (a
  recording from before the table replays with it off); Tab ▸ Kit handling ▸ 'throw by distance'; the viewer's Tactical sheet has 'throw distance m' for
  the one-shot and its status line names the read. Check: `tools/qa/throwby-check.ts` (`probes.ts throwby`, family `player`; `THROWBY_BREAK=1` fails (f)
  and (k)): the reads standing, crouched, walking, and with a gun in his hands standing and crouched; no wrist faster than the whole wind-up's, no corner
  in its line sharper (+ 20°), the other wrist no faster and bent no further (+ 10°), no elbow under 45°; one clock; a hard throw is no toss; a throw
  re-triggered into another read moves neither wrist further in a frame than the whole wind-up does; the stands; the Game's four throws (one aimed far
  that a wall stops at 1 m) read right; the can identical off and on; one can — 29 of 29 on both stands, the break red on both. Measured (headless): the tour 3 of 3 on the
  frozen stand with and without `TPS_THROWBY=1` (the same seeds); the soak, seeds 1 2 3, 12 minutes each — clean on the shipped stand, and on the frozen
  stand the same two violation kinds on seed 3 with the word and without it (`held-scripted`, `checkon-stale`: not this rule's); `probes.ts kitanim`,
  `quickthrow` on both stands and `frag` on shipped all pass. Strips:
  `pose-strip.ts throw-toss | throw-toss-crouch | throw-toss-armed | throw-least | throw-short | throw-full | throw-full-crouch | throw-untold`. The table
  and the toss's keys are first-pass numbers, looked at as capsule strips and as stills of the page on a software renderer: NEVER SEEN ON A GPU, and
  nobody has played it. A blast mid-swing takes the swing (same switch): folded by a blast or blinded while a throw is running, its arms and body English fade by how far the fold's and the blinded hunch's own weights (`mvs.cf`, `mvs.dz`) have risen since the swing began, so both arms and the trunk go where the hit man's go instead of throwing on over a folded body; a throw begun already blind or folded, or in the tail of either, is swung whole, as before; hurt and shaken change nothing, and no state shortens or alters a throw's flight. Lines (y) and (z) of the check: hit 4 frames into a toss, a short and a full overhand, standing, crouched and with a gun (MOVES raised for the lines); each part of the fade taken out turns one red; 576 unhit swings hash the same, every bone, as before the fade. Strips: `pose-strip.ts throw-blinded`, `throw-folded`. Known and not this rule's: a blinding alone does not call off the player's wind-up (a stagger and a guard's own blinding do), so his can still leaves a half-hunched arm. Measured on the bare figure only; never seen on a GPU, never played.
- **Hands = picking a body up, working a door by hand** (`src/game/hands.ts`, state on the Player: `Player.haul: Haul | null`, `Player.doorMove: DoorMove | null`; `HANDS.on` — ON in
  the page (`?nohands` = as it was), OFF on the frozen stand (`TPS_HANDS=1`), `FROZEN_HOLDS['HANDS.on']`; `HANDS.body` / `HANDS.door` = its two halves; a registered knob table, in
  `JOURNAL_KNOBS`; Tab ▸ Sandbox ▸ Hands). OFF = nothing in the file runs: the ankle pins on the frame of the tap, the leaf flung by `Doors.use`. A BODY is taken by the END HE IS AT
  (`haulBegin`: the ankles, or under the arms = the two shoulder particles, when the head end is `headBias` nearer; `bodyGripDist` puts the head end in `bodyDist`'s reach — the old
  reach knew ankles + hips only, so a man come back to a body from its head got no row) through beats `reach` (handsStep walks him to `gripM`, no pin yet) → `rise` (the pins travel
  from where the limbs lie up to `carrySpots` over `liftSecs`) → `carry` (pins at his hands; pace ×0.6 as ever) → `set` (the 'let go of him' row: `haulSetDown` lowers the pins over
  `setSecs`, then player.ts `releaseBody(g, true)` + 'body set down'); a sprint / wedge / round is the old instant drop (`haulSlack` = the head end's wedge test, which has no leg
  sticks to strain). `haulPins` feeds `anim.haul: HaulPose {l, r, bow, grip}` → character.ts `haulLayer` (two-bone IK of both wrists onto the ragdoll's own particles, a bow, fingers
  by `grip`; held item hidden). Under a puppet there is no Haul: the showcases' drags are the old ones. Both hands on a body put his gun (and its rail light) away for the haul. A DOOR: the push / pull / unlock rows call `doorMoveBegin` (false → the caller's
  `doors.use`: switch off, a puppet, hands full, back to a wall, locked out, no standing room) → stages `hand` (waits for `anim.doorHands()` ≥ 0.6 or `handSecs`, while a short
  step in to arm's length runs when the leaf opens AWAY from him; then `doors.use` for the creak / key clack on an opening) → `swing` (`doorMoveTick`, called right before `doors.update`: the angle
  driven kinematically at `doorRate`, vel 0, and NEVER advanced into him — `leafDist` vs `bodyR`; one-way and toward him it keeps `Door.pullT` alive so it passes teammates on his side as the flung leaf did; `doorMoveLowers` = his gun stays up while the leaf is within `aimArc` of his aim; shut: under 0.14 rad it is handed to `Doors.pullTo` for the sprung latch).
THE DEFAULT IS A CARRY (`HANDS.carry`, on; Tab row 'bodies ▸ over the shoulder'; off, or no headroom / no way to its hips = the floor haul above, as the fallback: `dragHaul`): the row reads
  'pick him up', he walks to the body's HIPS from wherever he stood (`Haul.carry.spot`; his own keys do not call that off, a sprint does), the trunk cluster is pinned by FIVE particles (hips, spine,
  knees — `liePins` at the body's own lengths, so nothing strains) and eased from how it lies onto his LEFT shoulder (`shoulderLie`: hips at `carryUp`, trunk hanging down his back, legs down his
  front; `hoistSecs`), he stands half way through the lift (`haulCrouch`) and walks UPRIGHT at `carryPace` × his walk facing the way he goes (`haulUpright`, `haulSpeed`; no scrape noise), left arm
  over its thighs, right arm his own (`HaulPose.rw / look / tilt`); 'put him down' turns him to the first side with clear floor and lays it on its back across his front (`layLie` → `lowerSecs`,
  released only once the hips are down; no clear floor anywhere = dropped, as a sprint drops it). ITS LOOSE LIMBS RIDE HIM (`HANDS.carryRide` 0.85, Tab row 'carry ▸ limbs ride'; 0 = as it was): each carry frame `carryRides` hands the body his step and turn since the last one and `Ragdoll.ride` takes every UNPINNED particle (and its last position, so no speed is added) through that share of it, spread over the frame's substeps, before the integration — the pinned-body damping then acts against HIM, not the floor (it was the floor: arms, shins and head streamed 40–80° out behind every stride and turn; now ≤ 28°; `hands-body` walks it both ways). Only in the over-the-shoulder carry's 'carry' beat; a teleport is skipped. Verb ids stay `drag` / `drop`. THE HEAD POP in the old drag was three stoops stacked on a crouch
  (the −0.9 aim pitch, the layer's bow, its look-at-the-hands): the floor haul now runs −0.45 with the layer's look and bow eased off once it is in tow. AND A WHIP: the layer's look at
  his own hands (a point straight under his eyes: no bearing) flipped his head side to side with the stride, and `aimYaw` snapped to the haul's facing turned it there in one frame at the
  take and at the lay-down — the look now aims a stride beyond the grip and, while `pl.haul` is up, player.ts brings the aim round WITH the body (`hands-body` bounds the head's one-frame turn).
  `clearSpot` = where he must stand for the sweep to miss him (null = where he is, a spot = `handsStep` walks him there, his own movement key cancels it, undefined = none within
  `stepM` → refused). game.ts `handsOnDoors` takes the move's door like an eased one (`DoorPush.reach` = +0.45 m of arm for it). A door move is `playerBusy` for the checkpoints
  ('working a door'; hauling already was). Nothing rolls a die or reads the camera. QA: `probes.ts hands` (hands-body / hands-door / hands-off / hands-harness — run under
  `TPS_PROFILE=shipped` too: they stage the page's door rules themselves), stills `node tools/qa/hands-look.cjs <dir> [nohands]`.
- **Hands at work = a hand on the thing he is working, a hand to the radio, the torch ↔ sidearm swap** (`src/game/handwork.ts`; `HANDWORK.on` — ON in the page, `?nohandwork`
  off; the frozen stand pins it off, `TPS_HANDWORK=1`; halves `work / radio / swap`; Tab ▸ Sandbox ▸ Hands at work). THREE small layers of `CharacterAnimator`, each fed on the
  frame and consumed by `update()` (nothing fed = nothing posed, no module state): (1) `anim.work: WorkPose {kind 'keys'|'charge'|'lever'|'take', p, n, t, dur, keys?, dir?,
  hand?}` → `workLayer` (the free hand — the left when the right has a gun or a torch, both for a charge / the drive when both are free — on a spot of the thing's face by
  two-bone IK, a bow / lean into a long reach, the chest squared to it like a door push; asked only inside the arm's reach of where the shoulder WILL be once leaned, so a man
  too far off simply shows nothing; stood down, eased, by anything else that has the arms). Fed by `workAt` through: `padHands` (devices.ts updateCoding: the code's clock
  WAITS for the finger — `handThere`, gives up at `waitSecs` — and each of the four keys beeps on its press, the key lit), `chargeHands` (doortools.ts 'place', wallcharge.ts
  'place' + Sam's `samTick`: the slab drawn under the hands until it is set), `breakerStart / breakerTick` (game.ts: Sam's breaker rows become a short COMMITTED move,
  `Player.breakerMove` — the mains go over `leverAt` s after his hand is on the lever and nothing in cancelSustained stops it, like a kick: the row's deed was filed on the tap
  and the lessons / chronicle read it; runningVerb 'breaker', playerBusy 'at the breaker'), `leverHands` + `leverStand`
  (lighting.ts / guards.ts 'suspicious': the man sent to the breaker steps up to the panel, squares to it, gun low, hand on the lever — the reset clock stays lighting.ts's,
  its gate is `lighting.ts breakerResetNear` for both),
  `driveHands` (mission.ts: both hands in the rack for DRIVE_SECS, then `workAfter(stowSecs)` puts it away at his hip; `workProps` draws the caddy). `teamWorkHand(c, {p, n, w}, kind, t, dur, dir)` = the join for a module that sends a TEAMMATE to work a thing and owns only when and where: true = this layer has the hand (feed no door hand), false = switch off, the caller's own feed stands (nothing calls it on this branch). player.ts `samWork` →
  `updateWorkPlant` (and `updateCodingPlant`'s step in) stand Sam at arm's length (`workStand`, `standM`; off a wall hold first; which hand = `samWorkHand`, THE one rule) with his feet still while one runs; the TRIGGER lets
  go of the drive / a wall charge (`samWorkLetGo`), a movement key / Space / Esc as for every sustained verb; never under a puppet. While his hands are at work (and at a keypad with the switch on) the close-in mode stands down as it does at a lock (close.ts `closeReady` / `modeNow`: no knife tell, no creep carriage — a click there throws no blow, and the carriage took the hands off the thing). (2) `anim.radio(secs)` ← `radioHand` at guards.ts `say` (net lines),
  qrf.ts `radio`, director.ts unit radio: the left hand to the handset at his collar, yielding to a reload / throw / hold / a long gun up / the work hands; the head tips to it only as far as
  his gun is DOWN (× 1 − the aim weight: a calm man's eyes go with his head as for a tell; sights up, nothing of his sight moves). (3) `anim.carry` ← `swapFeed` (game.ts dealWeapons, plain-sidearm men only): a change of guards.ts `inHand` torch ↔ weapon runs `swapLayer` over `SWAP.draw /
  stow`, after the man's own beat (`anim.swapLag` = his id's share of `SWAP.lag` 0.2 s, so a floor alarm does not start every hand on one frame; a round fired inside it starts the move at once), and `swapHeld(rule)` says what the hand SHOWS meanwhile (combat.ts handProps, guards.ts poseFlashlight — the torch's light follows the hand to the belt for those
  frames; `beltTorch` hangs it there while the sidearm is out); the RULE (`handCarry / inHand`, who may fire when) is untouched, a shot mid-draw jumps the move, and the BORE + MUZZLE are read
  off the arm UNDER the swap (`CharacterAnimator.handPre` → `Character.gunHand` in readBones: equal to the swap off to the bit — `handwork-swap` holds it). The gaze stabiliser
  leaves the work / radio looks alone. Nothing
  rolls a die or reads the camera. QA: `probes.ts handwork` (work / radio / swap / off / harness), stills `node tools/qa/handwork-look.cjs <dir> [nohandwork]`.

<!-- was CLAUDE.md lines 2636–2657 -->
- **The player carries and sets charges like the squad** (`src/game/owncharge.ts`, ONE switch `OWNCHARGE.on`: ON in the page — `?noowncharge` = as it was — OFF in the module and on the frozen
  stand, `TPS_OWNCHARGE=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table replays with it off; no Tab row). The maintainer, 10-12, on
  Team & kit: "weird that i can't use wall charges or door charges myself, should be symmetric". THE CARD (kit.ts `chargeRow / wallRow`, `chargeRows`): YOUR kit card has a 'Door charges' and a
  'Wall charges' row at the teammates' own pouch prices (slots.json v8: one a door charge, two a wall charge, two of each a man at most; your issued card is full and carries none, so one
  costs a can, a frag or the 40 mm round); your card's rows read weapon · cans · frags · 40 mm · charges · wall charges · wand · suit · trim. WITH ONE BIG SLOT A CARD (`BIGSLOT.on`, the page as it opens) there is no
  'Wall charges' row: your wall charge is the Big slot row's 'wall charge', one a man and free of pouches, yours only with this switch; owncharge-check's kit part reads both cards. What you carry goes into THE SQUAD'S ONE COUNT
  (`kitPool` / `kitWalls`: the bag the door tools and the wall charge spend whoever's hands set one). NOBODY CAME WITH YOU (`kitAlone` at the end of `kitPlayer`; `DoorTools.alone(n)`): the
  counts are your card's and nothing else — the two door charges a man alone was handed whatever his card said (and the wall they paid for) are gone with the switch on. A DOOR CHARGE BY
  HAND (doortools.ts `samRows / samFace / samTick / cancelSam`, state `Player.charging`): a shut door's row 'set a charge · N left' while the count has one (never steel, a door open or off
  its hinges, one with a charge or a charge order on it, hands full, a body in tow or a man in his arm, a show; ONE row past the three, under them) — a sustained verb: he is planted at the lock by handwork.ts (`SamWork.kind 'door'`), the squad's own
  `DOORTOOLS.setSecs` with both hands on it, a step / Space / Esc / the trigger — or the squad ordered onto that door with a charge of its own — breaks it off with nothing spent ('charge not set'); set, it is a `SetCharge` like any (`by: 'Sam'`), the
  door's line says ' · charge set · F blows it', and F is the door tools' own trigger: `blow()` is the one a teammate's charge goes through and asks nothing of who set it. THE SQUAD ON YOUR
  CHARGE: the door tools' charge row (X, 5, 3) on a door carrying a charge set by hand, from the charge's own face, reads 'stand off · in behind the charge' (`looseOn` → `startCharge(men, t, true)`: the
  charge order from its stand-off stage — its marks, deal and words, nobody at the lock, nothing spent) and F then sends them in behind it as behind their own; whoever is inside the blast is
  named on the row that offers the trigger (`closeWords`: ' · too close: you, Red One · behind the door: …', blow()'s own reach and line tests, kept a quarter second a charge; a warning: beyond the door a pair's man inside `knockM` is felled, anybody else of ours dazzled). The squad block's own line for a set charge (`hudNotes`) carries the same names in capitals (' · TOO CLOSE: you'): it wraps, where the door's header is one line the HUD cuts short on a locked door — so on the door's own line the names come AHEAD of ' · charge set · F blows it' (what the cut takes is the hint). A WALL CHARGE by hand
  was already the wall charge's own row (wallcharge.ts `samRows`); with the switch on it is paid from what the cards — yours among them — carry. Enemies hear and are hit by a blast, never
  by who set it: nothing was added for them. A plain save is refused while he sets one (`playerBusy` 'setting a charge'); a checkpoint's player slice carries `own {charges, walls, doors?, spent?}` only while
  the switch is on and he is alone (a door charge that stands set is put back on its door by a load; a wall charge set and not blown goes back in the count). A MAN ALONE'S NEW RUN is a fresh
  Player (`DoorTools.sync`, the wall charge's own rule): a charge left on a door goes with the old run and what his hands spent (`samSpent`) is back in the bag before `kitAlone` writes the card's count; a door blown off its hinges under a set charge gives the charge back with its own line. THE ONE-WALL-CHARGE-A-SQUAD CAP IS GONE (the maintainer, 10-12: "we should just remove the max one wall charge per squad limitation. maybe we can say that it takes up two
  slots"): slots.json's `maxPerSquad` is deleted — data, NOT switched, so on both stands — and the pouches are the only limit (two each, two a man). `scenarios.roomClear.wallCharges` still
  RAISES the squad's count (issue.ts), never lowers it. QA: `bun run tools/qa/owncharge-check.ts [kit|door|squad|save|off]` (`probes.ts owncharge`; `owncharge-kit` also under `kit`,
  `-door` / `-squad` under `doortools`; in all-quick; both stands; `OWNCHARGE_BREAK=1` must fail), `PORT=<dev server> node tools/qa/owncharge-page.cjs [outDir]` (the real page on the software adapter: the card's two rows, a shut door's row, set by hand, F; `?noowncharge`). The Sam-alone lines of wallcharge-probes.ts / outerwall-probes.ts hold the switch off (they
  were written on the old bag). ON A STEALTH MISSION (`kit.ts KITDEAL.stealth`, on in the page; the night alone is one) your charges are the STEALTH
  card's: none as issued, its pouches full of the mission's kit, so a pouch is given up to carry one, and the loud card's are not that run's.
  `owncharge-check` puts its charges on the card the run wears and has one line on the card as issued. Page: rebuild/player-charges/read-first.md. Never seen on a GPU or played by anybody; the stand-off numbers are the squad's, untuned for a hand.
- **One big slot a man, and small pouches** (`src/game/kit.ts BIGSLOT`, `src/game/bigkit.ts`, slots.json v9; ONE switch `BIGSLOT.on`: ON in the page — `?nobigslot` = the cards
  as they were — OFF in the module and on the frozen stand, `TPS_BIGSLOT=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table
  replays with it off — an F10 journal carries the switch and no kit cards; an F7 run tape carries the cards whole (`runtape.ts kitNow`), `big` among them; Tab ▸ 'Big slot (breaching shotgun, hammer)': the switch, what is on you now, blows / beat / wind-up / draw). The
  maintainer, 10-14: "i do think we should change the breaching shotgun to not take up a primary weapon slot (ready or not and door kickers have it as a separate slot, like the wall
  charge) since its slugs are only effective on door hinges anyways" · "and then we should also add a dynamic hammer" · "you have a single big slot on the bottom that can fit larger
  kit items and then smaller pouches for other stuff". THE CARD: every man has ONE big slot (slots.json `members[].big`, tools marked `"big": true`: wallCharge, shotgun,
  hammer) beside his four pouches; a big thing costs NO pouch (`priceOf`) and a man carries one (`bigUsed`, `illegal`, `giveBig` — a stored card over it keeps what it showed,
  wall charge before the rest, and says what was left behind). The rows (`buildRowsBig`): the Wall charges row is gone, the weapon row is rifle or pistol, and the
  LAST row of every card is 'Big slot' (`bigRow`, field `big`: empty · breaching shotgun · dynamic hammer · wall charge where the build has one, a teammate's only; `bigOf`
  reads the one answer off the two stored fields `walls` / `big`, which stay as they were so the switch off is the old card). A stored card whose gun was the shotgun is
  read as the issued gun with the shotgun in the big slot (`bigHome`). `kitSet(i, 'walls', …)` and `kitSet(i, 'weapon', 'shotgun')` are still answered with the switch on —
  through the big row — for a tool or a tally that names the old rows. ON THE SCREEN (`ui/kitCard.ts`, `ui/startpage.ts`, `ui/loadout.ts`, `ui/kitIcons.ts`): the big row is the
  card's last, full-width tile, the head's pips are four pouches and one wide pip, a roster chip shows the big thing. THE BREACHING SHOTGUN IS KIT (bigkit.ts): nobody's gun — a man
  keeps his rifle or pistol and the M870 comes out for a LOCK only (shotgun.ts `fireShell`'s own rule and noise: gunfire; not a wedge, not steel). YOU: a row in the boot's place on
  a door locked against you ('shoot the lock off — LOUD', verb `breach`; `Player.kick.tool`, `samBig / samBigStart / samBigTick`): planted, `BIGSLOT.draw` 0.5 s, a shell at the
  lock, up to `BIGSLOT.shells` 2. A TEAMMATE: the door tools' lock stage (`toGun / gunStep`) with the gun brought up off its sling as he comes onto his spot (`gunUp`, `Guard.slung`)
  and slung the moment the lock is off, the gun is given up on, the fight has him or the order leaves him (`gunDown`; `slingTick` is the net). THE DYNAMIC HAMMER: ONE blow after a `windup` 0.45 s where a boot would do (0.45 s against the boot's 0.38: carrying it never makes a door slower; `hammerBlows`), `BIGSLOT.swings` 2
  blows `BIGSLOT.swing` 0.7 s apart where the frame holds a boot; the last is `doors.kickIn(…, lock = true)` — the boot's noise (a 'kick', never a shot), from EITHER face (where the frame
  holds a boot the keep is broken and the leaf stands home for a hand), and a WEDGED door too; steel holds. YOU: the same row ('hammer it open — LOUD', verb `hammer`). A TEAMMATE:
  `toGun` picks a shell carrier first, else the hammer man (`hammerStep`; under 'wait for my word' the wind-up is done before the word, the first blow lands on it and the lock gives
  a beat after). A door locked on the face it opens toward that no pick opens is no longer refused to a stack with either tool (`bigOpens` in `stackable / willKick / open`) — a
  SILENT squad keeps its loud tools slung and is refused as before. `Player.bigKit` rides a checkpoint's player slice while the switch is on. QA: `bun run tools/qa/bigslot-check.ts
  [card|off|you|mate|wiring]` (`probes.ts bigslot`; `bigslot-card` also under `kit`, `bigslot-mate` under `doortools`; in all-quick; BOTH stands — it raises the switch itself;
  `BIGKIT_BREAK=1` must fail the lock lines: 54 lines, 18 red under the break, 10-14), `PORT=<dev server> node tools/qa/bigslot-page.cjs [outDir]` (the real page on the
  software adapter: the card's one Big slot row and wide pip, your hammer on a locked door in the boot's place, `?nobigslot`). The probes written on the old card (`kit-*`, `pouch-*`, `shotgun-*`, `squadsmoke-*`) hold the switch off
  on every stand (`probes.ts CARDS_AS_THEY_WERE`; `pouch-table` also holds the issue kit's names and your card's door charge, camera and wand rows off, `CARD_AS_IT_WAS`, for its word-for-word
  lines and its fixture of the build before the pouches rule; `kit-solo`'s first line reads the shipped stand's plain game as the page's `?solo` night, which it is), so on the shipped stand a wall charge set through the big row is covered by bigslot-check alone, and the shotgun as a
  man's GUN is no longer a thing the page can stage. Page: rebuild/kit-slots/read-first.md. NOBODY HAS SEEN IT ON A GPU OR PLAYED ANY OF IT: the harness and the software adapter only; neither
  tool is drawn in YOUR hands, the hammer's blow is a takedown's strike standing in, and a teammate's hammer is not drawn at all (the characters goal's); the Team & kit door picture
  has no demo for either (the kit figure goal's).
- **The big slot's tools open ANY shut door, from beside the frame** (two knobs of `BIGSLOT`, both live only while `BIGSLOT.on` is: `shut` and `beside`, ON in the module — so ON in
  the page (`?nobigshut` / `?nobigbeside` put one off) and on any stand that raises the big slot, OFF on the frozen stand with it — they ride the parent's `FROZEN_HOLDS` row, as
  `FRAG.samStun` rides its own; Tab ▸ 'Big slot' ▸ 'any shut door' / 'worked from beside the frame'; a recording whose `BIGSLOT`
  table has neither key — the build of 10-14 — replays with both off, `journal.ts applyKnobs`). The maintainer after playing, 10-15: "i don't see how to use breaching shotgun or dynamic
  hammer" · "ah these things should work for unlocked doors too" · "helps also not be directly in front of the door when opening" · "hammer should also help with barricaded doors i
  think?". Until then a tool showed only as a row in the boot's place at a door LOCKED against you, and a teammate used his only on a locked door of an entry order: nothing on screen
  said so. SHUT: `samBig` offers the tool at any shut door that is not steel (the shotgun still nothing at a wedge); at a door that is not locked its row ('hammer it open — LOUD' /
  'shoot it open — LOUD') is listed UNDER the door's own rows, one row past the list's cap (`Interactable.past`, `player.ts buildInteractables`: push and ease keep their places and
  the tap of Space is still the hand), and in the boot's place at a locked one as before. One blow or one shell takes a latch that is not locked (`doors.kickIn(…, lock = true)` — the
  keep is broken, loud as the boot / as gunfire), and a door opened with a tool ENDS OPEN from either face: where nothing flings the leaf (the face it opens toward) the same hands
  pull it at the end of the beat (`samBigTick`, `Player.kick.tool.gave`). BESIDE: `samBigSpot` stands you beside the latch jamb, out of the opening — the hammer at
  `doors.kickSpotSide`, the shotgun on a teammate's own breach spot (`shotgun.ts breachSpot`, beside ones only) — when that floor is free, within 1.7 m, no man within 0.6 m of it (a stack's lead stands on that jamb) and nothing solid is between;
  else the boot's spot in front, as before. THE HUD (`ui/overlay.ts updateEquip`): the kit column has a row for the tool under the frag row — no digit, the key every door is worked
  with ('SPACE · hammer · at a shut door') — lit while a door in reach offers it; no row with nothing in the big slot. THE SQUAD (`doortools.ts`, order `bigClear`, key H): while a
  man of the squad carries either tool a door's tools page has a row 'hammer and clear' / 'shotgun and clear' on a key of its own (the page's digits are taken; no digit above 5), the
  door's first page shows it on the row that opens the tools ('door tools ▸ · H: hammer and clear') and H gives it from there — X, then H (`bigKey`, read in `game.ts` beside the frag
  row's key). It is an open-and-clear with `DoorOp.big`: the tool takes the door whether it is locked or not (`toGun`'s man beside the frame, `gun.shut`), no halt at a door found
  shut (the row is the call), one trip to the door (`op.noGun` after it: from the face the leaf opens toward the lead's hand pulls it); at steel and at an open door it is refused; for a SILENT squad it is one of `silent.ts LOUD_ROWS` (marked LOUD; picking it is the squad going
  loud, as bang and clear is) and one of `holdfire.ts LIFT_ORDERS`; a wedge nobody has tried is not read by the menu (only the shotgun to hand, the lead's hand finds it and the order
  halts as any door found shut does). The hammer's blows are counted the same for you and for him: `BIGSLOT.swings` where the door is locked and the frame holds a boot, else one. A PLAIN open and clear on a door that is not locked still uses the handle: a blow is heard through the floor like a shot and the room digs in
  on it, so the men do not break doors that open on their own say-so. `orders.ts hud()` gained the key's advert on the page that carries 'wait for my word' (the shipped menu), which
  showed none. QA: `bun run tools/qa/bigslot-check.ts shut` (in `probes.ts bigslot`, both stands; `BIGKIT_BREAK=1` must fail its lines) and the new lines of
  `tools/qa/bigslot-page.cjs` (the HUD's row lit and unlit, the row under an unlocked door's own, the door ending open from beside the jamb, 'H: shotgun and clear' in the drawn menu).
  MEASURED 10-15, headless, one seed a line (the check's own): `bigslot-check` 85 lines green on the frozen stand and under `TPS_PROFILE=shipped` (26 of them the `shut` part), 29 red under `BIGKIT_BREAK=1` on each; `bigslot-page.cjs` 16 lines, no page error (software adapter); the gates `bigslot kit doortools doormenu frameholds silent holdfire journal words dialogue squadplay shipped owncharge wand` green on both stands;
  you break an unlocked latch 0.48 s (hammer) / 0.53 s (shotgun) after the press, standing 1.16 m / 1.31 m along a 0.86 m leaf from its hinge (0.43 m, in the opening, with `beside`
  off); a teammate's blow lands 0.6 s after the stack is made. NOBODY HAS SEEN IT ON A GPU OR PLAYED IT: the row's place on the HUD and its wording are untested on a person; the beside spot was measured on the office's storage
  door and the room clear's two doors only. (The tools are DRAWN and walked to the frame since the next bullet.)
- **The big slot's tools are carried, walked to the frame and swung** (`BIGSLOT.moves`, with `equip` 0.6 s, `heft` 0.7 s, `stow` 0.45 s, `reach` 2.4 m; live only while
  `BIGSLOT.on` is: ON in the module — so in the page, `?nobigmoves` puts it off — and on any stand that raises the big slot, OFF on the frozen stand with it; it rides the
  parent's `FROZEN_HOLDS` row as `shut` and `beside` do; Tab ▸ 'Big slot' ▸ 'carried, walked to the frame, swung' / 'tool ▸ to hands (s)' / 'hammer ▸ wound up, drawn
  (s)' / 'tool ▸ reach (m)'; a recording whose `BIGSLOT` table has no `moves` replays with it off, `journal.ts applyKnobs`). The maintainer, 10-15, with Door
  Kickers 2 footage: "i think the dynamic hammer and shotgun animations / pathing need some work" · "using the hammer shouldn't require being directly in front of the door?"
  · "like the character should have a hammer on their back, they put away their gun, equip the hammer, wind up, and then hit the door in one motion". WHAT WAS WRONG: the
  tool's row lit only inside the hand's reach of the leaf (`Doors.USE_REACH` 1.35 m of its middle — nothing from where a stack stands), and the one place beside the frame was
  the lead's own mark, refused within 0.6 m of a man, so you were slid to the boot's spot square in the doorway; nothing was drawn. THE ROW (`bigkit.ts samBigFar`, `player.ts
  buildInteractables`): within `reach` of the doorway, with a place he can walk to, the door offers the tool's row though the hand cannot reach the leaf (the row alone: push
  and ease still want the hand). THE PLACES (`bigSpots(g, d, side, tool)`, one list for you and for a teammate — `shotgun.ts breachSpot(…, close)` tries it first): on the
  latch jamb hard by the wall, then off the lead's shoulder just past the latch edge, and on the hinge jamb only on the face the leaf opens AWAY from (the hammer then strikes
  by the hinges); each needs floor and a clear line to the point struck (`at`). The shotgun's are a hand from the lock, not the 1.0 m and more its pattern needs. `samBigSpot`
  takes the first on HIS side of the opening that is free (no man within 0.45 m, within `reach` + 1.2 m), by a straight leg clear of walls and of men, else by ONE corner
  round the man in the way (`via`); with none, the old spot and the old reach. THE WALK (`samBigWalk`, `Player.kick.tool.moves`): 1.5 m/s on his own legs, never the sprint,
  the tool coming into his hands on the way; at 3 s he works it from where he got to if that is within 0.5 m, else the beat is given up ('no room to work it from here'). THE
  BEAT, one clock for the game and the picture: his hands leave his gun at the press; the first blow lands `equip` after it or as he arrives, whichever is later, plus the
  wind-up — `heft` with the moves on (`bigWind()`; the old `windup` 0.45 s is the one with them off, so off is the build before), and blow to blow is never less than a
  rebound and a wind-up (`bigSwing()`, 0.95 s); a shell goes at `draw` or on arrival; a blow or shell that has landed is followed through (the animator's own rebound,
  `character.ts bigRebound`: 0.25 s the hammer, 0.13 s a shell), then the tool goes back over `stow` while HIS LEGS ARE HIS OWN — THE TAIL (`samBigTail / samBigTailTick /
  samBigEnded / samBigDrop`: the pose kept on `anim.bigTool`, its clock kept in bigkit): no round leaves his gun until it is back (`equipT` = what is left of the stow; on the
  page the kit's own draw then brings the gun up, `kitanim.ts`, as after a lock pick), no tool's row is his (`samBig`), his goggles are a nod, no checkpoint is written
  (`savestate.ts`); anything else that takes his hands ends it at once (kitanim's own list, and a door or a wall under them) and `cancelActions` drops it. Broken from the
  face the leaf opens TOWARD he stays planted until the tool is back, and the same hands then pull the leaf. THE PICTURE (`character.ts anim.bigTool` = { kind, t, equip,
  windup, stow, blows, end, at }, written by the game every frame; the pose is a pure function of it — `bigLayer`, table `BIGMOVE`; out: `anim.bigK` 0 on the back … 1 in the
  hands, and `hideHeldItem` while his hands are off his gun): gun away, the right hand over the shoulder to the handle, both hands on it, wound up over the right shoulder,
  the whole trunk into a swing whose head lands ON `at` at each told time, a rebound, then back. `rigProps.ts bigBoxes` draws it (`BIGRIG`, tag `BIG_TAG`): the hammer head-up
  behind the right shoulder or carried to the fist by `bigK`; the shotgun across the back in a long gun's boxes (the carbine's: the M870 has no parts of its own).
  OVER THE RIFLE (10-16): only while Sam's rifle lies ACROSS HIS BACK (slung, not in his hands, not on its sling in front) the tool rides `bigClearOf` further off
  it: `BIGRIG.clear` a tool (hammer 11 cm, shotgun 7.5) plus as far as `slungBase` itself puts the rifle out on that body — one distance for the drawer and, through
  `anim.bigClear` (metres now, 0 = nothing under it), for the hand that goes for the handle. Before, one 7.5 cm served both and applied whenever he owned a rifle: the
  hammer's head lay 2.6 cm inside the bullpup and 1.8 inside the carbine's stock, and floated off an empty back with the rifle in his hands. Check: `bigslot-moves`
  'OVER THE RIFLE' (box against box on the stand's body and rifle, and in the game's own frame, both tools): 0.9 / 0.9 cm frozen, 1.6 / 0.9 shipped. The tool
  moves out in ONE frame as the rifle reaches his back (a pop, with the rifle's own). Never seen on a GPU.
  `combat.ts`: Sam's own gun is slung or holstered for the beat; a teammate's hangs down his front (`hungBoxes`). `bigCarried` is null with the switch off: no box is added
  and the frame is the build before's. A TEAMMATE (`doortools.ts toGun / hammerStep`, `Guard.bigOut`, `hammerOut / hammerIn / hammerOutTick`): the hammer comes out as he is
  sent to the door, the blow is told a wind-up ahead (held wound up for a word), and it goes back when the lock is off or the order leaves him (`hammerIn`, after the last
  blow's rebound) — and is on his back AT ONCE when the fight has him or a round leaves his gun (`hammerIn(…, hard)`, `combat.ts fireWeapon` → `bigFired`): what is drawn in
  his hands is what the sim fires. QA: `bun run tools/qa/bigslot-check.ts moves` (in `probes.ts bigslot`; both stands; `BIGKIT_BREAK=1` must fail its lines), `PORT=<dev
  server> node tools/qa/bigmoves-page.cjs [outDir]` (the real page on the software adapter, with the renderer's own stills), `bun run tools/qa/bigmoves-strip.ts --out <dir>`
  (headless stick strips of the pose and the boxes, for looking at). MEASURED 10-15, headless, one seed a line: the family's 19 lines green on both stands; from 1.5 m past
  the latch edge (2.0 m from the doorway) you arrive beside the jamb at 0.78 s — 1.21 m along a 0.86 m leaf, 0.55 m off the wall, no frame in the opening — the blow is told
  for 1.48 s and lands at 1.50 s (the footage's lands about 1.5 s after the man is sent), your legs are your own at 1.80 s, and a round can leave your gun 0.75 s after the
  blow with nothing in your hands — on the shipped stand 1.08 s with the pistol up and 1.37 s with the rifle up (a scratch probe: the kit's draw after the stow); the
  shotgun's shell goes at 0.77 s from 0.88 m off the lock (1.19 m before); with a man on the latch jamb you work it 0.58 m off his shoulder, third in the file you walk one
  corner round the second man; a teammate's blow lands 1.31 s after the stack is made, from 0.55 m off the wall (a metre and more before). KNOWN: the hammer's first blow is
  1.3 s after the press from the leaf and 1.5 s from the stack (0.48 s before this, the boot's time) — the footage's pace, and its cost; a bare Space from the stack's
  distance now swings the tool when its row is the only one; on the face the leaf opens toward, from the hinge side, he walks past the shut leaf to reach the lead's shoulder.
  A SECOND LOOK (10-15, a reviewer on the stick strips against crops of the footage): the wind-up was too brief and inside his silhouette, the hammer did not read on his
  back, the reach for the handle fell short with a rifle across the back, the shotgun's recoil did not show — hence `heft`, the `wound` pose held out behind the right
  shoulder, `BIGRIG`'s thicker handle and slanted carry, `anim.bigClear`, and the shotgun's `kick / climb / shove`. NOBODY HAS SEEN IT ON A GPU OR PLAYED IT: the pose and
  `BIGRIG`'s numbers were placed against headless stick strips and the software adapter's stills, not in the viewer; putting his own gun away is a pop at 0.17 s (a carried
  put-away would add about 0.6 s: a call for the maintainer); the last blow rebounds though the door gives; with `KITANIM` off (and on a teammate) his own gun pops to its
  place rather than travelling; the shotgun is the carbine's boxes; a dead man keeps the tool on his back.
- **The big slot's tool and his own gun stay in a hand on the way** (`BIGSLOT.snug`, a key of the big slot's table as `moves` is: ON in the module — so in the page,
  `?nobigsnug` puts it off — live only under `BIGSLOT.on` and `moves`, so OFF on the frozen stand with them and riding the parent's `FROZEN_HOLDS` row; Tab ▸ 'Big slot' ▸
  'tool and gun stay in a hand'; a recording whose `BIGSLOT` table has no `snug` replays with it off, `journal.ts applyKnobs`). The maintainer, 10-18: "gun not aligned to
  hand for partner. we should do a pass for all the attachment points" — that pass (IN HAND, above) measured the hammer out of the hands on its way to and from the back and a
  teammate's rifle as the hammer comes off, and left both to the big slot. WHAT WAS WRONG, three things in `character.ts`: (1) the tool went from his back to his fist
  (`bigK`) over `take` 0.47‥0.82 of the equip, but the fist is on his back at `grab` 0.5 and LEAVES: for a quarter of the move the hammer was drawn part way between a back
  and a hand already on its way down (8.5 cm at p95, 10 at worst); (2) his own gun stayed in his hands until `hide` 0.28 while the right hand was already going over his
  shoulder — the rifle rode up with it, the other hand 15 cm off its handguard on average and 30 at worst, the bore up to 95° off the fingers; (3) putting it back, the
  fist's place on his back was built on the pose BEFORE the chest twist and the drawer reads the joints AFTER it: twisted 86° at the aim as he walks off, the fist stopped
  13 cm wide of the tool and the tool jumped that far in two frames. NOW (`BIGMOVE.snug`; the animator is told by the beat's own record, `anim.bigTool.snug`, written by
  `bigkit.ts` — the pose stays a function of the record): the tool changes between back and fist over 0.44‥0.56, while the fist is THERE, and goes back over the last fifth
  of `put`; his gun is let go at 0.06 (a teammate's falls to its sling at once, yours goes where it went) and shows again from 0.94 of the stow; the fist's place is the
  back's frame as it WILL be (`twisted`, `untwist` run forwards) brought back through `untwist`. The beat's own times (`equip`, `heft`, the blows, `stow`) do not move, nor
  does anything a door or a guard reads. For YOU it also means your gun and its rail light are away 0.13 s sooner and back 0.04 s later (`hideHeldItem` is what the light,
  the IR laser and the kit hands read). QA: `bun run tools/qa/bigslot-check.ts moves` — 'IN A HAND ALL THE WAY' (in the game: a teammate's hammer on the manager's door,
  every frame of the beat, the hammer as drawn against the hollow of his fist while it is off his back, and how far a hand carries his own gun), 'BY THE RECORD, OUT AND
  BACK' (the animator alone, a teammate at the aim with his chest square and turned a radian either way: out, one blow, back — the put-back and the turned back are asked
  here, the same on any stand), a control under each (the switch off; a record with no `snug`) and the journal line; `BIGSNUG_BREAK=1` must fail the two; both stands.
  `tools/qa/attach-play.ts` asks the tool of a fist only while it is off his back (a hand on its way to a tool still on him holds nothing — teammates and you);
  `bigmoves-strip.ts` and `attach-mesh.ts` write `snug` into their records, so the strips show what the game shows. MEASURED 10-18, headless: the check's teammate, the
  hammer 0.0 cm out of his fist at the worst on both stands (off: 9.9 cm frozen, 8.5 shipped) and his gun carried 4.4 / 1.7 cm (off: 45.1 / 26.8); by the record 0.0 cm out
  and back at 0 and ±1 rad (no `snug`: 4.5 and 3.6 cm square, 10.1 and 8.7 turned one way, 8.1 and 5.5 the other); `bigslot-check` whole, green on both stands, the two
  lines red under the break on both; and two played missions on the shipped stand (`attach-play`, the kill house with a mixed squad and the compound, one seed, 12.9
  thousand frames, two men with hammers): the hammer in a fist 0.0 / 0.4 / 0.4 cm mean / p95 / worst over 633 frames (it was 2.6 / 8.5 / 10.3 on its way), the rifle as the
  hammer comes off 4 frames with the support hand 3.6 / 6.2 cm off it and the bore 8° / 15° off the fingers (it was 34 frames, 15 / 30 cm, 45° / 95°). NOBODY HAS SEEN IT
  ON A GPU OR PLAYED IT: whether a gun let go that early reads as dropped rather than slung, and whether the change of hands at the shoulder reads at 60 frames a second,
  are for a person. LEFT, measured: THE SHOTGUN takes the same four shares, but its fist's place over the shoulder is the rifle's, not where the slung shotgun lies — it
  still changes hands across a gap (your own, traced on the check's storage door: 7.1 cm from the hollow at the shoulder by the nearest box, a measure that reads 2.9 at
  rest; it peaked at 8.7), now in 6 frames where it took 16. A TEAMMATE THE FIGHT TAKES before he has put the hammer back has it on his back at once (`bigkit.ts hammerIn`
  hard, `bigFired`: what is drawn is what the sim did) — a one-frame change, by rule; the check's teammate on the shipped stand is one. The breacher's cast mesh carries a
  long tool of its own that the hammer and the shotgun cross (art, or which man wears that kit: the maintainer's).
- **The big slot's tool changes hands with the weight of a gun swap** (`BIGSLOT.weight`, a key of the big slot's table as `moves` and `snug` are: ON in the module — so
  in the page, `?nobigweight` puts it off — live only under `BIGSLOT.on` and `moves`, so OFF on the frozen stand with them and riding the parent's `FROZEN_HOLDS` row; Tab ▸
  'Big slot' ▸ 'tool swaps weigh what a gun swap does' and its four sliders; a recording whose `BIGSLOT` table has no `weight` replays with it off, `journal.ts
  applyKnobs`). The maintainer, 10-18: "the swaps when taking out the hammer and putting it back feel too fast -- swapping the guns feels good, can we make sure they all
  feel similarly physical?" THE REFERENCE (`character.ts KIT`, as the game steps it — `bun run tools/qa/swap-times.ts`): pistol to rifle 1.03 s and back 1.00 with the
  rifle across his back, 0.67 / 0.63 with it on its sling in front; every part of it is a hand carrying a thing to its place. THE TOOLS BEFORE: your own gun VANISHED from
  your hands 0.07 s after the row (`snug.hide`), the hammer was in both hands at 0.6 s and the shotgun at the shoulder at 0.5, and either was back on him 0.45 s after it
  started back (off the fist at 0.27). NOW (`bigkit.ts`): (1) YOUR gun is carried to its holster or sling by the kit's own hand first — `samBigLeadOf` starts the beat's
  clock that gun's own stow below zero (pistol 0.3 s, rifle in front 0.36, rifle on his back 0.54, a can 0.26; none with empty hands or with the kit's hand off),
  `samBigCarry` leaves the errand to `kitanim.ts kitTick` (the beat does not take the arm from it, `kitInHand` says nothing is held), and he walks to his place meanwhile;
  (2) the tool's own times are `equipW` 0.8 s (hammer to both hands), `drawW` 0.7 (shotgun to the shoulder) and `stowW` 0.75 (either back) in place of 0.6 / 0.5 / 0.45 —
  `bigEquip` / `bigStow`, written into the beat's record, so the pose stays a function of it; (3) the hammer's wind-up may begin `flow` 0.2 s before the hammer is all out
  (`bigOutBy`: the animator already lets a wind-up bring the tool out), which is the whole of what was added to its way out. A TEAMMATE's record carries the same times;
  his own gun still falls to its sling as his hands leave it (it hangs on him), his hammer's blow waits what it did, his shotgun's shell 0.2 s more. WHAT IT COSTS A
  DOOR (headless, off the game's clock, one seed, the plain night's storage door; the same on both stands with the kit's hand raised): the hammer's one blow from a step
  away lands at 1.30 s with empty hands (as before), 1.60 with the pistol up, 1.67 with the rifle in front, 1.85 with it on his back — before: 1.30 whatever he held; from
  the stack's second place (the walk hides most of the wait) 1.50 / 1.60 / 1.67 / 1.85 against 1.50; the shotgun's shell from a step away 0.70 / 1.00 / 1.07 / 1.25
  against 0.52, from the stack's place 0.77 / 1.00 / 1.07 / 1.25 against 0.77; his gun is up again 0.27 s later than before after either (the longer way back). Nothing a
  guard or a door reads moves except those times; as issued nobody carries a hammer or a shotgun, so no tally moves until a card is given one. QA: `bun run
  tools/qa/probes.ts bigslot-weight` (11 lines: your gun to its place by hand — the beat's clock below zero for the gun's own stow, the kit's hand at work in every frame
  of it, the gun never hidden in them; the record's times and the hammer later into the fist and later onto his back, no step of his right hand in a frame longer than
  the kit's own draw takes; the blow's time and the cost against the switch off; the way back; called off inside the wait; off a wall hold; what is in his hands sets the
  wait; the shotgun; a teammate's record; the journal line — each with its control under the switch off), `BIGWEIGHT_BREAK=1` fails eight of the eleven; both stands
  (the frozen stand raises the kit's hand by hand and says so). FOUR EDGES a review found, each held by a line: (a) the tail's fire lock (0.70 s now) was cut to the kit's
  `plainLock` 0.45 by `kitTick`, so for 0.2 s a round could leave a gun still on its way back to his hands — the clamp leaves a tool's tail alone; (b) the wait is for
  what the kit's hand HOLDS (`kitWas`), not what the game says is up: a pistol handed back by a wall hold's own arms was waited for with no errand to run — none now, and
  a wait whose errand is over early ends with it (`samBigTick`); (c) a beat called off inside the wait (the door opened by another hand) ended only when the clock came
  up to zero, and could leave a negative end that read as none — it is over at once now, no pose shown, the kit's hand bringing the gun straight back; (d) the frame the
  tool let go of his hands his gun stood in them, then went to its holster to be drawn (the animator's word is a frame old when the kit reads it) — with the weight on
  the kit reads the beat's record itself (`kitanim.ts handsOff`, `character.ts bigOff`) and draws the same frame; off, the build before keeps its frame.
  `bigslot-moves`' own lines read `bigEquip` / `bigStow` / `bigOutBy` now, and its `snug`-off control holds the weight off with it (the first-pass timing is the build
  before both). `tools/qa/bigmoves-strip.ts --only game` draws THE GAME'S OWN BEAT — nothing written by the tool, the row taken a step from the door with a gun up and
  every frame stepped by the game until the gun is up again (`--noweight` = the build before); `tools/qa/bigmoves-page.cjs` asks the wait and the times of the real page
  and has a `noweight` section. NOBODY HAS SEEN THIS ON A GPU OR PLAYED IT: the times are measured, the look is read off stick strips and the software adapter — whether
  0.8 and 0.75 s feel like the gun swap in the hand, and whether the wait before the shotgun's shell is too long with a rifle on his back, are the maintainer's to say
  (the four sliders are live in the panel).
- **The ballistic shield is gone from the game** (10-18; the maintainer, 10-15: "we should also probably just get rid of the ballistic shield, doesn't match the vibes
  (feels more like swat)", 10-18: "we should just remove the riot shield"). It was switched off in the page from 10-15 to 10-18 (`SHIELD.on`, in on the frozen stand) and is
  now CUT: no `src/game/shield.ts`, no `SHIELD` knob table, no `TPS_SHIELD` word or `FROZEN_HOLDS` row, no `?shield`, no Tab row; `MemberKit` has no `shield` field and the big slot
  offers empty · breaching shotgun · dynamic hammer · wall charge; slots.json v10 has no shield tool and no 'Shield and shotgun' squad kit; a round, a blast and a defender's aim
  no longer ask about a plate (combat.ts, frag.ts, guards.ts), a stack is dealt by the plain rule (doortools.ts, orders.ts: no shield man put first), the figure has no plate
  layer (`character.ts`), the kit figure and the Team & kit door picture draw none (`ui/kitFigure.ts`, `host/kitView.ts`). NO SWITCH: every stand is the build as it was with the
  shield off, so the shipped stand's digests are unmoved and the frozen stand's move only where a shield was staged (the long hall; the kit probes that planted one). WHAT OLD
  DATA DOES: a stored or pasted card that says `shield` is a card without one — `kitSanitize` takes only what a row offers, and the next change of a row writes the store without
  the word; a save never named one; a level whose issue card says `shield` is REFUSED with the reason in words (`scene/levelData.ts`: 'the ballistic shield is out of the game:
  take the key out'; levels/hall.json and hall-gwot.json now issue nothing); an F10 session whose knobs carry the `SHIELD` table LOADS (the table is passed over) — where a shield
  man was in it the replay parts from the file's digests and says the frame, since the file does not say who carried what; an F7 run tape made with a shield man is refused before
  a re-run, in words (`replay/format.ts tapeShield`: the table on AND a teammate's card carrying it or the long hall's issue; the map viewer plays its samples as ever). QA:
  `bun run tools/qa/noshield-check.ts [gone|card|staged|tape]` (`probes.ts noshield`, in all-quick; the same 24 lines on BOTH stands; `NOSHIELD_BREAK=1` lies to the check — a
  shield value on the big row, every tape waved through — and must fail a card line and the tape line). The `shield-*` probes, `shield-tally.ts` and `pellets-shield` went with it.
  `tools/qa/lived-check.ts` holds a level to its file at a base commit and loads that file with today's reader: a base whose issue block hands out the shield (the long hall's)
  has its issue block and the level's note read as today's, said in a line, and takes no new base revision; `tools/qa/level-needs.ts` reads a level's issue cards as written.
  LEFT AS IT IS: the riot shields stacked in the barracks' bunk room (`tools/levels/barracks.ts`: set dressing, nobody carries one). MEASURED, headless only: see the long hall's
  bullet in missions.md for the hall without it. NOBODY HAS PLAYED A MISSION SINCE THE CUT; the kit figure, the kit view and a stack without a shield man have not been seen on a GPU.
- **Lamps need a real hit, and moving feet cost the shot** (`src/game/aimcost.ts`, table `AIMCOST`; two switches, `AIMCOST.lamp` — ON in the page, `?lamphit=0`; and
  `AIMCOST.move` — ON in the page, `?movecost=0`; both OFF in the module and on the frozen stand, `TPS_LAMPHIT=1` / `TPS_MOVECOST=1`; two `FROZEN_HOLDS` rows, the table in the knob
  registry and a journal's tables, a recording with no `AIMCOST` table replays with both off; neither acts under a show; Tab ▸ Player & weapons ▸ Player, doors & props ▸ 'lamps need
  a real hit' / 'moving costs accuracy' / 'moving ▸ cone ×' / 'moving ▸ held s'). The maintainer, 10-13, on the pistol against far lamps: "it's pretty much just point and click with
  distant lights", then "yeah, needs a real hit. we should also really penalize accuracy while moving". LAMP: the player's round must MEET the bulb (0.12 m; a wall device 0.16) or
  one of the fixture's own boxes (+3 cm) — it used to break anything within 0.3‥0.45 m of the round's line — and the reticle coming onto a lamp starts the aim's settle over
  (`aim.ts trackPlayer`). The reticle's snap to a light, the OCP and the launcher are untouched. MOVING, anybody holding a gun, no new die: the cone's feet term × `moveK` 2, the
  feet REMEMBERED `stopTau` 0.35 s after he stops, the rifle's brace takes half its share off the feet; a guard starts no burst while his remembered feet are over 1.2 m/s; a room
  fight's men get the same; the HUD's aiming ring may open to 120 px (60 before) so the cost reads on the ring. Check: `bun run tools/qa/aimcost-check.ts` (both stands;
  `AIMCOST_BREAK=1` must fail), `[ONLY=cost|off] PORT=<dev server> node tools/qa/aimcost-page.cjs [outDir]` (the real page on the software adapter, the ring's own width; about half
  an hour a page). Measured headless: pistol at a lamp 10 / 15 / 20 m — settled standing 100 / 99 / 79 %, crouched 100 %, swing-and-click 68 / 30 / 17 %, walking 1 / 0 / 0 %; a
  man's chest at 5 / 10 / 15 m at a walk — pistol 25 / 9 / 4 % (was 57 / 23 / 14), rifle 38 / 14 / 8 % (was 100 / 53 / 32); settled and standing as before. Paired play-throughs:
  25 against 22 won of 32, no errors. Sound tapes that shoot a light (train-lights, train-kit) re-run as recorded. Page: rebuild/aim-has-weight/read-first.md.
  Never seen on a GPU or played by anybody; `moveK`, `stopTau` and the bulb's size are untuned by feel.
- **Unlimited ammo covers wall charges (10-14; the maintainer: "unlimited ammo doesn't apply to wall charges").** `Game.infiniteAmmo` (the start card's
  sandbox row, Options, Tab) made magazines, cans, ring airfoils and 40 mm shells bottomless; a wall charge still came out of the count. `wallcharge.ts take()`
  now spends nothing while the switch is on and there is one to set (the run's carried count, or the breaching bag when it carries none), whoever's hands set
  it; the record is marked `free` so one that comes off the wall unblown adds none, and a checkpoint does not count it back (`savestate.ts ownCharges`). None
  carried is still none. The switch off = as it was; no new key (the flag is in the journal and the saves already). The three tooltips say so. NOT covered,
  as before: the squad bag's door charges, bangs and frags. Check: `probes.ts ammowall` (family `wallcharge`; 5 lines; `AMMOWALL_BREAK=1` red) on both
  stands. Headless only: never seen in a page, never played.
- **The flank round past a held colleague waits for still feet** (`AIMCOST.flankAt` 0.3 m/s, `aim.ts feetSettled`, asked at the standoff's round in `guards.ts`; part of
  `AIMCOST.move`, so `?movecost=0` / the frozen stand = the round as it always went; a recording whose `AIMCOST` table has no `flankAt` replays with no wait). Why: the moving rule
  left the cone open a beat after the walk round, and the standoff's aimed round (0.45 m clear of the man in Sam's arm, taken the frame the line is his; discipline off, or the
  gun-hold's line) found his own colleague — `standoff-flank` went red on the page's stand at the build step that brought `AIMCOST` ("Novak died in the arm: shot/guard").
  Measured headless, the page's stand, discipline off, one man, 24 seeds: before, the held man shot dead by his colleague in 4 of 24 and 119 of 129 rounds on Sam; with the wait,
  0 of 24 and 137 of 137, the first round 8.35 s after the grab against 7.27 s. Rule off, 12 seeds: 0 of 12, 76 of 76, 7.27 s. Check: `TPS_PROFILE=shipped bun run
  tools/qa/probes.ts standoff-flank` (red with `flankAt` raised past a walk). Never seen on a GPU or played by anybody.
- **On screen he is "the player", not Sam** (the maintainer, 10-15: "let's rename "sam" to just "player""). Every STRING the page can show says player: the Team & kit
  slot (You · point man), a room clear's end line and objective row ('player down'), save refusals ('the player is down'), the names on the debrief, the death recap and
  a replay's cast row ('Player', `src/replay/format.ts PLAYER_NAME`), the debugger's hover text, the showcase captions, the viewer's and the editor's sheets. No switch:
  it is a word, not a rule (no digest carries his name; `?oldwords` lines say player too). CODE still says Sam and a new string must not: identifiers, level keys
  (`team.sam`, `samYaw`), the dialogue speaker key `'sam'`, CSS classes, probe names (`sup-sam`), comments, these notes' older bullets, and three values no screen shows
  (`doortools.ts SAM_BY`, `wallcharge.ts` a set charge's `by`, `kitView.ts` the scan rows' name). Old files: a saved defuse row and a kept replay's cast row read back
  as Player (`defuse.ts restore`, `format.ts decode`); an old replay's LOG lines keep the old word. Checks that match the strings follow (`roomclear-ends`,
  `verdict-check`, `deathrecap-check`, `defuse-check`, `roomkeep-check`, `teams-player`, `verdict-look.cjs`; 12 panel-inventory rows reworded with `--reword`).
  Headless only, both stands; the title, the kit page and a room clear's down line read off the real page on the software adapter. Never seen on a GPU.
- **A primary and a secondary for every man** (`src/game/gunslots.ts`, `GUNSLOTS.on`; the maintainer, 10-18: "also should we model more firearms? and separate
  primary and secondary slots?"). On in the page (`?nogunslots` = the card of the build before), off in the module and on the frozen stand
  (`FROZEN_HOLDS 'GUNSLOTS.on'`, `TPS_GUNSLOTS=1`); a recording from before the table replays with it off (`journal.ts applyKnobs`). It rides on the big
  slot's card (`BIGSLOT`: the shotgun is kit there, never a man's gun): with that off the card is the build before's too. WHAT THERE WAS: you carried two
  guns (the pistol on 1, the long gun on 2 — the swap the maintainer likes: "swapping the guns feels good") and a teammate ONE; his card had one Weapon row
  and the sidearm on his thigh was drawn only. WHAT IT IS NOW: the card's one gun row is two — **Primary** (a long gun of `gunslots.ts PICKS`, or none: the
  sidearm alone) and **Secondary** (a sidearm) — on every member's card, each a row of choices over its own field (`MemberKit.primary` / `.secondary`: a
  pick id; `kit.ts buildRowsGuns`). WHETHER a long gun is brought stays in `MemberKit.weapon` ('pistol' = none), the one field every rule of the build
  before reads (your launcher rounds stay home with no long gun, the kit figure's yaw, `kitPlayer`) and every older hand writes (the Quiet set, a mission's
  issue card, `kitSet(i, 'weapon', …)` from a tool — taken as the Primary row's long gun / none): `primary` only says WHICH long gun, and the Primary row's
  `none` is `weapon: 'pistol'` (one source of truth; nothing to keep in step). A pick names two `weapons.ts` rows:
  the gun with a suppressor fitted and without (`pickRow`; a teammate's Suppressor row picks between them, both of yours wear one). `kitGun(m)` is the
  primary's row (the secondary's with none), `kitSide(m)` the gun NOT in his hands, `kitSecond(m)` the secondary slot's row. A stored card from before the
  slots is its gun field plus the issued picks (`kitSanitize` → `gunsHome`). A tile names the gun the card then hands him (`word(v, m)`: the bare row's
  name with the suppressor off). TODAY THE TABLE HAS ONE PICK A SLOT (the issue
  carbine, the issue pistol): the rows, the store and the second gun are in; the list of guns is the next step of the same goal.
  **A teammate carries both.** `Guard.second` = the gun that is not in his hands (`sideStage`, from `kitStage`; none for a man whose gun is a pistol).
  `GUNSLOTS.dry`: the round that empties his primary on a man within `near` (10 m) sends him to his sidearm instead of a magazine change — `out` 0.7 s
  where the carbine's reload is 2.4 s — on both trigger paths (the fight AI: `guards.ts startReloadBeat` → `sideOutAlert`, the range = his man's last known
  place; a room fight: `roomfight.ts tickOp`'s dry click → `sideOut`). `sideLocked` (his hands between guns: no round) is asked by all three triggers a
  teammate has — the room fight's, cover fire's, the fight AI's fire site. The swap is written where the
  big slot's shotgun writes its own (`route.weapon`: `game.ts` deals a man's row off his route every frame). The long gun hangs down his front on its
  sling while the sidearm is out (`combat.ts hungSide` → `rigProps hungBoxes`). `sideTick` (every frame, `game.ts`): nobody in his eyes and no round from
  it for `lull` (1.6 s) → the sidearm goes back TOPPED OFF and the primary comes up RELOADED, his hands busy for its reload + `back` (0.65 s, as long as your own swap back to the long gun); an empty
  sidearm is never drawn. Past `near`, or with no
  second gun, he reloads as he always has. You: the swap in your hands is as it was (1 your secondary, 2 your primary); which two guns they are is
  your card's (the next bullet). No checkpoint slice: a floor with a spawned unit on it takes no
  checkpoint (`savestate.ts canSave`), and every teammate is one.
  UI: the two rows are drawn as their class of gun (`ui/kitIcons.ts` by `pickIcon`: the same three drawings; no long gun = an empty board), wear the can by
  `kit.ts kitRowCan`, carry their own noise mark (`ui/kitNoise.ts`), and the kit view plays the gun's demo for either (`host/kitView.ts TILES`).
  Check: `bun run tools/qa/gunslots-check.ts` (families `gunslots-card -mate -fight -guns -off` in `probes.ts`, in `all-quick`), ALL PASS on both stands;
  `GUNSLOTS_BREAK=1` fails every family. Probes written against the one gun row (`bigslot- kitpaste- kitlent- kitcan- sticky-`) run with the
  switch held off (`probes.ts GUN_ROW_AS_IT_WAS`); the card family has its own paste, set, issue-card and old-row verdicts under it. `gunslots-fight` is the measure: two teammates with a round each and three men five metres in front of them —
  on, the third is down to a sidearm round 0.50 s after the guns ran dry; off, he was still standing twelve seconds later (one seed, one room).
  `gunslots-off`: ten seconds of the staged room clear digest the same with the second guns carried and nobody dry. `TPS_GUNSLOTS=1` alone does nothing on a frozen run: `TPS_BIGSLOT=1` with it. NOT DONE HERE:
  a swap ANIMATION on a teammate (his pose changes with the row in his hands, the equip sound plays, nothing is animated between); the dry man's sense
  beyond range and sight (he does not weigh cover or a mate's line). Headless only; never seen on a GPU, never played.

- **More guns in the two slots** (`weapons.ts WEAPONS` rows `mk12 mp7 mk46 m1014 hk45 g18`, offered by `gunslots.ts PICKS`; the maintainer, 10-18: "should we
  model more firearms?"). Under `GUNSLOTS` (the bullet above: no switch of their own — off, nothing constructs one). EACH IS SET APART BY SOMETHING FELT,
  NEVER BY HIT POINTS (`damage: 'oneShot'`, every row). Primaries: **Mk 18** (the issue carbine, `fn2000` / bare `aks74u`: the only one with the launcher
  under it) · **Mk 12** REACH (semi, 20, `hands.still` 0.45 and half the carbine's `aiSpread`; slow to come round 0.62, wide on the move) · **MP7** QUIET
  AND QUICK (report 0.8 = not gunfire, 40 at 900 a minute, handling 0.95, the steadiest on the move; no group past a room) · **Mk 46** VOLUME (100 on the
  belt, a string that barely opens; handling 0.5, wide on the feet and closed kneeling `hands.crouch`, 6 s to feed, loud, tracers) · **M1014** THE ROOM
  (7 shells at 0.28 s, a tighter pattern to 10 m; opens no lock — `PelletSpec.breach` is now OPTIONAL and absent on it, so no door tool picks its man as the
  breacher). Secondaries: **Glock 19** (issue: `fiveseven` / bare `guard9mm`) · **HK45** THE QUIETEST (report 0.45, 8 rounds, slower) · **Glock 18** (33
  on automatic, loud; Z with it selected is its selector). New row fields: `hands` (your cone's multipliers by row — `player.ts rifleSpread`), `launcher:
  false` (`Rifle`: no ring, no 40 mm, no camera tube; `kit.ts tubed(m)` homes the shells and the cameras and the card says which gun has one), `weightKg`
  and `bulk` (the kit's mobility and concealment score reads them: `kitload.ts gunLoad`, the bullet below; this check's WHAT IT WEIGHS verdict steps every pick on your card and a teammate's — the sidearm alone ×1.05 pace / ×0.77 notice against the issue card, the MP7 ×1.02 / ×0.90, the Mk 12 ×0.98 / ×1.10, the Mk 46 ×0.94 / ×1.20). YOUR GUNS ARE YOUR CARD'S: `kitPlayer` builds `pl.rifle` /
  `pl.pistol` from the two picks (`Pistol` takes a row; the issue pair is the pair you were built with — nothing is made), the pistol's fire site reads an
  automatic sear as the rifle's does (only on a row with `auto`: the issue pistol's path is the one it was), a checkpoint restores the sidearm by its id.
  A pick is `{ can, bare }`: the row with the suppressor on and with it off — the new ones exist one way only, so a teammate's Suppressor row changes
  nothing on them (the roster chips and the card draw a can by the row's own `suppressed`: `kitRowCan`). A shield man's hand gun is his Secondary pick.
  **A teammate's quiet round is heard** (`GUNSLOTS.heard`, on with the switch): a report below the gunshot line from the other side's gun (`guardShot`,
  `shotRelation` = threat) is the odd noise your own is (`guards.ts hearingCheck`) — before, only YOUR quiet rounds reached anybody, so a suppressed
  pistol or an MP7 in a teammate's hands was heard by nobody at any range. This changes quiet play in a pair on the page (his suppressed pistol too): a call
  left for the maintainer. EVERY NEW GUN IS A STAND-IN TO LOOK AT AND LISTEN TO: drawn as the issue carbine / the pump gun / the issue pistols, speaking
  with their reports, ejecting their brass (`particleFx CASINGS`), the HUD's pips standing for two or five rounds on a big magazine (`ui/overlay.ts`).
  Check: `gunslots-guns` (in `gunslots-check.ts`), both stands, fails under `GUNSLOTS_BREAK=1`. MEASURED (headless, one floor, one seed): your group at
  25 m standing still — Mk 12 0.11 m, Mk 18 0.25, Mk 46 0.38 (0.13 kneeling), MP7 0.40; a teammate's — Mk 12 1.1 m, Mk 46 2.8, Mk 18 3.4, MP7 6.5; the
  farthest listener one round turns down a clear line — HK45 5 m, Glock 19 7 m, MP7 9 m, every other gun the whole line as gunfire; a teammate's MP7
  round 9 m with `heard`, nobody without; two teammates with each gun finish three men at five metres. NOT DONE: models, reports, reloads and hand poses
  of their own; tuning by play. Never seen on a GPU, never fired by a person. (Defenders drawing from the list, and a man using a gun for what
  it is for, are `gunroles.ts`: `docs/agents/enemies.md`, GUNROLES.)
  THE SAME GUN WITH ITS SUPPRESSOR OFF (`GUNSLOTS.bare`, on with the switch; a journal from before the key replays with it off): `weapons.ts mk18bare` and
  `g19bare` are the issue carbine's and the issue pistol's own rows with what a suppressor changes changed (id, report, flame, a little weight: `bareRow`
  keeps every other field, getters included), and `gunslots.ts PICKS` hands them out as the picks' `bare` — until them a bare carbine was the defenders'
  AKS-74U row and a bare pistol their sidearm (`bareWas`, what the key off still gives). The tile and a man's line name the gun the same either way.
  Checked: `gunslots-guns` THE SAME GUN, BARE and `gunslots-off`'s second journal verdict, both stands. Drawn with the suppressed row's rig (whether the
  can is drawn is the look's: with `GUNLOOK` on it is not — "A gun with its suppressor off is drawn without one", below); never seen or heard.
- **Lighter kit moves faster and hides better** (`src/game/kitload.ts`, table `KITLOAD`; the maintainer, 10-18: "we should also model a mobility / concealment score like
  door kickers 2 does -- there should be legitimate reasons to bring less kit"). Every thing on a man's kit card takes a little off TWO SCORES, each 1 for a man with
  nothing on him: a gun by ITS OWN ROW's `weightKg` and `bulk` (`weapons.ts`; `gunLoad`: `gunKg` 0.035 of mobility a kilogram, `gunBulk` 0.04 of concealment + 0.17 a
  step of bulk), `small` by the card's field, `big` by what the big slot carries. A card's guns are a list (`gunsOf`: the gun in
  his hands and the sidearm beside a long gun); one gun row weighs the list, a Primary and a Secondary row (`gunslots.ts`) weigh the long gun and the sidearm apart. The columns pull apart on purpose: a long gun
  is shape (the issue carbine 0.14 mobility, 0.38 concealment; the MP7 0.08 / 0.21; the Mk 12 0.18 / 0.55; the Mk 46 0.28 / 0.72; a pistol 0.03 / 0.04), a full pouch is weight (0.07‥0.10 mobility, 0.01‥0.02 concealment), a hammer 0.30 / 0.10. HIS REFERENCE IS HIS OWN CARD AS
  ISSUED, AS HIS TEAM WEARS THE ISSUE (`loadRef(i, n)` = `kit.ts kitIssuedShown(i, n)`: the kit deal shares it out over three or four; a staging passes the men who
  came, the card the team its screen shows): a card that scores what his issue scores is ×1 exactly, so an issued squad plays as it was tuned, by run digest. WHAT A SCORE
  DOES: pace × (1 + Δmobility × `pace` 0.4) — yours (walk, crouch-walk, drag, hold; a sprint keeps `sprint` 0.5 of it) and a teammate's, ONCE a leg (`guards.ts teamLegs`:
  followPath, stepAlongPath, a scripted man's strafe and settle; `teamPace` stays a cap that may be asked twice; never past `paceTop` 2.4 m/s), and a teammate's muzzle
  and pick-up by the same factor (`teamTurn`, `teamLean`); the notice he builds in an eye × (1 − Δconcealment × `seen` 0.6) (`sightGain`, `sightGainOn`, the hold's
  `pairSightRate`; the point-blank floor stands whole); a footfall × (1 − Δconcealment × `heard` 0.7) in the mixer, the step event and the room fight's defenders' ears
  (`pressure.ts teamBoots`) — the walk-or-run level is read off the pace he was ASKED for (`loadGait`), and your flat-out sprint is not scaled. The search's reckoning of
  how far you can have run (`floodFrom`), the sneak's price of a crossing and of a stalk (`sneak.ts`, `loadCross`: × what the walk ADDS to an eye, never what the eye
  already holds), the spot a man is dealt to run from a grenade (`frag.ts fragTick`, `squadthrow.ts fragClears`: planned on the legs his card leaves him) and a
  camera's lens (`devices.ts lensGain`) read the same factors; a teammate shoulders a leaf at a run by the pace he was ASKED for (`game.ts`, `loadGait`), so a light
  man at 2.3 m/s opens doors as he did. A RUN TAPE says whose layout the cards are (`runtape.ts kitNow` `own`, `kit.ts kitOwn`): who wears what moves a run now. WEIGHED ONCE, AT STAGING (`kit.ts kitPlayer`
  → `Player.kitLoad`, in a checkpoint with its reference while the switch is on; `kitStage` → the `kitload.manLoad` side table): a rule flipped later, or a replay on
  another stand, does not re-weigh a man. NOBODY IS WEIGHED with the pouches rule off (`?noslots`: free counts no table was cut for), on a lesson's page, on a mission that
  issues its own kit, in a showcase, or who has no card (defenders, civilians). THE CARD (`ui/kitCard.ts`, beside the pouches): two bars, no number — grey to the notch
  (his issue), green for what the card has gained on it, amber for what it has lost; the highlighted row outlined on the bar (what it takes), dashed on a row that carries
  none (what one more would take). SWITCH `KITLOAD.on`: ON in the page (`?nokitload`; Tab ▸ 'Kit weight'), OFF in the module and on the frozen stand
  (`'KITLOAD.on': 'TPS_KITLOAD=1'`), in the registry and `JOURNAL_KNOBS`. A harness that writes a teammate's card into `KIT.members` by hand on a team of three or four leaves the OTHER men in the
  table's layout against a reference that is the dealt issue (the page changes a counted thing on the cards as worn, so there the others stay ×1). CHECK: `probes.ts kitload` (`tools/qa/kitload-check.ts`; `KITLOAD_BREAK=1` fails 9), both stands; the real page:
  `tools/qa/kitload-page.cjs` (`PARTS=screen` passes on the software adapter; its `walk` part, a staged room, has never finished there inside 25 minutes, so the walk is the headless check's alone); squads counted: `tools/qa/kitload-tally.ts`. MEASURED (headless, one seed): you with the pistol alone walk 1.83 m/s against 1.55 as issued
  and 1.31 with four smoke and the hammer; sprint 5.13 / 4.70 / 4.34; a walking step 0.107 / 0.156 / 0.168; a guard at 6 m builds notice at 0.35 / 0.48 / 0.51 a second.
  A light teammate asked for 2.2 m/s gets 2.4, one with four pouches and the hammer 1.77.
  COUNTED (shipped stand, the scripted player, each squad with the rule on and held off by `TPS_KITLOAD=0`; room-clear-four, seeds 1‥6, on the build with the two gun
  rows and the kit deal, a gun still weighed by its class — the costs have moved a few hundredths since): issued 6 taken, 20 of 24 men up, 60.8 s — on and off the same run; every pouch full + hammers 6 / 19 / 69.9 s on against 6 / 17 / 62.8 s off;
  pistols only 4 / 12 / 44.8 s on against 4 / 15 / 72.8 s off. Before the gun rows and the deal joined, 12 seeds leaned the same way (a full load: 78 s on against 55 s
  off, 32 men up against 38; rescue-registry over 6: heavy 5 taken on, 6 off; pistols 2 on, 0 off). A full load costs tempo; going light is quicker and does not
  win a loud room (its reason is pace and notice, measured only as rates: no scripted quiet player). A handful of seeds says which way, not how much.
  KNOWN SHAPES: a door charge you carry weighs on you though you are issued none, set or not (`owncharge-off` holds the weight off in both its runs to ask of the
  row alone); two men issued differently are ×1 at different scores (the maintainer's call: one yardstick for everybody; with the deal and a sidearm each a
  four's issue is near even — mobility 0.65‥0.76, concealment 0.54‥0.56); a light player out-walks a silent squad's
  cap; what is thrown or set never lightens a man; a light, goggles and a suit weigh nothing, and a suppressor only where the gun's suppressed row is a heavier row of its own. Never seen on a GPU; nobody has played it.
- **Each gun its own look, sound and reload** (`src/game/gunlook.ts`, `GUNLOOK.on`; `src/game/gunreload.ts`; 10-18). The six guns the two slots offer beside the issue
  pair (Mk 12, MP7, Mk 46, M1014, HK45, Glock 18) were rows that are FELT and stand-ins to look at and listen to. SWITCH: on in the page (`?nogunlook` = the build
  before), off in the module and on the frozen stand (`FROZEN_HOLDS 'GUNLOOK.on'`, `TPS_GUNLOOK=1`, which shows nothing without `TPS_GUNSLOTS=1 TPS_BIGSLOT=1`); a
  recording from before the table replays with it off (`journal.ts applyKnobs`). WHAT A ROW NAMES: `weapons.ts WeaponDef.own = { model, voice, flame }` beside its
  stand-in fields (`rig`, `report.voice`, `muzzleFx`), read only through `gunlook.ts gunOwn / voiceOf / flameOf`. NO PLAY NUMBER MOVED. MODELS: `LONG_MODELS` /
  `PISTOL_MODELS`, part tables in the group's own axes (the trigger hand, the sling and the holster stay where the group has them); `Character.gunLook
  { hand, long, side, bareLong, bareSide }` is dealt each step (`game.ts` for a teammate, `player.ts armRifle` for you, `ui/kitFigure.ts` for its figure) and read by `rigProps.ts`
  (in the hands, slung, hung down the front, holstered; the roster chip and the card's icon are `ui/kitIcons.ts OWN_GUN`). The big slot's pump gun (`m870`) is a
  model too, with a 12 gauge's voice; its muzzle and hand are where the short rifle's were. THREE THINGS THE SIMULATION READS, only of a man who carries one of the
  rows: his MUZZLE is the model's far face (ahead of the wrist: Mk 12 0.70 m, Mk 46 0.62, M1014 0.56, MP7 0.40 — the stand-ins were 0.52, 0.52, 0.50 and, on you,
  0.52), his flash's light gain is the flame row's (`effects.ts muzzleFx` rows `mk12 mp7 mk46 m1014 hk45 g18`, first numbers), and the BEATS inside his reload
  (never its length). SOUND: seven reports and eight feeding sounds, `docs/agents/sounds.md`. CASES: each row had its own casing row; the M1014 now throws a red
  hull (`particleFx.ts casingOf`: nothing with the switch off, as before). RELOADS (`gunreload.ts FEED`): the Mk 46's belt — cover up, box off (an empty one
  falls), a full box on, the belt laid, the cover shut, the handle run on an empty chamber, on the row's own stages (0.54 / 1.2 / 3.18 / 4.4 / 4.9 / 5.4 s of its
  6 s; the kit's scaled beat on the shipped stand); the M1014 and the pump gun fed ONE SHELL AT A TIME, a trip of the hand and a `shellIn` each, the M1014 begun
  empty taking its first in the port with the bolt dropped on it; the magazine guns as ever with a magazine of their own size in the hand and on the floor, the
  MP7's hand at the foot of its pistol grip. A reload is as long as it was, to the frame, and the same rounds end up in the same places — but for the two tube
  guns under the shells key (the next bullet). CHECKS, both stands:
  `tools/qa/gunlook-check.ts` (`own`: every row a slot hands out names a model, a voice, a flame and a casing row, no two guns share one — by name and by what is
  in them — and what two guns may share is said in the file; `hands`: a teammate and you with every pick are told, drawn and heard as that gun, off = the
  stand-in; `off`: ten seconds of the staged room clear digest the same with the switch off and on, seed 17, cards as issued) and `tools/qa/gunreload-check.ts`;
  `probes.ts gunlook` runs both; `GUNLOOK_BREAK=1` fails them. The kit figure's own check (`tools/qa/kit-figure-roster-check.ts`) has a pose per model: the fist on the
  model's pistol grip (its `is: 'grip'` part) under that check's own rows, the hand on the fore-end by the model's hold, and the model the one drawn. PICTURES WITHOUT A GPU: `tools/qa/gunlook-plates.ts` (every model flat, side and top, one scale) and
  `tools/qa/gunlook-sheet.ts` (the kit figure with each gun, software-drawn; `--off` the before); `tools/qa/gunlook-page.cjs` boots the real page with all six on
  a team of four. NOT DONE / KNOWN: the HK45 is hard to tell from the issue pistol at the game's distance (a darker, fatter can and a tan grip are all it has);
  the Glock 18's long magazine is mostly hidden by the hands; a teammate's reload is always shown as a gun run dry, and when he takes his long gun up after his
  sidearm the whole feed is mimed with only its first sound; with the shells key OFF the books still take the whole tube out at the row's `out` and put it back at `in_`, so a
  shell-fed reload CANCELLED part way leaves the tube empty however many were heard going in (on, the next bullet); a teammate with the bare Mk 18 has its own bullet below; a gun dropped on the floor is the old item; a long reload's feeding is the support arm INSIDE `gunhand.ts longReload` (the carriage and the trigger hand are that move's; a
  branch per feed was not agreed with that rule's owner); at the side of a pack (`packside.ts`) a model stands where the stand-in does, by the STAND-IN's sizes
  (`rigProps.ts packSideDims`): butts level, the far end 0.18 m lower on the Mk 12, 0.10 on the Mk 46, 0.06 on the M1014, 0.16 higher on the MP7, and the Mk 46's
  belt box on the face that lies to the pack, never looked at; `rigProps.ts modelGrip` and `gunreload.ts GROUP` assume the two long groups
  share an origin (`gunlook-own` is red the day one is tuned alone). Every number is a first one. NEVER SEEN ON A GPU, NEVER HEARD, NEVER PLAYED.
- **A gun with its suppressor off is drawn without one** (`gunlook.ts GunLook.bareLong / bareSide`, `rigProps.ts`; 10-19; rides on `GUNLOOK.on`, no key
  of its own: picture only, nothing a run digest reads). The issue guns' bare rows (`weapons.ts mk18bare`, `g19bare`: the same gun, the suppressed row's
  rig) have no model of their own, so `gunLookOf` says of a man's long gun and of his sidearm whether it is BARE: a row with no `own.model`, not
  `suppressed`, on one of the two groups that draw a can (`sc20k`, `pistol`). The drawer then leaves the can off: on the long gun a BARE BARREL stands where
  the can was (`rigProps.ts BARE_BARREL`, a finger thick, the same length, so the muzzle the simulation fires from is where it was: the row's 0.52) — in his
  hands, slung and hung down his front; on the pistol nothing is drawn ahead of the slide, in his hand, on his thigh (`holsterBoxes` asks, so every caller
  is covered) and on a man down, and its rail light is drawn back under the slide, its body ending at the slide's face (it was laid out under the can; the
  light itself — its pose, its beam — is where it was). Whose gun can be bare is the card's: before the gear tree (`kittree.ts KITTREE`) one row takes the suppressor off both of a teammate's guns and your two
  always wear theirs; under it each gun has its own row (`suppressed` the primary's, `sideCan` the secondary's) and your card has them too — your figure is
  told by the same rows (`player.ts`), so your bare gun is drawn bare. The kit figure is told the same way. Off (`?nogunlook`, the frozen stand, `GUNLOOK_BREAK=1`): the bare rows drawn with the can, the build before. CHECK, both
  stands: `tools/qa/gunlook-check.ts bare` (`probes.ts gunlook-bare`, in the `gunlook` family): the card hands out the two bare rows and the figure is told;
  with the long gun in his hands exactly the two cans are gone and one barrel has come, as far along the gun as the can was (measured from the part drawn
  before it, so the pose does not matter); with the pistol in his hand exactly its can is gone; his sidearm out and the long gun hung: the barrel, no can on
  either; a man down with a bare pistol on his thigh shows no can; under the tree either gun's row alone off bares that gun and leaves the other its can, and your
  card with both off puts the bare rows and the bare drawing on you (no tree on the stand: a sidearm row of its own changes nothing, yours stay suppressed —
  the check asks the stand which it is, `kittree.ts treeOn`, so it runs alone or through the runner with the tree either way); off, bare and suppressed are
  drawn the same in each of those. KNOWN: a bare barrel as long as the can was is
  longer than a real one (the muzzle is the row's); the bare pistol's flash is where the row's muzzle is, 5 cm ahead of the slide's face; no picture was drawn
  of either. NEVER SEEN ON A GPU.
- **A tube gun is fed a shell at a time, in time and in the books** (`GUNLOOK.shells`, a key that rides on `GUNLOOK.on`; `gunreload.ts shellPlan` /
  `feedBegin`, `weapons.ts Firearm.feedShell`; 10-19; the numbers are the guns goal's). The M1014 and the big slot's pump gun carry `reload.shell` on their
  rows: `{ lead, each, tail, bolt }` = 0.4 / 0.36 / 0.7 / 0.4 s and 0.4 / 0.35 / 0.7 / 0.4 s. A reload of n shells is `lead + n × each + tail` long (one shell
  1.46 s, seven from empty 3.62 s on the M1014; 1.45 s and six 3.2 s on the pump gun; the rows' old stages stand for the key off), n = the room in the tube, no
  more than he carries. EACH SHELL IS BOOKED AS IT IS HEARD, out of the fewest loose ones he carries: a reload cancelled, sprinted out of or broken off keeps what
  went in. The M1014 begun with nothing in it takes its first in the port — chambered, the bolt dropped on it, no bolt run in the tail; any other gun with an
  empty chamber has its bolt or pump run inside the tail (`bolt`). THE TRIGGER BREAKS THE FEEDING OFF (`player.ts shellBreak`): a round chambered — the reload is
  let go and that press fires; rounds in the tube and nothing chambered (a pump gun cut short) — the press runs the pump, 0.4 s, nothing fired, and the next
  press fires; with nothing in it yet the press is the dry click and the feeding goes on. R with a full tube and an empty chamber is the same short run. A
  TEAMMATE AND A DEFENDER: every clock that waits a reload out (`guards.ts startReloadBeat`, the room fight's and the covering fire's `reloadUntil`,
  `morale.ts runDry`) begins it with `feedBegin`, so the beat is as long as the shells that go in and each is in his gun as his beat passes it (`gunreload.ts
  feedTick` books them; his spares are bottomless as ever, and the first shell is the round he may fire, so a beat dropped part way never leaves him a gun
  that cannot shoot — his fire sites only ask whether there is a round in it); the beat still ends in `rearm()`. He only ever begins one dry, so on the
  shipped stand a teammate's M1014 beat is 3.62 s where it was 3.6 and the pump gun's 3.2 s as it was. The animator takes such a beat AS IT STANDS
  (`character.ts ReloadBeat.exact`: none of the magazine change's floors — one shell is home 0.36 s after the hand gets there). SWITCH: ON with the look in the
  page; `?nogunshells` = the row's one length and the tube booked at its end, the build before it; the frozen stand holds `GUNLOOK` off and the key rides on it
  (no word raises the look without the key; a check that wants the old reload sets `GUNLOOK.shells = false`, as `gunreload-check.ts raise()` does for its three
  older families); a recording from before the key replays with it off (`journal.ts applyKnobs`). CHECK, both stands: `tools/qa/gunreload-check.ts`
  `gunreload-shells` (`probes.ts gunshells`, in the `gunlook` and `kitanim` families; `GUNSHELLS_BREAK=1` fails it): every count from one shell to a whole tube
  on both guns takes its time to within two frames and each shell goes into the gun on the frame it is heard; the end is the old reload's end; a reload let go
  after three keeps three and he carries three fewer; the pump on the trigger, then the shot; unlimited ammunition fires as it did; loose shells one by one; a
  teammate's beat for a dry gun and for one four shells up; a beat dropped part way; the key off; the page's flag and an old recording. The room fight's and
  the covering fire's clocks are READ IN THE SOURCE by that check, not run. KNOWN: the door's shotgun (`doortools.ts`) and the long gun taken up after the
  sidearm (`gunslots.ts`) still fill at once and wait the row's length — both only ever from dry, a whole tube, so the time is the same to 0.02 s; a man's plan
  lives on his gun, and a gun put away mid-beat keeps it until his next beat begins (every beat begins clean); the HUD's spare count for a tube gun is the
  row's "magazines", now shrinking a shell at a time. MEASURED: the check's own lines; the tour, three runs a stand. NEVER SEEN ON A GPU, NEVER HEARD, NEVER
  PLAYED: whether 0.36 s a shell reads right, and whether the trigger breaking off is wanted, are the maintainer's.
- **A restart gives a clean level** (`CLEANRESTART`, `src/game/cleanrestart.ts`, 10-19; the maintainer, from a play test: "after resetting a level …
  the lights kind of flicker on in engine. Like, we should reset the level to a clean state"). ONE switch: ON in the page (`?cleanrestart=0` = the
  restart as it was; OFF in the kit picture's own window, `?kitview`, which restages on every kit message under its own dissolve), OFF in the module and
  on the frozen stand (`TPS_CLEANRESTART=1`); a `FROZEN_HOLDS` row; in the knob registry and the journal (a recording from before the table replays its
  restarts as they were). WHAT THE FLICKER WAS: `restartEncounter` put a blacked-out level's mains back through `endBlackout`, the breaker's own road —
  `restoredAt = now`, so every fitting on the supply played its restrike for 1.2 s, each contactor group a beat after the last, the beacons turned for
  another second, 'mains restored' was said and `powerUp` sounded. TWO LAYERS. (1) `Game.restartEncounter` (every caller: the keys and cards, a mission's
  staging, a show's restore, a checkpoint's load under its file, a recording's first frame), with the switch up: `lighting.ts freshLights` (every target
  whole, no OCP timer, the blackout's fields as a new Game has them — `restoredAt -100`, `since -1` — nothing said or sounded), the lights PAINTED as
  the restart ends (`updateTargets(g, 0)`: the first tick's reticle rows and the men's eyes read the fresh level, not the last frame of the old one), the
  old encounter's HUD lines gone and the restart's own two ('guards reset', 'encounter restarted') not written, the clocks a new Game has at rest
  (`alarm.raisedAt`, `alarm.pos`, the torch on him, the last sting, `gunwall.ts gunWallFresh`, `guards.ts groundFresh`), every vent where its own duty
  cycle has it with the mains in (`wind.ts Wind.fresh`). (2) `Game.restart(said?)` — THE PLAYER'S RESTART, what the pause card's and the down card's
  buttons, the panel's button, Shift+Enter and Enter-when-down now call (`ui/menu.ts`, `ui/bindings.ts`, `player.ts`): `restartEncounter`, then the
  camera CUT to the fresh man (the seat's cut, `cmd.ts takeCut`, put on the host's camera at the top of the next `update` so that tick's record reads
  the view that is on him; a show's, a spectator's or a pinned camera is left alone) and the host told the level restarted (`HostApi.restartPicture` →
  `engine.restartPicture`: the screen histories and reservoirs, the haze volume's history and the radiance cache start from nothing, as `restartHistories`
  already did when the goggles came off infrared light; `CLEANRESTART.picture = false` = the game side only). `said` = a line about the restart itself
  (why a checkpoint would not load), which outlives it. A LOAD IS NOT A RESTART: `loadState`, the journal's first frame and a tape's restart row call
  `restartEncounter` and keep their own camera and picture; the file's mains, broken fittings and lines are the file's. Off: `restart` is
  `restartEncounter` with the line said first, every line of both as it was. `window.__cleanrestart` on the page (knobs, stats: restarts, relit,
  lines, cuts, pictures). Check: `probes.ts cleanrestart` (family `player`; `CLEANRESTART_BREAK=1` fails six of its nine lines), both stands — the
  office on die 1 WRECKED (41 of 73 fixtures shot out, the eight vehicle lamps among them, three wall switches thrown, the OCP tripped, six doors blown
  off and four opened, three men dead, 512 decals, the mains pulled by hand and then the breaker shot) beside an untouched TWIN stepped the same ticks,
  both restarted, against the twin and a Game just stood up: every target's painted factor, switch, glass and timer (0 off either), nothing said or
  sounded; all 783 statics' place and paint; decals, thrown things, smoke, lights, moving boxes, doors, the camera (0.000 m off a fresh boot's, 27.7 m
  before), the host told once; the whole state by `rollback.ts stateAlike` one tick and ten seconds on (about a thousand differences, every one on the
  check's own list of counters, logs, caches and first-use table entries, each with its reason) and the run by digest every second for ten (less the
  event serial, which counts on through a restart); each way in; a checkpoint saved in the dark 21 m from the start (loads dark, the camera on its man,
  no cut, the host not told); the switch off (27 of 73 factors off a fresh boot's at the first tick, five beacons turning, the line and the sound).
  `tools/qa/cleanrestart-page.cjs` does it on the real page on the software adapter (Shift+Enter; five frames of factors against the boot's five, the
  dying tubes apart — their dropouts follow the absolute clock; three frames drawn). KNOWN: a flickering tube, the weather and the wind's gusts run on
  the game clock, which a restart does not wind back, so those are where the clock has them, not where a boot at 0 s has them; which idle chatter has
  been heard is kept on purpose (`dialogue.ts`); a mission's restage through `restartEncounter` (the console's `restage()`, the room clear's seed
  slider) is clean in the game but keeps its own cut and does not restart the picture. NEVER SEEN ON A GPU: the first frames after a restart — whether
  starting the picture's histories from nothing reads cleaner than the old blend is the maintainer's to judge (`__cleanrestart.knobs.picture = false`
  in the console is the other way, live).
- **A man who is low is aimed at where he is (`player.ts manAim`, `AIM.player.low`).** The maintainer, off the build: "weird issue where if an enemy
  is bent over from a flash, I can't shoot them even if i'm directly clicking on them -- gun is forced to be level". CAUSE: the reticle takes a man by
  his POSED chest bone, but the round and the gun's pitch went to a standing man's chest — 1.25 m over his feet (1.2 for the pitch) — whatever he was
  doing. A man with his head down (`guards.ts` writes `crouchTarget` 1: under fire, a drill's knee, `morale.ts`'s duck from a blast; a flash on top
  of it folds him further) has his crown at 0.8 to 1.1 m: the gun sat level on him and every round passed over (`character.ts rayHit` is a column
  about the hips up to the posed crown, and one about the trunk). A flash ALONE does not do it (a blinded man on his feet has his crown at 1.6 m and
  was hit as ever): it takes the duck or the head-down as well — a door charge does both to the men behind the door (`doortools.ts` blow: its own
  dazzle and stagger, then `moraleBlast`). RULE, knob on: a man whose crown does not clear a standing chest by 0.25 m (a crown under 1.5 m) is LOW,
  and the point comes down to 0.15 m under his crown — as high on him as a round still finds him, so a counter a higher line cleared is still
  cleared — over the chest bone the ring is drawn on, or over the hips column's axis where a ray from Sam's gun to that point would miss the body
  (the fallback is there for a pose that carries the chest out of both columns; no staging in the check reaches it). A man on his feet — upright,
  hunched by a flash, folded — is aimed at by the same numbers as before (the check holds them equal, and holds that the stamps did bend him). All
  of his sites: the pistol's and the rifle's click, the gun's pitch, and the same two with a man in his arm (those two are read, not run). SWITCH:
  `AIM.player.low`, written 1 by the page's boot (`profile.ts pageSwitches`; `?noaimlow` = 0) and so 1 on the page's stand
  (`TPS_PROFILE=shipped`), 0 on the frozen stand (`standup.ts`, `FROZEN_HOLDS` row; no env word: the check sets it); the Tab panel's row
  "aim ▸ you: at a low man" moves it for the visit — unlike the other aim rows it is NOT kept per machine (a kept 0 would outlive the flag that
  wrote it); a session file from before the key replays with it off (`journal.ts applyKnobs`). CHECK: `tools/qa/aimlow-check.ts` (`probes.ts
  aimlow`, families aim / weapons / player; `AIMLOW_BREAK=1` must fail) — 31 lines on each stand: a man with his head down at 3, 6 and 10 m with
  each gun, with his side and his back to Sam, and with Sam crouched (knob 1: one click; knob 0: three clicks over his crown, he lives), the same
  doubled over a flash, the three standing poses equal either way, a room fight's own can and blast (a blinded, ducked man of the room), the
  stand's value and the journal. `tools/qa/aimlow-page.cjs` is the same click on the real page on the software adapter, with and without
  `?noaimlow`. MEASURED, one staging each, no seeds: nothing here is a tally. ALSO CHECKED by hand, not in the check: a SEATED man (`close.ts
  closeSeat`, crown 1.38 m) seen side-on took three clicks and lived at knob 0, one click at knob 1 (run on the first cut of the rule, which aimed
  at the chest bone's own height; not run again on this one). NOT CHANGED: a WOUNDED man down (his own older rule sends the round to his chest
  bone), a civilian or a hostage on the floor (never taken by the reticle under `FRIENDS.noSnap`), the launchers (posed bones already: the ring
  gun his head, the 40 mm his chest), a show's scripted target (`puppet.target`: feet + 1.25 m, as authored). KNOWN: the reticle's own line test
  is from 1.3 m over Sam's feet to the man's chest, not from the muzzle, so a low man behind cover can be ringed from a crouch and the round still
  go into the cover — older than this change. And not this change's: an AI man firing at a foe who is crouched aims 0.8 m over his feet
  (`guards.ts`, `foeCrouched`) — NOT a fault, corrected 10-22: the squad's rig ran it and 0.8 m enters such a man in every sample; only a
  blinded, flinching defender at exactly half crouch is aimed at as if standing. On the page's stand `aim-unit`, `aim-player` and `aimlevel` are red at the build head this was cut from, the same lines with and
  without this change. NEVER SEEN ON A GPU: how the gun coming down onto a low man looks, and whether the laser and the ring agree, is unseen.
- **A gun's key again opens its setup; the kit column is one box** (`src/game/slotsetup.ts`, table `SLOTSETUP {on, secs 1.5, stay false, settle 0.35}`;
  `src/ui/handbox.ts`; `src/host/keymap.ts KEYMAP.setFree`; 10-22. The maintainer: "repeating the current selection open up a menu for configuring
  the current one", "can allow us to pick between auto/semi (get rid of z)", "also lets us pick attachments better", "for L can we move that to the
  pistol/gun's equipment menu?", and of the box "scct had a really compact current equipment screen, probably too compact for us but we can aspire
  to it"). THE RULE: with a gun IN HIS HANDS (`Player.gunInHand`: not holstered, not slung; and not with a man in his arm, where the hold has the
  keys) its own digit opens that gun's setup — 1 the pistol's, 2 the long gun's; not in the gun's first `settle` seconds in his hands nor while the rifle is still coming off
  its sling (a double-tapped digit draws the gun and no more), and a can's digit again is as it was. THE ROWS are on the same digits on every gun: **1** the selector (a gun with two
  positions), **2** the launcher's load (the next one round the tube that he has any of: one he is out of is stepped over, and with nothing else to
  put up the row has no digit), **3** the light (a kit that carries one). A row's digit steps it AND SHUTS the setup, so the two presses are always
  the same two: 2 1, 2 2 (the old '2 again', one press on), 2 3, 1 3. It also shuts on the back key (`backkey.ts`; `Game.backable()` counts it, and
  `Game.escape()` shuts it where the back key's rule is off), on the trigger, the right button or R (none of them taken: the round goes), on a digit
  that is no row (the gun's own shuts it and no more; another is the slot it always was: 4 is the stun can), when the gun leaves his hands, when the
  order menu or the Space list comes up, and by itself `secs` after it opened (1.5: the gap between two presses, not reading time — the box shows
  the presses while it is shut). Nothing is held and nothing is frozen: his feet, aim and trigger are his own while it is up. State: `Player.setup` and
  `Player.setupHand` (the gun the hook last found in his hands and since when; both null on a fresh player, in no file). NOTHING IS UP AFTER A LOAD: a file's load builds the player again; a save kept in memory
  (`savestate.ts Checkpoints.loadMem`, the rollback snapshot used with a team on the floor) puts him back as he stood, the setup too, so
  `loadMem` drops it after the snapshot is put back — before that line a load of such a save came back with the setup up and a 1 turned the
  selector. The page does not let
  the aim it carries through a turn of the view go for the setup's own digits (`host/loop.ts`, `slotSetupTakes`). THE TWO KEYS IT REPLACES: on the page's board the selector's row and the light's have NO KEY
  (`KEYMAP.setFree`, as the wall hold's row has none under `qFree`; only while the game's switch is on — `KEYMAP.setWhen`, the page's — so a
  recording that plays with the setup off has Z and L back); the GAME still asks for 'KeyZ' and 'KeyL' and means what it meant, so a recording from
  before plays and every headless tool that writes those codes into the input works; a player who wants either back puts its row on a key in
  Options ▸ Controls (the box then reads `<key> LIGHT`). THE BOX (`handbox.ts`, drawn by `overlay.ts updateEquip` while the switch is on; the old
  column is drawn with it off): a strip of the five slots, each in its own place whatever is selected (a gun's name and rounds ready, the cans
  themselves), the selected one a tab over ONE box of two lines. Line one: the magazine as pips, the pistol's OCP, the rounds in the gun and in
  reserve as two numbers (the spare magazines are that number now, not boxes). Line two: the gun's own key and an arrow, then a place each for the
  selector, the loads and the light, the one that is up a filled plate and the rest dim words (a load he is out of dimmer; three loads: the count
  only on the one that is up), an EMPTY key cap before each row that can be set — the presses are drawn only while that key again WOULD open it (not holstered, not
  slung, no man in his arm: then the line shows what is set and no keys). That key again: the caps fill with their digits, the box's edge
  lights, the slots whose digits are rows for now go dim in the strip, and a line along the box's foot runs down the seconds (a width set each frame,
  `handBoxTick`: the column is not built again for it). Nothing moves when it
  opens, no line of words explains it, and the warm colour is the open setup's alone. Where empty hands are a slot of their own (`handslot.ts HANDSLOT`), they have the first place in
  the strip under that slot's key: with everything put away it is the tab and the box under it is empty and dashed. (With that rule off a gun
  put away keeps its tab and its box is dashed and dim; no 'holstered · E' words either way.) Every slot is still a `.slot` with its `.key` in the kit's order. WORDS THAT FOLLOW: the Controls lists (`ui/menu.ts controlRows`,
  `ui/options.ts setupSmall`); the lines that named '2 again' (`slotsetup.ts loadKeys`: `player.ts`'s three messages, two kit card notes in
  `kit.ts`, the launcher's debugger summary) read 'press 2, then 2'; the kit card's light ('on L': `lightKeys`, in `kit.ts`'s row note and `ui/kitCard.ts`'s
  line) reads 'its gun's key again, then 3'; and Training 4's four lines that named Z, L or '2 again' — a lesson step may carry `setupLine`, the
  line shown while the switch is on (`scenarios.ts LessonStep`, `lesson.ts lineOf`; `line` is the build before, so the frozen stand's lessons
  read as they did). Every such line puts 'press', 'then' or 'key' before a digit, which is what `host/keymap.ts`'s text rule needs to name the
  key a rebound slot is on. The kit screen's preview hands its rifle the load it shows (`host/kitView.ts tube`), where it pressed 2 until it came. ONE SWITCH for all of it: ON in the page (`?slotsetup=0` = 2 again steps the load, Z and L are keys, the
  column as it was), OFF in the module and on the frozen stand (`TPS_SLOTSETUP=1`), `FROZEN_HOLDS['SLOTSETUP.on']`; a registered knob table, in
  `JOURNAL_KNOBS` (a recording from before the table replays with it off); Tab ▸ 'Gun setup (its key again)': the switch, 'seconds it stays up
  unused', 'stays up after a pick'. CHECKS: `tools/qa/slotsetup-check.ts` (`probes.ts slotsetup`, family `kit`; `SLOTSETUP_BREAK=1` must fail) —
  opens, the three rows, `stay`, every way it shuts, the empty load and the Space list, Esc, the words and the keys the carried aim keeps, what
  does not open it, the pistol and the double tap, the box off the real overlay code on the probes' stand-in page, a load of each kind, off = the build before, the
  journal and the stands' row, the board: 13 lines pass on both stands, the break is red on 10 on each.
  `tools/qa/slotsetup-page.cjs` — the real page on the software adapter by real key presses, as it opens and with `?slotsetup=0`: all five lines pass.
  The lesson bot for Training 4 (`tools/qa/lessons/train-kit.ts`) plays the new presses when the rule is on, read off the page's own table when
  it drives a page. OLDER PROBES that step the launcher with 2 again, or read the kit column against recorded words, run with the switch held
  off on every stand (`probes.ts GUN_KEYS_AS_THEY_WERE`: `rifle-reload`, `kit-slots`, `he40-*`, `sticky-*`, `weapons-identity`; `pouch-table`
  too, for a card's note), `sticky-look.cjs` opens with `&slotsetup=0`, and the two key board checks ask their own rules with Z and L as they
  were (`keybinds-check.ts`, `qkey-check.ts`; `keybinds-page.cjs` opens with `&slotsetup=0`). One older line was MOVED to the rule, not held:
  `wallsnap-kit`'s "2 on the stack, the rifle up" asks, with the setup on, that the first 2 opens the setup and changes nothing and the second is
  the launcher's load, stacked throughout (a grenade is staged for the tube, as the page's kit brings none there); off, the single press as before. KNOWN, and the maintainer's to call: (1) with the
  setup up a 1, 2 or 3 is a ROW for `secs`, so a 2 pressed out of habit with the rifle already up and then, inside a second and a half, a 3 for
  smoke turns the light on instead (the old build flipped the launcher's load on that same habit press); the trigger, R, Tab, 4 and 5 all shut
  it. (2) The light has no key where the gun is not in his hands: holstered or slung (a wall hold that put it away included), and with a man in
  his arm (`updateHold` reads 'KeyL', which the board no longer gives; the old L worked in each). (3) A pick shuts the setup (`stay` off): two
  things set on one gun are four presses. RUN on the join with the build that has empty hands as a slot: the check and its break on both stands; `keybinds`, `qkey`,
  `tabback`, `handslot` on both; `fn2000`, `he40`, `sticky`, `kitanim`, `shotgun`, `fog`, `frag`, `bigslot` on the page's stand, `fn2000` and
  `weapons-identity` on the frozen one; `lesson-run train-kit` on both; the page check; a pass through whole situations on the real page by key
  presses (the habit press, the lapse, a double tap off a can, the trigger with it up, three loads, empty hands and back). NOT RUN: the tour, a
  soak, the solo night, `all-quick`, the other page checks (`keybinds-page.cjs`, `textsize-page.cjs`, `bigslot-page.cjs`, `panel-keys.cjs`,
  `lesson-page.cjs`).
  THE SETUP IS A MODE THAT POPS UP ABOVE THE COLUMN (`SLOTSETUP.pop`, 10-22, the same day, after the maintainer played the first build on the solo
  tutorial mission: "the timer is bad. we should just have it switch a mode. and we should teach earlier that tab exits out of menus", "to make it
  feel like the radial menu it should be something that pops up above the equipment menu rather than always taking up space"). What the paragraph
  above says of the clock and of line two is now the build with `pop` OFF. With it on: NO CLOCK runs on the open setup (`secs` is not read) — it
  stands until a pick, the back key, the trigger, the right button, R, a digit that is no row, the gun leaving his hands, or another list taking
  the digits. THE BOX IS ONE LINE: the magazine's pips, what is set as plain words (the selector's position on a gun with two, the load that is up
  and how many, LIGHT while it is on — `<key> LIGHT` where the player has put the light's row on a key), the two numbers; a reload is written
  across the pips, which go dim, so what is set stays on the line through it; a can's box is its cans and the count. No key cap is on the box.
  THE ROWS ARE A PANEL placed off the column's own top edge (`.hp`, nothing under it moves), drawn only while the setup is up: a row for each thing
  the gun can have set, its digit on a warm cap, its positions beside it with the one that is up a filled plate (a load he is out of dim), and
  the back key's cap in its corner. The tab's and the box's edges light and the slots whose digits are rows go dim, as before. SWITCH: ON in the
  page (`?setuppop=0` = the first build: the rows on the box's second line, the clock and its line), OFF in the module and on the frozen stand,
  raised with the rule by the one word (`TPS_SLOTSETUP=1` sets both, `host/standup.ts`; `FROZEN_HOLDS['SLOTSETUP.pop']`); in the registered
  table, so a recording carries it, and one from the first build — no `pop` in its row — replays with the clock it had (`journal.ts applyKnobs`);
  the debugger's 'setup ▸ a mode that pops up above the kit'. A PICK STILL SHUTS IT (`stay` off): that is not his word either way, and is the
  same two presses every time. CHECKS: `slotsetup-check.ts` now stands the rule up as a mode — the shut line asks that six seconds on it is still
  up and 1 is still the selector's row, and keeps the clock under `pop` off; the box line asks for no cap and the words while shut and through a
  reload, the panel with its caps and the back key's while up, and the first build's box under `pop` off (no press drawn with the gun put away
  or a man in his arm); the journal line replays a first-build row: 13 lines pass on both stands, `SLOTSETUP_BREAK=1` is red on 10 on each.
  `slotsetup-page.cjs` has six lines (the panel is above the column's top edge, four seconds on it is still up; a third page with `?setuppop=0`).
  RUN besides, with the change on the build before the join: `shipped`, `handslot`, `tabback`, `handring`, `fn2000`, `kitanim`, `wallsnap-kit`,
  `keybinds`, `qkey`, `inhand` on the page's stand, `fn2000`, `handslot`, `weapons-identity`, `kit-slots` on the frozen one; on the join: the
  check and its break on both stands, the page check, `shipped`, `knobs-check`, the rollback static pass, `lesson-run train-kit` on both stands
  and `tut-solo` on the page's. NOT RUN: the tour, a soak, `all-quick`, the other page checks. KNOWN: (1) the habit press has no window to run out now — a 2 pressed with the rifle already up leaves the panel
  standing, and a 1 or a 3 pressed any time after is its row, not the pistol or the smoke can; the panel is what says so. (2) In a tutorial
  mission the frame's gate (`rails.ts`) drops a row's digit whose slot is still locked, and a click or R it has locked does not shut the setup:
  the solo mission's thread is letting `slotSetupTakes` keys through the gate. (3) The words on the box clip without a mark if a wide fallback
  font is all the machine has; LIGHT is the last of them.
  A DOUBLE TAP OFF ANOTHER SLOT IS THE DRAW AND THE SETUP (`SLOTSETUP.draw`, 10-22, the maintainer playing step 872: "when on pistol, double
  tapping 2 quickly switches but doesn't open the menu"). The first build dropped a gun's digit pressed again inside the gun's first `settle`
  seconds in his hands or while his hands were held (`equipT`), on purpose — "a double-tapped digit draws the gun and no more" — and that was
  the press he lost; the tutorial's frame was not in it (`rails.ts` lets the rifle's own digit through). With `draw` on the second press opens
  the setup at once, mid-draw, and a row's digit after it is the row: 2 2 1 from the pistol is the rifle on the selector's other position.
  Nothing is set by the open itself. ONLY HIS OWN DRAW: the hook notes a gun's digit pressed while that gun is not in his hands
  (`Player.setupKey`), and a gun that came to his hands on that press carries the time that draw is over (`setupHand.own`: the swap that press
  started, or `settle`, and no longer); every other time
  `equipT` holds his hands (the wand stowed, the big tool's tail, a throw's swing, a gun the game handed him as the last can left) the press
  is dropped as before. A ROUND THAT GOES SHUTS THE SETUP, with `draw` on (`lastFireT` against the opening's stamp): the kit swap keeps a
  click for its end (`KITANIM.clickKeep`) and that round would leave the panel standing; a trigger held when it opens shuts it at the next
  round, and the gun's own digit on the frame it shuts is nothing (not the load's old key in player.ts). With `draw` off a round shuts
  nothing, as before: only the click's edge does. ON in the page (`?setupdraw=0` = the draw and no more), OFF in the
  module and on the frozen stand, raised there by a word of its own, `TPS_SETUPDRAW=1` (`FROZEN_HOLDS['SLOTSETUP.draw']`, pinned in
  `host/standup.ts`; it acts only with the rule up, `TPS_SLOTSETUP=1`); in the table a recording carries, one from before the key replaying
  with it off; the debugger's 'setup ▸ a double tap off another slot opens it'. CHECKS: `slotsetup-check.ts`, fifteen lines, all pass on both
  stands and with both words raised on the frozen one — its double tap line (2 2 from the sling mid-draw: up, the load not moved, then 1 is the
  selector; `draw` off: the draw and no more), its pistol line (1 1 off a can), a line for his own case (2 2 off the pistol; 2, a kept click, 2:
  the round goes and the setup is shut — asked in full only where the swap keeps a click, the shipped stand; the trigger held on auto, then
  2: shut at the next round on either stand, 2 again on that frame leaves the load alone, and with `draw` off it stays up; the last smoke
  thrown, or a later lock on his hands inside his own draw, and ONE press of 1: no setup) and a line for the page's words ('' / `?setupdraw=0` / `?setuppop=0` / `?slotsetup=0`, each its own row and no other);
  `SLOTSETUP_BREAK=1` fails 12 of the 15 on each stand. `slotsetup-page.cjs` has a seventh line, his own case by real key presses (the pistol up, 2 2 two
  frames apart, then 1). KNOWN: a key mashed twice by a hand that only wanted the gun now leaves the panel standing, and the next 1, 2 or 3 is
  its row. NOBODY HAS PLAYED IT; the swap's picture under an open panel has never been seen on a GPU.
  SEEN ON A GPU: the FIRST build's box, in the maintainer's own shots from the solo tutorial mission (what the notes above answer). NEVER SEEN ON
  A GPU: the one-line box and the panel — looked at as stills of the real page's own markup and styles, and used by real key presses on the
  software adapter with the picture not drawn; nobody has played them.
- **The box counts the gun's rounds over its magazine's size, with a box for each spare magazine** (`SLOTSETUP.mags`, slotsetup.ts; `ui/handbox.ts`,
  10-24; the maintainer, of a rifle that read 31 / 60 at a mission's start: "we should say 31/30 and then two spare magazines on the side"). The box
  of what is in his hands read the rounds in the gun over the rounds in ALL the spares, so a full rifle said 31 / 60 and the 60 read as a magazine's
  size. NOW the second number is what one magazine holds (31/30: thirty and the one in the chamber) and each spare magazine is a little upright box
  beside it, fullest first, filled as far as that magazine is (the old column's own `.mags` drawing); one put back part used is a part-full box, and
  one fired dry is dropped, so its box goes. A GUN FED A SHELL AT A TIME (the shotguns) keeps its two numbers: what it carries is loose shells and
  the second number is the only count of them. A row that never runs dry has no boxes. Mid reload the magazine in his hand is a box too, for the
  second it is out. The debugger's Gun setup section has its box. Nothing of the guns changed: the rifle's row is still thirty rounds and two spares (`weapons.ts`), the same on every
  level. The strip's small number (the rounds ready) and the old column (`?slotsetup=0`) are as they were. SWITCH: `SLOTSETUP.mags`, the box's
  alone (nothing in the game reads it), OFF in the module and on the frozen stand (`standGame` pins it off; `FROZEN_HOLDS` row with no word), ON in
  the page (`?magboxes=0` = 31 / 60, as it was); a recording from before the key replays with it off. CHECK: `probes.ts magboxes`
  (`tools/qa/magboxes-check.ts`, family `kit`; `MAGBOXES_BREAK=1` must fail) on BOTH stands, the box drawn by the real overlay code on the probes'
  stand-in elements: the rifle at the start, six rounds fired, a reload (the magazine that came out is a box as full as it was), the pistol, the key
  off, the journal, the stands. NOBODY HAS seen it on a GPU or in play; the picture handed to the maintainer is the box's own elements and styles
  off the software-adapter page.
- **Empty hands are a slot on backtick; E is spare; the debugger is on backslash** (`src/game/handslot.ts HANDSLOT {on}`, `HANDSLOT_KEY`, 10-22; the
  maintainer: "having backtick be the empty state", "when holding a guy, we can just have picking empty hands or pistol as the way to change
  equipment", "we can move the debug menu to \ or something like that", "if we have an empty equipment state, we can keep that lmb is knife, rmb is
  nonlethal"). ON in the page (`?handslot=0` = E puts away and draws, as it was; the debugger's Player tick "empty hands are a slot"), OFF in the
  module and on the frozen stand (`FROZEN_HOLDS`, `TPS_HANDSLOT=1`, pinned in `host/standup.ts`: `TPS_HANDSLOT=0` puts it off on the shipped
  stand); in the knob registry and carried by a recording (one from before it replays with it off).
  THE RULE (player.ts `updatePlayer`, `updateHold`): the slot's own code, `HANDSLOT_KEY` = `'Digit0'`, a code no key gave the game before, puts
  away whatever is up and does nothing when the hands are empty; it never draws. A digit draws, as it always did. On a wall it chooses empty hands
  for the step off (`WallHold.drawn = false`, never back to true). With a man held it is the arm (only from the pistol), and `Digit1` is the pistol
  at his head (only from the arm). It is not read under an open Space list. The two takedown clicks are untouched.
  E'S OWN CODE (`'KeyE'`: put away OR draw, and the swap of a hold) means what it meant, rule on or off: about ninety lines of checks press it.
  THE BOARD (`src/host/keymap.ts KEYMAP.slotWhen`, the page hands it `() => HANDSLOT.on`; `SLOT`, `ALIAS`, `SLOT_ACT`, `keyRows()`): while the rule
  is on, the backtick key gives `'Digit0'`, the backslash key gives the debugger's `'Backquote'` (main.ts and ui/panel.ts go on asking for that
  code), and nothing gives `'KeyE'`: the E key and the 0 key file nothing. It follows the rule live, so a recording from before the rule plays in
  the page on the old board. The slot's row is no row at all while the rule is off (`keyRows()` leaves it out: the 0 key is nobody's, a kept
  table's line for it waits). A machine that kept backtick on another row keeps it there, and the slot then sits on the 0 key until it is given
  one; E's row kept on a key of the player's choosing stays a row and is listed.
  THE WORDS: lines all over the game and three lessons say "E puts it away" / "E holsters it". They are not rewritten: while the slot is on and
  E's row has no key, the letter E in a line is read as the slot's key (`ALIAS`), so they follow, and follow a rebind of the slot's row. The lines
  that named E for the way TO the pistol (the hold's "E puts the gun to his head", its row hints) say 1 with the rule on. The kit box's holstered
  slot says "holstered" / "slung" with no key (`body.handslot`, overlay.ts). Options, Controls: the row "Empty hands" heads the Kit group (cap
  `'0'` in the source, shown as the key it is on) and E's row is gone unless it holds a key; the start card's list has the same row; the
  debugger's row shows backslash. README's table follows.
  CHECK: `bun run tools/qa/probes.ts handslot` (family `player`), 7 lines, both stands; `HANDSLOT_BREAK=1` fails 6 (the seventh is E's old code,
  which must pass either way). Read: the hands after the key once and five times from the pistol and the rifle, the digits, the wall's waiting
  item, the hold's variant, the board's answers and words, the kept table (backtick held by another row, E kept on a key), a recording with and
  without the key. On the page (`tools/qa/keybinds-page.cjs`, its last line; `tools/qa/panel-keys.cjs` on backslash): the Controls tab on the
  page's own board, and the debugger's key.
  SEEN ON THE REAL PAGE (software adapter, real key presses, 10-22): backslash opens and shuts the debugger, 1 files `Digit1` and draws, backtick
  files `Digit0` and empties the hands, backtick again leaves them empty, the E key files nothing.
  NOT DONE HERE: the HUD's kit box still shows no row for the empty slot.
  Nobody has played it; never seen on a GPU.
- **His own actions are a ring that stays, on E; the whistle is its last wedge; the corner shows one line** (`src/game/handring.ts HANDRING {on,
  holdSecs}`, 10-22; the maintainer: "radial menu for our own actions, remove existing menu in top left and awkward scrolling thing", "move whistle
  to our actions and remove v binding", "move our actions to E", "i think same would go for our actions (1-5 with the ring open)", "we can make our
  actions and squad actions symmetric … what the default action might be … in the top left, which might be fine", "tab could be that for us").
  ON in the page (`?handring=0` = the list on a held Space with its wheel and cancel row, the corner list, V for the whistle; the debugger's Player
  tick "your own actions are a ring that stays"), OFF in the module and on the frozen stand (`FROZEN_HOLDS`, `TPS_HANDRING=1`, pinned in
  `host/standup.ts`); in the knob registry and carried by a recording (one from before it replays with it off).
  THE RULE (interact.ts `updateInteract`, `ringStays`): a TAP of the interaction key does the highlighted row, as it always did. The key kept down
  `holdSecs` (0.3, the squad ring's number for a ring that stays) puts his rows up as a ring at the cursor (the ring `CMDRING.hands` drew as a
  prototype, now standing without the squad's switch; rows 1 to 5 are wedges 1 to 5). Let go with the cursor out on a wedge: that wedge is done.
  Let go in the middle: the ring STAYS (`Player.sel.ring.free`), his feet his own. Standing: a digit does its wedge at once (and is no weapon
  slot), a left click does the lit wedge and is swallowed (he does not fire; the held button stays taken, as under the squad's ring), the key
  again does the lit wedge, a right click or the back key (Tab, Esc where it reaches the game) puts it away with nothing done, and so do a blur,
  the pause, going down, and the squad's menu or ring coming up. A wedge that cannot be done NOW (out of reach, or the whistle before the breath
  is back) is lit by its digit or a click and the ring stays: only a thing done, or a put-away, takes it down. A ring put away leaves the
  highlight on the top row. The ring opens already armed (the hold was the wait: a flick the moment it is up counts). The held list and its
  cancel row do not exist under the rule; the wheel is his pace, also under a standing ring, unless the key is down. A STANDING RING IS NOT
  "HANDS BUSY": `Player.choosing` (the selector up and not standing free) is what the slot key, the wall press and the hold swap ask,
  `interact.ts handsBusy` what the squad's key asks (`orders.backFree`), and a quick save is allowed under it (savestate.ts). A DIGIT INSIDE THE HOLD
  (`HANDRING.early`, on and off with `on`: the same address word and stand word; a recording from before the key replays with it off): the key
  down and the ring not yet up, a wedge's digit puts the ring up at once and is that wedge, so a quick "E, 2" is never the rifle or the gun's
  setup (the squad ring's owner found the same window on Q). A save kept in MEMORY
  (a team on the floor) is the whole game as it stood, the ring included: `Checkpoints.loadMem` puts a standing ring away after the snapshot is put
  back, as a file's load finds none (found by the quick saves' owner: without it his first click after such a load did the lit wedge). This is the press rule agreed with the squad ring's owner (`CMDRING.stay`, `ringLatch` in cmdring.ts when that lands: this file
  holds its own copy of the same rule until then, and should read the shared one after).
  THE WHISTLE (`whistleWedge`): the ring's LAST wedge, always the same one, wherever fewer rows than wedges are on offer (`CMDRING.wedges`); greyed while the breath
  is not back; not there where the rows fill every wedge, while a verb runs, or with him down. It is NO ROW of the list: `Game.nearby` and `Game.hover` are as they were, so nothing that reads them meets it, and a tap never
  whistles. On open floor the ring is that one wedge, lit. `whistle.ts whistleKey` still answers `'KeyV'`: every recording and check that presses
  it is as it was; the page's board takes the key off the row.
  THE CORNER (ui/overlay.ts `deriveInteractions`): one line, what a tap would do now (the highlighted row with its hints, or a running verb's own
  row, or a status line) with at most one no-key hint line under it (a locked door's "needs a key"), and no action line while the whistle is the
  lit wedge. Nothing where a tap does nothing. The squad's block under it is untouched.
  THE BOARD (`src/host/keymap.ts KEYMAP.handWhen`, `HAND`, `HAND_SLOT`, `handNow()`; main.ts hands it `() => HANDRING.on`): the whistle's row has
  no key (the player may give it one in Options, Controls; the letter V in a line of words is left alone, as a freed row's is). Over the slot's
  layer (which is what leaves E spare) the E key gives the interaction's code `'Space'` and the Space key gives the game nothing. Words follow:
  "Space  open" reads "E  open", and "E puts it away" still reads as the slot's key. With `?handslot=0` the ring is on Space. THE ORDER MENU'S
  ROW ON V (the wand under a door) has no key on the page while the rule is on: it is the squad owner's to seat on a wedge.
  THE WORDS: Options, Controls and the start card reword the action key's row and the whistle's under the rule (ui/options.ts `RING_SMALL`,
  ui/menu.ts `RING_ROW`). A lesson's line that says "V whistles" (Training 2 has two) is shown as "Space held, then 5, whistles" while the rule is
  on, and "Hold Space, wheel to kick, let go" (the lights lesson's gate) as "Hold Space, then 2 kicks it" (`lesson.ts lessonLine`; the page's
  words put the key in): the level's own text is not edited. A lesson that gains a line naming V or the held list's wheel needs a row there.
  PAGE DRIVERS: `tools/qa/keybinds-page.cjs` holds the rule off on its older lines (`&handring=0`) and reads the page's own board in its last
  (the action on E with the ring's words, no V on the whistle); `tools/qa/tapes/page-bot.ts verb()` presses the wedge's digit when the ring is
  up.
  OLDER CHECKS: selector-probes, grab-probes, tabback-check and cmdring-check read the list as it was built and hold the rule off after standing
  up (their note says so), as grab-probes already holds the close-in mode off.
  CHECK: `bun run tools/qa/probes.ts handring` (family `player`), 14 lines, both stands; `HANDRING_BREAK=1` fails 13 (the tap's line passes either
  way: a tap is the tap it was). Read: the leaf after a tap, the ring's view before and after the hold, standing after a walk, a digit, the
  whistle's digit and a click before the breath is back, a click with the rounds counted, the cursor out the moment the ring is up and the key
  let go, the key again, right click, Tab, the list and highlight unchanged, off, the board, the lesson's line, a recording, and under a standing ring the wheel as his
  pace, the squad's key free and a save allowed.
  SEEN ON THE REAL PAGE (software adapter, real keys and pointer, the draw stubbed, 10-22): the corner reads one line ("DOOR · SHUT / E / pull it
  open"); a tap of E files `Space` and the leaf opens; E kept down half a second draws the ring ("1 push it shut · 5 whistle", 1 lit); let go, it
  stands; Tab puts it away; ring then 1 shuts the leaf; ring then a click opens it; on open floor the ring is "5 whistle" and 5 raises his noise;
  the V key and the Space key file nothing. No picture was taken: a screenshot does not come back on that adapter.
  NOT DONE HERE: the shared latch helper (the camera moved to the spare Space bar in the next bullet).
  Nobody has played it; never seen on a GPU.
- **The camera's key is the Space bar** (`src/host/keymap.ts KEYMAP.camSpace`, `camKey()`, `camCap()`, 10-22; the maintainer: "move camera pan from
  ctrl to space", "zoom can still be just space + scroll"; a tester's Ctrl then W closed his tab). ON in the page (`?camspace=0` = Ctrl, as it
  was), off in the module, so both of the harness's stands have Ctrl: it is a HOST switch like the board's others (`qFree`, `setFree`), not a game
  rule: no knob, no journal key, no `FROZEN_HOLDS` row. A recording holds the view's turn and zoom themselves, never the key.
  ONLY WHILE SPACE IS NO ROW'S: `camKey()` is `'Space'` when the switch is on AND the Space key gives the game nothing (`gameCode('Space') === ''`:
  his actions a ring on E, `handring.ts`, with empty hands a slot, `handslot.ts`, and no row put on Space by hand in Options). With `?handring=0` or
  `?handslot=0`, or a row he put on Space, the camera is on Ctrl again, by itself, and the words follow.
  HELD (`game/input.ts`, `Input.camHeld`: the key on the board that is down, '' = none): the mouse's travel is the view's turn (`orbitDX`) and the
  wheel is the zoom (`wheelCtrl`), not his pace. The key files nothing for the game. Let go, the page out of focus, or a browser menu opened (which
  swallows the key's coming up) lets go of it. It is a latch where Ctrl was read off every mouse event: a keyup lost some other way leaves the
  view turning until Space is tapped. While Space is
  the camera's, Ctrl and the mouse turn NOTHING; a wheel that says Ctrl still zooms, because that is what a trackpad pinch sends.
  CTRL AND THE WHEEL (2026-10-24; `KEYMAP.pinchOnly`, `?pinchonly=0`; the maintainer: "ctrl-scroll still zooms in and out, should remove"): while
  Space is the camera's, the wheel under a Ctrl key that is DOWN is nothing, neither the zoom nor his pace. A PINCH STILL ZOOMS: Chrome and Firefox
  send a trackpad pinch as a wheel that says Ctrl with no Ctrl key down, and `game/input.ts` tells the two apart by `ctrlDown`, the `ctrlKey` of the
  last key or mouse event on the window (first in line, behind no gate: a field with the focus, a lock, a Control he put on another key and a Ctrl
  pressed in another frame all say it; a lost focus keeps it and a plain wheel clears it). So zoom is Space and the wheel, or a pinch. Space pressed
  UNDER a held Ctrl was never a key of ours (a system's own chord), so with Ctrl down first there is neither the turn nor, now, the zoom. With the camera on
  Ctrl (`?camspace=0`, or a row he put on Space) Ctrl and the wheel is the only zoom there is and stays. Like `camSpace` it is the page's own
  (`keysBoot`), off in the module, in no recording and on no stand: no run reads a wheel. CHECK: `camspace`, its line 'the wheel under a held Ctrl
  key is nothing…' (left and right Ctrl, a pinch, a plain wheel, a Ctrl key whose coming up was never seen, both Ctrl keys and one let go, Space and Ctrl in either order, Ctrl
  pressed in a field, on Caps Lock, through a lost focus and in another frame, the camera on Ctrl, the rule off, the page's word);
  `PINCHONLY_BREAK=1` fails that line alone. KNOWN: (1) a Ctrl key-up the page never saw (a system shortcut) leaves a pinch dead until the mouse
  next moves or a plain wheel turns; (2) a device that makes its pinch or its zoom button out of a REAL Ctrl press and a wheel (some older Windows
  touchpad drivers, some mice) cannot be told from the chord and is nothing: `?pinchonly=0`, there is no Options row; (3) Ctrl held and the wheel
  turned over a page that never saw the key go down (another frame, the address bar or devtools has the keys) still zooms until the mouse moves; (4) Safari sends a
  pinch as its own gesture events and no wheel, so a pinch there was never the zoom (not checked here). NOBODY HAS TRIED IT ON A TRACKPAD.
  TWICE (`host/findme.ts watchCtrlTaps(win, idle, key)`; main.ts hands it `camKey`): the "Double tap" option of Options, Game (off unless he turns
  it on) is two taps of the camera's key, wherever it is. findme.ts still imports nothing.
  A tap of Space with Shift held counts (Shift is his sprint; with Ctrl it is a browser chord and still does not). With a text box focused (the
  debugger's search) Space types a space and turns nothing, where Ctrl still turned: left so.
  THE WORDS: Options, Controls draws the two camera rows' cap plain (`ui/options.ts camCapEl`: Ctrl or Space; never keyCapEl's 'Space', which is the
  action's row and reads "E"); the start card's row is "Space + mouse / wheel" (`ui/menu.ts CAM_SPACE`, written as it is by `keyCol`); Options,
  Game says "Double tap Space" and "hold Space and move the mouse" (`ui/findme.ts`, `camCap()`).
  NOT A ROW (a reviewer's note, left as it is): the camera's key cannot be moved in Options, and a row put on Space takes Space from it with no
  swap shown. Making the camera hold a row of the board would give it caps, words and a swap by the board's own machinery. `tools/qa/findme-page.cjs`
  (the settings thread's) reads "Double tap Ctrl" and presses Control: it needs `&camspace=0` or the new words. The engine replay's own view still
  turns on Ctrl (`replay/engineplay.ts`). A laptop touchpad that goes dead while a key is held would not turn the view under Space: not tried.
  CHECK: `bun run tools/qa/probes.ts camspace` (family `player`), 6 lines: the board, held, Ctrl, the wheel (above), twice, off; on game/input.ts's own listeners and
  the double tap's, stood on a window and a canvas that are lists of them. `CAMSPACE_BREAK=1` fails 5 (the `off` line is the build as it was).
  `tools/qa/keybinds-page.cjs` reads the camera's cap in its last line.
  Never seen on a GPU; nobody has felt Space held under a thumb while the same hand walks.
- **A can in the wind-up goes back on the belt when his hands start something else** (`src/game/throwback.ts THROWBACK.on`, 10-22; the deep
  review's src15-01, and src15-02 with it). A throw is counted off the belt at the click and leaves the hand `THROW_RELEASE` (0.28 s) later, on a
  countdown that runs in the open part of `updatePlayer`, after the early returns for a kick, a pick, the wand, hands at work and the keypad. A can
  clicked and one of those rows taken inside the wind-up froze in his fist for the whole beat and left it afterwards from where he then stood, on
  the arc solved at the click: after a pick, four seconds late, a stun or a frag included. THE RULE: one line ahead of those returns gives the can
  back (`player.ts throwOff`, what `startGrab` and `cancelActions` always did) and ends the wind-up; a takedown's start, which dropped the wind-up and kept the can it had counted,
  gives it back too. Nothing is thrown. ON in the page (`?throwback=0`; the debugger's Player tick "a can in the wind-up goes back on the belt"),
  OFF in the module and on the frozen stand (`FROZEN_HOLDS`, `TPS_THROWBACK=1`, pinned in `host/standup.ts`); in the knob registry and carried by a
  recording (one from before it replays with it off). Only a run that begins such a beat inside a wind-up changes.
  The swing already begun on the animator is not called off (a grab's never was): read in the code, he may be seen to swing with nothing
  leaving his hand; nobody has looked. A beat added to `updatePlayer`'s early returns must be added to that one line.
  CHECK: `bun run tools/qa/probes.ts throwback` (family `player`), 6 lines, the rule raised by the check on both stands: a pick (4.3 s, no can in
  the air through it or after), a kick, a plain throw untouched (in the air at frame 17, one off the belt), off (the can in the air at frame 67,
  after the kick ends at 58), a takedown (the game's own start on a parked man), recordings. `THROWBACK_BREAK=1` fails 4. The throw is made through the keys (the can's digit, a click); the kick and
  the pick are begun by the game's own starts a few frames in. NOT in the check: the wand, hands at work and the keypad (the same
  line; read, not run). Headless only; nobody has played it.
- **A rifle beside a jamb fires, or the ring says it cannot** (`WALLSNAP.leanGun`, wallsnap.ts + player.ts `stackLean`; `GUNWALL.mark`, gunwall.ts +
  player.ts `gunShut`; the maintainer, 10-22, off the solo tutorial mission: "shooting the sentry doesn't work since the rifle is on the right hand side
  and the bullets are hitting the doorframe?"). WHAT IT WAS, reproduced headless on that mission's gate and on the conference doorway: stacked on a wall,
  the cursor round its end steps him out `leanAlong` 0.6 m — measured for his eyes. The rifle rides a hand's width to his right, so round an end on
  that side his head was clear, the reticle had the man, and the rifle as drawn lay IN the jamb: every round ended at its own muzzle (combat.ts
  `armThrough`), silently. Free beside the same jamb the gun came down (the gun-at-a-wall rule above) and a click filed 'no room to bring the gun up' —
  a `g.msg` line, and the page draws none of those but the radio's (overlay.ts). TWO SWITCHES. (1) `leanGun` (m, 0 = off): while a step-out is wanted
  he steps the least further, by `leanGunStep` up to `leanGun`, from which the rifle as it would lie there and the first `leanClearM` of its round's
  way are clear (gunwall.ts `gunClearFrom`: the worked-out carriage and 0.1 m outside it, with the arm); `WallHold.leanMore` eases up at the
  step-out's speed and is kept until he is back in. On the gate: 0.78 m, one round, the sentry down. An end on his off side: 0.6 m, to the
  centimetre. A sim rule: 0 in the module and on the frozen stand (`TPS_LEANGUN=1`), `LEAN_GUN_M` 0.42 in the page (`?noleangun`), a recording
  without the key replays at 0 (journal.ts). (2) `mark` (the overlay's; nothing in the game reads it): the aim ring is dashed and barred (`.shut`,
  index.html) while no round of his can get out — the gun held down by a wall, the stack with the wall he is on in its line, or the gun up with a
  panel between shoulder and muzzle (a sheet his rounds go through is not one); while the ring is busy on a thing Space acts on (a door in reach) the
  gun's own small circle wears it. Not through a step-out. Off in the module and on the frozen stand, on in the page (`?nogunmark`). CHECK
  `probes.ts leangun` (tools/qa/leangun-check.ts, 8 lines, both stands; `LEANGUN_BREAK=1` fails gun-side): gun side / off side / the mark stepped
  out, stacked and free along the doorway (17 places: barred exactly where a click sends no round into the room) / the stands and the journal. The
  old `wallsnap` family pins `leanGun` 0 (its lines ask for 0.6 m) and passes on both stands; `lesson-run tut-solo` passes. One level's doorway and
  one gate, no seeds (nothing here draws from the die). NOT MENDED: free beside a jamb the gun still comes down — he has to step; the ring now shows
  it. The pistol's line of `gunShut` is not run by the check. If no place within `leanGun` is clear he steps 0.6 m as before, and the ring is barred.
  `probes.ts gunwall` is red on the page's stand at the build head this was cut from (its standUp line), the same with and without this change.
  `tools/qa/hudmarks-page.cjs` reads the ring's classes on the real page (software adapter). NEVER SEEN ON A GPU: the bar, the longer step-out.
- **His own charge goes off from his own actions, not from the squad's key** (`src/game/ownblow.ts OWNBLOW.on`, 10-22; the maintainer on the solo
  tutorial's "F: blow it": "i think we shouldn't use F for blow it, F should be reserved for squad. instead it should be one of our own actions"). With
  it on, a charge his own hands set (a door's, doortools.ts `by: SAM_BY`; a wall's, wallcharge.ts) is a ROW of his own list wherever he stands,
  'blow the charge' (kind `charge`, verb `blow`; player.ts buildInteractables puts it under the rows the things in reach had and ahead of the rows past
  the cap, so its wedge is never past the fourth; with no capped row to sit under it goes under the rows past the cap instead, a stuck camera's 'take
  it back' or a door's lone 'set a charge'; not while his hands or feet are spoken for, a sprint or a drag included). The interaction key's tap gives
  it only when it is the only thing to do: the highlight goes back to the top row when other rows come into reach with no list or ring up (walk from
  his charge to another door and the tap is that door's). It is no thing under the cursor: `ui/overlay.ts` keeps the reticle and the gun's ring his
  while it is the highlighted row. A BARE TAP NEVER BLOWS IT WHERE IT WOULD KILL HIM (`ownBlowHeld`, interact.ts, a tap being the key let go inside the hold
  with nothing scrolled, whatever list was up for it; `wallcharge.ts samFatal`: WALLKILL's own distances, at a wall charge on its side or just past
  it, never in god mode): the row is greyed by the same test; the ring's wedge, or the list's row, still does it: there he chose it. ('too close to
  your own charge' goes to the log only: the page draws no log line.) A DOOR'S charge never puts him down, so nothing holds its tap: the row's words
  say who it would catch (`closeWords`: 'too close: you', 'behind the door: …') and the dazzle is his to take, as it was on F. (The solo tutorial's
  stand-clear mark reaches inside the 1.6 m backblast at its near edge: a tap from there blows the door and dazzles him for a moment.) The nearest of his own goes; `game.ts` reads the act (`ownBlowAct`). THE SQUAD'S KEY (`DOORTOOLS.blowKey`, F) no longer blows it and no
  longer stops at it: `keyIs(c)` on each tool is the one rule (the squad's charges, and HIS while the squad works that door or wall: told to stand off
  behind it, or stacked on it, one press and it goes). The press, the pair word, the stack word, the squad block's notes and
  `floorplan.ts waitsOnKey` (the plan's bars and the key's glyph) all ask it, so with only his own charge set F goes on to whatever else it means. A
  row's key column and `line2` say `Space` for his own (`blowKeyWord`: the page words those as the key the interaction is on); a line drawn as it is
  written (a door's header, the squad block's note, the log) names F only while F blows it and no key otherwise (`blowTail`: the row has its own).
  The Controls page says F is 'the trigger of a charge the squad set'. ON RAILS: the row is offered where the mission's `rows` have `blow` or
  `charge`, and only from the step that opens the action `blow` (rails.ts ACTS, no key) or the squad's `word` (the key that had it), so the solo
  tutorial's own steps gate it as they gated F. A lesson step's line for it is the step's own `blowLine` (scenarios.ts `LessonStep`, levelData.ts; the
  sibling of `ringLine`, read by `lesson.ts lineOf` while the switch is on): tut-solo's is '[Space]: blow it'. No line is reworded by pattern: tut-sky's
  '[F]: blow it' is the squad's charge and stays. ON in the page (`?ownblow=0` = F blows any set charge, as it did), OFF in the module and on the
  frozen stand (`FROZEN_HOLDS`, `TPS_OWNBLOW=1`, pinned in `host/standup.ts`); in the knob registry and a journal's tables (a recording from before
  the table replays with it off); a box in the debugger's player section. CHECK `bun run tools/qa/probes.ts ownblow` (family `player`, 11 lines, both
  stands; it raises the switch, SAMSTUN, WALLKILL and the wall's safety radius itself): the row at the door and stood off and its words, the squad's key
  leaving it, a tap, the ring's wedge (its words warn at the door, and it goes), back at the door (the highlight, the tap, no row while his hands are busy),
  beside a row past the cap (his stuck camera: that row is the tap's), the squad's own charge still on the key, the squad behind his charge, a wall (greyed and a tap refused at its foot, not for a player nothing can
  hurt, then all of it stood off), off,
  recordings. `OWNBLOW_BREAK=1` fails 8 (the two squad lines and `off` hold either way). `wordsmall`'s two charge lines ask the blown count and read
  both rules: on the stacked door the key blows it; on another door the word sends the stack in and, with this on, his charge stands. The old charge rigs (`doortools-probes.ts rig`,
  `wallcharge-probes.ts`, `outerwall-probes.ts`) and `owncharge-page.cjs` (`&ownblow=0`) HOLD THE SWITCH OFF: their lines press F on a charge set by
  hand, as they were written. The solo tutorial's scripted player (`tools/qa/lessons/tut-solo.ts`) taps the interaction key where the switch is on.
  Costs and not done: the row is a fourth row at a door, so where five rows are up the whistle has no wedge until the charge has gone; the squad's menu
  row 'blow the charge' on a door and the debugger panel's rescue button still blow any charge; nobody has played it, never seen on a GPU.
- **A tap of his own key with nothing in reach says so; the tutorial's big line steps out from under a ring** (10-22, two claims from a play of the
  stealth tutorial on the real page). (1) `HANDRING.empty` (on and off with `on`, as `early` is: `?handring=0`, `TPS_HANDRING=1`, a `FROZEN_HOLDS` row,
  a recording from before the key replays with it off): a bare tap with no row at all files 'nothing in reach' (`EMPTY_WORD`, interact.ts at the
  tap's release; not again while that is the newest line and under 3 s old; never for the tour's puppet or a man folded by a blast), and
  `ui/overlay.ts deriveInteractions` shows it as one dim row in the corner, where his rows come up, for 1.6 s (the page draws no other log line, so
  the word alone was still silence). Check: `handring`'s tap line (filed once, not twice, not with the rule off); the corner row was read on the
  page. (2) `#railprompt` lies over the rings' layer, so with the cursor low in the middle a ring's lower wedge and caption were under its plate:
  `ui/cmdring.ts clear` now takes both rings (the squad's and his own) and, while a ring's words (down to under its caption) lie over the line at
  rest, writes `--railshift` on it: down past the ring if the window has the room, else up over it (index.html: the line's transform, eased). The
  line stays readable: it is often what says which wedge to press. The older `ringover` (the status column faint under the squad's ring) is as it
  was. Page-only: no headless check sees it; read on the software adapter by the boxes' places, never seen on a GPU, no picture taken.
- **A tap that finds no row beside a thing names the thing and why** (`HANDRING.near`, handring.ts; interact.ts `emptyThing` / `emptyWord`; on and off
  with `on`, as `empty` is: `?handring=0`, `TPS_HANDRING=1`, a `FROZEN_HOLDS` row, a recording from before the key replays with it off). The
  maintainer, 10-22, on the stealth tutorial with the back door open at his elbow: "nothing in reach to close the door?". THE CAUSE was not reach:
  tut-quiet's frame names the rows it offers (`rails.rows`: push and pick on a door, never `pull`, the row that shuts an open leaf), player.ts drops
  every row the frame does not offer, and the bare tap then filed 'nothing in reach' 0.55 m from the leaf (measured headless on the page's stand;
  with `pull` let through the row is there). THE CAUSE IS MENDED by the tutorial itself (its list now has `pull` and `ease`: `missions.md`); this
  bullet is the word, for every thing a frame still keeps back and for a door out of reach anywhere. THE WORD names only what the
  game knows exactly (`emptyThing`, in this order, the nearest of each): a thing worked by hand (player.ts `PRESS_THINGS`) in reach whose every
  row the frame kept back (buildInteractables marks its marker `framed`) says 'not in this mission'; a door in his hand's reach with no row while
  his hands are not his (a leaf already in his hand) 'not now'; a door his sprint alone keeps from him 'stop sprinting' (never one locked against
  him: its own line there is the boot's); a door a step off, within `EMPTY_NEAR_M` (2.2 m, as its reach is measured: `thingDist`) and in sight (a
  level line from his eye to `EMPTY_SHY_M` short of the leaf or the doorway: the door markers are the whole level's) 'step closer'. A door's reach
  is read as its distance and his feet (`Doors.USE_REACH`; the marker's `inReach` is also true from a stack's distance when the big slot's tool
  has a row). A door of the last two that the frame offers NO door row for (`SHUT_ROWS` / `OPEN_ROWS`, interact.ts: tut-quiet's open back door
  as it was) says 'not in this mission' from the step off as well. KNOWN GAP: a frame that offers some door row but none for this door (a steel
  door, a lock it names no pick for) says 'step closer' and then, in reach, 'not in this mission'. After the thing's name (the head of its marker's
  `line1`). NOTHING, so 'nothing in reach' as it was: open floor, a body or a switch out of reach (their reach is not a plain distance; and where
  one is nearer than the door the door is not named either), a takedown under way, and wherever a living man in sight is nearer than the thing
  (that tap was for him). THE CORNER reads the word off the selector (`Player.sel.word` / `wordT`, set by every such tap and cleared by the next
  press, so a second tap always answers and a later log line never hides it) for 1.6 s, only while it is still what a tap would say (a step into
  reach, or away, takes it down), and beside 'step closer' it shows how far the door is. With `near` off the corner and the log are as they were.
  THE LOG takes one line in 3 s whatever the word (it changes as he walks). Check: `handring`'s last line, on both stands (1.8 m from a door,
  twice, one log line; sprinting 0.7 m from it; a door 1.9 m off behind a wall; a man 1.25 m off; the quiet mission with `pull` and `ease` taken off its rows, inside its
  open back door and 1.8 m short of it; the same tap with its rows as built shuts the leaf; a second tap with the leaf in his hand, only where the stand has hands, so
  'not now' is asserted on the page's stand alone; a recording from before; `HANDRING_BREAK=1` fails it). Nothing in it turns on a die: one
  stand-up of each level, the rig's seed and seed 1. NOT CHECKED: a body or a switch nearer than the door (a ragdoll does not land where it is
  put), the corner's row (read on the page by the DOM, on the software adapter). Never seen on a GPU; nobody has played it.
- **The throw preview's ring is where the can comes to rest** (`THROWBACK.restMark`, throwback.ts; player.ts `throwRest`, frag.ts `restOfThrow`; the
  maintainer, 10-22: "hard to toss the smoke to precisely hit the gap … maybe we just need to update the UI to show roughly where it'll end up").
  WHAT IT WAS: the arc and its ring ended at the can's FIRST TOUCH (throwables.ts `solve`), which is where the cursor is; the can then bounces and
  rolls on — measured on the corridor's open floor 4.8 to 5.6 m further for a smoke or a stun and 3.7 to 4.0 m for a frag, 1.0 to 1.6 m off a wall
  or through a doorway. Now the ring is on the point the item's own model leaves it at (frag.ts `rollOn`, the AI's rest guess, replayed on a body
  that was never spawned: a smoke until it lies still, a stun until its fuse from the first touch, a frag until its fuse from the hand; loose
  furniture as it stands), a small tick stays on the first touch and the floor between is dotted. The overlay's alone: no throw flies differently,
  nothing is written, nothing drawn from the die; reckoned again when the arc changes and four times a second under one held still. Off in the
  module and on the frozen stand, on in the page (`?norestmark` = the ring on the first touch). The launcher's arc has no such mark. CHECK
  `probes.ts throwrest` (tools/qa/throwrest-check.ts, both stands; `THROWREST_BREAK=1` fails 3): 15 throws (three kinds × three ranges, a wall, a
  doorway), the mark read on the click's frame against where that can really lay still or went off: 0.00 m on all 15. One level, no seeds. THE CURSOR
  IS STILL THE FIRST TOUCH: the ring now sits metres past it, and aiming the throw so the can RESTS under the cursor would be a rule of the game
  (every throw, the scripted ones too) — asked of the maintainer, not built. `tools/qa/hudmarks-page.cjs` reads the ring, the tick and the roll on
  the real page (software adapter). NEVER SEEN ON A GPU: the tick, the dots, the ring's place on the screen.
- **The throw preview shows what the thing will reach** (`THROWBACK.reach`, throwback.ts; `src/game/throwreach.ts throwReach`, `ui/overlay.ts
  drawReach`, 10-23; the maintainer off a GPU shot of a grenade's arc: "we should also have kill radius / stun radius when throwing grenades"). While a
  throw is aimed the overlay draws, flat on the floor round the point the can comes to REST (`frag.ts restOfThrow`: where its fuse finds it, whatever
  the rest mark's own switch says): for a FRAG a solid red-orange KILL ring at `FRAG.lethalM` (4 m) and a dotted, fainter ring at `FRAG.woundM` (8 m,
  the band it hurts in and kills by a falling chance); for a STUN canister a dashed bright ring at the canister's own dazzle radius (`effects.ts
  bang.dazzleRadius`, 8 m: the edge every part of `combat.ts FLASH` falls off to); for the LAUNCHER'S GRENADE the frag's two rings on the floor under
  where the arc ends (it bursts through `frag.ts blast`), none while the arc is too short to arm (a dud). Smoke, a sponge round and a sticky camera
  draw none. The radii are read from the tables the burst is judged by, never copied. No word and no number is drawn. THEY ARE RADII, NOT SHADOWS: a
  wall, a shut door or a desk between is not drawn, though the burst asks what of a man is exposed; a ring that crosses a wall overstates the reach
  past it. THEY ARE BIG: at the page's own zoom the kill ring is about half the view's width and the 8 m rings run off its edges. A point behind the
  camera breaks the ring there and the rest stays (as `ui/squadthrowviz.ts` draws the squad's); a cut ring has no fill. The overlay asks when the arc
  has changed, not every frame, and writes a ring only when it has moved.
  SWITCH: `THROWBACK.reach`, the overlay's (nothing in the game reads it), OFF in the module and on the frozen stand (`standGame` pins it off;
  `FROZEN_HOLDS` row with no word, like the rest mark's), ON in the page (`?noreach`); a recording from before the key replays with it off (`journal.ts
  applyKnobs`). CHECK: `probes.ts throwreach` (`tools/qa/throwreach-check.ts`, families `throw`, `player`; `THROWREACH_BREAK=1` must fail) on BOTH
  stands: what the overlay is handed for a frag, a stun canister and a smoke, with the rest mark off, that asking changes nothing, one frag thrown by
  the click with three men stood by the rings (inside the kill ring down, in the band hurt, past the outer ring untouched: one throw, no seeds), the
  40 mm on an armed arc, a dud arc and the sponge round, and the journal. THE PAGE: `tools/qa/throwreach-page.cjs` reads the paths on the software
  adapter (the small ring inside each, the hurt ring about twice the kill ring's width, none for smoke, none with the switch off). NOT DONE: the
  squad's own throw rings (`ui/squadthrowviz.ts`: a frag's two, none for a stun) and the floor plan's (the kill radius alone) are other drawings of
  the same numbers and were left as they are. NOBODY HAS seen it on a GPU or thrown by it in play; the colours and line weights are a first guess
  against the snow level's shot.
- **One footfall a step** (`FOOTFALL.once`, src/game/player.ts; 2026-10-22, from the quiet lesson's scripted run). THE FLAW: a footfall is filed when the
  walk cycle's phase crosses a half or wraps. Backpedal runs the cycle backwards, so when backpedal flips frame by frame the phase rocks over ONE edge
  and every frame files a footfall: 20 in 20 frames staged, and a calm man 0.76 m in front goes alert on eight of them. What flips it: forwards and
  backwards keys by turns (a scripted player hunting its mark), and the walk with a man in the arm, whose facing rule has no slack. A cursor parked at
  his own feet does NOT (the plain walk's backpedal has slack: 0 to 6 flips in ten seconds). THE RULE: a crossing files a footfall only when the cycle
  has come `FOOTFALL.travel` (a quarter of a turn, either way added up, `Player.stepTravel`) since the last footfall FILED; the travel starts at 1 and
  is capped there, so the first step of a mission and any jump of the phase the walk did not make are never swallowed. A plain walk has half a turn
  between edges, so it files what it always did. Rocking kept up files at most twice a plain walk's footfalls (the legs are moving), never two nearer
  than a quarter of the cycle. A FIRST CUT ("the same edge crossed twice files nothing") was thrown out in review: it swallowed real steps without bound
  (a pacing man walked silent) and the first footfall of a start past the half. Do not go back to it; a longer travel (0.45) halves a pacing man's
  footfalls too. Both places a footfall is filed ask `footfallDue` (the next bullet put the test in one place). Switch: ON in the page
  (`?footfallonce=0` off; Tab ▸ Closer than ever ▸ 'one footfall a step'), OFF in the module and on the frozen stand (`FROZEN_HOLDS` 'FOOTFALL.once':
  `TPS_FOOTFALL=1`; `TPS_FOOTFALL=0` holds it off on the shipped stand), registered in knobs.ts and `JOURNAL_KNOBS`, a recording from before it replays
  with it off, and a checkpoint names `stepTravel` only when it is not 1. Key off writes nothing (the travel stays 1). CHECK:
  `bun run tools/qa/footfall-check.ts` (probe `footfall`, family player), both stands; `FOOTFALL_BREAK=1` must fail rock, held and ears. Lines: rock
  (three seeds: 20 footfalls in 20 frames key down, 1 key up), slow (ten seconds of it, legs of 2 / 4 / 10 frames: 300 / 150 / 60 key down, 33 / 30 / 30
  key up, 18 for a plain walk), walk (crouched, standing, sprinting, backwards on three seeds: the same frames and levels, digests equal), turns (pacing
  30 / 50 / 40 frames a leg: 20 / 18 / 15 against 20 / 24 / 15; the cursor across him every 15 / 25 / 35 frames: 7 / 6 / 14 against 11 / 9 / 18, frames
  running counted once), held, ears, harness. WHAT IT COSTS: an about-turn within an eighth of a cycle of an edge loses that footfall; a review's
  random keys and cursor (8 seeds of a minute a pattern) lost 7 to 18 % of the key-off footfalls with frames running counted once. The quiet lesson's
  scripted run passes with the key on and off (different digests). NOT THIS RULE'S: a walk with the cursor shaken across him about three times a
  second files NO footfall with either key (the phase never reaches an edge); the key makes the milder shakes cheaper too (8 to 21 footfalls in ten
  seconds down to 3 to 9). A footfall owed to travel alone mends both: the next bullet, 'A footfall the legs owe'. NOT DONE: no tour, no soak; never heard in a page; the
  lesson's "seven frames running" was not met on that lesson's pushed head (two frames running on the build before it), only staged.
- **A footfall the legs owe** (`FOOTFALL.owed`, a key UNDER `FOOTFALL.once`, src/game/player.ts `footfallDue`; 2026-10-23, the flaw 'One footfall a
  step' names as not its own). THE FLAW: a cycle turned about again and again rocks between its two edges and reaches neither, or crosses one with too
  little travel behind it for the first key to count. Staged on the lobby's floor for ten seconds, the forward key held and the cursor put in front of
  him and behind him every 10, 12 and 15 frames (the 10 on three seeds), over the same 10.9 m crouched and 13.3 m standing as a plain walk (18 and 22
  footfalls): the first key alone files 7 to 13 crouched and 9 to 18 standing; with both keys down the 12-frame rows file 14 to 31. So most of the
  loss at these rates is the first key's; what was there before it is the cycle that never reaches an edge. THE RULE: with both keys up the cycle's
  travel is also added up since the last EDGE PASSED, filed or not, or footfall filed (`Player.stepOwed`), on the frames he moves at a footfall's speed
  (over 0.4 m/s); when it comes to `FOOTFALL.owe` (half a turn: one step's worth of leg) a footfall is filed where the legs are, at an edge's level.
  A steady walk comes to its edge first every step and files what it always did. The count starts over at every edge passed (so after a footfall owed
  mid-stride the next ones are back on the frames a foot comes down), when he slows under a footfall's speed (nothing is owed while he stands, and a
  nudge after a stop pays no old debt), and on the first frame the test is asked after frames it was not (`Player.stepAt`, the game clock it was last
  asked at: a takedown, a keypad plant and a kick root or walk him without it, and a debt from before the beat is not paid after it). A checkpoint
  does not carry the debt: a load is a standing start. With the first key down the second does nothing and nothing is kept; unticked, `stepOwed` goes
  to 0 on the next frame. Both places a footfall is filed ask the one test. Switch: ON in the page (`?footfallowed=0` off; Tab ▸ Closer than ever ▸
  'a footfall the legs owe'), OFF in the module and on the frozen stand (`FROZEN_HOLDS` 'FOOTFALL.owed': `TPS_FOOTOWED=1`, which acts only with
  `TPS_FOOTFALL=1` beside it; `TPS_FOOTOWED=0` holds it off on the shipped stand), in the registered FOOTFALL table, and a recording from before it
  (with the first key or from before both) replays with it off. CHECK: the same card, `bun run tools/qa/footfall-check.ts` (19 lines, both stands,
  about three minutes); `FOOTOWED_BREAK=1` must fail shake's 'both keys up' line; the first key's arms run with both up, as the page has them, but
  its plain `walk`. Lines: shake (both up: 17 to 22 footfalls crouched against 18, 22 to 25 standing against 22, never two nearer than 14 frames;
  first key down: the second changes no frame), walk 2 (crouched, standing, sprinting, the sprint put on and off, the crouch taken and left under way,
  and two walks with stops in them, six seconds each on three seeds: the same frames and levels as with the key down, digests equal), feet (one
  about-turn begun at nine places in the cycle on two seeds: from two seconds after it every footfall is on the key-down run's frame, 18 of 18),
  nudge (let go at eleven places in the cycle, four seconds stood, the key for a fifth of a second: nothing more filed, 11 of 11; and a takedown's
  beat begun with 0.42 of a turn on the legs, the key held through it: the same footfalls after it), held 2, harness 2. WHAT IT COSTS AN ORDINARY
  WALK: one with the cycle turned about in it at speed can file a footfall more. Over nine six-second walks on three seeds (a square, the cursor
  swept once round him, a walk begun backwards): 2 more in all on each stand, none on frames
  running. PACING is louder, and is meant to be: forwards and back by legs of 40 frames, standing,
  files 15 footfalls in ten seconds with the first key alone and 22 with both (a plain walk's count: the legs move as much), so stepping out and back
  beside a man is as loud as walking past him (the card's `turns` arm prints it and holds only a floor). WET PRINTS: a footfall owed lays none (no
  foot is down under it), and the plant right after it, which the first key swallows, lays none either: a gap of one print at such a turn; never
  seen on a GPU. A FIRST CUT, thrown out in review: the count ran from the last footfall FILED and was kept through a stop. After one about-turn
  every later footfall of a steady walk was filed a fifth of a turn before the foot came down (the first key swallowed each plant and the count
  never met the feet again), and a debt from before a stop was paid a few frames into the next nudge. Do not go back to it. A SAVE does not
  carry the count or its stamp (`Player.stepOwed`, `stepAt`: `savestate.ts` sets them 0 and -1 on a load, and the card's stand line holds that a
  checkpoint does not name them), so a load and the game continued are not the same in those two fields. It costs no footfall: a load is a standing
  start whatever these fields are (staged once, not a card: both keys raised on the frozen stand, one seed, 80 saves made mid-walk, plain and with
  the cursor across him every 10, 12 and 15 frames: 1.55 m/s at the save and 0 after the load, so the loaded game never filed the continued one's
  footfalls with or without the debt), and with the debt put back by hand after the load the three seconds after it filed the same footfalls on
  the same frames in 80 of 80, because he is under 0.4 m/s on the first frame, which clears the count. Should a save ever carry his speed, these
  two fields go with it. The rollback snapshot walks every field of the player (`rollback.ts`), by reading. NOT DONE: never heard in a page;
  nobody has played it; what a shaking hand on a mouse does to the cycle was staged with the cursor put square ahead and square behind, not
  recorded from a hand; the keypad plant and the kick are covered by the takedown's line by reading (the same early return), not staged. IN A
  PAGE (headless Chromium, the software adapter, the solo night): the key reads on, and off with `?footfallowed=0`; 31 frames of a shaken walk
  drawn with no page or console error; stepped with no picture, three seconds from the same spot and foot filed 6 footfalls on a plain walk
  with the key on or off (the same frames), and with the cursor across him every 10, 12 and 15 frames 6, 7 and 6 with it on against 3, 4 and 3.
- **Two gears, not a dial (`TWOGEARS`, player.ts; the maintainer: "let's start by just removing the pace wheel entirely with the faster crouch sneak").** With the
  key up the mouse wheel does nothing to his pace (`wheelPace` returns; a notch a checkpoint or an older visit left on him is put back to 1 at the top of
  `updatePlayer`), and the crouch-walk goes at `TWOGEARS.crouch` 1.45 m/s where the tune's `playerCrouch` is 1.3 (walk 1.55, sprint 4.7, a patrol's walk 1.15).
  WHY: the dial bought nothing a player could find. A footfall's level is stance times floor and nothing else (crouched 0.125 of a sprint's, the wheel never
  moved it), and behind a walking man the old crouch closed at 0.15 m/s. Two speeds are left to learn: on his feet, and crouched and quiet. The wall sidle and
  a hauled body keep the tune's 1.3; the teammates' pace is untouched (the partner's sneak cap `UNSEEN.lowPace` 1.45 is now Sam's own crouch pace). The Controls
  list says "move · Shift sprint · C crouch (slower and quiet)", and the options page drops its Wheel row and the pace ticks while the key is up. Switch: ON in
  the page (`?twogears=0` off; Tab ▸ Detection & movement ▸ 'two gears, not a dial', with a slider for the sneak's m/s), OFF in the module and on the frozen
  stand (`FROZEN_HOLDS` 'TWOGEARS.on': `TPS_TWOGEARS=1`; `TPS_TWOGEARS=0` holds it off on the shipped stand), its own table in knobs.ts and `JOURNAL_KNOBS`, and a
  recording from before the table replays with it off. CHECK: `bun run tools/qa/twogears-check.ts` (probe `twogears`, families twogears / player), both
  stands; `TWOGEARS_BREAK=1` must fail wheel, saved, paces and tail. Lines: wheel (ten notches leave the pace at 1), saved (a saved 0.48 is 1 on the first
  frame), paces (three seeds: crouched 1.300 → 1.450, walk 1.550 and sprint 4.700 as they were), tail (crouched 2 m behind a patrol walking away, three seeds:
  in reach in 3.90 s, 7.35 s with the key down), ears (a crouched footfall files at 0.138 either way), off (key down, the run's digest is the build's),
  harness. `tools/qa/twogears-page.cjs` drives the real page on the software adapter, plain and with both flags off (it reads the hand of
  `CLOSE.handsLow` too). WHAT WENT WITH THE WHEEL: the squad's upright "slow and quiet" (unseen.ts `samSneaks` reads `pl.pace <= UNSEEN.paceAt`, which is
  never true now): they sneak when Sam crouches or takes a wall, and no other way. Training's "Moving unseen" has a step that asks for the wheel
  (`{is:'pace'}`): with the key up that test is true at once and the line goes by (lesson.ts, as `setup` does where a gun has none); lesson-run lets such a
  step go by. FOLLOWERS: a low follower's cap (`UNSEEN.lowPace`, `SNEAK.lowPace`, 1.45 before the kit's load) is now Sam's own pace, so a file that has
  dropped back cannot gain on a Sam who keeps crouch-walking (unseen-probes on the page's stand: fastest 1.18 to 1.42 m/s; "they keep up" still passes over
  its four seconds; not measured on a long walk). HELD BY OTHER CHECKS: selector-input's "the wheel is his pace", handring's wheel under a standing ring and
  unseen-probes' "slow on the wheel, upright" hold the key down after their stand-ups (the wheel's own rule); close-dark's exhibit asks for 25 frames at rest
  with the key up and the 30 it always asked with it down (he coasts two frames longer from 1.45 m/s: 28 frames, and nobody noticed him, as before; the
  staging's own slow pace is nobody's with the key up); ai-probes' motion table and floor-probes read `crouchPace(g)`; snowtracks' "slow crouch" line runs at
  the sneak's full pace with the key up and passes. THE TRAINING LESSON'S SCRIPTED RUN: with the key up Sam reached the dividing wall 2.6 s sooner, found
  the man still at the gate from his last round, went at once, and was shot at the last step (the man came to the trunk from the gate's side, with a line
  to the hide behind the hut). The script now waits for his next visit to the gate and passes on both stands; a player who goes on that earlier round can
  be caught there with the wheel too, which is the lesson's own, and not mended. NOT DONE: no stealth mission was tallied at the quicker crouch (a man who
  turns has 10 % less time to catch him crossing, and Sam has 10 % less time behind a man who stops), no tour, no soak, no tutorial mission's scripted run;
  the walk at 1.55 is now 7 % quicker than the sneak and four times as loud, which may leave the walk little to do; nobody has played it and it has never
  been seen on a GPU.
- **Shift in a crouch is a fast crouch walk (10-23; `CROUCHRUN`, player.ts; its look `DASH`, character.ts; `?crouchrun=0`, `TPS_CROUCHRUN=1`).** The maintainer:
  "we can make sprint when crouching a really fast crouch walk, but you have to stand up to sprint properly". ON in the page, OFF in the module and on the
  frozen stand, a `FROZEN_HOLDS` row, its own table and `DASH` in knobs.ts and `JOURNAL_KNOBS` (a recording from before the table replays with it off). With the key up,
  Shift held in a crouch no longer stands him up: `pl.dash` is set where `sprinting` is, he stays down and goes at `pace` 2.5 m/s (the crouch walk 1.45, the
  walk 1.55, the sprint 4.7), each footfall filed at `loud` 0.34 (the crouch walk's 0.125, the walk's 0.26, a run's 0.6, the sprint's 1), and it is no sneak
  (`samSneaks`). He is not `sprinting`: doors, switches, the grab and a reload are still his hands'. A door or a chair he
  runs into at this pace is bumped as a walking man bumps it, not as a creeping one. The sprint is the standing man's ([C], then Shift). A body in tow
  is let go of as a sprint's is; a held click on a man is the creep whatever Shift says; a puppet's or a tour's Shift is the old one. THE LOOK: by
  `anim.dash` (eased at 7 /s) the crouch cycle's stride is 30 % longer and its cadence that much lower, the pelvis 3 cm lower, the trunk 7° further over,
  the head level (`sneakLayer`). `tools/qa/gait.ts` (two new rows): at 2.5 m/s 2.68 steps a second on a 1.87 m stride with 0.067 m/s of foot slip, where the
  cycle unstretched would take 3.48 on 1.44 m with 0.156. THE CHECK is `crouchrun-check.ts` (`probes.ts crouchrun`, the player and stealth families;
  `CROUCHRUN_BREAK=1` reds five of its seven lines), both stands: stays (down, not sprinting, 2.50 m/s), heard (a step 0.374 on the lobby's floor against
  0.138 crouched, 0.286 walking, 1.100 sprinting), sneak, look (the stride's share whole with Shift and gone a second after; 2.67 steps a second where its
  own stride would take 3.45), stand ([C] with Shift held stands him up into 4.70 m/s), off, harness. One seed: these are speeds on a flat floor. The
  debugger has the toggle and both numbers under Detection & movement; the sneak lab has them and the stride and lean. `close-stills.ts` has a scene
  `dash`. THE WORDS (the controls goal, same day): while the rule is on, Options ▸ Controls' Sprint row has the line "hold it while you're crouched
  to stay low and move faster, but it's louder than walking" (`ui/options.ts sprintSmall`), and the controls list of the old start card (`?cards`,
  the boot card of a URL that names a mission, the harness: `ui/menu.ts moveRowNow`) adds "and Shift while you're crouched to hurry (it's louder)";
  the shipped start page and the load brief show no controls list. Off, both read as they did. `keybinds` has the line, both stands;
  `MOVEWORDS_BREAK=1` fails it. It asks the two functions, not the drawn rows. KNOWN: a screen already open keeps its words when the rule is
  flipped in the debugger or the sneak lab, until it is drawn again. Not seen on a page. NOT DONE: no sound of its own; teammates following a crouched Sam
  keep their sneak pace (they speed up only for a real sprint). Nobody has played it or seen it on a GPU.
- **Four ring notes: one row is a pill, no line under his ring, his ring stands on its thing, a switch's row turns him** (2026-10-23; four fields of
  `HANDRING`, handring.ts, each with its own page word and all four off under `?handring=0` too; all four off in the module and on the frozen stand and raised there by the hands ring's own
  word, `TPS_HANDRING=1` (no new stand word), each a `FROZEN_HOLDS` row, each off for a recording from before its key). CHECK: `handring`, both
  stands, a line for each of rules 1, 3 + 2 and 4; `HANDRING_BREAK=1` fails all three. The maintainer's words are in handring.ts.
  1. `lone`, `?lonepill=0` (`game/ringlone.ts` the shape, `ui/cmdring.ts RingDraw` draws it, `index.html .cmdring .lone / .ch`): a ring with ONE row
     draws no slice: a small ring round the middle (the wheel's hole) and a pill out the way that row's wedge lay, the digit at the end by the
     middle, the words inside, set to the width counted for them (6.6 px a letter, `textLength`; never measured). BOTH RINGS (the squad's is the
     same drawing). And the pointing, both rings (`cmdring.ts ringWant`'s `lone`): the cursor anywhere on the pill is that row. A wedge is a fifth
     of a turn and a pill over the middle is wider, so its digit lay in the next wedge's fifth and a key let go there gave nothing. No other way
     out lights it: a row is still chosen, never fallen into. THE GAME READS NO WORDS OF A RING: it reads which digits have a wedge (`ringKeys`,
     orders.ts and interact.ts, a bit each) and, for a pill, a PLACE as long as the longest pill (`pillBox`, `LONE.max` 20 letters) whatever the
     row says, so a recorded cursor lights the same row after a label is reworded. The pill drawn is always inside that place (a longer label takes two lines under `loneWrap`, the bullet
     below; without it, it is drawn tighter); a cursor just past a short pill's end is still on its row. WHERE ONE ROW COMES UP (read
     headless on the page's stand, each tutorial mission at its first and last step): on tut-sky EVERY squad ring ('1 stack up' on a door, '1 go'
     elsewhere: its frame names six orders); on tut-pair his ring at a door ('1 push it open', '1 keypad'); on tut-solo his ring at the gate;
     anywhere, his ring on open floor (the whistle, wedge 5). NOT DONE, the squad ring's own rows: a ring whose only order is also the quick
     order shows it twice (tut-pair '1 fall in · 3 fall in'; a man's ring '1 fall in · 3 fall in · …'), two slices for one choice.
  2. `bare`, `?ringbare=0`: no line of words under HIS ring (`interact.ts handRingView`'s caption is empty; 'RACK 6 · THE DRIVE · PULL THE DRIVE —
     STAY ON IT' under the wedges was "too busy"). The lit row's long words, 'stay on it' with them, are the corner's line still; the whistle's
     'one guard will come to look' is said nowhere now. With it, a wall switch's and the mains' wedge is no longer drawn faint because the lights are
     off (those things' `off` says how they stand, not that the row cannot be given: `STATE_OFF`). The squad ring's line (who the order goes to,
     what it was opened on) is not touched: it says which pair, and the wedges do not.
  3. `onThing`, `?ringonthing=0`: HIS ring comes up with its middle on the thing its TOP row is about (`ringSpot`: the first row with a wedge, the
     tap's own; not the lit one, or it would hop between two things as the highlight moved), on his own body a metre up where no row is about a
     thing (the whistle alone) or the thing is more than 3.5 m off (his own set charge's row is given from anywhere), whole inside the view's
     edge (`ringPin`, `CMDRING.edgeX / edgeY`), and stays on it as the view moves (the page draws it from the picture's own camera:
     `ui/cmdring.ts pinned`). On his body it GOES WITH HIM as he walks under it (a frame behind his feet); a thing that moves (a man in his arm,
     a body he drags) takes it along; and when its rows change under it (he walked up to a thing, or off it) it stands on what the top row is
     now about. The cursor may be anywhere when it comes up, so (`ringWant`'s `shapes`, `RingState.clear`) the cursor ON a drawn wedge, its
     fifth of the wheel from the hole out over its words to the ring's own box (`RING_BOX`: pointing at a row's words is pointing at the row)
     or the pill's place, lights it with no visit to the middle, but only once it has been off every drawn wedge since the ring last changed
     under it (a place of the wheel with no wedge is not one), and never while the hand is still: a cursor resting where a slice came up
     lights nothing and the key let go there leaves the ring standing, and only a wedge the HAND put the cursor on is pointed at
     (`RingState.pt`: the lit wedge sliding under a resting cursor is not). Outside the box a direction counts only from the middle, as
     before. The far-charge and moving-thing cases are by reading the code, no run. Digits, a click, the key again: as they were. THE SQUAD'S RING IS NOT MOVED: it is opened on the place
     the order goes to, which is where the cursor is, and stays on it already (`CMDRING.pin`).
  4. `turn`, `?ringturn=0` (`lightswitch.ts plants / turnSecs / switchHand`, `handwork.ts samWork` kind `switch`): a row given at a WALL SWITCH with his back
     to it (the ring up, he had turned with the cursor) flipped the lights and left him as he was: the hand's 0.3 s pose had nothing to reach
     with. Now the lights still go on the press; then he is stood at the plate and squared to it as at the mains lever (feet planted, the step in
     to arm's length, the trigger does not let go of it), and the hand's move is given the turn's time on top of its own (at most `turnMax`,
     0.45 s; the plant's own turn rate, `handwork.ts WORK_TURN`). The hand that goes to the plate is the free one (his left with the pistol or
     the rifle up: `samHand`, as at the mains). COST: his feet are not his for 0.3 s facing it, up to 0.75 s from a half turn away (0.60 s
     measured from 180° off, W held throughout). It is a FOLLOW-THROUGH, NOT A VERB: nothing waits on it, A CLICK LETS GO OF IT and so does any row given (the
     lights are out, the trigger and his hands are his: `switchLetGo`, from `player.ts` and `interact.ts give`; the plate's own row is on
     offer under it and a second tap flips the room back, as it always could), a save inside it does not keep it, and it breaks off
     as the mains lever's does (down, a man or a body in hand, folded by a blast, moved off the plate). NOT FROM A WALL HOLD: pressed to
     the wall beside the plate he reaches it from where he is, as he did (a plant would take him off the wall). Nothing without hands at work
     (`HANDWORK.on`). A tap's row and a ring's row alike. THE OTHER ROWS already turned him, by
     reading the code, not by a run: a door's leaf (hands.ts: he faces the spot his hand goes to), a lock, a pad, a kick, the wand (planted and
     squared), the mains, the rack, a charge, a timed charge (handwork.ts), a man or a body (close.ts, the haul).
  MEASURED: the check's own lines on both stands (die 1, the office; the pill's shape for 40 pills). NOT MEASURED: no fight or stealth tally was
  run with these on. NOT DRIVEN headless in a mission: the squad ring with one row (its pointing is the same function, asked directly). Never
  seen on a GPU; the before and after pictures of the wedges were drawn by the page's own drawing code and stylesheet over a flat backdrop.
- **A lone pill's long label takes two lines** (2026-10-23; `HANDRING.loneWrap`, `?lonewrap=0`, off with `?lonepill=0` and `?handring=0`; off in
  the module and on the frozen stand, raised there by `TPS_HANDRING=1` with the rest of the ring (no new stand word); a `FROZEN_HOLDS` row; off for
  a recording from before the key). The maintainer, 10-23, with a shot of a wall's second ring in plan mode, one row, 'breach with a wall charge ·
  3 left': "weird after hitting 5". A pill is drawn for at most `LONE.max` 20 letters and a longer label was set to that width (`textLength`), so
  34 letters stood in the room of 20 and ran into each other. THE RULE (`game/ringlone.ts loneLines`, `lonePill`; `ui/cmdring.ts RingDraw.place`
  writes the lines as two `tspan`s, once): a label longer than 20 letters takes two lines. It breaks at its ' · ' where both halves then fit in 20
  ('BANG AND CLEAR' / '3 LEFT', 'STAND OFF' / 'IN BEHIND THE CHARGE'; the dot is dropped, the line break says it), else at the space that leaves
  its longer line shortest ('BREACH WITH A WALL' / 'CHARGE · 3 LEFT'), never leaving the '▸' by itself. The pill is two lines tall (34
  px: `LONE.lead` 12 px taller, its lines that far apart) and grows AWAY from the middle, so its edge by the middle's ring is where a one-line pill's is. Each line is
  set to its own counted width: a letter is squeezed only where the best break still leaves a line over 20 (no space at all, over 40 letters, or
  words that will not split evenly: 'support hand grip' / 'point (arrows only) ▸' is 17 and 21). A label of 20 letters or fewer is the pill as it
  was, to the last figure. WHAT THE GAME READS: the pill's place (`pillBox`) is two lines tall under the rule whatever the row says, so the pill
  drawn is still always inside it and a recorded cursor never turns on a label's wording. So a SHORT pill's place gains a 12 px band too, away
  from the middle, where the cursor is on the row (less than the room the place already keeps past a short pill's end). CHECK: `handring`, its line
  'a lone pill's label longer than the pill…', both stands: 19 labels on five wedges (the lines, the door tools' own long rows by name, every word
  kept, full letter width wherever a break can give it, inside the place, clear of the middle, inside the ring's box), every short label against
  the pill of before the rule written out again (and every label against it with the rule off), the cursor on a tall pill's far line, the page's three words, an old recording, the stand's word;
  `HANDRING_BREAK=loneWrap` fails that line alone, `HANDRING_BREAK=1` and `=lone` fail it too. SEEN: the page's own drawing code and stylesheet in
  Chromium, before and after, nine cases, and on the real page (tut-sky, the software adapter) with the row of his shot handed to the page's ring:
  each line's measured width against the width it is set to (1.71 times too wide before, 1.00 after), both lines inside the pill. Never seen on a
  GPU, though nothing here is the renderer's: it is SVG text over the picture. NOT DONE: nobody drove to that wall's row by hand (the step of the
  mission in his shot was not found), and nobody has played it. NOT MEASURED: no tally moves (the frozen stand holds it off; on the page it changes
  what a cursor in that 12 px band lights and no more), so no seeds were run. KNOWN: Firefox does not set a `tspan`'s `textLength`, so there a
  line still over 20 letters runs long (the page asks for Chrome, Edge or Safari); the squad ring's rows are still worded long enough to need two
  lines, and shorter labels are Commanding's and the writing pass's.
- **The corner panel is three things: the objective, his key's line, the squad key's line** (2026-10-23; `HANDRING.corner`, `?corner=0`, off under
  `?handring=0` too; off in the module and on the frozen stand, raised there by `TPS_HANDRING=1`, a `FROZEN_HOLDS` row, off for a recording from
  before its key; the maintainer's five lines are in handring.ts). The panel at the top left was a heading and a row for his key ('DOOR · OPEN' over
  'E push it shut') and under it the squad's block: a title ('SQUAD · LOUD · ORDERS TO GOLD'), a line a man, what the squad carries, and the quick
  key's line. Now (`ui/corner.ts cornerRows`, fed by `ui/overlay.ts deriveInteractions`, drawn by `setInteractions`' `.it.one` / `.it.sec`,
  `index.html #interact.corner`, 230 px wide where it was 290): the OBJECTIVE as a section at its head (`objectiveParts`: the line's own word
  as the label, whatever it is ('objective', 'training 2/7'), a par or a clock in front of it at the right, a run's end line as words under no
  label, red when failed as the top line was; its words and clock are set in place, the panel is not rebuilt on a tick; the line at the top
  middle of the screen says nothing while the section has it, and says it again while the squad's menu is the panel; the diamond on the objective
  stays), then BLOCKS UNDER NO HEADING: of his own rows every line a key gives, each by itself (the highlighted row's, its key lit; on a man in
  reach both clicks), a row no key gives whole (a running verb's own words, how to stop it and its bar; a committed move's line; for a moment the
  word an empty tap left, with how far), then every line of the squad's that a key gives (the keyed lines of `orders.hud().status`: the quick
  key's, a plan's go, a wall charge to blow; and `doortools.ts cornerNotes`, what the block and a door's heading said that the corner would
  lose: a set door charge as the squad's key's line while that key by itself blows it, with who it would catch; a set charge that key does not
  blow so (his own, or one that goes with the word) only while it would catch somebody, as a warning under no key, shown whatever a lesson's frame
  keeps back; the small squad held at a threshold, only once the men have called it), then A MAN LOST, struck as he was
  (deathrecap.ts: the line and its arrow are the same; kept because nothing else on the screen says who is gone; it is the one line a man has).
  Each is there only while it has something to say; with none the panel is not drawn. GONE FROM THE SCREEN with it, and said nowhere else yet:
  what each living man of the squad is doing, loud or quiet, who the orders go to, the squad's charges, bangs and frags, the plain notes of the
  block ('ready on your word', 'word given · waiting for'), a row's alternative ('or sprint into it'), a thing's name and state over its row
  (a set charge's warning on the door's own heading is in `cornerNotes`). With a card up over the game the top line says the objective
  again; under a ring whose words cross the panel the objective fades with the rest of it. Their home is the card on Tab (`ui/tabcard.ts`, `docs/agents/menus.md`: the objective in full and the squad with its kit). The picture only: the rows, the squad's block and the objective's words are
  made as they were, so a lesson's frame that keeps a row back still keeps it back, and a key's line of `cornerNotes` is kept back where the frame
  keeps the squad's notes back. CHECK: `handring`, its 'corner panel' line, both stands; `HANDRING_BREAK=1` red, and `HANDRING_BREAK=corner` (this rule
  off, the rest on; likewise `lone`, `bare`, `onThing`, `turn`) red on that line alone. The line asks the reduction with rows shaped as the page
  makes them (parseOpts on player.ts's second lines) and asks the page's own feed (`Overlay.deriveInteractions`, called with no page) at a door:
  the three things with the rule on, the list as it was with it off; and a charge set on that door by hand, him at it and away: what the
  block's line says of a key or of who it would catch is in `cornerNotes` and in the panel. The panel AS DRAWN is the page's: driven on the real page on the software
  adapter with the rule on and under `?corner=0` (the classes, the rows' text, the size, the top line, no console error). Two page checks read
  what it changes and were changed with it: `lesson-page.cjs` reads the section where the top line says nothing, `deathrecap-page.cjs`'s
  'liveoff' case accepts no line for a lost man under the corner. MEASURED: nothing. It moves no tally (no rule of the game reads it; a run's
  digest is the same with it on or off by construction, never run to show it). RUN ON THE PAGE after the change: `deathrecap-page` ONLY=live (three cases pass). NOT RUN: `lesson-page`
  after its change, a set door charge or a threshold hold on the page or in a check with the squad of four armed on it, a running verb on the
  page. DECLINED from review, with why: `hudNotes` returning keyed notes under the rule (it would change what the block holds on the shipped
  stand, which that stand's checks read as strings); `objectiveText` returning its parts (every mission module words that line). Never seen on a GPU. NOBODY HAS PLAYED IT.

- **The gun is put away for a charge, and brought back after** (`src/game/workstow.ts WORKSTOW.on`, 10-23; the maintainer: "characters should fully
  unequip their weapon when planting door charges, etc. -- they can reequip after they're done"). A charge went on with the gun still in the man's
  hands: the player set one with his left while the pistol stayed in his right, and a teammate pressed his on one-handed with the carbine in the
  other, free to fire all two seconds. With it on, BY THE PLAYER'S HANDS (a door charge and a wall charge, `doortools.ts` / `wallcharge.ts samTick`):
  what he holds is put away first (`player.ts setHolstered`, carried by kit handling's own errand where that is on; `samStowing` holds the job's clock
  until his hands are free of it, `downMax` 1.6 s at most), BOTH hands go on the charge (`character.ts workLayer`), and it is brought back when the
  charge is set or he lets go of it; no round leaves it until it is up (`Player.equipT`: kit handling's draw, the rifle's own beat, `samUp` 0.3 s at
  least). Hands empty at the start stay empty. A job begun pressed to a wall takes over what the hold owed back to his hand (`WallHold.drawn`); a job
  that ended under a state that wants his hands empty (down, a man in his arm, a body, a lock, the wand) leaves it away. A save waits for the gun
  (`savestate.ts playerBusy`). BY A TEAMMATE ON ORDER (the 'place' stage of both tools): his gun hangs from the frame he is on the job (`Guard.workStow`;
  `combat.ts guardKit`'s `hang`: the long gun down his front on its sling, a sidearm on his thigh, as for the hammer), both hands go on the charge
  `mateDown` 0.3 s later, and it is his again `mateUp` 0.45 s after the job ends. NO ROUND LEAVES IT meanwhile: `gunslots.ts sideLocked`, the one lock
  every trigger a teammate has asks (roomfight.ts, coverfire.ts, the fight AI's fire site), answers for it, his fire clock is held, and `fireWeapon`
  puts a hung gun back in his hands should a round leave it by any other road. A TEAMMATE THE FIGHT HAS DROPS THE JOB (`stowFight`: his order yielded
  to it, he is blind or doubled over, or the room fight has brought his gun onto a man): the charge is not set, nothing is spent, the gun comes up,
  and he starts over when it lets him go, or after `fightCap` 8 s of it at a stretch with it still on him (door tools' own cap for a lock under fire).
  Enemies set no charges. Needs the hands that do the work (`HANDWORK.on`): with those off nothing is put away. WHAT IT COSTS, measured headless on
  the office, one seed each: the player's door charge with kit handling on, as the page ships, is 2.57 s from the row with the pistol up (hands free
  0.57 s in; it was 2.0) and 3.07 s with the rifle up (1.08 s in), and a round may leave the gun 0.43 s (pistol) or 0.72 s (rifle) after the charge is
  set; with kit handling off 2.05 s, and 0.32 / 0.47 s. A teammate's charge is set 2.30 s after he comes onto it (it was 2.0) and his gun is his
  again 0.50 s after; with a man 3 m off in his view half way through he drops it, shoots him with the gun back up and has the charge set 4.05 s
  after he first came onto it (2.0 s with the switch off, the round fired with a hand on the charge). ON in the page (`?noworkstow`), OFF in the
  module and on the frozen stand (`FROZEN_HOLDS`, `TPS_WORKSTOW=1`, pinned in `host/standup.ts`; `TPS_WORKSTOW=0` holds it off on the shipped stand);
  in the knob registry and `JOURNAL_KNOBS` (a recording from before the table replays with it off); a box, two sliders and a tally in the debugger's
  'Hands at work' section. Off, nothing in the module is called. CHECK `bun run tools/qa/probes.ts workstow` (`workstow-check.ts [sam|mate|wall|off]`,
  27 lines, both stands; it raises the switch itself): by the player's hands with kit handling off and on, the pistol and the rifle (away from the row
  to the charge set, both wrists within 0.3 m of the charge, back after, the click on the frame it is set fires nothing, the trigger his once it is
  up), hands empty, a step and the trigger breaking it off; a teammate (hung and locked every frame, the wrists, the two clocks, the net), blinded
  half way, a man put in his view; a wall charge by hand, begun from a wall hold, and on order; off (by hand, on order, with the hands off, the digest
  of a run with no charge, an old recording, the registry). `WORKSTOW_BREAK=1` fails 15 on both stands. RUN WITH IT ON, the shipped stand, green:
  the families owncharge, ownblow, wallcharge, outerwall, handwork, hands, kitanim, wand, gunslots, roomclear, and the scripted runs of tut-solo,
  tut-squad, tut-sky and tut-plan (the same verdict with it held off; the solo run is 0.6 s longer). `door-grenade`'s charge line now times the plant
  from the setter's own return to the lock (`Run.lockT`): the charge's later clock moves that probe's grenade, all four run, and 'the men are back' is
  said when the LAST is, with the charge already going on. STILLS: `node tools/qa/workstow-look.cjs <dir>
  [noworkstow]` (the page on the software adapter). NOT HERE, other owners' two-handed jobs: a timed charge on its bench and its defusing, the drive
  out of the rack, the optical wand, a lock being picked, a thing a teammate works (`workthings.ts`); the big slot's hammer already puts the gun away;
  a keypad and the breaker's lever are one hand. NOT DONE: no tour, no soak, no fight tallies with it on; never seen on a GPU; nobody has played it.
- **Sam sprints with both hands on the pistol** (`RUNREADY`, src/game/character.ts; asked for by src/game/player.ts `anim.runReady`; 10-25, the
  maintainer: "sprinting with pistol animation is weird, should keep two hands on it and at low ready, like rifle sprinting animation"). WAS: a sprint
  takes the pistol's layer off (`upper` 'none'), so the gun rode the sprint clip's pumping fist, while the rifle's sprint is the long gun's low ready
  in both hands (`armRifle … 'lowLong'`). NOW, with the key on: while he sprints with the pistol in his hand (`pl.sprinting && pistolUp`, not while
  the hands are busy) player.ts raises `anim.runReady`, and a figure so told that is in no stance of its own takes the pistol's LOW READY (the stance
  every man moving between doors has, arms only, the legs and trunk the sprint's) with its spring targets drawn in to the table's (`fwd` 0.24, `up`
  -0.185, `pitch` -50, `tuck` 0.6: a runner carries it nearer the belt than a walker). NO STANCE IS WRITTEN (nothing to own or to leave behind on a
  checkpoint); a stance of his own (the wall's low ready from gunwall.ts, a hold) wins as before; the rifle and a holstered pistol are not asked.
  Only Sam: no guard or teammate sprints. Switch: ON in the page (`?runready=0` puts it off; Tab ▸ the move panel ▸ 'sprint with the pistol ▸ both
  hands on it'), OFF in the module and on the frozen stand (`FROZEN_HOLDS['RUNREADY.on']`: `TPS_RUNREADY=1`); the journal carries the table and a
  recording from before it replays the fist. CHECK: `probes.ts runready` (family player; `tools/qa/runready-check.ts`; `RUNREADY_BREAK=1` fails
  `hands`), both stands, the lobby, one seed: over a second of the sprint the hands are at most 11 cm apart (91 with the key down), the gun hand 96
  to 109 cm up and 38 to 39 cm ahead of him (it travelled 58 cm fore and aft as a fist), the muzzle at least 49° down; beside it the rifle's sprint
  reads 105 to 119 cm, 33 to 34 cm, 41° (the frozen stand's numbers). ON THE PAGE'S STAND the same run passes a thing inside the gun's reach: for 8 of
  the 60 frames the low ready is the wall rule's own (12 with the key down, so it is not this rule's doing), the hands stay together through them
  (the gun hand 94 to 109 cm up, 38 to 42 cm ahead, the muzzle at least 45° down), and the check counts those frames apart (`gunWallIs`) and wants
  no other stance written. Half a second after Shift is let go the carry is back. LOOK AT IT: `pose-strip.ts sprint-pistol |
  sprint-pistol-old | sprint-rifle` (capsules), `pose-mesh.ts operator_1 sprint-pistol --inhand --at <secs>` (the worn mesh; `sprint-pistol-old` =
  before). NOT TOUCHED: gunhand.ts / inhand.ts (how a gun sits in a hand) and the creep's arms. NOT SEEN, NOT PLAYED: never on a GPU or in the
  page; the numbers are first numbers off the capsule strips and CPU-skinned stills; the way into the sprint and out of it was looked at as a capsule strip only
  (`pose-strip.ts sprint-pistol-turns`: the hands are together inside 0.3 s, a little apart on the way); a sprint into a door's shoulder and a throw out of a sprint were not looked at with it on.
