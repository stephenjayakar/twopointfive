// THE TAPE KEEPS THE LENS A STEP READ (src/game/runtape.ts → format.ts RunTape.lens, walked by src/replay/tapewalk.ts): a step's cursor ray is read off the view
// matrices in its record, and those are the host camera's AS THEY STOOD — a pose the host wrote after the camera last rebuilt (a card closing, an orbit, a tool's
// poke) is in the record beside matrices of the view before. A tape that kept the pose alone re-ran such a step on the pose's matrices: another ray, another aim
// point, and a fight a hair apart for good. The tape now keeps the matrices of every step where they are not the pose's own, and a re-run lays them.
//   bun run tools/qa/lens-check.ts                 every line below; exit 0 = all pass, 1 = one failed. Run it on both stands (TPS_PROFILE=shipped).
//   LENS_BREAK=1 bun run tools/qa/lens-check.ts    the red path: the lens rows are taken off the tape before the re-run — the `poked` line must FAIL
// WHAT IS HELD:
//   plain      a fight taped off a camera nobody pokes says it keeps lens rows and has NONE (the tape is not a row a step bigger for this) and re-runs to the bit
//   poked      the same fight with the camera's pose written between its rebuild and the step — at the first step, as a card closing does, and on a scatter of
//              later ones (the look-at, the yaw, the zoom) — has one lens row per poked step, a yaw alone told as a yaw (two numbers, not thirty-nine), and
//              re-runs to the bit (src/game/digest.ts rawBits, every step)
//   kept       the same run handed over in pieces and put together again (replaybuf.ts since → kept.ts assemble) carries the same lens rows and re-runs to the bit
// The real page's line is tools/qa/samefight-page.cjs.
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { standUp, ROOT } from './headless.ts';
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const BREAK = process.env.LENS_BREAK === '1';
const argv = process.argv.slice(2), val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const STEPS = Number(process.env.LENS_STEPS ?? 12 * 60), POKES = [0, 90, 91, 240, 400, 401, 402, 655];

// (the child: a room clear with the four, taped, its raw bits chained — written to the file named, then nothing else runs. `--poke`: the camera's pose is written
// with no rebuild before the steps of POKES)
if (val('tape-to')) {
  const { ReplayBuffer } = await import(`${ROOT}/src/game/replaybuf.ts`), { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`), KP = await import(`${ROOT}/src/replay/kept.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), { chainBits } = await import(`${ROOT}/src/game/digest.ts`);
  Math.random = mulberry32(0xbeef);
  const W: any = await standUp({ seed: 33 }); const r = startFromQuery(W.game, 'roomclear&squad4'); if (r.why) throw new Error(r.why);
  const buf = new ReplayBuffer(); buf.tape.born(W.game);
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  const C = chainBits(W.game, 30), poke = argv.includes('--poke'), pieces: any[] = [];
  for (let f = 0; f < STEPS; f++) { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1 && s < 7) I.keys.add('KeyW'); I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420 + 150 * Math.cos(s * 0.5);
    if (f === 120) I.pressed.add('KeyB'); I.buttons = s > 5 && s < 10 ? 1 : 0;
    if (poke && POKES.includes(f)) { const c = W.cam, k = POKES.indexOf(f) % 3;   // (written, not rebuilt: the step is handed this pose beside the matrices of the view before)
      if (k === 0) { c.target[0] += 2.5; c.target[2] -= 1.75; } else if (k === 1) c.yaw += 0.6; else c.distance *= 0.8; }
    W.step(f % 2 ? 1 / 60 : 1 / 120);
    if (f % 200 === 199) { const p = buf.since(); if (p) pieces.push(p); } }
  { const p = buf.since(); if (p) pieces.push(p); }
  const meta = { url: '?roomclear&squad4', fp: levelFingerprint(W.game) }, at = '2000-01-01T00:00:00Z';   // (the visit as the page's own storage would hold it: a head and the pieces by number)
  const V = { sid: 'lens', head: { ...buf.head(W.game, meta), at }, pieces: new Map(pieces.map((p, i) => [i, { ...p, at }])), notes: [] }, A = KP.assemble(V as never);
  if (A) writeFileSync(val('tape-to')! + '.kept.json', JSON.stringify({ ...A.file, probeWords: C.words, probeSteps: C.steps }));
  writeFileSync(val('tape-to')!, JSON.stringify({ ...buf.file(W.game, 'probe', meta), probeWords: C.words, probeSteps: C.steps, probePieces: pieces.length }));
  process.exit(0);
}

