// A TAKEN ROOM'S OTHER DOOR IS KEPT WHILE THE SQUAD LEAVES (src/game/rearwatch.ts, REARWATCH.room) — the check.
//
//   bun run tools/qa/roomkeep-check.ts [id …] [--max N] [--case door:+|-] [--off] [--verbose]     (no id: warehouse-four, compound-four; exit 1 on a failure; the SHIPPED stand unless TPS_PROFILE says frozen)
//
// Per level (the defenders taken off the floor first), per door face until --max cases (default 6) have been judged: every door shut, the squad put on the
// face's floor, 'open and clear' given and played to its end. A case is a room the entry left a man holding another door of (doortools.ts otherDoors). Then
// Sam is stood inside the room and 'fall in' is given:
//   STAYS   three seconds with Sam standing in the room: the man who had the door keeps his gun on it (inside 0.5 rad, 85 % of the frames) and his feet where
//           they were. The same played with the switch off is the size of the flaw (printed; `--off` runs the on-arm's bars with the switch off and must fail).
//   LEAVES  Sam is put back outside. While a mate is still in the room (eight seconds at most) the gun stays on the door for as long as he is kept; the same
//           window with the switch off is the size of the flaw: his gun goes forward with the file. Inside twenty seconds the keep is let go, every man is back with Sam (no 'fall in' that stalls), the man who kept the
//           door leaves the room after every man who kept none, and nobody's legs go past the team's pace.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
process.env.TPS_PROFILE ??= 'shipped';
const { standUp, ROOT } = await import('./headless.ts');
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { REARWATCH, roomKept, rearWatchLog } = await import(`${ROOT}/src/game/rearwatch.ts`);
const { stackRoomProbe } = await import(`${ROOT}/src/game/stackroom.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { PACE } = await import(`${ROOT}/src/game/guards.ts`);
const { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`);

type V = [number, number, number];
const WALKED = process.env.RK_JUMP ? 0 : 30;   // frames Sam's leaving reads as a walk; RK_JUMP=1 = set down outside, as the check first had it
if (process.env.RK_LAST === '0') REARWATCH.roomLast = false;   // RK_LAST=0 = a keeper freed the moment the men behind him have come by, as it was: warehouse-four b_s+ must fail 'last out'
const DT = 1 / 60, args = process.argv.slice(2), VERBOSE = args.includes('--verbose'), OFF = args.includes('--off');
const MAX = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 6, CASE = args.includes('--case') ? args[args.indexOf('--case') + 1] : '', ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--max' && args[i - 1] !== '--case');   // (--case door:+ | door:- — that one face alone)
const NEED = 0.85, AIM = 0.5, STAY = 3, LEAVE = 20, NEAR = 6, WINDOW = 8;
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), pc = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };

interface Res { door: string; kept: string; who: string; on: number; n: number; lon: number; ln: number; kon: number; kn: number; moved: number; freed: number | null; why: string; last: boolean; back: boolean; far: number; vmax: number }
const fails: string[] = [];

