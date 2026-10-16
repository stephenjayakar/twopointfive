// The 'startfile' family (game/startfile.ts — THE TEAM STARTS A MISSION FALLEN IN; START.fallIn, the page's ?nofallin, the stand's TPS_FALLIN=1), run through probes.ts:
//   bun run tools/qa/probes.ts startfile | startfile-off | startfile-stage | startfile-follow | startfile-f | startfile-restart
// PASS / FAIL each, all headless (the Game of headless.ts; the scenarios started as main.ts's flags start them; the switch set through the stand's own word, so
// each probe says which stand it measured whatever stand the runner is on). Sam is dark and in god mode; the night breach's and the room clear's defenders are
// kept dazzled where a probe is about feet.
//   startfile-off      the switch off (every frozen probe's stand): a staging leaves every teammate with no order — night breach (two and four), room clear (and the rescue, as on either stand)
//   startfile-stage    the switch on: on the staging's own frame every living teammate is on the menu's 'fall in' (no post, one group), and nobody SAID it — no row
//                      in the orders' log, no 'you: …' line, no bark; three seconds of Sam standing still: they are still on it, the night breach's drill still
//                      waits for F, and how far each man walked meanwhile. THE RESCUE IS NOT STAGED THIS WAY (startfile.ts): with rounds passing through glass as on
//                      the page and the roamer's room drawn (seeds 1 and 2: the conference room), seeds 1, 2 and 7: its men are held with no order, and three idle seconds start no clock and fire no round
//                      (STARTFILE_BREAK=1 = its men fallen in at the staging all the same: seeds 1 and 2 must fail, a round fired and the clock started)
//   startfile-follow   Sam walks off without a word: they come with him (night breach, four) — and on the rescue his first step starts the clock and the men fall in then
//   startfile-f        F still takes them: the night breach's drill takes its pair off the fall in (the second pair stay on it), the rescue's F sends its men as it did
//   startfile-restart  a restart (night breach four, room clear four) stages them fallen in again; stop() leaves no order behind
import { standUp, ROOT } from './headless.ts';
import { rig as rescueRig, family, guarded, dist, DT } from './rescue-probes.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { START, teamStartsFallenIn } = await import(`${ROOT}/src/game/startfile.ts`);
const { GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`);

const NB_DEFAULTS = { ...NIGHTBREACH }, RC_DEFAULTS = { ...ROOMCLEAR };
const f2 = (x: number) => x.toFixed(2);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the stand's own word for the switch, for the length of `fn` (standup.ts reads it on every stand-up) */
async function withSwitch<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
  const env = (globalThis as any).process.env, was = env.TPS_FALLIN; env.TPS_FALLIN = on ? '1' : '0';
  try { return await fn(); } finally { if (was === undefined) delete env.TPS_FALLIN; else env.TPS_FALLIN = was; }
}
type Kind = 'nb2' | 'nb4' | 'rc4' | 'rescue';
const KINDS: Kind[] = ['nb2', 'nb4', 'rc4', 'rescue'];
const LABEL: Record<Kind, string> = { nb2: 'night breach, pair', nb4: 'night breach, four', rc4: 'room clear, four', rescue: 'rescue' };

/** One scenario staged under a seed with the switch as asked: the men, the words said at staging, a stepper that keeps Sam dark (and the defenders blind if `quiet`). */
async function stage(kind: Kind, on: boolean, seed = 7, quiet = true, glass = false) {
  return withSwitch(on, async () => {
    Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ROOMCLEAR, RC_DEFAULTS);
    const said: string[] = [];
    if (kind === 'rescue') {
      // (glass: the roamer's room is drawn as on the page — seeds 1 and 2 deal him the conference room — and rounds pass through panes as on the page. The switch is
      //  set by hand after the stand-up: glass.ts reads GLASSFX once, when the module loads, so the env word set here would come too late; the runner puts the table back)
      const T: any = await rescueRig(seed, glass ? { seedRoamers: true } : {}, false); const g = T.game; g.godMode = true; if (glass) GLASSPEN.on = true;
      { const msg = g.msg.bind(g); g.msg = (t: string) => { said.push(t); msg(t); }; }
      const log0 = g.orders.log.length; const why = g.rescue.start();
      return { g, W: T.W, S: g.rescue as any, ops: g.rescue.ops as any[], hostiles: g.rescue.hostiles as any[], said, log0, why, sw: START.fallIn as boolean,
        step(n = 1) { T.step(n); }, drill: null as any };
    }
    NIGHTBREACH.squad = kind === 'nb2' ? 2 : 4;
    Math.random = seeded(seed);
    const log = console.log; console.log = () => { }; let W: any; try { W = await standUp(); } finally { console.log = log; }
    const g = W.game; g.godMode = true;
    { const msg = g.msg.bind(g); g.msg = (t: string) => { said.push(t); msg(t); }; }
    const log0 = g.orders.log.length; const why = kind === 'rc4' ? g.roomClear.start(seed) : g.nightBreach.start();
    const NB = g.nightBreach;
    return { g, W, S: NB as any, ops: NB.ops as any[], hostiles: NB.hostiles as any[], said, log0, why, sw: START.fallIn as boolean,
      step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; if (quiet) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = g.time + 5; W.step(DT); } },
      get drill(): any { return NB.drill; } };
  });
}
const orderOf = (R: any, m: any): string => R.g.orders.of(m)?.order ?? 'none';
const orders = (R: any): string => R.ops.map((m: any) => `${m.callsign}=${orderOf(R, m)}`).join(' ');
const spoke = (R: any): string[] => R.said.filter((t: string) => /^you:/.test(t));
const barks = (R: any): string[] => R.ops.filter((m: any) => m.bubble).map((m: any) => `${m.callsign}: ${m.bubble.text}`);

export const startfileOff = guarded(async () => {
  const F = family('startfile-off: the switch off — a staging leaves the team with no order, as it did');
  for (const k of KINDS) {
    const R = await stage(k, false);
    const at0 = orders(R); R.step(120);
    F.verdict(R.why === null && !R.sw && R.ops.length > 0 && R.ops.every((m: any) => !R.g.orders.has(m)) && R.g.orders.log.length === R.log0,
      `${LABEL[k]}: nobody has an order at the staging or two seconds on`, `start ${R.why ?? 'ok'} · switch ${R.sw} · at staging ${at0} · after 2 s ${orders(R)} · log rows ${R.g.orders.log.length - R.log0}`);
  }
  return F.done();
});

export const startfileStage = guarded(async () => {
  const F = family('startfile-stage: the switch on — every teammate is on the menu\'s fall in from the staging\'s own frame, and nobody said it');
  for (const seed of [1, 2, 7]) {   // the rescue keeps its own start (startfile.ts): held until its clock starts — seeds 1 and 2 deal a roamer to the conference room, in sight through its glazing
    const R = await stage('rescue', true, seed, false, true); const O = R.g.orders, men = R.ops;
    const BREAK = (globalThis as any).process.env.STARTFILE_BREAK === '1'; if (BREAK) teamStartsFallenIn(R.g, men);   // (the red path: the rescue's men fallen in at its staging — seeds 1 and 2 must fail)
    const at0 = orders(R);
    const shots: string[] = []; for (let i = 0; i < 180; i++) { R.step(); for (const e of R.g.events) if ((e.kind === 'guardShot' || e.kind === 'shot') && !shots.includes(`${e.kind}:${e.who}`)) shots.push(`${e.kind}:${e.who}`); }
    if (BREAK && seed !== 7) F.verdict(shots.length > 0 && !isNaN(R.S.t0), `rescue, seed ${seed} (the red path's own check): fallen in at the staging, a man shoots through the glass and the clock starts — the fault this probe is for is really staged`, `shots ${JSON.stringify(shots)} · t0 ${R.S.t0}`);
    F.verdict(R.why === null && R.sw && men.length >= 2 && men.every((m: any) => !O.has(m) && m.hold && m.pinned) && isNaN(R.S.t0) && R.S.step === 'waiting' && shots.length === 0 && O.log.length === R.log0,
      `rescue, seed ${seed}: NOT staged fallen in — the men are held with no order, and three seconds of Sam standing still start no clock and fire no round`,
      `at staging ${at0} · after 3 s ${orders(R)} · held ${men.map((m: any) => `${m.hold && m.pinned}`).join('/')} · t0 ${R.S.t0} · step ${R.S.step} · shots ${JSON.stringify(shots)}`);
  }
  for (const k of KINDS.filter(k => k !== 'rescue')) {
    const R = await stage(k, true); const O = R.g.orders, men = R.ops;
    const as = men.map((m: any) => O.of(m)), groups = new Set(as.map((a: any) => a?.group));
    F.verdict(R.why === null && R.sw && men.length === (k === 'nb2' ? 2 : 4) && as.every((a: any) => a && a.order === 'fallIn' && a.post === null) && groups.size === 1
      && men.every((m: any) => !m.hold && !m.pinned),
      `${LABEL[k]}: all ${men.length} on 'fall in', no post, one group, nobody held`, `${orders(R)} · follow ranks ${as.map((a: any) => a?.follow).join('/')} · status ${men.map((m: any) => O.statusOf(m)).join(' / ')}`);
    F.verdict(O.log.length === R.log0 && spoke(R).length === 0 && barks(R).length === 0, `${LABEL[k]}: unspoken — no log row, no 'you:' line, no bark`,
      `log rows ${O.log.length - R.log0} · you-lines ${JSON.stringify(spoke(R))} · barks ${JSON.stringify(barks(R))}`);
    const from = men.map((m: any) => [...m.char.pos]), sam0 = [...R.g.player.char.pos];
    R.step(180);
    const moved = men.map((m: any, i: number) => dist(m.char.pos, from[i])), toSam = men.map((m: any) => dist(m.char.pos, R.g.player.char.pos));
    const waits = !R.drill || R.drill.phase === 'wait';
    F.verdict(men.every((m: any) => orderOf(R, m) === 'fallIn') && waits && O.log.length === R.log0 && spoke(R).length === 0 && dist(R.g.player.char.pos, sam0) < 0.01 && toSam.every((d: number) => d < 7) && men.every((m: any) => m.state !== 'dead'),
      `${LABEL[k]}: three seconds of Sam standing still — still on it, the drill still waits for F`,
      `${orders(R)} · walked ${moved.map(f2).join(' / ')} m · now ${toSam.map(f2).join(' / ')} m from Sam · status ${men.map((m: any) => O.statusOf(m)).join(' / ')}${` · drill ${R.drill?.phase ?? 'none'}`}`);
  }
  return F.done();
});

