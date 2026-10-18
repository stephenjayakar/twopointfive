// THE BALLISTIC SHIELD — a teammate's loadout row (kit.ts 'shield'): a plate he carries in front of him on his left arm, a pistol in the other hand, first through
// the door on the entry orders that exist (doortools.ts / orders.ts / the night breach's drill).
//
// ONE MODEL. The shield is ONE BOX on the man (shieldBox): the frame draws that box (combat.ts handProps → shieldBoxes) and the round test hits that box
// (combat.ts fireWeapon → shieldStop). There are no hit points and no chance in it: a round whose line meets the plate before it meets him stops in the plate; a
// round whose line does not — from his side, from behind, under the plate's bottom edge at his shins, over its top at his crown — meets his body column exactly
// as it always did and drops him. What it covers is geometry: a 0.6 × 1.2 m plate 0.36 m ahead of his shoulders, square to the SHOULDER line (so it turns with
// his aim), bottom edge at half a metre standing and near the floor crouched. Against the 0.28 m body column that is his chest line from about 40° either side of the way the plate faces (measured from 4 m).
//
// It stops only rounds of a side HOSTILE to the carrier (a teammate's round passes it as it passes him — muzzle discipline keeps those in, not the plate), and
// only while he is alive: a dead man's shield lies on the floor beside him and covers nothing.
//
// WHAT THE OTHER SIDE DOES ABOUT IT (the cheap half; flanking is the enemy squads' own 'go round' and is not touched): a defender aims at the trunk like always, so
// his first rounds die in the plate. Once HIS OWN rounds have been stopping in that man's shield for SHIELD.learnSecs he (a) takes another enemy he can see who
// is not behind it (guards.ts acquireFoe ← shieldBlocks), else (b) comes down under the plate at the shins when that line is open (guards.ts alert branch ←
// shieldAim; his aim re-settles once, so the switch costs him a beat). A man with the flank never needed either: the plate is not on his line.
//
// WITH NO SHIELD CARRIED every export here returns on its first test (`given` 0, or nobody in the WeakSet): no dice drawn, no state written — a run without the
// row digests as it did before this file (tools/qa/shield-probes.ts shieldIdentity; the playthrough digests in rebuild/gear/shield/read-first.md).
//
// Nothing here reads another game module at load (the import-cycle rule): the tables below are plain literals.
import { SideMap, SideSet, rollbackVar } from '../math/side';
import { v3, lerp, type Vec3 } from '../math/vec';
import { BoxFlag, makeBox, rayBox, type Box } from '../scene/boxes';
import { isHostile, type Team } from './teams';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Character } from './character';
import { alongOf } from './doortools';   // (called inside shieldDeal only: nothing of doortools.ts is touched at load)

