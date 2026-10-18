// DROPS IT AND RUNS — THE SECOND SLICE OF THE ENEMY'S MORALE (the maintainer, 10-13: "let's not add surrendering to our mechanics. instead, enemies drop their
// weapons and run" — and, as of morale.ts, "a lot of the value from this comes with good telegraphing": he SAYS it, then he DOES it, with a beat the player can
// act on). Nobody ever puts his hands up.
//   · WHO: a man morale.ts has BROKEN (its rung 2), who is ALONE, who is DRY — that file's bait burst has run his magazine out and he is mid-change, or his gun is
//     empty by its own count — and who has an enemy plainly in his eyes inside `closeM`. Never on dread alone: the player causes it on purpose — bait the burst,
//     step in during the dry window. Never a civilian, an operative or the player; never a choreographed man, a man of the hostage rescue's cast or of the
//     response team (morale.ts's own list, and qrf.ts owns). OR, with rounds still in his gun: a broken GREEN man who SAW HIS LEADER FALL (morale.ts
//     sawLeaderFall) with an enemy plainly in his eyes inside `closeM` — the same shout, the same beat, the same run. `runnerBreak` starts the same sequence directly (a later slice: a broken man whose leader is
//     killed in his view).
//   · SAY, THEN DO: he shouts it — spoken, not on the net — and holds, low, gun down, for `beatSecs`; then the weapon leaves his hand and lies on the floor where
//     he dropped it (combat.ts dropFromHand: the item a dying hand lets go of), and he runs.
//   · UNARMED FROM THEN ON, and FLED (`runnerFled`): his gun's own count is kept at nothing and no magazine change is ever his again, so no fire site has a
//     round of his; guards.ts inHand says his hand is empty, so killGuard has nothing more to drop; he is drawn with empty hands (combat.ts guardProps: the
//     rifleman's sidearm stays on his thigh, never drawn — the pistol man's holster is empty); his light went with the gun. He perceives nothing and fights
//     nobody: guards.ts runs this file's GuardScript every frame from the shout on, the room fight's defender tick yields (`runnerOwns`), and morale.ts's own
//     sequence is let go of (moraleRelease) and kept let go of.
//   · WHERE HE RUNS, at the guards' own chase pace (Game.tune.guardChase) and no faster: to a living armed MATE first — the nearest BY THE FLOOR, inside
//     `mateM` of path — and inside `tellM` of him with a clear line he shouts it and the mates in earshot (`toldM`) are TOLD through the game's own records:
//     roomfight.ts told (what a loud noise out that way does to a man on a post: the entry toward it gains a point of evidence, so his watch turns to it; the
//     post's noise record reads the place, which the squads' ears and the dig-in read) and digin.ts digInOrder (the last stand's order: he starts on his room
//     after `tellBeat`; it runs for a man wherever DIGIN.on or a squad is staged); a mate with no post of the room fight's (the night staff) has the place put
//     in his head at `tellAware`, the floor's own rules from there. Then he KEEPS GOING, out of the building: the nearest floor he can reach that lies outside
//     the structure's rooms under open sky (roomfight.ts outOfBuilding's test, `clearM` clear of the walls), for choice one no enemy has a line to — on a
//     level with no structure, the rim of the walkable map (`edgeM`). With no mate that near he tells nobody and goes straight out. The way is planned round
//     the enemies he knows of (`shyM`) and looked at again every `replanSecs`: an enemy who steps into the `aheadM` in front of him sends him another way (or
//     to the corner). An enemy at arm's length never holds him where he stands: he may always step AWAY. He waits on no door drill, no lane, nobody's
//     manners in a doorway (guards.ts followPath: those three gates pass a fled man) — a leaf that opens toward him he still has to pull.
//   · GONE: out, and no enemy with a line to him for `goneSecs`, a spawned unit is taken out of the world (guards.ts despawnUnit). A man of the level's own
//     roster is never removed (a checkpoint is poured over that roster): he stays low where he got to. With no way out he goes to the reachable corner
//     farthest from every enemy and stays low there, his face to the wall, silent, still fled — and looks again for a way out every `retrySecs`, until
//     `retries` runs at a way that would not let him through (a door that will not open) have come to nothing: then he stays.
//   · COUNTING: a fled man is nobody's living hostile — every ending that counts them asks `runnerFled`, a scenario's "my cast was taken away" test passes
//     over him, his squad counts him out (enemysquads.ts alive); the team's eyes pass over him (roomfight.ts tickOp, guards.ts acquireFoe, the breach's
//     target queue). He is nobody's calm colleague either (Guard.hold + pinned: no chat, no need, no greeting, no errand is his). A grenade he was winding up
//     stays on his belt (frag.ts). The player may shoot him: it is a kill like any other, and nothing here scores or answers it.
// SHOW, NOT TELL: nothing is drawn or written for the player but the man himself. One die (simRandom), no wall clock, no graphics setting; the clocks are seconds
// COUNTED and ride a checkpoint with the rest (runnerSnapshot / Restore).
// The switch is off in the module and on the frozen stand, and acts only with MORALE.on: every seam returns on its first line, no man is met, no die is drawn.
// Type-only game imports but for the functions below, used inside calls only (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard, GuardScript } from './game';
import type { Character } from './character';
import { Vec3, v3 } from '../math/vec';
import { simRandom } from '../math/dice';
import { canSee, canSeeChar, sightGain, sightGainOn, despawnUnit, engagementOf } from './guards';
import { dropFromHand } from './combat';
import { isHostile } from './teams';
import { MORALE, moraleOf, rungOf, moraleRelease, sawLeaderFall } from './morale';
import { digInOrder } from './digin';
import { w } from './words';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?norunner = a broken man stays and changes his magazine, as
 *  he did) and by the shipped stand; the harness's frozen stand leaves it off (TPS_RUNNER=1 turns it on — and it needs TPS_MORALE=1 beside it). Metres:
 *  `closeM` the enemy in his eyes, `tellM` the mate he runs in on, `toldM` the mates who hear it, `shyM` how wide of an enemy his way is planned, `mateM` the
 *  longest way to a mate worth running, `clearM` how far clear of the building's walls counts as out, `edgeM` the rim of a map with no building, `cornerM`
 *  how far the corner may be. Seconds: `beatSecs` shout to drop, `tellBeat` the told men's own beat, `goneSecs` out and unseen, `mateSecs` the most he spends
 *  getting to a mate, `stallSecs` going nowhere before he thinks again, `retrySecs` between a
 *  cornered man's looks for a way out that has come free (`retries` = the runs at a way that would not let him through before he stays where he is for
 *  good), `replanSecs` between his looks at the `aheadM` of his way in front of him for an enemy who has stepped into it. `mateM` is by the FLOOR (the
 *  path's own length). `askCells` / `askWide` = how many outside cells (a metre's grid) are asked for one no enemy has a line to — on the first look, and
 *  on the wider looks of a man who is out with eyes still on him. `tellAware` = the awareness a told man of no post is left at. UNTUNED by eye (nobody
 *  has seen it on a GPU, nobody has played it). */
