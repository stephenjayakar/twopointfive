// THE REPLAY BUFFER: the last stretch of play, always kept (the maintainer, 10-11: "a replay system where we can always save a replay after the fact").
// Game.update's last statement hands every finished step to tick() (Game.replayTap — null on a game nobody gave a buffer: the build as it was); tick() READS the
// game and writes only its own ring: where every man stood and which way he faced, what he was doing and why (his state, the order he is on, who has his feet,
// where they are going and by which route, who his gun is on, what he said), the doors, the things in the air, the rounds and blasts and kicks (the hearing
// model's own events), the HUD's lines, the orders given. file() turns the ring into a ReplayFile (src/replay/format.ts) — the page's F7 (ui/replaykey.ts).
//
// It is a trace, not a re-simulation: nothing here can make a later frame differ (it draws no die, asks no sensor, writes no field of the Game), and a saved
// file is read without the game. A step that throws inside tick() switches the buffer OFF with one console line: a bug here must never be a bug in the game.
//
// The ring: `hz` samples a second of play, delta-coded between KEYFRAMES every `keySecs`; it is trimmed a keyframe at a time once it holds more than `seconds`
// (so its head is always a keyframe and a file needs no state from before it).
import { SideMap, SideSet } from '../math/side';
import type { Game, Guard } from './game';
import type { CastRow, ManDo, ManPos, Sample, ReplayEvent, ReplayLine, ReplayFile, ReplayMap, DoorPos, ItemPos } from '../replay/format';
import { PLAYER_NAME, REPLAY_VERSION, ERROR_MARK, RESTART_MARK, isErrorMark } from '../replay/format';
import type { KeptPiece, KeptHead } from '../replay/kept';

/** page-error lines: the same words are one line inside this many seconds of PLAY, and the ring holds this many error lines over that stretch whatever the words */
const ERR_SAME_SECS = 60, ERR_LINES = 8;
import type { PlayerCmd } from './cmd';
import { RunTapeRec, loadsOf, recOf } from './runtape';
import type { Outside } from './runtape';

/** the buffer's knobs. `seconds`: how much play is kept. `hz`: samples a second. `keySecs`: a keyframe this often. */
export const REPLAY = { seconds: 300, hz: 20, keySecs: 5 };

const r2 = (x: number) => Math.round(x * 100) / 100;
const deg = (rad: number) => { const d = Math.round(rad * 180 / Math.PI) % 360; return d < 0 ? d + 360 : d; };
const xz = (p: ArrayLike<number> | null | undefined): [number, number] | undefined => p && Number.isFinite(p[0]) && Number.isFinite(p[2]) ? [r2(p[0]), r2(p[2])] : undefined;
const BOX_NOSHADOW = 2, BOX_GLASS = 1 << 17;
const PATH_MAX = 48, SAY_MAX = 160;

/** what the host knows that the game does not: the build, the page's query, the level's file and fingerprint */
export interface ReplayMeta { commit?: string; url?: string; userAgent?: string; levelFile?: string; scenario?: string; fp?: { fp: string; boxes: number }; /** the page visit's id in the kept tapes (ui/replaykey.ts keep()): a file saved by the key names the visit it is a window of */ session?: string; }

interface Row { key: string; pos: string; }

export class ReplayBuffer {
  /** seconds of play this buffer has seen (never goes back) · game steps seen */
  r = 0; n = 0;
  /** why it switched itself off ('' = it has not) */
  /** the buffer's own switch (the page's: ?noreplay / the stored switch — ui/replaykey.ts); off = tick() returns on its first line */
  on = true;
  broke = '';
  private samples: Sample[] = []; private events: ReplayEvent[] = []; private lines: ReplayLine[] = [];
  private cast: CastRow[] = []; private idx = new SideMap<object, number>(); private byId = new Map<number, number>();
  private rows: (Row | null)[] = []; private live = new Set<number>();
  private doorKey: string[] = []; private camKey = ''; private aimKey = '';
  private lastSampleR = -1; private lastKeyR = -1; private lastT = 0;
  private lastMsg: object | null = null; private lastOrder: object | null = null; private ordersSeen = false; private chronN = 0; private playerRef: object | null = null;

