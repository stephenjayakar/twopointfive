/** EVERY DEATH EXPLAINS ITSELF — the game's half (the panel is src/ui/recap.ts).
 *
 *  What it keeps: for every man of OUR side who goes down (a player, a teammate, a hostage) WHO did it, FROM WHERE and with what, plus the floor's last
 *  `RECAP.secs` seconds — every man's place and gun line, every door leaf, every round — so the end card can show how it happened.
 *
 *  THE RULE A SECOND PLAYER NEEDS: nothing kept here is handed out while anybody is still playing. `deathRecapOf` answers null until `recapOver` — the run is over
 *  for EVERYBODY — so a man who is down beside live friends never gets the shooter's place or the floor without its fog. What may be shown live is the squad's own
 *  knowledge and is not this function's.
 *
 *  THE FILE ONLY READS THE GAME. No dice, nothing written that the simulation reads: a run with the switch on is the run with it off, digest for digest
 *  (tools/qa/deathrecap-check.ts holds it), so the switch is ON on every stand and `?norecap` / the Tab row is the way back. State is per Game in a WeakMap and
 *  starts over with every fresh `g.mission` (a restart, a checkpoint load). It is NOT in a checkpoint: it is the picture of a death, and a load is a run in which
 *  that death has not happened.
 *
 *  Seams: combat.ts fireWeapon → `recapRound` (the round that is about to land on a man: one line), game.ts `recapTick` (last in Game.step), ui/debrief.ts
 *  mounts the panel. */
import type { Game, Guard, GameEvent } from './game';
import type { Character } from './character';
import type { Vec3 } from '../math/vec';
import type { WeaponDef } from './weapons';
import { WEAPONS } from './weapons';
import { plainShort } from './gear';
import { civiliansShown } from './civilians';
import { FOG, gazeOf } from './fogofwar';
import { BoxFlag } from '../scene/boxes';

export const RECAP = {
  on: true,
  /** seconds of the floor kept before a death */ secs: 8,
  /** seconds kept after it (he is seen to fall, the shooter to move on) */ after: 1.2,
  /** samples a second */ hz: 20,
  /** deaths kept with their own last seconds (a player's is never the one dropped) */ keep: 6,
  /** WHILE THE RUN IS ON, squad's view only (`lostLive`): a teammate lost has his row struck, and — only if somebody still up SAW him go down or HEARD the
   *  shot — the squad KNOWS the way it came from, to the nearest eighth, and the man who saw says the side. Never who, never from where; a man found later is
   *  only down. Whether that way is also DRAWN (an arrow on his row, a stroke on the ground at him) is `liveArrows` below: off as shipped. Off = the row as it was. */
  live: true,
  /** …and whether that way is DRAWN: the arrow on his row and the stroke on the ground at him. False, as the page has it (the maintainer, 10-14: "we shouldn't
   *  show the arrows, feels unrealistic"): the row is struck and the man who saw still says which side — nothing is drawn. ?recaparrows=1 = both back. */
  liveArrows: false,
  /** saw him go down = a line to him, within this far, inside this long of the fall · heard = gunfire (a burst) whose sound path to an ear is this long at most */
  liveSeeM: 25, liveSawSecs: 1, liveHearM: 25,
  /** the beat before the squad has it, s · the man who saw says which side only with the player this near the fallen man (his shoulders mean nothing further
   *  off) · how long the stroke on the ground stays, s */
  liveBeat: 0.6, liveSideM: 8, liveMarkSecs: 20,
};

/** round = a round that landed on him (or one whose line he stood in: a hostage shot by her captor) · blast = a fragmentation burst · other = the game names
 *  who, not how · unknown = neither */
