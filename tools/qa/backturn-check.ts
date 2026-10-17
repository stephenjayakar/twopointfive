// tools/qa/backturn-check.ts — a man walking backwards on the door behind, let go of, keeps his way while he turns
// (cover.ts COVER.backTurn: turnFrom / turnOut).
//
// Seen on the registry level's walk with four behind Sam: the rear man walks backwards with his gun on the opening
// behind; the deal lets go of that opening (a wall is in its line now, or a mate has it); the order's own pose is
// 'walk forward', and a man walks forward along his BODY, which is still turned to the rear. He went a quarter of a
// metre back the way he came, hooked round and went on, three quarters of a second gone, every time. With the rule
// his feet keep the path while his body comes round, then he walks forward.
//
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) rule off, the walk with four: the fault is there (metres walked against his own path, after a let-go);
//   (3) rule on, the same walk: he turns on his way — next to nothing walked against it, the turn-out was used;
//   (4) and the walk holds: every man ends with Sam, stuck man-frames under the walk's own one percent;
//   (5) a recording from before the key replays with it off; one that carries it keeps it; ?backturn=0 puts it off.
//
//   bun run tools/qa/backturn-check.ts [--verbose]        (both stands: it raises the switch itself)
//   BACKTURN_BREAK=1 …                                    (the rule left off, the same lines asked: must fail)
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { walk } = (await import('./registry-probes.ts')) as any;
const { COVER } = await import(`${ROOT}/src/game/cover.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const BREAK = !!process.env.BACKTURN_BREAK, VERBOSE = process.argv.includes('--verbose');
const SECS = 0.8;   // how long after a let-go his steps are read against the way he was going

interface Go { who: string; t: number; against: number; along: number }
interface Out { w: any; goes: Go[]; turned: number; g: any; stood: boolean }
/** the registry walk with four behind Sam, the rule as `on`: every let-go of a man walking backwards with his body turned from his path (his job gone, nothing kept), and the metres he then
 *  walks AGAINST his own path (each frame's step, on the line from where he stood to the corner of his path he was walking at), summed over SECS. Against
 *  the PATH, not the way he was going when let go: Sam turning round turns the file's paths round, which is what lets go of most of these openings */
async function run(on: boolean): Promise<Out> {
  const was = new Map<any, { back: boolean; away: boolean; wp: number[] | null; pos: number[] }>(), open: { m: any; go: Go; t0: number }[] = [], goes: Go[] = []; let G: any = null, stood = false;
  const w = await walk(4, (g: any, men: any[]) => {
    if (!G) { G = g; stood = COVER.backTurn; COVER.backTurn = on; }   // (after the stand-up: the frozen stand pins it off, the shipped one on)
    const C = g.cover as any, t = g.time;
    for (const m of men) { const J = C.jobs.get(m), k = C.kept.get(m), b = was.get(m);
      if (b?.back && b.away && !J && !k && m.state !== 'dead') { const go = { who: m.callsign, t, against: 0, along: 0 }; goes.push(go); open.push({ m, go, t0: t }); } }
    for (let i = open.length - 1; i >= 0; i--) { const o = open[i], b = was.get(o.m)!, p = o.m.char.pos;
      if (b.wp) { const dx = b.wp[0] - b.pos[0], dz = b.wp[2] - b.pos[2], L = Math.hypot(dx, dz); if (L > 0.15) { const a = ((p[0] - b.pos[0]) * dx + (p[2] - b.pos[2]) * dz) / L; o.go.along += a; if (a < 0) o.go.against -= a; } }
      if (t - o.t0 > SECS) open.splice(i, 1); }
    for (const m of men) { const J = C.jobs.get(m), k = C.kept.get(m), p = m.char.pos, wp = m.path?.[m.pathI]; 
      was.set(m, { back: !!(J ?? k?.J)?.back && !!m.script?.strafe, away: !!wp && Math.cos(m.char.bodyYaw - Math.atan2(wp[0] - p[0], wp[2] - p[2])) < 0.7, wp: wp ? [wp[0], wp[1], wp[2]] : null, pos: [p[0], p[1], p[2]] }); }
  });
  return { w, goes, turned: G.cover.stats.turned, g: G, stood };
}

export const backturnCheck = guarded(async () => {
  const F = family('backturn: a man walking backwards on the door behind, let go of, keeps his way while he turns');
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  try {
    const off = await run(false);
    { const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_BACKTURN, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['COVER.backTurn'];
      F.verdict(off.stood === want && typeof row === 'string' && row.includes('TPS_BACKTURN=1'), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${off.stood} · TPS_BACKTURN ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }
    const on = await run(!BREAK);
    const sum = (o: Out) => o.goes.reduce((a, x) => a + x.against, 0), worst = (o: Out) => o.goes.reduce((a, x) => Math.max(a, x.against), 0), made = (o: Out) => o.goes.reduce((a, x) => a + x.along, 0) / Math.max(1, o.goes.length), say = (o: Out) => `${o.goes.length} let-goes · ${sum(o).toFixed(2)} m against his path in all · worst ${worst(o).toFixed(2)} m · ${made(o).toFixed(2)} m of path made in the ${SECS} s after, on average · the turn-out used ${o.turned} times`;
    if (VERBOSE) for (const o of [off, on]) console.log(`    ${o === off ? 'off' : 'on'}: ${o.goes.map(x => `${x.t.toFixed(1)} ${x.who} ${x.against.toFixed(2)}`).join(' · ')}`);
    F.verdict(off.goes.length >= 10 && sum(off) >= 2 && off.turned === 0, 'the registry walk with four, rule off: the fault is there (a man let go of mid back-pedal walks back the way he came)', say(off));
    F.verdict(on.goes.length >= 10 && on.turned >= 10 && sum(on) <= sum(off) * 0.25 && worst(on) <= 0.12 && made(on) >= made(off), 'with the rule he turns on his way: a quarter or less of those metres, no let-go worse than 0.12 m, and no less of his path made while he turns', say(on));
    const st = (o: Out) => 100 * o.w.stuck / (o.w.n * o.w.frames), fin = (o: Out) => `${o.w.secs.toFixed(1)} s · ends ${o.w.end.map((d: number) => d.toFixed(2)).join(' / ')} m from Sam · stuck ${st(o).toFixed(2)} % · two within half a metre on ${o.w.jam} frames${o.w.short ? ` · ${o.w.short.slice(0, 120)}` : ''}`;
    F.verdict(on.w.alive && !on.w.short && on.w.end.every((d: number) => d < 5.5) && on.w.doorway.length === 0 && st(on) < 1, 'and the walk holds: Sam gets everywhere, every man ends with him, stuck man-frames under the walk\'s own one percent (a rear man stood on his own place far behind a stopped Sam: the file\'s length, not this rule)', `on: ${fin(on)} — off: ${fin(off)}`);
    { const g = on.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      COVER.backTurn = true; const old = snap(); delete old.tables.COVER.backTurn; JOURNAL.applyKnobs(g, old); const without = COVER.backTurn;
      COVER.backTurn = true; const own = snap(); COVER.backTurn = false; JOURNAL.applyKnobs(g, own); const withIt = COVER.backTurn;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = COVER.backTurn; PROFILE.pageSwitches(new URLSearchParams('backturn=0')); const b = COVER.backTurn;
      F.verdict(without === false && withIt === true && a === true && b === false, 'a recording from before the key replays with the rule off (journal.ts applyKnobs), one that carries it keeps it; the page opens with it on and ?backturn=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'backturn=0' → ${b}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }
  return F.done();
});

if (import.meta.main) process.exit((await backturnCheck()) ? 0 : 1);
