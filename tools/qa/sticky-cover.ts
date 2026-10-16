// HOW MUCH OF THE GUARDS A QUIET MISSION SHOWS, THREE WAYS — numbers for the sticky cameras' page (src/game/stickycam.ts). A measuring tool: nothing of the game is edited.
//   bun run tools/qa/sticky-cover.ts --tape <replay.json[.gz]> [--out results.json] [--label name]      an F7 replay re-run off its run tape (tools/qa/rerun.ts)
//   bun run tools/qa/sticky-cover.ts --ghost <level.json> [--seeds 1-3] [--jobs 3] [--cap 420] [--out results.json]   solo-night.ts's scripted ghost on the level's quiet mission
//   both: [--live N|all] [--fov deg]   how many stuck cameras are eyes at once (default stickycam.ts STICKY.live; all = every one, as the tool first measured) and the
//   lens (default STICKY.fovDeg as the run left it: a tape's own). ONE LIVE FEED = a camera shows only until the next one is up, each taken to go up the second he first can.
// THE THREE WAYS: (1) ALL SHOWN = every guard always drawn · (2) FOG OF WAR = a guard is drawn only while the player's own eye has a line to him — 'all round'
// (360°) and 'cone' (FOG.coneDeg about his gaze + FOG.coneNearM all round) · (3) FOG + STICKY CAMERAS = (2) or a stuck camera has a line to him.
// THE LINE is fogofwar.ts lineToMan's, written out (it is private there): inside the eye's field in plan, and col.segmentBlocked clear to his chest bone or, behind a
// blocked chest, to his head bone — statics and door leaves where they stand, glass passed. The player's eye = his head bone (cone: gazeOf). A camera's eye is
// stickycam.ts stickyEyes' own: lens = camLens (pos + n · STICKY.off), look = the wall's normal in plan, field STICKY.fovDeg, no near field.
// SAMPLED at 4 Hz of game time, per guard hostile to the player, alive and not down: `shown` under each way, and NEAR-HIDDEN = within NEAR_M (12 m, plan) of the
// player with no line from him (the samples a camera can matter in). CAMERAS: candidates = wall points he could have shot one at — once a second along his path,
// 24 level rays from STICKY.aimY out to 30 m (col.raycast; statics only, |n.y| < 0.3), each usable from that second + 1, de-duplicated on a 1 m grid PER FACING
// (the two faces of one thin wall are two places), the earliest kept. Two placements, k = 2 and 3:
//   BEST   greedy by the near-hidden samples the placement shows with one more camera in it, each from its own second and only while its feed is live —
//          an upper bound: a player who knows the patrols
//   NAIVE  no knowledge of the patrols: the candidates that see the most floor (1 m lattice of free nav cells at chest height inside the wedge, ≤ 25 m, doors as
//          they stood when the point was first reachable), at least 6 m apart
// WHAT IT IS NOT: no smoke on a line (the fog's second step), no light (a fog eye has none), no flight (a camera is taken to stick where a level ray from his head
// height lands: the real one flies an arc and can drop), no fog-eye budget (FOG_EYES), no choosing WHEN to put a camera up (each goes up the second he first can), no noise of the tube, nobody reacting to it. The fog's memory (a last-seen mark) is not 'shown'.
// THE GHOST IS UNSEEN AND UNHURT, NOT UNHEARD. g.playerInvisible mutes his sight and his FOOTFALLS only (guards.ts hearingCheck: the 'step' branch alone asks it).
// He walks upright by the shortest way and PICKS every lock on it — KICKS the leaf where there is no lock to pick (a keypad door) — and a pick's ticks, the bolt's
// snap and above all a kick (heard like a shot) are door events every guard in earshot hears: men leave their patrols for them and walk to the door he is at.
// So a man met while he is roused (Guard.state other than 'patrol' — 'suspicious' | 'search' | 'alert' — at the meeting or at any sample of the --warn s before it)
// is NOT COUNTED as a meeting or a surprise: it is the ghost's own noise that brought him, not the fog that hid him. Such meetings are their own number ("met while
// roused by the ghost's own noise: n, not counted"). --loud = the count as the tool first made it, roused men and all (both counts are in the JSON either way: an
// arm's `calm` and `loud`). A --tape is a person's run, whose guards are roused by what he did: it is counted --loud unless --calm is given. Breadth, not a person's run.
//
// HOW FAIR THE FOG IS, PER AID (the ARMS; printed under every run, and as one table by --all-quiet): every arm is read off the SAME walk, so they compare.
//   bun run tools/qa/sticky-cover.ts --all-quiet [--seeds 1-3] [--jobs 3] [--cap 420] [--out results.json] [--md table.md]     every quiet mission level in turn
//   --deal seed|die: the mission's deal pinned to the run's seed (?quiet=<seed>; --all-quiet's default) or off the Game's die (a plain --ghost, as it was: every seed is then ONE deal)
//   --listed: THE MISSION AS THE LIST'S OWN ROW OPENS IT — no pin (scenarios.ts scenarioQuery writes a bare `quiet` for a row with no seed, and no QUIET_MISSIONS row
//             has one), which on the shipped stand, where SAMESTART.on is up (host/profile.ts pageSwitches), is quiet.ts dealOne's start 1 / spot 1 / patrol 1 on
//             every load. One run a level (it is one deal). A PINNED DEAL (--deal seed) IS A VARIANT A PLAYER REACHES ONLY BY A URL PIN. The rows built for two are
//             still walked alone (the row's own `squad=1` is left off).
//   --meetings: one line per meeting, counted or dropped (time, guard, where both stood, distance, his state, seconds shown before per arm, the verdict), then the
//             ghost's door verbs and every guard's changes of state: what a number is made of. --loud / --calm: see the top.
//   flags: --meet 8 (m) --warn 4 (s) --seen 0.5 (s) · --carry 2 · --live 1 · --shoot 15 (m) · --legmax 0 (s; 0 = rooms only) · --wandsecs (WAND.feedSecs) · --wandfov (WAND.fovDeg) · --marksecs (WAND.markSecs)
//   per arm: SHOWN share of guard-samples · NEAR-HIDDEN guard-seconds left (≤ 12 m, drawn by no eye of the arm) · MEETINGS · SURPRISES
//   A MEETING = a guard's first sample within --meet m of the player WITH the player's own line to him (the fog's line test). It is a SURPRISE when in the --warn s
//   before it the arm's eyes had shown him for less than --seen s in total: the first the player knows of him is at close range. (A meeting in the run's first --seen s
//   is not counted: nothing could have warned of it.) EPISODES are the same counted every time a guard comes back inside --meet with a line after --warn s away.
//   fog               his own eye, all round
//   camsK-fixed       K (= --carry) cameras placed once, ONE live feed (the newest sends): BEST / NAIVE as above, with live = 1 whatever --live says
//   camsK-take        take-back (STICKY.take), MODELLED: the walk is cut into LEGS where the player's room changes (cleared.ts roomAt: nav cells joined without crossing
//                     a doorway, open floor being one more place; a stay under 2 s is no leg; no rooms on the level = 20 s legs; --legmax cuts a long leg). Each leg's placement is chosen afresh, BEST
//                     (greedy by the leg's near-hidden samples shown), NAIVE (most floor seen, 6 m apart) and AHEAD (most floor seen WITHIN --meet m OF HIS OWN WAY
//                     over the leg and the 10 s after it, 6 m apart: a player who knows where he is going and nothing of the patrols), from the wall places he had a line to (from STICKY.aimY
//                     over his feet to the lens, the wall's face toward him) within --shoot m at some second of the PREVIOUS or the current leg. A camera is up from
//                     the leg's start or 1 s after he first could shoot it there, whichever is later, and off its wall at the leg's end — or LEFT WHERE IT IS for the next leg (a
//                     camera out in the last leg is one of this leg's choices, older than any sent now; 'cameras sent' counts sends, not ones left); at most --carry out, the newest
//                     --live sending. THE WALK TO TAKE ONE OFF ITS WALL IS FREE HERE (the ghost never leaves his way) — an upper bound on what taking back buys.
//   wand              at every door the ghost's own way went through that he found SHUT HOME and not steel (wand.ts wandFits), the lens under it for the --wandsecs
//                     before the leaf leaves home: wand.ts wandLens's own eye (the leaf's middle, WAND.pastM out of the far face, WAND.eyeY up), a --wandfov wedge
//                     square on, the fog's line test; whom it has a line to is 'shown' for WAND.markSecs after (his mark — where he stood, not a live picture).
//                     'wand panned' = the same with the lens turned through all it can (wedge + 2 · wandPanMax). The look costs the walk no time here.
//   camsK-take+wand   both · camsK-take live2 = the take arm with two feeds sending
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import type { Headless } from './headless.ts';
import type { ReplayFile } from '../../src/replay/format.ts';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const ALLQ = has('--all-quiet'), TAPE = flag('--tape'), GHOST_ARG = flag('--ghost'), LISTED = has('--listed'), MEETINGS = has('--meetings'), LIVE = flag('--live'), FOV = flag('--fov'), OUT = resolve(flag('--out') ?? resolve(tmpdir(), 'sticky-cover', 'results.json'));
if ((LIVE !== undefined && LIVE !== 'all' && !(Number(LIVE) >= 1)) || (FOV !== undefined && !(Number(FOV) > 0 && Number(FOV) <= 360))) { console.log(`--live takes a count of 1 or more, or 'all'; --fov takes degrees (0‥360]`); process.exit(2); }
/** calm-only counting (the top of the file): on unless --loud; a tape is --loud unless --calm */
const CALM = has('--calm') || (!has('--loud') && !TAPE);
if (!TAPE && !GHOST_ARG && !ALLQ) { console.log('usage: bun run tools/qa/sticky-cover.ts --tape <replay.json[.gz]> | --ghost <level.json | levels/level.json> | --all-quiet  [--listed] [--meetings] [--loud] [--seeds 1-3] [--jobs 3] [--cap 420]   [--live N|all] [--fov deg] [--meet 8] [--warn 4] [--seen 0.5] [--carry 2] [--shoot 15] [--legmax 0] [--wandsecs s] [--wandfov deg] [--out results.json] [--md table.md]'); process.exit(2); }
process.env.TPS_PROFILE ??= 'shipped';   // (before any game module loads: the page's rules — lived-in rooms and the look's level file are what a line of sight meets)
const ROOT = resolve(import.meta.dir, '../..'), DT = 1 / 60, DEG = Math.PI / 180;
/** --ghost takes the level's file name as levels/ holds it (rerun.ts levelOf reads from there), or a path to that file: `levels/x.json`, `./levels/x.json`, absolute */
const GHOST = ((a: string | undefined): string | undefined => { if (a === undefined) return a; const L = resolve(ROOT, 'levels'); if (existsSync(resolve(L, a))) return a;
  for (const p of [resolve(a), resolve(ROOT, a)]) if (existsSync(p) && p.startsWith(L + '/')) return p.slice(L.length + 1);
  console.log(`--ghost ${a}: no such level in ${L} (give its file name there, or a path to it)`); process.exit(2); })(GHOST_ARG);
