// WHOLE PLAY-THROUGHS WITH A WATCHER — every scenario on the start card played from its staging to its end by a scripted player who is ON THE FLOOR (Sam on his
// own feet: keys along the nav grid's path, the team told to fall in behind him, each held room taken through the order menu's own calls), while a watcher
// looks at every teammate every frame for the things a competent operator would not be seen doing. The tallies (roomclear-tally, bang-tally, rescue-tally)
// answer 'who wins'; this answers 'does anybody get stuck, stand in a doorway, point his gun at a friend, stare at a wall, or leave an order hanging'.
//   bun run tools/qa/playthrough.ts [--scn id,id] [--seeds 1-6] [--cap 300] [--jobs 4] [--json out.json] [--md]
//   bun run tools/qa/playthrough.ts --trace <scenario id>:<seed>      one run in this process with its timeline (orders, door-tool beats, smells as they happen)
//   PT_SAMEFLOOR=1 (env)                   a room clear's seeds all play the one floor the row stands (its own flag, no placement pinned by the seed): what the page
//                                          deals every try under SAMESTART — run it through ships.ts (the page's stand) to have that switch on
//   PT_FIGHT=34-36.5 (env, with --trace)   the room fight's own state for every teammate at 10 Hz over that stretch of the run: target, the man he is turning
//                                          to look for, track, the beat before he may fire, what each of his eyes' meters reads (with the eye test's own word on a man unseen: no line / out of cone /
//                                          dazzled — the eye's alone, a man the fight itself has blind or folded reads as with his eyes open) — and every enemy within 10 m
//   PT_COVER=1 (env, with --trace)         the unasked cover's deal once a second: who watches which opening
//   PT_NOTES=1 (env, with --trace)         the room fight's own notes as they are made (who has eyes on whom, who steps where, what each defender hears and does), and tactics.ts's log (plans, the doorway drill)
//   PT_HUNT=first (env)                    room clears: once no room is held the commander goes for whoever is left BEFORE he walks the rooms again (the default walks
//                                          every room first; the missions gate plays with this on — missions-gate.ts's head)
//   PT_DIGEST=1 (env)                      every run's RunOut carries `digest`: game/digest.ts's digest of the whole game every half second, folded into one word
//   PT_DIGEST=series (env)                 …and `digestSeries`: the movement digest (nobody's speech bubble in it) of every half second, one word each, unfolded —
//                                          two arms of one seed set side by side give the half second they first part at; PT_DIGEST_AT=n then keeps the n-th
//                                          half second's digest whole (`digestAt`), to name the fields that differ there
//   PT_DIGEST_FRAMES=a-b[:f] (env)         the movement digest of EVERY frame from a to b (frame = run seconds × 60), one word each, in `digestFrames` — with PT_CUT=1 each
//                                          beside the break counters as they stood — and frame f's digest whole (`digestFrameAt`): the frame two arms part at, and what parts
//   PT_TOOL=threshold (env)                the commander works every held room FROM THE THRESHOLD (doortools.ts kind 'threshold', given by doorTools.order as a
//                                          scenario would) instead of banging / opening it; refused on a door, he falls back to the tools above. The two
//                                          rescues' hostage room is worked that way too, in place of their F (the scenario's own order: doorTools.order on the
//                                          corridor door). Each death in the JSON carries `door`: the door order's phase
//   PT_TOOL=hold (env)                     the same rooms worked from the threshold AND HELD until told (order (b): thresholdHold), the commander giving the
//                                          follow-up a player would: once the lead says the door is quiet he takes PT_REACT seconds (1) and says 'bang, then
//                                          step in' when a blind pocket's worth of the room's floor is still unseen (DOORTOOLS.thrPocket cells by the
//                                          stage's own count — what the fog shows dark), 'step in' when not, or when the bang is refused
//                                          (PT_TELL=step | bang: he says that one whatever is left unseen)
//   THE NUMBERS (every run's JSON, whatever the tool — the Tally below): `entries` = one row per door order (tool, seconds from the order to its end and to
//                                          the first man across the frame, teammates of it lost, their men dropped while it ran from outside / from inside
//                                          the room, cans that went off, and how much of the room's floor no lit muzzle had been across from outside and no
//                                          burst had lit when the first man crossed — with how many of their men stood on that floor); `kills` = every
//                                          defender's death with where his killer stood (outside the room he was in · inside it · he was out on open
//                                          floor); `losses` = every teammate's death against the last door order he was given (at the door before anyone
//                                          was across · going in and the ten seconds after · later); `bangs` = cans spent; `hostages` = [alive, of] in a
//                                          rescue. tools/qa/threshold-tally.ts makes the tables
//   PT_RESCUE=split (env)                  rescues with a side door: the commander walks the team into the room the side door is taken from and presses F
//                                          there — both doors on one word (rescue.ts pick()); absent = F at the main door, as ever
//   PT_RESCUE=side (env)                   …the same walk, then the WHOLE squad through the side door with a door tool by the order menu (PT_SIDETOOL,
//                                          'openClear'), no F: where each man stands when the entry is over, and PT_SIDEWAIT (20) s on, is said in the trace
//                                          (a LOOK, not a play: nothing more is ordered, so the run ends 'stalled' unless the scenario ends by itself)
//   PT_TECH=cue (env)                      rescues: the commander acts on what their net says (Hard's rescue crew, rescue.ts): a gun called on the hostage door
//                                          from a side room → that room is cleared first, by its other door; a man called 'staying dark' → one man is left covering the door
//                                          he is by (not when both are said: clearing that room takes every man, and the hostage room after it both). Standard (nothing said): the usual entry, four seconds late
//   PT_SQUAD=3 (env)                       the loadout's squad size (game/loadout.ts, the page's ?squad=N: 0‥4) over each scenario's own — the commander orders
//                                          whoever came (alone, 0, he has nobody to send: such a run stalls by design)
//   PT_WAIT=15 (env)                       room scenarios: the commander waits that many seconds, gathered, before going on to each next held room
//   PT_HURRY=1 (env)                       room scenarios: no walk in and no gathering after an entry — the next door is stacked on as soon as the last ends
//   PT_CUT=1 (env)                         every run's JSON carries `cut` (the cut pieces' long-run check): the second each kind of break FIRST happened (a wall cell or
//                                          port, a pane's piece, a piece into the debris pool, a shaped / ragged / loose cut piece, a cut glass plate) and the break
//                                          table's and the shards' counters at the end — set beside PT_DIGEST=series of two arms (CUTBOXES=1 | 0) it says whether the
//                                          half second they first part at comes after a break. A bystander: it reads counters only
//   PT_DESTR=1 (env)                       THE ONE SWITCH of the destruction goal raised (unset: the one build by digest); under it PT_WALLREACT=0 / PT_COVERFIRE=0 /
//                                          PT_WALLCHARGE=0 drop one piece each (all three: the engine's own build by digest), and every run's JSON carries `destr`
//                                          (the chaos lane's counts — puffs, tiles, lights out, the debris pool, PT_DUST's dust — and tools/qa/hole-watch.ts's: what broke, who walked through it, who was shot through it)
//   PT_KICK=1 (env, with PT_DESTR=1)       men kick rubble aside as they walk (game/debris.ts feet): every run's JSON carries `rubble` (the feet's counts beside
//                                          the pool's). Unset = off: the build before it, by digest
//   PT_POP=1 (env, with CUTBOXES=1)        a spawn over the debris cap takes the SMALLEST resting piece, which goes as chips by its size (game/breakTable.ts
//                                          pick / dissolve). Unset = off: the oldest piece and the fixed ball of chips, the build before it by digest
//   PT_WALL=1 (env, with PT_DESTR=1)       room scenarios: a held room is taken by a WALL CHARGE where a partition of it allows (wallcharge-commander.ts), else by its door
//   PT_WEDGED=charge (env)                 room scenarios: a door the stack finds wedged from inside (digin.ts) gets a breaching charge, blown once set, not the boot
//   PT_FRAG=1 (env)                        room scenarios: 'frag and clear' (doortools.ts fragClear) on a held room's door while the squad has a frag, then the usual tool
//   PT_ROUTE=s34,n_end,n4b (env)          room clear: the commander's doors in that order while their rooms are still held, then the nearest as ever
//   PT_HALL=bare (env)                    a level with a room 'hall' (levels/hall.json): before the rooms the first teammate is walked down the line of the hall's own
//                                         door in bounds, the others told onto the line behind him. (`file` and `low` were the same walk led by a ballistic shield:
//                                         the shield is gone from the game and both words are refused, saying so.) PT_HALL_FIRST / _BOUND / _GAP / _SHORT / _HOLD = its numbers (hallLead)
//   PT_SNATCH=cover|front (env)           a snatch level (game/snatch.ts): cover = the blue pair posted PT_SNATCH_BACK (4.5) m short of the man's nearest way out
//                                          before anything loud (PT_SNATCH_VIA=x,z: by that point first), the rooms worked with red; front (or unset) = everybody in the front. The run's JSON carries `snatch`
//   PT_FIRST=shop (env)                   room clear: the commander's first room is that one of the structure (its id) instead of the nearest held room
//   PT_LISTEN=1 (env)                     room clear, defender squads: a commander who HEARS 'in position — we have the door!' — for 60 s after a man of a pair sent
//                                          round is set on a door (read off the squads' timeline; =N for N s) he does not take the team through that door
//                                          while a held room has any other. Off = the commander is deaf to it, as he always was
//   PT_DOOR=breakroom_n (env)             room scenarios: the commander picks his entry — a held room that has a door of that name is taken by that door, not its nearest
//   PT_GUNWALL=1 (env)                    every run's JSON carries `gunwall` (tools/qa/gunwall-watch.ts): every spell a weapon in a man's hands stood in or through a static or a
//                                         door leaf (the flaw src/game/gunwall.ts mends), by carriage and by side, and how often that rule brought a gun down. A bystander
//   PT_FOGFIRE=1 (env)                    every run's JSON carries `fogfire` (tools/qa/fogfire-watch.ts): under the fog of war, the aimed rounds teammates fired, how many
//                                         at a man the fog's eyes did not have that frame, how many at a man NOT IN THE PICTURE (the flaw fogofwar.ts FOG.squadFire mends) and why. A bystander
//   PT_LIGHTWALL=1 (env)                  every run's JSON carries `lightwall` (tools/qa/lightwall-watch.ts): every spell a burning weapon light stood beyond a static or a
//                                         door leaf from its carrier's gun shoulder (the flaw lighting.ts LIGHTWALL mends), and how often that rule pulled a light back. A bystander
//   PT_PATHS=1 | rec (env)                every run's JSON carries `paths` (tools/qa/paths-watch.ts): every spell a man of a room entry spent in a door leaf (or a leaf
//                                         swept through him), with his rifle or his burning weapon light through one, through a friend or in a static, and every
//                                         crossing of the entry's frame line with its gap to the man before; `rec` adds the men's places and the leaves' angles at
//                                         20 Hz (tools/qa/entry-strip.ts draws them). A bystander. PT_NOCLOSER=1: no door shuts itself (every leaf stays as left).
//   PT_WAYS=1 (env)                       every run's JSON carries `ways` (tools/qa/ways-watch.ts): every doorway a teammate walked through that was not the door of
//                                          his order ('otherDoor': into the ordered room by another door) or led into a room nobody of the team had stood in
//                                          ('uncleared'); with --trace each as it happens
//   PT_SEND=1 (env, with PT_SEARCH)       the searching commander SENDS his men onto a named place (their net's word, its marker) from a few metres short and
//                                          follows, instead of walking there with his file behind him. Off = the commander of every tally made before it
//   PT_LINE=1 (env)                       every run's JSON carries `line` (tools/qa/line-watch.ts): every stretch a teammate with a man to shoot had a friend in
//                                          his line of fire — who the friend was (Sam, a mate), what each was doing, what the game did about it, what it cost
//                                          him — and the run's man-seconds up / engaged / blocked; with --trace each stretch as it closes. tools/qa/line-tally.ts makes the tables
//   PT_DIRECT=1 (env)                     room scenarios: a commander who orders the way a player often does — NO fall in and NO stack order between rooms: he
//                                          walks to the next door by himself and gives the door tool from there, the men coming from wherever the last room
//                                          left them (on their sectors, at its far doors)
//   PT_BREAKER=order|sam (env)            room scenarios on a level with a mains breaker: before the first room the commander walks to PT_BREAKER_FROM
//                                          ("x,z"; default: two metres short of the breaker) with the team fallen in and has the mains cut — `order` = the
//                                          squad's own 'work' order on the breaker, `sam` = his own hand on it (the row's effect) — then goes on. PT_NV=1:
//                                          his goggles go down as the lights go (the team then stays dark when it is loud: nvg.ts). The run's JSON carries
//                                          `breaker` = [seconds, 'out' | 'on'] for every change of the mains.
//   PT_NOISE=1 (env)                      surprise lost before the first door: one loud round's report where the team starts (a hearing event, no round)
//   PT_PAUSE=15 (env)                     a slow team: the commander stands that many seconds more in each room just taken before he goes on (0)
//   PT_SIT=20 (env)                       the other slow team: it sits that many seconds on its sectors in each room just taken BEFORE the fall-in (0)
//   PT_STACKWAIT=1 (env)                   the commander waits that many seconds more after each stack order's wait before he gives the door order (0): a rule
//                                          that forms the stack sooner also sends it in sooner — this takes the second back, to tell the rule from the clock.
//                                          Rooms scenarios only (a rescue's stack forms inside its door op); the SAME wait at every door, so it evens the
//                                          clock only where the rule saves that much (the depot's first door: 1.00 s in every seed); filed as `stackWait`
//   PT_EXTRA=8 (env)                       that many MORE enemies than the scenario stages, stood by game/stress.ts (the page's ?extra=N) through tools/qa/uncapped.ts —
//                                          past the sixteen characters a renderer could draw; the run's `note` says how many stood (tools/qa/enemy-ceiling.ts has the tables)
//   PT_TIMES=1 (env)                       every run's JSON carries `frameMs`: what a frame of the run cost (W.step: Game.update + the CPU uploads, the box list every 4th frame),
//                                          mean / p50 / p95 / p99 / max in ms, and `byAlive`: frames and mean ms against how many enemies were up that frame
//   PT_SAY=1 (env)                         every run's JSON carries `said` (tools/qa/say-watch.ts): every line a guard says with its call site and what became of it on the
//                                          player's side (bubble / radio strip / neither, the fog of war asked), every defender decision the fight's modules note, state changes
//   PT_METER=sky (env)                    the light meter answered AS THE PAGE'S WOULD for direct light (tools/qa/hour-lib.ts installSkyMeter): the harness's own
//                                          estimate leaves the moon, a sun and lightning out; the page's meter counts them. Off = the harness as it always was
//   PT_MORTAL=1 (env)                      Sam can be seen and hurt (no god mode, his light meter at PT_LIT, 0.5): a player who dies ends the room clear 'wiped' (and the
//                                          rescue 'lost'; the night breach has no end for it and runs to the cap) — for PT_AFTER
//   PT_AFTER=90 (env, with PT_SAY)         the game stepped that many seconds past the run's end with nobody at the keys, a row a second per living defender in `said.after`;
//                                          the run's seconds and who was up are the end's, but the game's own counters (cover, tools, squads, dig-in) then include those seconds
//   PT_TWITCH=1 (env)                      each twitch line carries the cover's last deals for that man (why his gun went back and forth)
//   PT_AIM=9-12[:Red_One] (env, with --trace)   whose each teammate's gun is at 20 Hz over that stretch: his order (* on his mark, 'spare' = rear security), the door
//                                          order's phase, the cover's job, where his script points it and whether that is the cover's point or the order's own watch
//   PT_SEARCH=1 (env)                      room scenarios: A COMMANDER WHO HAS TO SEARCH (playSearch below). The scripted commander knows where every defender is (heldRooms
//                                          reads the room fight's own model, and the tail of playRooms walks straight to each living man); a player under the fog of
//                                          war does not. This one knows only what a player's screen and ears give him — the HUD's room ticks and 'held again' (the room
//                                          clear's own bookkeeping), the men in the picture (fogofwar.ts seen: the team's shared sight), hostile gunfire inside earshot,
//                                          and the rows DRAWN on the radio strip that name a room (dialogue.ts placeName's words) — and otherwise he works the rooms the
//                                          HUD still shows held that he has not been in, then sweeps the floor nobody of the team has had eyes on this last minute.
//                                          Off (the default) = the commander as he always was, run for run (PT_DIGEST agrees). The JSON carries `search`: his moves
//   THE ENDGAME (every run's JSON: `endgame`, EndWatch below — a bystander, the digest is the same with it): the second their side was down to three, two, one
//                                          and the end; each of the last three / two as the clock starts (his own room, another room, open floor; hold / move /
//                                          free; set on a wedged door; in the team's sight), and after: metres walked, when the team first had eyes on him, where
//                                          he dropped. tools/qa/endgame-tally.ts makes the tables
//   PT_GLASS=1 (env, with --trace)         every pane a round goes through as it happens (glasspen.ts GLASSPEN_HOOKS.crossed): pane, type, whose round, energy in → out
//   --set '{"PACE":{"max":1.8}}'    any knob table by name with these rows over it (src/game/knobs.ts knobRegistry: the feel tables FLASH PACE LIGHTS NVG IR FOG LASER DOORTOOLS ROOMFIGHT ORDERS COVER ENTRY REAR …, RESCUE, the defenders' tables, the door switches …; a row of a table the stand-up pins is put again after it; OPENING is refused — TPS_OPENING=1)
//   exit 0 = every run ended by the scenario's own rules with no exception · 1 = a run threw or stalled · 2 = unknown flag / scenario (nothing run)
//   (the SMELLS are counted and listed, never a verdict by themselves: each is a place to look, with the scenario, seed and second to trace it at)
//
// THE SCRIPTED PLAYER (a test driver, nothing in the game): 'fall in', walk to a few metres short of the nearest entry of the nearest room that is still held,
// off the line of its opening; 'stack up' on that door; 'bang and clear' while the squad has a can, else 'open and clear'; wait for the door tools to call the
// entry over; walk in himself; next room. The rescue: fall in, walk the corridor to a post short of the hostage room, F, walk in when it is secured. Sam is in
// god mode, never fires and is NOT SEEN (his light meter pinned dark, as the tallies pin it: a player who cannot be hurt and is seen would draw every round
// off the team, which is what is under test) — but he is heard, and his body is in the way, as a player's is.
// HE STEPS OUT OF HIS MEN'S FIRE: whenever he stands in the line between a teammate and the man that teammate is on, he side-steps 1.3 m off it (offLine) and
// then goes on. A commander who never fires and is never shot at, standing in a doorway face to face with a hostile, made every teammate behind him hold his
// fire and die: it measured the driver, not the team. PT_STAND=1 puts that statue back (every table made before the change was made with him).
// HE SHUTS AN OPEN LEAF HE IS WEDGED ON: where a walk was about to be given up ('Sam is stuck') against an open door leaf standing across his way — the nav grid
// knows no leaves — he pulls it to with its own row and walks on, once a walk (shutLeaf; the run's JSON lists them under `leaves`). A booted door stood into a
// walkway used to end the run on the time cap. PT_NOLEAF=1 = the commander who gave up there (tables made before it; a run where he never got that far is the same).
//
// THE SMELLS (per living teammate, per frame):
//   stuck      under an order with a mark he is not on, not in a fight, not blinded — and he has not covered 0.25 m in 4 s
//   hung       the same order unarrived for 45 s (he may be moving: a walk that never ends)
//   overlap    two of the team (Sam counts) inside 0.3 m of each other for 0.75 s
//   doorway    standing still for 4 s inside a door's opening with no door tool working that door and no fight
//   flag       gun up (not lowered by the muzzle discipline), and a friend (Sam counts) inside 5 m in plain view within 0.3 m of the muzzle's line, for 1.5 s
//   wall       on his mark with his chest squarely on a wall under 0.7 m away for 6 s (holding / following: looking at nothing)
//   snap       his aim jumps more than 60° inside a tenth of a second (a gun and a weapon light that teleport instead of travelling; an ordered gun
//              travels at PACE.turn 8 rad/s = 46° in a tenth, a little more with his body turning under it — over 60° is a jump, or a man onto a threat)
//   twitch     his aim swings back and forth: four reversals inside 2 s, each swing 15° or more (a man flicking between two things). The line says whether
//              he was on REAR SECURITY and whose his gun was over the 3 s before ('gun: order@-2.1 → cover:rear:Red One@-1.8 → order@-1.5 …')
//   behind     under 'fall in', more than 9 m from Sam for 12 s with no fight
//   block      Sam walking and not getting anywhere for 1.5 s with a teammate inside 0.9 m of him (body-blocked)
//   unaware    a teammate killed by a man more than 75° off where his gun was pointing, while not blinded (shot in the side or the back)
//   friendly   a teammate, or a hostage, killed by one of the team (or by Sam)
// EVERY TEAMMATE'S DEATH is also kept with what he was doing (RunOut.deaths, in --json: his order, his target, whether he was on his killer, how far off his
// muzzle the killer stood, the beat he still owed, gun down for a friend, light, blind …) — the raw material for 'why do they die' tables.
// THE HARNESS HAS NO GPU: no light meter (what a man sees of another is guards.ts's direct-light estimate), no smoke sight lines, no picture, no feel.
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { pinned } from '../../src/host/profile.ts';
import { GLASSPEN_HOOKS, GLASSPEN } from '../../src/game/glasspen.ts';
import { GLASSBREAK } from '../../src/game/glassbreak.ts';
import { SHARDS } from '../../src/game/shards.ts';
import { GLASS } from '../../src/game/glass.ts';
import { HOUR, HOUR_IDS, hourIdOf } from '../../src/game/hours.ts';
import { doorCells, frameOf, canSeeChar } from '../../src/game/guards.ts';
import { pickHover } from '../../src/game/player.ts';
import { HOLDFIRE_STATS } from '../../src/game/holdfire.ts';
import { fragStepOff, FRAG_STATS, FRAG_WHY, FRAG_LOG, fragStatsReset } from '../../src/game/frag.ts';
import { CONDITION_STATS } from '../../src/game/condition.ts';   // (the JSON's `condition`: how many men a blast left hurt this run)
import { DESTRUCTION, FURNBLAST, RUBBLE, EVICT } from '../../src/game/destructionSwitch.ts';
import { WALLREACT, WALLREACT_STATS, wallReactOf } from '../../src/game/wallreact.ts';
import { REARWATCH_STATS, rearWatchLog, rearWatchRows } from '../../src/game/rearwatch.ts';
import { PICTURE_STATS } from '../../src/game/picture.ts';
if (import.meta.main && pinned('PT_DESTR')) DESTRUCTION.on = process.env.PT_DESTR === '1';   // THE ONE SWITCH of the destruction goal: OPT IN (PT_DESTR=1), and only when this file is the program — a tool that imports play() or spawns this file keeps the one build by digest
WALLREACT.on = process.env.PT_WALLREACT !== '0';   // both sides reacting to what breaks (game/wallreact.ts): PT_WALLREACT=0 = the destruction engine's own build by digest
const { COVERFIRE, coverfireReport } = await import(`${ROOT}/src/game/coverfire.ts`); COVERFIRE.on = process.env.PT_COVERFIRE !== '0'; if (process.env.PT_COVERFIRE === 'callwalls') COVERFIRE.callWalls = true;   // aimed fire at breakable cover (coverfire.ts): its own switch, PT_COVERFIRE=0 = the destruction engine's build by digest · =callwalls: a mate's call is good for a partition too
if (process.env.PT_WALLCHARGE === '0') (await import(`${ROOT}/src/game/wallcharge.ts`)).WALLCHARGE.on = false;   // the wall charge's own switch (wallcharge.ts): PT_WALLCHARGE=0 = its rows not registered — with PT_WALLREACT=0 and PT_COVERFIRE=0 beside it, the destruction engine's own build by digest
import { HandleWatch } from './handle-watch.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
// A MAP WITH NO ROW YET: `--scn <name>.json` plays levels/<name>.json's room clear with the four exactly as its row in the table would (tools/qa/map-check.ts
// runs a new map this way before the row is pasted in). A listed id is its row, as ever.
export const entryOf = (id: string): any => SCENARIOS.find((e: any) => e.id === id) ?? (/^[\w-]+\.json$/.test(id) && existsSync(resolve(ROOT, 'levels', id)) ? { id, title: id, kind: 'roomclear', squad: 4, level: id, blurb: '' } : undefined);
const NO_SCN = (id: string) => `no scenario '${id}' — ${SCENARIOS.map((e: any) => e.id).join(', ')} (or <name>.json = levels/<name>.json's room clear with the four)`;
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
// DESTRUCTION (src/game/destructionSwitch.ts): PT_DESTR=1 plays the build the PAGE plays — the switch on; without it a playthrough is the one build
// before the destruction goal, by digest (chaos.md), so every tally and frozen digest made before it measures what it measured. Only when this file is the program
// (the runner and its --one children inherit the env): a probe importing `play` keeps whatever its process set. PT_DUST=1 also gives the harness the CPU dust stand-in (tools/qa/dust-standin.ts: a MODEL of what the dust does to sight lines; off, no dust is seen through).
const { DESTR_STATS } = await import(`${ROOT}/src/game/destruction.ts`);
const { GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
// PT_CUT=1: the first second of each kind of break, read off the lanes' own counters once a frame (cutWatch below; a bystander)
const DIGF = (w => w && w.length >= 2 && w.every(Number.isFinite) ? w : null)(process.env.PT_DIGEST_FRAMES ? process.env.PT_DIGEST_FRAMES.split(/[-:]/).map(Number) : null);
const CUTW = process.env.PT_CUT === '1' ? { B: (await import(`${ROOT}/src/game/breakTable.ts`)).BREAK_STATS, S: (await import(`${ROOT}/src/game/shards.ts`)).SHARD_STATS, W: (await import(`${ROOT}/src/game/wallbreak.ts`)).WALL_STATS, E: (await import(`${ROOT}/src/game/edgeLook.ts`)).EDGE_STATS, on: (await import(`${ROOT}/src/scene/cut.ts`)).cutBoxesOn } : null;
/** what counts as each kind of break having happened, off the counters (all 0 at a run's start: a run is its own process) */
function cutCounts(g: any): Record<string, number> { const { B, S, W, E } = CUTW!; return {
  wall: W.ports + W.holes + W.coverCells + W.coverDead + W.blasts + W.falls + W.chunks + W.chunksDemoted,   // a wall or a piece of cover gave
  glass: GB_STATS.shards + GB_STATS.dropped + GB_STATS.diced + GB_STATS.sheets,                            // a pane lost a piece
  pool: g.destr?.debris?.stats?.spawned ?? 0,                                                              // a rigid piece entered the debris pool (whatever threw it)
  dress: E.decor + E.rubble + E.flying,                                                                    // a blown wall was dressed (edge plates, rubble)
  cutPiece: B.shaped + B.ragged + B.heap + B.kinked + B.loose + B.dressed + B.again + B.crumbled + B.chips, // the break table did anything (only under the cut switch)
  cutPlate: S.cutPlates + S.cutSplit + S.cutDropped,                                                       // a glass plate was cut (only under the cut switch)
}; }
if (import.meta.main && pinned('PT_KICK')) RUBBLE.on = process.env.PT_KICK === '1';   // PT_KICK=1 (with PT_DESTR=1): men kick rubble aside (game/debris.ts feet, the page's default; =0 its ?nokickrubble) — unset on the frozen stand: off, the base by digest
if (import.meta.main && pinned('PT_POP')) EVICT.on = process.env.PT_POP === '1';   // PT_POP=1 (with CUTBOXES=1): a spawn over the debris cap takes the SMALLEST resting piece, which goes as chips by its size (game/breakTable.ts pick / dissolve, the page's default; =0 its ?nopopfix) — unset on the frozen stand: off, the base by digest
if (process.env.PT_FURN === '0') FURNBLAST.on = false;   // PT_FURN=0 (with PT_DESTR=1): charges leave the furniture standing (the page's ?nofurnblast) — the A/B of game/furnblast.ts
if (process.env.PT_STUNLIGHTS === 'old') { const L = (await import(`${ROOT}/src/game/destruction.ts`)).CHAOS.loud; L.stunFixtureM = L.fixtureBlastM; L.stunPanels = true; }   // PT_STUNLIGHTS=old: a stun charge puts the lights out like a blast again (destruction.ts CHAOS.loud.stunFixtureM / stunPanels at their old values) — the build before that rule, by digest
const { installDustStandin } = await import('./dust-standin.ts');
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { feelTables } = await import(`${ROOT}/src/game/teamfeel.ts`);
const { openFloor } = await import(`${ROOT}/src/game/doortools.ts`);
const { knobRegistry, knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);   // THE list of knob tables: what --set reaches and what a run puts back
const { DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);   // (doors stay where they are left: --set '{"DOORSTAY":{"on":false}}' = every leaf with its closer, as before the switch)
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { RESCUEEND } = await import(`${ROOT}/src/game/rescueend.ts`);
const { DIGIN, DIGIN_STATS, DIGIN_LOG, DIGIN_SHUT, digInSet } = await import(`${ROOT}/src/game/digin.ts`);
const { PRESSURE, pressureStats } = await import(`${ROOT}/src/game/pressure.ts`);
const { DRILLED } = await import(`${ROOT}/src/game/roomfight.ts`);
const { HARD, HARD_AT, LEVERS, setDifficulty, setLever, leversMixed, leversLine, difficultyNow } = await import(`${ROOT}/src/game/difficulty.ts`);
const { WX_SIM } = await import(`${ROOT}/src/game/weather.ts`);   // --set '{"WX_SIM":{"loudDry":false}}' = rain blurs where gunfire is placed again (the weather build's first cut)
const { WEATHER_BOOT, isWeatherKind } = await import(`${ROOT}/src/game/weatherKinds.ts`);   // --set '{"WEATHER":{"kind":"fog"}}' = the run started in that weather (the page's ?weather=)
const { SQUADS, DRILL_AT = {}, squadsReport } = await import(`${ROOT}/src/game/enemysquads.ts`);   // (DRILL_AT: absent in an older checkout)
const { CUES } = await import(`${ROOT}/src/game/cues.ts`);
const { BUDDY, buddyStats } = await import(`${ROOT}/src/game/buddy.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
// (the last defenders' switches: a build without the file is a build without them. Set by LASTSTAND=regroup,callout in the environment, or --set '{"LASTSTAND":{"regroup":true}}')
const LASTM: any = await import(`${ROOT}/src/game/laststand.ts`).catch(() => null);
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);   // (a blast takes a door off its hinges: --set '{"DOORBLAST":{"on":false}}' = a charge flings the leaf in on its hinge, as before)
const { HANDLE, HANDLE_STATS, HANDLE_DEBUG } = await import(`${ROOT}/src/game/handleside.ts`);
// (a friend in a teammate's line of fire, game/clearline.ts: the same. CLEARLINE=1 in the environment, or --set '{"CLEARLINE":{"on":true}}')
const CLM: any = await import(`${ROOT}/src/game/clearline.ts`).catch(() => null);
const NVGM = await import(`${ROOT}/src/game/nvg.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { WOUND, WOUND_STATS, resetWoundStats } = await import(`${ROOT}/src/game/wounds.ts`);   // TPS_WOUNDS=1 (env): wounds on (src/game/wounds.ts) — every run's JSON then carries `wounds`: who ended the run down wounded rather than dead, per side, and where the rounds landed
const { hashStr, placeRects } = await import(`${ROOT}/src/game/dialogue.ts`);
const { TACTICS_STATS, TACTICS_DEBUG } = await import(`${ROOT}/src/game/tactics.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync((f => existsSync(f) ? f : resolve(ROOT, 'levels', file))(resolve(ROOT, 'levels', lookLevelFile(file))), 'utf8'));   // (scene/look.ts: under TPS_LOOK=1 a level's file in the default look — the same boxes in other paint)
  return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
async function quiet<T>(on: boolean, fn: () => T | Promise<T>): Promise<T> { if (!on) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }

export const SMELLS = ['stuck', 'hung', 'overlap', 'doorway', 'flag', 'wall', 'snap', 'twitch', 'behind', 'block', 'unaware', 'friendly', 'wrongway'] as const;   // ('wrongway': something stood a door open on the side it does not open into and doors.ts turned it round — Door.mirrored; no opener does)
export type SmellKind = typeof SMELLS[number];
export interface Smell { kind: SmellKind; t: number; who: string; at: string; detail: string }
export interface RunOut { /** taken rooms' other doors (Watcher.otherStats): entries that ended 'in' · their rooms' other doors nobody of the squad had been beyond · how many of those had a teammate's gun on them a second after the entry ended · how many the entry's own rule had dealt a man (doortools.ts otherDoorM) */ other?: { rooms: number; doors: number; watched: number; dealt: number }; wounds?: { team: number; hostiles: number; zones: Record<string, number>; again: number; finished: number }; /** PT_HOUR: the hour the run was stood up at (src/game/hours.ts) — absent = the level's own night */ hour?: string; digin?: Record<string, number>; /** game/difficulty.ts's reading of the tables the run was played on */ difficulty?: string; scn: string; seed: number; end: string; why: string; t: number; team: number; of: number; hostiles: number; hostilesOf: number; orders: number; refused: string[]; smells: Smell[]; rooms: number; thr?: number; note: string; deaths?: Death[];
  /** entrypoints.ts's tallies for the run: points dealt to men by an entry or its search, how many of them stood by an uncleared opening, moved off one, kept for want of floor */
  entry?: { pods: number; risky: number; moved: number; kept: number };
  /** PT_DIGEST=1: the game's own digest (game/digest.ts) every half second of the run, folded into one word — two builds that play a run the same agree on it */
  digest?: string; digestMove?: string; /** PT_DIGEST=series: the movement digest of every half second, unfolded · PT_DIGEST_AT=n: the n-th of them whole */ digestSeries?: string[]; digestAt?: unknown;
  /** THE NUMBERS (Tally): a row per door order · every defender's death, with where his killer stood · cans spent of the kit · a rescue's hostages [alive, of] ·
   *  PT_TOOL=hold: what the commander told each held door */
  entries?: EntryOut[]; kills?: KillOut[]; losses?: LossOut[]; bangs?: number; hostages?: [number, number]; told?: string[];
  /** a rescue: the captor's clock — `t0` the second it started, `secs` the length dealt at this staging, `log` the scenario's own notes of it (step:*, act,
   *  act:broken, act:blocked, executed:<who>, secured …) with their seconds: WHEN a hostage is shot, and whether the round was ever stopped */
  clock?: { t0: number; secs: number; log: [number, string][] };
  /** the unasked cover's own counts over the run (game/cover.ts Cover.stats: deals, takes, blind — man-deals dealt an open door with no line through it —, steps …) */
  cover?: Record<string, number>;
  /** game/coverfire.ts's report of the run: chews, rounds on them, what gave, rounds on pieces that never gave, the wall engine's own counts (wall_*) */
  coverfire?: Record<string, number>;
  /** game/cues.ts: the radio strip's tallies of the run (lines handed over, drawn, held back and why, the new lines by kind; with PT_SAY every row) */
  cues?: Record<string, unknown>;
  /** the door tools' own counts over the run (game/doortools.ts stats — among them DOORTOOLS.buddy's: sentOn, sentAlone, doorAlone, sentPair, notSent) */
  tools?: Record<string, number>;
  /** game/pressure.ts's counts of the run (zeros with its switch off), the stock room fight's rally / fall-back counts beside them */
  pressure?: Record<string, number>;
  /** game/buddy.ts's counts of the run (absent with its switch off): calls, answered, arrived, metOnWay, turnedBack, diedOnWay, short, noOne, secs, metres */
  buddy?: Record<string, number>;
  /** game/enemysquads.ts: every squad's timeline of the run (absent on a level with no squads, or with SQUADS.on off) */
  squads?: { id: string; name: string; men: number; up: number; state: string; out: number; events: { t: number; what: string; n: number; why: string }[] }[];
  /** WHAT THE DEFENDERS DID (DefWatch below): a row per defender, and the run's own facts about them */
  defs?: DefOut[]; def?: DefRun;
  /** OFF ALONE (AloneWatch below): a row per stretch a teammate spent away from every living friend · the man-seconds the team was up, and of them alone */
  alone?: AloneOut[]; upSecs?: number; aloneSecs?: number;
  /** every door the AI opened and where its opener stood (tools/qa/handle-watch.ts) */
  handle?: import('./handle-watch.ts').HandleOut;
  /** THE ENDGAME (EndWatch): see the head · PT_SEARCH=1: the searching commander's moves */
  endgame?: EndgameOut; search?: SearchOut; /** clearline.ts's counts, when its switch is on */ clearLine?: Record<string, number>;
  /** laststand.ts's own report, when one of its switches is on */ lastStand?: { on: string; stats: Record<string, number>; room: string | null; in: number; out: number; named: string[]; said: { t: number; who: string; kind: string; text: string }[] };
  /** PT_TIMES=1: the frame's cost over the run, ms (this machine's) — and against the count of enemies up that frame: [frames, mean ms] */
  frameMs?: { n: number; mean: number; p50: number; p95: number; p99: number; max: number; byAlive: Record<string, [number, number]> } }
/** one stretch of a teammate OFF ALONE: his nearest living friend (Sam counts) more than ALONE_M away BY THE WAY A MAN WALKS (the nav grid's path — a wall
 *  between two men is not company) for ALONE_SECS or more, ended when one is back inside ALONE_BACK, he drops or the run ends. `t` the second it began ·
 *  `secs` its length · `far` the farthest his nearest friend got · `was` his order when it began (playthrough's own words: 'fallIn', 'scripted', 'no order,
 *  alert' …), `going` the order's own note of its legs, `door` the door order's phase he was a man of, `fight` whether the room fight had him engaged ·
 *  `left` he was the one who walked (over a metre in the 3 s before it, and more than his nearest friend) — false = the group went and he stayed, or
 *  `lost`: a friend dropped in those 3 s (alone because his company died, not because anybody walked) · `walked` metres he covered in it · `up` teammates
 *  alive when it began · `died` it ended with him down. Sam down is nobody's company. `aloneSecs` = the reported stretches' seconds, summed */
export interface AloneOut { who: string; t: number; secs: number; far: number; was: string; going: string | null; door: string | null; fight: boolean; left: boolean; lost: boolean; walked: number; up: number; died: boolean; at: string; to: string }
export const ALONE_M = 8, ALONE_BACK = 6.5, ALONE_SECS = 3;
/** one defender over the run. `home` his room in the structure (a room clear; null elsewhere), `mark` where he was stood · `notes` the room fight's own lines
 *  about him that say he moved or stopped ([second, what]) · `far` the farthest he stood from his mark while up · `leftAt` the second he first stood outside
 *  his home room (elsewhere: 4 m off his mark) · `alertAt` the second the fight AI first had him alert · `kills` the teammates he dropped, with how far off his
 *  mark he stood, his mode in the room fight (hold · move · free = off his post on the hunt · none) and whether he was still at home · `dead` the same of his own end */
export interface DefOut { who: string; home: string | null; mark: [number, number]; notes: [number, string][]; far: number; leftAt: number | null; alertAt: number | null;
  kills: { t: number; who: string; fromMark: number; mode: string; home: boolean }[];
  dead: { t: number; at: [number, number]; fromMark: number; mode: string; home: boolean } | null }
/** the men of a room at the moment a door order on one of its doors is given ('order') and at its first man across ('cross'): each one's state, awareness,
 *  how many degrees his gun is off that door, how far he is off his mark and whether he is still in the room */
export interface DoorSnap { t: number; door: string; when: 'order' | 'cross'; men: { who: string; state: string; aw: number; off: number; fromMark: number; home: boolean; mode: string }[] }
/** `loudAt` the second of the first round, charge or boot (PT_NOISE's staged report is not counted) · `fight` roomfight.ts's own counts (rallied, fellBack, tookCover …) · `tactics` tactics.ts's
 *  (plans, flankers, loneHolds, dangers, gates …) · `rooms` the room clear's log (cleared:<room>, lost:<room> = a cleared room held again) · `doors` above */
export interface DefRun { loudAt: number | null; fight: Record<string, number>; tactics: Record<string, number>; rooms: [number, string][]; doors: DoorSnap[] }
/** One door order, start to end. `t0` the order · `cross` the first man over the frame line (null: nobody went in) · `t1` its end (null: still under way when
 *  the run ended) and `end` the door tools' own word for it · `men` it was given to, `lost` of them down by its end · their men dropped by its men
 *  (until they are given another door — running or ended): `out` the room's own before the killer had crossed the frame, `in` the room's own by a man already across, `open` anybody else's (KillOut.entry) · `bangs` that went off for it · `cells` of the room's floor (0: open floor, no model), `blind` of
 *  them that no lit muzzle had been across from outside and no burst had lit when the first man crossed, `blindMen` of theirs standing on that floor then ·
 *  `held` seconds on the jambs (a threshold) */
export interface EntryOut { door: string; tool: string; t0: number; cross: number | null; t1: number | null; end: string; men: number; lost: number; out: number; in: number; open: number; bangs: number; cells: number; blind: number; blindMen: number; held?: number;
  /** DOORTOOLS.thrLast took this order: the stack went without its last man · the hold was not held · both */
  last?: 'stack' | 'hold' | 'both';
  /** seconds from each man's own step over the frame line (or from the order going in, if he was already over it) to HIS first round, one per man of the
   *  order whose first round came inside ENTRY_SECS of that (a bystander's count off the hearing events: absent when nobody's did) — what a heavier gun costs
   *  is read here before it is read in who is left standing */
  shots?: number[] }
/** a defender's death. `where` — the split the tables use, a matter of where the two men STOOD (no door order's lifetime in it): 'outside' (he was in a room,
 *  or its doorway, and his killer was not in that room) · 'inside' (his killer was in it with him) · 'open' (he was on open floor: a corridor, a hall, a room
 *  too big to be one). `door`: the last door order his killer was a man of (still running or not), `phase` where it stood (null once it had ended) ·
 *  `entry`: 'before' — he was in the room that order is into (or within 3 m of its door: the stage's own 'down from outside' rule) and his killer had not
 *  crossed its frame · 'after' — the same, his killer across · null: a man of theirs somewhere else · `pre`: he was that room's and NOBODY of the order had
 *  crossed yet (the work done from the door, before the entry) */
export interface KillOut { t: number; who: string; by: string; where: 'outside' | 'inside' | 'open'; door: string | null; phase: string | null; entry: 'before' | 'after' | null; pre: boolean }
/** a teammate's death against the LAST door order he was a man of (still running or not — a threshold ends sooner after the crossing than a bang and clear,
 *  so a phase read off the live order would file the same death differently by tool): 'door' = that order under way with nobody across yet (the stack, the
 *  jambs, behind a bang) · 'entry' = from the first man across to ENTRY_SECS after it (going in, the first seconds in the room) · 'later' = any time after
 *  that, or after an order that never went in · 'none' = he had been given no door order. `since`: seconds from that first crossing (null: none) */
export interface LossOut { t: number; who: string; at: 'door' | 'entry' | 'later' | 'none'; door: string | null; tool: string | null; since: number | null }
/** a teammate's death, with what the room fight knew at that frame (for sorting losses by cause) */
export interface Death { t: number; who: string; by: string; d: number; off: number; order: string; /** the phase of the door order he was a man of when he dropped (doortools.ts Phase), null: none under way */ door: string | null; tgt: string | null; onKiller: boolean; meter: number; seenAge: number; track: number; readyIn: number; muzzleDown: boolean; light: boolean; killerLit: number; blind: boolean; /** his killer was still dazzled (could not see) when he dropped: a blind round */ kBlind?: boolean; held: number; los: boolean; moving: number; kOff: number; nUp: number; nFoes: number;
  /** entrypoints.ts: the opening nobody of the squad had been beyond that he stood within ENTRY.nearM and in the line of when he dropped (a door, or a gap of the nav grid — counted here whatever ENTRY.gaps says), null: none · his killer stood on its far side · he was on the mark his order gave him */
  open: string | null; beyond: boolean; onMark: boolean;
  /** … the same question asked of the KILL, wherever the dead man stood: the opening the round crossed whose far side (the killer's) nobody of the squad had been on, null: none ·
   *  the opening the killer himself walked through in the `cameAgo` seconds before (≤ 8), from a side nobody of the squad had been on, null: none */
  thru: string | null; came: string | null; cameAgo: number;
  /** THE ROOM'S OTHER DOOR (tools/qa/other-door-check.ts): he dropped in a room an entry of his had taken (he had crossed its frame on that order), to a
   *  round that came through ANOTHER door of that room — or to a man who had walked in through one in the 8 s before. `door`: that door · `entry`: the door
   *  his entry came in by · `held`: seconds since he crossed · `watchers`: the living teammates (himself too) whose ORDER or cover job had a gun on that door
   *  a second before he dropped (where the order points it, not where a fight had swung it), `now`: at the last look before he dropped · null: not such a death */
  other: { door: string; entry: string; held: number; watchers: string[]; now: string[] } | null;
  /** how far he was from the nearest edge of a hole a wall charge blew when he dropped (m; null: none blown). With `order` not the wall order's, within 3 m = lost at the hole after the entry had ended (on the way out, or holding beside it) */
  hole?: number | null;
  /** who stood in the line from his gun shoulder to his killer when he dropped ('Sam', a mate's callsign; null: nobody — roomfight.ts friendInLine) · the last
   *  opening the unasked cover had him on and how long before he dropped it was last his (null / -1: none this run) · Sam in the room he stood in (the room
   *  fight's own rooms) and how far off */
  mask?: string | null; job?: string | null; jobAgo?: number; samRoom?: boolean; samD?: number; at?: number[]; kAt?: number[]; samAt?: number[] }
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }

// ───────────────────────────────────────────────────────────── the watcher ─────────────────────────────────────────
interface Track { door: string | null; mark: number[]; markT: number; stuckT: number; wantT: number; wantOf: any; hungOrder: any; hungT: number; hungSaid: boolean; stillT: number; doorT: number; doorSaid: number; flagT: number; flagSaid: number; wallT: number; wallSaid: number; behindT: number; behindSaid: number; lastYaw: number; turns: { t: number; yaw: number }[]; dir: number; ext: number; twitchSaid: number; snapSaid: number; was: string; last: string; blind: boolean; yaws: number[]; yawT: number; op: any; mark2: boolean; own: { t: number; tag: string }[]; jobId: string | null; jobT: number }
class Watcher {
  smells: Smell[] = []; deaths: Death[] = []; private tr = new Map<any, Track>(); private pairT = new Map<string, number>(); private pairSaid = new Map<string, number>();
  private samMark: number[] = [0, 0, 0]; private samMarkT = 0; private blockSaid = -100;
  constructor(private g: any, private say: (s: string) => void) { }
  private wrongSeen = new Map<any, number>();
  private add(kind: SmellKind, who: string, p: number[], detail: string) { const s = { kind, t: +this.g.time.toFixed(1), who, at: at(p), detail }; this.smells.push(s); this.say(`   !! ${kind} · ${who} ${s.at} · ${detail}`); }
  private order(gd: any): string { const A = this.g.orders.of(gd); return A ? `${A.order}${A.order === 'wallCharge' ? `:${this.wallPhase(gd)}` : ''}${A.arrived ? ' (on his mark)' : ''}` : gd.script ? 'scripted' : `no order, ${gd.state}`; }   // (a wall order's words carry its phase — place / standoff / armed / wait / enter; once it has ended, 'in' for a man it took through the hole, 'after' for one it left outside or that ended any other way)
  private wallPhase(gd: any): string { const C = this.g.wallCharge, live = C?.ops?.find((o: any) => o.men.includes(gd)); if (live) return live.phase;
    const A = this.g.orders.of(gd), d = [...(C?.done ?? [])].reverse().find((o: any) => o.mine?.get(gd) === A); return d && d.ended === 'in' && d.stage?.get(gd) === 'pod' ? 'in' : 'after'; }   // (the order that GAVE him what he holds now: a man an order left outside is not labelled by an older one that took him in)
  private hostWas = new Map<any, string>();
  // OFF ALONE — sampled at 4 Hz: each living teammate's nearest living friend by the nav grid's path
  alone: AloneOut[] = []; upSecs = 0; aloneSecs = 0;
  private aloneN = 0; private aloneUp = -1; private dropT = -99; private hist = new Map<any, number[][]>(); private ep = new Map<any, { row: AloneOut; last: number[]; t0: number }>();
  private way(a: number[], b: number[]): number {
    const d = flat(a, b); if (d > ALONE_M + 4) return d;   // (a path is never shorter than the straight line, and past this nobody asks how much longer)
    if (!this.g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]])) return d;
    const path = this.g.col.nav.findPath(a, b, 3000) as number[][] | null; if (!path) return 99; let L = 0, q = a; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, b);
  }
  private aloneTick(team: any[]) {
    if (this.aloneN++ % 15) return; const g = this.g, t = g.time, sam = g.player.char, alive = team.filter(x => x.state !== 'dead');
    const ups = alive.length + (g.player.down ? 0 : 1); if (ups < this.aloneUp) this.dropT = t; this.aloneUp = ups;
    const bodies: { k: any; pos: number[] }[] = [...(g.player.down ? [] : [{ k: sam, pos: sam.pos }]), ...alive.map(x => ({ k: x, pos: x.char.pos }))];
    for (const b of bodies) { let h = this.hist.get(b.k); if (!h) this.hist.set(b.k, h = []); h.push([b.pos[0], 0, b.pos[2]]); if (h.length > 13) h.shift(); }
    const moved = (k: any) => { const h = this.hist.get(k); return h ? flat(h[0], h[h.length - 1]) : 0; };
    for (const gd of team) { const E = this.ep.get(gd), p = gd.char.pos;
      const close = (died: boolean) => { if (!E) return; this.ep.delete(gd); E.row.secs = +(t - E.t0).toFixed(1); E.row.died = died; E.row.to = at(p); E.row.walked = +E.row.walked.toFixed(1); if (E.row.secs >= ALONE_SECS || died) { this.alone.push(E.row); this.aloneSecs += E.row.secs; this.say(`   ~~ alone · ${gd.callsign} ${E.row.at} → ${E.row.to} for ${E.row.secs} s (nearest friend up to ${E.row.far} m by the way) · ${E.row.left ? 'he walked' : E.row.lost ? 'his company went down' : 'the others went'} · he was: ${E.row.was}${E.row.door ? ` · door ${E.row.door}` : ''}${died ? ' · DOWN' : ''}`); } };
      if (gd.state === 'dead') { close(true); continue; }
      this.upSecs += 0.25; let near = Infinity, who: any = null; for (const b of bodies) { if (b.k === gd) continue; const L = this.way(p, b.pos); if (L < near) { near = L; who = b.k; } }
      if (E) { E.row.walked += flat(E.last, p); E.last = [p[0], 0, p[2]]; E.row.far = Math.max(E.row.far, +Math.min(near, 99).toFixed(1)); if (near <= ALONE_BACK) close(false); continue; }
      if (near <= ALONE_M) continue;
      const A = g.orders.of(gd), T = this.tr.get(gd);
      this.ep.set(gd, { t0: t, last: [p[0], 0, p[2]], row: { who: gd.callsign, t: +t.toFixed(1), secs: 0, far: +Math.min(near, 99).toFixed(1), was: this.order(gd), going: A?.going ?? null, door: T?.door ?? null, fight: !!g.fight?.engaged?.(gd), left: moved(gd) > 1 && moved(gd) > (who ? moved(who) : 0), lost: t - this.dropT <= 3, walked: 0, up: alive.length, died: false, at: at(p), to: at(p) } }); }
  }
  /** the stretches still open when the run ends */
  aloneClose() { const t = this.g.time; for (const [gd, E] of this.ep) { E.row.secs = +(t - E.t0).toFixed(1); E.row.to = at(gd.char.pos); E.row.walked = +E.row.walked.toFixed(1); if (E.row.secs >= ALONE_SECS) { this.alone.push(E.row); this.aloneSecs += E.row.secs; } } this.ep.clear(); }
  /** every hostile: where he stood last tick · the last opening he walked through — when, and whether the squad had ever been on the side he came from */
  private foeAt = new Map<any, number[]>(); private foeCame = new Map<any, { id: string; t: number; unknown: boolean }>();
  // ---- the room's other door (Death.other, RunOut.other): whose ORDER has a gun on which door, looked at ten times a second and kept two seconds
  otherStats = { rooms: 0, doors: 0, watched: 0, dealt: 0 };
  private doorWatch: { t: number; on: Map<string, string[]> }[] = []; private opsSeen = new Set<any>(); private opsDue: { op: any; at: number }[] = [];
  /** the room an entry took, READ off the room fight's own books (the room its points stand in, which the entry itself had built) — never asked for: the
   *  game's roomAt builds and caches a room it had not built yet, and a bystander must not be the one who builds it */
  private roomOfOp(op: any): any { const F = this.g.fight, nav = this.g.col.nav; if (!F?.roomOfCell) return null;
    for (const pod of op.pod?.values?.() ?? []) { const R = F.roomOfCell.get(nav.idx(Math.floor(pod.pos[0] / nav.cell), Math.floor(pod.pos[2] / nav.cell))); if (R) return R; } return null; }
  /** `near`: a man down against a wall, a desk or in a door's own frame lies on a cell that is no room's — the room of a cell beside him then (read only) */
  private inRoom(room: any, p: number[], near = false): boolean { const nav = this.g.col.nav, x = Math.floor(p[0] / nav.cell), z = Math.floor(p[2] / nav.cell);
    if (room.cells.has(nav.idx(x, z))) return true; if (!near) return false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < nav.W && nz < nav.H && room.cells.has(nav.idx(nx, nz))) return true; }
    return false; }
  private watchTick(team: any[]) {
    const g = this.g, t = g.time, col = g.col, last = this.doorWatch[this.doorWatch.length - 1]; if (last && t - last.t < 0.1) return;
    const on = new Map<string, string[]>(), doors = (g.cover?.ready?.() ?? []).filter((o: any) => o.kind === 'door');
    for (const gd of team) { if (gd.state === 'dead') continue; const p = gd.char.pos, J = g.cover?.of?.(gd), w = J?.to ?? g.orders?.of?.(gd)?.watch; if (!w) continue;
      const wy = Math.atan2(w[0] - p[0], w[2] - p[2]);
      for (const o of doors) { const d = flat(p, o.at); if (d > 12 || d < 0.3) continue;
        if (!(J && J.o === o) && Math.abs(wrap(Math.atan2(o.at[0] - p[0], o.at[2] - p[2]) - wy)) > 0.26) continue;   // (15°: his order's gun is on that frame)
        const sg = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1] >= 0 ? 1 : -1;
        if (col.segmentBlocked([p[0], 1.5, p[2]], [o.at[0] + o.n[0] * sg * 0.4, 1.2, o.at[2] + o.n[1] * sg * 0.4])) continue;
        (on.get(o.id) ?? on.set(o.id, []).get(o.id)!).push(gd.callsign); } }
    this.doorWatch.push({ t, on }); while (this.doorWatch.length && this.doorWatch[0].t < t - 2) this.doorWatch.shift();
    // every entry that has ended 'in': a second later, its room's other doors nobody has been beyond — and how many have a gun on them
    for (const op of g.doorTools?.done ?? []) if (!this.opsSeen.has(op)) { this.opsSeen.add(op); if (op.ended === 'in') this.opsDue.push({ op, at: t + 1 }); }
    for (let i = this.opsDue.length - 1; i >= 0; i--) { const D = this.opsDue[i]; if (t < D.at) continue; this.opsDue.splice(i, 1);
      const room = this.roomOfOp(D.op); if (!room || !D.op.men.some((m: any) => m.state !== 'dead' && this.inRoom(room, m.char.pos))) continue;
      this.otherStats.rooms++;
      for (const e of room.entries) { if (e.door === D.op.door) continue; const O = doors.find((o: any) => o.door === e.door), fc = e.door.frameCentre; if (!O || g.entry?.farKnown?.(O, [fc[0] - e.out[0] * 0.4, 0, fc[2] - e.out[1] * 0.4])) continue;
        this.otherStats.doors++; if (on.get(O.id)?.length) this.otherStats.watched++; if (D.op.other?.has?.(e.door)) this.otherStats.dealt++; } }
  }
  /** Death.other for a teammate dropped at `p` by `k` */
  private otherAt(gd: any, p: number[], k: any): Death['other'] {
    const g = this.g, t = g.time, D = g.doorTools; if (!D) return null;
    const op = [...(D.ops ?? []), ...[...(D.done ?? [])].reverse()].find((o: any) => { if (!o.men.includes(gd) || !o.crossed?.has?.(gd)) return false; const R = this.roomOfOp(o); return !!R && this.inRoom(R, p, true); }); if (!op) return null;
    const room = this.roomOfOp(op);
    const kp = k.char.pos, doors = (g.cover?.ready?.() ?? []).filter((o: any) => o.kind === 'door' && o.door !== op.door && room.entries.some((e: any) => e.door === o.door));
    let X: any = null, bd = Infinity;
    for (const o of doors) { const s0 = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1], s1 = (kp[0] - o.at[0]) * o.n[0] + (kp[2] - o.at[2]) * o.n[1]; if (s0 * s1 >= 0) continue;
      const q = s0 / (s0 - s1), x = p[0] + (kp[0] - p[0]) * q, z = p[2] + (kp[2] - p[2]) * q; if (Math.abs((x - o.at[0]) * o.n[1] - (z - o.at[2]) * o.n[0]) > o.half + 0.2) continue;
      const d = Math.hypot(x - p[0], z - p[2]); if (d < bd) { bd = d; X = o; } }
    if (!X) { const c = this.foeCame.get(k); if (c && t - c.t <= 8) X = doors.find((o: any) => o.id === c.id) ?? null; }
    if (!X) return null;
    const at = (age: number) => { let S = this.doorWatch[0]; for (const W of this.doorWatch) if (W.t <= t - age) S = W; return S?.on.get(X.id) ?? []; };
    return { door: X.door.def.name, entry: op.door.def.name, held: +(t - (op.crossed.get(gd) ?? t)).toFixed(1), watchers: at(1), now: this.doorWatch[this.doorWatch.length - 1]?.on.get(X.id) ?? [] };
  }
  private crossings() {
    const g = this.g, E = g.entry, ops = g.cover?.ready?.() ?? []; if (!E) return;
    for (const h of g.guards as any[]) { if (h.team !== 'hostile' || h.state === 'dead') continue;
      const p = h.char.pos, was = this.foeAt.get(h); this.foeAt.set(h, [p[0], 0, p[2]]); if (!was || flat(was, p) < 1e-4 || flat(was, p) > 1.5) continue;
      for (const o of ops) { const s0 = (was[0] - o.at[0]) * o.n[0] + (was[2] - o.at[2]) * o.n[1], s1 = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1]; if (s0 * s1 >= 0) continue;
        const k = s0 / (s0 - s1), x = was[0] + (p[0] - was[0]) * k, z = was[2] + (p[2] - was[2]) * k; if (Math.abs((x - o.at[0]) * o.n[1] - (z - o.at[2]) * o.n[0]) > o.half + 0.3) continue;
        this.foeCame.set(h, { id: o.id, t: g.time, unknown: !E.farKnown(o, p) }); } }
  }
  /** the opening nearest `p` that the line p → q crosses and whose far side from p nobody of the squad has been on */
  /** metres from p to the middle of the nearest hole a charge blew in a wall (null: none blown this run) */
  private holeAt(p: number[]): number | null { if (!WALLREACT_STATS.breaches) return null; let best = Infinity;
    for (const b of wallReactOf(this.g).breaches) if (b.cause === 'blast' && b.walk) best = Math.min(best, Math.max(0, Math.hypot(b.at[0] - p[0], b.at[2] - p[2]) - b.half));
    return best < Infinity ? +best.toFixed(1) : null; }
  private thru(p: number[], q: number[]): string | null {
    const g = this.g, E = g.entry; let best: string | null = null, bd = Infinity; if (!E) return null;
    for (const o of g.cover?.ready?.() ?? []) { const s0 = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1], s1 = (q[0] - o.at[0]) * o.n[0] + (q[2] - o.at[2]) * o.n[1]; if (s0 * s1 >= 0) continue;
      const k = s0 / (s0 - s1), x = p[0] + (q[0] - p[0]) * k, z = p[2] + (q[2] - p[2]) * k; if (Math.abs((x - o.at[0]) * o.n[1] - (z - o.at[2]) * o.n[0]) > o.half + 0.2 || E.farKnown(o, p)) continue;
      const d = Math.hypot(x - p[0], z - p[2]); if (d < bd) { bd = d; best = o.id; } }
    return best;
  }
  tick(team: any[], samGoal: number[] | null) {
    if (DOORWAY.oneWay) for (const d of this.g.doors.list) { const m0 = this.wrongSeen.get(d); if (m0 === undefined) this.wrongSeen.set(d, d.mirrored); else if (d.mirrored > m0) { this.wrongSeen.set(d, d.mirrored); this.add('wrongway', d.def.name, d.pos, `an angle written on the side it does not open into (it opens ${d.swing > 0 ? '+' : '−'}) and turned round`); } }
    const g = this.g, t = g.time, O = g.orders, D = g.doorTools, col = g.col, sam = g.player.char;
    const alive = team.filter(x => x.state !== 'dead'); this.crossings(); this.aloneTick(team); this.watchTick(team);
    for (const h of (g.rescue?.hostages ?? []) as any[]) { const gd = h.gd ?? h, was = this.hostWas.get(gd); this.hostWas.set(gd, gd.state);
      if (was !== undefined && was !== 'dead' && gd.state === 'dead') { const k = g.guards.find((x: any) => x.char.id === gd.killerId); if (gd.killerId === PLAYER_ID || (k && k.team === 'operative')) this.add('friendly', gd.callsign ?? 'hostage', gd.char.pos, `a hostage killed by ${k?.callsign ?? 'Sam'}`); } }
    for (const gd of team) {
      let T = this.tr.get(gd); const p = gd.char.pos;
      if (!T) { T = { door: null, mark: [p[0], 0, p[2]], markT: t, stuckT: -100, wantT: t, wantOf: null, hungOrder: null, hungT: t, hungSaid: false, stillT: t, doorT: t, doorSaid: -100, flagT: t, flagSaid: -100, wallT: t, wallSaid: -100, behindT: t, behindSaid: -100, lastYaw: gd.char.aimYaw, turns: [], dir: 0, ext: gd.char.aimYaw, twitchSaid: -100, snapSaid: -100, was: gd.state, last: '', blind: false, yaws: [], yawT: 0, op: null, mark2: false, own: [], jobId: null, jobT: -100 }; this.tr.set(gd, T); }
      if (gd.state === 'dead') {
        if (T.was !== 'dead') { const k = g.guards.find((x: any) => x.char.id === gd.killerId); if (gd.killerId === PLAYER_ID || (k && k.team === 'operative')) this.add('friendly', gd.callsign, p, `killed by ${k?.callsign ?? 'Sam'}`);
          const off = k ? Math.abs(wrap(Math.atan2(k.char.pos[0] - p[0], k.char.pos[2] - p[2]) - T.lastYaw)) * 180 / Math.PI : 0;
          this.say(`   ✗ ${gd.callsign} down ${at(p)} · by ${k ? `${k.callsign} ${at(k.char.pos)} ${f1(flat(k.char.pos, p))} m, ${Math.round(off)}° off his muzzle` : gd.killerId === PLAYER_ID ? 'Sam' : '?'} · he was: ${T.last}`);
          if (k && k.team !== 'operative') { const O = g.fight?.opOf?.(gd), M = O?.meters?.get(k), kp = k.char.pos;
            this.deaths.push({ t: +t.toFixed(1), who: gd.callsign, by: k.callsign, d: +flat(kp, p).toFixed(1), off: Math.round(off), order: T.last, door: T.door, tgt: T.op?.tgt?.callsign ?? (T.op?.turn ? `(looking for ${T.op.turn.callsign})` : null), onKiller: T.op?.tgt === k, meter: +(M?.m ?? 0).toFixed(2), seenAge: M ? +(t - M.seenT).toFixed(1) : 99,
              track: +(T.op?.track ?? 0).toFixed(2), readyIn: +((T.op?.readyAt ?? 0) - t).toFixed(2), muzzleDown: !!T.op?.muzzleDown, light: !!gd.flashlight?.enabled, killerLit: +(k.visibility ?? 0).toFixed(2), blind: T.blind, kBlind: g.time < (k.dazzledUntil ?? -1), held: T.op?.held ?? 0,
              los: !col.segmentBlocked([p[0], 1.55, p[2]], [kp[0], 1.1, kp[2]]), moving: +Math.hypot(gd.char.vel[0], gd.char.vel[2]).toFixed(1), kOff: Math.round(Math.abs(wrap(Math.atan2(p[0] - kp[0], p[2] - kp[2]) - k.char.aimYaw)) * 180 / Math.PI),
              nUp: team.filter((m: any) => m.state !== 'dead').length, nFoes: this.g.guards.filter((h: any) => h.team === 'hostile' && h.state !== 'dead' && flat(h.char.pos, p) < 9).length,
              ...(() => { const o = g.entry?.riskAt?.(p, null, true) ?? null, sd = (q: number[]) => (q[0] - o.at[0]) * o.n[0] + (q[2] - o.at[2]) * o.n[1]; const c = this.foeCame.get(k), came = !!c && c.unknown && t - c.t <= 8; return { open: o ? o.id : null, beyond: !!o && sd(p) * sd(kp) < 0, onMark: T.mark2, thru: this.thru(p, kp), hole: this.holeAt(p), came: came ? c!.id : null, cameAgo: came ? +(t - c!.t).toFixed(1) : -1 }; })(), other: this.otherAt(gd, p, k),
              ...(() => { const c = gd.char, m = g.fight?.friendInLine?.(c.bones.upperArmR ?? [p[0], 1.4, p[2]], k.char.bones.chest ?? [kp[0], 1.1, kp[2]], gd) ?? null, r = g.fight?.roomAt?.(p) ?? null;
                return { mask: m === 'player' ? 'Sam' : m ? m.callsign : null, job: T.jobId, jobAgo: T.jobId ? +(t - T.jobT).toFixed(1) : -1, samRoom: !!r && r === g.fight.roomAt(sam.pos), samD: +flat(sam.pos, p).toFixed(1), at: [+p[0].toFixed(1), +p[2].toFixed(1)], kAt: [+kp[0].toFixed(1), +kp[2].toFixed(1)], samAt: [+sam.pos[0].toFixed(1), +sam.pos[2].toFixed(1)] }; })() }); }
          if (k && k.team !== 'operative' && off > 75 && !T.blind) this.add('unaware', gd.callsign, p, `killed by ${k.callsign} ${f1(flat(k.char.pos, p))} m off, ${Math.round(off)}° from where his gun pointed · ${T.last}`); }
        T.was = gd.state; continue; }
      T.was = gd.state; T.last = `${this.order(gd)} · ${g.cover?.words?.(gd) || 'covering nothing'}`; { const A = O.of(gd); T.mark2 = !!A?.post && flat(p, A.post) < 0.8; } T.door = g.doorTools?.ops?.find((o: any) => o.men.includes(gd))?.phase ?? null;
      { const J = g.cover?.of?.(gd); if (J) { T.jobId = J.o.id; T.jobT = t; } }
      { const O = g.fight?.opOf?.(gd); T.op = O ? { tgt: O.tgt ?? null, turn: O.turn?.to ?? null, track: O.track, readyAt: O.readyAt, held: O.heldForFriend, muzzleDown: !!gd.muzzleDown } : null; }   // (the fight's own state on his last living frame: its dead branch has wiped it by the time his death is seen)
      const A = O.of(gd), fighting = g.fight.engaged(gd) || (!gd.script && (gd.state === 'alert' || gd.state === 'search')), blind = gd.dazzledUntil > t || gd.staggerUntil > t;
      T.blind = blind; if (t - T.yawT >= 0.1) { T.yawT = t; T.yaws.push(Math.round(gd.char.aimYaw * 180 / Math.PI)); if (T.yaws.length > 30) T.yaws.shift(); }
      if (flat(p, T.mark) > 0.25) { T.mark = [p[0], 0, p[2]]; T.markT = t; }
      const still = t - T.markT;
      // stuck / hung
      const wants = !!A && !A.arrived && !!A.post && flat(p, A.post) > 0.6 && !fighting && !blind;
      if (!wants || T.wantOf !== A) { T.wantOf = wants ? A : null; T.wantT = t; }
      if (wants && Math.min(still, t - T.wantT) > 4 && t - T.stuckT > 10) { T.stuckT = t; this.add('stuck', gd.callsign, p, `${A.order} → ${at(A.post)}, ${f1(flat(p, A.post))} m short, still ${f1(still)} s · ${A.going}`); }
      if (A && !A.arrived && A.post && A.order !== 'fallIn') { if (T.hungOrder !== A) { T.hungOrder = A; T.hungT = t; T.hungSaid = false; } else if (!T.hungSaid && t - T.hungT > 45 && !fighting) { T.hungSaid = true; this.add('hung', gd.callsign, p, `${A.order} unarrived for 45 s · ${A.going} · ${f1(flat(p, A.post))} m from his mark`); } } else T.hungOrder = null;
      // doorway
      const door = g.doors.list.find((d: any) => flat(p, d.frameCentre) < 0.45);
      if (door && still > 0 && !fighting && !D.ops.some((o: any) => o.door === door)) { if (t - T.doorT > 4 && still > 4 && t - T.doorSaid > 15) { T.doorSaid = t; this.add('doorway', gd.callsign, p, `in the ${door.def.name} doorway for ${f1(still)} s · ${this.order(gd)}`); } } else T.doorT = t;
      // flag: gun up on a friend
      const up = !gd.muzzleDown && (gd.script ? (gd.script.over ? true : gd.script.upper === 'aim' && !(A && A.low)) : (gd.state === 'alert' || gd.state === 'search'));
      let flagged: string | null = null;
      if (up && !blind) { const ax = Math.sin(gd.char.aimYaw), az = Math.cos(gd.char.aimYaw);
        for (const f of [{ pos: sam.pos, name: 'Sam' }, ...alive.filter(x => x !== gd).map(x => ({ pos: x.char.pos, name: x.callsign }))]) {
          const dx = f.pos[0] - p[0], dz = f.pos[2] - p[2], along = dx * ax + dz * az; if (along < 0.5 || along > 5) continue;
          if (Math.abs(dx * az - dz * ax) < 0.3 && !col.solidBlocked([p[0], 1.3, p[2]], [f.pos[0], 1.3, f.pos[2]])) { flagged = `${f.name} ${f1(along)} m down his muzzle`; break; } } }
      if (flagged) { if (t - T.flagT > 1.5 && t - T.flagSaid > 10) { T.flagSaid = t; this.add('flag', gd.callsign, p, `${flagged} · ${this.order(gd)}${fighting ? ' · fighting' : ''}`); } } else T.flagT = t;
      // wall
      const fx = Math.sin(gd.char.bodyYaw), fz = Math.cos(gd.char.bodyYaw);
      const walled = !!A && A.arrived && still > 0 && !fighting && A.order !== 'stack' && !D.ops.some((o: any) => o.men.includes(gd))
        && col.solidBlocked([p[0], 1.3, p[2]], [p[0] + fx * 0.7, 1.3, p[2] + fz * 0.7]) && col.solidBlocked([p[0], 0.6, p[2]], [p[0] + fx * 0.7, 0.6, p[2] + fz * 0.7])
        && Math.abs(wrap(gd.char.aimYaw - gd.char.bodyYaw)) < 0.5;
      if (walled) { if (t - T.wallT > 6 && t - T.wallSaid > 30) { T.wallSaid = t; this.add('wall', gd.callsign, p, `chest on a wall for 6 s · ${this.order(gd)}`); } } else T.wallT = t;
      // snap (sampled at 10 Hz off the yaw kept for the trace) and twitch (swings: a reversal is logged when the aim has come back 15° from its last extreme)
      { // (whose his gun is, as it changes: the fight's, the cover's — which opening —, his order's own watch; kept 3 s for the twitch line: WHY it went back and forth)
        const J = g.cover?.of?.(gd) ?? g.cover?.keptJob?.(gd), s = gd.script, tag = fighting ? 'fight' : !s ? gd.state : J && s.aimAt === J.aim ? `cover:${J.o.id}` : s.aimAt && A && s.aimAt === A.watch ? 'order' : s.aimAt ? 'aim' : 'free';
        if (!T.own.length || T.own[T.own.length - 1].tag !== tag) T.own.push({ t, tag }); while (T.own.length > 1 && t - T.own[1].t > 3) T.own.shift(); }
      { const yaw = gd.char.aimYaw, d = wrap(yaw - T.lastYaw); T.lastYaw = yaw;
        if (T.yaws.length >= 2 && t - T.yawT < 1e-9) { const n = T.yaws.length, jump = Math.abs(wrap((T.yaws[n - 1] - T.yaws[n - 2]) * Math.PI / 180)) * 180 / Math.PI;
          if (jump > 60 && !blind && t - T.snapSaid > 3) { T.snapSaid = t; this.add('snap', gd.callsign, p, `aim jumped ${Math.round(jump)}° in 0.1 s · ${this.order(gd)}${fighting ? ' · fighting' : ''}`); } }
        const cont = T.ext + wrap(yaw - T.ext);   // (unwrapped beside the running extreme)
        if (T.dir === 0) { if (Math.abs(cont - T.ext) > 0.26) { T.dir = Math.sign(cont - T.ext); T.ext = cont; } }
        else if ((cont - T.ext) * T.dir > 0) T.ext = cont;
        else if ((T.ext - cont) * T.dir > 0.26) { T.turns.push({ t, yaw: T.ext }); T.dir = -T.dir; T.ext = cont; }
        while (T.turns.length && t - T.turns[0].t > 2) T.turns.shift();
        if (T.turns.length >= 4 && t - T.twitchSaid > 15 && !blind) { T.twitchSaid = t; this.add('twitch', gd.callsign, p, `aim swung back and forth ${T.turns.length} times in 2 s · ${this.order(gd)}${A?.spare ? ' · rear security' : ''}${fighting ? ' · fighting' : ''} · gun: ${T.own.map(o => `${o.tag}@${(o.t - t).toFixed(1)}`).join(' → ')} · yaw° at 10 Hz: ${T.yaws.slice(-22).join(' ')}${process.env.PT_TWITCH ? ' · cover: ' + (this.g.cover.log as any[]).filter(x => x.who === gd.callsign && x.t > t - 3).map(x => `${x.t.toFixed(2)}→${x.id}`).join(' ') : ''}`); }
        void d; }
      // behind
      if (A && A.order === 'fallIn' && !fighting && !blind && flat(p, sam.pos) > 9) { if (t - T.behindT > 12 && t - T.behindSaid > 30) { T.behindSaid = t; this.add('behind', gd.callsign, p, `${f1(flat(p, sam.pos))} m from Sam for 12 s under fall in · still ${f1(still)} s`); } } else T.behindT = t;
    }
    // overlap (Sam counts)
    const bodies = [{ pos: sam.pos, name: 'Sam' }, ...alive.map(x => ({ pos: x.char.pos, name: x.callsign }))];
    for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) { const k = `${bodies[a].name}/${bodies[b].name}`;
      if (flat(bodies[a].pos, bodies[b].pos) < 0.3) { const t0 = this.pairT.get(k) ?? t; this.pairT.set(k, t0); if (t - t0 > 0.75 && t - (this.pairSaid.get(k) ?? -100) > 10) { this.pairSaid.set(k, t); this.add('overlap', k, bodies[a].pos, `${f1(flat(bodies[a].pos, bodies[b].pos) * 100)} cm apart for 0.75 s`); } } else this.pairT.delete(k); }
    // block
    if (samGoal && flat(sam.pos, samGoal) > 0.5) { if (flat(sam.pos, this.samMark) > 0.2) { this.samMark = [sam.pos[0], 0, sam.pos[2]]; this.samMarkT = t; }
      else if (t - this.samMarkT > 1.5 && t - this.blockSaid > 10) { const near = alive.find(x => flat(x.char.pos, sam.pos) < 0.9); if (near) { this.blockSaid = t; this.add('block', near.callsign, sam.pos, `Sam walking and stopped 1.5 s with him ${f1(flat(near.char.pos, sam.pos) * 100)} cm off · ${this.order(near)}`); } } }
    else { this.samMark = [sam.pos[0], 0, sam.pos[2]]; this.samMarkT = t; }
  }
}

// ───────────────────────────────────────────────────────────── the numbers ─────────────────────────────────────────
// A BYSTANDER: it reads the game and asks the door tools' own two questions of its OWN copy of a room's floor (doortools.ts look / thrLitCell — 'has a lit
// muzzle been across this cell, with a line to it'), so the count means the same thing for a bang and clear as for a threshold; nothing of the game's is
// written (the room fight's room model is asked for rooms it has built or would build the same way: PT_DIGEST agrees with and without it).
interface MyRoom { cells: Set<number>; big: boolean }
interface EntryRec { op: any; out: EntryOut; men0: any[]; into: MyRoom | null; SR: any; T: any; banged: Uint8Array | null; cellAt: Map<number, number> | null; losT: number; enterT: number; fired?: Set<any> }
const ROOM_CAP = 2400, ROOM_SMALL = 500, ENTRY_SECS = 10;   // roomfight.ts ROOM_MAX_CELLS · the rooms heldRooms() calls rooms · LossOut 'entry'
/** THE NUMBERS — a bystander: it reads the door tools' orders and the fight's deaths and writes NOTHING the game reads (its room model is its own flood fill,
 *  its looked-at floor its own arrays — a run's digest is the same with it and without it: PT_DIGEST=1 against a build before it) */
class Tally {
  entries: EntryRec[] = []; kills: KillOut[] = []; losses: LossOut[] = []; private seen = new Set<any>(); private was = new Map<any, string>(); private bangSeen = new WeakSet<any>(); private shotSeen = new WeakSet<any>(); private shotAt = new WeakMap<any, number>(); private mine = new Map<number, MyRoom>();
  constructor(private g: any) { }
  private small(r: MyRoom | null): r is MyRoom { return !!r && !r.big && r.cells.size <= ROOM_SMALL; }
  private cellOf(p: number[]): number { const nav = this.g.col.nav; return Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell); }
  /** the room a point stands in by the room fight's own rule (roomfight.ts roomAt: the nav cells reachable from it without crossing a doorway cell), flooded
   *  HERE on the tally's own books — the game's roomAt builds and caches a room it had not built yet (ids, merges, in the order asked), and the tally asks
   *  about places the game never does (where a defender fell, both sides of a doorway). Past ROOM_CAP cells it is open floor (`big`) */
  private roomOf(p: number[]): MyRoom | null {
    const g = this.g, nav = g.col.nav, cs = nav.cell, W = nav.W, H = nav.H, dc = doorCells(g);
    const free = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && nav.blocked[nav.idx(x, z)] !== 1 && !dc.has(nav.idx(x, z));
    let sx = Math.floor(p[0] / cs), sz = Math.floor(p[2] / cs);
    if (!free(sx, sz)) { let found = false; for (let r = 1; r <= 3 && !found; r++) for (let dz = -r; dz <= r && !found; dz++) for (let dx = -r; dx <= r && !found; dx++) if (free(sx + dx, sz + dz)) { sx += dx; sz += dz; found = true; } if (!found) return null; }
    const s0 = nav.idx(sx, sz), hit = this.mine.get(s0); if (hit) return hit;
    const cells = new Set<number>([s0]), q = [s0]; let big = false;
    for (let qi = 0; qi < q.length; qi++) { if (cells.size > ROOM_CAP) { big = true; break; }
      const c = q[qi], x = c % W, z = (c / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!free(nx, nz)) continue; const n = nav.idx(nx, nz); if (!cells.has(n)) { cells.add(n); q.push(n); } } }
    const R: MyRoom = { cells, big }; for (const c of cells) this.mine.set(c, R); return R;
  }
  /** where a defender's killer stood, against the room the defender was in */
  private whereOf(h: any, k: any): KillOut['where'] {
    const g = this.g, hp = h.char.pos, kc = this.cellOf(k.char.pos);
    const d = g.doors.list.find((x: any) => flat(hp, x.frameCentre) < 0.6);
    if (d) {   // in a doorway: the rooms that door is a door of
      const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), c = d.frameCentre;
      const rooms = [1.2, -1.2].map(b => this.roomOf([c[0] + nx * b, 0, c[2] + nz * b])).filter((r): r is MyRoom => this.small(r));
      if (!rooms.length) return 'open';
      return rooms.some(r => r.cells.has(kc)) ? 'inside' : 'outside';
    }
    const R = this.roomOf(hp); if (!this.small(R)) return 'open';
    return R.cells.has(kc) ? 'inside' : 'outside';
  }
  /** the last door order a man was given */
  private lastOf(m: any): EntryRec | null { for (let i = this.entries.length - 1; i >= 0; i--) if (this.entries[i].men0.includes(m)) return this.entries[i]; return null; }
  private heldOf(op: any): number | undefined { for (const b of op.beats) { const m = /^held ([\d.]+) s/.exec(b.what); if (m) return parseFloat(m[1]); } return undefined; }
  tick(team: any[], hostiles: any[]) {
    const g = this.g, D = g.doorTools, t = g.time, nav = g.col.nav, K = feelTables().DOORTOOLS;
    // a door order begun
    for (const op of D.ops) { if (this.seen.has(op)) continue; this.seen.add(op);
      const d = op.door, th = d.def.closedDir, c = d.frameCentre, b = -op.side * 1.2, inPt: Vec3 = [c[0] - Math.sin(th) * b, 0, c[2] + Math.cos(th) * b];
      const room = this.roomOf(inPt), model = !!room && !room.big && !openFloor(g, room);   // (the game's own test: a yard under the sky is searched by nobody)
      const pts: Vec3[] = [], cellAt = new Map<number, number>(); if (model) for (const ci of room!.cells) { cellAt.set(ci, pts.length); pts.push([(ci % nav.W + 0.5) * nav.cell, 1.0, (((ci / nav.W) | 0) + 0.5) * nav.cell]); }
      this.entries.push({ op, men0: [...op.men], into: room, cellAt: model ? cellAt : null, banged: model ? new Uint8Array(pts.length) : null, losT: 0, enterT: NaN, T: { litC: null },
        SR: model ? { room, pts, looked: new Uint8Array(pts.length), los: new Map(), yaw: new Map(), at: new Map(), moves: 0, leftAtMove: Infinity, left: pts.length } : null,
        out: { door: d.def.name, tool: op.kind === 'threshold' && op.thrHold ? 'thresholdHold' : op.kind, t0: +t.toFixed(2), cross: null, t1: null, end: '', men: op.men.length, lost: 0, out: 0, in: 0, open: 0, bangs: 0, cells: pts.length, blind: 0, blindMen: 0 } }); }
    // a can gone off: the floor its burst had a line to (the stage's own rule — thrBanged), on every room an order is still outside of; counted to the nearest door's order
    for (const e of g.events) { if (e.kind !== 'bang' || this.bangSeen.has(e)) continue; this.bangSeen.add(e);
      const live = this.entries.filter(E => E.out.t1 === null); const at = e.pos; let near: EntryRec | null = null;
      for (const E of live) { if (!near || flat(at, E.op.door.frameCentre) < flat(at, near.op.door.frameCentre)) near = E;
        if (E.out.cross !== null || !E.SR) continue;
        for (let i = 0; i < E.SR.pts.length; i++) { const q = E.SR.pts[i]; if (!E.banged![i] && flat(at, q) <= K.thrFlashM && !g.col.segmentBlocked([at[0], Math.max(0.15, at[1]), at[2]], [q[0], 1.45, q[2]])) E.banged![i] = 1; } }
      if (near && flat(at, near.op.door.frameCentre) < 12) near.out.bangs++; }
    for (const E of this.entries) { const op = E.op, o = E.out; if (o.t1 !== null) continue;
      // the floor a lit muzzle is across from OUTSIDE, until the first man is over the frame line
      if (o.cross === null && E.SR) {
        if (t >= E.losT) { E.losT = t + 0.5; E.SR.los.clear(); }   // (a leaf swinging, a man settling: lines asked again twice a second, as the stage asks its own)
        const outside = op.men.filter((m: any) => m.state !== 'dead' && !op.crossed.has(m));
        if (outside.length) D.look(op, E.SR, outside, (m: any, i: number) => !!m.flashlight?.enabled || D.thrLitCell(E.T, E.SR, i)); }
      // the first man across — once the order is going in (a man whose walk to his mark took him over the frame line while the others stacked has not gone in)
      if (op.phase === 'enter' && isNaN(E.enterT)) E.enterT = t;
      if (o.cross === null && !isNaN(E.enterT) && [...op.crossed.values()].some((ct: number) => ct >= E.enterT - 1e-6)) { o.cross = +t.toFixed(2);
        if (E.SR) { const blind = (i: number) => !E.SR.looked[i] && !E.banged![i]; for (let i = 0; i < E.SR.pts.length; i++) if (blind(i)) o.blind++;
          for (const h of hostiles) { if (h.state === 'dead') continue; const i = E.cellAt!.get(this.cellOf(h.char.pos)); if (i !== undefined && blind(i)) o.blindMen++; } }
        o.held = this.heldOf(op); }
      if (!D.ops.includes(op)) { o.t1 = +t.toFixed(2); o.end = op.ended ?? '?'; o.lost = E.men0.filter((m: any) => m.state === 'dead').length; o.held ??= this.heldOf(op); }
      if (op.lastStack || op.lastHold) o.last = op.lastStack && op.lastHold ? 'both' : op.lastStack ? 'stack' : 'hold'; }
    // each man's first round once he is across the frame of his last door order
    for (const e of g.events) { if (e.kind !== 'guardShot' || this.shotSeen.has(e)) continue; this.shotSeen.add(e);
      const m = team.find((x: any) => x.char.id === e.who); if (!m) continue; const before = this.shotAt.get(m); this.shotAt.set(m, e.time);
      const E = this.lastOf(m); if (!E || E.fired?.has(m)) continue;
      const ct = E.op.crossed.get(m); if (ct === undefined || isNaN(E.enterT)) continue;
      if (before !== undefined && before < E.enterT && before > E.enterT - 0.5) { (E.fired ??= new Set()).add(m); continue; }   // (already firing as the order went in: his next round is no first round)   // (a man whose walk to his mark took him over the line while the others stacked is across from the moment the order goes in)
      (E.fired ??= new Set()).add(m); const dt = e.time - Math.max(ct, E.enterT); if (dt >= 0 && dt <= ENTRY_SECS) (E.out.shots ??= []).push(+dt.toFixed(2)); }   // (a first round later than the entry's own seconds is some other fight's)
    // their men dropping
    for (const h of hostiles) { const was = this.was.get(h); this.was.set(h, h.state); if (was === undefined || was === 'dead' || h.state !== 'dead') continue;
      const k = g.guards.find((x: any) => x.char.id === h.killerId); if (!k || k.team !== 'operative') continue;
      const E = this.lastOf(k), where = this.whereOf(h, k);
      const his = !!E && (flat(h.char.pos, E.op.door.frameCentre) < 3 || !!E.into?.cells.has(this.cellOf(h.char.pos))), entry = his ? (E!.op.crossed.has(k) ? 'after' : 'before') : null;
      this.kills.push({ t: +t.toFixed(1), who: h.callsign ?? '?', by: k.callsign, where, door: E ? E.out.door : null, phase: E && E.out.t1 === null ? E.op.phase : null, entry, pre: his && E!.out.cross === null });
      if (entry) E!.out[entry === 'before' ? 'out' : 'in']++; else if (E) E.out.open++; }
    // ours dropping
    for (const m of team) { const was = this.was.get(m); this.was.set(m, m.state); if (was === undefined || was === 'dead' || m.state !== 'dead') continue;
      const E = this.lastOf(m), o = E?.out, since = o && o.cross !== null ? +(t - o.cross).toFixed(1) : null;
      this.losses.push({ t: +t.toFixed(1), who: m.callsign, door: o?.door ?? null, tool: o?.tool ?? null, since,
        at: !o ? 'none' : o.cross === null ? (o.t1 === null ? 'door' : 'later') : since! <= ENTRY_SECS ? 'entry' : 'later' }); }
  }
  /** the run is over: orders still under way keep t1 null, with what they had lost */
  close(): EntryOut[] { for (const E of this.entries) if (E.out.t1 === null) { E.out.lost = E.men0.filter((m: any) => m.state === 'dead').length; E.out.end = `(under way: ${E.op.phase})`; } return this.entries.map(E => E.out); }
}

// ───────────────────────────────────────────────────────────── the scripted player ─────────────────────────────────
/** WHAT THE DEFENDERS DID — a bystander like the Tally: it reads where each defender stands, his state, the room fight's notes and counts, and writes nothing
 *  the game reads (it never asks the game for a room: that builds one). */
class DefWatch {
  rows = new Map<any, DefOut>(); doors: DoorSnap[] = []; loudAt: number | null = null;
  private was = new Map<any, string>(); private noteSeen = 0; private lastNote: unknown = null; private seenRec = new Map<any, boolean>(); private tac0: Record<string, number>;
  constructor(private g: any) { this.tac0 = { ...TACTICS_STATS }; }   // (tactics.ts counts across every game of the process: a run's share is the difference)
  private homeOf(h: any): any | null { return this.g.roomClear?.rooms?.find((r: any) => r.defenders.includes(h))?.def ?? null; }
  private modeOf(h: any): string { return this.g.fight?.defs?.find((d: any) => d.gd === h)?.mode ?? 'none'; }
  private atHome(h: any, R: DefOut): boolean { const H = this.homeOf(h), p = h.char.pos; return H ? p[0] >= H.bounds.x0 && p[0] <= H.bounds.x1 && p[2] >= H.bounds.z0 && p[2] <= H.bounds.z1 : Math.hypot(p[0] - R.mark[0], p[2] - R.mark[1]) < 4; }
  private fromMark(h: any, R: DefOut): number { return +Math.hypot(h.char.pos[0] - R.mark[0], h.char.pos[2] - R.mark[1]).toFixed(1); }
  tick(t: number, team: any[], hostiles: any[], entries: EntryRec[]) {
    const g = this.g, off = g.time - t;
    if (this.loudAt === null && (g.events as any[]).some(e => !e.ptNoise && (e.kind === 'shot' || e.kind === 'guardShot' || e.kind === 'bang' || e.kind === 'kick'))) this.loudAt = +t.toFixed(1);
    for (const h of hostiles) {
      let R = this.rows.get(h);
      if (!R) { R = { who: h.callsign ?? '?', home: this.homeOf(h)?.id ?? null, mark: [+h.char.pos[0].toFixed(2), +h.char.pos[2].toFixed(2)], notes: [], far: 0, leftAt: null, alertAt: null, kills: [], dead: null }; this.rows.set(h, R); }
      if (R.dead) continue;
      if (h.state === 'dead') { R.dead = { t: +t.toFixed(1), at: [+h.char.pos[0].toFixed(1), +h.char.pos[2].toFixed(1)], fromMark: this.fromMark(h, R), mode: this.modeOf(h), home: this.atHome(h, R) }; continue; }
      const d = this.fromMark(h, R); if (d > R.far) R.far = d;
      if (R.leftAt === null && !this.atHome(h, R)) R.leftAt = +t.toFixed(1);
      if (R.alertAt === null && h.state === 'alert') R.alertAt = +t.toFixed(1);
    }
    const L = (g.fight?.log ?? []) as { t: number; who: string; what: string }[]; if (L.length < this.noteSeen) this.noteSeen = L.indexOf(this.lastNote as any) + 1;   // (the log drops its oldest 200 past 600: go on from the last line read, or from the top if that one went too)
    for (; this.noteSeen < L.length; this.noteSeen++) { const n = L[this.noteSeen]; this.lastNote = n; if (!/^(goes to the fight|falls back|takes cover|plants|holds where|let off)/.test(n.what)) continue;
      for (const R of this.rows.values()) if (R.who === n.who) R.notes.push([+(n.t - off).toFixed(1), n.what]); }
    for (const m of team) { const was = this.was.get(m); this.was.set(m, m.state); if (was === undefined || was === 'dead' || m.state !== 'dead') continue;
      const k = g.guards.find((x: any) => x.char.id === m.killerId), R = k && this.rows.get(k); if (R) R.kills.push({ t: +t.toFixed(1), who: m.callsign, fromMark: this.fromMark(k, R), mode: this.modeOf(k), home: this.atHome(k, R) }); }
    for (const E of entries) { const seen = this.seenRec.get(E);
      if (seen === undefined) { this.seenRec.set(E, false); this.snap(t, E.out.door, 'order', hostiles); }
      if (seen !== true && E.out.cross !== null) { this.seenRec.set(E, true); this.snap(t, E.out.door, 'cross', hostiles); } }
  }
  private snap(t: number, door: string, when: 'order' | 'cross', hostiles: any[]) {
    const g = this.g, d = g.doors.byName(door); if (!d) return;
    const F = frameOf(d), mx = F.hx + F.ux * F.W / 2, mz = F.hz + F.uz * F.W / 2, rooms = (g.roomClear?.rooms ?? []) as any[];
    const men = hostiles.filter(h => h.state !== 'dead' && (rooms.length ? rooms.some(r => r.defenders.includes(h) && r.def.doors.some((x: any) => x.id === door)) : Math.hypot(h.char.pos[0] - mx, h.char.pos[2] - mz) < 12)).map(h => {
      const R = this.rows.get(h)!, p = h.char.pos; let a = Math.atan2(mx - p[0], mz - p[2]) - h.char.aimYaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      return { who: R.who, state: h.state as string, aw: +(+h.awareness).toFixed(2), off: Math.round(Math.abs(a) * 57.3), fromMark: this.fromMark(h, R), home: this.atHome(h, R), mode: this.modeOf(h) }; });
    this.doors.push({ t: +t.toFixed(1), door, when, men });
  }
  close(t: number): { defs: DefOut[]; def: DefRun } {
    const g = this.g, off = g.time - t;
    return { defs: [...this.rows.values()], def: { loudAt: this.loudAt, fight: { ...(g.fight?.stats ?? {}), blindRounds: g.fight?.blindRounds ?? 0 }, tactics: Object.fromEntries(Object.entries(TACTICS_STATS as Record<string, number>).map(([k, v]) => [k, v - (this.tac0[k] ?? 0)])),
      rooms: ((g.roomClear?.log ?? []) as { t: number; what: string }[]).map(x => [+(x.t - off).toFixed(1), x.what] as [number, string]), doors: this.doors } };
  }
}
class Player {
  /** PT_TIMES=1: every frame's cost (ms) and how many enemies were up in it */
  ms: number[] = []; msAlive: number[] = [];
  g: any; O: any; D: any; I: any; cam: any; t = 0; goal: Vec3 | null = null; trace: string[] = []; orders = 0; refused: string[] = []; watch: Watcher; rooms = 0; thr = 0; digest = ''; digestMove = ''; series: string[] = []; cutFirst: Record<string, number> = {}; digestAt: unknown = null; digFrames: [number, string, string][] = []; digFrameAt: unknown = null; shut: { door: string; t: number; secs: number; latched: boolean; ref?: any }[] = []; private frames = 0;
  /** PT_SEARCH: asked every step of a walk — true = stop walking (go() returns false); null = nobody asks */
  stop: (() => boolean) | null = null; search: Searcher | null = null; endw: EndWatch;
  /** open leaves across his way that he pulled to himself (shutLeaf): the run's record of them, and the doors — never then pushed open again, nor handed to the team as 'shut in his way' */
  leaves: { door: string; t: number; shut: boolean; locks?: boolean }[] = []; own = new Set<any>();
  /** where the AI opens doors from (tools/qa/handle-watch.ts — a bystander) */
  handw: HandleWatch | null = null;
  private dtSeen = 0; private rsSeen = 0; private fnSeen = 0; private rwSeen = 0; private fragSeen = new Set<number>(); private fragLast: unknown = null; private theirs = new Map<any, string>(); tally: Tally; defw: DefWatch; told: string[] = []; bangs0 = 0; sayw: any = null; ways: any = null; paths: any = null; lightw: any = null; gunw: any = null; fogw: any = null; holes: any = null; doorw: any = null; linew: any = null; atEnd: { team: number; hostiles: number } | null = null;
  constructor(public W: any, public kind: string, public cap: number, public verbose: boolean) { this.g = W.game; this.O = this.g.orders; this.D = this.g.doorTools; this.I = W.input; this.cam = W.cam; this.watch = new Watcher(this.g, s => this.say(s)); this.tally = new Tally(this.g); this.defw = new DefWatch(this.g); this.endw = new EndWatch(this.g); this.bangs0 = this.D.bangs;
    if (process.env.PT_NOTES && verbose) TACTICS_DEBUG.log = (l: string) => this.say(`   › ${l.replace(/^[\d.]+s /, '')}`);
    if (process.env.PT_GLASS && verbose) GLASSPEN_HOOKS.crossed = (_g, x, who) => this.say(`   ◇ pane ${x.bi} (${x.type}) crossed by ${this.g.guards.find((q: any) => q.char.id === who)?.callsign ?? (who === PLAYER_ID ? 'Sam' : who)} at (${x.at[0].toFixed(1)}, ${x.at[2].toFixed(1)}) · energy ${x.eIn.toFixed(2)} → ${x.eOut.toFixed(2)}${x.hole ? ' · by a hole' : ''}`); }   // (tactics.ts's own log — the doorway drill — beside the fight's notes)
  say(s: string) { const line = `${f1(this.t).padStart(6)}  ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }
  get pos(): Vec3 { return this.g.player.char.pos; }
  get team(): any[] { return this.O.squad(); }
  /** PT_SNATCH=cover: the element his orders go to once the other pair is posted ('all' everywhere else) */
  who: any = 'all'; private snSeen = 0;
  get upAll(): any[] { return this.team.filter((x: any) => x.state !== 'dead'); }
  get up(): any[] { if (this.who === 'all') return this.upAll; const mine = new Set(this.O.men(this.who)); return this.upAll.filter((x: any) => mine.has(x)); }
  get hostiles(): any[] { return this.g.guards.filter((x: any) => x.team === 'hostile'); }
  ended(): Done | null {
    const g = this.g;
    if (this.kind === 'rescue') { const r = g.rescue.result; return r ? new Done(r.state, `${r.grade} · ${r.why}`) : null; }
    if (this.who !== 'all' && !this.up.length && this.upAll.length && !(this.g.snatch?.active && !this.g.snatch.end && !this.g.snatch.inHand)) { this.who = 'all'; this.say('(his own pair is down: the posted pair is his again)'); }   // (a snatch's man still loose: the posted pair KEEPS the way out and the commander goes for him alone)
    if (this.kind === 'roomclear' && g.snatch?.active) { const S = g.snatch, e = g.roomClear.end; while (this.snSeen < S.notes) this.say(`   ☞ ${S.log[S.log.length - (S.notes - this.snSeen++)]?.replace(/^[\d.]+ /, '') ?? '…'}`);   // a snatch level (game/snatch.ts): the end hangs on the man — the house taken with him still loose is not over
      if (S.end) return new Done(S.end, S.why); if (e === 'wiped') return new Done(e, g.roomClear.endWhy ?? ''); }
    else if (this.kind === 'roomclear') { const e = g.roomClear.end; if (e) return new Done(e, g.roomClear.endWhy ?? ''); }
    if (!this.upAll.length) return new Done('wiped', 'every teammate down');
    if (this.kind === 'nightbreach' && this.hostiles.every((h: any) => h.state === 'dead')) return new Done('taken', 'the room\'s men are down');
    return null;
  }
  /** the commander does not stand in his men's fire (a player with a teammate's gun on a man past him moves, or shoots): one of them with a man to shoot and
   *  Sam within 0.9 m of that line → a spot 1.3 m off it, on the side he is already on if he can walk there (PT_STAND=1: he stands where his errand put him) */
  private offLine(): Vec3 | null {
    const g = this.g, p = this.pos;
    for (const m of this.up) { const O = g.fight?.opOf?.(m), t = O?.tgt ?? (m.state === 'alert' && m.foe && m.foe !== 'player' ? m.foe : null); if (!t || t.state === 'dead') continue;
      const a = m.char.pos, b = t.char.pos, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
      const sx = p[0] - a[0], sz = p[2] - a[2], along = sx * fx + sz * fz, side = sx * fz - sz * fx;
      if (along < 0.1 || along > L + 0.5 || Math.abs(side) > 0.9) continue;
      const k0 = side >= 0 ? 1 : -1;
      for (const k of [k0, -k0]) { const q: Vec3 = [a[0] + fx * along + fz * k * 1.3, 0, a[2] + fz * along - fx * k * 1.3];
        if (!g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) return q; } }
    return null;
  }
  /** when he last stood off a teammate's line of fire (go()'s stuck watchdog does not count that wait) */
  offAt = -100;
  step(n = 1) {
    const g = this.g, I = this.I;
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const clear = STAND ? null : fragStepOff(g), off = clear ?? (STAND ? null : this.offLine()), goal = off ?? this.goal; if (off) this.offAt = this.t;   // (a defender's live grenade he has been cued on: he gets clear of it first, as a player who read the cue would)
      if (clear) I.keys.add('ShiftLeft'); else I.keys.delete('ShiftLeft');
      if (goal && !g.player.down) { const dx = goal[0] - this.pos[0], dz = goal[2] - this.pos[2], d = Math.hypot(dx, dz);
        if (d > 0.2) { const { fwd, right } = this.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); this.W.cursorAt([this.pos[0] + dx / d * 4, 1.1, this.pos[2] + dz / d * 4]); } }
      g.player.visibility = MORTAL ? LIT : 0.05;
      (this.W as any).dust?.tick();
      if (TIMES) { const t0 = performance.now(); this.W.step(DT); this.ms.push(performance.now() - t0); let n = 0; for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead') n++; this.msAlive.push(n); } else this.W.step(DT);
      this.t += DT;
      if (g.blackout.active !== mainsOut) { mainsOut = g.blackout.active; MAINS.push([+this.t.toFixed(1), mainsOut ? 'out' : 'on']); this.say(mainsOut ? '(the mains are out)' : '(the mains are back on)'); }
      if (CUTW) { const c = cutCounts(g); for (const k in c) if (c[k] > 0 && this.cutFirst[k] === undefined) this.cutFirst[k] = +this.t.toFixed(3); }
      if (DIGF) { const f = Math.round(this.t * 60); if (f >= DIGF[0] && f <= DIGF[1]) { const d = digestGame(g, true), m = d as any; for (const x of m.guards) delete x.bubble; for (const x of m.civilians) delete x.bubble; if (m.player) delete m.player.bubble;
        this.digFrames.push([f, String(hashDigest(d)), CUTW ? JSON.stringify(cutCounts(g)) : '']); if (f === DIGF[2]) this.digFrameAt = d; } }
      if (process.env.PT_DIGEST && ++this.frames % 30 === 0) { const d = digestGame(g, true); this.digest = hashStr(this.digest + hashDigest(d)).toString(16);
        const m = d as any; for (const x of m.guards) delete x.bubble; for (const x of m.civilians) delete x.bubble; if (m.player) delete m.player.bubble;   // …and `digestMove`: the same word with nobody's speech bubble in it (a build that only words a line differently agrees on this one)
        this.digestMove = hashStr(this.digestMove + hashDigest(d)).toString(16);
        if (process.env.PT_DIGEST === 'series') this.series.push(String(hashDigest(d))); if (Number(process.env.PT_DIGEST_AT) === this.frames / 30) this.digestAt = d; }
      if (WHERE && this.verbose && this.t >= WHERE[0] && this.t <= WHERE[1] && Math.round(this.t * 60) % 30 === 0) this.say(`   @ Sam ${at(this.pos)} · ${this.team.map((m: any) => { const A = this.O.of(m), F = g.rescue?.flow?.jobOf?.(m); return `${m.callsign} ${m.state === 'dead' ? 'down' : `${at(m.char.pos)} ${A ? A.order + (A.arrived ? '✓' : '') : m.script ? 'scripted' : m.state}${F ? ` flow:${F.kind ?? F.what ?? 'job'}` : ''}${process.env.PT_WAYPTS && m.state !== 'dead' ? ` [goal ${m.script?.goal ? at(m.script.goal) : '—'} · post ${A?.post ? at(A.post) : '—'}${A?.via?.length ? ' via ' + A.via.map(at).join(' ') : ''} · path ${m.pathI}/${m.path.length} ${m.path.slice(m.pathI, m.pathI + 4).map(at).join(' ')} · v ${Math.hypot(m.char.vel[0], m.char.vel[2]).toFixed(2)}]` : ''}`}`; }).join(' · ')}`);   // (PT_WAYPTS=1: each man's script goal, his order's post and corners, the next waypoints of his path, his speed)
      if (WHERE && process.env.PT_FOES && this.verbose && this.t >= WHERE[0] && this.t <= WHERE[1] && Math.round(this.t * 60) % 30 === 0) { const names = process.env.PT_FOES.split(',').map(s => s.replace(/_/g, ' ')), dn = (process.env.PT_LEAVES ?? '').split(',').filter(Boolean); this.say(`   @@ ${this.hostiles.filter((h: any) => names.includes(h.callsign)).map((h: any) => `${h.callsign} ${h.state === 'dead' ? 'down' : `${at(h.char.pos)} ${h.state} aw ${(h.awareness ?? 0).toFixed(2)} yaw ${Math.round((h.char.aimYaw ?? 0) * 57.3)}${h.script ? ' scripted' : ''}${h.task ? ' task:' + (h.task.kind ?? h.task) : ''}${h.lastKnown ? ' lk ' + at(h.lastKnown) : ''}`}`).join(' · ')} · ${g.doors.list.filter((d: any) => dn.includes(d.def?.name ?? d.name ?? d.id)).map((d: any) => `${d.def?.name ?? d.name ?? d.id} ${(d.angle ?? 0).toFixed(2)}${d.latched ? 'L' : ''}`).join(' ')}`); }
      for (; this.dtSeen < this.D.log.length; this.dtSeen++) this.say(`   · ${this.D.log[this.dtSeen].what}`);
      if (this.D.log.length < this.dtSeen) this.dtSeen = this.D.log.length;
      if (this.verbose) {   // (frags in the trace: who threw one from where, and what each burst did)
        for (const it of g.items.items) if (it.kind === 'frag' && !this.fragSeen.has(it.serial)) { this.fragSeen.add(it.serial); const th = g.guards.find((x: any) => x.char.id === it.who); this.say(`   ✹ frag in the air from ${at(it.pos)} · ${th ? `${th.callsign} (${th.team})` : 'Sam'} · fuse ${f1(it.fuse)} s`); }
        const last = FRAG_LOG[FRAG_LOG.length - 1]; if (last && last !== this.fragLast) { this.fragLast = last; this.say(`   ✹ frag burst at ${at(last.at)} · killed ${last.killed} · hit ${last.wounded}${last.stunned ? ` · stunned behind a door or a wall it broke ${last.stunned}` : ''} · behind cover ${last.shielded}`); }
      }
      if (process.env.PT_NOTES && this.verbose) { const L = rearWatchLog(g) as string[], n = rearWatchRows(g); for (this.rwSeen = Math.max(this.rwSeen, n - L.length); this.rwSeen < n; this.rwSeen++) this.say(`   ◦ rear · ${L[L.length - (n - this.rwSeen)].replace(/^[\d.]+ /, '')}`); }   // (… and rearwatch.ts's: who is put on a door at the squad's back and why he comes off it; its log keeps the newest 200, so the cursor counts rows handed in, not the log's length)
      if (process.env.PT_NOTES && this.verbose) { const L = g.fight.log as { t: number; who: string; what: string }[]; for (; this.fnSeen < L.length; this.fnSeen++) this.say(`   » ${L[this.fnSeen].who}: ${L[this.fnSeen].what}`); if (L.length < this.fnSeen) this.fnSeen = L.length; }   // PT_NOTES=1: the room fight's own notes as they are made
      if (this.kind === 'rescue') { const L = g.rescue.log as { t: number; what: string }[]; for (; this.rsSeen < L.length; this.rsSeen++) { const w = L[this.rsSeen].what; if (/^(step|act|executed|teamfire|secured|unsecured|clear|crew)/.test(w)) this.say(`   ~ rescue: ${w}`); } if (L.length < this.rsSeen) this.rsSeen = L.length; }
      for (const h of this.hostiles) { const was = this.theirs.get(h); if (was !== undefined && was !== 'dead' && h.state === 'dead') { const k = g.guards.find((x: any) => x.char.id === h.killerId); this.say(`   + ${h.callsign} (theirs) down ${at(h.char.pos)} · by ${k?.callsign ?? (h.killerId === PLAYER_ID ? 'Sam' : '?')}`); } this.theirs.set(h, h.state); }
      this.watch.tick(this.team, off ? null : this.goal);   // (stood off his men's line he is not 'walking and getting nowhere')
      this.tally.tick(this.team, this.hostiles);
      this.defw.tick(this.t, this.team, this.hostiles, this.tally.entries);
      this.endw.tick(this.t, this.team, this.hostiles); this.search?.tick();
      this.handw?.tick(this.t);
      this.sayw?.tick(this.t); this.ways?.tick(this.t, this.team); this.paths?.tick(this.t, this.team); this.lightw?.tick(this.t); this.gunw?.tick(this.t); this.fogw?.tick(this.t); this.holes?.tick(this.t, this.team, this.hostiles); this.doorw?.tick(this.t);
      this.linew?.tick(this.t, this.team, off ? 'off' : this.goal && !g.player.down && flat(this.goal, this.pos) > 0.2 ? 'walk' : 'post', DT);   // PT_LINE=1 (tools/qa/line-watch.ts): a friend in a teammate's line of fire
      if (process.env.PT_COVER && this.verbose && Math.floor(this.t) !== Math.floor(this.t - DT)) this.say(`   ~ ${g.cover.summary()} · ${this.up.map((m: any) => `${m.callsign} ${at(m.char.pos)} yaw ${Math.round(m.char.aimYaw * 57.3)}`).join(' · ')}`);
      if (AIM_WIN && this.verbose && this.t >= AIM_WIN[0] && this.t <= AIM_WIN[1] && Math.floor(this.t * 20) !== Math.floor((this.t - DT) * 20)) {   // PT_AIM=a-b[:callsign]: whose the gun is at 20 Hz — his order, his spare eyes, the cover's job, where the script points it
        for (const m of this.up as any[]) { if (AIM_WHO && m.callsign !== AIM_WHO) continue; const A = g.orders.of(m), J0 = g.cover?.jobs?.get(m), J = J0 ?? g.cover?.keptJob?.(m), s = m.script, c = m.char;
          const op = g.doorTools.ops.find((o: any) => o.men.includes(m));
          this.say(`   @ ${m.callsign} ${at(c.pos)} aim ${Math.round(c.aimYaw * 57.3)} body ${Math.round(c.bodyYaw * 57.3)} · ${A ? `${A.order}${A.arrived ? '*' : ''}${A.spare ? ' spare' : ''} d ${A.post ? f1(flat(c.pos, A.post)) : '—'}${A.low ? ' low' : ''}` : 'no order'} · op ${op ? op.phase : '—'} · job ${J ? `${J0 ? '' : 'kept '}${J.o.id}${J.off ? ' off' : ''}${J.back ? ' back' : ''}` : '—'} · aimAt ${s?.aimAt ? `${Math.round(Math.atan2(s.aimAt[0] - c.pos[0], s.aimAt[2] - c.pos[2]) * 57.3)}${J && s.aimAt === J.aim ? ' (cover)' : A && s.aimAt === A.watch ? ' (order)' : ''}` : '—'} · ${m.state}${g.fight.engaged(m) ? ' engaged' : ''} v ${f1(Math.hypot(c.vel[0], c.vel[2]))}`); } }
      if (FIGHT_WIN && this.verbose && this.t >= FIGHT_WIN[0] && this.t <= FIGHT_WIN[1] && Math.floor(this.t * 10) !== Math.floor((this.t - DT) * 10)) {   // PT_FIGHT=a-b: the room fight's own state at 10 Hz
        const deg = (r: number) => Math.round(r * 57.3), RF = g.fight;
        for (const m of this.up) { const O = RF.opOf(m); if (!O) continue;
          this.say(`   ¦ ${m.callsign} ${at(m.char.pos)} aim ${deg(m.char.aimYaw)} body ${deg(m.char.bodyYaw)} · tgt ${O.tgt?.callsign ?? '-'} turn ${O.turn?.to.callsign ?? '-'} · track ${O.track.toFixed(2)} ready ${(O.readyAt - g.time).toFixed(2)}${m.muzzleDown ? ' · MUZZLE DOWN' : ''}${m.flashlight?.enabled ? ' · LIGHT' : ''} · lit ${m.visibility.toFixed(2)} · w ${(() => { const A = g.orders.of(m); return A?.watch ? at(A.watch) + (A.low ? ' LOW' : '') : '-'; })()} sam ${at(g.player.char.pos)}${m.script?.over ? ' · over' : ''} · step ${(g.time - O.stepT).toFixed(1)}${O.stepBy ? ' by ' + O.stepBy.by.callsign + ' ' + (g.time - O.stepBy.t).toFixed(1) + (g.col.segmentBlocked([m.char.pos[0], 1.55, m.char.pos[2]], [O.stepBy.by.char.pos[0], 1.1, O.stepBy.by.char.pos[2]]) ? ' NOLINE' : '') : ''} lost ${(g.time - O.lostAt).toFixed(1)} · held friend ${O.heldForFriend} line ${O.heldForLine} · sees ${[...O.meters].filter(([h]: any) => h.state !== 'dead').map(([h, M]: any) => { const V = g.fight.sightOn(m, h); return `${h.callsign} ${M.m.toFixed(2)}${g.time - M.seenT < 0.25 ? '*' : ''}${flat(m.char.pos, h.char.pos) < 9 ? `(${V.visible ? 'r' + V.rate.toFixed(2) : g.col.segmentBlocked([m.char.pos[0], 1.55, m.char.pos[2]], [h.char.pos[0], 1.1, h.char.pos[2]]) ? 'no line' : (() => { const C = canSeeChar(g, m, h.char, false); return C.inCone ? g.time < m.dazzledUntil ? 'dazzled' : 'hidden' : 'out of cone'; })()})` : ''}`; }).join(' ')}${NVGM.nvgDown(g, m) ? ' · NVG' : ''}`); }
        for (const h of this.hostiles) if (h.state !== 'dead' && this.up.some((m: any) => flat(m.char.pos, h.char.pos) < 10)) this.say(`   ¦   ${h.callsign} ${at(h.char.pos)} aim ${deg(h.char.aimYaw)} ${h.state} · lit ${h.visibility.toFixed(2)}${h.flashlight?.enabled ? ' · LIGHT' : ''}${h.foe ? ' · on ' + (h.foe === 'player' ? 'Sam' : h.foe.callsign) : ''}`);
      }
      const e = this.ended(); if (e) throw e;
      if (this.t >= this.cap) throw new Done('stalled', 'time cap');
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }
  /** the doorways of the doors locked against Sam that he is standing at (the grid knows no locks: its shortest way can run through a keypad door he has no code for) */
  private lockedAt(): Set<number> | null {
    const g = this.g, nav = g.col.nav, P = g.player, ring = P.codes.size ? new Set([...P.keys, ...P.codes]) : P.keys, dear = new Set<number>();
    for (const d of g.doors.list) { if (flat(this.pos, d.frameCentre) > 2 || !g.doors.lockedOut(d, this.pos, ring)) continue;
      const H = d.def.hinge, th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th);
      for (let s = 0; s <= d.def.width + 1e-6; s += 0.2) for (const n of [-0.3, 0, 0.3]) dear.add(nav.idx(Math.floor((H[0] + ux * s - uz * n) / nav.cell), Math.floor((H[1] + uz * s + ux * n) / nav.cell))); }
    return dear.size ? dear : null;
  }
  /** PT_SEARCH: a shut door he has walked into that is not locked against him he pushes open himself, as a player does with Space (the all-knowing commander
   *  never needed to: his walks follow doors the team has opened). True if he pushed one */
  private pushDoor(): boolean {
    const g = this.g; if (!SEARCH || g.player.down) return false;
    const d = g.doors.list.find((d: any) => d.isClosed() && !this.own.has(d) && flat(this.pos, d.frameCentre) < 1.6 && !g.doors.lockedOut(d, this.pos, g.player.keys)); if (!d || !g.selectVerb('door', 'push')) return false;
    this.I.pressed.add('Space'); this.say(`(Sam pushes ${d.def.name} open)`); return true;
  }
  /** An OPEN leaf he is wedged on that stands ACROSS his way and that the nav grid knows nothing of (a booted door stood into a walkway, its tip on a bench): he
   *  shuts it himself, as a player does with Space on its row. Only a leaf he is against (within 0.6 m of it) that his line to the waypoint `wp` crosses — a
   *  teammate he is wedged on beside an open door is not the door's doing —, never one that is off its hinges, that an order of his men is working, or that would
   *  latch locked across the rest of this walk, a teammate's way to him or his own trail (a keyed leaf nobody needs is shut, and `locks` says so in the record), and asked only
   *  where go() is about to give the walk up, so a run in which he never got that far plays as it did. True if he pressed the row (`leaves` has how it ended);
   *  PT_NOLEAF=1 = never: the commander who gave the walk up there */
  private shutLeaf(wp: number[], p: number[]): boolean {
    const g = this.g, P = this.pos; if (NOLEAF || g.player.down) return false;
    // (a leaf whose lock is still set latches locked once shut, against him and his men alike: only where the rest of this walk does not go through its doorway,
    // no living teammate's way to him does, and the trail his file walks does not)
    const near = (C: number[], a: number[], b: number[]) => { const ex = b[0] - a[0], ez = b[2] - a[2], t = Math.max(0, Math.min(1, ((C[0] - a[0]) * ex + (C[2] - a[2]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(C[0] - a[0] - ex * t, C[2] - a[2] - ez * t) < 0.7; };
    const via = (d: any, a: number[], b: number[]) => { const path: number[][] = [a, ...(g.col.nav.findPath(a, b, 6000) ?? []), b]; return path.some((w, i) => near(d.frameCentre, path[Math.max(0, i - 1)], w)); };
    const thru = (d: any) => via(d, P, p) || this.up.some((m: any) => via(d, m.char.pos, P)) || ((this.O.trail ?? []) as number[][]).some(c => flat(c, d.frameCentre) < 0.7);
    let ux = wp[0] - P[0], uz = wp[2] - P[2]; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
    const R = Math.max(L, 1.2), bx = P[0] + ux * R, bz = P[2] + uz * R;   // his line: to the waypoint, a stride at least
    const side = (ax: number, az: number, cx: number, cz: number, x: number, z: number) => (cx - ax) * (z - az) - (cz - az) * (x - ax);
    const d = g.doors.list.find((d: any) => { if (d.isClosed() || d.off || flat(P, d.frameCentre) > 2.5 || this.D.ops.some((o: any) => o.door === d) || (d.locked && !d.lockBroken && thru(d))) return false;
      const H = d.def.hinge, u = d.dir(), W = d.def.width, s = Math.max(0, Math.min(W, (P[0] - H[0]) * u[0] + (P[2] - H[1]) * u[1]));
      if (Math.hypot(P[0] - H[0] - u[0] * s, P[2] - H[1] - u[1] * s) > 0.6) return false;   // (he is against it)
      const tx = H[0] + u[0] * (W + 0.3), tz = H[1] + u[1] * (W + 0.3);   // the leaf, a shoulder past its tip
      return side(P[0], P[2], bx, bz, H[0], H[1]) * side(P[0], P[2], bx, bz, tx, tz) < 0 && side(H[0], H[1], tx, tz, P[0], P[2]) * side(H[0], H[1], tx, tz, bx, bz) < 0; });
    const row = () => { const i = g.nearby.findIndex((r: any) => r.kind === 'door' && r.verb === 'pull' && r.door === d && r.inReach); if (i < 0) return false; g.player.nearSel = i; pickHover(g); return true; };
    if (!d || !row()) return false;
    // A leaf being pulled to gives the pull up on any body it touches (doors.ts), his own first of all — and he is wedged on it. So: the row; if the pull was
    // lost on him a step clear of the leaf — straight out from the hinge past its tip, next time back the way he came — and the row again from there (it says
    // itself whether he is still in reach); then the leaf's seconds to latch
    const H = d.def.hinge, W = d.def.width, t0 = this.t, halt = () => g.player.down || !!(this.stop && this.stop());
    let rx = P[0] - H[0], rz = P[2] - H[1]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const outs: Vec3[] = [[H[0] + rx * (W + 0.6), 0, H[1] + rz * (W + 0.6)], [P[0] - ux * 0.4, 0, P[2] - uz * 0.4], [P[0] - ux * 0.7, 0, P[2] - uz * 0.7]];
    for (let k = 0; k <= outs.length && !d.isClosed() && !halt(); k++) {
      if (k && !row()) break;
      this.I.pressed.add('Space'); this.step();
      for (const t1 = this.t; g.player.doorMove?.d === d && this.t - t1 < 5 && !halt();) this.step();   // (a build where the row is a hand-worked move — hands.ts: his feet are the move's until it ends, and it ends on the pull)
      this.step(); if (d.closing || k === outs.length) break;   // (it holds: he is clear of it)
      this.goal = outs[k]; for (const t1 = this.t; this.t - t1 < 0.8 && flat(this.pos, outs[k]) > 0.12 && !halt();) this.step(); this.goal = null;
    }
    for (const t1 = this.t; !d.isClosed() && d.closing && this.t - t1 < 3 && !halt();) this.step();
    this.own.add(d); this.leaves.push({ door: d.def.name, t: +t0.toFixed(1), shut: d.isClosed(), ...(d.locked && !d.lockBroken ? { locks: true } : {}) });
    this.say(d.isClosed() ? `(Sam shut ${d.def.name}: its open leaf stood across his way)` : `(Sam pulled at ${d.def.name}, its open leaf across his way: it stands at ${Math.abs(d.angle).toFixed(2)} rad)`);
    return true;
  }
  /** walk to `p` along the nav path; a fresh path when shoved off his line, a step to one side then the other when wedged on something the grid does not know (an open leaf's tip, a teammate), given up after `max` seconds —
   *  unless what he is wedged on is a door locked against him: then once more by the way round it (`dear`), as a player would — or an open leaf across his way:
   *  then once more with it shut (`leaf` = that was tried this walk; shutLeaf) */
  go(p: Vec3, max = 45, again = 0, turns = 0, dear: Set<number> | null = null, leaf = false): boolean {
    const nav = this.g.col.nav; const path: Vec3[] = nav.findPath(this.pos, p, 6000, dear ? (ix: number, iz: number) => dear.has(nav.idx(ix, iz)) ? 20 : 1 : undefined) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    const t0 = this.t; let mark = [...this.pos], markT = this.t, k = 0;
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.35 : 0.6)) {
        this.step(); if (this.t - t0 > max) { this.goal = null; return false; }
        if (this.stop && this.stop()) { this.goal = null; return false; }
        if (++k % 20 === 0 && turns < 8 && this.g.col.solidBlocked([this.pos[0], 0.5, this.pos[2]], [wp[0], 0.5, wp[2]])) return this.go(p, max - (this.t - t0), again, turns + 1, dear, leaf);
        if (flat(this.pos, mark) > 0.25 || this.t - this.offAt < 0.5) { mark = [...this.pos]; markT = this.t; } else if (this.t - markT > 1.2) {
          if (again === 0 && this.pushDoor()) { this.step(45); return this.go(p, max - (this.t - t0), 1, turns, dear, leaf); }
          if (again >= 5) { const round = dear ? null : this.lockedAt();
            if (round) { this.say(`(a door locked against Sam at ${at(this.pos)}: round it to ${at(p)})`); return this.go(p, Math.max(20, max - (this.t - t0)), 0, turns, round, leaf); }
            if (!leaf && this.shutLeaf(wp, p)) return this.go(p, Math.max(20, max - (this.t - t0)), 0, turns, dear, true);   // (an open leaf across his way: shut it and walk on, once a walk)
            this.say(`(Sam is stuck at ${at(this.pos)} short of ${at(wp)} on the way to ${at(p)})`); this.goal = null; return false; }
          const dx = wp[0] - this.pos[0], dz = wp[2] - this.pos[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1;
          this.goal = [this.pos[0] + dz / L * sd * 0.9, 0, this.pos[2] - dx / L * sd * 0.9]; this.step(30);
          return this.go(p, max - (this.t - t0), again + 1, turns, dear, leaf);
        }
      }
    }
    this.goal = null; return true;
  }
  give(id: string, target: any, label: string): boolean {
    const why = this.O.give(id, target, this.who); this.orders++;
    if (why && process.env.PT_REFUSED && target?.kind === 'door') { const O: any = this.O, d = target.door, men = O.men("all"), g: any = this.g, nav = g.col.nav; const fm = O.forMen(target, men);
      this.say(`   dbg refused: target.side ${target.side} forMen ${fm.side} faceFlip ${O.faceFlip} men ${men.length} sam ${at(g.player.char.pos)} door ${d.def.name} hinge ${d.def.hinge} dir ${d.def.closedDir.toFixed(2)} angle ${d.angle.toFixed(2)} latched ${d.latched}`);
      for (const side of [1, -1]) { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], H = d.def.hinge, w = d.def.width, front = [d.frameCentre[0] + n[0] * 0.55, 0.45, d.frameCentre[2] + n[1] * 0.55];
        const row: string[] = []; for (const al of [w + 0.45, w + 1.35, w + 2.25, -0.45, -1.35, -2.25, -3.15]) { const P = [H[0] + u[0] * al + n[0] * 0.55, 0, H[1] + u[1] * al + n[1] * 0.55]; row.push(`${at(P as any)} nav ${nav.isBlocked(P[0], P[2]) ? 'X' : 'ok'} line ${g.col.solidBlocked(front, [P[0], 0.45, P[2]]) ? 'X' : 'ok'}`); }
        for (const [nm, a2] of [['glass', [true, false]], ['plain', [false, false]], ['hall', [false, true]]] as any) { let r: any = null; try { r = O.stackPostsOn(d, side, men, [], ...a2); } catch (e) { r = 'threw ' + e; } row.push(`${nm}: ${r ? (r.length ?? r) : 'null'}`); }
        this.say(`   dbg side ${side}: ${row.join(' | ')} · held ${[...O.asg].filter(([gd, A]: any) => A.door === d && A.post).map(([gd, A]: any) => gd.callsign + at(A.post)).join(',')}`); } }
    if (why) { this.refused.push(`${id} ${label}: ${why}`); this.say(`order ${id} · ${label} — REFUSED: ${why}`); return false; }
    this.say(`order ${id} · ${label}`); this.step(); return true;
  }
  fallIn() { return this.give('fallIn', this.O.targetAt(this.pos), 'on Sam'); }
  free(p: number[]): Vec3 | null { const nav = this.g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; }
  pathLen(a: number[], b: number[]): number { const path = this.g.col.nav.findPath(a, b); if (!path) return Infinity; let L = 0, q = a; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, b); }
}

