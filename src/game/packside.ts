// PACK SIDE — a long thing a man carries on his back rides STRAPPED UPRIGHT AT THE SIDE OF THE PACK HE WEARS THERE, and moves with the pack (the maintainer,
// 10-18, of Sam's slung rifle through his radio and the breacher's back: "maybe we find a way to put equipment on the side of it? like a hammer would be on a
// strap to the side of a pack?").
//
// WHAT WAS OFF. The operators' back kit is part of the worn mesh (tools/chars build_cast.py `kit_*`: the lead's radio, the breacher's ram, the rifleman's pack,
// the hydration carrier, the medic's pack — rigid on the chest joint). The big slot's hammer and shotgun and Sam's slung rifle are boxes laid DIAGONALLY ACROSS
// the back off the back's own frame (rigProps.ts BIGRIG / RIG.sc20k.slung), placed against a bare back: on a man with a pack they lie inside it (the hammer's
// handle through the radio set, all of it inside the medic's pack), and the breacher's modelled ram crosses whichever real tool his card hands him.
//
// THE RULE (one switch):
//   1. THE TOOL IS AT THE PACK'S RIGHT SIDE, UPRIGHT. With a `kit_*` part worn, the hammer stands handle down along the pack's right face, its head lying across
//      just over the pack's top corner behind the right shoulder (where the hand that goes over that shoulder finds the handle under it); the shotgun stands
//      muzzle down in the same place, flat to the pack's face. Placed in the mesh's BIND space off the pack's own extents (read off the worn part once a cast)
//      and carried by the chest joint's skin matrix — the very matrix the pack's vertices ride — so its top end and its distance from the pack's face cannot
//      move against the pack. ITS LOWER END RESTS ON HIS BACK: the thing turns about its top end in the pack's own upright plane (never across the pack's
//      face) until it lies on the line of his back as he stands, bends or crouches — the rearmost of his trunk and seat under it, read off the mesh once a
//      cast and carried by the joints that carry them (a rigid 90 cm handle on a man bent double is a pole behind him otherwise).
//   2. A RIFLE ACROSS THAT BACK goes to the pack's LEFT side the same way (Sam in his kit with the rifle on his back: a quiet mission with the suit off, or kit
//      handling off — the page as it ships hangs it in front on a loud mission and wears no pack on a quiet one).
//   3. THE BREACHER'S MODELLED RAM IS WORN ONLY WHILE HE CARRIES NO REAL TOOL (`ram`): with a hammer or a shotgun in his big slot he wears the small assault
//      pack instead (cast.ts castParts), the tool at its side — one long thing on his back, not three.
//   4. THE HAND GOES WHERE THE DRAWER HAS IT: the fist that takes the hammer's handle is DRAWN there (combat.ts hammerSide → CharacterAnimator.bigSide, the
//      chest joint's own space → Character.packSidePass: the picture's second pose, as IN HAND's — the pose the game reads keeps the fist where it always went).
// A man with no pack (the sneaking suit, a variant without one, the mannequin) carries everything where he always did.
//
// LOOKS ONLY: boxes and a mask. Nothing the simulation reads moves; a run with it on is the run with it off.
// Off (the module's default, the frozen stand): the build as it was.
// A leaf: nothing here is built from another game module's exports (src/game is one import cycle).

import type { Vec3 } from '../math/vec';
import { SideMap } from '../math/side';

/** `on`: the switch · `ram`: half 3 of the rule · `gap`: m of air between the pack's face and the thing beside it · `handle`: bind z of the hammer's
 *  handle's line (the operators' own back stands to −0.20 beside the spine, at the shoulder blades and the belt's pouches; the head, 4.5 cm through, lies
 *  over the shoulder's top where the back is at −0.185) · `gun`: bind z of a long gun's top face · `over`: m the hammer's head clears the pack's top corner
 *  by · `headMin`: the lowest its middle rides, bind y (the top of the shoulder blades: a head lower than that lies in them) · `butt`: bind y of the top of a
 *  long gun stood at the side (its butt end, behind the shoulder) · `rest`: m of air kept between the thing and the back it lies along · `pitch0`‥`pitch1`:
 *  rad, how far it may turn about its top end off the pack's upright (+ = its lower end toward him) */
export const PACKSIDE = { on: false, ram: true, gap: 0.012, handle: -0.258, gun: -0.24, over: 0.012, headMin: 1.5, butt: 1.56, rest: 0.012, pitch0: -0.1, pitch1: 1.3 };

