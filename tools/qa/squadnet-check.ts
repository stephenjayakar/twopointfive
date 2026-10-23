// THE SQUAD REACHES YOU, AND THE QUICK KEY SAYS WHY (src/game/squadnet.ts — SQUADNET.on · .why · .clear), headless:
//   bun run tools/qa/squadnet-check.ts [why|clear|end|net|off]  (probes.ts squadnet; SQUADNET_BREAK=1 = the five switches left off: must fail)
//   why    the room clear on the office with its squad of four, stacked on a door whose far room nobody has stood in: the quick key's row ends on the reason
//          (a room nobody has been in · the last stun kept back · an enemy in sight inside), says nothing more of a plain open (a silent squad), and the man
//          who answers the press says the reason in place of the row's own answer.
//   clear  the lead's call at an entry's end: 'clear' only of a room whose search was not cut short and that nobody stands in; 'quiet' of floor unseen
//          with nobody in sight; nothing with an enemy in sight. (The entry itself is in `why`: what the lead said is what its search found.)
//   end    an entry into a room the mission has no name for (the office's conference room) ends with the lead's call too: 'room clear.' with all of its
//          floor seen and nobody in it; with the switch off the same entry ends with nothing said, as it was. Open floor is called 'clear so far.'.
//   net    a teammate's line said with his head off the screen clicks (a defender's does not, a teammate's on the screen does not); a teammate going down is
//          a row of its own for its time, with the lower click, once; a man already down when the run starts is not called. The run with the rule on is the
//          run with it off, by digest: it is the page's alone.
//   off    the switches off = the lines as they were; the registry, a recording from before the keys, the frozen stand's rows.
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the five switches and the autopilot itself. Where a far line is DRAWN (ui/bubbles.ts)
// is not looked at here, no picture is; where it is PUT is (squadnet.ts netPlace, the one place bubbles.ts asks), in `net`.
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
const { SQUADNET, whyWords, roomCall, plainCall, netPlace } = SN;
const { AUTOPILOT, autoPick, autoEntries } = AP;
/** the five switches as this stand stood them when the harness loaded (the shipped stand's boot has run by now; nothing here has written them yet) */
const STOOD = [SQUADNET.on, SQUADNET.why, SQUADNET.clear, SQUADNET.endCall, SQUADNET.edge];

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
/** the five switches as a line asks for them (all left off under SQUADNET_BREAK) */
const raise = (on = true, why = true, clear = true, endCall = true, edge = true) => { SQUADNET.on = on && !BREAK; SQUADNET.why = why && !BREAK; SQUADNET.clear = clear && !BREAK; SQUADNET.endCall = endCall && !BREAK; SQUADNET.edge = edge && !BREAK; };
/** a line that calls an entry's end */
const isCall = (x: string) => (/ clear\.$/.test(x) && !/ and clear\.$/.test(x)) || / quiet\. |^clear so far\.$/.test(x);   // (not an order's own answer: 'bang and clear.')

/** the room clear on the office with a squad of four under god mode, the autopilot on (autopilot-check's own staging); `play`: every call the mixer was asked for */
async function rig(seed: number) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try { NIGHTBREACH.squad = 4; Math.random = seeded(seed); W = await standUp(); AUTOPILOT.on = true; W.game.godMode = true; why = W.game.roomClear.start(seed); } finally { NIGHTBREACH.squad = squad0; }
  const game = W.game, O = game.orders, input = W.input, play: { name: string; gain: number; rate: number | undefined }[] = [];
  { const a = game.audio, p0 = a.play.bind(a); a.play = (name: string, pos: unknown, gain = 1, opts: any = {}) => { play.push({ name, gain, rate: opts?.rate }); return p0(name, pos, gain, opts); }; }
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  // (`said` is the log, which keeps a line only where its man is off the screen or in the fog; `bub` is every line a teammate's bubble has held, read a frame)
  const bub: string[] = [], bubSeen = new Set<string>();
  const R = { W, game, O, why, play, said, bub,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); for (const m of O.squad()) { const b = m.bubble, k = b ? `${m.callsign}|${b.t}|${b.text}` : ''; if (b && !bubSeen.has(k)) { bubSeen.add(k); bub.push(b.text); } } } },
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
 *  room clear's own, the rooms a lead calls by name — 'not': and is none of them; `first`: run once the game stands, before anything is said) */