export type RecapCause = 'round' | 'blast' | 'other' | 'unknown';
export interface RecapMan { id: number; name: string; side: string; kind: 'player' | 'man' | 'civ'; }
/** One of ours going down. Plan coordinates [x, z], metres; `gaze` in radians, 0 = +z (the aim yaw he had the sample before he fell). */
export interface RecapDeath {
  t: number; victim: number; name: string; side: string; player: boolean;
  at: [number, number]; gaze: number;
  cause: RecapCause;
  /** who: a character id, −1 = nobody known */ by: number; byName: string; bySide: string;
  /** where his feet were / the muzzle the round left (a round) or the blast's centre */ byAt: [number, number] | null; from: [number, number] | null;
  to: [number, number];
  /** the gun's row name as a chronicle writes it (gear.ts plainShort): word it with gearText where it is shown */ weapon: string;
  /** metres from `from` to the man, and degrees between his gaze and the way to it (0 = he was looking straight at it, 180 = dead behind him) */ dist: number; off: number;
  blind: boolean;
  /** gunfire, or a burst: a thing ears place (a suppressed round is not) */ loud: boolean;
}
/** kind: a round · blast = a fragmentation burst (it kills) · bang = a stun canister or a charge (it does not). `at` = the shooter's feet. */
export interface RecapShot { t: number; kind: 'round' | 'blast' | 'bang'; who: number; from: [number, number]; to: [number, number] | null; at?: [number, number]; weapon?: string; loud?: boolean; }
/** men: MAN_STRIDE floats a man = id, x, z, aim yaw, bits (1 down · 2 roused: alert or searching · 4 crouched). doors: 2 a door = the leaf's direction (NaN = off its hinges). */
export interface RecapFrame { t: number; n: number; men: Float32Array; doors: Float32Array; }
export interface RecapDoor { hinge: [number, number]; width: number; }
/** A death with its own last seconds: frames from `t0` to `t1` (the death at `death.t`), the rounds and blasts in them, every one of ours lost in them. */
export interface RecapTake { death: RecapDeath; t0: number; t1: number; cast: RecapMan[]; doors: RecapDoor[]; frames: RecapFrame[]; shots: RecapShot[]; deaths: RecapDeath[]; }
export interface DeathRecap { takes: RecapTake[]; /** the take the card opens on: the last player to go down, else the last of ours */ main: number; }

/** One of the squad lost while the run is on, as much as the squad knows: `from` = the way off him to where the round (the blast) came from, a unit vector on
 *  the plan to the nearest EIGHTH of the compass — a direction, never a place, and never fine enough to lay a ruler along — null until the squad has it
 *  (`knownAt`), and for good when nobody still up saw him go down or heard it. */
export interface LostMan { id: number; name: string; t: number; at: [number, number]; from: [number, number] | null; knownAt: number; }
/** what the recorder keeps of him beside that: the way it came from (handed over as `man.from` only when the squad has it), whether ears had it, who had a
 *  line to him as he went down (the first teammate; the player himself), and `done` once that is settled either way */
interface Lost { man: LostMan; src: [number, number] | null; heard: boolean; saw: Guard | null; samSaw: boolean; done: boolean; }

export const MAN_STRIDE = 5;
export const RECAP_STATS = { deaths: 0, takes: 0, rounds: 0, known: 0, calls: 0 };

interface Round { t: number; by: number; byAt: [number, number]; from: [number, number]; to: [number, number]; weapon: string; blind: boolean; loud: boolean; }
interface State {
  mission: object; lastT: number; next: number; primed: boolean;
  /** when the run ended (Infinity while it has not): what the card may show of a run that is played on past its end stops there */ overAt: number;
  frames: RecapFrame[]; spare: RecapFrame[]; shots: RecapShot[]; seen: WeakSet<GameEvent>;
  down: Set<number>; rounds: Map<number, Round>; cast: Map<number, RecapMan>;
  deaths: RecapDeath[]; due: { death: RecapDeath; at: number }[]; takes: RecapTake[];
  lost: Lost[]; /** the same men as the squad knows them: what lostLive hands out */ lostPub: LostMan[]; lostNext: number;
}
const states = new WeakMap<Game, State>();
const fresh = (g: Game): State => ({ mission: g.mission, lastT: g.time, next: g.time, primed: false, overAt: Infinity, frames: [], spare: [], shots: [], seen: new WeakSet(), down: new Set(), rounds: new Map(), cast: new Map(), deaths: [], due: [], takes: [], lost: [], lostPub: [], lostNext: 0 });
function stateOf(g: Game): State {
  let S = states.get(g);
  if (!S || S.mission !== g.mission || g.time < S.lastT) { S = fresh(g); states.set(g, S); }   // a restart or a load: that run's deaths are not this run's
  return S;
}

