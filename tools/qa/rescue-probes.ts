// The 'rescue' family (game/rescue.ts — the HOSTAGE RESCUE playtest behind ?rescue / --rescue), run through probes.ts:
//   bun run tools/qa/probes.ts rescue | rescue-off | rescue-stage | rescue-clock | rescue-orders | rescue-set | rescue-tally | rescue-restart   [--verbose]
// PASS / FAIL each, all headless (the Game of headless.ts; the scenario started with game.rescue.start() exactly as main.ts's flag starts it, Sam's words given as
// one-frame F / X presses through the harness Input or by the same two methods the keys call). The harness has no light meter: Sam's visibility is planted dark
// and the AI men judge each other by guards.ts's direct-light estimate — what anybody SEES down that corridor at night is the harness's reading, not the page's.
// Sam is a statue at the lobby arch unless a probe moves him (teleports along the corridor): nothing here plays his part of the fight.
//   rescue-off      the flag off: nothing of it runs — inactive, no unit, no hostage, the shift and the civilians as ever, and F / X presses change nothing (ten
//                   seeded seconds digest the same with and without them)
//   rescue-stage    start(): the shift benched, the building's own civilians off the floor, two hostages down in the manager's office, the captor in it, the door
//                   man in the corridor, the roamer in the break room, the pair and Sam at the lobby arch, the hostage room's door shut, the side door unlocked,
//                   the budgets held; nothing moves and the clock does not start until Sam moves — then it does, and the pair fall in on him unasked
//   rescue-clock    CLOCK ONE with the spread at 0 and the team standing still: the three steps in order, the first hostage shot resolveSecs + aimSecs after the
//                   start, the second secondHostageSecs + aimSecs later, the run lost; the clock OFF: nobody is shot; a dazzled captor's clock stands still for
//                   the dazzle's length; a dead captor with nobody of his in the room: the clock stops and nobody is shot; a hostage hit by Sam's own round
//                   loses the run at once
//   rescue-orders   F with the clock running is bang and clear: the pair run the corridor and the door tools (the order menu's own bang and clear, given for Sam,
//                   one can out of the squad's three) take them at the door, stack → boot → can → bang → entry in order; the order menu's orders: the pair fall in
//                   unasked when the clock starts and trail Sam down the corridor past the conference room, never in it; the menu's hold, fall in again; a first
//                   order to one man still brings the other; a menu order takes them off F's entry on the way to the stack (the can comes back) AND with the boot
//                   going in (the door tools' rule — no 'committed'); the room called, they are posted; quiet start: F stacks and holds, F again goes, and the
//                   clock starts when the men inside hear the boot
//   (rescue-doortools  the menu's door orders on the rescue's doors, the charge, both doors on one F: rescuedoors-probes.ts)
//   rescue-set      CLOCK TWO: the same immediate assault against men who are never set before the bang (setSecs long) and men who always are (setSecs short) —
//                   no blind round from the unset, blind rounds from the set, and the team is through the door sooner on the unset room (it falls at least as often, for no more men); the roamer leaves his post once he is set, or sooner on the room fight's own rally; the captor never leaves the room
//   rescue-tally    THE CLOCK CHANGES THE OUTCOME: the default knobs over the same seeds with the order given at once, after 10 s and after 45 s of standing at
//                   the arch (the stand-in for time spent on rooms along the way), and after 45 s with the clock off — hostages alive in each
//   (rescue-flow-*  the pair's unasked covers, the openings' states and the two-door go: rescueflow-probes.ts)
//   rescue-restart  a restart under it stages it again (fresh cast, hostages alive, clock back to not started); stop() puts the shift, the building's civilians,
//                   the doors and the light count back and the floor runs on; a checkpoint load is refused while it is up
import { standUp, ROOT } from './headless.ts';
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { killGuard, fireWeapon, FLASH } = await import(`${ROOT}/src/game/combat.ts`);
const { NVG } = await import(`${ROOT}/src/game/nvg.ts`);
const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { FROZEN_HOLDS, pinned } = await import(`${ROOT}/src/host/profile.ts`);
const { glassFxForced } = await import(`${ROOT}/src/game/glass.ts`);
const { glassPenHarness, GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`);

export const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const f1 = (x: number | undefined) => (x === undefined ? '—' : Number.isFinite(x) ? x.toFixed(1) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
export function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** a probe that throws is a FAIL line, not a crash of the runner */
export const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { Object.assign(RESCUE, DEFAULTS); FLASH.on = FLASH_ON; } };
const DEFAULTS = { ...RESCUE }, FLASH_ON = FLASH.on;
/** THE RULES A SCENE WAS STAGED ON. Six of the rescue's probes are single staged scenes (one seed, marks walked by hand) or small tallies whose bounds were read on the
 *  frozen stand, and read red on the shipped one (TPS_PROFILE=shipped): a newer rule makes it another run, which is not by itself a fault in the rescue (the office
 *  rescue PLAYED as shipped, `tools/qa/ships.ts --scn hostage-rescue`, ends with both hostages alive). So such a probe names the rules its scene was staged without —
 *  by the rule's row in the stands' own list (src/host/profile.ts FROZEN_HOLDS), or 'glass' for the three glass parts — and they are held off for the WHOLE probe on
 *  either stand: nothing to do on the frozen one; on the shipped one the probe's last line says what was held, since its PASS there is then not the rule's. A rule
 *  whose own env word the run gives is left to that word, as on any stand. Each list is a set that turns its probe green on the shipped stand, found once by taking
 *  the shipped rules out by halves (single seeds: not the only such set, and nothing re-reads it — take a rule off a list and run the probe shipped to see):
 *    rescue-doortools      DOORWAY.oneWay · DOORTOOLS.testDoor ('stacked → the boot' is one order there) · DOORTOOLS.outsidePlain (the threshold rows its menu check asks for)
 *                          — and rounds stopping in glass for ONE scene of it, the captor's clock under the can (paneStops below: he is shot through the pane beside the door before the can goes off)
 *    rescue-flow-pass      DOORMANNERS.on (the nearer man 3.5 m from Sam)
 *    rescue-flow-states    DOORMANNERS.on · glass (the roamer behind the conference glazing is shot through the pane)
 *    rescue-flow-twodoor   DARKFOE.on ('F is a man short')
 *    rescue-orders         DOORMANNERS.on · DARKFOE.on
 *    rescue-set            DOORMANNERS.on · glass · MOVES.gait (one part of the moves, the page under TPS_MOVES=1,gait=0. With glass held and the gait on, the untrained
 *                          stance lifts the captor's head a few degrees and — as traced on the moves' side — he sees the pair through the pane before the bang: the six-seed tally reads 4 of 6
 *                          rooms and 7 of 12 men where every bound was read at 6 of 6 and 12 of 12. Only in this staging — with nothing held the gait costs nothing) */
export type Staged = 'DOORWAY.oneWay' | 'DOORMANNERS.on' | 'DARKFOE.on' | 'DOORTOOLS.testDoor' | 'DOORTOOLS.outsidePlain' | 'MOVES.gait' | 'glass';
let HELD: readonly Staged[] = []; const HELD_OFF = new Set<string>();
/** the glass parts off for a game a 'glass' probe has stood, by the frozen stand's own line (src/host/standup.ts): they are the stood game's, not a table's */
function holdGlass(game: any) {
  if (!HELD.includes('glass') || glassFxForced() === true || /^(on|shipped)$/i.test(process.env.GLASSPARTS ?? '')) return;
  if (game.tune.glassBreak || game.tune.glassShards) HELD_OFF.add('glass');
  game.tune.glassBreak = false; game.tune.glassShards = false; glassPenHarness();
}
/** a guarded probe whose scenes were staged without these rules: the tables written before its first stand-up (doors are dealt as a Game is built) and put back after it */
export const staged = (rules: readonly Staged[], fn: () => Promise<boolean>) => async () => {
  const was = HELD, put: [Record<string, unknown>, string, unknown][] = []; HELD_OFF.clear();
  try {
    return await guarded(async () => {
      for (const r of rules) { if (r === 'glass') continue;
        const [t, k] = r.split('.'), T = knobRegistry()[t] as Record<string, unknown> | undefined, word = /^[A-Z][A-Z0-9_]*(?==)/.exec(FROZEN_HOLDS[r] ?? FROZEN_HOLDS[`${t}.on`] ?? '')?.[0];   // (a part of a rule goes by the rule's own row and word: MOVES.gait by MOVES.on's)
        if (!T || !(k in T) || !word) throw new Error(`staged: '${r}' is no knob with a word of its own in FROZEN_HOLDS`);
        if (process.env[word] === undefined && !pinned(word) && T[k]) { put.push([T, k, T[k]]); T[k] = typeof T[k] === 'number' ? 0 : false; HELD_OFF.add(r); } }   // (a stand that pins the word has the rule off by its own line; MOVES.on is a number)
      HELD = rules; return fn();
    })();
  } finally { HELD = was; for (const [T, k, v] of put) T[k] = v; if (HELD_OFF.size) console.log(`    (staged without, and held off for this probe: ${[...HELD_OFF].join(' · ')} — rescue-probes.ts 'THE RULES A SCENE WAS STAGED ON')`); }
};
/** ONE SCENE of a `staged` probe with rounds stopping in glass (glasspen.ts GLASSPEN.on off: the page under ?glasspen=0), the rest of the probe as its stand has
 *  it — put off before the scene's stand-up (the shipped stand's writes no table) and put back after it. A run that names GLASSPEN keeps its word; the probe's last
 *  line says what was held */
export async function paneStops<T>(fn: () => Promise<T>): Promise<T> {
  const pen = GLASSPEN.on; glassPenHarness(); if (pen && !GLASSPEN.on) HELD_OFF.add('rounds through a pane (for one scene of it)');
  try { return await fn(); } finally { GLASSPEN.on = pen; }
}
export const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const steady = (W: any) => W.engine.lights.lights.filter((l: any) => l.ttl < 0).length;
export const up = (l: any[]) => l.filter(x => x.state !== 'dead').length;
/** one of the order menu's orders to the whole pair, as the menu's release gives it (orders.ts): null = given, else why not */
export const give = (T: any, id: string): string | null => { const p = T.game.player.char.pos; return T.game.orders.give(id, { kind: 'none', at: [p[0], 0, p[2]] }, 'all'); };
export const orderOf = (T: any, o: any): string => T.game.orders.of(o)?.order ?? 'none';

/** One staged scenario under a seed: step() keeps Sam dark, counts rounds by side off the 'guardShot' events and watches every position stay finite. */
export async function rig(seed: number, knobs: Record<string, unknown> = {}, start = true, chaos = 0.5) {
  Object.assign(RESCUE, DEFAULTS, { seedRoamers: false }, knobs);   // (the probes pin the roamer in the break room unless they ask for the draw)
  Math.random = seeded(seed);
  const log = console.log; if (!VERBOSE) console.log = () => { };
  let W: any; try { W = await standUp(); } finally { console.log = log; }
  const game = W.game; const R = game.rescue; holdGlass(game);
  const before = { guards: game.guards.length, civilians: game.civilians.length, civNames: game.civilians.map((c: any) => c.callsign).join(','), steady: steady(W), tune: JSON.stringify(game.tune),
    door: game.doors.byName('manager').angle, sideLocked: game.doors.byName('server_manager').locked };
  game.tune.chaos = chaos;
  const why = start ? R.start() : null;
  const seen = new WeakSet<object>();
  const T = { W, game, R, why, before, shots: {} as Record<string, number>, bad: '', samHit: false,
    step(n = 1) {
      const l = console.log; if (!VERBOSE) console.log = () => { };
      try {
        for (let i = 0; i < n; i++) {
          game.player.visibility = 0.05; W.step(DT);
          for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'guardShot') { const w = game.guards.find((x: any) => x.char.id === e.who); const k = w ? w.team : '?'; T.shots[k] = (T.shots[k] ?? 0) + 1; } }
          if (game.player.down || game.player.hitFlash > 0) T.samHit = true;
          for (const x of [...game.guards, ...game.civilians]) if (!T.bad && !x.char.pos.every(Number.isFinite)) T.bad = `${x.callsign} at ${x.char.pos}`;
        }
      } finally { console.log = l; }
    },
    secs(s: number, until?: () => boolean) { for (let i = 0; i < Math.round(s / DT); i++) { T.step(); if (until?.()) return true; } return false; },
    press(code: string) { W.input.pressed.add(code); T.step(); },
    /** game time of the first log line `what` (undefined = never), and the same measured from the clock's start */
    /** (of THIS staging: the log runs on across restages, so the search starts at the last 'staged' line) */
    at(what: string | RegExp): number | undefined { const i0 = R.log.map((l: any) => l.what).lastIndexOf('staged'); return R.log.find((l: any, i: number) => i >= i0 && (typeof what === 'string' ? l.what === what : what.test(l.what)))?.t; },
    since(what: string | RegExp): number | undefined { const t = T.at(what); return t === undefined || isNaN(R.t0) ? undefined : t - R.t0; },
    order(whats: string[]): boolean { let i = R.log.map((l: any) => l.what).lastIndexOf('staged') - 1; for (const w of whats) { const j = R.log.findIndex((l: any, k: number) => k > i && l.what === w); if (j < 0) return false; i = j; } return true; },
    walkSam(to: number[], speed = 3.2) { const p = game.player.char.pos; const d = dist(p, to); const n = Math.max(1, Math.ceil(d / (speed * DT))); const from = [p[0], 0, p[2]];
      for (let i = 1; i <= n; i++) { game.teleportPlayer([from[0] + (to[0] - from[0]) * i / n, 0, from[2] + (to[2] - from[2]) * i / n]); T.step(); } },
  };
  return T;
}

export const rescueOff = guarded(async () => {
  const F = family('rescue-off: the flag off — nothing of it runs, and its keys are dead keys');
  const run = async (press: boolean) => { const T = await rig(5, {}, false, 0); for (let i = 0; i < 600; i++) { if (press && (i === 60 || i === 200)) T.W.input.pressed.add('KeyF'); if (press && (i === 120 || i === 260)) T.W.input.pressed.add('KeyX'); T.step(); } return T; };
  const A = await run(false), B = await run(true);
  const R = B.R, g = B.game;
  F.verdict(!R.active && R.state === 'off' && R.ops.length === 0 && R.hostiles.length === 0 && R.hostages.length === 0 && !g.guards.some((x: any) => x.unit), 'inactive: no cast, no unit on the floor',
    `active ${R.active} · state ${R.state} · units ${g.guards.filter((x: any) => x.unit).length} · '${R.summary()}'`);
  F.verdict(g.guards.length === B.before.guards && g.civilians.length === B.before.civilians && g.civilians.every((c: any) => !R.isHostage(c)), 'the shift and the building\'s civilians as ever',
    `guards ${g.guards.length} (was ${B.before.guards}) · civilians ${g.civilians.length} (was ${B.before.civilians})`);
  const da = JSON.stringify(digestGame(A.game, true)), db = JSON.stringify(digestGame(B.game, true));
  F.verdict(da === db, 'ten seeded seconds digest the same with and without F / X presses', `digest ${da.length} chars · equal ${da === db}`);
  F.verdict(R.orderDoor() === null && R.callOff() === null && R.log.length === 0, 'the order and the call-off called by hand do nothing', `log ${R.log.length} lines`);
  return F.done();
});

export const rescueStage = guarded(async () => {
  const F = family('rescue-stage: start() puts everybody on his mark and nothing runs until Sam moves');
  const T = await rig(7); const { R, game: g } = T; const B = R.plan?.bounds;
  const inRoom = (p: number[]) => !!B && p[0] > B.x0 && p[0] < B.x1 && p[2] > B.z0 && p[2] < B.z1;
  F.verdict(T.why === null && R.active && R.state === 'staged', 'start() accepted, staged', `why ${T.why} · '${R.summary()}'`);
  F.verdict(!g.guards.some((x: any) => !x.unit) && g.civilians.length === 2 && g.civilians.every((c: any) => R.isHostage(c)), 'the shift benched, the building\'s own civilians off the floor',
    `staff on the list ${g.guards.filter((x: any) => !x.unit).length} · civilians ${g.civilians.map((c: any) => c.callsign).join(', ')}`);
  const [cap, door, roam] = R.hostiles;
  F.verdict(R.hostiles.length === 3 && inRoom(cap.char.pos) && !inRoom(door.char.pos) && Math.abs(door.char.pos[2] - 11.1) < 0.6 && roam.char.pos[2] > 12.5 && R.hostiles.every((h: any) => h.team === 'hostile' && h.hold && h.pinned && h.state === 'patrol'),
    'captor in the office, door man in the corridor, roamer in the break room — held, pinned, calm', R.hostiles.map((h: any) => `${h.callsign} ${h.char.pos.map((v: number) => v.toFixed(1))} ${h.state}`).join(' · '));
  { const at: string[] = []; for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) { const T3 = await rig(sd, { seedRoamers: true }, false); const same = SAMESTART.on; SAMESTART.on = false; T3.R.start(); SAMESTART.on = same;   /* (the draw is the deal behind 'every mission starts the same', which the shipped stand has on) */ const r = T3.R.hostiles[2]; at.push(!r ? '?' : r.char.pos[2] > 12.5 ? 'break' : r.char.pos[2] < 9 && r.char.pos[0] < 10 ? 'conf' : '?'); T3.R.stop(); }
    F.verdict(at.every(x => x !== '?') && at.includes('break') && at.includes('conf'), 'seedRoamers (the default): the roamer\'s room is drawn at each staging — the break room or the conference room, both turn up over eight seeds', at.join(' ')); }
  { const T2 = await rig(7, { captorSet: false }); const s1 = T.at('set:Captor') !== undefined, s2 = T2.at('set:Captor') !== undefined; T2.R.stop();
    F.verdict(s1 && !s2 && T.at('set:Door man') === undefined, 'a hot start: the captor begins set on the corridor door, the others unset (captorSet off: he starts unset too)', `default: captor set at staging ${s1} · captorSet off: ${s2}`); }
  F.verdict(R.hostages.length === 2 && R.hostages.every((h: any) => inRoom(h.char.pos) && h.state !== 'dead' && h.civ.state === 'cower' && h.civ.complied && h.team === 'civilian'),
    'two hostages down in the office, told to stay down', R.hostages.map((h: any) => `${h.callsign} ${h.char.pos.map((v: number) => v.toFixed(1))} ${h.civ.state}`).join(' · '));
  F.verdict(R.ops.length === 2 && R.ops.every((o: any) => o.team === 'operative' && dist(o.char.pos, RESCUE.samAt) < 3 && o.trained) && dist(g.player.char.pos, RESCUE.samAt) < 0.3 && g.player.slot === 'rifle' && !g.player.holstered,
    'the pair and Sam at the lobby arch, the rifle in his hands', `ops ${R.ops.map((o: any) => o.char.pos.map((v: number) => v.toFixed(1))).join(' / ')} · Sam ${g.player.char.pos.map((v: number) => v.toFixed(1))} slot ${g.player.slot}`);
  const d = g.doors.byName('manager'), sd = g.doors.byName('server_manager');
  F.verdict(d.angle === 0 && d.latched && sd.angle === 0 && sd.latched && !sd.locked, 'the hostage room\'s door shut on its latch; the side door shut and unlocked', `manager ${d.angle} latched ${d.latched} · side ${sd.angle} locked ${sd.locked} (authored ${T.before.sideLocked})`);
  F.verdict(1 + g.guards.length <= 8 && steady(T.W) <= MAX_LIGHTS && g.qrf.state === 'idle', 'the budgets: ≤ 8 shadowed characters before the hostages, the steady lights, the response team idle',
    `Sam + ${g.guards.length} units (+ ${g.civilians.length} hostages) · steady lights ${steady(T.W)} of ${MAX_LIGHTS} · qrf ${g.qrf.state}`);
  const pos0 = [...g.guards, ...g.civilians].map((x: any) => [...x.char.pos]);
  T.secs(5);
  const moved = Math.max(...[...g.guards, ...g.civilians].map((x: any, i: number) => dist(x.char.pos, pos0[i])));
  F.verdict(moved < 0.15 && isNaN(R.t0) && R.state === 'staged' && !Object.keys(T.shots).length && up(R.hostages) === 2 && !T.bad, 'five seconds with no input: nobody moves, nobody fires, the clock has not started',
    `most anybody moved ${moved.toFixed(2)} m · t0 ${R.t0} · rounds ${JSON.stringify(T.shots)} · ${T.bad || 'all positions finite'}`);
  T.walkSam([8.6, 0, 12.4]); T.secs(0.2);
  F.verdict(R.dynamic && R.state === 'running' && T.at('clock:move') !== undefined && R.ops.every((o: any) => orderOf(T, o) === 'fallIn'), 'Sam moves: the clock starts and the pair fall in on him unasked (the order menu\'s fall in)', `t0 ${f1(R.t0)} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · log ${R.log.map((l: any) => l.what).join(' ')}`);
  return F.done();
});

export const rescueClock = guarded(async () => {
  const F = family('rescue-clock: the captor\'s clock — the steps, the two shots, the charge that stops it, the round that loses the run');
  const K = { resolveSpread: 0, resolveSecs: 20, secondHostageSecs: 6 };
  const hold = (T: any) => { give(T, 'hold'); T.step(); };   // (the menu's hold: the clock started by an order, the pair standing where they are)
  { const T = await rig(21, K); const R = T.R; hold(T); T.secs(40, () => !!R.result);
    const ex = R.log.filter((l: any) => l.what.startsWith('executed:')).map((l: any) => l.t - R.t0);
    F.verdict(T.order(['step:shouting', 'step:counting', 'step:about to', 'act']), 'shouting → counting → about to → he turns on her, in order', R.log.filter((l: any) => /^step|^act/.test(l.what)).map((l: any) => `${f1(l.t - R.t0)} ${l.what}`).join(' · '));
    F.verdict(ex.length === 2 && Math.abs(ex[0] - (20 + RESCUE.aimSecs)) < 0.25 && Math.abs(ex[1] - ex[0] - (6 + RESCUE.aimSecs)) < 0.25, 'the first hostage shot resolveSecs + aimSecs after the start, the second secondHostageSecs + aimSecs later',
      `shot at ${ex.map((x: number) => x.toFixed(2)).join(' and ')} s (expected ${(20 + RESCUE.aimSecs).toFixed(1)} and ${(26 + 2 * RESCUE.aimSecs).toFixed(1)})`);
    F.verdict(R.state === 'lost' && up(R.hostages) === 0 && (T.shots.hostile ?? 0) >= 2 && !T.bad, 'both dead: the run is lost, on real rounds', `state ${R.state} — ${R.result?.why} · hostile rounds ${T.shots.hostile ?? 0}`); }
  { const T = await rig(21, { ...K, clock: false }); const R = T.R; hold(T); T.secs(40);
    F.verdict(up(R.hostages) === 2 && !R.result && T.at('act') === undefined, 'the clock OFF: forty seconds, nobody is shot', `hostages ${up(R.hostages)}/2 · state ${R.state}`); }
  { const T = await rig(21, K); const R = T.R, cap = R.hostiles[0]; hold(T); T.secs(8); cap.dazzledUntil = T.game.time + 5; const r0 = R.resolve; T.secs(4.9); const r1 = R.resolve; T.secs(30, () => up(R.hostages) < 2);
    const ex = (T.at(/^executed:/) ?? NaN) - R.t0;
    F.verdict(Math.abs(r1 - r0) < 0.01 && Math.abs(ex - (25 + RESCUE.aimSecs)) < 0.4, 'a captor dazzled for five seconds: his clock stands still for five', `resolve ${r0.toFixed(3)} → ${r1.toFixed(3)} across the dazzle · first shot at ${ex.toFixed(2)} s (expected ${(25 + RESCUE.aimSecs).toFixed(1)})`); }
  { const T = await rig(21, { ...K, doorMan: 'corridor', roamers: 0 }); const R = T.R, cap = R.hostiles[0]; hold(T); T.secs(5); killGuard(T.game, cap, [1, 0, 0], false, 'shot', 'player'); T.secs(35);
    F.verdict(up(R.hostages) === 2 && R.clockStep === 'stopped' && !R.result, 'the captor dead and nobody of his in the room: the clock stops, nobody is shot', `hostages ${up(R.hostages)}/2 · step ${R.clockStep} · state ${R.state}`); }
  { const T = await rig(21, K); const R = T.R, h = R.hostages[0]; hold(T); T.secs(18.5);   // (and one broken mid-act: the captor killed with his gun on her)
    const cap = R.hostiles[0], Fg = T.game.fight, rec0 = Fg.defs.find((d: any) => d.gd === cap);
    T.secs(4, () => T.at('act') !== undefined); const acted = T.at('act') !== undefined; T.secs(0.8);
    const want = Math.atan2(h.char.pos[0] - cap.char.pos[0], h.char.pos[2] - cap.char.pos[2]), fw = cap.char.forward(), off = Math.abs(Math.atan2(Math.sin(Math.atan2(fw[0], fw[2]) - want), Math.cos(Math.atan2(fw[0], fw[2]) - want)));
    const nearest = R.hostages.reduce((a: any, b: any) => dist(a.char.pos, cap.char.pos) <= dist(b.char.pos, cap.char.pos) ? a : b);
    const fwN = Math.atan2(nearest.char.pos[0] - cap.char.pos[0], nearest.char.pos[2] - cap.char.pos[2]), offN = Math.abs(Math.atan2(Math.sin(Math.atan2(fw[0], fw[2]) - fwN), Math.cos(Math.atan2(fw[0], fw[2]) - fwN)));
    F.verdict(acted && !!cap.script && !Fg.defs.some((d: any) => d.gd === cap) && offN < 0.35, 'the act: for that second he is on the scenario\'s script and off the room fight\'s roster, his body turned on the hostage nearest him (the tell)',
      `script ${!!cap.script} · on the roster ${Fg.defs.some((d: any) => d.gd === cap)} · ${(offN * 180 / Math.PI).toFixed(0)}° off her`); void off;
    { const T2 = await rig(21, { ...K, clock: true }); const R2 = T2.R, c2 = R2.hostiles[0], F2 = T2.game.fight; hold(T2); T2.secs(2); const r0 = F2.defs.find((d: any) => d.gd === c2); T2.secs(30, () => T2.at(/^executed:/) !== undefined); T2.secs(0.3);
      const recs = F2.defs.filter((d: any) => d.gd === c2);
      F.verdict(!!r0 && recs.length === 1 && recs[0] === r0 && c2.hold === true && !c2.script, 'after the round he is back on the roster — once, the same record he had (what he had heard at which door is kept), holding', `records ${recs.length} · same ${recs[0] === r0} · hold ${c2.hold} · script ${!!c2.script}`); T2.R.stop(); }
    void rec0;
    killGuard(T.game, R.hostiles[0], [1, 0, 0], false, 'shot', 'player'); T.secs(3);
    F.verdict(acted && up(R.hostages) === 2 && T.at('act:broken') !== undefined, 'the captor shot while he is lining up on her: the round never comes', `acted ${acted} · hostages ${up(R.hostages)}/2 · ${R.log.slice(-3).map((l: any) => l.what).join(' ')}`);
    void h; }
  { const T = await rig(21, { ...K, roamers: 1 }); const R = T.R, g = T.game, [cap, , roam] = R.hostiles; hold(T); T.secs(18);   // THE HAND-OVER: resolve 0.9 with the captor alive
    const near = R.hostages[0].char.pos; roam.char.pos = [near[0] + 0.5, 0, near[2] + 0.9]; const r0 = R.resolve; T.secs(0.5);
    const kept = R.captor() === cap && R.resolve > r0;
    killGuard(g, cap, [1, 0, 0], false, 'shot', 'player'); T.secs(0.2);
    const cap2 = R.captor(), r2 = R.resolve, want = 1 - 6 / 20;
    F.verdict(kept && cap2 === roam && r2 <= want + 0.02 && r2 > want - 0.05, 'a second man walking in takes nothing over while the captor lives; the captor dead, the clock is his — secondHostageSecs from the shot at the soonest',
      `resolve ${r0.toFixed(2)} → ${R.resolve.toFixed(2)} with ${cap2?.callsign} now holding it (kept by the captor while he lived: ${kept}; expected about ${want.toFixed(2)})`); }
  { const T = await rig(21, { ...K, clock: false, roamers: 0, doorMan: 'inside' }); const R = T.R, g = T.game, [cap, dm] = R.hostiles, [h0, h1] = R.hostages; hold(T); T.secs(1);   // REAL ROUNDS at the hostages
    const chest = (x: any) => x.char.bones.chest ?? [x.char.pos[0], 1.0, x.char.pos[2]];
    for (let i = 0; i < 6; i++) { fireWeapon(g, cap.char, chest(h0), false, { steady: true, spread: 0 }); fireWeapon(g, dm.char, chest(h1), false, { steady: true, spread: 0 }); T.step(6); }
    const afterTheirs = up(R.hostages);
    killGuard(g, cap, [1, 0, 0], false, 'shot', 'player'); killGuard(g, dm, [1, 0, 0], false, 'shot', 'player'); T.step(2);
    const op = R.ops[0]; op.char.pos = [26.6, 0, 7.6]; op.char.bodyYaw = op.char.aimYaw = Math.PI; T.secs(0.5);
    for (let i = 0; i < 6; i++) { fireWeapon(g, op.char, chest(h0), false, { steady: true, spread: 0 }); T.step(6); }
    F.verdict(afterTheirs === 2 && up(R.hostages) === 2 && !R.result, 'the captor\'s side\'s rounds and an operative\'s, fired straight at the hostages, pass them (only the captor\'s own act and Sam\'s rounds can kill one)',
      `hostages after 12 hostile rounds ${afterTheirs}/2 · after 6 of an operative's ${up(R.hostages)}/2 · state ${R.state}`);
    g.teleportPlayer([27.3, 0, 7.4]); g.player.char.aimYaw = g.player.char.bodyYaw = Math.atan2(h1.char.pos[0] - 27.3, h1.char.pos[2] - 7.4); T.secs(0.4);
    for (let i = 0; i < 4 && !R.result; i++) { fireWeapon(g, g.player.char, chest(h1), true, {}); T.step(8); }
    F.verdict(R.state === 'lost' && /own fire/.test(R.result?.why ?? '') && T.at(/^teamfire:/) !== undefined && h1.state === 'dead', 'a hostage hit by Sam\'s own round — a real one, fired from two metres — loses the run at once', `state ${R.state} — ${R.result?.why}`); }
  { const T = await rig(21, { ...K, clock: false, roamers: 0 }); const R = T.R, g = T.game, dm = R.hostiles[1]; hold(T); T.secs(0.5);   // SAM DOWN: a real round from the door man down the corridor
    g.teleportPlayer([24, 0, 11.1]); T.secs(0.3);
    for (let i = 0; i < 5 && !g.player.down; i++) { const c = g.player.char; fireWeapon(g, dm.char, c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]], false, { steady: true, spread: 0 }); T.step(4); }
    T.secs(0.2);
    F.verdict(g.player.down && R.state === 'lost' && R.result?.grade === 'failed' && /down/.test(R.result?.why ?? ''), 'Sam shot down: the run is failed', `down ${g.player.down} · state ${R.state} — ${R.result?.why}`); }
  return F.done();
});

