// SENSORS: the gameplay's window on the GPU, by name — every value the simulation takes off the renderer passes through here, and nothing else of the renderer
// reaches it. Today that is the irradiance probe (render/probe.ts): the light meter at Sam's chest and head, the meters of a held man / a unit / a frightened
// civilian, the light on a body, a searcher's readings of his hiding spots, and the smoke's transmittance along a sight line (a guard's eye → Sam, a finder's
// eye → a body, a camera's lens → Sam, a civilian's eye → Sam). Each is ASKED under a key one frame (ask / askSegment: queued for the probe's compute pass) and
// READ under that key on later frames (read: the last answer, or undefined while there is none — the caller's CPU estimate / 'clear air' stands in meanwhile;
// headless, where the fake device never answers, that is for ever). The point of routing them through one object is the three MODES:
//
//   live    — straight through to the probe, exactly as the sites called it before (the QA harness's probes that plant answers in probe.results or swap
//             probe.get still work: every call here goes through g.probe as it stands NOW);
//   record  — straight through AND every value DELIVERED to the game this frame is journaled — what the game consumed, after the readback's latency, not what
//             it asked for — as (frame, key, value) in a compact delta form (encodeValue / the 'K' + value records below): the session journal (journal.ts);
//   replay  — nothing is asked of any GPU: read(key) serves the value the journal delivered for that key on this frame. A read the journal does not have for
//             this frame is a DIVERGENCE (the replayed game took another road): the first is kept with its frame and key, the last value that key ever had is
//             served (or 'no answer') so the run completes, and values journaled but never asked are counted the same way (tools/qa/replay.ts reports both).
//
// One model for presentation and AI is untouched by this: the values are the renderer's own; this only names the seam and lets a session be played again
// without a GPU. Reads outside a frame (a panel summary polling a meter while recording) pass through unjournaled and are counted as strays.
import type { Vec3 } from '../math/vec';
import { HostOwned } from '../math/side';

export type SensorMode = 'live' | 'record' | 'replay';
/** what the game holds a probe as (render/probe.ts IrradianceProbe): asked by key, answered a frame or two later by key; `results` is the answer table the harness pokes */
export interface ProbeLike {
  query(key: string, pos: Vec3, skipOwner?: number, rank?: number): void;
  querySegment(key: string, a: Vec3, b: Vec3, rank?: number): void;
  get(key: string): ArrayLike<number> | undefined;
  results: Map<string, unknown>;
}
/** a delivered value as the journal files it: null = no answer yet (the CPU stand-in ran); a number = an f32 off the readback, written to 9 significant digits and
 *  decoded with Math.fround (exact: 9 digits name every f32); [x] = a double that is not an f32 (a value a probe planted by hand), kept exact; the three strings
 *  for what JSON cannot hold */
export type SensorEnc = null | number | [number] | 'nan' | 'inf' | '-inf' | '-0';
/** the journal's sensor stream: a key table and records — ['K', f, ki, ki, …] = the ordered list of keys READ from frame f on (until the next 'K'), which also
 *  resets every value to 'no answer'; [f, pos, enc, pos, enc, …] = from frame f on, the value at position `pos` of the current key list is `enc` */
export type SensorRec = (number | string | SensorEnc)[];
export interface SensorJournal { keys: string[]; recs: SensorRec[]; frames: number; }
export interface SensorDivergence { f: number; kind: 'unjournaled-read' | 'unasked'; key: string; detail: string; }
export interface SensorStats { reads: number; asks: number; strays: number; frames: number; recs: number; divergences: number; unasked: number; unjournaled: number; }

/** WHO KEEPS A PLACE on a frame that asks the probe for more than its table holds (render/probe.ts put: the lowest ranks stay, the rank that straddles the limit
 *  takes turns; with everything fitting — every floor but the four-man squad's against a full house — the rank is never looked at):
 *    0  Sam's own meter — the one reading the whole stealth game hangs on, and the LAST thing asked in a frame
 *    1  a sight line through smoke: a guard's eye → Sam, the room fight's pairs, a camera's, a civilian's, a finder's to a body (unanswered it reads as clear air:
 *       smoke that hides nobody)
 *    2  every other meter: a unit's own, a held man's, a body's, a searcher's spots, a civilian's (each has a CPU estimate or its last answer to stand in)
 *    3  the fog of war's lines ('fow…': fogofwar.ts asks last, counts the room and forgets what it could not ask) */
export function askRank(key: string, segment: boolean): number {
  return segment ? (key.startsWith('fow') ? 3 : 1) : (key === 'playerChest' || key === 'playerHead' ? 0 : 2);
}

