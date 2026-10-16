// THE DOOR SIZE RULE: every doorway in every level is one real door.
//
// A real office or outside door stands in a hole about 0.9 m wide and 2.05 m tall. The levels were drawn with 1.2 m by 2.2 m doorways (and a few 1.1 m ones): a
// third wider than life. The generators still WRITE those: `{ a, b: a + 1.2 }` in a wall, a leaf `width: 1.16` hung 2 cm inside it — a door SLOT. The kits' wall
// and door-frame functions (officeGen.ts officeKit, levelKit.ts) pass every slot through this file, which hangs a real door INSIDE it and leaves the rest of the
// slot as wall. So the size is one number here, every level takes it by being exported again, and nothing a generator placed beside a door can end up in one: a
// doorway only ever shrinks, within the slot it was drawn in.
//
// WHERE in its slot the door goes is the walk grid's call. The nav bake (collision.ts NavGrid) asks of each half-metre cell's CENTRE whether a man has 0.34 m of
// air round it, and every path is laid through cell centres. Between the stops of a 0.9 m door there are 0.83 m: a cell centre standing in the frame is free
// only within 7 cm of the middle. So the door is slid along its slot until its middle stands ON a cell centre: a 1.2 m slot has 0.3 m to slide and the centres
// are 0.5 m apart, so most slots reach one inside themselves; one that cannot (drawn 0.4 m past a cell edge) lets its door stand up to `reach` outside it, into
// wall the generator drew solid — the kits' walls refuse that where it would meet the next opening or the wall's end (move the slot then). The men walk through
// the exact middle of the frame, a hand's width of air on each shoulder, by the paths they always took.
import type { LevelDoorDef } from './level';

export const DOOR_SIZE = {
  /** the hole in the wall, metres along it (the leaf is 4 cm less: 2 cm of jamb face each side) */
  gap: 0.9,
  /** the hole's height (the leaf is 4 cm less) */
  head: 2.05,
  /** a doorway drawn wider than this is not a door slot (an arch, a gate, a shutter): it is left as drawn */
  slotMax: 1.3,
  /** the walk grid's cell (collision.ts NavGrid.cell) */
  cell: 0.5,
  /** how far outside its slot a door may stand to put its middle on a cell centre */
  reach: 0.1,
};
/** what the frame takes of the hole: the leaf's hinge line stands this far inside the hole's start, its tip this far short of the end */
export const JAMB_FACE = 0.02;
export const DOOR_GAP = DOOR_SIZE.gap, LEAF_W = DOOR_SIZE.gap - 2 * JAMB_FACE, DOOR_HEAD = DOOR_SIZE.head, LEAF_H = DOOR_SIZE.head - 0.04;

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** is a hole `w` metres wide a door slot — wider than a real door, no wider than a drawn one? */
export const isDoorSlot = (w: number) => w > DOOR_SIZE.gap + 0.01 && w <= DOOR_SIZE.slotMax + 1e-6;

/** The real doorway for the slot a‥b (b − a a door slot's width): [start, end] along the wall. Its middle is put on a walk-grid cell centre: one it reaches
 *  without leaving the slot if there is one (of two, the nearer the slot's middle), else the one it reaches by standing least outside it. */
export function fitSlot(a: number, b: number): [number, number] {
  const G = DOOR_SIZE.gap, cell = DOOR_SIZE.cell;
  if (!isDoorSlot(b - a)) return [a, b];
  const lo = a + G / 2 - DOOR_SIZE.reach, hi = b - G / 2 + DOOR_SIZE.reach, mid = (a + b) / 2;   // where the door's middle may stand
  let best = NaN, bestD = Infinity;
  for (let k = Math.floor(lo / cell) - 1; k <= Math.ceil(hi / cell) + 1; k++) {
    const c = (k + 0.5) * cell, at = Math.min(hi, Math.max(lo, c));    // the nearest the middle can come to this centre
    const out = Math.max(0, a - (at - G / 2), at + G / 2 - b);         // how far the door would stand outside its slot
    const d = Math.abs(c - at) * 1000 + r4(out) * 10 + Math.abs(at - mid);   // on a centre first; then inside the slot; then nearest its middle (ties: the higher — a slot drawn across a cell edge has two centres as near; of the levels' 53 such slots the higher is the one that stands clear of what was put beside them, door-size.ts walks every one)
    if (d < bestD + 1e-9) { bestD = d; best = at; }
  }
  return [r4(best - G / 2), r4(best + G / 2)];
}

/** what the kits' walls read of an opening */
type Hole = { a: number; b: number; y0?: number; y1?: number; mullions?: number; glass?: unknown };
const isSlotHole = (o: Hole) => (o.y0 ?? 0) === 0 && (o.y1 ?? 2.2) <= 2.3 && !o.mullions && !o.glass && isDoorSlot(o.b - o.a);
/** A wall's opening as it is cut: a door slot (from the floor, a door's height, bare) becomes the real doorway for it; anything else is returned as given. */
export function fitOpening<T extends Hole>(o: T): T {
  if (!isSlotHole(o)) return o;
  const [a, b] = fitSlot(o.a, o.b);
  return { ...o, a, b, y1: Math.min(o.y1 ?? 2.2, DOOR_SIZE.head) };
}
/** A wall's openings as they are cut, in order along it (the wall runs lo‥hi): fitOpening of each. Throws where a door standing outside its slot would run
 *  into the opening beside it or off the wall's end — the leaf (fitDoorDef) cannot know its neighbours, so the hole may not quietly differ from it. */
