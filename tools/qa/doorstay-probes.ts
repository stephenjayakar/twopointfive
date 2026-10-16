// The 'stay-open' family: DOORS STAY WHERE THEY ARE LEFT (src/game/doors.ts DOORSTAY; the maintainer, 10-08: 'doors … doesn't automatically close'). Run through
// probes.ts:   bun run tools/qa/probes.ts stay-open | stay-open-wait | stay-open-off | stay-open-lock | stay-open-seal | stay-open-save | stay-open-pass | stay-open-floor
// PASS / FAIL each, all headless (the Game of headless.ts; nothing is drawn or heard).
//   stay-open-wait   every door of every level, opened four ways (a hand from either face, stood ajar, flung to its stop), nobody touching it: three minutes of
//                    game time on, the leaf stands exactly where it came to rest, unlatched — and no leaf anywhere latched in the meantime
//   stay-open-off    DOORSTAY.on false, the same hand on the same doors: the closer takes them back to their latch (the old game; the control that says the
//                    wait probe can see a door close)
//   stay-open-lock   a keyed door opened with the key: it stands open behind him with its bolt still thrown — a doorway to anyone, no springing locked — until a
//                    hand pulls it to, and then the lock bites again for a man with no key. The same for a staff man who walks through it
//   stay-open-seal   sight, shots and sound through a doorway follow where the leaf really stands: open a minute on, still open; pulled to, blocked and sealed
//   stay-open-save   a checkpoint keeps every leaf's angle: stood at three angles, saved, the level put back as authored, loaded — the same angles, and still
//                    the same angles a minute on
//   stay-open-pass   a staff man whose way is past a leaf on its stop (the four leaf-wedge cases of the office) gets there, and the leaf has not been pulled
//                    to: it stands where it stood (the old game's `yank` shut every one of them behind him — shown beside, with the switch off)
//   stay-open-after  what a reading of the code found afterwards: the response's stair door is pulled to by its last man (no closer does it now), a lockdown
//                    tidy shuts a door to the outside, a save keeps who a standing leaf is letting past, a keyless man with a high id never borrows Sam's
//                    pass, a drill's 'is it open enough' reads a one-way leaf by how wide it stands, a man in Sam's arm waits on no hand of his own
//   stay-open-floor  five minutes of the office's night with the AI running and Sam out of it: every latch the floor hears was a pull somebody asked for
//                    (Doors.pullTo — a lockdown tidy, a man digging in), never a leaf coming to by itself
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
type V3 = [number, number, number];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${f2(p[0])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { DOORSTAY.on = true; } };
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
/** every level a mission is played on, and the two yards (undefined = the office the harness stands by default) */
const ALL_LEVELS: (string | undefined)[] = [undefined, 'records.json', 'depot.json', 'block.json', 'block-squads.json', 'barracks.json', 'compound.json', 'warehouse.json', 'registry.json', 'kit-yard.json', 'test-rooms.json'];
/** STAY_LEVELS=office,depot (env): the wait over those levels only */
const LEVELS = process.env.STAY_LEVELS ? ALL_LEVELS.filter(f => process.env.STAY_LEVELS!.split(',').includes((f ?? 'office.json').replace('.json', ''))) : ALL_LEVELS;

/** (the harness stands every game up with the closers of old — src/host/standup.ts: the switch is put where the probe wants it AFTER the stand-up) */
async function rig(seed = 7, level?: string, stay = true) {
  Math.random = seeded(seed);
  const W: any = await standUp(level ? { level: levelOfFile(level) } : {}); DOORSTAY.on = stay;
  const g = W.game; g.godMode = true; g.aiEnabled = false; g.playerInvisible = true;
  const R = { W, g,
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } },
    secs(s: number, each?: () => void) { for (let i = 0; i < Math.round(s * 60); i++) { g.player.visibility = 0.05; W.step(DT); each?.(); } },
    door(name: string): any { return g.doors.list.find((d: any) => d.def.name === name); },
  };
  R.step(10);
  return R;
}
/** nobody walks: the shift held where it stands (with the AI off a patrol still walks its route and pushes leaves — a person moving a door is not the door moving), the cleaner and the late worker off the floor */
function still(g: any) { for (const o of g.guards) { o.hold = true; o.path = []; o.pathGoal = null; } g.tune.civilians = false; }
/** a point `b` metres off the frame line on face `side`, mid-opening */
const off = (d: any, side: 1 | -1, b: number, y = 1.1): V3 => doorPt(d, d.def.width / 2, b, side, y);
const shut = (d: any) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place(); };
/** Sam out of every leaf's reach: the free nav cell furthest from any hinge */
function parkSam(g: any) {
  const nav = g.col.nav; let best: V3 | null = null, bd = -1;
  for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) {
    if (nav.blocked[z * nav.W + x]) continue; const px = (x + 0.5) * nav.cell, pz = (z + 0.5) * nav.cell;
    let m = Infinity; for (const d of g.doors.list) m = Math.min(m, Math.hypot(px - d.def.hinge[0], pz - d.def.hinge[1]));
    for (const o of g.guards) m = Math.min(m, Math.hypot(px - o.char.pos[0], pz - o.char.pos[2]) + 1.5);
    if (m > bd && m < 12) { bd = m; best = [px, 0, pz]; }
  }
  if (best && bd > 2.5) { g.teleportPlayer(best); return bd; }
  let m = Infinity; for (const d of g.doors.list) m = Math.min(m, Math.hypot(g.player.char.pos[0] - d.def.hinge[0], g.player.char.pos[2] - d.def.hinge[1]));
  return m;
}
/** is anybody standing inside d's swing circle */
const manAt = (g: any, d: any) => [g.player.char, ...g.guards.filter((x: any) => x.state !== 'dead').map((x: any) => x.char)].some((c: any) => Math.hypot(c.pos[0] - d.def.hinge[0], c.pos[2] - d.def.hinge[1]) < d.def.width + 0.5);
type How = 'hand+' | 'hand-' | 'ajar' | 'flung';
/** open every door of the level one way; everything a hand or a boot would do goes through the Doors' own verbs */
function openAll(g: any, how: How) {
  for (const d of g.doors.list) {
    shut(d);
    if (how === 'hand+' || how === 'hand-') g.doors.use(d, off(d, how === 'hand+' ? 1 : -1, 0.6, 0), PLAYER_ID, new Set([d.lockId]));
    else if (how === 'ajar') { const a = d.maxA > 0.3 ? 0.3 : -0.3; d.latched = false; d.angle = Math.max(d.minA, Math.min(d.maxA, a)); d.place(); }
    else { const s = Math.abs(d.maxA) >= Math.abs(d.minA) ? 1 : -1; d.latched = false; d.vel = s * 7.5; d.sinceBash = 0; d.quietT = -0.5; }
  }
}

