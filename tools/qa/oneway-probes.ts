// The 'oneway' family: EVERY DOOR OPENS ONE WAY (src/game/doors.ts DOORWAY, src/game/doorswing.ts; the maintainer, 10-08: "doors could use some work too. only open one
// direction"). Every door of every level a mission is played on (the office and each scenario's own level file), from BOTH faces, by every kind of opener — and
// after every step of every case the one invariant: the leaf's angle never leaves the side it opens into.
//   bun run tools/qa/probes.ts oneway | oneway-deal | oneway-night | oneway-read | oneway-leaf | oneway-player | oneway-men | oneway-save | oneway-off
// All headless; nothing here looks at a picture.
//   oneway-deal     the side every door was dealt and why (doorswing.ts): a door of a held room off a hall opens into the room, a drill plan's door the way its
//                   plan throws it, a keyed door away from its cylinder; the same deal on a second boot; the table printed
//   oneway-read     the read the sibling parts plan round (Doors.swingOf): hinge and handle a leaf apart, the leaf at every angle it can stand at inside its
//                   sweep, the mirrored floor on the far face outside it, pullFace = the face it opens into
//   oneway-leaf     the Doors themselves, every door × both faces × every opener: walked into (player; crouched; a keyed man = a teammate or a defender),
//                   run into (the player's sprint, an alert man's shoulder), used (Space: push / pull), eased, booted (kickIn), shoved by a drill's own write of
//                   Door.vel either way, slammed and pulled to, an angle written on the wrong side, a lock held against a keyless man. Each must OPEN (the man
//                   gets through / the leaf stands open) and never cross its frame
//                   (QA_FRAMEHOLDS=1 — doors.ts DOORWAY.frameHolds: the booted openers are split by face in the open; from the face it opens toward the
//                   leaf must stay home, its keep whole, a thud heard. The rule's own lines are the 'frameholds' family, frameholds-probes.ts)
//   oneway-player   the real player on his own feet (Game.update, the puppet's strings) through every door from both faces, and Space on its row from both
//   oneway-men      real men under the AI's own walk (a scripted goal: nav path, threadPath, their contacts): a teammate (operative) and a defender (hostile)
//                   through every door from both faces
//   oneway-save     a checkpoint made on double-acting leaves loaded on one-way doors: each leaf as wide on the side it opens into; a pull in hand survives a save
//   oneway-off      DOORWAY.oneWay off: the leaves double-acting as they were (pushed from either face they open away), the read still dealt
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORWAY, Doors } = await import(`${ROOT}/src/game/doors.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { isOfficeFamily, withOfficeScript } = await import(`${ROOT}/src/scene/level.ts`);
const { order, endGuardScript } = await import(`${ROOT}/src/game/squad.ts`);
const { spawnUnit, despawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const guarded = (fn: () => Promise<boolean>) => async () => { const was = DOORWAY.oneWay, out = DOORWAY.exitsOut; try { return await fn(); } finally { DOORWAY.oneWay = was; DOORWAY.exitsOut = out; } };

/** every level a mission is played on: the office (the bundled level) and each scenario's own file */
const LEVELS: (string | undefined)[] = [undefined, ...new Set<string>(SCENARIOS.map((e: any) => e.level).filter(Boolean))];
const nameOf = (f?: string) => f ? f.replace(/\.json$/, '') : 'office';
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
async function boot(file?: string, on = true, out = on && process.env.QA_EXITSOUT === '1'): Promise<any> { DOORWAY.oneWay = on; DOORWAY.exitsOut = out; Math.random = seeded(7);   // (outside doors opening outward ship OFF: the family runs as shipped, on them under QA_EXITSOUT=1; oneway-deal and oneway-night turn the switch themselves)   // (headless.ts stands the harness up on the old double-acting leaves: the family turns the shipped doors on, `guarded` puts back what it found)
  return quiet(() => standUp({ uploadEvery: 4, ...(file ? { level: levelOfFile(file) } : {}) })); }

/** a point off a door's face: `along` m from the hinge along the closed leaf, `off` m out of face `f` (Doors.side's sign) */
const off = (d: any, f: number, o: number, along = d.def.width * 0.55): [number, number, number] => { const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c); return [d.def.hinge[0] + ux * along - uz * o * f, 0, d.def.hinge[1] + uz * along + ux * o * f]; };
const faceWord = (d: any, f: number) => f === d.swing ? 'pull face' : 'push face';
/** the worst the leaf has stood on the side it does not open into (≥ 0 = never there) and the widest it has stood open */
/** …and whether doors.ts had to turn an angle round (Door.mirrored: keep() mirrors anything written on the far side before a reader sees it, so the angle alone
 *  could never show a crossing — the count does) */
class Watch { worst = Infinity; widest = 0; m0: number; bash = 0; constructor(private d: any) { this.m0 = d.mirrored; } see(d: any) { const a = d.angle * d.swing; if (a < this.worst) this.worst = a; if (a > this.widest) this.widest = a; } get crossed() { return this.worst < -1e-9 || this.d.mirrored > this.m0; } }
const fresh = (d: any, lock = false) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.locked = lock; d.place(); };

// ---------------------------------------------------------------- oneway-deal
export const onewayDeal = guarded(async () => {
  const F = family('oneway-deal: the side every door opens into, and why');
  let doors = 0; const whys: Record<string, number> = {}; const ext: any[] = [], planned: string[] = [], offBad: string[] = [], unmarked: string[] = []; let flipped = 0;
  for (const file of LEVELS) {
    const W = await boot(file, true, true), g = W.game, L = W.level, deals: any[] = g.doorSwings;   // (the switch ON: this probe is the outward rule's own)
    const rooms = L.scenarios?.roomClear?.rooms ?? [], plans = [...(L.breach ? [L.breach] : []), ...(L.clearPlans ?? [])];
    const bad: string[] = [];
    for (const d of g.doors.list) {
      doors++; const deal = deals.find(x => x.door === d.def.name); if (!deal || deal.swing !== d.swing) { bad.push(`${d.def.name}: no deal`); continue; }
      whys[deal.why] = (whys[deal.why] ?? 0) + 1;
      const into = g.doors.swingOf(d).into, c = d.frameCentre;
      // a door of exactly one held room, with nothing dealt before the room rule: a step into the side it opens into is inside that room
      const mine = rooms.filter((r: any) => r.doors.some((x: any) => x.id === d.def.name));
      if (deal.why === 'room' && mine.length === 1) { const B = mine[0].bounds, p = [c[0] + into[0] * 0.8, c[2] + into[1] * 0.8]; if (!(p[0] > B.x0 - 0.3 && p[0] < B.x1 + 0.3 && p[1] > B.z0 - 0.3 && p[1] < B.z1 + 0.3)) bad.push(`${d.def.name}: opens away from ${mine[0].id}`); }
      const P = plans.find((p: any) => p.door === d.def.name && p.fling); if (P && deal.why === 'plan' && Math.sign(P.fling) !== d.swing) bad.push(`${d.def.name}: against its plan's fling`);
      if (d.def.locked && deal.why === 'lock' && d.swing === d.keySide) bad.push(`${d.def.name}: opens onto its own cylinder's face`);
      // OUTSIDE DOORS OPEN OUTWARD (DOORWAY.exitsOut; doorswing.ts 'outside'). Asked of the level's SOLIDS by rays, not of the deal's own box test: straight up
      // from head height at nine points off each face — a face is under a roof when most are stopped, under the sky when at most two are. An `exterior` door with a
      // roof over one face only must open toward the sky (by this rule, or by an authored side / a folding stop that says the same); one roofed on both faces
      // or on neither is nobody's to turn, and no other door is ever dealt 'outside'.
      const base = g.doorDeals.find((x: any) => x.door === d.def.name);
      const sky = (f: number) => { let n = 0; for (const o of [0.8, 1.5, 2.2]) for (const al of [-0.4, 0, 0.4]) { const q = off(d, f, o, d.def.width / 2 + al); if (g.col.solidBlocked([q[0], 1.9, q[2]], [q[0], 12, q[2]], 0.02)) n++; } return n; };
      const rp = sky(1), rm = sky(-1), outSide = rp >= 6 && rm <= 2 ? -1 : rm >= 6 && rp <= 2 ? 1 : 0;   // (≤ 2: the lamp head on the wall over a fire exit stops one ray, and is no roof)
      if (d.def.exterior) {
        ext.push({ level: nameOf(file), door: d.def.name, before: base.swing, why0: base.why, into0: base.into, after: d.swing, why: deal.why, roof: [rp, rm], out: outSide });
        if (outSide && d.swing !== outSide) bad.push(`${d.def.name}: an outside door (roof ${rp}/9 on +, ${rm}/9 on −) opening INWARD by '${deal.why}'`);
        if (outSide && !['outside', 'authored', 'folds'].includes(deal.why)) bad.push(`${d.def.name}: outward by '${deal.why}', not by the rule`);
        if (!outSide && deal.why === 'outside') bad.push(`${d.def.name}: dealt 'outside' with roof ${rp}/9 on + and ${rm}/9 on −`);
        if (deal.why === 'outside') {   // …and the leaf has the room to swing out there: nothing solid of the level in the floor it sweeps (past its own frame)
          const hit: string[] = [], W = d.def.width, open = Math.abs(d.swing > 0 ? d.maxA : d.minA);
          for (let a = 0.3; a <= open + 1e-9; a += 0.1) for (const t of [0.35, 0.7, 1.0]) { const th = d.def.closedDir + d.swing * a, x = d.def.hinge[0] + Math.cos(th) * W * t, z = d.def.hinge[1] + Math.sin(th) * W * t;
            const bi = L.boxes.findIndex((b: any) => !(b.flags & 2) && b.c[1] - b.h[1] < 2.0 && b.c[1] + b.h[1] > 0.12 && Math.abs((x - b.c[0]) * Math.cos(b.yaw) - (z - b.c[2]) * Math.sin(b.yaw)) <= b.h[0] && Math.abs((x - b.c[0]) * Math.sin(b.yaw) + (z - b.c[2]) * Math.cos(b.yaw)) <= b.h[2]);
            if (bi >= 0 && !hit.includes(`box ${bi}`)) hit.push(`box ${bi}`); }
          if (hit.length) bad.push(`${d.def.name}: its leaf swings out through ${hit.join(', ')}`);
          const P2 = plans.find((p: any) => p.door === d.def.name && p.fling); if (P2 && Math.sign(P2.fling) !== d.swing) planned.push(`${nameOf(file)} ${d.def.name}`);
        }
      } else { if (deal.why === 'outside' || base.out) bad.push(`${d.def.name}: not an exterior door, dealt 'outside'`); if (outSide) unmarked.push(`${nameOf(file)} ${d.def.name} (${d.swing === outSide ? 'opens out already' : 'opens in'}, ${deal.why})`); }
      if (base.out ? base.out !== deal || base.why === 'outside' : base !== deal && JSON.stringify(base) !== JSON.stringify(deal)) bad.push(`${d.def.name}: the deal's two rows`);
      const stood = d.angle; d.reset(); if (Math.abs(d.angle - stood) > 1e-9 || Math.abs(Math.abs(d.angle) - Math.min(Math.abs(d.def.angle ?? 0), Math.abs(d.swing > 0 ? d.maxA : d.minA))) > 1e-9) bad.push(`${d.def.name}: authored standing at ${d.def.angle ?? 0}, dealt ${stood.toFixed(2)}, reset to ${d.angle.toFixed(2)}`);
      if (d.angle * d.swing < 0 || d.minA > 0 || d.maxA < 0 || (d.swing > 0 ? d.minA !== 0 : d.maxA !== 0)) bad.push(`${d.def.name}: stops [${d.minA}, ${d.maxA}] at ${d.angle} for swing ${d.swing}`);
    }
    const again = (await boot(file, true, true)).game.doorSwings; const same = JSON.stringify(again) === JSON.stringify(deals);
    // the switch off, live on the same game: every door back on the side the room rules deal it, not one 'outside' — and on again, as it was
    DOORWAY.exitsOut = false; for (const d of g.doors.list) { const b0 = g.doorDeals.find((x: any) => x.door === d.def.name), now = g.doorSwings.find((x: any) => x.door === d.def.name); if (d.swing !== b0.swing || now !== b0 || now.why === 'outside') offBad.push(`${nameOf(file)} ${d.def.name}`); }
    DOORWAY.exitsOut = true; for (const d of g.doors.list) if (d.swing !== deals.find(x => x.door === d.def.name).swing) offBad.push(`${nameOf(file)} ${d.def.name} (back on)`);
    // …and a leaf standing OPEN when the switch is flipped stands as wide on its other side at its next placing (Door.keep), never past the stop there — and back again
    for (const d of g.doors.list) { const b0 = g.doorDeals.find((x: any) => x.door === d.def.name); if (!b0.out || b0.out.swing === b0.swing) continue;
      const lim = () => Math.abs(d.swing > 0 ? d.maxA : d.minA), w = lim(), s1 = d.swing; d.angle = s1 * w; d.vel = 0; d.latched = false; d.place();   // (from its full stop: the other side's stop may be nearer, and is the clamp)
      DOORWAY.exitsOut = false; d.place(); const wOff = Math.min(w, lim()); if (d.swing === s1 || d.angle * d.swing <= 0 || Math.abs(Math.abs(d.angle) - wOff) > 1e-9) offBad.push(`${nameOf(file)} ${d.def.name} (stood open ${(s1 * w).toFixed(2)}, off: ${d.angle.toFixed(2)})`);
      DOORWAY.exitsOut = true; d.place(); if (d.swing !== s1 || d.angle * d.swing <= 0 || Math.abs(Math.abs(d.angle) - wOff) > 1e-9) offBad.push(`${nameOf(file)} ${d.def.name} (stood open, back on: ${d.angle.toFixed(2)})`);
      flipped++; d.reset(); }
    F.verdict(bad.length === 0 && same && deals.length === g.doors.list.length, `${nameOf(file)}: ${deals.length} doors, each dealt one side`, `${deals.map((x: any) => `${x.door} ${x.swing > 0 ? '+' : '−'} ${x.why}${x.into ? ` (${x.into})` : ''}`).join(' · ')}${bad.length ? `\n    WRONG: ${bad.join('; ')}` : ''}${same ? '' : '\n    a second boot dealt differently'}`);
  }
  F.verdict(doors > 0, `${doors} doors on ${LEVELS.length} levels`, Object.entries(whys).map(([k, n]) => `${k} ${n}`).join(' · '));
  // the outside doors, level by level: the side each opened into before the rule (the room rules' deal — what DOORWAY.exitsOut off still deals) and now
  const word = (e: any, s: number) => e.out ? (s === e.out ? 'OUT' : 'in') : (s > 0 ? '+' : '−');
  const turned = ext.filter(e => e.before !== e.after), left = ext.filter(e => e.why !== 'outside');
  // (the counts are a FLOOR, as of 10-08: a level that loses its `exterior` marks must fail here, not pass with nothing to check)
  F.verdict(ext.length >= 29 && turned.length >= 22 && turned.every(e => e.why === 'outside' && e.out === e.after) && flipped === turned.length && offBad.length === 0, `${ext.length} exterior doors: ${turned.length} turned to open outward, ${left.length} left as dealt; the switch off = the room rules' deal, door for door, and a leaf stood open follows a live flip (${flipped})`,
    `${ext.map(e => `${e.level} ${e.door}: ${word(e, e.before)} ${e.why0}${e.into0 ? ` (${e.into0})` : ''} → ${word(e, e.after)} ${e.why}  [roof ${e.roof[0]}/9 on +, ${e.roof[1]}/9 on −]`).join('\n    ')}\n    left as dealt: ${left.map(e => `${e.level} ${e.door} (${e.roof[0] >= 6 && e.roof[1] >= 6 ? 'a roof over both faces' : e.roof[0] <= 2 && e.roof[1] <= 2 ? 'open sky over both faces' : e.why})`).join(' · ') || 'none'}${planned.length ? `\n    a drill plan throws these the other way (its shove is turned round): ${planned.join(', ')}` : ''}${unmarked.length ? `\n    NOT marked exterior in their level, a roof over one face only (left to the room rules — a level's one-word call): ${unmarked.join(' · ')}` : ''}${offBad.length ? `\n    WRONG with the switch off: ${offBad.join('; ')}` : ''}`);
  return F.done();
});

