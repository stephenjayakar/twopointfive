// THE ROLLBACK SNAPSHOT: the whole simulation as it stands at a tick, taken in memory and put back — into the same Game (what rollback netcode does every time a
// prediction was wrong) or into another Game stood up on the same level (a fresh one). Beside the checkpoint (savestate.ts), not instead of it: a checkpoint is a
// FILE a player keeps (a schema, refused in squad play and mid-action, a restart under it); this is every bit the next tick reads, in any mode, at any moment — men
// moving, rounds in the air, a leaf swinging, a fuse burning. ONE CALLER IN PLAY: a save kept in memory with a team on the floor (savestate.ts SAVETIMELINE).
//   takeSnapshot(g)            walk everything the Game reaches (and the side tables, module variables and module containers registered in math/side.ts) and keep
//                              a shallow copy of each array, object, Map, Set and typed array it meets. No schema: a new field on a Guard is in the next snapshot.
//   takeSnapshot(g, since)     the same, a tick or a few later: only what changed since that snapshot is copied, the rest is shared with it (what a rollback ring
//                              takes every tick: a fraction of the time and of the bytes)
//   restoreSnapshot(s)         write every copy back into the object it was taken from. Identities stand: whoever held a Guard still holds that Guard.
//   restoreSnapshot(s, other)  the same state into ANOTHER Game: the two are walked side by side from their roots, an object of the snapshot is written into the
//                              object standing in the same place there (the other game's own level, its own closures, its own host), and one with no counterpart
//                              (a man spawned since) is made anew.
//   stateHash(g) / stateDiff(a, b)   every value of the state in one fixed order, to the raw bit, folded into a word / compared with the paths that differ:
//                              (stateDiff keeps a state as rows over a tree of its paths, not as strings; where it goes on and where it ends: flatDiff)
//                              what tools/qa/rollback-check.ts holds 'play goes on exactly as the unbroken run' with.
// WHAT IS NOT IN IT (and must not be reached for on the way back): the host — `Game.engine` but for its CPU box world and light set, the mixer, the smoke solver
// (its fields live on the GPU), the session journal, and inside a game object whatever is a `HostOwned` (the GPU light meter's buffers; its last answers and this
// frame's asks ARE in it) — and the character file every man's clips are read from (STATIC: never written; `stateHash(g, true)` walks it
// too, so a check can hold that). A function is kept as it is: what a closure has captured cannot be seen from here, so state belongs on objects and in side
// tables, never in a closure (the check's static pass names the module variables that are not registered).
// (src/game is one import cycle: nothing below runs at the top level but type imports and math/side.ts, which is outside it.)
import { SideMap, SideSet, sideRegistry, type SideVar, wallClock, wallClockKeys, HostOwned } from '../math/side';
import type { Game } from './game';

type Rec = Record<string, unknown>;
type Typed = Float32Array;   // (any typed array: the calls used are the same on all of them)
type Table = SideMap<object, unknown> | SideSet<object>;

