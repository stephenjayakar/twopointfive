// The 'decals' probe family (experiment E1 — render/decals.ts + game/marks.ts), run through probes.ts:
//   bun run tools/qa/probes.ts decals | decals-ring | decals-sites | decals-follow | decals-off | decals-identity [--verbose]
// Headless = no GPU: nothing here can see a mark. What is asserted is the CPU machinery the picture is made from: the ring and its order, the cell
// packing the shader walks, that each of the four places things hit things leaves exactly the mark it should (kind, where, which way it faces, what it
// rides), that a mark on furniture follows the furniture, that 'off' records and writes nothing, and that a seeded fight is byte for byte the same fight
// with decals on or off (marks.ts never touches the dice). PASS / FAIL each:
//   (ring)      522 adds → 512 kept, the ten oldest gone, serials ascending; the packed cell table lists every drawn decal in every cell its circle overlaps
//               and nothing else; 100 holes in one square metre → that cell keeps the newest DECAL_MAX_PER_CELL; clear() / restartEncounter() /
//               resetLevelState() empty it;
//   (sites)     Sam's round into the corridor wall → one 'bullet' on the wall face, facing out of it, world-fixed; a guard's round likewise; a stun charge on the
//               break-room lino → a 'scorch' facing up under where it went off (+ splashes on what stands within a metre, never facing up); the storage door
//               kicked in → one 'scuff' riding the leaf, on the kicker's face at boot height, turning with the leaf as it flies; a ring airfoil off the wall →
//               a 'chip' by the clack; a round into a torso, or through the sky → nothing;
//   (follow)    a round into a carton → a hole riding that part box, drawn on it alone; shove the carton and re-sync → the hole is where the box now puts
//               its stored local point (to 0.1 mm), it moved with it, and its GPU box index is the box's slot in this frame's list;
//   (off)       decals.enabled false → add() returns null and records nothing, the emit sites leave nothing, frame() uploads nothing and the packed words
//               are bit for bit what they were;
//   (identity)  the same seeded 15 s corridor fight with decals on and off: identical rounds, hearing events and audio calls — while 'on' left its holes.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, dropThrowable } = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { startKick } = await import(`${ROOT}/src/game/player.ts`);
const { fireRing } = await import(`${ROOT}/src/game/launcher.ts`);
const { Decals, DECAL_CAP, DECAL_MAX_PER_CELL, DECAL_LIST_CAP, DECAL_ANY_BOX } = await import(`${ROOT}/src/render/decals.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
const p2 = (p: Vec3) => `(${f2(p[0])}, ${f2(p[1])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; }
/** Sam alone in the corridor at `at` facing +x, everyone parked deaf and blind out on the lot, god mode. */
async function stage(seed: number, at: Vec3 = [21.5, 0, 11.4]) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (the civilians — later actors on the floor, src/game/civilians.ts — scream and run under gunfire and one of them sits on a cubicle chair: this family's frozen numbers predate them, so they are switched off here like in the needs / tactics identity probes)
  game.godMode = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(at); game.player.crouch = false; game.player.char.bodyYaw = Math.PI / 2; game.player.char.aimYaw = Math.PI / 2;
  game.player.slot = 'pistol'; game.player.holstered = false;
  W.step(DT); W.step(DT);
  return W;
}
/** world → box local (the conventions decals.ts / rayBox use), for checking a riding mark against its box */
function toLocal(b: any, p: Vec3): Vec3 { const d: Vec3 = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]]; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return [cs * d[0] - sn * d[2], d[1], sn * d[0] + cs * d[2]]; }
function dirLocal(b: any, n: Vec3): Vec3 { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return [cs * n[0] - sn * n[2], n[1], sn * n[0] + cs * n[2]]; }

