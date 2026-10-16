// corridor-check.ts — enemies respect a corridor that is held (src/game/lanes.ts): the verdict.
//
//   bun run tools/qa/corridor-check.ts [--seeds 5,7,12] [--secs 100] [--scn block-squads]
//
// The team of four stands where the mission starts it, on hard, and shoots what comes (corridor-hold.ts's hold: the player's 'hold one hallway and pick them
// off'), once with the rule off and once with it on, same seeds. PASS lines:
//   1  off, the fault is there: the men who may leave their rooms walk into the holders' line and drop, some of them where a mate has just dropped (a line
//      about the BASE: if another rule ever mends the fault with this one off, this line goes red and the check wants new seeds or retiring — it is here
//      so lines 3 and 4 cannot pass on an easy seed)
//      (THE FLOOR, 10-13: the block was rebuilt — four rooms off one hall, each round a corner — and `block-four` became one stay-put squad a room: its
//      hold draws nobody, off or on, so lines 1‥5 moved to `block-squads`, the same floor held by three squads, two of which may leave. There a hold costs
//      the defenders four of ten with the rule off — the comms room's three never leave and the rest keep their corners — so line 1 asks a third of the men,
//      two of them fed in after a loss, where it asked 60 % of the old floor's; line 3 asks a third fewer than the off arm's count. Seeds 5, 7, 12 on
//      both stands: off 12 of 30 down, on 6. Over seeds 1‥12, off against on: 44 → 28 of 120 down on the page's stand, 48 → 26 frozen.
//      Before the rebuild the seeds were 3 and 7, then 7 and 9 once alerted defenders burn their weapon lights.)
//   2  on, every run learns a lane and stops men short of it
//   3  on, clearly fewer defenders are picked off than off
//   4  on, fewer walk in where a mate has just dropped and die there
//   5  nothing was added: the same number of defenders stand in both arms, and the off arm ran none of the rule
//   6  a look round the corner (the records office, the hold of the maintainer's own replay: Sam outside the west wall shooting what comes out of the records
//      door, placement 1631): while he stays, a man comes to the corner for a look, finds him still on it and gets back alive — the lane stands
//   7  the same hold, Sam gone from it after 30 s: a look finds the lane empty and it is forgotten
//   8  held at two angles (150 s a hold): a man goes round as far as where the guns would first see him and sets there, and fire comes from a
//      corner. Asked of `PIN_HOLDS` in turn: `PIN_FLOOR` holds must show all three (a man set, a man sent to his corner, a round fired from it) — it
//      stops at the second that does, or once the floor is out of reach. Why not one hold: it stood on one seed of the old block until the squad's own
//      rule for a door an enemy opens (`ROOMFIGHT.doorEars`, 10-12) changed that fight, and other steps have moved other seeds since. THE REBUILT BLOCK
//      NEVER SHOWS IT (10-13: one hall, and every way to the hall's far side crosses it in the guns' sight for 30 m — `round()` says "no way round" on
//      all twelve holds), so the line is asked of the two charges (`defuse-four`: seeds 7, 8, 10 of 1‥12 show it on the page's stand) and the glasshouse
//      (seed 7). A quarter of a floor's holds showing it is what there is; the floor is there so a real drop reads red more often than not.
//      Two clauses hold SWITCHES, not behaviour: `goes` 0 on every hold played = `LANES.pinGo` ships off (nothing else counts a run-in), and one
//      hold with `LANES.pin` off sets nobody and sends nobody to a corner
//   9  a magazine change the rule started behind a corner is counted down ONCE: with the guard code counting the same reload (a man with his head down
//      under fire, or putting rounds into cover — stood in for here by the check's own count each frame) it takes the weapon's time, not half of it; and
//      with nobody else counting, the rule counts it and it takes the same
//      (CORRIDOR_BREAK reds it through the second half; the first half is red only on the old double count — 79 frames for 156 — shown by hand, 10-11)
//  10  a quiet round past a man who has not noticed it opens no lane (`LANES.roused`: two suppressed rounds at a lamp past a calm, pinned man were called a
//      held corridor on a replay); the same round past a man who is roused does, and with the key off any round does
//  11  a rifle's lane knows the floor its rounds reach THROUGH A PANE (`LANES.glass`: the lane's own lines are asked at the energy of the gun that opened
//      it; a man stopped 'out of the guns' line' behind the records hall's pane was shot through it); with the key off the pane hides that floor
//      (10 and 11 alone: `--mends`, ~10 s)
//  12  a grenade down the lane that pins him (`LANES.frag`, 10-13): in one of line 8's holds a man held on a lane who carries a grenade throws it, and it
//      bursts within `FRAG_NEAR` m of where one of the team stood (the team here may get off it, and Sam cannot be hurt: the line asks where it burst, not
//      who it hit); nobody is lost throwing one on the holds played; and the same hold with that key off: no man held on a lane throws. `FRAG_HOLDS` are
//      asked only if none of line 8's holds shows one. (The floor deals one defender in three a grenade, three a floor — frag.ts — so a hold with no
//      carrier held on a lane shows none: of the two charges' seeds 1‥24 on the page's stand, 18 show one.)
//  13  his own while he throws (`LANES.fragOwn`, 10-15): a man who has shouted for a lane is not walked off his arc by the dig-in inside the wind-up's second
//      (the room fight plants a man who has arrived, the dig-in adopts a planted man and sends him to its cover: he then kept the grenade and said so).
//      `OWN_HOLDS` in turn, each cut short just past the throw, until one shows it: with the key off a lane grenade stays in a hand; on, that grenade
//      leaves it and none stays. THE OFF ARM IS ABOUT THE BASE: it needs a hold where the dig-in takes a thrower inside his second — 2 of the two
//      charges' seeds 1‥24 on the page's stand of 10-15 (10 and 12). A later step that moves those two fights reds this line with the rule intact: play
//      `corridor-hold.ts --scn defuse-four --seeds 1-24 --secs 150 --level hard --set '{"LANES":{"fragOwn":false}}'` and re-pick from `fragKept`
// CORRIDOR_BREAK=1 = the 'on' arm played with the switch left off: lines 2‥4 and 6‥13 must FAIL (exit 1).
// Lines 6 to 13 are always asked of the page's stand (TPS_PROFILE=shipped): run from the frozen stand (probes.ts) they are played in a child of this file
// (`--look`), since on the frozen stand nobody is sent at the lane and so nobody is held at its mouth to look (and no round passes glass).
// Exit 0 = all pass, 1 = a FAIL or an error. ~4 min on a quiet four-core box (three holds an arm; a red line 8 plays up to four holds: a minute more; line 13 two short holds, four when its first no longer shows the fault). Checked headless only: the team here cannot be flashed blind the way a player is on the page.
import type { HoldRun } from './corridor-hold';
if (import.meta.main) process.env.TPS_PROFILE ??= 'shipped';   // (run by name: the page's stand; under probes.ts the runner's own — the check holds on both)
const { holdRun } = await import('./corridor-hold');

