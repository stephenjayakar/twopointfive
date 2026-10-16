// AN IR LIGHT ON THE GOGGLES (the maintainer, 10-15, of a depot whose rooms were flat black noise through the tube: "maybe we should model IR lights on the nvg
// so even totally dark rooms are visible. and we can assume enemies never have nvg"). A tube amplifies, it does not invent (nvg.ts): a room with no light of its
// own showed nothing through it. So the goggles carry what real ones carry — an infrared illuminator: a flood of light only a tube sees by.
//
//   WHO CARRIES ONE, AND WHEN IT BURNS. Sam, on every frame whose picture is the tube's (Player.nvAmount past 0.5, post.wgsl's own swap: it comes up with the
//     picture and goes with it — no tube frame is black for want of it, and no bare-eyed frame has it). On his knee at a
//     door with the wand under it (wand.ts WAND.nv) the flood is the lens's. A teammate (IRLIGHT.team; a man of nvg.ts: an operative unit of a scenario
//     whose card left him his goggles), whenever HIS are down (nvg.ts nvgDown). No key, no order: it is part of the goggles. Nobody else — an enemy has no night
//     vision and no infrared anything.
//   WHAT IT IS. A real light: a wide spot at his brow along the way he faces, tipped a little to the floor, shadowed by every wall, leaf and body like any other.
//     Its strength is said as what the TUBE makes of it (IRLIGHT.power: on-axis intensity × the picture's exposure — the tube counts exposed luminance, so the
//     flood reads the same through it at every hour and on every Brightness setting), not as a wattage.
//   WHO SEES BY IT. Only a tube. The lights are kept in a list of their own (render/lights.ts LightSet.ir), never in the list every other reader sums, and are
//     handed to the renderer flagged infrared: uploaded only on a frame whose picture IS the tube's, where each is a steady light like a torch (the frame
//     the tube comes off, the engine restarts every screen history: engine.ts), and given NOTHING by
//     the light meter (probe.wgsl → common.wgsl evalLightTrue) or the cascades its bounce comes from. So an enemy's eye, a camera's lens, Sam's own light meter
//     and every CPU light estimate read the room as it is without them — dark — by construction: the HUD's LIGHT bar stays where it was while the room shows.
//     A TEAMMATE'S TUBE reads them (IRLIGHT.team; nvg.ts nvgSight asks irOnMan for the man he looks at): a man standing in an illuminator's flood is lit to a
//     goggled eye and to no other. And a man who carries one is never 'too dark for the tube' (nvg.ts readPlace's `black`: the white-light fallback that file
//     kept for a room with no light at all retires — his goggles now show him the way everywhere he can face).
//
// IRLIGHT.on false = no such light anywhere: the picture and the run of the build before this file. IRLIGHT.team false = Sam's alone, in the picture alone —
// nothing in the simulation reads it, so the run is the one before this file, digest for digest (tools/qa/irlight-probes.ts holds both).
// Nothing is saved: the list is made again every frame from who has his goggles down. UNTUNED BY EYE: nothing here was seen on a GPU.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { Vec3, v3, clamp, DEG } from '../math/vec';
import type { RtLight } from '../render/lights';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { nvgDown, tubeVis, NVG } from './nvg';
import { wandEye, WAND } from './wand';

export const IRLIGHT = {
  /** off = no infrared light on anybody's goggles (the page turns it on: src/host/profile.ts; ?noirlight) */
  on: false,
  /** the teammates carry one too, and a goggled teammate sees a man standing in anybody's (off = Sam's only, a picture and nothing else) */
  team: true,
  /** how bright the flood reads THROUGH THE TUBE: on-axis intensity × the picture's exposure. 30: a wall six metres off reads a little over half the tube's
   *  range, the floor at the same distance about a third, and anything inside two metres is at the ceiling */
  power: 30,
  /** m it reaches (the shader's range window: full to about half of this, gone at it) */
  reach: 22,
  /** the flood's half angle, degrees, and where inside it the full strength ends */
  cone: 65, core: 40,
  /** how far below level it points, degrees (the floor ahead of him is most of what a view from above sees) */
  dip: 11,
};

