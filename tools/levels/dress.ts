// DRESSING: the things a loud level carries only so that a firefight has something to wreck (game/destruction.ts finds them BY SHAPE, as it finds the office's) —
// paper stacks, mugs, phones, box files and dark monitors on the tables and counters a generator already stood up, binder runs on its shelf boards, files on its
// cabinets. No new look: every piece is one the office already has (scene/levelKit.ts papers / monitor, officeGen's desk clutter), no light, no switchable, nothing
// at floor level, nothing outdoors, nothing where the generator already put a thing. tools/levels/export.ts calls dressLevel() after build() and files the boxes
// LAST under the editor group DRESS_GROUP; scene/levelLoad.ts leaves that group out with the destruction switch off (game/destructionSwitch.ts), so the level a
// generator returns — and every index in it — is untouched by any of this.
// Deterministic: every choice is a hash of the surface's own centre (never Math.random); a generator that moves a desk moves its dressing with it.
import type { Vec3 } from '../../src/math/vec';
import { Box, BoxFlag, makeBox } from '../../src/scene/boxes';
import type { Level } from '../../src/scene/level';
import * as MD from '../../src/scene/markingDefaults';
import { DRESS_GROUP } from '../../src/game/destructionSwitch';

const SCREEN_OFF: Vec3 = [0.02, 0.02, 0.025], BLACK: Vec3 = [0.04, 0.04, 0.045];   // (the kit's screenOff / black paints: the export names them by colour, finish and all)
const MUGS: Vec3[] = [[0.82, 0.82, 0.8], [0.15, 0.2, 0.35], [0.55, 0.12, 0.1], [0.2, 0.2, 0.21]];
const FILES: Vec3[] = [[0.2, 0.25, 0.4], [0.45, 0.12, 0.1], [0.12, 0.3, 0.2], [0.1, 0.1, 0.11], [0.62, 0.5, 0.2]];
const lum = (a: Vec3) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (c: Vec3) => (Math.round(c[0] * 100) * 73856093) ^ (Math.round(c[1] * 100) * 19349663) ^ (Math.round(c[2] * 100) * 83492791);
/** world-axis extents of a yawed box's footprint */
const ext = (b: { h: Vec3; yaw: number }): [number, number] => { const ac = Math.abs(Math.cos(b.yaw)), as = Math.abs(Math.sin(b.yaw)); return [ac * b.h[0] + as * b.h[2], as * b.h[0] + ac * b.h[2]]; };

/** THE LOUD LEVELS — the ones a scenario is played on, the ones that get dressing: generator (tools/levels/<gen>.ts) → file under levels/ and the page query that
 *  stages its scenario. The one list: export.ts dresses by it, tools/qa/loudchaos-probes.ts checks by it. */
export const LOUD_LEVELS: { gen: string; file: string; q: string }[] = [
  { gen: 'records', file: 'records.json', q: 'roomclear=1' }, { gen: 'depot', file: 'depot.json', q: 'roomclear=1&squad4' }, { gen: 'block', file: 'block.json', q: 'roomclear=1&squad4' },
  { gen: 'blocksquads', file: 'block-squads.json', q: 'roomclear=1&squad4' }, { gen: 'warehouse', file: 'warehouse.json', q: 'roomclear=1&squad4' }, { gen: 'compound', file: 'compound.json', q: 'roomclear=1&squad4' },
  { gen: 'barracks', file: 'barracks.json', q: 'roomclear=1&squad4' }, { gen: 'registry', file: 'registry.json', q: 'rescue' },
  { gen: 'consulate', file: 'consulate.json', q: 'rescue&squad=4' },
];
export interface DressStats { added: number; surfaces: number; by: Record<string, number> }

