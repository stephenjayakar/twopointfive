// THE RUN TAPE: what a headless game needs to be walked through the same run a replay was saved from (tools/qa/rerun.ts) — the replay buffer's second half
// (replaybuf.ts owns one). The TRACE says where everybody was; the tape holds what went INTO the simulation from the first step of the page's game: the recipe (the
// game's die, the page's query, the knobs and sandbox switches as they stood), then per step its dt, the player's record (cmd.ts PlayerCmd, minus the two matrices —
// the camera's pose is kept and they are rebuilt from it, as the session journal does) and every value the game READ off the GPU that step (Game.sensors). What
// reaches the game from OUTSIDE a step is taped where it can be seen: a restart from a card (the player is a new object between two steps), a sandbox switch, a
// knob moved on the Tab panel, the player put somewhere (a 'pose' row: where he stands at the first step and after every restart — a page that stages its own scene,
// host/sneaklab.ts, stands him there — and wherever he was moved between two steps, a debug teleport; 'posein': where a restart made INSIDE a step, Shift+Enter,
// left him once the page's own wrap of Game.restart had staged its scene — the game's restart is wrapped on this Game's instance to see it, as the sensors' read is).
// A control worked on the page between two steps (`touched()`: ui/replaykey.ts hears the document's input, change and click) has every table looked at before the
// next step, so a number moved on a panel while playing is taped at the step it first acts on, not on the tables' slow round. What cannot be followed — a scenario started or quit from a menu, a checkpoint loaded between two steps, an F10 recording started — ends the tape with its reason (`dead`),
// and the replay is then a trace only. It never touches the game: the sensors' read is WRAPPED on this Game's instance (the value passes through untouched).
// A re-run is exact as far as the page's arithmetic and bun's agree; the tool measures that against the trace instead of promising it.
import type { Game } from './game';
import type { PlayerCmd } from './cmd';
import type { RunTape, TapeInput, TapeVal } from '../replay/format';
import { tapeF32, tapeNum } from '../replay/format';
import type { TapePiece } from '../replay/kept';
import { envSnapshot, knobsSnapshot } from './journal';
import { activeScenario } from './scenarioRun';
import { knobRegistry, NOT_KNOBS } from './knobs';
import { KIT, kitOwn, kitStealthCard } from './kit';
import { STAND_ENV } from '../host/standEnv';
import { FollowCamera } from './camera';

type Proc = { versions?: Record<string, string | undefined>; env?: Record<string, string | undefined> } | undefined;
const proc = (): Proc => (globalThis as { process?: Proc }).process;
/** where this game stands: the real page (no bun / node under it), or a headless tool's stand as its environment named it (src/host/profile.ts: TPS_PROFILE — read
 *  here, at the game's first step: a tool that changed its stand by hand after loading the harness is not followed) */