const HZ = 4, SCAN_SECS = 1, RAYS = 24, RAY_M = 30, NEAR_M = 12, GRID = 1, FLOOR_M = 25, APART_M = 6, CHEST_Y = 1.25, KS = [2, 3];
const num = (n: string, d: number) => { const v = flag(n); return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d; };
const MEET_M = num('--meet', 8), WARN_S = num('--warn', 4), SEEN_S = num('--seen', 0.5), CARRY = Math.max(1, Math.floor(num('--carry', 2))), SHOOT_M = num('--shoot', 15), LEGMAX = num('--legmax', 0);
const LEG_MIN_S = 2, LEG_FIXED_S = 20, WAND_NEAR_M = 8, ARM_LIVE = LIVE === 'all' ? Infinity : LIVE !== undefined ? Number(LIVE) : 1;
/** flags a child run is handed as they were given */
/** --deal seed: the quiet mission's deal (start, spot, patrol set) is pinned to the run's seed (`?quiet=<seed>`); die: dealt off the Game's own die, which --seeds does
 *  not reach — EVERY SEED IS THEN THE SAME DEAL (only Math.random's noise differs). --all-quiet deals by seed unless told; a plain --ghost is as it was (die). */
const DEAL = !LISTED && (flag('--deal') ?? (ALLQ ? 'seed' : 'die')) === 'seed';
/** the game's own word for a man on his calm patrol or post (game.ts GuardState); every other one is a man roused */
const CALM_STATE = 'patrol';
const PASS = ['--marksecs', '--live', '--fov', '--cap', '--meet', '--warn', '--seen', '--carry', '--shoot', '--legmax', '--wandsecs', '--wandfov'];
type Vec3 = [number, number, number];
const f1 = (x: number) => x.toFixed(1), pc = (a: number, b: number) => b > 0 ? `${(100 * a / b).toFixed(1)}%` : '–', flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** a placement's numbers: the cameras (where, facing, usable from which second, floor points seen, near-hidden samples each showed while it was live), and what they show */
interface Placed { k: number; cams: { x: number; y: number; z: number; nx: number; nz: number; from: number; floor: number; gain: number }[];
  nearShown: number; nearShownCone: number; shownAll: number; shownCone: number; }
export interface CoverOut { label: string; kind: 'tape' | 'ghost'; level: string; seed: number | null; end: string; secs: number; guards: number; samples: number; guardSamples: number;
  shown: { all: number; fog: number; cone: number };   // guard-samples drawn under way 1, way 2 all round, way 2 cone
  near: { samples: number; guardSecs: number; runSamples: number; runSecs: number; runShare: number; coneSamples: number };   // near-hidden: guard-samples, as guard-seconds, run samples with at least one, cone's own count
  candidates: number; live: number | 'all'; fov: number; best: Placed[]; naive: Placed[]; note: string;
  arms: ArmOut[]; fair: Fair;
  /** every first meeting, counted or not · the ghost's door verbs · every guard's changes of state (at the samples' 4 Hz) · the start's query · SAMESTART.on as the run stood */
  meets: Meet[]; doorLog: { t: number; door: string; verb: string }[]; stateLog: { t: number; guard: string; from: string; to: string }[]; query?: string; samestart?: boolean; }
/** the four counts, one way of counting */
export interface Counts { meetings: number; surprises: number; episodes: number; epSurprises: number; }
/** a guard's first meeting. state: his at the meeting · before: every state he was in over the --warn s before it · roused: either is not 'patrol' · shown: seconds each arm's eyes had him in those --warn s */
export interface Meet { t: number; guard: string; gx: number; gz: number; px: number; pz: number; d: number; state: string; before: string[]; task: string; aware: number; roused: boolean; atStart: boolean; shown: Record<string, number>; }
/** one arm's numbers off one run. pick: which placement ('' = no cameras in the arm) · sends: cameras sent over the run */
export interface ArmOut { arm: string; pick: '' | 'BEST' | 'NAIVE' | 'AHEAD'; shown: number; nearHid: number; nearHidSecs: number; meetings: number; surprises: number; episodes: number; epSurprises: number; sends: number;
  /** meetings … epSurprises above are `calm` under calm-only counting (the default) and `loud` under --loud; both are always here. roused = first meetings dropped, rousedEp = episodes dropped */
  calm: Counts; loud: Counts; roused: number; rousedEp: number; }
/** what the arms were measured with. doors: those the ghost's way met shut (wand: home and not steel · steel · ajar: shut but off home), and frames he walked through that he never had to open */
export interface Fair { meetM: number; warnS: number; seenS: number; carry: number; live: number | 'all'; shootM: number; /** the walk's length on the plan, m */ pathM: number; legs: number; legBy: 'rooms' | 'seconds'; legSecs: number[];
  wand: { secs: number; fov: number; panMax: number; markSecs: number; looks: number; marks: number }; doors: { met: number; wand: number; steel: number; ajar: number; open: number; names: string[] }; atStart: number;
  /** calm-only counting in force · first meetings / episodes with a roused man (not counted under it) */ calmOnly: boolean; roused: number; rousedEp: number; }

