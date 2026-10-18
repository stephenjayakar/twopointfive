// BOTH SIDES REACT WHEN THE LEVEL BREAKS (the destruction goal's AI part; notes: rebuild/destruction/ai-react.md).
//
// The destruction engine (wallbreak.ts) keeps the WORLD true the moment a wall or a piece of cover goes: the picture, rounds, eyes, sound, feet and the nav grid
// all take the same change, and one row per change is filed in its feed (`g.destr.walls.onChange`). What it cannot keep true is what the AI built ONCE per
// level and what a man decided a moment ago: the room he thinks he is in, the openings his team watches, the mark he is standing on. This module reads the
// feed and keeps those true — by each man's own senses, on both sides, with nothing scripted:
//
//   (a) COVER GONE. A man standing within a few strides of a change asks one question: from where the trouble is (the man he last saw, where the rounds come
//       from, whoever made the hole, the far side of a hole beside him), is my chest open NOW along a line that crosses what just went (WALLREACT.everyGone:
//       the newest thing first, then each thing that went before it while he was owed the answer; off, the newest row's alone)? If so he moves:
//       a defender holding a room takes the room fight's own cover move and plants again where he ends up; a man in the fight AI takes its shift-to-cover; a
//       teammate on a mark has his mark moved to the nearest spot out of that line (a stack slides along its wall). A man who cannot move this second (blind,
//       held, eyes on a man at arm's length) is asked again for a few seconds.
//   (b) A NEW OPENING. A breach (a port: the wall's upper knocked out; a hole: floor to top) is NOTICED by the men who hear it open (the sound model's own path
//       length, a blast far, a wall shot through near), who see it (a line to it, in front of them) or who made it — fog of war stands: nobody else knows.
//       The team shares what one of them knows (they are on a net); a defender tells the men in earshot a breath later. Known to the team it becomes one of
//       the squad's OPENINGS (cover.ts): the unasked cover deals it to a free gun like any doorway, and the entry points count it as a way a round can come
//       (entrypoints.ts — a point of an entry is not left in its line while what is beyond is unknown). Known to a defender it is weighed against the door he
//       watches (roomfight.ts applyWatch → wallReactLook): hearing it go, a man seen through it and rounds through it are evidence, a hole into his room is
//       worth a gun by itself; his gun, his eyes and his fix go onto it.
//   (c) A WAY THROUGH. The nav grid is already re-baked, so every walk planned from now on may go through a hole. What was flooded before is refreshed: the
//       room fight's rooms on either side of a walk-through hole become ONE room for everybody (the same Room object for the men who held it — their evidence
//       is carried over door by door), so nobody counts a mate through a hole as 'in the next room', breaks off to 'the other side' of a wall that is gone, or
//       holds a room as sealed with a hole in it. The team's cleared-rooms book (cleared.ts) needs nothing: a hole's floor is no room's, exactly like a
//       doorway — what is beyond it stays UNCLEARED until one of the team stands there. A flanking plan under way (tactics.ts) is dealt again once when one of
//       its men learns of a hole a man fits through.
//
// SWITCH: WALLREACT.on (default on) — and nothing here runs without THE ONE SWITCH of the destruction goal (destructionSwitch.ts), because no row is ever
// filed without it. Off = the engine's build by digest: every hook returns on its first line. Everything is this module's own state (a WeakMap by Game), reset
// with the encounter. Deterministic: no dice of its own (a man's bark goes through g.say like any other).
//
// NOT here (other pieces'): who decides to shoot at cover or through a wall, who places a charge, doors off their hinges, glass.
import { SideMap } from '../math/side';
import { v3, type Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Opening } from './cover';
import type { Assignment } from './orders';
import type { LevelChange } from './wallbreak';
import type { Team } from './teams';
import { isHostile } from './teams';
import { coverFrom, SUPPRESSION } from './suppression';
import { order } from './squad';
import { doorCells } from './guards';
import { PLAYER_ID } from './consts';
import { lastStandMan } from './laststand';
import { squadStaysIn } from './enemysquads';
import { digInSet } from './digin';
import { coverfireOn } from './coverfire';
import { WALL_ORDER } from './wallcharge';
import { WORDS } from './words';

export const WALLREACT = {
  /** the switch (and only ever live under the destruction goal's own) */
  on: true,
  // ---- noticing a breach
  /** a man sees a breach he has a line to inside this, in a cone `fovDeg` wide about where he faces (the guards' own eye cone is 116°) */
  seeM: 18, fovDeg: 116,
  /** path length (the sound model's) a wall going is heard at: by a blast · by fire · a collapse */
  hearBlastM: 26, hearFireM: 10, hearFallM: 14,
  /** a defender who learned of one by his own senses tells his side's men within this much sound path, this many seconds later */
  tellM: 12, tellSecs: 1.2,
  // ---- cover gone
  /** a man this near what changed asks whether he is still covered */
  nearM: 2.6,
  /** … and is asked again for this long while he cannot move (blind, held, a man at arm's length) */
  retrySecs: 5,
  /** EVERY THING THAT WENT: one blast can file two rows beside a man — the crate he kneels behind, then the furniture round it — and the one question kept for
   *  him was the newest row's, so he was asked about the cupboard, never about his crate ('nothing beyond it to hide from'), and knelt on in the open. On: the
   *  question he is still owed keeps each thing that went before the newest too — its rect, its breach, whose doing it was — and where the newest has nothing
   *  to say to him the one before it is asked, each exactly as a row alone is asked (so a newest row that moves him moves him as it always did). No more than
   *  `goneMax` things a question: past that the one furthest from him is let go. OFF here and on the frozen stand (`TPS_EVERYGONE=1`), ON in the page (`?everygone=0` = the newest row alone, as it was); a
   *  recording from before the key replays with it off. */
  everyGone: false, goneMax: 6,
  /** ONE BLAST, ONE FLOOD: a blast that opens two walls files two rows, and the first was flooded with the second hole already in the floor — its fill ran on
   *  through that hole into a room the row never touched and stopped there as 'the same room' (roomfight.ts roomAt), a room whose door list was still its old
   *  one; the defenders' evidence was carried over onto that short list and what they knew of every other door was dropped (the second row's flood put the
   *  doors back, not the evidence). On: the rows of one frame are flooded as one — every room any of them touches, once. OFF here and on the frozen stand
   *  (`TPS_BLASTFLOOD=1`), ON in the page (`?blastflood=0` = a flood a row, as it was); a recording from before the key replays with it off. */
  blastFlood: false,
  /** a mark is not moved further than this */
  stepM: 3.5,
  /** a holding man with nothing nearer runs this far for a corner */
  runM: 9,
  /** the far side of a hole beside a man counts as where trouble is from this far beyond it */
  beyondM: 2.5,
  // ---- watching a breach (defenders)
  /** evidence: hearing or seeing it open · per second with an enemy in sight through it · per second with rounds coming through it · forgotten per second */
  evOpen: 1.6, evSeen: 1.5, evFire: 1.0, forget: 0.12,
  /** what a breach is worth with no evidence at all: one a man fits through · a port · less per mate already on it · kept once on it */
  holeBase: 0.45, portBase: 0.2, crowd: 0.35, sticky: 0.15,
  /** … and for this long after a man learns of one it outweighs any door: he looks at what just opened */
  freshSecs: 3, fresh: 3,
  /** … inside this, with a line to it */
  watchM: 16,
  // ---- the squad's book
  /** a breach is an opening a round can come through for the entry points too (off: only the unasked cover watches it) */
  entryRisk: true,
  /** barks */
  say: true,
};
export const WALLREACT_STATS = { rows: 0, breaches: 0, merged: 0, learnedOps: 0, learnedMen: 0, told: 0, movedDef: 0, movedAI: 0, movedOp: 0, noCover: 0, watches: 0, replans: 0, openings: 0 };
export const WALLREACT_LOG: string[] = [];
/** a tool's hook (tools/qa/wallreact-play.ts blows its holes from here): called at the top of every tick whatever the switch says, so an on / off pair of runs
 *  gets the same blasts */
