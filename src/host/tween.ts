// DRAWING BETWEEN TICKS (TWEEN below; the other half of host/loop.ts FIXEDSTEP — engine groundwork for two-player co-op, nothing networked). The fixed step runs the game in
// whole ticks of 1 / hz; a display that is not at that rate draws frames that fall BETWEEN two ticks, and a picture that shows only 'the last tick' moves the men and the
// camera at 60 a second whatever the display draws. With this switch on, a frame drawn `a` of the way from tick N−1 to tick N (a = the time the loop owes the next
// tick ÷ the tick, 0 ≤ a < 1) shows what MOVES at the blend of those two ticks:
//
//   boxes with a motion identity (Box.mkey: door leaves, props, items, debris, what a man carries, devices)   centre, yaw, quaternion and drawn centre (Box.dc)
//   the men            every joint matrix of the palette the g-buffer skins with, and the ends of their shadow proxies (BoxWorld.capsuleData), matched by the man's id
//   lights             position and direction of every light that stood in both ticks (a carried torch, a weapon light, the sun over the hour), matched by the object
//   the camera         under the fixed step the loop steps the camera once a TICK (the input record takes its view from it); a frame draws it between where its last
//                      two ticks left it (`camAt` → FollowCamera.drawIn / drawOut): look-at, yaw, pitch, distance — the follow camera, and a framing a level script pins
//
// and everything else as the last tick left it: boxes with no key (sparks, tracers, laser lines, one-tick effect boxes), colours, intensities, which lights and boxes exist.
// WHAT STILL READS THE TICK: the HUD's marks and bubbles (laid from the game's own positions after the blend is taken down) and the unkeyed boxes above — on a frame
// between two ticks they stand up to the lag ahead of the men they belong to. And ONE reader does see the blend: the GPU's sensor passes (the light meter, smoke sight
// lines) measure the scene the render uploads, which is the posed one — they measure the picture, as they always did; the game's headless stand-ins read the tick.
// THE PRICE: the picture stands behind the game by as much of a tick as the display's rate makes it owe (`phase()` below: nothing on a display at the tick rate, half a
// tick at twice it, most of a tick at 144 Hz, never more than one). THE RULE: the game's own state is never the blend when a tick runs. `pose()` hangs blended arrays on the
// drawn objects for the length of the host's render and `unpose()` hangs the tick's own arrays back by reference (the capsule ends, a flat array, are written back value for
// value); nothing of the game runs between the two, and the men's palette is blended into an array of this file's own that only the GPU is handed.
//
// A thing that moved further than `snap` metres in the one tick was cut, not moved (a teleport, a restart, a key that now names another thing): drawn where it is. A keyed
// box whose half extents or owner changed between the ticks is another box under the same key: drawn where it is.
//
// SPENT FLASHES (`flashes`): on a frame of two ticks or more (a display under the tick rate, a hitch) a light that lived one tick and was born in the frame's first was
// aged out by its second and never drawn. `capture()` notes every timed light a tick leaves alight; one that is gone at the draw without ever having been uploaded is put
// back in the light list for that one render, at the brightness its tick gave it, and taken out again in `unpose()` (only one its own clock retired: a light the game
// took out — a restart, a remove — stays out).
//
// Stale (`rest()`: a frame the fixed step did not run — the pause card, a script's frames, the switch off): the next tweened frame starts from a capture of its own, and
// until two captures stand the picture is the last tick's, as ever.
import { BoxWorld, type Box } from '../scene/boxes';
import type { LightSet, RtLight } from '../render/lights';
import type { Vec3, Quat } from '../math/vec';

/** `on`: the switch (off = the fixed step draws the last tick, as it did). `snap` (m): a move longer than this inside one tick is a cut and is not blended.
 *  `flashes`: a one-tick light a frame of several ticks would never draw is drawn once. `ease` (ticks a frame): how fast a lag longer than the display needs is let go. */
