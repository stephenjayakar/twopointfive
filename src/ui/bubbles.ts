// Speech bubbles: what a guard is saying, drawn over his head while he is on screen (Game.say() decides bubble vs log line), and Sam's own line while he
// questions the man in his arm (player.ts askHeld → Player.bubble, the same shape, in his own tint: class 'sam').
// One absolutely-positioned element per speaker inside the overlay root; projection matches the state markers so the bubble sits
// just above the ! / ? glyph. Kept deliberately small and monochrome — a caption, not a comic balloon.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { hudExpireBubbles } from '../game/journal';
import type { BubblesLike } from '../host/hud';
import { HEADMARK_QA } from './headmark';
import { rectZoom, textZoom } from './textsize';

/** The tone of a man's bubble (its CSS class). A civilian by his own state; anybody else calm, the wary yellow ('sus') while he is searching or suspicious, the
 *  red of a fight while alert. The wary yellow is the stealth game's read of a man who may find you out (headmark.ts, WHOSE MARKS): a man of the player's own
 *  never wears it — left searching after a fight went cold, he speaks in the calm tone — and the red of a fight stays his, as the '!' over his head does.
 *  (HEADMARK_QA.ownWary, the head mark check's break path, puts his yellow back with his marks.) */
export function bubbleTone(g: Game['guards'][number]): 'calm' | 'sus' | 'alert' {
  if (g.civ) return g.civ.state === 'work' || g.civ.state === 'held' ? 'calm' : g.civ.state === 'startled' || g.civ.state === 'cower' ? 'sus' : 'alert';
  if (g.state === 'alert') return 'alert';
  return (g.state === 'suspicious' || g.state === 'search') && (HEADMARK_QA.ownWary || g.team !== 'operative') ? 'sus' : 'calm';
}

type Bubble = { text: string; t: number; dur: number; radio: boolean };

/** the HUD cards a bubble must never sit under (the maintainer's rule): the tour caption and the interaction panel while they are up ('on'), and the kit column,
 *  the meters, the objective line and the radio strip whenever they show anything (review U9.12) */
const BLOCKER_IDS_ON = ['caption', 'interact'], BLOCKER_IDS = ['equip', 'meters', 'objective', 'log'];
/** the blockers' rects are MEASURED only when what they show changes (or the view's size does), and at most every so often besides — not three forced layouts a
 *  frame on the heels of the overlay's writes (review U9.4) */
const BLOCKER_RECHECK_MS = 1000;

export class Bubbles implements BubblesLike {
  private els: HTMLElement[] = [];
  private samEl: HTMLElement | null = null;
  /** the cached blocker rects (canvas-relative), the key they were measured under, and when */
  private blockers: DOMRect[] = []; private blockKey = ''; private blockAt = -1e9;
  private blockEls: (HTMLElement | null)[] | null = null;
  constructor(private root: HTMLElement) {}

  private make(): HTMLElement { const el = document.createElement('div'); el.className = 'bubble'; el.style.display = 'none'; this.root.appendChild(el); return el; }

  /** the rects to dodge this frame: re-measured when a card's class / content or the view's size changed (a cheap string key off the DOM, no layout read), or every BLOCKER_RECHECK_MS */
  private blockerRects(canvas: HTMLCanvasElement, w: number, h: number): DOMRect[] {
    this.blockEls ??= [...BLOCKER_IDS_ON, ...BLOCKER_IDS].map(id => document.getElementById(id));
    let key = `${w}x${h}`;
    for (const e of this.blockEls) key += !e ? '|-' : e.id === 'meters' ? `|${e.className}` : `|${e.className}:${e.childElementCount}:${(e.textContent ?? '').length}`;   // (the meters' numbers move every frame but their card never changes size: its class is key enough)
    const now = performance.now();
    if (key === this.blockKey && now - this.blockAt < BLOCKER_RECHECK_MS) return this.blockers;
    this.blockKey = key; this.blockAt = now;
    const cr = canvas.getBoundingClientRect(), tz = rectZoom(); const out: DOMRect[] = [];
    this.blockEls.forEach((e, i) => {
      if (!e) return;
      if (i < BLOCKER_IDS_ON.length && !e.classList.contains('on')) return;   // (the caption / the interaction panel: only while up)
      const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push(new DOMRect((r.left - cr.left) / tz, (r.top - cr.top) / tz, r.width / tz, r.height / tz));
    });
    return this.blockers = out;
  }