// ---------------------------------------------------------------- the wait
const waitOver = (levels: (string | undefined)[], hows: How[], name: string) => guarded(async () => {
  const { verdict, done } = family(`${name}: every door of ${levels.length === ALL_LEVELS.length ? 'every level' : levels.map(f => (f ?? 'office.json').replace('.json', '')).join(' + ')}, opened ${hows.length === 4 ? 'four' : hows.length} ways, three minutes untouched — the leaf stands where it came to rest`);
  let leaves = 0, doorsAll = 0; const bad: string[] = [], never: string[] = [], lines: string[] = [];
  for (const file of levels) {
    let R: Awaited<ReturnType<typeof rig>>; const tag = file ?? 'office.json';
    try { R = await rig(11, file); } catch (e) { bad.push(`${tag}: did not load (${String(e).slice(0, 80)})`); continue; }
    const g = R.g, list: any[] = g.doors.list; still(g); const clear = parkSam(g); R.step(30); doorsAll += list.length;
    const opened = new Set<any>(); let n = 0, latches = 0, withMan = 0;
    for (const how of hows) {
      openAll(g, how); R.secs(12);                                   // (a hand's swing has run down, a flung leaf is off its stop's bounce)
      const a0 = list.map(d => d.angle), l0 = list.map(d => d.latched);
      let moved = list.map(() => 0); const was = list.map(d => d.latched);
      R.secs(180, () => { for (let i = 0; i < list.length; i++) { const d = list[i]; moved[i] = Math.max(moved[i], Math.abs(d.angle - a0[i])); if (d.latched && !was[i]) latches++; was[i] = d.latched; } });
      for (let i = 0; i < list.length; i++) {
        const d = list[i]; if (l0[i]) continue;                      // (this way did not open it: counted below if NO way did)
        opened.add(d); n++; leaves++; if (manAt(g, d)) withMan++;
        if (moved[i] > 1e-6 || d.latched || d.closing) bad.push(`${tag} ${d.def.name} ${how}: stood at ${f2(a0[i])}, moved ${moved[i].toExponential(1)} rad${d.latched ? ', LATCHED' : ''}${d.closing ? ', closing' : ''}`);
      }
    }
    for (const d of list) if (!opened.has(d)) never.push(`${tag} ${d.def.name}`);
    lines.push(`${tag}: ${list.length} doors (${list.filter((d: any) => d.def.steel).length} steel, ${list.filter((d: any) => d.def.locked).length} keyed, ${list.filter((d: any) => d.def.closer === false).length} authored with no closer), ${n} leaves stood open, ${latches} latched in the waits · Sam ${f2(clear)} m from the nearest hinge${withMan ? ` · ${withMan} with a man standing in the swing` : ''}`);
    for (const d of list) d.reset();
  }
  for (const l of lines) console.log(`    ${l}`);
  verdict(leaves > 0 && bad.length === 0, `${leaves} opened leaves over ${lines.length} levels (${doorsAll} doors): three minutes on, not one has moved, latched or started to close`, bad.length ? `${bad.length} bad:\n      ${bad.slice(0, 30).join('\n      ')}` : 'a hand from either face (Doors.use, the key in the hand where it is keyed), stood ajar at 0.3 rad, flung to the stop; 12 s to come to rest, then 180 s watched every frame');
  verdict(never.length === 0, 'every door opened at least one of the ways tried', never.length ? `never off its latch: ${never.join(', ')}` : 'none stayed latched through them all');
  return done();
});
/** the whole sweep: every level a mission is played on, four ways (minutes of wall: family `stay-open` and `all`) */
export const stayOpenWait = waitOver(LEVELS, ['hand+', 'hand-', 'ajar', 'flung'], 'stay-open-wait');
/** the gate's: the office and the biggest squad map, a hand and a boot (in `doors`, hence all-quick) */
export const stayOpenWaitQuick = waitOver([undefined, 'block-squads.json'], ['hand+', 'flung'], 'stay-open-wait-quick');

// ---------------------------------------------------------------- the switch off
export const stayOpenOff = guarded(async () => {
  const { verdict, done } = family('stay-open-off: DOORSTAY.on false — the closer takes an opened door back to its latch, as it did');
  const R = await rig(11, undefined, false), g = R.g, list: any[] = g.doors.list; still(g); parkSam(g); R.step(30);
  openAll(g, 'hand+'); R.secs(1.5);
  const had = list.filter(d => !d.latched && d.def.closer !== false && !manAt(g, d)); const stays = list.filter(d => !d.latched && d.def.closer === false);
  R.secs(60);
  const back = had.filter(d => d.latched), left = stays.filter(d => !d.latched && Math.abs(d.angle) > 0.25);
  verdict(had.length > 0 && back.length === had.length, 'every opened leaf with a closer is latched again inside a minute', `${back.length} of ${had.length} latched${back.length < had.length ? ` · still open: ${had.filter(d => !d.latched).map(d => `${d.def.name} ${f2(d.angle)}`).join(', ')}` : ''}`);
  verdict(left.length === stays.length, 'the leaves the level authored with no closer stand open, as they always did', `${left.length} of ${stays.length} (${stays.map(d => d.def.name).join(', ') || 'none'})`);
  const has = (d: any) => g.doors.hasCloser(d);
  verdict(list.every(d => has(d) === (d.def.closer !== false)), 'hasCloser reads the def with the switch off', list.map(d => `${d.def.name}:${has(d) ? 'y' : 'n'}`).join(' '));
  DOORSTAY.on = true;
  verdict(list.every(d => !has(d)), '…and no leaf has one with it on', `${list.filter(d => has(d)).length} with a closer`);
  g.touring = true; R.step(2); const staged = list.every(d => has(d) === (d.def.closer !== false)); g.touring = false; R.step(2);
  verdict(staged && list.every(d => !has(d)), '…except while a showcase has the stage (Game.touring): its choreography keeps the closers it was written for, and they are gone again when it ends', `staged: ${staged ? 'closers as authored' : 'NOT as authored'} · after: ${list.filter(d => has(d)).length} with a closer`);
  return done();
});