export const SHIELD = {
  /** the whole row off: nobody is handed one, whatever his card says (kit.ts kitStage reads it) */
  on: true,
  /** the plate's half extents: across, up, through (m) — a 0.6 × 1.2 m entry shield */
  half: [0.3, 0.6, 0.02] as Vec3,
  /** its centre ahead of his shoulder line, square to it, and off to his left (m): the left forearm carries it, the pistol comes round its right edge */
  ahead: 0.36, left: 0.05,
  /** the carry handle on its back, over the plate's centre (m) */
  grip: 0.12,
  /** its bottom edge over his soles standing / fully crouched (m): below it his shins show; crouched he is all behind it */
  bottom: 0.5, bottomCrouch: 0.1,
  /** a carrier's hands: his pistol is fired one-handed round the plate's edge (roomfight.ts tickOp multiplies his spread by this) */
  handsK: 1.4,
  /** a defender LEARNS a man's shield from his OWN rounds: at least `learnRounds` of them stopped in it, the first `learnSecs` ago or more — rounds more than
   *  `learnGap` s apart are not one lesson (a stray into the plate, then nothing, teaches nobody) */
  learnSecs: 1.2, learnRounds: 2, learnGap: 6,
  /** once he has come down under it he stays down this long after the plate last stood on his chest line (no flipping aim as the carrier's chest swings) */
  lowHold: 0.6,
  /** …then he takes another enemy in his sight who is not behind it */
  retarget: true,
  /** …else he aims under it: this high over the carrier's soles (m), when that line clears the plate */
  aimLow: true, lowY: 0.25,
  /** the carrier takes the lead's mark in a stack and goes first through an ordered entry (off: he stacks and enters by the usual rules, shield and all) */
  first: true,
  /** a grenade's burst in front of the plate (frag.ts blast: the hand frag, the 40 mm): when the line from the burst to the carrier's chest meets his plate he is
   *  the blast's 'shielded' outcome. Only him — the plate is not a wall: the men behind are covered by what walls and furniture already say; a burst beside or
   *  behind him, or at his feet under its bottom edge, judges him as a bare man. Off: every blast judges him bare (as before the gear builds met) */
  blast: true,
  /** the picture: the plate, its viewport strip (a darker band near the top edge), and how it lies by a dead man */
  albedo: [0.07, 0.075, 0.08] as Vec3, port: [0.16, 0.2, 0.22] as Vec3, portHalf: [0.11, 0.035] as [number, number], portBelowTop: 0.14,
};
/** counters for the probes and the tally (never read by the game) */
export const SHIELD_STATS = { given: 0, stopped: 0, learned: 0, low: 0, retargets: 0, led: 0 };

const CARRY = new SideSet<Guard>('shield.CARRY');
/** how many shields have ever been handed out in this process: 0 = every query below is one compare */
let given = 0;
rollbackVar('shield.given', () => given, v => { given = v; });
/** shooter → carrier → his lesson: when the first and the last of his rounds stopped in that man's shield, how many, and whether he now knows it */
const SEEN = new SideMap<Guard, WeakMap<Guard, { t0: number; last: number; n: number; known: boolean }>>('shield.SEEN');
/** shooter → the carrier he has come down under, and until when he stays down (the switch re-settles his aim once per carrier, never again) */
const LOW = new SideMap<Guard, { foe: Guard; until: number }>('shield.LOW');

/** Hand a man the shield (kit.ts kitStage, off his card; the probes directly). His animator carries the left arm for it from the next frame. */
export function giveShield(gd: Guard) {
  if (CARRY.has(gd)) return; CARRY.add(gd); given++; SHIELD_STATS.given++;
  const A = gd.char.anim, H = SHIELD.half; A.shield = true;
  A.shieldCarry = { ahead: SHIELD.ahead, left: SHIELD.left, halfW: H[0], gripY: SHIELD.bottom + H[1] + SHIELD.grip, gripYCrouch: SHIELD.bottomCrouch + H[1] + SHIELD.grip };
}
/** he was handed a shield (dead or alive) */
export function shieldCarried(gd: Guard): boolean { return given > 0 && CARRY.has(gd); }
/** any shield has been handed out in this process (callers' cheap gate before they work out arguments) */
export function shieldAny(): boolean { return given > 0; }
/** he is alive and has the plate up */
export function plateUp(gd: Guard): boolean { return given > 0 && CARRY.has(gd) && gd.state !== 'dead' && gd.char.alive; }
/** the living shield man among these, if any (the first of them) */
export function shieldFirst(men: readonly Guard[]): Guard | null {
  if (!given || !SHIELD.first) return null;
  for (const m of men) if (plateUp(m)) return m;
  return null;
}

/** where the plate is on a living carrier: centre, the unit vector it faces along (XZ), its yaw. It hangs in the SHOULDERS' frame — square to the line between
 *  the two shoulder joints, ahead of its middle — the frame character.ts's shield layer puts his hands in, so plate and hands turn together. */
