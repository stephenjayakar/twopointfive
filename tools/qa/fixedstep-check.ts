// THE FIXED STEP (src/host/loop.ts FIXEDSTEP): is the game stepped in whole 1/60 s ticks whatever the display's rate, and is it then the same game at every rate?
//   bun run tools/qa/fixedstep-check.ts              every check below; exit 0 = all pass, 1 = one failed (named)
//   FIXEDSTEP_BREAK=1 bun run tools/qa/fixedstep-check.ts   the red path: the fixed branch is handed the frame's own dt — 'ticks' and 'same game' must then FAIL
// WHAT IS HELD (headless: the whole Game under stepFrame, the loop main.ts runs, with a null renderer):
//   plan       ten seconds of frame times at 30 / 50 / 59.94 / 60 / 60 with jitter / 75 / 120 / 144 / 240 Hz each come out as 600 ticks (± 1; 59.94 snaps to one tick a frame),
//              a 60 Hz display is exactly one tick a frame, no frame runs more than maxTicks, a 100 ms hitch is dropped to maxTicks and nothing is owed after it
//   ticks      under stepFrame at 144 Hz every Game.update gets dt = 1/60 to the bit, 300 of them in five seconds
//   edges      a key pressed on a frame with no tick reaches exactly ONE game tick (the next) and the hotkeys exactly once; on a two-tick frame, the first tick alone
//   same game  one seed, one scripted input keyed by tick, the camera pinned: a 60, a 120, a 144 and a 50 Hz display and the harness's own W.step(1/60) play the same
//              ten seconds digest for digest (a fight in it)
//   off        with the switch off stepFrame runs one update a frame on the frame's own dt, as it always did
//   frozen     a frame under the pause card: no update, the keys pressed on it reach the hotkeys once (F9 / F10 start a recording from the pause menu) and nothing after them
import { standUp, ROOT } from './headless.ts';
const { stepFrame, planTicks, FIXEDSTEP } = await import(`${ROOT}/src/host/loop.ts`);
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);

const STEP = 1 / 60;
const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);   // (the game's own generator: a tool's die and the game's are one algorithm)
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const BREAK = process.env.FIXEDSTEP_BREAK === '1';

// every Game.update: its dt, and whatever the running check wants done before / seen during it
let onUpdate: ((g: any, dt: number, input: any) => void) | null = null;
{ const update = Game.prototype.update;
  Game.prototype.update = function (this: any, dt: number, input: any, ...a: unknown[]) { onUpdate?.(this, dt, input); return (update as (...x: unknown[]) => unknown).call(this, dt, input, ...a); } as typeof update; }

/** main.ts's LoopCtx with nothing drawn: the world packed where a draw would pack it */
function ctxOf(W: any, extra: Record<string, unknown> = {}): any {
  return { game: W.game, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); },
    smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => false, present: () => false, fixedStep: () => true, ...extra };
}
const frameOf = (ctx: any, dt: number) => { if (BREAK && FIXEDSTEP.on) { const hz = FIXEDSTEP.hz; FIXEDSTEP.hz = 1 / Math.max(dt, 1e-4); FIXEDSTEP.snap = 1; try { stepFrame(ctx, dt); } finally { FIXEDSTEP.hz = hz; FIXEDSTEP.snap = 0.0004; } } else stepFrame(ctx, dt); };