/** the rooms that still hold a living defender who is at home, by the room fight's own model — and their entries */
function heldRooms(P: Player): { room: any; men: any[] }[] {
  const g = P.g, by = new Map<any, any[]>();
  for (const d of g.fight.defs) { if (!d.room || !d.room.entries.length || d.room.cells.size > 500 || d.gd.state === 'dead') continue; by.set(d.room, [...(by.get(d.room) ?? []), d.gd]); }
  return [...by].map(([room, men]) => ({ room, men }));
}

/** PT_TOOL=hold — the commander's half of 'work it and hold until told' (thresholdHold): he waits for the lead's "holding on the door" (the door has gone
 *  quiet), takes REACT seconds to say it, and says 'bang, then step in' when a blind pocket's worth of the room's floor is still unseen by the stage's own
 *  count (DOORTOOLS.thrPocket cells; no model of the room: he cannot know, so he bangs), 'step in' when not — or when the bang is refused in words (no can
 *  left, a teammate behind the door) */
function followUp(P: Player, d: any) {
  const mine = () => P.D.ops.find((o: any) => o.door === d && o.thrHold);
  P.until(() => !mine() || !!mine().thr?.told, 60);
  let op = mine(); if (!op) { P.say(`(the hold on ${d.def.name} ended before it went quiet)`); P.told.push('ended first'); return; }
  if (!op.thr?.told) P.say(`(${d.def.name} had not gone quiet in a minute — ${op.phase}: told anyway)`);
  P.wait(REACT); op = mine();
  if (!op) { P.say(`(the hold on ${d.def.name} ended before he spoke)`); P.told.push('ended first'); return; }
  if (op.phase !== 'thr') { P.say(`(nothing to tell ${d.def.name}: the order is at '${op.phase}', not holding on the jambs)`); P.told.push('not holding'); return; }
  const K = feelTables().DOORTOOLS, SR = op.search; let unseen = Infinity;
  if (SR) { unseen = 0; for (let i = 0; i < SR.pts.length; i++) if (!SR.looked[i] && !op.thr.banged?.[i]) unseen++; }
  const t = P.O.targetAt(d.frameCentre); let what: 'bang' | 'step' = TELL === 'bang' || TELL === 'step' ? TELL : unseen >= K.thrPocket ? 'bang' : 'step';
  let why = P.D.thresholdThen(what, P.up, t); P.orders++;
  if (typeof why === 'string' && what === 'bang') { P.refused.push(`bang, then step in · ${d.def.name}: ${why}`); P.say(`told bang, then step in · ${d.def.name} — REFUSED: ${why}`); P.told.push('bang refused'); what = 'step'; why = P.D.thresholdThen('step', P.up, t); P.orders++; }
  if (typeof why === 'string') { P.refused.push(`step in · ${d.def.name}: ${why}`); P.say(`told step in · ${d.def.name} — REFUSED: ${why}`); P.told.push('step refused'); return; }
  P.told.push(what); P.say(`told ${what === 'bang' ? 'bang, then step in' : 'step in'} · ${d.def.name} · ${Number.isFinite(unseen) ? `${unseen} cells unseen` : 'no model of the room'}`); P.step();
}

