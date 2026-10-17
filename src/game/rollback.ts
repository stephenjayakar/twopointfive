// THE ROLLBACK SNAPSHOT: the whole simulation as it stands at a tick, taken in memory and put back — into the same Game (what rollback netcode does every time a
// prediction was wrong) or into another Game stood up on the same level (a fresh one). Beside the checkpoint (savestate.ts), not instead of it: a checkpoint is a
// FILE a player keeps (a schema, refused in squad play and mid-action, a restart under it); this is every bit the next tick reads, in any mode, at any moment — men
// moving, rounds in the air, a leaf swinging, a fuse burning — and nothing a player ever sees. Nothing in the game calls it yet: unused, the build is as it was.
//   takeSnapshot(g)            walk everything the Game reaches (and the side tables, module variables and module containers registered in math/side.ts) and keep
//                              a shallow copy of each array, object, Map, Set and typed array it meets. No schema: a new field on a Guard is in the next snapshot.
//   restoreSnapshot(s)         write every copy back into the object it was taken from. Identities stand: whoever held a Guard still holds that Guard.
//   restoreSnapshot(s, other)  the same state into ANOTHER Game: the two are walked side by side from their roots, an object of the snapshot is written into the
//                              object standing in the same place there (the other game's own level, its own closures, its own host), and one with no counterpart
//                              (a man spawned since) is made anew.
//   stateHash(g) / stateDiff(a, b)   every value of the state in one fixed order, to the raw bit, folded into a word / compared with the paths that differ:
//                              what tools/qa/rollback-check.ts holds 'play goes on exactly as the unbroken run' with.
// WHAT IS NOT IN IT (and must not be reached for on the way back): the host — `Game.engine` but for its CPU box world and light set, the mixer, the smoke solver
// (its fields live on the GPU), the session journal — and the character file every man's clips are read from (STATIC: never written; `stateHash(g, true)` walks it
// too, so a check can hold that). A function is kept as it is: what a closure has captured cannot be seen from here, so state belongs on objects and in side
// tables, never in a closure (the check's static pass names the module variables that are not registered).
// (src/game is one import cycle: nothing below runs at the top level but type imports and math/side.ts, which is outside it.)
import { SideMap, SideSet, sideRegistry, type SideVar } from '../math/side';
import type { Game } from './game';

type Rec = Record<string, unknown>;
type Typed = Float32Array;   // (any typed array: the calls used are the same on all of them)
type Table = SideMap<object, unknown> | SideSet<object>;