export function fitOpenings<T extends Hole>(openings: T[], lo: number, hi: number): T[] {
  const ops = openings.map(fitOpening).sort((p, q) => p.a - q.a);
  ops.forEach((o, i) => { if (o.a < (i ? ops[i - 1].b : lo) - 1e-6 || o.b > (i + 1 < ops.length ? ops[i + 1].a : hi) + 1e-6) throw new Error(`doorSize: the doorway ${o.a}‥${o.b} cut for a door slot on the wall ${lo}‥${hi} runs into what is beside it — move the slot so its door reaches a walk-grid cell centre inside it`); });
  return ops;
}

/** A leaf drawn for a door slot (hinge 2 cm inside its start, as wide as the slot less the jamb faces) becomes the real leaf in the real doorway — the same
 *  doorway fitOpening cuts for the same slot. Changes `d` in place (hinge, width) and returns it; a leaf that is already real, wider than a slot, or hung off
 *  the axes is left alone. */
export function fitDoorDef<T extends Pick<LevelDoorDef, 'hinge' | 'closedDir' | 'width'>>(d: T): T {
  const cs = Math.cos(d.closedDir), sn = Math.sin(d.closedDir);
  const alongX = Math.abs(sn) < 1e-3, alongZ = Math.abs(cs) < 1e-3; if (!alongX && !alongZ) return d;
  const i = alongX ? 0 : 1, fwd = (alongX ? cs : sn) > 0, h = d.hinge[i], w = d.width + 2 * JAMB_FACE;
  const a0 = fwd ? h - JAMB_FACE : h + JAMB_FACE - w; if (!isDoorSlot(w)) return d;
  const [a, b] = fitSlot(r4(a0), r4(a0 + w));
  d.hinge = alongX ? [fwd ? r4(a + JAMB_FACE) : r4(b - JAMB_FACE), d.hinge[1]] : [d.hinge[0], fwd ? r4(a + JAMB_FACE) : r4(b - JAMB_FACE)];
  d.width = r4(b - a - 2 * JAMB_FACE);
  return d;
}
/** every leaf of a level, fitted (a generator may frame a COPY of a def — a thick frame for a door that is not an outside door — so the exporters run this
 *  over the level's own list; fitting twice changes nothing) */
export const fitDoors = <T extends Pick<LevelDoorDef, 'hinge' | 'closedDir' | 'width'>>(doors: T[]): T[] => { for (const d of doors) fitDoorDef(d); return doors; };

/** A WAY OUT THAT NAMES A DOOR goes through that door: a point drawn on a door slot's middle line (a quiet level's exit, a mission's exfil) is slid ALONG the wall
 *  onto the fitted leaf's middle line, its distance out from the wall kept — else the floor a stride short of it can be the new piece of wall beside the frame.
 *  A point further along the wall than a slot reaches from the leaf's middle was not drawn for this door: left alone. */
export function exitThrough(d: Pick<LevelDoorDef, 'hinge' | 'closedDir' | 'width'>, x: number, z: number): [number, number] {
  const cs = Math.cos(d.closedDir), sn = Math.sin(d.closedDir), along = (x - d.hinge[0]) * cs + (z - d.hinge[1]) * sn - d.width / 2;
  return Math.abs(along) > DOOR_SIZE.slotMax / 2 ? [x, z] : [r4(x - along * cs), r4(z - along * sn)];
}
/** a generated level's ways out (its mission's exfil, its quiet block's exits) put through their fitted doors — the exporters call it after fitDoors */
export function fitWaysOut(level: { doors: LevelDoorDef[]; mission?: { exfilDoor: string; exfilX: number; exfilZ: number } }, quiet?: { exits?: { door?: string; x: number; z: number }[] } | null): void {
  const door = (n?: string) => level.doors.find(d => d.name === n);
  const M = level.mission as { exfilDoor: string; exfilX: number; exfilZ: number; exfilOut?: [number, number] } | undefined, md = M && door(M.exfilDoor);
  if (M && md) { const [x, z] = exitThrough(md, M.exfilX, M.exfilZ); M.exfilZ = z; if (M.exfilOut) M.exfilX = x; }   // (an exit that does not say which way is out faces east — mission.ts outNow: its x is the LINE he must be past, never a point on a wall, so only its place along a north-south wall follows the door)
  for (const X of quiet?.exits ?? []) { const d = door(X.door); if (d) [X.x, X.z] = exitThrough(d, X.x, X.z); }
}

/** Where a leaf's hinge goes so a man can walk through the door it hangs: slid along the leaf's own line until the leaf's middle stands on the nearest walk-grid
 *  cell centre (the level editor's door tool — a real doorway has 7 cm of play about a centre, so a hinge on a whole or half metre is a door no path goes
 *  through). A leaf off the axes is returned as given. */
export function hingeOnCell(hinge: [number, number], closedDir: number, width: number): [number, number] {
  const cs = Math.cos(closedDir), sn = Math.sin(closedDir); if (Math.abs(cs) > 1e-3 && Math.abs(sn) > 1e-3) return hinge;
  const i = Math.abs(sn) < 1e-3 ? 0 : 1, u = i ? sn : cs, mid = hinge[i] + u * width / 2, at = (Math.floor(mid / DOOR_SIZE.cell) + 0.5) * DOOR_SIZE.cell;
  const out: [number, number] = [hinge[0], hinge[1]]; out[i] = r4(at - u * width / 2); return out;
}
