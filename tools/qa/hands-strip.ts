// HANDS STRIP: stick figures of Sam and the body he picks up (src/game/hands.ts), with no GPU — a body taken up from the floor, carried, put down, as a row of
// moments seen from his right side, from in front of him and from above, all in HIS frame (so a turn he makes does not move the picture).
//   bun run tools/qa/hands-strip.ts [--out dir] [--from feet|head] [--drag]      → dir/hands-<carry|drag>-<from>.svg (+ .png where a headless Chromium is found)
// --drag = the haul along the floor (HANDS.carry off). Blue = Sam, orange = the body's ragdoll particles; the darker limb is each man's right.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { HANDS } = await import(`${ROOT}/src/game/hands.ts`);
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { RAG } = await import(`${ROOT}/src/game/ragdoll.ts`);
const log = console.log; console.log = console.warn = () => {};
DOORWAY.oneWay = true;
const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/train-move.json`, 'utf8'))), seed: 1 });
DOORSTAY.on = true; HANDS.on = true; if (process.argv.includes('--drag')) HANDS.carry = false;
startFromQuery(W.game, `?levelFile=train-move.json&quiet&difficulty=hard`); console.log = log;
const g = W.game, I = W.input; g.aiEnabled = false; g.godMode = true; g.playerInvisible = true;
const DT = 1 / 60, pl = g.player, c = pl.char;
type P3 = number[];
const CH: [string[], string, number][] = [[['hips', 'thighL', 'shinL', 'footL', 'toeL'], '#7d93b8', 7], [['hips', 'thighR', 'shinR', 'footR', 'toeR'], '#3f5f96', 7], [['hips', 'spine2', 'chest', 'neck', 'head'], '#23324d', 11], [['chest', 'upperArmL', 'forearmL', 'handL'], '#7d93b8', 6], [['chest', 'upperArmR', 'forearmR', 'handR'], '#3f5f96', 6]];
const RG: [number[], string, number][] = [[[RAG.hipL, RAG.kneeL, RAG.ankL], '#e0a070', 7], [[RAG.hipR, RAG.kneeR, RAG.ankR], '#b5622f', 7], [[RAG.hipL, RAG.hipR], '#8a3d18', 9], [[RAG.pelvis, RAG.spine, RAG.neck, RAG.head], '#8a3d18', 11], [[RAG.neck, RAG.shoL, RAG.elbL, RAG.handL], '#e0a070', 5], [[RAG.neck, RAG.shoR, RAG.elbR, RAG.handR], '#b5622f', 5]];
interface Fig { label: string; sam: Record<string, P3>; rag: P3[]; }
const figs: Fig[] = [];
const gd = g.guards[0]; let rag: any;
const snap = (label: string) => { const f = c.forward(), L = [f[2], 0, -f[0]]; const rel = (p: P3): P3 => { const dx = p[0] - c.pos[0], dz = p[2] - c.pos[2]; return [dx * L[0] + dz * L[2], p[1] - c.pos[1], dx * f[0] + dz * f[2]]; };
  const sam: Record<string, P3> = {}; for (const k of new Set(CH.flatMap(x => x[0]))) sam[k] = rel(c.bones[k]); const r: P3[] = []; for (let i = 0; i < 16; i++) r.push(rel(rag.point(i)));
  figs.push({ label: `${label} · ${pl.haul?.phase ?? 'free'}`, sam, rag: r }); };
const step = (n = 1, keys: string[] = []) => { for (let i = 0; i < n; i++) { for (const k of keys) I.keys.add(k); W.step(DT); for (const k of keys) I.keys.delete(k); } };
const tap = () => { I.keys.add('Space'); I.pressed.add('Space'); W.step(DT); I.keys.delete('Space'); };
step(30); killGuard(g, gd, [1, 0, 0], true); step(150); rag = gd.char.ragdoll;
const P = (i: number) => rag.point(i);
const fi = process.argv.indexOf('--from'), from = fi >= 0 && process.argv[fi + 1] === 'head' ? 'head' : 'feet';
const end = from === 'feet' ? v3.lerp(P(RAG.ankL), P(RAG.ankR), 0.5) : v3.lerp(P(RAG.shoL), P(RAG.shoR), 0.5), hips = P(RAG.pelvis);
const d = v3.normalize([end[0] - hips[0], 0, end[2] - hips[2]]);
g.teleportPlayer([end[0] + d[0] * 0.8, 0, end[2] + d[2] * 0.8]); step(8); snap('before');
g.selectVerb('body', 'drag'); tap();
const until = (ph: string, cap = 300) => { let n = 0; while (pl.haul?.phase !== ph && n++ < cap) step(1); };
step(25); snap('walking in'); until('rise'); snap('at its hips'); const carry = !!pl.haul?.carry;
if (carry) { step(18); snap('lift 30%'); step(15); snap('lift 55%'); step(15); snap('lift 80%'); until('carry'); step(20); snap('up'); }
else { until('carry'); step(20); snap('in hand'); }
const key = (dir: number[]) => { const { fwd, right } = W.cam.planarBasis(); const s = (k: number[]) => k[0] * dir[0] + k[2] * dir[2]; const cs: [string, number][] = [['KeyW', s(fwd)], ['KeyS', -s(fwd)], ['KeyD', s(right)], ['KeyA', -s(right)]]; cs.sort((a, b) => b[1] - a[1]); return cs[0][0]; };
const k1 = key([1, 0, 0]); step(70, [k1]); snap('walking a'); step(11, [k1]); snap('walking b'); step(11, [k1]); snap('walking c'); step(40);
g.selectVerb('body', 'drop'); tap();
if (carry) { step(18); snap('down 30%'); step(20); snap('down 60%'); step(20); snap('down 90%'); } else { step(10); snap('laying'); }
step(120); snap('after');
// draw: two rows — from his right side (forward to the right) and from in front (his left on the right)
const K = 105, CW = 215, RH = 230, PAD = 14, HEAD = 44;
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD * 2 + figs.length * CW}" height="${HEAD + RH * 3 + 26}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="20" font-size="15" font-weight="600">body ${carry ? 'carried over the shoulder' : 'along the floor'} — taken from its ${from} (blue = Sam, dark = his right · orange = the body, dark = its right)</text><text x="${PAD}" y="36" fill="#555">row 1: from his right side, he faces right · row 2: from in front of him, his left is on the right · row 3: from above, he faces up</text>`;
figs.forEach((f, i) => { const ox = PAD + i * CW;
  const views: [(p: P3) => number, (p: P3) => number][] = [
    [p => ox + CW / 2 + p[2] * K, p => HEAD + RH - 24 - p[1] * K],
    [p => ox + CW / 2 + p[0] * K, p => HEAD + RH * 2 - 24 - p[1] * K],
    [p => ox + CW / 2 - p[0] * K, p => HEAD + RH * 2 + RH / 2 - p[2] * K]];
  views.forEach(([x, y], vi) => {
    s += `<rect x="${ox + 2}" y="${HEAD + vi * RH + 2}" width="${CW - 4}" height="${RH - 6}" fill="#fff" stroke="#d9d4c7"/>`;
    if (vi < 2) s += `<line x1="${ox + 2}" y1="${HEAD + (vi + 1) * RH - 24}" x2="${ox + CW - 2}" y2="${HEAD + (vi + 1) * RH - 24}" stroke="#8a8272" stroke-width="2"/>`;
    const order = vi === 1 ? ['rag', 'sam'] : ['sam', 'rag'];
    for (const o of order) {
      if (o === 'sam') { for (const [ch, col, w] of CH) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" points="${ch.map(k => `${x(f.sam[k]).toFixed(1)},${y(f.sam[k]).toFixed(1)}`).join(' ')}"/>`;
        s += `<circle cx="${x(f.sam.head).toFixed(1)}" cy="${(y(f.sam.head) - (vi < 2 ? 7 : 0)).toFixed(1)}" r="10" fill="#23324d" opacity="0.9"/>`; }
      else { for (const [ch, col, w] of RG) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" points="${ch.map(k => `${x(f.rag[k]).toFixed(1)},${y(f.rag[k]).toFixed(1)}`).join(' ')}"/>`;
        s += `<circle cx="${x(f.rag[RAG.head]).toFixed(1)}" cy="${y(f.rag[RAG.head]).toFixed(1)}" r="9" fill="#8a3d18" opacity="0.9"/>`; } } });
  s += `<text x="${ox + CW / 2}" y="${HEAD + RH * 3 + 14}" text-anchor="middle">${f.label}</text>`; });
s += '</svg>';
const oi = process.argv.indexOf('--out'), dir = resolve(oi >= 0 ? process.argv[oi + 1] : `${ROOT}/docs/shots/hands`); mkdirSync(dir, { recursive: true });
const out = `${dir}/hands-${carry ? 'carry' : 'drag'}-${from}`, f = `${out}.svg`; writeFileSync(f, s);
const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; let SHELL: string | null = null; if (existsSync(base)) for (const dd of readdirSync(base)) { const x = `${base}/${dd}/chrome-linux/headless_shell`; if (existsSync(x)) SHELL = x; }
const m = /width="(\d+)" height="(\d+)"/.exec(s)!; const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${out}.png`, `--window-size=${m[1]},${m[2]}`, `file://${f}`]) : null;
log(`${f}${r && r.status === 0 ? ' (+ .png)' : ''} · ${figs.length} moments`);
process.exit(0);
