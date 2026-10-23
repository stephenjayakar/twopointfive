// THE SQUAD REACHES YOU, AND THE QUICK KEY SAYS WHY (src/game/squadnet.ts — SQUADNET.on · .why · .clear), headless:
//   bun run tools/qa/squadnet-check.ts [why|clear|net|off]      (probes.ts squadnet; SQUADNET_BREAK=1 = the three switches left off: must fail)
//   why    the room clear on the office with its squad of four, stacked on a door whose far room nobody has stood in: the quick key's row ends on the reason
//          (a room nobody has been in · the last stun kept back · an enemy in sight inside), says nothing more of a plain open (a silent squad), and the man
//          who answers the press says the reason in place of the row's own answer.
//   clear  the lead's call at an entry's end: 'clear' only of a room whose search saw all of its floor and that nobody stands in; 'quiet' of floor unseen
//          with nobody in sight; nothing with an enemy in sight. Then the entry itself: what the lead said is what its search found.
//   net    a teammate's line said with his head off the screen clicks (a defender's does not, a teammate's on the screen does not); a teammate going down is
//          a row of its own for its time, with the lower click, once; a man already down when the run starts is not called. The run with the rule on is the
//          run with it off, by digest: it is the page's alone.
//   off    the switches off = the lines as they were; the registry, a recording from before the keys, the frozen stand's rows.
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the three switches and the autopilot itself. Where a far line is DRAWN (ui/bubbles.ts)
// is not looked at here: no picture is.
import { standUp, ROOT } from './headless.ts';

