// BOOTS PRESS THE SNOW (weatherKinds.ts SNOW_LOOK.tracks; the maintainer, 10-14: 'ideally it looks natural, deforms with character movement').
// On a snow level whose lying snow is drawn as one surface (render/snowField.ts), every foot that comes down on snow leaves its print, and a man who falls leaves
// the hollow he lies in. ONE more texture over the world's plan — TRACK_RES texels a metre, one byte each: how far the snow is pressed, 0‥255 — kept here on the
// CPU and handed to the g-buffer a dirty rectangle at a time; shaders/snow.wgsl reads it where it shades lying snow (a dent in the surface's height: the lamps
// model its rim, its floor is a shade bluer).
// PICTURE ONLY. Nothing in the simulation reads a print: no guard follows a trail (that is a call of the maintainer's, not built), no step is slower or louder.
// It reads the characters' cached bones and writes its own bytes; it rolls no die and keeps no clock. A print stays until the level is restarted
// (Game.resetLevelState); a checkpoint does not carry them. Built and fed only with the switch on, on a snow level, beside the field.
// A PRINT IS UNTIDY (SNOWTRACKS.mess; the maintainer, 10-14, over a photograph of a trail in fresh snow under a low sun: 'footprints can also be a bit messier'):
// its lip is broken into lumps, clods lie thrown out ahead of the toe and to the outer side, the boot scuffs a shallow groove in on its heel and out on its toe,
// its floor holds crumbs, and no two prints are alike. All of it off a hash of the print's own place and number — never the game's die: the same walk presses
// the same bytes. mess 0 = the clean sole, byte for byte. The number rides to the shader in the map itself (`messAt`): snow.wgsl roughens what it reads by it.
// A MARK FORMS (weatherKinds.ts SNOW_LOOK.marks; the maintainer, 10-15: "right now it does look like a decal just getting splatted on. maybe it could be animated
// a bit? or some GPU particles to help sell it?" … "same goes for anything affecting the snow" … "and should be dependent on force, etc."). Every mark — a
// print, a hollow, a crater, the furrow under a pushed thing (snowMarks.ts) — is pressed into a blank sheet first (`stampMark`) and reaches the map over a
// moment: the floor SINKS (its bank widening with it), the lumps it threw LAND a little after, and a puff of loose snow is kicked up for the particles
// (`kicks`: snowFx.ts files them as flakes). How fast it sinks, how late the lumps land and how much snow goes up are the FORCE's: a sprint over a walk, a
// fallen man over a boot, a drum over a chair. With the switch off a mark is whole in the frame it is made, byte for byte as it was. Once formed, a mark's
// bytes are the bytes it had before there was any forming: the same walk still presses the same map.
import { SideMap, rollbackVar } from '../math/side';
import type { Game } from './game';
import type { Character } from './character';
import { WORLD } from '../scene/world';
import { snowFieldAt, type SnowField } from '../render/snowField';
import { civiliansShown } from './civilians';
import { SNOW_LOOK } from './weatherKinds';
import { FOG } from './fogofwar';

export const TRACK_RES = 32;     // texels per metre (a boot is ten texels long)
/** rows of the map past the world's far edge that are not plan: the middle one's first texel carries `SNOWTRACKS.mess` to the shader (× 100; the rows either side
 *  are blank, so no sample of the plan, however the sampler wraps, ever blends with it) */
export const TRACK_PAD = 3;
/** The prints' numbers (authored data; `__snow.tracks` on the console — they reach the next print). How DEEP a print is drawn is the look's (snowField.ts SNOW_SURF.trackDeep). */
export const SNOWTRACKS = {
  footLen: 0.16,      // m: half a boot's length
  footWide: 0.062,    // m: half its width at the ball of the foot …
  heel: 0.72,         // … and the heel's share of that (a print is a sole, not a pill)
  ankle: 0.22,        // m: a foot whose ankle is under this (over where he stands) is down …
  still: 0.12,        // m/s: … if it is not travelling faster than this, or than `stillK` of his own pace if that is more (the foot in the air swings at twice the
  stillK: 0.6,        //   man's pace, the one he stands on does not move: an absolute speed alone called a slow crouch's swinging foot down, and its trail was a smear)
  apart: 0.11,        // m: one foot's next print is at least this far from its last (a man standing does not stamp every frame)
  body: 0.19,         // m: the radius of the hollow a fallen man's trunk presses
  skirt: 0.11,        // m: the band about a print's outline over which the byte runs 255 → 0; snow.wgsl reads its inner half as the print's wall and its outer half as the
                      // rim of snow the boot pushed up (the maintainer's reference, 10-14: Red Dead Redemption 2 — a trench has a bank either side)
  bodyLow: 0.38,      // m: his hips under this over where he stands = he is down …
  rest: 0.5,          // s: … and the hollow is pressed once he has lain that long with his hips moving slower than `restV` (where he comes to rest, not where he fell through)
  restV: 0.25,        // m/s
  // ---- how untidy a print is. Every number below is scaled by `mess`; at 0 none of them is read and a print is the clean sole above, byte for byte.
  mess: 1,            // 0‥1: all of it at once (it reaches the next print, and the shader's share of it on the next frame)
  yaw: 0.2,           // rad: a print lies turned up to this far off the boot's own line, either way
  size: 0.12,         // … and is up to this share longer or shorter, wider or narrower
  shallow: 0.26,      // the shallowest print's floor stops this far short of full depth (in the byte: 1 → 1 − shallow; the shader's wall runs 0.5 → 0.95)
  crumble: 0.018,     // m: the outline wanders in and out by up to this — the lip breaks off in lumps …
  lump: 0.06,         // m: … about this long
  reach: 0.75,        // the bank's width is broken along its length: from (1 − reach) to (1 + reach) of the clean one's
  kick: 0.9,          // … and reaches up to this much further ahead of the toe and on the outer side, where the boot throws the snow (a print's own share of it)
  crumbs: 0.3,        // the floor: crumbs fallen back in stand up to this far short of the print's floor (in the byte, as `shallow`)
  crumb: 0.045,       // m: the size of one
  clods: 10,          // the most clods one print throws out (a print's own share of them; they land ahead of the toe and beside the outer edge)
  clodR: 0.06,        // m: the radius of the largest …
  clodMin: 0.04,      // … and of the smallest (under a texel and a quarter the map cannot hold one wherever it falls)
  clodFar: 0.22,      // m: how far past the toe the furthest lands
  drag: 0.2,          // m: the longest scuff the heel cuts on its way in, back toward where the foot came from …
  toeDrag: 0.5,       // … and the toe's on its way out, of that
  dragDeep: 0.3,      // how deep a scuff is cut at the boot's end, of the way from the outline to the floor (in the byte: 0.5 + dragDeep × 0.45); it runs out to nothing
  // ---- a RUN tears the snow up (the maintainer, 10-15: "sprinting should leave messier trails"). How fast the man is going when the foot lands = `run` 0‥1
  // (0 at runLo and under: a walk's print is the print above, byte for byte; 1 at runHi: a flat sprint, 4.7 m/s; a jog's 3.3 m/s is about two fifths). Every
  // number below is × run × runMess × mess. The player's trail, a defender's who runs, and a teammate's where teampace.ts has him run.
  runMess: 1,         // 0‥1: all of it at once (0 = a sprinter's print is a walker's)
  runLo: 2.4,         // m/s
  runHi: 4.4,         // m/s
  runLen: 0.35,       // the print itself is up to (1 + this) × as long: the boot slides as it lands
  runDrag: 1.8,       // the heel's scuff on its way in is up to (1 + this) × as long: the foot lands travelling and skids …
  runToe: 3,          // … and the toe's on its way out (1 + this) ×: it digs in and tears out backward
  runDeep: 0.8,       // … both cut (1 + this) × as deep (never past the floor)
  runKick: 1,         // the bank ahead of the toe and on the outer side reaches (1 + this) × as much further
  runCrumble: 1,      // the lip breaks (1 + this) × as far in and out
  runClods: 1.2,      // (1 + this) × as many clods about the print …
  runFar: 1.4,        // … landing up to (1 + this) × as far from it
  spray: 12,          // … and this many more thrown out BEHIND it, the way the foot came from, where the push-off flings them …
  sprayFar: 0.85,     // m: … the furthest of them this far back …
  sprayFan: 0.5,      // rad: … in a fan this wide either side of that line
  // ---- A MARK FORMS (SNOW_LOOK.marks). `force` = what made it: a walker's boot about 0.45, a sprinter's 1.2, a fallen man 1.3, a blast 2 (snowMarks.ts has the
  // things'). 0 on `form` = a mark is whole at once.
  form: 0.2,          // s: a mark's floor sinks in over this ÷ (0.5 + force) — a walker's print about a seventh of a second, a sprinter's an eighth, a blast's at once
  throwLag: 0.16,     // s: the lumps it threw land this × (0.6 + 0.4 × force) after it was made (thrown harder, they fly longer) …
  throwPop: 0.07,     // s: … and settle over this
  // ---- … AND KICKS SNOW UP: loose snow thrown off the mark as it is made, for the particles (a few flakes of the falling snow's own kind, born at the mark)
  puff: 14,           // flakes a mark of force 1 throws up (× force^1.5: a walker's boot four, a sprinter's a dozen and a half; 0 = none)
  puffUp: 2.6,        // m/s, the fastest, × (0.5 + 0.5 × force): a flake's own drag has it stopped a hand or two up
  puffLife: 0.9,      // s
  puffMost: 48,       // the most one mark throws
  puffRecs: 3,        // kicks filed a frame, the hardest first (snowFx.ts markKicks: each is a particle record, and a frame has twelve for everything)
  puffWait: 12,       // … and this many may wait for the next frame
  puffKeep: 0.25,     // s: a kick leaves the list after this, filed or not (formSnowTracks): one still not filed by then never is
};