export const RUNNER = { on: false, closeM: 5, outSecs: 0.8, beatSecs: 0.6, tellM: 4, toldM: 8, tellBeat: 0.8, tellAware: 0.6, shyM: 2, mateM: 20, mateSecs: 10, clearM: 1.5, edgeM: 2, cornerM: 25, goneSecs: 2, stallSecs: 3, retrySecs: 2, retries: 3, replanSecs: 0.5, aheadM: 3, askCells: 60, askWide: 240 };
export const RUNNER_STATS = { said: 0, dropped: 0, toMates: 0, told: 0, out: 0, gone: 0, low: 0 };

/** where a man's run stands: the shout's beat (gun still in his hand) · to a mate · out of the building · low (the corner, or a roster man who got out) · gone */
export type RunPhase = 'say' | 'mates' | 'out' | 'low' | 'gone';
const PHASES: RunPhase[] = ['say', 'mates', 'out', 'low', 'gone'];
/** per man: the phase and its seconds `t`, whether the gun has left his hand (`fled`), where the enemy stood when he broke (`from`: what he tells them), where
 *  he is going, the mate he runs to, how many men he told, seconds out with no enemy's line on him, the stall watch (`at` / `stall`), whether he is out.
 *  `tries` = runs at a way out that would not let him through, `plan` = seconds since he last looked at the way ahead, `face` = where a man low in his
 *  corner looks (the wall: away from the nearest enemy). `drive` = this file's script has him this frame (stamped `driveT`). */
interface Run { phase: RunPhase; t: number; fled: boolean; from: Vec3; goal: Vec3 | null; mate: Guard | null; told: number; unseen: number; at: Vec3; stall: number; isOut: boolean;
  tries: number; plan: number; face: number | null; drive: boolean; driveT: number; script: GuardScript; }
const stateOf = new SideMap<Guard, Run>('runner.stateOf');

/** THE LINES (placeholders in the register of the defenders' own — the writing pass is the maintainer's). done: shouted at the enemy in front of him, the
 *  beat before the gun goes down. mates: shouted to his own as he runs in on them — `he` as the night staff have it (their intruder is one man), `they` a
 *  scenario's defender under the dialogue pass (words.ts). */
