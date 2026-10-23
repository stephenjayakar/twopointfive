// A TEAMMATE SHOWS WHY HE IS NOT ACTING (src/game/showwhy.ts SHOWWHY / showWhyTick; the wave is character.ts signalLayer 'aside') — the check.
//
//   bun run tools/qa/showwhy-check.ts [--verbose] [--only <case>]      exit 0 = all pass, 1 = a FAIL line
//   SHOWWHY_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts showwhy
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SHOWWHY,
//   and raises by hand the rules a case stands on where the frozen stand holds them off (CONDITION for the hurt man, REARWATCH.room for the kept door,
//   DOORMANNERS for the doorway's hold).
//
// The harness has no GPU: what is proven HERE is what the game asks of each man's hand and puts over his head, and where the animator then puts the wrist —
// never a gesture seen. A squad of four in the warehouse, its defenders taken off the floor unless a line needs one:
//   plain   fallen in behind a walking player, then sent to a spot and stood there: nobody signals, nobody says a line of this file's, every man reads
//           'nothing holds him' — and the run's digest is the one of the same play with the switch off
//   stack   'bang and clear' given on the word: once the stack is made a squeeze goes up the file before the lead's fist, the fist comes again while they
//           wait, the wrist really goes up by his head, no line is added to the door tools' own 'set.' — and after the word no fist follows them in
//   line    a defender the front man has his gun on, the player stood between them: that man — and not the three in file behind him — waves him off ('aside'), "you're in my line." is over him and still
//           over him seconds later having been said once, he waves again — and with the player out of the line the words go and nothing more is shown
//   quiet   … the same with the man unaware and the squad's fire held (nobody has found them): no wave, no line — no round was wanted
//   hurt    a blast that leaves a man standing: "I'm hit." once, from him alone, the hunch on his figure; fallen in behind a player who runs off, he says
//           "I can't keep up." once
//   keep    a room taken, another of its doors held, 'fall in' given with the player in the room: the man who keeps that door says "I've got this door."
//           once, and reads 'keep' while he is kept
//   door    the player stood in the doorway the squad is sent out through: a man held at it points the way, and "after you." once for the whole squad
//   off     the stack and the line staged with the switch off: no signal, no line, nothing counted
//   same    those two runs on against off: with the words over the men's heads left out of it, the run digest is the same (nobody's feet, gun, eyes
//           or rounds moved)
//   old     a recording from before the key replays with it off (journal.ts applyKnobs)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const DT = 1 / 60, LINE_M = Number(process.env.LINE_M ?? 6);   // (how far off the defender of the 'line' case stands)
type V = [number, number, number];