export const rescueOrders = staged(['DOORMANNERS.on', 'DARKFOE.on'], async () => {
  const F = family('rescue-orders: F bangs and clears the hostage room (the door tools\' order, given for Sam); the order menu has the pair otherwise; the quiet start\'s two words');
  // (the light rule's own line is read with the goggles off: with them — nvg.ts — the pair walks the corridor dark until the charge, probes.ts nvg-quiet / nvg-loud)
  { const nv = NVG.on; NVG.on = false; const T = await rig(11, { setSecs: 30, captorSet: false }); const R = T.R; T.secs(0.5); const dark = R.ops.every((o: any) => !o.flashlight.enabled); T.press('KeyF'); T.secs(1.5);
    const walk = R.ops.every((o: any) => o.flashlight.enabled); let lit = false, stack = false;
    T.secs(45, () => { const up = R.ops.filter((o: any) => o.state !== 'dead'); if (T.at('stacked') !== undefined && T.at('door-flung') === undefined && up.length && up.every((o: any) => !o.flashlight.enabled)) stack = true;
      if (T.at('enter1') !== undefined && up.some((o: any) => o.flashlight.enabled)) lit = true; return R.state === 'secured' || !!R.result; });
    F.verdict(dark && walk && stack && lit, 'the pair\'s weapon lights (light discipline, guards.ts LIGHTS): dark at the arch, on for the walk down the corridor on their own, dark stacked on the door, on going in', `before ${dark ? 'dark' : 'ON'} · on the way to the door ${walk ? 'on' : 'DARK'} · stacked ${stack ? 'dark' : 'ON'} · in the room ${lit ? 'on' : 'DARK'}`);
    NVG.on = nv;   // (the run is over: what follows reads its log)
    F.verdict(T.at('order:bang') !== undefined && R.dynamic, 'one F on a hot start: the order itself starts the clock, so it is bang and clear in one word', R.log.slice(0, 4).map((l: any) => l.what).join(' '));
    F.verdict(T.order(['order:bang', 'stacked', 'kick', 'door-flung', 'toss', 'bang', 'enter1']) && T.game.doorTools.bangs === 2 && T.game.doorTools.log.some((l: any) => /^bangClear manager: ordered/.test(l.what)),
      'the door tools take them at the door (the order menu\'s own bang and clear, one can out of the squad\'s three): stack → boot → door → can → bang → entry, in order',
      R.log.filter((l: any) => !/^step|learned|set:/.test(l.what)).map((l: any) => `${f1(l.t - R.t0)} ${l.what}`).join(' · ').slice(0, 420));
    const dm = R.hostiles[1];
    F.verdict(dm.state === 'dead' && (T.shots.operative ?? 0) > 0 && (T.since('stacked') ?? 0) > (T.since('caught:Door man') ?? 99), 'the door man in the corridor was fought on the way — the pair\'s own eyes, real rounds — before the stack', `door man ${dm.state} · team rounds ${T.shots.operative ?? 0} · he saw them at ${f1(T.since('caught:Door man'))} s, stacked at ${f1(T.since('stacked'))} s`);
    F.verdict(R.captor() === null || R.state === 'secured' || R.result !== null, 'the entry resolves: the room secured, or the run decided', `'${R.summary()}'`);
    F.verdict(!T.bad && !T.samHit, 'no bad position; Sam at the arch untouched', T.bad || 'finite');
    const secured = R.state === 'secured'; T.secs(2 * RESCUE.holdSecs + 6, () => !!R.result);   // (the roamer coming to the noise can walk into the held room: it is not held while he is up in it, and the count starts again when he is down)
    const tS = R.log.filter((l: any) => l.what === 'secured').pop()?.t ?? NaN, again = R.log.filter((l: any) => l.what === 'secured').length - 1;
    F.verdict(secured && R.result?.state === 'rescued' && R.result.grade === 'clean' && Math.abs((T.at('rescued') ?? 0) - tS - RESCUE.holdSecs) < 0.5 && R.result.hostages === 2, 'the room held holdSecs (from when it was last secured): RESCUED, graded clean — both hostages alive',
      `secured ${secured}${again ? ` · contested and secured again ×${again}` : ''} · result ${JSON.stringify(R.result)} · held ${f1((T.at('rescued') ?? NaN) - tS)} s`);
    const did = R.orderDoor(); F.verdict(did === null, 'F after the end does nothing', `did ${did}`); }
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false, flow: false }); const R = T.R; T.secs(0.3);   // (the flow off: the pair only follow — rescueflow-probes.ts has it on)
    let inConf = false, minZ = 99; const B = { x0: 4.12, x1: 13.94, z1: 9.94 };   // (the conference room, south of the corridor's west half; its door stands open at x ≈ 9.6)
    const watch = () => { for (const o of R.ops) { minZ = Math.min(minZ, o.char.pos[2]); if (o.char.pos[0] > B.x0 && o.char.pos[0] < B.x1 && o.char.pos[2] < B.z1) inConf = true; } };
    const walk = (to: number[]) => { const p = T.game.player.char.pos, from = [p[0], 0, p[2]], n = Math.ceil(dist(from, to) / (3.2 * DT)); for (let i = 1; i <= n; i++) { T.game.teleportPlayer([from[0] + (to[0] - from[0]) * i / n, 0, from[2] + (to[2] - from[2]) * i / n]); T.step(); watch(); } };
    walk([8.2, 0, 11.2]); walk([20, 0, 11.2]); for (let i = 0; i < 90; i++) { T.step(); watch(); }
    const near = R.ops.map((o: any) => dist(o.char.pos, T.game.player.char.pos));
    const maxLag = Math.max(...near);
    // (5.5 m, was 5: with doorway.ts on, the second man no longer stops 'near enough' touching his mate 3.9 m back — he walks on to his own place in the file, 5.2 m back)
    F.verdict(R.ops.every((o: any) => orderOf(T, o) === 'fallIn') && maxLag < 5.5 && !inConf && R.ops.every((o: any) => o.char.pos[0] > 14), 'fall in (unasked, the flow off): Sam walks the corridor past the conference room — the pair are on his trail, past it, and never in it',
      `orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · the pair ${near.map((d: number) => d.toFixed(1)).join(' / ')} m from Sam at x ${T.game.player.char.pos[0].toFixed(1)} · ops ${R.ops.map((o: any) => o.char.pos.map((v: number) => v.toFixed(1))).join(' / ')} · furthest south either went z ${minZ.toFixed(1)}`);
    const w1 = give(T, 'hold'); T.secs(0.5); const p0 = R.ops.map((o: any) => [...o.char.pos]); T.walkSam([14, 0, 11.2]); T.secs(6);
    const drift = Math.max(...R.ops.map((o: any, i: number) => dist(o.char.pos, p0[i])));
    F.verdict(w1 === null && R.ops.every((o: any) => orderOf(T, o) === 'hold') && drift < 0.6, 'the menu\'s hold: Sam walks off and they stay', `given ${w1 ?? 'yes'} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · moved ${drift.toFixed(2)} m`);
    const w2 = give(T, 'fallIn'); T.secs(5);
    F.verdict(w2 === null && Math.max(...R.ops.map((o: any) => dist(o.char.pos, T.game.player.char.pos))) < 5, 'fall in again: they come back to him', `the pair ${R.ops.map((o: any) => dist(o.char.pos, T.game.player.char.pos).toFixed(1)).join(' / ')} m from Sam`); }
  { const T = await rig(14, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, DTL = T.game.doorTools; T.secs(0.3);
    R.orderDoor(); T.secs(2);
    const owned = R.ops.every((o: any) => R.owns(o) && orderOf(T, o) === 'bangClear') && DTL.bangs === 2;
    const w = give(T, 'fallIn'); T.secs(1);
    F.verdict(owned && w === null && R.mode === 'free' && R.entry === null && T.at('drill:called-off') !== undefined && R.ops.every((o: any) => orderOf(T, o) === 'fallIn') && DTL.bangs === 3,
      'F has the pair on the menu\'s own bang and clear; a menu order on the way to the stack takes them off it, and the can comes back',
      `on it ${owned} · given ${w ?? 'yes'} · mode ${R.mode} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · bangs ${DTL.bangs}`);
    T.secs(3); const lit = R.ops.map((o: any) => !!o.flashlight?.enabled);
    F.verdict(!lit.some(Boolean), 'called off and following Sam: their weapon lights are off (light discipline — they were on from the clock\'s start before it)', `lights ${lit.join(' / ')}`);
    const again = R.orderDoor(); T.secs(40, () => T.at('kick') !== undefined);
    const offs = () => R.log.filter((l: any) => l.what === 'drill:called-off').length, n0 = offs();
    const w3 = T.at('kick') !== undefined ? give(T, 'hold') : 'no kick'; T.secs(0.5);
    F.verdict(again === 'bang' && w3 === null && R.mode === 'free' && R.entry === null && offs() === n0 + 1 && R.ops.every((o: any) => orderOf(T, o) === 'hold'),
      'F again stacks them again; with the boot going in a menu order still takes them, as it does off any door order under ?roomclear (the old drill\'s "committed" refusal is gone with the drill)',
      `F ${again} · the order: ${w3 ?? 'given'} · mode ${R.mode} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · called off ×${offs()}`);
    const third = R.orderDoor(); T.secs(40, () => !!R.result || T.at('clear') !== undefined || up(R.ops) === 0); T.secs(0.3);   // (to the room CALLED, not merely secured: the posting below is what follows the call)
    const posted = R.ops.filter((o: any) => o.state !== 'dead').every((o: any) => orderOf(T, o) === 'cover');
    if (T.at('clear') === undefined) console.log(`    (seed 14: the room was not called — ${R.summary()} — the posting check below has nothing to check)`);
    F.verdict(third === 'bang' && (T.at('clear') === undefined || (posted && R.entry === null)), 'F a third time: they go in, and the room called the men up are the menu\'s again, each covering a way in',
      `F ${third} · clear ${f1(T.since('clear'))} · orders ${R.ops.map((o: any) => `${o.state === 'dead' ? 'down' : orderOf(T, o)}`).join(' / ')} · bangs ${DTL.bangs} · '${R.summary()}'`); }
  { const T = await rig(15, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, O = T.game.orders; T.secs(0.3);   // a FIRST order to one man only
    const p = T.game.player.char.pos; const w = O.give('hold', { kind: 'none', at: [p[0], 0, p[2]] }, 0); T.secs(1);
    F.verdict(w === null && !isNaN(R.t0) && orderOf(T, R.ops[0]) === 'hold' && orderOf(T, R.ops[1]) === 'fallIn', 'the first order goes to one man: the clock starts and the OTHER falls in unasked (nobody is left at the arch)', `given ${w ?? 'yes'} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')}`); }
  { const T = await rig(13, { start: 'quiet', doorMan: 'inside', roamers: 0 }); const R = T.R; T.secs(0.3);
    const did1 = R.orderDoor(); T.secs(16);
    F.verdict(did1 === 'stack' && !!R.entry && R.entry.ops[0].op.phase === 'stack' && !isNaN(R.entry.setT) && !R.entry.gate.go && T.at('kick') === undefined && isNaN(R.t0) && R.state === 'staged', 'quiet start: the first F stacks them and they HOLD — no boot, the clock not started, nobody inside the wiser',
      `did ${did1} · on the door: ${R.entry?.ops[0].op.phase} · set ${f1(R.entry?.setT)} · t0 ${R.t0} · '${R.summary()}'`);
    const did2 = R.orderDoor(); T.secs(6, () => T.at('bang') !== undefined || T.at('nobang') !== undefined);
    F.verdict(did2 === 'go' && T.order(['order:go', 'kick', 'door-flung']) && T.at('clock:heard') !== undefined && (T.at('clock:heard') ?? 0) >= (T.at('door-flung') ?? 1e9) - 0.05, 'the second F sends them; the clock starts when the men inside hear the boot',
      R.log.slice(-10).map((l: any) => `${f1(l.t)} ${l.what}`).join(' · ')); }
  return F.done();
});