const argv = import.meta.main ? process.argv.slice(2) : [], flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const seeds = (flag('--seeds') ?? '5,7,12').split(',').map(Number), SECS = Number(flag('--secs') ?? 100), SCN = flag('--scn') ?? 'block-squads';
const BREAK = process.env.CORRIDOR_BREAK === '1';
/** line 8's holds, in the order asked (four that showed it when the list was made: 10-13, on the rebuilt floors and with `LANES.frag` in — the grenade
 *  moves these fights, and the list before it showed none), and how many of them must show it */
const PIN_HOLDS: [string, number][] = [['defuse-four', 16], ['defuse-four', 22], ['defuse-four', 23], ['defuse-four', 11]], PIN_FLOOR = 2;
/** line 12: more holds to ask if none of line 8's shows a grenade · how near where one of the team stood it must burst, m */
const FRAG_HOLDS: [string, number][] = [['defuse-four', 3], ['defuse-four', 14], ['defuse-four', 9]], FRAG_NEAR = 5;
/** line 13's holds: scenario, seed, seconds (the shout comes at 31 s on the first, 96 s on the second, on the page's stand of 10-15) */
const OWN_HOLDS: [string, number, number][] = [['defuse-four', 12, 45], ['defuse-four', 10, 110]];
const stat = (r: HoldRun, k: string) => Number((r.lanes as Record<string, number> | undefined)?.[k] ?? 0);