export interface SnowTracks {
  /** one byte a texel, row-major from the world's min corner: how far the snow is pressed there */
  data: Uint8Array; w: number; h: number;
  /** the rectangle changed since the g-buffer last took it: [x0, z0, x1, z1] in texels, inclusive (null = none) */
  dirty: [number, number, number, number] | null;
  /** prints pressed so far (feet) and hollows (bodies) — for the panel and a check */
  prints: number; hollows: number;
  /** … and the craters blasts have blown in it (snowBlast.ts) */
  craters: number;
  /** every piece of `data` changed since the last hand-over, each by itself (`dirty` is the one rect round them all) */
  rects: [number, number, number, number][];
  /** marks made by things that are not men or blasts: a pushed chair's furrow, a grenade's dent (snowMarks.ts) */
  marks: number;
  /** the marks still forming (SNOW_LOOK.marks; `formSnowTracks` brings them on) */
  forming: Forming[];
  /** snow kicked up in the last `puffKeep` s (snowFx.ts files each once, telling the new ones by their number `n`; nobody else reads it). The list is the GAME's:
   *  only time empties it (formSnowTracks), a restart, and the cap (the oldest dropped) — nothing a particle pool does reaches it, so a host with a pool and a
   *  host without keep the same list. What the pool has taken and what waits on it is the host's book (snowFx.ts SnowShown kickSeen / kickQ) */
  kicks: SnowKick[];
  /** kicks queued so far, never wound back by a restart: a kick's own number */
  kicked: number;
  /** THE MARKS OF MEN NOBODY SAW (FOG.tracks): what a man the fog of war hides pressed, kept off the map BY THE HALF-METRE SQUARE it is in until the team sees
   *  that square after having had it out of sight (findUnseen) — then it is there, whole, with no forming and no kicked snow: a trail found, never one seen
   *  growing. The map's order is the look's: the square at its head is the one longest unasked. `kept` = marks held; `found` / `lost` = marks laid on being seen,
   *  and marks dropped because their square or the whole list was full */
  unseen: Map<number, UnseenSquare>; kept: number; found: number; lost: number;
}
/** a mark kept off the map: which press it is (0 a body's hollow, 1 a boot's messy print, 2 a boot's plain print), that press's own numbers, and `dark` = the
 *  team has had its square out of sight since it was made. Only a dark mark is laid: one made on snow the team is looking at (its man behind smoke, or low
 *  behind a crate) waits for them to look away, or each step would show as he takes it */
interface Unseen { k: 0 | 1 | 2; a: number[]; dark: boolean }
/** a half-metre square's kept marks, oldest first, and the ONE point they are all asked for, so they are seen or not together: where the first of them was
 *  made (a place a boot stood — the square's middle can be inside a wall) */
interface UnseenSquare { x: number; z: number; marks: Unseen[] }
/** the most marks kept in one square (the oldest goes: a path walked over and over is its last few crossings) and in all (the square next in the look gives up
 *  its oldest) · how many squares cost a sight line a tick (3 µs each with five eyes, measured headless 10-24) · about how many marks are laid a tick — a messy
 *  print is a tenth of a millisecond to press, and a slow page runs four ticks a frame, so a long trail found at once comes in over a few frames (300 prints in
 *  a third of a second), in about the order it was walked */
const UNSEEN_SQUARE = 6, UNSEEN_MOST = 6000, UNSEEN_ASKS = 64, UNSEEN_LAYS = 16;
/** a spot's half-metre square (the fog's own cell, fogofwar.ts cellSeenAt) */
const squareOf = (x: number, z: number) => (Math.floor(x * 2) + 4096) * 16384 + Math.floor(z * 2) + 4096;
/** what a stamp is pressed into: the map itself, or a blank sheet of its size (`stampMark`) */
export type Stamp = Pick<SnowTracks, 'data' | 'w' | 'h' | 'dirty'>;
/** a mark on its way into the map: `goal` = its bytes over the rectangle; `thrown` = it is the lumps a mark threw (they land `delay` s after, and settle over
 *  `sink`), else the mark's own floor and bank (the floor sinks over `sink`) */
interface Forming { x0: number; z0: number; w: number; h: number; goal: Uint8Array; age: number; delay: number; sink: number; thrown: boolean }
/** loose snow thrown up at (x, z): along the unit (dx, dz) if it has one (0, 0 = straight up), by a mark of `force`, over a disc `wide` m across */
/** the most kicks the list holds (the oldest dropped). It was 64 while a pool emptied the list every frame; the list is now every kick of the last `puffKeep` s,
 *  filed or not, so the room is that many frames' worth */
