// The 'registry' family — the hostage rescue's own level (levels/registry.json ← tools/levels/registry.ts, its rescue in the file's `scenarios` block —
// rebuild/scenario-levels/contract.md), run through probes.ts, and the level's own TALLY:
//   bun run tools/qa/probes.ts registry | registry-level | registry-stage | registry-doors | registry-walk | registry-run
//   bun run tools/qa/registry-probes.ts tally [--styles rush,rush-f,flow,safe,safe-quiet,safe-side,crawl] [--seeds 1-32] [--jobs 3] [--cap 150] [--json out.json] [--md]
//   bun run tools/qa/registry-probes.ts trace flow:3            one run in this process with its timeline printed
// PASS / FAIL each, all headless (the Game of headless.ts stood up on the level — standUp({ level })). No GPU: no light meter (the CPU estimate of the direct
// light stands in, as it does for the office's tally), no smoke, nothing seen drawn. What the level LOOKS like is untested here.
//   registry-level   the file is the generator's level (0 diffs), the validator and the lint are clean on it, it is inside the renderer's fixed sizes, the rescue's
//                   data sits on its floor (rescue.ts checkRescue, the route's own check included); the two lines to the room measured along the nav grid
//   registry-stage   the rescue boots on it: the pair, Sam, two hostages, the captor and the door man on the level's marks, every inside door shut but the copy room's hall door (it stands open), ONE roamer —
//                   in the copy room or the reading room by the scenario's own coin (both seen over the seeds); nobody fires and no clock runs while Sam stands
//   registry-doors   stack room for the pair on every shut door a line to the room takes: the two men ordered onto each, from the side it is taken from, get onto
//                   their marks — on floor, apart, out of the opening
//   registry-walk    Sam walks every room and both approaches with the pair following, then again with FOUR following: every space entered, every door
//                   passed, everybody with him at the end; stuck man-frames and the closest two men ever came, the pair beside the four
//   registry-run     the level's tally on a few seeds: every run ends on the scenario's own result (no stall, no exception), and the level can be finished —
//                   a run with both hostages out — by the gallery and by the stacks. The counts per style are printed; they are not judged here
// THE TALLY is tools/qa/rescue-tally.ts's scripted player (the same hands, eyes and rules: its `Run`) given this level's floor and seven ways to play it:
//   rush     Sam sprints the gallery, boots the registrar's door and goes in first; no order
//   rush-f   the office's walkover: F at once, Sam sprints to the gallery's end and stays out of the hall
//   flow     down the gallery at a run with a look through the reading room's glass. A man seen in there: the pair are sent in after him. Nobody seen: he is
//            behind the blind wall — bang and clear on the copy room's door. Then F, Sam at the gallery's end
//   safe     the long way: the lobby's south door and the sorting room's door are locked against Sam — booted (a second each, loud); round the stacks at a
//            run with the pair; F from the sorting room (the two-door go: one man on the side door, the other round by the stacks' hall door to the main door)
//   safe-quiet  the same with both locks picked (4.2 s each, quiet)
//   safe-side   safe (booted), but both men go through the side door on the door tools' bang and clear: nobody goes round to the main door
//   crawl    every room on the way in order — reading room, copy room, the hall — then F
// (and two more for a question each: flow-pass = flow's look with neither room cleared, flow-open = the copy room opened without a can.)
// One process a run (the scenario's knobs and the team's start are module state). Numbers order the styles against each other on game logic; a bot's reaction
// and dead-centre cursor are not a person's.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { Run, Done, BOT, type RunOut, type Grade } from './rescue-tally.ts';
const { RESCUE, checkRescue } = await import(`${ROOT}/src/game/rescue.ts`);
const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);   // (while every mission starts the same way the roamer's coin is not thrown: registry-stage reads the rule and asks for the stage it gives)
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { SQUAD4_BUDGET } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData, validateLevelData, structuralDiff } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lintLevel } = await import(`${ROOT}/src/editor/lint.ts`);
const { build: buildRegistry, REGISTRY_ROOMS } = await import(`${ROOT}/tools/levels/registry.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { BoxFlag, MAX_GLASS } = await import(`${ROOT}/src/scene/boxes.ts`);

type Vec3 = [number, number, number];
type Rect = { x0: number; x1: number; z0: number; z1: number };
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number | null | undefined) => (x !== null && x !== undefined && Number.isFinite(x) ? x.toFixed(1) : '—'), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pct = (n: number, d: number) => (d ? `${Math.round(100 * n / d)} %` : '—');
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const inRect = (p: number[], b: Rect, m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** a probe that throws is a FAIL with its first lines, not a dead family; whatever it did to the scenario's knobs is put back */
const { samAt: _a, samYaw: _b, opsAt: _c, ...KNOBS0 } = { ...RESCUE } as any;   // (not the team-start knobs: they are the staged level's — rescue.ts start() writes them)
function guarded(fn: () => Promise<boolean>): () => Promise<boolean> {
  return async () => { const log = console.log; try { return await fn(); } catch (e: any) { console.log = log; console.log(`- FAIL — the probe threw\n    ${String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ')}`); return false; } finally { console.log = log; Object.assign(RESCUE, KNOBS0); } };
}

// ---------------------------------------------------------------- the level
const FILE = `${ROOT}/levels/registry.json`;
const fileText = () => readFileSync(FILE, 'utf8');
const fileLevel = () => loadLevel(parseLevelData(fileText()));
const ROOMS = REGISTRY_ROOMS as Record<string, Rect>;
const SPACE_WORDS: Record<string, string> = { lobby: 'lobby', gallery: 'gallery', reading: 'reading room', copy: 'copy room', hall: 'hall', office: "registrar's office", stacks: 'stacks', sorting: 'sorting room' };
/** the space a point is in (a man standing in a doorway is in neither: the nearer of the two within a stride) */
function spaceOf(p: number[]): string { for (const [k, r] of Object.entries(ROOMS)) if (inRect(p, r)) return k; for (const [k, r] of Object.entries(ROOMS)) if (inRect(p, r, 0.4)) return k; return 'outside'; }
const wordsOf = (p: number[]) => SPACE_WORDS[spaceOf(p)] ?? 'outside';
async function stand(seed: number): Promise<any> {
  Object.assign(RESCUE, KNOBS0); Math.random = seeded(0x7e5c + seed * 7919);   // (the office tally's own seeding: a seed names the same dice on both levels)
  const W: any = await standUp({ uploadEvery: 2, level: fileLevel() }); const g = W.game;
  g.tune.chaos = 0.5; g.fogOfWar.on = true;   // (the page's own defaults under ?rescue: main.ts)
  return W;
}
async function quiet<T>(on: boolean, fn: () => Promise<T>): Promise<T> { const log = console.log; if (on) console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

/** The floor as a player knows it (tools/levels/registry.ts has the drawing). */
const AT = {
  /** the gallery: its mouth, beside the reading room's glass, between the two doors, in front of the copy room's door (off to its west: out of its opening) */
  mouth: [10.8, 0, 11.6] as Vec3, glass: [12.6, 0, 11.7] as Vec3, between: [17.6, 0, 11.6] as Vec3, copyFront: [18.4, 0, 11.9] as Vec3,
  /** the gallery's end, short of the hall, on its south side: Sam's post while the pair are on the door (it sees the main door, the counter and whoever steps
   *  out of the copy room's hall door) — and what he watches from it */
  post: [23.5, 0, 12.2] as Vec3, door: [28.9, 1.1, 6.0] as Vec3, west: [10.5, 1.1, 11.0] as Vec3,
  /** in front of the main door, and two steps inside it */
  doorFront: [27.9, 0, 6.0] as Vec3, in1: [30.2, 0, 6.0] as Vec3, in2: [31.2, 0, 7.4] as Vec3, captor: [33.8, 1.1, 10.6] as Vec3,
  /** a spot inside each room on the way */
  reading: [15.4, 0, 8.6] as Vec3, readingLook: [12.5, 1.1, 6.5] as Vec3, copy: [21.2, 0, 8.9] as Vec3, hall: [26.5, 0, 9.6] as Vec3,
  /** the long way: the lobby's south door, the four turns round the rows, the sorting room's door, inside it short of the side door */
  lobbyS: [8.9, 0, 18.0] as Vec3, stacksW: [11.4, 0, 18.4] as Vec3, turn1: [13.2, 0, 21.9] as Vec3, turn2: [16.8, 0, 14.9] as Vec3, turn3: [20.4, 0, 21.9] as Vec3, turn4: [24.0, 0, 14.9] as Vec3,
  sortingW: [27.2, 0, 16.2] as Vec3, sorting: [31.2, 0, 14.9] as Vec3, side: [32.6, 1.1, 12.8] as Vec3, sideFront: [32.6, 0, 13.8] as Vec3, rear: [29.1, 1.1, 16.2] as Vec3, rearPost: [33.2, 0, 15.6] as Vec3, sideIn: [32.5, 0, 11.7] as Vec3, stacksN: [25.2, 0, 14.2] as Vec3,
};
const ROUND: Vec3[] = [AT.stacksW, AT.turn1, AT.turn2, AT.turn3, AT.turn4, AT.sortingW], SERPENTINE: Vec3[] = [AT.lobbyS, ...ROUND, AT.sorting];
function pathLen(g: any, pts: Vec3[]): number { let L = 0; for (let i = 1; i < pts.length; i++) { const p: Vec3[] | null = g.col.nav.findPath(pts[i - 1], pts[i]); if (!p) return NaN; let a = pts[i - 1]; for (const b of [...p, pts[i]]) { L += flat(a, b); a = b; } } return L; }

// ---------------------------------------------------------------- the scripted player on this floor
/** rescue-tally.ts's player with this level's end game: the same hands (keys, cursor, trigger), eyes (the fog of war, the screen, a clear line) and rules. */
class Player extends Run {
  constructor(W: any, seed: number, cap: number, verbose: boolean) {
    super(W, seed, cap, verbose, 'estimate');
    this.roamerAt = this.R.hostiles.slice(2).map((h: any) => wordsOf(h.char.pos)).join(' + ') || 'none';
  }
  /** (the falls are filed with the OFFICE's room names — chronicle.ts roomOf; put this floor's on them) */
  step(n = 1) {
    const k = this.falls.length;
    try { super.step(n); } finally { if (this.firstBang === null && this.g.events.some((e: any) => e.kind === 'bang' && inRect(e.pos, this.B, 1.5))) this.firstBang = this.clock;
      for (let i = k; i < this.falls.length; i++) { const f = this.falls[i], who = f.side === 'sam' ? this.g.player : [...this.R.ops, ...this.R.hostiles, ...this.R.hostages].find((x: any) => x.callsign === f.who); if (who) f.where = wordsOf(who.char.pos); } }
  }
  say(s: string) {   // (and the DOWN lines are worded with the office's rooms: this floor's)
    const m = /^DOWN (.+?)( \(\w+\))? in the .*? by (.*)$/.exec(s), who = m && (m[1] === 'Sam' ? this.g.player : [...this.R.ops, ...this.R.hostiles, ...this.R.hostages].find((x: any) => x.callsign === m[1]));
    super.say(m && who ? `DOWN ${m[1]}${m[2] ?? ''} in the ${wordsOf(who.char.pos)} by ${m[3]}` : s);
  }
  /** notes a run leaves for the table's reader (a pick that did not take, …) */
  notes: string[] = [];
  /** the first stun charge to go off in the hostage room, whoever threw it (the scenario's log has F's bangs; a door tool's is only a game event) */
  firstBang: number | null = null;
  /** (an order with nobody left to take it is not given: a plan that runs on after the pair are down is not a refusal) */
  order(id: string, target: any, who: 'all' | number = 'all'): boolean { if (!this.O.squad().some((m: any) => m.state !== 'dead')) { this.say(`(nobody left to order: ${id})`); return false; } return super.order(id, target, who); }
  get B(): Rect { return this.R.bounds; }
  /** a locked door Sam is locked out of, from where he stands in front of it: booted (a second, and the floor hears it) or picked (4.2 s planted, quiet) */
  unlock(name: string, how: 'kick' | 'pick'): boolean {
    const d = this.door(name), out = () => this.g.doors.lockedOut(d, this.pos, this.g.player.keys); if (!out()) return true;
    if (how === 'kick') return this.kick(name);
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), sgn = (this.pos[0] - c[0]) * nx + (this.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
    this.watch = [c[0], 1.1, c[2]]; this.go([c[0] + nx * sgn * 0.95, 0, c[2] + nz * sgn * 0.95], { max: 6 });   // up to the leaf, on his own side of it, at a walk (a sprint into a locked door is a boot)
    for (let i = 0; i < 2 && out(); i++) {
      const ok = this.until(() => this.g.selectVerb('door', 'pick'), 0.8);
      if (ok) { this.I.pressed.add(INTERACT_KEY); this.say(`Sam picks the ${name} door`); this.until(() => !out(), 7); } else this.say(`(no pick row on the ${name} door)`);
    }
    if (out()) { this.notes.push(`the pick on '${name}' did not take: booted`); return this.kick(name); }   // (said in the run's note: a quiet run that was not)
    return true;
  }
  get roomHeld(): boolean { return this.R.hostiles.some((h: any) => h.state !== 'dead' && inRect(h.char.pos, this.B)); }
  /** a defender the team's picture shows in a space right now */
  shownIn(space: string): any { return this.R.hostiles.find((h: any) => this.shown(h) && inRect(h.char.pos, ROOMS[space])) ?? null; }
  /** THE END GAME every style shares once its own plan is spent (rescue-tally.ts finish, on this floor): the room still theirs and the pair free → F again;
   *  the room empty of them and nobody of ours in it → the pair sent in; the pair gone → Sam takes the main door himself. Runs until the scenario ends. */
  finish(o: { reorder: boolean; post: Vec3 | null; watch: Vec3 | null; again?: () => void }) {
    const me = this as any; let self = false;   // (me.lastF: the base's own debounce stamp, private there — read and written here so F and this end game share one clock)
    for (;;) {
      const R = this.R, ops = this.ops;
      if (R.state === 'secured') { this.step(); continue; }
      if (!ops.length && !self) { self = this.solo = true; this.say('the pair are down — Sam takes the room himself'); }
      if (self) { this.shootOnMove = true; if (!inRect(this.pos, this.B)) { this.watch = null;
          if (['sorting', 'stacks'].includes(spaceOf(this.pos))) { this.go(AT.sideFront, { max: 25 }); this.watch = AT.captor; this.go(AT.sideIn, { max: 6 }); }   // from the long line: by the side door he is at
          else { this.go(AT.doorFront, { max: 25 }); if (!this.kick('office')) this.wait(0.5); this.go(AT.in1, { max: 6 }); this.go(AT.in2, { max: 6 }); } }
        this.watch = AT.captor; this.wait(1); continue; }
      if (!this.onTheDoor && this.t - me.lastF > 3) {
        if (this.roomHeld) { if (o.again) { me.lastF = this.t; o.again(); } else if (o.reorder) this.F(); }
        else if (!ops.some((m: any) => inRect(m.char.pos, this.B)) && !inRect(this.pos, this.B)) { me.lastF = this.t; this.order('move', this.floorT(AT.in2)); }
      }
      if (o.post && flat(this.pos, o.post) > 0.6 && !this.target) { this.watch = null; this.go(o.post, { max: 6 }); }
      this.watch = o.watch; this.step(6);
    }
  }
}

// ---------------------------------------------------------------- the styles
/** RUSH: sprint the gallery, boot the registrar's door and go in first. No bang, no order; the pair come on behind unasked. */
function rush(R: Player) {
  R.shootOnMove = true;
  R.go(AT.mouth, { sprint: true }); R.go(AT.doorFront, { sprint: true });
  R.kick('office');
  R.go(AT.in1, { max: 6 }); R.go(AT.in2, { max: 6 }); R.watch = AT.captor;
  R.finish({ reorder: false, post: null, watch: AT.captor });
}
/** RUSH-F (the office's walkover): the one word at once, Sam sprints to the gallery's end without a look at anything and stays out of the hall. */
function rushF(R: Player) {
  R.watch = AT.door; R.F(); R.go(AT.mouth, { sprint: true }); R.go(AT.post, { sprint: true });
  R.finish({ reorder: true, post: AT.post, watch: AT.door });
}
/** FLOW: the look through the glass decides which room is cleared on the way. `pass`: the look is taken and nothing is done about it. `open`: the copy room is
 *  opened without a can (the cans kept for the hostage room). */
function flow(R: Player, o: { pass?: boolean; open?: boolean } = {}) {
  let seen: any = null; const look = () => { seen ??= R.shownIn('reading'); return false; };
  R.watch = AT.readingLook; R.go(AT.mouth, { sprint: true, until: look }); R.go(AT.glass, { sprint: true, until: look }); look();
  if (o.pass) R.say(seen ? 'a man behind the glass — passed' : 'nobody behind the glass — the copy room is passed');
  else if (seen) {
    R.say('a man behind the glass — the pair go in after him'); R.order('move', R.floorT(AT.reading)); R.watch = AT.west;
    R.until(() => seen.state === 'dead', 8); R.say(seen.state === 'dead' ? 'he is down — on' : 'they have not got him — on');
    R.order('fallIn', R.noneT()); R.watch = AT.door; R.until(() => R.ops.some((m: any) => m.char.pos[2] > 10.1 && flat(m.char.pos, R.pos) < 3), 5);
  } else {
    R.say('nobody behind the glass — he is behind the blind wall: the copy room first');
    R.watch = AT.door; R.go(AT.copyFront, { sprint: true });
    R.tool(o.open ? 'openClear' : 'bangClear', 'copy'); R.wait(0.5);
  }
  R.watch = AT.door; R.F(); R.go(AT.post, { sprint: true });
  R.finish({ reorder: true, post: AT.post, watch: seen && seen.state !== 'dead' ? AT.west : AT.door });
}
/** SAFE: the long way round, at a run with the pair, the two locked doors BOOTED (a second each, and the floor hears it), and F from the sorting room (the
 *  two-door go). `pick`: the locks picked instead — 4.2 s each, quiet. `side`: both men through the side door on the door tools' bang and clear instead —
 *  nobody goes round to the main door. */
function safe(R: Player, o: { pick?: boolean; side?: boolean } = {}) {
  const how = o.pick ? 'pick' : 'kick';
  R.order('fallIn', R.noneT()); R.go(AT.lobbyS, { sprint: true }); R.unlock('stacks_w', how);
  for (const p of ROUND) R.go(p, { sprint: true });
  R.unlock('sorting', how); R.go(AT.sorting, { sprint: true });
  R.watch = AT.side; R.until(() => R.ops.every((m: any) => inRect(m.char.pos, ROOMS.sorting)), 6);
  // the door is the pair's; Sam is the rear man — back from it, his gun on the door they came in by (a boot on the way has the floor coming to look)
  if (o.side) {   // (the tool's order is given once and left to run: asked again only when no bang and clear is under way on that door)
    const d = R.g.doors.byName('office_side'), again = () => { if (!R.g.doorTools.ops.some((op: any) => op.door === d)) R.order('bangClear', R.doorT('office_side')); };
    again(); R.finish({ reorder: true, post: AT.rearPost, watch: AT.rear, again });
  }
  R.F(); R.finish({ reorder: true, post: AT.rearPost, watch: AT.rear });
}
/** CRAWL: every room on the way, in order — the reading room, the copy room (a can each), the hall — and only then the hostage room, with the last can. */
function crawl(R: Player) {
  R.watch = AT.door; R.go(AT.mouth);
  R.tool('bangClear', 'reading'); R.wait(1.5);
  R.order('fallIn', R.noneT()); R.go(AT.copyFront);
  R.tool('bangClear', 'copy'); R.wait(1.5);
  R.order('move', R.floorT(AT.hall)); R.until(() => R.set(), 8); R.wait(1.5);
  R.F(); R.go(AT.post); R.finish({ reorder: true, post: AT.post, watch: AT.door });
}
export const STYLES: Record<string, { run: (R: Player) => void; words: string }> = {
  rush: { run: rush, words: "Sam sprints the gallery, boots the registrar's door and goes in first, shooting as he goes; no order, no bang; the pair come on behind unasked" },
  'rush-f': { run: rushF, words: "F at once (the pair bang and clear the registrar's office through its main door); Sam sprints to the gallery's end without a look at anything and stays out of the hall" },
  flow: { run: R => flow(R), words: "down the gallery at a run looking through the reading room's glass: a man seen in there has the pair sent in after him; nobody seen means he is behind the blind wall, and the copy room gets a bang and clear; then F, Sam at the gallery's end" },
  safe: { run: R => safe(R), words: 'the long way: the lobby\'s south door booted, round the stacks at a run with the pair, the sorting room\'s door booted; F from in there (one man on the side door, the other round by the stacks\' hall door to the main door, on one signal)' },
  'safe-quiet': { run: R => safe(R, { pick: true }), words: 'safe, but both locks are picked (4.2 s each, quiet) instead of booted' },
  crawl: { run: crawl, words: 'bang and clear on the reading room, then on the copy room, the pair walked into the hall, a wait for quiet after each — then F with the last can' },
  'flow-pass': { run: R => flow(R, { pass: true }), words: 'flow, but nothing is done about what the glass shows: neither room is cleared on the way (the look costs no time: it is taken on the run)' },
  'flow-open': { run: R => flow(R, { open: true }), words: 'flow, but the copy room is opened without a can (open and clear)' },
  'safe-side': { run: R => safe(R, { side: true }), words: 'safe (booted), but both men go through the side door on a bang and clear and nobody goes round to the main door' },
};
export const HEADLINE = ['rush', 'rush-f', 'flow', 'safe', 'safe-quiet', 'safe-side', 'crawl'];

/** One run, in this process (call it once a process: the scenario's knobs and the team's start are module state). */
export async function play(style: string, seed: number, cap = 150, verbose = false): Promise<RunOut & { trace: string[] }> {
  const log = console.log, err = console.error; if (!verbose) console.log = () => {};
  let R: Player | null = null, note = '', grade: Grade = 'error', why = '';
  try {
    const W = await stand(seed); const g = W.game;
    const no = g.rescue.start(); if (no) throw new Error(`start refused: ${no}`);
    R = new Player(W, seed, cap, verbose);
    if (g.player.rifle.mode !== undefined && g.player.rifle.mode !== 'semi') g.player.rifle.mode = 'semi';
    try { R.step(20); STYLES[style].run(R); R.until(() => false, cap); } catch (e) { if (!(e instanceof Done)) throw e; why = e.why; }
    const res = R.R.result; grade = res ? res.grade : 'stalled'; if (res) why = res.why;
  } catch (e: any) { grade = 'error'; note = String(e?.stack ?? e).split('\n').slice(0, 4).join(' | '); }
  finally { console.log = log; console.error = err; }
  const RS = R?.R;
  return { style, seed, grade, why, hostages: R ? R.hostagesUp : 0, pair: R ? R.ops.length : 0, sam: R ? !R.sam.down : false, bang: R ? R.firstBang : null, secured: R ? R.atLast('secured') : null, end: R ? R.clock : 0,
    resolveSecs: RS?.resolveSecs ?? NaN, roamer: R ? R.roamerAt : '', falls: R?.falls ?? [], rounds: R?.rounds ?? {}, orders: R?.orders ?? 0, refused: R?.refused ?? [], note: note || (R?.notes ?? []).join(' · '), solo: R?.solo ?? false, split: R ? R.at(/^split:front=.*side=/) !== null : false, trace: R?.trace ?? [] };
}
/** every (style, seed) in its own process, `jobs` at a time */
async function playAll(styles: string[], seeds: number[], jobs: number, cap: number, each?: (r: RunOut) => void): Promise<RunOut[]> {
  const todo = styles.flatMap(style => seeds.map(seed => ({ style, seed }))), runs: RunOut[] = []; let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
    while (next < todo.length) {
      const job = todo[next++];
      const proc = Bun.spawn(['bun', 'run', import.meta.path, 'worker', job.style, String(job.seed), String(cap), String(BOT.react)], { stdout: 'pipe', stderr: 'pipe' });
      const kill = setTimeout(() => proc.kill(), 300_000);
      const [text, errText] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]); await proc.exited; clearTimeout(kill);
      const line = text.split('\n').find(l => l.startsWith('RESULT '));
      const r: RunOut = line ? JSON.parse(line.slice(7)) : { style: job.style, seed: job.seed, grade: 'error', why: '', hostages: 0, pair: 0, sam: false, bang: null, secured: null, end: 0, resolveSecs: NaN, roamer: '', falls: [], rounds: {}, orders: 0, refused: [], solo: false, split: false, note: `worker died (${proc.exitCode}): ${errText.slice(-300)}` };
      runs.push(r); each?.(r);
    }
  }));
  return runs.sort((a, b) => styles.indexOf(a.style) - styles.indexOf(b.style) || a.seed - b.seed);
}

