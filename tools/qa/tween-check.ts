// DRAWING BETWEEN TICKS (src/host/tween.ts TWEEN, under src/host/loop.ts FIXEDSTEP): is a frame that falls between two game ticks drawn at the blend of them, at every
// display rate, without the game ever reading the blend?
//   bun run tools/qa/tween-check.ts                 every check below; exit 0 = all pass, 1 = one failed (named). Run it on BOTH stands (TPS_PROFILE=shipped in front).
//   TWEEN_BREAK=1 bun run tools/qa/tween-check.ts   the red path: the blend is hung at the wrong factor and never taken down — 'blend', 'even time' and 'put back' must FAIL
//                                                   ('same game' still passes there: every tick lays its boxes and carried lights afresh, so a blend left hanging is overwritten before it is read)
// WHAT IS HELD (headless: the whole Game under stepFrame, the loop main.ts runs; the render stand-in packs the boxes and the lights as engine.render does and reads the
// words the GPU would be handed — BoxWorld.geoF32 / matData, the light records, the capsule table, the palette given to CharacterRenderer.drawJoints):
//   stands     FIXEDSTEP.on / TWEEN.on as this stand stood them (frozen: off · shipped: on · TPS_FIXEDSTEP / TPS_TWEEN = that word), their FROZEN_HOLDS rows, and the
//              page's boot (pageSwitches): no flag = both on, ?fixedstep=0 and ?tween=0 = that one off
//   blend      one seeded game, one input script keyed by the tick (a walk, a door swung, a fight), at 50, 60, 120 and 144 Hz: on every drawn frame the check's own record
//              of the two ticks round the frame's time (taken as each tick ends) and the frame's own factor a (the check's own sum: the time owed the next tick, less the
//              lag that rate asks) give, for every keyed box that moved, its packed centre and quaternion; for every man, the palette the GPU holds; for every light, its
//              record's position and direction; for every shadow proxy, its ends; and the point the camera is told to follow. Each must be the blend at a (a keyed thing
//              that jumped further than TWEEN.snap in the tick, or changed size or owner under its key: where the last tick has it). Boxes with no key: the last tick's.
//   even time  the picture's time (the tick before the last + a) moves on by exactly the frame's time on every frame after the first 64, and stands behind the game by
//              what that display must owe and no more: nothing at 60 Hz (every frame the last tick itself, nothing hung), 1/2 tick at 120, 4/5 at 50, 11/12 at 144
//   put back   after every frame every box, light and capsule end is the last tick's again — the same arrays, by reference
//   same game  the four displays, with the blend on, play the same seconds as the harness's own W.step(1/60) and as the fixed step with the blend off, digest for digest
//   pin        a framing a level script keys once a tick (a tracking, swinging shot: FollowCamera.pin) reaches the camera between its last two at a; a cut reaches it
//              as the last tick's; the camera holds the script's own pin again after every frame. And a clock run at twice the wall's (the page's __timeScale) may
//              run twice the ticks of a slow frame (the cap is against a stall)
//   flash      a light that lives one tick, made in the first tick of a two-tick frame, is in that frame's upload (and with TWEEN.flashes off it is in none, as before)
//   stale      a frame under the pause card and a script's frame draw the last tick with nothing hung; the palette on the GPU is the tick's again; play resumes blended
//   tape       a run taped on a 144 Hz display under the fixed step with the blend drawn (the replay buffer's run tape, as the page keeps it) holds 1/60 s steps
//              alone and is walked again by a fresh game (tools/qa/rerun.ts) to the same digest: the tape's format is as it was
//   off        TWEEN.on off under the fixed step: nothing is ever hung (every frame packs the last tick); FIXEDSTEP off: one update a frame and nothing hung
import { standUp, ROOT } from './headless.ts';
const { stepFrame, FIXEDSTEP } = await import(`${ROOT}/src/host/loop.ts`);
const { TWEEN, Tween } = await import(`${ROOT}/src/host/tween.ts`);
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`);
const { GEO_STRIDE, MAT_STRIDE, BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`);
const CAPS: number = BoxWorld.CAPS_PER_CHAR, CW = CAPS * 8;   // shadow-proxy records a man, and their words
const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);

const STEP = 1 / 60;
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const BREAK = process.env.TWEEN_BREAK === '1';
type V3 = [number, number, number];

let onUpdate: ((g: any, dt: number, input: any) => void) | null = null;
{ const update = Game.prototype.update;
  Game.prototype.update = function (this: any, dt: number, input: any, ...a: unknown[]) { onUpdate?.(this, dt, input); return (update as (...x: unknown[]) => unknown).call(this, dt, input, ...a); } as typeof update; }

