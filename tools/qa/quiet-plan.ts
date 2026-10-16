// A QUIET LEVEL'S PLAN PICTURE — tools/qa/level-plan.ts's top-down drawing of the level file with its `scenarios.quiet` block laid over it, read from the
// file alone (no GPU, no game): every beat a man of the shift can be dealt (a line round its waypoints; a filled dot where he stands, with the way he
// faces there — the way he came to it — and the seconds), the starts (Sam and his partner's mark), the places the thing can be, the ways out, the cameras
// with their cones, the breaker, and a legend under the plan saying which beats each patrol set mans.
//   bun run tools/qa/quiet-plan.ts <name> [--out file.svg] [--png] [--scale 36]
//   exit 0 = written · 2 = no such level, or the level has no scenarios.quiet block
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { planSvg, type PlanPen } from './level-plan.ts';
import { loadMap, mapName, rasterise } from './map-plan.ts';

const ROOT = resolve(import.meta.dir, '../..');
const COLOURS = ['#ff6b6b', '#ffb347', '#c792ea', '#5ad1c8', '#f78fb3', '#9bd35a', '#7fb4ff', '#e6e075', '#ff9cee', '#b0b0b0'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function quietPlanSvg(name: string, S = 36): { svg: string; words: string } | null {
  const level = loadMap(name), Q = level.scenarios?.quiet; if (!Q) return null;
  const routes: any[] = level.routes ?? [], sets: string[][] = Q.patrols ?? [routes.map(r => r.name)];
  const colour = (n: string) => COLOURS[Math.max(0, routes.findIndex(r => r.name === n)) % COLOURS.length];
  const rows = 3 + sets.length, footer = 18 * rows + 14;
  const extra = (pen: PlanPen): string[] => {
    const { px, text } = pen, o: string[] = [];
    // the places the thing can be: the room's bounds, a square at the holder's face
    for (const [i, s] of (Q.spots ?? []).entries()) { const B = s.area;
      o.push(`<rect x="${px(B.x0)}" y="${px(B.z0)}" width="${px(B.x1 - B.x0)}" height="${px(B.z1 - B.z0)}" fill="none" stroke="#7df" stroke-width="1" stroke-dasharray="6 4"/>`);
      o.push(`<rect x="${px(s.front[0] - 0.22)}" y="${px(s.front[2] - 0.22)}" width="${px(0.44)}" height="${px(0.44)}" fill="#7df" stroke="#000"/>` + text(s.front[0], s.front[2] + 0.85, `${i + 1} ${s.holder}`, 10, '#bff')); }
    // cameras: the cone at its range (its sweep's middle)
    for (const d of level.devices ?? []) { if (d.kind !== 'camera') continue; const half = (d.fovDeg ?? 60) * Math.PI / 360, r = d.range ?? 8, x = d.pos[0], z = d.pos[2];
      const a0 = d.yaw - half, a1 = d.yaw + half, p = (a: number) => `${px(x + Math.sin(a) * r)} ${px(z + Math.cos(a) * r)}`;
      o.push(`<path d="M ${px(x)} ${px(z)} L ${p(a0)} A ${px(r)} ${px(r)} 0 0 0 ${p(a1)} Z" fill="#ff3df522" stroke="#ff3df5" stroke-width="1"/>` + text(x, z - 0.3, d.name + (d.mains === false ? ' (battery)' : ''), 9, '#ff9cf8')); }
    // the beats: a closed line round the waypoints, a dot where he stands with his facing (the way he came to it) and the seconds
    for (const r of routes) { const c = colour(r.name), P: number[][] = r.points, n = P.length;
      o.push(`<polygon points="${P.map(p => `${px(p[0])},${px(p[2])}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.9"/>`);
      for (let i = 0; i < n; i++) { const p = P[i], w = r.wait?.[i] ?? 0; if (!(w > 0)) { o.push(`<circle cx="${px(p[0])}" cy="${px(p[2])}" r="2.5" fill="${c}"/>`); continue; }
        const q = P[(i + n - 1) % n], dx = p[0] - q[0], dz = p[2] - q[2], L = Math.hypot(dx, dz) || 1;
        o.push(`<line x1="${px(p[0])}" y1="${px(p[2])}" x2="${px(p[0] + dx / L * 1.1)}" y2="${px(p[2] + dz / L * 1.1)}" stroke="${c}" stroke-width="2.5"/>`);
        o.push(`<circle cx="${px(p[0])}" cy="${px(p[2])}" r="5.5" fill="${c}" stroke="#000"/>` + text(p[0], p[2] - 0.3, `${i === 0 ? r.name + ' ' : ''}${w}s`, 9, c)); }
      if (!(r.wait?.[0] > 0)) o.push(text(P[0][0], P[0][2] - 0.3, r.name, 9, c)); }
    // the ways out, the starts
    for (const e of Q.exits ?? []) o.push(`<circle cx="${px(e.x)}" cy="${px(e.z)}" r="9" fill="none" stroke="#6bff8f" stroke-width="2.5"/>` + text(e.x + e.out[0] * 1.0, e.z + e.out[1] * 1.0 + 0.1, 'out', 10, '#bfffcf'));
    for (const [i, s] of (Q.starts ?? []).entries()) { const a = s.sam;
      o.push(`<path d="M ${px(a[0])} ${px(a[2] - 0.3)} l 8 14 l -16 0 z" fill="#6bff8f" stroke="#000"/>` + text(a[0], a[2] + 0.8, `start ${i + 1}`, 10, '#bfffcf'));
      if (s.mate) o.push(`<circle cx="${px(s.mate[0])}" cy="${px(s.mate[2])}" r="4.5" fill="#3aa0ff" stroke="#000"/>`); }
    if (level.breaker) o.push(`<rect x="${px(level.breaker.pos[0] - 0.2)}" y="${px(level.breaker.pos[2] - 0.2)}" width="${px(0.4)}" height="${px(0.4)}" fill="#ffe97a" stroke="#000"/>` + text(level.breaker.pos[0] - 0.9, level.breaker.pos[2] + 0.1, 'breaker', 9, '#ffe97a'));
    // the legend
    const y0 = pen.D * S + 16, line = (k: number, s: string) => `<text x="10" y="${(y0 + 18 * k).toFixed(1)}" font-family="monospace" font-size="12" fill="#ddd">${s}</text>`;
    o.push(line(0, esc(`${name} — the quiet mission: ${Q.thing ?? 'the drive'} · ▲ a start (blue dot = the partner) · ■ a place it can be · ○ a way out · magenta = a camera's cone · orange dot = a light (hollow = off)`)));
    o.push(line(1, esc(`a beat = a dashed loop; a filled dot = where he stands, the stub = the way he faces there, the number = seconds stood`)));
    o.push(line(2, 'beats: ' + routes.map(r => `<tspan fill="${colour(r.name)}">${esc(r.name)}</tspan>`).join(' · ')));
    for (const [i, set] of sets.entries()) o.push(line(3 + i, `set ${i + 1}: ` + set.map(n => `<tspan fill="${colour(n)}">${esc(n)}</tspan>`).join(' · ')));
    return o;
  };
  const svg = planSvg(level, { start: null }, S, extra, footer);
  return { svg, words: `${name} · ${routes.length} beats · ${sets.length} patrol set(s) · ${(Q.starts ?? []).length} start(s) · ${(Q.spots ?? []).length} place(s) · ${(Q.exits ?? []).length} way(s) out` };
}

if (import.meta.main) {
  const argv = process.argv.slice(2); const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN = ['--out', '--png', '--scale']; for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
  const arg = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--scale'].includes(argv[i - 1]))), name = arg ? mapName(arg) : null;
  if (!name) { console.error(`usage: bun run tools/qa/quiet-plan.ts <name> [--out file.svg] [--png] [--scale px-per-metre]${arg ? `\nno level '${arg}' (levels/<name>.json)` : ''}`); process.exit(2); }
  const made = quietPlanSvg(name, Number(opt('--scale') ?? 36)); if (!made) { console.error(`${name}: no scenarios.quiet block in the file`); process.exit(2); }
  const out = resolve(process.cwd(), opt('--out') ?? resolve(ROOT, 'levels', `${name}.plan.svg`));
  writeFileSync(out, made.svg); console.log(made.words); console.log(`wrote ${out}`);
  if (argv.includes('--png')) { const png = out.replace(/\.svg$/, '') + '.png'; const how = await rasterise(out, png); console.log(how ? `wrote ${png} (${how})` : 'no PNG: no SVG rasteriser on this machine — the SVG opens in any browser'); }
}
