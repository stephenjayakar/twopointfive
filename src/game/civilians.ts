// Civilians (STATUS E12 (d) — the maintainer: "sound great, we'll need them for the campaign"): the building's own night people — Marta, who cleans the
// cubicle floor and the corridor, and Owen, working late at a desk in the cubicle farm — with rules of their own. They fight nobody and nobody fights them
// (teams.ts 'civilian': hostile to no side, no side hostile to them; they are Guard RECORDS for the plumbing that takes one — the arm lock, the ragdoll, the
// bubble, the path follower — kept in Game.civilians, never in Game.guards, so no AI side perceives, lines up or holds fire round one and every loop over the
// shift stays the shift's). ONE MODEL: what they see of Sam is the guards' own eye test (guards.ts eyeContact) reading HIS light meter through the guards' own
// sight-gain arithmetic (sightGain: light^1.5 × distance × crouch × motion across her view × the smoke between them), only less keen and, head down over a desk
// or a bin, narrower; what they hear is the guards' hearing model — the same events, the same horizons, the same propagation round the corners
// (collision.ts SoundPaths) with the suppressed pistol's own 'odd noise' reach — and what the men then hear of HER (a scream) travels the same way back.
// The loop: WORK her route (wipe the desks, empty the bins, sit typing, the cooler, the printer — a library clip laid over the whole figure, character.ts
// `act`) → a glimpse over the glimpse line: STARTLED (she stops, looks, 'hello…?', and mostly talks herself out of it) → clearly seen, or a body, or a gun
// out, or a shot / a charge / a scream in earshot: ALARMED (a frozen beat and a gasp) → FLEE at a run to the NEAREST, by path, of a living calm guard, a
// wall phone, or a way out — never past what frightened her → REPORT (to the man: what and where; he takes it as a fix — a look for 'somebody', weapon out
// and a search of the spot for an armed man or a body, radioed, the floor a step up) / PHONE (six seconds on the line, then control puts it out over the net
// and sends the nearest calm man) / out of the DOOR (gone; control rings the floor a little later) → COWER in a corner (crouched, whimpering; up and off again
// if the man with the gun comes at her). HELD from behind like a guard (player.ts: the same grab, the same arm): she can be QUESTIONED (a thing or two she knows
// — the side door's digits on their sticky note, who walks where), told to get down and stay quiet — COMPLY: let go into a corner, and she tells nobody anything
// unless a guard walks onto her — choked out or pistol-whipped (out cold: priced hard on the card) or shot (a 'civilian casualty': forty points, control's fury
// when they find her, and with tune.civilianKillFails the mission there and then). Guards REACT to her: a scream in earshot or a woman running through his
// torch turns a calm man toward where she came from; one found crouched in a corner is asked what happened and tells him; one found on the floor is a body
// like any body — called in, the floor up (a dead one: lockdown, whatever it was before). The response team coming clears them off the floor (control's line;
// they run for the doors and are gone). `Game.tune.civilians` is the switch (default on; off = nobody but the shift, today's game byte for byte); under the
// showcase tour, the breach's daylight and the attract loop they are not on the floor at all. Authored as data (levels/office.json `civilians`, scene/level.ts
// CivilianDef: her loop, the task and facing at each waypoint, her tints); the phones and the ways out are CIV_SPOTS below (TODO(LevelData), checked headless
// like qrf.ts QRF_MARKS). Lines: dialogue.ts CIV_LINES. QA: tools/qa/civilians-probes.ts (`probes.ts civilians`), soak.ts --civilians on|off.
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, DEG } from '../math/vec';
import { plainShort } from './gear';   // (a leaf: a weapon's name as it is written into a row)
import type { Game, DownKind, DownBy } from './game';
import { Guard } from './game';
import type { PatrolRoute, CivilianDef, CivilianTask } from '../scene/level';
import type { DialoguePick } from './dialogue';
import { CIV_LINES, CIV_COUNT, HOSTAGE_LINES, SNATCH_LINES, hashStr, roomName, isOffice } from './dialogue';
import type { HostageMoment } from './dialogue';
import { WORDS, w } from './words';   // (a leaf: the dialogue pass's one switch)
import { goTo, followPath, notGettingAnywhere, eyeContact, sightGain, sightGainOn, escalationOf, raiseEscalation, say, pointInView, bodyPos, meterOf, glassHeard } from './guards';
import { torchLightDef } from './rigProps';
import { isDaylight } from './lighting';
import { chronicle, chronicleN } from './chronicle';
import { tally, missionLive, DOWN_CARD_SECS } from './mission';
import { sendToLook } from './devices';
import { GLASS } from './glass';
import { RAG_COUNT } from './ragdoll';
import type { DoorContact } from './doors';
import type { Character } from './character';
import { hearPath, airTrans } from './weather';
import { simRandom, mulberry32, rollOn } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

// ================================================================ authored spots (TODO(LevelData): the phones and the ways off the floor belong in the level file beside the
// civilians block — like qrf.ts QRF_MARKS / needs.ts NEED_SPOTS they are checked headlessly against levels/office.json: free nav cells, reachable from every civilian's marks)
/** where a frightened civilian can ring security from (stand at `pos` facing `face`), and where she can get off the floor (`pos` just outside the door: reaching it = gone) */
export interface CivSpot { name: string; pos: Vec3; face: number; }
export const CIV_SPOTS = {
  phones: [
    { name: 'the reception phone', pos: [8.9, 0, 13.8], face: 0 },              // the staff side of the reception counter (the desk phone sits on its north edge at (8.45, 1.18, 14.85)), facing south over it
    { name: 'the break-room phone', pos: [34.6, 0, 16.2], face: Math.PI / 2 },  // the wall set over the break-room counter, two steps south of the coffee machine (needs.ts has a man stand at 14.4), facing the counter
  ] as CivSpot[],
  exits: [
    { name: 'the fire exit', pos: [38.2, 0, 23.2], face: 0 },                   // out through the fire exit and away down the east strip past the dumpster (reaching it = off the floor: she is gone into the night from there, not on the doorstep)
    { name: 'the outside door', pos: [34.0, 0, 25.0], face: Math.PI / 2 },        // out through the break room's outside door and east along the alley past the van
  ] as CivSpot[],
};

/** THE PHONES AND THE WAYS OFF THIS LEVEL'S FLOOR: a level that carries its own places (its file's scenarios.quiet.phones / .wayouts — scene/scenarios.ts
 *  QuietData; a level with a quiet mission says which its floor has, and one it leaves out is simply not there: she runs for a guard, or hides) reads them;
 *  every other level reads the office's table above, as it always has. */
export function civSpots(g: Game): { phones: CivSpot[]; exits: CivSpot[] } {
  const N = g.level.scenarios?.snatch;   // (game/snatch.ts: the one man of a snatch level runs for the block's own ways out; no phone, nobody to tell)
  if (N) { let o = ownSpots.get(N); if (!o) ownSpots.set(N, o = { phones: [], exits: N.exits.map(e => ({ name: e.name, pos: e.pos, face: 0 })) }); return o; }
  const Q = g.level.scenarios?.quiet; if (!Q) return CIV_SPOTS;
  let o = ownSpots.get(Q); if (!o) ownSpots.set(Q, o = { phones: (Q.phones ?? []).map(s => ({ name: s.name, pos: s.pos, face: s.face })), exits: (Q.wayouts ?? []).map(s => ({ name: s.name, pos: s.pos, face: s.face })) });
  return o;
}
const ownSpots = new SideMap<object, { phones: CivSpot[]; exits: CivSpot[] }>('civilians.ownSpots');

// ================================================================ numbers (Tab ▸ Sandbox ▸ civilians rows read a few; the switch and killFails persist per machine)
export const CIV = {
  /** her eye against the guards' (guards.ts GUARD_EYE 16 m / 58° / near field 3.5 m of 100°): walking about; head down over a task; once frightened (looking for it) */
  eye: { range: 12, halfDeg: 50, nearM: 2.5, nearDeg: 95 },
  eyeBusy: { range: 8, halfDeg: 34, nearM: 2.0, nearDeg: 80 },
  eyeAlarmed: { range: 14, halfDeg: 62, nearM: 3.0, nearDeg: 100 },
  /** × the guards' sight gain on Sam (a civilian is not looking for anyone); × that again for a gun in his hand seen inside gunM (or him doing violence) */
  keenK: 0.6, gunK: 2.5, gunM: 10,
  /** awareness lines: over glimpseAt she stops and looks ('hello…?'); over spotAt she has SEEN him — the guards' own alert line */
  glimpseAt: 0.3, spotAt: 0.85,
  /** the startle: how long she stands looking before she talks herself out of it; a second inside this and it is no longer nothing */
  startleSecs: 4.0, startleAgainSecs: 20,
  /** bodies: seen inside this range in her cone with a clear line to the pelvis (no light asked, as the men's own body test asks none) */
  bodyM: 10,
  /** the frozen beat before she runs (dealt per civilian and fright inside the window), her run, her walk, the crouched creep into a corner */
  freeze: [0.4, 0.8] as [number, number], runSpeed: 3.2, walkSpeed: 1.05, creepSpeed: 1.2,
  /** the report: she stops this close to the man (in sight of him) and takes this long telling him; the phone call's length */
  reportM: 2.2, reportSecs: 2.6, phoneSecs: 6,
  /** target choice: metres of path a GUARD is worth over a phone (a person beats a handset), what leaving the floor costs over either (the last resort), and what a
   *  target the far side of the fright costs (she does not run past him to reach it) */
  guardBonusM: 4, exitMalusM: 6, pastThreatM: 15,
  /** cowering: the corner is looked for within this; the man with the gun inside refleeM of her (and seen) puts her up and off again, once; not told to stay and
   *  nobody come for her in loneSecs, she goes looking for a guard again; told and the floor calm again for settleSecs, back to work */
  cornerM: 4, refleeM: 6, loneSecs: 45, settleSecs: 75,
  /** 'stay down, stay quiet': minutes she stays put and tells nobody (unless a man walks onto her) */
  complyMin: 3,
  /** the men: a scream carries this far by the sound's own path (× its carry); a running / screaming woman is SEEN inside seeM in his cone if lit past seeLit on her own
   *  meter (or inside 4 m); one crouched in a corner is found inside foundM with a clear line, and asked after foundSecs */
  screamM: 16, seeM: 12, seeLit: 0.25, foundM: 3.0, foundSecs: 1.2,
  /** control rings the floor this long after a civilian gets out of the building */
  outsideCallSecs: 18,
  /** passing pleasantries with a calm man inside greetM (a clear line between them): at most one per pair per pairSecs and one on the floor per floorSecs — off = never */
  greet: true, greetM: 3.0, greetPairSecs: 240, greetFloorSecs: 70,
  /** the response team on its way: control clears them off the floor (they run for the doors) */
  evacuateOnQrf: true,
};

/** the price list's civilian terms live in chronicle.ts SCORE (civReported / civKO / civKilled) with the rest of the card's */

// ================================================================ ids, tints, dice
/** character ids: clear of Sam's 1, the staff's 10‥15 and the units' 20‥ (qrf.ts / breach.ts take the low twenties); ≥ 10 so a leaf she pushes is 'a door one of us
 *  opened' to the men's ears (guards.ts hearingCheck: who ≥ 10), not a creak nobody can explain */
const CIV_ID0 = 40;
// her own dice (line picks, the frozen beat) are mulberry32 (math/dice.ts) off her name — never Math.random, so a floor with her on it and unprovoked is the seeded floor without her
// (the same die with its state kept ON the record — `dice`, rolled by `rnd` = math/dice.ts rollOn, which captures nothing — so a checkpoint carries it, a loaded
//  civilian draws on exactly where she was, and a record a rollback snapshot puts into another game rolls its own die, not the first game's)
/** run `fn` with Math.random swapped for a private seeded die: the Guard / Character constructors draw from Math.random (the idle phase, the look clock) and a civilian's
 *  construction must not move the game's own sequence by one draw (every seeded QA run, every frozen identity digest, is of the floor WITHOUT her) */
function withDice<T>(seed: number, fn: () => T): T { const R = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = R; } }

// ================================================================ the record (Guard.civ)
export type CivState = 'work' | 'startled' | 'alarmed' | 'flee' | 'report' | 'phone' | 'cower' | 'held' | 'evacuate' | 'gone';
/** what frightened her: Sam seen plainly / with a gun out (or doing violence) / a body / gunfire, a stun charge, a door kicked in / the suppressed pistol's odd report
 *  close by / another civilian's scream / a crash right beside her twice over / Sam's arm round her throat / the panel's button */
export type CivCause = 'sam' | 'gun' | 'body' | 'gunfire' | 'shot' | 'bang' | 'scream' | 'noise' | 'grabbed' | 'panel';
/** whom / what she is running to */
export interface CivTarget { kind: 'guard' | 'phone' | 'exit'; guard: Guard | null; spot: CivSpot | null; pos: Vec3; name: string; planPos: Vec3; }
export interface Civ {
  def: CivilianDef; name: string; label: string; she: string; her: string;
  state: CivState; stateAt: number;
  /** work: seconds into the task at the current waypoint; standing up out of a chair holds her feet this long; seated = pinned onto the chair (no collision, no shove);
   *  settleT = seconds spent stepping the last hand's breadth onto the mark itself (the path ends on a cell centre) before the task begins, −1 = not settling */
  taskT: number; riseT: number; seated: boolean; settleT: number;
  /** the startle: where she is looking, until when; when she last talked herself out of one */
  lookAt: Vec3 | null; lookUntil: number; shrugAt: number;
  /** the fright: what, where it was (what she tells the man / the phone: the men's fix), when, whether it means an ARMED man (a gun, a body, gunfire, the arm), and a
   *  serial per fright (the men are each told once per fright) */
  cause: CivCause | null; causePos: Vec3 | null; causeAt: number; armed: boolean; alarmN: number;
  /** eyes on Sam: when last, where; whether she has seen the gun */
  seenAt: number; seenPos: Vec3 | null; sawGun: boolean;
  /** the run: the target, when it was last re-chosen, targets that came to nothing this fright, the frozen beat's end; pinTarget = sent (the panel's phone button): no re-choosing */
  target: CivTarget | null; retargetAt: number; badTargets: Set<object>; freezeUntil: number; pinTarget: boolean;
  /** the report / the call: the man being told, the clock, whether this fright has been told to a man / rung in / put out by control */
  reportTo: Guard | null; talkT: number; reported: boolean; phoned: boolean; acked: boolean;
  /** the corner: where, told to stay (until when), whether she has got up and run from it once, seconds a man has stood by her */
  cowerAt: Vec3 | null; complied: boolean; complyUntil: number; refled: boolean; foundT: number; foundBy: Guard | null; foundLineAt: number; foundTold: boolean;
  /** a rescue's hostage told to get up and come (hostageLead — rescueend.ts): whom she follows (null: nobody — she is down where she was put), and how far behind
   *  him she stops. Not in the civilians' own snapshot: no checkpoint is reachable with a rescue staged, and rescueend.ts restore() gives the word again */
  lead: Character | null; leadGap: number;
  /** her voice: when she last screamed (what the men and the other civilian hear), whimper clock, greeting clocks */
  screamAt: number; whimperAt: number; greetAt: number; lastLineAt: number;
  /** the men told of THIS fright already (a scream heard, her seen running), by alarm serial */
  told: WeakMap<Guard, number>;
  /** bodies she has already seen (one fright per body) */
  knownBodies: WeakSet<object>;
  /** questioned in the arm: how many things she has given */
  intelN: number;
  /** control's call after she got out: due at (−1 none) */
  outsideCallAt: number;
  /** her light meter (what a man's eye gets off her running through his torch): eased like everybody's */
  vis: number;
  /** her own dice: the mulberry state (a checkpoint keeps it) and the draw off it */
  dice: number; rnd: (this: { dice: number }) => number;
  /** what happened when (probes / the panel): 't state/cause …' */
  log: string[];
}

/** module-wide counters for the QA soak and the last things that happened (probes / the panel) */
export const CIV_STATS = { spawned: 0, startled: 0, alarmed: 0, fled: 0, reports: 0, phoned: 0, outsideCalls: 0, cowered: 0, complied: 0, ko: 0, killed: 0, found: 0, foundDown: 0, evacuated: 0, greetings: 0, refled: 0, noticed: 0, samSeen: 0 };
export const CIV_LOG: { t: number; who: string; what: string }[] = [];
export const CIV_DEBUG: { log: ((s: string) => void) | null } = { log: null };
function log(g: Game, gd: Guard, what: string) { const C = gd.civ!; C.log.push(`${g.time.toFixed(1)} ${what}`); if (C.log.length > 40) C.log.splice(0, 10); CIV_LOG.push({ t: g.time, who: C.name, what }); if (CIV_LOG.length > 200) CIV_LOG.splice(0, 50); CIV_DEBUG.log?.(`${g.time.toFixed(2)}s ${C.name}: ${what}`); }