const K_ATOM = 0, K_ARR = 1, K_TYPED = 2, K_OBJ = 3, K_MAP = 4, K_SET = 5, K_BUF = 6, K_SIDEMAP = 7, K_SIDESET = 8, K_RAWWEAK = 9;
const PROTO_KIND = new Map<object | null, number>();
/** what an object that is neither an array nor a typed array is, decided once for its prototype */
function protoKind(o: object): number {
  const p = Object.getPrototypeOf(o) as object | null;
  let k = PROTO_KIND.get(p);
  if (k === undefined) {
    k = p === null || p === Object.prototype ? K_OBJ : o instanceof SideMap ? K_SIDEMAP : o instanceof SideSet ? K_SIDESET : o instanceof Map ? K_MAP : o instanceof Set ? K_SET
      : o instanceof ArrayBuffer ? K_BUF : o instanceof WeakMap || o instanceof WeakSet ? K_RAWWEAK : Object.prototype.toString.call(o) === '[object Object]' ? K_OBJ : K_ATOM;
    PROTO_KIND.set(p, k);
  }
  return k;
}
const isTyped = (o: object): o is Typed => ArrayBuffer.isView(o) && (o as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT !== undefined;
const isObj = (v: unknown): v is object => typeof v === 'object' && v !== null;

/** the Game's fields that are the host's (left exactly as they are, in either game) and the ones that are never written (the character file) */
const HOST_FIELDS = ['engine', 'audio', 'smoke', 'journal'] as const;
const STATIC_FIELDS = ['ch'] as const;
/** where a walk starts: the Game, and the two CPU pieces of the host the simulation reads and writes (the box world its rays are cast in, the light set) */
function rootsOf(g: Game): object[] { const e = (g as unknown as { engine: { world: object; lights: object } }).engine; return [g, e.world, e.lights]; }
function fieldsOf(g: Game, names: readonly string[]): object[] { const out: object[] = []; for (const f of names) { const v = (g as unknown as Rec)[f]; if (isObj(v)) out.push(v); } return out; }

export interface Snapshot {
  /** the Game it was taken from */
  readonly game: Game;
  /** every object met (the copied ones and the ones left alone): a side table's entry is the snapshot's when its key is in here */
  readonly seen: Set<object>;
  /** the copied objects, the kind of each and its shallow copy (children by reference) */
  readonly nodes: object[]; readonly kinds: number[]; readonly data: unknown[];
  /** every side table (the named ones, and the ones found hanging off an object) with its entries whose key is in `seen`: [key, value, key, value …] of a map, [key, key …] of a set */
  readonly tables: Table[]; readonly entries: unknown[][];
  /** the registered module variables and what each held */
  readonly vars: SideVar[]; readonly varVals: unknown[];
  /** plain WeakMaps / WeakSets met on the way: state a snapshot cannot hold (the check is red on one) */
  readonly rawWeak: object[];
}

export function takeSnapshot(g: Game): Snapshot {
  const reg = sideRegistry();
  const seen = new Set<object>(), nodes: object[] = [], kinds: number[] = [], data: unknown[] = [], stack: object[] = [], found: Table[] = [], rawWeak: object[] = [];
  for (const o of fieldsOf(g, HOST_FIELDS)) seen.add(o);
  for (const o of fieldsOf(g, STATIC_FIELDS)) seen.add(o);
  const push = (v: unknown): void => { if (typeof v === 'object' && v !== null && !seen.has(v)) { seen.add(v); stack.push(v); } };
  const drain = (): void => {
    while (stack.length) {
      const o = stack.pop()!;
      if (Array.isArray(o)) {
        const c = o.slice(); nodes.push(o); kinds.push(K_ARR); data.push(c);
        for (let i = 0; i < c.length; i++) { const v = c[i]; if (typeof v === 'object' && v !== null && !seen.has(v)) { seen.add(v); stack.push(v); } }
      } else if (ArrayBuffer.isView(o)) {
        if (isTyped(o)) { nodes.push(o); kinds.push(K_TYPED); data.push(o.slice()); }
      } else switch (protoKind(o)) {
        case K_OBJ: { const c = Object.assign({}, o) as Rec; nodes.push(o); kinds.push(K_OBJ); data.push(c);
          for (const k in c) { const v = c[k]; if (typeof v === 'object' && v !== null && !seen.has(v)) { seen.add(v); stack.push(v); } } break; }
        case K_MAP: { const c: unknown[] = []; (o as Map<unknown, unknown>).forEach((v, k) => { c.push(k, v); push(k); push(v); }); nodes.push(o); kinds.push(K_MAP); data.push(c); break; }
        case K_SET: { const c: unknown[] = []; (o as Set<unknown>).forEach(v => { c.push(v); push(v); }); nodes.push(o); kinds.push(K_SET); data.push(c); break; }
        case K_BUF: nodes.push(o); kinds.push(K_BUF); data.push((o as ArrayBuffer).slice(0)); break;
        case K_SIDEMAP: case K_SIDESET: if ((o as Table).sideName === undefined) found.push(o as Table); break;
        case K_RAWWEAK: rawWeak.push(o); break;
      }
    }
  };
  for (const r of rootsOf(g)) push(r);
  for (const r of reg.roots) push(r.obj);
  const vars = reg.vars.slice(), varVals = vars.map(v => v.get());
  for (const v of varVals) push(v);
  drain();
  // the side tables: an entry is in when its key has been met — and its value may reach more objects, whose entries in other tables are in too: round until nothing is added
  const tables: Table[] = reg.tables.slice(), entries: unknown[][] = [], pend: object[][] = [];
  for (let moved = true, nFound = 0; moved;) {
    moved = false;
    while (nFound < found.length) tables.push(found[nFound++]);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]; let p = pend[i];
      if (p === undefined) { p = pend[i] = t.liveKeys(); entries[i] = []; }
      if (!p.length) continue;
      const e = entries[i], map = t instanceof SideMap ? t : null; let n = 0;
      for (let j = 0; j < p.length; j++) { const k = p[j];
        if (!seen.has(k)) { p[n++] = k; continue; }
        moved = true;
        if (map) { const v = map.get(k); e.push(k, v); push(v); } else e.push(k); }
      p.length = n;
    }
    drain();
    if (nFound < found.length) moved = true;
  }
  return { game: g, seen, nodes, kinds, data, tables, entries, vars, varVals, rawWeak };
}