// ---------------------------------------------------------------- oneway-night
/** THE NIGHT SHOWCASE AT THE FIRE EXIT. levels/office.script.ts walked its opening beat for a leaf that swings INTO the break room off Sam; with the exit opening OUTWARD he
 *  waits on its handle side instead, eases it toward him, goes in by the front of the opening and pulls it to behind him. Held here with the switch on: the leaf never
 *  comes within his own radius of him while he is outside it, the beat's notes land in order, the exit is shut and latched before the break-room chapter — and with the
 *  switch off the beat is the one first walked (his mark north of the frame, the leaf opening + into the room). */
export const onewayNight = guarded(async () => {
  const F = family('oneway-night: the night showcase goes in through a fire exit that opens outward');
  const beat = async (oneWay: boolean, out: boolean, secs: number) => { const W = await boot(undefined, oneWay, out); const { game: g, cam, input } = W; for (let i = 0; i < 30; i++) W.step(DT);
    const D = g.director; D.attach({ cam, input }); let finished: boolean | null = null; const prev = D.onProgramEnd; D.onProgramEnd = (n: string, f: boolean) => { prev?.(n, f); if (n === 'night') finished = f; };
    const err = D.start('night', { seed: 111 }); const serial = D.run?.serial; const d = g.doors.byName('fire_exit');
    const R = { err, staged: [...g.player.char.pos], swing: d.swing, notes: new Map<string, number>(), gap: Infinity, widest: 0, shutAt: -1, bad: [] as string[], pullFrom: -1, pullVel: 0, pulledF: -1, finished: null as boolean | null, t: 0 };
    for (let f = 0; f < secs * 60 && D.run && D.run.serial === serial && !D.run.ended; f++) { W.step(DT, D.frame?.look ?? null); const t = R.t = D.run?.t ?? R.t;
      if (f === 0) R.staged = [...g.player.char.pos];
      for (const r of D.rowsOf(serial)) if (r.kind === 'note' && !R.notes.has(r.what)) { R.notes.set(r.what, r.t); if (/capped|late|missed|watchdog/.test(r.what)) R.bad.push(`${r.what}@${r.t.toFixed(1)}`); }
      R.widest = Math.max(R.widest, Math.abs(d.angle));
      const p = g.player.char.pos, [hx, hz] = d.def.hinge, [ux, uz] = d.dir(), k = Math.max(0, Math.min(d.def.width, (p[0] - hx) * ux + (p[2] - hz) * uz));
      if (!d.latched && !R.notes.has('inside')) R.gap = Math.min(R.gap, Math.hypot(p[0] - hx - ux * k, p[2] - hz - uz * k));
      if (R.notes.has('door:pulled') && R.pulledF < 0) { R.pulledF = f; R.pullFrom = Math.hypot(p[0] - d.frameCentre[0], p[2] - d.frameCentre[2]); }
      if (R.pulledF >= 0 && f === R.pulledF + 20) R.pullVel = Math.abs(d.vel);   // (a third of a second after his hand: the pull's own spring has it moving — a closer alone creeps)
      if (R.shutAt < 0 && R.notes.has('door:pulled') && d.latched) R.shutAt = t; }
    R.finished = finished; if (D.run && D.run.serial === serial && !D.run.ended) D.stop(false); return R; };
  const order = ['ch:lot', 'ch:door', 'door:eased', 'inside', 'door:pulled', 'ch:breakroom'];
  const inOrder = (R: any) => order.every((n, i) => R.notes.has(n) && (i === 0 || R.notes.get(n) >= R.notes.get(order[i - 1])));
  const line = (R: any) => `staged (${R.staged[0].toFixed(2)}, ${R.staged[2].toFixed(2)}) · leaf to ${R.widest.toFixed(2)} rad on side ${R.swing} · ${order.map(n => `${n} ${R.notes.get(n)?.toFixed(2) ?? '—'}`).join(' · ')} · pulled from ${R.pullFrom.toFixed(2)} m off the frame, leaf at ${R.pullVel.toFixed(2)} rad/s a third of a second on · shut ${R.shutAt.toFixed(2)}${R.bad.length ? ` · ${R.bad.join(' ')}` : ''}${R.err ? ` · start refused: ${R.err}` : ''}`;
  const shut = (R: any) => R.shutAt > 0 && R.shutAt < R.notes.get('ch:breakroom')! && R.pullVel > 0.5 && !R.bad.length;
  // the switch ON (?exitsout), the WHOLE show (he comes back out past this door's lot at the end): to its end by itself, no mark he could not make
  const A = await beat(true, true, 300);
  F.verdict(A.err === null && A.swing === -1 && A.staged[2] > 21.18 && inOrder(A) && A.gap >= 0.3 && A.widest > 1.2 && shut(A) && A.pullFrom < 1.0 && A.finished === true,
    'the exit opening outward: Sam waits on its handle side, the leaf opens toward him without touching him, he draws it to from the threshold, and the show runs to its end',
    `${line(A)} · nearest the leaf came to him outside ${A.gap.toFixed(2)} m (his radius 0.30) · finished ${A.finished} at ${A.t.toFixed(1)} s`);
  const B = await beat(true, false, 31);
  F.verdict(B.err === null && B.swing === 1 && Math.abs(B.staged[2] - 20.0) < 1e-6 && inOrder(B) && shut(B), 'the switch off, as shipped: the beat as first walked (his mark north of the frame, the leaf into the room off him)', line(B));
  const C = await beat(false, false, 31);
  F.verdict(C.err === null && Math.abs(C.staged[2] - 20.0) < 1e-6 && inOrder(C) && shut(C) && ['door:eased', 'inside', 'door:pulled'].every(n => C.notes.get(n) === B.notes.get(n)), 'one-way doors off (double-acting leaves): the same first-walked beat, note for note', line(C));
  return F.done();
});

