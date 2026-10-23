// A MEMBER'S CARD (game/kit.ts is the table; this is its face): memberCard(host, i) fills `host` — the loadout screen mounts one in an element with
// data-member="i", 0 = you, 1 to 4 = the teammates — with member i's rows, each a label, the value between two arrows, and a line of what that value changes
// in the run; under them the three sets (as issued · quiet · loud) and the card in one line.
//
// POUCHES (kit.ts SLOTS, on unless ?noslots): the head says how many of the man's pouches are full, as pips and 'n / m', and for a teammate, while the table
// sets a squad limit (slots.json v7 sets none), the squad's ('squad 7 / 7': what the four carry between them); every row that spends them opens its line with what it fills now and its rate ('2 pouches · a pouch
// each · …'); an arrow whose step has no room is dimmed and, pressed (or A / D), changes nothing and puts the reason on the row in amber until the next
// press; a row of choices that walked past one with no room says which and why the same way; a set the squad has no room for is dimmed and, pressed, says
// why under the rows.
//
// WHAT THE CARD WEIGHS (game/kitload.ts, on unless ?nokitload; under the pouches rule only): two bars beside the pouches, mobility and concealment — each
// full for a man with nothing on him, shorter for every thing on his card, redrawn as a row is stepped. Shown, not told: no number; a notch on each bar is
// where his issued card stands (the man the game was tuned on), grey up to it, GREEN for what this card has gained on it and AMBER for what it has lost
// under it; and the highlighted row is outlined on the bar — what its thing takes (leave it behind and the bar grows to there), or, dashed, what one more
// of a thing he carries none of would take.
//
// THE MOUSE does everything: a click on an arrow steps the row, on a set presses it, anywhere on the card takes the keys to it.
// THE KEYS (no key is held, no digit is read): W / S or up / down move the highlighted row (the last 'row' is the sets), A / D or left / right change its
// value (on the sets: pick one), Enter or Space confirm (a row: its next value; the sets: press the picked one), Esc hands back to whoever mounted the card
// (opts.onBack). A host that routes keys itself calls card.key(e) — true = the card took it; W on the top row and S on the sets come back false, so a screen
// can walk on to whatever it has above or below (the loadout screen does: ui/loadout.ts, which also gives no onBack, so Esc is the screen's). A host that does not gets them anyway: the card's element takes focus and listens (inside #menu, where
// game/input.ts lets keys through).
//
// COPY AND PASTE (the maintainer, 10-15: "we should have copy and paste for loadouts"): two buttons at the end of the sets' line and two keys, C and V (the
// loadout screen hands them over from any of its rows, and takes Ctrl / Cmd with them as the same press). Copy keeps the card as it stands (KIT_CLIP, one
// for the page, until the next copy or the page's next load); Paste puts it on this man through game/kit.ts kitPaste — fitted to his own rows, his colours
// kept, refused with the reason under the rows where the squad has no room. SHOWN, NOT TOLD: Copy is lit on every card that wears the copied kit (a paste
// there would change nothing, so Paste is dim), the tiles a paste moved flash once, and the roster marks the men who wear it (ui/loadout.ts, clipWorn).
// The two keys go by the LETTER on the key (a mnemonic: C and V sit elsewhere on Dvorak), by its place only where the layout has no Latin letter there.
// `?nokitcopy` = no buttons, no keys: the card as it was. (On in the module: the headless probes' cards have the two buttons too.)
//
// The card owns its own CSS (one <style> on first use), so index.html needs nothing for it.
import { gearText } from '../game/gear';   // (a kept note names the kit: worded as issued where it is shown)
import { lightKeys } from '../game/slotsetup';   // (asked when the card's line is written: where your light is worked)
import { KIT_NOTE, KIT_PRESETS, SLOTS, SUITS, TRIMS, kitChanged, kitCost, kitGunCan, kitIssuedShown, kitName, kitRowCan, kitPeek, kitPaste, kitPastePeek, kitPreset, kitPresetOf, kitPresetWhy, kitRowCost, kitRows, kitShown, kitTeam, kitTry, kitWears, kitWorn, kitSlotDef, kitWords, rowGet, rowHas, rowUnder, squadCost, youGunsCan, type KitRow, type MemberKit } from '../game/kit';
import type { GunSlot } from '../game/gunslots';
import { GUN_STATS, gunStats } from './gunStats';
import { menuTheme } from './theme';
import { kitIcon } from './kitIcons';
import { kitNoise } from './kitNoise';
import { KITLOAD, loadOf, loadRef, loadShare, type KitLoad } from '../game/kitload';
import { denseStyle } from './kitDense';
type KitValue = KitRow['values'][number];

export interface MemberCardOpts {
  /** Esc on the card */
  onBack?: () => void;
  /** a row or a set changed member i's card (the table is already written and kept) */
  onChange?: (i: number) => void;
  /** the card took the keys (a click on it, focus()) */
  onFocus?: (i: number) => void;
  /** the highlight moved to another row of member i's card (its field; null: the sets) — a move, not a change of value */
  onSelect?: (i: number, field: string | null) => void;
  /** member i's card was copied (KIT_CLIP holds it; no card changed) */
  onCopy?: (i: number) => void;
  /** who the head says he is, in place of kitName(i) (the loadout screen: the callsign and pair the size shown stages him with) */
  name?: { title: string; sub: string };
  /** does this row's thing do NOTHING on the mission the card is shown for (the loadout screen: the optical wand and the sticky cameras where no fog of war
   *  runs)? A tile that CARRIES one then says so where its value is — 'no use here', a count kept in front — and is marked `idle` for the host's look,
   *  where it read 'carried' behind a dimmed tile that looked broken. Asked at every draw (refresh() after the answer changes); absent = never */
  idle?: (field: string) => boolean;
  /** how many of this row's thing THE MISSION the card is shown for hands this man, over his card (the loadout screen: a quiet mission under the fog hands
   *  you its sticky cameras and, with them, an optical wand — game/quietfog.ts, kit.ts kitPlayer; a yes / no row: 1)? Where that is more than the card
   *  carries the tile shows what he will HAVE: the thing drawn lit, the mission's count and `LENT_WORD` where its value is ('2 · mission’s'; with some of
   *  his own under it, his count first: '1 · mission’s 2'), the line of how it is used, and is marked `lent`. His card, his pouches and the arrows are untouched. Asked at every draw (refresh() after the answer changes); absent or 0 = nothing */
  lent?: (field: string) => number;
  /** THE DENSE CARD (ui/kitDense.ts, which has its look and says what it is; a card that is a tree only): the guns side by side, each a tile that wears
   *  what rides on it as chips and opens a pop-up of its own — the guns it could be, its fittings and its rounds —, the rest small tiles in one line, the
   *  colours and the sets in a strip under them. The rows, their values and every rule are the card's own. Absent = the card as it was */
  dense?: boolean;
  /** the dense card: how far down the window a pop-up of the card's may reach, in the window's pixels (the top of the host's foot: its buttons lie
   *  under the card and stay where they are when the page scrolls). Absent or 0 = the window's own foot */
  floor?: () => number;
}
/** what an idle tile says in its value's place, and its tooltip (MemberCardOpts.idle) */
export const IDLE_WORD = 'no use here', IDLE_WHY = 'There\'s no fog of war on this mission, so every room is already shown and it has nothing to look into. It still takes up its pouch.';
/** what a lent tile says in its value's place, and its tooltip (MemberCardOpts.lent), and the switch (`?nokitlent` = off: every tile reads the card alone,
 *  as it did — UI only: nothing in the game reads it) */
