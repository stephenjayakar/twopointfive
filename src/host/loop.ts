// stepFrame — THE ONE FRAME ORDER, shared by src/main.ts (the browser) and the native entry: what happens between "a frame's dt is known" and
// "the host has drawn it", in the order main.ts's step() always ran it. Everything the browser loop reads off the DOM (canvas size, document.hidden, the menu, the tweak panel,
// the veil / body classes, perfrec's timings) is a field or a closure on LoopCtx; nothing here touches window / document, and the Game is imported as a TYPE only (src/game/'s
// 22-file import cycle: no top-level use of a game import in a host module — this file has none).
//
//   time += dt · frozen → dt 0 + input.endFrame() · afterFreeze (main: the attract still refresh) · cam.zoom / rotate off Ctrl-wheel / Ctrl-drag · hotkeys (main: debug view,
//   exposure, Tab, F9 / F10, P, arrows; on a frozen frame they are shown the keys pressed on it, and only they are) · [view has a size:] demo.update BEFORE game.update (the tour presses THIS frame's keys) · attract.update · game.update(dt, input, cam,
//   view) · the director's frame + postUpdate (main: the show class, the debrief card) · nvAmount / hitFlash → settings · audio listener + update · smoke.update · spectate
//   auto-yaw / ease-yaw + the pitch ease · cam.update(dt, look-at, aim lead) · caption + timeline · lights.update(dt, t) · render(cam, t, dt, present) · hud.update ·
//   bubbles.update (+ hudExpireBubbles inside it) · input.endFrame()
//
// THE FIXED STEP (FIXEDSTEP below; engine groundwork for two-player co-op, nothing networked): with the switch on and the host saying this frame is a live one (LoopCtx.fixedStep —
// main.ts: not a scripted __runFrames frame), the game is stepped in whole ticks of exactly 1 / hz whatever the display's rate: the frame's time goes into an accumulator
// (planTicks), every tick is demo.update → attract.update → game.update → lights.update with the SAME dt, and a frame draws whatever the last tick left. So the simulation computes
// the same numbers on a 60, a 120 and a 144 Hz display (tools/qa/fixedstep-check.ts), which a variable step never can. One-frame input edges (a key press, a click, the wheel)
// belong to exactly ONE tick: the first of the frame; a frame with no tick hands them to the next frame's first tick (the hotkeys have had their look and do not see them twice).
// What stays per drawn frame on the display's own dt: the camera, the mixer, the smoke solver, the render. BETWEEN TICKS (host/tween.ts TWEEN, its own switch; LoopCtx.tween): a
// frame that falls between two ticks is drawn between them — what moves (keyed boxes, the men, carried lights, where the camera is asked to look) at the blend of the tick
// before the last and the last, a constant part of a tick behind the game (none on a display at the tick rate, never more than one: tween.ts phase), and never read back
// by it: the blend hangs on the drawn objects from just before the host's render to just after. With that
// switch off there is no interpolation: off 60 Hz the men move at 60 a second under a camera that moves at the display's rate, and on a frame of two ticks or more (a display
// under the tick rate, a hitch) a flash that lives one tick and was made in the frame's first is aged out by its second and never drawn (with it on, tween.ts draws it once).
// The module's default is off = every statement below as it was; THE PAGE turns both on (host/profile.ts pageSwitches: ?fixedstep=0, ?tween=0).
import { BACKKEY } from '../game/backkey';
import type { Game } from '../game/game';
import type { Input } from '../game/input';
import type { FollowCamera } from '../game/camera';
import type { DirectorFrame } from '../game/director';
import type { Vec3 } from '../math/vec';
import type { RenderSettings } from '../settings';
import type { HudLike, BubblesLike, View, Chapters } from './hud';
import { TWEEN, type Tween } from './tween';

/** the showcase tour (game/demo.ts Demo) as the loop sees it */
export interface DemoLike { readonly active: boolean; caption: string; sub: string; fade: number; update(dt: number): Vec3 | null; chapters(): Chapters; goto(k: number): void; }
/** the start card's attract mode (game/attract.ts Attract) as the loop sees it */
export interface AttractLike { readonly active: boolean; update(dt: number): Vec3 | null; }
/** the audio engine as the loop drives it (main.ts wraps AudioEngine: listener + update, and the score's intensity in the same call) */
export interface LoopAudio { setListener(pos: Vec3, fwd: Vec3): void; update(dt: number, t: number): void; }
/** the host's per-frame surface: the settings the loop writes (nvAmount / hitFlash) and the light set it ages */
export interface LoopHost { readonly settings: Pick<RenderSettings, 'nvAmount' | 'hitFlash'>; readonly lights: { update(dt: number, t: number): void }; }