/** Append the dressing to `level.boxes` (and its group to `groups`). Returns what went where. */
export function dressLevel(level: Level, groups: string[]): DressStats {
  const boxes = level.boxes, n0 = boxes.length;
  const st: DressStats = { added: 0, surfaces: 0, by: {} };
  const fixture = new Set<number>(); for (const s of level.switchables) for (const bi of s.boxes) fixture.add(bi); for (const l of level.lights) if (l.fixtureBox !== undefined && l.fixtureBox >= 0) fixture.add(l.fixtureBox);
  /** under a roof: a wide slab's underside 2.2 m or more up over the point */
  const roofed = (x: number, z: number) => boxes.some((b, i) => { if (i >= n0 || b.c[1] - b.h[1] < 2.2) return false; const [ex, ez] = ext(b); return ex >= 0.5 && ez >= 0.5 && Math.abs(b.c[0] - x) <= ex && Math.abs(b.c[2] - z) <= ez; });
  /** is the block of air a new piece would stand in free of every other box (the surface it stands on aside)? */
  const free = (nb: Box, on: number) => { const [ex, ez] = ext(nb); const y0 = nb.c[1] - nb.h[1] + 0.004, y1 = nb.c[1] + nb.h[1];
    for (let i = 0; i < boxes.length; i++) { if (i === on) continue; const b = boxes[i]; if (b.c[1] + b.h[1] <= y0 || b.c[1] - b.h[1] >= y1) continue; const [bx, bz] = ext(b); if (Math.abs(b.c[0] - nb.c[0]) < ex + bx + 0.015 && Math.abs(b.c[2] - nb.c[2]) < ez + bz + 0.015) return false; }
    return true; };
  const put = (kind: string, parts: Box[], on: number): boolean => { if (!parts.every(p => free(p, on))) return false; for (const p of parts) { boxes.push(p); groups.push(DRESS_GROUP); } st.added += parts.length; st.by[kind] = (st.by[kind] ?? 0) + 1; return true; };
  const mk = (c: Vec3, h: Vec3, yaw: number, albedo: Vec3, extra: Partial<Box> = {}) => makeBox({ c: [r3(c[0]), r3(c[1]), r3(c[2])], h, yaw: r3(yaw), albedo, ...extra });

  for (let si = 0; si < n0; si++) {
    const s = boxes[si];
    if (s.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass) || s.emissive[0] + s.emissive[1] + s.emissive[2] > 0 || fixture.has(si) || s.rot) continue;
    const top = s.c[1] + s.h[1]; const long = Math.max(s.h[0], s.h[2]), short = Math.min(s.h[0], s.h[2]);
    const thin = s.h[1] <= 0.035;
    const table = thin && s.h[1] >= 0.02 && top >= 0.72 && top <= 1.1 && long >= 0.3 && short >= 0.28;                 // a desk, a mess table, a counter's worktop
    const board = thin && s.h[1] < 0.02 && top >= 0.7 && top <= 1.4 && long >= 0.6 && short >= 0.18 && short <= 0.3;   // a shelf board at binder height
    const cab = !thin && s.h[1] >= 0.55 && top >= 1.15 && top <= 1.45 && long <= 0.55 && short >= 0.2 && lum(s.albedo) > 0.2 && lum(s.albedo) < 0.75;   // a filing cabinet, a locker, a safe
    if (!table && !board && !cab) continue;
    if (!roofed(s.c[0], s.c[2])) continue;
    st.surfaces++;
    const R = mulberry(seedOf(s.c)); const alongX = s.h[0] >= s.h[2];
    const cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    /** a point on the surface: u along its long side, v across (metres from its centre) */
    const at = (u: number, y: number, v: number): Vec3 => { const lx = alongX ? u : v, lz = alongX ? v : u; return [s.c[0] + cs * lx + sn * lz, y, s.c[2] - sn * lx + cs * lz]; };
    const yawL = s.yaw + (alongX ? 0 : Math.PI / 2);   // a piece's local +X along the surface's long side
    if (board || cab) {
      // a run of binders standing on edge (cabinet: a short run or a box file lying flat); a paper stack on what room is left
      if (cab && R() < 0.45) { const a = FILES[Math.floor(R() * FILES.length)]; put('file', [mk(at((R() - 0.5) * 0.1, top + 0.045, (R() - 0.5) * 0.06), [0.16, 0.045, 0.125], yawL + (R() - 0.5) * 0.4, a)], si); }
      else {
        const room = long - 0.1; const count = Math.max(2, Math.min(cab ? 4 : 7, Math.floor(R() * 4) + 3)); const span = count * 0.072;
        const u0 = board ? (R() - 0.5) * 2 * Math.max(0, room - span / 2 - 0.05) : 0;
        const run: Box[] = []; for (let k = 0; k < count; k++) run.push(mk(at(u0 + (k - (count - 1) / 2) * 0.072, top + 0.15, 0), [0.033, 0.15, Math.min(0.115, short - 0.04)], yawL, FILES[(k + Math.floor(R() * 3)) % FILES.length]));
        if (Math.abs(u0) + span / 2 < long - 0.03) put('binders', run, si);
      }
      if (R() < (cab ? 0.5 : 0.35)) { const u = (R() - 0.5) * 2 * Math.max(0, long - 0.2), v = (R() - 0.5) * 2 * Math.max(0, short - 0.17); put('paper', paperPair(at(u, top, v), yawL + (R() - 0.5) * 0.6, mk, R), si); }
      continue;
    }
    // a table top: a slot every ~0.5 m along it; what stands in each is the surface's own dice
    const slots = Math.max(1, Math.floor((2 * long - 0.2) / 0.5));
    let monitorDone = lum(s.albedo) > 0.6 || top > 0.8;   // (a dark monitor only on a desk-height wooden top: not on the mess tables, not on a counter)
    for (let k = 0; k < slots; k++) {
      const u = ((k + 0.5) / slots - 0.5) * (2 * long - 0.25) + (R() - 0.5) * 0.08; const side = R() < 0.5 ? -1 : 1; const v = side * (0.2 + 0.5 * R()) * Math.max(0, short - 0.14); const yaw = yawL + (R() - 0.5) * 0.7; const d = R();
      if (!monitorDone && short >= 0.34 && d < 0.3) { monitorDone = true; if (put('monitor', darkMonitor(at(u, top, -side * 0.08), yawL + (side > 0 ? 0 : Math.PI), mk), si)) continue; }
      if (d < 0.5) put('paper', paperPair(at(u, top, v), yaw, mk, R), si);
      else if (d < 0.68) put('mug', [mk(at(u, top + 0.05, v), [0.04, 0.05, 0.04], yaw, MUGS[Math.floor(R() * MUGS.length)])], si);
      else if (d < 0.8) { const c = at(u, top + 0.025, v); put('phone', [mk(c, [0.09, 0.025, 0.07], yaw, [0.07, 0.07, 0.08]), mk([c[0], top + 0.065, c[2]], [0.085, 0.015, 0.022], yaw + 0.15, [0.05, 0.05, 0.06])], si); }
      else if (d < 0.93) put('file', [mk(at(u, top + 0.045, v * 0.6), [0.16, 0.045, 0.125], yaw, FILES[Math.floor(R() * FILES.length)])], si);
    }
  }
  return st;
}

