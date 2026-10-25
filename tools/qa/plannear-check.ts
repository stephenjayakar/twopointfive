// PLAN MODE REACHES ONE ROOM, NOT THE LEVEL (CMDRING.planNear, src/game/planmode.ts pan / planNear). The maintainer, 10-23: "it's too easy to just play
// this like an RTS. we should instead make it so you can only move a bounded amount from the player. like maybe the player has to roughly be on screen
// but can be in a corner. the mental model is that it should be good for clearing one room but not the whole level".
//   bun run tools/qa/plannear-check.ts            (also `probes.ts plannear`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/plannear-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless, on planmode-check's rig (the room clear on the office, its squad of four, the mode and its RTS view raised by the rig; ONE
// deal, seed 3: the rule has no die in it). The bound is a box in the camera's own basis (`right` = across the screen, `fwd` = up it):
//   1. a walk key held five seconds: the view's point stops at the box's edge and Sam has not moved; another key then slides it along to the corner.
//   2. all eight ways out: the view stops on the box, and on the harness's view Sam's feet AND head are on the screen every time.
//   3. zoomed in (the camera at 12 of its 21) the box is that much smaller and he is still on the screen; zoomed out (40) it is no bigger than at 21.
//   4. the men put 30 m off: the view still stops on the box round HIM (the reach as first built followed the box the men stand in).
//   5. CONTROL — a tutorial frame that has taken his feet (rails `move` locked): the bound is not held; the lock let go, the view is walked in, not jumped.
//   6. a view filed further out (the rule off) is walked in to the box with the rule on, at no more than twice the pan's speed.
//   7. from a corner of the box a right click still orders, and the mode put down eases the view back to him (the knee's ease, planKnee).
//   8. CONTROL (plumbing) — a recording from before the key replays with the rule off; one made with it on replays on, off off.
//   9. CONTROL (the stands) — the frozen stand holds it off, the page's has it on, FROZEN_HOLDS carries its row.
// PLANNEAR_BREAK=1 = the rule left off: lines 1, 2, 3, 4 and 6 must fail (5, 7, 8 and 9 say what holds without it).   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig, STOOD } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const BREAK = process.env.PLANNEAR_BREAK === '1';
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export async function plannearCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, K = CMDRING;
  console.log(`plannear-check: plan mode's view stays where the player is on the screen${BREAK ? '  (PLANNEAR_BREAK: the rule left off — lines 1, 2, 3, 4 and 6 must fail)' : ''}`);
  try {
    const R = await rig(3, true, !BREAK); K.planNearFlat = false;   // (line 3 asks the box as it was built, smaller as the camera comes in: the reach that is the same at any zoom has its own check, plannearflat-check.ts)
    const g = R.game, O = R.O, P = O.plan, pl = g.player, I = R.input, cam = R.W.cam, cv = R.W.canvas, w = cv.clientWidth, h = cv.clientHeight;
    const hold = (keys: string[], frames: number) => { for (const k of keys) I.keys.add(k); R.step(frames); for (const k of keys) I.keys.delete(k); R.step(); };
    const zoom = (d: number) => { cam.distance = cam.desiredDistance = d; };
    const home = () => { zoom(21); R.home(true); if (P.look) { P.look[0] = pl.char.pos[0]; P.look[2] = pl.char.pos[2]; } R.step(40); };
    /** the view's point from him, in the camera's basis: [across the screen, up it] */
    const rf = (): [number, number] => { const B = cam.planarBasis(), L = P.look ?? pl.char.pos, dx = L[0] - pl.char.pos[0], dz = L[2] - pl.char.pos[2]; return [dx * B.right[0] + dz * B.right[2], dx * B.fwd[0] + dz * B.fwd[2]]; };
    const off = () => Math.hypot(...rf()), near = (a: number, b: number) => Math.abs(a - b) < 0.02;
    /** how far outside the view his feet and his head are, px (0: both on it) */
    const outside = () => { const q = pl.char.pos, o = (y: number) => { const [x, sy] = cam.project([q[0], y, q[2]], w, h); return Math.max(0, -x, x - w, -sy, sy - h); }; return Math.max(o(0), o(1.2)); };
    const feet = () => { const q = pl.char.pos, [x, y] = cam.project([q[0], 0, q[2]], w, h); return `${x.toFixed(0)},${y.toFixed(0)}`; };
    const S = K.planNearSideM, A = K.planNearAwayM, Bk = K.planNearBackM;
    home();
    // ---- 1
    { const p0 = [...pl.char.pos]; hold(['KeyW'], 300); const a = rf(); hold(['KeyD'], 180); R.step(60); const b = rf(), stood = dist(pl.char.pos, p0), o = outside();
      line(P.up && near(a[1], A) && Math.abs(a[0]) < 0.05 && near(b[1], A) && near(b[0], S) && stood < 0.05 && o === 0, `W held five seconds: the view stops ${A} m up the screen from him, and he has not moved; D after it slides the view along to the corner, ${S} m across, and he is on the screen there`,
        `after W: ${a[0].toFixed(2)} across, ${a[1].toFixed(2)} up · after D: ${b[0].toFixed(2)} across, ${b[1].toFixed(2)} up, his feet at ${feet()} of ${w} × ${h}${o ? ` (${o.toFixed(0)} px outside)` : ''} · he moved ${stood.toFixed(2)} m`); }
    // ---- 2
    const ways: [string, string[], number, number][] = [['W', ['KeyW'], 0, A], ['W+D', ['KeyW', 'KeyD'], S, A], ['D', ['KeyD'], S, 0], ['S+D', ['KeyS', 'KeyD'], S, -Bk], ['S', ['KeyS'], 0, -Bk], ['S+A', ['KeyS', 'KeyA'], -S, -Bk], ['A', ['KeyA'], -S, 0], ['W+A', ['KeyW', 'KeyA'], -S, A]];
    const round = (k: number) => { const rows: string[] = []; let worst = 0, on = true;
      for (const [name, keys, r, f] of ways) { home(); zoom(21 * k); R.step(30); hold(keys, 240); R.step(90);   // (… and the camera given time to settle on the point)
        const [x, y] = rf(), o = outside(); worst = Math.max(worst, o); const kk = Math.min(1, k), fy = f < 0 ? -Math.max(0, (Bk + 1.4) * kk - 1.4) : f * kk; if (!near(x, r * kk) || !near(y, fy)) on = false; rows.push(`${name}: ${x.toFixed(1)} across ${y.toFixed(1)} up, feet at ${feet()}${o ? ` (${o.toFixed(0)} px outside)` : ''}`); }
      return { rows, worst, on }; };
    { const X = round(1);
      line(X.on && X.worst === 0, `all eight ways out: the view stops on the box (${S} m across, ${A} up, ${Bk} down), and on the ${w} × ${h} view his feet and his head are on the screen every time`, `${X.rows.join(' · ')} · furthest outside ${X.worst.toFixed(0)} px`); }
    // ---- 3
    { const In = round(12 / 21), Out = round(40 / 21);
      line(In.on && In.worst === 0 && Out.on, 'zoomed in (the camera at 12) the box is 12/21 of itself (less his own height at the top) and he is still on the screen; zoomed out (40) it is no bigger than at 21', `at 12: ${In.rows.join(' · ')} · at 40: ${Out.rows.join(' · ')}`); }
    // ---- 4
    { home(); const q = pl.char.pos, was = R.team.map((m: any) => [...m.char.pos]); R.team.forEach((m: any, i: number) => { m.char.pos[0] = q[0] + 30 + i; });
      hold(['KeyD'], 300); const on = rf(); K.planNear = false; hold(['KeyD'], 300); const dOff = off(); K.planNear = !BREAK;
      R.team.forEach((m: any, i: number) => { m.char.pos[0] = was[i][0]; m.char.pos[1] = was[i][1]; m.char.pos[2] = was[i][2]; });
      line(near(on[0], S) && dOff > K.planPanReachM + 20, 'the men 30 m off: the view still stops on the box round HIM; with the rule off it follows the box the men stand in (past its reach from him alone)', `rule on: ${on[0].toFixed(2)} m across from him · rule off: ${dOff.toFixed(1)} m (the reach from him alone would be ${K.planPanReachM})`); }
    // ---- 5 and 6: a view found outside the box is walked in
    const walkIn = () => { const stride = 2 * K.planPanMps / 60 + 1e-6; let jump = 0, n = 0, last = [...(P.look ?? pl.char.pos)]; for (; n < 240; n++) { R.step(1); const L = P.look ?? pl.char.pos; jump = Math.max(jump, dist(L, last)); last = [...L]; if (Math.abs(rf()[0]) <= S + 0.02 && rf()[1] <= A + 0.02 && rf()[1] >= -Bk - 0.02) break; } return { jump, n, stride }; };
    { home(); const locks = g.rails.locks; g.rails.locks = (a: string) => a === 'move'; let d = -1; try { hold(['KeyW'], 300); d = off(); } finally { g.rails.locks = locks; }
      const X = walkIn();
      line(d > 20 && (BREAK || (X.n > 5 && X.n < 240 && X.jump <= X.stride)), 'CONTROL — a tutorial frame that has taken his feet: the bound is not held (he could not walk nearer); the lock let go, the view is walked in, not jumped',
        `feet locked: the view ${d.toFixed(1)} m from him · the lock off: inside the box ${X.n} ticks on, the longest stride of the point ${X.jump.toFixed(3)} m (twice the pan's: ${X.stride.toFixed(3)})`); }
    { home(); K.planNear = false; hold(['KeyA'], 200); const far = off(), snap = JSON.parse(JSON.stringify(PM.planSnapshot(O))); home(); K.planNear = !BREAK; PM.planRestore(O, snap); const filed = off(), X = walkIn();
      line(far > 20 && near(filed, far) && X.n > 5 && X.n < 240 && X.jump <= X.stride, 'a view filed further out, the rule off, is walked in to the box with the rule on, at no more than twice the pan\'s speed', `filed ${far.toFixed(1)} m from him · restored ${filed.toFixed(1)} m · inside the box ${X.n} ticks on, the longest stride ${X.jump.toFixed(3)} m`); }
    // ---- 7
    { home(); K.planKnee = true; R.toggle(); R.toggle(); hold(['KeyS', 'KeyD'], 240); R.step(60); const n0 = O.log.length, at = rf(); let got = '';
      for (const [x, y] of [[800, 500], [700, 420], [900, 580], [640, 500], [960, 500], [800, 380], [800, 620]]) { I.mouseX = x; I.mouseY = y; R.step(2); if (O.targetUnder(I, cam, cv)?.kind !== 'floor') continue; R.click(4); R.step(2); if (O.log.length > n0) { const T = R.tail(), t = O.targetUnder(I, cam, cv); got = `'${T?.order}' on ${t?.kind}, ${dist(t?.at ?? pl.char.pos, pl.char.pos).toFixed(1)} m from him, at ${x},${y}`; break; } }
      const d0 = off(); R.toggle(); const a = PM.planLook(O), da = a ? dist(a, pl.char.pos) : -1; R.step(Math.round(K.planBackSecs * 60) + 6); const home2 = PM.planLook(O) === null && dist(g.followPos(), pl.char.pos) < 1e-6; R.toggle();
      line(!!got && d0 > 3 && da > d0 * 0.8 && home2, 'from a corner of the box a right click still orders, and the mode put down eases the view back to him', `the view ${at[0].toFixed(1)} across ${at[1].toFixed(1)} up · the right click: ${got || 'no floor under seven places of the view, or nothing given'} · the mode down: the point ${da.toFixed(1)} m from him, then ${home2 ? 'his again' : 'NOT his'}`); }
    // ---- 8
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      K.planNear = true; const old = snap(); if (old.tables.CMDRING) delete old.tables.CMDRING.planNear; J.applyKnobs(g, old); const before = K.planNear;
      K.planNear = true; const on = snap(); K.planNear = false; J.applyKnobs(g, on); const kept = K.planNear;
      K.planNear = false; const offS = snap(); K.planNear = true; J.applyKnobs(g, offS); const keptOff = K.planNear;
      line(before === false && kept === true && keptOff === false, 'CONTROL (plumbing: no break word touches it) — a recording from before the key replays with CMDRING.planNear off; one made with it on replays on, off off', `from before the key: ${before} · recorded on: ${kept} · recorded off: ${keptOff}`); }
    // ---- 9
    { const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`), E = process.env, shipped = E.TPS_PROFILE === 'shipped', row = FROZEN_HOLDS['CMDRING.planNear'];
      // (the rule rides on the mode, which rides on the ring: the page's stand has all three on unless a word puts one off; the frozen stand needs all three words)
      const want = shipped ? E.TPS_PLANNEAR !== '0' && E.TPS_QPLAN !== '0' && E.TPS_QRING !== '0' : E.TPS_PLANNEAR === '1' && E.TPS_QPLAN === '1' && E.TPS_QRING === '1';
      line(STOOD.near === want && !!row?.includes('TPS_PLANNEAR=1'), `CONTROL (the stands) — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the rule up ${want ? 'on' : 'off'} by its words, and FROZEN_HOLDS carries its row`, `planNear ${STOOD.near} · row: '${row}'`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }
  console.log(fails ? `plannear-check: ${fails} FAIL` : 'plannear-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await plannearCheck()) ? 0 : 1);
