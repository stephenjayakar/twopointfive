// THE LOOK'S SECOND FILE OF A LEVEL (src/scene/look.ts): tools/levels/<name>-gwot.ts builds the level with ITS OWN generator, lets the exporter dress it
// exactly as it dresses the plain file, and then `skinLevel` changes its clothes — every box where it was, the size it was, with the flags it had:
//   · REPAINT   a box's albedo + finish, by its group and the office paint it wore. The new paint STANDS FOR the old one (src/scene/gwotPalette.ts gwotAs): to
//               a round, a charge and a blast the box is exactly what it was — and `check()` below asks the game's own classifiers before and after;
//   · DECALS    appended LAST under the group 'look': NoShadow boxes only, EVERY ONE FROM THE FLOOR UP (rugs, patches and wear on the ground, the damp foot
//               of an outside wall and the strip of ground along it, a painted dado indoors) — drawn and lit, invisible to every ray and every collision
//               query (tools/qa/look-check.ts also asks the three destruction indexes, which find things by shape, whether they list the same boxes in
//               both files). From the floor up, because a drawn-only thing OFF the floor is something game/wallbreak.ts judges when what it touches breaks
//               (it falls: debris, a sound) — a decal that starts at the floor is never asked. A decal on a wall's face goes with its wall when the wall
//               is holed: scene/lookTidy.ts, picture only;
//   · PROPS     keep their kind, place, mass and parts; a part's paint may change (nothing reads it but the renderer).
// Never touched: lights, doors, routes, marks, scenarios, glass, lit boxes, fixtures, screens, the destruction dressing, and anything small enough to be the
// clutter / paper the destruction index finds by shape and tone.
import type { Vec3 } from '../../src/math/vec';
import { hashStr } from '../../src/math/dice';
import type { Level, PropDef } from '../../src/scene/level';
import { Box, BoxFlag, makeBox } from '../../src/scene/boxes';
import { GWOT_FINISH, GWOT_PALETTE, ROUGH_CLOTH, gwotAs, type GwotMat, type GwotSim } from '../../src/scene/gwotPalette';
import { gwotKit, type GwotHost, type GwotKit, type RugStyle } from '../../src/scene/gwotKit';
import { MARKING_TEXEL, mkHash } from '../../src/scene/markings';
import { paletteName, surfOf } from '../../src/game/particleFx';
import { breakClassOf, steelGrey } from '../../src/game/furnblast';
import { DRESS_GROUP } from '../../src/game/destructionSwitch';
import { isLived } from '../../src/scene/lived';
import { flatsOverlap, isFlat, layFlats } from './flatLayers';

export const LOOK_GROUP = 'look';
/** what every look file's NOTES say after the plain file's own (each tools/levels/<name>-gwot.ts wrapper appends it) */
export const LOOK_NOTE = ' — IN THE DEFAULT LOOK (2010s GWOT: tools/levels/gwotSkin.ts): the same boxes repainted, decals added; what a man collides with, hides behind or sees through is the plain file\'s.';
const lum = (a: Vec3) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const h01 = (a: number, b: number, c = 0) => (mkHash(a | 0, b | 0, c | 0) % 4096) / 4096;