const K_ATOM = 0, K_ARR = 1, K_TYPED = 2, K_OBJ = 3, K_MAP = 4, K_SET = 5, K_BUF = 6, K_SIDEMAP = 7, K_SIDESET = 8, K_RAWWEAK = 9, K_WORDS = 10;
const PROTO_KIND = new Map<object | null, number>();
/** what an object that is neither an array nor a typed array is, decided once for its prototype */
function protoKind(o: object): number {
  const p = Object.getPrototypeOf(o) as object | null;
  let k = PROTO_KIND.get(p);
  if (k === undefined) {
    k = p === null || p === Object.prototype ? K_OBJ : o instanceof HostOwned ? K_ATOM : o instanceof SideMap ? K_SIDEMAP : o instanceof SideSet ? K_SIDESET : o instanceof Map ? K_MAP : o instanceof Set ? K_SET
      : o instanceof ArrayBuffer ? K_BUF : o instanceof WeakMap || o instanceof WeakSet ? K_RAWWEAK : Object.prototype.toString.call(o) === '[object Object]' ? K_OBJ : K_ATOM;
    PROTO_KIND.set(p, k);
  }
  return k;
}
const isTyped = (o: object): o is Typed => ArrayBuffer.isView(o) && (o as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT !== undefined;
const isObj = (v: unknown): v is object => typeof v === 'object' && v !== null;

/** the Game's fields that are the host's (left exactly as they are, in either game) and the ones that are never written (the character file). The host's own
 *  INSIDE a game object is a `HostOwned` (math/side.ts): the GPU light meter's buffers and what it last sent (render/probe.ts `Plumbing`) — walked and put back
 *  like the rest of the meter, a page's next frame copied into a buffer still being mapped and the browser refused the whole frame. */
const HOST_FIELDS = ['engine', 'audio', 'smoke', 'journal'] as const;
const STATIC_FIELDS = ['ch'] as const;
/** where a walk starts: the Game, and the two CPU pieces of the host the simulation reads and writes (the box world its rays are cast in, the light set) */
function rootsOf(g: Game): object[] { const e = (g as unknown as { engine: { world: object; lights: object } }).engine; return [g, e.world, e.lights]; }
function fieldsOf(g: Game, names: readonly string[]): object[] { const out: object[] = []; for (const f of names) { const v = (g as unknown as Rec)[f]; if (isObj(v)) out.push(v); } return out; }

/** what a run of snapshots of one game shares: every object any of them has met, numbered as met (the copied ones, and the ones left alone — a side table, something of
 *  the host's, a static), with the kind of each; a long typed array's own bytes as 32-bit words (`views`: it is compared, copied and put back through them). Only ever
 *  added to: an object that has dropped out of the game keeps its number (a snapshot taken while it stood still holds it), so a new chain is begun now and then */
interface Chain {
  readonly index: Map<object, number>; readonly nodes: object[]; readonly kinds: number[]; readonly views: (Uint32Array | null)[];
  /** how many objects its first snapshot (the one taken by a whole walk) held */
  readonly base: { n: number };
  /** room to work in while one snapshot is taken: the take that last met each object (`epoch` counts them); what the snapshot it is taken since has of each (its copy,
   *  its keys, `met`: 0 not held, else one more than how many snapshots back it was first held; `fresh`: how many snapshots back its copy was made) */
  stamp: Int32Array; met: Uint8Array; fresh: Uint8Array; epoch: number; readonly last: unknown[]; readonly lastShape: (Shape | undefined)[]; readonly stack: number[];
  /** a take is under way in this room — or one threw half way and left it as it stood: no snapshot of this chain is taken `since` again (each still restores) */
  busy: boolean;
}
export interface Snapshot {
  /** the Game it was taken from */
  readonly game: Game;
  readonly chain: Chain;
  /** the objects it holds — their numbers in the chain — and the shallow copy of each (children by reference): an array's elements, a typed array's, an object's VALUES
   *  in the order of its keys (`shapes`: its make), a Map's [key, value …], a Set's members; nothing for a side table (its entries are below). A copy is the very one of the
   *  snapshot this was taken `since` when the object had not changed: a snapshot a tick costs what moved in that tick, not the whole game.
   *  `ages`: how many snapshots back (each taken since the one before) the object was first held, times 16, and how many back its copy was made — 15 at most each */
  readonly at: Int32Array; readonly data: unknown[]; readonly shapes: (Shape | undefined)[]; readonly ages: Uint8Array;
  /** every side table (the named ones, and the ones found hanging off an object) with its entries whose key the snapshot holds: [key, value, key, value …] of a map, [key, key …] of a set */
  readonly tables: Table[]; readonly entries: unknown[][];
  /** the registered module variables and what each held */
  readonly vars: SideVar[]; readonly varVals: unknown[];
  /** plain WeakMaps / WeakSets met on the way: state a snapshot cannot hold (the check is red on one) */
  readonly rawWeak: object[];
}

/** a typed array long enough, and sitting on words, to be handled as 32-bit words */
const WORDS_FROM = 256;
/** a snapshot is taken by a whole walk again (and a new chain begun) when the last one holds this much more than the chain's first did — objects that have dropped out
 *  of the game since, still held — or the chain has met this many times what a snapshot holds (the game makes a thousand objects a tick and drops as many) */
const WALK_AGAIN = 1.25, WALK_SLACK = 2048, CHAIN_GROWS = 8, CHAIN_SLACK = 65536;
/** an object first held within this many snapshots is held again only if met (most of what a tick makes is dropped within two); one whose copy was made within as many is looked into */
const YOUNG = 3;

/** the whole simulation as it stands.
 *  `since`: a snapshot taken of this game before (the last one, in a rollback ring; the one just restored, after a rollback) — an object that has not changed since is not
 *  copied again, its copy is shared, and the game is not walked: the objects that snapshot held are gone through one by one, and only one that has changed (or had the
 *  tick before) is looked into for what it points at. A fraction of the time and of the bytes. Any snapshot of the same game will do.
 *  WHY THAT HOLDS EVERYTHING: an object the game reaches now is pointed at by one it reaches. If that one's copy is YOUNG snapshots old or more, it has pointed at it
 *  for as long, so the object has been held for as long: it is one of the old ones, gone through whether met or not. If the copy is younger (or new now), the one
 *  pointing is looked into and the object is met. So an object held for fewer than YOUNG snapshots is kept only if met — what a tick makes and the next drops is gone
 *  from the next snapshot — and what a snapshot may hold too much of is an older object nothing points at any more (a comparison a tick, until the next whole walk). */
export function takeSnapshot(g: Game, since?: Snapshot): Snapshot {
  const reg = sideRegistry();
  const from = since !== undefined && since.game === g && !since.chain.busy ? since : null, fc = from ? from.chain : null;
  const whole = !fc || from!.at.length > WALK_AGAIN * fc.base.n + WALK_SLACK || fc.index.size > CHAIN_GROWS * from!.at.length + CHAIN_SLACK;
  const chain: Chain = whole ? { index: new Map(), nodes: [], kinds: [], views: [], base: { n: 0 }, stamp: new Int32Array(1 << 16), met: new Uint8Array(1 << 16), fresh: new Uint8Array(1 << 16), epoch: 0, last: [], lastShape: [], stack: [], busy: false } : fc;
  chain.busy = true; if (fc) fc.busy = true;   // (put down again on the way out, below: a take that throws leaves both rooms marked)
  const { index, nodes, kinds, views, stack } = chain, epoch = ++chain.epoch;
  let stamp = chain.stamp, met = chain.met, fresh = chain.fresh, seenN = 0;
  const Game = (g as object).constructor;
  // what `since` has of each object, laid out by its number in that snapshot's chain
  const last = fc ? fc.last : [], lastShape = fc ? fc.lastShape : [], fIndex = fc ? fc.index : null;
  if (from) { const fa = from.at, fd = from.data, fs = from.shapes, ff = from.ages;
    for (let j = 0; j < fa.length; j++) { const i = fa[j]; last[i] = fd[j]; lastShape[i] = fs[j]; if (!whole) { met[i] = (ff[j] >> 4) + 1; fresh[i] = ff[j] & 15; } } }
  // (the four lists are written by place into room made at once: pushed one by one they were a quarter of the whole take)
  let cap = (from ? from.at.length : 32768) + 4096, held = 0;
  let at = new Int32Array(cap), ages = new Uint8Array(cap); const data: unknown[] = new Array(cap), shapes: (Shape | undefined)[] = new Array(cap), found: Table[] = [], rawWeak: object[] = [];
  const put = (i: number, c: unknown, shape: Shape | undefined, age: number): void => {
    if (held === cap) { cap *= 2; const a2 = new Int32Array(cap); a2.set(at); at = a2; const g2 = new Uint8Array(cap); g2.set(ages); ages = g2; }
    at[held] = i; ages[held] = age; data[held] = c; shapes[held] = shape; held++;
  };
  /** an object met for the first time by this chain: numbered, with its kind */
  const add = (o: object): number => {
    let k: number, w: Uint32Array | null = null;
    if (Array.isArray(o)) k = K_ARR;
    else if (ArrayBuffer.isView(o)) { if (!isTyped(o)) k = K_ATOM; else if (o.byteLength >= WORDS_FROM && (o.byteOffset & 3) === 0 && (o.byteLength & 3) === 0) { k = K_WORDS; w = new Uint32Array(o.buffer, o.byteOffset, o.byteLength >>> 2); } else k = K_TYPED; }
    else k = protoKind(o);
    const i = nodes.length; nodes.push(o); kinds.push(k); views.push(w); index.set(o, i);
    if (i >= stamp.length) { const n2 = stamp.length * 2, s2 = new Int32Array(n2); s2.set(stamp); stamp = chain.stamp = s2; const m2 = new Uint8Array(n2); m2.set(met); met = chain.met = m2; const f2 = new Uint8Array(n2); f2.set(fresh); fresh = chain.fresh = f2; }
    return i;
  };
  /** an object pointed at: put on the stack to be held, unless it is already — or it is one of the old ones (those are gone through, met or not) */
  const see = (v: object): void => {
    let i = index.get(v);
    if (i === undefined) { if (v.constructor === Game && v !== g) return; i = add(v); }   // (ANOTHER Game, reached through a module's memo every game in the process shares: not this game's state, never walked into, never put back)
    else if (stamp[i] === epoch || met[i] > YOUNG) return;
    stamp[i] = epoch; stack.push(i); seenN++;
  };
  const seeFrom = (a: unknown[], from: number): void => { for (let j = from; j < a.length; j++) { const x = a[j]; if (typeof x === 'object' && x !== null) see(x); } };
  /** object `i` into the snapshot: the copy `since` has when it is still that to the bit, else a new one. `scan`: everything it points at is seen (always, of a new copy,
   *  from the first place it differs on: what stands before that `since` holds) */
  const hold = (i: number, scan: boolean): void => {
    const o = nodes[i], kind = kinds[i];
    if (kind === K_ATOM) return;
    if (kind === K_SIDEMAP || kind === K_SIDESET) { if ((o as Table).sideName === undefined) found.push(o as Table); put(i, undefined, undefined, Math.min(15, met[i]) << 4 | 15); return; }
    if (kind === K_RAWWEAK) { rawWeak.push(o); put(i, undefined, undefined, Math.min(15, met[i]) << 4 | 15); return; }
    let li = i; if (whole) { const x = fIndex ? fIndex.get(o) : undefined; li = x === undefined ? -1 : x; }
    const was = li >= 0 ? last[li] : undefined; let c = was, shape: Shape | undefined;
    switch (kind) {
      case K_ARR: { const a = o as unknown[], n = a.length; let j = 0;
        if (c !== undefined && (c as unknown[]).length === n) j = firstDiff(a, c as unknown[], n); else c = undefined;
        if (c === undefined || j < n) { const b = a.slice(); c = b; seeFrom(b, scan ? 0 : j); } else if (scan) seeFrom(a, 0);
        break; }
      case K_TYPED: if (c === undefined || firstDiffNum(o as Typed, c as Typed, (o as Typed).length) < (o as Typed).length) c = (o as Typed).slice(); break;
      case K_WORDS: { const a = views[i]!; if (c === undefined || firstDiffWords(a, c as Uint32Array, a.length) < a.length) c = a.slice(); break; }
      case K_OBJ: { const ks = Object.keys(o), n = ks.length; let sh = li >= 0 ? lastShape[li] : undefined, j = 0;
        if (c !== undefined && sh !== undefined && sh.keys.length === n && sameKeys(ks, sh.keys, n)) j = sh.diff(o as Rec, c as unknown[]); else { c = undefined; sh = shapeFor(ks); }
        if (c === undefined || j < n) { const b = sh.copy(o as Rec); c = b; seeFrom(b, scan ? 0 : j); } else if (scan) seeFrom(c as unknown[], 0);
        shape = sh; break; }
      case K_MAP: { const m = o as Map<unknown, unknown>, b = c as unknown[] | undefined; let j = 0, eq = b !== undefined && m.size * 2 === b.length; const fresh: unknown[] = [];
        m.forEach((v, k) => { if (eq && (differs(k, b![j]) || differs(v, b![j + 1]))) eq = false; j += 2; fresh.push(k, v); });
        if (!eq) c = fresh;
        if (!eq || scan) for (let q = 0; q < fresh.length; q++) { const x = fresh[q]; if (typeof x === 'object' && x !== null) see(x); }
        break; }
      case K_SET: { const m = o as Set<unknown>, b = c as unknown[] | undefined; let j = 0, eq = b !== undefined && m.size === b.length; const fresh: unknown[] = [];
        m.forEach(v => { if (eq && differs(v, b![j])) eq = false; j++; fresh.push(v); });
        if (!eq) c = fresh;
        if (!eq || scan) for (let q = 0; q < fresh.length; q++) { const x = fresh[q]; if (typeof x === 'object' && x !== null) see(x); }
        break; }
      case K_BUF: c = (o as ArrayBuffer).slice(0); break;
    }
    put(i, c, shape, Math.min(15, met[i]) << 4 | (c !== was ? 0 : Math.min(15, fresh[i] + 1)));
  };
  const drain = (): void => { while (stack.length) hold(stack.pop()!, true); };
  // the host's and the statics as they stand now: met, never walked into (a mixer or a journal put in since the chain began is not either)
  for (const f of [HOST_FIELDS, STATIC_FIELDS]) for (const o of fieldsOf(g, f)) { let i = index.get(o); if (i === undefined) i = add(o); stamp[i] = epoch; }
  if (whole) {
    // everything the statics reach is met and never walked into again by this chain (the character file's clips hang off every man: a fifth of all the game reaches)
    const st: object[] = fieldsOf(g, STATIC_FIELDS).slice();
    for (const o of st) kinds[index.get(o)!] = K_ATOM;
    while (st.length) { const o = st.pop()!, each = (v: unknown): void => { if (typeof v === 'object' && v !== null && !index.has(v)) { const i = add(v); if (kinds[i] !== K_SIDEMAP && kinds[i] !== K_SIDESET && kinds[i] !== K_RAWWEAK) { kinds[i] = K_ATOM; st.push(v); } } };
      if (Array.isArray(o)) o.forEach(each); else if (ArrayBuffer.isView(o)) continue;
      else { const k = protoKind(o); if (k === K_OBJ) Object.values(o).forEach(each); else if (k === K_MAP) (o as Map<unknown, unknown>).forEach((v, key) => { each(key); each(v); }); else if (k === K_SET) (o as Set<unknown>).forEach(each); } }
    for (const r of rootsOf(g)) see(r);
  } else { // the old ones `since` holds: each as it is now. One that is not to be looked into and is what its copy says — nearly all of them — is held right here
    const fa = from!.at;
    for (let q = 0; q < fa.length; q++) {
      const i = fa[q]; if (met[i] <= YOUNG || stamp[i] === epoch) continue;
      stamp[i] = epoch;
      if (fresh[i] >= YOUNG) {
        const o = nodes[i], c = last[i]; let same = false, sh: Shape | undefined;
        switch (kinds[i]) {
          case K_ARR: { const n = (o as unknown[]).length; same = n === (c as unknown[]).length && firstDiff(o as unknown[], c as unknown[], n) === n; break; }
          case K_TYPED: { const n = (o as Typed).length; same = firstDiffNum(o as Typed, c as Typed, n) === n; break; }
          case K_WORDS: { const a = views[i]!, n = a.length; same = firstDiffWords(a, c as Uint32Array, n) === n; break; }
          case K_OBJ: { const ks = Object.keys(o), n = ks.length; sh = lastShape[i]!; same = sh.keys.length === n && sameKeys(ks, sh.keys, n) && sh.diff(o as Rec, c as unknown[]) === n; break; }
          case K_MAP: { const b = c as unknown[]; if ((o as Map<unknown, unknown>).size * 2 === b.length) { let j = 0; same = true; for (const e of o as Map<unknown, unknown>) { if (differs(e[0], b[j]) || differs(e[1], b[j + 1])) { same = false; break; } j += 2; } } break; }
          case K_SET: { const b = c as unknown[]; if ((o as Set<unknown>).size === b.length) { let j = 0; same = true; for (const v of o as Set<unknown>) { if (differs(v, b[j++])) { same = false; break; } } } break; }
        }
        if (same) { const m = met[i], f = fresh[i] + 1; put(i, c, sh, (m > 15 ? 15 : m) << 4 | (f > 15 ? 15 : f)); continue; }
      }
      hold(i, fresh[i] < YOUNG);   // (one whose copy is young is looked into: the young ones hang off those)
    }
  }
  for (const r of reg.roots) see(r.obj);
  const vars = reg.vars.slice(), varVals = vars.map(v => v.get());
  for (const v of varVals) if (typeof v === 'object' && v !== null) see(v);
  drain();
  // the side tables: an entry is in when its key is held — and its value may reach more objects, whose entries in other tables are in too: round until nothing is added
  const tables: Table[] = reg.tables.slice(), entries: unknown[][] = [], pend: object[][] = [];
  for (let moved = true, nFound = 0, was = -1; moved;) {
    moved = false;
    if (seenN === was && nFound === found.length) break;   // (nothing was met since the last round: no key left over can have come in)
    was = seenN;
    while (nFound < found.length) tables.push(found[nFound++]);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]; let p = pend[i];
      if (p === undefined) { p = pend[i] = t.liveKeys(); entries[i] = []; }
      if (!p.length) continue;
      const e = entries[i], map = t instanceof SideMap ? t : null; let n = 0;
      for (let j = 0; j < p.length; j++) { const k = p[j], ki = index.get(k);
        if (ki === undefined || (stamp[ki] !== epoch && kinds[ki] !== K_ATOM)) { p[n++] = k; continue; }   // (a static or a thing of the host's the chain has met is there for good: a snapshot since does not meet it again)
        moved = true;
        if (map) { const v = map.get(k); e.push(k, v); if (typeof v === 'object' && v !== null) see(v); } else e.push(k); }
      p.length = n;
    }
    drain();
    if (nFound < found.length) moved = true;
  }
  if (from) { const fa = from.at, fm = fc!.met; for (let j = 0; j < fa.length; j++) { const i = fa[j]; last[i] = undefined; lastShape[i] = undefined; fm[i] = 0; } }
  data.length = held; shapes.length = held; chain.busy = false; if (fc) fc.busy = false;
  if (whole) { chain.base.n = held; ages.fill(255, 0, held); }   // (a whole walk has met everything it holds: all of it is old to the next)
  return { game: g, chain, at: at.subarray(0, held), data, shapes, ages: ages.subarray(0, held), tables, entries, vars, varVals, rawWeak };
}

