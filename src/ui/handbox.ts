// THE BOX OF WHAT IS IN HIS HANDS (the kit column with game/slotsetup.ts SLOTSETUP on; ui/overlay.ts updateEquip draws the column as it was with it off).
// The maintainer, 10-22, of Chaos Theory's panel: "scct had a really compact current equipment screen, probably too compact for us but we can aspire to it".
//   A STRIP of the five slots, each in its own place whatever is selected: its key and what the digit brings (a gun's name and rounds ready, the cans
//   themselves). The selected one is a tab, and under it
//   ONE BOX of two lines for it. The first: the magazine as pips, and the rounds in the gun and in reserve as two numbers (a can: the cans and how
//   many). The second: what is set on it, each in a place of its own on every gun — the selector's positions, the launcher's loads, the light — the
//   one that is up a filled plate, the others plain dim words.
//   THE SETUP IS THE BOX, and the box draws the two presses: the second line starts with the gun's own key and an arrow, and an empty key cap stands
//   before each row that can be set. That key again (slotsetup.ts) and the caps fill with their digits, the box's edge lights, the slots whose digits
//   are rows for now go dim in the strip, and a thin line along the box's foot runs down while it waits. Nothing moves when it opens and no line of
//   words explains it. The warm colour is the open setup's alone.
//   EMPTY HANDS, where they are a slot of their own (game/handslot.ts), have a place at the head of the strip under that slot's key: with everything
//   put away it is the tab, and the box under it is empty. (With that rule off a gun put away keeps its tab and its box goes dim and dashed.)
// Every slot is still one `.slot` with its `.key`, in the kit's order: what reads the column by those names finds them. Looks only: it reads the game
// and writes nothing.
import { BIGSLOT, kitYouLight } from '../game/kit';
import { Player } from '../game/game';
import type { Game, SlotKind } from '../game/game';
import type { Firearm } from '../game/weapons';
import { capNow, keyCap, keyText, keysOf } from '../host/keymap';
import { HANDSLOT, HANDSLOT_KEY } from '../game/handslot';
import { ringTag, shellTag } from '../game/gear';
import { FLOOR_KEY } from '../game/doors';
import { setupGun, setupRows, slotSetupOpen, slotSetupLeft, type SetupGun, type SetupRow } from '../game/slotsetup';