/** walk Sam along the nav path to `to` at a walking pace, one teleport a frame (no key: nothing of his is 'an order') */
function walk(R: any, to: number[], speed = 1.6): number {
  const g = R.g, p = g.player.char.pos, path: number[][] = [[p[0], 0, p[2]], ...(g.col.nav.findPath([p[0], 0, p[2]], to) ?? []).map((q: number[]) => [q[0], 0, q[2]]), to];
  let walked = 0;
  for (let s = 0; s < path.length - 1; s++) { const a = path[s], b = path[s + 1], L = dist(a, b), n = Math.max(1, Math.ceil(L / (speed * DT)));
    for (let i = 1; i <= n; i++) { g.teleportPlayer([a[0] + (b[0] - a[0]) * i / n, 0, a[2] + (b[2] - a[2]) * i / n]); R.step(); } walked += L; }
  return walked;
}

export const startfileFollow = guarded(async () => {
  const F = family('startfile-follow: Sam walks off without a word and the team comes with him');
  {
    const R = await stage('nb4', true); const O = R.g.orders, men = R.ops, sam = R.g.player.char;
    R.step(30); const from = [...sam.pos];
    const walked = walk(R, [21, 0, 17.6]); R.step(60 * 4);
    const end = men.map((m: any) => dist(m.char.pos, sam.pos));
    F.verdict(walked > 6 && dist(sam.pos, from) > 6 && end.every((d: number) => d > 0.5 && d < 6) && men.every((m: any) => orderOf(R, m) === 'fallIn') && O.log.length === R.log0 && spoke(R).length === 0,
      'night breach, four: off down the aisle, no key pressed — all four end with him', `Sam walked ${f2(walked)} m · the men end ${end.map(f2).join(' / ')} m from him · ${men.map((m: any) => O.statusOf(m)).join(' / ')} · log rows ${O.log.length - R.log0}`);
  }
  {
    const R = await stage('rescue', true, 7, false); const O = R.g.orders, men = R.ops, sam = R.g.player.char, S = R.S;
    R.step(30); const before = isNaN(S.t0), from = [...sam.pos];
    walk(R, [from[0] + 1.2, 0, from[2]]); R.step(30);
    F.verdict(before && !isNaN(S.t0) && men.every((m: any) => orderOf(R, m) === 'fallIn'),
      'rescue (hot start): his first step starts the clock and the men fall in by themselves (rescue.ts startClock, as it always did): no X, 3 there either',
      `clock before ${before ? 'not started' : 'running'} · after ${isNaN(S.t0) ? 'not started' : 'running'} · ${orders(R)} · log rows ${O.log.length - R.log0} · you-lines ${JSON.stringify(spoke(R))}`);
  }
  return F.done();
});