/** an object's make: its keys in their order, and three small functions written for exactly those keys (read by name, a key is ten times dearer than a place in a list):
 *  `diff` the first key whose value is not, to the bit, what a list of values has (how many keys when none) · `copy` its values as a list · `put` a list back into it */
/** a field written back. One that is COMPUTED (`get budget() { … }` with no setter: a snapshot holds what it gave, as it holds any enumerable key) is left to compute
 *  — what it gives follows from the rest of the state; so is a field of a frozen row. (The functions written from text for a make are not strict: the same there.) */
function setKey(o: Rec, k: string, v: unknown): void { try { o[k] = v; } catch { /* computed, or frozen */ } }
/** the keys of an object taken off before they are put on again in the copy's order — but not a computed one, which would come back as a plain value */
function dropKeys(o: Rec, ks: string[]): void { for (const k of ks) { const d = Object.getOwnPropertyDescriptor(o, k); if (d && 'value' in d && d.configurable) delete o[k]; } }
interface Shape { readonly keys: string[]; diff(o: Rec, b: unknown[]): number; copy(o: Rec): unknown[]; put(o: Rec, c: unknown[]): void }
const MAKES = new Map<string, Shape>();
let written = true;   // (down for good the first time the page will not have a function made from text)
function shapeFor(keys: string[]): Shape {
  const id = keys.join('\u0001'); let sh = MAKES.get(id); if (sh) return sh;
  const n = keys.length;
  if (written && n <= 512 && MAKES.size < 4096) try {
    const at = keys.map(k => `o[${JSON.stringify(k)}]`);
    sh = { keys,
      diff: new Function('o', 'b', `var x,y;${at.map((a, j) => `x=${a};y=b[${j}];if(x!==y?(x===x||y===y):(x===0&&1/x!==1/y))return ${j};`).join('')}return ${n};`) as Shape['diff'],
      copy: new Function('o', `return [${at.join(',')}];`) as Shape['copy'],
      put: new Function('o', 'c', `var a,b;${at.map((a, j) => `a=${a};b=c[${j}];if(a!==b||(b===0&&1/a!==1/b))${a}=b;`).join('')}`) as Shape['put'] };
  } catch { written = false; }
  sh ??= { keys,
    diff(o, b) { for (let j = 0; j < n; j++) if (differs(o[keys[j]], b[j])) return j; return n; },
    copy(o) { const c = new Array<unknown>(n); for (let j = 0; j < n; j++) c[j] = o[keys[j]]; return c; },
    put(o, c) { for (let j = 0; j < n; j++) { const k = keys[j], b = c[j], a = o[k]; if (a !== b || (b === 0 && !Object.is(a, b))) setKey(o, k, b); } } };
  if (MAKES.size < 8192) MAKES.set(id, sh);   // (past that — a game keying objects by ever new names — a make is written for the call and dropped)
  return sh;
}
/** the first place two lists part, to the bit (0 and -0 differ; a NaN is a NaN) — `n` when they do not. Small and apart, one for each make of list: the take spends
 *  most of its time here */
function firstDiff(a: unknown[], b: unknown[], n: number): number {
  for (let j = 0; j < n; j++) { const x = a[j], y = b[j]; if (x !== y ? (x === x || y === y) : (x === 0 && 1 / (x as number) !== 1 / (y as number))) return j; }
  return n;
}
function firstDiffNum(a: Typed, b: Typed, n: number): number {
  for (let j = 0; j < n; j++) { const x = a[j], y = b[j]; if (x !== y ? (x === x || y === y) : (x === 0 && 1 / x !== 1 / y)) return j; }
  return n;
}
function firstDiffWords(a: Uint32Array, b: Uint32Array, n: number): number { for (let j = 0; j < n; j++) if (a[j] !== b[j]) return j; return n; }
function sameKeys(a: string[], b: string[], n: number): boolean { for (let j = 0; j < n; j++) if (a[j] !== b[j]) return false; return true; }
/** two values that are not the same to the bit (0 and -0 differ; a NaN is a NaN) */
function differs(x: unknown, y: unknown): boolean { return x !== y ? (x === x || y === y) : (x === 0 && 1 / (x as number) !== 1 / (y as number)); }

/** write `s` back: into the Game it was taken from (in place), or into `into` — another Game on the same level */
export function restoreSnapshot(s: Snapshot, into: Game = s.game): void { if (into === s.game) restoreInPlace(s); else restoreMapped(s, into); }

