// The 'glasspen' probe family (`bun run tools/qa/probes.ts glasspen | glasspen-player | glasspen-ai | glasspen-rule | glasspen-lines | glasspen-near | glasspen-off`;
// all but -off also ride 'glass'): ROUNDS THROUGH GLASS (src/game/glasspen.ts, rebuild/glass/penetration.md) — a round that meets a sheet of glass goes on through
// it with some of its energy gone and a small turn, and hits what is behind, whoever fired it; the line of FIRE (col.shotBlocked → guards.ts clearShot) answers by
// the same toll, so a man shoots through a window exactly when his round would get through it; the switch off is the game as it was. Staged on the real game stood
// up headless (headless.ts — which stands the switch at OFF: each probe raises it and puts it back), PASS / FAIL each with the numbers.
import { standUp, ROOT } from './headless.ts';
import { floatPartition } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { lineBox } = await import(`${ROOT}/src/scene/collision.ts`);
const { glassPanes, isSheet } = await import(`${ROOT}/src/game/glass.ts`);
const P = await import(`${ROOT}/src/game/glasspen.ts`);
const { GLASSPEN, GLASSPEN_STATS, GLASSPEN_HOOKS, glassPenLive, roundPath, paneToll, paneType, roundEnergy, holeCount } = P;
const { fireWeapon, armThrough } = await import(`${ROOT}/src/game/combat.ts`);
const { glassBreakLive } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { resetChase, clearShot, shotOrigin } = await import(`${ROOT}/src/game/guards.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function mkVerdict(): { verdict: Verdict; all: () => boolean } { let allPass = true; return { verdict: (ok, label, detail) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, all: () => allPass }; }
let WANT: boolean | null = null;   // the switch the probe in hand runs under — re-applied after every stand-up (standGame's harness block puts it at off)
/** run `fn` with the switch at `on` (and anything else in `knobs`), every knob put back whatever happens */
async function withPen<T>(on: boolean, fn: () => Promise<T>, knobs: Record<string, number> = {}): Promise<T> {
  const was = GLASSPEN.on; const old: Record<string, number> = {}; for (const k in knobs) { old[k] = (GLASSPEN as any)[k]; (GLASSPEN as any)[k] = knobs[k]; }
  const hook = GLASSPEN_HOOKS.crossed; const wantWas = WANT; GLASSPEN.on = WANT = on;
  try { return await fn(); } finally { GLASSPEN.on = was; WANT = wantWas; GLASSPEN_HOOKS.crossed = hook; for (const k in old) (GLASSPEN as any)[k] = old[k]; }
}

function parkFrom(game: any, keep: number) {
  game.guards.slice(keep).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
}
function placeGuard(gd: any, p: Vec3, face: Vec3, hold = true) {
  gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0;
  gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.reactT = 0; gd.searchT = 0; gd.task = null; gd.bodyDuty = null; gd.path = []; gd.pathGoal = null; gd.hold = hold; gd.pinned = false; gd.dazzledUntil = -1; gd.heardUpTo = 0;
  gd.char.update(0); gd.char.update(DT);
}
/** a man who stands where he is put and notices nothing (the target of a staged round) */
function dummy(gd: any, p: Vec3, face: Vec3) { placeGuard(gd, p, face); gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
function armAlert(gd: any, game: any, fix: Vec3) {
  gd.hold = false; gd.pinned = false; gd.dazzledUntil = -1; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = 0.2; gd.weapon.rearm(); gd.reloadT = -1;
  gd.lastKnown = v3.copy(fix); gd.lastSeenT = game.time; gd.ledT = game.time; gd.stuckT = 0; resetChase(gd);
}
async function floor(seed: number, sam: Vec3) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; floatPartition(game); if (WANT !== null) GLASSPEN.on = WANT;
  game.godMode = true; game.aiEnabled = true; game.playerInvisible = false; game.infiniteAmmo = true;
  game.teleportPlayer(v3.copy(sam)); game.player.visibility = 0; game.player.crouch = false;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.player.visibility = 0;
  return W;
}
function gunUp(W: any, slot: 'pistol' | 'rifle') { const pl = W.game.player; pl.slot = slot; pl.holstered = false; for (let i = 0; i < 40; i++) W.step(DT); }
const chestOf = (c: any): Vec3 => { const tr = c.bones.spine2 ?? c.bones.hips; return [tr ? tr[0] : c.pos[0], c.pos[1] + 1.25, tr ? tr[2] : c.pos[2]]; };
/** the office's panes by type: the conference partition (z 10, x < 14: plain float), the manager's sidelight (laminated), the lobby frontage (tempered) */
function officePanes(game: any) {
  const all: number[] = glassPanes(game).filter((bi: number) => isSheet(game.level.boxes[bi]));
  const of = (t: string) => all.filter((bi: number) => paneType(game, game.level.boxes[bi]) === t);
  const conf = all.filter((bi: number) => { const b = game.level.boxes[bi]; return Math.abs(b.c[2] - 10) < 0.05 && b.c[0] < 14; }).sort((a: number, b: number) => game.level.boxes[a].c[0] - game.level.boxes[b].c[0]);
  return { all, conf, annealed: of('annealed'), tempered: of('tempered'), laminated: of('laminated') };
}
const lastOf = (game: any, ev0: number, kind: string) => game.events.slice(ev0).filter((e: any) => e.kind === kind).pop();
const stars = (game: any) => game.decals.list.filter((d: any) => d.kind === 'glassHit');

// ================================================================ (a) the player's round
export async function glasspenPlayer(): Promise<boolean> {
  console.log('\n=== glasspen-player: Sam on the corridor fires at a man standing in the conference room, the partition glass between them — the round goes THROUGH the pane (its star, its crack, its \'glass\' event at the pane) and drops the man; pistol and rifle; a second round by the first one\'s hole flies truer (and, the pane\'s fracture model live, through the open glass it left); the same shot in a fresh world flies the same path ===');
  const { verdict, all } = mkVerdict();
  await withPen(true, async () => {
    for (const slot of ['pistol', 'rifle'] as const) {
      const run = async (seed: number, fracture?: boolean) => {   // (fracture: the pane's fracture model put on / off for this world after its stand-up; not said = as the stand has it)
        const W = await floor(seed, [7.5, 0, 11.6]); const { game, audioCounts } = W;
        if (fracture !== undefined) { game.tune.glassBreak = fracture; if (fracture && !(game.tune.chaos > 0)) game.tune.chaos = 0.5; }   // (the harness stands the floor at chaos 0, where nothing breaks: glasspen-near's restore check raises it the same way)
        parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 6.8], [7.5, 0, 11.6]);
        for (let i = 0; i < 5; i++) W.step(DT);
        gunUp(W, slot); const pc = game.player.char; const def = (game.player.gunInHand() ?? game.player.pistol).def;
        const crossed: any[] = []; GLASSPEN_HOOKS.crossed = (_g: any, x: any) => crossed.push(x);
        const ev0 = game.events.length, s0 = stars(game).length, c0 = audioCounts.get('glassCrack') ?? 0;
        const target = chestOf(gd.char); const live = glassPenLive(game);
        fireWeapon(game, pc, target, true);
        const shot = lastOf(game, ev0, 'shot'), glass = lastOf(game, ev0, 'glass');
        return { W, game, gd, def, crossed, shot, glass, target, live, stars: stars(game).length - s0, cracks: (audioCounts.get('glassCrack') ?? 0) - c0, pc };
      };
      const R = await run(4411); const x = R.crossed[0];
      verdict(R.live && R.crossed.length === 1 && !!R.shot && R.shot.to[2] < 9.5 && R.gd.state === 'dead' && v3.dist(R.shot.to, R.target) < 0.6,
        `${slot} (${R.def.id}, energy ${f2(roundEnergy(R.def))}): the round crossed ONE pane and stopped in the man 3.2 m beyond it — he is down`,
        `muzzle (${R.shot.from.map(f2)}) → stopped (${R.shot.to.map(f2)}), ${f2(v3.dist(R.shot.to, R.target))} m from the point aimed at · guard ${R.gd.state} · pane ${x?.bi} ${x?.type}: energy ${f2(x?.eIn ?? 0)} → ${f2(x?.eOut ?? 0)}, turned ${f3(x?.turnDeg ?? 0)}°, entry (${x?.at.map(f2)}) exit (${x?.exit.map(f2)})`);
      verdict(R.stars === 1 && R.cracks === 1 && !!R.glass && Math.abs(R.glass.pos[2] - 10) < 0.05 && holeCount(R.game, x.bi) === 1 && Math.abs(x.at[2] - 10) < 0.02 && Math.abs(x.exit[2] - 10) < 0.02 && x.at[2] > x.exit[2],
        'the pane got the impact call once, at the ENTRY face: one star, one crack heard, one \'glass\' hearing event at the glazing; the hole is remembered; the hook carried entry (corridor face) and exit (room face)',
        `stars +${R.stars} · glassCrack ×${R.cracks} · event ${R.glass ? `level ${R.glass.level} at (${f2(R.glass.pos[0])}, ${f2(R.glass.pos[2])})` : 'none'} · holes on pane ${holeCount(R.game, x.bi)} · entry z ${f3(x.at[2])} exit z ${f3(x.exit[2])}`);
      // the turn is inside the cone the rule allows, and the same shot in a fresh world flies the same path
      const cone = GLASSPEN.deflectDeg * (x.take / x.eIn) * (1 + GLASSPEN.bendK);
      const R2 = await run(4411);
      verdict(x.turnDeg <= cone + 1e-6 && x.turnDeg > 0 && v3.dist(R.shot.to, R2.shot.to) < 1e-9 && Math.abs(R2.crossed[0].turnDeg - x.turnDeg) < 1e-12,
        'the turn at the pane is inside the rule\'s cone and DETERMINISTIC: the same shot in a fresh world stops at the same point to the last bit', `turned ${f3(x.turnDeg)}° ≤ ${f3(cone)}° · stops differ by ${v3.dist(R.shot.to, R2.shot.to).toExponential(1)} m`);
      // a second round at a second man where the first one went through — asked BOTH ways on every stand, each in a fresh world of its own:
      //   the fracture model off (as the frozen stand has it; the page under ?glassbreak=0): the sheet stands and the hole is the toll rule's own memory — a quarter of the toll,
      //   a quarter of the turn;
      //   the fracture model live (as the shipped stand has it): a round that went through has OPENED the glass where it passed (glassbreak.ts impact, through) — round 2 meets
      //   no pane there at all: no crossing, no toll, no new star, nothing heard from the glass.
      const second = async (fracture: boolean) => {
        const A = await run(4411, fracture); const a = A.crossed[0]; const g2 = A.game.guards[1]; dummy(g2, [7.5, 0, 6.8], [7.5, 0, 11.6]); g2.flashlight.enabled = false;
        const live = glassBreakLive(A.game), open = !!a && A.game.glassBreak.openAt(a.bi, a.at), s1 = stars(A.game).length;
        A.crossed.length = 0; const ev1 = A.game.events.length; fireWeapon(A.game, A.pc, A.target, true);
        return { a, y: A.crossed[0], crossings: A.crossed.length, shot2: lastOf(A.game, ev1, 'shot'), glass2: lastOf(A.game, ev1, 'glass'), live, open, s1, s2: stars(A.game).length, g2 };
      };
      { const S = await second(false); const { a, y } = S;
        verdict(!S.live && !S.open && !!a && !!y && y.hole && Math.abs(y.take - a.take * GLASSPEN.holeK) < 1e-9 && y.turnDeg < a.turnDeg && !!S.shot2 && S.shot2.to[2] < 9.5 && S.g2.state === 'dead',
          'round 2 on the same line goes through the HOLE round 1 made: a quarter of the toll, less turn, and on into the room', a && y ? `toll ${f3(a.take)} → ${f3(y.take)} · turn ${f3(a.turnDeg)}° → ${f3(y.turnDeg)}° · stopped (${S.shot2?.to.map(f2)}) · 2nd man ${S.g2.state} · fracture model live ${S.live}` : `no crossing (round 1 ${a ? 'crossed' : 'did NOT cross'}) · fracture model live ${S.live} · glass open ${S.open}`); }
      { const S = await second(true);
        verdict(S.live && S.open && !S.y && !S.glass2 && S.s2 === S.s1 && !!S.shot2 && S.shot2.to[2] < 9.5 && S.g2.state === 'dead',
          'the same two rounds with the pane\'s fracture model LIVE (as the page ships): round 1 OPENED the glass where it went through, so round 2 meets no pane there — no crossing, no toll, no new star, nothing heard from the glass — and flies on into the second man',
          `fracture model live ${S.live} · glass open at round 1's entry ${S.open} · crossings ${S.crossings} · 'glass' event ${S.glass2 ? 'YES' : 'none'} · stars ${S.s1} → ${S.s2} · stopped (${S.shot2?.to.map(f2)}) · 2nd man ${S.g2.state}`); }
    }
  });
  return all();
}