// ================================================================ standing them up / down
/** Fresh civilians on their first marks (game.ts: at construction after the shift, and resetCivilians). Nothing with the switch off or none authored. */
export function spawnCivilians(g: Game) {
  g.civilians = [];
  if (!g.tune.civilians || g.nightBreach?.active || g.rescue?.active) return;   // (the night breach playtest clears the floor of everybody but its cast — nightbreach.ts)
  const defs = g.level.civilians ?? [];
  defs.forEach((def, i) => { g.civilians.push(makeCivilian(g, def, i)); CIV_STATS.spawned++; });
}
/** restartEncounter / resetGuards: whoever Sam has hold of or is hauling let go of, then fresh civilians (or none, the switch off since) */
export function resetCivilians(g: Game) {
  const pl = g.player;
  if (pl) {
    if (pl.holding?.g.civ) { const gd = pl.holding.g; gd.held = null; gd.char.anim.heldPose = null; pl.holding = null; pl.char.anim.holdPose = null; }
    if (pl.dragging?.civ) g.toggleDrag();
    if (pl.takedown?.g.civ) pl.takedown = null;
  }
  for (const cv of g.civilians) forgetMeter(g, cv);
  const F = floorOf(g); F.evacTold = false; F.greetAt = -1e9; F.pending.length = 0;   // (a word due from a man of the old shift is nobody's now)
  spawnCivilians(g);
}
// ================================================================ save / load — the checkpoints' slice (game/savestate.ts saveState / applyState call these two)
/** One civilian as plain data — everything the next frame of hers hangs on: where she is and how she is moving (the Guard record's share: place, gait, the mark she
 *  is on and its wait, the walk under way with its watchdogs, her ears' marker in the event ids, the arm-lock's talk record, her bubble); how she went down if she
 *  did (and the body's particles, laid down again asleep like the men's — savestate.ts RagSnap); and the Civ record whole: the task's clocks, the startle, the
 *  fright (what / where / when / armed / its serial), whom she is running to (a man by CALLSIGN, a phone / a way out by name, the plan's points), whom she has told
 *  and how far the telling got, the corner and the promise, who has stood by her, her voice's clocks, the men already told of this fright and the bodies she
 *  knows of (by callsign), what she has given up in the arm, control's call due, her meter, her dice. Absolute game times throughout (`CivSnap.time` rides
 *  along so a restore under another clock can shift them). A civilian HELD at the save is filed held: on the first frame after the load she comes off an arm that
 *  is no longer round her exactly as off a cancelled hold (released: the fright of her life, from where Sam stands). */
export interface CivSnapOne {
  id: string;
  pos: Vec3; vel: Vec3; yaw: number; aimYaw: number; crouch: number; animPhase: number; speed: number; stepPhase: number; lookPhase: number;
  wp: number; wait: number; awareness: number; heardUpTo: number;
  path: Vec3[]; pathI: number; pathGoal: Vec3 | null; repathT: number; lastPos: Vec3; stuckT: number; stuckN: number; stallRef: Vec3 | null; stallT: number;
  talk: { stage: number; presses: number; lastT: number; abortT: number }; bubble: { text: string; t: number; dur: number; radio: boolean } | null;
  down: { kind: DownKind; by: DownBy; at: number; found: boolean; rag: { x: number[]; rot: [number, number, number, number]; sleeping: boolean; own?: boolean } | null } | null;   // (own: savestate.ts RagSnap — the trunk's rest shape is these particles' own on a load)
  state: CivState; stateAt: number; taskT: number; riseT: number; settleT: number; seated: boolean; lookAt: Vec3 | null; lookUntil: number; shrugAt: number;
  cause: CivCause | null; causePos: Vec3 | null; causeAt: number; armed: boolean; alarmN: number; seenAt: number; seenPos: Vec3 | null; sawGun: boolean;
  target: { kind: 'guard' | 'phone' | 'exit'; guard: string | null; spot: string | null; pos: Vec3; planPos: Vec3 } | null; retargetAt: number; badTargets: string[]; freezeUntil: number; pinTarget: boolean;
  reportTo: string | null; talkT: number; reported: boolean; phoned: boolean; acked: boolean;
  cowerAt: Vec3 | null; complied: boolean; complyUntil: number; refled: boolean; foundT: number; foundBy: string | null; foundLineAt: number; foundTold: boolean;
  screamAt: number; whimperAt: number; greetAt: number; lastLineAt: number; told: [string, number][]; knownBodies: string[]; intelN: number; outsideCallAt: number; vis: number; dice: number;
}
/** the queue's entries: `cv` / `o` by callsign */
export interface CivPendingSnap { at: number; kind: PendKind; cv: string; o: string | null; key?: string; armed?: boolean; pos?: Vec3; lvl?: number; dead?: boolean; }
export interface CivSnap { time: number; list: CivSnapOne[]; floor: { evacTold: boolean; greetAt: number; pending: CivPendingSnap[] }; }
export function civiliansSnapshot(g: Game): CivSnap {
  const cp = (p: Vec3 | null | undefined): Vec3 | null => p ? v3.copy(p) : null;
  const list: CivSnapOne[] = g.civilians.map(gd => {
    const C = gd.civ!, c = gd.char, dead = gd.state === 'dead', rag = c.ragdoll;
    const told: [string, number][] = []; for (const o of g.guards) { const n = C.told.get(o); if (n !== undefined) told.push([o.callsign, n]); }
    const knownBodies: string[] = []; for (const o of [...g.guards, ...g.civilians]) if (o !== gd && C.knownBodies.has(o)) knownBodies.push(o.callsign);
    return {
      id: C.def.name,
      pos: v3.copy(c.pos), vel: dead ? [0, 0, 0] : v3.copy(c.vel), yaw: c.bodyYaw, aimYaw: c.aimYaw, crouch: c.anim.crouchTarget, animPhase: c.anim.phase, speed: gd.speed, stepPhase: gd.stepPhase, lookPhase: gd.lookPhase,
      wp: gd.wp, wait: gd.wait, awareness: gd.awareness, heardUpTo: gd.heardUpTo,
      path: gd.path.map(p => v3.copy(p)), pathI: gd.pathI, pathGoal: cp(gd.pathGoal), repathT: gd.repathT, lastPos: v3.copy(gd.lastPos), stuckT: gd.stuckT, stuckN: gd.stuckN, stallRef: cp(gd.stallRef), stallT: gd.stallT,
      talk: { stage: gd.talk.stage, presses: gd.talk.presses, lastT: gd.talk.lastT, abortT: gd.talk.abortT }, bubble: gd.bubble ? { ...gd.bubble } : null,
      down: dead ? { kind: gd.downKind ?? 'struck', by: gd.downBy ?? 'world', at: gd.diedAt, found: gd.found, rag: rag ? { x: Array.from(rag.x, x => Math.round(x * 1e4) / 1e4), rot: [rag.rot[0], rag.rot[1], rag.rot[2], rag.rot[3]], sleeping: rag.sleeping, own: true } : null } : null,
      state: C.state, stateAt: C.stateAt, taskT: C.taskT, riseT: C.riseT, settleT: C.settleT, seated: C.seated, lookAt: cp(C.lookAt), lookUntil: C.lookUntil, shrugAt: C.shrugAt,
      cause: C.cause, causePos: cp(C.causePos), causeAt: C.causeAt, armed: C.armed, alarmN: C.alarmN, seenAt: C.seenAt, seenPos: cp(C.seenPos), sawGun: C.sawGun,
      target: C.target ? { kind: C.target.kind, guard: C.target.guard?.callsign ?? null, spot: C.target.spot?.name ?? null, pos: v3.copy(C.target.pos), planPos: v3.copy(C.target.planPos) } : null, retargetAt: C.retargetAt,
      badTargets: [...C.badTargets].map(x => (x as Guard).callsign ?? (x as CivSpot).name).filter(Boolean), freezeUntil: C.freezeUntil, pinTarget: C.pinTarget,
      reportTo: C.reportTo?.callsign ?? null, talkT: C.talkT, reported: C.reported, phoned: C.phoned, acked: C.acked,
      cowerAt: cp(C.cowerAt), complied: C.complied, complyUntil: C.complyUntil, refled: C.refled, foundT: C.foundT, foundBy: C.foundBy?.callsign ?? null, foundLineAt: C.foundLineAt, foundTold: C.foundTold,
      screamAt: C.screamAt, whimperAt: C.whimperAt, greetAt: C.greetAt, lastLineAt: C.lastLineAt, told, knownBodies, intelN: C.intelN, outsideCallAt: C.outsideCallAt, vis: C.vis, dice: C.dice,
    };
  });
  const F = floorOf(g);
  return { time: g.time, list, floor: { evacTold: F.evacTold, greetAt: F.greetAt, pending: F.pending.map(P => ({ at: P.at, kind: P.kind, cv: P.cv.callsign, o: P.o?.callsign ?? null, key: P.key, armed: P.armed, pos: P.pos ? v3.copy(P.pos) : undefined, lvl: P.lvl, dead: P.dead })) } };
}
/** Put the civilians back as `snap` has them ONTO THE FRESH ROSTER a restart has just stood up (savestate.ts applyState runs after restartEncounter → resetGuards
 *  → resetCivilians: no second reset here), each entry applied by name — clocks shifted by (now − snap.time), men found again by callsign (one gone = that
 *  target / teller dropped: she re-chooses next frame), a downed one laid down where she lay, asleep at the file's particles (no score, no line: the chronicle
 *  carries the original row; found stays found), the queue of words due put back. `snap` null (a file from before this slice, or the switch off at the save):
 *  the fresh ones stay on their marks — but their EARS are set right either way: a fresh civilian's marker was stamped off the abandoned future's event count,
 *  which the load has just wound back (review G3.1: deaf for minutes after every load). Entries for civilians this level no longer has are ignored. */
export function civiliansRestore(g: Game, snap: CivSnap | null | undefined) {
  for (const cv of g.civilians) { cv.heardUpTo = Math.min(cv.heardUpTo, g.eventSeq); cv.civ!.stateAt = Math.min(cv.civ!.stateAt, g.time); }   // (both stamped at construction off the abandoned future: the event count and the clock have since gone BACK)
  if (!snap || !Array.isArray(snap.list)) return;
  const fin = (x: number | undefined | null, d = 0) => typeof x === 'number' && Number.isFinite(x) ? x : d;
  const dtc = g.time - fin(snap.time, g.time); const sh = (t: number | undefined | null, d = -1e9) => { const v = fin(t, d); return v > -1e8 && v < 1e8 ? v + dtc : v; };
  const cp = (p: Vec3 | null | undefined): Vec3 | null => p && p.length >= 3 ? [fin(p[0]), fin(p[1]), fin(p[2])] : null;
  const man = (cs: string | null | undefined) => (cs && g.guards.find(x => x.callsign === cs && x.state !== 'dead')) || null;
  const anyone = (cs: string | null | undefined) => (cs && (g.guards.find(x => x.callsign === cs) ?? g.civilians.find(x => x.callsign === cs))) || null;
  const spotOf = (kind: string, name: string | null | undefined) => (kind === 'phone' ? civSpots(g).phones : kind === 'exit' ? civSpots(g).exits : [...civSpots(g).phones, ...civSpots(g).exits]).find(x => x.name === name) ?? null;
  for (const S of snap.list) {
    const gd = g.civilians.find(x => x.civ!.def.name === S.id); if (!gd) continue; const C = gd.civ!, c = gd.char;
    // the Guard record's share
    c.pos = cp(S.pos) ?? c.pos; c.vel = cp(S.vel) ?? [0, 0, 0]; c.bodyYaw = fin(S.yaw); c.aimYaw = fin(S.aimYaw, c.bodyYaw); c.aimPitch = 0; c.anim.crouchTarget = fin(S.crouch); c.anim.phase = fin(S.animPhase); gd.speed = fin(S.speed); gd.stepPhase = fin(S.stepPhase); gd.lookPhase = fin(S.lookPhase);
    gd.wp = (S.wp | 0) % Math.max(1, gd.route.points.length); gd.wait = fin(S.wait); gd.awareness = clamp(fin(S.awareness), 0, 1); gd.heardUpTo = Math.min(fin(S.heardUpTo, g.eventSeq), g.eventSeq);
    gd.path = (S.path ?? []).map(p => cp(p) ?? [0, 0, 0]); gd.pathI = Math.max(0, S.pathI | 0);   // (as saved, NOT clamped to the path: a walk that ended and had its path cleared leaves pathI past the empty list — inert, every reader asks pathI < path.length — and clamping it made load ≠ the game stepped on, and save(load(s)) ≠ s)
    gd.pathGoal = cp(S.pathGoal); gd.repathT = fin(S.repathT); gd.lastPos = cp(S.lastPos) ?? v3.copy(c.pos); gd.stuckT = fin(S.stuckT); gd.stuckN = S.stuckN | 0; gd.stallRef = cp(S.stallRef); gd.stallT = fin(S.stallT);
    if (S.talk) { gd.talk.stage = S.talk.stage | 0; gd.talk.presses = S.talk.presses | 0; gd.talk.lastT = fin(S.talk.lastT, -1); gd.talk.abortT = fin(S.talk.abortT, -1); gd.talk.heldSince = -1; }
    gd.bubble = S.bubble ? { text: String(S.bubble.text), t: sh(S.bubble.t), dur: fin(S.bubble.dur), radio: !!S.bubble.radio } : null;
    gd.held = null; c.anim.heldPose = null;
    if (S.down) {   // the body: settled where she lay (savestate.ts lays the men down the same way)
      gd.state = 'dead'; gd.speed = 0; gd.diedAt = sh(S.down.at); gd.downKind = S.down.kind; gd.downBy = S.down.by; gd.found = !!S.down.found; c.anim.act = null; C.target = null; C.reportTo = null;
      c.update(0); c.ragdollize(g.col, [Math.sin(c.bodyYaw), 0, Math.cos(c.bodyYaw)], true);
      const R = S.down.rag; if (R && R.x?.length === RAG_COUNT * 3 && c.ragdoll) { c.ragdoll.settleAt(R.x, R.rot, R.own === true); if (R.sleeping === false) c.ragdoll.wake(); }
      c.vel = [0, 0, 0]; c.anim.speed = 0; c.update(0);
      log(g, gd, `restored — down (${gd.downKind}${gd.found ? ', found' : ''})`);
      continue;
    }
    // the Civ record
    C.state = S.state; C.stateAt = sh(S.stateAt); C.taskT = fin(S.taskT); C.riseT = fin(S.riseT); C.settleT = fin(S.settleT, -1); C.seated = !!S.seated; C.lookAt = cp(S.lookAt); C.lookUntil = sh(S.lookUntil, -1); C.shrugAt = sh(S.shrugAt);
    C.cause = S.cause ?? null; C.causePos = cp(S.causePos); C.causeAt = sh(S.causeAt, -1); C.armed = !!S.armed; C.alarmN = S.alarmN | 0; C.seenAt = sh(S.seenAt); C.seenPos = cp(S.seenPos); C.sawGun = !!S.sawGun;
    C.target = null;
    if (S.target) {
      if (S.target.kind === 'guard') { const o = man(S.target.guard); if (o) C.target = { kind: 'guard', guard: o, spot: null, pos: cp(S.target.pos) ?? v3.copy(o.char.pos), name: o.callsign, planPos: cp(S.target.planPos) ?? v3.copy(o.char.pos) }; }
      else { const spot = spotOf(S.target.kind, S.target.spot); if (spot) C.target = { kind: S.target.kind, guard: null, spot, pos: v3.copy(spot.pos), name: spot.name, planPos: v3.copy(spot.pos) }; }
      if (!C.target) { gd.path = []; gd.pathGoal = null; }   // (her man is gone: flee() re-chooses on the next frame)
    }
    C.retargetAt = sh(S.retargetAt); C.freezeUntil = sh(S.freezeUntil, -1); C.pinTarget = !!S.pinTarget && !!C.target;
    C.badTargets.clear(); for (const n of S.badTargets ?? []) { const x = man(n) ?? spotOf('', n); if (x) C.badTargets.add(x); }
    C.reportTo = man(S.reportTo); if (C.state === 'report' && !C.reportTo) { C.state = 'flee'; C.stateAt = g.time; c.anim.act = null; }
    C.talkT = fin(S.talkT); C.reported = !!S.reported; C.phoned = !!S.phoned; C.acked = !!S.acked;
    C.cowerAt = cp(S.cowerAt); C.complied = !!S.complied; C.complyUntil = sh(S.complyUntil, -1); C.refled = !!S.refled; C.foundT = fin(S.foundT); C.foundBy = man(S.foundBy); C.foundLineAt = S.foundLineAt < 0 ? -1 : sh(S.foundLineAt, -1); C.foundTold = !!S.foundTold;
    C.screamAt = sh(S.screamAt); C.whimperAt = sh(S.whimperAt); C.greetAt = sh(S.greetAt); C.lastLineAt = sh(S.lastLineAt);
    C.told = new SideMap(); for (const [cs, n] of S.told ?? []) { const o = man(cs); if (o) C.told.set(o, n | 0); }
    C.knownBodies = new SideSet(); for (const cs of S.knownBodies ?? []) { const o = anyone(cs); if (o) C.knownBodies.add(o); }
    C.intelN = S.intelN | 0; C.outsideCallAt = S.outsideCallAt < 0 ? -1 : sh(S.outsideCallAt, -1); C.vis = fin(S.vis); if (Number.isFinite(S.dice)) C.dice = S.dice | 0;
    // the figure: the task's clip back on her at once where she was in it (a woman at her desk loads seated, not standing up into the chair over a second)
    const K = C.state === 'work' && gd.wait > 0 ? TASK_CLIP[taskAt(gd)] : null;
    c.anim.act = K ? { clip: K.clip, loop: K.loop, rate: K.rate, in: 0, out: K.out } : (C.state === 'report' || C.state === 'phone') ? { clip: 'Idle_Talking_Loop', loop: true, rate: 1.2, in: 0, out: 0.4 } : null;
    c.update(0);
    log(g, gd, `restored — ${C.state}${C.cause ? ` [${C.cause}${C.armed ? ', armed' : ''}]` : ''}${C.target ? ` → ${C.target.name}` : ''}`);
  }
  // the floor's memory and the queue of words due (an entry whose civilian is gone is dropped; a man gone = the doing runs with nobody excepted, as it would had he died meanwhile)
  const F = floorOf(g), SF = snap.floor;
  if (SF) {
    F.evacTold = !!SF.evacTold; F.greetAt = sh(SF.greetAt); F.pending.length = 0;
    for (const P of SF.pending ?? []) { const cv = g.civilians.find(x => x.callsign === P.cv); if (!cv || !KINDS.has(P.kind)) continue; F.pending.push({ at: sh(P.at, g.time), kind: P.kind, cv, o: anyone(P.o) ?? null, key: P.key, armed: P.armed, pos: cp(P.pos) ?? undefined, lvl: P.lvl, dead: P.dead }); }
  }
}
const KINDS: ReadonlySet<PendKind> = new Set<PendKind>(['greetReply', 'reportRadio', 'escalate', 'outsideCall', 'complyLine', 'foundReport', 'bodyEsc', 'outrage']);
/** savestate.ts Checkpoints.gate — why no AUTOSAVE may be written on the civilians' account (null = they are no objection): one who has glimpsed something and is
 *  still deciding, one frightened and not yet done with it (frozen, running, telling a man, on the phone — a checkpoint a stride ahead of the floor going up is a
 *  death loop, exactly as with a man about to see him), one hiding from HIM with nobody told yet (she saw Sam, or his gun, or had his arm round her throat, and
 *  was not told to stay down: the next man by her corner hears all of it), or a word of theirs still on its way (a guard's radio call a beat after her report,
 *  the floor step after that, control's call after she got out of the door). A civilian told to stay down, or lying unfound, is the player's own settled doing —
 *  no objection, as an unfound body is none. */