function restoreInPlace(s: Snapshot): void {
  const { at, data, shapes } = s, { nodes, kinds, views, index } = s.chain;
  const G = s.game as unknown as Rec, host = HOST_FIELDS.map(f => G[f]);   // (the host's own — a journal begun since, a mixer swapped — stay as they are NOW: not the simulation's to put back)
  for (let q = 0; q < at.length; q++) {
    const i = at[q];
    switch (kinds[i]) {
      case K_ARR: { const o = nodes[i] as unknown[], c = data[q] as unknown[], n = c.length; if (o.length !== n) o.length = n;
        for (let j = 0; j < n; j++) { const b = c[j], a = o[j]; if (a !== b || (b === 0 && !Object.is(a, b))) o[j] = b; } break; }
      case K_TYPED: { const o = nodes[i] as Typed, c = data[q] as Typed, n = c.length; if (n <= 32) for (let j = 0; j < n; j++) o[j] = c[j]; else o.set(c); break; }
      case K_WORDS: views[i]!.set(data[q] as Uint32Array); break;
      case K_OBJ: { const o = nodes[i] as Rec, c = data[q] as unknown[], sh = shapes[q]!, pk = sh.keys, ks = Object.keys(o), n = pk.length;
        if (ks.length === n && sameKeys(ks, pk, n)) sh.put(o, c);
        else { dropKeys(o, ks); for (let j = 0; j < n; j++) setKey(o, pk[j], c[j]); }   // (a key added or dropped since, or their order: as the copy has them — a for-in over it must run as it would have)
        break; }
      case K_MAP: { const o = nodes[i] as Map<unknown, unknown>, c = data[q] as unknown[]; o.clear(); for (let j = 0; j < c.length; j += 2) o.set(c[j], c[j + 1]); break; }
      case K_SET: { const o = nodes[i] as Set<unknown>, c = data[q] as unknown[]; o.clear(); for (let j = 0; j < c.length; j++) o.add(c[j]); break; }
      case K_BUF: new Uint8Array(nodes[i] as ArrayBuffer).set(new Uint8Array(data[q] as ArrayBuffer)); break;
    }
  }
  // the side tables: every entry under a key this chain has met goes (an object made since is out of the game again; another Game's entries in the same table stand), the snapshot's are set
  const keys: object[] = [];
  for (let i = 0; i < s.tables.length; i++) {
    const t = s.tables[i], e = s.entries[i];
    keys.length = 0; t.liveKeys(keys);
    for (let j = 0; j < keys.length; j++) if (index.has(keys[j])) t.delete(keys[j]);
    if (t instanceof SideMap) for (let j = 0; j < e.length; j += 2) t.set(e[j] as object, e[j + 1]); else for (let j = 0; j < e.length; j++) t.add(e[j] as object);
  }
  for (let i = 0; i < s.vars.length; i++) s.vars[i].set(s.varVals[i] as never);
  HOST_FIELDS.forEach((f, i) => { if (G[f] !== host[i]) G[f] = host[i]; });
}

/** everything a game reaches from its own roots and through the side tables — NOT through the module variables and containers every game in the process shares
 *  (a memo there may name another game's men) */
function reachOf(g: Game): Set<object> {
  const seen = new Set<object>(), stack: object[] = [], found: Table[] = [];
  const Game = (g as object).constructor;
  const push = (v: unknown): void => { if (isObj(v) && !seen.has(v) && (v.constructor !== Game || v === g)) { seen.add(v); stack.push(v); } };
  for (const o of [...fieldsOf(g, HOST_FIELDS), ...fieldsOf(g, STATIC_FIELDS)]) seen.add(o);
  const drain = (): void => { while (stack.length) { const o = stack.pop()!;
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) push(o[i]); continue; }
    if (ArrayBuffer.isView(o)) continue;
    switch (protoKind(o)) {
      case K_OBJ: { const vs = Object.values(o); for (let i = 0; i < vs.length; i++) push(vs[i]); break; }
      case K_MAP: (o as Map<unknown, unknown>).forEach((v, k) => { push(k); push(v); }); break;
      case K_SET: (o as Set<unknown>).forEach(push); break;
      case K_SIDEMAP: case K_SIDESET: if ((o as Table).sideName === undefined) found.push(o as Table); break;
    } } };
  for (const r of rootsOf(g)) push(r);
  drain();
  const tables: Table[] = sideRegistry().tables.slice();
  for (let moved = true, nFound = 0; moved;) {
    moved = false; while (nFound < found.length) tables.push(found[nFound++]);
    for (const t of tables) { if (!(t instanceof SideMap)) continue; for (const k of t.liveKeys()) if (seen.has(k)) { const v = t.get(k); if (isObj(v) && !seen.has(v)) { push(v); moved = true; } } }
    drain(); if (nFound < found.length) moved = true;
  }
  return seen;
}