// ---------------------------------------------------------------- locks
export const stayOpenLock = guarded(async () => {
  const { verdict, done } = family('stay-open-lock: a keyed door opened with the key stands open, its bolt thrown, until a hand shuts it — then the lock bites again');
  const R = await rig(13), g = R.g; const d = g.doors.list.find((x: any) => x.def.locked && !x.def.steel && x.def.closer !== false) ?? g.doors.list.find((x: any) => x.def.locked);
  if (!d) { verdict(false, 'a keyed door to try', 'the level has none'); return done(); }
  still(g); parkSam(g); R.step(30); shut(d); R.step(3);
  const key = new Set([d.lockId]), K = off(d, d.keySide, 0.6, 0), far = off(d, -d.keySide as 1 | -1, 0.6, 0);
  verdict(d.locked && d.latched && g.doors.lockedOut(d, K) && !g.doors.lockedOut(d, K, key) && !g.doors.lockedOut(d, far), `${d.def.name}, shut: locked against a keyless man on its keyed face, not against the key, never from the room side`, `locked ${d.locked} latched ${d.latched}`);
  g.doors.use(d, K, PLAYER_ID, key); R.secs(12); const a0 = d.angle;
  R.secs(120);
  verdict(!d.latched && Math.abs(d.angle) > 0.6 && Math.abs(d.angle - a0) < 1e-6, 'opened with the key: two minutes on it stands where the hand left it', `angle ${f2(a0)} → ${f2(d.angle)} · latched ${d.latched}`);
  verdict(d.locked && !d.lockBroken && !g.doors.lockedOut(d, K), 'its bolt is still thrown (nothing picked, nothing broken) and, standing open, it is no wall to a man with no key', `locked ${d.locked} broken ${d.lockBroken} lockedOut(keyless) ${g.doors.lockedOut(d, K)}`);
  g.doors.use(d, far, PLAYER_ID); let latchAt = -1; const t0 = g.time; R.secs(8, () => { if (latchAt < 0 && d.latched) latchAt = g.time - t0; });
  verdict(d.latched && d.locked && g.doors.lockedOut(d, K) && !g.doors.lockedOut(d, K, key), 'a hand pulls it to (Doors.use on an open leaf): it latches and the lock bites again for a man with no key', `latched ${latchAt >= 0 ? `+${f2(latchAt)} s` : 'never'} · lockedOut(keyless) ${g.doors.lockedOut(d, K)} · with the key ${g.doors.lockedOut(d, K, key)}`);
  // a staff man under a SCRIPT walks through it (a drill, an order — his contact carries the key): it opens to him and stands open behind him. (A calm man on his own
  // patrol shuts it behind him — that is stay-open-floor's check, on the real night.)
  shut(d); R.step(3);
  const gd = g.guards.find((x: any) => x.state !== 'dead' && !x.unit);
  if (!gd) { verdict(false, 'a staff man to walk through it', 'nobody on the floor'); return done(); }
  const { order } = await import(`${ROOT}/src/game/squad.ts`);
  const A = off(d, d.keySide, 2.0, 0), B = off(d, -d.keySide as 1 | -1, 2.4, 0);
  gd.hold = false; g.aiEnabled = true; gd.char.pos = [A[0], 0, A[2]]; gd.path = []; gd.pathGoal = null; order(gd, { goal: [B[0], 0, B[2]] });
  let arrived = -1, latchedAfter = false, opened = false; const t1 = g.time;
  R.secs(14, () => { if (arrived < 0 && Math.hypot(gd.char.pos[0] - B[0], gd.char.pos[2] - B[2]) < 0.6) arrived = g.time - t1; if (!d.latched) opened = true; else if (opened) latchedAfter = true; });
  R.secs(30, () => { if (d.latched) latchedAfter = true; });
  verdict(arrived >= 0 && opened && !latchedAfter && d.locked, `${gd.callsign ?? 'a staff man'}, walked through it on an order: it opens to his key and nothing swings it to behind him (half a minute on it is off its latch, bolt thrown)`, `arrived ${arrived >= 0 ? `+${f2(arrived)} s` : `never (at ${at(gd.char.pos)})`} · opened ${opened} · latched again ${latchedAfter} · angle ${f2(d.angle)} · locked ${d.locked}`);
  return done();
});