// ------------------------------------------------------------------------------------------------ (ring)
export async function decalsRing() {
  const F = family('decals-ring: the 512 ring drops its oldest and keeps its order; the packed cell table is exactly the drawn decals per overlapped cell; one busy cell keeps its newest; clear / restart / reset empty it');
  const W = await stage(8101); const { game } = W; const dc = game.decals;
  { // 522 marks along the corridor wall face (z = 10.12 facing +z), a centimetre apart in a raster
    dc.clear();
    for (let i = 0; i < DECAL_CAP + 10; i++) dc.add('bullet', [14.2 + (i % 100) * 0.09, 0.4 + Math.floor(i / 100) * 0.25, 10.12], [0, 0, 1], 0.025, { param: 1 });
    const serials = dc.list.map((d: any) => d.serial); let ascending = true; for (let i = 1; i < serials.length; i++) if (serials[i] <= serials[i - 1]) ascending = false;
    const fails: string[] = [];
    if (dc.count !== DECAL_CAP) fails.push(`count ${dc.count} (want ${DECAL_CAP})`);
    if (serials[0] !== 11) fails.push(`oldest kept is serial ${serials[0]} (want 11: the first ten recycled)`);
    if (!ascending) fails.push('serials not ascending (order lost)');
    F.verdict(!fails.length, `${DECAL_CAP + 10} adds → ${DECAL_CAP} kept, oldest serial 11, newest ${serials[serials.length - 1]}, ascending`, fails.join('; ') || `serials ${serials[0]}‥${serials[serials.length - 1]}`);
    // the packing: every drawn decal appears in exactly the cells its (radius + 4 cm) circle overlaps, and every listed index is such a decal
    dc.build();
    const words: Uint32Array = dc.words(); const cellsW = WORLD.gridW * WORLD.gridH;
    let listed = 0, missing = 0, stray = 0, maxCell = 0;
    const expect = new Map<number, Set<number>>();
    dc.list.forEach((d: any, i: number) => { if (d.hidden) return; const r = d.radius + 0.04; for (let z = Math.max(0, Math.floor(d.pos[2] - r)); z <= Math.min(WORLD.gridH - 1, Math.floor(d.pos[2] + r)); z++) for (let x = Math.max(0, Math.floor(d.pos[0] - r)); x <= Math.min(WORLD.gridW - 1, Math.floor(d.pos[0] + r)); x++) { const c = z * WORLD.gridW + x; if (!expect.has(c)) expect.set(c, new Set()); expect.get(c)!.add(i); } });
    for (let c = 0; c < cellsW; c++) {
      const { count, indices } = dc.cellAt((c % WORLD.gridW) + 0.5, Math.floor(c / WORLD.gridW) + 0.5);
      maxCell = Math.max(maxCell, count); listed += count;
      const want = expect.get(c) ?? new Set<number>();
      for (const i of indices) if (!want.has(i)) stray++;
      if (count < Math.min(want.size, DECAL_MAX_PER_CELL)) missing += Math.min(want.size, DECAL_MAX_PER_CELL) - count;
    }
    const f: string[] = [];
    if (stray) f.push(`${stray} listed indices whose decal does not overlap that cell`);
    if (missing) f.push(`${missing} overlapping decals missing from their cells`);
    if (words[0] !== dc.count) f.push(`header count ${words[0]} ≠ ${dc.count}`);
    if (words[1] !== listed) f.push(`header list length ${words[1]} ≠ the cells' total ${listed}`);
    if (listed > DECAL_LIST_CAP) f.push(`list length ${listed} > cap ${DECAL_LIST_CAP}`);
    F.verdict(!f.length, `packed: ${listed} cell entries over ${expect.size} cells (busiest ${maxCell}), header agrees, nothing stray, nothing missing`, f.join('; ') || `stats ${JSON.stringify(dc.stats)}`);
  }
  { // one square metre taking 100 holes: the cell keeps the newest DECAL_MAX_PER_CELL of them (indices are list positions: the newest are the highest)
    dc.clear();
    for (let i = 0; i < 100; i++) dc.add('bullet', [20.3 + (i % 10) * 0.04, 1.0 + Math.floor(i / 10) * 0.04, 10.12], [0, 0, 1], 0.02);
    dc.build();
    const cell = dc.cellAt(20.5, 10.5); const minIdx = Math.min(...cell.indices);
    const fails: string[] = [];
    if (cell.count !== DECAL_MAX_PER_CELL) fails.push(`cell (20,10) lists ${cell.count} (want the cap ${DECAL_MAX_PER_CELL})`);
    if (minIdx !== 100 - DECAL_MAX_PER_CELL) fails.push(`oldest listed is #${minIdx} (want #${100 - DECAL_MAX_PER_CELL}: the newest kept)`);
    if (dc.stats.dropped < 100 - DECAL_MAX_PER_CELL) fails.push(`stats.dropped ${dc.stats.dropped}`);
    F.verdict(!fails.length, `100 holes in one cell → it lists the newest ${DECAL_MAX_PER_CELL} (#${minIdx}‥#99), ${dc.stats.dropped} entries dropped by the cap and counted`, fails.join('; ') || `busiest cell ${dc.stats.maxCell}`);
  }
  { // clear / restart / reset
    const fails: string[] = [];
    dc.clear(); if (dc.count) fails.push(`clear() left ${dc.count}`);
    for (let i = 0; i < 5; i++) dc.add('chip', [15 + i * 0.1, 1, 10.12], [0, 0, 1]);
    game.resetLevelState(); if (dc.count) fails.push(`resetLevelState() left ${dc.count}`);
    for (let i = 0; i < 5; i++) dc.add('chip', [15 + i * 0.1, 1, 10.12], [0, 0, 1]);
    game.restartEncounter(); W.step(DT); if (dc.count) fails.push(`restartEncounter() left ${dc.count}`);
    F.verdict(!fails.length, 'clear(), resetLevelState() and restartEncounter() each leave the list empty', fails.join('; ') || 'all three → 0');
  }
  return F.done();
}