// ---------------------------------------------------------------- the tables
function table(rows: string[][], md: boolean): string {
  if (md) return [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(r => `| ${r.join(' | ')} |`).join('\n');
  const w = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length))); return rows.map(r => r.map((x, c) => (c ? x.padStart(w[c]) : x.padEnd(w[c]))).join('  ')).join('\n');
}
const came = (r: RunOut) => r.grade === 'clean' || r.grade === 'costly';
const tallyOf = (xs: string[]) => { const m: Record<string, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ') || '—'; };
export function report(runs: RunOut[], styles: string[], md = false): string {
  const out: string[] = [];
  const rows = [['style', 'runs', 'clean', 'costly', 'failed', 'hostages saved', 'Sam down', 'pair lost', 'came off with nobody lost', 'bang at, s', 'room held at, s', 'rounds Sam : pair : them']];
  for (const s of styles) {
    const all = runs.filter(r => r.style === s), n = all.length; if (!n) continue; const rs = all.filter(r => r.grade !== 'error'), c = (g: Grade) => all.filter(r => r.grade === g).length;
    const sum = (f: (r: RunOut) => number) => rs.reduce((a, r) => a + f(r), 0), bangs = rs.filter(r => r.bang !== null).map(r => r.bang!), secs = rs.filter(r => r.secured !== null && came(r)).map(r => r.secured!);
    rows.push([s, String(n), `${c('clean')} (${pct(c('clean'), n)})`, String(c('costly')), `${c('failed')}${c('stalled') ? ` + ${c('stalled')} stalled` : ''}${c('error') ? ` + ${c('error')} errors` : ''}`, `${sum(r => (came(r) ? r.hostages : 0))}/${2 * n}`, String(rs.filter(r => !r.sam).length),
      String(rs.flatMap(r => r.falls).filter(f => f.side === 'pair').length), `${rs.filter(r => came(r) && r.pair === 2 && r.sam).length} (${pct(rs.filter(r => came(r) && r.pair === 2 && r.sam).length, n)})`, f1(median(bangs)), f1(median(secs)),
      `${Math.round(sum(r => r.rounds.sam ?? 0) / (rs.length || 1))} : ${Math.round(sum(r => r.rounds.pair ?? 0) / (rs.length || 1))} : ${Math.round(sum(r => r.rounds.defenders ?? 0) / (rs.length || 1))}`]);
  }
  out.push('THE RESCUE ON THE REGISTRY, per style (clean = both hostages alive and the room held; costly = one; failed = none, a hostage hit by Sam, or Sam down)', table(rows, md));
  const wr = [['style', 'not clean', 'Sam down', 'both hostages shot', 'one hostage shot', 'own fire', 'stalled / error', 'Sam fell in', 'the pair fell in', 'to whom']];
  for (const s of styles) {
    const all = runs.filter(r => r.style === s); if (!all.length) continue; const rs = all.filter(r => r.grade !== 'clean'), k = (f: (r: RunOut) => boolean) => String(rs.filter(f).length), falls = all.flatMap(r => r.falls);
    wr.push([s, String(rs.length), k(r => !r.sam && r.grade !== 'error'), k(r => r.sam && r.grade === 'failed' && /both/.test(r.why)), k(r => r.grade === 'costly'), k(r => /own fire/.test(r.why)), k(r => r.grade === 'stalled' || r.grade === 'error'),
      tallyOf(falls.filter(f => f.side === 'sam').map(f => f.where)), tallyOf(falls.filter(f => f.side === 'pair').map(f => f.where)), tallyOf(falls.filter(f => f.side !== 'defender' && f.side !== 'hostage').map(f => f.by))]);
  }
  out.push('', 'WHY NOT CLEAN, AND WHERE THE TEAM FELL', table(wr, md));
  const places = [...new Set(runs.map(r => r.roamer).filter(Boolean))].sort();
  if (places.length > 1) {
    const pr = [['style', ...places.map(p => `roamer in the ${p}: clean`)]];
    for (const s of styles) { if (!runs.some(r => r.style === s)) continue; pr.push([s, ...places.map(p => { const of = runs.filter(r => r.style === s && r.roamer === p); return `${of.filter(r => r.grade === 'clean').length}/${of.length}`; })]); }
    out.push('', 'BY WHERE THE ROAMER STOOD (the scenario\'s own coin: behind the blind wall or behind the glass)', table(pr, md));
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- registry-level
export const registryLevel = guarded(async () => {
  const { verdict, done } = family('registry-level: the file, the lint, the sizes, the rescue\'s data on its floor, the two lines measured');
  const text = fileText(), data = parseLevelData(text), errs: string[] = validateLevelData(data);
  verdict(errs.length === 0, 'the file validates', errs.length ? errs.slice(0, 6).join(' · ') : `${data.boxes.length} boxes · ${data.doors.length} doors · ${data.props.length} props · ${data.lights.length} light + ${data.switchables.length} switchables · scenarios ${Object.keys(data.scenarios ?? {}).join(', ')}`);
  const gen = buildRegistry(); gen.level.scenarios = gen.scenarios; { const DS = await import('../../src/scene/doorSize.ts'); DS.fitDoors(gen.level.doors); DS.fitWaysOut(gen.level, (gen.scenarios as any)?.quiet); }   // (as tools/levels/export.ts writes it: the leaves and the ways out fitted to the real doors)
  { const FL = await import('../levels/flatLayers.ts'), LV = await import('../../src/scene/lived.ts'); FL.layGeneratedFloor(gen.level.boxes, gen.groups, LV.isLived, BoxFlag); }   // (… and its floor swept into order, as the export sweeps it before it writes: flatLayers.ts)
  const diffs: string[] = []; const n = structuralDiff(gen.level, loadLevel(data, { lived: true }), diffs);   // (the generator builds the lived-in rooms' furniture: src/scene/lived.ts)
  verdict(n === 0, 'the file is the generator\'s level (tools/levels/registry.ts build → the same Level, field for field)', n ? `${n} diffs: ${diffs.slice(0, 4).join(' · ')} — bun run tools/levels/export.ts registry` : '0 diffs');
  const lint = lintLevel(data), bad = lint.findings.filter((f: any) => f.severity !== 'info');
  verdict(lint.errors === 0 && lint.warnings === 0, 'the level lint is clean (no error, no warning)', bad.length ? bad.slice(0, 5).map((f: any) => `${f.severity}: ${f.message}`).join(' · ') : `${lint.infos} notes in all`);
  const L = loadLevel(data), glass = L.boxes.filter((b: any) => (b.flags ?? 0) & BoxFlag.Glass).length, out = L.boxes.filter((b: any) => b.c[0] - b.h[0] < WORLD.min[0] - 1e-6 || b.c[0] + b.h[0] > WORLD.max[0] + 1e-6 || b.c[2] - b.h[2] < WORLD.min[2] - 1e-6 || b.c[2] + b.h[2] > WORLD.max[2] + 1e-6 || b.c[1] - b.h[1] < WORLD.min[1] - 1e-6 || b.c[1] + b.h[1] > WORLD.max[1] + 1e-6).length;
  verdict(L.boxes.length <= WORLD.maxBoxes && glass <= MAX_GLASS && out === 0, "inside the renderer's fixed sizes: the world box, the box count, the glass panes", `${L.boxes.length} boxes of ${WORLD.maxBoxes} · ${glass} glass panes of ${MAX_GLASS} · ${out} boxes outside the world box (the office: 782 boxes, 22 panes)`);
  const W = await quiet(true, () => stand(1)), g = W.game, S = g.level.scenarios.rescue;
  const was: string[] = checkRescue(g);
  verdict(was.length === 0, "the rescue's data sits on the floor (checkRescue, the route's own check included)", was.length ? was.join(' · ') : 'every mark where a man can be stood, clear of the furniture; the room\'s men inside it; a way on foot to every mark; the route\'s two openings each with a stand and a watch');
  const main = g.doors.byName(S.room.door).frameCentre, fast = pathLen(g, [S.team.sam, [main[0] - 1.0, 0, main[2]]]), long = pathLen(g, [S.team.sam, ...SERPENTINE, [S.side.hold[0], 0, S.side.hold[2] + 0.6]]);
  verdict(fast > 15 && long > fast * 1.8, 'two lines to the room, the long one at least 1.8 × the short one', `the gallery: ${f1(fast)} m from Sam's mark to the main door · the stacks: ${f1(long)} m to the side door (${f2(long / fast)} ×) — at his sprint (4.7 m/s) ${f1(fast / 4.7)} s and ${f1(long / 4.7)} s of a ${RESCUE.resolveSecs} s clock`);
  return done();
});

// ---------------------------------------------------------------- registry-stage
export const registryStage = guarded(async () => {
  const { verdict, done } = family('registry-stage: the rescue boots on the level — the cast on its marks, the roamer\'s coin, nothing moves until Sam does');
  const bad: string[] = [], where: string[] = []; let rounds = 0, clocks = 0, chars = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const W = await quiet(true, () => stand(seed)), g = W.game, S = g.level.scenarios.rescue, R = g.rescue;
    const why = await quiet(true, async () => R.start()); if (why) { bad.push(`seed ${seed}: start refused — ${why}`); continue; }
    const near = (who: string, p: number[], m: number[]) => { if (flat(p, m) > 0.6) bad.push(`seed ${seed}: ${who} is ${f1(flat(p, m))} m off the mark`); };
    if (R.ops.length !== 2) bad.push(`seed ${seed}: ${R.ops.length} teammates`); R.ops.forEach((o: any, i: number) => near(o.callsign, o.char.pos, S.team.ops[i])); near('Sam', g.player.char.pos, S.team.sam);
    if (R.hostages.length !== 2) bad.push(`seed ${seed}: ${R.hostages.length} hostages`); R.hostages.forEach((h: any, i: number) => { near(`hostage ${i + 1}`, h.char.pos, S.hostages[i].pos); if (!inRect(h.char.pos, R.bounds)) bad.push(`seed ${seed}: hostage ${i + 1} outside the room`); });
    if (R.hostiles.length !== 3) bad.push(`seed ${seed}: ${R.hostiles.length} of theirs, not 3`);
    if (R.hostiles[0]) near('the captor', R.hostiles[0].char.pos, S.captor.pos); if (R.hostiles[1]) near('the door man', R.hostiles[1].char.pos, S.doorMan.outside.pos);
    const ro = R.hostiles[2]; if (ro) { const sp = spaceOf(ro.char.pos); where.push(sp); if (sp !== 'copy' && sp !== 'reading') bad.push(`seed ${seed}: the roamer is in the ${SPACE_WORDS[sp] ?? sp}`); }
    for (const d of g.doors.list) if (!d.def.exterior && d.def.name !== 'copy_hall' && Math.abs(d.angle) > 0.05) bad.push(`seed ${seed}: door '${d.def.name}' is open at the staging`);
    if (Math.abs(g.doors.byName('copy_hall').angle) < 0.8) bad.push(`seed ${seed}: the copy room's hall door is not standing open`);
    chars = Math.max(chars, 1 + g.guards.length + (g.civilians?.length ?? 0)); if (1 + g.guards.length + (g.civilians?.length ?? 0) > 8) bad.push(`seed ${seed}: ${1 + g.guards.length + (g.civilians?.length ?? 0)} characters staged — over the shadow budget of 8`);
    const seen = new Set<any>(); await quiet(true, async () => { for (let i = 0; i < 300; i++) { W.step(DT); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'guardShot' || e.kind === 'shot') rounds++; } } });
    if (!isNaN(R.t0)) clocks++; if (R.result) bad.push(`seed ${seed}: over before Sam moved — ${R.result.why}`);
    Object.assign(RESCUE, KNOBS0);
  }
  verdict(bad.length === 0, 'staged on eight seeds: the pair and Sam inside the front door, two hostages and the captor in the registrar\'s office, the door man behind the hall\'s counter, every inside door shut but the copy room\'s hall door (left standing open)', bad.length ? bad.slice(0, 6).join(' · ') : `${chars} characters at most (the shadow budget is 8)`);
  const nc = where.filter(w => w === 'copy').length, nr = where.filter(w => w === 'reading').length;
  // (the same start rule on = the roamer on the level's own mark on every seed, no coin; off = the coin, both rooms seen. ROAMER_BREAK=1 asks for the other stand's stage: the line must FAIL)
  if (SAMESTART.on !== (process.env.ROAMER_BREAK === '1')) verdict(where.length > 0 && (nc === where.length || nr === where.length), 'the one roamer stands in the same room on every seed (every mission starts the same way: the scenario\'s coin is not thrown)', `copy room ${nc} · reading room ${nr} of ${where.length}`);
  else verdict(nc > 0 && nr > 0, 'the one roamer stands behind the blind wall on some seeds and behind the glass on others (the scenario\'s own coin)', `copy room ${nc} · reading room ${nr} of ${where.length}`);
  verdict(rounds === 0 && clocks === 0, 'five seconds with Sam standing: nobody fires and the captor\'s clock has not started', `${rounds} rounds · the clock running on ${clocks} seeds`);
  return done();
});