// ---------------------------------------------------------------- seals
function reads(g: any, d: any) {
  const A = off(d, 1, 0.9), B = off(d, -1, 0.9);
  const snd = g.col.sound.propagate([A[0] + 0.011 * (1 + g.time % 7), A[1], A[2]], [B[0] + 0.013, B[1], B[2] + 0.007 * (1 + g.time % 5)]);   // (off the sound cache's cell centres: never a stale answer)
  return { sight: !g.col.segmentBlocked(A, B), shot: !g.col.shotBlocked(A, B), carry: snd.carry, direct: snd.direct, seal: (d.box.flags & BoxFlag.SoundSeal) !== 0 };
}
const words = (r: ReturnType<typeof reads>) => `sight ${r.sight ? 'open' : 'blocked'} · shot ${r.shot ? 'open' : 'blocked'} · sound ${r.direct ? 'direct' : 'routed'} carry ${f2(r.carry)} · seals ${r.seal}`;
export const stayOpenSeal = guarded(async () => {
  const { verdict, done } = family('stay-open-seal: sight, shots and sound through a doorway follow where the leaf really stands');
  const R = await rig(17), g = R.g; const d = R.door('manager') ?? g.doors.list.find((x: any) => !x.def.steel);
  still(g); parkSam(g); R.step(30); shut(d); R.step(3); const r0 = reads(g, d);
  verdict(!r0.sight && !r0.shot && r0.seal && r0.carry < 0.99, `${d.def.name}, shut: blocked and sealing`, words(r0));
  g.doors.use(d, off(d, 1, 0.6, 0), PLAYER_ID, new Set([d.lockId])); R.secs(3); const r1 = reads(g, d); R.secs(60); const r2 = reads(g, d);
  verdict(r1.sight && r1.shot && !r1.seal && r1.carry > r0.carry && r2.sight && r2.shot && !r2.seal && Math.abs(r2.carry - r1.carry) < 1e-9, 'opened: the doorway is open to sight, shots and sound — and reads exactly the same a minute on', `at 3 s: ${words(r1)}\n    at 63 s: ${words(r2)} · angle ${f2(d.angle)}`);
  g.doors.pullTo(d, PLAYER_ID); R.secs(6); const r3 = reads(g, d);
  verdict(d.latched && !r3.sight && !r3.shot && r3.seal && Math.abs(r3.carry - r0.carry) < 1e-9, 'pulled to: latched, blocked and sealing again, the sound carrying as before it was opened', words(r3));
  d.latched = false; d.angle = d.maxA > 0.2 ? 0.2 : -0.2; d.place(); R.secs(30); const r4 = reads(g, d);
  verdict(r4.seal && Math.abs(Math.abs(d.angle) - 0.2) < 1e-6, 'left a hand ajar (0.2 rad): it stays a hand ajar, and a leaf that near its frame still seals the sound (the rule the smoke solver shares)', `${words(r4)} · angle ${f2(d.angle)}`);
  return done();
});

// ---------------------------------------------------------------- checkpoints
export const stayOpenSave = guarded(async () => {
  const { verdict, done } = family('stay-open-save: a checkpoint keeps every leaf where it stood');
  const R = await rig(19), g = R.g, list: any[] = g.doors.list; const rest0 = list.map(d => d.angle); still(g); parkSam(g); R.step(30);
  const want = list.map((d, i) => { const s = Math.abs(d.maxA) >= Math.abs(d.minA) ? 1 : -1; return [0.3, 0.9, 1.5][i % 3] * s; });
  list.forEach((d, i) => { shut(d); d.latched = false; d.angle = Math.max(d.minA, Math.min(d.maxA, want[i])); d.place(); });
  R.secs(5); const a0 = list.map(d => d.angle);
  let s: any = null, why = ''; try { s = R.W.snapshot('stay-open', true); } catch (e) { why = String(e); }
  verdict(!!s, 'a checkpoint is taken with every door standing open', s ? `${list.length} doors at ${a0.map(f2).join(' ')}` : `snapshot refused: ${why}`);
  if (!s) return done();
  g.restartEncounter(); R.step(5);
  const authored = list.every((d, i) => Math.abs(d.angle - rest0[i]) < 1e-9);   // (as it stood when the game was first stood up)
  verdict(authored, 'a restart puts every leaf back as the level authored it', list.map(d => f2(d.angle)).join(' '));
  let err = ''; try { R.W.restore(JSON.parse(JSON.stringify(s))); } catch (e) { err = String(e); }
  still(g); parkSam(g); R.step(2); const a1 = list.map(d => d.angle);
  verdict(!err && a1.every((a, i) => Math.abs(a - a0[i]) < 1e-9) && list.every(d => !d.latched), 'loaded: every leaf is at the angle it was saved at, off its latch', err || a1.map(f2).join(' '));
  g.aiEnabled = false; R.secs(60); const a2 = list.map(d => d.angle);
  verdict(a2.every((a, i) => Math.abs(a - a0[i]) < 1e-6), '…and a minute after the load, with nobody walking, the same', a2.map((a, i) => `${f2(a)}${Math.abs(a - a0[i]) >= 1e-6 ? '*' : ''}`).join(' '));
  return done();
});