export const TWEEN = { on: false, snap: 1.5, flashes: true, ease: 0.002 };

/** the men's drawable as this file needs it (anim/characters.ts CharacterRenderer): the palette the last tick staged, who each instance is, and a write of the picture's own */
export interface TweenSkin {
  readonly staged: Float32Array; readonly jointFloats: number; instanceCount: number;
  ownerOf(i: number): number;
  drawJoints(data: Float32Array, count: number): void;
}
export interface TweenHost { readonly world: BoxWorld; readonly lights: LightSet; skin: unknown }

const BS = 14;   // a keyed box's row: c(3) yaw hasRot rot(4) h(3) owner hasDc — dc rides in its own array
interface Snap {
  n: number; key: Map<number, number>; box: Float64Array; dc: Float64Array;
  lights: Map<RtLight, number>; lf: Float64Array;
  men: Map<number, number>; joints: Float32Array; menN: number;
  caps: Float64Array; capOwner: number[]; capN: number;
  cam: Float64Array; hasCam: boolean;
}
/** the camera's pose (game/camera.ts FollowCamera: what rebuild() makes its matrices from) */
export interface TweenCam { target: Vec3; yaw: number; pitch: number; distance: number }
const newSnap = (): Snap => ({ n: 0, key: new Map(), box: new Float64Array(256 * BS), dc: new Float64Array(256 * 3), lights: new Map(), lf: new Float64Array(64 * 6), men: new Map(), joints: new Float32Array(0), menN: 0, caps: new Float64Array(0), capOwner: [], capN: 0, cam: new Float64Array(6), hasCam: false });
const CAPS = BoxWorld.CAPS_PER_CHAR, CW = CAPS * 8;   // records a man, and his words: 8 floats a record (ends at 0‥2 and 4‥6)
const ENDS = [0, 1, 2, 4, 5, 6];   // a record's two ends
const WINDOW = 32;   // frames `phase()` looks back over

export class Tween {
  /** nothing to blend from yet: the next tweened frame captures before its first tick */
  stale = true;
  /** captures standing since the last `rest()` (two = a blend can be drawn) */
  have = 0;
  /** what the last `pose()` did, for the checks and the panel: the blend factor, keyed boxes / lights / men blended, things cut (moved past `snap`), spent flashes drawn */
  last = { a: 1, boxes: 0, lights: 0, men: 0, cuts: 0, flashes: 0 };
  /** the palette the last `pose()` handed the GPU (the men's joint matrices, instance by instance) — null while nothing was blended */
  drawn: Float32Array | null = null;
  private prev = newSnap(); private cur = newSnap();
  // what pose() hung in place, for unpose(): the box and the arrays it had
  private rb: Box[] = []; private rc: Vec3[] = []; private ryaw: number[] = []; private rrot: (Quat | undefined)[] = []; private rdc: (Vec3 | undefined)[] = [];
  private rl: RtLight[] = []; private rlp: Vec3[] = []; private rld: Vec3[] = [];
  private capSave = new Float64Array(0); private capSaved = 0; private boundSave = new Float64Array(0); private boundSaved = 0;
  /** how far behind the frame's time the picture stands, in ticks (`phase()`) */
  lag = 0;
  private owed = new Float64Array(WINDOW); private owedN = 0; private owedI = 0;
  private spent: RtLight[] = []; private lit: RtLight[] = []; private spentAt = -1;
  private out = new Float32Array(0); private skinPosed = false;
  // scratch arrays handed out to the picture for one draw (never to the game): reused frame after frame
  private v3s: Vec3[] = []; private v3n = 0; private q4s: Quat[] = []; private q4n = 0;
  private vec(): Vec3 { return this.v3s[this.v3n++] ?? (this.v3s[this.v3n - 1] = [0, 0, 0]); }
  private quat(): Quat { return this.q4s[this.q4n++] ?? (this.q4s[this.q4n - 1] = [0, 0, 0, 1]); }