// ---- stands
{ Math.random = seeded(1); await standUp({ seed: 1 });
  const shipped = process.env.TPS_PROFILE === 'shipped', wf = process.env.TPS_FIXEDSTEP, wt = process.env.TPS_TWEEN;
  const wantF = wf !== undefined ? wf === '1' : shipped, wantT = wt !== undefined ? wt === '1' : shipped;
  const rows = [PROFILE.FROZEN_HOLDS['FIXEDSTEP.on'], PROFILE.FROZEN_HOLDS['TWEEN.on']];
  const f0 = FIXEDSTEP.on, t0 = TWEEN.on;
  const page = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return [FIXEDSTEP.on, TWEEN.on]; };
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const keep = knobsCopy();
  const a = page(''), b = page('fixedstep=0'), c = page('tween=0'), d = page('fixedstep=off');
  knobsBack(keep); FIXEDSTEP.on = f0; TWEEN.on = t0;
  const pageOk = a[0] && a[1] && !b[0] && b[1] && c[0] && !c[1] && !d[0];
  verdict(f0 === wantF && t0 === wantT && /TPS_FIXEDSTEP=1/.test(rows[0] ?? '') && /TPS_TWEEN=1/.test(rows[1] ?? '') && pageOk, 'stands: the frozen stand holds both off, the shipped stand and the page have both on',
    `this stand (${shipped ? 'shipped' : 'frozen'}${wf !== undefined ? `, TPS_FIXEDSTEP=${wf}` : ''}${wt !== undefined ? `, TPS_TWEEN=${wt}` : ''}): fixed step ${f0}, between ticks ${t0} · FROZEN_HOLDS rows ${rows.every(Boolean) ? 'both there' : 'MISSING'} · the page's boot: '' → ${a.join('/')} · ?fixedstep=0 → ${b.join('/')} · ?tween=0 → ${c.join('/')} · ?fixedstep=off → ${d.join('/')}`); }

// ---- the check's own record of a tick: copies of everything a blend is made of, and the arrays that hung on the things as the tick ended
interface Truth {
  box: Map<number, { c: V3; yaw: number; rot: number[] | null; h: V3; owner: number; dc: V3 | null } | null>;
  refs: Map<any, { c: any; yaw: number; rot: any; dc: any }>;
  men: Map<number, Float32Array | null>;
  lights: Map<any, { pos: V3; dir: V3; rp: any; rd: any }>;
  caps: Float32Array; capOwner: number[];
  follow: V3;
}
function record(W: any): Truth {
  const T: Truth = { box: new Map(), refs: new Map(), men: new Map(), lights: new Map(), caps: new Float32Array(0), capOwner: [], follow: [...W.game.followPos()] as V3 };
  for (const b of W.engine.world.dynamics) {
    T.refs.set(b, { c: b.c, yaw: b.yaw, rot: b.rot, dc: b.dc });
    if (b.mkey === undefined) continue;
    T.box.set(b.mkey, T.box.has(b.mkey) ? null : { c: [...b.c] as V3, yaw: b.yaw, rot: b.rot ? [...b.rot] : null, h: [...b.h] as V3, owner: b.owner, dc: b.dc ? [...b.dc] as V3 : null });
  }
  const sk = W.engine.skin;
  for (let i = 0; i < sk.instanceCount; i++) { const id = sk.ownerOf(i); T.men.set(id, T.men.has(id) ? null : sk.staged.slice(i * 1024, (i + 1) * 1024)); }
  for (const l of [...W.engine.lights.lights, ...W.engine.lights.ir]) T.lights.set(l, { pos: [...l.pos] as V3, dir: [...l.dir] as V3, rp: l.pos, rd: l.dir });
  const wd = W.engine.world; T.caps = wd.capsuleData.slice(0, wd.charCount * CW); for (let c = 0; c < wd.charCount; c++) T.capOwner.push(wd.capsuleU32[c * CW + 7] & 0xff);
  return T;
}
const lerp = (p: number, c: number, a: number) => p + (c - p) * a;
const dist = (p: ArrayLike<number>, c: ArrayLike<number>) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]);
const near = (got: number, want: number, tol = 2e-5) => Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));

/** the input, keyed by the TICK: walk, a door swung, a crouch, and from 3 s a man with Sam in front of him */
const script = (g: any, k: number, input: any) => {
  if (k === 30) input.keys.add('KeyW'); if (k === 120) input.keys.delete('KeyW'); if (k === 150) input.pressed.add('KeyC');
  if (k === 40) { const p = g.player.char.pos; let best: any = null, bd = 1e9; for (const d of g.doors.list) { const q = d.hinge ?? d.pos ?? d.c; if (!q) continue; const dd = Math.hypot(q[0] - p[0], q[2] - p[2]); if (dd < bd) { bd = dd; best = d; } } if (best) g.doors.use(best, p, g.player.char.id); }
  if (k === 180) { const gd = g.guards[0]; g.godMode = true; const yaw = gd.char.bodyYaw; g.teleportPlayer([gd.char.pos[0] + Math.sin(yaw) * 3.5, 0, gd.char.pos[2] + Math.cos(yaw) * 3.5]); }
};
const SECS = 8, TICKS = SECS * 60;

