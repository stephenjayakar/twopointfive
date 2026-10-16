// THE WALK UP TO A STACK ON AN OPEN DOOR (game/stackline.ts STACKLINE.on) — every door of every squad level, each face a squad can stack on, played with
// nobody shooting: the defenders are put down, the squad stood on that face's own floor a real walk from the door, the door stood OPEN and then SHUT,
// 'stack up' given, and the walk watched until every man is on his mark — once with the rule off, once with it on. The second arm plays in a world the first has walked, so two arms of the
// SAME rule differ by a hair (a stack at a shut door, where the rule does nothing, can form a second or two apart): the arms take turns to go first FACE BY
// FACE within each leaf state, and `--first on|off` plays every case in one order — a FAIL that follows the order and not the rule is that hair.
//   TPS_PROFILE=shipped bun run tools/qa/stackline-check.ts [level ids…] [--max N] [--face name] [--first on|off] [--verbose] [--knobs '{"ajar":0.9}']
//   (the shipped stand: the game as it ships, the rule flipped here; without it the frozen stand — the old game under the rule)
// What it counts, per level and arm, OVER THE WALK ONLY (a man on his mark is no longer counted — a mark in the door's line stays in it, and the rule does
// nothing about that): man-seconds walking, metres · man-seconds in the door's line and the floor on the men (m²·s) — NOT the rule's own
// test but the play-through watcher's (stackline-watch.ts cellsOnLine: cells of the floor beyond the door with a line through the opening to where each man
// stands, the leaves as they stand, every frame) · seconds until the stack has formed · stacks that never formed in 26 s (WAIT: long enough that a stack formed inside 16 s with the rule off is watched for the whole FORM_K × + FORM_S it is allowed with it on — at 16 s a stack that took 15.3 s without the rule and 17.5 s with it read as 'never') · men who stopped short of the
// mark first dealt them (arrived once, then seen further than SHORT_M from it as the walk ends — whether or not the order still calls them arrived) · walks that moved the leaf (its angle or its latch, against how it was stood).
// THE VERDICT (exit 1 on any; a case where the rule's arm did worse is PLAYED AGAIN three times, the arms the other way round and back, and only what it
// does worse in every one of the four plays counts — the totals keep the first play. Where one arm's walk moved the leaf and the other's did not, the two
// stacks formed at two different doors and only the leaf itself is judged: at a door whose open leaf stands across the file — the barracks' yard door —
// the men reach their marks only when a walker happens to shove it to, in either arm): with the rule on — no stack that forms with it off fails to form · none takes more than FORM_K × as long + FORM_S seconds ·
// no man stops short of his mark where the same man did not with it off and stood SHORT_MORE nearer it (man for man: a man shouldered off his mark in both arms, a few centimetres either side of the bar, is not the rule's), and no walk moves the leaf where with it off none did · no man who has reached his mark (within the rule's `onMark`)
// is then seen more than OVER_M further outside that ring, nor — his mark beside the opening — more than SPAN_M further into the opening's span, than with it off · over a level's OPEN doors the floor on the men (m²·s) is no more
// than with it off · at a SHUT door the rule keeps nobody at the pace (STACKLINE_STATS.paced does not move) · and a team in the silent posture is kept at
// the pace nowhere — played on each level at an open door where the same squad, not silent, WAS kept at it. NO VERDICT if nothing was paced or no silent
// team was played.
// exit 0 ALL PASS · 1 a FAIL / NO VERDICT · 2 no such level · STACKLINE_BREAK=1 in front = its red path (a man stood off his mark in the rule-on arm: must FAIL)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { STACKLINE, STACKLINE_STATS } = await import(`${ROOT}/src/game/stackline.ts`);
const { farFloor, cellsOnLine, LINE_CELL_M2, LINE_MIN_CELLS } = await import('./stackline-watch.ts');
const { stackRoomProbe } = await import(`${ROOT}/src/game/stackroom.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { frameOf } = await import(`${ROOT}/src/game/guards.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { SILENT, setSilent, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);

type V = [number, number, number];
const DT = 1 / 60, args = process.argv.slice(2), VERBOSE = args.includes('--verbose');
const MAX = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 0, OPT = ['--max', '--knobs', '--face', '--first'], ids = args.filter((a, i) => !a.startsWith('--') && !OPT.includes(args[i - 1]));
const FACE = args.includes('--face') ? args[args.indexOf('--face') + 1] : '', FIRST = args.includes('--first') ? args[args.indexOf('--first') + 1] : '';
if (args.includes('--knobs')) Object.assign(STACKLINE, JSON.parse(args[args.indexOf('--knobs') + 1]));   // (--knobs: the rule's own table for this run)
const FORM_K = 1.5, FORM_S = 2, WAIT = 26, SHORT_M = 0.45, LEAF_RAD = 0.1, TAIL = 30, OVER_M = 0.1, SPAN_M = 0.05, AGAIN = 3, SHORT_MORE = 0.25, SHOVE_M = 0.7;
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
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
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };
const open = (d: any) => { const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); };

