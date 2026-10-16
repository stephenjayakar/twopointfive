// EVERY MISSION STARTS THE SAME WAY ON EVERY TRY (the maintainer, 10-11: "i'd also prefer we make the puzzles more curated and interesting rather than relying too
// much on randomness" · "i'd rather we have a lot of interesting levels and achievements for completing them on fewer tries rather than trying to randomly shuffle
// them around").
//
// A level on the mission list is a puzzle somebody laid out; what stands where when it opens is the level file's, not a die's. With the switch on, each thing a
// staging used to draw is the file's own first answer instead:
//   · a room clear's defenders = each room's first `garrison` marks as written (placeDefenders' seed 0, attempt 1) on every load AND every restart — no fresh
//     placement off the visit's seed (ROOMCLEAR.fresh), no next placement on a restart (ROOMCLEAR.reroll) — and the way in is the one picked, never dealt
//     (`way=any` = the level's own);
//   · a hostage rescue's roamers = its first marks as written, and the captor's clock is `RESCUE.resolveSecs` to the second (no ± resolveSpread);
//   · a quiet mission that names no pin = the first start, the first spot and the first patrol set of its lists (`?quiet=N` still deals pin N's).
// What a start NAMES it still gets: `?roomclear=3`, the Tab seed slider, a Training row's seed, `?quiet=N`, `?way=2` — the same on a restart too (a named seed's
// later attempts are the switch off's). What is rolled once play begins (aim scatter,
// bark timing, each man's stride phase and glance clock) is untouched too: the same plan can still come out two ways, the same floor never opens two ways.
//
// OFF = every staging as it was (the deals above, fresh per visit, the next on a restart). On in the page (host/profile.ts pageSwitches; `?samestart=0` = off),
// off here and on the frozen harness stand (`TPS_SAMESTART=1` turns it on): every frozen digest and tally was recorded on the old deals.
// A leaf: nothing imported, nothing built at load (src/game is one import cycle).

/** the switch */
export const SAMESTART = { on: false };