interface Run { name: string; rows: unknown[]; text: string; frames: number; stat: Record<string, number>; bad: string[] }
async function play(name: string, dtOf: (() => number) | null, opt: { tween?: boolean; measure?: boolean } = {}): Promise<Run> {
  Math.random = seeded(3); const W: any = await standUp({ seed: 2026 }); const g = W.game;
  W.cam.setPin({ look: [...g.player.char.pos], yaw: 0.6, pitch: 0.9, dist: 14 });
  const rows: unknown[] = []; let k = 0, frames = 0;
  const stat: Record<string, number> = { frames: 0, blended: 0, boxes: 0, boxesMoved: 0, rot: 0, unkeyed: 0, men: 0, lights: 0, caps: 0, follow: 0, cuts: 0, whole: 0, putBack: 0, maxErr: 0, uneven: 0, evenRead: 0, lag: 0 };
  const bad: string[] = []; const flag = (s: string) => { if (bad.length < 6) bad.push(s); };
  onUpdate = (gg, _dt, input) => { script(gg, k, input); };
  const after = () => { k++; if (k % 30 === 0) rows.push(digestGame(g, true)); };
  if (!dtOf) { FIXEDSTEP.on = false; while (k < TICKS) { W.step(STEP); after(); frames++; } onUpdate = null; return { name, rows, text: JSON.stringify(rows), frames, stat, bad }; }
  FIXEDSTEP.on = true; TWEEN.on = opt.tween !== false;
  const tw = new Tween(W.engine); const truth: Truth[] = [];
  const capture = tw.capture.bind(tw); tw.capture = (at?: any) => { capture(at); truth.push(record(W)); if (truth.length > 2) truth.shift(); };
  if (BREAK) { const pose = tw.pose.bind(tw); tw.pose = (a: number) => pose(Math.min(0.999, a * 0.5 + 0.3)); tw.unpose = () => { /* the red path: never taken down */ }; }
  // the palette the GPU holds: the last write of it, the tick's own (CharacterRenderer.finish) or the picture's (drawJoints)
  let handed: Float32Array | null = null; const sk = W.engine.skin; const drawJoints = sk.drawJoints.bind(sk); sk.drawJoints = (d: Float32Array, n: number) => { handed = d.slice(0, n * 1024); drawJoints(d, n); };
  { const finish = sk.finish.bind(sk); sk.finish = (n: number) => { finish(n); handed = sk.staged.slice(0, n * 1024); }; }
  let followAsk: V3 | null = null; const camUpdate = W.cam.update.bind(W.cam); W.cam.update = (dt: number, target: V3, aim: V3 | null) => { followAsk = [...target] as V3; camUpdate(dt, target, aim); };
  let fed = 0, ticksRun = 0, a = 1, lag = 0, pictureWas = NaN; const owedOf: number[] = [];
  const measure = opt.measure !== false && TWEEN.on;
  const render = () => {
    const wd = W.engine.world, L = W.engine.lights; wd.upload(); L.upload(0);
    if (!measure || truth.length < 2) return;
    const [T0, T1] = truth; stat.frames++;
    const nStat = wd.statics.length, gf = wd.geoF32, mf = wd.matData, snap = TWEEN.snap;
    // boxes
    wd.dynamics.forEach((b: any, i: number) => {
      const o = (nStat + i) * GEO_STRIDE, m = (nStat + i) * MAT_STRIDE;
      const cur = T1.refs.get(b); if (!cur) { flag(`a box in the draw the last tick did not hand over (index ${i})`); return; }
      const c1: V3 = cur.dc ?? cur.c;
      let want: V3 = [c1[0], c1[1], c1[2]], wantYaw = cur.yaw, wantRot: number[] | null = cur.rot ? [...cur.rot] : null, moved = false;
      if (b.mkey === undefined) stat.unkeyed++;
      else {
        const p = T0.box.get(b.mkey), c = T1.box.get(b.mkey);
        if (p && c && p.h[0] === c.h[0] && p.h[1] === c.h[1] && p.h[2] === c.h[2] && p.owner === c.owner && !!p.rot === !!c.rot) {
          if (dist(p.c, c.c) > snap) { if (dist(p.c, c.c) > 0) stat.cuts++; }
          else {
            moved = dist(p.c, c.c) > 0 || p.yaw !== c.yaw || (!!p.rot && p.rot.some((v, j) => v !== c.rot![j])) || (!!p.dc && !!c.dc && dist(p.dc, c.dc) > 0);
            const pc = c.dc ? (p.dc ?? null) : p.c, cc = c.dc ?? c.c;
            if (pc) want = [lerp(pc[0], cc[0], a), lerp(pc[1], cc[1], a), lerp(pc[2], cc[2], a)];
            let d = (c.yaw - p.yaw) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; wantYaw = p.yaw + d * a;
            if (p.rot && c.rot) { const s = p.rot[0] * c.rot[0] + p.rot[1] * c.rot[1] + p.rot[2] * c.rot[2] + p.rot[3] * c.rot[3] < 0 ? -1 : 1; const q = p.rot.map((v, j) => lerp(v, c.rot![j] * s, a)); const n = Math.hypot(...q); wantRot = q.map(v => v / n);
              // …and, read without the formula: the drawn turn stands a of the way round from the one tick's to the other's
              const ang = (x: number[], y: number[]) => 2 * Math.acos(Math.min(1, Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2] + x[3] * y[3])));
              const whole = ang(p.rot, c.rot); if (whole > 0.02) { const got = [mf[m + 8], mf[m + 9], mf[m + 10], mf[m + 11]]; const part = ang(p.rot, got) / whole; if (Math.abs(part - a) > 0.03) flag(`box key ${b.mkey}: turned ${part.toFixed(3)} of the way at a = ${a.toFixed(3)}`); stat.rot++; } }
          }
        }
      }
      const e = Math.max(Math.abs(gf[o] - want[0]), Math.abs(gf[o + 1] - want[1]), Math.abs(gf[o + 2] - want[2])); stat.maxErr = Math.max(stat.maxErr, e);
      if (!near(gf[o], want[0]) || !near(gf[o + 1], want[1]) || !near(gf[o + 2], want[2])) flag(`box ${b.mkey ?? 'unkeyed'} centre packed ${[gf[o], gf[o + 1], gf[o + 2]].map(v => v.toFixed(4))} want ${want.map(v => v.toFixed(4))} at a = ${a.toFixed(3)}`);
      const wq = wantRot ?? [0, Math.sin(wantYaw / 2), 0, Math.cos(wantYaw / 2)];
      const sg = mf[m + 8] * wq[0] + mf[m + 9] * wq[1] + mf[m + 10] * wq[2] + mf[m + 11] * wq[3] < 0 ? -1 : 1;   // (q and −q are one turn)
      for (let j = 0; j < 4; j++) if (!near(mf[m + 8 + j], wq[j] * sg, 1e-4)) { flag(`box ${b.mkey ?? 'unkeyed'} quaternion word ${j} packed ${mf[m + 8 + j].toFixed(5)} want ${wq[j].toFixed(5)}`); break; }
      stat.boxes++; if (moved) stat.boxesMoved++;
    });
    // men: the palette the GPU was handed
    if (!handed) flag('no palette was ever handed to the GPU');
    else for (let i = 0; i < sk.instanceCount; i++) {
      const id = sk.ownerOf(i), p = T0.men.get(id), c = T1.men.get(id); if (!c) continue;
      const blend = !!p && dist([p[12], p[13], p[14]], [c[12], c[13], c[14]]) <= snap; let movedM = false;
      for (let j = 0; j < 1024; j++) { const want = blend ? lerp(p![j], c[j], a) : c[j]; if (blend && p![j] !== c[j]) movedM = true; if (!near(handed[i * 1024 + j], want, 1e-4)) { flag(`man ${id} joint float ${j}: handed ${handed[i * 1024 + j]} want ${want} at a = ${a.toFixed(3)}`); break; } }
      if (movedM) stat.men++;
    }
    if (a === 1) stat.whole++;
    // lights: the uploaded records
    { const f32: Float32Array = (L as any).f32;
      for (const l of [...L.lights, ...L.ir]) {
        if (!(l.slot >= 0)) continue; const p = T0.lights.get(l), c = T1.lights.get(l); if (!c) continue; const o = l.slot * 16;
        const blend = !!p && dist(p.pos, c.pos) <= snap;
        const wp = blend ? c.pos.map((v, j) => lerp(p!.pos[j], v, a)) : c.pos; let wd3 = blend ? c.dir.map((v, j) => lerp(p!.dir[j], v, a)) : c.dir; if (blend && c.dir.some((v, j) => v !== p!.dir[j])) { const n = Math.hypot(wd3[0], wd3[1], wd3[2]); if (n > 1e-9) wd3 = wd3.map(v => v / n); }
        for (let j = 0; j < 3; j++) if (!near(f32[o + j], wp[j]) || !near(f32[o + 4 + j], wd3[j], 1e-4)) { flag(`light ${l.name}: record ${[f32[o], f32[o + 1], f32[o + 2]].map(v => v.toFixed(4))} want ${wp.map(v => v.toFixed(4))} at a = ${a.toFixed(3)}`); break; }
        if (blend && (dist(p!.pos, c.pos) > 0 || dist(p!.dir, c.dir) > 0)) stat.lights++;
      } }
    // shadow proxies: the capsule ends
    for (let ci = 0; ci < wd.charCount; ci++) {
      const id = wd.capsuleU32[ci * CW + 7] & 0xff, pj = T0.capOwner.indexOf(id); if (pj < 0 || T0.capOwner.lastIndexOf(id) !== pj) continue;
      let far = false, movedC = false;
      for (let r = 0; r < CAPS; r++) { const o = ci * CW + r * 8, q = pj * CW + r * 8; if (T1.caps[o + 3] > 0 && T0.caps[q + 3] > 0 && dist(T0.caps.subarray(q, q + 3), T1.caps.subarray(o, o + 3)) > snap) far = true; }
      for (let r = 0; r < CAPS; r++) { const o = ci * CW + r * 8, q = pj * CW + r * 8; const real = T1.caps[o + 3] > 0 && T0.caps[q + 3] > 0;
        for (const e of [0, 1, 2, 4, 5, 6]) { const want = real && !far ? lerp(T0.caps[q + e], T1.caps[o + e], a) : T1.caps[o + e]; if (real && T0.caps[q + e] !== T1.caps[o + e]) movedC = true; if (!near(wd.capsuleData[o + e], want)) { flag(`man ${id} proxy ${r} end word ${e}: ${wd.capsuleData[o + e]} want ${want}`); break; } } }
      if (movedC && !far) stat.caps++;
    }
    // the camera's ask
    if (followAsk) { const p = truth[0].follow, c = truth[1].follow; const want = dist(p, c) <= snap ? c.map((v, j) => lerp(p[j], v, a)) : c; if (followAsk.some((v, j) => !near(v, want[j]))) flag(`the camera was told to follow ${followAsk.map(v => v.toFixed(4))}, want ${want.map(v => v.toFixed(4))} at a = ${a.toFixed(3)}`); if (dist(p, c) > 0) stat.follow++; }
    if (tw.last.boxes + tw.last.men + tw.last.lights > 0) stat.blended++;
  };
  const ctx: any = { game: g, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true };
  const base = onUpdate; let ran = 0; onUpdate = (gg, dt, input) => { if (ran) after(); ran++; ticksRun++; base!(gg, dt, input); };   // (a tick's digest is taken before the next tick's script, as W.step's is)
  while (ran <= TICKS && frames < 100000) {
    const dt = dtOf(); fed += dt;
    // this frame's factor, the check's own sum. What the frame owes the next tick: time fed less ticks run, over the tick (the loop's accumulator must agree)…
    const before = ticksRun; const plan = Math.floor((fed - before * STEP) / STEP + 1e-6); let owed = Math.max(0, (fed - (before + plan) * STEP) / STEP); if (owed < 1e-9) owed = 0;
    // …less the lag: the most any of the last 32 frames owed (pulled up at once, let go TWEEN.ease a frame)
    owedOf.push(owed); if (owedOf.length > 32) owedOf.shift(); const most = Math.max(...owedOf);
    if (owed > lag) lag = owed; else if (lag > most) lag = Math.max(most, lag - TWEEN.ease);
    a = 1 - (lag - owed); if (a > 1 - 1e-6) a = 1;
    stepFrame(ctx, dt); frames++;
    if (measure && Math.abs(ctx.fixed.acc * 60 - owed) > 1e-6) flag(`frame ${frames}: the loop owes ${(ctx.fixed.acc * 60).toFixed(6)} of a tick, the check's sum ${owed.toFixed(6)}`);
    if (measure && !BREAK && Math.abs(tw.last.a - a) > 1e-6) flag(`frame ${frames}: the loop drew at a = ${tw.last.a.toFixed(6)}, the check's ${a.toFixed(6)}`);
    if (measure) {   // even time: the picture's own clock, from what the loop did (ticks run, the factor it posed at), against the frame's
      const picture = (ticksRun - 1 + tw.last.a) * STEP;
      if (frames > 64) { stat.evenRead++; if (!(Math.abs(picture - pictureWas - dt) < 1e-7)) { stat.uneven++; flag(`frame ${frames}: the picture's time moved ${((picture - pictureWas) * 1000).toFixed(4)} ms on a frame of ${(dt * 1000).toFixed(4)} ms`); } }
      pictureWas = picture; stat.lag = fed - picture;
    }
    if (measure && truth.length) {   // put back: every thing the last tick left holds the arrays it held, and the capsule ends their values
      const T1 = truth[truth.length - 1]; let okBack = true;
      for (const b of W.engine.world.dynamics) { const r = T1.refs.get(b); if (!r || b.c !== r.c || b.yaw !== r.yaw || b.rot !== r.rot || b.dc !== r.dc) okBack = false; }
      for (const l of [...W.engine.lights.lights, ...W.engine.lights.ir]) { const r = T1.lights.get(l); if (r && (l.pos !== r.rp || l.dir !== r.rd || l.pos[0] !== r.pos[0] || l.pos[2] !== r.pos[2] || l.dir[0] !== r.dir[0])) okBack = false; }
      for (let w = 0; w < T1.caps.length; w++) if ((w & 7) !== 3 && (w & 7) !== 7 && W.engine.world.capsuleData[w] !== T1.caps[w]) okBack = false;
      if (okBack) stat.putBack++; else flag(`frame ${frames}: something still held the blend after the render`);
    }
  }
  rows.length = Math.min(rows.length, TICKS / 30); onUpdate = null;
  return { name, rows, text: JSON.stringify(rows), frames, stat, bad };
}