// ================================================================ (b) an AI shooter
export async function glasspenAi(): Promise<boolean> {
  console.log('\n=== glasspen-ai: a man alert on the corridor with Sam lit and still in the conference room, only the pane between them — his line of FIRE is clear through the glass by his own gun\'s energy, he stands and fires through it, and his rounds reach Sam; with the switch off the same man has no shot there (the base) ===');
  const { verdict, all } = mkVerdict();
  const duel = async (seed: number, secs: number) => {
    const sam: Vec3 = [12.0, 0, 7.0], at: Vec3 = [12.0, 0, 11.2];
    const W = await floor(seed, sam); const { game, audioCounts } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    for (const dd of game.doors.list) dd.reset();
    game.teleportPlayer(v3.copy(sam)); game.player.visibility = 0.85; game.puppet = { goal: v3.copy(sam), aim: [at[0], 1.2, at[2]] };
    placeGuard(gd, at, sam, false); gd.char.anim.upper = 'aim'; gd.char.update(0); gd.char.update(DT); armAlert(gd, game, game.player.char.pos);
    const lineAt0 = clearShot(game, gd.char, chestOf(game.player.char)), sightAt0 = !game.col.segmentBlocked(shotOrigin(gd.char), chestOf(game.player.char)), solidAt0 = game.col.solidBlocked(shotOrigin(gd.char), chestOf(game.player.char));
    let rounds = 0, through = 0, firstHit = -1, ground = 0, last = v3.copy(gd.char.pos); const t0 = game.time, c0 = audioCounts.get('glassCrack') ?? 0; let seenEv = game.events.length; const p0 = v3.copy(gd.char.pos);
    for (let f = 0; f < 60 * secs; f++) {
      W.step(DT);
      for (const e of game.events) { if (e.kind !== 'guardShot' || e.time <= t0 || (e as any).__seen) continue; (e as any).__seen = true; rounds++; if (e.to[2] < 9.9) through++; }
      if (game.player.hitFlash > 0.94 && firstHit < 0) firstHit = game.time - t0;
      ground += v3.distXZ(gd.char.pos, last); last = v3.copy(gd.char.pos);
    }
    void seenEv; game.puppet = null;
    return { game, gd, lineAt0, sightAt0, solidAt0, rounds, through, firstHit, ground, moved: v3.distXZ(p0, gd.char.pos), cracks: (audioCounts.get('glassCrack') ?? 0) - c0 };
  };
  await withPen(true, async () => {
    const R = await duel(931, 5);
    verdict(R.lineAt0 && R.sightAt0 && R.solidAt0, 'from where he stands: he SEES Sam through the pane, the solid walk (sound, feet) is still stopped by it, and his line of FIRE is clear — clearShot asks the toll of his own gun\'s round',
      `sight ${R.sightAt0 ? 'clear' : 'blocked'} · solid ${R.solidAt0 ? 'blocked' : 'clear'} · clearShot ${R.lineAt0} · gun ${R.gd.weapon.def.id} energy ${f2(roundEnergy(R.gd.weapon.def))}`);
    verdict(R.rounds >= 1 && R.through >= 1 && R.firstHit >= 0 && R.firstHit < 4 && R.cracks >= 1 && R.moved < 1.5,
      'he stands his ground and FIRES through the glass: rounds leave, at least one flies on past the pane, a round of his reaches Sam inside four seconds, the glass is heard — he did not walk round for the door',
      `rounds ${R.rounds} (${R.through} stopped beyond the pane) · first round in Sam ${R.firstHit >= 0 ? f2(R.firstHit) + ' s' : 'never'} · cracks ${R.cracks} · ground ${f2(R.ground)} m, ends ${f2(R.moved)} m from his start, ${R.gd.state}`);
    // one deliberate round, no dice: a guard's steady round at Sam's chest through the pane lands in him
    const W = await floor(977, [12.0, 0, 7.0]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; placeGuard(gd, [12.0, 0, 11.2], [12.0, 0, 7.0]); gd.char.anim.upper = 'aim'; for (let i = 0; i < 20; i++) W.step(DT);
    const ev0 = game.events.length; game.player.hitFlash = 0; fireWeapon(game, gd.char, chestOf(game.player.char), false, { steady: true });
    const shot = lastOf(game, ev0, 'guardShot');
    verdict(game.player.hitFlash === 1 && !!shot && shot.to[2] < 9.9 && !!lastOf(game, ev0, 'glass'), 'one steady 9 mm from the corridor at Sam\'s chest: through the pane and into him (hit registered), the pane starred on the way', `stopped (${shot?.to.map(f2)}) · hitFlash ${game.player.hitFlash}`);
    verdict(P.sideShotEnergy(game, gd.team) === undefined, 'with the row ON a side\'s corner and stand-off picks ask as they always did (no energy handed: the model\'s cautious default)', `sideShotEnergy ${P.sideShotEnergy(game, gd.team)}`);
  });
  await withPen(true, async () => {
    const R = await duel(931, 3);
    verdict(!R.lineAt0 && R.sightAt0 && R.cracks <= 1 && R.moved > 1, 'rounds through glass ON but the row "defenders shoot through glass" OFF, same staging: he sees Sam, has NO line of fire through the pane and goes round for the door, as on the base', `clearShot ${R.lineAt0} · rounds ${R.rounds} · cracks ${R.cracks} · moved ${f2(R.moved)} m`);
    const g = R.game, gd = R.gd, e0 = P.shotEnergy(g, gd.char), eSam = P.shotEnergy(g, g.player.char); const team0 = gd.team; gd.team = 'operative'; const eOp = P.shotEnergy(g, gd.char); gd.team = team0;
    verdict(e0 === 0 && eSam === roundEnergy((g.player.gunInHand() ?? g.player.pistol).def) && eOp === roundEnergy(gd.weapon.def), 'the row only takes the QUESTION from men hostile to Sam: his own line of fire and a teammate\'s still ask with their guns\' energy', `hostile ${e0} · Sam ${eSam} · the same man as an operative ${eOp}`);
    // …and the glass itself is unchanged: a round of his that does meet the pane still goes through it
    const W = await floor(977, [12.0, 0, 7.0]); const { game } = W; parkFrom(game, 1); const g2 = game.guards[0]; placeGuard(g2, [12.0, 0, 11.2], [12.0, 0, 7.0]); g2.char.anim.upper = 'aim'; for (let i = 0; i < 20; i++) W.step(DT);
    const ev0 = game.events.length; game.player.hitFlash = 0; fireWeapon(game, g2.char, chestOf(game.player.char), false, { steady: true }); const shot = lastOf(game, ev0, 'guardShot');
    verdict(game.player.hitFlash === 1 && !!shot && shot.to[2] < 9.9, '…and a round of his that is fired at the pane anyway still crosses it (the row is about where he chooses to shoot from, not about the glass)', `stopped (${shot?.to.map(f2)}) · hitFlash ${game.player.hitFlash}`);
    const la: [number, number, number] = [12.0, 1.15, 11.2], lb: [number, number, number] = [12.0, 1.0, 7.0], sFoe = P.sideShotEnergy(game, g2.team), sOp = P.sideShotEnergy(game, 'operative');
    verdict(sFoe === 0 && sOp === undefined && game.col.shotBlocked(la, lb, 0.02, sFoe) && !game.col.shotBlocked(la, lb, 0.02, sOp), '…and the places he PICKS ahead of the shot follow the row: a corner or a stand-off spot judged for his side has no line through the pane, one judged for Sam\'s side still has (tactics.ts losOpen, pressure.ts standOffSpot ask sideShotEnergy)', `his side ${sFoe} → ${game.col.shotBlocked(la, lb, 0.02, sFoe) ? 'blocked' : 'open'} · operatives ${sOp} → ${game.col.shotBlocked(la, lb, 0.02, sOp) ? 'blocked' : 'open'}`);
  }, { foesThrough: 0 });
  await withPen(false, async () => {
    const R = await duel(931, 3);
    verdict(!R.lineAt0 && R.sightAt0 && R.cracks <= 1 && R.moved > 1, 'switch OFF, same staging: he sees Sam, has NO line of fire through the pane, puts at most one round into the glass and goes round for the door (the base\'s rule, glass-lines)', `clearShot ${R.lineAt0} · rounds ${R.rounds} · cracks ${R.cracks} · moved ${f2(R.moved)} m`);
  });
  return all();
}

// ================================================================ (c) the rule's numbers
export async function glasspenRule(): Promise<boolean> {
  console.log('\n=== glasspen-rule: the toll by gun and glass — a 9 mm goes through plain and tempered panes and DIES in the laminated sidelight, a rifle round goes through that too; a graze stops; the fourth plain pane stops a 9 mm; a round spent in a pane is the old stop ===');
  const { verdict, all } = mkVerdict();
  await withPen(true, async () => {
    const W = await floor(5150, [20, 0, 11.3]); const { game } = W; parkFrom(game, 0);
    const O = officePanes(game);
    verdict(O.conf.length === 6 && O.annealed.length >= 6 && O.tempered.length >= 1 && O.laminated.length >= 1, 'the office has all three kinds of sheet (typed by the fracture model: GlassBreak.typeOf)', `sheets ${O.all.length}: annealed ${O.annealed.length} · tempered ${O.tempered.length} · laminated ${O.laminated.length}`);
    // the table: a square-on crossing of one pane of each type by each row
    const sq = (bi: number, e: number, nth = 0, slant = 0) => { const b = game.level.boxes[bi]; const n: Vec3 = b.h[0] < b.h[2] ? [1, 0, 0] : [0, 0, 1]; const t: Vec3 = b.h[0] < b.h[2] ? [0, 0, 1] : [1, 0, 0]; const d = v3.normalize(v3.add(v3.scale(n, Math.cos(slant)), v3.scale(t, Math.sin(slant)))); return paneToll(game, bi, v3.mad(b.c, n, -Math.min(b.h[0], b.h[2])), d, e, nth); };
    const rows: string[] = []; const T: Record<string, Record<string, number>> = {};
    for (const id of ['fn2000', 'aks74u', 'fiveseven', 'guard9mm']) { const e = roundEnergy((WEAPONS as any)[id]); T[id] = {}; let row = `${id.padEnd(9)} e ${f2(e)}`; for (const [ty, list] of [['annealed', O.annealed], ['tempered', O.tempered], ['laminated', O.laminated]] as const) { const r = sq(list[0], e); T[id][ty] = r ? r.eOut : -1; row += ` · ${ty} ${r ? `→ ${f2(r.eOut)} (cone ${f2(GLASSPEN.deflectDeg * r.take / e)}°)` : 'SPENT'}`; } rows.push(row); }
    verdict(T.guard9mm.annealed > 0 && T.guard9mm.tempered > 0 && T.guard9mm.laminated < 0 && T.fiveseven.laminated > 0 && T.fn2000.laminated > 0 && T.aks74u.laminated > 0 && T.fn2000.annealed > T.fn2000.tempered && T.fn2000.tempered > T.fn2000.laminated,
      'one 12 mm pane square-on: every gun through plain and tempered glass; the 9 mm service pistol is SPENT in laminated, the 5.7, the carbine and the rifle get through it; plain costs least, laminated most', rows.join('\n    '));
    // slant: more glass in the way, then the graze
    const a30 = sq(O.annealed[0], 1, 0, Math.PI / 6), a70 = sq(O.annealed[0], 1, 0, 70 * Math.PI / 180), a82 = sq(O.annealed[0], 1, 0, 82 * Math.PI / 180), a0 = sq(O.annealed[0], 1);
    verdict(!!a0 && !!a30 && !!a70 && a30.take > a0.take && a70.take > a30.take && a70.take <= a0.take * GLASSPEN.obliqueMax + 1e-9 && a82 === null, 'a slanted crossing pays for the longer way through (capped at ×' + GLASSPEN.obliqueMax + '), and past ~80° off the normal the round skids and is spent in the sheet', `toll at 0° ${f3(a0!.take)} · 30° ${f3(a30!.take)} · 70° ${f3(a70!.take)} · 82° ${a82 ? f3(a82.take) : 'spent'}`);
    // pane after pane
    let e = roundEnergy(WEAPONS.guard9mm), n9 = 0; for (let k = 0; k < 8; k++) { const r = sq(O.annealed[0], e, k); if (!r) break; e = r.eOut; n9++; }
    let er = roundEnergy(WEAPONS.fn2000), nr = 0; for (let k = 0; k < 8; k++) { const r = sq(O.annealed[0], er, k); if (!r) break; er = r.eOut; nr++; }
    let el = roundEnergy(WEAPONS.fn2000), nl = 0; for (let k = 0; k < 8; k++) { const r = sq(O.laminated[0], el, k); if (!r) break; el = r.eOut; nl++; }
    verdict(n9 === 3 && nr === GLASSPEN.maxPanes && nl === 2, 'in a row: a 9 mm gets through three plain panes, a rifle round through the cap of ' + GLASSPEN.maxPanes + ', and through two laminated sheets — never a pane more', `9 mm: ${n9} plain panes (${f2(e)} left) · rifle: ${nr} plain (${f2(er)} left), ${nl} laminated (${f2(el)} left)`);
    // the real thing at the laminated sidelight: a 9 mm stops IN it (the old stop: star, crack), a rifle round goes on
    const bi = O.laminated.find((i: number) => { const q = game.level.boxes[i]; return Math.abs(q.c[2] - 10) < 0.05 && q.c[0] > 26 && q.c[0] < 27; }) ?? O.laminated[0], b = game.level.boxes[bi]; const nz = b.h[0] >= b.h[2];   // (normal along z if the pane runs along x)
    const from: Vec3 = nz ? [b.c[0], b.c[1], b.c[2] + 1.5] : [b.c[0] + 1.5, b.c[1], b.c[2]], to: Vec3 = nz ? [b.c[0], b.c[1], b.c[2] - 1.5] : [b.c[0] - 1.5, b.c[1], b.c[2]];
    const rd = v3.normalize(v3.sub(to, from));
    const p9 = roundPath(game, from, rd, 60, roundEnergy(WEAPONS.guard9mm)), pr = roundPath(game, from, rd, 60, roundEnergy(WEAPONS.fn2000));
    const hit = game.col.raycast(from, rd, 60);
    verdict(p9 === null && !!hit && hit.index === bi && !!pr && pr.cross.length >= 1 && pr.cross[0].bi === bi && pr.len > hit.t + 0.05, `the manager's sidelight (pane ${bi}, laminated), a line square through it: the 9 mm's flight is the old straight line ending IN the pane (no path), the rifle round's crosses it and flies on`, `9 mm path ${p9 === null ? 'none (stops in pane at ' + f2(hit?.t ?? -1) + ' m)' : 'crossed'} · rifle crossed ${pr?.cross.length} pane(s), stopped at ${f2(pr?.len ?? -1)} m, ${f2(pr?.cross[0].eOut ?? 0)} left`);
    // …and the line of fire says the same of each gun
    const e9 = roundEnergy(WEAPONS.guard9mm), eR = roundEnergy(WEAPONS.fn2000); const near = v3.mad(from, rd, 2.2);
    verdict(game.col.shotBlocked(from, near, 0.02, e9) && !game.col.shotBlocked(from, near, 0.02, eR) && game.col.shotBlocked(from, near) && !game.col.segmentBlocked(from, near), 'the line of FIRE across that sidelight: blocked for the 9 mm (and for a question asked with no gun: the cautious default), clear for the rifle; sight passes as ever', `shotBlocked 9 mm ${game.col.shotBlocked(from, near, 0.02, e9)} · rifle ${game.col.shotBlocked(from, near, 0.02, eR)} · no gun ${game.col.shotBlocked(from, near)} · sight blocked ${game.col.segmentBlocked(from, near)}`);
    // a round spent in a pane through the real fireWeapon: the pane keeps its star, nothing flies on
    const gd = game.guards[0]; placeGuard(gd, nz ? [b.c[0], 0, b.c[2] + 1.6] : [b.c[0] + 1.6, 0, b.c[2]], nz ? [b.c[0], 0, b.c[2] - 2] : [b.c[0] - 2, 0, b.c[2]]); gd.char.anim.upper = 'aim'; for (let i = 0; i < 20; i++) W.step(DT);
    const ev0 = game.events.length, s0 = stars(game).length, spent0 = GLASSPEN_STATS.spent; const m = gd.char.muzzle; const aim: Vec3 = v3.mad(b.c, v3.normalize(v3.sub(b.c, m)), 2);   // (through the middle of the pane, from wherever his muzzle rides)
    fireWeapon(game, gd.char, aim, false, { steady: true }); const shot = lastOf(game, ev0, 'guardShot');
    const stopD = shot ? Math.abs(nz ? shot.to[2] - b.c[2] : shot.to[0] - b.c[0]) : 9;
    verdict(gd.weapon.def.id === 'guard9mm' && stopD < 0.03 && stars(game).length === s0 + 1 && GLASSPEN_STATS.spent === spent0 + 1, 'a guard\'s 9 mm fired at it for real: stopped IN the laminated sheet (within 3 cm of its plane), one star, counted as spent', `gun ${gd.weapon.def.id} · stopped ${f3(stopD)} m from the pane's plane at (${shot?.to.map(f2)}) · stars +${stars(game).length - s0}`);
  });
  return all();
}

// ================================================================ (d) the line of fire agrees with the round
export async function glasspenLines(): Promise<boolean> {
  console.log('\n=== glasspen-lines: over a few thousand seeded lines across the office\'s glazing, col.shotBlocked(energy) says CLEAR exactly when a round of that energy fired along the line gets to its far end; eyes and feet are unchanged by the switch ===');
  const { verdict, all } = mkVerdict();
  const W = await floor(6021, [20, 0, 11.3]); const { game } = W; parkFrom(game, 0);
  const { WINBARS } = await import(`${ROOT}/src/game/winbars.ts`); const bars0 = WINBARS.on; WINBARS.on = false;   // (held off, put back at the end: this asks that the line of fire and glasspen's roundPath agree, and with window bars live — winbars.ts, on as the page opens — the line passes a standing bar that roundPath alone stops in: fireWeapon's own flight takes the bar, which `probes.ts winbars` asks)
  const O = officePanes(game); const rnd = seeded(77);
  type L = { a: Vec3; b: Vec3; e: number };
  const lines: L[] = []; const es = [0.5, 0.6, 0.9, 1.0];
  for (const bi of O.all) { const b = game.level.boxes[bi]; const nz = b.h[0] >= b.h[2];
    for (let k = 0; k < 120; k++) {
      const u = (rnd() * 2 - 1) * (nz ? b.h[0] : b.h[2]) * 0.9, y = b.c[1] + (rnd() * 2 - 1) * b.h[1] * 0.9; const on: Vec3 = nz ? [b.c[0] + u, y, b.c[2]] : [b.c[0], y, b.c[2] + u];
      const ang = (rnd() * 2 - 1) * 1.45, pitch = (rnd() * 2 - 1) * 0.25; const n: Vec3 = nz ? [Math.sin(ang), pitch, Math.cos(ang)] : [Math.cos(ang), pitch, Math.sin(ang)]; const d = v3.normalize(n);
      const la = 0.4 + rnd() * 4, lb = 0.4 + rnd() * 5;
      lines.push({ a: v3.mad(on, d, -la), b: v3.mad(on, d, lb), e: es[(rnd() * es.length) | 0] });
    } }
  // OFF: shotBlocked ≡ the solid walk on every one of them
  const offSame = await withPen(false, async () => lines.every(l => game.col.shotBlocked(l.a, l.b, 0.02, l.e) === game.col.solidBlocked(l.a, l.b)));
  const sightOff = lines.map(l => game.col.segmentBlocked(l.a, l.b)), solidOff = lines.map(l => game.col.solidBlocked(l.a, l.b));
  verdict(offSame, `switch off: shotBlocked is the solid walk on all ${lines.length} lines, whatever energy is offered`, '');
  await withPen(true, async () => {
    let agree = 0, clear = 0, glassOnly = 0, opened = 0; const bad: string[] = [];
    for (const l of lines) {
      const sb = game.col.shotBlocked(l.a, l.b, 0.02, l.e); const len = v3.dist(l.a, l.b), rd = v3.normalize(v3.sub(l.b, l.a));
      const first = game.col.raycast(l.a, rd, len - 0.02); const Pth = roundPath(game, l.a, rd, len - 0.02, l.e, first);
      const reaches = Pth ? Pth.st === null : first === null;   // the round got to the far end: flew the whole range on its (straightened) path
      if (!sb) clear++; if (sb === !reaches) agree++; else if (bad.length < 6) bad.push(`a (${l.a.map(f2)}) b (${l.b.map(f2)}) e ${l.e}: shotBlocked ${sb}, round ${reaches ? 'arrives' : 'stops'}${Pth ? ` after ${Pth.cross.length} pane(s) at ${f2(Pth.len)} of ${f2(len)} m` : first ? ` in box ${first.index} at ${f2(first.t)} m` : ''}`);
      const i = lines.indexOf(l); if (!sightOff[i] && solidOff[i]) { glassOnly++; if (!sb) opened++; }
    }
    const pct = agree / lines.length;
    verdict(pct >= 0.995, `with the turn at the pane off (the line-of-fire question is about the straight line): the two agree on ${(pct * 100).toFixed(2)} % of ${lines.length} lines (≥ 99.5 % asked: what is left are lines ending within the segment walk's 2 cm shrink of a face)`, `clear ${clear} · glass-only lines ${glassOnly}, of which now a shot ${opened}\n    ${bad.join('\n    ')}`);
    // NO TUNNELS: a round that leaves the glass by the sheet's top / bottom / end face is born in the frame it is let into — it must be spent there, never fly on from
    // inside the wall (rayBox sees nothing from inside a box). Every leg of every path, sampled every 20 cm: never deeper than 5 mm inside a static that is not a sheet.
    { const scratch = new Int32Array(64); let rays = 0, legs = 0, inSolid = 0, abut = 0; const worst: string[] = []; const r2 = seeded(4242);
      const deepIn = (p: Vec3, d: Vec3): number => { const n = game.col.gather(p[0] - 0.02, p[2] - 0.02, p[0] + 0.02, p[2] + 0.02, p[1] - 0.02, p[1] + 0.02, scratch); for (let i = 0; i < n; i++) { const b = game.col.boxes[scratch[i]]; if ((b.flags & BoxFlag.NoShadow) || isSheet(b)) continue; const s = lineBox(p, d, b); if (s && s.depth > 0.005) return scratch[i]; } return -1; };
      for (const bi of O.all) { const b = game.level.boxes[bi]; const nz = b.h[0] >= b.h[2];
        for (let k = 0; k < 900; k++) {   // aimed at the pane's RIM as often as its middle, slanted up / down / along it hard
          const edge = r2() < 0.6; const u = (edge ? (r2() < 0.5 ? -1 : 1) * (1 - r2() * 0.03) : r2() * 2 - 1) * (nz ? b.h[0] : b.h[2]), yv = (edge && r2() < 0.5 ? (r2() < 0.5 ? -1 : 1) * (1 - r2() * 0.03) : r2() * 2 - 1) * b.h[1];
          const on: Vec3 = nz ? [b.c[0] + u, b.c[1] + yv, b.c[2]] : [b.c[0], b.c[1] + yv, b.c[2] + u];
          const ang = (r2() * 2 - 1) * 1.35, pitch = (r2() * 2 - 1) * 0.9; const d = v3.normalize(nz ? [Math.sin(ang), pitch, Math.cos(ang) * (r2() < 0.5 ? 1 : -1)] : [Math.cos(ang) * (r2() < 0.5 ? 1 : -1), pitch, Math.sin(ang)]);
          const from = v3.mad(on, d, -(0.3 + r2() * 2)); if (deepIn(from, d) >= 0) continue;
          const Pth = roundPath(game, from, d, 60, 1); rays++; if (!Pth) continue;
          for (const x of Pth.cross) if (x.into >= 0) abut++;
          for (let j = 1; j < Pth.segs.length; j++) { const s = Pth.segs[j]; legs++; for (let t = 0; t <= Math.min(s.len, 3); t += 0.2) { const w = deepIn(v3.mad(s.o, s.d, t), s.d); if (w >= 0) { inSolid++; if (worst.length < 4) worst.push(`pane ${bi} → leg ${j} at ${f2(t)} m inside box ${w} (from (${from.map(f2)}) dir (${d.map(f2)}))`); break; } } }
        } }
      verdict(inSolid === 0 && legs > 3000, `no tunnels: of ${rays} rounds fired at the panes' middles and rims at every slant, ${legs} legs fly on from the glass and not one runs inside a wall, a frame, a sill or a lintel`, `legs inside a solid ${inSolid} · crossings straight into an abutting pane ${abut}${worst.length ? '\n    ' + worst.join('\n    ') : ''}`); }
    verdict(opened > glassOnly * 0.5 && opened < glassOnly, 'most lines that only GLASS stood in are now lines of fire — and not all (the 9 mm at laminated glass, the grazes)', `${opened} of ${glassOnly}`);
    const sightOn = lines.map(l => game.col.segmentBlocked(l.a, l.b)), solidOn = lines.map(l => game.col.solidBlocked(l.a, l.b));
    verdict(sightOn.every((v, i) => v === sightOff[i]) && solidOn.every((v, i) => v === solidOff[i]), 'the line of SIGHT and the SOLID walk (sound, a step, a reach) answer exactly as with the switch off on every line', `${lines.length} lines × 2`);
    game.touring = true; const liveTour = glassPenLive(game); const tourSame = lines.slice(0, 400).every(l => game.col.shotBlocked(l.a, l.b, 0.02, l.e) === game.col.solidBlocked(l.a, l.b)); game.touring = false;
    verdict(!liveTour && tourSame, 'under a showcase (Game.touring) the rule is inert: shotBlocked is the solid walk again', `live ${liveTour}`);
  }, { deflectDeg: 0 });
  WINBARS.on = bars0; return all();
}

// ================================================================ (e) what the pane never hears of, and the muzzle past the glass
export async function glasspenNear(): Promise<boolean> {
  console.log('\n=== glasspen-near: a man on the NEAR side of the pane takes the round and the glass is untouched; a man pressed to the far face is hit by the round as it leaves the glass; Sam pressed to the glazing with his muzzle past it fires on into the room; the restart forgets the holes ===');
  const { verdict, all } = mkVerdict();
  await withPen(true, async () => {
    // near side: Sam in the corridor, the man between him and the glass
    { const W = await floor(7301, [7.5, 0, 12.4]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 10.9], [7.5, 0, 12.4]); for (let i = 0; i < 5; i++) W.step(DT); gunUp(W, 'pistol');
      const ev0 = game.events.length, s0 = stars(game).length, x0 = GLASSPEN_STATS.crossed; fireWeapon(game, game.player.char, chestOf(gd.char), true); const shot = lastOf(game, ev0, 'shot');
      verdict(gd.state === 'dead' && !!shot && shot.to[2] > 10.2 && stars(game).length === s0 && GLASSPEN_STATS.crossed === x0 && !lastOf(game, ev0, 'glass'), 'the man stands in FRONT of the pane on the round\'s line: he takes it, and the pane behind him has no star, no crack event, no hole', `stopped (${shot?.to.map(f2)}) · guard ${gd.state} · stars +${stars(game).length - s0}`); }
    // far side, pressed to the glass
    { const W = await floor(7302, [7.5, 0, 11.6]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 9.82], [7.5, 0, 11.6]); for (let i = 0; i < 5; i++) W.step(DT); gunUp(W, 'pistol');
      const ev0 = game.events.length, s0 = stars(game).length; fireWeapon(game, game.player.char, chestOf(gd.char), true); const shot = lastOf(game, ev0, 'shot');
      verdict(gd.state === 'dead' && stars(game).length === s0 + 1 && !!shot && shot.to[2] < 10.0 && shot.to[2] > 9.4, 'a man standing AGAINST the far face (18 cm off the glass): the round stars the pane and is in him as it leaves it — it does not pass through him', `stopped (${shot?.to.map(f2)}) · guard ${gd.state} · stars +${stars(game).length - s0}`); }
    // …and a round that leaves the glass OVER the head of a man backed onto it passes him (the contact column's crown pad is for a muzzle pressed down on a crouched man)
    { const W = await floor(7304, [7.5, 0, 11.6]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 9.74], [7.5, 0, 6]); for (let i = 0; i < 5; i++) W.step(DT); gunUp(W, 'pistol');
      const top = gd.char.bones.headTop?.[1] ?? 1.8; const m = game.player.char.muzzle; const over: Vec3 = [7.5, top + 0.15, 9.99]; const aim = v3.mad(m, v3.normalize(v3.sub(over, m)), 6);
      const ev0 = game.events.length; fireWeapon(game, game.player.char, aim, true); const shot = lastOf(game, ev0, 'shot');
      verdict(gd.state !== 'dead' && !!shot && v3.dist(shot.to, over) > 0.5, 'a round through the pane 15 cm over the crown of a man standing with his back to the glass: it passes over him and flies on', `crown ${f2(top)} m · stopped (${shot?.to.map(f2)}) · guard ${gd.state}`); }
    // Sam pressed to the glazing: the muzzle already past the sheet
    { const W = await floor(7303, [7.5, 0, 10.42]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 6.8], [7.5, 0, 11.6]);
      game.puppet = { goal: [7.5, 0, 10.42], aim: [7.5, 1.3, 6.8] }; gunUp(W, 'pistol'); for (let i = 0; i < 30; i++) W.step(DT);
      const pc = game.player.char; let poked = armThrough(game, pc); let z = 10.42;
      for (let k = 0; k < 12 && !poked; k++) { z -= 0.03; game.teleportPlayer([7.5, 0, z]); game.puppet = { goal: [7.5, 0, z], aim: [7.5, 1.3, 6.8] }; for (let i = 0; i < 12; i++) W.step(DT); poked = armThrough(game, pc); }
      if (!poked) console.log(`    (could not stage a muzzle past the glass: muzzle z ${f2(pc.muzzle[2])} with Sam at z ${f2(pc.pos[2])} — the collision keeps him off the sheet; the rule is covered by the unit call below)`);
      const ev0 = game.events.length, s0 = stars(game).length, a0 = GLASSPEN_STATS.viaArm; if (poked) fireWeapon(game, pc, chestOf(gd.char), true); const shot = lastOf(game, ev0, 'shot');
      verdict(!poked || (!!shot && shot.to[2] < 9.0 && stars(game).length === s0 + 1 && GLASSPEN_STATS.viaArm === a0 + 1 && gd.state === 'dead'), poked ? 'Sam pressed to the glazing, muzzle past the sheet: the round is NOT put into the panel at the muzzle — the pane is starred at the arm and the round flies on into the man in the room' : 'muzzle-past-the-glass: not stageable on this floor (collision keeps the muzzle short of the sheet) — skipped', poked ? `Sam z ${f2(pc.pos[2])} muzzle z ${f2(pc.muzzle[2])} · stopped (${shot?.to.map(f2)}) · stars +${stars(game).length - s0} · guard ${gd.state}` : '');
      // …and with a man standing against the far face, the muzzle inside him: the contact shot counts (the panel between the two chests is the glass the muzzle is through)
      if (poked) { const g2 = game.guards[1]; const mz = pc.muzzle; dummy(g2, [mz[0], 0, mz[2] - 0.1], [mz[0], 0, 12]); const a1 = GLASSPEN_STATS.viaArm; fireWeapon(game, pc, [mz[0], mz[1], 6.8], true);
        verdict(g2.state === 'dead' && GLASSPEN_STATS.viaArm === a1 + 1, 'muzzle through the glass and pressed into a man standing against its far face: he is hit where he stands', `2nd man ${g2.state} at (${g2.char.pos.map(f2)}) · muzzle (${mz.map(f2)})`); }
      // a checkpoint keeps the holes with the stars: a forced snapshot, a load, the same holes
      { game.puppet = null; for (let i = 0; i < 3; i++) W.step(DT); const before = officePanes(game).conf.map((i: number) => holeCount(game, i)); const snap = W.snapshot('glasspen', true); const hasKey = !!snap && Array.isArray((snap as any).glassPen);
        game.puppet = null; const ok = snap ? W.restore(snap) : null; const after = officePanes(game).conf.map((i: number) => holeCount(game, i));
        verdict(!poked || (hasKey && before.join() === after.join() && before.some((n: number) => n > 0)), 'a checkpoint written with holes in the glass carries them (glassPen slice) and a load puts them back, pane for pane', `holes by pane before [${before}] after [${after}] · slice in file ${hasKey} · restore ${JSON.stringify(ok ?? null).slice(0, 60)}`); }
      // …but not while the fracture model is live: a load leaves every pane whole there, and a hole with no mark on the glass would be a cheap way through it
      { const snap2: any = W.snapshot('glasspen-live', true); const chaos0 = game.tune.chaos, gb0 = game.tune.glassBreak; game.tune.chaos = 0.5; game.tune.glassBreak = true;
        const live = glassBreakLive(game); game.puppet = null; if (snap2) W.restore(snap2); const after2 = officePanes(game).conf.map((i: number) => holeCount(game, i));
        const open2 = officePanes(game).conf.map((i: number) => game.glassBreak.openFraction(i)); game.tune.chaos = chaos0; game.tune.glassBreak = gb0;
        verdict(!poked || (live && Array.isArray(snap2?.glassPen) && after2.every((n: number) => n === 0) && open2.every((o: number) => o === 0)), 'the same file loaded with the fracture model live: every pane whole AND no through-hole put back (both come back or neither)', `fracture live ${live} · slice in file ${Array.isArray(snap2?.glassPen)} · holes after [${after2}] · open [${open2}]`);
        game.puppet = null; if (snap2) W.restore(snap2); const back = officePanes(game).conf.map((i: number) => holeCount(game, i));
        verdict(!poked || back.some((n: number) => n > 0), '…and loaded again with the fracture off: the holes are back (the file was not changed by the refusal)', `holes [${back}]`); }
      // the restart forgets holes and stars alike
      const bi = officePanes(game).conf.find((i: number) => holeCount(game, i) > 0);
      if (bi === undefined) { fireWeapon(game, pc, [7.5, 1.3, 6.8], true); }
      const withHoles = officePanes(game).conf.filter((i: number) => holeCount(game, i) > 0).length;
      game.puppet = null; game.restartEncounter();
      verdict(withHoles >= 1 && officePanes(game).conf.every((i: number) => holeCount(game, i) === 0) && stars(game).length === 0, 'restartEncounter: the holes go with the stars', `panes holed before ${withHoles} · after 0 · stars ${stars(game).length}`); }
  });
  return all();
}

