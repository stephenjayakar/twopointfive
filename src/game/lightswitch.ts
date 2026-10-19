// A ROOM'S LIGHTS HAVE A SWITCH ON THE WALL (the maintainer, 10-19: "one obvious thing: we should have light switches for rooms!" — and "probably don't want
// to go TOO ham on this but it should feel good").
//
// The fixtures were always switchable (LightTarget.on; lighting.ts updateTargets writes the light, its glow card and its markings off it, and the CPU's light
// estimate, the meter, the men's eyes and the picture all read that one list): what the game lacked was a thing on the wall a hand could reach. On:
//
//   where     a plate beside a door of every room that has mains lights of its own, on the room's own face of the wall, past the latch jamb (the side the
//             leaf does not swing over), at hand height — found from the level as it stands (the doors, cleared.ts's rooms, a ray to the wall): no level file
//             says where, so every level has them and none had to be edited. Where the door's own wall gives no place (a glass front, a corner) it hangs on
//             the room's nearest plain wall. A room is the floor cleared.ts floods from a door; its lights are the mains fixtures that hang in it — every
//             analytic light, and the flat ceiling panels and tubes (a screen, a sign and a vending front are not the room's lights and stay lit; a lantern,
//             a stove and a street lamp are not on the mains and have no switch). A room lit in several circuits (the fixtures' authored groups: an open
//             floor's corridor and its desks) has a plate for each circuit a plate hangs nearest. At most `perRoom` plates a circuit, at the doors furthest
//             apart. A room too big to be a room (open floor) has none.
//   the hand  one row on Space within `reach` of the plate with a line to it: 'lights off' / 'lights on'. It ranks UNDER a door's rows (a door is used a
//             hundred times for every switch: beside a door the tap is the door's, and the plate hangs `beside` m off the jamb so that standing at it the
//             door is out of reach and the tap is the switch's). The flip is on the tap: a click, the room dark on the frame; put back on, the tubes strike
//             as they do when the mains come back (`strike`), a bulb is simply on. Sam's hand goes to the plate for `handSecs` (the picture only).
//   put back  ON = the room as it was authored (the panels the level left dark stay dark); a room authored wholly dark gets all of them.
//   the men   a light put out at its switch is SEEN like any light going out (a 'lightOut' event a man's eye needs a line to: guards.ts lightOutSeen) and it
//             says where the hand was: a calm defender who saw it comes to the SWITCH, not to the patch of floor (`GameEvent.swAt`). A calm defender who
//             stands at the switch of a room the LEVEL had lit and a hand put out puts it back, `guardSecs` after the hand at the soonest (`guards`; never in
//             a fight, blind, asleep or scripted, never a teammate or a civilian, never under a blackout — the breaker is its own errand — and never a room
//             the level left dark: Sam's own 'on' then 'off' there is nobody's to undo). The click itself is not a sound the hearing model carries.
//
// State: when a hand put a fixture out (LightTarget.handOff, a game time — beside `on`, saved with it: savestate.ts TargetSnap.hand, written only when set;
// 'lights on' puts back what the hand put out). The plates are a memo of the level as it stands when first asked (made again after a restart or a load); a
// plate whose wall is blown goes with the wall, and is back with it on a load (asked after when the level's geometry serial moves). No dice.
//
// Not here: a teammate sent to a switch on an order (workthings.ts lists the things a teammate works; a switch is not yet one), a defender who turns the
// lights on in a room the level left dark, a man posted on a mark leaving it for the switch, a switch for lamps on posts. In the fog of war a plate is drawn
// like a keypad (always), so its pilot shows a dark room's switch the team cannot see.
//
// ON in the page (`?lightswitch=0` = as it was), OFF in the module and on the frozen harness stand (`TPS_LIGHTSWITCH=1`): a FROZEN_HOLDS row, in the knob
// registry and a journal's tables; a recording from before the table replays with it off.
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import type { Game, Guard, Interactable, LightTarget, Player, Verb } from './game';
import type { Character } from './character';
import type { Door } from './doors';
import { frameOf } from './guards';
import { isHostile } from './teams';
import { workAt } from './handwork';
import { NEARBY_M } from './player';
import { dozeAsleep } from './doze';