const fStood = FIXEDSTEP.on, tStood = TWEEN.on;
const ref = await play('the harness, W.step(1/60)', null);
const runs = [await play('60 Hz', () => 1 / 60), await play('120 Hz', () => 1 / 120), await play('144 Hz', () => 1 / 144), await play('50 Hz', () => 1 / 50)];
const plain = await play('120 Hz, the blend off', () => 1 / 120, { tween: false });

// ---- blend
{ const rows = runs.map(r => `${r.name}: ${r.stat.frames} frames read, ${r.stat.blended} with a blend, ${r.stat.whole} the last tick itself · ${r.stat.boxesMoved} moving keyed boxes (${r.stat.rot} turns read by angle) of ${r.stat.boxes}, ${r.stat.unkeyed} unkeyed · ${r.stat.men} men · ${r.stat.lights} lights · ${r.stat.caps} proxies · ${r.stat.follow} camera asks · ${r.stat.cuts} cuts · worst centre ${r.stat.maxErr.toExponential(1)} m${r.bad.length ? ` ✗ ${r.bad.filter(b => !/still held/.test(b)).slice(0, 3).join(' ✗ ')}` : ''}`);
  const live = runs.every(r => r.stat.frames > 100 && r.stat.boxesMoved > 50 && r.stat.men > 50 && r.stat.lights > 20 && r.stat.caps > 50 && r.stat.follow > 20);
  const offs = runs.every(r => r.name === '60 Hz' ? r.stat.blended === 0 && r.stat.whole === r.stat.frames : r.stat.blended > 50);
  const clean = runs.every(r => !r.bad.some(b => !/still held/.test(b)));
  verdict(live && offs && clean, 'blend: at 50, 120 and 144 Hz every drawn frame is the blend of the two ticks round it; at 60 Hz every frame is the last tick itself', rows.join('\n    ') + (live ? '' : '\n    ✗ too little moved for the numbers to mean anything')); }
