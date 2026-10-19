// EACH GUN'S MODEL AS A PLATE (src/game/gunlook.ts LONG_MODELS / PISTOL_MODELS): the part boxes of every model drawn flat, from its left side and from above,
// in the group's own axes at one scale, the issue carbine's parts (rigProps.ts RIG.m4 over RIG.sc20k) beside them for size — how a shape is looked at on a box
// with no GPU. Marks: the muzzle (the model's far face), the support hand's wrist point, the trigger hand's grip. Colours are the parts' kinds, lightened.
//   bun run tools/qa/gunlook-plates.ts --out DIR      → DIR/gun-plates.svg (+ .png where a headless Chromium is found)
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { LONG_MODELS, PISTOL_MODELS, type ModelPart, type ModelCol } from '../../src/game/gunlook';
import { RIG } from '../../src/game/rigProps';

const arg = (k: string, d = '') => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'docs/shots/gunlook');
type Seg = ModelPart['s'];
const COL: Record<ModelCol, string> = { black: '#3b3d42', metal: '#55585f', steel: '#6a6d75', poly: '#4a5248', furn: '#b39a6b', brass: '#c9a23a', shell: '#b3352b', cloth: '#8f7a52', torch: '#8a8c92', lens: '#d8d8d0' };
const S = 900;   // px per metre
/** a part's outline from the side (z right, y up) and from above (z right, x up = his left) */
function outline(s: Seg): { side: [number, number][]; top: [number, number, number, number] } {
  const off = s.adj?.off ?? [0, 0, 0], th = ((s.adj?.rot ?? [0, 0, 0])[0]) * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th);
  const zd: [number, number] = [-sn, c], yd: [number, number] = [c, sn];   // (y, z) of the part's own z and y axes
  const pt = (l: number, t: number): [number, number] => [off[2] + zd[1] * l + yd[1] * t, off[1] + zd[0] * l + yd[0] * t];
  const side = [pt(s.l0, -s.tall), pt(s.l1, -s.tall), pt(s.l1, s.tall), pt(s.l0, s.tall)];
  const zs = side.map(p => p[0]);
  return { side, top: [Math.min(...zs), Math.max(...zs), off[0] - s.thick, off[0] + s.thick] };
}
function plate(name: string, parts: { s: Seg; col: ModelCol }[], ox: number, oy: number, marks: { muzzle?: number; wrist?: [number, number, number] }): string {
  const X = (z: number) => ox + (z + 0.36) * S, Ys = (y: number) => oy + 0.1 * S - y * S, Yt = (x: number) => oy + 0.36 * S - x * S;
  let g = `<text x="${ox + 6}" y="${oy + 18}" fill="#ddd" font-size="15" font-family="sans-serif">${name}</text>`;
  g += `<line x1="${X(-0.36)}" y1="${Ys(0)}" x2="${X(0.72)}" y2="${Ys(0)}" stroke="#333" stroke-dasharray="3 5"/><line x1="${X(-0.36)}" y1="${Yt(0)}" x2="${X(0.72)}" y2="${Yt(0)}" stroke="#333" stroke-dasharray="3 5"/>`;
  for (let m = -0.3; m <= 0.701; m += 0.1) g += `<line x1="${X(m)}" y1="${Yt(-0.07)}" x2="${X(m)}" y2="${Yt(-0.075)}" stroke="#666"/>`;
  for (const p of parts) { const o = outline(p.s);
    g += `<polygon points="${o.side.map(q => `${X(q[0]).toFixed(1)},${Ys(q[1]).toFixed(1)}`).join(' ')}" fill="${COL[p.col]}" stroke="#111" stroke-width="0.6"/>`; }
  const top = (q: { s: Seg }) => Math.max(...outline(q.s).side.map(c => c[1]));   // (from above: the lowest part first, so what is on top is drawn on top)
  for (const p of [...parts].sort((x, y) => top(x) - top(y))) { const o = outline(p.s);
    g += `<rect x="${X(o.top[0]).toFixed(1)}" y="${Yt(o.top[3]).toFixed(1)}" width="${((o.top[1] - o.top[0]) * S).toFixed(1)}" height="${((o.top[3] - o.top[2]) * S).toFixed(1)}" fill="${COL[p.col]}" stroke="#111" stroke-width="0.6"/>`; }
  if (marks.muzzle !== undefined) g += `<line x1="${X(marks.muzzle)}" y1="${Ys(0.05)}" x2="${X(marks.muzzle)}" y2="${Ys(-0.05)}" stroke="#f55"/>`;
  if (marks.wrist) g += `<circle cx="${X(marks.wrist[2])}" cy="${Ys(marks.wrist[1])}" r="5" fill="none" stroke="#5cf"/><circle cx="${X(marks.wrist[2])}" cy="${Yt(marks.wrist[0])}" r="5" fill="none" stroke="#5cf"/>`;
  g += `<circle cx="${X(-0.09)}" cy="${Ys(-0.08)}" r="4" fill="none" stroke="#fc5"/>`;   // (the trigger hand's wrist: the group's origin is 0.09 ahead of and 0.08 above it)
  return g;
}
if (import.meta.main) {
  mkdirSync(OUT, { recursive: true });
  const M = RIG.m4, R = RIG.sc20k;
  const mk18: { s: Seg; col: ModelCol }[] = [{ s: M.hull, col: 'black' }, { s: M.butt, col: 'furn' }, { s: M.mag, col: 'metal' }, { s: R.grip, col: 'furn' }, { s: M.fore, col: 'furn' }, { s: R.suppressor, col: 'metal' }, { s: M.rail, col: 'black' }, { s: M.optic, col: 'metal' },
    { s: R.foregrip, col: 'furn' }, { s: R.light, col: 'torch' }, { s: R.lens, col: 'lens' }, { s: M.tube, col: 'metal' }, { s: M.peq, col: 'furn' }, { s: M.gl, col: 'metal' }];
  const P = RIG.pistol, gadj = P.grip.adj, pist = (name: string, slide: Seg, grip: Seg, can: Seg | null, mag: Seg | null, frame: ModelCol): [string, { s: Seg; col: ModelCol }[], object] =>
    [name, [{ s: slide, col: 'steel' }, { s: { ...grip, adj: gadj }, col: frame }, ...(can ? [{ s: can, col: 'metal' as ModelCol }] : []), ...(mag ? [{ s: { ...mag, adj: gadj }, col: 'metal' as ModelCol }] : [])], {}];
  const rows: [string, { s: Seg; col: ModelCol }[], { muzzle?: number; wrist?: [number, number, number] }][] = [
    ['Mk 18 (the issue carbine, for size)', mk18, { muzzle: R.suppressor.l1, wrist: R.gripL.off as [number, number, number] }],
    ...(['mk12', 'mp7', 'mk46', 'm1014', 'm870'] as const).map(id => [id, LONG_MODELS[id]!.parts, { muzzle: LONG_MODELS[id]!.ahead, wrist: LONG_MODELS[id]!.gripL.off as [number, number, number] }] as [string, { s: Seg; col: ModelCol }[], { muzzle?: number; wrist?: [number, number, number] }]),
    pist('Glock 19 (the issue pistol, for size)', P.slide, P.grip, P.suppressor, null, 'steel') as never,
    ...(['hk45', 'g18'] as const).map(id => { const m = PISTOL_MODELS[id]!; return pist(id, m.slide, m.grip, m.can, m.mag, m.frame) as never; }),
  ];
  const cw = Math.round(1.1 * S), chh = Math.round(0.5 * S), cols = 2, W = cw * cols, H = chh * Math.ceil(rows.length / cols);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#17181b"/>`;
  rows.forEach((r, i) => { svg += plate(r[0], r[1], (i % cols) * cw, Math.floor(i / cols) * chh, r[2]); });
  svg += '</svg>';
  writeFileSync(`${OUT}/gun-plates.svg`, svg);
  const ch = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => existsSync(p));
  if (ch) spawnSync(ch, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${resolve(OUT)}/gun-plates.png`, `file://${resolve(OUT)}/gun-plates.svg`]);
  console.log(`→ ${OUT}/gun-plates.svg${ch ? ' + .png' : ''}`);
}
