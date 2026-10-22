// A PARKED VEHICLE'S LAMPS CAN BE SHOT OUT (src/game/carlamps.ts, CARLAMPS).
// Every level file: the lamps the rule finds, against the count each file is known to hold (a generator that moves a lamp shows up here). On the office, by
// hand: the lamps as light targets beside the level's own (one each, off the mains, no area light, the level's own targets untouched and in their order); a
// round into a glowing tail lamp puts it out, paints it dark and is a light a man could see go; a round into a dead head lamp breaks the glass, paints it dark
// and is no light event; a round at a lamp from the far side of its car breaks nothing; mended, both are painted as authored again; with the switch off no
// lamp is a target and a round at one does nothing; the stands and a recording from before the table.
//   bun run tools/qa/carlamps-check.ts          (probes.ts carlamps; CARLAMPS_BREAK=1 must FAIL — the stand's word is left down where the check raises it)
// Both stands: the check gives the stand its word (TPS_CARLAMPS) itself. Nothing here is a picture: no lamp, glass or paint has been seen on a GPU by this check.
import { readFileSync, readdirSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { CARLAMPS, CARLAMPS_STATS, VEHICLE_GROUP, findCarLamps, deadLamp, carLampsTape } = await import(`${ROOT}/src/game/carlamps.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

const DT = 1 / 60, BREAK = process.env.CARLAMPS_BREAK === '1', VERBOSE = !!process.env.CARLAMPS_VERBOSE;
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; } }
const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${file}`, 'utf8')));
let stood: boolean | null = null, stoodLamps = false;   // (the switch as the stand left it and whether that Game had a lamp for a target, read once after the first stand-up)
async function stand(file: string, on: boolean): Promise<any> {
  Math.random = seeded(21);
  const word = process.env.TPS_CARLAMPS;
  try {
    if (stood === null) { const W0: any = await hushed(() => standUp({ level: levelOf(file), seed: 1 })); stood = !!CARLAMPS.on; stoodLamps = W0.game.targets.some((t: any) => t.group === VEHICLE_GROUP); }
    process.env.TPS_CARLAMPS = on && !BREAK ? '1' : '0';   // (the stand writes the switch from its word before it builds the Game, which is when the lamps become targets)
    return await hushed(() => standUp({ level: levelOf(file), seed: 1 }));
  } finally { if (word === undefined) delete process.env.TPS_CARLAMPS; else process.env.TPS_CARLAMPS = word; }
}
/** head and tail lamps each level file is known to hold ([head, tail, of them glowing]); the pass's pickup stands in a lived-in bay, which a stand may leave out */
const KNOWN: Record<string, [number, number, number][]> = {
  'barracks.json': [[2, 2, 2]], 'barracks-gwot.json': [[2, 2, 2]], 'bazaar.json': [[4, 4, 0]], 'compound.json': [[4, 4, 4]], 'compound-gwot.json': [[4, 4, 4]],
  'crossing.json': [[6, 6, 0]], 'defuse.json': [[4, 4, 4]], 'defuse-gwot.json': [[4, 4, 4]], 'depot.json': [[4, 4, 4]], 'depot-gwot.json': [[4, 4, 4]],
  'floodlit.json': [[2, 2, 2]], 'floodlit-gwot.json': [[2, 2, 2]], 'glasshouse.json': [[2, 2, 0]], 'gwot-yard.json': [[4, 4, 0]], 'mousehole.json': [[4, 4, 4]],
  'mousehole-gwot.json': [[4, 4, 4]], 'office.json': [[4, 4, 4]], 'office-relief.json': [[4, 4, 4]], 'pass.json': [[2, 0, 0], [4, 2, 0]], 'police-post.json': [[6, 6, 0]],
  'quiet-relay.json': [[6, 6, 0]], 'records.json': [[4, 4, 4]], 'records-gwot.json': [[4, 4, 4]], 'snatch.json': [[4, 4, 0]], 'train-hands.json': [[2, 2, 0]],
  'train-move.json': [[6, 6, 0]], 'train-silent.json': [[2, 2, 0]], 'tut-sky.json': [[8, 6, 0], [10, 8, 0]],   // (the pass's own, the squad's two pickups and the roadblock's gun truck)
  'tut-squad.json': [[4, 4, 0]], 'tut-quiet.json': [[2, 2, 0]],
};

