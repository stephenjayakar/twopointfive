// THE TUTORIAL'S BIG LINE STAYS CLEAR OF YOUR OWN MEN (ui/overlay.ts #railprompt; game/rails.ts lineMen, RAILS.lineClear). The line lies low in the middle
// of the screen, and with the view led up the screen (the aim on a man ahead), or in a short window, that is where the player and his partner stand: the
// plate lay over both. So the line has TWO places and no more — where it lies, and the bottom edge of the picture just under that. While a man of yours is
// under where it lies and the bottom edge is clear of them all, it is at the bottom edge (the radio's rows, which live there, go up over it: index.html
// `--raillog`); it comes home once nobody is within `hold` of where it lies, or when a man walks under the bottom edge. With both places taken it lies
// where it lies. It never follows a man and never goes up into the picture, where the step's mark and the aim are. With a ring up (ui/cmdring.ts) it is
// at home, and the ring's own step of it (`--railshift`) is the only one. Pure: boxes in, a step down out (px of the HUD layer). Picture only.
export interface Box { l: number; r: number; t: number; b: number }
export const RAILCLEAR = {
  /** px kept between the line and a man, and between the line and the screen's edge */
  gap: 8,
  /** a line at the bottom edge comes home only when no man is within this many px of where it lies */
  hold: 36,
};
/** `rest`: the line's box where it lies · `men`: your men's boxes · `h`: the layer's height · `low`: it is at the bottom edge now.
 *  Returns how far down it stands: 0 = where it lies, else the step to the bottom edge */
export function railClear(rest: Box, men: Box[], h: number, low: boolean): number {
  const G = RAILCLEAR, down = h - G.gap - rest.b; if (down <= 0 || !men.length) return 0;
  const free = (s: number, m: number) => { const l = rest.l - m, r = rest.r + m, t = rest.t + s - m, b = rest.b + s + m; for (const q of men) if (l < q.r && r > q.l && t < q.b && b > q.t) return false; return true; };
  if (free(0, low ? G.hold : G.gap)) return 0;        // nobody near where it lies
  return free(down, low ? 0 : G.gap) ? down : 0;      // the bottom edge while that clears them all (once there it stays until a man touches it); else home
}