const KICKS_MOST = 256;
export interface SnowKick { x: number; z: number; dx: number; dz: number; force: number; wide: number; serial: number; t: number; n: number }   // (t: s since it was queued — formSnowTracks ages it; n: its number among all this map has queued, SnowTracks.kicked)
/** where the map carries `SNOWTRACKS.mess` (× 100) for the shader: the first texel of the middle row past the plan */
export const messAt = (T: SnowTracks) => (T.h - 2) * T.w;
/** the rows of the map that are plan */
const planH = (T: Stamp) => T.h - TRACK_PAD;
/** the map says what `mess` is now (the shader's share follows the number as the stamps do) */
function tellMess(T: SnowTracks) {
  const b = Math.round(Math.max(0, Math.min(1, +SNOWTRACKS.mess || 0)) * 100), i = messAt(T); if (T.data[i] === b) return;
  T.data[i] = b; dirtied(T, 0, T.h - 2, 0, T.h - 2);
}
/** widen the changed rectangle */
function dirtied(T: Stamp, x0: number, z0: number, x1: number, z1: number) {
  const L = (T as SnowTracks).rects; if (L) L.push([x0, z0, x1, z1]);   // (the map's own: each piece by itself, for a hand-over that is not one rect round marks a street apart)
  const D = T.dirty;
  if (!D) T.dirty = [x0, z0, x1, z1]; else { if (x0 < D[0]) D[0] = x0; if (z0 < D[1]) D[1] = z0; if (x1 > D[2]) D[2] = x1; if (z1 > D[3]) D[3] = z1; }
}
interface Feet { l: [number, number] | null; r: [number, number] | null; pl: [number, number] | null; pr: [number, number] | null; body: [number, number] | null; hips: [number, number] | null; lain: number; }
let feetOf = new SideMap<Character, Feet>();   // (made afresh by clearSnowTracks, so it takes no name: the snapshot holds the variable)
rollbackVar('snowTracks.feetOf', () => feetOf, v => { feetOf = v; });

export function makeSnowTracks(): SnowTracks {
  const w = Math.round(WORLD.gridW * WORLD.gridCell * TRACK_RES), h = Math.round(WORLD.gridH * WORLD.gridCell * TRACK_RES) + TRACK_PAD;
  const T: SnowTracks = { data: new Uint8Array(w * h), w, h, dirty: null, prints: 0, hollows: 0, craters: 0, marks: 0, forming: [], kicks: [], kicked: 0, rects: [], unseen: new Map(), kept: 0, found: 0, lost: 0 };
  tellMess(T); T.dirty = null; T.rects.length = 0;   // (a new map is handed over whole)
  return T;
}
/** a restart: the snow is unmarked again */
export function clearSnowTracks(T: SnowTracks) { feetOf = new SideMap(); T.data.fill(0); tellMess(T); T.dirty = [0, 0, T.w - 1, T.h - 1]; T.rects.length = 0; T.rects.push([0, 0, T.w - 1, T.h - 1]); T.prints = 0; T.hollows = 0; T.craters = 0; T.marks = 0; T.forming.length = 0; T.kicks.length = 0; T.unseen.clear(); T.kept = 0; T.found = 0; T.lost = 0; }

// ---- A MARK FORMS: the two blank sheets a mark is pressed into (one for the mark, one for what it threw), kept zero between stamps
let sheets: [Stamp, Stamp] | null = null;
function sheetsOf(T: SnowTracks): [Stamp, Stamp] {
  if (!sheets || sheets[0].w !== T.w || sheets[0].h !== T.h) sheets = [{ data: new Uint8Array(T.w * T.h), w: T.w, h: T.h, dirty: null }, { data: new Uint8Array(T.w * T.h), w: T.w, h: T.h, dirty: null }];
  return sheets;
}
/** how hard a thing presses, as the forming and the kick read it (0.1‥3) */
const forceOf = (f: number) => Math.max(0.1, Math.min(3, +f || 0));
/** PRESS A MARK: `fn` presses it into blank sheets — the mark itself into `body`, the lumps it threw into `thrown` — and what it pressed goes into the map: at
 *  once with SNOW_LOOK.marks off (or SNOWTRACKS.form 0), else over a moment set by `force` (formSnowTracks). `kick` = loose snow goes up from there (marks on only); `quick` × the
 *  time its floor takes (a furrow ploughed by a thing still moving is cut as it goes). */
export function stampMark(T: SnowTracks, force: number, fn: (body: Stamp, thrown: Stamp) => void, kick?: { x: number; z: number; dx?: number; dz?: number; wide?: number } | null, quick = 1) {
  const S = sheetsOf(T), K = SNOWTRACKS, f = forceOf(force); fn(S[0], S[1]);
  const form = SNOW_LOOK.marks ? Math.max(0, +K.form || 0) : 0;
  for (let k = 0; k < 2; k++) {
    const D = S[k].dirty; if (!D) continue; S[k].dirty = null;
    const sd = S[k].data, x0 = D[0], z0 = D[1], w = D[2] - x0 + 1, h = D[3] - z0 + 1;
    if (!(form > 0)) {
      for (let z = 0; z < h; z++) { let i = (z0 + z) * T.w + x0; for (let x = 0; x < w; x++, i++) { const b = sd[i]; if (b) { if (b > T.data[i]) T.data[i] = b; sd[i] = 0; } } }
      dirtied(T, D[0], D[1], D[2], D[3]);
    } else {
      const goal = new Uint8Array(w * h); let any = false;
      for (let z = 0; z < h; z++) { const i = (z0 + z) * T.w + x0; for (let x = 0; x < w; x++) { const b = sd[i + x]; if (b) { goal[z * w + x] = b; sd[i + x] = 0; any = true; } } }
      if (any) T.forming.push({ x0, z0, w, h, goal, age: 0, thrown: k === 1, delay: k === 1 ? Math.max(0, +K.throwLag || 0) * (0.6 + 0.4 * f) : 0, sink: k === 1 ? Math.max(1e-3, +K.throwPop || 0) : Math.max(1e-3, form * quick / (0.5 + f)) });
    }
  }
  if (kick && SNOW_LOOK.marks && K.puff > 0) {
    T.kicks.push({ x: kick.x, z: kick.z, dx: kick.dx ?? 0, dz: kick.dz ?? 0, force: f, wide: kick.wide ?? 0.12, serial: T.prints + T.hollows + T.craters + T.marks, t: 0, n: ++T.kicked });
    if (T.kicks.length > KICKS_MOST) T.kicks.splice(0, T.kicks.length - KICKS_MOST);
  }
}
/** Once a frame (game.ts stepSnowTracks, AFTER the frame's own marks were pressed — a mark starts forming the frame it is made): the marks still forming come on by `dt`. A mark's own floor sinks from the level of the snow (the
 *  byte's middle, where the shader reads no height) to its depth, easing out, and its bank widens with it; what it threw is not there until it lands, then
 *  swells to its size. Never lowers a byte: what is already pressed stays. Formed, a mark's bytes are its goal's, exactly. */