export interface LoopCtx {
  game: Game; input: Input; cam: FollowCamera; view: View;
  /** stepFrame's own: a frozen frame has gone by since the last tick (the next tick gets 'Paused' — game/backkey.ts) */
  thaw?: boolean;
  /** this frame may be fixed-stepped (main.ts: a live frame, not a scripted __runFrames one — a script names its own dt). Absent = never: the loop as it was */
  fixedStep?(): boolean;
  /** the fixed step's own state, made by stepFrame on first use: time owed to the next tick, the last tick's scripted look-ats, the edges a tickless frame left */
  fixed?: { acc: number; drift: number; demoPos: Vec3 | null; attractPos: Vec3 | null; owed: { pressed: string[]; clicked: number; wheel: number } | null };
  /** between two ticks of ONE drawn frame (the fixed step, a display under the tick rate or a hitch): what the host's draw does that the next tick reads — main.ts: the world's
   *  boxes packed into the grid its rays walk (engine.render does it once a frame; a second tick would otherwise trace the boxes of two ticks ago), and the HUD's one write
   *  to the game (an expired speech bubble nulled: a replay makes it after EVERY update) */
  betweenTicks?(): void;
  /** drawing between ticks (host/tween.ts; main.ts makes one over its engine): with TWEEN.on and the fixed step running this frame, the picture is the blend of the last two
   *  ticks. Absent = never: the fixed step draws the last tick */
  tween?: Tween;
  /** this frame's time as the DISPLAY counts it (main.ts: the rAF timestamps' difference, clamped and time-scaled as `dt` is) — what the fixed step plans its ticks from */
  vsyncDt?(): number | undefined;
  /** how much faster than the wall's the host runs the clock (main.ts __timeScale; absent = 1): above 1 the fixed step's cap on ticks a frame grows with it */
  timeScale?(): number;
  /** OUT: game ticks run this frame (1 on the variable step, 0 frozen; 0‥FIXEDSTEP.maxTicks on the fixed one) */
  ticks?: number;
  host: LoopHost;
  /** the host's whole render for this frame — main.ts: engine.render(cam, t, dt, present) wrapped for its timings and boot marks; native: tables + frame block + submit */
  render(cam: FollowCamera, t: number, dt: number, present: boolean): void;
  smoke: { update(dt: number): void } | null;
  audio: LoopAudio | null;
  demo: DemoLike | null;
  attract: AttractLike | null;
  hud: HudLike | null;
  bubbles: BubblesLike | null;
  /** the accumulated clock (main.ts's timeAcc): stepFrame adds dt to it first thing; render / lights / audio take it */
  time: number;
  /** OUT: what game.update took this frame in ms (main.ts hands it to the perf recorder) */
  updateMs: number;
  /** the world holds still this frame (main.ts: the pause / start card is up, no script is stepping, attract has not let the world go) */
  frozen(): boolean;
  /** present this frame's render (main.ts: a live frame, or the last of a scripted burst on a visible page) */
  present(): boolean;
  /** main.ts's DOM hotkeys / menus (frozen: only the recorder / journal keys are read) — right after the camera's Ctrl-wheel zoom / Ctrl-drag orbit, before the update */
  hotkeys?(frozen: boolean): void;
  /** right after the frozen decision (main.ts: the attract-stop still refresh) */
  afterFreeze?(frozen: boolean): void;
  /** right before each game tick, with that tick's dt (main.ts: the benchmark's hands-off player puts this tick's keys and cursor on the input — host/handsoff.ts) */
  beforeTick?(dt: number): void;
  /** right after game.update, with the level script's frame if a showcase has it (main.ts: the debrief card) */
  postUpdate?(dshow: DirectorFrame | null): void;
}

/** the caption a running show wants on the HUD: the tour's own, or the level script's frame (an empty one while it has none) — null = no show */
export function showCaption(ctx: LoopCtx): { caption: string; sub: string; fade: number } | null {
  const D = ctx.game.director;
  return ctx.demo?.active ? ctx.demo : D.showing ? (D.frame ?? { caption: '', sub: '', fade: 0 }) : null;
}