// ---------------------------------------------------------------- oneway-read
export const onewayRead = guarded(async () => {
  const F = family('oneway-read: Doors.swingOf — the jambs, the side, the floor the leaf sweeps');
  for (const file of LEVELS) {
    const g = (await boot(file)).game; const bad: string[] = []; let n = 0;
    for (const d of g.doors.list) {
      const R = g.doors.swingOf(d), W = d.def.width; n++;
      if (Math.abs(Math.hypot(R.handle[0] - R.hinge[0], R.handle[2] - R.hinge[2]) - W) > 1e-9 || R.radius !== W || R.swing !== d.swing || !R.oneWay) bad.push(`${d.def.name}: jambs`);
      if (!g.doors.pullFace(d, [d.frameCentre[0] + R.into[0], 0, d.frameCentre[2] + R.into[1]]) || !g.doors.pullFace(d, off(d, d.swing, 0.8)) || g.doors.pullFace(d, off(d, -d.swing, 0.8))) bad.push(`${d.def.name}: into / pullFace`);
      if (Math.abs(R.open - Math.abs(d.swing > 0 ? d.maxA : d.minA)) > 1e-9) bad.push(`${d.def.name}: open ${R.open}`);
      // the leaf at every angle it can stand at lies in the sweep; the same points mirrored through the frame do not (past a hand's width of the frame line)
      if (!(R.open >= 0.9)) { bad.push(`${d.def.name}: opens only ${R.open}`); continue; }
      for (let a = 0; a <= R.open + 1e-9; a += R.open / 12) for (const t of [0.2, 0.6, 1.0]) {
        const th = d.def.closedDir + d.swing * a, x = d.def.hinge[0] + Math.cos(th) * W * t, z = d.def.hinge[1] + Math.sin(th) * W * t;
        if (!R.sweeps(x, z, 0.01)) bad.push(`${d.def.name}: leaf at ${a.toFixed(2)} outside its sweep`);
        const tm = d.def.closedDir - d.swing * a, mx = d.def.hinge[0] + Math.cos(tm) * W * t, mz = d.def.hinge[1] + Math.sin(tm) * W * t;
        if (a > 0.3 && a < Math.PI - 0.3 && R.sweeps(mx, mz, 0.01)) bad.push(`${d.def.name}: the far face's floor at ${a.toFixed(2)} inside its sweep`);
      }
      if (R.sweeps(d.def.hinge[0] + Math.cos(d.def.closedDir + d.swing * 0.5) * (W + 0.5), d.def.hinge[1] + Math.sin(d.def.closedDir + d.swing * 0.5) * (W + 0.5), 0.3)) bad.push(`${d.def.name}: half a metre past the tip inside`);
    }
    F.verdict(bad.length === 0, `${nameOf(file)}: ${n} doors read`, bad.length ? [...new Set(bad)].slice(0, 6).join('; ') : 'hinge to handle = the leaf; the leaf at 13 angles × 3 stations inside the sweep, their mirror images outside; pullFace = the face it opens into');
  }
  return F.done();
});

