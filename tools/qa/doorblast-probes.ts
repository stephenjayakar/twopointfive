// The 'off-hinges' family: A BLAST TAKES A DOOR OFF ITS HINGES (src/game/doorblast.ts; the maintainer, 10-08: 'doors … can be blown off hinges'). Run through
// probes.ts:   bun run tools/qa/probes.ts off-hinges | off-hinges-blast | off-hinges-hung | off-hinges-restart | off-hinges-charge | off-hinges-walk | off-hinges-sweep | off-hinges-off
// PASS / FAIL each, all headless (the Game of headless.ts; nothing is drawn — 'reads open' is the collision layer's own sight / shot / sound / nav queries, the
// ones the picture's boxes and the AI share, NOT a picture looked at).
//   off-hinges-blast    a frag-sized blast a metre off a shut office door: the leaf is off its frame, flies AWAY from the blast, lands, lies flat and loose on the
//                       floor clear of every wall; before it sight, shot and sound through the doorway were blocked, after it all three read open, the nav path
//                       through is the straight one, and the door's state reads as an open doorway (unlatched, wide, lock gone) that no verb moves; the floor
//                       heard the frame go and the slab land
//   off-hinges-hung     what never does it: a boot (kickIn), a shove, a stun canister on the sill, a blast past its own reach, a blast with a wall between,
//                       any blast at the steel stair door — the leaf stays hung every time
//   off-hinges-restart  restartEncounter hangs it again (shut, blocking, sealing); a checkpoint taken with the slab in the air comes back with it lying where it
//                       came to rest
//   off-hinges-charge   the breaching charge of the door tools (set on the leaf: contact) takes the leaf off, and does to the men behind it what it did
//   off-hinges-walk     a man sent through the doorway walks it as the open doorway it is: he arrives, and nothing about the door or the slab changes
//   off-hinges-sweep    every ordinary door of every level, from both faces, by a frag-sized blast and by a set charge: each comes off, lands inside six seconds,
//                       rests clear of the statics, and leaves its doorway open to sight
//   off-hinges-off      DOORBLAST.on false: Doors.blast answers nothing, the charge flings the leaf in on its hinge as it did
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORBLAST, DOORBLAST_STATS, tearOff, OFF_ANGLE } = await import(`${ROOT}/src/game/doorblast.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { dropThrowable } = await import(`${ROOT}/src/game/combat.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
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
const DEFAULTS = { ...JSON.parse(JSON.stringify(DOORBLAST)), on: true };   // (the family is about the switch ON: headless.ts stands every other tool up with it off, and probes.ts puts the knob tables back between probes — so each probe here turns it on for itself)
const guarded = (fn: () => Promise<boolean>) => async () => { DOORBLAST.on = true; try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { Object.assign(DOORBLAST, JSON.parse(JSON.stringify(DEFAULTS))); } };
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };

async function rig(seed = 7, level?: string) {
  Math.random = seeded(seed);
  const W: any = await standUp(level ? { level: levelOfFile(level) } : {});
  const g = W.game; g.godMode = true; g.aiEnabled = false;
  const R = { W, g,
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } },
    door(name: string): any { return g.doors.list.find((d: any) => d.def.name === name); },
  };
  R.step(10);
  return R;
}
/** hang it, shut it, latch it — whatever the level staged */
function shut(g: any, d: any) { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place(); }
/** a point `b` metres off the frame line on face `side`, mid-opening */
const off = (d: any, side: 1 | -1, b: number, y = 1.1): V3 => doorPt(d, d.def.width / 2, b, side, y);
/** the statics alone: is the doorway a doorway (floor both sides, a clear line through the frame)? */
function doorway(g: any, d: any, b = 0.9): boolean {
  const all = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
  try { return !g.col.solidBlocked(off(d, 1, b), off(d, -1, b)); } finally { g.col.dynamicBoxes = all; }
}
/** what the collision layer says of the lines through the doorway */
function reads(g: any, d: any) {
  const A = off(d, 1, 0.9), B = off(d, -1, 0.9);
  const snd = g.col.sound.propagate(A, [B[0] + 0.013, B[1], B[2] + 0.007]);   // (off the sound cache's cell centre: never a stale answer)
  const A0: V3 = [A[0], 0, A[2]], B0: V3 = [B[0], 0, B[2]];
  const path = g.col.nav.findPath(A0, B0, 6000); let L = NaN;
  if (path) { L = 0; let p = A0; for (const q of path) { L += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; } L += Math.hypot(B0[0] - p[0], B0[2] - p[2]); }
  return { sight: !g.col.segmentBlocked(A, B), shot: !g.col.shotBlocked(A, B), sound: snd.direct && snd.carry >= 0.99, carry: snd.carry, seal: (d.box.flags & BoxFlag.SoundSeal) !== 0, nav: L };
}
const readsWords = (r: ReturnType<typeof reads>) => `sight ${r.sight ? 'open' : 'blocked'} · shot ${r.shot ? 'open' : 'blocked'} · sound ${r.sound ? 'direct' : `not direct (carry ${f2(r.carry)})`} · seals ${r.seal} · nav ${f2(r.nav)} m`;
/** the resting slab against the level: flat, yaw-only, on the floor, and no static inside its rectangle (rays from its middle to a lattice over it, its own box
 *  out of the list; and from 1.2 m up straight down onto its middle: nothing standing on the spot) */
