// The property groups the inspector's sheet is composed from (and the flat 'all knobs' list is made of): each is a title, a builder that adds rows to a
// Panel section over LIVE objects (the state, RIG, LONG, HOLD, WALL_POSE, the effects numbers, the gait constants), and — where the numbers are authored data
// the maintainer pastes back — reset-to-shipped and COPY in the paste-back format: RIG → rigSource() (the `export const RIG` statement), LONG → the LONG
// table, the gait constants → the gait lab's block (all byte-for-byte what the old pages emitted); the groups that never had a paste format (HOLD,
// WALL_POSE, effects) copy a 'changed values' list to apply by hand. Which groups show is the variant's list (scenes.ts) plus the outliner selection (ui.ts).
import { Panel, NumOpts } from '../ui/panel';
import { Vec3, DEG, wrapAngle } from '../math/vec';
import { RIG, RIG_DEFAULTS, Rig, assignRig, clearAdjs, rigSource, Adj } from '../game/rigProps';
import { LONG, LONG_CROUCH, LONG_STANCES, LONG_STEADY, LongStance, LongShape, HOLD, WALL_POSE, KICK_IMPACT, THROW_RELEASE, THROW_DUR, WALK_PHASE } from '../game/character';
import * as fxm from '../game/effects';
import type { Runtime } from './runtime';
import { UPPERS, STANCE_NAMES, STANCES, TAC_SHOTS, PATHS, PRESETS, DRIVES, TRACK, DEBUG_VIEWS, RIFLE_NAMES } from './state';
import { ALL_GAIT_GROUPS, GAIT_GROUPS, SOFT_KNEE_GROUP, DEFAULTS, KnobGroup, gaitSource, softKneeSource, gaitGroupChanged, gaitChanged, resetGaitGroup, setAllOff } from './gait';
import { QUALITY_NAMES } from '../ui/quality';
import { gearText } from '../game/gear';

export interface SheetCtx {
  rt: Runtime;
  /** put paste-back text in the constants box and on the clipboard; `what` = one line for the log */
  emit: (text: string, what: string) => void;
  /** the sheet must be recomposed (a row changed which rows exist) */
  rebuild: () => void;
  select: (id: string | null) => void;
}
export interface GroupDef {
  id: string; title: string; open?: boolean;
  build(p: Panel, sec: HTMLElement): void;
  /** paste-back text (undefined = nothing to copy from this group) */
  copy?(): string;
  /** any value off its shipped default */
  changed?(): boolean;
  reset?(): void;
}

// ---------------------------------------------------------------- helpers: snapshots, deep assign, object trees as rows, 'changed values' lists
type Tree = { [k: string]: unknown };
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
/** deep in-place copy of numbers / number arrays / nested objects (object identities kept: rows and the game hold on to them) */
function deepAssign(dst: Tree, src: Tree) {
  for (const k of Object.keys(src)) {
    const s = src[k], d = dst[k];
    if (typeof s === 'number') dst[k] = s;
    else if (typeof s === 'boolean') dst[k] = s;
    else if (Array.isArray(s)) { if (Array.isArray(d) && d.length === s.length) s.forEach((x, i) => { if (Array.isArray(x)) (x as number[]).forEach((y, j) => { (d[i] as number[])[j] = y; }); else d[i] = x; }); else dst[k] = clone(s); }
    else if (s && typeof s === 'object') deepAssign((d && typeof d === 'object' ? d : (dst[k] = {})) as Tree, s as Tree);
  }
}
const num3 = (n: number) => String(+n.toFixed(4));
const show = (v: unknown): string => typeof v === 'number' ? num3(v) : Array.isArray(v) ? `[${v.map(show).join(', ')}]` : JSON.stringify(v);
/** `NAME.path = value   // was X` for every leaf that moved (arrays whole) */
function diffLines(name: string, obj: unknown, snap: unknown, path = ''): string[] {
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj !== snap && !(typeof obj === 'number' && typeof snap === 'number' && Math.abs(obj - snap) < 1e-9) ? [`${name}${path} = ${show(obj)};   // was ${show(snap)}`] : [];
  if (Array.isArray(obj)) { const same = Array.isArray(snap) && JSON.stringify((obj as unknown[]).map(show)) === JSON.stringify((snap as unknown[]).map(show)); return same ? [] : [`${name}${path} = ${show(obj)};   // was ${show(snap)}`]; }
  if (obj && typeof obj === 'object') return Object.keys(obj).flatMap(k => diffLines(name, (obj as Tree)[k], (snap as Tree | undefined)?.[k], `${path}.${k}`));
  return [];
}
const anyDiff = (obj: unknown, snap: unknown) => diffLines('x', obj, snap).length > 0;
const changedHeader = (what: string, file: string) => `// ${what} (${file}) — changed in the viewer ${new Date().toISOString().slice(0, 16)}: apply by hand`;

type RangeFn = (path: string, key: string) => NumOpts & { slider?: boolean; steps?: number[]; names?: string[] };
/** every number / vector under `obj` as a row (label = its path from `base`); nested objects recurse, arrays of arrays index in */
function treeRows(p: Panel, sec: HTMLElement, obj: Tree, snap: Tree | undefined, range: RangeFn, onSet: () => void, base = '', skip: (k: string) => boolean = () => false) {
  for (const key of Object.keys(obj)) {
    if (skip(key)) continue;
    const v = obj[key]; const path = base ? `${base}.${key}` : key; const d = snap?.[key];
    if (typeof v === 'number') {
      const o = range(path, key);
      if (o.slider) p.slider(sec, path, o.min ?? 0, o.max ?? 1, o.step ?? 0.01, () => obj[key] as number, x => { obj[key] = x; onSet(); }, o.title, typeof d === 'number' ? d : undefined);
      else p.number(sec, path, () => obj[key] as number, x => { obj[key] = x; onSet(); }, { ...o, def: typeof d === 'number' ? d : undefined });
    } else if (Array.isArray(v) && v.length && typeof v[0] === 'number') {
      const o = range(path, key); const arr = v as number[];
      p.numbers(sec, path, arr.length, i => arr[i], (i, x) => { arr[i] = x; onSet(); }, { ...o, defs: Array.isArray(d) ? d as number[] : undefined, names: o.names ?? (/glow|color/i.test(path) ? ['r', 'g', 'b'] : arr.length === 3 ? ['x (left / side)', 'y (up)', 'z (ahead / along)'] : undefined) });
    } else if (Array.isArray(v)) { v.forEach((el, i) => { if (Array.isArray(el)) { const arr = el as number[]; const o = range(`${path}.${i}`, key); p.numbers(sec, `${path}[${i}]`, arr.length, j => arr[j], (j, x) => { arr[j] = x; onSet(); }, { ...o, defs: Array.isArray(d) && Array.isArray((d as unknown[])[i]) ? (d as number[][])[i] : undefined }); } }); }
    else if (v && typeof v === 'object') treeRows(p, sec, v as Tree, d as Tree | undefined, range, onSet, path, skip);
  }
}
/** the old viewer's RIG leaf ranges: offsets ±, half extents small and positive, glows wide, followPitch 0/1, the carbine's stock past −0.3, grip directions ±1 */
const rigRange = (group: string): RangeFn => (path) => {
  let o: NumOpts & { slider?: boolean; names?: string[] } = { min: -0.2, max: 0.45, step: 0.001 };
  if (/thick|tall|half/i.test(path)) o = { min: 0.002, max: 0.12, step: 0.001 };
  if (/glow/i.test(path)) o = /lensGlow/.test(path) ? { min: 0, max: 100, step: 1 } : { min: 0, max: 40, step: 0.1, title: 'screen glow + bloom only: the lit lens boxes are raster-only, no ray sees them, so this never lights the face or the wall' };
  if (/follow/i.test(path)) o = { min: 0, max: 1, step: 1, slider: true, title: '0: offsets in a yaw-only head frame · 1 (shipped): offsets ride the skull\'s full rotation (crouch / aim-down / death keep them on the face); boxes still only yaw' };
  if (/^l[01]$|\.l[01]$/.test(path) && (group === 'carbine' || group === 'sc20k' || group === 'm4')) o = { min: -0.4, max: 0.5, step: 0.001 };
  if (/lightAhead|lightUnder/.test(path)) o = { min: -0.1, max: 0.5, step: 0.001, title: 'where the actual spot light sits relative to the hand / lens (m)' };
  if (/fingers|back/i.test(path) && (group === 'carbine' || group === 'sc20k')) o = { min: -1, max: 1, step: 0.01, title: 'support hand on the handguard / round the foregrip post: the direction its fingers point / the back of the hand faces, in the gun\'s axes (x = the figure\'s left, y = up out of the receiver, z = toward the muzzle) — normalized on use' };
  if (/^slung\.off/.test(path)) o = { min: -0.5, max: 0.5, step: 0.005, title: 'the slung rifle\'s bore-above-trigger point off the MID-BACK joint (spine2) in the back\'s frame (m): left · up the spine line (hips → between the shoulders) · ahead (− = behind the spine: the hull is 2.4 cm each side of the bore, the torso capsules ~16 cm)', names: ['left', 'up spine', 'ahead'] };
  if (/^slung\.bore/.test(path)) o = { min: -1, max: 1, step: 0.02, title: 'the way the slung rifle\'s muzzle points in the back\'s frame [left, up the spine, ahead] — normalized on use ([0.5, −0.87, 0] = 30° left of straight down the spine)', names: ['left', 'up spine', 'ahead'] };
  if (/^slung\.roll/.test(path)) o = { min: -180, max: 180, step: 1, title: 'degrees about the bore: 0 = its right side flat on the back, 180 = its left side (magazine / foregrip toward the left shoulder, the light outward); anything between stands it on edge' };
  if (/^slung\.follow/.test(path)) o = { min: 0, max: 1, step: 0.05, slider: true, title: 'which way the back frame faces: 0 = square to the HIP line … 1 = square to the SHOULDER line (an aim\'s chest twist, the clips\' counter-swing): a rigid thing bridging shoulder blade and hip goes half with each' };
  return o;
};
const holdRange: RangeFn = (path, key) => {
  if (/^secs\.|Secs$|offSecs/.test(path) || /secs/.test(key)) return { step: 0.01, min: 0, max: 6, title: 'seconds' };
  if (/^struggle\.(rise|fadeFrom|fadeTo)$/.test(path)) return { step: 0.01, min: 0, max: 1, slider: true };
  if (/^struggle\.(claw|dip)$/.test(path) || /kickBack|^dist$|^sag/.test(path)) return { step: 0.005, title: 'metres' };
  if (/hz$/i.test(key)) return { step: 0.05, min: 0, max: 8, title: 'Hz', names: ['trunk yaw Hz', 'roll Hz', 'head Hz'] };
  if (/yaw|pitch|roll|lean|clav|arch|chin|aside|loll|brace|hunch|^side$|\.side$|^head$|\.head$|struggle\.(yaw|roll|head)/i.test(path)) return { step: 0.5, title: 'degrees' };
  if (/bore|blade|back|Bore|Blade|Back/.test(key)) return { step: 0.02, min: -1.5, max: 1.5, title: 'a model-space direction [left, up, ahead], normalized on use' };
  return { step: 0.005, title: 'metres, model space [left, up, ahead of the root]' };
};
const wallRange: RangeFn = (path, key) => {
  if (/^feet\.trailHeel$/.test(path)) return { step: 0.05, min: 0, max: 1, slider: true, title: 'share of the crouch clip\'s raised heel the trail foot keeps (0 = flat)' };
  if (/^feet\./.test(path)) return { step: 0.005, steps: [0.005, 0.005, 0.5], title: '[along the wall toward the lead side (m), off the plane (m), toes opened toward that side (°)]', names: ['along the wall (m)', 'off the plane (m)', 'toes out (°)'] };
  if (/^elbow\./.test(path) || key === 'narrow') return { step: 0.05, min: -2, max: 2 };
  if (key === 'back') return { step: 0.005, title: 'hips joint off the wall plane (m)', names: ['parked standing', 'parked crouched', 'sidling'] };
  if (key === 'lean') return { step: 0.5, title: 'the spine\'s line off vertical toward the room (°)', names: ['standing', 'crouched'] };
  if (key === 'drop') return { step: 0.005, title: 'pelvis settled onto soft knees (m)', names: ['standing', 'crouched'] };
  if (/lean|turn|gaze|pitch|tilt|Turn|Pitch/.test(path)) return { step: 0.5, title: 'degrees' };
  return { step: 0.005, title: 'metres' };
};