const HEAD_Y = 1.62, LENS_AHEAD = 0.14, LENS_CLEAR = 0.3, LENS_R = 0.04;
interface Kit { sam: RtLight | null; men: Map<Guard, RtLight>; seen: Map<Guard, { t: number; E: number }> }
const kits = new WeakMap<Game, Kit>();
const kitOf = (g: Game): Kit => { let K = kits.get(g); if (!K) { K = { sam: null, men: new Map(), seen: new Map() }; kits.set(g, K); } return K; };
const lamp = (name: string, owner: number): RtLight => ({ name, group: 'infrared', kind: 1, pos: [0, -10, 0], dir: [0, 0, 1], color: [1, 1, 1], intensity: 0, range: IRLIGHT.reach,
  innerDeg: IRLIGHT.core, outerDeg: IRLIGHT.cone, radius: LENS_R, volumetric: 0, owner, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 0 });   // (volumetric 0: no beam in the haze — at the tube's gain its own back-scatter would be all it showed)

/** one man's illuminator posed for this frame: at his brow, along his aim, tipped down */
function pose(g: Game, L: RtLight, c: Character) {
  const head = c.bones.head ?? v3.add(c.pos, [0, HEAD_Y, 0]), fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw), dn = Math.sin(IRLIGHT.dip * DEG), fl = Math.cos(IRLIGHT.dip * DEG);
  // (a face against a wall or a leaf: the lens stays at the brow, this side of it — asked here whatever lighting.ts LIGHTWALL says, so that no flood ever starts beyond a wall)
  L.pos = g.col.segmentBlocked(head, [head[0] + fx * LENS_CLEAR, head[1], head[2] + fz * LENS_CLEAR]) ? v3.copy(head) : [head[0] + fx * LENS_AHEAD, head[1], head[2] + fz * LENS_AHEAD]; L.dir = [fx * fl, -dn, fz * fl];
  const S = g.engine.settings; L.intensity = L.peakIntensity = IRLIGHT.power / (S.exposure > 0 ? S.exposure : 1);
  L.range = IRLIGHT.reach; L.outerDeg = clamp(IRLIGHT.cone, 5, 89); L.innerDeg = Math.min(IRLIGHT.core, L.outerDeg - 0.5); L.enabled = true;
}
/** Sam's burns exactly while the picture is the tube's (0.5: post.wgsl's own swap, engine.ts's own test for handing the list over) — not by Player.nv: his
 *  goggles are asked for a few frames before the picture comes and lift a few before it goes (player.ts eases nvAmount, kitanim.ts holds the tube at his eyes) */
const samOn = (g: Game) => g.player.nvAmount > 0.5;
/** his lamp is out of the list: the renderer's slot memory of it goes with it (lights.ts upload maps last frame's slot to this frame's by the object) */
const out = (L: RtLight | null | undefined) => { if (L) { L.enabled = false; L.slot = -1; } };

/** Once a frame from Game.update, after everybody has moved and the doors have swung: the list of infrared lights (LightSet.ir) made again from whose goggles are down. */
export function irLightTick(g: Game) {
  const list = g.engine.lights.ir, K = kits.get(g);
  if (!IRLIGHT.on) { if (list.length) list.length = 0; if (K) { out(K.sam); K.men.clear(); K.seen.clear(); } return; }
  const kit = K ?? kitOf(g); list.length = 0; kit.seen.clear();
  if (samOn(g)) {
    const L = kit.sam ??= lamp('ir_sam', g.player.char.id); pose(g, L, g.player.char); list.push(L);
    // (the wand under a door, his goggles down — WAND.nv: the picture he is given is the lens's, so the flood is the lens's too, level along its look)
    const eye = WAND.nv ? wandEye(g) : null; if (eye) { L.pos = v3.copy(eye.pos); L.dir = [eye.look[0], 0, eye.look[2]]; }
  } else out(kit.sam);
  if (!IRLIGHT.team) { kit.men.clear(); return; }
  for (const gd of kit.men.keys()) if (!g.guards.includes(gd)) kit.men.delete(gd);
  for (const gd of g.guards) {
    if (gd.state === 'dead' || !nvgDown(g, gd)) { out(kit.men.get(gd)); continue; }
    let L = kit.men.get(gd); if (!L) { L = lamp(`ir_${gd.char.id}`, gd.char.id); kit.men.set(gd, L); }
    pose(g, L, gd.char); list.push(L);
  }
}

/** THE INFRARED LIGHT AT A POINT, W/m² as the light meter would report it if it read infrared (its best axis face; the shader's own terms — common.wgsl
 *  evalLightRaw: 1 / max(d², r²), the range window, the cone's smoothstep — shadowed by one segment test over the statics and the leaves, as guards.ts
 *  lightEstimateAt shadows the lights the meter does read). `skip`: a carrier's own light is not asked (a man is not lit by the lamp on his own brow). */
