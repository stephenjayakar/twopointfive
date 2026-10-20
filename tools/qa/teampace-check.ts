// TEAMMATES ARE SLOWER THAN THE PLAYER, AND RUN ONLY FOR A REASON — the check behind src/game/teampace.ts (TEAMPACE.on: on in the page, ?teampace=0; off on the
// frozen stand, TPS_TEAMPACE=1).
//   bun run tools/qa/teampace-check.ts [--verbose]      (also `probes.ts teampace`, family squadorders; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
// Headless; nothing here looks at a picture. room-clear-four with the other side put far off the floor, the switch thrown by hand after the stand-up; the player
// is the real player under real keys. Each rule line is run with the switch on AND off and passes only when the rule shows on and the old pace shows off:
//   1. AN ORDERED WALK: the four sent to a spot a long walk off — no man's legs over `k` × the player's walk × his card (off: the orders' brisk 2.0);
//      the player, setting off five seconds after them down the same way, comes up on their last man (off: the team walks away from him);
//   2. FOLLOWING AT A WALK: the player walks the same way with the four fallen in — nobody runs, nobody over `followK` × his walk × his card, nobody left
//      more than a file's length behind when he stops;
//   3. FOLLOWING AT A SPRINT: he sprints it — every follower is at a run with him (off: nobody over PACE.max), gun low while he runs, down to a walk inside
//      a second and a half of his stopping, never into the player's back, in place soon after; each run written down as 'follow';
//   3b. … and not the silent squad: the same sprint under the silent posture, nobody runs;
//   4. A GRENADE: one put down among them — the men who run from it run (off: at the old cap), written down as 'blast'; with `own` off, at the old cap;
//   5. THE FIGHT'S OWN MOVES: a step the room fight orders keeps the pace it had (PACE.max) for its second and a half and no longer;
//   6. COVER (the picture raised for the line): a man the fight is hot for, on floor in the line of a man he knows of, a mark out of that line in plain sight
//      across the same floor — he is given the run; not with the fight cold, not to a mark in the line too, not for a short step, not with `own` off, not
//      the silent squad;
//   7. a sprinter's boots: the footfall's level at a run is the player's own sprint's, and nothing changes under it;
//   8. the journal: a recording from before the key replays with it off, one that carries it keeps its own word.
// TEAMPACE_BREAK=1 = the module answers as if the switch were off in the 'on' arms: lines 1 to 7 must fail (3b apart: nobody runs either way).   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { rig } = (await import('./outerwall-probes.ts')) as any;
const { TEAMPACE, TEAMPACE_STATS, TEAMPACE_DEBUG, teamFight, teamCap, teamDashNow, teamTread, teamWalk } = await import(`${ROOT}/src/game/teampace.ts`);
const { PACE, teamPaced } = await import(`${ROOT}/src/game/guards.ts`);
const { loadPaceOn } = await import(`${ROOT}/src/game/kitload.ts`);
const { setSilent, SILENT } = await import(`${ROOT}/src/game/silent.ts`);
const { PICTURE, pictureTell, exposedAt } = await import(`${ROOT}/src/game/picture.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
const VERBOSE = process.argv.includes('--verbose'), SCN = 'room-clear-four';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');

/** the scenario stood up with the other side far off the floor, the switch thrown by hand, the four fallen in on the player where the scenario put him */
async function stand(on: boolean) {
  const R = await rig(SCN, 5), g = R.game;
  TEAMPACE.on = on; for (const k of Object.keys(TEAMPACE_STATS)) (TEAMPACE_STATS as any)[k] = 0;
  const marks = R.hostiles.filter((h: any) => h.state !== 'dead').map((h: any) => [...h.char.pos]);
  for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
  const home = [...g.player.char.pos]; R.gather(home, 20); R.step(120);
  // a long walk off: the spot one of their men stood on, by the length of the way to it
  // … that 'move there' takes (no locked door on the way): asked, then the four called back
  const cands = marks.map((m: number[]) => ({ m, L: R.pathLen(home, m) as number })).filter((c: any) => Number.isFinite(c.L) && c.L >= 14).sort((a: any, b: any) => Math.abs(a.L - 20) - Math.abs(b.L - 20));
  let far: number[] | null = null, len = 0;
  for (const c of cands) { if (R.O.give('move', R.O.targetAt(c.m), 'all')) continue; far = c.m; len = c.L; break; }
  if (!far) throw new Error('teampace: no spot a long walk from the start that the squad can be sent to');
  R.gather(home, 20); R.step(60);
  const way = (a: number[], b: number[]): number[][] => [...(g.col.nav.findPath(a, b) ?? []), b];
  /** the player walked (or run, `shift`) down the way to `to` under his own keys; `each` is called every frame; ends there, or after `secs` */
  const go = (to: number[], shift: boolean, secs: number, each: () => void) => { const I = R.input, pts = way([...g.player.char.pos], to); let i = 0;
    for (let f = 0; f < secs * 60 && i < pts.length; f++) { const pos = g.player.char.pos; while (i < pts.length && flat(pos, pts[i]) < (i === pts.length - 1 ? 0.4 : 0.7)) i++; if (i >= pts.length) break;
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k); const p = pts[i], dx = p[0] - pos[0], dz = p[2] - pos[2], d = Math.hypot(dx, dz) || 1, { fwd, right } = R.W.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
      if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); if (shift) I.keys.add('ShiftLeft'); else I.keys.delete('ShiftLeft');
      R.step(); each(); }
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) I.keys.delete(k); R.step(); each(); };
  const card = (m: any) => loadPaceOn(g, m) as number;
  return { R, g, home, far, len, go, card, men: () => R.up as any[] };
}
type Stand = Awaited<ReturnType<typeof stand>>;

/** line 1: the ordered walk and the race */
async function ordered(on: boolean) {
  const S = await stand(on), { R, g } = S, men = S.men(), paced = men.every(m => teamPaced(g, m));
  const why = R.O.give('move', R.O.targetAt(S.far), 'all'); if (why) throw new Error(`teampace: 'move there' refused — ${why}`);
  let top = 0, over = 0; const cap = (m: any) => teamWalk(g) * S.card(m) + 0.03;
  const watch = () => { for (const m of men) { top = Math.max(top, m.speed); if (m.speed > cap(m)) over++; } };
  for (let f = 0; f < 300; f++) { R.step(); watch(); }   // their five seconds' start
  // (the REAR man: the file fills the passage, so the player catches a team by coming up behind its last man)
  const rear = () => Math.max(...men.map(m => R.pathLen([...m.char.pos], S.far) as number)), mine = () => R.pathLen([...g.player.char.pos], S.far) as number;
  const gap0 = mine() - rear(), t0 = g.time; let gap1 = gap0, t1 = t0, caught = false, arrived = false;
  S.go(S.far, false, 60, () => { watch(); if (caught || arrived) return; gap1 = mine() - rear(); t1 = g.time; caught = gap1 <= 1.0; arrived = men.some(m => R.O.of(m)?.arrived); });
  const rate = (gap0 - gap1) / Math.max(1e-6, t1 - t0);
  return { paced, top, over, gap0, gap1, rate, caught, secs: t1 - t0, len: S.len, walk: teamWalk(g) as number, cards: men.map(S.card) };
}

/** lines 2, 3, 3b: fallen in, the player walks the way, then sprints back, then sprints it again under the silent posture */
async function following(on: boolean) {
  const S = await stand(on), { R, g } = S, men = S.men(), sam = g.player.char;
  const dSam = () => Math.max(...men.map(m => flat(m.char.pos, sam.pos)));
  // 2. at a walk
  let wTop = 0, wOver = 0, wRuns = 0; const wCap = (m: any) => g.tune.playerWalk * TEAMPACE.followK * S.card(m) + 0.03;
  S.go(S.far, false, 60, () => { for (const m of men) { wTop = Math.max(wTop, m.speed); if (m.speed > wCap(m)) wOver++; if (m.speed >= TEAMPACE.runAt) wRuns++; } });
  const wBehind = dSam(), wStats = TEAMPACE_STATS.follow; R.until(() => men.every(m => R.O.of(m)?.arrived), 12); R.step(60);
  // 3. at a sprint, back the way he came
  const tops = men.map(() => 0); let runF = 0, lowF = 0, far = 0, samTop = 0; const log: string[] = []; TEAMPACE_DEBUG.log = (s: string) => log.push(s);
  S.go(S.home, true, 30, () => { samTop = Math.max(samTop, Math.hypot(sam.vel[0], sam.vel[2])); far = Math.max(far, dSam()); men.forEach((m, i) => { tops[i] = Math.max(tops[i], m.speed); if (m.speed >= TEAMPACE.runAt) { runF++; if (m.char.anim.upper === 'none') lowF++; } }); });
  let down = -1, near = 9; for (let f = 0; f < 360; f++) { R.step(); near = Math.min(near, ...men.map(m => flat(m.char.pos, sam.pos))); if (down < 0 && men.every(m => m.speed < TEAMPACE.runAt)) down = f / 60; }
  const inPlace = R.until(() => men.every(m => R.O.of(m)?.arrived), 12), runs = TEAMPACE_STATS.follow - wStats;
  // 3b. the silent squad
  R.step(60); const sil0 = TEAMPACE_STATS.follow; const wasSilent = SILENT.on; SILENT.on = true; setSilent(g, true); R.step(30); let sTop = 0;
  S.go(S.far, true, 30, () => { for (const m of men) sTop = Math.max(sTop, m.speed); });
  const sRuns = TEAMPACE_STATS.follow - sil0; setSilent(g, false); SILENT.on = wasSilent; TEAMPACE_DEBUG.log = undefined;
  return { wTop, wOver, wRuns, wBehind, tops, runF, lowF, far, samTop, down, near, inPlace, runs, sTop, sRuns, log, n: men.length };
}

/** line 4: a grenade among them (`own` false: the rule on, a run not allowed) */
async function grenade(on: boolean, own = true) {
  const S = await stand(on), { R, g } = S, men = S.men(), thrower = g.guards.find((x: any) => x.team !== 'operative' && x.team !== 'civilian');
  TEAMPACE.own = own; { const why = R.O.give('hold', R.O.targetAt([...men[0].char.pos]), 'all'); if (why) throw new Error(`teampace: 'hold' refused — ${why}`); R.step(120); }   // (on posts: no follower's pace under the flee)
  const c = men.reduce((a, m) => [a[0] + m.char.pos[0] / men.length, 0, a[2] + m.char.pos[2] / men.length], [0, 0, 0]);
  g.items.spawn('frag', [c[0], 0.05, c[2]], [0, 0, 0], { fuse: 3.2, who: thrower?.char.id ?? 0 });
  let top = 0; for (let f = 0; f < 200; f++) { R.step(); for (const m of men) top = Math.max(top, m.speed); }
  TEAMPACE.own = true;
  return { top, blast: TEAMPACE_STATS.blast as number, up: S.men().length };
}

export const teampaceCheck = guarded(async () => {
  const F = family('teampace: teammates are slower than the player, and run only for a reason');
  const keep = { tp: { ...TEAMPACE }, rnd: Math.random, d: DESTRUCTION.on, w: WALLCHARGE.on, o: WALLCHARGE.outer, pic: PICTURE.on, sil: SILENT.on, dbg: TEAMPACE_DEBUG.log };
  try {
    if (process.env.TEAMPACE_BREAK === '1') console.log('  (TEAMPACE_BREAK: the module answers as with the switch off — lines 1 to 7 must fail, 3b apart)');
    // ---- 1
    { const a = await ordered(true), b = await ordered(false);
      F.verdict(a.paced && a.top > 1.0 && a.over === 0 && b.top > 1.9, `an ordered walk: no man's legs over ${TEAMPACE.k} × the player's walk × his card (off: the orders' own brisk pace)`,
        `on: top ${f2(a.top)} m/s against a walk of ${f2(a.walk)} (cards ×${a.cards.map(f2).join(' ×')}), frames over ${a.over} · off: top ${f2(b.top)} · the way ${f2(a.len)} m · the rule has the men: ${a.paced}`);
      F.verdict(a.rate > 0.12 && a.gap1 < a.gap0 && b.rate < -0.2 && b.gap1 > b.gap0, 'the player, setting off five seconds behind an ordered team, comes up on its last man at a walk (off: the team walks away from him)',
        `on: ${f2(a.gap0)} m behind its last man → ${f2(a.gap1)} m in ${f2(a.secs)} s, ${f2(a.rate)} m/s gained · off: ${f2(b.gap0)} → ${f2(b.gap1)} m in ${f2(b.secs)} s, ${f2(b.rate)} m/s`); }
    // ---- 2, 3, 3b
    { const a = await following(true), b = await following(false);
      if (VERBOSE) for (const s of a.log) console.log(`    ${s}`);
      F.verdict(a.wRuns === 0 && a.wOver === 0 && a.wTop > 1.2 && a.wBehind < 7, `following at a walk: nobody runs, nobody over ${TEAMPACE.followK} × the player's walk × his card, the file with him when he stops`,
        `on: top ${f2(a.wTop)} m/s, frames over ${a.wOver}, frames at a run ${a.wRuns}, the last man ${f2(a.wBehind)} m off as he stops · off: top ${f2(b.wTop)}, ${f2(b.wBehind)} m`);
      F.verdict(a.tops.every((t: number) => t >= 4) && Math.max(...b.tops) <= PACE.max * 1.25 + 0.05, 'following at a sprint: every follower runs with him (off: nobody over the old cap)',
        `on: tops ${a.tops.map(f2).join(' ')} m/s, the player ${f2(a.samTop)}, the last man at most ${f2(a.far)} m off · off: tops ${b.tops.map(f2).join(' ')}, ${f2(b.far)} m off`);
      F.verdict(a.runF > 0 && a.lowF === a.runF && a.down >= 0 && a.down <= 1.5 && a.near > 0.4 && a.inPlace && a.runs >= a.n && b.runs === 0,
        'at a run the gun is low; down to a walk inside a second and a half of his stopping, never into his back, in place after; each run written down',
        `on: ${a.lowF} of ${a.runF} running frames gun low · walking ${f2(a.down)} s after he stops · nearest ${f2(a.near)} m · in place ${a.inPlace} · runs written: follow ${a.runs} · off: ${b.runs}`);
      F.verdict(a.sRuns === 0 && a.sTop < TEAMPACE.runAt, 'the silent squad does not run behind him', `on: top ${f2(a.sTop)} m/s under the silent posture, runs written ${a.sRuns}`); }
    // ---- 4
    { const a = await grenade(true), b = await grenade(false), c = await grenade(true, false);
      F.verdict(a.top > TEAMPACE.runAt && a.blast >= 1 && b.top <= PACE.max * 1.25 + 0.05 && b.top > 1.9 && b.blast === 0, 'a grenade among them: the men who run from it run, written down as blast (off: at the old cap)',
        `on: top ${f2(a.top)} m/s, blast ${a.blast}, ${a.up} up after · off: top ${f2(b.top)}, blast ${b.blast}, ${b.up} up`);
      F.verdict(c.top > 1.9 && c.top <= PACE.max * 1.25 + 0.05 && c.blast === 0, '… and with a run not allowed him (`own` off) he leaves it at the old cap, the pace the flee was planned for — never the walk',
        `own off: top ${f2(c.top)} m/s, blast ${c.blast}, ${c.up} up after`); }
    // ---- 5, 6, 7
    { const S = await stand(true), { R, g } = S, m = S.men()[0], walk = teamWalk(g) as number;
      { const why = R.O.give('hold', R.O.targetAt([...m.char.pos]), 'all'); if (why) throw new Error(`teampace: 'hold' refused — ${why}`); R.step(120); }   // (holding: nobody is closing on a place in a file)
      const cap0 = teamCap(g, m); teamFight(g, m, 1.5); const cap1 = teamCap(g, m); R.step(60); const cap2 = teamCap(g, m); R.step(45); const cap3 = teamCap(g, m);
      F.verdict(Math.abs(cap0 - walk) < 1e-9 && cap1 === PACE.max && cap2 === PACE.max && Math.abs(cap3 - walk) < 1e-9, 'a step the fight orders keeps the pace it had for its second and a half, and no longer',
        `cap ${f2(cap0)} → ${f2(cap1)} with the fight's leave → ${f2(cap2)} a second on → ${f2(cap3)} after`);
      // 6. cover: a place found on this floor where a man told of an enemy is in his line and a mark across the same floor is not
      PICTURE.on = true; const H = R.hostiles[0], p = [...m.char.pos], open = (a: number[], b: number[]) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
      let found: { E: number[]; to: number[] } | null = null;
      for (let r = 5; r <= 12 && !found; r += 1) for (let i = 0; i < 24 && !found; i++) { const E = [p[0] + Math.cos(i * Math.PI / 12) * r, 0, p[2] + Math.sin(i * Math.PI / 12) * r];
        if (g.col.nav.isBlocked(E[0], E[2]) || !open(p, E)) continue; R.put(H, E); pictureTell(g, m, H, E); if (exposedAt(g, m, p) < TEAMPACE.dashSeen) continue;
        for (let q = 2.8; q <= 7 && !found; q += 0.6) for (let j = 0; j < 24 && !found; j++) { const to = [p[0] + Math.cos(j * Math.PI / 12) * q, 0, p[2] + Math.sin(j * Math.PI / 12) * q];
          if (!g.col.nav.isBlocked(to[0], to[2]) && open(p, to) && g.fight.roomAt(p) === g.fight.roomAt(to) && exposedAt(g, m, to) <= 0) found = { E, to }; } }
      if (!found) F.verdict(false, 'cover: a place for the line', 'no floor near the start where one spot is in a man\'s line and another, in plain sight of it, is not');
      else { const { E, to } = found, d = flat(p, to), hotT = g.fight.hotT;
        R.put(H, [E[0] + 400, 0, E[2]]); R.step(30);   // (he is known of, not there: nobody fights)
        const ask = (dd = d, at = to) => { g.fight.hotT = g.time; return teamDashNow(g, m, at, dd) as boolean; };
        const run = ask(); g.fight.hotT = -1e9; const cold = teamDashNow(g, m, to, d);
        const inLine = ask(d, [p[0] + (E[0] - p[0]) * 0.3, 0, p[2] + (E[2] - p[2]) * 0.3]), short = ask(1.0);
        TEAMPACE.own = false; const off = ask(); TEAMPACE.own = true;
        // … and a leg BEGUN is run out: asked of a man already running it, from floor on the leg the line has left and with the loud gone cold, the answer
        // is still yes (asked afresh there it is no: that was the walk in the middle of a leg) — and still no to a mark in the line or a step from it
        let mid: number[] | null = null; for (let k = 0.9; k >= 0.2 && !mid; k -= 0.1) { const q = [p[0] + (to[0] - p[0]) * k, 0, p[2] + (to[2] - p[2]) * k]; if (flat(q, to) > 0.8 && exposedAt(g, m, q) < TEAMPACE.dashSeen) mid = q; }
        let legOn = false, legFresh = true, legLine = true, legEnd = true, legLeft = 0;
        if (mid) { R.put(m, mid); legLeft = flat(mid, to); g.fight.hotT = -1e9; legOn = teamDashNow(g, m, to, legLeft, 0.6, true); legFresh = teamDashNow(g, m, to, legLeft, 0.6);
          legLine = teamDashNow(g, m, [p[0] + (E[0] - p[0]) * 0.3, 0, p[2] + (E[2] - p[2]) * 0.3], legLeft, 0.6, true); legEnd = teamDashNow(g, m, to, 0.5, 0.6, true); R.put(m, p); }
        // … and walked: sent there with the fight hot, he runs the leg and it is written down (the fight cold: he walks it)
        const walked = (hot: boolean) => { R.put(m, p); R.step(30); const n0 = TEAMPACE_STATS.cover; const why = R.O.give('move', R.O.targetAt(to), 'all'); let top = 0;
          for (let f = 0; f < 240; f++) { g.fight.hotT = hot ? g.time : -1e9; R.step(); top = Math.max(top, m.speed); } return { top, n: TEAMPACE_STATS.cover - n0, why }; };
        const wHot = walked(true); g.fight.hotT = -1e9; const wCold = walked(false);
        const wasS = SILENT.on; SILENT.on = true; setSilent(g, true); R.put(m, p); R.step(5); const sil = ask(); setSilent(g, false); SILENT.on = wasS; g.fight.hotT = hotT;
        F.verdict(run && !cold && !inLine && !short && !off && !sil,
          'cover: hot, on floor in a known man\'s line, his mark out of it in plain sight across the same floor — he runs; not cold, not to a mark in the line, not a short step, not with `own` off, not the silent squad',
          `run ${run} · cold ${cold} · mark in the line ${inLine} · a metre's step ${short} · own off ${off} · silent ${sil} · ${f2(d)} m, exposure here ${f2(exposedAt(g, m, p))}, at the mark ${f2(exposedAt(g, m, to))}`);
        F.verdict(!!mid && legOn && !legFresh && !legLine && !legEnd, 'cover: a leg begun is run out — on floor the line has left, the loud gone cold, a man already running keeps the run; not to a mark in the line, not the last half metre',
          mid ? `${f2(legLeft)} m short of the mark, exposure there ${f2(exposedAt(g, m, mid))} (the bar to start is ${TEAMPACE.dashSeen}): running ${legOn} · asked afresh ${legFresh} · mark in the line ${legLine} · half a metre left ${legEnd}` : 'no floor on the leg where the line has let go of him short of the mark');
        console.log(`    (printed, not judged — the order deals each man his own spot: sent there hot, top ${f2(wHot.top)} m/s, cover runs written ${wHot.n}${wHot.why ? `, refused: ${wHot.why}` : ''} · cold, top ${f2(wCold.top)} m/s, written ${wCold.n})`); }
      // 7. boots
      { const run = teamTread(g, m, 4.7, 0.45) as number, jog = teamTread(g, m, 2.3, 0.45) as number, at = teamTread(g, m, TEAMPACE.runAt - 0.01, 0.45) as number;
        F.verdict(Math.abs(run / jog - TEAMPACE.step / 0.8) < 1e-9 && at === jog, 'a sprinter\'s boots: at a run the footfall is the player\'s own sprint\'s level; under it, as it was', `at 4.7: ${f2(run)} · at 2.3: ${f2(jog)} · just under a run: ${f2(at)}`); } }
    // ---- 8. the journal
    { const J = await import(`${ROOT}/src/game/journal.ts`), R = await rig(SCN, 5), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.game)));
      TEAMPACE.on = true; const old = snap(); delete old.tables.TEAMPACE; J.applyKnobs(R.game, old); const a = TEAMPACE.on;
      TEAMPACE.on = true; const yes = snap(); TEAMPACE.on = false; J.applyKnobs(R.game, yes); const b = TEAMPACE.on;
      TEAMPACE.on = false; const no = snap(); TEAMPACE.on = true; J.applyKnobs(R.game, no); const c = TEAMPACE.on;
      F.verdict(a === false && b === true && c === false, 'the journal: a recording from before the key replays with it off, one made with it on replays on, one made with it off replays off', `old → ${a} · recorded on → ${b} · recorded off → ${c}`); }
  } finally { Object.assign(TEAMPACE, keep.tp); Math.random = keep.rnd; DESTRUCTION.on = keep.d; WALLCHARGE.on = keep.w; WALLCHARGE.outer = keep.o; PICTURE.on = keep.pic; SILENT.on = keep.sil; TEAMPACE_DEBUG.log = keep.dbg; }
  return F.done();
});

if (import.meta.main) process.exit((await teampaceCheck()) ? 0 : 1);