/** what a rule is shown of a box */
export interface SkinCtx {
  i: number; b: Box; group: string;
  /** the office paint it wears (undefined = a colour of the generator's own) */
  name: string | undefined;
  y0: number; y1: number; thin: number; long: number;
  /** stands from the floor to (near) the ceiling */
  full: boolean;
  /** unnamed grey steel that a blast takes apart as a sheet and a carcass (furnblast.ts) */
  steel: boolean;
  /** 0‥1, the same for every box of this group */
  gh: number;
}
/** a rule's answer: a paint, or null = leave the box as it is */
export type Pick = GwotMat | null;
export interface Skin {
  /** the level's own rules, asked FIRST (undefined = no opinion: the shared rules answer) */
  pick?: (c: SkinCtx) => Pick | undefined;
  /** the shell and yard walls' stuff, and what the house is rendered in */
  wall?: GwotMat; house?: GwotMat; inner?: GwotMat;
  /** outdoor ground, the verge, the yard inside the perimeter */
  ground?: GwotMat; verge?: GwotMat;
  /** indoor floors by the office paint they wore */
  floor?: Partial<Record<string, GwotMat>>;
  /** frames of outside / inside doors */
  frameOut?: GwotMat; frameIn?: GwotMat;
  /** rooms (scenarios.roomClear.rooms ids) that get NO rug, and a style for the ones that should not take the dice's */
  noRug?: RegExp; rugs?: Record<string, RugStyle>;
  /** the damp foot on outside walls (default on) */
  skirts?: boolean;
  /** how many patches the dice scatter on the outdoor ground (default 10: wear is laid by RULE — at doors, along walls — and the dice add little) */
  patches?: number;
  /** what the metal furniture is painted (default METALS — mostly army olive: a barracks; a family house lists its own) */
  metals?: GwotMat[];
  /** the painted dado of the rooms that are lived in (default paintBlue; null = none) */
  dado?: GwotMat | null;
  /** MORE ROOMS for the dado and rug rules than the scenarios name (they list the HELD rooms only, so a dressed room would mark a held one; a level with no
   *  room clear names none at all): the same shape, asked after the scenarios' own — an id already there is not taken twice */
  rooms?: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[];
  /** the level's own decals, after the automatic ones — `G` adds NoShadow boxes only (anything else throws) */
  dress?: (G: GwotKit, level: Level, T: SkinTools) => void;
}
/** what a level's `dress` is handed beside the kit: a flat decal in any colour, the floor's paint at a place, a tone of a colour */
export interface SkinTools { flat: (x: number, z: number, w: number, d: number, albedo: Vec3, yaw?: number, y?: number) => number; floorAt: (x: number, z: number) => Vec3 | null; tone: (a: Vec3, k: number) => Vec3 }
export interface SkinStats { repainted: number; kept: number; decals: number; props: number; by: Record<string, number>;
  /** flat decals raised so the picture can order them (flatLayers.ts), the highest top face among them (m), and how many now stand over a flat of the level they lay under */
  relaid?: number; flatTop?: number; surfaced?: number }

const METALS: GwotMat[] = ['olive', 'olive', 'galv', 'rust', 'iron', 'tin', 'paintGreen', 'olive'];
const BLANKETS: GwotMat[] = ['blanketBrown', 'canvas', 'coyote'];   // (never blanketGrey here: a plain grey reads as a steel cabinet to a blast, and these were not)
const CHAIRS: GwotMat[] = ['blanketBrown', 'canvas', 'coyote', 'blanketBrown', 'rugRed'];   // (the levels' chairs are swivel chairs: cloth, never the white of a plastic garden chair — white shows the five-star base from above)
const RUG_DICE: RugStyle[] = ['afghan', 'baluch', 'kilim', 'afghan', 'kilim', 'baluch'];
const WORK_ROOM = /kitchen|galley|wash|shed|garage|plant|cage|dock|bay|staging|arms|store|hall|lockers|corridor|spine|hut/i;