// ---------------------------------------------------------------- oneway-leaf
interface Case { name: string; mirrors?: boolean; run: (g: any, d: any, f: number, w: Watch) => string | null }   // returns what went wrong, or null
let heard: string[] = [];   // the DoorSounds the case's door work emitted
const man = (d: any, f: number, o: number, over: any = {}) => ({ pos: off(d, f, o), radius: 0.34, bash: false, who: 10, quiet: false, ...over });
/** a contact walked straight through the doorway from face f at v m/s: null when he ends well past the far face */
function walk(g: any, d: any, f: number, w: Watch, c: any, v: number, secs = 6): string | null {
  const to = off(d, -f, 1.4); let t = 0;
  for (; t < secs; t += DT) { const dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], L = Math.hypot(dx, dz); if (L < 0.15) break; const s = Math.min(L, v * DT); c.pos[0] += dx / L * s; c.pos[2] += dz / L * s; g.doors.update(DT, [c]); w.see(d); }
  for (let i = 0; i < 30; i++) { g.doors.update(DT, [c]); w.see(d); }
  return Math.hypot(to[0] - c.pos[0], to[2] - c.pos[2]) < 0.3 ? null : `not through in ${secs} s (${Math.hypot(to[0] - c.pos[0], to[2] - c.pos[2]).toFixed(2)} m short, leaf at ${d.angle.toFixed(2)})`;
}
/** step the doors with men standing where they stand; null when the leaf has stood at least `open` open */
function stand(g: any, d: any, w: Watch, men: any[], secs: number, open: number, each?: () => void): string | null {
  for (let t = 0; t < secs; t += DT) { each?.(); g.doors.update(DT, men); w.see(d); }
  return w.widest >= open ? null : `stood open ${w.widest.toFixed(2)} at most (wanted ${open})`;
}
/** a body lying across the leaf's swing, against the foot of the shut leaf: three limp particles (game.ts's door contacts for a ragdoll) at 0.35 rad round from it */
const body = (d: any) => [0.35, 0.6, 0.85].map(k => { const th = d.def.closedDir + d.swing * 0.35, r = d.def.width * k; return { pos: [d.def.hinge[0] + Math.cos(th) * r, 0.12, d.def.hinge[1] + Math.sin(th) * r] as [number, number, number], radius: 0.12, bash: false, who: 20, quiet: true, weak: true }; });
/** null when no particle of the body is left inside the leaf where it stands (it was moved out of the way, not swung through) */
const clearOf = (d: any, b: { pos: number[]; radius: number }[]): string | null => { const u = d.dir(), [hx, hz] = d.def.hinge;
  for (const p of b) { const px = p.pos[0] - hx, pz = p.pos[2] - hz, t = Math.max(0, Math.min(d.def.width, px * u[0] + pz * u[1])), dist = Math.hypot(px - u[0] * t, pz - u[1] * t); if (dist < p.radius + d.thick / 2 - 0.03) return `the leaf stands ${(p.radius + d.thick / 2 - dist).toFixed(2)} m inside the body`; }
  return null; };