interface Cand { pos: Vec3; n: Vec3; lens: Vec3; look: Vec3; fov: number; from: number; floor: number; sees: number[]; /** the lattice points it sees (floor = their count) */ fl: number[]; /** the seconds he had a line to it within SHOOT_M, its face toward him */ hits: number[]; }
/** the collector: tick() it after every game step */
class Cover {
  t = 0; nextS = 0; nextC = 0; nS = 0;
  gsS: number[] = []; gsT: number[] = []; gsLine: number[] = []; gsCone: number[] = []; gsNear: number[] = [];   // per guard-sample: its run sample, the player's line (all round / cone), within NEAR_M
  cands: Cand[] = []; seen = new Map<string, Cand>(); lattice: Vec3[] | null = null; guards = 0;
  // the arms' own record: per guard-sample its guard and plan distance · per run sample its time and the player's room · the lens's lines under every door near him that
  // a wand fits · the doors his way met shut, and the frames he walked through
  gsG: number[] = []; gsD: number[] = []; gid = new Map<any, number>(); smT: number[] = []; smRoom: number[] = [];
  looks: { t: number; door: any; gs: number[]; as: number[] }[] = []; met = new Map<any, { fit: boolean; steel: boolean; openT: number }>(); passed = new Set<any>();
  get wandSecs(): number { return num('--wandsecs', this.M.WAND.feedSecs); }
  get markSecs(): number { return num('--marksecs', this.M.WAND.markSecs); }
  get wandFov(): number { return num('--wandfov', this.M.WAND.fovDeg); }
  /** his feet, once a second */ path: number[][] = [];
  // the audit's record: per guard-sample his state, where he and the player stood, his errand and awareness · per guard his name · changes of state · the ghost's door verbs
  gsSt: string[] = []; gsGX: number[] = []; gsGZ: number[] = []; gsPX: number[] = []; gsPZ: number[] = []; gsTk: string[] = []; gsAw: number[] = []; names: string[] = []; lastSt: string[] = [];
  stateLog: { t: number; guard: string; from: string; to: string }[] = []; doorLog: { t: number; door: string; verb: string }[] = []; meets: Meet[] = [];
  doorVerb(d: any, verb: string) { if (this.doorLog.length < 400) this.doorLog.push({ t: +this.t.toFixed(2), door: String(d.def.name ?? '?'), verb }); }
  /** the ghost found this door shut on his way (ghostRun's openDoor) */
  doorMet(d: any) { if (!this.met.has(d)) this.met.set(d, { fit: !!this.M.wandFits(d), steel: !!d.def.steel, openT: -1 }); }
  /** the lens every wall camera is measured with, and how many are eyes at once (Infinity = all of them) */
  get fov(): number { return FOV !== undefined ? Number(FOV) : this.M.STICKY.fovDeg; }
  get live(): number { return LIVE === 'all' ? Infinity : LIVE !== undefined ? Number(LIVE) : Math.max(1, this.M.STICKY.live ?? Infinity); }
  constructor(private g: any, private M: { STICKY: any; camLens: (c: any) => Vec3; FOG: any; gazeOf: (c: any) => Vec3; hostileTo: (gd: any, o: 'player') => boolean; WAND: any; wandFits: (d: any) => boolean; wandLens: (d: any, side: 1 | -1) => { pos: Vec3; yaw: number } }) { }
  /** fogofwar.ts inField, written out */
  private inField(pos: Vec3, look: Vec3, fov: number, near: number, p: Vec3): boolean {
    if (fov >= 360) return true; const dx = p[0] - pos[0], dz = p[2] - pos[2], d = Math.hypot(dx, dz); if (d < near || d < 1e-4) return true;
    const L = Math.hypot(look[0], look[2]) || 1; return (dx * look[0] + dz * look[2]) / (d * L) > Math.cos(fov * 0.5 * DEG); }
  /** fogofwar.ts lineToMan's two lines: his chest, and his head only behind a blocked chest */
  private line(e: Vec3, chest: Vec3, head: Vec3): boolean { const c = this.g.col; return !(c.segmentBlocked(e, chest) && c.segmentBlocked(e, head)); }
  private floorSeen(c: Cand): number {
    const nav = this.g.col.nav; if (!this.lattice) { this.lattice = []; for (let z = GRID / 2; z < nav.H * nav.cell; z += GRID) for (let x = GRID / 2; x < nav.W * nav.cell; x += GRID) if (!nav.isBlocked(x, z)) this.lattice.push([x, CHEST_Y, z]); }
    let n = 0; this.lattice.forEach((p, i) => { if (flat(p, c.lens) <= FLOOR_M && this.inField(c.lens, c.look, c.fov, 0, p) && !this.g.col.segmentBlocked(c.lens, p)) { n++; c.fl.push(i); } }); return n; }
  /** the wall points he could put a camera on from where he stands now */
  private scan() {
    const g = this.g, S = this.M.STICKY, p = g.player.char.pos, o: Vec3 = [p[0], S.aimY, p[2]]; this.path.push([this.t, p[0], p[2]]);
    for (let i = 0; i < RAYS; i++) { const a = i / RAYS * 2 * Math.PI, d: Vec3 = [Math.sin(a), 0, Math.cos(a)], h = g.col.raycast(o, d, RAY_M);
      if (!h || h.index >= 1e6 || Math.abs(h.n[1]) >= 0.3) continue;
      const at: Vec3 = [o[0] + d[0] * h.t, o[1], o[2] + d[2] * h.t], key = `${Math.floor(at[0] / GRID)},${Math.floor(at[2] / GRID)},${Math.abs(h.n[0]) > Math.abs(h.n[2]) ? (h.n[0] > 0 ? 'E' : 'W') : (h.n[2] > 0 ? 'N' : 'S')}`;
      if (this.seen.has(key)) continue;
      const nl = Math.hypot(h.n[0], h.n[1], h.n[2]) || 1, n: Vec3 = [h.n[0] / nl, h.n[1] / nl, h.n[2] / nl], cam = { pos: at, n, vel: null, age: 0, si: h.index, id: 0 }, all = Math.abs(n[1]) > S.flatY, ll = Math.hypot(n[0], n[2]) || 1;
      const c: Cand = { pos: at, n, lens: this.M.camLens(cam), look: all ? [1, 0, 0] : [n[0] / ll, 0, n[2] / ll], fov: all ? 360 : this.fov, from: this.t + 1, floor: 0, sees: [], fl: [], hits: [] };   // (stickyEyes' own eye)
      c.floor = this.floorSeen(c); this.seen.set(key, c); this.cands.push(c); }
    for (const c of this.cands) { if (flat(c.lens, o) > SHOOT_M || (o[0] - c.lens[0]) * c.n[0] + (o[2] - c.lens[2]) * c.n[2] < 0.05) continue; if (!g.col.segmentBlocked(o, c.lens)) c.hits.push(this.t); } }
  private sample() {
    const g = this.g, pl = g.player, c = pl.char, eye: Vec3 = c.bones.head ?? [c.pos[0], c.pos[1] + 1.65, c.pos[2]], gaze = this.M.gazeOf(c), F = this.M.FOG; let n = 0; const men: { gi: number; chest: Vec3; head: Vec3 }[] = [];
    for (const gd of g.guards) { const gc = gd.char; if (!this.M.hostileTo(gd, 'player') || gd.state === 'dead' || !gc.alive || gd.ko || gd.held) continue; n++;
      const chest: Vec3 = gc.bones.chest ?? [gc.pos[0], gc.pos[1] + 1.1, gc.pos[2]], head: Vec3 = gc.bones.head ?? [gc.pos[0], gc.pos[1] + 1.6, gc.pos[2]];
      const line = this.line(eye, chest, head), cone = line && this.inField(eye, gaze, F.coneDeg, F.coneNearM, chest), j = this.gsS.length;
      this.gsS.push(this.nS); this.gsT.push(this.t); this.gsLine.push(+line); this.gsCone.push(+cone); this.gsNear.push(+(flat(c.pos, gc.pos) <= NEAR_M));
      let gi = this.gid.get(gd); if (gi === undefined) { gi = this.gid.size; this.gid.set(gd, gi); } this.gsG.push(gi); this.gsD.push(flat(c.pos, gc.pos)); men.push({ gi, chest, head });
      { const st = String(gd.state); this.names[gi] ??= String(gd.callsign ?? `guard ${gi}`); this.gsSt.push(st); this.gsGX.push(gc.pos[0]); this.gsGZ.push(gc.pos[2]); this.gsPX.push(c.pos[0]); this.gsPZ.push(c.pos[2]); this.gsTk.push(gd.task ? String(gd.task.kind) : ''); this.gsAw.push(Number(gd.awareness) || 0);
        if (this.lastSt[gi] !== undefined && this.lastSt[gi] !== st && this.stateLog.length < 600) this.stateLog.push({ t: +this.t.toFixed(2), guard: this.names[gi], from: this.lastSt[gi], to: st }); this.lastSt[gi] = st; }
      if (!cone) for (const k of this.cands) if (k.from <= this.t && this.inField(k.lens, k.look, k.fov, 0, chest) && this.line(k.lens, chest, head)) k.sees.push(j); }
    let room = 0; try { room = Number(g.cleared?.roomAt(c.pos)) || 0; } catch { room = 0; } this.smT.push(this.t); this.smRoom.push(room);
    for (const d of g.doors.list) { if (!this.M.wandFits(d) || flat(c.pos, d.frameCentre) > WAND_NEAR_M) continue;   // (the lens as it would stand under this door from his side, now)
      const L = this.M.wandLens(d, g.doors.side(d, c.pos)), gs: number[] = [], as: number[] = [];
      for (const m of men) { if (!this.line(L.pos, m.chest, m.head)) continue; const a = Math.atan2(m.chest[0] - L.pos[0], m.chest[2] - L.pos[2]) - L.yaw; gs.push(m.gi); as.push(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / DEG); }
      this.looks.push({ t: this.t, door: d, gs, as }); }
    this.guards = Math.max(this.guards, n); this.nS++; }
  tick(dt: number) {
    const g = this.g; if (g.player.down || g.mission.stage === 'done' || g.mission.stage === 'failed') return;
    this.t += dt; { const p = g.player.char.pos; for (const d of g.doors.list) { const m = this.met.get(d); if (m && m.openT < 0 && !this.M.wandFits(d)) m.openT = this.t; if (!m && !d.isClosed() && flat(p, d.frameCentre) < 0.6) this.passed.add(d); } }
    while (this.t >= this.nextC) { this.scan(); this.nextC += SCAN_SECS; } while (this.t >= this.nextS) { this.sample(); this.nextS += 1 / HZ; } }
  /** each camera of a placement with the time its feed ends: put up the second he first can, live until `live` later ones are up (never, with every camera an eye) */
  private feeds(picks: Cand[], L = this.live): { c: Cand; hi: number }[] {
    const seq = [...picks].sort((a, b) => a.from - b.from); return seq.map((c, i) => ({ c, hi: i + L < seq.length ? seq[i + L].from : Infinity })); }
  /** the near-hidden guard-samples a placement shows (`stamp` / `tag`: the caller's scratch, so one array serves every candidate) */
  private nearHid(picks: Cand[], stamp: Uint32Array, tag: number, L = this.live): number {
    let n = 0; for (const { c, hi } of this.feeds(picks, L)) for (const j of c.sees) { if (this.gsT[j] >= hi) break; if (stamp[j] !== tag && this.gsNear[j] && !this.gsLine[j]) { stamp[j] = tag; n++; } } return n; }
  private placed(all: Cand[], k: number): Placed {
    const picks = all.slice(0, k), N = this.gsS.length, cov = new Uint8Array(N), own = new Map<Cand, number>();
    for (const { c, hi } of this.feeds(picks)) { let g = 0; for (const j of c.sees) { if (this.gsT[j] >= hi) break; cov[j] = 1; if (this.gsNear[j] && !this.gsLine[j]) g++; } own.set(c, g); }
    let near = 0, nearC = 0, hid = 0, hidC = 0, nh = 0, nhC = 0, line = 0, cone = 0;
    for (let j = 0; j < N; j++) { line += this.gsLine[j]; cone += this.gsCone[j]; if (!this.gsLine[j]) { hid += cov[j]; if (this.gsNear[j]) { nh++; near += cov[j]; } } if (!this.gsCone[j]) { hidC += cov[j]; if (this.gsNear[j]) { nhC++; nearC += cov[j]; } } }
    return { k, cams: picks.map(c => ({ x: +c.pos[0].toFixed(2), y: +c.pos[1].toFixed(2), z: +c.pos[2].toFixed(2), nx: +c.n[0].toFixed(2), nz: +c.n[2].toFixed(2), from: +c.from.toFixed(1), floor: c.floor, gain: own.get(c) ?? 0 })),
      nearShown: nh ? near / nh : 0, nearShownCone: nhC ? nearC / nhC : 0, shownAll: N ? (line + hid) / N : 0, shownCone: N ? (cone + hidC) / N : 0 }; }
  finish(head: Pick<CoverOut, 'label' | 'kind' | 'level' | 'seed' | 'end' | 'note'>): CoverOut {
    const N = this.gsS.length, isNH = (j: number) => !!this.gsNear[j] && !this.gsLine[j], K = Math.max(...KS);
    let line = 0, cone = 0, nh = 0, nhC = 0; const runs = new Set<number>();
    for (let j = 0; j < N; j++) { line += this.gsLine[j]; cone += this.gsCone[j]; if (isNH(j)) { nh++; runs.add(this.gsS[j]); } if (this.gsNear[j] && !this.gsCone[j]) nhC++; }
    // BEST: greedy by what the whole placement shows of the near-hidden samples with one more camera in it (with every camera an eye: its marginal samples, as it was)
    const best = this.greedy(K, this.live);
    // NAIVE: the most floor seen, 6 m apart
    const naive: Cand[] = []; for (const c of [...this.cands].sort((a, b) => b.floor - a.floor || a.from - b.from)) { if (naive.length >= K) break; if (naive.every(o => flat(o.pos, c.pos) >= APART_M)) naive.push(c); }
    return { ...head, secs: +this.t.toFixed(1), guards: this.guards, samples: this.nS, guardSamples: N, shown: { all: 1, fog: N ? line / N : 0, cone: N ? cone / N : 0 },
      near: { samples: nh, guardSecs: nh / HZ, runSamples: runs.size, runSecs: runs.size / HZ, runShare: this.nS ? runs.size / this.nS : 0, coneSamples: nhC },
      candidates: this.cands.length, live: Number.isFinite(this.live) ? this.live : 'all', fov: this.fov, best: KS.map(k => this.placed(best, k)), naive: KS.map(k => this.placed(naive, k)), ...this.arms(naive), meets: this.meets, doorLog: this.doorLog, stateLog: this.stateLog }; }
  private greedy(K: number, L: number): Cand[] {
    const stamp = new Uint32Array(this.gsS.length), best: Cand[] = []; let tag = 0, have = 0;
    for (let i = 0; i < K; i++) { let top: Cand | null = null, tg = have; for (const c of this.cands) { if (best.includes(c)) continue; const n = this.nearHid([...best, c], stamp, ++tag, L); if (n > tg) { tg = n; top = c; } }
      if (!top) break; best.push(top); have = tg; }
    return best; }