// ---------------------------------------------------------------- a team on the level with nobody against it (registry-doors, registry-walk)
const EXTRA: Vec3[] = [[4.9, 0, 13.1], [4.9, 0, 16.3]];   // the third and fourth man's marks, behind the pair's
async function team(n: 2 | 4, seed = 1): Promise<{ W: any; g: any; men: any[]; P: Player }> {
  const W = await quiet(true, () => stand(seed)), g = W.game, S = g.level.scenarios.rescue;
  g.aiEnabled = true; g.godMode = true; g.playerInvisible = true;
  g.teleportPlayer([...S.team.sam]);
  const marks: Vec3[] = [...S.team.ops, ...EXTRA].slice(0, n), names = ['Blue One', 'Blue Two', 'Red One', 'Red Two'];
  const men = marks.map((p, i) => spawnUnit(g, { team: 'operative', pos: [...p], yaw: Math.PI / 2, name: names[i], light: false, budget: n > 2 ? SQUAD4_BUDGET : undefined }));
  const P = new Player(W, seed, 600, false); P.step(10);
  return { W, g, men, P };
}

// ---------------------------------------------------------------- registry-doors
/** every door a line to the room takes, and where the commander stands when he orders the stack (the side it is taken from). Not 'copy_hall': it stands open, there is nothing to stack on */
const STACKS: { door: string; from: Vec3; words: string }[] = [
  { door: 'office', from: AT.hall, words: 'the MAIN door, from the hall' },
  { door: 'office_side', from: AT.sorting, words: 'the SIDE door, from the sorting room' },
  { door: 'copy', from: AT.between, words: 'the copy room, from the gallery' },
  { door: 'reading', from: AT.between, words: 'the reading room, from the gallery' },
  { door: 'stacks_w', from: AT.lobbyS, words: 'the stacks, from the lobby' },
  { door: 'sorting', from: AT.turn4, words: 'the sorting room, from the stacks' },
  { door: 'stacks_hall', from: AT.stacksN, words: 'the hall, from the stacks' },
];
export const registryDoors = guarded(async () => {
  const { verdict, done } = family('registry-doors: the pair ordered onto every door a line to the room takes get onto their marks');
  const { g, men, P } = await team(2); const O = g.orders, lines: string[] = [], bad: string[] = [];
  const authored = new Map<any, boolean>(g.doors.list.map((d: any) => [d, d.locked]));
  const locks = (on: any | null) => { for (const d of g.doors.list) d.locked = d === on ? authored.get(d)! : false; };   // (the walk between doors is not what is measured — but each stack is ordered with ITS door locked as authored)
  for (const s of STACKS) {
    locks(null);
    P.order('fallIn', P.noneT()); P.go(s.from, { sprint: true, max: 60, dodge: true }); P.until(() => men.every((m: any) => flat(m.char.pos, P.pos) < 5), 12);
    const D = g.doors.byName(s.door), t0 = P.t; locks(D); if (!P.order('stack', P.doorT(s.door))) { bad.push(`${s.door}: refused — ${P.refused[P.refused.length - 1]}`); continue; }
    const ok = P.until(() => men.every((m: any) => O.of(m)?.arrived), 24), posts: Vec3[] = men.map((m: any) => O.of(m)?.post ?? m.char.pos), c = D.frameCentre, th = D.def.closedDir, u = [Math.cos(th), Math.sin(th)];
    const along = posts.map(p => Math.abs((p[0] - c[0]) * u[0] + (p[2] - c[2]) * u[1])), free = posts.every(p => !g.col.nav.isBlocked(p[0], p[2])), apart = flat(posts[0], posts[1]), same = posts.every(p => sideOf(D, p) === sideOf(D, s.from));
    if (!ok) bad.push(`${s.door}: not on their marks after 24 s (${men.map((m: any) => f2(flat(m.char.pos, O.of(m)?.post ?? m.char.pos))).join(' / ')} m short)`);
    if (!free || apart < 0.6 || !same || Math.min(...along) < D.def.width / 2) bad.push(`${s.door}: marks ${posts.map(at).join(' ')} — ${!free ? 'not on free floor' : apart < 0.6 ? `only ${f2(apart)} m apart` : !same ? 'on the far side' : 'in the opening'}`);
    lines.push(`${s.door}${authored.get(D) ? ' (locked)' : ''}: ${posts.map(at).join(' ')} in ${f1(P.t - t0)} s`);
  }
  verdict(bad.length === 0, `stack room for the pair on ${STACKS.length} doors, each from the side it is taken from: both men on their marks — free floor, apart, out of the opening`, bad.length ? bad.join(' · ') : lines.join(' · '));
  return done();
});