/** functions a cross-game restore has written into a game they were not made in */
const BROUGHT = new WeakSet<Function>();
function restoreMapped(s: Snapshot, into: Game): void {
  const { data, shapes } = s, { nodes: cn, kinds: ck } = s.chain, N = s.at.length;
  /** the snapshot's objects and the kind of each, in its own order */
  const nodes: object[] = new Array(N), kinds: number[] = new Array(N);
  const at = new Map<object, number>(); for (let i = 0; i < N; i++) { const ci = s.at[i]; nodes[i] = cn[ci]; kinds[i] = ck[ci]; if (data[i] !== undefined) at.set(nodes[i], i); }
  /** an object of the snapshot's game → the object that stands for it in `into` */
  const map = new Map<object, object>();
  /** objects of `into` already standing for one (and the ones made anew), and the made-anew alone */
  const claimed = new Set<object>(), made = new Set<object>();
  const bufs = new Map<ArrayBuffer, ArrayBuffer>();
  const stack: [object, unknown][] = [], later: object[] = [];
  let mayMake = false;
  const fits = (kind: number, a: object, b: object): boolean => kind === K_ARR ? Array.isArray(b) : Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
    && ((kind !== K_TYPED && kind !== K_WORDS) || (a as Typed).length === (b as Typed).length) && (kind !== K_BUF || (a as ArrayBuffer).byteLength === (b as ArrayBuffer).byteLength);
  const bufFor = (a: ArrayBuffer): ArrayBuffer => { let b = (map.get(a) as ArrayBuffer | undefined) ?? bufs.get(a); if (!b) bufs.set(a, b = a.slice(0)); return b; };
  const born = (a: object): object => { const t = Object.create(Object.getPrototypeOf(a) as object | null) as object, ck = wallClockKeys(a); return ck ? wallClock(t as Rec, ...ck) : t; };
  const make = (kind: number, a: object): object => kind === K_ARR ? [] : kind === K_OBJ ? born(a) : kind === K_MAP ? new Map() : kind === K_SET ? new Set()
    : kind === K_BUF ? bufFor(a as ArrayBuffer) : new ((a as Typed).constructor as new (b: ArrayBuffer, o: number, n: number) => Typed)(bufFor((a as Typed).buffer as ArrayBuffer), (a as Typed).byteOffset, (a as Typed).length);
  /** what the other game reaches as it stands: an object of the snapshot's that is in here is SHARED by the two games (a module's constant row a box's colour points at, a
   *  palette, the character file) and stands for itself — and nothing of the snapshot's is ever written into an object of the other game's that the first game reaches too */
  const theirs = reachOf(into), shared = new Set<object>();
  const bind = (a: object, b: unknown): void => {
    if (map.has(a)) return;
    if (theirs.has(a)) b = a; else if (isObj(b) && s.chain.index.has(b)) b = undefined;
    const i = at.get(a);
    if (i === undefined) {   // not a copied object: a side table, something of the host's, a static, a native — the other game's own in the same place when it has one of the same make, else this one
      const k = Array.isArray(a) || ArrayBuffer.isView(a) ? K_ATOM : protoKind(a);
      if (k === K_SIDEMAP || k === K_SIDESET) { if ((a as Table).sideName !== undefined) { map.set(a, a); return; }
        if (isObj(b) && !claimed.has(b) && Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && (b as Table).sideName === undefined) { map.set(a, b); claimed.add(b); }
        else if (mayMake) { const t = k === K_SIDEMAP ? new SideMap<object, unknown>() : new SideSet<object>(); map.set(a, t); made.add(t); } else later.push(a);
        return; }
      map.set(a, isObj(b) && Object.getPrototypeOf(a) === Object.getPrototypeOf(b) ? b : a); return;
    }
    const kind = kinds[i]; let t: object, bb: object | null = null;
    if (isObj(b) && !claimed.has(b) && fits(kind, a, b)) t = bb = b;
    else if (mayMake) { t = make(kind, a); made.add(t); }
    else { later.push(a); return; }
    map.set(a, t); claimed.add(t); if (t === a && theirs.has(a)) shared.add(a);
    const c = data[i];
    if (kind === K_ARR) { const cc = c as unknown[]; for (let j = cc.length - 1; j >= 0; j--) { const v = cc[j]; if (isObj(v)) stack.push([v, bb ? (bb as unknown[])[j] : undefined]); } }
    else if (kind === K_OBJ) { const cc = c as unknown[], pk = shapes[i]!.keys; for (let j = cc.length - 1; j >= 0; j--) { const v = cc[j]; if (isObj(v)) stack.push([v, bb ? (bb as Rec)[pk[j]] : undefined]); } }
    else if (kind === K_MAP) { const cc = c as unknown[]; for (let j = 0; j < cc.length; j += 2) { const k = cc[j], v = cc[j + 1];
      if (isObj(k)) stack.push([k, undefined]); if (isObj(v)) stack.push([v, bb && !isObj(k) ? (bb as Map<unknown, unknown>).get(k) : undefined]); } }
    else if (kind === K_SET) { for (const v of c as unknown[]) if (isObj(v)) stack.push([v, undefined]); }
  };
  const drain = (): void => { while (stack.length) { const [a, b] = stack.pop()!; bind(a, b); } };
  // the host's own and the statics: the other game's in the same field
  for (const f of [...HOST_FIELDS, ...STATIC_FIELDS]) { const a = (s.game as unknown as Rec)[f], b = (into as unknown as Rec)[f]; if (isObj(a)) map.set(a, isObj(b) ? b : a); }
  { const ra = rootsOf(s.game), rb = rootsOf(into); for (let i = 0; i < ra.length; i++) stack.push([ra[i], rb[i]]); }
  const reg = sideRegistry();
  for (const r of reg.roots) stack.push([r.obj, r.obj]);
  for (let i = 0; i < s.vars.length; i++) if (isObj(s.varVals[i])) stack.push([s.varVals[i] as object, s.vars[i].get()]);
  // side by side through the fields, then through the side tables (a value under a key that stands in both games), round until no new pair
  for (let moved = true; moved;) {
    drain(); moved = false;
    for (let i = 0; i < s.tables.length; i++) {
      const ta = s.tables[i]; if (!(ta instanceof SideMap)) continue;
      const tb = ta.sideName !== undefined ? ta : map.get(ta) as SideMap<object, unknown> | undefined; if (!tb) continue;
      const e = s.entries[i];
      for (let j = 0; j < e.length; j += 2) { const v = e[j + 1]; if (!isObj(v) || map.has(v)) continue; const kb = map.get(e[j] as object); if (kb && tb.has(kb)) { const n = map.size; bind(v, tb.get(kb)); if (map.size !== n) moved = true; } }
    }
    if (stack.length) moved = true;
  }
  // whatever is left has nobody standing in its place: made anew
  mayMake = true;
  for (let n = 0; n < later.length; n++) { bind(later[n], undefined); drain(); }
  for (let i = 0; i < N; i++) if (!map.has(nodes[i])) { bind(nodes[i], undefined); drain(); }
  for (const t of s.tables) if (t.sideName === undefined && !map.has(t)) bind(t, undefined);
  // … and the contents, every reference turned to the object that stands for it. A function already standing in the other game's object is that game's own closure: kept
  const tr = (v: unknown): unknown => typeof v === 'object' && v !== null ? map.get(v) ?? v : v;
  /** the function that stands for one of the snapshot's: the other game's OWN closure of the same code, where one stands in a slot the snapshot's stands in (not one an
   *  earlier restore brought over, which belongs to whatever stood there then) — found over ALL the slots before anything is written, so that one function of the
   *  snapshot's is one function there wherever it stands (a hook kept in two places is still the same hook: `a.onX === b.onX` holds as it did); else the snapshot's
   *  own, marked as brought over. What a closure has CAPTURED is not looked at: the same code over other values is taken for the same function. */
  const fns = new Map<Function, Function>();
  const meet = (v: unknown, was: unknown): void => { if (typeof v === 'function' && !fns.has(v) && typeof was === 'function' && (was === v || (!BROUGHT.has(was) && String(was) === String(v)))) fns.set(v, was); };
  for (let i = 0; i < N; i++) {
    const t = map.get(nodes[i])!; if (made.has(t) || t === nodes[i]) continue;
    switch (kinds[i]) {
      case K_ARR: { const c = data[i] as unknown[], o = t as unknown[]; for (let j = 0; j < c.length; j++) if (typeof c[j] === 'function') meet(c[j], o[j]); break; }
      case K_OBJ: { const c = data[i] as unknown[], pk = shapes[i]!.keys, o = t as Rec; for (let j = 0; j < pk.length; j++) if (typeof c[j] === 'function') meet(c[j], o[pk[j]]); break; }
      case K_MAP: { const c = data[i] as unknown[], o = t as Map<unknown, unknown>; for (let j = 0; j < c.length; j += 2) if (typeof c[j + 1] === 'function') meet(c[j + 1], o.get(tr(c[j]))); break; }
    }
  }
  const bring = (v: Function): Function => { const w = fns.get(v); if (w) return w; BROUGHT.add(v); return v; }, same = (v: Function): Function => v;
  for (let i = 0; i < N; i++) {
    const t = map.get(nodes[i])!;
    if (shared.has(t) || Object.isFrozen(t)) continue;   // (an object the two games share stands as it is — never written by a restore into either; nor a frozen row)
    const fn = t === nodes[i] ? same : bring;   // (a module's own container, written in place: its functions are everyone's)
    switch (kinds[i]) {
      case K_ARR: { const o = t as unknown[], c = data[i] as unknown[]; o.length = c.length;
        for (let j = 0; j < c.length; j++) { const v = c[j]; o[j] = typeof v === 'function' ? fn(v) : tr(v); } break; }
      case K_TYPED: (t as Typed).set(data[i] as Typed); break;
      case K_WORDS: new Uint32Array((t as Typed).buffer, (t as Typed).byteOffset, (t as Typed).byteLength >>> 2).set(data[i] as Uint32Array); break;
      case K_OBJ: { const o = t as Rec, c = data[i] as unknown[], pk = shapes[i]!.keys, ks = Object.keys(o);
        if (ks.length !== pk.length || !sameKeys(ks, pk, pk.length)) dropKeys(o, ks);   // (keys as the copy has them, in its order; an object of the same make keeps its own)
        for (let j = 0; j < pk.length; j++) { const v = c[j]; setKey(o, pk[j], typeof v === 'function' ? fn(v) : tr(v)); } break; }
      case K_MAP: { const o = t as Map<unknown, unknown>, c = data[i] as unknown[]; o.clear();
        for (let j = 0; j < c.length; j += 2) { const v = c[j + 1]; o.set(tr(c[j]), typeof v === 'function' ? fn(v) : tr(v)); } break; }
      case K_SET: { const o = t as Set<unknown>, c = data[i] as unknown[]; o.clear(); for (let j = 0; j < c.length; j++) o.add(tr(c[j])); break; }
      case K_BUF: new Uint8Array(t as ArrayBuffer).set(new Uint8Array(data[i] as ArrayBuffer)); break;
    }
  }
  const keys: object[] = [];
  for (let i = 0; i < s.tables.length; i++) {
    const ta = s.tables[i], t = (ta.sideName !== undefined ? ta : map.get(ta)) as Table, e = s.entries[i];
    keys.length = 0; t.liveKeys(keys);
    for (const k of keys) if (claimed.has(k)) t.delete(k);
    if (t instanceof SideMap) for (let j = 0; j < e.length; j += 2) t.set(tr(e[j]) as object, tr(e[j + 1])); else for (let j = 0; j < e.length; j++) t.add(tr(e[j]) as object);
  }
  for (let i = 0; i < s.vars.length; i++) s.vars[i].set(tr(s.varVals[i]) as never);
}

/** roughly what a snapshot holds, in bytes: 8 a slot, a typed array's own bytes, a string's length (keys are not counted: an object's shape is shared).
 *  `since`: the snapshot it was taken since — `own` is then what it holds that the other does not (the copies made anew), `changed` how many objects that is */
export function snapshotBytes(s: Snapshot, since?: Snapshot): { bytes: number; objects: number; typed: number; slots: number; tables: number; entries: number; own: number; changed: number } {
  let typed = 0, slots = 0, strs = 0, entries = 0, own = 0, changed = 0;
  const shared = since ? new Set(since.data) : null, kinds = s.chain.kinds;
  for (let i = 0; i < s.at.length; i++) {
    const c = s.data[i]; let b = 0;
    if (c === undefined) continue;   // (a side table: its entries are counted below)
    switch (kinds[s.at[i]]) {
      case K_TYPED: case K_WORDS: b = (c as Typed).byteLength; typed += b; break;
      case K_BUF: b = (c as ArrayBuffer).byteLength; typed += b; break;
      default: { const a = c as unknown[]; slots += a.length; b = 8 * a.length; for (let j = 0; j < a.length; j++) { const v = a[j]; if (typeof v === 'string') { strs += v.length; b += v.length; } } }
    }
    if (!shared || !shared.has(c)) { own += b; changed++; }
  }
  for (const e of s.entries) { entries += e.length; slots += e.length; own += 8 * e.length; }
  own += 24 * s.at.length;   // (the three lists every snapshot has of its own: which object, its copy, its keys)
  return { bytes: typed + slots * 8 + strs + 24 * s.at.length, objects: s.at.length, typed, slots, tables: s.tables.length, entries, own, changed };
}

// ---- the state in one fixed order, to the bit: a word of it (stateHash), or two games' side by side with the paths that differ (stateDiff)
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
const PROTO_ID = new Map<object | null, number>(), PROTO_NAME = new Map<number, string>();
const strHash = new Map<string, number>();
function hashStr(s: string): number { let h = strHash.get(s); if (h === undefined) { h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } if (strHash.size < 50000) strHash.set(s, h); } return h; }

/** where the walk stands, kept by the sink: an array of the steps down, or anything that takes them the same way (stateFlat keeps a tree, not strings) */
interface PathLike { push(step: string): unknown; pop(): unknown; join(sep: string): string }
interface Sink { word(w: number): void; num(x: number): void; str(s: string): void; path: PathLike | null; note(what: string): void;
  /** a typed array's elements, when the sink would rather take its bytes than each number */ typed?(o: Typed): void;
  /** a function met (kept as it is: what it has captured is in no snapshot) */ fn?(f: Function): void;
  /** the word that says what KIND of value comes next (TAG_NAMES), when the sink tells it from a count or a number; `word` takes it otherwise */ tag?(t: number): void;
  /** an object met for the first time (the walk stands at it) · the object the NEXT word is the number of */ met?(o: object): void; ref?(o: object): void }

