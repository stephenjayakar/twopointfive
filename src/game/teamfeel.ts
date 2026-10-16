// TEAM FEEL: the room fight's feel rules, gathered for the Tab panel (ui/bindings.ts 'Team feel') and KEPT PER MACHINE. The rules themselves live where they
// act — combat.ts FLASH / LASER, guards.ts PACE / LIGHTS, nvg.ts NVG, irlaser.ts IR, fogofwar.ts FOG, doortools.ts DOORTOOLS, roomfight.ts ROOMFIGHT, orders.ts ORDERS, cover.ts COVER / REAR, entrypoints.ts ENTRY — and each
// has its old behaviour one switch away; this file only knows which of their keys are worth a row, what they shipped as, and how to keep a changed one across
// a reload (every scenario pick on the start card IS a page load, so an A/B flipped in the panel would otherwise be gone before it could be played).
//   Stored: ONLY the keys a row has changed and that differ from the shipped value (localStorage `twopointsix.teamfeel`, `{ "PACE.max": 1.8, … }`) — an
//   untouched knob follows the build's default when that moves, and a URL flag for a visit is not kept. Read back once per Game (its constructor), type-checked against the shipped value. No storage (the harness): nothing kept.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load — tables() and the shipped snapshot are made on first use.)
import { FLASH, LASER } from './combat';
import { PACE, LIGHTS } from './guards';
import { FOG } from './fogofwar';
import { DOORTOOLS } from './doortools';
import { ROOMFIGHT } from './roomfight';
import { ORDERS } from './orders';
import { COVER, REAR } from './cover';
import { NVG } from './nvg';
import { IR } from './irlaser';
import { IRLIGHT } from './irlight';
import { ENTRY } from './entrypoints';
import { SILENT } from './silent';
import { FRAG } from './frag';
import { PAIR } from './pairorders';
import { DOORMANNERS } from './doorway';

type Table = Record<string, unknown>;
export type FeelName = 'FLASH' | 'PACE' | 'LIGHTS' | 'NVG' | 'IR' | 'IRLIGHT' | 'FOG' | 'LASER' | 'DOORTOOLS' | 'ROOMFIGHT' | 'ORDERS' | 'COVER' | 'ENTRY' | 'REAR' | 'SILENT' | 'FRAG' | 'PAIR' | 'DOORMANNERS';
/** THE list: every key with a row (a dotted key reaches into an array: 'secs.0') → null for a switch, [min, max, step] for a number. The panel's rows take
 *  their ranges from here (bindings.ts feelRows refuses a row whose key is not listed) and a stored number outside its range is passed over on load. */