  /** THE RUN TAPE (runtape.ts): what went into the simulation from its first step, for a headless re-run of the same run (tools/qa/rerun.ts) */
  readonly tape = new RunTapeRec();
  /** a step is about to run on `cmd`. Call from Game.replayTap only. */
  top(g: Game, dt: number, cmd: PlayerCmd): void {
    if (!this.on || this.broke) return;
    let out: Outside = null;
    try { out = this.look(g); } catch (e) { this.broke = String((e as Error)?.message ?? e); return; }
    if (this.tape.dead) return;
    try { this.tape.top(g, dt, cmd, out); } catch (e) { this.tape.dead = `the tape threw: ${String((e as Error)?.message ?? e)}`; }
  }
  /** one finished game step. Call from Game.replayTap only. */
  tick(g: Game, dt: number, cam?: { target: ArrayLike<number>; yaw: number; distance: number } | null): void {
    if (!this.on || this.broke) { this.based = false; this.topLoads = -1; return; }   // (steps that went unread: what the last read step left says nothing about the next one)
    try { this.tape.end(g); } catch (e) { this.tape.dead = `the tape threw: ${String((e as Error)?.message ?? e)}`; }
    try { this.step(g, dt, cam ?? null); }
    catch (e) { this.broke = String((e as Error)?.message ?? e); try { console.error('replay buffer switched off:', e); } catch { /* */ } }
    const J = recOf(g); this.based = true; this.baseT = g.time; this.basePlayer = g.player; this.baseLoads = loadsOf(g); this.baseRec = J.on; this.baseLast = J.last;
  }
  /** the game as the last read step LEFT it (tick), against the game as the next step FINDS it (top): what was done to it from outside a step that is not a
   *  restart. A restart leaves the clock where it was; a load writes the file's — earlier, LATER (a checkpoint of an earlier visit) or the same to the bit (saved
   *  and loaded with no step between) — and counts itself (savestate.ts Checkpoints.load); an F10 recording re-enters a checkpoint of the moment (journal.ts),
   *  which neither moves the clock nor counts. Asked once, here, before the step moves the clock; the tape is handed the answer and step() words the trace's mark
   *  from it. A load made INSIDE a step (the bare Enter once down) is not this: step() sees the count move across the step. */
  private based = false; private baseT = 0; private basePlayer: object | null = null; private baseLoads = 0; private baseRec = false; private baseLast: object | null = null;
  private topLoads = -1; private outside: { why: 'load' | 'rec'; from: number } | null = null;
  private look(g: Game): Outside {
    const n = loadsOf(g), J = recOf(g); this.topLoads = n;
    if (!this.based) return J.on ? 'rec' : null;   // (nothing to hold it against: the tape alone is told of a recording already running — its die is not the game's)
    const why: Outside = J.on && (!this.baseRec || J.last !== this.baseLast) ? 'rec' : n !== this.baseLoads || (g.player !== this.basePlayer && g.time !== this.baseT) ? 'load' : null;
    if (why) this.outside = { why, from: this.baseT };
    return why;
  }
  private step(g: Game, dt: number, cam: { target: ArrayLike<number>; yaw: number; distance: number } | null): void {
    this.n++;
    if (!(dt > 0)) return;   // (a zero-length step — the frozen still — is not play)
    this.r += dt;
    // ---- what happened on this step, whatever the sampling beat: the game's events, the HUD line, the orders, the debrief's timeline, a restart
    const OL = (g.orders as unknown as { log?: { order: string; who: string[]; target: string }[] } | undefined)?.log;
    const CE = (g.chronicle as unknown as { events?: { kind: string; room?: string }[] } | undefined)?.events;
    const out = this.outside, inStep = this.topLoads >= 0 && loadsOf(g) !== this.topLoads; this.outside = null;
    if (g.player !== this.playerRef || out || g.time < this.lastT - 0.5) {
      const back = !!out || inStep || g.time < this.lastT - 0.5, was = out ? out.from : this.lastT;
      if (this.playerRef) this.mark(out?.why === 'rec' ? `an F10 recording started (the game re-entered a checkpoint of the moment; game clock ${g.time.toFixed(1)} s)`
        : !back ? `${RESTART_MARK}a fresh run; game clock ${g.time.toFixed(1)} s)`
        : g.time < was ? `a checkpoint loaded (the game clock went back ${(was - g.time).toFixed(1)} s)` : `a checkpoint loaded (game clock ${was.toFixed(1)} s, now ${g.time.toFixed(1)} s)`);
      this.playerRef = g.player; this.lastKeyR = -1;
      // (a load hands back a restored message line, event list and timeline: old rows, not this moment's — they are passed over, not filed again)
      if (back) { for (const e of g.events as unknown as object[]) this.filed.add(e); this.lastMsg = g.messages.length ? g.messages[g.messages.length - 1] : null; this.chronN = CE?.length ?? 0; }
    }
    this.lastT = g.time;
    this.enroll(g);
    this.takeEvents(g);
    { const M = g.messages; if (M.length && M[M.length - 1] !== this.lastMsg) { let i = this.lastMsg ? M.indexOf(this.lastMsg as never) + 1 : 0; for (; i < M.length; i++) this.line('msg', M[i].text); this.lastMsg = M[M.length - 1]; } }
    if (OL && OL.length && OL[OL.length - 1] !== this.lastOrder) {   // (orders.ts trims the log from its front: followed by row, as the message line is)
      let i = this.lastOrder ? OL.lastIndexOf(this.lastOrder as never) + 1 : this.ordersSeen ? OL.length : 0;
      if (this.lastOrder && i === 0) i = OL.length;   // (the row it stood on is gone — trimmed past, or the log replaced: nothing here is known to be new)
      for (; i < OL.length; i++) { const o = OL[i]; this.line('order', `${o.order} → ${o.who.join(', ') || 'nobody'}${o.target ? ` @ ${o.target}` : ''}`); }
      this.lastOrder = OL[OL.length - 1]; this.ordersSeen = true;
    }
    if (CE) { if (CE.length < this.chronN) this.chronN = 0; for (; this.chronN < CE.length; this.chronN++) { const c = CE[this.chronN]; this.line('chron', `${c.kind}${c.room ? ` (${c.room})` : ''}`); } }
    // ---- the sample, on the beat
    if (this.r - this.lastSampleR < 1 / REPLAY.hz - 1e-6) return;
    this.lastSampleR = this.r;
    const key = this.lastKeyR < 0 || this.r - this.lastKeyR >= REPLAY.keySecs;
    if (key) this.lastKeyR = this.r;
    const S: Sample = { r: Math.round(this.r * 1000) / 1000, t: r2(g.time), n: this.n };
    if (key) S.k = 1;
    const m: ManPos[] = [], x: [number, ManDo][] = []; const now = new Set<number>();
    const put = (ci: number, pos: ManPos, d: ManDo) => {
      now.add(ci);
      const row = this.rows[ci] ??= { key: '', pos: '' };
      const pk = pos.join(','); if (key || pk !== row.pos) { m.push(pos); row.pos = pk; }
      const dk = JSON.stringify(d);   // (the route ahead is in it: the game edits a path in place — a side-step spliced in — and that is a change too)
      if (key || dk !== row.key) { x.push([ci, d]); row.key = dk; }
    };
    { const pl = g.player, c = pl.char, ci = this.castOf(pl, () => ({ kind: 'player', name: PLAYER_NAME, team: 'player', id: c.id }));
      const d: ManDo = { st: pl.down ? 'down' : 'up' }; if (pl.crouch) d.crouch = true; d.slot = `${pl.slot}${pl.holstered ? ' (away)' : ''}`; const nz = Math.round((pl.noise ?? 0) * 10) / 10; if (nz) d.noise = nz;
      { const b = pl.bubble; if (b && g.time - b.t <= b.dur) d.say = b.text.slice(0, SAY_MAX); }
      put(ci, [ci, r2(c.pos[0]), r2(c.pos[2]), deg(c.bodyYaw), deg(c.aimYaw), Math.round((pl.visibility ?? 0) * 100)], d); }
    const men = g.civilians.length ? [...g.guards, ...g.civilians] : g.guards;
    for (const gd of men) {
      const c = gd.char, ci = this.castOf(gd, () => this.castRow(gd));
      put(ci, [ci, r2(c.pos[0]), r2(c.pos[2]), deg(c.bodyYaw), deg(c.aimYaw), Math.round((gd.awareness ?? 0) * 100)], this.doing(g, gd));
    }
    const gone: number[] = []; for (const ci of this.live) if (!now.has(ci)) { gone.push(ci); this.rows[ci] = null; }
    this.live = now; if (gone.length && !key) S.gone = gone;
    if (m.length) S.m = m; if (x.length) S.x = x;
    // doors
    { const d: DoorPos[] = []; const L = g.doors?.list ?? [];
      for (let i = 0; i < L.length; i++) { const D = L[i] as unknown as { angle: number; latched: boolean; locked: boolean; lockBroken: boolean; off?: unknown }; const bits = (D.latched ? 1 : 0) | (D.locked ? 2 : 0) | (D.lockBroken ? 4 : 0) | (D.off ? 8 : 0); const ang = Math.round(D.angle * 1800 / Math.PI) / 10, k = `${ang},${bits}`; if (key || k !== this.doorKey[i]) { d.push([i, ang, bits]); this.doorKey[i] = k; } }
      if (d.length) S.d = d; }
    // things in the air / on a fuse / giving off smoke
    { const it: ItemPos[] = []; for (const I of g.items?.items ?? []) { const live = !I.settled || ((I.kind === 'smoke' || I.kind === 'flash' || I.kind === 'frag') && (!I.fired || I.emitT > 0)); if (live) it.push([I.kind, r2(I.pos[0]), r2(I.pos[2]), r2(I.pos[1])]); } if (it.length) S.i = it; }
    if (cam) { const c: [number, number, number, number] = [r2(cam.target[0]), r2(cam.target[2]), deg(cam.yaw), Math.round(cam.distance * 10) / 10]; const k = c.join(','); if (key || k !== this.camKey) { S.c = c; this.camKey = k; } }
    { const a = xz(g.aimPoint); if (a) { const k = a.join(','); if (key || k !== this.aimKey) { S.a = a; this.aimKey = k; } } }
    this.samples.push(S);
    this.trim();
  }
  /** every man there is has his cast row (a new object = a new row: a restart's men are not the men before it) — before the step's events name him */
  private enroll(g: Game): void {
    const pl = g.player; this.castOf(pl, () => ({ kind: 'player', name: PLAYER_NAME, team: 'player', id: pl.char.id }));
    for (const gd of g.guards) this.castOf(gd, () => this.castRow(gd));
    for (const gd of g.civilians) this.castOf(gd, () => this.castRow(gd));
  }
  private takeEvents(g: Game): void {
    const ev = g.events as unknown as (Record<string, unknown> & { kind: string; pos: number[]; who?: number; from?: number[]; to?: number[]; level?: number; weapon?: string; frag?: boolean })[];
    let i = ev.length; while (i > 0 && !this.filed.has(ev[i - 1])) i--;   // (the game only appends and drops old rows in order: everything before the newest row already filed was filed too — however many came in one step)
    for (; i < ev.length; i++) {
      const e = ev[i]; this.filed.add(e);
      if (e.kind === 'step') continue;   // (footfalls: the men's tracks say it)
      const at = xz(e.from ?? e.pos); if (!at) continue;
      const R: ReplayEvent = { r: Math.round(this.r * 1000) / 1000, k: e.frag ? 'frag' : e.kind, x: at[0], z: at[1], who: e.who !== undefined ? this.byId.get(e.who) ?? -1 : -1 };
      const to = xz(e.to); if (to) R.to = to; if (typeof e.level === 'number') R.loud = r2(e.level); if (e.weapon) R.w = String(e.weapon);
      this.events.push(R);
    }
  }
  private filed = new SideSet<object>();
  private mark(text: string) { this.line('mark', text); }
  /** the page hit an error (ui/replaykey.ts): filed as a line at the play moment it came, so EVERY file made while the ring still holds that moment carries it —
   *  and none after: it is trimmed with the ring. All on the PLAY clock, never the wall's (a page whose frame loop has stopped, or a paused one, stands at one
   *  moment however long it is left open): the same words inside ERR_SAME_SECS of play are one line — `force` (the caller is about to save a file FOR this error)
   *  files them again unless they are already there at this very moment — and of errors that never repeat a word the ring keeps the first ERR_LINES - 1 of that
   *  stretch and the NEWEST (a flood must not keep out the crash that ends it). Not filed, and false, while the buffer is off or has stopped itself (its clock
   *  stands at where it died). Reads nothing of the game */
  pageError(text: string, force = false): boolean {
    if (!this.on || this.broke) return false;
    const full = ERROR_MARK + String(text).slice(0, 200), L = this.lines;
    let n = 0, newest = -1;
    for (let i = L.length - 1; i >= 0 && L[i].r > this.r - ERR_SAME_SECS; i--) {
      if (!isErrorMark(L[i])) continue;
      if (L[i].text === full && (!force || this.r - L[i].r < 0.05)) return false;
      n++; if (newest < 0) newest = i;
    }
    if (n >= ERR_LINES) { L.splice(newest, 1); if (newest < this.took.l) this.took.l--; }
    this.mark(full); return true;
  }
  private line(k: ReplayLine['k'], text: string) { this.lines.push({ r: Math.round(this.r * 1000) / 1000, k, text: String(text).slice(0, 240) }); }
  private castOf(o: object, make: () => CastRow): number {
    let ci = this.idx.get(o); if (ci === undefined) { ci = this.cast.length; const row = make(); this.cast.push(row); this.idx.set(o, ci); this.byId.set(row.id, ci); }
    return ci;
  }
  private castRow(gd: Guard): CastRow {
    const row: CastRow = { kind: gd.civ ? 'civ' : 'man', name: gd.callsign, team: String(gd.team), id: gd.char.id };
    if (gd.unit) { row.unit = true; if (gd.unit.pair) row.pair = gd.unit.pair; }
    const w = gd.weapon as unknown as { def?: { short?: string; id?: string } } | undefined; const wn = w?.def?.short ?? w?.def?.id; if (wn) row.weapon = String(wn);
    return row;
  }
  /** what a man is doing, from what the AI itself holds on him (read only) */
  private doing(g: Game, gd: Guard): ManDo {
    const d: ManDo = { st: gd.state };
    if (gd.downKind) d.down = String(gd.downKind);
    if (gd.state === 'dead') return d;
    const a = g.orders?.of?.(gd) ?? null;
    if (a) d.ord = `${a.order}: ${(g.orders.shownThere?.(a) ?? a.arrived) ? a.there : a.going}`;   // (the squad row's own word: a follower's is latched — orders.ts followWord)
    const by = gd.held ? 'held' : gd.script ? 'script' : gd.pinned ? 'pinned' : gd.hold ? 'hold' : ''; if (by) d.by = by;
    const task = gd.task?.kind ? String(gd.task.kind) : gd.bodyDuty ? `body ${gd.bodyDuty.role}:${gd.bodyDuty.stage}` : gd.post ? `post ${(gd.post as { name?: string }).name ?? ''}` : gd.leader ? `follows ${gd.leader.callsign}` : ''; if (task) d.task = task;
    const goal = xz(gd.pathGoal ?? gd.script?.goal ?? a?.goal ?? null); if (goal) d.goal = goal;
    if (gd.path.length > gd.pathI) { const pts: [number, number][] = []; for (let i = gd.pathI; i < gd.path.length && pts.length < PATH_MAX; i++) { const p = xz(gd.path[i]); if (p) pts.push(p); } if (pts.length) d.path = pts; }
    // (a room fight's teammate is driven in 'patrol' with his man on the room fight's own record, not on the guard AI's: that man first)
    const foe = (g.fight?.live ? g.fight.opOf(gd)?.tgt : null) ?? gd.foe; if (foe && (foe !== 'player' || gd.state === 'alert')) { const ci = foe === 'player' ? this.idx.get(g.player) : this.idx.get(foe); if (ci !== undefined) d.foe = ci; }
    if (gd.state !== 'patrol') { const f = xz(gd.lastKnown); if (f) d.fix = f; }
    { const b = gd.bubble; if (b && g.time - b.t <= b.dur) d.say = b.text.slice(0, SAY_MAX); }
    if ((gd.char.anim as unknown as { crouch?: number })?.crouch! > 0.5) d.crouch = true;
    { const s = Math.round(Math.min(1, (gd.sup?.v ?? 0)) * 4) / 4; if (s > 0) d.sup = s; }
    return d;
  }
  private trim(): void {
    const S = this.samples; if (S.length < 2) return;
    const cut = this.r - REPLAY.seconds; if (S[0].r >= cut) return;
    // (the head moves to the LAST keyframe at or before the cut — everything a reader needs is in it)
    let head = 0; for (let j = 0; j < S.length && S[j].r <= cut; j++) if (S[j].k) head = j;
    if (head > 0) { S.splice(0, head); const r0 = S[0].r; let e = 0; while (e < this.events.length && this.events[e].r < r0) e++; if (e) this.events.splice(0, e); let l = 0; while (l < this.lines.length && this.lines[l].r < r0) l++; if (l) this.lines.splice(0, l); 
      { const T = this.took; if (T.s < head) T.gap = true; T.s = Math.max(0, T.s - head); T.e = Math.max(0, T.e - e); T.l = Math.max(0, T.l - l); } }
  }