/** every value of `g`'s state through `sink`, in an order that depends on the state alone. `full`: the statics too. `own`: without the modules' registered variables
 *  and containers — what every game in the process shares — so only what THIS game reaches from itself and through the side tables */
function canon(g: Game, full: boolean, sink: Sink, own = false): void {
  const reg = sideRegistry(), Game = (g as object).constructor;
  const idx = new Map<object, number>(), found: Table[] = [], path = sink.path, where = new Map<object, string>();
  for (const o of fieldsOf(g, HOST_FIELDS)) idx.set(o, -1);
  if (!full) for (const o of fieldsOf(g, STATIC_FIELDS)) idx.set(o, -2);
  const tag = sink.tag ?? sink.word;   // (no sink's `word` reads `this`)
  const value = (v: unknown): void => {
    switch (typeof v) {
      case 'number': tag(1); sink.num(v); return;
      case 'string': tag(2); sink.str(v); return;
      case 'boolean': tag(v ? 3 : 4); return;
      case 'undefined': tag(5); return;
      case 'function': tag(6); if (sink.fn) sink.fn(v as Function); return;
      case 'bigint': tag(7); sink.str(String(v)); return;
      case 'symbol': tag(8); return;
    }
    if (v === null) { tag(9); return; }
    const o = v as object, seenAt = idx.get(o);
    if (seenAt !== undefined) { tag(10); if (sink.ref) sink.ref(o); sink.word(seenAt); return; }
    if (o.constructor === Game && o !== g) { tag(22); return; }   // (another game, through a module's memo: not this game's state)
    idx.set(o, idx.size); if (path) where.set(o, path.join('')); if (sink.met) sink.met(o);
    if (Array.isArray(o)) { tag(11); sink.word(o.length);
      for (let i = 0; i < o.length; i++) { if (path) path.push(`[${i}]`); value(o[i]); if (path) path.pop(); } return; }
    if (ArrayBuffer.isView(o)) { if (!isTyped(o)) { tag(12); return; } tag(13); sink.str(o.constructor.name); sink.word(o.length);
      if (sink.typed) sink.typed(o); else for (let i = 0; i < o.length; i++) { if (path) path.push(`[${i}]`); sink.num(o[i]); if (path) path.pop(); }
      return; }
    const kind = protoKind(o);
    switch (kind) {
      case K_OBJ: { const p = Object.getPrototypeOf(o) as object | null; let id = PROTO_ID.get(p);
        if (id === undefined) { const name = p === null ? '(null)' : (p.constructor as { name?: string } | undefined)?.name ?? '?'; PROTO_ID.set(p, id = hashStr(name)); PROTO_NAME.set(id, name); }
        tag(14); sink.word(id);
        const ck = wallClockKeys(o);
        for (const k in o) { if (ck !== undefined && ck.includes(k)) continue;   // (a reading of the wall clock, marked where its holder is made: math/side.ts wallClock)
          sink.str(k); if (path) path.push('.' + k); value((o as Rec)[k]); if (path) path.pop(); }
        tag(15); return; }
      case K_MAP: { tag(16); sink.word((o as Map<unknown, unknown>).size); let n = 0;
        for (const [k, x] of o as Map<unknown, unknown>) { if (path) path.push(`<key ${n}>`); value(k); if (path) { path.pop(); path.push(`<${isObj(k) ? n : String(k)}>`); } value(x); if (path) path.pop(); n++; } return; }
      case K_SET: { tag(17); sink.word((o as Set<unknown>).size); let n = 0; for (const x of o as Set<unknown>) { if (path) path.push(`<member ${n++}>`); value(x); if (path) path.pop(); } return; }
      case K_BUF: { tag(18); const b = new Uint8Array(o as ArrayBuffer); sink.word(b.length); for (let i = 0; i < b.length; i++) sink.word(b[i]); return; }
      case K_SIDEMAP: case K_SIDESET: tag(19); if ((o as Table).sideName === undefined) found.push(o as Table); return;
      case K_RAWWEAK: tag(20); sink.note(`a plain WeakMap / WeakSet at ${path ? path.join('') : '(run stateDiff for the path)'}`); return;
      default: tag(21);
    }
  };
  const root = (name: string, v: unknown): void => { if (path) path.push(name); sink.str(name); value(v); if (path) path.pop(); };
  { const r = rootsOf(g); root('game', r[0]); root('world', r[1]); root('lights', r[2]); }
  if (!own) { for (const r of reg.roots) root(r.name, r.obj); for (const v of reg.vars) root(v.name, v.get()); }
  // the side tables: the named ones by name, then the found ones as found; within one, by the order its keys were met — never by the order they were set
  const tables: Table[] = reg.tables.slice(), pend: object[][] = [], hit: object[] = [];
  for (let moved = true, nFound = 0; moved;) {
    moved = false;
    while (nFound < found.length) tables.push(found[nFound++]);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]; let p = pend[i]; if (p === undefined) p = pend[i] = t.liveKeys();
      if (!p.length) continue;
      hit.length = 0; let n = 0;
      for (let j = 0; j < p.length; j++) { const k = p[j], a = idx.get(k); if (a === undefined) p[n++] = k; else if (!own || a >= 0) hit.push(k); }   // (`own`: not what is kept of a thing of the host's or a static — every game's)
      p.length = n; if (!hit.length) continue;
      moved = true;
      hit.sort((a, b) => idx.get(a)! - idx.get(b)!);
      const name = t.sideName ?? (path ? `the table at ${where.get(t) ?? '?'}` : `table#${idx.get(t)}`), map = t instanceof SideMap ? t : null;
      for (const k of hit.slice()) { if (path) path.push(`${name}{${where.get(k) ?? 'a host or static object'}}`); sink.str(name); if (sink.ref) sink.ref(k); sink.word(idx.get(k)!); if (map) value(map.get(k)); if (path) path.pop(); }
    }
    if (nFound < found.length) moved = true;
  }
}

/** the whole state as one word (two 32-bit halves, hex). `full`: the statics too. `own`: the game's own only (see canon) — a second game in the process that ticks
 *  must leave this word of the first as it was, or the two share something live */
export function stateHash(g: Game, full = false, own = false): string {
  let h1 = 0x811c9dc5 | 0, h2 = 0x9747b28c | 0; const notes: string[] = [];
  const word = (w: number): void => { h1 = Math.imul(h1 ^ w, 0x01000193); h2 = Math.imul((h2 << 5 | h2 >>> 27) ^ w, 0x9E3779B1); };
  const typed = (o: Typed): void => {   // (the raw bytes, four at a time where they sit on a word; a short one by its numbers — no buffer object is made for it)
    const n = o.length;
    if (n <= 16 || (o.byteOffset & 3) !== 0 || (o.byteLength & 3) !== 0) { for (let i = 0; i < n; i++) { F64[0] = o[i]; word(U32[0]); word(U32[1]); } return; }
    const w = new Uint32Array(o.buffer, o.byteOffset, o.byteLength >>> 2);
    for (let i = 0; i < w.length; i++) { const x = w[i]; h1 = Math.imul(h1 ^ x, 0x01000193); h2 = Math.imul((h2 << 5 | h2 >>> 27) ^ x, 0x9E3779B1); }
  };
  canon(g, full, { path: null, word, typed, num(x) { F64[0] = x; word(U32[0]); word(U32[1]); }, str(s) { word(hashStr(s)); }, note(w) { notes.push(w); } }, own);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** plain WeakMaps / WeakSets the state reaches (each with its path): state no snapshot can hold */
export function stateRawWeak(g: Game): string[] { const notes: string[] = []; canon(g, false, { path: [], word() {}, num() {}, str() {}, note(w) { notes.push(w); } }); return notes; }

/** every function the state holds, by the path it hangs at (indices folded) with how many: what a closure has captured is in no snapshot, so each is either without
 *  state of its own or a hole — the check prints the list for a reader to judge */
export function stateFunctions(g: Game): Map<string, number> {
  const out = new Map<string, number>(), path: string[] = [];
  canon(g, false, { path, word() {}, num() {}, str() {}, note() {}, typed() {}, fn(f) { const p = path.join('').replace(/\[\d+\]/g, '[]').replace(/<[^>]*>/g, '<>').replace(/\{[^}]*\}/g, '{}') + (f.name ? ` (${f.name})` : ''); out.set(p, (out.get(p) ?? 0) + 1); } });
  return out;
}

/** two games side by side, value for value: every number to the bit, every object against the one standing in the same place in the other — but not WHICH object
 *  stands there (two fields that share one array in `a` and hold two equal arrays in `b` pass). What a state put into ANOTHER game is held to at the places the
 *  strict word parts: the first game points at a module's constant row the other had not reached when it was handed the state, so the other holds its own equal copy
 *  there, and its later ticks point at the row itself. A function stands for a function (each game keeps its own closures). The paths that differ, at most `max`;
 *  empty = alike. */