const KEPT: Record<FeelName, Record<string, [number, number, number] | null>> = {
  FLASH: { on: null, 'secs.0': [1, 12, 0.5], 'secs.1': [0.5, 12, 0.5], 'stagger.0': [0, 6, 0.25], 'stagger.1': [0, 6, 0.25], concussM: [0, 12, 0.5], concussK: [0, 1, 0.05], ownM: [0, 6, 0.25], fuse: [0.2, 2.5, 0.1] },
  PACE: { on: null, max: [1.2, 4.7, 0.1], accel: [1, 12, 0.2], turn: [0, 30, 1], swing: [0, 60, 2] },
  LIGHTS: { on: null, litOff: null, litAt: [0.05, 0.9, 0.05], lookDark: null, afterSecs: [0, 10, 0.5], hotSecs: [0, 15, 0.5], stepSecs: [0, 15, 0.5], onM: [0.2, 5, 0.1], aloneM: [2, 20, 0.5] },
  NVG: { on: null, lead: null, own: null, quietSecs: [0, 90, 5], darkAt: [0.05, 0.9, 0.05], blackAt: [0, 0.6, 0.05] },
  IR: { on: null, sam: null, carry: null },
  IRLIGHT: { on: null, team: null, power: [5, 100, 5], cone: [30, 85, 5], reach: [8, 30, 1] },   // the infrared light on the goggles (irlight.ts)
  FOG: { own: null, calls: null, doors: null, lasers: null },
  LASER: { enemy: null },
  FRAG: {},
  SILENT: { on: null, start: null, pace: [0, 2.2, 0.1], hotPace: null, step: [0, 0.8, 0.05], lights: null, hush: null, doors: null, kicks: null, picks: null, bootWedged: null, cans: null, holdFire: null, noticed: [0.1, 1, 0.05], toolsLoud: null },   // the squad's posture on Sam's word (silent.ts) — up here, not at the table's foot where the other parts add theirs
  DOORTOOLS: { secondThrows: null, lastOut: null, slicePace: [0, 2.2, 0.1], corners: null, sectors: null, search: null, scanRate: [0.4, 4, 0.1], charges: [0, 6, 1], bangs: [0, 9, 1], wordOnKey: null, thrSlice: null, thrLight: [0, 2, 1], thrMin: [0, 15, 0.5], thrQuiet: [0, 10, 0.5], thrBangs: [0, 4, 1], thrIn: [1, 4, 1] },
  ROOMFIGHT: { stepEars: null, arcHalfDeg: [30, 180, 5], teamHot: [5, 120, 5], cued: null, letGo: [0, 3, 0.1], stepLook: null, samLine: null, turnWalk: null, nearest: null, closeLane: null, samBehind: null, doorway: null, sideStep: null, fallBack: null, rally: null },
  ORDERS: { run: [1.2, 4.7, 0.1], brisk: [1.2, 4.7, 0.1], entry: [1.2, 4.7, 0.1], asideHold: [0, 4, 0.25], offDoor: [0, 1.5, 0.1], clickGives: null, wheelElement: null, doorRay: null },
  COVER: { on: null, stacked: null, rearWalkM: [0, 30, 0.5], inRoom: null, edge: null, laneWalk: null },
  ENTRY: { offOpenings: null, watch: null, nearM: [0, 6, 0.5], gaps: null },
  REAR: { settle: null, secs: [0, 3, 0.25], file: null },
  PAIR: { on: null, markOnHands: null, watched: null, quietFirst: null, stageM: [1.2, 4, 0.1], secs: [0.2, 2, 0.1], pace: [0.6, 2.2, 0.1], goPace: [0.6, 2.2, 0.1], coneM: [0, 16, 1], crouch: null, darkVis: [0.05, 0.9, 0.05], darkM: [0, 3, 0.5], darkRefuse: null, darkCrouch: null },   // quiet orders for one partner (pairorders.ts)
  DOORMANNERS: { on: null, pass: null, stand: null, swing: null, lane: null, laneMove: null, laneLeaf: null, laneWalk: null, watch: null, fight: null, gap: [0.8, 2, 0.05], patience: [0.5, 1.2, 0.1] },   // doorway manners, both sides (doorway.ts): its one switch, and the rules under it for an A/B
};
// (the rescue-with-goggles rows, added down here so the tables above stay line for line what the other parts of the build merge against)
Object.assign(KEPT.NVG, { huntFrees: null });
// (a silent squad and standing glass, silent.ts silentGlassHolds)
Object.assign(KEPT.SILENT, { glass: null });
// (frag grenades, frag.ts: the defenders' own, and the numbers of the item itself)
Object.assign(KEPT.FRAG, { defenders: null, defMax: [0, 6, 1], defShare: [1, 11, 1], defFuse: [2, 6, 0.25], defWind: [0, 3, 0.1], defGap: [0, 60, 1], fuse: [1.5, 6, 0.25], lethalM: [1, 8, 0.5], woundM: [2, 14, 0.5] });
// (a burst and glass, frag.ts: the size of the blast the panes round it take, and what a fragment has for a pane that stands — its own statement, as above)
Object.assign(KEPT.FRAG, { glassM: [0.5, 8, 0.25], glassPower: [0, 3, 0.1], paneEnergy: [0, 1, 0.05] });
Object.assign(KEPT.DOORMANNERS, { restClear: null, markClear: null, podClear: null, shortClear: null });   // (a follower's place, stack marks and the points after an entry keep off frames and swings: their own rows)
Object.assign(KEPT.DOORMANNERS, { stepCover: null, planeDeg: [0, 60, 5] });   // (a defender's step off a doorway: never to a spot a rifle reaches through glass; cover on either face with them along the wall)
Object.assign(KEPT.DOORMANNERS, { ownPlace: null });   // (a teammate on his own mark by a door is walked round, never walked into)
Object.assign(KEPT.ROOMFIGHT, { samTravel: null, samBeside: null, noShotGo: [0, 5, 0.25], keepTrack: null });
// (the threshold's later rows — the far gun's set, the goggles, the room's other doors held — as their own statement: other parts add rows to the table's lines)
Object.assign(KEPT.DOORTOOLS, { thrSet: null, thrTube: null, thrDark: null, thrDoors: null, thrDoorsM: [0, 12, 0.5], thrDoorsLit: null });
// (… and the can that goes in before anybody shows in a hot door's opening)
Object.assign(KEPT.DOORTOOLS, { thrFirst: [0, 2, 1], thrFirstMin: [0, 15, 0.5], thrFirstStale: [0, 15, 0.5], thrFirstIn: [0, 4, 0.2], thrFirstOnly: null });
// (the captor's last warning heard at the door: its own statement, as above)
Object.assign(KEPT.DOORTOOLS, { thrLast: null });
// (the room's other door has a gun on it from the entry itself: its own statement, as above)
Object.assign(KEPT.DOORTOOLS, { otherDoorM: [0, 12, 0.5] });
// (the calls taken while the maintainer was away — rebuild/away-build/calls.md — as their own lines, like the rows above)
Object.assign(KEPT.DOORTOOLS, { thrHoldFirst: null, thrBangFirst: null, thrOutsideRow: null, thrLeaveFallIn: null, thrHandsOff: null, thrHeldAll: null, thrMenuWord: null });
Object.assign(KEPT.ROOMFIGHT, { rallyK: [0, 1, 0.05] });
// (a lost room is never left for the lot: roomfight.ts breakOff)
Object.assign(KEPT.ROOMFIGHT, { fallBackIn: null });
Object.assign(KEPT.FOG, { lastSeen: [0, 10, 0.5] });
// (the night breach's last hunt — from the dark, dark on a man who stands lit — again as its own statement)
Object.assign(KEPT.LIGHTS, { litMan: null });
Object.assign(KEPT.PAIR, { grip: null, gripBody: null });
const LS_KEY = 'twopointsix.teamfeel';
/** null = a switch · [min, max, step] = a number's row · undefined = not a key this file keeps */
export function feelRange(n: FeelName, key: string): [number, number, number] | null | undefined { return KEPT[n]?.[key]; }