/** Whose deaths are explained: the players', their teammates', the people they came for. */
const ours = (side: string) => side === 'player' || side === 'operative' || side === 'civilian';
const sideOf = (gd: Guard): string => gd.civ ? 'civilian' : gd.team;
const xz = (p: Vec3): [number, number] => [p[0], p[2]];

/** Every character on the floor: the players first. (One player today; a second is one more line here.) */
function eachMan(g: Game, fn: (c: Character, down: boolean, gd: Guard | null) => void): void {
  fn(g.player.char, g.player.down, null);
  for (const gd of g.guards) fn(gd.char, gd.state === 'dead', gd);
  for (const gd of civiliansShown(g)) fn(gd.char, gd.state === 'dead', gd);
}
function manOf(c: Character, gd: Guard | null): RecapMan {
  return gd ? { id: c.id, name: gd.callsign, side: sideOf(gd), kind: gd.civ ? 'civ' : 'man' } : { id: c.id, name: 'Player', side: 'player', kind: 'player' };
}

const live = (g: Game) => RECAP.on && !g.touring && !g.quietUtility && !g.puppet;

/** combat.ts fireWeapon, once it knows whom the round lands on and before anything is done to him: remembered as the last round into that man. Whether it puts
 *  him down is the game's to say — `recapTick` reads the answer off the man himself. `wasDown`: he was down already (a round into a man on the floor is not the
 *  round that put him there, and must not replace it). */
export function recapRound(g: Game, victim: Character | null | undefined, wasDown: boolean, shooter: Character, muzzle: Vec3, hit: Vec3, def: WeaponDef, blind?: boolean): void {
  if (!victim || wasDown || !live(g)) return;
  RECAP_STATS.rounds++;
  stateOf(g).rounds.set(victim.id, { t: g.time, by: shooter.id, byAt: xz(shooter.pos), from: xz(muzzle), to: xz(hit), weapon: plainShort(def), blind: !!blind, loud: def.report.level >= 1 });
}

/** how long after a round / a blast a man going down is still that round's doing (a shotgun's pellets are judged a few frames late; a ragdoll's state flips on the frame) */
const CAUSE_SECS = 0.3;
/** a fragmentation burst reaches this far (frag.ts FRAG.woundM, with room for the step he took as it went) */
const BLAST_M = 9;
/** a round with nobody's name on it whose line passed this close to him as he went down was his (an AI round never tests a civilian: a captor's round goes
 *  through his hostage and the game puts her down by hand — rescue.ts) */
const LINE_M = 0.6;
function offLine(p: [number, number], a: [number, number], b: [number, number]): number {
  const ux = b[0] - a[0], uz = b[1] - a[1], L = ux * ux + uz * uz;
  const k = L > 1e-9 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uz) / L)) : 0;
  return Math.hypot(p[0] - a[0] - ux * k, p[1] - a[1] - uz * k);
}

