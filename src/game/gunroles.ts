// A GUN IS USED FOR WHAT IT IS FOR, AND THE DEFENDERS DRAW FROM THE SAME TABLE (GUNROLES). The maintainer, 10-18: "also should we model more firearms? and
// separate primary and secondary slots?" — the squad's cards got their guns (gunslots.ts); this is the two things that step left undone.
//
// THE DEFENDERS' DEAL (`deal`). Every defender of a room clear, a night breach or a rescue was spawned with the one short carbine. With the switch on a cast
// is dealt from weapons.ts WEAPONS as it is staged (gunDeal, called by nightbreach.ts and rescue.ts once the men stand on their marks), by the game's own die:
//   · ONE BELT-FED GUN (the PKM row) at most, to the man whose post looks down the longest line — if that line is a LANE (`beltLane` metres of clear floor from
//     his mark toward what he watches, in a cast of `beltMin` men or more) or the cast is a BIG one (`beltSquad` men). Neither: nobody has one.
//   · A PISTOL for the men who would carry one: one in `pistolShare`, a quarter of the cast at most (`pistolMax`), of the men whose post watches something
//     within `pistolNear` metres (a door at arm's length, a closet). Never the man on the long line.
//   · THE MAN WITH A HOSTAGE IN HIS HAND IS NOT DEALT (`captor` off): he keeps the gun his scenario gave him. He was dealt a pistol for a day (10-18), and a
//     set hostage room then cost the entering pair 7 of 12 men over six seeds where it had cost none (rescue-probes.ts rescue-set, the page's stand): with a
//     pistol up he had the men stacking on his door in his eye before the boot, and shot them there. What that man carries and does is the rescue's to say;
//     `captor` on is the pistol again, for whoever tunes that room with it.
//   · THE RIFLES: each other man an AKMS (`akms` of them, by the die) or the short carbine he always had.
// A die is drawn for every man whatever he is then given, so one man's gun never moves the next man's. Nobody is harder to put down: every row is `oneShot`.
//
// WHAT A GUN IS FOR (`use`), on both sides. Small differences in rules that already exist — no order, no word, no new thing to manage:
//   · ROOM GUNS (the MP7, the M1014) GO IN FIRST: on a stack their man takes the mark nearer the frame (orders.ts pair), he is the one picked to go first
//     (doortools.ts firstIn) and the men with long guns follow last (enter's turn).
//   · THE MK 12 MAN TAKES THE LONG SHOT AND HANGS BACK: the rear mark of the stack, last through the door, and of the openings the unasked cover deals
//     (cover.ts) the FAR one is his before it is another man's; in a room fight he fires single aimed rounds, not pairs.
//   · THE BELT-FED MAN HOLDS A LANE AND FIRES LONGER STRINGS: as the Mk 12 man on the stack and in the cover's deal (the rear man of a stack is the one who
//     keeps the way behind it: rearwatch.ts), his room-fight trigger is a string of the row's burst length where another man's is a pair — and a DEFENDER
//     with one keeps the post he was dealt: no rally, press, errand or dark-room move takes him off it (lanes.ts laneHolds asks gunKeepsPost).
//   · A MAN WITH ONLY A PISTOL DOES NOT TAKE THE FAR LANE: in the cover's deal the far opening is another man's before it is his (and a defender is only
//     dealt a pistol on a near post — the deal above).
// A man's gun here is his PRIMARY: the long gun on his sling while his sidearm is out, his own while the big slot's shotgun is in his hands.
//
// Off (the module, the frozen stand, `?nogunroles`): every defender carries the short carbine and no rule above reads a gun — the build before, by digest. With
// the switch ON and the squad's cards as issued (four issue carbines) every squad rule above answers as it did before too: nothing differs until a card names
// another gun. `GUNROLES_BREAK=1` (tools/qa/gunroles-check.ts): nobody is dealt anything and every man's gun reads as a plain rifle.
// Habits: the game's own die (simRandom) · nothing read off a camera or a graphics setting · no player named · NO STATE: a man's role is read off the gun he
// carries each time it is asked, so there is nothing to save or restore (the tallies below are for the check).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import type { Vec3 } from '../math/vec';
import { simRandom, hashStr, dieOf, roll } from '../math/dice';
import { SAMESTART } from './samestart';   // (a leaf; read inside the deal only)
import type { Game, Guard } from './game';
import { Firearm, WEAPONS, type WeaponDef, type WeaponId } from './weapons';

