// LIVED-IN ROOMS, the loud levels' shared pieces (src/scene/lived.ts; the yardstick is the office: every room a use you can name from above, furniture only it
// has, clutter that tells of use, its own floor, something to shove or break). What compound.ts, warehouse.ts, barracks.ts and depot.ts build their rooms' lived
// things with, on top of the office's kit: boxes only, flat colours, no light and nothing lit (these levels stand at the frame's light budget with a full squad).
//   const L = livedKit(K);  L.room('crew');  L.table(...);  L.stool(...);      ← call AFTER everything else the generator adds: lived things are the TAIL of
//                                                                                the boxes and of the props (tools/levels/export.ts throws otherwise)
// `room(id)` names the editor group of the boxes that follow ('lived.<id>') and the props' ids ('lived.<id>.<what><n>'): the loader leaves both out with the
// switch off. PAINT IS READ BY THE SIMULATION (game/furnblast.ts breakClassOf, particleFx.ts): wood / woodDark break as wood, cardboard as board, metal / red as
// steel, chair / plant as soft things, an unnamed colour as a steel machine — so a piece wears the palette paint of what it is made of where there is one.
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag } from '../../src/scene/boxes';
import { OFFICE_PALETTE, type officeKit } from '../../src/scene/officeGen';

type Kit = ReturnType<typeof officeKit>;
const C = OFFICE_PALETTE as Record<string, Vec3>;
/** paints of the lived things that the office's palette has no name for (unnamed = a steel thing to a blast; none is a plain mid grey, so the look leaves them be) */
export const LIVED_PAINT = {
  oliveDrab: [0.24, 0.235, 0.14] as Vec3,      // army paint (red ≥ green on purpose: the look reads a green low box as a blanket)
  oxide: [0.42, 0.15, 0.1] as Vec3,            // red oxide primer: drums, girders
  rubberMat: [0.07, 0.08, 0.075] as Vec3,
  oilDark: [0.06, 0.058, 0.055] as Vec3,
  canvas: [0.44, 0.39, 0.27] as Vec3,
  enamelBlue: [0.12, 0.25, 0.5] as Vec3,
  brass: [0.6, 0.47, 0.16] as Vec3,
  hiVis: [0.85, 0.36, 0.05] as Vec3,
  paper: [0.86, 0.86, 0.82] as Vec3,
};
const NS = BoxFlag.NoShadow;