/** ONE DOOR WORKED, as the scripted player works every door: Sam to a post short of it, the team gathered, 'stack up', the tool ('bang and clear' while there is
 *  a can, else 'open and clear'; PT_TOOL / PT_WEDGED as the head says), the order waited out, Sam in behind them, 'fall in'. False = every order was refused
 *  at this door (no room at its jambs) — both commanders' (playRooms, playSearch): the same statements in the same order as when they stood in playRooms' loop */
/** `later` = PT_DIRECT's commander past his first door: the tool given straight, no fall in / stack before it */
function workDoor(P: Player, best: { room: any; ent: any; men: any[] }, later = false): boolean {
  const g = P.g;
  if (WALL && WALL.wallEntry(P, best, heldRooms(P))) return true;   // (PT_WALL: through the room's wall instead, where one allows)
  const { ent } = best, d = ent.door, ox = ent.out[0], oz = ent.out[1], lx = -oz, lz = ox, name = d.def.name;
  const outPt = (back: number, lat: number): number[] => [ent.at[0] + ox * back + lx * lat, 0, ent.at[2] + oz * back + lz * lat];
  const gate = outPt(0.7, 0), clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
  // where a player stands to give the order: a few metres from the opening on its own side (the same piece of floor as the door's mouth: a walk from there
  // to here is about as long as the straight line — never the room across the corridor), off the opening's line where the floor allows, the nearest such on foot
  let post: Vec3 | null = null, postL = Infinity;
  for (const pass of [1.2, 0]) { for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.0, 2.8], [2.0, -2.8], [1.3, 3.2], [1.3, -3.2], [1.3, 4.2], [1.3, -4.2], [5.2, 0.6], [3.6, 0.5], [3.6, -0.5], [2.6, 0]]) {
      if (Math.abs(lat) < pass) continue; const p = P.free(outPt(back, lat)); if (!p || !clearTo(p) || flat(p, ent.at) < 2.2) continue;
      if (P.pathLen(gate, p) > flat(gate, p) * 1.4 + 0.8) continue;
      const L = P.pathLen(P.pos, p); if (L < postL) { post = p; postL = L; } }
    if (post) break; }
  post ??= P.free(outPt(2.5, 0)) ?? (outPt(2.5, 0) as Vec3);
  P.say(`→ ${name}${SEARCH ? '' : ` (${best.men.length} at home)`}, from ${at(post)}`);
  if (!later && (!P.O.of(P.up[0]) || P.O.of(P.up[0]).order !== 'fallIn')) P.fallIn();
  if (!P.go(post, 60)) P.say(`Sam did not reach ${at(post)} (at ${at(P.pos)})`);
  if (!later) P.until(() => P.up.every((m: any) => flat(m.char.pos, P.pos) < 4.5), 10);
  const target = () => P.O.targetAt(d.frameCentre);
  if (!later && P.give('stack', target(), name)) { P.until(() => P.up.every((m: any) => P.O.of(m)?.arrived), 25); P.wait(STACKWAIT); }
  // PT_WEDGED=charge: a door the stack found wedged from inside (digin.ts; read off the door itself — in play a teammate at it says so) gets a charge instead of the boot, blown once it is set
  let charged = false;
  if (WEDGED === 'charge' && !THR && d.locked && String(d.lockId).startsWith('wedge:') && P.D.charges > 0 && P.give('charge', target(), name)) {
    charged = true; P.say(`(wedged: a charge on ${name})`);
    const armed = () => P.D.ops.some((o: any) => o.door === d && o.phase === 'armed');
    P.until(() => armed() || !P.D.ops.some((o: any) => o.door === d), 40);
    if (armed()) { P.wait(0.8); P.D.blow(); P.orders++; P.say(`blows ${name}`); }
    else { charged = false; P.say(`(the charge on ${name} was never set: the usual tool)`); }
  }
  const usual = P.D.bangs > 0 ? 'bangClear' : 'openClear', tool = FRAGS && !THR && P.D.frags > 0 ? 'fragClear' : usual;   // (PT_FRAG=1: the squad's frags first; refused — a mate behind the door, hostages — the usual tool)
  const thr = THR ? P.D.order('threshold', P.up, d, P.O.big ? P.O.sideFor(d, P.up, target().side) : target().side, null, HOLD) : null;   // (PT_TOOL=threshold / hold: every held room is worked from the threshold instead — doortools.ts)
  if (typeof thr === 'string') { P.refused.push(`threshold · ${name}: ${thr}`); P.say(`order threshold · ${name} — REFUSED: ${thr}`); } else if (thr) { P.orders++; P.thr++; P.say(`order threshold · ${name}`); P.step(); }
  if (!charged && !(thr && typeof thr !== 'string') && !P.give(tool, target(), name) && !(tool === 'fragClear' && P.give(usual, target(), name)) && !((tool === 'bangClear' || tool === 'fragClear' && usual === 'bangClear') && P.give('openClear', target(), name))) return false;
  P.rooms++;
  P.until(() => P.D.ops.some((o: any) => o.door === d), 3);
  if (HOLD && thr && typeof thr !== 'string') followUp(P, d);
  P.until(() => !P.D.ops.some((o: any) => o.door === d), 70);
  // (DOORTOOLS.testDoor: an order given straight at a door nobody had tried stops when the lead finds it locked or wedged — the row again is the one that boots it, as a player gives it)
  if (!d.off && d.latched && Math.abs(d.angle) < 0.05 && (P.D as any).knownShut?.(d, target().side) && P.up.length) {
    P.say(`(${name} found shut: the row again)`); P.wait(1);
    if (P.give(usual, target(), name) || P.give('openClear', target(), name)) { P.until(() => P.D.ops.some((o: any) => o.door === d), 3); P.until(() => !P.D.ops.some((o: any) => o.door === d), 70); }
  }
  if (HURRY) return true;   // (PT_HURRY=1: straight on to the next door, no walk in, no gathering)
  P.wait(2);
  // Sam walks in behind them, as a player does, then gathers them
  let inside: Vec3 | null = null; for (const b of [2.5, 2.0, 1.5]) { const p = outPt(-b, 0); if (!g.col.nav.isBlocked(p[0], p[2])) { inside = p as Vec3; break; } }
  if (inside) P.go(inside, 25);
  P.wait(1);
  if (SIT > 0 && P.up.length) { P.say(`sitting ${SIT} s in the taken room`); P.wait(SIT); }   // (PT_SIT=N: the team sits N s on its sectors in each taken room before it is gathered — a team that gives the floor time)
  if (SHUT && P.up.length) for (const x of new Set<any>([d, ...(best.room?.entries ?? []).map((e: any) => e.door)])) {   // (PT_SHUT=1: the door he came in by, then the room's other doors — each one that stands open is shut on his order, one man each, before the team is gathered)
    if (!x || x.latched || x.off || Math.abs(x.angle) < 0.6 || !P.up.length) continue; const t0 = P.t;
    if (P.give('shutDoor', P.O.targetAt(x.frameCentre), x.def.name)) P.until(() => x.latched || !P.up.some((m: any) => P.O.of(m)?.order === 'shutDoor'), 30);
    P.shut.push({ door: x.def.name, t: +t0.toFixed(1), secs: +(P.t - t0).toFixed(2), latched: !!x.latched, ref: x }); }
  if (P.up.length && !DIRECT) { P.fallIn(); P.wait(2.5); if (PAUSE > 0) P.wait(PAUSE); }
  return true;
}

