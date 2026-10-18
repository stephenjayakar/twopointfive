// AN IR LIGHT ON THE GOGGLES (the maintainer, 10-15, of a depot whose rooms were flat black noise through the tube: "maybe we should model IR lights on the nvg
// so even totally dark rooms are visible. and we can assume enemies never have nvg"). A tube amplifies, it does not invent (nvg.ts): a room with no light of its
// own showed nothing through it. So the goggles carry what real ones carry — an infrared illuminator: a flood of light only a tube sees by.
//
//   WHO CARRIES ONE, AND WHEN IT BURNS. Sam, on the frames whose picture is the tube's (Player.nvAmount past 0.5, post.wgsl's own swap: it comes up with the
//     picture and goes with it — no bare-eyed frame has it) and, under IRLIGHT.auto below, only where his place is too dark for the tube. On his knee at a
//     door with the wand under it (wand.ts WAND.nv) the flood is the lens's. A teammate (IRLIGHT.team; a man of nvg.ts: an operative unit of a scenario
//     whose card left him his goggles), whenever HIS are down (nvg.ts nvgDown). No key, no order: it is part of the goggles. Nobody else — an enemy has no night
//     vision and no infrared anything.
//   ONLY WHERE IT IS TOO DARK (IRLIGHT.auto; the maintainer, 10-16, of a moonlit lot under five floods: "IR lights are a bit too bright. is it realistic to
//     only have them turn on when it's actually too dark to see?" — it is: a tube works on the light that is there first, and the illuminator is for where
//     there is none). Each carrier reads his own place: the floor under him, and four times a second a fan of floor across the flood's own width as far as
//     the first wall each way (fanDark) — the place's own light there (nvg.ts nvgPlaceLight: the fixtures and the moon, nothing anybody carries, nothing
//     infrared) taken through the tube (tubeVis). Any of it under NVG.blackAt — the line nvg.ts already calls 'too dark for the tube' — and his light burns,
//     from that reading until IRLIGHT.hold seconds after the last dark one (a look swept past a dark doorway does not blink it), then eases out.
//     Everywhere the tube shows the place by its own light the illuminator is out: a moonlit yard, a lit corridor. Off = it burns whenever the goggles are
//     down, as it did.
//   BY THE LIGHT THE PICTURE HAS (IRLIGHT.meter; the maintainer, 10-18, of a strongroom with its bulb off, its floor under his flood and the room round it
//     plain in the goggles: "still feels like the IR light here is unnecessary"). The estimate above is the CPU's: direct light only. A room with no lamp
//     of its own is 0 to it, and yet the tube — which makes a picture of a thousandth of a lit room's light — shows that room by what comes round the door
//     frame and off the walls. The renderer's light meter has that bounce (probe.wgsl: shadowed direct light + the radiance cache) and is given nothing by
//     an infrared light, so it still cannot answer its own question. So the CPU's rule stays the FIRST word — where it calls a place light nothing more is
//     asked — and the renderer gets the LAST one on what the CPU calls dark: the floor under him (Sam's and a teammate's own meters, asked every frame as
//     it is; the wand's lens asks its own) and a spread of up to IRL_METER.slots of the dark points his fan found, asked through the sensors' seam
//     (Game.lightQuery) on his beat and read every frame. A point is dark when the PICTURE of it is under IRLIGHT.show of the tube's range: the CPU's
//     direct light + the meter's bounce × settings.indirectScale (the meter's bounce is physical; the picture's is scaled — fgather.wgsl) through the
//     tube's curve (nvg.ts tubeSig). A line of its own, and higher than NVG.blackAt: that one is where a MAN is lost to a goggled eye, about 0.035 of
//     the range, and direct light is either well over it or nothing; bounce is every value between, and floor at 0.05 of the range is grain to the
//     player (the strongroom with its door shut, on the software adapter). Under this branch the CPU's first word is asked by the same line. The same
//     count decides: the floor under him, or FAN_NEED of the points. A point not yet answered waits IRL_METER.wait (no light: a light that came on by
//     the CPU's word and went out by the renderer's two frames on would blink for its whole hold every time the goggles came down in such a room), then
//     takes the CPU's word. Where no renderer answers at all — headless, the senses on the CPU (sense.ts), a page before its first frame: Sam's own
//     meter has no answer — the CPU's rule is the whole rule, at once, exactly as it was. So his light burns in a room that is sealed and unlit, and
//     not in one the picture already shows. Off = the CPU's estimate decides everywhere, as it did.
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
//     kept for a room with no light at all retires — his goggles now show him the way everywhere he can face: under IRLIGHT.auto his light comes on for
//     the dark floor his fan finds, which reaches past everything readPlace asks along his gun).
//
// IRLIGHT.on false = no such light anywhere: the picture and the run of the build before this file. IRLIGHT.team false = Sam's alone, in the picture alone —
// nothing in the simulation reads it, so the run is the one before this file, digest for digest (tools/qa/irlight-probes.ts holds both).
// Nothing is saved: the list is made again every frame from who has his goggles down, and a carrier's reading of his place (IRLIGHT.auto: when it last read
// dark, how far his light has eased) is kept per Game and starts again after a load — a light inside its hold at the save is out or full at once. UNTUNED BY EYE: nothing here was seen on a GPU.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, clamp, DEG } from '../math/vec';
import type { RtLight } from '../render/lights';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { nvgDown, tubeVis, tubeSig, nvgPlaceLight, NVG } from './nvg';
import { wandEye, WAND } from './wand';
import { SENSE } from './sense';