let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`=== lens-check: the tape keeps the lens a step read (src/game/runtape.ts) · ${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'} stand${BREAK ? ' · LENS_BREAK: the lens rows taken off the tape' : ''} ===`);
const dir = mkdtempSync(join(tmpdir(), 'lens-'));
type Run = { F: any; why: string; same: boolean; k: number; rows: number[][] };
/** a file's tape re-run against the words its own run folded (LENS_BREAK: the lens rows taken off it first) */
const rerunOf = (path: string): Run => {
  let F: any = null; try { F = JSON.parse(readFileSync(path, 'utf8')); } catch { /* */ }
  if (!F?.rerun || F.rerun.dead) return { F: null, why: `no tape in the file: ${F?.rerun?.dead ?? 'it was not written'}`, same: false, k: 0, rows: [] };
  const rows: number[][] = F.rerun.lens ?? [], kept = Array.isArray(F.rerun.lens);
  if (BREAK && kept) { F.rerun.lens = []; writeFileSync(path, JSON.stringify(F)); }
  const r = spawnSync(process.execPath, ['run', 'tools/qa/samefight-rerun.ts', path, String(F.probeSteps), '30'], { cwd: ROOT, env: { ...process.env, TPS_PROFILE: '' }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const l = (r.stdout || '').split('\n').find((x: string) => x.startsWith('SAMEFIGHT ')), H = l ? JSON.parse(l.slice(10)) : null;
  if (!H || H.refuse) return { F, why: `the tape was not re-run — ${H ? H.refuse : (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' / ').slice(0, 400)}`, same: false, k: 0, rows };
  const A: string[] = F.probeWords, B: string[] = H.words; let k = 0; while (k < A.length && k < B.length && A[k] === B[k]) k++;
  return { F: { ...F, lensKept: kept }, why: '', same: A.length > 0 && A.length === B.length && k === A.length, k, rows };
};
const run = (name: string, poke: boolean): { whole: Run; kept: Run } => {
  const path = join(dir, `${name}.json`);
  const made = spawnSync(process.execPath, ['run', 'tools/qa/lens-check.ts', '--tape-to', path, ...(poke ? ['--poke'] : [])], { cwd: ROOT, env: { ...process.env }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const whole = rerunOf(path); if (!whole.F && made.status) whole.why += ` (the taping run: exit ${made.status}, ${(made.stderr || made.stdout || '').trim().split('\n').slice(-2).join(' / ').slice(0, 300)})`;
  return { whole, kept: poke ? rerunOf(path + '.kept.json') : whole };
};
const said = (R: Run) => R.why || (R.same ? `${R.F.probeWords.length} words over ${R.F.probeSteps} steps equal` : `${R.k} of ${R.F.probeWords.length} words equal (the bits part in the half second ending at step ${(R.k + 1) * 30})`);
const at = (R: Run) => R.rows.map(r => r[0]).join(', ') || 'none', shape = (R: Run) => R.rows.map(r => r.length === 2 ? 'yaw' : r.length === 39 ? 'whole' : `?${r.length}`).join(' ');
{ const R = run('plain', false).whole;
  verdict(!!R.F && R.same && R.F.lensKept && R.rows.length === 0, 'plain: a fight off a camera nobody pokes says it keeps lens rows, has none, and re-runs to the bit', `${said(R)} · ${R.F?.lensKept ? `${R.rows.length} lens row(s)` : 'the tape does not say it keeps them'}`); }
{ const { whole: R, kept: K } = run('poked', true), want = POKES.filter(f => f < STEPS), wantShape = want.map((_, i) => i % 3 === 1 ? 'yaw' : 'whole').join(' ');
  verdict(!!R.F && R.same && at(R) === want.join(', ') && shape(R) === wantShape, 'poked: the pose written between the camera\'s rebuild and the step, eight times — one lens row a poked step, a yaw alone told as a yaw, and the re-run is the same fight to the bit',
    `${said(R)} · lens rows at steps ${at(R)} (poked: ${want.join(', ')}) · ${shape(R)}`);
  verdict(!!K.F && K.same && JSON.stringify(K.rows) === JSON.stringify(R.rows) && R.F?.probePieces > 1, 'kept: the run handed over in pieces and put together again carries the same lens rows and re-runs to the bit',
    `${said(K)} · ${R.F?.probePieces ?? 0} pieces · lens rows at steps ${at(K)}`); }
console.log(fails ? `=== lens-check: ${fails} FAILED ===` : '=== lens-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
