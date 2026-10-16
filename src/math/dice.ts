// Dice shared by the simulation's seams. mulberry32 is the one seeded die the QA harness, the checkpoints' identity claim and the session journal all mean by
// 'seeded' (tools/qa seeds Math.random with the same function). A die the session JOURNAL installs as Math.random for the simulation (game/journal.ts) carries the
// die it displaced on `.sys`, and the systems that are NOT the simulation — the mixer's rate jitter and noise beds (audio/), the smoke solver's per-frame emitter
// jitter (smoke/smoke.ts) — draw through sysRandom(): under a recording they leave the seeded stream to the game alone (a replay has no mixer or solver to draw),
// while a plainly seeded Math.random (the capture recipes' determinism checklist, the harness) still reaches them exactly as it always did.

/** mulberry32: a small, fast, seedable uniform [0, 1) generator */
export function mulberry32(a: number): () => number { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** a small stable string hash (FNV-1a, 32 bit): the same string gives the same number on every machine — what things DEALT by name, never rolled, are dealt off */
export function hashStr(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** a die standing in for Math.random on the simulation's behalf, remembering the one it displaced */
export type SimDie = (() => number) & { sys?: () => number };
/** the seeded simulation die for `seed`, to be assigned to Math.random; `displaced` (the Math.random of the moment) rides on .sys for sysRandom() and for putting back */
export function simDie(seed: number, displaced: () => number): SimDie { const d = mulberry32(seed) as SimDie; d.sys = displaced; return d; }
/** a draw for something that is not the simulation: the displaced system die under a recording, plain Math.random otherwise */
export function sysRandom(): number { const r = Math.random as SimDie; return (r.sys ?? r)(); }

// THE SIMULATION'S OWN DIE. Every draw the game makes goes through simRandom() below (no file under src/game calls Math.random for one any more: tools/qa/dice-check.ts
// holds that). A Game stood up with a seed (host/standup.ts StandOpts.seed — the page always is) OWNS a die: one mulberry32 word on the Game, so the stream is the
// game's alone (nothing else in the page can draw from it), a checkpoint carries where it stands (savestate.ts `dice`), and two machines given the same seed and the
// same inputs roll the same numbers — what a server and a client predicting off it need. A Game stood up without one (the QA harness, whose tools seed Math.random)
// draws Math.random exactly as it always did, number for number.
// ONE RULE keeps every older tool and recipe working: a die of the game's own is used only while Math.random is still the function it was when that die was made. The
// moment somebody puts a die of THEIR OWN in Math.random's place — a probe's seed, a capture recipe's, the session journal's recording die above, the civilians'
// private construction die — the game draws theirs, as it always has, and goes back to its own when they put Math.random back.
/** a game's own die: `s` = the mulberry32 word (the whole state), `n` = draws taken off it, `seed` = what it started from, `sys` = Math.random as it was when the die was made */
export interface SimDice { s: number; n: number; seed: number; sys: () => number }
let cur: SimDice | null = null;
/** a die for a Game, at the start of `seed`'s stream (the same numbers mulberry32(seed) gives) */
export function newDice(seed: number): SimDice { return { s: seed | 0, n: 0, seed: seed >>> 0, sys: Math.random }; }
/** make `d` the die simRandom() draws (null: none — Math.random); returns the one it replaced. Game.update's first statement, the stand-up and a load call it */
export function useDice(d: SimDice | null): SimDice | null { const p = cur; cur = d; return p; }
/** the die in use (null: the game draws Math.random) — false also while somebody else's die stands in Math.random's place */
export function diceInUse(): SimDice | null { return cur && Math.random === cur.sys ? cur : null; }
/** a draw for the SIMULATION, uniform in [0, 1): the Game's own die when it has one, Math.random otherwise (see the rule above) */
export function simRandom(): number {
  const d = cur; if (!d || Math.random !== d.sys) return Math.random();
  d.n++; const a = d.s = (d.s + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