/** write `s` back: into the Game it was taken from (in place), or into `into` — another Game on the same level */
export function restoreSnapshot(s: Snapshot, into: Game = s.game): void { if (into === s.game) restoreInPlace(s); else restoreMapped(s, into); }

function restoreInPlace(s: Snapshot): void {
  const { nodes, kinds, data, seen } = s;
  for (let i = 0; i < nodes.length; i++) {
    switch (kinds[i]) {
      case K_ARR: { const o = nodes[i] as unknown[], c = data[i] as unknown[], n = c.length; if (o.length !== n) o.length = n;
        for (let j = 0; j < n; j++) { const b = c[j], a = o[j]; if (a !== b || (b === 0 && !Object.is(a, b))) o[j] = b; } break; }
      case K_TYPED: (nodes[i] as Typed).set(data[i] as Typed); break;
      case K_OBJ: { const o = nodes[i] as Rec, c = data[i] as Rec, ko = Object.keys(o); let n = 0, same = true;
        for (const k in c) { if (ko[n++] !== k) same = false; const b = c[k], a = o[k]; if (a !== b || (b === 0 && !Object.is(a, b))) o[k] = b; }
        if (!same || n !== ko.length) { for (const k of ko) delete o[k]; for (const k in c) o[k] = c[k]; }   // (a key added or dropped since, or their order: as the copy has them — a for-in over it must run as it would have)
        break; }
      case K_MAP: { const o = nodes[i] as Map<unknown, unknown>, c = data[i] as unknown[]; o.clear(); for (let j = 0; j < c.length; j += 2) o.set(c[j], c[j + 1]); break; }
      case K_SET: { const o = nodes[i] as Set<unknown>, c = data[i] as unknown[]; o.clear(); for (let j = 0; j < c.length; j++) o.add(c[j]); break; }
      case K_BUF: new Uint8Array(nodes[i] as ArrayBuffer).set(new Uint8Array(data[i] as ArrayBuffer)); break;
    }
  }
  const keys: object[] = [];
  for (let i = 0; i < s.tables.length; i++) {
    const t = s.tables[i], e = s.entries[i];
    keys.length = 0; t.liveKeys(keys);
    for (let j = 0; j < keys.length; j++) if (seen.has(keys[j])) t.delete(keys[j]);
    if (t instanceof SideMap) for (let j = 0; j < e.length; j += 2) t.set(e[j] as object, e[j + 1]); else for (let j = 0; j < e.length; j++) t.add(e[j] as object);
  }
  for (let i = 0; i < s.vars.length; i++) s.vars[i].set(s.varVals[i] as never);
}