export function formSnowTracks(T: SnowTracks, dt: number) {
  // (a kick nobody filed — the flakes are off, the view is elsewhere, the frame had no births for it — goes stale: it is never thrown up late at an old place)
  if (T.kicks.length) { let n = 0; for (const k of T.kicks) { k.t += Math.max(0, dt); if (k.t <= SNOWTRACKS.puffKeep) T.kicks[n++] = k; } T.kicks.length = n; }
  if (!T.forming.length) return;
  const all = !SNOW_LOOK.marks; let n = 0;
  for (const m of T.forming) {
    m.age += Math.max(0, dt);
    const u = all ? 1 : Math.max(0, Math.min(1, (m.age - m.delay) / m.sink)); if (u <= 0) { T.forming[n++] = m; continue; }
    const k = m.thrown ? u * u * (3 - 2 * u) : 1 - (1 - u) * (1 - u);
    for (let z = 0; z < m.h; z++) {
      let i = (m.z0 + z) * T.w + m.x0, j = z * m.w;
      for (let x = 0; x < m.w; x++, i++, j++) {
        const b = m.goal[j]; if (!b) continue;
        const v = u >= 1 ? b : m.thrown ? Math.round(b * k) : b > 128 ? Math.round(128 + (b - 128) * k) : Math.max(0, Math.round(128 - (128 - b) / Math.max(k, 0.05)));   // (the bank: the whole of its profile from the first, in a band that widens to its reach)
        if (v > T.data[i]) T.data[i] = v;
      }
    }
    dirtied(T, m.x0, m.z0, m.x0 + m.w - 1, m.z0 + m.h - 1);
    if (u < 1) T.forming[n++] = m;
  }
  T.forming.length = n;
}
/** every mark still forming, formed now (a check's, and a restart's that keeps the map) */
export function settleSnowTracks(T: SnowTracks) { for (const m of T.forming) { m.age = m.delay + m.sink; } formSnowTracks(T, 0); }

/** press a capsule from (ax, az) to (bx, bz), `r` m about its spine (`r0` at its first end, if another), into the bytes (never lifts what is already pressed): 255 inside, 128 on its outline, 0 half a skirt out */
function press(T: Stamp, ax: number, az: number, bx: number, bz: number, r: number, r0 = r) {
  const ox = WORLD.min[0], oz = WORLD.min[2]; const pad = Math.max(r, r0) + SNOWTRACKS.skirt * 0.5 + 1 / TRACK_RES;
  const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - ox) * TRACK_RES)), x1 = Math.min(T.w - 1, Math.ceil((Math.max(ax, bx) + pad - ox) * TRACK_RES));
  const z0 = Math.max(0, Math.floor((Math.min(az, bz) - pad - oz) * TRACK_RES)), z1 = Math.min(planH(T) - 1, Math.ceil((Math.max(az, bz) + pad - oz) * TRACK_RES));
  if (x1 < x0 || z1 < z0) return;
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  for (let tz = z0; tz <= z1; tz++) {
    const pz = oz + (tz + 0.5) / TRACK_RES - az;
    for (let tx = x0; tx <= x1; tx++) {
      const px = ox + (tx + 0.5) / TRACK_RES - ax;
      const t = l2 > 1e-8 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
      const d = Math.hypot(px - dx * t, pz - dz * t) - (r0 + (r - r0) * t);
      const v = Math.max(0, Math.min(1, 0.5 - d / SNOWTRACKS.skirt));
      const i = tz * T.w + tx, b = Math.round(v * 255);
      if (b > T.data[i]) T.data[i] = b;
    }
  }
  dirtied(T, x0, z0, x1, z1);
}

/** three whole numbers → 0‥1. The prints' own hash, NOT the game's die: a print's look comes off its place and its number, and nothing else ever reads it */
export function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** smooth value noise over the plan, 0‥1, one lattice cell every `cell` m (anchored to the world: two prints that overlap break along the same lumps) */
function planNoise(x: number, z: number, cell: number, salt: number): number {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz); let u = fx - ix, v = fz - iz; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash3(ix, iz, salt), b = hash3(ix + 1, iz, salt), c = hash3(ix, iz + 1, salt), d = hash3(ix + 1, iz + 1, salt);
  return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v;
}

/** AN UNTIDY PRINT: the sole at (cx, cz) along the unit (ux, uz), its outer side toward the unit (wx, wz), the foot having come from the unit (bx, bz) of it;
 *  `m` = SNOWTRACKS.mess (> 0), `serial` = the print's number, `run` = how much of a run it was set down at (0‥1, already × runMess: 0 = a walk's print, and
 *  none of the run's numbers is read nor one more hash drawn). Never lifts what is already pressed. The print, its bank and its scuffs go into `T`, the
 *  clods it threw into `TC` (stampMark's two sheets). */