// ---- even time
{ const want: Record<string, number> = { '60 Hz': 0, '120 Hz': 1 / 2, '144 Hz': 11 / 12, '50 Hz': 4 / 5 };
  const ok = runs.every(r => r.stat.evenRead > 100 && r.stat.uneven === 0 && Math.abs(r.stat.lag / STEP - want[r.name]) < 1e-4);
  verdict(ok, 'even time: the picture moves on by exactly the frame\'s time, a constant part of a tick behind the game and no more than that display must owe',
    runs.map(r => `${r.name}: ${r.stat.uneven} uneven of ${r.stat.evenRead} frames · ${(r.stat.lag / STEP).toFixed(4)} of a tick behind (${(r.stat.lag * 1000).toFixed(2)} ms; want ${want[r.name].toFixed(4)})`).join('\n    ')); }
// ---- put back
{ const ok = runs.every(r => r.stat.putBack === r.frames && !r.bad.some(b => /still held/.test(b)) && r.stat.putBack > 100);
  verdict(ok, 'put back: after every frame the boxes, lights and proxies are the last tick\'s own again, by reference', runs.map(r => `${r.name}: ${r.stat.putBack} of ${r.frames} frames checked clean${r.bad.some(b => /still held/.test(b)) ? ' ✗ ' + r.bad.find(b => /still held/.test(b)) : ''}`).join(' · ')); }
