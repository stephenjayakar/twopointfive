#!/usr/bin/env bun
// THE TWO CHARGES, THE RULE ITSELF (src/game/defuse.ts over levels/defuse.json): staged by hand, one question a line. tools/qa/defuse-run.ts is the PLAY of it
// (two pairs at once against the whole squad in turn); this is what the overlay promises whoever plays.
//   bun run tools/qa/defuse-check.ts            (passes on both stands; the teammate line raises the squad's work order itself)
//   DEFUSE_BREAK=1 bun run tools/qa/defuse-check.ts     = the overlay switched off and the same lines asked: must fail
// Lines: off (a level without the block, and the switch off, are the room clear alone; THIS level played with the switch off and played with the block taken out
// of its file digest the same) · row (the Missions row: four only, a premise for a blurb, charges named without compass words, two doors to each) · clock (waits
// for the first move or order, then runs in the objective row) · sam (his Space row: offered in reach, lets go on a step, makes safe after the level's seconds;
// the row says he is on it and the marker goes to the other charge) · team (a pair ordered to it makes it safe, the row names the man) · blast (the clock at zero
// is a real blast: a man beside it goes down, the row reads FAILED; the last seconds tick for the player wherever he is; failed and THEN the house taken is not
// won and is not said as 'structure taken') · over (Sam down first: no blast behind the card) · restart · save (snapshot / restore, called directly: no
// checkpoint is written in play with a squad on the floor, so this is the only road to that slice today) · win (both safe and the house taken).
// `probes.ts defuse` (in family `missions`) runs it. Exit 0 = every line passed, 1 = a line failed.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { DEFUSE } = await import(`${ROOT}/src/game/defuse.ts`);
const { killGuard, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { objectiveText } = await import(`${ROOT}/src/game/mission.ts`);
const { squadChoices } = await import(`${ROOT}/src/game/loadout.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, BREAK = process.env.DEFUSE_BREAK === '1';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOf = (file: string, patch?: (l: any) => void) => { const l = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))); patch?.(l); return l; };
let fails = 0;
export async function defuseCheck(): Promise<boolean> {
fails = 0; const env0 = process.env.TPS_WORKTHINGS; process.env.TPS_WORKTHINGS ??= '1';   // (the frozen stand holds the squad's work order off: the teammate line needs it; put back below)
try {
const line = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; };

/** a room clear with the four staged on a level; Sam cannot be hurt or seen unless a line says otherwise */
async function stage(file: string, patch?: (l: any) => void) {
  Math.random = seeded(0x51ab);
  const W: any = await standUp({ uploadEvery: 4, level: levelOf(file, patch) }), g = W.game;
  g.godMode = true; g.playerInvisible = true;
  const { why } = startFromQuery(g, new URLSearchParams(`levelFile=${file}&roomclear=1&squad4`)); if (why) throw new Error(`start refused — ${why}`);
  const run = (secs: number, keys: string[] = []) => { for (let f = 0, n = Math.round(secs / DT); f < n; f++) { if (f === 0) for (const k of keys) W.input.pressed.add(k); W.step(DT); } };
  const foes = () => g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead');
  const sweep = () => { for (const x of foes()) killGuard(g, x, [1, 0, 0], false, 'shot', 'player'); };
  run(DT);
  return { W, g, DF: g.defuse, run, sweep };
}
const stand = (g: any, i: number): Vec3 => { const d = g.level.scenarios.defuse.devices[i]; return [d.pos[0] + d.n[0] * 0.4, 0, d.pos[2] + d.n[1] * 0.4]; };

if (BREAK) DEFUSE.on = false;

console.log('defuse-off — a level without the block, and the switch off');
{ const { g, DF, run } = await stage('test-rooms.json'); run(1);
  line(!DF.active && DF.objective() === null && DF.armed().length === 0, 'a room clear on a level with no charges: the overlay is not live, no row, no thing to work');
  if (!BREAK) { DEFUSE.on = false; const s = await stage('defuse.json'); s.g.teleportPlayer([20, 0, 20]); s.run(3);
    line(!s.DF.active && !s.DF.started && s.DF.objective() === null && !/clock/.test(objectiveText(s.g)), 'the switch off on the charges\' own level: no clock, the objective row is the room clear\'s');
    DEFUSE.on = true; }
  void g;
  // (the pair that says something: the charges' own level with the switch off, against the same file with the block taken out of it — and, so the digest is
  //  known to see the overlay at all, against the mission as shipped, which must differ: its clock blows both charges inside the stretch)
  const dig = async (on: boolean, strip: boolean) => { DEFUSE.on = on; const s = await stage('defuse.json', l => { if (strip) delete l.scenarios.defuse; else l.scenarios.defuse = { ...l.scenarios.defuse, secs: 5 }; }); s.run(1); s.g.orders.give('fallIn', { kind: 'none' }, 'all'); s.g.teleportPlayer([s.g.player.char.pos[0] + 1.5, 0, s.g.player.char.pos[2]]); s.run(9); return JSON.stringify(digestGame(s.g, true)); };
  if (!BREAK) { const a = await dig(false, false), b = await dig(true, true), c = await dig(true, false); DEFUSE.on = true;
    line(a === b && a.length > 200, `this level played ten seconds with the switch off, and with the block taken out of its file: the same game by digest (${a.length} B)`);
    line(c !== a, '…and the mission itself (a 5 s clock) is another game by that digest: the pair above is not blind to it'); } }

console.log('defuse-row — the Missions row and the level, as promised');
{ const row = SCENARIOS.find((e: any) => e.id === 'defuse-four'), sizes = row ? squadChoices(row).filter((c: any) => c.ok).map((c: any) => c.n) : [];
  line(!!row && sizes.join() === '4', `the row deploys at four only — sizes offered: ${sizes.join(', ') || 'none'}`);
  line(!!row && row.blurb.length >= 20 && row.blurb.length <= 160 && !/send a pair|split|a pair to each/i.test(row.blurb), `the blurb is the premise, not the answer — '${row?.blurb}'`);
  const { g } = await stage('defuse.json'), D = g.level.scenarios.defuse, R = g.level.scenarios.roomClear.rooms;
  line(D.devices.every((d: any) => !/north|south|east|west/i.test(d.name)) && new Set(D.devices.map((d: any) => d.name)).size === D.devices.length, `the charges' names carry no compass word — ${D.devices.map((d: any) => d.name).join(', ')}`);
  { const said = [...R.flatMap((r: any) => [r.name, ...r.doors.flatMap((x: any) => [x.id, x.from])]), ...g.doors.list.map((x: any) => x.def.name)].filter(Boolean), bad = said.filter((w: string) => /north|south|east|west/i.test(w));
    line(said.length > 10 && !bad.length, `nor do the rooms, the doors or where a door is entered from: 1 and 2, as painted at the doors — ${bad.length ? `compass words in ${bad.join(', ')}` : [...new Set(R.map((r: any) => r.name))].join(', ')}`); }
  const inRoom = (d: any) => R.find((r: any) => d.pos[0] > r.bounds.x0 && d.pos[0] < r.bounds.x1 && d.pos[2] > r.bounds.z0 && d.pos[2] < r.bounds.z1);
  line(D.devices.every((d: any) => (inRoom(d)?.doors?.length ?? 0) >= 2), `every charge's room has two doors (one from its wing, one from outside) — ${D.devices.map((d: any) => `${d.name}: ${(inRoom(d)?.doors ?? []).map((x: any) => x.id).join(' + ') || 'no room'}`).join(' · ')}`); }

console.log('defuse-clock — it waits for the first move, then runs in the objective row');
{ const { g, DF, run } = await stage('defuse.json'); run(2);
  line(DF.active && !DF.started && /starts when you move/.test(objectiveText(g)), `staged and still: live, not started, the row says so — '${objectiveText(g).slice(0, 70)}…'`);
  const at = g.player.char.pos; g.teleportPlayer([at[0] + 2, 0, at[2]]); run(1.5);
  line(DF.started && DF.left < g.level.scenarios.defuse.secs && DF.left > g.level.scenarios.defuse.secs - 3 && new RegExp(`${Math.floor(DF.left / 60)}:${String(Math.floor(DF.left % 60)).padStart(2, '0').slice(0, 1)}\\d on the clock`).test(objectiveText(g)) && !/starts when/.test(objectiveText(g)), `Sam moves: the clock runs — ${DF.left.toFixed(1)} s left, '${objectiveText(g).slice(0, 44)}…'`);
  const s2 = await stage('defuse.json'); s2.run(1); s2.g.orders.give('hold', { kind: 'none' }, 'all'); s2.run(0.5);
  line(s2.DF.started, 'or the first order starts it with Sam standing still'); }

console.log('defuse-sam — his own Space row');
{ const { g, DF, run, sweep } = await stage('defuse.json'); sweep(); run(0.5);
  g.teleportPlayer([20, 0, 14]); run(0.5);
  line(!g.selectVerb('objective', 'defuse'), 'out in the hall: no row');
  g.teleportPlayer(stand(g, 1)); run(0.5);
  const offered = g.selectVerb('objective', 'defuse'); line(offered, 'stood at charge 2: the row is offered');
  const D = g.level.scenarios.defuse.devices, near = (o: any, i: number) => !!o?.pos && Math.hypot(o.pos[0] - D[i].pos[0], o.pos[2] - D[i].pos[2]) < 0.1;
  line(near(DF.objective(), 1), 'nobody on either: the marker is on the charge nearest him');
  run(1.5, ['Space']); line(DF.working && DF.states[1] === 'armed', 'Space: he is on it, the charge still live');
  line(/charge 2 · you on it/.test(objectiveText(g)) && /charge 1 · nobody on it/.test(objectiveText(g)) && near(DF.objective(), 0), `the row says who is on which, the marker goes to the one nobody is at — '${objectiveText(g).slice(0, 96)}'`);
  run(0.3, ['Space']); line(!DF.working && DF.states[1] === 'armed', 'Space again lets go: still live');
  g.selectVerb('objective', 'defuse'); run(1.0, ['Space']); line(DF.working, '…and the row takes it up again from the start');
  const p = stand(g, 1); g.teleportPlayer([p[0] - 1.2, 0, p[2] + 0.6]); run(0.3);
  line(!DF.working && DF.states[1] === 'armed', 'shoved off the spot: it lets go, still live');
  g.teleportPlayer(stand(g, 1)); run(0.5); g.selectVerb('objective', 'defuse'); run(DF.workSecs - 0.5, ['Space']);
  line(DF.working && DF.states[1] === 'armed', `back on it: not safe before the level's ${DF.workSecs} s`);
  run(1.2); line(DF.states[1] === 'safe' && DF.safeBy[1] === 'Player' && DF.end === null, `…and safe after them, by Sam — states ${DF.states.join(', ')}`); }

console.log('defuse-team — a pair ordered to it');
{ const { g, DF, run, sweep } = await stage('defuse.json', l => { l.scenarios.defuse = { ...l.scenarios.defuse, secs: 240 }; }); sweep(); run(0.5);
  g.teleportPlayer([20, 0, 15]); run(0.2);
  const d = g.level.scenarios.defuse.devices[0], T = g.work.near([d.pos[0], 0, d.pos[2] + 0.4])?.target;
  line(g.level.scenarios.defuse.devices.every((c: any) => { const t = g.work.near([c.pos[0] + c.n[0] * 0.4, 0, c.pos[2] + c.n[1] * 0.4])?.target; return t?.thing?.kind === 'device' && !!t.thing.stand; }), 'every charge of the level has floor a man can stand on to work it');
  line(!!T?.thing && T.thing.kind === 'device', `the squad's work order knows charge 1 — ${T?.thing ? T.thing.name : 'no thing there'}`);
  const r = T ? g.orders.give('work', T, 'red') : null; let t = 0, said = '', mark = false, going = false, onIt = '', handOn = false;
  while (t < 90 && DF.states[0] === 'armed') { run(0.5); t += 0.5; const o = DF.objective(), m = /charge 1 · (Red \w+) (going|on it)/.exec(o?.text ?? ''); if (m) { said ||= m[0]; if (m[2] === 'going') going = true; else { onIt ||= m[0]; handOn ||= !!g.work.hand(g.guards.find((x: any) => x.callsign === m[1])?.char); } mark ||= !!o?.pos && Math.abs(o.pos[0] - g.level.scenarios.defuse.devices[1].pos[0]) < 0.1; } }
  line(!!said && mark, `while he is at it the row names him and the marker is on the other charge — '${said || 'never said'}'`);
  line(going && !!onIt && handOn, `'going' on his way, then 'on it' with his hand out on the charge — ${going ? 'going' : 'never going'}, then '${onIt || 'never on it'}'${handOn ? '' : ' (no hand out)'}`);
  line(DF.states[0] === 'safe' && !!DF.safeBy[0] && DF.safeBy[0] !== 'Player', `red sent to it: safe after ${t.toFixed(1)} s by ${DF.safeBy[0] ?? 'nobody'}${r ? ` (order refused: ${r})` : ''}`);
  const again = g.work.near([d.pos[0], 0, d.pos[2] + 0.4])?.target;
  line(!again?.thing || again.thing.kind !== 'device' || again.thing.dev !== 0, 'a charge made safe is no longer a thing to work'); }

console.log('defuse-blast — the clock at zero');
{ const { g, DF, run } = await stage('defuse.json', l => { l.scenarios.defuse = { ...l.scenarios.defuse, secs: 4 }; });
  const foe = g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead').length;
  g.godMode = false; const p = stand(g, 0); g.teleportPlayer([p[0], 0, p[2] + 0.8]); run(0.2);
  const hp0 = g.player.down; run(6);
  const rows = DF.log.filter((r: any) => /^blown:/.test(r.what)).map((r: any) => r.what), hurt = rows.reduce((n: number, r: string) => n + Number(/(\d+) killed/.exec(r)?.[1] ?? 0) + Number(/(\d+) wounded/.exec(r)?.[1] ?? 0), 0);
  line(DF.end === 'failed' && DF.states.every((s: string) => s === 'blown') && rows.length === 2, `both charges went off — ${rows.join(' · ')}`);
  line(!hp0 && g.player.down, 'a man standing by one is put down by it (the game\'s own blast, god mode off)');
  line(hurt > 0, `…and the blast's own count has the room's men in it: ${hurt} killed or wounded`);
  line(DF.objective() === null, 'with Sam down the row is the room clear\'s own (its card, its key)');
  const s2 = await stage('defuse.json', l => { l.scenarios.defuse = { ...l.scenarios.defuse, secs: 3 }; });
  const ticks: unknown[] = [], play0 = s2.g.audio.play.bind(s2.g.audio); s2.g.audio.play = (n: string, pos: unknown, ...r: unknown[]) => { if (n === 'click') ticks.push(pos); return play0(n, pos, ...r); };
  s2.g.teleportPlayer([20, 0, 20]); s2.run(5);
  line(s2.DF.end === 'failed' && /FAILED/.test(objectiveText(s2.g)) && !s2.DF.won, `Sam standing clear: the row reads failed — '${objectiveText(s2.g).slice(0, 60)}…'`);
  line(ticks.length >= 2 && ticks.length <= 4 && ticks.every(p => p === null), `the last seconds tick once a second for the player wherever he stands (no place on the sound) — ${ticks.length} ticks on a 3 s clock`);
  const texts = () => (s2.g.messages ?? []).map((m: any) => typeof m === 'string' ? m : m.text ?? '').join(' | ');
  for (const x of s2.g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead')) killGuard(s2.g, x, [1, 0, 0], false, 'shot', 'player'); s2.run(2);
  line(s2.g.roomClear.end === 'taken' && !s2.DF.won && s2.DF.end === 'failed' && /FAILED/.test(objectiveText(s2.g)) && !/structure taken/.test(texts()) && /stays failed/.test(texts()),
    `failed, then the house taken, is not won: the row still reads FAILED and nobody says 'structure taken' — room clear '${s2.g.roomClear.end}'`);

  console.log('defuse-over — the run ended another way first');
  const s3 = await stage('defuse.json', l => { l.scenarios.defuse = { ...l.scenarios.defuse, secs: 4 }; }); s3.g.godMode = false; s3.g.teleportPlayer([20, 0, 20]); s3.run(1);
  for (let k = 0; k < 12 && !s3.g.player.down; k++) hitPlayer(s3.g, [1, 0, 0]); s3.run(6);
  line(s3.g.player.down && s3.DF.end === 'over' && s3.DF.states.every((s: string) => s === 'armed') && s3.DF.objective() === null, `Sam down with the clock running: it stops, no blast behind the card — end '${s3.DF.end}', ${s3.DF.states.join(', ')}`);

  console.log('defuse-restart — a fresh staging starts it over');
  g.godMode = true; g.restartEncounter(); run(0.5);
  line(DF.active && DF.end === null && !DF.started && DF.states.every((s: string) => s === 'armed'), `after a restart: live, both armed, the clock waiting — ${DF.states.join(', ')}`); }

console.log('defuse-save — snapshot and restore');
{ const { g, DF, run, sweep } = await stage('defuse.json'); sweep(); g.teleportPlayer([20, 0, 15]); run(3);
  DF.makeSafe(0, 'Player'); run(2);
  const snap = JSON.parse(JSON.stringify(DF.snapshot() ?? null)) ?? undefined, left = DF.left, st = DF.states.join(',');
  run(5); DF.makeSafe(1, 'Player'); run(0.5);
  DF.restore(snap); run(DT);
  line(!!snap && DF.states.join(',') === st && DF.end === null && Math.abs(DF.left - left) < 0.1 && DF.safeBy[0] === 'Player' && DF.safeBy[1] === null, `the clock, the charges and who made them safe come back as saved — ${st}, ${left.toFixed(2)} s then, ${DF.left.toFixed(2)} s now, by ${DF.safeBy.map((x: any) => x ?? '–').join(', ')}`);
  // (a file that lies about itself: every charge safe but no end written, names for charges that are not safe, `by` not a list — the end is read off the
  //  charges and the row neither throws nor names a marker)
  { let threw = ''; try { DF.restore({ ...snap, st: ['safe', 'safe'], by: 'Player' as any, end: null }); DF.objective(); } catch (e: any) { threw = String(e?.message ?? e); }
    line(!threw && DF.end === 'safe' && DF.safeBy.every((x: any) => x === null), `a file with every charge safe and no end: the end is the charges' own word, nothing throws — end ${DF.end}${threw ? ` · threw ${threw}` : ''}`);
    DF.restore({ ...snap, st: ['armed', 'blown'], by: ['Player', 'Player'], end: null });
    line(DF.end === 'failed' && DF.safeBy.every((x: any) => x === null), `…one blown: failed, and no name kept for a charge that is not safe — end ${DF.end}`); }
  DF.restore(undefined); run(DT);
  line(DF.active && !DF.started && DF.states.every((s: string) => s === 'armed'), 'a file with no slice: a fresh clock');

  console.log('defuse-win — both safe AND the house taken');
  g.teleportPlayer([22, 0, 15]); run(1); DF.makeSafe(0, 'Player'); DF.makeSafe(1, 'Player'); run(2);
  line(DF.end === 'safe' && g.roomClear.end === 'taken' && DF.won, `every charge safe, nobody left: won (room clear '${g.roomClear.end}')`); }
{ const { g, DF, run } = await stage('defuse.json'); g.teleportPlayer([20, 0, 20]); run(1); DF.makeSafe(0, 'Player'); DF.makeSafe(1, 'Player'); run(1);
  line(DF.end === 'safe' && !DF.won && g.roomClear.end === null, 'both safe with defenders still up: not won yet, the room clear runs on');
  line(!/clock/.test(objectiveText(g)), 'the objective row is the room clear\'s own again'); }

} finally { if (env0 === undefined) delete process.env.TPS_WORKTHINGS; else process.env.TPS_WORKTHINGS = env0; DEFUSE.on = true; }
return fails === 0;
}
if (import.meta.main) { const ok = await defuseCheck(); console.log(ok ? '=== defuse-check: ALL PASS ===' : `=== defuse-check: ${fails} FAILED ===`); process.exit(ok ? 0 : 1); }