export function civilianCompromise(g: Game): string | null {
  if (!civiliansOnFloor(g)) return null;
  for (const cv of g.civilians) {
    if (cv.state === 'dead' || cv.held) continue; const C = cv.civ!;
    if (C.state === 'startled') return `${C.name} has glimpsed something`;
    if (C.state === 'alarmed' || C.state === 'flee' || C.state === 'report' || C.state === 'phone') return `${C.name} is ${C.state === 'alarmed' ? 'frightened' : C.state === 'flee' ? `running for ${C.target?.name ?? 'help'}` : C.state === 'report' ? `telling ${C.reportTo?.callsign ?? 'a guard'}` : 'on the phone to security'}`;
    if (C.state === 'cower' && !C.reported && !C.complied && (C.cause === 'sam' || C.cause === 'gun' || C.cause === 'grabbed')) return `${C.name} is hiding from you and nobody knows yet`;
  }
  const P = floorOf(g).pending.find(p => p.kind !== 'greetReply' && p.kind !== 'complyLine');
  if (P) return `${P.cv.callsign}'s ${P.kind === 'outsideCall' ? 'news is about to reach control' : P.kind === 'reportRadio' ? 'report is about to go over the net' : 'word is about to move the floor'}`;
  return null;
}
function makeCivilian(g: Game, def: CivilianDef, i: number): Guard {
  const id = CIV_ID0 + i;
  const route: PatrolRoute = { name: def.name, points: def.points.map(p => v3.copy(p)), wait: [...def.wait], keys: [] };   // her loop in a route's shape (Guard.route / wp / wait run it); nothing on her belt
  const fl = torchLightDef(`civlight${id}`, id, 0, 10, 20); fl.enabled = false; fl.intensity = 0;                            // a light record for the plumbing that reads one (the grab asks was it lit): never in the engine, never lit
  const p0 = route.points[0], p1 = route.points[1 % route.points.length];
  const yaw = def.face?.[0] ?? (route.points.length > 1 ? v3.yawTo(p0, p1) : 0);
  const gd = withDice(hashStr(`civ:${def.name}:${i}`), () => new Guard(g.ch, id, route, -1, fl, v3.copy(def.tint), { tint2: def.tint2 ? v3.copy(def.tint2) : [0.06, 0.06, 0.08], yaw, name: def.name, team: 'civilian' }));
  gd.foe = null; gd.drawn = false; gd.heardUpTo = g.eventSeq;   // (deaf to what was in the air before she existed)
  const worker = def.kind === 'worker';
  gd.civ = {
    def, name: def.name, label: worker ? 'late worker' : 'cleaner', she: worker ? 'he' : 'she', her: worker ? 'him' : 'her',
    state: 'work', stateAt: g.time, taskT: 0, riseT: 0, seated: false, settleT: -1, lookAt: null, lookUntil: -1, shrugAt: -1e9,
    cause: null, causePos: null, causeAt: -1, armed: false, alarmN: 0, seenAt: -1e9, seenPos: null, sawGun: false,
    target: null, retargetAt: -1, badTargets: new Set(), freezeUntil: -1, pinTarget: false,
    reportTo: null, talkT: 0, reported: false, phoned: false, acked: false,
    cowerAt: null, complied: false, complyUntil: -1, refled: false, foundT: 0, foundBy: null, foundLineAt: -1, foundTold: false,
    lead: null, leadGap: 0,
    screamAt: -1e9, whimperAt: -1e9, greetAt: -1e9, lastLineAt: -1e9, told: new SideMap(), knownBodies: new SideSet(), intelN: 0, outsideCallAt: -1, vis: 0,
    dice: hashStr(`civdice:${def.name}`) | 0, rnd: rollOn, log: [],   // (the sequence mulberry32(dice) gives)
  };
  gd.wait = route.wait[0] ?? 0;   // she starts AT her first mark, doing what she does there
  gd.char.update(0);
  return gd;
}
/** A HOSTAGE (game/rescue.ts — the hostage rescue playtest; nobody else calls it): a civilian of the usual make put on the floor at `pos` facing `face`, down and
 *  told to stay down — the complied cower with no end to it, so gunfire, a charge going off beside her and the men coming through the door leave her where she
 *  is (toAlarmed's own rule for a civilian who was told). On Game.civilians like the cleaner, so the rounds, the pose and the body are the civilians' own. */
export function spawnHostage(g: Game, def: { name: string; kind: CivilianDef['kind']; tint: Vec3; tint2?: Vec3; pos: Vec3; face: number }): Guard {
  const gd = makeCivilian(g, { name: def.name, kind: def.kind, tint: def.tint, tint2: def.tint2, points: [v3.copy(def.pos)], wait: [0], face: [def.face] }, g.civilians.length);
  g.civilians.push(gd);
  toCower(g, gd, true); gd.civ!.complyUntil = Infinity; gd.civ!.cause = 'gun'; gd.civ!.armed = true;
  if (WORDS.on) gd.civ!.label = 'hostage';   // (what a row or a message calls her: no cleaner, no late worker — the dialogue pass)
  return gd;
}
/** THE MAN A SNATCH IS FOR (game/snatch.ts — nobody else calls these four): a civilian of the usual make at his own marks, working them like the late worker
 *  until something frightens him; then the civilians' own fright, run and corner are his (civSpots hands him the level's ways out). */
export function spawnTarget(g: Game, def: { name: string; pos: Vec3; face: number; tint: Vec3; tint2?: Vec3; points?: Vec3[]; wait?: number[] }): Guard {
  const pts = def.points?.length ? def.points : [def.pos];
  const gd = makeCivilian(g, { name: def.name, kind: 'worker', tint: def.tint, tint2: def.tint2, points: pts.map(p => v3.copy(p)), wait: pts.map((_, i) => def.wait?.[i] ?? 30), face: pts.map(() => def.face) }, g.civilians.length);
  g.civilians.push(gd);
  gd.civ!.label = 'the man you came for';
  return gd;
}
/** he gives up where he stands, to the man at `to`: the complied cower (hands on his head) with no end to it — gunfire leaves him there (toAlarmed's own rule) */
export function civilianYield(g: Game, gd: Guard, to: Vec3) {
  const C = gd.civ!; if (gd.state === 'dead' || gd.held || C.state === 'gone') return;
  toCower(g, gd, true); C.complyUntil = Infinity; C.cause = 'gun'; C.armed = true; C.causePos = v3.copy(to); C.causeAt = g.time;
  civSay(g, gd, "don't shoot! don't shoot!");
}
/** his hands were up and nobody stayed on him: the promise is off and he is frightened afresh (of `at`), so he runs for a way out again */
export function civilianBolt(g: Game, gd: Guard, at: Vec3) {
  const C = gd.civ!; if (gd.state === 'dead' || gd.held || C.state !== 'cower') return;
  C.complied = false; C.complyUntil = -1; C.refled = false;
  toAlarmed(g, gd, 'gun', v3.copy(at), true);
}
/** does HE make out this man of the team (`mate` null = Sam)? The civilians' own eye this frame (eyeOf: cone, range, the near field) through the guards' eyeContact,
 *  and the guards' sight gain off the light ON that man (Sam: his meter and the smoke between them, as `see` reads him; a teammate: sightGainOn — his meter, his lit
 *  weapon light in this eye) × the civilians' keenK and the air between them, at `bar`. One model: a man stood in the dark is not seen for being in line. */
export function civilianSees(g: Game, gd: Guard, pc: Character, mate: Guard | null, bar: number): boolean {
  const c = gd.char, eye = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]), look = v3.normalize(v3.lerp(c.chestDir, c.headDir(), 0.5)), E = eyeOf(g, gd);
  const vis = eyeContact(g, { pos: eye, look, range: E.range, halfDeg: E.halfDeg, nearM: E.nearM, nearDeg: E.nearDeg }, pc, !mate, false, mate ? 1 : gd.smokeTrans);
  if (!vis.visible) return false;
  const air = mate ? clamp((airTrans(g, eye, pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0])) - 0.3) / 0.5, 0, 1) : 1;   // (Sam's is in gd.smokeTrans already: see())
  return (mate ? sightGainOn(g, gd, mate, vis.dist) : sightGain(g, gd, vis.dist)) * CIV.keenK * air > bar;
}
/** tied where he is (the pose is updateOne's, asked of g.snatch): the promise with no end, whatever state the tie found him in */
export function civilianTie(g: Game, gd: Guard) {
  const C = gd.civ!; if (gd.state === 'dead' || C.state === 'gone') return;
  if (C.state !== 'cower') toCower(g, gd, true);
  C.complied = true; C.complyUntil = Infinity;
}
/** A HOSTAGE'S VOICE (the dialogue pass — words.ts; the words are dialogue.ts HOSTAGE_LINES): rescue.ts names the moment and she says a line of it, off her own
 *  die, never the one over her head now; `other` = the hostage the line is about (a line that names one is left out without). A bubble (and, unseen, a log row for the moments that happen once) and nothing else: no
 *  scream's stamp, no event — nobody's ears are moved by it (the cry under the loud moments is the mixer's alone). False: she is down / held / has no such line. */
export function hostageSay(g: Game, gd: Guard, moment: HostageMoment, other: Guard | null = null): boolean {
  const C = gd.civ; if (!C || gd.state === 'dead' || gd.held || C.state === 'gone') return false;
  const name = other?.civ?.name ?? null, up = gd.bubble?.text;
  const pool = HOSTAGE_LINES[moment].filter(t => name !== null || !t.includes('{other}')).map(t => t.replace(/\{other\}/g, name ?? '')).filter(t => t !== up);
  if (!pool.length) return false;
  civSay(g, gd, pick(gd, pool), 0, moment === 'wait' || moment === 'threat' || moment === 'alone');   // (what she keeps saying all mission is over her head only: unseen, it would fill the log from rooms away)
  if (moment === 'aimed' || moment === 'shot' || moment === 'entry') g.audio.play('heldProtest', gd.char.bones.head ?? v3.add(gd.char.pos, [0, 0.4, 0]), 0.5, { rate: C.def.kind === 'worker' ? 1.15 : 1.5 });   // (the one voice buffer the game has for a cry: scream()'s, lower)
  return true;
}
function forgetMeter(g: Game, gd: Guard) { const id = gd.char.id; g.lightForget(`civC${id}`); g.lightForget(`civH${id}`); }

// ================================================================ gates
/** are the civilians on the floor at all right now: not under the showcase tour / the attract loop's tour flag / a puppet beat, not in the breach's daylight */
export function civiliansOnFloor(g: Game): boolean { return g.civilians.length > 0 && !g.quietUtility && !g.touring && !isDaylight(g); }
/** the ones to draw and collide with this frame (on the floor, not gone out of the building) */
export function civiliansShown(g: Game): Guard[] { return civiliansOnFloor(g) ? g.civilians.filter(cv => cv.civ!.state !== 'gone') : NONE; }
const NONE: Guard[] = [];
/** the living ones a round can find and Sam cannot walk through (shown, up, not the one in his arm) */
export function civilianBodies(g: Game): Guard[] { const held = g.player.holding?.g; return civiliansShown(g).filter(cv => cv.state !== 'dead' && cv.char.alive && cv !== held); }
/** game.ts updateDoors: their door contacts — a standing civilian pushes a leaf like anybody (no key: a locked one stays a wall) */
export function civilianDoorContacts(g: Game, contacts: DoorContact[]) {
  for (const cv of civiliansShown(g)) if (cv.state !== 'dead' && !cv.held) contacts.push({ pos: cv.char.pos, radius: 0.34, bash: false, who: cv.char.id, quiet: cv.civ!.state === 'work' });
}
/** per-Game floor-wide memory: control's evacuation line said; the last greeting anywhere; the words / doings due a beat from now */
const floors = new SideMap<object, { evacTold: boolean; greetAt: number; pending: Pending[] }>('civilians.floors');
function floorOf(g: Game) { let F = floors.get(g); if (!F) { F = { evacTold: false, greetAt: -1e9, pending: [] }; floors.set(g, F); } return F; }
/** A word or a doing due at game time `at` — a guard's answer a beat after her line, his radio call after her report and the floor step after that, control's call
 *  after she got out of the door — as DATA, not a closure, so a checkpoint carries the queue (civiliansSnapshot: `cv` by name, `o` by callsign): whose it is
 *  (cv), the man in it (o), and the few facts the doing needs. Dropped by a reset (resetCivilians empties the queue). */
type PendKind = 'greetReply' | 'reportRadio' | 'escalate' | 'outsideCall' | 'complyLine' | 'foundReport' | 'bodyEsc' | 'outrage';
interface Pending { at: number; kind: PendKind; cv: Guard; o: Guard | null; key?: string; armed?: boolean; pos?: Vec3; lvl?: number; dead?: boolean; }
function later(g: Game, secs: number, P: Omit<Pending, 'at'>) { floorOf(g).pending.push({ at: g.time + secs, ...P }); }
/** the doing itself, when its time comes (updateCivilians) */
function runPending(g: Game, P: Pending) {
  const cv = P.cv, o = P.o, C = cv.civ!;
  switch (P.kind) {
    case 'greetReply': if (o && (chattyEnough(g, o) || (o.state === 'patrol' && o.awareness < 0.15 && !o.held && g.guards.includes(o)))) say(g, o, fill(g, cv, pick(cv, w(CIV_LINES.greet.guard.filter(t => !(/stairs|lift/.test(t) && away(g)) && !(/bins/.test(t) && !C.def.tasks?.includes('bin'))), CIV_LINES.greet.guard)), o)); break;   // (words.ts: the stairs and the lift are the office's, the bins are hers only if she does them)
    case 'reportRadio': {   // his report over the net in his own voice a beat after her telling — and for an armed man / a body the floor a step up on it (deliverReport)
      if (!o || o.state === 'dead' || o.held) break;
      say(g, o, fill(g, cv, CIV_LINES.guardRadio[P.key ?? 'someone'] ?? CIV_LINES.guardRadio.someone, o), true); g.audio.play('radio', o.char.bones.head ?? o.char.pos, 0.7);
      if (P.armed && !g.quietUtility) { const pos = P.pos ?? C.causePos ?? cv.char.pos; g.alarm.pos[0] = pos[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = pos[2]; g.alarm.placed = true; later(g, 1.2, { kind: 'escalate', cv, o }); }
      break; }
    case 'escalate': raiseEscalation(g, 1, o && g.guards.includes(o) ? o : null, 'civilian'); break;   // (o = the man excepted from wording the order: the one who told it / was sent)
    case 'outsideCall': {   // control rings the floor with what she said at the door (toGone)
      if (!g.civilians.includes(cv)) break;
      const pos = C.causePos ?? cv.char.pos; control(g, cv, away(g) ? CIV_LINES.own.control.outside : CIV_LINES.control.outside); const sent = sendToLook(g, pos, 'civilian'); if (C.armed) later(g, 1.4, { kind: 'escalate', cv, o: sent });
      const data = { who: C.name, to: 'control', cause: C.cause ?? 'sam', armed: C.armed, how: 'outside', sent: sent?.callsign ?? '' };
      if (firstHand(C.cause)) chronicleN(g, 'civilianReported', 'civReported', data, pos); else chronicle(g, 'civilianReported', data, pos);
      break; }
    case 'complyLine': if (cv.state !== 'dead' && !cv.held) civSay(g, cv, pick(cv, CIV_LINES.comply.civ)); break;
    case 'foundReport': if (o && cv.state !== 'dead' && !cv.held && staffCalm(g, o) && C.state === 'cower') deliverReport(g, cv, o, 'found'); break;
    case 'bodyEsc': raiseEscalation(g, P.dead || (P.lvl ?? 0) >= 1 || g.alarm.episode ? 2 : 1, o && g.guards.includes(o) ? o : null, 'body'); break;   // (a body is a body: the order's own 'man down' wording; a DEAD civilian locks the floor down whatever it was before)
    case 'outrage': control(g, cv, CIV_LINES.outrage); break;
  }
}

// ================================================================ her voice
/** she says it: a bubble over her head (ui/bubbles.ts draws the civilians' too), and the log under her name when she is off screen — like guards.ts say, in her name */
function civSay(g: Game, gd: Guard, text: string, hold = 0, unheard = false) {
  if (g.snatch?.isMan(gd)) { const own = g.snatch.voice(gd, text); if (own === null) return; text = own; }   // (a snatch's man is not the office's late worker: his own lines by what he is doing, or nothing — game/snatch.ts voice)
  const C = gd.civ!; const t = fill(g, gd, text);
  gd.bubble = { text: t, t: g.time, dur: Math.min(4.5, Math.max(2, 1.5 + t.length * 0.055 + hold)), radio: false };
  C.lastLineAt = g.time;
  if (!unheard && (g.fogOfWar.hidden(gd) || !onScreenHead(g, gd))) g.msg(`${C.name}: ${t}`);   // (fog of war: a hidden man's line is heard, not shown over him)
}
function onScreenHead(g: Game, gd: Guard): boolean {
  const p = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.7, 0]); const vp = g.viewProj; if (!vp) return false;
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]; if (w <= 0) return false;
  const x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
  return x > -0.92 && x < 0.92 && y > -0.9 && y < 0.9;
}
function pick(gd: Guard, pool: string[]): string { const C = gd.civ!; return pool[Math.floor(C.rnd() * pool.length) % pool.length]; }
/** words.ts: this is not the office's floor — the lines that name its fourth floor, its building security, its stairs and lift give way to CIV_LINES.own (false with the
 *  switch off: every line as it was). A pool is swapped or thinned BEFORE the one roll `pick` makes, so her dice run the same either way. */
