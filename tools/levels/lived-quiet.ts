// LIVED-IN ROOMS for the two quiet levels played as two (tools/levels/crossing.ts, tools/levels/quiet-relay.ts): the small pen their `furnish()` steps draw with.
// Everything it adds is a LIVED thing (src/scene/lived.ts): a box in the editor group `lived.<room>`, a loose prop named `lived.<room>.<what>` — left out by the
// loader with the switch off, so off is the level as it was. The contract: rebuild/play-style-levels/rooms/read-first.md.
// Rules it keeps for its callers: paint only from the GWOT kit's palette (the simulation reads paint; these two levels have no second look file), NO light and
// no emissive box (the hiding dark is the level), no Math.random (a piece is what its arguments say). What it cannot keep for them — off every door's line,
// every authored point and every patrol leg — tools/qa/lived-check.ts holds.
// SOLID vs DRAWN: `s()` is a real box (feet, rounds, eyes and the nav grid meet it once it stands over 0.25 m); `d()` is drawn only (BoxFlag.NoShadow: paint on
// a floor, a thing hung on a wall, paper on a table). A floor piece is `mat()` / `line()`: drawn only, a hair over the level's own ground slabs and rugs.
import type { Vec3 } from '../../src/math/vec';
import type { Box } from '../../src/scene/boxes';
import { BoxFlag } from '../../src/scene/boxes';
import type { PropDef, PropKind, PropPart } from '../../src/scene/level';
import type { GwotMat } from '../../src/scene/gwotKit';

type Mat = { albedo: Vec3; rough: number; metal?: boolean };
export interface LivedHost {
  grp(name: string): void;
  add(b: Partial<Box> & { c: Vec3; h: Vec3 }): number;
  prop(kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]): PropDef;
}
const NS = BoxFlag.NoShadow, Q = Math.PI / 4;