// ---------------------------------------------------------------- a man past a leaf on its stop
// (the four cases are probes.ts leafWedge's own — the soak's commonest wedges; a level edit that moves one of these doors moves both tables)
const WEDGE: { door: string; angle: number; guardAt: V3; goal: V3; note: string }[] = [
  { door: 'breakroom_ext', angle: 1.92, guardAt: [31.5, 0, 24.8], goal: [19.4, 0, 24.64], note: 'the exterior break-room door swung out into the lot, the chase west along the south wall' },
  { door: 'breakroom_w', angle: 1.92, guardAt: [27.1, 0, 17.3], goal: [27.6, 0, 15.6], note: 'the break-room side door at its stop, folded into the cubicle aisle, the man going north past it' },
  { door: 'breakroom_n', angle: -1.7, guardAt: [30.5, 0, 11.8], goal: [28.6, 0, 11.7], note: 'the break-room corridor door swung out into the corridor, the man walking the corridor west' },
  { door: 'conference', angle: -1.92, guardAt: [10.6, 0, 9.3], goal: [8.0, 0, 9.4], note: 'the conference door at its stop inside the room, the man going west along the south glass' },
];
async function wedge(c: typeof WEDGE[number], stay: boolean) {
  Math.random = seeded(7);
  const W: any = await standUp(); const g = W.game; DOORSTAY.on = stay;
  g.playerInvisible = true; g.godMode = true; g.teleportPlayer([4.9, 0, 23.2]);
  for (let i = 0; i < 30; i++) W.step(DT);
  const d = g.doors.byName(c.door); const lim = (a: number) => Math.max(d.minA, Math.min(d.maxA, a)); d.latched = false; d.angle = Math.abs(lim(c.angle)) > 0.6 ? lim(c.angle) : lim(-c.angle); d.vel = 0; d.closing = false; d.quietT = 0; d.place(); const a0 = d.angle;
  const gd = g.guards[0]; for (const o of g.guards.slice(1)) o.hold = true;
  gd.char.pos = [...c.guardAt]; gd.char.update(0); gd.state = 'alert'; gd.awareness = 0.95; gd.lastKnown = [...c.goal]; gd.lastSeenT = -100; gd.reactT = 0; gd.path = []; gd.pathGoal = null;
  let arrived = -1, latched = false, pulled = false, minA = Math.abs(a0);
  for (let f = 0; f < 60 * 25; f++) {
    W.step(DT); latched ||= d.latched; pulled ||= d.closing; minA = Math.min(minA, Math.abs(d.angle));
    if (arrived < 0 && (gd.state === 'search' || Math.hypot(gd.char.pos[0] - c.goal[0], gd.char.pos[2] - c.goal[2]) < 1.0)) arrived = f / 60;
  }
  return { arrived, latched, pulled, a0, a1: d.angle, minA, at: at(gd.char.pos) };
}
/** a keyed contact walked straight through the plane of a leaf by hand (Doors.update alone, no game step): where he ends up and what the leaf did */
function walkAt(g: any, d: any, who: number, from: 1 | -1, secs = 4) {
  const u = d.dir(), n: [number, number] = [-u[1], u[0]]; const mid = [d.def.hinge[0] + u[0] * d.def.width * 0.55, d.def.hinge[1] + u[1] * d.def.width * 0.55];
  const c: any = { pos: [mid[0] + n[0] * 0.75 * from, 0, mid[1] + n[1] * 0.75 * from], radius: 0.34, bash: false, who, quiet: false, key: true };
  const a0 = d.angle; let latchedAll = d.latched;
  for (let f = 0; f < secs * 60; f++) { c.pos[0] -= n[0] * from * 1.2 * DT; c.pos[2] -= n[1] * from * 1.2 * DT; g.doors.update(DT, [c]); latchedAll &&= d.latched; }
  const perp = (c.pos[0] - d.def.hinge[0]) * n[0] + (c.pos[2] - d.def.hinge[1]) * n[1];   // (measured against the leaf's line as it stood at the start)
  return { through: perp * from < -0.5, perp, a0, a1: d.angle, latchedAll };
}
export const stayOpenEdge = guarded(async () => {
  const { verdict, done } = family('stay-open-edge: a keyed man walked into a leaf standing open on its stop steps through its edge, whatever his id; never through a shut leaf');
  const R = await rig(17), g = R.g; still(g); parkSam(g); R.step(10);
  const d = g.doors.list.find((x: any) => !x.def.locked && !x.def.steel && x.def.closer !== false);
  const stand = (a: number) => { d.reset(); d.latched = false; d.angle = a; d.vel = 0; d.closing = false; d.quietT = 5; d.passers = 0; d.place(); };
  // which face presses it INTO its stop: the one a walk from which leaves the leaf where it stands with the closers on (the old yank aside, it cannot turn further)
  for (const [name, a] of [['max', d.maxA], ['min', d.minA]] as [string, number][]) {
    if (Math.abs(a) < 0.6) continue;
    const rows: string[] = []; let ok = true;
    for (const who of [12, 31, 32, 33]) for (const from of [1, -1] as (1 | -1)[]) {
      stand(a); const r = walkAt(g, d, who, from);
      const pressed = Math.abs(r.a1 - a) < 1e-6;   // (from the other face the leaf simply turns away from him toward shut: a body moving a door, not this probe's subject)
      if (pressed) { ok &&= r.through; rows.push(`id ${who} from ${from > 0 ? '+' : '−'}: ${r.through ? 'through' : `HELD at ${f2(r.perp)}`}, leaf ${f2(r.a1)}`); }
    }
    verdict(ok && rows.length === 4, `${d.def.name} on its ${name} stop (${f2(a)}): ids 12, 31, 32 and 33 each end up beyond it, and it has not turned`, rows.join(' · ') || 'no face pressed it into the stop');
  }
  { const far = Math.abs(d.maxA) >= Math.abs(d.minA) ? d.maxA : d.minA; stand(far); const wasOn = DOORSTAY.on; DOORSTAY.on = false; const r = walkAt(g, d, 33, 1), r2 = (stand(far), walkAt(g, d, 33, -1)); DOORSTAY.on = wasOn;
    verdict(true, '(the switch off, for the record: the same walk by id 33)', `from +: ${r.through ? 'through' : 'held'}, leaf ${f2(r.a0)} → ${f2(r.a1)} · from −: ${r2.through ? 'through' : 'held'}, leaf ${f2(r2.a0)} → ${f2(r2.a1)}`); }
  // a leaf whose stop IS its frame (a one-way door, shut): nobody steps through that
  { const keepMin = d.minA, keepMax = d.maxA; const rows: string[] = [], seen: string[] = []; let ok = true;
    const settable = !!Object.getOwnPropertyDescriptor(d, 'minA')?.writable && !!Object.getOwnPropertyDescriptor(d, 'maxA')?.writable;
    for (const lim of (settable ? ['min', 'max'] : ['own']) as ('min' | 'max' | 'own')[]) for (const from of [1, -1] as (1 | -1)[]) {
      d.reset(); if (settable) { d.minA = lim === 'min' ? 0 : keepMin; d.maxA = lim === 'max' ? 0 : keepMax; } d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.passers = 0; d.place();
      const r = walkAt(g, d, 12, from, 3); const blockedSide = Math.abs(r.a1) < 0.05;   // (the face from which it cannot open)
      if (blockedSide) { ok &&= !r.through; rows.push(`${lim} stop at 0, from ${from > 0 ? '+' : '−'}: ${r.through ? 'WALKED THROUGH a shut leaf' : `held at ${f2(r.perp)}`}`); }
      else if (!settable) seen.push(`from ${from > 0 ? '+' : '−'}: the leaf turned to ${f2(r.a1)}`);
      if (settable) { d.minA = keepMin; d.maxA = keepMax; }
    }
    d.reset();
    verdict(ok && rows.length >= (settable ? 2 : 0), 'a shut leaf that cannot open his way (its stop at its frame) holds a keyed man out: no stepping through a closed door', [...rows, ...seen].join(' · ') || 'no blocked face found'); }
  return done();
});