function frame(gd: Guard): { c: Vec3; fx: number; fz: number; yaw: number } {
  const ch = gd.char, sl = ch.bones.upperArmL, sr = ch.bones.upperArmR;
  let fx = Math.sin(ch.bodyYaw), fz = Math.cos(ch.bodyYaw), ox = ch.pos[0], oz = ch.pos[2];   // (no bones yet: his feet's facing, over his feet)
  if (sl && sr) { const dx = sl[0] - sr[0], dz = sl[2] - sr[2], L = Math.hypot(dx, dz); if (L > 0.05) { fx = -dz / L; fz = dx / L; } ox = (sl[0] + sr[0]) / 2; oz = (sl[2] + sr[2]) / 2; }
  const y = ch.pos[1] + lerp(SHIELD.bottom, SHIELD.bottomCrouch, ch.anim.crouch) + SHIELD.half[1];
  // (his left, with +z forward and y up: (fz, 0, −fx))
  return { c: [ox + fx * SHIELD.ahead + fz * SHIELD.left, y, oz + fz * SHIELD.ahead - fx * SHIELD.left], fx, fz, yaw: Math.atan2(fx, fz) };
}
/** THE PLATE as a box, on a living carrier (null: no shield, or he is down). The one box both the picture and the round test use. */
export function shieldBox(gd: Guard): Box | null {
  if (!plateUp(gd)) return null;
  const F = frame(gd);
  return makeBox({ c: F.c, h: [...SHIELD.half] as Vec3, yaw: F.yaw, albedo: [...SHIELD.albedo] as Vec3, rough: 0.45, flags: BoxFlag.Dynamic, owner: gd.char.id & 0xff });
}

/** A ROUND'S LINE AGAINST THE SHIELDS (combat.ts fireWeapon, after the body tests): the nearest plate of a living carrier of a side hostile to `team` that the
 *  segment ro + rd·[0, tmax] meets — tmax being where the round would otherwise have stopped (a body, a wall). Null with no shield on the floor. */
export function shieldStop(g: Game, team: Team, ro: Vec3, rd: Vec3, tmax: number): { t: number; gd: Guard } | null {
  if (!given) return null;
  let best: { t: number; gd: Guard } | null = null;
  for (const gd of g.guards) {
    if (!CARRY.has(gd) || gd.god || !isHostile(team, gd.team)) continue;
    const b = shieldBox(gd); if (!b) continue;
    const h = rayBox(ro, rd, b, best ? best.t : tmax);
    if (h) best = { t: h.t, gd };
  }
  return best;
}
/** the segment from → to meets this carrier's plate */
export function shieldCovers(carrier: Guard, from: Vec3, to: Vec3): boolean {
  const b = shieldBox(carrier); if (!b) return false;
  const d = v3.sub(to, from), L = v3.len(d); if (L < 1e-4) return false;
  return rayBox(from, v3.scale(d, 1 / L), b, L) !== null;
}

/** A round stopped in `carrier`'s shield (combat.ts). `shooter` = the man whose AIMED round it was (null: a blind round, Sam's, a stray — counted, teaches nobody). */
export function shieldNote(g: Game, shooter: Guard | null, carrier: Guard) {
  SHIELD_STATS.stopped++;
  if (!shooter) return;
  let m = SEEN.get(shooter); if (!m) SEEN.set(shooter, m = new SideMap());
  const r = m.get(carrier), t = g.time;
  if (!r || (!r.known && (t < r.t0 || t - r.last > SHIELD.learnGap))) m.set(carrier, { t0: t, last: t, n: 1, known: false });   // (a fresh lesson; t < t0: a checkpoint load took Game.time back)
  else { r.n++; r.last = t; }
}
/** he has learned that this man's shield eats his rounds (and, once he has, he goes on knowing it) */
function learned(g: Game, shooter: Guard, carrier: Guard): boolean {
  const r = SEEN.get(shooter)?.get(carrier); if (!r) return false;
  if (!r.known && r.n >= SHIELD.learnRounds && g.time - r.t0 >= SHIELD.learnSecs && g.time - r.last <= SHIELD.learnGap) { r.known = true; SHIELD_STATS.learned++; }
  return r.known;
}
/** how the shield men were lost, newest last (the probes and the tally read it; the game never does): the round's bearing off the way his chest faced (0 = dead
 *  ahead, + = round to his left; of the leg it reached him on — a round turned in glass on the way came from where the glass sent it), how high over his soles
 *  it met him, how far it came (muzzle to him) */
