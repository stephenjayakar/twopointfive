// NIGHT VISION FOR THE TEAM (the maintainer, 10-06: "the squad members should have night vision and use it accordingly. this could either be following your
// lead or knowing when they haven't been compromised and flashlight would ruin that." — "but the lights make sense too, especially when things are loud" —
// "ready or not is a good base case here"). Every teammate (an operative unit, while the room fight is live — a scenario, never a showcase's cast) wears the
// goggles Sam wears, and each frame two things are decided for him here, nowhere else:
//
//   IS HE DARK — his weapon light held off whatever guards.ts LIGHTS would burn it for. Asked only of the men that rule has (lightRuled: under one of Sam's orders, LIGHTS on).
//     THE LEAD (NVG.lead; the Ready or Not base case: the squad does what its leader does): Sam's own light switched on, the gun it is on in his hands, frees
//       theirs — the light rule has them, as it had before this file; Sam on HIS goggles with his light off puts them dark, quiet or loud, for as long as he stays so.
//     THEIR OWN JUDGEMENT (NVG.own; Sam doing neither): dark while the team has NOT BEEN COMPROMISED — nothing loud has reached a teammate's ears (roomfight's
//       own record, Op.hotT: gunfire at the hearing model's level 1, a charge, a boot), no alarm is up (and, NVG.huntFrees, no man the team can see is hunting) — for
//       NVG.quietSecs after the last of those. Loud: the light rule has them again ("the lights make sense too, especially when things are loud"). One thing
//       overrides it: a place TOO DARK FOR THE TUBE (below; NVG.blackAt) — where the floor along his gun, the mark he is walking to, a footfall he has
//       heard or the point he is turning to look at has no light of the place on it at all (two readings running: one black sample in passing lights
//       nothing), the light rule has him as it had: his eyes are his goggles where the tube shows him the way and his light where it does not.
//   ARE HIS GOGGLES DOWN — whenever his own light is not burning and the place he is working in is dark to the bare eye (the floor under him, along his gun or
//     on the mark he is nearly at, or his target, reads under NVG.darkAt on the meter's scale, the place's own lights only — LIGHTS.litAt's question). Up in a lit place, up
//     behind his own white light. A man nobody orders about (a drill's, the rescue's flow, the fight AI's) still flips his own goggles; only his light is not ours.
//
// WHAT THE GOGGLES DO is the picture's own tube (render/shaders/post.wgsl, the N key): sig = ln(1 + lum · gain) / ln(1 + gain) with lum the radiance a man's
// clothes send the lens under the scene's exposure and gain the same engine.settings.nvGain the post pass reads — move the panel's tube gain and what the
// team sees through theirs moves with the picture. tubeVis() turns that screen brightness back into the light meter's 0‥1 (the irradiance that would put the
// same brightness on a bare-eyed picture, through Game.visibilityOf) and takes off the tube's scintillation where the signal is weakest (the shader's noise
// term). guards.ts sightGainOn reads it for a goggled eye beside the light ON the man: nothing else about how a teammate sees changes — cone, range, line of
// sight, smoke, motion, the reaction beats are all as they were. Darkness the meter calls 0 % (E ≈ 0.03) reads ≈ 0.6 through the tube; no light at all
// reads nothing (a tube amplifies, it does not invent — which is what the illuminator on the goggles is for: irlight.ts). Enemies have no night vision: a dark teammate in a dark
// place is to them what a dark Sam is.
//
// NVG.on false = no goggles on anybody, no dark, no tube: every function below answers as if this file did not exist (the build before it, to the frame).
// State is per Game and derived every frame (nothing saved: a load re-derives it inside a frame).
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import { lightEstimateAt, escalationOf, lightRuled, LIGHTS } from './guards';
import { fightLive } from './roomfight';
import { kitGoggles } from './kit';
import { isHourSun } from './hours';
import { irOnMan, irCarried } from './irlight';