/** the live tables by name */
export function feelTables(): Record<FeelName, Table> {
  return { FLASH, PACE, LIGHTS, NVG, IR, IRLIGHT, FOG, LASER, DOORTOOLS, ROOMFIGHT, ORDERS, COVER, ENTRY, REAR, SILENT, FRAG, PAIR, DOORMANNERS } as unknown as Record<FeelName, Table>;
}
let shipped: Record<FeelName, Table> | null = null;
/** the shipped values (a deep copy taken the first time anything here is asked — before a stored copy is applied: loadTeamFeel asks first) */
export function feelDefaults(): Record<FeelName, Table> {
  if (!shipped) { const T = feelTables(); shipped = {} as Record<FeelName, Table>; for (const n of Object.keys(KEPT) as FeelName[]) shipped[n] = JSON.parse(JSON.stringify(T[n])) as Table; }
  return shipped;
}
const leaf = (t: Table, key: string): [Table, string] => { const path = key.split('.'); const last = path.pop()!; return [path.reduce<Table>((x, p) => x[p] as Table, t), last]; };
const read = (t: Table, key: string): unknown => { const [o, k] = leaf(t, key); return o[k]; };
const split = (name: string): [FeelName, string] => { const dot = name.indexOf('.'); return [name.slice(0, dot) as FeelName, name.slice(dot + 1)]; };
/** every kept key whose live value is not the shipped one, as 'TABLE.key' → value (whoever changed it: a row, a URL flag, the console — what the summary shows) */
export function feelChanged(): Record<string, number | boolean> {
  const T = feelTables(), D = feelDefaults(); const out: Record<string, number | boolean> = {};
  for (const n of Object.keys(KEPT) as FeelName[]) for (const k of Object.keys(KEPT[n])) { const v = read(T[n], k); if (v !== read(D[n], k) && (typeof v === 'number' || typeof v === 'boolean')) out[`${n}.${k}`] = v; }
  return out;
}
/** the keys a PLAYER has changed: the ones a panel row wrote (saveTeamFeel) and the ones read back from storage — only these are ever stored, so a URL flag
 *  for a visit (?nocover) or a number poked from the console is not kept by the next row that happens to be moved */