function explain(g: Game, S: State, c: Character, gd: Guard | null, gaze: number): RecapDeath {
  const me = S.cast.get(c.id) ?? manOf(c, gd); const at = xz(c.pos); const now = g.time;
  const d: RecapDeath = { t: now, victim: c.id, name: me.name, side: me.side, player: !gd, at, gaze, cause: 'unknown', by: -1, byName: '', bySide: '', byAt: null, from: null, to: at, weapon: '', dist: 0, off: 0, blind: false, loud: false };
  const r = S.rounds.get(c.id);
  let blast: RecapShot | null = null, through: RecapShot | null = null;
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i]; if (now - s.t > CAUSE_SECS) break;
    if (!blast && s.kind === 'blast' && Math.hypot(s.from[0] - at[0], s.from[1] - at[1]) <= BLAST_M) blast = s;
    if (!through && s.kind === 'round' && s.to && s.who !== c.id && offLine(at, s.from, s.to) <= LINE_M) through = s;
  }
  if (r && now - r.t <= CAUSE_SECS) { d.cause = 'round'; d.by = r.by; d.byAt = r.byAt; d.from = r.from; d.to = r.to; d.weapon = r.weapon; d.blind = r.blind; d.loud = r.loud; }
  else if (blast) { d.cause = 'blast'; d.by = blast.who; d.from = blast.from; d.loud = true; }
  else if (through) { d.cause = 'round'; d.by = through.who; d.byAt = through.at ?? null; d.from = through.from; d.weapon = through.weapon ?? ''; d.loud = !!through.loud; }
  else if (gd && gd.killerId >= 0) { d.cause = 'other'; d.by = gd.killerId; }
  const who = d.by >= 0 ? S.cast.get(d.by) : undefined;
  if (who) { d.byName = who.name; d.bySide = who.side; }
  if (d.by >= 0 && !d.byAt) eachMan(g, k => { if (k.id === d.by) d.byAt = xz(k.pos); });
  const src = d.from ?? d.byAt;
  if (src) {
    const dx = src[0] - at[0], dz = src[1] - at[1]; d.dist = Math.hypot(dx, dz);
    if (d.dist > 1e-3) { let a = Math.atan2(dx, dz) - gaze; a = Math.atan2(Math.sin(a), Math.cos(a)); d.off = Math.abs(a) * 180 / Math.PI; }
  }
  return d;
}

function sample(g: Game, S: State): void {
  let n = 0; eachMan(g, () => { n++; });
  const doors = g.doors.list;
  let f = S.spare.pop();
  if (!f || f.men.length < n * MAN_STRIDE || f.doors.length !== doors.length * 2) f = { t: 0, n: 0, men: new Float32Array((n + 4) * MAN_STRIDE), doors: new Float32Array(doors.length * 2) };
  f.t = g.time; f.n = n; let i = 0; const men = f.men;
  eachMan(g, (c, down, gd) => {
    men[i++] = c.id; men[i++] = c.pos[0]; men[i++] = c.pos[2]; men[i++] = c.aimYaw;
    men[i++] = (down ? 1 : 0) | (gd && (gd.state === 'alert' || gd.state === 'search') ? 2 : 0) | (!gd && g.player.crouch ? 4 : 0);
  });
  for (let k = 0; k < doors.length; k++) { const d = doors[k]; if (d.off) { f.doors[k * 2] = NaN; f.doors[k * 2 + 1] = NaN; } else { const u = d.dir(); f.doors[k * 2] = u[0]; f.doors[k * 2 + 1] = u[1]; } }
  S.frames.push(f);
  const keep = Math.ceil((RECAP.secs + RECAP.after + 1) * RECAP.hz);
  while (S.frames.length > keep) S.spare.push(S.frames.shift()!);
}

function take(g: Game, S: State, death: RecapDeath): void {
  const t0 = death.t - RECAP.secs, t1 = Math.min(g.time, death.t + RECAP.after);
  const frames: RecapFrame[] = [];
  for (const f of S.frames) if (f.t >= t0 - 1e-6 && f.t <= t1 + 1e-6) frames.push({ t: f.t, n: f.n, men: f.men.slice(0, f.n * MAN_STRIDE), doors: f.doors.slice() });
  if (!frames.length) return;
  const T: RecapTake = {
    death, t0, t1, cast: [...S.cast.values()],
    doors: g.doors.list.map(d => ({ hinge: [d.def.hinge[0], d.def.hinge[1]] as [number, number], width: d.def.width })),
    frames, shots: S.shots.filter(s => s.t >= t0 && s.t <= t1), deaths: S.deaths.filter(x => x.t >= t0 && x.t <= t1),
  };
  const had = S.takes.findIndex(x => x.death === death);   // (asked for before its last second had run: that early take is replaced by the whole one)
  if (had >= 0) { S.takes[had] = T; return; }
  S.takes.push(T); RECAP_STATS.takes++;
  while (S.takes.length > Math.max(1, RECAP.keep)) { const i = S.takes.findIndex(x => !x.death.player); S.takes.splice(i < 0 ? 0 : i, 1); }
}

