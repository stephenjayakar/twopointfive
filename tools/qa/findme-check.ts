// FINDING YOUR OWN MAN, AND THE CAMERA UNDER THE HAND — the check behind src/host/findme.ts and src/ui/findme.ts (four settings in Options > Game, every one
// starting where the game stood before it had them; no switch of the game's, no row the two stands differ in).
//   bun run tools/qa/findme-check.ts        (also `probes.ts findme`; the same on both stands)
// Headless: the whole Game under stepFrame, the loop the page runs, with nothing drawn; where the HUD would draw the ring is asked of findMeRing itself.
//   table    (1) a harness has no store: the table is the starts; a kept line that is missing, broken or out of range reads as the starts, a good one as itself;
//   as was   (2) with the table at its starts the follow camera is not written (its lead is the lead it was built with, to the bit) and a hand's orbit turns
//                the view by exactly what it always did, on the free step and the fixed one;
//            (3) the ring ON, and asked every frame, against it off: one seed, one scripted hand — the same game digest for digest and
//                the same view to the bit (picture only: nothing a man senses, nothing the light meter reads);
//   pan      (4) at none the camera's look-at is the man himself with the cursor six metres off; at half it leans half of what it did; back at full, as built;
//   turn     (5) reversed, the same hand turns the view the other way by the same angle (free step and fixed);
//   behind   (6) the camera key tapped twice: the view comes round over a few tenths of a second (not in one frame) to look where he looked at the tap, and
//                stops there; with the row off the taps do nothing; a pixel of orbit on the tap's own frame does not lose it; a hand's orbit after that, or
//                a pin taking the view, drops a turn under way; taps under the pause card are not kept; with the cursor to one side of
//                him at the tap he still looks where he looked when the view has come round (his aim carried: host/findme.ts AimCarry);
//            (9) that carry: a hand's tremor on the mouse keeps it and so does walking; the mouse moved, a click, a key that may read the cursor, the row
//                put off or the pause card gives the game's cursor back to the mouse, to the pixel, before the tick reads it;
//            (7) what is a double tap: two short presses, and only that — never one held press however long it repeats, never a tap and a hold, a press with
//                another key or an orbit in it, or two taps far apart; three quick taps are one;
//   picture  (8) the ring is at his feet, gone when he is down and nothing with its row off; the two shelved settings (an outline, a shape) are not in the
//                table and a kept line that names them reads without them.
// FINDME_BREAK=1 = the rows are moved and the table is not (the settings do nothing): (4), (5), (6), (8) and (9) must fail.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