const CSS = `
#equip.hand { width: 380px; min-width: 0; }
#equip.hand .strip { display: grid; grid-template-columns: auto auto 1fr 1fr 1fr; gap: 3px; align-items: stretch; }
#equip.hand .strip.h6 { grid-template-columns: auto auto auto 1fr 1fr 1fr; }
#equip.hand .strip .slot.hands .mt { display: inline-block; width: 7px; height: 10px; border: 1px dashed var(--h-soft); border-radius: 2px; }
#equip.hand .strip .slot { box-sizing: border-box; gap: 5px; padding: 4px 6px; justify-content: center; min-width: 0; }
#equip.hand .strip .slot .name { letter-spacing: 0.04em; }
#equip.hand .strip .slot .n { color: var(--h-soft); font: 600 10px/1 var(--h-mono); min-width: 2ch; text-align: right; }
#equip.hand .strip .slot.none { opacity: 0.35; }
#equip.hand .strip .slot.none .name { font-size: 10px; letter-spacing: 0.02em; }
#equip.hand .strip.h6 .slot { padding-left: 5px; padding-right: 5px; }
#equip.hand .strip .slot.sel { opacity: 1; border-bottom-color: transparent; border-radius: 3px 3px 0 0; box-shadow: none; background: rgba(var(--h-plate),0.82); padding-bottom: 7px; margin-bottom: -4px; position: relative; z-index: 1; }
#equip.hand.setup .strip .slot.sel { border-color: var(--h-acc-hi); border-bottom-color: transparent; }
#equip.hand.setup .strip .slot.sel .key { color: var(--h-acc-hi); }
#equip.hand.setup .strip .slot.row { opacity: 0.3; }
#equip.hand .hb { position: relative; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; min-height: 54px; padding: 8px 9px 8px; border: 1px solid rgba(var(--h-edge),0.7); background: rgba(var(--h-plate),0.82); border-radius: 3px; box-shadow: 0 0 8px rgba(0,0,0,0.4); }
#equip.hand .hb.holstered, #equip.hand .hb.empty { opacity: 0.6; border-style: dashed; }
#equip.hand .hb.setup { border-color: var(--h-acc-hi); box-shadow: 0 0 10px rgba(var(--h-acc-rgb),0.35); }
#equip.hand .hb-top { display: flex; align-items: flex-end; gap: 8px; min-height: 16px; }
#equip.hand .hb-top .rounds { position: static; }
#equip.hand .hb-top .name { font-size: 13px; }
#equip.hand .hb-top .re { font: 700 9px/1 var(--h-head); letter-spacing: 0.14em; color: var(--h-soft); }
#equip.hand .hb-n { margin-left: auto; font: 700 17px/0.85 var(--h-mono); color: var(--h-hi); letter-spacing: 0.02em; white-space: nowrap; }
#equip.hand .hb-n i { font: 600 11px/1 var(--h-mono); color: var(--h-soft); margin-left: 5px; }
#equip.hand .hb-n.dry { color: #ff9c8c; }
#equip.hand .hb-top .tag.ocp { margin-left: 4px; }
#equip.hand .hb-set { display: grid; grid-template-columns: 24px 92px 1fr 54px; align-items: center; column-gap: 7px; min-height: 15px; }
#equip.hand .hb-chord { display: inline-flex; align-items: center; gap: 2px; color: var(--h-dim); font-size: 8px; }
#equip.hand .hb-row { display: inline-flex; align-items: center; gap: 3px; min-width: 0; white-space: nowrap; }
#equip.hand .hb-row kbd { margin-right: 2px; }
#equip.hand .hb-row kbd.no { visibility: hidden; }
#equip.hand .hb-row.c3 { justify-content: flex-end; }
#equip.hand .hb-row.c2 { overflow: hidden; }
#equip.hand .hb-set kbd { box-sizing: border-box; display: inline-block; min-width: 13px; height: 13px; padding: 0 2px; text-align: center; font: 700 10px/11px var(--h-mono); color: transparent; border: 1px solid rgba(var(--h-edge),0.3); border-radius: 2px; }
#equip.hand .hb-chord kbd { color: var(--h-soft); border-color: rgba(var(--h-edge),0.45); }
#equip.hand .hb.setup .hb-set kbd { color: var(--h-on); background: var(--h-acc-hi); border-color: var(--h-acc-hi); }
#equip.hand .hb.setup .hb-chord { color: var(--h-acc-hi); }
#equip.hand .hb-row .o { font: 700 10px/13px var(--h-head); letter-spacing: 0.03em; padding: 0 2px; border-radius: 2px; color: var(--h-faint); text-shadow: none; }
#equip.hand .hb-row .o.on { color: var(--h-on); background: var(--h-hi); }
#equip.hand .hb-row .o.out { opacity: 0.45; }
#equip.hand .hb-left { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--h-acc-hi); border-radius: 0 0 0 3px; }
#equip.hand > .slot.big { justify-content: flex-start; }
`;
function styles() { if (document.getElementById?.('handbox-css')) return; const s = document.createElement('style'); s.id = 'handbox-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }

const mk = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = cls === 'key' ? keyCap(text) : keyText(text); return e; };   // (.key: a slot's own cap, as the column's)
const loadName = (id: string) => id === 'ring' ? ringTag() : id === 'he40' ? shellTag() : 'CAM';

/** what the box shows that the column's own cache key does not hold: whether the setup is up, whether his hands are free for it, whether a light is fitted */
export function handBoxKey(game: Game): string { const pl = game.player; return `|hb${slotSetupOpen(game) ? 1 : 0}${pl.holding ? 'h' : ''}${kitYouLight(pl) ? 'l' : ''}${setupGun(pl) ?? ''}${keysOf('KeyL').join()}${pl.rifle.def.id}${pl.pistol.def.id}${pl.rifle.mode}${pl.pistol.mode}${pl.rifle.lightOn ? 1 : 0}${pl.pistol.lightOn ? 1 : 0}${pl.setup ? pl.setup.t : ''}`; }

/** the line the open setup's time runs down on (null: none drawn) — the column's own element, set again at every draw */
let leftBar: HTMLElement | null = null;
/** every frame, between draws: the open setup's line runs down (a width and no more: the column is not built again for it) */
export function handBoxTick(game: Game): void { if (leftBar?.style) leftBar.style.width = `${Math.round(slotSetupLeft(game) * 100)}%`; }

/** the box's second line: the gun's own key and an arrow (the first press), then a place each for the selector, the launcher's loads and the light, a key
 *  cap before each one the setup can step (empty while it is shut — the digits are the slots' until then). `armed`: the gun is in his free hands, so its
 *  key again WOULD open the setup — holstered, slung or with a man in his arm the line shows what is set and draws no presses. */