interface Arm { cases: number; walk: number; secs: number; m2s: number; form: number; formed: number; never: number; m: number; short: number; leaf: number; over: number; span: number }
const arm = (): Arm => ({ cases: 0, walk: 0, secs: 0, m2s: 0, form: 0, formed: 0, never: 0, m: 0, short: 0, leaf: 0, over: 0, span: 0 });
interface Pair { off: Arm; on: Arm; both: number }
type Tally = { open: Pair; shut: Pair; paced: number; slow: number; again: number; hair: number };
const zero = (): Tally => ({ open: { off: arm(), on: arm(), both: 0 }, shut: { off: arm(), on: arm(), both: 0 }, paced: 0, slow: 0, again: 0, hair: 0 });
const total = zero(), fails: string[] = []; let silentChecked = 0;
const line = (name: string, A: Pair) => `  ${name}: ${A.on.cases} stacks · in the line ${f1(A.off.secs)} → ${f1(A.on.secs)} man-s (${Math.round(A.off.m2s)} → ${Math.round(A.on.m2s)} m²·s${A.off.m2s ? `, ${Math.round(100 * (A.on.m2s / A.off.m2s - 1))} %` : ''}) · walked ${f1(A.off.m)} → ${f1(A.on.m)} m in ${f1(A.off.walk)} → ${f1(A.on.walk)} man-s · formed ${A.off.formed} → ${A.on.formed}, mean of those both formed ${A.off.form && A.on.cases ? f2(A.off.form / Math.max(1, A.both)) : '—'} → ${A.on.form ? f2(A.on.form / Math.max(1, A.both)) : '—'} s · never ${A.off.never} → ${A.on.never} · men stopped short ${A.off.short} → ${A.on.short} · walks that moved the leaf ${A.off.leaf} → ${A.on.leaf} · furthest outside the on-mark ring a man was seen after reaching it ${f2(A.off.over)} → ${f2(A.on.over)} m, furthest into the opening's span from a mark beside it ${f2(A.off.span)} → ${f2(A.on.span)} m`;