export const IRLIGHT = {
  /** off = no infrared light on anybody's goggles (the page turns it on: src/host/profile.ts; ?noirlight) */
  on: false,
  /** the teammates carry one too, and a goggled teammate sees a man standing in anybody's (off = Sam's only, a picture and nothing else) */
  team: true,
  /** it burns only where the goggles alone show too little (the page turns it on: src/host/profile.ts; ?noirauto). off = whenever the goggles are down */
  auto: false,
  /** auto: the place is read off the renderer's light meter, bounced light and all, where it answers (the page turns it on: src/host/profile.ts;
   *  ?noirmeter). off = by the CPU's estimate of the direct light alone, to which a room lit only round a door frame is black */
  meter: false,
  /** meter: the least the tube's picture must make of a floor (0‥1 of its range) for his light to stay out. The maintainer's strongroom read about 0.3 in
   *  his shot; 0.05 is grain. Never judged on a real GPU */
  show: 0.1,
  /** auto: s the light stays on after the last reading that found floor too dark for the tube (NVG.blackAt, by the place's own light) */
  hold: 1.5,
  /** how bright the flood reads THROUGH THE TUBE: on-axis intensity × the picture's exposure. 8 (it was 30, and five of them at once put a lot at the tube's
   *  ceiling): by the shader's own curve one light puts the floor two metres ahead at about 0.6 of the tube's range, four metres at 0.4, a wall six metres
   *  off a little under half — and where all five of a stacked squad's overlap, four metres off reads about 0.6 where it read white */
  power: 8,
  /** m it reaches (the shader's range window: full to about half of this, gone at it) */
  reach: 22,
  /** the flood's half angle, degrees, and where inside it the full strength ends (20, was 40: the edge rolls off over most of the cone) */
  cone: 65, core: 20,
  /** how far below level it points, degrees (6, was 11: less of it on the floor at his feet, which is nearest the lens and so the hottest thing in it) */
  dip: 6,
};

/** the key Sam's reading is kept under while the place read is his wand's (no character's id is negative) */
const WAND_KEY = -1;
const HEAD_Y = 1.62, LENS_AHEAD = 0.14, LENS_CLEAR = 0.3, LENS_R = 0.04;
/** one carrier's reading of his place (IRLIGHT.auto): when his fan was last read, when anything last read dark, how much of his light burns, and as of when */
/** …and under IRLIGHT.meter: `fresh`: no reading of his has been decided yet (the first one that is puts his light at full or out at once) · `t0`: when
 *  the reading began · `own`: the CPU's light on the floor under him where it calls that dark (−1: it does not) · `pts`: the dark points of his fan the
 *  renderer is asked about, x, z and the CPU's light at each · `since`: when each slot was first asked (Infinity: not in use; the last is the wand's own floor) */
interface Need { readT: number; darkT: number; k: number; t: number; fresh: boolean; t0: number; own: number; pts: number[]; since: number[] }
interface Kit { sam: RtLight | null; men: Map<Guard, RtLight>; seen: Map<Guard, { t: number; E: number }>; need: Map<number, Need> }
const kits = new SideMap<Game, Kit>('irlight.kits');
const kitOf = (g: Game): Kit => { let K = kits.get(g); if (!K) { K = { sam: null, men: new Map(), seen: new Map(), need: new Map() }; kits.set(g, K); } return K; };
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
/** IS THIS FLOOR TOO DARK FOR THE TUBE BY ITS OWN LIGHT (IRLIGHT.auto)? The place's light — nothing carried, nothing infrared, so no light of this file's
 *  ever answers its own question — through the tube, against the line nvg.ts calls black. */