export function encodeValue(v: number | undefined): SensorEnc {
  if (v === undefined) return null;
  if (Number.isNaN(v)) return 'nan';
  if (v === Infinity) return 'inf'; if (v === -Infinity) return '-inf';
  if (v === 0) return 1 / v < 0 ? '-0' : 0;   // (JSON writes −0 as 0)
  if (Math.fround(v) === v) { for (let p = 1; p <= 9; p++) { const r = Number(v.toPrecision(p)); if (Math.fround(r) === v) return r; } return [v]; }   // (9 always lands; the loop only finds the shortest that does — a transmittance of 1 is '1')
  return [v];
}
export function decodeValue(e: SensorEnc): number | undefined {
  if (e === null) return undefined;
  if (typeof e === 'number') return Math.fround(e);
  if (Array.isArray(e)) return e[0];
  return e === 'nan' ? NaN : e === 'inf' ? Infinity : e === '-0' ? -0 : -Infinity;
}
const sameValue = (a: number | undefined, b: number | undefined) => Object.is(a, b);   // (NaN is NaN, −0 is not 0: what was delivered is what is filed)

/** WHAT OF THE SENSORS IS THE HOST'S AND NOT THE GAME'S (math/side.ts HostOwned): the mode, the frame count and everything a recording has filed or a replay
 *  is serving. A rollback snapshot (rollback.ts) holds it as it is — never copied, never put back — so a save in memory put back inside an update
 *  (savestate.ts loadMem: Enter once down, with a unit on the floor) leaves a running recording its whole stream and its frame, and a replay of that file its
 *  cursor: the game goes back, the tape goes on. (It was plain fields of Sensors once: a save made while a tape ran took the tape back to the save's frame with
 *  the game, a save made before one put the sensors back to live under the recorder, and every snapshot under a recording copied the whole stream.) What the
 *  game itself worked out — `own`'s answers below — stays the game's and goes back with it. */
class SensorStream extends HostOwned {
  mode: SensorMode = 'live';
  frame = -1;
  inFrame = false;
  stats: SensorStats = { reads: 0, asks: 0, strays: 0, frames: 0, recs: 0, divergences: 0, unasked: 0, unjournaled: 0 };
  firstDivergence: SensorDivergence | null = null; divergenceLog: SensorDivergence[] = [];
  // ---- record state
  keys: string[] = []; keyIdx = new Map<string, number>(); recs: SensorRec[] = []; bytes = 16;
  prevSeq: number[] = []; prevVals: (number | undefined)[] = [];
  curSeq: number[] = []; curVals: (number | undefined)[] = [];
  // ---- replay state
  src: SensorJournal | null = null; cursor = 0; seq: number[] = []; vals: (number | undefined)[] = [];
  pending = new Map<string, (number | undefined)[]>(); lastServed = new Map<string, number | undefined>();
}

export class Sensors {
  /** the stream and where this object stands on it: the host's (see SensorStream) */
  private s = new SensorStream();
  get mode(): SensorMode { return this.s.mode; }
  /** the frame being (or last) simulated in record / replay: 0 = the first Game.update after the recording's checkpoint */
  get frame(): number { return this.s.frame; }
  get stats(): SensorStats { return this.s.stats; }
  /** replay: the first divergence of the run (null = none yet) and the first few after it */
  get firstDivergence(): SensorDivergence | null { return this.s.firstDivergence; }
  get divergenceLog(): SensorDivergence[] { return this.s.divergenceLog; }

  /** THE SENSES ON THE CPU (sense.ts SENSE.cpu; set by the Game, null = off): a sight line's transmittance worked out by the game itself, in the step that asks.
   *  While it is set nothing is asked of the probe and nothing of the probe's is served: a LIGHT read has no answer (every meter's own estimate stands in, as it
   *  always has until the first answer), a SEGMENT read is `own`'s for the line last asked under that key. Record files those values, replay serves what was filed. */
  own: ((a: Vec3, b: Vec3) => number) | null = null;
  private ownVals = new Map<string, number>();
  /** hand the sight lines to the game's own working (null = back to the probe); answers kept from before are dropped */
  setOwn(f: ((a: Vec3, b: Vec3) => number) | null): void { this.own = f; this.ownVals.clear(); }
  /** a new encounter: no line's answer outlives the world it was worked out in */
  ownReset(): void { this.ownVals.clear(); }
  /** `probeOf` hands the probe as it stands now (the harness swaps its methods mid-run) */
  constructor(private probeOf: () => ProbeLike) {}