export const startfileF = guarded(async () => {
  const F = family('startfile-f: F still takes them off the fall in');
  {
    const R = await stage('nb4', true); const O = R.g.orders, men = R.ops;
    R.step(60); R.W.input.pressed.add('KeyF'); R.step(); R.step(30);
    const pair = R.S.drillOps as any[], rest = men.filter((m: any) => !pair.includes(m));
    F.verdict(!!R.drill && R.drill.phase !== 'wait' && pair.length === 2 && pair.every((m: any) => !O.has(m)) && rest.length === 2 && rest.every((m: any) => orderOf(R, m) === 'fallIn'),
      'night breach, four: F starts the drill — its pair are the drill\'s, the second pair stay fallen in', `drill ${R.drill?.phase} · ${orders(R)}`);
  }
  {
    const R = await stage('nb2', true); const O = R.g.orders;
    R.step(60); R.W.input.pressed.add('KeyF'); R.step(); R.step(30);
    F.verdict(!!R.drill && R.drill.phase !== 'wait' && R.ops.every((m: any) => !O.has(m)), 'night breach, pair: F starts the drill and both men are the drill\'s', `drill ${R.drill?.phase} · ${orders(R)}`);
  }
  {
    const R = await stage('rescue', true, 7, false); const S = R.S;
    R.step(30); R.W.input.pressed.add('KeyF'); R.step();
    const did = R.said.filter((t: string) => /^you:/.test(t)); R.step(30);
    F.verdict(!isNaN(S.t0) && !!S.entry && did.length === 1 && /hostage room/.test(did[0]), 'rescue: F sends the men to the hostage room, as it did',
      `'${did.join(' | ')}' · entry ${S.entry ? `${S.entry.men?.length ?? '?'} men` : 'none'} · ${orders(R)}`);
  }
  return F.done();
});

