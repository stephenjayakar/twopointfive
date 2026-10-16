// THE REAR MAN COVERS THE DOOR BEHIND (src/game/rearwatch.ts) — the check.
//
//   bun run tools/qa/rearwatch-check.ts [id …] [--max N] [--no-play] [--verbose]     (no id: every level a squad plays; exit 1 on a failure; on the SHIPPED stand unless TPS_PROFILE says frozen)
//
// Per level a squad plays (the defenders taken off the floor first), per door, per face with floor, and per OTHER door of that face's floor inside the rule's
// reach — that one door stood open, every other shut:
//   MARKS   the squad is given 'stack up' on the face and the rule is asked at once (nothing played): is there a way behind (rearWays), and is a man of the
//           stack pinned to it — or does no rear mark have a line to it ('no line': counted and printed, the rule's known gap; it moves no mark to get one).
//   PLAYED  (up to --max cases a level, default 6, spread over its doors; --no-play skips it) the men put on the face's floor, the stack walked up, a second
//           and a half waited, 'open and clear' given and played through. Sampled every frame: IS A GUN ON THE WAY BEHIND — a living man of the squad with
//           a line to it and his muzzle inside 0.35 rad of it. Two windows: WAIT (from the stack settled to the entry order) and THROUGH (from the entry order
//           until every other man of the entry is through the frame). With the rule on both must be covered 85 % of their frames (a pair: the wait alone —
//           it has no spare man once the door goes) and the rear man must be the last through; the same played with the rule off is the size of the flaw.
//           Counted beside it, from the stack order until the entry is through: every WATCH GIVEN AND TAKEN BACK INSIDE A SECOND with the man still up — the
//           rule's own (a rear watch; one that passes to another man on the same frame is a hand-over, counted apart) and the cover's deals in both arms.
//           A rear watch that short is a failure: the gun swings to the door behind and back for nothing.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// THE STAND: the game as the page ships it (src/host/profile.ts) unless the run names one. On the frozen stand the rule is held off and so are the door rules it
// was built beside (doors stay where they are left, one way, a man past an open leaf's edge): a door this check stands open swings to there, or wedges the man
// put beside it, and the case that was set is not the case that is played.
process.env.TPS_PROFILE ??= 'shipped';
if (process.env.TPS_PROFILE === 'frozen') { process.env.QA_DOORSTAY ??= '1'; process.env.ONEWAY ??= '1'; }   // (asked on the frozen stand, the check raises those door rules itself — four cases were red there for the staging alone; `QA_DOORSTAY=0 ONEWAY=0` = the frozen stand bare)
const { standUp, ROOT } = await import('./headless.ts');
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { REARWATCH, rearWays, rearWatchTick, rearPin, rearWatchLog, rearSees } = await import(`${ROOT}/src/game/rearwatch.ts`);
const { stackRoomProbe } = await import(`${ROOT}/src/game/stackroom.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

type V = [number, number, number];
const DT = 1 / 60, args = process.argv.slice(2), VERBOSE = args.includes('--verbose'), PLAY = !args.includes('--no-play');
const MAX = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 6, ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--max' && args[i - 1] !== '--case' && args[i - 1] !== '--order');
const FIRST = args.includes('--first') ? args[args.indexOf('--first') + 1] : '';   // (--first on|off: which arm plays first in every case, instead of taking turns)
const NEED = 0.85, AIM = 0.35, CASE = args.includes('--case') ? args[args.indexOf('--case') + 1] : '', ALONE = !args.includes('--in-turn'), ORDER = args.includes('--order') ? args[args.indexOf('--order') + 1] : 'openClear';   // (--order bangClear: the can first)   // (--case door:side:otherDoor — that one case alone, its walk-up and entry traced; with --in-turn every case is played and that one traced)
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), f1 = (p: V) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`, pc = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

async function stage(E: any, seed = 1) {
  Math.random = seeded(0xba46 + seed * 7919);
  const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); const g = W.game;
  g.godMode = true; g.playerInvisible = true;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`${E.id}: start refused — ${why}`);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(20);
  return { W, g, step };
}
const pt = (d: any, a: number, b: number, side: number): V => { const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), H = d.def.hinge; return [H[0] + ux * a - uz * side * b, 0, H[1] + uz * a + ux * side * b]; };
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };
const open = (d: any) => { const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); };

