// Dice shared by the simulation's seams. mulberry32 is the one seeded die the QA harness, the checkpoints' identity claim and the session journal all mean by
// 'seeded' (tools/qa seeds Math.random with the same function). A die the session JOURNAL installs as Math.random for the simulation (game/journal.ts) carries the
// die it displaced on `.sys`, and the systems that are NOT the simulation — the mixer's rate jitter and noise beds (audio/), the smoke solver's per-frame emitter
// jitter (smoke/smoke.ts) — draw through sysRandom(): under a recording they leave the seeded stream to the game alone (a replay has no mixer or solver to draw),
// while a plainly seeded Math.random (the capture recipes' determinism checklist, the harness) still reaches them exactly as it always did.

/** mulberry32: a small, fast, seedable uniform [0, 1) generator */
export function mulberry32(a: number): () => number { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** a die standing in for Math.random on the simulation's behalf, remembering the one it displaced */
export type SimDie = (() => number) & { sys?: () => number };
/** the seeded simulation die for `seed`, to be assigned to Math.random; `displaced` (the Math.random of the moment) rides on .sys for sysRandom() and for putting back */
export function simDie(seed: number, displaced: () => number): SimDie { const d = mulberry32(seed) as SimDie; d.sys = displaced; return d; }
/** a draw for something that is not the simulation: the displaced system die under a recording, plain Math.random otherwise */
export function sysRandom(): number { const r = Math.random as SimDie; return (r.sys ?? r)(); }
