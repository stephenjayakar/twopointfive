// FINDING YOUR OWN MAN ON THE SCREEN, and how the camera answers the hand: six settings to play with (Options > Game; ui/findme.ts draws the three that are
// picture and builds the rows). Every one starts where the game stood before it had them, on the page and on both of the harness's stands: nothing here is a
// new default, and with all six as they start the build is the build as it was.
//   pan      how far the view leans from the man toward the aim point, as a share of the follow camera's own lead (FollowCamera.aimLead as it was built):
//            1 = as it was · 0 = he is the middle of the screen wherever the mouse goes
//   ring     the gold ring at his feet (the one an open order menu draws: ui/planfloor.ts) on at all times
//   outline  a faint rim round his figure once the light on him is low
//   shape    his figure drawn through whatever stands between the eye and him
//   turn     which way the view turns under Ctrl + the mouse: 1 = as it was · -1 = the other way
//   behind   Ctrl tapped twice brings the view round to look where he was looking at the tap. NOT 'the camera behind him' in a third-person game's sense, and
//            it cannot be while the system cursor is the aim: he faces the cursor's point in the world, the cursor stays where it is on the screen, so as
//            the view turns he turns with it. What he was facing ends at the top of the screen; with the cursor already ahead of him nothing else moves
// pan, turn and behind change the seat's VIEW, and the view is the player's input (game/cmd.ts carries it as data, tick by tick): a recording replays the view
// it was made with whatever these say today, and no rule of the game reads this table. ring, outline and shape are the HUD's alone: nobody's senses, no light
// meter and no digest can tell them on from off.
// KEPT PER MACHINE (localStorage `twopointsix.findme`), read once as this module loads; a harness has no store and gets the starts. No imports, on purpose:
// the loop (host/loop.ts) and the engine replay's own view (replay/engineplay.ts, its Ctrl turn) read the table and nothing of the game or the page comes with it.

export interface FindMe { pan: number; ring: boolean; outline: boolean; shape: boolean; turn: 1 | -1; behind: boolean }
export const FINDME_START: Readonly<FindMe> = { pan: 1, ring: false, outline: false, shape: false, turn: 1, behind: false };
export const FINDME: FindMe = { ...FINDME_START };
const LS = 'twopointsix.findme';

/** what a kept line says, whatever it holds: a field that is missing or not of its kind is the start's */
export function findMeRead(text: string | null | undefined): FindMe {
  let v: Record<string, unknown> = {};
  try { const j = JSON.parse(text ?? 'null'); if (j && typeof j === 'object') v = j; } catch { /* not ours */ }
  const flag = (k: 'ring' | 'outline' | 'shape' | 'behind') => typeof v[k] === 'boolean' ? v[k] as boolean : FINDME_START[k];
  const pan = typeof v.pan === 'number' && isFinite(v.pan) ? Math.max(0, Math.min(1, v.pan)) : FINDME_START.pan;
  return { pan, ring: flag('ring'), outline: flag('outline'), shape: flag('shape'), turn: v.turn === -1 ? -1 : 1, behind: flag('behind') };
}
/** the camera whose lead `pan` scales, and that lead as it was built (bindFindMe) */
let seat: { aimLead: number } | null = null, lead = 0;
/** the page hands over its follow camera once (main.ts): a kept pan under 1 is put on it; at 1 the camera is not written at all. After that the camera's lead is
 *  written only when the pan row itself moves (to that share of the lead as built: the debugger's own aim lead slider writes the same number, and the later hand wins) */
export function bindFindMe(cam: { aimLead: number }) { seat = cam; lead = cam.aimLead; if (FINDME.pan !== 1) cam.aimLead = lead * FINDME.pan; }
/** one setting changed by the player: on the table, on the camera if it is the pan, and kept */
export function setFindMe<K extends keyof FindMe>(k: K, v: FindMe[K]) { if (put(k, v)) keep(); }
/** all six back to their starts (Options' Reset): only what had been moved is written */
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
