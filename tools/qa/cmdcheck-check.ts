// A RECORD FROM ANYONE (src/game/cmd.ts checkCmd, switch CMDCHECK.on): is a tick's input record made one an honest seat could have sent before the tick reads it —
// and does an honest record come through untouched?
//   bun run tools/qa/cmdcheck-check.ts                    every line below; exit 0 = all pass, 1 = one failed (named). Run it on both stands (TPS_PROFILE=shipped).
//   CMDCHECK_BREAK=1 bun run tools/qa/cmdcheck-check.ts   the red path: the switch is never raised — a hostile record is believed, and `hostile` / `far` must FAIL
// WHAT IS HELD:
//   honest     a scripted room clear with the four (walking, the cursor swept, clicks, the order menu) played with the check off and with it on is the same game
//              to the last bit (src/game/digest.ts rawBits), and not one thing in one record was put right
//   shapes     checkCmd alone, on every kind of nonsense a record can be (not an object, fields missing, NaN, the infinities, strings for numbers, a list of a
//              million keys, keys nobody has, an eye sitting on its own look-at, a record that cannot be written): never throws, and what comes back is whole —
//              finite, bounded, sixteen finite numbers in each matrix — and checking it a second time changes nothing. As a REMOTE seat's, each also comes back
//              with a view that is the game's own working from the pose: the eye where the angles put it, the inverse matrix the inverse of the other. As a
//              LOCAL seat's, a record whose matrices lag its pose (the page's do, a step, when it orbits) is left alone
//   hostile    twelve seconds of a fight in which three records in four are nonsense (a seeded mix of the above over the honest record of the tick): the game
//              never throws, every man's place stays finite and inside the level, the clock runs, and the seat counts what it put right
//   far        a seat marked remote that says it is looking from across the map is looking at its own man's surroundings by the time the tick reads it
//   seats      Game.stepSeats takes one record for the one seat and refuses any other count before anything runs
import { standUp, ROOT } from './headless.ts';
const { CMDCHECK, checkCmd, cmdText, cmdFromText } = await import(`${ROOT}/src/game/cmd.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { rawBits, RAW_BITS_SEED } = await import(`${ROOT}/src/game/digest.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const BREAK = process.env.CMDCHECK_BREAK === '1', DT = 1 / 60;
const raise = (on: boolean) => { CMDCHECK.on = on && !BREAK; };
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`=== cmdcheck-check: a record from anyone (src/game/cmd.ts) · ${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'} stand${BREAK ? ' · CMDCHECK_BREAK: the switch never raised' : ''} ===`);

/** the scripted player of every run here: walks, sweeps the cursor, fires, opens the order menu */
const script = (W: any, f: number) => { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1 && s < 7) I.keys.add('KeyW'); if (s > 4 && s < 6) I.keys.add('KeyD');
  I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420 + 150 * Math.cos(s * 0.5); if (f === 120 || f === 500) I.pressed.add('KeyB'); if (f === 240) I.pressed.add('KeyX');
  const b = s > 8 && s < 11 ? 1 : 0; if (b && !I.buttons) I.clicked |= 1; I.buttons = b; if (f === 300) I.wheel = 120; };
const stand = async (on: boolean) => { Math.random = mulberry32(0xc0de); const W: any = await standUp({ seed: 9 }); raise(on); const r = startFromQuery(W.game, 'roomclear&squad4'); if (r.why) throw new Error(r.why); return W; };
const wholeGame = (g: any): string => { const bad: string[] = [], ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x as number) < 1e4;
  const man = (who: string, c: any) => { if (!ok(c.pos[0]) || !ok(c.pos[1]) || !ok(c.pos[2]) || !ok(c.bodyYaw) || !ok(c.aimYaw)) bad.push(who); };
  man('the player', g.player.char); for (const gd of g.guards) man(gd.callsign ?? 'a man', gd.char); if (!ok(g.time)) bad.push('the clock');
  if (!Number.isFinite(g.aimPoint?.[0] ?? 0) || !Number.isFinite(g.aimPoint?.[2] ?? 0)) bad.push('the aim point'); return bad.join(', '); };

