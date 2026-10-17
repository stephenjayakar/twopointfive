// SIDE TABLES A SNAPSHOT CAN SEE. The simulation keeps a great deal of its state beside its objects: `const states = new WeakMap<Guard, St>()` at the top of a module,
// a `seen = new WeakSet<GameEvent>()` on a class, a module `let`. A WeakMap cannot be listed, and a module's own variables cannot be reached from outside it, so a
// snapshot of the whole game (game/rollback.ts: take / restore, what rollback netcode is built on) could not hold any of it. This file is what the game's modules use instead:
//   SideMap / SideSet   a WeakMap / WeakSet that can ALSO be listed (its live keys, in the order first set) — everything else is the WeakMap it extends: same calls, same
//                       garbage collection (the keys are held weakly; the list is of WeakRefs, swept as it grows). A table at the TOP of a module is given its name
//                       (`new SideMap<Guard, St>('doorway.states')`): named tables are kept in a list, since nothing else points at them. A table made inside a function or
//                       on an object takes no name: the snapshot finds it where it hangs.
//   rollbackVar         a module's own `let`: its name, how to read it, how to write it back
//   rollbackRoot        a module-level Map / Set / array / object the game writes to while it runs: its name and the thing itself (restored in place)
// THE RULE (tools/qa/rollback-check.ts is red otherwise): no `new WeakMap` / `new WeakSet` in the simulation's folders; every top-level table there is named; every
// module `let` and every module-level container the simulation writes while it runs is registered here, or listed in the check with the reason it need not be.
// Nothing here is in src/game's import cycle (it imports nothing), so a module may call it in a top-level statement.

type Table = SideMap<object, unknown> | SideSet<object>;
const NAMED: Table[] = [];
const NAMES = new Set<string>();
function named(t: Table, name: string): void {
  if (NAMES.has(name)) throw new Error(`side table '${name}' is named twice`);
  NAMES.add(name); NAMED.push(t);
}

/** the weak keys of one table, listable: WeakRefs in the order first set, with a WeakSet beside them so a key is listed once however often it is deleted and set again */
class Keys {
  refs: WeakRef<object>[] = [];
  private listed = new WeakSet<object>();
  private sweepAt = 64;
  add(k: object, has: (k: object) => boolean): void {
    if (this.listed.has(k)) return;
    this.listed.add(k); this.refs.push(new WeakRef(k));
    if (this.refs.length >= this.sweepAt) { this.sweep(has); this.sweepAt = Math.max(64, 2 * this.refs.length); }
  }
  /** drop the refs whose key is gone (collected, or deleted from the table) */
  sweep(has: (k: object) => boolean): void {
    const r = this.refs; let n = 0;
    for (let i = 0; i < r.length; i++) { const k = r[i].deref(); if (k === undefined) continue; if (has(k)) r[n++] = r[i]; else this.listed.delete(k); }
    r.length = n;
  }
}

export class SideMap<K extends object, V> extends WeakMap<K, V> {
  /** the table's name when it stands at the top of a module ('module.variable'), undefined on one that hangs off an object */
  readonly sideName: string | undefined;
  private readonly sideKeys = new Keys();
  private readonly sideHas = (k: object): boolean => super.has(k as K);
  constructor(name?: string) { super(); this.sideName = name; if (name !== undefined) named(this as unknown as Table, name); }
  override set(k: K, v: V): this { super.set(k, v); this.sideKeys.add(k, this.sideHas); return this; }   // (listed AFTER it is in: the list's sweep drops what the table does not hold)
  /** every key the table holds now, in the order first set */
  liveKeys(out: K[] = []): K[] { for (const r of this.sideKeys.refs) { const k = r.deref() as K | undefined; if (k !== undefined && super.has(k)) out.push(k); } return out; }
}

export class SideSet<K extends object> extends WeakSet<K> {
  readonly sideName: string | undefined;
  private readonly sideKeys = new Keys();
  private readonly sideHas = (k: object): boolean => super.has(k as K);
  constructor(name?: string) { super(); this.sideName = name; if (name !== undefined) named(this as unknown as Table, name); }
  override add(k: K): this { super.add(k); this.sideKeys.add(k, this.sideHas); return this; }
  liveKeys(out: K[] = []): K[] { for (const r of this.sideKeys.refs) { const k = r.deref() as K | undefined; if (k !== undefined && super.has(k)) out.push(k); } return out; }
}

/** a module's own variable: read and written back through the two functions the module hands over */
export interface SideVar { name: string; get: () => unknown; set: (v: never) => void }
const VARS: SideVar[] = [];
/** register a module `let` the simulation writes while it runs: `rollbackVar('weather.clock', () => clock, v => { clock = v; })` */
export function rollbackVar<T>(name: string, get: () => T, set: (v: T) => void): void {
  if (NAMES.has(name)) throw new Error(`rollback variable '${name}' is named twice`);
  NAMES.add(name); VARS.push({ name, get, set: set as (v: never) => void });
}
const ROOTS: { name: string; obj: object }[] = [];
/** register a module-level Map / Set / array / object the simulation writes while it runs (restored in place); returns it, so a declaration can be wrapped */
export function rollbackRoot<T extends object>(name: string, obj: T): T {
  if (NAMES.has(name)) throw new Error(`rollback root '${name}' is named twice`);
  NAMES.add(name); ROOTS.push({ name, obj }); return obj;
}

/** everything registered, for game/rollback.ts: the named tables, the variables and the roots, each in the order of its NAME (the same on every machine, whatever order the modules ran in) */
export function sideRegistry(): { tables: readonly Table[]; vars: readonly SideVar[]; roots: readonly { name: string; obj: object }[] } {
  if (sorted !== NAMES.size) {
    NAMED.sort((a, b) => a.sideName! < b.sideName! ? -1 : 1); VARS.sort((a, b) => a.name < b.name ? -1 : 1); ROOTS.sort((a, b) => a.name < b.name ? -1 : 1); sorted = NAMES.size;
  }
  return { tables: NAMED, vars: VARS, roots: ROOTS };
}
let sorted = 0;