export const LENT_WORD = 'mission\u2019s', LENT_WHY = 'issued for this mission, so it takes none of your pouches';
export const KIT_LENT = { on: true };
try { if (new URLSearchParams(location.search).has('nokitlent')) KIT_LENT.on = false; } catch { /* no page (the harness) */ }
/** THE SUPPRESSOR SHOWS ON THE CARD (the maintainer on a quiet mission's Team & kit screen, 10-17: 'quiet missions should have different gear screen stuff';
 *  the quiet set's tile read 'Glock 19 only' beside a bare pistol, though the gun he deploys with wears its can): a gun that is suppressed (game/kit.ts
 *  kitGunCan — both of yours, a teammate's by his Suppressor row) is drawn with the can on its muzzle, on the tile and on the roster's card, and your pistol
 *  carried alone reads 'Suppressed Glock 19' (youGunsCan). `?nokitcan` = the bare drawings and the words as they were — UI only: nothing in the game reads it. */
export const KIT_CAN = { on: true };
try { if (new URLSearchParams(location.search).has('nokitcan')) KIT_CAN.on = false; } catch { /* no page (the harness) */ }
/** member i's gun is drawn with its can: the one question the tile, the roster's gun and the roster's chip all ask */
export const gunCanOf = (i: number, m: MemberKit): boolean => KIT_CAN.on && kitGunCan(i, m);
/** THE COPIED CARD (one for the page; UI only: nothing in the game reads it) and its switch (`?nokitcopy` = off: no buttons, no keys) */
export const KIT_CLIP: { on: boolean; card: MemberKit | null } = { on: true, card: null };
try { if (new URLSearchParams(location.search).has('nokitcopy')) KIT_CLIP.on = false; } catch { /* no page (the harness) */ }
/** member i wears the copied kit: a paste onto him would change nothing (the roster's mark, the card's lit Copy) */
export function clipWorn(i: number): boolean { return KIT_CLIP.on && !!KIT_CLIP.card && kitWears(i, KIT_CLIP.card); }
/** a key press as copy or paste (null: neither, or the switch is off): the letter the key types, else — no Latin letter on it — the key's place */
export function clipKey(e: { key: string; code?: string }): 'copy' | 'paste' | null {
  if (!KIT_CLIP.on) return null;
  const k = /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : e.code === 'KeyC' || e.key === 'KeyC' ? 'c' : e.code === 'KeyV' || e.key === 'KeyV' ? 'v' : '';
  return k === 'c' ? 'copy' : k === 'v' ? 'paste' : null;
}
/** every card on the page redraws its Copy and Paste when one of them copies (the copied card is the page's, not a card's) */
const liveCards = new Set<{ root: HTMLElement; draw: () => void }>();
/** the bits of a KeyboardEvent the card reads (a probe hands a plain object) */
export interface KeyLike { key: string; code?: string; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }
export interface MemberCard {
  el: HTMLElement; member: number;
  /** take the keys (the highlight shows) / give them up */
  focus(): void; blur(): void;
  /** the highlighted row: 0 … rows − 1, or rows = the sets */
  at(): number;
  /** put the highlight on a row (clamped; a host walking in from above goes to 0, from below to the sets) */
  go(k: number): void;
  /** a key press: true = the card's (taken), false = not the card's (or an edge: W at the top, S at the bottom) */
  key(e: KeyLike): boolean;
  /** redraw from the table (after it was changed elsewhere) */
  refresh(): void;
  /** keep this man's card as the copied one · put the copied card on him (false: nothing copied, refused, or the switch off) */
  copy(): void; paste(): boolean;
  /** the dense card: the gun whose pop-up is open (null: none, or not a dense card) · open one's, or shut the open one (null) */
  pop(): GunSlot | null; open(slot: GunSlot | null): void;
  destroy(): void;
}