// ------------------------------------------------------------------------------------------------ (sites)
export async function decalsSites() {
  const F = family('decals-sites: each of the four places things hit things leaves its one mark — a hole facing out of the wall, a scorch facing up under the bang, a scuff riding the kicked leaf, a chip by the clack — and flesh / sky leave nothing');
  { // Sam's round into the corridor's north wall (z = 10 + 0.12, facing +z), then a guard's
    const W = await stage(8201, [21.5, 0, 11.4]); const { game } = W; const dc = game.decals; const pl = game.player;
    dc.clear();
    const wallPt: Vec3 = [24.0, 1.2, 10.0];
    const faceZ = (from: Vec3, to: Vec3) => { const dir = v3.normalize(v3.sub(to, from)); const st = game.col.raycast(from, dir, 30); if (!st || st.index >= 1e6) return NaN; const b = game.col.boxes[st.index]; return b.c[2] + b.h[2]; };   // the +z face of the wall box the round will meet
    const wallZ = faceZ(pl.char.muzzle, wallPt);
    fireWeapon(game, pl.char, wallPt, true);
    const d = dc.list[0];
    const fails: string[] = [];
    if (dc.count !== 1) fails.push(`${dc.count} decals after one round (want 1)`);
    else {
      if (d.kind !== 'bullet') fails.push(`kind ${d.kind}`);
      if (Math.abs(d.n[2] - 1) > 1e-3) fails.push(`normal ${p2(d.n)} (want the wall's +z)`);
      if (!(Math.abs(d.pos[2] - wallZ) < 0.003)) fails.push(`z ${f3(d.pos[2])} (want on the wall face at ${f3(wallZ)})`);
      if (d.box || d.boxIdx !== DECAL_ANY_BOX) fails.push('a static wall hole is riding a box');
      if (!(d.radius > 0.02 && d.radius < 0.03)) fails.push(`radius ${d.radius}`);
    }
    F.verdict(!fails.length, `Sam's Five-seveN into the wall → one 'bullet' at ${d ? p2(d.pos) : '∅'} facing ${d ? p2(d.n) : '∅'}, r ${d ? f3(d.radius) : '?'}, world-fixed`, fails.join('; ') || 'ok');
    // a guard's round (steady, no spread) into the same wall
    const gd = game.guards[0]; gd.hold = false; place(gd, [27.0, 0, 11.4], Math.PI); W.step(DT);
    const gTarget: Vec3 = [27.2, 1.0, 10.0]; const gZ = faceZ(gd.char.muzzle, gTarget);
    const n0 = dc.count; fireWeapon(game, gd.char, gTarget, false, { steady: true, spread: 0 });
    const g1 = dc.list[dc.count - 1];
    const gf: string[] = [];
    if (dc.count !== n0 + 1) gf.push(`${dc.count - n0} new decals (want 1)`);
    else { if (g1.kind !== 'bullet' || Math.abs(g1.n[2] - 1) > 1e-3 || !(Math.abs(g1.pos[2] - gZ) < 0.003)) gf.push(`got ${g1.kind} at ${p2(g1.pos)} n ${p2(g1.n)} (face z ${f3(gZ)})`); if (!(g1.radius >= (d?.radius ?? 0))) gf.push(`a 9 mm hole (${f3(g1.radius)}) should be no smaller than a 5.7's (${f3(d?.radius ?? 0)})`); }
    F.verdict(!gf.length, `a guard's 9 mm into the wall → one more 'bullet' on the face (${g1 ? p2(g1.pos) : '∅'}), r ${g1 ? f3(g1.radius) : '?'}`, gf.join('; ') || 'ok');
    // flesh and sky: a round into a parked man's chest, and one straight up out over the lot → nothing new
    const n1 = dc.count; const tgt = game.guards[1]; tgt.hold = false; place(tgt, [24.5, 0, 11.4], -Math.PI / 2); W.step(DT);
    fireWeapon(game, pl.char, v3.add(tgt.char.pos, [0, 1.2, 0]), true);
    const afterFlesh = dc.count;
    game.teleportPlayer([38.5, 0, 14]); W.step(DT); fireWeapon(game, pl.char, [39.5, 40, 14], true);
    const ff: string[] = [];
    if (afterFlesh !== n1) ff.push(`a round into a man left ${afterFlesh - n1} mark(s)`);
    if (dc.count !== afterFlesh) ff.push(`a round into the sky left ${dc.count - afterFlesh} mark(s)`);
    if (tgt.state !== 'dead') ff.push(`staging: the man is ${tgt.state} (the round should have found him)`);
    F.verdict(!ff.length, 'a round into a torso and a round into the sky leave nothing', ff.join('; ') || `count stayed ${dc.count}`);
  }
  { // the stun charge on the break-room lino: dropped armed at (30.0, 19.0), open floor west of the table
    const W = await stage(8202, [33.0, 0, 22.0]); const { game } = W; const dc = game.decals;
    dc.clear();
    const at: Vec3 = [30.0, 0, 19.0];
    dropThrowable(game, 'flash', at);
    let fired = false; for (let i = 0; i < 240 && !fired; i++) { W.step(DT); fired = !game.items.items.some((it: any) => it.kind === 'flash' && !it.fired); }
    const sc = dc.list.filter((d: any) => d.kind === 'scorch'); const floor = sc.find((d: any) => d.n[1] > 0.99);
    const item = game.items.items.find((it: any) => it.kind === 'flash');
    const fails: string[] = [];
    if (!fired) fails.push('staging: the charge never went off in 4 s');
    if (!floor) fails.push(`no scorch facing up (kinds: ${dc.list.map((d: any) => d.kind + p2(d.n)).join(' ')})`);
    else {
      if (item && v3.distXZ(floor.pos, item.pos) > 0.05) fails.push(`the floor scorch is ${f2(v3.distXZ(floor.pos, item.pos))} m from under the can`);
      if (Math.abs(floor.pos[1]) > 0.03) fails.push(`floor scorch at height ${f3(floor.pos[1])} (want on the lino, ~0)`);
      if (!(floor.radius >= 0.6 && floor.radius <= 0.92)) fails.push(`radius ${f2(floor.radius)} (want 0.6‥0.9)`);
      if (floor.box) fails.push('the floor scorch rides a box');
    }
    const splashes = sc.filter((d: any) => d !== floor);
    if (splashes.some((d: any) => Math.abs(d.n[1]) > 0.31)) fails.push('a splash faces up/down (walls only)');
    if (splashes.some((d: any) => d.radius > (floor?.radius ?? 1))) fails.push('a splash bigger than the floor scorch');
    F.verdict(!fails.length, `stun charge at ${p2(at)} → floor scorch ${floor ? `at ${p2(floor.pos)} r ${f2(floor.radius)}` : '∅'} + ${splashes.length} wall/furniture splash(es) ${splashes.map((d: any) => `${p2(d.pos)} r${f2(d.radius)}${d.box ? '[rides]' : ''}`).join(' ')}`, fails.join('; ') || 'ok');
    // and one half a metre off the break room's west wall (x = 28): a splash up that wall facing +x, smaller and weaker than the floor's, never bigger
    dc.clear();
    dropThrowable(game, 'flash', [28.5, 0, 21.0]);
    fired = false; for (let i = 0; i < 240 && !fired; i++) { W.step(DT); fired = !game.items.items.some((it: any) => it.kind === 'flash' && !it.fired); }
    const fl2 = dc.list.find((d: any) => d.kind === 'scorch' && d.n[1] > 0.99); const wall = dc.list.filter((d: any) => d.kind === 'scorch' && Math.abs(d.n[1]) < 0.31);
    const west = wall.find((d: any) => d.n[0] > 0.99);
    const wf: string[] = [];
    if (!fl2) wf.push('no floor scorch');
    if (!west) wf.push(`no splash on the west wall (splashes: ${wall.map((d: any) => p2(d.pos) + p2(d.n)).join(' ') || 'none'})`);
    else {
      if (Math.abs(west.pos[0] - 28.06) > 0.08 && Math.abs(west.pos[0] - 28.12) > 0.08 && !(west.pos[0] > 28.0 && west.pos[0] < 28.2)) wf.push(`west splash at x ${f3(west.pos[0])} (want on the wall face just east of 28)`);
      if (!(west.radius < (fl2?.radius ?? 1)) || !(west.param < 1)) wf.push(`splash r ${f2(west.radius)} I ${f2(west.param)} should be smaller / weaker than the floor's`);
      if (!(west.pos[1] > 0.15 && west.pos[1] < 0.5)) wf.push(`splash centred at height ${f2(west.pos[1])} (want a hand or two up the wall)`);
    }
    F.verdict(!wf.length, `a charge 0.5 m off the west wall → floor scorch + a splash up the wall ${west ? `at ${p2(west.pos)} r ${f2(west.radius)} I ${f2(west.param)}` : '∅'} (${wall.length} wall splash(es) in all)`, wf.join('; ') || 'ok');
  }
  { // the storage door kicked in from the corridor: a scuff riding the leaf, on the corridor face (+z when shut), boot height, turning with the leaf
    const W = await stage(8203, [30.0, 0, 11.2]); const { game } = W; const dc = game.decals;
    dc.clear();
    const d = game.doors.byName('storage'); const spot = game.doors.kickSpot(d, [32.6, 0, 10.9]);
    game.teleportPlayer([spot.pos[0], 0, spot.pos[2]]); W.step(DT);
    startKick(game, d);
    let broke = false; let f = 0; for (; f < 90 && !broke; f++) { W.step(DT); broke = d.lockBroken; }
    const sc = dc.list.filter((x: any) => x.kind === 'scuff');
    const fails: string[] = [];
    if (!broke) fails.push('staging: the kick never landed');
    if (sc.length !== 1) fails.push(`${sc.length} scuffs (want 1); kinds ${dc.list.map((x: any) => x.kind).join(',')}`);
    const s = sc[0];
    let turned = '';
    if (s) {
      game.decals.sync(W.engine.world);   // (a riding mark's world pos / normal are re-derived from its box by sync — the engine's frame() does it before every g-buffer; headless, by hand)
      if (s.box !== d.box) fails.push('the scuff does not ride the leaf box');
      // by the end of the impact frame the kicked leaf has already turned a step (9 rad/s): the mark must sit on ITS face wherever that now is — boot height,
      // the face plane, the outer half by the lock
      if (!(s.pos[1] > 0.7 && s.pos[1] < 1.0)) fails.push(`height ${f2(s.pos[1])} (want 0.7‥1.0)`);
      const ln = dirLocal(d.box, s.n); if (Math.abs(Math.abs(ln[2]) - 1) > 1e-3) fails.push(`normal not the leaf's face normal (local ${p2(ln)})`);
      const lp = toLocal(d.box, s.pos); if (Math.abs(Math.abs(lp[2]) - d.thick / 2) > 0.004) fails.push(`not on the face plane (local z ${f3(lp[2])}, half-thickness ${f3(d.thick / 2)})`);
      if (Math.abs(lp[0]) > d.def.width / 2 || lp[0] < -0.05) fails.push(`along the leaf at local x ${f2(lp[0])} (want the outer half, by the lock)`);
      // kicked from the corridor (the +perp side of a leaf whose closed direction is +x): a step into its swing the mark still faces all but +z
      const n0 = v3.copy(s.n);
      if (n0[2] < 0.97) fails.push(`at the impact the scuff faces ${p2(n0)} (want ≈ +z, out into the corridor)`);
      // let it fly and re-sync: the world normal must turn with the leaf — the corridor face's normal at leaf angle A is (−sin a, 0, cos a), a = closedDir + A
      for (let i = 0; i < 20; i++) W.step(DT); game.decals.sync(W.engine.world);
      const a = d.def.closedDir + d.angle; const faceN: Vec3 = [-Math.sin(a), 0, Math.cos(a)];
      const dot = s.n[0] * faceN[0] + s.n[2] * faceN[2];
      if (Math.abs(d.angle) < 0.2) fails.push(`staging: the leaf did not fly (angle ${f2(d.angle)})`);
      else if (dot < 0.999) fails.push(`after the leaf swung to ${f2(d.angle)} rad the scuff's normal ${p2(s.n)} is not the face's ${p2(faceN)} (dot ${f3(dot)})`);
      const lp2 = toLocal(d.box, s.pos); if (Math.abs(Math.abs(lp2[2]) - d.thick / 2) > 0.004) fails.push(`off the face plane after the swing (local z ${f3(lp2[2])})`);
      if (s.hidden) fails.push('hidden after sync (its box was not found in the frame list)');
      turned = `leaf at ${f2(d.angle)} rad → normal ${p2(n0)} → ${p2(s.n)}`;
    }
    F.verdict(!fails.length, `kick landed at frame ${f} → one 'scuff' riding the storage leaf at ${s ? p2(s.pos) : '∅'} (L ${s ? f2(s.param) : '?'} m); ${turned}`, fails.join('; ') || 'ok');
  }
  { // a ring airfoil off the corridor wall → a chip by the clack point
    const W = await stage(8204, [21.5, 0, 11.4]); const { game } = W; const dc = game.decals; const pl = game.player;
    dc.clear();
    const wallPt: Vec3 = [23.6, 1.1, 10.05]; const from = v3.add(pl.char.pos, [0.4, 1.3, 0]);   // solid wall between the server and manager doors (the manager's leaf stands open into the corridor at 25‥26: a ring there chips the LEAF, correctly)
    fireRing(game, pl.char, from, wallPt);
    for (let i = 0; i < 120 && game.rings.length; i++) W.step(DT);
    const chips = dc.list.filter((d: any) => d.kind === 'chip');
    const fails: string[] = [];
    if (game.rings.length) fails.push('staging: the ring is still in the air after 2 s');
    if (chips.length !== 1) fails.push(`${chips.length} chips (want 1; kinds ${dc.list.map((d: any) => d.kind).join(',')})`);
    else { const c = chips[0]; if (Math.abs(c.n[2] - 1) > 1e-3 || !(c.pos[2] > 10.0 && c.pos[2] < 10.2)) fails.push(`chip at ${p2(c.pos)} n ${p2(c.n)} (want on the wall face, +z)`); if (v3.dist(c.pos, wallPt) > 0.6) fails.push(`chip ${f2(v3.dist(c.pos, wallPt))} m from the mark`); }
    F.verdict(!fails.length, `ring at the wall → one 'chip' ${chips[0] ? `at ${p2(chips[0].pos)} r ${f3(chips[0].radius)}` : '∅'}`, fails.join('; ') || 'ok');
  }
  return F.done();
}