const away = (g: Game) => WORDS.on && !isOffice(g.level);
/** a pool without its shouts for 'security' where there is no such desk to shout for */
const noSecurity = (g: Game, pool: string[]) => away(g) ? pool.filter(t => !/security/i.test(t)) : pool;
/** {room} {name} {label} {she} {her} {cs} filled off her record (cs = the man in `reportTo` / `foundBy`) */
function fill(g: Game, gd: Guard, text: string, guard?: Guard | null): string {
  const C = gd.civ!; const room = roomName(g.level, C.causePos ?? gd.char.pos); const man = guard ?? C.reportTo ?? C.foundBy;
  const other = g.civilians.filter(o => o !== gd && o.civ).sort((a, b) => b.civ!.screamAt - a.civ!.screamAt)[0]?.civ?.name ?? 'hey';   // ({other}: the civilian who screamed last — the one she is calling out to)
  return text.replace(/\{room\}/g, room).replace(/\{Room\}/g, room[0].toUpperCase() + room.slice(1)).replace(/\{other\}/g, other).replace(/\{name\}/g, C.name).replace(/\{label\}/g, C.label).replace(/\{she\}/g, C.she).replace(/\{her\}/g, C.her).replace(/\{cs\}/g, man?.callsign ?? 'control');
}
/** control's voice on the net (the HUD's radio strip keys on the 'radio: ' prefix — devices.ts / qrf.ts control do the same); the timeline keeps it */
function control(g: Game, gd: Guard, text: string) { const t = fill(g, gd, text); g.msg('radio: CONTROL — ' + t); g.audio.play('radio', null, 0.55); chronicle(g, 'radio', { who: 'CONTROL', text: t }, gd.char.pos); }
/** the SCREAM (or the shout for security): the sound of it, and the stamp the men and the other civilian hear it by */
function scream(g: Game, gd: Guard, shout: string | null) {
  const C = gd.civ!; C.screamAt = g.time;
  const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
  g.audio.play('heldProtest', head, 0.7, { rate: C.def.kind === 'worker' ? 1.15 : 1.5 });   // (the cry the held man's protest is made of, higher and out loud — the one voice buffer the game has for it)
  if (shout) civSay(g, gd, shout);
  hearScream(g, gd);
}

// ================================================================ once a frame (game.ts, after the shift has moved and heard)
export function updateCivilians(g: Game, dt: number) {
  if (!g.civilians.length) return;
  const F = floorOf(g);
  if (!civiliansOnFloor(g)) { F.pending.length = 0; return; }   // the tour / the breach: not on the floor at all (they come back fresh with restartEncounter) — and a word due from a man about them is nobody's now (never a radio line or a floor step onto the tour's floor: review #7)
  for (let i = F.pending.length - 1; i >= 0; i--) if (g.time >= F.pending[i].at) { const P = F.pending.splice(i, 1)[0]; runPending(g, P); }
  evacuationCheck(g);
  for (const cv of g.civilians) updateOne(g, cv, dt);
  guardsNotice(g, dt);
  greetings(g);
}

function setState(g: Game, gd: Guard, s: CivState) { const C = gd.civ!; if (C.state !== s) log(g, gd, `→ ${s}${s === 'flee' && C.target ? ` (${C.target.name})` : ''}${C.cause && (s === 'alarmed') ? ` [${C.cause}${C.armed ? ', armed' : ''}]` : ''}`); C.state = s; C.stateAt = g.time; gd.stallRef = null; }

function updateOne(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char;
  if (C.state === 'gone') return;
  if (gd.state === 'dead') { c.anim.act = null; gd.speed = 0; c.vel = [0, 0, 0]; c.anim.speed = 0; c.update(dt); g.bodyThud(c); return; }   // (update = the ragdoll; free once it sleeps)
  if (gd.held) {   // in Sam's arm: player.ts updateHold has placed, turned and posed her; her state and what she knows stand
    if (C.state !== 'held') { setState(g, gd, 'held'); c.anim.act = null; c.anim.crouchTarget = 0; gd.path = []; gd.pathGoal = null; C.target = null; }
    c.update(dt); stepSound(g, gd, gd.speed);
    return;
  }
  if (C.state === 'held') { released(g, gd); }   // out of the arm on her feet (Sam went down with her, a cancel): she knows exactly who and where
  // ---- perception (her share of the guards' own tests) and the little state machine
  if (g.aiEnabled) { see(g, gd, dt); hear(g, gd); bodies(g, gd); } else gd.awareness = Math.max(0, gd.awareness - dt * 0.5);
  let move = 0, crouch = 0;
  switch (C.state) {
    case 'work': ({ move } = work(g, gd, dt)); break;
    case 'startled': startled(g, gd, dt); break;
    case 'alarmed': alarmed(g, gd, dt); break;
    case 'flee': case 'evacuate': move = flee(g, gd, dt); break;
    case 'report': report(g, gd, dt); break;
    case 'phone': phone(g, gd, dt); break;
    case 'cower': ({ move, crouch } = C.lead ? follow(g, gd, dt) : cower(g, gd, dt)); break;   // (a rescue's hostage on her feet behind the man who came for her: hostageLead)
  }
  if ((C.state as CivState) === 'gone') return;   // (the run just took her out of the door)
  // ---- the figure: pace, crouch, nothing in the hands, no stance; the pose; the sound of her feet (nobody's event — a civilian's step is the building's own noise)
  c.aimYaw = approachAngle(c.aimYaw, c.bodyYaw, 6 * dt); c.aimPitch = damp(c.aimPitch, 0, 4, dt);
  c.anim.speed = move; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.crouchTarget = crouch; c.anim.reverse = false; c.anim.deliberate = 0;
  // (the moves' second pass — character.ts MOVES.bound, arms only: a hostage down with her wrists tied behind her, hands on the head for anybody told to stay down)
  c.anim.bound = C.state === 'cower' && move === 0 && !C.lead ? (g.rescue?.isHostage(gd) || g.snatch?.isTied(gd) ? 1 : C.complied && g.time < C.complyUntil ? 2 : 0) : 0;
  c.update(dt);
  stepSound(g, gd, move);
  // ---- solidity: the statics and the slab; she gives way to the men, to Sam and to the other civilian (they never feel her: the shift's feet are the shift's) —
  //      but for a man seated at his desk, who is where his chair is and stays there
  if (C.seated) return;
  g.col.collideCircle(c.pos, c.radius, 0.2, 1.5); g.col.clampToWorld(c.pos, c.radius);
  const yieldTo = (p: Vec3, r: number) => { const dx = c.pos[0] - p[0], dz = c.pos[2] - p[2]; const l = Math.hypot(dx, dz); if (l < r && l > 1e-4) { c.pos[0] += dx / l * (r - l); c.pos[2] += dz / l * (r - l); } };
  for (const o of g.guards) if (o.state !== 'dead') yieldTo(o.char.pos, 0.6);
  if (!g.player.down) yieldTo(g.player.char.pos, 0.62);
  for (const o of g.civilians) if (o !== gd && o.state !== 'dead' && o.civ!.state !== 'gone') yieldTo(o.char.pos, 0.55);
}   // (Guard.lastPos is followPath's own — where she stood when it last ran: written here it would read every frame as 'no ground covered' and side-step her for ever)
function stepSound(g: Game, gd: Guard, move: number) {
  const c = gd.char; const prev = gd.stepPhase; gd.stepPhase = c.anim.phase;
  if (move > 0.4 && ((prev < 0.5) !== (gd.stepPhase < 0.5))) g.audio.footstep(c.pos, move > 2 ? 0.7 : 0.3, false);   // (presentation only, like the shift's tread — and no material lookup, no meter: nothing of the game reads a civilian's footfall)
}

// ================================================================ perception
/** her eye this frame: head down over a desk / a bin / a screen (a task running at her mark), scanning once frightened, else the walking-about eye */
function eyeOf(g: Game, gd: Guard) {
  const C = gd.civ!;
  if (C.state !== 'work' && C.state !== 'held') return CIV.eyeAlarmed;
  const task = taskAt(gd); return C.state === 'work' && gd.wait > 0 && task !== 'stand' ? CIV.eyeBusy : CIV.eye;
}
/** Sam in her eye: the guards' eyeContact off her head along her chest / head look, reading Sam's own meter through sightGain (× keenK; × gunK for the gun in his hand
 *  or him at somebody's throat inside gunM), the smoke between them marched by the probe under her own key. Awareness fills at that rate and drains when he is out
 *  of it; the state machine reads the two lines. In every frightened state a fresh sight of him still moves where-and-what she will tell (and the gun makes it 'armed'). */
function see(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char, pl = g.player;
  const eye = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]); const look = v3.normalize(v3.lerp(c.chestDir, c.headDir(), 0.5));
  gd.smokeTrans = (g.sensors.segment(`civS${c.id}`, eye, pl.char.bones.chest ?? v3.add(pl.char.pos, [0, 1.1, 0])) ?? 1) * airTrans(g, eye, pl.char.bones.chest ?? v3.add(pl.char.pos, [0, 1.1, 0]));   // (sensors.ts: asked, and read as clear air until the probe answers)
  const E = eyeOf(g, gd);
  const vis = eyeContact(g, { pos: eye, look, range: E.range, halfDeg: E.halfDeg, nearM: E.nearM, nearDeg: E.nearDeg }, pl.char, true, false, gd.smokeTrans);
  const decay = C.state === 'work' ? 0.08 : 0.05;
  if (!vis.visible) { gd.awareness = Math.max(0, gd.awareness - dt * decay); return; }
  const violent = !!pl.gunInHand() || !!pl.takedown || (!!pl.holding && pl.holding.g !== gd) || g.time - pl.lastFireT < 2;
  const gun = violent && vis.dist < CIV.gunM;
  let rate = sightGain(g, gd, vis.dist) * CIV.keenK * (gun ? CIV.gunK : 1);
  if (rate <= 0.05) { gd.awareness = Math.max(0, gd.awareness - dt * decay); return; }
  gd.awareness = clamp(gd.awareness + rate * dt, 0, 1);
  if (rate > 0.25) { C.seenAt = g.time; C.seenPos = v3.copy(pl.char.pos); if (gun) C.sawGun = true;
    if (C.state !== 'work' && C.state !== 'startled' && gd.awareness >= CIV.spotAt) { C.causePos = v3.copy(pl.char.pos); if (gun && !C.armed) { C.armed = true; if (C.cause === 'sam') C.cause = 'gun'; } } }
}
/** The hearing model's share: this frame's events past her marker (the shift's hearingCheck has numbered them), through the same horizons and the same propagation the
 *  men use — gunfire / a stun charge / a door kicked in reach her as they reach the whole floor (fright, placed where the sound came through), the suppressed
 *  pistol's report inside its own short odd-noise reach (guards.ts: 7 m of open air per unit level × the path's carry) is a fright too, a pane going or a slam / a
 *  crash close by startles her, Sam's low whistle near her turns her head. Nothing here writes the event (announced flags are the men's). */
function hear(g: Game, gd: Guard) {
  const C = gd.civ!, c = gd.char;
  for (const e of g.events) {
    if (e.id === undefined) e.id = ++g.eventSeq;   // (nobody of the shift alive to number it: the same rule they use)
    if (e.id <= gd.heardUpTo) continue;
    gd.heardUpTo = Math.max(gd.heardUpTo, e.id);
    if (e.who === c.id) continue;
    const dStraight = v3.dist(e.pos, c.pos);
    const gunfire = (e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1; const kick = e.kind === 'kick', bang = e.kind === 'bang';
    if (e.kind === 'lightOut' || e.kind === 'step') continue;   // (a light dying, a footfall: nothing to a cleaner)
    if (dStraight > (bang || gunfire ? 80 : kick ? 40 : e.kind === 'glass' ? GLASS.hearM : e.kind === 'whistle' ? 10 : 22)) continue;
    const prop = e.kind === 'glass' ? glassHeard(g, e, v3.add(c.pos, [0, 1.5, 0])) : hearPath(g, v3.add(e.pos, [0, 1, 0]), v3.add(c.pos, [0, 1.5, 0]));   // (a pane: from the face of it that reaches her best, as the men hear it)
    const d = prop.pathLen, carry = prop.carry; const heardAt: Vec3 = [prop.via[0], 0, prop.via[2]];
    if (gunfire || bang) { toAlarmed(g, gd, bang ? 'bang' : 'gunfire', heardAt, true); continue; }
    if (kick) { toAlarmed(g, gd, 'noise', heardAt, false); continue; }   // (a door going in off its lock: a crash and somebody IN here — not shooting)
    if (e.kind === 'shot' && !gunfire) { if (d < 7 * carry * Math.max(0.3, (e.level ?? 0.6) / 0.6) + 0.5) toAlarmed(g, gd, 'shot', heardAt, true); continue; }   // (the guards' own reach for the odd quiet report — playtest 08-09: the suppressor buys ambiguity, not silence)
    if (e.kind === 'glass') { const a = (e.level ?? GLASS.hearLevel) * clamp(1 - d / GLASS.hearM, 0.15, 1) * carry; if (a > 0.25) startleOrWorse(g, gd, heardAt); continue; }
    if ((e.kind === 'door' || e.kind === 'prop') && e.loud && d < 8 * carry) { startleOrWorse(g, gd, heardAt); continue; }
    if (e.kind === 'whistle' && prop.direct && d < 8) { if (C.state === 'work') toStartled(g, gd, heardAt, true); continue; }
  }
}
/** a crash / a pane right by her: the first startles, a second inside the startle (or one while she cowers) is somebody IN here */
function startleOrWorse(g: Game, gd: Guard, at: Vec3) {
  const C = gd.civ!;
  if (C.state === 'work') toStartled(g, gd, at, true);
  else if (C.state === 'startled' || (C.state === 'cower' && !C.complied)) toAlarmed(g, gd, 'noise', at, C.armed);
}
/** Bodies in her eye — a man of the shift down (found by them or not: she does not know what they know), the other civilian down: inside bodyM in her cone with a
 *  clear line to the pelvis; each body frightens her once. Every twelfth frame (staggered by id): a body does not move. */
function bodies(g: Game, gd: Guard) {
  const C = gd.civ!, c = gd.char;
  if (C.state === 'flee' || C.state === 'evacuate' || C.state === 'alarmed' || C.state === 'report' || C.state === 'phone') return;
  if ((Math.floor(g.time * 60) + c.id) % 12 !== 0) return;
  const eye = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]); const look = c.chestDir; const E = eyeOf(g, gd);
  const test = (o: Guard) => {
    if (o === gd || o.state !== 'dead' || C.knownBodies.has(o)) return false;
    const bp = o.char.bones.hips ?? o.char.pos; const to = v3.sub(bp, eye); const L = v3.len(to); if (L > CIV.bodyM || L > E.range + 2) return false;
    if (Math.hypot(to[0], to[2]) > 0.5 && v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) < Math.cos(Math.max(E.halfDeg, 45) * DEG)) return false;
    if (g.col.segmentBlocked(eye, v3.add(bp, [0, 0.3, 0]))) return false;
    C.knownBodies.add(o); toAlarmed(g, gd, 'body', bodyPos(o), true); return true;
  };
  for (const o of g.guards) if (test(o)) return;
  for (const o of g.civilians) if (test(o)) return;
}
/** her light meter, for the MEN's eyes on her (a woman running through a torch pool is seen; one running down a dark aisle is heard): the renderer's irradiance at
 *  her chest / head under her own keys when the probe answers, the CPU estimate of the same direct light otherwise (guards.ts lightEstimateAt — headless always),
 *  through the meter's curve, eased like everybody's. Only asked while she is worth looking at (frightened), so a calm floor pays nothing for it. */