/** THE FRAME HOLDS (doors.ts DOORWAY.frameHolds — the harness stands with it off; QA_FRAMEHOLDS=1 runs this family on it): a boot at the face the shut leaf opens
 *  toward lands on a door backed by its frame. The booted cases then want, from that face, the leaf still home, its keep whole and the thud heard — and from the
 *  push face exactly what they always wanted. Asked BEFORE the boot (bootHolds reads the leaf as it stands). */
/** the frame holds a boot at face `f` of this (shut) door — read off how it is hung (Doors.side === Door.swing is its pull face), not off the function under test */
let heldCases = 0;
const holds = (d: any, f: number): boolean => { const h = DOORWAY.oneWay && DOORWAY.frameHolds && !d.def.steel && f === d.swing; if (h) heldCases++; return h; };
function heldBoot(g: any, d: any, w: Watch, men: any[], secs: number): string | null {
  stand(g, d, w, men, secs, 0);
  return w.widest > 0.01 ? `its frame should have held that boot: it stood open ${w.widest.toFixed(2)}` : d.lockBroken ? 'the frame held the boot and the keep broke all the same' : heard.includes('thud') ? null : 'the frame held the boot without a sound (no thud)';
}
const CASES: Case[] = [
  { name: 'walked into · player', run: (g, d, f, w) => walk(g, d, f, w, man(d, f, 1.0, { who: PLAYER_ID, keys: new Set() }), 1.6) },
  { name: 'walked into · player crouched', run: (g, d, f, w) => walk(g, d, f, w, man(d, f, 1.0, { who: PLAYER_ID, keys: new Set(), quiet: true }), 0.9, 9) },
  { name: 'sprinted into · player', run: (g, d, f, w) => walk(g, d, f, w, man(d, f, 1.6, { who: PLAYER_ID, keys: new Set(), bash: true }), 4.7) ?? (heard.includes('bash') ? null : 'no bash heard: a shoulder into it is loud from either face') },
  { name: 'walked into · teammate / defender', run: (g, d, f, w) => walk(g, d, f, w, man(d, f, 1.0, { key: true }), 1.6) },
  { name: 'run into · alert man', run: (g, d, f, w) => walk(g, d, f, w, man(d, f, 1.4, { key: true, bash: true }), 3.0) },
  { name: 'used (Space)', run: (g, d, f, w) => { const c = man(d, f, 0.8, { who: PLAYER_ID, keys: new Set() }); g.doors.use(d, c.pos, PLAYER_ID); return stand(g, d, w, [c], 1.5, 0.9); } },
  { name: 'eased', run: (g, d, f, w) => { const c = man(d, f, 0.8, { who: PLAYER_ID, keys: new Set(), quiet: true }); return stand(g, d, w, [c], 1.6, 0.55, () => g.doors.crack(d, c.pos, PLAYER_ID, DT)); } },
  { name: 'booted', run: (g, d, f, w) => { const k = g.doors.kickSpot(d, off(d, f, 0.8)); const c = man(d, f, 0.76, { pos: k.pos, key: true }); const held = holds(d, f); g.doors.kickIn(d, c.pos, c.who); return d.def.steel ? (stand(g, d, w, [c], 1.0, 0), w.widest > 0.01 ? 'a steel door gave to a boot' : null) : held ? heldBoot(g, d, w, [c], 1.2) : stand(g, d, w, [c], 1.2, 1.0); } },
  { name: 'booted, men on both faces', run: (g, d, f, w) => { if (d.def.steel) return null; const c = man(d, f, 0.76, { key: true }), far = man(d, -f, 0.7, { who: 11, key: true }), near = man(d, f, 0.9, { who: 12, key: true, pos: off(d, f, 0.9, d.def.width * 0.3) }); const held = holds(d, f); g.doors.kickIn(d, c.pos, c.who); return held ? heldBoot(g, d, w, [c, far, near], 1.5) : stand(g, d, w, [c, far, near], 1.5, 0.25); } },
  ...[7, -7, 3.2, -3.2].map((v): Case => ({ name: `shoved by a drill (vel ${v > 0 ? '+' : '−'}${Math.abs(v)})`, run: (g, d, f, w) => { const c = man(d, f, 0.7, { key: true }); d.latched = false; d.closing = false; d.vel = v; if (Math.abs(v) > 5) d.sinceBash = 0; d.quietT = -1; d.lastWho = c.who; return stand(g, d, w, [c], 1.5, 0.9); } })),   // (as doortools.ts / qrf.ts / director.ts write it: the velocity and whose hand it was)
  { name: 'swung into a man standing behind it', run: (g, d, f, w) => {   // pushed from its push face with somebody standing in its swing: it stops against him (never 'pulled' through him by his own contact). He stands 0.7 m out along the 0.75 rad line (60 % of a wide leaf): nearer the hinge of a real 0.86 m leaf his 0.34 m circle is already on the SHUT door, which is a man leaning on it, not one standing in its swing
      if (f === d.swing) return null; const th = d.def.closedDir + d.swing * 0.75, r = Math.max(d.def.width * 0.6, 0.7), st = man(d, -f, 0, { who: 11, key: true, pos: [d.def.hinge[0] + Math.cos(th) * r, 0, d.def.hinge[1] + Math.sin(th) * r] });
      const c = man(d, f, 1.0, { who: PLAYER_ID, keys: new Set() }), to = off(d, -f, 0.2);
      for (let t = 0; t < 2.5; t += DT) { const dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], L = Math.hypot(dx, dz); if (L > 0.05) { c.pos[0] += dx / L * Math.min(L, 1.6 * DT); c.pos[2] += dz / L * Math.min(L, 1.6 * DT); } const keepAt = [st.pos[0], st.pos[2]]; g.doors.update(DT, [st, c]); st.pos[0] = keepAt[0]; st.pos[2] = keepAt[1]; w.see(d); }
      return w.widest < 0.75 + 0.1 ? null : `went through him to ${w.widest.toFixed(2)} (he stands at 0.75)`; } },
  { name: 'booted into a man standing behind it', run: (g, d, f, w) => {
      if (f === d.swing || d.def.steel) return null; const th = d.def.closedDir + d.swing * 0.75, r = Math.max(d.def.width * 0.6, 0.7), st = man(d, -f, 0, { who: 11, key: true, pos: [d.def.hinge[0] + Math.cos(th) * r, 0, d.def.hinge[1] + Math.sin(th) * r] });
      const c = man(d, f, 0.76, { key: true }); g.doors.kickIn(d, c.pos, c.who);
      for (let t = 0; t < 1.5; t += DT) { const keepAt = [st.pos[0], st.pos[2]]; g.doors.update(DT, [st, c]); st.pos[0] = keepAt[0]; st.pos[2] = keepAt[1]; w.see(d); }
      return w.widest < 0.75 + 0.1 ? null : `went through him to ${w.widest.toFixed(2)} (he stands at 0.75)`; } },
  // A BODY LYING IN ITS SWING (a corpse's particles: weak contacts, free to slide) — a hand easing it, a man walking into it and a boot all move the body the same
  // way, from either face (an eased leaf used to stop on one from its push face while a push opened it: two-person stealth's finding, seeds block-squads:434 / 440)
  { name: 'eased, a body lying in its swing', run: (g, d, f, w) => { const c = man(d, f, 0.8, { who: PLAYER_ID, keys: new Set(), quiet: true }), b = body(d); return stand(g, d, w, [c, ...b], 2.2, 0.55, () => g.doors.crack(d, c.pos, PLAYER_ID, DT)) ?? clearOf(d, b); } },
  { name: 'walked into, a body lying in its swing', run: (g, d, f, w) => { const c = man(d, f, 1.0, { key: true }), b = body(d), to = off(d, -f, 0.25);
      for (let t = 0; t < 3; t += DT) { const dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], L = Math.hypot(dx, dz); if (L > 0.05) { c.pos[0] += dx / L * Math.min(L, 1.6 * DT); c.pos[2] += dz / L * Math.min(L, 1.6 * DT); } g.doors.update(DT, [c, ...b]); w.see(d); }
      return (w.widest >= 0.9 ? null : `stood open ${w.widest.toFixed(2)} at most (wanted 0.9)`) ?? clearOf(d, b); } },
  { name: 'booted, a body lying in its swing', run: (g, d, f, w) => { if (d.def.steel) return null; const k = g.doors.kickSpot(d, off(d, f, 0.8)); const c = man(d, f, 0.76, { pos: k.pos, key: true }), b = body(d); const held = holds(d, f); g.doors.kickIn(d, c.pos, c.who); return (held ? heldBoot(g, d, w, [c, ...b], 1.2) : stand(g, d, w, [c, ...b], 1.2, 1.0)) ?? clearOf(d, b); } },
  { name: 'shoved toward shut from open (a bare vel write)', run: (g, d, _f, w) => { const a = Math.min(1.5, Math.abs(d.swing > 0 ? d.maxA : d.minA)); if (a < 1.25) return null; d.latched = false; d.angle = d.swing * a; d.vel = 0; d.place(); d.vel = -d.swing * 6; stand(g, d, w, [], 8, 0); return d.latched && d.angle === 0 && w.widest < a + 0.01 ? null : `ended at ${d.angle.toFixed(3)}${d.latched ? '' : ', not latched'}, widest ${w.widest.toFixed(2)}`; } },
  { name: 'shoved from its pull face while ajar (the drills count it not open yet)', run: (g, d, f, w) => { if (f !== d.swing) return null; const c = man(d, f, 0.9, { key: true }); d.latched = false; d.angle = d.swing * 0.55; d.vel = 0; d.place(); d.vel = -d.swing * 3.2; d.lastWho = c.who; d.quietT = -1; const r = stand(g, d, w, [c], 1.5, 1.0); return r ?? (heard.includes('bang') || heard.includes('latch') ? 'it was driven onto its frame' : null); } },
  { name: 'latched with a pull still in hand: a lock is a wall again', run: (g, d, f, w) => { if (f !== d.keySide) return null; fresh(d, true); d.pullT = 0.6; const c = man(d, f, 1.0, { who: PLAYER_ID, keys: new Set() }); const r = walk(g, d, f, w, c, 1.6, 2); return r && w.widest < 0.01 ? null : 'he walked through a locked, latched leaf'; } },
  { name: 'slammed to from open', run: (g, d, _f, w) => { d.latched = false; d.angle = d.swing * 1.0; d.vel = -d.swing * 9; d.place(); stand(g, d, w, [], 2.5, 0); return d.latched && d.angle === 0 ? null : `ended at ${d.angle.toFixed(3)}${d.latched ? '' : ', not latched'}`; } },
  { name: 'pulled to from open', run: (g, d, _f, w) => { d.latched = false; d.angle = d.swing * 1.2; d.vel = 0; d.place(); g.doors.pullTo(d, 10); stand(g, d, w, [], 8, 0); return d.latched && d.angle === 0 ? null : `ended at ${d.angle.toFixed(3)}${d.latched ? '' : ', not latched'}`; } },
  { name: 'an angle written on the far side', mirrors: true, run: (g, d, _f, w) => { d.latched = false; d.angle = -d.swing * 1.2; d.vel = 0; d.quietT = -3600; d.place(); w.see(d); stand(g, d, w, [], 0.2, 0); return d.angle * d.swing > 1.0 ? null : `stands at ${d.angle.toFixed(2)}`; } },
  { name: 'locked against a keyless man', run: (g, d, f, w) => { fresh(d, true); const c = man(d, f, 1.0, { who: PLAYER_ID, keys: new Set() }); const r = walk(g, d, f, w, c, 1.6, 3);
      return f === d.keySide ? (r && w.widest < 0.01 ? null : 'a lock on his face let him through') : r; } },
];
export const onewayLeaf = guarded(async () => {
  const F = family('oneway-leaf: every door, both faces, every opener — it opens, and never through its frame');
  let total = 0, crossedAll = 0; heldCases = 0;
  for (const file of LEVELS) {
    const g = (await boot(file)).game; const fails: string[] = []; let n = 0, crossed = 0, worst = 0;
    heard = []; const emit0 = g.doors.emit; g.doors.emit = (e: any) => { heard.push(e.sound); emit0(e); };
    for (const d of g.doors.list) for (const f of [1, -1]) for (const C of CASES) {
      fresh(d); const w = new Watch(d); w.see(d); heard.length = 0; let why = C.run(g, d, f, w); n++;
      if (C.mirrors) { if (!w.crossed) why = 'the watch did not see an angle written on the far side'; w.m0 = d.mirrored; w.worst = 0; }   // (the one case that MAKES a crossing: the check must see it)
      if (w.crossed) { crossed++; worst = Math.min(worst, w.worst); }
      if (why || w.crossed) fails.push(`${d.def.name} ${faceWord(d, f)} · ${C.name}: ${w.crossed ? `CROSSED its frame by ${(-w.worst).toFixed(3)} rad` : why}`);
      fresh(d, !!d.def.locked);
    }
    total += n; crossedAll += crossed;
    F.verdict(fails.length === 0, `${nameOf(file)}: ${g.doors.list.length} doors × 2 faces × ${CASES.length} openers = ${n} cases`, fails.length ? `${fails.length} wrong — ${fails.slice(0, 8).join('\n    ')}${fails.length > 8 ? `\n    … and ${fails.length - 8} more` : ''}` : 'every case opened (or held, where it should) and the leaf never left the side it opens into');
  }
  F.verdict(crossedAll === 0, `${total} cases on ${LEVELS.length} levels: the leaf crossed its frame in ${crossedAll}`, 'checked after every step of every case: angle × swing ≥ 0');
  if (DOORWAY.frameHolds) F.verdict(heldCases > 0, 'QA_FRAMEHOLDS=1: the booted openers at the face a door opens toward were held to the frame (leaf home, keep whole, a thud), by how the door is hung', `${heldCases} booted cases expected held`);
  return F.done();
});

