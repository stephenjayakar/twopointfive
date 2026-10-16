// THE TRAJECTORY SHEET for broken glass (rebuild/glass/shards.md): the CPU reference of the 'shard' particle kind (src/game/shardModel.ts — the kernel's
// equations and hashes) flown for one piece shot out of a pane 1.35 m up, the round travelling +z. Writes an SVG: side view of the flights by class, top view
// of where everything comes to rest, time-to-rest histogram. `bun run tools/qa/shards-sheet.ts [out.svg]`
import { sprayShards, flyShard, SHARD, type ShardSpray, type ShardState } from '../../src/game/shardModel';
import { SHARDS } from '../../src/game/shards';

const out = process.argv[2] ?? 'docs/shots/shards-sheet.svg';
const H0 = 1.35; const C: [number, number, number] = [0, H0, 0];
const classes: { name: string; col: string; rec: ShardSpray; draw: number }[] = [
  { name: `mid fragments (${SHARDS.midSize * 1e3} mm)`, col: '#2f7fd6', draw: 28, rec: { pos: C, dir: [0, 0, 1], count: 240, speed: 2.8, speedJit: 0.75, spread: 0.55, size: SHARDS.midSize, sizeJit: 0.55, tumble: 22, posJit: 0.12, vadd: [0, -0.2, 0.4], seed: 0x51D5 } },
  { name: `fines (${SHARDS.fineSize * 1e3} mm)`, col: '#e08a1e', draw: 40, rec: { pos: C, dir: [0, 0, 1], count: 480, speed: 4.8, speedJit: 0.85, spread: 0.95, size: SHARDS.fineSize, sizeJit: 0.6, tumble: 45, posJit: 0.12, vadd: [0, -0.1, 0.2], seed: 0xF17E } },
  { name: 'back spray, toward the shooter', col: '#c2417a', draw: 16, rec: { pos: [0, H0, -0.03], dir: [0, 0, -1], count: 90, speed: 1.8, speedJit: 0.8, spread: 1.0, size: SHARDS.fineSize * 0.9, sizeJit: 0.6, tumble: 45, posJit: 0.07, seed: 0xBACC } },
  { name: 'tempered dice (9 mm), a clump letting go', col: '#3aa66b', draw: 24, rec: { pos: [0, H0, 0], dir: [0, 0, 1], count: 300, speed: 0.9, speedJit: 0.8, spread: 1.1, size: 0.009, sizeJit: 0.35, tumble: 30, posJit: 0.2, vadd: [0, -0.3, 0.3], seed: 0xD1CE } },
];
type Flown = { s: ShardState; path: [number, number, number][]; restT: number; hops: number; reach: number };
const flown: Flown[][] = classes.map(c => sprayShards(c.rec).map(s => { const r = flyShard(s, { dt: 1 / 240, maxT: 15, every: 4 }); return { s, path: r.path, restT: r.restT, hops: r.hops, reach: r.reach }; }));
const med = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1]; const p95 = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

const W = 1180, HH = 1000; const svg: string[] = [];
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12"><rect width="${W}" height="${HH}" fill="#11151a"/>`);
const text = (x: number, y: number, t: string, o = '') => svg.push(`<text x="${x}" y="${y}" ${o.includes('fill=') ? '' : 'fill="#cfd6dd"'} ${o}>${esc(t)}</text>`);
text(24, 30, 'Broken glass: where a released piece goes (CPU reference of the shard particle kernel, src/game/shardModel.ts)', 'font-size="16" font-weight="600"');
text(24, 50, `one piece shot out of a pane ${H0} m up; the round travels to the right (+z). gravity ${SHARD.gravity}, drag ${SHARD.drag}/s at ${SHARD.REF_SIZE * 1e3} mm (∝ 1/size, ≤ ${SHARD.DRAG_MAX}), floor restitution ${SHARD.restitution} ± ${SHARD.E_JIT * 100 / 2}%, keep ${SHARD.keep}, sleeps under ${SHARD.sleepV} m/s`, 'fill="#8d99a6"');

