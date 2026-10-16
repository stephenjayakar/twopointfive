// SCRIPTED FIGHTS WITH THE LEVEL BROKEN UNDER THEM — playthrough.ts's own runs (the same player, orders, tallies and smells), with walls and crates blown
// mid-fight beside living defenders by this tool, so that what both sides do about a level that changes (game/wallreact.ts) is played through whole fights
// and set against the same fights with that switch off.
//
//   bun run tools/qa/wallreact-play.ts --scn block-squads,compound-four,warehouse-four --seeds 1-24 [--jobs 4] [--cap 300] [--blasts 4] [--gap 7] --json out.json
//   PT_WALLREACT=0 … the same, with nobody reacting (the destruction engine's own build)      --blasts 0 = playthrough.ts exactly (no hand in the fight)
//
// THE BLASTS (nobody's: no man is hurt by them and nobody is named as their maker — what is measured is the reaction to the level, not to a charge): the
// first once a defender is alert, then one every --gap seconds up to --blasts, each beside a living defender taken in turn off the tool's own dice (seeded by
// the run's seed; Math.random is never touched): a contact charge on the FAR face of the nearest standing partition within 4.5 m of him (a hole a man fits
// through), then the nearest crate within 3 m (cover gone), then a charge stood 1.4 m off a partition (a port) — whichever of the three the floor round him
// has, in that order of turn. The rule is the same in both columns; after the first blast the two fights are different fights.
//
// WHAT IT ADDS TO A RUN'S ROW: `blasts` (when, what, beside whom, what went), `wallreact` (the module's counters), `inLine` — man-seconds a living man stood
// planted (a holding defender, a teammate on the mark of an order other than fall-in) within a stride and a half of a hole this tool blew, on its line, open through it at a crouch to the
// floor beyond with none of his own side standing there (the count with them is given beside it), from three seconds after it opened — and `moving`: defenders the room fight had on the move for more than twelve seconds (it plants them at ten).
// exit 0 · 1 = a run ended 'error' or 'stalled' · 2 = bad flags
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { play, report, entryOf, SMELLS, type RunOut } from './playthrough.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { WALLREACT, WALLREACT_STATS, WALLREACT_TEST, WALLREACT_LOG, WALLREACT_DEBUG } = await import(`${ROOT}/src/game/wallreact.ts`);
const { NOBODY_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); DESTRUCTION.on = process.env.PT_DESTR !== '0';   // (playthrough.ts raises THE ONE SWITCH only as the program: a tool that imports play() raises it itself)