type Mk = (c: Vec3, h: Vec3, yaw: number, albedo: Vec3, extra?: Partial<Box>) => Box;
/** scene/levelKit.ts papers(): two sheets' worth of stack, the upper one askew */
function paperPair(c: Vec3, yaw: number, mk: Mk, R: () => number): Box[] {
  const seed = 31 + Math.floor(R() * 40) * 2; const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const h0: Vec3 = [0.11, 0.02, 0.15], h1: Vec3 = [0.1, 0.012, 0.14];
  return [
    mk([c[0], c[1] + 0.02, c[2]], h0, yaw, [0.86, 0.86, 0.82], { flags: BoxFlag.NoShadow, marks: MD.paperMarks(h0, seed, false) }),
    mk([c[0] + cs * 0.03 - sn * 0.02, c[1] + 0.052, c[2] - sn * 0.03 - cs * 0.02], h1, yaw + 0.25, [0.9, 0.88, 0.8], { flags: BoxFlag.NoShadow, marks: MD.paperMarks(h1, seed + 1, R() < 0.4) }),
  ];
}
/** scene/levelKit.ts monitor(…, on = false): foot, neck, housing, the dark screen on local +Z — no keyboard, no switchable (a dead screen: it cracks and comes off its stand, no light goes) */
function darkMonitor(c: Vec3, yaw: number, mk: Mk): Box[] {
  const cs = Math.cos(yaw), sn = Math.sin(yaw); const at = (ly: number, lz: number): Vec3 => [c[0] + sn * lz, c[1] + ly, c[2] + cs * lz];
  const hs: Vec3 = [0.25, 0.15, 0.004];
  return [mk(at(0.03, 0), [0.1, 0.03, 0.08], yaw, BLACK), mk(at(0.17, 0), [0.02, 0.12, 0.02], yaw, BLACK), mk(at(0.32, 0), [0.27, 0.17, 0.02], yaw, BLACK), mk(at(0.32, 0.022), hs, yaw, SCREEN_OFF, { rough: 0.08 })].map((b, i) => { if (i < 3) b.rough = 0.6; return b; });
}