/** PT_SNATCH=cover (a snatch level, the four): before anything loud the BLUE pair is sent to a post on the man's nearest way out — `SNATCH_BACK` m short of it
 *  along his own walk there — and the rooms are then worked with RED alone; PT_SNATCH=front (or unset) = everybody in the front, as on any level */
function snatchCover(P: Player) {
  const g = P.g, S = g.snatch; if (SNATCH_PLAN !== 'cover' || !S?.active || !P.O.big) return;
  const N = g.level.scenarios.snatch, way = g.col.nav.findPath(N.man.pos, N.exits[0].pos) as Vec3[] | null; if (!way?.length) { P.say('snatch: no walk from the man to his way out'); return; }
  const path: Vec3[] = [[N.man.pos[0], 0, N.man.pos[2]], ...way, [N.exits[0].pos[0], 0, N.exits[0].pos[2]]]; let back = SNATCH_BACK, post: Vec3 = path[0];
  for (let i = path.length - 1; i > 0; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); post = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; break; } back -= L; }
  post = P.free(post) ?? post;
  const blue = P.O.men('blue');
  if (SNATCH_VIA) { const via = P.free(SNATCH_VIA) ?? SNATCH_VIA, no = P.O.give('move', P.O.targetAt(via), 'blue'); P.orders++;   // (PT_SNATCH_VIA=x,z: the pair goes by that point first — the long dark way round)
    if (no) P.say(`snatch: blue by ${at(via)} REFUSED — ${no}`); else { P.say(`order move · blue by ${at(via)} first`); P.step(); P.until(() => !!S.end || blue.every((m: any) => m.state === 'dead' || flat(m.char.pos, via) < 2.6), 60); } }
  const why = P.O.give('move', P.O.targetAt(post), 'blue'); P.orders++;
  if (why) { P.say(`snatch: blue to the back REFUSED — ${why}`); P.refused.push(`move blue: ${why}`); return; }
  P.say(`order move · blue to ${at(post)}, ${f1(SNATCH_BACK)} m short of ${N.exits[0].name}`); P.step();
  P.until(() => !!S.end || blue.every((m: any) => m.state === 'dead' || flat(m.char.pos, post) < 2.6), 60);
  P.say(`blue ${blue.map((m: any) => `${m.callsign} ${m.state === 'dead' ? 'down' : at(m.char.pos)}`).join(' · ')} — red goes in`);
  P.who = 'red';
}
/** a snatch level, the man alive and not in hand: the commander walks to him with whoever is HIS (the pair that went in with him while a pair is posted on
 *  the way out — that pair stays on it, or he would be out the moment it left; everybody when nobody is posted) — close to, his hands go up; a man beside
 *  him for three seconds ties him */
