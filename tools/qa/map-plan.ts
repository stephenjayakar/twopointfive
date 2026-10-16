// A MAP'S PLAN PICTURE — tools/qa/level-plan.ts's top-down drawing of the level file with the map's own scenario data laid over it, read from the file alone
// (no GPU, no game): the rooms to take with their names and how many men each holds, every defender's mark with the line his gun rests on, the team's
// start (Sam and the four), the ways in (outside doors, and the doors that lead into a held room from floor nobody holds), and — once the file declares
// them (scenarios.roomClear.squads, the format of rebuild/enemy-squads/squad-format.md) — the enemy SQUADS: each squad's rooms and marks in its colour, its
// rally point, the doors it would wedge, where a late squad comes in, and a legend under the plan.
//   bun run tools/qa/map-plan.ts <name> [--out file.svg] [--png] [--scale 36]
//     <name>   a level's name (levels/<name>.json), its file, or a scenario id from src/scene/scenarioList.ts
//     --out    where the SVG goes (default levels/<name>.plan.svg — next to the file; not read by anything)
//     --png    also a PNG beside it, through whichever rasteriser this machine has (rsvg-convert, ImageMagick, macOS qlmanage, Playwright's Chromium);
//              the SVG opens in any browser when none does
//   exit 0 = written · 2 = no such map
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { planSvg, type PlanPen } from './level-plan.ts';

const ROOT = resolve(import.meta.dir, '../..');
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

/** `block` · `levels/block.json` · `block.json` · `block-four` (a row's id) → the level's name, or null. A PATH must be this checkout's own levels/<name>.json:
 *  the tools read the level from there and nowhere else, so another tree's file of the same name is refused, not quietly swapped for ours. */