  constructor(private host: TweenHost) {}
  private skin(): TweenSkin | null { const s = this.host.skin as Partial<TweenSkin> | null; return s && s.staged && typeof s.drawJoints === 'function' ? s as TweenSkin : null; }

  /** a frame the fixed step did not run: nothing is blended, and the men's palette on the GPU is the tick's again if a blend was the last thing written there */
  rest(): void {
    if (this.skinPosed) { const s = this.skin(); if (s) s.drawJoints(s.staged, s.instanceCount); this.skinPosed = false; this.drawn = null; }
    this.stale = true; this.have = 0; this.lit.length = 0; this.lag = 0; this.owedN = 0; this.owedI = 0;
  }

  /** THE FRAME'S FACTOR. `owed` = the time the loop owes the next tick ÷ the tick (0 ≤ owed < 1): how far past the last tick this frame's time stands. A picture that is to
   *  move evenly must stand a CONSTANT time behind the frames, and far enough behind that no frame asks for a tick that has not run: `lag` = the most any of the last
   *  WINDOW frames owed. So a display at the tick rate (owed never changes) draws the last tick itself, with no lag and nothing hung; one at twice the rate stands half a
   *  tick behind; an odd rate, or frames of uneven length, nearly a whole one. A frame that owes more than the lag pulls it up at once (that frame draws the last tick); a
   *  lag longer than the window needs is let go `ease` a frame. Returns a: 1 = the last tick as it is, below 1 = that far from the tick before it to it. */
  phase(owed: number): number {
    const r = this.owed; r[this.owedI] = owed; this.owedI = (this.owedI + 1) % WINDOW; if (this.owedN < WINDOW) this.owedN++;
    let most = 0; for (let i = 0; i < this.owedN; i++) if (r[i] > most) most = r[i];
    if (owed > this.lag) this.lag = owed; else if (this.lag > most) this.lag = Math.max(most, this.lag - TWEEN.ease);
    const a = 1 - (this.lag - owed);
    return a > 1 - 1e-6 ? 1 : a < 0 ? 0 : a;
  }

