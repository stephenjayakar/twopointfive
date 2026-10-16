// A ROOM ENTRY FROM ABOVE, BEFORE AND AFTER — the same seeded playthrough run twice (tools/qa/playthrough.ts with PT_PATHS=rec: paths-watch.ts records every
// man's place and every leaf's angle through each entry), once as the entry was and once with the real paths through the door on (TPS_DOORPATH=1,
// src/game/doorpath.ts), and one of its entries drawn as two rows of top-down panels: walls and furniture from the level's statics, the leaf as it stood, each
// man a disc of his own width with his facing and the trail he has walked, a red ring on a man the watcher has in a leaf / through a friend / in a static.
// No renderer: this is where the men WERE, not how they looked.
//
//   bun run tools/qa/entry-strip.ts room-clear-four:1 [--entry 1] [--panels 6] [--every 0.5] [--lead 0.2] [--out dir] [--name file]
//       → dir/<name>.svg (+ .png through the box's headless Chromium when it is there) — default dir docs/shots, name entry-strip-<scn>-<seed>
//   … --from before.json after.json     draw from two runs' JSON already on disk (playthrough.ts --one … --out, PT_PATHS=rec)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const SHELL = (() => { const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; if (!existsSync(base)) return null; for (const d of readdirSync(base)) { const f = `${base}/${d}/chrome-linux/headless_shell`; if (existsSync(f)) return f; } return null; })();
const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const spec = process.argv[2];
if (!spec || spec.startsWith('--') && spec !== '--from') { console.log('entry-strip.ts <scn:seed> [--entry n] [--panels 6] [--every 0.5] [--lead 0.2] [--out dir] [--name file] | --from before.json after.json'); process.exit(2); }

