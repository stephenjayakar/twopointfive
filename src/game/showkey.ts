// THE P KEY — what it may do this frame. It used to start the night showcase from anywhere, a live run included: one stray key and the run was gone with no
// question, and since the showcase buttons came off the start card (ui/menu.ts SHOWCASE_BUTTONS) no card named the key at all (the missions goal's fault S3).
// The rule: over a running show P stops it, as it always did; it STARTS one only while the card offers the showcases AND the floor is one nobody has played
// yet (Sam on his spawn, nothing in the run's chronicle) — never over a run under way. A pure function so a check can hold it (tools/qa/show-key-check.ts).
export interface ShowKeyState {
  /** a show has the floor: the night or day showcase, the old tour, or a show's hand-over card still up */
  showing: boolean;
  /** the start card offers the showcases (ui/menu.ts SHOWCASE_BUTTONS) */
  buttons: boolean;
  /** nobody has played this floor yet: Sam on his spawn, no row in the chronicle */
  fresh: boolean;
}
export function showKey(s: ShowKeyState): 'stop' | 'start' | null {
  if (s.showing) return 'stop';
  return s.buttons && s.fresh ? 'start' : null;
}
