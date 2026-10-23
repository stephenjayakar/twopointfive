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
// THE HAND'S OWN TUNING (AUTOCAM.tune; lines 1 to 16 run with it off, on the numbers as built):
//  17 modes      off = every number the module's whatever is chosen; on = the gentle mode where nobody has chosen, each mode its numbers, a row moved is
//                the player's own and put back is the mode's again, a table written from outside is not shown as the mode's, what is kept reads back
//                held to what a row can be put to (and a line that is not one is refused whole), reset
//  18 calmer     gentle makes no turn at rest for a thing on the lens's side and still makes one for a wall, and each reason has its own row; an eased
//                turn starts from rest, never passes its top speed, has no step in it, lands on the yaw asked without going past, every notch of its
//                speed is a quicker turn, a goal gone to the other side or a faster turn handed on is braked without a step, and one ended midway dies
//                away; a lean speed over the one as built is reached, and a fight's lean at none leans nothing for his walk; the frame's share and the
//                zoom's share scale the lean and the travel, to none
//  19 the loop   the whole Game: with the swing off the double tap puts the mode on and turns nothing, with it on the view comes round eased, and a
//                shot ends a slow swing where it is; a wall hiding him brings the view round by the eased turn, tick by tick under its top speed,
//                though the mouse moves; a walk key ends it without a step, and the next turn waits out the gap from there
//  20 plumbing   the two stands by their words, the FROZEN_HOLDS rows, a recording from before the key (CONTROL)
//  21 the lock   (AUTOCAM.lock) a man who is not onto him holds the frame by how near he is: the look-at goes to the middle of the two and the camera
//                comes in by `lockIn`, more the stronger the lock, from rest and with no step; a held button stills it and a stalk's held click does
//                not; a second man he could shoot is never zoomed out of the picture; `lockIn` at none comes in nowhere; off = the frame as it was
//  22 the loop   the whole Game: a man in his line who is not onto him, closed on in stages: the camera comes in at each, never by a step; the man
//                onto him, it goes back out (it never comes in on a fight); a plain held button stills it
//  23 plumbing   the two stands by their words, the FROZEN_HOLDS row, a recording from before the key (CONTROL)
// AUTOCAM_BREAK=1 = the switch left off: lines 8, 9, 10, 11 (and 15, 19, 22) must FAIL.   AUTOTUNE_BREAK=1 = the tuning left off: 17, 18 and 19 must
// FAIL.   AUTOLOCK_BREAK=1 = the soft lock left off: 21 and 22 must FAIL.
// exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