export const LIGHTSWITCH = {
  on: false,
  /** m from his feet to the plate, on the plan, that a hand reaches it from */
  reach: 1.15,
  /** the plate: m above the floor · m past the jamb along the wall (tried in this order, the latch side first) · m off the wall a man stands to work it */
  height: 1.2, beside: [0.85, 1.1, 0.6, 1.5, 2.0, 2.6] as number[], standM: 0.5,
  /** the most plates one circuit of a room is given (the first found, then the furthest from those kept) and the least they are apart, m */
  perRoom: 2, apartM: 4,
  /** where the door's own wall gives no place for one (glass, a corner): m about the door the room's other walls are tried within */
  scanM: 4,
  /** put back on, a tube strikes (lighting.ts supply: the restrike a fixture makes when the mains return) — off = on at once, like a bulb */
  strike: true,
  /** a calm defender who saw the room go dark comes to the switch, and one who stands at it puts the lights back — never sooner than `guardSecs` after
   *  the hand that put them out (the beat a man takes to know what happened and reach for it) */
  guards: true, guardSecs: 1.5,
  /** s his hand is at the plate after the tap (the picture only) */
  handSecs: 0.3,
};
/** QA: plates made · flips by Sam's hand · rooms a defender put back · light-out events a switch raised · plates that went with their wall
 *  (lightswitch-check.ts reads them; nothing in the game does) */
export const LIGHTSWITCH_STATS = { plates: 0, flips: 0, guardOn: 0, events: 0, gone: 0 };

/** one plate on a wall */
export interface WallSwitch {
  /** its ordinal among the level's plates (the motion key of its boxes) */
  id: number;
  /** the middle of the plate on the wall's face · the wall's level normal out into the room · the floor a hand's reach in front of it · the nearest floor to
   *  that a walker's grid calls free (where a man sent to it is sent) */
  pos: Vec3; n: Vec3; stand: Vec3; floor: Vec3;
  /** the door it hangs by · the room's number when it was found (cleared.ts; not kept current — a wall blown later renumbers rooms, the plate keeps its fixtures) */
  door: Door; room: number;
  /** the fixtures it works — shared by every plate of the room */
  targets: LightTarget[];
}
interface St { /** every plate the level was given */ all: WallSwitch[]; /** those whose wall stands */ list: WallSwitch[]; hands: { c: Character; sw: WallSwitch; at: number; dir: 1 | -1 }[]; /** the level's geometry serial the walls were last asked after at */ serial: number }
const states = new SideMap<Game, St>('lightswitch.states');

/** is the rule running (nothing under a show: its lights are its script's) */
export function switchesLive(g: Game): boolean { return LIGHTSWITCH.on && !g.touring && !g.director.showing; }

// ---------------------------------------------------------------- finding them
/** is this fixture one a wall switch works: on the mains, and a light of the room — any analytic light, or a flat fixture that faces down from overhead */
function roomLight(g: Game, t: LightTarget): boolean {
  if (!t.mains || t.group === 'exterior' || t.group === 'emergency') return false;
  if (t.kind === 'analytic') return !!t.light;
  if (t.kind !== 'emissive' || !t.boxes.length) return false;
  const b = g.level.boxes[t.boxes[0]], h = b.h;
  return h[1] <= h[0] && h[1] <= h[2] && b.c[1] > 1.5;
}
/** the room a fixture hangs in: the room of the floor under it, or — over a desk, a shelf, a wall's own cell — of the nearest floor it has a clear line down to */
function roomOfLight(g: Game, t: LightTarget): number {
  const C = g.cleared, r = C.roomAt(t.pos); if (r) return r;
  const nav = g.col.nav, cs = nav.cell, from: Vec3 = [t.pos[0], Math.max(1.2, Math.min(t.pos[1] - 0.25, 2.4)), t.pos[2]];
  let best = 0, bd = 2.6;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const p: Vec3 = [(Math.floor(t.pos[0] / cs) + dx + 0.5) * cs, 1.2, (Math.floor(t.pos[2] / cs) + dz + 0.5) * cs], q = C.roomAt(p); if (!q) continue;
    const d = Math.hypot(p[0] - t.pos[0], p[2] - t.pos[2]); if (d < bd && !g.col.solidBlocked(from, p)) { bd = d; best = q; }
  }
  return best;
}
/** a ray at the level's own boxes, the leaves aside (a door standing open across the wall is not the wall) */
function wallRay(g: Game, ro: Vec3, rd: Vec3, tmax: number) {
  const col = g.col as unknown as { dynamicBoxes: unknown[] }, keep = col.dynamicBoxes; col.dynamicBoxes = [];
  try { return g.col.raycast(ro, rd, tmax); } finally { col.dynamicBoxes = keep; }
}
type Plate = Omit<WallSwitch, 'id' | 'targets'>;
const WALL_TOP = 2.2;   // m: what a plate hangs on stands at least this high
/** A plate on the wall behind `stand` (a floor point `standM` off where the wall should be, `n` the way out from it), or null: plain solid wall under the whole
 *  plate — not glass, not a leaf, not a pillar's edge or a sill — room for a man in front of it, this room's floor at his back, and clear of every leaf's sweep. */