/** lines 6 and 7: the corner look on the records office hold (the page's stand) */
async function lookLines(check: (ok: boolean, what: string) => void): Promise<void> {
  const LOOK = { LANES: { on: !BREAK } }, at: [number, number] = [9.6, 22.6];
  const stay = await holdRun('records-pair', 1631, 110, LOOK, false, { at, shoot: true });
  const gone = await holdRun('records-pair', 1631, 200, LOOK, false, { at, shoot: true, leave: { t: 30, at: [14, 27.5] } });
  for (const r of [stay, gone]) if (r.error) console.log(`  ERROR ${r.scn}:${r.seed} ${r.error}`);
  console.log(`  records office, Sam on the west wall: stays — looks ${stat(stay, 'peeks')}, found him there ${stat(stay, 'peekThere')}, found it clear ${stat(stay, 'peekClear')}, lost on a look ${stat(stay, 'peekLost')}, ${stay.kills.length} of ${stay.hostiles} down · leaves at 30 s — looks ${stat(gone, 'peeks')}, found it clear ${stat(gone, 'peekClear')}, lanes still known ${stat(gone, 'live')}`);
  check(!stay.error && stat(stay, 'peekThere') >= 1 && stat(stay, 'peekClear') === 0 && stat(stay, 'peekLost') === 0 && stat(stay, 'live') >= 1, 'a look round the corner finds the guns still on it, costs nobody, and the lane stands');
  check(!gone.error && stat(gone, 'peekClear') >= 1 && stat(gone, 'peekLost') === 0, 'the guns gone from it, a look finds the lane empty and it is forgotten');
  const shows = (r: HoldRun) => !r.error && stat(r, 'sets') >= 1 && stat(r, 'pins') >= 1 && stat(r, 'pinRounds') >= 1;
  const played: HoldRun[] = [];
  for (const [scn, seed] of PIN_HOLDS) {
    const r = await holdRun(scn, seed, 150, LOOK, false); played.push(r);
    if (r.error) { console.log(`  ERROR ${r.scn}:${r.seed} ${r.error}`); break; }
    const n = played.filter(shows).length;
    if (n >= PIN_FLOOR || n + PIN_HOLDS.length - played.length < PIN_FLOOR) break;
  }
  const shown = played.filter(shows), bad = played.some(r => r.error), ran = played.reduce((a, r) => a + stat(r, 'goes'), 0);
  const one = bad ? null : await holdRun((shown[0] ?? played[0]).scn, (shown[0] ?? played[0]).seed, 150, { LANES: { on: !BREAK, pin: false } }, false);
  if (one?.error) console.log(`  ERROR ${one.scn}:${one.seed} ${one.error}`);
  console.log(`  two angles, holds played: ${played.map(r => `${r.scn} ${r.seed} — set ${stat(r, 'sets')}, sent to a corner ${stat(r, 'pins')}, rounds from it ${stat(r, 'pinRounds')}, firers lost ${stat(r, 'pinLost')}, ${r.kills.length} of ${r.hostiles} down`).join(' · ')} · sent in under it on any hold ${ran}${one ? ` · ${one.scn} ${one.seed} with that off: set ${stat(one, 'sets')}, sent to a corner ${stat(one, 'pins')}, ${one.kills.length} of ${one.hostiles} down` : ''}`);
  check(!bad && shown.length >= PIN_FLOOR && ran === 0 && !!one && !one.error && stat(one, 'sets') === 0 && stat(one, 'pins') === 0, `held at two angles: in ${shown.length} of ${played.length} holds played a man sets on the lane's other side and fire comes from a corner (${PIN_FLOOR} wanted of ${PIN_HOLDS.length} at most), nobody is sent in; off, neither`);
  // line 12: a grenade down the lane (asked of the holds line 8 has just played, then of FRAG_HOLDS)
  const threw = (r: HoldRun) => !r.error && stat(r, 'frags') >= 1 && (r.frags?.bursts ?? []).some(b => b.lane && b.teamM <= FRAG_NEAR), asked = [...played];
  for (const [scn, seed] of FRAG_HOLDS) {
    if (bad || asked.some(threw)) break;
    const r = await holdRun(scn, seed, 150, LOOK, false); asked.push(r);
    if (r.error) { console.log(`  ERROR ${r.scn}:${r.seed} ${r.error}`); break; }
  }
  const fr = asked.find(threw) ?? null, lost = asked.reduce((a, r) => a + stat(r, 'fragLost'), 0);
  const dry = fr ? await holdRun(fr.scn, fr.seed, 150, { LANES: { on: !BREAK, frag: false } }, false) : null;
  if (dry?.error) console.log(`  ERROR ${dry.scn}:${dry.seed} ${dry.error}`);
  console.log(`  a grenade down the lane, holds asked: ${asked.map(r => `${r.scn} ${r.seed} — thrown by a man held on a lane ${stat(r, 'frags')}, lost throwing ${stat(r, 'fragLost')}, bursts of theirs ${(r.frags?.bursts ?? []).map(b => `${b.teamM} m from where the team stood${b.lane ? ' (his)' : ''}`).join(', ') || 'none'}`).join(' · ')}${dry ? ` · ${dry.scn} ${dry.seed} with that off: thrown by a man held on a lane ${stat(dry, 'frags')}` : ''}`);
  check(!!fr && lost === 0 && !!dry && !dry.error && stat(dry, 'frags') === 0, `a grenade down the lane: a man held on a lane who carries one throws it, and it bursts within ${FRAG_NEAR} m of where the team stood (${asked.filter(threw).length} of ${asked.length} holds asked), nobody lost throwing; off, he never throws`);
  // line 13: from his shout to the throw he is the lane rule's
  let own = false, ownErr = false; const tried: string[] = [];
  for (const [scn, seed, secs] of OWN_HOLDS) {
    const off = await holdRun(scn, seed, secs, { LANES: { on: !BREAK, fragOwn: false } }, false), base = !off.error && stat(off, 'fragKept') >= 1;
    const on = base || BREAK ? await holdRun(scn, seed, secs, LOOK, false) : null;   // (a hold whose off arm no longer shows the fault says nothing: not played on)
    for (const r of [off, on]) if (r?.error) { console.log(`  ERROR ${r.scn}:${r.seed} ${r.error}`); ownErr = true; }
    tried.push(`${scn} ${seed} (${secs} s) — off: away ${stat(off, 'frags')}, stayed in a hand ${stat(off, 'fragKept')}${on ? ` · on: away ${stat(on, 'frags')}, stayed ${stat(on, 'fragKept')}` : ' · on: not played'}`);
    if (ownErr) break;
    if (base && on && stat(on, 'fragKept') === 0 && stat(on, 'frags') > stat(off, 'frags')) { own = true; break; }
  }
  console.log(`  his own while he throws, holds asked: ${tried.join(' · ')}`);
  check(own && !ownErr, `his own while he throws: a man who has shouted for a lane is not walked off his arc before the grenade leaves his hand (off: the dig-in takes him and it stays in his hand)`);
  await reloadLine(check);
  await mendLines(check);
}