const darkAt = (g: Game, x: number, z: number) => tubeVis(g, nvgPlaceLight(g, [x, 1.2, z])) < NVG.blackAt;
/** …and is the floor his flood would fall on? A fan across the cone (FAN_DEG either side of `yaw`: the flood's width, a doorway's breadth apart at six
 *  metres) out to FAN_M's last, each ray to the first wall. FAN_NEED of its readings must be dark: one alone is the shadow behind a cabinet in a lit
 *  office, and a light that came on for it as he turned his head would blink. (A dark room through a doorway is two or more down one ray.) LOOK_MAX is
 *  as far as the rule looks: past it nothing brings his light on (irShowsAt). */
const FAN_NEED = 2, READ_EVERY = 0.25, FAN_DEG = [0, 12, -12, 24, -24, 36, -36, 48, -48, 60, -60], FAN_M = [1.5, 3, 4.5, 6, 8, 10, 12], LOOK_MAX = 12, FADE_IN = 0.15, FADE_OUT = 0.5;
function fanDark(g: Game, at: Vec3, yaw: number): boolean {
  const eye: Vec3 = [at[0], 1.5, at[2]]; let n = 0;
  for (const off of FAN_DEG) {
    const fx = Math.sin(yaw + off * DEG), fz = Math.cos(yaw + off * DEG);
    for (const r of FAN_M) { const P: Vec3 = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, P)) break; if (darkAt(g, P[0], P[2]) && ++n >= FAN_NEED) return true; }
  }
  return false;
}
/** THE RENDERER'S WORD ON WHAT THE CPU CALLS DARK (IRLIGHT.meter; see the head). `slots`: the most fan points one carrier asks about on a beat (the probe
 *  has 64 places a frame for everybody) · `wait`: s an unanswered point is waited for before the CPU's word stands */
export const IRL_METER = { slots: 5, wait: 0.25 };
const skey = (key: number, i: number) => `irl${key}:${i}`;
const forget = (g: Game, key: number) => { for (let i = 0; i <= IRL_METER.slots; i++) g.lightForget(skey(key, i)); };
/** every point of his fan the CPU's direct light leaves under the picture's line (IRLIGHT.show), in the fan's order: x, z and the CPU's light there (no way out at the second: the renderer is asked about a spread of them) */
function fanDarks(g: Game, at: Vec3, yaw: number): number[] {
  const eye: Vec3 = [at[0], 1.5, at[2]], out: number[] = [];
  for (const off of FAN_DEG) {
    const fx = Math.sin(yaw + off * DEG), fz = Math.cos(yaw + off * DEG);
    for (const r of FAN_M) { const P: Vec3 = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, P)) break; const E = nvgPlaceLight(g, P); if (tubeSig(g, E) < IRLIGHT.show) out.push(P[0], P[2], E); }
  }
  return out;
}
/** Is a place the CPU calls dark (its direct light `cpu`) dark in the PICTURE, by the renderer's answer `E`? undefined: no answer yet. */
function shownDark(g: Game, cpu: number, E: number | undefined): boolean | undefined {
  if (E === undefined || !Number.isFinite(E)) return undefined;
  const s = g.engine.settings.indirectScale;
  return tubeSig(g, cpu + (s >= 0 ? s : 1) * Math.max(E - cpu, 0)) < IRLIGHT.show;
}
/** his reading is over (goggles up, gone, the light off): what he asked of the renderer is forgotten with it */
const drop = (g: Game, kit: Kit, key: number) => { const N = kit.need.get(key); if (!N) return; if (N.since.some(t => t !== Infinity)) forget(g, key); kit.need.delete(key); };
/** How much of his light burns this frame, 0‥1 (1 with IRLIGHT.auto off: whenever the goggles are down). `key`: the carrier's own (a second one for Sam's
 *  wand: the lens looks at another place, read afresh); `at` / `yaw`: where his flood starts and looks; `each`: the floor under him is read every frame
 *  (Sam: the picture is his), not only with the fan. The fan is read every READ_EVERY s of the game's clock, each carrier on his own beat. A dark reading
 *  and his light is on — at full on the first reading after his goggles come down, eased in over FADE_IN after a later one — until IRLIGHT.hold after the
 *  last, then eased out over FADE_OUT. `live`: the renderer answers and is asked (IRLIGHT.meter; see the head) — then `ownKey` is the meter key that
 *  already reads the floor under him (null: none, the wand — it asks its own). */