  // ───────────────────────────── the arms (the header's HOW FAIR THE FOG IS)
  /** the walk's legs: runs of one room (a stay under LEG_MIN_S is no leg), 20 s legs on a level with no rooms, a long leg cut at --legmax */
  private legsOf(): { legs: { t0: number; t1: number }[]; by: 'rooms' | 'seconds' } {
    const T = this.smT, end = this.t + 1e-6, cuts: number[] = [0], rooms = this.smRoom.some(r => r > 0);
    if (rooms) { let cur = this.smRoom[0] ?? 0, cand = -1, candT = 0; for (let i = 0; i < T.length; i++) { const r = this.smRoom[i];   // (0 = open floor, a doorway: a place of its own once he has stood on it LEG_MIN_S)
      if (r === cur) { cand = -1; continue; } if (r !== cand) { cand = r; candT = T[i]; } if (T[i] - candT >= LEG_MIN_S) { cuts.push(candT); cur = r; cand = -1; } } }
    else for (let t = LEG_FIXED_S; t < this.t; t += LEG_FIXED_S) cuts.push(t);
    const legs: { t0: number; t1: number }[] = []; cuts.forEach((t0, i) => { const t1 = cuts[i + 1] ?? end; if (LEGMAX > 0) { const n = Math.max(1, Math.ceil((t1 - t0) / LEGMAX - 1e-9)); for (let k = 0; k < n; k++) legs.push({ t0: t0 + (t1 - t0) * k / n, t1: t0 + (t1 - t0) * (k + 1) / n }); } else legs.push({ t0, t1 }); });
    return { legs, by: rooms ? 'rooms' : 'seconds' }; }
  /** the first of a camera's guard-samples at or after time t */
  private lower(sees: number[], t: number): number { let lo = 0, hi = sees.length; while (lo < hi) { const m = (lo + hi) >> 1; if (this.gsT[sees[m]] < t) lo = m + 1; else hi = m; } return lo; }
  /** a leg's cameras, each with the second it is up: what each sends until (the newest L send; all are off their walls at t1) */
  private legFeeds(picks: { c: Cand; up: number }[], L: number, t1: number): { c: Cand; up: number; hi: number }[] {
    const seq = [...picks].sort((a, b) => a.up - b.up); return seq.map((p, i) => ({ ...p, hi: i + L < seq.length ? seq[i + L].up : t1 })); }
  /** the take-back arm: per leg a placement chosen afresh; cov = guard-samples a live feed had */
  private take(mode: 'BEST' | 'NAIVE' | 'AHEAD', L: number, legs: { t0: number; t1: number }[]): { cov: Uint8Array; sends: number } {
    const N = this.gsS.length, cov = new Uint8Array(N), stamp = new Uint32Array(N); let tag = 0, sends = 0;
    const hid = (picks: { c: Cand; up: number }[], t0: number, t1: number): number => { const tg = ++tag; let n = 0; for (const { c, up, hi } of this.legFeeds(picks, L, t1)) for (let i = this.lower(c.sees, Math.max(up, t0)); i < c.sees.length; i++) { const j = c.sees[i]; if (this.gsT[j] >= hi) break; if (stamp[j] !== tg && this.gsNear[j] && !this.gsLine[j]) { stamp[j] = tg; n++; } } return n; };
    let prev: { c: Cand; up: number }[] = [];
    legs.forEach((leg, li) => {
      const w0 = li > 0 ? legs[li - 1].t0 : leg.t0, el: { c: Cand; up: number }[] = [];
      for (const c of this.cands) { const h = c.hits.find(t => t >= w0); if (h === undefined || h >= leg.t1) continue; const up = Math.max(leg.t0, h + 1); if (up < leg.t1) el.push({ c, up }); }
      for (const k of prev) if (!el.some(e => e.c === k.c)) el.push(k);   // (one left where it is: it keeps its place in the order — an older camera than any sent this leg)
      let picks: { c: Cand; up: number }[] = [];
      if (mode === 'BEST') { let have = 0; for (let i = 0; i < CARRY; i++) { let top: { c: Cand; up: number } | null = null, tg = have; for (const e of el) { if (picks.includes(e)) continue; const n = hid([...picks, e], leg.t0, leg.t1); if (n > tg) { tg = n; top = e; } } if (!top) break; picks.push(top); have = tg; } }
      else { const sc = new Map<Cand, number>();
        if (mode === 'AHEAD' && this.lattice) { const way = this.path.filter(q => q[0] >= leg.t0 && q[0] <= leg.t1 + 10), near = new Uint8Array(this.lattice.length); this.lattice.forEach((p, i) => { for (const q of way) if (Math.hypot(p[0] - q[1], p[2] - q[2]) <= MEET_M) { near[i] = 1; break; } });
          for (const e of el) { let n = 0; for (const i of e.c.fl) n += near[i]; sc.set(e.c, n); } }
        else for (const e of el) sc.set(e.c, e.c.floor);
        for (const e of [...el].sort((a, b) => sc.get(b.c)! - sc.get(a.c)! || b.c.floor - a.c.floor || a.up - b.up)) { if (picks.length >= CARRY) break; if (picks.every(o => flat(o.c.pos, e.c.pos) >= APART_M)) picks.push(e); } picks = picks.reverse(); }   // (two up the same second: the one that sees the most floor is the newest)
      sends += picks.filter(k => !prev.includes(k)).length; prev = picks;
      for (const { c, up, hi } of this.legFeeds(picks, L, leg.t1)) for (let i = this.lower(c.sees, Math.max(up, leg.t0)); i < c.sees.length; i++) { const j = c.sees[i]; if (this.gsT[j] >= hi) break; cov[j] = 1; } });
    return { cov, sends }; }
  /** the wand arm: cov = guard-samples inside a mark's WAND.markSecs */
  private wand(half: number): { cov: Uint8Array; looks: number; marks: number } {
    const N = this.gsS.length, cov = new Uint8Array(N), W = this.wandSecs, keep = this.markSecs, marks = new Map<number, number[]>(); let looks = 0, nm = 0;
    for (const [d, m] of this.met) { if (!m.fit || m.openT < 0) continue; looks++; const seenHere = new Set<number>();
      for (const k of this.looks) { if (k.door !== d || k.t > m.openT || k.t < m.openT - W - 1e-6) continue; k.gs.forEach((gi, i) => { if (k.as[i] > half) return; let a = marks.get(gi); if (!a) marks.set(gi, a = []); a.push(k.t); seenHere.add(gi); }); }
      nm += seenHere.size; }
    for (const a of marks.values()) a.sort((x, y) => x - y);
    const ptr = new Map<number, number>();
    for (let j = 0; j < N; j++) { const a = marks.get(this.gsG[j]); if (!a) continue; let p = ptr.get(this.gsG[j]) ?? 0; while (p + 1 < a.length && a[p + 1] <= this.gsT[j]) p++; ptr.set(this.gsG[j], p); if (a[p] <= this.gsT[j] && this.gsT[j] <= a[p] + keep) cov[j] = 1; }
    return { cov, looks, marks: nm }; }
  /** every time a guard comes inside --meet with a line after --warn s away, whatever the arm: `first` = his meeting, the rest are episodes. roused = his state was
   *  not 'patrol' at that sample or at one of the --warn s before it. A first meeting in the run's first --seen s is `atStart` (counted by nobody). */
  private onsets(byG: number[][]): { g: number; k: number; first: boolean; atStart: boolean; roused: boolean; meet: Meet | null }[] {
    const out: { g: number; k: number; first: boolean; atStart: boolean; roused: boolean; meet: Meet | null }[] = [];
    byG.forEach((js, g) => { let last = -Infinity, first = true;
      for (let k = 0; k < js.length; k++) { const j = js[k]; if (!this.gsLine[j] || this.gsD[j] > MEET_M) continue; const T = this.gsT[j], onset = T - last > WARN_S; last = T; if (!onset) continue;
        const was1 = first; first = false; const before: string[] = [];
        for (let b = k - 1; b >= 0 && this.gsT[js[b]] >= T - WARN_S - 1e-6; b--) { const st = this.gsSt[js[b]]; if (!before.includes(st)) before.push(st); }
        const roused = this.gsSt[j] !== CALM_STATE || before.some(st => st !== CALM_STATE), atStart = T < SEEN_S, r2 = (x: number) => +x.toFixed(2);
        const meet: Meet | null = was1 ? { t: r2(T), guard: this.names[g] ?? `guard ${g}`, gx: r2(this.gsGX[j]), gz: r2(this.gsGZ[j]), px: r2(this.gsPX[j]), pz: r2(this.gsPZ[j]), d: r2(this.gsD[j]), state: this.gsSt[j], before, task: this.gsTk[j], aware: r2(this.gsAw[j]), roused, atStart, shown: {} } : null;
        out.push({ g, k, first: was1, atStart, roused, meet }); } });
    return out; }
  private armOut(arm: string, pick: ArmOut['pick'], covs: Uint8Array[], sends: number, byG: number[][], ons: ReturnType<Cover['onsets']>): ArmOut {
    const N = this.gsS.length, sh = new Uint8Array(N); let shown = 0, nh = 0;
    for (let j = 0; j < N; j++) { let s = this.gsLine[j]; for (const c of covs) s |= c[j]; sh[j] = s; shown += s; if (this.gsNear[j] && !s) nh++; }
    const zero = (): Counts => ({ meetings: 0, surprises: 0, episodes: 0, epSurprises: 0 }), loud = zero(), calm = zero(); let roused = 0, rousedEp = 0;
    for (const o of ons) { const js = byG[o.g], T = this.gsT[js[o.k]];
      let n = 0; for (let b = o.k - 1; b >= 0 && this.gsT[js[b]] >= T - WARN_S - 1e-6; b--) n += sh[js[b]];
      if (o.meet) o.meet.shown[`${arm}${pick ? ` ${pick}` : ''}`] = n / HZ;
      if (o.first && o.atStart) continue;   // (as it was: a first meeting in the run's first --seen s is counted by nobody; nothing could have warned of it)
      const sur = n / HZ < SEEN_S - 1e-6;
      for (const c of o.roused ? [loud] : [loud, calm]) { c.episodes++; if (sur) c.epSurprises++; if (o.first) { c.meetings++; if (sur) c.surprises++; } }
      if (o.roused) { rousedEp++; if (o.first) roused++; } }
    return { arm, pick, shown: N ? shown / N : 0, nearHid: nh, nearHidSecs: nh / HZ, ...(CALM ? calm : loud), sends, calm, loud, roused, rousedEp }; }
  private arms(naive: Cand[]): { arms: ArmOut[]; fair: Fair } {
    const N = this.gsS.length, byG: number[][] = []; for (let j = 0; j < N; j++) (byG[this.gsG[j]] ??= []).push(j); for (let i = 0; i < byG.length; i++) byG[i] ??= [];
    const { legs, by } = this.legsOf(), K = `cams${CARRY}`, ons = this.onsets(byG), out: ArmOut[] = [], fov = this.wandFov, panMax = Math.max(0, 90 - fov * 0.5 - this.M.WAND.blindDeg);
    const fixed = (picks: Cand[]): Uint8Array => { const cov = new Uint8Array(N); for (const { c, hi } of this.feeds(picks, 1)) for (const j of c.sees) { if (this.gsT[j] >= hi) break; cov[j] = 1; } return cov; };
    const fb = this.greedy(CARRY, 1), fn = naive.slice(0, CARRY), w = this.wand(fov * 0.5), wp = this.wand(fov * 0.5 + panMax);
    const add = (arm: string, pick: ArmOut['pick'], covs: Uint8Array[], sends = 0) => out.push(this.armOut(arm, pick, covs, sends, byG, ons));
    add('fog', '', []);
    add(`${K}-fixed`, 'BEST', [fixed(fb)], fb.length); add(`${K}-fixed`, 'NAIVE', [fixed(fn)], fn.length);
    const tb = this.take('BEST', ARM_LIVE, legs), tn = this.take('NAIVE', ARM_LIVE, legs), ta = this.take('AHEAD', ARM_LIVE, legs);
    add(`${K}-take`, 'BEST', [tb.cov], tb.sends); add(`${K}-take`, 'NAIVE', [tn.cov], tn.sends); add(`${K}-take`, 'AHEAD', [ta.cov], ta.sends);
    add('wand', '', [w.cov]);
    add(`${K}-take+wand`, 'BEST', [tb.cov, w.cov], tb.sends); add(`${K}-take+wand`, 'NAIVE', [tn.cov, w.cov], tn.sends); add(`${K}-take+wand`, 'AHEAD', [ta.cov, w.cov], ta.sends);
    if (ARM_LIVE !== 2) { const b2 = this.take('BEST', 2, legs), n2 = this.take('NAIVE', 2, legs); add(`${K}-take live2`, 'BEST', [b2.cov], b2.sends); add(`${K}-take live2`, 'NAIVE', [n2.cov], n2.sends); const a2 = this.take('AHEAD', 2, legs); add(`${K}-take live2`, 'AHEAD', [a2.cov], a2.sends); }
    add('wand panned', '', [wp.cov]);
    const met = [...this.met.entries()], open = [...this.passed].filter(d => !this.met.has(d));
    this.meets = ons.flatMap(o => o.meet ? [o.meet] : []).sort((a, b) => a.t - b.t);
    return { arms: out, fair: { meetM: MEET_M, warnS: WARN_S, seenS: SEEN_S, carry: CARRY, live: Number.isFinite(ARM_LIVE) ? ARM_LIVE : 'all', shootM: SHOOT_M, pathM: +this.path.reduce((a, q, i) => a + (i ? Math.hypot(q[1] - this.path[i - 1][1], q[2] - this.path[i - 1][2]) : 0), 0).toFixed(1), legs: legs.length, legBy: by, legSecs: legs.map(l => +(l.t1 - l.t0).toFixed(1)),
      wand: { secs: this.wandSecs, fov, panMax, markSecs: this.markSecs, looks: w.looks, marks: w.marks },
      doors: { met: met.length, wand: met.filter(([, m]) => m.fit).length, steel: met.filter(([, m]) => m.steel).length, ajar: met.filter(([, m]) => !m.fit && !m.steel).length, open: open.length, names: met.map(([d, m]) => `${String(d.def.name ?? '?')}:${m.steel ? 'steel' : m.fit ? (m.openT < 0 ? 'wand, never opened' : 'wand') : 'ajar'}`) }, atStart: ons.filter(o => o.first && o.atStart).length, calmOnly: CALM, roused: out[0]?.roused ?? 0, rousedEp: out[0]?.rousedEp ?? 0 } }; }
}
async function coverFor(g: any): Promise<Cover> {
  const S = await import(`${ROOT}/src/game/stickycam.ts`), F = await import(`${ROOT}/src/game/fogofwar.ts`), T = await import(`${ROOT}/src/game/teams.ts`);
  const Wd = await import(`${ROOT}/src/game/wand.ts`);
  return new Cover(g, { STICKY: S.STICKY, camLens: S.camLens, FOG: F.FOG, gazeOf: F.gazeOf, hostileTo: T.hostileTo, WAND: Wd.WAND, wandFits: Wd.wandFits, wandLens: Wd.wandLens }); }