// ---------------------------------------------------------------- registry-walk
/** Sam's walk: every space, both approaches, every inside door. (in → out by the same door where a room has one.) */
const WALK: { to: Vec3; words: string }[] = [
  { to: AT.mouth, words: 'gallery' }, { to: AT.reading, words: 'reading room (in and out by its door)' }, { to: [11.6, 0, 8.4], words: 'reading room, its far end' }, { to: [11.25, 0, 6.25], words: "reading room, round the table's end" },   // (a dead-end room: the fourth follower's place is 4.6 m back along Sam's trail, and the far end alone is 5.2 m of trail from the door — he made it half a metre in through a 1.2 m doorway and stops ON a real one's threshold when Sam turns back. Two metres more of room and the whole file is in)
  { to: AT.reading, words: 'reading room' }, { to: AT.between, words: 'gallery' },
  { to: AT.copy, words: 'copy room (in by the gallery door)' }, { to: AT.hall, words: 'hall (out by the copy room\'s hall door)' },
  { to: AT.in2, words: "registrar's office (in by the MAIN door)" }, { to: AT.sorting, words: 'sorting room (out by the SIDE door)' },
  { to: AT.sortingW, words: 'stacks (by the sorting room\'s door)' }, { to: AT.turn4, words: 'stacks' }, { to: AT.turn3, words: 'stacks' }, { to: AT.turn2, words: 'stacks' }, { to: AT.turn1, words: 'stacks' }, { to: AT.stacksW, words: 'stacks' },
  { to: AT.lobbyS, words: 'lobby (by the stacks\' west door)' },
  // and the long approach the way it is played: the lobby → the stacks → the sorting room → up to the side door; then the short cut home by the stacks' hall door
  { to: AT.stacksW, words: 'stacks' }, { to: AT.turn1, words: 'stacks' }, { to: AT.turn2, words: 'stacks' }, { to: AT.turn3, words: 'stacks' }, { to: AT.turn4, words: 'stacks' }, { to: AT.sortingW, words: 'stacks' },
  { to: AT.sorting, words: 'sorting room' }, { to: [32.4, 0, 17.4], words: 'sorting room, its middle' }, { to: AT.sortingW, words: 'stacks' }, { to: AT.stacksN, words: 'stacks, north end' }, { to: AT.hall, words: 'hall (by the stacks\' hall door)' }, { to: AT.post, words: 'gallery' }, { to: [7.6, 0, 14.7], words: 'lobby' },
];
const INSIDE_DOORS = ['reading', 'copy', 'copy_hall', 'office', 'office_side', 'stacks_w', 'stacks_hall', 'sorting'];
export async function walk(n: 2 | 4, each?: (g: any, men: any[]) => void) {   // (`each`: asked every frame of the walk, before it is counted — backturn-check.ts)
  const { g, men, P } = await team(n); for (const d of g.doors.list) d.locked = false;   // (the locks are off for the walk: what they do to a line is the tally's safe runs, with the pair behind Sam)
  const sam = new Set<string>(), theirs = men.map(() => new Set<string>()), opened = new Set<string>(), last = men.map((m: any) => [...m.char.pos]), still = men.map(() => 0);
  const back = n > 2 ? 6.5 : 4.5, close = n > 2 ? 5.0 : 3.2;   // the file's length behind Sam: the pair's rear man follows ~3 m back, the four's ~4.5 m
  let frames = 0, stuck = 0, closest = 9, jam = 0, walked = 0, far = 0, short = ''; let prev = [...P.pos];
  const tick = () => { each?.(g, men); frames++; sam.add(spaceOf(P.pos)); walked += flat(P.pos, prev); prev = [...P.pos];
    men.forEach((m: any, i: number) => { theirs[i].add(spaceOf(m.char.pos)); const d = flat(m.char.pos, P.pos); far = Math.max(far, d);
      if (flat(m.char.pos, last[i]) > 0.004) still[i] = 0; else if (d > back && ++still[i] > 60) stuck++; last[i] = [...m.char.pos]; });   // (a man farther behind Sam than the file's own length who has not moved for a second is stuck, not waiting)
    for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) { const d = flat(men[i].char.pos, men[j].char.pos); closest = Math.min(closest, d); if (d < 0.5) jam++; }
    for (const d of g.doors.list) if (flat(P.pos, d.frameCentre) < 0.75) opened.add(d.def.name); };   // (a door Sam himself went through: he stood in its frame)
  P.order('fallIn', P.noneT()); const t0 = P.t;
  for (const leg of WALK) { const ok = P.go(leg.to, { max: 60, until: () => { tick(); return false; } }); if (!ok) short += `${short ? ' · ' : ''}Sam stopped short of ${at(leg.to)} (${leg.words}) at ${at(P.pos)}${short ? '' : ` — the men at ${men.map((m: any) => `${at(m.char.pos)}→${at(g.orders.of(m)?.goal ?? m.char.pos)}`).join(' ')}`}`;
    P.until(() => { tick(); return men.every((m: any) => flat(m.char.pos, P.pos) < close); }, 4); }   // (a breath at each stop: the file closes up, as it would behind a man who looks before he goes on)
  for (let i = 0; i < 240; i++) { P.step(); tick(); }
  const end = men.map((m: any) => flat(m.char.pos, P.pos));
  return { n, back, secs: P.t - t0, walked, frames, stuck, closest, jam, far, short, end, sam, theirs, opened, alive: men.every((m: any) => m.state !== 'dead'), doorway: men.filter((m: any) => g.doors.list.some((d: any) => flat(m.char.pos, d.frameCentre) < 0.6)).map((m: any) => `${m.callsign} ${at(m.char.pos)}`) };
}
export const registryWalk = guarded(async () => {
  const { verdict, done } = family('registry-walk: every room and both approaches on foot, with the pair following and with four following');
  const spaces = Object.keys(ROOMS);
  // (one process, two games: the walk stands no scenario up, and the team's start is not read — the men are stood on marks typed here)
  for (const n of [2, 4] as const) {
    const w = await walk(n), who = n === 2 ? 'the pair' : 'four followers', missed = spaces.filter(s => !w.sam.has(s)), theirMiss = w.theirs.map((t: Set<string>) => spaces.filter(s => !t.has(s)).join('+') || '—'), doors = INSIDE_DOORS.filter(d => !w.opened.has(d));
    verdict(!w.short && missed.length === 0 && doors.length === 0, `${who}: Sam walks every space and passes every inside door`, w.short || (missed.length ? `never in: ${missed.join(', ')}` : doors.length ? `never passed: ${doors.join(', ')}` : `${f1(w.walked)} m in ${f1(w.secs)} s at a walk · ${spaces.length} spaces · ${INSIDE_DOORS.length} doors`));
    verdict(w.alive && theirMiss.every((k: string) => k === '—') && w.end.every((d: number) => d < 5.5) && w.doorway.length === 0, `${who}: every man follows him through all of it and ends with him, nobody left in a doorway`, `at the end ${w.end.map(f2).join(' / ')} m from Sam · spaces a man never entered: ${theirMiss.join(' / ')} · ${w.doorway.length ? w.doorway.join(', ') : 'nobody'} in a doorway · farthest any man fell behind ${f1(w.far)} m`);
    verdict(100 * w.stuck / (n * w.frames) < 1, `${who}: nobody is left behind — stuck man-frames under one percent`, `${w.stuck} of ${n * w.frames} man-frames (${f2(100 * w.stuck / (n * w.frames))} %) standing still over ${w.back} m behind him · two men within half a metre on ${w.jam} frames, closest ${f2(w.closest)} m`);
  }
  return done();
});

