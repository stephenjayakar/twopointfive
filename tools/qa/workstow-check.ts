// THE GUN IS PUT AWAY FOR A TWO-HANDED JOB (src/game/workstow.ts — a door charge and a wall charge, by your hands and by a teammate's), headless:
//   bun run tools/qa/workstow-check.ts [sam|mate|wall|off]      (probes.ts workstow; WORKSTOW_BREAK=1 = the switch left off: must fail)
// The maintainer, 10-23: "characters should fully unequip their weapon when planting door charges, etc. -- they can reequip after they're done".
//   sam    alone in the office, a door charge by hand, with the pistol up and with the rifle up: what he held is away from the row's first frame to the
//          charge set, BOTH wrists are on the charge half way through, it is back in his hand when the job is over, no round leaves it before it is up (a
//          click the frame the charge is set fires nothing; a click once it is up fires) and the times are printed: the plant, and from the charge set to
//          the gun up. Hands empty at the start stay empty. A step, and the trigger, break the job off and the gun comes back. The same with kit
//          handling switched on (its own errand carries the gun there: the plant is longer by it).
//   mate   the squad's door charge on order: from the frame the setter is on the job his gun is out of his hands (drawn hung), both wrists are on the
//          charge half way through, the charge is set `mateDown` + `setSecs` after he came onto it, his fire site is locked from then until `mateUp` after
//          it is set, and a round forced out of the gun puts it in his hands at once. The fight has him half way through a second one: the job is
//          dropped, nothing spent, his gun is up `mateUp` later, and when the fight lets him go he sets it.
//   wall   the same two on a wall charge, where the stand has walls to charge: by your hands (away, back) and on order (hung, the clock, back).
//   off    the switch off = the build as it was: the plant takes setSecs with the gun never out of the hand, a teammate's gun never leaves his; a run with
//          the switch on and no charge set is the run with it off, by digest; the two stands' row and the registry.
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch, hands at work and — where it says so — kit handling itself. No picture is looked at.
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