function table(r: CoverOut): string {
  const p = (x: number) => `${(100 * x).toFixed(1)}%`, L: string[] = [];
  L.push(`=== ${r.label} · ${r.level} · ${r.end} · ${f1(r.secs)} s · ${r.guards} guards · ${r.samples} samples at ${HZ} Hz · ${r.guardSamples} guard-samples · ${r.candidates} camera places ===`);
  if (r.note) L.push(`  ${r.note}`);
  L.push(`  shown, of guard-samples:  all shown ${p(r.shown.all)}  ·  fog all round ${p(r.shown.fog)}  ·  fog cone ${p(r.shown.cone)}`);
  L.push(`  near-hidden (≤ ${NEAR_M} m, no line): ${r.near.samples} guard-samples = ${f1(r.near.guardSecs)} guard-s (${pc(r.near.samples, r.guardSamples)} of guard-samples); at least one such guard for ${f1(r.near.runSecs)} s = ${p(r.near.runShare)} of the run  [cone's own: ${r.near.coneSamples}]`);
  L.push(`  fog + cameras (${r.live === 'all' ? 'every camera an eye' : r.live === 1 ? 'one live feed: the newest' : `${r.live} live feeds: the newest`}, lens ${r.fov}°)        near-hidden shown   (cone's near-hidden)   shown of all, all round   cone`);
  for (const [name, rows] of [['BEST ', r.best], ['NAIVE', r.naive]] as const) for (const q of rows) L.push(`    ${name} k=${q.k}${q.cams.length < q.k ? ` (${q.cams.length} found)` : ''}        ${p(q.nearShown).padStart(6)}              ${p(q.nearShownCone).padStart(6)}                ${p(q.shownAll).padStart(6)}              ${p(q.shownCone).padStart(6)}`);
  const where = (q: Placed) => q.cams.map((c, i) => `#${i + 1} (${f1(c.x)}, ${f1(c.z)}) facing (${c.nx}, ${c.nz}) from ${f1(c.from)} s · ${c.gain} near-hidden samples while live · ${c.floor} floor pts`).join('  |  ');
  L.push(`  BEST k=2 cameras:  ${where(r.best[0]) || 'none'}`); L.push(`  NAIVE k=2 cameras: ${where(r.naive[0]) || 'none'}`);
  if (r.arms) { const F = r.fair, D = F.doors;
    L.push(`  THE ARMS (a meeting: first within ${F.meetM} m with his own line; a surprise: shown < ${F.seenS} s in the ${F.warnS} s before) · ${F.legs} legs by ${F.legBy} · doors met shut ${D.met}: ${D.wand} wand, ${D.steel} steel, ${D.ajar} ajar; ${D.open} frames walked through open · wand looks ${F.wand.looks}, men marked ${F.wand.marks}${r.kind === 'tape' ? ' · A TAPE HAS NO DOOR RECORD: the wand arms are the fog' : ''}`);
    L.push(`    ${F.calmOnly === false ? 'COUNTED --loud: roused men and all' : 'COUNTED CALM-ONLY'} · ${ROUSED_WORDS}: ${F.roused ?? 0}${F.calmOnly === false ? ' (counted here)' : ', not counted'}${F.atStart ? ` · met in the first ${F.seenS} s, counted by nobody: ${F.atStart}` : ''}`);
    L.push(`    arm                        shown   near-hidden s   meetings   surprises   (episodes: surprises)   cameras sent   the other count (${F.calmOnly === false ? 'calm-only' : '--loud'}): surprises/meetings`);
    for (const a of r.arms) { const o = F.calmOnly === false ? a.calm : a.loud; L.push(`    ${`${a.arm}${a.pick ? ` ${a.pick}` : ''}`.padEnd(26)} ${p(a.shown).padStart(6)}   ${f1(a.nearHidSecs).padStart(9)}   ${String(a.meetings).padStart(8)}   ${String(a.surprises).padStart(9)}   ${`${a.episodes}: ${a.epSurprises}`.padStart(12)}   ${(a.sends ? String(a.sends) : '').padStart(12)}   ${o ? `${o.surprises}/${o.meetings}` : ''}`); } }
  return L.join('\n'); }
const ROUSED_WORDS = `met while roused by the ghost's own noise`;
/** the arms a meeting's line names (the page's five) */
const LOG_ARMS = (carry: number) => ['fog', `cams${carry}-take AHEAD`, 'wand', `cams${carry}-take+wand AHEAD`, 'wand panned'];
/** --meetings: one line per first meeting, counted or dropped, then the ghost's door verbs and the guards' changes of state */
function meetLines(r: CoverOut): string {
  const F = r.fair, L: string[] = [`  MEETINGS ${r.label} · ${r.level} · ${F?.calmOnly === false ? '--loud' : 'calm-only'} · first within ${F?.meetM} m with his own line · shown = seconds the arm's eyes had him in the ${F?.warnS} s before (a surprise: under ${F?.seenS} s)`];
  if (!r.meets) return L[0] + '\n    (a run from before the meetings were kept)';
  if (r.query !== undefined) L.push(`    started on ${r.query} · SAMESTART.on ${r.samestart} · ${r.note}`);
  if (!r.meets.length) L.push('    no guard was ever met');
  for (const m of r.meets) { const arms = LOG_ARMS(F.carry).filter(a => a in m.shown), v = (a: string) => m.shown[a] < F.seenS - 1e-6 ? 'SURPRISE' : 'warned', per = arms.map(a => `${a} ${m.shown[a].toFixed(2)} ${v(a)}`).join(' · ');
    L.push(`    ${m.t.toFixed(2).padStart(7)} s  ${m.guard.padEnd(10)} guard (${f1(m.gx)}, ${f1(m.gz)})  ghost (${f1(m.px)}, ${f1(m.pz)})  ${m.d.toFixed(1).padStart(4)} m  state ${m.state}${m.before.some(b => b !== m.state) ? ` [in the ${F.warnS} s before: ${m.before.join(', ')}]` : ''}${m.task ? ` on errand '${m.task}'` : ''} aware ${m.aware.toFixed(2)}  →  ${m.atStart ? `AT THE START, counted by nobody (${per})` : m.roused ? `DROPPED-ROUSED${F.calmOnly === false ? ' (counted: --loud)' : ''} (it would read: ${per})` : per}`); }
  L.push(`    the ghost's door verbs: ${r.doorLog?.length ? r.doorLog.map(d => `${d.t.toFixed(1)} s ${d.verb} ${d.door}`).join(' · ') : 'none'}`);
  L.push(`    guards' changes of state: ${r.stateLog?.length ? r.stateLog.map(x => `${x.t.toFixed(1)} s ${x.guard} ${x.from}→${x.to}`).join(' · ') : 'none: every man on his patrol all run'}`);
  return L.join('\n'); }
function pooled(label: string, rs: CoverOut[]): string {
  const sum = (f: (r: CoverOut) => number) => rs.reduce((a, r) => a + f(r), 0), N = sum(r => r.guardSamples), nh = sum(r => r.near.samples), p = (a: number, b: number) => pc(a, b).padStart(6);
  const L = [`=== ${label}: ${rs.length} runs pooled (sample-weighted) · ${N} guard-samples · fog all round ${pc(sum(r => r.shown.fog * r.guardSamples), N)} · cone ${pc(sum(r => r.shown.cone * r.guardSamples), N)} · near-hidden ${nh} = ${f1(nh / HZ)} guard-s, some guard for ${pc(sum(r => r.near.runSamples), sum(r => r.samples))} of the runs ===`];
  for (const [name, get] of [['BEST ', (r: CoverOut) => r.best], ['NAIVE', (r: CoverOut) => r.naive]] as const) KS.forEach((k, i) => L.push(`    ${name} k=${k}   near-hidden shown ${p(sum(r => get(r)[i].nearShown * r.near.samples), nh)}   shown of all: all round ${p(sum(r => get(r)[i].shownAll * r.guardSamples), N)} · cone ${p(sum(r => get(r)[i].shownCone * r.guardSamples), N)}`));
  return L.join('\n'); }
function file(rs: CoverOut[]) { mkdirSync(dirname(OUT), { recursive: true }); let all: Record<string, CoverOut> = {}; if (existsSync(OUT)) { try { all = JSON.parse(readFileSync(OUT, 'utf8')).runs ?? {}; } catch { /* a file that is not ours: written over */ } }
  for (const r of rs) all[r.label] = r; writeFileSync(OUT, JSON.stringify({ tool: 'sticky-cover', hz: HZ, nearM: NEAR_M, rays: RAYS, rayM: RAY_M, floorM: FLOOR_M, apartM: APART_M, live: LIVE ?? 'as the run left STICKY.live', fov: FOV ?? 'as the run left STICKY.fovDeg', runs: all }, null, 1)); }

// ───────────────────────────── the arms over several runs: one table, rows = missions
/** the quiet missions' levels (src/scene/scenarioList.ts QUIET_MISSIONS, one row a level) and how each is listed. The ghost walks every one ALONE. */
const QUIET: { level: string; as: string }[] = [
  { level: 'bazaar.json', as: 'solo' }, { level: 'police-post.json', as: 'solo' }, { level: 'vault.json', as: 'solo' },
  { level: 'crossing.json', as: 'built for two, walked alone: its worst case' }, { level: 'quiet-relay.json', as: 'built for two, walked alone: its worst case' }, { level: 'lights-out.json', as: 'built for two, walked alone: its worst case' },
  { level: 'quiet-yard.json', as: 'off the list' }];
interface ArmSum { arm: string; pick: ArmOut['pick']; runs: number; shown: number; nearHidSecs: number; meetings: number; surprises: number; episodes: number; epSurprises: number; sends: number; roused: number; loud: Counts; calm: Counts; }
/** an arm over runs: shown is sample-weighted · near-hidden s and cameras sent are a run's mean · meetings, surprises and episodes are totals */
function armSums(rs: CoverOut[]): ArmSum[] {
  const keys: string[] = [], by = new Map<string, { a: ArmOut; r: CoverOut }[]>();
  for (const r of rs) for (const a of r.arms ?? []) { const k = `${a.arm}|${a.pick}`; if (!by.has(k)) { by.set(k, []); keys.push(k); } by.get(k)!.push({ a, r }); }
  return keys.map(k => { const v = by.get(k)!, N = v.reduce((s, x) => s + x.r.guardSamples, 0), sum = (f: (a: ArmOut) => number) => v.reduce((s, x) => s + f(x.a), 0);
    return { arm: v[0].a.arm, pick: v[0].a.pick, runs: v.length, shown: N ? v.reduce((s, x) => s + x.a.shown * x.r.guardSamples, 0) / N : 0, nearHidSecs: sum(a => a.nearHidSecs) / v.length, meetings: sum(a => a.meetings), surprises: sum(a => a.surprises), episodes: sum(a => a.episodes), epSurprises: sum(a => a.epSurprises), sends: sum(a => a.sends) / v.length, roused: sum(a => a.roused ?? 0),
      loud: { meetings: sum(a => a.loud?.meetings ?? a.meetings), surprises: sum(a => a.loud?.surprises ?? a.surprises), episodes: sum(a => a.loud?.episodes ?? a.episodes), epSurprises: sum(a => a.loud?.epSurprises ?? a.epSurprises) },
      calm: { meetings: sum(a => a.calm?.meetings ?? a.meetings), surprises: sum(a => a.calm?.surprises ?? a.surprises), episodes: sum(a => a.calm?.episodes ?? a.episodes), epSurprises: sum(a => a.calm?.epSurprises ?? a.epSurprises) } }; }); }