/** `early`: also take the deaths whose last second has not run yet, with what there is — they stay due, and the whole take replaces the early one in time. */
function flush(g: Game, S: State, early: boolean): void {
  for (let i = 0; i < S.due.length;) { const ripe = g.time >= S.due[i].at; if (ripe || early) take(g, S, S.due[i].death); if (ripe) S.due.splice(i, 1); else i++; }
}

/** Last in Game.step: this frame's rounds, who went down in it, a sample of the floor when one is due. */
export function recapTick(g: Game): void {
  if (!live(g)) { const Z = states.get(g); if (Z) Z.primed = false; return; }   // (not watching: whoever goes down meanwhile is not a death seen — the next look starts from the floor as it is)
  const S = stateOf(g); const now = g.time; S.lastT = now;
  // rounds and blasts filed this frame (the game forgets an event after half a second)
  const ev = g.events; let first = ev.length;
  while (first > 0 && !S.seen.has(ev[first - 1])) first--;
  for (let i = first; i < ev.length; i++) {
    const e = ev[i]; S.seen.add(e);
    if ((e.kind === 'shot' || e.kind === 'guardShot') && e.from && e.to && e.who !== undefined) S.shots.push({ t: e.time, kind: 'round', who: e.who, from: xz(e.from), to: xz(e.to), at: xz(e.pos), weapon: e.weapon ? plainShort(WEAPONS[e.weapon]) : '', loud: (e.level ?? 0) >= 1 });
    else if (e.kind === 'bang') S.shots.push({ t: e.time, kind: e.frag ? 'blast' : 'bang', who: e.who ?? -1, from: xz(e.pos), to: null });
  }
  const old = now - (RECAP.secs + RECAP.after + 1);
  while (S.shots.length && S.shots[0].t < old) S.shots.shift();
  // who is down who was not
  const last = S.frames[S.frames.length - 1];
  eachMan(g, (c, down, gd) => {
    if (!S.cast.has(c.id)) S.cast.set(c.id, manOf(c, gd));
    if (!down) { S.down.delete(c.id); return; }
    if (S.down.has(c.id)) return;
    S.down.add(c.id);
    if (!S.primed) return;   // down before this state's first look (a body a checkpoint brought back): not a death of this run
    const me = S.cast.get(c.id)!;
    if (!ours(me.side)) return;
    let gaze = c.aimYaw;
    if (last) for (let i = 0; i < last.n; i++) if (last.men[i * MAN_STRIDE] === c.id) { gaze = last.men[i * MAN_STRIDE + 3]; break; }
    const d = explain(g, S, c, gd, gaze);
    if (gd && (gd.downKind === 'struck' || gd.downKind === 'choked') && d.cause !== 'round' && d.cause !== 'blast') return;   // put out cold by a hand (a civilian the player chokes): nobody was shot, there is nothing to explain
    S.deaths.push(d); if (S.deaths.length > 32) S.deaths.shift();
    S.due.push({ death: d, at: now + RECAP.after }); RECAP_STATS.deaths++;
    if (gd && gd.unit && me.side === 'operative') {   // a man of the squad: what the squad may know of it while the run is on (lostLive)
      const src = d.from ?? d.byAt, man: LostMan = { id: c.id, name: me.name, t: now, at: [d.at[0], d.at[1]], from: null, knownAt: Infinity };
      S.lost.push({ man, src: src ? eighth(src[0] - d.at[0], src[1] - d.at[1]) : null, heard: d.loud && !!d.from && heard(g, [d.from[0], 1.3, d.from[1]]), saw: null, samSaw: false, done: false });
      S.lostPub.push(man); S.lostNext = 0;
    }
  });
  if (S.lost.length && now >= S.lostNext) { S.lostNext = now + 0.25; witness(g, S); }
  S.primed = true;
  if (S.overAt === Infinity && recapOver(g)) S.overAt = now;
  if (now >= S.next) { S.next = now - S.next > 1 ? now + 1 / RECAP.hz : S.next + 1 / RECAP.hz; sample(g, S); }
  if (S.due.length) flush(g, S, false);
}