// ---- same game
{ const firstDiff = (x: unknown[], y: unknown[]): string => { for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = diffDigest(x[i], y[i], 3); if (d.length) return `first at ${((i + 1) / 2).toFixed(1)} s: ${d.join(' · ')}`; } return x.length === y.length ? 'no row differs' : `${x.length} rows against ${y.length}`; };
  const all = [...runs, plain], badRuns = all.filter(r => r.text !== ref.text);
  verdict(!badRuns.length && ref.rows.length === TICKS / 30, 'same game: with the blend drawn, 50, 60, 120 and 144 Hz displays play the same seconds as the harness\'s own 1/60 stepping and as the blend off',
    badRuns.length ? badRuns.map(r => `${r.name}: ${firstDiff(ref.rows, r.rows)}`).join(' · ') : `${ref.rows.length} digests equal across ${all.map(r => `${r.name} (${r.frames} frames)`).join(', ')} and ${ref.name}`); }

// ---- pin: a framing keyed once a tick, and the fast clock's cap
{ Math.random = seeded(1); const W: any = await standUp({ seed: 5 }); FIXEDSTEP.on = true; TWEEN.on = true; const tw = new Tween(W.engine);
  type Pin = { look: V3; yaw: number; pitch: number; dist: number };
  let k = 0; const pins: Pin[] = [];
  onUpdate = () => { k++; W.cam.pin = { look: [k * 0.05 + (k >= 40 ? 30 : 0), 0.8, 2], yaw: 0.3 + k * 0.01, pitch: 0.9, dist: 12 + k * 0.02 }; pins.push(W.cam.pin); };   // (tick 40: a cut, 30 m off)
  let seen: Pin | null = null; const cu = W.cam.update.bind(W.cam); W.cam.update = (dt: number, t: V3, aim: V3 | null) => { seen = W.cam.pin; cu(dt, t, aim); };
  const scale = { v: 1 };
  const ctx: any = { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true, timeScale: () => scale.v };
  let wrong = 0, between = 0, cuts = 0, back = 0, frames = 0; const first: string[] = [];
  for (let f = 0; f < 200; f++) {
    stepFrame(ctx, 1 / 144); frames++; const a = tw.last.a, c = pins[pins.length - 1], p = pins[pins.length - 2];
    if (W.cam.pin === (c ?? null)) back++;
    if (!p || !seen) continue;
    const cut = Math.abs(c.look[0] - p.look[0]) > TWEEN.snap, mid = a < 1 && !cut;
    const want = mid ? { x: lerp(p.look[0], c.look[0], a), yaw: lerp(p.yaw, c.yaw, a), dist: lerp(p.dist, c.dist, a) } : { x: c.look[0], yaw: c.yaw, dist: c.dist };
    const got: Pin = seen;
    if (!near(got.look[0], want.x) || !near(got.yaw, want.yaw) || !near(got.dist, want.dist)) { wrong++; if (first.length < 2) first.push(`tick ${k}, a = ${a.toFixed(3)}: the camera had look x ${got.look[0].toFixed(4)} yaw ${got.yaw.toFixed(4)}, want ${want.x.toFixed(4)} / ${want.yaw.toFixed(4)}`); }
    if (mid) between++; else if (cut && a < 1) cuts++;
  }
  onUpdate = null; W.cam.pin = null;
  // the fast clock: a 100 ms frame at the wall's pace is capped at maxTicks; at twice the pace it may run twice as many
  let ran = 0; onUpdate = () => { ran++; }; stepFrame(ctx, 0.1); const capped = ran; ran = 0; scale.v = 2; stepFrame(ctx, 0.1); const fast = ran; onUpdate = null;
  verdict(wrong === 0 && between > 80 && cuts >= 1 && back === frames && capped === FIXEDSTEP.maxTicks && fast === 6, 'pin: a framing keyed once a tick is drawn between its last two, a cut is not, and the script\'s own pin is back after every frame',
    `${between} frames between two ticks read, ${cuts} on the cut, ${wrong} wrong${first.length ? ' ✗ ' + first.join(' ✗ ') : ''} · the script's pin back after ${back} of ${frames} frames · a 100 ms frame: ${capped} ticks at the wall's pace (cap ${FIXEDSTEP.maxTicks}), ${fast} at twice it`); }

