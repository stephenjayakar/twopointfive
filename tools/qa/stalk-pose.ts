#!/usr/bin/env bun
// THE STALK'S POSES, BONE BY BONE, FOR ONE TREE AGAINST ANOTHER (game/stalk.ts; the polish: stalkPolish, character.ts holdPolish).
// "Off = the build as it was" is a claim about every bone, and a run digest does not read bones. This writes them down for one fixed scene — the lobby, Sam
// crouched 2.6 m dead astern of a standing man, the left button held until he is in the arm, then four seconds of the hold — every named bone of both men,
// every frame, on the page's stand:
//   bun run tools/qa/stalk-pose.ts --out a.json [--knife] [--down]      --knife = the knife in his hand (CLOSE.noKnife off) · --down = stalkPolish(false)
//   bun run tools/qa/stalk-pose.ts --diff a.json b.json                 exit 0 = no bone more than 0.1 mm apart on any frame, 1 = the worst of them listed
// Exit 2 = asked wrongly. It reads the tree it is RUN FROM (the working directory), so one copy of this file writes an older tree's poses too:
//   git archive <commit> | tar -x -C /some/dir ; (cd /some/dir && bun run /path/to/this/stalk-pose.ts --out old.json)
// --down does nothing in a tree that has no stalkPolish, and the line it prints says so: right for a tree from BEFORE the fourth pass (the comparison is
// the polish down against the tree before it), wrong for a tree of the fourth or fifth pass, whose polish is up in its tables with nothing to put it down.
// No GPU, no page: the animator's own bones over the headless harness.
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2), arg = (n: string) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1] ?? null; };
type Frame = Record<string, number[] | string>;

if (argv[0] === '--diff') {
  if (!argv[1] || !argv[2]) { console.error('stalk-pose: --diff <a.json> <b.json>'); process.exit(2); }
  const [a, b] = [argv[1], argv[2]].map(f => JSON.parse(readFileSync(resolve(f), 'utf8')) as Frame[]);
  const worst = new Map<string, [number, number]>(); let first = '';
  const keys = (f: Frame[]) => [...new Set(f.flatMap(o => Object.keys(o)))].sort(), ka = keys(a), kb = keys(b), lone = [...ka.filter(k => !kb.includes(k)).map(k => `${k} (the first file's alone)`), ...kb.filter(k => !ka.includes(k)).map(k => `${k} (the second's alone)`)];   // (every frame's names, not the first frame's)
  if (!a.length || !b.length) first = 'a file with no frames';
  else if (a.length !== b.length) first = `${a.length} frames against ${b.length}`;
  else if (lone.length) first = `the two trees name different bones: ${lone.join(', ')}`;
  for (let i = 0; i < Math.min(a.length, b.length); i++) for (const [k, v] of Object.entries(a[i])) {
    const w = b[i][k]; if (w === undefined) { if (!first) first = `frame ${i}: ${k} is in the first file alone`; continue; }
    if (typeof v === 'string') { if (v !== w && !first) first = `frame ${i}: the hold's phase '${v}' against '${w}'`; continue; }
    const d = Math.hypot(v[0] - (w as number[])[0], v[1] - (w as number[])[1], v[2] - (w as number[])[2]);
    if (!(d <= 1e-4)) { const dd = Number.isFinite(d) ? d : Infinity; if (!first) first = `frame ${i}: ${k}`; if (dd > (worst.get(k)?.[0] ?? 0)) worst.set(k, [dd, i]); }   // (a bone that is not a number in either file is a difference: NaN is written as null)
  }
  const rows = [...worst].sort((x, y) => y[1][0] - x[1][0]);
  console.log(first || rows.length ? `DIFFERENT — first at ${first}\n${rows.slice(0, 16).map(([k, [d, i]]) => `  ${k.padEnd(14)} ${(d * 100).toFixed(2)} cm at frame ${i}`).join('\n')}` : `THE SAME — ${a.length} frames, ${ka.length - 1} bones in both, none more than 0.1 mm apart (s. = Sam, m. = the man)`);
  process.exit(first || rows.length ? 1 : 0);
}

process.env.TPS_PROFILE = 'shipped';
const ROOT = process.cwd(), out = arg('--out'), bare = !argv.includes('--knife'), down = argv.includes('--down');
if (!out) { console.error('stalk-pose: --out <file.json>, or --diff <a.json> <b.json>'); process.exit(2); }
const { standUp } = await import(resolve(ROOT, 'tools/qa/headless.ts'));
const SK: any = await import(resolve(ROOT, 'src/game/stalk.ts')), { CLOSE }: any = await import(resolve(ROOT, 'src/game/close.ts'));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DT = 1 / 60, EAST = Math.PI / 2, GAP = 2.6, AT = [6.2 + GAP, 0, 19.5];
Math.random = seeded(4411); const log = console.log; console.log = () => {}; const W: any = await standUp({ seed: 4411 } as any); console.log = log;
const g = W.game; CLOSE.on = true; SK.STALK.on = true; CLOSE.noKnife = bare; const put = down && typeof SK.stalkPolish === 'function'; if (put) SK.stalkPolish(false);
g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
const [A, ...rest] = g.guards; for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - GAP, 0, AT[2]]); g.player.crouch = true;
const frames: Frame[] = [];
const step = () => {
  A.char.vel = [0, 0, 0]; W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02;
  const o: Frame = { hold: g.player.holding ? String(g.player.holding.phase) : '' };
  for (const [who, c] of [['s', g.player.char], ['m', A.char]] as const) for (const [k, b] of Object.entries(c.bones as Record<string, number[]>)) if (b && typeof b[0] === 'number') o[`${who}.${k}`] = [b[0], b[1], b[2]].map(x => Math.round(x * 1e5) / 1e5);
  frames.push(o);
};
for (let i = 0; i < 20; i++) step();
W.input.buttons |= 1; W.input.clicked |= 1; let n = 0; while (!g.player.holding && n++ < 600) step();
const grabbed = !!g.player.holding;
W.input.buttons &= ~1; for (let i = 0; i < 240; i++) step();
writeFileSync(resolve(out), JSON.stringify(frames));
log(`stalk-pose: ${frames.length} frames, ${Object.keys(frames[0]).length - 1} bones, ${bare ? 'bare hands' : 'the knife'}${put ? ', the polish down' : down ? ', --down asked and THIS TREE HAS NO stalkPolish: nothing was put down' : ''} · ${grabbed ? `in the arm at frame ${n + 20}` : 'NEVER GRABBED'} → ${out}`);
process.exit(grabbed ? 0 : 1);