export async function autocamCheck(): Promise<boolean> {
  const BREAK = process.env.AUTOCAM_BREAK === '1', SWAYBREAK = process.env.AUTOSWAY_BREAK === '1', TUNEBREAK = process.env.AUTOTUNE_BREAK === '1', LOCKBREAK = process.env.AUTOLOCK_BREAK === '1';
  const { stepFrame, FIXEDSTEP } = await import(`${ROOT}/src/host/loop.ts`);
  const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);
  const A = await import(`${ROOT}/src/host/autocam.ts`) as typeof import('../../src/host/autocam.ts');
  const F = await import(`${ROOT}/src/host/findme.ts`) as typeof import('../../src/host/findme.ts');
  const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
  const J: any = await import(`${ROOT}/src/game/journal.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const { isHostile } = await import(`${ROOT}/src/game/teams.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const { AUTOCAM: K, AUTOCAM_STATS: ST } = A, { AUTOVIEW, FINDME } = F;
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== autocam: the camera's key tapped twice and the camera frames things itself${BREAK ? ' (the switch left off: 8, 9, 10, 11, 15, 19 and 22 must fail)' : ''}${LOCKBREAK ? ' (the soft lock left off: 21 and 22 must fail)' : ''}${SWAYBREAK ? ' (the sway left off: 14 and 15 must fail)' : ''}${TUNEBREAK ? ' (the tuning left off: 17, 18 and 19 must fail)' : ''} ===`);
  const knobs0 = knobsCopy(), rnd0 = Math.random, fixedWas = FIXEDSTEP.on, viewWas = AUTOVIEW.on, behindWas = FINDME.behind, found = K.on;
  const DT = 1 / 60, f2 = (v: number) => v.toFixed(2), deg = (r: number) => (r * 180 / Math.PI).toFixed(1), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const ctxOf = (W: any, extra: Record<string, unknown> = {}): any => ({ game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); },
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true, ...extra });
  const stand = async (seed: number) => { Math.random = seeded(1); const W: any = await standUp({ seed }); W.game.godMode = true; W.game.aiEnabled = false; if (stoodSway === null) stoodSway = K.sway; K.sway = false; if (stoodTune === null) stoodTune = K.tune; K.tune = false; A.autoTuneApply(); if (stoodLock === null) stoodLock = K.lock; K.lock = false; return W; };   // (the sway is off for every line but its own: 1 to 13 are the turn rule as it was built)
  let stoodTune: boolean | null = null; const tune0 = JSON.parse(JSON.stringify(A.AUTOTUNE));   // (the tuning is off for every line but its own, 17 to 20; the mode and rows as found are put back at the end)
  let stoodLock: boolean | null = null;   // (the soft lock is off for every line but its own, 21 to 23)
  let stoodSway: boolean | null = null;   // (as the first stand of the run left it: this stand's own word)
  try {
    const STOOD = { on: false }; { await stand(5); STOOD.on = K.on; }
    // ------------------------------------------------------------ the frame, from scenes handed to it
    const cam0 = () => { const c = new FollowCamera(); c.aspect = 1.6; c.target = [20, 0, 14]; c.desired = [20, 0, 14]; c.rebuild(); return c; };
    const scene = (o: Partial<import('../../src/host/autocam.ts').AutoScene> = {}): import('../../src/host/autocam.ts').AutoScene => ({ sam: [20, 0, 14], threats: [], beat: null, door: null, room: null, zoomK: 1, hold: false, still: false, free: true, vel: [0, 0], fight: o.threats ?? [], shown: 0, zoomFree: true, firedAgo: 100, ...o });
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
    { const open = () => false;
      // (every step of every case below goes through `go`: the most the yaw moved in a step, and the most that changed from one step to the next)
      let mostAll = 0, jerkAll = 0, last = 0;
      const go = (S: any, cam: any, st: any, secs: number, blocked: (a: number[], b: number[]) => boolean = open) => { let most = 0, first = NaN, flips = 0, dir = 0; for (let i = 0; i < Math.round(secs * 60); i++) { const t = A.autoSway(st, S, cam, DT, blocked as any); cam.rotate(t); cam.rebuild(); if (i === 0) first = Math.abs(t); most = Math.max(most, Math.abs(t)); mostAll = Math.max(mostAll, Math.abs(t)); jerkAll = Math.max(jerkAll, Math.abs(t - last)); last = t; if (Math.abs(t) > 1e-7) { const d = Math.sign(t); if (dir && d !== dir) flips++; dir = d; } } return { most, first, flips }; };
      K.sway = !SWAYBREAK; const cam = cam0(), st = begin(cam), y0 = cam.yaw, B0 = cam.planarBasis(), cap = K.swayRate * DT + 1e-12, home = () => Math.abs(cam.yaw - y0) < 1e-12;
      const at = (a: number, m = 8): [number, number, number] => [20 + (B0.fwd[0] * Math.cos(a) + B0.right[0] * Math.sin(a)) * m, 0, 14 + (B0.fwd[2] * Math.cos(a) + B0.right[2] * Math.sin(a)) * m], D = Math.PI / 180;
      const man = at(60 * D), ahead = () => { const B = cam.planarBasis(); return ((man[0] - 20) * B.fwd[0] + (man[2] - 14) * B.fwd[2]) / 8; }, a0 = ahead();
      const r1 = go(scene({ threats: [man] }), cam, st, 9), lean = Math.abs(wrap(cam.yaw - y0)), a1 = ahead(); go(scene({}), cam, st, 16); const back = home();
      const r3 = go(scene({ vel: [B0.right[0] * 2.5, B0.right[2] * 2.5] }), cam, st, 6), B2 = cam.planarBasis(), mv = Math.abs(wrap(cam.yaw - y0)), toward = B2.fwd[0] * B0.right[0] + B2.fwd[2] * B0.right[2];
      go(scene({}), cam, st, 14); const back2 = home();
      const walkS = go(scene({ vel: [B0.fwd[0] * -2.5, B0.fwd[2] * -2.5] }), cam, st, 3).most;   // (straight down the screen: no side to lean to)
      const inFight = go(scene({ threats: [at(0)], vel: [B0.right[0] * 2.5, B0.right[2] * 2.5] }), cam, st, 4).most; go(scene({}), cam, st, 6);   // (men dead ahead and a walk across: the fight's lean is the only one, and it is none)
      go(scene({ threats: [man] }), cam, st, 1.5); const yh = cam.yaw; go(scene({ threats: [man], hold: true }), cam, st, 2); const drift = Math.abs(wrap(cam.yaw - yh)), still = go(scene({ threats: [man], hold: true }), cam, st, 1).most;
      for (let n = 0; n < 10; n++) { go(scene({ threats: [man], hold: true }), cam, st, 0.05); go(scene({ threats: [man] }), cam, st, 0.15); } const taps = Math.abs(wrap(cam.yaw - yh)) - drift;   // (shots tapped one after another: one stop)
      go(scene({}), cam, st, 16); const back3 = home();
      const wall = (a: number[], b: number[]) => Math.abs(wrap(Math.atan2(b[0] - a[0], b[2] - a[2]) - y0)) > 0.2;   // (a wall hides him from any view more than a fifth of a radian round)
      go(scene({ threats: [man] }), cam, st, 6, wall); const walled = Math.abs(wrap(cam.yaw - y0)); let flick = 0;
      for (let n = 0; n < 20; n++) flick += go(scene({ threats: [man] }), cam, st, 0.5, n % 2 ? wall : open).flips; const flicked = Math.abs(wrap(cam.yaw - y0));   // (that wall there and gone twice a second, as pillars on a walk: the share comes back only after a second clear)
      go(scene({}), cam, st, 16); const back4 = home();
      // men gone round behind the lens to the other side do not flip the side it took; nearer than that they do, through the spring
      go(scene({ threats: [at(100 * D)] }), cam, st, 9); const s1 = wrap(cam.yaw - y0); go(scene({ threats: [at(-170 * D)] }), cam, st, 6); const s2 = wrap(cam.yaw - y0); go(scene({ threats: [at(-60 * D)] }), cam, st, 14); const s3 = wrap(cam.yaw - y0);
      const sideKept = Math.abs(s1) > 0.5 && Math.sign(s2) === Math.sign(s1) && Math.abs(s2) > 0.5 && Math.sign(s3) === -Math.sign(s1);
      go(scene({}), cam, st, 16); const back5 = home();
      // one of two men in and out of the fight each second (longer out than the linger would be), the middle of the men a step from him, and a hand's tremor on the view mid-lean
      let peekFlips = 0, lo = Infinity, hi = -Infinity; for (let n = 0; n < 12; n++) { peekFlips += go(scene({ threats: n % 2 ? [at(60 * D), at(-60 * D)] : [at(60 * D)] }), cam, st, 1).flips; if (n >= 4) { const v = wrap(cam.yaw - y0); lo = Math.min(lo, v); hi = Math.max(hi, v); } }
      go(scene({}), cam, st, 16); const near = go(scene({ threats: [at(90 * D, 1.6)] }), cam, st, 5), nearLean = Math.abs(wrap(cam.yaw - y0)); go(scene({}), cam, st, 14);
      go(scene({ threats: [man] }), cam, st, 2); cam.rotate(0.05); cam.rebuild(); go(scene({ threats: [man] }), cam, st, 3); go(scene({}), cam, st, 16); const handKept = Math.abs(wrap(cam.yaw - y0) - 0.05) < 1e-6; cam.rotate(y0 - cam.yaw); cam.rebuild();
      K.sway = false; const off = go(scene({ threats: [man] }), cam, st, 3).most; K.sway = !SWAYBREAK;
      // SMOOTH is the bar: no step past the cap anywhere above, and no step that differs from the one before it by more than the spring or the stop can make it
      const jerkCap = (K.swayHz * K.swayHz * 2 * K.swayMax + 2 * K.swayHz * K.swayRate) * DT * DT + 1e-12;
      line(lean > 30 * D && lean < 36.5 * D && a1 > a0 + 0.3 && r1.first < 0.2 * cap && back && mv > 0.15 && mv <= K.swayMove + 1e-6 && toward > 0.1 && back2 && walkS === 0 && inFight === 0 && drift < 0.03 && still === 0 && Math.abs(taps) < 1e-3 && back3
        && walled < 0.01 && flicked < 0.01 && flick === 0 && back4 && sideKept && back5 && hi - lo < 8 * D && nearLean < 2 * D && handKept && off === 0 && mostAll <= cap && jerkAll <= jerkCap,
        '14 the sway: the yaw leans toward a fight and toward the side he moves to, by a spring from rest and never past its cap or with a step in it, and goes home to the bit; a button, a wall, a peeking man and a hand\'s tremor do not jolt or rock it',
        `men 60° round: the yaw leans ${deg(lean)}° (they come from ${f2(a0)} to ${f2(a1)} up the screen), the first step ${(r1.first / cap * 100).toFixed(0)}% of the cap, then gone: ${back ? 'home to the bit' : 'NOT home ✗'} · across the view at 2.5 m/s: ${deg(mv)}° ${toward > 0 ? 'toward that side' : 'AWAY ✗'}, then ${back2 ? 'home' : 'NOT home ✗'}; straight down the screen ${walkS === 0 ? 'nothing' : 'TURNS ✗'}; across it with men dead ahead ${inFight === 0 ? 'nothing' : 'TURNS ✗'}`
        + `\n    a button down mid-lean: ${deg(drift)}° more and then ${still === 0 ? 'still' : 'MOVING ✗'}; ten shots tapped over two seconds: ${deg(Math.abs(taps))}° more; ${back3 ? 'home after' : 'NOT home ✗'} · a wall that would hide him: ${deg(walled)}°; there and gone twice a second for ten: ${deg(flicked)}°, ${flick} changes of direction; ${back4 ? 'home' : 'NOT home ✗'}`
        + `\n    men 100° round one way, then 170° round the other, then 60°: ${deg(s1)}°, ${deg(s2)}°, ${deg(s3)}° ${sideKept ? '' : '✗'} · one of two men in and out each second: the yaw moves over ${deg(hi - lo)}° with ${peekFlips} changes of direction in twelve seconds · the men's middle 1.6 m from him: ${deg(nearLean)}° · the view turned 2.9° by hand mid-lean: ${handKept ? 'kept when it comes home' : 'UNDONE ✗'} · the switch off: ${off === 0 ? 'nothing' : 'TURNS ✗'}`
        + `\n    over all of it the most in a step is ${(mostAll / cap * 100).toFixed(0)}% of the cap (${deg(K.swayRate)}° a second) and the most one step differs from the one before it ${(jerkAll / jerkCap * 100).toFixed(0)}% of what the spring could make it`); void r3; void near; }
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
        run(ctx, 480, hold); const lean = Math.abs(wrap(W.cam.yaw - y0)), u1 = up(), seen = ctx.auto?.scene?.threats.length ?? 0;
        // a second out of his line (a wall the level does not have, put between them): still a man of the fight, and the yaw does not start back
        const sb = g.col.segmentBlocked, yl = W.cam.yaw; g.col.segmentBlocked = (p: number[], q: number[]) => (Math.hypot(q[0] - at![0], q[2] - at![2]) < 0.1 && q[1] === 1.3) || sb.call(g.col, p, q); run(ctx, 60, hold); g.col.segmentBlocked = sb;
        const lineNow = ctx.auto?.scene?.threats.length ?? 0, fightNow = ctx.auto?.scene?.fight.length ?? 0, peek = Math.abs(wrap(W.cam.yaw - yl)); run(ctx, 30, hold);
        const fog = g.fogOfWar, hidden0 = fog.hidden; fog.hidden = (x: any) => x === gd; run(ctx, 1080, hold); fog.hidden = hidden0; const home = Math.abs(W.cam.yaw - y0) < 1e-9;
        const good = on ? seen === 1 && lean > 0.17 && u1 > u0 + 0.05 && most <= cap && lineNow === 0 && fightNow === 1 && peek < 0.03 && home && AUTOVIEW.on : most === 0 && lean === 0 && seen === 1; if (!good) ok = false;
        rows.push(on ? `the sway on: ${gd.callsign ?? 'a guard'} six metres off to one side (${seen} in his line): the yaw leans ${deg(lean)}° toward him (from ${f2(u0)} to ${f2(u1)} up the screen), ${(most / cap * 100).toFixed(0)}% of the cap at the most in a tick · a second behind a wall: ${lineNow} in his line, ${fightNow} of the fight, the yaw ${deg(peek)}° on · the fog hides him: ${home ? 'home' : 'NOT home ✗'}`
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
    // ------------------------------------------------------------ the hand's own tuning (AUTOCAM.tune)
    const R = Math.PI / 180, tuned = () => JSON.stringify(A.AUTO_KEYS.map(k => K[k]));
    // 17 modes and rows
    { K.tune = false; A.setAutoMode('never'); const offNever = tuned(); A.setAutoMode('free'); const asBuilt = tuned(); A.setAutoMode(A.AUTOTUNE_START);
      K.tune = !TUNEBREAK; A.resetAutoTune(); const start = A.autoTuneOwn() ? 'not the start\'s numbers' : A.AUTOTUNE.mode, G = { ahead: K.restAhead, rest: K.rest, cap: K.turnCap, swingCap: K.swingCap, fight: K.swayFightMax, move: K.swayMove, rate: K.swayRate, swing: K.swing }, gentleAll = tuned();
      A.setAutoMode('rest'); const Rm = { rest: K.rest, ahead: K.restAhead, fight: K.swayFightMax, move: K.swayMove };
      A.setAutoMode('never'); const N = { rest: K.rest, ahead: K.restAhead, fight: K.swayFightMax, move: K.swayMove };
      A.setAutoMode('free'); const free = tuned();
      A.setAutoMode('gentle'); A.setAutoTune('swayMove', 10 * R); const own = A.autoTuneOwn(), moved = K.swayMove, others = K.turnCap === G.cap && K.restAhead === G.ahead; A.setAutoTune('swayMove', (0 * 180 / Math.PI) / (180 / Math.PI)); const again = A.autoTuneOwn();
      A.setAutoTune('swayFightMax', (15 / (180 / Math.PI))); const notch = A.autoTuneOwn();   // (the mode's own notch, come at through the row's unit)
      K.lean = 4; const foreign = A.autoTuneOwn(); A.autoTuneApply(); const mended = !A.autoTuneOwn();   // (a table written by something else — a recording being played — is not shown as the mode's)
      A.setAutoMode('rest'); A.setAutoTune('turnCap', 50 * R); A.setAutoTune('swing', false); const kept = JSON.parse(JSON.stringify(A.AUTOTUNE));
      A.resetAutoTune(); const reset = A.AUTOTUNE.mode === A.AUTOTUNE_START && !A.autoTuneOwn() && tuned() === gentleAll;
      A.autoTuneLoad({ ...kept, over: { ...kept.over, nonsense: 3, rest: 'yes', gap: null, still: 'NaN' } }); A.autoTuneApply(); const read = A.AUTOTUNE.mode === 'rest' && Math.abs(K.turnCap - 50 * R) < 1e-9 && K.swing === false && K.rest === true && Object.keys(A.AUTOTUNE.over).sort().join() === 'swing,turnCap';
      A.autoTuneLoad({ mode: 'sideways', over: { swing: true, gap: 9 } }); A.autoTuneLoad({ mode: 'constructor' }); A.autoTuneLoad('junk'); A.autoTuneLoad(null); const refused = A.AUTOTUNE.mode === 'rest' && Object.keys(A.AUTOTUNE.over).sort().join() === 'swing,turnCap';
      A.autoTuneLoad({ mode: 'free', over: { gap: 99, zoomRate: -3, turnCap: 1e-6, swayFightMax: 2, swingCap: 0 } }); A.autoTuneApply(); const heldTo = { gap: K.gap, zoom: K.zoomRate, cap: K.turnCap, fight: K.swayFightMax, swing: K.swingCap }; A.resetAutoTune();
      const inRange = heldTo.gap === A.AUTO_RANGE.gap[1] && heldTo.zoom === A.AUTO_RANGE.zoomRate[0] && Math.abs(heldTo.cap - A.AUTO_RANGE.turnCap[0]) < 1e-12 && heldTo.fight === K.swayMax && heldTo.swing === 0;
      line(offNever === asBuilt && free === asBuilt && start === 'gentle' && G.ahead === false && G.rest === true && G.swing === true && Math.abs(G.cap - 30 * R) < 1e-9 && Math.abs(G.swingCap - 180 * R) < 1e-9 && Math.abs(G.fight - 15 * R) < 1e-9 && G.move === 0 && Math.abs(G.rate - 6 * R) < 1e-9
        && Rm.rest && !Rm.ahead && Rm.fight === 0 && Rm.move === 0 && !N.rest && !N.ahead && N.fight === 0 && N.move === 0 && own && Math.abs(moved - 10 * R) < 1e-9 && others && !again && !notch && foreign && mended && reset && read && refused && inRange,
        '17 the tuning: off, every number is the module\'s whatever is chosen; on, nobody has chosen gentle; each mode has its numbers; a row moved is the player\'s own and put back is the mode\'s; what is kept reads back held to what a row can be put to, and a line that is not one is refused whole',
        `off with 'never' chosen: ${offNever === asBuilt ? 'the numbers as built' : 'CHANGED ✗'} · on: '${start}' (a turn for the thing on the lens's side ${G.ahead}, for a wall ${G.rest}, top speed ${deg(G.cap)}° a second, the swing's ${deg(G.swingCap)}°, in a fight ${deg(G.fight)}°, for his walk ${deg(G.move)}°, the lean ${deg(G.rate)}° a second) · 'rest': fight ${deg(Rm.fight)}° · 'never': a turn at rest ${N.rest || N.ahead} · 'free': ${free === asBuilt ? 'the numbers as built' : 'NOT as built ✗'}`
        + `\n    a row moved: the player's own ${own}, ${deg(moved)}°, the other rows the mode's ${others}; put back: own ${again}; the mode's notch through the row's unit: own ${notch} · the table written from outside: own ${foreign}, applied again ${mended ? 'the mode\'s' : 'NOT the mode\'s ✗'} · reset ${reset} · kept ${JSON.stringify(kept)} read back with four bad keys beside it ${read}`
        + `\n    a mode this build has not (with rows), 'constructor', a string and nothing: ${refused ? 'refused whole' : 'TAKEN ✗'} · out of range (a gap of 99, a zoom speed of -3, a top speed of a millionth, 115° in a fight): ${heldTo.gap} s, ${heldTo.zoom}, ${deg(heldTo.cap)}° a second, ${deg(heldTo.fight)}° ${inRange ? '' : '✗'}`); }
    // 18 calmer
    { K.tune = !TUNEBREAK; K.turn = true; A.setAutoMode('gentle');
      const cam = cam0(), open = () => false, sx = Math.sin(cam.yaw), cz = Math.cos(cam.yaw), wall = (a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz); return d > 0.9 && (dx * sx + dz * cz) / d > 0.9; };
      const ask = (S: any, blocked: any) => { const st = begin(cam); let g: number | null = null; for (let i = 0; i < 90 && g == null; i++) g = A.turnGoal(st, S, cam, DT, blocked); return g; };
      const behind = scene({ door: { at: up(cam, -6), w: 1 }, still: true }), gAhead = ask(behind, open), gWall = ask(scene({ still: true }), wall);
      A.setAutoMode('never'); const nWall = ask(scene({ still: true }), wall); A.setAutoTune('restAhead', true); const nAhead = ask(behind, open), nWall2 = ask(scene({ still: true }), wall);   // (each reason on its own row: the door's with the wall's off)
      A.setAutoMode('free'); const fAhead = ask(behind, open); A.setAutoTune('rest', false); const fWall = ask(scene({ still: true }), wall), fAhead2 = ask(behind, open); A.setAutoMode('gentle');
      // an eased turn of 120°: from rest, under its top speed, no step in it, there without going past; as built the first step was the largest
      const ease = (goal: number, capR: number) => { const st = A.autoCam(), cap = capR * DT, w = capR / K.turnLand, jerkCap = Math.max(capR / K.turnRamp, 2 * w * capR) * DT * DT + 1e-12; let yaw = 0, first = 0, most = 0, jerk = 0, prev = 0, past = false, n = 0, done = false, back = false;
        for (; n < 60 * 30 && !done; n++) { const s = A.turnEase(st, yaw, goal, DT, capR); if (!n) first = s.turn; done = s.done; if (!done) { most = Math.max(most, Math.abs(s.turn)); jerk = Math.max(jerk, Math.abs(s.turn - prev)); if (s.turn < -1e-12) back = true; } prev = s.turn; yaw += s.turn; if (yaw > goal + 1e-9) past = true; }
        return { first: first / cap, most: most / cap, jerk: jerk / jerkCap, past, back, landed: done && Math.abs(yaw - goal) < 1e-9, secs: n / 60 }; };
      const E = ease(120 * R, K.turnCap), built = F.behindStep(0, 120 * R, DT, K.turnRate).turn / (K.turnCap * DT), fine = (e: ReturnType<typeof ease>) => e.first > 0 && e.first < 0.05 && e.most <= 1 + 1e-9 && e.jerk <= 1 && !e.past && !e.back && e.landed;
      // …the top speed is what a turn goes at: every notch of the row is a quicker 45° than the one before, and the swing at its own speeds lands the same way
      const notches = [10, 20, 30, 40, 60, 80, 100, 120].map(c => ({ c, e: ease(45 * R, c * R) })), quicker = notches.every((x, i) => !i || x.e.secs < notches[i - 1].e.secs * 0.95), allFine = notches.every(x => fine(x.e)), atTop = notches.filter(x => x.c <= 40).every(x => x.e.most > 0.95);
      const swings = [30, 180, 210].map(c => ({ c, e: ease(180 * R, c * R) })), swingFine = swings.every(x => fine(x.e) && x.e.most > 0.95);
      // …a goal gone round to the other side a second in, and a faster turn handed to a slower top speed: braked, never a step
      const turnAbout = (cap1: number, cap2: number, goal2: number) => { const st = A.autoCam(), brake = 2 * (cap2 / K.turnLand) * cap2 * DT * DT + 1e-12; let y = 0, prev = 0, worst = 0, n = 0, done = false, over = 0; for (let i = 0; i < 60; i++) { const s = A.turnEase(st, y, 120 * R, DT, cap1); y += s.turn; prev = s.turn; }
        for (; n < 60 * 30 && !done; n++) { const s = A.turnEase(st, y, goal2, DT, cap2); done = s.done; if (!done) { worst = Math.max(worst, Math.abs(s.turn - prev) / brake); if (n > 90) over = Math.max(over, Math.abs(s.turn) / (cap2 * DT)); } prev = s.turn; y += s.turn; } return { worst, landed: done && Math.abs(wrap(y - goal2)) < 1e-9, over }; };
      const about = turnAbout(30 * R, 30 * R, -60 * R), tapBack = turnAbout(30 * R, 180 * R, -150 * R), handed = turnAbout(120 * R, 30 * R, 120 * R), aboutFine = [about, tapBack, handed].every(x => x.worst <= 1 && x.landed && x.over <= 1 + 1e-9);
      // …one ended a second in: its speed dies away
      const st2 = A.autoCam(); let y2 = 0, last = 0; for (let i = 0; i < 60; i++) { const s = A.turnEase(st2, y2, 120 * R, DT); y2 += s.turn; last = s.turn; } let coast = 0, c0 = -1, rising = false, pv = last; for (let i = 0; i < 120; i++) { const t = A.turnCoast(st2, DT); if (c0 < 0) c0 = t; if (t > pv + 1e-12) rising = true; pv = t; coast += t; }
      // the sway: a lean speed over the one as built is reached (the spring is that much stiffer); a fight whose lean is at none leans nothing for his walk either
      const lean1 = (rate: number, fightMax: number, move: number, vel: [number, number]) => { K.sway = true; A.setAutoTune('swayRate', rate); A.setAutoTune('swayFightMax', fightMax); A.setAutoTune('swayMove', move); const c = cam0(), st = begin(c), B = c.planarBasis(), side: [number, number, number] = [20 + B.right[0] * 9 + B.fwd[0] * 2, 0, 14 + B.right[2] * 9 + B.fwd[2] * 2];
        const S = scene({ threats: [side], fight: [side], vel }); let top = 0, far = 0, y = c.yaw; for (let i = 0; i < 60 * 8; i++) { const t = A.autoSway(st, S, c, DT, open); c.rotate(t); top = Math.max(top, Math.abs(t) / DT); far = Math.max(far, Math.abs(wrap(c.yaw - y))); } K.sway = false; return { top, far }; };
      const slow = lean1(11.46 * R, 38 * R, 0, [0, 0]), fast = lean1(20 * R, 38 * R, 0, [0, 0]), cB = cam0().planarBasis(), noneWalk = lean1(11.46 * R, 0, 14 * R, [cB.right[0] * 3, cB.right[2] * 3]);
      A.setAutoMode('gentle');
      // the frame's share and the zoom's
      const lean = (k: number) => { A.setAutoTune('leanK', k); const c = cam0(), look = settle(scene({ door: { at: up(c, 3), w: 1 } }), c, begin(c)), B = c.planarBasis(); return (look[0] - 20) * B.fwd[0] + (look[2] - 14) * B.fwd[2]; };
      const l1 = lean(1), l5 = lean(0.5), l0 = lean(0); A.setAutoTune('leanK', 1);
      const zoom = (k: number) => { A.setAutoTune('zoomAmt', k); const c = cam0(); settle(scene({ zoomK: 0.9 }), c, begin(c), 8); return c.desiredDistance; };
      const z1 = zoom(1), z5 = zoom(0.5), z0 = zoom(0); A.setAutoTune('zoomAmt', 1);
      line(gAhead == null && gWall != null && Math.abs(Math.abs(wrap(gWall! - cam.yaw)) - Math.PI / 4) < 1e-6 && nWall == null && nAhead != null && nWall2 == null && fAhead != null && fWall == null && fAhead2 != null
        && fine(E) && E.secs > 3 && E.secs < 14 && built > 20 * E.first && quicker && allFine && atTop && swingFine && aboutFine
        && c0 > 0 && c0 <= last + 1e-12 && c0 > 0.5 * last && !rising && coast > 0 && coast < K.turnCap / K.swayStop * 1.2 && st2.turnV === 0
        && fast.top > slow.top * 1.3 && fast.top <= 20 * R + 1e-9 && slow.top <= 11.46 * R + 1e-9 && slow.far > 0.3 && noneWalk.far < 1e-9
        && Math.abs(l1 - K.door * 3) < 0.02 && Math.abs(l5 - l1 / 2) < 0.02 && Math.abs(l0) < 1e-9 && Math.abs(z1 - 21 * 0.9) < 0.05 && Math.abs(z5 - 21 * 0.95) < 0.05 && Math.abs(z0 - 21) < 1e-9,
        '18 gentle: no turn at rest for the thing on the lens\'s side, one for a wall, and each of the two on its own row; an eased turn starts from rest, stays under its top speed with no step in it and lands without going past, every notch of its speed is a quicker turn, and one ended midway dies away; a faster lean is reached and a fight\'s lean at none leans nothing for his walk; the frame\'s and the zoom\'s shares scale them to none',
        `the thing framed on the lens's side: gentle ${gAhead == null ? 'no turn' : 'TURNS ✗'}, free ${fAhead != null ? 'turns' : 'NO turn ✗'} · a wall a metre toward the lens: gentle ${gWall == null ? 'NO turn ✗' : `${deg(wrap(gWall - cam.yaw))}°`}, never ${nWall == null ? 'no turn' : 'TURNS ✗'} · never with the door's row on: the door ${nAhead != null ? 'turns' : 'NO turn ✗'}, the wall ${nWall2 == null ? 'no turn' : 'TURNS ✗'} · free with the wall's row off: the wall ${fWall == null ? 'no turn' : 'TURNS ✗'}, the door ${fAhead2 != null ? 'turns' : 'NO turn ✗'}`
        + `\n    120° eased: the first step ${(E.first * 100).toFixed(1)}% of the top speed's (as built the first step was ${(built / Math.max(1e-12, E.first)).toFixed(0)} times it), the most ${(E.most * 100).toFixed(0)}%, the most one step differs from the one before ${(E.jerk * 100).toFixed(0)}% of what the ramp or the brake could make it, ${E.past ? 'goes PAST ✗' : 'never past'}, ${E.back ? 'turns BACK ✗' : 'never back'}, ${E.landed ? `there in ${E.secs.toFixed(1)} s` : 'NOT there ✗'}`
        + `\n    45° at ${notches.map(x => `${x.c}`).join(' / ')}° a second: ${notches.map(x => `${x.e.secs.toFixed(1)}`).join(' / ')} s, reaching ${notches.map(x => `${(x.e.most * 100).toFixed(0)}`).join(' / ')}% of the top speed ${quicker && allFine ? '' : '✗'} · a half turn of the swing at ${swings.map(x => x.c).join(' / ')}° a second: ${swings.map(x => `${x.e.secs.toFixed(1)}`).join(' / ')} s ${swingFine ? '' : '✗'}`
        + `\n    the goal gone round to the other side a second in / a double tap the other way in the middle of a turn / a turn at 120° a second handed to a top speed of 30: the most one step differs from the one before ${[about, tapBack, handed].map(x => `${(x.worst * 100).toFixed(0)}`).join(' / ')}% of what the brake could make it, ${aboutFine ? 'each lands' : 'NOT all land ✗'}`
        + `\n    ended a second in (at ${deg(last / DT)}° a second): the next step ${(c0 / Math.max(1e-12, last) * 100).toFixed(0)}% of the last, ${rising ? 'RISES ✗' : 'falling from there'}, ${deg(coast)}° more in all · a lean toward a fight to one side at 11 / 20° a second: its fastest ${deg(slow.top)} / ${deg(fast.top)}° a second · the fight's lean at none and a walk across the view: ${deg(noneWalk.far)}°`
        + `\n    the frame's share at 100 / 50 / 0 %: ${f2(l1)} / ${f2(l5)} / ${f2(l0)} m toward a door 3 m up · the zoom's, in a room that asks for 90% of 21 m: ${f2(z1)} / ${f2(z5)} / ${f2(z0)}`); }
    // 19 through the loop
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        // the tap that puts the mode on (the mode 'never', so nothing else turns the view): with the swing off it turns nothing; with it on the view comes round eased
        const tapOn = async (swing: boolean) => { F.setAutoView(false); F.setFindMe('behind', false); FIXEDSTEP.on = fixed; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T); K.on = !BREAK; K.tune = !TUNEBREAK; A.setAutoMode('never'); A.setAutoTune('swing', swing); run(ctx, 10);
          const y0 = W.cam.yaw, want = F.behindYaw(W.game.player.char.aimYaw), off0 = Math.abs(wrap(y0 - want)); T.tap(); let most = 0, first = -1, prev = y0; const each = () => { const s = Math.abs(wrap(W.cam.yaw - prev)); if (first < 0 && s > 0) first = s; most = Math.max(most, s); prev = W.cam.yaw; };
          run(ctx, 60 * 6, each); each(); return { on: AUTOVIEW.on, moved: Math.abs(wrap(W.cam.yaw - y0)), there: Math.abs(wrap(W.cam.yaw - want)) < 1e-6, off0, most: most / (K.swingCap * DT), first: first / (K.swingCap * DT) }; };
        const quiet = await tapOn(false), swung = await tapOn(true);
        // …and a shot in the middle of the swing ends it where it is, without a step
        const shot = await (async () => { F.setAutoView(false); F.setFindMe('behind', false); FIXEDSTEP.on = fixed; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), I = W.input; K.on = !BREAK; K.tune = !TUNEBREAK; A.setAutoMode('never'); A.setAutoTune('swingCap', 30 * R); run(ctx, 10);
          const want = F.behindYaw(W.game.player.char.aimYaw); T.tap(); run(ctx, 20); let pv = 0, y = W.cam.yaw; stepFrame(ctx, DT); pv = Math.abs(wrap(W.cam.yaw - y)); const before = pv, left0 = Math.abs(wrap(W.cam.yaw - want)); I.clicked = 1; I.buttons = 1;
          let stepUp = false, after = 0; for (let i = 0; i < 120; i++) { y = W.cam.yaw; stepFrame(ctx, DT); if (i === 2) I.buttons = 0; const s = Math.abs(wrap(W.cam.yaw - y)); if (s > pv + 1e-9) stepUp = true; pv = s; after += s; } return { before, left0, stepUp, after, still: pv < 1e-9, short: Math.abs(wrap(W.cam.yaw - want)) > 0.05 }; })();
        // a wall hides him (one the level does not have, a metre toward the lens): the view comes round by the eased turn, the mouse moved in the middle of it
        F.setAutoView(false); FIXEDSTEP.on = fixed; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), g = W.game, c = g.player.char, I = W.input; K.on = !BREAK; K.turn = true; K.tune = !TUNEBREAK; A.setAutoMode('gentle'); A.setAutoTune('swing', false);
        for (const o of g.guards) { o.char.pos[0] = 1; o.char.pos[2] = 1; } run(ctx, 10); T.tap(); run(ctx, 5);
        const fake = (yaw: number) => { const sx = Math.sin(yaw), cz = Math.cos(yaw); return (a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz); return a[1] === 1.3 && b[1] === 1.3 && Math.hypot(a[0] - c.pos[0], a[2] - c.pos[2]) < 1e-6 ? d > 0.9 && (dx * sx + dz * cz) / d > 0.9 : sb.call(g.col, a, b); }; };
        const y0 = W.cam.yaw, sb = g.col.segmentBlocked, turns0 = ST.turns; g.col.segmentBlocked = fake(y0);
        const cap = K.turnCap * DT + 1e-12; let most = 0, prev = y0, jerk = 0, ps = 0, f = 0, atMouse = -1; const each = () => { const s = Math.abs(wrap(W.cam.yaw - prev)); most = Math.max(most, s); jerk = Math.max(jerk, Math.abs(s - ps)); ps = s; prev = W.cam.yaw; if (atMouse < 0 && Math.abs(wrap(W.cam.yaw - y0)) > 0.15) { atMouse = f; I.mouseX += 240; I.mouseY += 60; } f++; };   // (the hand moves the mouse a fifth of the way round)
        run(ctx, 60 * 10, each); each(); const round = Math.abs(wrap(W.cam.yaw - y0)), turns = ST.turns - turns0;
        // …again, and a walk key a second into it
        g.col.segmentBlocked = sb; g.teleportPlayer([c.pos[0], 0, c.pos[2]]); const y1 = W.cam.yaw; g.col.segmentBlocked = fake(y1);
        let began = -1; for (let i = 0; i < 60 * 6 && began < 0; i++) { run(ctx, 1, each); if (Math.abs(wrap(W.cam.yaw - y1)) > 1e-4) began = i; } run(ctx, 45, each); const mid = Math.abs(wrap(W.cam.yaw - y1)), v = ps;
        I.keys.add('KeyW'); let stepUp = false, pv = v, after = 0, c1 = -1; for (let i = 0; i < 90; i++) { const yb = W.cam.yaw; stepFrame(ctx, DT); const s = Math.abs(wrap(W.cam.yaw - yb)); if (c1 < 0) c1 = s; if (s > pv + 1e-9) stepUp = true; pv = s; after += s; } I.keys.clear(); const stopped = pv < 1e-6;
        // …and he stops again, still hidden: the next turn waits out the gap from where that one ended, not from where it began
        const y2 = W.cam.yaw; let next = -1; for (let i = 0; i < 60 * 6 && next < 0; i++) { stepFrame(ctx, DT); if (Math.abs(wrap(W.cam.yaw - y2)) > 1e-4) next = i; } g.col.segmentBlocked = sb;
        const good = quiet.on && quiet.moved < 1e-9 && quiet.off0 > 0.2 && swung.on && swung.there && swung.most <= 1 + 1e-9 && swung.first < 0.05 && shot.before > 0 && shot.left0 > 0.1 && !shot.stepUp && shot.still && shot.short && shot.after > 0 && shot.after < 0.1
          && Math.abs(round - Math.PI / 4) < 0.01 && atMouse > 0 && turns === 1 && most <= cap && most > 0.5 * cap && jerk <= cap * 0.2 && began >= 0 && mid > 0.02 && mid < Math.PI / 4 - 0.05 && v > 0 && !stepUp && c1 > 0.5 * v && stopped && after > 0.003 && after < 0.1
          && next >= 60 && next < 60 * (K.gap + 0.2); if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: the swing off, tapped twice: ${quiet.on ? 'the mode on' : 'OFF ✗'} and the view ${quiet.moved < 1e-9 ? 'does not move' : `MOVES ${deg(quiet.moved)}° ✗`} (it was ${deg(quiet.off0)}° off where he looks); the swing on: ${swung.there ? 'it comes round' : 'does NOT come round ✗'}, its first step ${(swung.first * 100).toFixed(1)}% and its most ${(swung.most * 100).toFixed(0)}% of the swing's top speed; a shot in the middle of a slow swing: ${shot.stepUp ? 'a step UP ✗' : 'each step smaller than the last'}, ${deg(shot.after)}° more, ${shot.still && shot.short ? 'then still, short of where he looks' : 'NOT ended ✗'}`
          + ` · a wall hides him: the view comes ${deg(round)}° round with the mouse moved ${atMouse} frames in, ${(most / cap * 100).toFixed(0)}% of its top speed at the most in a step, the most one step differs from the one before ${(jerk / cap * 100).toFixed(1)}% of that, ${turns} turn${turns === 1 ? '' : 's ✗'} in ten seconds`
          + ` · a walk key ${deg(mid)}° into the next: the step after ${(c1 / Math.max(1e-12, v) * 100).toFixed(0)}% of the one before, ${stepUp ? 'a step UP ✗' : 'each smaller than the last'}, ${deg(after)}° more, then ${stopped ? 'still' : 'MOVING ✗'} · stopped again and still hidden: the next turn ${next < 0 ? 'NEVER begins ✗' : `begins ${(next / 60).toFixed(1)} s after he stops`} (the gap is ${K.gap} s)`); }
      line(ok, '19 the whole Game: with the swing off the double tap puts the mode on and turns nothing, and with it on the view comes round eased; a wall hiding him brings the view round under the eased turn\'s top speed with no step in it though the mouse moves; a walk key ends that turn without a step, and the next waits out the gap from there', rows.join('\n    ')); }
    // 20 the tuning's plumbing
    { const W = await stand(5), g = W.game, E = process.env, shipped = E.TPS_PROFILE === 'shipped', row = FROZEN_HOLDS['AUTOCAM.tune'], want = E.TPS_AUTOTUNE !== undefined ? E.TPS_AUTOTUNE === '1' : shipped;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      const isOn = (): boolean => K.tune;
      K.tune = true; A.setAutoMode('gentle'); const old = snap(), had = old.tables.AUTOCAM?.tune === true && old.tables.AUTOCAM?.restAhead === false;
      for (const k of ['tune', 'rest', 'restAhead', 'turnCap', 'turnLand', 'turnRamp', 'swing', 'swingCap', 'leanK', 'zoomAmt']) delete old.tables.AUTOCAM[k]; old.tables.AUTOCAM.swayFightMax = 0.5;   // (a recording from before the key has none of its numbers, and the ones it does carry are its own)
      J.applyKnobs(g, old); const before = isOn(), asBuilt = K.restAhead === true && K.turnCap === 0 && K.swingCap === 0 && K.leanK === 1, carried = K.swayFightMax === 0.5;
      K.tune = true; A.autoTuneApply(); const on = snap(); K.tune = false; A.autoTuneApply(); J.applyKnobs(g, on); const kept = isOn() && K.restAhead === false && K.turnCap > 0;
      const rowsHeld = ['restAhead', 'turnCap', 'swingCap', 'swayFightMax', 'swayMove', 'swayRate'].filter(k => !String(FROZEN_HOLDS[`AUTOCAM.${k}`] ?? '').startsWith('TPS_AUTOTUNE=1'));
      line(had && before === false && asBuilt && carried && kept && stoodTune === want && (STAND_ENV as string[]).includes('TPS_AUTOTUNE') && typeof row === 'string' && row.startsWith('TPS_AUTOTUNE=1') && !rowsHeld.length,
        `20 CONTROL — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the tuning ${want ? 'on' : 'off'} by its words, FROZEN_HOLDS carries its row and one for each number gentle moves, and a recording from before the key replays on the numbers as built with the ones it carries left alone`,
        `stood ${stoodTune} (wanted ${want}) · row: '${row}' · numbers with no row: ${rowsHeld.join(', ') || 'none'} · a recording carries the key and the gentle numbers ${had} · from before the key: tune ${before}, the numbers as built ${asBuilt}, its own lean in a fight kept ${carried} · recorded on: ${kept}`); }
    // ------------------------------------------------------------ the soft lock (AUTOCAM.lock)
    // 21 the frame
    { K.tune = false; A.autoTuneApply(); K.lock = !LOCKBREAK;
      const far = (c: any) => up(c, 2), lockAt = (c: any, s: number, o: any = {}) => scene({ threats: [far(c)], lock: { at: far(c), s, stalk: false }, ...o });
      const rest = (S: (c: any) => any, secs = 10) => { const c = cam0(), st = begin(c), look = settle(S(c), c, st, secs), B = c.planarBasis(); return { d: c.desiredDistance, toward: (look[0] - 20) * B.fwd[0] + (look[2] - 14) * B.fwd[2] }; };
      const s0 = rest(c => lockAt(c, 0)), s5 = rest(c => lockAt(c, 0.5)), s1 = rest(c => lockAt(c, 1)), none = rest(c => scene({ threats: [far(c)] }));
      // from none to full: the distance leaves from rest and never steps
      const c = cam0(), st = begin(c); settle(lockAt(c, 0), c, st, 6); let first = 0, most = 0, prev = c.desiredDistance, pd = 0, jerk = 0, back = false;
      for (let i = 0; i < 60 * 8; i++) { const look = A.autoFrame(st, lockAt(c, 1), c, DT); c.step(DT, look, null); const d = prev - c.desiredDistance; if (!i) first = d; most = Math.max(most, d); jerk = Math.max(jerk, Math.abs(d - pd)); if (d < -1e-9) back = true; pd = d; prev = c.desiredDistance; }
      // a held button stills it; a stalk's held click does not
      const heldAt = (stalk: boolean) => { const c2 = cam0(), st2 = begin(c2); settle(lockAt(c2, 0), c2, st2, 6); const d0 = c2.desiredDistance; settle(scene({ threats: [far(c2)], lock: { at: far(c2), s: 1, stalk }, hold: true }), c2, st2, 6); return d0 - c2.desiredDistance; };
      const plain = heldAt(false), stalk = heldAt(true);
      // a second man he could shoot, well to one side: the camera comes in less, and he stays inside the picture's reach
      const two = rest(c2 => scene({ threats: [far(c2), side(c2, 9)], lock: { at: far(c2), s: 1, stalk: false } }));
      // `lockIn` at none: nowhere in; the frame still goes to the middle of the two
      const in0 = K.lockIn; K.lockIn = 0; const flat0 = rest(c2 => lockAt(c2, 1)), sky0 = rest(c2 => lockAt(c2, 1, { zoomK: 1.15 })); K.lockIn = in0;
      const full = 21 * (1 - K.lockIn);
      // where the place's own zoom is not the hand's (under the sky, in a room): a share off where it would be — no dead zone, and no step as the lock begins
      const sky = rest(c2 => scene({ threats: [far(c2)], zoomK: 1.15 })), skyE = rest(c2 => lockAt(c2, 0.001, { zoomK: 1.15 })), skyF = rest(c2 => lockAt(c2, 1, { zoomK: 1.15 })), roomE = rest(c2 => lockAt(c2, 0.1, { zoomK: 0.92 })), roomN = rest(c2 => scene({ threats: [far(c2)], zoomK: 0.92 }));
      // the frame among several men: from the middle of them all to the middle of the two (the lock's share told apart from the fight's)
      const k0 = K.lockK; K.lockK = 0.8; const both = (c2: any, o: any) => scene({ threats: [far(c2), side(c2, 3)], ...o }), lean = (S: (c: any) => any) => { const c2 = cam0(), st2 = begin(c2), look = settle(S(c2), c2, st2, 10), B = c2.planarBasis(); return { f: (look[0] - 20) * B.fwd[0] + (look[2] - 14) * B.fwd[2], r: (look[0] - 20) * B.right[0] + (look[2] - 14) * B.right[2], d: c2.desiredDistance }; };
      const m0 = lean(c2 => both(c2, {})), m1 = lean(c2 => both(c2, { lock: { at: far(c2), s: 1, stalk: false } })), arm = lean(c2 => both(c2, { lock: { at: null, s: 1, stalk: false } })); K.lockK = k0;
      // a stalk he broke with the button still down: the lock's man gone, it lets go though a button is held
      const brk = (() => { const c2 = cam0(), st2 = begin(c2); settle(scene({ threats: [far(c2)], lock: { at: far(c2), s: 1, stalk: true }, hold: true }), c2, st2, 6); const d0 = c2.desiredDistance; settle(scene({ hold: true }), c2, st2, 4); const kept = c2.desiredDistance; settle(scene({ threats: [far(c2)], hold: true, onto: true }), c2, st2, 8); return { d0, kept, d1: c2.desiredDistance }; })();
      // a door ahead (it holds the zoom out with no lock) does not hold the lock out in full; the hand's share of the zoom at none: no lock zoom either
      const doorN = rest(c2 => scene({ threats: [far(c2)], door: { at: side(c2, 14), w: 1 } })), doorL = rest(c2 => lockAt(c2, 1, { door: { at: side(c2, 14), w: 1 } }));
      const za = K.zoomAmt; K.zoomAmt = 0; const amt0 = rest(c2 => lockAt(c2, 1, { zoomK: 0.92 })); K.zoomAmt = 0.5; const amtH = rest(c2 => lockAt(c2, 1, { zoomK: 0.8 })); K.zoomAmt = za;
      // the zoom's own rule: held out while a man is in his line — as it was with no lock's man, in a fight, with the lock's zoom at none and with the
      // switch off — and let back in by the lock's man
      const ratchet = (full: boolean, o: any = {}, lockIn = in0) => { K.lockIn = lockIn; const c2 = cam0(), st2 = begin(c2), S2 = (zoomK: number) => scene({ threats: [far(c2)], zoomK, ...(full ? { lock: { at: far(c2), s: 1, stalk: false } } : {}), ...o }); settle(scene({ threats: [far(c2)], zoomK: 1.15 }), c2, st2, 6); settle(S2(0.92), c2, st2, 10); K.lockIn = in0; return c2.desiredDistance; };
      const rIn = ratchet(true), rNo = ratchet(false), rFight = ratchet(false, { onto: true }), rNone = ratchet(true, {}, 0); K.lock = false; const rOff = ratchet(true); K.lock = !LOCKBREAK;
      // its man out of his line for a moment is framed as he was in it; the view gone to somebody else: the lock lets go and the distance is the zoom's own
      const lin = rest(c2 => scene({ lock: { at: far(c2), s: 0.5, stalk: false } }));
      const gone = (() => { const c2 = cam0(), st2 = begin(c2); settle(lockAt(c2, 1), c2, st2, 6); const d0 = c2.desiredDistance; A.autoRest(st2, c2); return { d0, d1: c2.desiredDistance, s: st2.lockS }; })();
      const half = (21 + (21 * 0.8 - 21) * 0.5) * (1 - in0 * 0.5);   // (the hand's share at a half: half the place's zoom, less half the lock's share)
      const more2 = doorN.d > 21 + 1 && Math.abs(doorL.d - s1.d) < 0.05 && Math.abs(amt0.d - 21) < 1e-9 && Math.abs(amtH.d - half) < 0.05 && Math.abs(rIn - 21 * 0.92 * (1 - in0)) < 0.05 && Math.abs(rNo - 21 * 1.15) < 0.05 && Math.abs(rFight - 21 * 1.15) < 0.05 && Math.abs(rNone - rNo) < 1e-9 && Math.abs(rOff - rNo) < 1e-9
        && Math.abs(lin.toward - s5.toward) < 0.02 && gone.d0 < 21 - 2 && Math.abs(gone.d1 - 21) < 1e-9 && gone.s === 0;
      const more = more2 && Math.abs(sky0.d - sky.d) < 1e-9 && Math.abs(skyE.d - sky.d) < 0.02 && Math.abs(skyF.d - sky.d * (1 - K.lockIn)) < 0.05 && roomE.d < roomN.d - 0.5
        && Math.abs(m0.f - K.fight * 1) < 0.02 && Math.abs(m0.r - K.fight * 1.5) < 0.02 && Math.abs(m1.f - 0.8 * 2) < 0.02 && Math.abs(m1.r) < 0.02 && Math.abs(arm.f - m0.f) < 1e-6 && Math.abs(arm.r - m0.r) < 1e-6 && arm.d < m0.d - 2
        && brk.d0 < 21 - 2 && Math.abs(brk.kept - brk.d0) < 0.05 && brk.d1 > 21 - 0.05;
      line(Math.abs(s0.d - none.d) < 1e-6 && Math.abs(none.d - 21) < 0.05 && s5.d < s0.d - 1 && s1.d < s5.d - 1 && Math.abs(s1.d - full) < 0.05 && Math.abs(s1.toward - K.lockK * 2) < 0.02 && Math.abs(s0.toward - K.fight * 2) < 0.02
        && first >= 0 && first < 0.15 * most && most > 0 && jerk < 0.2 * most && !back && Math.abs(plain) < 1e-9 && stalk > 0.9 * (21 - full) && two.d > s1.d + 1 && two.d < 21 * K.fitMost + 1e-6 && Math.abs(flat0.d - 21) < 1e-9 && more,
        '21 the soft lock: a man who is not onto him holds the frame by how near he is — the look-at at the middle of the two, the camera in by its share of where it would be, from rest and with no step, under the sky and in a room alike; a held button stills it and a stalk\'s held click does not, and under the button it lets go only for a fight; a second man is not zoomed out of the picture and a door ahead does not hold it out; a man in his arm zooms and leaves the frame; at none, and with the hand\'s share of the zoom at none, it comes in nowhere, and at a half by a half; the zoom held out for a man in his line is let in by the lock\'s man alone; out of his line for a moment he is framed as he was; the view gone to somebody else, it lets go',
        `a man 2 m up the screen, the lock at none / half / full: the camera at ${f2(s0.d)} / ${f2(s5.d)} / ${f2(s1.d)} m (no lock at all: ${f2(none.d)}; in full it should be ${f2(full)}), the look-at ${f2(s1.toward)} m toward him`
        + `\n    none to full: the first step ${(first / Math.max(1e-12, most) * 100).toFixed(1)}% of the largest, the most one step differs from the one before ${(jerk / Math.max(1e-12, most) * 100).toFixed(0)}% of the largest, ${back ? 'goes BACK ✗' : 'never back out'} · a button held: ${f2(plain)} m in; the stalk's held click: ${f2(stalk)} m in · a second man 9 m to one side: ${f2(two.d)} m · the share at none: ${f2(flat0.d)} m`
        + `\n    under the sky (the place's zoom 1.15): no lock ${f2(sky.d)} m, the lock just begun ${f2(skyE.d)}, in full ${f2(skyF.d)}, the share at none ${f2(sky0.d)} · in a room (0.92): no lock ${f2(roomN.d)} m, a tenth of the lock ${f2(roomE.d)} · two men, one 2 m up and one 3 m to a side, the lock's share 0.8: the look-at ${f2(m0.f)} up / ${f2(m0.r)} across with no lock, ${f2(m1.f)} / ${f2(m1.r)} on the man up the screen, ${f2(arm.f)} / ${f2(arm.r)} with a man in his arm and the camera at ${f2(arm.d)} m · the button still down and his man gone: ${f2(brk.kept)} m with nobody onto him (from ${f2(brk.d0)}), back out to ${f2(brk.d1)} in a fight`
        + `\n    a door 14 m to a side: ${f2(doorN.d)} m with no lock, ${f2(doorL.d)} in full · the hand's share of the zoom at none: ${f2(amt0.d)} m in full, at a half with the place's zoom 0.8: ${f2(amtH.d)} m (it should be ${f2(half)}) · the place's zoom from 1.15 to 0.92 with a man in his line: ${f2(rNo)} m (held out, as it was), ${f2(rIn)} with him the lock's man, ${f2(rFight)} in a fight, ${f2(rNone)} with the lock's zoom at none, ${f2(rOff)} with the switch off · the lock's man out of his line at half strength: the look-at ${f2(lin.toward)} m toward him (in it: ${f2(s5.toward)}) · the view gone to somebody else at ${f2(gone.d0)} m: ${f2(gone.d1)} m, the strength ${gone.s}`); }
    // 22 through the loop
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        F.setAutoView(false); F.setFindMe('behind', false); FIXEDSTEP.on = fixed; const W = await stand(5), T = tapper(), ctx = ctxOf(W, T), g = W.game, c = g.player.char, I = W.input; K.on = !BREAK; K.turn = false; K.lock = !LOCKBREAK; g.fogOfWar.hidden = () => false;
        const men = g.guards.filter((x: any) => x.state !== 'dead' && !x.civ && isHostile('player', x.team)), gd = men[0]; for (const o of g.guards) if (o !== gd) { o.char.pos[0] = 1; o.char.pos[2] = 1; }
        // a clear line of 8.5 m from where he stands, floor he can stand on for the first 6.5 m of it, and the man 8 m along it
        const p0: [number, number, number] = [c.pos[0], 0, c.pos[2]]; let dir: [number, number] | null = null;
        for (let i = 0; i < 16 && !dir; i++) { const a = i * Math.PI / 8, dx = Math.sin(a), dz = Math.cos(a); let clear = true; for (let m = 0.5; m <= 8.5 && clear; m += 0.5) if (m <= 6.5 && g.col.nav.isBlocked(p0[0] + dx * m, p0[2] + dz * m) || g.col.segmentBlocked([p0[0], 1.3, p0[2]], [p0[0] + dx * m, 1.3, p0[2] + dz * m]) || g.col.segmentBlocked([p0[0], 0.4, p0[2]], [p0[0] + dx * m, 0.4, p0[2] + dz * m])) clear = false; if (clear) dir = [dx, dz]; }
        if (!dir) { ok = false; rows.push(`${fixed ? 'fixed' : 'free'} step: no clear line of 8.5 m from where he stands ✗`); continue; }
        // (a man on a round walks it with the AI off, and one onto him goes to search: each is put back where and how the line wants him before every frame)
        const gp: [number, number] = [p0[0] + dir[0] * 8, p0[2] + dir[1] * 8]; const o2 = men[1]; let p2: [number, number] | null = null, onto: any = null;
        const pin = () => { for (const o of g.guards) { const q = o === gd ? gp : o === o2 && p2 ? p2 : [1, 1]; o.char.pos[0] = q[0]; o.char.pos[2] = q[1]; if (o === gd || o === o2) o.state = 'patrol'; } if (onto) { onto.state = 'alert'; onto.awareness = 1; onto.lastSeenT = g.time; onto.lastKnown = [g.player.char.pos[0], 0, g.player.char.pos[2]]; } }; pin(); const at = (m: number) => g.teleportPlayer([gd.char.pos[0] - dir![0] * m, 0, gd.char.pos[2] - dir![1] * m]);
        at(8); run(ctx, 10, pin); T.tap(); run(ctx, 240, pin); if (!ctx.auto) { ok = false; rows.push(`${fixed ? 'fixed' : 'free'} step: the mode never came on ✗`); continue; }
        const base = ctx.auto.base, d9 = W.cam.desiredDistance;
        let most = 0, prev = W.cam.desiredDistance; const each = () => { pin(); most = Math.max(most, Math.abs(W.cam.desiredDistance - prev)); prev = W.cam.desiredDistance; };
        const ds: number[] = []; for (const m of [7, 5.5, 4, 3, 2]) { at(m); run(ctx, 150, each); ds.push(W.cam.desiredDistance); }
        const closer = ds.every((d, i) => d < (i ? ds[i - 1] : d9) - 0.15), bound = base * K.lockIn * K.zoomRate * DT;
        // a plain button held: the lock's strength stands though he is moved back out, and the camera goes out no further than keeps the man in the picture
        const s2 = ctx.auto.lockS; I.buttons = 4; at(6); run(ctx, 120, each); const heldD = W.cam.desiredDistance, heldS = ctx.auto.lockS; I.buttons = 0; run(ctx, 150, each); const freeD = W.cam.desiredDistance, stilled = heldS === s2 && heldD > ds[4] - 0.15 && heldD < freeD - 0.5;
        // the lock's man: the one it has until another is clearly nearer; the man stalked over both; a man in his arm; nobody with somebody onto him
        let pick = '', picks = !!o2;
        if (o2) { const along = (m: number): [number, number] => [gp[0] - dir![0] * m, gp[1] - dir![1] * m], au = ctx.auto, who = (x: any) => x === gd ? 'the first' : x === o2 ? 'THE SECOND' : 'nobody';
          at(5); p2 = null; run(ctx, 20, pin); const a = au.lockGd; p2 = along(0.4); run(ctx, 20, pin); const b = au.lockGd; p2 = along(1.5); run(ctx, 20, pin); const d = au.lockGd;
          const stalked = A.autoLock(au, g, gd), plain = A.autoLock(au, g, null), held0 = g.player.holding; g.player.holding = {} as any; const arm = A.autoLock(au, g, null); g.player.holding = held0;
          const near2 = stalked && plain && Math.hypot(stalked.at![0] - gp[0], stalked.at![2] - gp[1]) < 0.05 && stalked.stalk && Math.hypot(plain.at![0] - p2[0], plain.at![2] - p2[1]) < 0.05 && !plain.stalk;
          p2 = null; run(ctx, 20, pin);
          // behind a pillar for half a second it is still his man, and for a second and a half it is nobody's; with the rifle up it is nobody's, but for a stalk
          const blocked0 = g.col.segmentBlocked; g.col.segmentBlocked = () => true; run(ctx, 30, pin); const half = au.lockGd; run(ctx, 60, pin); const gone = au.lockGd; g.col.segmentBlocked = blocked0; run(ctx, 20, pin);
          const pl = g.player; Object.defineProperty(pl, 'rifleUp', { get: () => true, configurable: true }); const up = pl.rifleUp, rifle = A.autoLock(au, g, null), rifleStalk = A.autoLock(au, g, gd); delete pl.rifleUp;
          const drag0 = pl.dragging; pl.dragging = {} as any; const tow = A.autoLock(au, g, null); pl.dragging = drag0; const corner = A.autoLock(au, g, null, true);
          const extra = half === gd && gone === null && au.lockGd === gd && up && rifle === null && !!rifleStalk && tow === null && !!corner && corner.stalk;
          picks = extra && a === gd && b === gd && d === o2 && !!near2 && !!arm && arm.at === null && arm.s === 1;
          pick = ` · a second man 0.4 m nearer: it keeps ${who(b)}, 1.5 m nearer: it takes ${who(d) === 'THE SECOND' ? 'the second' : who(d) + ' ✗'}; with the first stalked the lock is ${near2 ? 'his, and the stalk\'s' : 'NOT his ✗'}; a man in his arm: ${arm && arm.at === null ? 'in full, no place' : 'NOT so ✗'}; out of his line for 0.5 s: ${who(half)}, for 1.5 s: ${who(gone)}; the rifle up: ${rifle === null && up ? 'nobody' : 'A LOCK ✗'}, and a stalk ${rifleStalk ? 'still has his man' : 'HAS NOBODY ✗'}; a body in tow: ${tow === null ? 'nobody' : 'A LOCK ✗'}; the wait at a corner: ${corner && corner.stalk ? 'its click stills nothing' : 'STILLED ✗'}`; }
        // …and the man onto him: back out
        prev = W.cam.desiredDistance; at(2); run(ctx, 150, each); const in2 = W.cam.desiredDistance; onto = gd; run(ctx, 300, each); const fought = A.autoLock(ctx.auto, g, gd) === null && (() => { const h = g.player.holding; g.player.holding = {} as any; const r = A.autoLock(ctx.auto, g, null); g.player.holding = h; return r === null; })(); const out = W.cam.desiredDistance;
        // …and not the moment the last man loses him: nobody's for `lockCalm`, then his again
        onto = null; run(ctx, 60, each); const calm1 = A.autoLock(ctx.auto, g, null); run(ctx, Math.round(K.lockCalm * 60), each); const calm2 = A.autoLock(ctx.auto, g, null);
        // …and a fight stamped later than the clock now stands (a checkpoint loaded) is no fight
        ctx.auto.lockFightT = g.time + 2; run(ctx, 12, each); const stale = !ctx.auto.lockFight, calmed = calm1 === null && !!calm2 && stale;
        const good = AUTOVIEW.on && base > 0 && closer && most <= bound && most > 0 && stilled && picks && fought && calmed && in2 < d9 - 2 && out > in2 + 2; if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: a man who is not onto him at 8 m: the camera at ${f2(d9)} m (the hand's own ${f2(base)}); closed on to 7 / 5.5 / 4 / 3 / 2 m: ${ds.map(f2).join(' / ')} m ${closer ? '' : '(NOT nearer at each ✗)'}, the most it moves in a step ${(most / bound * 100).toFixed(0)}% of what the two eases allow · a button held and he is moved back to 6 m: ${stilled ? `the lock's strength stands and the camera is at ${f2(heldD)} m (let go: ${f2(freeD)})` : `NOT STILLED: ${f2(heldD)} m, let go ${f2(freeD)} ✗`} · at 2 m again ${f2(in2)} m, then the man onto him: back out to ${f2(out)} m, and no lock for a stalk or a man in his arm ${fought ? '' : '✗'}; a second after he loses him ${calm1 === null ? 'still nobody' : 'A LOCK ✗'}, ${K.lockCalm} s on ${calm2 ? 'his again' : 'STILL NOBODY ✗'}; a fight stamped ahead of the clock ${stale ? 'is none' : 'STANDS ✗'}${pick}`); }
      line(ok, '22 the whole Game: a man in his line who is not onto him, closed on in stages, brings the camera in at each and never by a step; a held button stills it; with the man onto him it goes back out', rows.join('\n    ')); }
    // 23 the lock's plumbing
    { const W = await stand(5), g = W.game, E = process.env, shipped = E.TPS_PROFILE === 'shipped', row = FROZEN_HOLDS['AUTOCAM.lock'], want = E.TPS_AUTOLOCK !== undefined ? E.TPS_AUTOLOCK === '1' : shipped;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), isOn = (): boolean => K.lock;
      K.lock = true; const old = snap(), had = old.tables.AUTOCAM?.lock === true; delete old.tables.AUTOCAM.lock; J.applyKnobs(g, old); const before = isOn();
      K.lock = true; const on = snap(); K.lock = false; J.applyKnobs(g, on); const kept = isOn();
      line(had && before === false && kept && stoodLock === want && (STAND_ENV as string[]).includes('TPS_AUTOLOCK') && typeof row === 'string' && row.startsWith('TPS_AUTOLOCK=1'),
        `23 CONTROL — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the soft lock ${want ? 'on' : 'off'} by its words, FROZEN_HOLDS carries its row, and a recording from before the key replays with it off`,
        `stood ${stoodLock} (wanted ${want}) · row: '${row}' · a recording carries the key ${had} · from before the key: ${before} · recorded on: ${kept}`); }
  } finally {
    A.autoTuneLoad(tune0); knobsBack(knobs0); Math.random = rnd0; FIXEDSTEP.on = fixedWas; F.setAutoView(viewWas); F.setFindMe('behind', behindWas);
  }
  console.log(`=== autocam: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}

if (import.meta.main) process.exit(await autocamCheck() ? 0 : 1);