const touched = new Set<string>();
/** a panel row changed `name` ('PACE.max'): keep it — or, back at the build's value, stop keeping it */
export function saveTeamFeel(name: string) {
  const [n, k] = split(name); if (feelRange(n, k) === undefined) return;
  touched.add(name);
  const T = feelTables(), D = feelDefaults(); const out: Record<string, number | boolean> = {};
  for (const key of [...touched]) { const [tn, tk] = split(key); const v = read(T[tn], tk); if (v === read(D[tn], tk)) touched.delete(key); else if (typeof v === 'number' || typeof v === 'boolean') out[key] = v; }
  try { if (Object.keys(out).length) localStorage.setItem(LS_KEY, JSON.stringify(out)); else localStorage.removeItem(LS_KEY); }
  catch { /* no storage (the harness, a locked-down page): nothing to keep */ }
}
/** read the stored copy back over the shipped values: a key this build does not keep, a value of another type than it shipped as, or a number outside its
 *  row's range, is passed over */
export function loadTeamFeel() {
  const T = feelTables(), D = feelDefaults();
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as Record<string, unknown> | null; if (!j || typeof j !== 'object') return;
    for (const [name, v] of Object.entries(j)) {
      const [n, k] = split(name); const range = feelRange(n, k); if (range === undefined) continue;
      if (typeof v !== typeof read(D[n], k)) continue;
      if (typeof v === 'number' && (!range || !Number.isFinite(v) || v < range[0] || v > range[1])) continue;
      const [o, last] = leaf(T[n], k); o[last] = v; touched.add(name);
    }
  } catch { /* nothing stored, or not readable: the shipped values stand */ }
}
/** every kept key back to the build's value, the stored copy dropped */
export function resetTeamFeel() {
  const T = feelTables(), D = feelDefaults();
  for (const n of Object.keys(KEPT) as FeelName[]) for (const k of Object.keys(KEPT[n])) { const [o, last] = leaf(T[n], k); o[last] = read(D[n], k); }
  touched.clear();
  try { localStorage.removeItem(LS_KEY); } catch { /* none */ }
}
/** 'as shipped' / '2 changed · PACE.max 1.8 · FLASH.on off' */
export function teamFeelSummary(): string {
  const ch = Object.entries(feelChanged()); if (!ch.length) return 'as shipped';
  const word = (v: number | boolean) => typeof v === 'boolean' ? (v ? 'on' : 'off') : String(+v.toFixed(2));
  return `${ch.length} changed · ${ch.slice(0, 3).map(([k, v]) => `${k} ${word(v)}`).join(' · ')}${ch.length > 3 ? ' …' : ''}`;
}