// ---- honest
{
  const run = async (on: boolean) => { const W = await stand(on); let h: number = RAW_BITS_SEED; const words: string[] = [];
    for (let f = 0; f < 15 * 60; f++) { script(W, f); W.step(DT); h = rawBits(W.game, h); if ((f + 1) % 30 === 0) words.push(h.toString(36)); }
    return { words, fixed: W.game.seat.fixed as number, cmds: W.game.seat.fixedCmds as number, on: CMDCHECK.on as boolean }; };
  const A = await run(false), B = await run(true); let k = 0; while (k < A.words.length && A.words[k] === B.words[k]) k++;
  verdict(B.on && !A.on && k === A.words.length && B.fixed === 0, 'honest: an honest run is the same game with the check on, and nothing in it was put right',
    `900 steps of a room clear with the four · ${k} of ${A.words.length} half seconds the same to the bit · put right with the check on: ${B.fixed} thing(s) in ${B.cmds} record(s)`);
}

// ---- shapes
{
  const W = await stand(true); for (let f = 0; f < 30; f++) { script(W, f); W.step(DT); }
  const good = cmdText(W.game.seat.cmd), fresh = () => cmdFromText(good) as any;
  const cases: [string, () => unknown][] = [
    ['nothing', () => undefined], ['null', () => null], ['a string', () => 'fire'], ['a number', () => 7], ['a list', () => [1, 2, 3]], ['an empty object', () => ({})],
    ['no view', () => { const c = fresh(); delete c.view; return c; }], ['a view that is a string', () => ({ ...fresh(), view: 'north' })],
    ['NaN everywhere', () => { const c = fresh(); for (const k of ['buttons', 'clicked', 'wheel', 'mx', 'my', 'w', 'h', 'pw', 'ph']) c[k] = NaN; for (const k of ['yaw', 'pitch', 'distance', 'fov', 'aspect', 'aimLead']) c.view[k] = NaN; c.view.pos = [NaN, NaN, NaN]; c.view.target = [NaN, NaN, NaN]; return c; }],
    ['the infinities', () => { const c = fresh(); c.mx = Infinity; c.my = -Infinity; c.wheel = Infinity; c.w = Infinity; c.view.distance = Infinity; c.view.fov = -Infinity; c.view.pos = [Infinity, 0, -Infinity]; c.view.target = [1e308, -1e308, 1e308]; return c; }],
    ['strings for numbers', () => { const c = fresh(); c.buttons = '1'; c.mx = '400'; c.view.yaw = 'east'; c.view.vp = 'identity'; return c; }],
    ['a million keys', () => { const c = fresh(); c.keys = Array.from({ length: 1e6 }, (_, i) => `Key${i}`); c.pressed = new Array(5e6); return c; }],
    ['keys nobody has', () => { const c = fresh(); c.keys = ['KeyW', '__proto__', 'constructor', '', 'x'.repeat(4000), 12, null, { toString() { throw new Error('read'); } }, 'Key W', 'KeyÅ']; return c; }],
    ['an eye on its look-at', () => { const c = fresh(); c.view.pos = [...c.view.target]; return c; }],
    ['an eye straight above', () => { const c = fresh(); c.view.pos = [c.view.target[0], c.view.target[1] + 20, c.view.target[2]]; return c; }],
    ['matrices of its own', () => { const c = fresh(); c.view.vp = c.view.vp.map((x: number) => x * 3 + 1); c.view.ivp = new Array(16).fill(1e300); return c; }],
    ['short matrices', () => { const c = fresh(); c.view.vp = [1, 2, 3]; c.view.ivp = []; return c; }],
    ['a flat view', () => { const c = fresh(); c.w = 0; c.h = -5; c.view.aspect = 0; c.view.fov = 0; return c; }],
    ['bits it has no buttons for', () => { const c = fresh(); c.buttons = 0xffffffff; c.clicked = -1; return c; }],
    ['a record that cannot be written', () => { const c = fresh(); c.mx = NaN; return Object.freeze(c); }],
    ['a record that throws when read', () => { const c = fresh(); Object.defineProperty(c, 'view', { get() { throw new Error('read'); } }); return c; }],
  ];
  /** what a local seat's host is believed about: finite matrices and an eye of its own (the three kinds a remote seat alone is refused) */
  const LOCAL_KEPT = new Set(['an eye on its look-at', 'an eye straight above', 'matrices of its own']);
  const wholeCmd = (c: any): string => { const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    if (typeof c !== 'object' || !c) return 'not an object';
    for (const k of ['buttons', 'clicked', 'wheel', 'mx', 'my', 'w', 'h', 'pw', 'ph']) if (!n(c[k])) return k;
    if (!Array.isArray(c.keys) || c.keys.length > CMDCHECK.keys || c.keys.some((s: unknown) => typeof s !== 'string' || !/^[A-Za-z0-9]{1,24}$/.test(s as string))) return 'keys';
    if (!Array.isArray(c.pressed) || c.pressed.length > CMDCHECK.keys) return 'pressed';
    if (c.buttons < 0 || c.buttons > 31 || c.clicked < 0 || c.clicked > 31 || c.w < 1 || c.h < 1) return 'bounds';
    const v = c.view; if (typeof v !== 'object' || !v) return 'view';
    for (const k of ['yaw', 'pitch', 'distance', 'fov', 'aspect', 'aimLead']) if (!n(v[k])) return `view.${k}`;
    for (const k of ['pos', 'target', 'forward']) if (!Array.isArray(v[k]) || v[k].length !== 3 || !v[k].every(n)) return `view.${k}`;
    for (const k of ['vp', 'ivp']) if (!Array.isArray(v[k]) || v[k].length !== 16 || !v[k].every(n)) return `view.${k}`;
    return ''; };
  /** a remote seat's view is the game's own working: the eye where the pose puts it, and ivp the inverse of vp */
  const ownView = (c: any): string => { const v = c.view;
    for (let i = 0; i < 3; i++) if (Math.abs(v.pos[i] - (v.target[i] - v.forward[i] * v.distance)) > 1e-3 * Math.max(1, v.distance)) return 'the eye is not where the pose puts it';
    let worst = 0; for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { let x = 0; for (let k = 0; k < 4; k++) x += v.ivp[k * 4 + r] * v.vp[q * 4 + k]; worst = Math.max(worst, Math.abs(x - (r === q ? 1 : 0))); }
    return worst < 1e-2 ? '' : `ivp is not the inverse of vp (off by ${worst.toExponential(1)})`; };
  const man = W.game.player.char.pos;
  const bad: string[] = []; let put = 0;
  for (const [name, make] of cases) {
    for (const near of [null, man]) { const who = near ? 'remote' : 'local';
      try { const r = checkCmd(make(), near), why = wholeCmd(r.cmd) || (near ? ownView(r.cmd) : ''), again = checkCmd(r.cmd, near); put += r.fixed;
        if (why) bad.push(`${name} (${who}): ${why}`); else if (!r.fixed && !(LOCAL_KEPT.has(name) && !near)) bad.push(`${name} (${who}): nothing was put right`);
        else if (again.fixed) bad.push(`${name} (${who}): a second check put ${again.fixed} more right`); }
      catch (e) { bad.push(`${name} (${who}): threw ${(e as Error).message}`); } }
  }
  const honest = checkCmd(fresh()), honestFar = checkCmd(fresh(), man);
  const lag = fresh(); lag.view.target[0] += 1.25; lag.view.yaw += 0.3; const lagText = cmdText(lag), lagged = checkCmd(lag);
  verdict(bad.length === 0 && honest.fixed === 0 && cmdText(honest.cmd) === good && honestFar.fixed === 0 && cmdText(honestFar.cmd) === good && lagged.fixed === 0 && cmdText(lagged.cmd) === lagText,
    'shapes: every kind of nonsense comes back a whole record, a remote seat\'s with the game\'s own view, and an honest one comes back itself',
    bad.length ? bad.slice(0, 6).join(' · ') : `${cases.length} kinds as a local and as a remote seat's, ${put} things put right, none threw, each whole and unchanged by a second check · the honest record: ${honest.fixed} put right as a local seat's, ${honestFar.fixed} as a remote one's, the same text · a local record whose matrices lag its pose: ${lagged.fixed} put right`);

  // ---- far
  const g = W.game, pc = g.player.char; g.seat.remote = true; raise(true);
  const c = fresh(); c.view.target = [pc.pos[0] + 400, 0, pc.pos[2] - 300]; c.view.pos = [c.view.target[0], 30, c.view.target[2] + 20];
  let threw = ''; try { g.step(DT, c); } catch (e) { threw = (e as Error).message; }
  const t = g.seat.cam.target, d = Math.hypot(t[0] - pc.pos[0], t[1] - pc.pos[1], t[2] - pc.pos[2]);
  verdict(!threw && d <= CMDCHECK.reach + 0.5, 'far: a remote seat looking from across the map is looking near its own man when the tick reads it',
    threw ? `the step threw: ${threw}` : `asked for a look-at 500 m from its man; the tick read one ${d.toFixed(1)} m away (the bound: ${CMDCHECK.reach} m)`);
  g.seat.remote = false;
}