// ---------------------------------------------------------------- oneway-player / oneway-men: real feet through Game.update
/** both faces of a door a man can stand on and walk from: free floor 1.1 m off the leaf's middle and 1.5 m beyond it */
const spots = (g: any, d: any, f: number): { from: number[]; to: number[] } | null => { const from = off(d, f, 1.1), to = off(d, -f, 1.5); const nav = g.col.nav; return nav.isBlocked(from[0], from[2]) || nav.isBlocked(to[0], to[2]) || nav.isBlocked(...(off(d, f, 0.6) as number[]).filter((_, i) => i !== 1) as [number, number]) ? null : { from, to }; };
function clearFloor(g: any) { g.godMode = true; g.playerInvisible = true; g.tune.civilians = false; for (const gd of [...g.guards]) if (gd.unit) despawnUnit(g, gd); g.guards.length = 0; }   // nobody but who the case stands
export const onewayPlayer = guarded(async () => {
  const F = family('oneway-player: Sam on his own feet through every door, both faces; Space on its row');
  let crossedAll = 0;
  for (const file of LEVELS) {
    const W = await boot(file), g = W.game; clearFloor(g); const fails: string[] = []; let n = 0, skipped = 0, rows = 0;
    let m0 = 0; const marks = () => g.doors.list.reduce((n: number, x: any) => n + x.mirrored, 0), all = () => { let c = 0; for (const x of g.doors.list) if (x.angle * x.swing < -1e-9) c++; const m = marks(); c += m - m0; m0 = m; return c; };
    for (const d of g.doors.list) for (const f of [1, -1]) {
      const S = spots(g, d, f); if (!S) { skipped++; continue; }
      // (a) walked through
      for (const x of g.doors.list) fresh(x); let crossed = 0; n++; m0 = marks();
      g.teleportPlayer(S.from); g.puppet = { goal: S.to as any, aim: null }; let t = 0, through = false;
      for (; t < 7 && !through; t += DT) { W.step(DT); crossed += all(); through = Math.hypot(g.player.char.pos[0] - S.to[0], g.player.char.pos[2] - S.to[2]) < 0.35; }
      g.puppet = null;
      if (crossed) crossedAll++;
      if (!through || crossed) fails.push(`${d.def.name} ${faceWord(d, f)} · walked: ${crossed ? 'a leaf CROSSED its frame' : `not through in 7 s (at ${g.player.char.pos[0].toFixed(1)}, ${g.player.char.pos[2].toFixed(1)}, leaf ${d.angle.toFixed(2)})`}`);
      // (b) its row, tapped: the door stands open on the side it opens into
      for (const x of g.doors.list) fresh(x); g.teleportPlayer(off(d, f, 0.75)); W.step(DT); W.step(DT); m0 = marks();
      const rowOf = g.nearby.find((x: any) => x.door === d && x.verb === 'push'), want = f === d.swing ? 'pull it open' : 'push it open';
      if (rowOf && !rowOf.line2.includes(want)) fails.push(`${d.def.name} ${faceWord(d, f)} · its row reads "${rowOf.line2}" (want '${want}')`);
      if (g.selectVerb('door', 'push')) { rows++; W.input.pressed.add('Space'); let widest = 0, cr = 0; for (let i = 0; i < 90; i++) { W.step(DT); cr += all(); widest = Math.max(widest, d.angle * d.swing); }
        if (cr) crossedAll++; if (cr || widest < 0.8) fails.push(`${d.def.name} ${faceWord(d, f)} · Space: ${cr ? 'a leaf CROSSED its frame' : `stood open ${widest.toFixed(2)} at most`}`); }
    }
    F.verdict(fails.length === 0 && n > 0, `${nameOf(file)}: ${n} walks through ${g.doors.list.length} doors (${skipped} faces with no floor to stand on), ${rows} rows tapped`, fails.length ? fails.slice(0, 8).join('\n    ') + (fails.length > 8 ? `\n    … and ${fails.length - 8} more` : '') : 'through every one, each leaf on its own side throughout');
  }
  F.verdict(crossedAll === 0, `a leaf crossed its frame in ${crossedAll} cases`, 'every door of the level checked after every frame');
  return F.done();
});
export const onewayMen = guarded(async () => {
  const F = family('oneway-men: a teammate and a defender on the AI\'s own walk through every door, both faces');
  let crossedAll = 0;
  for (const file of LEVELS) {
    const W = await boot(file), g = W.game; clearFloor(g); g.teleportPlayer(g.level?.playerSpawn ?? g.player.char.pos); const fails: string[] = []; let n = 0, skipped = 0;
    let m0 = 0; const marks = () => g.doors.list.reduce((n: number, x: any) => n + x.mirrored, 0), all = () => { let c = 0; for (const x of g.doors.list) if (x.angle * x.swing < -1e-9) c++; const m = marks(); c += m - m0; m0 = m; return c; };
    for (const team of ['operative', 'hostile'] as const) for (const d of g.doors.list) for (const f of [1, -1]) {
      const S = spots(g, d, f); if (!S) { skipped++; continue; }
      for (const x of g.doors.list) fresh(x); n++; m0 = marks();
      const gd = spawnUnit(g, { team, pos: S.from as any, yaw: 0 }); if (team === 'hostile') { gd.hold = false; gd.pinned = false; W.step(DT); }   // (off the room fight's roster — roomfight.ts takes every held hostile for its own and ends his script — and onto his own feet)
      order(gd, { goal: S.to as any });
      let t = 0, through = false, crossed = 0;
      for (; t < 9 && !through; t += DT) { W.step(DT); crossed += all(); through = Math.hypot(gd.char.pos[0] - S.to[0], gd.char.pos[2] - S.to[2]) < 0.5; }
      if (crossed) crossedAll++;
      if (!through || crossed) fails.push(`${d.def.name} ${faceWord(d, f)} · ${team}: ${crossed ? 'a leaf CROSSED its frame' : `not through in 9 s (at ${gd.char.pos[0].toFixed(1)}, ${gd.char.pos[2].toFixed(1)}, leaf ${d.angle.toFixed(2)})`}`);
      endGuardScript(gd); despawnUnit(g, gd);
    }
    F.verdict(fails.length === 0 && n > 0, `${nameOf(file)}: ${n} walks (${skipped} faces with no floor to stand on)`, fails.length ? fails.slice(0, 8).join('\n    ') + (fails.length > 8 ? `\n    … and ${fails.length - 8} more` : '') : 'through every one, each leaf on its own side throughout');
  }
  F.verdict(crossedAll === 0, `a leaf crossed its frame in ${crossedAll} cases`, 'every door of the level checked after every frame');
  return F.done();
});