export async function findmeCheck(): Promise<boolean> {
  const { stepFrame, FIXEDSTEP } = await import(`${ROOT}/src/host/loop.ts`);
  const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);
  const F = await import(`${ROOT}/src/host/findme.ts`) as typeof import('../../src/host/findme.ts');
  const { findMeRing } = await import(`${ROOT}/src/ui/findme.ts`) as typeof import('../../src/ui/findme.ts');
  const { FINDME, FINDME_START, findMeRead, TapTwice, TAPTWICE, behindYaw } = F;
  const BREAK = process.env.FINDME_BREAK === '1';
  const set: typeof F.setFindMe = BREAK ? () => {} : F.setFindMe;
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== findme: four settings to find your own man and turn the view; at their starts the game as it was ===');
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const fixedWas = FIXEDSTEP.on, startWas = { ...FINDME };
  const ctxOf = (W: any, extra: Record<string, unknown> = {}): any => ({ game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); },
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true, ...extra });
  const stand = async (seed: number) => { Math.random = seeded(1); return await standUp({ seed }) as any; };
  const DT = 1 / 60, f4 = (v: number) => v.toFixed(4);
  try {
    // (1) the table
    { const start = same(startWas, FINDME_START);
      const bad = [null, '', 'no', '[]', '{"pan":"x","ring":1,"turn":2,"behind":"yes"}', '{"pan":NaN}'].every(t => same(findMeRead(t), FINDME_START));
      const good = findMeRead('{"pan":0.4,"ring":true,"outline":true,"shape":true,"turn":-1,"behind":true}')   /* (a line kept by the build that had six) */, clamp = findMeRead('{"pan":7}').pan === 1 && findMeRead('{"pan":-3}').pan === 0;
      line(start && bad && clamp && same(good, { pan: 0.4, ring: true, turn: -1, behind: true }), 'the table is the starts on a harness; a kept line that is broken reads as the starts, a good one as itself',
        `as loaded ${JSON.stringify(startWas)} · broken lines ${bad ? 'all the starts' : 'NOT the starts'} · pan 7 / -3 read ${findMeRead('{"pan":7}').pan} / ${findMeRead('{"pan":-3}').pan}`); }

    // (2) as it was: the lead untouched, the orbit's turn to the bit
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        const W = await stand(5), ctx = ctxOf(W); FIXEDSTEP.on = fixed;
        const lead0 = W.cam.aimLead; F.bindFindMe(W.cam); const kept = Object.is(W.cam.aimLead, lead0) && lead0 === 0.18;
        for (let i = 0; i < 30; i++) stepFrame(ctx, DT);
        let want = W.cam.yaw; const turns = [100, -37, 250, 3];
        for (const dx of turns) { W.input.orbitDX = dx; want += dx * 0.006; stepFrame(ctx, DT); stepFrame(ctx, DT); }
        const good = kept && Object.is(W.cam.yaw, want); if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: lead ${W.cam.aimLead}${kept ? '' : ' ✗'} · yaw after four orbits ${W.cam.yaw} (want ${want})${Object.is(W.cam.yaw, want) ? '' : ' ✗'}`);
      }
      line(ok, 'at the starts the camera\'s lead is the one it was built with and an orbit turns the view exactly as it did', rows.join(' · ')); }

    // (3) picture only: the ring on and asked every frame = the ring off
    { const run = async (on: boolean) => {
        const W = await stand(7), ctx = ctxOf(W); FIXEDSTEP.on = true; FINDME.ring = on; let asked = 0;
        for (let i = 0; i < 480; i++) {
          if (i === 20) W.input.keys.add('KeyW'); if (i === 200) { W.input.keys.delete('KeyW'); W.input.keys.add('KeyD'); } if (i === 320) W.input.keys.delete('KeyD');
          W.input.mouseX = 800 + 300 * Math.sin(i / 40); W.input.mouseY = 500 + 200 * Math.cos(i / 55); if (i % 50 === 10) W.input.orbitDX = 40; if (i === 260) W.input.clicked |= 1;
          stepFrame(ctx, DT); if (on && findMeRing(W.game)) asked++;
        }
        FINDME.ring = false;
        return { d: digestGame(W.game), view: [...W.cam.viewProj], asked, moved: Math.hypot(W.game.player.char.pos[0] - 5.1, W.game.player.char.pos[2] - 15.2) };
      };
      const A = await run(false), B = await run(true), diff = diffDigest(A.d, B.d);
      line(!diff.length && same(A.view, B.view) && B.asked === 480 && A.moved > 1, 'the ring on and asked every frame: the same game digest for digest, the same view to the bit',
        `eight seconds, a walk, an orbit, a shot · he moved ${A.moved.toFixed(1)} m · asked ${B.asked} times · ${diff.length ? `digests differ: ${diff.slice(0, 3).join('; ')}` : 'digests equal'} · view ${same(A.view, B.view) ? 'equal' : 'DIFFERS'}`); }

    // (4) the pan
    { const W = await stand(5), ctx = ctxOf(W); FIXEDSTEP.on = true; F.bindFindMe(W.cam);
      const lean = () => { const p = W.game.player.char.pos; W.cursorAt([p[0] + 6, 0, p[2] + 1]); for (let i = 0; i < 300; i++) stepFrame(ctx, DT);
        const a = W.game.aimPoint, d = W.cam.desired, t = W.cam.target; return { off: Math.hypot(d[0] - p[0], d[2] - p[2]), settled: Math.hypot(t[0] - d[0], t[2] - d[2]), aim: Math.hypot(a[0] - p[0], a[2] - p[2]) }; };
      const full = lean(); set('pan', 0); const none = lean(); set('pan', 0.5); const half = lean(); set('pan', 1); const back = lean();
      const ok = full.aim > 3 && Math.abs(full.off / full.aim - 0.18) < 1e-9 && none.off === 0 && none.settled < 1e-3 && none.aim > 3 && Math.abs(half.off / half.aim - 0.09) < 1e-9 && Object.is(W.cam.aimLead, 0.18) && Math.abs(back.off / back.aim - 0.18) < 1e-9;
      line(ok, 'pan at none: the look-at is the man himself with the cursor metres off; at half it leans half as far; at full the lead is the one the camera was built with',
        `look-at off the man, cursor ${f4(full.aim)} m away — full ${f4(full.off)} m (${f4(full.off / full.aim)} of it) · none ${none.off} m, the view ${none.settled.toExponential(1)} m from settled · half ${f4(half.off)} m (${f4(half.off / half.aim)}) · back at full the lead reads ${W.cam.aimLead}`); }

    // (5) the turn
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        const W = await stand(5), ctx = ctxOf(W); FIXEDSTEP.on = fixed;
        for (let i = 0; i < 10; i++) stepFrame(ctx, DT);
        const y0 = W.cam.yaw; W.input.orbitDX = 100; stepFrame(ctx, DT); stepFrame(ctx, DT); const as = W.cam.yaw - y0;
        set('turn', -1); const y1 = W.cam.yaw; W.input.orbitDX = 100; stepFrame(ctx, DT); stepFrame(ctx, DT); const rev = W.cam.yaw - y1; set('turn', 1);
        const good = Math.abs(as - 0.6) < 1e-12 && Math.abs(rev + 0.6) < 1e-12; if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: the same hand turns it ${f4(as)} rad as it was, ${f4(rev)} reversed${good ? '' : ' ✗'}`);
      }
      line(ok, 'turn direction reversed: the same hand turns the view the other way by the same angle', rows.join(' · ')); }

    // (6) behind
    { const rows: string[] = []; let ok = true;
      for (const fixed of [false, true]) {
        const W = await stand(5); let tap = false, frozen = false; const ctx = ctxOf(W, { ctrlTwice: () => { const v = tap; tap = false; return v; }, frozen: () => frozen }); FIXEDSTEP.on = fixed;
        const fwdDot = (a: number) => { const f = W.cam.planarBasis().fwd; return f[0] * Math.sin(a) + f[2] * Math.cos(a); }, off = (a: number) => Math.abs(Math.atan2(Math.sin(W.cam.yaw - behindYaw(a)), Math.cos(W.cam.yaw - behindYaw(a))));
        const run = (n: number) => { for (let i = 0; i < n; i++) stepFrame(ctx, DT); };
        run(10);
        // the row off: the taps do nothing
        W.cam.rotate(2); const yOff = W.cam.yaw; tap = true; run(30); const rowOff = Object.is(W.cam.yaw, yOff);
        // on, the cursor straight ahead of him: round to where he looked at the tap, not in one frame, and he looks there still
        set('behind', true); const a0 = W.game.player.char.aimYaw, before = fwdDot(a0); tap = true; run(1); const first = fwdDot(a0);
        run(89); const end = fwdDot(a0), yEnd = W.cam.yaw; run(30); const stays = Object.is(W.cam.yaw, yEnd) && ctx.behind == null, exact = off(a0) < 1e-9;
        // a pixel of orbit on the tap's own frame (a hand's tremor on the key): the tap is still answered
        W.cam.rotate(2); run(2); const a1 = W.game.player.char.aimYaw; tap = true; W.input.orbitDX = 1; run(90); const tremor = off(a1) < 1e-9;
        // a hand's orbit on a later frame drops a turn under way
        W.cam.rotate(2); run(2); tap = true; run(2); const mid = W.cam.yaw; W.input.orbitDX = 10; run(2); const yHand = W.cam.yaw; run(30);
        const dropped = ctx.behind == null && Object.is(W.cam.yaw, yHand) && Math.abs(yHand - mid) < 0.2;
        // a pin taking the view drops it too, and nothing is owed when the pin lets go
        W.cam.rotate(2); run(2); tap = true; run(2); W.cam.setPin({ look: [...W.game.player.char.pos], yaw: 0.3, pitch: 0.9, dist: 20 }); run(5); const underPin = ctx.behind == null; W.cam.setPin(null); const yFree = W.cam.yaw; run(30); const pinned = underPin && Object.is(W.cam.yaw, yFree);
        // taps under the pause card are not kept
        W.cam.rotate(1); const yCard = W.cam.yaw; frozen = true; tap = true; run(1); frozen = false; run(30); const card = Object.is(W.cam.yaw, yCard);
        // …and his aim with it: the cursor well to one side of him at the tap, he looks where he looked when the view has come round (the game's cursor carried)
        const p = W.game.player.char.pos; W.cam.rotate(1); run(2); const R = W.cam.planarBasis().right; W.cursorAt([p[0] + R[0] * 5, 0, p[2] + R[2] * 5]); run(20);
        const a2 = W.game.player.char.aimYaw; tap = true; run(90); const viewOn = off(a2) < 1e-9, a3 = W.game.player.char.aimYaw, swung = Math.abs(Math.atan2(Math.sin(a3 - a2), Math.cos(a3 - a2))) * 180 / Math.PI;
        const carried = swung < 1 && ctx.carry != null;
        set('behind', false);
        const good = rowOff && before < 0.9 && first > before && first < 0.999 && end > 1 - 1e-9 && exact && stays && tremor && dropped && pinned && card && viewOn && carried; if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: row off ${rowOff ? 'nothing' : 'TURNED'} · on, view · his facing at the tap ${f4(before)} → ${f4(first)} after one frame → ${end.toFixed(6)} after a second and a half${exact ? '' : ' (not on the facing)'}${stays ? ', then still' : ', NOT still'} · a pixel of orbit on the tap's frame ${tremor ? 'still answered' : 'DROPS IT'} · a later orbit ${dropped ? 'drops it' : 'does NOT drop it'} · a pin ${pinned ? 'drops it' : 'does NOT drop it'} · under the card ${card ? 'nothing kept' : 'KEPT'} · cursor 5 m to his side: the view ${viewOn ? 'comes to' : 'MISSES'} where he looked, and he ${carried ? 'looks there still' : 'has SWUNG'} (${swung.toFixed(2)}° off)${good ? '' : ' ✗'}`);
      }
      line(ok, 'Ctrl tapped twice: the view comes round, over a few tenths of a second, to look where he looked at the tap; nothing with the row off', rows.join('\n    ')); }

    // (9) his aim carried with that view, and given back to the hand
    { const rows: string[] = []; let ok = true; const deg = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;
      for (const fixed of [false, true]) {
        const W = await stand(5); let tap = false, frozen = false; const ctx = ctxOf(W, { ctrlTwice: () => { const v = tap; tap = false; return v; }, frozen: () => frozen }); FIXEDSTEP.on = fixed;
        const I = W.input, C = W.game.player.char, run = (n: number) => { for (let i = 0; i < n; i++) stepFrame(ctx, DT); };
        set('behind', true); run(10);
        // a double tap with the cursor 5 m to his side: where the mouse lay, how he faced, and the carry it leaves
        const sideTap = (pre?: () => void) => { W.cam.rotate(1); run(2); const R = W.cam.planarBasis().right, p = C.pos; W.cursorAt([p[0] + R[0] * 5, 0, p[2] + R[2] * 5]); run(25); pre?.(); const m: [number, number] = [I.mouseX, I.mouseY], a = C.aimYaw; tap = true; run(90); return { m, a }; };
        const real = (m: [number, number]) => Object.is(I.mouseX, m[0]) && Object.is(I.mouseY, m[1]);
        // a hand's tremor on the mouse (3 px): still carried, the game's cursor still not the mouse
        let t = sideTap(); I.mouseX = t.m[0] + 3; I.mouseY = t.m[1]; run(30); const tremor = ctx.carry != null && deg(C.aimYaw, t.a) < 1 && !Object.is(I.mouseX, t.m[0] + 3);
        // the mouse moved (40 px): the cursor is the mouse to the pixel on that tick, and he turns to it
        I.mouseX = t.m[0] + 40; I.mouseY = t.m[1]; run(1); const movedBack = ctx.carry == null && real([t.m[0] + 40, t.m[1]]); run(60); const turned = deg(C.aimYaw, t.a);
        // a click with the mouse not moved: the mouse again before the tick reads it
        t = sideTap(); const heldC = ctx.carry != null; I.clicked |= 4; run(1); const click = heldC && ctx.carry == null && real(t.m);
        // a key that may read the cursor
        t = sideTap(); const heldK = ctx.carry != null; I.pressed.add('KeyX'); run(1); const key = heldK && ctx.carry == null && real(t.m);
        // walking does not let go: he walks a second with his facing kept
        t = sideTap(); const p0 = [C.pos[0], C.pos[2]]; I.keys.add('KeyW'); I.pressed.add('KeyW'); run(60); I.keys.delete('KeyW'); const went = Math.hypot(C.pos[0] - p0[0], C.pos[1 + 1] - p0[1]), walkOff = deg(C.aimYaw, t.a), walk = ctx.carry != null && went > 0.5 && walkOff < 2;
        // the row put off, and the pause card: the mouse back at once
        I.mouseX = t.m[0]; I.mouseY = t.m[1]; run(1); t = sideTap(); set('behind', false); run(1); const rowOff = ctx.carry == null && real(t.m); set('behind', true);
        t = sideTap(); frozen = true; run(1); const card = ctx.carry == null && real(t.m); frozen = false;
        // a second double tap under a carry still knows where the mouse is
        t = sideTap(); W.cam.rotate(1); tap = true; run(90); const again = ctx.carry != null; I.pressed.add('KeyX'); run(1); const twice = again && ctx.carry == null && real(t.m);
        set('behind', false);
        const good = tremor && movedBack && turned > 20 && click && key && walk && rowOff && card && twice; if (!good) ok = false;
        rows.push(`${fixed ? 'fixed' : 'free'} step: a 3 px tremor ${tremor ? 'keeps it' : 'LETS GO'} · the mouse moved 40 px ${movedBack ? 'gives the cursor back to the pixel' : 'does NOT give it back'} and he turns ${turned.toFixed(0)}° to it · a click ${click ? 'gives it back' : 'does NOT'} · the order key ${key ? 'gives it back' : 'does NOT'} · a second's walk of ${went.toFixed(1)} m ${walk ? 'keeps it' : 'LOSES it'} (${walkOff.toFixed(2)}° off) · the row off ${rowOff ? 'gives it back' : 'does NOT'} · the card ${card ? 'gives it back' : 'does NOT'} · a second double tap under it ${twice ? 'still knows the mouse' : 'LOSES the mouse'}${good ? '' : ' ✗'}`);
      }
      line(ok, 'after the double tap his aim stays on what he faced until the hand uses the mouse or a key that may read the cursor; then the cursor is the mouse again', rows.join('\n    ')); }

    // (7) what is a double tap (no setting in it: the same with the break)
    { const T0 = TAPTWICE, play = (ev: [string, number, number?][]) => { const T = new TapTwice(); let n = 0; for (const [k, t, px] of ev) { if (k === 'd') T.down(t); else if (k === 'u') { if (T.up(t)) n++; } else if (k === 'o') T.other(); else T.moved(px ?? 0); } return n; };
      const held: [string, number][] = [['d', 0]]; for (let t = 30; t < 3000; t += 30) held.push(['d', t]); held.push(['u', 3000]);
      const cases: [string, number, number][] = [
        ['two taps', play([['d', 0], ['u', 80], ['d', 200], ['u', 280]]), 1],
        ['one press held three seconds, repeating', play(held), 0],
        ['one tap', play([['d', 0], ['u', 80]]), 0],
        ['a tap, then a hold', play([['d', 0], ['u', 80], ['d', 200], ['u', 200 + T0.tapMs + 50]]), 0],
        ['a hold, then a tap', play([['d', 0], ['u', T0.tapMs + 50], ['d', T0.tapMs + 150], ['u', T0.tapMs + 230]]), 0],
        ['two taps too far apart', play([['d', 0], ['u', 80], ['d', 80 + T0.gapMs + 50], ['u', 80 + T0.gapMs + 130]]), 0],
        ['…and a third soon after', play([['d', 0], ['u', 80], ['d', 500], ['u', 580], ['d', 700], ['u', 780]]), 1],
        ['another key between the taps', play([['d', 0], ['u', 80], ['o', 120], ['d', 200], ['u', 280]]), 0],
        ['another key inside a tap (Ctrl + a letter)', play([['d', 0], ['o', 40], ['u', 80], ['d', 200], ['u', 280]]), 0],
        ['a short orbit, then a tap', play([['d', 0], ['m', 40, T0.driftPx + 20], ['u', 80], ['d', 200], ['u', 280]]), 0],
        ['a hand\'s tremor inside the taps', play([['d', 0], ['m', 40, 3], ['u', 80], ['d', 200], ['m', 240, 3], ['u', 280]]), 1],
        ['three quick taps', play([['d', 0], ['u', 80], ['d', 200], ['u', 280], ['d', 400], ['u', 480]]), 1],
        ['four quick taps', play([['d', 0], ['u', 80], ['d', 200], ['u', 280], ['d', 400], ['u', 480], ['d', 600], ['u', 680]]), 2],
      ];
      const wrong = cases.filter(c => c[1] !== c[2]);
      line(!wrong.length, 'a double tap is two short presses with nothing else in them, and never one held press', wrong.length ? wrong.map(c => `${c[0]}: ${c[1]} (want ${c[2]})`).join(' · ') : cases.map(c => `${c[0]}: ${c[1]}`).join(' · ')); }

    // (8) the picture
    { const W = await stand(5), ctx = ctxOf(W); FIXEDSTEP.on = true; for (let i = 0; i < 30; i++) stepFrame(ctx, DT);
      const g = W.game, pl = g.player, p = pl.char.pos;
      const off = findMeRing(g); set('ring', true); const r = findMeRing(g); const wasDown = pl.down; pl.down = true; const rDown = findMeRing(g); pl.down = wasDown; set('ring', false);
      const ringOk = !off && !!r && r[0] === p[0] && r[2] === p[2] && !rDown, shelved = !('outline' in FINDME) && !('shape' in FINDME) && !('outline' in FINDME_START) && !('shape' in FINDME_START);
      line(ringOk && shelved, 'the ring at his feet, gone when he is down, nothing with its row off; the outline and the shape are not in the table',
        `ring ${r ? `at ${r[0].toFixed(1)}, ${r[2].toFixed(1)}` : 'none'}${ringOk ? '' : ' ✗'} (down: ${rDown ? 'drawn ✗' : 'none'} · row off: ${off ? 'drawn ✗' : 'none'}) · the table's keys: ${Object.keys(FINDME).join(', ')}`); }
  } finally { Object.assign(FINDME, startWas); FIXEDSTEP.on = fixedWas; }
  console.log(all ? '\nfindme: ALL PASS' : '\nfindme: FAIL');
  return all;
}
if (import.meta.main) process.exit((await findmeCheck()) ? 0 : 1);
