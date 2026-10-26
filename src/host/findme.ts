// FINDING YOUR OWN MAN ON THE SCREEN, and how the camera answers the hand: fourteen settings to play with on twelve rows (Options > Game; ui/findme.ts draws the ring, hands
// the renderer the outline's frame and builds the rows). With all of them as they start the game is as it stood before it had them, on the page and on both
// of the harness's stands: the ring and the outline start off and the camera's three start as the camera was. (THE PAGE, since 2026-10-26, starts the
// outline ON at the maintainer's own numbers — FINDME_TUNED and findMeStarts, below; the module and the frozen stand are as this says.) The seven rows under `outline` are read only
// while it is on, and three of those are NOT how the outline was first built: `picture`, `mates` and `colour` (the rims by the picture, teammates rimmed,
// the rims in colour) are on from their
// starts for a machine that keeps the outline on. (One more is SHELVED, 2026-10-20: his shape
// through a wall. A kept line that still names it reads as if it did not: ui/findme.ts says why.)
//   pan      how far the view leans from the man toward the aim point, as a share of the follow camera's own lead (FollowCamera.aimLead as it was built):
//            1 = as it was · 0 = he is the middle of the screen wherever the mouse goes
//   ring     the gold ring at his feet (the one an open order menu draws: ui/planfloor.ts) on at all times
//   outline  a rim round him while the light meter says he is in the dark — his true silhouette, drawn by the renderer from the pixels that are his
//            (render/outline.ts). A kept line from the days it was a figure drawn over the picture (before 2026-10-20) turns this one on
//   width    how wide that rim is, as a share of the rim's own width (render/outline.ts OUTLINE, outlineRadius): 1 = that width · 0 = no rim at all.
//            Nothing reads it while `outline` is off
//   opacity  how strongly that rim is drawn where it is at its full: its ink's opacity, 0 = none … 1 = solid
//   lit      the light (Player.visibility, 0 dark … 1 lit) at and over which there is no rim
//   dark     the light at and under which the rim is at its full; between the two it fades by the light (outlineWant). Neither row crosses the other
//            (put: `lit` stops at `dark`, `dark` at `lit`), so the number a row shows is the number in force. The maintainer, with the rim on
//            his GPU: "it should probably fade in and out smoothly based on how lit up sam is -- sliders to calibrate that". These three start at the
//            numbers the rim was built with; what he settles on is to become their starts
//   picture  what the rim fades by. true = THE PICTURE, part by part: the rim beside each part of him is as strong as that part is dark AS DRAWN
//            (render/outline.ts reads the composite), so a lit shoulder has
//            none and the leg in shadow has one, and nothing swings with the meter's one number. false = the light meter's word for the whole man,
//            as the rim was first built. The maintainer, of that: "the current pulsing of the outline really ruins the lighting", and "is there
//            a way to make it so it naturally turns on for dark parts of the character and off for bright parts? that might make it feel less pulsey"
//   picLit, picDark   the same two ends for the picture: brightness ON THE SCREEN (0 black … 1 white) of a part of him at and over which it has no
//            rim, and at and under which the whole rim. Their own numbers, not `lit` and `dark` read in another unit: the two light rows show and
//            move the pair of whichever `picture` says, so a hand's tuning of one is not the other's. They start where the meter's do, a guess
//   mates    his teammates rimmed too, each by his own light: what their rim covers as a share of what his does on the same picture (render/outline.ts
//            outlineRadius `times`), 0 = no rim round them … 2 = twice his
//   colour   how much colour the rims have: 0 = the pale ink they were first drawn in … 1 = yellow for him, red and blue for the two pairs
//            (OUTLINE_INK). The maintainer: "can you also add outlines for teammates + have a separate slider for thickness multiplier relative
//            to the player? make the outline for the player yellow and for teammates red/blue and have a slider for saturation"
//   turn     which way the view turns under Ctrl + the mouse: 1 = as it was · -1 = the other way
//   behind   Ctrl tapped twice brings the view round to look where he was looking at the tap. NOT 'the camera behind him' in a third-person game's sense, and
//            it cannot be while the system cursor is the aim: he faces the cursor's point in the world, the cursor stays where it is on the screen, so as
//            the view turns he would turn with it. So his aim is CARRIED round with the view (AimCarry, below): he goes on facing what he faced, now at
//            the top of the screen, until the hand uses the mouse or a key that reads the cursor; then the cursor is the aim again
// pan, turn and behind change the seat's VIEW, and the view is the player's input (game/cmd.ts carries it as data, tick by tick): a recording replays the view
// it was made with whatever these say today, and no rule of the game reads this table. ring is the HUD's alone and outline the picture's: nobody's senses,
// no light meter and no digest can tell either on from off.
// KEPT PER MACHINE (localStorage `twopointsix.findme`), read as this module loads and again when the page says which starts are in force (findMeStarts);
// a harness has no store and gets the starts. Only the rows that
// are NOT at their starts are written (keep), so a start that is tuned later reaches every machine whose row stands at the old start — a row put back to
// its start by hand is one of those: these are rows on trial, and their starts are what the maintainer's own hand is settling. A line an older build kept
// whole is written again that way as the page reads it under its own starts. No imports, on purpose:
// the loop (host/loop.ts) and the engine replay's own view (replay/engineplay.ts, its Ctrl turn) read the table and nothing of the game or the page comes with it.