function snatchTake(P: Player) {
  const g = P.g, S = g.snatch; if (!S?.active) return;
  for (let k = 0; k < 8 && !S.end && !S.inHand && P.upAll.length; k++) {
    const p = S.man.char.pos; P.say(`snatch: to ${S.man.civ.name} ${at(p)} (${S.handsUp ? 'hands up' : S.man.civ.state})${P.who === 'all' ? '' : ` · ${P.who} with him, the posted pair holds`}`);
    if (P.up.length) P.fallIn(); const q = P.free([p[0], 0, p[2]]) ?? p; const stop0 = P.stop; P.stop = () => !!S.end || S.inHand || flat(P.pos, S.man.char.pos) < 2.2; P.go(q, 40); P.stop = stop0;
    P.until(() => !!S.end || S.inHand, 6);
  }
}
/** between rooms: the man is loose and has stopped (hands up, or gone to ground in a corner with both ways out held) — he is the next thing done, before
 *  the next room: left alone he runs again */
function snatchSecure(P: Player) {
  const g = P.g, S = g.snatch; if (!S?.active || S.end || S.inHand) return;
  if (S.handsUp || S.man.civ.state === 'cower') snatchTake(P);
}
/** PT_BREAKER: the mains cut before the first room — Sam walks to the breaker with the team behind him, the squad's 'work' order (or his own hand) throws it */
function cutMains(P: Player) {
  const g = P.g, th = g.work?.things().find((x: any) => x.kind === 'breaker'), B = g.level.breaker;
  if (!B) { P.say('PT_BREAKER: the level has no breaker'); return; }
  const stand: Vec3 = th?.stand ?? [B.pos[0], 0, B.pos[2]];
  const from: Vec3 = BREAKER_FROM.length === 2 && BREAKER_FROM.every(Number.isFinite) ? [BREAKER_FROM[0], 0, BREAKER_FROM[1]] : (P.free([stand[0] + (th?.n?.[0] ?? 0) * 2, 0, stand[2] + (th?.n?.[2] ?? 0) * 2]) ?? stand);
  P.say(`PT_BREAKER=${BREAKER}: to the breaker first, from ${at(from)}`);
  P.go(from, 60);
  if (BREAKER === 'sam') { P.go(stand, 20); P.wait(1); if (!g.blackout.active) g.setBlackout(86400, 'hand'); }
  else if (!th) P.say('PT_BREAKER=order: no thing to work (WORK.on is off on this stand?)');
  else { P.wait(1.5); if (P.give('work', { kind: 'floor', at: stand, thing: th }, 'the breaker')) P.until(() => g.blackout.active, 45); }
  if (!g.blackout.active) P.say('PT_BREAKER: the mains were NOT cut');
  if (PT_NV && g.blackout.active) { g.player.nv = true; P.say('(Sam: goggles down)'); }
  P.wait(1);
}
/** PT_HALL=bare (env, a TOOL-ONLY arm for a level whose structure has a room 'hall' — levels/hall.json): before the rooms THE FILE WALKS THE HALL. The first
 *  teammate alone is told 'move there' down the line of the hall's own door in `HALL_BOUND` m bounds and then 'cover' its far end; each of the others is told
 *  'move there' onto that line behind him, `HALL_GAP` m apart; Sam comes last (in this tool his body stops rounds: ahead of a man he would be cover no player
 *  is). It was the CONTROL of two arms led by a ballistic shield (`file`, and `low` with the carrier crouched): the shield is gone from the game (10-18), so
 *  those two words are refused in words and the numbers taken under `bare` still mean what they did. Ends when no living defender is inside the hall's bounds
 *  (down, or gone out of it), the lead is down, or the last bound is stood. AS MEASURED: 'cover' is given only once the file is up behind him, so until then
 *  the lead's gun is on whatever watch 'move there' fitted him (roomfit.ts — a near uncleared door as likely as the hall's length). Under PT_SEARCH nothing of
 *  this runs (playSearch is another commander). */
function hallLead(P: Player) {
  if (!HALL_ARM) return;
  if (HALL_ARM === 'file' || HALL_ARM === 'low') throw new Error(`PT_HALL=${HALL_ARM} walked a ballistic shield down the hall, and the shield is gone from the game: PT_HALL=bare is the same walk led by the first teammate`);
  if (HALL_ARM !== 'bare') throw new Error(`PT_HALL: '${HALL_ARM}' is not bare`);
  const g = P.g, R = g.roomClear?.structure?.rooms.find((r: any) => r.id === 'hall'), c = P.team[0] ?? null;
  if (!R || !c) { P.say(`hall: ${R ? 'no teammate to lead' : "the structure has no room 'hall'"} — the usual commander`); return; }
  const b = R.bounds, alongX = b.x1 - b.x0 >= b.z1 - b.z0, lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, d0 = g.doors.list.find((d: any) => d.def.name === R.doors?.[0]?.id), mid = d0 ? (alongX ? d0.frameCentre[2] : d0.frameCentre[0]) : alongX ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2;   // (the line of the hall's own door: the file walks in on it)
  const near = Math.abs((alongX ? P.pos[0] : P.pos[2]) - lo) <= Math.abs((alongX ? P.pos[0] : P.pos[2]) - hi) ? lo : hi, far = near === lo ? hi : lo, s = Math.sign(far - near);
  const pt = (along: number): Vec3 => alongX ? [near + s * along, 0, mid] : [mid, 0, near + s * along];
  const fl = (p: Vec3) => ({ kind: 'floor', at: P.O.freeSpot(p) ?? p }), len = Math.abs(far - near);
  const home = () => P.hostiles.filter((h: any) => h.state !== 'dead' && h.char.pos[0] > b.x0 && h.char.pos[0] < b.x1 && h.char.pos[2] > b.z0 && h.char.pos[2] < b.z1);
  const over = () => c.state === 'dead' || !home().length;
  const tell = (id: string, to: Vec3, m: any, label: string): boolean => { const why = P.O.give(id, fl(to), m); P.orders++; if (why) { P.refused.push(`${id} ${label}: ${why}`); P.say(`order ${id} · ${label} — REFUSED: ${why}`); return false; } P.say(`order ${id} · ${label}`); P.step(); return true; };
  const run = (pred: () => boolean, secs: number, sam: Vec3 | null) => { for (let i = 0; i < secs * 60 && !pred(); i++) { if (sam) P.goal = flat(P.pos, sam) > 0.4 ? sam : null; P.step(); } P.goal = null; };
  P.fallIn(); P.wait(1.5);
  P.say(`hall: ${c.callsign} leads · ${f1(len)} m, ${home().length} at its far end`);
  let stood = 0;
  for (let along = HALL_FIRST; along <= len - HALL_SHORT + 0.01 && !over(); along += HALL_BOUND) {
    const mark = pt(along), rest = P.upAll.filter((m: any) => m !== c);
    if (!tell('move', mark, c, `${c.callsign} to ${at(mark)}`)) break;
    const samAt = (k: number) => P.free(pt(Math.max(-3, along - HALL_GAP * (k + 1) - 0.6)));
    run(() => over() || !!P.O.of(c)?.arrived || flat(c.char.pos, mark) < 2.2, 14, stood ? samAt(rest.length) : null);   // (the lead is ahead before the file moves)
    rest.forEach((m: any, k: number) => { if (m.state !== 'dead') tell('move', pt(along - HALL_GAP * (k + 1)), m, `${m.callsign} in behind him`); });
    run(() => over() || (!!P.O.of(c)?.arrived && rest.every((m: any) => m.state === 'dead' || P.O.of(m)?.arrived)), 14, samAt(rest.length));
    if (over()) break;
    tell('cover', pt(len - 1.5), c, `${c.callsign} on the hall's far end`);
    run(over, HALL_HOLD, samAt(rest.length)); stood++;
  }
  if (!over()) run(over, 8, null);
  P.say(`hall: ${c.state === 'dead' ? `${c.callsign} is down` : !home().length ? 'nobody of theirs is left in it' : 'the last bound is stood'} · ${stood} bound${stood === 1 ? '' : 's'} · team ${P.upAll.length}`);
}
function playRooms(P: Player) {
  snatchCover(P); hallLead(P);
  const heard = new Set<string>();
  const routed = new Set<string>();
  const g = P.g, tried = new Map<any, number>(), no = new Set<any>();   // entries per room so far · entries that refused every order (no room at the jambs: a player takes the room's other door)
  P.fallIn(); P.wait(1.5);
  if (BREAKER) { cutMains(P); P.fallIn(); P.wait(1.5); }
  for (let round = 0; round < 24; round++) {
    snatchSecure(P);
    if (!P.up.length && P.upAll.length) { snatchTake(P); if (!P.up.length) { P.wait(2); continue; } }   // (a snatch: his own pair is down and the man is loose — he goes for him alone, then the posted pair is his)
    let held = heldRooms(P).filter(h => (tried.get(h.room) ?? 0) < 3);
    if (!held.length) break;
    if (round === 0 && FIRST) { const R = g.roomClear.structure?.rooms.find((r: any) => r.id === FIRST); if (!R) throw new Error(`PT_FIRST: the structure has no room '${FIRST}'`); const c: Vec3 = [(R.bounds.x0 + R.bounds.x1) / 2, 0, (R.bounds.z0 + R.bounds.z1) / 2]; const h = held.filter(x => x.room === g.fight.roomAt(c)); if (h.length) held = h; }
    // PT_ROUTE: the first listed door not yet ordered whose room is still held is the door he takes next (the list done, or none of it held: the nearest, as ever)
    for (const name of ROUTE) if (!g.doors.list.some((d: any) => d.def.name === name)) throw new Error(`PT_ROUTE: the level has no door '${name}'`);
    let routeDoor = ''; for (const name of ROUTE) { if (routed.has(name)) continue; const h = held.filter(x => x.room.entries.some((e: any) => e.door.def.name === name && !no.has(e))); if (h.length) { held = h; routeDoor = name; routed.add(name); break; } }
    // the nearest entry of the nearest held room, on foot
    let best: { room: any; ent: any; L: number; men: any[] } | null = null;
    const said = saidHeld(P), other = said.size > 0 && held.some(h => h.room.entries.some((e: any) => !said.has(e.door.def.name) && !no.has(e)));   // (PT_LISTEN)
    for (const h of held) for (const ent of h.room.entries) { if (no.has(ent) && h.room.entries.some((e: any) => !no.has(e))) continue;
      if (routeDoor && ent.door.def.name !== routeDoor) continue;
      if (DOOR && ent.door.def.name !== DOOR && h.room.entries.some((e: any) => e.door.def.name === DOOR && !no.has(e))) continue;   /* (PT_DOOR: a room that has that door is taken by it) */
      if (other && said.has(ent.door.def.name)) { if (!heard.has(ent.door.def.name)) { heard.add(ent.door.def.name); P.say(`(heard: they have ${ent.door.def.name} — another way)`); } continue; } const out: Vec3 = [ent.at[0] + ent.out[0] * 1.5, 0, ent.at[2] + ent.out[1] * 1.5]; const L = P.pathLen(P.pos, P.free(out) ?? out); if (!best || L < best.L) best = { room: h.room, ent, L, men: h.men }; }
    if (!best || !Number.isFinite(best.L)) { P.say('no way on foot to any held room'); break; }
    tried.set(best.room, (tried.get(best.room) ?? 0) + 1);
    if (!workDoor(P, best, DIRECT && round > 0)) { const ent = best.ent; no.add(ent); tried.set(best.room, (tried.get(best.room) ?? 1) - 1); if (best.room.entries.every((e: any) => no.has(e))) tried.set(best.room, 99); P.wait(1); continue; }
    if (HURRY) continue;
    if (WAIT > 0 && P.up.length && heldRooms(P).length) { P.say(`(waits ${WAIT} s before the next room)`); P.wait(WAIT); }
  }
  // whoever is left is not at home: walk the rooms with the team behind until the scenario ends or time runs out
  snatchTake(P);
  const rooms = [...new Set(g.fight.defs.map((d: any) => d.room).filter((r: any) => r && r.entries.length && r.cells.size <= 500))] as any[];
  for (let lap = 0; lap < 3; lap++) {
    snatchTake(P);
    const sweep = () => { for (const room of rooms) { const e = room.entries[0]; const p = P.free([e.at[0] - e.out[0] * 2, 0, e.at[2] - e.out[1] * 2]); if (p) { P.say(`sweep → ${e.door.def.name}`); P.go(p, 40); P.wait(3); } } };
    if (!HUNT_FIRST) sweep();
    // … and a man who has left the rooms altogether (out on the open floor, back on his rounds): the team is walked to where he is, as a player hunting the
    // last one would — to a few metres short of him, then the team sent on to where he stands, so it is the team's guns that find him
    for (const h of P.hostiles) { if (h.state === 'dead') continue; const hp = h.char.pos, way = g.col.nav.findPath(P.pos, hp) as Vec3[] | null; if (!way) continue;   // (no way to him on foot: not ours to hunt)
      const path: Vec3[] = [[P.pos[0], 0, P.pos[2]], ...way, [hp[0], 0, hp[2]]]; let back = 3.5, p: Vec3 | null = null;
      for (let i = path.length - 1; i > 0 && !p; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); p = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; } else back -= L; }
      P.say(`hunt → ${h.callsign} ${at(hp)}`); P.fallIn(); if (p) P.go(P.free(p) ?? p, 40); P.wait(2);
      // … and sent on to where he stands NOW ('move' on that floor: gun up on the way, their own eyes do the rest)
      if (h.state !== 'dead' && P.up.length) { const now = h.char.pos, spot: Vec3 = [now[0], 0, now[2]], T = P.O.targetAt(spot);   // (a man standing beside a door: the floor he is on, not the door — 'move' fits no door, and the hunt ended there)
        if (!P.give('move', T.kind === 'door' ? { kind: 'floor', at: spot } : T, `on ${h.callsign}`)) for (const k of [1.2, 2.0, 3.0]) { const d = flat(P.pos, now) || 1, q: Vec3 = [now[0] + (P.pos[0] - now[0]) * k / d, 0, now[2] + (P.pos[2] - now[2]) * k / d];
          const t = P.O.targetAt(q); if (t.kind !== 'door' && P.give('move', t, `short of ${h.callsign}`)) break; }   // (still refused: floor a stride or three short of him, toward the commander)
        P.until(() => h.state === 'dead' || !P.up.length, 12); } }
    if (HUNT_FIRST) sweep();
  }
  P.wait(20);
}