type LineKind = 'done' | 'mates';
const LINES: Record<LineKind, { say: string[]; he?: string[]; they?: string[] }> = {
  done: { say: ['no. no, I\'m done. I\'m done!', 'that\'s it — I\'m done! I\'m done!', 'no more! I\'m finished here!'] },
  mates: { say: ['don\'t shoot — it\'s me! it\'s me!'], he: ['don\'t shoot, it\'s me! he\'s right behind me!', 'it\'s me! hold your fire — he\'s coming!'],
    they: ['don\'t shoot, it\'s me! they\'re right behind me!', 'it\'s me! hold your fire — they\'re coming!'] },
};
/** this file's lines — every kind's, or one kind's (the check: a line said came from the right pool; the words lint's bubble length and blocklist) */
export function runnerLines(kind?: LineKind): string[] { return (kind ? [LINES[kind]] : Object.values(LINES)).flatMap(l => [...l.say, ...(l.he ?? []), ...(l.they ?? [])]); }
/** one line of a kind from this man, shouted (never on the net: the player hears it where he stands) */
function bark(g: Game, gd: Guard, kind: LineKind) {
  const L = LINES[kind], pool = [...L.say, ...((gd.team !== 'guard' ? w(L.they, L.he) : L.he) ?? [])];   // (words.ts: 'they' is a scenario's defender under the pass — off, every man's intruder is 'he', as it was)
  g.say(gd, pool[Math.floor(simRandom() * pool.length) % pool.length], false, true);
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const chestOf = (c: Character): Vec3 => c.bones.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
const headOf = (c: Character): Vec3 => c.bones.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
/** a man this file is about at all (morale.ts's own): a living defender or a man of the night staff — never a civilian, an operative, a body */
const ours = (gd: Guard) => gd.state !== 'dead' && !gd.civ && (gd.team === 'hostile' || gd.team === 'guard');
/** nobody's to take: the hostage rescue's cast (rescue.ts) and the response team (qrf.ts) */
const spoken = (g: Game, gd: Guard) => (!!g.rescue?.active && g.rescue.hostiles.includes(gd)) || !!g.qrf?.owns(gd);
/** may the sequence start on him this frame (morale.ts reacts): the AI on, no show on the floor, free of Sam's arm, nobody's choreography but a room fight's walk */
function reacts(g: Game, gd: Guard): boolean {
  if (!g.aiEnabled || g.touring || g.quietUtility || gd.held) return false;
  return !gd.script || !!g.fight?.defs.some(D => D.gd === gd);
}
/** a living armed man of his own side, on the floor and on his feet: somebody to run to, somebody to tell */
const mateOf = (g: Game, gd: Guard, o: Guard) => o !== gd && ours(o) && o.team === gd.team && !o.held && !stateOf.has(o);
/** his enemies on the floor: the player (the one there is, asked as a side) and every living man of a side hostile to his */
function foes(g: Game, gd: Guard): Character[] {
  const out: Character[] = []; if (isHostile(gd.team, 'player') && !g.player.down) out.push(g.player.char);
  for (const o of g.guards) if (o.state !== 'dead' && isHostile(gd.team, o.team)) out.push(o.char);
  return out;
}
/** the nearest enemy plainly in his eyes inside `closeM` — morale.ts's own test and bar (the sight test, the sight-gain line the room fight's walk breaks off
 *  on); nobody for a man with magnesium in his eyes */
function closeFoe(g: Game, gd: Guard): Character | null {
  if (g.time < gd.dazzledUntil) return null;
  let best: Character | null = null, bd: number = RUNNER.closeM; const P = g.player;
  if (isHostile(gd.team, 'player') && !P.down && !g.playerInvisible) { const vis = canSee(g, gd); if (vis.visible && vis.dist <= bd && sightGain(g, gd, vis.dist) > 0.25) { best = P.char; bd = vis.dist; } }
  for (const o of g.guards) { if (o.state === 'dead' || !isHostile(gd.team, o.team)) continue; const vis = canSeeChar(g, gd, o.char, false); if (vis.visible && vis.dist <= bd && sightGainOn(g, gd, o, vis.dist) > 0.25) { best = o.char; bd = vis.dist; } }
  return best;
}
/** IS HE THE MAN: broken, alone, dry — and nobody else's. The enemy in his eyes is asked by the caller (it is the dear half) */
function ripe(g: Game, gd: Guard): boolean {
  if (!ours(gd) || spoken(g, gd) || !reacts(g, gd) || rungOf(gd) !== 2) return false;
  const M = moraleOf(gd); if (!M || !M.alone) return false;
  if (M.act === 'bait') return false;   // (morale.ts is still emptying his magazine: its own shout that he is out comes first)
  if (M.act === 'reload') return M.t >= RUNNER.outSecs;   // (…and has `outSecs` to be heard before this file's shout takes its place: two lines a frame apart were one line lost)
  return gd.weapon.roundsReady === 0;
}
/** …OR THE MAN HIS LEADER'S FALL LEFT (morale.ts): broken, GREEN (the training he broke with), and he SAW his leader go down (sawLeaderFall: seconds since,
 *  Infinity for a man who never did) — rounds in his gun or not, mates about him or not. The enemy in his eyes is the caller's to ask, as above */
function lost(g: Game, gd: Guard): boolean {
  if (!ours(gd) || spoken(g, gd) || !reacts(g, gd) || rungOf(gd) !== 2) return false;
  return !!moraleOf(gd)?.green && Number.isFinite(sawLeaderFall(gd));
}
/** the shout: from here his body is this file's, and morale.ts's sequence is over */
function start(g: Game, gd: Guard, from: Vec3) {
  const c = gd.char;
  stateOf.set(gd, { phase: 'say', t: 0, fled: false, from: [from[0], 0, from[2]], goal: null, mate: null, told: 0, unseen: 0, at: v3.copy(c.pos), stall: 0, isOut: false, tries: 0, plan: 0, face: null, drive: false, driveT: -1, script: { goal: null } });
  moraleRelease(gd); gd.reloadT = -1; c.anim.cancelReload(); gd.weapon.burst = null;   // (the magazine change he was in ends with it: the count and the clip both)
  bark(g, gd, 'done'); RUNNER_STATS.said++;
}
/** A LATER SLICE'S SEAM: start the sequence on this man directly (a broken man whose leader is killed in his view), whatever his magazine holds and whoever
 *  is near. False = the switch is off, he is not a man of this file's, or it already has him */
export function runnerBreak(g: Game, gd: Guard): boolean {
  if (!RUNNER.on || !MORALE.on || !ours(gd) || spoken(g, gd) || !reacts(g, gd) || stateOf.has(gd)) return false;
  let from: Vec3 = gd.lastKnown ?? gd.char.pos, bd = Infinity;
  for (const e of foes(g, gd)) { const d = flat(e.pos, gd.char.pos); if (d < bd) { bd = d; from = e.pos; } }
  start(g, gd, from); return true;
}

/** the rectangle round every room of the level's structure [x0, x1, z0, z1], worked out once a level (null = the level has no structure) */
const rects = new SideMap<object, [number, number, number, number]>('runner.rects');
function rectOf(g: Game): [number, number, number, number] | null {
  const rooms = g.level.scenarios?.roomClear?.rooms; if (!rooms?.length) return null;
  let R = rects.get(rooms);
  if (!R) { R = [Infinity, -Infinity, Infinity, -Infinity]; for (const r of rooms) { R[0] = Math.min(R[0], r.bounds.x0); R[1] = Math.max(R[1], r.bounds.x1); R[2] = Math.min(R[2], r.bounds.z0); R[3] = Math.max(R[3], r.bounds.z1); } rects.set(rooms, R); }
  return R;
}
/** OUT OF THE BUILDING: roomfight.ts outOfBuilding's own test — outside the rectangle round every room of the level's structure, open sky over it — taken
 *  `clearM` clear of that rectangle; a level with no structure has no building to be outside of, and its 'out' is the rim of the walkable map */
function outside(g: Game, p: Vec3): boolean {
  const K = RUNNER, R = rectOf(g), nav = g.col.nav;
  if (!R) return Math.min(p[0], p[2], nav.W * nav.cell - p[0], nav.H * nav.cell - p[2]) <= K.edgeM;
  if (p[0] >= R[0] - K.clearM && p[0] <= R[1] + K.clearM && p[2] >= R[2] - K.clearM && p[2] <= R[3] + K.clearM) return false;
  let roofed = 0; for (const [dx, dz] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) if (g.col.solidBlocked([p[0] + dx, 1.9, p[2] + dz], [p[0] + dx, 9, p[2] + dz], 0.02)) roofed++;
  return roofed < 3;
}
const lineTo = (g: Game, e: Character, p: Vec3) => !g.col.segmentBlocked(headOf(e), [p[0], p[1] + 1.2, p[2]]);
/** THE FLOOR HE CAN REACH, flooded once from where he stands over the nav bake's free cells, never INTO a cell inside `shyM` of an enemy that is no farther
 *  from him than the cell it is entered from (a man with an enemy at arm's length may always step AWAY: he is never held at somebody's feet): `out` = the
 *  nearest of it that is outside — for choice the nearest no enemy has a line to (`ask` of them asked, on a metre's grid; `hidden` = one was found) — and `corner` = the cell with two walls about it,
 *  inside `cornerM` of him by the floor, farthest from every enemy (his own cell if there is none) */
function flood(g: Game, gd: Guard, E: Character[], ask: number = RUNNER.askCells): { out: Vec3 | null; hidden: boolean; corner: Vec3 } {
  const K = RUNNER, nav = g.col.nav, cs = nav.cell, W = nav.W, H = nav.H, from = nav.nearestFreePoint(gd.char.pos[0], gd.char.pos[2]) ?? gd.char.pos;
  const depth = new Int32Array(W * H).fill(-1), queue = new Int32Array(W * H); let head = 0, tail = 0;
  const near = (p: Vec3) => { let d = Infinity; for (const e of E) d = Math.min(d, flat(e.pos, p)); return d; };
  const s = nav.idx(Math.min(W - 1, Math.max(0, Math.floor(from[0] / cs))), Math.min(H - 1, Math.max(0, Math.floor(from[2] / cs)))); depth[s] = 0; queue[tail++] = s;
  let out: Vec3 | null = null, seenOut: Vec3 | null = null, asked = 0, corner: Vec3 = v3.copy(gd.char.pos), cd = -Infinity; const far = Math.round(K.cornerM / cs);
  while (head < tail && !out) {
    const i = queue[head++], x = i % W, z = (i - x) / W, p: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs];
    if (outside(g, p)) { seenOut ??= p; if (!(x & 1) && !(z & 1)) { if (asked++ >= ask) break; if (!E.some(e => lineTo(g, e, p))) { out = p; break; } } }   // (every other cell each way: a metre's grid of them is asked for a line)
    let walls = 0; const dp = near(p);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) { walls++; continue; }
      const j = nav.idx(nx, nz); if (nav.blocked[j]) { walls++; continue; }
      if (depth[j] >= 0) continue;
      const dn = near([(nx + 0.5) * cs, 0, (nz + 0.5) * cs]); if (dn < K.shyM && dn <= dp) continue;
      depth[j] = depth[i] + 1; queue[tail++] = j;
    }
    if (walls >= 2 && depth[i] <= far) { const d = near(p); if (d > cd) { cd = d; corner = p; } }
  }
  return { out: out ?? seenOut, hidden: !!out, corner };
}
/** his way to `goal`, planned as guards.ts goTo plans one (the search, the doors threaded) with every cell inside `shyM` of an enemy made dear — and kept by
 *  goTo for as long as the goal stands */
