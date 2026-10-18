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
import { KIT, KIT_NOTE, KIT_PRESETS, SLOTS, SUITS, TRIMS, kitChanged, kitCost, kitDefault, kitGunCan, kitName, kitRowCan, kitPeek, kitPaste, kitPastePeek, kitPreset, kitPresetOf, kitPresetWhy, kitRowCost, kitRows, kitTeam, kitTry, kitWears, kitWords, rowGet, squadCost, youGunsCan, type MemberKit } from '../game/kit';
import { menuTheme } from './theme';
import { kitIcon } from './kitIcons';
import { kitNoise } from './kitNoise';

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
}
/** what an idle tile says in its value's place, and its tooltip (MemberCardOpts.idle) */
export const IDLE_WORD = 'no use here', IDLE_WHY = 'no fog of war on this mission: every room is already shown, so it has nothing to look into. It still takes its pouch.';
/** what a lent tile says in its value's place, and its tooltip (MemberCardOpts.lent), and the switch (`?nokitlent` = off: every tile reads the card alone,
 *  as it did — UI only: nothing in the game reads it) */
export const LENT_WORD = 'mission\u2019s', LENT_WHY = 'issued for this mission: takes none of your pouches';
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
 *  carried, and for a thing a man has one of or none (the shield, the wall charge, the shotgun), the rate alone ('a pouch each', 'the shield takes
 *  2 pouches') — 'no pouch · a pouch each' read as free and priced at once, and '2 pouches · the wall charge takes 2 pouches' said it twice. */
const costWords = (c: { pouches: number; rate: string }): string => c.pouches > 0 && /each$/.test(c.rate) ? `${c.pouches === 1 ? '1 pouch' : `${c.pouches} pouches`} · ${c.rate}` : c.rate;
/** the figure's two colours: a chosen tint, or null = as issued (drawn as an outline: the scenario's own colours are the scenario's — the four's red and blue
 *  pairs, the pair's — and not this card's to guess) */
function lookOf(m: MemberKit): { suit: string | null; trim: string | null } {
  return { suit: m.suit === 'issued' ? null : tintCss(SUITS[m.suit].tint), trim: m.trim === 'issued' ? null : tintCss(TRIMS[m.trim].tint) };
}

const POUCH_TIP = 'what he carries of the breaching tools and the throwables comes out of these: one grenade-sized thing to a pouch, two pouches for a big thing';
const POUCH_TIP_BIG = 'one grenade-sized thing to a pouch; one big thing — a shotgun, a hammer, a wall charge — in the big slot';
const UP = new Set(['KeyW', 'ArrowUp', 'w', 'W']), DOWN = new Set(['KeyS', 'ArrowDown', 's', 'S']), LEFT = new Set(['KeyA', 'ArrowLeft', 'a', 'A']), RIGHT = new Set(['KeyD', 'ArrowRight', 'd', 'D']);
const OK = new Set(['Enter', 'NumpadEnter', 'Space', ' ', 'Spacebar']), BACK = new Set(['Escape', 'Esc']);
/** by the key's PLACE on the board where the event says it (game/input.ts reads e.code: W A S D are where they are on any layout), else by its name */
const is = (set: Set<string>, e: KeyLike) => set.has(e.code || e.key);
/** events a card has already been handed (a host that calls key(e) AND lets the event reach the card's own listener: taken once) */
const seen = new WeakSet<object>();

/** Fill `host` with member i's card. */
export function memberCard(host: HTMLElement, i: number, opts: MemberCardOpts = {}): MemberCard {
  style();
  const rows = kitRows(i), def = () => KIT.members[i], issued = kitDefault(i);
  const root = el('div', 'kc'); root.setAttribute('data-member', String(i)); root.tabIndex = 0;
  // the head: a little figure in his two colours, who he is
  const head = el('div', 'kc-head'), fig = el('div', 'kc-fig'), suitBits: HTMLElement[] = [], trimBits: HTMLElement[] = [];
  for (const c of ['a a1', 'a a2', 'l l1', 'l l2', 'b', 'h']) { const b = el('i', c); suitBits.push(b); fig.appendChild(b); }
  for (const c of ['j j1', 'j j2', 'j j3', 'j j4']) { const b = el('i', c); trimBits.push(b); fig.appendChild(b); }
  const who = el('div', 'kc-who'), title = el('div', 'kc-title', (opts.name ?? kitName(i)).title), sub = el('div', 'kc-sub', (opts.name ?? kitName(i)).sub);
  // … and his pouches: a pip each, the full ones lit, 'n / m' (nothing while the rule is off)
  const pouch = el('div', 'kc-pouch'), pips = el('span', 'kc-pips'), pouchN = el('b', ''), squadN = el('span', 'kc-squad');
  squadN.title = 'what the teammates who come carry between them: one more on his card is one fewer on another';
  pouch.append(el('span', '', 'Pouches'), pouchN, squadN, pips); pouch.title = POUCH_TIP;
  who.append(title, sub, pouch); head.append(fig, who); root.appendChild(head);
  // the rows
  let cur = 0, pick = Math.max(0, KIT_PRESETS.findIndex(p => p.id === kitPresetOf(i))), focused = false;
  /** the row whose last step was refused, and why (shown on it until the next press anywhere on the card) */
  let said: { k: number; why: string } | null = null;
  /** the rows the last paste moved: they flash once (cleared by the card's next change), under one of two names by turns so that the next paste plays again */
  let flash: ReadonlySet<string> = new Set(), flashes = 0;
  const changed = (moved?: ReadonlySet<string>) => { said = null; flash = moved ?? new Set(); if (moved) flashes++; draw(); opts.onChange?.(i); };
  const step = (k: number, dir: 1 | -1) => { cur = k; const r = kitTry(i, rows[k].field, dir); if (!r.ok) { said = { k, why: r.why }; draw(); } else { changed(); if (r.passed) { said = { k, why: `passed ${r.passed}` }; draw(); } } };
  /** a set pressed: taken, or refused with the reason under the rows (the squad has no room for it as the other cards stand) */
  const press = (k: number) => { cur = rows.length; pick = k; const r = kitPreset(i, KIT_PRESETS[k].id); if (r.ok) changed(); else { said = { k: rows.length, why: `${KIT_PRESETS[k].label}: ${r.why}` }; draw(); } };
  const rowEls = rows.map((r, k) => {
    const row = el('div', 'kc-row'); row.setAttribute('data-field', r.field);
    const line = el('div', 'kc-line'), label = el('span', 'kc-label', r.label), prev = el('button', 'kc-step', '‹'), val = el('span', 'kc-val'), next = el('button', 'kc-step', '›'), note = el('div', 'kc-note');
    if (typeof r.values[0] === 'number') val.classList.add('num');   // (a count is a digit or a short word: its long label and both arrows then fit the card)
    prev.title = 'previous'; next.title = 'next'; prev.tabIndex = -1; next.tabIndex = -1;
    // (a press on an arrow is the arrow's alone: the row under it must not take the same click, or it would wipe what the arrow just said)
    prev.onclick = (ev) => { ev?.stopPropagation?.(); step(k, -1); }; next.onclick = (ev) => { ev?.stopPropagation?.(); step(k, 1); };
    row.onclick = () => { if (cur !== k || said) { cur = k; said = null; draw(); } };
    const ico = el('div', 'kc-ico');   // (the thing's silhouette — ui/kitIcons.ts; shown where the card is laid out as tiles: the loadout)
    line.append(label, prev, val, next); row.append(ico, line, note); root.appendChild(row);
    return { row, val, note, prev, next, ico, drawn: '' };
  });
  // the sets
  const sets = el('div', 'kc-sets');
  const setEls = KIT_PRESETS.map((p, k) => {
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
  root.appendChild(sets);
  const words = el('div', 'kc-words'); root.appendChild(words);

  let told = 0;   // (the row onSelect was last told of)
  function draw() {
    if (cur !== told) { told = cur; opts.onSelect?.(i, rows[cur]?.field ?? null); }
    const m = def(), look = lookOf(m), base = kitPresetOf(i);
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
      squadN.classList.toggle('full', !!sq && sq.used >= sq.total && c.used < c.total);   // (room in his own pouches and none in the squad's: the squad's count is why his arrows are dimmed, so it is the one lit)
    }
    rows.forEach((r, k) => {
      const v = rowGet(r, m), e = rowEls[k], cost = kitRowCost(i, r, m), no = said && said.k === k ? said.why : '';
      const gunRow = r.field === 'weapon' || r.field === 'primary' || r.field === 'secondary', can = gunRow && KIT_CAN.on && kitRowCan(i, m, r.field);   // (the gun on this row wears a suppressor: drawn with it, and your pistol alone named for it)
      const I = kitIcon(r.field, v, can), idle = !I.none && !!opts.idle?.(r.field);   // (carried, and of no use on this mission: the tile says so itself)
      // (the mission hands him more of it than his card carries: the tile shows what he will have — never on an idle tile, and only a count or a yes / no)
      const handed = KIT_LENT.on && !idle && (typeof v === 'number' || typeof v === 'boolean') ? Math.max(0, Math.floor(opts.lent?.(r.field) ?? 0)) : 0, lent = handed > (typeof v === 'number' ? v : v ? 1 : 0);
      e.val.textContent = idle ? (typeof v === 'number' ? `${v} · ${IDLE_WORD}` : IDLE_WORD) : lent ? (typeof v === 'number' ? (v ? `${v} · ${LENT_WORD} ${handed}` : `${handed} · ${LENT_WORD}`) : LENT_WORD) : (can && i === 0 ? youGunsCan(v) : null) ?? r.word(v, m); e.note.textContent = '';   // (his own count stays in front where he carries some: an arrow pressed always moves what the tile reads)
      e.row.classList.toggle('idle', idle); e.row.classList.toggle('lent', lent); e.row.classList.toggle('zero', !lent && (typeof v === 'number' ? v === 0 : I.none && (r.field === 'big' || r.field === 'wand' || r.field === 'shield' || r.field === 'primary'))); e.row.setAttribute('data-noise', String(kitNoise(r.field, m, i)));   // (none of the thing carried — a count of none, an empty big slot, no wand, no shield; never a fitting switched off —; how loud it is in use — ui/kitNoise.ts: both are drawn on a quiet mission's gear screen only)
      e.row.title = idle ? IDLE_WHY : lent ? LENT_WHY : '';
      { const key = `${r.field}:${gunRow || r.field === 'big' ? v : ''}${can ? ':can' : ''}`; if (e.drawn !== key) { e.drawn = key; e.ico.innerHTML = I.svg; } e.ico.classList.toggle('none', I.none && !lent); }
      if (no) e.note.textContent = no;
      else { if (cost && !(lent && !v)) e.note.append(el('span', 'kc-cost', costWords(cost)), ' · '); e.note.append(r.note(lent ? { ...m, [r.field]: typeof v === 'number' ? handed : true } : m)); }   // (lent: the row's line for a man who HAS it — how it is used, not 'none in your pouches' — and no pouch rate on a tile the mission alone fills: what it hands takes none)
      e.row.classList.toggle('sel', cur === k); e.row.classList.toggle('changed', v !== rowGet(r, issued)); e.row.classList.toggle('refused', !!no); e.row.classList.toggle('pasted', flash.has(r.field)); e.row.classList.toggle('pasted2', flash.has(r.field) && flashes % 2 === 0);
      // an arrow whose step would not fit his pouches is dimmed and says why (it can still be pressed: the reason goes on the row)
      for (const [b, dir, word] of [[e.prev, -1, 'previous'], [e.next, 1, 'next']] as [HTMLElement, 1 | -1, string][]) { const why = SLOTS.on ? kitPeek(i, r.field, dir).why : ''; b.classList.toggle('off', !!why); b.title = why || word; }
    });
    sets.classList.toggle('sel', cur === rows.length);
    setEls.forEach((b, k) => { const why = SLOTS.on ? kitPresetWhy(i, KIT_PRESETS[k].id) : ''; b.classList.toggle('on', KIT_PRESETS[k].id === base); b.classList.toggle('pick', k === pick); b.classList.toggle('off', !!why); b.title = why || KIT_PRESETS[k].line; });
    if (clipEls) { const C = KIT_CLIP.card, p = C ? kitPastePeek(i, C) : null, same = !!p && !p.changed.length, why = p && !same ? p.why : '', whose = i ? 'his' : 'your';   // (Copy lit: this card IS the copied kit; Paste dim: nothing copied, nothing it would change, or no room)
      clipEls[0].classList.toggle('on', same); clipEls[0].title = `copy ${whose} kit (C)`;
      clipEls[1].classList.toggle('off', !C || same || !!why); clipEls[1].title = why || (!C ? 'nothing copied yet' : same ? `${i ? 'he wears' : 'you wear'} the copied kit` : `the copied kit onto ${i ? 'him' : 'you'}, ${whose} colours kept (V)`); }
    const noSet = said && said.k === rows.length ? said.why : ''; words.classList.toggle('refused', !!noSet);
    words.textContent = noSet || (i === 0 ? `${kitWords(0)}. ${m.weapon === 'rifle' ? 'Both your guns are suppressed' : m.weapon === 'shotgun' ? 'Your pistol is suppressed, the shotgun is not' : 'Your pistol is suppressed'}; your light is on L, your goggles on N.` : kitWords(i)) + (KIT_NOTE[i] ? ` ${gearText(KIT_NOTE[i])}` : '');
    root.classList.toggle('focus', focused);
  }
  function key(e: KeyLike): boolean {
    if (seen.has(e)) return true;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    { const clip = clipKey(e); if (clip) { seen.add(e); if (!e.repeat) { if (clip === 'copy') copy(); else paste(); } return true; } }
    const up = is(UP, e), down = is(DOWN, e), left = is(LEFT, e), right = is(RIGHT, e), ok = is(OK, e), back = is(BACK, e);
    if (!(up || down || left || right || ok || back)) return false;
    if (back) { if (!opts.onBack) return false; seen.add(e); if (!e.repeat) opts.onBack(); return true; }
    if (up && cur === 0 || down && cur === rows.length) { if (said) { said = null; draw(); } return false; }   // (an edge: the host's to walk on from)
    seen.add(e);
    if (e.repeat) return true;   // (a key held down is one press: nothing here repeats)
    if (said) said = null;
    if (up) cur--; else if (down) cur++;
    else if (cur < rows.length) { step(cur, left ? -1 : 1); return true; }
    else if (ok) { press(pick); return true; }
    else pick = Math.min(KIT_PRESETS.length - 1, Math.max(0, pick + (left ? -1 : 1)));
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
    blur() { said = null; setFocus(false, false); draw(); },
    at: () => cur, key,
    go(k) { cur = Math.min(rows.length, Math.max(0, Math.round(k))); said = null; draw(); },
    refresh() { said = null; const p = KIT_PRESETS.findIndex(x => x.id === kitPresetOf(i)); if (p >= 0) pick = p; draw(); },   // (the picked set follows a card that was made a set elsewhere)
    copy, paste,
    destroy() { liveCards.delete(me); host.innerHTML = ''; },
  };
  return card;
}