export const stayOpenPass = guarded(async () => {
  const { verdict, done } = family('stay-open-pass: a staff man whose way is past a leaf on its stop gets there, and does not pull it shut behind him');
  for (const c of WEDGE) {
    const on = await wedge(c, true), was = await wedge(c, false);
    verdict(on.arrived >= 0 && on.arrived <= Math.max(was.arrived >= 0 ? was.arrived + 2.5 : 25, 6) && !on.latched && !on.pulled,
      `${c.door} at ${f2(c.angle)}: he is past it, and nobody pulled it to`,
      `${c.note}\n    now: ${on.arrived >= 0 ? `there in ${f2(on.arrived)} s` : `NEVER got past (at ${on.at})`} · leaf ${f2(on.a0)} → ${f2(on.a1)} (least ${f2(on.minA)})${on.latched ? ' · LATCHED' : ''}${on.pulled ? ' · PULLED' : ''}\n    with the switch off (the old game): ${was.arrived >= 0 ? `there in ${f2(was.arrived)} s` : 'never'} · leaf ${f2(was.a0)} → ${f2(was.a1)}${was.latched ? ' · latched behind him' : ''}${was.pulled ? ' · pulled to' : ''}`);
  }
  // THE SWEEP (Door.swept): a body against the back of a leaf standing open sends it round to its frame (a man walking the wall behind it herds it shut ahead of
  // him). A keyed man's body doing that has shut nothing — the leaf rests to, unlatched; the player leaning it shut the same way still gets his latch; and a
  // hand asked to shut it (pullTo) latches it after — a keyed door (storage) like any other: nobody shut it, so its bolt has not bitten. (The shove: three frames of a body pressed `pen` into the leaf's back face, then nothing — the strength is
  // the first of a ladder that brings the PLAYER's leaf to its latch, so the control always says something, one-way or two.)
  { const R = await rig(7); const g = R.g; still(g); parkSam(g);
    for (const name of ['breakroom_w', 'storage']) { const d = R.door(name); if (!d) { verdict(false, `${name}: the office has this door`, 'not found'); continue; }
      const shove = (key: boolean, who: number, pen: number) => {
        d.reset(); d.latched = false; d.angle = (Math.abs(d.maxA) > 1e-3 ? 1 : -1) * 0.5; d.vel = 0; d.place();
        const a0 = d.angle, side = Math.sign(a0), W = d.def.width, [hx, hz] = d.def.hinge;
        const c: any = { pos: [0, 0, 0], radius: 0.34, bash: false, who, quiet: false, key };
        for (let i = 0; i < 3; i++) { const u = d.dir(), n = [-u[1], u[0]], off = (c.radius + d.thick / 2 - pen) * side; c.pos[0] = hx + u[0] * W * 0.6 + n[0] * off; c.pos[2] = hz + u[1] * W * 0.6 + n[1] * off; g.doors.update(DT, [c]); }
        const swept = d.swept; let latchedAt = -1;
        for (let t = 0; t < 4; t += DT) { g.doors.update(DT, []); if (d.latched && latchedAt < 0) latchedAt = t; }
        return { a0, a1: d.angle, latched: d.latched, latchedAt, swept, still: d.swept, pen };
      };
      const heard: string[] = []; const emit = (g.doors as any).emit; (g.doors as any).emit = (e: any) => { if (e.door === d) heard.push(e.sound); return emit.call(g.doors, e); };
      let sam: any = null; for (const pen of [0.03, 0.022, 0.016, 0.012, 0.009, 0.007, 0.005]) { sam = shove(false, PLAYER_ID, pen); if (sam.latched) break; }
      const man = shove(true, 20, sam.pen);
      const to = Math.abs(man.a1) < 0.012, rests = d.restsTo; for (let i = 0; i < 90; i++) g.doors.update(DT, []);   // (a second and a half on: still to, still nobody's)
      const stays = !d.latched && d.restsTo; heard.length = 0; g.doors.pull(d, 20); const creak = heard.includes('creak') && !d.swept;   // (opened next: the creak a shut door gives)
      const again = shove(true, 20, sam.pen); g.doors.pullTo(d, 20); for (let i = 0; i < 90; i++) g.doors.update(DT, []); const hand = d.latched && !d.swept;
      (g.doors as any).emit = emit;
      verdict(sam.latched && !sam.swept && !man.latched && man.swept && man.still && to && rests && stays && creak && !again.latched && hand,
        `${name}: a keyed man's body sends the open leaf to its frame — it rests to, unlatched, and stays so; opened next it creaks like a shut door; the player's body doing the same latches it; a hand asked to shut it latches it`,
        `the shove: ${f2(sam.pen * 100)} cm into its back face for three frames\n    the player: leaf ${f2(sam.a0)} → ${f2(sam.a1)}${sam.latched ? ` · latched at ${f2(sam.latchedAt)} s` : ' · NOT latched (the control says nothing)'}\n    a keyed man: leaf ${f2(man.a0)} → ${man.a1.toFixed(3)}${man.latched ? ` · LATCHED at ${f2(man.latchedAt)} s` : ' · unlatched'} · swept ${man.swept} · 1.5 s on: ${stays ? 'still resting to' : 'CHANGED'} · pulled open: ${creak ? 'creak' : 'NO creak'}\n    swept to again, then pullTo: ${hand ? 'latched' : 'NOT latched'}`);
    }
  }
  return done();
});