function slabClean(g: any, d: any): string | null {
  const S = d.slab, b = d.box;
  if (!S || !S.rest) return 'not at rest';
  if (b.rot) return 'still carries a tilt';
  if (Math.abs(b.h[1] - d.thick / 2) > 1e-6 || b.c[1] > d.thick / 2 + 0.02) return `not flat on the floor (h.y ${b.h[1]}, c.y ${f2(b.c[1])})`;
  if (!b.c.every(Number.isFinite)) return 'not finite';
  // every static of the level, one by one (no grid): does its plan rectangle cut 2 cm or more into the slab's, anywhere between 6 cm and 30 cm off the floor?
  const a = -b.yaw, ux = Math.cos(a), uz = Math.sin(a), su = b.h[0] - 0.02, sn = b.h[2] - 0.02;
  for (const o of g.col.boxes as any[]) {
    if (o.c[1] + o.h[1] < 0.06 || o.c[1] - o.h[1] > 0.3 || (o.flags & BoxFlag.NoShadow)) continue;
    const bx = Math.cos(o.yaw), bz = -Math.sin(o.yaw), dx = o.c[0] - b.c[0], dz = o.c[2] - b.c[2], c = Math.abs(ux * bx + uz * bz), s = Math.abs(ux * bz - uz * bx);
    if (Math.abs(dx * ux + dz * uz) > su + o.h[0] * c + o.h[2] * s || Math.abs(-dx * uz + dz * ux) > sn + o.h[0] * s + o.h[2] * c) continue;
    if (Math.abs(dx * bx + dz * bz) > o.h[0] + su * c + sn * s || Math.abs(-dx * bz + dz * bx) > o.h[2] + su * s + sn * c) continue;
    return `it lies in a static at (${f2(o.c[0])}, ${f2(o.c[2])}) half ${f2(o.h[0])} × ${f2(o.h[2])}, y ${f2(o.c[1] - o.h[1])}‥${f2(o.c[1] + o.h[1])}${o.name ? ` '${o.name}'` : ''}`;
  }
  return null;
}
const isOpenDoor = (d: any) => !d.latched && Math.abs(d.angle) >= 0.6 && !d.isClosed() && !d.locked;
const ordinary = (g: any) => g.doors.list.filter((d: any) => !d.def.steel && doorway(g, d));