function playRescue(P: Player) {
  const g = P.g, R = g.rescue, S = g.level.scenarios.rescue, B = R.bounds;
  const D = g.doors.byName(S.room.door), c = D.frameCentre, th = D.def.closedDir, u = [Math.cos(th), Math.sin(th)]; let n = [-u[1], u[0]];
  if (n[0] * (c[0] - (B.x0 + B.x1) / 2) + n[1] * (c[2] - (B.z0 + B.z1) / 2) < 0) n = [-n[0], -n[1]];
  const sg = Math.sign((S.team.sam[0] - c[0]) * u[0] + (S.team.sam[2] - c[2]) * u[1]) || -1;
  const raw: Vec3 = [c[0] + n[0] * 1.3 + u[0] * sg * 2.6, 0, c[2] + n[1] * 1.3 + u[1] * sg * 2.6], post: Vec3 = P.O.freeSpot(raw) ?? raw;
  P.fallIn(); P.wait(1);
  // PT_TECH=cue: the commander ACTS ON WHAT THEIR NET SAYS (Hard's rescue crew — rescue.ts crew(): each of those men says what he is doing as he does it). He
  // listens for it up to four seconds before he moves. 'i can see your door from here' / 'i've got your door from the side' (a gun in a side room on the floor
  // a stack stands on): that side room is taken first — bang and clear by a door of its own that does not look at the stack — and then the hostage room.
  // 'staying dark — i'll come up behind them': the last man in the file is told to cover the door he is by when it is said (else the way they came) and stays
  // on it; the other takes the hostage room (both said: the side room first, with every man, and no cover — tried: it left one man to take the hostage room late, and lost him). Nothing said (Standard): the usual entry, four seconds late
  let cov: any = null;   // (PT_TECH=cue: the man left on a cover — he is not waited for at the posts; F leaves him on it)
  if (TECH === 'cue') {
    const L = R.log as { what: string }[], said = (k: string) => L.some(x => x.what.startsWith(`crew:${k}`)), other = (d: any) => d !== D && d.def.name !== S.side?.door;
    P.until(() => (said('cross') || said('in')) && (said('wait') || said('cross:Roamer')), 4);
    const cover = () => {
      const m = [...P.up].sort((a: any, b: any) => flat(b.char.pos, P.pos) - flat(a.char.pos, P.pos))[0];
      const by = (g.doors.list as any[]).filter(d => other(d) && flat(d.frameCentre, m.char.pos) < 6).sort((a, b) => flat(a.frameCentre, m.char.pos) - flat(b.frameCentre, m.char.pos))[0] ?? null;
      const give = (d: any | null) => { const t = d ? { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: Math.sign((m.char.pos[0] - d.frameCentre[0]) * -Math.sin(d.def.closedDir) + (m.char.pos[2] - d.frameCentre[2]) * Math.cos(d.def.closedDir)) || 1 } : { kind: 'floor', at: S.team.sam };
        const why = P.O.give('cover', t, m); P.orders++; P.say(`order cover · ${m.callsign} · ${d ? d.def.name : 'the way we came'}${why ? ` — REFUSED: ${why}` : ''}`); if (why) P.refused.push(`cover ${d ? d.def.name : 'back'}: ${why}`); P.step(); if (!why) cov = m; return !why; };
      if (!give(by) && by) give(null);
    };
    if (said('wait') && !said('cross') && P.up.length > 1) cover();
    // a gun on the hostage door from a side room: that room is cleared first, by a door of its own that does NOT look at the stack (bang and clear, the order
    // menu's), and then the hostage room as ever
    if (said('cross') && P.up.length > 0) {
      const out: Vec3 = [c[0] + n[0], 0, c[2] + n[1]];
      const looks = (g.doors.list as any[]).filter(d => other(d) && flat(d.frameCentre, out) > 2 && flat(d.frameCentre, out) <= 10 && !g.col.shotBlocked([d.frameCentre[0], 1.5, d.frameCentre[2]], [out[0], 1.2, out[2]])).sort((a, b) => flat(a.frameCentre, out) - flat(b.frameCentre, out))[0];
      const room = looks ? (g.fight.rooms as any[]).filter(r => r !== g.fight.roomAt(out) && r.entries.some((e: any) => e.door === looks))[0] : null;
      const ent = room ? (room.entries as any[]).filter(e => e.door !== looks && other(e.door)).sort((a, b) => P.pathLen(P.pos, [a.at[0] + a.out[0] * 1.5, 0, a.at[2] + a.out[1] * 1.5]) - P.pathLen(P.pos, [b.at[0] + b.out[0] * 1.5, 0, b.at[2] + b.out[1] * 1.5]))[0] : null;
      if (ent) {
        const d = ent.door, uu = [Math.cos(d.def.closedDir), Math.sin(d.def.closedDir)], sg2 = Math.sign((P.pos[0] - ent.at[0]) * uu[0] + (P.pos[2] - ent.at[2]) * uu[1]) || 1;
        const raw2: Vec3 = [ent.at[0] + ent.out[0] * 1.3 + uu[0] * sg2 * 2.4, 0, ent.at[2] + ent.out[1] * 1.3 + uu[1] * sg2 * 2.4], post2: Vec3 = P.O.freeSpot(raw2) ?? raw2;
        P.say(`→ their net: a gun on the hostage door from a side room — that room first, by ${d.def.name} ${at(post2)}`);
        if (!P.go(post2, 60)) P.say(`Sam did not reach it (at ${at(P.pos)})`);
        P.until(() => P.up.every((m: any) => flat(m.char.pos, P.pos) < 5), 5);
        if (P.give(P.D.bangs > 0 ? 'bangClear' : 'openClear', P.O.targetAt(d.frameCentre), d.def.name)) { P.rooms++; P.until(() => P.D.ops.some((o: any) => o.door === d), 3); P.until(() => !P.D.ops.some((o: any) => o.door === d) || P.up.some((m: any) => g.fight.roomAt(m.char.pos) === room) && !(P.hostiles as any[]).some(h => h.state !== 'dead' && g.fight.roomAt(h.char.pos) === room), 30); P.wait(0.6); P.fallIn(); }   // (the room's man down: he does not wait for the search to end)
      } else { P.say(`(their net: a gun on the hostage door — ${looks ? `no other way into the room behind ${looks.def.name}` : 'no open door looks at it'}: the usual entry)`); if (said('wait') && P.up.length > 1) cover(); }
    }
  }
  // PT_RESCUE=split: THE TWO DOORS ON ONE WORD, the way a player gives it — he walks the team into the room the side door is taken from and presses F there
  // (rescue.ts pick(): the men nearest the side door take it, the rest go round to the main door, one gate). A level with no side door: the usual entry.
  const sideOnly = RPLAY === 'side'; const SB = (RPLAY === 'split' || sideOnly) && S.side?.from ? (R as any).fromBounds : null, sdoor = SB ? g.doors.byName(S.side.door) : null;
  let split = false;
  if (SB && sdoor) {
    const sc = sdoor.frameCentre, m: Vec3 = [(SB.x0 + SB.x1) / 2, 0, (SB.z0 + SB.z1) / 2], l = Math.hypot(m[0] - sc[0], m[2] - sc[2]) || 1;
    const raw2: Vec3 = [sc[0] + (m[0] - sc[0]) / l * 2.6, 0, sc[2] + (m[2] - sc[2]) / l * 2.6], post2: Vec3 = P.O.freeSpot(raw2) ?? raw2;
    P.say(`→ the side door's room, a post short of ${S.side.door} ${at(post2)}`);
    if (!P.go(post2, 90)) P.say(`Sam did not reach the side room's post (at ${at(P.pos)})`);
    split = P.pos[0] >= SB.x0 && P.pos[0] <= SB.x1 && P.pos[2] >= SB.z0 && P.pos[2] <= SB.z1;   // (a side room he cannot walk into — its door locked against him: the usual entry, and the trace says so)
    if (!split) P.say('not in the side door\'s room: the usual entry');
  }
  if (!split) {
  P.say(`→ a post short of the hostage room ${at(post)}`);
  if (!P.go(post, 90)) P.say(`Sam did not reach the post (at ${at(P.pos)})`);
  }
  P.until(() => P.up.every((m: any) => m === cov || flat(m.char.pos, P.pos) < 5), 8);
  // PT_RESCUE=side: THE SIDE DOOR ALONE, by the order menu — the whole squad sent through it with a door tool (PT_SIDETOOL, 'openClear'), no F and nobody on
  // the main door: what the men do with the rest of the room once they are in is theirs. He stays outside and watches; where each man ends up is said
  if (sideOnly && sdoor) {
    const tool = process.env.PT_SIDETOOL ?? 'openClear';
    if (P.give(tool, P.O.targetAt(sdoor.frameCentre), sdoor.def.name)) { P.rooms++; P.until(() => P.D.ops.some((o: any) => o.door === sdoor), 3); P.until(() => !P.D.ops.some((o: any) => o.door === sdoor), 150); }
    const where = () => P.up.map((m: any) => `${m.callsign} ${at(m.char.pos)} ${P.O.of(m)?.order ?? '-'}:${P.O.of(m)?.there ?? ''}`).join(' · ');
    P.say(`side entry over: ${where()}`); P.wait(Number(process.env.PT_SIDEWAIT ?? 20)); P.say(`${process.env.PT_SIDEWAIT ?? 20} s on: ${where()} · theirs up: ${P.hostiles.filter((h: any) => h.state !== 'dead').map((h: any) => `${h.callsign} ${at(h.char.pos)}`).join(', ') || 'none'}`);
    return;
  }
  // PT_TOOL=threshold / hold: the hostage room's corridor door worked from the threshold, given as the scenario gives F's own entry (doorTools.order on that
  // door, the flow's jobs on those men let go) — refused, he presses F as ever
  const thr = THR && !split ? P.D.order('threshold', P.up, D, g.rescue.faceOf(D), null, HOLD) : null;   // (given from the side door's room: F's two doors, never the threshold on the far one)
  if (typeof thr === 'string') { P.refused.push(`threshold · ${S.room.door}: ${thr}`); P.say(`order threshold · ${S.room.door} — REFUSED: ${thr}`); }
  if (thr && typeof thr !== 'string') { R.flow.release(thr.men); P.orders++; P.thr++; P.say(`order threshold · ${S.room.door}`); P.step(); P.rooms++; if (HOLD) followUp(P, D); P.until(() => R.state === 'secured' || !P.D.ops.some((o: any) => o.door === D), 90); }
  else {
  P.I.pressed.add('KeyF'); P.orders++; P.say('F — the hostage room'); P.step(); P.rooms++;
  if (R.state === 'staged') { P.until(() => P.up.every((m: any) => m === cov || P.O.of(m)?.arrived), 25); P.I.pressed.add('KeyF'); P.orders++; P.say('F again — go'); P.step(); }
  }
  P.until(() => R.state === 'secured', 60);
  const inside: Vec3 = P.free([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]) ?? [c[0] - n[0] * 2, 0, c[2] - n[1] * 2];
  P.say('Sam walks into the hostage room'); P.go(inside, 40);
  // THE END AS THE RULE HAS IT (src/game/rescueend.ts — RESCUEEND.on): the room held ends nothing. He holds it while the men left alive come to him (the
  // floor cleared is the win), then gives the hostages the word, calls the team in and walks them back the way he came in.
  if (RESCUEEND.on && !R.result) {
    P.until(() => !!R.result || R.ending.left().length === 0, 25);
    if (!R.result && R.ending.left().length && R.ending.word(g.player.char)) {
      P.orders++; P.say('on your feet — with me: the hostages follow Sam'); P.fallIn();
      P.go(R.ending.out, 90);
    }
  }
  P.wait(120);
}

const TECH = process.env.PT_TECH ?? '';   // PT_TECH=cue (env, rescues): the commander acts on what their net said — playRescue
const RPLAY = process.env.PT_RESCUE ?? '';   // PT_RESCUE=split (env, rescues): F is pressed from the side door's room — both doors on one word · side: the side door alone, by the order menu — playRescue
if (RPLAY && RPLAY !== 'split' && RPLAY !== 'side') { console.error(`PT_RESCUE=${RPLAY}: split (rescues: the team is walked into the side door's room and F pressed there) | side (…and the whole squad sent through the side door with a door tool)`); process.exit(2); }
if (TECH && TECH !== 'cue') { console.error(`PT_TECH=${TECH}: cue (rescues: the commander acts on what their net says)`); process.exit(2); }

// ───────────────────────────────────────────────────────────── the endgame ─────────────────────────────────────────
/** one of their last men as the endgame's clock starts. `home` the room he was dealt (the structure's id) · `in` the structure room he stands in (null: none
 *  of them — a yard, a hall, a corridor) · `where` own room / another room / open floor · `mode` the room fight's (hold · move = walking a leg of somebody's ·
 *  free = off his post on the fight AI's hunt · none) and `state` the fight AI's · `set` on a door he has dug in on (digin.ts) · `seen` in the team's sight
 *  that frame · `near` metres to the nearest living teammate or Sam, by the crow · and AFTER: `walked` metres until he dropped or the run ended, `rooms` times
 *  he changed structure room, `sawAt` the second the team first had him in its sight after the clock started (null: never), `downAt` / `downIn` his end */
/** does the TEAM have this man in its sight now: the fog of war's own answer where it runs (the page under ?roomclear), else (the harness: the fog is
 *  main.ts's switch) A STAND-IN for it — a teammate's eyes by the fight's own sight test (cone, range, light, smoke), or Sam's plain line to his chest inside
 *  SAM_SEES metres (all round, glass passed, light not asked: the fog's eye, shorter) */
const SAM_SEES = 20;
function teamEyes(g: any, h: any): boolean {
  const F = g.fogOfWar; if (F?.active) return !!F.seen(h);
  if (g.fight?.teamSees?.(h)) return true;
  const s = g.player.char.pos, p = h.char.pos; if (g.player.down || flat(s, p) > SAM_SEES) return false;
  return !g.col.segmentBlocked([s[0], 1.5, s[2]], [p[0], 1.2, p[2]]);
}
export interface EndMan { who: string; home: string | null; in: string | null; where: 'own' | 'other' | 'open'; mode: string; state: string; set: boolean; seen: boolean; near: number; at: [number, number];
  walked: number; rooms: number; sawAt: number | null; downAt: number | null; downIn: string | null }
/** THE ENDGAME of a run. `n` their men staged · `t3` / `t2` / `t1` the second their side was down to three, two, one (null: never) · `end` the second the
 *  last of their men went down, or the scenario ended 'taken' with one away (null: wiped first, or the cap) · `up3` / `up2` / `up1` teammates up at each · `men3` / `men2` the survivors as each clock starts (men2's
 *  after-fields run from t2, men3's from t3; `rooms` = times he came into a room other than the one he was last in (his own, for a man
 *  the clock found on open floor); `sawAt` null and `downAt` set = dropped without the team ever
 *  having him in its sight; `home` / `in` / `downIn` are the room clear's rooms: null on a scenario without one) · `rows` the radio strip's rows drawn from t3 on · `notes` the room fight's notes about the survivors from t3 on */
export interface EndgameOut { n: number; t3: number | null; t2: number | null; t1: number | null; end: number | null; up3: number; up2: number; up1: number; men3: EndMan[]; men2: EndMan[]; rows: [number, string][]; notes: [number, string, string][] }
/** A BYSTANDER like the Tally: it reads where their last men stand and what the fight's modules say of them, and writes nothing the game reads */
class EndWatch {
  out: EndgameOut = { n: 0, t3: null, t2: null, t1: null, end: null, up3: 0, up2: 0, up1: 0, men3: [], men2: [], rows: [], notes: [] };
  private track: { h: any; M: EndMan; last: number[]; room: string | null }[] = []; private k = 0; private rowSeen = new WeakSet<object>(); private noteN = 0; private lastNote: unknown = null; private names = new Set<string>();
  constructor(private g: any) { }
  private sees(h: any): boolean { return teamEyes(this.g, h); }
  private roomIn(p: number[]): string | null { return this.g.roomClear?.active ? this.g.roomClear.roomAt(p) : null; }
  private snap(h: any, team: any[]): EndMan {
    const g = this.g, p = h.char.pos, home = g.roomClear?.rooms?.find((r: any) => r.defenders.includes(h))?.def.id ?? null, inn = this.roomIn(p);
    let near = g.player.down ? Infinity : flat(p, g.player.char.pos); for (const m of team) if (m.state !== 'dead') near = Math.min(near, flat(p, m.char.pos));
    return { who: h.callsign ?? '?', home, in: inn, where: inn === null ? 'open' : inn === home ? 'own' : 'other', mode: g.fight?.defs?.find((d: any) => d.gd === h)?.mode ?? 'none', state: String(h.state), set: !!digInSet(g, h), seen: this.sees(h), near: +Math.min(near, 999).toFixed(1), at: [+p[0].toFixed(1), +p[2].toFixed(1)], walked: 0, rooms: 0, sawAt: null, downAt: null, downIn: null };
  }
  tick(t: number, team: any[], hostiles: any[]) {
    const g = this.g, O = this.out, live = hostiles.filter(h => h.state !== 'dead'), up = team.filter(m => m.state !== 'dead').length, off = g.time - t;
    if (hostiles.length > O.n) O.n = hostiles.length;
    const start = (men: EndMan[]) => { for (const h of live) { const M = this.snap(h, team); men.push(M); this.names.add(M.who); this.track.push({ h, M, last: [h.char.pos[0], 0, h.char.pos[2]], room: M.in ?? M.home }); } };
    if (O.n >= 4 && O.t3 === null && live.length <= 3) { O.t3 = +t.toFixed(2); O.up3 = up; start(O.men3); }
    if (O.n >= 3 && O.t2 === null && live.length <= 2) { O.t2 = +t.toFixed(2); O.up2 = up; start(O.men2); }
    if (O.n >= 2 && O.t1 === null && live.length <= 1) { O.t1 = +t.toFixed(2); O.up1 = up; }
    if (O.n > 0 && O.end === null && !live.length) O.end = +t.toFixed(2);
    if (O.t3 === null && O.t2 === null) return;
    const from = (O.t3 ?? O.t2!) - 0.011;   // (the clock's start is rounded: the lines of the frame that started it are in)
    for (const T of this.track) { const M = T.M, h = T.h; if (M.downAt !== null) continue;
      if (M.sawAt === null && this.sees(h)) M.sawAt = +t.toFixed(2);
      if (h.state === 'dead') { M.downAt = +t.toFixed(2); M.downIn = this.roomIn(h.char.pos); M.walked = +M.walked.toFixed(1); } }
    if (this.k++ % 15 === 0) for (const T of this.track) { const M = T.M, h = T.h; if (M.downAt !== null) continue; const p = h.char.pos;
      M.walked += flat(T.last, p); T.last = [p[0], 0, p[2]]; const r = this.roomIn(p); if (r !== null && r !== T.room) { T.room = r; M.rooms++; } }
    for (const r of (g.cues?.rows ?? []) as any[]) { if (this.rowSeen.has(r)) continue; this.rowSeen.add(r); if (r.t - off >= from && O.rows.length < 60) O.rows.push([+(r.t - off).toFixed(1), String(r.text)]); }
    const L = (g.fight?.log ?? []) as { t: number; who: string; what: string }[]; if (L.length < this.noteN) this.noteN = L.indexOf(this.lastNote as any) + 1;
    for (; this.noteN < L.length; this.noteN++) { const n = L[this.noteN]; this.lastNote = n; if (n.t - off >= from && (this.names.has(n.who) || n.who === '-') && O.notes.length < 80) O.notes.push([+(n.t - off).toFixed(1), n.who, n.what]); }
  }
  close(t: number, end: string): EndgameOut { const O = this.out; if (O.end === null && end === 'taken') O.end = +t.toFixed(2);   // (taken with a man still up: one who got away)
    for (const T of this.track) T.M.walked = +T.M.walked.toFixed(1); return O; }
}

// ───────────────────────────────────────────────────────────── the commander who has to search ─────────────────────
const SEARCH = !!process.env.PT_SEARCH && process.env.PT_SEARCH !== '0';
/** PT_SEND=1 (env; off = the searching commander as every tally before it had him): a NAMED PLACE he is sent to by their net or by its marker is taken the way a
 *  lead is — he stops `PT_SEND_SHORT` (3.5) m short of it on his way and SENDS his men on to it ('move': guns up, their own eyes do the rest), then walks in after them —
 *  instead of walking there himself with his file behind him (which walks the man behind him, gun on nothing, at a defender who has said where he stands) */
const SEND = !!process.env.PT_SEND && process.env.PT_SEND !== '0', SEND_SHORT = Number(process.env.PT_SEND_SHORT ?? 3.5);
if (SEARCH && (process.env.PT_WAIT || process.env.PT_FIRST || process.env.PT_LISTEN) && !process.argv.includes('--one')) console.error('PT_SEARCH: PT_WAIT / PT_FIRST / PT_LISTEN are the scripted commander\'s — not read under it');
/** PT_SEARCH's own numbers: s a sighting / a shot heard / a room named on the net stays a lead · s after which floor nobody has had eyes on is swept again ·
 *  m an eye is credited with (the floor it has a line to inside that) · m a shot is heard from (and PLACED no finer than its room, or a 4 m square of open
 *  floor: ears give a side and a distance, not a spot) · m round the structure's rooms that are his to sweep ·
 *  door orders he gives one room before he just walks in */
const SK = { sight: 10, shot: 8, radio: 60, stale: 60, reach: 10, hear: 30, margin: 5, entries: 3 };
/** a row of the net that names a place but is no lead to a man there: he is leaving it, or it is the team's own noise he is talking about */
const NOT_A_LEAD = /is lost|falling back|shots |that was |they're hit|heard that|\bout of |— i'm on them|coming to you/i;   // (… 'coming to you through the yard': the way a man WALKS, not where one is)
/** one move of his: `t` the second · `kind` room (a door order on a room) / walk (to floor he has not seen) / hunt (onto a lead) · `why` what he went on:
 *  marker (a room the HUD brackets: their own net named it — laststand.ts) · hud (a room the HUD shows held that he has not been in) · again (the HUD said it is held again) · radio · shot · sight · sweep · recheck (a held room,
 *  stale) · `room` the structure room · `there` their living men inside that room's bounds, or within 4 m of the spot, as he set off — THE TRUTH, kept for
 *  the tables only (he never reads it) */
export interface SearchMove { t: number; kind: 'room' | 'walk' | 'hunt'; why: string; room: string | null; there: number }
export interface SearchOut { moves: SearchMove[]; cells: number }
/** WHAT HE KNOWS. Ticked every frame of the run; reads the game, writes nothing it reads (but asks the room fight for rooms it may not have built: a run
 *  under PT_SEARCH is its own run) */