export interface FindMe { pan: number; ring: boolean; outline: boolean; width: number; opacity: number; picture: boolean; lit: number; dark: number; picLit: number; picDark: number; mates: number; colour: number; turn: 1 | -1; behind: boolean }
/** every row as it was BUILT: the module's own starts, and the frozen stand's (no rim, and the rim's rows at the numbers it was first drawn with) */
export const FINDME_BUILT: Readonly<FindMe> = { pan: 1, ring: false, outline: false, width: 1, opacity: 0.6, picture: true, lit: 0.3, dark: 0.12, picLit: 0.3, picDark: 0.12, mates: 1, colour: 0.6, turn: 1, behind: false };
/** THE OUTLINE'S ROWS AS THE MAINTAINER'S HAND LEFT THEM (2026-10-22, on his GPU: "overall these feel a lot better already" — the rim on, a quarter of
 *  its width, his teammates' at four fifths of his, half the colour), made the starts on 2026-10-26: he had watched a first-time player on a machine that
 *  had kept nothing and "i don't think the outlines showed up for him" — they were off, as every one of these rows starts — then "we should take the
 *  numbers i tuned ... and use those as the defaults". The rim's strength and its light rows he left at their starts, so they are not here. THE PAGE'S
 *  STARTS, not the module's: FINDTUNED and findMeStarts, below. */
export const FINDME_TUNED: Readonly<Partial<FindMe>> = { outline: true, width: 0.25, mates: 0.8, colour: 0.5 };
/** THE SWITCH: on = the starts in force are the tuned ones over the built. ON in the page (host/profile.ts pageSwitches; `?findtuned=0` = every row starts
 *  as built, no rim until Options > Game asks, as it was), OFF here and on the frozen stand (`TPS_FINDTUNED=1`). The page's alone, as host/savepic.ts's
 *  is (game/knobs.ts VISIT_OWN): a picture on this machine's screen — no run reads it, no digest can tell it, and no recording sets it. Whoever writes it
 *  calls findMeStarts() after: the table is not read off it frame by frame. */
export const FINDTUNED = { on: false };
const START: FindMe = { ...FINDME_BUILT };
/** the starts in force: as built until the switch says otherwise (findMeStarts). What Reset puts back, and what a kept line is written against */
export const FINDME_START: Readonly<FindMe> = START;
/** the width row's ends (shares of the rim's own width) */
export const FINDME_WIDTH = { min: 0, max: 1.5 };
/** the most a teammate's rim is against his */
export const FINDME_MATES = { max: 2 };
/** the rims' inks as displayed, before the tone map: the pale one they were first drawn in (the colour row at none), and at its full the player's yellow
 *  and the two pairs' red and blue (a teammate of a squad with no pairs: blue) */
export const OUTLINE_INK = { pale: [0.42, 0.5, 0.55], you: [0.95, 0.72, 0.12], red: [0.95, 0.22, 0.16], blue: [0.2, 0.45, 1] };
/** `out` = the ink of a man of that hue at the colour row's word */
export function outlineInk(out: number[], hue: 'you' | 'red' | 'blue'): void { const p = OUTLINE_INK.pale, c = OUTLINE_INK[hue], s = FINDME.colour; for (let i = 0; i < 3; i++) out[i] = p[i] + (c[i] - p[i]) * s; }
export const FINDME: FindMe = { ...FINDME_START };
const LS = 'twopointsix.findme';