export const NVG = {
  /** off = the team as it was: no goggles, lights by guards.ts LIGHTS alone */
  on: true,
  /** the team follows Sam's own kit: his light on frees theirs, his goggles down with his light off puts them dark (off = they never look at what he does) */
  lead: true,
  /** with no lead to follow they stay dark until the team is compromised (off = the light rule has them whenever Sam's goggles are up) */
  own: true,
  /** a man HUNTING the team in a teammate's sight counts as compromised by himself. false (the rescue's numbers, 10-06): only what is LOUD does — gunfire, a
   *  charge, a boot in a teammate's ears, or an alarm; one man who has seen them is one man to shoot through the tube, and the rest of the floor does not know
   *  yet. true = as it was: the lights came free the moment he was seen to be alert — onto a man behind a pane nobody could shoot through, who fired blind
   *  into the glass at the glare and brought the whole floor up with the team strung down a corridor */
  huntFrees: false,
  /** s of quiet — nothing loud heard, no alarm (nobody seen hunting: huntFrees) — before a compromised team goes dark again */
  quietSecs: 30,
  /** s Sam's light counts as on after it was last switched on in his hands (changing guns, a holster and a draw put it away for a moment) */
  leadTail: 1.5,
  /** the place is dark to the bare eye under this on the meter's scale: goggles come down (LIGHTS.litAt's line — over it the room's own lights do) */
  darkAt: 0.5,
  /** too dark even for the tube: something he is looking at reads under this THROUGH it (own judgement only: the light rule has him rather than he walk in
   *  blind; 0 = never — dark is dark). Read off the CPU's direct light plus the moon, no bounce: it calls black some floor the page's picture shows faintly.
   *  blackReads / clearReads: readings running (two a second) before a place counts as black / as showing again — no white light for one sample in passing */
  blackAt: 0.15, blackReads: 2, clearReads: 3,
  /** the reflectance of a man's clothes in the tube's signal, and the rms of its scintillation at no signal (post.wgsl: ±0.5 × 0.16, uniform) */
  albedo: 0.3, noise: 0.046,
  /** s a man's light must be off (and the place dark) before his goggles come down / on before they go up: a light the rule pulses for a moment flips nothing */
  downSecs: 0.25, upSecs: 0.7,
  /** s between two of the team's 'going dark' calls */
  callGap: 8,
};

type Mode = 'off' | 'free' | 'dark';
type Why = 'your light' | 'your goggles' | 'not compromised' | 'compromised' | 'no rule';
interface Man {
  /** goggles over his eyes / his light held off */
  down: boolean; dark: boolean;
  /** when what he wants of his goggles last matched what they are (the flip waits downSecs / upSecs past it) */
  agreeT: number;
  /** his place as last read (twice a second): dark to the bare eye, too dark for the tube */
  placeT: number; dim: boolean; black: boolean;
  /** readings running that came back black (> 0) / showing (< 0): `black` flips at NVG.blackReads / clearReads of them */
  run: number;
}
interface Team {
  t: number; mode: Mode; why: Why; men: Map<Guard, Man>;
  /** when Sam's light last shone; when a man hunting the team was last in a teammate's sight; when an alarm was last up; the last 'going dark' */
  leadLitT: number; huntT: number; alarmT: number; calledT: number;
  /** the team went dark and nobody has said so yet */
  callDue: boolean;
}
export interface NvgNote { t: number; who: string; what: string }
/** QA / the panel: what changed and when (the last 200) */
export const NVG_LOG: NvgNote[] = [];
const teams = new WeakMap<Game, Team>();
const fresh = (): Team => ({ t: -100, mode: 'off', why: 'no rule', men: new Map(), leadLitT: -Infinity, huntT: -Infinity, alarmT: -Infinity, calledT: -Infinity, callDue: false });
const note = (g: Game, gd: Guard | null, what: string) => { NVG_LOG.push({ t: g.time, who: gd ? gd.callsign : '-', what }); if (NVG_LOG.length > 200) NVG_LOG.splice(0, 50); };
/** the team's state while it is this frame's (or the last few: the rig is drawn after the tick, a paused frame draws again) */
function live(g: Game): Team | null { const T = teams.get(g); return NVG.on && T && T.mode !== 'off' && g.time - T.t >= 0 && g.time - T.t < 0.25 ? T : null; }