// ---------------------------------------------------------------- oneway-save
export const onewaySave = guarded(async () => {
  const F = family('oneway-save: a checkpoint from before the doors had one side; a pull in hand across a save');
  const W0 = await boot(undefined, false); const old = JSON.parse(JSON.stringify(W0.snapshot('two-way', true)));   // the office on double-acting leaves: the manager's door ajar at +0.7, the break room's at +1.35
  const W = await boot(), g = W.game; W.restore(old); const bad: string[] = []; let turned = 0;
  for (const D of old.doors) { const d = g.doors.byName(D.name), open = Math.abs(d.swing > 0 ? d.maxA : d.minA), want = Math.min(Math.abs(D.angle), open);
    if (D.angle * d.swing < 0) turned++;
    if (Math.abs(d.angle * d.swing - want) > 1e-9 || d.latched !== !!D.latched) bad.push(`${D.name}: saved ${D.angle}${D.latched ? ' latched' : ''}, loaded ${d.angle.toFixed(2)}${d.latched ? ' latched' : ''} (opens ${d.swing > 0 ? '+' : '−'})`); }
  const at = g.doors.list.map((d: any) => d.angle); for (let i = 0; i < 120; i++) W.step(DT);
  g.doors.list.forEach((d: any, i: number) => { if (d.def.closer === false && Math.abs(d.angle - at[i]) > 1e-6) bad.push(`${d.def.name}: moved to ${d.angle.toFixed(2)} in the two seconds after the load`); });
  F.verdict(bad.length === 0 && turned > 0, `a two-way save loaded on one-way doors: ${old.doors.length} doors, ${turned} of them saved open on the far side`, bad.length ? bad.join('; ') : 'each stands as wide on the side it opens into, latched only if it was, and stays there');
  const d = g.doors.byName('storage'); fresh(d); d.latched = false; d.angle = d.swing * 0.3; d.vel = d.swing * 2; d.pullT = 0.4; d.place();
  const mid = JSON.parse(JSON.stringify(W.snapshot('mid-pull', true))), row = mid.doors.find((x: any) => x.name === 'storage'); W.restore(mid); const d2 = g.doors.byName('storage');
  F.verdict(row.pullT === 0.4 && d2.pullT === 0.4 && Math.abs(d2.angle - d.swing * 0.3) < 1e-9, 'a leaf being pulled open when the game is saved is still being pulled when it loads', `saved pullT ${row.pullT}, loaded ${d2.pullT} at ${d2.angle.toFixed(2)}`);
  F.verdict(row.pressT !== undefined && row.openT !== undefined, 'the press and driven clocks ride the row too', `pressT ${row.pressT}, openT ${row.openT}`);
  d2.pullT = 0.3; DOORWAY.oneWay = false; const plain = JSON.parse(JSON.stringify(W.snapshot('two-way again', true)));   // the same game — a pull in hand and all — saved with the switch off
  F.verdict(!plain.doors.some((x: any) => 'pullT' in x || 'pressT' in x || 'openT' in x) && Object.keys(plain.doors[0]).join() === Object.keys(old.doors[0]).join(), 'with the switch off a save carries nothing new', `${plain.doors.length} door rows with the base's keys: ${Object.keys(plain.doors[0]).length} of them`);
  return F.done();
});