function plateOn(g: Game, stand: Vec3, n: Vec3, room: number, d: Door): Plate | null {
  const K = LIGHTSWITCH, nav = g.col.nav, back: Vec3 = [-n[0], 0, -n[2]], ux = n[2], uz = -n[0];
  const fit: Vec3 = [stand[0], 0, stand[2]]; g.col.collideCircle(fit, 0.3, 0.2, 1.5); if (Math.hypot(fit[0] - stand[0], fit[2] - stand[2]) > 0.02) return null;
  let floor: Vec3 | null = null;   // (the cells along a wall are the walkers' grid's own margin: the room's floor is the first free cell out from it — and no further than a hand reaches the plate from)
  for (let o = 0; o <= 0.51 && !floor; o += 0.25) { const q: Vec3 = [stand[0] + n[0] * o, 0, stand[2] + n[2] * o]; if (!nav.isBlocked(q[0], q[2]) && g.cleared.roomAt(q) === room && !g.col.solidBlocked([stand[0], 1.0, stand[2]], [q[0], 1.0, q[2]])) floor = q; }
  if (!floor) return null;
  // (a WALL: not glass, not a leaf, and standing to above a door's head — a panel, a locker or a cabinet against the wall is not a place for a switch)
  const solid = (h: { t: number; index: number; n: Vec3 } | null): h is { t: number; index: number; n: Vec3 } => { if (!h || h.index >= 1e6) return false; const b = g.level.boxes[h.index]; return !(b.flags & BoxFlag.Glass) && b.c[1] + b.h[1] >= WALL_TOP; };
  const ro: Vec3 = [stand[0], K.height, stand[2]], h = wallRay(g, ro, back, K.standM + 0.45);
  if (!solid(h) || h.t < 0.2 || v3.dot(h.n, n) < 0.95) return null;
  for (const [da, dy] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) { const hq = wallRay(g, [ro[0] + ux * da, ro[1] + dy, ro[2] + uz * da], back, K.standM + 0.45); if (!solid(hq) || Math.abs(hq.t - h.t) > 0.01) return null; }
  const pos = v3.mad(ro, back, h.t), face = v3.mad(pos, n, 0.06);
  for (const o of g.doors.list) { if (v3.distXZ(o.frameCentre, pos) > 3) continue; const S = g.doors.swingOf(o); if (S.sweeps(face[0], face[2], 0.08) || S.sweeps(stand[0], stand[2], 0.3)) return null; }   // (not where an open leaf lies, nor where one would sweep the man at it)
  if (g.col.solidBlocked([stand[0], 1.3, stand[2]], v3.mad(pos, n, 0.05))) return null;
  return { pos, n, stand: [pos[0] + n[0] * K.standM, 0, pos[2] + n[2] * K.standM], floor, door: d, room };
}
/** the plate a door gives the room on its `side` face: `beside` m past a jamb along the door's own wall, the latch side first */
function plateAt(g: Game, d: Door, side: 1 | -1, room: number): Plate | null {
  const K = LIGHTSWITCH, F = frameOf(d), n: Vec3 = [F.nx * side, 0, F.nz * side];
  for (const latch of [true, false]) for (const s of K.beside) {
    const along = latch ? F.W + s : -s;
    const p = plateOn(g, [F.hx + F.ux * along + n[0] * K.standM, 0, F.hz + F.uz * along + n[2] * K.standM], n, room, d); if (p) return p;
  }
  return null;
}
/** …and where that wall gives none (a glass front, a door in a corner): the plain wall of the room nearest the door, inside `scanM` of it */
function plateNear(g: Game, d: Door, room: number): Plate | null {
  const K = LIGHTSWITCH, nav = g.col.nav, cs = nav.cell, c = d.frameCentre, R = Math.ceil(K.scanM / cs);
  const cells: { p: Vec3; d: number }[] = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const p: Vec3 = [(Math.floor(c[0] / cs) + dx + 0.5) * cs, 0, (Math.floor(c[2] / cs) + dz + 0.5) * cs], dd = v3.distXZ(p, c); if (dd <= K.scanM && g.cleared.roomAt(p) === room) cells.push({ p, d: dd }); }
  cells.sort((a, b) => a.d - b.d || a.p[0] - b.p[0] || a.p[2] - b.p[2]);
  for (const { p } of cells) for (const n of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]) {
    const h = wallRay(g, [p[0], K.height, p[2]], [-n[0], 0, -n[2]], 1.0); if (!h) continue;
    const q = plateOn(g, [p[0] - n[0] * (h.t - K.standM), 0, p[2] - n[2] * (h.t - K.standM)], n, room, d); if (q) return q;
  }
  return null;
}
/** of a circuit's plates, the `perRoom` to keep: the first found, then each time the one furthest from those kept, while that is far enough to be another way in */
function fewest(ps: Plate[]): Plate[] {
  const K = LIGHTSWITCH, keep = ps.slice(0, 1);
  while (keep.length < K.perRoom) {
    let far: Plate | null = null, fd = K.apartM;
    for (const p of ps) { if (keep.includes(p)) continue; const dd = Math.min(...keep.map(k => v3.distXZ(p.pos, k.pos))); if (dd >= fd) { fd = dd; far = p; } }
    if (!far) break; keep.push(far);
  }
  return keep;
}
function build(g: Game): WallSwitch[] {
  const C = g.cleared;
  const lights = new Map<number, LightTarget[]>();
  for (const t of g.targets) { if (!roomLight(g, t)) continue; const r = roomOfLight(g, t); if (r) (lights.get(r) ?? lights.set(r, []).get(r)!).push(t); }
  const found = new Map<number, Plate[]>(), sides: { d: Door; r: number }[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    const r = C.roomBy(d, side); if (!r || !lights.has(r)) continue;
    sides.push({ d, r }); const p = plateAt(g, d, side, r); if (p) (found.get(r) ?? found.set(r, []).get(r)!).push(p);
  }
  for (const { d, r } of sides) if (!found.has(r)) { const p = plateNear(g, d, r); if (p) found.set(r, [p]); }
  const out: WallSwitch[] = [];
  for (const [r, ps] of found) {
    // a room lit in several circuits (an open floor's lobby, corridor and desks — the fixtures' own groups) has a switch for each: a plate works the circuit
    // whose fixture hangs nearest it, and a circuit no plate is nearest to has none
    const all = lights.get(r)!, groups = [...new Set(all.map(t => t.group))];
    const by = new Map<string, Plate[]>();
    for (const p of ps) { let best = groups[0], bd = Infinity; for (const t of all) { const dd = v3.distXZ(t.pos, p.pos); if (dd < bd) { bd = dd; best = t.group; } } (by.get(best) ?? by.set(best, []).get(best)!).push(p); }
    for (const [grp, gps] of by) { const targets = all.filter(t => t.group === grp); for (const p of fewest(gps)) out.push({ ...p, id: out.length, targets }); }
  }
  LIGHTSWITCH_STATS.plates += out.length;
  return out;
}
/** the level's plates (none with the rule off) */
export function wallSwitches(g: Game): WallSwitch[] {
  if (!LIGHTSWITCH.on) return NONE;
  let st = states.get(g);
  if (!st) { const all = build(g); states.set(g, st = { all, list: all.filter(sw => wallStands(g, sw)), hands: [], serial: geomSerial(g) }); }
  return st.list;
}
const NONE: WallSwitch[] = [];
const geomSerial = (g: Game): number => (g.engine.world as { geomSerial?: number }).geomSerial ?? 0;   // (moved by every wall or piece of furniture blown, and by a load that puts one back)
/** is the wall a plate was hung on still behind it */
function wallStands(g: Game, sw: WallSwitch): boolean {
  const h = wallRay(g, [sw.stand[0], LIGHTSWITCH.height, sw.stand[2]], [-sw.n[0], 0, -sw.n[2]], LIGHTSWITCH.standM + 0.2);
  return !!h && h.index < 1e6 && Math.abs(h.t - LIGHTSWITCH.standM) < 0.03;
}
/** a restart (game.ts restartEncounter): the plates are found again on the level as it was dealt, and no fixture is a hand's */
export function lightSwitchReset(g: Game) { states.delete(g); for (const t of g.targets) if (t.handOff !== undefined) t.handOff = undefined; }

