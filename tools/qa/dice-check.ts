// THE GAME'S OWN DIE (src/math/dice.ts): is every roll of the simulation drawn from one seeded stream the Game owns, and does a seed name a run?
//   bun run tools/qa/dice-check.ts            every check below; exit 0 = all pass, 1 = one failed (named)
//   DICE_BREAK=1 bun run tools/qa/dice-check.ts   the red path: one stray Math.random() is drawn inside the update — 'same seed' must then FAIL
// WHAT IS HELD:
//   source     no Math.random call is left in src/game outside journal.ts (which installs a recording's die) and civilians.ts withDice (which swaps it for a
//              constructor's length) — a new one is named with its file and line
//   same seed  two games stood up on one seed, each under a DIFFERENT Math.random, play the same half minute (a firefight in it) digest for digest: nothing of the
//              simulation reaches Math.random, and the seed alone names the dice
//   other seed a second seed plays a different half minute
//   checkpoint on its own die, with nothing re-seeded: A (stepped on after the save) ≡ B (the same game, loaded) ≡ C (a fresh game on another seed, loaded) — the
//              die's position rides the file
//   follow     a tool that puts its own die in Math.random's place (every older probe, a recording, a capture recipe) gets the game's dice from that moment, the own
//              die standing still, and a save made then carries no die; put back, the own die resumes where it stood
//   default    the harness with no seed asked for has no die of its own (every frozen digest was recorded on the tool's Math.random); TPS_SEED=n gives it one
import { readdirSync, readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { saveState, loadState, canSave } = await import(`${ROOT}/src/game/savestate.ts`);
const { diceInUse, simRandom } = await import(`${ROOT}/src/math/dice.ts`);
const { ambientState } = await import(`${ROOT}/src/game/dialogue.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);

const DT = 1 / 60;
const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);   // (the game's own generator: a tool's die and the game's are one algorithm)
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

if (process.env.DICE_BREAK === '1') {   // the red path: one roll a frame that is NOT the game's
  const update = Game.prototype.update;
  Game.prototype.update = function (this: any, ...a: unknown[]) { if (Math.random() < 0.5) this.guards[0].wait += 1e-3; return (update as (...x: unknown[]) => unknown).apply(this, a); } as typeof update;
}

/** Sam stood unkillable in front of the first man of the shift: a fight, so the aim / spread / bark dice all roll */
function provoke(W: any): void {
  const g = W.game, gd = g.guards[0]; g.godMode = true;
  const yaw = gd.char.bodyYaw, at: [number, number, number] = [gd.char.pos[0] + Math.sin(yaw) * 3.5, 0, gd.char.pos[2] + Math.cos(yaw) * 3.5];
  g.teleportPlayer(at);   // (3.5 m off his chest: noticed in any light)
}
/** `secs` of play digested twice a second; `at` = the frame Sam is put in front of the man (−1 never) */
function run(W: any, secs: number, at: number): { rows: unknown[]; text: string } {
  const rows: unknown[] = [];
  for (let f = 0, n = Math.round(secs / DT); f < n; f++) { if (f === at) provoke(W); W.step(DT); if ((f + 1) % 30 === 0) rows.push(digestGame(W.game, true)); }
  return { rows, text: JSON.stringify(rows) };
}
const firstDiff = (a: unknown[], b: unknown[]): string => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = diffDigest(a[i], b[i], 3); if (d.length) return `first at ${((i + 1) / 2).toFixed(1)} s: ${d.join(' · ')}`; } return 'no row differs'; };

// ---- source
{ const dir = `${ROOT}/src/game`, hits: string[] = [];
  for (const f of readdirSync(dir).filter(x => x.endsWith('.ts'))) {
    if (f === 'journal.ts') continue;
    readFileSync(`${dir}/${f}`, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (!/Math\.random/.test(code) || /^\s*(\/\*\*|\*)/.test(line)) return;
      if (f === 'civilians.ts' && /function withDice/.test(code)) return;
      hits.push(`${f}:${i + 1}`);
    }); }
  verdict(!hits.length, 'source: no Math.random left in src/game outside journal.ts and civilians.ts withDice', hits.length ? `still drawn at ${hits.join(', ')}` : 'every draw of the simulation goes through simRandom()'); }

// ---- same seed, other seed
{ Math.random = seeded(11); const A = await standUp({ seed: 4242 }); const a = run(A, 30, 300); const na = A.game.dice.n;
  Math.random = seeded(99); const B = await standUp({ seed: 4242 }); const b = run(B, 30, 300); const nb = B.game.dice.n;
  Math.random = seeded(11); const C = await standUp({ seed: 4243 }); const c = run(C, 30, 300);
  const shots = A.game.events.length;
  verdict(a.text === b.text && na === nb && na > 50, 'same seed: two games on seed 4242 under different Math.random streams play the same 30 s', a.text === b.text ? `${a.rows.length} digests equal · ${na} rolls each off the own die (a fight from 5 s; ${shots} events live at the end)` : `${firstDiff(a.rows, b.rows)} · rolls ${na} / ${nb}`);
  verdict(a.text !== c.text, 'other seed: seed 4243 plays a different 30 s', a.text !== c.text ? firstDiff(a.rows, c.rows) : 'the two runs are equal: the seed does not reach the dice'); }

// ---- checkpoint
{ Math.random = seeded(5); const W = await standUp({ seed: 777 }); const g = W.game;
  for (let f = 0; f < 60 * 14; f++) W.step(DT);
  for (let f = 0; f < 60 * 12 && ambientState(g).run; f++) W.step(DT);   // (a conversation is cut short by a load, by design: the identity is claimed outside one)
  const why = canSave(g) ?? (ambientState(g).run ? 'a conversation would not end' : null);
  if (why) verdict(false, 'checkpoint: the die rides the file', `cannot save: ${why}`);
  else {
    const s = saveState(g, { label: 'dice', kind: 'harness' }); const json = JSON.stringify(s); const n0 = g.dice.n;
    // (the camera is the host's, not the file's: the page cuts it to Sam on a load. All three start from that cut — target, where it is heading AND the matrices the
    //  first tick's input record is read through; with only `target` set the same game's lens still stood over the fight it had just left, and on the shipped stand,
    //  where Sam's body follows his aim, that showed in his yaw)
    const cut = (X: any): void => { const p = X.game.player.char.pos; X.cam.target = [p[0], p[1], p[2]]; X.cam.desired = [p[0], p[1], p[2]]; X.cam.rebuild(); };
    cut(W); const A = run(W, 10, 60); const nA = g.dice.n;
    loadState(g, JSON.parse(json)); cut(W); const B = run(W, 10, 60); const nB = g.dice.n;
    Math.random = seeded(31337); const W2 = await standUp({ seed: 1 }); loadState(W2.game, JSON.parse(json)); cut(W2); const C = run(W2, 10, 60); const nC = W2.game.dice.n;
    const ok = !!s.dice && A.text === B.text && B.text === C.text && nA === nB && nB === nC && nA > n0;
    verdict(ok, 'checkpoint: A (stepped on) ≡ B (same game, loaded) ≡ C (fresh game on another seed, loaded) with nothing re-seeded', ok ? `saved at roll ${n0}; ${nA - n0} rolls in the next 10 s, the same in all three; ${A.rows.length} digests equal`
      : `${s.dice ? '' : 'no die in the file · '}A/B ${A.text === B.text ? 'equal' : firstDiff(A.rows, B.rows)} · B/C ${B.text === C.text ? 'equal' : firstDiff(B.rows, C.rows)} · rolls ${n0} → ${nA} / ${nB} / ${nC}`);
  } }

// ---- follow
{ const sys = Math.random = seeded(3); const W = await standUp({ seed: 9 }); const g = W.game; for (let f = 0; f < 120; f++) W.step(DT);
  const own = diceInUse() === g.dice; const n0 = g.dice.n;
  let drawn = 0; Math.random = () => { drawn++; return 0.5; };
  const off = diceInUse() === null; simRandom(); simRandom(); const stood = g.dice.n === n0 && drawn === 2;
  const s = saveState(g, { label: 'follow', kind: 'harness', force: true });
  Math.random = sys; const back = diceInUse() === g.dice; simRandom(); const resumed = g.dice.n === n0 + 1;
  verdict(own && off && stood && !s.dice && back && resumed, 'follow: a die put in Math.random\'s place gets the game\'s dice; put back, the own die resumes',
    `own die in force ${own} · another function in place: own die out ${off}, it stood still and the tool's was drawn ${stood}, a save then carries no die ${!s.dice} · put back: in force ${back}, resumed at the next roll ${resumed}`); }

// ---- default
{ Math.random = seeded(1); const prev = process.env.TPS_SEED; delete process.env.TPS_SEED; const W = await standUp(); const none = W.game.dice === null && diceInUse() === null;
  process.env.TPS_SEED = '12'; const W2 = await standUp(); const env = W2.game.dice?.seed === 12;
  if (prev === undefined) delete process.env.TPS_SEED; else process.env.TPS_SEED = prev;
  verdict(none && env, 'default: the harness has no die of its own unless asked; TPS_SEED=n gives it one', `no seed asked: game.dice null ${none} · TPS_SEED=12: seed ${W2.game.dice?.seed}`); }

console.log(fails ? `=== dice-check: ${fails} FAILED ===` : '=== dice-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
