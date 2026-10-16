// STANDING OFF A WALL CHARGE OUT OF KNOWN FIRE — the check behind WALLCHARGE.outOfFire (src/game/wallcharge.ts underFire / knownFoes: on in the page,
// ?standfire=0; off on the frozen stand, TPS_STANDFIRE=1; acts only with WALLCHARGE.safe, which this check raises as the wall charge's own probes do).
//   bun run tools/qa/standfire-check.ts        (also `probes.ts standfire`)
// The maintainer's own case, staged from his tape (The pass, 10-14: "the two guys move away from the wall charge to a place that doesn't make sense (isn't safe
// since there are known enemies that can shoot them from there)"): a charge on the bunk room's long wall from the yard, three men to stand off, and the team
// knowing what it knew then — a man in the bunk room called nine seconds before, another by its west window and one at the tea room's window, each where he was
// last seen. The marks as they were ran along the wall past its end, across the bunk room window's lane.
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) the staging, the rule off: the marks as they were, one of them in the middle of a known man's lane;
//   (3) the rule on, Sam where he stood: no mark as much under fire as the worst of those, less of it in all, every mark still out of the blast;
//   (4) Sam elsewhere: the least exposed place — back across the yard, where he had stood — is the first mark dealt (the setter's);
//   (5) nobody known: the marks as they were — the rule acts on what the team knows and nothing else;
//   (6) a sighting counts fireKnownS and no longer: a man last seen 29 s ago is stood off from, one last seen 31 s ago is not;
//   (7) the fog off (the picture shows everybody): a living enemy counts where he stands;
//   (7b) a man the squad is shooting at counts where he stands (he is in the picture) · (7c) the wall about to go is no cover where it will open;
//   (8) the order itself deals those marks, and the men walk to them and stand;
//   (9) a recording from before the key replays with it off; the page's boot: no flag = on, ?standfire=0 = off.
// STANDFIRE_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail on what they find.   exit 0 = all hold · 1 = one does not
// Headless: lines are the collision's own (glass passes). Never seen on a GPU; nobody has played it.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const { WALLCHARGE, WALL_ORDER, wallAt, wallTarget, wallPt, safeRadius } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
type Vec3 = [number, number, number];

/** the tape's moment: the charge's place on the wall, where Sam and the three stood when the order was given, and where the team had last seen the three it knew of */
const CHARGE: Vec3 = [31.28, 0, 18.14],   // (on the wall's yard face: wallAt takes a point within WALLCHARGE.pickM of it)
  SAM: Vec3 = [26.4, 0, 20.8], ELSEWHERE: Vec3 = [22.0, 0, 20.5];
const MEN: Record<string, Vec3> = { 'Red Two': [28.8, 0, 19.9], 'Blue One': [27.3, 0, 20.4], 'Blue Two': [27.6, 0, 19.3] };
const BUNK: Vec3 = [30.5, 0, 11.9], KNOWN: [Vec3, number][] = [[BUNK, 9.5], [[31.0, 0, 15.2], 14.0], [[19.2, 0, 9.6], 14.3]];