function settings(pl: Player, gun: SetupGun, f: Firearm, slotKey: string, armed: boolean): HTMLElement {
  const set = mk('div', 'hb-set'), all = setupRows(pl, gun), rows = armed ? all : [], by = (k: SetupRow['kind']) => rows.find(r => r.kind === k), has = (k: SetupRow['kind']) => all.some(r => r.kind === k);
  const chord = mk('span', rows.length ? 'hb-chord' : ''); if (rows.length) { const k = mk('kbd'); k.textContent = keyCap(slotKey); chord.appendChild(k); chord.appendChild(mk('span', '', '▸')); } set.appendChild(chord);
  const cell = (n: number, r: SetupRow | undefined, drawn: boolean) => { const e = mk('span', `hb-row c${n}`); if (drawn) { const k = mk('kbd', r ? '' : 'no'); k.textContent = keyCap(String(r ? r.key : n)); e.appendChild(k); } set.appendChild(e); return e; };
  { const r = by('mode'), e = cell(1, r, has('mode')); if (has('mode')) for (const m of f.def.modes) e.appendChild(mk('span', 'o' + (m === f.mode ? ' on' : ''), m.toUpperCase())); }
  { const rf = pl.rifle, A = gun === 'rifle' ? rf.attachments : [], e = cell(2, by('load'), A.length > 0);
    for (const a of A) e.appendChild(mk('span', `o${a === rf.attachment ? ' on' : ''}${rf.left(a) ? '' : ' out'}`, A.length > 2 && a !== rf.attachment ? loadName(a) : `${loadName(a)} ×${rf.left(a)}`)); }   // (three loads: the count on the one that is up)
  { const r = by('light'), e = cell(3, r, has('light')); if (has('light')) e.appendChild(mk('span', 'o' + ((f as Firearm & { lightOn?: boolean }).lightOn === true ? ' on' : ''), keysOf('KeyL').length ? 'L LIGHT' : 'LIGHT')); }   // (its key named only while its row has one: host/keymap.ts setFree)
  return set;
}
/** a gun's magazine as pips, each round there or spent (the column's own drawing) */
function magazine(f: Firearm): HTMLElement {
  const D = f.def, inMag = f.mag ?? 0, per = D.magCapacity > 60 ? 5 : D.magCapacity > 34 ? 2 : 1;
  const rounds = mk('span', 'rounds'); for (let i = 0; i < Math.ceil(D.magCapacity / per); i++) rounds.appendChild(mk('i', i < Math.ceil(inMag / per) ? '' : 'spent')); if (f.chamber) rounds.appendChild(mk('i', 'chamber'));
  return rounds;
}

