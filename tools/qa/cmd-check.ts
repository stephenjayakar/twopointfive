// THE PLAYER'S INPUT AS PLAIN DATA (src/game/cmd.ts): does the simulation run off the tick's record alone?
//   bun run tools/qa/cmd-check.ts            every check below; exit 0 = all pass, 1 = one failed (named)
//   CMD_BREAK=1 bun run tools/qa/cmd-check.ts    the red path: the replay is handed every record with its cursor moved 40 px — 'records alone' must then FAIL
// WHAT IS HELD:
//   plain          every record a run samples comes back from its text (cmd.ts cmdText → cmdFromText: JSON, a negative zero kept) the same to the bit
//   records alone  a scripted solo run (walk, crouch, whistle, a man aimed at through the reticle's snap and shot at, the wall hold) is played once through Game.update
//                  with the live input and camera, its records kept as JSON; a FRESH game on the same seed is then stepped through Game.step from the parsed records
//                  ALONE — no Input object, no camera, no canvas — and digests the same every half second, the die at the same roll
//   squad orders   the same for a staged night breach: orders given with the cursor and the keys (B on a door, the menu, fall in, hold)
//   host untouched a tick eats keys and buttons off its record, never off the host's Input: what the host pressed is still there after Game.update
//   seat outputs   the wall peek's nudge, a blast's kick and a scenario's opening cut reach the host's camera; stepped from records the cut waits on the seat
//   swallowed click a click the order menu took reads as up until let go; a fresh press inside one tick is a fresh press
import { standUp, ROOT } from './headless.ts';
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { cmdText, cmdFromText, Seat } = await import(`${ROOT}/src/game/cmd.ts`);

const DT = 1 / 60;
const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);   // (the game's own generator: a tool's die and the game's are one algorithm)
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const BREAK = process.env.CMD_BREAK === '1';
const firstDiff = (a: unknown[], b: unknown[]): string => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = diffDigest(a[i], b[i], 3); if (d.length) return `first at ${((i + 1) / 2).toFixed(1)} s: ${d.join(' · ')}`; } return a.length === b.length ? 'no row differs' : `${a.length} rows against ${b.length}`; };

// every record a live run samples, as its text (cmd.ts cmdText); `odd` = records that did not come back from their text the same to the bit, `negZero` = records carrying a -0
let tape: string[] | null = null, odd = 0, negZero = 0;
const same = (a: any, b: any): boolean => typeof a !== 'object' || a === null ? Object.is(a, b) : Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]))
  : typeof b === 'object' && b !== null && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => same(a[k], b[k]));
{ const step = Game.prototype.step;
  Game.prototype.step = function (this: any, dt: number, cmd: any, ...a: unknown[]) {
    if (tape) { const t = cmdText(cmd); tape.push(t); if (!same(cmdFromText(t), cmd) || typeof JSON.parse(t) !== 'object') odd++; if (t.includes('"-0"')) negZero++; }
    return (step as (...x: unknown[]) => unknown).call(this, dt, cmd, ...a); } as typeof step; }

type Script = (W: any, k: number) => void;
/** the run played live (Game.update off the harness's input and camera), its records taped; then a fresh game stepped from the tape alone */
async function both(name: string, seed: number, ticks: number, stage: ((W: any) => void) | null, script: Script, world: ((g: any, k: number) => void) | null = null): Promise<{ ok: boolean; detail: string; plain: boolean; n: number; first: string }> {
  Math.random = seeded(1); const A = await standUp({ seed }); stage?.(A);
  tape = []; const rowsA: unknown[] = [];
  for (let k = 0; k < ticks; k++) { world?.(A.game, k); script(A, k); A.step(DT); if ((k + 1) % 30 === 0) rowsA.push(digestGame(A.game, true)); }
  const recs = tape; tape = null; const nA = A.game.dice.n;
  const plain = recs.length === ticks;
  Math.random = seeded(2); const B = await standUp({ seed }); stage?.(B);
  B.input.mouseX = -1; B.cam.target = [-50, 0, -50]; B.cam.yaw = 2; B.cam.rebuild();   // (the replay's own input and camera: somewhere else, and never handed to the game)
  const rowsB: unknown[] = [];
  for (let k = 0; k < ticks; k++) {
    world?.(B.game, k);
    const cmd = cmdFromText(recs[k]); if (BREAK) cmd.mx += 40;
    B.game.step(DT, cmd);
    B.engine.lights.update(DT, B.game.time); B.engine.world.dynamics = B.game.dynBoxes; B.engine.world.upload();   // (what the harness's step does round the update, less the camera)
    if ((k + 1) % 30 === 0) rowsB.push(digestGame(B.game, true));
  }
  const equal = JSON.stringify(rowsA) === JSON.stringify(rowsB) && nA === B.game.dice.n;
  return { ok: equal, plain, n: recs.length, first: recs[0], detail: equal ? `${name}: ${rowsA.length} digests equal over ${(ticks / 60).toFixed(0)} s, ${nA} rolls each, ${(recs.reduce((s, t) => s + t.length, 0) / recs.length / 1024).toFixed(1)} KB a record as JSON` : `${name}: ${firstDiff(rowsA, rowsB)} · rolls ${nA} / ${B.game.dice.n}` };
}