// ---- plan
const jit2 = (r: () => number) => r();
{ const rows: string[] = []; let ok = true;
  const jit = seeded(7);
  const cases: [string, (i: number) => number, number][] = [['30', () => 1 / 30, 600], ['50', () => 1 / 50, 600], ['59.94', () => 1.001 / 60, 599], ['60', () => 1 / 60, 600],
    ['60 ± 0.25 ms', () => 1 / 60 + (jit() - 0.5) * 0.0005, 600], ['70 (not a listed rate)', () => 1 / 70, 600], ['75', () => 1 / 75, 600], ['85 (not a listed rate)', () => 1 / 85, 600], ['120', () => 1 / 120, 600], ['144', () => 1 / 144, 600], ['240', () => 1 / 240, 600],
    ['60, callbacks up to 0.6 ms late', i => 1 / 60 + (i % 7 === 3 ? 0.0006 : i % 7 === 4 ? -0.0006 : 0), 600]];
  for (const [name, dtOf, want] of cases) {
    let acc = 0, drift = 0, t = 0, ticks = 0, most = 0, frames = 0, ones = 0;
    while (t < 10 - 1e-9) { const dt = dtOf(frames); const p = planTicks(acc, dt, FIXEDSTEP, drift); acc = p.acc; drift = p.drift; ticks += p.ticks; most = Math.max(most, p.ticks); if (p.ticks === 1) ones++; t += dt; frames++; }
    const good = Math.abs(ticks - want) <= (name.includes('not a listed') ? 3 : 1) &&   // (a rate the snap does not know: the clock is kept to the wall's within half a percent)
       most <= FIXEDSTEP.maxTicks && (!name.startsWith('60') && name !== '59.94' || ones === frames);
    if (!good) ok = false; rows.push(`${name} Hz: ${frames} frames → ${ticks} ticks (most in a frame ${most})${good ? '' : ' ✗'}`);
  }
  // every display from 40 to 260 Hz in tenths, steady and with ±0.3 ms of jitter: no frame ever plans FEWER THAN NO ticks (the time the snap put aside, handed back
  // on a display a little faster than a listed rate — 170 Hz against 165 — used to take the accumulator under zero: a frame of −1 ticks, its presses dropped)
  { let least = 0, worst = '', n = 0, off = 0, offAt = ''; const j2 = seeded(11);
    for (const jitter of [0, 0.0003]) for (let hz10 = 400; hz10 <= 2600; hz10++) { const hz = hz10 / 10; let acc = 0, drift = 0, t = 0, ticks = 0;
      while (t < 10 - 1e-9) { const dt = 1 / hz + (jit2(j2) - 0.5) * 2 * jitter; const p = planTicks(acc, dt, FIXEDSTEP, drift); acc = p.acc; drift = p.drift; ticks += p.ticks; if (p.ticks < least || p.acc < 0) { least = Math.min(least, p.ticks, p.acc < 0 ? -1 : 0); worst ||= `${hz} Hz${jitter ? ' with jitter' : ''}`; } t += dt; n++; }
      const e = Math.abs(ticks - 600) / 600; if (e > off) { off = e; offAt = `${hz} Hz`; } }
    const good = least === 0 && off < 0.03; if (!good) ok = false;
    rows.push(`40‥260 Hz in tenths, steady and jittered (${n} frames): ${least === 0 ? 'no frame under 0 ticks, nothing owed under 0' : `a frame of ${least} ticks or time owed under 0, first at ${worst} ✗`} · the clock furthest off the wall's ${(off * 100).toFixed(2)} % at ${offAt}${off < 0.03 ? '' : ' ✗'}`); }
  const hitch = planTicks(0.004, 0.1);
  if (hitch.ticks !== FIXEDSTEP.maxTicks || hitch.acc !== 0) { ok = false; rows.push(`a 100 ms hitch: ${hitch.ticks} ticks, ${hitch.acc} owed ✗`); } else rows.push(`a 100 ms hitch: ${hitch.ticks} ticks, nothing owed`);
  verdict(ok, 'plan: ten seconds are 600 ticks at every display rate; 60 Hz is one tick a frame', rows.join(' · ')); }

// ---- ticks, edges
{ Math.random = seeded(1); const W = await standUp({ seed: 5 }); FIXEDSTEP.on = true;
  let hot = 0; const ctx = ctxOf(W, { hotkeys: () => { if (W.input.pressed.has('F24')) hot++; } });
  const dts: number[] = []; let seen = 0; onUpdate = (_g, dt, input) => { dts.push(dt); if (input.pressed.has('F24')) seen++; };
  const frames = Math.round(5 * 144); let pressedAt = -1, pressTicks = -1;
  for (let f = 0; f < frames; f++) {
    const press = pressedAt < 0 && f >= 200 && planTicks(ctx.fixed.acc, 1 / 144).ticks === 0;   // (the first frame from 200 on that will run no tick)
    if (press) { W.input.pressed.add('F24'); pressedAt = dts.length; }
    frameOf(ctx, 1 / 144); if (press) pressTicks = ctx.ticks;
  }
  const exact = dts.every(d => d === STEP);
  verdict(exact && Math.abs(dts.length - 300) <= 1, 'ticks: at 144 Hz every Game.update gets dt = 1/60 to the bit', `${frames} frames → ${dts.length} updates · ${exact ? 'every dt === 1/60' : `dts seen: ${[...new Set(dts)].slice(0, 4).join(', ')}`}`);
  const one = seen === 1 && hot === 1 && (pressTicks === 0 || BREAK);
  // a two-tick frame (a 30 Hz frame time): the first tick alone
  seen = 0; hot = 0; W.input.pressed.add('F24'); const before = dts.length; frameOf(ctx, 1 / 30); const two = dts.length - before === 2 && seen === 1 && hot === 1;
  verdict(one && two, 'edges: a key press reaches exactly one game tick and the hotkeys exactly once', `pressed on a frame of ${pressTicks} tick(s) (update ${pressedAt}): one tick and one hotkey look ${one} · on a two-tick frame: the first tick alone ${two}`);
  onUpdate = null; }