/** what a kept line says, whatever it holds: a field that is missing or not of its kind is the start's */
export function findMeRead(text: string | null | undefined): FindMe {
  let v: Record<string, unknown> = {};
  try { const j = JSON.parse(text ?? 'null'); if (j && typeof j === 'object') v = j; } catch { /* not ours */ }
  const flag = (k: 'ring' | 'outline' | 'picture' | 'behind') => typeof v[k] === 'boolean' ? v[k] as boolean : FINDME_START[k];
  const num = (k: 'pan' | 'width' | 'opacity' | 'lit' | 'dark' | 'picLit' | 'picDark' | 'mates' | 'colour', lo = 0, hi = 1) => { const x = v[k]; return typeof x === 'number' && isFinite(x) ? Math.max(lo, Math.min(hi, x)) : FINDME_START[k]; };
  return { pan: num('pan'), ring: flag('ring'), outline: flag('outline'), width: num('width', FINDME_WIDTH.min, FINDME_WIDTH.max), opacity: num('opacity'), picture: flag('picture'), lit: num('lit'), dark: num('dark'), picLit: num('picLit'), picDark: num('picDark'),
    mates: num('mates', 0, FINDME_MATES.max), colour: num('colour'), turn: v.turn === -1 ? -1 : 1, behind: flag('behind') };   // (callers: a `dark` kept over its `lit` is read as `lit` by outlineWant)
}
/** THE OUTLINE'S STRENGTH from the light meter (Player.visibility, 0 dark … 1 lit): full at the table's `dark` and under, none at its `lit` and over, by
 *  the light between (a `dark` set over `lit` is read as `lit`: no fade, the rim there under it and gone over it); `nv` (the goggles' amount, 0 … 1) takes
 *  it out as they come on — they light him already. `ease` = how fast the drawn strength follows, per second; the box the rim is looked for in reaches
 *  `reachM` round him and `topM` up */
export const OUTLINE_LOOK = { ease: 6, reachM: 1.4, topM: 2.3 };
export function outlineWant(visibility: number, nv = 0): number {
  const none = FINDME.lit, full = Math.min(FINDME.dark, none), t = none > full ? (none - visibility) / (none - full) : visibility < none ? 1 : 0;   // (the two met: no fade, there under it)
  return Math.max(0, Math.min(1, t)) * Math.max(0, Math.min(1, 1 - nv));
}

/** the camera whose lead `pan` scales, and that lead as it was built (bindFindMe) */
let seat: { aimLead: number } | null = null, lead = 0;
/** the page hands over its follow camera once (main.ts): a kept pan under 1 is put on it; at 1 the camera is not written at all. After that the camera's lead is
 *  written only when the pan row itself moves (to that share of the lead as built: the debugger's own aim lead slider writes the same number, and the later hand wins) */
export function bindFindMe(cam: { aimLead: number }) { seat = cam; lead = cam.aimLead; if (FINDME.pan !== 1) cam.aimLead = lead * FINDME.pan; }
/** one setting changed by the player: on the table, on the camera if it is the pan, and kept */
export function setFindMe<K extends keyof FindMe>(k: K, v: FindMe[K]) { if (put(k, v)) keep(k); }
/** every row back to its start (Options' Reset): only what had been moved is written */
export function resetFindMe() { let any = false; for (const k of Object.keys(FINDME_START) as (keyof FindMe)[]) any = put(k, FINDME_START[k], true) || any; if (any) keep(); }
function put<K extends keyof FindMe>(k: K, v: FindMe[K], whole = false): boolean {
  if (!whole && k === 'lit') v = Math.max(v as number, FINDME.dark) as FindMe[K];   // (the two light rows stop at each other, in either pair; a reset writes both whole)
  if (!whole && k === 'dark') v = Math.min(v as number, FINDME.lit) as FindMe[K];
  if (!whole && k === 'picLit') v = Math.max(v as number, FINDME.picDark) as FindMe[K];
  if (!whole && k === 'picDark') v = Math.min(v as number, FINDME.picLit) as FindMe[K];
  if (FINDME[k] === v) return false; FINDME[k] = v; if (k === 'pan' && seat) seat.aimLead = lead * FINDME.pan; return true;
}
function movedRows(): string { const moved: Record<string, unknown> = {}; for (const k of Object.keys(START) as (keyof FindMe)[]) if (FINDME[k] !== START[k]) moved[k] = FINDME[k]; return JSON.stringify(moved); }
/** the store's line: a string, null = a store that has kept nothing, undefined = no store here (a harness) or one that may not be read (a frame whose
 *  storage is blocked throws at the name itself) */
