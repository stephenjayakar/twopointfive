// FURNITURE FOR THE LIVED-IN ROOMS (src/scene/lived.ts) of records, the block, the registry and the consulate: pieces built from plain boxes, one function each,
// over whichever kit the generator uses (levelKit's k-first functions or officeKit's closures — a LivedHost adapts either).
//   const P = livedPieces({ add: b => K.add(k, b), grp: n => K.grp(k, n), prop: (...a) => K.prop(k, ...a) }, K.KIT_PALETTE);
//   P.room('staff'); P.table(26, 10.4, 1.8, 0.9, 0); …
// Every box a piece adds goes in the group 'lived.<room>' of the room last named with P.room(id); every loose prop is renamed 'lived.<room>.<thing><n>' — the two
// tags the loader drops with the switch off. A generator calls these LAST (after its last kept box, prop, light and fixture: tools/levels/export.ts holds the order).
// No lights, no emissive boxes, no dice but the hash of an index. Bodies wear the kit's palette (the simulation reads paint: game/particleFx.ts paletteName,
// game/furnblast.ts breakClassOf); the colours named here are accents only.
// A piece's FRONT is its local +Z and its back −Z (the wall side): yaw 0 = on a north wall facing south, π = on a south wall, π/2 = on a west wall facing east,
// −π/2 = on an east wall. Heights are metres off the floor. What the destruction finds by SHAPE (game/destruction.ts index): a pale thin NoShadow sheet with its
// longer half 0.08‥0.2 above 0.3 m is PAPER (flies); a small solid (half ≤ 0.17, ≤ 20 l) standing 0.7‥1.6 m up is CLUTTER (knocked off) — the pieces say which they make.
import type { Vec3 } from '../../src/math/vec';
import { BoxFlag, type Box } from '../../src/scene/boxes';
import type { PropDef, PropKind, PropPart } from '../../src/scene/level';