export async function standfireCheck(): Promise<boolean> {
  const BREAK = process.env.STANDFIRE_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== standfire: the men who stand off a wall charge keep out of the fire of the enemies the team knows of${BREAK ? ' — STANDFIRE_BREAK: the rule never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  const data = parseLevelData(readFileSync(`${ROOT}/levels/pass.json`, 'utf8'));
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { const W: any = await quiet(() => standUp({})); void W; const stood = WALLCHARGE.outOfFire;
      const word = process.env.TPS_STANDFIRE, shipped = process.env.TPS_PROFILE === 'shipped', want = word !== undefined ? word === '1' : shipped, row = FROZEN_HOLDS['WALLCHARGE.outOfFire'];
      line(stood === want && typeof row === 'string' && /TPS_STANDFIRE=1/.test(row), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; FROZEN_HOLDS carries the row and its word`,
        `after the stand-up: ${stood} · TPS_STANDFIRE ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · FROZEN_HOLDS['WALLCHARGE.outOfFire'] = ${row ?? 'MISSING'}`); }

    /** The pass, the four in the yard as the tape had them (Red One down), every defender out of the way: what the team knows is what `know` writes */
    const stage = async () => {
      DESTRUCTION.on = true; WALLCHARGE.on = true;   // (the destruction switch raised as the wall charge's own probes raise it)
      const W: any = await quiet(() => standUp({ level: loadLevel(data), seed: 1 })); const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
      WALLCHARGE.outer = true; WALLCHARGE.safe = true; WALLCHARGE.outOfFire = false;   // (after the stand-up: the frozen stand holds them off)
      const why = await quiet(async () => startFromQuery(g, '?levelFile=pass.json&roomclear&squad4').why); if (why) throw new Error(`start refused — ${why}`);
      const step = (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) W.step(1 / 60); };
      const put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.path = []; gd.pathGoal = null; gd.speed = 0; };
      const O = g.orders, C = g.wallCharge; if (C.carried !== null) C.setCarried(2);   // (the shipped stand's kit: a wall charge is carried or there is none)
      const fog = g.fogOfWar, foes: any[] = g.guards.filter((h: any) => h.team === 'hostile');
      for (const h of foes) put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
      const men: any[] = O.men('all'), one = men.find(m => m.callsign === 'Red One'); if (one) killGuard(g, one, [1, 0, 0], true);
      for (const m of men) if (MEN[m.callsign]) put(m, MEN[m.callsign]);
      g.teleportPlayer(SAM); step(0.5); for (const m of men) if (MEN[m.callsign]) put(m, MEN[m.callsign]);
      const Wl = wallAt(g, CHARGE), spot: Vec3 | null = Wl ? C.setSpot(Wl) : null;
      /** what the team knows: the fog on, and of the living enemies only these — each last seen `age` s ago at his place (he stands 400 m off) */
      const know = (list: [Vec3, number][]) => { fog.on = true; for (const h of foes) fog.recs.delete(h);
        list.forEach(([p, age], i) => fog.recs.set(foes[i], { seen: false, t: g.time - age, at: [p[0], 0, p[2]], body: false, smoked: false, smokeF: -1e9 })); };
      const sam = (p: Vec3) => { g.player.char.pos[0] = p[0]; g.player.char.pos[2] = p[2]; };
      /** the three marks the stand-off search deals, the rule on or off */
      const deal = (on: boolean): Vec3[] | null => { WALLCHARGE.outOfFire = on; try { return C.safePosts(Wl, 3, spot); } finally { WALLCHARGE.outOfFire = false; } };
      const fire = (q: Vec3): number => C.fireAt(q, Wl), words = (P: Vec3[] | null) => P ? P.map(q => `${at(q)} fire ${fire(q)}`).join(' · ') : 'none';
      const clear = (P: Vec3[]) => P.every(q => C.blastShare(Wl, q, undefined, false) === 0);
      return { W, g, O, C, fog, foes, men, Wl, spot, step, put, know, sam, deal, fire, words, clear };
    };
    const max = (S: any, P: Vec3[]): number => Math.max(...P.map(q => S.fire(q) as number)), sum = (S: any, P: Vec3[]) => P.reduce((a: number, q) => a + S.fire(q), 0), same = (a: Vec3[] | null, b: Vec3[] | null) => JSON.stringify(a) === JSON.stringify(b);

    const S = await stage();
    if (!S.Wl || !S.Wl.ok || !S.spot) { line(false, 'the bunk room\'s long wall takes a charge from the yard', `wall ${S.Wl ? `${S.Wl.index} ok ${S.Wl.ok} ${S.Wl.why ?? ''}` : 'none'} · spot ${S.spot ? at(S.spot) : 'none'}`); return false; }
    S.know(KNOWN); S.sam(SAM);
    const off = S.deal(false), on = S.deal(RULE);
    // (2)
    line(!!off && max(S, off) >= 4 && S.clear(off), 'the staging, the rule off: three marks out of the blast as they were — and one of them stands in the middle of a known man\'s lane',
      `charge ${at(wallPt(S.Wl, 0, 0))}, stand-off ${safeRadius(S.g, S.Wl).standoff} m · known at ${S.C.knownFoes().map(at).join(' ')} · marks ${S.words(off)}`);
    if (!off) return false;
    // (3)
    line(!!on && max(S, on) < max(S, off) && sum(S, on) < sum(S, off) && S.clear(on), 'the rule on, Sam where he stood: no mark is as much under fire as the worst of those, there is less of it in all, and every mark is still out of the blast',
      `marks ${S.words(on)} · worst ${on ? max(S, on) : '–'} (was ${max(S, off)}) · in all ${on ? sum(S, on) : '–'} (was ${sum(S, off)})`);
    // (4)
    { S.sam(ELSEWHERE); const o2 = S.deal(false), n2 = S.deal(RULE);
      line(!!n2 && !!o2 && n2.every(q => S.fire(n2[0]) <= S.fire(q)) && o2.every(q => S.fire(n2[0]) < S.fire(q)) && !o2.some(q => flat(q, n2[0]) < 0.8) && S.clear(n2), 'Sam elsewhere: the first mark dealt — the setter\'s — is the least under fire of them, less than any of the marks as they were, and a place those never took (back across the yard, where he had stood)',
        `marks ${S.words(n2)} · as they were ${S.words(o2)}`); S.sam(SAM); }
    // (5)
    { S.know([]); const n3 = S.deal(RULE);
      line(S.C.knownFoes().length === 0 && same(n3, off), 'nobody known: the marks as they were', `known ${S.C.knownFoes().length} · marks ${S.words(n3)}`); }
    // (6)
    { S.know([[BUNK, WALLCHARGE.fireKnownS - 1]]); const fresh = S.deal(RULE), offA = S.deal(false), kA = S.C.knownFoes().length, mF = fresh ? max(S, fresh) : -1, mO = offA ? max(S, offA) : -1, wA = `${S.words(fresh)} (as they were ${S.words(offA)})`;
      S.know([[BUNK, WALLCHARGE.fireKnownS + 1]]); const stale = S.deal(RULE), kB = S.C.knownFoes().length;
      line(kA === 1 && kB === 0 && !!fresh && !!offA && !same(fresh, offA) && mF < mO && same(stale, off), `a sighting counts ${WALLCHARGE.fireKnownS} s and no longer: the man in the bunk room last seen ${WALLCHARGE.fireKnownS - 1} s ago is stood off from, last seen ${WALLCHARGE.fireKnownS + 1} s ago he is not`,
        `${WALLCHARGE.fireKnownS - 1} s: known ${kA}, marks ${wA}, worst ${mF} (was ${mO}) · ${WALLCHARGE.fireKnownS + 1} s: known ${kB}, marks ${stale ? stale.map(at).join(' · ') : 'none'}`); }
    // (7)
    { S.know([]); S.fog.on = false; S.put(S.foes[0], BUNK); const k = S.C.knownFoes(), n5 = S.deal(RULE), o5 = S.deal(false);
      line(!S.fog.active && k.length === S.foes.filter((h: any) => h.state !== 'dead').length && k.some((p: Vec3) => flat(p, BUNK) < 0.01) && !!n5 && !!o5 && !same(n5, o5) && max(S, n5) < max(S, o5), 'the fog off (the picture shows everybody): a living enemy counts where he stands',
        `known ${k.length} of ${S.foes.length} (the rest stand 400 m off, past fireM), one at ${at(BUNK)} · marks ${S.words(n5)} · as they were ${S.words(o5)}`);
      S.put(S.foes[0], [BUNK[0] + 400, 0, BUNK[2]]); }
    // (7b) a man the squad is shooting at is in the picture: he counts where he stands, seen or not
    { const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`); const sf0 = FOG.squadFire; FOG.squadFire = true; S.know([]); S.put(S.foes[0], BUNK); const k0 = S.C.knownFoes().length;
      S.fog.firedAt.set(S.foes[0], S.fog.fireClock); const k1 = S.C.knownFoes(), n6 = S.deal(RULE), o6 = S.deal(false);
      line(S.fog.active && k0 === 0 && k1.length === 1 && flat(k1[0], BUNK) < 0.01 && !!n6 && !!o6 && max(S, n6) < max(S, o6), 'the fog on, a man nobody has seen: not known — until a teammate\'s aimed round goes at him (he is in the picture then): he counts where he stands',
        `known before ${k0} · after ${k1.map(at).join(' ')} · marks ${S.words(n6)} · as they were ${S.words(o6)}`);
      S.fog.firedAt.delete(S.foes[0]); FOG.squadFire = sf0; S.put(S.foes[0], [BUNK[0] + 400, 0, BUNK[2]]); }
    // (7c) the wall about to go is no cover where it will open
    { const BEHIND: Vec3 = [wallPt(S.Wl, 0, 0)[0], 0, 15.2]; S.know([[BEHIND, 5]]); const front: Vec3 = wallPt(S.Wl, 0, 2.4), aside: Vec3 = wallPt(S.Wl, -3, 2.4);
      const fWall = S.C.fireAt(front, S.Wl), fNone = S.C.fireAt(front), aWall = S.C.fireAt(aside, S.Wl), n7 = S.deal(RULE);
      line(fWall > 0 && fNone === 0 && aWall === 0 && !!n7 && n7.every(q => S.fire(q) === 0), 'a man known behind the wall, square behind the charge: the floor square in front of it is under his fire (the wall is about to go), three metres along it is not — and no mark is dealt in that lane',
        `${at(front)}: ${fWall} with the wall counted as the hole it will be, ${fNone} as it stands · ${at(aside)}: ${aWall} · marks ${S.words(n7)}`); }
    // (8) the order
    { S.know(KNOWN); S.sam(SAM); WALLCHARGE.outOfFire = RULE; const want = S.C.safePosts(S.Wl, 3, S.spot, (q: Vec3) => !S.O.reach(S.men.find((m: any) => m.callsign === 'Red Two'), q));
      const why = S.O.give(WALL_ORDER, wallTarget(S.g, CHARGE, { kind: 'floor', at: S.O.freeSpot?.(CHARGE) ?? CHARGE }), 'all'), op = S.C.ops[0];
      const posts: Vec3[] = op ? [...op.post.values()] : [], dealt = !!op && !!want && posts.length === 3 && posts.every(p => want.some((q: Vec3) => flat(p, q) < 0.01));
      const worst = posts.length ? max(S, posts) : -1, was = max(S, off), marks = S.words(posts);   // (read now: the sightings age as the men walk)
      S.step(14); const there = op ? [...op.post].map(([m, p]: [any, Vec3]) => `${m.callsign} ${m.state === 'dead' ? 'DOWN' : flat(m.char.pos, p).toFixed(1) + ' m off'}`) : [];
      const stood = !!op && [...op.post].every(([m, p]: [any, Vec3]) => m.state !== 'dead' && flat(m.char.pos, p) < 0.8) && S.C.tooClose(S.C.set[0] ?? null).length === 0;
      line(!why && dealt && worst < was && stood, 'the order itself: taken, the three dealt those marks, and fourteen seconds on each stands on his with the charge set and nobody too close',
        `give → ${why ?? 'taken'} · marks ${marks} · worst ${worst} (was ${was}) · ${there.join(' · ')} · phase ${op?.phase ?? '–'} · too close: ${S.C.tooClose(S.C.set[0] ?? null).join(', ') || 'nobody'}`);
      WALLCHARGE.outOfFire = false; }
    // (9) a recording from before the key replays with the rule off; the page's own boot
    { const g = S.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      WALLCHARGE.outOfFire = true; const old = snap(); delete old.tables.WALLCHARGE.outOfFire; JOURNAL.applyKnobs(g, old); const without = WALLCHARGE.outOfFire;
      const own = snap(); own.tables.WALLCHARGE.outOfFire = true; JOURNAL.applyKnobs(g, own); const withIt = WALLCHARGE.outOfFire;
      line(without === false && withIt === true, 'a recording from before the key replays with the rule off; one that carries it on plays with it on', `applyKnobs with no key → ${without} · with the key on → ${withIt}`);
      PROFILE.pageSwitches(new URLSearchParams('')); const a = WALLCHARGE.outOfFire; PROFILE.pageSwitches(new URLSearchParams('standfire=0')); const b = WALLCHARGE.outOfFire; PROFILE.pageSwitches(new URLSearchParams('wallfurn=0')); const c = WALLCHARGE.outOfFire;
      line(a === true && b === false && c === true, 'the page\'s boot (pageSwitches): no flag → on · ?standfire=0 → off · another flag leaves it on', `'' → ${a} · 'standfire=0' → ${b} · 'wallfurn=0' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); DESTRUCTION.on = destr0; Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== standfire: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await standfireCheck()) ? 0 : 1);