function pressMessy(T: Stamp, TC: Stamp, cx: number, cz: number, ux: number, uz: number, wx: number, wz: number, bx: number, bz: number, m: number, serial: number, run = 0) {
  const K = SNOWTRACKS, R = TRACK_RES, ox = WORLD.min[0], oz = WORLD.min[2], H = planH(T);
  const sx = Math.round((cx - ox) * R), sz = Math.round((cz - oz) * R); let k = 0;
  const rnd = () => hash3(sx, sz, serial * 64 + k++);   // this print's own numbers, drawn in a fixed order
  const put = (i: number, v: number) => { const b = Math.round(Math.max(0, Math.min(1, v)) * 255); if (b > T.data[i]) T.data[i] = b; };
  // no two alike: turned a little, its own length and width, its own depth, its own share of thrown snow
  const turn = (rnd() * 2 - 1) * K.yaw * m, ct = Math.cos(turn), st = Math.sin(turn);
  const vx = ux * ct + wx * st, vz = uz * ct + wz * st, nx = wx * ct - ux * st, nz = wz * ct - uz * st;
  const len = K.footLen * (1 + (rnd() * 2 - 1) * K.size * m) * (1 + K.runLen * run * m), wide = K.footWide * (1 + (rnd() * 2 - 1) * K.size * m);
  const sh = rnd(), top = 1 - K.shallow * m * sh * sh, thrown = rnd();
  const half = Math.max(0, len - wide), ax = cx - vx * half, az = cz - vz * half, dx = vx * half * 2, dz = vz * half * 2, l2 = dx * dx + dz * dz, r0 = wide * K.heel;
  /** the texels a capsule from (fx, fz) by (gx, gz), `pad` m about it, can touch: null = none on the plan */
  const box = (fx: number, fz: number, gx: number, gz: number, pad: number): [number, number, number, number] | null => {
    const x0 = Math.max(0, Math.floor((Math.min(fx, fx + gx) - pad - ox) * R)), x1 = Math.min(T.w - 1, Math.ceil((Math.max(fx, fx + gx) + pad - ox) * R));
    const z0 = Math.max(0, Math.floor((Math.min(fz, fz + gz) - pad - oz) * R)), z1 = Math.min(H - 1, Math.ceil((Math.max(fz, fz + gz) + pad - oz) * R));
    return x1 < x0 || z1 < z0 ? null : [x0, z0, x1, z1];
  };
  const rm = run * m, crumble = K.crumble * m * (1 + K.runCrumble * run), kick = K.kick * m * (1 + K.runKick * run);
  const B = box(ax, az, dx, dz, wide + crumble + K.skirt * 0.5 * (1 + K.reach * m) * (1 + kick) + 1 / R);
  if (B) {
    for (let tz = B[1]; tz <= B[3]; tz++) {
      const Z = oz + (tz + 0.5) / R, pz = Z - az;
      for (let tx = B[0]; tx <= B[2]; tx++) {
        const X = ox + (tx + 0.5) / R, px = X - ax;
        const t = l2 > 1e-8 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
        // the lip breaks off in lumps: the outline wanders
        const d = Math.hypot(px - dx * t, pz - dz * t) - (r0 + (wide - r0) * t) + (planNoise(X, Z, K.lump, 11) * 2 - 1) * crumble;
        let v: number;
        if (d > 0) {
          // the bank: broken along its length, and furthest ahead of the toe and on the outer side, where the boot throws the snow
          const fwd = ((X - cx) * vx + (Z - cz) * vz) / len, out = ((X - cx) * nx + (Z - cz) * nz) / wide;
          const q = (1 + (planNoise(X, Z, K.lump * 0.7, 23) * 2 - 1) * K.reach * m) * (1 + kick * thrown * Math.max(0, Math.min(1, 0.6 * fwd + 0.4 * out)));
          v = 0.5 - d / (K.skirt * Math.max(0.25, q));
        } else {
          // the floor: this print's own depth, and crumbs fallen back in
          const crumb = Math.max(0, planNoise(X, Z, K.crumb, 37) * 2 - 1);
          v = Math.min(0.5 - d / K.skirt, Math.max(0.6, top - K.crumbs * m * crumb));
        }
        put(tz * T.w + tx, v);
      }
    }
    dirtied(T, B[0], B[1], B[2], B[3]);
  }
  // the scuffs: the heel cuts a shallow groove on its way in, the toe one on its way out — each narrows and runs out to nothing, bank and all
  const scuff = (fx: number, fz: number, ex: number, ez: number, L: number, r: number) => {
    if (L < 1.5 / R) return;
    const gx = ex * L, gz = ez * L, deep = 0.5 + Math.min(1, K.dragDeep * (1 + K.runDeep * rm)) * 0.45; const S = box(fx, fz, gx, gz, r + K.skirt * 0.25 + 1 / R); if (!S) return;
    for (let tz = S[1]; tz <= S[3]; tz++) for (let tx = S[0]; tx <= S[2]; tx++) {
      const X = ox + (tx + 0.5) / R, Z = oz + (tz + 0.5) / R, px = X - fx, pz = Z - fz;
      const along = (px * gx + pz * gz) / (L * L), t = Math.max(0, Math.min(1, along));
      const d = Math.hypot(px - gx * t, pz - gz * t) - r * (1 - 0.6 * t) + (planNoise(X, Z, K.lump, 53) - 0.5) * K.crumble * m;
      const fade = 1 - Math.max(0, Math.min(1, (along - 0.45) / 0.65));
      put(tz * T.w + tx, (d > 0 ? 0.5 - d / (K.skirt * 0.5) : Math.min(0.5 - d / K.skirt, deep)) * fade);
    }
    dirtied(T, S[0], S[1], S[2], S[3]);
  };
  const heelL = K.drag * m * rnd() * (1 + K.runDrag * run), toeL = K.drag * K.toeDrag * m * rnd() * (1 + K.runToe * run);
  scuff(ax, az, bx, bz, heelL, r0 * 0.55);
  scuff(ax + dx, az + dz, -bx, -bz, toeL, wide * 0.5);
  // the clods: lumps thrown out, lying on the surface — ahead of the toe, leaning outward, and beside the outer edge, about as many of each. Each is one
  // small mound in the bank's half of the byte (a quarter = the bank's full height), never under `clodMin` across: a lump the map cannot hold is not thrown
  const n = Math.floor(K.clods * m * thrown * (1 + K.runClods * run) + rnd()), clodFar = K.clodFar * (1 + K.runFar * run);
  const spray = rm > 0 ? Math.floor(K.spray * rm * (0.5 + 0.5 * rnd()) + rnd()) : 0;   // (a run's own: thrown out behind — drawn only then)
  for (let c = 0; c < n + spray; c++) {
    const beside = rnd() < 0.45, a = rnd() * 1.6 - 0.5, far = rnd(), size = rnd(), high = rnd(), s = (rnd() * 2 - 1) * half;
    const ca = Math.cos(a), sa = Math.sin(a); let qx: number, qz: number;
    if (c >= n) { const fa = (a + 0.5) / 1.6 * 2 - 1, an = fa * K.sprayFan, e = len + K.skirt * 0.6 + K.sprayFar * far * (0.3 + 0.7 * high), tx = -bz, tz = bx; const ca2 = Math.cos(an), sa2 = Math.sin(an); qx = cx + (bx * ca2 + tx * sa2) * e + nx * s * 0.3; qz = cz + (bz * ca2 + tz * sa2) * e + nz * s * 0.3; }
    else if (beside) { const e = wide + K.skirt * 0.6 + clodFar * 0.6 * far; qx = cx + vx * s + (nx * ca + vx * sa * 0.5) * e; qz = cz + vz * s + (nz * ca + vz * sa * 0.5) * e; }
    else { const e = len + K.skirt * 0.6 + clodFar * far; qx = cx + (vx * ca + nx * sa) * e; qz = cz + (vz * ca + nz * sa) * e; }
    const r = K.clodMin + (K.clodR - K.clodMin) * size * size, peak = 0.25 * (0.65 + 0.35 * high);
    const C = box(qx, qz, 0, 0, r); if (!C) continue;
    for (let tz = C[1]; tz <= C[3]; tz++) for (let tx = C[0]; tx <= C[2]; tx++) {
      const ex = ox + (tx + 0.5) / R - qx, ez = oz + (tz + 0.5) / R - qz, e2 = (ex * ex + ez * ez) / (r * r);
      if (e2 < 1) { const i = tz * T.w + tx, by = Math.round(Math.max(0, Math.min(1, peak * (1 - e2))) * 255); if (by > TC.data[i]) TC.data[i] = by; }
    }
    dirtied(TC, C[0], C[1], C[2], C[3]);
  }
}

/** how a crater is shaped (game/snowBlast.ts SNOWBLAST hands its own numbers in: this file knows the bytes, that one the blast) */
export interface CraterLook { lobe: number; rag: number; floor: number; rim: number; rays: number; rayLen: number; rayWide: number; clods: number; clodFar: number; clodR: number }
/** A BLAST'S CRATER at (cx, cz), its pan `r0` m across the middle (snowBlast.ts; the maintainer, 10-15: "grenades/he don't seem to really affect snow"). In the
 *  prints' own byte, read by the shader as a print is: THE PAN — snow blown out down to a churned floor, its edge thrown into lobes and broken into lumps, a bank
 *  heaped wider than a boot's round it; THE RAYS — grooves the burst scoured outward, each narrowing and running out to nothing, bank and all; THE CLODS — lumps
 *  of snow thrown clear, lying on the surface out to several radii, most of them near. All off a hash of the place and the crater's number (never the game's
 *  die): the same blast presses the same bytes. Never lifts what is already pressed. */