export function stateAlike(a: Game, b: Game, max = 12): string[] {
  const reg = sideRegistry(), out: string[] = [], path: string[] = [];
  /** an object of `a` → the first of `b` it was met against (and the others), an object of `b` → the first of `a`; where each of `a` was first met */
  const first = new Map<object, object>(), more = new Map<object, Set<object>>(), back = new Map<object, object>(), where = new Map<object, string>();
  const skip = new Set<object>([...fieldsOf(a, HOST_FIELDS), ...fieldsOf(a, STATIC_FIELDS)]), found: [Table, Table][] = [];
  let pairs = 0;
  const show = (v: unknown): string => typeof v === 'number' ? (F64[0] = v, numText(U32[0], U32[1])) : typeof v === 'string' ? JSON.stringify(v).slice(0, 60)
    : isObj(v) ? (Array.isArray(v) ? `an array of ${v.length}` : `a ${(v.constructor as { name?: string } | undefined)?.name ?? 'thing'}`) : String(v);
  const say = (what: string): void => { const line = `${path.join('') || '(root)'}: ${what}`; if (out.length < max && !out.includes(line)) out.push(line); };
  const keysOf = (o: object): string[] => { const ks: string[] = [], ck = wallClockKeys(o); for (const k in o) if (ck === undefined || !ck.includes(k)) ks.push(k); return ks; };
  const Game = (a as object).constructor;
  const bytes = (o: Typed | ArrayBuffer): Uint8Array => o instanceof ArrayBuffer ? new Uint8Array(o) : new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
  const pair = (x: unknown, y: unknown): void => {
    if (out.length >= max) return;
    if (!isObj(x) || !isObj(y)) { if (typeof x === 'function' && typeof y === 'function') return; if (typeof x !== typeof y || differs(x, y)) say(`${show(x)} | ${show(y)}`); return; }
    if (x.constructor === Game && x !== a) return;   // (another game, through a module's memo)
    if (x === y) { if (!first.has(x)) { first.set(x, x); back.set(x, x); where.set(x, path.join('')); pairs++; } return; }   // (shared by the two games: itself)
    if (skip.has(x)) return;
    const f = first.get(x);
    if (f === y) return;
    if (f !== undefined) { let m = more.get(x); if (!m) more.set(x, m = new Set()); if (m.has(y)) return; m.add(y); } else { first.set(x, y); where.set(x, path.join('')); }
    if (!back.has(y)) back.set(y, x);
    pairs++;
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) { say(`${show(x)} | ${show(y)}`); return; }
      for (let i = 0; i < x.length; i++) { path.push(`[${i}]`); pair(x[i], y[i]); path.pop(); } return; }
    if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) { say(`${show(x)} | ${show(y)}`); return; }
    if (ArrayBuffer.isView(x)) { if (!isTyped(x)) return;
      const u = bytes(x), v = bytes(y as Typed); if (u.length !== v.length) { say(`${show(x)} of ${x.length} | of ${(y as Typed).length}`); return; }
      for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) { const j = i / (x.BYTES_PER_ELEMENT as number) | 0; path.push(`[${j}]`); say(`${show(x[j])} | ${show((y as Typed)[j])}`); path.pop(); return; }
      return; }
    switch (protoKind(x)) {
      case K_OBJ: { const kx = keysOf(x), ky = keysOf(y);
        if (kx.length !== ky.length || !sameKeys(kx, ky, kx.length)) { say(`keys ${kx.filter(k => !ky.includes(k)).join(',') || '(order)'} | ${ky.filter(k => !kx.includes(k)).join(',') || '(order)'}`); return; }
        for (const k of kx) { path.push('.' + k); pair((x as Rec)[k], (y as Rec)[k]); path.pop(); } return; }
      case K_MAP: { const mx = x as Map<unknown, unknown>, ey = [...(y as Map<unknown, unknown>)]; if (mx.size !== ey.length) { say(`a Map of ${mx.size} | of ${ey.length}`); return; }
        let n = 0; for (const [k, v] of mx) { path.push(`<key ${n}>`); pair(k, ey[n][0]); path.pop(); path.push(`<${isObj(k) ? n : String(k)}>`); pair(v, ey[n][1]); path.pop(); n++; } return; }
      case K_SET: { const sx = x as Set<unknown>, ey = [...(y as Set<unknown>)]; if (sx.size !== ey.length) { say(`a Set of ${sx.size} | of ${ey.length}`); return; }
        let n = 0; for (const v of sx) { path.push(`<member ${n}>`); pair(v, ey[n]); path.pop(); n++; } return; }
      case K_BUF: { const u = bytes(x as ArrayBuffer), v = bytes(y as ArrayBuffer); if (u.length !== v.length) { say(`a buffer of ${u.length} | of ${v.length}`); return; }
        for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) { path.push(`[${i}]`); say(`${u[i]} | ${v[i]}`); path.pop(); return; } return; }
      case K_SIDEMAP: case K_SIDESET: if ((x as Table).sideName === undefined) found.push([x as Table, y as Table]); return;
    }
  };
  { const ra = rootsOf(a), rb = rootsOf(b), names = ['game', 'world', 'lights']; for (let i = 0; i < ra.length; i++) { path.push(names[i]); pair(ra[i], rb[i]); path.pop(); } }
  for (const r of reg.roots) { path.push(r.name); pair(r.obj, r.obj); path.pop(); }
  // the side tables: an entry of an object of `a` against the entry of each object of `b` that stands for it — and no entry in `b`'s table without one in `a`'s
  for (let was = -1; was !== pairs + found.length && out.length < max;) {
    was = pairs + found.length;
    const tables: [Table, Table][] = [...reg.tables.map(t => [t, t] as [Table, Table]), ...found];
    for (let i = 0; i < tables.length; i++) {
      const [tx, ty] = tables[i], name = tx.sideName ?? `a table at ${where.get(tx) ?? '?'}`, mx = tx instanceof SideMap ? tx : null, my = ty instanceof SideMap ? ty : null;
      for (const k of tx.liveKeys()) { const y0 = first.get(k); if (y0 === undefined) continue;
        for (const y of [y0, ...(more.get(k) ?? [])]) { path.push(`${name}{${where.get(k) ?? '?'}}`);
          if (!ty.has(y)) { if (tx !== ty || y !== k) say(`an entry | none`); } else if (mx && my) pair(mx.get(k), my.get(y));
          path.pop(); } }
      for (const k of ty.liveKeys()) { const x = back.get(k); if (x === undefined || tx.has(x)) continue; path.push(`${name}{${where.get(x) ?? '?'}}`); say(`none | an entry`); path.pop(); }
    }
  }
  return out;
}

// ---- a state laid out flat, and two of them side by side
//
// It was two arrays a state, a token and a freshly joined path STRING for every value, a typed array's every element among them: 2.3 million of each for one
// squad game on the page's stand, two games of it 2 GB, and a check that asked twice was killed for memory. Now a value is thirteen bytes: its kind, its two
// words and the NODE of a tree of the steps down (a path is put together only for a value that is asked about); a string once a state; a typed array its bytes.
const T_WORD = 0, T_TAG = 1, T_NUM = 2, T_STR = 3, T_TYPED = 4;
/** what canon's tags say comes next (11 to 21 but 15, the end of an object's keys: an object, which takes a number in the walk) */
const TAG_NAMES = ['', 'a number', 'a string', 'true', 'false', 'undefined', 'a function', 'a bigint', 'a symbol', 'null', 'a reference', 'an array', 'a DataView', 'a typed array', 'an object', 'no more keys', 'a Map', 'a Set',
  'a buffer', 'a side table', 'a plain WeakMap / WeakSet', 'a thing held as it is', 'another game'];
const numText = (lo: number, hi: number): string => { U32[0] = lo; U32[1] = hi; return `${F64[0]} (${(hi >>> 0).toString(16).padStart(8, '0')}${(lo >>> 0).toString(16).padStart(8, '0')})`; };
const aThing = (name: string | undefined): string => name === undefined || name === '?' ? 'a thing' : name === 'Object' || name === '(null)' ? 'an object' : `a ${name}`;
const grown = <T extends Int32Array | Uint8Array>(a: T): T => { const b = new (a.constructor as new (n: number) => T)(a.length * 2); b.set(a); return b; };

/** a state laid out flat: every value in the fixed order, with where it sits (stateDiff's two sides; a tool keeps one of a frame it cannot keep the game of —
 *  it holds no object of the game). `toks` / `paths` are the old two arrays, a typed array's every element a row: made on the first ask and KEPT, and as
 *  heavy as they ever were — ask `flatDiff` instead where that will do. */