/** a way on the plan to the nearest eighth of the compass (null: no way at all) */
function eighth(dx: number, dz: number): [number, number] | null {
  if (Math.hypot(dx, dz) <= 0.05) return null;
  const a = Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.sin(a), Math.cos(a)];
}
const headOf = (c: Character): Vec3 => c.bones.head ?? [c.pos[0], c.pos[1] + 1.65, c.pos[2]];
const squadUp = (gd: Guard): boolean => !!gd.unit && gd.team === 'operative' && gd.state !== 'dead';
/** a line from a man still up to one going down (the room fight's own 'man down' test, with a reach): blind men see nothing */
function lineTo(g: Game, c: Character, at: [number, number]): boolean {
  return Math.hypot(c.pos[0] - at[0], c.pos[2] - at[1]) <= RECAP.liveSeeM && !g.col.segmentBlocked(headOf(c), [at[0], 0.4, at[1]]);
}
/** Did anybody of the squad still up hear it. The sound model's own rule (collision.ts SoundPaths.propagate: a clear line, or over the furniture, else the
 *  walk round at the path's length, a shut leaf across it muffling it hard) asked WITHOUT its cache: that cache is the simulation's own ears', and an entry
 *  filed from here would hand them this file's answer for a cell pair in place of theirs. */
function heard(g: Game, src: Vec3): boolean {
  const col = g.col, reach = RECAP.liveHearM, a: Vec3 = [src[0], Math.max(src[1], 0.9), src[2]];
  const ear = (c: Character): boolean => {
    const h = headOf(c), b: Vec3 = [h[0], Math.max(h[1], 0.9), h[2]], straight = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (straight > reach) return false;
    if (!col.solidBlocked(a, b)) return true;
    if (!col.solidBlocked([a[0], 2, a[2]], [b[0], 2, b[2]])) return straight <= reach * 0.9;
    if (straight > 28) return false;
    const path = col.nav.findPath(b, a, 6000); if (!path || !path.length) return false;
    let L = 0, door = false, pa: Vec3 = [b[0], 1, b[2]];
    for (const q of path) { const pb: Vec3 = [q[0], 1, q[2]]; L += Math.hypot(pb[0] - pa[0], pb[2] - pa[2]); if (!door && col.segmentBlockedDynamic(pa, pb, BoxFlag.SoundSeal)) door = true; pa = pb; }
    L = Math.max(L + Math.hypot(a[0] - pa[0], a[2] - pa[2]), straight);
    return L <= reach * (door ? 0.32 : 0.72);
  };
  for (const gd of g.guards) if (squadUp(gd) && ear(gd.char)) return true;
  return !g.player.down && ear(g.player.char);
}
/** did the player's own man see him go down: a line, and — where the fog is a cone (hard) — inside the wedge he looks down or at his shoulder */
function samSees(g: Game, at: [number, number]): boolean {
  const pl = g.player, c = pl.char; if (pl.down || g.time < pl.dazzledUntil || !lineTo(g, c, at)) return false;
  if (!FOG.cone) return true;
  const dx = at[0] - c.pos[0], dz = at[1] - c.pos[2], d = Math.hypot(dx, dz); if (d <= FOG.coneNearM) return true;
  const u = gazeOf(c); return (dx * u[0] + dz * u[2]) / d >= Math.cos(FOG.coneDeg * Math.PI / 360);
}
/** the side of the PLAYER's man a way lies on, in the words of the fog's own calls (fogofwar.ts sideOf, asked of a point a long way off along it) */
function sideWord(g: Game, u: [number, number]): string {
  const c = g.player.char, s = g.fogOfWar.sideOf([c.pos[0] + u[0] * 50, 0, c.pos[2] + u[1] * 50]);
  return s === 'front' ? 'from the front' : s === 'behind' ? 'from behind us' : `from the ${s}`;
}
/** Each man lost and not yet settled: who has a line to him inside his first second down; after the beat, if somebody saw or ears had it, the squad has the
 *  way it came from — and the teammate who saw says which side, when the player did not see it himself and stands near enough for 'left' to mean anything
 *  (cues.ts aside: a bubble of the cues' own — never Guard.bubble, no strip row, no die, nothing a run reads). Nobody saw, nobody heard: he is only down. */