export function pressCrater(T: SnowTracks, cx: number, cz: number, r0: number, serial: number, L: CraterLook) {
  stampMark(T, 2, (S, SC) => craterInto(S, SC, cx, cz, r0, serial, L));   // (a blast: its pan is there at once, its clods land after — and it kicks nothing up here: the blast throws its own snow, snowBlast.ts)
  T.craters++;
}
function craterInto(T: Stamp, TC: Stamp, cx: number, cz: number, r0: number, serial: number, L: CraterLook) {
  const K = SNOWTRACKS, R = TRACK_RES, ox = WORLD.min[0], oz = WORLD.min[2], H = planH(T), TAU = Math.PI * 2;
  const sx = Math.round((cx - ox) * R), sz = Math.round((cz - oz) * R); let k = 0;
  const rnd = () => hash3(sx, sz, 0x51ed00 + serial * 1024 + k++);   // this crater's own numbers, drawn in a fixed order
  const put = (i: number, v: number) => { const b = Math.round(Math.max(0, Math.min(1, v)) * 255); if (b > T.data[i]) T.data[i] = b; };
  /** the texels within `pad` m of the segment from (fx, fz) by (gx, gz): null = none on the plan */
  const box = (fx: number, fz: number, gx: number, gz: number, pad: number): [number, number, number, number] | null => {
    const x0 = Math.max(0, Math.floor((Math.min(fx, fx + gx) - pad - ox) * R)), x1 = Math.min(T.w - 1, Math.ceil((Math.max(fx, fx + gx) + pad - ox) * R));
    const z0 = Math.max(0, Math.floor((Math.min(fz, fz + gz) - pad - oz) * R)), z1 = Math.min(H - 1, Math.ceil((Math.max(fz, fz + gz) + pad - oz) * R));
    return x1 < x0 || z1 < z0 ? null : [x0, z0, x1, z1];
  };
  // THE PAN: its outline in three lobes of its own, broken along the world's lumps; inside, a floor of churned snow; outside, the heaped bank
  const lobe = Math.max(0, L.lobe), rag = Math.max(0, L.rag), rimK = Math.max(0.25, L.rim), floor = Math.max(0.6, Math.min(1, L.floor));
  const p3 = rnd() * TAU, p5 = rnd() * TAU, p8 = rnd() * TAU;
  const edge = (th: number) => 1 + lobe * (Math.sin(3 * th + p3) + 0.7 * Math.sin(5 * th + p5) + 0.45 * Math.sin(8 * th + p8)) / 2.15;
  const P = box(cx, cz, 0, 0, r0 * (1 + lobe) + rag + K.skirt * 0.5 * rimK * 1.5 + 1 / R);
  if (P) {
    for (let tz = P[1]; tz <= P[3]; tz++) {
      const Z = oz + (tz + 0.5) / R, pz = Z - cz;
      for (let tx = P[0]; tx <= P[2]; tx++) {
        const X = ox + (tx + 0.5) / R, px = X - cx;
        const d = Math.hypot(px, pz) - r0 * edge(Math.atan2(pz, px)) + (planNoise(X, Z, 0.17, 61) * 2 - 1) * rag;
        let v: number;
        if (d > 0) v = 0.5 - d / (K.skirt * rimK * (0.6 + 0.9 * planNoise(X, Z, 0.12, 67)));
        else v = Math.min(0.5 - d / K.skirt, Math.max(0.6, floor - 0.3 * Math.max(0, planNoise(X, Z, 0.07, 71) * 2 - 1) - 0.12 * planNoise(X, Z, 0.3, 73)));
        put(tz * T.w + tx, v);
      }
    }
    dirtied(T, P[0], P[1], P[2], P[3]);
  }
  // THE RAYS: from inside the pan's edge outward, evenly round it and each a little off its place; a few long, most short
  const rays = Math.max(0, Math.round(L.rays));
  for (let i = 0; i < rays; i++) {
    const th = (i + rnd()) / rays * TAU, far = rnd(), wide = rnd(), dig = rnd();
    const ex = Math.cos(th), ez = Math.sin(th), len = r0 * Math.max(0, L.rayLen) * (0.3 + far * far), r = r0 * Math.max(0, L.rayWide) * (0.5 + wide), deep = 0.5 + 0.45 * (0.35 + 0.5 * dig);
    if (len < 2 / R || r < 0.5 / R) continue;
    const fx = cx + ex * r0 * 0.75, fz = cz + ez * r0 * 0.75, gx = ex * len, gz = ez * len;
    const S = box(fx, fz, gx, gz, r + K.skirt * 0.25 + 1 / R); if (!S) continue;
    for (let tz = S[1]; tz <= S[3]; tz++) for (let tx = S[0]; tx <= S[2]; tx++) {
      const X = ox + (tx + 0.5) / R, Z = oz + (tz + 0.5) / R, px = X - fx, pz = Z - fz;
      const along = (px * gx + pz * gz) / (len * len), t = Math.max(0, Math.min(1, along));
      const d = Math.hypot(px - gx * t, pz - gz * t) - r * (1 - 0.8 * t) + (planNoise(X, Z, 0.09, 79) - 0.5) * 0.03;
      const fade = 1 - Math.max(0, Math.min(1, (along - 0.4) / 0.7));
      put(tz * T.w + tx, (d > 0 ? 0.5 - d / (K.skirt * 0.5) : Math.min(0.5 - d / K.skirt, deep)) * fade);
    }
    dirtied(T, S[0], S[1], S[2], S[3]);
  }
  // THE CLODS: thrown clear — one small mound each in the bank's half of the byte (a quarter = the bank's full height), most of them within a radius or two
  const clods = Math.max(0, Math.round(L.clods)), cr = Math.max(K.clodMin, L.clodR);
  for (let c = 0; c < clods; c++) {
    const th = rnd() * TAU, u = rnd(), size = rnd(), high = rnd();
    const e = r0 * (1.1 + Math.max(0, L.clodFar) * u * u), qx = cx + Math.cos(th) * e, qz = cz + Math.sin(th) * e;
    const r = K.clodMin + (cr - K.clodMin) * size * size, peak = 0.25 * (0.65 + 0.35 * high);
    const C = box(qx, qz, 0, 0, r); if (!C) continue;
    for (let tz = C[1]; tz <= C[3]; tz++) for (let tx = C[0]; tx <= C[2]; tx++) {
      const ex = ox + (tx + 0.5) / R - qx, ez = oz + (tz + 0.5) / R - qz, e2 = (ex * ex + ez * ez) / (r * r);
      if (e2 < 1) { const i = tz * T.w + tx, by = Math.round(Math.max(0, Math.min(1, peak * (1 - e2))) * 255); if (by > TC.data[i]) TC.data[i] = by; }
    }
    dirtied(TC, C[0], C[1], C[2], C[3]);
  }
}

/** A THING'S MARK (snowMarks.ts — what a pushed chair's leg, a rolling grenade, a slab of debris leaves): the capsule from (ax, az) to (bx, bz), `r0` m about
 *  its first end and `r` about its last, pressed down to `deep` (0‥1 of a boot's full depth: a light thing rides high), its outline broken into lumps and its
 *  bank's reach broken along its length as a print's are (`m` = how untidy, 0‥1; SNOWTRACKS.crumble / lump / reach). Never lifts what is already pressed. */
