// FIT THE HEADLESS DUST STAND-IN (tools/qa/dust-standin.ts DUST) TO THE REAL SOLVER — the table measured on the software adapter
// (rebuild/destruction/chaos-calib/dust-transmittance.json: per scenario the puffs emitted and, at sample times, the probe's transmittance along fixed segments).
//   bun run tools/qa/dust-fit.ts <table.json | scenario-N.json …> [--iters 4000] [--seed 1]
// Replays each scenario's puffs through the stand-in's own model (dustDepth, no walls: the calibration site's segments are in the clear) and searches DUST's numbers for
// the least mean squared error in T over every (scenario, sample, segment). Prints the fitted numbers (paste into DUST), the error, and a table of measured vs model.
import { readFileSync } from 'node:fs';
import { DUST, dustDepth, type Blob, type DustParams } from './dust-standin.ts';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { CHAOS } = await import(`${ROOT}/src/game/destruction.ts`);
type Vec3 = [number, number, number];
interface Scn { name: string; puffs: { t: number; pos: Vec3; n: Vec3; scale: number; surf: string; went: boolean }[]; segments: { id: string; a: Vec3; b: Vec3 }[]; samples: { t: number; T: Record<string, number | null> }[] }
const args = process.argv.slice(2); const files = args.filter(a => !a.startsWith('--') && a.endsWith('.json'));
const opt = (k: string, d: number) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const scns: Scn[] = []; for (const f of files) { const J = JSON.parse(readFileSync(f, 'utf8')); if (Array.isArray(J.scenarios)) scns.push(...J.scenarios); else scns.push(J); }
if (!scns.length) { console.error('usage: bun run tools/qa/dust-fit.ts <table.json | scenario-N.json …>'); process.exit(2); }
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** a puff as destruction.ts dustPuff hands it to the solver (the emit record the stand-in keeps) */
const blobOf = (p: Scn['puffs'][number]): Blob => { const K = CHAOS.puff; const dens = K.density * (p.surf === 'drywall' ? 1 : p.surf === 'concrete' ? 0.7 : p.surf === 'fabric' ? 0.35 : 0.5) * Math.min(2, p.scale);
  return { p: [p.pos[0] + p.n[0] * 0.1, p.pos[1] + p.n[1] * 0.1, p.pos[2] + p.n[2] * 0.1], dir: norm([p.n[0], p.n[1] + 0.25, p.n[2]]), t0: p.t, dens, r: K.radius * Math.sqrt(p.scale), speed: K.speed }; };
const data = scns.map(s => ({ name: s.name, blobs: s.puffs.filter(p => p.went).map(blobOf), rows: s.samples.flatMap(sm => s.segments.filter(g => g.id !== 'far' && typeof sm.T[g.id] === 'number').map(g => ({ t: sm.t, id: g.id, a: g.a, b: g.b, T: sm.T[g.id] as number }))) }));
const nRows = data.reduce((n, d) => n + d.rows.length, 0);
const loss = (P: DustParams) => { let e = 0; for (const d of data) for (const r of d.rows) { const m = Math.exp(-dustDepth(d.blobs, r.a, r.b, r.t, P)); e += (m - r.T) ** 2; } return e / nRows; };
// the search: seeded random steps on the log of each free number, kept when better (a few restarts)
const FREE: [keyof DustParams, number, number][] = [['kappa', 0.005, 20], ['sigma0', 0.05, 0.8], ['spread', 0.001, 0.5], ['tau', 0.3, 30], ['tau2', 2, 120], ['slow', 0.01, 0.99], ['throwM', 0.01, 2], ['throwSecs', 0.2, 4], ['rise', 0.0001, 0.3], ['sigmaMax', 0.4, 3]];
let seed = opt('--seed', 1) | 0; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const iters = opt('--iters', 4000);
let best: DustParams = { ...DUST, rise: Math.max(1e-4, DUST.rise) }, bl = loss(best);
for (let restart = 0; restart < 4; restart++) {
  let cur: DustParams = restart === 0 ? { ...best } : { ...best }; if (restart) for (const [k, lo, hi] of FREE) (cur as any)[k] = Math.min(hi, Math.max(lo, (cur as any)[k] * Math.exp((rnd() - 0.5) * 2)));
  let cl = loss(cur), step = 0.5;
  for (let i = 0; i < iters; i++) {
    const nx: DustParams = { ...cur }; const n = 1 + Math.floor(rnd() * 2);
    for (let j = 0; j < n; j++) { const [k, lo, hi] = FREE[Math.floor(rnd() * FREE.length)]; (nx as any)[k] = Math.min(hi, Math.max(lo, (nx as any)[k] * Math.exp((rnd() - 0.5) * 2 * step))); }
    if (nx.tau2 < nx.tau) continue;
    const l = loss(nx); if (l < cl) { cur = nx; cl = l; } if (i % 500 === 499) step = Math.max(0.05, step * 0.7);
  }
  if (cl < bl) { best = cur; bl = cl; }
}
const r3 = (x: number) => +x.toPrecision(3);
console.log(`fit over ${scns.length} scenario(s), ${nRows} (sample, segment) rows — rms error in T ${Math.sqrt(bl).toFixed(3)} (the shipped DUST: ${Math.sqrt(loss(DUST)).toFixed(3)})`);
console.log('DUST =', JSON.stringify(Object.fromEntries(FREE.map(([k]) => [k, r3((best as any)[k])]))));
for (const d of data) {
  let e = 0, blindM = 0, blindP = 0, both = 0, dimM = 0, dimP = 0; for (const r of d.rows) { const m = Math.exp(-dustDepth(d.blobs, r.a, r.b, r.t, best)); e += (m - r.T) ** 2; if (r.T < 0.3) blindM++; if (m < 0.3) blindP++; if (r.T < 0.3 && m < 0.3) both++; if (r.T < 0.8) dimM++; if (m < 0.8) dimP++; }
  console.log(`\n${d.name}: ${d.blobs.length} puffs, ${d.rows.length} rows, rms ${Math.sqrt(e / d.rows.length).toFixed(3)} · blind (T < 0.3) rows: measured ${blindM}, model ${blindP}, both ${both} · dimmed (T < 0.8): measured ${dimM}, model ${dimP}`);
  if (args.includes('--table')) { const ids = [...new Set(d.rows.map(r => r.id))]; const ts = [...new Set(d.rows.map(r => r.t))]; console.log('  t      ' + ids.map(i => i.replace('par_', '').padStart(14)).join(''));
    for (const t of ts) console.log('  ' + String(t).padEnd(6) + ids.map(id => { const r = d.rows.find(x => x.t === t && x.id === id); if (!r) return ''.padStart(14); const m = Math.exp(-dustDepth(d.blobs, r.a, r.b, r.t, best)); return `${r.T.toFixed(2)}/${m.toFixed(2)}`.padStart(14); }).join('')); }
}