async function stackedOn(seed: number, named: boolean | 'not' = false, first?: () => void): Promise<{ R: any; D: any; t: any; at: number[]; set: boolean } | { R: any; why: string }> {
  const R: any = await hushed(() => rig(seed)); if (R.why) return { R, why: String(R.why) }; first?.();
  const g = R.game, O = R.O, all = O.men('all'), stackDef = O.defs.find((d: any) => d.id === 'stack'), s = g.player.char.pos;
  for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) {
    const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue;
    const far = farRoom(g, t); if (!far || g.cleared.isKnown(far) || O.whyNot(stackDef, O.forMen(t, all), all)) continue;
    if (named) { const c = d.frameCentre, th = d.def.closedDir, k = -t.side * 1.5, p = [c[0] - Math.sin(th) * k, 0, c[2] + Math.cos(th) * k]; if (g.roomClear.rooms.some((r: any) => r.def.id === g.roomClear.roomAt(p)) !== (named === true)) continue; }
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
    F.verdict(S.set && /bang and clear/.test(three) && tail(three) === "nobody's been in there" && whyWords(p3)?.row === "nobody's been in there" && /and clear/.test(one) && !/bang and/.test(one) && tail(one) === "they're saving the last bang" && p1.kept === true && !/nobody|saving/.test(none),
      'a room nobody has been in: the row says so; with one stun left it says the last is kept; with none it says nothing more', `stacked ${S.set} · 3 stuns: "${three}" · 1 stun: "${one}" · none: "${none}"`);
    // 2. an enemy the team has in sight inside (a staged sight, as autopilot-check stages it)
    { const foe = g.guards.find((o: any) => o.state !== 'dead' && o.team !== 'operative' && o.team !== 'civilian' && o.team !== 'player'); let seen = '', inRoom = false, why = '';
      if (foe) { const Fg = g.fogOfWar, seen0 = Fg.seen, was = [...foe.char.pos], on0 = Fg.on, c = D.frameCentre, th = D.def.closedDir, k = -tm.side * 1.5;
        foe.char.pos[0] = c[0] - Math.sin(th) * k; foe.char.pos[2] = c[2] + Math.cos(th) * k; inRoom = g.cleared.roomAt(foe.char.pos) === far; Fg.on = true; Fg.seen = (o: any) => o === foe || seen0.call(Fg, o);
        T.bangs = 1; seen = R.hudQ(at); why = autoEntries(g, tm).why;
        Fg.seen = seen0; Fg.on = on0; foe.char.pos[0] = was[0]; foe.char.pos[1] = was[1]; foe.char.pos[2] = was[2]; }
      F.verdict(!!foe && inRoom && why === 'contact' && /bang and clear/.test(seen) && tail(seen) === 'they see one inside', 'an enemy in sight inside: the last stun goes, and the row says they see one', `staged ${!!foe}${inRoom ? '' : ' (NOT in the room)'} · why ${why} · "${seen}"`); }
    // 3. a plain open says nothing more: a silent squad
    { T.bangs = 3; SIL.SILENT.on = true; SIL.setSilent(g, true); R.step(2); const silent = SIL.squadSilent(g), quiet = R.hudQ(at), w = whyWords(autoPick(g, O.targetAt(at), false))?.row ?? null; SIL.setSilent(g, false); R.step(2);
      F.verdict(silent && !/nobody|saving|they see/.test(quiet) && w === null, 'a plain open says nothing more (a silent squad opens it quietly)', `silent ${silent} · "${quiet}" · reason ${w}`); }
    // 4. the press: the man who answers says the reason
    { T.bangs = b0 > 1 ? b0 : 3; const RC = g.roomClear; let emptied = 0; for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile' && g.cleared.roomAt(x.char.pos) === far) { x.state = 'dead'; emptied++; }   // (the room beyond is emptied, so that the call at the entry's end is the search's alone)
      const want = autoPick(g, O.targetAt(at)), n0 = R.said.length, w0 = g.squadNet.stats.whys; aimOf(R, D); R.W.input.pressed.add(ORDERS.quickKey); R.step(); R.step(2);
      const row = O.log[O.log.length - 1], ans = R.said.slice(n0).find((x: string) => /banging it/.test(x)) ?? R.team.map((m: any) => m.bubble?.text).find((x: any) => /banging it/.test(x ?? '')) ?? '';
      F.verdict(want.id === 'bangClear' && row?.order === 'bangClear' && /banging it\. nobody's been in there\./.test(ans) && g.squadNet.stats.whys === w0 + 1, 'the press: they go in with a stun and the man who answers says why', `pick ${want.id} (${want.why}) · order ${row?.order} · answer "${ans}" · reasons given ${g.squadNet.stats.whys - w0}`);
      // 5. the entry's end: what the lead calls is what the search found
      raise(true, true, true, false); const n1 = R.bub.length; R.until(() => T.ops.length === 0, 60); R.step(30);   // (the fourth switch left off: this line is the NAMED call's)
      const op = T.done[T.done.length - 1], left = op?.search ? op.search.left : NaN, calls = R.bub.slice(n1).filter(isCall);
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
    const pl = roomCall(g, 'bunks', 9, false, false), sg = roomCall(g, 'mess', 9, false, false);
    F.verdict(pl === "bunks are quiet. we didn't see all of it." && sg === "mess's quiet. we didn't see all of it.", 'a room named in the plural is called as you would say it', `${pl} · ${sg}`);
  });
  return F.done();
}

