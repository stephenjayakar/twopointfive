// THE BREACHING SHOTGUN (gear, 10-08 — the maintainer: "more gear (eg frag grenades)"; weapons.ts row 'm870'): a pump gun a teammate's loadout card hands him in
// place of his rifle (kit.ts), and that you may bring in place of the FN2000. Two things make it a shotgun and both live here:
//
//   A SHELL IS NINE ROUNDS. fireShell is what combat.ts fireWeapon becomes for a row with `pellets` (weapons.ts PelletSpec): every pellet goes through fireWeapon
//   itself — the game's own hit scan, the same walls, leaves, furniture, panes and bodies, a hole and a puff where each stops — the first down the bore as the
//   shooter's hands hold it (it carries the shell's one flash, report and hearing event), the rest drawn evenly over a disc round that line. What it does to a
//   man is the PATTERN's doing, never a count kept on him: inside `dropM` any one pellet puts him down; past it only `need` or more of ONE shell do, and a man
//   caught by fewer is peppered (launcher.ts staggerGuard: doubled over a second and a half, alert, standing). The disc is a metre across at eight metres and
//   three across at twenty-five, so the same rule that is near certain in a room is a poor bet down a corridor — tools/qa/shotgun-probes.ts prints the curve.
//   Of the nine, every third counts as a round going past a head (suppression.ts) and as a round into the beaten zone (destruction.ts): a shell is loud, it is
//   not thirty rounds of automatic fire. GLASS (glasspen.ts, the shell rule; rebuild/gear-and-glass/pellets.md): every pellet that meets a pane marks it —
//   through it or spent in it alike — except where it lands on a mark this same shell has already made there (`glass` on the Shell): nine pellets through one
//   spot are one ragged hole, and a muzzle pressed to the glass files one crossing, not nine.
//
//   IT TAKES A LOCK. `need` or more pellets of one shell into a LATCHED leaf within `latchM` of its latch edge, from a muzzle no more than `reachM` off, and the
//   keep is gone and the leaf goes in — doors.ts kickIn, the boot's own verb: a steel door rings and holds, the crack carries like the boot's, the lock is
//   broken for the rest of the run. That is true for whoever fires it and only of a leaf that is LOCKED: you, with the muzzle on the lock, and the man the door tools send (doortools.ts: a stack
//   whose man carries one takes a locked door with it from beside the frame instead of the boot from in front of it — `carriesBreacher` / `breachSpot` below). A door wedged from inside (digin.ts) has no keep to shoot: that one stays the boot's.
//
// With no such row in anybody's hands nothing here runs: fireWeapon's one test of `def.pellets` is the whole cost, and a run digests as it did.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import type { Door } from './doors';
import type { WeaponDef } from './weapons';
import { fireWeapon, type FireOpts } from './combat';
import { staggerGuard } from './launcher';
import { chronDoor } from './chronicle';
import { doorPt, alongOf, offOf } from './doortools';
import { bigSpots } from './bigkit';   // (asked inside breachSpot only)
import { kitBig } from './kit';   // (asked inside carriesBreacher only)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

/** counted since the page (or the harness) stood up — the probes' and the panel's */
export const SHOTGUN_STATS = { shells: 0, pellets: 0, inMen: 0, dropped: 0, peppered: 0, locks: 0 };
/** the last shell fired: what each pellet stopped in (the probes' and the console's — replaced, never grown) */
export const SHOTGUN_LAST: { ends: Shell['ends']; glass: Shell['glass'] } = { ends: [], glass: new Map() };
/** the door tools' side of it: `on` false = a stack never takes a lock with the gun (the boot, as before) · the stand-offs tried for the man who shoots the lock,
 *  safest first — [metres past the latch edge along the frame line (negative: in front of the leaf), metres off it] · he does not stand within `clear` of another
 *  man's mark while a spot further down the list is free (the second man with the gun does not shoot it from inside the lead on his jamb) · the lock he aims
 *  at: this far in from the latch edge, this high · shells he may put into it before the stack gives up on the gun and boots it · seconds his muzzle may take
 *  to come onto it.
 *  GLASS IS NOT COVER, for him too (orders.ts behindGlass — the stack's own rule; nothing of this runs while rounds stop in glass): where a spot of the list
 *  stands in a line of fire through a pane he takes the lock FROM HIS OWN SIDE of the frame instead of crossing the opening to stand in front of the sidelight
 *  his stack was moved off — from his own mark when it is clear of the opening, the lock within `markReach` of it, its bore on the leaf and no mate within
 *  `line` of the shot, else (his mark on the hinge side) from the first of `hinge` ([metres past the HINGE edge, metres off the wall]: every one clear of the
 *  opening by his arrival slack) that is clean; the list again only when that side has nothing. From such a place the shell waits `ownBeat` s for his gun
 *  to come up (the mark is where he already stands; a list spot's walk was that beat) and he is within `ownSlack` m of it, not the list's 0.4. `ownSide`: the same
 *  whenever his mark is on the hinge side, glass or no glass (a WALL at the latch jamb files the stack there too — the office's server room door from the
 *  manager's side); off = such a door is as it was, he crosses to the list's spot. */