// ------------------------------------------------------------------------------------------------ (follow)
export async function decalsFollow() {
  const F = family('decals-follow: a hole in a carton rides the carton — shove it, re-sync, and the mark is exactly where the box now puts it');
  const W = await stage(8301, [19.9, 0, 15.6]); const { game } = W; const dc = game.decals; const pl = game.player;
  dc.clear();
  // the nearest carton / chair with a face we can hit from here: try the props round the west cubicles at their mid height
  let hit: any = null; let target: Vec3 | null = null;
  for (const p of game.props.props) {
    if (v3.distXZ([p.x, 0, p.z], pl.char.pos) > 6 || v3.distXZ([p.x, 0, p.z], pl.char.pos) < 1.5) continue;
    const t: Vec3 = [p.x, Math.min(0.35, p.height * 0.5), p.z]; const mz = pl.char.muzzle; const dir = v3.normalize(v3.sub(t, mz));
    const st = game.col.raycast(mz, dir, 8); const ph = game.props.raycast(mz, dir, st ? st.t : 8);
    if (ph && ph.prop === p) { hit = ph; target = t; break; }
  }
  if (!hit || !target) { F.verdict(false, 'staging', 'no prop face in a clear line from (19.9, 15.6)'); return F.done(); }
  fireWeapon(game, pl.char, target, true);
  const d = dc.list.find((x: any) => x.kind === 'bullet');
  const fails: string[] = [];
  if (!d) fails.push(`no hole after a round into ${hit.prop.def.name} (kinds ${dc.list.map((x: any) => x.kind).join(',')})`);
  else if (d.box !== hit.box) fails.push(`the hole rides ${d.box ? (d.box.name ?? 'another box') : 'nothing'} (want the part box that was hit)`);
  let detail = '';
  if (d && !fails.length) {
    W.step(DT); dc.sync(W.engine.world);
    const idx0 = d.boxIdx; const wantIdx0 = W.engine.world.statics.length + W.engine.world.dynamics.indexOf(d.box);
    if (idx0 !== wantIdx0) fails.push(`box index ${idx0} ≠ its slot ${wantIdx0}`);
    if (d.hidden) fails.push('hidden after the first sync');
    const local0 = v3.copy(d.local.p); const world0 = v3.copy(d.pos);
    // shove the carton hard sideways and let it slide / spin to rest
    game.props.applyImpulse(hit.prop, [hit.prop.x, 0.2, hit.prop.z + 0.1], [9, 0, 4], 1, false);
    for (let i = 0; i < 90; i++) W.step(DT);
    dc.sync(W.engine.world);
    const moved = v3.dist(world0, d.pos); const lp = toLocal(d.box, d.pos); const err = v3.dist(lp, local0);
    const wantIdx = W.engine.world.statics.length + W.engine.world.dynamics.indexOf(d.box);
    if (moved < 0.05) fails.push(`staging: the carton barely moved (${f3(moved)} m)`);
    if (err > 1e-4) fails.push(`the hole sits ${(err * 1000).toFixed(2)} mm off the box's stored local point`);
    if (d.boxIdx !== wantIdx) fails.push(`box index ${d.boxIdx} ≠ slot ${wantIdx} after the shove`);
    const ln = dirLocal(d.box, d.n); if (v3.dist(ln, d.local.n) > 1e-4) fails.push('its normal did not turn with the box');
    dc.build(); const words = dc.words(); const rec = words.slice(); const bits = rec[(dcRec0() + dc.list.indexOf(d) * 3) * 4 + 11];
    if (((bits >>> 16) & 0xffff) !== d.boxIdx || !(bits & 8)) fails.push(`packed bits ${bits.toString(16)}: attached flag / box index not what the shader tests`);
    detail = `${hit.prop.def.name} moved ${f2(moved)} m and turned; hole ${p2(world0)} → ${p2(d.pos)}, ${(err * 1000).toFixed(3)} mm off its local point, GPU box ${d.boxIdx} (attached bit set)`;
  }
  F.verdict(!fails.length, `a round into ${hit.prop.def.name} → a hole riding its part box; shoved and re-synced it stays put on the box`, fails.join('; ') || detail);
  return F.done();
}
/** REC0 word offset as decals.ts lays the buffer out (1 header vec4 + cells/4 + list/4) */
function dcRec0(): number { return 1 + Math.ceil(WORLD.gridW * WORLD.gridH / 4) + DECAL_LIST_CAP / 4; }