export function livedKit(K: Kit) {
  const { frameAt, prop } = K;
  let room = '';
  const serials = new Map<string, number>();
  const add: Kit['add'] = b => { if (!room) throw new Error('livedKit: a lived piece before the first room()'); return K.add(b); };
  /** every box and prop after this call is `id`'s (the editor group 'lived.<id>', the props' ids 'lived.<id>.…'). Nothing but lived things may follow the first call */
  const roomOf = (id: string) => { room = id; K.grp(`lived.${id}`); };
  /** name the prop just made as one of this room's lived things ('lived.<room>.<what><n>', n counted per room and kind of thing: an edit in one room renames nothing in another) */
  const own = (what: string) => {
    const p = K.props[K.props.length - 1]; if (!room) throw new Error('livedKit: own() before the first room()');
    if (!p || p.name.startsWith('lived.')) throw new Error(`livedKit: own('${what}') has no new prop to name (a carton stacked onto an older one makes none)`);
    const key = `lived.${room}.${what}`, n = serials.get(key) ?? 0; serials.set(key, n + 1); p.name = `${key}${n}`; return p;
  };

  // ---- the floor: drawn-only slabs from the floor up (no ray, no foot and no round meets one). `top` over the look's own ground marks (15 mm), so neither flickers;
  // the look's RUGS lie at 24 mm and are dealt as if no lived thing were there: a lived floor piece stays off a look rug's rectangle (read them off <name>-gwot.json)
  const placed = () => { if (!room) throw new Error('livedKit: a lived piece before the first room()'); };
  const mat = (x0: number, z0: number, x1: number, z1: number, albedo: Vec3, top = 0.022) => { placed(); return K.slab(x0, 0, z0, x1, top, z1, albedo, { flags: NS }); };
  /** a duckboard: a dark base and pale slats across its short side */
  const duckboard = (x0: number, z0: number, x1: number, z1: number, n = 4) => {
    mat(x0, z0, x1, z1, C.woodDark, 0.03); const alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0;
    for (let k = 0; k < n; k++) { const u = (k + 0.5) / n * L; if (alongX) K.slab(x0 + u - L / n * 0.3, 0, z0 + 0.03, x0 + u + L / n * 0.3, 0.04, z1 - 0.03, C.wood, { flags: NS }); else K.slab(x0 + 0.03, 0, z0 + u - L / n * 0.3, x1 - 0.03, 0.04, z0 + u + L / n * 0.3, C.wood, { flags: NS }); }
  };

  // ---- furniture (static)
  const quarter = (yaw: number) => Math.abs(Math.abs(Math.sin(yaw)) - 1) < 1e-9;
  /** a trestle table: a top on two end frames (rays and rounds pass under it: it stops feet, not fire) */
  const table = (x: number, z: number, w: number, d: number, yaw = 0, top: Vec3 = C.wood, h = 0.74, legs: Vec3 = C.metal) => {
    const at = frameAt(x, z, yaw), q = quarter(yaw), y = q ? 0 : yaw;   // (a quarter turn is written unturned, its halves swapped: axis-aligned boxes, which is what they are)
    add({ c: at(0, h - 0.02, 0), h: q ? [d / 2, 0.02, w / 2] : [w / 2, 0.02, d / 2], yaw: y, albedo: top });
    for (const s of [-1, 1]) add({ c: at(s * (w / 2 - 0.08), (h - 0.04) / 2, 0), h: q ? [d / 2 - 0.05, (h - 0.04) / 2, 0.03] : [0.03, (h - 0.04) / 2, d / 2 - 0.05], yaw: y, albedo: legs });
    return h;
  };
  /** a wooden crate with two battens on its lid (a solid block: cover to its height) */
  const crate = (x: number, z: number, w: number, d: number, h: number, yaw = 0, albedo: Vec3 = C.wood, y = 0) => {
    const at = frameAt(x, z, yaw);
    add({ c: at(0, y + h / 2, 0), h: [w / 2, h / 2, d / 2], yaw, albedo });
    for (const s of [-1, 1]) add({ c: at(s * w * 0.3, y + h + 0.012, 0), h: [0.04, 0.012, d / 2], yaw, albedo: C.woodDark });
  };
  /** a stack of n tyres (0.2 m each), each turned 0.1 rad on the one below, the top one's well a drawn dark square. A layer turned θ reaches r·(cos θ + sin θ)
   *  along a wall: a four-high stack (0.3 rad at the top) 8.5 cm past r, so keep the centre r + 0.1 off a wall. Stacks side by side: give them the SAME yaw and
   *  0.72 m between centres at r 0.34 (turned differently they bite into each other until 0.77 m).
   *  One lying alone is a fat one, 0.27 m: a solid topping out between 0.20 and 0.25 m stops a body on a cell the nav grid calls free */
  const tyres = (x: number, z: number, n: number, yaw = 0, r = 0.34) => {
    const t = n === 1 ? 0.27 : 0.2;
    for (let k = 0; k < n; k++) add({ c: [x, t / 2 + t * k, z], h: [r, t / 2, r], yaw: yaw + k * 0.1, albedo: C.black });
    add({ c: [x, t * n + 0.004, z], h: [r * 0.5, 0.004, r * 0.5], yaw: yaw + (n - 1) * 0.1, albedo: [0.2, 0.2, 0.19], flags: NS });
  };
  /** a row of n jerry cans along local X, standing */
  const jerryCans = (x: number, z: number, n: number, yaw = 0, albedo: Vec3 = LIVED_PAINT.oliveDrab, y = 0) => {
    const at = frameAt(x, z, yaw), q = quarter(yaw);
    for (let k = 0; k < n; k++) add({ c: at((k - (n - 1) / 2) * 0.2, y + 0.235, 0), h: q ? [0.17, 0.235, 0.08] : [0.08, 0.235, 0.17], yaw: q ? 0 : yaw, albedo });
  };
  /** a drum standing where it is (static; `drum` is the one a man can shove) */
  const drumFixed = (x: number, z: number, albedo: Vec3 = LIVED_PAINT.oxide, y = 0) => {
    add({ c: [x, y + 0.44, z], h: [0.28, 0.44, 0.28], yaw: 0.3, albedo });
    add({ c: [x, y + 0.886, z], h: [0.23, 0.006, 0.23], yaw: 0.3, albedo: [albedo[0] * 0.6, albedo[1] * 0.6, albedo[2] * 0.6], flags: NS });
  };
  /** a thing hung on a wall (drawn only: a coat, a board, a hose): `alongX` = on a wall that runs along X, at the wall's face `x, z` */
  const hung = (x: number, z: number, alongX: boolean, w: number, y0: number, y1: number, albedo: Vec3, t = 0.04) =>
    add({ c: [x, (y0 + y1) / 2, z], h: alongX ? [w / 2, (y1 - y0) / 2, t / 2] : [t / 2, (y1 - y0) / 2, w / 2], albedo, flags: NS });

  // ---- clutter (on a surface at height y): small boxes a firefight knocks off, paper it scatters
  const thing = (x: number, y: number, z: number, hx: number, hy: number, hz: number, albedo: Vec3, yaw = 0) => add({ c: [x, y + hy, z], h: [hx, hy, hz], yaw, albedo });
  const mug = (x: number, y: number, z: number, albedo: Vec3 = C.white) => thing(x, y, z, 0.035, 0.045, 0.035, albedo);
  const papers = (x: number, y: number, z: number, yaw = 0) => { placed(); return K.papers(x, y, z, yaw); };
  /** one loose sheet (a card, a form, a map corner) */
  const sheet = (x: number, y: number, z: number, w = 0.21, d = 0.3, yaw = 0, albedo: Vec3 = LIVED_PAINT.paper) => add({ c: [x, y + 0.004, z], h: [w / 2, 0.004, d / 2], yaw, albedo, flags: NS });

  // ---- loose things (the physics layer's: a man shoves them, a blast throws them). Kinds are the game's four: chair (cloth), cardboard, bin (metal), plant.
  // The kind is the thing's sound, slide and debris; the look paints every part of a chair one cloth colour and of a bin one drum colour. A loose thing must
  // start clear of every solid (the props' settle pass shoves an overlapping one out)
  const stool = (x: number, z: number, albedo: Vec3 = C.woodDark) => { prop('chair', x, z, 0, 5, [{ off: [0, 0.44, 0], h: [0.17, 0.025, 0.17], yaw: 0, albedo }, { off: [0, 0.21, 0], h: [0.12, 0.21, 0.12], yaw: 0.785, albedo: C.metal }]); return own('stool'); };
  const chair = (x: number, z: number, yaw: number, albedo: Vec3 = C.chair) => { K.chair(x, z, yaw, albedo); return own('chair'); };
  const drum = (x: number, z: number, albedo: Vec3 = LIVED_PAINT.oxide, mass = 22) => { prop('bin', x, z, 0.3, mass, [{ off: [0, 0.44, 0], h: [0.28, 0.44, 0.28], yaw: 0, albedo }, { off: [0, 0.886, 0], h: [0.23, 0.006, 0.23], yaw: 0, albedo: [albedo[0] * 0.6, albedo[1] * 0.6, albedo[2] * 0.6] }]); return own('drum'); };
  const bucket = (x: number, z: number, albedo: Vec3 = C.metal) => { prop('bin', x, z, 0.2, 2, [{ off: [0, 0.15, 0], h: [0.14, 0.15, 0.14], yaw: 0, albedo }]); return own('bucket'); };
  const cone = (x: number, z: number) => { prop('cardboard', x, z, 0, 1.5, [{ off: [0, 0.02, 0], h: [0.17, 0.02, 0.17], yaw: 0, albedo: C.black }, { off: [0, 0.24, 0], h: [0.09, 0.2, 0.09], yaw: 0, albedo: LIVED_PAINT.hiVis }, { off: [0, 0.5, 0], h: [0.045, 0.06, 0.045], yaw: 0, albedo: C.white }]); return own('cone'); };
  const carton = (x: number, z: number, s: number, yaw: number) => { K.cardboardBox(x, z, s, yaw); return own('carton'); };
  /** a small wooden box a man can shove (ammunition, spares, fruit) */
  const looseCrate = (x: number, z: number, w: number, d: number, h: number, yaw = 0, albedo: Vec3 = C.wood) => { prop('cardboard', x, z, yaw, 6 + 40 * w * d * h, [{ off: [0, h / 2, 0], h: [w / 2, h / 2, d / 2], yaw: 0, albedo }, { off: [0, h + 0.01, 0], h: [0.035, 0.01, d / 2], yaw: 0, albedo: C.woodDark }]); return own('crate'); };

  return { C, P: LIVED_PAINT, room: roomOf, own, mat, duckboard, table, crate, tyres, jerryCans, drumFixed, hung, thing, mug, papers, sheet, stool, chair, drum, bucket, cone, carton, looseCrate };
}