export async function squadnetEnd(): Promise<boolean> {
  const F = family('squadnet-end: an entry into a room the mission has no name for ends with a call too');
  await kept(async () => {
    const R: any = await hushed(() => rig(7)), g = R.game; raise();
    const a = plainCall(g, false, 0, false, false), b = plainCall(g, false, 3, false, false), c = plainCall(g, false, 0, true, false), d = plainCall(g, false, 3, true, true), e = plainCall(g, true, 0, true, false), f = plainCall(g, true, 0, true, true), n = g.squadNet.stats.ends;
    F.verdict(a === 'room clear.' && b === "room's quiet. we didn't see all of it." && c === null && d === null && e === 'clear so far.' && f === null && n === 3,
      'a room: clear, quiet or nothing by the named rooms\' own rule · open floor: \'clear so far.\' unless an enemy on it is in sight · each call counted', `seen all, empty: ${a} · 3 unseen, empty: ${b} · seen all, one inside: ${c} · one in sight: ${d} · open floor, nobody in sight: ${e} · open floor, one in sight: ${f} · counted ${n}`);
    SQUADNET.clear = false; const g1 = plainCall(g, false, 3, false, false), g2 = plainCall(g, false, 3, true, false);
    F.verdict(g1 === (BREAK ? null : 'room clear.') && g2 === null, 'with \'clear means clear\' off it is the older rule: clear with nobody in it, nothing otherwise', `3 unseen, empty: ${g1} · one inside: ${g2}`);
  });
  // the entry itself, with the rule on and with it off: the squad goes into the nearest room that is none of the room clear's own
  const run = (on: boolean) => kept(async () => {
    const S: any = await stackedOn(5, 'not', () => raise(true, true, true, on)); if (S.why) return { why: String(S.why) } as any;
    const { R, D } = S, g = R.game, O = R.O, T = g.doorTools, RC = g.roomClear;
    const tm = { ...S.t, side: O.of(R.team[0])?.post ? sideOf(D, O.of(R.team[0]).post) : S.t.side }, far = farRoom(g, tm); let emptied = 0;
    for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile' && g.cleared.roomAt(x.char.pos) === far) { x.state = 'dead'; emptied++; }   // (the room beyond is emptied: the call is the search's alone)
    T.bangs = 3; const d0 = T.done.length; aimOf(R, D); R.W.input.pressed.add(ORDERS.quickKey); R.step(); R.step(2); const n0 = R.bub.length; R.until(() => T.ops.length === 0, 70); R.step(30);   // (the window opens once the press has been answered)
    const op = T.done.length > d0 ? T.done[T.done.length - 1] : null, lead = op?.lead;
    return { set: S.set, door: D.def.name, emptied, went: !!op?.beats.some((b: any) => b.what === 'in'), named: !!lead && RC.rooms.some((r: any) => r.def.id === RC.roomAt(lead.char.pos)), left: op?.search ? op.search.left : NaN, calls: R.bub.slice(n0).filter(isCall) as string[], ends: g.squadNet.stats.ends as number };
  });
  const on = await run(true), off = await run(false);
  if (on.why || off.why) { F.verdict(false, 'the squad stacks on a door into a room the mission has no name for', String(on.why ?? off.why)); return F.done(); }
  const tell = (r: any) => `${r.door}: stacked ${r.set} · went in ${r.went} · the lead ends in ${r.named ? 'a NAMED room' : 'no named room'} · floor unseen ${r.left} · called ${JSON.stringify(r.calls)} · counted ${r.ends}`;
  F.verdict(on.set && on.went && !on.named && on.calls.length === 1 && /^room clear\.$|^room's quiet\. /.test(on.calls[0]) && on.ends === 1, 'on: the lead calls the room though the mission has no name for it', tell(on));
  F.verdict(off.set && off.went && !off.named && off.calls.length === 0 && off.ends === 0, 'off: the same entry ends with nothing said, as it was', tell(off));
  // the response team runs the same door orders as a cast of its own: none of this is theirs (no call at an entry's end, no click on the squad's net)
  await kept(async () => {
    const { requestQrf } = await import(`${ROOT}/src/game/qrf.ts`);
    const r = await hushed(async () => {
      Math.random = seeded(41); const W: any = await standUp(), game = W.game; raise();
      const hide = () => { game.teleportPlayer([37.5, 0, 26.5]); game.player.visibility = 0.02; game.playerInvisible = true; game.player.crouch = true; };
      game.godMode = true; game.aiEnabled = true; Object.assign(game.tune, { qrf: true, qrfEta: 14, qrfSize: 4, perimeter: false, qrfSquad: true });
      for (let i = 0; i < 20; i++) W.step(DT);
      hide(); game.alarm.placed = true; game.alarm.pos = [8, 0, 8]; game.alarm.raisedAt = game.time; requestQrf(game, 'panel');
      const seen = new Set<string>(), calls: string[] = []; let ins = 0;
      for (let f = 0; f < 60 * 150 && ins < 2; f++) { hide(); W.step(DT); ins = game.qrf.log.filter((l: any) => l.what === 'drill:in').length;
        for (const m of game.qrf.men ?? []) { const b = m.bubble, k = b ? `${m.callsign}|${b.t}|${b.text}` : ''; if (b && !seen.has(k)) { seen.add(k); if (isCall(b.text)) calls.push(b.text); } } }
      return { ins, calls, ends: game.squadNet.stats.ends as number, lines: game.squadNet.stats.lines as number, squad: game.orders.squad().length as number, said: seen.size };
    });
    F.verdict(r.ins >= 2 && r.said > 0 && r.calls.length === 0 && r.ends === 0 && r.lines === 0, 'the response team\'s own entries are not called, and its lines do not click the squad\'s net', `its entries ${r.ins} · its lines ${r.said} · calls ${JSON.stringify(r.calls)} · counted ${r.ends} · clicks owed the squad's net ${r.lines} (Sam's squad: ${r.squad} men)`);
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
    const clicks = () => R.play.filter((p: any) => p.name === 'radio' && p.rate === SQUADNET.clickRate && Math.abs(p.gain - SQUADNET.click) < 1e-6).length;
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
    F.verdict(row?.text === `${m2.callsign} is down.` && dist(row.at, m2.char.pos) < 0.01 && low === 1 && again === 1 && rows1 === 1 && gone === 0, 'a teammate down: his row from where he fell, the lower click, once, gone after its time',
      `row "${row?.text ?? 'none'}" · lower clicks ${low} · called ${again} · rows a second on ${rows1}, after ${SQUADNET.downSecs} s ${gone}`);
    // (the roster stood up again under the same names: the man who was down is up, and is called when he goes down again)
    m2.state = 'patrol'; R.step(2); m2.state = 'dead'; R.step(2); const twice = N.stats.downs;
    F.verdict(twice === 2, 'a man stood up again under the same name is called when he goes down again', `called ${twice}`);
    // 5. a run that starts with a man already down does not call him
    N.reset(); R.step(3); F.verdict(N.rows.length === 0 && N.stats.downs === 0, 'a man already down when the run starts is not called', `rows ${N.rows.length} · called ${N.stats.downs}`);
  });
  // where a far line is put (netPlace, the one place ui/bubbles.ts asks): at the view's edge on his side with the rule, a short way out from you without
  await kept(() => {
    raise(); const w = 960, h = 540, px = 470, py = 300, bw = 150, bh = 22, m = Math.min(w, h), pad = SQUADNET.edgeIn * m, x0 = bw / 2 + 6, x1 = w - bw / 2 - 6, y0 = bh + 12, y1 = h - 12, free = () => false;
    const dirs: [string, number, number][] = [['right', 1, 0], ['down right', 1, 1], ['down', 0, 1], ['down left', -1, 1], ['left', -1, 0], ['up left', -1, -1], ['up', 0, -1], ['up right', 1, -1]];
    /** how far inside the kept box's border the point lies, on the nearest border of his side */
    const gap = (x: number, y: number, dx: number, dy: number) => Math.min(dx > 0 ? x1 - x : dx < 0 ? x - x0 : Infinity, dy > 0 ? y1 - y : dy < 0 ? y - y0 : Infinity);
    const far = (dx: number, dy: number) => netPlace(w, h, px, py, px + dx * 4000, py + dy * 4000, bw, bh, free) as [number, number];
    const on = dirs.map(([n, dx, dy]) => { const [x, y] = far(dx, dy), L = Math.hypot(dx, dy), vx = x - px, vy = y - py, D = Math.hypot(vx, vy); return { n, x, y, gap: gap(x, y, dx, dy), D, straight: Math.abs(vx * dy - vy * dx) / L < 0.01 && vx * dx + vy * dy > 0 }; });
    const here = netPlace(w, h, px, py, px + 40, py, bw, bh, free), none = netPlace(w, h, px, py, px, py, bw, bh, free);
    SQUADNET.edge = false; const off = dirs.map(([, dx, dy]) => { const [x, y] = far(dx, dy); return Math.hypot(x - px, y - py); });
    const [ox, oy] = far(1, 0), up = netPlace(w, h, px, py, px + 4000, py, bw, bh, (_x: number, y: number) => y === oy) as [number, number]; SQUADNET.edge = !BREAK;
    const atEdge = on.every(o => Math.abs(o.gap - pad) < 0.01 && o.straight), further = on.every((o, i) => o.D > off[i] + 20), wasNear = off.every(d => Math.abs(d - SQUADNET.near * m) < 0.01);
    F.verdict(atEdge && further && wasNear && !!here && Math.abs(here[0] - (px + 40)) < 0.01 && Math.abs(here[1] - py) < 0.01 && none === null && up[0] === ox && up[1] === oy - 26,
      'a far line is put at the edge of the view on his side, straight his way from you; with the rule off, a short way out from you and up a row from a taken one', `${w} x ${h}, you at ${px}, ${py} · kept ${pad.toFixed(1)} px in · ${on.map(o => `${o.n} ${o.x.toFixed(0)},${o.y.toFixed(0)} (${o.gap.toFixed(1)} in, ${o.D.toFixed(0)} out)`).join(' · ')} · off: ${off.map(d => d.toFixed(0)).join(' ')} out, a taken row: ${up.map(v => v.toFixed(0))} · a man 40 px away: ${here?.map((v: number) => v.toFixed(0))} · a man on you: ${none}`);
    // you out by the border yourself: a man past that border does not put the line on you, and it does not jump as his bearing crosses straight up
    { const W = 1280, H = 720, ux = 150, uy = 360, lw = 298, M = Math.min(W, H), P = SQUADNET.edgeIn * M, bx0 = lw / 2 + 6 + P, by0 = bh + 12 + P;
      const l = netPlace(W, H, ux, uy, ux - 5, -4000, lw, bh, free) as [number, number], r = netPlace(W, H, ux, uy, ux + 5, -4000, lw, bh, free) as [number, number];
      const you = (x: number, y: number) => x + lw / 2 > ux - 16 && x - lw / 2 < ux + 16 && y > uy - 30 && y - bh < uy + 34, past = netPlace(W, H, ux, uy, -4000, uy, lw, bh, you) as [number, number];
      F.verdict([l, r].every(q => Math.abs(q[1] - by0) < 0.01 && Math.hypot(q[0] - ux, q[1] - uy) > 100) && Math.abs(l[0] - r[0]) < 5 && Math.abs(past[0] - bx0) < 0.01 && !you(past[0], past[1]),
        'you out by the border yourself: a man off the top is called at the top whichever side of straight up he is, and a man past your border is called on that border clear of you', `${W} x ${H}, you at ${ux}, ${uy}, a ${lw} px line · off the top a hair left ${l.map(v => v.toFixed(0))} · a hair right ${r.map(v => v.toFixed(0))} · past the left border at your height ${past.map(v => v.toFixed(0))}`); }
    // a spot that hits something moves along the border it is at; never off the view
    { const A = 156 * Math.PI / 180, qx = 653, qy = 292, by0 = y0 + pad, by1 = y1 - pad, over = (r: number[], x: number, y: number) => x + bw / 2 > r[0] && x - bw / 2 < r[1] && y > r[2] && y - bh < r[3] + 4, card = [0, 250, 350, 540];
      const bare = netPlace(w, h, qx, qy, qx + Math.cos(A) * 4000, qy + Math.sin(A) * 4000, bw, bh, free) as [number, number], low = netPlace(w, h, qx, qy, qx + Math.cos(A) * 4000, qy + Math.sin(A) * 4000, bw, bh, (x: number, y: number) => over(card, x, y)) as [number, number];
      const top = netPlace(w, h, px, py, px + 300, py - 4000, bw, bh, free) as [number, number], second = netPlace(w, h, px, py, px + 320, py - 4000, bw, bh, (x: number, y: number) => Math.abs(y - top[1]) < 25.5 && Math.abs(x - top[0]) < bw + 4) as [number, number];
      const right = far(1, 0), under = netPlace(w, h, px, py, px + 4000, py, bw, bh, (_x: number, y: number) => y === right[1]) as [number, number], full = netPlace(w, h, px, py, px + 4000, py, bw, bh, () => true) as [number, number];
      let out = 0, n = 0;
      for (const lw of [100, 300, 900, 1200]) for (const [sx, sy] of [[470, 300], [10, 10], [950, 530], [480, 5], [5, 270]]) for (let k = 0; k < 16; k++) for (const hit of [free, () => true, (x: number, y: number) => over(card, x, y)]) {
        const q = netPlace(w, h, sx, sy, sx + Math.cos(k * Math.PI / 8) * 3000, sy + Math.sin(k * Math.PI / 8) * 3000, lw, bh, hit) as [number, number], a = lw / 2 + 6, b = Math.max(a, w - lw / 2 - 6); n++;
        if (!(q[0] >= a - 0.01 && q[0] <= b + 0.01 && q[1] >= y0 - 0.01 && q[1] <= y1 + 0.01)) out++; }
      F.verdict(Math.abs(bare[1] - by1) < 0.01 && bare[0] < 250 && Math.abs(low[1] - by1) < 0.01 && low[0] - bw / 2 >= 250 && low[0] - bare[0] < 26 * 7 && Math.abs(second[1] - (by0 + 26)) < 0.01 && Math.abs(under[0] - right[0]) < 0.01 && Math.abs(under[1] - (right[1] - 26)) < 0.01 && full[0] === right[0] && full[1] === right[1] && out === 0,
        'a spot that lies on something moves along the border it is at, the nearest free place first; never off the view', `at the bottom, under a card ${card.slice(0, 2).join(' to ')} wide: ${bare.map(v => v.toFixed(0))} moves to ${low.map(v => v.toFixed(0))} · a second man off the top: ${top.map(v => v.toFixed(0))} then ${second.map(v => v.toFixed(0))} · at the right border on a taken row: ${right.map(v => v.toFixed(0))} moves to ${under.map(v => v.toFixed(0))} · nothing free: ${full.map(v => v.toFixed(0))} · ${n} placings, ${out} off the view`); }
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
    const { R, D, at } = S, g = R.game, O = R.O, T = g.doorTools; SQUADNET.on = SQUADNET.why = SQUADNET.clear = SQUADNET.endCall = SQUADNET.edge = false; T.bangs = 3;
    const row = R.hudQ(at), n0 = R.said.length; aimOf(R, D); R.W.input.pressed.add(ORDERS.quickKey); R.step(); R.step(2);
    const ans = R.said.slice(n0).join(' | '), def = O.defs.find((d: any) => d.id === 'bangClear'), own = (def.ackNow ?? def.ack).concat(def.ack).some((a: string) => ans.includes(a)) || R.team.some((m: any) => (def.ackNow ?? def.ack).concat(def.ack).includes(m.bubble?.text));
    F.verdict(/bang and clear/.test(row) && !/nobody|saving|they see/.test(row) && !/banging it\. nobody/.test(ans) && own && g.squadNet.stats.whys === 0, 'why off: the row and the answer are the row\'s own', `"${row}" · answered by the row's own line ${own}`);
    const a = roomCall(g, 'mess', 3, false, false), b = roomCall(g, 'mess', 0, true, true);
    F.verdict(a === 'mess clear.' && b === null && g.squadNet.stats.quiets === 0, 'clear off: a room nobody stands in is called clear whatever the search saw, as it was', `3 unseen, empty: ${a} · one inside: ${b}`);
    const e1 = plainCall(g, false, 0, false, false), e2 = plainCall(g, true, 0, false, false);
    F.verdict(e1 === null && e2 === null && g.squadNet.stats.ends === 0, 'every entry off: a room the mission has no name for is not called, as it was', `a room: ${e1} · open floor: ${e2}`);
    const mate = R.team[0], l0 = g.squadNet.stats.lines; g.viewProj = null; g.say(mate, 'moving.');   // (no view: his head is off the screen) const m2 = R.team[1]; m2.god = false; m2.state = 'dead'; R.step(2);
    F.verdict(g.squadNet.stats.lines === l0 && g.squadNet.rows.length === 0 && g.squadNet.stats.downs === 0 && !R.play.some((p: any) => p.name === 'radio' && p.rate === SQUADNET.downRate), 'net off: no line is counted, no man down is called, no lower click', `lines ${g.squadNet.stats.lines - l0} · rows ${g.squadNet.rows.length}`);
    // the wiring: the registry, a recording from before the keys, the frozen stand's rows
    SQUADNET.on = SQUADNET.why = SQUADNET.clear = SQUADNET.endCall = SQUADNET.edge = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), rides = snap.tables?.SQUADNET?.on === true && snap.tables.SQUADNET.why === true && snap.tables.SQUADNET.clear === true && snap.tables.SQUADNET.endCall === true && snap.tables.SQUADNET.edge === true; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.SQUADNET;
    const mid = JSON.parse(JSON.stringify(snap)); delete mid.tables.SQUADNET.endCall; delete mid.tables.SQUADNET.edge;   // (a file from the build that had the first three and neither of the later two)
    const mid2 = JSON.parse(JSON.stringify(snap)); delete mid2.tables.SQUADNET.edge;   // (…and one from the build that had four)
    const both = await hushed(() => { applyKnobs(g, old); const off = !SQUADNET.on && !SQUADNET.why && !SQUADNET.clear && !SQUADNET.endCall && !SQUADNET.edge; SQUADNET.endCall = SQUADNET.edge = true; applyKnobs(g, mid); const three = SQUADNET.on && SQUADNET.why && SQUADNET.clear && !SQUADNET.endCall && !SQUADNET.edge; SQUADNET.endCall = SQUADNET.edge = true; applyKnobs(g, mid2); const four = SQUADNET.on && SQUADNET.why && SQUADNET.clear && SQUADNET.endCall && !SQUADNET.edge; applyKnobs(g, snap); return [off, SQUADNET.on && SQUADNET.why && SQUADNET.clear && SQUADNET.endCall && SQUADNET.edge, three, four]; });
    F.verdict(rides && both[0] && both[1] && both[2] && both[3], 'a recording carries the five switches; one from before the keys replays with all off, one from before a later key with that key off', `rides ${rides} · old file: off ${both[0]} · a file with three: the later two off ${both[2]} · a file with four: the fifth off ${both[3]} · its own: on ${both[1]}`);
    const reg = knobRegistry() as Record<string, unknown>, H = FROZEN_HOLDS as Record<string, string>;
    F.verdict(reg.SQUADNET === SQUADNET && (JOURNAL_KNOBS as string[]).includes('SQUADNET') && H['SQUADNET.on'] === 'TPS_SQUADNET=1' && H['SQUADNET.why'] === 'TPS_QWHY=1' && H['SQUADNET.clear'] === 'TPS_HONESTCLEAR=1' && H['SQUADNET.endCall'] === 'TPS_ENDCALL=1' && H['SQUADNET.edge'] === 'TPS_NETEDGE=1',
      'the table is in the knob registry; the frozen stand holds the five off under their words', `registry ${reg.SQUADNET === SQUADNET} · journal ${(JOURNAL_KNOBS as string[]).includes('SQUADNET')} · holds ${H['SQUADNET.on']} · ${H['SQUADNET.why']} · ${H['SQUADNET.clear']} · ${H['SQUADNET.endCall']} · ${H['SQUADNET.edge']}`);
  });
  // the stand as it was stood up: off on the frozen stand, on on the shipped one (unless a word was given)
  await kept(async () => {
    const shipped = process.env.TPS_PROFILE === 'shipped', given = ['TPS_SQUADNET', 'TPS_QWHY', 'TPS_HONESTCLEAR', 'TPS_ENDCALL', 'TPS_NETEDGE'].some(k => process.env[k] !== undefined);
    // (the shipped stand: the page's own boot wrote them as the harness loaded. The frozen one: every game stood up pins them off, whatever they were)
    Object.assign(SQUADNET, { on: true, why: true, clear: true, endCall: true, edge: true }); await hushed(() => standUp()); const got = shipped ? STOOD : [SQUADNET.on, SQUADNET.why, SQUADNET.clear, SQUADNET.endCall, SQUADNET.edge], kept2 = shipped ? SQUADNET.on && SQUADNET.why && SQUADNET.clear && SQUADNET.endCall && SQUADNET.edge : true;
    F.verdict(given || (got.every(x => x === shipped) && kept2), `this stand (${shipped ? 'shipped' : 'frozen'}) stands the five ${shipped ? 'on, and a game stood up leaves them on' : 'off: a game stood up pins them off'}`, `on ${got[0]} · why ${got[1]} · clear ${got[2]} · every entry ${got[3]} · edge ${got[4]}${given ? ' (a word was given in the environment: not held)' : ''}`);
  });
  if (BREAK) { F.verdict(false, 'SQUADNET_BREAK', 'the break path: this family holds with the switches off, so it is failed by hand'); }
  return F.done();
}

if (import.meta.main) {
  const which = process.argv[2] ?? 'all', runs: [string, () => Promise<boolean>][] = [['why', squadnetWhy], ['clear', squadnetClear], ['end', squadnetEnd], ['net', squadnetNet], ['off', squadnetOff]];
  let ok = true; for (const [n, fn] of runs) if (which === 'all' || which === n) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