  /** seconds of play in the ring right now */
  get seconds(): number { const S = this.samples; return S.length ? S[S.length - 1].r - S[0].r : 0; }
  summary(): string { return this.broke ? `replay buffer OFF: ${this.broke}` : !this.on ? 'replay buffer off' : `replay buffer: last ${this.seconds.toFixed(0)} s of play · ${this.samples.length} samples · ${this.cast.length} cast · ${this.events.length} events · ${this.tape.summary()}`; }

  /** THE KEPT TAPE (src/replay/kept.ts, ui/replaykey.ts keep() — every run kept in the browser with no key pressed): what the ring and the run tape have gained since the
   *  last call, as one piece on the ring's own clock and cast indices (the reader rebases, as file() does). Asked BETWEEN two steps. Pieces laid end to end are the
   *  whole page visit, however long: the ring still forgets after `seconds`, the pieces were handed over before it did. `gap` = it forgot rows nobody had taken
   *  (nothing asked for longer than the ring keeps): this piece then starts at the ring's head, a keyframe. null = nothing new. Only reads; file() is what it was. */
  private took = { s: 0, e: 0, l: 0, c: 0, gap: false };
  since(): KeptPiece | null {
    const T = this.took, tape = this.tape.since();
    if (T.s >= this.samples.length && T.e >= this.events.length && T.l >= this.lines.length && !tape) return null;
    const P: KeptPiece = { r: this.r, c0: T.c, cast: this.cast.slice(T.c).map(c => ({ ...c })), samples: this.samples.slice(T.s), events: this.events.slice(T.e), lines: this.lines.slice(T.l),
      ...(T.gap ? { gap: true as const } : {}), ...(tape ? 'dead' in tape ? { dead: tape } : { tape } : {}) };
    this.took = { s: this.samples.length, e: this.events.length, l: this.lines.length, c: this.cast.length, gap: false };
    return P;
  }
  /** the head a kept tape is filed under: file()'s own head fields as they stand now (the switches, the floor's statics) */
  head(g: Game, meta: ReplayMeta = {}): KeptHead {
    const flags: ReplayFile['flags'] = { godMode: !!g.godMode, aiEnabled: !!g.aiEnabled, infiniteAmmo: !!g.infiniteAmmo, playerInvisible: !!g.playerInvisible };
    { const T = g.tune as unknown as Record<string, unknown>; for (const k of ['chaos', 'difficulty', 'hard']) if (typeof T?.[k] === 'number' || typeof T?.[k] === 'boolean' || typeof T?.[k] === 'string') flags[k] = T[k] as number; }
    return { v: REPLAY_VERSION, game: 'twopointsix', ...(meta.commit ? { commit: meta.commit } : {}), ...(meta.url !== undefined ? { url: meta.url } : {}), ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      level: { fp: meta.fp?.fp ?? '', boxes: meta.fp?.boxes ?? g.level.boxes.length, ...(meta.levelFile ? { file: meta.levelFile } : {}), ...(meta.scenario ? { scenario: meta.scenario } : {}) },
      ...(g.dice ? { seed: g.dice.seed } : {}), flags, hz: REPLAY.hz, keep: REPLAY.seconds, map: mapOf(g) };
  }