/** a probe's ear: why each candidate spot was or was not taken */
export const WALLREACT_DEBUG: { log: ((s: string) => void) | null } = { log: null };
export const WALLREACT_TEST: { tick: ((g: Game) => void) | null } = { tick: null };

/** One opening in a wall: a port (eyes and rounds) or a hole (feet too). `u` runs along the wall, `n` through it; `lo`‥`hi` along `u` from `c0`. */
export interface Breach {
  key: string; wall: number; c0: [number, number]; u: [number, number]; n: [number, number]; lo: number; hi: number;
  /** its middle, chest high · half its width */
  at: Vec3; half: number;
  /** grown into another breach of its wall and out of the book: that one (WALLREACT.everyGone: a thing a question keeps is about the breach that is left) */
  into?: Breach;
  walk: boolean; t: number; cause: LevelChange['cause']; who: number;
  /** who blew the charge that made it a blown wall, where that was not its first opener (`who` stays the first: other readers key on it) — read only for the line they say */
  blastBy?: number;
  /** the team knows it (since when) · the defenders who know it (since when) */
  ops: number; men: Map<Guard, number>;
  /** somebody has said so, per side · the men owed the news, by whom, and when */
  said: Set<Team>; tell: { by: Guard; at: number }[];
  /** the squad's opening for it (cover.ts), once the team knows */
  opening: Opening | null;
}
interface Mind { ev: number; line: boolean; lineT: number; t: number }
/** one thing that went, as a question holds it: where, the breach it made (a wall's) and whose doing it was */
interface Gone { rect: [number, number, number, number]; b: Breach | null; who: number }
interface Pend extends Gone { gd: Guard; /** WALLREACT.everyGone: what went before this while he was still owed the question, newest first */ also?: Gone[]; until: number; next: number }
// (roomfight.ts keeps these to itself: the shapes this module reads and re-floods, mirrored)
interface Entry { door: Door; at: Vec3; out: [number, number] }
interface Room { id: number; cells: Set<number>; entries: Entry[] }
interface Def { gd: Guard; room: Room | null; ev: number[]; watch: number; want: number; glanceTo: number; glanceUntil: number; mode: 'hold' | 'move' | 'free'; moveKind: 'fallback' | 'cover'; moveT: number; cameBy: Door | null; stallAt: Vec3; stallT: number; movedAt: number; station: Vec3; pt: Vec3 }
interface FightBooks { rooms: Room[]; roomOfCell: Map<number, Room>; defs: Def[]; roomAt(p: Vec3): Room | null; stats: { tookCover: number }; log: { t: number; who: string; what: string }[] }