const rousedOf = (rs: CoverOut[]) => rs.reduce((a, r) => a + (r.fair?.roused ?? 0), 0);
const doorSum = (rs: CoverOut[]) => { const s = (f: (r: CoverOut) => number) => rs.reduce((a, r) => a + f(r), 0); return { met: s(r => r.fair.doors.met), wand: s(r => r.fair.doors.wand), steel: s(r => r.fair.doors.steel), ajar: s(r => r.fair.doors.ajar), open: s(r => r.fair.doors.open), looks: s(r => r.fair.wand.looks), marks: s(r => r.fair.wand.marks), legs: s(r => r.fair.legs) }; };
/** the columns of the one table: the arm, and which placement's row of it a BEST / NAIVE table reads */
function armCols(sums: ArmSum[], pick: 'BEST' | 'NAIVE' | 'AHEAD'): ArmSum[] { const names = [...new Set(sums.map(a => a.arm))]; return names.map(n => sums.find(a => a.arm === n && (a.pick === pick || a.pick === ''))!).filter(Boolean); }
function armTable(rows: { name: string; runs: CoverOut[] }[]): string {
  const all = rows.flatMap(q => q.runs), L: string[] = [], cell = (a: ArmSum) => `${(100 * a.shown).toFixed(0).padStart(3)}% ${a.nearHidSecs.toFixed(0).padStart(4)}s ${`${a.surprises}/${a.meetings}`.padStart(5)}`;
  if (!all.length || !all[0].arms) return 'no arms to print';
  const F = all[0].fair; L.push(`=== HOW FAIR THE FOG IS, PER AID · each cell: shown % of guard-samples · near-hidden guard-seconds a run (≤ ${NEAR_M} m, drawn by no eye) · surprises/meetings over the row's runs (first within ${F.meetM} m with a line; a surprise = shown < ${F.seenS} s in the ${F.warnS} s before) ===`);
  for (const pick of ['BEST', 'AHEAD', 'NAIVE'] as const) { const head = armCols(armSums(all), pick);
    L.push(`  ${pick} placements (${pick === 'BEST' ? 'a player who knows the patrols: an upper bound' : pick === 'AHEAD' ? 'the most floor seen along his own way, no knowledge of the patrols; no fixed arm' : 'the most floor seen, no knowledge of the patrols'})`);
    L.push(`  ${'mission'.padEnd(34)} runs  ${head.map(a => a.arm.padEnd(17)).join(' ')}`);
    for (const q of [...rows, { name: 'POOLED', runs: all }]) { if (!q.runs.length) { L.push(`  ${q.name.slice(0, 34).padEnd(34)}    0  no run came back`); continue; }
      L.push(`  ${q.name.slice(0, 34).padEnd(34)} ${String(q.runs.length).padStart(4)}  ${armCols(armSums(q.runs), pick).map(a => cell(a).padEnd(17)).join(' ')}`); } }
  L.push(`  ${F.calmOnly === false ? 'COUNTED --loud (roused men and all)' : 'COUNTED CALM-ONLY'} · ${ROUSED_WORDS}${F.calmOnly === false ? ' (counted above)' : ', not counted'}: ${rows.map(q => `${q.name.split(' ')[0]} ${rousedOf(q.runs)}`).join(' · ')} · all ${rousedOf(all)}`);
  { const pl = armSums(all), want = LOG_ARMS(F.carry); L.push(`  POOLED, surprises/meetings, calm-only | --loud:  ${want.map(w => { const a = pl.find(x => `${x.arm}${x.pick ? ` ${x.pick}` : ''}` === w); return a ? `${w} ${a.calm.surprises}/${a.calm.meetings} | ${a.loud.surprises}/${a.loud.meetings}` : ''; }).filter(Boolean).join(' · ')}`); }
  L.push(`  doors on the ghost's way (all runs): ${rows.map(q => { const d = doorSum(q.runs); return `${q.name.split(' ')[0]} ${d.wand} wand / ${d.steel} steel / ${d.ajar} ajar / ${d.open} open`; }).join(' · ')}`);
  return L.join('\n'); }
function markdown(rows: { name: string; runs: CoverOut[] }[], lost: string[], mins: number, jobs: number, seeds: number[]): string {
  const all = rows.flatMap(q => q.runs), F = all[0]?.fair, L: string[] = [], pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const calmOnly = F?.calmOnly !== false, nR = rousedOf(all);
  L.push(`# Fog fairness per quiet mission, per aid — ${LISTED ? 'THE MISSIONS AS THE LIST OPENS THEM' : DEAL ? 'pinned deals (URL variants)' : 'the deal off the die'} — ${new Date().toISOString().slice(0, 10)}`, '');
  L.push(`**A MODEL, NOT PLAY.** Nobody played these missions and nothing here was seen on a GPU. What is modelled:`);
  L.push(`- **The cameras were never fired.** A camera 'is up' on a wall place the ghost had a line to: no flight, no drop, no tick a guard could hear, **no time cost** — and taking one back costs nothing either (the ghost never leaves his way to fetch it), so the take-back arms are an UPPER BOUND on what taking back buys.`);
  L.push(`- **The wand was never used.** A lens is taken to stand under each shut, non-steel door on his way for the ${F ? F.wand.secs : 1.5} s before the leaf moves: **no time cost** (in the game he kneels ${F ? F.wand.secs : 1.5} s before it shows anything). A mark is where the man STOOD, kept ${F ? F.wand.markSecs : 15} s — counted here as 'shown'.`);
  L.push(`- **The ghost walks ALONE, UPRIGHT, the SHORTEST WAY** (the room, the thing, the nearest way out), unseen and unhurt — and he **DOES PICK AND KICK DOORS**: he picks every lock on his way and kicks a leaf that has no lock to pick. Guards do not see him or hear his feet, but they DO hear his picks and kicks, leave their patrols and walk to the door. A real player crouches, waits, goes round; none of that is here.`);
  L.push(`- **ROUSED GUARDS ARE ${calmOnly ? 'NOT COUNTED' : 'COUNTED HERE (--loud: the old count)'}.** A meeting ${calmOnly ? 'counts only if' : 'is called roused unless'} the guard's state was the game's calm \`${CALM_STATE}\` at the meeting and at every sample of the ${F?.warnS ?? WARN_S} s before it. A man met while \`suspicious\`, \`search\` or \`alert\` came to the ghost's own noise; the fog did not hide him. Those are their own number: **${ROUSED_WORDS}: ${nR}${calmOnly ? ', not counted' : ', counted'}** (per mission in the tables; the old count that included them is beside the new one in 'Every arm').`);
  L.push(LISTED
    ? `- **THE DEAL IS THE LIST'S OWN.** Each mission is started as its row on the mission list starts it: no pin, which with the same-start rule (on in the page, and on here: the shipped stand) is start 1, spot 1, patrol 1 on every load and every restart. ONE run a mission, because it is one deal. The walks table shows the deal each run got.`
    : DEAL ? `- **PINNED DEALS ARE VARIANTS A PLAYER REACHES ONLY BY A URL PIN.** Each seed here pins its own deal (\`?quiet=<seed>\`: start, spot, patrol set). The mission list names no pin, and with the same-start rule it always opens start 1, spot 1, patrol 1 — which need not be any of these rows. For the mission a player gets from the list, read the \`--listed\` file.`
    : `- **The deal is off the Game's die with no pin**: on the shipped stand, with the same-start rule, that is start 1, spot 1, patrol 1 for every seed (the list's own deal; \`--listed\` runs it once).`);
  L.push(`- **No GPU, no smoke, no light.** Lines are the fog's wall-and-leaf test (chest, then head); the fog's smoke step and everything drawn are not in it.`);
  L.push(`- **The three missions built for two are walked alone**: no partner's eye${LISTED ? ' (the list\'s own row brings one: its `squad=1` is left off here)' : ''}. That is their worst case, not how they play.`);
  L.push(`- **BEST / NAIVE / AHEAD.** BEST placements know the patrols (an upper bound); NAIVE ones pick the wall places that see the most floor; AHEAD ones the places that see the most floor along his own way.`);
  L.push(`- **Small counts.** A run has 3 to 6 guards, so at most that many first meetings; ${LISTED ? 'one run a mission' : `${seeds.length} seeds a mission`}. Read the surprise columns as counts, not rates. Shown % and near-hidden seconds are over ALL guard-samples, roused or not.`, '');
  if (F) L.push(`Stand: ${process.env.TPS_PROFILE} (\`TPS_PROFILE\`); SAMESTART.on as the runs stood: ${[...new Set(all.map(r => String(r.samestart)))].join(' / ')}. ${LISTED ? 'One run a mission' : `Seeds ${seeds.join(', ')}`}. Counting: ${calmOnly ? 'calm-only' : '--loud'}. Meeting = a guard's first sample within ${F.meetM} m of the ghost with the ghost's own line to him. Surprise = the arm's eyes showed him for under ${F.seenS} s in the ${F.warnS} s before. Near-hidden = within ${NEAR_M} m and drawn by no eye of the arm. Cameras: ${F.carry} carried, ${F.live} live feed, lens ${all[0].fov}°, a wall place within ${F.shootM} m. Legs (take-back): the ghost's room changes (${[...new Set(all.map(r => r.fair.legBy))].join(' / ')}). Wand: ${F.wand.fov}° wedge square on; 'panned' = turned through all it can (± ${F.wand.panMax}°).`, '');
  L.push(`Deals: ${LISTED ? `the list's own (started on \`${all[0]?.query ?? '?quiet'}\`, no pin). Every run dealt start 1, spot 1, patrol 1 (or 'all'): **${all.length && all.every(listedDeal) ? 'YES' : 'NO — READ THE WALKS TABLE'}**` : DEAL ? 'each seed pins its own deal (`?quiet=<seed>`: start, spot, patrol set)' : 'OFF THE GAME\'S DIE — every seed is the same deal'}; the walks table names each.`, '');
  L.push(`Run time: ${mins.toFixed(1)} min for ${all.length} runs, ${jobs} at a time.${lost.length ? ` LOST RUNS: ${lost.join(' | ')}` : ''}`, '');
  L.push(`## The walks`, '', `| mission | seed | end | seconds | metres walked | guards | guard-samples | legs | doors met shut: wand / steel / ajar | frames walked through open | wand looks | men marked | met roused, not counted | the deal |`, `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const q of rows) { if (!q.runs.length) L.push(`| ${q.name} | – | NO RUN CAME BACK | | | | | | | | | | | |`); for (const r of q.runs) L.push(`| ${q.name} | ${r.seed} | ${r.end === 'done' ? 'out' : `**${r.end}**: ${r.note.split(' · ')[0]}`} | ${f1(r.secs)} | ${r.fair.pathM} | ${r.guards} | ${r.guardSamples} | ${r.fair.legs} | ${r.fair.doors.wand} / ${r.fair.doors.steel} / ${r.fair.doors.ajar} | ${r.fair.doors.open} | ${r.fair.wand.looks} | ${r.fair.wand.marks} | ${r.fair.roused ?? 0} | ${dealOf(r)} |`); }
  for (const pick of ['BEST', 'AHEAD', 'NAIVE'] as const) { const head = armCols(armSums(all), pick);
    L.push('', `## One table, ${pick} placements`, '', pick === 'BEST' ? 'BEST knows the patrols (greedy by the near-hidden samples shown): an upper bound.' : pick === 'AHEAD' ? 'AHEAD knows only his own way: the wall places that see the most floor within the meeting distance of where he is about to walk. Take-back arms only.' : 'NAIVE knows nothing: the wall places that see the most floor.', '', `Each cell: shown % · near-hidden guard-seconds a run · surprises / meetings (totals over the row's runs${calmOnly ? '; roused men not counted' : '; --loud'}).`, '', `| mission | runs | met roused, not counted | ${head.map(a => a.arm).join(' | ')} |`, `|---|---|---|${head.map(() => '---').join('|')}|`);
    for (const q of [...rows, { name: '**POOLED**', runs: all }]) if (q.runs.length) L.push(`| ${q.name} | ${q.runs.length} | ${rousedOf(q.runs)} | ${armCols(armSums(q.runs), pick).map(a => `${(100 * a.shown).toFixed(0)}% · ${a.nearHidSecs.toFixed(0)} s · ${a.surprises}/${a.meetings}`).join(' | ')} |`); }
  const block = (name: string, rs: CoverOut[]) => { L.push('', `### ${name}`, '', `${ROUSED_WORDS}: ${rousedOf(rs)}${calmOnly ? ', not counted' : ', counted'}.`, '', `| arm | shown | near-hidden s a run | meetings | surprises | episodes | episode surprises | cameras sent a run | calm-only count: surprises / meetings | old loud count: surprises / meetings |`, `|---|---|---|---|---|---|---|---|---|---|`);
    for (const a of armSums(rs)) L.push(`| ${a.arm}${a.pick ? ` ${a.pick}` : ''} | ${pct(a.shown)} | ${a.nearHidSecs.toFixed(1)} | ${a.meetings} | ${a.surprises} | ${a.episodes} | ${a.epSurprises} | ${a.sends ? a.sends.toFixed(1) : ''} | ${a.calm.surprises} / ${a.calm.meetings} | ${a.loud.surprises} / ${a.loud.meetings} |`); };
  L.push('', `## Every arm, per mission`, '', `Shown is sample-weighted over the seeds; near-hidden seconds and cameras sent are a run's mean; meetings, surprises and episodes are totals over the seeds. An episode = every time a guard comes back inside ${F?.meetM ?? 8} m with a line after ${F?.warnS ?? 4} s away (the first is the meeting).`);
  for (const q of rows) if (q.runs.length) block(q.name, q.runs); if (all.length) block('POOLED, every mission and seed', all);
  L.push('', `## Doors the ghost's way met, by name`, ''); for (const q of rows) for (const r of q.runs) L.push(`- ${q.name}, seed ${r.seed}: ${r.fair.doors.names.join(', ') || 'none shut'}`);
  if (MEETINGS) { L.push('', `## Every meeting, counted or dropped`, '', `One line per guard's first meeting. \`shown\` seconds are what each arm's eyes had of him in the ${F?.warnS ?? WARN_S} s before; under ${F?.seenS ?? SEEN_S} s is a SURPRISE. Then the ghost's door verbs and every guard's changes of state, so a dropped meeting can be traced to the noise that roused the man.`, '', '```'); for (const r of all) L.push(meetLines(r)); L.push('```'); }
  return L.join('\n') + '\n'; }