export const GUNROLES = {
  on: false,
  /** the defenders' deal (the head comment) */
  deal: true,
  /** the share of a cast's riflemen who carry the AKMS (the rest: the short carbine) */
  akms: 0.5,
  /** the belt-fed gun: a clear line this long (m) from a post is a lane, for a cast of `beltMin` men or more · a cast of this many men is a big one, lane
   *  or none · the furthest a line is measured */
  beltLane: 15, beltMin: 5, beltSquad: 10, lineMax: 40,
  /** a pistol: a post watching something within this (m) · the share of such men who carry one · and of a whole cast at most this share (the man with a
   *  hostage in his hand is not counted) */
  pistolNear: 4, pistolShare: 0.5, pistolMax: 0.25,
  /** the man with a hostage in his hand is dealt a pistol too (the head comment: off, he keeps the gun his scenario gave him) */
  captor: false,
  /** a gun used for what it is for (the head comment): the stack's marks and the turn through the door · the cover's deal · the room fight's strings ·
   *  a belt-fed defender keeping his post */
  use: true, entry: true, lanes: true, strings: true, post: true,
  /** the cover's deal: what a far opening is worth to a long gun over a short one, on that deal's scale (cover.ts: a kept opening's `sticky` is 1.2) */
  laneK: 0.6,
  /** orders.ts pair: what a room gun standing behind a long gun in the stack costs, in metres of walking (a pair kept in one file is worth 1000) */
  fileCost: 400,
};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GUNROLES_BREAK ?? '') === '1'; } catch { return false; } })();
export const GUNROLES_STATS = { dealt: 0, belt: 0, pistol: 0, akms: 0, first: 0, last: 0, filed: 0, posts: 0 };

/** what a man's primary is for. 'rifle': nothing in particular (the carbines, the AKs) — every rule below answers for him as it did before there were roles */
export type GunRole = 'room' | 'reach' | 'belt' | 'pistol' | 'rifle';
/** (plain words: nothing of another game module is read as this loads) */
const ROLE: Partial<Record<WeaponId, GunRole>> = { mp7: 'room', m1014: 'room', mk12: 'reach', mk46: 'belt', pkm: 'belt' };
/** who goes through a door when: 0 first, 2 last */
const RANK: Record<GunRole, number> = { room: 0, rifle: 1, pistol: 1, reach: 2, belt: 2 };
const useOn = (key: 'entry' | 'lanes' | 'strings' | 'post'): boolean => GUNROLES.on && GUNROLES.use && GUNROLES[key] && !BREAK;

/** the row of his PRIMARY: the long gun on its sling while the sidearm is out (gunslots.ts), his own gun while the big slot's shotgun is in his hands (bigkit.ts) */
export function gunPrimary(gd: Guard): WeaponDef { return gd.second?.out ? gd.second.gun.def : gd.slung?.out ? gd.slung.own.def : gd.weapon.def; }
/** what his primary is for ('pistol': he carries a pistol and nothing else) */
export function gunRole(gd: Guard): GunRole { if (BREAK) return 'rifle'; const d = gunPrimary(gd); return d.cls === 'pistol' ? 'pistol' : ROLE[d.id] ?? 'rifle'; }
const rankOf = (gd: Guard): number => RANK[gunRole(gd)];

// ------------------------------------------------------------ the defenders' deal
/** one man of a cast as his scenario stands him: where his mark has him looking, and whether his other hand holds a hostage */
export interface DealMan { gd: Guard; watch: Vec3; hostage?: boolean }
/** the clear floor from his mark toward what he watches, chest high, as far as the level's solids and the leaves as they stand let a round go (m) */
function lineOf(g: Game, p: Vec3, to: Vec3): number {
  const dx = to[0] - p[0], dz = to[2] - p[2], L = Math.hypot(dx, dz); if (L < 0.05) return 0;
  const hit = g.col.raycast([p[0], 1.2, p[2]], [dx / L, 0, dz / L], GUNROLES.lineMax);
  return hit ? hit.t : GUNROLES.lineMax;
}
/** a row of the table into a man's hands (nothing for the row he carries, or one that is switched off) */
export function gunHand(gd: Guard, id: WeaponId) {
  if (gd.weapon.def.id === id || !WEAPONS[id].enabled) return;
  gd.route.weapon = id; gd.weapon = new Firearm(WEAPONS[id]); gd.reloadT = -1; gd.char.muzzleAhead = WEAPONS[id].muzzleAhead;   // (the row is dealt off his route every frame — game.ts — so the route is where it is written)
}
/** A CAST IS DEALT ITS GUNS (nightbreach.ts, rescue.ts: once, with the men on their marks and the floor's doors as the mission opens with them — a line is
 *  measured through the doors that stand open then, not the ones the level file leaves open). Returns what each man was given, for the log and the check — an
 *  empty list with the switch off: nobody is touched and no die is drawn.
 *  THE SAME FLOOR OPENS WITH THE SAME GUNS (samestart.ts): each man's two draws come off his own mark — where he stands and which man of the cast he is — so
 *  a restart, which stands the same men on the same marks, deals the same guns. With that switch off (the frozen stand) one number off the game's die
 *  salts every man's draws: another seed, other guns. */
