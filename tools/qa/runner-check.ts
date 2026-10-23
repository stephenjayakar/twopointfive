// DROPS IT AND RUNS — the check behind src/game/runner.ts (RUNNER.on: on in the page, ?norunner; off on the frozen stand, TPS_RUNNER=1 beside TPS_MORALE=1).
// Standalone and through probes.ts:
//   bun run tools/qa/runner-check.ts          bun run tools/qa/probes.ts runner
// morale-check's staging: the compound's room clear, the guard hut's man 2.4 m behind his door in a hut with its lamps put out, the 40 mm's burst on the door —
// he is BROKEN (morale.ts), holds low on the hole; a magazine lobbed through it draws the rest of his own (the bait), and his change begins: the DRY WINDOW.
// The player is then stood in front of him. Where the rest of the garrison is differs by case. Headless, PASS / FAIL each, on sim state:
//   (1) broken, alone, dry, the player in his eyes 2.5 m off: he shouts it — spoken — BEFORE the weapon leaves his hand (no weapon item of his on the floor at
//       the shout, one `beatSecs` later), he is at least two metres from where he dropped it two seconds on, never faster than the guards' chase pace, and
//       not a round leaves his gun from the shout to the end
//   (2) two living mates left on their posts in another room: he reaches one, shouts it to them, the mates in earshot are TOLD — the room fight's noise record
//       on the post of the man he ran in on reads the place the enemy stood, stamped at the tell — he goes on out, and is taken off the floor once out with no enemy's line on him
//   (3) no mate left alive: straight out (never the mates' leg) and off the floor
//   (4) …and with him the last man up, the room clear reads 'taken' while he is still alive and running
//   (5) a teammate stood beside the player with a clear line to him as he runs: never his target, not a round — and the SAME teammate on the same line takes
//       the same man when he has not run (the control: the switch off for that run)
//   (6) shot while running: he goes down like any man, and no second weapon falls — the one item of his on the floor is the one he dropped
//   (7) broken but not dry (the player in his eyes before the bait) · dry but not alone (a mate at his shoulder) · dry, alone, the enemy in his eyes seven
//       metres off: nobody runs
//   (8) the switch off (MORALE on): nobody is taken, nothing falls, he changes his magazine — and the run draws and digests as a stand that never had the rule
//       on. A SANITY LINE ONLY, as morale-check's: 'off = the build as it was' is proven by the frozen digests of the gate's families.
//   (9) every line of the file fits a bubble, names nothing off the blocklist, no compass word, none twice
//   (10) a man of the NIGHT STAFF (the default level's own roster, started through runnerBreak): never taken off the floor, nobody's free man on his round
//        (Guard.hold + pinned: what the chat, the needs and the greetings ask), no torch — and the game's own checkpoint (savestate.ts through the harness's
//        snapshot / restore) brings his run back: fled, the same phase, the same place to tell, still held
//   (11) AFTER GONE: two and a half seconds on from the frame he left the floor, the room clear's attempt, the night breach's staging count, the player
//        object and the head count are what they were (the scenario's "my cast was taken away" test does not restart the floor) — in the room clear with
//        mates alive, with none, and in a bare night breach (the man started through runnerBreak and, fled, taken off the floor by the check's own despawnUnit:
//        that level is one roof, he has no way out of it)
//   (12) NO WAY OUT (nothing counts as outside): the corner — low, his face to the wall (away from the enemy), not a word, still fled, still on the floor;
//        held where he stands on each run at a way out, he gives up after `retries` and stays; his runs not spent and the way free, he is out
//   (13) the enemy ONE metre in front of him at the shout: he gains distance — never low at the man's feet
//   (14) GRABBED after the drop: held like any man, his light dark in Sam's arm, still fled; let go, he runs again; no second weapon ever
//   (15) an operative of the team's with NO script (the floor's own target pick, guards.ts acquireFoe) on a clear line: never his foe, not a round — and
//        the control takes the same man when he has not run
//   (16) his squad (enemysquads.ts, raised for the case) counts him out: the last man of it fled, the squad reads nobody up
// NOT STAGED: a grenade wind-up cancelled by the shout (frag.ts's wind-up is private to its book; the clause is one line beside the dead / held test).
// It raises what it needs itself (blasts take doors off, the destruction dial, both switches), so it passes on the frozen stand and under TPS_PROFILE=shipped.
// RUNNER_BREAK=1 = the FLED MARK never sticks (wiped before every frame: the run itself goes on, and every seam that asks `runnerFled` is told no) — the
// counting, the team's eyes, the empty hand, the scenario's cast test and the squad's count all answer as the build without the rule: must fail.
// exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type V3 = [number, number, number];
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function runnerCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const { MORALE, moraleOf, rungOf, trainingOf, leaderOf, sawLeaderFall } = await import(`${ROOT}/src/game/morale.ts`);
  const { DARKDOOR } = await import(`${ROOT}/src/game/darkdoor.ts`); const wasDoor = DARKDOOR.on;
  const { RUNNER, RUNNER_STATS, runnerOf, runnerFled, runnerOwns, runnerLines, runnerSummary, runnerBreak } = await import(`${ROOT}/src/game/runner.ts`);
  const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { pictureTell } = await import(`${ROOT}/src/game/picture.ts`);
  const { FRAG, blast } = await import(`${ROOT}/src/game/frag.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { HE40 } = await import(`${ROOT}/src/game/he40.ts`);
  const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { despawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
  const { digInPhase } = await import(`${ROOT}/src/game/digin.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const D = await import(`${ROOT}/src/game/dialogue.ts`);
  const { SQUADS, squadsReport, squadsLive } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { startGrab, freeHeld } = await import(`${ROOT}/src/game/player.ts`);
  const BREAK = process.env.RUNNER_BREAK === '1'; let all = true;
  const was = { runner: JSON.parse(JSON.stringify(RUNNER)), morale: JSON.parse(JSON.stringify(MORALE)), frag: JSON.parse(JSON.stringify(FRAG)), door: DOORBLAST.on, sw: DESTRUCTION.on, squads: SQUADS.on, rnd: Math.random };
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== runner: a broken man caught dry drops it and runs${BREAK ? ' (RUNNER_BREAK: the fled mark never sticks)' : ''} ===`);
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  let draws = 0;
  /** THE FIRST SLICE'S MEN, as these cases were staged before a man was green or steady (MORALE.training 'none': every man folds, fires into the dust and empties
   *  his magazine on the bait — under 'difficulty' a steady man copes trained and is never dry), and the doorway rule held off (darkdoor-check.ts is its own).
   *  After every stand-up, which re-reads the stand's words. Case (12) alone sets a training: its man has a leader to lose */
  const { NETQUIET: NQ_ } = await import(`${ROOT}/src/game/netquiet.ts`); const nq0_ = NQ_.on;   // (the net goes quiet, a later rule: held off here, after every stand-up — netquiet-check.ts holds it with the rest)
  const first = () => { MORALE.training = 'none'; MORALE.nerve = 'normal'; DARKDOOR.on = false; NQ_.on = false; };
  const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
  /** RUNNER_BREAK: the mark off every man before the frame (and off one already taken off the floor) */
  const wipe = (g: any, also: any[] = []) => { if (BREAK) for (const x of [...g.guards, ...also]) { const S = runnerOf(x); if (S) (S as any).fled = false; } };

  /** the hut's man broken and holding (morale-check's stage and its lone run), then baited dry: `on` = this file's switch; `mates` = where the rest of the
   *  garrison is — parked across the yard in the shed · the two nearest left on their own posts, the rest parked · every one of them down; `squad` = the
   *  player's team staged with him (blind until the case wants one of them); `shoulder` = a mate put two metres from him as his change begins */
  const stage = async (seed: number, on: boolean, mates: 'parked' | 'posts' | 'none' = 'parked', squad = false, shoulder = false, bait = true, squads = false) => {
    draws = 0; { const die = seeded(seed); Math.random = () => { draws++; return die(); }; }
    MORALE.on = false; RUNNER.on = false; Object.assign(RUNNER, was.runner, { on: false }); SQUADS.on = squads;
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }));
    const g = W.game; DOORBLAST.on = true; DESTRUCTION.on = true; FRAG.doorStun = true; g.tune.chaos = 0.5; MORALE.on = true; RUNNER.on = on; RUNNER.anyway = false; first();   // (anyway: the later rule — both guns down, the run past a known enemy — has its own check, runanyway-check; these lines are the rule under it)
    startFromQuery(g, `levelFile=compound.json&roomclear${squad ? '&squad4' : ''}`); g.godMode = true;
    const gone: any[] = [];
    let vis = 0.05; const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; wipe(g, gone); W.step(DT); } };
    step(10);
    const d = g.doors.list.find((x: any) => x.def.name === 'hut_w'); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place();
    const mid = doorPt(d, d.def.width / 2, 0, 1, 0);
    const men = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, mid) - flat(b.char.pos, mid));
    const T = men[0], near: any[] = mates === 'posts' ? men.slice(1, 3) : [], ops: any[] = g.nightBreach.ops; gone.push(T);
    const inside: 1 | -1 = g.doors.side(d, T.char.pos), side = -inside as 1 | -1;
    const yard = doorPt(d, d.def.width / 2 + 9, 6, side, 0);
    g.teleportPlayer([yard[0], 0, yard[2]]);   // (the player well off the door's line: nobody of his looks in through the hole)
    for (const o of ops) o.dazzledUntil = 1e9;   // (the team sees nothing until the case that wants one of them)
    const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; };
    const p = doorPt(d, d.def.width / 2, 2.4, inside, 0);
    men.forEach((o: any, i: number) => { if (o === T || near.includes(o)) return; if (mates === 'none') killGuard(g, o, [1, 0, 0], true, 'struck', 'guard'); else put(o, [4.8 + (i % 4) * 0.9, 0, 5.8 + Math.floor(i / 4) * 0.9]); });
    put(T, p);
    for (const t of g.targets) if (t.on && flat(t.pos, p) < 5) g.toggleTarget(t);
    step(40);
    const hole = doorPt(d, d.def.width / 2, HE40.standoff + 0.03, side, 1.0) as V3;
    blast(g, [hole[0], hole[1] - FRAG.lift, hole[2]], { who: PLAYER_ID, name: '40 mm grenade' });
    step(Math.round((T.staggerUntil - g.time + 3.5) * 60) + 150);
    const held = moraleOf(T)?.act === 'hold' && rungOf(T) === 2, mag0 = T.weapon.roundsReady;
    /** the weapon items of his on the floor */
    const guns = () => g.items.items.filter((it: any) => it.who === T.char.id && (it.kind === 'rifle' || it.kind === 'pistol'));
    /** the player stood `m` metres in front of him, on his line to the hole, lit */
    const front = (m: number) => { const tp = T.char.pos, l = flat(tp, hole) || 1, at: V3 = [tp[0] + (hole[0] - tp[0]) / l * m, 0, tp[2] + (hole[2] - tp[2]) / l * m]; g.teleportPlayer(at); vis = 1; return at; };
    const away = () => { g.teleportPlayer([yard[0], 0, yard[2]]); vis = 0.05; pictureTell(g, T, 'player', g.player.char.pos); };   // (a player who walked back out would have been WATCHED going: under picture.ts PICTURE.run the man plans by where he believes him, and a teleport is nothing he could have seen)
    let dry = false, outT = NaN;   // (outT: the game clock on the frame his change began — morale.ts's shout that he is out)
    if (bait) {
      const a = doorPt(d, d.def.width / 2, 1.2, side, 1.3), b = doorPt(d, d.def.width / 2, 0, side, 1.3), k = 4 / Math.max(1e-3, flat(a, b));
      g.items.spawn('mag', a, [(b[0] - a[0]) * k, 1.2, (b[2] - a[2]) * k], { who: PLAYER_ID, fill: 1 });
      for (let i = 0; i < 600 && !(T.reloadT >= 0); i++) step();
      dry = T.reloadT >= 0 && T.weapon.roundsReady === 0 && moraleOf(T)?.act === 'reload'; outT = g.time;
      if (shoulder) { const q = [T.char.pos[0], 0, T.char.pos[2] + (T.char.pos[2] > p[2] ? -1 : 1) * 1.2]; put(men[1], q); step(20); }   // (in his view, inside morale's aloneM: read on his next asking)
    }
    return { W, g, d, T, men, near, ops, hole, step, put, guns, front, away, held, mag0, dry, yard, outT };
  };
  type Rig = Awaited<ReturnType<typeof stage>>;
  /** step `secs`, noting every new bubble of `who`: [who, text, radio, sim seconds since the call began] */
  const listen = (R: Rig, who: any[], secs: number, each?: (t: number) => boolean | void) => {
    const said: { who: any; text: string; radio: boolean; t: number }[] = [], last = new Map<any, any>(who.map(h => [h, h.bubble]));
    for (let i = 1; i <= Math.round(secs * 60); i++) { R.step(); for (const h of who) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h, text: b.text, radio: !!b.radio, t: i * DT }); } } if (each?.(i * DT)) break; }
    return said;
  };
  const fired = (gd: any) => gd.weapon.shotsFired;
  const st = (gd: any) => { const S = runnerOf(gd); return S ? `${S.phase}${S.fled ? ' fled' : ''}` : 'not taken'; };
  /** (11) what a restart would move, and whether `secs` on it is all as it was */
  const floorOf = (g: any) => ({ attempt: g.roomClear.attempt, staged: g.nightBreach.staged, player: g.player, n: g.guards.length });
  const afterGone = (R: { g: any; step: (n?: number) => void }, where: string, went: boolean) => { const g = R.g, a = floorOf(g); R.step(150); const b = floorOf(g);
    line(went && a.attempt === b.attempt && a.staged === b.staged && a.player === b.player && a.n === b.n,
      `(11) after gone, ${where}: 2.5 s on the floor has not been restarted — the same attempt, the same staging, the same player, the same head count`,
      `he left the floor ${went} · attempt ${a.attempt} → ${b.attempt} · stagings ${a.staged} → ${b.staged} · the player object the same ${a.player === b.player} · heads ${a.n} → ${b.n}`); };
  try {
    // (8, first half) a stand that has never had the rule on: the run every later 'off' is held against
    const offRun = async () => {
      const R = await stage(31, false), T = R.T, n0 = fired(T), stats = JSON.stringify(RUNNER_STATS); let s = '', taken = 0;
      R.front(2.5); for (let i = 0; i < 300; i++) { R.step(); if (runnerOf(T) || runnerOwns(T) || runnerFled(T)) taken++; if (i % 20 === 19) s += hashDigest(digestGame(R.g, true)) + ' '; }
      return { s, draws, dry: R.dry, taken, guns: R.guns().length, filed: JSON.stringify(RUNNER_STATS) !== stats, sum: runnerSummary(R.g), reloaded: T.reloadT < 0 || T.state === 'dead', rounds: fired(T) - n0 };
    };
    const base = await offRun();

    // (1) (6) (7: seven metres off) (10): the garrison parked across the yard
    { const R = await stage(21, true), T = R.T, g = R.g, n0 = fired(T);
      R.front(7); R.step(20); const farTaken = !!runnerOf(T), farDry = T.reloadT >= 0;
      const him = R.front(2.5), tp0 = [...T.char.pos];
      let dropAt = NaN, gunsAtSay = NaN, top = 0, dropPos = tp0;
      const said = listen(R, [T], 3.2, t => {
        if (Number.isNaN(gunsAtSay) && runnerOf(T)) gunsAtSay = R.guns().length;
        if (Number.isNaN(dropAt) && runnerFled(T)) { dropAt = t; dropPos = [...T.char.pos]; }
        if (runnerFled(T)) top = Math.max(top, T.speed);
        return !Number.isNaN(dropAt) && t >= dropAt + 2; });
      const done = said.find(s => runnerLines('done').includes(s.text)), moved = flat(T.char.pos, dropPos), gun = R.guns();
      line(R.held && R.dry && !!done && done.who === T && !done.radio && gunsAtSay === 0 && dropAt >= done!.t + RUNNER.beatSecs - 2 * DT && dropAt <= done!.t + RUNNER.beatSecs + 3 * DT,
        '(1) he says it, then he does it: the shout — spoken — with the weapon still in his hand, and the drop a beat later',
        done ? `"${done.text}"${done.radio ? ' (RADIO)' : ''} at ${f2(done.t)} s · weapon items of his at the shout ${gunsAtSay} · dropped at ${f2(dropAt)} s (beat ${RUNNER.beatSecs})` : `no such line (held ${R.held}, dry ${R.dry}, ${st(T)}) · said: ${said.map(s => `"${s.text}"`).join(' ') || 'nothing'}`);
      line(gun.length === 1 && T.dropped === gun[0] && flat(gun[0].pos, dropPos) < 2.5 && runnerFled(T) && runnerOwns(T) && T.weapon.roundsReady === 0 && T.reloadT < 0,
        '(1) the weapon lies on the floor where he dropped it, and his hands are empty: nothing in the gun, no magazine change in hand',
        `weapon items of his ${gun.length}${gun[0] ? ` (${gun[0].kind}, ${f2(flat(gun[0].pos, dropPos))} m from where he let go)` : ''} · fled ${runnerFled(T)} · rounds ready ${T.weapon.roundsReady} · reloadT ${f2(T.reloadT)}`);
      line(moved >= 2 && flat(T.char.pos, him) > flat(dropPos, him) + 1 && top <= g.tune.guardChase + 0.05 && fired(T) === n0 && T.state !== 'dead',
        '(1) he runs — two metres and more from the drop two seconds on, further from the man who broke him, never faster than the guards\' chase pace — and never fires again',
        `${st(T)} · ${f2(moved)} m from the drop · ${f2(flat(dropPos, him))} → ${f2(flat(T.char.pos, him))} m from the player · top speed ${f2(top)} (chase ${g.tune.guardChase}) · rounds since the shout ${fired(T) - n0}`);
      line(!farTaken && farDry, '(7) dry, alone, broken — and the enemy in his eyes seven metres off: he does not run', `taken ${farTaken} · mid-change ${farDry}`);
      // (14) grabbed after the drop, then let go
      { g.teleportPlayer([T.char.pos[0] - 0.6, 0, T.char.pos[2]]); startGrab(g, T); let heldF = 0, litHeld = 0, fledHeld = 0;
        for (let i = 0; i < 45; i++) { R.step(); if (T.held) { heldF++; if (T.flashlight?.enabled) litHeld++; if (runnerFled(T)) fledHeld++; } }
        const at = [...T.char.pos]; if (T.held) freeHeld(g, 'cancel'); R.step(110);   // (the player stays where he let go: his eyes on the man, who is therefore still on the floor for (6))
        line(heldF >= 30 && litHeld === 0 && fledHeld === heldF && !T.held && runnerFled(T) && flat(T.char.pos, at) > 1 && g.guards.includes(T) && R.guns().length === 1 && fired(T) === n0,
          '(14) grabbed after the drop: held like any man, no light of his in Sam\'s arm, still fled; let go, he runs again — and no second weapon, not a round',
          `frames held ${heldF} of 45 · with his light on ${litHeld} · fled ${fledHeld} · 1.8 s after the let-go: ${st(T)}, ${f2(flat(T.char.pos, at))} m on · weapon items of his ${R.guns().length} · rounds ${fired(T) - n0}`); }
      const g0 = R.guns()[0], onFloor = g.guards.includes(T) && T.state !== 'dead'; killGuard(g, T, [1, 0, 0], false, 'shot', 'player'); R.step(30); const after = R.guns();
      line(onFloor && T.state === 'dead' && after.length === 1 && after[0] === g0 && T.dropped === g0,
        '(6) shot while running: down like any man, and no second weapon falls', `on the floor and alive when shot ${onFloor} · state ${T.state} · weapon items of his ${after.length} · the same item ${after[0] === g0}`);
    }

    // (2) mates on their posts in another room
    { const R = await stage(22, true, 'posts'), T = R.T, g = R.g, n0 = fired(T), alone = !!moraleOf(T)?.alone;
      const defOf = (o: any) => g.fight.defs.find((X: any) => X.gd === o), near0 = R.near.map((o: any) => ({ o, D: defOf(o), t: defOf(o)?.noiseT ?? NaN, dig: digInPhase(g, o) }));
      const him = R.front(2.5); let tellAt = NaN, toldN = 0, phases = '', goneAt = NaN, outAlive = false, left = false, minMate = Infinity;
      let evPrev: number[][] = near0.map(x => x.D ? [...x.D.ev] : []), evRose = '', rose = 0, noted = 0;
      const said = listen(R, [T], 45, t => {
        const S = runnerOf(T); if (S && !phases.endsWith(S.phase)) phases += (phases ? ' → ' : '') + S.phase;
        if (S?.fled && !left) { left = true; R.away(); }   // (the player steps back out to the yard: the way is his)
        if (S?.phase === 'mates') for (const o of R.near) minMate = Math.min(minMate, flat(o.char.pos, T.char.pos));
        if (S && Number.isNaN(tellAt) && S.told > 0) { tellAt = g.time; toldN = S.told;
          near0.forEach((x, k) => { if (!x.D) return; const up = x.D.ev.findIndex((v: number, e: number) => v > (evPrev[k][e] ?? 0)); if (up >= 0) rose++;
            if (x.D.noiseAt && flat(x.D.noiseAt, him) < 0.5 && Math.abs(x.D.noiseT - g.time) < 2 * DT && x.D.noiseT > x.t) { noted++; evRose += `${x.o.callsign}: record ${f2(flat(x.D.noiseAt, him))} m from the place, stamped this frame · `; } evRose += `${x.o.callsign}: evidence [${evPrev[k].map(f2).join(' ')}] → [${x.D.ev.map(f2).join(' ')}] · `; }); }
        if (Number.isNaN(tellAt)) evPrev = near0.map(x => x.D ? [...x.D.ev] : []);
        if (S?.phase === 'gone' || !g.guards.includes(T)) { goneAt = t; outAlive = T.state !== 'dead'; return true; } });
      const mateLine = said.find(s => runnerLines('mates').includes(s.text));
      line(alone && R.dry && phases.includes('mates') && minMate <= RUNNER.tellM + 0.3 && !!mateLine && mateLine.who === T && !mateLine.radio,
        '(2) living mates in another room: he runs to them, and inside four metres with a line he shouts it — spoken',
        `alone ${alone} · ${phases || 'never taken'} · nearest he got to a mate ${f2(minMate)} m · ${mateLine ? `"${mateLine.text}" at ${f2(mateLine.t)} s` : `NO LINE · said: ${said.map(s => `"${s.text}"`).join(' ') || 'nothing'}`}`);
      line(toldN >= 1 && noted >= 1 && rose >= 1,
        '(2) the mates are told, and it MOVES them: on the frame of the tell the evidence on a told man\'s entry toward the place rises (his watch goes there), and his post\'s noise record reads where the enemy stood',
        `told ${toldN} at ${f2(tellAt)} s of the game clock · ${evRose}${near0.map(x => `${x.o.callsign}: ${x.D ? `dig-in ${x.dig} → ${digInPhase(g, x.o)}` : 'no post'}`).join(' · ')}`);
      line(phases.endsWith('out') || phases.endsWith('gone') ? !Number.isNaN(goneAt) && outAlive && !g.guards.includes(T) && runnerFled(T) && fired(T) === n0 : false,
        '(2) then he keeps going: out of the building, and off the floor once out with no enemy\'s line on him — alive, and never a round',
        `${phases} · off the floor at ${f2(goneAt)} s · alive ${outAlive} · still counted fled ${runnerFled(T)} · rounds since the shout ${fired(T) - n0}${Number.isNaN(goneAt) ? ` · STILL THERE: at ${[...T.char.pos].map(f2).join(',')} going to ${(runnerOf(T) as any)?.goal?.map(f2).join(',')} · out ${(runnerOf(T) as any)?.isOut} unseen ${f2((runnerOf(T) as any)?.unseen)} stall ${f2((runnerOf(T) as any)?.stall)} tries ${(runnerOf(T) as any)?.tries} arrived ${(runnerOf(T) as any)?.script?.arrived} path ${T.pathI}/${T.path.length} · player ${[...g.player.char.pos].map(f2).join(',')} · ops ${R.ops.map((o: any) => [...o.char.pos].map(f2).join(',')).join(' | ')}` : ''}`);
      afterGone(R, 'the room clear with his mates alive', !Number.isNaN(goneAt) && !g.guards.includes(T)); }

    // (3) (4) nobody else left alive
    { const R = await stage(23, true, 'none', false, false, true, true), T = R.T, g = R.g, rc0 = g.roomClear.end;
      const up = () => squadsReport(g).map((q: any) => `${q.name} ${q.up}/${q.men}`).join(' · '), ups = () => squadsReport(g).reduce((n: number, q: any) => n + q.up, 0), live = squadsLive(g), up0 = ups(), rep0 = up();
      R.front(2.5); let phases = '', takenAt = NaN, aliveAtTaken = false, runningAtTaken = false, goneAt = NaN, left = false;
      let sayT = NaN, outLine = T.bubble?.text ?? '';
      const said3 = listen(R, [T], 30, t => {
        const S = runnerOf(T); if (S && !phases.endsWith(S.phase)) phases += (phases ? ' → ' : '') + S.phase;
        if (S && Number.isNaN(sayT)) sayT = g.time - DT;   // (the frame of the shout: the tick ran before this frame's clock moved on)
        if (S?.fled && !left) { left = true; R.away(); }
        if (Number.isNaN(takenAt) && g.roomClear.end === 'taken') { takenAt = t; aliveAtTaken = T.state !== 'dead' && g.guards.includes(T); runningAtTaken = !!S && S.fled && S.phase !== 'gone'; }
        if (S?.phase === 'gone' || !g.guards.includes(T)) { goneAt = t; return true; } });
      line(R.dry && !phases.includes('mates') && phases.includes('out') && !Number.isNaN(goneAt) && T.state !== 'dead' && !g.guards.includes(T),
        '(3) no mate left: straight out — never the mates\' leg — and off the floor once out and unseen', `${phases || 'never taken'} · off the floor at ${f2(goneAt)} s · state ${T.state}`);
      line(rc0 === null && !Number.isNaN(takenAt) && aliveAtTaken && runningAtTaken && takenAt < goneAt,
        '(4) the room clear reads \'taken\' while the fled man is still alive and running', `end before ${rc0} · 'taken' at ${f2(takenAt)} s (he left the floor at ${f2(goneAt)} s) · alive and on the floor then ${aliveAtTaken} · running ${runningAtTaken} · ${g.roomClear.endWhy ?? ''}`);
      { const iDone = said3.findIndex(x => runnerLines('done').includes(x.text)), after = iDone < 0 ? [] : said3.slice(iDone + 1), net = after.filter(x => x.radio), wait = sayT - R.outT;
        line(R.dry && iDone >= 0 && wait >= RUNNER.outSecs - 2 * DT && wait <= RUNNER.outSecs + 0.4,
          '(17) his shout that he is OUT has its time before the shout that he is done takes its place: `outSecs`, with the enemy in his eyes all the while — then the same beat, the same drop',
          `"${outLine}" as his change began · "${iDone >= 0 ? said3[iDone].text : 'NO SHOUT'}" ${f2(wait)} s later (outSecs ${RUNNER.outSecs})`);
        line(live && iDone >= 0 && net.length === 0 && !Number.isNaN(goneAt),
          '(17) with his squad staged: from the shout to the frame he is off the floor he puts nothing on the squad\'s net — no contact call takes his own words\' place',
          `squads staged ${live} · lines of his after the shout: ${after.map(x => `"${x.text}"${x.radio ? ' (RADIO)' : ''}`).join(' ') || 'none'} · off the floor at ${f2(goneAt)} s`); }
      line(live && up0 === 1 && ups() === 0, '(16) his squad counts him out: the last man of it up before the shout, nobody up once he has fled', `squads staged ${live} · before: ${rep0} · after: ${up()}`);
      afterGone(R, 'the room clear with nobody else alive', !Number.isNaN(goneAt) && !g.guards.includes(T)); }

    // (12) no way out: the corner, the wall — the runs at a way that come to nothing — and the way come free
    { const R = await stage(28, true, 'none'), T = R.T, g = R.g, hut = [...T.char.pos];
      RUNNER.clearM = 1000; const him = R.front(2.5); let lowAt = NaN, phases = '';
      const said = listen(R, [T], 30, t => { const S = runnerOf(T) as any; if (S && !phases.endsWith(S.phase)) phases += (phases ? ' → ' : '') + S.phase;
        if (S?.phase === 'low' && S.script?.arrived && Number.isNaN(lowAt)) lowAt = t; return !Number.isNaN(lowAt) && t >= lowAt + 1.5; });
      const S = runnerOf(T) as any, away = Math.atan2(T.char.pos[0] - g.player.char.pos[0], T.char.pos[2] - g.player.char.pos[2]), off = Math.abs(wrap(T.char.bodyYaw - away));
      const words = said.filter(s => !runnerLines('done').includes(s.text));
      line(R.dry && !Number.isNaN(lowAt) && !phases.includes('out') && S?.phase === 'low' && !!S.script.crouch && off < 0.6 && !words.length && runnerFled(T) && g.guards.includes(T) && T.state !== 'dead' && flat(T.char.pos, him) > 2.5,
        '(12) nothing is outside: he goes to the corner farthest from the enemy and stays low there, his face to the wall, without a word — still fled, still on the floor',
        `${phases || 'never taken'} · there at ${f2(lowAt)} s · crouched ${!!S?.script?.crouch} · ${f2(off)} rad off facing straight away from the player · ${f2(flat(T.char.pos, him))} m from him, at ${[...T.char.pos].map(f2).join(',')} going to ${S?.goal?.map(f2).join(',')} (stall ${f2(S?.stall)}) · said after the shout: ${words.map(s => `"${s.text}"`).join(' ') || 'nothing'}`);
      // the runs at a way that will not let him through: the way is there again, and he is held where he stands every time he sets off on it
      RUNNER.clearM = was.runner.clearM; R.away(); const spot = hut; let outs = 0, wasOut = false, lastTries = 0, capAt = -1;   // (held in the hut he broke in: under its roof, never 'outside')
      for (let i = 0; i < 60 * 45; i++) { R.step(); const X = runnerOf(T) as any; if (!X) break; const isOut = X.phase === 'out'; if (isOut && !wasOut) outs++; wasOut = isOut; lastTries = X.tries;
        if (isOut || !X.script.arrived) { T.char.pos = [spot[0], 0, spot[2]]; T.char.vel = [0, 0, 0]; }
        if (capAt < 0 && X.tries >= RUNNER.retries) capAt = i; if (capAt >= 0 && i > capAt + 60 * 4 * RUNNER.retrySecs) break; }
      const X = runnerOf(T) as any;
      line(outs === RUNNER.retries && X?.tries === RUNNER.retries && X.phase === 'low' && g.guards.includes(T) && T.state !== 'dead',
        `(12) held where he stands on every run at the way out: after ${RUNNER.retries} he stays in his corner for good (no fourth run in the seconds after)`,
        `runs at it ${outs} · tries ${lastTries} of ${RUNNER.retries} · ${st(T)} · on the floor ${g.guards.includes(T)}`);
      // …and a man who has NOT spent his runs is out as soon as the way is free
      if (X) X.tries = 0; let goneAt = NaN; for (let i = 0; i < 60 * 30; i++) { R.step(); if (!g.guards.includes(T)) { goneAt = i * DT; break; } }
      line(!Number.isNaN(goneAt) && T.state !== 'dead', '(12) the way free and his runs not spent: he is up out of the corner, out, and off the floor', `off the floor ${f2(goneAt)} s after · state ${T.state}`); }

    // (13) the enemy one metre in front of him
    { const R = await stage(29, true, 'none'), T = R.T, g = R.g;
      const him = R.front(1.0); let d0 = NaN, dropAt = NaN, minAfter = Infinity, lowNear = 0;
      listen(R, [T], 6, t => { const S = runnerOf(T) as any, d = flat(T.char.pos, g.player.char.pos);
        if (S?.fled && Number.isNaN(dropAt)) { dropAt = t; d0 = d; }
        if (!Number.isNaN(dropAt) && t > dropAt + 1.5) { minAfter = Math.min(minAfter, d); if (S?.script?.crouch && d < RUNNER.shyM) lowNear++; }
        return !Number.isNaN(dropAt) && t >= dropAt + 3; });
      const d1 = flat(T.char.pos, g.player.char.pos);
      line(R.dry && !Number.isNaN(dropAt) && d0 < 1.6 && d1 > d0 + 1 && minAfter > d0 + 0.5 && lowNear === 0 && runnerFled(T),
        '(13) the enemy one metre in front of him: he gains distance — never low at the man\'s feet',
        `${st(T)} · ${f2(d0)} m at the drop → ${f2(d1)} m three seconds on (nearest from 1.5 s on: ${f2(minAfter)} m) · frames crouched inside ${RUNNER.shyM} m of him ${lowNear} · player at ${him.map(f2).join(',')}`); }

    // (5) a teammate with a clear line — and the control
    { const eyes = async (on: boolean, bare = false) => {
        const R = await stage(25, on, 'parked', true), T = R.T, g = R.g, A = R.ops[0];
        const him = R.front(2.5); if (on) for (let i = 0; i < 120 && !runnerFled(T); i++) R.step();
        const fled = runnerFled(T), tp = T.char.pos, px = -(tp[2] - him[2]), pz = tp[0] - him[0], l = Math.hypot(px, pz) || 1;
        R.put(A, [him[0] + px / l * 0.9, 0, him[2] + pz / l * 0.9]); A.char.bodyYaw = A.char.aimYaw = Math.atan2(tp[0] - A.char.pos[0], tp[2] - A.char.pos[2]); A.dazzledUntil = -1; A.staggerUntil = -1;
        let bareF = 0;
        const O = g.fight.ops.find((x: any) => x.gd === A), n0 = fired(A); let lineF = 0, onHim = 0, frames = 0;
        for (let i = 0; i < 180 && g.guards.includes(T) && T.state !== 'dead'; i++) { if (bare) { A.script = null; A.state = 'alert'; A.awareness = 1; A.lastKnown = [...T.char.pos]; A.lastSeenT = g.time; } R.step(); frames++; if (!A.script) bareF++;
          if (!g.col.segmentBlocked(A.char.bones.head ?? [A.char.pos[0], 1.6, A.char.pos[2]], T.char.bones.chest ?? [T.char.pos[0], 1.2, T.char.pos[2]])) lineF++;
          if (O?.tgt === T || A.foe === T) onHim++; }
        return { fled, staged: !!A && !!O, lineF, onHim, frames, bareF, rounds: fired(A) - n0, state: T.state, dry: R.dry };
      };
      const run = await eyes(true), ctl = await eyes(false);
      line(run.dry && run.staged && run.fled && run.lineF >= 20 && run.onHim === 0 && run.rounds === 0 && run.state !== 'dead',
        '(5) a teammate beside the player with a clear line to the running man: never his target, not a round', `fled ${run.fled} · frames with a clear line ${run.lineF} of ${run.frames} · frames he was the teammate's target ${run.onHim} · the teammate's rounds ${run.rounds} · the man ${run.state}`);
      line(ctl.dry && ctl.staged && !ctl.fled && (ctl.onHim > 0 || ctl.state === 'dead'),
        '(5) the control: the same teammate on the same line TAKES the same man when he has not run (the switch off)', `frames with a clear line ${ctl.lineF} of ${ctl.frames} · frames he was the target ${ctl.onHim} · rounds ${ctl.rounds} · the man ${ctl.state}`);
      const bare = await eyes(true, true), bctl = await eyes(false, true);
      line(bare.dry && bare.fled && bare.bareF >= 20 && bare.lineF >= 20 && bare.onHim === 0 && bare.rounds === 0 && bare.state !== 'dead',
        '(15) an operative with NO script (the floor\'s own target pick) on a clear line to the running man: never his foe, not a round', `fled ${bare.fled} · frames with no script ${bare.bareF} of ${bare.frames} · with a clear line ${bare.lineF} · frames he was the foe ${bare.onHim} · rounds ${bare.rounds} · the man ${bare.state}`);
      line(bctl.dry && !bctl.fled && bctl.bareF >= 20 && (bctl.onHim > 0 || bctl.state === 'dead'),
        '(15) the control: the same unscripted operative TAKES the same man when he has not run (the switch off)', `frames with no script ${bctl.bareF} of ${bctl.frames} · with a clear line ${bctl.lineF} · frames he was the foe ${bctl.onHim} · rounds ${bctl.rounds} · the man ${bctl.state}`); }

    // (10) a man of the night staff, and the game's own checkpoint · (11) a bare night breach
    { MORALE.on = false; RUNNER.on = false; Object.assign(RUNNER, was.runner, { on: false }); SQUADS.on = was.squads; Math.random = seeded(41);
      const W: any = await quiet(() => standUp({})); const g = W.game; MORALE.on = true; RUNNER.on = true; RUNNER.anyway = false; first(); g.godMode = true;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; wipe(g); W.step(DT); } };
      step(30);
      const staff = g.guards.filter((x: any) => x.team === 'guard' && x.state !== 'dead'), T = staff[0], idx = g.guards.indexOf(T), n0 = g.guards.length, units = g.guards.filter((x: any) => x.unit).length;
      const took = !!T && runnerBreak(g, T); let phases = '';
      for (let i = 0; i < 60 * 25; i++) { step(); const S = runnerOf(T) as any; if (S && !phases.endsWith(S.phase)) phases += (phases ? ' → ' : '') + S.phase; if (S?.phase === 'low' && S.script.arrived && i > 120) break; }
      const guns = g.items.items.filter((it: any) => it.who === T.char.id && (it.kind === 'rifle' || it.kind === 'pistol')).length;
      line(took && units === 0 && runnerFled(T) && g.guards.includes(T) && g.guards.length === n0 && T.hold === true && T.pinned === true && T.state === 'patrol' && !T.flashlight?.enabled && guns === 1,
        '(10) a man of the night staff: his weapon on the floor, never taken off it himself, nobody\'s free man on his round (held and pinned: no chat, no need, no greeting is his), no torch',
        `started ${took} · ${phases || 'never taken'} · on the floor ${g.guards.includes(T)} (${g.guards.length} of ${n0}) · hold ${T.hold} pinned ${T.pinned} state ${T.state} · light ${!!T.flashlight?.enabled} · weapon items of his ${guns}`);
      let snapWhat = 'never asked', snapOk = false;
      try { const S0 = runnerOf(T) as any, was0 = S0 ? { phase: S0.phase, fled: S0.fled, from: [...S0.from], tries: S0.tries } : null;
        const snap = W.snapshot('runner-check', true), keyed = JSON.stringify(snap).includes('"runner"');
        step(90); W.restore(snap); const T1 = g.guards[idx], S1 = runnerOf(T1) as any, fledAtLoad = runnerFled(T1); step(2);
        snapOk = !!was0 && was0.fled && !!S1 && S1.phase === was0.phase && S1.fled === true && fledAtLoad && flat(S1.from, was0.from) < 1e-6 && S1.tries === was0.tries && T1.hold === true && T1.pinned === true && T1.weapon.roundsReady === 0;
        snapWhat = `saved ${was0 ? `${was0.phase}${was0.fled ? ' fled' : ''}` : 'nothing'} · the slice in the file ${keyed} · loaded ${st(T1)} · the place to tell ${S1 ? f2(flat(S1.from, was0?.from ?? [0, 0, 0])) : '?'} m off · two frames on: hold ${T1.hold} pinned ${T1.pinned} rounds ready ${T1.weapon.roundsReady}`;
      } catch (e) { snapWhat = `the checkpoint threw: ${e instanceof Error ? e.message : String(e)}`; }
      line(snapOk, '(10) the game\'s own checkpoint (savestate.ts): his run comes back fled, the same phase, the same place to tell, still held, still empty-handed', snapWhat); }
    { MORALE.on = false; RUNNER.on = false; Object.assign(RUNNER, was.runner, { on: false }); Math.random = seeded(42);
      const W: any = await quiet(() => standUp({})); const g = W.game; MORALE.on = true; RUNNER.on = true; RUNNER.anyway = false; first(); g.godMode = true;
      const gone: any[] = [], step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; wipe(g, gone); W.step(DT); } };
      const why = (await startFromQuery(g, 'nightbreach'))?.why ?? null; step(20);
      const nb = g.nightBreach, H = nb.hostiles.find((h: any) => h.state !== 'dead'); if (H) gone.push(H);
      for (const o of nb.ops) o.dazzledUntil = 1e9;
      const took = !!H && runnerBreak(g, H); let phases = '', went = false;
      for (let i = 0; i < 60 * 3 && H; i++) { step(); const S = runnerOf(H) as any; if (S && !phases.endsWith(S.phase)) phases += (phases ? ' → ' : '') + S.phase; }
      // (its own level is one roof: he cannot get out of it, and a man of the drill's exchange is never taken off the floor by the rule itself — so the check
      // takes him off as runner.ts gone() does, guards.ts despawnUnit, and asks what the scenario's cast test makes of a fled man who is no longer there)
      const fled = !!H && runnerFled(H); if (H && runnerOf(H)?.fled !== undefined) went = despawnUnit(g, H) && !g.guards.includes(H);
      console.log(`    (the bare night breach: ${why ? `NOT STAGED — ${why}` : `staged, ${nb.hostiles.length} defenders`} · started ${took} · ${phases || 'never taken'} · fled ${fled} · taken off the floor ${went})`);
      afterGone({ g, step }, 'a bare night breach', nb.active && took && went); }

    // (7) not dry · not alone
    { const R = await stage(26, true, 'parked', false, false, false), T = R.T; R.front(2.5); let taken = 0, wet = 0;
      for (let i = 0; i < 20; i++) { R.step(); if (T.weapon.roundsReady > 0 && T.reloadT < 0) { wet++; if (runnerOf(T)) taken++; } }
      line(R.held && R.mag0 >= 12 && wet >= 10 && taken === 0, '(7) broken, alone, the player in his eyes 2.5 m off — but rounds in his gun: he does not run', `held on the hole ${R.held} with ${R.mag0} in the gun · frames with rounds in it ${wet} of 20 · frames taken ${taken}`); }
    { const R = await stage(27, true, 'parked', false, true), T = R.T, alone = !!moraleOf(T)?.alone, mateM = flat(R.men[1].char.pos, T.char.pos); R.front(2.5); let taken = 0, dryF = 0;
      for (let i = 0; i < 60; i++) { R.step(); if (T.reloadT >= 0) { dryF++; if (runnerOf(T)) taken++; } }
      line(R.dry && !alone && dryF >= 30 && taken === 0, '(7) dry, the player in his eyes 2.5 m off — but a mate at his shoulder: he does not run', `mate ${f2(mateM)} m off · alone ${alone} · frames mid-change ${dryF} of 60 · frames taken ${taken}`); }

    // (12) THE OTHER WAY IN (morale.ts training): a broken GREEN man who saw his leader fall, an enemy in his eyes inside closeM — rounds in his gun or not.
    // The hut again, a leader and a green man of his in it (bands by room: no squads staged), the rest parked across the yard; `fall` = the leader shot in his view
    // before the blast, else the leader parked with the rest (the green man alone: broken all the same, and no fall in his eyes)
    { const lostRun = async (seed: number, fall: boolean) => {
        MORALE.on = false; RUNNER.on = false; Object.assign(RUNNER, was.runner, { on: false }); SQUADS.on = false; Math.random = seeded(seed);
        const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }));
        const g = W.game; DOORBLAST.on = true; DESTRUCTION.on = true; FRAG.doorStun = true; g.tune.chaos = 0.5; MORALE.on = true; RUNNER.on = true; RUNNER.anyway = false; first(); MORALE.training = 'mixed';
        startFromQuery(g, 'levelFile=compound.json&roomclear'); g.godMode = true;
        let vis = 0.05; const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; wipe(g); W.step(DT); } };
        step(10);
        const d = g.doors.list.find((x: any) => x.def.name === 'hut_w'); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place();
        const men = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), G = men.find((x: any) => trainingOf(g, x) === 'green' && leaderOf(g, x)), L = G ? leaderOf(g, G) : null;
        if (!G || !L) return null;
        const mid = doorPt(d, d.def.width / 2, 0, 1, 0), hut = [...men].sort((a: any, b: any) => flat(a.char.pos, mid) - flat(b.char.pos, mid))[0];
        const inside: 1 | -1 = g.doors.side(d, hut.char.pos), side = -inside as 1 | -1, yard = doorPt(d, d.def.width / 2 + 9, 6, side, 0);
        g.teleportPlayer([yard[0], 0, yard[2]]);
        const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; };
        let k = 0; for (const o of men) if (o !== G && !(fall && o === L)) { put(o, [4.8 + (k % 4) * 0.9, 0, 5.8 + Math.floor(k / 4) * 0.9]); k++; }
        put(G, doorPt(d, d.def.width / 2, 2.4, inside, 0)); if (fall) put(L, doorPt(d, d.def.width / 2 + 1.6, 3.4, inside, 0));
        step(40);
        if (fall) { const look = () => Math.atan2(L.char.pos[0] - G.char.pos[0], L.char.pos[2] - G.char.pos[2]);   // (his body turned to his leader, held there: training-check.ts (T6)'s way)
          for (let i = 0; i < 20; i++) { G.char.bodyYaw = look(); step(); G.char.bodyYaw = look(); }
          killGuard(g, L, [0, 0, 1], false, 'shot', 'world'); }
        const sawAt = sawLeaderFall(G); step(90);
        const hole = doorPt(d, d.def.width / 2, HE40.standoff + 0.03, side, 1.0) as V3;
        blast(g, [hole[0], hole[1] - FRAG.lift, hole[2]], { who: PLAYER_ID, name: '40 mm grenade' });
        step(Math.round((Math.max(0, G.staggerUntil - g.time) + 3.5) * 60) + 150);
        const broke = rungOf(G) === 2, green = !!moraleOf(G)?.green, mag0: number = G.weapon.roundsReady;
        const guns = () => g.items.items.filter((it: any) => it.who === G.char.id && (it.kind === 'rifle' || it.kind === 'pistol')).length;
        let early = 0; for (let i = 0; i < 60; i++) { step(); if (runnerOf(G)) early++; }   // (a second with nobody in his eyes: broken and marked is not enough)
        { const tp = G.char.pos, l = flat(tp, hole) || 1; g.teleportPlayer([tp[0] + (hole[0] - tp[0]) / l * 3, 0, tp[2] + (hole[2] - tp[2]) / l * 3]); vis = 1; }
        let sayAt = -1, magSay = -1, gunsSay = -1, changing = false, said = '';
        for (let i = 1; i <= 60 * 12 && sayAt < 0; i++) { const mid0 = G.reloadT >= 0 || moraleOf(G)?.act === 'reload'; step(); if (runnerOf(G)) { sayAt = i * DT; magSay = G.weapon.roundsReady; gunsSay = guns(); changing = mid0; said = G.bubble?.text ?? ''; } }
        step(Math.round(RUNNER.beatSecs * 60) + 6);
        return { G, L, sawAt, broke, green, mag0, early, sayAt, magSay, gunsSay, changing, said, fled: runnerFled(G), gunsEnd: guns(), phase: runnerOf(G)?.phase ?? 'none' };
      };
      const B = await lostRun(51, true), C = await lostRun(51, false);
      line(!!B && B.sawAt === 0 && B.broke && B.green && B.early === 0 && B.sayAt >= 0 && B.sayAt < 1 && B.magSay > 0 && !B.changing && B.gunsSay === 0 && runnerLines('done').includes(B.said) && B.fled && B.gunsEnd === 1,
        '(12) a broken GREEN man who saw his leader fall, the player in his eyes three metres off, ROUNDS IN HIS GUN: the same shout, the same beat, the weapon on the floor and he runs — and not before anybody is in his eyes',
        B ? `${B.G.callsign} (green ${B.green}) saw ${B.L.callsign} fall ${B.sawAt} s before · broken ${B.broke}, ${B.mag0} in the gun · taken with nobody in view ${B.early} of 60 frames · shout "${B.said}" ${f2(B.sayAt)} s after the player stood there with ${B.magSay} rounds ready, mid-change ${B.changing}, ${B.gunsSay} weapon of his down · a beat on: fled ${B.fled}, ${B.gunsEnd} on the floor, ${B.phase}` : 'NOT STAGED: no green man with a leader on this floor');
      line(!!C && C.sawAt === Infinity && C.broke && C.green && C.early === 0 && (C.sayAt < 0 || C.magSay === 0 || C.changing),
        '(12) the same green man broken alone, his leader alive across the yard (no fall in his eyes): rounds in his gun do not send him — he runs only once the bait has run him dry, the first way in',
        C ? `${C.G.callsign} (green ${C.green}) saw a fall ${C.sawAt} s ago · broken ${C.broke}, ${C.mag0} in the gun · ${C.sayAt < 0 ? 'never taken in twelve seconds' : `taken ${f2(C.sayAt)} s on with ${C.magSay} rounds ready, mid-change ${C.changing}`}` : 'NOT STAGED: no green man with a leader on this floor'); }

    // (9) the words
    { const lines: string[] = runnerLines(), long = lines.filter(t => t.length > D.AIM_CHARS), blocked = lines.filter(t => D.blockedPhrase(t)), compass = lines.filter(t => /\b(north|south|east|west)/i.test(t)), twice = lines.filter((t, i) => lines.indexOf(t) !== i), tight = lines.filter(t => /\S—\s|\s—\S/.test(t));
      line(lines.length >= 6 && !long.length && !blocked.length && !compass.length && !twice.length && !tight.length && runnerLines('done').length >= 3 && runnerLines('mates').length >= 3,
        `(9) every line fits a bubble (≤ ${D.AIM_CHARS}), none on the originality blocklist, no compass word, none twice`, `${lines.length} lines · too long: ${long.join(' | ') || 'none'} · blocked: ${blocked.join(' | ') || 'none'} · twice: ${twice.join(' | ') || 'none'}`); }

    // (8) off: a sanity line (the proof is the gate's frozen digests)
    { const off = await offRun();
      line(off.dry && off.taken === 0 && off.guns === 0 && !off.filed && off.sum === '' && off.draws === base.draws && off.s === base.s,
        '(8) the switch off: nobody taken, nothing on the floor, nothing filed, the summary empty — and the run draws and digests as a stand that never had the rule on',
        `dry ${off.dry} · frames taken ${off.taken} · weapon items of his ${off.guns} · filed ${off.filed} · summary '${off.sum}' · die draws ${off.draws} (base ${base.draws}) · fifteen digests equal ${off.s === base.s}`); }
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { DARKDOOR.on = wasDoor; NQ_.on = nq0_; Object.assign(RUNNER, was.runner); Object.assign(MORALE, was.morale); Object.assign(FRAG, was.frag); DOORBLAST.on = was.door; DESTRUCTION.on = was.sw; SQUADS.on = was.squads; Math.random = was.rnd; }
  console.log(`=== runner: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await runnerCheck()) ? 0 : 1);
