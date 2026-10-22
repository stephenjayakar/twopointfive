// The editor's DOCUMENT: one LevelData (scene/levelData.ts) plus the command stack every change goes through — the UI's drags and fields, the
// palette, and the programmatic mirror (window.__ed) all call the same few primitives here, so undo / redo, the dirty flag and the change
// notifications work identically for a hand edit and a scripted one. Pure data: no DOM, no GPU (tools/qa/editor-probes.ts runs it under bun).
//
// Model:
//   - a COMMAND is a labelled list of OPS applied in order; undo applies their inverses in reverse, redo re-applies. Ops address the document by
//     PATH — keys and array indices AS THEY WERE when the op was made — which is sound because the stack only ever replays in exact order.
//       { k: 'set', path, before, after }   replace the value at path (a whole entity, or one top-level record like `mission`); after === undefined deletes an object key
//       { k: 'ins', path, index, value }    insert into the array at path;  inverse = del
//       { k: 'del', path, index, value }    remove from the array at path;  inverse = ins
//     Values are deep-copied snapshots (an entity is ~200 bytes; a 100-deep stack of whole-box snapshots is nothing).
//   - begin(label) … commit() groups ops into one command (delete a box = remove it + drop it from the switchable that listed it + clear the light
//     fixture that named it: one undo step). Nesting is counted; the outermost commit pushes. transact(label, fn) is the form every multi-op verb
//     uses: begin, run fn, commit — or, when fn throws, ROLL BACK the ops that level applied and rethrow, so an exception half-way through a verb
//     never leaves half a verb in the document (a bare begin / try / finally-commit pushed the partial command — review T4.7).
//   - COALESCING: update(…, { coalesce: key }) folds into the command on top of the undo stack when that command carries the same key and is not
//     sealed — a drag emits one command however many mousemoves it took, a scrubbed field one per scrub. seal() (mouseup, tool end, blur) closes it.
//   - listeners hear WHICH collections changed (a Set of top-level keys) after every apply / undo / redo / load, so the scene re-syncs only what moved.
import { LevelData, levelDataDigest, canonicalLevelData, validateLevelData, freshId, indexLevelData } from '../scene/levelData';

export type Path = (string | number)[];
export type Op =
  | { k: 'set'; path: Path; before: unknown; after: unknown }
  | { k: 'ins'; path: Path; index: number; value: unknown }
  | { k: 'del'; path: Path; index: number; value: unknown };
export interface Command { label: string; ops: Op[]; coalesceKey?: string; sealed?: boolean; t: number }

/** The id-bearing arrays an entity op can name (plans.roomClear is addressed by path ['plans', 'roomClear']). */
export const COLLECTIONS = ['boxes', 'props', 'lights', 'switchables', 'doors', 'routes', 'chokepoints', 'volumes', 'devices', 'connectors', 'beacons', 'floors'] as const;
export type Collection = typeof COLLECTIONS[number];