export function gunDeal(g: Game, men: DealMan[]): { gd: Guard; gun: WeaponId; line: number }[] {
  const K = GUNROLES; if (!K.on || !K.deal || BREAK || !men.length) return [];
  for (const d of g.doors.list) d.place();   // (a leaf the staging has just shut or opened stands where it says: its box is otherwise set on the next frame, and a line would be measured through a door that is shut)
  const salt = SAMESTART.on ? 0 : Math.floor(simRandom() * 0x7fffffff);
  const line = men.map(m => lineOf(g, m.gd.char.pos, m.watch)), draws = men.map((m, i) => { const p = m.gd.char.pos, d = dieOf(hashStr(`${salt}|${i}|${Math.round(p[0] * 10)}|${Math.round(p[2] * 10)}`)); return [roll(d), roll(d)]; });   // (two a man, drawn whatever he is then given)
  // the belt-fed gun: the longest line, if it is a lane or the cast is a big one (a man with a hostage in his hand is not its man)
  let belt = -1; men.forEach((m, i) => { if (!m.hostage && (belt < 0 || line[i] > line[belt] + 1e-6)) belt = i; });
  if (belt >= 0 && !((line[belt] >= K.beltLane && men.length >= K.beltMin) || men.length >= K.beltSquad)) belt = -1;
  // the pistols: of the men on a near post whose die says so, the lowest draws first, a quarter of the cast at most
  const near = men.map((_m, i) => i).filter(i => i !== belt && !men[i].hostage && line[i] < K.pistolNear && draws[i][0] < K.pistolShare).sort((a, b) => draws[a][0] - draws[b][0] || a - b);
  const pistol = new Set(near.slice(0, Math.floor(men.length * K.pistolMax)));
  const out = men.map((m, i) => {
    if (m.hostage && !K.captor) return { gd: m.gd, gun: m.gd.weapon.def.id, line: line[i] };   // (not dealt: the gun his scenario gave him)
    const gun: WeaponId = i === belt ? 'pkm' : m.hostage || pistol.has(i) ? 'guard9mm' : draws[i][1] < K.akms ? 'akms' : 'aks74u';
    gunHand(m.gd, gun); const got = m.gd.weapon.def.id;
    GUNROLES_STATS.dealt++; if (got === 'pkm') GUNROLES_STATS.belt++; else if (got === 'guard9mm') GUNROLES_STATS.pistol++; else if (got === 'akms') GUNROLES_STATS.akms++;
    return { gd: m.gd, gun: got, line: line[i] };
  });
  g.note(`guns ▸ ${out.map(o => `${o.gd.callsign} ${WEAPONS[o.gun].short.replace(/ /g, '-')} (${Math.round(o.line)} m)`).join(' · ')}`);
  return out;
}
/** lanes.ts laneHolds: a defender with the belt-fed gun keeps the post he was dealt — no rally, press, errand or dark-room move takes him off it */
export function gunKeepsPost(gd: Guard): boolean {
  if (!useOn('post') || gd.team !== 'hostile' || gd.state === 'dead' || gunRole(gd) !== 'belt') return false;
  GUNROLES_STATS.posts++; return true;
}

// ------------------------------------------------------------ the squad: the stack, the door, the cover's deal, the room fight's trigger
/** orders.ts pair(): what this dealing of men (by their ranks, below) to stack marks costs for the guns in it — `fileCost` for every man who stands nearer the
 *  frame (`front`) than a man whose gun goes in before his */