  update(game: Game, cam: FollowCamera, canvas: HTMLCanvasElement) {
    const tz = textZoom(), w = canvas.clientWidth / tz, h = canvas.clientHeight / tz;   // (the layer's own pixels: ui/textsize.ts)
    // screen rects the bubbles must dodge this frame (canvas-relative): the tour caption while it is up, the interaction panel while it lists something, the kit column, the meters, the objective line, the radio strip
    const blockers = this.blockerRects(canvas, w, h);
    /** draw `el` as bubble `b` over `head` in the tone class `tone`; false = off screen this frame (the caller hides it) */
    const place = (el: HTMLElement, b: Bubble, head: Vec3, tone: string): boolean => {
      const age = game.time - b.t;
      let [x, y, vis] = cam.project([head[0], head[1] + 0.62, head[2]], w, h, 1.05);   // a hand above the state glyph (which rides at +0.45); gone once 5 % of the view past its edge
      if (!vis) return false;
      // never under the HUD: if the bubble's box (drawn up-and-centred from x,y) would land inside the tour's caption card, the top-left interaction panel, the kit
      // column, the meters, the objective line or the radio strip, hang it BELOW his head instead (flipped tail), and keep it inside the view's width either way
      const bw = Math.min(190, 12 + b.text.length * 5.6), bh = b.text.length > 34 ? 36 : 22;   // (a cheap estimate of the box; the real one is measured after layout, too late for this frame)
      let below = false;
      for (const r of blockers) { if (x + bw / 2 > r.left && x - bw / 2 < r.right && y > r.top && y - bh < r.bottom + 4) { below = true; break; } }
      if (below) { const [, yb] = cam.project([head[0], head[1] - 0.55, head[2]], w, h, Infinity); y = yb + bh + 10; }   // chest height, box hanging under it
      x = Math.max(bw / 2 + 6, Math.min(w - bw / 2 - 6, x));
      // ease in over 0.12 s (rise 6 px + fade), hold, fade over the last 0.35 s — a short line (Sam's beat, ~1 s) fades over its last quarter instead, so it stands legible for most of its life
      const aIn = Math.min(1, age / 0.12), aOut = Math.min(1, (b.dur - age) / Math.max(0.05, Math.min(0.35, 0.25 * b.dur))); const a = Math.max(0, Math.min(aIn, aOut));
      const text = (b.radio ? '·)) ' : '') + b.text;
      if (el.textContent !== text) el.textContent = text;
      const cls = 'bubble ' + tone + (b.radio ? ' radio' : '') + (below ? ' below' : '');
      if (el.className !== cls) el.className = cls;
      el.style.display = 'block'; el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y - (1 - aIn) * 6)}px`; el.style.opacity = a.toFixed(2);
      return true;
    };
    hudExpireBubbles(game);   // the HUD's one write to the game — an expired bubble nulled on its speaker — made through game/journal.ts so a replay of a recording makes it too (the per-element expiry lines below then never fire)
    const speakers = game.civilians.length ? [...game.guards, ...game.civilians] : game.guards;   // (the cleaner / the late worker talk too — civilians.ts: their record's bubble, in the calm tone until they are frightened)
    while (this.els.length < speakers.length) this.els.push(this.make());
    for (let i = 0; i < this.els.length; i++) {
      const el = this.els[i]; const g = speakers[i]; const b = g ? game.cues.bubbleOf(g) : null;   // (his line, or a cue's — cues.ts)
      if (!g || !b || (g.state === 'dead' && !g.wound) || (g.civ && g.civ.state === 'gone') || game.fogOfWar.hidden(g)) { el.style.display = 'none'; continue; }   // (fog of war: no bubble over a man nobody on the team sees — his line is still heard; never true while it is off)
      if (game.time - b.t > b.dur) { g.bubble = null; el.style.display = 'none'; continue; }
      if (!place(el, b, g.char.bones.head ?? g.char.pos, bubbleTone(g))) el.style.display = 'none';
    }
    { // Sam's line to the man in his arm, over HIS head (the pair stand half a metre apart, so his and the man's take turns on much the same spot — player.ts never has both up)
      const el = (this.samEl ??= this.make()); const pl = game.player; const b = pl.bubble;
      if (!b || pl.down) el.style.display = 'none';
      else if (game.time - b.t > b.dur) { pl.bubble = null; el.style.display = 'none'; }
      else if (!place(el, b, pl.char.bones.head ?? pl.char.pos, 'sam')) el.style.display = 'none';
    }
  }
}