export function pressGroove(T: Stamp, ax: number, az: number, bx: number, bz: number, r0: number, r: number, deep: number, m: number) {
  const K = SNOWTRACKS, R = TRACK_RES, ox = WORLD.min[0], oz = WORLD.min[2];
  const crumble = Math.min(K.crumble * m, 0.5 * Math.min(r, r0)), top = 0.6 + 0.4 * Math.max(0, Math.min(1, deep));
  const pad = Math.max(r, r0) + crumble + K.skirt * 0.5 * (1 + K.reach * m) + 1 / R;
  const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - ox) * R)), x1 = Math.min(T.w - 1, Math.ceil((Math.max(ax, bx) + pad - ox) * R));
  const z0 = Math.max(0, Math.floor((Math.min(az, bz) - pad - oz) * R)), z1 = Math.min(planH(T) - 1, Math.ceil((Math.max(az, bz) + pad - oz) * R));
  if (x1 < x0 || z1 < z0) return;
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  for (let tz = z0; tz <= z1; tz++) {
    const Z = oz + (tz + 0.5) / R, pz = Z - az;
    for (let tx = x0; tx <= x1; tx++) {
      const X = ox + (tx + 0.5) / R, px = X - ax;
      const t = l2 > 1e-8 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
      const d = Math.hypot(px - dx * t, pz - dz * t) - (r0 + (r - r0) * t) + (m > 0 ? (planNoise(X, Z, K.lump, 11) * 2 - 1) * crumble : 0);
      let v: number;
      if (d > 0) v = 0.5 - d / (K.skirt * Math.max(0.25, m > 0 ? 1 + (planNoise(X, Z, K.lump * 0.7, 23) * 2 - 1) * K.reach * m : 1));
      else v = Math.min(0.5 - d / Math.min(K.skirt, 0.9 * (r0 + (r - r0) * t)), Math.max(0.6, top - (m > 0 ? K.crumbs * m * Math.max(0, planNoise(X, Z, K.crumb, 37) * 2 - 1) : 0)));   // (its wall no wider than the thing: a chair leg's slot still reaches the floor)
      const i = tz * T.w + tx, by = Math.round(Math.max(0, Math.min(1, v)) * 255);
      if (by > T.data[i]) T.data[i] = by;
    }
  }
  dirtied(T, x0, z0, x1, z1);
}
/** … and the lumps it threw: `n` clods about (cx, cz), from `near` to `far` m out, leaning along the unit (dx, dz) if it has one (0, 0 = all round), each
 *  SNOWTRACKS.clodMin‥clodR across. Off a hash of the place and `serial`, never the game's die. */
export function pressClods(T: Stamp, cx: number, cz: number, n: number, near: number, far: number, dx: number, dz: number, serial: number) {
  const K = SNOWTRACKS, R = TRACK_RES, ox = WORLD.min[0], oz = WORLD.min[2], H = planH(T);
  const sx = Math.round((cx - ox) * R), sz = Math.round((cz - oz) * R); let k = 0;
  const rnd = () => hash3(sx, sz, 0x2c10d5 + serial * 64 + k++);
  const aim = dx * dx + dz * dz > 1e-6 ? Math.atan2(dz, dx) : NaN;
  for (let c = 0; c < n; c++) {
    const th = aim === aim ? aim + (rnd() * 2 - 1) * 1.1 : rnd() * Math.PI * 2, u = rnd(), size = rnd(), high = rnd();
    const e = near + (far - near) * u * u, qx = cx + Math.cos(th) * e, qz = cz + Math.sin(th) * e;
    const r = K.clodMin + (K.clodR - K.clodMin) * size * size, peak = 0.25 * (0.65 + 0.35 * high);
    const x0 = Math.max(0, Math.floor((qx - r - ox) * R)), x1 = Math.min(T.w - 1, Math.ceil((qx + r - ox) * R));
    const z0 = Math.max(0, Math.floor((qz - r - oz) * R)), z1 = Math.min(H - 1, Math.ceil((qz + r - oz) * R));
    if (x1 < x0 || z1 < z0) continue;
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      const ex = ox + (tx + 0.5) / R - qx, ez = oz + (tz + 0.5) / R - qz, e2 = (ex * ex + ez * ez) / (r * r);
      if (e2 < 1) { const i = tz * T.w + tx, by = Math.round(Math.max(0, Math.min(1, peak * (1 - e2))) * 255); if (by > T.data[i]) T.data[i] = by; }
    }
    dirtied(T, x0, z0, x1, z1);
  }
}

/** Once a frame (game.ts, after everybody has moved and been posed): this frame's footfalls and falls, pressed into the snow they came down on. */
export function updateSnowTracks(g: Game, T: SnowTracks, field: SnowField, dt: number) {
  if (!(dt > 0)) return;
  tellMess(T);
  // (a man the fog of war hides puts nothing on the map while he is hidden: nothing live shows in the fog, and a trail growing across unseen ground is him.
  //  FOG.tracks: what he presses is kept off the map, and is there when the team next sees that snow; off = he presses nothing at all, as it was — and
  //  what was kept when the row went off is dropped; the fog itself down with marks kept: they are laid, the map is the world's then)
  const fog = g.fogOfWar, keep = FOG.tracks && fog.active === true;
  pressOf(g.player.char, T, field, dt, null);
  for (const gd of g.guards) { const hid = fog.hidden(gd); if (!hid || keep) pressOf(gd.char, T, field, dt, hid ? fog : null); }
  for (const cv of civiliansShown(g)) { const hid = fog.hidden(cv); if (!hid || keep) pressOf(cv.char, T, field, dt, hid ? fog : null); }
  if (T.kept) { if (FOG.tracks) findUnseen(g, T, keep); else { T.unseen.clear(); T.kept = 0; } }
}
/** THE LOOK FOR KEPT MARKS, once a tick, from the head of the map, each square asked going to its tail, until `UNSEEN_ASKS` sight lines are walked or about
 *  `UNSEEN_LAYS` marks laid. A square in no eye's field is out of sight for little; one in a field costs a sight line: out of sight, its marks go `dark`; seen,
 *  its dark marks are laid. `fogUp` false = the fog is down with marks still kept: the map is the world's then, and they are laid as they come. */
function findUnseen(g: Game, T: SnowTracks, fogUp: boolean) {
  const U = T.unseen, fog = g.fogOfWar; let left = Math.min(U.size, UNSEEN_ASKS * 4), asks = UNSEEN_ASKS, lays = UNSEEN_LAYS;
  for (const [sq, S] of U) {
    if (left-- <= 0 || asks <= 0 || lays <= 0) break;   // (`left`: once round at most — a square put back at the tail is met again by this walk — and no more than four squares a sight line: one in no field costs little, not nothing)
    U.delete(sq);
    const look = fogUp ? fog.groundLook(S.x, S.z) : 2; if (fogUp && look) asks--;
    const list = S.marks; let w = 0;
    for (const u of list) { if (look === 2 && (u.dark || !fogUp)) { lay(T, u.k, u.a, false); T.found++; T.kept--; lays--; } else { if (look !== 2) u.dark = true; list[w++] = u; } }
    list.length = w; if (w) U.set(sq, S);
  }
}
/** a man's mark: on the map now, or — his own, the fog hiding him (`fog`) — kept off it, in its square */
function mark(T: SnowTracks, fog: Game['fogOfWar'] | null, k: 0 | 1 | 2, a: number[]) {
  if (!fog) { lay(T, k, a, true); return; }
  const U = T.unseen, sq = squareOf(a[0], a[1]); let S = U.get(sq); if (!S) U.set(sq, S = { x: a[0], z: a[1], marks: [] });
  S.marks.push({ k, a, dark: fog.groundLook(S.x, S.z) !== 2 }); T.kept++;
  if (S.marks.length > UNSEEN_SQUARE) { S.marks.shift(); T.kept--; T.lost++; }
  while (T.kept > UNSEEN_MOST) { const [first, old] = U.entries().next().value!; old.marks.shift(); T.kept--; T.lost++; if (!old.marks.length) U.delete(first); }
}
/** press one of a man's three marks into the map. `live` = it is being made in sight: it forms over its moment and kicks snow up; else it is found as it lies —
 *  formed whole this frame, nothing kicked */