class Searcher {
  moves: SearchMove[] = [];
  /** the floor in one-metre squares inside the structure's box and `margin`: when somebody of the team last had a line to each (g.time; -1e9 never) */
  private LW = 0; private LH = 0; private x0 = 0; private z0 = 0; seenT: Float64Array; private rep: (Vec3 | null)[] = [];
  sight = new Map<any, { at: Vec3; t: number }>(); shots: { at: Vec3; t: number; R: any | null }[] = []; mute = new Map<any, number>(); radio: { t: number; t0: number; done: boolean; R: any; pl: any; rel: 'in' | 'outside'; text: string }[] = [];
  visitT = new Map<any, number>(); tries = new Map<any, number>(); no = new Set<any>();
  private evSeen = new WeakSet<object>(); private rowSeen = new WeakSet<object>(); private eyeT = -1;
  /** the names a line can say: the structure's rooms (R), and the level's places nobody holds (R null, `rects` — scenarios.places; one name may be several rectangles) */
  private places: { R: any; name: string; rects: { x0: number; x1: number; z0: number; z1: number }[] }[] = [];
  constructor(private P: Player) {
    const g = P.g, nav = g.col.nav, rooms = g.roomClear.rooms as any[], M = SK.margin; let x0 = P.pos[0], x1 = P.pos[0], z0 = P.pos[2], z1 = P.pos[2];
    for (const R of rooms) { const b = R.def.bounds; x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); }
    this.x0 = Math.floor(x0 - M); this.z0 = Math.floor(z0 - M); this.LW = Math.ceil(x1 + M) - this.x0; this.LH = Math.ceil(z1 + M) - this.z0;
    this.seenT = new Float64Array(this.LW * this.LH).fill(-1e9);
    for (let iz = 0; iz < this.LH; iz++) for (let ix = 0; ix < this.LW; ix++) { let p: Vec3 | null = null;
      for (const [dx, dz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const x = this.x0 + ix + dx, z = this.z0 + iz + dz; if (!nav.isBlocked(x, z)) { p = [x, 0, z]; break; } }
      this.rep.push(p); }
    const the = (n: string) => (/^the |\d$/.test(n) ? n : `the ${n}`).toLowerCase();
    this.places = rooms.map(R => ({ R, name: the(R.def.name), rects: [R.def.bounds] }));   // (dialogue.ts levelRects' words)
    for (const a of (placeRects?.(g.level) ?? []) as { name: string; id: string | null; x0: number; x1: number; z0: number; z1: number }[]) {   // (… and every other rectangle a line can name: the level's places nobody holds; on the office its corridor, lobby, cubicles)
      if (a.id) continue; const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2; if (rooms.some(R => { const b = R.def.bounds; return cx >= b.x0 && cx <= b.x1 && cz >= b.z0 && cz <= b.z1; })) continue;   // (a second name for a room of the list — a clear plan's: the room's own entry reads it)
      const n = the(a.name), was = this.places.find(x => x.name === n); if (was) { if (!was.R) was.rects.push(a); } else this.places.push({ R: null, name: n, rects: [a] }); }
    this.places.sort((a, b) => b.name.length - a.name.length);
    for (const R of rooms) { this.visitT.set(R, -1e9); this.tries.set(R, 0); }
  }
  private li(p: number[]): number { const ix = Math.floor(p[0]) - this.x0, iz = Math.floor(p[2]) - this.z0; return ix < 0 || iz < 0 || ix >= this.LW || iz >= this.LH ? -1 : iz * this.LW + ix; }
  seenAt(p: number[]): number { const i = this.li(p); return i < 0 ? -1e9 : this.seenT[i]; }
  /** floor within `r` of a spot is called seen now (where he walked to and could not see, or could not reach: not asked again until it is stale) */
  mark(p: number[], r: number) { const t = this.P.g.time; this.rep.forEach((q, i) => { if (q && flat(q, p) <= r) this.seenT[i] = t; }); }
  sees(h: any): boolean { return teamEyes(this.P.g, h); }
  inRoom(R: any, p: number[]): boolean { const b = R.def.bounds; return p[0] >= b.x0 && p[0] <= b.x1 && p[2] >= b.z0 && p[2] <= b.z1; }
  teamIn(R: any): boolean { const P = this.P; return (!P.g.player.down && this.inRoom(R, P.pos)) || P.up.some((m: any) => this.inRoom(R, m.char.pos)); }
  roomOf(p: number[]): any | null { return (this.P.g.roomClear.rooms as any[]).find(R => this.inRoom(R, p)) ?? null; }
  /** the truth, for the tables only */
  there(R: any | null, p: number[]): number { return this.P.hostiles.filter((h: any) => h.state !== 'dead' && (R ? this.inRoom(R, h.char.pos) : flat(h.char.pos, p) < 4)).length; }
  /** THE HUD'S BRACKETS (laststand.ts, either switch): the rooms the objective line shows in [brackets] — the ones the defenders' own net has named and that
   *  are still held — and when he first read each so. Read off the line's text, as a player reads it; a build without the switches never brackets a room */
  private markT = new Map<any, number>();
  /** … and the bracketed names that are no room of the list (laststand.ts `places`: floor nobody holds — the marker sits on it), by `places` entry */
  private markA = new Map<any, number>();
  private marks() { const t = this.P.g.time, text: string = this.P.g.roomClear.objective()?.text ?? ''; const on = new Set<string>(); for (const m of text.matchAll(/\[([^\]]+)\]/g)) on.add(m[1]);
    for (const R of this.P.g.roomClear.rooms as any[]) { if (on.has(R.def.name)) { if (!this.markT.has(R)) this.markT.set(R, t); } else this.markT.delete(R); }
    for (const A of this.places) { if (A.R) continue; if ([...on].some(n => `the ${n}`.toLowerCase() === A.name || n.toLowerCase() === A.name)) { if (!this.markA.has(A)) this.markA.set(A, t); } else this.markA.delete(A); } }
  private inArea(A: { rects: { x0: number; x1: number; z0: number; z1: number }[] }, q: number[], pad = 0): boolean { return A.rects.some(b => Math.hypot(Math.max(b.x0 - q[0], 0, q[0] - b.x1), Math.max(b.z0 - q[2], 0, q[2] - b.z1)) <= pad); }
  /** when the HUD last said this room is held again (the room clear's own log), -1e9: never */
  private lostT(R: any): number { let t = -1e9; for (const x of this.P.g.roomClear.log as { t: number; what: string }[]) if (x.what === `lost:${R.def.id}`) t = x.t; return t; }
  tick() {
    const P = this.P, g = P.g, t = g.time, sam = g.player.char.pos;
    for (const h of P.hostiles) { if (h.state === 'dead') { const s = this.sight.get(h);   // a man seen to drop: the shots heard from round there were his
        if (s) { if (t - s.t < 2) this.shots = this.shots.filter(x => flat(x.at, s.at) > 6 && !(x.R && this.inRoom(x.R, s.at))); this.sight.delete(h); } continue; }
      if (this.sees(h)) this.sight.set(h, { at: [h.char.pos[0], 0, h.char.pos[2]], t }); }
    for (const e of g.events as any[]) { if (e.kind !== 'guardShot' || this.evSeen.has(e)) continue; this.evSeen.add(e);
      const k = g.guards.find((x: any) => x.char.id === e.who); if (!k || k.team !== 'hostile' || flat(e.pos, sam) > SK.hear) continue;
      const R = this.roomOf(e.pos), b = R?.def.bounds; let c: Vec3 = b ? [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2] : [Math.floor(e.pos[0] / 4) * 4 + 2, 0, Math.floor(e.pos[2] / 4) * 4 + 2];
      c = P.free(c) ?? c; if (this.roomOf(c) !== R) c = [e.pos[0], 0, e.pos[2]];   // (the square's middle fell in a room next door: the shot's own floor then)
      this.shots.push({ at: c, t, R }); if (this.shots.length > 40) this.shots.shift(); }
    const rows: any[] = CUES.on ? g.cues.rows : (g.messages as any[]).filter(m => String(m.text).startsWith('radio: '));
    for (const r of rows) { if (this.rowSeen.has(r)) continue; this.rowSeen.add(r); const text = String(r.text).toLowerCase(); if (NOT_A_LEAD.test(text)) continue;
      const pl = this.places.find(x => text.includes(x.name)); if (!pl) continue;
      const rel = text.includes(`outside ${pl.name}`) ? 'outside' : 'in'; let prev: any = null; for (let i = this.radio.length - 1; i >= 0 && !prev; i--) if (this.radio[i].pl === pl && this.radio[i].rel === rel) prev = this.radio[i];
      // (the same place named again and again — a man calling from where he stands: what has been looked at since the FIRST of those calls stays looked at, or every call would send him round the near side once more)
      this.radio.push({ t, t0: prev && t - prev.t <= SK.radio && !prev.done ? prev.t0 : t, done: false, R: pl.R, pl, rel, text: String(r.text) }); if (this.radio.length > 40) this.radio.shift(); }
    const eyes: number[][] = g.player.down ? [] : [sam]; for (const m of P.up) { if (t < m.dazzledUntil) continue; const p = m.char.pos; if (!eyes.some(q => flat(q, p) < 1)) eyes.push(p); }
    for (const R of g.roomClear.rooms as any[]) if ((!g.player.down && this.inRoom(R, sam)) || P.up.some((m: any) => this.inRoom(R, m.char.pos))) this.visitT.set(R, t);
    if (t - this.eyeT < 0.5) return; this.eyeT = t; this.marks();
    for (const e of eyes) { const ex = Math.floor(e[0]) - this.x0, ez = Math.floor(e[2]) - this.z0, r = Math.ceil(SK.reach);
      for (let iz = Math.max(0, ez - r); iz <= Math.min(this.LH - 1, ez + r); iz++) for (let ix = Math.max(0, ex - r); ix <= Math.min(this.LW - 1, ex + r); ix++) { const i = iz * this.LW + ix, q = this.rep[i];
        if (!q || this.seenT[i] === t || flat(q, e) > SK.reach) continue;
        if (!g.col.segmentBlocked([e[0], 1.5, e[2]], [q[0], 1.0, q[2]])) this.seenT[i] = t; } }
  }
  /** a man in the picture now, or one the team had eyes on less than a second ago (a walk over unseen floor stops for him) */
  fresh(): boolean { const t = this.P.g.time; for (const [h, s] of this.sight) if (h.state !== 'dead' && t - s.t < 1 && (this.mute.get(h) ?? -1) <= t) return true; return false; }   // (a man he went for and could not get to is no reason to stand still: `rest`)
  /** the nearest square on foot from Sam that passes `want` (a flood of the nav grid from his feet, doorways and all) */
  nearest(want: (i: number, q: Vec3) => boolean): Vec3 | null {
    const nav = this.P.g.col.nav, W = nav.W, H = nav.H, p = this.P.pos; let sx = Math.floor(p[0] / nav.cell), sz = Math.floor(p[2] / nav.cell);
    if (sx < 0 || sz < 0 || sx >= W || sz >= H) return null;
    const seen = new Uint8Array(W * H), q = [nav.idx(sx, sz)]; seen[q[0]] = 1; const tested = new Set<number>();
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, z = (c / W) | 0, wp: Vec3 = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell], i = this.li(wp);
      if (i >= 0 && !tested.has(i)) { tested.add(i); const r = this.rep[i]; if (r && want(i, r)) return r; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const n = nav.idx(nx, nz); if (seen[n] || nav.blocked[n] === 1) continue; seen[n] = 1; q.push(n); } }
    return null;
  }
  /** WHAT NEXT, by what he knows: a man seen inside a held room none of the team is in (that room, by a door) · the nearest room the HUD shows held
   *  that he has not been in (or that it has called held again since) · a man seen these seconds · a shot heard from floor not seen since · a room named on
   *  the net that he has not been in since · the nearest floor nobody has had eyes on this minute */
  /** a lead walked to and found empty, or with no way to it: spent */
  spend(at: number[], h: any | null) { this.mark(at, 2.5); if (h) this.sight.delete(h); this.shots = this.shots.filter(x => flat(x.at, at) > 2.5); }
  /** a man he went for and did not get (no way to him, the order refused, twelve seconds of nothing): the other rules get a turn before that sighting leads again */
  rest(h: any | null, secs = 20) { if (h) this.mute.set(h, this.P.g.time + secs); }
  next(): { kind: 'hunt'; why: string; at: Vec3; h: any | null } | { kind: 'room'; why: string; R: any; at?: Vec3 } | { kind: 'walk'; why: string; at: Vec3 } | null {
    const P = this.P, g = P.g, t = g.time, rooms = g.roomClear.rooms as any[];
    let best: { h: any; s: { at: Vec3; t: number } } | null = null;
    for (const [h, s] of this.sight) { if (h.state === 'dead' || t - s.t > SK.sight || (this.mute.get(h) ?? -1) > t) continue; if (this.seenAt(s.at) > s.t + 1 && !this.sees(h)) continue;   // (the spot looked at since, and he is not there)
      if (!best || s.t > best.s.t) best = { h, s }; }
    const due = (R: any) => !R.cleared && (this.tries.get(R) ?? 0) < SK.entries + 1;
    if (best) { const R = this.roomOf(best.s.at);   // seen inside a held room none of the team is in (through its glass, an open leaf): that room is worked by a door, never walked into
      if (R && due(R) && !this.teamIn(R)) return { kind: 'room', why: 'sight', R }; }
    // the HUD's marker: a room their net named (bracketed on the objective line) that he has not been in since it was — the nearest of them, before any other room
    { let mk: { R: any; L: number } | null = null;
      for (const [R, mt] of this.markT) { if (!due(R) || this.teamIn(R) || (this.visitT.get(R) ?? -1e9) >= mt) continue; const b = R.def.bounds, L = P.pathLen(P.pos, P.free([(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]) ?? P.pos); if (!mk || L < mk.L) mk = { R, L }; }
      if (mk) return { kind: 'room', why: 'marker', R: mk.R };
      // … and a place their net named that is no room of the list (floor nobody holds — the marker sits on it): the nearest of its floor nobody has had eyes on since
      if (!best) for (const [A, mt] of this.markA) { const at = this.nearest((k, q) => this.seenT[k] < mt && this.inArea(A, q)); if (at) return { kind: 'walk', why: 'marker', at }; } }
    let hud: { R: any; L: number; why: string } | null = null;
    for (const R of rooms) { if (!due(R)) continue; const v = this.visitT.get(R) ?? -1e9, again = this.lostT(R) > v; if (v > -1e9 && !again) continue;
      const b = R.def.bounds, L = P.pathLen(P.pos, P.free([(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]) ?? P.pos); if (!hud || L < hud.L) hud = { R, L, why: again ? 'again' : 'hud' }; }
    if (hud) return { kind: 'room', why: hud.why, R: hud.R };   // (rooms first, the nearest: the scripted player's own order — a man out on the floor is the team's guns' business until the rooms are done)
    if (best) return { kind: 'hunt', why: 'sight', at: best.s.at, h: best.h };
    for (let i = this.shots.length - 1; i >= 0; i--) { const s = this.shots[i]; if (t - s.t > SK.shot) break;
      if (s.R) { if (due(s.R) && (this.visitT.get(s.R) ?? -1e9) < s.t) return { kind: 'room', why: 'shot', R: s.R }; continue; }   // (from a room: that room, unless he has been in it since)
      if (this.seenAt(s.at) > s.t) continue; return { kind: 'hunt', why: 'shot', at: s.at, h: null }; }
    for (let i = this.radio.length - 1; i >= 0; i--) { const r = this.radio[i]; if (t - r.t > SK.radio) break;
      if (!r.R) { const at = r.done ? null : this.nearest((k, q) => this.seenT[k] < r.t0 && (r.rel === 'in' ? this.inArea(r.pl, q) : !this.roomOf(q) && !this.inArea(r.pl, q) && this.inArea(r.pl, q, 5)));   // (a place nobody holds: its own floor, or the floor round it)
        if (at) return { kind: 'walk', why: 'radio', at }; r.done = true; continue; }
      if (r.rel === 'in') { if (due(r.R) && (this.visitT.get(r.R) ?? -1e9) < r.t) return { kind: 'room', why: 'radio', R: r.R }; continue; }
      const b = r.R.def.bounds, at = this.nearest((k, q) => this.seenT[k] < r.t0 && !this.roomOf(q) && Math.hypot(Math.max(b.x0 - q[0], 0, q[0] - b.x1), Math.max(b.z0 - q[2], 0, q[2] - b.z1)) <= 5);
      if (at) return { kind: 'walk', why: 'radio', at }; r.done = true; }   // (all of it looked at since they first said so: the next call starts over)
    const at = this.nearest(k => t - this.seenT[k] > SK.stale * 3) ?? this.nearest(k => t - this.seenT[k] > SK.stale); if (!at) return null;   // (floor nobody has looked at for three times as long goes first: by the nearest alone he can circle the same few corners, each stale again by the time he is back, and never reach the far one)
    const R = this.roomOf(at); if (R && due(R) && !this.teamIn(R)) return { kind: 'room', why: 'recheck', R, at };
    return { kind: 'walk', why: 'sweep', at };
  }
  close(): SearchOut { return { moves: this.moves, cells: this.rep.filter(Boolean).length }; }
}
/** THE COMMANDER WHO HAS TO SEARCH (PT_SEARCH=1): every door worked exactly as the scripted player works it (workDoor), but which door, and where he walks
 *  when no door is left, come from what he knows (Searcher.next) and never from where their men are */
function playSearch(P: Player) {
  const g = P.g, S = P.search = new Searcher(P); let fightT = 0;
  const move = (kind: SearchMove['kind'], why: string, R: any | null, at: number[], there = S.there(R, at)) => { S.moves.push({ t: +P.t.toFixed(2), kind, why, room: R?.def.id ?? null, there }); };
  // THE DOOR BETWEEN HIM AND A SPOT: the closed-off place the spot is in by the room fight's own model (roomAt: floor bounded by doorways), when it is a room
  // (not open floor), none of the team stands in it, and he has not worked it SK.entries times — and its nearest door on foot that has not refused him. A man
  // seen through glass behind a wedged leaf, floor he cannot walk to: he orders that door, as the scripted player orders a held room's
  const nav = g.col.nav, cellOf = (p: number[]) => nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)), placeTries = new Map<any, number>(), doorTries = new Map<any, number>();
  const doorFor = (p: number[]): { room: any; ent: any; R: any | null } | null => {
    const room = g.fight.roomAt(P.free(p) ?? [p[0], 0, p[2]]), R = S.roomOf(p); if (!room || room.cells.size > 500 || (R ? S.tries.get(R) ?? 0 : placeTries.get(room) ?? 0) >= SK.entries) return null;   // (one budget of door orders a place, whichever rule spends it: a structure room's is the room rule's own)
    if ((!g.player.down && room.cells.has(cellOf(P.pos))) || P.up.some((m: any) => room.cells.has(cellOf(m.char.pos)))) return null;
    let ent: any = null, bl = Infinity; for (const e of room.entries as any[]) { if (S.no.has(e)) continue; const out: Vec3 = [e.at[0] + e.out[0] * 1.5, 0, e.at[2] + e.out[1] * 1.5], L = P.pathLen(P.pos, P.free(out) ?? out); if (L < bl) { bl = L; ent = e; } }
    return ent && Number.isFinite(bl) ? { room, ent, R } : null; };
  // a door worked for itself, from Sam's side of it (a man stood in or just beyond its doorway, a shut leaf that will not swing for Sam because somebody stands against it): the door's own order, as its menu offers — a budget a door
  const through = (d: any, why: string, what: string): boolean => { const n = doorTries.get(d) ?? 0; if (n >= SK.entries || !P.up.length) return false; doorTries.set(d, n + 1);
    const th = d.def.closedDir, c = d.frameCentre, nx = -Math.sin(th), nz = Math.cos(th), sd = (P.pos[0] - c[0]) * nx + (P.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
    P.say(`search (${why}) → the door ${d.def.name}, ${what}`); workDoor(P, { room: null, ent: { at: [c[0], 0, c[2]], out: [nx * sd, nz * sd], door: d }, men: [] }); return true; };
  const shutAt = (): any | null => g.doors.list.find((d: any) => d.isClosed() && !P.own.has(d) && flat(P.pos, d.frameCentre) < 1.6 && !g.doors.lockedOut(d, P.pos, g.player.keys)) ?? null;
  const door = (D: { room: any; ent: any; R: any | null }, why: string, spot: number[]) => { const book: Map<any, number> = D.R ? S.tries : placeTries, key = D.R ?? D.room, n = book.get(key) ?? 0; book.set(key, n + 1);
    move('room', why, D.R, spot, P.hostiles.filter((h: any) => h.state !== 'dead' && D.room.cells.has(cellOf(h.char.pos))).length); P.say(`search (${why}) → the door ${D.ent.door.def.name}, for ${at(spot)}`);
    if (!workDoor(P, { room: D.room, ent: D.ent, men: [] })) { S.no.add(D.ent); book.set(key, n); S.moves.pop(); P.wait(1); } };
  P.fallIn(); P.wait(1.5); let lastT = -1;
  for (let round = 0; round < 6000; round++) {   // (the scenario's end or --cap stops the run from inside step(); the count only bounds a loop that is not moving)
    if (P.t - lastT < 0.25) P.wait(0.5); lastT = P.t;   // every round costs time, whatever it found to do
    if (!P.up.length) { P.wait(5); continue; }   // (nobody to send: the scenario's own end is a frame away, or the cap is)
    if (fightT < 20 && P.up.some((m: any) => g.fight.engaged(m))) { P.wait(0.5); fightT += 0.5; continue; } fightT = 0;   // his men are in a fight: he lets them fight it
    const N = S.next();
    if (!N) { P.wait(2); continue; }
    if (N.kind === 'room') {
      const R = N.R, b = R.def.bounds, c: Vec3 = [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2], room = g.fight.roomAt(P.free(c) ?? c), n = S.tries.get(R) ?? 0;
      const ents = room && room.cells.size <= 500 ? (room.entries as any[]).filter(e => !S.no.has(e)) : [];
      if (!ents.length || n >= SK.entries) {   // open floor by the room fight's model, every door of it refused, or stacked on three times already: he walks in with them behind him
        S.tries.set(R, n + 1); move('walk', `${N.why}:in`, R, c); P.say(`search (${N.why}) → walks into the ${R.def.name}`);
        if (!P.O.of(P.up[0]) || P.O.of(P.up[0]).order !== 'fallIn') P.fallIn();
        if (!P.go(P.free(c) ?? c, 40)) S.visitT.set(R, g.time); if (N.at) S.mark(N.at, 2); P.wait(1); continue; }   // (in he goes whoever is in sight: the team is on his heels; a room he cannot get into is not asked again until the HUD says so)
      let ent: any = null, bl = Infinity; for (const e of ents) { const out: Vec3 = [e.at[0] + e.out[0] * 1.5, 0, e.at[2] + e.out[1] * 1.5], L = P.pathLen(P.pos, P.free(out) ?? out); if (L < bl) { bl = L; ent = e; } }
      if (!Number.isFinite(bl)) { S.tries.set(R, n + 1); S.visitT.set(R, g.time); P.say(`search (${N.why}): no way on foot to the ${R.def.name}`); continue; }
      S.tries.set(R, n + 1); move('room', N.why, R, c); P.say(`search (${N.why}) → the ${R.def.name}`);
      if (!workDoor(P, { room, ent, men: [] })) { S.no.add(ent); S.tries.set(R, n); S.moves.pop(); P.wait(1); }   // (every order refused at that door: no move of his)
      else if (N.at) S.mark(N.at, 2);   // (the stale square that sent him back in: asked once)
      continue;
    }
    if (N.kind === 'walk') {
      move('walk', N.why, null, N.at); P.say(`search (${N.why}) → ${at(N.at)}`);
      if (!P.O.of(P.up[0]) || P.O.of(P.up[0]).order !== 'fallIn') P.fallIn();
      const D0 = doorFor(N.at); if (D0) { S.moves.pop(); door(D0, N.why, N.at); continue; }   // (floor behind a door none of the team is through: that door is worked, as for a lead)
      if (SEND && N.why !== 'sweep') {   // PT_SEND: short of the place, the men sent on to it, he follows
        const way = g.col.nav.findPath(P.pos, N.at) as Vec3[] | null;
        if (way) {
          const path: Vec3[] = [[P.pos[0], 0, P.pos[2]], ...way, [N.at[0], 0, N.at[2]]]; let back = SEND_SHORT, p: Vec3 | null = null;
          for (let i = path.length - 1; i > 0 && !p; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); p = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; } else back -= L; }
          P.stop = () => S.fresh(); if (p) P.go(P.free(p) ?? p, 30); P.stop = null;
          if (S.fresh()) continue;
          const T = P.up.length ? P.O.targetAt([N.at[0], 0, N.at[2]]) : null;
          if (T && T.kind === 'door' && T.door) { if (through(T.door, N.why, `for ${at(N.at)}`)) continue; }   // (the spot is in or just beyond a doorway: the door's own order, as for a lead)
          else if (T && P.give('move', T, `onto ${at(N.at)}`)) { P.until(() => S.fresh() || !P.up.length || P.up.every((m: any) => P.O.of(m)?.arrived), 8); if (S.fresh()) continue; }
        }
      }
      P.stop = () => S.fresh(); const ok = P.go(N.at, 30); P.stop = null;
      if (S.fresh()) continue;
      const D = ok ? null : doorFor(N.at);   // he could not walk there: a door is in the way, and it is the door he orders
      const sh = ok || D ? null : shutAt();   // …or a shut leaf that would not swing for him (somebody stood against it): the team opens it
      if (D) door(D, N.why, N.at); else if (!sh || !through(sh, N.why, 'shut in his way')) S.mark(N.at, ok ? 1.5 : 2.5);
      continue;
    }
    // a lead: the team walked to a few metres short of the spot, then sent on to it ('move': guns up on the way, their own eyes do the rest) — the scripted
    // player's own hunt, to where the man was last seen or heard and not to where he is
    const D = doorFor(N.at); if (D) { door(D, N.why, N.at); continue; }
    const way = g.col.nav.findPath(P.pos, N.at) as Vec3[] | null;
    if (!way) { S.spend(N.at, N.h); S.rest(N.h); P.wait(0.5); continue; }
    move('hunt', N.why, null, N.at); P.say(`search (${N.why}) → ${N.h ? `${N.h.callsign}, last seen ` : 'a shot from '}${at(N.at)}`);
    const path: Vec3[] = [[P.pos[0], 0, P.pos[2]], ...way, [N.at[0], 0, N.at[2]]]; let back = 3.5, p: Vec3 | null = null;
    for (let i = path.length - 1; i > 0 && !p; i--) { const a = path[i - 1], b = path[i], L = flat(a, b); if (L >= back) { const k = back / (L || 1); p = [b[0] + (a[0] - b[0]) * k, 0, b[2] + (a[2] - b[2]) * k]; } else back -= L; }
    P.fallIn(); if (p) P.go(P.free(p) ?? p, 40); P.wait(1);
    const tgt = N.h && N.h.state !== 'dead' ? (S.sight.get(N.h)?.at ?? N.at) : N.at;
    if ((!N.h || N.h.state !== 'dead') && P.up.length && P.give('move', P.O.targetAt([tgt[0], 0, tgt[2]]), N.h ? `on ${N.h.callsign}, last seen` : 'on the shot')) { if (N.h) P.until(() => N.h.state === 'dead' || !P.up.length, 12); else P.until(() => S.fresh() || !P.up.length, 6); }
    else if (P.up.length && (!N.h || N.h.state !== 'dead')) {   // the order did not fit what is under the spot. A DOOR (a man stood in or just beyond a doorway): the door's own order, from Sam's side of it, as the menu offers there — else he walks there himself, the team in file behind him
      const T = P.O.targetAt([tgt[0], 0, tgt[2]]), d = T.kind === 'door' ? T.door : null;
      if (d && through(d, N.why, `for ${N.h ? N.h.callsign : 'the shot'}`)) { /* worked */ }
      else { const ok = P.go(P.free([tgt[0], 0, tgt[2]]) ?? [tgt[0], 0, tgt[2]], 15); if (!ok) { const sh = shutAt(); if (sh) through(sh, N.why, 'shut in his way'); } P.wait(1); } }
    if (!S.fresh()) S.spend(tgt, N.h && N.h.state !== 'dead' && !S.sees(N.h) ? N.h : null);   // been there, and he is not: the lead is spent
    if (N.h && N.h.state !== 'dead') S.rest(N.h);
  }
  P.wait(20);
}