/** line 9: a reload the rule started is counted once a frame, whoever else is counting it. One game (The block, the four), its two defenders farthest from the
 *  team: one counted by the rule alone, one with the guard code's count stood in for by this check — made AFTER the step, as a man's own update comes after
 *  lanesTick in the game's frame */
async function reloadLine(check: (ok: boolean, what: string) => void): Promise<void> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { LANES, laneReload } = await import(`${ROOT}/src/game/lanes.ts`);
  const { tickReloadBeat } = await import(`${ROOT}/src/game/guards.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { readFileSync } = await import('node:fs'), { resolve } = await import('node:path');
  const was = LANES.on, log = console.log, err = console.error, warn = console.warn, rnd = Math.random, DT = 1 / 60;
  let both = -1, alone = -1, want = 0, why = '';
  try {
    console.log = console.error = console.warn = () => { };
    let a = 0x51ab; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const E = (SCENARIOS as any[]).find(e => e.id === 'block-four'); if (!E) throw new Error('no block-four row');
    const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) });
    LANES.on = !BREAK; W.game.godMode = true;
    const r = await startFromQuery(W.game, new URLSearchParams((scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, '$1roomclear=3'))); if (r.why) throw new Error(`start refused — ${r.why}`);
    const g = W.game; for (let i = 0; i < 20; i++) W.step(DT);
    const sam = g.player.char.pos, far = (x: any) => Math.hypot(x.char.pos[0] - sam[0], x.char.pos[2] - sam[2]);
    const [A, B] = (g.guards as any[]).filter(x => x.team === 'hostile' && x.state !== 'dead').sort((x, y) => far(y) - far(x)); if (!A || !B) throw new Error('no two defenders');
    want = Math.round(A.weapon.def.reload.dur * 60); if (B.weapon.def.reload.dur !== A.weapon.def.reload.dur) throw new Error('the two carry different guns');
    for (const gd of [A, B]) { gd.lastSeenT = -1e9; laneReload(g, gd); }
    for (let n = 1; n <= want * 3 && (both < 0 || alone < 0); n++) {
      A.lastSeenT = B.lastSeenT = -1e9; W.step(DT);
      if (A.reloadT >= 0) tickReloadBeat(g, A, DT);   // (A: somebody else is counting his too)
      if (both < 0 && A.reloadT < 0) both = n; if (alone < 0 && B.reloadT < 0) alone = n;
    }
  } catch (e) { why = String((e as Error)?.message ?? e); }
  finally { console.log = log; console.error = err; console.warn = warn; Math.random = rnd; LANES.on = was; }
  const near = (n: number) => n >= want - 3 && n <= want + 3;
  console.log(`  a magazine change the rule started (${want} frames by the weapon's row): counted beside the guard code's own count ${both} frames, counted alone ${alone}${why ? ` · ${why}` : ''}`);
  check(!why && near(both) && near(alone), 'a magazine change the rule started is counted once: the weapon\'s own time beside the guard code\'s count, and alone');
}

/** lines 10 and 11, two mends from the replay dump, on one staged game (the records office, the pair, placement 1631 — the maintainer's own hold):
 *  (10) ROUNDS HE NOTICED: a quiet round past a calm man opens no lane, the same round past a man who is roused opens one (`LANES.roused`);
 *  (11) A LANE THROUGH GLASS: a rifle's lane knows the floor its rounds reach through a pane (`LANES.glass`) — the spot a man stopped short was stepped to */
async function mendLines(check: (ok: boolean, what: string) => void): Promise<void> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { LANES, lanesStats, lanesReset, lanesKnows } = await import(`${ROOT}/src/game/lanes.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { readFileSync } = await import('node:fs'), { resolve } = await import('node:path');
  const was = { on: LANES.on, roused: LANES.roused, glass: LANES.glass }, log = console.log, err = console.error, warn = console.warn, rnd = Math.random, DT = 1 / 60;
  const n = { calm: -1, off: -1, roused: -1 }, k = { pane: false, on: false, off: false, near: false }; let why = '', stayed = false;
  try {
    console.log = console.error = console.warn = () => { };
    let a = 0x51ab; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const E = (SCENARIOS as any[]).find(e => e.id === 'records-pair'); if (!E) throw new Error('no records-pair row');
    const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) });
    LANES.on = !BREAK; LANES.roused = LANES.glass = true; W.game.godMode = true;
    const r = await startFromQuery(W.game, new URLSearchParams((scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, '$1roomclear=1631'))); if (r.why) throw new Error(`start refused — ${r.why}`);
    const g = W.game, col = g.col; for (let i = 0; i < 20; i++) W.step(DT);
    const h = (p: number[]) => [p[0], 1.2, p[2]], lanes = () => Number(lanesStats(g).lanes ?? 0);
    const mate = (g.guards as any[]).find(x => x.unit && x.team === 'operative' && x.state !== 'dead'); if (!mate) throw new Error('no teammate');
    const round = (from: number[], to: number[]) => g.events.push({ kind: 'shot', pos: [from[0], 1, from[2]], time: g.time, loud: false, level: 0, who: mate.char.id, from: h(from), to: h(to) });
    // (10) a calm defender with six clear metres to him along some bearing
    const calm = (x: any) => x.state === 'patrol' && x.awareness < 0.3;
    let D: any = null, A: number[] = [], B: number[] = [];
    for (const x of (g.guards as any[]).filter(x => x.unit && x.team === 'hostile' && x.state !== 'dead' && calm(x))) {
      for (let i = 0; i < 16 && !D; i++) {
        const c = Math.cos(i * Math.PI / 8), s = Math.sin(i * Math.PI / 8), p = x.char.pos;
        const from = [p[0] + c * 6, 0, p[2] + s * 6]; if (col.shotBlocked(h(from), h(p))) continue;
        D = x; A = from; B = [p[0] - c * 3, 0, p[2] - s * 3];
      }
      if (D) break;
    }
    if (!D) throw new Error('no calm defender with a clear line to him');
    let l0 = lanes(); round(A, B); W.step(DT); for (let i = 0; i < 45; i++) W.step(DT); n.calm = lanes() - l0; stayed = calm(D);
    LANES.roused = false; l0 = lanes(); round(A, B); W.step(DT); n.off = lanes() - l0; LANES.roused = true; lanesReset(g);
    D.awareness = 0.6; l0 = lanes(); round(A, B); W.step(DT); n.roused = lanes() - l0; lanesReset(g);
    // (11) the hold of the replay: a rifle at S, the floor P a stopped man was stepped to, a pane between them
    const S = [7.7, 0, 17.1], P = [10.9, 0, 9.7], d = Math.hypot(P[0] - S[0], P[2] - S[2]), u = [(P[0] - S[0]) / d, (P[2] - S[2]) / d];
    const Q = [S[0] + u[0] * 3, 0, S[2] + u[1] * 3], T = [S[0] + u[0] * 5, 0, S[2] + u[1] * 5];
    k.pane = !!col.shotBlocked(h(S), h(P)) && !col.shotBlocked(h(S), h(P), undefined, 1) && !col.shotBlocked(h(S), h(Q));
    const arm = (glass: boolean) => {
      lanesReset(g); LANES.glass = glass; D.char.pos[0] = Q[0]; D.char.pos[2] = Q[2]; D.awareness = 0.6; round(S, T); for (let i = 0; i < 6; i++) W.step(DT); D.char.pos[0] = Q[0]; D.char.pos[2] = Q[2]; D.awareness = 0.6; round(S, T);
      for (let i = 0; i < 100; i++) W.step(DT);
      const out = { p: !!lanesKnows(g, P), q: !!lanesKnows(g, [S[0] + u[0] * 2, 0, S[2] + u[1] * 2]) }; lanesReset(g); return out;
    };
    const off = arm(false), on = arm(true); k.off = off.p; k.on = on.p; k.near = on.q && off.q;
  } catch (e) { why = String((e as Error)?.message ?? e); }
  finally { console.log = log; console.error = err; console.warn = warn; Math.random = rnd; LANES.on = was.on; LANES.roused = was.roused; LANES.glass = was.glass; }
  console.log(`  a quiet round past a man (the records office): calm — lanes opened ${n.calm}${stayed ? '' : ' (he did not stay calm)'}, with the rule off ${n.off}; roused — ${n.roused} · a rifle's lane and the floor behind a pane: a pane on the line ${k.pane}, the near floor known ${k.near}, the floor behind the pane known ${k.on}, with the rule off ${k.off}${why ? ` · ${why}` : ''}`);
  check(!why && stayed && n.calm === 0 && n.off === 1 && n.roused === 1, 'rounds past a man who has not noticed them open no lane; past a man who is roused they do (off: any round does)');
  check(!why && k.pane && k.near && k.on && !k.off, 'a rifle\'s lane knows the floor its rounds reach through a pane (off: the pane hides it)');
}