export const startfileRestart = guarded(async () => {
  const F = family('startfile-restart: a restart stages them fallen in again; stop() leaves no order behind');
  for (const k of ['nb4', 'rc4'] as Kind[]) {
    const R = await stage(k, true, 7, true); const g = R.g, O = g.orders;
    R.step(60); const first = [...(k === 'rescue' ? g.rescue.ops : g.nightBreach.ops)];
    await withSwitch(true, async () => { START.fallIn = true; g.restartEncounter(); });
    const men: any[] = k === 'rescue' ? g.rescue.ops : g.nightBreach.ops;
    const fresh = men.every((m: any) => !first.includes(m)), on = men.length > 0 && men.every((m: any) => O.of(m)?.order === 'fallIn' && O.of(m)?.post === null);
    const row = men.map((m: any) => `${m.callsign}=${O.of(m)?.order ?? 'none'}`).join(' ');
    for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); }
    const still = men.every((m: any) => O.of(m)?.order === 'fallIn');
    (k === 'rescue' ? g.rescue : g.nightBreach).stop();
    for (let i = 0; i < 5; i++) R.W.step(DT);
    const left = [...first, ...men].filter((x: any) => O.has(x)).length;   // (the men of both casts: the floor's own guards never had an order to lose)
    F.verdict(fresh && on && still && spoke(R).length === 0 && left === 0, `${LABEL[k]}: restaged with a fresh cast, fallen in, unspoken; after stop() no man of either cast still has an order`,
      `fresh cast ${fresh} · on the restart's frame ${row} · a second on ${still ? 'the same' : 'changed'} · after stop: orders held ${left}`);
  }
  START.fallIn = false;
  return F.done();
});
