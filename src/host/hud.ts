// HudLike — what the frame loop (src/host/loop.ts) asks of a HUD, host-neutral: src/ui/overlay.ts's Overlay + bubbles.ts's Bubbles are one
// implementation (the DOM), a native host's display-list overlay / bubbles another. Types only.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';

/** the view's size as the game and the HUD read it — an HTMLCanvasElement in the browser, a plain object off the drawable natively (clientWidth / clientHeight in CSS px /
 *  points, width / height the backing store in device px) */
export interface View { clientWidth: number; clientHeight: number; width: number; height: number; }

/** a showcase's chapter list for the timeline (game/demo.ts chapters(), game/director.ts chapters()) */
export interface Chapters { list: { title: string; dur: number }[]; i: number; frac: number; }

export interface HudLike {
  /** the showcase caption + sub-line (empty strings = none) */
  setCaption(text: string, sub: string): void;
  /** the showcase timeline (null = none); onPick(k) seeks chapter k */
  setTimeline(chapters: Chapters | null, onPick: (k: number) => void): void;
  /** everything drawn off the game once a frame (markers, meters, rows, tags…) */
  update(game: Game, cam: FollowCamera, view: View): void;
  /** the interactables' light dots (Tab ▸ toggles it) */
  showLightDots: boolean;
}

/** the speech bubbles (ui/bubbles.ts Bubbles): drawn after the HUD; ALSO the one HUD write to the game — an expired bubble nulled through game/journal.ts hudExpireBubbles */
export interface BubblesLike { update(game: Game, cam: FollowCamera, view: View): void; }