interface Tally { before: number; exposed: number; out: number; edge: number; faces: number; cases: number; noWay: number; noStack: number; pinned: number; noLine: number; played: number; waitOn: number; waitN: number; thruOn: number; thruN: number; last: number; entries: number; offWaitOn: number; offWaitN: number; offThruOn: number; offThruN: number; stuck: number; spoiled: number; waitLOn: number; waitLN: number; thruLOn: number; thruLN: number; noLineWait: number; noLineThru: number; pinShort: number; pinN: number; hop: number; jobShortOn: number; jobNOn: number; jobShortOff: number; jobNOff: number }
const playedLine = (T: Tally, big: boolean) => ` · played ${T.played}: a gun on the way behind, of all the wait ${pc(T.waitOn, T.waitN)} (rule off ${pc(T.offWaitOn, T.offWaitN)}), of the wait in which a rear man had a line to it ${pc(T.waitLOn, T.waitLN)}` +
  (big ? ` · of all the entry until the others are through ${pc(T.thruOn, T.thruN)} (rule off ${pc(T.offThruOn, T.offThruN)}), of the entry in which a rear man had a line to it ${pc(T.thruLOn, T.thruLN)} · rear man last in, or left outside on it, in ${T.last} of ${T.entries} entries (${T.out} outside)` : ' — a pair: both go in') +
  `${T.noLineWait ? ` · ${T.noLineWait} waits with no line from any rear mark` : ''}${T.noLineThru ? ` · ${T.noLineThru} entries with no line from any rear mark once the door went` : ''}${T.stuck ? ` · ${T.stuck} entries did not go through` : ''}${T.spoiled ? ` · ${T.spoiled} not judged (the walk up moved a door)` : ''}` +
  ` · given and taken back inside a second, from the stack order to the entry through: ${T.pinShort} of ${T.pinN} rear watches (${T.hop} more passed from one man to another) · of the cover's deals ${T.jobShortOn} of ${T.jobNOn} (rule off ${T.jobShortOff} of ${T.jobNOff})`;
const zero = (): Tally => ({ before: 0, exposed: 0, out: 0, edge: 0, faces: 0, cases: 0, noWay: 0, noStack: 0, pinned: 0, noLine: 0, played: 0, waitOn: 0, waitN: 0, thruOn: 0, thruN: 0, last: 0, entries: 0, offWaitOn: 0, offWaitN: 0, offThruOn: 0, offThruN: 0, stuck: 0, spoiled: 0, waitLOn: 0, waitLN: 0, thruLOn: 0, thruLN: 0, noLineWait: 0, noLineThru: 0, pinShort: 0, pinN: 0, hop: 0, jobShortOn: 0, jobNOn: 0, jobShortOff: 0, jobNOff: 0 });
const total = zero(), fails: string[] = [];