  // ================================================================================================== the queries (every GPU → gameplay read is one of these)
  /** queue an irradiance query at `pos` under `key` (skipOwner: the character whose own proxies must not shadow a reading inside his chest) — dropped in replay */
  ask(key: string, pos: Vec3, skipOwner = 0): void { this.s.stats.asks++; if (this.own) return; if (this.s.mode !== 'replay') this.probeOf().query(key, pos, skipOwner, askRank(key, false)); }
  /** queue a smoke-transmittance query along a → b under `key` — dropped in replay */
  askSegment(key: string, a: Vec3, b: Vec3): void { this.s.stats.asks++; if (this.own) { if (this.s.mode !== 'replay') this.ownVals.set(key, this.own(a, b)); return; } if (this.s.mode !== 'replay') this.probeOf().querySegment(key, a, b, askRank(key, true)); }
  /** drop a stale answer for `key` (a search plan re-using its keys for new spots): the probe keeps the last value per key for ever otherwise — nothing to do in replay (what was delivered is what is served) */
  forget(key: string): void { if (this.own) { this.ownVals.delete(key); return; } if (this.s.mode !== 'replay') this.probeOf().results.delete(key); }
  /** THE read: the latest answer for `key` (max-axis irradiance in W/m², or a segment's transmittance 0‥1) or undefined while there is none — journaled in record, served in replay */
  read(key: string): number | undefined {
    this.s.stats.reads++;
    if (this.s.mode === 'live') return this.own ? this.ownVals.get(key) : first(this.probeOf().get(key));
    if (this.s.mode === 'record') {
      const v = this.own ? this.ownVals.get(key) : first(this.probeOf().get(key));
      if (!this.s.inFrame) { this.s.stats.strays++; return v; }
      let ki = this.s.keyIdx.get(key); if (ki === undefined) { ki = this.s.keys.length; this.s.keys.push(key); this.s.keyIdx.set(key, ki); this.s.bytes += key.length + 3; }
      this.s.curSeq.push(ki); this.s.curVals.push(v);
      return v;
    }
    // replay
    if (!this.s.inFrame) { this.s.stats.strays++; return this.s.lastServed.get(key); }
    const q = this.s.pending.get(key);
    if (q && q.length) { const v = q.shift(); this.s.lastServed.set(key, v); return v; }
    this.diverge({ f: this.s.frame, kind: 'unjournaled-read', key, detail: `the game read '${key}' on frame ${this.s.frame}; the recording read [${[...this.s.pending.keys()].join(', ') || 'nothing'}] there` });
    this.s.stats.unjournaled++;
    return this.s.lastServed.get(key);
  }
  // ---- the named forms the sites use
  /** a sight line's smoke transmittance: ask along a → b (unless `ask` is false — a budgeted site out of slots) and read; undefined = not answered (clear air to the caller) */
  segment(key: string, a: Vec3, b: Vec3, ask = true): number | undefined { if (ask) this.askSegment(key, a, b); return this.read(key); }
  /** a light METER: two queries at a chest and a head under their keys with `id`'s own proxies skipped, read back as the max of the two when both have finite
   *  answers; undefined = no reading yet. NOTHING CALLS IT today: Sam's 'playerChest' / 'playerHead' pair asks and reads this object directly (game.ts), and a
   *  held man's / a unit's / a civilian's goes through g.lightQuery / g.lightAt (guards.ts meterOf), the hooks the harness swaps, with the CPU estimate standing in */
  meterPair(kc: string, kh: string, pc: Vec3, ph: Vec3, id: number): number | undefined {
    this.ask(kc, pc, id); this.ask(kh, ph, id);
    const r1 = this.read(kc), r2 = this.read(kh);
    return r1 !== undefined && r2 !== undefined && Number.isFinite(r1) && Number.isFinite(r2) ? Math.max(r1, r2) : undefined;
  }
  /** the light on a point (a body's trunk, a hiding spot): ask (unless out of budget) and read; undefined / non-finite = no reading */
  lightAt(key: string, pos: Vec3, skipOwner = 0, ask = true): number | undefined { if (ask) this.ask(key, pos, skipOwner); return this.read(key); }