/** the deal's words out of a run's note (quiet.ts summary) */
const dealOf = (r: CoverOut): string => r.note.split(' · ').filter(w => /^(dealt|pinned -?\d+)$|^(start|patrol) |\(\d+\/\d+\)$/.test(w)).join(' · ');
/** a run dealt the list's deal: no pin, the first start, spot and patrol set */
const listedDeal = (r: CoverOut): boolean => { const d = dealOf(r); return /(^| · )dealt( · |$)/.test(d) && /start 1\//.test(d) && /\(1\/\d+\)/.test(d) && /patrol (1\/|all)/.test(d); };

// ───────────────────────────── A: an F7 replay, re-run off its run tape
async function tapeRun(path: string): Promise<CoverOut | string> {
  const raw = readFileSync(path), F: ReplayFile = JSON.parse(raw[0] === 0x1f && raw[1] === 0x8b ? new TextDecoder().decode(Bun.gunzipSync(raw)) : raw.toString('utf8'));
  await import('./headless.ts');   // (the harness first: entered through rerun.ts's own first import, journal.ts, src/game's import cycle does not load today — kit.ts reads STICKY as it loads)
  const { rerun, rerunWords } = await import('./rerun.ts'); const log = console.log, hush = () => { console.log = console.warn = () => { }; };
  let cov: Cover | null = null, last = 0, pending: Promise<void> | null = null, W0: Headless | null = null;
  // (the collector needs three game modules: asked for before the walk, made on its first step)
  const S = await import(`${ROOT}/src/game/stickycam.ts`), Fg = await import(`${ROOT}/src/game/fogofwar.ts`), T = await import(`${ROOT}/src/game/teams.ts`), Wd = await import(`${ROOT}/src/game/wand.ts`); void pending; void W0;
  hush(); const R = await rerun(F, { each: (W: Headless) => { const g = W.game; if (!cov) { cov = new Cover(g, { STICKY: S.STICKY, camLens: S.camLens, FOG: Fg.FOG, gazeOf: Fg.gazeOf, hostileTo: T.hostileTo, WAND: Wd.WAND, wandFits: Wd.wandFits, wandLens: Wd.wandLens }); last = g.time; }
    const dt = g.time - last; last = g.time; cov.tick(dt > 0 && dt < 1 ? dt : 0); } }); console.log = log;
  if (!R.W || !R.report) return `the re-run was refused: ${R.refuse}`;
  const words = rerunWords(R.report, F), d = R.report.drift;
  for (const w of words) log(w.length > 300 ? w.slice(0, 300) + ' …' : w);
  return (cov as Cover | null)!.finish({ label: flag('--label') ?? `tape:${basename(path).replace(/\.json(\.gz)?$/, '')}`, kind: 'tape', level: F.level.file ?? 'office.json', seed: F.seed ?? null, end: R.W.game.mission.stage,
    note: d ? `THE RE-RUN PARTED FROM THE PAGE at step ${d.n} (${d.who}): from there these are the re-run's own men, not the page's` : `re-run matches the page: ${R.report.compared} trace samples, worst ${R.report.worst ? R.report.worst.metres.toFixed(2) : '0.00'} m` }); }

// ───────────────────────────── B: the scripted ghost of solo-night.ts (--quiet --ghost, plan walk), its minimum copied: his feet, doors, the thing, the way out
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }
async function ghostRun(levelFile: string, seed: number, cap: number): Promise<CoverOut> {
  const { standUp } = await import('./headless.ts'), { levelOf } = await import('./rerun.ts'), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const log = console.log, err = console.error, warn = console.warn, hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  Math.random = seeded(0x9137 + seed * 7919);   // (solo-night.ts's own seeding)
  hush(); const W: any = await standUp({ uploadEvery: 4, level: await levelOf(levelFile) }); const g = W.game, I = W.input, cam = W.cam;
  g.godMode = true; g.playerInvisible = true; const query = `?quiet${DEAL ? `=${seed}` : ''}&quietfog=off`, r = startFromQuery(g, query); unhush();   // (every guard shown, no camera handed: the walk is the same whatever the quiet missions' default is, and nothing here reads the game's own fog)
  const cov = await coverFor(g), head = { label: `${LISTED ? 'listed' : 'ghost'}:${levelFile.replace(/\.json$/, '')}:${seed}`, kind: 'ghost' as const, level: levelFile, seed };
  const SS = await import(`${ROOT}/src/game/samestart.ts`), tail = (o: CoverOut): CoverOut => ({ ...o, query, samestart: !!SS.SAMESTART.on });
  if (r.why) return tail(cov.finish({ ...head, end: 'stalled', note: `the quiet mission did not start: ${r.why}` }));
  const M = g.level.mission, pos = (): number[] => g.player.char.pos, at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`; let t = 0, goal: Vec3 | null = null, end = 'stalled', why = '';
  function step(n = 1) { for (let i = 0; i < n; i++) {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
    if (goal && !g.player.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
      if (d > 0.12) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
    if (g.player.crouch && !g.player.takedown && !g.player.down && !g.player.picking) I.pressed.add('KeyC');
    W.step(DT); t += DT; cov.tick(DT);
    if (g.mission.stage === 'done') throw new Done('done', 'out');
    if (t >= cap) throw new Done('stalled', `time cap in stage ${g.mission.stage} at ${at(pos())}`); } }
  const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
  const cursor = (p: number[]) => W.cursorAt([p[0], p[1], p[2]]);
  const free = (p: number[]): Vec3 => { const nav = g.col.nav, q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
  const pathTo = (p: number[]): number[][] | null => g.col.nav.findPath(pos(), p, 8000);
  const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
    for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
      const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
      const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
    if (best) return best; a = b; } return null; };
  const everyone = (): any[] => [...g.guards, ...(g.civilians ?? [])];
  const inWay = (wp: number[]): any | null => { const me = pos(); let best: any = null, bd = 1.1; for (const x of everyone()) { const c = x.char; if (c.alive === false || x.state === 'dead') continue; const d = flat(c.pos, me);
    if (d < bd && (c.pos[0] - me[0]) * (wp[0] - me[0]) + (c.pos[2] - me[2]) * (wp[2] - me[2]) > 0) { bd = d; best = x; } } return best; };
  const pathRound = (p: number[], man: any): number[][] | null => { const c = g.col.nav.cell, m = man.char.pos; return g.col.nav.findPath(pos(), p, 8000, (ix: number, iz: number) => Math.hypot((ix + 0.5) * c - m[0], (iz + 0.5) * c - m[2]) < 1.0 ? 60 : 1); };
  const passes = (path: number[][], m: number[]): number => { let a = pos(), best = Infinity; for (const b of path) { const ux = b[0] - a[0], uz = b[2] - a[2], L2 = ux * ux + uz * uz, k = L2 > 1e-9 ? Math.max(0, Math.min(1, ((m[0] - a[0]) * ux + (m[2] - a[2]) * uz) / L2)) : 0;
    best = Math.min(best, Math.hypot(m[0] - a[0] - ux * k, m[2] - a[2] - uz * k)); a = b; } return best; };
  function go(p: number[], max: number, stop: (() => boolean) | null = null, again = 0, round: any = null): boolean {
    const path: number[][] = (round ? pathRound(p, round) : null) ?? pathTo(p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    const t0 = t; let mark = [...pos()], markT = t;
    for (const wp of path) { goal = [wp[0], 0, wp[2]];
      while (flat(pos(), wp) > (wp === path[path.length - 1] ? 0.3 : 0.55)) {
        cursor([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max || (stop && stop())) { goal = null; return false; }
        if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.2) {
          if (g.doors.list.some((d: any) => d.isClosed() && flat(pos(), d.frameCentre) < 1.6)) { goal = null; return false; }   // (a shut leaf: the caller opens it)
          const man = inWay(wp);
          if (man) { const alt = pathRound(p, man), m0 = [...man.char.pos]; if (alt && passes(alt, m0) > 0.8 && again < 5) return go(p, max - (t - t0), stop, again + 1, man);
            const me = pos(), dx = me[0] - m0[0], dz = me[2] - m0[2], L = Math.hypot(dx, dz) || 1, w0 = t; goal = [m0[0] + dx / L * 1.6, 0, m0[2] + dz / L * 1.6];
            while (flat(man.char.pos, m0) < 1.2 && man.char.alive !== false && man.state !== 'dead') { step(); if (goal && flat(pos(), goal) < 0.3) goal = null; if (t - w0 > 60 || (stop && stop())) { goal = null; return false; } }
            return go(p, max - (w0 - t0), stop, again); }
          if (again >= 5) { goal = null; return false; }
          const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, rr = 0.9 + 0.25 * again;
          goal = [pos()[0] + dz / L * sd * rr, 0, pos()[2] - dx / L * sd * rr]; step(35); return go(p, max - (t - t0), stop, again + 1); } } }
    goal = null; return true; }
  function doorVerb(d: any, verb: string): boolean { for (let i = 0; i < 40; i++) { cursor([d.frameCentre[0], 1.0, d.frameCentre[2]]); step();
    if (g.nearby.some((x: any) => x.kind === 'door' && x.door === d && x.verb === verb) && g.selectVerb('door', verb)) { I.pressed.add('Space'); cov.doorVerb(d, verb); step(2); return true; } } return false; }
  function openDoor(d: any): boolean {
    if (d.isClosed()) cov.doorMet(d);
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
    go(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, () => !d.isClosed()); if (!d.isClosed()) return true; if (flat(pos(), c) > 2.2) return false;
    const ring = () => { const P = g.player; return P.codes?.size ? new Set([...P.keys, ...P.codes]) : P.keys; };
    if (g.doors.lockedOut(d, pos(), ring())) {
      if (!doorVerb(d, 'pick')) { if (doorVerb(d, 'kick')) { until(() => !d.isClosed(), 4); return !d.isClosed(); } return false; }
      if (!until(() => !g.doors.lockedOut(d, pos(), ring()) || !d.isClosed(), 10)) return false; step(10); if (!d.isClosed()) return true; }
    for (const v of ['push', 'ease']) if (d.isClosed() && doorVerb(d, v)) { until(() => Math.abs(d.angle) > 0.9, 4); if (!d.isClosed()) return true; }
    return !d.isClosed(); }
  function travel(p: number[], max: number, stop: (() => boolean) | null = null): boolean {
    const t0 = t, failed = new Map<any, number>();
    for (let tries = 0; tries < 24 && t - t0 < max; tries++) {
      if (flat(pos(), p) < 0.35) return true; if (stop && stop()) return false;
      const d = doorOnPath(pathTo(p) ?? [p]);
      if (!d) { let ahead: any = null, k = 0; if (go(p, max - (t - t0), () => (stop ? stop() : false) || (++k % 15 === 0 && !!(ahead = doorOnPath(pathTo(p) ?? [p])) && flat(pos(), ahead.frameCentre) < 2.2))) return true; if (stop && stop()) return false;
        if (!ahead && !g.doors.list.some((x: any) => x.isClosed() && flat(pos(), x.frameCentre) < 1.6)) { const n = (failed.get(null) ?? 0) + 1; failed.set(null, n); if (n > 3) return false; } continue; }
      if (!openDoor(d)) { const n = (failed.get(d) ?? 0) + 1; failed.set(d, n); if (n >= 2) return false; continue; }
      const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? -1 : 1;
      go(free([c[0] + nx * s * 1.0, 0, c[2] + nz * s * 1.0]), 6, stop); }
    return flat(pos(), p) < 0.35; }
  hush();
  try {
    if (!M) throw new Done('stalled', 'this level has no mission block');
    step(20);
    const R = M.serverRoom, entry = g.doors.byName(M.entryDoor);
    const inside: Vec3 = free([Math.min(R.x1 - 0.8, Math.max(R.x0 + 0.8, entry ? entry.frameCentre[0] : (R.x0 + R.x1) / 2)), 0, entry ? (entry.frameCentre[2] > R.z1 - 0.5 ? R.z1 - 1.2 : entry.frameCentre[2] < R.z0 + 0.5 ? R.z0 + 1.2 : (R.z0 + R.z1) / 2) : (R.z0 + R.z1) / 2]);
    if (!travel(inside, 150, () => g.mission.stage !== 'infiltrate') && g.mission.stage === 'infiltrate') throw new Done('stalled', `never reached the room (at ${at(pos())})`);
    if (g.mission.stage === 'infiltrate') until(() => g.mission.stage !== 'infiltrate', 2);
    const rack = M.rack.front as number[]; let stand: Vec3 | null = null;
    for (const [dx, dz] of [[0, 0.65], [0, -0.65], [0.65, 0], [-0.65, 0], [0, 0.9], [0, -0.9]]) { const q: Vec3 = [rack[0] + dx, 0, rack[2] + dz]; if (!g.col.nav.isBlocked(q[0], q[2]) && pathTo(q)) { stand = q; break; } }
    if (!stand) stand = free([rack[0], 0, rack[2]]);
    if (!travel(stand, 40) && flat(pos(), rack) > 1.0) throw new Done('stalled', `could not reach the holder's face (at ${at(pos())})`);
    { let pressed = false; for (let i = 0; i < 9 * 60 && !g.mission.pulled; i++) { cursor(rack); if (!pressed && g.selectVerb('objective', 'drive')) { I.pressed.add('Space'); pressed = true; } step(); if (pressed && g.mission.driveT < 0 && !g.mission.pulled && i % 60 === 59) pressed = false; }
      if (!g.mission.pulled) throw new Done('stalled', 'the thing did not come out'); }
    let o: number[] = M.exfilOut ?? [1, 0], xx = M.exfilX, xz = M.exfilZ, xd = g.doors.byName(M.exfilDoor), bl = Infinity;
    for (const X of g.quiet.exits as any[]) { const p = pathTo([X.x - X.out[0] * 0.8, 0, X.z - X.out[1] * 0.8]); if (!p) continue; let l = 0, a = pos(); for (const b of p) { l += flat(a, b); a = b; } if (l < bl) { bl = l; o = X.out; xx = X.x; xz = X.z; xd = g.doors.byName(X.door); } }
    const ex: Vec3 = [xx + o[0] * 0.9, 0, xz + o[1] * 0.9];
    if (xd) { const c = xd.frameCentre; travel(free([c[0] - o[0] * 1.0, 0, c[2] - o[1] * 1.0]), 200); if (xd.isClosed()) openDoor(xd); }
    goal = ex; until(() => false, 1); travel(ex, 60); goal = ex; until(() => false, 6);
    throw new Done('stalled', `past the thing but never out (at ${at(pos())}, stage ${g.mission.stage})`);
  } catch (e) { if (e instanceof Done) { end = e.end; why = e.why; } else { end = 'error'; why = e instanceof Error ? `${e.message} ${(e.stack ?? '').split('\n').slice(1, 4).join(' | ')}` : String(e); } }
  unhush();
  return tail(cov.finish({ ...head, end, note: `${end === 'done' ? '' : `${why} · `}${String(g.quiet?.summary?.() ?? '')}` })); }