/** THE TUBE: the meter's 0‥1 for a man under irradiance `E` (W/m², as the light meter reports it) seen through the goggles — post.wgsl's intensifier curve at
 *  the scene's exposure and the picture's own gain, read back as the irradiance that would show a bare eye the same brightness, less the scintillation. */
export function tubeVis(g: Game, E: number): number {
  const S = g.engine.settings; const k = NVG.albedo / Math.PI * (S.exposure > 0 ? S.exposure : 1), gain = Math.max(S.nvGain > 0 ? S.nvGain : 1, 1);
  const sig = clamp(Math.log(1 + Math.max(E, 0) * k * gain) / Math.log(1 + gain), 0, 1);
  return sig > 0 ? g.visibilityOf(sig / k) * sig / (sig + NVG.noise) : 0;
}

const isMate = (gd: Guard) => gd.team === 'operative' && !!gd.unit && gd.state !== 'dead' && kitGoggles(gd);   // (kit.ts: a man whose card took his goggles off is no man of this file's)
/** when the other side last gave the team reason to think it knows: the loudest thing a teammate's ears hold (roomfight.ts Op.hotT, a stager's hotT), a
 *  hunting man in a teammate's sight, an alarm */
function loudT(g: Game, T: Team): number {
  let t = Math.max(T.huntT, T.alarmT, g.fight.hotT);
  for (const O of g.fight.ops) if (O.hotT > t) t = O.hotT;
  return t > -100 ? t : -Infinity;   // (roomfight's 'never' is -100: a team nothing has reached is not 'loud a hundred seconds ago')
}
/** the light of the place at a point: guards.ts lightEstimateAt's fixtures (nothing carried) plus what that estimate leaves out and the meter has — the moon
 *  (a kind-2 light: its whole irradiance wherever the sky its way is open, common.wgsl evalLight; never a stroke of lightning — a transient is not the
 *  place's light). A moonlit lot is not a black place to a tube. */
export function nvgPlaceLight(g: Game, P: Vec3): number {
  let E = lightEstimateAt(g, P, () => true);
  for (const l of g.engine.lights.lights) {
    if (l.kind !== 2 || !l.enabled || l.intensity <= 0 || l.transient || l.ttl >= 0 || isHourSun(g, l)) continue;   // (an hour's sun is in the estimate above already: hours.ts hourLight)
    if (!g.col.segmentBlocked(P, [P[0] - l.dir[0] * 60, P[1] - l.dir[1] * 60, P[2] - l.dir[2] * 60])) E += (0.2126 * l.color[0] + 0.7152 * l.color[1] + 0.0722 * l.color[2]) * l.intensity;
  }
  return E;
}
/** his place, the place's own lights only (nothing anybody carries — two mates' lights must not flip each other's goggles): the floor under him, along his
 *  gun to the first wall (LOOK_M), the mark he is walking to once within LIGHTS.litMarkM of it, the man his gun is on — and where an enemy's footfall last
 *  reached him from (roomfight's Op.stepBy, for as long as guards.ts LIGHTS would light it) and the point he is turning to look at. DIM = any of it dark to
 *  the bare eye; BLACK = something he is LOOKING AT inside TUBE_M (not the floor under him, not the far end of a hall) showing nothing through the tube, for
 *  NVG.blackReads readings running. (guards.ts litPlace asks the light rule's question of fewer points: 'is where he is and is going LIT'. This one asks
 *  'is anything he must see DARK', which is not its negation.) */