/** deep copy of plain JSON data (undefined-valued keys dropped) — every snapshot in an op is one of these, so nothing in the stack aliases the live document */
export function clonePlain<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clonePlain) as unknown as T;
  if (v && typeof v === 'object') { const o: any = {}; for (const k of Object.keys(v)) { const x = (v as any)[k]; if (x !== undefined) o[k] = clonePlain(x); } return o; }
  return v;
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Doc {
  data!: LevelData;
  undoStack: Command[] = [];
  redoStack: Command[] = [];
  /** digest of the document as last saved / loaded — `dirty` compares against it */
  savedDigest = '';
  /** bumps on every change (apply / undo / redo / load): cheap 'did anything change since I looked' for the UI */
  rev = 0;
  maxDepth = 200;
  /** the open (outermost) command and, per nesting level, how many of its ops were there when that level began — a level's rollback undoes exactly its own */
  private open: Command | null = null; private marks: number[] = [];
  private get depth() { return this.marks.length; }
  private listeners: ((changed: Set<string>, why: 'apply' | 'undo' | 'redo' | 'load') => void)[] = [];
  /** id → index per collection, rebuilt lazily after a change (indexLevelData) */
  private ix: ReturnType<typeof indexLevelData> | null = null;

  constructor(data: LevelData) { this.load(data); }

  /** Replace the whole document (a load, a new file): stacks cleared, saved digest = this. `data` is COPIED (canonical deep copy). */
  load(data: LevelData, opts: { keepSaved?: boolean } = {}) {
    this.data = canonicalLevelData(data);
    this.undoStack.length = 0; this.redoStack.length = 0; this.open = null; this.marks.length = 0; this.ix = null; this.rev++;
    if (!opts.keepSaved) this.savedDigest = levelDataDigest(this.data);
    this.emit(new Set(['*']), 'load');
  }
  onChange(f: (changed: Set<string>, why: 'apply' | 'undo' | 'redo' | 'load') => void) { this.listeners.push(f); }
  private emit(changed: Set<string>, why: 'apply' | 'undo' | 'redo' | 'load') { for (const f of this.listeners) f(changed, why); }

  digest(): string { return levelDataDigest(this.data); }
  get dirty(): boolean { return this.digest() !== this.savedDigest; }
  markSaved() { this.savedDigest = this.digest(); this.rev++; }
  validate(): string[] { return validateLevelData(this.data); }
  index() { return this.ix ??= indexLevelData(this.data); }
  /** index of the entity with `id` in collection `coll` (−1 if none) */
  indexOf(coll: Collection, id: string): number {
    if (coll === 'floors') return this.data.floors.findIndex(f => f.id === id);
    const m = (this.index() as any)[coll] as Map<string, number> | undefined; return m?.get(id) ?? -1;
  }
  get<T = any>(coll: Collection, id: string): T | null { const i = this.indexOf(coll, id); return i < 0 ? null : (this.data as any)[coll][i] as T; }
  freshId(prefix: string, coll: Collection): string { return freshId(prefix, (this.data as any)[coll]); }

  // ---------------------------------------------------------------- path access
  private at(path: Path): any { let o: any = this.data; for (const k of path) { if (o == null) throw new Error(`doc: bad path ${JSON.stringify(path)}`); o = o[k]; } return o; }
  read<T = unknown>(path: Path): T { return this.at(path) as T; }

  // ---------------------------------------------------------------- applying ops (the ONLY place the document is mutated)
  private applyOp(op: Op, changed: Set<string>) {
    changed.add(String(op.path[0]));
    if (op.k === 'set') {
      const parent = this.at(op.path.slice(0, -1)); const key = op.path[op.path.length - 1];
      if (op.after === undefined) { if (Array.isArray(parent)) throw new Error('doc: set undefined on an array slot (use del)'); delete parent[key]; }
      else parent[key] = clonePlain(op.after);
    } else if (op.k === 'ins') {
      const arr = this.at(op.path); if (!Array.isArray(arr)) throw new Error(`doc: ins on non-array ${JSON.stringify(op.path)}`);
      if (op.index < 0 || op.index > arr.length) throw new Error(`doc: ins index ${op.index} out of 0..${arr.length}`);
      arr.splice(op.index, 0, clonePlain(op.value));
    } else {
      const arr = this.at(op.path); if (!Array.isArray(arr)) throw new Error(`doc: del on non-array ${JSON.stringify(op.path)}`);
      if (op.index < 0 || op.index >= arr.length) throw new Error(`doc: del index ${op.index} out of 0..${arr.length - 1}`);
      arr.splice(op.index, 1);
    }
    if (COLLECTIONS.includes(op.path[0] as Collection) || op.path[0] === 'plans') this.ix = null;
  }
  private inverse(op: Op): Op {
    if (op.k === 'set') return { k: 'set', path: op.path, before: op.after, after: op.before };
    if (op.k === 'ins') return { k: 'del', path: op.path, index: op.index, value: op.value };
    return { k: 'ins', path: op.path, index: op.index, value: op.value };
  }

  // ---------------------------------------------------------------- command grouping
  /** Open a command; every op until the matching commit() joins it. Nested begin/commit pairs fold into the outermost. */
  begin(label: string, coalesceKey?: string) {
    if (!this.open) this.open = { label, ops: [], coalesceKey, t: now() };
    this.marks.push(this.open.ops.length);
  }
  commit() {
    if (this.depth <= 0) throw new Error('doc: commit without begin');
    this.marks.pop();
    if (this.depth > 0) return;
    const cmd = this.open!; this.open = null;
    if (!cmd.ops.length) return;
    this.push(cmd);
  }
  /** Abandon the innermost open level, undoing the ops applied since ITS begin (all of the command's at the outermost: a tool cancelled mid-gesture); any
   *  outer level stays open with its own ops intact. */
  rollback() {
    if (this.depth <= 0) return;
    const from = this.marks.pop()!; const cmd = this.open!;
    const changed = new Set<string>();
    for (let i = cmd.ops.length - 1; i >= from; i--) this.applyOp(this.inverse(cmd.ops[i]), changed);
    cmd.ops.length = from;
    if (this.depth === 0) this.open = null;
    if (changed.size) { this.rev++; this.emit(changed, 'undo'); }
  }
  /** Abandon the WHOLE open command, every level (an undo pressed mid-gesture, a load). */
  rollbackAll() { while (this.depth > 0) this.rollback(); }
  /** Run `fn` as ONE command labelled `label`: begin … commit — or, when fn throws, roll back exactly the ops this level applied and rethrow (nothing of a
   *  failed verb stays in the document or on the undo stack). Nestable like begin/commit; returns fn's value. THE form for multi-op verbs (review T4.7). */
  transact<T>(label: string, fn: () => T, coalesceKey?: string): T {
    this.begin(label, coalesceKey);
    let out: T;
    try { out = fn(); } catch (e) { this.rollback(); throw e; }
    this.commit();
    return out;
  }
  private push(cmd: Command) {
    const top = this.undoStack[this.undoStack.length - 1];
    // coalesce: same key, top unsealed, both commands pure 'set' lists → fold each op into the top's op on the same path (its `after` moves on, its
    // `before` stays the gesture's start) or append it (a path the gesture had not touched yet). One command per drag / scrub, however many events.
    if (cmd.coalesceKey && top && !top.sealed && top.coalesceKey === cmd.coalesceKey && cmd.ops.every(o => o.k === 'set') && top.ops.every(o => o.k === 'set')) {
      for (const op of cmd.ops as (Op & { k: 'set' })[]) { const prev = top.ops.find(o => samePath(o.path, op.path)) as (Op & { k: 'set' }) | undefined; if (prev) prev.after = clonePlain(op.after); else top.ops.push(op); }
      top.t = cmd.t; this.redoStack.length = 0; return;
    }
    this.undoStack.push(cmd); this.redoStack.length = 0;
    while (this.undoStack.length > this.maxDepth) this.undoStack.shift();
  }
  /** Close the top command to further coalescing (end of a drag / scrub). */
  seal() { const top = this.undoStack[this.undoStack.length - 1]; if (top) top.sealed = true; }

  /** Apply ops NOW as (part of) a command. Outside begin/commit they form their own command. Inside an open command (a gesture), a coalescing
   *  'set' on a path the command has already set folds into that op (its `after` moves on, its `before` stays the gesture's start) — so a drag of
   *  three boxes over two hundred mousemoves is one command of three ops. */
  apply(label: string, ops: Op[], opts: { coalesce?: string } = {}): void {
    if (!ops.length) return;
    const changed = new Set<string>();
    const done: Op[] = [];
    try { for (const op of ops) { this.applyOp(op, changed); done.push(op); } }
    catch (e) { for (let i = done.length - 1; i >= 0; i--) this.applyOp(this.inverse(done[i]), changed); throw e; }   // all or nothing
    this.rev++;
    if (this.open) {
      const level = this.marks[this.marks.length - 1] ?? 0;   // (fold only into this nesting level's own ops: a rollback of the level must take the folded value with it)
      for (const op of ops) {
        if (opts.coalesce && op.k === 'set') {   // fold into an earlier set on the same path — but only one made AFTER the gesture's last ins/del (indices are stable since then)
          let lastStructural = -1; this.open.ops.forEach((o, i) => { if (o.k !== 'set') lastStructural = i; });
          const prev = this.open.ops.find((o, i) => i > lastStructural && i >= level && o.k === 'set' && samePath(o.path, op.path)) as (Op & { k: 'set' }) | undefined;
          if (prev) { prev.after = clonePlain(op.after); continue; }
        }
        this.open.ops.push(clonePlainOp(op));
      }
      if (opts.coalesce && !this.open.coalesceKey) this.open.coalesceKey = opts.coalesce;
    }
    else this.push({ label, ops: ops.map(clonePlainOp), coalesceKey: opts.coalesce, t: now() });
    this.emit(changed, 'apply');
  }

  undo(): string | null {
    if (this.depth > 0) { const label = this.open!.label; this.rollbackAll(); return label; }   // (pressed mid-gesture: the gesture going IS the undo — the finished command under it stays)
    const cmd = this.undoStack.pop(); if (!cmd) return null;
    const changed = new Set<string>();
    for (let i = cmd.ops.length - 1; i >= 0; i--) this.applyOp(this.inverse(cmd.ops[i]), changed);
    cmd.sealed = true; this.redoStack.push(cmd); this.rev++; this.emit(changed, 'undo');
    return cmd.label;
  }
  redo(): string | null {
    const cmd = this.redoStack.pop(); if (!cmd) return null;
    const changed = new Set<string>();
    for (const op of cmd.ops) this.applyOp(op, changed);
    this.undoStack.push(cmd); this.rev++; this.emit(changed, 'redo');
    return cmd.label;
  }
  get canUndo() { return this.undoStack.length > 0 || this.depth > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  history() { return { undo: this.undoStack.map(c => c.label), redo: this.redoStack.map(c => c.label) }; }

  // ---------------------------------------------------------------- entity primitives (what tools and __ed call)
  /** Insert an entity into a collection (at the end unless `index`); returns its id. */
  insert<T extends { id: string }>(coll: Collection, entity: T, index?: number, label = `add ${coll.replace(/s$/, '')} ${entity.id}`): string {
    const arr = (this.data as any)[coll] as { id: string }[];
    if (arr.some(e => e.id === entity.id)) throw new Error(`${coll}: id '${entity.id}' already exists`);
    this.apply(label, [{ k: 'ins', path: [coll], index: index ?? arr.length, value: entity }]);
    return entity.id;
  }
  /** Remove an entity by id (no reference clean-up here — Editor.delete does the cascading). */
  remove(coll: Collection, id: string, label = `delete ${id}`): void {
    const i = this.indexOf(coll, id); if (i < 0) throw new Error(`${coll}: no '${id}'`);
    this.apply(label, [{ k: 'del', path: [coll], index: i, value: clonePlain((this.data as any)[coll][i]) }]);
  }
  /** Replace an entity wholesale (or patch it: `patch` object merged shallowly, or a function returning the new entity). Keys set to undefined are dropped. */
  update<T extends { id: string }>(coll: Collection, id: string, patch: Partial<T> | ((e: T) => T), opts: { coalesce?: string; label?: string } = {}): void {
    const i = this.indexOf(coll, id); if (i < 0) throw new Error(`${coll}: no '${id}'`);
    const before = (this.data as any)[coll][i] as T;
    const after = clonePlain(typeof patch === 'function' ? patch(clonePlain(before)) : { ...before, ...patch });
    if ((after as any).id !== id) {   // a rename: refuse a clash (references are the caller's to rewrite — Editor.rename does)
      if (((this.data as any)[coll] as { id: string }[]).some((e, k) => k !== i && e.id === (after as any).id)) throw new Error(`${coll}: id '${(after as any).id}' already exists`);
    }
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.apply(opts.label ?? `edit ${id}`, [{ k: 'set', path: [coll, i], before: clonePlain(before), after }], { coalesce: opts.coalesce });
  }
  /** Set any top-level record or a key path inside one (mission.playerSpawn, sky, breaker, materials.<k>, meta.grid, name…). */
  setPath(path: Path, value: unknown, opts: { coalesce?: string; label?: string } = {}): void {
    const parent = this.at(path.slice(0, -1)); const key = path[path.length - 1];
    const before = parent == null ? undefined : parent[key];
    if (JSON.stringify(before) === JSON.stringify(value)) return;
    this.apply(opts.label ?? `set ${path.join('.')}`, [{ k: 'set', path, before: clonePlain(before), after: clonePlain(value) }], { coalesce: opts.coalesce });
  }
}

const samePath = (a: Path, b: Path) => a.length === b.length && a.every((k, i) => k === b[i]);
const clonePlainOp = (op: Op): Op => op.k === 'set' ? { k: 'set', path: [...op.path], before: clonePlain(op.before), after: clonePlain(op.after) } : { k: op.k, path: [...op.path], index: op.index, value: clonePlain(op.value) };