// ---------------------------------------------------------------- oneway-off
export const onewayOff = guarded(async () => {
  const F = family('oneway-off: DOORWAY.oneWay off — the double-acting leaves as they were');
  for (const file of [undefined, 'warehouse.json']) {
    const g = (await boot(file, false)).game; const bad: string[] = []; let n = 0;
    for (const d of g.doors.list) {
      if (d.minA !== d.minAuth || d.maxA !== d.maxAuth) bad.push(`${d.def.name}: stops`);
      if (g.doors.swingOf(d).oneWay) bad.push(`${d.def.name}: the read says one-way`);
      for (const f of [1, -1]) { fresh(d); const w = new Watch(d); const c = man(d, f, 1.0, { key: true }); const r = walk(g, d, f, w, c, 1.6); n++;
        let far = 0; fresh(d); const c2 = man(d, f, 1.0, { key: true }), to = off(d, -f, 1.4); for (let t = 0; t < 2; t += DT) { const dx = to[0] - c2.pos[0], dz = to[2] - c2.pos[2], L = Math.hypot(dx, dz); if (L > 0.15) { c2.pos[0] += dx / L * 1.6 * DT; c2.pos[2] += dz / L * 1.6 * DT; } g.doors.update(DT, [c2]); if (Math.abs(d.angle) > Math.abs(far)) far = d.angle; }
        if (r || Math.sign(far) !== -f) bad.push(`${d.def.name} face ${f}: ${r ?? `opened to ${far.toFixed(2)}, not away from him`}`); fresh(d, !!d.def.locked); }
    }
    F.verdict(bad.length === 0, `${nameOf(file)}: ${n} pushes, each leaf away from the man whichever face he is on`, bad.length ? bad.slice(0, 6).join('; ') : 'authored stops both ways; pushed from + it opens −, from − it opens +');
  }
  return F.done();
});