// ---------------------------------------------------------------- snapshots of every live table at load (= the shipped numbers)
const LONG0 = clone(LONG), LONGC0 = clone(LONG_CROUCH), HOLD0 = clone(HOLD), WALL0 = clone(WALL_POSE);
const FX0 = { shot: clone(fxm.shot), bang: clone(fxm.bang), vent: clone(fxm.vent), sparks: clone(fxm.sparks), flags: clone(fxm.flags), tracerFx: clone(fxm.tracerFx) };
export const EMITTER0 = { jetOff: [...fxm.shot.jetOff], portOff: [...fxm.shot.portOff], wispOff: [...fxm.shot.wispOff] } as Record<string, number[]>;
/** the paste-back for character.ts: the standing table, the crouched table, then the LONG_STEADY one-liner — over the three statements as they stand there */
export function longSource(): string {
  const n = (x: number) => String(+x.toFixed(3));
  const table = (name: string, T: Record<LongStance, LongShape>) => `export const ${name}: Record<LongStance, LongShape> = {\n${LONG_STANCES.map(k => { const s = T[k]; return `  ${k}: { side: ${n(s.side)}, up: ${n(s.up)}, fwd: ${n(s.fwd)}, anchor: ${n(s.anchor)}, pitch: ${n(s.pitch)}, aimK: ${n(s.aimK)}, yaw: ${n(s.yaw)}, blade: ${n(s.blade)}, lean: ${n(s.lean)}, headYaw: ${n(s.headYaw)}, headPitch: ${n(s.headPitch)}, headRoll: ${n(s.headRoll)}, elbowR: [${s.elbowR.map(n).join(', ')}], elbowL: [${s.elbowL.map(n).join(', ')}], poleW: ${n(s.poleW)}, sway: ${n(s.sway)}, steady: ${n(s.steady)} },`; }).join('\n')}\n};`;
  return `${table('LONG', LONG)}\n${table('LONG_CROUCH', LONG_CROUCH)}\nexport const LONG_STEADY = { tau: ${n(LONG_STEADY.tau)}, runYaw: ${n(LONG_STEADY.runYaw)} };`;
}
const LONG_SRC0 = longSource(); const LONG_STEADY0 = { ...LONG_STEADY };
export const rigChanged = () => rigSource(RIG) !== rigSource(RIG_DEFAULTS);
/** the shipped Adj behind a rig node path (for the node rows' revert dots): zeros where the shipped rig has none */
export function shippedAdj(path: string): Adj {
  const Z: Adj = { off: [0, 0, 0], rot: [0, 0, 0] }; const s = path.split('.'); const D = RIG_DEFAULTS as unknown as Record<string, Tree>;
  if (s[0] === 'emitters') return s[1] && EMITTER0[s[1]] ? { off: EMITTER0[s[1]] as Vec3, rot: [0, 0, 0] } : Z;
  if (s[0] === 'goggles') { const G = RIG_DEFAULTS.goggles; const a = s.length === 2 ? (s[1] === 'on' ? G.onAdj : G.offAdj) : s[2] === 'housing' || s[2] === 'bridge' ? G.housingAdj : G.lensAdj; return a ?? Z; }
  const grp = D[s[0]]; if (!grp) return Z;
  if (s.length === 1) return (grp.adj as Adj | undefined) ?? Z;
  if (s[1] === 'gripL') return { off: ((grp.gripL as Tree | undefined)?.off as Vec3 | undefined) ?? Z.off, rot: [0, 0, 0] };   // (the carbine's handguard point / the FN2000's foregrip point: whichever group the path names)
  return ((grp[s[1]] as Tree | undefined)?.adj as Adj | undefined) ?? Z;
}
/** the RIG object behind a rig node path — its structured numbers are 'the constants behind' the node the sheet shows under the transform */
export function rigObjectFor(path: string): { obj: Tree; snap: Tree | undefined; group: string; base: string; skip?: (k: string) => boolean } | null {
  const s = path.split('.'); const R = RIG as unknown as Record<string, Tree>, D = RIG_DEFAULTS as unknown as Record<string, Tree>;
  if (s[0] === 'emitters') return null;
  if (s[0] === 'holster') return { obj: R.holster, snap: D.holster, group: 'holster', base: 'holster' };   // (the thigh holster: down / out / fwd + its adj — RIG.holster since the canister/holster promotion)
  if (s[0] === 'can') return s.length <= 1 ? { obj: R.can, snap: D.can, group: 'can', base: 'can' } : { obj: R.can[s[1]] as Tree, snap: D.can[s[1]] as Tree, group: 'can', base: `can.${s[1]}` };
  if (s[0] === 'goggles') {
    if (s.length <= 2) return { obj: R.goggles, snap: D.goggles, group: 'goggles', base: 'goggles' };
    if (s[2] === 'housing') return { obj: R.goggles.housing as Tree, snap: D.goggles.housing as Tree, group: 'goggles', base: 'goggles.housing' };
    if (s[2] === 'bridge' || s[2] === 'tubes') return { obj: R.goggles.tubes as Tree, snap: D.goggles.tubes as Tree, group: 'goggles', base: 'goggles.tubes' };   // (the 2010s two-tube set: its own numbers)
    return { obj: R.goggles, snap: D.goggles, group: 'goggles', base: 'goggles', skip: k => !/^lens/.test(k) };
  }
  const grp = R[s[0]]; if (!grp) return null;
  if (s.length === 1) return { obj: grp, snap: D[s[0]], group: s[0], base: s[0] };
  const part = grp[s[1]]; if (!part || typeof part !== 'object') return null;
  return { obj: part as Tree, snap: D[s[0]]?.[s[1]] as Tree | undefined, group: s[0], base: `${s[0]}.${s[1]}` };
}

