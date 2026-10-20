// FINDING YOUR OWN MAN ON THE SCREEN, and how the camera answers the hand: four settings to play with (Options > Game; ui/findme.ts draws the one that is
// picture and builds the rows). Every one starts where the game stood before it had them, on the page and on both of the harness's stands: nothing here is a
// new default, and with all four as they start the build is the build as it was. (Two more are SHELVED, 2026-10-20: an outline of him in the dark and his
// shape through a wall. A kept line that still names them reads as if it did not: ui/findme.ts says why.)
//   pan      how far the view leans from the man toward the aim point, as a share of the follow camera's own lead (FollowCamera.aimLead as it was built):
//            1 = as it was · 0 = he is the middle of the screen wherever the mouse goes
//   ring     the gold ring at his feet (the one an open order menu draws: ui/planfloor.ts) on at all times
//   turn     which way the view turns under Ctrl + the mouse: 1 = as it was · -1 = the other way
//   behind   Ctrl tapped twice brings the view round to look where he was looking at the tap. NOT 'the camera behind him' in a third-person game's sense, and
//            it cannot be while the system cursor is the aim: he faces the cursor's point in the world, the cursor stays where it is on the screen, so as
//            the view turns he would turn with it. So his aim is CARRIED round with the view (AimCarry, below): he goes on facing what he faced, now at
//            the top of the screen, until the hand uses the mouse or a key that reads the cursor; then the cursor is the aim again
// pan, turn and behind change the seat's VIEW, and the view is the player's input (game/cmd.ts carries it as data, tick by tick): a recording replays the view
// it was made with whatever these say today, and no rule of the game reads this table. ring is the HUD's alone: nobody's senses, no light
// meter and no digest can tell it on from off.
// KEPT PER MACHINE (localStorage `twopointsix.findme`), read once as this module loads; a harness has no store and gets the starts. No imports, on purpose:
// the loop (host/loop.ts) and the engine replay's own view (replay/engineplay.ts, its Ctrl turn) read the table and nothing of the game or the page comes with it.

export interface FindMe { pan: number; ring: boolean; turn: 1 | -1; behind: boolean }
export const FINDME_START: Readonly<FindMe> = { pan: 1, ring: false, turn: 1, behind: false };
export const FINDME: FindMe = { ...FINDME_START };
const LS = 'twopointsix.findme';

/** what a kept line says, whatever it holds: a field that is missing or not of its kind is the start's */
export function findMeRead(text: string | null | undefined): FindMe {
  let v: Record<string, unknown> = {};
  try { const j = JSON.parse(text ?? 'null'); if (j && typeof j === 'object') v = j; } catch { /* not ours */ }
  const flag = (k: 'ring' | 'behind') => typeof v[k] === 'boolean' ? v[k] as boolean : FINDME_START[k];
  const pan = typeof v.pan === 'number' && isFinite(v.pan) ? Math.max(0, Math.min(1, v.pan)) : FINDME_START.pan;
  return { pan, ring: flag('ring'), turn: v.turn === -1 ? -1 : 1, behind: flag('behind') };
}
/** the camera whose lead `pan` scales, and that lead as it was built (bindFindMe) */
let seat: { aimLead: number } | null = null, lead = 0;
/** the page hands over its follow camera once (main.ts): a kept pan under 1 is put on it; at 1 the camera is not written at all. After that the camera's lead is
 *  written only when the pan row itself moves (to that share of the lead as built: the debugger's own aim lead slider writes the same number, and the later hand wins) */
export function bindFindMe(cam: { aimLead: number }) { seat = cam; lead = cam.aimLead; if (FINDME.pan !== 1) cam.aimLead = lead * FINDME.pan; }
/** one setting changed by the player: on the table, on the camera if it is the pan, and kept */
export function setFindMe<K extends keyof FindMe>(k: K, v: FindMe[K]) { if (put(k, v)) keep(); }
/** all four back to their starts (Options' Reset): only what had been moved is written */
export function resetFindMe() { let any = false; for (const k of Object.keys(FINDME_START) as (keyof FindMe)[]) any = put(k, FINDME_START[k]) || any; if (any) keep(); }
function put<K extends keyof FindMe>(k: K, v: FindMe[K]): boolean { if (FINDME[k] === v) return false; FINDME[k] = v; if (k === 'pan' && seat) seat.aimLead = lead * FINDME.pan; return true; }
function keep() { try { globalThis.localStorage?.setItem(LS, JSON.stringify(FINDME)); } catch { /* no store */ } }
try { Object.assign(FINDME, findMeRead(globalThis.localStorage?.getItem(LS))); } catch { /* no store */ }