function route(g: Game, gd: Guard, S: Run, goal: Vec3, E: Character[]): boolean {
  const K = RUNNER, nav = g.col.nav, cs = nav.cell, c = gd.char;
  const pen = E.length ? (ix: number, iz: number) => { const x = (ix + 0.5) * cs, z = (iz + 0.5) * cs; for (const e of E) if (Math.hypot(e.pos[0] - x, e.pos[2] - z) < K.shyM) return 20; return 1; } : undefined;
  const p = nav.findPath(c.pos, goal, 12000, pen);
  S.goal = v3.copy(goal); S.script.arrived = false; S.at = v3.copy(c.pos); S.stall = 0;
  gd.path = g.doors.threadPath(p ?? [], c.pos, (x, z) => !nav.isBlocked(x, z)); gd.pathI = 0; gd.pathGoal = v3.copy(goal); gd.repathT = 0; gd.lineSide = 0;
  return !!p?.length;
}
const pathLen = (from: Vec3, path: Vec3[]) => { let L = 0, a = from; for (const b of path) { L += flat(a, b); a = b; } return L; };
/** the mate he runs to: the nearest BY THE FLOOR — the path's own length, inside `mateM` — of the four nearest by air (a man farther than that by air is
 *  farther by the floor). Nobody that near: null, and he tells nobody — he just runs */
