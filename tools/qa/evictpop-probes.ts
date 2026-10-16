// The 'evictpop' probe — THE EVICTION POP's two answers (src/game/breakTable.ts pick() / dissolve(), behind the cut switch and destructionSwitch.ts EVICT.on):
//   bun run tools/qa/probes.ts evictpop [--verbose]
//   · a spawn over the pool's cap takes the SMALLEST resting piece's slot (ties: the oldest), not the oldest piece's — the plank that lay there longest stays;
//   · what the evicted piece leaves is sized to it: 4 chips for a mug's worth up to 14 for a plank, born at stations ALONG the box (not a ball at its middle), and
//     its row's dust once;
//   · a piece in the air is never taken (the next smallest at rest goes); one sliding off a boot may be;
//   · the switch off: the oldest piece, and the old 4‥6 chips at its middle; the cut switch off: the oldest piece and nothing emitted — the pool as it always was.
import { standUp, ROOT, fake } from './headless.ts';

const { cutConfig } = await import(`${ROOT}/src/scene/cut.ts`);
const { BREAKS, BREAK_STATS } = await import(`${ROOT}/src/game/breakTable.ts`);
const { EVICT } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { makeBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60; const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
async function quiet<T>(fn: () => Promise<T> | T): Promise<T> { if (VERBOSE) return await fn(); const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } }

const PLANK: Vec3 = [0.5, 0.012, 0.06], MUG: Vec3 = [0.04, 0.05, 0.04], LUMP: Vec3 = [0.09, 0.05, 0.07], SLAB: Vec3 = [0.2, 0.012, 0.15];
interface Emit { kind: string; pos: Vec3; n: number; opts: any }
/** eight pieces at rest in the corridor, the pool's cap eight: [0] the plank (the oldest), [1] a mug, [2] a lump, [3] a second mug, [4‥7] slabs */
async function stage(cut: boolean) {
  Math.random = seeded(9103); cutConfig.on = cut;
  const W: any = await quiet(() => standUp({ uploadEvery: 1 })); const g = W.game; cutConfig.on = cut; g.godMode = true; g.aiEnabled = false; g.playerInvisible = true;
  const emits: Emit[] = []; const P: any = new Particles(fake('device'), fake('sceneLayout')); const emit0 = P.emit.bind(P);   // (the real queue, on the harness's device — and a note of every record asked for)
  P.emit = (kind: string, pos: Vec3, d: Vec3, n: number, opts: any) => { emits.push({ kind, pos: [pos[0], pos[1], pos[2]], n, opts }); return emit0(kind, pos, d, n, opts); }; W.engine.particles = P; W.engine.settings.gpuParticles = true; W.engine.settings.debrisCap = 8;
  for (const gd of g.guards) { gd.hold = true; gd.heardUpTo = 1e12; }
  const D = g.destr.debris; const p0 = g.guards[0].char.pos; const sizes = [PLANK, MUG, LUMP, MUG, SLAB, SLAB, SLAB, SLAB];
  const ps = sizes.map((h, i) => D.spawnRaw('chunk', makeBox({ c: [p0[0] + 1.2 + i * 0.55, 0.2, p0[2] + (i % 2 ? 0.35 : -0.35)], h, yaw: i * 0.5, albedo: [0.7, 0.7, 0.68] }), [0, 0, 0], [0, 0, 0]));
  for (let f = 0; f < 150; f++) W.step(DT);
  const next = () => { emits.length = 0; return spawnNext(); }; const spawnNext = () => D.spawnRaw('chunk', makeBox({ c: [p0[0] + 0.8, 0.2, p0[2]], h: LUMP, yaw: 0, albedo: [0.7, 0.7, 0.68] }), [0, 0, 0], [0, 0, 0]);
  return { W, g, D, ps, emits, next, rested: ps.every((c: any) => c && c.rest) && D.list.length === 8 };
}