const LOOK_M = [2, 5, 8, 12, 16], TUBE_M = 8;
function readPlace(g: Game, gd: Guard, M: Man) {
  if (g.time - M.placeT >= 0 && g.time - M.placeT < 0.5) return;
  const c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]], fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw);
  let dim = false, black = false;
  const lamp = irCarried();   // (irlight.ts: a man with an illuminator on his goggles has no place too dark for his tube — the white-light fallback is for the man without one)
  const at = (x: number, z: number, tube = true) => { const E = nvgPlaceLight(g, [x, 1.2, z]); if (g.visibilityOf(E) < NVG.darkAt) dim = true; if (tube && !lamp && tubeVis(g, E) < NVG.blackAt) black = true; };
  at(c.pos[0], c.pos[2], false);
  for (const r of LOOK_M) { const P: Vec3 = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, P)) break; at(P[0], P[2], r <= TUBE_M); }
  const A = g.orders.of(gd); if (A?.post && !A.arrived && v3.distXZ(c.pos, A.post) < LIGHTS.litMarkM) at(A.post[0], A.post[2]);
  const O = g.fight.opOf(gd);
  if (O?.tgt && O.tgt.state !== 'dead') at(O.tgt.char.pos[0], O.tgt.char.pos[2], false);
  if (O?.stepBy && g.time - O.stepBy.t < LIGHTS.stepSecs) at(O.stepBy.at[0], O.stepBy.at[2]);
  if (O?.turn?.pt) at(O.turn.pt[0], O.turn.pt[2]);
  M.placeT = g.time; M.dim = dim;
  M.run = black ? Math.max(M.run, 0) + 1 : Math.min(M.run, 0) - 1;
  if (M.run >= NVG.blackReads) M.black = true; else if (-M.run >= NVG.clearReads) M.black = false;
}

/** Once a frame from Game.update, after the room fight has heard this frame's events and before anybody's light is posed. */
export function nvgTick(g: Game) {
  let T = teams.get(g);
  if (!NVG.on || !fightLive(g)) { if (T && T.mode !== 'off') { T.mode = 'off'; T.men.clear(); } return; }
  let known = !T || T.men.size === 0; if (T && !known) for (const gd of T.men.keys()) if (g.guards.includes(gd)) { known = true; break; }
  if (!T || T.mode === 'off' || T.t > g.time || !known) { T = fresh(); teams.set(g, T); }   // (a fresh staging — every man of the last one gone from the floor — or the clock put back by a load: nothing remembered)
  const squad = g.guards.filter(isMate); for (const gd of T.men.keys()) if (!squad.includes(gd)) T.men.delete(gd);
  if (!squad.length) { T.mode = 'off'; return; }
  // ---- what the team knows of its own secret
  const pl = g.player;
  if (!pl.down && ((pl.pistolUp && pl.pistol.lightOn) || (pl.rifleUp && pl.rifle.lightOn))) T.leadLitT = g.time;   // (the SWITCH, the gun in his hands: a sprint or a busy hand lowers the beam a moment — player.ts poseGunLight — and is no change of mind)
  if (escalationOf(g) >= 1) T.alarmT = g.time;
  if (NVG.huntFrees) for (const h of g.guards) if (h.unit && h.team === 'hostile' && (h.state === 'alert' || h.state === 'search') && g.fight.teamSees(h)) { T.huntT = g.time; break; }
  const lead: Mode | null = !NVG.lead || pl.down ? null : g.time - T.leadLitT < NVG.leadTail ? 'free' : pl.nv ? 'dark' : null;
  const quiet = g.time - loudT(g, T) >= NVG.quietSecs;
  const mode: Mode = lead ?? (NVG.own && quiet ? 'dark' : 'free');
  const why: Why = lead === 'free' ? 'your light' : lead === 'dark' ? 'your goggles' : !NVG.own ? 'no rule' : quiet ? 'not compromised' : 'compromised';
  const was = T.mode; T.t = g.time; T.mode = mode; T.why = why;
  if (mode !== was) { note(g, null, `team ${mode === 'dark' ? 'dark' : 'lights free'} (${why})`); T.callDue = mode === 'dark' && was === 'free'; }
  // ---- each man
  let caller: Guard | null = null;
  for (const gd of squad) {
    let M = T.men.get(gd); if (!M) { M = { down: false, dark: false, agreeT: g.time - 10, placeT: -Infinity, dim: false, black: false, run: 0 }; T.men.set(gd, M); }
    readPlace(g, gd, M);
    const ruled = lightRuled(g, gd), dark = mode === 'dark' && ruled && !(lead === null && M.black);
    if (dark !== M.dark) note(g, gd, dark ? 'dark' : mode === 'dark' && ruled ? 'lights: too dark for the tube' : 'light his own again');
    M.dark = dark; if (dark) caller ??= gd;
    const want = M.dim && (dark || !gd.flashlight.enabled);   // (his light as last frame posed it; a dark man's is going off this frame)
    if (want === M.down) M.agreeT = g.time;
    else if (g.time - M.agreeT >= (want ? NVG.downSecs : NVG.upSecs)) { M.down = want; M.agreeT = g.time; note(g, gd, want ? 'goggles down' : 'goggles up'); }
  }
  if (T.callDue && caller && g.time - T.calledT >= NVG.callGap) { T.callDue = false; T.calledT = g.time; g.say(caller, 'going dark.'); }   // (said by the first man who really is dark, the frame there is one)
}