function run(on: boolean): any {
  const f = `${tmpdir()}/entry-strip-${process.pid}-${on ? 'on' : 'off'}.json`, env: Record<string, string> = { ...process.env as any, PT_PATHS: 'rec' };
  if (on) env.TPS_DOORPATH = process.env.TPS_DOORPATH ?? '1'; else delete env.TPS_DOORPATH;
  const r = spawnSync('bun', ['run', `${ROOT}/tools/qa/playthrough.ts`, '--one', spec, '--out', f], { env, encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(f)) { console.error(r.stdout, r.stderr); throw new Error(`the ${on ? 'after' : 'before'} run did not finish`); }
  return JSON.parse(readFileSync(f, 'utf8'));
}
const fromI = process.argv.indexOf('--from');
const [A, B] = fromI > 0 ? [JSON.parse(readFileSync(process.argv[fromI + 1], 'utf8')), JSON.parse(readFileSync(process.argv[fromI + 2], 'utf8'))] : [run(false), run(true)];
const scn = A.scn ?? spec.split(':')[0], seed = A.seed ?? spec.split(':')[1];
const nEntry = Number(arg('--entry', '1')), NP = Number(arg('--panels', '6')), EVERY = Number(arg('--every', '0.5')), LEAD = Number(arg('--lead', '0.2'));

interface Rec { t: number; men: { who: string; x: number; z: number; yaw: number; up: boolean; mz?: [number, number]; low?: boolean }[]; sam: [number, number]; foes: [number, number, boolean][]; doors: [string, number][]; door: string; phase: string }
/** the n-th entry of a run: its door, and the recorded frames from its men's go to `NP` panels on */
function entryOf(R: any, n: number, door?: string) {
  const rec: Rec[] = R.paths?.rec ?? [], cross: any[] = R.paths?.cross ?? []; if (!rec.length) throw new Error('no recording in this run (PT_PATHS=rec)');
  const gos: { t: number; door: string }[] = []; let was = '';
  for (const f of rec) { const k = `${f.door}|${f.phase === 'enter'}`; if (f.phase === 'enter' && k !== was && (!gos.length || f.t - gos[gos.length - 1].t > 4 || gos[gos.length - 1].door !== f.door)) gos.push({ t: f.t, door: f.door }); was = k; }
  const G = door ? gos.find(g => g.door === door) : gos[n - 1]; if (!G) throw new Error(`this run has ${gos.length} entr${gos.length === 1 ? 'y' : 'ies'}${door ? `, none on ${door}` : ''}`);
  const t1 = G.t + LEAD + NP * EVERY + 0.01, frames = rec.filter(f => f.t >= G.t - 0.01 && f.t <= t1);
  return { door: G.door, t0: G.t, frames, spells: (R.paths.spells as any[]).filter(s => s.door === G.door && s.t1 >= G.t && s.t0 <= t1 + 3), cross: cross.filter(c => c.door === G.door && c.t >= G.t - 1 && c.t <= G.t + 12), all: (R.paths.spells as any[]).filter(s => s.door === G.door && s.t0 >= G.t - 1 && s.t0 <= G.t + 12) };
}
const EA = entryOf(A, nEntry), EB = entryOf(B, nEntry, EA.door);
const M = A.paths.meta ?? B.paths.meta; if (!M) throw new Error('the recording carries no level (paths.meta)');
const D = M.doors[EA.door], ux = Math.cos(D.dir), uz = Math.sin(D.dir), cx = D.hinge[0] + ux * D.w / 2, cz = D.hinge[1] + uz * D.w / 2;

// ---- drawing
const PX = 62, HALF_X = 3.4, HALF_Z = 2.9, PW = Math.round(HALF_X * 2 * PX), PH = Math.round(HALF_Z * 2 * PX), GAP = 10, LEFT = 14, TOP = 58, ROWH = PH + 46;
const X = (x: number) => (x - cx + HALF_X) * PX, Z = (z: number) => (z - cz + HALF_Z) * PX, f1 = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const TONE: Record<string, string> = { Red: '#c2402f', Blue: '#2f69b3' };
function panel(E: ReturnType<typeof entryOf>, k: number, ox: number, oy: number, id: string): string {
  const t = E.t0 + LEAD + k * EVERY, fr = E.frames.reduce((b, f) => Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b, E.frames[0]), o: string[] = [];
  o.push(`<g transform="translate(${ox},${oy})"><clipPath id="${id}"><rect width="${PW}" height="${PH}"/></clipPath><rect width="${PW}" height="${PH}" fill="#f3efe6"/><g clip-path="url(#${id})">`);
  for (const b of M.boxes as number[][]) { const [bx, bz, hx, hz, yaw, top] = b; if (Math.abs(bx - cx) > HALF_X + hx + hz || Math.abs(bz - cz) > HALF_Z + hx + hz) continue;
    o.push(`<rect x="${f1(-hx * PX)}" y="${f1(-hz * PX)}" width="${f1(hx * 2 * PX)}" height="${f1(hz * 2 * PX)}" transform="translate(${f1(X(bx))},${f1(Z(bz))}) rotate(${f1(-yaw * 180 / Math.PI)})" fill="${top > 1.7 ? '#4d4a45' : '#b8b1a2'}"/>`); }
  // every leaf as it stood
  for (const [name, ang] of fr.doors) { const d = M.doors[name]; if (!d) continue; const a = d.dir + ang, tx = d.hinge[0] + Math.cos(a) * d.w, tz = d.hinge[1] + Math.sin(a) * d.w;
    o.push(`<line x1="${f1(X(d.hinge[0]))}" y1="${f1(Z(d.hinge[1]))}" x2="${f1(X(tx))}" y2="${f1(Z(tz))}" stroke="#8a4f1d" stroke-width="5" stroke-linecap="round"/><circle cx="${f1(X(d.hinge[0]))}" cy="${f1(Z(d.hinge[1]))}" r="3.5" fill="#3a2410"/>`); }
  // trails, then the men
  const upto = E.frames.filter(f => f.t <= fr.t + 1e-6);
  for (const m of fr.men) { const pts = upto.map(f => f.men.find(x => x.who === m.who)).filter(Boolean).map(x => `${f1(X(x!.x))},${f1(Z(x!.z))}`).join(' '); o.push(`<polyline points="${pts}" fill="none" stroke="${TONE[m.who.split(' ')[0]] ?? '#555'}" stroke-width="1.6" stroke-opacity="0.55" stroke-dasharray="4 3"/>`); }
  for (const f of fr.foes) o.push(f[2] ? `<circle cx="${f1(X(f[0]))}" cy="${f1(Z(f[1]))}" r="${f1(0.3 * PX)}" fill="#6d6a63" stroke="#2c2a27" stroke-width="1.2"/>` : `<path d="M${f1(X(f[0]) - 8)},${f1(Z(f[1]) - 8)} l16,16 m0,-16 l-16,16" stroke="#6d6a63" stroke-width="2.5"/>`);
  o.push(`<circle cx="${f1(X(fr.sam[0]))}" cy="${f1(Z(fr.sam[1]))}" r="${f1(0.3 * PX)}" fill="#3f8a4a" stroke="#1d4424" stroke-width="1.2"/><text x="${f1(X(fr.sam[0]))}" y="${f1(Z(fr.sam[1]) + 4)}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">S</text>`);
  for (const m of fr.men) { const x = X(m.x), z = Z(m.z), tone = TONE[m.who.split(' ')[0]] ?? '#555', hits = E.spells.filter(s => s.who === m.who && fr.t >= s.t0 - EVERY / 2 && fr.t <= s.t1 + EVERY / 2), hit = hits.find(s => s.kind !== 'rifle' && s.kind !== 'light') ?? hits[0];
    const gx = m.mz ? X(m.mz[0]) : x + Math.sin(m.yaw) * 0.62 * PX, gz = m.mz ? Z(m.mz[1]) : z + Math.cos(m.yaw) * 0.62 * PX;   // (his gun as it lies: chest to muzzle)
    if (!m.up) { o.push(`<path d="M${f1(x - 9)},${f1(z - 9)} l18,18 m0,-18 l-18,18" stroke="${tone}" stroke-width="3"/>`); continue; }
    if (hit) o.push(`<circle cx="${f1(x)}" cy="${f1(z)}" r="${f1(0.3 * PX + 7)}" fill="none" stroke="#e01414" stroke-width="3.5"/>`);
    o.push(`<circle cx="${f1(x)}" cy="${f1(z)}" r="${f1(0.3 * PX)}" fill="${tone}" stroke="#1b1b1b" stroke-width="1.2"/><line x1="${f1(x)}" y1="${f1(z)}" x2="${f1(gx)}" y2="${f1(gz)}" stroke="${hit && (hit.kind === 'rifle' || hit.kind === 'light') ? '#e01414' : '#1b1b1b'}" stroke-width="3" stroke-linecap="round"/>`);
    o.push(`<text x="${f1(x)}" y="${f1(z + 4)}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">${esc(m.who.split(' ').map(w => w[0]).join(''))}</text>`);
    if (hit) o.push(`<text x="${f1(x)}" y="${f1(z - 0.3 * PX - 11)}" text-anchor="middle" font-size="11" fill="#c01010" font-weight="700">${hit.kind === 'leaf' ? (hit.swept ? 'leaf through him' : 'in the leaf') : hit.kind === 'rifle' ? 'rifle through the leaf' : hit.kind === 'light' ? 'light through the leaf' : hit.kind === 'friend' ? 'through a friend' : hit.kind === 'near' ? 'two on one spot' : hit.kind === 'body' ? 'on the fallen' : 'in a static'}</text>`); }
  o.push(`</g><rect width="${PW}" height="${PH}" fill="none" stroke="#8d877a"/><text x="6" y="15" font-size="12" fill="#333">+${(fr.t - E.t0).toFixed(1)} s</text></g>`);
  return o.join('');
}
const W = LEFT * 2 + NP * PW + (NP - 1) * GAP, H = TOP + ROWH * 2 + 40, out: string[] = [];
const tally = (E: ReturnType<typeof entryOf>) => { const L = E.all.filter(s => s.kind === 'leaf').length, F = E.all.filter(s => s.kind === 'friend').length, J = E.all.filter(s => s.kind === 'jamb').length, N = E.all.filter(s => s.kind === 'near').length, Rf = E.all.filter(s => s.kind === 'rifle').length, Lt = E.all.filter(s => s.kind === 'light').length, g = E.cross.filter(c => c.gapS !== null).map(c => `${c.gapS} s`);
  return `in this entry: a leaf through or in a man ${L}×, a rifle through a leaf ${Rf}×, a burning weapon light ${Lt}×, a man through a friend ${F}×, two on one spot ${N}×, in a static ${J}× · men over the line ${E.cross.length}${g.length ? ` (gaps ${g.join(', ')})` : ''}`; };
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fbfaf6"/>`);
out.push(`<text x="${LEFT}" y="24" font-size="17" font-weight="700" fill="#222">${esc(scn)}, seed ${seed} · the entry through ${esc(EA.door)}, from above</text>`);
out.push(`<text x="${LEFT}" y="44" font-size="12" fill="#555">headless positions at 20 Hz (no renderer) · discs are the men at their own width (0.3 m), the tick is where the gun points, dashes are the way walked · brown = a door leaf as it stood · dark = walls, pale = furniture · grey = defenders, S = Sam</text>`);
[[EA, 'BEFORE: the entry as it was (switch off)'], [EB, 'AFTER: each man on his own line through the door (?doorpath)']].forEach(([E, title], r) => {
  const oy = TOP + r * ROWH; out.push(`<text x="${LEFT}" y="${oy + 14}" font-size="14" font-weight="700" fill="#222">${title as string}</text><text x="${LEFT + 470}" y="${oy + 14}" font-size="12" fill="#555">${esc(tally(E as any))}</text>`);
  for (let k = 0; k < NP; k++) out.push(panel(E as any, k, LEFT + k * (PW + GAP), oy + 22, `c${r}_${k}`)); });
out.push('</svg>');
const dir = arg('--out', `${ROOT}/docs/shots`)!, name = arg('--name', `entry-strip-${scn}-${seed}`)!; mkdirSync(dir, { recursive: true });
const f = `${dir}/${name}.svg`; writeFileSync(f, out.join('\n'));
const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${dir}/${name}.png`, `--window-size=${W},${H}`, `file://${f}`]) : null;
console.log(`${f}${r && r.status === 0 ? ` (+ .png)` : ' (no PNG: no headless Chromium here)'}`);
console.log(`before · ${tally(EA)}\nafter  · ${tally(EB)}`);