export const rescueSet = staged(['DOORMANNERS.on', 'glass', 'MOVES.gait'], async () => {
  const F = family('rescue-set: clock two — a room hit before its men are set, and after');
  const SEEDS = [11, 12, 13, 14, 15, 16];
  const run = async (setSecs: number, roamers: number, seeds: number[], more: Record<string, unknown> = {}) => { let blind = 0, secured = 0, pair = 0, caught = 0; const gap: number[] = []; const rel: (number | undefined)[] = [], ral: boolean[] = []; let bad = '', left = 0;
    for (const s of seeds) { const T = await rig(s, { setSecs, clock: false, roamers, captorSet: false, ...more }); const R = T.R; T.secs(0.3); R.orderDoor(); T.secs(40, () => R.state === 'secured' || up(R.ops) === 0);
      blind += R.blindRounds; if (T.at('secured') !== undefined) secured++; { const b = T.at('bang'), e = T.at('enter1'); if (b !== undefined && e !== undefined) gap.push(e - b); } pair += up(R.ops); bad ||= T.bad; if (T.at('caught:Captor') !== undefined) caught++;
      const l = T.at('learned:Roamer 1'), r = T.at('released:Roamer 1'); rel.push(l === undefined || r === undefined ? undefined : r - l); ral.push(T.game.fight.log.some((n: any) => n.who === 'Roamer 1' && /goes to the fight/.test(n.what)) || T.game.fight.stats.rallied > 0);
      if (T.game.fight.log.some((n: any) => n.who === 'Captor' && /goes to the fight|falls back/.test(n.what))) left++; }
    return { blind, secured, pair, caught, rel, ral, bad, left, gap }; };
  const U = await run(30, 0, SEEDS), S = await run(0.5, 0, SEEDS);   // (no roamer: the room's own men are the only difference)
  const UR = await run(30, 1, SEEDS.slice(0, 3)), SR = await run(0.5, 1, SEEDS.slice(0, 3));
  U.rel = UR.rel; S.rel = SR.rel; U.ral = UR.ral; U.bad ||= UR.bad; S.bad ||= SR.bad;
  const UN = await run(30, 0, SEEDS.slice(0, 4), { stun: false, roomLights: true }), SN = await run(0.5, 0, SEEDS.slice(0, 4), { stun: false, roomLights: true });   // (no charge and the office lights on: he gets to SEE the man coming through his door)
  U.bad ||= UN.bad; S.bad ||= SN.bad;
  // (the stun charge as it was — combat.ts FLASH off: a flashed man who was set fires blind at the door; with it on he is folded up for the count, set or not)
  FLASH.on = false; const SW = await run(0.5, 0, SEEDS); FLASH.on = FLASH_ON; S.bad ||= SW.bad;
  F.verdict(UN.caught > 0 && SN.caught === 0 && S.caught === 0, 'the late reaction (unsetReact) is for a man who sees his first of the team before he is set — never for a set one',
    `no charge, office lit: captor caught unset in ${UN.caught}/4 runs with setSecs 30, ${SN.caught}/4 with 0.5 (room secured ${UN.secured}/4 vs ${SN.secured}/4 · pair alive ${UN.pair}/8 vs ${SN.pair}/8) · with the charge: ${U.caught}/${SEEDS.length} and ${S.caught}/${SEEDS.length}`);
  F.verdict(U.blind === 0 && SW.blind > 0 && S.blind < SW.blind, 'no blind round from men caught unset; blind bursts from men who were set when the flash came are the charge AS IT WAS — the flash that folds a man up (FLASH) leaves him few or none',
    `unset (setSecs 30): ${U.blind} blind rounds over ${SEEDS.length} seeds · set (0.5): ${S.blind} · set, the charge as it was: ${SW.blind}`);
  { const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN, gu = mean(U.gap), gs = mean(S.gap), gw = mean(SW.gap);
    F.verdict(U.secured >= S.secured && U.pair >= S.pair && U.gap.length === SEEDS.length && S.gap.length > 0 && SW.gap.length > 0 && gu + 0.5 < gw && gs + 0.5 < gw && S.pair >= SW.pair,
      'the unset room falls at least as often for no more men; behind the charge as it was the team waited out a set room\'s blind burst — behind the flash that folds them it is through a set room\'s door as soon as an unset one\'s',
      `secured ${U.secured}/${SEEDS.length} unset vs ${S.secured}/${SEEDS.length} set (as it was ${SW.secured}/${SEEDS.length}) · pair alive ${U.pair}/${2 * SEEDS.length} vs ${S.pair}/${2 * SEEDS.length} (as it was ${SW.pair}/${2 * SEEDS.length}) · bang → first man in: ${f1(gu)} s unset (${U.gap.length} runs) vs ${f1(gs)} s set (${S.gap.length} runs) vs ${f1(gw)} s set with the charge as it was (${SW.gap.length} runs)`); }
  F.verdict(U.rel.every((x, i) => x === undefined || x >= 30 - 0.05 || U.ral[i]) && S.rel.some(x => x !== undefined) && S.rel.every(x => x === undefined || (x >= 0.5 - 0.05 && x < 8.5)), 'the roamer leaves his post once he is set (setSecs after he first hears it) — sooner only when the room fight sends him to the gunfire on his own ears',
    `learned → off his post: set after 30 s ${U.rel.map((x, i) => `${f1(x)}${x !== undefined && x < 29.95 ? (U.ral[i] ? ' (rallied)' : ' (?)') : ''}`).join(' · ')} · set after 0.5 s ${S.rel.map(f1).join(' ')}`);
  { const left = U.left + S.left + UR.left + SR.left + UN.left + SN.left;
    F.verdict(left + SW.left === 0, 'the captor never goes to a fight next door and never gives the room up: he is the clock', `runs where the room fight took him off his post: ${left + SW.left} of 32`); }
  F.verdict(!U.bad && !S.bad, 'no bad position in thirty-two runs', U.bad || S.bad || 'finite');
  return F.done();
});