function civVisibility(g: Game, gd: Guard, dt: number): number {
  const C = gd.civ!;
  const E = meterOf(g, gd.char, 'civ');
  C.vis = damp(C.vis, g.visibilityOf(E), 6, dt); gd.visibility = C.vis; gd.irradiance = E;
  return C.vis;
}

// ================================================================ WORK: the loop and its tasks
function taskAt(gd: Guard): CivilianTask { return gd.civ!.def.tasks?.[gd.wp] ?? 'stand'; }
/** the sitting clip (Sitting_Idle_Loop) carries the pelvis this far BEHIND the figure's root (measured, tools/qa clip probe): a mark authored on the chair seat is sat on
 *  by easing the root that far forward along the task's facing while the clip holds him */
export const SIT_ADVANCE = 0.33;
/** game.ts updateProps: does this civilian shove the furniture this frame? Not while CALM (at work, or stopped and looking): her loop is authored clear of it, and
 *  a chair corner brushed by a centimetre would set it scraping — a noise event, a draw on the game's dice for its sound, a chair an inch off its spot for a man
 *  to meet later — which is exactly the coupling an unprovoked civilian must not have with the shift's night (probes.ts civilians-identity holds it at zero).
 *  Frightened, running, cowering, held: she is as solid to a chair as anybody, and sends it flying like anybody. */
export function civilianPushesProps(gd: Guard): boolean { const C = gd.civ; if (!C) return true; return C.state !== 'work' && C.state !== 'startled' && C.state !== 'gone'; }
/** game.ts updateProps: a civilian heading for / in his chair is no contact for the furniture (he IS the chair's occupant: it must not skate off ahead of him) */
export function civilianSeated(gd: Guard): boolean { const C = gd.civ; if (!C || C.state !== 'work') return false; if (C.seated) return true; if (taskAt(gd) !== 'sit') return false; const m = gd.route.points[gd.wp % gd.route.points.length]; return v3.distXZ(m, gd.char.pos) < 1.6; }
/** the whole-figure clip a task plays while its wait runs (character.ts `act`), and how long it takes to get up out of it before she may walk */
const TASK_CLIP: Record<CivilianTask, { clip: string; loop?: boolean; rate?: number; in?: number; out?: number; rise?: number } | null> = {
  stand: null,
  wipe: { clip: 'Interact', loop: true, rate: 0.85, in: 0.4, out: 0.4 },          // the reach-and-work of it, over and over along the desk
  bin: { clip: 'Fixing_Kneeling', loop: true, rate: 0.8, in: 0.6, out: 0.7, rise: 0.8 },
  sit: { clip: 'Sitting_Idle_Loop', loop: true, rate: 1, in: 0.7, out: 0.8, rise: 1.0 },
  cooler: { clip: 'Interact', loop: true, rate: 0.6, in: 0.4, out: 0.4 },
  printer: { clip: 'Interact', loop: true, rate: 0.7, in: 0.4, out: 0.4 },
  shelf: { clip: 'PickUp_Table', loop: true, rate: 0.7, in: 0.4, out: 0.5 },
};
function work(g: Game, gd: Guard, dt: number): { move: number } {
  const C = gd.civ!, c = gd.char, R = gd.route; let move = 0;
  if (C.riseT > 0) { C.riseT -= dt; gd.speed = 0; c.vel = [0, 0, 0]; return { move: 0 }; }   // getting up out of the chair / off her knee: feet still while the clip fades
  // the two lines: a glimpse stops her (startled); the plain sight of him is the fright (the machine below never sees work → alarmed without the glimpse first, but a
  // gun in his hand at four metres fills the meter inside a frame or two — she gasps where she stands)
  if (gd.awareness >= CIV.spotAt) { toAlarmed(g, gd, C.sawGun ? 'gun' : 'sam', C.seenPos ?? g.player.char.pos, C.sawGun); return { move: 0 }; }
  if (gd.awareness >= CIV.glimpseAt && g.time - C.shrugAt > CIV.startleAgainSecs) { toStartled(g, gd, C.seenPos ?? g.player.char.pos, false); return { move: 0 }; }
  const target = R.points[gd.wp % R.points.length];
  if (gd.wait > 0) {   // at her mark: the task there while its wait runs, facing its way
    gd.wait -= dt; C.taskT += dt; gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0];
    const task = taskAt(gd); const K = TASK_CLIP[task];
    const face = C.def.face?.[gd.wp]; if (face !== undefined && Number.isFinite(face)) c.bodyYaw = approachAngle(c.bodyYaw, face, 3 * dt);
    const settled = face === undefined || Math.abs(wrapAngle(c.bodyYaw - face)) < 0.35;
    c.anim.act = K && settled ? { clip: K.clip, loop: K.loop, rate: K.rate, in: K.in, out: K.out } : null;   // (turned to it first, then down to it)
    C.seated = task === 'sit' && settled;
    if (C.seated) { const f = face ?? c.bodyYaw; const tx = target[0] + Math.sin(f) * SIT_ADVANCE, tz = target[2] + Math.cos(f) * SIT_ADVANCE; const k = 1 - Math.exp(-5 * dt); c.pos[0] += (tx - c.pos[0]) * k; c.pos[2] += (tz - c.pos[2]) * k; }   // onto the chair: the mark is the seat, the clip carries the pelvis SIT_ADVANCE behind the root
    c.anim.lookYawExtra = task === 'sit' ? Math.sin(gd.lookPhase * 0.4) * 0.12 : task === 'stand' ? Math.sin(gd.lookPhase * 0.9) * 0.4 : 0;
    gd.lookPhase += dt;
    if (gd.wait <= 0) { endTask(gd); gd.wp = (gd.wp + 1) % R.points.length; }
  } else if (C.settleT >= 0) {   // the last hand's breadth: straight onto the mark itself (the path ended on its cell's centre), then the task
    C.settleT += dt; c.anim.act = null;
    const dx = target[0] - c.pos[0], dz = target[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    if (d < 0.04 || C.settleT > 1.5) { C.settleT = -1; gd.speed = 0; c.vel = [0, 0, 0]; gd.wait = R.wait[gd.wp] ?? 0; C.taskT = 0; if (gd.wait <= 0) gd.wp = (gd.wp + 1) % R.points.length; }
    else { const sp = Math.min(0.8, d / 0.4 + 0.15); gd.speed = sp; const st = Math.min(d, sp * dt); c.pos[0] += dx / d * st; c.pos[2] += dz / d * st; c.vel = [dx / d * sp, 0, dz / d * sp]; move = sp; const face = C.def.face?.[gd.wp]; if (face !== undefined) c.bodyYaw = approachAngle(c.bodyYaw, face, 3 * dt); }
  } else {
    c.anim.act = null; c.anim.lookYawExtra = 0;
    goTo(g, gd, target);
    const arrived = followPath(g, gd, dt, CIV.walkSpeed); move = gd.speed;
    if (arrived) { gd.stallRef = null; C.settleT = 0; }
    else if (notGettingAnywhere(gd, dt, 8)) { log(g, gd, `no way to mark ${gd.wp} — skipping it`); gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.wp = (gd.wp + 1) % R.points.length; }   // (a leaf held against her, a chair wedged in the aisle: the next mark)
  }
  return { move };
}
/** leaving a mark: the clip comes off (its own fade) and a seated / kneeling woman takes a moment to be on her feet */
function endTask(gd: Guard) { const C = gd.civ!; const K = TASK_CLIP[taskAt(gd)]; gd.char.anim.act = null; C.riseT = C.seated || gd.char.anim.actShown > 0.5 ? K?.rise ?? 0 : 0; C.taskT = 0; C.settleT = -1; if (C.seated) { const f = C.def.face?.[gd.wp] ?? gd.char.bodyYaw; gd.char.pos[0] -= Math.sin(f) * SIT_ADVANCE; gd.char.pos[2] -= Math.cos(f) * SIT_ADVANCE; gd.char.update(0); } C.seated = false; }   // (out of the chair: back onto the mark he stood up from — the seat is a prop his feet cannot stand in)
/** back to the loop from wherever she is: the mark nearest by path is the next, walked to */
function toWork(g: Game, gd: Guard, line: boolean) {
  const C = gd.civ!, c = gd.char, R = gd.route;
  let best = 0, bd = Infinity; R.points.forEach((p, i) => { const d = v3.distXZ(p, c.pos); if (d < bd) { bd = d; best = i; } });
  gd.wp = best; gd.wait = 0; gd.path = []; gd.pathGoal = null; c.anim.act = null; C.lookAt = null; C.target = null; C.reportTo = null; C.settleT = -1; C.riseT = 0; C.seated = false;   // (a fright inside the settle step must not leave her 'settling' onto a mark rooms away — review #2)
  gd.awareness = Math.min(gd.awareness, 0.1);
  if (line) civSay(g, gd, pick(gd, CIV_LINES.settle));
  setState(g, gd, 'work');
}

// ================================================================ STARTLED: she stops and looks
function toStartled(g: Game, gd: Guard, at: Vec3, sound: boolean) {
  const C = gd.civ!, c = gd.char;
  if (C.state !== 'work') return;
  endTask(gd); C.riseT = 0; c.anim.act = null; gd.path = []; gd.pathGoal = null;
  C.lookAt = v3.copy(at); C.lookUntil = g.time + CIV.startleSecs; CIV_STATS.startled++;
  civSay(g, gd, pick(gd, noSecurity(g, CIV_LINES.glimpse)));
  log(g, gd, `startled by ${sound ? 'a noise' : 'a glimpse'} at (${at[0].toFixed(1)}, ${at[2].toFixed(1)})`);
  setState(g, gd, 'startled');
}
function startled(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char;
  gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; c.anim.act = null;
  const at = C.seenAt > C.stateAt ? C.seenPos! : C.lookAt;   // her eyes go to him if she has him at all, else to where the noise came from
  if (at) { const yawTo = Math.atan2(at[0] - c.pos[0], at[2] - c.pos[2]); c.bodyYaw = approachAngle(c.bodyYaw, yawTo, 2.5 * dt); c.anim.lookYawExtra = clamp(wrapAngle(yawTo - c.bodyYaw), -0.9, 0.9); }
  if (gd.awareness >= CIV.spotAt) { toAlarmed(g, gd, C.sawGun ? 'gun' : 'sam', C.seenPos ?? at ?? c.pos, C.sawGun); return; }
  if (g.time >= C.lookUntil && gd.awareness < CIV.glimpseAt * 0.5) { C.shrugAt = g.time; civSay(g, gd, pick(gd, CIV_LINES.shrug)); log(g, gd, 'talked herself out of it'); C.lookAt = null; setState(g, gd, 'work'); gd.wait = Math.max(gd.wait, 0); }
  else if (g.time >= C.lookUntil + 6) { C.shrugAt = g.time; C.lookAt = null; setState(g, gd, 'work'); }   // (a meter that will neither fill nor drain — he stands half-seen at the edge of her lamp: she gives it up uneasily, no line)
}

// ================================================================ ALARMED: the frozen beat, then the run
/** The fright. From any calm-ish state (work, startled, cower for a fresh cause, report / phone interrupted by worse): what and where become what she will tell; an
 *  'armed' cause upgrades a plain one; the men will each be told of THIS fright once (alarmN). She freezes for her beat with a gasp — a scream the floor can hear —
 *  then picks whom to run to. Already running: the cause is folded in (where / armed) and she keeps running. */
export function toAlarmed(g: Game, gd: Guard, cause: CivCause, at: Vec3, armed: boolean) {
  const C = gd.civ!, c = gd.char;
  if (gd.state === 'dead' || gd.held || C.state === 'gone' || C.state === 'evacuate') return;
  const fresh = C.state === 'work' || C.state === 'startled' || C.state === 'cower' || (C.state === 'report' && armed && !C.armed) || (C.state === 'phone' && armed && !C.armed && cause !== 'scream');
  // fold the news in whatever she is doing
  const rank = (k: CivCause | null) => k === null ? -1 : ({ noise: 0, scream: 1, panel: 1, shot: 2, sam: 2, bang: 3, gunfire: 3, body: 4, gun: 5, grabbed: 6 } as Record<CivCause, number>)[k];
  if (rank(cause) >= rank(C.cause) || !C.causePos) { C.cause = cause; C.causePos = v3.copy(at); }
  C.armed = C.armed || armed; C.causeAt = g.time;
  if (!fresh) return;
  if (C.state === 'cower' && C.complied && g.time < C.complyUntil && cause !== 'grabbed') return;   // told to stay down: she stays down (a fresh horror is folded into what she will say if anyone ever asks)
  if (C.state === 'cower' && (C.refled || cause === 'noise' || cause === 'scream')) return;         // a corner is left once, and only for the man himself / a shot / a body — not for another crash
  const wasCower = C.state === 'cower';
  endTask(gd); C.riseT = 0; c.anim.act = null; gd.path = []; gd.pathGoal = null; C.lookAt = null;
  C.alarmN++; C.reported = false; C.acked = false; C.phoned = false; C.reportTo = null; C.badTargets.clear(); C.target = null; C.foundT = 0; C.pinTarget = false;   // (phoned: one call per FRIGHT, not per night — review #5)
  if (wasCower) { C.refled = true; CIV_STATS.refled++; } else C.refled = false;   // (a corner is left once per fright; a fresh fright from her work starts clean — review #8)
  const [f0, f1] = CIV.freeze; C.freezeUntil = g.time + (wasCower ? 0.25 : f0 + C.rnd() * (f1 - f0));
  CIV_STATS.alarmed++;
  if (cause === 'sam' || cause === 'gun' || cause === 'grabbed') { CIV_STATS.samSeen++; chronicleN(g, 'civilianSpotted', 'civSeen', { who: C.name, cause, armed: C.armed }, c.pos); }   // the debrief's row and count: SHE saw him (a body / a shot she only heard is not a sighting of Sam) — the count with the run live whether or not the capped timeline takes the row (review U9.2)
  gd.awareness = Math.max(gd.awareness, cause === 'sam' || cause === 'gun' || cause === 'grabbed' ? 1 : 0.5);
  setState(g, gd, 'alarmed');   // (before the scream: what the other civilian hears of it finds her already frightened, not one to frighten again)
  scream(g, gd, pick(gd, CIV_LINES.gasp[cause] ?? CIV_LINES.gasp.sam));
}
function alarmed(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char;
  gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0]; c.anim.act = null;
  const at = C.causePos; if (at) { const yawTo = Math.atan2(at[0] - c.pos[0], at[2] - c.pos[2]); c.bodyYaw = approachAngle(c.bodyYaw, yawTo, 5 * dt); }   // rooted, staring at it
  c.anim.lookYawExtra = 0;
  if (g.time < C.freezeUntil) return;
  const T = pickTarget(g, gd);
  if (!T) { log(g, gd, 'nowhere to run: cowering here'); toCower(g, gd, false); return; }
  toFlee(g, gd, T, false);
}
/** her hands come off Sam's arm on her feet (he went down holding her, or the hold was cancelled): the fright of her life, from where he stands */
function released(g: Game, gd: Guard) {
  const C = gd.civ!;
  gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  if (C.complied) { toCower(g, gd, true); return; }   // (comply lets her go through here too when the row ran this frame: straight down where she stands)
  C.state = 'work';   // (so toAlarmed takes it as fresh)
  toAlarmed(g, gd, 'grabbed', v3.copy(g.player.char.pos), true);
}

// ================================================================ FLEE: whom to, and the run
function pathMetres(g: Game, from: Vec3, to: Vec3): { m: number; path: Vec3[] | null } {
  const p = g.col.nav.findPath(from, to, 6000); if (!p || !p.length) return { m: Infinity, path: null };
  let s = 0, prev = from; for (const q of p) { s += Math.hypot(q[0] - prev[0], q[2] - prev[2]); prev = q; } return { m: s, path: p };
}
/** may this man be run to and told: a living STAFF man (the shift or a staff-side unit) on his feet, not in Sam's arm, not fighting (an alert man has no ear for her),
 *  not somebody's script this frame */
function tellable(g: Game, o: Guard): boolean { return o.state !== 'dead' && o.team === 'guard' && !o.held && !o.script && o.state !== 'alert' && g.guards.includes(o); }
/** Whom / what she runs to: every tellable man, every phone (unless she has rung this fright in already), every way out — the nearest by PATH from where she stands,
 *  a man counting guardBonusM nearer than he is (a person beats a handset), a door exitMalusM further (leaving is the last resort), and anything the far side of what
 *  frightened her pastThreatM further (she will not run past him to reach it); targets that came to nothing this fright are out. null = nowhere. */