// ---- flash: a one-tick light on a two-tick frame
{ const rows: string[] = []; let ok = true;
  for (const flashes of [true, false]) {
    Math.random = seeded(1); const W: any = await standUp({ seed: 5 }); FIXEDSTEP.on = true; TWEEN.on = true; TWEEN.flashes = flashes;
    const tw = new Tween(W.engine); let made: any = null, uploaded = 0, inList = 0, tickOfFrame = 0, armed = false;
    const ctx: any = { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); W.engine.lights.upload(0); if (made && W.engine.lights.lights.includes(made) && made.slot >= 0) uploaded++; }, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
      smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true };
    onUpdate = (g) => { if (armed && tickOfFrame === 0 && !made) { const p = g.player.char.pos; made = g.engine.lights.flash([p[0], 1.2, p[2]], [1, 0.8, 0.5], 5, 3, 0.012, 0); } tickOfFrame++; };
    for (let f = 0; f < 12; f++) { tickOfFrame = 0; armed = f === 6; stepFrame(ctx, 1 / 30); if (made && W.engine.lights.lights.includes(made)) inList++; }
    onUpdate = null;
    const fine = flashes ? uploaded === 1 && inList === 0 : uploaded === 0 && inList === 0;
    ok &&= !!made && fine; rows.push(`flashes ${flashes ? 'on' : 'off'}: a 12 ms light made in the first of two ticks was uploaded on ${uploaded} frame(s), left in the game's list after ${inList}`);
  }
  TWEEN.flashes = true;
  verdict(ok, 'flash: a light that lived one tick inside a two-tick frame is drawn once, and is never left in the game\'s list', rows.join(' · ')); }

// ---- stale: the pause card, a script's frame, then play again
{ Math.random = seeded(1); const W: any = await standUp({ seed: 5 }); FIXEDSTEP.on = true; TWEEN.on = true;
  const tw = new Tween(W.engine); const st = { frozen: false, scripted: false }; let poses = 0; const pose = tw.pose.bind(tw); tw.pose = (a: number) => { poses++; pose(a); };
  let lastHand: Float32Array | null = null; const sk = W.engine.skin; const dj = sk.drawJoints.bind(sk); sk.drawJoints = (d: Float32Array, n: number) => { lastHand = d; dj(d, n); };
  const ctx: any = { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => st.frozen, present: () => false, fixedStep: () => !st.scripted };
  W.input.keys.add('KeyW');
  for (let f = 0; f < 40; f++) stepFrame(ctx, 1 / 144);
  const live = poses, blendedLive = tw.last.men + tw.last.boxes > 0 && lastHand !== sk.staged;
  st.frozen = true; stepFrame(ctx, 1 / 144); const frozenPoses = poses - live, restHand = lastHand === sk.staged, staleNow = tw.stale;
  stepFrame(ctx, 1 / 144); st.frozen = false; st.scripted = true; const p1 = poses; stepFrame(ctx, 1 / 60); const scriptedPoses = poses - p1; st.scripted = false;
  for (let f = 0; f < 6; f++) stepFrame(ctx, 1 / 144);
  const again = poses - p1 - scriptedPoses === 6 && tw.have === 2 && tw.last.men > 0;
  W.input.keys.delete('KeyW');
  verdict(blendedLive && frozenPoses === 0 && restHand && staleNow && scriptedPoses === 0 && again, 'stale: the pause card and a script\'s frame draw the last tick; play resumes blended',
    `live: ${live} frames hung, the last blending ${tw.last.men} men · under the card: ${frozenPoses} hung, the GPU palette the tick's again ${restHand}, stale ${staleNow} · a script's frame: ${scriptedPoses} hung · six live frames after: blended again ${again}`); }

