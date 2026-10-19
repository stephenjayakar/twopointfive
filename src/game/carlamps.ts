// A PARKED VEHICLE'S LAMPS CAN BE SHOT OUT (the maintainer, from a play test: "taillights in cars should be able to be shot up, and headlights and all that").
// Every level file has its cars and pickups as plain boxes: the car's tail lamps glow and are in no switchable; every head lamp, and every lamp of a pickup, a
// van or the lorry, is a dead lens that glows not at all. None of them was a light target, so a round did nothing to one and the reticle never took one.
//
// WHAT THIS DOES, with the switch up: when the Game is built (game.ts, beside the level's switchables) each lamp box found in the level becomes a light target
// of its own — kind 'emissive', group 'vehicle', off the mains, no contactor stagger (so no die is drawn for it), and no area light stood in for it (the
// picture of an unbroken lamp is the picture as it was). A glowing tail lamp is ON and dies like any fixture: the glow goes, the glass comes down, a man with a
// line to it saw a light go out. A dead lens is OFF, and still glass: a round that meets it breaks it (combat.ts asks `lampGlass`), with the glass and the
// sound and no light event — nothing went out. A broken lamp's box is painted dark (updateTargets calls `carLampPaint`), and unpainted when a load or a
// restart finds it whole again; the paint follows the target's own `broken` bit, which a checkpoint already keeps by name, and the level's own paint rides
// on the target (`lens`), so this module keeps no state a save or a snapshot would need.
//
// HOW A LAMP IS FOUND: the level files carry no name for one, so by what the generators write (scene/officeGen.ts and scene/levelKit.ts car, scene/gwotKit.ts
// pickup and van, the pass's lorry): its half size, its paint or its glow, and its twin the same height and yaw across the vehicle's width. tools/qa/
// carlamps-check.ts counts what every level file gives and fails on a vehicle whose lamps are not found, so a generator that moves a lamp is caught there.
//
// The switch is read ONCE, when the Game is built: a recording from before the table has it put down before its level is stood up (replay/engineplay.ts and
// tools/qa/rerun.ts `tables`), and the debugger's row reloads the page with the word on the address.
// ONE switch, CARLAMPS.on: ON in the page (`?carlamps=0` = as it was), OFF in the module and on the frozen harness stand (`TPS_CARLAMPS=1`); a FROZEN_HOLDS
// row, in the knob registry and a journal's tables (a recording from before the table replays with none). Off = no target, no row, no box touched: the build
// as it was by run digest. On, a checkpoint from before the switch is refused as another floor's (the count of light targets is part of a save's key).
// Nothing here has been seen on a GPU.
import type { Vec3 } from '../math/vec';
import type { Box } from '../scene/boxes';
import { GWOT_PALETTE } from '../scene/gwotPalette';
import type { Game, LightTarget } from './game';

export const CARLAMPS = {
  /** the switch */
  on: false,
  /** the paint of a broken lamp: what is left of the lens */
  dark: [0.035, 0.035, 0.04] as Vec3,
  /** how far a lamp's half size or its twin's place may sit from what the generators write, in metres, and its paint or glow per channel */
  fit: 0.004, tone: 0.004, twin: 0.03,
};
export const CARLAMPS_STATS = { found: 0, head: 0, tail: 0, lit: 0, shot: 0, painted: 0 };

export const VEHICLE_GROUP = 'vehicle';
interface LampSig { what: 'head lamp' | 'tail lamp'; h: Vec3; albedo?: Vec3; emissive?: Vec3; /** centre to centre across the vehicle */ gap: number; }
/** what each generator writes for a lamp (built on demand: nothing here is read at module load) */
function sigs(): LampSig[] {
  const white = GWOT_PALETTE.plasticWhite, red = GWOT_PALETTE.truckRed;
  return [
    { what: 'tail lamp', h: [0.02, 0.06, 0.16], emissive: [0.5, 0.03, 0.02], gap: 1.24 },   // the car (officeGen.ts, levelKit.ts)
    { what: 'head lamp', h: [0.02, 0.07, 0.14], albedo: [0.8, 0.8, 0.75], gap: 1.24 },
    { what: 'head lamp', h: [0.03, 0.07, 0.16], albedo: white, gap: 1.32 },                  // the pickup and the van (gwotKit.ts)
    { what: 'tail lamp', h: [0.03, 0.08, 0.1], albedo: red, gap: 1.44 },                     // the pickup
    { what: 'tail lamp', h: [0.02, 0.15, 0.04], albedo: red, gap: 1.72 },                    // the van
    { what: 'head lamp', h: [0.02, 0.08, 0.1], albedo: white, gap: 1.4 },                    // the pass's lorry
  ];
}
const near3 = (a: ArrayLike<number>, b: ArrayLike<number>, eps: number) => Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps && Math.abs(a[2] - b[2]) <= eps;
const glows = (b: Box) => b.emissive[0] > 0 || b.emissive[1] > 0 || b.emissive[2] > 0;
function fits(b: Box, s: LampSig): boolean {
  if (b.rot || !near3(b.h, s.h, CARLAMPS.fit)) return false;
  if (s.emissive) return near3(b.emissive, s.emissive, CARLAMPS.tone);
  return !glows(b) && near3(b.albedo, s.albedo!, CARLAMPS.tone);
}