function pickTarget(g: Game, gd: Guard, opts: { exitsOnly?: boolean } = {}): CivTarget | null {
  const C = gd.civ!, from = gd.char.pos, threat = C.causePos;
  const cands: { T: CivTarget; cost: number }[] = [];
  const consider = (T: CivTarget, adj: number) => {
    if (C.badTargets.has(T.guard ?? T.spot!)) return;
    const { m } = pathMetres(g, from, T.pos); if (!Number.isFinite(m)) return;
    let cost = m + adj;
    if (threat && v3.distXZ(threat, T.pos) < v3.distXZ(threat, from) - 1 && v3.distXZ(from, T.pos) > 3) cost += CIV.pastThreatM;   // (nearer the fright than she is: past him)
    cands.push({ T, cost });
  };
  if (!opts.exitsOnly) {
    for (const o of g.guards) if (tellable(g, o)) consider({ kind: 'guard', guard: o, spot: null, pos: v3.copy(o.char.pos), name: o.callsign, planPos: v3.copy(o.char.pos) }, -CIV.guardBonusM);
    if (!C.phoned) for (const s of civSpots(g).phones) consider({ kind: 'phone', guard: null, spot: s, pos: v3.copy(s.pos), name: s.name, planPos: v3.copy(s.pos) }, 0);
  }
  for (const s of civSpots(g).exits) consider({ kind: 'exit', guard: null, spot: s, pos: v3.copy(s.pos), name: s.name, planPos: v3.copy(s.pos) }, opts.exitsOnly ? 0 : CIV.exitMalusM);
  cands.sort((a, b) => a.cost - b.cost);
  return cands[0]?.T ?? null;
}
function toFlee(g: Game, gd: Guard, T: CivTarget, evac: boolean) {
  const C = gd.civ!;
  C.target = T; C.retargetAt = g.time + 1.0; gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.char.anim.act = null; gd.char.anim.crouchTarget = 0;
  goTo(g, gd, T.pos, true);
  const again = C.state === 'flee' || C.state === 'evacuate';   // (re-chosen mid-run: no second shout, no second count)
  setState(g, gd, evac ? 'evacuate' : 'flee');   // (before the shout: what comes back of it through the other civilian's scream finds her already running)
  if (!again) { if (!evac) { CIV_STATS.fled++; scream(g, gd, pick(gd, noSecurity(g, CIV_LINES.flee))); } else civSay(g, gd, pick(gd, CIV_LINES.evac)); }
}
function flee(g: Game, gd: Guard, dt: number): number {
  const C = gd.civ!, c = gd.char, evac = C.state === 'evacuate'; let T = C.target;
  c.anim.act = null; c.anim.lookYawExtra = 0;
  if (!T) { const nt = pickTarget(g, gd, { exitsOnly: evac }); if (!nt) { toCower(g, gd, false); return 0; } toFlee(g, gd, nt, evac); T = nt; }
  // keep the target honest: a man walks (re-plan when he has moved), stops being one to tell (fighting, grabbed, down: somebody else), or a nearer one shows
  if (T.kind === 'guard') {
    const o = T.guard!;
    if (!tellable(g, o)) { C.badTargets.add(o); C.target = null; log(g, gd, `${o.callsign} is no longer one to run to`); return gd.speed; }
    if (v3.distXZ(o.char.pos, T.planPos) > 1.5) { T.pos = v3.copy(o.char.pos); T.planPos = v3.copy(o.char.pos); goTo(g, gd, T.pos, true); }
    // there: in reach of him and in sight of him
    const d = v3.distXZ(c.pos, o.char.pos);
    if (d < CIV.reportM && !g.col.solidBlocked(v3.add(c.pos, [0, 1.3, 0]), v3.add(o.char.pos, [0, 1.3, 0]))) { toReport(g, gd, o); return 0; }
  }
  if (g.time >= C.retargetAt && !evac && !C.pinTarget) {   // once a second: is somebody nearer now (a man came running at her scream)? — not for one SENT somewhere
    C.retargetAt = g.time + 1.0;
    const nt = pickTarget(g, gd);
    if (nt && (nt.guard ?? nt.spot) !== (T.guard ?? T.spot) && (nt.kind === 'guard' || T.kind !== 'guard')) {
      const cur = pathMetres(g, c.pos, T.pos).m + (T.kind === 'guard' ? -CIV.guardBonusM : T.kind === 'exit' ? CIV.exitMalusM : 0);
      const alt = pathMetres(g, c.pos, nt.pos).m + (nt.kind === 'guard' ? -CIV.guardBonusM : nt.kind === 'exit' ? CIV.exitMalusM : 0);
      if (alt < cur - 3) { log(g, gd, `${nt.name} is nearer now`); C.target = nt; T = nt; goTo(g, gd, T.pos, true); }
    }
  }
  goTo(g, gd, T.pos);
  const arrived = followPath(g, gd, dt, CIV.runSpeed);
  if (arrived) {
    gd.stallRef = null;
    if (v3.distXZ(c.pos, T.pos) > 1.6) { C.badTargets.add(T.guard ?? T.spot!); C.target = null; log(g, gd, `no way to ${T.name}`); return 0; }   // (an empty plan reads as arrived: she is not there)
    if (T.kind === 'phone') { toPhone(g, gd, T.spot!); return 0; }
    if (T.kind === 'exit') { toGone(g, gd, evac); return 0; }
  } else if (notGettingAnywhere(gd, dt, 2.5)) { C.badTargets.add(T.guard ?? T.spot!); C.target = null; log(g, gd, `stuck on the way to ${T.name}`); }
  return gd.speed;
}

// ================================================================ REPORT: telling the man
/** a report that costs Sam on the card: what she tells is first-hand of HIM or his doing (seen, the gun, the arm, a body, his shooting) — not a scream or a crash relayed */
function firstHand(cause: CivCause | null): boolean { return cause === 'sam' || cause === 'gun' || cause === 'grabbed' || cause === 'body' || cause === 'gunfire' || cause === 'shot'; }
function toReport(g: Game, gd: Guard, o: Guard) {
  const C = gd.civ!, c = gd.char;
  C.reportTo = o; C.talkT = 0; C.acked = false; gd.path = []; gd.pathGoal = null; C.target = null;
  civSay(g, gd, pick(gd, CIV_LINES.report[C.cause ?? 'sam'] ?? CIV_LINES.report.sam), 0.8);
  // the man: he stops and takes it in, turned to where she points, the gun coming out (the suspicious branch's own beat: reactT holds his feet, lastKnown his eyes)
  primeGuard(g, o, C.causePos ?? c.pos, 0.5);   // (a short root, refreshed each frame she talks — report() — so a man who goes ALERT mid-report is on his own clock within half a second: review #3)
  c.anim.act = { clip: 'Idle_Talking_Loop', loop: true, rate: 1.2, in: 0.3, out: 0.4 };
  setState(g, gd, 'report');
}
/** a man about to be told / rung about a spot: off whatever calm thing he was on, suspicious toward it, rooted for `beat` seconds (no 'huh?': she is the huh) */
function primeGuard(g: Game, o: Guard, pos: Vec3, beat: number) {
  if (o.state === 'dead' || o.held || o.state === 'alert') return;
  o.awareness = Math.max(o.awareness, 0.5); o.lastKnown = v3.copy(pos);
  if (o.state === 'patrol') { o.state = 'suspicious'; o.searchT = 0; o.bodyDuty = null; }
  o.reactT = Math.max(o.reactT, beat); o.path = []; o.pathGoal = null; o.stallRef = null;
}
function report(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char, o = C.reportTo;
  gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
  if (!o || !tellable(g, o) || v3.distXZ(o.char.pos, c.pos) > 6) { c.anim.act = null; C.reportTo = null; if (o) C.badTargets.add(o); const T = C.reported ? null : pickTarget(g, gd); if (T) toFlee(g, gd, T, false); else toCower(g, gd, false); return; }   // (told already, and he ran off on it: nothing more to run for — the corner; review #9)   // he went down / grabbed / ran off to a shot mid-sentence: somebody else
  const yawTo = Math.atan2(o.char.pos[0] - c.pos[0], o.char.pos[2] - c.pos[2]); c.bodyYaw = approachAngle(c.bodyYaw, yawTo, 5 * dt);   // (he turns to where she points on his own: primeGuard put his fix there)
  if (o.state !== 'alert') o.reactT = Math.max(o.reactT, 0.5);   // (his feet held while she talks, half a second at a time)
  C.talkT += dt;
  if (C.talkT >= CIV.reportSecs && !C.acked) { C.acked = true; deliverReport(g, gd, o, 'told'); }
  if (C.talkT >= CIV.reportSecs + 1.4) { c.anim.act = null; toCower(g, gd, false); }
}
/** What telling a man DOES (to his ears it is a fix, and it is real): 'somebody' seen → he walks it (suspicious toward the spot, weapon out as suspicion has it, his word
 *  to her); an ARMED man / a body / gunfire / the arm → he searches the spot weapon out (the search branch: sweep, the hide spots round it), his word to her, the report
 *  over the net in his own voice — the HUD's radio strip — and the floor a step up on it (raiseEscalation 'civilian': somebody else words the order). Once per fright.
 *  `how`: told to his face at the end of her run / found cowering and asked. The debrief's row + count. */
function deliverReport(g: Game, gd: Guard, o: Guard, how: 'told' | 'found') {
  const C = gd.civ!; if (C.reported) return;
  C.reported = true; C.reportTo = o; CIV_STATS.reports++;
  const pos = C.causePos ?? gd.char.pos; const armed = C.armed || C.cause === 'body';
  o.awareness = Math.max(o.awareness, armed ? 0.8 : 0.55); o.lastKnown = v3.copy(pos); o.bodyDuty = null; o.task = null; o.path = []; o.pathGoal = null; o.stallRef = null;
  if (armed) { o.state = 'search'; o.searchT = 0; o.searchPlan = null; o.reactT = 0.6; }
  else { if (o.state === 'patrol' || o.state === 'suspicious') { o.state = 'suspicious'; o.searchT = 0; } o.reactT = 0.9; }
  o.trackFix(g.time);
  say(g, o, fill(g, gd, pick(gd, armed ? CIV_LINES.guardAck.armed : w(CIV_LINES.guardAck.someone.map(t => /behind the desk/.test(t) ? CIV_LINES.now.guardAck : t), CIV_LINES.guardAck.someone)), o));
  const radioKey = C.cause === 'grabbed' ? 'grabbed' : C.cause === 'body' ? 'body' : (C.cause === 'gunfire' || C.cause === 'bang') ? 'gunfire' : armed ? 'armed' : 'someone';
  later(g, 1.6, { kind: 'reportRadio', cv: gd, o, key: radioKey, armed, pos: v3.copy(pos) });   // his radio a beat later, then the floor step (runPending)
  const data = { who: C.name, to: o.callsign, cause: C.cause ?? 'sam', armed, how };
  if (firstHand(C.cause)) chronicleN(g, 'civilianReported', 'civReported', data, gd.char.pos); else chronicle(g, 'civilianReported', data, gd.char.pos);   // (a relayed scream / a crash costs him nothing on the card: the men learn only that somebody screamed)
  log(g, gd, `told ${o.callsign} (${how}): ${C.cause}${armed ? ', armed' : ''} at (${pos[0].toFixed(1)}, ${pos[2].toFixed(1)}) → he ${armed ? 'searches it' : 'walks it'}`);
}

// ================================================================ PHONE: ringing it in
function toPhone(g: Game, gd: Guard, s: CivSpot) {
  const C = gd.civ!, c = gd.char;
  C.talkT = 0; C.target = null; gd.path = []; gd.pathGoal = null;
  civSay(g, gd, pick(gd, away(g) ? [C.armed ? CIV_LINES.own.phoneArmed : CIV_LINES.own.phone] : C.armed ? CIV_LINES.phoneArmed.slice(0, 1) : CIV_LINES.phone.slice(0, 1)), 1);
  c.anim.act = { clip: 'Idle_Talking_Loop', loop: true, rate: 1.3, in: 0.3, out: 0.4 };
  g.audio.play('click', v3.add(c.pos, [0, 1.2, 0]), 0.5, { rate: 0.8 });   // the handset off the hook
  log(g, gd, `on ${s.name}`);
  setState(g, gd, 'phone');
}
function phone(g: Game, gd: Guard, dt: number) {
  const C = gd.civ!, c = gd.char; const s = civSpots(g).phones.find(p => v3.distXZ(p.pos, c.pos) < 2) ?? null;
  gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
  if (s) c.bodyYaw = approachAngle(c.bodyYaw, s.face, 4 * dt);
  const before = C.talkT; C.talkT += dt;
  if (before < 3 && C.talkT >= 3) civSay(g, gd, pick(gd, C.armed ? CIV_LINES.phoneArmed.slice(1) : CIV_LINES.phone.slice(1)), 1);
  if (before < CIV.phoneSecs && C.talkT >= CIV.phoneSecs) phoneCall(g, gd);
  if (C.talkT >= CIV.phoneSecs + 1.5) { c.anim.act = null; toCower(g, gd, false); }
}
/** The call lands: control puts it out to all callsigns (the radio strip), the nearest calm man is sent to the spot exactly as a camera's word sends one (devices.ts
 *  sendToLook: an errand that survives the suspicion decay, 'copy, control — on my way'), and for an armed man / a body the floor goes up a step. Once per fright. */
function phoneCall(g: Game, gd: Guard) {
  const C = gd.civ!; if (C.phoned) return;
  C.phoned = true; C.reported = true; CIV_STATS.phoned++;
  const pos = C.causePos ?? gd.char.pos; const armed = C.armed || C.cause === 'body';
  { const k = C.cause === 'body' ? 'body' : armed ? 'armed' : 'someone'; control(g, gd, (away(g) ? CIV_LINES.own.control[k] : undefined) ?? CIV_LINES.control[k]); }
  const sent = g.quietUtility ? null : sendToLook(g, pos, 'civilian');
  if (armed && !g.quietUtility) { g.alarm.pos[0] = pos[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = pos[2]; g.alarm.placed = true; later(g, 1.4, { kind: 'escalate', cv: gd, o: sent }); }
  const data = { who: C.name, to: 'control', cause: C.cause ?? 'sam', armed, how: 'phone', sent: sent?.callsign ?? '' };
  if (firstHand(C.cause)) chronicleN(g, 'civilianReported', 'civReported', data, gd.char.pos); else chronicle(g, 'civilianReported', data, gd.char.pos);
  log(g, gd, `rang it in: ${C.cause}${armed ? ', armed' : ''} at (${pos[0].toFixed(1)}, ${pos[2].toFixed(1)})${sent ? ` — ${sent.callsign} sent` : ' — nobody free to send'}`);
}
/** out of the building (a way out reached): gone off the floor; unless it was the response team's evacuation, control rings the floor a little later with what she said */
function toGone(g: Game, gd: Guard, evac: boolean) {
  const C = gd.civ!;
  gd.char.anim.act = null; gd.path = []; gd.pathGoal = null; C.target = null;
  if (evac) { CIV_STATS.evacuated++; log(g, gd, 'off the floor (evacuated)'); }
  else if (g.snatch?.isMan(gd)) log(g, gd, 'off the floor — gone');   // (a snatch's man tells nobody: game/snatch.ts fails the mission on it)
  else if (!C.reported) { C.reported = true; CIV_STATS.outsideCalls++; log(g, gd, 'out of the building — control will ring the floor'); later(g, CIV.outsideCallSecs, { kind: 'outsideCall', cv: gd, o: null }); }   // (runPending: control's line, the nearest calm man sent, the floor step for an armed man, the debrief's row)
  forgetMeter(g, gd);
  setState(g, gd, 'gone');
}

// ================================================================ COWER: the corner
/** the corner: the free nav cell within cornerM of her with the most wall about it (blocked orthogonal neighbours), reachable in a walkable line, away from the fright
 *  for choice; her own cell if nothing better */
function cornerSpot(g: Game, gd: Guard): Vec3 {
  const C = gd.civ!, nav = g.col.nav, cs = nav.cell, from = gd.char.pos, threat = C.causePos;
  const R = Math.ceil(CIV.cornerM / cs); const cx = Math.floor(from[0] / cs), cz = Math.floor(from[2] / cs);
  let best: Vec3 = v3.copy(from), bs = -Infinity;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, z = cz + dz; if (x < 1 || z < 1 || x >= nav.W - 1 || z >= nav.H - 1 || nav.blocked[nav.idx(x, z)]) continue;
    const q: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs]; const d = v3.distXZ(from, q); if (d > CIV.cornerM) continue;
    const walls = nav.blocked[nav.idx(x + 1, z)] + nav.blocked[nav.idx(x - 1, z)] + nav.blocked[nav.idx(x, z + 1)] + nav.blocked[nav.idx(x, z - 1)];
    if (!walls) continue;
    let s = walls * 3 - d * 0.6; if (threat) s += Math.min(6, v3.distXZ(threat, q)) * 0.5;
    if (s <= bs) continue;
    if (!nav.walkable(from, q)) continue;
    bs = s; best = q;
  }
  return best;
}
function toCower(g: Game, gd: Guard, complied: boolean) {
  const C = gd.civ!, c = gd.char;
  C.complied = complied; if (complied) C.complyUntil = g.time + CIV.complyMin * 60;
  C.cowerAt = complied ? v3.copy(c.pos) : cornerSpot(g, gd); C.foundT = 0; C.foundBy = null; C.foundLineAt = -1; C.foundTold = false; C.whimperAt = g.time + 2 + C.rnd() * 4;
  gd.path = []; gd.pathGoal = null; c.anim.act = null; C.target = null;
  CIV_STATS.cowered++; if (complied) CIV_STATS.complied++;
  setState(g, gd, 'cower');
}
/** A RESCUE'S HOSTAGE ON HER FEET (rescueend.ts — nobody else calls this): she follows `lead` on the civilians' own legs, stopping `gap` behind him, or
 *  (null) goes down again where she stands. Her state stays the told cower it was (nothing frightens her off it, nobody grabs her, she reports to nobody):
 *  the one branch in updateOne walks her instead of keeping her in the corner. */