// ---- same game
{ const SECS = 10, TICKS = SECS * 60;
  const script = (g: any, k: number, input: any) => {   // the input, keyed by the TICK: walk, stop, and from 3 s a man with Sam in front of him
    if (k === 30) input.keys.add('KeyW'); if (k === 120) input.keys.delete('KeyW'); if (k === 150) input.pressed.add('KeyC');
    if (k === 180) { const gd = g.guards[0]; g.godMode = true; const yaw = gd.char.bodyYaw; g.teleportPlayer([gd.char.pos[0] + Math.sin(yaw) * 3.5, 0, gd.char.pos[2] + Math.cos(yaw) * 3.5]); }
  };
  const play = async (name: string, dtOf: (() => number) | null): Promise<{ name: string; rows: unknown[]; text: string; frames: number }> => {
    Math.random = seeded(3); const W = await standUp({ seed: 2026 }); const g = W.game;
    W.cam.setPin({ look: [...g.player.char.pos], yaw: 0.6, pitch: 0.9, dist: 14 });
    const rows: unknown[] = []; let k = 0, frames = 0;
    onUpdate = (gg, _dt, input) => { script(gg, k, input); };
    const after = () => { k++; if (k % 30 === 0) rows.push(digestGame(g, true)); };
    if (!dtOf) { FIXEDSTEP.on = false; while (k < TICKS) { W.step(STEP); after(); frames++; } }
    else { FIXEDSTEP.on = true; const ctx = ctxOf(W);
      const base = onUpdate; let ran = 0; onUpdate = (gg, dt, input) => { if (ran) after(); ran++; base!(gg, dt, input); };   // (a tick's digest is taken before the next tick's script: after its lights, as W.step's is)
      while (ran <= TICKS && frames < 100000) { frameOf(ctx, dtOf()); frames++; }
      rows.length = Math.min(rows.length, TICKS / 30); }
    onUpdate = null;
    return { name, rows, text: JSON.stringify(rows), frames };
  };
  const ref = await play('the harness, W.step(1/60)', null);
  const runs = [await play('60 Hz', () => 1 / 60), await play('120 Hz', () => 1 / 120), await play('144 Hz', () => 1 / 144), await play('50 Hz', () => 1 / 50)];
  const firstDiff = (a: unknown[], b: unknown[]): string => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = diffDigest(a[i], b[i], 3); if (d.length) return `first at ${((i + 1) / 2).toFixed(1)} s: ${d.join(' · ')}`; } return a.length === b.length ? 'no row differs' : `${a.length} rows against ${b.length}`; };
  const bad = runs.filter(r => r.text !== ref.text);
  verdict(!bad.length && ref.rows.length === TICKS / 30, 'same game: 60, 120, 144 and 50 Hz displays and the harness\'s own 1/60 stepping play the same ten seconds',
    bad.length ? bad.map(r => `${r.name}: ${firstDiff(ref.rows, r.rows)}`).join(' · ') : `${ref.rows.length} digests equal across ${runs.map(r => `${r.name} (${r.frames} frames)`).join(', ')} and ${ref.name}`); }

// ---- off
{ Math.random = seeded(1); const W = await standUp(); FIXEDSTEP.on = false; const ctx = ctxOf(W);
  const dts: number[] = []; onUpdate = (_g, dt) => { dts.push(dt); };
  for (let f = 0; f < 144; f++) stepFrame(ctx, 1 / 144);
  onUpdate = null;
  verdict(dts.length === 144 && dts.every(d => d === 1 / 144) && ctx.ticks === 1, 'off: one update a frame on the frame\'s own dt, as it was', `144 frames at 144 Hz → ${dts.length} updates, dt ${[...new Set(dts)].join(', ')}`); }

// ---- frozen (the pause card up: either stepping)
{ Math.random = seeded(1); const W = await standUp(); const rows: string[] = []; let ok = true;
  for (const on of [false, true]) {
    FIXEDSTEP.on = on; let hot = 0, later = 0, updates = 0;
    const ctx = ctxOf(W, { frozen: () => true, hotkeys: (frozen: boolean) => { if (frozen && W.input.hit('F9')) hot++; }, postUpdate: () => { if (W.input.hit('F9') || W.input.clicked || W.input.wheel) later++; } });
    onUpdate = () => { updates++; };
    W.input.pressed.add('F9'); W.input.clicked = 1; W.input.wheel = 120;
    for (let f = 0; f < 3; f++) stepFrame(ctx, 1 / 60);
    onUpdate = null;
    const fine = hot === 1 && later === 0 && updates === 0 && ctx.ticks === 0;
    ok &&= fine; rows.push(`fixed step ${on ? 'on' : 'off'}: hotkeys saw F9 ${hot}×, seen after them ${later}×, ${updates} updates`);
  }
  FIXEDSTEP.on = false;
  verdict(ok, 'frozen: a key pressed under the pause card reaches the hotkeys once, and nothing after them', rows.join(' · ')); }

console.log(fails ? `=== fixedstep-check: ${fails} FAILED ===` : '=== fixedstep-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
