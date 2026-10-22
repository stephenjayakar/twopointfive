// EXTRA ENEMIES (a stress hook: `?extra=N`, Tab ▸ Sandbox ▸ Stress, __extra, tools/qa/enemy-ceiling.ts) — N more hostile men stood on the floor that is up, to
// SEE what more of them cost: the frame on a real GPU (the read-out's fps / gpu ∪, `?hud`) and the simulation's step. The answer to 'how many enemies can this
// take' is a measurement, and the cloud that wrote this has no GPU — this is the one-minute way to make it on a machine that has.
//
// OFF BY DEFAULT, AND NOTHING WHEN OFF: nothing here is called from Game.update. The page calls stressTick once a frame (a return on its first line while no
// count is asked for); the harness never calls it. With no `?extra` and the button unpressed the game is the game exactly.
//
// WHAT IT STANDS: ordinary hostile units through spawnUnit — the same men the scenarios stage, held and pinned on a spot with their guns on a door — so the room
// fight, the hard defenders' rules, the fog of war and the team's eyes treat them as the staged defenders. Under a ROOM CLEAR they are dealt to the structure's
// rooms in turn (a room's unused marks first, then free floor inside it) and ADOPTED by the scenario (nightbreach.ts / roomclear.ts adopt: its lists, so a room
// they hold is not 'clear' and the structure is not 'taken' while one is up). Anywhere else (the plain floor, the night breach, the rescue) they stand on free
// floor away from Sam and are nobody's bookkeeping.
//
// IT DOES NOT LIFT A CAP. spawnUnit is asked with the skinning's budget (sixteen characters all told — bodies, hostages and civilians included): the men that
// fit are stood and the first refusal is kept in words (`STRESS.last`, the panel's line) — so on The block (Sam + four + eight) three more fit, eleven enemies. More than that is renderer
// work (rebuild/enemy-squads/ceiling.md has the caps); `spawn` is the seam the HEADLESS tool uses to stand men past them where nothing is drawn.
// A restart under a scenario despawns every unit and stages its own cast again: stressTick stands the asked-for count again on the fresh staging. Switching it
// off stops that; the men already standing leave at the next restart (they are in the scenario's lists). While they stand they are UNITS ON THE FLOOR: the
// showcases and the checkpoints refuse, as they do for any response unit — a stress floor is for looking at the frame's cost, not for playing a run through.
import { Vec3, v3 } from '../math/vec';
import { mulberry32 } from '../math/dice';
import type { Game, Guard } from './game';
import { spawnUnit, type UnitOpts } from './guards';
import { NIGHTBREACH } from './nightbreach';
import { propGap, wallBetween } from './roomclear';
import { runnerFled } from './runner';   // (asked inside the top-up only: false with its switch off)

/** the count asked for (0 = off: stressTick returns on its first line), the men standing for it, and the last standing in words */
export const STRESS = { want: 0, men: [] as Guard[], last: 'off', why: '' };   // (why = what the last staging was refused for, by itself: the panel's second line)

/** one spot for an extra man: where, what he covers, and — under a room clear — the room he is dealt to (`mark`: which of its marks, −1 = free floor) */
export interface ExtraSpot { pos: Vec3; aimAt: Vec3; room: string | null; watch: string; mark: number }

const SPACING_M = 1.0;      // between any two men's feet
const PROP_CLEAR_M = 0.45;  // (roomclear.ts MARK_CLEAR_M: a body and a hand's width off furniture at rest)
const SAM_CLEAR_M = 8;      // on a floor with no structure: nobody is stood on top of the player
const SKINNED = 16;         // (anim/characters.ts MAX_CHARS, guards.ts MAX_SKINNED: every character drawn in a frame)

/** WHERE n more men would stand, a pure function of the floor as it is (its own dice: the first k spots of any n are the same k). Fewer than n when the floor
 *  runs out. */