// ================================================================ (f) off = the base
export async function glasspenOff(): Promise<boolean> {
  console.log('\n=== glasspen-off: the harness stands the switch at OFF; off, a round at a man behind the conference glass STOPS in the pane and he lives, shotBlocked is the solid walk, and a seeded minute of the floor with shooting at the glazing digests the same as with the module\'s hooks never asked ===');
  const { verdict, all } = mkVerdict();
  const envForced = !!process.env.GLASSPEN, frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen';
  { const W = await floor(8101, [7.5, 0, 11.6]); const { game } = W;
    verdict(envForced || GLASSPEN.on === !frozen, frozen ? 'standGame({ harness }) leaves the switch OFF (unless GLASSPEN is set in the environment): every frozen digest was recorded with rounds stopping in glass' : 'on the SHIPPED stand the stand-up leaves the switch ON, as the page opens (unless GLASSPEN is set in the environment): rounds pass glass there', `GLASSPEN.on ${GLASSPEN.on}${envForced ? ' (env GLASSPEN=' + process.env.GLASSPEN + ')' : ''} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · col.glassPen installed ${!!game.col.glassPen}`); }
  await withPen(false, async () => {
    const W = await floor(8102, [7.5, 0, 11.6]); const { game } = W; parkFrom(game, 1); const gd = game.guards[0]; dummy(gd, [7.5, 0, 6.8], [7.5, 0, 11.6]); for (let i = 0; i < 5; i++) W.step(DT); gunUp(W, 'rifle');
    const ev0 = game.events.length, x0 = GLASSPEN_STATS.crossed, q0 = GLASSPEN_STATS.shotAsked; fireWeapon(game, game.player.char, chestOf(gd.char), true); const shot = lastOf(game, ev0, 'shot');
    const blocked = game.col.shotBlocked([7.5, 1.3, 11.6], [7.5, 1.3, 7.2], 0.02, 1);
    const snap: any = W.snapshot('glasspen-off', true);
    verdict(!!snap && !('glassPen' in snap), 'off: a checkpoint written after rounds at the glass has no glassPen slice (the file is the base\'s)', `keys ${snap ? Object.keys(snap).length : 0}`);
    verdict(!!shot && Math.abs(shot.to[2] - 10) < 0.05 && gd.state !== 'dead' && blocked && GLASSPEN_STATS.crossed === x0 && GLASSPEN_STATS.shotAsked === q0, 'off: the rifle round STOPPED in the pane (z 10), the man behind it lives, the line of fire is blocked, and not one of the module\'s counters moved', `stopped (${shot?.to.map(f2)}) · guard ${gd.state} · shotBlocked ${blocked}`);
  });
  // a seeded minute with rounds at the glazing: the switch off vs the collision hook removed altogether (= the base's shotBlocked statement)
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const minute = async (strip: boolean) => {
    Math.random = seeded(8200); const W = await standUp(); const { game } = W; floatPartition(game); if (WANT !== null) GLASSPEN.on = WANT; game.aiEnabled = true; game.godMode = true; game.infiniteAmmo = true;
    if (strip) game.col.glassPen = null;
    game.teleportPlayer([9, 0, 11.4]); const pl = game.player; pl.slot = 'pistol'; pl.holstered = false;
    for (let f = 0; f < 60 * 60; f++) { W.step(DT); if (f > 60 && f % 45 === 0) fireWeapon(game, pl.char, [6.5 + (f % 7), 1.2, 5.0], true); }
    return JSON.stringify(digestGame(game, true));
  };
  await withPen(false, async () => { const A = await minute(false), B = await minute(true); verdict(A === B && A.length > 200, 'a seeded minute on the office (AI on, a round at the conference glass every ¾ s — the floor comes for Sam, lines of fire asked all over): switch off ≡ the collision hook removed, digest for digest', `digest ${A.length} chars, equal ${A === B}`); });
  return all();
}