function keptLine(): string | null | undefined { try { const st = globalThis.localStorage; return st ? st.getItem(LS) : undefined; } catch { return undefined; } }
/** the table kept. Under the tuned starts (the page's own) the line is the rows moved off them and nothing else. UNDER THE BUILT ONES ON A VISIT (`k`: the
 *  row a hand just moved under `?findtuned=0`, or on a stand that never raised the switch) the line as it lies is the tuned starts' own and only that row
 *  is written into it — rewritten whole against the built starts, a kept `outline: false` would be 'at its start', written away, and drawn again on the
 *  next plain visit. No `k` = the whole table (Reset; a tidy). */
function keep(k?: keyof FindMe) {
  try {
    const st = globalThis.localStorage; if (!st) return;
    if (FINDTUNED.on || k === undefined) { st.setItem(LS, movedRows()); return; }
    let was: Record<string, unknown> = {}; try { const j = JSON.parse(st.getItem(LS) ?? 'null'); if (j && typeof j === 'object' && !Array.isArray(j)) was = j; } catch { /* not ours: written over */ }
    if (FINDME[k] === START[k]) delete was[k]; else was[k] = FINDME[k];
    const out: Record<string, unknown> = {}; for (const key of Object.keys(START)) if (key in was) out[key] = was[key];   // (in the table's own order, as a whole line is)
    st.setItem(LS, JSON.stringify(out));
  } catch { /* no store */ }
}
/** THE STARTS IN FORCE FOLLOW THE SWITCH (FINDTUNED.on; host/profile.ts pageSwitches calls this once, before anything is drawn; a stand that raises the
 *  switch, after). A row standing at its old start moves to its new one; a row a hand has moved stays. Then, where there is a store, the kept line is
 *  read again over the new starts — a machine that has kept nothing gets the outline, one whose line names a row keeps that row, Off included — and, under
 *  the tuned starts only, a line that says more than the rows moved off them is written again as only those (an older build's whole line; a line that
 *  kept the tuned numbers by hand). Under `?findtuned=0` a line is left as it lies. Called again with nothing changed it does nothing on a harness. */
export function findMeStarts(): void {
  const T: Partial<FindMe> = FINDTUNED.on ? FINDME_TUNED : {}, S = START as unknown as Record<string, unknown>, F = FINDME as unknown as Record<string, unknown>;
  for (const k of Object.keys(FINDME_BUILT) as (keyof FindMe)[]) { const next = k in T ? T[k] : FINDME_BUILT[k]; if (S[k] !== next) { if (F[k] === S[k]) F[k] = next; S[k] = next; } }
  const was = keptLine(); if (was === undefined) return;
  Object.assign(FINDME, findMeRead(was)); if (FINDTUNED.on && was != null && was !== movedRows()) keep();
}
{ const was = keptLine(); if (was !== undefined) Object.assign(FINDME, findMeRead(was)); }   // (as the module loads: the line over the built starts, for a page that never calls the above — the replay viewer reads `turn`)

// ---- the camera running itself (host/autocam.ts): is the mode on
/** THE AUTO CAMERA'S MODE, the seat's own: on = the camera frames things itself (the camera's key tapped twice), off = it is the hand's (the key held with
 *  the mouse moved, or with a walk key). Kept per machine (localStorage `twopointsix.autocam`), read once as this module loads; a harness has no store and
 *  starts with it off. Nothing reads it while AUTOCAM.on is off. */