/** his weapon light is held off this frame (guards.ts attachFlashlight asks before the light rule) */
export function nvgDark(g: Game, gd: Guard): boolean { return !!live(g)?.men.get(gd)?.dark; }
/** he wears the goggles at all / they are over his eyes (combat.ts handProps draws them: parked on the forehead, or down and lit) */
export function nvgWorn(g: Game, gd: Guard): boolean { return NVG.on && gd.team === 'operative' && !!gd.unit && kitGoggles(gd) && fightLive(g); }   // (a downed man keeps his)
export function nvgDown(g: Game, gd: Guard): boolean { return !!live(g)?.men.get(gd)?.down; }
/** what he is looking at shows nothing even through the tube (readPlace's `black`: the light rule may have him) */
export function nvgBlack(g: Game, gd: Guard): boolean { return !!live(g)?.men.get(gd)?.black; }
/** the light to read for `o` through `viewer`'s goggles (0 with them up, or no goggles): guards.ts sightGainOn takes it when it beats the light on the man */
export function nvgSight(g: Game, viewer: Guard, o: Guard): number { return nvgDown(g, viewer) ? tubeVis(g, o.irradiance + irOnMan(g, o)) : 0; }   // (+ the infrared light on him: irlight.ts — only a tube adds it; 0 with that switch off)
/** QA / the panel: the team's mode and why, and each man's kit */
export function nvgState(g: Game): { mode: Mode; why: Why; quietFor: number; men: { gd: Guard; down: boolean; dark: boolean; dim: boolean; black: boolean }[] } {
  const T = live(g); if (!T) return { mode: 'off', why: 'no rule', quietFor: Infinity, men: [] };
  return { mode: T.mode, why: T.why, quietFor: g.time - loudT(g, T), men: [...T.men].map(([gd, M]) => ({ gd, down: M.down, dark: M.dark, dim: M.dim, black: M.black })) };
}
/** 'night vision off' / 'team dark (not compromised) · Blue One goggles · Blue Two light' */
export function nvgSummary(g: Game): string {
  if (!NVG.on) return 'night vision off: lights by the light rule alone';
  const S = nvgState(g); if (S.mode === 'off') return 'night vision: no team on the floor';
  return `team ${S.mode === 'dark' ? 'dark' : 'lights free'} (${S.why}) · ` + S.men.map(m => `${m.gd.callsign} ${m.down ? 'goggles' : m.gd.flashlight.enabled ? 'light' : 'bare eyes'}${m.black ? ', black ahead' : ''}`).join(' · ');
}