// ---- Ctrl + the mouse
/** the view's turn for `dx` pixels of the mouse under Ctrl (rad), the way round the `turn` row says: the one place the rate and the sign are written (the
 *  loop's orbit in play, the engine replay's own view) */
export function ctrlTurn(dx: number): number { return dx * 0.006 * FINDME.turn; }

// ---- Ctrl tapped twice
/** what counts as a tap of the camera key, and as two of them: down no longer than `tapMs`, the second down within `gapMs` of the first coming up, the mouse
 *  moved no further than `driftPx` with the key down (further is an orbit, however short) */
export const TAPTWICE = { tapMs: 250, gapMs: 300, driftPx: 12 };
/** Two short presses of one key with nothing else in between, told from the times the page saw them. A key held down is never a tap however long it repeats
 *  (down() while it is down is ignored), a press with another key, a button, the wheel or an orbit in it is not one, and the answer comes as the SECOND tap
 *  is let go: both presses have to have been taps. */
export class TapTwice {
  private downAt = -1; private firstUp = -1; private clean = false; private drift = 0;
  down(t: number) { if (this.downAt >= 0) return; this.downAt = t; this.clean = true; this.drift = 0; if (this.firstUp >= 0 && t - this.firstUp > TAPTWICE.gapMs) this.firstUp = -1; }
  /** the key came up: true = that was the second of two taps */
  up(t: number): boolean {
    const tap = this.downAt >= 0 && this.clean && t - this.downAt <= TAPTWICE.tapMs && this.drift <= TAPTWICE.driftPx; this.downAt = -1;
    if (!tap) { this.firstUp = -1; return false; }
    if (this.firstUp >= 0) { this.firstUp = -1; return true; }
    this.firstUp = t; return false;
  }
  /** anything else the hand did: another key, a mouse button, the wheel */
  other() { this.clean = false; this.firstUp = -1; }
  /** the mouse moved this many pixels (it counts only with the key down) */
  moved(px: number) { if (this.downAt >= 0) this.drift += Math.abs(px); }
  reset() { this.downAt = -1; this.firstUp = -1; this.clean = false; this.drift = 0; }
}
/** The page's listener for it (main.ts, once): returns the loop's `ctrlTwice` — true once for each double tap, taken as it is asked. A tap in a text field
 *  is not the game's; `idle()` true (the tour has the hands) = none is. It claims no key and prevents nothing: the browser's own Ctrl chords are as they were.
 *  (`field`: the test game/input.ts makes of a key's target, its embed sink told by the label that file gives it.) */
export function watchCtrlTaps(win: Window, idle: () => boolean): () => boolean {
  const T = new TapTwice(); let twice = false;
  const field = (e: Event) => { const t = e.target as { tagName?: string; isContentEditable?: boolean } | null; return !!t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName ?? '') && (t as { getAttribute?(k: string): string | null }).getAttribute?.('aria-label') !== 'game input' || !!t.isContentEditable); };
  win.addEventListener('keydown', e => {
    if (e.key !== 'Control') { if (!e.repeat) T.other(); return; }   // (a held W repeating is not a new thing the hand did)
    if (e.repeat) return;
    if (field(e) || e.altKey || e.metaKey || e.shiftKey) { T.reset(); return; }
    T.down(e.timeStamp);
  }, { capture: true });
  win.addEventListener('keyup', e => { if (e.key !== 'Control') return; if (T.up(e.timeStamp) && !idle()) twice = true; }, { capture: true });
  win.addEventListener('mousedown', () => T.other(), { capture: true });
  win.addEventListener('wheel', () => T.other(), { capture: true, passive: true });
  win.addEventListener('mousemove', e => { if (e.ctrlKey) T.moved(Math.abs(e.movementX) + Math.abs(e.movementY)); }, { capture: true, passive: true });
  win.addEventListener('blur', () => T.reset());
  return () => { const v = twice; twice = false; return v; };
}