export const rescueTally = guarded(async () => {
  const F = family('rescue-tally: the clock changes the outcome — the same assault ordered at once, late, and late with the clock off');
  const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18];
  const run = async (delay: number, knobs: Record<string, unknown> = {}) => { const o = { alive: 0, pair: 0, secured: 0, rescued: 0, lost: 0, bad: '', when: [] as string[] };
    for (const s of SEEDS) { const T = await rig(s, knobs); const R = T.R; T.secs(0.3); give(T, 'hold'); if (delay > 0) T.secs(delay); R.orderDoor(); T.secs(70, () => !!R.result);
      o.alive += up(R.hostages); o.pair += up(R.ops); if (T.at('secured') !== undefined) o.secured++; if (R.result?.state === 'rescued') o.rescued++; if (R.result?.state === 'lost') o.lost++; o.bad ||= T.bad;
      o.when.push(`${f1(T.since(/^executed:/))}/${f1(T.since('bang') ?? T.since('nobang'))}`);
      if (VERBOSE || (delay === 0 && up(R.hostages) < 2)) console.log(`      seed ${s}, order after ${delay} s: ${R.result?.state ?? R.state} — ${R.log.filter((l: any) => !/^(kickL|retreat|toss|land|squeeze|approach-done|go|in\d|centre\d|corner\d|hold\d)$/.test(l.what)).map((l: any) => `${f1(l.t - R.t0)} ${l.what}`).join(' · ')}`); }
    return o; };
  const n = SEEDS.length, line = (o: any) => `hostages alive ${o.alive}/${2 * n} · room secured ${o.secured}/${n} · rescued ${o.rescued} · lost ${o.lost} · pair alive ${o.pair}/${2 * n} · first hostage shot / bang, s after the clock: ${o.when.join(' ')}`;
  const A = await run(0), B = await run(10), C = await run(45), D = await run(45, { clock: false });   // (10 s: well inside the clock's 35 ± 6 with the entry's own dozen seconds on top — it was 20 of 40)
  console.log(`    order at once        : ${line(A)}\n    order after 10 s     : ${line(B)}\n    order after 45 s     : ${line(C)}\n    after 45 s, clock off: ${line(D)}`);
  F.verdict(A.alive >= 2 * n * 0.6, 'ordered at once: most hostages live', `${A.alive}/${2 * n} alive`);
  F.verdict(C.alive <= A.alive - n && C.alive <= 2 * n * 0.25, 'ordered 45 s late: the captor has shot them before the door goes in', `${C.alive}/${2 * n} alive (at once: ${A.alive})`);
  F.verdict(D.alive >= C.alive + n && D.alive >= 2 * n * 0.6, 'the same 45 s with the clock off: they live — it is the clock that killed them, not the wait', `${D.alive}/${2 * n} alive (clock on: ${C.alive})`);
  // (a hostage lost in an at-once run is a pair wiped by the roamer coming back with Sam a statue at the arch — printed above when it happens; the clock's own toll is what this line orders)
  F.verdict(A.alive >= C.alive && B.alive >= C.alive && Math.min(A.alive, B.alive) >= 2 * n * 0.6, 'in between (10 s): still in time — most live, as at once', `at once ${A.alive} · after 10 s ${B.alive} · after 45 s ${C.alive}`);
  F.verdict(!A.bad && !B.bad && !C.bad && !D.bad, `no bad position in ${4 * n} runs`, A.bad || B.bad || C.bad || D.bad || 'finite');
  return F.done();
});