export function hostageLead(g: Game, gd: Guard, lead: Character | null, gap: number) {
  const C = gd.civ; if (!C || gd.state === 'dead' || C.state !== 'cower') return;
  C.lead = lead; C.leadGap = gap; gd.path = []; gd.pathGoal = null; gd.stallRef = null;
  if (!lead) C.cowerAt = v3.copy(gd.char.pos);   // (down where she stands: cower() scuttles nobody back to the room)
}
/** the walk behind him: the nav grid's way to where he stands, re-planned as he moves (goTo's own 0.75 m), a run once she has fallen behind, a stop inside her gap */
function follow(g: Game, gd: Guard, dt: number): { move: number; crouch: number } {
  const C = gd.civ!, c = gd.char, L = C.lead!; let move = 0;
  const d = v3.distXZ(L.pos, c.pos), going = gd.path.length > 0;
  c.anim.act = null; c.anim.lookYawExtra = 0;
  if (d > C.leadGap + (going ? 0 : 0.6)) {   // (0.6 m of slack before she starts again: no shuffle at his heels)
    if (gd.path.length || Math.floor(g.time * 2) !== Math.floor((g.time - dt) * 2)) goTo(g, gd, L.pos);   // (with no way to him the search is asked again twice a second, not every frame)
    followPath(g, gd, dt, d > C.leadGap + 2.2 ? CIV.runSpeed : Math.max(CIV.walkSpeed, Math.min(CIV.runSpeed, 1.4 + (d - C.leadGap))));
    move = gd.speed;
  } else {
    gd.path = []; gd.pathGoal = null; gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
    c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(L.pos[0] - c.pos[0], L.pos[2] - c.pos[2]), 3 * dt);
  }
  return { move, crouch: 0 };
}
function cower(g: Game, gd: Guard, dt: number): { move: number; crouch: number } {
  const C = gd.civ!, c = gd.char, pl = g.player; let move = 0;
  const spot = C.cowerAt ?? c.pos; const d = v3.distXZ(spot, c.pos);
  if (d > 0.5 && g.time - C.stateAt < 6) { goTo(g, gd, spot); followPath(g, gd, dt, CIV.creepSpeed); move = gd.speed; }   // the crouched scuttle into the corner
  else {
    gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
    const away = C.causePos ? Math.atan2(c.pos[0] - C.causePos[0], c.pos[2] - C.causePos[2]) : c.bodyYaw;   // face away from it, into the wall
    c.bodyYaw = approachAngle(c.bodyYaw, away, 2 * dt);
    c.anim.lookYawExtra = Math.sin(g.time * 1.7 + c.id) * 0.5;   // looking over her shoulders
  }
  if (!(WORDS.on && g.rescue?.isHostage(gd)) && g.time >= C.whimperAt && g.time - C.stateAt < 70) { C.whimperAt = g.time + 7 + C.rnd() * 7; if (!(gd.bubble && g.time - gd.bubble.t < gd.bubble.dur)) civSay(g, gd, pick(gd, CIV_LINES.cower)); }   // (not a hostage: her voice is rescue.ts's to time and her own in words — hostageSay — never the corner's "I didn't see anything —")
  const complying = C.complied && g.time < C.complyUntil;
  // up and off again: the man with the gun coming at her, seen (not one told to stay down; once)
  if (!complying && !C.refled && C.sawGun && g.time - C.seenAt < 0.3 && v3.distXZ(pl.char.pos, c.pos) < CIV.refleeM && g.time - C.stateAt > 2) { toAlarmed(g, gd, 'gun', v3.copy(pl.char.pos), true); return { move: 0, crouch: 1 }; }
  // nobody came, nobody told: she goes looking for a guard again (a corner is not a plan)
  if (!complying && !C.reported && g.time - C.stateAt > CIV.loneSecs && g.time - C.retargetAt > CIV.loneSecs) { C.badTargets.clear(); C.retargetAt = g.time; const T = pickTarget(g, gd); if (T) { log(g, gd, 'nobody came — going to find someone'); toFlee(g, gd, T, false); return { move: 0, crouch: 1 }; } }   // (the men who came to nothing last time may be free now — review #8; tried once a loneSecs, not every frame)
  // it is in the men's hands and the floor has gone quiet again: back to work, shakily (a told woman waits out her promise first)
  if (!complying && C.reported && g.time - C.stateAt > CIV.settleSecs && escalationOf(g) === 0 && !g.alarm.episode && gd.awareness < 0.1) { toWork(g, gd, true); return { move: 0, crouch: 0 }; }
  if (C.complied && g.time >= C.complyUntil && g.time - C.stateAt > CIV.settleSecs && escalationOf(g) === 0 && !g.alarm.episode && gd.awareness < 0.1) { if (!C.reported) { const T = pickTarget(g, gd); if (T) { toFlee(g, gd, T, false); return { move: 0, crouch: 1 }; } } toWork(g, gd, true); return { move: 0, crouch: 0 }; }
  return { move, crouch: 1 };
}

// ================================================================ HELD: the arm (player.ts has the hold; these are her rows' doings)
/** player.ts startGrab, the frame the arm goes round her: whatever she was doing stops (the fright itself waits until she is out of it — she cannot scream) */
export function civilianGrabbed(g: Game, gd: Guard) {
  const C = gd.civ!; endTask(gd); C.riseT = 0; gd.char.anim.act = null; gd.char.anim.crouchTarget = 0; C.target = null; C.reportTo = null; C.lookAt = null;
  C.cause = 'grabbed'; C.causePos = v3.copy(g.player.char.pos); C.armed = true; C.causeAt = g.time; C.complied = false;
  log(g, gd, 'grabbed');
}
/** Her answers in the arm (Game.interrogate for a civilian): the first press gets fear; then the thing or two she actually knows, in order (the cleaner: the side door's
 *  digits off their sticky note — Sam LEARNS them, devices.ts learnCode, as off a guard — and who walks where; the worker: where the men come from, who sits where,
 *  the camera); then nothing, however he leans. A DialoguePick in the men's shape so the hold's plumbing reads it unchanged. */
export function civilianAnswer(g: Game, gd: Guard, rnd: () => number = simRandom): DialoguePick | null {
  void rnd;
  const C = gd.civ!; const T = gd.talk; T.stage++; T.presses++; T.lastT = g.time;
  const worker = C.def.kind === 'worker';
  const base = { kind: null as DialoguePick['kind'], cell: `civ:${C.def.kind}`, k: 'saw' as const, band: 'high' as const, t: 'nervy' as const, lineK: '*' as const, widened: '' as const, after: null, script: null, shape: null };
  if (g.snatch?.isMan(gd)) return T.stage <= 1 ? { ...base, text: pick(gd, SNATCH_LINES.held), id: 'civ:fear', stage: 1, stageN: T.stage } : { ...base, text: pick(gd, SNATCH_LINES.dry), id: 'civ:dry', stage: 'x', stageN: T.stage };   // (a snatch's man: his own two lines, and he has nothing to tell)
  if (T.stage <= 1) return { ...base, text: pick(gd, worker ? CIV_LINES.heldFearWorker : away(g) ? CIV_LINES.heldFear.map(t => /CLEAN here/.test(t) ? CIV_LINES.own.heldFear : t) : CIV_LINES.heldFear), id: 'civ:fear', stage: 1, stageN: T.stage };
  const own = away(g), men = own ? g.guards.filter(x => !x.unit && x.team === 'guard').length : 0;   // (words.ts: off the office what she knows is the keypad's digits, where there is one, and how many walk the place — the roster as she saw it come on, whoever is down since; nobody on it: not that)
  const pool = own ? [...(g.devices?.padNear(gd.char.pos) ? [CIV_LINES.own.intelPad] : []), ...(men ? CIV_LINES.own.intel : [])] : CIV_LINES.intel[C.def.kind] ?? [];
  if (C.intelN < pool.length) {
    let text = pool[C.intelN]; C.intelN++;
    if (own) { text = text.replace('{n}', CIV_COUNT[Math.min(men, CIV_COUNT.length - 1)]); if (C.intelN >= pool.length) C.intelN = Math.max(C.intelN, CIV_LINES.intel[C.def.kind]?.length ?? 0); }   // (told out: the count as player.ts's row reads 'told you everything' off the office's table)
    let kind: DialoguePick['kind'] = null;
    if (own && text.includes('{code}')) { text = text.replace('{code}', spellWords(g.devices!.padNear(gd.char.pos)!.def.code)); kind = 'code'; }
    if (/seven three nine one/i.test(text)) { const K = g.devices?.padNear(gd.char.pos); if (K) { text = text.replace(/Seven three nine one/i, spellWords(K.def.code)); kind = 'code'; } }   // the level's own digits, and Sam has them (game.ts interrogate → learnCode on kind 'code')
    return { ...base, kind, text, id: `civ:intel:${C.intelN}`, stage: T.stage === 2 ? 2 : 3, stageN: T.stage };
  }
  if (own) C.intelN = Math.max(C.intelN, CIV_LINES.intel[C.def.kind]?.length ?? 0);
  return { ...base, text: pick(gd, CIV_LINES.dry), id: 'civ:dry', stage: 'x', stageN: T.stage };
}
const DIGIT_WORDS = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
function spellWords(code: string): string { const w = code.split('').map(d => DIGIT_WORDS[Number(d)] ?? d).join(' '); return w[0].toUpperCase() + w.slice(1); }
/** Sam's side of a question to her (player.ts askHeld for a civilian) */
export function civilianSamLine(g: Game, gd: Guard): { text: string; id: string } { const text = pick(gd, away(g) ? CIV_LINES.samAsk.map(t => /on this floor/.test(t) ? CIV_LINES.own.samAsk : t) : CIV_LINES.samAsk); return { text, id: 'sam:civ' }; }
/** The 'stay down, stay quiet' row (player.ts updateHold, verb 'comply' on a held civilian): Sam's word over Sam, hers, and she is let go where she stands — down into a
 *  crouch, told: for CIV.complyMin minutes she stays there and reports NOTHING on her own (a man walking onto her still gets it out of her). The one way anybody
 *  comes out of Sam's arm on their feet by his choice; a civilian only. The debrief's row + count. */
export function civilianComply(g: Game): boolean {
  const pl = g.player, H = pl.holding; if (!H || !H.g.civ || H.phase !== 'held') return false;
  const gd = H.g, C = gd.civ!;
  const line = pick(gd, CIV_LINES.comply.sam);
  pl.bubble = { text: line, t: g.time, dur: clamp(0.7 + 0.018 * line.length, 0.9, 1.4) + 0.4, radio: false }; g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${line}`);
  C.complied = true; C.complyUntil = g.time + CIV.complyMin * 60;
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1; gd.speed = 0; gd.char.vel = [0, 0, 0];
  pl.holding = null; pl.char.anim.holdPose = null; pl.fireCd = Math.max(pl.fireCd, 0.4);
  later(g, 0.9, { kind: 'complyLine', cv: gd, o: null });
  toCower(g, gd, true);
  chronicleN(g, 'civilianComplied', 'civComplied', { who: C.name }, gd.char.pos);
  log(g, gd, `told to stay down — complies for ${CIV.complyMin} min`);
  g.msg(`${C.name} is down and quiet — ${w(C.she, 'she')}'ll stay put a while, and says nothing unless they find ${w(C.her, 'her')}`);
  return true;
}
/** combat.ts killGuard's first line hands a civilian here: `how` she went (shot = dead; struck / choked = out cold, breathing), by whose hand. Her state is 'dead' either
 *  way (every 'is she out of the picture' test the hold and the drag make keeps working); by the PLAYER's hand it goes on his card — a knockout priced hard, a death a
 *  'civilian casualty' (chronicle.ts SCORE), and with tune.civilianKillFails the mission fails where he stands. Nothing falls from her hands. The men find her as they
 *  find anybody (guardsNotice). */
export function civilianDown(g: Game, gd: Guard, dir: Vec3, quiet: boolean, how: DownKind, by: DownBy, line?: string) {
  const C = gd.civ!, c = gd.char;
  if (gd.state === 'dead') return;
  if (gd.bubble && g.time - gd.bubble.t < 0.8) g.msg(`${C.name}: ${gd.bubble.text}`);
  gd.state = 'dead'; gd.speed = 0; gd.diedAt = g.time; gd.downKind = how; gd.downBy = by; gd.script = null;
  if (gd.held) { gd.held = null; c.anim.heldPose = null; }
  c.anim.act = null; C.target = null; C.reportTo = null;
  c.ragdollize(g.col, dir, quiet);
  forgetMeter(g, gd);
  const dead = how === 'shot';
  const mark = !!g.snatch?.isMan(gd);   // (a snatch's man: out cold by Sam's hands is how he is taken, not a civilian hurt — snatch.ts words both ways he goes down)
  const hostage = WORDS.on && !!g.rescue?.isHostage(gd);   // (a hostage down is the rescue's to word — rescue.ts outcome: who shot her, and what it ends — not 'the cleaner … they will find her')
  if (by === 'player') {
    if (dead) { CIV_STATS.killed++; chronicleN(g, 'civilianKilled', 'civKilled', { who: C.name, label: C.label, weapon: g.player.gunInHand() ? plainShort(g.player.gunInHand()!.def) : 'a round' }, c.pos); }
    else if (!mark) { CIV_STATS.ko++; chronicleN(g, 'civilianKO', 'civKO', { who: C.name, label: C.label, method: how === 'choked' ? 'choke' : /whip/.test(line ?? '') ? 'whip' : /^ring/.test(line ?? '') ? 'ring' : 'takedown' }, c.pos); }
    if (dead && g.tune.civilianKillFails && missionLive(g)) { const m = g.mission; m.stage = 'failed'; m.driveT = -1; m.downCardAt = g.missionInTour ? -1 : g.time + DOWN_CARD_SECS; g.msg(`MISSION FAILED — ${C.name}, the ${C.label}, is dead by your hand. Enter restarts the encounter`); }
    else if (!hostage && !mark) g.msg(line ?? (dead ? `CIVILIAN CASUALTY — ${C.name}, the ${C.label}, is dead. that is on your record, and they will find ${C.her}` : how === 'choked' ? `${C.name} choked out — breathing. a civilian: that costs, and they may find ${C.her}` : `${C.name} out cold — breathing. a civilian: that costs, and they may find ${C.her}`));
  } else if (!hostage && !mark) g.msg(line ?? `${C.name}, the ${C.label}, is down`);
  log(g, gd, `DOWN — ${how} by ${by}`);
  // the other civilian, if it happened in front of her
  const at = c.bones.chest ?? v3.add(c.pos, [0, 1.1, 0]);
  for (const o of g.civilians) if (o !== gd && o.state !== 'dead' && !o.held && o.civ!.state !== 'gone' && civPointInView(g, o, at, CIV.bodyM)) { o.civ!.knownBodies.add(gd); toAlarmed(g, o, 'body', v3.copy(c.pos), true); }
}
function civPointInView(g: Game, gd: Guard, p: Vec3, range: number): boolean {
  const c = gd.char; const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); const look = c.chestDir; const E = eyeOf(g, gd);
  const to = v3.sub(p, eye); const L = v3.len(to); if (L > range) return false; if (Math.hypot(to[0], to[2]) < 0.3) return true;
  if (v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) < Math.cos(Math.max(45, E.halfDeg) * DEG)) return false;
  return !g.col.segmentBlocked(eye, p);
}

// ================================================================ the MEN and her
/** the man on the floor best placed to say a thing about spot `pos`: living staff, free, calm for choice, nearest */
function staffCalm(g: Game, o: Guard): boolean { return o.state !== 'dead' && o.team === 'guard' && !o.held && !o.script && g.guards.includes(o); }
/** Once a frame: (1) a frightened woman running / screaming — every calm staff man in earshot of the scream (the sound's own path × its carry inside screamM) or with her
 *  in his open view inside seeM (lit past seeLit on her meter, or four metres off) turns toward where she came FROM, suspicious, with a word; told once per fright; and
 *  if he is nearer than what she was running to, she runs to him. (2) One crouched in a corner: a calm-ish man within foundM with a clear line asks her, and a beat
 *  later she tells him (deliverReport 'found'). (3) One on the floor: a body like any body to the first man with her in view — called in in his own words, everybody
 *  else's ears pricked and their fix on her, the alarm placed there and the floor up (out cold: a step, or lockdown if it was already up; DEAD: lockdown, and control's fury). */