async function level(E: any): Promise<void> {
  let S: any; try { S = await hush(() => stage(E)); } catch (e) { fails.push(`${E.id}: did not start — ${e}`); console.log(`${E.id}: did not start — ${e}`); return; }
  const { g, step } = S, O = g.orders, nav = g.col.nav, T = zero();
  const men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 2) { console.log(`${E.id}: no squad of two or more`); return; }
  await hush(() => { for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true); step(30); });
  if (!O.active) { fails.push(`${E.id}: the orders are not live with the defenders down`); return; }
  const home: V = [...g.player.char.pos] as V, tag = E.id as string;
  const fail = (s: string) => { fails.push(`${tag} ${s}`); if (fails.length <= 200) console.log(`  FAIL ${tag} ${s}`); };
  const rest = async () => { await hush(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); step(2); }); };
  // (the point of the way a man can watch from where he is: the doorway itself, or — its open leaf standing between him and the frame — just past the leaf's free edge, as cover.ts has it)
  // (… a man already through the worked door, sweeping past it from inside, is not the stack's watch on it)
  const gunOn = (o: any, front: V, op: any = null) => men.some(m => { if (m.state === 'dead' || op?.crossed.has(m)) return false; const to = rearSees(g, m.char.pos, o, front) as V | null; return !!to && Math.abs(wrap(Math.atan2(to[0] - m.char.pos[0], to[2] - m.char.pos[2]) - m.char.aimYaw)) < AIM; });
  const put = (gd: any, p: V, face: V) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); };

  // (where the squad stands before the order: on the face's own floor, clear of every other door — a man put against a leaf shoves it open. The order
  //  stacks a squad on ITS side of a door, so a face is only ever stacked from its own floor)
  const spotsOf = (d: any, F: any): V[] => { const spots: V[] = []; for (const band of [[5, 14], [2, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length >= men.length) break; if (spots.some(q => flat(q, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); } return spots; };
  // (WATCHES GIVEN AND TAKEN BACK: per man the opening the rule has him pinned to and the one the cover has dealt him, frame by frame; a spell under SHORT
  //  seconds that ends with him still up is counted — a rear watch that goes to another man on the frame it leaves him is a hand-over)
  const SHORT = 1, watcher = (on: boolean, name: string) => { const pin = new Map<any, { id: string; t0: number }>(), job = new Map<any, { id: string; t0: number }>(); const c = { pinShort: 0, pinN: 0, hop: 0, jobShort: 0, jobN: 0, notes: [] as string[] };
    return { c, tick() { const pins = men.map(m => m.state === 'dead' ? null : rearPin(g, m)?.o.id ?? null);
      men.forEach((m, i) => { if (m.state === 'dead') { pin.delete(m); job.delete(m); return; }
        const J = g.cover.of(m), jid: string | null = J && !J.off ? J.o.id : null, pid = pins[i];
        for (const [book, id, isPin] of [[pin, pid, true], [job, jid, false]] as [Map<any, { id: string; t0: number }>, string | null, boolean][]) { const was = book.get(m); if (was?.id === id || (!was && !id)) continue;
          if (was) { const secs = g.time - was.t0, short = secs < SHORT - 1e-6; if (isPin) { c.pinN++; if (short) { if (pins.some((x, k) => k !== i && x === was.id)) c.hop++; else { c.pinShort++; c.notes.push(`${g.time.toFixed(2)} ${m.callsign} had ${was.id} for ${secs.toFixed(2)} s · ${(rearWatchLog(g) as string[]).slice(-2).join(' / ')}`); } } } else { c.jobN++; if (short) c.jobShort++; } }
          if (id) book.set(m, { id, t0: g.time }); else book.delete(m); } }); },
      end() { c.pinN += pin.size; c.jobN += job.size; if (VERBOSE && on) for (const n of c.notes) console.log(`    taken back inside a second (${name}): ${n}`); return c; } }; };
  // ---- MARKS: every face, every other door of its floor stood open alone
  const cases: { d: any; side: 1 | -1; o: any; front: V; who: string }[] = [];
  REARWATCH.on = true;
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    const F = stackRoomProbe(g, d, side); if (!F.floor) continue; T.faces++; const sp = spotsOf(d, F);
    for (const od of g.doors.list) { if (od === d || flat(od.frameCentre, d.frameCentre) > REARWATCH.reach + 3) continue;
      if (![1, -1].some(s => { const Q = stackRoomProbe(g, od, s as 1 | -1); return Q.floor && F.has(Q.seed as V); })) continue;
      for (const x of g.doors.list) shut(x); open(od); g.teleportPlayer(home); await rest(); if (sp.length >= men.length) { men.forEach((m, i) => { put(m, sp[i], d.frameCentre); g.cleared.mark(sp[i]); }); step(1); }   // (… and that floor is ground the team has been on: the order stacks a squad on the face it knows)
      const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')); const posts = men.map(m => O.of(m)?.post as V | null);
      if (why || posts.some(p => !p) || sideOf(d, posts[0]!) !== side) { T.noStack++; if (VERBOSE) console.log(`  no stack: ${tag} ${d.def.name}${side > 0 ? '+' : '−'} with ${od.def.name} open — ${why || (sp.length < men.length ? `only ${sp.length} places clear of the other doors to stand the squad on that floor` : 'the squad took the other face')}`); await rest(); continue; }
      T.cases++;
      const ways = rearWays(g, d, side, posts as V[]).filter((w: any) => w.o.door === od);
      if (!ways.length) { T.noWay++; if (VERBOSE) console.log(`  out of reach: ${tag} stack on ${d.def.name}${side > 0 ? '+' : '−'}, ${od.def.name} open — ${Math.min(...(posts as V[]).map(p => flat(p, od.frameCentre))).toFixed(1)} m from the nearest mark · marks ${(posts as V[]).map(f1).join(' ')}`); await rest(); continue; }
      rearWatchTick(g); const w = men.find(m => rearPin(g, m)?.o === ways[0].o);
      if (w) { T.pinned++; { const to = g.cover.sightFrom(O.of(w).post, ways[0].o); if (!to) T.before++; else if (to !== ways[0].o.at) T.edge++; } cases.push({ d, side, o: ways[0].o, front: ways[0].front, who: w.callsign }); }
      else { T.noLine++; const seen = men.filter(m => !!rearSees(g, O.of(m).post, ways[0].o, ways[0].front)); if (seen.length) T.exposed++;
        if (VERBOSE) console.log(`  no line${seen.length ? ` (but ${seen.map(m => m.callsign + (m === g.doorTools.ops[0]?.lead ? ' lead' : '')).join(', ')}'s mark sees it)` : ''}: ${tag} stack on ${d.def.name}${side > 0 ? '+' : '−'}, ${od.def.name} open behind — marks ${(posts as V[]).map(f1).join(' ')}`); }
      await rest(); }
  }
  // ---- PLAYED
  if (PLAY && cases.length) { const pick = cases.filter((_, i) => MAX >= cases.length || Math.floor(i * MAX / cases.length) !== Math.floor((i - 1) * MAX / cases.length));
    let turnN = 0;
    for (const C of pick) { const TR = !!CASE && CASE === `${C.d.def.name}:${C.side}:${C.o.door.def.name}`; if (CASE && !TR && ALONE) continue; const { d, side, o, front } = C, F = stackRoomProbe(g, d, side), w = d.def.width, K = O.knobs, name = `stack on ${d.def.name}${side > 0 ? '+' : '−'}, ${o.door.def.name} open behind`;
      const spots = spotsOf(d, F);
      if (spots.length < men.length) continue;
      // A LINE FROM A REAR MARK, asked apart from the rule's own book: on a waiting stack the men whose eyes the order leaves spare; once the door goes, the man
      // who had the watch — else the one of the file furthest from the door — while he is not the lead, the first man, or already sent in; and a man the
      // entry left outside on it. Where none of their marks has a line (the worked door's own leaf stands across it, the file the door tool made hugs a wall)
      // nobody CAN watch it from the stack: those frames are counted in the plain percentages and not in the verdict.
      const lineNow = (op: any, kept: string): boolean => { const live = men.filter(m => m.state !== 'dead' && O.of(m)?.post);
        const marks = live.map(m => (op?.post.get(m)?.pos ?? O.of(m).post) as V), w = (rearWays(g, d, side, marks) as any[]).find(x => x.o === o); if (!w) return false;
        let cand: any[];
        if (!op || ['stack', 'ready', 'place', 'standoff', 'armed'].includes(op.phase)) cand = live.filter(m => O.of(m).spare && (!op || !op.pod.has(m)));
        else { const out = live.filter(m => op.men.includes(m) && m !== op.lead && m !== op.first && !op.pod.has(m) && !op.crossed.has(m)), k = out.find(m => m.callsign === kept);
          cand = k ? [k] : out.sort((a, b) => flat(O.of(b).post, d.frameCentre) - flat(O.of(a).post, d.frameCentre)).slice(0, 1); }
        cand = cand.concat(live.filter(m => rearPin(g, m)?.out && !cand.includes(m)));
        return cand.some(m => !!rearSees(g, O.of(m).post, o, w.front) && !!rearSees(g, m.char.pos, o, w.front)); };   // (… and he has one from where he stands this frame: a man still walking to a mark the door tool has just moved passes whatever stands between, and a line from a mark by a corner is there on the mark and not a step short of it)
      type Res = { wait: [number, number]; thru: [number, number]; last: boolean; out: boolean; entered: boolean; who: string; waitWho: string; log: string[]; pinnedIn: boolean; early: boolean; waitL: [number, number]; thruL: [number, number]; w: { pinShort: number; pinN: number; hop: number; jobShort: number; jobN: number; notes: string[] } | null }; const res: Record<string, Res> = {};
      for (const on of (FIRST ? (FIRST === 'on' ? [true, false] : [false, true]) : turnN++ % 2 ? [false, true] : [true, false])) { REARWATCH.on = on;   // (the arms take turns to go first: the second plays in a world the first has walked — rooms known, doors swung)
        for (const x of g.doors.list) shut(x); open(o.door); await rest(); g.teleportPlayer(home); men.forEach((m, i) => { put(m, spots[i], d.frameCentre); g.cleared.mark(spots[i]); }); step(3);
        const R: Res = res[on ? 'on' : 'off'] = { wait: [0, 0], thru: [0, 0], last: false, out: false, entered: false, who: '', waitWho: '', log: [], pinnedIn: false, early: false, waitL: [0, 0], thruL: [0, 0], w: null }, WT = watcher(on, name), st = () => { step(1); WT.tick(); }; WT.tick();
        const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')); if (why || men.some(m => !O.of(m)?.post || sideOf(d, O.of(m).post) !== side)) { if (VERBOSE) console.log(`    not judged (${on ? 'on' : 'off'}): ${name} — ${why || 'the squad took the other face'}`); delete res[on ? 'on' : 'off']; continue; }   // (the squad took the other face: that face's own turn plays it)
        await hush(() => { let done = -1;
          for (let f = 0; f < 16 * 60; f++) { st(); if (TR && on && f % 12 === 0) console.error(`${g.time.toFixed(2)} walk-up · ${o.door.def.name} angle ${o.door.angle.toFixed(2)}${o.door.latched ? ' latched' : ''} · ${men.map(m => `${m.callsign} ${f1(m.char.pos)}→${O.of(m)?.post ? f1(O.of(m).post) : '—'}${O.of(m)?.spare ? ' SP' : ''} pin ${rearPin(g, m)?.o.id ?? '—'} job ${g.cover.of(m)?.o.id ?? '—'} sees ${O.of(m)?.post ? !!rearSees(g, O.of(m).post, o, front) : '?'}`).join(' · ')} · ways ${rearWays(g, d, side, men.map(m => O.of(m)?.post ?? m.char.pos)).map((x: any) => x.o.id).join(',')}`); if (men.every(m => { const p = O.of(m)?.post; return !!p && flat(m.char.pos, p) < 0.45; })) { if (done < 0) done = f; if (f > done + 45) break; } }
          for (let f = 0; f < 90; f++) { st(); const on1 = gunOn(o, front); R.wait[1]++; if (on1) R.wait[0]++; if (on && lineNow(g.doorTools.ops.find((x: any) => x.door === d) ?? null, '')) { R.waitL[1]++; if (on1) R.waitL[0]++; } } });
        if (g.doors.list.some((x: any) => x !== d && (x === o.door) !== (x.off || (!x.latched && Math.abs(x.angle) >= REARWATCH.ajar)))) { if (VERBOSE) console.log(`    not judged (${on ? 'on' : 'off'}): ${name} — the walk up moved ${g.doors.list.filter((x: any) => x !== d && (x === o.door) !== (x.off || (!x.latched && Math.abs(x.angle) >= REARWATCH.ajar))).map((x: any) => x.def.name).join(', ')}`); delete res[on ? 'on' : 'off']; if (on) T.spoiled++; await rest(); continue; }   // (the walk up pushed another door open, or this one to: not the case that was set)
        const pinned = men.find(m => rearPin(g, m)?.o === o); R.who = on ? pinned?.callsign ?? '' : res.on?.who ?? ''; R.waitWho = R.who;
        if (on && !pinned && VERBOSE) console.log(`    nobody pinned: ${men.map(m => `${m.callsign} ${f1(m.char.pos)}→${O.of(m)?.post ? f1(O.of(m).post) : '—'}${O.of(m)?.spare ? ' spare' : ''} job ${g.cover.of(m)?.o.id ?? '—'}`).join(' · ')} · ways ${rearWays(g, d, side, men.map(m => O.of(m)?.post ?? m.char.pos)).map((x: any) => x.o.id).join(', ') || 'none'} · ${rearWatchLog(g).slice(-3).join(' / ')}`);
        const why2 = await hush(() => O.give(ORDER, { kind: 'door', door: d, side }, 'all')); if (why2) { if (VERBOSE) console.log(`    not judged (${on ? 'on' : 'off'}): ${name} — ${ORDER} refused: ${why2}`); delete res[on ? 'on' : 'off']; await rest(); continue; }
        await hush(() => { let op: any = null, prev: any = null; const hadPod = new Set<any>();
          for (let f = 0; f < 30 * 60; f++) { st(); op ??= g.doorTools.ops.find((x: any) => x.door === d) ?? null; if (!op) { if (f > 30) break; continue; }   // (half a minute: the arm that plays second files on a door the first has already been through, and its walk to that file can take ten seconds)
            // (the rear man of the ENTRY: the door tools file the stack again behind the man who opens, and the watch goes to that file's rear man)
            if (TR && f % 6 === 0) console.error(`${on ? 'ON ' : 'OFF'} ${g.time.toFixed(2)} ${op.phase} lane ${op.lane?.gd.callsign ?? '—'}:${op.lane?.door?.def.name ?? '—'} first ${op.first?.callsign ?? '—'} lead ${op.lead.callsign} q ${op.queue.map((q: any) => q.gd.callsign).join(',')} · ${men.map(m => `${m.callsign}${op.pod.has(m) ? ' pod' : ''}${op.crossed.has(m) ? ' x' : ''}${O.of(m)?.spare ? ' SP' : ''} pin ${rearPin(g, m)?.o.id ?? '—'} job ${g.cover.of(m)?.o.id ?? '—'}${g.cover.of(m)?.off ? '(off)' : ''} d ${O.of(m)?.post ? flat(m.char.pos, O.of(m).post).toFixed(1) : '?'} aimΔ ${(() => { const to = rearSees(g, m.char.pos, o, front) as V | null; return to ? Math.abs(wrap(Math.atan2(to[0] - m.char.pos[0], to[2] - m.char.pos[2]) - m.char.aimYaw)).toFixed(2) : 'x'; })()} sees ${O.of(m)?.post ? !!rearSees(g, O.of(m).post, o, front) : '?'}${op.men.includes(m) ? '' : ' NOT-OP'}${O.of(m) === op.mine.get(m) ? '' : ' A-changed:' + (O.of(m)?.order ?? 'none')}${rearPin(g, m) && rearPin(g, m).A !== O.of(m) ? ' P.A-stale' : ''}`).join(' · ')}`);
            if (on) { const now = men.find(m => rearPin(g, m)?.op === op); if (now) R.who = now.callsign;
              if (men.some(m => rearPin(g, m)?.o === o)) R.pinnedIn = true;
              // (sent in off his watch: the man pinned a frame ago handed his point while others of the entry are still this side of the frame, before the hold's cap)
              if (REARWATCH.hold && prev && op.pod.has(prev) && !hadPod.has(prev) && op.phase === 'enter' && g.time - op.t0 < REARWATCH.holdSecs - 0.05 && op.men.some((m: any) => m !== prev && m.state !== 'dead' && !op.crossed.has(m))) R.early = true;
              for (const m of men) if (op.pod.has(m)) hadPod.add(m); prev = now ?? null; }
            if (!g.doorTools.ops.includes(op)) {
              // (the door tool has called the entry 'in' with men of it still on their way through the frame — a room looked over from the doorway, an entry at
              //  its cap: it went through, and who crosses last is read off the men themselves)
              if (op.beats.some((b: any) => b.what === 'in')) { R.entered = true; const rear = men.find(m => m.callsign === R.who);
                if (on && rear) { const inMen = men.filter(m => m.state !== 'dead' && op.pod.has(m)), xT = new Map<any, number>([...op.crossed.entries()]);
                  for (let k = 0; k < 8 * 60 && inMen.some(m => !xT.has(m)); k++) { step(1); for (const m of inMen) if (!xT.has(m) && sideOf(d, m.char.pos) !== side) xT.set(m, g.time); }
                  R.last = xT.has(rear) ? inMen.every(m => m === rear || (xT.get(m) ?? Infinity) <= xT.get(rear)!) : !op.pod.has(rear) && rearPin(g, rear)?.o === o;
                  R.out = !op.pod.has(rear); } }
              break; }
            // (THE WINDOW, the same for both arms: until every man of the entry but the last is through the frame — all of them, where it left a man outside)
            const left = op.men.filter((m: any) => m.state !== 'dead' && !op.crossed.has(m)), outside = men.filter(m => m.state !== 'dead' && !op.men.includes(m));
            if (left.length <= (outside.length ? 0 : 1) && op.crossed.size) { R.entered = true;
              const rear = men.find(m => m.callsign === R.who);
              if (on && rear) {   // (… and then the rear man himself: the last through — or the one the entry left outside for want of a point in the room, who keeps the way behind from there)
                for (let k = 0; k < 8 * 60 && g.doorTools.ops.includes(op) && op.men.includes(rear) && !op.crossed.has(rear); k++) step(1);
                R.last = op.crossed.has(rear) ? [...op.crossed.entries()].every(([m, t]: [any, number]) => m === rear || t <= op.crossed.get(rear)) : !op.men.includes(rear) && rearPin(g, rear)?.o === o;
                R.out = !op.crossed.has(rear); }
              break; }
            { const on1 = gunOn(o, front, op); R.thru[1]++; if (on1) R.thru[0]++; if (on && lineNow(op, R.who)) { R.thruL[1]++; if (on1) R.thruL[0]++; } } } });
        R.w = WT.end();
        R.log = (rearWatchLog(g) as string[]).slice(-6).concat((g.doorTools.log ?? []).slice(-14).map((x: any) => `${x.t.toFixed(1)} ${x.what}`)); await rest(); }
      REARWATCH.on = true;
      const A = res.on, B = res.off; if (!A || !B) continue; T.played++;
      T.waitOn += A.wait[0]; T.waitN += A.wait[1]; T.offWaitOn += B.wait[0]; T.offWaitN += B.wait[1];
      const big = men.length >= 3;
      if (A.w && B.w) { T.pinShort += A.w.pinShort; T.pinN += A.w.pinN; T.hop += A.w.hop; T.jobShortOn += A.w.jobShort; T.jobNOn += A.w.jobN; T.jobShortOff += B.w.jobShort; T.jobNOff += B.w.jobN; }
      T.waitLOn += A.waitL[0]; T.waitLN += A.waitL[1]; if (!A.waitL[1]) T.noLineWait++;
      if (A.entered) { T.entries++; if (big) { T.thruOn += A.thru[0]; T.thruN += A.thru[1]; T.offThruOn += B.thru[0]; T.offThruN += B.thru[1]; T.thruLOn += A.thruL[0]; T.thruLN += A.thruL[1]; if (!A.thruL[1]) T.noLineThru++; if (A.last) T.last++; if (A.out) T.out++; } } else T.stuck++;
      if (VERBOSE) console.log(`  ${tag} ${name}: rear ${A.who || '—'} · wait ${pc(A.wait[0], A.wait[1])} (off ${pc(B.wait[0], B.wait[1])}; with a line ${pc(A.waitL[0], A.waitL[1])} of ${A.waitL[1]} frames) · through ${pc(A.thru[0], A.thru[1])} (off ${pc(B.thru[0], B.thru[1])}; with a line ${pc(A.thruL[0], A.thruL[1])} of ${A.thruL[1]} frames) · ${A.entered ? (A.last ? (A.out ? 'he was left outside on it' : 'he went in last') : 'he did NOT go in last') : 'the entry did not go through'}`);
      // THE VERDICT: wherever a rear mark has a line to the way, a gun is on it — the wait, and (three men or more) the entry until the others are through;
      // and the man who had it through the entry is the last through the frame, or the one left outside on it
      const waitBad = A.waitL[1] > 0 && A.waitL[0] / A.waitL[1] < NEED, thruBad = big && A.entered && A.thruL[1] > 0 && A.thruL[0] / A.thruL[1] < NEED, lastBad = big && A.entered && A.early, stuckBad = !A.entered && B.entered;
      if (VERBOSE && (waitBad || thruBad || lastBad || stuckBad || A.w?.pinShort)) console.log(`    the rule's log: ${A.log.join(' / ')}`);
      if (waitBad) fail(`${name}: a rear mark had a line to it and a gun was on it ${pc(A.waitL[0], A.waitL[1])} of that part of the wait (all of the wait ${pc(A.wait[0], A.wait[1])}, rule off ${pc(B.wait[0], B.wait[1])})`);
      if (thruBad) fail(`${name}: a rear mark had a line to it and a gun was on it ${pc(A.thruL[0], A.thruL[1])} of that part of the entry (all of the entry ${pc(A.thru[0], A.thru[1])}, rule off ${pc(B.thru[0], B.thru[1])})`);
      if (lastBad) fail(`${name}: the rear man ${A.who} was sent in off his watch with others of the entry still outside`);
      if (A.w?.pinShort) fail(`${name}: ${A.w.pinShort} rear watch${A.w.pinShort > 1 ? 'es' : ''} given and taken back inside a second — ${A.w.notes.slice(0, 2).join(' | ')}`);
      if (stuckBad) fail(`${name}: the entry went through with the rule off and did not with it on`); }
  }
  for (const k of Object.keys(total) as (keyof Tally)[]) total[k] += T[k];
  console.log(`${tag} [${E.level ?? 'office.json'}], ${men.length} men: ${T.faces} faces · ${T.cases} stacks with another door of the floor open (${T.noStack} more the squad would not stack) · ${T.noWay} not a way behind (out of reach) · ${T.pinned} a man pinned (${T.edge} by the open leaf's edge, ${T.before} by the floor before the door) · ${T.noLine} no rear mark sees it (${T.exposed} of them in sight of a front mark, the rest out of the whole stack's sight)` +
    (PLAY ? playedLine(T, men.length >= 3) : ''));
  console.log(`TALLY ${JSON.stringify({ id: tag, men: men.length, ...T })}`);
}

const rows: any[] = (ALL_MISSIONS as any[]).filter(E => E.squad);
const pick = rows.filter(E => !ids.length || ids.includes(E.id)); if (!pick.length) { console.log(`no such level — ${rows.map(E => E.id).join(', ')}`); process.exit(2); }
for (const E of pick) await level(E);
const T = total;
console.log(`ALL: ${T.faces} faces · ${T.cases} stacks with another door of the floor open (${T.noStack} more the squad would not stack) · ${T.noWay} out of reach · ${T.pinned} pinned (${T.edge} by the open leaf's edge, ${T.before} by the floor before the door) · ${T.noLine} no rear mark sees it (${T.exposed} of them in sight of a front mark, the rest out of the whole stack's sight)` +
  (PLAY ? playedLine(T, true) : ''));
if (fails.length) { console.log(`=== rearwatch-check: ${fails.length} FAIL (${process.env.TPS_PROFILE} stand) ===`); process.exit(1); }
if (!T.pinned || (PLAY && (!T.played || !(T.waitLN + T.thruLN)))) { console.log(`=== rearwatch-check: NO VERDICT (${!T.pinned ? 'no stack with a way behind was found' : 'nothing played had a rear mark with a line to the way behind'}) ===`); process.exit(1); }
console.log(`=== rearwatch-check: ALL PASS (${process.env.TPS_PROFILE} stand) ===`); process.exit(0);