export const AUTOVIEW = { on: false };
const LS_AUTO = 'twopointsix.autocam';
export function setAutoView(on: boolean): void { if (AUTOVIEW.on === on) return; AUTOVIEW.on = on; try { if (on) globalThis.localStorage?.setItem(LS_AUTO, '1'); else globalThis.localStorage?.removeItem(LS_AUTO); } catch { /* no store */ } }
try { AUTOVIEW.on = globalThis.localStorage?.getItem(LS_AUTO) === '1'; } catch { /* no store */ }

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
 *  The taps are of the camera's key: Ctrl, or the key `key` names while it names one.
 *  (`field`: the test game/input.ts makes of a key's target, its embed sink told by the label that file gives it.) */
export function watchCtrlTaps(win: Window, idle: () => boolean, key: () => string | null = () => null): () => boolean {
  const T = new TapTwice(); let twice = false;
  const field = (e: Event) => { const t = e.target as { tagName?: string; isContentEditable?: boolean } | null; return !!t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName ?? '') && (t as { getAttribute?(k: string): string | null }).getAttribute?.('aria-label') !== 'game input' || !!t.isContentEditable); };
  const mine = (e: KeyboardEvent) => { const k = key(); return k ? e.code === k : e.key === 'Control'; };   // (`key`: the camera's key where it is not Ctrl — the page hands it host/keymap.ts camKey — as a code on the board; null = Ctrl)
  let held: string | null = null;   // (the key the tap under way went down as — 'Control' or a code: the camera's key may change hands while it is down, and the tap is let go as what it was)
  const lifts = (e: KeyboardEvent) => held !== null && (held === 'Control' ? e.key === 'Control' : e.code === held);
  win.addEventListener('keydown', e => {
    if (!mine(e)) { if (!e.repeat) T.other(); return; }   // (a held W repeating is not a new thing the hand did)
    if (e.repeat) return;
    if (field(e) || e.altKey || e.metaKey || (e.shiftKey && !key())) { T.reset(); return; }   // (Shift with Ctrl is a chord of the browser's; with the camera on a key of its own Shift is only his sprint, and a tap under it is a tap)
    held = key() ? e.code : 'Control'; T.down(e.timeStamp);
  }, { capture: true });
  win.addEventListener('keyup', e => { if (!lifts(e)) return; held = null; if (T.up(e.timeStamp) && !idle()) twice = true; }, { capture: true });
  win.addEventListener('mousedown', () => T.other(), { capture: true });
  win.addEventListener('wheel', () => T.other(), { capture: true, passive: true });
  win.addEventListener('mousemove', e => T.moved(Math.abs(e.movementX) + Math.abs(e.movementY)), { capture: true, passive: true });   // (it counts only with the key down: TapTwice.moved)
  win.addEventListener('blur', () => { held = null; T.reset(); });
  return () => { const v = twice; twice = false; return v; };
}

// ---- the view coming round behind him
/** how fast it comes round (1/s: the share of what is left taken each second) and how near counts as there (rad) */
export const BEHIND = { rate: 12, done: 1e-3 };
/** the yaw of a view that looks where a man with this `aimYaw` looks (the camera's yaw 0 looks toward −Z, a man's toward +Z) */
export function behindYaw(aimYaw: number): number { return aimYaw + Math.PI; }
/** one step of the view at `yaw` coming round to `goal` the short way: the turn to give the camera, and whether that lands it (`rate`: the auto camera's own
 *  turns come round slower — host/autocam.ts) */
export function behindStep(yaw: number, goal: number, dt: number, rate = BEHIND.rate): { turn: number; done: boolean } {
  let d = goal - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) <= BEHIND.done) return { turn: d, done: true };
  return { turn: d * Math.min(1, dt * rate), done: false };
}

// ---- his aim carried round with that view
/** After the double tap the system's cursor is where it was on the screen, and he faces the cursor: left to that he turns AGAIN as the view comes round (a cursor
 *  that was not straight ahead of him no longer lies on what he faced). So the GAME's cursor — Input.mouseX / mouseY, what the aim ray, the reticle and the input
 *  record read — is carried: put, each tick, where the point he faced at the tap now stands on the screen (it walks with him: the same way out from his feet),
 *  until the hand takes the mouse up again. That is the mouse moved further than `letGoPx` from where it lay at the tap (less is a hand's tremor), a button, or
 *  any key that is not on `CARRY_KEYS` (it may read the cursor: an order, a throw, a thing to work). Then the cursor is the real one, to the pixel, before the
 *  tick reads it, and he turns to it as a moved mouse always meant. The system's own pointer is never moved: while the carry holds it is not where he aims.
 *  `minM`: a cursor nearer his feet than this faces nowhere; the point is taken this far out along his facing. */
