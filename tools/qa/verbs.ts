// Shared helpers for driving the Space selector (src/game/interact.ts) from the QA probes the way a hand does: a one-frame TAP on the highlighted row, the
// highlight put on a named row first (Game.selectVerb — what holding Space and scrolling to it does), a HOLD let go (which performs on the release), and the
// two ends of a hold — the choke / the pistol-whip — chosen on their row and, when a probe wants them stopped early, stopped by a second tap. Every probe file
// that used to hold Space down for a verb goes through these, so the grammar lives in one place.
export const IK = 'Space';

/** a one-frame tap: the press edge with the key already up — interact.ts performs the highlighted row inside that step. Does NOT step. */
export function tapKey(W: any, code: string = IK) { W.input.pressed.add(code); }
/** put the highlight on the row of `kind` (whose verb is `verb`, if given) and tap it; steps ONE frame (the tap's). False if no such row is on offer. */
export function tapVerb(W: any, kind: string, verb?: string, dt = 1 / 60): boolean { if (!W.game.selectVerb(kind, verb)) return false; W.input.pressed.add(IK); W.step(dt); return true; }
/** hold `code` down for `secs` of frames (keys + the press edge on the first), then let it up and step ONE more frame — for Space that release frame is where the
 *  highlighted row is performed (a hold past TAP_SECS opened the list; letting go acts). `each` runs after every held frame. Returns frames stepped in all. */
export function holdRelease(W: any, code: string, secs: number, each?: () => void, dt = 1 / 60): number { const n = Math.max(1, Math.round(secs / dt)); W.input.keys.add(code); W.input.pressed.add(code); for (let i = 0; i < n; i++) { W.step(dt); each?.(); } W.input.keys.delete(code); W.step(dt); each?.(); return n + 1; }
/** choose the choke (arm hold) / the whip (gun hold) on its row and tap it: it commits HOLD.secs.chokeHold later and runs on its own. Steps the tap's frame. */
export function startEnd(W: any, dt = 1 / 60): boolean { const H = W.game.player.holding; if (!H) return false; return tapVerb(W, 'held', H.variant === 'gun' ? 'whip' : 'choke', dt); }
/** run the hold's end for `secs` from choosing it, then stop it with a second tap (he breathes again / the pistol goes back) — the old 'Space up early'. `each`
 *  after every frame. Steps: the choosing tap, secs of frames, the stopping tap. */
export function endThenStop(W: any, secs: number, each?: () => void, dt = 1 / 60) { startEnd(W, dt); each?.(); const n = Math.max(0, Math.round(secs / dt) - 1); for (let i = 0; i < n; i++) { W.step(dt); each?.(); } W.input.pressed.add(IK); W.step(dt); each?.(); }
/** run the hold's end for `secs` from choosing it and leave it running (a full choke / whip lands inside if secs covers it). `each` after every frame. */
export function endFor(W: any, secs: number, each?: () => void, dt = 1 / 60) { startEnd(W, dt); each?.(); const n = Math.max(0, Math.round(secs / dt) - 1); for (let i = 0; i < n; i++) { W.step(dt); each?.(); } }