// ---- the view coming round behind him
/** how fast it comes round (1/s: the share of what is left taken each second) and how near counts as there (rad) */
export const BEHIND = { rate: 12, done: 1e-3 };
/** the yaw of a view that looks where a man with this `aimYaw` looks (the camera's yaw 0 looks toward −Z, a man's toward +Z) */
export function behindYaw(aimYaw: number): number { return aimYaw + Math.PI; }
/** one step of the view at `yaw` coming round to `goal` the short way: the turn to give the camera, and whether that lands it */
export function behindStep(yaw: number, goal: number, dt: number): { turn: number; done: boolean } {
  let d = goal - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) <= BEHIND.done) return { turn: d, done: true };
  return { turn: d * Math.min(1, dt * BEHIND.rate), done: false };
}

// ---- his aim carried round with that view
/** After the double tap the system's cursor is where it was on the screen, and he faces the cursor: left to that he turns AGAIN as the view comes round (a cursor
 *  that was not straight ahead of him no longer lies on what he faced). So the GAME's cursor — Input.mouseX / mouseY, what the aim ray, the reticle and the input
 *  record read — is carried: put, each tick, where the point he faced at the tap now stands on the screen (it walks with him: the same way out from his feet),
 *  until the hand takes the mouse up again. That is the mouse moved further than `letGoPx` from where it lay at the tap (less is a hand's tremor), a button, or
 *  any key that is not on `CARRY_KEYS` (it may read the cursor: an order, a throw, a thing to work). Then the cursor is the real one, to the pixel, before the
 *  tick reads it, and he turns to it as a moved mouse always meant. The system's own pointer is never moved: while the carry holds it is not where he aims.
 *  `minM`: a cursor nearer his feet than this faces nowhere; the point is taken this far out along his facing. */
export const CARRY = { letGoPx: 10, minM: 1.5 };
/** the keys the carry holds under: walking and its pace, his stance, his light, his goggles, a reload, and the camera key itself */
export const CARRY_KEYS: ReadonlySet<string> = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyL', 'KeyN', 'KeyR']);
export interface AimCarry {
  /** the way he faced at the tap (X, Z: unit), how far out the cursor's point lay and how high */
  dx: number; dz: number; dist: number; y: number;
  /** the real mouse (CSS px of the view): where it lay at the tap, where it is now, and where the game's cursor was last put (NaN = not yet) */
  fromX: number; fromY: number; realX: number; realY: number; putX: number; putY: number;
}
/** the carry a double tap begins: he faces `aimYaw` from `pos`, the cursor's point in the world is `aim`, the mouse is at (mx, my) */
export function aimCarry(aimYaw: number, pos: ArrayLike<number>, aim: ArrayLike<number>, mx: number, my: number): AimCarry {
  return { dx: Math.sin(aimYaw), dz: Math.cos(aimYaw), dist: Math.max(CARRY.minM, Math.hypot(aim[0] - pos[0], aim[2] - pos[2])), y: aim[1], fromX: mx, fromY: my, realX: mx, realY: my, putX: NaN, putY: NaN };
}
/** One tick of it, before the tick samples its input: the game's cursor stands at (mx, my) — where the carry put it, or where a moved mouse has since — `used` =
 *  a button or a key off CARRY_KEYS this tick, `project` = a world point to the view's pixels and whether it is in front of the eye. Returns the cursor to give
 *  the game and whether the carry still holds (false = that cursor is the real mouse, and the carry is over). */
export function carryStep(c: AimCarry, mx: number, my: number, used: boolean, pos: ArrayLike<number>, project: (x: number, y: number, z: number) => [number, number, boolean]): { x: number; y: number; held: boolean } {
  if (mx !== c.putX || my !== c.putY) { c.realX = mx; c.realY = my; }   // not where it was put: the hand moved it there
  if (!used && Math.hypot(c.realX - c.fromX, c.realY - c.fromY) <= CARRY.letGoPx) {
    const [sx, sy, front] = project(pos[0] + c.dx * c.dist, c.y, pos[2] + c.dz * c.dist);
    if (front) { c.putX = sx; c.putY = sy; return { x: sx, y: sy, held: true }; }
  }
  return { x: c.realX, y: c.realY, held: false };
}