  /** the ring as a file, as it stands (the ring is not touched: play goes on, a later save holds this stretch and more) */
  file(g: Game, why: string, meta: ReplayMeta = {}): ReplayFile {
    const S = this.samples; const r0 = S.length ? S[0].r : this.r;
    const rb = (r: number) => Math.round((r - r0) * 1000) / 1000;
    const flags: ReplayFile['flags'] = { godMode: !!g.godMode, aiEnabled: !!g.aiEnabled, infiniteAmmo: !!g.infiniteAmmo, playerInvisible: !!g.playerInvisible };
    { const T = g.tune as unknown as Record<string, unknown>; for (const k of ['chaos', 'difficulty', 'hard']) if (typeof T?.[k] === 'number' || typeof T?.[k] === 'boolean' || typeof T?.[k] === 'string') flags[k] = T[k] as number; }
    // the cast as THIS file needs it: rows the ring no longer names (the men of runs before a restart, trimmed out since) stay behind and the indices close up
    const used = new Set<number>();
    for (const q of S) { for (const m of q.m ?? []) used.add(m[0]); for (const x of q.x ?? []) { used.add(x[0]); const fo = x[1].foe; if (fo !== undefined && fo >= 0) used.add(fo); } for (const ci of q.gone ?? []) used.add(ci); }
    for (const e of this.events) if (e.who >= 0) used.add(e.who);
    const to = new Map<number, number>(), cast: CastRow[] = []; this.cast.forEach((c, ci) => { if (used.has(ci)) { to.set(ci, cast.length); cast.push({ ...c }); } });
    const re = (ci: number) => to.get(ci) ?? -1;
    const sample = (q: Sample): Sample => { const o: Sample = { ...q, r: rb(q.r) };
      if (q.m) o.m = q.m.map(m => { const c = m.slice() as ManPos; c[0] = re(m[0]); return c; });
      if (q.x) o.x = q.x.map(([ci, d]) => [re(ci), d.foe !== undefined && d.foe >= 0 ? { ...d, foe: re(d.foe) } : d] as [number, ManDo]);
      if (q.gone) o.gone = q.gone.map(re).filter(i => i >= 0);
      return o; };
    return {
      v: REPLAY_VERSION, game: 'twopointsix', kind: 'replay', savedAt: new Date().toISOString(), why,
      ...(meta.session ? { session: meta.session } : {}),
      ...(meta.commit ? { commit: meta.commit } : {}), ...(meta.url !== undefined ? { url: meta.url } : {}), ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      level: { fp: meta.fp?.fp ?? '', boxes: meta.fp?.boxes ?? g.level.boxes.length, ...(meta.levelFile ? { file: meta.levelFile } : {}), ...(meta.scenario ? { scenario: meta.scenario } : {}) },
      ...(g.dice ? { seed: g.dice.seed } : {}), flags,
      hz: REPLAY.hz, seconds: Math.round(this.seconds * 10) / 10, keep: REPLAY.seconds,
      map: mapOf(g), cast,
      samples: S.map(sample), events: this.events.map(e => ({ ...e, r: rb(e.r), who: e.who >= 0 ? re(e.who) : -1 })), lines: this.lines.map(l => ({ ...l, r: Math.min(Math.max(rb(l.r), 0), S.length ? rb(S[S.length - 1].r) : 0) })),   // (a line is stamped on the buffer's clock, which runs a step or two past the last 20 Hz sample: a reader's timeline ends at that sample)
      notes: [],
      ...(() => { const t = this.tape.file(meta.url ?? '', meta.levelFile); return t ? { rerun: t } : {}; })(),
    };
  }
}