// ------------------------------------------------------------------------------------------------ (off)
export async function decalsOff() {
  const F = family('decals-off: enabled false → nothing recorded, nothing written');
  const W = await stage(8401, [21.5, 0, 11.4]); const { game } = W; const dc = game.decals; const pl = game.player;
  dc.clear(); dc.add('bullet', [22, 1, 10.12], [0, 0, 1]); dc.frame(W.engine.world);   // one mark in and uploaded while on
  const uploads0 = dc.stats.uploads; const words0: Uint32Array = dc.words(); const count0 = dc.count;
  dc.enabled = false;
  const r = dc.add('bullet', [22.2, 1, 10.12], [0, 0, 1]);
  fireWeapon(game, pl.char, [24.0, 1.2, 10.0], true);
  dropThrowable(game, 'flash', [23.0, 0, 11.3]); for (let i = 0; i < 150; i++) W.step(DT);
  dc.frame(W.engine.world); dc.frame(W.engine.world);
  const words1: Uint32Array = dc.words();
  let same = words0.length === words1.length; for (let i = 0; same && i < words0.length; i++) if (words0[i] !== words1[i]) same = false;
  const fails: string[] = [];
  if (r !== null) fails.push('add() returned a decal while off');
  if (dc.count !== count0) fails.push(`count ${count0} → ${dc.count} while off (a round and a stun charge went off)`);
  if (dc.stats.uploads !== uploads0) fails.push(`uploads ${uploads0} → ${dc.stats.uploads} while off`);
  if (!same) fails.push('the packed words changed while off');
  dc.enabled = true; const r2 = dc.add('chip', [22.4, 1, 10.12], [0, 0, 1]); dc.frame(W.engine.world);
  if (!r2 || dc.stats.uploads !== uploads0 + 1) fails.push(`back on: add → ${!!r2}, uploads ${dc.stats.uploads} (want ${uploads0 + 1})`);
  F.verdict(!fails.length, `off: add() → null, a round + a stun charge left nothing (count ${dc.count - 1} + the one from before), frame() wrote nothing (uploads ${uploads0}), words identical; on again: recording and uploading resume`, fails.join('; ') || 'ok');
  // a Decals never handed to an engine (the viewer's case) is inert but harmless
  { const lone = new Decals(W.engine.device); lone.add('scorch', [1, 0, 1], [0, 1, 0]); lone.frame(W.engine.world); F.verdict(lone.count === 1 && lone.stats.uploads === 1, 'a free-standing Decals builds and uploads on its own device', `count ${lone.count}, uploads ${lone.stats.uploads}, build ${lone.stats.buildMs.toFixed(2)} ms`); }
  return F.done();
}