// ---------------------------------------------------------------- blast
export const offHingesBlast = guarded(async () => {
  const { verdict, done } = family('off-hinges-blast: a blast at a door takes the leaf off; it flies away, lands, lies loose; the doorway reads open');
  const R = await rig(7), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
  shut(g, d); R.step(3);
  const before = reads(g, d);
  verdict(!before.sight && !before.shot && !before.sound && before.seal, `${d.def.name}, shut: sight, shot and sound through the doorway are blocked and the leaf seals`, readsWords(before));
  const events: any[] = []; const seen = new Set<any>(); const tap = () => { for (const e of g.events) if (!seen.has(e)) { seen.add(e); events.push(e); } };
  tap(); events.length = 0;
  const side: 1 | -1 = 1, from = off(d, side, 1.0, 0.9), t0 = g.time, s0 = { ...DOORBLAST_STATS };
  const told: string[] = []; const untell = g.doors.onTorn((x: any, who: number) => told.push(`${x.def.name} by ${who}`));
  const torn = g.doors.blast(from, DOORBLAST.tearM.frag, PLAYER_ID); tap();
  verdict(torn.length === 1 && torn[0] === d && d.off && !!d.slab && !d.slab.rest, 'Doors.blast (a frag\'s reach, a metre off the leaf) answers that door, and it is off its frame at once', `returned ${torn.map((x: any) => x.def.name).join(', ') || 'nothing'} · off ${d.off} · in the air ${!!d.slab && !d.slab.rest}`);
  untell(); verdict(told.length === 1 && told[0] === `${d.def.name} by ${PLAYER_ID}`, 'Doors.onTorn subscribers are told once, with the door and who is blamed', told.join(' · ') || 'not told');
  let maxY = 0, tilted = false; for (let i = 0; i < 6 * 60 && !d.slab.rest; i++) { R.step(); tap(); maxY = Math.max(maxY, d.box.c[1]); tilted ||= !!d.box.rot; }
  const S = d.slab, c = d.box.c, away = offOfFrame(d, c) * -side;
  verdict(S.rest && S.landed && g.time - t0 < 4, 'it lands and comes to rest', `at rest ${S.rest} after ${f2(g.time - t0)} s · tilted on the way ${tilted} · highest centre ${f2(maxY)} m`);
  verdict(away > 0.5 && Math.hypot(c[0] - d.frameCentre[0], c[2] - d.frameCentre[2]) > 0.5, 'it went AWAY from the blast, out of the frame', `slab at ${at(c)}, ${f2(away)} m beyond the frame line on the far face (blast at ${at(from)})`);
  const clean = slabClean(g, d);
  verdict(clean === null, 'it lies flat and loose on the floor, a 5 cm box clear of every wall', clean ?? `h (${d.box.h.map(f2).join(', ')}) · centre y ${f2(c[1])} · yaw-only`);
  const after = reads(g, d);
  verdict(after.sight && after.shot && after.sound && !after.seal, 'sight, shot and sound through the doorway read OPEN, and nothing seals it (the smoke bake and the mixer key on that bit)', readsWords(after));
  verdict(Number.isFinite(after.nav) && after.nav < 2.6, 'nav through the doorway is the straight path', `${f2(after.nav)} m for a 1.8 m line (before: ${f2(before.nav)} m — the nav grid never held leaves)`);
  verdict(isOpenDoor(d) && d.lockBroken && Math.abs(Math.abs(d.angle) - OFF_ANGLE) < 1e-9, 'to the AI\'s door tests it is an open doorway: unlatched, wide, no lock', `latched ${d.latched} · angle ${f2(d.angle)} · locked ${d.locked} · lockBroken ${d.lockBroken} · pos ${at(d.pos)} (the frame)`);
  // no verb moves it
  const snap = () => `${d.off}|${d.angle}|${d.latched}|${d.vel}|${d.box.c.join(',')}|${d.box.h.join(',')}`; const s1 = snap();
  g.doors.use(d, from, PLAYER_ID); R.step(20); g.doors.kickIn(d, from, PLAYER_ID); R.step(20); g.doors.pullTo(d, PLAYER_ID); R.step(20); g.doors.crack(d, from, PLAYER_ID, DT); g.doors.rattle(d, PLAYER_ID); const picked = g.doors.pick(d, PLAYER_ID, DT);
  d.vel = 3; d.latched = true; d.closing = true; d.angle = 0.3; R.step(60);   // (and a swing written straight onto it, as a drill's shove or a script would)
  verdict(snap() === s1 && picked === true, 'use, kick, pull to, crack, rattle, pick, a swing written straight onto it: nothing moves it (pick answers "not locked")', snap() === s1 ? 'unchanged after all of them and two seconds' : `${s1} → ${snap()}`);
  g.teleportPlayer([from[0], 0, from[2]]); R.step(20);
  const rows = (g.nearby ?? []).filter((r: any) => r.door === d || r.target === d);
  verdict(rows.length === 0, 'Sam beside it is offered no door row', `${(g.nearby ?? []).length} rows near him, ${rows.length} of this door`);
  const kick = events.filter(e => e.kind === 'kick'), land = events.filter(e => e.kind === 'door' && e.who === PLAYER_ID && (e.level ?? 0) >= DOORBLAST.landLevel - 1e-9);
  verdict(kick.length === 1 && kick[0].loud && land.length === 1 && land[0].loud && DOORBLAST_STATS.torn - s0.torn === 1 && DOORBLAST_STATS.landed - s0.landed === 1,
    'the floor heard the frame go (the kick event a booted lock files) and the slab land (a loud door noise at the slab)', `kick events ${kick.length} · landing events ${land.length} at ${land[0] ? at(land[0].pos) : '—'} · torn ${DOORBLAST_STATS.torn - s0.torn} landed ${DOORBLAST_STATS.landed - s0.landed}`);
  return done();
});
/** signed distance off the frame line (+ = the CCW face, doors.ts side()) */
function offOfFrame(d: any, p: number[]): number { const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th); return ux * (p[2] - d.def.hinge[1]) - uz * (p[0] - d.def.hinge[0]); }