// ---------------------------------------------------------------- the registry
export function makeGroups(ctx: SheetCtx): { get(id: string): GroupDef | null; ids: string[] } {
  const { rt } = ctx; const st = rt.st; const S = rt.engine.settings; const smoke = rt.smoke; const sparks = rt.sparks;
  const SMOKE0 = clone(smoke.params);
  const rigDirty = () => { /* rigBoxes reads RIG next frame; the constants box follows on copy */ };
  const G = new Map<string, GroupDef>();
  const add = (g: GroupDef) => { G.set(g.id, g); };

  // ---- always on top: the figure
  add({ id: 'figure', title: 'Figure', open: true, build: (p, sec) => {
    p.number(sec, 'body yaw °', () => st.bodyYawDeg, v => rt.setBodyYaw(Math.round(wrapAngle(v * DEG) / DEG)), { step: 1, title: '0 = facing the default camera (turntable: Playback ▸ Y)' });
    p.number(sec, 'speed m/s', () => st.speed, v => { st.speed = v; }, { step: 0.05, min: 0, max: 6, title: 'ground speed as the GAME drives it (Locomotion ▸ presets); the gait blend picks the clips' });
    p.toggleBox(sec, 'crouched', () => !!st.crouch, v => { st.crouch = v ? 1 : 0; });
    p.select(sec, 'upper body', UPPERS.map(u => u.name), () => st.upper, v => { st.upper = v; }, 'the upper-body layer: none = arms follow the legs, relaxed = the two-hand pistol carry (as player.ts: only with the pistol actually in the hand — holstered or a can up it comes to none), aim = the aim clips by pitch, shoot = aim + a round every 0.6 s, torch = Idle_Torch_Loop');
    p.slider(sec, 'aim pitch °', -60, 70, 1, () => st.aimPitchDeg, v => { st.aimPitchDeg = v; }, 'blends Pistol_Aim_Down/Neutral/Up + spine twist; also tilts the guard torch / the shouldered carbine', 0);
    p.slider(sec, 'aim yaw offset °', -100, 100, 1, () => st.aimYawDeg, v => { st.aimYawDeg = v; }, 'chest twist toward the aim relative to the hips', 0);
    p.slider(sec, 'look yaw °', -80, 80, 1, () => st.lookYawDeg, v => { st.lookYawDeg = v; }, 'extra neck/head yaw (guards looking around) — the goggles must follow', 0);
    p.select(sec, 'right hand', ['0 · holstered (hands free)', gearText('1 · Five-seveN drawn'), '2 · canister in the fist'], () => Math.min(2, st.slot), v => { st.slot = v; }, gearText('The player\'s slot (1 / 2 / 0 keys): holstered = the sidearm on the thigh, arms swing (with the FN2000 in his hands the pistol rides the thigh whatever this says)'));
    p.select(sec, gearText('FN2000 (4)'), RIFLE_NAMES, () => st.rifle, v => { st.rifle = v; if (v === 2) { st.guard = false; st.carbine = false; } }, 'The player\'s rifle (RIG.sc20k): slung across his back off the mid-back joint, or in both hands — the long-gun solve with its foregrip point (turns the guard kit off); carriages: the player ▸ rifle variants / the Long gun group; 4 cycles it');
    p.toggleBox(sec, 'guard kit (G)', () => st.guard, v => { st.guard = v; if (!v) st.carbine = false; else if (st.rifle === 2) st.rifle = 0; }, 'guard tint + guard kit: hand torch (patrol carry) or drawn pistol with weapon light');
    p.select(sec, 'guard carry', ['torch (patrol)', 'pistol drawn'], () => st.guardTorch ? 0 : 1, v => { st.guardTorch = v === 0; }, 'the sidearm kit (ignored while the carbine is in his hands)');
    p.toggleBox(sec, 'carbine (C)', () => st.carbine, v => { st.carbine = v; if (v) { st.guard = true; if (st.rifle === 2) st.rifle = 0; } }, 'the guard kit\'s AKS-74U-style carbine in both hands (turns the guard kit on); carriages: Guard ▸ carbine variants / the Long gun group');
    p.toggleBox(sec, 'goggles worn', () => st.goggles, v => { st.goggles = v; });
    p.toggleBox(sec, 'night vision (N)', () => st.nv, v => { st.nv = v; }, 'on: tubes down over the eyes · off: flipped up (the lenses glow only with ?oldgear: down and blazing / parked on the forehead, dim)');
    p.toggleBox(sec, 'light on (L)', () => st.lightOn, v => { st.lightOn = v; }, 'rail light (the player, slot 1) / torch or weapon light (guard)');
    p.buttons(sec, '', [{ text: 'die: shot (X)', run: () => rt.die('shot'), title: 'the game\'s ragdoll, shoved along the camera\'s view like a round' }, { text: 'die: takedown', run: () => rt.die('takedown'), title: 'folds forward quietly' }, { text: 'respawn', run: () => rt.spawn() }]);
  } });
  add({ id: 'playback', title: 'Playback · clips', open: false, build: (p, sec) => {
    p.toggleBox(sec, 'paused (P)', () => st.paused, v => { st.paused = v; });
    p.slider(sec, 'playback rate', 0, 2, 0.05, () => st.rate, v => { st.rate = v; }, 'time scale for the character only', 1);
    p.toggleBox(sec, 'turntable (Y)', () => st.turntable, v => { st.turntable = v; });
    p.number(sec, 'turntable °/s', () => st.turnRate, v => { st.turnRate = v; }, { step: 5, min: -180, max: 180 });
    p.select(sec, 'raw clip', ['— (game graph)', ...rt.clipNames], () => st.clip, v => { st.clip = v; }, 'bypass the graph and loop one library clip over the rest pose (props stay attached)');
    p.slider(sec, 'scrub', 0, 1, 0.005, () => { const r = rt.char.anim.rawClip; return r ? ((r.time % r.clip.duration) + r.clip.duration) % r.clip.duration / r.clip.duration : rt.char.anim.phase; }, v => { const r = rt.char.anim.rawClip; if (r) r.time = v * r.clip.duration; else rt.char.anim.phase = v; }, 'normalized clip time (raw clip) / locomotion phase (graph) — pause first');
    p.toggleBox(sec, 'draw props', () => st.showProps, v => { st.showProps = v; }, 'off = bare mannequin (to see what the boxes hide)');
    p.toggleBox(sec, 'NV screen effect too', () => st.nvScreen, v => { st.nvScreen = v; }, 'also run the game\'s night-vision post while NV is on (you will not see the lens colours through it)');
    p.toggleBox(sec, 'gun smoke on shoot', () => st.gunSmoke, v => { st.gunSmoke = v; });
    p.toggleBox(sec, 'emitter gizmos', () => st.emitterGizmos, v => { st.emitterGizmos = v; }, 'bore jet / side ports / muzzle wisp anchors as pickable nodes on the muzzle frame (outliner: shot emitters ▸ …)');
  } });

  // ---- locomotion (the gait lab's drive) + its knob groups
  add({ id: 'locomotion', title: 'Locomotion (what the game drives)', open: true, build: (p, sec) => {
    p.select(sec, 'speed preset', ['—', ...PRESETS.map(x => x.name)], () => { const i = PRESETS.findIndex(x => Math.abs(x.speed - st.speed) < 1e-6 && x.crouch === st.crouch); return i + 1; }, v => { if (v > 0) { st.speed = PRESETS[v - 1].speed; st.crouch = PRESETS[v - 1].crouch; } }, 'game speeds: player tune / guard speeds — not the clips’ natural speeds');
    p.select(sec, 'clip 1:1', ['—', ...DRIVES.map(d => d.name)], () => 0, v => { if (v > 0) (st as unknown as { drive: number }).drive = v - 1; }, 'the clips\' NATURAL speeds (defaultAnimParams × speed mul): each cycle plays 1:1 — the old viewer\'s locomotion states');
    p.number(sec, 'speed m/s', () => st.speed, v => { st.speed = v; }, { step: 0.05, min: 0, max: 6 });
    p.toggleBox(sec, 'crouched', () => !!st.crouch, v => { st.crouch = v ? 1 : 0; });
    p.toggleBox(sec, 'backpedal', () => st.reverse, v => { st.reverse = v; }, 'play the locomotion backwards (the circle then faces against the travel)');
    p.select(sec, 'path', PATHS, () => st.path, v => rt.setPath(v), 'root motion: in place, an analytic circle (foot planting against the marks), starts / stops / turns, turning on the spot (the foot lock steps him round)');
    p.slider(sec, 'deliberate', 0, 1, 0.01, () => st.deliberate, v => { st.deliberate = v; }, 'anim.deliberate — what the game raises inside ~7 m of a living guard who has not clocked the player: crouch walk = cadence × 0.78 with the stride warped longer to match, a linger over each plant, pelvis −4 cm, torso further over, arms in; walk = arms in + softer knees only', 0);
    p.toggleBox(sec, 'floor marks (25 cm)', () => st.marks, v => { st.marks = v; }, 'thin strips across the walking direction to judge a planted foot against');
    p.toggleBox(sec, 'ALL TWEAKS OFF', () => st.allOff, v => { st.allOff = v; setAllOff(v); }, 'gaze off, bounce as authored, no stride warps, no stance linger or stance-foot pin, no soft knee, no life layer, no foot lock, the old natural speeds (only the walk clip\'s phase alignment to the jog stays) — flip it while he moves');
    p.buttons(sec, '', [{ text: 'reset all gait constants', run: () => { if (st.allOff) { st.allOff = false; setAllOff(false); } for (const g of ALL_GAIT_GROUPS) resetGaitGroup(g); } }, { text: 'copy gait constants', run: () => ctx.emit(gaitSource(), 'gait constants — paste over the matching lines in src/game/character.ts') }]);
  } });
  const gaitGroup = (g: KnobGroup, copy: () => string): GroupDef => ({ id: g.id, title: g.name, open: g.open,
    build: (p, sec) => { for (const k of g.knobs) { const tip = (k.tip ? k.tip + ' · ' : '') + `default ${DEFAULTS.get(k)}`; if (k.slider) p.slider(sec, k.label, k.min, k.max, k.step, () => k.o[k.k], v => { k.o[k.k] = v; }, tip, DEFAULTS.get(k)); else p.number(sec, k.label, () => k.o[k.k], v => { k.o[k.k] = v; }, { step: k.step, min: k.min, max: k.max, title: tip, def: DEFAULTS.get(k) }); } },
    copy, changed: () => gaitGroupChanged(g), reset: () => resetGaitGroup(g) });
  for (const g of GAIT_GROUPS) add(gaitGroup(g, gaitSource));
  add(gaitGroup(SOFT_KNEE_GROUP, softKneeSource));

  // ---- the tactical layer: stances, one-shots, the loop
  add({ id: 'tactical', title: 'Tactical (procedural layer)', open: true, build: (p, sec) => {
    p.select(sec, 'stance', STANCE_NAMES, () => st.stance, v => { st.stance = v; }, 'continuous carries layered under aim: compose with the aim yaw offset, walking and crouch; aim / shoot still win. wall = the player\'s Q hold, a body of its own (the wall is taken square behind the body-yaw heading; walk it and the legs turn 55° toward "side" the way player.ts sidles)');
    p.select(sec, 'side (stack: wall on… / wall: looking…)', ['left', 'right'], () => st.stackSide > 0 ? 1 : 0, v => { st.stackSide = v ? 1 : -1; }, 'stack: mirrors the blade — pelvis toward the wall, head to the door. wall: the way along the wall he looks, leads with the foot and peeks (a flip sweeps across, ~0.3 s)');
    p.slider(sec, 'wall peek', 0, 1, 0.01, () => st.peek, v => { st.peek = v; }, 'anim.wallPeek: leaning out past the wall\'s end on "side" (the game ramps it 0→1 over 0.3 s); the neck\'s extra 30° crane the game adds is emulated too', 0);
    p.toggleBox(sec, 'lockpick', () => st.lockpick, v => { st.lockpick = v; }, 'forces the crouch; hands work a keyway 0.45 m ahead at 0.96 m (anim.lockpickAt); half way there the animator raises hideHeldItem and the pistol / can leaves the hand');
    p.buttons(sec, 'one-shots', [{ text: 'kick', run: () => rt.fireTac(0), title: 'front kick at handle height; impact at KICK_IMPACT (flash on the HUD line)' }, { text: 'hold', run: () => rt.fireTac(1) }, { text: 'go', run: () => rt.fireTac(2) }, { text: 'rally', run: () => rt.fireTac(3) }, { text: 'flinch', run: () => rt.fireTac(4) }, { text: 'throw', run: () => rt.fireTac(5), title: `overhand throw off the right hand, ${THROW_DUR} s: the can leaves the hand at THROW_RELEASE = ${THROW_RELEASE} s` }]);
    p.buttons(sec, '', [{ text: 'reload', run: () => rt.fireTac(6) }, { text: 'shoot (K)', run: () => rt.fireTac(7) }, { text: 'strike', run: () => rt.fireTac(8), title: 'the takedown\'s Punch_Cross' }, { text: 'hit', run: () => rt.char.anim.hit() }]);
    p.select(sec, 'loop this one-shot', TAC_SHOTS, () => st.tacShot, v => { st.tacShot = v; }, 'what the loop keeps re-firing (the hold / door beats only do something in those scenes)');
    p.toggleBox(sec, 'loop every N s', () => st.tacLoop, v => { st.tacLoop = v; }, 're-fires the selected one-shot for inspection; playback rate and pause apply (the one-shot clocks run inside the animator)');
    p.number(sec, 'N (s)', () => st.tacEvery, v => { st.tacEvery = v; }, { step: 0.1, min: 0.5, max: 10 });
    p.toggleBox(sec, 'spawn a can at release', () => st.throwSpawn, v => { st.throwSpawn = v; }, 'throw with slot 2: a physical smoke can (dead fuse) leaves the hand at THROW_RELEASE with a throw\'s velocity, as the game\'s pendingThrow does');
    p.text(sec, () => { const an = rt.char.anim; return `stance ${STANCES[st.stance]}${st.stance >= 3 ? (st.stackSide > 0 ? ' R' : ' L') : ''}${st.stance === 4 ? ` · wall ${Math.round(an.wallYaw / DEG)}° round, peek ${an.wallPeek.toFixed(2)}` : ''}${an.longGun ? ` · long gun: ${an.longShown ?? '—'}${an.longStance ? ' (forced)' : ' (derived)'}` : ''} · ${an.kicking ? `kick t=${an.kickTime.toFixed(2)}${an.kickTime >= KICK_IMPACT ? ' (past impact)' : ''}` : an.inThrow ? `throw t=${an.throwTime.toFixed(2)}${an.throwTime >= THROW_RELEASE ? ' (released)' : ' (in hand)'}` : an.signalling ? 'signalling' : an.lockpick ? 'picking' : an.striking ? 'striking' : an.reloading ? 'reloading' : 'idle'}${an.hideHeldItem ? ' · held item hidden' : ''}`; });
  } });
  // ---- rifles: the long gun's carriages, per posture (character.ts LONG standing / LONG_CROUCH crouched, blended by the crouch shown) — one builder, two groups;
  //      the rows follow the carriage ON SHOW (the sheet rebuilds when it changes)
  const longGroup = (id: string, T: Record<LongStance, LongShape>, T0: Record<LongStance, LongShape>, crouched: boolean) => add({ id, title: crouched ? 'Long gun carriage, crouched (LONG_CROUCH)' : 'Long gun carriage, standing (LONG)', open: true, build: (p, sec) => {
    const tname = crouched ? 'LONG_CROUCH' : 'LONG';
    if (!crouched) {
      p.select(sec, 'carriage', ['derived (upper / stance / kick)', 'patrolLong (calm carry, low across the front)', 'lowLong (long-gun low ready)', 'shoulder (aiming: bore on aimDir)', 'portLong (high port: doors, the kick)'], () => st.longStance, v => { st.longStance = v; if (v && !st.carbine && st.rifle !== 2) { if (st.guard) st.carbine = true; else st.rifle = 2; } }, 'anim.longStance — needs a long gun in the hands (puts one there: the carbine on the guard kit, the FN2000 on the player). Derived = what the pistol man\'s upper / stance / kick come to (none → patrolLong, aim → shoulder, low ready → lowLong, high ready / stack / kick → portLong) — the guards\'. player.ts forces the player\'s: in the hands at all → shoulder (over the aim clip\'s trunk, whatever "upper body" says), the sprint → lowLong, a kick / a leaf under the hand → portLong');
      p.select(sec, 'steady against the gait', ['as the game (the player on · guards off)', 'off', 'on'], () => st.longSteady, v => { st.longSteady = v; }, 'anim.longSteady × the carriage\'s "steady": the trunk\'s side-to-side rock once a stride is kept out of the trigger hand (the arms take it up — LONG_STEADY.tau below), and at a run un-aimed the shoulder line is held to the weapon instead of pumping with the run clip (LONG_STEADY.runYaw). Walk / crouch-walk / sprint him (Figure ▸ speed) and flip this for the before / after');
    } else p.toggleBox(sec, 'crouched (Figure)', () => st.crouch >= 0.5, v => { st.crouch = v ? 1 : 0; }, 'the same switch as Figure ▸ crouched: this table only shows fully crouched (the solve lerps LONG → LONG_CROUCH by the crouch weight, ahead of the carriage springs — a crouch mid-aim eases like a change of carriage)');
    // getters, setters and shipped defaults all go through cur()
    const curName = (): LongStance => (rt.char.anim.longShown ?? (st.longStance ? LONG_STANCES[st.longStance - 1] : 'patrolLong')) as LongStance;
    const s = () => T[curName()], d = () => T0[curName()];
    p.text(sec, () => `editing ${tname}.${curName()}${rt.char.anim.longShown ? '' : ' (no long gun in the hands: nothing to see)'}${crouched && st.crouch < 0.5 ? ' — he is STANDING: these numbers are not on show (tick crouched)' : !crouched && st.crouch >= 0.5 ? ' — he is CROUCHED: the crouched table below is what shows' : ''} — one table for the carbine and the ${gearText('FN2000')}${crouched ? ', shipped as a copy of the standing one' : ''}: the trigger hand's wrist off the chest joint (or the gun shoulder: anchor), the bore's own pitch / yaw, the trunk's blade / lean, the head on the stock, the elbows, the idle sway, the steadying`);
    const numr = (label: string, key: keyof LongShape, step: number, min: number, max: number, title?: string) => p.number(sec, label, () => s()[key] as number, v => { (s()[key] as number) = v; }, { step, min, max, title, def: () => d()[key] as number });
    const sld = (label: string, key: keyof LongShape, min: number, max: number, step: number, title?: string) => p.slider(sec, label, min, max, step, () => s()[key] as number, v => { (s()[key] as number) = v; }, title, () => d()[key] as number);
    const L = crouched ? 'C· ' : 'L· ';
    numr(L + 'trigger hand side', 'side', 0.005, -0.35, 0.2, 'wrist off the chest joint (or the gun shoulder: anchor), model axes (m): + = the figure\'s left'); numr(L + 'trigger hand up', 'up', 0.005, -0.4, 0.3); numr(L + 'trigger hand fwd', 'fwd', 0.005, 0, 0.4);
    sld(L + 'anchor (0 chest · 1 gun shoulder)', 'anchor', 0, 1, 0.05, '0 = the point is off the chest joint; 1 = off the gun shoulder joint (½ shipped for the shouldered aim: between the two)');
    numr(L + 'bore pitch °', 'pitch', 1, -80, 80, 'own pitch (+ up)…'); sld(L + '× aim pitch', 'aimK', 0, 1, 0.05, '…plus this much of the character\'s aim pitch (1 = the light goes where the AI points it)'); numr(L + 'bore yaw °', 'yaw', 1, -60, 60, '+ = muzzle to the figure\'s left, off the chest heading');
    numr(L + 'blade °', 'blade', 1, -40, 20, 'upper spine yaw (− = gun shoulder back), countered at the neck'); numr(L + 'lean °', 'lean', 0.5, -5, 15);
    numr(L + 'head yaw °', 'headYaw', 1, -30, 30, '− = toward the gun shoulder'); numr(L + 'head pitch °', 'headPitch', 1, -15, 25, '+ = down onto the comb'); numr(L + 'head roll °', 'headRoll', 1, -20, 20, '+ = ear to the stock');
    (['elbowR', 'elbowL'] as const).forEach(k => p.numbers(sec, `${L}${k} [left+ up+ fwd+]`, 3, i => s()[k][i], (i, v) => { s()[k][i] = v; }, { step: 0.05, min: -1, max: 1, defs: () => d()[k], title: 'model-space direction the elbow is swivelled toward' }));
    sld(L + 'elbow hold', 'poleW', 0, 1, 0.05, 'how hard the elbows are held at those directions (0 = the IK\'s own plane)');
    sld(L + 'sway ×', 'sway', 0, 2, 0.05, 'the carry\'s idle figure-of-eight: bore ±0.6° yaw / ±0.8° pitch and the hand ±4 mm at 1 (shoulder 0.1, lowLong 0.25 shipped)');
    sld(L + 'steady (lateral, × longSteady)', 'steady', 0, 1, 0.05, 'how much of the trunk\'s side-to-side rock in the gait is kept OUT of the trigger hand\'s point for a figure that steadies its gun (the player; standing group ▸ steady against the gait): 1 = the gun rides the shoulders\' mean line, the arms take the rock; 0 = it goes with the chest joint as the guards\' does');
    if (!crouched) {
      p.number(sec, 'LONG_STEADY.tau s (all carriages)', () => LONG_STEADY.tau, v => { LONG_STEADY.tau = v; }, { step: 0.05, min: 0.05, max: 3, def: LONG_STEADY0.tau, title: 'time constant of the two-pole low-pass the steadied hand follows the trunk\'s side-to-side through: longer = deader against the stride (crouch-walk muzzle p-p ≈ 12 cm at 0, 1.7 at 0.5, 0.7 at 0.8) but slower to follow the weight settling onto one foot at rest' });
      p.number(sec, 'LONG_STEADY.runYaw (all carriages)', () => LONG_STEADY.runYaw, v => { LONG_STEADY.runYaw = v; }, { step: 0.05, min: 0, max: 1, def: LONG_STEADY0.runYaw, title: 'at a run un-aimed (the sprint\'s low ready), this share of the shoulder line\'s pumping (±25° in the run clips) is taken back out down the spine so the shoulders stay on the weapon: 0.85 leaves a walk\'s worth (±5°)' });
    }
    p.buttons(sec, '', [{ text: 'copy LONG tables', run: () => ctx.emit(longSource(), 'LONG + LONG_CROUCH + LONG_STEADY — paste over the three statements in character.ts'), title: 'both postures\' tables and the LONG_STEADY line, in paste-back form' }, { text: 'reset this carriage', run: () => { deepAssign(s() as unknown as Tree, d() as unknown as Tree); } }, ...(crouched ? [{ text: 'crouched ← standing (this carriage)', run: () => { deepAssign(s() as unknown as Tree, clone(LONG[curName()]) as unknown as Tree); }, title: 'start this crouched carriage again from the standing numbers as they are now' }] : [])]);
  }, copy: longSource, changed: () => longSource() !== LONG_SRC0, reset: () => { deepAssign(T as unknown as Tree, T0 as unknown as Tree); if (!crouched) Object.assign(LONG_STEADY, LONG_STEADY0); } });
  longGroup('long', LONG, LONG0, false);
  longGroup('longCrouch', LONG_CROUCH, LONGC0, true);
  // ---- the wall hold's pose table
  add({ id: 'wallPose', title: 'Wall hold pose (WALL_POSE)', open: false, build: (p, sec) => {
    p.text(sec, () => 'character.ts WALL_POSE, live: distances off the wall PLANE into the room (the root stands 0.45 off it), "along" toward the side he looks; angles in degrees. (STANCES.wall copies lean[0] / headPitch at load: those two follow on the next boot.)');
    treeRows(p, sec, WALL_POSE as unknown as Tree, WALL0 as unknown as Tree, wallRange, () => {});
  }, copy: () => [changedHeader('WALL_POSE', 'src/game/character.ts'), ...diffLines('WALL_POSE', WALL_POSE, WALL0)].join('\n'), changed: () => anyDiff(WALL_POSE, WALL0), reset: () => deepAssign(WALL_POSE as unknown as Tree, WALL0 as unknown as Tree) });

  // ---- the hold: driving rows, then the contact constants
  add({ id: 'hold', title: 'Hold (grab / human shield)', open: true, build: (p, sec) => {
    const H = () => st.hold;
    p.toggleBox(sec, 'pose the hold', () => H().on, v => { H().on = v; H().t = 0; if (v) { st.stance = 0; st.lockpick = false; if (H().who === 0) { st.guard = false; if (H().variant === 1) st.slot = 1; } else st.guard = true; } }, 'drives anim.holdPose (the holder: the player) or anim.heldPose (the held man) on this one mannequin — the layer eases itself in and out; upper body / stance are forced off while it is on, the legs keep whatever locomotion is set (walk it: the hands must stay put)');
    p.select(sec, 'figure', ['holder (player)', 'held man (guard kit)'], () => H().who, v => { H().who = v; H().t = 0; if (v === 1) st.guard = true; else { st.guard = false; st.carbine = false; if (H().variant === 1) st.slot = 1; } });
    p.select(sec, 'variant', ['arm (both hands on him, knife in the fist, pistol on the thigh)', gearText('gun (Five-seveN up beside his head)')], () => H().variant, v => { H().variant = v; H().t = 0; if (v === 1 && H().who === 0) st.slot = 1; }, 'fixed at the grab in the game by what is in the hand (drawn → gun, holstered / canister → arm) and swapped by E mid-hold — flip it here with the hold on and the layers hand the tools over (HOLD.secs.swap)');
    p.select(sec, 'phase', ['grab (the reach, 0.45 s)', 'held', `choke (arm: ${HOLD.secs.choke} s)`, `whip (gun: lands at ${HOLD.secs.whip} s)`, `kill (arm: ${HOLD.secs.kill} s)`], () => H().phase, v => { H().phase = v; H().t = 0; });
    p.slider(sec, 't (s into the phase)', 0, 4, 0.01, () => H().t, v => { H().t = v; }, 'scrub with auto off (or paused)');
    p.toggleBox(sec, 'auto-advance t (loops the one-shots)', () => H().auto, v => { H().auto = v; });
    p.slider(sec, 'gun out (holder, gun)', 0, 1, 0.01, () => H().gunOut, v => { H().gunOut = v; }, 'HoldPose.gunOut: 0 = the can along his temple, 1 = presented dead ahead to fire past him (the game eases it up in a few frames on a click and back ~1 s after the last round)', 0);
    p.slider(sec, 'gun pitch ° (presented)', -45, 45, 1, () => H().gunPitchDeg, v => { H().gunPitchDeg = v; }, undefined, 0);
    p.slider(sec, 'agitation (held man)', 0, 1, 0.01, () => H().agitation, v => { H().agitation = v; }, 'HeldPose.agitation: the struggle\'s amplitude (the dialogue engine\'s number in the game)', 0.4);
    p.buttons(sec, '', [{ text: 'fire past him (K)', run: () => rt.shoot(), title: 'holder: the recoil kick on the gun hand (gun variant, gun out); held man: the duck off a round past his ear (HeldPose.shot)' }, { text: 'restart phase', run: () => { H().t = 0; } }, { text: 'swap (E)', run: () => rt.fireTac(9) }, { text: H().on ? 'let go' : 'grab', run: () => rt.fireTac(10) }]);
    p.toggleBox(sec, 'knife in the fist regardless', () => H().knife, v => { H().knife = v; }, 'draw RIG.knife in the right fist whatever the pose (it is drawn anyway while the holder poses the arm variant, as in the game) — for tuning its lie in the hand against other carries');
    p.toggleBox(sec, 'partner marker', () => H().marker, v => { H().marker = v; });
    p.text(sec, () => { const an = rt.char.anim; const P = H().who === 0 ? an.holdPose : an.heldPose; return `${H().on ? (H().who === 0 ? 'holdPose' : 'heldPose') : 'off'} ${P ? `${P.variant ?? 'arm'} · ${P.phase} t ${P.t.toFixed(2)}` : '—'}${an.hideHeldItem ? ' · held item hidden' : ''}${an.holdGunSide ? ' · gun side' : ''} · HOLD.dist ${HOLD.dist} · secs ${JSON.stringify(HOLD.secs)}`; });
  } });
  add({ id: 'holdConsts', title: 'Hold contact constants (HOLD)', open: false, build: (p, sec) => {
    p.text(sec, () => 'character.ts HOLD, live: points in each figure\'s own model space [left, up, ahead of its root] (the man\'s root sits HOLD.dist ahead of the player\'s), angles in degrees, secs = the controller\'s timings');
    treeRows(p, sec, HOLD as unknown as Tree, HOLD0 as unknown as Tree, holdRange, () => {});
  }, copy: () => [changedHeader('HOLD', 'src/game/character.ts'), ...diffLines('HOLD', HOLD, HOLD0)].join('\n'), changed: () => anyDiff(HOLD, HOLD0), reset: () => deepAssign(HOLD as unknown as Tree, HOLD0 as unknown as Tree) });

  // ---- kit + hand lights
  add({ id: 'kit', title: 'Kit', open: true, build: (p, sec) => {
    p.toggleBox(sec, 'goggles worn', () => st.goggles, v => { st.goggles = v; });
    p.toggleBox(sec, 'night vision on (N)', () => st.nv, v => { st.nv = v; }, 'on: tubes down over the eyes · off: flipped up (the lenses glow only with ?oldgear: down and blazing / parked on the forehead, dim)');
    p.select(sec, 'right hand', ['0 · holstered (hands free)', gearText('1 · Five-seveN drawn'), '2 · canister in the fist'], () => Math.min(2, st.slot), v => { st.slot = v; });
    p.select(sec, gearText('FN2000 (4)'), RIFLE_NAMES, () => st.rifle, v => { st.rifle = v; if (v === 2) { st.guard = false; st.carbine = false; } }, 'The player\'s rifle: off · slung across his back (RIG.sc20k.slung) · in both hands (its foregrip point, its muzzle, its light — L)');
    p.toggleBox(sec, 'rail light / torch on (L)', () => st.lightOn, v => { st.lightOn = v; });
    p.toggleBox(sec, 'show as guard (G)', () => st.guard, v => { st.guard = v; if (!v) st.carbine = false; else if (st.rifle === 2) st.rifle = 0; }, 'guard tint + guard kit: hand torch (patrol carry) or drawn pistol with weapon light');
    p.select(sec, 'guard carry', ['torch (patrol)', 'pistol drawn'], () => st.guardTorch ? 0 : 1, v => { st.guardTorch = v === 0; }, 'the sidearm kit (ignored while the carbine is in his hands)');
    p.toggleBox(sec, 'carbine (long gun) (C)', () => st.carbine, v => { st.carbine = v; if (v) { st.guard = true; if (st.rifle === 2) st.rifle = 0; } }, 'the guard kit\'s carbine (RIG.carbine) in both hands instead of torch / drawn pistol — its weapon light is his light (L), the sidearm stays on the thigh');
    p.number(sec, 'rail light intensity', () => rt.railLight.peakIntensity, v => { rt.railLight.peakIntensity = rt.railLight.intensity = v; }, { step: 5, min: 0, max: 400, def: 60, title: 'game.ts tune.playerLight' });
    p.number(sec, 'torch intensity', () => rt.torchLight.peakIntensity, v => { rt.torchLight.peakIntensity = rt.torchLight.intensity = v; }, { step: 5, min: 0, max: 400, def: 70, title: 'game.ts tune.flashIntensity' });
  } });
  // ---- dropped items
  add({ id: 'dropped', title: 'Dropped items (tossed from the hand)', open: true, build: (p, sec) => {
    p.buttons(sec, 'toss', [{ text: 'pistol', run: () => rt.toss('pistol') }, { text: gearText('Five-seveN (can)'), run: () => rt.toss('pistol', true) }, { text: 'torch', run: () => rt.toss('torch') }]);
    p.buttons(sec, '', [{ text: 'AKS-74U', run: () => rt.toss('rifle'), title: 'RIFLE_ITEM: what a rifleman\'s dying hand lets go of' }, { text: gearText('FN2000'), run: () => rt.toss('rifle', true), title: 'SC20K_ITEM (a rifle item with fill 1): what leaves the player\'s hands when he goes down with it' }, { text: gearText('ring airfoil'), run: () => rt.toss('ring'), title: 'RING_ITEM: a spent ring — three crossed slats' }]);
    p.buttons(sec, '', [{ text: 'smoke can', run: () => rt.toss('smoke') }, { text: 'stun can', run: () => rt.toss('flash') }, { text: 'magazine', run: () => rt.toss('mag') }, { text: 'clear items', run: () => { rt.stageItems.items.length = 0; } }]);
    p.text(sec, () => `${rt.stageItems.items.length} item(s) · models live in throwables.ts boxes() (pistol: slide + raked grip + can; torch: body + dark lens; the two rifles; the ring). No knife item exists.`);
  } });
  // ---- canisters
  add({ id: 'canisters', title: 'Canisters (on the floor mark, 1.6 m ahead)', open: true, build: (p, sec) => {
    const cs = st.cans; const P = smoke.params; const V = fxm.vent; const B = fxm.bang; const SP2 = fxm.sparks;
    p.buttons(sec, 'fire', [{ text: 'smoke can', run: () => rt.smokeCan() }, { text: 'stun can', run: () => rt.stunCan() }, { text: 'clear smoke', run: () => smoke.clearAll() }]);
    p.toggleBox(sec, 'smoke can = shipped plume', () => cs.plume, v => { cs.plume = v; }, 'off = the ported floor-hugging vent (effects.ts vent)');
    p.toggleBox(sec, 'loop (alternate every N s)', () => cs.loop, v => { cs.loop = v; cs.t = 0; });
    p.number(sec, 'loop period s', () => cs.loopEvery, v => { cs.loopEvery = v; }, { step: 1, min: 3, max: 60 });
    p.number(sec, 'plume density /s', () => P.canisterDensity, v => { P.canisterDensity = v; }, { step: 1, min: 0, max: 400, def: SMOKE0.canisterDensity });
    p.number(sec, 'plume seconds', () => P.canisterDuration, v => { P.canisterDuration = v; }, { step: 1, min: 1, max: 120, def: SMOKE0.canisterDuration });
    p.number(sec, 'plume radius m', () => P.canisterRadius, v => { P.canisterRadius = v; }, { step: 0.01, min: 0.02, max: 0.6, def: SMOKE0.canisterRadius });
    p.number(sec, 'plume heat', () => P.canisterTemp, v => { P.canisterTemp = v; }, { step: 0.1, min: 0, max: 12, def: SMOKE0.canisterTemp });
    p.number(sec, 'plume jet m/s', () => P.canisterSpeed, v => { P.canisterSpeed = v; }, { step: 0.1, min: 0, max: 10, def: SMOKE0.canisterSpeed });
    p.number(sec, 'vent density /s', () => V.density, v => { V.density = v; }, { step: 0.5, min: 0, max: 100, def: FX0.vent.density });
    p.number(sec, 'vent speed m/s', () => V.speed, v => { V.speed = v; }, { step: 0.1, min: 0, max: 12, def: FX0.vent.speed });
    p.number(sec, 'vent radius m', () => V.radius, v => { V.radius = v; }, { step: 0.01, min: 0.05, max: 0.8, def: FX0.vent.radius });
    p.number(sec, 'vent push', () => V.push, v => { V.push = v; }, { step: 1, min: 0, max: 120, def: FX0.vent.push });
    p.number(sec, 'vent seconds', () => V.seconds, v => { V.seconds = v; }, { step: 1, min: 1, max: 120, def: FX0.vent.seconds });
    p.number(sec, 'stun density ×', () => B.densityGain, v => { B.densityGain = v; }, { step: 0.05, min: 0, max: 6, def: FX0.bang.densityGain });
    p.number(sec, 'stun heat ×', () => B.tempGain, v => { B.tempGain = v; }, { step: 0.05, min: 0, max: 6, def: FX0.bang.tempGain });
    p.number(sec, 'stun expand', () => B.expand, v => { B.expand = v; }, { step: 1, min: 0, max: 300, def: FX0.bang.expand, title: 'divergence source: how hard the burst shoves its neighbourhood apart' });
    p.number(sec, 'stun end-jet m/s', () => B.ventSpeed, v => { B.ventSpeed = v; }, { step: 0.5, min: 0, max: 20, def: FX0.bang.ventSpeed });
    p.slider(sec, 'stun asymmetry', 0, 1, 0.05, () => B.asymmetry, v => { B.asymmetry = v; }, undefined, FX0.bang.asymmetry);
    p.number(sec, 'stun body vents', () => B.bodyVents, v => { B.bodyVents = Math.round(v); }, { step: 1, min: 0, max: 12, def: FX0.bang.bodyVents });
    p.number(sec, 'stun wisp density', () => B.wispDensity, v => { B.wispDensity = v; }, { step: 0.1, min: 0, max: 8, def: FX0.bang.wispDensity });
    p.number(sec, 'stun wisp life s', () => B.wispLife, v => { B.wispLife = v; }, { step: 0.5, min: 0, max: 20, def: FX0.bang.wispLife });
    p.number(sec, 'stun light power', () => B.lightPower, v => { B.lightPower = v; }, { step: 20, min: 0, max: 5000, def: FX0.bang.lightPower });
    p.number(sec, 'stun sparks', () => B.sparkCount, v => { B.sparkCount = Math.round(v); }, { step: 1, min: 0, max: 96, def: FX0.bang.sparkCount });
    p.number(sec, 'stun spark speed', () => SP2.speed, v => { SP2.speed = v; }, { step: 0.5, min: 0, max: 40, def: FX0.sparks.speed });
    p.number(sec, 'stun spark spread', () => SP2.spread, v => { SP2.spread = v; }, { step: 0.05, min: 0, max: 2, def: FX0.sparks.spread });
    p.number(sec, 'stun spark lift', () => SP2.lift, v => { SP2.lift = v; }, { step: 0.05, min: 0, max: 2, def: FX0.sparks.lift });
    p.number(sec, 'stun spark life s', () => SP2.life, v => { SP2.life = v; }, { step: 0.05, min: 0.05, max: 4, def: FX0.sparks.life });
    p.number(sec, 'stun smoke trails', () => B.trailCount, v => { B.trailCount = Math.round(v); }, { step: 1, min: 0, max: 30, def: FX0.bang.trailCount });
    p.text(sec, () => `numbers are src/game/effects.ts (vent / bang / sparks) + the Smoke panel's canister block — 'copy' lists the ones you moved`);
  }, copy: () => [changedHeader('canister numbers', 'src/game/effects.ts · src/smoke/smoke.ts'), ...diffLines('vent', fxm.vent, FX0.vent), ...diffLines('bang', fxm.bang, FX0.bang), ...diffLines('sparks', fxm.sparks, FX0.sparks), ...diffLines('smoke.params', pick(smoke.params, CAN_KEYS), pick(SMOKE0, CAN_KEYS))].join('\n'),
     changed: () => anyDiff(fxm.vent, FX0.vent) || anyDiff(fxm.bang, FX0.bang) || anyDiff(fxm.sparks, FX0.sparks) || anyDiff(pick(smoke.params, CAN_KEYS), pick(SMOKE0, CAN_KEYS)),
     reset: () => { deepAssign(fxm.vent as unknown as Tree, FX0.vent as unknown as Tree); deepAssign(fxm.bang as unknown as Tree, FX0.bang as unknown as Tree); deepAssign(fxm.sparks as unknown as Tree, FX0.sparks as unknown as Tree); for (const k of CAN_KEYS) (smoke.params as unknown as Record<string, number>)[k] = (SMOKE0 as unknown as Record<string, number>)[k]; } });
  // ---- effects: the shot
  add({ id: 'effects', title: 'Effects: the shot (K)', open: true, build: (p, sec) => {
    const SH = fxm.shot; const SP = sparks.params;
    p.toggleBox(sec, 'emitter gizmos', () => st.emitterGizmos, v => { st.emitterGizmos = v; }, 'bore jet / side ports / muzzle wisp anchors as pickable nodes on the muzzle frame (outliner: shot emitters ▸ …); offsets are [right, up, forward] m');
    for (const k of ['jetOff', 'portOff', 'wispOff'] as const) p.numbers(sec, k + ' [right up fwd]', 3, i => SH[k][i], (i, v) => { SH[k][i] = v; }, { step: 0.002, defs: FX0.shot[k], names: ['right', 'up', 'forward'] });
    p.number(sec, 'shot light power', () => SH.lightPower, v => { SH.lightPower = v; }, { step: 5, min: 0, max: 600, def: FX0.shot.lightPower });
    p.number(sec, 'shot light s', () => SH.lightDuration, v => { SH.lightDuration = v; }, { step: 0.01, min: 0.02, max: 0.5, def: FX0.shot.lightDuration });
    p.number(sec, 'jet density /s', () => SH.jetDensity, v => { SH.jetDensity = v; }, { step: 1, min: 0, max: 300, def: FX0.shot.jetDensity, title: 'bore jet; the two side ports carry portFraction of it' });
    p.number(sec, 'jet heat /s', () => SH.jetTemp, v => { SH.jetTemp = v; }, { step: 5, min: 0, max: 600, def: FX0.shot.jetTemp });
    p.number(sec, 'wisp density /s', () => SH.wispDensity, v => { SH.wispDensity = v; }, { step: 0.5, min: 0, max: 60, def: FX0.shot.wispDensity });
    p.number(sec, 'wisp heat /s', () => SH.wispTemp, v => { SH.wispTemp = v; }, { step: 1, min: 0, max: 300, def: FX0.shot.wispTemp });
    p.toggleBox(sec, 'ejection-port curl', () => fxm.flags.ejectionWisp, v => { fxm.flags.ejectionWisp = v; }, undefined, FX0.flags.ejectionWisp);
    p.toggleBox(sec, 'powder sparks', () => fxm.flags.shotSparks, v => { fxm.flags.shotSparks = v; }, undefined, FX0.flags.shotSparks);
    p.number(sec, 'sparks per shot', () => SH.sparkCount, v => { SH.sparkCount = Math.round(v); }, { step: 1, min: 0, max: 96, def: FX0.shot.sparkCount });
    p.number(sec, 'spark speed m/s', () => SH.sparkSpeed, v => { SH.sparkSpeed = v; }, { step: 0.5, min: 0, max: 60, def: FX0.shot.sparkSpeed, title: 'streak length = speed × shutter' });
    p.number(sec, 'spark cone rad', () => SH.sparkCone, v => { SH.sparkCone = v; }, { step: 0.01, min: 0.02, max: 1.5, def: FX0.shot.sparkCone });
    p.number(sec, 'spark life s', () => SH.sparkLife, v => { SH.sparkLife = v; }, { step: 0.01, min: 0.02, max: 1, def: FX0.shot.sparkLife });
    p.number(sec, 'spark gravity', () => SP.gravity, v => { SP.gravity = v; }, { step: 0.5, min: 0, max: 40, def: FX0.sparks.gravity });
    p.number(sec, 'spark drag /s', () => SP.drag, v => { SP.drag = v; }, { step: 0.1, min: 0, max: 8, def: FX0.sparks.drag });
    p.number(sec, 'spark brightness ×', () => SP.brightness, v => { SP.brightness = v; }, { step: 0.1, min: 0.1, max: 12, def: FX0.sparks.brightness });
    p.slider(sec, 'spark hold', 0, 0.9, 0.02, () => SP.hold, v => { SP.hold = v; }, 'fraction of its life a spark stays white-hot before fading orange → red', FX0.sparks.hold);
    p.number(sec, 'streak thickness mm', () => SP.thickness * 1000, v => { SP.thickness = v / 1000; }, { step: 1, min: 1, max: 40, def: FX0.sparks.thickness * 1000 });
    p.number(sec, 'shutter ms', () => SP.shutter * 1000, v => { SP.shutter = v / 1000; }, { step: 1, min: 1, max: 60, def: FX0.sparks.shutter * 1000 });
    // tracers (R6, tracers.ts / effects.ts tracerFx): the guard kit's carbine traces every third round + the last three of its box (the game's rule off a stand-in gun); force every round to grade the streak
    const TR = fxm.tracerFx;
    p.toggleBox(sec, 'tracer every round', () => st.tracerAll, v => { st.tracerAll = v; }, 'every K round flies as a tracer whatever the kit (grading). Off = the game\'s rule: guard kit + carbine (G, C) → rounds 3 6 9 … 27 and 28 29 30 of each thirty-round box; the pistols never');
    p.text(sec, () => `${rt.gunLine()} · tracers in flight ${rt.tracers.live} (${rt.tracers.lit} lit) · ${rt.tracers.spawned} fired`);
    p.number(sec, 'tracer speed m/s', () => TR.speed, v => { TR.speed = v; }, { step: 10, min: 20, max: 900, def: FX0.tracerFx.speed, title: 'the head\'s travel muzzle → impact (the round is hitscan; this is the picture): 280 = the stage\'s 6 m in a frame or two, a 20 m corridor in four or five' });
    p.number(sec, 'tracer min life s', () => TR.minLife, v => { TR.minLife = v; }, { step: 0.005, min: 0, max: 0.3, def: FX0.tracerFx.minLife, title: 'a short shot is slowed to last at least this long (the stage wall is close: this is what you see here)' });
    p.number(sec, 'tracer shutter ms', () => TR.shutter * 1000, v => { TR.shutter = v / 1000; }, { step: 1, min: 1, max: 60, def: FX0.tracerFx.shutter * 1000, title: 'streak length = speed × shutter, never more than the distance flown' });
    p.number(sec, 'tracer thickness mm', () => TR.thickness * 1000, v => { TR.thickness = v / 1000; }, { step: 1, min: 2, max: 80, def: FX0.tracerFx.thickness * 1000, title: 'widened to ~a pixel (dimmed by as much) when far, like the lasers' });
    p.number(sec, 'tracer emissive', () => TR.emissive, v => { TR.emissive = v; }, { step: 5, min: 0, max: 400, def: FX0.tracerFx.emissive, title: '× the row colour ([1, 0.42, 0.12]) = HDR radiance; the bloom does the glow' });
    p.number(sec, 'tracer head light', () => TR.lightIntensity, v => { TR.lightIntensity = v; }, { step: 0.5, min: 0, max: 60, def: FX0.tracerFx.lightIntensity, title: 'the transient point light on the head (a muzzle flash is 90+): the wash on the wall / floor it passes and the haze. 0 = streak only' });
    p.number(sec, 'tracer light range m', () => TR.lightRange, v => { TR.lightRange = v; }, { step: 0.5, min: 0.5, max: 12, def: FX0.tracerFx.lightRange });
    p.number(sec, 'tracer ember glow', () => TR.emberIntensity, v => { TR.emberIntensity = v; }, { step: 0.5, min: 0, max: 30, def: FX0.tracerFx.emberIntensity, title: 'the 60 ms glow where it stops in the wall' });
    p.number(sec, 'tracer ember sparks', () => TR.emberSparks, v => { TR.emberSparks = Math.round(v); }, { step: 1, min: 0, max: 12, def: FX0.tracerFx.emberSparks });
    p.text(sec, () => `sparks live ${sparks.live} · smoke bricks ${smoke.stats.pool} emitters ${smoke.stats.emitters} — numbers are shared with the game's Effects / Smoke panels`);
  }, copy: () => [changedHeader('shot numbers', 'src/game/effects.ts'), ...diffLines('shot', fxm.shot, FX0.shot), ...diffLines('sparks', fxm.sparks, FX0.sparks), ...diffLines('flags', fxm.flags, FX0.flags), ...diffLines('tracerFx', fxm.tracerFx, FX0.tracerFx)].join('\n'),
     changed: () => anyDiff(fxm.shot, FX0.shot) || anyDiff(fxm.flags, FX0.flags) || anyDiff(fxm.tracerFx, FX0.tracerFx), reset: () => { deepAssign(fxm.shot as unknown as Tree, FX0.shot as unknown as Tree); deepAssign(fxm.flags as unknown as Tree, FX0.flags as unknown as Tree); deepAssign(fxm.tracerFx as unknown as Tree, FX0.tracerFx as unknown as Tree); } });
  add({ id: 'effects.smoke', title: 'Smoke solver', open: false, build: (p, sec) => {
    const P = smoke.params;
    p.number(sec, 'smoke buoyancy', () => P.buoyancy, v => { P.buoyancy = v; }, { step: 0.05, min: 0, max: 8, def: SMOKE0.buoyancy });
    p.number(sec, 'smoke vorticity', () => P.vortConf, v => { P.vortConf = v; }, { step: 0.1, min: 0, max: 16, def: SMOKE0.vortConf });
    p.number(sec, 'smoke turbulence', () => P.turbulence, v => { P.turbulence = v; }, { step: 0.1, min: 0, max: 12, def: SMOKE0.turbulence });
    p.number(sec, 'density decay /s', () => P.densDecay, v => { P.densDecay = v; }, { step: 0.01, min: 0, max: 2, def: SMOKE0.densDecay });
    p.number(sec, 'temp decay /s', () => P.tempDecay, v => { P.tempDecay = v; }, { step: 0.05, min: 0, max: 6, def: SMOKE0.tempDecay });
    p.number(sec, 'velocity damping', () => P.velDamp, v => { P.velDamp = v; }, { step: 0.02, min: 0, max: 3, def: SMOKE0.velDamp });
    p.buttons(sec, '', [{ text: 'clear smoke', run: () => smoke.clearAll() }]);
  }, copy: () => [changedHeader('smoke solver', 'src/smoke/smoke.ts defaultSmokeParams'), ...diffLines('smoke.params', pick(smoke.params, SOLVER_KEYS), pick(SMOKE0, SOLVER_KEYS))].join('\n'), changed: () => anyDiff(pick(smoke.params, SOLVER_KEYS), pick(SMOKE0, SOLVER_KEYS)), reset: () => { for (const k of SOLVER_KEYS) (smoke.params as unknown as Record<string, number>)[k] = (SMOKE0 as unknown as Record<string, number>)[k]; } });

  // ---- RIG groups (rigProps.RIG): one per group, sharing the whole-RIG copy / reset
  const RIG_NOTE: Partial<Record<keyof Rig, string>> = {   // (what the 2010s kit — game/gear.ts, on unless ?oldgear — takes out of a group's hands)
    sc20k: ' With the 2010s kit the receiver, stock, magazine, handguard, rail and sight are RIG.m4\'s: those rows here move nothing (grip, foregrip, suppressor, light, sling and the group frame stay this group\'s).',
    goggles: ' With the 2010s kit the goggles are the two tubes (the `tubes` rows): the single housing\'s lens and glow rows draw only with ?oldgear.',
  };
  for (const g of ['goggles', 'pistol', 'torch', 'guardPistol', 'knife', 'sheath', 'can', 'holster', 'carbine', 'sc20k', 'm4'] as (keyof Rig)[]) {
    add({ id: `rig.${g}`, title: `RIG.${g}`, open: true, build: (p, sec) => {
      p.text(sec, () => `rigProps.RIG.${g}: metres along / across the bone axes (drag a number to scrub, 1 mm a step). Free adjustments (adj) are the gizmo's: pick the part in the outliner or the view. 'copy' emits the whole export const RIG statement.${RIG_NOTE[g] ?? ''}`);
      treeRows(p, sec, RIG[g] as unknown as Tree, RIG_DEFAULTS[g] as unknown as Tree, rigRange(g), rigDirty, '', k => /adj$/i.test(k));
    }, copy: () => rigSource(), changed: () => rigSource({ [g]: RIG[g] } as unknown as Rig) !== rigSource({ [g]: RIG_DEFAULTS[g] } as unknown as Rig), reset: () => { clearAdjs({ [g]: RIG[g] } as unknown as Rig); assignRig({ [g]: RIG[g] } as unknown as Rig, { [g]: RIG_DEFAULTS[g] } as unknown as Rig); } });
  }

  // ---- the door marker + the beats' fixed timings
  add({ id: 'door', title: 'Door marker · timings', open: true, build: (p, sec) => {
    const D = st.door, H = st.doorHand;
    p.toggleBox(sec, 'show the doorway', () => D.show, v => { D.show = v; }, 'a 0.9 m leaf + jambs ahead of the root (traced boxes: it shadows); a kick\'s impact flings the leaf');
    p.number(sec, 'leaf distance m', () => D.dist, v => { D.dist = v; }, { step: 0.01, min: 0.3, max: 1.5, title: 'root → the closed leaf\'s centre plane (kick contact ≈ 0.75 ahead, the keyway 0.45, a pushing palm ≈ 0.48)' });
    p.select(sec, 'hinge side', ['his left', 'his right'], () => D.hinge > 0 ? 1 : 0, v => { D.hinge = v ? 1 : -1; });
    p.number(sec, 'leaf width m', () => D.width, v => { D.width = v; }, { step: 0.05, min: 0.6, max: 1.2 });
    p.toggleBox(sec, 'hand on the leaf (doorPush)', () => H.on, v => { H.on = v; }, 'feed anim.doorPush the way game.ts handsOnDoors does: the palm\'s spot on the leaf face in front of that shoulder at chest height, the face normal back at him');
    p.toggleBox(sec, '… pushing (w 1) / off (w 0)', () => H.w > 0.5, v => { H.w = v ? 1 : 0; }, 'intent: 1 while he pushes, 0 to take the hand off — the layer eases either way and keeps the last spot to ease out from');
    p.select(sec, '… which hand', ['left', 'right'], () => H.hand, v => { H.hand = v as 0 | 1; }, 'game.ts: the free-edge side\'s hand if it is empty, else the left; the layer itself refuses a right hand with the pistol or a torch in it');
    p.text(sec, () => `fixed timings (character.ts consts, not live): KICK_IMPACT ${KICK_IMPACT} s of 1.0 · THROW_RELEASE ${THROW_RELEASE} s of ${THROW_DUR} · WALK_PHASE ${WALK_PHASE} · lockpick keyway [${rt.char.anim.lockpickAt.map(x => x.toFixed(2)).join(', ')}] (model)`);
  } });

  // ---- stage & camera, renderer (the gear menu's; also shown when the Stage node is selected)
  add({ id: 'stage', title: 'Stage & camera', open: true, build: (p, sec) => {
    const cam = rt.cam;
    p.buttons(sec, 'frame', [{ text: 'body', run: () => rt.frame('body'), title: 'F' }, { text: 'back', run: () => rt.frame('back') }, { text: 'head', run: () => rt.frame('head'), title: 'H' }, { text: 'hand', run: () => rt.frame('hand') }, { text: 'feet', run: () => rt.frame('feet') }]);
    p.buttons(sec, '', [{ text: 'profile', run: () => rt.frame('profile') }, { text: '¾', run: () => rt.frame('threeq') }, { text: 'front', run: () => rt.frame('front') }, { text: 'game cam', run: () => rt.frame('top') }, { text: 'over the back', run: () => rt.frame('backTop'), title: 'behind and 50° above: the slung rifle\'s flatness and its top-down silhouette at once' }]);
    p.select(sec, 'track', TRACK, () => st.track, v => { st.track = v; }, 'what the orbit centre follows (middle-drag or Space+drag pans and frees it; "a bone" = the one picked in the outliner)');
    p.number(sec, 'distance m', () => cam.desiredDistance, v => { cam.desiredDistance = v; }, { step: 0.05, min: 0.5, max: 12 });
    p.slider(sec, 'pitch °', -8, 85, 1, () => cam.pitch / DEG, v => { cam.pitch = v * DEG; });
    p.slider(sec, 'yaw °', -180, 180, 1, () => wrapAngle(cam.yaw) / DEG, v => { cam.yaw = v * DEG; });
    p.slider(sec, 'fov °', 15, 70, 1, () => cam.fov / DEG, v => { cam.fov = v * DEG; }, undefined, 40);
    p.toggleBox(sec, 'back wall', () => st.wall, v => { st.wall = v; }, 'off = cut down to a lip (rays still see it: the bounce stays)');
    p.toggleBox(sec, 'floor marks (25 cm)', () => st.marks, v => { st.marks = v; });
    for (const [i, L] of rt.stageLights.entries()) p.number(sec, `${L.name} light`, () => L.enabled ? L.intensity : 0, v => { L.intensity = L.peakIntensity = v; L.enabled = v > 0; }, { step: 1, min: 0, max: i === 0 ? 300 : 120, def: rt.stage.lights[i].intensity });
    p.number(sec, 'sky brightness ×', () => rt.skyScale, v => rt.setSky(v), { step: 0.1, min: 0, max: 30, def: 1, title: 'the stage has no ceiling: rays leaving upward take the (night) sky' });
  } });
  add({ id: 'renderer', title: 'Renderer', open: false, build: (p, sec) => {
    const q = rt.quality; const engine = rt.engine;
    p.text(sec, () => { const t = engine.timer; return `gpu: ${[...t.results.entries()].filter(([n]) => !['composite', 'fxaa'].includes(n)).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(' · ')}`; });
    p.select(sec, 'quality preset', QUALITY_NAMES.map(x => x), () => QUALITY_NAMES.indexOf(q.current), v => q.apply(QUALITY_NAMES[v]));
    p.toggleBox(sec, 'adaptive resolution', () => q.adaptive, v => { q.adaptive = v; });
    p.slider(sec, 'resolution scale', 0.3, 1, 0.05, () => S.renderScale, v => { S.renderScale = v; });
    p.number(sec, 'exposure', () => S.exposure, v => { S.exposure = v; }, { step: 0.05, min: 0.1, max: 10, def: 1.4, title: '[ / ] step it' });
    p.select(sec, 'debug view', DEBUG_VIEWS, () => S.debugView, v => { S.debugView = v; });
    p.number(sec, 'haze density', () => S.hazeDensity, v => { S.hazeDensity = v; }, { step: 0.002, min: 0, max: 0.3, def: 0.006, title: 'makes the rail light / torch beam visible' });
    p.number(sec, 'bloom', () => engine.passes.bloom, v => { engine.passes.bloom = v; }, { step: 0.005, min: 0, max: 0.5 });
    p.number(sec, 'emissive scale', () => S.emissiveScale, v => { S.emissiveScale = v; }, { step: 0.05, min: 0, max: 6, title: 'global multiplier on emissive surfaces (for the lit lenses that is purely their on-screen glow)' });
    p.toggleBox(sec, 'fxaa (only with ?notaau)', () => engine.passes.fxaaEnabled, v => engine.passes.setFxaa(v));
  } });

  return { get: id => G.get(id) ?? null, ids: [...G.keys()] };
}
const CAN_KEYS = ['canisterDensity', 'canisterDuration', 'canisterRadius', 'canisterTemp', 'canisterSpeed'];
const SOLVER_KEYS = ['buoyancy', 'vortConf', 'turbulence', 'densDecay', 'tempDecay', 'velDamp'];
function pick(o: object, keys: string[]): Tree { const r: Tree = {}; for (const k of keys) r[k] = (o as Tree)[k]; return r; }