// ---------------------------------------------------------------- the flip
/** are the room's lights on at the switch (any fixture of it switched on — a shot one, a tripped one and the mains are not the switch's business) */
export const switchLit = (sw: WallSwitch): boolean => sw.targets.some(t => t.on);
/** Work a switch. Off: every fixture of the room that is on, each one that was burning seen to go by whoever has a line to it, and each marked with the time
 *  a hand put it out. On: what the hand put out; in a room no hand put out, the room as authored (all of it, where the level left the whole room dark). */
export function flipSwitch(g: Game, sw: WallSwitch, on: boolean, by: Character) {
  const K = LIGHTSWITCH;
  if (on) {
    const hand = sw.targets.some(t => t.handOff !== undefined && !t.on), authored = sw.targets.some(t => g.authoredOn(t));
    for (const t of sw.targets) {
      const mine = hand ? t.handOff !== undefined : !authored || g.authoredOn(t);
      if (mine && !t.on) { if (K.strike && t.kind === 'emissive' && !t.broken && t.disabledUntil < 0) t.disabledUntil = g.time; t.on = true; }
      t.handOff = undefined;
    }
  } else for (const t of sw.targets) {
    if (!t.on) continue;   // (one a hand put out before, and something else lit the rest since: still the hand's)
    if (t.factor > 0) { g.lightEvent(t, 'shot', sw.floor); LIGHTSWITCH_STATS.events++; }   // (cause: as a light put out for good — a man who sees it comes; and it says where the hand was)
    t.on = false; t.handOff = g.time;
  }
  g.audio.play('click', sw.pos, 0.8); if (!on) g.audio.play('lightOff', sw.pos, 0.5);
  const st = states.get(g); if (st) { st.hands = st.hands.filter(h => h.c !== by); st.hands.push({ c: by, sw, at: g.time, dir: on ? -1 : 1 }); }
}