// ---- off
{ const rows: string[] = []; let ok = true;
  { ok &&= plain.stat.frames === 0 && plain.text === ref.text; rows.push(`the fixed step with TWEEN off at 120 Hz: the same ${plain.rows.length} digests as the harness ${plain.text === ref.text}`); }
  { Math.random = seeded(1); const W: any = await standUp({ seed: 5 }); FIXEDSTEP.on = true; TWEEN.on = false; const tw = new Tween(W.engine); let hung = 0; tw.pose = () => { hung++; }; tw.capture = () => { hung++; };
    const ctx: any = { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
      smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true };
    for (let f = 0; f < 60; f++) stepFrame(ctx, 1 / 144);
    const a = hung; FIXEDSTEP.on = false; TWEEN.on = true; const dts: number[] = []; onUpdate = (_g, dt) => { dts.push(dt); }; for (let f = 0; f < 60; f++) stepFrame(ctx, 1 / 144); onUpdate = null;
    ok &&= a === 0 && hung === 0 && dts.length === 60 && dts.every(d => d === 1 / 144);
    rows.push(`TWEEN off under the fixed step: ${a} captures or poses in 60 frames · FIXEDSTEP off with TWEEN on: ${hung} in 60 frames, ${dts.length} updates on the frame's own dt`); }
  verdict(ok, 'off: with either switch off nothing is ever hung, and the game is the game', rows.join(' · ')); }

// ---- tape (LAST: a re-run leaves this process on the tape's tables)
{ const { ReplayBuffer } = await import(`${ROOT}/src/game/replaybuf.ts`), { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`), { hashDigest } = await import(`${ROOT}/src/game/digest.ts`), { rerun } = await import('./rerun.ts');
  Math.random = seeded(7); const W: any = await standUp({ seed: 11 }); FIXEDSTEP.on = true; TWEEN.on = true;
  const buf = new ReplayBuffer(); buf.tape.born(W.game);
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  const tw = new Tween(W.engine), N = 600; let k = 0, dAt = '', hung = 0;
  onUpdate = (g, _dt, input) => {   // (the hands, by the tick: keys alone — what a tape carries of the player)
    if (k === N) dAt = hashDigest(digestGame(g, true));
    if (k === 20) input.keys.add('KeyW'); if (k === 140) { input.keys.delete('KeyW'); input.keys.add('KeyD'); } if (k === 220) input.pressed.add('KeyC'); if (k === 300) { input.keys.delete('KeyD'); input.keys.add('KeyS'); } if (k === 420) input.keys.delete('KeyS');
    k++; };
  const ctx: any = { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); W.engine.lights.upload(0); if (tw.last.boxes + tw.last.men > 0) hung++; }, betweenTicks: () => { W.engine.world.upload(true); }, tween: tw,
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true };
  let frames = 0; while (k <= N && frames < 5000) { stepFrame(ctx, 1 / 144); frames++; }
  onUpdate = null; W.game.replayTap = null;
  const file = JSON.parse(JSON.stringify(buf.file(W.game, 'probe', { url: '', fp: levelFingerprint(W.game) })));
  const dts: [number, number][] = file.rerun?.dt ?? [], steps = dts.reduce((n, r) => n + r[0], 0), allTick = dts.length > 0 && dts.every(r => r[1] === STEP);
  const R = await rerun(file, { toN: N });
  const same = !R.refuse && !!R.W && hashDigest(digestGame(R.W.game, true)) === dAt;
  verdict(same && allTick && steps >= N && hung > 200 && !!dAt, 'tape: a run taped under the fixed step with the blend drawn is walked again by a fresh game to the same digest',
    `${frames} frames at 144 Hz, ${hung} drawn with a blend · the tape: ${steps} steps in ${dts.length} run(s) of dt, every one 1/60 s ${allTick} · the re-run at step ${N}: ${R.refuse ? `REFUSED: ${R.refuse}` : same ? `digest ${dAt} both` : `digest differs from the first run's ${dAt}`}`); }

FIXEDSTEP.on = fStood; TWEEN.on = tStood;
console.log(fails ? `=== tween-check: ${fails} FAILED ===` : '=== tween-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
