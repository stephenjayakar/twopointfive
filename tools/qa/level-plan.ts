// A level's PLAN as an SVG, drawn from the level file alone — no GPU, no game: what a level looks like from straight above, for pages and for checking a
// generator's geometry by eye where no renderer runs.
//   bun run tools/qa/level-plan.ts levels/records.json [--out plan.svg] [--overlay overlay.json] [--scale 36]
// Drawn: every rasterised static by height (floors, furniture, walls as dark solids), glass panes (blue), door leaves on their hinges with their names, loose
// props (outlined), ceiling panels (yellow = lit, grey dashed = dark), lamps, the spawn. `--overlay` adds a scenario's own data over it:
//   { "rooms": [{ "name", "bounds": {x0,x1,z0,z1} }], "marks": [{ "pos": [x,y,z], "aimAt"?: [x,y,z], "label"? }], "posts": [{ "pos", "label"? }], "start"?: [x,y,z] }
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '../..');
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);

export interface PlanOverlay { rooms?: { name: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[]; marks?: { pos: number[]; aimAt?: number[]; label?: string }[]; posts?: { pos: number[]; label?: string; ok?: boolean }[]; start?: number[] | null }
/** What a drawing over the plan is handed: the plan's own pen (metres in, SVG out), so tools/qa/map-plan.ts draws a map's rooms, squads and ways in at the same scale. */
export interface PlanPen { S: number; W: number; D: number; px(v: number): string; text(x: number, z: number, s: string, size?: number, fill?: string, anchor?: string): string }
/** The plan as SVG text. `extra(pen)` = SVG drawn over the plan, `footer` = that many pixels of blank strip under it (a legend's); `start: null` in the overlay draws no start marker. */
export function planSvg(level: any, overlay: PlanOverlay = {}, S = 36, extra?: (pen: PlanPen) => string[], footer = 0): string {
  const W = WORLD.max[0] - WORLD.min[0], D = WORLD.max[2] - WORLD.min[2];
  const px = (v: number) => (v * S).toFixed(1);
  const esc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const srgb = (a: number[], lift = 0) => { const c = a.map(v => Math.round(255 * Math.min(1, Math.pow(Math.max(0, v), 1 / 2.2) * (1 - lift) + lift))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  const rect = (c: number[], h: number[], yaw: number, attrs: string) => {
    const x = c[0] - h[0], z = c[2] - h[2];
    const rot = Math.abs(yaw) > 1e-6 ? ` transform="rotate(${(-yaw * 180 / Math.PI).toFixed(2)} ${px(c[0])} ${px(c[2])})"` : '';
    return `<rect x="${px(x)}" y="${px(z)}" width="${px(2 * h[0])}" height="${px(2 * h[2])}"${rot} ${attrs}/>`;
  };
  const text = (x: number, z: number, s: string, size = 11, fill = '#fff', anchor = 'middle') => `<text x="${px(x)}" y="${px(z)}" font-family="monospace" font-size="${size}" fill="${fill}" text-anchor="${anchor}" paint-order="stroke" stroke="#000" stroke-width="2.5">${esc(s)}</text>`;

  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${px(W)}" height="${(D * S + footer).toFixed(1)}" viewBox="0 0 ${px(W)} ${(D * S + footer).toFixed(1)}">`);
  o.push(`<rect width="100%" height="100%" fill="#101114"/>`);
  // statics, lowest top first: floors, then furniture, then walls
  const order = level.boxes.map((b: any, i: number) => i).sort((a: number, b: number) => (level.boxes[a].c[1] + level.boxes[a].h[1]) - (level.boxes[b].c[1] + level.boxes[b].h[1]));
  const panels: number[] = [], glass: number[] = [];
  for (const i of order) {
    const b = level.boxes[i]; const top = b.c[1] + b.h[1];
    if (b.flags & BoxFlag.Glass) { glass.push(i); continue; }
    if (b.flags & BoxFlag.NoPrimary) { if (b.c[1] > 2.5 && b.h[0] < 2 && b.h[2] < 2) panels.push(i); continue; }   // ceiling fixtures drawn later; the ceiling slab not at all
    if (b.c[1] - b.h[1] > 2.15 && top <= 3.01) continue;                                                           // lintels / door heads: the doorway reads as a gap
    const wall = top >= 2.9 && b.c[1] - b.h[1] < 0.5 && top < 3.5;
    const lit = b.emissive[0] + b.emissive[1] + b.emissive[2] > 0.5;
    o.push(rect(b.c, b.h, b.yaw, wall ? `fill="#c9c6bd"` : `fill="${srgb(b.albedo, top > 0.02 ? 0.12 : 0.04)}"${lit ? ' stroke="#7fd" stroke-width="1"' : ''}`));
  }
  for (const i of glass) { const b = level.boxes[i]; o.push(rect(b.c, [Math.max(b.h[0], 0.04), b.h[1], Math.max(b.h[2], 0.04)], b.yaw, `fill="#4ab8ff"`)); }
  for (const p of level.props) for (const q of p.parts) {
    const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw); const c = [p.x + cs * q.off[0] + sn * q.off[2], q.off[1], p.z - sn * q.off[0] + cs * q.off[2]];
    o.push(rect(c, q.h, p.yaw + q.yaw, `fill="${srgb(q.albedo, 0.15)}" stroke="#0008" stroke-width="0.5"`));
  }
  for (const i of panels) { const b = level.boxes[i]; const on = b.emissive[0] + b.emissive[1] + b.emissive[2] > 0.5; o.push(rect(b.c, b.h, b.yaw, on ? `fill="#ffe97a55" stroke="#ffe97a" stroke-width="1.5"` : `fill="none" stroke="#888" stroke-width="1" stroke-dasharray="3 3"`)); }
  for (const l of level.lights) { if (l.kind === 'dir') continue; o.push(`<circle cx="${px(l.pos[0])}" cy="${px(l.pos[2])}" r="${l.enabled ? 6 : 4}" fill="${l.enabled ? '#ffb347' : 'none'}" stroke="#ffb347" stroke-width="1.5"/>`); }
  for (const d of level.doors) {
    const a = d.closedDir + (d.angle ?? 0); const x1 = d.hinge[0] + Math.cos(d.closedDir) * d.width, z1 = d.hinge[1] + Math.sin(d.closedDir) * d.width;
    const xo = d.hinge[0] + Math.cos(a) * d.width, zo = d.hinge[1] + Math.sin(a) * d.width;
    o.push(`<line x1="${px(d.hinge[0])}" y1="${px(d.hinge[1])}" x2="${px(xo)}" y2="${px(zo)}" stroke="${d.locked ? '#ff5d5d' : '#e0a050'}" stroke-width="4"/>`);
    o.push(`<circle cx="${px(d.hinge[0])}" cy="${px(d.hinge[1])}" r="3" fill="#e0a050"/>`);
    o.push(text((d.hinge[0] + x1) / 2, (d.hinge[1] + z1) / 2 - 0.25, d.name + (d.locked ? ' (locked)' : ''), 10, '#ffd9a0'));
  }
  // grid ticks every 2 m
  for (let x = 0; x <= W; x += 2) o.push(`<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="6" stroke="#888"/>` + text(x, 0.5, String(x), 9, '#aaa'));
  for (let z = 2; z <= D; z += 2) o.push(`<line x1="0" y1="${px(z)}" x2="6" y2="${px(z)}" stroke="#888"/>` + text(0.3, z + 0.1, String(z), 9, '#aaa', 'start'));
  // overlay
  for (const r of overlay.rooms ?? []) { const B = r.bounds; o.push(`<rect x="${px(B.x0)}" y="${px(B.z0)}" width="${px(B.x1 - B.x0)}" height="${px(B.z1 - B.z0)}" fill="none" stroke="#7df" stroke-width="1" stroke-dasharray="6 4"/>` + text((B.x0 + B.x1) / 2, B.z0 + 0.45, r.name, 12, '#bff')); }
  for (const m of overlay.marks ?? []) {
    if (m.aimAt) o.push(`<line x1="${px(m.pos[0])}" y1="${px(m.pos[2])}" x2="${px(m.aimAt[0])}" y2="${px(m.aimAt[2])}" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="2 3"/>`);
    o.push(`<circle cx="${px(m.pos[0])}" cy="${px(m.pos[2])}" r="5" fill="#ff6b6b" stroke="#000"/>` + (m.label ? text(m.pos[0], m.pos[2] - 0.22, m.label, 9, '#ffb3b3') : ''));
  }
  for (const p of overlay.posts ?? []) o.push(`<circle cx="${px(p.pos[0])}" cy="${px(p.pos[2])}" r="4" fill="${p.ok === false ? '#f0f' : '#6bff8f'}" stroke="#000"/>` + (p.label ? text(p.pos[0], p.pos[2] - 0.2, p.label, 8, '#bfffcf') : ''));
  const start = overlay.start === null ? null : overlay.start ?? level.playerSpawn;
  if (start) o.push(`<path d="M ${px(start[0])} ${px(start[2] - 0.3)} l 8 14 l -16 0 z" fill="#6bff8f" stroke="#000"/>` + text(start[0], start[2] + 0.75, 'start', 10, '#bfffcf'));
  if (extra) o.push(...extra({ S, W, D, px, text }));
  o.push('</svg>');
  return o.join('\n');
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (!file) { console.error('usage: bun run tools/qa/level-plan.ts <level.json> [--out plan.svg] [--overlay overlay.json] [--scale px-per-metre]'); process.exit(2); }
  const S = Number(opt('--scale') ?? 36);
  const out = opt('--out') ?? file.replace(/\.json$/, '') + '.plan.svg';
  const level = loadLevel(parseLevelData(readFileSync(resolve(process.cwd(), file), 'utf8')));
  const overlay = opt('--overlay') ? JSON.parse(readFileSync(resolve(process.cwd(), opt('--overlay')!), 'utf8')) : {};
  writeFileSync(resolve(process.cwd(), out), planSvg(level, overlay, S));
  console.log(`wrote ${out} (${level.boxes.length} boxes, ${level.doors.length} doors, ${S} px/m)`);
}