/** functions a cross-game restore has written into a game they were not made in */
const BROUGHT = new WeakSet<Function>();
function restoreMapped(s: Snapshot, into: Game): void {
  const { nodes, kinds, data } = s;
  const at = new Map<object, number>(); for (let i = 0; i < nodes.length; i++) at.set(nodes[i], i);
  /** an object of the snapshot's game → the object that stands for it in `into` */
  const map = new Map<object, object>();
  /** objects of `into` already standing for one (and the ones made anew), and the made-anew alone */
  const claimed = new Set<object>(), made = new Set<object>();
  const bufs = new Map<ArrayBuffer, ArrayBuffer>();
  const stack: [object, unknown][] = [], later: object[] = [];
  let mayMake = false;
  const fits = (kind: number, a: object, b: object): boolean => kind === K_ARR ? Array.isArray(b) : Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
    && (kind !== K_TYPED || (a as Typed).length === (b as Typed).length) && (kind !== K_BUF || (a as ArrayBuffer).byteLength === (b as ArrayBuffer).byteLength);
  const bufFor = (a: ArrayBuffer): ArrayBuffer => { let b = (map.get(a) as ArrayBuffer | undefined) ?? bufs.get(a); if (!b) bufs.set(a, b = a.slice(0)); return b; };
  const make = (kind: number, a: object): object => kind === K_ARR ? [] : kind === K_OBJ ? Object.create(Object.getPrototypeOf(a) as object | null) as object : kind === K_MAP ? new Map() : kind === K_SET ? new Set()
    : kind === K_BUF ? bufFor(a as ArrayBuffer) : new ((a as Typed).constructor as new (b: ArrayBuffer, o: number, n: number) => Typed)(bufFor((a as Typed).buffer as ArrayBuffer), (a as Typed).byteOffset, (a as Typed).length);
  /** what the other game reaches as it stands: an object of the snapshot's that is in here is SHARED by the two games (a module's constant row a box's colour points at, a
   *  palette, the character file) and stands for itself — and nothing of the snapshot's is ever written into an object of the other game's that the first game reaches too */
  const theirs = takeSnapshot(into).seen;
  const bind = (a: object, b: unknown): void => {
    if (map.has(a)) return;
    if (theirs.has(a)) b = a; else if (isObj(b) && s.seen.has(b)) b = undefined;
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
    map.set(a, t); claimed.add(t);
    const c = data[i];
    if (kind === K_ARR) { const cc = c as unknown[]; for (let j = cc.length - 1; j >= 0; j--) { const v = cc[j]; if (isObj(v)) stack.push([v, bb ? (bb as unknown[])[j] : undefined]); } }
    else if (kind === K_OBJ) { const cc = c as Rec; for (const k in cc) { const v = cc[k]; if (isObj(v)) stack.push([v, bb ? (bb as Rec)[k] : undefined]); } }
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
  for (let i = 0; i < nodes.length; i++) if (!map.has(nodes[i])) { bind(nodes[i], undefined); drain(); }
  for (const t of s.tables) if (t.sideName === undefined && !map.has(t)) bind(t, undefined);
  // … and the contents, every reference turned to the object that stands for it. A function already standing in the other game's object is that game's own closure: kept
  const tr = (v: unknown): unknown => typeof v === 'object' && v !== null ? map.get(v) ?? v : v;
  /** the function for a slot: the other game's own closure when one of the same code stands there and it is that game's OWN (not one an earlier restore brought over, which
   *  belongs to whatever stood there then); else the snapshot's, marked as brought over */
  const fn = (v: Function, was: unknown): unknown => { if (typeof was === 'function' && (was === v || (!BROUGHT.has(was) && String(was) === String(v)))) return was; BROUGHT.add(v); return v; };
  for (let i = 0; i < nodes.length; i++) {
    const t = map.get(nodes[i])!, own = !made.has(t);
    switch (kinds[i]) {
      case K_ARR: { const o = t as unknown[], c = data[i] as unknown[]; const was = own ? o.slice() : null; o.length = c.length;
        for (let j = 0; j < c.length; j++) { const v = c[j]; o[j] = typeof v === 'function' ? fn(v, was ? was[j] : undefined) : tr(v); } break; }
      case K_TYPED: (t as Typed).set(data[i] as Typed); break;
      case K_OBJ: { const o = t as Rec, c = data[i] as Rec; const was = own ? Object.assign({}, o) as Rec : null;
        for (const k of Object.keys(o)) delete o[k];
        for (const k in c) { const v = c[k]; o[k] = typeof v === 'function' ? fn(v, was ? was[k] : undefined) : tr(v); } break; }
      case K_MAP: { const o = t as Map<unknown, unknown>, c = data[i] as unknown[]; const was = own ? new Map(o) : null; o.clear();
        for (let j = 0; j < c.length; j += 2) { const k = tr(c[j]), v = c[j + 1]; o.set(k, typeof v === 'function' ? fn(v, was ? was.get(k) : undefined) : tr(v)); } break; }
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

/** roughly what a snapshot holds, in bytes: 8 a slot, a typed array's own bytes, a string's length (keys are not counted: an object's shape is shared) */
export function snapshotBytes(s: Snapshot): { bytes: number; objects: number; typed: number; slots: number; tables: number; entries: number } {
  let typed = 0, slots = 0, strs = 0, entries = 0;
  const val = (v: unknown): void => { slots++; if (typeof v === 'string') strs += v.length; };
  for (let i = 0; i < s.nodes.length; i++) {
    const c = s.data[i];
    switch (s.kinds[i]) {
      case K_TYPED: typed += (c as Typed).byteLength; break;
      case K_BUF: typed += (c as ArrayBuffer).byteLength; break;
      case K_OBJ: for (const k in c as Rec) val((c as Rec)[k]); break;
      default: for (const v of c as unknown[]) val(v);
    }
  }
  for (const e of s.entries) { entries += e.length; for (const v of e) val(v); }
  return { bytes: typed + slots * 8 + strs, objects: s.nodes.length, typed, slots, tables: s.tables.length, entries };
}

// ---- the state in one fixed order, to the bit: a word of it (stateHash), or two games' side by side with the paths that differ (stateDiff)
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
const PROTO_ID = new Map<object | null, number>();
const strHash = new Map<string, number>();
function hashStr(s: string): number { let h = strHash.get(s); if (h === undefined) { h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } if (strHash.size < 50000) strHash.set(s, h); } return h; }

interface Sink { word(w: number): void; num(x: number): void; str(s: string): void; path: string[] | null; note(what: string): void;
  /** a typed array's elements, when the sink would rather take its bytes than each number */ typed?(o: Typed): void;
  /** a function met (kept as it is: what it has captured is in no snapshot) */ fn?(f: Function): void }

/** every value of `g`'s state through `sink`, in an order that depends on the state alone. `full`: the statics too */
function canon(g: Game, full: boolean, sink: Sink): void {
  const reg = sideRegistry();
  const idx = new Map<object, number>(), found: Table[] = [], path = sink.path, where = new Map<object, string>();
  for (const o of fieldsOf(g, HOST_FIELDS)) idx.set(o, -1);
  if (!full) for (const o of fieldsOf(g, STATIC_FIELDS)) idx.set(o, -2);
  const value = (v: unknown): void => {
    switch (typeof v) {
      case 'number': sink.word(1); sink.num(v); return;
      case 'string': sink.word(2); sink.str(v); return;
      case 'boolean': sink.word(v ? 3 : 4); return;
      case 'undefined': sink.word(5); return;
      case 'function': sink.word(6); if (sink.fn) sink.fn(v as Function); return;
      case 'bigint': sink.word(7); sink.str(String(v)); return;
      case 'symbol': sink.word(8); return;
    }
    if (v === null) { sink.word(9); return; }
    const o = v as object, seenAt = idx.get(o);
    if (seenAt !== undefined) { sink.word(10); sink.word(seenAt); return; }
    idx.set(o, idx.size); if (path) where.set(o, path.join(''));
    if (Array.isArray(o)) { sink.word(11); sink.word(o.length);
      for (let i = 0; i < o.length; i++) { if (path) path.push(`[${i}]`); value(o[i]); if (path) path.pop(); } return; }
    if (ArrayBuffer.isView(o)) { if (!isTyped(o)) { sink.word(12); return; } sink.word(13); sink.str(o.constructor.name); sink.word(o.length);
      if (sink.typed) sink.typed(o); else for (let i = 0; i < o.length; i++) { if (path) path.push(`[${i}]`); sink.num(o[i]); if (path) path.pop(); }
      return; }
    const kind = protoKind(o);
    switch (kind) {
      case K_OBJ: { const p = Object.getPrototypeOf(o) as object | null; let id = PROTO_ID.get(p);
        if (id === undefined) PROTO_ID.set(p, id = hashStr(p === null ? '(null)' : (p.constructor as { name?: string } | undefined)?.name ?? '?'));
        sink.word(14); sink.word(id);
        for (const k in o) { if (k === 'ms') continue;   // (a field named `ms` is a wall-clock reading — props.stats, reachStats: kept and put back like any, never compared)
          sink.str(k); if (path) path.push('.' + k); value((o as Rec)[k]); if (path) path.pop(); }
        sink.word(15); return; }
      case K_MAP: { sink.word(16); sink.word((o as Map<unknown, unknown>).size); let n = 0;
        for (const [k, x] of o as Map<unknown, unknown>) { if (path) path.push(`<key ${n}>`); value(k); if (path) { path.pop(); path.push(`<${isObj(k) ? n : String(k)}>`); } value(x); if (path) path.pop(); n++; } return; }
      case K_SET: { sink.word(17); sink.word((o as Set<unknown>).size); let n = 0; for (const x of o as Set<unknown>) { if (path) path.push(`<member ${n++}>`); value(x); if (path) path.pop(); } return; }
      case K_BUF: { sink.word(18); const b = new Uint8Array(o as ArrayBuffer); sink.word(b.length); for (let i = 0; i < b.length; i++) sink.word(b[i]); return; }
      case K_SIDEMAP: case K_SIDESET: sink.word(19); if ((o as Table).sideName === undefined) found.push(o as Table); return;
      case K_RAWWEAK: sink.word(20); sink.note(`a plain WeakMap / WeakSet at ${path ? path.join('') : '(run stateDiff for the path)'}`); return;
      default: sink.word(21);
    }
  };
  const root = (name: string, v: unknown): void => { if (path) path.push(name); sink.str(name); value(v); if (path) path.pop(); };
  { const r = rootsOf(g); root('game', r[0]); root('world', r[1]); root('lights', r[2]); }
  for (const r of reg.roots) root(r.name, r.obj);
  for (const v of reg.vars) root(v.name, v.get());
  // the side tables: the named ones by name, then the found ones as found; within one, by the order its keys were met — never by the order they were set
  const tables: Table[] = reg.tables.slice(), pend: object[][] = [], hit: object[] = [];
  for (let moved = true, nFound = 0; moved;) {
    moved = false;
    while (nFound < found.length) tables.push(found[nFound++]);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]; let p = pend[i]; if (p === undefined) p = pend[i] = t.liveKeys();
      if (!p.length) continue;
      hit.length = 0; let n = 0;
      for (let j = 0; j < p.length; j++) { const k = p[j], a = idx.get(k); if (a === undefined) p[n++] = k; else hit.push(k); }
      p.length = n; if (!hit.length) continue;
      moved = true;
      hit.sort((a, b) => idx.get(a)! - idx.get(b)!);
      const name = t.sideName ?? `table#${idx.get(t)}`, map = t instanceof SideMap ? t : null;
      for (const k of hit.slice()) { if (path) path.push(`${name}{${where.get(k) ?? 'a host or static object'}}`); sink.str(name); sink.word(idx.get(k)!); if (map) value(map.get(k)); if (path) path.pop(); }
    }
    if (nFound < found.length) moved = true;
  }
}

/** the whole state as one word (two 32-bit halves, hex). `full`: the statics too */
export function stateHash(g: Game, full = false): string {
  let h1 = 0x811c9dc5 | 0, h2 = 0x9747b28c | 0; const notes: string[] = [];
  const word = (w: number): void => { h1 = Math.imul(h1 ^ w, 0x01000193); h2 = Math.imul((h2 << 5 | h2 >>> 27) ^ w, 0x9E3779B1); };
  const typed = (o: Typed): void => {   // (the raw bytes, four at a time where they sit on a word; a short one by its numbers — no buffer object is made for it)
    const n = o.length;
    if (n <= 16 || (o.byteOffset & 3) !== 0 || (o.byteLength & 3) !== 0) { for (let i = 0; i < n; i++) { F64[0] = o[i]; word(U32[0]); word(U32[1]); } return; }
    const w = new Uint32Array(o.buffer, o.byteOffset, o.byteLength >>> 2);
    for (let i = 0; i < w.length; i++) { const x = w[i]; h1 = Math.imul(h1 ^ x, 0x01000193); h2 = Math.imul((h2 << 5 | h2 >>> 27) ^ x, 0x9E3779B1); }
  };
  canon(g, full, { path: null, word, typed, num(x) { F64[0] = x; word(U32[0]); word(U32[1]); }, str(s) { word(hashStr(s)); }, note(w) { notes.push(w); } });
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

/** a state laid out flat: every value in the fixed order with the path it sits at (stateDiff's two sides; a tool keeps one of a frame it cannot keep the game of) */
export interface FlatState { toks: (number | string)[]; paths: string[] }
export function stateFlat(g: Game, full = false): FlatState {
  const toks: (number | string)[] = [], paths: string[] = [], path: string[] = [];
  const at = (): string => path.join('');
  canon(g, full, { path, word(w) { toks.push(w); paths.push(at()); }, num(x) { F64[0] = x; toks.push(`${x} (${U32[1].toString(16).padStart(8, '0')}${U32[0].toString(16).padStart(8, '0')})`); paths.push(at()); }, str(s) { toks.push('"' + s + '"'); paths.push(at()); }, note() {} });
  return { toks, paths };
}
/** where two flat states differ, as paths (at most `max`; after the first place their shapes part, the walk is out of step and stops). Empty = the same to the bit */
export function flatDiff(A: FlatState, B: FlatState, max = 12): string[] {
  const out: string[] = [], n = Math.min(A.toks.length, B.toks.length);
  for (let i = 0; i < n && out.length < max; i++) {
    if (A.toks[i] === B.toks[i]) continue;
    out.push(`${A.paths[i] || '(root)'}: ${A.toks[i]} | ${B.toks[i]}`);
    const text = i > 0 && A.toks[i - 1] === 2 && B.toks[i - 1] === 2;   // (a string VALUE: the walk stays in step past it; a key or a tag that differs does not)
    if (typeof A.toks[i] !== 'string' || typeof B.toks[i] !== 'string' || A.paths[i] !== B.paths[i] || (String(A.toks[i])[0] === '"' && !text)) { out.push('(the shapes part here: nothing after it is compared)'); return out; }
  }
  if (!out.length && A.toks.length !== B.toks.length) out.push(`one state is longer: ${A.toks.length} values against ${B.toks.length}`);
  return out;
}
/** where two games' states differ (flatDiff of the two) */
export function stateDiff(a: Game, b: Game, max = 12, full = false): string[] { return flatDiff(stateFlat(a, full), stateFlat(b, full), max); }