type Vec3 = [number, number, number];
const DEBUG = !!process.env.WP_DEBUG;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function dice(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Blast { t: number; what: 'hole' | 'port' | 'crate'; id: number; beside: string; at: [number, number]; walls: number; cover: number; opened: number }
interface Mine { at: Vec3; n: Vec3; u: Vec3; t: number }
export interface WallPlay { blasts: Blast[]; wallreact: Record<string, number>; inLine: number; inLineAll: number; inLineMen: string[]; moving: number }

/** the hand in the fight: returns the tick the module calls every frame and what it gathered */
export function hand(seed: number, max: number, gap: number) {
  const rnd = dice(0x51ed + seed * 2654435761), out: WallPlay = { blasts: [], wallreact: {}, inLine: 0, inLineAll: 0, inLineMen: [], moving: 0 };
  const seen: Record<string, any> = {}; (out as any).seen = seen;
  const mine: Mine[] = [], movingT = new Map<any, number>(), counted = new Set<any>(); let nextAt = -1, lastSample = -1, turn = 0;
  const tick = (g: any) => {
    const t = g.time, F = g.fight; if (!F?.defs || !g.destr?.walls) return;
    const defs = F.defs.filter((D: any) => D.gd.state !== 'dead');
    // ---- the tallies, twice a second
    if (t - lastSample >= 0.5 || t < lastSample) {
      lastSample = t;
      const mates = (who: string, far: number[]) => { const me = g.guards.find((m: any) => m.callsign === who); return g.guards.some((m: any) => m !== me && m.state !== 'dead' && m.team === me?.team && flat(m.char.pos, far) < 2.5) || (me?.team === 'operative' && (flat(g.player.char.pos, far) < 2.5 || (g.cleared.roomAt(far) !== 0 && g.cleared.knownAt(far)))); };   // (… or, for the team, a room their book has cleared)
      const planted: { who: string; p: number[] }[] = defs.filter((D: any) => D.mode === 'hold').map((D: any) => ({ who: D.gd.callsign, p: D.gd.char.pos }));
      for (const m of g.orders?.squad?.() ?? []) { if (m.state === 'dead') continue; const A = g.orders.of(m); if (A?.post && A.arrived && A.order !== 'fallIn' && flat(m.char.pos, A.post) < 0.6) planted.push({ who: m.callsign, p: m.char.pos }); }
      for (const M of mine) { if (t - M.t < 3) continue;
        for (const { who, p } of planted) { const d = (p[0] - M.at[0]) * M.n[0] + (p[2] - M.at[2]) * M.n[2], l = (p[0] - M.at[0]) * M.u[0] + (p[2] - M.at[2]) * M.u[2];
          if (Math.abs(d) > 1.5 || Math.abs(d) < 0.15 || Math.abs(l) > 1.0) continue; const s = d > 0 ? 1 : -1; let far: Vec3 | null = null;
          for (const k of [2.5, 1.75, 1.125]) { const q: Vec3 = [M.at[0] - M.n[0] * s * k, 1.15, M.at[2] - M.n[2] * s * k]; if (!g.col.nav.isBlocked(q[0], q[2])) { far = q; break; } }   // (the module's own 'floor beyond': WALLREACT.beyondM and nearer)
          if (!far || g.col.segmentBlocked(far, [p[0], 0.9, p[2]])) continue;
          out.inLineAll += 0.5; if (mates(who, far)) continue;   // (the floor beyond it is his own side's: he has nothing to hide from there)
          out.inLine += 0.5; if (!out.inLineMen.includes(who)) out.inLineMen.push(who);
          if (DEBUG) { const k = `${who}@${mine.indexOf(M)}`, e = (seen[k] ??= { who, hole: [+M.at[0].toFixed(1), +M.at[2].toFixed(1)], blown: +M.t.toFixed(1), from: +t.toFixed(1), to: t, p: [+p[0].toFixed(1), +p[2].toFixed(1)], d: +d.toFixed(2), l: +l.toFixed(2) }); e.to = +t.toFixed(1); } } }
      for (const D of defs) { if (D.mode === 'move') { const t0 = movingT.get(D) ?? t; movingT.set(D, t0); if (t - t0 > 12 && !counted.has(D)) { counted.add(D); out.moving++; } } else { movingT.delete(D); counted.delete(D); } }
      Object.assign(out.wallreact, WALLREACT_STATS);
    }
    // ---- the blasts
    if (out.blasts.length >= max || !defs.length) return;
    if (nextAt < 0) { if (!defs.some((D: any) => D.gd.state === 'alert') || t < 5) return; nextAt = t + 1; }
    if (t < nextAt) return;
    nextAt = t + gap;
    const walls = g.destr.walls.all().filter((w: any) => !w.open && Math.abs(w.box.yaw ?? 0) < 1e-6);
    const order = [...defs].sort(() => rnd() - 0.5), kinds: Blast['what'][] = [['hole', 'crate', 'port'], ['crate', 'port', 'hole'], ['port', 'hole', 'crate']][turn++ % 3] as Blast['what'][];
    for (const D of order) for (const what of kinds) {
      const p = D.gd.char.pos;
      if (what === 'crate') {
        const c = walls.filter((w: any) => w.kind === 'cover' && flat(w.box.c, p) < 3).sort((a: any, b: any) => flat(a.box.c, p) - flat(b.box.c, p))[0]; if (!c) continue;
        const res = g.destr.blast([c.box.c[0], 0.6, c.box.c[2]], { radius: 1.2, who: NOBODY_ID, chaos: false });
        if (!res.cover && !res.walls) continue;
        out.blasts.push({ t: +t.toFixed(1), what, id: c.id, beside: D.gd.callsign, at: [+c.box.c[0].toFixed(1), +c.box.c[2].toFixed(1)], walls: res.walls, cover: res.cover, opened: res.opened }); return;
      }
      let best: { w: any; q: Vec3; n: Vec3; u: Vec3; d: number } | null = null;
      for (const w of walls) { if (w.kind !== 'wall') continue; const b = w.box, alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2]; if (L < 1.0) continue;
        const s = Math.max(-L + 0.6, Math.min(L - 0.6, alongX ? p[0] - b.c[0] : p[2] - b.c[2])), q: Vec3 = alongX ? [b.c[0] + s, 0, b.c[2]] : [b.c[0], 0, b.c[2] + s], d = flat(q, p);
        if (d > 4.5 || d < 0.5) continue; const side = alongX ? Math.sign(p[2] - b.c[2]) || 1 : Math.sign(p[0] - b.c[0]) || 1;
        if (!best || d < best.d) best = { w, q, n: alongX ? [0, 0, side] : [side, 0, 0], u: alongX ? [1, 0, 0] : [0, 0, 1], d }; }
      if (!best) continue;
      const off = what === 'hole' ? 0.3 : 1.4, at: Vec3 = [best.q[0] - best.n[0] * off, 1.0, best.q[2] - best.n[2] * off];   // (the far face from him)
      const res = g.destr.blast(at, { who: NOBODY_ID, chaos: false }); if (!res.walls && !res.cover) continue;
      mine.push({ at: best.q, n: best.n, u: best.u, t });
      out.blasts.push({ t: +t.toFixed(1), what, id: best.w.id, beside: D.gd.callsign, at: [+best.q[0].toFixed(1), +best.q[2].toFixed(1)], walls: res.walls, cover: res.cover, opened: res.opened }); return;
    }
  };
  return { tick, out };
}