// PT_HOUR=dawn|midday|overcast|dusk (env; PT_SUN=0‥1 the sun's strength): every run stood up at that hour instead of the level's own night (src/game/hours.ts —
// the sun and sky in the light meter's stand-in, the outside lamps on their photocell, the storm held off); unset = the level as authored, digest for digest
if (process.env.PT_HOUR !== undefined) { const id = hourIdOf(process.env.PT_HOUR); if (id === 'night' && process.env.PT_HOUR !== 'night') { console.error(`PT_HOUR=${process.env.PT_HOUR}: an hour is one of ${HOUR_IDS.join(', ')}`); process.exit(2); } HOUR.id = id; }
if (process.env.PT_SUN) { const k = Number(process.env.PT_SUN); if (!(k >= 0 && k <= 1)) { console.error(`PT_SUN=${process.env.PT_SUN}: the sun's strength, 0 to 1`); process.exit(2); } HOUR.sun = k; HOUR.sunGiven = true; }
const STAND = !!process.env.PT_STAND;
const NOLEAF = process.env.PT_NOLEAF === '1';   // PT_NOLEAF=1 (env): wedged on an open leaf across his way the commander gives the walk up, as every table before shutLeaf was made
const SAY = !!process.env.PT_SAY, MORTAL = !!process.env.PT_MORTAL, LIT = Number(process.env.PT_LIT ?? 0.5), AFTER = Math.max(0, Number(process.env.PT_AFTER ?? 0) || 0);   // (say-watch.ts: see the head)
if (MORTAL && !(LIT >= 0 && LIT <= 1)) { console.error(`PT_LIT=${process.env.PT_LIT}: wants Sam's light meter, 0 to 1`); process.exit(2); }
const EXTRA = Math.max(0, Math.floor(Number(process.env.PT_EXTRA ?? 0)) || 0), TIMES = !!process.env.PT_TIMES;   // PT_EXTRA=N: N more enemies than the scenario stages (game/stress.ts, past the renderer's caps: uncapped.ts) · PT_TIMES=1: the frame's cost in the JSON
const LISTEN = process.env.PT_LISTEN ? (Number(process.env.PT_LISTEN) > 1 ? Number(process.env.PT_LISTEN) : 60) : 0;   // PT_LISTEN=1 (env): the commander keeps off a door a pair has said it holds, for that many seconds, while there is another
/** the doors a pair sent round has said it holds ('<callsign> holding <door>' on its squad's timeline) inside the last LISTEN seconds, by men still up there */
function saidHeld(P: Player): Set<string> {
  const out = new Set<string>(); if (!LISTEN) return out;
  for (const q of squadsReport(P.g)) { const lost = new Set(q.events.filter((e: any) => e.what === 'lost').map((e: any) => /^(\S+ \d+)/.exec(e.why)?.[1]));
    const left = new Map<string, number>(); for (const e of q.events) if (e.what === 'back') for (const n of (/^(.*?) leaves? /.exec(e.why)?.[1] ?? '').split(' and ')) left.set(n, e.t);   // (they said on the net that they left it)
    for (const e of q.events) { const m = e.what === 'in position' ? /^(\S+ \d+) holding ([^,]+),/.exec(e.why) : null; if (m && P.g.time - e.t <= LISTEN && !lost.has(m[1]) && !(e.t <= (left.get(m[1]) ?? -1))) out.add(m[2]); } }
  return out;
}
const ROUTE = (process.env.PT_ROUTE ?? '').split(',').filter(Boolean);   // PT_ROUTE=s34,n_end,n4b (env): the commander's doors in that order while their rooms are held (two builds made to take one route: the nearest room flips on a few centimetres of path)
const HALL_ARM = process.env.PT_HALL ?? '', HALL_FIRST = Number(process.env.PT_HALL_FIRST ?? 4.2), HALL_BOUND = Number(process.env.PT_HALL_BOUND ?? 5), HALL_GAP = Number(process.env.PT_HALL_GAP ?? 1.1), HALL_SHORT = Number(process.env.PT_HALL_SHORT ?? 8), HALL_HOLD = Number(process.env.PT_HALL_HOLD ?? 2.5);   // PT_HALL=file|low|bare (env): hallLead's arm and its numbers — first mark, bound, the file's spacing (m), how far short of the far end the last bound stops (m), seconds stood a bound
const SNATCH_PLAN = process.env.PT_SNATCH ?? '', SNATCH_BACK = Number(process.env.PT_SNATCH_BACK ?? 4.5);
const SNATCH_VIA: Vec3 | null = process.env.PT_SNATCH_VIA ? (v => [v[0], 0, v[1]] as Vec3)(process.env.PT_SNATCH_VIA.split(',').map(Number)) : null;   // PT_SNATCH=cover|front (env): a snatch level's two plans — a pair posted on the man's way out first, or everybody in the front (snatchCover)
const FIRST = process.env.PT_FIRST ?? '';   // PT_FIRST=<structure room id> (env): the commander takes that room first instead of the nearest (then the nearest, as ever)
const WAIT = Number(process.env.PT_WAIT ?? 0), HURRY = !!process.env.PT_HURRY, WEDGED = process.env.PT_WEDGED ?? '', FRAGS = process.env.PT_FRAG === '1';   // PT_WAIT=15: the commander stands that long before each next room · PT_HURRY=1: he goes straight on to the next door when an entry ends
const WALL = process.env.PT_WALL === '1' ? await import('./wallcharge-commander.ts') : null;   // PT_WALL=1 (env, with PT_DESTR=1): a held room is taken BY A WALL CHARGE where a partition of it allows (wallcharge-commander.ts), else by its door as ever; RunOut.wall = what came of it
const BREAKER = process.env.PT_BREAKER ?? '', BREAKER_FROM = (process.env.PT_BREAKER_FROM ?? '').split(',').map(Number), PT_NV = process.env.PT_NV === '1';   // PT_BREAKER=order|sam: the mains cut before the first room (cutMains)
const MAINS: [number, string][] = []; let mainsOut = false;   // every change of the mains this run: [seconds, 'out' | 'on']
const HUNT_FIRST = process.env.PT_HUNT === 'first';   // PT_HUNT=first (env): once no room is held the commander goes for whoever is left BEFORE he walks the rooms again (the default sweeps every room first, and on a big level that can run a five minute cap out with one man left standing in the open)
const DIRECT = !!process.env.PT_DIRECT;   // PT_DIRECT=1 (env): no fall in and no stack order between rooms — the door tool is given straight, the men come from where they stand
const SHUT = !!process.env.PT_SHUT && process.env.PT_SHUT !== '0';   // PT_SHUT=1 (env): in each room just taken, before the fall-in, the commander has every open door of it shut ('shut that door', game/shutdoor.ts) — off: the script exactly as it was
const SIT = Number(process.env.PT_SIT ?? 0) || 0;   // PT_SIT=20 (env): the team SITS that many seconds on its sectors in each room just taken, before the fall-in (PT_PAUSE is the wait after it)
const DOOR = process.env.PT_DOOR ?? '';   // PT_DOOR=breakroom_n (env): the commander PICKS HIS ENTRY — a held room that has a door of that name is taken by it, not by its nearest
const STACKWAIT = Number(process.env.PT_STACKWAIT ?? 0);
if (!(STACKWAIT >= 0)) { console.error(`PT_STACKWAIT=${process.env.PT_STACKWAIT}: seconds, 0 or more`); process.exit(2); }
const NOISE = Number(process.env.PT_NOISE ?? 0) > 0;   // PT_NOISE=1 (env): SURPRISE LOST before the first door — one loud round's report (a hearing event, no round) where the team starts, a third of a second into the run
const PAUSE = Number(process.env.PT_PAUSE ?? 0);   // PT_PAUSE=15 (env): a SLOW team — the commander stands that many seconds more in each room he has just taken (the team on fall-in round him) before he goes on to the next door (0)
if (!(PAUSE >= 0)) { console.error(`PT_PAUSE=${process.env.PT_PAUSE}: seconds, 0 or more`); process.exit(2); }
const TOOL = process.env.PT_TOOL ?? '';
if (TOOL && TOOL !== 'threshold' && TOOL !== 'hold') { console.error(`PT_TOOL=${TOOL}: threshold (work it, then step in by itself) or hold (work it and hold until told)`); process.exit(2); }
const HOLD = TOOL === 'hold', THR = TOOL === 'threshold' || HOLD, REACT = Number(process.env.PT_REACT ?? 1), TELL = process.env.PT_TELL ?? '';
const WHERE = (w => w && w.length === 2 && w.every(Number.isFinite) ? w : null)(process.env.PT_WHERE ? process.env.PT_WHERE.split('-').map(Number) : null);   // PT_WHERE=16-31 (with --trace): where Sam and every teammate stand, and each one's order, twice a second over that stretch (PT_WAYPTS=1 adds where each man is being walked: his goal, post, corners and next waypoints; PT_REFUSED=1 prints, for a door order the squad refused, both faces of that door: each jamb place and whether it is floor with a clear line from the doorway, what stackPostsOn deals with and without the glass rule and down a passage, and the marks already held)
// (PT_AIM=9-12 a stretch · PT_AIM=9 three seconds from there · PT_AIM=:Red_One the whole run)
const AIM_WIN = process.env.PT_AIM ? ((w: number[]) => !process.env.PT_AIM!.split(':')[0] ? [0, Infinity] : w.length === 1 ? [w[0], w[0] + 3] : w)(process.env.PT_AIM.split(':')[0].split('-').map(Number)) : null, AIM_WHO = process.env.PT_AIM?.split(':')[1]?.replace(/_/g, ' ') ?? null;
const FIGHT_WIN = process.env.PT_FIGHT ? process.env.PT_FIGHT.split('-').map(Number) : null;
/** one run, with every knob table put back at its end (src/game/knobs.ts) — after the run's own tally has read the switches it ran under */
export async function play(scn: string, seed: number, cap = 300, verbose = false, set: Record<string, Record<string, unknown>> = {}): Promise<RunOut & { trace: string[] }> {
  const keep = knobsCopy(); try { return await playRun(scn, seed, cap, verbose, set); } finally { knobsBack(keep); }
}
async function playRun(scn: string, seed: number, cap: number, verbose: boolean, set: Record<string, Record<string, unknown>>): Promise<RunOut & { trace: string[] }> {
  const E = entryOf(scn); if (!E) throw new Error(NO_SCN(scn));
  const out: RunOut & { trace: string[] } = { scn, seed, end: 'error', why: '', t: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, orders: 0, refused: [], smells: [], rooms: 0, note: '', trace: [] };
  let P: Player | null = null, cuesOn = true, clOn = false;
  MAINS.length = 0; mainsOut = false;
  // (--set reaches the feel tables, the rescue's own, and the harder defenders: THE SWITCH as the game's own row sets it — --set '{"DIFFICULTY":{"level":"hard"}}'
  // (game/difficulty.ts; HARD = what hard is beside both switches on, set first; HARD_AT = hard's own rows on one level, by its structure's name:
  // '{"HARD_AT":{"the block":{}},"DIFFICULTY":{"level":"hard"}}' = the build's hard there) — and then the two tables under it, row by row, over whatever the level wrote)
  const { DOORPATH } = await import('../../src/game/doorpath.ts');   // (the room entry's real paths: --set '{"DOORPATH":{"on":true}}', or TPS_DOORPATH=1)
  const T: Record<string, any> = knobRegistry();   // (THE list of knob tables — src/game/knobs.ts: --set takes any of them; play() puts every one back at the run's end)
  DOORWAY.frameHolds = true;   // (…and their frames hold a boot from the face they open toward, a wedge only a door that opens toward its man — --set '{"DOORWAY":{"frameHolds":false}}' plays without)
  let dug = false, bud = false;
  if (CLM?.CLEARLINE_STATS) for (const k of Object.keys(CLM.CLEARLINE_STATS)) CLM.CLEARLINE_STATS[k] = 0;
  try {
    DOORWAY.oneWay = true; DOORWAY.exitsOut = false;   // (the doors as shipped — headless.ts stands every other tool up on the old double-acting leaves; --set '{"DOORWAY":{"oneWay":false}}' plays those, '{"DOORWAY":{"exitsOut":true}}' the outside doors opening outward, which ship off)
    const { HARD: hard, DIFFICULTY: diff, WEATHER: wx, ...rest } = set as Record<string, Record<string, unknown>>;
    if (wx) { const bad = Object.keys(wx).filter(k => k !== 'kind'); if (bad.length) throw new Error(`--set: WEATHER takes only "kind" (not ${bad.join(', ')})`); }
    if (wx && wx.kind != null && !isWeatherKind(wx.kind)) throw new Error(`--set: WEATHER.kind is one of game/weatherKinds.ts WEATHER_KINDS (or null)`);
    const put = (name: string, o: Record<string, unknown>) => { if (!T[name]) throw new Error(`--set: no table '${name}'`); for (const [k, v] of Object.entries(o)) { if (!(k in T[name])) throw new Error(`--set: ${name} has no '${k}'`);
      if (name === 'DRILL_AT') { for (const r of Object.keys(v as object)) if (!(r in SQUADS)) throw new Error(`--set: DRILL_AT rows are SQUADS rows: no '${r}'`); Object.assign(T[name][k], v); }   // (a map's row is patched, not replaced)
      else if (name === 'AIM' && v && typeof v === 'object' && !Array.isArray(v) && T[name][k] && typeof T[name][k] === 'object') Object.assign(T[name][k], v);   // (AIM's rows are per side — AIM.player.level: the named keys are set, the side's other rows stay)
      else T[name][k] = v; } };
    if (hard) put('HARD', hard);
    if (diff) {   // (DIFFICULTY.level = the switch; DIFFICULTY.fog / ai / kit = a lever moved alone over it — game/difficulty.ts LEVERS; a lever with no level stands over standard)
      const { level = 'standard', ...moved } = diff as Record<string, unknown>;
      if (level !== 'standard' && level !== 'hard') throw new Error(`--set: DIFFICULTY.level is standard or hard`);
      setDifficulty(level, false);
      for (const [k, v] of Object.entries(moved)) { const L = LEVERS.find((l: { key: string }) => l.key === k); if (!L) throw new Error(`--set: DIFFICULTY takes level, ${LEVERS.map((l: { key: string }) => l.key).join(', ')} (not ${k})`);
        if (!L.rungs.some((r: { id: string }) => r.id === v)) throw new Error(`--set: DIFFICULTY.${k} is one of ${L.rungs.map((r: { id: string }) => r.id).join(', ')}`); setLever(L.key, v as never, false); }
    }
    if (rest.OPENING) throw new Error('--set: OPENING is read while the game is built, which is before --set lands: TPS_OPENING=1 turns it on for the frozen stand, TPS_OPENING=0 off under TPS_PROFILE=shipped');
    for (const [name, o] of Object.entries(rest)) put(name, o);
    dug = DIGIN.on; bud = BUDDY.on; clOn = !!CLM?.CLEARLINE?.on; out.difficulty = difficultyNow(); if (leversMixed()) (out as any).levers = leversLine(true); if (HOUR.id !== 'night') out.hour = HOUR.id;
    Math.random = seeded(0x9137 + seed * 7919); fragStatsReset(); for (const k of Object.keys(PICTURE_STATS) as (keyof typeof PICTURE_STATS)[]) PICTURE_STATS[k] = 0;   // (picture.ts: this run's counts — the JSON's `picture`)
    HOLDFIRE_STATS.held = HOLDFIRE_STATS.heldGlass = 0; HOLDFIRE_STATS.lifts.shot = HOLDFIRE_STATS.lifts.order = HOLDFIRE_STATS.lifts.drill = 0;
    WEATHER_BOOT.kind = (wx?.kind as any) ?? null; if (wx?.kind) (out as any).weather = wx.kind;
    let W: any; try { W = await quiet(!verbose, () => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); } finally { WEATHER_BOOT.kind = null; } const g = W.game;
    DOORSTAY.on = (rest.DOORSTAY?.on as boolean | undefined) ?? true;   // (the page's default too: doors stay where they are left — the harness stood the game up with the closers of old; --set '{"DOORSTAY":{"on":false}}' keeps them)
    T.DOORMANNERS.on = (rest.DOORMANNERS?.on as boolean | undefined) ?? true;   // (and the doorway manners as shipped: headless.ts stands every other tool up without them; --set '{"DOORMANNERS":{"on":false}}' plays without)
    DOORBLAST.on = (rest.DOORBLAST?.on as boolean | undefined) ?? true;   // (and a blast takes a leaf off its hinges, as shipped: --set '{"DOORBLAST":{"on":false}}' = a charge flings it in on its hinge)
    for (const n of ['FRAG', 'MOVES', 'TURN', 'WOUND', 'AIM', 'GLASSPEN']) if (rest[n]) put(n, rest[n]);   // (standUp has just put the harness's own pins back over these — no defenders' frags, the movement pass, the turn weight, wounds and rounds through glass off, the old aim: src/host/standup.ts — so a --set row of theirs is put again; without this it was read and then silently lost)
    if ((set as any).SILENT) put('SILENT', (set as any).SILENT);   // (… and the silent order off the menu: --set '{"SILENT":{"on":true,"start":true}}' = a squad that stands up SILENT, as the loadout screen's row starts it)
    const destr0 = { ...DESTR_STATS }, gb0 = { ...GB_STATS } as Record<string, number>; if (process.env.PT_DUST === '1' && DESTRUCTION.on) W.dust = installDustStandin(W);
    (out as any).destr0 = [destr0, gb0];
    const fixWhy: Record<string, number> = {}; (out as any).destr0.push(fixWhy); if (DESTRUCTION.on) { const d = g.destr as any, kf = d.killFixture; d.killFixture = function (this: unknown, t: unknown, from: unknown, why: string, force?: boolean) { const ok = kf.call(this, t, from, why, force); if (ok) fixWhy[why] = (fixWhy[why] ?? 0) + 1; return ok; }; }   // (a bystander: what put each fixture out — blast / shaken / round — in the run's `destr.fixWhy`)
    if (rest.GUNWALL) put('GUNWALL', rest.GUNWALL);   // (and the weapons' wall rule: standUp's frozen stand has just pinned it off — TPS_GUNWALL — over a --set row)
    if (rest.FOG) put('FOG', rest.FOG);   // (and FOG.things: standUp's frozen stand has just pinned it off — TPS_FOGTHINGS — over a --set row; FOG.cone stays the difficulty's to write when the scenario starts)
    if (rest.LIGHTWALL) put('LIGHTWALL', rest.LIGHTWALL);   // (likewise the weapon lights' wall rule: standUp's frozen stand has just pinned it off — TPS_LIGHTWALL — over a --set row)
    if (rest.DOORPATH) put('DOORPATH', rest.DOORPATH);   // (standUp has just put the harness's own default — TPS_DOORPATH, else off — back over it)
    if (rest.REARWATCH) put('REARWATCH', rest.REARWATCH);   // (and the rear man's watch on the door behind: standUp's frozen stand has just pinned it off — TPS_REARWATCH — over a --set row)
    if (rest.STACKLINE) put('STACKLINE', rest.STACKLINE);
    if (rest.HAULHOME) put('HAULHOME', rest.HAULHOME);   // (and the hauled furniture's last hand to the door: standUp's frozen stand has just pinned it off — TPS_HAULHOME — over a --set row)   // (and the brisk walk onto a stack mark at an open door: standUp's frozen stand has just pinned it off — TPS_STACKLINE — over a --set row)
    resetWoundStats(); g.godMode = !MORTAL; g.tune.chaos = 0.5;   // (the page's default chaos; Sam cannot be hurt — the team is what is under test — but he is seen, heard and in the way)
    let q = scenarioQuery(E) as string; if (E.kind === 'roomclear' && process.env.PT_SAMEFLOOR !== '1') q = q.replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);   // (the flag itself, not a level file with the word in its name. PT_SAMEFLOOR=1 leaves the row's own flag: every seed then plays THE ONE FLOOR the row stands — with SAMESTART on, the level's first marks as written — and the seed is only the dice rolled in play; without it each seed pins a placement of its own, which no page deals any more)
    if (process.env.PT_SQUAD !== undefined) { if (!/^[0-4]$/.test(process.env.PT_SQUAD)) throw new Error(`PT_SQUAD=${process.env.PT_SQUAD}: a squad size is 0 to 4`); q = q.replace(/&squad4\b/, '').replace(/&squad=\d\b/, '') + `&squad=${process.env.PT_SQUAD}`; }   // (the loadout's size — game/loadout.ts — over the scenario's own)
    const { why } = await quiet(!verbose, () => startFromQuery(g, new URLSearchParams(q))); if (why) throw new Error(`start refused — ${why}`);
    if (process.env.PT_METER === 'sky') { const { installSkyMeter } = await import('./hour-lib.ts'); installSkyMeter(g); } else if (process.env.PT_METER) throw new Error(`PT_METER=${process.env.PT_METER}: sky, or unset`);
    if (DOOR && !g.doors.byName(DOOR)) throw new Error(`PT_DOOR=${DOOR}: this level has no door of that name`);
    if (EXTRA > 0) { const { uncap, spawnPast } = await import('./uncapped.ts'); const { standExtra } = await import(`${ROOT}/src/game/stress.ts`); uncap(W); const r = await quiet(!verbose, () => standExtra(g, EXTRA, spawnPast)); out.note = `PT_EXTRA: ${r.stood} of ${EXTRA} extra enemies stood${r.why ? ` (${r.why})` : ''}`; }
    P = new Player(W, E.kind, cap, verbose); cuesOn = !!CUES.on; P.handw = new HandleWatch(g, verbose ? (x: string) => P!.say(x) : null); for (const k in HANDLE_STATS) HANDLE_STATS[k] = 0; HANDLE_DEBUG.log = verbose ? (x: string) => P!.say(`   ▯ ${x}`) : null;   // (as this run has it: the tables are put back before the tally is written)
    if (process.env.PT_WAYS) { const { WaysWatch } = await import('./ways-watch.ts'); const PP = P; P.ways = new WaysWatch(g, (p: number[]) => (PP.tally as any).roomOf(p), (x: string) => PP.say(x)); }
    if (DESTRUCTION.on) { const { HoleWatch } = await import('./hole-watch.ts'); P.holes = new HoleWatch(g); }   // what the men do with what broke (RunOut.destr): a bystander, the digest is the same with it
    if (!process.env.PT_NODOORS) { const { DoorWatch } = await import('./door-watch.ts'); const PP = P; P.doorw = new DoorWatch(g, process.env.PT_DOORS && verbose ? (x: string) => PP.say(x) : null); { const M: any = await import(`${ROOT}/src/game/doorway.ts`).catch(() => null); if (M) { (P as any).doorM = M; for (const k of Object.keys(M.DOORMANNERS_STATS)) M.DOORMANNERS_STATS[k] = 0; if (process.env.PT_DOORS && verbose) M.DOORMANNERS_DEBUG.log = (x: string) => PP.say(`   ▯ manners · ${x}`); } } }   // (who crowds a doorway: always counted, a bystander; PT_DOORS=1 with --trace says each as it happens)
    if (process.env.PT_STACKLINE) { const { StackLineWatch } = await import('./stackline-watch.ts'); const PP = P, SW = new StackLineWatch(g, verbose ? (x: string) => PP.say(x) : null); Object.defineProperty(out, 'stackline', { enumerable: true, configurable: true, get: () => { const v = SW.out(); Object.defineProperty(out, 'stackline', { enumerable: true, value: v }); return v; } }); }   // (tools/qa/stackline-watch.ts — a bystander: how long each man is in the door's line while he walks up to stack on it, and who is shot there)
    if (process.env.PT_LINE) { const { LineWatch } = await import('./line-watch.ts'); const PP = P; P.linew = new LineWatch(g, (x: string) => PP.say(x)); }
    if (process.env.PT_NOCLOSER) for (const d of g.doors.list as any[]) d.def.closer = false;   // (every leaf stays where it is left: what the entry meets once doors stop shutting themselves)
    if (process.env.PT_LIGHTWALL) { const { LightWallWatch } = await import('./lightwall-watch.ts'); const { LIGHTWALL } = await import('../../src/game/lighting.ts'); const PP = P; P.lightw = new LightWallWatch(g, () => LIGHTWALL.on, (x: string) => PP.say(x)); }
    if (process.env.PT_FOGFIRE) { const { FogFireWatch } = await import('./fogfire-watch.ts'); const PP = P; P.fogw = new FogFireWatch(g, (x: string) => PP.say(x)); }
    if (process.env.PT_GUNWALL) { const { GunWallWatch } = await import('./gunwall-watch.ts'); const { GUNWALL } = await import('../../src/game/gunwall.ts'); const PP = P; P.gunw = new GunWallWatch(g, () => GUNWALL.on, (x: string) => PP.say(x)); }
    if (process.env.PT_PATHS) { const { PathsWatch } = await import('./paths-watch.ts'); const PP = P; P.paths = new PathsWatch(g, (x: string) => PP.say(x), process.env.PT_PATHS === 'rec'); }
    if (SAY) { const { SayWatch, watchCues } = await import('./say-watch.ts'); watchCues(CUES); P.sayw = new SayWatch(W); }
    const log = console.log, err = console.error, warn = console.warn; if (!verbose) console.log = console.error = console.warn = () => { };
    try { P.step(20); out.of = P.team.length; out.hostilesOf = P.hostiles.length; if (NOISE) { g.events.push({ kind: 'shot', pos: [P.pos[0], 0, P.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID, ptNoise: true } as any);   /* (ptNoise: DefWatch's `loudAt` stays the first REAL round, charge or boot) */ P.say('PT_NOISE: one loud round\'s report where the team starts'); } if (E.kind === 'rescue') playRescue(P); else if (SEARCH && E.kind === 'roomclear') playSearch(P); else playRooms(P); throw new Done('stalled', 'the script ran out of things to do'); }
    catch (e) {   // PT_AFTER: the game steps on with nobody at the keys — the run's own result (its seconds, who was up) is what stood at the end, taken first
      if (e instanceof Done && P.sayw) { P.sayw.mark(`end:${e.end}`); P.atEnd = { team: P.upAll.length, hostiles: P.hostiles.filter((h: any) => h.state !== 'dead').length };
        try { for (let i = 0, t = P.t; i < AFTER * 60; i++) { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) W.input.keys.delete(k); if (!MORTAL) g.player.visibility = 0.05; W.step(DT); t += DT; P.sayw.tick(t); } }
        catch (x) { P.sayw.mark(`after:error ${x instanceof Error ? x.message : String(x)}`); } }
      throw e; }
    finally { console.log = log; console.error = err; console.warn = warn; }
  } catch (e) {
    if (e instanceof Done) { out.end = e.end; out.why = e.why; } else { out.end = 'error'; out.why = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}` : String(e); }
  }
  if (P && WOUND.on) out.wounds = { team: P.team.filter((m: any) => m.wound).length, hostiles: P.hostiles.filter((h: any) => h.wound).length, zones: { ...WOUND_STATS.byZone }, again: WOUND_STATS.again, finished: WOUND_STATS.finished };
  if (BREAKER) (out as any).breaker = [...MAINS];
  if (P) { if (P.g.level.scenarios?.par) { const R = P.g.par?.result(); (out as any).par = R ? { secs: +R.secs.toFixed(1), lost: R.lost, total: +R.total.toFixed(1), medal: R.medal } : { medal: null, on: !!P.g.par?.data }; }   // (a par level — game/par.ts: the run's time, its penalty and its medal; medal null = no time: wiped, stalled, or the par switched off)
    if (WALL) (out as any).wall = WALL.wallTally(P); out.t = +P.t.toFixed(1); out.team = P.atEnd?.team ?? P.upAll.length; if (P.g.snatch?.man) { const S = P.g.snatch; (out as any).snatch = { plan: SNATCH_PLAN || 'front', end: S.end, why: S.why, lost: S.lost, killer: S.killer, handsUp: S.handsUp, tied: S.tied, state: S.man.civ.state, times: S.times, stats: S.stats, log: S.log.slice(-12) }; } out.hostiles = P.atEnd?.hostiles ?? P.hostiles.filter((h: any) => h.state !== 'dead').length; out.orders = P.orders; out.refused = P.refused; out.smells = P.watch.smells; out.deaths = P.watch.deaths; out.other = P.watch.otherStats; P.watch.aloneClose(); out.alone = P.watch.alone; out.upSecs = Math.round(P.watch.upSecs); out.aloneSecs = Math.round(P.watch.aloneSecs); out.rooms = P.rooms; out.entry = { ...P.g.entry.stats }; if (TOOL) out.thr = P.thr; if (TECH) (out as any).tech = TECH; out.entries = P.tally.close(); out.kills = P.tally.kills; out.losses = P.tally.losses; out.bangs = P.bangs0 - P.D.bangs; if (HOLD) out.told = P.told;
    if (P.kind === 'rescue') { const H = (P.g.rescue.hostages ?? []).map((h: any) => h.gd ?? h); out.hostages = [H.filter((h: any) => h.state !== 'dead').length, H.length];
      const R = P.g.rescue; if (Number.isFinite(R.t0)) out.clock = { t0: +(+R.t0).toFixed(2), secs: +(+R.resolveSecs).toFixed(2), log: (R.log as { t: number; what: string }[]).filter(x => /^(step|act|executed|teamfire|secured|unsecured|clear|crew)/.test(x.what) || (RPLAY === 'split' && x.what.startsWith('split:'))).map(x => [+x.t.toFixed(2), x.what] as [number, string]) }; }
    if (TIMES && P.ms.length) { const a = Float64Array.from(P.ms).sort(), at = (q: number) => +a[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(3), by: Record<string, [number, number]> = {}; P.ms.forEach((m, i) => { const k = String(P!.msAlive[i]); const b = by[k] ??= [0, 0]; b[0]++; b[1] += m; }); for (const b of Object.values(by)) b[1] = +(b[1] / b[0]).toFixed(3);
      out.frameMs = { n: a.length, mean: +(P.ms.reduce((x, y) => x + y, 0) / a.length).toFixed(3), p50: at(0.5), p95: at(0.95), p99: at(0.99), max: +a[a.length - 1].toFixed(3), byAlive: by }; }
    { const [d0, g0, fixWhy] = (out as any).destr0 as Record<string, number>[]; delete (out as any).destr0; const d: Record<string, number> = {}; for (const [k, v] of Object.entries(DESTR_STATS)) if ((v as number) - (d0[k] ?? 0)) d[k] = (v as number) - (d0[k] ?? 0);
      const gbs: Record<string, number> = {}; for (const [k, v] of Object.entries(GB_STATS)) if (typeof v === 'number' && v - (g0[k] ?? 0)) gbs[k] = v - (g0[k] ?? 0);
      const dark = P.g.targets.filter((t: any) => t.broken).length, dust = (P.W as any).dust;
      (out as any).destr = { on: DESTRUCTION.on, ...d, dark, ...(Object.keys(fixWhy).length ? { fixWhy } : {}), debrisPeak: P.g.destr.debris.stats.peakLive, debrisRefused: P.g.destr.debris.stats.refused, inv: P.g.destr.inventory(), ...(Object.keys(gbs).length ? { glass: gbs } : {}), ...(dust ? { dust: { ...dust.stats, minT: +dust.stats.minT.toFixed(3) } } : {}) }; }
    out.endgame = P.endw.close(P.t, out.end); if (P.search) out.search = P.search.close();
    if (P.handw) out.handle = { ...P.handw.close(), stats: { ...HANDLE_STATS } };
    if (clOn) out.clearLine = { ...CLM.CLEARLINE_STATS };
    if (LASTM?.LASTSTAND && (LASTM.LASTSTAND.regroup || LASTM.LASTSTAND.callOut)) { const r = LASTM.lastStandReport(P.g); out.lastStand = { on: r.on, stats: r.stats, room: r.room, in: r.in.length, out: r.out.length, named: r.named, said: r.said }; }
    if (P.leaves.length) (out as any).leaves = P.leaves;   // (the commander's own: open leaves across his way he pulled to — absent when he never did)
    if (SHUT) (out as any).shut = P.shut.map(({ ref, ...x }) => ({ ...x, open: !ref.latched }));   // (open: that door stands open again as the run ends)
    out.trace = P.trace; (out as any).frag = { ...FRAG_STATS }; (out as any).condition = { ...CONDITION_STATS }; (out as any).holdfire = { ...HOLDFIRE_STATS, lifts: { ...HOLDFIRE_STATS.lifts } };
    { const ids = new Map<number, string>(P.g.guards.map((x: any) => [x.char.id, x.team])); const T = { bursts: 0, teamKilled: 0, teamHit: 0, teamStunned: 0, teamBehindCover: 0, ownKilled: 0, ownHit: 0, ownStunned: 0, sam: 0 };   // what the DEFENDERS' grenades did (frag.ts FRAG_LOG): to the team, to their own side, to the commander (who is in god mode here: 'sam' counts bursts that would have had him)
      for (const r of FRAG_LOG) { if (ids.get(r.who) !== 'hostile') continue; T.bursts++; if (r.player === 'killed' || r.player === 'wounded' || r.player === 'stunned') T.sam++;
        for (const h of r.hits) { if (h.team === 'operative') { if (h.result === 'killed') T.teamKilled++; else if (h.result === 'wounded') T.teamHit++; else if (h.result === 'stunned') T.teamStunned++; else T.teamBehindCover++; } else if (h.team === 'hostile') { if (h.result === 'killed') T.ownKilled++; else if (h.result === 'wounded') T.ownHit++; else if (h.result === 'stunned') T.ownStunned++; } } }
      (out as any).fragTheirs = T; } (out as any).fragWhy = { ...FRAG_WHY }; (out as any).rear = { ...REARWATCH_STATS }; (out as any).picture = { ...PICTURE_STATS };   // (rearwatch.ts: the stack's rear watch and the taken rooms' doors kept over 'fall in' — its counters, this run's since every run is its own process)
      if (P.lightw) (out as any).lightwall = P.lightw.out(); if (P.gunw) (out as any).gunwall = P.gunw.out(); if (P.fogw) (out as any).fogfire = P.fogw.out(); if (CUES.overheard) { const L = P.g.cues.heardLog as { text: string; drawn: boolean; why: string }[]; (out as any).overheard = { offered: P.g.cues.stats.shouts, drawn: P.g.cues.stats.shoutsDrawn, said: [...new Set(L.filter(r => r.drawn).map(r => r.text))], held: L.filter(r => !r.drawn).map(r => `${r.why}: ${r.text}`) }; } /* (cues.ts overheard: hidden defenders' shouts offered · of them rows on the strip · their words · the ones held back and why) */ if (RUBBLE.on) (out as any).rubble = { ...P.g.destr.debris.feetStats, heap: { ...(P.g.destr.edgeLook?.footBook?.stats ?? {}) }, pool: { ...P.g.destr.debris.stats } }; if (CUTW) (out as any).cut = { on: CUTW.on(), first: P.cutFirst, counts: cutCounts(P.g), table: { ...CUTW.B }, plates: { cutPlates: CUTW.S.cutPlates, cutSplit: CUTW.S.cutSplit, crumbled: CUTW.S.crumbled }, pool: { ...(P.g.destr?.debris?.stats ?? {}) } }; if (DIGF) { (out as any).digestFrames = P.digFrames; if (P.digFrameAt) (out as any).digestFrameAt = P.digFrameAt; } if (process.env.PT_DIGEST) { out.digest = P.digest; out.digestMove = P.digestMove; if (P.series.length) out.digestSeries = P.series; if (P.digestAt) out.digestAt = P.digestAt; } out.cover = { ...P.g.cover.stats }; out.coverfire = coverfireReport(P.g); if ((P.g as any).cleared) (out as any).cleared = { ...(P.g as any).cleared.stats, summary: (P.g as any).cleared.summary() }; out.cues = { on: cuesOn, ...P.g.cues.stats, kinds: { ...P.g.cues.kinds }, ...(SAY ? { log: P.g.cues.log } : {}) }; out.tools = { ...P.D.stats }; out.pressure = pressureStats(P.g); if (bud) out.buddy = buddyStats(P.g); Object.assign(out, P.defw.close(P.t)); if (P.sayw) (out as any).said = P.sayw.close(); if (P.ways) (out as any).ways = P.ways.close(); if (P.paths) (out as any).paths = P.paths.close(); if (DOORPATH.on) (out as any).doorpath = { ...(P.g as any).doorPath.stats }; if (P.linew) (out as any).line = P.linew.close(P.t); if (P.holes) (out as any).destr = { ...(out as any).destr, ...P.holes.close() };   // (beside the chaos lane's counts written above: one `destr` block, both parts' keys — none shared)
    if (P.doorw) { (out as any).doors = P.doorw.close(); const M = (P as any).doorM; if (M) (out as any).doors.manners = { ...M.DOORMANNERS_STATS }; }
    { const sq = squadsReport(P.g); if (sq.length) { out.squads = sq; if (verbose) for (const q of sq) for (const e of q.events) console.log(`${e.t.toFixed(1).padStart(6)}     squad · ${q.name} ${e.what} (${e.n} at home): ${e.why}`); } }
    if (dug || out.squads) { out.digin = { ...DIGIN_STATS }; (out as any).diginShut = { ...DIGIN_SHUT };   // (DIGIN.shutOpen's own counts: doors pushed home, held, pulled again, other doors gone to, let be)
      if (verbose) for (const l of DIGIN_LOG) console.log(`${l.t.toFixed(1).padStart(6)}     dig-in · ${l.who}: ${l.what}`); } }
  return out;
}

// ───────────────────────────────────────────────────────────── the table ───────────────────────────────────────────
export function report(runs: RunOut[], md = false): string {
  const L: string[] = []; const scns = [...new Set(runs.map(r => r.scn))];
  const row = (cells: (string | number)[]) => md ? `| ${cells.join(' | ')} |` : cells.map((c, i) => String(c).padEnd(i === 0 ? 18 : 9)).join('');
  L.push(row(['scenario', 'runs', 'ended', 'stalled', 'error', 'secs', ...SMELLS])); if (md) L.push(`|${'---|'.repeat(6 + SMELLS.length)}`);
  for (const s of [...scns, 'ALL']) { const rs = s === 'ALL' ? runs : runs.filter(r => r.scn === s); if (!rs.length) continue;
    const ended = rs.filter(r => r.end !== 'stalled' && r.end !== 'error');
    L.push(row([s, rs.length, ended.length ? `${ended.length} (${[...new Set(ended.map(r => r.end))].map(e => `${ended.filter(r => r.end === e).length} ${e}`).join(', ')})` : 0, rs.filter(r => r.end === 'stalled').length, rs.filter(r => r.end === 'error').length, Math.round(rs.reduce((a, r) => a + r.t, 0) / rs.length), ...SMELLS.map(k => rs.reduce((a, r) => a + r.smells.filter(x => x.kind === k).length, 0))])); }
  L.push('');
  for (const k of SMELLS) { const all = runs.flatMap(r => r.smells.filter(x => x.kind === k).map(x => ({ r, x }))); if (!all.length) continue;
    L.push(`${md ? '**' : ''}${k}${md ? '**' : ''} — ${all.length} in ${new Set(all.map(a => `${a.r.scn}:${a.r.seed}`)).size} runs`);
    for (const a of all.slice(0, 12)) L.push(`${md ? '- ' : '    '}${a.r.scn}:${a.r.seed} @ ${a.x.t} s · ${a.x.who} ${a.x.at} · ${a.x.detail}`);
    if (all.length > 12) L.push(`${md ? '- ' : '    '}… and ${all.length - 12} more`); }
  { const ds = runs.flatMap(r => r.deaths ?? []), e = runs.reduce((a, r) => ({ pods: a.pods + (r.entry?.pods ?? 0), risky: a.risky + (r.entry?.risky ?? 0), moved: a.moved + (r.entry?.moved ?? 0) }), { pods: 0, risky: 0, moved: 0 });
    L.push(''); const door = (s: string | null) => !!s && s.startsWith('door:'), n = (f: (d: Death) => string | null) => `${ds.filter(d => f(d)).length} (${ds.filter(d => door(f(d))).length} a door)`;   // (the labels count gaps of the nav grid too; entrypoints.ts ships doors only)
    L.push(`uncleared openings — ${ds.length} teammates killed: ${n(d => d.open)} standing by and in the line of one, ${ds.filter(d => d.open && d.beyond).length} of them by a man beyond it · ${n(d => d.thru)} by a round through one · ${n(d => d.came)} by a man who had walked through one in the 8 s before · ${n(d => d.thru ?? d.came)} either · points dealt ${e.pods}, ${e.risky} of them by such an opening, ${e.moved} moved off one`); }
  const bad = runs.filter(r => r.end === 'stalled' || r.end === 'error');
  if (bad.length) { L.push(''); L.push('did not end:'); for (const r of bad) L.push(`    ${r.scn}:${r.seed} ${r.end} at ${r.t} s — ${r.why.split('\n')[0]} · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} up · ${r.rooms} entries`); }
  const ref = runs.flatMap(r => r.refused.map(x => `${r.scn}:${r.seed} ${x}`)); if (ref.length) { L.push(''); L.push(`orders refused (${ref.length}):`); for (const x of ref.slice(0, 12)) L.push(`    ${x}`); }
  return L.join('\n');
}

// ───────────────────────────────────────────────────────────── main ────────────────────────────────────────────────
if (import.meta.main) {
  const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN = ['--scn', '--seeds', '--cap', '--jobs', '--json', '--md', '--trace', '--set', '--one', '--out'];
  for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
  const cap = Number(flag('--cap') ?? 300), set = JSON.parse(flag('--set') ?? '{}');
  const ids: string[] = (flag('--scn') ?? SCENARIOS.map((e: any) => e.id).join(',')).split(',');
  for (const id of ids) if (!entryOf(id)) { console.error(NO_SCN(id)); process.exit(2); }
  for (const one of [flag('--trace'), flag('--one')]) if (one && !entryOf(one.split(':')[0])) { console.error(NO_SCN(one.split(':')[0])); process.exit(2); }
  if (flag('--trace')) { const [scn, seed] = flag('--trace')!.split(':'); const r = await play(scn, Number(seed ?? 1), cap, true, set); console.log(`\n${r.scn}:${r.seed} ${r.end} at ${r.t} s — ${r.why} · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} up · ${r.orders} orders · ${r.smells.length} smells`); process.exit(r.end === 'error' || r.end === 'stalled' ? 1 : 0); }
  if (flag('--one')) { const [scn, seed] = flag('--one')!.split(':'); const r = await play(scn, Number(seed), cap, false, set); const { trace: _t, ...rest } = r; writeFileSync(flag('--out')!, JSON.stringify(rest)); process.exit(0); }   // (to a file: a long line on stdout is cut short by the exit)
  const seeds = seedsOf(flag('--seeds') ?? '1-6'), jobs = Math.max(1, Number(flag('--jobs') ?? 4));
  const todo = ids.flatMap(scn => seeds.map(seed => ({ scn, seed }))), runs: RunOut[] = []; let next = 0; const t0 = Date.now();
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
    const file = resolve(tmpdir(), `playthrough-${process.pid}-${j.scn}-${j.seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--out', file, '--cap', String(cap), '--set', JSON.stringify(set)], { stdout: 'ignore', stderr: 'pipe' });
    const errText = await new Response(pr.stderr).text(); await pr.exited;
    let r: RunOut; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn: j.scn, seed: j.seed, end: 'error', why: `the run left no result — ${errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`, t: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, orders: 0, refused: [], smells: [], rooms: 0, note: '' }; }
    runs.push(r); console.error(`  ${j.scn}:${j.seed} ${r.end} ${r.t} s · team ${r.team}/${r.of} · ${r.smells.length} smells${r.end === 'error' ? ` — ${r.why.split('\n')[0]}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => ids.indexOf(a.scn) - ids.indexOf(b.scn) || a.seed - b.seed);
  console.log(report(runs, argv.includes('--md')));
  console.log(`\n${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ cap, set, ...(STACKWAIT > 0 ? { stackWait: STACKWAIT } : {}), ...(PAUSE > 0 ? { pause: PAUSE } : {}), ...(NOISE ? { noise: true } : {}), ...(SEARCH ? { search: true } : {}), ...(LASTM?.LASTSTAND && (LASTM.LASTSTAND.regroup || LASTM.LASTSTAND.callOut) ? { lastStand: { regroup: LASTM.LASTSTAND.regroup, callOut: LASTM.LASTSTAND.callOut } } : {}), runs }, null, 1));
  process.exit(runs.some(r => r.end === 'error' || r.end === 'stalled') ? 1 : 0);
}