export async function showWhyCheck(o: { verbose?: boolean; only?: string } = {}): Promise<boolean> {
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { SHOWWHY, SHOWWHY_LINES, showWhyOf, showWhyLog, showWhyStats } = await import(`${ROOT}/src/game/showwhy.ts`);
  const { REARWATCH, roomKept } = await import(`${ROOT}/src/game/rearwatch.ts`);
  const { CONDITION, conditionHurt } = await import(`${ROOT}/src/game/condition.ts`);
  const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
  const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);
  const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
  const { stackRoomProbe } = await import(`${ROOT}/src/game/stackroom.ts`);
  const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SHOWWHY_BREAK === '1';
  const MINE = new Set<string>(Object.values(SHOWWHY_LINES) as string[]);
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  /** the run's digest with every man's words left out: his feet, his gun, his eyes, the rounds, the doors — everything but what is over a head */
  const bare = (g: any): string => { const D: any = digestGame(g); for (const x of D.guards ?? []) delete x.bubble; return hashDigest(D) as string; };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const want = (name: string) => !o.only || o.only === name;
  const was = { on: SHOWWHY.on, env: process.env.TPS_SHOWWHY, cond: CONDITION.on, room: REARWATCH.room, hf: HOLDFIRE.on, dm: DOORMANNERS.on, rnd: Math.random };
  const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const d3 = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const E = (ALL_MISSIONS as any[]).find(x => x.id === 'warehouse-four');
  const levelOf = (): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
  const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };
  const put = (m: any, p: ArrayLike<number>, yaw: number) => { m.char.pos = [p[0], 0, p[2]]; m.char.vel = [0, 0, 0]; m.speed = 0; m.char.bodyYaw = m.char.aimYaw = yaw; m.path = []; m.pathGoal = null; m.char.update(0); };

  /** the warehouse stood up with its four, the switch where `on` says (by the stand's own word); `keepFoe`: one defender is left alive, whole and held */
  async function rig(on: boolean, keepFoe = false) {
    const sw = on && !BREAK;
    process.env.TPS_SHOWWHY = sw ? '1' : '0'; SHOWWHY.on = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    CONDITION.on = was.cond; REARWATCH.room = was.room; HOLDFIRE.on = was.hf; DOORMANNERS.on = was.dm;   // (what an earlier line raised by hand is put back: every rig starts from the stand's own switches)
    Math.random = seeded(0x5709 + 7919);
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf() })); const g = W.game;
    const stood = SHOWWHY.on; SHOWWHY.on = sw;
    g.godMode = true; g.playerInvisible = true;
    const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E) as string))); if (why) throw new Error(`start refused — ${why}`);
    const sig = new Map<any, number>(); let sigFrames = 0;
    const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { SHOWWHY.on = sw; g.player.visibility = 0.05; W.step(DT); for (const m of men) if (m.char.anim.signalling) { sigFrames++; sig.set(m, (sig.get(m) ?? 0) + 1); } each?.(); } };
    let men: any[] = [];
    step(20);
    const O = g.orders; men = O.squad().filter((x: any) => x.state !== 'dead'); for (const m of men) m.god = true;
    let foe: any = null;
    for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') { if (keepFoe && !foe && x.team === 'hostile') { foe = x; x.god = true; continue; } killGuard(g, x, [0, 0, 1], true); }
    step(30);
    const notes = () => showWhyLog(g) as { t: number; who: string; why: string; signal: string | null; line: string | null }[];
    const said = (m: any) => { const b = m.bubble; return b && g.time - b.t <= b.dur ? b.text as string : null; };
    return { W, g, O, men, foe, step, stood, sw, notes, said, sigFrames: () => sigFrames, sig };
  }
  type Rig = Awaited<ReturnType<typeof rig>>;
  /** the on runs of 'stack' and 'line', kept for 'same' (played there when those lines were not asked for) */
  const kept: { stack?: { bare: string; notes: number }; line?: { bare: string; notes: number } } = {};
  /** a door face with floor for the four and the player, every door shut, the men put on it facing the door; null: no such face */
  function face(A: Rig, skip = 0): { d: any; side: 1 | -1; out: V; spots: V[] } | null {
    const g = A.g; let seen = 0;
    for (const d of g.doors.list) for (const side of [1, -1] as const) {
      const F = stackRoomProbe(g, d, side); if (!F.floor) continue;
      const spots: V[] = []; for (const band of [[5, 14], [2, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length > A.men.length) break; if (spots.some(q => flat(q, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); }
      if (spots.length <= A.men.length) continue;
      if (seen++ < skip) continue;
      for (const x of g.doors.list) shut(x);
      const c = d.frameCentre as V;
      A.men.forEach((m, i) => put(m, spots[i], Math.atan2(c[0] - spots[i][0], c[2] - spots[i][2])));
      const out = spots[A.men.length]; g.teleportPlayer([out[0], 0, out[2]]); A.step(10);
      return { d, side, out, spots };
    }
    return null;
  }
  /** the longest straight run of free floor from `p` (16 ways), at least `need` long: its far end, or null */
  function runway(g: any, p: ArrayLike<number>, need: number): V | null {
    let best: V | null = null, bl = 0;
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, ux = Math.sin(a), uz = Math.cos(a); let L = 0;
      for (; L < 14; L += 0.25) { const q: V = [p[0] + ux * (L + 0.25), 0, p[2] + uz * (L + 0.25)]; if (g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]) || g.doors.list.some((d: any) => flat(q, d.frameCentre) < 1.2)) break; }
      if (L > bl) { bl = L; best = [p[0] + ux * L, 0, p[2] + uz * L]; } }
    return bl >= need ? best : null;
  }

  try {
    // ---- plain: nothing shown, and the digest of the switch off
    if (want('plain')) {
      const play = async (on: boolean) => {
        const A = await rig(on), g = A.g, s0: V = [...g.player.char.pos] as V, far = runway(g, s0, 5); if (!far) throw new Error('plain: no free run of floor from the start');
        const refused = A.O.give('fallIn', { kind: 'none', at: [s0[0], 0, s0[2]] }, 'all'); A.step(60);
        let read = 0; const each = () => { for (const m of A.men) if (showWhyOf(g, m)) read++; };
        const L = flat(s0, far), n = Math.floor(L / 0.03); for (let i = 1; i <= n; i++) { g.teleportPlayer([s0[0] + (far[0] - s0[0]) * i / n, 0, s0[2] + (far[2] - s0[2]) * i / n]); A.step(1, each); }   // a walk at 1.8 m/s
        A.step(180, each);
        const sent = A.O.give('move', A.O.targetAt(s0), 'all'); A.step(8 * 60, each);
        return { A, refused, sent, read, lines: A.men.filter(m => MINE.has(m.bubble?.text ?? '')).length, hash: hashDigest(digestGame(g)) as string };
      };
      const X = await play(true), Y = await play(false), T = showWhyStats(X.A.g);
      verdict(X.A.stood === X.A.sw && !X.refused && X.A.notes().length === 0 && X.read === 0 && X.lines === 0 && X.A.sigFrames() === 0 && X.hash === Y.hash,
        'plain — fallen in behind a walking player, then sent to a spot: nobody signals or says a line of this file\'s, and the digest is the switch-off run\'s',
        `the stand stood the switch ${X.A.stood ? 'on' : 'off'} · fall in ${X.refused ? `refused (${X.refused})` : 'given'}, move ${X.sent ? `refused (${X.sent})` : 'given'} · ${X.A.notes().length} notes, ${X.read} frames a man read as held, ${X.A.sigFrames()} frames a hand was signalling, ${T.lines} lines · digest ${X.hash} against ${Y.hash} with it off`);
    }

    // ---- stack, and (the same staging) off
    const stackPlay = async (on: boolean) => {
      const A = await rig(on), g = A.g, Fc = face(A); if (!Fc) throw new Error('stack: no door face with floor for the four');
      const refused = A.O.give('bangClear', { kind: 'door', door: Fc.d, side: Fc.side, at: [Fc.d.frameCentre[0], 0, Fc.d.frameCentre[2]] }, 'all', { onWord: true });
      let op: any = null; for (let i = 0; i < 30 * 60 && !op; i++) { A.step(); op = g.doorTools.ops.find((x: any) => x.phase === 'ready') ?? null; }
      if (!op) return { A, refused, op: null as any, tReady: NaN, up: -9, rest: 0, read: 0, after: 0, fistsBefore: 0, added: 0, sigWait: 0, early: 0, bare: '' };
      const lead = op.lead, tReady = g.time, early = A.notes().length, hd = () => lead.char.bones.head, hl = () => lead.char.bones.handL;
      const rest = hd() && hl() ? hl()[1] - hd()[1] : 0; let up = -9, read = 0;   // (his left wrist's height against his head joint's)
      A.step(12 * 60, () => { if (hd() && hl()) up = Math.max(up, hl()[1] - hd()[1]); if (showWhyOf(g, lead) === 'stack') read++; });
      const fistsBefore = A.notes().filter(n => n.signal === 'hold').length, added = A.notes().filter(n => n.line).length, sigWait = A.sigFrames();   // (hands while it WAITS: after the word a thrower's own sign is the build's)
      g.doorTools.go('all'); A.step(90); const n1 = A.notes().length; A.step(10 * 60);
      return { A, refused, op, tReady, up, rest, read, after: A.notes().length - n1, fistsBefore, added, sigWait, early, bare: bare(g) };
    };
    if (want('stack')) {
      const S = await stackPlay(true), N = S.A.notes(); kept.stack = { bare: S.bare, notes: N.length }; const sq = N.filter(n => n.signal === 'squeeze'), fists = N.filter(n => n.signal === 'hold' && n.why === 'stack');
      const lead = S.op?.lead?.callsign, first = fists[0]?.t ?? Infinity;
      verdict(!!S.op && !S.refused && S.early === 0 && (MOVES.on && MOVES.squeeze ? sq.length >= 1 : sq.length === 0) && sq.every(n => n.t < first && n.who !== lead) && S.fistsBefore >= 2 && fists.every(n => n.who === lead) && first - S.tReady < 3 && S.added === 0 && S.up > 0.05 && S.up - S.rest > 0.2 && S.read > 600 && S.after === 0,
        'stack — made and waiting on the word: the squeeze goes up the file, then the lead\'s fist, and again while they wait; no line is added; nothing follows them in',
        S.op ? `${S.early} notes while they walked up · ${sq.length} squeeze${sq.length === 1 ? '' : 's'} (${sq.map(n => n.who).join(', ') || (MOVES.on && MOVES.squeeze ? 'nobody' : 'none: this stand has the squeeze move off, and it would play as a second fist')}) then ${lead}'s fist ${(first - S.tReady).toFixed(2)} s after the stack was made, ${S.fistsBefore} fists in twelve seconds · his left wrist from ${(-S.rest).toFixed(2)} m under his head joint on the gun to ${S.up.toFixed(2)} m over it · read as 'stack' ${S.read} of 720 frames · ${S.added} lines of this file's · ${S.after} notes from a second and a half after the word on`
          : `the order ${S.refused ? `was refused (${S.refused})` : 'never got to its wait'}`);
    }

    // ---- line, quiet
    const linePlay = async (on: boolean, aware: boolean) => {
      const A = await rig(on, true), g = A.g, h = A.foe; if (!h) throw new Error('line: no defender to stand in front of a man');
      HOLDFIRE.on = !aware;   // (aware: the fight is on, nothing holds a round · unaware: the squad's own fire hold is the rule the quiet line stands on)
      const m = A.men[0], p0: V = [...m.char.pos] as V, end = runway(g, p0, 7); if (!end) throw new Error('line: no free run of floor in front of a man');
      const yaw = Math.atan2(end[0] - p0[0], end[2] - p0[2]), far: V = [p0[0] + Math.sin(yaw) * LINE_M, 0, p0[2] + Math.cos(yaw) * LINE_M], back = yaw + Math.PI, mid: V = [(p0[0] + far[0]) / 2, 0, (p0[2] + far[2]) / 2];
      A.men.forEach((x, i) => { if (i > 0) put(x, [p0[0] - Math.sin(yaw) * (1.2 * i), 0, p0[2] - Math.cos(yaw) * (1.2 * i)], yaw); });   // the others in file behind him: he is the gun in front
      put(m, p0, yaw); const refused = A.O.give('cover', A.O.targetAt(far), 'all');   // ('cover that way': each from where he stands, his eyes down the run)
      const pin = () => { put(h, far, aware ? back : yaw); h.hold = true; if (aware) { h.state = 'alert'; h.awareness = 1; } else { h.state = 'patrol'; h.awareness = 0; } h.weapon && (h.weapon.cooldown = 9); h.visibility = 1; };   // (he stands in light: the frozen stand's teammates have no goggles to find him in the warehouse's dark)
      let on1 = 0, gap = 9, restGap = 0, sigM = 0, read = 0, rounds = 0, early = 0;
      let lat = 0; const each = () => { const c = m.char, a = c.bones.handL, b = c.bones.handR; if (a && b) gap = Math.max(gap === 9 ? 0 : gap, d3(a, b)); if (a) lat = Math.max(lat, Math.abs((a[0] - c.pos[0]) * Math.cos(c.bodyYaw) - (a[2] - c.pos[2]) * Math.sin(c.bodyYaw))); if (c.anim.signalling) sigM++; if (showWhyOf(g, m) === 'line') read++; if (A.men.some(x => A.said(x) === SHOWWHY_LINES.line)) on1++; };   // (one voice: whichever of the masked men has it up)
      { const off: V = [p0[0] - Math.sin(yaw) * 3 + Math.cos(yaw) * 2, 0, p0[2] - Math.cos(yaw) * 3 - Math.sin(yaw) * 2]; g.teleportPlayer(g.col.nav.isBlocked(off[0], off[2]) ? [p0[0] - Math.sin(yaw) * 5, 0, p0[2] - Math.cos(yaw) * 5] : off); }   // (the player behind them, out of every line, while they find him)
      for (let i = 0; i < 60; i++) { pin(); A.step(1, () => { if (A.men.some(x => A.said(x) === SHOWWHY_LINES.line)) early++; }); } { const c = m.char; if (c.bones.handL && c.bones.handR) restGap = d3(c.bones.handL, c.bones.handR); } gap = 9;
      const shots0 = g.fight.stats.opRounds;
      for (let i = 0; i < 7 * 60; i++) { pin(); g.teleportPlayer(mid); A.step(1, each); }
      rounds = g.fight.stats.opRounds - shots0;
      const all = A.notes().filter(n => n.why === 'line'), N = all.filter(n => n.who === m.callsign), still = A.men.some(x => A.said(x) === SHOWWHY_LINES.line), voices = all.filter(n => n.line).map(n => n.who), wavers = new Set(all.filter(n => n.signal === 'aside').map(n => n.who)).size, tgt = g.fight.opOf(m)?.tgt === h, lineT = g.fight.opOf(m)?.lineT ?? 0;
      const aside: V = [mid[0] + Math.cos(yaw) * 3.5, 0, mid[2] - Math.sin(yaw) * 3.5]; g.teleportPlayer(g.col.nav.isBlocked(aside[0], aside[2]) ? [mid[0] - Math.cos(yaw) * 3.5, 0, mid[2] + Math.sin(yaw) * 3.5] : aside);
      h.god = true; let gone = -1, n0 = A.notes().length; const shots1 = g.fight.stats.opRounds; for (let i = 0; i < 4 * 60; i++) { pin(); A.step(); if (gone < 0 && !A.men.some(x => A.said(x) === SHOWWHY_LINES.line || showWhyOf(g, x) === 'line')) gone = i / 60; }
      return { A, m, refused, lat, early, free: g.fight.stats.opRounds - shots1, bare: bare(g), N, still, on1, gap, restGap, sigM, read, rounds, tgt, lineT, gone, later: A.notes().slice(n0).filter(n => n.why === 'line').length, voices, wavers, all: all.length };
    };
    if (want('line')) {
      const L = await linePlay(true, true), waves = L.N.filter(n => n.signal === 'aside').length, lines = L.voices.length; kept.line = { bare: L.bare, notes: L.A.notes().length };
      verdict(L.tgt && L.early === 0 && waves >= 2 && L.wavers === 1 && lines >= 1 && lines <= 2 && L.voices.every(v => v === L.m.callsign) && L.still && L.on1 > 240 && L.gap - L.restGap > 0.1 && L.lat > 0.45 && L.sigM > 60 && L.read > 240 && L.gone >= 0 && L.gone < 2.5 && L.later === 0,
        'line — the player between the squad and the defender the front man\'s gun is on: that man alone waves him off, "you\'re in my line." stands while it is true, and goes when it is not',
        `his gun on the defender: ${L.tgt} (round held ${L.lineT.toFixed(1)} s, ${L.rounds} rounds from the team meanwhile) · ${L.early} frames the line was up before the player stepped in · ${waves} waves from him, ${L.wavers} of the four waved (three stand in file behind him: they wait on him) · the line said ${lines}× (${[...new Set(L.voices)].join(', ') || 'nobody'}), up ${L.on1} of 420 frames and still at the end: ${L.still} · his hands ${L.restGap.toFixed(2)} m apart at rest, ${L.gap.toFixed(2)} m at the widest of a wave, the wrist ${L.lat.toFixed(2)} m out to the side of his spine (${L.sigM} frames signalling) · read as 'line' ${L.read} frames · the player out of the line: gone in ${L.gone < 0 ? 'never' : L.gone.toFixed(2) + ' s'}, ${L.later} notes in the four seconds after (${L.free} rounds from the team in them)`);
    }
    if (want('quiet')) {
      const L = await linePlay(true, false);
      verdict(L.tgt && L.lineT > 0 && L.all === 0 && L.on1 === 0 && L.read === 0,
        'quiet — the same with the defender unaware and the squad\'s fire held: no wave and no line (no round was wanted, so none is masked)',
        `his gun on the defender: ${L.tgt} (round held ${L.lineT.toFixed(1)} s, ${L.rounds} rounds) · ${L.all} notes, the line up ${L.on1} frames, read as 'line' ${L.read} frames`);
    }

    // ---- hurt
    if (want('hurt')) {
      const A = await rig(true), g = A.g; CONDITION.on = true;
      const s0: V = [...g.player.char.pos] as V; A.O.give('fallIn', { kind: 'none', at: [s0[0], 0, s0[2]] }, 'all'); A.step(90);
      const m = A.men[1] ?? A.men[0]; m.god = false; const got = conditionHurt(g, m); m.god = true;   // (the debugger's own 'kept whole' is never hurt: lifted for the blast alone)
      let hunch = 0, read = 0; A.step(6 * 60, () => { CONDITION.on = true; if (m.char.anim.hurt === 1) hunch++; if (showWhyOf(g, m) === 'hurt') read++; });
      const N1 = [...A.notes()], hit = N1.filter(n => n.line === SHOWWHY_LINES.hurt), n1 = N1.length;
      // the player runs off under his own keys: Shift held, down the longest way the floor gives from where he stands
      let way: V[] | null = null, wl = 0;
      for (const d of g.doors.list) for (const side of [1, -1] as const) { const F = stackRoomProbe(g, d, side); if (!F.floor) continue; const to = (F.spots(2, 4) as V[])[0]; if (!to) continue;
        const pth = g.col.nav.findPath(g.player.char.pos, to, 6000) as V[] | null; if (!pth?.length) continue; let L = 0; for (let i = 1; i < pth.length; i++) L += flat(pth[i - 1], pth[i]); if (L > wl) { wl = L; way = pth; } }
      const far = way && wl >= 12 ? way : null, I = A.W.input; let top = 0, i = 0, gapMax = 0;
      if (far) for (let f = 0; f < 7 * 60 && i < far.length; f++) { const pos = g.player.char.pos; while (i < far.length && flat(pos, far[i]) < 0.7) i++; if (i >= far.length) break;
        const p = far[i], dx = p[0] - pos[0], dz = p[2] - pos[2], d = Math.hypot(dx, dz) || 1, { fwd, right } = A.W.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k); if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); I.keys.add('ShiftLeft');
        A.step(1, () => { CONDITION.on = true; top = Math.max(top, Math.hypot(g.player.char.vel[0], g.player.char.vel[2])); gapMax = Math.max(gapMax, flat(m.char.pos, g.player.char.pos)); }); }
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) I.keys.delete(k); A.step(60, () => { CONDITION.on = true; });
      const N2 = A.notes().slice(n1), lag = N2.filter(n => n.line === SHOWWHY_LINES.lag);
      verdict(got && hit.length === 1 && hit[0].who === m.callsign && N1.every(n => n.who === m.callsign) && hunch > 300 && read > 300 && (!far || (lag.length === 1 && lag[0].who === m.callsign)),
        'hurt — a blast that leaves a man standing: "I\'m hit." once, from him alone, the hunch on his figure; left behind by a running player, "I can\'t keep up." once',
        `hurt: ${got} · "${SHOWWHY_LINES.hurt}" ${hit.length}× (${hit.map(n => n.who).join(', ') || 'nobody'}), ${N1.length} notes in six seconds, all his: ${N1.every(n => n.who === m.callsign)} · the hunch on him ${hunch} of 360 frames, read as 'hurt' ${read} · ${far ? `the player ran off (top ${top.toFixed(1)} m/s, ${gapMax.toFixed(1)} m ahead of him at the most): "${SHOWWHY_LINES.lag}" ${lag.length}×` : 'no way of twelve metres to run off down (not judged)'}`);
    }

    // ---- keep, door: a room taken by 'open and clear'
    const entry = async (on: boolean, skip: number) => {
      const A = await rig(on), g = A.g; REARWATCH.room = true; const Fc = face(A, skip); if (!Fc) return null;
      if (A.O.give('openClear', { kind: 'door', door: Fc.d, side: Fc.side, at: [Fc.d.frameCentre[0], 0, Fc.d.frameCentre[2]] }, 'all')) return { A, Fc, ok: false };
      for (let i = 0; i < 25 * 60; i++) { A.step(1, () => { REARWATCH.room = true; }); if (i > 120 && !g.doorTools.ops.length) break; }
      A.step(30); return { A, Fc, ok: true };
    };
    if (want('keep')) {
      let done = false, tried = 0;
      for (let skip = 0; skip < 8 && !done; skip++) {
        const X = await entry(true, skip); if (!X) break; if (!X.ok) continue; tried++;
        const { A, Fc } = X, g = A.g, d = Fc.d, c = d.frameCentre as V, keepers: [any, any, any][] = g.doorTools.doorKeepers(); if (!keepers.length) continue;
        const room = g.fight.roomAt(keepers[0][0].char.pos); if (!room) continue;
        const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
        const inside = ([1.6, 2.2, 1.1].flatMap(k => [[c[0] + nx * k, 0, c[2] + nz * k], [c[0] - nx * k, 0, c[2] - nz * k]]) as V[]).filter(p => sideOf(d, p) !== Fc.side && g.fight.roomAt(p) === room).map(p => ({ p, r: Math.min(...A.men.map(x => flat(x.char.pos, p))) })).filter(x => x.r >= 1.2).sort((a, b) => b.r - a.r)[0]?.p;
        if (!inside) continue;
        const near = keepers.find(k => g.fight.roomAt(k[0].char.pos) === room && flat(k[0].char.pos, inside) <= REARWATCH.roomM - 1); if (!near) continue;
        const m = near[0], n0 = A.notes().length;
        g.teleportPlayer([inside[0], 0, inside[2]]); A.step(2); A.O.give('fallIn', A.O.targetAt(g.player.char.pos), 'all');
        let kept = 0, read = 0; A.step(6 * 60, () => { REARWATCH.room = true; if (roomKept(g, m)) { kept++; if (showWhyOf(g, m) === 'keep') read++; } });
        if (kept < 60) continue;   // (not kept after all: another face)
        const N = A.notes().slice(n0), mine = N.filter(n => n.line === SHOWWHY_LINES.keep), keepersNow = new Set(keepers.map(k => k[0].callsign)), apart = mine.length > 1 ? Math.min(...mine.slice(1).map((n, i) => n.t - mine[i].t)) : Infinity;
        verdict(mine.filter(n => n.who === m.callsign).length === 1 && mine.every(n => keepersNow.has(n.who)) && new Set(mine.map(n => n.who)).size === mine.length && apart >= 1.4 && read === kept,
          'keep — the man kept on a taken room\'s far door after \'fall in\' says "I\'ve got this door." once (two keepers: one after the other, never together), and reads \'keep\' while he is kept',
          `in by ${d.def.name}, ${m.callsign} on ${near[1].def.name}: kept ${kept} of 360 frames, read as 'keep' ${read} · the line ${mine.length}× (${mine.map(n => `${n.who} at ${n.t.toFixed(1)} s`).join(', ') || 'nobody'}) · ${N.length} notes in all`);
        done = true;
      }
      if (!done) verdict(false, 'keep — the man kept on a taken room\'s far door says so', `no room with another door held and a man kept on it was found (${tried} entries played)`);
    }
    if (want('door')) {
      let done = false, tried = 0;
      for (let skip = 0; skip < 6 && !done; skip++) {
        const X = await entry(true, skip); if (!X) break; if (!X.ok) continue;
        const { A, Fc } = X, g = A.g, d = Fc.d, c = d.frameCentre as V;
        const inMen = A.men.filter(m => sideOf(d, m.char.pos) !== Fc.side); if (inMen.length < 2) continue; tried++;
        DOORMANNERS.on = true;   // (the doorway's own hold: the frozen stand has it off)
        const n0 = A.notes().length; g.teleportPlayer([c[0], 0, c[2]]); A.step(2, () => { DOORMANNERS.on = true; });
        const sent = A.O.give('move', A.O.targetAt(Fc.out), 'all'); if (sent) continue;
        for (let i = 0; i < 12 * 60; i++) { g.teleportPlayer([c[0], 0, c[2]]); A.step(1, () => { DOORMANNERS.on = true; }); }
        const N = A.notes().slice(n0), fists = N.filter(n => n.why === 'door' && n.signal === 'go'), words = N.filter(n => n.line === SHOWWHY_LINES.door);
        if (!fists.length) continue;   // (nobody's walk was held at it on this face: another)
        verdict(fists.length >= 1 && words.length === 1 && fists.some(n => n.who === words[0].who),
          'door — the player stood in the doorway the squad is sent out through: a man held at it points the way, and "after you." is said once for the whole squad',
          `out by ${d.def.name}: the way shown ${fists.length}× (${[...new Set(fists.map(n => n.who))].join(', ')}), "${SHOWWHY_LINES.door}" ${words.length}× (${words.map(n => n.who).join(', ') || 'nobody'}) in twelve seconds`);
        done = true;
      }
      if (!done) verdict(false, 'door — a man held at a doorway the player stands in shows it', `no entry left men whose way out was held at the player's doorway (${tried} tried)`);
    }

    // ---- off, and same: the two stagings with the switch off, and against their runs with it on
    if (want('off') || want('same')) {
      const S = await stackPlay(false), T = showWhyStats(S.A.g), any = S.A.men.some(m => MINE.has(m.bubble?.text ?? ''));
      const L = await linePlay(false, true), T2 = showWhyStats(L.A.g);
      if (want('off')) verdict(!S.A.sw && S.A.stood === false && !!S.op && S.A.notes().length === 0 && S.sigWait === 0 && !any && T.holds === 0 && L.all === 0 && L.on1 === 0 && L.sigM === 0 && T2.waves + T2.lines === 0 && L.tgt,
        'off — the stack and the line staged with the switch off: no signal, no line, nothing counted',
        `the stand stood the switch ${S.A.stood ? 'on' : 'off'} · the stack ${S.op ? 'waited on the word' : 'was never made'}: ${S.A.notes().length} notes, ${S.sigWait} frames a hand signalled while it waited, ${T.holds} waits counted · the line (his gun on the defender: ${L.tgt}, round held ${L.lineT.toFixed(1)} s): ${L.all} notes, up ${L.on1} frames, ${L.sigM} frames signalling`);
      if (want('same')) { if (!kept.stack) { const X = await stackPlay(true); kept.stack = { bare: X.bare, notes: X.A.notes().length }; } if (!kept.line) { const X = await linePlay(true, true); kept.line = { bare: X.bare, notes: X.A.notes().length }; }
        const S1 = kept.stack, L1 = kept.line, shown = S1.notes + L1.notes;
        verdict(shown > 0 && S1.bare === S.bare && L1.bare === L.bare,
          'same — the stack\'s run (through the wait, the word and the entry) and the line\'s, on against off: with what is over the men\'s heads left out, the digests are equal',
          `${shown} notes shown with it on · the stack ${S1.bare} against ${S.bare} · the line ${L1.bare} against ${L.bare} (every man's place, facing, state and gun, the rounds, the doors: the rule moved none of it)`); }
    }

    // ---- old
    if (want('old')) {
      const A = await rig(true);
      SHOWWHY.on = true; const k = (J as any).knobsSnapshot(A.g); (J as any).applyKnobs(A.g, k); const kept = SHOWWHY.on;
      SHOWWHY.on = true; const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.SHOWWHY; (J as any).applyKnobs(A.g, k2); const none = SHOWWHY.on;
      verdict(kept === true && none === false, 'old — a recording from before the key replays with it off', `its own snapshot put back: ${kept ? 'on' : 'off'} · one without the table: ${none ? 'on' : 'off'}`);
    }
  } finally { SHOWWHY.on = was.on; CONDITION.on = was.cond; REARWATCH.room = was.room; HOLDFIRE.on = was.hf; DOORMANNERS.on = was.dm; Math.random = was.rnd; if (was.env === undefined) delete process.env.TPS_SHOWWHY; else process.env.TPS_SHOWWHY = was.env; }
  console.log(`\nshowwhy-check: ${checks - fails}/${checks} pass${BREAK ? ' (SHOWWHY_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const a = process.argv; const ok = await showWhyCheck({ verbose: a.includes('--verbose'), only: a.includes('--only') ? a[a.indexOf('--only') + 1] : undefined }); process.exit(ok ? 0 : 1); }