export function gunFileCost(r: number[], spots: Vec3[], front: Vec3): number {
  const d = spots.map(s => Math.hypot(s[0] - front[0], s[2] - front[2])); let c = 0;
  for (let a = 0; a < r.length; a++) for (let b = 0; b < r.length; b++) if (r[a] < r[b] && d[a] > d[b] + 0.25) c += GUNROLES.fileCost;
  return c;
}
/** … and the men's ranks for it, asked once a dealing: null with the switch off or for men whose guns are all of one kind (nothing is priced) */
export function gunFileRanks(men: Guard[]): number[] | null {
  if (!useOn('entry') || men.length < 2) return null;
  const r = men.map(rankOf); return r.every(x => x === r[0]) ? null : r;
}
/** doortools.ts firstIn(): of the men who may go first, the ones whose gun is the room's — everybody, where their guns do not differ */
export function gunFirst(men: Guard[]): Guard[] {
  if (!useOn('entry') || men.length < 2) return men;
  const lo = Math.min(...men.map(rankOf)), keep = men.filter(m => rankOf(m) === lo); if (keep.length === men.length) return men;
  GUNROLES_STATS.first++; return keep;
}
/** … and why he went ahead of the lead: his gun goes through a door before the lead's does */
export function gunBefore(first: Guard, lead: Guard): boolean { return useOn('entry') && rankOf(first) < rankOf(lead); }
/** doortools.ts enter(): the turn the men go in by, with the long guns (the Mk 12, a belt-fed gun) put last, in the order they had — the man picked to go
 *  first is never moved, and a turn whose guns do not differ is the turn it was */
export function gunTurn(turn: Guard[], first: Guard): Guard[] {
  if (!useOn('entry') || turn.length < 3) return turn;
  const long = turn.filter(m => m !== first && rankOf(m) === 2); if (!long.length || long.length === turn.filter(m => m !== first).length) return turn;
  const out = [...turn.filter(m => !long.includes(m)), ...long]; if (out.some((m, i) => m !== turn[i])) GUNROLES_STATS.last++;
  return out;
}
/** wallcharge.ts enter(): the men through a blown wall, nearest the hole first as they were — the long guns' men after the others */
export function gunLast(men: Guard[]): Guard[] {
  if (!useOn('entry') || men.length < 2) return men;
  const back = men.filter(m => rankOf(m) === 2); if (!back.length || back.length === men.length) return men;
  GUNROLES_STATS.last++; return [...men.filter(m => rankOf(m) !== 2), ...back];
}
/** roomfight.ts: the gap between a blinded defender's rounds fired where the room was — the staging's own for a gun that fires automatic, the gun's own
 *  rate for one that fires a round a pull (a dealt pistol is not emptied at a carbine's rate) */
export function gunBlindGap(gd: Guard, every: number): number {
  const d = gd.weapon.def; return GUNROLES.on && !BREAK && !d.modes.includes('auto') ? Math.max(every, d.cd) : every;
}
/** cover.ts tick(): what an opening `d` metres off is worth to HIM over another man, for his gun — the far one to a long gun, the near one to a pistol alone
 *  or a room gun (half as much). On the deal's own scale; 0 for a rifle, and with the switch off. */
export function gunLane(gd: Guard, d: number, reach: number): number {
  if (!useOn('lanes')) return 0;
  const r = gunRole(gd), k = Math.min(1, Math.max(0, d / Math.max(reach, 0.1)));
  return r === 'reach' || r === 'belt' ? GUNROLES.laneK * k : r === 'pistol' ? -GUNROLES.laneK * k : r === 'room' ? -0.5 * GUNROLES.laneK * k : 0;
}
/** roomfight.ts tickOp: how many rounds his trigger sends before the beat between strings — the row's own burst (its middle) for a belt-fed gun, 1 for the
 *  Mk 12 (an aimed round, not a pair). 0: the controlled pair, as ever. */
export function gunString(gd: Guard): number {
  if (!useOn('strings') || gd.weapon.def !== gunPrimary(gd)) return 0;   // (with the sidearm or the big slot's shotgun in his hands the trigger is that gun's)
  const r = gunRole(gd), B = gd.weapon.def.burst;
  return r === 'belt' && B ? Math.round((B.min + B.max) / 2) : r === 'reach' ? 1 : 0;
}
/** … the seconds to the next round INSIDE a string (the row's own cyclic rate), and how much wider than his hands the k-th round of it is drawn */
export function gunStringGap(gd: Guard): number { return gd.weapon.def.burst?.interval ?? gd.weapon.def.cd; }
export function gunStringGrow(gd: Guard, k: number): number { const B = gd.weapon.def.burst; return B ? Math.min(B.spreadCap, B.spreadPerRound * k) : 0; }