// ---------------------------------------------------------------- selection groups (built per selection by ui.ts)
/** the selected rig node: its free adjustment (what the gizmo drags — two views of one value) and the structured RIG numbers behind it */
export function nodeGroup(ctx: SheetCtx, path: string): GroupDef {
  const { rt } = ctx; const gizmo = rt.gizmo;
  return { id: 'node', title: `Selected: ${path}`, open: true, build: (p, sec) => {
    const n = gizmo.node();
    if (!n || n.path !== path) { p.text(sec, () => `${path} is not drawn right now (kit / slot / NV decide which props exist) — its rows come back when it is`); p.buttons(sec, '', [{ text: 'deselect (Esc)', run: () => ctx.select(null) }]); return; }
    const A = () => n.getAdj(); const d = shippedAdj(path);   // (through the getter on EVERY access: a RIG group's 'reset to shipped' swaps in new Adj objects without rebuilding this sheet — a captured adj went stale and the rows edited an orphan; review 08-10 #27)
    p.text(sec, () => `${n.label} — offset (m) / rotation (°) in its parent frame: exactly what the handles drag (arrows move, rings rotate)`);
    p.numbers(sec, 'off  x · y · z', 3, i => A().off[i], (i, v) => { A().off[i] = v; gizmo.onChange(); }, { step: 0.001, defs: [...d.off], names: ['x (side)', 'y (up)', 'z (along)'] });
    p.numbers(sec, 'rot  x · y · z', 3, i => A().rot[i], (i, v) => { A().rot[i] = v; gizmo.onChange(); }, { step: 0.5, defs: [...d.rot], names: ['pitch (about x)', 'yaw (about y)', 'roll (about z)'] });
    p.slider(sec, 'handle opacity', 0.1, 1, 0.05, () => gizmo.opacity, v => { gizmo.opacity = v; });
    p.buttons(sec, '', [{ text: 'parent (U)', run: () => gizmo.selectParent() }, { text: 'zero this node', run: () => { A().off.fill(0); A().rot.fill(0); gizmo.onChange(); } }, { text: 'deselect (Esc)', run: () => ctx.select(null) }]);
    const ro = rigObjectFor(path);
    if (ro) { p.text(sec, () => `RIG.${ro.base} — the structured numbers behind this node`); treeRows(p, sec, ro.obj, ro.snap, rigRange(ro.group), () => {}, ro.base, k => /adj$/i.test(k) || (ro.skip?.(k) ?? false)); }
    else if (path.startsWith('emitters')) p.text(sec, () => 'the arrows write fxm.shot.jetOff / portOff / wispOff directly (Effects group: the same three vectors as fields)');
  } };
}
export function lightGroup(ctx: SheetCtx, name: string): GroupDef | null {
  const { rt } = ctx; const all = [...rt.stageLights, rt.railLight, rt.torchLight]; const L = all.find(l => l.name === name); if (!L) return null;
  const stageI = rt.stageLights.indexOf(L);
  return { id: 'light', title: `Light: ${name}`, open: true, build: (p, sec) => {
    p.text(sec, () => `${L.kind === 1 ? 'spot' : 'point'} · ${L.enabled ? 'on' : 'off'} · pos [${L.pos.map(x => x.toFixed(2)).join(', ')}] · radius ${L.radius} m · range ${L.range} m${stageI < 0 ? ' · posed off the hand every frame (RIG light offsets)' : ''}`);
    p.number(sec, 'intensity', () => L.peakIntensity, v => { L.intensity = L.peakIntensity = v; if (stageI >= 0) L.enabled = v > 0; }, { step: 1, min: 0, max: 400, def: stageI >= 0 ? rt.stage.lights[stageI].intensity : name === 'pistol_light' ? 60 : 70 });
    if (stageI >= 0) p.toggleBox(sec, 'enabled', () => L.enabled, v => { L.enabled = v; }); else p.toggleBox(sec, 'lit (L)', () => rt.st.lightOn, v => { rt.st.lightOn = v; });
    p.number(sec, 'emitter radius m', () => L.radius, v => { L.radius = v; }, { step: 0.005, min: 0, max: 0.6, title: 'sized emitter: penumbra width' });
    if (L.kind === 1) { p.number(sec, 'inner °', () => L.innerDeg, v => { L.innerDeg = v; }, { step: 1, min: 1, max: 80 }); p.number(sec, 'outer °', () => L.outerDeg, v => { L.outerDeg = v; }, { step: 1, min: 2, max: 90 }); }
  } };
}
export function boneGroup(ctx: SheetCtx, bone: string): GroupDef {
  const { rt } = ctx;
  return { id: 'bone', title: `Bone: ${bone}`, open: true, build: (p, sec) => {
    p.text(sec, () => { const b = rt.char.bones[bone]; return b ? `world [${b.map(x => x.toFixed(3)).join(', ')}] · height ${b[1].toFixed(3)} m · ${Math.hypot(b[0] - rt.char.pos[0], b[2] - rt.char.pos[2]).toFixed(3)} m off the root` : '(not read this frame)'; });
    p.buttons(sec, '', [{ text: 'orbit about it', run: () => { rt.st.trackBone = bone; rt.st.track = 5; } }, { text: 'close up', run: () => { rt.st.trackBone = bone; rt.st.track = 5; rt.cam.desiredDistance = 0.9; } }, { text: 'deselect', run: () => ctx.select(null) }]);
    p.text(sec, () => 'read-only: bones are the animator\'s output (Character.bones, after char.update) — the layers that pose them have their constants in the groups below');
  } };
}
export function itemGroup(ctx: SheetCtx, index: number): GroupDef {
  const { rt } = ctx;
  return { id: 'item', title: `Item #${index}`, open: true, build: (p, sec) => {
    p.text(sec, () => { const it = rt.stageItems.items[index]; return it ? `${it.kind} · pos [${it.pos.map(x => x.toFixed(2)).join(', ')}] · ${it.settled ? 'settled' : `moving ${Math.hypot(...it.vel).toFixed(2)} m/s`} · age ${it.age.toFixed(1)} s · bounces ${it.bounces}` : '(gone)'; });
    p.buttons(sec, '', [{ text: 'remove', run: () => { rt.stageItems.items.splice(index, 1); ctx.select(null); } }, { text: 'clear all', run: () => { rt.stageItems.items.length = 0; ctx.select(null); } }]);
  } };
}
/** 'copy all changed' (gear menu): every table with something off its shipped value, each in its own paste format, RIG and the gait block once each */
export function allChangedSource(groups: { get(id: string): GroupDef | null }): string {
  const parts: string[] = [];
  if (rigChanged()) parts.push(rigSource());
  if (gaitChanged()) parts.push(gaitSource());
  for (const id of ['gait.softknee', 'long', 'wallPose', 'holdConsts', 'effects', 'effects.smoke', 'canisters']) { const g = groups.get(id); if (g?.changed?.() && g.copy) parts.push(g.copy()); }
  return parts.join('\n\n');
}