export function extraSpots(g: Game, n: number): ExtraSpot[] {
  const die = mulberry32(0x57E55), nav = g.col.nav, out: ExtraSpot[] = [];
  const taken: Vec3[] = [g.player.char.pos, ...[...g.guards, ...g.civilians].filter(x => x.state !== 'dead').map(x => x.char.pos)];
  const free = (p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.props.props.some(q => propGap(q, p) < PROP_CLEAR_M) && !taken.some(t => Math.hypot(t[0] - p[0], t[2] - p[2]) < SPACING_M);
  const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(die() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const rc = g.roomClear?.active ? g.roomClear : null, S = rc?.structure;
  if (rc && S) {
    const lists = S.rooms.map(R => {
      const marks: ExtraSpot[] = R.marks.map((m, k) => ({ pos: v3.copy(m.pos), aimAt: v3.copy(m.aimAt), room: R.id, watch: m.watch, mark: k })).filter(s => !rc.placement.some(p => p.room === R.id && p.mark === s.mark));
      const floor: ExtraSpot[] = []; const B = R.bounds;
      for (let x = B.x0 + 0.7; x <= B.x1 - 0.7; x += 0.8) for (let z = B.z0 + 0.7; z <= B.z1 - 0.7; z += 0.8) {
        const pos: Vec3 = [+x.toFixed(2), 0, +z.toFixed(2)], eye: Vec3 = [pos[0], 1.6, pos[2]];
        const m = R.marks.find(q => !wallBetween(g, eye, q.aimAt)) ?? R.marks[0]; if (!m) continue;   // (he covers a door he has a line to, as a mark does)
        floor.push({ pos, aimAt: v3.copy(m.aimAt), room: R.id, watch: m.watch, mark: -1 });
      }
      return [...marks, ...shuffle(floor)];
    });
    for (let left = true; left && out.length < n;) { left = false;
      for (const L of lists) { if (out.length >= n) break; let s: ExtraSpot | undefined; while ((s = L.shift()) && !free(s.pos)) { /* next */ } if (s) { out.push(s); taken.push(s.pos); left = true; } } }
    return out;
  }
  const sam = g.player.char.pos, cells: Vec3[] = [];
  for (let x = 0; x < nav.W; x += 2) for (let z = 0; z < nav.H; z += 2) { const p: Vec3 = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]; if (Math.hypot(p[0] - sam[0], p[2] - sam[2]) >= SAM_CLEAR_M) cells.push(p); }
  for (const pos of shuffle(cells)) {   // (a way on foot from Sam: floor inside the walls he is inside — asked only of the spots that would be taken)
    if (out.length >= n) break; if (!free(pos) || !nav.findPath(sam, pos)) continue;
    out.push({ pos, aimAt: [sam[0], 1.1, sam[2]], room: null, watch: '', mark: -1 }); taken.push(pos); }
  return out;
}

/** Stand up to n more hostile men now. Returns how many stood and, when fewer than asked, the first refusal in words (a spent budget, no floor left).
 *  `spawn`: who stands a man (the game's own spawnUnit, caps and all — a headless tool hands its own to stand men past what a renderer could draw). */
export function standExtra(g: Game, n: number, spawn: (g: Game, o: UnitOpts) => Guard = spawnUnit): { asked: number; stood: number; why: string | null } {
  const nb = g.nightBreach?.active ? g.nightBreach : null, rc = g.roomClear?.active ? g.roomClear : null;
  const spots = extraSpots(g, n); let stood = 0, why: string | null = spots.length < n ? `free floor for ${spots.length} of ${n}` : null;
  const serial = STRESS.men.filter(m => g.guards.includes(m)).length;
  for (const s of spots) {
    const name = `Extra ${serial + stood + 1}`;
    let gd: Guard;
    try { gd = spawn(g, { team: 'hostile', pos: s.pos, yaw: v3.yawTo(s.pos, s.aimAt), name, light: NIGHTBREACH.defLights, budget: SKINNED - g.civilians.length }); }   // (spawnUnit counts Sam + guards; the hostages and civilians are skinned too)
    catch (e) { why = e instanceof Error ? e.message : String(e); break; }
    gd.hold = true; gd.pinned = true;   // (as the scenarios stage a defender: nightbreach.ts stage)
    if (nb) nb.adopt(gd, { pos: s.pos, aimAt: s.aimAt, name, drill: false });
    if (rc && s.room) rc.adopt(gd, { room: s.room, mark: s.mark, pos: s.pos, watch: s.watch, aimAt: s.aimAt, name });
    STRESS.men.push(gd); stood++;
  }
  STRESS.men = STRESS.men.filter(m => g.guards.includes(m));
  STRESS.last = stressSummary(g) + (why ? ` — stopped: ${why}` : ''); STRESS.why = why ?? '';
  if (stood || why) g.msg(`stress — ${stood} extra ${stood === 1 ? 'enemy' : 'enemies'} stood${why && stood < n ? ` of ${n} asked (${why.replace(/^spawnUnit: /, '').split(' — ')[0]})` : ''}`);
  return { asked: n, stood, why };
}

/** Once a frame FROM THE PAGE (never from Game.update): while a count is asked for and none of its men is on the floor — the boot, a restart that despawned
 *  them — stand them. A return on its first line while it is off. */
export function stressTick(g: Game) {
  if (!STRESS.want) return;
  if (STRESS.men.some(m => g.guards.includes(m))) return;
  if (g.touring || g.puppet || g.player.down || (g.director?.run && !g.director.run.ended)) return;
  const nb = g.nightBreach, rs = g.rescue;   // (a scenario mid-staging: its own cast first — a man stood ahead of it would be counted against its budget)
  if (nb?.active && !(nb.hostiles.length && nb.hostiles.every(h => g.guards.includes(h) || runnerFled(h)))) return;
  if (rs?.active && !(rs.hostiles.length && rs.hostiles.every(h => g.guards.includes(h)))) return;
  const want = STRESS.want; STRESS.men = [];
  const r = standExtra(g, want);
  if (!r.stood) { STRESS.want = 0; console.warn(`stress: no extra enemy could be stood (${r.why}) — switched off`); }   // (not asked again every frame)
}

/** the floor in one line: who is on it, against the budgets that bind first */
export function stressSummary(g: Game): string {
  const up = g.guards.filter(x => x.state !== 'dead'), foes = up.filter(x => x.team === 'hostile' || x.team === 'guard').length, mates = up.filter(x => x.team === 'operative').length;
  const extra = STRESS.men.filter(m => g.guards.includes(m) && m.state !== 'dead').length;
  return `${foes} enemies up (${extra} extra) · ${mates} teammates · ${1 + g.guards.length + g.civilians.length} of ${SKINNED} characters (bodies count) · ${g.engine.lights.lights.filter(l => l.ttl < 0).length} of 64 steady lights`;
}
