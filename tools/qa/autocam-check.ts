// THE CAMERA RUNS ITSELF (src/host/autocam.ts AUTOCAM; the mode in src/host/findme.ts AUTOVIEW; the loop's part in src/host/loop.ts). The page has the
// switch on (`?autocam=0` off); the module's own stand has it off, so both of the harness's stands start without it and this check raises it itself.
//   bun run tools/qa/autocam-check.ts            (also `probes.ts autocam`, family `player`)
//   TPS_PROFILE=shipped bun run tools/qa/autocam-check.ts      — the same lines on the page's stand
// THE FRAME, from scenes handed to it (no game):
//   1 nothing    nothing to frame: the look-at is his feet and the zoom the hand's own
//   2 door       a door ahead: the look-at goes toward the floor past it and stops inside the box he stays in; he is still in the middle of the screen
//   3 fight      a man he could shoot takes the frame from a door on his other side; the zoom goes out to hold him and never comes in while he is there
//   4 hold       a button down: the frame does not move
//   5 turn       the thing framed on the lens's side, his feet still: a turn is asked and lands with it up the screen; none while he walks, with a
//                button down, with a man he could shoot, just after a shot, with something in his hands' way, with `turn` off, or inside `gap` of the last
//   6 wall       a wall between the lens and him: the least turn that clears him
// THE LOOP, the whole Game under stepFrame (the loop the page runs), free step and fixed:
//   7 as it was  the switch on and the mode never put on: the same game and the same view as with the switch off (CONTROL: no break word touches it)
//   8 mode       the camera's key tapped twice puts the mode on and the view comes round to where he looked; the mouse moved past a tremor under the
//                key puts it off, a tremor does not; the key held with a walk key puts it off, and two taps with a walk key held put it ON
//   9 a door     in the mode, walking at a way out: the look-at runs ahead of him toward the floor past it; standing by it with the lens on the far
//                side the view comes round, his aim does not swing, and no turn begins while a walk key is down
//  10 a man      a hostile man in his line takes the frame; the same man hidden by the fog takes nothing
//  11 others'    a pin, a spectated man, plan mode: the mode frames nothing and the view is theirs
//  12 reads      the scene read every frame of a run and never used: the same game (CONTROL)
//  13 plumbing   the two stands by their words, the FROZEN_HOLDS row, a recording from before the key (CONTROL)
// AUTOCAM_BREAK=1 = the switch left off: lines 8, 9, 10 and 11 must FAIL.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