/** the verdict (probes.ts `corridor`): true = every line passed */
export async function corridorCheck(): Promise<boolean> {
let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; };
const off: HoldRun[] = [], on: HoldRun[] = [];
for (const s of seeds) {
  off.push(await holdRun(SCN, s, SECS, { LANES: { on: false } }, false));
  on.push(await holdRun(SCN, s, SECS, { LANES: { on: !BREAK } }, false));
}
const bad = [...off, ...on].filter(r => r.error);
for (const r of bad) console.log(`  ERROR ${r.scn}:${r.seed} ${r.error}`);
const sum = (rs: HoldRun[], f: (r: HoldRun) => number) => rs.reduce((a, r) => a + f(r), 0);
const men = sum(off, r => r.hostiles), downOff = sum(off, r => r.kills.length), downOn = sum(on, r => r.kills.length);
const fedOff = sum(off, r => r.fed), fedOn = sum(on, r => r.fed);
console.log(`corridor-check · ${SCN} · hard · seeds ${seeds.join(',')} · ${SECS} s a run${BREAK ? ' · CORRIDOR_BREAK: the rule left off in the on arm' : ''}`);
for (let i = 0; i < seeds.length; i++) console.log(`  seed ${seeds[i]}: off ${off[i].kills.length} of ${off[i].hostiles} down (${off[i].fed} walked in after a loss and died) · on ${on[i].kills.length} of ${on[i].hostiles} down (${on[i].fed}) · on: lanes known ${stat(on[i], 'known')}, men stopped short ${stat(on[i], 'held')}, backed out ${stat(on[i], 'backedOut')}, went round ${stat(on[i], 'round')}, charges ${stat(on[i], 'stuns')}, pushes ${stat(on[i], 'pushes')}`);
check(bad.length === 0, 'every run played to its end');
check(downOff >= Math.ceil(men / 3) && fedOff >= 2, `off, the fault is there: ${downOff} of ${men} defenders picked off by a team that never moved (≥ a third), ${fedOff} of them walking in where a mate had just dropped (≥ 2)`);
check(on.every(r => stat(r, 'known') >= 1 && stat(r, 'held') >= 1), 'on, every run learns a covered lane and stops men short of it');
check(downOn <= downOff - Math.max(2, Math.round(downOff / 3)), `on, clearly fewer are picked off: ${downOn} of ${men} against ${downOff} (a third fewer at least)`);
check(fedOn < fedOff, `on, fewer walk in where a mate has just dropped and die there: ${fedOn} against ${fedOff}`);
check(sum(on, r => r.hostiles) === men && off.every(r => stat(r, 'lanes') === 0), 'nothing added: the same defenders in both arms, and the off arm ran none of the rule');
if (!flag('--scn')) {
  if (process.env.TPS_PROFILE === 'shipped') await lookLines(check);
  else {   // (the runner's own stand is the frozen one: nobody is sent at the lane there, so nobody is held at its mouth to look — the two lines are asked of the page's stand in a child)
    const p = Bun.spawn([process.execPath, 'run', import.meta.path, '--look'], { stdout: 'inherit', stderr: 'inherit', env: { ...process.env, TPS_PROFILE: 'shipped' } });
    check((await p.exited) === 0, 'the lines of the look round the corner, of the two angles and of the reload, asked of the page\'s stand (above)');
  }
}
console.log(fails ? `=== corridor-check: ${fails} FAIL ===` : '=== corridor-check: ALL PASS ===');
return fails === 0;
}
if (import.meta.main && argv.includes('--look')) {   // (the child of a run on the other stand: lines 6 to 9 alone)
  let fails = 0; await lookLines((ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; });
  process.exit(fails ? 1 : 0);
} else if (import.meta.main && argv.includes('--reload')) {   // (line 9 alone, on whatever stand this is: half a minute)
  let fails = 0; await reloadLine((ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; });
  process.exit(fails ? 1 : 0);
} else if (import.meta.main && argv.includes('--mends')) {   // (lines 10 and 11 alone, on whatever stand this is: the glass line wants the page's)
  let fails = 0; await mendLines((ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; });
  process.exit(fails ? 1 : 0);
} else if (import.meta.main) process.exit((await corridorCheck()) ? 0 : 1);