/** the kit column as the box and its strip: `el` is #equip, emptied and drawn again (the caller keys the redraw) */
export function drawHandBox(el: HTMLElement, game: Game, paceShow: boolean, bigAt: string): void {
  styles(); el.textContent = ''; el.classList?.add('hand'); leftBar = null;   // (classList: the headless stand-in's elements have none)
  const pl = game.player, gun = pl.pistol, rf = pl.rifle, open = slotSetupOpen(game);
  // condition (and the key taken off a questioned man), the pace while it shows, the goggles: as the column had them
  const cond = mk('div', 'cond' + (pl.down ? ' down' : '') + (game.godMode ? ' god' : ''));
  if (game.godMode) cond.appendChild(mk('span', 'g on', 'GOD MODE'));
  else { cond.appendChild(mk('span', 'g', pl.down ? 'DOWN — ENTER' : 'CONDITION')); const pips = mk('span', 'pips'); for (let i = 0; i < Player.MAX_HITS; i++) pips.appendChild(mk('i', i < pl.hitsLeft ? '' : 'lost')); cond.appendChild(pips); }
  { const g = mk('span', 'g' + (pl.nv ? ' on' : ''), 'N NIGHT VISION'); g.style.marginLeft = '10px'; cond.appendChild(g); }
  if (pl.keys.size) { const named = [...pl.keys].filter(k => k !== FLOOR_KEY); cond.appendChild(mk('span', 'keytag', named.length ? `KEY · ${named.join(' · ').toUpperCase()}` : 'KEY')); }
  el.appendChild(cond);
  if (paceShow) { const pr = mk('div', 'pace'); pr.appendChild(mk('span', 'g', 'PACE')); const ticks = mk('span', 'ticks'), N = 6, lit = Math.round((pl.pace - 0.35) / 0.65 * (N - 1)) + 1; for (let i = 0; i < N; i++) ticks.appendChild(mk('i', i < lit ? 'on' : '')); pr.appendChild(ticks); pr.appendChild(mk('span', 'g', 'wheel')); el.appendChild(pr); }
  const cans = (k: SlotKind) => k === 'smoke' ? pl.canisters : k === 'flash' ? pl.flashbangs : pl.frags;
  const canName: Record<string, string> = { smoke: 'smoke', flash: 'stun', frag: 'frag' }, canCls: Record<string, string> = { smoke: 'cans', flash: 'cans bangs', frag: 'cans frags' };
  const pipsOf = (k: SlotKind) => { const c = mk('span', canCls[k]); for (let i = 0; i < cans(k); i++) c.appendChild(mk('i')); return c; };
  const slots: [SlotKind, string][] = [['pistol', '1'], ['rifle', '2'], ['smoke', '3'], ['flash', '4'], ['frag', '5']];
  const empty = HANDSLOT.on && pl.holstered;   // (empty hands as a slot: nothing of the kit is the tab)
  const inHand = setupGun(pl), strip = mk('div', 'strip' + (HANDSLOT.on ? ' h6' : '')); let box: HTMLElement | null = null;
  if (HANDSLOT.on) { const s = mk('div', 'slot hands' + (empty ? ' sel' : '')), k = mk('span', 'key'); k.textContent = capNow(HANDSLOT_KEY); s.appendChild(k); s.appendChild(mk('i', 'mt')); strip.appendChild(s); if (empty) box = mk('div', 'hb empty'); }
  const rowKeys = open && inHand ? setupRows(pl, inHand).map(r => String(r.key)) : [];   // (the digits that are rows while the setup is up: their slots go dim)
  el.classList?.toggle('setup', open);
  for (const [kind, key] of slots) {
    const f = kind === 'pistol' ? gun : kind === 'rifle' ? rf : null, sel = pl.slot === kind && !empty;
    if (kind === 'rifle' && !pl.hasRifle) { const s = mk('div', 'slot absent'); s.appendChild(mk('span', 'key', key)); s.appendChild(mk('span', 'name', '—')); strip.appendChild(s); continue; }
    // its place in the strip: what the digit brings (the selected one is the box's tab)
    const s = mk('div', 'slot' + (sel ? ' sel' : '') + (!f && !cans(kind) ? ' none' : '') + (!sel && rowKeys.includes(key) ? ' row' : '')); s.appendChild(mk('span', 'key', key));
    if (f) { s.appendChild(mk('span', 'name', f.def.short)); s.appendChild(mk('span', 'n', String(f.roundsReady))); } else if (cans(kind)) s.appendChild(pipsOf(kind)); else s.appendChild(mk('span', 'name', canName[kind]));
    strip.appendChild(s);
    if (!sel) continue;
    const setGun: SetupGun | null = kind === 'rifle' ? 'rifle' : kind === 'pistol' ? 'pistol' : null;
    box = mk('div', `hb${pl.holstered ? ' holstered' : ''}${open ? ' setup' : ''}`); const top = mk('div', 'hb-top');
    if (f && setGun) {
      top.appendChild(magazine(f));
      if (setGun === 'pistol') { const oc = mk('span', 'tag ocp' + (pl.ocp.ready() ? ' on' : ''), 'OCP'), bar = mk('span', 'ocpbar'), bb = mk('b'); bb.style.width = `${Math.round(pl.ocp.charge * 100)}%`; bar.appendChild(bb); oc.appendChild(bar); top.appendChild(oc); }
      if (f.reloading) top.appendChild(mk('span', 're', 'RELOADING'));
      const n = mk('span', 'hb-n' + (f.roundsReady ? '' : ' dry')); n.appendChild(mk('b', '', String(f.roundsReady))); n.appendChild(mk('i', '', `/ ${f.spare.reduce((a, b) => a + b, 0)}`)); top.appendChild(n);
      box.appendChild(top); box.appendChild(settings(pl, setGun, f, key, inHand === setGun && !pl.holding));
      if (open) { leftBar = mk('i', 'hb-left'); box.appendChild(leftBar); handBoxTick(game); }
    } else {
      top.appendChild(pipsOf(kind)); const n = mk('span', 'hb-n'); n.appendChild(mk('b', '', `×${cans(kind)}`)); top.appendChild(n); box.appendChild(top); box.appendChild(mk('div', 'hb-set'));
    }
  }
  el.appendChild(strip); if (box) el.appendChild(box);
  if (bigAt) {   // the big slot (kit.ts BIGSLOT): worked at a door on the door's own key, as the column had it
    const big = pl.bigKit, sb = mk('div', 'slot big' + (bigAt.includes('!') ? ' sel' : ''));
    sb.appendChild(mk('span', 'key', 'SPACE')); sb.appendChild(mk('span', 'name', big === 'shotgun' ? 'breaching shotgun' : 'hammer'));
    sb.appendChild(mk('span', '', BIGSLOT.shut ? 'at a shut door' : 'at a locked door')); el.appendChild(sb);
  }
}