// ---- the solo night: walk, crouch, whistle, the wall hold, a man under the reticle and three rounds at him
const solo: Script = (W, k) => {
  const g = W.game, I = W.input, gd = g.guards[0];
  if (k === 20) I.keys.add('KeyW'); if (k === 80) { I.keys.delete('KeyW'); I.keys.add('KeyD'); } if (k === 140) I.keys.delete('KeyD');
  if (k === 150) I.pressed.add('KeyC'); if (k === 170) I.pressed.add('KeyV'); if (k === 200) I.pressed.add('KeyQ'); if (k === 215) I.pressed.add('KeyQ');
  if (k >= 230) W.cursorAt([gd.char.pos[0] + 0.25, 1.2, gd.char.pos[2] + 0.2]);   // (a hand's width off his chest: the reticle's snap takes him, in the seat's pixels)
  else W.cursorAt([g.player.char.pos[0] + 3 * Math.cos(k / 40), 0, g.player.char.pos[2] + 3 * Math.sin(k / 40)]);
  if (k === 250 || k === 275 || k === 300) { I.clicked |= 1; I.buttons |= 1; } if (k === 252 || k === 277 || k === 302) I.buttons &= ~1;
  if (k === 330) I.keys.add('KeyS'); if (k === 400) I.keys.delete('KeyS');
};
/** what is NOT his input (done to both games at the same tick): Sam set down unkillable five metres in front of the first man of the shift */
const soloWorld = (g: any, k: number) => { if (k !== 230) return; const gd = g.guards[0]; g.godMode = true; const yaw = gd.char.bodyYaw; g.teleportPlayer([gd.char.pos[0] + Math.sin(yaw) * 5, 0, gd.char.pos[2] + Math.cos(yaw) * 5]); };
// ---- the night breach: orders through the cursor and the keys
const breachStage = (W: any) => { const r = startFromQuery(W.game, 'nightbreach'); if (r.why) throw new Error(`night breach refused: ${r.why}`); };
const breach: Script = (W, k) => {
  const g = W.game, I = W.input, d = g.doors.list[0];
  const door = g.doors.list.reduce((b: any, x: any) => Math.hypot(x.def.hinge[0] - g.player.char.pos[0], x.def.hinge[2] - g.player.char.pos[2]) < Math.hypot(b.def.hinge[0] - g.player.char.pos[0], b.def.hinge[2] - g.player.char.pos[2]) ? x : b, d);
  const mid: [number, number, number] = [door.def.hinge[0] + door.def.closedDir[0] * door.def.width * 0.5, 1.0, door.def.hinge[2] + door.def.closedDir[2] * door.def.width * 0.5];
  if (k < 200) W.cursorAt(mid); else W.cursorAt([g.player.char.pos[0] + 2.5, 0, g.player.char.pos[2] - 1.5]);
  if (k === 60) I.pressed.add('KeyB');                                        // the door's first row at once
  if (k === 240) I.pressed.add('KeyX'); if (k === 250) I.pressed.add('Digit1');   // the menu on a spot of floor, its first row
  if (k === 330) I.keys.add('KeyW'); if (k === 420) I.keys.delete('KeyW');
  if (k === 430) I.pressed.add('KeyX'); if (k === 440) I.pressed.add('Digit3');   // fall in
  if (k === 520) I.pressed.add('KeyT'); if (k === 540) I.pressed.add('KeyX'); if (k === 550) I.pressed.add('Digit4');   // one element, hold
};