/** the floor as the viewer draws it: every solid thing between knee and head height (the statics as they stand at the save — a wall a charge took is not drawn) */
export function mapOf(g: Game): ReplayMap {
  const boxes: number[] = []; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of g.level.boxes) {
    if (b.flags & BOX_NOSHADOW && !(b.flags & BOX_GLASS)) continue;
    const top = b.c[1] + b.h[1], bot = b.c[1] - b.h[1]; if (top < 0.35 || bot > 1.6) continue;
    if (b.h[0] < 0.01 || b.h[2] < 0.01) continue;
    const kind = b.flags & BOX_GLASS ? 2 : top >= 1.9 && bot <= 0.5 ? 0 : 1;
    boxes.push(r2(b.c[0]), r2(b.c[2]), r2(b.h[0]), r2(b.h[2]), Math.round((b.yaw || 0) * 1800 / Math.PI) / 10, kind);
    const e = Math.hypot(b.h[0], b.h[2]); if (kind === 0) { x0 = Math.min(x0, b.c[0] - e); x1 = Math.max(x1, b.c[0] + e); z0 = Math.min(z0, b.c[2] - e); z1 = Math.max(z1, b.c[2] + e); }
  }
  if (!Number.isFinite(x0)) { x0 = 0; z0 = 0; x1 = 40; z1 = 28; }
  const doors = (g.doors?.list ?? []).map(d => ({ name: d.def.name, hinge: [r2(d.def.hinge[0]), r2(d.def.hinge[1])] as [number, number], dir: Math.round(d.def.closedDir * 1800 / Math.PI) / 10, width: r2(d.def.width) }));
  return { bounds: [r2(x0), r2(z0), r2(x1), r2(z1)], boxes, doors };
}