// ---------------------------------------------------------------- what never does it
export const offHingesHung = guarded(async () => {
  const { verdict, done } = family('off-hinges-hung: a kick, a shove, a stun canister, a blast out of reach or behind a wall, anything at a steel door — the leaf stays hung');
  const R = await rig(11), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
  const hung = () => !d.off && !d.slab && !d.box.rot && d.box.h === d.leafH;
  shut(g, d); R.step(3);
  g.doors.kickIn(d, off(d, 1, 0.6), PLAYER_ID); R.step(120);
  verdict(hung() && Math.abs(d.angle) > 0.6, 'a boot through it: flung open on its hinges, still hung', `off ${d.off} · angle ${f2(d.angle)}`);
  shut(g, d); R.step(3);
  g.doors.use(d, off(d, 1, 0.6), PLAYER_ID); R.step(120);
  verdict(hung(), 'a hand on it: hung', `off ${d.off} · angle ${f2(d.angle)}`);
  shut(g, d); R.step(3);
  let bangs = 0; { const seen = new Set<any>(g.events); dropThrowable(g, 'flash', off(d, 1, 0.35, 0)); for (let i = 0; i < 60 * 5; i++) { R.step(); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'bang') bangs++; } } }
  verdict(hung() && bangs === 1, 'a stun canister going off on its sill: hung (combat.ts hands Doors.blast a stun\'s reach, 0)', `off ${d.off} · angle ${f2(d.angle)} · it went off ${bangs === 1}`);
  DOORBLAST.tearM.stun = 1.5; shut(g, d); R.step(3); dropThrowable(g, 'flash', off(d, 1, 0.35, 0)); for (let i = 0; i < 60 * 3; i++) R.step();
  verdict(d.off, '… and the seam is live: with DOORBLAST.tearM.stun raised to 1.5 the same canister takes the leaf off', `off ${d.off}`);
  DOORBLAST.tearM.stun = 0; d.reset();
  shut(g, d); R.step(3);
  const none0 = g.doors.blast(off(d, 1, 0.3, 0.9), DOORBLAST.tearM.stun, PLAYER_ID);
  const far = g.doors.blast(off(d, 1, DOORBLAST.tearM.frag + 0.4, 0.9), DOORBLAST.tearM.frag, PLAYER_ID);
  verdict(none0.length === 0 && far.length === 0 && hung(), 'Doors.blast with a stun\'s reach (0) at the leaf, and a frag 0.4 m past its own reach: nothing', `stun ${none0.length} · far ${far.length} · off ${d.off}`);
  // a wall between: a spot within reach of some ordinary leaf from which the level's statics hide all of it
  let walled: { d: any; p: V3 } | null = null;
  { const all = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
    try {
      search: for (const x of ordinary(g)) for (let i = 0; i < 16; i++) for (const r of [1.0, 1.3]) {
        const th = i / 16 * Math.PI * 2, p: V3 = [x.frameCentre[0] + Math.cos(th) * r, 0.9, x.frameCentre[2] + Math.sin(th) * r];
        if (g.col.nav.findPath([p[0], 0, p[2]], [p[0] + 0.01, 0, p[2]], 50) === null) continue;
        let hidden = true; for (const s of [1, -1] as const) for (const a of [0.1, 0.5, 0.9]) for (const y of [0.3, 1.0, 1.8]) for (const b of [0.03, 0.12]) if (!g.col.solidBlocked(p, doorPt(x, x.def.width * a, b, s, y))) hidden = false;
        if (hidden) { walled = { d: x, p }; break search; }
      }
    } finally { g.col.dynamicBoxes = all; } }
  if (walled) { shut(g, walled.d); const r = g.doors.blast(walled.p, 2.5, PLAYER_ID); verdict(!r.includes(walled.d) && !walled.d.off, 'a blast within reach but with a wall between it and the whole leaf: hung', `${walled.d.def.name} from ${at(walled.p)}: returned ${r.map((x: any) => x.def.name).join(', ') || 'nothing'}`); for (const x of r) x.reset(); }
  else console.log('    (no spot on this level is within 1.3 m of a leaf and walled off from all of it: the wall rule is not exercised here)');
  const steel = g.doors.list.filter((x: any) => x.def.steel);
  for (const x of steel) { shut(g, x); const r = g.doors.blast(off(x, 1, 0.4, 0.9), 3, PLAYER_ID), r2 = g.doors.blast(off(x, -1, 0.4, 0.9), 3, PLAYER_ID), t = tearOff(g, x, off(x, 1, 0.4), PLAYER_ID, 1);
    verdict(!r.includes(x) && !r2.includes(x) && !t && !x.off, `the steel door ${x.def.name}: a 3 m blast on either face and a charge set on it — hung`, `blast ${r.length + r2.length} · tearOff ${t} · off ${x.off}`); for (const y of [...r, ...r2]) y.reset(); }
  if (!steel.length) verdict(false, 'a steel door to try', 'none on this level');
  return done();
});