export function livedQuiet(K: LivedHost, M: Record<GwotMat, Mat>) {
  let room = ''; const names = new Set<string>();
  const put = (x: number, z: number, y0: number, y1: number, hx: number, hz: number, m: GwotMat, yaw: number, flags: number) => {
    if (!room) throw new Error(`lived-quiet: a box at (${x}, ${z}) before room() — it would land in a group that is not lived`);
    return K.add({ c: [x, (y0 + y1) / 2, z], h: [hx, (y1 - y0) / 2, hz], yaw, albedo: M[m].albedo, rough: M[m].rough, ...(M[m].metal ? { metal: true } : {}), ...(flags ? { flags } : {}) });
  };
  // The two bands only one of body and nav grid sees (tools/qa/lived-check.ts holds them on the built floor; here they are refused as the piece is written):
  // R1 a top in [0.20, 0.25) m stops a body on floor the grid calls free; R2 an underside in [1.50, 1.70) m stops a standing player where every guard walks under.
  const solid = (x: number, z: number, y0: number, y1: number, hx: number, hz: number, m: GwotMat, yaw: number, stood: boolean) => {
    const E = 1e-9, at = `the solid at (${x}, ${z}) y ${y0}‥${y1} of lived.${room}`;
    if (y1 >= 0.2 - E && y1 < 0.25 - E) throw new Error(`lived-quiet: ${at} tops out between 0.20 and 0.25 m (make it 0.19 or under, or 0.25 or over, or draw it with d())`);
    if (!stood && y0 >= 1.5 - E && y0 < 1.7 - E) throw new Error(`lived-quiet: ${at} has its underside between 1.50 and 1.70 m (draw it with d(), or — stood on furniture that shuts the floor under it — use on())`);
    return put(x, z, y0, y1, hx, hz, m, yaw, 0);
  };
  /** a SOLID box: centre (x, z), from y0 up to y1, half extents hx × hz */
  const s = (x: number, z: number, y0: number, y1: number, hx: number, hz: number, m: GwotMat, yaw = 0) => solid(x, z, y0, y1, hx, hz, m, yaw, false);
  /** a SOLID box STOOD ON FURNITURE that already shuts the floor under it (ledgers on a shelf's top board): R2 is not asked here — lived-check still asks it of the built floor */
  const on = (x: number, z: number, y0: number, y1: number, hx: number, hz: number, m: GwotMat, yaw = 0) => solid(x, z, y0, y1, hx, hz, m, yaw, true);
  /** a DRAWN-ONLY box (no shadow, no foot, no round) */
  const d = (x: number, z: number, y0: number, y1: number, hx: number, hz: number, m: GwotMat, yaw = 0) => put(x, z, y0, y1, hx, hz, m, yaw, NS);
  /** a FLOOR PIECE w × d (a mat, a stain, a painted panel) */
  const mat = (x: number, z: number, w: number, dd: number, m: GwotMat, yaw = 0, y = 0.016) => put(x, z, y, y + 0.012, w / 2, dd / 2, m, yaw, NS);
  /** a painted LINE on the ground from (x0, z0) to (x1, z1), `wid` wide */
  const line = (x0: number, z0: number, x1: number, z1: number, wid: number, m: GwotMat, y = 0.03) => {
    const L = Math.hypot(x1 - x0, z1 - z0) || 0.01; return put((x0 + x1) / 2, (z0 + z1) / 2, y, y + 0.004, L / 2, wid / 2, m, Math.atan2(-(z1 - z0), x1 - x0), NS);
  };
  /** a SMALL round thing (r under 0.2) as two squares 45° apart (the second a hair lower so the tops never fight). From 0.2 up use `oct`: seen from above two squares
   *  read as a cog. Only for a round standing on a FLOOR or a table — a disc on a wall's face is one flat `d()` */
  const rnd = (x: number, z: number, y0: number, y1: number, r: number, m: GwotMat, solid = true) => { const q = r * 0.93, f = solid ? s : d; f(x, z, y0, y1, q, q, m); f(x, z, y0, y1 - 0.004, q, q, m, Q); };
  /** a larger ROUND thing as an octagon (four slabs through the centre) */
  const oct = (x: number, z: number, y0: number, y1: number, r: number, m: GwotMat, solid = true) => { const a = r * 0.96, t = a * 0.4142, f = solid ? s : d; for (let k = 0; k < 4; k++) f(x, z, y0, y1 - 0.002 * k, a, t, m, k * Q); };
  /** PAPER lying on a surface whose top is at y */
  const paper = (x: number, z: number, y: number, yaw = 0, w = 0.3, dd = 0.21, m: GwotMat = 'whitewash') => d(x, z, y, y + 0.008, w / 2, dd / 2, m, yaw);
  /** a loose PROP of this room: named `lived.<room>.<what>` */
  const prop = (kind: PropKind, what: string, x: number, z: number, yaw: number, mass: number, parts: PropPart[]) => {
    if (!room) throw new Error(`lived-quiet: the prop '${what}' before room()`);
    const p = K.prop(kind, x, z, yaw, mass, parts), name = `lived.${room}.${what}`;
    if (names.has(name)) throw new Error(`two lived props named ${name}`); names.add(name); p.name = name; return p;
  };
  const part = (ox: number, y0: number, y1: number, oz: number, hx: number, hz: number, m: GwotMat, yaw = 0): PropPart => ({ off: [ox, (y0 + y1) / 2, oz], h: [hx, (y1 - y0) / 2, hz], yaw, albedo: M[m].albedo });
  /** PROP (bin): a pail / bucket, 0.28 across */
  const pail = (what: string, x: number, z: number, m: GwotMat = 'galv', fill: GwotMat | null = null) => prop('bin', what, x, z, 0, 2.5, [
    part(0, 0, 0.26, 0, 0.13, 0.13, m), part(0, 0, 0.256, 0, 0.13, 0.13, m, Q), ...(fill ? [part(0, 0.26, 0.275, 0, 0.11, 0.11, fill)] : []),
  ]);
  /** PROP (cardboard): a carton / case w × d × h with a band of another paint across its lid */
  const carton = (what: string, x: number, z: number, yaw: number, w: number, dd: number, h: number, m: GwotMat = 'coyote', band: GwotMat | null = 'sack', mass = 5) => prop('cardboard', what, x, z, yaw, mass, [
    part(0, 0, h, 0, w / 2, dd / 2, m), ...(band ? [part(0, h, h + 0.006, 0, w / 2 - 0.02, dd * 0.14, band)] : []),
  ]);
  /** PROP (chair): a three-legged wooden STOOL, 0.34 across */
  const stool = (what: string, x: number, z: number, yaw = 0, seat: GwotMat = 'poplar') => prop('chair', what, x, z, yaw, 3, [part(0, 0, 0.3, 0, 0.13, 0.13, 'woodGrey'), part(0, 0.3, 0.34, 0, 0.17, 0.17, seat)]);
  /** PROP (bin): a WHEEL CHOCK, a stepped wedge 0.24 long */
  const chock = (what: string, x: number, z: number, yaw = 0, m: GwotMat = 'prodYellow') => prop('bin', what, x, z, yaw, 1.5, [part(0, 0, 0.08, 0, 0.12, 0.08, m), part(-0.05, 0.08, 0.15, 0, 0.07, 0.08, m)]);
  /** PROP (bin): a loose TYRE lying flat (an octagon, 0.6 across), its rim showing */
  const tyre = (what: string, x: number, z: number, yaw = 0) => prop('bin', what, x, z, yaw, 9, [
    ...[0, 1, 2, 3].map(k => part(0, 0, 0.22 - 0.002 * k, 0, 0.288, 0.119, 'rubber', k * Q)), part(0, 0.1, 0.224, 0, 0.11, 0.11, 'galv'),
  ]);
  /** a kit PROP (a chair, a jerry can) taken into this room: renamed `lived.<room>.<what>` */
  const own = (p: PropDef, what: string) => { if (!room) throw new Error(`lived-quiet: the prop '${what}' before room()`); const name = `lived.${room}.${what}`; if (names.has(name)) throw new Error(`two lived props named ${name}`); names.add(name); p.name = name; return p; };
  return {
    /** everything that follows belongs to this place */
    room(id: string) { room = id; K.grp(`lived.${id}`); },
    s, on, d, mat, line, rnd, oct, paper, prop, part, pail, carton, stool, chock, tyre, own,
    /** a mug / glass / tin standing on a surface at y */
    mug: (x: number, z: number, y: number, m: GwotMat = 'whitewash', r = 0.04, h = 0.1) => s(x, z, y, y + h, r, r, m),
    /** a BENCH: a plank `len` long on two block feet (seat at 0.44) */
    bench(x: number, z: number, len: number, alongX: boolean, top: GwotMat = 'poplar', foot: GwotMat = 'block') {
      const hx = alongX ? len / 2 : 0.16, hz = alongX ? 0.16 : len / 2;
      s(x, z, 0.38, 0.44, hx, hz, top);
      for (const e of [-1, 1]) s(x + (alongX ? e * (len / 2 - 0.2) : 0), z + (alongX ? 0 : e * (len / 2 - 0.2)), 0, 0.38, alongX ? 0.1 : 0.14, alongX ? 0.14 : 0.1, foot);
    },
    /** an open-backed SHELF UNIT against a wall: two ends, `boards` boards, top at `h`; returns each board's top y (lowest first) */
    shelf(x: number, z: number, len: number, depth: number, h: number, alongX: boolean, boards = 3, frame: GwotMat = 'galv', board: GwotMat = 'woodGrey'): number[] {
      const hx = alongX ? len / 2 : depth / 2, hz = alongX ? depth / 2 : len / 2, ys: number[] = [];
      for (const e of [-1, 1]) s(x + (alongX ? e * (len / 2 - 0.02) : 0), z + (alongX ? 0 : e * (len / 2 - 0.02)), 0, h, alongX ? 0.02 : hx, alongX ? hz : 0.02, frame);
      for (let k = 0; k < boards; k++) { const y = boards === 1 ? h : 0.3 + (h - 0.3) * k / (boards - 1); s(x, z, y - 0.03, y, hx - (alongX ? 0.04 : 0), hz - (alongX ? 0 : 0.04), board); ys.push(y); }
      return ys;
    },
  };
}
export type LivedQuiet = ReturnType<typeof livedQuiet>;