function guardsNotice(g: Game, dt: number) {
  if (!g.aiEnabled) return;
  for (const cv of g.civilians) {
    const C = cv.civ!, c = cv.char;
    if (C.state === 'gone') continue;
    // (3) down and not yet found
    if (cv.state === 'dead') { if (!cv.found) for (const o of g.guards) { if (o.state === 'dead' || o.team !== 'guard' || o.held || !g.guards.includes(o) || o.state === 'alert' || g.time < o.dazzledUntil) continue; if (bodyInViewOf(g, o, cv)) { foundDown(g, cv, o); break; } } continue; }   // (a scripted man too — the pair clearing rooms, the response team: he calls her in and carries on with his drill)
    if (cv.held) continue;
    const panicking = C.state === 'flee' || C.state === 'alarmed' || (C.state === 'report' && !C.acked);
    if (panicking) {
      const vis = civVisibility(g, cv, dt);
      const mouth = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]), chest = c.bones.chest ?? v3.add(c.pos, [0, 1.2, 0]);
      const screaming = g.time - C.screamAt < 0.5;
      for (const o of g.guards) {
        if (!staffCalm(g, o) || (o.state !== 'patrol' && o.state !== 'suspicious') || C.told.get(o) === C.alarmN || o === C.reportTo) continue;
        const d = v3.dist(o.char.pos, c.pos); if (d > Math.max(CIV.screamM, CIV.seeM) + 2) continue;
        let heard = false, seen = false;
        if (screaming && d <= CIV.screamM + 2) { const pr = hearPath(g, mouth, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0])); heard = pr.pathLen < CIV.screamM * pr.carry; }
        if (!heard && d <= CIV.seeM) seen = pointInView(g, o, chest, CIV.seeM, 58) && (vis > CIV.seeLit || d < 4);
        if (!heard && !seen) continue;
        C.told.set(o, C.alarmN); CIV_STATS.noticed++;
        const from = C.causePos ?? c.pos;
        o.awareness = Math.max(o.awareness, 0.5); if (!o.lastKnown || o.state === 'patrol') o.lastKnown = v3.copy(from);
        if (o.state === 'patrol') { o.state = 'suspicious'; o.searchT = 0; o.reactT = Math.max(o.reactT, 0.7); o.path = []; o.pathGoal = null; o.stallRef = null; }
        if (!(o.bubble && g.time - o.bubble.t < 1.5)) say(g, o, seen ? `${C.name}? — hey. HEY. what is it —` : `— that was ${C.name} —`);
        log(g, cv, `${o.callsign} ${heard ? 'heard her' : 'saw her running'} (${d.toFixed(1)} m) → looks toward (${from[0].toFixed(1)}, ${from[2].toFixed(1)})`);
        // she runs to HIM if he is the nearer thing now
        if (C.state === 'flee' && C.target && !C.pinTarget && C.target.guard !== o && tellable(g, o)) { const cur = pathMetres(g, c.pos, C.target.pos).m + (C.target.kind === 'guard' ? 0 : CIV.guardBonusM); const alt = pathMetres(g, c.pos, o.char.pos).m; if (alt < cur - 2) { C.target = { kind: 'guard', guard: o, spot: null, pos: v3.copy(o.char.pos), name: o.callsign, planPos: v3.copy(o.char.pos) }; goTo(g, cv, C.target.pos, true); log(g, cv, `→ running to ${o.callsign} instead`); } }
      }
    }
    // (2) crouched in a corner, not yet told to anybody: a man by her
    if (C.state === 'cower' && !C.reported && !(C.foundTold && C.foundLineAt >= 0 && g.time - C.foundLineAt < 4)) {
      let by: Guard | null = null;
      for (const o of g.guards) { if (!staffCalm(g, o) || o.state === 'alert' || v3.distXZ(o.char.pos, c.pos) > CIV.foundM) continue; if (g.col.solidBlocked(v3.add(o.char.pos, [0, 1.3, 0]), v3.add(c.pos, [0, 0.9, 0]))) continue; by = o; break; }
      if (!by) { C.foundT = 0; C.foundBy = null; }
      else {
        if (C.foundBy !== by) { C.foundBy = by; C.foundT = 0; C.foundLineAt = -1; }
        C.foundT += dt;
        primeGuard(g, by, c.pos, 0.5);   // he stops by her, turned to her (his fix is on her corner)
        if (C.foundLineAt < 0 && C.foundT >= CIV.foundSecs) { C.foundLineAt = g.time; CIV_STATS.found++; say(g, by, fill(g, cv, pick(cv, CIV_LINES.found), by)); log(g, cv, `${by.callsign} found her cowering`); }
        if (C.foundLineAt >= 0 && !C.foundTold && g.time - C.foundLineAt >= 1.6) { C.foundTold = true; C.reportTo = by; civSay(g, cv, pick(cv, CIV_LINES.report[C.cause ?? 'sam'] ?? CIV_LINES.report.sam)); later(g, 1.8, { kind: 'foundReport', cv, o: by }); }   // (her answer, then what it does to him a beat later — deliverReport's once-flag ends the pair)
      }
    }
  }
}
/** a downed civilian in this man's open view (the men's own body test: 12 m, 60° of the chest, a clear line to the pelvis) */
function bodyInViewOf(g: Game, o: Guard, cv: Guard): boolean {
  const eye = o.char.bones.head ?? v3.add(o.char.pos, [0, 1.65, 0]); const look = o.char.chestDir;
  const body = cv.char.bones.hips ?? cv.char.pos; const to = v3.sub(body, eye); if (v3.len(to) > 12) return false;
  if (Math.hypot(to[0], to[2]) > 0.4 && v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) < Math.cos(60 * DEG)) return false;
  return !g.col.segmentBlocked(eye, v3.add(body, [0, 0.3, 0]));
}
function foundDown(g: Game, cv: Guard, o: Guard) {
  const C = cv.civ!, body = bodyPos(cv); const dead = cv.downKind === 'shot';
  cv.found = true; CIV_STATS.foundDown++; tally(g, 'bodies');
  chronicle(g, 'bodyFound', { who: C.name, by: o.callsign, breathing: !dead, civilian: true }, body);
  o.witness.sawBody = { victim: C.name, t: g.time, breathing: !dead };
  if (!o.script) {   // (a man on a drill calls her in and keeps his place in it: squad.ts / qrf.ts own his feet)
    o.awareness = Math.max(o.awareness, 0.7); o.lastKnown = v3.copy(body); o.reactT = 1.2; o.bodyDuty = null; o.task = null; o.path = []; o.pathGoal = null;
    if (o.state === 'patrol' || o.state === 'search') { o.state = 'suspicious'; o.searchT = 0; o.searchPlan = null; o.pieing = null; }   // (a searcher's plan and his doorway go with the search: this runs after his own update, which would only drop them a frame late)
  }
  say(g, o, fill(g, cv, dead ? CIV_LINES.foundDown.dead : away(g) ? CIV_LINES.own.foundCold : CIV_LINES.foundDown.cold, o), true); g.audio.play('radio', o.char.bones.head ?? o.char.pos, 0.9);
  for (const other of g.guards) if (other !== o && other.state !== 'dead' && other.team === 'guard' && !other.held) { other.witness.calledToBody = { victim: C.name, t: g.time, breathing: !dead }; if (other.script) continue; other.awareness = Math.max(other.awareness, 0.45); if (!other.task && other.state !== 'alert') other.lastKnown = v3.copy(body); }
  if (!g.quietUtility) {
    g.alarm.pos[0] = body[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = body[2]; g.alarm.placed = true;
    later(g, 1.4, { kind: 'bodyEsc', cv, o, dead, lvl: escalationOf(g) });   // (runPending: a body is a body — the order's own 'man down' wording; a DEAD civilian locks the floor down whatever it was before)
    if (dead) later(g, 4.5, { kind: 'outrage', cv, o: null });
  }
  log(g, cv, `found ${dead ? 'DEAD' : 'out cold'} by ${o.callsign}`);
}
/** her scream / shout, to the OTHER civilian's ears: the same propagation, the same reach as to the men's — what frightened the one frightens the other */
function hearScream(g: Game, gd: Guard) {
  const C = gd.civ!, mouth = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
  for (const o of g.civilians) {
    if (o === gd || o.state === 'dead' || o.held) continue; const OC = o.civ!; if (OC.state !== 'work' && OC.state !== 'startled' && OC.state !== 'cower') continue;
    if (v3.dist(o.char.pos, gd.char.pos) > CIV.screamM + 2) continue;
    const pr = hearPath(g, mouth, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0]));
    if (pr.pathLen < CIV.screamM * pr.carry) toAlarmed(g, o, 'scream', v3.copy(C.causePos ?? gd.char.pos), C.armed);
  }
}

// ================================================================ passing pleasantries
/** a calm patrolling staff man with nothing on his hands or his mind and no line in the air (dialogue.ts chatty's tests, without importing its private one) */
function chattyEnough(g: Game, x: Guard): boolean { return x.team === 'guard' && !x.unit && x.state === 'patrol' && !x.held && !x.script && !x.task && !x.bodyDuty && !x.pinned && !x.hold && !x.leader && !x.post && x.awareness < 0.15 && !(x.bubble && g.time - x.bubble.t < x.bubble.dur + 1) && g.guards.includes(x); }
function greetings(g: Game) {
  if (!CIV.greet || escalationOf(g) !== 0 || g.alarm.episode || g.blackout.active || g.player.holding) return;
  const F = floorOf(g); if (g.time - F.greetAt < CIV.greetFloorSecs) return;
  for (const cv of g.civilians) {
    const C = cv.civ!; if (C.state !== 'work' || cv.state === 'dead' || taskAt(cv) === 'sit' && cv.wait > 0 || g.time - C.greetAt < CIV.greetPairSecs || (cv.bubble && g.time - cv.bubble.t < cv.bubble.dur + 1)) continue;
    for (const o of g.guards) {
      if (!chattyEnough(g, o) || v3.distXZ(o.char.pos, cv.char.pos) > CIV.greetM) continue;
      if (g.col.solidBlocked(v3.add(o.char.pos, [0, 1.4, 0]), v3.add(cv.char.pos, [0, 1.4, 0]))) continue;
      C.greetAt = g.time; F.greetAt = g.time; CIV_STATS.greetings++;
      civSay(g, cv, pick(cv, w(CIV_LINES.greet.civ.filter(t => !(/wet floor/.test(t) && !C.def.tasks?.includes('wipe'))), CIV_LINES.greet.civ)));   // (words.ts: the wet floor is hers to warn of only if she wipes one)
      later(g, 1.3, { kind: 'greetReply', cv, o });
      log(g, cv, `greets ${o.callsign}`);
      return;
    }
  }
}

// ================================================================ the response team: get them off the floor
function evacuationCheck(g: Game) {
  if (!CIV.evacuateOnQrf || !g.qrf || g.qrf.state === 'idle') return;
  const F = floorOf(g);
  const movable = g.civilians.filter(cv => cv.state !== 'dead' && !cv.held && cv.civ!.state !== 'gone' && cv.civ!.state !== 'evacuate');
  if (!F.evacTold) { F.evacTold = true; if (movable.length) { control(g, movable[0], w(CIV_LINES.now.qrf, CIV_LINES.qrf)); log(g, movable[0], 'control clears the floor (QRF inbound)'); } }
  for (const cv of movable) {
    const C = cv.civ!; if (C.state === 'phone' && C.talkT < CIV.phoneSecs) continue;   // she finishes the call
    endTask(cv); C.riseT = 0; cv.char.anim.act = null;
    const T = pickTarget(g, cv, { exitsOnly: true }); if (!T) continue;
    toFlee(g, cv, T, true);
  }
}

// ================================================================ persistence (one key per machine: the switch and the fail rule)
const LS_KEY = 'twopointsix.civilians';
export function saveCivTune(g: Game) { try { localStorage.setItem(LS_KEY, JSON.stringify({ on: g.tune.civilians, killFails: g.tune.civilianKillFails, greet: CIV.greet })); } catch { /* no storage */ } }
export function loadCivTune(g: Game) {
  try { const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (j && typeof j === 'object') { if (typeof j.on === 'boolean') g.tune.civilians = j.on; if (typeof j.killFails === 'boolean') g.tune.civilianKillFails = j.killFails; if (typeof j.greet === 'boolean') CIV.greet = j.greet; } } catch { /* nothing stored, or not readable */ }   // (no early return: a FRESH profile has no record and must still read the URL flag below)
  try { if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nocivilians')) g.tune.civilians = false; } catch { /* no location (the harness) */ }   // ?nocivilians: nobody but the shift from boot — the frame and the floor byte for byte as before them — whatever the stored switch says
}
/** the switch flipped live (Tab panel / console): off = they leave the floor this frame (a held / dragged one let go of first); on = fresh ones on their marks */
export function setCivilians(g: Game, on: boolean) { g.tune.civilians = on; saveCivTune(g); resetCivilians(g); }

// ================================================================ panel / QA
/** 'civilians ▸ Marta WORK wipe @wp3 (14 s) aw 0.00 | Owen FLEE → Novak [gun, armed] aw 1.00' */
export function civiliansSummary(g: Game): string {
  if (!g.tune.civilians) return 'civilians ▸ off';
  if (!g.civilians.length) return 'civilians ▸ none authored on this level';
  if (!civiliansOnFloor(g)) return 'civilians ▸ off the floor (the tour / daylight)';
  return 'civilians ▸ ' + g.civilians.map(cv => {
    const C = cv.civ!;
    if (cv.state === 'dead') return `${C.name} DOWN (${cv.downKind}${cv.found ? ', found' : ''})`;
    const bits = [`${C.name} ${C.state.toUpperCase()}`];
    if (C.state === 'work') bits.push(cv.wait > 0 ? `${taskAt(cv)} @wp${cv.wp} (${Math.ceil(cv.wait)} s)` : `→ wp${cv.wp}`);
    if (C.target) bits.push(`→ ${C.target.name}`);
    if (C.reportTo && (C.state === 'report' || C.reported)) bits.push(`told ${C.reportTo.callsign}`);
    if (C.cause) bits.push(`[${C.cause}${C.armed ? ', armed' : ''}${C.reported ? ', reported' : ''}${C.phoned ? ', phoned' : ''}]`);
    if (C.state === 'cower' && C.complied) bits.push(`complied ${Math.max(0, Math.ceil((C.complyUntil - g.time) / 60))} min`);
    bits.push(`aw ${cv.awareness.toFixed(2)}`);
    return bits.join(' ');
  }).join(' | ');
}
/** the panel's / the probes' buttons: frighten one now (as if she had seen him where he stands), or send her to ring it in from the nearest phone */
export function civPanic(g: Game, gd: Guard | undefined, what: 'panic' | 'phone' = 'panic'): string {
  if (!gd?.civ) return 'no such civilian';
  if (!civiliansOnFloor(g)) return 'not now (the tour / daylight)';
  if (gd.state === 'dead') return `${gd.civ.name} is down`; if (gd.held) return `${gd.civ.name} is in your arm`;
  const C = gd.civ; const pp = v3.copy(g.player.char.pos);
  if (what === 'phone') {
    C.cause = 'panel'; C.causePos = pp; C.causeAt = g.time; C.alarmN++; C.reported = false; C.phoned = false; C.badTargets.clear(); endTask(gd); C.riseT = 0; gd.char.anim.act = null;
    let best: CivSpot | null = null, bm = Infinity; for (const s of civSpots(g).phones) { const m = pathMetres(g, gd.char.pos, s.pos).m; if (m < bm) { bm = m; best = s; } }
    if (!best) return `${C.name} cannot reach a phone from here`;
    toFlee(g, gd, { kind: 'phone', guard: null, spot: best, pos: v3.copy(best.pos), name: best.name, planPos: v3.copy(best.pos) }, false); C.pinTarget = true;
    return `${C.name} runs for ${best.name}`;
  }
  if (C.state !== 'work' && C.state !== 'startled' && C.state !== 'cower') return `${C.name} is already ${C.state}`;
  toAlarmed(g, gd, 'panel', pp, false);
  return `${C.name} panics (as if she had seen you where you stand)`;
}
/** headless check of CIV_SPOTS and every civilian's marks against the level (free nav cells; every spot reachable from every civilian's first mark) — the probes print it */
export function checkCivSpots(g: Game): string[] {
  const nav = g.col.nav; const errs: string[] = [];
  const spots = [...civSpots(g).phones, ...civSpots(g).exits];
  for (const s of spots) if (nav.isBlocked(s.pos[0], s.pos[2])) errs.push(`${s.name} (${s.pos[0]}, ${s.pos[2]}) is not a free nav cell`);
  for (const def of g.level.civilians ?? []) {
    def.points.forEach((p, i) => { if (nav.isBlocked(p[0], p[2])) errs.push(`${def.name} mark ${i} (${p[0]}, ${p[2]}) is not a free nav cell`); });
    for (const s of spots) if (!nav.findPath(def.points[0], s.pos, 6000)) errs.push(`${def.name} cannot reach ${s.name} from her first mark`);
    for (let i = 1; i < def.points.length; i++) if (!nav.findPath(def.points[i - 1], def.points[i], 6000)) errs.push(`${def.name}: no path mark ${i - 1} → ${i}`);
  }
  return errs;
}
