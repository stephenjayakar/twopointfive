// THE PARTICLE RAIN'S RECYCLER IS A HOST BOOK (src/game/rainFx.ts RainShown, host/api.ts HostBooks.rain), not game state: its births and dice follow the particle
// pool, its disc the camera, its drip lines the particle rain's switch, and no rule of the game reads one. So a game on a host with a pool and the same game on
// a host with none must hold the same state (what a server with no picture and a client with one agree on), and a put-back must leave a book that suits the
// emptied ring. The office's night storm, the particle rain's switch on in both:
//   twins     two games, one over a stand-in pool and one over none, 240 frames: the same state word and not a value apart (rollback.ts stateAlike), while the
//             pool took records and the book found its drip lines
//   aside     the drip walk asks the collision world aside (scene/collision.ts): the whole walk run on a game leaves its state word as it was
//   putback   the host's own put-back (host/putback.ts, run headless) drops the book with the ring; the next frame a fresh book finds the same drip lines and
//             files again; 120 frames on the air is full, and the twins are still one state
//   restart   an encounter restarted drops the book too, and the twins are still one state after it
//   bun run tools/qa/rainbook-check.ts            exit 0 = every line passes · 1 = a line failed
//   RAINBOOK_BREAK=1 …                            = the book hung on the game itself, as the table was: must fail (both stands)
import { standUp, ROOT } from './headless.ts';

const DT = 1 / 60;

export async function rainBookCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const RB = await import(`${ROOT}/src/game/rollback.ts`);
  const RF = await import(`${ROOT}/src/game/rainFx.ts`);
  const { hostPutBack } = await import('./putback-host.ts');
  const BREAK = process.env.RAINBOOK_BREAK === '1';
  let checks = 0, fails = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  /** a stand-in for the particle pool: it takes records (twelve a frame), counts what its ring holds, and can be emptied; every other call is a no-op */
  const mk = () => { let queue: { count: number }[] = []; const P: any = { recs: 0, params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: {}, rainStats: { live: 0, emitted: 0 },
    emit(_k: string, _p: number[], _d: number[], count: number) { if (queue.length >= 12) return 0; queue.push({ count }); P.recs++; return count; },
    draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
    clearRain() { queue = []; P.rainStats.live = 0; }, clear() { P.clearRain(); } };
    return new Proxy(P, { get: (t, k) => k in t ? t[k] : typeof k === 'symbol' ? undefined : () => 0 }); };
  const stand = async (pool: boolean) => { const W: any = await quiet(() => standUp({ seed: 7 })); const e = W.game.engine; e.settings.particleRain = true; const P = pool ? mk() : null;
    if (P) { e.particles = P; e.settings.gpuParticles = true; }
    return { W, g: W.game, e, P, step: (n: number) => { for (let i = 0; i < n; i++) { P?.draw(); W.step(DT); } } }; };
  const word = (g: any) => RB.stateHash(g, false, true) as string;
  const book = (R: { e: any }) => R.e.hostBooks?.rain;

  const A = await stand(true), B = await stand(false);
  // ---- twins
  { A.step(240); B.step(240);
    if (BREAK) A.g.rainBook = book(A);   // (the break: the book hung on the game itself, as the table was)
    const hA = word(A.g), hB = word(B.g); const apart: string[] = RB.stateAlike(A.g, B.g, 40); const SA = RF.rainStats(A.g), SBs = RF.rainStats(B.g);
    verdict(hA === hB && apart.length === 0 && A.P.recs > 100 && SA.active && SA.totalBirths > 1000 && SA.edgesTotal > 0 && !SBs.active && /no GPU particles/.test(SBs.why) && !!book(A),
      'twins — a game over a pool and the same game over none hold one state',
      `240 frames of the office's storm, the particle rain's switch on in both: the state word over a pool ${hA}, over none ${hB} · values apart ${apart.length}${apart.length ? ` (${apart.slice(0, 3).map(s => s.split(': ')[0]).join(', ')})` : ''} · the pool took ${A.P.recs} records (${SA.totalBirths} drops born, ${SA.totalDrips} drips off ${SA.edgesTotal} drip points), the other read-out: '${SBs.why}'${BREAK ? ' (RAINBOOK_BREAK=1: the book hung on the game — this line must fail)' : ''}`); }
  // ---- aside
  { const C = await stand(false); C.e.settings.particleRain = false; C.step(3); const had = !!book(C)?.edges; const h0 = word(C.g); const pts = RF.rainDripPoints(C.g); const h1 = word(C.g);
    verdict(!had && pts.length > 0 && h1 === h0, 'aside — the drip walk writes nothing of the game\'s',
      `a game that had found no drip lines: the whole walk run (${pts.length} points off the collision world's rays and gathers), the state word ${h0} before and ${h1} after`); }
  // ---- putback
  { const d0 = JSON.stringify(book(A)?.edges ?? null), f0 = RF.rainStats(A.g).frames;
    const lacked = await hostPutBack(A.g); await hostPutBack(B.g); const gone = book(A) === undefined, empty = A.P.rainStats.live === 0;
    const r0 = A.P.recs; A.step(1); B.step(1); const S1 = { ...RF.rainStats(A.g) }, d1 = JSON.stringify(book(A)?.edges ?? null), filed1 = A.P.recs - r0;
    A.step(120); B.step(120); const S2 = RF.rainStats(A.g), hA = word(A.g), hB = word(B.g);
    verdict(gone && empty && S1.frames === 1 && f0 > 200 && d1 === d0 && d0.length > 10 && filed1 >= 1 && S2.fill === 1 && S2.frames === 121 && hA === hB,
      'putback — the host\'s put-back drops the book with the ring; a fresh book finds the same drip lines and fills the air again',
      `the host's own put-back (stood in for the harness: ${lacked.join(', ') || 'nothing'}): the book dropped ${gone}, the ring emptied ${empty} · the next frame: a fresh book (its frame ${S1.frames}, the old one's ${f0}), the drip lines the same ${d1 === d0}, ${filed1} record(s) filed · 120 frames on: ${(S2.fill * 100).toFixed(0)} % of ${S2.target.toFixed(0)} drops in the air · the state word over a pool ${hA}, over none ${hB}`); }
  // ---- restart
  { await quiet(() => { A.g.restartEncounter(); B.g.restartEncounter(); }); const gone = A.e.hostBooks === undefined;
    A.step(30); B.step(30); const S = RF.rainStats(A.g), hA = word(A.g), hB = word(B.g);
    verdict(gone && S.frames === 30 && S.active && hA === hB, 'restart — an encounter restarted drops the book, and the twins are one state after it',
      `after restartEncounter the host's books: ${gone ? 'dropped' : 'still there'} · thirty frames on a fresh book (its frame ${S.frames}, raining ${S.active}) · the state word over a pool ${hA}, over none ${hB}`); }

  console.log(`\nrainbook-check: ${checks - fails}/${checks} pass${BREAK ? ' (RAINBOOK_BREAK=1: the book hung on the game — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await rainBookCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