// ---------------------------------------------------------------- registry-run
export const registryRun = guarded(async () => {
  const { verdict, done } = family('registry-run: the level\'s tally on six seeds — every run ends on the scenario\'s own result, and the level can be finished by both lines');
  const seeds = [1, 2, 3, 4, 5, 6], runs = await playAll(HEADLINE, seeds, 3, 150);
  console.log(report(runs, HEADLINE).split('\n').map(l => `    ${l}`).join('\n'));
  const errs = runs.filter(r => r.grade === 'error' || r.grade === 'stalled');
  verdict(errs.length === 0, `${runs.length} runs (${HEADLINE.join(', ')} × seeds ${seeds.join(', ')}): each ended on the scenario's own result inside the cap, none threw`, errs.length ? errs.slice(0, 4).map(r => `${r.style} seed ${r.seed}: ${r.grade} ${r.note || r.why}`).join(' · ') : HEADLINE.map(s => `${s} ${runs.filter(r => r.style === s && r.grade === 'clean').length}/${seeds.length} clean`).join(' · '));
  const by = (s: string) => runs.filter(r => r.style === s && r.grade === 'clean');
  verdict(by('flow').length > 0, 'it can be finished by the gallery: a flow run with both hostages out, the room held, inside the clock', by('flow').length ? `seeds ${by('flow').map(r => r.seed).join(', ')} — the room held at ${by('flow').map(r => f1(r.secured)).join(' / ')} s of clocks of ${by('flow').map(r => f1(r.resolveSecs)).join(' / ')} s, with Sam and the pair (team of three)` : 'no flow run was clean');
  verdict(by('safe').length > 0, 'it can be finished by the stacks: a safe run with both hostages out', by('safe').length ? `seeds ${by('safe').map(r => r.seed).join(', ')} — the room held at ${by('safe').map(r => f1(r.secured)).join(' / ')} s` : 'no safe run was clean');
  const refused = runs.flatMap(r => r.refused.map(w => `${r.style} ${r.seed}: ${w}`));
  verdict(refused.length === 0, 'no order a style gave was refused', refused.length ? refused.slice(0, 5).join(' · ') : `${runs.reduce((a, r) => a + r.orders, 0)} orders`);
  return done();
});