if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN = ['--scn', '--seeds', '--cap', '--jobs', '--json', '--blasts', '--gap', '--one', '--out'];
  for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
  const cap = Number(flag('--cap') ?? 300), max = Number(flag('--blasts') ?? 4), gap = Number(flag('--gap') ?? 7);
  if (flag('--one')) {
    const [scn, seed] = flag('--one')!.split(':'); const H = hand(Number(seed), max, gap); for (const k of Object.keys(WALLREACT_STATS)) (WALLREACT_STATS as any)[k] = 0;
    if (max > 0) WALLREACT_TEST.tick = H.tick;
    const dbg: string[] = []; if (DEBUG) { let last = ''; WALLREACT_DEBUG.log = (m: string) => { if (m.startsWith('  asked') && m !== last) { last = m; dbg.push(m); } }; }
    if (process.env.WP_SET) Object.assign(WALLREACT, JSON.parse(process.env.WP_SET));   // (the module's own knobs for an A/B: WP_SET='{"entryRisk":false}')
    const r = await play(scn, Number(seed), cap, !!process.env.WP_TRACE, {}); const { trace: _t, ...rest } = r; Object.assign(H.out.wallreact, WALLREACT_STATS);
    if (process.env.WP_TRACE) console.log(_t.join('\n'));
    if (DEBUG) { (H.out as any).log = [...WALLREACT_LOG]; (H.out as any).dbg = dbg; }
    writeFileSync(flag('--out')!, JSON.stringify({ ...rest, wallplay: H.out })); process.exit(0);
  }
  const ids = (flag('--scn') ?? 'block-squads,compound-four,warehouse-four').split(','); for (const id of ids) if (!entryOf(id)) { console.error(`no scenario '${id}'`); process.exit(2); }
  const seeds = (flag('--seeds') ?? '1-6').split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
  const jobs = Math.max(1, Number(flag('--jobs') ?? 4)), todo = ids.flatMap(scn => seeds.map(seed => ({ scn, seed }))), runs: (RunOut & { wallplay?: WallPlay })[] = []; let next = 0; const t0 = Date.now();
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
    const file = resolve(tmpdir(), `wallreact-play-${process.pid}-${j.scn}-${j.seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--out', file, '--cap', String(cap), '--blasts', String(max), '--gap', String(gap)], { stdout: 'ignore', stderr: 'pipe' });
    const errText = await new Response(pr.stderr).text(); await pr.exited;
    let r: any; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn: j.scn, seed: j.seed, end: 'error', why: `the run left no result — ${errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`, t: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, orders: 0, refused: [], smells: [], rooms: 0, note: '' }; }
    runs.push(r); console.error(`  ${j.scn}:${j.seed} ${r.end} ${r.t} s · team ${r.team}/${r.of} · ${r.smells.length} smells · ${r.wallplay?.blasts.length ?? 0} blasts${r.end === 'error' ? ` — ${String(r.why).split('\n')[0]}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => ids.indexOf(a.scn) - ids.indexOf(b.scn) || a.seed - b.seed);
  console.log(report(runs));
  console.log(`\nwallreact ${WALLREACT.on ? 'ON' : 'OFF'} · ${max} blasts a run at most, ${gap} s apart`);
  for (const scn of ids) { const R = runs.filter(r => r.scn === scn && r.end !== 'error'); if (!R.length) continue;
    const sum = (f: (r: any) => number) => R.reduce((a, r) => a + f(r), 0), ends: Record<string, number> = {}; for (const r of R) ends[r.end] = (ends[r.end] ?? 0) + 1;
    const smells = SMELLS.map(k => [k, sum(r => r.smells.filter((s: any) => s.kind === k).length)] as const).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ');
    const kinds = ['hole', 'crate', 'port'].map(k => `${k} ${sum(r => r.wallplay?.blasts.filter((b: any) => b.what === k).length ?? 0)}`).join(' · ');
    const W = (k: string) => sum(r => r.wallplay?.wallreact?.[k] ?? 0);
    console.log(`${scn}: ${R.length} runs · ${Object.entries(ends).map(([k, n]) => `${k} ${n}`).join(' · ')} · team up ${sum(r => r.team)}/${sum(r => r.of)} · theirs up ${sum(r => r.hostiles)}/${sum(r => r.hostilesOf)} · mean ${(sum(r => r.t) / R.length).toFixed(0)} s`);
    console.log(`   blasts ${sum(r => r.wallplay?.blasts.length ?? 0)} (${kinds}) · planted in a blown hole's line ${sum(r => r.wallplay?.inLine ?? 0).toFixed(0)} man-seconds over ${sum(r => r.wallplay?.inLineMen.length ?? 0)} men (${sum(r => r.wallplay?.inLineAll ?? 0).toFixed(0)} counting men whose own side holds the floor beyond) · defenders on the move past 12 s: ${sum(r => r.wallplay?.moving ?? 0)}`);
    console.log(`   smells ${sum(r => r.smells.length)}: ${smells || 'none'}`);
    console.log(`   wallreact: rows ${W('rows')} · breaches ${W('breaches')} · rooms merged ${W('merged')} · moved: holding ${W('movedDef')} / in the fight ${W('movedAI')} / team marks ${W('movedOp')} · nowhere to go ${W('noCover')} · watches ${W('watches')} · plans re-dealt ${W('replans')} · openings in the squad's book ${W('openings')}`); }
  console.log(`\n${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ cap, set: {}, wallreact: WALLREACT.on, blasts: max, gap, runs }, null, 1));
  process.exit(runs.some(r => r.end === 'error' || r.end === 'stalled') ? 1 : 0);
}