// ---------------------------------------------------------------- the floor at night, nobody asking
export const stayOpenFloor = guarded(async () => {
  const { verdict, done } = family('stay-open-floor: five minutes of the office\'s night with the AI running — every latch was a pull somebody asked for');
  const run = async (stay: boolean) => {
    Math.random = seeded(23);
    const W: any = await standUp(); const g = W.game; DOORSTAY.on = stay; g.godMode = true; g.playerInvisible = true; g.teleportPlayer([4.9, 0, 23.2]);
    const list: any[] = g.doors.list; const asked = new Set<any>(); const pull = g.doors.pullTo.bind(g.doors);
    const keyedPulls: string[] = [];
    g.doors.pullTo = (d: any, who: number) => { if (!d.latched) { asked.add(d); if (d.def.locked || d.def.exterior) keyedPulls.push(`${g.time.toFixed(1)}s ${d.def.name} by ${g.guards.find((x: any) => x.char.id === who)?.callsign ?? who}`); } return pull(d, who); };
    let latches = 0, unasked: string[] = [], pushes = 0; const was = list.map(d => d.latched), wasClosing = list.map(d => d.closing);
    for (let f = 0; f < 60 * 300; f++) {
      g.player.visibility = 0.02; W.step(DT);
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.closing && !wasClosing[i] && !asked.has(d)) unasked.push(`${(f / 60).toFixed(1)}s ${d.def.name} began to close unasked (last hand ${d.lastWho})`);
        if (d.latched && !was[i]) { latches++; if (!asked.has(d)) unasked.push(`${(f / 60).toFixed(1)}s ${d.def.name} latched unasked (last hand ${d.lastWho})`); asked.delete(d); }
        if (!d.latched && was[i]) pushes++;
        was[i] = d.latched; wasClosing[i] = d.closing;
      }
    }
    const open = list.filter(d => !d.latched && Math.abs(d.angle) > 0.25).map(d => d.def.name);
    const stuck = g.guards.filter((x: any) => x.state !== 'dead' && x.stuckT > 4).map((x: any) => `${x.callsign} stuckT ${f2(x.stuckT)} at ${at(x.char.pos)}`);
    const keyedOpen = list.filter(d => (d.def.locked || d.def.exterior) && d.def.closer !== false && !d.latched && !g.guards.some((x: any) => x.state !== 'dead' && Math.hypot(x.char.pos[0] - d.frameCentre[0], x.char.pos[2] - d.frameCentre[2]) < 2.5)).map(d => `${d.def.name} ${f2(d.angle)}`);
    return { latches, unasked, pushes, open, stuck, n: list.length, keyedPulls, keyedOpen };
  };
  const on = await run(true), was = await run(false);
  verdict(on.unasked.length === 0, 'no leaf latched, or began a sprung close, that nobody pulled to', on.unasked.length ? on.unasked.slice(0, 12).join('\n    ') : `${on.pushes} times a leaf came off its latch (a man walking through it), ${on.latches} latches, all asked for · standing open at the end: ${on.open.join(', ') || 'none'}`);
  verdict(on.keyedPulls.length > 0 && on.keyedOpen.length === 0, 'the staff shut their own keyed doors, and the doors to the outside, behind them (guards.ts lockdownDoors, calm): none the level gave a closer stands open at the end with nobody at it', `pulled to: ${on.keyedPulls.slice(0, 8).join(' · ') || 'never'}${on.keyedPulls.length > 8 ? ` … ${on.keyedPulls.length} in all` : ''} · keyed and open at the end: ${on.keyedOpen.join(', ') || 'none'}`);
  verdict(on.stuck.length === 0, 'nobody is left pushing at a leaf', on.stuck.join(' · ') || `no man with stuckT over 4 s at the end`);
  verdict(was.unasked.length > 0, 'the same night with the switch off: leaves do come to by themselves (the watcher can see it)', `${was.unasked.length} unasked closes or latches of ${was.latches} latches, ${was.pushes} openings · standing open at the end: ${was.open.join(', ') || 'none'}`);
  return done();
});