export function mapName(arg: string): string | null {
  const row = SCENARIOS.find((e: any) => e.id === arg); if (row) return row.level ? row.level.replace(/\.json$/, '') : 'office';
  const n = arg.replace(/^.*\//, '').replace(/\.json$/, ''), file = resolve(ROOT, 'levels', `${n}.json`);
  if (!/^[\w-]+$/.test(n) || !existsSync(file)) return null;
  return arg.includes('/') && resolve(process.cwd(), arg) !== file ? null : n;
}
/** the level as the game loads it (an office-family file gets the office's script and scenarios, as main.ts and the harness give it) */
export function loadMap(name: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }

const SQUAD_COLOURS = ['#ff6b6b', '#ffb347', '#c792ea', '#5ad1c8', '#f78fb3', '#9bd35a'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** squad-format.md's default: a squad wedges every door of its rooms except one that joins two of its own rooms */
export function barricadeOf(sq: any, rooms: any[]): string[] {
  if (Array.isArray(sq.barricade)) return sq.barricade;
  const mine = rooms.filter(r => (sq.rooms ?? []).includes(r.id)); const count = new Map<string, number>();
  for (const r of mine) for (const d of r.doors ?? []) count.set(d.id, (count.get(d.id) ?? 0) + 1);
  return [...count].filter(([, n]) => n < 2).map(([id]) => id);
}

export function mapPlanSvg(name: string, S = 36): { svg: string; words: string } {
  const level: any = loadMap(name);
  const RC: any = level.scenarios?.roomClear, rooms: any[] = RC?.rooms ?? [], squads: any[] = RC?.squads ?? [], team = RC?.team;
  const squadOf = (roomId: string) => squads.findIndex(q => (q.rooms ?? []).includes(roomId));
  const colourOf = (roomId: string) => { const i = squadOf(roomId); return i < 0 ? '#7ddfff' : SQUAD_COLOURS[i % SQUAD_COLOURS.length]; };
  const roomNames = new Set(rooms.map(r => r.name)), door = (id: string) => level.doors.find((d: any) => d.name === id);
  const mid = (d: any): [number, number] => [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2];
  // ways in: outside doors, and doors into a held room from floor that is nobody's room
  const ways = new Map<string, string>();
  for (const d of level.doors) if (d.exterior) ways.set(d.name, 'outside door');
  for (const r of rooms) for (const d of r.doors ?? []) if (!roomNames.has(d.from) && !ways.has(d.id)) ways.set(d.id, `from ${d.from}`);
  const men = rooms.reduce((n, r) => n + (r.garrison ?? 0), 0);
  const legend: string[] = [];
  legend.push(`${RC?.name ?? name} · levels/${name}.json · ${level.boxes.length} boxes · ${level.doors.length} doors · ${rooms.length} rooms to take · ${men} garrison${RC?.maxMen ? ` (at most ${RC.maxMen} at once)` : ''}`);
  const footer = 26 + 18 * (2 + Math.max(1, squads.length));
  const svg = planSvg(level, { start: team ? null : undefined }, S, (pen: PlanPen) => {
    const { px, text } = pen, o: string[] = [];
    for (const r of rooms) {
      const B = r.bounds, c = colourOf(r.id), sq = squads[squadOf(r.id)];
      o.push(`<rect x="${px(B.x0)}" y="${px(B.z0)}" width="${px(B.x1 - B.x0)}" height="${px(B.z1 - B.z0)}" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 4"/>`);
      o.push(text((B.x0 + B.x1) / 2, B.z0 + 1.0, `${r.name} · ${r.garrison} ${r.garrison === 1 ? 'man' : 'men'}${sq ? ` · ${sq.name ?? sq.id}` : ''}`, 12, c));
      for (const m of r.marks ?? []) {
        o.push(`<line x1="${px(m.pos[0])}" y1="${px(m.pos[2])}" x2="${px(m.aimAt[0])}" y2="${px(m.aimAt[2])}" stroke="${c}" stroke-width="1" stroke-dasharray="2 3" stroke-opacity="0.8"/>`);
        o.push(`<circle cx="${px(m.pos[0])}" cy="${px(m.pos[2])}" r="5" fill="${c}" stroke="#000"/>`);
      }
    }
    for (const [id, why] of ways) { const d = door(id); if (!d) continue; const [x, z] = mid(d);
      o.push(`<circle cx="${px(x)}" cy="${px(z)}" r="11" fill="none" stroke="#6bff8f" stroke-width="2.5"/>` + text(x, z + 0.62, `way in (${why})`, 9, '#bfffcf')); }
    squads.forEach((q, i) => {
      const c = SQUAD_COLOURS[i % SQUAD_COLOURS.length], bits: string[] = [];
      const held = rooms.filter(r => (q.rooms ?? []).includes(r.id)); bits.push(held.length ? `holds ${held.map(r => r.name).join(', ')} (${held.reduce((n, r) => n + r.garrison, 0)} men)` : 'holds no room');
      for (const id of q.arrive ? [] : barricadeOf(q, rooms)) { const d = door(id); if (!d) continue; const [x, z] = mid(d);
        o.push(`<rect x="${(x * S - 5).toFixed(1)}" y="${(z * S - 5).toFixed(1)}" width="10" height="10" fill="${c}" stroke="#000" transform="rotate(45 ${px(x)} ${px(z)})"/>`); }
      if (!q.arrive) bits.push(`wedges ${barricadeOf(q, rooms).join(', ') || 'no door'}`);
      if (q.rally) { const [x, , z] = q.rally; o.push(`<path d="M ${px(x)} ${(z * S - 9).toFixed(1)} l 8 9 l -8 9 l -8 -9 z" fill="none" stroke="${c}" stroke-width="2.5"/>` + text(x, z - 0.36, `rally ${q.name ?? q.id}`, 9, c)); bits.push('rally ◇'); }
      if (q.mayLeave === false) bits.push('never leaves its rooms');
      if (q.arrive) { const d = door(q.arrive.door);
        for (const p of q.arrive.spawn ?? []) { o.push(`<circle cx="${px(p[0])}" cy="${px(p[2])}" r="5" fill="none" stroke="${c}" stroke-width="2"/>`);
          if (d) { const [x, z] = mid(d); o.push(`<line x1="${px(p[0])}" y1="${px(p[2])}" x2="${px(x)}" y2="${px(z)}" stroke="${c}" stroke-width="1" stroke-opacity="0.6"/>`); } }
        bits.push(`arrives later by ${q.arrive.door}, ${q.arrive.men ?? (q.arrive.spawn ?? []).length} men (○ where they come from)`); }
      legend.push(`■ ${q.name ?? q.id}: ${bits.join(' · ')}`);
      const y = pen.D * S + 22 + 18 * (2 + i);
      o.push(`<rect x="12" y="${y - 10}" width="11" height="11" fill="${c}"/><text x="30" y="${y}" font-family="monospace" font-size="12" fill="#ddd">${esc(legend[legend.length - 1].slice(2))}</text>`);
    });
    if (team) {
      o.push(`<path d="M ${px(team.sam[0])} ${(team.sam[2] * S - 10).toFixed(1)} l 8 16 l -16 0 z" fill="#6bff8f" stroke="#000"/>` + text(team.sam[0], team.sam[2] + 0.75, 'team start', 10, '#bfffcf'));
      for (const p of team.ops ?? []) o.push(`<circle cx="${px(p[0])}" cy="${px(p[2])}" r="5" fill="#6bff8f" stroke="#000"/>`);
    }
    const line = (k: number, s: string) => `<text x="12" y="${pen.D * S + 22 + 18 * k}" font-family="monospace" font-size="12" fill="#ddd">${esc(s)}</text>`;
    o.push(line(0, legend[0]));
    const key = `▲ team start, ● the four · ● a defender's mark, dotted line = where his gun rests · ○ green ring = a way in${squads.length ? ' · ◆ on a door = that squad wedges it' : ' · no squads declared (scenarios.roomClear.squads)'}`;
    o.push(line(1, key)); legend.splice(1, 0, key);
    return o;
  }, footer);
  return { svg, words: legend.join('\n') };
}

/** SVG → PNG with whatever is on this machine; the name of what worked, or null */
export async function rasterise(svg: string, png: string): Promise<string | null> {
  rmSync(png, { force: true });
  const run = async (cmd: string[]) => { try { const p = Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' }); return (await p.exited) === 0 && existsSync(png); } catch { return false; } };
  if (await run(['rsvg-convert', '-o', png, svg])) return 'rsvg-convert';
  if (await run(['magick', svg, png])) return 'ImageMagick';
  if (await run(['convert', svg, png])) return 'ImageMagick';
  if (process.platform === 'darwin') { const dir = resolve(png, '..'); if (await (async () => { try { const p = Bun.spawn(['qlmanage', '-t', '-s', '2000', '-o', dir, svg], { stdout: 'ignore', stderr: 'ignore' }); await p.exited; const made = `${svg}.png`; if (existsSync(made)) { renameSync(made, png); return true; } } catch { /* next */ } return false; })()) return 'qlmanage'; }
  // (Playwright's Chromium where a machine has it — the cloud container keeps its copy outside any project, at the second path)
  for (const mod of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    let b: any = null;
    try { const { chromium } = await import(mod); b = await chromium.launch(); const page = await b.newPage(); await page.goto(`file://${svg}`, { timeout: 20000 }); const el = await page.$('svg'); if (el) await el.screenshot({ path: png, timeout: 20000 }); }
    catch { /* next */ } finally { try { await b?.close(); } catch { /* gone already */ } }
    if (existsSync(png)) return 'Chromium (Playwright)';
  }
  return null;
}

if (import.meta.main) {
  const argv = process.argv.slice(2); const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN = ['--out', '--png', '--scale']; for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
  const arg = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--scale'].includes(argv[i - 1])));
  const name = arg ? mapName(arg) : null;
  if (!name) { console.error(`usage: bun run tools/qa/map-plan.ts <name> [--out file.svg] [--png] [--scale px-per-metre]${arg ? `\nno map '${arg}' — levels/<name>.json, or a scenario id (${SCENARIOS.map((e: any) => e.id).join(', ')})` : ''}`); process.exit(2); }
  const out = resolve(process.cwd(), opt('--out') ?? resolve(ROOT, 'levels', `${name}.plan.svg`));
  const { svg, words } = mapPlanSvg(name, Number(opt('--scale') ?? 36));
  writeFileSync(out, svg); console.log(words); console.log(`wrote ${out}`);
  if (argv.includes('--png')) { const png = out.replace(/\.svg$/, '') + '.png'; const how = await rasterise(out, png); console.log(how ? `wrote ${png} (${how})` : `no PNG: no SVG rasteriser on this machine (rsvg-convert, ImageMagick, qlmanage, Playwright) — the SVG opens in any browser`); }
}