async function level(E: any): Promise<void> {
  let S: any; try { S = await hush(() => stage(E)); } catch (e) { fails.push(`${E.id}: did not start — ${e}`); console.log(`${E.id}: did not start — ${e}`); return; }
  const { g, step } = S, O = g.orders, T = zero(), tag = E.id as string;
  const men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 2) { console.log(`${tag}: no squad of two or more`); return; }
  await hush(() => { for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true); step(30); });
  if (!O.active) { fails.push(`${tag}: the orders are not live with the defenders down`); return; }
  const home: V = [...g.player.char.pos] as V, wasSilent = squadSilent(g);
  const fail = (s: string) => { fails.push(`${tag} ${s}`); if (fails.length <= 60) console.log(`  FAIL ${tag} ${s}`); };
  const rest = async () => { await hush(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); step(2); }); };
  const put = (gd: any, p: V, face: V) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); };
  // (where the squad stands before the order: on the face's own floor, a real walk from the door — 4.5 to 8 m of steps where the floor has that —, clear of every other door — a man put against a leaf shoves it open)
  const spotsOf = (d: any, F: any): V[] => { const spots: V[] = []; for (const band of [[9, 16], [5, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length >= men.length) break; if (spots.some(q => flat(q, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); } return spots; };
  const faces: { d: any; side: 1 | -1; spots: V[] }[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) { const F = stackRoomProbe(g, d, side); if (!F.floor) continue; const sp = spotsOf(d, F); if (sp.length >= men.length) faces.push({ d, side, spots: sp }); }
  const pick = faces.filter(C => !FACE || `${C.d.def.name}${C.side > 0 ? '+' : '−'}` === FACE || C.d.def.name === FACE).filter((_, i, a) => !MAX || MAX >= a.length || Math.floor(i * MAX / a.length) !== Math.floor((i - 1) * MAX / a.length));
  let silentAt: (typeof pick)[number] | null = null;
  const stoodOpen = (d: any) => !!d.off || (!d.latched && Math.abs(d.angle) >= STACKLINE.ajar);
  type Res = { walk: number; secs: number; m2s: number; form: number | null; m: number; short: number; gaps: number[]; shorts: boolean[]; leaf: boolean; paced: number; over: number; span: number };
  // ONE CASE, both arms in the order asked: null if the squad would not stack on that face
  const play = async (C: (typeof pick)[number], leaf: 'open' | 'shut', onFirst: boolean): Promise<{ off: Res; on: Res } | null> => { const { d, side, spots } = C, far = farFloor(g, d, side) as number[][], res: Partial<Record<'on' | 'off', Res>> = {};
    for (const on of (onFirst ? [true, false] : [false, true])) { STACKLINE.on = on;
      for (const x of g.doors.list) shut(x); if (leaf === 'open') open(d); await rest(); g.teleportPlayer(home); men.forEach((m, i) => { put(m, spots[i], d.frameCentre); g.cleared.mark(spots[i]); }); step(3);
      const paced0 = STACKLINE_STATS.paced, a0 = d.angle as number, l0 = !!d.latched;
      const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')); if (why || men.some(m => !O.of(m)?.post || sideOf(d, O.of(m).post) !== side)) { if (VERBOSE) console.log(`  not judged: ${tag} ${d.def.name}${side > 0 ? '+' : '−'} ${leaf} — ${why || 'the squad took the other face'}`); STACKLINE.on = true; return null; }
      const R: Res = res[on ? 'on' : 'off'] = { walk: 0, secs: 0, m2s: 0, form: null, m: 0, short: 0, gaps: [], shorts: [], leaf: false, paced: 0, over: 0, span: 0 }, there = new Set<any>(), was = new Map<any, V>(men.map(m => [m, [...m.char.pos] as V]));
      const dealt = new Map<any, V>(men.map(m => [m, [...O.of(m).post] as V]));   // (the marks as first dealt: a man who cannot get to his has it moved to where he stands — orders.ts 'stopped short' — and is then 'arrived')
      // OVERSHOOT: once a man has been within the rule's `onMark` of his mark, how far outside that ring he is seen again, and — his mark beside the opening, not in
      // front of it — how far into the opening's span (0 = never past the jamb line). The mark is the one his order holds NOW: a mark dealt again (the room
      // fit, the rear watch, 'stopped short') starts him over — walking to a new mark is no overshoot. Watched to the end of the walk and TAIL frames after
      // … and it is HIS OWN overshoot that is read: a man on his mark whom a mate still walking up comes shoulder to shoulder with (SHOVE_M) is SHOVED, and how
      // far a shove carries him is not this reading's — the killhouse's back door: Blue One's mark is past Red Two's down the wall, and he walks through him in
      // both arms; with the rule off Red Two never gets nearer than 0.38 m (so never 'reached' it: 0.00) and his mark comes to him 0.42 m off the wall, with it
      // on he is on it (0.28 m) and is put 0.52 m off, to step back. A shoved man is still read man for man by the stopped-short line below
      const F = frameOf(d), spanOf = (p: V) => { const a = (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz; return a > 0 && a < F.W ? Math.min(a, F.W - a) : 0; }, reached = new Map<any, V>(), shoved = new Set<any>();
      const walking = (x: any) => { const A = O.of(x); return !!A?.post && !A.arrived && Math.hypot(x.char.vel[0], x.char.vel[2]) > 0.3; };
      const track = () => { for (const m of men) { const post = O.of(m)?.post as V | undefined, p = m.char.pos as V; if (!post) { reached.delete(m); shoved.delete(m); continue; }
        const at = reached.get(m); if (at && flat(at, post) > 0.05) { reached.delete(m); shoved.delete(m); }
        const k = flat(p, post); if (k < STACKLINE.onMark && !reached.has(m)) reached.set(m, [...post] as V); if (!reached.has(m)) continue;
        if (men.some(x => x !== m && flat(x.char.pos, p) < SHOVE_M && walking(x))) shoved.add(m);
        if (!shoved.has(m)) R.over = Math.max(R.over, k - STACKLINE.onMark); if (!spanOf(post)) R.span = Math.max(R.span, spanOf(p)); } };
      await hush(() => { for (let f = 0; f < WAIT * 60 && there.size < men.length; f++) { step(1); track();
        for (const m of men) { if (there.has(m)) continue; const A = O.of(m); if (!A?.post || A.arrived) { there.add(m); continue; }
          const p = m.char.pos as V, q = was.get(m)!; R.m += flat(p, q); q[0] = p[0]; q[2] = p[2]; R.walk += DT;
          const cells = cellsOnLine(g, d, far, p)[0]; if (cells >= LINE_MIN_CELLS) { R.secs += DT; R.m2s += cells * LINE_CELL_M2 * DT; } }
        if (there.size === men.length) R.form = (f + 1) * DT; } });
      if (process.env.STACKLINE_BREAK && on && leaf === 'open') { const m = men.find(x => there.has(x) && O.of(x)?.post); if (m) { const q = dealt.get(m)!; put(m, [q[0] + SHORT_M + SHORT_MORE + 0.2, 0, q[2]], d.frameCentre); } }   // (the red path: STACKLINE_BREAK=1 stands a man who reached his mark well off it in the rule-on arm — the check must FAIL)
      R.gaps = men.map(m => flat(m.char.pos, dealt.get(m)!));   // (each man, in the order's own order — the same men in both arms — and how far he stands from the mark first dealt him)
      R.shorts = men.map((m, i) => { const A = O.of(m); return !A?.post || A.there === 'stopped short' || R.gaps[i] > SHORT_M && (A.arrived || there.has(m)); }); R.short = R.shorts.filter(Boolean).length;   // (a man who HAS arrived and is off the mark first dealt him counts whether or not his order calls him arrived this frame: shouldered off it after arriving, he is 'not arrived' again for as long as he is walking back)
      R.leaf = Math.abs(d.angle - a0) > LEAF_RAD || !!d.latched !== l0 || (leaf === 'open') !== stoodOpen(d); R.paced = STACKLINE_STATS.paced - paced0;
      await hush(() => { for (let f = 0; f < TAIL; f++) { step(1); track(); } });   // (the overshoot alone is watched on: everything above is read as the walk ends, as it always was)
    }
    STACKLINE.on = true; return res as { off: Res; on: Res };
  };
  // what the rule's arm did worse than the other, by kind (the claims a second arm in a walked world can throw by itself — see the head comment)
  const worse = (r: { off: Res; on: Res }): Record<string, string> => { const w: Record<string, string> = {};
    if (r.on.leaf && !r.off.leaf) w.leaf = 'the walk up moved the leaf with the rule on and not with it off';
    if (r.on.leaf !== r.off.leaf) return w;   // (one arm's walk moved the leaf and the other's did not: the two stacks formed at two different doors — a leaf shoved to lets a file past it that an open one stands across — so only the leaf itself is judged)
    if (r.off.form !== null && r.on.form === null && r.off.form * FORM_K + FORM_S <= WAIT) w.never = `the stack forms in ${f1(r.off.form)} s with the rule off and not in ${WAIT} s with it on`;
    else if (r.off.form !== null && r.on.form !== null && r.on.form > r.off.form * FORM_K + FORM_S) w.slow = `the stack takes ${f1(r.on.form)} s to form with the rule on, ${f1(r.off.form)} s with it off`;
    // (MAN FOR MAN: a man short with the rule on counts where the same man was not short with it off AND stood SHORT_MORE nearer his mark then. A man a mate
    //  walking down the wall shoulders off his mark is off it in both arms — 0.41 m and 0.48 m at the depot's east corridor door, 0.37 m and 0.50 m at the
    //  consulate's kitchen door — and the SHORT_M bar fell between the two; the totals below still count every man over the bar, each arm by itself)
    const more = r.on.shorts.filter((sh, i) => sh && !r.off.shorts[i] && r.on.gaps[i] - r.off.gaps[i] > SHORT_MORE).length;
    if (more) w.short = `${more} men stopped short of the marks first dealt them with the rule on and not with it off, each more than ${SHORT_MORE} m further from his mark than with it off`;
    if (r.on.over > r.off.over + OVER_M) w.over = `a man who had reached his mark was seen ${f2(r.on.over)} m outside its ring again with the rule on, ${f2(r.off.over)} m with it off`;
    if (r.on.span > r.off.span + SPAN_M) w.span = `a man whose mark is beside the opening went ${f2(r.on.span)} m into its span after reaching it with the rule on, ${f2(r.off.span)} m with it off`;
    return w; };
  for (const [fi, C] of pick.entries()) for (const [li, leaf] of (['open', 'shut'] as const).entries()) { const { d, side } = C, name = `${d.def.name}${side > 0 ? '+' : '−'} ${leaf}`;
    const onFirst = FIRST ? FIRST !== 'off' : (fi + li) % 2 === 0, res = await play(C, leaf, onFirst); if (!res) continue;
    for (const k of ['off', 'on'] as const) { const A = T[leaf][k], R = res[k]; A.cases++; A.walk += R.walk; A.secs += R.secs; A.m2s += R.m2s; A.m += R.m; A.short += R.short; A.over = Math.max(A.over, R.over); A.span = Math.max(A.span, R.span); if (R.leaf) A.leaf++; if (R.form === null) A.never++; else A.formed++; }
    if (res.on.form !== null && res.off.form !== null) { T[leaf].off.form += res.off.form; T[leaf].on.form += res.on.form; T[leaf].both++; }
    T.paced += res.on.paced; if (leaf === 'open' && res.on.paced && !silentAt) silentAt = C;
    if (res.off.paced) fail(`${name}: ${res.off.paced} frames paced with the rule off`);
    if (leaf === 'shut' && res.on.paced && !res.on.leaf) fail(`${name}: ${res.on.paced} frames kept at the pace at a door that stayed shut`);
    // (a worse arm is PLAYED AGAIN — the arms the other way round, then as they were, then the other way round once more — unless --first pins the order: only what the
    //  rule's arm does worse in EVERY play is the rule's. A play the squad would not stack in settles nothing either way)
    const w = worse(res); if (Object.keys(w).length) { let held = Object.keys(w), plays = 0; T.again++;
      if (!FIRST) for (let k = 0; k < AGAIN && held.length; k++) { const again = await play(C, leaf, k % 2 ? onFirst : !onFirst); plays++; if (again) { const w2 = worse(again); held = held.filter(key => w2[key]); } }
      for (const k of Object.keys(w)) if (held.includes(k)) { T.slow += k === 'slow' ? 1 : 0; fail(`${name}: ${w[k]}${plays ? ` — and in ${plays} more plays, the arms both ways round` : ''}`); } else { T.hair++; if (VERBOSE) console.log(`  not held: ${tag} ${name} — ${w[k]} (${onFirst ? 'rule on' : 'rule off'} played first); not so in every one of ${plays} more plays`); } }
    if (VERBOSE || (res.on.form ?? WAIT) > (res.off.form ?? WAIT) + 1.5) console.log(`  ${tag} ${name} (${onFirst ? 'on' : 'off'} first): in the line ${f1(res.off.secs)} → ${f1(res.on.secs)} man-s (${Math.round(res.off.m2s)} → ${Math.round(res.on.m2s)} m²·s) · walked ${f1(res.off.m)} → ${f1(res.on.m)} m · formed in ${res.off.form === null ? 'never' : f1(res.off.form)} → ${res.on.form === null ? 'never' : f1(res.on.form)} s`);
  }
  // A TEAM IN THE SILENT POSTURE, an OPEN door where the same squad, not silent, was kept at the pace: nobody is (it keeps its own)
  if (silentAt) { const { d, side, spots } = silentAt; STACKLINE.on = true; for (const x of g.doors.list) shut(x); open(d); await rest(); g.teleportPlayer(home); men.forEach((m, i) => put(m, spots[i], d.frameCentre)); step(3);
    const sw = SILENT.on; SILENT.on = true; await hush(() => setSilent(g, true)); if (squadSilent(g)) { const p0 = STACKLINE_STATS.paced; const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')); await hush(() => step(360));
      if (!why) { silentChecked++; if (STACKLINE_STATS.paced !== p0) fail(`${d.def.name}: a silent team at an open door was kept at the pace (${STACKLINE_STATS.paced - p0} frames)`); } }
    await hush(() => setSilent(g, wasSilent)); SILENT.on = sw; for (const x of g.doors.list) shut(x); await rest(); }
  if (T.open.on.cases && T.open.on.m2s > T.open.off.m2s * 1.02 + 1) fail(`open doors: ${Math.round(T.open.on.m2s)} m²·s of the line on the men with the rule on, ${Math.round(T.open.off.m2s)} with it off`);
  for (const leaf of ['open', 'shut'] as const) { for (const k of ['off', 'on'] as const) for (const key of Object.keys(T[leaf][k]) as (keyof Arm)[]) total[leaf][k][key] = key === 'over' || key === 'span' ? Math.max(total[leaf][k][key], T[leaf][k][key]) : total[leaf][k][key] + T[leaf][k][key]; total[leaf].both += T[leaf].both; }
  total.paced += T.paced; total.slow += T.slow; total.again += T.again; total.hair += T.hair;
  console.log(`${tag} [${E.level ?? 'office.json'}], ${men.length} men, ${pick.length} of ${faces.length} faces · ${T.paced} frames kept at the pace${T.again ? ` · ${T.again} cases played again the other way round, ${T.hair} worse-with-the-rule readings not held` : ''}`); console.log(line('OPEN', T.open)); console.log(line('SHUT', T.shut));
}

const rows: any[] = (ALL_MISSIONS as any[]).filter(E => E.squad);
const picked = rows.filter(E => !ids.length || ids.includes(E.id)); if (!picked.length) { console.log(`no such level — ${rows.map(E => E.id).join(', ')}`); process.exit(2); }
console.log(`stand: ${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen (the old game under the rule — run with TPS_PROFILE=shipped for the game as it ships)'}`);
for (const E of picked) await level(E);
console.log(`ALL · ${total.paced} frames kept at the pace · a silent team at an open door checked on ${silentChecked} levels · ${total.again} cases played again with the arms the other way round, ${total.hair} worse-with-the-rule readings not held`); console.log(line('OPEN', total.open)); console.log(line('SHUT', total.shut));
if (fails.length) { console.log(`=== stackline-check: ${fails.length} FAIL ===`); process.exit(1); }
if (!total.open.on.cases || !total.shut.on.cases || !total.paced || !silentChecked) { console.log(`=== stackline-check: NO VERDICT (${!total.paced ? 'the rule kept nobody at the pace' : !silentChecked ? 'no silent team was played at a door the rule paces' : 'no stack was played'}) ===`); process.exit(1); }
console.log('=== stackline-check: ALL PASS ==='); process.exit(0);