export interface FoundLamp { box: number; what: LampSig['what']; lit: boolean; }
/** the lamp boxes of a level's vehicles, in box order: each fits one generator's lamp and has its twin across the vehicle */
export function findCarLamps(boxes: readonly Box[]): FoundLamp[] {
  const S = sigs(), cand: { i: number; s: number }[] = [];
  for (let i = 0; i < boxes.length; i++) { const s = S.findIndex(x => fits(boxes[i], x)); if (s >= 0) cand.push({ i, s }); }
  const out: FoundLamp[] = [];
  for (const a of cand) {
    const A = boxes[a.i], s = S[a.s];
    const twin = cand.some(b => b.i !== a.i && b.s === a.s && Math.abs(boxes[b.i].c[1] - A.c[1]) <= CARLAMPS.twin && Math.abs(boxes[b.i].yaw - A.yaw) <= 1e-3
      && Math.abs(Math.hypot(boxes[b.i].c[0] - A.c[0], boxes[b.i].c[2] - A.c[2]) - s.gap) <= CARLAMPS.twin);
    if (twin) out.push({ box: a.i, what: s.what, lit: !!s.emissive });
  }
  return out;
}

/** the light targets of a level's vehicle lamps (game.ts pushes them after the level's switchables; nothing with the switch down) */
export function carLampTargets(boxes: readonly Box[]): LightTarget[] {
  const T = CARLAMPS_STATS; T.found = T.head = T.tail = T.lit = 0;
  if (!CARLAMPS.on) return [];
  const n = { 'head lamp': 0, 'tail lamp': 0 };
  return findCarLamps(boxes).map(l => {
    const b = boxes[l.box]; T.found++; if (l.what === 'head lamp') T.head++; else T.tail++; if (l.lit) T.lit++;
    return { name: `${l.what} ${++n[l.what]}`, group: VEHICLE_GROUP, kind: 'emissive', pos: [b.c[0], b.c[1], b.c[2]], boxes: [l.box], baseEmissive: [b.emissive[0], b.emissive[1], b.emissive[2]], baseIntensity: 0,
      on: l.lit, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: l.lit ? 1 : 0, mains: false, interactive: true, stagger: 0, lens: [b.albedo[0], b.albedo[1], b.albedo[2]] } as LightTarget;
  });
}

/** A RECORDING'S TABLES, before its level is stood up (replay/engineplay.ts and tools/qa/rerun.ts `tables`): one from before this table is played on a floor
 *  with no lamp a target, as it was recorded — journal.ts applyKnobs says the same afterwards, too late for the Game's own list */
export function carLampsTape(tables: Record<string, unknown>) { const t = tables.CARLAMPS; if (t === null || typeof t !== 'object') CARLAMPS.on = false; }

/** a vehicle's lamp: glass a round breaks whether it burns or not (combat.ts: an unlit fixture is otherwise nothing to a round) */
export const lampGlass = (t: LightTarget): boolean => t.group === VEHICLE_GROUP;
/** …and one that was dark already: breaking it puts no light out (lighting.ts lightEvent says nothing for it; combat.ts gives it no arc) */
export const deadLamp = (t: LightTarget): boolean => t.group === VEHICLE_GROUP && !(t.baseEmissive[0] > 0 || t.baseEmissive[1] > 0 || t.baseEmissive[2] > 0);

/** a broken lamp's box painted dark, a whole one as the level has it (`lens`, kept on the target when it was made) — every frame from updateTargets' own pass
 *  over the targets, so a load, a restart or a step back in time is followed without being told, and nothing is kept here that a save or a snapshot would
 *  need. Not asked of the switch: a Game stood up with it down has no lamp to paint, and one stood up with it up keeps its lamps whatever the table says later. */
export function carLampPaint(g: Game, t: LightTarget) {
  const b = g.engine.world.statics[t.boxes[0]]; if (!b || !t.lens) return;
  const want = t.broken ? CARLAMPS.dark : t.lens;
  if (!near3(b.albedo, want, 0)) { b.albedo = [want[0], want[1], want[2]]; if (t.broken) CARLAMPS_STATS.painted++; }
}