export function irLightAt(g: Game, P: Vec3, skip?: number): number {
  let E = 0;
  for (const l of g.engine.lights.ir) {
    if (!l.enabled || l.intensity <= 0 || (skip !== undefined && l.owner === skip)) continue;
    const dx = l.pos[0] - P[0], dy = l.pos[1] - P[1], dz = l.pos[2] - P[2], d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
    if (d > l.range || d < 1e-3) continue;
    const Lx = dx / d, Ly = dy / d, Lz = dz / d, cd = -(Lx * l.dir[0] + Ly * l.dir[1] + Lz * l.dir[2]), cO = Math.cos(l.outerDeg * DEG), cI = Math.cos(l.innerDeg * DEG);
    if (cd < cO) continue;
    const x = d / l.range, w = clamp(1 - x * x * x * x, 0, 1), s = clamp((cd - cO) / Math.max(cI - cO, 1e-6), 0, 1);
    const e = l.intensity * w * w / Math.max(d2, l.radius * l.radius) * s * s * (3 - 2 * s) * Math.max(Math.abs(Lx), Math.abs(Ly), Math.abs(Lz));
    if (e < 0.002) continue;
    const tmax = d - l.radius - 0.02; if (tmax > 0.05 && g.col.segmentBlocked(P, [P[0] + Lx * tmax, P[1] + Ly * tmax, P[2] + Lz * tmax])) continue;
    E += e;
  }
  return E;
}
/** the infrared light ON a man this frame, as a goggled teammate's tube takes it (nvg.ts nvgSight adds it to the light the meter reads on him): 0 with the
 *  switch or its team half off. Asked once a man a frame (many eyes ask of one man); the lights are last frame's, as the meter's own answer is. */
export function irOnMan(g: Game, o: Guard): number {
  if (!IRLIGHT.on || !IRLIGHT.team || !g.engine.lights.ir.length) return 0;
  const K = kitOf(g), had = K.seen.get(o); if (had && had.t === g.time) return had.E;
  const c = o.char, E = irLightAt(g, c.bones.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]], c.id);
  K.seen.set(o, { t: g.time, E }); return E;
}
/** would HIS OWN illuminator show him a standing man at P, if he looked that way with a clear line (doortools.ts: floor a jamb man's gun is across with his
 *  goggles down — the place's own light is no longer all his tube has)? The flood's on-axis strength at that distance on a man's upright face, through the
 *  tube, against the same floor nvg.ts calls black (NVG.blackAt). False with the switch or its team half off. */
export function irShowsAt(g: Game, m: Guard, P: Vec3): boolean {
  if (!irCarried()) return false;
  const c = m.char, dx = P[0] - c.pos[0], dz = P[2] - c.pos[2], d2 = Math.max(dx * dx + dz * dz, 0.25), d = Math.sqrt(d2); if (d >= IRLIGHT.reach) return false;
  const x = d / IRLIGHT.reach, w = clamp(1 - x * x * x * x, 0, 1), S = g.engine.settings;
  return tubeVis(g, IRLIGHT.power / (S.exposure > 0 ? S.exposure : 1) * w * w / d2) >= NVG.blackAt;
}
/** he carries an illuminator of his own (a teammate with goggles, the team half on): nvg.ts asks before it calls a place too dark for his tube */
export function irCarried(): boolean { return IRLIGHT.on && IRLIGHT.team; }

/** QA / the panel: whose illuminator burns */
export function irLightState(g: Game): { sam: boolean; men: Guard[]; shown: boolean } {
  const list = g.engine.lights.ir, K = kits.get(g);
  return { sam: !!K?.sam && list.includes(K.sam), men: K ? [...K.men].filter(([, L]) => list.includes(L)).map(([gd]) => gd) : [], shown: g.player.nvAmount > 0.5 };
}
/** 'IR light off: …' / 'IR light: yours on · Blue One · Blue Two — nobody without goggles sees it' */
export function irLightSummary(g: Game): string {
  if (!IRLIGHT.on) return 'IR light off: a room with no light of its own is black through the goggles';
  const S = irLightState(g);
  return `IR light: yours ${S.sam ? 'on' : 'off (goggles up)'}${IRLIGHT.team ? (S.men.length ? ' · ' + S.men.map(m => m.callsign).join(' · ') : ' · no teammate on goggles') : ' · the team carries none'} — only goggles see it`;
}