function witness(g: Game, S: State): void {
  const pl = g.player;
  for (const L of S.lost) {
    if (L.done) continue;
    const M = L.man, age = g.time - M.t;
    if (age <= RECAP.liveSawSecs) {
      if (!L.saw) for (const gd of g.guards) if (squadUp(gd) && g.time >= gd.dazzledUntil && lineTo(g, gd.char, M.at)) { L.saw = gd; break; }
      if (!L.samSaw) L.samSaw = samSees(g, M.at);
    }
    if (age < RECAP.liveBeat) continue;
    const by = L.saw && squadUp(L.saw) ? L.saw : null, sam = L.samSaw && !pl.down;   // (a witness who has gone down himself since tells nobody)
    if (!by && !sam && !L.heard) { if (age > RECAP.liveSawSecs) L.done = true; continue; }
    L.done = true; M.knownAt = g.time; M.from = L.src; RECAP_STATS.known++;
    if (RECAP.live && L.src && by && !sam && !pl.down && Math.hypot(pl.char.pos[0] - M.at[0], pl.char.pos[2] - M.at[1]) <= RECAP.liveSideM
      && g.cues.bubbleOf(by) === by.bubble   // (no cue of the cues' own is up over him: a contact call outranks this; his own 'man down.' is followed by it)
      && g.cues.aside(by, `${sideWord(g, L.src)}!`)) RECAP_STATS.calls++;
  }
}
const NONE: readonly LostMan[] = [];
/** The squad's men lost so far this run, as the squad knows them (the HUD's read while the run is on): empty with the switch off. */
export function lostLive(g: Game): readonly LostMan[] {
  if (!RECAP.on || !RECAP.live) return NONE;
  const S = states.get(g);
  return S && S.mission === g.mission ? S.lostPub : NONE;
}
/** is the live rule drawing at all (the squad block strikes every man of the squad who is down while it is: the record only adds the way it came from, drawn only under `liveArrows`) */
export function lostShown(): boolean { return RECAP.on && RECAP.live; }
/** is the way a lost man's round came from DRAWN — the arrow on his row, the stroke on the ground (RECAP.liveArrows; ui/overlay.ts asks before either) */
export function lostArrowsShown(): boolean { return lostShown() && RECAP.liveArrows; }
export function lostOf(g: Game, id: number): LostMan | null { for (const L of lostLive(g)) if (L.id === id) return L; return null; }

/** The run is over for everybody: nobody is left who could be told something he should not know. With one player that is him down, or the mission ended either
 *  way; with more it must be EVERY player down or the mission ended. */
export function recapOver(g: Game): boolean {
  const s = g.mission.stage;
  return g.player.down || s === 'failed' || s === 'done';
}

/** What the end card may show: null while anybody still plays, with the switch off, or when nobody of ours went down. */
export function deathRecapOf(g: Game): DeathRecap | null {
  if (!RECAP.on || !recapOver(g)) return null;
  const S = states.get(g);
  if (!S || S.mission !== g.mission) return null;
  flush(g, S, true);   // the card can come up before a death's last second has run: take what there is (the tick replaces it with the whole take if the world runs on)
  // A run that is played on past its end (out with the drive and 'keep playing'; a mission lost with the player up) is not over for the man playing it: only what
  // happened up to the end is shown, until every player is down.
  const takes = g.player.down ? S.takes : S.takes.filter(T => T.death.t <= S.overAt + 1e-6);
  if (!takes.length) return null;
  let main = takes.length - 1;
  for (let i = takes.length - 1; i >= 0; i--) if (takes[i].death.player) { main = i; break; }
  return { takes, main };
}

/** For checks: every one of ours lost so far this run, whoever is still playing. Never for a screen. */
export function recapDeathsForChecks(g: Game): readonly RecapDeath[] { const S = states.get(g); return S && S.mission === g.mission ? S.deaths : []; }