/** the back kit a man wears, in the mesh's bind space (metres; +x his left, +y up, +z his front): its sides, its top over the strip of each side a hammer's
 *  head overhangs, and how deep it stands */
export interface PackExt { part: number; x0: number; x1: number; top0: number; top1: number; z0: number; z1: number }
/** a point of his back's line under a thing at a pack's side: the rearmost vertex of a 4 cm band of height, and the joint that carries it */
interface BackPt { j: number; y: number; z: number }
interface Memo { j3: number; ext: (PackExt | null)[]; kit: number; ram: number; pack: number; body: number; back: Map<number, BackPt[]> }
/** what the rule reads of a character set (anim/gltf.ts GltfCharacter with a cast) */
export interface PackChar { cast?: { parts: string[]; variants?: { side: string; mask: number }[] } | null; mesh: { positions: Float32Array; part?: Uint8Array; vertexCount: number; joints: ArrayLike<number>; weights: ArrayLike<number> }; skin: { joints: number[]; inverseBind: Float32Array }; nodeByName: Map<string, number>; nodes: { name: string }[] }
const memo = new SideMap<object, Memo>('packside.memo'); memo.asMemo();   // (a pure function of the cast file every game shares)

const STRIP = 0.075;      // the strip of a side whose top the hammer's head must clear: its head reaches this far in over the pack
const Y0 = 0.9, Y1 = 1.62, ZB = -0.15;   // the part of a kit that is ON THE BACK: behind the spine and between belt and collar (a handset on the chest, a drinking tube over the shoulder and an aerial's blade are not what a tool lies against)
function memoOf(ch: PackChar): Memo | null {
  const cast = ch.cast; if (!cast || !ch.mesh.part) return null;
  let m = memo.get(ch); if (m) return m;
  const P = ch.mesh.positions, part = ch.mesh.part, n = cast.parts.length;
  const ext: (PackExt | null)[] = cast.parts.map(() => null); let kit = 0;
  cast.parts.forEach((name, i) => { if (name.startsWith('kit_')) { kit = (kit | (1 << i)) >>> 0; ext[i] = { part: i, x0: Infinity, x1: -Infinity, top0: -Infinity, top1: -Infinity, z0: Infinity, z1: -Infinity }; } });
  for (let v = 0; v < ch.mesh.vertexCount; v++) { const e = part[v] < n ? ext[part[v]] : null; if (!e) continue;
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; if (z > ZB || y < Y0 || y > Y1) continue;
    if (x < e.x0) e.x0 = x; if (x > e.x1) e.x1 = x; if (z < e.z0) e.z0 = z; if (z > e.z1) e.z1 = z; }
  for (let v = 0; v < ch.mesh.vertexCount; v++) { const e = part[v] < n ? ext[part[v]] : null; if (!e) continue;
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; if (z > ZB || y < Y0 || y > Y1) continue;
    if (x < e.x0 + STRIP && y > e.top0) e.top0 = y; if (x > e.x1 - STRIP && y > e.top1) e.top1 = y; }
  for (let i = 0; i < n; i++) if (ext[i] && !(ext[i]!.x0 < ext[i]!.x1)) ext[i] = null;   // (a kit with nothing on the back)
  const bit = (name: string) => { const i = cast.parts.indexOf(name); return i < 0 ? 0 : (1 << i) >>> 0; };
  // what an operator wears that is not back kit: the trunk and the seat a thing at a pack's side lies along
  let body = 0; for (const v of cast.variants ?? []) if (v.side === 'operator') body = (body | v.mask) >>> 0; if (!body) body = 0xffffffff; body = (body & ~kit) >>> 0;
  m = { j3: ch.skin.joints.indexOf(ch.nodeByName.get('DEF-spine.003') ?? -1), ext, kit, ram: bit('kit_breacher'), pack: bit('kit_rifleman'), body, back: new Map() };
  memo.set(ch, m); return m;
}
/** the pack a man drawn with this part mask wears on his back — null with the switch off, no cast, or none worn */
export function packOf(ch: PackChar, mask: number): PackExt | null {
  if (!PACKSIDE.on) return null;
  const m = memoOf(ch); if (!m || m.j3 < 0 || !(mask & m.kit)) return null;
  for (let i = 0; i < m.ext.length; i++) if (m.ext[i] && (mask >>> i) & 1) return m.ext[i];
  return null;
}
/** HALF 3: the mask to draw a man with while he carries a real tool on his back — the breacher's modelled ram gives way to the small assault pack (a cast with
 *  neither part by name: the mask as it was) */