export async function carlampsCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== carlamps: a parked vehicle's lamps can be shot out${BREAK ? ' (CARLAMPS_BREAK: the switch left off)' : ''} ===`);
  const was = { ...CARLAMPS, dark: [...CARLAMPS.dark] }, stats0 = { ...CARLAMPS_STATS }, rnd = Math.random;
  try {
    // (1) every level file
    { const wrong: string[] = []; let files = 0, head = 0, tail = 0, lit = 0;
      for (const f of readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !f.includes('.lint')).sort()) {
        const l = findCarLamps(levelOf(f).boxes); const h = l.filter((x: any) => x.what === 'head lamp').length, t = l.length - h, g = l.filter((x: any) => x.lit).length;
        const known = KNOWN[f] ?? [[0, 0, 0]];
        if (!known.some(k => k[0] === h && k[1] === t && k[2] === g)) wrong.push(`${f}: ${h} head ${t} tail ${g} glowing, known ${known.map(k => k.join('/')).join(' or ')}`);
        if (l.length) files++; head += h; tail += t; lit += g;
      }
      line(wrong.length === 0 && files === Object.keys(KNOWN).length, '1 every level file gives the lamps it is known to hold: each vehicle\'s head and tail lamps, in twos, and nothing else taken for one',
        `${files} files with vehicles · ${head} head lamps, ${tail} tail lamps, ${lit} of them glowing${wrong.length ? ` · ${wrong.slice(0, 6).join(' · ')}` : ''}`); }

    // (2) the office: the lamps as targets beside the level's own
    const off: any = await stand('office.json', false); const offNames: string[] = off.game.targets.map((t: any) => t.name);
    const shipped = (process.env.TPS_PROFILE ?? '') === 'shipped', said = process.env.TPS_CARLAMPS, word = said === '1';
    line(stood === (said !== undefined ? word : shipped) && stoodLamps === stood, '0 the stand: off on the frozen stand, on on the shipped one, either as its word says where the run gives one, and the Game it builds has the lamps for targets only where it is on', `stood up ${stood} · lamps for targets ${stoodLamps} · ${shipped ? 'shipped' : 'frozen'}${said !== undefined ? ` with TPS_CARLAMPS=${said}` : ''}`);
    const W: any = await stand('office.json', true); const { game, input } = W; const pl = game.player, c = pl.char, st = game.engine.world.statics;
    const lamps: any[] = game.targets.filter((t: any) => t.group === VEHICLE_GROUP), others: string[] = game.targets.filter((t: any) => t.group !== VEHICLE_GROUP).map((t: any) => t.name);
    for (let i = 0; i < 5; i++) W.step(DT);
    { const heads = lamps.filter(deadLamp), tails = lamps.filter(t => !deadLamp(t));
      const plain = lamps.every(t => !t.mains && t.stagger === 0 && t.interactive && t.kind === 'emissive' && !t.areaLights && t.boxes.length === 1 && !(st[t.boxes[0]].flags & BoxFlag.AreaLit));
      const state = heads.every(t => !t.on && t.factor === 0) && tails.every(t => t.on && t.factor === 1 && st[t.boxes[0]].emissive[0] > 0.4);
      const names = new Set(game.targets.map((t: any) => t.name)).size === game.targets.length;
      const listed = lamps.every(t => game.interactables.some((it: any) => it.kind === 'light' && it.target === t));
      line(heads.length === 4 && tails.length === 4 && plain && state && names && listed && others.join('|') === offNames.join('|') && !offNames.some(n => /lamp \d/.test(n) && n.startsWith('head')),
        '2 the office with the switch up: its two cars\' eight lamps are light targets of their own — off the mains, no stagger, no area light, the tail lamps burning and the head lamps dark — every name is one target\'s, the reticle\'s list has them, and the level\'s own targets are the ones it had, in their order',
        `${heads.length} head, ${tails.length} tail · plain ${plain} · state ${state} · names ${names} · listed ${listed} · the level's own: ${others.length} with, ${offNames.length} without`); }

    // (3) real rounds
    for (let i = 0; i < 3 && !pl.pistolUp; i++) { input.pressed.add(i === 0 ? 'Digit1' : 'KeyE'); for (let k = 0; k < 50; k++) W.step(DT); }
    const eye = (p: number[]) => [p[0], 1.35, p[2]];
    /** floor about `d` metres from the lamp with a clear line to it (`clear` false: a line something else stops), where he really stands once put there */
    const spotFor = (t: any, d: number, clear = true): number[] | null => {
      for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; const p = [t.pos[0] + Math.sin(a) * d, 0, t.pos[2] + Math.cos(a) * d];
        if (game.col.nav.isBlocked(p[0], p[2])) continue;
        const dir = v3.normalize(v3.sub(t.pos, eye(p))); const h = game.col.raycast(eye(p), dir, 60); const dist = v3.dist(eye(p), t.pos);
        const open = !h || h.t >= dist - 0.05 || t.boxes.includes(h.index);
        if (open !== clear) continue;
        if (!clear) { const B = st[h.index];   // (the stopper has to be the vehicle's own body: a solid box beside the lamp, well short of it — not a post, and not a pane a round goes on through)
          if (dist - h.t < 1.2 || (B.flags & BoxFlag.Glass) || Math.hypot(B.c[0] - t.pos[0], B.c[2] - t.pos[2]) > 2.6 || Math.max(B.h[0], B.h[2]) < 0.5 || Math.min(B.h[0], B.h[2]) < 0.3 || B.h[1] < 0.2) continue; }
        game.teleportPlayer(p); for (let i = 0; i < 4; i++) W.step(DT); pl.aim.clear();
        if (v3.distXZ(c.pos, p) < 0.1) return p; }
      return null;
    };
    const hold = (p: number[], n: number) => { for (let i = 0; i < n; i++) { W.cursorAt(p); W.step(DT); } };
    const shoot = (t: any) => { hold(t.pos, 3); fireWeapon(game, c, t.pos, true, { spread: 0 }); W.step(DT); return !!t.broken; };
    const place = (t: any, clear = true) => { for (const d of clear ? [5, 4, 3, 6] : [6, 5.5, 5, 6.5, 7]) { const p = spotFor(t, d, clear); if (p) return p; } return null; };
    const isDark = (t: any) => v3.dist(st[t.boxes[0]].albedo, CARLAMPS.dark) < 1e-6;
    const tail = lamps.find(t => !deadLamp(t)), head = lamps.find(deadLamp);
    const tailWas = tail ? [...st[tail.boxes[0]].albedo] : [0, 0, 0], headWas = head ? [...st[head.boxes[0]].albedo] : [0, 0, 0];
    { // from the far side of the car first: the round stops in the body and the lamp stands
      const far = tail ? place(tail, false) : null; const through = far ? shoot(tail) : true;
      line(!!far && !through, '3 a round at a tail lamp from where the car itself is in the way breaks nothing', `stood ${far ? far.map(x => x.toFixed(1)).join(', ') : 'nowhere'} · broken ${through}`); }
    let tailSpot: number[] | null = null;
    { const p = tailSpot = tail ? place(tail) : null; const lo = game.events.length;
      const got = p ? shoot(tail) : false; const seen = game.events.slice(lo).filter((e: any) => e.kind === 'lightOut').length;
      for (let i = 0; i < 3; i++) W.step(DT);
      const e = tail ? st[tail.boxes[0]].emissive : [1, 1, 1];
      line(!!p && got && e[0] === 0 && e[1] === 0 && e[2] === 0 && isDark(tail) && seen === 1 && tail.factor === 0, '4 a round into a glowing tail lamp puts it out: the glow gone, the box painted dark, and one light event for whoever had a line to it',
        `stood ${p ? p.map(x => x.toFixed(1)).join(', ') : 'nowhere'} · broken ${got} · glow ${e.map((x: number) => x.toFixed(2)).join(',')} · dark ${tail ? isDark(tail) : '-'} · light events ${seen}`); }
    { const p = head ? place(head) : null; const lo = game.events.length; const got = p ? shoot(head) : false; const seen = game.events.slice(lo).filter((e: any) => e.kind === 'lightOut').length;
      for (let i = 0; i < 3; i++) W.step(DT);
      line(!!p && got && isDark(head) && seen === 0, '5 a round into a dead head lamp breaks the glass: the box painted dark, and no light event — nothing went out',
        `stood ${p ? p.map(x => x.toFixed(1)).join(', ') : 'nowhere'} · broken ${got} · dark ${head ? isDark(head) : '-'} · light events ${seen}`); }
    { game.repairLights(); for (let i = 0; i < 3; i++) W.step(DT);
      const back = !!tail && !!head && v3.dist(st[tail.boxes[0]].albedo, tailWas) < 1e-6 && v3.dist(st[head.boxes[0]].albedo, headWas) < 1e-6 && st[tail.boxes[0]].emissive[0] > 0.4 && !tail.broken && !head.broken;
      line(back, '6 mended (a restart, a load that finds them whole): both lamps are painted as the level has them and the tail lamp burns again', `tail ${tail ? st[tail.boxes[0]].albedo.map((x: number) => x.toFixed(2)).join(',') : '-'} · head ${head ? st[head.boxes[0]].albedo.map((x: number) => x.toFixed(2)).join(',') : '-'}`); }

    // (4) the switch off: no lamp is a target, a round at one does nothing; and the run nobody shoots a lamp in is the same run
    { const g0 = off.game, s0 = g0.engine.world.statics, box = tail ? tail.boxes[0] : 0, e0 = [...s0[box].emissive], a0 = [...s0[box].albedo], n = g0.targets.length;
      for (let i = 0; i < 3 && !g0.player.pistolUp; i++) { off.input.pressed.add(i === 0 ? 'Digit1' : 'KeyE'); for (let k = 0; k < 50; k++) off.step(DT); }
      const at = [...s0[box].c]; g0.teleportPlayer(tailSpot ?? [at[0] - 4, 0, at[2]]); for (let i = 0; i < 4; i++) off.step(DT); g0.player.aim.clear();
      for (let i = 0; i < 3; i++) { off.cursorAt(at); off.step(DT); }
      const lo = g0.events.length; fireWeapon(g0, g0.player.char, at, true, { spread: 0 }); for (let i = 0; i < 3; i++) off.step(DT);
      const shot = g0.events.slice(lo).find((e: any) => e.kind === 'shot'), met = shot ? v3.dist(shot.to, at) : 99;
      line(!!tailSpot && met < 0.3 && !g0.targets.some((t: any) => t.group === VEHICLE_GROUP) && g0.targets.length === n && v3.dist(s0[box].emissive, e0) < 1e-9 && v3.dist(s0[box].albedo, a0) < 1e-9 && !g0.targets.some((t: any) => t.boxes.includes(box)),
        '7 with the switch off no lamp is a target, and the same round from the same spot meets the tail lamp and leaves its box as it was', `${n} targets, none a vehicle's · the round stopped ${met.toFixed(2)} m from the lamp · glow ${s0[box].emissive.map((x: number) => x.toFixed(2)).join(',')}`); }
    { const run = async (on: boolean) => { const V: any = await stand('office.json', on); await hushed(() => { for (let i = 0; i < 600; i++) V.step(DT); }); const d = digestGame(V.game, true); const rows = (String(d.targets).match(/(?:head|tail) lamp \d+:[01]X?-?[\d.]+/g) ?? []).length; d.targets = String(d.targets).replace(/(?:head|tail) lamp \d+:[01]X?-?[\d.]+ ?/g, '').trim();   // (the digest lists every light that is not burning: the dead head lamps are four rows of it, and nothing else may differ)
        return { h: hashDigest(d) as string, rows, n: V.game.targets.filter((t: any) => t.group === VEHICLE_GROUP).length }; };
      const a = await run(false), b = await run(true);
      line(a.h === b.h && a.n === 0 && a.rows === 0 && (BREAK || (b.n === 8 && b.rows === 4)), '9 ten seconds of the office night with the lamps for targets and nobody shooting one: the same run by digest as with none, but for the four dark head lamps\' own rows in its list of lights not burning', `off ${a.h} · on ${b.h} (${b.n} lamps, ${b.rows} rows of them in the digest)`); }

    // (5) the stands and a recording from before the table
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`);
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(game)));
      // a recording from before the table: its tables are laid down before its level is stood up (the page's player and rerun.ts both call carLampsTape there)
      CARLAMPS.on = true; const old = snap(); delete old.tables.CARLAMPS; carLampsTape(old.tables); const tapeOff = CARLAMPS.on === false;
      CARLAMPS.on = true; carLampsTape(snap().tables); const tapeOn = CARLAMPS.on === true;
      const called = ['src/replay/engineplay.ts', 'tools/qa/rerun.ts'].filter(f => !/carLampsTape\(src\)/.test(readFileSync(`${ROOT}/${f}`, 'utf8')));
      if (!/TPS_CARLAMPS = .*CARLAMPS\?\.on/.test(readFileSync(`${ROOT}/tools/qa/replay.ts`, 'utf8'))) called.push('tools/qa/replay.ts');   // (a session file's own replay stands its game up on the file's word)
      // … and the level is the same level to a checkpoint or a recording with the lamps for targets or without
      const fpOn = levelFingerprint(game).fp as string, fpOff = levelFingerprint(off.game).fp as string;
      CARLAMPS.on = true; J.applyKnobs(game, old); const before = CARLAMPS.on;
      CARLAMPS.on = true; const recOn = snap(); CARLAMPS.on = false; J.applyKnobs(game, recOn); const kept = CARLAMPS.on;
      line(fpOn === fpOff && tapeOff && tapeOn && called.length === 0 && before === false && kept === true && PR.FROZEN_HOLDS['CARLAMPS.on'] === 'TPS_CARLAMPS=1' && SE.STAND_ENV.includes('TPS_CARLAMPS'), '8 the level\'s fingerprint is the same with the lamps for targets as without; a recording from before the table has the switch put down before its level is stood up (the two tape players and the session replay each see to it), one made with it on keeps it; the stands\' list has the row and the word',
        `fingerprint ${fpOn} with, ${fpOff} without · a tape without the table, before the build: ${tapeOff ? 'down' : 'UP'} · with it: ${tapeOn ? 'up' : 'DOWN'} · not calling: ${called.join(', ') || 'none'} · applyKnobs without the table: ${before} · recorded on: ${kept} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CARLAMPS.on'] ?? 'no row'} · STAND_ENV ${SE.STAND_ENV.includes('TPS_CARLAMPS')}`); }
  } catch (e) { console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); all = false; }
  finally { Object.assign(CARLAMPS, was); Object.assign(CARLAMPS_STATS, stats0); Math.random = rnd; }
  console.log(`=== carlamps: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await carlampsCheck()) ? 0 : 1);