const STYLE_ID = 'kc-style';
const CSS = `
.kc { box-sizing: border-box; width: 250px; padding: 12px 12px 10px; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--m-text); background: rgba(var(--m-panel-rgb),0.9); border: 1px solid rgba(var(--m-edge),0.28); border-radius: 4px; outline: none; user-select: none; }
.kc.focus { border-color: var(--m-accent-hi); box-shadow: 0 0 0 1px rgba(var(--m-accent-rgb),0.25); }
.kc .kc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.kc .kc-fig { position: relative; flex: 0 0 34px; height: 46px; }
.kc .kc-fig i { position: absolute; display: block; }
.kc .kc-fig .h { left: 11px; top: 0; width: 12px; height: 12px; border-radius: 50%; }
.kc .kc-fig .b { left: 6px; top: 13px; width: 22px; height: 20px; border-radius: 4px 4px 2px 2px; }
.kc .kc-fig .l { top: 33px; width: 9px; height: 13px; border-radius: 0 0 2px 2px; } .kc .kc-fig .l1 { left: 7px; } .kc .kc-fig .l2 { left: 18px; }
.kc .kc-fig .a { top: 14px; width: 5px; height: 17px; border-radius: 2px; } .kc .kc-fig .a1 { left: 0; } .kc .kc-fig .a2 { left: 29px; }
.kc .kc-fig .j { width: 5px; height: 5px; border-radius: 50%; } .kc .kc-fig .j1 { left: 0; top: 13px; } .kc .kc-fig .j2 { left: 29px; top: 13px; } .kc .kc-fig .j3 { left: 9px; top: 32px; } .kc .kc-fig .j4 { left: 20px; top: 32px; }
.kc .kc-fig i.issued { background: rgba(var(--m-edge),0.16); box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.55); }
.kc .kc-fig .j.issued { background: var(--m-base); }
.kc .kc-title { font: 600 14px/1.2 ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif; letter-spacing: 0.04em; color: var(--m-bright); }
.kc .kc-title.changed::after { content: ' •'; color: #f3d79a; }
.kc .kc-sub { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-dim); margin-top: 2px; }
.kc .kc-pouch { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 6px; margin-top: 5px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-soft); }
.kc .kc-pouch > * { white-space: nowrap; }
.kc .kc-pouch.off { display: none; }
.kc .kc-pips { display: flex; gap: 2px; flex: 0 0 100%; }
.kc .kc-pips i { display: block; width: 7px; height: 9px; border-radius: 1px; box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.6); }
.kc .kc-pips i.on { background: var(--m-accent-hi); box-shadow: none; }
.kc .kc-pips i.big { width: 19px; margin-left: 4px; }
.kc .kc-pouch b { font-weight: 600; color: var(--m-bright); letter-spacing: 0.04em; }
.kc .kc-load { display: flex; flex-direction: column; gap: 3px; flex: 0 0 100%; order: 10; margin-top: 2px; }
.kc .kc-load.off { display: none; }
.kc .kc-bar { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.kc .kc-bar-t { position: relative; display: block; flex: 0 0 96px; height: 7px; box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.6); }
.kc .kc-bar-t i { position: absolute; top: 0; bottom: 0; display: block; }
.kc .kc-bar-t .fill { left: 0; background: rgba(var(--m-edge),0.9); }
.kc .kc-bar-t .gain { background: #8fc98a; }
.kc .kc-bar-t .gain.loss { background: #f0b76a; }
.kc .kc-bar-t .part { top: -1px; bottom: -1px; box-shadow: inset 0 0 0 1px var(--m-bright); }
.kc .kc-bar-t .part.more { box-shadow: none; border-left: 1px dashed var(--m-bright); border-bottom: 1px dashed var(--m-bright); border-top: 1px dashed var(--m-bright); }
.kc .kc-bar-t .ref { top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--m-bright); }
.kc .kc-row { padding: 4px 6px 5px; margin: 0 -6px; border-left: 2px solid transparent; border-radius: 2px; cursor: default; }
.kc.focus .kc-row.sel, .kc.focus .kc-sets.sel { border-left-color: var(--m-accent-hi); background: rgba(var(--m-hover-rgb),0.45); }
.kc .kc-ico { display: none; }
.kc .kc-line { display: flex; align-items: center; gap: 4px; }
.kc .kc-label { flex: 1 1 auto; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-soft); white-space: nowrap; }
.kc .kc-val { flex: 0 1 auto; min-width: 74px; text-align: center; color: var(--m-bright); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kc .kc-val.num { min-width: 44px; }
.kc .kc-row.changed .kc-val { color: #f3d79a; }
.kc .kc-step { flex: 0 0 auto; font: inherit; width: 20px; height: 20px; padding: 0; line-height: 18px; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.7); border: 1px solid rgba(var(--m-edge),0.35); border-radius: 3px; cursor: pointer; }
.kc .kc-step:hover { background: rgba(var(--m-hover-rgb),0.9); border-color: var(--m-accent-hi); }
.kc .kc-step.off { opacity: 0.32; }
.kc .kc-step.off:hover { background: rgba(var(--m-btn-rgb),0.7); border-color: rgba(var(--m-edge),0.35); }
.kc .kc-note { font-size: 10.5px; color: var(--m-dim); margin-top: 1px; min-height: 14px; }
.kc .kc-cost { color: var(--m-btn-text); }
.kc .kc-row.refused .kc-note, .kc .kc-words.refused { color: #f0b76a; }
.kc .kc-squad { color: var(--m-soft); }
.kc .kc-squad.full { color: #f3d79a; }
.kc .kc-set.off { opacity: 0.45; }
.kc .kc-sets { display: flex; gap: 4px; margin: 8px -6px 0; padding: 5px 6px; border-left: 2px solid transparent; border-radius: 2px; }
.kc .kc-set { flex: 1 1 0; font: inherit; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 2px; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.6); border: 1px solid rgba(var(--m-edge),0.3); border-radius: 2px; cursor: pointer; white-space: nowrap; }
.kc .kc-set:hover { border-color: var(--m-accent-hi); }
.kc .kc-set.on { color: var(--m-on-accent); background: var(--m-accent-hi); border-color: var(--m-accent-hi); }
.kc.focus .kc-sets.sel .kc-set.pick { box-shadow: 0 0 0 1px var(--m-bright); }
.kc .kc-sets { flex-wrap: wrap; }
.kc .kc-clip { flex: 0 0 auto; font: inherit; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 8px; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.6); border: 1px solid rgba(var(--m-edge),0.3); border-radius: 2px; cursor: pointer; white-space: nowrap; }
.kc .kc-clip[data-clip="copy"] { margin-left: auto; }
.kc .kc-clip:hover { border-color: var(--m-accent-hi); }
.kc .kc-clip.on { color: var(--m-on-accent); background: var(--m-accent-hi); border-color: var(--m-accent-hi); }
.kc .kc-clip.off { opacity: 0.45; }
@keyframes kc-pasted { from { box-shadow: inset 0 0 0 99px rgba(var(--m-accent-rgb),0.34); } to { box-shadow: inset 0 0 0 99px rgba(var(--m-accent-rgb),0); } }
@keyframes kc-pasted2 { from { box-shadow: inset 0 0 0 99px rgba(var(--m-accent-rgb),0.34); } to { box-shadow: inset 0 0 0 99px rgba(var(--m-accent-rgb),0); } }
.kc .kc-row.pasted { animation: kc-pasted 0.8s ease-out; }
.kc .kc-row.pasted.pasted2 { animation-name: kc-pasted2; }   /* (the same flash under a second name: a paste straight after a paste plays again) */
@media (prefers-reduced-motion: reduce) { .kc .kc-row.pasted { animation: none; } }
/* THE CARD AS A TREE (game/kittree.ts KITTREE): each gun's tile with what rides on it under it, and what the gun is good at drawn on the tile (ui/gunStats.ts) */
.kc .kc-kids { margin: 0 0 3px 7px; padding-left: 5px; border-left: 1px solid rgba(var(--m-edge),0.3); }
.kc .kc-stats { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.kc .kc-stats.off { display: none; }
.kc .kc-stats .kc-stat { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-soft); }
.kc .kc-stats .kc-bar-t { flex: 0 0 112px; height: 6px; }
.kc.kc-tree .kc-row.none .kc-val { color: var(--m-dim); }
.kc.kc-tree .kc-row.fixed .kc-step { visibility: hidden !important; }
.kc.kc-tree .kc-row.fixed .kc-val { color: var(--m-soft); }
.kc .kc-words { margin-top: 7px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 10.5px; color: var(--m-soft); min-height: 28px; }
`;
function style() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  menuTheme(); const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}
const el = (tag: string, cls: string, text = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

/** a mannequin tint (linear albedo) as a CSS colour, about as it reads under a lamp */
export function tintCss(t: readonly number[]): string { const c = (x: number) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, x * 1.6)), 1 / 2.2)); return `rgb(${c(t[0])},${c(t[1])},${c(t[2])})`; }
/** A priced row's cost in the card's words. A counted row with some carried says what they fill and the rate ('2 pouches · a pouch each'); with none
 *  carried, and for a thing a man has one of or none (the wall charge, the shotgun, the wand), the rate alone ('a pouch each', 'the wand takes
 *  2 pouches') — 'no pouch · a pouch each' read as free and priced at once, and '2 pouches · the wall charge takes 2 pouches' said it twice. */
const costWords = (c: { pouches: number; rate: string }): string => c.pouches > 0 && /each$/.test(c.rate) ? `${c.pouches === 1 ? '1 pouch' : `${c.pouches} pouches`} · ${c.rate}` : c.rate;
/** the figure's two colours: a chosen tint, or null = as issued (drawn as an outline: the scenario's own colours are the scenario's — the four's red and blue
 *  pairs, the pair's — and not this card's to guess) */
function lookOf(m: MemberKit): { suit: string | null; trim: string | null } {
  return { suit: m.suit === 'issued' ? null : tintCss(SUITS[m.suit].tint), trim: m.trim === 'issued' ? null : tintCss(TRIMS[m.trim].tint) };
}