const SN: any = await import(`${ROOT}/src/game/squadnet.ts`);
const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const SIL: any = await import(`${ROOT}/src/game/silent.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobRegistry, JOURNAL_KNOBS } = await import(`${ROOT}/src/game/knobs.ts`);
const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const { SQUADNET, whyWords, roomCall } = SN;
const { AUTOPILOT, autoPick, autoEntries, autoWhy } = AP;
/** the three switches as this stand stood them when the harness loaded (the shipped stand's boot has run by now; nothing here has written them yet) */
const STOOD = [SQUADNET.on, SQUADNET.why, SQUADNET.clear];

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const DT = 1 / 60, BREAK = process.env.SQUADNET_BREAK === '1';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the tables this file writes, put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const was = { sn: { ...SQUADNET }, ap: { ...AUTOPILOT }, sil: SIL.SILENT.on, squad: NIGHTBREACH.squad, rnd: Math.random };
  try { return await fn(); } finally { Object.assign(SQUADNET, was.sn); Object.assign(AUTOPILOT, was.ap); SIL.SILENT.on = was.sil; NIGHTBREACH.squad = was.squad; Math.random = was.rnd; }
}
/** the three switches as a line asks for them (all left off under SQUADNET_BREAK) */
const raise = (on = true, why = true, clear = true) => { SQUADNET.on = on && !BREAK; SQUADNET.why = why && !BREAK; SQUADNET.clear = clear && !BREAK; };

/** the room clear on the office with a squad of four under god mode, the autopilot on (autopilot-check's own staging); `play`: every call the mixer was asked for */
async function rig(seed: number) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try { NIGHTBREACH.squad = 4; Math.random = seeded(seed); W = await standUp(); AUTOPILOT.on = true; W.game.godMode = true; why = W.game.roomClear.start(seed); } finally { NIGHTBREACH.squad = squad0; }
  const game = W.game, O = game.orders, input = W.input, play: { name: string; gain: number; rate: number | undefined }[] = [];
  { const a = game.audio, p0 = a.play.bind(a); a.play = (name: string, pos: unknown, gain = 1, opts: any = {}) => { play.push({ name, gain, rate: opts?.rate }); return p0(name, pos, gain, opts); }; }
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const R = { W, game, O, why, play, said,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** the quick key's line on the HUD with the cursor on p */
    hudQ(p: number[]): string { W.cursorAt([p[0], p[1], p[2]]); R.step(2); const key = String(ORDERS.quickKey).replace(/^Key/, ''); return (O.hud().status?.[0]?.opts ?? []).find((o: any) => o.key === key)?.text ?? ''; },
    stacked() { return R.team.filter((m: any) => m.state !== 'dead').every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
/** a point of that door's doorway the cursor on which IS that door (null: none) */
function aimOf(R: any, d: any): number[] | null {
  const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; R.W.cursorAt(p); R.step(2); const h = R.O.hover?.(); if (h?.kind === 'door' && h.door === d) return p; }
  return null;
}
const farRoom = (g: any, t: any) => g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1);
/** the squad stacked on the nearest door whose far room nobody has stood in and that the cursor can be put on (`named`: and whose far room is one of the
 *  room clear's own, the rooms a lead calls by name; `first`: run once the game stands, before anything is said) */
async function stackedOn(seed: number, named = false, first?: () => void): Promise<{ R: any; D: any; t: any; at: number[]; set: boolean } | { R: any; why: string }> {
  const R: any = await hushed(() => rig(seed)); if (R.why) return { R, why: String(R.why) }; first?.();
  const g = R.game, O = R.O, all = O.men('all'), stackDef = O.defs.find((d: any) => d.id === 'stack'), s = g.player.char.pos;
  for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) {
    const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue;
    const far = farRoom(g, t); if (!far || g.cleared.isKnown(far) || O.whyNot(stackDef, O.forMen(t, all), all)) continue;
    if (named) { const c = d.frameCentre, th = d.def.closedDir, k = -t.side * 1.5, p = [c[0] - Math.sin(th) * k, 0, c[2] + Math.cos(th) * k]; if (!g.roomClear.rooms.some((r: any) => r.def.id === g.roomClear.roomAt(p))) continue; }
    const at = aimOf(R, d); if (!at) continue;
    R.W.input.pressed.add(ORDERS.quickKey); R.step();
    return { R, D: d, t, at, set: R.until(() => R.stacked(), 40) };
  }
  return { R, why: 'no door to stack on with an unknown room behind it' };
}

export async function squadnetWhy(): Promise<boolean> {
  const F = family('squadnet-why: the quick key\'s row ends on the reason, and the man who answers says it'); F.verdict(true, 'stand', `${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'}${BREAK ? ' · SQUADNET_BREAK: the switches are left off — the lines must fail' : ''}`);
  await kept(async () => {
    const S: any = await stackedOn(5, true); if (S.why) { F.verdict(false, 'the squad stacks on a door with an unknown room behind it', S.why); return; }
    const { R, D, at } = S, g = R.game, O = R.O, T = g.doorTools; raise();
    const tm = { ...S.t, side: O.of(R.team[0])?.post ? sideOf(D, O.of(R.team[0]).post) : S.t.side }, far = farRoom(g, tm), b0 = T.bangs;
    const tail = (x: string) => x.split(' · ').pop() ?? '';
    // 1. a room nobody has been in, stuns to spare / the last one kept / none carried
    T.bangs = 3; const three = R.hudQ(at), p3 = autoPick(g, O.targetAt(at), false);
    T.bangs = 1; const one = R.hudQ(at), p1 = autoPick(g, O.targetAt(at), false);
    T.bangs = 0; const none = R.hudQ(at);
    F.verdict(S.set && /bang and clear/.test(three) && tail(three) === "nobody's been in there" && whyWords(p3)?.row === "nobody's been in there" && /and clear/.test(one) && !/bang and/.test(one) && tail(one) === 'saving the last bang' && p1.kept === true && !/nobody|saving/.test(none),
      'a room nobody has been in: the row says so; with one stun left it says the last is kept; with none it says nothing more', `stacked ${S.set} · 3 stuns: "${three}" · 1 stun: "${one}" · none: "${none}"`);
    // 2. an enemy the team has in sight inside (a staged sight, as autopilot-check stages it)
    { const foe = g.guards.find((o: any) => o.state !== 'dead' && o.team !== 'operative' && o.team !== 'civilian' && o.team !== 'player'); let seen = '', inRoom = false, why = '';
      if (foe) { const Fg = g.fogOfWar, seen0 = Fg.seen, was = [...foe.char.pos], on0 = Fg.on, c = D.frameCentre, th = D.def.closedDir, k = -tm.side * 1.5;
        foe.char.pos[0] = c[0] - Math.sin(th) * k; foe.char.pos[2] = c[2] + Math.cos(th) * k; inRoom = g.cleared.roomAt(foe.char.pos) === far; Fg.on = true; Fg.seen = (o: any) => o === foe || seen0.call(Fg, o);
        T.bangs = 1; seen = R.hudQ(at); why = autoEntries(g, tm).why;
        Fg.seen = seen0; Fg.on = on0; foe.char.pos[0] = was[0]; foe.char.pos[1] = was[1]; foe.char.pos[2] = was[2]; }
      F.verdict(!!foe && inRoom && why === 'contact' && /bang and clear/.test(seen) && tail(seen) === 'they see one inside', 'an enemy in sight inside: the last stun goes, and the row says they see one', `staged ${!!foe}${inRoom ? '' : ' (NOT in the room)'} · why ${why} · "${seen}"`); }
    // 3. a plain open says nothing more: a silent squad
    { T.bangs = 3; SIL.SILENT.on = true; SIL.setSilent(g, true); R.step(2); const silent = SIL.squadSilent(g), quiet = R.hudQ(at), w = autoWhy(g, O.targetAt(at)); SIL.setSilent(g, false); R.step(2);
      F.verdict(silent && !/nobody|saving|they see/.test(quiet) && w === null, 'a plain open says nothing more (a silent squad opens it quietly)', `silent ${silent} · "${quiet}" · reason ${w}`); }
    // 4. the press: the man who answers says the reason
    { T.bangs = b0 > 1 ? b0 : 3; const RC = g.roomClear; let emptied = 0; for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile' && g.cleared.roomAt(x.char.pos) === far) { x.state = 'dead'; emptied++; }   // (the room beyond is emptied, so that the call at the entry's end is the search's alone)
      const want = autoPick(g, O.targetAt(at)), n0 = R.said.length, w0 = g.squadNet.stats.whys; aimOf(R, D); R.W.input.pressed.add(ORDERS.quickKey); R.step(); R.step(2);
      const row = O.log[O.log.length - 1], ans = R.said.slice(n0).find((x: string) => /banging it/.test(x)) ?? R.team.map((m: any) => m.bubble?.text).find((x: any) => /banging it/.test(x ?? '')) ?? '';
      F.verdict(want.id === 'bangClear' && row?.order === 'bangClear' && /banging it\. nobody's been in there\./.test(ans) && g.squadNet.stats.whys === w0 + 1, 'the press: they go in with a stun and the man who answers says why', `pick ${want.id} (${want.why}) · order ${row?.order} · answer "${ans}" · reasons given ${g.squadNet.stats.whys - w0}`);
      // 5. the entry's end: what the lead calls is what the search found
      raise(); const n1 = R.said.length; R.until(() => T.ops.length === 0, 60); R.step(30);
      const op = T.done[T.done.length - 1], left = op?.search ? op.search.left : NaN, calls = R.said.slice(n1).filter((x: string) => / clear\.$|'s quiet\. /.test(x));
      const ok = calls.every((x: string) => / clear\.$/.test(x) ? left === 0 : left > 0), room = RC.rooms.find((r: any) => r.def.id === RC.roomAt(R.team.find((m: any) => m.state !== 'dead').char.pos));
      F.verdict(!!op && calls.length === 1 && ok && g.squadNet.stats.clears + g.squadNet.stats.quiets === 1, 'the entry\'s end: \'clear\' only with all of the floor seen, \'quiet\' with floor unseen', `${emptied} defenders taken out of the room beyond first · they stand in ${room?.def.name ?? 'no named room'} · floor unseen ${left} of ${op?.search?.pts.length ?? '—'} · called ${JSON.stringify(calls)} · clear ${g.squadNet.stats.clears} · quiet ${g.squadNet.stats.quiets}`); }
    T.bangs = b0;
  });
  return F.done();
}

export async function squadnetClear(): Promise<boolean> {
  const F = family('squadnet-clear: \'clear\' means clear');
  await kept(async () => {
    const R: any = await hushed(() => rig(7)), g = R.game; raise();
    const a = roomCall(g, 'mess', 0, false, false), b = roomCall(g, 'mess', 3, false, false), c = roomCall(g, 'mess', 3, true, false), d = roomCall(g, 'mess', 3, true, true), e = roomCall(g, 'mess', 0, true, true), f = roomCall(g, 'mess', 0, true, false);
    F.verdict(a === 'mess clear.' && b === "mess's quiet. we didn't see all of it." && c === b && d === null && e === null && f === null,
      'all of the floor seen and nobody in it: clear · floor unseen and nobody in sight: quiet · an enemy in sight, or one standing on floor they saw: nothing', `seen all, empty: ${a} · 3 unseen, empty: ${b} · 3 unseen, one inside unseen: ${c} · 3 unseen, one in sight: ${d} · seen all, one in sight: ${e} · seen all, one inside: ${f}`);
    F.verdict(g.squadNet.stats.clears === 1 && g.squadNet.stats.quiets === 2, 'the calls are counted', `clear ${g.squadNet.stats.clears} · quiet ${g.squadNet.stats.quiets}`);
  });
  return F.done();
}

export async function squadnetNet(): Promise<boolean> {
  const F = family('squadnet-net: a teammate\'s line from off the screen clicks, and a teammate down is called');
  await kept(async () => {
    const R: any = await hushed(() => rig(7)), g = R.game, N = g.squadNet; raise(); R.step(5);
    const mate = R.team[0], foe = g.guards.find((o: any) => o.state !== 'dead' && o.team === 'hostile');
    // (the harness has no camera of its own: a view is staged over Sam by hand — every head within a couple of metres is on it, nothing else is)
    const vp0 = g.viewProj, pl = g.player.char.pos;
    const view = (on: boolean) => { g.viewProj = on ? [0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, -0.5 * pl[0], -0.5 * pl[2], 0, 1] : vp0; };
    const clicks = () => R.play.filter((p: any) => p.name === 'radio' && p.rate === undefined && Math.abs(p.gain - SQUADNET.click) < 1e-6).length;
    const was = [...mate.char.pos], head0 = mate.char.bones.head ? [...mate.char.bones.head] : null;
    const put = (p: number[]) => { mate.char.pos[0] = p[0]; mate.char.pos[2] = p[2]; if (mate.char.bones.head) { mate.char.bones.head[0] = p[0]; mate.char.bones.head[2] = p[2]; } };
    view(true);
    // 1. his head off the screen: the line clicks, once a frame
    put([pl[0] + 30, 0, pl[2]]); const l0 = N.stats.lines, c0 = clicks(); g.say(mate, 'stacked up.'); g.say(mate, 'moving.'); const due = N.stats.lines - l0; N.tick(); const far = clicks() - c0;
    // 2. on the screen: nothing
    put([pl[0] + 0.5, 0, pl[2] + 0.5]); const l1 = N.stats.lines, c1 = clicks(); g.say(mate, 'on it.'); N.tick(); const nearL = N.stats.lines - l1, nearC = clicks() - c1;
    // 3. a defender off the screen: nothing
    let foeL = -1, foeC = -1; if (foe) { const fw = [...foe.char.pos]; foe.char.pos[0] = pl[0] + 30; if (foe.char.bones.head) foe.char.bones.head[0] = pl[0] + 30; const l2 = N.stats.lines, c2 = clicks(); g.say(foe, 'who\'s there?', false, true); N.tick(); foeL = N.stats.lines - l2; foeC = clicks() - c2; foe.char.pos[0] = fw[0]; }
    put(was); if (head0 && mate.char.bones.head) { mate.char.bones.head[0] = head0[0]; mate.char.bones.head[2] = head0[2]; } view(false);
    F.verdict(due === 2 && far === 1 && nearL === 0 && nearC === 0 && foeL === 0 && foeC === 0, 'a teammate\'s line with his head off the screen clicks once; one on the screen and a defender\'s do not',
      `off the screen: ${due} lines, ${far} click · on it: ${nearL} lines, ${nearC} clicks · a defender off it: ${foeL} lines, ${foeC} clicks`);
    // 4. a teammate goes down: a row of its own for its time, the lower click, once
    const m2 = R.team[1], d0 = R.play.length; m2.god = false; m2.state = 'dead'; R.step();
    const row = N.rows[0], low = R.play.slice(d0).filter((p: any) => p.name === 'radio' && p.rate === SQUADNET.downRate && Math.abs(p.gain - SQUADNET.downGain) < 1e-6).length;
    R.step(60); const again = N.stats.downs, rows1 = N.rows.length; R.step(Math.round((SQUADNET.downSecs + 0.2) * 60) - 60); const gone = N.rows.length;
    F.verdict(row?.text === `${m2.callsign} is down.` && row?.who === m2.callsign && dist(row.at, m2.char.pos) < 0.01 && low === 1 && again === 1 && rows1 === 1 && gone === 0, 'a teammate down: his row from where he fell, the lower click, once, gone after its time',
      `row "${row?.text ?? 'none'}" · lower clicks ${low} · called ${again} · rows a second on ${rows1}, after ${SQUADNET.downSecs} s ${gone}`);
    // 5. a run that starts with a man already down does not call him
    N.reset(); R.step(3); F.verdict(N.rows.length === 0 && N.stats.downs === 0, 'a man already down when the run starts is not called', `rows ${N.rows.length} · called ${N.stats.downs}`);
  });
  // 6. the page's alone: the run with the rule on is the run with it off, by digest
  await kept(async () => {
    const run = async (on: boolean) => { const S: any = await stackedOn(5, false, () => { SQUADNET.on = on; SQUADNET.why = SQUADNET.clear = false; }), R = S.R; const g = R.game; R.step(120); const m = R.team[3]; m.god = false; m.state = 'dead'; R.step(120); return { h: hashDigest(digestGame(g, true)) as string, lines: g.squadNet.stats.lines, downs: g.squadNet.stats.downs }; };
    const off = await run(false), on = await run(!BREAK);
    F.verdict(off.h === on.h && on.downs === 1 && on.lines > 0 && off.downs === 0 && off.lines === 0, 'far lines and a man down are the page\'s alone: the run with the rule on is the run with it off, by digest', `off ${off.h} (lines ${off.lines}, down ${off.downs}) · on ${on.h} (lines ${on.lines}, down ${on.downs})`);
  });
  return F.done();
}

export async function squadnetOff(): Promise<boolean> {
  const F = family('squadnet-off: the switches off = the lines as they were; the registry, an old recording, the frozen stand');
  await kept(async () => {
    const S: any = await stackedOn(5); if (S.why) { F.verdict(false, 'the squad stacks on a door with an unknown room behind it', S.why); return; }
    const { R, D, at } = S, g = R.game, O = R.O, T = g.doorTools; SQUADNET.on = SQUADNET.why = SQUADNET.clear = false; T.bangs = 3;
    const row = R.hudQ(at), n0 = R.said.length; aimOf(R, D); R.W.input.pressed.add(ORDERS.quickKey); R.step(); R.step(2);
    const ans = R.said.slice(n0).join(' | '), def = O.defs.find((d: any) => d.id === 'bangClear'), own = (def.ackNow ?? def.ack).concat(def.ack).some((a: string) => ans.includes(a)) || R.team.some((m: any) => (def.ackNow ?? def.ack).concat(def.ack).includes(m.bubble?.text));
    F.verdict(/bang and clear/.test(row) && !/nobody|saving|they see/.test(row) && !/banging it\. nobody/.test(ans) && own && g.squadNet.stats.whys === 0, 'why off: the row and the answer are the row\'s own', `"${row}" · answered by the row's own line ${own}`);
    const a = roomCall(g, 'mess', 3, false, false), b = roomCall(g, 'mess', 0, true, true);
    F.verdict(a === 'mess clear.' && b === null && g.squadNet.stats.quiets === 0, 'clear off: a room nobody stands in is called clear whatever the search saw, as it was', `3 unseen, empty: ${a} · one inside: ${b}`);
    const mate = R.team[0], l0 = g.squadNet.stats.lines; g.viewProj = null; g.say(mate, 'moving.'); const m2 = R.team[1]; m2.god = false; m2.state = 'dead'; R.step(2);
    F.verdict(g.squadNet.stats.lines === l0 && g.squadNet.rows.length === 0 && g.squadNet.stats.downs === 0 && !R.play.some((p: any) => p.name === 'radio' && p.rate === SQUADNET.downRate), 'net off: no line is counted, no man down is called, no lower click', `lines ${g.squadNet.stats.lines - l0} · rows ${g.squadNet.rows.length}`);
    // the wiring: the registry, a recording from before the keys, the frozen stand's rows
    SQUADNET.on = SQUADNET.why = SQUADNET.clear = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), rides = snap.tables?.SQUADNET?.on === true && snap.tables.SQUADNET.why === true && snap.tables.SQUADNET.clear === true; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.SQUADNET;
    const both = await hushed(() => { applyKnobs(g, old); const off = !SQUADNET.on && !SQUADNET.why && !SQUADNET.clear; applyKnobs(g, snap); return [off, SQUADNET.on && SQUADNET.why && SQUADNET.clear]; });
    F.verdict(rides && both[0] && both[1], 'a recording carries the three switches; one from before the keys replays with all three off', `rides ${rides} · old file: off ${both[0]} · its own: on ${both[1]}`);
    const reg = knobRegistry() as Record<string, unknown>, H = FROZEN_HOLDS as Record<string, string>;
    F.verdict(reg.SQUADNET === SQUADNET && (JOURNAL_KNOBS as string[]).includes('SQUADNET') && H['SQUADNET.on'] === 'TPS_SQUADNET=1' && H['SQUADNET.why'] === 'TPS_QWHY=1' && H['SQUADNET.clear'] === 'TPS_HONESTCLEAR=1',
      'the table is in the knob registry; the frozen stand holds the three off under their words', `registry ${reg.SQUADNET === SQUADNET} · journal ${(JOURNAL_KNOBS as string[]).includes('SQUADNET')} · holds ${H['SQUADNET.on']} · ${H['SQUADNET.why']} · ${H['SQUADNET.clear']}`);
  });
  // the stand as it was stood up: off on the frozen stand, on on the shipped one (unless a word was given)
  await kept(async () => {
    const shipped = process.env.TPS_PROFILE === 'shipped', given = ['TPS_SQUADNET', 'TPS_QWHY', 'TPS_HONESTCLEAR'].some(k => process.env[k] !== undefined);
    // (the shipped stand: the page's own boot wrote them as the harness loaded. The frozen one: every game stood up pins them off, whatever they were)
    Object.assign(SQUADNET, { on: true, why: true, clear: true }); await hushed(() => standUp()); const got = shipped ? STOOD : [SQUADNET.on, SQUADNET.why, SQUADNET.clear], kept2 = shipped ? SQUADNET.on && SQUADNET.why && SQUADNET.clear : true;
    F.verdict(given || (got.every(x => x === shipped) && kept2), `this stand (${shipped ? 'shipped' : 'frozen'}) stands the three ${shipped ? 'on, and a game stood up leaves them on' : 'off: a game stood up pins them off'}`, `on ${got[0]} · why ${got[1]} · clear ${got[2]}${given ? ' (a word was given in the environment: not held)' : ''}`);
  });
  if (BREAK) { F.verdict(false, 'SQUADNET_BREAK', 'the break path: this family holds with the switches off, so it is failed by hand'); }
  return F.done();
}

if (import.meta.main) {
  const which = process.argv[2] ?? 'all', runs: [string, () => Promise<boolean>][] = [['why', squadnetWhy], ['clear', squadnetClear], ['net', squadnetNet], ['off', squadnetOff]];
  let ok = true; for (const [n, fn] of runs) if (which === 'all' || which === n) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