function burn(g: Game, kit: Kit, key: number, at: Vec3, yaw: number, each: boolean, live: boolean, ownKey: string | null): number {
  if (!IRLIGHT.auto) { drop(g, kit, key); return 1; }
  let N = kit.need.get(key); const born = !N || N.t > g.time, S = IRL_METER.slots;
  if (!N || born) { if (N) forget(g, key); N = { readT: -Infinity, darkT: -Infinity, k: 0, t: g.time, fresh: true, t0: g.time, own: -1, pts: [], since: new Array(S + 1).fill(Infinity) }; kit.need.set(key, N); }
  const beat = g.time - N.readT >= READ_EVERY;
  let dark = false, pending = false;
  if (!live) {   // the CPU's rule, whole
    if (N.pts.length || N.own >= 0 || N.since.some(t => t !== Infinity)) { forget(g, key); N.pts.length = 0; N.own = -1; N.since.fill(Infinity); }
    dark = each && darkAt(g, at[0], at[2]);
    if (beat) dark = dark || (!each && darkAt(g, at[0], at[2])) || fanDark(g, at, yaw);
  } else {
    // ---- the CPU's word: the floor under him, and on his beat the dark points of his fan — a spread of them is put to the renderer
    if (each || beat) { const E = nvgPlaceLight(g, [at[0], 1.2, at[2]]); N.own = tubeSig(g, E) < IRLIGHT.show ? E : -1; }
    if (beat) {
      const D = fanDarks(g, at, yaw), n = D.length / 3, take = n < FAN_NEED ? 0 : Math.min(n, S); N.pts.length = 0;
      for (let i = 0; i < S; i++) {
        if (i >= take) { if (N.since[i] !== Infinity) { g.lightForget(skey(key, i)); N.since[i] = Infinity; } continue; }   // (a slot out of use: its answer is of another place when it is used again)
        const j = 3 * (take === n ? i : Math.round(i * (n - 1) / (take - 1))); N.pts.push(D[j], D[j + 1], D[j + 2]);
        g.lightQuery(skey(key, i), [D[j], 1.2, D[j + 1]]); if (N.since[i] === Infinity) N.since[i] = g.time;
      }
    }
    if (!ownKey && N.own >= 0) { g.lightQuery(skey(key, S), [at[0], 1.2, at[2]]); if (N.since[S] === Infinity) N.since[S] = g.time; }
    // ---- the renderer's: every key read every frame, in use or not (one read sequence a frame: the sensors' journal writes its key list at each change of it)
    const word = (cpu: number, E: number | undefined, since: number, used: boolean): boolean => {
      if (!used) return false; const d = shownDark(g, cpu, E); if (d !== undefined) return d;
      if (g.time - since < IRL_METER.wait) { pending = true; return false; } return true; };
    dark = word(Math.max(N.own, 0), g.lightAt(ownKey ?? skey(key, S)), ownKey ? N.t0 : N.since[S], N.own >= 0);
    let n = 0; for (let i = 0; i < S; i++) { const used = 3 * i < N.pts.length; if (word(used ? N.pts[3 * i + 2] : 0, g.lightAt(skey(key, i)), N.since[i], used)) n++; }
    dark = dark || n >= FAN_NEED;
  }
  if (beat) N.readT = born ? g.time - (Math.abs(key) * 0.6180339887 % 1) * READ_EVERY : g.time;   // (the first reading is at once; the beat after it is his own, so five men's fans do not all fall on one frame)
  if (dark) N.darkT = g.time;
  const on = g.time - N.darkT < IRLIGHT.hold, dt = Math.max(g.time - N.t, 0); N.t = g.time;
  if (N.fresh) { N.k = on ? 1 : 0; N.fresh = pending; } else N.k = clamp(N.k + (on ? dt / FADE_IN : -dt / FADE_OUT), 0, 1);
  return N.k;
}