function pickMate(g: Game, gd: Guard): Guard | null {
  const c = gd.char, nav = g.col.nav; let best: Guard | null = null, bl: number = RUNNER.mateM;
  const men = g.guards.filter(o => mateOf(g, gd, o) && flat(o.char.pos, c.pos) <= RUNNER.mateM).sort((a, b) => flat(a.char.pos, c.pos) - flat(b.char.pos, c.pos)).slice(0, 4);
  for (const o of men) { if (flat(o.char.pos, c.pos) >= bl) break; const p = nav.findPath(c.pos, o.char.pos); if (!p?.length) continue; const L = pathLen(c.pos, p); if (L <= bl && (!best || L < bl)) { best = o; bl = L; } }
  return best;
}
/** is there an enemy in the `aheadM` of his way in front of him — inside `shyM` of it, and nearer to it than to him (the man he is running FROM is behind
 *  him, and is no reason to think again) */
function wayBarred(gd: Guard, S: Run, E: Character[]): boolean {
  const K = RUNNER, c = gd.char; if (!E.length) return false;
  let a: Vec3 = c.pos, left: number = K.aheadM;
  for (let i = gd.pathI; i < gd.path.length && left > 0; i++) {
    const b = gd.path[i], L = flat(a, b); if (L < 1e-4) continue;
    const use = Math.min(L, left), ux = (b[0] - a[0]) / L, uz = (b[2] - a[2]) / L;
    for (const e of E) { const t = Math.min(use, Math.max(0, (e.pos[0] - a[0]) * ux + (e.pos[2] - a[2]) * uz)), d = Math.hypot(e.pos[0] - a[0] - ux * t, e.pos[2] - a[2] - uz * t);
      if (d < K.shyM && d < flat(e.pos, c.pos) - 0.25) return true; }
    left -= L; a = b;
  }
  return false;
}
/** THE DROP: the weapon out of his hand onto the floor, his gun's count to nothing, his light with it; a calm man on the books from here (no fix, no foe, no
 *  awareness — he is nobody's threat and no alarm's reason); and off he goes — to a mate if he has one, else out */