/** THE SHARED RULES: what a box of this group, in this office paint, wears in the look */
function sharedPick(c: SkinCtx, S: Skin): Pick {
  const { group: g, name: n } = c;
  if (n === 'black' || n === 'screenOff' || n === 'glass' || n === 'glassExt' || n === 'cardboard' || n === 'red' || n === 'plant') return null;
  if (g === 'ground') return n === 'asphalt' ? S.ground ?? 'dust' : n === 'grass' ? S.verge ?? 'dirt' : null;
  if (g === 'floors') {
    if (n && S.floor?.[n]) return S.floor[n]!;
    return n === 'lino' ? 'mudFloor' : n === 'concrete' || n === 'stone' ? 'slab' : n === 'carpet' ? 'rugCream' : n === 'grass' ? 'scrub' : n === undefined ? (lum(c.b.albedo) < 0.19 ? 'dirt' : 'block') : null;
  }
  if (g === 'ceiling') return null;
  if (g.startsWith('walls.')) {
    if (n === 'concrete') return g === 'walls.outbuildings' ? S.house ?? 'render' : S.wall ?? 'mud';
    if (n === 'partTan' || n === 'partRed' || n === 'partBlue') return S.house ?? 'render';
    if (n === 'wall') return S.inner ?? 'whitewash';
    if (n === 'glassFrame') return S.frameOut ?? 'paintBlue';
    if (n === 'ceiling' || n === 'white') return S.inner ?? 'whitewash';
    return n === undefined ? (c.steel ? 'tin' : lum(c.b.albedo) < 0.2 ? S.frameOut ?? 'paintBlue' : null) : null;
  }
  if (g.startsWith('doorframe.')) return n === undefined ? (lum(c.b.albedo) < 0.215 ? S.frameOut ?? 'paintBlue' : S.frameIn ?? 'poplar') : null;
  if (g === 'beacons' || g === 'exterior.lamps') return null;
  // furniture and yard things
  if (n === 'wood') return 'poplar';
  if (n === 'woodDark') return 'woodGrey';
  if (n === 'metal') { const ms = S.metals ?? METALS; return ms[Math.floor(c.gh * ms.length) % ms.length]; }
  if (n === 'white') return c.full ? S.inner ?? 'whitewash' : 'plasticWhite';
  if (n === 'concrete') return S.wall ?? 'mud';
  if (n === 'partTan') return 'canvas';
  if (n === 'carpetRed' || n === 'carpetBlue' || n === 'carpet') return n === 'carpetBlue' ? 'rugNavy' : 'rugRed';
  if (n === undefined) {
    const a = c.b.albedo;
    if (c.steel) return lum(a) > 0.7 ? null : c.gh < 0.5 ? 'olive' : 'galv';   // (white enamel stays: a fridge is a fridge)
    if (a[1] > a[0] && a[1] > a[2] && lum(a) > 0.15 && lum(a) < 0.4 && c.y1 < 1.0) return BLANKETS[Math.floor(c.gh * 7 + c.i) % BLANKETS.length];   // (the cots' green blankets)
  }
  return null;
}