  // ================================================================================================== frames
  /** the top of a simulated frame (Game.update): record files reads under the new frame number; replay lays out what the recording delivered on it */
  beginFrame(): void {
    if (this.s.mode === 'live') return;
    this.s.frame++; this.s.inFrame = true; this.s.stats.frames++;
    if (this.s.mode === 'record') { this.s.curSeq = []; this.s.curVals = []; return; }
    // replay: apply this frame's records, then queue the delivered values by key in read order
    const S = this.s.src!;
    while (this.s.cursor < S.recs.length) {
      const r = S.recs[this.s.cursor]; const isK = r[0] === 'K'; const f = (isK ? r[1] : r[0]) as number;
      if (f > this.s.frame) break;
      if (isK) { this.s.seq = (r.slice(2) as number[]); this.s.vals = this.s.seq.map(() => undefined); }
      else for (let i = 1; i + 1 < r.length; i += 2) this.s.vals[r[i] as number] = decodeValue(r[i + 1] as SensorEnc);
      this.s.cursor++;
    }
    this.s.pending.clear();
    this.s.seq.forEach((ki, i) => { const k = S.keys[ki]; let q = this.s.pending.get(k); if (!q) { q = []; this.s.pending.set(k, q); } q.push(this.s.vals[i]); });
  }
  /** the end of a simulated frame: record folds the frame's reads into the delta stream; replay counts what was delivered but never asked */
  endFrame(): void {
    if (this.s.mode === 'live' || !this.s.inFrame) return;
    this.s.inFrame = false;
    if (this.s.mode === 'record') {
      const f = this.s.frame; const seq = this.s.curSeq, vals = this.s.curVals;
      const sameSeq = seq.length === this.s.prevSeq.length && seq.every((k, i) => k === this.s.prevSeq[i]);
      if (!sameSeq) {
        this.push(['K', f, ...seq]);
        const vr: SensorRec = [f]; vals.forEach((v, i) => { if (v !== undefined) vr.push(i, encodeValue(v)); }); if (vr.length > 1) this.push(vr);
      } else {
        const vr: SensorRec = [f]; vals.forEach((v, i) => { if (!sameValue(v, this.s.prevVals[i])) vr.push(i, encodeValue(v)); }); if (vr.length > 1) this.push(vr);
      }
      this.s.prevSeq = seq; this.s.prevVals = vals; this.s.stats.recs = this.s.recs.length;
      return;
    }
    let left = 0, firstKey = ''; for (const [k, q] of this.s.pending) if (q.length) { left += q.length; firstKey ||= k; }
    if (left) { this.s.stats.unasked += left; this.diverge({ f: this.s.frame, kind: 'unasked', key: firstKey, detail: `${left} value(s) the recording delivered on frame ${this.s.frame} were never read (first: '${firstKey}')` }); }
  }
  private push(r: SensorRec) { this.s.recs.push(r); this.s.bytes += 3 + r.length * (r[0] === 'K' ? 3 : 7); }   // (a running estimate of the stream as JSON: the HUD's byte count)
  private diverge(d: SensorDivergence) { this.s.stats.divergences++; this.s.firstDivergence ??= d; if (this.s.divergenceLog.length < 20) this.s.divergenceLog.push(d); }

  // ================================================================================================== modes
  /** back to the plain probe (a recording stopped, a replay done) */
  live(): void { this.s.mode = 'live'; this.s.inFrame = false; this.s.src = null; this.s.pending.clear(); }
  /** start journaling: the next beginFrame is frame 0 */
  record(): void {
    this.s.mode = 'record'; this.s.frame = -1; this.s.inFrame = false;
    this.s.keys = []; this.s.keyIdx.clear(); this.s.recs = []; this.s.bytes = 16; this.s.prevSeq = []; this.s.prevVals = []; this.s.curSeq = []; this.s.curVals = [];
    this.s.stats = { reads: 0, asks: 0, strays: 0, frames: 0, recs: 0, divergences: 0, unasked: 0, unjournaled: 0 };
  }
  /** the journal so far (record) — the file's `sensors` block */
  journal(): SensorJournal { return { keys: [...this.s.keys], recs: this.s.recs.slice(), frames: this.s.mode === 'record' ? this.s.frame + (this.s.inFrame ? 0 : 1) : this.s.stats.frames }; }
  /** rough size of the sensor stream as JSON so far (the HUD's running byte count) */
  approxBytes(): number { return this.s.bytes; }
  /** serve a recording: the next beginFrame is its frame 0 */
  replay(src: SensorJournal): void {
    this.s.mode = 'replay'; this.s.src = src; this.s.frame = -1; this.s.inFrame = false; this.s.cursor = 0; this.s.seq = []; this.s.vals = []; this.s.pending.clear(); this.s.lastServed.clear();
    this.s.firstDivergence = null; this.s.divergenceLog = [];
    this.s.stats = { reads: 0, asks: 0, strays: 0, frames: 0, recs: src.recs.length, divergences: 0, unasked: 0, unjournaled: 0 };
  }
  summary(): string {
    const s = this.s.stats;
    return `sensors ${this.s.mode}${this.s.mode === 'live' ? '' : ` · frame ${this.s.frame} · ${s.reads} reads / ${s.asks} asks${s.strays ? ` / ${s.strays} stray` : ''} · ${this.s.mode === 'record' ? `${this.s.keys.length} keys, ${s.recs} records ≈ ${(this.approxBytes() / 1024).toFixed(1)} KB` : `${s.divergences} divergence(s)${this.s.firstDivergence ? ` — first on frame ${this.s.firstDivergence.f}: ${this.s.firstDivergence.detail}` : ''}`}`}`;
  }
}
function first(r: ArrayLike<number> | undefined): number | undefined { return r ? r[0] : undefined; }