function lay(T: SnowTracks, k: 0 | 1 | 2, a: number[], live: boolean) {
  const K = SNOWTRACKS, n0 = T.forming.length;
  if (k === 0) stampMark(T, 1.3, (S) => {   // a body's hollow: [mid x, mid z, hips x z, head x z, has a left foot, its x z, has a right foot, its x z]
    press(S, a[2], a[3], a[4], a[5], K.body);
    if (a[6]) press(S, a[2], a[3], a[7], a[8], K.body * 0.55);
    if (a[9]) press(S, a[2], a[3], a[10], a[11], K.body * 0.55);
  }, live ? { x: a[0], z: a[1], wide: 0.6 } : null);
  else if (k === 1) stampMark(T, a[11], (S, SC) => pressMessy(S, SC, a[0], a[1], a[2], a[3], a[3] * a[4], -a[2] * a[4], a[5], a[6], a[7], a[8], a[9]), live ? { x: a[0] + a[2] * a[10] * 0.6, z: a[1] + a[3] * a[10] * 0.6, dx: a[2], dz: a[3], wide: 0.1 } : null);   // a messy print: [x, z, toe x z, side, from x z, mess, serial, run, boot length, force]
  else stampMark(T, 0.45, (S) => press(S, a[0] - a[2] * a[4], a[1] - a[3] * a[4], a[0] + a[2] * a[4], a[1] + a[3] * a[4], a[5], a[6]), live ? { x: a[0], z: a[1], dx: a[2], dz: a[3], wide: 0.1 } : null);   // a plain print: [x, z, toe x z, half length, width, heel]
  if (!live) for (let i = n0; i < T.forming.length; i++) { const m = T.forming[i]; m.age = m.delay + m.sink; }   // (found: this frame's forming lays it whole)
}
function pressOf(c: Character, T: SnowTracks, field: SnowField, dt: number, hid: Game['fogOfWar'] | null) {
  const K = SNOWTRACKS;
  {
    const b = c.bones; if (!b) return;
    let st = feetOf.get(c); if (!st) { st = { l: null, r: null, pl: null, pr: null, body: null, hips: null, lain: 0 }; feetOf.set(c, st); }
    const hips = b.hips, low = !!hips && hips[1] - c.pos[1] < K.bodyLow;
    if (!c.alive || low) {
      // down: the hollow his trunk and legs lie in, once, where he comes to rest (again if he is moved a pace and rests again)
      if (!hips || !low) return;
      const was = st.hips; st.hips = [hips[0], hips[2]];
      st.lain = was && Math.hypot(hips[0] - was[0], hips[2] - was[1]) <= K.restV * dt ? st.lain + dt : 0;
      if (st.lain < K.rest) return;
      if (st.body && Math.hypot(hips[0] - st.body[0], hips[2] - st.body[1]) < 0.3) return;
      const head = b.head ?? b.chest ?? hips, mx = (hips[0] + head[0]) * 0.5, mz = (hips[2] + head[2]) * 0.5;
      // (a man the fog hides, down on snow the team is LOOKING at — behind smoke, or low behind a crate: his hollow waits. Kept, it would lie unlaid under the body
      //  the fog then shows for as long as they looked. So nothing yet: it is pressed in the open the frame he is shown, or kept once they look away — and
      //  never made if he is up again before either. A sight line a tick for each such man, beside the look's own)
      const snow = snowFieldAt(field, hips[0], hips[2]).cover >= 0.5;
      if (hid && snow) { const S = T.unseen.get(squareOf(mx, mz)); if (hid.groundLook(S ? S.x : mx, S ? S.z : mz) === 2) return; }
      st.body = [hips[0], hips[2]];
      if (!snow) return;
      mark(T, hid, 0, [mx, mz, hips[0], hips[2], head[0], head[2], b.footL ? 1 : 0, b.footL?.[0] ?? 0, b.footL?.[2] ?? 0, b.footR ? 1 : 0, b.footR?.[0] ?? 0, b.footR?.[2] ?? 0]);
      T.hollows++;
      return;
    }
    st.hips = null; st.lain = 0;
    st.body = null;
    const still = Math.max(K.still, K.stillK * Math.hypot(c.vel[0], c.vel[2]));
    for (let side = 0; side < 2; side++) {
      const left = side === 0, f = left ? b.footL : b.footR; if (!f) continue;
      const prev = left ? st.pl : st.pr; const now: [number, number] = [f[0], f[2]];
      if (left) st.pl = now; else st.pr = now;
      if (!prev || f[1] - c.pos[1] > K.ankle || Math.hypot(now[0] - prev[0], now[1] - prev[1]) / dt > still) continue;
      const toe = (left ? b.toeL : b.toeR) ?? f;
      let ux = toe[0] - f[0], uz = toe[2] - f[2]; const ul = Math.hypot(ux, uz);
      if (ul > 0.02) { ux /= ul; uz /= ul; } else { ux = Math.sin(c.bodyYaw); uz = Math.cos(c.bodyYaw); }
      const cx = f[0] + ux * 0.06, cz = f[2] + uz * 0.06;   // (the ankle stands over the heel's end of the boot: its middle is a little forward of it)
      const last = left ? st.l : st.r;
      if (last && Math.hypot(cx - last[0], cz - last[1]) < K.apart) continue;
      if (left) st.l = [cx, cz]; else st.r = [cx, cz];
      if (snowFieldAt(field, cx, cz).cover < 0.5) continue;   // (no snow lies here — under a roof, on swept earth: nothing to press)
      const m = Math.max(0, Math.min(1, +K.mess || 0));
      if (m > 0) {
        // (its outer side: the side of his own middle the foot is on; where it came from: this foot's last print if that is a stride away, else straight behind)
        const side = (f[0] - c.pos[0]) * uz - (f[2] - c.pos[2]) * ux < 0 ? -1 : 1;
        let bx = -ux, bz = -uz;
        if (last) { const lx = last[0] - cx, lz = last[1] - cz, ll = Math.hypot(lx, lz); if (ll > 0.25 && ll < 1.8) { bx = lx / ll; bz = lz / ll; } }
        // (a run: how fast HE is going as the foot lands — a walk's 0, a flat sprint's 1)
        const rk = Math.max(0, Math.min(1, +K.runMess || 0)), ru = rk > 0 ? Math.max(0, Math.min(1, (Math.hypot(c.vel[0], c.vel[2]) - K.runLo) / Math.max(0.1, K.runHi - K.runLo))) : 0;
        const run = ru * ru * (3 - 2 * ru) * rk, serial = T.prints, sp = Math.hypot(c.vel[0], c.vel[2]);
        // (how hard the boot lands: a creep under a walk, a walk, a sprint well over it)
        mark(T, hid, 1, [cx, cz, ux, uz, side, bx, bz, m, serial, run, K.footLen, 0.3 + 0.15 * Math.min(1, sp / 1.4) + 0.75 * run]);
      } else {
        const half = Math.max(0, K.footLen - K.footWide);
        mark(T, hid, 2, [cx, cz, ux, uz, half, K.footWide, K.footWide * K.heel]);
      }
      T.prints++;
    }
  }
}