/** Change `level`'s clothes in place (see the head). `groups` is the exporter's per-box group list; decals are appended to both. */
export function skinLevel(level: Level, groups: string[], S: Skin = {}): SkinStats {
  const boxes = level.boxes, n0 = boxes.length; const st: SkinStats = { repainted: 0, kept: 0, decals: 0, props: 0, by: {} };
  const fixture = new Set<number>(); for (const s of level.switchables) for (const bi of s.boxes) fixture.add(bi); for (const l of level.lights) if (l.fixtureBox !== undefined && l.fixtureBox >= 0) fixture.add(l.fixtureBox);
  for (const bi of level.breaker?.boxes ?? []) fixture.add(bi); for (const bc of level.beacons ?? []) fixture.add(bc.box);   // (the breaker panel and the beacons are the game's own things: found by index, shot at, lit)
  const bad: string[] = [];
  for (let i = 0; i < n0; i++) {
    const b = boxes[i], g = groups[i];
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1], maxH = Math.max(b.h[0], b.h[1], b.h[2]);
    const lit = b.emissive[0] + b.emissive[1] + b.emissive[2] > 0;
    if (lit || fixture.has(i) || g === DRESS_GROUP || (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary)) || (maxH <= 0.2 && y0 > 0.3) || ((b.flags & BoxFlag.NoShadow) && y1 > 0.1)) { st.kept++; continue; }
    const name = paletteName(b.albedo), surf0 = surfOf(b.albedo), steel = !name && steelGrey(b.albedo);
    const c: SkinCtx = { i, b, group: g, name, y0, y1, thin: Math.min(b.h[0], b.h[2]) * 2, long: Math.max(b.h[0], b.h[2]) * 2, full: y0 <= 0.1 && y1 >= 2.2, steel, gh: (hashStr(g) % 4096) / 4096 };
    const own = S.pick?.(c); const m = own !== undefined ? own : sharedPick(c, S);
    if (!m) { st.kept++; continue; }
    const sim: GwotSim = (name ?? (steel ? (surf0 === 'drywall' ? '~steelPale' : '~steel') : '~' + surf0)) as GwotSim;
    const before = { name, surf: surf0, cls: breakClassOf(b.albedo), steel: steelGrey(b.albedo), dark: lum(b.albedo) > 0.1, pale: lum(b.albedo) > 0.7 };
    const old = b.albedo; b.albedo = gwotAs(m, sim); b.rough = GWOT_FINISH[m]?.rough ?? ROUGH_CLOTH;
    if (!c.full) { if (GWOT_FINISH[m]?.metal) b.metal = true; else delete b.metal; }
    // THE CHECK: the game's own classifiers say the same of the box as before (a round, a charge, a blast and the destruction index read nothing else of a paint)
    const after = { name: paletteName(b.albedo), surf: surfOf(b.albedo), cls: breakClassOf(b.albedo), steel: steelGrey(b.albedo), dark: lum(b.albedo) > 0.1, pale: lum(b.albedo) > 0.7 };
    const ground = y1 <= 0.02;
    if (after.name !== before.name || after.surf !== before.surf || after.cls !== before.cls || (!ground && (after.steel !== before.steel || after.dark !== before.dark || (!name && after.pale !== before.pale))))   // (a slab of floor is never a cabinet, a sheet of paper or clutter)
      bad.push(`box ${i} [${g}] ${name ?? old.join(',')} → ${m}: ${JSON.stringify(before)} ≠ ${JSON.stringify(after)}`);
    st.repainted++; st.by[m] = (st.by[m] ?? 0) + 1;
  }
  if (bad.length) throw new Error(`skinLevel: ${bad.length} repaint(s) would change what the simulation reads\n  ${bad.slice(0, 12).join('\n  ')}`);

  // props: the same bodies in other paint
  level.props.forEach((p: PropDef, k) => {
    const pick = (a: Vec3): GwotMat | null => p.kind === 'chair' ? (lum(a) < 0.06 ? null : CHAIRS[(k * 7 + 3) % CHAIRS.length]) : p.kind === 'bin' ? (['olive', 'drumBlue', 'rust'] as GwotMat[])[k % 3] : p.kind === 'plant' ? (a[1] > a[0] ? (k % 2 ? 'scrub' : 'straw') : 'mudDark') : null;
    let any = false; for (const part of p.parts) { const m = pick(part.albedo); if (!m) continue; const a = part.albedo, name = paletteName(a), steel = !name && steelGrey(a), surf = surfOf(a);
      // (a prop that a blast takes apart is classed by its parts' paint like any box: the new paint stands for the old)
      const next = gwotAs(m, (name ?? (steel ? (surf === 'drywall' ? '~steelPale' : '~steel') : '~' + surf)) as GwotSim);
      if (paletteName(next) !== name || surfOf(next) !== surf || breakClassOf(next) !== breakClassOf(a) || steelGrey(next) !== steelGrey(a)) throw new Error(`skinLevel: prop ${k} (${p.kind}) part ${a.join(',')} → ${m} would change what the simulation reads`);
      part.albedo = next; any = true; }
    if (any) st.props++;
  });

  // decals: a host that takes NoShadow boxes only
  const host: GwotHost = {
    add: b => { if (!((b.flags ?? 0) & BoxFlag.NoShadow) || (b.flags ?? 0) & ~BoxFlag.NoShadow) throw new Error(`skinLevel: the look may only add NoShadow decals (got flags ${b.flags ?? 0} at ${b.c.join(',')})`);
      if (b.c[1] - b.h[1] > 0.06) throw new Error(`skinLevel: a decal of the look starts at the floor (this one at ${(b.c[1] - b.h[1]).toFixed(2)} m, ${b.c.join(',')}) — see the head`);
      boxes.push(makeBox(b)); groups.push(LOOK_GROUP); st.decals++; return boxes.length - 1; },
    prop: () => { throw new Error('skinLevel: the look adds no props'); }, wallX: () => { throw new Error('skinLevel: the look adds no walls'); }, wallZ: () => { throw new Error('skinLevel: the look adds no walls'); },
    lights: [], switchables: [], marks: true, texel: MARKING_TEXEL,
  };
  const G = gwotKit(host);
  // the floor a decal lies on (the topmost flat thing there, in the paint it wears now), and a tone of it: wear is its own ground darker — never a colour laid on it
  const bare = boxes.slice(0, n0).filter((_, i) => !isLived(groups[i]));   // (LIVED-IN ROOMS, src/scene/lived.ts: the decals are dealt as if the furniture were not there — the same decals with that switch on or off)
  const flats = bare.filter(b => !b.yaw && !(b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass)) && b.c[1] + b.h[1] <= 0.06 && b.h[0] > 0.4 && b.h[2] > 0.4);
  const floorAt = (x: number, z: number): Vec3 | null => { let best: Box | null = null, top = -1e9; for (const b of flats) if (Math.abs(b.c[0] - x) <= b.h[0] && Math.abs(b.c[2] - z) <= b.h[2] && b.c[1] + b.h[1] > top) { top = b.c[1] + b.h[1]; best = b; } return best ? best.albedo : null; };
  // (how high the topmost flat stands there: a ground decal is not laid where a flat stands over it — a runner, a threshold, the level's own rug — it would be buried, and take that flat's tone for a floor it does not lie on)
  const topAt = (x: number, z: number): number => { let top = -1e9; for (const b of flats) if (Math.abs(b.c[0] - x) <= b.h[0] && Math.abs(b.c[2] - z) <= b.h[2]) top = Math.max(top, b.c[1] + b.h[1]); return top; };
  const tone = (a: Vec3, k: number): Vec3 => [Math.round(a[0] * k * 1e4) / 1e4, Math.round(a[1] * k * 1e4) / 1e4, Math.round(a[2] * k * 1e4) / 1e4];
  const flat = (x: number, z: number, w: number, d: number, albedo: Vec3, yaw = 0, y = 0.011) => host.add({ c: [x, y, z], h: [w / 2, 0.002, d / 2], yaw, albedo, rough: 1, flags: BoxFlag.NoShadow });
  const roofs = bare.filter(b => (b.flags & BoxFlag.NoPrimary) && b.c[1] - b.h[1] >= 2.2 && b.h[0] >= 0.5 && b.h[2] >= 0.5 && !b.yaw);
  const roofed = (x: number, z: number) => roofs.some(b => Math.abs(b.c[0] - x) <= b.h[0] && Math.abs(b.c[2] - z) <= b.h[2]);
  // the damp foot of every outside wall face
  if (S.skirts !== false) for (let i = 0; i < n0; i++) {
    const b = boxes[i], g = groups[i]; if (!g.startsWith('walls.') || g === 'walls.interior' || b.yaw || (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow))) continue;
    if (b.c[1] - b.h[1] > 0.1 || b.c[1] + b.h[1] < 1.2) continue; const alongX = b.h[0] >= b.h[2], L = (alongX ? b.h[0] : b.h[2]) * 2, t = (alongX ? b.h[2] : b.h[0]) * 2; if (L < 0.9 || t > 0.6) continue;
    // (a long wall may run past a roof's end: the face is walked in half-metre steps and the foot laid on each run that stands under the sky)
    for (const side of [1, -1] as const) { const off = side * (t / 2 + 0.5), a0 = (alongX ? b.c[0] : b.c[2]) - L / 2, n = Math.max(1, Math.round(L / 0.5)), dl = L / n;
      const open = (k: number) => { const s = a0 + (k + 0.5) * dl; return !roofed(alongX ? s : b.c[0] + off, alongX ? b.c[2] + off : s); };
      for (let k = 0; k < n;) { if (!open(k)) { k++; continue; } let e = k; while (e < n && open(e)) e++;
        if ((e - k) * dl >= 0.9) { const s0 = a0 + k * dl, s1 = a0 + e * dl, line = alongX ? b.c[2] : b.c[0];
          G.skirt(alongX ? 'x' : 'z', line, s0, s1, side, 'mudDark', 0.45 + 0.15 * h01(i, side + 2), t);
          // the strip of ground along it, trodden and splashed darker: from above a wall's foot is foreshortened to nothing, and this is the line where it meets the ground
          const mid = (s0 + s1) / 2, ao = line + side * (t / 2 + 0.2), fa = floorAt(alongX ? mid : ao, alongX ? ao : mid);
          if (fa && topAt(alongX ? mid : ao, alongX ? ao : mid) < 0.0115) flat(alongX ? mid : ao, alongX ? ao : mid, alongX ? s1 - s0 : 0.4, alongX ? 0.4 : s1 - s0, tone(fa, 0.7), 0, (alongX ? 0.0100 : 0.0104) + (i % 19) * 0.00002); }   // (each wall's strip at a height of its own: two that cross never share a plane)
          k = e; } }
  }
  // a painted DADO round every room that is lived in (the rooms that get a rug), a scuffed dark band along a corridor or a hall — on every wall face that
  // looks into such a room, as far along the wall as the room goes
  const named = ((level.scenarios as { roomClear?: { rooms?: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[] } } | undefined)?.roomClear?.rooms ?? []);
  const rooms = [...named, ...(S.rooms ?? []).filter(r => !named.some(q => q.id === r.id))];
  const livedIn = (r: { id: string; bounds: { x0: number; x1: number; z0: number; z1: number } }) => !((S.noRug ?? WORK_ROOM).test(r.id) && !S.rugs?.[r.id]) && Math.min(r.bounds.x1 - r.bounds.x0, r.bounds.z1 - r.bounds.z0) >= 2.2;
  { const lived = rooms.filter(livedIn), ways = rooms.filter(r => !livedIn(r) && /corridor|spine|hall/i.test(r.id)), paint = S.dado === undefined ? 'paintBlue' : S.dado;
    const inOf = (rs: typeof rooms, x: number, z: number) => rs.some(r => x > r.bounds.x0 - 0.1 && x < r.bounds.x1 + 0.1 && z > r.bounds.z0 - 0.1 && z < r.bounds.z1 + 0.1);
    for (let i = 0; i < n0; i++) {
      const b = boxes[i], g = groups[i]; if (!g.startsWith('walls.') || b.yaw || (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow))) continue;
      const y1 = b.c[1] + b.h[1]; if (b.c[1] - b.h[1] > 0.1 || y1 < 0.85) continue; const alongX = b.h[0] >= b.h[2], L = (alongX ? b.h[0] : b.h[2]) * 2, t = (alongX ? b.h[2] : b.h[0]) * 2; if (L < 0.4 || t > 0.6) continue;
      for (const side of [1, -1] as const) { const off = side * (t / 2 + 0.3), a0 = (alongX ? b.c[0] : b.c[2]) - L / 2, n = Math.max(1, Math.round(L / 0.25)), dl = L / n, line = alongX ? b.c[2] : b.c[0];
        const kind = (k: number): 0 | 1 | 2 => { const s = a0 + (k + 0.5) * dl, x = alongX ? s : line + off, z = alongX ? line + off : s; return paint && inOf(lived, x, z) ? 1 : inOf(ways, x, z) ? 2 : 0; };
        for (let k = 0; k < n;) { const kd = kind(k); if (!kd) { k++; continue; } let e = k; while (e < n && kind(e) === kd) e++;
          if ((e - k) * dl >= 0.4) G.skirt(alongX ? 'x' : 'z', line, a0 + k * dl, a0 + e * dl, side, kd === 1 ? paint! : 'mudDark', Math.min(kd === 1 ? 1.1 : 0.9, y1), t); k = e; } }
    } }
  // a rug in every room that is lived in (the rooms the scenarios name)
  rooms.forEach((r, k) => {
    if (!livedIn(r)) return;
    const w = r.bounds.x1 - r.bounds.x0, d = r.bounds.z1 - r.bounds.z0;
    const style = S.rugs?.[r.id] ?? RUG_DICE[(hashStr(r.id) + k) % RUG_DICE.length];
    // (laid by hand: a degree or three off the walls, never against one, and a second rug a clear gap from the first)
    const yaw = ((hashStr(r.id) % 7) - 3) * 0.0175, cx = (r.bounds.x0 + r.bounds.x1) / 2, cz = (r.bounds.z0 + r.bounds.z1) / 2, wide = w > d, long = Math.max(w, d);
    let rw = Math.min(3.2, Math.max(1.4, w * 0.5)), rd = Math.min(3.2, Math.max(1.2, d * 0.5));
    const two = long > 6.5, GAP = 0.4, S2 = 1.4; let rl = wide ? rw : rd; if (two) { rl = Math.min(rl, long - 1.0 - GAP - S2); if (wide) rw = rl; else rd = rl; }
    const sh = two && rl >= 1.4 ? (GAP + S2) / 2 : 0;
    // (a room the level already laid a rug in keeps that one — it wears the look's paint by now — and gets none on top: two rugs at one height fight for every pixel)
    if (flats.some(b => b.c[1] + b.h[1] >= 0.018 && Math.min(b.c[0] + b.h[0], r.bounds.x1) - Math.max(b.c[0] - b.h[0], r.bounds.x0) > 0.3 && Math.min(b.c[2] + b.h[2], r.bounds.z1) - Math.max(b.c[2] - b.h[2], r.bounds.z0) > 0.3)) return;
    G.rug(cx - (wide ? sh : 0), cz - (wide ? 0 : sh), rw, rd, style, yaw);
    if (sh) { const o = -sh + rl / 2 + GAP + S2 / 2; G.rug(cx + (wide ? o : 0), cz + (wide ? 0 : o), wide ? S2 : 1.8, wide ? 1.8 : S2, style === 'kilim' ? 'afghan' : 'kilim', -yaw * 1.5); }
  });
  // WEAR AT EVERY DOOR: the floor trodden darker either side of the leaf — it says where people walk, and it finds the doors for the eye
  for (const [di, dr] of level.doors.entries()) { const lift = (di % 16) * 0.00002, ux = Math.cos(dr.closedDir), uz = Math.sin(dr.closedDir), mx = dr.hinge[0] + ux * dr.width / 2, mz = dr.hinge[1] + uz * dr.width / 2;
    for (const side of [1, -1]) { const nx = -uz * side, nz = ux * side, fa = floorAt(mx + nx * 0.6, mz + nz * 0.6); if (!fa || topAt(mx + nx * 0.6, mz + nz * 0.6) > 0.0105) continue;
      flat(mx + nx * 0.72, mz + nz * 0.72, 1.3, 1.3, tone(fa, 0.84), -dr.closedDir, 0.0108 + lift); flat(mx + nx * 0.5, mz + nz * 0.5, 0.9, 0.9, tone(fa, 0.72), -dr.closedDir, 0.0112 + lift); } }   // (two doors a stride apart overlap: each door's wear at a height of its own)
  // the outdoor ground: drifts of gravel, darker earth, a damp spot — where the dice say, never under a roof
  { const N = S.patches ?? 10; const mats: GwotMat[] = ['dirt', 'gravel', 'mudFloor', 'dirt', 'damp', 'gravel']; let put = 0;
    // (over the level's OWN ground — the slabs of the group 'ground' — and never where something stands: a patch half under a hut or a wall reads as a mistake)
    const gr = boxes.slice(0, n0).filter((_, i) => groups[i] === 'ground'); if (gr.length === 0) gr.push(...bare.filter(b => b.c[1] + b.h[1] <= 0.02));
    let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity; for (const b of gr) { X0 = Math.min(X0, b.c[0] - b.h[0]); X1 = Math.max(X1, b.c[0] + b.h[0]); Z0 = Math.min(Z0, b.c[2] - b.h[2]); Z1 = Math.max(Z1, b.c[2] + b.h[2]); }
    const stood = boxes.slice(0, n0).filter((b, i) => groups[i] !== 'ground' && !isLived(groups[i]) && !(b.flags & BoxFlag.NoPrimary) && b.c[1] - b.h[1] < 0.5 && b.c[1] + b.h[1] > 0.02);
    const clear = (x: number, z: number, r: number) => !stood.some(b => { const e = b.yaw ? Math.hypot(b.h[0], b.h[2]) : -1; return e >= 0 ? Math.hypot(b.c[0] - x, b.c[2] - z) < e + r : Math.abs(b.c[0] - x) < b.h[0] + r && Math.abs(b.c[2] - z) < b.h[2] + r; });
    for (let k = 0; k < N * 8 && put < N && X1 > X0; k++) { const x = X0 + 1.5 + h01(k, 11) * (X1 - X0 - 3), z = Z0 + 1.5 + h01(k, 12) * (Z1 - Z0 - 3); if (roofed(x, z)) continue;
      const w = 1.2 + h01(k, 13) * 2.4, d = 0.8 + h01(k, 14) * 1.5; if (!clear(x, z, Math.min(w, d) * 0.35)) continue;
      // (a patch is DARKER than the ground it lies on — a paler one reads as a sheet somebody dropped — and three boxes over each other, so it has no one outline)
      const fa = floorAt(x, z); if (!fa) continue; let m = mats[mkHash(k, 15, 0) % mats.length]; if (lum(GWOT_PALETTE[m]) > lum(fa) * 0.88) m = lum(GWOT_PALETTE.dirt) <= lum(fa) * 0.88 ? 'dirt' : 'damp'; if (lum(GWOT_PALETTE[m]) > lum(fa) * 0.88 || lum(GWOT_PALETTE[m]) < lum(fa) * 0.3) continue;
      const yaw = h01(k, 16) * Math.PI, ca = Math.cos(yaw), sa = Math.sin(yaw);
      // (each box of it lies whole on open ground — its corners too: a corner under a wall shows indoors, on the room's floor — and each patch at a height of its own, so two that cross never share a plane)
      const fits = (px: number, pz: number, pw: number, pd: number, pyaw: number) => { const c = Math.cos(pyaw), n = Math.sin(pyaw); return [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].every(([i, j]) => { const qx = px + c * i * pw / 2 + n * j * pd / 2, qz = pz - n * i * pw / 2 + c * j * pd / 2; return !roofed(qx, qz) && clear(qx, qz, 0.05) && topAt(qx, qz) < 0.0105; }); };
      if (!fits(x, z, w, d, yaw)) continue;
      const lift = put * 0.00003, lay = (px: number, pz: number, pw: number, pd: number, pyaw: number, y: number) => { if (fits(px, pz, pw, pd, pyaw)) G.patch(px, pz, pw, pd, m, pyaw, y + lift); };
      lay(x, z, w, d, yaw, 0.012); lay(x + ca * w * 0.22, z - sa * w * 0.22, w * 0.7, d * 0.75, yaw + 0.55, 0.0125); lay(x - ca * w * 0.2 + sa * d * 0.15, z + sa * w * 0.2 + ca * d * 0.15, w * 0.5, d * 0.6, yaw - 0.6, 0.013); put++; } }
  S.dress?.(G, level, { flat, floorAt, tone });
  if (host.lights.length || host.switchables.length) throw new Error(`skinLevel: the look adds no lights (${host.lights.length} lights, ${host.switchables.length} switchables came from the level's dress)`);
  // THE FLAT DECALS IN ORDER (flatLayers.ts): the heights above tell two that cross apart by 20 µm, which the depth buffer cannot see at the camera's distance —
  // where two of different paint overlap, the upper one is raised until it can
  // (and where one lies on a thin flat of the level itself — a threshold, a mat — it keeps the same step over that)
  { const fl = boxes.slice(n0).filter(isFlat), under = boxes.slice(0, n0).filter(b => !(b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass)) && b.c[1] + b.h[1] <= 0.05 && b.c[1] + b.h[1] > 0.0105), r = layFlats(fl, b => b.albedo, undefined, under); st.relaid = r.moved; st.flatTop = r.top;
    st.surfaced = [...r.was].filter(([b, t0]) => flats.some(f => f.c[1] + f.h[1] > t0 && f.c[1] + f.h[1] < b.c[1] + b.h[1] && flatsOverlap(b, f))).length; }
  return st;
}