export const SHIELD_LOG: { t: number; who: string; by: string; deg: number; y: number; dist: number }[] = [];
/** A round has found a living shield man's body (combat.ts, before the kill): write down where it came from. */
export function shieldLost(g: Game, carrier: Guard, by: string, muzzle: Vec3, hitP: Vec3, legDir?: Vec3) {
  if (!plateUp(carrier)) return;
  const F = frame(carrier), dx = muzzle[0] - hitP[0], dz = muzzle[2] - hitP[2];
  const bx = legDir ? -legDir[0] : dx, bz = legDir ? -legDir[2] : dz;   // (legDir: the way the round was flying on its LAST leg — it came through glass and was turned there: the bearing it reached him on is that leg's, not the muzzle's; the distance stays the muzzle's)
  let deg = (Math.atan2(bx, bz) - F.yaw) * 180 / Math.PI; deg = ((deg + 540) % 360) - 180;
  SHIELD_LOG.push({ t: +g.time.toFixed(2), who: carrier.callsign, by, deg: Math.round(deg), y: +(hitP[1] - carrier.char.pos[1]).toFixed(2), dist: +Math.hypot(dx, dz).toFixed(1) });
  if (SHIELD_LOG.length > 256) SHIELD_LOG.shift();
}
/** a burst at `from` meets this living carrier's plate on its way to his chest (frag.ts blast; SHIELD.blast) */
export function shieldBlast(carrier: Guard, from: Vec3): boolean { return given > 0 && SHIELD.blast && plateUp(carrier) && shieldCovers(carrier, from, chestPoint(carrier.char)); }
/** `gd` knows `foe`'s shield and it stands between his gun (`from`) and the man's chest (`chest`) right now: the plate is all he would hit */
export function shieldBlocks(g: Game, gd: Guard, foe: Guard | 'player' | null, from: Vec3, chest?: Vec3): boolean {
  if (!given || !foe || foe === 'player' || !plateUp(foe) || !learned(g, gd, foe)) return false;
  return shieldCovers(foe, from, chest ?? chestPoint(foe.char));
}
/** the plate `carrier` holds is on the line from `from` to this other man's chest: he is behind the same shield (guards.ts acquireFoe: no better a man to be on) */
export function shieldScreens(carrier: Guard, from: Vec3, c: Character): boolean { return shieldCovers(carrier, from, chestPoint(c)); }
const chestPoint = (c: Character): Vec3 => { const t = c.bones.chest ?? c.pos; return [t[0], c.pos[1] + 1.25, t[2]]; };
/** WHERE A DEFENDER WHO KNOWS THE SHIELD PUTS HIS ROUNDS (guards.ts alert branch, after it has its chest point `aimAt`): the carrier's shins under the plate,
 *  when the chest line is in the plate (or was within SHIELD.lowHold — he does not bob up and down as the carrier's chest swings) and the low line is not.
 *  Null = aim as ever (no shield, not learned yet, he has the flank, or nothing shows under it). A pure question: the caller says so when it TAKES the low
 *  line (shieldLow), which is what re-settles his aim. */
export function shieldAim(g: Game, gd: Guard, foe: Guard | 'player' | null, from: Vec3, aimAt: Vec3): Vec3 | null {
  if (!given || !SHIELD.aimLow || !foe || foe === 'player' || !plateUp(foe)) return null;
  const L = LOW.get(gd), held = !!L && L.foe === foe && g.time < L.until && g.time >= L.until - SHIELD.lowHold;
  if (!held && !shieldBlocks(g, gd, foe, from, aimAt)) return null;
  const c = foe.char, h = c.bones.hips ?? c.pos, low: Vec3 = [h[0], c.pos[1] + SHIELD.lowY, h[2]];
  return shieldCovers(foe, from, low) ? null : low;
}
/** He has taken the low line on that man this frame (guards.ts, after its own clear-shot test of it). The FIRST time on a carrier he comes off the plate and
 *  lines the legs up from nothing — a beat; after that only the hold is renewed. */