// ---------------------------------------------------------------- Sam's row (player.ts buildInteractables) and its deed (game.ts, where a breaker's is acted on)
type RowFn = (base: Interactable, verb: Verb, text: string, hints?: string, over?: Partial<Interactable>) => Interactable;
type OfferFn = (it: Interactable, verbs: Interactable[]) => void;
const handsFree = (pl: Player) => !pl.dragging && !pl.sprinting && !pl.takedown && !pl.holding;
/** the plate nearest `pl`'s feet within `r` m that he has a clear line to from his chest (one on the far face of the wall is not his to reach) */
export function switchNear(g: Game, pl: Player, r: number): WallSwitch | null {
  if (!switchesLive(g)) return null;
  const p = pl.char.pos, eye: Vec3 = [p[0], pl.crouch ? 0.9 : 1.3, p[2]];
  let best: WallSwitch | null = null, bd = r;
  for (const sw of wallSwitches(g)) { const d = v3.distXZ(sw.pos, p); if (d < bd && !g.col.solidBlocked(eye, v3.mad(sw.pos, sw.n, 0.05))) { best = sw; bd = d; } }
  return best;
}
/** the NEAREST plate only (two in reach would be one row to the selector): a marker from NEARBY_M, the row in reach with the hands free */
export function switchRows(g: Game, pl: Player, busy: boolean, row: RowFn, offer: OfferFn) {
  const sw = switchNear(g, pl, NEARBY_M); if (!sw) return;
  const near = v3.distXZ(sw.pos, pl.char.pos) < LIGHTSWITCH.reach, reach = near && handsFree(pl), lit = switchLit(sw);
  const it: Interactable = { kind: 'switch', pos: sw.pos, line1: lit ? 'switch · on' : 'switch · off', line2: reach ? '' : !near ? 'step closer' : pl.sprinting ? 'stop sprinting' : 'hands full', inReach: reach, off: !lit };
  offer(it, reach && !busy ? [lit ? row(it, 'lightsOff', 'lights off') : row(it, 'lightsOn', 'lights on')] : []);
}
/** Space on that row: the plate in reach is worked the way the row said. False = none in reach now, or it already stands that way. */
export function switchAct(g: Game, pl: Player, verb: Verb): boolean {
  const sw = handsFree(pl) ? switchNear(g, pl, LIGHTSWITCH.reach) : null; if (!sw) return false;
  const on = verb === 'lightsOn'; if (switchLit(sw) === on) return false;
  flipSwitch(g, sw, on, pl.char); LIGHTSWITCH_STATS.flips++;
  return true;
}

// ---------------------------------------------------------------- once a frame (game.ts, before the fixtures are written)
/** can this man put a room's lights back: a living defender on his own feet and his own business — calm or come to look, not in a fight, not blind,
 *  doubled over or asleep, nobody's script, his hands his own (attention.ts's own test of a calm man, less its limits on what may draw him) */