// ---------------------------------------------------------------- what a reading of the code found (each line fails on the build before its fix)
export const stayOpenAfter = guarded(async () => {
  const { verdict, done } = family('stay-open-after: the stair door behind the response, a lockdown\'s outside doors, who a leaf lets past, a wide-open one-way leaf');
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { requestQrf, QRF_MARKS } = await import(`${ROOT}/src/game/qrf.ts`);
  const { raiseEscalation } = await import(`${ROOT}/src/game/guards.ts`);
  const { HANDLE, handPress } = await import(`${ROOT}/src/game/handleside.ts`);
  const oneWas = DOORWAY.oneWay, stayWas = DOORSTAY.on;
  try {
    // (1) the response comes in through the stair door: with no closer, its last man pulls it to and the bolt bites again
    for (const stay of [true, false]) {
      Math.random = seeded(41); const W: any = await standUp(); DOORSTAY.on = stay; const g = W.game;
      g.godMode = true; g.aiEnabled = true; g.playerInvisible = true; g.tune.qrf = true; g.tune.qrfEta = 14; g.tune.qrfSize = 4; g.tune.perimeter = false; g.tune.civilians = false;
      for (let i = 0; i < 20; i++) W.step(DT);
      const d = g.doors.byName(QRF_MARKS.door), Q = g.qrf; requestQrf(g, 'panel');
      for (let i = 0; i < 60 * 30 && Q.state !== 'deployed'; i++) W.step(DT);
      let opened = !d.latched, latchAt = -1; const t0 = g.time;
      for (let i = 0; i < 60 * 45 && latchAt < 0; i++) { W.step(DT); if (!d.latched) opened = true; else if (opened) latchAt = g.time - t0; }
      const pulled = Q.log.some((l: any) => l.what === 'door-to');
      if (stay) verdict(Q.state === 'deployed' && opened && latchAt >= 0 && d.locked && pulled, 'doors stay: the response is in, and the last man through pulls the stair door to behind them — latched, bolt thrown', `state ${Q.state} · opened ${opened} · latched ${latchAt >= 0 ? `+${f2(latchAt)} s` : 'never in 45 s'} · locked ${d.locked} · pulled by a hand ${pulled}`);
      else verdict(Q.state === 'deployed' && opened && latchAt >= 0 && !pulled, 'closers on: the stair door comes to by itself as it always did, no hand asked', `latched ${latchAt >= 0 ? `+${f2(latchAt)} s` : 'never in 45 s'} · pulled by a hand ${pulled}`);
    }
    // (2) a lockdown: a staff man passing a door to the outside that stands open shuts it (it had a closer; nothing else will)
    for (const stay of [true, false]) {
      const R = await rig(43, undefined, stay), g = R.g; g.aiEnabled = true; g.tune.civilians = false;
      const d = g.doors.list.find((x: any) => x.def.exterior && x.def.closer !== false && !x.def.steel);
      if (!d) { verdict(false, 'a door to the outside with a closer', 'the level has none'); break; }
      raiseEscalation(g, 2); R.step(2);
      const s = Math.abs(d.maxA) >= Math.abs(d.minA) ? 1 : -1; shut(d); d.latched = false; d.angle = (s > 0 ? d.maxA : d.minA) * 0.6; d.place(); d.guardT = -1e9; d.quietT = 5;
      const gd = g.guards.find((x: any) => x.state !== 'dead' && !x.unit), fc = d.frameCentre;
      const spot = ([1, -1] as const).map(f => off(d, f, 1.4, 0)).find(p => { const px = p[0] - d.def.hinge[0], pz = p[2] - d.def.hinge[1], cd = d.def.closedDir, th = Math.atan2(-Math.sin(cd) * px + Math.cos(cd) * pz, Math.cos(cd) * px + Math.sin(cd) * pz); return th * d.angle <= 0; })!;
      const yaw = Math.atan2(spot[0] - fc[0], spot[2] - fc[2]);   // (his back to the doorway: it is behind him, as on his way past)
      for (const o of g.guards) if (o !== gd) { o.hold = true; o.path = []; o.pathGoal = null; }
      const a0 = d.angle; let stamped = false;
      for (let i = 0; i < 90 && !stamped; i++) { gd.hold = false; gd.state = 'patrol'; gd.script = null; gd.awareness = 0; gd.char.pos = [spot[0], 0, spot[2]]; gd.char.bodyYaw = yaw; d.quietT = 5; R.step(1); stamped = d.guardT > -1e8; }
      const apart = g.guards.every((o: any) => o === gd || o.state === 'dead' || Math.hypot(o.char.pos[0] - fc[0], o.char.pos[2] - fc[2]) >= 2);
      if (stay) { gd.hold = true; R.secs(9); verdict(stamped && d.latched, `doors stay, lockdown: a man passing ${d.def.name} standing open pulls it to`, `asked ${stamped} · ${f2(a0)} → ${f2(d.angle)} · latched ${d.latched} · nobody else at it ${apart}`); }
      else verdict(!stamped, 'closers on, lockdown: he leaves the outside door to its closer, as before', `asked ${stamped}`);
    }
    // (3) who a standing leaf is letting past rides a checkpoint; (4) a keyless man with a high id is never let past on Sam's bit
    { const R = await rig(47), g = R.g; still(g); parkSam(g); R.step(10); DOORWAY.oneWay = true;
      const d = g.doors.list.find((x: any) => !x.def.locked && !x.def.exterior), s = d.swing || 1; shut(d); d.latched = false; d.angle = s * 1.2; d.passers = 1 << 12; d.place();
      const snap = JSON.parse(JSON.stringify(R.W.snapshot('passers', true))), row = snap.doors.find((x: any) => x.name === d.def.name);
      d.passers = 0; R.W.restore(snap); const d2 = g.doors.byName(d.def.name);
      verdict(row.passers === 1 << 12 && d2.passers === 1 << 12, 'a save taken while a leaf is letting a man past its edge: he is still being let past after the load', `row ${row.passers} · loaded ${d2.passers}`);
      const bit = (who: number, key: boolean) => (g.doors as any).passBit({ who, key, pos: [0, 0, 0], r: 0.3, vel: [0, 0, 0] });
      const sam = bit(PLAYER_ID, false), staff = [10, 11, 12].map(i => bit(i, true)), high = [33, 40, 41, 42].map(i => bit(i, true));
      verdict(bit(PLAYER_ID + 32, false) === 0 && bit(42, false) === 0 && high.every(b => b !== 0 && b !== sam && !staff.includes(b)), 'a keyless man with an id past 31 has no pass bit at all; a keyed one\'s never lands on Sam\'s or the shift\'s', `Sam ${sam} · shift ${staff.join(' ')} · keyed 33 40 41 42 → ${high.join(' ')} · keyless 33 → ${bit(33, false)}`);
      // (5) 'is it open enough to walk through' asked of a one-way leaf from either face
      d2.angle = s * 1.45; d2.place();
      const both = [g.doors.openFor(d2, 1), g.doors.openFor(d2, -1)]; DOORWAY.oneWay = false; const old = [g.doors.openFor(d2, 1), g.doors.openFor(d2, -1)]; DOORWAY.oneWay = true;
      verdict(both.every(x => Math.abs(x - 1.45) < 1e-9) && Math.min(...old) < 0, 'a one-way leaf standing wide open reads open from both faces (the drills shoved it again from one of them)', `one-way ${both.map(f2).join(' / ')} · two-way ${old.map(f2).join(' / ')}`);
      // (6) a man in Sam's arm
      const onWas = HANDLE.on; HANDLE.on = true;
      const man: any = { team: 'guard', speed: 1, held: false }, free = handPress(g, man); man.held = true; const held = handPress(g, man); HANDLE.on = onWas;
      verdict(free !== undefined && held === undefined, 'a man walked at a pull face in Sam\'s arm presses it as Sam does: he waits on no hand of his own', `free ${free} · held ${held}`);
    }
  } finally { DOORWAY.oneWay = oneWas; DOORSTAY.on = stayWas; }
  return done();
});