export const SHOTGUN = {
  on: true,
  spots: [[0.45, 1.0], [0.25, 1.1], [0.05, 1.2], [-0.25, 1.3], [-0.5, 1.3]] as [number, number][], clear: 0.55,
  hinge: [[0.45, 1.0], [0.45, 1.2], [0.65, 1.2]] as [number, number][], markReach: 1.8, line: 0.45, ownBeat: 0.15, ownSlack: 0.25, ownSide: false,
  lockIn: 0.2, lockH: 1.0, shells: 2, aimCap: 2.5,
};

/** One shell on its way through fireWeapon (FireOpts.pellet): which pellet this is, the line the first one took, who the pattern has found so far, and what
 *  each pellet stopped in (col.raycast's index — a static, a leaf ≥ 1e6 — or −1: a man, furniture, the night). */
export interface Shell {
  def: WeaponDef; i: number; dir: Vec3 | null;
  /** null = the player */
  men: Map<Guard | null, { n: number; near: number; dir: Vec3; down: boolean }>;
  ends: { index: number; t: number; at: Vec3 }[];
  /** where this shell has marked glass so far (glasspen.ts ShellGlass: pane → x, y, z, through, mark-or-joined per pellet that met it — a later pellet on one of its marks adds nothing) */
  glass: Map<number, number[]>;
  /** the men (and you) this shell puts down, settled once the whole pattern has flown (combat.ts fireWeapon's own blocks) */
  late: (() => void)[];
}

/** A pellet has found a man `t` metres from the muzzle (combat.ts fireWeapon, in place of putting him down outright): does it? Inside `dropM` any pellet does;
 *  past it, the `need`-th of this shell to find him does. Booked either way. */
export function pelletDrops(s: Shell, who: Guard | null, t: number, dir: Vec3): boolean {
  const P = s.def.pellets!; let h = s.men.get(who); if (!h) s.men.set(who, h = { n: 0, near: t, dir, down: false });
  h.n++; h.near = Math.min(h.near, t); SHOTGUN_STATS.inMen++;
  if (!h.down && (t <= P.dropM || h.n >= P.need)) { h.down = true; SHOTGUN_STATS.dropped++; return true; }
  return false;
}
/** …and where it stopped, if it was not in a man (fireWeapon) */
export function pelletEnd(s: Shell, index: number, t: number, at: Vec3) { s.ends.push({ index, t, at }); }