export interface LivedHost {
  add: (b: Partial<Box> & { c: Vec3; h: Vec3 }) => number;
  grp: (name: string) => void;
  prop: (kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]) => PropDef;
}
export interface LivedPalette { wood: Vec3; woodDark: Vec3; metal: Vec3; black: Vec3; white: Vec3; red: Vec3; cardboard: Vec3; chair: Vec3; plant: Vec3; screenOff: Vec3 }
/** accents (never a body: an unnamed paint breaks and sounds as metal) */
export const INK = {
  cream: [0.86, 0.84, 0.76] as Vec3, paper: [0.9, 0.89, 0.84] as Vec3, manila: [0.78, 0.66, 0.42] as Vec3, brass: [0.62, 0.48, 0.2] as Vec3, iron: [0.09, 0.09, 0.1] as Vec3,
  blueprint: [0.16, 0.3, 0.6] as Vec3, hivis: [0.9, 0.42, 0.06] as Vec3, yellow: [0.85, 0.68, 0.1] as Vec3, baize: [0.1, 0.3, 0.2] as Vec3, canvas: [0.55, 0.5, 0.38] as Vec3,
  oxblood: [0.32, 0.09, 0.07] as Vec3, navy: [0.08, 0.1, 0.3] as Vec3, bottle: [0.25, 0.45, 0.7] as Vec3, rubber: [0.06, 0.06, 0.065] as Vec3, copper: [0.6, 0.3, 0.15] as Vec3,
  tin: [0.05, 0.055, 0.06] as Vec3, enamel: [0.2, 0.36, 0.3] as Vec3,
};
/** a hash of an index in 0‥1 (the pieces' only dice) */
export const h01 = (n: number, s = 0): number => { let x = Math.imul((n + 1) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s + 1, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };
const tone = (c: Vec3, k: number): Vec3 => [c[0] * k, c[1] * k, c[2] * k];

export function livedPieces(H: LivedHost, C: LivedPalette) {
  let room = ''; const count = new Map<string, number>(); let n = 0;
  /** a builder in the frame of a piece standing at (x, z) with heading yaw: local +X to its right, +Z its front */
  const at = (x: number, z: number, yaw = 0) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), p = (lx: number, ly: number, lz: number): Vec3 => [x + cs * lx + sn * lz, ly, z - sn * lx + cs * lz];
    return { p,
      /** a solid box w × h × d standing on height y0, centred at local (lx, lz) */
      box: (lx: number, y0: number, lz: number, w: number, h: number, d: number, albedo: Vec3, dyaw = 0, extra: Partial<Box> = {}) => H.add({ c: p(lx, y0 + h / 2, lz), h: [w / 2, h / 2, d / 2], yaw: yaw + dyaw, albedo, ...extra }),
      /** a drawn-only sheet lying on a surface at height y (PAPER to the destruction when pale and its longer side is 0.16‥0.4) */
      sheet: (lx: number, y: number, lz: number, w: number, d: number, albedo: Vec3 = INK.paper, dyaw = 0) => H.add({ c: p(lx, y + 0.005, lz), h: [w / 2, 0.005, d / 2], yaw: yaw + dyaw, albedo, flags: BoxFlag.NoShadow }),
      /** a drawn-only panel standing against the piece's back or front (w wide, h tall, at local lz) */
      face: (lx: number, y0: number, lz: number, w: number, h: number, albedo: Vec3) => H.add({ c: p(lx, y0 + h / 2, lz), h: [w / 2, h / 2, 0.006], yaw, albedo, flags: BoxFlag.NoShadow }) };
  };
  /** a loose prop of this room, named for the loader */
  const loose = (thing: string, kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]): PropDef => {
    const key = `${room}.${thing}`, i = count.get(key) ?? 0; count.set(key, i + 1); const p = H.prop(kind, x, z, yaw, mass, parts, half); p.name = `lived.${room}.${thing}${i}`; return p; };
  const part = (x: number, y0: number, z: number, w: number, h: number, d: number, albedo: Vec3, yaw = 0): PropPart => ({ off: [x, y0 + h / 2, z], h: [w / 2, h / 2, d / 2], yaw, albedo });

  const P = {
    at, loose, part, tone,
    /** everything after this call belongs to the room `id` (group 'lived.<id>') */
    room(id: string) { room = id; H.grp(`lived.${id}`); },
    /** a floor covering (drawn only, no step), laid a degree off square — by hand. At its default height (top 0.0195) it lies OVER the look's floor marks
     *  (tops 0.012‥0.0143) and under the kit's rugs: a mat, a patch. A wall-to-wall floor passes y 0.006: the look's marks and the kit's rugs then draw over it */
    floor(x: number, z: number, w: number, d: number, albedo: Vec3, yaw = 0.014, y = 0.016) { return H.add({ c: [x, y, z], h: [w / 2, 0.0035, d / 2], yaw, albedo, flags: BoxFlag.NoShadow }); },

    // ---- carcasses ----
    /** a four-legged table: top w × d at height h */
    table(x: number, z: number, w: number, d: number, yaw = 0, top: Vec3 = C.wood, leg: Vec3 = C.woodDark, h = 0.74) { const L = at(x, z, yaw);
      L.box(0, h - 0.04, 0, w, 0.04, d, top); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.box(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.05, h - 0.04, 0.05, leg); return L; },
    /** a counter or a plinth: a solid body under an overhanging top */
    counter(x: number, z: number, w: number, d: number, yaw = 0, h = 1.0, body: Vec3 = C.woodDark, top: Vec3 = C.wood) { const L = at(x, z, yaw);
      L.box(0, 0, 0, w, h - 0.04, d, body); L.box(0, h - 0.04, 0, w + 0.06, 0.04, d + 0.06, top); return L; },
    /** a chest of wide shallow drawers (a plan chest, a map chest): `rows` drawer seams and a brass pull each on the front */
    chest(x: number, z: number, w: number, d: number, yaw = 0, h = 0.9, rows = 5, body: Vec3 = C.wood, top: Vec3 = C.woodDark) { const L = P.counter(x, z, w, d, yaw, h, body, top);
      for (let i = 0; i < rows; i++) { const y = 0.06 + (h - 0.14) * (i + 0.5) / rows; L.face(0, y - 0.012, d / 2 + 0.004, w * 0.3, 0.024, INK.brass); if (i) L.face(0, 0.06 + (h - 0.14) * i / rows - 0.004, d / 2 + 0.003, w - 0.06, 0.008, tone(body, 0.45)); } return L; },

    // ---- paper, plans, books ----
    /** `k` rolled plans lying side by side on a surface at y, each `len` long along local X */
    rolls(x: number, y: number, z: number, yaw = 0, k = 4, len = 0.8, pitch = 0.085) { const L = at(x, z, yaw), s = n++;
      for (let i = 0; i < k; i++) { const t = 0.052 + 0.004 * i; L.box((h01(i, s) - 0.5) * 0.12, y, (i - (k - 1) / 2) * pitch, len * (0.8 + 0.2 * h01(i, s + 2)), t, t, h01(i, s + 1) < 0.25 ? INK.blueprint : tone(INK.cream, 0.9 + 0.1 * h01(i, s + 3))); } return L; },
    /** a tall bin of rolled plans standing on end (a loose prop: it tips) */
    rollBin(x: number, z: number) { const ps: PropPart[] = [part(0, 0, 0, 0.32, 0.55, 0.32, C.metal)], s = n++;
      for (let i = 0; i < 5; i++) ps.push(part((h01(i, s) - 0.5) * 0.18, 0.1, (h01(i, s + 1) - 0.5) * 0.18, 0.06, 0.75 + 0.3 * h01(i, s + 2), 0.06, i === 1 ? INK.blueprint : tone(INK.cream, 0.88 + 0.12 * h01(i, s + 3)), h01(i, s + 4)));
      return loose('rolls', 'bin', x, z, 0.2, 6, ps, [0.17, 0.17]); },
    /** a big sheet spread on a surface (a map, a plan, a blueprint: too big to fly — drawn only) with a darker border line */
    plan(x: number, y: number, z: number, w: number, d: number, yaw = 0, albedo: Vec3 = INK.cream) { const L = at(x, z, yaw); L.sheet(0, y, 0, w, d, albedo); L.sheet(0, y + 0.004, 0, w * 0.62, d * 0.5, tone(albedo, 0.86), 0.5); L.sheet(w * 0.2, y + 0.006, -d * 0.12, w * 0.24, d * 0.3, tone(albedo, 0.74), -0.3); return L; },
    /** loose sheets on a surface (PAPER: they fly) */
    sheets(x: number, y: number, z: number, yaw = 0, k = 3, albedo: Vec3 = INK.paper) { const L = at(x, z, yaw), s = n++;
      for (let i = 0; i < k; i++) L.sheet((h01(i, s) - 0.5) * 0.3, y + i * 0.004, (h01(i, s + 1) - 0.5) * 0.24, 0.21, 0.3, tone(albedo, 0.94 + 0.06 * h01(i, s + 2)), (h01(i, s + 3) - 0.5) * 1.2); return L; },
    /** a ledger: open (two pale pages on a dark cover) or shut */
    ledger(x: number, y: number, z: number, yaw = 0, open = true, cover: Vec3 = INK.oxblood) { const L = at(x, z, yaw);
      if (!open) { L.box(0, y, 0, 0.3, 0.05, 0.38, cover); L.sheet(0, y + 0.05, -0.04, 0.16, 0.08, INK.cream); return L; }
      L.box(0, y, 0, 0.56, 0.02, 0.4, cover); L.box(-0.135, y + 0.02, 0, 0.25, 0.025, 0.36, INK.cream); L.box(0.135, y + 0.02, 0, 0.25, 0.02, 0.36, INK.paper); return L; },
    /** a huge plan book open on a lectern: two pale pages w each, thin parcel lines drawn on them (read from above) */
    planBook(x: number, y: number, z: number, yaw = 0, w = 0.45, d = 0.46, cover: Vec3 = INK.baize) { const L = at(x, z, yaw), s = n++;
      L.box(0, y, 0, w * 2 + 0.06, 0.02, d + 0.04, cover);
      for (const sx of [-1, 1]) { L.box(sx * (w / 2 + 0.005), y + 0.02, 0, w, sx < 0 ? 0.03 : 0.024, d, sx < 0 ? INK.cream : INK.paper);
        for (let i = 0; i < 2; i++) L.sheet(sx * (w / 2 + 0.005) + (h01(i, s + sx) - 0.5) * 0.1, y + (sx < 0 ? 0.05 : 0.044), (i - 0.5) * d * 0.4, w * 0.8, 0.012, tone(INK.manila, 0.6), (h01(i, s + 3 + sx) - 0.5) * 0.9); }
      return L; },
    /** a row of `k` books or binders standing on a surface (CLUTTER: they are knocked off) */
    books(x: number, y: number, z: number, yaw = 0, k = 6, palette: Vec3[] = [INK.oxblood, INK.baize, INK.navy, C.woodDark, INK.manila]) { const L = at(x, z, yaw), s = n++; let lx = -k * 0.03;
      for (let i = 0; i < k; i++) { const w = 0.04 + 0.03 * h01(i, s); L.box(lx + w / 2, y, 0, w, 0.22 + 0.08 * h01(i, s + 1), 0.18, palette[Math.floor(h01(i, s + 2) * palette.length) % palette.length]); lx += w + 0.004; } return L; },
    /** `k` tin deed boxes in a row on a surface: black japanned, a WHITE lid, red tape crossed over it — the white square with the red cross reads from above (all solid, so
     *  a tin knocked off takes its lid and tape with it: CLUTTER) */
    tins(x: number, y: number, z: number, yaw = 0, k = 3, pitch = 0.38, lid: Vec3 = C.white, tape: Vec3 | null = C.red) { const L = at(x, z, yaw);
      for (let i = 0; i < k; i++) { const lx = (i - (k - 1) / 2) * pitch; L.box(lx, y, 0, 0.32, 0.13, 0.24, INK.tin); L.box(lx, y + 0.13, 0, 0.33, 0.014, 0.25, lid);
        if (tape) { L.box(lx, y + 0.144, 0, 0.332, 0.005, 0.05, tape); L.box(lx, y + 0.1445, 0, 0.05, 0.006, 0.252, tape); } else L.box(lx - 0.08, y + 0.144, 0, 0.06, 0.005, 0.252, C.black); } return L; },
    /** an in-tray with papers in it (the tray CLUTTER, the top sheet PAPER) */
    tray(x: number, y: number, z: number, yaw = 0) { const L = at(x, z, yaw); L.box(0, y, 0, 0.26, 0.05, 0.34, C.metal); L.sheet(0, y + 0.05, 0, 0.21, 0.3, INK.paper, 0.06); return L; },
    /** an ink pad and three stamps (CLUTTER) */
    stamps(x: number, y: number, z: number, yaw = 0) { const L = at(x, z, yaw); L.box(0, y, 0, 0.16, 0.025, 0.1, INK.navy); for (let i = 0; i < 3; i++) L.box(0.16 + i * 0.07, y, 0, 0.045, 0.08, 0.045, C.woodDark); return L; },

    // ---- instruments and tools ----
    /** an instrument on a tripod (a theodolite, a level, a camera): three legs, a head, a scope along local Z */
    tripod(x: number, z: number, yaw = 0, body: Vec3 = INK.yellow, legs: Vec3 = C.wood, top = 1.25) { const L = at(x, z, yaw);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; L.box(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26, 0.04, top - 0.12, 0.04, legs, a); }
      for (let i = 0; i < 3; i++) L.box(0, top - 0.14 - i * 0.004, 0, 0.56 - i * 0.02, 0.036, 0.05, legs, 0.5 + i * 2.094);
      L.box(0, top - 0.1, 0, 0.16, 0.06, 0.16, INK.iron); L.box(0, top - 0.04, 0, 0.14, 0.18, 0.2, body); L.box(0, top + 0.02, 0.04, 0.06, 0.06, 0.34, INK.iron); return L; },
    /** `k` ranging poles lying on two brackets at height y along local X: red and white by the half metre */
    poles(x: number, y: number, z: number, yaw = 0, k = 3, len = 2.0, pitch = 0.09) { const L = at(x, z, yaw);
      for (const sx of [-1, 1]) L.box(sx * len * 0.3, y - 0.04, 0, 0.04, 0.04, k * pitch + 0.1, C.metal);
      for (let i = 0; i < k; i++) for (let j = 0; j < 4; j++) L.box(-len / 2 + len * (j + 0.5) / 4 + (i % 2) * 0.06, y, (i - (k - 1) / 2) * pitch, len / 4, 0.045, 0.045, (i + j) % 2 ? C.white : C.red); return L; },
    /** a drawing board on a pedestal: a tilted-looking pale board, the sheet pinned on it, a T-square across, a set square, a pot of pencils */
    drafting(x: number, z: number, yaw = 0, w = 1.5, d = 1.0) { const L = at(x, z, yaw);
      for (const sx of [-1, 1]) { L.box(sx * (w / 2 - 0.2), 0, 0, 0.06, 0.86, 0.5, INK.iron); L.box(sx * (w / 2 - 0.2), 0, 0, 0.08, 0.04, d * 0.8, INK.iron); }
      L.box(0, 0.86, 0, w, 0.05, d, C.wood); L.sheet(0, 0.91, 0.02, w - 0.26, d - 0.2, INK.cream); L.sheet(-0.1, 0.915, 0, (w - 0.26) * 0.55, (d - 0.2) * 0.6, INK.paper);
      L.box(0.04, 0.92, d * 0.12, w + 0.04, 0.012, 0.05, C.woodDark); L.box(-w / 2 - 0.005, 0.92, d * 0.12, 0.05, 0.016, 0.3, C.woodDark);
      L.sheet(w * 0.26, 0.92, -d * 0.18, 0.22, 0.14, INK.enamel, 0.5); L.box(w / 2 - 0.1, 0.91, -d / 2 + 0.1, 0.07, 0.1, 0.07, C.metal); return L; },
    /** a ladder lying along local X at height y (on the floor against a wall, on trestles): two rails and its rungs */
    ladder(x: number, y: number, z: number, yaw = 0, len = 3.0, wid = 0.42, rail: Vec3 = C.wood) { const L = at(x, z, yaw), k = Math.round(len / 0.3);
      for (const sz of [-1, 1]) L.box(0, y, sz * wid / 2, len, 0.07, 0.04, rail); for (let i = 1; i < k; i++) L.box(-len / 2 + len * i / k, y + 0.02, 0, 0.03, 0.03, wid, tone(rail, 0.8)); return L; },

    // ---- safes ----
    /** a safe: a dark body, its door proud on the front with a brass dial and a handle */
    safe(x: number, z: number, yaw = 0, w = 0.8, d = 0.7, h = 1.25, body: Vec3 = INK.enamel) { const L = at(x, z, yaw);
      L.box(0, 0, 0, w, h, d, tone(body, 0.5)); L.box(0, 0.08, d / 2 + 0.015, w - 0.14, h - 0.16, 0.03, tone(body, 0.62)); L.box(-0.08, h * 0.55, d / 2 + 0.05, 0.1, 0.1, 0.04, INK.brass); L.box(0.14, h * 0.55, d / 2 + 0.05, 0.05, 0.22, 0.04, INK.brass); return L; },

    // ---- on a wall ----
    /** a rail of hooks on the wall behind the piece at height y with `k` things hanging from it (coats, vests, belts: slabs 0.5 tall in the colours given) */
    hooks(x: number, z: number, yaw: number, k = 4, y = 1.6, items: Vec3[] = [INK.hivis, INK.navy, INK.canvas], pitch = 0.36) { const L = at(x, z, yaw), s = n++;
      L.box(0, y, 0.02, k * pitch, 0.05, 0.04, C.woodDark); for (let i = 0; i < k; i++) if (h01(i, s) < 0.85) L.box((i - (k - 1) / 2) * pitch, y - 0.5 - 0.1 * h01(i, s + 1), 0.07, 0.28, 0.5 + 0.1 * h01(i, s + 1), 0.09, items[i % items.length]); return L; },
    /** a rail on the wall behind the piece at height y carrying `k` small things (hard hats, fire buckets, mugs on hooks: CLUTTER between 0.7 and 1.6 m) */
    rail(x: number, z: number, yaw: number, k: number, y: number, w: number, h: number, d: number, albedo: Vec3, pitch = 0.34) { const L = at(x, z, yaw);
      L.box(0, y + h, 0.02, k * pitch, 0.04, 0.04, C.metal); for (let i = 0; i < k; i++) L.box((i - (k - 1) / 2) * pitch, y, 0.04 + d / 2, w, h, d, albedo); return L; },

    // ---- on a desk ----
    /** a hard hat on a surface (CLUTTER) */
    hat(x: number, y: number, z: number, yaw = 0, albedo: Vec3 = INK.yellow) { const L = at(x, z, yaw); L.box(0, y, 0, 0.22, 0.1, 0.26, albedo); L.box(0, y, 0.15, 0.2, 0.02, 0.06, albedo); return L; },
    /** `k` mugs or glasses in a row on a surface (CLUTTER) */
    mugs(x: number, y: number, z: number, yaw = 0, k = 3, palette: Vec3[] = [C.white, INK.enamel, INK.navy], pitch = 0.13) { const L = at(x, z, yaw), s = n++; for (let i = 0; i < k; i++) L.box((i - (k - 1) / 2) * pitch, y, (h01(i, s) - 0.5) * 0.06, 0.08, 0.09, 0.08, palette[i % palette.length]); return L; },
    /** a kettle (CLUTTER) */
    kettle(x: number, y: number, z: number, yaw = 0, albedo: Vec3 = C.metal) { const L = at(x, z, yaw); L.box(0, y, 0, 0.17, 0.16, 0.17, albedo); L.box(0.12, y + 0.08, 0, 0.08, 0.03, 0.03, albedo); return L; },
    /** a typewriter with a sheet in it */
    typewriter(x: number, y: number, z: number, yaw = 0) { const L = at(x, z, yaw); L.box(0, y, 0, 0.34, 0.09, 0.3, INK.iron); L.box(0, y + 0.09, -0.1, 0.4, 0.05, 0.08, C.metal); L.face(0, y + 0.12, -0.12, 0.21, 0.16, INK.paper); return L; },
    /** a desk telephone (CLUTTER) */
    phone(x: number, y: number, z: number, yaw = 0, albedo: Vec3 = INK.iron) { const L = at(x, z, yaw); L.box(0, y, 0, 0.18, 0.06, 0.15, albedo); L.box(0, y + 0.06, -0.03, 0.22, 0.035, 0.05, albedo); return L; },

    // ---- on the floor ----
    /** a coat stand with a coat and a hat on it */
    coatStand(x: number, z: number, yaw = 0, coat: Vec3 = INK.navy) { const L = at(x, z, yaw);
      L.box(0, 0, 0, 0.4, 0.04, 0.4, C.woodDark, 0.4); L.box(0, 0.04, 0, 0.05, 1.7, 0.05, C.woodDark); L.box(0, 1.62, 0, 0.5, 0.04, 0.04, C.woodDark, 0.4); L.box(0, 1.626, 0, 0.48, 0.03, 0.04, C.woodDark, 1.97);
      L.box(0.17, 0.8, 0.06, 0.32, 0.82, 0.1, coat, 0.4); L.box(-0.16, 1.66, -0.06, 0.24, 0.1, 0.26, tone(coat, 0.6)); return L; },
    /** `k` pairs of boots in a row on a mat along local X */
    boots(x: number, z: number, yaw = 0, k = 3, pitch = 0.4) { const L = at(x, z, yaw), s = n++; L.sheet(0, 0.012, 0, k * pitch + 0.1, 0.42, INK.rubber);
      for (let i = 0; i < k; i++) for (const sx of [-0.07, 0.07]) L.box((i - (k - 1) / 2) * pitch + sx, 0.02, (h01(i, s) - 0.5) * 0.06, 0.1, 0.26 + 0.05 * h01(i, s + 1), 0.27, h01(i, s + 2) < 0.4 ? [0.2, 0.13, 0.08] : INK.rubber, (h01(i, s + 3) - 0.5) * 0.3); return L; },
    /** a sack lying on the floor (mail, rice, cement): a body, a bulge, a tied neck */
    sack(x: number, z: number, yaw = 0, albedo: Vec3 = INK.canvas, y = 0) { const L = at(x, z, yaw); L.box(0, y, 0, 0.62, 0.26, 0.4, albedo); L.box(-0.04, y + 0.26, 0, 0.42, 0.1, 0.3, tone(albedo, 1.08)); L.box(0.36, y + 0.06, 0, 0.1, 0.12, 0.12, tone(albedo, 0.8)); return L; },

    // ---- loose (the physics has them: they are shoved, shot about, stacked as a barricade) ----
    /** a stool */
    stool(x: number, z: number, albedo: Vec3 = C.woodDark) { return loose('stool', 'chair', x, z, 0.3, 5, [part(0, 0.44, 0, 0.32, 0.04, 0.32, albedo), part(0, 0.03, 0, 0.05, 0.41, 0.05, C.black), part(0, 0, 0, 0.36, 0.03, 0.06, C.black), part(0, 0, 0, 0.06, 0.03, 0.36, C.black)]); },
    /** an armchair (heavy: it is cover you can shove) */
    armchair(x: number, z: number, yaw = 0, albedo: Vec3 = INK.oxblood) { return loose('armchair', 'chair', x, z, yaw, 28, [part(0, 0.1, 0, 0.7, 0.34, 0.7, albedo), part(0, 0.44, 0.28, 0.7, 0.46, 0.14, albedo), part(-0.3, 0.44, -0.04, 0.1, 0.2, 0.56, tone(albedo, 0.85)), part(0.3, 0.44, -0.04, 0.1, 0.2, 0.56, tone(albedo, 0.85)), part(0, 0, 0, 0.6, 0.1, 0.6, C.woodDark)]); },
    /** a wooden crate of side s (a tea chest, a parts crate): slats across its lid; `tops` stand on it (bottles, insulators) */
    crate(x: number, z: number, s = 0.5, yaw = 0, albedo: Vec3 = C.wood, tops: Vec3 | null = null, thing = 'crate') { const ps: PropPart[] = [part(0, 0, 0, s, s * 0.8, s, albedo), part(0, s * 0.8, -s * 0.28, s, 0.02, s * 0.16, tone(albedo, 0.75)), part(0, s * 0.8, s * 0.28, s, 0.02, s * 0.16, tone(albedo, 0.75))];
      if (tops) for (const [ix, iz] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) ps.push(part(ix * s * 0.28, s * 0.8, iz * s * 0.1, s * 0.16, 0.09, s * 0.16, tops));
      return loose(thing, 'cardboard', x, z, yaw, 4 + 40 * s ** 3, ps); },
    /** a trolley on casters, two shelves, a load of books or boxes in the colours given */
    trolley(x: number, z: number, yaw = 0, load: Vec3[] = [INK.oxblood, INK.baize, INK.manila, INK.navy], frame: Vec3 = C.metal) { const s = n++, ps: PropPart[] = [part(0, 0.12, 0, 0.8, 0.03, 0.42, frame), part(0, 0.62, 0, 0.8, 0.03, 0.42, frame), part(-0.39, 0, 0, 0.03, 0.9, 0.42, frame), part(0.39, 0, 0, 0.03, 0.9, 0.42, frame)];
      load.forEach((c, i) => ps.push(part(-0.27 + 0.18 * (i % 4), i < 4 ? 0.65 : 0.15, (h01(i, s) - 0.5) * 0.1, 0.15, 0.2 + 0.1 * h01(i, s + 1), 0.28, c)));
      return loose('trolley', 'bin', x, z, yaw, 18, ps, [0.42, 0.23]); },
    /** a peg in the ground (a survey peg, a tent peg): a short post with a painted top */
    peg(x: number, z: number, top: Vec3 = C.red, body: Vec3 = C.white, h = 0.28) { const L = at(x, z, 0.3); L.box(0, 0, 0, 0.06, h, 0.06, body); L.box(0, h, 0, 0.07, 0.04, 0.07, top); return L; },
    /** one ranging pole lying on the ground from (x0, z0) toward (x1, z1): red and white by the half metre, `len` long from its first end */
    rod(x0: number, z0: number, x1: number, z1: number, len = 2.0, y = 0.012) { const a = Math.atan2(-(z1 - z0), x1 - x0), L = at(x0, z0, a); for (let j = 0; j < 4; j++) L.box(len * (j + 0.5) / 4, y, 0, len / 4, 0.045, 0.045, j % 2 ? C.white : C.red); return L; },
    /** a traffic cone */
    cone(x: number, z: number) { return loose('cone', 'cardboard', x, z, 0.4, 1.5, [part(0, 0, 0, 0.3, 0.03, 0.3, INK.hivis), part(0, 0.03, 0, 0.2, 0.22, 0.2, INK.hivis), part(0, 0.25, 0, 0.14, 0.08, 0.14, C.white), part(0, 0.33, 0, 0.09, 0.16, 0.09, INK.hivis)]); },
    /** a bucket (a mop bucket, a fire bucket on the floor, a coal scuttle) */
    bucket(x: number, z: number, albedo: Vec3 = C.metal, thing = 'bucket') { return loose(thing, albedo === C.metal ? 'bin' : 'cardboard', x, z, 0.2, 2, [part(0, 0, 0, 0.26, 0.28, 0.26, albedo), part(0, 0.28, 0, 0.3, 0.02, 0.03, tone(albedo, 0.6))]); },
  };
  return P;
}
export type LivedPieces = ReturnType<typeof livedPieces>;