const putsBack = (g: Game, gd: Guard) => (gd.state === 'patrol' || gd.state === 'suspicious') && gd.char.alive && !gd.held && !gd.civ && !gd.wound && !gd.script && !gd.bodyDuty
  && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil && !dozeAsleep(gd) && isHostile(gd.team, 'player');
export function lightSwitchTick(g: Game) {
  if (!switchesLive(g)) return;
  const K = LIGHTSWITCH; wallSwitches(g); const st = states.get(g)!;
  // a plate goes with its wall (a charge, a blast) and is back with it (a load): asked after only when the level's geometry has moved
  if (st.serial !== geomSerial(g)) { st.serial = geomSerial(g); const n = st.list.length; st.list = st.all.filter(sw => wallStands(g, sw)); LIGHTSWITCH_STATS.gone += Math.max(0, n - st.list.length); }
  const L = st.list;
  // a room the level had lit and a hand put out: a calm defender at its switch puts it back, a beat after the hand at the soonest
  if (K.guards && !g.blackout.active && g.aiEnabled) for (const sw of L) {
    let since = -1; for (const t of sw.targets) if (t.handOff !== undefined && !t.on && g.authoredOn(t)) since = Math.max(since, g.time - t.handOff);
    if (since < K.guardSecs) continue;   // (no fixture of it a hand put out that the level had lit, or too soon after the hand)
    for (const gd of g.guards) {
      const p = gd.char.pos; if (!putsBack(g, gd) || (v3.distXZ(p, sw.pos) > K.reach && v3.distXZ(p, sw.floor) > 0.6)) continue;   // (within a stride of the spot he was sent to counts: a walk ends on a cell's centre)
      if (g.col.solidBlocked([p[0], 1.3, p[2]], v3.mad(sw.pos, sw.n, 0.05))) continue;
      flipSwitch(g, sw, true, gd.char); LIGHTSWITCH_STATS.guardOn++; g.say(gd, 'who turned these off?', false);
      break;
    }
  }
  // the hand at the plate for a moment after the flip (the picture: handwork.ts's lever pose, nothing with that switch off)
  if (st.hands.length) {
    st.hands = st.hands.filter(h => g.time >= h.at && g.time - h.at < K.handSecs && h.c.alive);
    for (const h of st.hands) workAt(h.c, 'lever', h.sw.pos, h.sw.n, g.time - h.at, K.handSecs, { dir: h.dir });
  }
}

// ---------------------------------------------------------------- drawing (into Game.dynBoxes, beside the keypads' plates)
const PLATE: Vec3 = [0.62, 0.6, 0.55], ROCKER: Vec3 = [0.74, 0.72, 0.66], GLOW: Vec3 = [1.6, 0.8, 0.16];
const SW_KEY = 0x400000;   // (MKEY.device's range: devices.ts keys its own by ordinal from 0, stickycam.ts from 0x800000 — a device's key is also what the fog of war lets through wherever it hangs)
/** the plate, its rocker (the top proud with the lights on, the bottom with them off) and, in a room whose lights are off at the switch, the small amber
 *  pilot that says where the plate is — a decal's depth, nobody's collision, no shadow */
export function switchBoxes(g: Game, out: Box[]) {
  if (!LIGHTSWITCH.on) return;
  const deco = BoxFlag.Dynamic | BoxFlag.NoShadow;
  for (const sw of wallSwitches(g)) {
    const yaw = v3.yawOf(sw.n), lit = switchLit(sw), key = MKEY.device + SW_KEY + sw.id * 4;
    out.push(makeBox({ c: v3.mad(sw.pos, sw.n, 0.006), h: [0.042, 0.06, 0.006], yaw, albedo: PLATE, flags: deco, mkey: key }));
    out.push(makeBox({ c: v3.add(v3.mad(sw.pos, sw.n, 0.015), [0, lit ? 0.012 : -0.012, 0]), h: [0.016, 0.018, 0.005], yaw, albedo: ROCKER, flags: deco, mkey: key + 1 }));
    out.push(makeBox({ c: v3.add(v3.mad(sw.pos, sw.n, 0.013), [0, -0.045, 0]), h: [0.007, 0.004, 0.002], yaw, albedo: [0.05, 0.03, 0.01], emissive: lit ? [0, 0, 0] : GLOW, flags: deco, mkey: key + 2 }));
  }
}
