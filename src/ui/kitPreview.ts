// THE KIT PREVIEW (?kit, or __kit.open() from the console): the five member cards (ui/kitCard.ts) side by side over whatever is up, until the loadout screen
// mounts them itself. Also the page's one boot call for the kit table (kitBoot: read twopointsix.kit, expose __kit).
//
// Mouse for everything. Keys while it is open: W S / up down move, A D / left right change, Enter or Space press, Tab (Shift+Tab) the next (last) member,
// Esc closes. While it is open no key reaches the game.
import { KIT, KIT_MEMBERS, KIT_PRESETS, KIT_STAGED, SLOTS, SUITS, TRIMS, kitCost, kitLegal, kitLoad, kitLoadout, kitTeam, kitWalls, loadoutMissing, wallHere, kitPool, kitSmokes, kitPreset, kitPresetAll, kitReset, kitSet, kitStep, kitTry, kitWords, slotsSet, slotsUnknown, squadCost, type KitPreset } from '../game/kit';
import { memberCard, type MemberCard } from './kitCard';
import { menuTheme } from './theme';

const CSS = `
#kit-preview { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(var(--m-base-rgb),0.82); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--m-text); }
#kit-preview .kp { max-width: calc(100% - 32px); max-height: calc(100% - 32px); overflow: auto; padding: 18px 20px 14px; background: rgba(var(--m-panel-rgb),0.92); border: 1px solid rgba(var(--m-edge),0.35); border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
#kit-preview .kp-top { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 4px; }
#kit-preview .kp-t { font: 300 26px/1 ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif; letter-spacing: 0.06em; color: var(--m-bright); }
#kit-preview .kp-s { color: var(--m-soft); margin-bottom: 12px; }
#kit-preview .kp-all { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
#kit-preview .kp-btn { font: inherit; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 10px; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.7); border: 1px solid rgba(var(--m-edge),0.45); border-radius: 3px; cursor: pointer; }
#kit-preview .kp-btn:hover { background: rgba(var(--m-hover-rgb),0.8); border-color: var(--m-accent-hi); }
#kit-preview .kp-btn.primary { background: var(--m-accent); color: var(--m-on-accent); border-color: var(--m-accent); font-weight: 600; }
#kit-preview .kp-cards { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
#kit-preview .kp-foot { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; color: var(--m-soft); }
#kit-preview .kp-pool { color: var(--m-text); }
`;
let root: HTMLElement | null = null, cards: MemberCard[] = [], cur = 0, pool: HTMLElement | null = null;
function poolWords() { const two = kitPool(2), four = kitPool(4), sq = squadCost(), sm = (n: number) => (kitSmokes(n) ? `, ${kitSmokes(n)} smoke` : ''); return `Squad count · the four: ${four.bangs} stun, ${four.charges} charges, ${four.frags} frags${sm(4)} · the pair: ${two.bangs} stun, ${two.charges} charges, ${two.frags} frags${sm(2)}${sq ? ` · squad pouches ${sq.used} / ${sq.total}` : ''}`; }
const redraw = () => { for (const c of cards) c.refresh(); if (pool) pool.textContent = poolWords(); };

export function kitPreviewOpen() {
  if (root || typeof document === 'undefined') return;
  kitTeam(KIT_MEMBERS - 1);   // (all five cards are on this page: the squad's pouches are the four teammates')
  menuTheme(); if (!document.getElementById('kp-style')) { const s = document.createElement('style'); s.id = 'kp-style'; s.textContent = CSS; document.head.appendChild(s); }
  const mk = (tag: string, cls: string, text = '') => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };
  root = mk('div', ''); root.id = 'kit-preview';
  const box = mk('div', 'kp'), top = mk('div', 'kp-top'), all = mk('div', 'kp-all');
  top.append(mk('div', 'kp-t', 'Kit and uniform'));
  for (const p of KIT_PRESETS) { const b = mk('button', 'kp-btn', `All: ${p.label}`) as HTMLButtonElement; b.title = p.line; b.tabIndex = -1; b.onclick = () => { kitPresetAll(p.id); redraw(); }; all.appendChild(b); }
  const done = mk('button', 'kp-btn primary', 'Done') as HTMLButtonElement; done.tabIndex = -1; done.onclick = kitPreviewClose; all.appendChild(done);
  top.appendChild(all);
  const row = mk('div', 'kp-cards');
  cards = Array.from({ length: KIT_MEMBERS }, (_x, i) => { const h = mk('div', 'kp-card'); h.setAttribute('data-member', String(i)); row.appendChild(h); return memberCard(h, i, { onBack: kitPreviewClose, onChange: redraw, onFocus: k => { cur = k; for (const c of cards) if (c.member !== k) c.blur(); } }); });
  const foot = mk('div', 'kp-foot'); pool = mk('span', 'kp-pool', poolWords());
  foot.append(pool, mk('span', '', 'W S move · A D change · Enter press · Tab next member · Esc done'));
  box.append(top, mk('div', 'kp-s', KIT.on ? `Choose what each of you brings and wears. It's saved on this machine, and everyone will have it the next time you start a mission.${SLOTS.on ? '' : (SLOTS.ok ? ' Pouches rule off (?noslots): every row is free.' : ' Pouches rule off (the cost table was refused — see the console): every row is free.')}` : 'Switched off for this visit (?nokit), so everyone uses their issued kit no matter what the cards say.'), row, foot);
  root.appendChild(box); document.body.appendChild(root);
  cards[cur = 0].focus();
}
export function kitPreviewClose() { if (!root) return; root.remove(); root = null; cards = []; pool = null; }
export const kitPreviewIsOpen = () => !!root;