const LOW_PITCH = 24 * Math.PI / 180, HIGH_PITCH = 55 * Math.PI / 180;

/** the fixed step's knobs. `on`: the switch (off = the variable step, the loop as it was). `hz`: ticks a second. `snap` (s): a frame time within this of a whole number of
 *  refreshes of a common display is taken as exactly that (a 60 Hz display's 16.6‥16.8 ms frames are each ONE tick, never the 0-then-2 a raw accumulator beats out).
 *  `maxTicks`: the most ticks one frame may run (a hitch longer than that is dropped, not caught up). */
export const FIXEDSTEP = { on: false, hz: 60, snap: 0.0004, maxTicks: 4 };
const RATES = [50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
/** `dt` moved onto the nearest whole number (1‥3) of refreshes of a common display when it is within `tol` of one; otherwise as given */
export function snapDt(dt: number, tol = FIXEDSTEP.snap): number {
  let best = dt, err = tol;
  for (const r of RATES) for (let m = 1; m <= 3; m++) { const e = Math.abs(dt - m / r); if (e < err) { err = e; best = m / r; } }
  return best;
}
/** the pure plan: `acc` seconds owed + this frame's `dt` → whole ticks of 1 / hz to run now and what is owed after them.
 *  `drift` = the wall time the snap has put aside, leaking 1 % a frame: jitter round a true refresh sums to nothing and a display a hair off a listed rate (59.94 Hz) stays
 *  one tick a frame for good — but a display the list does not have (70 Hz snapping to 72, 85 to 82.5) builds half a tick of it inside half a second and gets it back
 *  as time, so the game's clock never runs steadily off the wall's. */
export function planTicks(acc: number, dt: number, K: { hz: number; snap: number; maxTicks: number } = FIXEDSTEP, drift = 0): { ticks: number; acc: number; drift: number } {
  const step = 1 / K.hz; dt = Math.max(0, dt);
  let use = snapDt(dt, K.snap);
  drift = drift * 0.99 + (dt - use);
  if (Math.abs(drift) > step / 2) { use += drift; drift = 0; }
  acc += use;
  let ticks = Math.floor(acc / step + 1e-6);
  acc -= ticks * step; if (Math.abs(acc) < step * 1e-6) acc = 0;
  if (ticks > K.maxTicks) { ticks = K.maxTicks; acc = 0; drift = 0; }
  return { ticks, acc, drift };
}

export function stepFrame(ctx: LoopCtx, dt: number): void {
  const { game, input, cam, view } = ctx;
  ctx.time += dt;
  const frozen = ctx.frozen();   // paused / start card: the world holds still, the picture stays live behind the card, hotkeys are off — unless attract mode has let the world go behind the start card
  const frozenKeys = frozen && input.pressed.size ? [...input.pressed] : null;   // (the hotkeys' look below: the recorder keys are read on a frozen frame too)
  if (frozen) { dt = 0; input.endFrame(); game.player.launchHeld = null; }   // (…and the launcher's button, if it was down as the card came up, is let go of unsent: the tick that follows the card would read 'the button came up' and send the round — player.ts)
  if (frozen) ctx.thaw = true; else if (ctx.thaw) { ctx.thaw = false; if (BACKKEY.tab) input.pressed.add('Paused'); }   // (game/backkey.ts: the first tick after the card is told the card was up — a held list or arc is let go unsent IN the tick, where a recording has it)
  ctx.afterFreeze?.(frozen);
  if (!frozen && input.wheelCtrl) cam.zoom(input.wheelCtrl);                 // Ctrl + wheel (or a pinch) zooms; the plain wheel is Sam's walking pace (player.ts)
  if (!frozen && input.orbitDX) cam.rotate(input.orbitDX * 0.006);          // hold Ctrl and move the mouse to orbit (Q / E are the wall hold and the holster now)
  if (frozenKeys) { for (const k of frozenKeys) input.pressed.add(k); ctx.hotkeys?.(true); input.pressed.clear(); }   // frozen: the frame's presses were put away first (afterFreeze's still takes a zero-length game step with the hands off) and are handed back for this one look — F9 / F10 start a recording from the pause card
  else ctx.hotkeys?.(frozen);

  if (view.clientWidth > 0 && view.clientHeight > 0) {
    const demo = ctx.demo, attract = ctx.attract, D = game.director;
    const fixed = !frozen && FIXEDSTEP.on && !!ctx.fixedStep?.();
    const tw = fixed && TWEEN.on ? ctx.tween : undefined;   // (drawing between ticks: only on a frame the fixed step runs)
    if (!tw && ctx.tween && !ctx.tween.stale) ctx.tween.rest();
    const shotOf = !tw ? null : (dp: Vec3 | null, ap: Vec3 | null): Vec3 | null => { if (demo?.active && dp) return dp; const lk = D.showing ? D.frame?.look : null; return lk ? lk : attract?.active && !D.showing ? ap : null; };   // (a scripted look-at as a tick leaves it: the tour's / the level script's pinned shot / attract mode's)
    let demoPos: Vec3 | null, attractPos: Vec3 | null;
    if (!fixed) {
      if (ctx.fixed) { ctx.fixed.acc = 0; ctx.fixed.drift = 0; ctx.fixed.owed = null; }
      ctx.ticks = frozen ? 0 : 1;
      demoPos = frozen || !demo ? null : demo.update(dt);   // before the game step: the tour's scripted beats press keys / move the puppet's aim for THIS frame's update
      const showingBefore = !frozen && D.showing;   // a level-script showcase (the breach) has the frame: its drill, beats and camera run INSIDE the game step (director.tick) — attract stays out of it
      attractPos = demoPos || showingBefore || frozen || !attract ? null : attract.update(dt);   // attract mode's look-at when no scripted programme has the frame (it keys yaw / distance itself, as the tour does)
      if (!frozen) ctx.beforeTick?.(dt);   // (outside the update's own timing: a hands-off player's thinking is not the game's)
      { const tU = performance.now(); if (!frozen) game.update(dt, input, cam, view); ctx.updateMs = performance.now() - tU; }
    } else {   // THE FIXED STEP: whole ticks of 1 / hz, each the old order's demo → attract → game with the same dt, the lights aged with the game (its men read them)
      const fx = ctx.fixed ??= { acc: 0, drift: 0, demoPos: null, attractPos: null, owed: null };
      const fast = ctx.timeScale?.() ?? 1;   // (a clock run faster than the wall's asks for that many more ticks of a slow frame: the cap is against a stall, not against the scale)
      const plan = planTicks(fx.acc, ctx.vsyncDt?.() ?? dt, fast > 1 ? { ...FIXEDSTEP, maxTicks: Math.ceil(FIXEDSTEP.maxTicks * fast) } : FIXEDSTEP, fx.drift); fx.acc = plan.acc; fx.drift = plan.drift; ctx.ticks = plan.ticks;   // (the display's own frame time where the host has it: steadier than a clock read in the callback)
      const tdt = 1 / FIXEDSTEP.hz;
      if (fx.owed) { for (const k of fx.owed.pressed) input.pressed.add(k); input.clicked |= fx.owed.clicked; input.wheel += fx.owed.wheel; fx.owed = null; }   // (after the hotkeys above: they saw these last frame)
      const tU = performance.now(); let bt = 0;   // (bt: the ms the hands-off player's thinking took, outside the update's own timing as on the free step)
      if (tw?.stale) tw.capture({ follow: game.followPos(), aim: game.aimPoint, shot: shotOf!(fx.demoPos, fx.attractPos) }, cam.pin);   // (the first tweened frame: what stands before its first tick is what that tick is blended FROM)
      for (let i = 0; i < plan.ticks; i++) {
        if (i) { input.endTick(); ctx.betweenTicks?.(); }   // a press, a click, the wheel: the first tick's alone; the host packs the world the last tick left (what a draw would have done)
        fx.demoPos = demo ? demo.update(tdt) : null;
        fx.attractPos = fx.demoPos || D.showing || !attract ? null : attract.update(tdt);
        if (ctx.beforeTick) { const b0 = performance.now(); ctx.beforeTick(tdt); bt += performance.now() - b0; }
        game.update(tdt, input, cam, view);
        ctx.host.lights.update(tdt, ctx.time);
        tw?.capture({ follow: game.followPos(), aim: game.aimPoint, shot: shotOf!(fx.demoPos, fx.attractPos) }, cam.pin);
      }
      ctx.updateMs = performance.now() - tU - bt;
      if (!plan.ticks && (input.pressed.size || input.clicked || input.wheel)) fx.owed = { pressed: [...input.pressed], clicked: input.clicked, wheel: input.wheel };
      demoPos = demo?.active ? fx.demoPos : null; attractPos = attract?.active && !demoPos && !D.showing ? fx.attractPos : null;   // (a frame with no tick keeps the last tick's look-at)
    }
    const dshow: DirectorFrame | null = frozen ? null : D.showing ? D.frame : null;
    ctx.postUpdate?.(dshow);   // (the end card out with the drive)
    const blend = tw ? tw.phase(ctx.fixed!.acc * FIXEDSTEP.hz) : 1;   // (1 = the last tick as it is; below it, that far from the tick before the last to it: tween.ts phase — the time owed the next tick, less the lag the display's rate asks)
    const shotNow: Vec3 | null = demoPos ?? (dshow ? dshow.look : null) ?? attractPos;   // a scripted look-at this frame: the tour's / the level script's pinned shot / attract mode's
    const shotPos = tw ? tw.at('shot', shotNow, blend) : shotNow;
    const followPos = tw ? tw.at('follow', game.followPos(), blend)! : game.followPos();   // (between ticks the camera follows the man where he is DRAWN)
    ctx.host.settings.nvAmount = game.player.nvAmount; ctx.host.settings.hitFlash = game.player.hitFlash;
    if (ctx.audio) {
      const lp = ((attract?.active ?? false) || !!dshow) && shotPos ? shotPos : game.player.char.pos;   // (a showcase parks Sam 30 m away outdoors exactly as attract does: listen from the shot, not from him — review 08-10 #3)
      ctx.audio.setListener([lp[0], lp[1] + 1.6, lp[2]], cam.forward); ctx.audio.update(dt, ctx.time);   // ← these two MUST stay statements: an 08-09 comment reshuffle swallowed them into the line above for three days (listener stuck at the lot corner, finished voices never released)
    }
    ctx.smoke?.update(dt);
    { const spect = !shotPos && game.spectate >= 0; if (spect) cam.autoYaw(dt, followPos, (a, b) => game.col.segmentBlocked(a, b)); cam.easeYaw(dt, spect);   // spectating a guard: come round to the side he can be seen from,
      const want = spect && cam.desiredDistance < 12 ? LOW_PITCH : HIGH_PITCH; if (!dshow || dshow.handedOver) cam.pitch += (want - cam.pitch) * Math.min(1, dt * 3); }   // and drop to a low three-quarter angle up close (from the usual height the ceiling panels sit between the eye and a man six metres off) — a showcase's shots key the pitch themselves (until it hands over: then the follow camera is the player's again)
    { const pin = cam.pin; if (tw && pin) cam.pin = tw.pinAt(pin, blend);   // (a framing a level script keys once a tick — a shot that tracks, swings, pushes in — is drawn between its last two)
      try { cam.update(dt, shotPos ?? followPos, shotPos || game.spectate >= 0 ? null : tw ? tw.at('aim', game.aimPoint, blend) : game.aimPoint); } finally { cam.pin = pin; } }
    if (ctx.hud) {
      const sh = showCaption(ctx); ctx.hud.setCaption(sh ? sh.caption : '', sh ? sh.sub : '');
      ctx.hud.setTimeline(demo?.active ? demo.chapters() : dshow ? D.chapters() : null, k => { if (demo?.active) demo.goto(k); });   // (the tour's stops are clickable; a level-script showcase's chapters are shown, not sought)
    }
    if (!fixed) ctx.host.lights.update(dt, ctx.time);
    cam.kickIn();   // a blast's camera kick (game/blastFeel.ts → FollowCamera.kick): in for the render and the HUD laid over it, out again before anything else reads the camera — a return with none
    try {
      if (tw) { try { tw.pose(blend); ctx.render(cam, ctx.time, dt, ctx.present()); } finally { tw.unpose(); } }   // (the blend hangs on the drawn things for the render alone: the HUD below, and every tick, read the game's own)
      else ctx.render(cam, ctx.time, dt, ctx.present());
      ctx.hud?.update(game, cam, view); ctx.bubbles?.update(game, cam, view);
    } finally { cam.kickOut(); }
  }
  input.endFrame();
}