// ---- hostile
{
  const W = await stand(true), g = W.game; const R = mulberry32(0xbad); g.seat.remote = !BREAK;   // (nonsense comes from a seat the game does not trust)
  const junk = (): unknown => { const k = Math.floor(R() * 12); return [NaN, Infinity, -Infinity, 1e308, -1e308, null, undefined, 'x', {}, [], -1, 2 ** 40][k]; };
  const FIELDS = ['keys', 'pressed', 'buttons', 'clicked', 'wheel', 'mx', 'my', 'w', 'h', 'pw', 'ph', 'view'], VIEW = ['vp', 'ivp', 'pos', 'forward', 'target', 'yaw', 'pitch', 'distance', 'fov', 'aspect', 'aimLead'];
  let threw = '', at = -1, sent = 0, broke = '';
  for (let f = 0; f < 12 * 60 && !threw && !broke; f++) {
    script(W, f);
    // the honest record of the tick is sampled as ever; three times in four it is then spoilt on its way to the step
    const step = Game.prototype.step;
    g.step = function (dt: number, cmd: any) { let c: any = cmd;
      if (R() < 0.75) { sent++; const how = R();
        if (how < 0.08) c = junk();
        else { c = cmdFromText(cmdText(cmd)); const n = 1 + Math.floor(R() * 4);
          for (let i = 0; i < n; i++) { if (R() < 0.5) c[FIELDS[Math.floor(R() * FIELDS.length)]] = junk();
            else if (c.view && typeof c.view === 'object') { const k = VIEW[Math.floor(R() * VIEW.length)]; c.view[k] = R() < 0.5 ? junk() : Array.isArray(c.view[k]) ? c.view[k].map(() => (R() < 0.5 ? junk() : (R() - 0.5) * 1e6)) : (R() - 0.5) * 1e9; } } } }
      return step.call(this, dt, c); };
    try { W.step(DT); } catch (e) { threw = String((e as Error).stack ?? e).split('\n').slice(0, 3).join(' | '); at = f; }
    delete g.step;
    if (!threw) { broke = wholeGame(g); const t = g.seat.cam.target, pc = g.player.char.pos, d = Math.hypot(t[0] - pc[0], t[1] - pc[1], t[2] - pc[2]); if (!broke && !(d <= CMDCHECK.reach + 0.5)) broke = `the seat's look-at, ${d.toFixed(0)} m from its man`; if (broke) at = f; }
  }
  verdict(!threw && !broke && sent > 400 && g.seat.fixedCmds > 300 && g.time > 11, 'hostile: a fight fed nonsense three records in four neither throws nor loses a number',
    threw ? `threw at step ${at}: ${threw.slice(0, 400)}` : broke ? `at step ${at} not finite or out of the level: ${broke}` : `720 steps, ${sent} spoilt records sent, ${g.seat.fixedCmds} put right (${g.seat.fixed} things), the clock at ${g.time.toFixed(1)} s, every man's place finite and inside the level, the seat's look-at never more than ${CMDCHECK.reach} m from its man`);
}

// ---- seats
{
  const W = await stand(true), g = W.game; W.step(DT); const c = cmdFromText(cmdText(g.seat.cmd)), t0 = g.time;
  let none = '', two = ''; try { g.stepSeats(DT, []); } catch (e) { none = (e as Error).message; } try { g.stepSeats(DT, [c, c]); } catch (e) { two = (e as Error).message; }
  const still = g.time === t0; g.stepSeats(DT, [c]);
  verdict(g.seats.length === 1 && g.seats[0] === g.seat && !!none && !!two && still && g.time > t0, 'seats: one record for the one seat steps the game; any other count is refused before anything runs',
    `seats ${g.seats.length} · no record: ${none ? 'refused' : 'TAKEN'} · two records: ${two ? 'refused' : 'TAKEN'} · the clock stood still through both ${still} · one record: the clock ran ${g.time > t0}`);
}

console.log(fails ? `=== cmdcheck-check: ${fails} FAILED ===` : '=== cmdcheck-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