const flat = v3.distXZ;
const EYE = 1.55, CHEST = 1.1;
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
const note = (g: Game, s: string) => { WALLREACT_LOG.push(`${g.time.toFixed(2)} ${s}`); if (WALLREACT_LOG.length > 400) WALLREACT_LOG.splice(0, 200); };
/** does the plan segment p → q cross the axis-aligned rect (inflated by `pad`) */
function segRect(p: Vec3, q: Vec3, r: [number, number, number, number], pad: number): boolean {
  const x0 = r[0] - pad, z0 = r[1] - pad, x1 = r[2] + pad, z1 = r[3] + pad; let t0 = 0, t1 = 1; const dx = q[0] - p[0], dz = q[2] - p[2];
  for (const [d, o, lo, hi] of [[dx, p[0], x0, x1], [dz, p[2], z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const s = a; a = b; b = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
  }
  return true;
}
const rectDist = (p: Vec3, r: [number, number, number, number]) => Math.hypot(Math.max(r[0] - p[0], 0, p[0] - r[2]), Math.max(r[1] - p[2], 0, p[2] - r[3]));

export class WallReact {
  breaches: Breach[] = [];
  private queue: LevelChange[] = []; private stale = false;
  private pend: Pend[] = [];
  /** WALLREACT.blastFlood: the floor all of this frame's rows opened, until the first of them has flooded it (then empty); null = a flood a row */
  private floodAll: number[] | null = null;
  private minds = new Map<Guard, Map<Breach, Mind>>();
  /** who rests his gun on which breach right now (defenders) */
  watching = new Map<Guard, Breach>();
  private last = -1; private lastEv = -1; private lastSweep = -1;
  private movedT = new SideMap<Guard, number>();
  private unsub: (() => void) | null = null;
  constructor(private g: Game) {
    const W = g.destr?.walls; if (!W) return;
    this.unsub = W.onChange(row => { if (row.kind === 'reset') this.stale = true; if (WALLREACT.on) this.queue.push(row); });
  }
  get live(): boolean { const g = this.g; return WALLREACT.on && !!this.unsub && g.aiEnabled && !g.quietUtility && !g.touring; }
  private get fight(): FightBooks { return this.g.fight as unknown as FightBooks; }
  private defOf(gd: Guard): Def | null { return this.fight.defs.find(D => D.gd === gd) ?? null; }

  /** a restart (Game.resetGuards): nothing known, nobody owed a move. The breaches themselves go when the walls are put back (the feed's 'reset' row). */
  reset() { this.pend.length = 0; this.minds.clear(); this.watching.clear(); this.last = this.lastEv = this.lastSweep = -1; for (const b of this.breaches) { b.ops = -1; b.men.clear(); b.said.clear(); b.tell.length = 0; } this.dropOpenings(); }

  tick() {
    const g = this.g;
    if (this.stale || (!WALLREACT.on && (this.breaches.length || this.queue.length))) {   // (the walls are back — or the switch was put off mid-run: every book as the level was built, rows from before it dropped with it)
      let k = -1; this.queue.forEach((r, i) => { if (r.kind === 'reset') k = i; }); this.queue.splice(0, WALLREACT.on ? k + 1 : this.queue.length);
      this.stale = false; this.unflood(); this.reset(); this.breaches.length = 0; }   // (the walls are back: every room as it was built — whatever the switch says, a book flooded through a hole must not outlive it)
    if (!this.live) { this.queue.length = 0; return; }
    const rows = this.queue.splice(0); this.floodAll = null;
    if (WALLREACT.blastFlood) { const all = rows.filter(r => r.kind !== 'reset' && r.kind !== 'door' && r.opened.length); this.floodAll = all.length > 1 ? all.flatMap(r => r.opened) : null; }   // (the floor every row of this frame opened: flooded once, at the first of them)
    for (const row of rows) this.take(row);
    this.floodAll = null;
    if (!this.breaches.length && !this.pend.length) return;
    const now = g.time;
    if (this.lastEv < 0 || now - this.lastEv >= 0.1 || now < this.lastEv) { const dt = this.lastEv < 0 || now < this.lastEv ? 0.1 : Math.min(0.5, now - this.lastEv); this.lastEv = now; this.evidence(dt); }
    if (this.last >= 0 && now >= this.last && now - this.last < 0.25) return; this.last = now;
    this.notice(); this.book();
    if (now - this.lastSweep >= 1 || now < this.lastSweep) { this.lastSweep = now; this.sweep(); }
    for (let i = this.pend.length - 1; i >= 0; i--) { const P = this.pend[i]; if (now < P.next) continue; const r = this.reconsider(P); if (r !== 'later' || now > P.until) this.pend.splice(i, 1); else P.next = now + 0.5; }
  }

  // ================================================================ the feed
  private take(row: LevelChange) {
    if (row.kind === 'reset' || row.kind === 'door') return;   // (a door off its hinges is the doors' own piece)
    WALLREACT_STATS.rows++;
    const b = row.kind === 'cover' ? null : this.upsert(row);
    if (row.opened.length) { if (!this.floodAll) this.reflood(row.opened); else if (this.floodAll.length) { this.reflood(this.floodAll); this.floodAll = []; } }
    if (b) this.heard(b, row);
    const g = this.g;
    const asked = new Set<Guard>();   // (a teammate standing on his mark is beside it by his feet AND by his mark: one question)
    const ask = (gd: Guard) => { if (asked.has(gd)) return; asked.add(gd);
      const i = this.pend.findIndex(x => x.gd === gd), old = i >= 0 && WALLREACT.everyGone ? this.pend[i] : null;
      const P: Pend = { gd, rect: row.rect, b, who: row.who, until: g.time + WALLREACT.retrySecs, next: g.time };
      if (old) { let ob = old.b; while (ob?.into) ob = ob.into; P.also = this.kept(g.orders.of(gd)?.post ?? gd.char.pos, [{ rect: old.rect, b: ob, who: old.who }, ...(old.also ?? [])]); }   // (everyGone: what went before this row is still his to be asked about, when the newest thing has nothing to say to him)
      if (i >= 0) this.pend[i] = P; else this.pend.push(P); };   // (one question a man. With everyGone off it is about the newest thing to go and nothing else; on, the things that went before it while he was owed the answer wait behind it, no more than goneMax in all)
    const own = (gd: Guard) => row.cause === 'fire' && gd.char.id === row.who && coverfireOn(g, gd) !== null;   // (the man whose aimed fire opened it — coverfire.ts, he is chewing it for the line: it is not his cover that went)
    for (const gd of g.guards) if (gd.state !== 'dead' && !own(gd) && rectDist(gd.char.pos, row.rect) <= WALLREACT.nearM) ask(gd);
    for (const A of this.posts()) if (!own(A.gd) && rectDist(A.A.post!, row.rect) <= WALLREACT.nearM) ask(A.gd);   // (a man still walking to a mark beside it)
  }
  /** the things a question keeps behind its newest (newest first): at most goneMax - 1 of them — past that the one FURTHEST from where the man is asked (his
   *  feet; a teammate's mark) is let go (what hid him stood beside him), the oldest of two as far */
  private kept(at: Vec3, list: Gone[]): Gone[] {
    const n = WALLREACT.goneMax - 1; if (n <= 0) return [];
    while (list.length > n) { let k = 0, far = -1; list.forEach((x, i) => { const d = rectDist(at, x.rect); if (d >= far) { far = d; k = i; } }); list.splice(k, 1); }
    return list;
  }
  /** once a second: a man who has SINCE planted himself in front of a breach he knows of (the room fight's own moves, a search, a new mark — none of them
   *  know of holes) is asked exactly as the men who stood there when it opened were */
  private sweep() {
    const g = this.g, K = WALLREACT;
    const ask = (gd: Guard, at: Vec3, b: Breach) => {
      if (this.pend.some(P => P.gd === gd)) return;
      const d = Math.abs((at[0] - b.at[0]) * b.n[0] + (at[2] - b.at[2]) * b.n[1]), l = Math.abs((at[0] - b.at[0]) * b.u[0] + (at[2] - b.at[2]) * b.u[1]);
      if (d > K.nearM || l > b.half + 0.6) return;   // (in front of it, not merely near its wall)
      if (!this.beyond(gd, b, at) || !this.openThrough(b, at, gd.team === 'operative' ? 1.2 : 0.9)) return;   // (… and open through it to floor that is not his own side's: the next breach is looked at, not this one asked about for ever)
      const ax = b.at[0] - b.u[0] * b.half, az = b.at[2] - b.u[1] * b.half, bx = b.at[0] + b.u[0] * b.half, bz = b.at[2] + b.u[1] * b.half;
      this.pend.push({ gd, rect: [Math.min(ax, bx) - 0.1, Math.min(az, bz) - 0.1, Math.max(ax, bx) + 0.1, Math.max(az, bz) + 0.1], b, who: 0, until: g.time + 1.5, next: g.time });
    };
    for (const b of this.breaches) {
      for (const gd of b.men.keys()) { if (gd.state === 'dead') continue; const D = this.defOf(gd); if (D && D.mode === 'hold' && g.time - (D.movedAt ?? -1e9) > K.retrySecs) ask(gd, gd.char.pos, b); }
      if (b.ops >= 0) for (const A of this.posts()) if (A.A.arrived) ask(A.gd, A.A.post!, b);
    }
  }
  /** the breach a wall's row belongs to: a new one, or the one on that wall it widens */
  private upsert(row: LevelChange): Breach | null {
    const g = this.g, W = g.destr.walls.all().find(x => x.id === row.id); if (!W) return null;
    const bx = W.box, cs = Math.cos(bx.yaw ?? 0), sn = Math.sin(bx.yaw ?? 0), alongX = bx.h[0] >= bx.h[2];
    const u: [number, number] = alongX ? [cs, -sn] : [sn, cs], n: [number, number] = alongX ? [sn, cs] : [cs, -sn], c0: [number, number] = [bx.c[0], bx.c[2]], L = alongX ? bx.h[0] : bx.h[2];
    let lo = Infinity, hi = -Infinity;
    for (const [x, z] of [[row.rect[0], row.rect[1]], [row.rect[2], row.rect[1]], [row.rect[0], row.rect[3]], [row.rect[2], row.rect[3]]]) { const s = (x - c0[0]) * u[0] + (z - c0[1]) * u[1]; lo = Math.min(lo, s); hi = Math.max(hi, s); }
    lo = Math.max(-L, lo); hi = Math.min(L, hi);   // (the rect is the fresh columns' world bounds: its run along the wall, clipped to the wall)
    if (!(hi > lo)) return null;
    let b = this.breaches.find(x => x.wall === row.id && lo <= x.hi + 0.3 && hi >= x.lo - 0.3) ?? null;
    const walk = row.kind === 'hole' && row.walkable;   // (floor freed by a shelf falling off a wall that only lost its upper is no way through)
    if (b) { b.lo = Math.min(b.lo, lo); b.hi = Math.max(b.hi, hi); if (row.cause === 'blast') { b.cause = 'blast'; b.blastBy = row.who; }   // (a charge blown into a gap rounds had already cut: it is a blown wall from here on — the line they say, and the blind man's stamp below)
      if (walk && !b.walk) { b.walk = true; b.ops = -1; b.men.clear(); b.said.clear(); b.tell.length = 0; } }   // (a port widened into a way through is news again: learned afresh, plans dealt before it are older than it)
    else {
      b = { key: `breach:${row.id}:${row.serial}`, wall: row.id, c0, u, n, lo, hi, at: [0, CHEST, 0], half: 0, walk, t: g.time, cause: row.cause, who: row.who, ops: -1, men: new Map(), said: new Set(), tell: [], opening: null };
      this.breaches.push(b); WALLREACT_STATS.breaches++;
    }
    // (two breaches of one wall grown into each other: one)
    for (let i = this.breaches.length - 1; i >= 0; i--) { const o = this.breaches[i]; if (o === b || o.wall !== b.wall || o.lo > b.hi + 0.3 || o.hi < b.lo - 0.3) continue;
      b.lo = Math.min(b.lo, o.lo); b.hi = Math.max(b.hi, o.hi); b.walk ||= o.walk; if (o.ops >= 0 && b.ops < 0) b.ops = o.ops; for (const [m, t] of o.men) if (!b.men.has(m)) b.men.set(m, t);
      for (const M of this.minds.values()) { const e = M.get(o); if (e) { M.delete(o); const k = M.get(b); if (k) k.ev = Math.max(k.ev, e.ev); else M.set(b, e); } }
      for (const [m, w] of this.watching) if (w === o) this.watching.set(m, b);
      o.into = b; for (const P of this.pend) if (P.also) for (const X of P.also) if (X.b === o) X.b = b;   // (everyGone: an older thing a question keeps is about the breach its own grew into; the newest thing's is left as it was asked)
      if (o.opening) this.dropOpening(o.opening); this.breaches.splice(i, 1); }
    const mid = (b.lo + b.hi) / 2; b.at[0] = c0[0] + u[0] * mid; b.at[2] = c0[1] + u[1] * mid; b.half = (b.hi - b.lo) / 2;
    if (b.opening) { b.opening.at[0] = b.at[0]; b.opening.at[2] = b.at[2]; b.opening.half = b.half; }
    note(g, `${row.kind} ${row.cause} wall #${row.id} → ${b.key} at (${b.at[0].toFixed(1)}, ${b.at[2].toFixed(1)}) ${(b.half * 2).toFixed(1)} m ${b.walk ? 'WALK' : 'port'}`);
    return b;
  }

  // ================================================================ (c) the room fight's rooms
  /** the walls are whole again: the rooms are flooded afresh, every defender's is re-read where he stands */
  private unflood() {
    const F = this.fight; if (!F?.roomOfCell) return;
    F.rooms.length = 0; F.roomOfCell.clear();
    for (const D of F.defs) { D.room = F.roomAt(D.gd.state === 'dead' ? D.station : D.gd.char.pos); D.ev = D.room ? D.room.entries.map(() => 0) : []; D.watch = D.want = D.glanceTo = -1; }
  }
  /** floor opened: the rooms it touches are flooded again — two rooms joined by a hole are ONE (the lower-numbered Room object lives on, the other becomes
   *  the same cells and entries), and each defender's evidence is carried over by door */
  private reflood(opened: readonly number[]) {
    const g = this.g, F = this.fight, nav = g.col.nav, W = nav.W, cs = nav.cell;
    const touched = new Set<Room>();
    for (const c of opened) for (const n of [c, c - 1, c + 1, c - W, c + W]) { const r = F.roomOfCell.get(n); if (r) touched.add(r); }
    if (!touched.size) return;
    const olds = [...touched].sort((a, b) => a.id - b.id), before = new Map(olds.map(r => [r, { cells: [...r.cells], entries: [...r.entries] }]));
    for (const r of olds) for (const c of r.cells) if (F.roomOfCell.get(c) === r) F.roomOfCell.delete(c);
    const now = new Map<Room, Room>();
    // (dig-in, the press and the last stand hold INDICES into a room's doors: a room's own doors keep their places, in the same Entry objects, and the doors
    //  it gains come after them — for the room that lives on and, in its own order, for the Room object it absorbed)
    const same = (a: Entry, b: Entry) => a.door === b.door && flat(a.at, b.at) < 0.3;
    const merged = (old: Entry[], fresh: Entry[]) => [...old.filter(o => fresh.some(f => same(f, o))), ...fresh.filter(f => !old.some(o => same(o, f)))];
    for (const r of olds) {
      if (now.has(r)) continue;
      const seed = before.get(r)!.cells.find(c => nav.blocked[c] !== 1) ?? -1;
      if (seed < 0) { now.set(r, r); continue; }
      const n0 = F.rooms.length, nr = F.roomAt([((seed % W) + 0.5) * cs, 0, (((seed / W) | 0) + 0.5) * cs]);
      if (!nr) { now.set(r, r); continue; }
      let into = nr;
      if (F.rooms.length > n0 && F.rooms[F.rooms.length - 1] === nr) {   // (a fresh flood: it lives on as the Room the men already hold — the same object, the same Set and list, so whoever else keeps a hand on it reads the new room)
        F.rooms.pop(); r.cells.clear(); for (const c of nr.cells) { r.cells.add(c); F.roomOfCell.set(c, r); } const E = merged(before.get(r)!.entries, nr.entries); r.entries.length = 0; r.entries.push(...E); into = r; }
      now.set(r, into);
      for (const o of olds) { if (now.has(o)) continue; const c0 = before.get(o)!.cells.find(c => nav.blocked[c] !== 1); if (c0 !== undefined && into.cells.has(c0)) { o.cells = into.cells; o.entries = merged(before.get(o)!.entries, into.entries); now.set(o, into); WALLREACT_STATS.merged++; } }
    }
    for (const D of F.defs) {
      if (!D.room || !touched.has(D.room)) continue;
      const was = before.get(D.room)!.entries, room = now.get(D.room) ?? D.room, E = room.entries;
      const idx = (i: number) => i >= 0 && was[i] ? E.findIndex(e => same(e, was[i])) : -1;
      const ev = E.map(e => { const j = was.findIndex(x => same(x, e)); return j >= 0 ? D.ev[j] ?? 0 : 0; });
      D.watch = idx(D.watch); D.want = idx(D.want); D.glanceTo = idx(D.glanceTo); D.ev = ev; D.room = room;
    }
    note(g, `rooms ${olds.map(r => r.id).join('+')} flooded again → ${[...new Set(now.values())].map(r => `${r.id} (${r.cells.size} cells, ${r.entries.length} doors)`).join(', ')}`);
  }

  // ================================================================ (b) noticing
  private head(gd: Guard | 'sam'): Vec3 { const p = gd === 'sam' ? this.g.player.char.pos : gd.char.pos; return [p[0], EYE, p[2]]; }
  private faceOf(b: Breach, from: Vec3, y = 1.3): Vec3 { const s = (from[0] - b.at[0]) * b.n[0] + (from[2] - b.at[2]) * b.n[1] >= 0 ? 1 : -1; return [b.at[0] + b.n[0] * s * 0.3, y, b.at[2] + b.n[1] * s * 0.3]; }
  private sees(b: Breach, from: Vec3, yaw: number | null): boolean {
    const K = WALLREACT; if (flat(from, b.at) > K.seeM) return false;
    if (yaw !== null && Math.abs(wrap(v3.yawTo(from, b.at) - yaw)) > K.fovDeg * Math.PI / 360) return false;
    const eye: Vec3 = [from[0], EYE, from[2]], s = (from[0] - b.at[0]) * b.n[0] + (from[2] - b.at[2]) * b.n[1] >= 0 ? 1 : -1;
    for (const k of [0, 0.6, -0.6]) { const q: Vec3 = [b.at[0] + b.u[0] * b.half * k + b.n[0] * s * 0.3, 1.3, b.at[2] + b.u[1] * b.half * k + b.n[1] * s * 0.3]; if (!this.g.col.segmentBlocked(eye, q)) return true; }
    return false;
  }
  private opsKnow(b: Breach, by: string) { if (b.ops >= 0) return; b.ops = this.g.time; WALLREACT_STATS.learnedOps++; note(this.g, `the team knows ${b.key} (${by})`); }
  private manKnows(b: Breach, gd: Guard, how: 'heard' | 'saw' | 'made' | 'told') {
    if (b.men.has(gd)) return; const g = this.g, K = WALLREACT; b.men.set(gd, g.time);
    let M = this.minds.get(gd); if (!M) this.minds.set(gd, M = new Map());
    M.set(b, { ev: how === 'told' ? K.evOpen * 0.5 : how === 'made' ? 0 : K.evOpen, line: false, lineT: -1, t: how === 'made' ? -1e9 : b.cause === 'blast' && (g.wallCharge?.stats.blown ?? 0) > 0 ? Math.max(g.time, gd.dazzledUntil) : g.time });   // (a man flash-blind as a blast opened it — the wall charge's stun — has it fresh from when his eyes are back: the room fight asks him nothing until then. Only once a wall charge has gone: before one, the stamp is the moment itself, as it always was)
    if (how === 'told') { WALLREACT_STATS.told++; return; }
    WALLREACT_STATS.learnedMen++; note(g, `${gd.callsign} ${how} ${b.key}`);
    if (how === 'made') return;
    b.tell.push({ by: gd, at: g.time + K.tellSecs });
    if (K.say && !b.said.has(gd.team) && gd.state !== 'patrol') { b.said.add(gd.team);   // (a man the noise has not stirred does not call it)
      // (the dialogue pass, words.ts: 'they' did it only if they did — a hole his OWN side's rounds or grenade made is called as a hole, and a port nobody shot — a blast's, a collapse's — is not 'shooting')
      const by = b.cause === 'blast' ? b.blastBy ?? b.who : b.who;   // (a gap one side's rounds cut and the other side then blew is THEIR blown wall, not his own side's hole)
      const own = WORDS.on && (by === PLAYER_ID ? !isHostile(gd.team, 'player') : g.guards.some(x => x.char.id === by && x.team === gd.team));
      g.say(gd, own ? (b.walk ? "the wall's down — watch it!" : 'hole in the wall — watch it!')
        : b.walk ? (b.cause === 'blast' ? "they've blown the wall!" : "the wall's down — they can come through!") : WORDS.on && b.cause !== 'fire' ? 'hole in the wall — watch it!' : "they're shooting through the wall!"); }
  }
  /** the wall going, as a noise: who hears it open knows where */
  private heard(b: Breach, row: LevelChange) {
    const g = this.g, K = WALLREACT, R = row.cause === 'blast' ? K.hearBlastM : row.cause === 'fire' ? K.hearFireM : K.hearFallM, src: Vec3 = [row.pos[0], 1.3, row.pos[2]];
    const hears = (head: Vec3) => flat(head, src) < R && g.col.sound.propagate(src, head).pathLen < R;
    if (row.who === PLAYER_ID || (!g.player.down && hears(this.head('sam')))) this.opsKnow(b, row.who === PLAYER_ID ? 'the player made it' : 'the player heard it');
    for (const gd of g.guards) {
      if (gd.state === 'dead') continue; const made = gd.char.id === row.who;
      if (!made && !hears(this.head(gd))) continue;
      if (gd.team === 'operative') this.opsKnow(b, `${gd.callsign} ${made ? 'made' : 'heard'} it`); else if (gd.team !== 'civilian') this.manKnows(b, gd, made ? 'made' : 'heard');
    }
  }
  /** four times a second: who sees a breach he did not know; the news passed on */
  private notice() {
    const g = this.g, K = WALLREACT, now = g.time;
    for (const b of this.breaches) {
      if (b.ops < 0) {
        if (!g.player.down && this.sees(b, g.player.char.pos, g.player.char.aimYaw)) this.opsKnow(b, 'the player saw it');
        else for (const gd of g.guards) if (gd.team === 'operative' && gd.state !== 'dead' && now >= gd.dazzledUntil && this.sees(b, gd.char.pos, gd.char.aimYaw)) { this.opsKnow(b, `${gd.callsign} saw it`); if (K.say && gd.unit) g.say(gd, b.walk ? 'hole in the wall.' : 'gap in the wall — watch it.'); break; }
      }
      for (const gd of g.guards) { if (gd.state === 'dead' || gd.team === 'operative' || gd.team === 'civilian' || b.men.has(gd) || now < gd.dazzledUntil) continue; if (this.sees(b, gd.char.pos, gd.char.aimYaw)) this.manKnows(b, gd, 'saw'); }
      for (let i = b.tell.length - 1; i >= 0; i--) { const T = b.tell[i]; if (now < T.at) continue; b.tell.splice(i, 1); if (T.by.state === 'dead') continue;
        for (const gd of g.guards) { if (gd === T.by || gd.state === 'dead' || gd.team !== T.by.team || b.men.has(gd)) continue; if (flat(gd.char.pos, T.by.char.pos) < K.tellM && g.col.sound.propagate(this.head(T.by), this.head(gd)).pathLen < K.tellM) this.manKnows(b, gd, 'told'); } }
    }
  }

  // ================================================================ (b) the squad's book
  private dropOpening(o: Opening) { const L = this.g.cover?.openings; if (!L) return; const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); }
  private dropOpenings() { for (const b of this.breaches) if (b.opening) { this.dropOpening(b.opening); b.opening = null; } }
  /** a breach the team knows is one of its openings: dealt to a free gun like a doorway, counted by the entry points (kept in the list whoever rebuilds it) */
  private book() {
    const g = this.g; if (!g.orders?.active) return;
    let L: Opening[] | null = null;
    for (const b of this.breaches) {
      if (b.ops < 0) continue; L ??= g.cover.ready();
      if (!b.opening) { b.opening = { id: b.key, kind: WALLREACT.entryRisk ? 'door' : 'gap', at: [b.at[0], CHEST, b.at[2]], n: [b.n[0], b.n[1]], half: b.half, door: null, pass: null, far: null }; WALLREACT_STATS.openings++; }
      if (!L.includes(b.opening)) L.push(b.opening);
    }
  }

  // ================================================================ (b) the defenders' watch
  /** ten times a second: what each man who knows a breach has against it */
  private evidence(dt: number) {
    const g = this.g, K = WALLREACT, now = g.time;
    for (const [gd, M] of this.minds) {
      if (gd.state === 'dead') { this.minds.delete(gd); this.watching.delete(gd); continue; }
      const p = gd.char.pos, seen = now - gd.lastSeenT < 0.3 && gd.lastKnown ? gd.lastKnown : null, fire = gd.sup.src && now - gd.sup.srcT < 1.5 ? gd.sup.src : null;
      for (const [b, m] of M) {
        if (!this.breaches.includes(b)) { M.delete(b); continue; }
        m.ev = Math.max(0, m.ev - K.forget * dt);
        if (seen && this.through(b, p, seen)) m.ev = Math.min(3, m.ev + K.evSeen * dt);
        if (fire && this.through(b, p, fire)) m.ev = Math.min(3, m.ev + K.evFire * dt);
      }
    }
  }
  /** does the plan line p → q go through the breach */
  private through(b: Breach, p: Vec3, q: Vec3): boolean {
    const sp = (p[0] - b.at[0]) * b.n[0] + (p[2] - b.at[2]) * b.n[1], sq = (q[0] - b.at[0]) * b.n[0] + (q[2] - b.at[2]) * b.n[1]; if (sp * sq >= 0) return false;
    const t = sp / (sp - sq), x = p[0] + (q[0] - p[0]) * t, z = p[2] + (q[2] - p[2]) * t;
    return Math.abs((x - b.at[0]) * b.u[0] + (z - b.at[2]) * b.u[1]) <= b.half + 0.35;
  }
  /** roomfight.ts applyWatch: `pt` is where his gun and his fix are about to rest (a door of his room, or straight ahead) — a breach he knows, has a line to and
   *  has more against than that door, takes it */
  look(gd: Guard, pt: Vec3) {
    const M = this.minds.get(gd); if (!M || !M.size) return;
    const g = this.g, K = WALLREACT, D = this.defOf(gd); if (!D || D.mode !== 'hold') { this.watching.delete(gd); return; }
    if (g.time < D.glanceUntil) return;   // (his wandering eye is his own)
    const p = gd.char.pos, had = this.watching.get(gd) ?? null; let best: Breach | null = null, bs = (D.watch >= 0 ? D.ev[D.watch] ?? 0 : 0) + 0.05;
    for (const [b, m] of M) {
      if (flat(p, b.at) > K.watchM) continue;
      if (g.time - m.lineT > 0.5 || g.time < m.lineT) { m.lineT = g.time; m.line = !g.col.segmentBlocked([p[0], EYE, p[2]], this.faceOf(b, p)); }
      if (!m.line) continue;
      let mates = 0; for (const [o, w] of this.watching) if (o !== gd && w === b && o.state !== 'dead') mates++;
      const s = m.ev + (b.walk ? K.holeBase : K.portBase) - K.crowd * mates + (b === had ? K.sticky : 0) + (g.time - m.t < K.freshSecs && g.time >= m.t ? K.fresh : 0);   // (a wall that has just come open in front of him is the newest thing in the room, whatever the same bang did at a door)
      if (s > bs) { bs = s; best = b; }
    }
    if (!best) { this.watching.delete(gd); return; }
    if (best !== had) { this.watching.set(gd, best); WALLREACT_STATS.watches++; this.fight.log.push({ t: g.time, who: gd.callsign, what: `watch → the ${best.walk ? 'hole' : 'port'} at (${best.at[0].toFixed(1)}, ${best.at[2].toFixed(1)})` }); }
    pt[0] = best.at[0]; pt[2] = best.at[2];
  }

  // ================================================================ (a) cover gone
  private posts(): { gd: Guard; A: Assignment }[] {
    const g = this.g, out: { gd: Guard; A: Assignment }[] = []; if (!g.orders?.active) return out;
    for (const gd of g.orders.men()) { if (gd.state === 'dead') continue; const A = g.orders.of(gd); if (A && A.post) out.push({ gd, A }); }
    return out;
  }
  private charOf(id: number): { pos: Vec3; team: Team } | null {
    const g = this.g; if (id === PLAYER_ID) return g.player.down ? null : { pos: g.player.char.pos, team: 'player' };
    const m = g.guards.find(x => x.char.id === id); return m && m.state !== 'dead' ? { pos: m.char.pos, team: m.team } : null;
  }
  /** where the trouble is, for this man, about this change: the man he last saw · where the rounds came from · whoever made it (an enemy of his) · the far side
   *  of a hole beside him when nobody he trusts is known to be there */
  private threatFor(gd: Guard, X: Gone, at: Vec3): Vec3 | null {
    const g = this.g;
    // (the man he saw, where the rounds come from, whoever made the hole — the first of them whose line to him goes through what went; a man fighting
    //  somebody down the corridor is still asked about the hole at his elbow)
    const who = this.charOf(X.who), h = gd.team === 'operative' ? 1.2 : 0.9;
    for (const c of [g.time - gd.sightT < 6 ? gd.sightPos : null, gd.sup.src && g.time - gd.sup.srcT < SUPPRESSION.srcMemorySecs ? gd.sup.src : null, who && isHostile(gd.team, who.team) ? who.pos : null])
      if (c && this.openGone(c, at, h, X)) return c;
    return X.b ? this.beyond(gd, X.b, at) : null;
  }
  /** what a question is about, in the order it is asked: the newest thing to go and (WALLREACT.everyGone) each thing that went before it while he was still
   *  owed the answer. The first of them that has something to say to him is the one he acts on — so wherever the newest does, the answer is the newest row's own,
   *  as it always was */
  private things(P: Pend): Gone[] { return WALLREACT.everyGone && P.also ? [P, ...P.also] : [P]; }
  /** the thing this man has to hide from and where the trouble is: the first thing of the question with a threat he is open to, at `h` over `at`, along a line
   *  through that thing — else why not, in the newest thing's words */
  private asks(gd: Guard, P: Pend, at: Vec3, h: number): { X: Gone; threat: Vec3 } | string {
    let why = '';
    for (const X of this.things(P)) { const threat = this.threatFor(gd, X, at);
      if (!threat) { why ||= 'nothing beyond it to hide from'; continue; }
      if (!this.openGone(threat, at, h, X)) { why ||= 'hidden where he is'; continue; }   // (still hidden crouched, or open by some other line than what went)
      return { X, threat }; }
    return why;
  }
  /** the floor just beyond a breach from where a man stands — null when it is no danger to him: no floor there, his own side's men on it, or (the team) a room
   *  their book has cleared */
  private beyond(gd: Guard, b: Breach, at: Vec3): Vec3 | null {
    const g = this.g, K = WALLREACT;
    const s = (at[0] - b.at[0]) * b.n[0] + (at[2] - b.at[2]) * b.n[1] >= 0 ? 1 : -1; let far: Vec3 | null = null;
    for (const d of [K.beyondM, K.beyondM * 0.7, K.beyondM * 0.45]) { const q: Vec3 = [b.at[0] - b.n[0] * s * d, 0, b.at[2] - b.n[1] * s * d]; if (!g.col.nav.isBlocked(q[0], q[2])) { far = q; break; } }   // (a narrow passage beyond it: nearer the hole)
    if (!far) return null;
    const F = far, over = (p: Vec3) => ((p[0] - b.at[0]) * b.n[0] + (p[2] - b.at[2]) * b.n[1]) * s < 0 && flat(p, F) < 2.5;   // (beyond the wall, by that floor)
    if (gd.team === 'operative') { if (g.cleared.roomAt(far) !== 0 && g.cleared.knownAt(far)) return null; if (g.orders.squad().some(m => m !== gd && m.state !== 'dead' && over(m.char.pos)) || (!g.player.down && over(g.player.char.pos))) return null; }   // (his own side's ground beyond it)
    else for (const m of g.guards) if (m !== gd && m.state !== 'dead' && m.team === gd.team && over(m.char.pos)) return null;
    return far;
  }
  /** open to `threat` along a line through what went, a chest at `h` over `at` */
  private openGone(threat: Vec3, at: Vec3, h: number, X: Gone): boolean {
    return segRect(threat, at, X.rect, 0.45) && !this.g.col.segmentBlocked([threat[0], 1.15, threat[2]], [at[0], h, at[2]]);
  }
  /** a couple of strides to somewhere a chest at `h` is hidden from `threat` (and from the face of the breach), walked to in a straight line */
  private stepOut(gd: Guard, from: Vec3, threat: Vec3, h: number, b: Breach | null, taken: Vec3[], loosely = false): Vec3 | null {
    const g = this.g, nav = g.col.nav, K = WALLREACT, T: Vec3 = [threat[0], 1.15, threat[2]], dc = doorCells(g);
    const depth = b ? Math.abs((from[0] - b.at[0]) * b.n[0] + (from[2] - b.at[2]) * b.n[1]) : 0; let best: Vec3 | null = null, bc = Infinity, alt: Vec3 | null = null, ac = Infinity;
    const cands: Vec3[] = [];
    if (b) {   // (beside the hole, against his own side of the wall: the one place nothing beyond it has a line to — nearest end first)
      const s = (from[0] - b.at[0]) * b.n[0] + (from[2] - b.at[2]) * b.n[1] >= 0 ? 1 : -1, l0 = (from[0] - b.at[0]) * b.u[0] + (from[2] - b.at[2]) * b.u[1];
      for (const d of [0.8, Math.max(0.8, Math.min(depth, 1.5))]) for (const out of [0.6, 1.0, 1.5, 2.1, 2.7]) for (const e of l0 >= 0 ? [1, -1] : [-1, 1]) { const l = e * (b.half + out); cands.push([b.at[0] + b.u[0] * l + b.n[0] * s * d, 0, b.at[2] + b.u[1] * l + b.n[1] * s * d]); }
    }
    for (const r of [1.0, 1.5, 2.0, 2.5, 3.0, K.stepM]) for (let a = 0; a < 16; a++) cands.push([from[0] + Math.sin(a * Math.PI / 8) * r, 0, from[2] + Math.cos(a * Math.PI / 8) * r]);
    let plans = 0;   // (path searches a question: suppression.ts's own cover search stops at twelve)
    const dbg = WALLREACT_DEBUG.log, w = (p: Vec3, why: string) => dbg?.(`  step cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): ${why}`);
    for (const p of cands) {
      const r = flat(from, p); if (r > K.stepM + 2) continue;
      if (nav.isBlocked(p[0], p[2]) || dc.has(nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)))) { w(p, 'no floor'); continue; }
      let cost = r; if (b) { const s0 = (from[0] - b.at[0]) * b.n[0] + (from[2] - b.at[2]) * b.n[1], s1 = (p[0] - b.at[0]) * b.n[0] + (p[2] - b.at[2]) * b.n[1]; if (s0 * s1 <= 0) continue; cost += 0.6 * Math.abs(Math.abs(s1) - depth); }   // (his own side of the wall; a stack slides along it)
      if (cost >= bc) continue;
      if (!g.col.segmentBlocked(T, [p[0], h, p[2]])) { w(p, 'open to the threat'); continue; }
      const sh: Vec3 = [p[0] + (from[0] - p[0]) / (r || 1) * Math.min(0.35, r), 0, p[2] + (from[2] - p[2]) / (r || 1) * Math.min(0.35, r)];   // (… and a short stride short of it: a man stops where he stops)
      if (b && (this.openThrough(b, p, h) || this.openThrough(b, sh, h))) { w(p, 'open to the far side of the hole'); continue; }
      const loose = this.known(gd).some(o => o !== b && this.beyond(gd, o, p) && (this.openThrough(o, p, h) || this.openThrough(o, sh, h)));   // (out of one hole's line into the next one's is a poor move: taken only when there is no better, and not twice running)
      if (loose && (!loosely || best || cost >= ac)) { w(p, 'open to the far side of another hole'); continue; }
      if (!nav.walkable(from, p)) { const path = nav.findPath(from, p); let L = 0, q: Vec3 = from; for (const x of path ?? []) { L += flat(q, x); q = x; } if (++plans > 8 || !path?.length || L > 1.5 * r + 1 || flat(q, p) > 0.5) { w(p, 'no short walk'); continue; } }
      if (taken.some(q => flat(q, p) < 0.9)) { w(p, "somebody's"); continue; }
      if (loose) { w(p, `fits but for another hole (cost ${cost.toFixed(2)})`); alt = p; ac = cost; continue; }
      w(p, `fits (cost ${cost.toFixed(2)})`);
      best = p; bc = cost;
    }
    const mv = this.movedT.get(gd);
    return best ?? (!loosely || (mv !== undefined && g.time >= mv && g.time - mv < 20) ? null : alt);
  }
  /** is a chest at `h` over `p` open THROUGH the breach to the floor just beyond it (three points across its width) */
  private openThrough(b: Breach, p: Vec3, h: number): boolean {
    const g = this.g, d = (p[0] - b.at[0]) * b.n[0] + (p[2] - b.at[2]) * b.n[1]; if (Math.abs(d) > 8) return false; const s = d >= 0 ? 1 : -1;
    for (const k of [0, 0.8, -0.8]) { const q: Vec3 = [b.at[0] + b.u[0] * b.half * k - b.n[0] * s * 0.9, 1.15, b.at[2] + b.u[1] * b.half * k - b.n[1] * s * 0.9]; if (this.through(b, q, p) && !g.col.segmentBlocked(q, [p[0], h, p[2]])) return true; }
    return false;
  }
  /** the breaches a man knows of (his side's book for a teammate) */
  private known(gd: Guard): Breach[] { return this.breaches.filter(b => gd.team === 'operative' ? b.ops >= 0 : b.men.has(gd)); }
  /** where a crouching man goes: a hole in a wall — a few strides off its line, hidden from everything beyond it (along his own side of the wall for choice),
   *  else the fight's own cover from the threat; cover shot away — the fight's own cover first */
  private spot(gd: Guard, threat: Vec3, b: Breach | null, others: Vec3[]): Vec3 | null {
    const g = this.g, p = gd.char.pos;
    // (a walking man stops a short stride short of where he was sent: the fight's own cover spot is taken a stride deeper when the floor lets it, and not at
    //  all when the place he would stop is still open)
    const kn = this.known(gd).filter(o => o !== b), T: Vec3 = [threat[0], 1.15, threat[2]], hid = (q: Vec3) => !g.col.nav.isBlocked(q[0], q[2]) && g.col.segmentBlocked(T, [q[0], 0.9, q[2]]) && !kn.some(o => this.beyond(gd, o, q) && this.openThrough(o, q, 0.9));
    const own = (): Vec3 | null => { const c = coverFrom(g, gd, threat); if (!c) return null; const r = flat(p, c) || 1, ux = (c[0] - p[0]) / r, uz = (c[2] - p[2]) / r;
      const deep: Vec3 = [c[0] + ux * 0.35, 0, c[2] + uz * 0.35]; if (hid(deep)) return deep;
      return hid([c[0] - ux * 0.35, 0, c[2] - uz * 0.35]) ? c : null; };
    return (b ? this.stepOut(gd, p, threat, 0.9, b, others) ?? own() : own() ?? this.stepOut(gd, p, threat, 0.9, null, others)) ?? this.runFor(gd, p, threat, others, kn) ?? (b ? this.stepOut(gd, p, threat, 0.9, b, others, true) : null);   // (last: out of this hole's line though in another's — once, not back and forth)
  }
  /** nothing within a few strides: the nearest corner he can run to that hides a crouched chest (a man in the open with his crate gone does not kneel there) */
  private runFor(gd: Guard, from: Vec3, threat: Vec3, taken: Vec3[], kn: Breach[]): Vec3 | null {
    const g = this.g, nav = g.col.nav, K = WALLREACT, T: Vec3 = [threat[0], 1.15, threat[2]], dc = doorCells(g); let best: Vec3 | null = null, bl = Infinity, plans = 0;
    for (let r = 4; r <= K.runM; r += 1) { for (let a = 0; a < 16; a++) {
      const p: Vec3 = [from[0] + Math.sin(a * Math.PI / 8) * r, 0, from[2] + Math.cos(a * Math.PI / 8) * r];
      if (nav.isBlocked(p[0], p[2]) || dc.has(nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)))) continue;
      const w = (why: string) => WALLREACT_DEBUG.log?.(`  run cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): ${why}`);
      if (!g.col.segmentBlocked(T, [p[0], 0.9, p[2]]) || taken.some(q => flat(q, p) < 0.9)) { w('open or taken'); continue; }
      if (flat(p, threat) < flat(from, threat) * 0.6) { w('toward him'); continue; }   // (not toward what he is hiding from)
      if (++plans > 10) return best;
      const path = nav.findPath(from, p); let L = 0, q: Vec3 = from; for (const x of path ?? []) { L += flat(q, x); q = x; }
      if (!path?.length || L > 1.6 * r + 2 || flat(q, p) > 0.5 || L >= bl) { w(`no short way (${path?.length ? L.toFixed(1) : 'none'})`); continue; }
      if (kn.some(o => this.beyond(gd, o, p) && this.openThrough(o, p, 0.9))) { w('open to the far side of a hole'); continue; }
      best = p; bl = L; }
      if (best) break; }   // (the nearest ring that has one)
    return best;
  }
  private reconsider(P: Pend): 'moved' | 'fine' | 'later' {
    const r = this.reconsider1(P); WALLREACT_DEBUG.log?.(`  asked ${P.gd.callsign} at (${P.gd.char.pos[0].toFixed(1)}, ${P.gd.char.pos[2].toFixed(1)}) about ${P.b ? P.b.key : 'cover'}: ${r[1]}`); return r[0];
  }
  private reconsider1(P: Pend): ['moved' | 'fine' | 'later', string] {
    const g = this.g, gd = P.gd; if (gd.state === 'dead') return ['fine', 'dead'];
    if (g.time < gd.dazzledUntil || g.time < (gd.staggerUntil ?? 0) || gd.held) return ['later', 'blind, staggered or held'];
    const mv = this.movedT.get(gd); if (mv !== undefined && g.time >= mv && g.time - mv < WALLREACT.retrySecs) return ['later', 'only just moved'];   // (he has only just been moved: let him get there)
    if (gd.team === 'operative') { const r = gd.unit ? this.opMove(P) : 'fine'; return [r, `his mark: ${r}`]; }
    if (gd.team === 'civilian') return ['fine', 'a civilian'];
    const c = gd.char, Q = this.asks(gd, P, c.pos, 0.9); if (typeof Q === 'string') return ['fine', Q];
    const threat = Q.threat, pb = Q.X.b;
    const others = g.guards.filter(o => o !== gd && o.state !== 'dead').map(o => o.char.pos);
    const D = this.defOf(gd);
    if (D) {
      if (D.mode !== 'hold') { const r = D.mode === 'move' ? 'fine' : this.shift(gd, threat, pb, others); return [r, `mode ${D.mode}: ${r}`]; }   // (already on his way somewhere · a free hunter: the fight AI's own shift)
      if (g.time - gd.lastSeenT < 0.6 && gd.lastKnown && flat(gd.lastKnown, c.pos) < 5) return ['later', 'a man at arm\'s length'];   // (a man at arm's length: he fights)
      let p = this.spot(gd, threat, pb, others);
      if (p && (lastStandMan(g, gd) || squadStaysIn(g, gd) || digInSet(g, gd)) && this.fight.roomAt(p) !== D.room) p = null;   // (a man whose room is his to keep — the last stand, a squad that stays, a man dug in and set — moves inside it or not at all)
      if (!p) { WALLREACT_STATS.noCover++; P.next = g.time + 1.5; return ['later', 'nowhere to go']; }
      D.mode = 'move'; D.moveKind = 'cover'; D.cameBy = null; D.moveT = 0; D.stallAt = v3.copy(c.pos); D.stallT = 0; D.movedAt = g.time; gd.pinned = false; this.watching.delete(gd);
      order(gd, { goal: p, speed: g.tune.guardChase, face: null, strafe: false, aimAt: null, upper: 'aim', stance: 'none', crouch: true });
      const F = this.fight; F.stats.tookCover++; F.log.push({ t: g.time, who: gd.callsign, what: 'his cover is gone: takes cover' });
      WALLREACT_STATS.movedDef++; this.movedT.set(gd, g.time); note(g, `${gd.callsign} (holding) leaves (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)}) for (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`);
      if (WALLREACT.say) g.say(gd, "cover's gone — moving!");
      return ['moved', 'moved'];
    }
    const r = this.shift(gd, threat, pb, others); return [r, `the fight's own: ${r}`];
  }
  /** a man in the fight AI: its own shift to cover (suppression.ts — the alert branch walks him to sup.cover) */
  private shift(gd: Guard, threat: Vec3, b: Breach | null, others: Vec3[]): 'moved' | 'fine' | 'later' {
    const g = this.g, sup = gd.sup;
    if (gd.script || gd.pinned || gd.standoff || !g.tune.suppression) return 'fine';
    if (gd.state !== 'alert') return gd.state === 'search' || gd.state === 'suspicious' ? 'later' : 'fine';
    if (sup.cover) return 'fine';
    const p = this.spot(gd, threat, b, others); if (!p) { WALLREACT_STATS.noCover++; return 'later'; }
    sup.cover = p; sup.displacedAt = g.time; sup.displaces++; sup.pinnedT = 0; sup.downT = 0; sup.latched = false; gd.path = []; gd.pathGoal = null; gd.stallRef = null;
    WALLREACT_STATS.movedAI++; this.movedT.set(gd, g.time); note(g, `${gd.callsign} (fighting) shifts to (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`);
    return 'moved';
  }
  /** a teammate on a mark (or walking to one): the mark is moved out of the line */
  private opMove(P: Pend): 'moved' | 'fine' | 'later' {
    const g = this.g, gd = P.gd, A = g.orders.of(gd); if (!A || !A.post) return 'fine';   // (falling in: his place is Sam's trail)
    if (g.doorTools?.ops.some(op => op.men.includes(gd))) return 'fine';   // (a man of a door order stands where the door tools put him: they keep their own marks and end the order on a man off his — the stack's place is theirs to change)
    if (g.wallCharge?.ops.some(op => op.men.includes(gd))) return 'fine';   // (…and a man of a wall charge's order where that order puts him — its stand-off, the hole's mouth, his point inside: wallcharge.ts keeps those marks, and the hole it is about to make or has just made is theirs)
    if (A.order === WALL_ORDER && A.watch) return 'fine';   // (…and after it: the man that order left holding the hole or a door of the room from his point — his mark, his face and his watch point are one piece, the order's)
    if (A.yieldT >= 0 || g.fight.engaged(gd)) return 'later';
    const Q = this.asks(gd, P, A.post, 1.2); if (typeof Q === 'string') return 'fine';
    const threat = Q.threat;
    const taken: Vec3[] = [g.player.char.pos]; for (const m of g.orders.squad()) { if (m === gd || m.state === 'dead') continue; taken.push(m.char.pos); const B = g.orders.of(m); if (B?.post) taken.push(B.post); }
    const pb = Q.X.b, p = this.stepOut(gd, A.post, threat, 1.2, pb, taken) ?? this.stepOut(gd, A.post, threat, 1.2, pb, taken, true); if (!p) { WALLREACT_STATS.noCover++; return 'later'; }
    note(g, `${gd.callsign} (${A.order}) mark (${A.post[0].toFixed(1)}, ${A.post[2].toFixed(1)}) → (${p[0].toFixed(1)}, ${p[2].toFixed(1)})`);
    A.post = p; A.goal = v3.copy(p); A.via.length = 0; A.arrived = false; A.markT = A.movedT = g.time; A.mark[0] = gd.char.pos[0]; A.mark[2] = gd.char.pos[2];
    WALLREACT_STATS.movedOp++; this.movedT.set(gd, g.time);
    if (WALLREACT.say && flat(gd.char.pos, p) > 0.6) g.say(gd, 'moving off the hole.');
    return 'moved';
  }

  /** tactics.ts: one of a plan's men has learned, since the plan was dealt, of a hole a man fits through — deal it again (once: the new plan is younger) */
  replan(team: Team, since: number, men: Guard[]): boolean {
    for (const b of this.breaches) { if (!b.walk) continue; for (const m of men) { const t = team === 'operative' ? b.ops : b.men.get(m) ?? -1; if (t > since) { WALLREACT_STATS.replans++; return true; } } }
    return false;
  }

  summary(): string {
    const S = WALLREACT_STATS; return `wall react ${this.live ? 'on' : 'off'} · ${this.breaches.length} breaches (${this.breaches.filter(b => b.walk).length} walk-through, team knows ${this.breaches.filter(b => b.ops >= 0).length}) · rows ${S.rows} · rooms joined ${S.merged} · moved: holding ${S.movedDef}, fighting ${S.movedAI}, team ${S.movedOp} (nowhere ${S.noCover}) · watches ${S.watches} · replans ${S.replans}`;
  }
}

const states = new SideMap<Game, WallReact>('wallreact.states');
/** this game's (made on first asking: by then the destruction engine stands) */
export function wallReactOf(g: Game): WallReact { let s = states.get(g); if (!s) states.set(g, s = new WallReact(g)); return s; }
/** game.ts, once a frame before the squad's books and the room fight: a return on its first lines with the switch off or nothing broken */
export function wallReactTick(g: Game) { WALLREACT_TEST.tick?.(g); if (!WALLREACT.on && !states.has(g)) return; wallReactOf(g).tick(); }
/** game.ts resetGuards */
export function wallReactReset(g: Game) { states.get(g)?.reset(); }
/** roomfight.ts applyWatch */
export function wallReactLook(g: Game, gd: Guard, pt: Vec3) { if (!WALLREACT.on) return; const s = states.get(g); if (s && s.breaches.length) s.look(gd, pt); }
/** tactics.ts: is this plan stale by a hole one of its men has learned of since it was dealt */
export function wallReactReplan(g: Game, team: Team, since: number, men: Guard[]): boolean { if (!WALLREACT.on) return false; const s = states.get(g); return !!s && s.breaches.length > 0 && s.replan(team, since, men); }