/** Sam's burns exactly while the picture is the tube's (0.5: post.wgsl's own swap, engine.ts's own test for handing the list over) — not by Player.nv: his
 *  goggles are asked for a few frames before the picture comes and lift a few before it goes (player.ts eases nvAmount, kitanim.ts holds the tube at his eyes) */
const samOn = (g: Game) => g.player.nvAmount > 0.5;
/** his lamp is out of the list: the renderer's slot memory of it goes with it (lights.ts upload maps last frame's slot to this frame's by the object) */
const out = (L: RtLight | null | undefined) => { if (L) { L.enabled = false; L.slot = -1; } };

/** Once a frame from Game.update, after everybody has moved and the doors have swung: the list of infrared lights (LightSet.ir) made again from whose goggles are down. */
export function irLightTick(g: Game) {
  const list = g.engine.lights.ir, K = kits.get(g);
  if (!IRLIGHT.on) { if (list.length) list.length = 0; if (K) { out(K.sam); K.men.clear(); K.seen.clear(); for (const id of [...K.need.keys()]) drop(g, K, id); } return; }
  const kit = K ?? kitOf(g); list.length = 0; kit.seen.clear();
  /** his light posed, and in the list if any of it burns (auto: only where his place is too dark for the tube) */
  // (the renderer is asked only where it answers: Sam's own meter — asked every frame, game.ts lightMeter — has an answer. Headless it never has. Read once
  //  a frame and only when somebody's goggles are down: with nobody's down this file reads no sensor at all, as before the rule)
  let live: boolean | undefined;
  const lit = (L: RtLight, key: number, at: Vec3, yaw: number, each: boolean, ownKey: string | null) => {
    live ??= IRLIGHT.auto && IRLIGHT.meter && !SENSE.cpu && g.lightAt('playerChest') !== undefined;
    const k = burn(g, kit, key, at, yaw, each, live, ownKey); if (k > 0) { L.intensity *= k; L.peakIntensity = L.intensity; list.push(L); } else out(L); };
  const sc = g.player.char;
  if (samOn(g)) {
    const L = kit.sam ??= lamp('ir_sam', sc.id); pose(g, L, sc);
    // (the wand under a door, his goggles down — WAND.nv: the picture he is given is the lens's, so the flood is the lens's too, level along its look — and
    // the place read is the one the lens looks into, from a stride past the leaf)
    const eye = WAND.nv ? wandEye(g) : null; if (eye) { L.pos = v3.copy(eye.pos); L.dir = [eye.look[0], 0, eye.look[2]]; }
    if (eye) { drop(g, kit, sc.id); lit(L, WAND_KEY, [eye.pos[0] + eye.look[0] * 0.7, 0, eye.pos[2] + eye.look[2] * 0.7], Math.atan2(eye.look[0], eye.look[2]), true, null); }
    else { drop(g, kit, WAND_KEY); lit(L, sc.id, sc.pos, sc.aimYaw, true, 'playerChest'); }
  } else { out(kit.sam); drop(g, kit, sc.id); drop(g, kit, WAND_KEY); }
  if (!IRLIGHT.team) { kit.men.clear(); for (const id of kit.need.keys()) if (id !== sc.id && id !== WAND_KEY) drop(g, kit, id); return; }
  for (const gd of kit.men.keys()) if (!g.guards.includes(gd)) { kit.men.delete(gd); drop(g, kit, gd.char.id); }
  for (const gd of g.guards) {
    if (gd.state === 'dead' || !nvgDown(g, gd)) { out(kit.men.get(gd)); drop(g, kit, gd.char.id); continue; }
    let L = kit.men.get(gd); if (!L) { L = lamp(`ir_${gd.char.id}`, gd.char.id); kit.men.set(gd, L); }
    pose(g, L, gd.char); lit(L, gd.char.id, gd.char.pos, gd.char.aimYaw, false, `unitC${gd.char.id}`);   // (his own meter's chest key: guards.ts meterOf)
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
  if (IRLIGHT.auto && d > LOOK_MAX) return false;   // (his light comes on for dark floor his fan finds, and the fan ends there: past it he is credited with nothing)
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
  return `IR light: yours ${S.sam ? 'on' : S.shown && IRLIGHT.auto ? 'off (light enough here)' : 'off (goggles up)'}${IRLIGHT.team ? (S.men.length ? ' · ' + S.men.map(m => m.callsign).join(' · ') : (IRLIGHT.auto ? ' · no teammate in the dark' : ' · no teammate on goggles')) : ' · the team carries none'} — only goggles see it`;
}