// ------------------------------------------------------------------------------------------------ (identity)
async function recordFight(seed: number, on: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.decals.enabled = on;
  game.godMode = true; game.aiEnabled = true; game.tune.carbineGuards = 'reyes';
  for (let i = 0; i < 5; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); const others = game.guards.filter((g: any) => g !== reyes);
  others.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer([23.5, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(reyes, [17.5, 0, 11.3], Math.PI / 2); W.step(DT); pl.visibility = 0.9;
  reyes.hold = false; reyes.pinned = true; reyes.dazzledUntil = -1; reyes.heardUpTo = 1e12; reyes.state = 'alert'; reyes.awareness = 1; reyes.reactT = 0; reyes.fireCd = 0.3; reyes.reloadT = -1; reyes.lastKnown = v3.copy(pl.char.pos); reyes.lastSeenT = game.time; resetChase(reyes);
  const audio: any[] = []; W.audioLog = audio;
  const rounds: string[] = []; const events: string[] = [];
  const seen = new WeakSet<any>();
  for (let f = 0; f < 15 * 60; f++) {
    pl.visibility = 0.9;
    if (f % 90 === 45) fireWeapon(game, pl.char, [17.4, 1.0 + (f % 3) * 0.1, 10.0], true);   // Sam puts rounds into the wall past him now and then
    W.step(DT);
    for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); events.push(`${e.kind}@${f}:${e.level ?? ''}:${e.who ?? ''}`); if (e.from && e.to) rounds.push(`${f}:${p2(e.from)}→${p2(e.to)}`); }
  }
  return { rounds, events, audio: audio.map(a => `${a.name}@${a.t.toFixed(3)}`), decals: game.decals.count, kinds: game.decals.list.reduce((m: any, d: any) => { m[d.kind] = (m[d.kind] ?? 0) + 1; return m; }, {}), reyes: reyes.state, down: pl.down };
}
export async function decalsIdentity(verbose = process.argv.includes('--verbose')) {
  const F = family('decals-identity: the same seeded 15 s fight with decals on and off is the same fight (rounds, events, audio) — the dice never touched — while on left its marks');
  const on = await recordFight(8501, true), off = await recordFight(8501, false);
  const fails: string[] = [];
  const cmp = (k: 'rounds' | 'events' | 'audio') => { const a = on[k], b = off[k]; if (JSON.stringify(a) !== JSON.stringify(b)) { let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++; fails.push(`${k} differ (on ${a.length} / off ${b.length}) from #${i}: on ${a[i] ?? '∅'} | off ${b[i] ?? '∅'}`); } };
  cmp('rounds'); cmp('events'); cmp('audio');
  if (on.rounds.length < 15) fails.push(`staging: only ${on.rounds.length} rounds flew`);
  if (!on.decals) fails.push('on: no marks at all after the fight');
  if (off.decals) fails.push(`off: ${off.decals} marks`);
  F.verdict(!fails.length, `${on.rounds.length} rounds, ${on.events.length} events, ${on.audio.length} audio calls either way; on left ${on.decals} marks ${JSON.stringify(on.kinds)}, off left ${off.decals}; Reyes ${on.reyes} | ${off.reyes}`, fails.join('; ') || 'identical');
  if (verbose) console.log(`  first rounds: ${on.rounds.slice(0, 3).join(' ')}`);
  return F.done();
}

export async function decalsFamily(): Promise<boolean> { let ok = true; for (const f of [decalsRing, decalsSites, decalsFollow, decalsOff, decalsIdentity]) ok = (await f()) && ok; return ok; }