  /** THE END OF A TICK (and once before the first tick after `rest()`): what stands now becomes the tick the next frames blend TO, what stood becomes the one they blend from.
   *  `cam` = the camera as that tick's step left it. Reads only; copies everything it keeps. */
  capture(cam?: TweenCam | null): void {
    const S = this.prev; this.prev = this.cur; this.cur = S; this.stale = false; this.have = Math.min(2, this.have + 1);
    const W = this.host.world, dyn = W.dynamics;
    // ---- keyed boxes
    S.key.clear(); let n = 0;
    for (let i = 0; i < dyn.length; i++) {
      const b = dyn[i], k = b.mkey; if (k === undefined) continue;
      if (S.key.has(k)) { S.key.set(k, -1); continue; }   // (two boxes under one key this tick: neither is blended)
      if ((n + 1) * BS > S.box.length) { const f = new Float64Array(S.box.length * 2); f.set(S.box); S.box = f; const d = new Float64Array(S.dc.length * 2); d.set(S.dc); S.dc = d; }
      const o = n * BS, f = S.box, r = b.rot, dc = b.dc;
      f[o] = b.c[0]; f[o + 1] = b.c[1]; f[o + 2] = b.c[2]; f[o + 3] = b.yaw;
      if (r) { f[o + 4] = 1; f[o + 5] = r[0]; f[o + 6] = r[1]; f[o + 7] = r[2]; f[o + 8] = r[3]; } else f[o + 4] = 0;
      f[o + 9] = b.h[0]; f[o + 10] = b.h[1]; f[o + 11] = b.h[2]; f[o + 12] = b.owner;
      if (dc) { f[o + 13] = 1; S.dc[n * 3] = dc[0]; S.dc[n * 3 + 1] = dc[1]; S.dc[n * 3 + 2] = dc[2]; } else f[o + 13] = 0;
      S.key.set(k, n++);
    }
    S.n = n;
    // ---- lights (the infrared list too), by the object; the timed ones a tick leaves alight are remembered until a draw has had its look
    const L = this.host.lights; S.lights.clear(); let ln = 0;
    for (let pass = 0; pass < 2; pass++) {
      const list = pass ? L.ir : L.lights;
      for (let i = 0; i < list.length; i++) {
        const l = list[i];
        if ((ln + 1) * 6 > S.lf.length) { const f = new Float64Array(S.lf.length * 2); f.set(S.lf); S.lf = f; }
        const o = ln * 6, f = S.lf; f[o] = l.pos[0]; f[o + 1] = l.pos[1]; f[o + 2] = l.pos[2]; f[o + 3] = l.dir[0]; f[o + 4] = l.dir[1]; f[o + 5] = l.dir[2];
        S.lights.set(l, ln++);
        if (!pass && l.ttl >= 0 && l.slot === undefined && l.enabled && l.intensity > 0 && this.lit.length < 64 && !this.lit.includes(l)) this.lit.push(l);
      }
    }
    // ---- the men: the staged palette by the man's id, and the ends of their shadow proxies
    const sk = this.skin(); S.men.clear(); S.menN = 0;
    if (sk) {
      const cnt = sk.instanceCount, jf = sk.jointFloats;
      if (S.joints.length < cnt * jf) S.joints = new Float32Array(Math.max(cnt, 16) * jf);
      S.joints.set(sk.staged.subarray(0, cnt * jf));
      for (let i = 0; i < cnt; i++) { const id = sk.ownerOf(i); S.men.set(id, S.men.has(id) ? -1 : i); }
      S.menN = cnt;
    }
    { const cn = W.charCount, words = cn * CW;
      if (S.caps.length < words) S.caps = new Float64Array(Math.max(words, 8 * CW));
      for (let w = 0; w < words; w++) S.caps[w] = W.capsuleData[w];
      S.capOwner.length = cn; for (let c = 0; c < cn; c++) S.capOwner[c] = W.capsuleU32[c * CW + 7] & 0xff;
      S.capN = cn; }
    // ---- the camera
    S.hasCam = !!cam; if (cam) { const f = S.cam; f[0] = cam.target[0]; f[1] = cam.target[1]; f[2] = cam.target[2]; f[3] = cam.yaw; f[4] = cam.pitch; f[5] = cam.distance; }
  }