// ---- panel 1: side view (z, y)
{ const x0 = 60, y0 = 80, w = 1080, h = 330; const z0 = -2.2, z1 = 4.2, yTop = 2.0; const X = (z: number) => x0 + (z - z0) / (z1 - z0) * w, Y = (y: number) => y0 + h - y / yTop * h;
  svg.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#161b22" stroke="#2a323c"/>`);
  for (let z = -2; z <= 4; z++) { svg.push(`<line x1="${X(z)}" y1="${y0}" x2="${X(z)}" y2="${y0 + h}" stroke="#222a33"/>`); text(X(z) - 8, y0 + h + 16, `${z} m`, 'fill="#8d99a6"'); }
  for (let y = 0.5; y < yTop; y += 0.5) { svg.push(`<line x1="${x0}" y1="${Y(y)}" x2="${x0 + w}" y2="${Y(y)}" stroke="#222a33"/>`); text(x0 - 34, Y(y) + 4, `${y} m`, 'fill="#8d99a6"'); }
  svg.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(2.0)}" stroke="#7fd4e8" stroke-width="3" opacity="0.55"/>`); text(X(0) + 6, y0 + 14, 'the pane', 'fill="#7fd4e8"');
  svg.push(`<circle cx="${X(0)}" cy="${Y(H0)}" r="5" fill="none" stroke="#fff"/>`);
  text(x0 + 8, y0 + 14, '← shooter side', 'fill="#8d99a6"'); text(x0 + w - 150, y0 + 14, 'the round\'s way out →', 'fill="#8d99a6"');
  classes.forEach((c, k) => { const F = flown[k]; const stepN = Math.max(1, Math.floor(F.length / c.draw));
    for (let i = 0; i < F.length; i += stepN) { const p = F[i].path; if (p.length < 2) continue; svg.push(`<polyline fill="none" stroke="${c.col}" stroke-width="0.9" opacity="0.55" points="${p.filter(q => q[2] >= z0 && q[2] <= z1 && q[1] <= yTop).map(q => `${X(q[2]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ')}"/>`); const e = p[p.length - 1]; if (e[2] >= z0 && e[2] <= z1) svg.push(`<circle cx="${X(e[2]).toFixed(1)}" cy="${Y(Math.max(0, e[1])).toFixed(1)}" r="1.8" fill="${c.col}"/>`); } });
  text(x0, y0 - 6, 'SIDE VIEW — flights (a sample of each class), dots where they come to rest', 'font-weight="600"'); }

// ---- panel 2: top view of rest points (z right, x up)
{ const x0 = 60, y0 = 470, w = 640, h = 440; const z0 = -2.2, z1 = 4.2, xr = (z1 - z0) / w * h / 2; const X = (z: number) => x0 + (z - z0) / (z1 - z0) * w, Y = (x: number) => y0 + h / 2 - x / xr * (h / 2);
  svg.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#161b22" stroke="#2a323c"/>`);
  for (let z = -2; z <= 4; z++) svg.push(`<line x1="${X(z)}" y1="${y0}" x2="${X(z)}" y2="${y0 + h}" stroke="#222a33"/>`);
  for (let x = -2; x <= 2; x++) if (Math.abs(x) < xr) svg.push(`<line x1="${x0}" y1="${Y(x)}" x2="${x0 + w}" y2="${Y(x)}" stroke="#222a33"/>`);
  svg.push(`<line x1="${X(0)}" y1="${y0}" x2="${X(0)}" y2="${y0 + h}" stroke="#7fd4e8" stroke-width="3" opacity="0.55"/>`);
  classes.forEach((c, k) => { for (const f of flown[k]) { const p = f.s.p; if (p[2] < z0 || p[2] > z1 || Math.abs(p[0]) > xr) continue; const r = Math.max(0.8, Math.min(3.2, f.s.size * 130)); svg.push(`<circle cx="${X(p[2]).toFixed(1)}" cy="${Y(p[0]).toFixed(1)}" r="${r.toFixed(1)}" fill="${c.col}" opacity="0.7"/>`); } });
  text(x0, y0 - 6, 'TOP VIEW — the litter: every fragment at rest (1 m grid, dot size ∝ fragment size)', 'font-weight="600"'); }

// ---- panel 3: time to rest + the numbers
{ const x0 = 740, y0 = 470, w = 400, h = 200; const tMax = 4; const bins = 32;
  svg.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#161b22" stroke="#2a323c"/>`); text(x0, y0 - 6, 'TIME TO REST (share of each class per 1/8 s)', 'font-weight="600"');
  for (let t = 0; t <= tMax; t++) { const x = x0 + t / tMax * w; svg.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + h}" stroke="#222a33"/>`); text(x - 6, y0 + h + 16, `${t} s`, 'fill="#8d99a6"'); }
  classes.forEach((c, k) => { const hist = new Array(bins).fill(0); for (const f of flown[k]) hist[Math.min(bins - 1, Math.floor(f.restT / tMax * bins))]++; const n = flown[k].length; const mx = 0.45;
    svg.push(`<polyline fill="none" stroke="${c.col}" stroke-width="1.8" points="${hist.map((v, i) => `${(x0 + (i + 0.5) / bins * w).toFixed(1)},${(y0 + h - Math.min(1, v / n / mx) * h).toFixed(1)}`).join(' ')}"/>`); });
  let y = y0 + h + 48;
  classes.forEach((c, k) => { const F = flown[k]; const rest = F.every(f => f.s.asleep);
    svg.push(`<rect x="${x0}" y="${y - 10}" width="12" height="12" fill="${c.col}"/>`); text(x0 + 18, y, `${c.name} — ${F.length} flown`, 'font-weight="600"'); y += 16;
    text(x0 + 18, y, `thrown ${c.rec.speed} m/s ± ${c.rec.speedJit * 100}% · reach median ${med(F.map(f => f.reach)).toFixed(2)} m, 95% within ${p95(F.map(f => f.reach)).toFixed(2)} m`, 'fill="#8d99a6"'); y += 15;
    text(x0 + 18, y, `at rest after median ${med(F.map(f => f.restT)).toFixed(2)} s (95%: ${p95(F.map(f => f.restT)).toFixed(2)} s) · ${med(F.map(f => f.hops))} touches median · ${rest ? 'all asleep' : 'SOME STILL MOVING'}`, 'fill="#8d99a6"'); y += 24; });
}
text(24, HH - 32, 'Computed, not rendered: the same equations, constants and emit draws as particles.wgsl (constants compared by name in probes.ts shards-model).', 'fill="#8d99a6"');
text(24, HH - 14, 'Per-touch dice are keyed differently, so this is the distribution, not any one GPU fragment. Nothing here was seen on a GPU.', 'fill="#8d99a6"');
svg.push('</svg>');
await Bun.write(out, svg.join('\n'));
console.log(`wrote ${out} (${(svg.join('\n').length / 1024).toFixed(0)} KB) — ${classes.map((c, k) => `${c.name.split(' (')[0].split(',')[0]}: reach ${med(flown[k].map(f => f.reach)).toFixed(2)} m, rest ${med(flown[k].map(f => f.restT)).toFixed(2)} s`).join(' · ')}`);