// ---- rows added after the table was written, one block a part, at the END of this file so that parts built side by side merge without touching each other's lines
// (a local table extended at module load: nothing here reads another game module's exports)
/** cover.ts COVER.step — a teammate stood still steps to where he sees through an open door (off = he stands where his order put him) · how far from his place */
const COVER_STEP: (typeof KEPT)[FeelName] = { step: null, stepM: [0.5, 2.5, 0.1] };
Object.assign(KEPT.COVER, COVER_STEP);
/** cover.ts COVER.backKeep — a man walking backwards on his opening keeps to it until his body has come round to the way he goes (off = he could change his mind every frame)  */
Object.assign(KEPT.COVER, { backKeep: null });
// the entry: a shot does not cost a man his corner, and the man who has seen most of the room goes in first (doortools.ts DOORTOOLS.cornerOwed / collapse / cornerTurn / leadSeen)
Object.assign(KEPT.DOORTOOLS, { cornerOwed: null, collapse: null, cornerTurn: null, leadSeen: null, leadSeenMin: [0, 80, 2], leadSeenSecs: [5, 120, 5] });
// eyes on the sights: a man with his long gun in the shoulder also sees along his aim (roomfight.ts ROOMFIGHT.sights / sightsFoe — rebuild/four-man-entries/fix.md)
Object.assign(KEPT.ROOMFIGHT, { sights: null, sightsFoe: null, sightsDeg: [20, 58, 1] });
// (a door face with no floor at either jamb: the men work their own marks out — orders.ts workedMarks)
Object.assign(KEPT.ORDERS, { workOut: null });
// (a door across a passage: three or four file up behind the jamb men, back down the passage — orders.ts ORDERS.hallFile)
Object.assign(KEPT.ORDERS, { hallFile: null });
// (a pair's second place in a one-jamb file is asked for floor like every other — orders.ts ORDERS.secondFloor)
Object.assign(KEPT.ORDERS, { secondFloor: null });
// (a point inside is never moved into the mouth of the door the entry comes through — entrypoints.ts ENTRY.offMouth; ships off)
Object.assign(KEPT.ENTRY, { offMouth: null });
// the way an order walks a man (cleared.ts): round rooms nobody has been in · the stack on the known face · the entry through the ordered door
Object.assign(KEPT.ORDERS, { cleared: null, knownFace: null, ownDoor: null, clearedDear: [1, 40, 1] });
// nobody is sent off alone: a walk away from everybody is taken by a pair or not at all (doortools.ts DOORTOOLS.buddy)
Object.assign(KEPT.DOORTOOLS, { buddy: null, buddyDoors: null, buddyM: [2, 12, 0.5], buddyPairM: [5, 30, 1], buddyLeftM: [4, 20, 1] });
// the whole room: a part of it nobody has seen is gone into, not looked at from its mouth (doortools.ts DOORTOOLS.flowOn)
Object.assign(KEPT.DOORTOOLS, { flowOn: null, flowCells: [8, 120, 4], openAir: null, flowMax: [0, 900, 20] });
// a known threat first: the first man in has his gun on where the team knows an enemy to be beyond the door (doortools.ts DOORTOOLS.threatFirst)
Object.assign(KEPT.DOORTOOLS, { threatFirst: null, threatSecs: [2, 30, 1], threatCap: [0.5, 4, 0.1] });
// frag and clear: no grenade thrown at a leaf that is not open (doortools.ts DOORTOOLS.fragWay; bangWay = the same for a stun canister)
Object.assign(KEPT.DOORTOOLS, { fragWay: null, bangWay: null, fragWayWait: [0, 3, 0.1] });
// a bang / frag order on a door standing open walks nobody across the front of it (doortools.ts DOORTOOLS.openHand)
Object.assign(KEPT.DOORTOOLS, { openHand: null });
// several doors on one signal: the hand door's man is on its handle before the boot beside him goes in (doortools.ts DOORTOOLS.gateHand)
Object.assign(KEPT.DOORTOOLS, { gateHand: null });
// a door an enemy's hand opens is looked at by every free teammate with a line to its doorway (roomfight.ts ROOMFIGHT.doorEars)
Object.assign(KEPT.ROOMFIGHT, { doorEars: null, doorLookSecs: [1, 8, 0.5] });