/** One pull of a shotgun's trigger: `def.pellets.n` rounds through fireWeapon, then what the pattern as a whole did — the men it only peppered, the lock it took. */
export function fireShell(g: Game, shooter: Character, target: Vec3, isPlayer: boolean, o: FireOpts, def: WeaponDef) {
  const P = def.pellets!, shell: Shell = { def, i: 0, dir: null, men: new Map(), ends: [], glass: new Map(), late: [] };
  SHOTGUN_STATS.shells++; SHOTGUN_STATS.pellets += P.n;
  const muzzle = v3.copy(shooter.muzzle);
  fireWeapon(g, shooter, target, isPlayer, { ...o, weapon: def, pellet: shell });   // the first: down the bore as his hands hold it — the shell's flash, report and event are this one's
  const d0 = shell.dir ?? v3.normalize(v3.sub(target, muzzle));
  const ax = v3.normalize(v3.cross(d0, Math.abs(d0[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])), ay = v3.cross(ax, d0);
  for (let i = 1; i < P.n; i++) {   // the rest: evenly over the disc round that line (the game's dice, as every round's spread is)
    shell.i = i;
    const r = P.cone * Math.sqrt(simRandom()), a = simRandom() * Math.PI * 2, x = r * Math.cos(a), y = r * Math.sin(a);
    const dir = v3.normalize([d0[0] + ax[0] * x + ay[0] * y, d0[1] + ax[1] * x + ay[1] * y, d0[2] + ax[2] * x + ay[2] * y]);
    fireWeapon(g, shooter, v3.mad(muzzle, dir, 30), isPlayer, { weapon: def, steady: true, spread: 0, blind: o.blind, pellet: shell });
  }
  for (const f of shell.late) f();   // the men it puts down: now, all nine having flown (each stood in his own pattern's way to the last pellet)
  // the men the pattern found and did not put down: peppered — a flinch for you, for a civilian and for a man in your arm; anybody else doubles over
  for (const [who, h] of shell.men) {
    if (h.down) continue;
    SHOTGUN_STATS.peppered++;
    if (!who) { g.player.char.anim.hit(); g.player.hitFlash = 1; }
    else if (who.state === 'dead') continue;
    else if (who.civ) who.char.anim.hit();
    else staggerGuard(g, who, h.dir, shooter);
  }
  SHOTGUN_LAST.ends = shell.ends; SHOTGUN_LAST.glass = shell.glass;
  // the lock: enough of the shell into a latched leaf by its latch edge, from close
  const B = P.breach; let leaves: Map<Door, number> | null = null;
  for (const e of shell.ends) {
    if (e.index < 1e6 || e.t > B.reachM) continue;
    const box = g.col.dynamicBoxes[e.index - 1e6], d = box ? g.doors.list.find(x => x.box === box) : undefined; if (!d || !d.latched || !d.locked || d.lockId.startsWith('wedge:')) continue;   // (a LOCK: a leaf merely shut is not flung by a pattern that strays onto it, and a wedge at its foot is not a keep — digin.ts, the boot's)
    const u = d.dir(), along = (e.at[0] - d.def.hinge[0]) * u[0] + (e.at[2] - d.def.hinge[1]) * u[1]; if (along < d.def.width - B.latchM) continue;
    (leaves ??= new Map()).set(d, (leaves.get(d) ?? 0) + 1);
  }
  if (leaves) for (const [d, n] of leaves) if (n >= B.need) {
    if (!g.doors.kickIn(d, muzzle, shooter.id, true)) continue;   // (steel: it rang and held — doors.ts; `true`: a breaching round destroys the LOCK — from the face the leaf opens toward the keep is gone and the leaf stands home, unlocked, for a hand to pull: doors.ts DOORWAY.frameHolds)
    SHOTGUN_STATS.locks++; if (isPlayer) { g.msg('shot the lock off — the whole floor heard that'); chronDoor(g, 'doorKicked', d); }   // (the debrief's row and its price: the boot's — player.ts)
  }
}

// ------------------------------------------------------------ the door tools' side (doortools.ts open() / the 'kick' stage)
/** he carries a gun that takes a lock, and has a shell for it (or the beat to thumb more in: a teammate's spares are his reload, not a count) */
export function carriesBreacher(gd: Guard): boolean { return gd.state !== 'dead' && (!!gd.weapon.def.pellets?.breach || kitBig(gd) === 'shotgun'); }   // (… or it rides in his big slot — kit.ts BIGSLOT, bigkit.ts: up for the lock, slung after; 'none' with that switch off)
const LOCK_PROUD = 0.06;
/** the lock as a man on face `side` shoots it: a hand in from the latch edge, lever high, just proud of the leaf */
export function lockPoint(d: Door, side: 1 | -1): Vec3 { return doorPt(d, d.def.width - SHOTGUN.lockIn, LOCK_PROUD, side, SHOTGUN.lockH); }
/** WHERE THE MAN WITH THE GUN STANDS for d's lock on face `side`: the first of SHOTGUN.spots that has floor and a clear line to the lock — beside the frame, past
 *  the latch edge and off the opening, when the wall there leaves room (the boot's spot is square in front of the leaf, a leg's length off it) — and is not on
 *  top of one of `avoid` (the other men's marks), unless every spot with floor is. Where glass's rule is live (orders.ts behindGlass) and a spot of the list
 *  with floor stands in a line of fire through a pane before any clean one, GLASS HAS THIS DOOR'S LIST: he shoots from his own side of the frame (SHOTGUN above;
 *  `mark` = where the stack stood him — `own` in the answer; none: he has no side) — his mark, else a spot on the hinge side when that is his side — and takes
 *  the list's clean spot, then his mark though a pane sees it, then the list's first one behind glass, only when his side has nothing clean. null: none has
 *  floor and a line. */
export function breachSpot(g: Game, d: Door, side: 1 | -1, avoid: Vec3[] = [], mark: Vec3 | null = null, close?: 'hammer' | 'shotgun'): { pos: Vec3; yaw: number; at: Vec3; beside: boolean; own: boolean } | null {
  const at = lockPoint(d, side), W = d.def.width, markAlong = mark ? alongOf(d, mark) : NaN;
  type Spot = { pos: Vec3; yaw: number; at: Vec3; beside: boolean; own: boolean };
  const stands = (pos: Vec3) => !g.col.nav.isBlocked(pos[0], pos[2]) && !g.col.solidBlocked([pos[0], 1.2, pos[2]], at);
  const crowds = (pos: Vec3) => avoid.some(p => v3.distXZ(p, pos) < SHOTGUN.clear);
  const glass = (pos: Vec3) => g.orders.behindGlass(d, side, pos);   // (false while rounds stop in glass: every branch below that asks it is then the list as it always was)
  const spot = (pos: Vec3, beside: boolean, own = false): Spot => ({ pos, yaw: v3.yawTo(pos, at), at, beside, own });
  /** a mate's mark (or you) on the line from `pos` to the lock: he does not shoot it past a friend's chest */
  const across = (pos: Vec3) => { const ax = at[0] - pos[0], az = at[2] - pos[2], L2 = ax * ax + az * az || 1;
    return avoid.some(p => { const k = Math.max(0, Math.min(1, ((p[0] - pos[0]) * ax + (p[2] - pos[2]) * az) / L2)); return Math.hypot(p[0] - pos[0] - ax * k, p[2] - pos[2] - az * k) < SHOTGUN.line; }); };
  /** the bore's line from `pos` through the lock point lands on the leaf's face — not, at a shallow graze from along the wall, on the jamb past its edge */
  const onLeaf = (pos: Vec3) => { const o = offOf(d, pos, side) - LOCK_PROUD, A = W - SHOTGUN.lockIn, hit = A + LOCK_PROUD * (A - alongOf(d, pos)) / o; return o > 0 && hit >= 0 && hit <= W; };
  const markOk = !!mark && (markAlong < 0 || markAlong > W) && v3.distXZ(mark, at) <= SHOTGUN.markReach && onLeaf(mark) && stands(mark) && !across(mark);
  /** his own side of the frame, clean of glass: his mark, else (a hinge-side man) the first hinge spot — asked once */
  let mine: Spot | null | undefined;
  const ownSide = (): Spot | null => mine !== undefined ? mine : mine = (() => {
    if (markOk && !glass(mark!)) return spot(mark!, true, true);
    if (mark && markAlong < W / 2) for (const [past, off] of SHOTGUN.hinge) { const pos = doorPt(d, -past, off, side); if (stands(pos) && onLeaf(pos) && !crowds(pos) && !across(pos) && !glass(pos)) return spot(pos, true, true); }
    return null; })();
  if (SHOTGUN.ownSide && markAlong < W / 2) { const s = ownSide(); if (s) return s; }
  // (bigkit.ts, BIGSLOT.moves — `close`: a big slot's tool is worked from hard by the frame. Its own list first: the latch jamb, the hinge jamb, a jamb man's
  // shoulder — a place a mate has, a place behind glass and, for a shell, one whose line crosses a mate are passed over; none left = the list below, as it was)
  if (close) for (const s of bigSpots(g, d, side, close)) { if (crowds(s.pos) || glass(s.pos) || (close === 'shotgun' && across(s.pos))) continue; return { pos: s.pos, yaw: s.yaw, at: s.at, beside: true, own: false }; }
  let crowded: Spot | null = null, glazed: Spot | null = null, panes = false;
  for (const [past, off] of SHOTGUN.spots) {
    const pos = doorPt(d, W + past, off, side);
    if (!stands(pos)) continue;
    if (crowds(pos)) { crowded ??= spot(pos, past > 0); panes ||= glass(pos); continue; }
    if (glass(pos)) { glazed ??= spot(pos, past > 0); panes = true; continue; }
    return (panes ? ownSide() : null) ?? spot(pos, past > 0);
  }
  if (!panes) return crowded;
  return ownSide() ?? (markOk ? spot(mark!, true, true) : null) ?? glazed ?? crowded;   // (a mark behind glass before the list's spot behind glass: where he stands anyway, not across the opening to another pane)
}