  private camOut: TweenCam = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 0 };
  /** the camera at blend `a`: between where the last two ticks' steps left it, or null = as it stands (nothing to blend from, or a cut: the look-at or the distance
   *  jumped past `snap`, or it came round or tipped more than half a radian in the tick — a new shot, a restart, a pin; or `now`, the camera as it stands, is no longer
   *  where the last tick left it: something outside the ticks has written it since — a show stopped by a key, a framing staged — and that is the newest word).
   *  The object is this file's own, reused. */
  camAt(a: number, now?: TweenCam): TweenCam | null {
    const P = this.prev, C = this.cur;
    if (this.have < 2 || a >= 1 || !P.hasCam || !C.hasCam) return null;
    const p = P.cam, c = C.cam, snap = TWEEN.snap;
    if (now && (now.target[0] !== c[0] || now.target[1] !== c[1] || now.target[2] !== c[2] || now.yaw !== c[3] || now.pitch !== c[4] || now.distance !== c[5])) return null;
    let dy = (c[3] - p[3]) % (2 * Math.PI); if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
    if (Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) > snap || Math.abs(c[5] - p[5]) > snap || Math.abs(dy) > 0.5 || Math.abs(c[4] - p[4]) > 0.5) return null;
    const o = this.camOut, t = o.target;
    t[0] = p[0] + (c[0] - p[0]) * a; t[1] = p[1] + (c[1] - p[1]) * a; t[2] = p[2] + (c[2] - p[2]) * a;
    o.yaw = p[3] + dy * a; o.pitch = p[4] + (c[4] - p[4]) * a; o.distance = p[5] + (c[5] - p[5]) * a;
    return o;
  }

  /** RIGHT BEFORE THE HOST'S RENDER: hang the blend at `a` (0 = the tick before the last, 1 = the last: nothing hung) on what the render reads. Always paired with `unpose()`. */
  pose(a: number): void {
    const R = this.last; R.a = a; R.boxes = 0; R.lights = 0; R.men = 0; R.cuts = 0; R.flashes = 0;
    this.v3n = 0; this.q4n = 0;
    const W = this.host.world, L = this.host.lights, P = this.prev, C = this.cur, snap = TWEEN.snap;
    // ---- a flash no frame has drawn and the list no longer holds: in for this render
    this.spentAt = -1;
    if (TWEEN.flashes && this.lit.length) {
      for (const l of this.lit) if (l.slot === undefined && l.age >= l.ttl && !L.lights.includes(l)) this.spent.push(l);   // (aged out by a later tick — not one the game took away: a restart, a remove)
      if (this.spent.length) { this.spentAt = L.lights.length; for (const l of this.spent) L.lights.push(l); R.flashes = this.spent.length; }
    }
    this.lit.length = 0;
    if (this.have < 2 || !(a < 1)) {   // the last tick as it is — and the men's palette on the GPU the tick's own again, if a frame with no tick since left a blend there
      if (this.skinPosed) { const s = this.skin(); if (s) s.drawJoints(s.staged, s.instanceCount); this.skinPosed = false; }
      this.drawn = null; return;
    }
    // ---- keyed boxes
    const dyn = W.dynamics, pf = P.box;
    for (let i = 0; i < dyn.length; i++) {
      const b = dyn[i], k = b.mkey; if (k === undefined) continue;
      const pi = P.key.get(k); if (pi === undefined || pi < 0 || (C.key.get(k) ?? -1) < 0) continue;
      const o = pi * BS, c = b.c, r = b.rot, dc = b.dc;
      const moved = pf[o] !== c[0] || pf[o + 1] !== c[1] || pf[o + 2] !== c[2], turned = pf[o + 3] !== b.yaw;
      const rolled = !!r && pf[o + 4] === 1 && (pf[o + 5] !== r[0] || pf[o + 6] !== r[1] || pf[o + 7] !== r[2] || pf[o + 8] !== r[3]);
      const drawnMoved = !!dc && pf[o + 13] === 1 && (P.dc[pi * 3] !== dc[0] || P.dc[pi * 3 + 1] !== dc[1] || P.dc[pi * 3 + 2] !== dc[2]);
      if (!moved && !turned && !rolled && !drawnMoved) continue;
      if (pf[o + 9] !== b.h[0] || pf[o + 10] !== b.h[1] || pf[o + 11] !== b.h[2] || pf[o + 12] !== b.owner || (pf[o + 4] === 1) !== !!r) continue;   // (another box under the key)
      if (Math.hypot(c[0] - pf[o], c[1] - pf[o + 1], c[2] - pf[o + 2]) > snap) { R.cuts++; continue; }
      this.rb.push(b); this.rc.push(c); this.ryaw.push(b.yaw); this.rrot.push(r); this.rdc.push(dc);
      if (moved) { const v = this.vec(); v[0] = pf[o] + (c[0] - pf[o]) * a; v[1] = pf[o + 1] + (c[1] - pf[o + 1]) * a; v[2] = pf[o + 2] + (c[2] - pf[o + 2]) * a; b.c = v; }
      if (turned) { let d = (b.yaw - pf[o + 3]) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; b.yaw = pf[o + 3] + d * a; }
      if (rolled) {   // (the short way round: the nearer of q and −q, then a normalised lerp — a tick's turn is a few degrees)
        const s = pf[o + 5] * r![0] + pf[o + 6] * r![1] + pf[o + 7] * r![2] + pf[o + 8] * r![3] < 0 ? -1 : 1, q = this.quat();
        let x = pf[o + 5] + (r![0] * s - pf[o + 5]) * a, y = pf[o + 6] + (r![1] * s - pf[o + 6]) * a, z = pf[o + 7] + (r![2] * s - pf[o + 7]) * a, w = pf[o + 8] + (r![3] * s - pf[o + 8]) * a;
        const m = Math.hypot(x, y, z, w); if (m > 1e-9) { x /= m; y /= m; z /= m; w /= m; q[0] = x; q[1] = y; q[2] = z; q[3] = w; b.rot = q; }
      }
      if (drawnMoved) { const v = this.vec(), d = P.dc, j = pi * 3; v[0] = d[j] + (dc![0] - d[j]) * a; v[1] = d[j + 1] + (dc![1] - d[j + 1]) * a; v[2] = d[j + 2] + (dc![2] - d[j + 2]) * a; b.dc = v; }
      R.boxes++;
    }
    // ---- lights
    for (let pass = 0; pass < 2; pass++) {
      const list = pass ? L.ir : L.lights, f = P.lf;
      for (let i = 0; i < list.length; i++) {
        const l = list[i], pi = P.lights.get(l); if (pi === undefined) continue;
        const o = pi * 6, p = l.pos, d = l.dir;
        const moved = f[o] !== p[0] || f[o + 1] !== p[1] || f[o + 2] !== p[2], turned = f[o + 3] !== d[0] || f[o + 4] !== d[1] || f[o + 5] !== d[2];
        if (!moved && !turned) continue;
        if (Math.hypot(p[0] - f[o], p[1] - f[o + 1], p[2] - f[o + 2]) > snap) { R.cuts++; continue; }
        this.rl.push(l); this.rlp.push(p); this.rld.push(d);
        if (moved) { const v = this.vec(); v[0] = f[o] + (p[0] - f[o]) * a; v[1] = f[o + 1] + (p[1] - f[o + 1]) * a; v[2] = f[o + 2] + (p[2] - f[o + 2]) * a; l.pos = v; }
        if (turned) { const x = f[o + 3] + (d[0] - f[o + 3]) * a, y = f[o + 4] + (d[1] - f[o + 4]) * a, z = f[o + 5] + (d[2] - f[o + 5]) * a, m = Math.hypot(x, y, z); if (m > 1e-9) { const v = this.vec(); v[0] = x / m; v[1] = y / m; v[2] = z / m; l.dir = v; } }
        R.lights++;
      }
    }
    // ---- the men: the palette into an array of our own, handed to the GPU alone
    const sk = this.skin();
    if (sk && sk.instanceCount > 0) {
      const cnt = sk.instanceCount, jf = sk.jointFloats, cur = sk.staged, pj = P.joints;
      if (this.out.length < cnt * jf) this.out = new Float32Array(Math.max(cnt, 16) * jf);
      const out = this.out;
      for (let i = 0; i < cnt; i++) {
        const o = i * jf, id = sk.ownerOf(i), pi = P.men.get(id);
        let blend = pi !== undefined && pi >= 0 && pi < P.menN && (C.men.get(id) ?? -1) >= 0;
        if (blend) { const q = pi! * jf; if (Math.hypot(cur[o + 12] - pj[q + 12], cur[o + 13] - pj[q + 13], cur[o + 14] - pj[q + 14]) > snap) { blend = false; R.cuts++; } }
        if (blend) { const q = pi! * jf; for (let k = 0; k < jf; k++) out[o + k] = pj[q + k] + (cur[o + k] - pj[q + k]) * a; R.men++; }
        else out.set(cur.subarray(o, o + jf), o);
      }
      sk.drawJoints(out, cnt); this.skinPosed = true; this.drawn = out;
    } else this.drawn = null;
    // ---- their shadow proxies: the capsule ends (and, with no rig fit to rebuild it, the cull sphere's centre), written in place and put back by unpose()
    { const cn = W.charCount, words = cn * CW, D = W.capsuleData, pc = P.caps;
      if (this.capSave.length < words) this.capSave = new Float64Array(Math.max(words, 8 * CW));
      for (let w = 0; w < words; w++) this.capSave[w] = D[w];
      if (this.boundSave.length < cn * 4) this.boundSave = new Float64Array(Math.max(cn, 16) * 4);
      this.capSaved = words; this.boundSaved = cn * 4; for (let w = 0; w < cn * 4; w++) this.boundSave[w] = W.infoF32[24 + w];
      for (let c = 0; c < cn; c++) {
        const id = W.capsuleU32[c * CW + 7] & 0xff; let pcI = -1; let dup = 0;
        for (let j = 0; j < P.capN; j++) if (P.capOwner[j] === id) { pcI = j; dup++; }
        if (pcI < 0 || dup !== 1) continue;
        const o0 = c * CW, q0 = pcI * CW; let far = false, mx = 0, my = 0, mz = 0, real = 0;
        for (let i = 0; i < CAPS && !far; i++) { const o = o0 + i * 8, q = q0 + i * 8; if (!(D[o + 3] > 0) || !(pc[q + 3] > 0)) continue; if (Math.hypot(D[o] - pc[q], D[o + 1] - pc[q + 1], D[o + 2] - pc[q + 2]) > snap) far = true; }
        if (far) continue;
        for (let i = 0; i < CAPS; i++) {
          const o = o0 + i * 8, q = q0 + i * 8; if (!(D[o + 3] > 0) || !(pc[q + 3] > 0)) continue;   // (a padding record on either tick: left as it is)
          for (let j = 0; j < 6; j++) { const e = ENDS[j], was = this.capSave[o + e]; D[o + e] = pc[q + e] + (was - pc[q + e]) * a; }
          mx += D[o] - this.capSave[o]; my += D[o + 1] - this.capSave[o + 1]; mz += D[o + 2] - this.capSave[o + 2]; real++;
        }
        if (real) { const bo = 24 + c * 4; W.infoF32[bo] += mx / real; W.infoF32[bo + 1] += my / real; W.infoF32[bo + 2] += mz / real; }   // (the game's own cull sphere rides with the mean move of his records; a rig fit rebuilds it from the ends at the upload)
      }
    }
  }

  /** RIGHT AFTER THE HOST'S RENDER: every array `pose()` hung is taken down and the tick's own hung back; the spent flashes leave the list */
  unpose(): void {
    const rb = this.rb;
    for (let i = 0; i < rb.length; i++) { const b = rb[i]; b.c = this.rc[i]; b.yaw = this.ryaw[i]; if (this.rrot[i] !== undefined) b.rot = this.rrot[i]; if (this.rdc[i] !== undefined) b.dc = this.rdc[i]; }
    rb.length = 0; this.rc.length = 0; this.ryaw.length = 0; this.rrot.length = 0; this.rdc.length = 0;
    const rl = this.rl;
    for (let i = 0; i < rl.length; i++) { rl[i].pos = this.rlp[i]; rl[i].dir = this.rld[i]; }
    rl.length = 0; this.rlp.length = 0; this.rld.length = 0;
    const W = this.host.world, D = W.capsuleData;
    for (let o = 0; o < this.capSaved; o += 8) for (let j = 0; j < 6; j++) D[o + ENDS[j]] = this.capSave[o + ENDS[j]];
    if (!W.rig) for (let w = 0; w < this.boundSaved; w++) W.infoF32[24 + w] = this.boundSave[w];
    this.capSaved = 0; this.boundSaved = 0;
    if (this.spentAt >= 0) { const L = this.host.lights.lights; for (const l of this.spent) { const i = L.lastIndexOf(l); if (i >= this.spentAt) L.splice(i, 1); } }
    this.spent.length = 0; this.spentAt = -1;
  }
}