export function shieldLow(g: Game, gd: Guard, foe: Guard | 'player' | null, from: Vec3, chest: Vec3) {
  if (!foe || foe === 'player') return;
  const L = LOW.get(gd);
  if (!L || L.foe !== foe) { LOW.set(gd, { foe, until: g.time + SHIELD.lowHold }); SHIELD_STATS.low++; gd.aim.clear(); return; }
  if (shieldCovers(foe, from, chest)) L.until = g.time + SHIELD.lowHold;   // (renewed only while the plate IS on his chest line: off it, the hold runs out)
}

/** A STACK'S DEAL with a shield man in it (orders.ts 'stack up'; doortools.ts stackable / start): he takes the LEAD's mark — of the marks flagged lead, the one
 *  furthest along the frame line from the hinge (the latch jamb's: the rule both callers pick the lead by) — and the man dealt it takes his. When the two are of
 *  different PAIRS (`pairOf`: orders.ts pairOf — red / blue on a four), their partners trade marks too, so each pair still stands together on its own file. In
 *  place; the same array back. */
export function shieldDeal(deal: [Guard, Vec3][], posts: readonly { pos: Vec3; lead: boolean }[], d: Door, pairOf?: (gd: Guard) => unknown): [Guard, Vec3][] {
  if (!given || !SHIELD.first) return deal;
  const si = deal.findIndex(([gd]) => plateUp(gd)); if (si < 0) return deal;
  let li = -1, la = -Infinity;
  deal.forEach(([, p], i) => { if (!posts.find(x => x.pos === p)?.lead) return; const a = alongOf(d, p); if (a > la) { la = a; li = i; } });
  if (li < 0 || li === si) return deal;
  const swap = (a: number, b: number) => { const p = deal[a][1]; deal[a][1] = deal[b][1]; deal[b][1] = p; };
  const ps = pairOf?.(deal[si][0]) ?? null, pl = pairOf?.(deal[li][0]) ?? null;
  if (pairOf && ps !== null && pl !== null && ps !== pl) {
    const sj = deal.findIndex(([gd], i) => i !== si && pairOf(gd) === ps), lj = deal.findIndex(([gd], i) => i !== li && pairOf(gd) === pl);
    if (sj >= 0 && lj >= 0) swap(sj, lj);
  }
  swap(si, li);
  return deal;
}

/** THE PICTURE (combat.ts handProps, once per man per frame): the plate + its viewport on a living carrier; flat on the floor beside a dead one. */
export function shieldBoxes(gd: Guard, out: Box[]) {
  if (!given || !CARRY.has(gd)) return;
  const owner = gd.char.id & 0xff, H = SHIELD.half;
  if (gd.state === 'dead' || !gd.char.alive) {
    const h = gd.char.bones.hips ?? gd.char.pos, yaw = gd.char.bodyYaw + 0.6;
    out.push(makeBox({ c: [h[0] + Math.cos(yaw) * 0.55, gd.char.pos[1] + H[2] + 0.005, h[2] - Math.sin(yaw) * 0.55], h: [H[0], H[2], H[1]], yaw, albedo: [...SHIELD.albedo] as Vec3, rough: 0.45, flags: BoxFlag.Dynamic, owner }));
    return;
  }
  const plate = shieldBox(gd); if (!plate) return;
  out.push(plate); const F = { c: plate.c, yaw: plate.yaw };
  // the viewport: a thin band proud of both faces near the top edge (what he looks through; drawn only — the plate behind it is the plate)
  const py = F.c[1] + H[1] - SHIELD.portBelowTop;
  out.push(makeBox({ c: [F.c[0], py, F.c[2]], h: [SHIELD.portHalf[0], SHIELD.portHalf[1], H[2] + 0.004], yaw: F.yaw, albedo: [...SHIELD.port] as Vec3, rough: 0.12, flags: BoxFlag.Dynamic, owner }));
}