function drop(g: Game, gd: Guard, S: Run) {
  const c = gd.char, W = gd.weapon.def;
  gd.dropped = dropFromHand(g, c, W.drop, c.gunDir, [0, 0, 0], W.suppressed);
  S.fled = true; RUNNER_STATS.dropped++;
  gd.state = 'patrol'; gd.awareness = 0; gd.foe = null; gd.aim.clear(); gd.pieing = null; gd.searchPlan = null; gd.standoff = null; gd.muzzleDown = false;
  gd.hold = true; gd.pinned = true;   // (…and nobody's calm colleague: every reader that asks for a free man on his round — a chat, a need, a greeting, an errand — passes over a held one)
  const E = foes(g, gd), m = pickMate(g, gd);
  if (m) { S.phase = 'mates'; S.t = 0; S.mate = m; route(g, gd, S, m.char.pos, E); RUNNER_STATS.toMates++; } else toOut(g, gd, S, E);
}
/** out of the building by the nearest floor that is outside; no such floor he can reach: the corner */
function toOut(g: Game, gd: Guard, S: Run, E: Character[]) {
  const F = flood(g, gd, E); S.mate = null; S.t = 0;
  if (F.out && route(g, gd, S, F.out, E)) { S.phase = 'out'; RUNNER_STATS.out++; } else toLow(g, gd, S, F.corner, E);
}
function toLow(g: Game, gd: Guard, S: Run, at: Vec3, E: Character[]) { S.phase = 'low'; S.t = 0; S.mate = null; route(g, gd, S, at, E); RUNNER_STATS.low++; }
/** THE MATES ARE TOLD where the team is (`from`: where the enemy stood when he broke): every mate inside `toldM` of him. A man on a post of the room fight's
 *  is told as a loud noise out that way tells him (roomfight.ts told: the entry toward it is the one he fears and turns to, its noise record reads the
 *  place — what the squads' ears and the dig-in read) and is ordered to dig in (digin.ts digInOrder); a man with no such post has the place put in his
 *  head, the floor's own rules from there */
function tell(g: Game, gd: Guard, S: Run) {
  const K = RUNNER;
  for (const o of g.guards) {
    if (!mateOf(g, gd, o) || flat(o.char.pos, gd.char.pos) > K.toldM) continue;
    const D = g.fight?.defs.find(X => X.gd === o);
    if (D && g.fight!.told(o, S.from)) digInOrder(g, D, S.from, K.tellBeat);
    else { o.lastKnown = v3.copy(S.from); o.awareness = Math.max(o.awareness, K.tellAware); }
    S.told++; RUNNER_STATS.told++;
  }
}

/** what this file's script holds him to this frame: the beat — where he is, low, gun down, facing what broke him; the run — his goal at the guards' chase
 *  pace, nothing in his hands, no light; there — in his corner, or out with an enemy's line still on him — low */
function pose(g: Game, gd: Guard, S: Run) {
  const s = S.script, say = S.phase === 'say', there = !!s.arrived && S.phase === 'low';
  s.goal = say ? null : S.goal; s.speed = g.tune.guardChase; s.strafe = false; s.face = say ? v3.yawTo(gd.char.pos, S.from) : there ? S.face : null;   // (low and there: his face to the wall — never his hands up, never a word)
  s.aimAt = null; s.upper = 'none'; s.stance = say ? 'lowReady' : 'none'; s.crouch = say || (!!s.arrived && (S.phase === 'low' || (S.phase === 'out' && S.unseen === 0))); s.over = null;
  if (S.fled) s.light = false;
}

/** ONCE A FRAME, right after morale.ts's tick (game.ts update) and before anybody moves: the men who are ripe are asked for the enemy in their eyes, and
 *  every man in a run is taken a step through it. A return on its first line with the switch off. */