const { WORKSTOW, WORKSTOW_STATS, stowHang } = await import(`${ROOT}/src/game/workstow.ts`);
const { sideLocked } = await import(`${ROOT}/src/game/gunslots.ts`);
const { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`);
const { HANDWORK } = await import(`${ROOT}/src/game/handwork.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { DOORTOOLS, doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const WCM = await import(`${ROOT}/src/game/wallcharge.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobRegistry, JOURNAL_KNOBS } = await import(`${ROOT}/src/game/knobs.ts`);
const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const BREAK = process.env.WORKSTOW_BREAK === '1';
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), dist3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const faceToward = (d: any, p: number[]): 1 | -1 => (dist(doorPt(d, d.def.width / 2, 1, 1), p) <= dist(doorPt(d, d.def.width / 2, 1, -1), p) ? 1 : -1);
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; };
/** the tables this file writes, put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const was = { ws: { ...WORKSTOW }, own: OWNCHARGE.on, hw: HANDWORK.on, ka: KITANIM.on, kit: K.KIT.on, cards: K.KIT.members.map((m: any) => ({ ...m })) }, rnd = Math.random;
  try { return await fn(); } finally { Object.assign(WORKSTOW, was.ws); OWNCHARGE.on = was.own; HANDWORK.on = was.hw; KITANIM.on = was.ka; K.kitLoad(null, ''); for (let i = 0; i < was.cards.length; i++) K.KIT.members[i] = was.cards[i]; K.KIT.on = was.kit; Math.random = rnd; }
}
/** the switch (left off under WORKSTOW_BREAK), your own charges and the hands that do the work, raised after a game is stood up */
const raise = (kitanim?: boolean) => { WORKSTOW.on = !BREAK; OWNCHARGE.on = true; HANDWORK.on = true; if (kitanim !== undefined) KITANIM.on = kitanim; };
/** your card for a night alone with `n` door charges on the card the run wears (owncharge-check's own staging) */
function soloWith(g: any, n: number) {
  K.KIT.on = true; K.KIT.members[0].charges = n;
  if ((K as any).kitStealthOn?.()) { K.kitMission(K.kitStealthHand(0, false)); const m: any = K.KIT.members[0]; for (const f of ['smoke', 'bangs', 'frags', 'shells', 'cams']) m[f] = 0; m.wand = false; m.charges = n; K.kitMission(null); }
  K.kitSolo(g);
}
/** what is in his right hand by the game's rules */
const inHand = (pl: any): string => pl.pistolUp ? 'pistol' : pl.rifleUp ? 'rifle' : pl.holstered ? 'nothing' : String(pl.slot);
/** his hand given a gun (or emptied), settled */
function arm(R: any, what: 'pistol' | 'rifle' | 'nothing') { const pl = R.game.player; if (what === 'nothing') pl.holstered = true; else { pl.slot = what; pl.holstered = false; } pl.equipT = 0; R.step(50); }
/** Sam stood at arm's length off the middle of the leaf on `side`, the leaf put home on its latch as he gets there (a man on his round opens it in the meantime) */
function standAt(R: any, d: any, side: 1 | -1, off = 0.75) { R.game.teleportPlayer(doorPt(d, d.def.width / 2, off, side)); shut(d); R.step(12); }
function begin(R: any): boolean { const ok = R.game.selectVerb('door', 'charge'); if (ok) { R.input.pressed.add('Space'); R.step(); } return ok && !!R.game.player.charging; }
/** a door charge set by hand, watched: what was in his hand on each frame of it, both wrists' distance from the charge half way, the seconds it took, and — once
 *  it is set — when what he held is his again and when a round may leave it (`click`: the trigger pulled on the frame the charge is set) */
function plant(R: any, d: any, side: 1 | -1, click = false) {
  const g = R.game, pl = g.player, D = R.D, c = pl.char; standAt(R, d, side); const held0 = inHand(pl), n0 = D.set.length, r0 = pl.pistol.roundsReady + pl.rifle.roundsReady, t0 = g.time;
  if (!begin(R)) return null;
  let away = 0, frames = 0, wrists = [NaN, NaN], two = false, downAt = NaN;
  while (pl.charging && frames < 60 * 8) { R.step(); frames++; if (!pl.charging) break; if (inHand(pl) === 'nothing') away++; if (isNaN(downAt) && pl.workStow?.down) downAt = g.time - t0;
    const J = D.samJob; if (J && Math.abs((g.time - pl.charging.t0) - DOORTOOLS.setSecs * 0.4) < 0.01) { wrists = [dist3(c.bones.handL, J.p), dist3(c.bones.handR, J.p)]; two = c.anim.workInfo().two; } }
  const set = D.set.length > n0, secs = g.time - t0, tSet = g.time;
  if (click) R.input.clicked |= 1;
  let backAt = NaN, upAt = NaN, early = 0;
  for (let i = 0; i < 60 * 4; i++) { R.step(); if (isNaN(backAt) && inHand(pl) === held0 && held0 !== 'nothing') backAt = g.time - tSet;
    if (isNaN(upAt) && !isNaN(backAt) && pl.equipT <= 0 && !c.anim.kitBusy) { upAt = g.time - tSet; break; } }
  if (click) early = r0 - (pl.pistol.roundsReady + pl.rifle.roundsReady);
  return { held0, set, secs, frames, away, wrists, two, downAt, backAt, upAt, early, held1: inHand(pl) };
}

// ───────────────────────────────────────────────────────────── you
export async function workstowSam(): Promise<boolean> {
  const F = family('workstow-sam: a charge going on by your hands has both of them — what you held is away for it and back after');
  await kept(async () => {
    for (const kitanim of [false, true]) {
      const R: any = await hushed(() => rig(11, { stage: false })); const { game: g, D } = R, pl = g.player; raise(kitanim); soloWith(g, 2);
      g.aiEnabled = false; R.post = () => { for (const gd of g.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; } };   // (the floor deaf and kept where it stands: the lines below fire rounds, and a man come to look shoulders open the door they work on)
      const d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]); shut(d); const tag = kitanim ? 'kit handling on' : 'kit handling off';
      for (const gun of (pl.hasRifle ? ['pistol', 'rifle'] : ['pistol']) as ('pistol' | 'rifle')[]) {
        g.teleportPlayer(doorPt(d, d.def.width / 2, 2.2, side)); R.step(5); shut(d); D.set.length = 0; soloWith(g, 2); arm(R, gun);   // (stood clear of the leaf before it is put home)
        const P = plant(R, d, side, true);
        const whole = !!P && P.set && P.held0 === gun && P.away >= P.frames - 2 && P.held1 === gun && !isNaN(P.backAt);
        const longer = !!P && P.secs >= DOORTOOLS.setSecs - 0.05 && P.secs < DOORTOOLS.setSecs + WORKSTOW.downMax + 0.3 && (!kitanim || P.secs > DOORTOOLS.setSecs + 0.1);
        F.verdict(whole && longer && P!.two && P!.wrists[0] < 0.3 && P!.wrists[1] < 0.3 && P!.early === 0 && (!kitanim || P!.upAt > 0.1),
          `${tag}, the ${gun} up: away from the row to the charge set, both wrists on the charge, back in his hand after, and the click on the frame it is set fires nothing`,
          P ? `in hand before: ${P.held0} · away on ${P.away} of ${P.frames} frames · hands free ${f2(P.downAt)} s in · wrists ${f2(P.wrists[0])} / ${f2(P.wrists[1])} m off the charge, two hands ${P.two} · THE PLANT ${f2(P.secs)} s (setSecs ${DOORTOOLS.setSecs}) · back in hand ${f2(P.backAt)} s after it is set, A ROUND MAY LEAVE IT ${f2(P.upAt)} s after · rounds gone by the early click: ${P.early} · in hand after: ${P.held1}` : 'the row never started');
        // …and once it is up, the trigger is his
        if (P) { const r0 = pl.pistol.roundsReady + pl.rifle.roundsReady; const far = doorPt(d, d.def.width / 2, 7, side); g.teleportPlayer(doorPt(d, d.def.width / 2, 2.2, side)); for (let i = 0; i < 30; i++) { R.W.cursorAt([far[0], 1.2, far[2]]); R.step(); }   // (his back to the door: the round goes down the corridor, not into the lock)
          let shot = 0; for (let i = 0; i < 40 && !shot; i++) { R.W.cursorAt([far[0], 1.2, far[2]]); R.input.clicked |= 1; R.input.buttons |= 1; R.step(); shot = r0 - (pl.pistol.roundsReady + pl.rifle.roundsReady); } R.input.buttons &= ~1; R.step(10);
          F.verdict(shot > 0, `${tag}, the ${gun}: once it is up the trigger is his again`, `rounds gone: ${shot}`); }
      }
      // hands empty at the start: nothing to put away, nothing brought back
      { g.teleportPlayer(doorPt(d, d.def.width / 2, 2.2, side)); R.step(5); shut(d); D.set.length = 0; soloWith(g, 2); arm(R, 'nothing'); const s0 = { ...WORKSTOW_STATS }; const P = plant(R, d, side);
        F.verdict(!!P && P.set && P.held0 === 'nothing' && P.held1 === 'nothing' && WORKSTOW_STATS.samDown === s0.samDown && WORKSTOW_STATS.samUp === s0.samUp && Math.abs(P.secs - DOORTOOLS.setSecs) < 0.25,
          `${tag}: hands empty at the start stay empty, and the plant is setSecs`, P ? `before ${P.held0} · after ${P.held1} · ${f2(P.secs)} s · put away ${WORKSTOW_STATS.samDown - s0.samDown}, brought back ${WORKSTOW_STATS.samUp - s0.samUp}` : 'the row never started'); }
      // a step breaks it off; the trigger lets go of it: the gun comes back either way, nothing spent
      for (const how of ['a step', 'the trigger'] as const) {
        g.teleportPlayer(doorPt(d, d.def.width / 2, 2.2, side)); R.step(5); shut(d); D.set.length = 0; soloWith(g, 2); arm(R, 'pistol'); standAt(R, d, side); const n0 = D.charges, r0 = pl.pistol.roundsReady, ok = begin(R); R.step(45); const mid = inHand(pl), on = !!pl.charging;
        if (how === 'a step') { R.input.keys.add('KeyS'); R.input.pressed.add('KeyS'); R.step(30); R.input.keys.delete('KeyS'); } else { R.input.clicked |= 1; R.step(); }
        const off = !pl.charging, shotNow = r0 - pl.pistol.roundsReady; R.step(90);
        F.verdict(ok && on && mid === 'nothing' && off && inHand(pl) === 'pistol' && D.charges === n0 && D.set.length === 0 && shotNow === 0,
          `${tag}: ${how} breaks the job off — nothing spent, no round on that frame, and the pistol is back in his hand`, `started ${ok} · in hand half a second in: ${mid} · broken off ${off} · rounds gone on that frame ${shotNow} · in hand after: ${inHand(pl)} · count ${D.charges} of ${n0}, set ${D.set.length}`);
      }
    }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── the team
/** the squad's door charge on order, watched from the frame the setter is on the job to `after` s past the charge set */
async function mateRun(fight: boolean) {
  const R: any = await hushed(() => rig(7, { door: 'breakroom_w' })); raise(); const { D, game: g } = R; const d = R.door('breakroom_w'); shut(d);
  const n0 = D.charges, why = R.give('charge', 'breakroom_w'); R.until(() => !!D.ops[0] && !isNaN(D.ops[0].setT), 45);
  const op = D.ops[0], lead = op?.lead, c = lead?.char, onT = g.time, A = op?.mine.get(lead);
  const out: any = { why, lead: lead?.callsign, n0, hungAll: true, lockedAll: true, firedInside: 0, wrists: [NaN, NaN], two: false, setIn: NaN, upIn: NaN, dropped: false, spentAtDrop: NaN, upAfterDrop: NaN, again: NaN, net: false, frames: 0 };
  if (!op || !lead) return out;
  const r0 = lead.weapon.roundsReady, spot = () => doorPt(d, d.def.width - 0.22, 0.025, op.side, 1.05);
  if (fight) {   // the fight has him half way through: dropped, nothing spent, the gun up `mateUp` later — then it lets him go and he sets it
    // (stood in for by a blinding — stowFight's own word beside the order yielded to a fight: the orders book takes a yield back the frame nobody is in front of him)
    R.until(() => g.time - op.setT > DOORTOOLS.setSecs * 0.5, 6); const t1 = g.time; lead.dazzledUntil = g.time + 1.5; R.step(2);
    out.dropped = isNaN(op.setT) && D.set.length === 0; out.spentAtDrop = n0 - D.charges;
    for (let i = 0; i < 120 && lead.workStow; i++) R.step(); out.upAfterDrop = g.time - t1; R.step(20);
    out.heldOff = isNaN(op.setT) && D.set.length === 0 && D.ops.includes(op) && g.time < lead.dazzledUntil;
    lead.dazzledUntil = 0; const t2 = g.time; R.until(() => D.set.length > 0 || !D.ops.includes(op), 30); out.again = D.set.length > 0 ? g.time - t2 : NaN; out.spent = n0 - D.charges;
    return out;
  }
  while (D.set.length === 0 && D.ops.includes(op) && out.frames < 60 * 8) { R.step(); out.frames++; if (D.set.length) break;
    out.hungAll &&= stowHang(g, lead) && !!lead.workStow; out.lockedAll &&= sideLocked(g, lead) && lead.fireCd > 0;
    if (Math.abs((g.time - op.setT) - DOORTOOLS.setSecs * 0.4) < 0.01) { out.wrists = [dist3(c.bones.handL, spot()), dist3(c.bones.handR, spot())]; out.two = c.anim.workInfo().two; } }
  out.setIn = g.time - onT; out.spent = n0 - D.charges; out.firedInside = r0 - lead.weapon.roundsReady;
  const tSet = g.time; out.lockedAtSet = sideLocked(g, lead); for (let i = 0; i < 120 && lead.workStow; i++) R.step(); out.upIn = g.time - tSet; out.hungAfter = stowHang(g, lead);
  // the net: a round forced out of a gun that is out of his hands puts it in them at once
  lead.workStow = { upT: -1, fed: true }; fireWeapon(g, c, [c.pos[0] + 3, 1.2, c.pos[2]], false, { steady: true, spread: 0 }); out.net = lead.workStow === null;
  return out;
}
/** a man put where the setter sees him, half a second into the plant: what the room fight does with the setter's gun (the man is blind and his gun empty; the
 *  rest of the team is parked blind down the aisle, so the round that drops him is the setter's own) */
async function mateSeen() {
  const R: any = await hushed(() => rig(7, { door: 'breakroom_w', hot: true })); raise(); const { D, game: g } = R; const d = R.door('breakroom_w'); shut(d);
  const why = R.give('charge', 'breakroom_w'); R.until(() => !!D.ops[0] && !isNaN(D.ops[0].setT), 45);
  const op = D.ops[0], lead = op?.lead, h = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
  const out: any = { why, lead: lead?.callsign, at: NaN, stowedShots: 0, shots: 0, over: false, dropped: false, spentAtDrop: NaN, set: 0, setAt: NaN, spent: NaN, dead: false, by: '' };
  if (!op || !lead || !h) return out;
  const lp = lead.char.pos; let at: number[] | null = null;
  find: for (const r of [3, 4, 2.5, 5, 6]) for (let a = 0; a < 24; a++) { const q = [lp[0] + Math.sin(a * Math.PI / 12) * r, 0, lp[2] + Math.cos(a * Math.PI / 12) * r];
    if (g.col.nav.isBlocked(q[0], q[2]) || g.col.segmentBlocked([lp[0], 1.5, lp[2]], [q[0], 1.2, q[2]]) || dist(q, g.player.char.pos) < 1.5) continue;
    const was = [...h.char.pos]; h.char.pos[0] = q[0]; h.char.pos[2] = q[2]; h.char.update(0); if (g.fight.sightOn(lead, h).visible) { at = q; break find; } h.char.pos[0] = was[0]; h.char.pos[2] = was[2]; h.char.update(0); }
  if (!at) return out; out.at = dist(at, lp);
  const n0 = D.charges, t0 = g.time; let last = lead.weapon.roundsReady;
  R.post = () => { if (h.state !== 'dead') { h.char.pos[0] = at![0]; h.char.pos[2] = at![2]; h.path = []; h.pathGoal = null; h.speed = 0; h.hold = true; h.pinned = true; h.dazzledUntil = g.time + 5; h.weapon.mag = 0; h.weapon.chamber = 0; h.fireCd = 9; }
    lead.staggerUntil = -1; lead.dazzledUntil = -1; let k = 0; for (const m of g.guards) if (m.team === 'operative' && m !== lead) { m.weapon.mag = 0; m.weapon.chamber = 0; m.dazzledUntil = g.time + 5; m.char.pos[0] = 15 - k++; m.char.pos[2] = 17.6; m.path = []; m.pathGoal = null; m.speed = 0; } };
  for (let i = 0; i < 60 * 12 && D.ops.includes(op) && op.phase === 'place'; i++) { const had = !!lead.workStow; R.step();
    const now = lead.weapon.roundsReady; if (now < last) { out.shots += last - now; if (had) out.stowedShots += last - now; } last = now;
    if (lead.script?.over) out.over = true; if (isNaN(op.setT) && !out.dropped) { out.dropped = true; out.spentAtDrop = n0 - D.charges; }
    if (isNaN(out.setAt) && D.set.length) out.setAt = g.time - t0; }
  out.set = D.set.length; out.spent = n0 - D.charges; out.dead = h.state === 'dead'; out.by = g.guards.find((k: any) => k.char.id === h.killerId)?.callsign ?? ''; R.post = null;
  return out;
}
export async function workstowMate(): Promise<boolean> {
  const F = family('workstow-mate: a teammate setting a charge has both hands on it — his gun hangs, no round leaves it, and the fight takes him off the job');
  await kept(async () => {
    const A = await mateRun(false), want = WORKSTOW.mateDown + DOORTOOLS.setSecs;
    F.verdict(A.why === null && A.spent === 1 && A.hungAll && A.lockedAll && A.firedInside === 0 && A.two && A.wrists[0] < 0.3 && A.wrists[1] < 0.3 && Math.abs(A.setIn - want) < 0.1,
      'from the frame he is on the job his gun hangs and his fire site is locked; both wrists are on the charge; it is set mateDown + setSecs after he came onto it',
      `${A.lead} · the order: ${A.why ?? 'taken'} · hung on every frame ${A.hungAll} · locked on every frame ${A.lockedAll} · rounds gone ${A.firedInside} · wrists ${f2(A.wrists[0])} / ${f2(A.wrists[1])} m off the charge, two hands ${A.two} · SET ${f2(A.setIn)} s after he came onto it (want ${f2(want)}) · spent ${A.spent}`);
    F.verdict(A.lockedAtSet && Math.abs(A.upIn - WORKSTOW.mateUp) < 0.06 && !A.hungAfter && A.net, 'the gun is his again mateUp after the charge is set, not sooner; a round forced out of a hung gun puts it in his hands at once',
      `locked on the frame it is set ${A.lockedAtSet} · HIS AGAIN ${f2(A.upIn)} s after (mateUp ${WORKSTOW.mateUp}) · hung then ${A.hungAfter} · the net ${A.net}`);
    const B = await mateRun(true);
    F.verdict(B.why === null && B.dropped && B.spentAtDrop === 0 && Math.abs(B.upAfterDrop - WORKSTOW.mateUp) < 0.08 && B.heldOff && B.again > 0 && B.spent === 1,
      'the fight has him half way through (he is blinded): the job is dropped with nothing spent, his gun is up mateUp later, nothing is set while it has him, and he sets it when it lets him go',
      `${B.lead} · dropped ${B.dropped} · spent at the drop ${B.spentAtDrop} · gun up ${f2(B.upAfterDrop)} s after · held off while it had him ${B.heldOff} · set ${f2(B.again)} s after it let him go · spent ${B.spent}`);
    const C = await mateSeen();
    F.verdict(C.why === null && C.at > 0 && C.over && C.dropped && C.spentAtDrop === 0 && C.stowedShots === 0 && C.shots > 0 && C.dead && C.by === C.lead && C.set === 1 && C.spent === 1 && C.setAt > WORKSTOW.mateDown + DOORTOOLS.setSecs + 0.2,
      'a man steps into his view as he sets it: the room fight takes him off the job with nothing spent, no round leaves his gun while it is out of his hands, he drops the man with it back up, and then he sets the charge',
      `${C.lead} · the man ${f2(C.at)} m off · the room fight had him ${C.over} · dropped ${C.dropped}, spent at the drop ${C.spentAtDrop} · rounds out of his gun ${C.shots}, of them with it out of his hands ${C.stowedShots} · the man down ${C.dead}${C.by ? ` by ${C.by}` : ''} · set ${C.set} at ${f2(C.setAt)} s (spent ${C.spent})`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── a wall
export async function workstowWall(): Promise<boolean> {
  const F = family('workstow-wall: the same on a wall charge — by your hands, and on order');
  await kept(async () => {
    const WP: any = await import('./wallcharge-probes.ts'), SCN = 'block-squads';
    try {
      // by your hands (the wall probes' own man alone: the door tools' bag, the row at the foot of a partition)
      { const R: any = await hushed(() => WP.rig(SCN, 7, { squad: false })); WORKSTOW.on = !BREAK; HANDWORK.on = true; KITANIM.on = false; const { C, game: g } = R, pl = g.player;
        const P = WP.partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return; }
        const foot = WCM.wallPt(P.W, 0, 0.55); g.teleportPlayer(foot); R.aim(P.top); arm(R, 'pistol'); g.teleportPlayer(foot); R.aim(P.top);
        const sel = g.selectVerb('wall', 'charge'); R.press('Space'); const t0 = g.time; let away = 0, n = 0, wr = [NaN, NaN], two = false;
        while (C.set.length === 0 && n < 60 * 6) { R.step(); n++; if (!C.setting) break; if (inHand(pl) === 'nothing') away++; const J = C.samJob, s = (C as any).sam; if (J && s && Math.abs((g.time - s.t0) - DOORTOOLS.setSecs * 0.4) < 0.01) { wr = [dist3(pl.char.bones.handL, J.p), dist3(pl.char.bones.handR, J.p)]; two = pl.char.anim.workInfo().two; } }
        const secs = g.time - t0; R.step(60);
        F.verdict(sel && C.set.length === 1 && away >= n - 2 && two && wr[0] < 0.3 && wr[1] < 0.3 && inHand(pl) === 'pistol' && secs < DOORTOOLS.setSecs + 0.3,
          'by your hands: the pistol is away from the row to the charge set, both wrists are on it, and it is back in his hand after', `row ${sel} · set ${C.set.length} · away on ${away} of ${n} frames · wrists ${f2(wr[0])} / ${f2(wr[1])} m, two hands ${two} · ${f2(secs)} s · in hand after: ${inHand(pl)}`); }
      // …and begun pressed to that wall, where the hold already has his gun away and owes it back: the job takes the debt over, and it is not drawn as he comes off the wall
      { const R: any = await hushed(() => WP.rig(SCN, 7, { squad: false })); WORKSTOW.on = !BREAK; HANDWORK.on = true; KITANIM.on = false; const { C, game: g } = R, pl = g.player;
        const P = WP.partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return; }
        const foot = WCM.wallPt(P.W, 0, 0.55); g.teleportPlayer(foot); R.aim(P.top); arm(R, 'pistol'); g.teleportPlayer(foot); R.aim(P.top);
        for (const off of [0.55, 0.45, 0.38, 0.32]) { if (pl.wall) break; g.teleportPlayer(WCM.wallPt(P.W, 0, off)); R.aim(P.top, 6); R.press('KeyQ'); R.step(40); }
        R.aim(P.top); const held = !!pl.wall, owed = !!pl.wall?.drawn, before = inHand(pl);
        const sel = g.selectVerb('wall', 'charge'); R.press('Space'); let away = 0, n = 0;
        while (C.set.length === 0 && n < 60 * 6) { R.step(); n++; if (!C.setting) break; if (inHand(pl) === 'nothing') away++; }
        R.step(60);
        F.verdict(held && owed && before === 'nothing' && sel && C.set.length === 1 && away >= n - 2 && inHand(pl) === 'pistol',
          'begun pressed to the wall with the pistol owed back: it stays away for the whole plant and is in his hand after', `on the wall ${held}, the pistol owed back ${owed}, in hand ${before} · row ${sel} · set ${C.set.length} · away on ${away} of ${n} frames · in hand after: ${inHand(pl)}`); }
      // on order
      { const R: any = await hushed(() => WP.rig(SCN, 7)); WORKSTOW.on = !BREAK; HANDWORK.on = true; const { C, O, game: g } = R;
        const P = WP.partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return; }
        R.gather(P.near, 75, P.p); const why = O.give(WCM.WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => !!C.ops[0] && !isNaN(C.ops[0].setT), 60);
        const op = C.ops[0], lead = op?.lead; let hung = true, locked = true, n = 0; const onT = g.time, set0 = C.set.length;
        while (op && C.set.length === set0 && C.ops.includes(op) && n < 60 * 8) { R.step(); n++; if (C.set.length > set0) break; hung &&= !!lead.workStow && stowHang(g, lead); locked &&= sideLocked(g, lead); }
        const setIn = g.time - onT, tSet = g.time; for (let i = 0; i < 120 && lead?.workStow; i++) R.step();
        F.verdict(!!op && C.set.length === set0 + 1 && hung && locked && Math.abs(setIn - (WORKSTOW.mateDown + DOORTOOLS.setSecs)) < 0.1 && Math.abs(g.time - tSet - WORKSTOW.mateUp) < 0.06,
          'on order: the setter\'s gun hangs and is locked from the frame he is on the wall; set mateDown + setSecs after; his again mateUp after that',
          `the order: ${why ?? 'taken'} · ${lead?.callsign} · hung ${hung} · locked ${locked} · set ${f2(setIn)} s after he came onto it · his again ${f2(g.time - tSet)} s after`); }
    } finally { WP.restoreKnobs(); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function workstowOff(): Promise<boolean> {
  const F = family('workstow-off: the switch off is the build as it was; on with no charge set, the same run');
  await kept(async () => {
    { const R: any = await hushed(() => rig(11, { stage: false })); const { game: g, D } = R, pl = g.player; raise(false); WORKSTOW.on = false; soloWith(g, 2);
      const d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]); shut(d); arm(R, 'pistol'); const s0 = { ...WORKSTOW_STATS }, P = plant(R, d, side);
      F.verdict(!!P && P.set && P.away === 0 && P.held1 === 'pistol' && Math.abs(P.secs - DOORTOOLS.setSecs) < 0.25 && !pl.workStow && WORKSTOW_STATS.samDown === s0.samDown,
        'off, by your hands: the pistol never leaves his hand and the plant is setSecs', P ? `away on ${P.away} of ${P.frames} frames · ${f2(P.secs)} s · in hand after: ${P.held1}` : 'the row never started'); }
    { const on = WORKSTOW.on; WORKSTOW.on = false; const R: any = await hushed(() => rig(7, { door: 'breakroom_w' })); OWNCHARGE.on = true; HANDWORK.on = true; WORKSTOW.on = false; const { D, game: g } = R; const d = R.door('breakroom_w'); shut(d);
      R.give('charge', 'breakroom_w'); R.until(() => !!D.ops[0] && !isNaN(D.ops[0].setT), 45); const op = D.ops[0], lead = op?.lead, onT = g.time; let ever = false;
      while (op && D.set.length === 0 && D.ops.includes(op) && g.time - onT < 8) { R.step(); ever ||= !!lead.workStow || stowHang(g, lead) || sideLocked(g, lead); }
      F.verdict(!!op && D.set.length === 1 && !ever && Math.abs(g.time - onT - DOORTOOLS.setSecs) < 0.06, 'off, on order: his gun never leaves his hands and the charge is set setSecs after he came onto it', `set ${D.set.length} · ever hung or locked ${ever} · ${f2(g.time - onT)} s`); WORKSTOW.on = on; }
    { const on = WORKSTOW.on; const R: any = await hushed(() => rig(7, { door: 'breakroom_w' })); OWNCHARGE.on = true; HANDWORK.on = false; WORKSTOW.on = true; const { D, game: g } = R; const d = R.door('breakroom_w'); shut(d);
      R.give('charge', 'breakroom_w'); R.until(() => !!D.ops[0] && !isNaN(D.ops[0].setT), 45); const op = D.ops[0], lead = op?.lead, onT = g.time; let ever = false;
      while (op && D.set.length === 0 && D.ops.includes(op) && g.time - onT < 8) { R.step(); ever ||= !!lead.workStow || stowHang(g, lead) || sideLocked(g, lead); }
      F.verdict(!!op && D.set.length === 1 && !ever && Math.abs(g.time - onT - DOORTOOLS.setSecs) < 0.06, 'on, with the hands that do the work off: no gun is put away for a job no hands go to — the charge is set setSecs after he came onto it', `set ${D.set.length} · ever hung or locked ${ever} · ${f2(g.time - onT)} s`); WORKSTOW.on = on; HANDWORK.on = true; }
    const run = async (on: boolean) => { const R: any = await hushed(() => rig(11, { stage: false })); WORKSTOW.on = on; const g = R.game; soloWith(g, 2); R.input.keys.add('KeyW'); R.step(240); R.input.keys.delete('KeyW'); R.step(120); return hashDigest(digestGame(g, true)) as string; };
    const a = await run(false), b = await run(true);
    F.verdict(a === b, 'the switch on with no charge set is the run with it off, by digest', `off ${a} · on ${b}`);
    { const R: any = await hushed(() => rig(11, { stage: false })); const g = R.game; WORKSTOW.on = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), rides = snap.tables?.WORKSTOW?.on === true; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WORKSTOW;
      const both = await hushed(() => { applyKnobs(g, old); const off = WORKSTOW.on === false; applyKnobs(g, snap); return [off, WORKSTOW.on === true]; }); WORKSTOW.on = false;
      F.verdict(rides && both[0] && both[1], 'the switch rides the knob snapshot, and a recording from before the key replays with it off', `in the snapshot ${rides} · one without the key: off ${both[0]} · one with it: on ${both[1]}`); }
    const reg = knobRegistry() as Record<string, unknown>;
    F.verdict(reg.WORKSTOW === WORKSTOW && (JOURNAL_KNOBS as string[]).includes('WORKSTOW') && (FROZEN_HOLDS as Record<string, string>)['WORKSTOW.on'] === 'TPS_WORKSTOW=1',
      'the table is in the knob registry and a recording carries it; the frozen stand holds it off under TPS_WORKSTOW=1', `registry ${reg.WORKSTOW === WORKSTOW} · journal ${(JOURNAL_KNOBS as string[]).includes('WORKSTOW')} · hold ${(FROZEN_HOLDS as Record<string, string>)['WORKSTOW.on']}`);
  });
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2); const all: [string, () => Promise<boolean>][] = [['sam', workstowSam], ['mate', workstowMate], ['wall', workstowWall], ['off', workstowOff]];
  const bad = want.filter(w => !all.some(([n]) => n === w)); if (bad.length) { console.error(`unknown: ${bad.join(' ')} (sam mate wall off)`); process.exit(2); }
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) { try { ok = (await fn()) && ok; } catch (e) { ok = false; console.log(`- FAIL — workstow-${n} threw\n    ${(e as Error).stack}`); } }
  console.log(`\n=== workstow-check: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