export async function evictPop(): Promise<boolean> {
  console.log('\n=== evictpop: a spawn over the cap takes the smallest resting piece, and what it leaves is sized to it ==='); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const cut0 = cutConfig.on, k0 = EVICT.on;
  try {
    EVICT.on = true;
    { const S = await stage(true); const { D, ps, emits } = S; const c0 = BREAK_STATS.crumbled;
      S.next(); const first = ps.findIndex((c: any) => !D.list.includes(c)); const e1 = emits.splice(0);
      S.next(); const gone2 = ps.map((c: any, i: number) => D.list.includes(c) ? -1 : i).filter((i: number) => i >= 0);
      verdict(S.rested && first === 1 && gone2.join() === '1,3', 'the smallest goes first, the older of two equals before the younger; the old plank stays', `eight at rest ${S.rested} · 9th piece took the slot of #${first} (the first mug), the 10th left #${gone2.join(', #')} gone · the plank (#0, the oldest) still lies: ${D.list.includes(ps[0])}`);
      const chips = e1.filter(e => e.kind === 'debris'), dust = e1.filter(e => e.kind === 'dust');
      verdict(chips.reduce((a, e) => a + e.n, 0) === BREAKS.sizedChips[0] && chips.length === 1 && dust.length === 1 && BREAK_STATS.crumbled === c0 + 2, 'a mug\'s worth leaves the fewest chips, at one station', `${chips.reduce((a, e) => a + e.n, 0)} chips in ${chips.length} record · dust records ${dust.length}`);
      emits.length = 0; const plank = ps[0]; D.breaks.evicted(plank); const pc = emits.filter(e => e.kind === 'debris'), pd = emits.filter(e => e.kind === 'dust');
      const ax = quat.rotate(plank.box.rot ?? quat.yaw(plank.box.yaw), [1, 0, 0]); const along = pc.map(e => (e.pos[0] - plank.box.c[0]) * ax[0] + (e.pos[1] - plank.box.c[1]) * ax[1] + (e.pos[2] - plank.box.c[2]) * ax[2]);
      const across = pc.map((e, i) => Math.hypot(e.pos[0] - plank.box.c[0] - ax[0] * along[i], e.pos[1] - plank.box.c[1] - ax[1] * along[i], e.pos[2] - plank.box.c[2] - ax[2] * along[i]));
      verdict(pc.reduce((a, e) => a + e.n, 0) === BREAKS.sizedChips[1] && pc.length === 3 && Math.max(...along) - Math.min(...along) > 0.5 && along.every(a => Math.abs(a) <= 0.5) && across.every(d => d < 1e-6) && pd.length === 1,
        'a metre of plank leaves the most, born along its length — and its dust once', `${pc.reduce((a, e) => a + e.n, 0)} chips at ${pc.length} stations ${along.map(f2).join(' / ')} m along it (off its axis ${Math.max(...across).toFixed(3)} m, each scattered ±${f2(pc[0]?.opts.posJit ?? 0)} m) · dust records ${pd.length}`);
      emits.length = 0; D.breaks.evicted(ps[2]); const lc = emits.filter(e => e.kind === 'debris').reduce((a, e) => a + e.n, 0);
      verdict(lc > BREAKS.sizedChips[0] && lc < BREAKS.sizedChips[1] && lc <= 8, 'a lump in between leaves a number in between', `${lc} chips for a 0.09 m lump`); }
    { const S = await stage(true); const { D, ps } = S; ps[1].rest = false; ps[1].v = [0, 3, 0]; S.next(); const a = ps.map((c: any, i: number) => D.list.includes(c) ? -1 : i).filter((i: number) => i >= 0);
      ps[2].rest = false; ps[2].foot = true; ps[2].v = [0.4, 0, 0]; const refused0 = D.stats.refused; S.next(); const b = ps.map((c: any, i: number) => D.list.includes(c) ? -1 : i).filter((i: number) => i >= 0 && !a.includes(i));
      verdict(a.join() === '3' && b.join() === '2' && D.stats.refused === refused0, 'a piece in the air is never taken — the next smallest at rest is; one sliding off a boot may be', `first mug thrown up: #${a.join(', #')} went (the second mug) · the lump sliding off a boot: #${b.join(', #')} went next (the smallest left that may go)`); }
    { EVICT.on = false; const S = await stage(true); const { D, ps, emits } = S; S.next(); const first = ps.findIndex((c: any) => !D.list.includes(c));
      const chips = emits.filter(e => e.kind === 'debris'); const n = chips.reduce((a, e) => a + e.n, 0); const off = Math.max(...chips.map(e => Math.hypot(e.pos[0] - ps[0].box.c[0], e.pos[2] - ps[0].box.c[2])));
      verdict(first === 0 && n >= BREAKS.crumbleChips[0] && n <= BREAKS.crumbleChips[1] && off < 1e-6 && !emits.some(e => e.kind === 'dust'), 'the switch off: the oldest piece (the plank) goes, into the old ball of chips at its middle', `#${first} evicted · ${n} chips in ${chips.length} records at its middle · dust records ${emits.filter(e => e.kind === 'dust').length}`); }
    { EVICT.on = true; const S = await stage(false); const { D, ps, emits } = S; S.next(); const first = ps.findIndex((c: any) => !D.list.includes(c));
      verdict(first === 0 && emits.length === 0, 'the cut switch off: the oldest piece goes and nothing is emitted — the pool as it always was', `#${first} evicted · ${emits.length} emit records`); }
  } finally { cutConfig.on = cut0; EVICT.on = k0; }
  console.log(`=== evictpop: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); if (!all) process.exitCode = 1; return all;
}