export function runnerTick(g: Game, dt: number) {
  if (!RUNNER.on) return;
  for (let i = g.guards.length - 1; i >= 0; i--) {   // (backwards: a man gone leaves the list under it)
    const gd = g.guards[i], S = stateOf.get(gd);
    if (S) { S.drive = false; if (gd.state !== 'dead') step(g, gd, S, dt); continue; }
    if (!MORALE.on || !(ripe(g, gd) || lost(g, gd))) continue;   // (dry and alone — or green with his leader's fall in his eyes: the same shout, the same beat, the same run)
    const e = closeFoe(g, gd); if (e) start(g, gd, e.pos);
  }
}
/** one frame of a man's run */
function step(g: Game, gd: Guard, S: Run, dt: number) {
  const K = RUNNER, c = gd.char;
  moraleRelease(gd); if (gd.reloadT >= 0) { gd.reloadT = -1; c.anim.cancelReload(); }   // (a blast since may have begun morale.ts's sequence on him again: it is let go of before it has said or fired anything)
  if (S.phase === 'say') {
    if (!reacts(g, gd)) { stateOf.delete(gd); return; }   // (Sam's arm, a show — before the gun left his hand: nothing has happened)
    S.t += dt; if (S.t < K.beatSecs) { drive(g, gd, S); return; }
    drop(g, gd, S);
  }
  const W = gd.weapon; W.chamber = 0; W.mag = 0; W.burst = null;   // the gun is on the floor: there is no round of his for any fire site to send
  gd.hold = true; gd.pinned = true;   // (a checkpoint, a drill's reset: he is still nobody's free man)
  if (gd.state !== 'patrol') gd.state = 'patrol'; gd.awareness = 0; gd.foe = null;   // (…and nobody's alarm: a shout, a shot, a mate's word since the drop put nothing on his books)
  if (gd.held) return;
  const E = foes(g, gd); S.t += dt;
  const moving = !S.script.arrived && !!S.goal;
  if (moving && flat(c.pos, S.at) < 0.5) S.stall += dt; else { S.stall = 0; S.at = v3.copy(c.pos); }
  const stuck = S.stall >= K.stallSecs;
  // the way ahead, looked at every `replanSecs`: an enemy has stepped into it since it was planned
  S.plan += dt; let barred = false; if (S.plan >= K.replanSecs) { S.plan = 0; barred = moving && wayBarred(gd, S, E); }
  if (S.phase === 'mates') {
    const m = S.mate;
    if (!m || !mateOf(g, gd, m) || !g.guards.includes(m) || stuck || S.t > K.mateSecs) toOut(g, gd, S, E);
    else if (flat(c.pos, m.char.pos) <= K.tellM && !g.col.segmentBlocked(headOf(c), chestOf(m.char))) { bark(g, gd, 'mates'); tell(g, gd, S); toOut(g, gd, S, E); }
    else if (barred) toOut(g, gd, S, E);   // (the enemy is between him and his own: he tells nobody)
    else if (flat(m.char.pos, S.goal!) > 1.5) route(g, gd, S, m.char.pos, E);
  } else if (S.phase === 'out') {
    S.isOut = outside(g, c.pos);
    if (S.isOut) { S.unseen = E.some(e => lineTo(g, e, c.pos)) ? 0 : S.unseen + dt; if (S.unseen >= K.goneSecs) { gone(g, gd, S); return; }
      // out, there, and an enemy's eyes still on him: every `retrySecs` he looks wider for floor nobody has a line to, and goes on to it
      if (S.unseen === 0 && S.script.arrived && S.t >= K.retrySecs) { S.t = 0; const F = flood(g, gd, E, K.askWide); if (F.hidden && F.out && flat(F.out, c.pos) > 1) route(g, gd, S, F.out, E); } }
    else if (stuck || S.script.arrived) { S.tries++; toLow(g, gd, S, flood(g, gd, E).corner, E); }   // (a way that would not let him through — a door that will not open: one try spent)
    else if (barred) { const F = flood(g, gd, E); if (!(F.out && route(g, gd, S, F.out, E))) toLow(g, gd, S, F.corner, E); }   // (another way out, or the corner — and no try spent: the man in the way may walk on)
  } else if (!S.isOut) {   // low, in his corner or on his way to it
    if (S.script.arrived && S.face === null) { let n: Character | null = null, nd = Infinity; for (const e of E) { const d = flat(e.pos, c.pos); if (d < nd) { nd = d; n = e; } } S.face = n ? v3.yawTo(n.pos, c.pos) : c.bodyYaw; }
    if (barred) { S.t = 0; const F = flood(g, gd, E); if (flat(F.corner, S.goal ?? c.pos) > 1) { route(g, gd, S, F.corner, E); S.face = null; } }
    else if (stuck) route(g, gd, S, c.pos, E);   // (a corner he cannot get to: he stays low where he has got to)
    else if (S.t >= K.retrySecs && S.tries < K.retries) {   // the way out may have come free (the man in the doorway has walked on in) — until `retries` runs at it have come to nothing: then he stays
      S.t = 0; const F = flood(g, gd, E);
      if (F.out && route(g, gd, S, F.out, E)) { S.phase = 'out'; S.face = null; RUNNER_STATS.out++; } else if (flat(F.corner, S.goal ?? c.pos) > 3) { route(g, gd, S, F.corner, E); S.face = null; }
    }
  }
  drive(g, gd, S);
}
/** out and unseen: a spawned unit leaves the world; a man of the level's own roster stays low where he is (the roster is the level's: savestate.ts) */
function gone(g: Game, gd: Guard, S: Run) {
  RUNNER_STATS.gone++;
  const E = engagementOf(g), drilled = !!E && !E.done && E.hostiles.includes(gd);   // (a drill's exchange ends 'reset' on a man taken out from under it: he stays, low)
  if (!drilled && despawnUnit(g, gd)) { S.phase = 'gone'; S.drive = false; return; }
  S.phase = 'low'; S.isOut = true; S.goal = v3.copy(gd.char.pos); S.script.arrived = true; drive(g, gd, S);
}
function drive(g: Game, gd: Guard, S: Run) { pose(g, gd, S); S.drive = true; S.driveT = g.time; }