const recsOf = (r: { first: string }) => r.first;
{ const a = await both('the solo night', 31, 480, null, solo, soloWorld);
  const b = await both('the night breach', 32, 660, breachStage, breach);
  // (the values plain JSON cannot carry, by hand: a camera square to an axis has negative zeros in its matrices)
  const hard = cmdFromText(recsOf(a)); hard.view.vp[3] = -0; hard.view.forward[0] = -0; hard.wheel = -0; hard.view.distance = Infinity; hard.view.pitch = NaN; hard.mx = -Infinity;
  const hardBack = cmdFromText(cmdText(hard)), hardOk = same(hardBack, hard) && Object.is(hardBack.view.vp[3], -0) && Object.is(JSON.parse(JSON.stringify(hard)).view.vp[3], 0);
  verdict(a.plain && b.plain && !odd && hardOk, 'plain: every record comes back from its text the same to the bit', `${a.n + b.n} records, one a tick · ${odd} came back different (${negZero} carried a negative zero) · a record with -0, NaN and both infinities written in by hand comes back with them ${hardOk} (plain JSON would have made the -0 a 0)`);
  verdict(a.ok, 'records alone: a solo run replays from its records with no input, camera or canvas', a.detail);
  verdict(b.ok, 'squad orders: a night breach ordered by cursor and keys replays from its records alone', b.detail); }

// ---- host untouched, seat outputs
{ Math.random = seeded(4); const W = await standUp({ seed: 5 }); const g = W.game, I = W.input;
  startFromQuery(g, 'nightbreach'); for (let k = 0; k < 30; k++) W.step(DT);
  I.pressed.add('KeyX'); g.update(DT, I, W.cam, W.canvas); const menuUp = !!g.orders.menu; I.endFrame();
  I.pressed.add('Digit3'); I.pressed.add('Escape'); g.update(DT, I, W.cam, W.canvas);
  const kept = I.pressed.has('Digit3') && I.pressed.has('Escape'), eaten = !g.seat.input.pressed.has('Escape'); I.endFrame();
  verdict(menuUp && kept && eaten, 'host untouched: the tick eats keys off its record, the host\'s Input keeps what was pressed', `order menu up on X ${menuUp} · after the tick the host still has Digit3 + Escape ${kept} · the record's copy had Escape taken by the menu ${eaten}`);
  g.seat.cam.peekOffset = null; const nudge: [number, number, number] = [0.4, 0, -0.2];
  const step = g.step; g.step = function (this: any, ...a: unknown[]) { const r = (step as (...x: unknown[]) => unknown).apply(this, a); this.seat.cam.peekOffset = nudge; this.seat.cam.kick = [0.1, 0, 0]; return r; };
  g.update(DT, I, W.cam, W.canvas); g.step = step;
  const out = W.cam.peekOffset === nudge && !!W.cam.kick && W.cam.kick[0] === 0.1;
  // a scenario's opening cut: taken off the seat by Game.update for the host's camera; a game stepped from records keeps it on the seat until somebody takes it
  Math.random = seeded(6); const C = await standUp({ seed: 6 }); C.cam.target = [0, 0, 0]; C.cam.desired = [0, 0, 0];
  startFromQuery(C.game, 'nightbreach'); C.game.update(DT, C.input, C.cam, C.canvas);
  const at = C.game.followPos(), cutHost = Math.hypot(C.cam.target[0] - at[0], C.cam.target[2] - at[2]) < 0.2 && C.game.seat.takeCut() === null;
  Math.random = seeded(6); const R = await standUp({ seed: 6 }); startFromQuery(R.game, 'nightbreach');
  R.game.step(DT, cmdFromText(cmdText(C.game.seat.cmd))); const waiting = R.game.seat.takeCut(), cutSeat = !!waiting && R.game.seat.takeCut() === null;
  verdict(out && cutHost && cutSeat, 'seat outputs: the peek nudge, the kick and a scenario\'s opening cut reach the host\'s camera', `peekOffset copied ${W.cam.peekOffset === nudge} · kick copied ${!!W.cam.kick} · the cut snapped the host's look-at to Sam ${cutHost} · stepped from a record it waits on the seat, once ${cutSeat}`);
  // a click the game swallowed (the order menu's): up until let go — and a fresh press between two records is a fresh press
  const S = new Seat(), rec = (buttons: number, clicked: number) => ({ ...cmdFromText(cmdText(C.game.seat.cmd)), buttons, clicked });
  S.load(rec(1, 1)); S.swallow(1); const s0 = S.input.buttons; S.load(rec(1, 0)); const s1 = S.input.buttons; S.load(rec(1, 1)); const s2 = S.input.buttons; S.swallow(1); S.load(rec(0, 0)); S.load(rec(1, 0)); const s3 = S.input.buttons;
  verdict(s0 === 0 && s1 === 0 && s2 === 1 && s3 === 1, 'swallowed click: held, it stays up; pressed again (even with no record of the release between) it is down', `after the swallow ${s0} · still held ${s1} · released and pressed inside one tick ${s2} · released, then held again ${s3}`); }

console.log(fails ? `=== cmd-check: ${fails} FAILED ===` : '=== cmd-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
