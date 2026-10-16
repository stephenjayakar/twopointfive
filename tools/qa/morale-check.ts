// SHAKEN — the check behind src/game/morale.ts (MORALE.on: on in the page, ?nomorale; off on the frozen stand, TPS_MORALE=1). Standalone and through probes.ts:
//   bun run tools/qa/morale-check.ts          bun run tools/qa/probes.ts morale
// The compound's room clear, the guard hut's man 2.4 m behind his door (doorstun-check's staging: where the maintainer's replay had its man), the 40 mm's burst
// on the door's outside face as he40.ts asks it, the player off in the yard, wide of the door's line and too dim to be made out. The hut's own two lamps are
// put out for 'dark' and left burning for 'lit'; the rest of the garrison stands across the yard. Headless, PASS / FAIL each, on sim state:
//   (1) alone in the dark: BROKEN. While the blast's own stagger has him he is down, and neither steps nor fires; then the call goes out on the net BEFORE he
//       has moved and before any round (he says it, then he does it); inside 3.5 s of the stagger's end he is at least a metre further from the hole and still
//       facing it, and at least three real rounds have left his gun — the shots themselves, measured off the sim's own ray, lie toward the hole
//   (2) a living mate two metres off in the same dark hut: both JUMPY, neither broken; both down inside a second; nobody scrabbles, no round into the dust;
//       the one nearer the blast shouts it (not on the net), the other says nothing of this file's — and a second blast a second later breaks neither
//   (3) alone, the hut's lamps burning: jumpy, not broken
//   (4) THE BAIT, after (1) has settled into the hold: a thing thrown through the hole draws the rest of his magazine — the gun is empty by its own count —
//       then the shout that he is out, spoken, on the frame the magazine change starts, and not a round leaves his gun from that shout to the end of the change
//       (shots counted); a second throw draws the short burst; a third a word and no round
//   (5) the bait with a man in it: the player seen a stride inside the door, off the hole's line — the burst's shots, measured the same way, lie toward the HOLE, not toward
//       him; and once the change is over the next sighting ends the hold for good
//   (6) the office's night staff are men too: one of them alone in a blacked-out office with a grenade six metres off goes 'alert' by the floor's own rules
//       (his CONTACT, the alarm), draws, is broken the same way, and a checkpoint taken in his hold loads him the same man on the same rung in the same act
//   (7) a restart between a blast and the next tick: the fresh floor is fed nothing
//   (8) the hostage rescue's cast is nobody of this file's: a blast beside the captor meets no man of it
//   (9) every line of the file fits a bubble, names nothing off the blocklist, no compass word, none twice
//   (10) the switch off: none of it — no man met, nothing filed, no round, the summary empty — and the staged run draws and digests as a stand that never had
//       the rule on. THAT IS A SANITY LINE ONLY: 'off = the build as it was' is proven by the frozen digests of the gate's families (the switch is off on the
//       frozen stand, and every one of them runs through this file's seams), not by this case.
// These are the FIRST SLICE's men: every case runs with MORALE.training 'none' (nobody green, nobody a leader — training-check.ts is the check of those).
// It raises what it needs itself (blasts take doors off, the destruction dial, the switch), so it passes on the frozen stand and under TPS_PROFILE=shipped.
// MORALE_BREAK=1 = the alone and dark terms count for nothing (the rule broken, the switch left alone): (1), (4), (5) and (6) must fail.   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type V3 = [number, number, number];
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function moraleCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const M = await import(`${ROOT}/src/game/morale.ts`);
  const { MORALE, MORALE_STATS, MORALE_LOG, moraleOf, rungOf, dreadOf, moraleOwns, moraleSummary, moraleLines, inTheDark } = M;
  const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { FRAG, blast } = await import(`${ROOT}/src/game/frag.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { HE40 } = await import(`${ROOT}/src/game/he40.ts`);
  const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const D = await import(`${ROOT}/src/game/dialogue.ts`);
  const BREAK = process.env.MORALE_BREAK === '1'; let all = true;
  const { RUNNER } = await import(`${ROOT}/src/game/runner.ts`);
  const was = { morale: JSON.parse(JSON.stringify(MORALE)), frag: JSON.parse(JSON.stringify(FRAG)), door: DOORBLAST.on, sw: DESTRUCTION.on, runner: RUNNER.on, rnd: Math.random };
  const { DARKDOOR } = await import(`${ROOT}/src/game/darkdoor.ts`); const wasDoor = DARKDOOR.on;
  /** the later rules held off — again after every stand-up: standUp re-reads the stand's words (TPS_RUNNER=1 / TPS_DARKDOOR=1, the shipped stand) and raises them under a pin made once */
  const { NETQUIET: NQ_ } = await import(`${ROOT}/src/game/netquiet.ts`); const nq0_ = NQ_.on;   // (the net goes quiet, a later rule: held off here, after every stand-up — netquiet-check.ts holds it with the rest)
  const held = () => { RUNNER.on = false; DARKDOOR.on = false; NQ_.on = false; };
  held();   // (runner.ts, the second slice — on under TPS_PROFILE=shipped: a broken man caught dry with the enemy in his eyes drops it and runs, which ends THIS file's sequence in its case (5). This check is the first slice's own; runner-check.ts holds the two together)
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== morale: a blast shakes the men it does not hurt${BREAK ? ' (MORALE_BREAK: alone and dark count for nothing)' : ''} ===`);
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  let draws = 0;

  /** the hut, its man behind his door, the rest across the yard: `on` = the switch, `dark` = the hut's own lamps put out, `mate` = a second man two metres from him */
  const stage = async (seed: number, on: boolean, dark: boolean, mate = false) => {
    draws = 0; { const die = seeded(seed); Math.random = () => { draws++; return die(); }; }
    MORALE.on = false;
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }));
    const g = W.game; DOORBLAST.on = true; DESTRUCTION.on = true; FRAG.doorStun = true; g.tune.chaos = 0.5; MORALE.on = on; MORALE.training = 'none'; MORALE.nerve = 'normal'; held();
    if (BREAK) { MORALE.alone = 0; MORALE.dark = 0; }
    startFromQuery(g, 'levelFile=compound.json&roomclear&squad4'); g.godMode = true;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
    step(10);
    const d = g.doors.list.find((x: any) => x.def.name === 'hut_w'); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place();
    const mid = doorPt(d, d.def.width / 2, 0, 1, 0);
    const men = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, mid) - flat(b.char.pos, mid));
    const T = men[0], T2 = men[1];
    const inside: 1 | -1 = g.doors.side(d, T.char.pos), side = -inside as 1 | -1;
    { const s = doorPt(d, d.def.width / 2 + 9, 6, side, 0); g.teleportPlayer([s[0], 0, s[2]]); }   // (the player, and the team where it falls in behind him, well off the door's line: nobody of theirs looks in through the hole)
    const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; };
    const p = doorPt(d, d.def.width / 2, 2.4, inside, 0);
    men.forEach((o: any, i: number) => { if (o !== T) put(o, [4.8 + (i % 4) * 0.9, 0, 5.8 + Math.floor(i / 4) * 0.9]); });
    put(T, p); if (mate) { const q = doorPt(d, d.def.width / 2 + 1.6, 3.4, inside, 0); put(T2, q); }
    if (dark) for (const t of g.targets) if (t.on && flat(t.pos, p) < 5) g.toggleTarget(t);
    step(40);
    const hole = doorPt(d, d.def.width / 2, HE40.standoff + 0.03, side, 1.0) as V3;
    const shell = () => blast(g, [hole[0], hole[1] - FRAG.lift, hole[2]], { who: PLAYER_ID, name: '40 mm grenade' });
    /** a spent magazine lobbed in through the hole from the yard, by the player's hand */
    const toss = () => { const a = doorPt(d, d.def.width / 2, 1.2, side, 1.3), b = doorPt(d, d.def.width / 2, 0, side, 1.3), k = 4 / Math.max(1e-3, flat(a, b)); return g.items.spawn('mag', a, [(b[0] - a[0]) * k, 1.2, (b[2] - a[2]) * k], { who: PLAYER_ID, fill: 1 }); };
    return { W, g, d, T, T2, p, hole, inside, step, shell, toss };
  };
  type Rig = Awaited<ReturnType<typeof stage>>;
  /** step `secs`, noting every new bubble of `who`: [name, text, radio, sim seconds since the call began] */
  const listen = (R: Rig, who: any[], secs: number, each?: (t: number) => void) => {
    const said: { who: any; text: string; radio: boolean; t: number }[] = [], last = new Map<any, any>(who.map(h => [h, h.bubble]));
    for (let i = 1; i <= Math.round(secs * 60); i++) { R.step(); for (const h of who) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h, text: b.text, radio: !!b.radio, t: i * DT }); } } each?.(i * DT); }
    return said;
  };
  const fired = (gd: any) => gd.weapon.shotsFired;
  const facing = (gd: any, at: number[]) => Math.abs(wrap(Math.atan2(at[0] - gd.char.pos[0], at[2] - gd.char.pos[2]) - gd.char.bodyYaw));
  /** every round that leaves `who`'s gun from here on, as the sim fires it: the muzzle and the direction of the round's own ray (combat.ts fireWeapon's cast down
   *  the bore, the first cast from his muzzle after his weapon counts a round off) — the shot itself, not this file's log of what it meant to do */
  const shots = (g: any, who: any) => { const out: { from: number[]; dir: number[] }[] = []; let owed = 0;
    const fire = who.weapon.fire.bind(who.weapon); who.weapon.fire = (...a: any[]) => { const ok = fire(...a); if (ok) owed++; return ok; };
    const cast = g.col.raycast.bind(g.col); g.col.raycast = (ro: number[], rd: number[], ...rest: any[]) => { if (owed > 0 && Math.hypot(ro[0] - who.char.muzzle[0], ro[1] - who.char.muzzle[1], ro[2] - who.char.muzzle[2]) < 0.05) { owed--; out.push({ from: [...ro], dir: [...rd] }); } return cast(ro, rd, ...rest); };
    return out; };
  /** how far a round's direction lies off the bearing of `at` from its muzzle, in plan (rad) */
  const off = (h: { from: number[]; dir: number[] }, at: number[]) => Math.abs(wrap(Math.atan2(h.dir[0], h.dir[2]) - Math.atan2(at[0] - h.from[0], at[2] - h.from[2])));
  const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  /** (1)'s run, kept for (4) and (5): the lone man in the dark, through the stagger and 3.5 s past it */
  const lone = async (seed: number) => {
    const R = await stage(seed, true, true), T = R.T, p0 = [...T.char.pos], d0 = flat(p0, R.hole), n0 = fired(T), dark0 = inTheDark(R.g, T), hits = shots(R.g, T); MORALE_LOG.length = 0;
    R.shell(); const stagger = T.staggerUntil - R.g.time;
    let downAt = NaN, stagMoved = 0, stagShots = 0, low = 0, frames = 0, movedAtCall = NaN, shotsAtCall = NaN, firstShot = NaN; const seenCall = { done: false };
    const said = listen(R, [T], stagger + 3.5, t => {
      if (Number.isNaN(downAt) && T.char.anim.crouch > 0.7) downAt = t;
      if (R.g.time < T.staggerUntil) { frames++; if (T.char.anim.crouch > 0.7) low++; stagMoved = Math.max(stagMoved, flat(T.char.pos, p0)); stagShots = fired(T) - n0; }
      if (Number.isNaN(firstShot) && fired(T) > n0) firstShot = t;
      if (!seenCall.done && T.bubble?.radio && moraleLines('call').includes(T.bubble.text)) { seenCall.done = true; movedAtCall = flat(T.char.pos, p0); shotsAtCall = fired(T) - n0; } });
    const call = said.find(s => s.radio && moraleLines('call').includes(s.text));
    return { R, T, p0, d0, n0, dark0, hits, stagger, said, call, downAt, stagMoved, stagShots, low, frames, movedAtCall, shotsAtCall, firstShot };
  };
  try {
    // (1) alone in the dark: broken
    const L = await lone(21);
    { const { R, T } = L, S = moraleOf(T), back = flat(T.char.pos, R.hole) - L.d0, real = fired(T) - L.n0, face = facing(T, R.hole), offs = L.hits.map(h => off(h, R.hole));
      line(L.stagger > 2 && L.downAt <= 1 && L.low >= L.frames - 60 && L.stagMoved < 0.05 && L.stagShots === 0,
        '(1) the blast\'s own stagger is honoured: he is down through it, and neither steps nor fires until it is over',
        `stagger ${f2(L.stagger)} s · down at ${f2(L.downAt)} s, low for ${L.low} of its ${L.frames} frames · moved ${f2(L.stagMoved)} m · rounds ${L.stagShots}`);
      line(!!L.call && L.call.who === T && L.call.t >= L.stagger + MORALE.downSecs - 0.1 && L.call.t <= L.stagger + MORALE.downSecs + 0.3 && L.movedAtCall < 0.05 && L.shotsAtCall === 0 && L.firstShot > L.call.t + 0.5,
        '(1) he says it, then he does it: the call goes out on the net before he has moved a hand\'s breadth and before any round',
        L.call ? `"${L.call.text}" (radio) at ${f2(L.call.t)} s · moved ${f2(L.movedAtCall)} m and ${L.shotsAtCall} rounds by then · first round at ${f2(L.firstShot)} s` : `no call · said: ${L.said.map(s => `"${s.text}"`).join(' ') || 'nothing'}`);
      line(T.state !== 'dead' && L.dark0 && rungOf(T) === 2 && T.char.anim.crouch > 0.7 && back >= 1 && face < 0.5 && real >= 3 && offs.length === real && mean(offs) < 0.2 && Math.max(...offs) < 0.45,
        '(1) alone in the dark, the 40 mm on his door: broken — down, a metre and more back off the hole and facing it, real rounds into the dust at the hole, inside 3.5 s of the stagger\'s end',
        `door off ${R.d.off} · dark before ${L.dark0} · ${S ? `dread ${f2(dreadOf(T))} rung ${S.rung} act ${S.act} alone ${S.alone} dark ${S.dark}` : 'NEVER MET'} · state ${T.state} · crouch ${f2(T.char.anim.crouch)} · ${f2(back)} m further off · ${f2(face)} rad off the hole · ${real} rounds left his gun · ${offs.length} shots measured, mean ${f2(mean(offs))} rad off the hole's bearing (worst ${f2(Math.max(0, ...offs))})`); }
    // (2) a mate at his shoulder: both jumpy
    { const R = await stage(22, true, true, true), T = R.T, T2 = R.T2, at0 = [T, T2].map(x => [...x.char.pos]), n0 = [fired(T), fired(T2)], sh0 = MORALE_STATS.shouts; MORALE_LOG.length = 0;
      const near = flat(T.char.pos, R.hole) <= flat(T2.char.pos, R.hole) ? T : T2, apart = flat(T.char.pos, T2.char.pos);
      R.shell(); const said = listen(R, [T, T2], 1); const down1 = [T, T2].map(x => x.char.anim.crouch);
      const rungs = [rungOf(T), rungOf(T2)], acts = [moraleOf(T)?.act, moraleOf(T2)?.act];
      const duck = said.filter(s => moraleLines('duck').includes(s.text)), shouts = MORALE_STATS.shouts - sh0;
      // …and a second burst a second on, too small to hurt anybody (frag.ts blast with its radii drawn in): shock is capped, and nobody with a mate breaks
      blast(R.g, [R.hole[0], R.hole[1] - FRAG.lift, R.hole[2]], { who: PLAYER_ID, name: 'frag grenade', lethalM: 0.05, woundM: 0.1, fx: false });
      const said2 = listen(R, [T, T2], 5); const moved = [T, T2].map((x, i) => flat(x.char.pos, at0[i])), shock = [moraleOf(T)?.shock ?? NaN, moraleOf(T2)?.shock ?? NaN], rungs2 = [rungOf(T), rungOf(T2)];
      const calls = [...said, ...said2].filter(s => [...moraleLines('call'), ...moraleLines('again')].includes(s.text));
      line(T.state !== 'dead' && T2.state !== 'dead' && rungs[0] === 1 && rungs[1] === 1 && down1.every(c => c > 0.7) && acts.every(a => a === 'duck') && moved.every(m => m < 0.3) && fired(T) === n0[0] && fired(T2) === n0[1] && MORALE_LOG.length === 0,
        '(2) the same blast, a living mate two metres off in the dark: both jumpy and down inside a second — nobody broken, nobody scrabbling, no round into the dust',
        `${apart.toFixed(1)} m apart · rungs ${rungs.join(' / ')} · crouch at 1 s ${down1.map(f2).join(' / ')} · acts ${acts.join(' / ')} · moved ${moved.map(f2).join(' / ')} m · rounds ${fired(T) - n0[0]} / ${fired(T2) - n0[1]}`);
      line(duck.length === 1 && duck[0].who === near && !duck[0].radio && duck[0].t <= 0.1 + MORALE.shoutGap && shouts === 1,   // (at once — or `shoutGap` after the floor's own CONTACT, where that was in his mouth)
        '(2) the nearer of the two shouts it as they go down — spoken, not on the net — and the other says nothing of this file\'s',
        duck.length ? duck.map(s => `${s.who.callsign}: "${s.text}"${s.radio ? ' (RADIO)' : ''} at ${f2(s.t)} s`).join(' · ') + ` · nearer: ${near.callsign}` : `no duck line · said: ${said.map(s => `"${s.text}"`).join(' ') || 'nothing'}`);
      line(rungs2[0] === 1 && rungs2[1] === 1 && shock.every(x => x <= MORALE.shockCap + 1e-9 && x > MORALE.blast) && !calls.length && fired(T) === n0[0] && fired(T2) === n0[1],
        '(2) a second blast a second later: shock is capped and neither man of a pair breaks — nobody calls the net with a mate at his shoulder',
        `rungs ${rungs2.join(' / ')} · shock ${shock.map(f2).join(' / ')} (cap ${MORALE.shockCap}) · calls ${calls.length} · rounds ${fired(T) - n0[0]} / ${fired(T2) - n0[1]}`); }
    // (3) alone in the light: jumpy
    { const R = await stage(23, true, false), T = R.T, n0 = fired(T), dark0 = inTheDark(R.g, T); R.shell(); R.step(60); const r1 = rungOf(T), c1 = T.char.anim.crouch; R.step(300);
      line(T.state !== 'dead' && !dark0 && r1 === 1 && rungOf(T) === 1 && c1 > 0.7 && fired(T) === n0 && !!moraleOf(T)?.alone,
        '(3) the same blast, alone with the hut\'s lamps burning: jumpy — he ducks — and not broken', `dark ${dark0} · alone ${moraleOf(T)?.alone} · dread ${f2(dreadOf(T))} rung ${r1} → ${rungOf(T)} · crouch at 1 s ${f2(c1)} · rounds ${fired(T) - n0}`); }
    // (4) the bait, on (1)'s man
    { const { R, T } = L; R.step(150); const S = () => moraleOf(T), act0 = S()?.act, held = T.char.anim.crouch > 0.7 && facing(T, R.hole) < 0.5, mag0 = T.weapon.roundsReady;
      const n0 = fired(T); R.toss(); let reloadAt = NaN, magAtOut = NaN, shotsAtOut = NaN, endAt = NaN, n = n0;
      const said = listen(R, [T], 12, t => { if (Number.isNaN(reloadAt) && T.reloadT >= 0) { reloadAt = t; magAtOut = T.weapon.roundsReady; shotsAtOut = fired(T); } if (!Number.isNaN(reloadAt) && Number.isNaN(endAt) && T.reloadT < 0) { endAt = t; n = fired(T); } });
      const out = said.find(s => moraleLines('out').includes(s.text)), long = shotsAtOut - n0, inWindow = n - shotsAtOut;
      line(act0 === 'hold' && held && mag0 >= 12 && long === mag0 && magAtOut === 0 && !Number.isNaN(endAt) && inWindow === 0 && fired(T) === n,
        '(4) a thing thrown through the hole: the rest of his magazine at the hole — the gun empty by its own count — then not a round leaves it until the change is over',
        `before: ${act0}, ${held ? 'low on the hole' : 'NOT low on the hole'}, ${mag0} in the gun · burst ${long} · in the gun at the shout ${magAtOut} · change ${f2(reloadAt)} → ${f2(endAt)} s (${f2(endAt - reloadAt)} s) · rounds fired in it ${inWindow}`);
      line(!!out && out.who === T && !out.radio && Math.abs(out.t - reloadAt) <= DT + 1e-6,
        '(4) he shouts that he is out on the frame the change starts — spoken, so the window is something the player hears', out ? `"${out.text}" at ${f2(out.t)} s (change at ${f2(reloadAt)} s)` : `no such line · said: ${said.map(s => `"${s.text}"`).join(' ') || 'nothing'}`);
      const a2 = S()?.act, n2 = fired(T); R.toss(); R.step(180); const short = fired(T) - n2;
      const a3 = S()?.act, n3 = fired(T); R.toss(); const said3 = listen(R, [T], 3); const none = fired(T) - n3, spent = said3.find(s => moraleLines('spent').includes(s.text));
      line(a2 === 'hold' && short === MORALE.baitShort && a3 === 'hold' && none === 0 && !!spent && !spent.radio && T.state !== 'dead',
        '(4) the second throw draws the short burst, the third a word and no round', `second: ${short} of ${MORALE.baitShort} (from ${a2}) · third: ${none} rounds (from ${a3})${spent ? `, "${spent.text}"` : ', NO WORD'} · baits ${S()?.baits}`); }
    // (5) the bait with a man standing in it
    { const L2 = await lone(21), { R, T } = L2, g = R.g; R.step(150); const act0 = moraleOf(T)?.act, n0 = fired(T);
      const him = doorPt(R.d, R.d.def.width / 2 + 1.5, 0.8, R.inside, 0); g.teleportPlayer([him[0], 0, him[2]]);
      const dHole = flat(him, R.hole), hits = shots(g, T); let seenAt = NaN, reloadAt = NaN;
      for (let i = 1; i <= 600 && Number.isNaN(reloadAt); i++) { g.player.visibility = 1; R.W.step(DT); if (Number.isNaN(seenAt) && moraleOf(T)?.act === 'bait') seenAt = i * DT; if (T.reloadT >= 0) reloadAt = i * DT; }
      const burst = fired(T) - n0, toHole = hits.map(h => off(h, R.hole)), toHim = hits.map(h => off(h, him)), apart = Math.abs(wrap(Math.atan2(him[0] - T.char.muzzle[0], him[2] - T.char.muzzle[2]) - Math.atan2(R.hole[0] - T.char.muzzle[0], R.hole[2] - T.char.muzzle[2])));
      for (let i = 0; i < 600 && moraleOf(T)?.act !== 'hold'; i++) { g.player.visibility = 0.05; R.W.step(DT); }
      const afterChange = moraleOf(T)?.act; for (let i = 0; i < 90; i++) { g.player.visibility = 1; R.W.step(DT); } const afterSight = moraleOf(T)?.act ?? 'none', owned = moraleOwns(T);
      for (let i = 0; i < 120; i++) { g.player.visibility = 0.05; R.W.step(DT); } const later = moraleOf(T)?.act ?? 'none';   // (nobody's man any more — or, with a team at the player's back, a dead one: either way not this file's)
      line(act0 === 'hold' && dHole <= MORALE.baitM && !Number.isNaN(seenAt) && burst >= 12 && toHole.length === burst && apart > 0.25 && mean(toHole) < 0.2 && mean(toHim) > apart / 2,
        '(5) a man standing a stride inside the door, off the hole\'s line, seen: the long burst goes at the HOLE, not at him',
        `he stands ${f2(dHole)} m from the hole, ${f2(apart)} rad off its bearing · bait at ${f2(seenAt)} s · ${burst} rounds · ${toHole.length} shots measured: mean ${f2(mean(toHole))} rad off the hole, ${f2(mean(toHim))} rad off the man`);
      line(afterChange === 'hold' && afterSight === 'none' && !owned && later === 'none',
        '(5) once the change is over, the next sighting ends the hold for good: he is the fight\'s man, and does not turn back to the hole',
        `after the change: ${afterChange} · with the man in his eyes: ${afterSight}, owned ${owned} · two seconds after he is lost again: ${later} (${T.state})`); }
    // (D) which dark: where he stands (the build as it was), or darkfoe.ts's reading of the floor he is watching (MORALE.darkRead 'watch', held off)
    { const { DARKFOE, DARKFOE_STATS, darkFoeBlind } = await import(`${ROOT}/src/game/darkfoe.ts`); const foeWas = DARKFOE.on;
      const R = await stage(31, true, true), g = R.g, T = R.T; R.shell(); R.step(60);
      const { inTheDark } = await import(`${ROOT}/src/game/morale.ts`), rowWas = MORALE.darkRead;
      DARKFOE.on = true; MORALE.darkRead = 'place'; const a0 = DARKFOE_STATS.asks, place: boolean = inTheDark(g, T), asked = DARKFOE_STATS.asks - a0;
      const blind: boolean = darkFoeBlind(g, T); MORALE.darkRead = 'watch'; const watch: boolean = inTheDark(g, T); DARKFOE.on = false; const watchOff: boolean = inTheDark(g, T);
      DARKFOE.on = foeWas; MORALE.darkRead = rowWas;
      line(rowWas === 'place' && place && asked === 0 && watch === blind && watchOff === place,
        '(D) the dark is read where he STANDS, and darkfoe.ts is not asked; the row \'watch\' hands the question to its reading of the floor he is watching — only with that rule on',
        `the hut's man a second after his door went, the lamps out: where he stands dark ${place} (darkfoe asked ${asked} times) · the floor he is watching dark to him ${blind} · 'watch': ${watch}, with DARKFOE off ${watchOff} · the row as shipped '${rowWas}'`); }
    // (6) the night staff, and a checkpoint in the hold
    { Math.random = seeded(41); MORALE.on = false; const W: any = await quiet(() => standUp()), g = W.game; MORALE.on = true; MORALE.training = 'none'; MORALE.nerve = 'normal'; held(); if (BREAK) { MORALE.alone = 0; MORALE.dark = 0; }
      g.playerInvisible = true; g.godMode = true; const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); }; step(10);
      const staff = g.guards.filter((x: any) => !x.unit && x.team === 'guard'), T = staff[0], name = T.callsign;
      for (const o of staff) if (o !== T) { o.hold = true; o.pinned = true; }   // (the rest of the shift held on their marks: nobody comes to the bang with a torch)
      for (const t of g.targets) if (t.on && t.kind !== 'breaker') g.toggleTarget(t);
      step(60); const p = [...T.char.pos], f = T.char.forward(), at: V3 = [p[0] + f[0] * 6.5, 0, p[2] + f[2] * 6.5];
      const clear = !g.col.segmentBlocked([at[0], 0.6, at[2]], [p[0], 1.2, p[2]]), dark0 = inTheDark(g, T), alone0 = !!moraleOf(T)?.alone, n0 = fired(T), state0 = T.state;
      blast(g, at, { who: PLAYER_ID, name: 'frag grenade', fx: false });
      let alertAt = NaN, firstShot = NaN, calm = 0, undrawn = 0, contact = false;
      for (let i = 1; i <= 480; i++) { step(); if (Number.isNaN(alertAt) && T.state === 'alert') alertAt = i * DT; if (T.bubble?.text === 'CONTACT!') contact = true;
        if (fired(T) > n0) { if (Number.isNaN(firstShot)) firstShot = i * DT; if (T.state !== 'alert') calm++; if (!T.drawn) undrawn++; } }
      line(state0 === 'patrol' && alertAt < 0.5 && contact && g.alarm.episode && fired(T) - n0 >= 3 && calm === 0 && undrawn === 0,
        '(6) a man of the night staff: he goes \'alert\' by the floor\'s own rules — his CONTACT, the alarm episode — and has his gun out before a round leaves it',
        `${name} · ${state0} → alert at ${f2(alertAt)} s · CONTACT said ${contact} · alarm episode ${g.alarm.episode} · first round at ${f2(firstShot)} s · frames firing while calm ${calm}, undrawn ${undrawn}`);
      const S0 = moraleOf(T), was5 = S0 ? { rung: S0.rung, act: S0.act, shock: S0.shock, baits: S0.baits, calls: S0.calls } : null, dust = fired(T) - n0;
      const snap = W.snapshot('morale', true); step(240);
      Math.random = seeded(5); W.restore(snap); const m2 = g.guards.find((x: any) => x.callsign === name), S1 = moraleOf(m2);
      const same = !!was5 && !!S1 && S1.rung === was5.rung && S1.act === was5.act && Math.abs(S1.shock - was5.shock) < 1e-9 && S1.baits === was5.baits && S1.calls === was5.calls;
      step(30); const low = m2.char.anim.crouch > 0.7 && moraleOwns(m2);
      line(T.state !== 'dead' && clear && same && was5!.rung === 2 && was5!.act === 'hold' && dust >= 3 && low,
        '(6) alone in a blacked-out office, a grenade six metres off: broken too — and a checkpoint taken in his hold loads him the same man, low on the hole',
        `${name} · line to the blast ${clear} · dark ${dark0} alone ${alone0} · saved rung ${was5?.rung} ${was5?.act} shock ${f2(was5?.shock ?? NaN)} calls ${was5?.calls} · rounds into the dust ${dust} · loaded rung ${S1?.rung} ${S1?.act} shock ${f2(S1?.shock ?? NaN)} · low and held after the load ${low}`); }
    // (7) a restart between a blast and the next tick
    { const R = await stage(24, true, true), T = R.T, fed0 = MORALE_STATS.fed, filed0 = MORALE_STATS.blasts; R.shell(); const filed = MORALE_STATS.blasts - filed0; R.g.clearAftermath(); R.step(90);
      line(filed === 1 && MORALE_STATS.fed === fed0 && (moraleOf(T)?.shock ?? 0) === 0 && (moraleOf(T)?.act ?? 'none') === 'none' && !moraleOwns(T),
        '(7) a restart between a blast and the next tick: the blast filed is dropped, and the floor after it is fed nothing', `filed ${filed} · fed ${MORALE_STATS.fed - fed0} · his shock ${f2(moraleOf(T)?.shock ?? 0)} · act ${moraleOf(T)?.act ?? 'none'}`); }
    // (8) the hostage rescue's cast
    { Math.random = seeded(42); MORALE.on = false; const W: any = await quiet(() => standUp()), g = W.game, Rs = g.rescue; g.godMode = true; const why = Rs.start(); MORALE.on = true; MORALE.training = 'none'; MORALE.nerve = 'normal'; held();
      for (let i = 0; i < 30; i++) W.step(DT); const cap = Rs.captor(), fed0 = MORALE_STATS.fed, filed0 = MORALE_STATS.blasts, cast: any[] = Rs.hostiles;
      const at: V3 = cap ? [cap.char.pos[0] + 1.2, 0, cap.char.pos[2]] : [0, 0, 0];
      if (cap) blast(g, at, { who: PLAYER_ID, name: 'frag grenade', lethalM: 0.05, woundM: 0.1, fx: false });
      let owned = 0; for (let i = 0; i < 120; i++) { W.step(DT); if (cast.some(x => moraleOwns(x))) owned++; }
      line(!!cap && Rs.active && MORALE_STATS.blasts - filed0 === 1 && MORALE_STATS.fed === fed0 && cast.every(x => !moraleOf(x)) && owned === 0,
        '(8) the hostage rescue: a blast a stride from the captor meets no man of its cast — his clock and his gun are the rescue\'s alone',
        cap ? `captor ${cap.callsign} · cast ${cast.length} · filed ${MORALE_STATS.blasts - filed0} · fed ${MORALE_STATS.fed - fed0} · men of the cast met ${cast.filter(x => moraleOf(x)).length} · frames owned ${owned}` : `no captor (${why ?? 'started'})`); }
    // (9) the words
    { const lines: string[] = moraleLines(), long = lines.filter(t => t.length > D.AIM_CHARS), blocked = lines.filter(t => D.blockedPhrase(t)), compass = lines.filter(t => /\b(north|south|east|west)/i.test(t)), twice = lines.filter((t, i) => lines.indexOf(t) !== i), tight = lines.filter(t => /\S—\s|\s—\S/.test(t));
      line(lines.length >= 12 && !long.length && !blocked.length && !compass.length && !twice.length && !tight.length && (['duck', 'call', 'again', 'out', 'spent'] as const).every(k => moraleLines(k).length >= 3),
        `(9) every line fits a bubble (≤ ${D.AIM_CHARS}), none on the originality blocklist, no compass word, none twice`, `${lines.length} lines · too long: ${long.join(' | ') || 'none'} · blocked: ${blocked.join(' | ') || 'none'} · twice: ${twice.join(' | ') || 'none'}`); }
    // (10) off: a sanity line (the proof is the gate's frozen digests)
    { const run = async () => {
        const R = await stage(31, false, true), T = R.T, n0 = fired(T), p0 = [...T.char.pos], st: Record<string, number> = { ...MORALE_STATS }; MORALE_LOG.length = 0; let s = '', low = 0;
        R.shell(); for (let i = 0; i < 480; i++) { R.step(); if (T.char.anim.crouch > 0.5) low++; if (i % 20 === 19) s += hashDigest(digestGame(R.g, true)) + ' '; }
        const filed: number = Object.keys(st).reduce((a: number, k: string) => a + ((MORALE_STATS as any)[k] - (st as any)[k]), 0);
        return { s, draws, met: R.g.guards.filter((x: any) => moraleOf(x)).length, filed, rounds: fired(T) - n0, moved: flat(T.char.pos, p0), low, sum: moraleSummary(R.g), owns: R.g.guards.some((x: any) => moraleOwns(x)) };
      };
      const base = await run();   // (a stand that never had the rule on)
      { const R = await stage(32, true, true); R.shell(); R.step(120); }   // …the rule run in between, in this process…
      const off = await run();
      line(off.met === 0 && off.filed === 0 && off.rounds === 0 && off.moved < 0.05 && off.low === 0 && off.sum === '' && !off.owns && off.draws === base.draws && off.s === base.s,
        '(10) the switch off: no man met, nothing filed, no round, nobody down or moved, the summary empty — and the run draws and digests as a stand that never had the rule on',
        `men met ${off.met} · filed ${off.filed} · rounds ${off.rounds} · moved ${f2(off.moved)} m · frames low ${off.low} · summary '${off.sum}' · die draws ${off.draws} (base ${base.draws}) · twenty-four digests equal ${off.s === base.s}`); }
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { Object.assign(MORALE, was.morale); Object.assign(FRAG, was.frag); DOORBLAST.on = was.door; DESTRUCTION.on = was.sw; RUNNER.on = was.runner; DARKDOOR.on = wasDoor; NQ_.on = nq0_; Math.random = was.rnd; }
  console.log(`=== morale: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await moraleCheck()) ? 0 : 1);