/** one case, one arm, on a level stood up afresh (what the squad has been beyond is remembered per game): null = not a case */
async function play(E: any, di: number, side: 1 | -1, on: boolean): Promise<Res | null> {
  Math.random = seeded(0xba46 + 7919);
  const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); const g = W.game;
  // (the team's slower walk, teampace.ts, is held off: with it the men falling in come by the keeper later in Sam's three seconds, and the 0.4 m he may
  //  shift for them is the bar — compound-four k_p+ reads 0.5. The keep itself is the same rule at either pace; the pace is teampace-check.ts's)
  TEAMPACE.on = false;
  g.godMode = true; g.playerInvisible = true;
  const { why: no } = startFromQuery(g, new URLSearchParams(scenarioQuery(E) as string)); if (no) throw new Error(`${E.id}: start refused — ${no}`);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(20);
  const O = g.orders, men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 3) return null;
  for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true);
  step(30); if (!O.active) return null;
  REARWATCH.room = on;
  const d = g.doors.list[di], F = stackRoomProbe(g, d, side); if (!F.floor) return null;
  const spots: V[] = []; for (const band of [[5, 14], [2, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length > men.length) break; if (spots.some(q => flat(q, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); }
  if (spots.length <= men.length) return null;
  for (const x of g.doors.list) shut(x);
  const c = d.frameCentre as V;
  men.forEach((m, i) => { const p = spots[i]; m.char.pos = [p[0], 0, p[2]]; m.char.vel = [0, 0, 0]; m.speed = 0; m.char.bodyYaw = m.char.aimYaw = Math.atan2(c[0] - p[0], c[2] - p[2]); m.path = []; m.pathGoal = null; m.char.update(0); });
  const out = spots[men.length]; g.teleportPlayer([out[0], 0, out[2]]); step(10);
  if (O.give('openClear', { kind: 'door', door: d, side }, 'all')) return null;
  for (let i = 0; i < 25 * 60; i++) { step(); if (i > 120 && !g.doorTools.ops.length) break; }
  step(30);
  const keepers: [any, any, any][] = g.doorTools.doorKeepers(); if (!keepers.length) return null;
  let [m, kd] = keepers[0]; const room = g.fight.roomAt(m.char.pos); if (!room) return null;
  const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  const inside = ([1.6, 2.2, 1.1].flatMap(k => [[c[0] + nx * k, 0, c[2] + nz * k], [c[0] - nx * k, 0, c[2] - nz * k]]) as V[]).filter(p => sideOf(d, p) !== side && g.fight.roomAt(p) === room).map(p => ({ p, r: Math.min(...men.map(x => flat(x.char.pos, p))) })).filter(x => x.r >= 1.2).sort((a, b) => b.r - a.r)[0]?.p;   // (clear of every man: one Sam lands beside steps out of his way, and that is another rule's)
  if (!inside) return null;
  // (a keeper Sam stands further from than REARWATCH.roomM is not kept at all: the case is about one in reach)
  const near = keepers.find(k => g.fight.roomAt(k[0].char.pos) === room && flat(k[0].char.pos, inside) <= REARWATCH.roomM - 1); if (!near) return null; [m, kd] = near;
  g.teleportPlayer([inside[0], 0, inside[2]]); step(2);
  O.give('fallIn', O.targetAt(g.player.char.pos), 'all');
  const p0: V = [...m.char.pos] as V, kc = kd.frameCentre as V; let onN = 0, n = 0, moved = 0, vmax = 0;
  const dbg = (tag: string) => { if (VERBOSE) console.log(`    ${on ? 'on' : 'off'} ${tag} ${m.callsign} at (${m.char.pos[0].toFixed(1)}, ${m.char.pos[2].toFixed(1)}) door (${kc[0].toFixed(1)}, ${kc[2].toFixed(1)}) sam (${g.player.char.pos[0].toFixed(1)}, ${g.player.char.pos[2].toFixed(1)}) · kept ${roomKept(g, m)} · cover ${g.cover.of(m)?.o.id ?? '-'}${g.cover.of(m)?.off ? ' (off)' : ''} · gun ${(wrap(Math.atan2(kc[0] - m.char.pos[0], kc[2] - m.char.pos[2]) - m.char.aimYaw) * 57.3).toFixed(0)}° off it · body ${(wrap(Math.atan2(kc[0] - m.char.pos[0], kc[2] - m.char.pos[2]) - m.char.bodyYaw) * 57.3).toFixed(0)}° · aimAt ${m.script?.aimAt ? `(${m.script.aimAt[0].toFixed(1)}, ${m.script.aimAt[2].toFixed(1)})` : '-'} goal ${m.script?.goal ? 'y' : '-'} speed ${(m.speed ?? 0).toFixed(1)} · ${O.of(m)?.going ?? '-'}${m.muzzleDown ? ' · MUZZLE DOWN' : ''}`); };
  for (let i = 0; i < STAY * 60; i++) { step(); if (i % 45 === 0) dbg(`stay ${(i / 60).toFixed(1)}`); if (m.state === 'dead') return null; n++; moved = Math.max(moved, flat(m.char.pos, p0));
    if (Math.abs(wrap(Math.atan2(kc[0] - m.char.pos[0], kc[2] - m.char.pos[2]) - m.char.aimYaw)) < AIM) onN++; for (const x of men) vmax = Math.max(vmax, x.speed ?? 0); }
  g.teleportPlayer([out[0], 0, out[2]]);
  const onDoor = () => Math.abs(wrap(Math.atan2(kc[0] - m.char.pos[0], kc[2] - m.char.pos[2]) - m.char.aimYaw)) < AIM; let lon = 0, ln = 0, kon = 0, kn = 0;
  const exit = new Map<any, number>(); let freed: number | null = roomKept(g, m) ? null : 0, back = false; const t0 = g.time;
  for (let i = 0; i < LEAVE * 60; i++) {
    // Sam WALKED out: the game reads a jump of a metre as no pace at all (orders.ts tick), so a Sam only ever set down outside
    // 'stood still' through his own leaving — and a follower with nothing to do was dealt a cover step in the room and kept it
    // (cover.ts lets go of a follower's step when Sam walks). Half a second of small steps on the spot is his walk's last strides.
    if (i < WALKED) g.teleportPlayer([out[0] + (i % 2 ? 0.05 : 0), 0, out[2]]);
    step(); const t = g.time - t0; if (i % 60 === 0 && i < 600) dbg(`leave ${t.toFixed(1)}`);
    if (process.env.RK_MEN && i % 30 === 0 && i < 600) console.log(`    ${on ? 'on' : 'off'} men ${t.toFixed(1)} · ` + men.map(x => { const A = O.of(x); return `${x.callsign} (${x.char.pos[0].toFixed(1)}, ${x.char.pos[2].toFixed(1)})${g.fight.roomAt(x.char.pos) === room ? ' IN' : ''} → ${A?.goal ? `(${A.goal[0].toFixed(1)}, ${A.goal[2].toFixed(1)})${g.fight.roomAt(A.goal) === room ? ' in' : ''}` : '-'} v${(x.speed ?? 0).toFixed(1)}`; }).join(' · '));   // RK_MEN=1: every man twice a second while the squad leaves — where he is (IN the room), where 'fall in' has him, his pace
    for (const x of men) { vmax = Math.max(vmax, x.speed ?? 0); if (g.fight.roomAt(x.char.pos) !== room) { if (!exit.has(x)) exit.set(x, t); } else exit.delete(x); }
    if (freed === null && !roomKept(g, m)) freed = t;
    if (t < WINDOW && men.some(x => x !== m && x.state !== 'dead' && g.fight.roomAt(x.char.pos) === room)) { ln++; if (onDoor()) lon++; if (freed === null) { kn++; if (onDoor()) kon++; } }
    if (men.every(x => flat(x.char.pos, g.player.char.pos) < NEAR)) { back = true; if (freed !== null && t > WINDOW) break; } }
  const held = new Set(keepers.map(k => k[0])), tm = exit.get(m) ?? Infinity, last = men.every(x => held.has(x) || (exit.get(x) ?? Infinity) <= tm + 0.25);   // (another man kept on another door of the room is a last man too)
  const far = Math.max(...men.map(x => flat(x.char.pos, g.player.char.pos)));
  const log = (rearWatchLog(g) as string[]).filter(s => s.includes(m.callsign)).slice(-1)[0] ?? '';
  if (VERBOSE) { console.log(`    ${on ? 'on' : 'off'}: rear log ${(rearWatchLog(g) as string[]).slice(-4).join(' / ')}`); console.log(`    out of the room at: ${men.map(x => `${x.callsign} ${exit.has(x) ? exit.get(x)!.toFixed(1) : 'never'} (${flat(x.char.pos, g.player.char.pos).toFixed(1)} m from Sam, ${O.of(x)?.going ?? '-'})`).join(' · ')}`); }
  return { door: d.def.name, kept: kd.def.name, who: m.callsign, on: onN, n, lon, ln, kon, kn, moved, freed, why: log.replace(/^.*· /, ''), last, back, far, vmax };
}

async function level(E: any): Promise<void> {
  let judged = 0, tried = 0, onF = 0, onN = 0, offF = 0, offN = 0, lOn = 0, lN = 0, lOff = 0, lOffN = 0; const names: string[] = await hush(async () => { const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); return W.game.doors.list.map((x: any) => x.def.name); }), nDoors = names.length;
  for (let di = 0; di < nDoors && judged < MAX; di++) for (const side of [1, -1] as const) { if (judged >= MAX) break; if (CASE && CASE !== `${names[di]}:${side > 0 ? '+' : '-'}`) continue; tried++;
    let A: Res | null = null, B: Res | null = null;
    try { A = await hush(() => play(E, di, side, !OFF)); if (A && !OFF) B = await hush(() => play(E, di, side, false)); } catch (e) { fails.push(`${E.id} door ${di}: ${e}`); console.log(`  FAIL ${E.id} door ${di}: ${e}`); continue; }
    if (!A) continue; judged++; onF += A.on; onN += A.n; lOn += A.lon; lN += A.ln; if (B) { offF += B.on; offN += B.n; lOff += B.lon; lOffN += B.ln; }
    const tag = `${E.id} in by ${A.door}${side > 0 ? '+' : '-'}, ${A.who} on ${A.kept}`, bad: string[] = [];
    if (A.on < NEED * A.n) bad.push(`his gun was on it ${pc(A.on, A.n)} of the three seconds Sam stood in the room`);
    if (A.moved > 0.4) bad.push(`he walked ${A.moved.toFixed(1)} m off while Sam stood in the room`);
    if (A.kn >= 20 && A.kon < NEED * A.kn) bad.push(`with Sam gone and mates still in the room, his gun was on it ${pc(A.kon, A.kn)} of the time he was kept`);
    if (A.freed === null) bad.push(`still kept ${LEAVE} s after Sam left`);
    if (!A.back && A.far > Math.max(NEAR, (B?.far ?? 0) + 1)) bad.push(`the squad was not back with Sam ${LEAVE} s after he left (the furthest man ${A.far.toFixed(1)} m off${B ? `, ${B.far.toFixed(1)} m with the switch off` : ''})`);
    // (LAST OUT is what a keep promises when it ends because the others have left or come by him. One let go because Sam is REARWATCH.roomM off — a big
    //  room, the kept door far from the way out — is let go the moment Sam is that far, mates still in the room or not: he falls in at the back of the file,
    //  and who is through the door first is then the walk's business)
    const farOff = A.why === 'the player has gone on';
    if (!A.last && !farOff) bad.push('he was not the last man out of the room');
    if (A.vmax > PACE.max + 0.05) bad.push(`a man's legs reached ${A.vmax.toFixed(2)} m/s (the team's pace is ${PACE.max})`);
    for (const b of bad) { fails.push(`${tag}: ${b}`); console.log(`  FAIL ${tag}: ${b}`); }
    if (!bad.length || VERBOSE) console.log(`  ${bad.length ? '    ' : 'PASS'} ${tag}: Sam in the room: gun on it ${pc(A.on, A.n)}${B ? ` (switch off ${pc(B.on, B.n)})` : ''} · Sam gone, mates still in it: ${pc(A.lon, A.ln)}${B ? ` (switch off ${pc(B.lon, B.ln)})` : ''} · let go ${A.freed === null ? 'never' : A.freed.toFixed(1) + ' s after Sam left'} (${A.why}), ${farOff ? 'in at the back of the file' : 'last out'}, back with Sam`);
  }
  console.log(`${E.id}: ${judged} rooms with another door held, of ${tried} door faces tried · gun on the kept door while Sam stood in the room ${pc(onF, onN)}${OFF ? ' (SWITCH OFF)' : ` (switch off ${pc(offF, offN)})`} · after Sam left, while a mate was still in the room (${WINDOW} s at most) ${pc(lOn, lN)}${OFF ? '' : ` (switch off ${pc(lOff, lOffN)})`}`);
  if (!judged) { fails.push(`${E.id}: no case`); console.log(`  FAIL ${E.id}: no room with another door held was found`); }
}

const want = ids.length ? ids : ['warehouse-four', 'compound-four'];
for (const id of want) { const E = (ALL_MISSIONS as any[]).find(x => x.id === id); if (!E) { console.log(`unknown mission ${id}`); process.exit(2); } await level(E); }
console.log(fails.length ? `=== roomkeep-check: ${fails.length} FAIL ===` : '=== roomkeep-check: ALL PASS ===');
process.exit(fails.length ? 1 : 0);