/** The page's boot call (main.ts, before anything listens for keys): the table read from this machine's store, `__kit` on window, and ?kit opens the preview.
 *  (`__kit` is up from the first tick, before `__ready`: it is the table's, not the game's — the preview is HTML and wants no engine. It sits UNDER the fatal
 *  card: a boot that died still shows.) */
export function kitBoot(q: URLSearchParams) {
  let store: Storage | null = null; try { store = window.localStorage; } catch { /* a sandboxed frame: the table lives for the visit */ }
  kitLoad(store, location.search);
  // the keys, first in line (window capture, registered before game/input.ts's and the page's Esc): while the preview is open they are its, and nobody else's
  window.addEventListener('keydown', e => {
    if (!root || e.metaKey || e.ctrlKey || /^F\d+$/.test(e.code)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    (window as unknown as { __attract?: { poke?: () => void } }).__attract?.poke?.();   // (the page's own 'somebody is here' listener sits behind this one: tell the attract mode by hand)
    if (e.code === 'Tab') { if (!e.repeat) cards[cur = (cur + (e.shiftKey ? -1 : 1) + cards.length) % cards.length].focus(); return; }
    cards[cur]?.key(e);
  }, { capture: true });
  (window as unknown as { __kit: unknown }).__kit = {
    KIT, suits: SUITS, trims: TRIMS, staged: KIT_STAGED, open: kitPreviewOpen, close: kitPreviewClose, reset: () => { kitReset(); redraw(); },
    set: (i: number, field: string, v: string | number | boolean) => { const ok = kitSet(i, field as never, v); redraw(); return ok; },
    step: (i: number, field: string, dir: 1 | -1 = 1) => { const v = kitStep(i, field as never, dir); redraw(); return v; },
    preset: (p: KitPreset, i?: number) => { const r = i === undefined ? (kitPresetAll(p), { ok: true, why: '' }) : kitPreset(i, p); redraw(); return r; },
    words: () => KIT.members.map((_m, i) => kitWords(i)), pool: kitPool,
    // the pouches rule (kit.ts SLOTS; slots.json): each man's used / total and the squad's, a step that says why it was refused, the table swapped by hand, one of its named loadouts put on all five
    slots: SLOTS, cost: (i?: number) => (i === undefined ? KIT.members.map((_m, k) => kitCost(k)) : kitCost(i)), unknown: slotsUnknown,
    try: (i: number, field: string, dir: 1 | -1 = 1) => { const r = kitTry(i, field as never, dir); redraw(); return r; },
    table: (t: unknown) => { const why = slotsSet(t); redraw(); return why ?? 'taken'; },
    squad: () => squadCost(), legal: () => kitLegal(), team: (n?: number) => { const t = kitTeam(n); redraw(); return t; }, loadouts: () => SLOTS.table.loadouts.map(l => ({ id: l.id, name: l.name, missing: loadoutMissing(l) })), walls: (n = kitTeam()) => kitWalls(n), wallHere: () => wallHere(),
    loadout: (id: string) => { const why = kitLoadout(id); redraw(); return why ?? 'done'; },
  };
  if (q.has('kit')) kitPreviewOpen();
}