export const CARRY = { letGoPx: 10, minM: 1.5, /** carryStep's `aimOf`: how far off his line the cursor's ray may land (rad) before another point of the line is tried · the shares of the distance tried · and the heights, after the point's own */ offRad: 0.02, tries: [0.6, 1.6, 0.35, 2.5, 0.2, 1, 4], heights: [1.3, 0.5, 2], /** …and how little his point may have moved in the view (px) for last tick's answer to stand */ restPx: 0.25 };
/** the keys the carry holds under: walking and its pace, his stance, his light, his goggles, a reload, and the camera key itself */
export const CARRY_KEYS: ReadonlySet<string> = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyL', 'KeyN', 'KeyR']);
export interface AimCarry {
  /** the way he faced at the tap (X, Z: unit), how far out the cursor's point lay and how high */
  dx: number; dz: number; dist: number; y: number;
  /** the real mouse (CSS px of the view): where it lay at the tap, where it is now, and where the game's cursor was last put (NaN = not yet) */
  fromX: number; fromY: number; realX: number; realY: number; putX: number; putY: number;
  /** carryStep's `aimOf`: where his point stood in the view when the line was last searched (absent = never) */
  atX?: number; atY?: number;
}
/** the carry a double tap begins: he faces `aimYaw` from `pos`, the cursor's point in the world is `aim`, the mouse is at (mx, my) */
export function aimCarry(aimYaw: number, pos: ArrayLike<number>, aim: ArrayLike<number>, mx: number, my: number): AimCarry {
  return { dx: Math.sin(aimYaw), dz: Math.cos(aimYaw), dist: Math.max(CARRY.minM, Math.hypot(aim[0] - pos[0], aim[2] - pos[2])), y: aim[1], fromX: mx, fromY: my, realX: mx, realY: my, putX: NaN, putY: NaN };
}
/** One tick of it, before the tick samples its input: the game's cursor stands at (mx, my) — where the carry put it, or where a moved mouse has since — `used` =
 *  a button or a key off CARRY_KEYS this tick, `project` = a world point to the view's pixels and whether it is in front of the eye. Returns the cursor to give
 *  the game and whether the carry still holds (false = that cursor is the real mouse, and the carry is over). */
export function carryStep(c: AimCarry, mx: number, my: number, used: boolean, pos: ArrayLike<number>, project: (x: number, y: number, z: number) => [number, number, boolean],
  aimOf?: (sx: number, sy: number) => ArrayLike<number> | null): { x: number; y: number; held: boolean } {
  if (mx !== c.putX || my !== c.putY) { c.realX = mx; c.realY = my; }   // not where it was put: the hand moved it there
  if (!used && Math.hypot(c.realX - c.fromX, c.realY - c.fromY) <= CARRY.letGoPx) {
    let [sx, sy, front] = project(pos[0] + c.dx * c.dist, c.y, pos[2] + c.dz * c.dist);
    // (`aimOf`, the auto camera's — host/autocam.ts: a view that comes round a long way looks at that point past things it did not look past before, and the cursor's
    // ray stops on the first of them, off to one side of where he faced. Where it does, the cursor is put on another point of the same line from his feet whose ray
    // lands on that line: nearer, further, at chest height. Absent = the point as it is, as the double tap always carried it)
    if (front && aimOf) {
      if (c.atX !== undefined && Math.abs(sx - c.atX) < CARRY.restPx && Math.abs(sy - c.atY!) < CARRY.restPx && c.putX === c.putX) { sx = c.putX; sy = c.putY; }   // (the view and his feet at rest: the cursor where it was put, and no ray asked)
      else {
        c.atX = sx; c.atY = sy;
        const off = (x: number, y: number): number => { const p = aimOf(x, y); if (!p) return Math.PI; const ax = p[0] - pos[0], az = p[2] - pos[2]; return Math.abs(Math.atan2(ax * c.dz - az * c.dx, ax * c.dx + az * c.dz)); };
        let best = off(sx, sy);
        search: if (best > CARRY.offRad) for (const y of [c.y, ...CARRY.heights]) for (const k of CARRY.tries) {
          const d = Math.max(CARRY.minM, c.dist * k), [tx, ty, tf] = project(pos[0] + c.dx * d, y, pos[2] + c.dz * d); if (!tf) continue;
          const e = off(tx, ty); if (e < best) { best = e; sx = tx; sy = ty; } if (best <= CARRY.offRad) break search;
        }
      }
    }
    if (front) { c.putX = sx; c.putY = sy; return { x: sx, y: sy, held: true }; }
  }
  return { x: c.realX, y: c.realY, held: false };
}
