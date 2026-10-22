// A TUTORIAL MISSION'S CARD — a lesson step's `explain` (scene/scenarios.ts LessonStep; game/rails.ts card()).
//
// The maintainer, playing the squad mission, 10-22: "i think this needs more explanation for the systems. maybe even a modal that pauses the game and
// explains it. like 'You can shoot through windows, and it's often safer to clear a room from the outside rather than going in immediately' and then the
// player can try it out". One line low in the middle says what to press; it cannot say WHY, and some of the game's rules are not seen by pressing a key
// (a round goes through a door; a window is a way to clear a room). So a step may carry a card: a heading and a few sentences, up in the middle of the
// picture the moment the step comes up, with the world held still behind it — the page's hold (main.ts: one term of the loop's `frozen`, as under the pause
// card), so no tick runs and the step's own beat plays out only once the card is closed. Enter, Space or a click on its block closes it; then the step's
// line is the instruction, and the player tries it.
//   · THE PAGE'S, NOT THE GAME'S: the game only says what the step's card is (Rails.card(), the step's own data). Which cards have been read is kept HERE,
//     so no snapshot, checkpoint or replay holds it and no run moves by it. A headless run never makes one and is never held; a page a script steps
//     (`__runFrames`) is not held either — the card is drawn and goes with Enter or with its step.
//   · ONCE A PAGE: a card that was closed is not shown again on this page — not after a checkpoint put back, not when the mission is started again. A
//     reload shows them again.
//   · THE KEYS are asked of it by the game's Input, ahead of the game (main.ts, Input.keyVeto), so the Enter or Space that closes a card is nobody else's
//     press — and for the first ARM_MS a card is up they close nothing: the tap that finished the last step is not the one that puts this away unread. Esc is
//     the pause card's, as everywhere.
//   · KEYS in brackets are drawn as key caps, the same way the step's line is (ui/overlay.ts hands in its own `caps`).
// Plain DOM in the HUD's layer (#railcard, made here); its rules are in index.html beside the line's (#railprompt). It is the tutorial's frame's
// (`?rails=0`: no lesson, no card); `?cards=0` alone leaves the cards out of a tutorial mission (main.ts).
export interface RailCardWords { title?: string; text: string }
export interface RailCard {
  /** once a frame: the card of the step that is up (null: none) */
  update(card: RailCardWords | null, caps: (line: string) => string): void;
  /** a key went down (Input.keyVeto): true = it was the card's, and is no game key */
  key(e: { code: string; repeat?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; preventDefault?: () => void }): boolean;
  /** a card is up */
  readonly up: boolean;
  /** called as a card goes (main.ts: the keyboard's focus back to the game) */
  onClose: (() => void) | null;
}
/** milliseconds a card is up before a key closes it */
export const CARD_ARM_MS = 400;

export function railCard(root: { appendChild(e: unknown): unknown }, now: () => number = () => performance.now()): RailCard {
  const el = document.createElement('div'); el.id = 'railcard'; el.setAttribute?.('role', 'dialog'); root.appendChild(el);
  const seen = new Set<string>(), idOf = (c: RailCardWords) => `${c.title ?? ''}|${c.text}`;
  let key = '', shown = 0;
  const close = () => { if (!key) return; seen.add(key); key = ''; el.className = ''; try { api.onClose?.(); } catch (e) { console.error('the tutorial card: closing threw', e); } };
  el.addEventListener?.('mousedown', (e: Event) => { e.stopPropagation(); });   // (a click on the card is never a shot)
  el.addEventListener?.('click', (e: Event) => { if ((e.target as HTMLElement | null)?.closest?.('button')) close(); });
  const api: RailCard = {
    update(card, caps) {
      const k = card && !seen.has(idOf(card)) ? idOf(card) : '';   // (a card already read on this page is none)
      if (k === key) return;
      key = k;
      if (!card || !k) { el.className = ''; el.innerHTML = ''; return; }
      shown = now();
      // (a paragraph where the level's text breaks its line; each cap in brackets is a key)
      const body = card.text.split('\n').map(p => `<p>${caps(p)}</p>`).join('');
      el.innerHTML = `<div class="rc">${card.title ? `<h2>${caps(card.title)}</h2>` : ''}${body}<button type="button"><span>Got it</span><kbd>Enter</kbd></button></div>`;
      el.className = ''; void (el as HTMLElement).offsetWidth; el.className = 'on';
    },
    key(e) {
      if (!key || e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return false;
      e.preventDefault?.(); if (!e.repeat && now() - shown >= CARD_ARM_MS) close();
      return true;
    },
    get up() { return !!key; },
    onClose: null,
  };
  return api;
}