// ---------------------------------------------------------------- the command line
/** the newest change on disk among what a worker loads afresh: a tally that outlives an edit has mixed two builds (rescue-tally.ts's rule) */
function stamp(): number {
  let t = 0; const file = (f: string) => { try { t = Math.max(t, statSync(f).mtimeMs); } catch { /* not there: nothing to mix */ } };
  const dir = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? dir(`${d}/${e.name}`) : file(`${d}/${e.name}`); };
  dir(`${ROOT}/src`); for (const f of ['levels/registry.json', 'tools/levels/registry.ts', 'tools/qa/registry-probes.ts', 'tools/qa/rescue-tally.ts', 'tools/qa/headless.ts']) file(`${ROOT}/${f}`);
  return t;
}
function seedList(s: string): number[] { return s.split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); if (m) { const a = +m[1], b = +m[2]; return b >= a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [NaN]; } return [/^\d+$/.test(p) ? Number(p) : NaN]; }).filter((x, i, a) => a.indexOf(x) === i); }
if (import.meta.main) {
  const argv = process.argv.slice(2), cmd = argv[0];
  const usage = (why: string): never => { console.error(`${why}\nusage: bun run tools/qa/registry-probes.ts tally [--styles a,b] [--seeds 1-32] [--jobs N] [--cap SECS] [--react SECS] [--json FILE] [--md]\n       bun run tools/qa/registry-probes.ts trace <style>:<seed>\n       (the probes: bun run tools/qa/probes.ts registry)\nstyles: ${Object.keys(STYLES).join(', ')}`); process.exit(2); };
  if (cmd === 'worker') {   // worker <style> <seed> <cap> <react>: one run, one RESULT line
    BOT.react = Number(argv[4] ?? BOT.react); const { trace, ...r } = await play(argv[1], Number(argv[2]), Number(argv[3] ?? 150)); process.stdout.write(`RESULT ${JSON.stringify(r)}\n`); process.exit(r.grade === 'error' ? 1 : 0);
  } else if (cmd === 'trace') {
    const [p, s] = (argv[1] ?? '').split(':'); if (!STYLES[p] || (s !== undefined && !/^\d+$/.test(s))) usage(`trace wants style:seed, e.g. flow:3 (got '${argv[1] ?? ''}')`);
    const { trace, ...r } = await play(p, Number(s ?? 1), 150, true); console.log(JSON.stringify(r, null, 1)); process.exit(r.grade === 'error' ? 1 : 0);
  } else if (cmd === 'tally') {
    const opt: Record<string, string> = {}, FLAGS = ['styles', 'seeds', 'jobs', 'cap', 'react', 'json', 'md'];
    for (let i = 1; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!argv[i].startsWith('--') || !FLAGS.includes(k)) usage(`unknown flag '${argv[i]}'`); if (k === 'md') { opt.md = '1'; continue; } const v = argv[++i]; if (v === undefined || v.startsWith('--')) usage(`--${k} wants a value`); opt[k] = v; }
    const styles = (opt.styles ?? HEADLINE.join(',')).split(',').filter(Boolean), unknown = styles.filter(s => !STYLES[s]); if (unknown.length) usage(`unknown style '${unknown.join("', '")}'`);
    const seeds = seedList(opt.seeds ?? '1-32'); if (!seeds.length || seeds.some(Number.isNaN)) usage(`--seeds wants numbers, e.g. 1-32 or 3,5,9 (got '${opt.seeds}')`);
    const num = (k: string, d: number) => { if (opt[k] === undefined) return d; const v = Number(opt[k]); if (!Number.isFinite(v) || v < 0) usage(`--${k} wants a number (got '${opt[k]}')`); return v; };
    const jobs = Math.max(1, Math.floor(num('jobs', Math.min(8, (await import('node:os')).cpus().length)))), cap = num('cap', 150); BOT.react = num('react', BOT.react);
    console.log(`registry tally: ${styles.join(', ')} × seeds ${opt.seeds ?? '1-32'} (${styles.length * seeds.length} runs, ${jobs} at a time, cap ${cap} s, the bot's reaction ${BOT.react} s)`);
    const stamp0 = stamp(), t0 = Date.now(), runs = await playAll(styles, seeds, jobs, cap, r => process.stderr.write(`  ${r.style} seed ${r.seed}: ${r.grade} — ${r.why || r.note} · hostages ${r.hostages}/2 · pair ${r.pair}/2 · Sam ${r.sam ? 'up' : 'DOWN'} · roamer in the ${r.roamer} · ${f1(r.end)} s\n`));
    console.log(`\n${report(runs, styles, !!opt.md)}\n`); for (const s of styles) console.log(`${s}: ${STYLES[s].words}`);
    const noted = runs.filter(r => r.note && r.grade !== 'error'); if (noted.length) console.log(`\nnotes: ${noted.map(r => `${r.style} seed ${r.seed}: ${r.note}`).join(' · ')}`);
    const stale = stamp() !== stamp0;
    if (opt.json) await Bun.write(opt.json, JSON.stringify({ level: 'registry', stale, seeds, styles, cap, react: BOT.react, runs }, null, 1));
    if (stale) { console.log('=== registry tally: NO VERDICT — the sources changed on disk while the tally ran (workers load them afresh): run it again ==='); process.exit(2); }
    const errs = runs.filter(r => r.grade === 'error').length; console.log(`=== registry tally: ${errs ? `${errs} runs errored` : 'no verdict is taken here (the numbers are for a person to read)'} === (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(errs ? 1 : 0);
  } else usage(cmd ? `unknown command '${cmd}'` : 'no command');
}