export class FlatState {
  /** the rows: a typed array is one · the values: its every element is one */
  n = 0; values = 0;
  kind = new Uint8Array(1 << 16); lo = new Int32Array(1 << 16); hi = new Int32Array(1 << 16); node = new Int32Array(1 << 16);
  strs: string[] = []; typed: Typed[] = [];
  /** the row that is the NUMBER of an object met before → the node it was first met at (none: a thing of the host's or a static) */
  refs = new Map<number, number>();
  /** the steps down as a tree: a node's parent and its step's text (node 0 = the top) */
  nodes = 1; parent = new Int32Array(1 << 14); seg = new Int32Array(1 << 14); segs: string[] = [''];
  private old: { toks: (number | string)[]; paths: string[] } | null = null;
  row(kind: number, lo: number, hi: number, node: number): void {
    if (this.n === this.kind.length) { this.kind = grown(this.kind); this.lo = grown(this.lo); this.hi = grown(this.hi); this.node = grown(this.node); }
    const i = this.n++; this.kind[i] = kind; this.lo[i] = lo; this.hi[i] = hi; this.node[i] = node; this.values++;
  }
  down(from: number, seg: number): number { if (this.nodes === this.parent.length) { this.parent = grown(this.parent); this.seg = grown(this.seg); } const n = this.nodes++; this.parent[n] = from; this.seg[n] = seg; return n; }
  pathOf(node: number): string { const steps: string[] = []; for (let n = node; n > 0; n = this.parent[n]) steps.push(this.segs[this.seg[n]]); return steps.reverse().join(''); }
  /** is row i the tag t */
  tagAt(i: number, t: number): boolean { return i >= 0 && this.kind[i] === T_TAG && this.lo[i] === t; }
  /** is row i the number of an object met before (after the tag 'a reference', or a side table's key) */
  refAt(i: number): boolean { return this.kind[i] === T_WORD && (this.refs.has(i) || this.tagAt(i - 1, 10)); }
  /** row i for a reader: a tag as the value it opens */
  say(i: number): string {
    const lo = this.lo[i];
    switch (this.kind[i]) {
      case T_NUM: return numText(lo, this.hi[i]);
      case T_STR: return '"' + this.strs[lo] + '"';
      case T_TYPED: return `a typed array of ${this.typed[lo].length}`;
      case T_TAG:
        if (lo === 1 || lo === 2 || lo === 10) return this.say(i + 1);
        if (lo === 11 || lo === 16 || lo === 17 || lo === 18) return `${TAG_NAMES[lo]} of ${this.lo[i + 1]}`;
        if (lo === 13) return `a ${this.strs[this.lo[i + 1]]} of ${this.lo[i + 2]}`;
        if (lo === 14) return aThing(PROTO_NAME.get(this.lo[i + 1]));
        return TAG_NAMES[lo] ?? String(lo);
    }
    if (!this.refAt(i)) {   // a count or a class after its tag, said as the value it belongs to
      const t = i > 0 && this.kind[i - 1] === T_TAG ? this.lo[i - 1] : 0;
      return t === 11 || t === 16 || t === 17 || t === 18 ? `${TAG_NAMES[t]} of ${lo}` : t === 14 ? aThing(PROTO_NAME.get(lo)) : this.tagAt(i - 2, 13) ? `a ${this.strs[this.lo[i - 1]]} of ${lo}` : String(lo);
    }
    const at = this.refs.get(i); return at !== undefined ? `the object at ${this.pathOf(at) || '(root)'}` : lo === -1 ? 'a thing of the host\'s' : lo === -2 ? 'a static' : `object ${lo}`;
  }
  private rows(): { toks: (number | string)[]; paths: string[] } {
    if (this.old) return this.old;
    const toks: (number | string)[] = [], paths: string[] = [];
    for (let i = 0; i < this.n; i++) { const k = this.kind[i], p = this.pathOf(this.node[i]);
      if (k === T_TYPED) { const t = this.typed[this.lo[i]]; for (let e = 0; e < t.length; e++) { F64[0] = t[e]; toks.push(numText(U32[0], U32[1])); paths.push(`${p}[${e}]`); } }
      else { toks.push(k === T_NUM ? numText(this.lo[i], this.hi[i]) : k === T_STR ? '"' + this.strs[this.lo[i]] + '"' : this.lo[i]); paths.push(p); } }
    return this.old = { toks, paths };
  }
  get toks(): (number | string)[] { return this.rows().toks; }
  get paths(): string[] { return this.rows().paths; }
}

export function stateFlat(g: Game, full = false, own = false): FlatState {
  const F = new FlatState(), strId = new Map<string, number>(), segId = new Map<string, number>([['', 0]]), met = new Map<object, number>();
  let cur = 0;
  const path: PathLike = {
    push(step) { let id = segId.get(step); if (id === undefined) { id = F.segs.length; F.segs.push(step); segId.set(step, id); } cur = F.down(cur, id); },
    pop() { cur = F.parent[cur]; }, join() { return F.pathOf(cur); } };
  canon(g, full, { path, note() {},
    word(w) { F.row(T_WORD, w, 0, cur); }, tag(t) { F.row(T_TAG, t, 0, cur); }, num(x) { F64[0] = x; F.row(T_NUM, U32[0], U32[1], cur); },
    str(s) { let id = strId.get(s); if (id === undefined) { id = F.strs.length; F.strs.push(s); strId.set(s, id); } F.row(T_STR, id, 0, cur); },
    typed(o) { F.typed.push(o.slice() as Typed); F.row(T_TYPED, F.typed.length - 1, 0, cur); F.values += o.length - 1; },
    met(o) { met.set(o, cur); }, ref(o) { const at = met.get(o); if (at !== undefined) F.refs.set(F.n, at); } }, own);
  return F;
}

/** where two flat states differ, a line a place: `path: this | that`, at most `max`; empty = the same to the bit.
 *  A VALUE that differs (a number, a text, a flag, null where a number was, which object a field points at) leaves the two walks in step and the next is
 *  compared. A SHAPE that differs (an array of another length, an object with another key) is one line; where what is left of that one value holds NO object
 *  first met there, in either state, it is passed over in both ('… (the rest of it is not compared)') and the compare goes on, for the two walks still number
 *  their objects alike. Where it does hold one, or the two stand at different places (one has a side table's row the other has not), the walks are out of
 *  step and the compare is over: '(the shapes part here: nothing after it is compared …)' — a caller that asks "no line of mine" must read that line as "not
 *  proven". Two games value for value PAST such a place: stateAlike, which pairs what stands in the same place and gives up only the one thing that differs. */
export function flatDiff(A: FlatState, B: FlatState, max = 12): string[] {
  const out: string[] = []; let i = 0, j = 0;
  const within = (F: FlatState, n: number, top: number): boolean => { while (n > top) n = F.parent[n]; return n === top; };   // (a child's node is made after its parent's)
  /** the row after what is left of the value at row k's node, or -1 where an object is first met in it (one the walk gives a number) */
  const rest = (F: FlatState, k: number): number => { const top = F.node[k]; for (; k < F.n && within(F, F.node[k], top); k++) if (F.kind[k] === T_TAG && F.lo[k] >= 11 && F.lo[k] <= 21 && F.lo[k] !== 15) return -1; return k; };
  const over = (pb: string): string[] => { out.push(`(the shapes part here: nothing after it is compared; the second stands at ${pb || '(root)'})`); return out; };
  while (i < A.n && j < B.n && out.length < max) {
    const ka = A.kind[i], kb = B.kind[j];
    if (ka === kb) {
      if (ka === T_TYPED) {
        const ta = A.typed[A.lo[i]], tb = B.typed[B.lo[j]];
        if (ta.length === tb.length && ta.constructor === tb.constructor) {
          const ua = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength), ub = new Uint8Array(tb.buffer, tb.byteOffset, tb.byteLength), w = ta.BYTES_PER_ELEMENT; let p: string | null = null;
          for (let q = 0; q < ua.length && out.length < max; q++) { if (ua[q] === ub[q]) continue;
            const e = q / w | 0; F64[0] = ta[e]; const lo = U32[0], hi = U32[1]; F64[0] = tb[e]; const lo2 = U32[0], hi2 = U32[1];
            if (lo !== lo2 || hi !== hi2) out.push(`${p ??= A.pathOf(A.node[i])}[${e}]: ${numText(lo, hi)} | ${numText(lo2, hi2)}`);
            q = (e + 1) * w - 1; }
          i++; j++; continue; }
      } else if (ka === T_STR ? A.strs[A.lo[i]] === B.strs[B.lo[j]] : A.lo[i] === B.lo[j] && A.hi[i] === B.hi[j]) { i++; j++; continue; }
    }
    const pa = A.pathOf(A.node[i]), pb = B.pathOf(B.node[j]), said = `${pa || '(root)'}: ${A.say(i)} | ${B.say(j)}`;
    if (pa !== pb) { out.push(said); return over(pb); }
    if (ka === kb && (ka === T_NUM || (ka === T_STR && A.tagAt(i - 1, 2) && B.tagAt(j - 1, 2)) || (ka === T_WORD && A.refAt(i) && B.refAt(j)))) { out.push(said); i++; j++; continue; }   // a value: in step
    const whole = ka === T_TAG && kb === T_TAG, i2 = rest(A, i), j2 = rest(B, j);   // (whole: the two rows open the value, and `said` shows all of it where it is not an object)
    if (i2 < 0 || j2 < 0) { out.push(said); return over(pb); }
    out.push(whole ? said : said + ' (the rest of it is not compared)'); i = i2; j = j2;
  }
  if (out.length < max && (i < A.n) !== (j < B.n)) { const F = i < A.n ? A : B, k = i < A.n ? i : j;   // (a side table's rows have no count before them: a last row only one state has ends here)
    out.push(`${F.pathOf(F.node[k]) || '(root)'}: ${i < A.n ? 'here | nothing' : 'nothing | here'} (one state is longer: ${A.values} values against ${B.values})`); }
  return out;
}
/** where two games' states differ (flatDiff of the two). `full`: the statics too. `own`: without what every game in the process shares — the modules' registered
 *  variables and containers — which is what two games stood in ONE process are compared by (a module's variable is one for both: canon) */
export function stateDiff(a: Game, b: Game, max = 12, full = false, own = false): string[] { return flatDiff(stateFlat(a, full, own), stateFlat(b, full, own), max); }