export async function autocamCheck(): Promise<boolean> {
  const BREAK = process.env.AUTOCAM_BREAK === '1', SWAYBREAK = process.env.AUTOSWAY_BREAK === '1';
  const { stepFrame, FIXEDSTEP } = await import(`${ROOT}/src/host/loop.ts`);
  const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);
  const A = await import(`${ROOT}/src/host/autocam.ts`) as typeof import('../../src/host/autocam.ts');
  const F = await import(`${ROOT}/src/host/findme.ts`) as typeof import('../../src/host/findme.ts');
  const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
  const J: any = await import(`${ROOT}/src/game/journal.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const { AUTOCAM: K, AUTOCAM_STATS: ST } = A, { AUTOVIEW, FINDME } = F;
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== autocam: the camera's key tapped twice and the camera frames things itself${BREAK ? ' (the switch left off: 8, 9, 10, 11 and 15 must fail)' : ''}${SWAYBREAK ? ' (the sway left off: 14 and 15 must fail)' : ''} ===`);
  const knobs0 = knobsCopy(), rnd0 = Math.random, fixedWas = FIXEDSTEP.on, viewWas = AUTOVIEW.on, behindWas = FINDME.behind, found = K.on;
  const DT = 1 / 60, f2 = (v: number) => v.toFixed(2), deg = (r: number) => (r * 180 / Math.PI).toFixed(1), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const ctxOf = (W: any, extra: Record<string, unknown> = {}): any => ({ game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); },
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true, ...extra });
  const stand = async (seed: number) => { Math.random = seeded(1); const W: any = await standUp({ seed }); W.game.godMode = true; W.game.aiEnabled = false; if (stoodSway === null) stoodSway = K.sway; K.sway = false; return W; };   // (the sway is off for every line but its own: 1 to 13 are the turn rule as it was built)
  let stoodSway: boolean | null = null;   // (as the first stand of the run left it: this stand's own word)
  try {
    const STOOD = { on: false }; { await stand(5); STOOD.on = K.on; }
    // ------------------------------------------------------------ the frame, from scenes handed to it
    const cam0 = () => { const c = new FollowCamera(); c.aspect = 1.6; c.target = [20, 0, 14]; c.desired = [20, 0, 14]; c.rebuild(); return c; };
    const scene = (o: Partial<import('../../src/host/autocam.ts').AutoScene> = {}): import('../../src/host/autocam.ts').AutoScene => ({ sam: [20, 0, 14], threats: [], beat: null, door: null, room: null, zoomK: 1, hold: false, still: false, free: true, vel: [0, 0], shown: 0, zoomFree: true, firedAgo: 100, ...o });
    const settle = (S: any, cam: any, st: any, secs = 4) => { let look: number[] = S.sam; for (let i = 0; i < secs * 60; i++) { look = A.autoFrame(st, S, cam, DT); cam.step(DT, look, null); } return look; };
    const begin = (cam: any) => { const st = A.autoCam(); A.autoBegin(st, cam); return st; };
    const up = (cam: any, m: number): [number, number, number] => { const B = cam.planarBasis(); return [20 + B.fwd[0] * m, 0, 14 + B.fwd[2] * m]; }, side = (cam: any, m: number): [number, number, number] => { const B = cam.planarBasis(); return [20 + B.right[0] * m, 0, 14 + B.right[2] * m]; };
    const onScreen = (cam: any, p: number[], margin = 1) => cam.project(p, 1600, 1000, margin)[2];
    { const cam = cam0(), st = begin(cam), look = settle(scene(), cam, st);
      line(Math.hypot(look[0] - 20, look[2] - 14) < 1e-9 && Math.abs(cam.desiredDistance - 21) < 1e-9, '1 nothing to frame: the look-at is his feet and the zoom the hand\'s own', `look-at ${f2(look[0])}, ${f2(look[2])} · distance ${f2(cam.desiredDistance)}`); }
    { const cam = cam0(), st = begin(cam), far = up(cam, 12), look = settle(scene({ door: { at: far, w: 1 } }), cam, st), B = cam.planarBasis(), f = (look[0] - 20) * B.fwd[0] + (look[2] - 14) * B.fwd[2], r = (look[0] - 20) * B.right[0] + (look[2] - 14) * B.right[2];
      const near = up(cam, 3), cam2 = cam0(), look2 = settle(scene({ door: { at: near, w: 1 } }), cam2, begin(cam2)), f2n = (look2[0] - 20) * B.fwd[0] + (look2[2] - 14) * B.fwd[2];
      const k = cam.distance / 21, [, sy, front] = cam.project([20, 0, 14], 1600, 1000), mid = front && sy > 500 && sy < 800;
      line(Math.abs(f - K.awayM * k) < 0.02 && Math.abs(r) < 0.02 && Math.abs(f2n - K.door * 3) < 0.02 && mid && onScreen(cam, [20, 1.8, 14], 0.8), '2 a door ahead: the look-at goes toward the floor past it, no further than the box he stays in, and he is still in the middle of the screen',
        `a door 12 m up the screen: look-at ${f2(f)} m up (the box: ${f2(K.awayM * k)}), ${f2(r)} across · 3 m up: ${f2(f2n)} m (its share: ${f2(K.door * 3)}) · his feet at ${sy.toFixed(0)} of 1000 down the screen`); }
    { const cam = cam0(), st = begin(cam), man = side(cam, 13), S = scene({ door: { at: side(cam, -4), w: 1 }, threats: [man] }), look = settle(S, cam, st), B = cam.planarBasis(), r = (look[0] - 20) * B.right[0] + (look[2] - 14) * B.right[2];
      const out = cam.desiredDistance, seen = onScreen(cam, [man[0], 1, man[2]]), sam = onScreen(cam, [20, 1, 14], 0.9);
      S.zoomK = 0.8; settle(S, cam, st, 2); const held = cam.desiredDistance; S.threats = []; S.zoomK = 1; S.door = null; settle(S, cam, st, 5); const back = cam.desiredDistance;
      line(r > 2 && out > 21 * 1.05 && out <= 21 * K.fitMost + 1e-6 && seen && sam && held >= out - 1e-6 && Math.abs(back - 21) < 0.2, '3 a man he could shoot takes the frame from a door on his other side; the zoom goes out to hold him, never in while he is there, and back when he is gone',
        `a man 13 m to one side, a door 4 m to the other: look-at ${f2(r)} m toward the man · distance 21 → ${f2(out)} (${seen ? 'he is in the picture' : 'he is OFF it ✗'}, Sam ${sam ? 'in it' : 'OFF it ✗'}) · asked to come in with him there: ${f2(held)} · he is gone: ${f2(back)}`); }
    { const cam = cam0(), st = begin(cam), S = scene({ door: { at: up(cam, 8), w: 1 } }); settle(S, cam, st, 0.3); const o0 = [...st.off]; S.hold = true; S.door = { at: side(cam, 8), w: 1 }; settle(S, cam, st, 2); const o1 = [...st.off]; S.hold = false; settle(S, cam, st, 2);
      line(o0[0] === o1[0] && o0[1] === o1[1] && Math.hypot(st.off[0] - o1[0], st.off[1] - o1[1]) > 1, '4 a button down: the frame does not move, and goes on when it is let go', `the shift ${f2(o0[0])}, ${f2(o0[1])} → under the button ${f2(o1[0])}, ${f2(o1[1])} → let go ${f2(st.off[0])}, ${f2(st.off[1])}`); }
    { const cam = cam0(), open = () => false, sub = up(cam, -6), base = { door: { at: sub, w: 1 }, still: true };
      const ask = (o: Record<string, unknown> = {}, secs = 1, st = begin(cam)) => { let g: number | null = null; const S = scene({ ...base, ...o } as any); for (let i = 0; i < secs * 60 && g == null; i++) g = A.turnGoal(st, S, cam, DT, open); return { g, st }; };
      const yes = ask(), g = yes.g, c2 = cam0(); if (g != null) c2.yaw = g; c2.rebuild(); const B2 = c2.planarBasis(), dot = ((sub[0] - 20) * B2.fwd[0] + (sub[2] - 14) * B2.fwd[2]) / 6;
      const early = ask({}, K.still - 0.1).g, walk = ask({ still: false }).g, hold = ask({ hold: true }).g, man = ask({ threats: [up(cam, 5)] }).g, shot = ask({ firedAgo: 1 }).g, busy = ask({ free: false }).g, ahead = ask({ door: { at: up(cam, 6), w: 1 } }).g;
      K.turn = false; const off = ask().g; K.turn = true;
      yes.st.turnT = 0; let again: number | null = null; for (let i = 0; i < (K.gap - 0.2) * 60; i++) again = again ?? A.turnGoal(yes.st, scene(base as any), cam, DT, open); let later: number | null = null; for (let i = 0; i < 30; i++) later = later ?? A.turnGoal(yes.st, scene(base as any), cam, DT, open);
      line(g != null && dot > 0.9 && Math.abs(Math.abs(wrap(g! - cam.yaw)) - (Math.PI - K.skew)) < 1e-6 && early == null && walk == null && hold == null && man == null && shot == null && busy == null && ahead == null && off == null && again == null && later != null,
        '5 the thing framed on the lens\'s side, his feet still: a turn is asked and lands with it up the screen; none in any other case',
        `asked: ${g == null ? 'NONE ✗' : `${deg(wrap(g - cam.yaw))}° round, the thing then ${f2(dot)} up the screen`} · before ${K.still} s still ${early == null ? 'none' : 'TURNS'} · walking ${walk == null ? 'none' : 'TURNS'} · a button down ${hold == null ? 'none' : 'TURNS'} · a man he could shoot ${man == null ? 'none' : 'TURNS'} · a second after a shot ${shot == null ? 'none' : 'TURNS'} · his hands busy ${busy == null ? 'none' : 'TURNS'} · the thing up the screen already ${ahead == null ? 'none' : 'TURNS'} · turn off ${off == null ? 'none' : 'TURNS'} · inside the gap ${again == null ? 'none' : 'TURNS'}, after it ${later != null ? 'asked' : 'NONE ✗'}`); }
    { const cam = cam0(), sx = Math.sin(cam.yaw), cz = Math.cos(cam.yaw), wall = (a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz); return d > 0.9 && (dx * sx + dz * cz) / d > 0.9; };   // (something a metre from him, toward the lens)
      const st = begin(cam); let g: number | null = null; for (let i = 0; i < 60 && g == null; i++) g = A.turnGoal(st, scene({ still: true }), cam, DT, wall);
      const st2 = begin(cam); let none: number | null = null; for (let i = 0; i < 60; i++) none = none ?? A.turnGoal(st2, scene({ still: true }), cam, DT, () => false);
      line(g != null && Math.abs(Math.abs(wrap(g! - cam.yaw)) - Math.PI / 4) < 1e-6 && none == null, '6 a wall between the lens and him: the least turn that clears him, and none with the line clear', `a wall a metre toward the lens: ${g == null ? 'NO turn ✗' : `${deg(wrap(g - cam.yaw))}°`} · the line clear: ${none == null ? 'none' : 'TURNS ✗'}`); }

    // ------------------------------------------------------------ the loop
    const tapper = () => { let tap = false; return { ctrlTwice: () => { const v = tap; tap = false; return v; }, tap: () => { tap = true; } }; };
    const run = (ctx: any, n: number, each?: () => void) => { for (let i = 0; i < n; i++) { each?.(); stepFrame(ctx, DT); } };
    // 7 as it was
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        const one = async (on: boolean) => { F.setAutoView(false); FIXEDSTEP.on = fixed; const W = await stand(7), ctx = ctxOf(W); K.on = on; run(ctx, 20);
          for (let i = 0; i < 240; i++) { const I = W.input; I.keys.clear(); if (i < 90) I.keys.add('KeyW'); else if (i < 170) I.keys.add('KeyD'); if (i === 100) I.orbitDX = 40; if (i === 200) I.wheelCtrl = 120; stepFrame(ctx, DT); }
          return { d: digestGame(W.game), v: [...W.cam.viewProj].join(','), reads: ST.reads }; };
        const r0 = ST.reads, a = await one(false), b = await one(true), diff = diffDigest(a.d, b.d), same = !diff.length && a.v === b.v && b.reads === r0; if (!same) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: 4 s of a scripted hand, the switch off and on with the mode never put on: ${diff.length ? `the games DIFFER (${diff.slice(0, 2).join('; ')})` : 'the same game'}, ${a.v === b.v ? 'the same view to the bit' : 'the views DIFFER'}, ${b.reads - r0} scene reads`); }
      line(ok, '7 CONTROL — the switch on and the mode never put on: the build as it was', rows.join('\n    ')); }
    // 8 the mode
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        F.setAutoView(false); F.setFindMe('behind', false); FIXEDSTEP.on = fixed; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), I = W.input; K.on = !BREAK; run(ctx, 10);
        const off0 = Math.abs(wrap(W.cam.yaw - F.behindYaw(W.game.player.char.aimYaw))); const a0 = W.game.player.char.aimYaw; T.tap(); run(ctx, 90);
        const on1 = AUTOVIEW.on, round = Math.abs(wrap(W.cam.yaw - F.behindYaw(a0))) < 1e-6 && off0 > 0.2;
        I.camHeld = 'Space'; I.orbitDX = 5; run(ctx, 1); I.orbitDX = -4; run(ctx, 1); I.camHeld = ''; run(ctx, 40);
        for (let n = 0; n < 2; n++) { I.camHeld = 'Space'; I.orbitDX = 7; run(ctx, 2); I.camHeld = ''; run(ctx, 4); } run(ctx, 40); const tremor = AUTOVIEW.on;   // (…and two taps with seven pixels in each: the travel is one hold's)
        const own = ctx.auto ? ctx.auto.base : NaN; W.cam.desiredDistance = own * 1.3; if (ctx.auto) ctx.auto.goal = own * 1.3;   // (as if the mode had zoomed out to hold something)
        I.camHeld = 'Space'; I.orbitDX = 9; run(ctx, 1); I.orbitDX = 9; run(ctx, 1); I.camHeld = ''; const hand = !AUTOVIEW.on; run(ctx, 30); const zoomBack = Math.abs(W.cam.desiredDistance - own) < 1e-9;
        T.tap(); run(ctx, 60); const on2 = AUTOVIEW.on;
        I.camHeld = 'Space'; run(ctx, 30); const keyAlone = AUTOVIEW.on; I.keys.add('KeyW'); run(ctx, 10); const short = AUTOVIEW.on; run(ctx, 15); const walked = !AUTOVIEW.on; I.camHeld = ''; run(ctx, 10);
        // two taps with a walk key held: each press is shorter than `holdSecs`, and the second one's coming up puts the mode on
        I.camHeld = 'Space'; run(ctx, 4); I.camHeld = ''; run(ctx, 5); I.camHeld = 'Space'; run(ctx, 4); I.camHeld = ''; T.tap(); run(ctx, 30); const on3 = AUTOVIEW.on; I.keys.clear(); run(ctx, 5);
        // under the pause card and under a pin the taps are nobody's
        F.setAutoView(false); let frozen = false; ctx.frozen = () => frozen; frozen = true; T.tap(); run(ctx, 1); frozen = false; run(ctx, 20); const card = !AUTOVIEW.on;
        // …and where the mode would frame nothing (plan mode's point has the view) the tap is not its
        W.game.orders.plan.up = true; T.tap(); run(ctx, 1); W.game.orders.plan.up = false; run(ctx, 5); const plan = !AUTOVIEW.on;
        const good = on1 && round && tremor && hand && on2 && keyAlone && short && walked && on3 && card && zoomBack && plan; if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: tapped twice ${on1 ? 'ON' : 'off ✗'}, the view ${round ? 'comes round to where he looked' : 'does NOT come round ✗'} (it was ${deg(off0)}° off) · a tremor of 5 px under the key, then two taps with 7 px in each, ${tremor ? 'leaves it on' : 'puts it OFF ✗'} · 18 px ${hand ? 'puts it off' : 'leaves it ON ✗'} and the zoom ${zoomBack ? 'goes back to the hand\'s own' : 'does NOT go back ✗'} · tapped twice ${on2 ? 'on' : 'OFF ✗'} · the key held alone ${keyAlone ? 'on' : 'OFF ✗'}, with a walk key for 0.17 s ${short ? 'on' : 'OFF ✗'}, for 0.4 s ${walked ? 'off' : 'ON ✗'} · two taps with a walk key held ${on3 ? 'on' : 'OFF ✗'} · tapped under the pause card ${card ? 'nothing' : 'ON ✗'}, with plan mode up ${plan ? 'nothing' : 'ON ✗'}`); }
      line(ok, '8 the camera\'s key tapped twice puts the mode on and brings the view round; the hand on the camera puts it off', rows.join('\n    ')); }
    // 9 a door
    { F.setAutoView(false); FIXEDSTEP.on = true; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), I = W.input, g = W.game, c = g.player.char, nav = g.col.nav; K.on = !BREAK; run(ctx, 10);
      // a door with five metres of clear floor square to one face of it
      let spot: { d: any; n: [number, number]; at: number[] } | null = null;
      for (const d of g.doors.list) { const th = d.def.closedDir, n: [number, number] = [-Math.sin(th), Math.cos(th)], fc = d.frameCentre;
        for (const s of [1, -1]) { let clear = true; for (let m = 0.8; m <= 5 && clear; m += 0.25) if (nav.isBlocked(fc[0] + n[0] * s * m, fc[2] + n[1] * s * m)) clear = false;
          if (clear && !spot) spot = { d, n: [n[0] * s, n[1] * s], at: [fc[0] + n[0] * s * 4.5, 0, fc[2] + n[1] * s * 4.5] }; } }
      if (!spot) line(false, '9 a door', 'no door on this floor has five clear metres square to it');
      else {
        const put = (m: number) => { const fc = spot!.d.frameCentre; c.pos[0] = fc[0] + spot!.n[0] * m; c.pos[2] = fc[2] + spot!.n[1] * m; c.vel[0] = c.vel[2] = 0; W.cam.target = [c.pos[0], 0, c.pos[2]]; W.cam.desired = [c.pos[0], 0, c.pos[2]]; };
        const toDoor = () => Math.atan2(spot!.n[0], spot!.n[1]);   // (the yaw of a view that looks from him at the door: the camera's yaw 0 looks toward −Z, and the door lies along −n)
        put(4.5); W.cam.yaw = toDoor() + 0.2; W.cam.rebuild(); I.keys.clear(); run(ctx, 5); T.tap(); run(ctx, 5); ctx.behind = null; W.cam.yaw = toDoor() + 0.2; run(ctx, 30);
        const turns0 = ST.turns; I.keys.add('KeyW'); let lead = 0, had = false; run(ctx, 70, () => { const S = ctx.auto?.scene; if (S?.door) had = true; });
        { const L = W.cam.desired, toward = -((L[0] - c.pos[0]) * spot.n[0] + (L[2] - c.pos[2]) * spot.n[1]); lead = toward; }
        const walkTurns = ST.turns - turns0, sy = W.cam.project([c.pos[0], 0, c.pos[2]], 1600, 1000)[1];
        // standing by it with the lens on the door's side of him: the view comes round, and he looks where he looked
        I.keys.clear(); put(1.6); W.cam.yaw = toDoor() + Math.PI - 0.3; W.cam.rebuild(); run(ctx, 2); ctx.carry = null; W.cursorAt([c.pos[0] + spot.n[0] * 3.2 + spot.n[1] * 0.3, 0, c.pos[2] + spot.n[1] * 3.2 - spot.n[0] * 0.3]); if (ctx.auto) ctx.auto.turnT = 0; run(ctx, 120);   // (the cursor on open floor on his own side — a point past the wall is aimed at through whichever face the view shows — and his aim at rest on it before anything turns)
        const aim0 = c.aimYaw, yaw0 = W.cam.yaw, t0 = ST.turns; if (ctx.auto) { ctx.auto.way = { at: [spot.d.frameCentre[0], 0, spot.d.frameCentre[2]], beyond: [spot.d.frameCentre[0] - spot.n[0] * 2.5, 0, spot.d.frameCentre[2] - spot.n[1] * 2.5] }; ctx.auto.turnT = 1e9; }
        let aimAt = aim0, prev = aim0, most = 0; run(ctx, 150, () => { if (ST.turns === t0) aimAt = prev; else most = Math.max(most, Math.abs(wrap(c.aimYaw - aimAt)) * 180 / Math.PI); prev = c.aimYaw; });
        const turned = ST.turns - t0, B = W.cam.planarBasis(), upDot = -(B.fwd[0] * spot.n[0] + B.fwd[2] * spot.n[1]), swung = Math.abs(wrap(c.aimYaw - aimAt)) * 180 / Math.PI;   // (from where he looked as the turn began; `most`: the furthest from it on any tick of the turn)
        line(had && lead > 0.8 && walkTurns === 0 && sy > 400 && sy < 900 && turned === 1 && upDot > 0.85 && swung < 2 && most < 4,
          '9 walking at a way out the look-at runs ahead of him toward the floor past it and nothing turns; standing by it with the lens on its side the view comes round and his aim stays',
          `walking at ${spot.d.def.name}: the door ${had ? 'has the frame' : 'is NOT framed ✗'}, the look-at ${f2(lead)} m ahead of him, ${walkTurns} turns, his feet ${sy.toFixed(0)} of 1000 down the screen · stood 1.6 m from it, the lens on its side: ${turned} turn(s), ${deg(wrap(W.cam.yaw - yaw0))}° round, the door now ${f2(upDot)} up the screen, his aim ${swung.toFixed(2)}° off at the end and ${most.toFixed(2)}° at the most on the way`); } }
    // 10 a man
    { F.setAutoView(false); FIXEDSTEP.on = true; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), g = W.game, c = g.player.char; K.on = !BREAK; run(ctx, 10); T.tap(); run(ctx, 90);
      const gd = g.guards.find((x: any) => x.state !== 'dead' && x.team !== 'operative' && x.team !== 'civilian'); let at: number[] | null = null;
      for (let a = 0; a < 16 && !at; a++) { const q = [c.pos[0] + Math.sin(a * Math.PI / 8) * 6, 0, c.pos[2] + Math.cos(a * Math.PI / 8) * 6]; if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([c.pos[0], 1.5, c.pos[2]], [q[0], 1.3, q[2]])) at = q; }
      if (!gd || !at) line(false, '10 a man', 'no hostile man, or no clear six metres round the start');
      else {
        for (const o of g.guards) if (o !== gd && o.state !== 'dead') { o.char.pos[0] = 1; o.char.pos[2] = 1; }   // (everybody else out of his line)
        const hold = () => { gd.char.pos[0] = at![0]; gd.char.pos[2] = at![2]; }; run(ctx, 120, hold);
        const seen = ctx.auto?.scene?.threats.length ?? 0, L = W.cam.desired, d = Math.hypot(at[0] - c.pos[0], at[2] - c.pos[2]), toward = ((L[0] - c.pos[0]) * (at[0] - c.pos[0]) + (L[2] - c.pos[2]) * (at[2] - c.pos[2])) / d;
        const fog = g.fogOfWar, hidden0 = fog.hidden; fog.hidden = (x: any) => x === gd; run(ctx, 150, hold); fog.hidden = hidden0;
        const seenFog = ctx.auto?.scene?.threats.length ?? 0, L2 = W.cam.desired, toward2 = ((L2[0] - c.pos[0]) * (at[0] - c.pos[0]) + (L2[2] - c.pos[2]) * (at[2] - c.pos[2])) / d;
        line(seen === 1 && toward > 1 && seenFog === 0 && toward2 < toward - 1, '10 a hostile man in his line takes the frame; the same man hidden by the fog takes nothing',
          `${gd.callsign ?? 'a guard'} six metres off in his line: ${seen} framed, the look-at ${f2(toward)} m toward him · the fog hides him: ${seenFog} framed, the look-at ${f2(toward2)} m toward where he is`); } }
    // 11 others'
    { F.setAutoView(false); FIXEDSTEP.on = true; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), g = W.game, c = g.player.char; K.on = !BREAK; run(ctx, 10); T.tap(); run(ctx, 90);
      const far = () => Math.hypot(W.cam.desired[0] - c.pos[0], W.cam.desired[2] - c.pos[2]);
      const lean = () => { if (ctx.auto) ctx.auto.way = { at: [c.pos[0] + 1, 0, c.pos[2]], beyond: [c.pos[0] + 4, 0, c.pos[2]] }; };
      run(ctx, 90, lean); const on = far(), r0 = ST.reads;
      W.cam.setPin({ look: [c.pos[0], 0, c.pos[2]], yaw: 0.3, pitch: 0.9, dist: 20 }); run(ctx, 30, lean); const pinReads = ST.reads - r0; W.cam.setPin(null); run(ctx, 2);
      const r1 = ST.reads, other = g.guards.findIndex((x: any) => x.state !== 'dead'); g.spectate = other; run(ctx, 30, lean); const planReads = ST.reads - r1, gp = g.guards[other].char.pos, planOn = Math.hypot(W.cam.desired[0] - gp[0], W.cam.desired[2] - gp[2]) < 1e-6; g.spectate = -1;
      g.orders.plan.up = true; const planFree = A.autoFree(g); g.orders.plan.up = false; const free = A.autoFree(g);
      run(ctx, 90, lean); const again = far();
      line(on > 1 && pinReads === 0 && planReads === 0 && planOn && !planFree && free && again > 1 && AUTOVIEW.on, '11 a pin, a spectated man, plan mode: the mode frames nothing and the view is theirs; it frames again when the view is his',
        `a way out beside him: the look-at ${f2(on)} m from his feet · under a pin ${pinReads} scene reads · a spectated man ${planReads} reads, the look-at ${planOn ? 'on him' : 'NOT on him ✗'} · plan mode up: the view ${planFree ? 'still asked for ✗' : 'not asked for'} · after: ${f2(again)} m, the mode ${AUTOVIEW.on ? 'still on' : 'OFF ✗'}`); }
    // 12 reads
    { const one = async (reads: boolean) => { F.setAutoView(false); FIXEDSTEP.on = true; const W = await stand(9), ctx = ctxOf(W), st = A.autoCam(); K.on = false; W.game.aiEnabled = true;
        for (let i = 0; i < 360; i++) { const I = W.input; I.keys.clear(); if (i < 150) I.keys.add('KeyW'); else if (i < 260) I.keys.add('KeyA'); stepFrame(ctx, DT); if (reads) A.autoRead(st, W.game, I, DT); }
        return digestGame(W.game); };
      const a = await one(false), b = await one(true), diff = diffDigest(a, b);
      line(!diff.length, '12 CONTROL — the scene read every frame of a run and never used: the same game', diff.length ? `the games DIFFER: ${diff.slice(0, 3).join('; ')}` : '6 s, the guards awake, a walk through the floor: the same digest with 360 reads as with none'); }
    // 13 plumbing
    { const W = await stand(5), g = W.game, E = process.env, shipped = E.TPS_PROFILE === 'shipped', row = FROZEN_HOLDS['AUTOCAM.on'], want = E.TPS_AUTOCAM !== undefined ? E.TPS_AUTOCAM === '1' : shipped;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))); const isOn = (): boolean => K.on;
      K.on = true; const old = snap(), had = !!old.tables.AUTOCAM; delete old.tables.AUTOCAM; J.applyKnobs(g, old); const before = isOn();
      K.on = true; const on = snap(); K.on = false; J.applyKnobs(g, on); const kept = isOn(); K.on = false; const offS = snap(); K.on = true; J.applyKnobs(g, offS); const keptOff = isOn();
      line(had && before === false && kept === true && keptOff === false && STOOD.on === want && (STAND_ENV as string[]).includes('TPS_AUTOCAM') && typeof row === 'string' && row.startsWith('TPS_AUTOCAM=1') && (shipped || E.TPS_AUTOCAM !== undefined || found === false),
        `13 CONTROL — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the switch ${want ? 'on' : 'off'} by its words, FROZEN_HOLDS carries its row, and a recording from before the key replays with it off`,
        `stood ${STOOD.on} (wanted ${want}; the runner found ${found}) · row: '${row}' · a recording carries the table ${had} · from before the key: ${before} · recorded on: ${kept} · recorded off: ${keptOff}`); }
    // ------------------------------------------------------------ the sway (AUTOCAM.sway)
    // 14 from scenes handed to it
    { const open = () => false, go = (S: any, cam: any, st: any, secs: number, blocked: (a: number[], b: number[]) => boolean = open) => { let most = 0, first = NaN; for (let i = 0; i < secs * 60; i++) { const t = A.autoSway(st, S, cam, DT, blocked as any); cam.rotate(t); cam.rebuild(); if (i === 0) first = Math.abs(t); most = Math.max(most, Math.abs(t)); } return { most, first }; };
      K.sway = !SWAYBREAK; const cam = cam0(), st = begin(cam), y0 = cam.yaw, B0 = cam.planarBasis(), cap = K.swayRate * DT + 1e-12;
      const man: [number, number, number] = [20 + (B0.fwd[0] * 0.5 + B0.right[0] * 0.866) * 8, 0, 14 + (B0.fwd[2] * 0.5 + B0.right[2] * 0.866) * 8];   // (sixty degrees round from up the screen)
      const ahead = () => { const B = cam.planarBasis(); return ((man[0] - 20) * B.fwd[0] + (man[2] - 14) * B.fwd[2]) / 8; }, a0 = ahead();
      const r1 = go(scene({ threats: [man] }), cam, st, 5), lean = Math.abs(wrap(cam.yaw - y0)), a1 = ahead();
      const lingered = (go(scene({}), cam, st, 1), Math.abs(wrap(cam.yaw - y0)) > lean - 0.02); go(scene({}), cam, st, 10); const back = Math.abs(cam.yaw - y0) < 1e-12;   // (a second after the last of them is gone it has not let go: `swayLinger`)
      const r3 = go(scene({ vel: [B0.right[0] * 2.5, B0.right[2] * 2.5] }), cam, st, 4), B2 = cam.planarBasis(), mv = Math.abs(wrap(cam.yaw - y0)), toward = B2.fwd[0] * B0.right[0] + B2.fwd[2] * B0.right[2];
      go(scene({}), cam, st, 7); const back2 = Math.abs(cam.yaw - y0) < 1e-12;
      const walkS = go(scene({ vel: [B0.fwd[0] * -2.5, B0.fwd[2] * -2.5] }), cam, st, 3).most;   // (straight down the screen: no side to lean to)
      go(scene({ threats: [man] }), cam, st, 0.7); const yh = cam.yaw, r4 = go(scene({ threats: [man], hold: true }), cam, st, 2), drift = Math.abs(wrap(cam.yaw - yh)), still = go(scene({ threats: [man], hold: true }), cam, st, 1).most;
      go(scene({}), cam, st, 10); const back3 = Math.abs(cam.yaw - y0) < 1e-12;
      const wall = (a: number[], b: number[]) => Math.abs(wrap(Math.atan2(b[0] - a[0], b[2] - a[2]) - y0)) > 0.2;   // (a wall hides him from any view more than a fifth of a radian round)
      go(scene({ threats: [man] }), cam, st, 5, wall); const walled = Math.abs(wrap(cam.yaw - y0));
      go(scene({}), cam, st, 12); const back4 = Math.abs(cam.yaw - y0) < 1e-12; K.sway = false; const off = go(scene({ threats: [man] }), cam, st, 3).most; K.sway = !SWAYBREAK;   // (home first: the switch put off across a lean leaves the view where it is)
      // shots tapped one after another are one stop; men gone round behind the lens to the other side do not flip the side it took
      go(scene({}), cam, st, 10); go(scene({ threats: [man] }), cam, st, 0.7); go(scene({ threats: [man], hold: true }), cam, st, 0.4); const yt = cam.yaw;
      for (let n = 0; n < 10; n++) { go(scene({ threats: [man], hold: true }), cam, st, 0.05); go(scene({ threats: [man] }), cam, st, 0.15); } const taps = Math.abs(wrap(cam.yaw - yt));
      go(scene({}), cam, st, 12); const at = (a: number): [number, number, number] => [20 + (B0.fwd[0] * Math.cos(a) + B0.right[0] * Math.sin(a)) * 8, 0, 14 + (B0.fwd[2] * Math.cos(a) + B0.right[2] * Math.sin(a)) * 8];
      go(scene({ threats: [at(100 * Math.PI / 180)] }), cam, st, 5); const s1 = wrap(cam.yaw - y0); const rk = go(scene({ threats: [at(-170 * Math.PI / 180)] }), cam, st, 5), s2 = wrap(cam.yaw - y0); go(scene({ threats: [at(-60 * Math.PI / 180)] }), cam, st, 6); const s3 = wrap(cam.yaw - y0);
      const sideKept = Math.abs(s1) > 0.5 && Math.sign(s2) === Math.sign(s1) && Math.abs(s2) > 0.5 && Math.sign(s3) === -Math.sign(s1) && rk.most <= cap;
      line(lean > 30 * Math.PI / 180 && lean < 38.5 * Math.PI / 180 && a1 > a0 + 0.3 && r1.most <= cap && r1.first < 0.2 * cap && lingered && back && mv > 0.15 && mv <= K.swayMove + 1e-6 && toward > 0.1 && r3.most <= cap && back2 && walkS === 0 && drift < 0.05 && r4.most <= cap && still === 0 && back3 && walled < 0.01 && back4 && off === 0 && taps < 1e-3 && sideKept,
        '14 the sway: a fight to one side and the yaw leans toward it by a spring, never faster than its cap; the side he moves to, the same; both go back to the hand\'s yaw; a button stops it; no view that hides him',
        `men 60° round: the yaw leans ${deg(lean)}° (they come from ${f2(a0)} to ${f2(a1)} up the screen), the first step ${(r1.first / cap * 100).toFixed(0)}% of the cap and the most ${(r1.most / cap * 100).toFixed(0)}%, then gone: ${lingered ? 'kept for a second' : 'let go AT ONCE ✗'} and then ${back ? 'home to the bit' : 'NOT home ✗'} · across the view at 2.5 m/s: ${deg(mv)}° ${toward > 0 ? 'toward that side' : 'AWAY ✗'}, then ${back2 ? 'home' : 'NOT home ✗'}; straight down the screen ${walkS === 0 ? 'nothing' : 'TURNS ✗'} · a button down mid-turn: ${deg(drift)}° more and then ${still === 0 ? 'still' : 'MOVING ✗'}, ${back3 ? 'home after' : 'NOT home ✗'} · a wall that would hide him: ${deg(walled)}° · the switch off: ${off === 0 ? 'nothing' : 'TURNS ✗'} · ten shots tapped over two seconds: ${deg(taps)}° · men 100° round one way, then 170° round the other, then 60°: ${deg(s1)}°, ${deg(s2)}°, ${deg(s3)}° ${sideKept ? '' : '✗'}`); }
    // 15 a real man to one side, through the loop
    { const rows: string[] = []; let ok = true;
      for (const on of [true, false]) {
        F.setAutoView(false); FIXEDSTEP.on = true; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), g = W.game, c = g.player.char; K.on = !BREAK; K.turn = false; K.sway = on && !SWAYBREAK; run(ctx, 10); T.tap(); run(ctx, 90);
        const gd = g.guards.find((x: any) => x.state !== 'dead' && x.team !== 'operative' && x.team !== 'civilian'); let at: number[] | null = null;
        for (let a = 0; a < 32 && !at; a++) { const q = [c.pos[0] + Math.sin(a * Math.PI / 16) * 6, 0, c.pos[2] + Math.cos(a * Math.PI / 16) * 6], round = Math.abs(wrap(Math.atan2(q[0] - c.pos[0], q[2] - c.pos[2]) + Math.PI - W.cam.yaw));
          if (round > 0.7 && round < 2.2 && !g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([c.pos[0], 1.5, c.pos[2]], [q[0], 1.3, q[2]])) at = q; }
        if (!gd || !at) { ok = false; rows.push('no hostile man, or no clear six metres to one side of the view'); continue; }
        for (const o of g.guards) if (o !== gd && o.state !== 'dead') { o.char.pos[0] = 1; o.char.pos[2] = 1; }
        const y0 = W.cam.yaw, cap = K.swayRate * DT + 1e-12, up = () => { const B = W.cam.planarBasis(); return ((at![0] - c.pos[0]) * B.fwd[0] + (at![2] - c.pos[2]) * B.fwd[2]) / 6; }, u0 = up();
        let most = 0, prev = y0; const hold = () => { gd.char.pos[0] = at![0]; gd.char.pos[2] = at![2]; most = Math.max(most, Math.abs(wrap(W.cam.yaw - prev))); prev = W.cam.yaw; };
        run(ctx, 300, hold); const lean = Math.abs(wrap(W.cam.yaw - y0)), u1 = up(), seen = ctx.auto?.scene?.threats.length ?? 0;
        const fog = g.fogOfWar, hidden0 = fog.hidden; fog.hidden = (x: any) => x === gd; run(ctx, 660, hold); fog.hidden = hidden0; const home = Math.abs(W.cam.yaw - y0) < 1e-9;
        const good = on ? seen === 1 && lean > 0.17 && u1 > u0 + 0.05 && most <= cap && home && AUTOVIEW.on : most === 0 && lean === 0 && seen === 1; if (!good) ok = false;
        rows.push(on ? `the sway on: ${gd.callsign ?? 'a guard'} six metres off to one side (${seen} in his line): the yaw leans ${deg(lean)}° toward him (from ${f2(u0)} to ${f2(u1)} up the screen), ${(most / cap * 100).toFixed(0)}% of the cap at the most in a tick · the fog hides him: ${home ? 'home' : 'NOT home ✗'}`
          : `the sway off, the same man: the yaw ${most === 0 ? 'never moves' : 'MOVES ✗'}`); }
      line(ok, '15 a hostile man to one side of the view: the yaw leans toward him tick by tick, never faster than the cap, and comes home when he is gone from the picture; with the sway off it never moves', rows.join('\n    ')); }
    // 16 the sway's plumbing
    { const W = await stand(5), g = W.game, E = process.env, shipped = E.TPS_PROFILE === 'shipped', row = FROZEN_HOLDS['AUTOCAM.sway'], want = E.TPS_AUTOSWAY !== undefined ? E.TPS_AUTOSWAY === '1' : shipped;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), isOn = (): boolean => K.sway;
      K.sway = true; const old = snap(), had = old.tables.AUTOCAM?.sway === true; delete old.tables.AUTOCAM.sway; J.applyKnobs(g, old); const before = isOn();
      K.sway = true; const on = snap(); K.sway = false; J.applyKnobs(g, on); const kept = isOn();
      line(had && before === false && kept === true && stoodSway === want && (STAND_ENV as string[]).includes('TPS_AUTOSWAY') && typeof row === 'string' && row.startsWith('TPS_AUTOSWAY=1'),
        `16 CONTROL — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the sway ${want ? 'on' : 'off'} by its words, FROZEN_HOLDS carries its row, and a recording from before the key replays with it off`,
        `stood ${stoodSway} (wanted ${want}) · row: '${row}' · a recording carries the key ${had} · from before the key: ${before} · recorded on: ${kept}`); }
  } finally {
    knobsBack(knobs0); Math.random = rnd0; FIXEDSTEP.on = fixedWas; F.setAutoView(viewWas); F.setFindMe('behind', behindWas);
  }
  console.log(`=== autocam: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}

if (import.meta.main) process.exit(await autocamCheck() ? 0 : 1);