// ---------------------------------------------------------------- restart, checkpoint
export const offHingesRestart = guarded(async () => {
  const { verdict, done } = family('off-hinges-restart: a restart hangs the door again; a checkpoint keeps it off, lying where it came to rest');
  const R = await rig(13), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
  d.reset(); const authored = { angle: d.angle, latched: d.latched };
  shut(g, d); R.step(3);
  const marks0 = d.box.marks;
  g.doors.blast(off(d, 1, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); R.step(240);
  const wasOff = d.off && d.slab?.rest;
  g.restartEncounter(); R.step(5);
  { const dd = R.door(d.def.name), up = Math.abs(d.box.c[1] - (d.height / 2 + 0.01)) < 0.05;
    verdict(wasOff && dd === d && !d.off && !d.slab && !d.box.rot && d.box.h === d.leafH && d.box.marks === marks0 && up && d.latched === authored.latched && (authored.latched ? d.isClosed() : Math.abs(d.angle) > 0.25) && !d.lockBroken,
      'restartEncounter: hung again, upright, its markings back, standing as the level authored it, its lock whole', `was off ${wasOff} · off ${d.off} · centre y ${f2(d.box.c[1])} · angle ${f2(d.angle)} latched ${d.latched} (authored ${f2(authored.angle)}, ${authored.latched}) · lockBroken ${d.lockBroken}`);
    shut(g, d); R.step(3); const r = reads(g, d);
    verdict(!r.sight && !r.shot && !r.sound && r.seal, '… and shut it blocks sight, shot and sound again and seals', readsWords(r)); }
  // checkpoint with the slab in the air
  shut(g, d); R.step(3);
  g.doors.blast(off(d, -1, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); R.step(12);
  const inAir = d.off && !d.slab.rest;
  let s: any = null, why = ''; try { s = R.W.snapshot('off-hinges', true); } catch (e) { why = String(e); }
  const filed = s ? JSON.stringify(s).includes('"off":{') : false;
  for (let i = 0; i < 360 && !d.slab?.rest; i++) R.step();
  const rest = d.slab ? [d.box.c[0], d.box.c[2], d.slab.a, d.slab.side] : [];
  if (s) R.W.restore(JSON.parse(JSON.stringify(s)));
  R.step(2);
  const back = d.slab ? [d.box.c[0], d.box.c[2], d.slab.a, d.slab.side] : [];
  const same = rest.length === 4 && back.length === 4 && Math.hypot(rest[0] - back[0], rest[1] - back[1]) < 0.02 && Math.abs(rest[2] - back[2]) < 0.01 && rest[3] === back[3];
  verdict(!!s && inAir && filed && d.off && !!d.slab?.rest && same && slabClean(g, d) === null && reads(g, d).sight && isOpenDoor(d),
    'a checkpoint taken 0.2 s into the flight: loaded, the door is off and the slab lies where the flight ended', s ? `in the air at the save ${inAir} · filed ${filed} · flight ended ${rest.map(f2).join(', ')} · loaded ${back.map(f2).join(', ')} · ${slabClean(g, d) ?? 'clean'}` : `snapshot refused: ${why}`);
  g.restartEncounter(); R.step(3);
  verdict(!d.off && d.box.h === d.leafH, '… and a restart after that load hangs it again', `off ${d.off}`);
  return done();
});

// ---------------------------------------------------------------- the charge of the door tools
export const offHingesCharge = guarded(async () => {
  const { verdict, done } = family('off-hinges-charge: the breaching charge set on a leaf takes it off — and does to the men behind it what it did');
  const run = async (on: boolean) => {
    DOORBLAST.on = on;
    const R = await rig(17), g = R.g, d = R.door('manager') ?? ordinary(g)[0], D = g.doorTools;
    g.aiEnabled = true; shut(g, d); R.step(3);
    const side: 1 | -1 = 1;
    // two men behind it: one inside the knock-down reach, one further in
    const men = g.guards.filter((x: any) => x.state !== 'dead' && x.team !== 'operative').slice(0, 2);
    const near = doorPt(d, d.def.width / 2, 1.2, -side as 1 | -1), deep = doorPt(d, d.def.width / 2, 3.2, -side as 1 | -1);
    if (men[0]) men[0].char.pos = [near[0], 0, near[2]]; if (men[1]) men[1].char.pos = [deep[0], 0, deep[2]];
    R.step(2);
    D.set.push({ door: d, side, t: g.time, by: 'probe' });
    // the seam with the destruction goal: its blast entry point and its change feed, listened to where the build has them and stood in for where it has not
    const heard: any[] = [], rows: any[] = [], eng = g.destr as any, was = eng.blast?.bind(eng), feed = eng.walls ?? (eng.walls = {}), note = feed.note?.bind(feed);
    eng.blast = (p: any, o: any) => { heard.push(o); return was?.(p, o); }; feed.note = (r: any) => { rows.push(r); return note?.(r); };
    const res = D.blow(); for (let i = 0; i < 300; i++) R.step();
    return { g, d, res, men, R, heard, rows };
  };
  const A = await run(true), B = await run(false);
  verdict(A.d.off && !!A.d.slab?.rest && slabClean(A.g, A.d) === null && offOfFrame(A.d, A.d.box.c) < -0.4 && reads(A.g, A.d).sight, 'the charge blown: the leaf is off, thrown INTO the room, at rest clear of the walls, the doorway open', `off ${A.d.off} · slab ${at(A.d.box.c)} (${f2(-offOfFrame(A.d, A.d.box.c))} m in) · ${slabClean(A.g, A.d) ?? 'clean'}`);
  verdict(!!A.res && !!B.res && A.res.knocked === B.res.knocked && A.res.stunned === B.res.stunned && A.res.backblast === B.res.backblast && A.res.knocked >= 1,
    'who it knocks down and who it stuns is what it was with the switch off', `on: ${JSON.stringify(A.res)} · off: ${JSON.stringify(B.res)}`);
  // (the feed's rows of other kinds are the blast's own: on the page's stand a piece of cover stands inside the charge's 0.8 m and is a 'cover' row beside the door's)
  const doorRows = A.rows.filter((r: any) => r.kind === 'door'), row = doorRows[0];
  verdict(A.heard.length === 1 && A.heard[0].radius === DOORBLAST.chargeR && A.heard[0].chaos === false && A.heard[0].who === PLAYER_ID
    && doorRows.length === 1 && row.cause === 'blast' && row.id === A.g.doors.list.indexOf(A.d) && row.walkable && row.sight && row.dead && row.who === PLAYER_ID
    && B.heard.length === 0 && B.rows.length === 0,
    'the seam: the charge calls the blast entry point once at its own radius with the chaos left out, the torn leaf is one door row in the change feed — and neither with the switch off',
    `on: ${A.heard.length} call(s) ${JSON.stringify(A.heard[0] ?? null)} · ${A.rows.length} row(s) ${A.rows.map((r: any) => `${r.kind}/${r.cause} #${r.id} ${r.name ?? ''}`).join(', ') || '-'} · off: ${B.heard.length} call(s), ${B.rows.length} row(s)`);
  verdict(!B.d.off && B.d.lockBroken && Math.abs(B.d.angle) > 1.0 && B.d.box.h === B.d.leafH, 'switch off: the leaf is flung in on its hinge with the keep broken, as it was', `off ${B.d.off} · angle ${f2(B.d.angle)} · lockBroken ${B.d.lockBroken}`);
  return done();
});

// ---------------------------------------------------------------- a man walks it
export const offHingesWalk = guarded(async () => {
  const { verdict, done } = family('off-hinges-walk: a man sent through the doorway walks it as an open doorway; nothing about the door or its slab changes');
  const walk = async (how: 'off' | 'open') => {
    const R = await rig(19), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
    shut(g, d); R.step(3);
    if (how === 'off') { g.doors.blast(off(d, 1, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); R.step(240); }
    else { d.latched = false; d.angle = -1.45; d.quietT = -3600; d.place(); R.step(240); }   // (the control: the same leaf hung, standing wide open the same way, its closer held off)
    const gd = g.guards.find((x: any) => x.state !== 'dead'); g.aiEnabled = true; g.player.invisible = true;
    const A = off(d, 1, 2.2, 0), B = off(d, -1, 2.2, 0);
    gd.char.pos = [A[0], 0, A[2]]; gd.path = []; gd.pathGoal = null;
    const slab = () => `${d.box.c.join(',')}|${d.box.h.join(',')}|${d.box.yaw}`, st = () => `${d.off}|${d.angle}|${d.latched}|${d.vel}`, slab0 = slab(), st0 = st();
    order(gd, { goal: [B[0], 0, B[2]] });
    let crossed = false, t = 0, moved = false; const s0 = Math.sign(offOfFrame(d, gd.char.pos));
    const there = () => Math.hypot(gd.char.pos[0] - B[0], gd.char.pos[2] - B[2]) <= 0.5;
    for (; t < 15 * 60 && !there(); t++) { R.step(); if (Math.sign(offOfFrame(d, gd.char.pos)) !== s0) crossed = true; moved ||= st() !== st0; }
    return { d, gd, arrived: there(), crossed, secs: t / 60, moved, slabMoved: slab() !== slab0 };
  };
  const X = await walk('off'), C = await walk('open');
  verdict(X.arrived && X.crossed && C.arrived && X.secs <= C.secs + 0.75, 'he crosses the frame line and arrives, as soon as through the same door standing open on its hinges', `${X.gd.callsign ?? 'a man'}: off its hinges ${X.arrived ? `${f2(X.secs)} s` : `not there, at ${at(X.gd.char.pos)}`} · hung open ${C.arrived ? `${f2(C.secs)} s` : 'not there'} · 4.4 m`);
  verdict(!X.moved && !X.slabMoved && X.d.passers === 0, 'the door\'s state and the slab on the floor are exactly as they were (no leaf was pushed, nobody is counted in its swing)', `state ${X.d.off}|${f2(X.d.angle)}|${X.d.latched} · slab moved ${X.slabMoved} · passers ${X.d.passers}`);
  return done();
});

// ---------------------------------------------------------------- what is left of a blown door for the other door rules
export const offHingesAfter = guarded(async () => {
  const { verdict, done } = family('off-hinges-after: an empty frame is no door to the handle rule, the slab on the floor is no door to the order cursor, Sam\'s hands come off a lock that is gone');
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`); const { HANDLE, HANDLE_STATS } = await import(`${ROOT}/src/game/handleside.ts`);
  const was = { oneWay: DOORWAY.oneWay, handle: HANDLE.on };
  try {
    DOORWAY.oneWay = true; HANDLE.on = true;
    // a man crossing the empty frame from the face the leaf used to open toward: one-way + handle side on, the leaf blown from that face (its record then reads 'open the wrong way')
    const walk = async (from: 'pull' | 'push') => {
      const R = await rig(19), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
      shut(g, d); R.step(3);
      const pullSide = (g.doors.pullFace(d, off(d, 1, 0.9)) ? 1 : -1) as 1 | -1, blastSide = (from === 'pull' ? pullSide : -pullSide) as 1 | -1;
      g.doors.blast(off(d, blastSide, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); R.step(240);
      const gd = g.guards.find((x: any) => x.state !== 'dead'); g.aiEnabled = true; g.player.invisible = true;
      const A = off(d, pullSide, 2.2, 0), B = off(d, -pullSide as 1 | -1, 2.2, 0);
      gd.char.pos = [A[0], 0, A[2]]; gd.path = []; gd.pathGoal = null;
      const h0 = { ...HANDLE_STATS }; order(gd, { goal: [B[0], 0, B[2]] });
      const there = () => Math.hypot(gd.char.pos[0] - B[0], gd.char.pos[2] - B[2]) <= 0.5; let t = 0;
      for (; t < 15 * 60 && !there(); t++) R.step();
      return { off: d.off, arrived: there(), secs: t / 60, held: HANDLE_STATS.held - h0.held, bent: HANDLE_STATS.bent - h0.bent, lined: HANDLE_STATS.lined - h0.lined, pulls: HANDLE_STATS.pulls - h0.pulls };
    };
    const P = await walk('pull'), Q = await walk('push');
    const txt = (x: typeof P) => `${x.arrived ? `${f2(x.secs)} s` : 'not there'} · held ${x.held} frames · bent ${x.bent} · lined ${x.lined} · pulls ${x.pulls}`;
    verdict(P.off && Q.off && P.arrived && Q.arrived && P.held + P.bent + P.lined + P.pulls === 0 && Q.held + Q.bent + Q.lined + Q.pulls === 0 && Math.abs(P.secs - Q.secs) <= 0.5,
      'blown from either face, he walks the empty frame from its old pull face with no handle walk, no hold and no bend, in the same time', `blown from the pull face: ${txt(P)}\n    blown from the push face: ${txt(Q)}`);
    // the order cursor on the slab where it lies
    { const R = await rig(23), g = R.g, O = g.orders; let best: any = null;
      for (const d of ordinary(g)) for (const s of [1, -1] as const) {   // the door and face whose slab comes to rest furthest from its frame
        const T = await rig(23), dd = T.door(d.def.name); shut(T.g, dd); T.step(3); T.g.doors.blast(off(dd, s, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); T.step(300);
        const far = dd.off ? Math.hypot(dd.box.c[0] - dd.frameCentre[0], dd.box.c[2] - dd.frameCentre[2]) : 0; if (!best || far > best.far) best = { name: d.def.name, s, far }; }
      const d = R.door(best.name); shut(g, d); R.step(3); g.doors.blast(off(d, best.s, 0.9, 0.9), DOORBLAST.tearM.frag, PLAYER_ID); R.step(300);
      const c = d.box.c as V3, far = Math.hypot(c[0] - d.frameCentre[0], c[2] - d.frameCentre[2]);
      // Sam beside the slab, the cursor on it: the first standing spot and height from which the cursor's own ray lands on the slab's box
      let t: any = null, onSlab = false;
      for (const [ox, oz] of [[1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) { if (onSlab) break;
        if (g.col.nav.isBlocked(c[0] + ox, c[2] + oz)) continue; g.teleportPlayer([c[0] + ox, 0, c[2] + oz]); R.step(30);
        for (const y of [0.05, 0.2]) { if (!R.W.cursorAt([c[0], c[1] + d.box.h[1] + y, c[2]])) continue; R.step(2);
          const ray = R.W.cam.ray(R.W.input.mouseX / R.W.canvas.clientWidth, R.W.input.mouseY / R.W.canvas.clientHeight), hit = g.engine.world.raycast(ray.ro, ray.rd, 200, undefined, PLAYER_ID);
          if (hit && g.engine.world.all[hit.index] === d.box) { onSlab = true; t = O.targetUnder(R.W.input, R.W.cam, R.W.canvas); break; } } }
      const front = onSlab;
      R.W.cursorAt([d.frameCentre[0], 1.0, d.frameCentre[2]]); R.step(2); const t2 = O.targetUnder(R.W.input, R.W.cam, R.W.canvas);
      verdict(d.off && front && onSlab && far > 1.2 && !!t && t.door !== d && t2.kind === 'door' && t2.door === d, 'a cursor on the slab is the floor it lies on, not the door; a cursor in the empty doorway is still that door', `${d.def.name}: slab ${f2(far)} m from its frame · the cursor's ray lands on the slab ${onSlab} · on the slab → ${t ? `${t.kind}${t.door ? ` (${t.door.def.name})` : ''}` : '?'} · in the doorway → ${t2.kind}${t2.door ? ` (${t2.door.def.name})` : ''}`); }
    // Sam's hands: picking the lock, keying the pad
    { const R = await rig(31), g = R.g, d = R.door('manager') ?? ordinary(g)[0], pl = g.player;
      shut(g, d); R.step(3); pl.picking = d; pl.char.anim.lockpick = true; pl.coding = d; pl.codeT = 0.5; d.pick = 0.6;
      const tore = tearOff(g, d, off(d, 1, 0.5), PLAYER_ID, 1);
      verdict(tore && pl.picking === null && pl.coding === null && pl.codeT === 0 && !pl.char.anim.lockpick && pl.easing === null && d.pick === 0, 'the leaf torn off under his tools: the pick and the keypad entry are dropped with it', `picking ${pl.picking ? 'still' : 'null'} · coding ${pl.coding ? 'still' : 'null'} · pick ${d.pick}`); }
  } finally { DOORWAY.oneWay = was.oneWay; HANDLE.on = was.handle; }
  return done();
});

// ---------------------------------------------------------------- every door of every level
const LEVELS = [undefined, 'records.json', 'depot.json', 'block.json', 'block-squads.json', 'barracks.json', 'compound.json', 'warehouse.json', 'kit-yard.json', 'test-rooms.json'];
export const offHingesSweep = guarded(async () => {
  const { verdict, done } = family('off-hinges-sweep: every ordinary door of every level, both faces, by a blast and by a set charge — off, landed, clear of the walls, the doorway open');
  let total = 0, backs = 0; const bad: string[] = []; const perLevel: string[] = []; const T0 = { ...DOORBLAST_STATS }; DOORBLAST_STATS.nudgeMax = 0;
  for (const file of LEVELS) {
    let R: Awaited<ReturnType<typeof rig>>;
    try { R = await rig(23, file); } catch (e) { bad.push(`${file ?? 'office'}: did not load (${String(e).slice(0, 60)})`); continue; }   // (a level that does not load is a FAIL and no level swept, as in doorstay-probes: it was a logged line under a PASS)
    const g = R.g, doors = ordinary(g); let n = 0, b0 = DOORBLAST_STATS.back, longest = 0;
    for (const d of doors) for (const side of [1, -1] as const) for (const how of ['blast', 'charge', 'open'] as const) {
      shut(g, d); for (const x of g.doors.list) if (x !== d && x.off) x.reset();
      if (how === 'open') { d.latched = false; d.angle = side * 1.2; d.place(); }   // (a leaf standing open INTO the blast's side: it still leaves away from the blast)
      R.step(1);
      const from = off(d, side, how === 'charge' ? 0.5 : 0.8, 0.9);
      const ok = how === 'charge' ? tearOff(g, d, from, PLAYER_ID, DOORBLAST.chargeK) : g.doors.blast(from, DOORBLAST.tearM.frag, PLAYER_ID).includes(d);
      const tag = `${file ?? 'office'} ${d.def.name} ${side > 0 ? '+' : '−'} ${how}`;
      if (!ok) { bad.push(`${tag}: did not come off`); continue; }
      let t = 0; for (; t < 6.5 * 60 && !d.slab.rest; t++) R.step();
      longest = Math.max(longest, d.slab.t); n++; total++;
      const c = slabClean(g, d); if (c) { bad.push(`${tag}: ${c}`); continue; }
      if (d.slab.t >= 6) bad.push(`${tag}: stopped by the six-second cap`);
      const r = reads(g, d); if (!r.sight || !r.shot || r.seal) bad.push(`${tag}: doorway ${readsWords(r)}`);
      if (!g.doors.list.every((x: any) => x.box.c.every(Number.isFinite))) bad.push(`${tag}: a door box is not finite`);
    }
    for (const d of g.doors.list) d.reset();
    backs += DOORBLAST_STATS.back - b0;
    perLevel.push(`${file ?? 'office'}: ${doors.length} doors, ${n} leaves off (${DOORBLAST_STATS.back - b0} fell back for want of room), longest flight ${f2(longest)} s`);
  }
  for (const l of perLevel) console.log(`    ${l}`);
  verdict(total > 0 && bad.length === 0, `${total} leaves taken off over ${perLevel.length} levels: every one landed, rests clear of the statics, and left its doorway open`, bad.length ? `${bad.length} bad:\n      ${bad.slice(0, 24).join('\n      ')}` : `${backs} of them fell back through their own doorway for want of room ahead · ${DOORBLAST_STATS.nudged - T0.nudged} had their resting place moved clear of a static (the furthest ${f2(DOORBLAST_STATS.nudgeMax)} m), ${DOORBLAST_STATS.laid - T0.laid} of those laid through their own doorway for want of any spot`);
  return done();
});

// ---------------------------------------------------------------- the switch
export const offHingesOff = guarded(async () => {
  const { verdict, done } = family('off-hinges-off: DOORBLAST.on false — no blast takes a leaf');
  const R = await rig(29), g = R.g, d = R.door('manager') ?? ordinary(g)[0];
  shut(g, d); R.step(3); DOORBLAST.on = false; const b0 = DOORBLAST_STATS.blasts;
  const r = g.doors.blast(off(d, 1, 0.5, 0.9), 3, PLAYER_ID), t = tearOff(g, d, off(d, 1, 0.5), PLAYER_ID, 1); R.step(60);
  verdict(r.length === 0 && !t && !d.off && d.isClosed() && d.latched && DOORBLAST_STATS.blasts === b0, 'Doors.blast answers nothing, tearOff refuses, the leaf is shut and latched as it stood', `blast ${r.length} · tearOff ${t} · off ${d.off} · angle ${f2(d.angle)} · latched ${d.latched}`);
  return done();
});