const LOAD_TIP = { mob: 'mobility (the notch shows his issued kit)', con: 'concealment (the notch shows his issued kit)' };
const POUCH_TIP = 'his breaching tools and throwables go in these. A grenade-sized thing takes one pouch and a big thing takes two';
const POUCH_TIP_BIG = 'each pouch holds one grenade-sized thing, and the big slot holds one big thing like a shotgun, a hammer or a wall charge';
const UP = new Set(['KeyW', 'ArrowUp', 'w', 'W']), DOWN = new Set(['KeyS', 'ArrowDown', 's', 'S']), LEFT = new Set(['KeyA', 'ArrowLeft', 'a', 'A']), RIGHT = new Set(['KeyD', 'ArrowRight', 'd', 'D']);
const OK = new Set(['Enter', 'NumpadEnter', 'Space', ' ', 'Spacebar']), BACK = new Set(['Escape', 'Esc']);
/** by the key's PLACE on the board where the event says it (game/input.ts reads e.code: W A S D are where they are on any layout), else by its name */
const is = (set: Set<string>, e: KeyLike) => set.has(e.code || e.key);
/** events a card has already been handed (a host that calls key(e) AND lets the event reach the card's own listener: taken once) */
const seen = new WeakSet<object>();

/** Fill `host` with member i's card. */
export function memberCard(host: HTMLElement, i: number, opts: MemberCardOpts = {}): MemberCard {
  style();
  const rows = kitRows(i), def = () => kitShown(i);   // (the card as he wears it: kit.ts KITDEAL shares a named kit out over a team of three or four)
  /** the card as a tree (game/kittree.ts KITTREE: its rows say what hangs under which gun): the guns' tiles are boxes with their things under them, a row
   *  the card has not got as it stands is not drawn and the keys step over it, and the sets are the one reset (the squad's row has the named kits) */
  const tree = rows.some(r => r.under !== undefined), presets = tree ? KIT_PRESETS.filter(p => p.id === 'issued').map(p => ({ ...p, label: 'Reset', line: 'go back to the issued kit' })) : KIT_PRESETS;   // (not 'As issued' a second time: that is a kit of the squad's row)
  const guns: Partial<Record<GunSlot, { kids: HTMLElement; pop?: HTMLElement; why?: HTMLElement }>> = {};
  /** a row's thing against the mission the card is shown for: `idle` — carried, and of no use on it: the tile says so itself —; `handed` / `lent` — the
   *  mission hands him more of it than his card carries: the tile shows what he will have (never on an idle tile, and only a count or a yes / no) */
  const given = (r: KitRow, v: KitValue, none: boolean) => { const idle = !none && !!opts.idle?.(r.field);
    const handed = KIT_LENT.on && !idle && (typeof v === 'number' || typeof v === 'boolean') ? Math.max(0, Math.floor(opts.lent?.(r.field) ?? 0)) : 0; return { idle, handed, lent: handed > (typeof v === 'number' ? v : v ? 1 : 0) }; };
  /** the dense card (MemberCardOpts.dense): the gun whose pop-up is open, and the three boxes its tiles are laid in — the guns, the kit, the colours */
  const dense = tree && !!opts.dense; if (dense) denseStyle();
  let popAt: GunSlot | null = null;
  const LOOK = new Set(['suit', 'trim']), isGun = (r: KitRow) => r.field === 'primary' || r.field === 'secondary';
  /** the rows the card has as it stands, in the order they are drawn: a gun, then what hangs under it */
  const seq = (m: MemberKit): number[] => { if (!tree) return rows.map((_r, k) => k); const out: number[] = [];
    rows.forEach((r, k) => { if (r.under !== undefined || !rowHas(r, m)) return; out.push(k); if (r.field === 'primary' || r.field === 'secondary') rows.forEach((c, j) => { if (c.under !== undefined && rowHas(c, m) && rowUnder(c, m) === r.field) out.push(j); }); });
    // (the dense card: a gun's things are in its pop-up — shut, the keys walk the tiles as they lie, the kit before the colours; open, that gun and what rides on it)
    if (dense) return popAt ? out.filter(k => rows[k].field === popAt || (rows[k].under !== undefined && rowUnder(rows[k], m) === popAt)) : [...out.filter(k => rows[k].under === undefined && !LOOK.has(rows[k].field)), ...out.filter(k => LOOK.has(rows[k].field))];
    return out; };
  const root = el('div', dense ? 'kc kc-tree kc-dense' : tree ? 'kc kc-tree' : 'kc'); root.setAttribute('data-member', String(i)); root.tabIndex = 0;
  // the head: a little figure in his two colours, who he is
  const head = el('div', 'kc-head'), fig = el('div', 'kc-fig'), suitBits: HTMLElement[] = [], trimBits: HTMLElement[] = [];
  for (const c of ['a a1', 'a a2', 'l l1', 'l l2', 'b', 'h']) { const b = el('i', c); suitBits.push(b); fig.appendChild(b); }
  for (const c of ['j j1', 'j j2', 'j j3', 'j j4']) { const b = el('i', c); trimBits.push(b); fig.appendChild(b); }
  const who = el('div', 'kc-who'), title = el('div', 'kc-title', (opts.name ?? kitName(i)).title), sub = el('div', 'kc-sub', (opts.name ?? kitName(i)).sub);
  // … and his pouches: a pip each, the full ones lit, 'n / m' (nothing while the rule is off)
  const pouch = el('div', 'kc-pouch'), pips = el('span', 'kc-pips'), pouchN = el('b', ''), squadN = el('span', 'kc-squad');
  squadN.title = 'what your teammates carry between them. One more on his card means one fewer on someone else\'s';
  pouch.append(el('span', '', 'Pouches'), pouchN, squadN, pips); pouch.title = POUCH_TIP;
  // … and what the card weighs (game/kitload.ts): a bar each for mobility and concealment — its fill up to the issued card's notch in grey, what the card has
  // gained on the notch in green or lost under it in amber, and the highlighted row outlined: what it takes (drop it and the bar grows to there), or, on a
  // row that carries none, dashed, what one more would take
  const load = el('span', 'kc-load'), bars = (['mob', 'con'] as const).map(k => {
    const bar = el('span', 'kc-bar'), track = el('span', 'kc-bar-t'), fill = el('i', 'fill'), gain = el('i', 'gain'), part = el('i', 'part'), ref = el('i', 'ref');
    bar.setAttribute('data-load', k); bar.title = LOAD_TIP[k]; track.append(fill, gain, part, ref); bar.append(el('span', 'kc-bar-l', k === 'mob' ? 'Mobility' : 'Concealment'), track);
    load.appendChild(bar); return { k, bar, fill, gain, part, ref };
  });
  pouch.appendChild(load);
  who.append(title, sub, pouch); head.append(fig, who); root.appendChild(head);
  const gunsBox = dense ? el('div', 'kc-guns') : null, gearBox = dense ? el('div', 'kc-gear') : null, lookBox = dense ? el('div', 'kc-look') : null;
  if (gunsBox && gearBox && lookBox) root.append(gunsBox, gearBox, lookBox);
  // the rows
  let cur = 0, pick = Math.max(0, presets.findIndex(p => p.id === kitPresetOf(i))), focused = false, hung = '';
  /** the row whose last step was refused, and why (shown on it until the next press anywhere on the card) */
  let said: { k: number; why: string } | null = null;
  /** the rows the last paste moved: they flash once (cleared by the card's next change), under one of two names by turns so that the next paste plays again */
  let flash: ReadonlySet<string> = new Set(), flashes = 0;
  const changed = (moved?: ReadonlySet<string>) => { said = null; flash = moved ?? new Set(); if (moved) flashes++; draw(); opts.onChange?.(i); };
  const step = (k: number, dir: 1 | -1) => { cur = k; const r = kitTry(i, rows[k].field, dir); if (!r.ok) { said = { k, why: r.why }; draw(); } else { changed(); if (r.passed) { said = { k, why: `passed ${r.passed}` }; draw(); } } };
  /** the dense card's pop-up: one of a gun's choices pressed — that gun on the card at once (kit.ts kitPaste: fitted and refused as a paste is), not stepped to */
  const choose = (k: number, v: KitValue) => { cur = k; const r = rows[k], m = def(); if (rowGet(r, m) === v) { said = null; draw(); return; }
    const c = { ...m } as MemberKit; if (r.set) r.set(c, v); else (c as unknown as Record<string, unknown>)[r.field] = v;
    const p = kitPaste(i, c); if (!p.ok) { said = { k, why: `${r.word(v, c)}: ${p.why}` }; draw(); } else changed(); };
  const shut = (e: Event) => { const t = e.target as Node | null; if (popAt && !(t && guns[popAt]?.pop?.contains(t)) && !(t && rowEls.find(x => x.slot === popAt)?.row.contains(t))) setPop(null); };   // (a press anywhere but on the open pop-up or its own tile)
  const setPop = (slot: GunSlot | null) => { if (!dense || slot === popAt) return; const D = root.ownerDocument as Document | undefined;
    if (slot) { const k = rows.findIndex(r => r.field === slot); if (k < 0 || !rowHas(rows[k], def())) return; cur = k; }
    else if (cur < rows.length && rows[cur].under !== undefined) cur = Math.max(0, rows.findIndex(r => r.field === popAt));   // (the highlight comes out with it: onto its gun)
    popAt = slot; said = null; const W = D?.defaultView;
    if (slot) { D?.addEventListener?.('pointerdown', shut, true); D?.addEventListener?.('scroll', refit, true); W?.addEventListener?.('resize', refit); }
    else { D?.removeEventListener?.('pointerdown', shut, true); D?.removeEventListener?.('scroll', refit, true); W?.removeEventListener?.('resize', refit); } draw(); };   // (the page scrolled or the window sized under an open pop-up: fitted over the foot again)
  const refit = () => { const p = popAt && guns[popAt]?.pop; if (p) fit(p); };
  /** a set pressed: taken, or refused with the reason under the rows (the squad has no room for it as the other cards stand) */
  const press = (k: number) => { cur = rows.length; pick = k; const r = kitPreset(i, presets[k].id); if (r.ok) changed(); else { said = { k: rows.length, why: `${presets[k].label}: ${r.why}` }; draw(); } };
  const rowEls = rows.map((r, k) => {
    const row = el('div', 'kc-row'); row.setAttribute('data-field', r.field);
    const line = el('div', 'kc-line'), label = el('span', 'kc-label', r.label), prev = el('button', 'kc-step', '‹'), val = el('span', 'kc-val'), next = el('button', 'kc-step', '›'), note = el('div', 'kc-note');
    if (typeof r.values[0] === 'number') val.classList.add('num');   // (a count is a digit or a short word: its long label and both arrows then fit the card)
    prev.title = 'previous'; next.title = 'next'; prev.tabIndex = -1; next.tabIndex = -1;
    // (a press on an arrow is the arrow's alone: the row under it must not take the same click, or it would wipe what the arrow just said)
    prev.onclick = (ev) => { ev?.stopPropagation?.(); step(k, -1); }; next.onclick = (ev) => { ev?.stopPropagation?.(); step(k, 1); };
    row.onclick = () => { if (dense && isGun(r)) { setPop(popAt === r.field ? null : r.field as GunSlot); return; }   // (the dense card: a gun's tile opens its pop-up, and shuts it)
      if (cur !== k || said) { cur = k; said = null; draw(); } };
    const ico = el('div', 'kc-ico');   // (the thing's silhouette — ui/kitIcons.ts; shown where the card is laid out as tiles: the loadout)
    line.append(label, prev, val, next); row.append(ico, line, note);
    // (the tree: a gun's tile stands in a box with its things under it — hung there at each draw, since the light goes with the gun in his hands — and wears
    // four bars of what the gun is good at; any other row is the card's own child, as every row of the flat card is)
    const slot = tree && (r.field === 'primary' || r.field === 'secondary') ? r.field as GunSlot : null;
    let stats: { box: HTMLElement; bars: { id: typeof GUN_STATS[number]['id']; bar: HTMLElement; fill: HTMLElement; gain: HTMLElement; ref: HTMLElement }[] } | null = null;
    let chips: HTMLElement | null = null, picks: { v: KitValue; b: HTMLElement; ico: HTMLElement; name: HTMLElement; bars: HTMLElement; fills: HTMLElement[]; drawn: string }[] | null = null;
    if (slot) { const box = el('div', 'kc-gun'), kids = el('div', 'kc-kids'), sb = el('div', 'kc-stats'); box.setAttribute('data-gun', slot);
      stats = { box: sb, bars: GUN_STATS.map(S => { const bar = el('span', 'kc-stat'), track = el('span', 'kc-bar-t'), fill = el('i', 'fill'), gain = el('i', 'gain'), ref = el('i', 'ref'); bar.setAttribute('data-stat', S.id); bar.title = S.tip; track.append(fill, gain, ref); bar.append(el('span', 'kc-bar-l', S.label), track); sb.appendChild(bar); return { id: S.id, bar, fill, gain, ref }; }) };
      row.appendChild(sb);
      if (dense) {   // the tile wears its things as chips; they and the guns it could be are in a pop-up under the two tiles
        chips = el('div', 'kc-chips'); row.appendChild(chips);
        const pop = el('div', 'kc-pop'), list = el('div', 'kc-picks'), key = el('span', 'kc-pick-key'); pop.setAttribute('data-pop', slot);
        for (const S of GUN_STATS) key.appendChild(el('span', '', S.label)); list.appendChild(key);
        picks = r.values.map(v => { const b = el('button', 'kc-pick'), pico = el('span', 'kc-pick-ico'), name = el('span', 'kc-pick-name'), pb = el('span', 'kc-pick-bars'); b.setAttribute('data-pick', String(v)); b.tabIndex = -1;
          const fills = GUN_STATS.map(S => { const t = el('span', 'kc-bar-t'), f = el('i', 'fill'); t.setAttribute('data-stat', S.id); t.title = S.tip; t.appendChild(f); pb.appendChild(t); return f; });
          b.append(pico, name, pb); b.onclick = (ev) => { ev?.stopPropagation?.(); choose(k, v); }; list.appendChild(b); return { v, b, ico: pico, name, bars: pb, fills, drawn: '' }; });
        const why = el('div', 'kc-pop-note'); pop.append(list, kids, why); box.append(row, pop); gunsBox!.appendChild(box); guns[slot] = { kids, pop, why };
      } else { box.append(row, kids); root.appendChild(box); guns[slot] = { kids }; } }
    else if (r.under === undefined) (dense ? (LOOK.has(r.field) ? lookBox! : gearBox!) : root).appendChild(row);
    return { row, val, note, prev, next, ico, drawn: '', slot, stats, chips, picks, chipsDrawn: '', picksDrawn: '' };
  });
  // the sets
  const sets = el('div', 'kc-sets');
  const setEls = presets.map((p, k) => {
    const b = el('button', 'kc-set', p.label); b.setAttribute('data-set', p.id); b.title = p.line; b.tabIndex = -1;
    b.onclick = () => press(k);
    sets.appendChild(b); return b;
  });
  // copy and paste: two more buttons at the end of the sets' line (not sets: the keys' pick never lands on them — theirs are C and V)
  const clipEls = KIT_CLIP.on ? (['copy', 'paste'] as const).map(id => { const b = el('button', 'kc-clip', id === 'copy' ? 'Copy' : 'Paste'); b.setAttribute('data-clip', id); b.tabIndex = -1; sets.appendChild(b); return b; }) : null;
  const copy = () => { if (!KIT_CLIP.on) return; KIT_CLIP.card = { ...def() }; said = null;
    for (const c of liveCards) if ((c.root as { isConnected?: boolean }).isConnected === false) liveCards.delete(c); else c.draw();   // (every card on the page: who wears it now)
    opts.onCopy?.(i); };
  const paste = (): boolean => { if (!KIT_CLIP.on || !KIT_CLIP.card) return false;
    const r = kitPaste(i, KIT_CLIP.card); if (!r.ok) { said = { k: rows.length, why: `Paste: ${r.why}` }; draw(); return false; }
    if (r.changed.length) changed(new Set(r.changed)); return true; };
  if (clipEls) { clipEls[0].onclick = copy; clipEls[1].onclick = () => { paste(); }; }
  (lookBox ?? root).appendChild(sets);
  const words = el('div', 'kc-words'); root.appendChild(words);

  let told = 0;   // (the row onSelect was last told of)
  function draw() {
    const m = def(), look = lookOf(m), base = kitPresetOf(i);
    if (tree) { const S = seq(m); if (cur < rows.length && !S.includes(cur)) cur = [...S].reverse().find(k => k < cur) ?? S[0] ?? 0; }   // (a highlight left on a row the card no longer has goes to the row before it — before anybody is told of it)
    if (cur !== told) { told = cur; opts.onSelect?.(i, rows[cur]?.field ?? null); }
    if (tree) {   // what hangs under which gun as the card stands
      const now = rows.map((r, k) => (r.under !== undefined ? `${k}>${rowHas(r, m) ? rowUnder(r, m) : ''}` : '')).join();
      if (now !== hung) { hung = now; for (const slot of ['primary', 'secondary'] as const) { const kids = guns[slot]?.kids; if (!kids) continue; let any = false;
        rows.forEach((r, k) => { if (r.under === undefined) return; const here = rowHas(r, m) && rowUnder(r, m) === slot; if (here) { kids.appendChild(rowEls[k].row); any = true; } });
        kids.style.display = any ? '' : 'none'; } }
    }
    for (const b of suitBits) { b.style.background = look.suit ?? ''; b.classList.toggle('issued', !look.suit); }
    for (const b of trimBits) { b.style.background = look.trim ?? ''; b.classList.toggle('issued', !look.trim); }
    title.classList.toggle('changed', kitChanged(i));
    pouch.classList.toggle('off', !SLOTS.on);
    if (SLOTS.on) {
      const c = kitCost(i); pips.textContent = '';
      for (let n = 0; n < Math.max(c.total, c.used); n++) pips.appendChild(el('i', n < c.used ? 'on' : ''));
      if (c.big) for (let n = 0; n < Math.max(c.big.total, c.big.used); n++) pips.appendChild(el('i', n < c.big.used ? 'big on' : 'big'));   // (kit.ts BIGSLOT: his one big slot, a wide pip after the pouches — lit when something rides in it)
      pouch.title = c.big ? POUCH_TIP_BIG : POUCH_TIP;
      pouchN.textContent = `${c.used} / ${c.total}`;
      const sq = i > 0 && i <= kitTeam() ? squadCost() : null; squadN.textContent = sq ? `squad ${sq.used} / ${sq.total}` : '';
      load.classList.toggle('off', !KITLOAD.on);
      if (KITLOAD.on) { const L = loadOf(i, m), R = loadRef(i), row = cur < rows.length ? rows[cur] : null, S: KitLoad | null = row ? loadShare(i, m, row.field) : null, pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10}%`;
        // (a row that carries none: what ONE MORE would take — the step the right arrow would make, weighed on a copy of the card; nothing where that step has no room)
        let M: KitLoad | null = null; if (row && !S) { const p = kitPeek(i, row.field, 1); if (!p.why) { const c = { ...m } as MemberKit; if (row.set) row.set(c, p.value); else (c as unknown as Record<string, unknown>)[row.field] = p.value; const up = loadOf(i, c);   /* (a row with a setter of its own writes other fields: the Primary row's long gun is `weapon`) */ if (up.mob < L.mob || up.con < L.con) M = { mob: L.mob - up.mob, con: L.con - up.con }; } }
        for (const b of bars) { const v = L[b.k], r = R[b.k], lo = Math.min(v, r), s = S?.[b.k] ?? 0, more = M?.[b.k] ?? 0;
          b.fill.style.width = pct(lo); b.gain.style.left = pct(lo); b.gain.style.width = pct(Math.abs(v - r)); b.gain.classList.toggle('loss', v < r);
          b.part.classList.toggle('more', !s && more > 0); b.part.style.left = pct(s ? v : v - more); b.part.style.width = pct(s ? Math.min(s, 1 - v) : more); b.part.style.display = s || more ? '' : 'none';
          b.ref.style.left = pct(r); b.bar.setAttribute('data-score', v.toFixed(3)); b.bar.setAttribute('data-share', s.toFixed(3)); b.bar.setAttribute('data-more', more.toFixed(3)); } }
      squadN.classList.toggle('full', !!sq && sq.used >= sq.total && c.used < c.total);   // (room in his own pouches and none in the squad's: the squad's count is why his arrows are dimmed, so it is the one lit)
    }
    const issuedShown = kitIssuedShown(i);   // (one deal a refresh, not one a row)
    rows.forEach((r, k) => {
      const v = rowGet(r, m), e = rowEls[k], cost = kitRowCost(i, r, m), no = said && said.k === k ? said.why : '';
      if (tree) { const has = rowHas(r, m); e.row.style.display = has ? '' : 'none'; if (!has) { if (r.under !== undefined) e.row.remove?.(); return; }   // (not on the card as it stands: not drawn, not hung anywhere)
        e.row.classList.toggle('none', v === false || v === 0); e.row.classList.toggle('fixed', !!r.fixed?.(m));   // (a gun made with its suppressor, or one none fits: the tile has no arrows)
        if (e.slot && e.stats) { const d = kitSlotDef(i, m, e.slot), d0 = kitSlotDef(i, issuedShown, e.slot); e.stats.box.classList.toggle('off', !d);   // (what this gun is good at, beside the gun he is issued: the notch)
          if (d) { const now = gunStats(d), was = d0 ? gunStats(d0) : now, pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10}%`;
            for (const b of e.stats.bars) { const a = now[b.id], z = was[b.id], lo = Math.min(a, z); b.fill.style.width = pct(lo); b.gain.style.left = pct(lo); b.gain.style.width = pct(Math.abs(a - z)); b.gain.classList.toggle('loss', a < z); b.ref.style.left = pct(z); b.bar.setAttribute('data-score', a.toFixed(3)); } } } }
      const gunRow = r.field === 'weapon' || r.field === 'primary' || r.field === 'secondary', can = gunRow && KIT_CAN.on && kitRowCan(i, m, r.field);   // (the gun on this row wears a suppressor: drawn with it, and your pistol alone named for it)
      const I = kitIcon(r.field, v, can), { idle, handed, lent } = given(r, v, I.none);
      e.val.textContent = idle ? (typeof v === 'number' ? `${v} · ${IDLE_WORD}` : IDLE_WORD) : lent ? (typeof v === 'number' ? (v ? `${v} · ${LENT_WORD} ${handed}` : `${handed} · ${LENT_WORD}`) : LENT_WORD) : (can && i === 0 ? youGunsCan(v) : null) ?? r.word(v, m); e.note.textContent = '';   // (his own count stays in front where he carries some: an arrow pressed always moves what the tile reads)
      e.row.classList.toggle('idle', idle); e.row.classList.toggle('lent', lent); e.row.classList.toggle('zero', !lent && (typeof v === 'number' ? v === 0 : I.none && (r.field === 'big' || r.field === 'wand' || r.field === 'primary'))); e.row.setAttribute('data-noise', String(kitNoise(r.field, m, i)));   // (none of the thing carried — a count of none, an empty big slot, no wand; never a fitting switched off —; how loud it is in use — ui/kitNoise.ts: both are drawn on a quiet mission's gear screen only)
      e.row.title = idle ? IDLE_WHY : lent ? LENT_WHY : '';
      { const key = `${r.field}:${gunRow || r.field === 'big' ? v : ''}${can ? ':can' : ''}`; if (e.drawn !== key) { e.drawn = key; e.ico.innerHTML = I.svg; } e.ico.classList.toggle('none', I.none && !lent); }
      if (no) e.note.textContent = no;
      else { if (cost && !(lent && !v)) e.note.append(el('span', 'kc-cost', costWords(cost)), ' · '); e.note.append(r.note(lent ? { ...m, [r.field]: typeof v === 'number' ? handed : true } : m)); }   // (lent: the row's line for a man who HAS it — how it is used, not 'none in your pouches' — and no pouch rate on a tile the mission alone fills: what it hands takes none)
      e.row.classList.toggle('sel', cur === k); e.row.classList.toggle('changed', v !== rowGet(r, issuedShown)); e.row.classList.toggle('refused', !!no); e.row.classList.toggle('pasted', flash.has(r.field)); e.row.classList.toggle('pasted2', flash.has(r.field) && flashes % 2 === 0);
      // an arrow whose step would not fit his pouches is dimmed and says why (it can still be pressed: the reason goes on the row)
      for (const [b, dir, word] of [[e.prev, -1, 'previous'], [e.next, 1, 'next']] as [HTMLElement, 1 | -1, string][]) { const why = SLOTS.on ? kitPeek(i, r.field, dir).why : ''; b.classList.toggle('off', !!why); b.title = why || word; }
    });
    if (dense) drawDense(m);
    sets.classList.toggle('sel', cur === rows.length);
    const lone = presets.length === 1;   // (KITTREE: the one set is a reset — a button, not a tab that is picked: dim while the card is as issued, as Paste is with nothing to change)
    setEls.forEach((b, k) => { const why = SLOTS.on ? kitPresetWhy(i, presets[k].id) : '', is = presets[k].id === base; b.classList.toggle('on', is && !lone); b.classList.toggle('pick', k === pick); b.classList.toggle('off', !!why || (is && lone)); b.title = why || presets[k].line; });
    if (clipEls) { const C = KIT_CLIP.card, p = C ? kitPastePeek(i, C) : null, same = !!p && !p.changed.length, why = p && !same ? p.why : '', whose = i ? 'his' : 'your';   // (Copy lit: this card IS the copied kit; Paste dim: nothing copied, nothing it would change, or no room)
      clipEls[0].classList.toggle('on', same); clipEls[0].title = `copy ${whose} kit (C)`;
      clipEls[1].classList.toggle('off', !C || same || !!why); clipEls[1].title = why || (!C ? 'nothing copied yet' : same ? `${i ? 'he wears' : 'you wear'} the copied kit` : `paste the copied kit onto ${i ? 'him' : 'you'} and keep ${whose} colours (V)`); }
    const noSet = said && said.k === rows.length ? said.why : dense && said && !popAt && isGun(rows[said.k]) ? said.why : ''; words.classList.toggle('refused', !!noSet);   // (the dense card: a gun's tile has no line of its own — a step it refused is said on the card's)
    words.textContent = noSet || (i === 0 && !tree ? `${kitWords(0)}. ${m.weapon === 'rifle' ? 'Both your guns are suppressed' : m.weapon === 'shotgun' ? 'Your pistol is suppressed but the shotgun isn\'t' : 'Your pistol is suppressed'}. Your light is ${lightKeys() === 'on L' ? 'on L' : 'on ' + lightKeys()} and your goggles are on N.` : kitWords(i)) + (KIT_NOTE[i] ? ` ${gearText(KIT_NOTE[i])}` : '');
    root.classList.toggle('focus', focused);
  }
  /** the dense card's own: each gun's tile wears what rides on it as chips (lit: fitted or carried, with a count; faint: not, or of no use on this
   *  mission), and the open pop-up draws the guns the tile could be — each with its drawing, its name and the tile's four bars, the one on the card lit,
   *  one the pouches have no room for dimmed */
  function drawDense(m: MemberKit) {
    const pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10}%`;
    rowEls.forEach((e, k) => { if (!e.slot || !e.chips) return; const r = rows[k], pop = guns[e.slot]?.pop, open = popAt === e.slot;
      pop?.classList.toggle('open', open); e.row.classList.toggle('open', open);
      // (a refusal while the pop-up is open — this gun's, or a set's or a paste's — is said in the pop-up, which lies over the card's own line)
      { const w = guns[e.slot]?.why, no = said && open && (said.k === k || said.k === rows.length) ? said.why : ''; if (w) { w.textContent = no; w.classList.toggle('on', !!no); } }
      const bits = rows.flatMap(c => { if (c.under === undefined || !rowHas(c, m) || rowUnder(c, m) !== e.slot) return [];
        const v = rowGet(c, m), G = given(c, v, kitIcon(c.field, v, false).none), n = G.idle ? 0 : typeof v === 'number' ? Math.max(v, G.handed) : v || G.handed ? 1 : 0;
        return [{ c, v, n, count: typeof v === 'number', idle: G.idle, lent: G.lent }]; });
      const sig = bits.map(b => `${b.c.field}:${b.n}:${b.lent}:${b.idle}`).join();
      if (sig !== e.chipsDrawn) { e.chipsDrawn = sig; e.chips.textContent = '';
        for (const b of bits) { const c = el('span', `kc-chip${b.n ? '' : ' off'}${b.lent ? ' lent' : ''}${b.idle ? ' idle' : ''}`); c.setAttribute('data-chip', b.c.field); c.title = `${b.c.label}: ${b.idle ? IDLE_WORD : b.lent ? LENT_WORD : b.c.word(b.v, m)}`;
          c.innerHTML = kitIcon(b.c.field, b.count ? Math.max(1, b.n) : true, false).svg; if (b.count && b.n) c.appendChild(el('b', '', String(b.n))); e.chips.appendChild(c); } }
      if (!e.picks || !open) { e.picksDrawn = ''; return; }
      const now = rowGet(r, m), card = `${SLOTS.on}:${KIT_CAN.on}:${JSON.stringify(kitWorn())}`;   // (the picks are a whole-card question each: asked again only when a card of the squad's has changed)
      if (card !== e.picksDrawn) { e.picksDrawn = card;
        for (const p of e.picks) { const c = { ...m } as MemberKit; if (r.set) r.set(c, p.v); else (c as unknown as Record<string, unknown>)[r.field] = p.v;
          const d = kitSlotDef(i, c, e.slot), S = d ? gunStats(d) : null, why = p.v === now || !SLOTS.on ? '' : kitPastePeek(i, c).why, can = KIT_CAN.on && kitRowCan(i, c, r.field), I = kitIcon(r.field, p.v, can), key = `${p.v}:${can}`;
          p.b.classList.toggle('on', p.v === now); p.b.classList.toggle('off', !!why); p.b.title = why || r.note(c);
          if (p.drawn !== key) { p.drawn = key; p.ico.innerHTML = I.svg; } p.ico.classList.toggle('none', I.none);
          p.name.textContent = r.word(p.v, c); p.bars.classList.toggle('off', !S);
          if (S) GUN_STATS.forEach((G, n) => { p.fills[n].style.width = pct(S[G.id]); p.fills[n].parentElement?.setAttribute('data-score', S[G.id].toFixed(3)); }); } }
      if (pop) fit(pop); });
  }
  /** the open pop-up ends over the host's foot (MemberCardOpts.floor: Deploy is under it) — in a window too short for it under the tiles it is drawn
   *  that much higher, over the foot of the guns' tiles, whose guns it names itself. A page with no lay-out (the harness): nothing */
  function fit(pop: HTMLElement) {
    try { pop.style.marginTop = ''; const box = pop.getBoundingClientRect?.(); if (!box || !box.height) return;
      const floor = opts.floor?.() || (root.ownerDocument?.documentElement?.clientHeight ?? 0), over = box.bottom + 4 - floor;
      if (floor > 0 && over > 0) pop.style.marginTop = `${-Math.ceil(over * (pop.offsetHeight / box.height || 1))}px`;   // (a text size's zoom: the page's pixels, not the screen's)
    } catch { /* (no lay-out to ask) */ }
  }
  function key(e: KeyLike): boolean {
    if (seen.has(e)) return true;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    { const clip = clipKey(e); if (clip) { seen.add(e); if (!e.repeat) { if (clip === 'copy') copy(); else paste(); } return true; } }
    const up = is(UP, e), down = is(DOWN, e), left = is(LEFT, e), right = is(RIGHT, e), ok = is(OK, e), back = is(BACK, e);
    if (!(up || down || left || right || ok || back)) return false;
    const S = popAt ? seq(def()) : [...seq(def()), rows.length], at = Math.max(0, S.indexOf(cur));   // (the rows the card has as it stands, then the sets — or, a pop-up open, what is in it)
    // (the dense card: Enter on a gun's tile opens its pop-up; open, the keys are the pop-up's — W S walk the gun and its things and stop at the ends, A D change, Enter on the gun or Esc shuts it)
    if (dense && (popAt ? back || (ok && cur < rows.length && isGun(rows[cur])) || (up && at === 0) || (down && at === S.length - 1) : ok && cur < rows.length && isGun(rows[cur]))) {
      seen.add(e); if (!e.repeat && (back || ok)) setPop(popAt ? null : rows[cur].field as GunSlot); return true; }
    if (back) { if (!opts.onBack) return false; seen.add(e); if (!e.repeat) opts.onBack(); return true; }
    if (up && at === 0 || down && at === S.length - 1) { if (said) { said = null; draw(); } return false; }   // (an edge: the host's to walk on from)
    seen.add(e);
    if (e.repeat) return true;   // (a key held down is one press: nothing here repeats)
    if (said) said = null;
    if (up) cur = S[at - 1]; else if (down) cur = S[at + 1];
    else if (cur < rows.length) { step(cur, left ? -1 : 1); return true; }
    else if (ok) { press(pick); return true; }
    else pick = Math.min(presets.length - 1, Math.max(0, pick + (left ? -1 : 1)));
    draw(); return true;
  }
  const setFocus = (on: boolean, tell: boolean) => { if (focused === on) return; focused = on; draw(); if (on && tell) opts.onFocus?.(i); };
  root.onkeydown = e => { if (key(e)) { e.preventDefault(); e.stopPropagation(); } };
  root.onfocus = () => setFocus(true, true);
  root.onblur = e => { if (!(e.relatedTarget instanceof Node && root.contains(e.relatedTarget))) setFocus(false, false); };
  root.onmousedown = e => { if (e.target !== root) e.preventDefault(); card.focus(); };   // (a click on an arrow or a set presses it without taking the keys off the card)
  host.appendChild(root); draw();
  const me = { root, draw }; liveCards.add(me);
  const card: MemberCard = {
    el: root, member: i,
    focus() { setFocus(true, true); (root as { focus?: (o?: FocusOptions) => void }).focus?.({ preventScroll: true }); },
    blur() { said = null; setPop(null); setFocus(false, false); draw(); },
    at: () => cur, key,
    go(k) { setPop(null); cur = Math.min(rows.length, Math.max(0, Math.round(k))); said = null; draw(); },
    pop: () => popAt, open: setPop,
    refresh() { said = null; const p = presets.findIndex(x => x.id === kitPresetOf(i)); if (p >= 0) pick = p; draw(); },   // (the picked set follows a card that was made a set elsewhere)
    copy, paste,
    destroy() { const D = root.ownerDocument as Document | undefined; D?.removeEventListener?.('pointerdown', shut, true); D?.removeEventListener?.('scroll', refit, true); D?.defaultView?.removeEventListener?.('resize', refit); liveCards.delete(me); host.innerHTML = ''; },
  };
  return card;
}