const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
if (TAPE) {
  const r = await tapeRun(resolve(TAPE)); if (typeof r === 'string') { console.log(r); process.exit(3); }
  console.log(table(r)); if (MEETINGS) console.log(meetLines(r)); file([r]); console.log(`→ ${OUT}`); process.exit(0);
} else if (has('--one')) {   // a child: one ghost run, its JSON to --outfile
  const r = await ghostRun(GHOST!, Number(flag('--one')), Number(flag('--cap') ?? 420)); writeFileSync(flag('--outfile')!, JSON.stringify(r)); process.exit(0);
} else {
  const seeds = seedsOf(flag('--seeds') ?? (LISTED ? '1' : '1-3')), jobs = Math.max(1, Number(flag('--jobs') ?? 3)), dir = mkdtempSync(resolve(tmpdir(), 'sticky-cover-')), pass = [...PASS.flatMap(n => flag(n) !== undefined ? [n, flag(n)!] : []), ...['--listed', '--loud', '--calm'].filter(has)];
  /** every (level, seed) as a child of its own, `jobs` at a time */
  async function ghosts(levels: string[]): Promise<{ runs: CoverOut[]; lost: string[] }> {
    const todo = levels.flatMap(level => seeds.map(seed => ({ level, seed }))), runs: CoverOut[] = [], lost: string[] = []; let next = 0;
    await Promise.all(Array.from({ length: jobs }, async () => { for (;;) { const job = todo[next++]; if (!job) return; const f = resolve(dir, `${job.level}.${job.seed}.json`);
      const pr = Bun.spawn(['bun', 'run', import.meta.path, '--ghost', job.level, '--one', String(job.seed), '--outfile', f, '--deal', DEAL ? 'seed' : 'die', ...pass], { stdout: 'ignore', stderr: 'pipe' }); const code = await pr.exited;
      try { runs.push(JSON.parse(readFileSync(f, 'utf8'))); } catch { const w = `${job.level}:${job.seed} — the run's process exited ${code}: ${(await new Response(pr.stderr).text()).slice(-500)}`; lost.push(w); console.log(`  ${w}`); } } }));
    runs.sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level) || (a.seed ?? 0) - (b.seed ?? 0)); return { runs, lost }; }
  if (!ALLQ) {
    const { runs } = await ghosts([GHOST!]); rmSync(dir, { recursive: true, force: true });
    for (const r of runs) { console.log(table(r)); if (MEETINGS) console.log(meetLines(r)); } if (runs.length > 1) { console.log(pooled(`ghost:${GHOST}`, runs)); console.log(armTable([{ name: GHOST!, runs }])); }
    file(runs); console.log(`→ ${OUT}`); process.exit(runs.length === seeds.length && runs.every(r => r.end !== 'error') ? 0 : 1);
  } else {
    const t0 = Date.now(), { runs, lost } = await ghosts(QUIET.map(q => q.level)); rmSync(dir, { recursive: true, force: true });
    const rows = QUIET.map(q => ({ name: `${q.level.replace(/\.json$/, '')} (${q.as})`, runs: runs.filter(r => r.level === q.level) })), mins = (Date.now() - t0) / 60000;
    for (const r of runs) { console.log(table(r)); if (MEETINGS) console.log(meetLines(r)); }
    if (LISTED) console.log(`THE LIST'S OWN DEAL (no pin; SAMESTART.on ${[...new Set(runs.map(r => String(r.samestart)))].join(' / ')}): ${runs.every(listedDeal) ? 'every run dealt start 1, spot 1, patrol 1' : 'NOT EVERY RUN DEALT start 1 / spot 1 / patrol 1 — read the deals below'}\n${runs.map(r => `  ${r.label}: ${dealOf(r)}`).join('\n')}`);
    const T = armTable(rows), ends = rows.map(q => `  ${q.name}: ${q.runs.map(r => `seed ${r.seed} ${r.end}${r.end === 'done' ? '' : ' — ' + r.note.split(' · ')[0]} ${f1(r.secs)} s`).join(' · ') || 'no run came back'}`).join('\n');
    console.log(T); console.log(`THE WALKS\n${ends}`); for (const w of lost) console.log(`  LOST: ${w}`); console.log(`run time ${mins.toFixed(1)} min, ${jobs} at a time`);
    file(runs); console.log(`→ ${OUT}`);
    const MD = flag('--md'); if (MD) { mkdirSync(dirname(resolve(MD)), { recursive: true }); writeFileSync(resolve(MD), markdown(rows, lost, mins, jobs, seeds)); console.log(`→ ${resolve(MD)}`); }
    process.exit(runs.length === QUIET.length * seeds.length && runs.every(r => r.end !== 'error') ? 0 : 1);
  }
}