/** THE BODY'S SEAM (guards.ts updateGuard, beside morale.ts's): the script his body follows this frame, null = he is not this file's. The caller runs it
 *  through squad.ts runGuardScript for this frame only, before any sense or trigger of his own is asked */
export function runnerScript(g: Game, gd: Guard): GuardScript | null {
  if (!RUNNER.on) return null;
  const S = stateOf.get(gd); if (!S || !S.drive || S.driveT !== g.time) return null;
  return S.script;
}
/** has a run of this file's got him, from the shout on (the other drivers yield: roomfight.ts tickDef) */
export function runnerOwns(gd: Guard): boolean { return RUNNER.on && stateOf.has(gd); }
/** HAS THE WEAPON LEFT HIS HAND: unarmed, out of the fight and nobody's living hostile from that frame on — running, low in a corner, gone or since shot */
export function runnerFled(gd: Guard): boolean { return RUNNER.on && !!stateOf.get(gd)?.fled; }
/** QA: what the rule has of a man (null = never taken) */
export function runnerOf(gd: Guard): Readonly<Omit<Run, 'script'>> | null { return stateOf.get(gd) ?? null; }
/** 'runner ▸ Tango 2 out (told 2) · Tango 5 say' — every man it has on the floor; '' with the switch off */
export function runnerSummary(g: Game): string {
  if (!RUNNER.on) return '';
  const men = g.guards.filter(gd => stateOf.has(gd)).map(gd => { const S = stateOf.get(gd)!; return `${gd.callsign} ${gd.state === 'dead' ? 'shot' : S.phase}${S.told ? ` (told ${S.told})` : ''}`; });
  return 'runner ▸ ' + (men.join(' · ') || 'nobody has run') + (RUNNER_STATS.gone ? ` · ${RUNNER_STATS.gone} gone` : '');
}

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each roster man's run by roster index (a spawned unit is never in a checkpoint)
export interface RunnerSnap { men: (number[] | null)[] }
/** nothing (no key in the file) with the switch off or before anybody has run */
export function runnerSnapshot(g: Game): RunnerSnap | undefined {
  if (!RUNNER.on) return undefined;
  const men = g.guards.map(gd => { const S = stateOf.get(gd); return S ? [PHASES.indexOf(S.phase), S.t, S.fled ? 1 : 0, S.told, S.unseen, S.isOut ? 1 : 0, S.mate ? g.guards.indexOf(S.mate) : -1, S.from[0], S.from[1], S.from[2], ...(S.goal ?? [NaN, NaN, NaN]), S.tries] : null; });
  return men.some(m => m) ? { men } : undefined;
}
/** …onto the fresh roster (a file without the slice: nobody has run). A man mid-run thinks again from where he stands on his first frame */
export function runnerRestore(g: Game, s: RunnerSnap | null | undefined) {
  const f = (x: unknown, d = 0) => typeof x === 'number' && Number.isFinite(x) ? x : d;
  g.guards.forEach((gd, i) => { const M = s?.men?.[i];
    if (!M) { stateOf.delete(gd); return; }
    const goal: Vec3 | null = Number.isFinite(M[10]) ? [M[10], f(M[11]), f(M[12])] : null;
    stateOf.set(gd, { phase: PHASES[f(M[0])] ?? 'low', t: Math.max(0, f(M[1])), fled: !!M[2], from: [f(M[7]), f(M[8]), f(M[9])], goal, mate: g.guards[f(M[6], -1)] ?? null, told: f(M[3]), unseen: Math.max(0, f(M[4])), at: v3.copy(gd.char.pos), stall: 0, isOut: !!M[5],
      tries: Math.max(0, f(M[13])), plan: 0, face: null, drive: false, driveT: -1, script: { goal: null } }); });
}