export function packMask(ch: PackChar, mask: number, carries: boolean): number {
  if (!PACKSIDE.on || !PACKSIDE.ram || !carries) return mask;
  const m = memoOf(ch); if (!m || !m.ram || !m.pack || !(mask & m.ram)) return mask;
  return ((mask & ~m.ram) | m.pack) >>> 0;
}

/** a thing's place at a pack's side: its group frame's origin and axes (`z` its long line: a hammer's butt → head, a gun's bore), in whatever space it is asked
 *  in. In the bind space also what it turns about to lie along his back: `pivot` its top end (the hammer's head, a gun's butt), `len` m from there to its
 *  lower end, `r` m its body-side face stands off the line through the pivot. */
export interface SidePlace { o: Vec3; x: Vec3; y: Vec3; z: Vec3; pivot?: Vec3; len?: number; r?: number }
/** … in the mesh's BIND space. `hammer`: `grip` = the frame's origin (the middle of the fist's grip) to the head's middle along the handle, `thick` the
 *  handle's half thickness, `head` the head's half extents [across — the frame's x —, through, along the handle]. A long gun (`shotgun`, `rifle`): `rear` =
 *  the origin to its butt end back along the bore, `thick` its half thickness across, `top` how far its top stands over the bore. The tool is on the RIGHT of
 *  the pack; a rifle on its LEFT. */
export function sideBind(e: PackExt, what: 'hammer' | 'shotgun' | 'rifle', dims: { grip?: number; thick: number; head?: Vec3; rear?: number; top?: number; len?: number }): SidePlace {
  const T = PACKSIDE;
  if (what === 'hammer') { const head = dims.head ?? [0.085, 0.045, 0.035], grip = dims.grip ?? 0.3;
    // the handle against the pack's right face, the head across over the pack's corner: its near end clears the top of the strip it overhangs, its body the shoulder blades
    const x = e.x0 - T.gap - dims.thick, yHead = Math.max(T.headMin, e.top0 + T.over + head[2]);
    return { o: [x, yHead - grip, T.handle], x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0], pivot: [x, yHead, T.handle], len: dims.len ?? 0.8, r: dims.thick }; }
  // a long gun: muzzle down, its flat side on the pack's face, its top to his back (the grip and the magazine stand away behind him)
  const left = what === 'rifle', x = left ? e.x1 + T.gap + dims.thick : e.x0 - T.gap - dims.thick;
  return { o: [x, T.butt - (dims.rear ?? 0.3), T.gun - (dims.top ?? 0.02)], x: [1, 0, 0], y: [0, 0, 1], z: [0, -1, 0], pivot: [x, T.butt, T.gun], len: dims.len ?? 0.8, r: 0 };
}

const BAND = 0.04, TRUNK = /^DEF-(hips|spine\.00[1-3]|thigh\.[LR])$/, REACH = 0.14;   // (the back's line is read no further out than the trunk is wide: a thing outboard of the hip lies at the depth of the hip beside it)
/** HIS BACK'S LINE under a lateral strip at bind x (4 cm either side): per band of height the rearmost vertex of what an operator wears that his trunk, his
 *  seat or his thighs carry */
function backLine(ch: PackChar, m: Memo, x: number): BackPt[] {
  const xc = Math.max(-REACH, Math.min(REACH, x)), key = Math.round(xc * 1000); let line = m.back.get(key); if (line) return line;
  const P = ch.mesh.positions, part = ch.mesh.part!, J = ch.mesh.joints, W = ch.mesh.weights, trunk = ch.skin.joints.map(n => TRUNK.test(ch.nodes[n]?.name ?? ''));
  const bands = new Map<number, BackPt>();
  for (let v = 0; v < ch.mesh.vertexCount; v++) { if (!((m.body >>> part[v]) & 1)) continue;
    const px = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; if (Math.abs(px - xc) > 0.04 || z > -0.02 || y < 0.45 || y > 1.62) continue;
    let b = 0; for (let k = 1; k < 4; k++) if (W[v * 4 + k] > W[v * 4 + b]) b = k; const j = J[v * 4 + b]; if (!trunk[j]) continue;
    const i = Math.floor(y / BAND), had = bands.get(i); if (!had || z < had.z) bands.set(i, { j, y, z }); }
  line = [...bands.values()]; m.back.set(key, line); return line;
}
/** HOW FAR A THING AT A PACK'S SIDE TURNS ABOUT ITS TOP END to lie along his back as posed (rad, + = its lower end toward him): the most it can before its
 *  body-side face comes within `rest` of the rearmost of him under it. `jd`: the skeleton's skin matrices (16 floats a joint, column-major). */