export const rescueRestart = guarded(async () => {
  const F = family('rescue-restart: a restart stages it again; stop() puts the floor back');
  const T = await rig(9, { setSecs: 30 }, false); const { R, game: g } = T;
  const save = T.W.snapshot('before the rescue', true); const loadable = canLoad(g, save);
  const why = R.start(); T.secs(0.3); R.orderDoor(); T.secs(12);
  const old = [...R.ops, ...R.hostiles, ...R.hostages];
  g.restartEncounter(); T.step();
  const fresh = [...R.ops, ...R.hostiles, ...R.hostages];
  F.verdict(R.active && R.staged === 2 && R.state === 'staged' && isNaN(R.t0) && R.doorOrders === 0 && R.mode === 'free' && R.entry === null && fresh.every(x => !old.includes(x)) && up(R.hostages) === 2 && up(R.ops) === 2 && up(R.hostiles) === 3,
    'a restart mid-run: staged again — a fresh cast, hostages alive, the clock not started, no order standing', `'${R.summary()}' · fresh objects ${fresh.every(x => !old.includes(x))}`);
  const d = g.doors.byName('manager');
  F.verdict(d.angle === 0 && d.latched && dist(g.player.char.pos, RESCUE.samAt) < 0.3 && g.civilians.length === 2 && 1 + g.guards.length === 6, 'the door shut again, Sam back at the arch, nobody left over from the first staging', `door ${d.angle} · civilians ${g.civilians.length} · units ${g.guards.length}`);
  R.orderDoor(); T.secs(25, () => T.at('bang') !== undefined);
  F.verdict(T.at('bang') !== undefined, 'and the orders work again on the second staging', R.log.slice(-6).map((l: any) => l.what).join(' '));
  g.resetGuards(); T.step(); T.step();
  F.verdict(R.active && R.staged === 3 && R.state === 'staged' && up(R.hostages) === 2, 'the cast despawned under it (a bare guard reset): a full restart, staged again', `'${R.summary()}'`);
  const refused = canLoad(g, save);
  F.verdict(why === null && loadable === null && typeof refused === 'string' && /rescue/.test(refused), 'a checkpoint that loads fine before it is refused while it is up', `before: ${loadable} · during: ${String(refused).slice(0, 110)}`);
  R.stop(); T.secs(5);
  const d2 = g.doors.byName('manager'), sd = g.doors.byName('server_manager');
  F.verdict(!R.active && g.guards.length === T.before.guards && !g.guards.some((x: any) => x.unit) && g.civilians.length === T.before.civilians && g.civilians.map((c: any) => c.callsign).join(',') === T.before.civNames && g.civilians.every((c: any) => c.civ.state !== 'cower'),
    'stop(): the cast gone, the shift back on the list, the building\'s own civilians back at work', `guards ${g.guards.length} (was ${T.before.guards}) · civilians ${g.civilians.map((c: any) => `${c.callsign}:${c.civ.state}`).join(', ')}`);
  F.verdict(steady(T.W) === T.before.steady && Math.abs(d2.angle - T.before.door) < 0.4 && sd.locked === T.before.sideLocked && JSON.stringify({ ...g.tune, chaos: 0 }) === JSON.stringify({ ...JSON.parse(T.before.tune), chaos: 0 }) && !T.bad,
    'the light count, the doors as authored and Game.tune as before; the floor runs on', `steady ${steady(T.W)} (was ${T.before.steady}) · manager door ${d2.angle.toFixed(2)} (authored ${T.before.door}) · side door locked ${sd.locked}`);
  F.verdict(R.start() === null && R.state === 'staged' && (R.stop(), !R.active), 'and it starts and stops a second time', `'${R.summary()}'`);
  return F.done();
});