const standNow = (): 'page' | 'shipped' | 'frozen' => { const P = proc(); return !P?.versions?.bun && !P?.versions?.node ? 'page' : P.env?.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'; };
/** the stand's own env words a tool was started with (TPS_GEAR=1 …: the harness writes some of them before the game is built, where no table put back later reaches) */
const wordsNow = (): Record<string, string> => { const E = proc()?.env ?? {}, out: Record<string, string> = {}; for (const w of STAND_ENV) if (w !== 'TPS_PROFILE' && w !== 'TPS_SEED' && E[w] !== undefined) out[w] = E[w]!; return out; };
/** every registered knob table as JSON text, by name (the journal's knobTables() is a subset: a switch the page has on and a recording does not carry — the rear
 *  watch, the fresh deal of a room clear's placement, every Team feel row — is exactly what a re-run on another stand would get wrong) */
const tableKey = (k: string, T: Record<string, unknown>): string => { const skip = NOT_KNOBS[k]; return JSON.stringify(skip ? Object.fromEntries(Object.entries(T).filter(([key]) => !skip.includes(key))) : T); };
const tablesNow = (): Record<string, string> => { const out: Record<string, string> = {};
  for (const [k, T] of Object.entries(knobRegistry())) out[k] = tableKey(k, T as Record<string, unknown>);
  return out; };
/** WHERE THE PLAYER STANDS, as the tape's 'pose' row has it: his place, his velocity, the two yaws, hands empty, low. Written at the first step, after every restart
 *  and whenever it is not what the last step left (he was put somewhere from outside one); done again by putPose */
const POSE_N = 10;
const poseOf = (g: Game, into: number[]): number[] => { const pl = g.player, c = pl.char, p = c.pos, v = c.vel;
  into[0] = p[0]; into[1] = p[1]; into[2] = p[2]; into[3] = v[0]; into[4] = v[1]; into[5] = v[2]; into[6] = c.bodyYaw; into[7] = c.aimYaw; into[8] = pl.holstered ? 1 : 0; into[9] = pl.crouch ? 1 : 0; return into; };
/** a 'pose' row done to a game walked off a tape (tools/qa/rerun.ts, src/replay/engineplay.ts): nothing where he already stands so, to the bit (a plain restart, a
 *  first step nobody staged); else, moved, he is teleported there as the page's own staging and its debug hooks do it (what he was doing is dropped, the bones are
 *  laid at the new spot) and then stood exactly as taped. A row with a value that is no finite number is not done (a file from anywhere can be opened as a tape). */
export function putPose(g: Game, data: unknown): void {
  if (!Array.isArray(data) || data.length < POSE_N) return;
  const at = (data as TapeVal[]).slice(0, POSE_N).map(e => tapeNum(e)) as number[], now = poseOf(g, []);
  if (at.some(v => typeof v !== 'number' || !Number.isFinite(v)) || at.every((v, i) => Object.is(v, now[i]))) return;
  const pl = g.player, c = pl.char;
  if (!Object.is(at[0], now[0]) || !Object.is(at[1], now[1]) || !Object.is(at[2], now[2])) { g.teleportPlayer([at[0], at[1], at[2]]); c.pos[0] = at[0]; c.pos[1] = at[1]; c.pos[2] = at[2]; pl.safe = [at[0], 0, at[2]]; }
  c.vel[0] = at[3]; c.vel[1] = at[4]; c.vel[2] = at[5]; c.bodyYaw = at[6]; c.aimYaw = at[7]; pl.holstered = at[8] === 1; pl.crouch = at[9] === 1;
}
/** Game.restart wrapped on this Game's instance: `after` runs once the restart — and whatever a page had already wrapped round it — is done. Not an enumerable
 *  key: nothing that walks the game's fields (rollback.ts) meets it. */
const afterRestart = (g: Game, after: () => void): void => { const back = g.restart.bind(g);
  Object.defineProperty(g, 'restart', { configurable: true, writable: true, enumerable: false, value: (said?: string) => { back(said); after(); } }); };
/** THE TAPE'S 'pose' AND 'posein' ROWS FOR A GAME WALKED OFF IT (tools/qa/rerun.ts, src/replay/engineplay.ts; made once, when the game is stood, after anything
 *  else that wraps its restart). `row(f, kind, data)` takes one of the two — a 'pose' is done at once, a 'posein' is kept for the restart step f makes itself and
 *  done right behind it — and says whether the row was its to take. */
export function tapePoses(g: Game): { row(f: number, kind: string, data: unknown): boolean } {
  const due: [number, unknown][] = [];
  afterRestart(g, () => { const d = due.shift(); if (d) putPose(g, d[1]); });
  return { row(f, kind, data) { if (kind === 'pose') { putPose(g, data); return true; } if (kind !== 'posein') return false;
    while (due.length && due[0][0] !== f) due.shift();   // (one an earlier step never used: that step did not restart here, the walk has parted already)
    due.push([f, data]); return true; } };
}
/** What reached the game from OUTSIDE a step that no tape can follow, as the replay buffer saw it before the step ran (replaybuf.ts `look` — the one place it is
 *  asked, for the tape and the trace alike): a checkpoint loaded, an F10 recording started (it re-enters a checkpoint of the moment and puts its own die in). */
export type Outside = 'load' | 'rec' | null;
/** checkpoints loaded into this game so far (savestate.ts Checkpoints.load — the one road a page's load takes) */
export const loadsOf = (g: Game): number => (g.saves as { stats?: { loads?: number } } | undefined)?.stats?.loads ?? 0;
/** the F10 recorder: running, and the last file it made (a new object each stop: a recording stopped and started again between two looks is seen by it) */
export const recOf = (g: Game): { on: boolean; last: object | null } => { const J = g.journal as { recording?: boolean; last?: object | null } | undefined; return { on: !!J?.recording, last: J?.last ?? null }; };
const kitNow = (): string => JSON.stringify({ on: KIT.on, members: KIT.members, ...(kitOwn() ? { own: true } : {}), ...(kitStealthCard() ? { stealth: kitStealthCard() } : {}) });   // (`own`: the cards are the player's own layout, worn as written — kit.ts KITDEAL; absent = a tape from before, or cards a team of three or four wears dealt)

/** `minutes`: a tape longer than this since the page's game began is dropped (the replay stays a trace). `tuneEvery` / `tablesEvery`: steps between looks at the
 *  game's tune / the knob tables for a change made from the panel. */
export const RUNTAPE = { minutes: 30, tuneEvery: 30, tablesEvery: 120 };

const enc = (v: number | undefined): TapeVal => v === undefined ? null : Number.isFinite(v) && !Object.is(v, -0) ? v : v !== v ? 'nan' : v === 0 ? '-0' : v > 0 ? 'inf' : '-inf';

export class RunTapeRec {
  /** why the tape stopped being a re-run ('' = it is one) and the step it stopped on */
  dead = ''; deadAt = 0;
  /** steps taped */
  ticks = 0;
  private inTick = false; private wrapped = false;
  private recipe: Omit<RunTape['recipe'], 'search' | 'levelFile'> | null = null;
  private dt: [number, number][] = [];
  private view: number[][] = []; private viewKey = '';
  private cam: TapeVal[][] = []; private camPrev: number[] = new Array<number>(9).fill(NaN);
  /** the steps whose matrices were not their pose's (format.ts RunTape.lens); the camera a pose is built on to find out (made at the first step: src/game is one
   *  import cycle); the yaw the matrices were last KNOWN to be built with (NaN: not known) */
  private lens: TapeVal[][] = []; private scratch: FollowCamera | null = null; private builtYaw = NaN;
  private input: [number, TapeInput][] = []; private keysKey = ''; private buttons = 0; private mx = NaN; private my = NaN;
  private keys: string[] = []; private keyIdx = new Map<string, number>();
  private sens: RunTape['sens']['rows'] = [];
  private seq: number[] = []; private vals: (number | undefined)[] = []; private prevSeq: number[] = []; private prevVals: (number | undefined)[] = [];
  private x: RunTape['x'] = [];
  private playerRef: object | null = null; private timeEnd = 0; private flagsKey = ''; private tuneKey = ''; private tableKeys: Record<string, string> = {}; private kitKey = ''; private pose: number[] = []; private poseNow: number[] = []; private lookAll = false; private reg: Record<string, Record<string, unknown>> | null = null; private tableNames: string[] | null = null; private tableAt = 0;

  /** a control was worked on the page from outside a step (ui/replaykey.ts): every table, the tune and the kit are looked at before the next one */
  touched(): void { this.lookAll = true; }
  /** the game as it stood when the tape was handed to it: a restart between then and its first step (the start card's) is taped like any other */
  born(g: Game): void { if (!this.ticks) this.playerRef = g.player; }
  /** a step is about to run on `cmd` */
  top(g: Game, dt: number, cmd: PlayerCmd, outside: Outside = null): void {
    if (this.dead) return;
    const f = this.ticks;
    // (a LOAD is not a restart, whatever its clock says — earlier, later (a checkpoint of an earlier visit) or the same to the bit; a load made INSIDE a step, the
    // bare Enter once down, is the step's own input and is walked again like any other)
    if (outside) { this.kill(f, outside === 'rec' ? 'an F10 recording was started' : 'a checkpoint was loaded'); return; }
    if (f === 0) { if (!this.begin(g)) return; } else if (!this.between(g, f)) return;
    if (f >= RUNTAPE.minutes * 3600) { this.kill(f, `the page's game had run more than ${RUNTAPE.minutes} min of steps`); return; }
    { const L = this.dt[this.dt.length - 1]; if (L && L[1] === dt) L[0]++; else this.dt.push([1, dt]); }
    { const k = `${cmd.w},${cmd.h},${cmd.pw},${cmd.ph}`; if (k !== this.viewKey) { this.viewKey = k; this.view.push([f, cmd.w, cmd.h, cmd.pw, cmd.ph]); } }
    { const V = cmd.view, c = [V.target[0], V.target[1], V.target[2], V.yaw, V.pitch, V.distance, V.aspect, V.fov, V.aimLead]; let mask = 0; const row: TapeVal[] = [f, 0], yaw0 = this.camPrev[3];
      for (let i = 0; i < 9; i++) if (!Object.is(c[i], this.camPrev[i])) { mask |= 1 << i; row.push(enc(c[i])); this.camPrev[i] = c[i]; }
      if (mask) { row[1] = mask; this.cam.push(row); }
      // THE LENS: the record's matrices are the host camera's as they stood, and its pose may have been written since they were built — then the step's ray is not
      // the pose's. Found by building the pose and holding it against the record, to the bit; told as the yaw that does build them where one of the two likely
      // ones does (the step before's: a pan or an orbit written a frame ahead; the last one known: a second tick of the same frame), else as the matrices themselves
      const S = this.scratch ??= new FollowCamera(); S.target[0] = c[0]; S.target[1] = c[1]; S.target[2] = c[2]; S.pitch = c[4]; S.distance = c[5]; S.aspect = c[6]; S.fov = c[7];
      const builds = (yaw: number): boolean => { S.yaw = yaw; S.rebuild();
        for (let i = 0; i < 16; i++) if (!Object.is(S.viewProj[i], V.vp[i]) || !Object.is(S.invViewProj[i], V.ivp[i])) return false;
        for (let i = 0; i < 3; i++) if (!Object.is(S.pos[i], V.pos[i]) || !Object.is(S.forward[i], V.forward[i])) return false;
        return true; };
      if (builds(c[3])) this.builtYaw = c[3];
      else if (yaw0 === yaw0 && !Object.is(yaw0, c[3]) && builds(yaw0)) { this.lens.push([f, enc(yaw0)]); this.builtYaw = yaw0; }
      else if (this.builtYaw === this.builtYaw && !Object.is(this.builtYaw, yaw0) && builds(this.builtYaw)) this.lens.push([f, enc(this.builtYaw)]);
      else { const L: TapeVal[] = [f]; for (const a of [V.vp, V.ivp, V.pos, V.forward]) for (const x of a) L.push(enc(x)); this.lens.push(L); this.builtYaw = NaN; } }
    { const rec: TapeInput = {}; let any = false; const kk = cmd.keys.join(' ');
      if (kk !== this.keysKey) { this.keysKey = kk; rec.k = cmd.keys.slice(); any = true; }
      if (cmd.pressed.length) { rec.p = cmd.pressed.slice(); any = true; }
      if (cmd.clicked) { rec.c = cmd.clicked; any = true; }
      if (cmd.buttons !== this.buttons) { this.buttons = rec.b = cmd.buttons; any = true; }
      if (cmd.mx !== this.mx || cmd.my !== this.my) { this.mx = cmd.mx; this.my = cmd.my; rec.m = [cmd.mx, cmd.my]; any = true; }
      if (cmd.wheel) { rec.w = cmd.wheel; any = true; }
      if (any) this.input.push([f, rec]); }
    this.seq.length = 0; this.vals.length = 0; this.inTick = true;
  }
  /** the step has run */
  end(g: Game): void {
    if (this.dead || !this.inTick) return;
    this.inTick = false; const f = this.ticks, S = this.seq, V = this.vals, P = this.prevSeq, Q = this.prevVals;
    let same = S.length === P.length; for (let i = 0; same && i < S.length; i++) same = S[i] === P[i];
    // (a renderer's answer is a 32-bit float: nine digits of it on the tape, not seventeen — most of a fight's tape is these; only what changed is put into text)
    if (same) { let ch: (number | TapeVal)[] | null = null; for (let i = 0; i < V.length; i++) if (!Object.is(V[i], Q[i])) (ch ??= []).push(i, tapeF32(V[i])); if (ch) this.sens.push([f, null, ch]); }
    else this.sens.push([f, S.slice(), V.map(v => tapeF32(v))]);
    this.prevSeq = S.slice(); this.prevVals = V.slice();
    this.ticks = f + 1; this.playerRef = g.player; this.timeEnd = g.time; poseOf(g, this.pose);
  }
  private sensed(key: string, v: number | undefined): void {
    if (!this.inTick || this.dead) return;
    let ki = this.keyIdx.get(key); if (ki === undefined) { ki = this.keys.length; this.keys.push(key); this.keyIdx.set(key, ki); }
    this.seq.push(ki); this.vals.push(v);
  }
  private flagsOf(g: Game) { return { godMode: !!g.godMode, aiEnabled: g.aiEnabled !== false, infiniteAmmo: !!g.infiniteAmmo, playerInvisible: !!g.playerInvisible }; }
  private begin(g: Game): boolean {
    if (g.time !== 0) { this.kill(0, 'the tape was not there from the game\'s first step'); return false; }
    const seed = (g.dice as { seed?: number } | null | undefined)?.seed;
    const tables = tablesNow(), knobs = knobsSnapshot(g), kit = kitNow();
    this.recipe = { seed: typeof seed === 'number' ? seed : null, scenario: activeScenario(g), env: envSnapshot(g), knobs, stand: standNow(), words: wordsNow(),
      tables: Object.fromEntries(Object.entries(tables).filter(([k]) => !(k in knobs.tables)).map(([k, t]) => [k, JSON.parse(t)])), kit: JSON.parse(kit) };
    this.kitKey = kit;
    if (this.playerRef && g.player !== this.playerRef) this.x.push([0, 'restart']);
    this.x.push([0, 'pose', poseOf(g, []).map(enc)]);
    this.flagsKey = JSON.stringify(this.flagsOf(g)); this.tuneKey = JSON.stringify(g.tune);
    this.tableKeys = tables;
    if (!this.wrapped) {   // every value the game reads off the renderer passes through here on its way (sensors.ts read: its sugar calls it too)
      const S = g.sensors as unknown as { read(key: string): number | undefined }, read = S.read, self = this;
      S.read = function (this: unknown, key: string) { const v = read.call(this, key); self.sensed(key, v); return v; };
      // …and a restart made INSIDE a step (Shift+Enter, the bare Enter once down) is followed to where it left the player: a page that wraps the restart to
      // stage its own scene (host/sneaklab.ts, at boot — before this) has staged it by then, and nothing between two steps would show that it had
      afterRestart(g, () => { if (self.inTick && !self.dead) self.x.push([self.ticks, 'posein', poseOf(g, []).map(enc)]); });
      this.wrapped = true;
    }
    return true;
  }
  /** one table against what the tape last had of it: a row if it moved */
  private lookTable(f: number, name: string): boolean { const k = tableKey(name, this.reg![name]); if (k === this.tableKeys[name]) return false; this.tableKeys[name] = k; this.x.push([f, 'table', [name, JSON.parse(k)]]); return true; }
  /** what was done to the game between two steps, from outside one: taped where it can be re-done, the tape's end where it cannot */
  private between(g: Game, f: number): boolean {
    const fresh = g.player !== this.playerRef;
    if (fresh) {
      if (activeScenario(g) !== this.recipe!.scenario) { this.kill(f, 'a scenario was started or quit from a menu'); return false; }
      if (g.time !== this.timeEnd) { this.kill(f, 'a checkpoint was loaded'); return false; }   // (a restart leaves the clock where the last step left it)
    } else if (g.time !== this.timeEnd) { this.kill(f, 'the game clock was moved between two steps'); return false; }
    { const k = JSON.stringify(this.flagsOf(g)); if (k !== this.flagsKey) { this.flagsKey = k; this.x.push([f, 'flags', JSON.parse(k)]); } }
    const now = fresh || this.lookAll; this.lookAll = false;   // (a restart, or a control worked on the page since the last step: everything is looked at now)
    if (now || f % RUNTAPE.tuneEvery === 0) { const k = JSON.stringify(g.tune); if (k !== this.tuneKey) { this.tuneKey = k; this.x.push([f, 'tune', JSON.parse(k)]); } }
    // (the tables one or so a step, round and round, each looked at once every `tablesEvery` steps: all hundred-odd on one step was most of a millisecond of
    // that step. ALL of them on the step one is found changed — what was written with it, a difficulty or a reset of the feel rows, goes on the tape together —
    // and on a restart's step, ahead of its row: a switch flipped on the pause card and read at the next staging must be re-done before the restart is)
    { const names = this.tableNames ??= Object.keys(this.reg ??= knobRegistry() as Record<string, Record<string, unknown>>), every = Math.max(1, RUNTAPE.tablesEvery);
      let all = now;
      if (!all) for (let j = Math.min(names.length, Math.ceil(names.length / every)); j > 0; j--) if (this.lookTable(f, names[this.tableAt++ % names.length])) all = true;
      if (all) for (const name of names) this.lookTable(f, name);
      if (all || f % every === 0) { const k = kitNow(); if (k !== this.kitKey) { this.kitKey = k; this.x.push([f, 'kit', JSON.parse(k)]); } }   // (a card changed on the loadout screen: the next staging deals it)
    }
    if (fresh) this.x.push([f, 'restart']);
    // (…and where he stands now, when that is not where the last step left him — after a restart always, ahead of nothing: a page that stages its own scene does it there)
    { const P = poseOf(g, this.poseNow), Q = this.pose; let moved = fresh; for (let i = 0; !moved && i < POSE_N; i++) moved = !Object.is(P[i], Q[i]); if (moved) this.x.push([f, 'pose', P.map(enc)]); }
    return true;
  }
  private kill(f: number, why: string): void {
    this.dead = why; this.deadAt = f; this.inTick = false;
    this.dt = []; this.view = []; this.cam = []; this.lens = []; this.builtYaw = NaN; this.input = []; this.sens = []; this.x = []; this.keys = []; this.keyIdx.clear(); this.recipe = null;
  }
  /** the tape as the file carries it (a tape that ended: its reason) */
  file(search: string, levelFile?: string): RunTape | { dead: string; tick: number } | undefined {
    if (this.dead) return { dead: this.dead, tick: this.deadAt };
    if (!this.recipe || !this.ticks) return undefined;
    return { v: 1, ticks: this.ticks, recipe: { ...this.recipe, search, ...(levelFile ? { levelFile } : {}) }, dt: this.dt.map(r => [r[0], r[1]] as [number, number]), view: this.view.slice(), cam: this.cam.slice(), input: this.input.slice(),
      sens: { keys: this.keys.slice(), rows: this.sens.slice(), f32: 1 }, x: this.x.slice(), lens: this.lens.slice() };
  }
  /** THE KEPT TAPE (src/replay/kept.ts, ui/replaykey.ts keep()): the rows taped since the last call, as a piece a kept tape appends — asked BETWEEN two steps. The first
   *  piece carries the recipe; a tape that ended hands its reason once (the rows it had not yet handed over went with it) and nothing after. null = nothing new.
   *  Only reads the tape: file() is what it was. */
  private took = { ticks: 0, view: 0, cam: 0, input: 0, keys: 0, sens: 0, x: 0, lens: 0, recipe: false, dead: false };
  since(): TapePiece | { dead: string; tick: number } | null {
    const T = this.took;
    if (this.dead) { if (T.dead) return null; T.dead = true; return { dead: this.dead, tick: this.deadAt }; }
    if (!this.recipe || this.inTick || this.ticks === T.ticks) return null;
    // (the last run of `dt` is counted up in place: the steps since the last piece are read off the tail)
    const dt: [number, number][] = []; for (let left = this.ticks - T.ticks, i = this.dt.length - 1; left > 0 && i >= 0; i--) { const n = Math.min(left, this.dt[i][0]); dt.unshift([n, this.dt[i][1]]); left -= n; }
    const P: TapePiece = { ticks: this.ticks, ...(T.recipe ? {} : { recipe: this.recipe, f32: 1 as const }), dt, view: this.view.slice(T.view), cam: this.cam.slice(T.cam), input: this.input.slice(T.input),
      keys: this.keys.slice(T.keys), sens: this.sens.slice(T.sens), x: this.x.slice(T.x), ...(!T.recipe || this.lens.length > T.lens ? { lens: this.lens.slice(T.lens) } : {}) };
    this.took = { ticks: this.ticks, view: this.view.length, cam: this.cam.length, input: this.input.length, keys: this.keys.length, sens: this.sens.length, x: this.x.length, lens: this.lens.length, recipe: true, dead: false };
    return P;
  }
  summary(): string { return this.dead ? `no re-run: ${this.dead} (step ${this.deadAt})` : `re-run tape: ${this.ticks} steps · ${this.input.length} input rows · ${this.cam.length} camera rows${this.lens.length ? ` (${this.lens.length} with a lens of their own)` : ''} · ${this.sens.length} sensor rows · ${this.x.length} outside changes`; }
}
