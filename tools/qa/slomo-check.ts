// THE REPLAY'S PACES (src/replay/engineplay.ts SPEEDS: ¼× ½× 1× 2× 4× on the bar, [ and ] step along them). The steps a frame runs and where a slow frame stands
// between the last two are two small functions with no page under them (paceFrame, slowBlend); this holds them:
//   · at 1×, 2× and 4× a frame runs the steps it ran before there was a pace under 1 (the loop as it stood, kept here, on uneven frames and mixed step lengths),
//   · at every pace the tape's steps are run in order, none skipped or run twice, and a second of the display plays `pace` seconds of the tape,
//   · at ¼× and ½× the picture moves on EVERY frame, never backwards and never past the last step run — on a tape of even steps by the display's time × the pace
//     (on uneven steps a step's movement is shown over the next step's length: unbroken, not held to the pace),
//   · a frozen second of the display runs a capped burst and owes nothing after it; the end of the tape runs nothing.
// SLOMO_BREAK=1 makes a slow frame stand on the last step (the picture then moves one frame in four at ¼×): 'the picture moves on every frame' must fail.
//   bun run tools/qa/slomo-check.ts          exit 0 = all pass · 1 = a line failed
// The player itself (the bar, the keys, the men drawn between two steps, a tape played slow and then to its end) is the real page's: engine-replay-page.cjs `slow`.
import { ROOT } from './headless.ts';
const { SPEEDS, paceFrame, slowBlend } = await import(`${ROOT}/src/replay/engineplay.ts`) as { SPEEDS: number[]; paceFrame: (owed: number, wall: number, speed: number, f: number, ticks: number, tAt: ArrayLike<number>) => { n: number; owed: number }; slowBlend: (owed: number, next: number) => number };
let bad = 0; const line = (ok: boolean, label: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** a tape's step times: `even` = every step a sixtieth; else a mix of step lengths, as a recording made on an uneven display carries */
function tape(ticks: number, even: boolean, rnd: () => number): Float64Array { const t = new Float64Array(ticks + 2); for (let i = 1; i < t.length; i++) t[i] = t[i - 1] + (even ? 1 / 60 : [1 / 120, 1 / 60, 1 / 60, 1 / 30][Math.floor(rnd() * 4)]); return t; }
/** the loop as it stood before the paces under 1 (BURST 6) */
function before(owed: number, wall: number, speed: number, f: number, ticks: number, tAt: ArrayLike<number>) { owed += wall * speed; let n = 0; while (n < 6 * speed && f + n < ticks && owed >= tAt[f + n + 1] - tAt[f + n]) { owed -= tAt[f + n + 1] - tAt[f + n]; n++; } if (n >= 6 * speed) owed = 0; return { n, owed }; }

line(SPEEDS.join() === '0.25,0.5,1,2,4', 'the paces are ¼× ½× 1× 2× 4×, slowest first', SPEEDS.join(' '));

{ // 1× and faster: as it was
  const rnd = seeded(11); let frames = 0, differ = 0;
  for (const speed of [1, 2, 4]) for (const even of [true, false]) { const T = tape(4000, even, rnd); let f = 0, owed = 0, f2 = 0, owed2 = 0;
    while (f < 4000 && frames < 200000) { const wall = rnd() < 0.02 ? 0.1 : 1 / 240 + rnd() / 40; const a = paceFrame(owed, wall, speed, f, 4000, T), b = before(owed2, wall, speed, f2, 4000, T); frames++; if (a.n !== b.n || a.owed !== b.owed) differ++; f += a.n; owed = a.owed; f2 += b.n; owed2 = b.owed; } }
  line(differ === 0 && frames > 3000, 'at 1×, 2× and 4× a frame runs the steps it ran before', `${frames} uneven frames over even and mixed tapes, ${differ} differ`);
}

{ // every pace: the tape's time over the display's
  const rows: string[] = []; let ok = true;
  for (const speed of SPEEDS) for (const hz of [60, 144]) { const T = tape(100000, true, seeded(3)); let f = 0, owed = 0, most = 0; const frames = hz * 10;
    for (let i = 0; i < frames; i++) { const P = paceFrame(owed, 1 / hz, speed, f, 100000, T); f += P.n; owed = P.owed; most = Math.max(most, P.n); }
    const want = 600 * speed; if (Math.abs(f - want) > 1 || most > Math.ceil(speed * 60 / hz) + 1) ok = false; rows.push(`${speed}× at ${hz} Hz: ${f} steps (${want}), ${most} a frame at most`); }
  line(ok, 'ten seconds of the display play ten seconds × the pace of the tape, at 60 and at 144 frames a second', rows.join(' · '));
}

{ // the slow paces: the picture between the last two steps
  const rows: string[] = []; let ok = true;
  for (const speed of [0.25, 0.5]) for (const hz of [60, 144]) for (const even of [true, false]) { const ticks = 3000, T = tape(ticks, even, seeded(5)); let f = 1, owed = 0, last = T[0], still = 0, back = 0, ahead = 0, off = 0, frames = 0;   // (step 1 run: two steps stand)
    while (f < ticks - 1 && frames < 100000) { const P = paceFrame(owed, 1 / hz, speed, f, ticks, T); f += P.n; owed = P.owed; frames++;
      const a = slowBlend(owed, T[f + 1] - T[f]), pic = T[f - 1] + a * (T[f] - T[f - 1]);   // (the frame is drawn `a` of the way from the step before the last to the last)
      if (!(a >= 0 && a < 1)) ahead++; if (pic > T[f]) ahead++; if (pic < last - 1e-12) back++; else if (pic - last < 1e-9) still++;
      if (even && frames > 1 && Math.abs((pic - last) - speed / hz) > 1e-6) off++; last = pic; }
    if (still || back || ahead || off) ok = false; rows.push(`${speed}× at ${hz} Hz, ${even ? 'even' : 'mixed'} steps: ${frames} frames, stood still on ${still}, went back on ${back}, past the last step on ${ahead}${even ? `, off the pace on ${off}` : ''}`); }
  line(ok, 'at ¼× and ½× the picture moves on every frame, at the pace, never back and never past the last step run', rows.join(' · '));
}

{ // a hitch, and the end
  const T = tape(100, true, seeded(1)), rows: string[] = []; let ok = true;
  for (const speed of SPEEDS) { const P = paceFrame(0.004, 1, speed, 10, 100, T), cap = Math.ceil(6 * speed); if (P.n !== cap || P.owed !== 0) ok = false; rows.push(`${speed}×: ${P.n} steps, ${P.owed} owed`); }
  const end = paceFrame(0, 1, 0.25, 100, 100, T), none = paceFrame(0, 0, 0.25, 10, 100, T);
  line(ok && end.n === 0 && none.n === 0, 'a frozen second of the display runs a capped burst and owes nothing after; the end of the tape, and a frame of no time, run nothing', rows.join(' · '));
}
console.log(bad ? `\n${bad} line(s) FAILED` : '\nall pass');
process.exit(bad ? 1 : 0);