export function sidePitch(ch: PackChar, p: SidePlace, jd: ArrayLike<number>): number {
  const m = memoOf(ch), T = PACKSIDE; if (!m || m.j3 < 0 || !p.pivot) return 0;
  const a = m.j3 * 16, len = p.len ?? 0.8, r = (p.r ?? 0) + T.rest; let th = T.pitch1;
  for (const q of backLine(ch, m, p.pivot[0])) { const b = q.j * 16, x = p.pivot[0];
    // the point as its own joint carries it, back into the chest joint's bind space (the skin matrices are rigid)
    const wx = jd[b] * x + jd[b + 4] * q.y + jd[b + 8] * q.z + jd[b + 12] - jd[a + 12], wy = jd[b + 1] * x + jd[b + 5] * q.y + jd[b + 9] * q.z + jd[b + 13] - jd[a + 13], wz = jd[b + 2] * x + jd[b + 6] * q.y + jd[b + 10] * q.z + jd[b + 14] - jd[a + 14];
    const Y = jd[a + 4] * wx + jd[a + 5] * wy + jd[a + 6] * wz - p.pivot[1], Z = jd[a + 8] * wx + jd[a + 9] * wy + jd[a + 10] * wz - p.pivot[2], rho = Math.hypot(Y, Z);
    if (Y > -0.06 || rho > len + 0.04 || rho < r) continue;
    th = Math.min(th, Math.atan2(Z, -Y) - Math.asin(r / rho)); }
  return Math.max(T.pitch0, th);
}
/** a bind-space place turned `th` about its top end, in the pack's upright plane (its lower end toward him) */
export function sidePitched(p: SidePlace, th: number): SidePlace {
  if (!p.pivot || !th) return p; const c = Math.cos(th), s = Math.sin(th), v = p.pivot;
  const dir = (d: Vec3): Vec3 => [d[0], d[1] * c + d[2] * s, d[2] * c - d[1] * s];
  const rel = dir([p.o[0] - v[0], p.o[1] - v[1], p.o[2] - v[2]]);
  return { ...p, o: [v[0] + rel[0], v[1] + rel[1], v[2] + rel[2]], x: p.x, y: dir(p.y), z: dir(p.z) };
}
/** a bind-space place carried by a joint's skin matrix (16 floats, column-major, at `at` of `jd`): where the pack's own vertices would be */
export function sideSkinned(p: SidePlace, jd: ArrayLike<number>, at: number): SidePlace {
  const pt = (v: Vec3): Vec3 => [jd[at] * v[0] + jd[at + 4] * v[1] + jd[at + 8] * v[2] + jd[at + 12], jd[at + 1] * v[0] + jd[at + 5] * v[1] + jd[at + 9] * v[2] + jd[at + 13], jd[at + 2] * v[0] + jd[at + 6] * v[1] + jd[at + 10] * v[2] + jd[at + 14]];
  const dir = (v: Vec3): Vec3 => { const d: Vec3 = [jd[at] * v[0] + jd[at + 4] * v[1] + jd[at + 8] * v[2], jd[at + 1] * v[0] + jd[at + 5] * v[1] + jd[at + 9] * v[2], jd[at + 2] * v[0] + jd[at + 6] * v[1] + jd[at + 10] * v[2]], l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };
  return { o: pt(p.o), x: dir(p.x), y: dir(p.y), z: dir(p.z) };
}
/** the chest joint's place in the skin's list (−1: a skeleton without one) and its inverse bind matrix's offset */
export function chestJoint(ch: PackChar): number { return memoOf(ch)?.j3 ?? -1; }
/** … and a bind-space place in that joint's OWN space (the animator poses the joint: character.ts bigLayer) */
export function sideLocal(ch: PackChar, p: SidePlace): SidePlace | null { const j = chestJoint(ch); return j < 0 ? null : sideSkinned(p, ch.skin.inverseBind, j * 16); }
