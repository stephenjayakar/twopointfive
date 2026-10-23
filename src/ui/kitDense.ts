// THE DENSE KIT CARD (the maintainer on Team & kit, 10-20, beside a loadout card of Door Kickers 2: "this menu is pretty unwieldy … we shouldn't copy it
// but maybe we have a popup menu per gun, more information density, etc."). The picked man's card on the one starting page (ui/startpage.ts), laid out
// to be read at a glance and to fit the window with nothing scrolled:
//   · THE TWO GUNS SIDE BY SIDE, each one tile: its drawing large, its name, the four bars of what it is good at (ui/gunStats.ts), and in the tile's corner
//     what rides on it as CHIPS — its suppressor, the light, what the launcher fires — lit where fitted or carried (a count beside a round), faint where not;
//   · A GUN'S TILE OPENS ITS OWN POP-UP (a click on it; Enter with the keys on it): the guns the tile could be, side by side, each with its drawing, its
//     name and the same four bars under one another so two guns are compared by eye, and under them that gun's fittings and rounds as the tiles they
//     always were. A press on a gun puts it on the card at once. A press off the pop-up, Esc, or Enter on the gun shuts it. It opens under the two
//     tiles and ends over the screen's foot: in a window too short for that it is drawn that much higher, over the foot of the tiles (kitCard.ts fit);
//   · THE REST OF THE KIT IS ONE LINE OF SMALL TILES — the thing drawn, how many, its name —, the big slot among them;
//   · THE COLOURS AND THE SETS (suit, trim; Reset, Copy, Paste) are a strip under the kit, and the pouches with the two weight bars one line over it.
// It is the kit card itself (ui/kitCard.ts memberCard with `dense`: the same rows, values, refusals, lent and idle tiles, copy and paste) in another
// lay-out, so nothing of the kit's rules is here. THE KEYS are the card's: W S walk the tiles as they lie — the guns, the kit, the colours, the sets —,
// A D change the tile the keys are on (a gun's tile: the next gun), and inside a pop-up W S walk the gun and its things, A D change, Esc shuts.
// THE SWITCH: `KITDENSE.on`, on in the module; `?kitdense=0` on the address = the card as it was. UI only: nothing in the game reads it, nothing of it
// is in a recording, and the card it lays out is a tree card (game/kittree.ts) — with the tree off the card is the older one whatever this says.
// Plain strings: nothing at module level uses another module's exports.
export const KITDENSE = { on: true };
try { if (new URLSearchParams(location.search).get('kitdense') === '0') KITDENSE.on = false; } catch { /* no page (the harness) */ }

const STYLE_ID = 'kc-dense-style';
// (`.kc.kc-tree.kc-dense`: one class more than any rule of the start page's for the tree's tiles, so none of these wins by the order of the two sheets)
const P = '#missions.one #loadout .lo-kit .kc.kc-tree.kc-dense', PL = '#missions.one.pane-loadout #loadout .lo-kit .kc.kc-tree.kc-dense';
/** a quiet mission's gear screen (ui/startpage.ts QUIET_CSS), the row the keys are on */
const QS = '#missions.one.quiet.pane-loadout #loadout .lo-kit .kc.kc-tree.kc-dense.focus';
export const DENSE_CSS = `
${P} { display: grid; grid-template-columns: minmax(0, 1fr) !important; row-gap: 6px; padding: 0 0 24px; }
/* the pouches and the two weight bars: one line over the tiles */
${P} .kc-head { grid-column: 1; grid-row: auto; justify-content: flex-start; margin: 0 0 2px; }
${P} .kc-who { flex: 1 1 auto; min-width: 0; }
${P} .kc-pouch, ${P} .kc-pouch:has(.kc-load:not(.off)) { flex-wrap: wrap; justify-content: flex-start; gap: 4px 10px; }
${P} .kc-pips { order: 0; }
${P} .kc-load { flex: 0 1 auto; flex-direction: row; flex-wrap: wrap; gap: 4px 18px; margin: 0 0 0 16px; order: 10; }
${P} .kc-load .kc-bar { justify-content: flex-start; }
${P} .kc-load .kc-bar-t { flex: 0 0 132px; }
/* the guns: two tiles side by side, the pop-up of the open one under both */
${P} .kc-guns { position: relative; display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 6px; }
${P} .kc-gun, ${P} .kc-gun[data-gun="primary"] { display: block; grid-column: auto; min-width: 0; }
${P} .kc-gun > .kc-row, ${P} .kc-gun[data-gun="secondary"] > .kc-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(96px, 40%); grid-template-rows: 14px minmax(56px, 1fr) 26px; gap: 4px 16px; align-items: stretch; box-sizing: border-box; height: 100%; min-height: 132px; padding: 10px 12px 10px 10px; cursor: pointer; }
${P} .kc-gun[data-gun="secondary"] > .kc-row { grid-template-columns: minmax(0, 1fr) minmax(96px, 46%); }
${P} .kc-gun > .kc-row > .kc-line { grid-column: 1; grid-row: 1 / 4; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 14px minmax(0, 1fr) 26px; gap: 4px 0; align-items: center; min-width: 0; }
${P} .kc-gun > .kc-row .kc-label { grid-column: 1 / -1; grid-row: 1; align-self: start; }
${P} .kc-gun > .kc-row .kc-label::after { content: '\\25BE'; margin-left: 7px; font-size: 12px; letter-spacing: 0; color: var(--m-dim); }   /* (the tile opens — on the slot's name: the gun's own line is the sound mark's on a quiet mission) */
${P} .kc-gun > .kc-row:hover .kc-label::after, ${P} .kc-gun > .kc-row.open .kc-label::after { color: var(--m-bright); }
${P} .kc-gun > .kc-row .kc-val { grid-column: 1; grid-row: 3; min-width: 0; font-size: 21px; line-height: 26px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-gun > .kc-row > .kc-line .kc-step { display: none; }   /* (a gun is picked in its pop-up, or stepped with A D) */
${P} .kc-gun > .kc-row > .kc-ico, ${P} .kc-gun[data-gun="secondary"] > .kc-row > .kc-ico { display: block; grid-column: 1; grid-row: 2; align-self: center; justify-self: start; height: 100%; max-height: 76px; width: auto; max-width: 100%; aspect-ratio: 2 / 1; pointer-events: none; }
${P} .kc-gun > .kc-row > .kc-stats, ${P} .kc-gun[data-gun="secondary"] > .kc-row > .kc-stats { grid-column: 2; grid-row: 1 / 3; align-self: start; display: flex; flex-direction: column; gap: 5px; margin: 1px 0 0; }
${P} .kc-gun > .kc-row > .kc-stats.off { display: none; }
${P} .kc-stats .kc-bar-l { flex: 0 0 66px; }
${P} .kc-gun > .kc-row > .kc-stats { width: 100%; max-width: 300px; justify-self: end; }
${P} .kc-gun > .kc-row.open { background: rgba(var(--m-edge),0.14); box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.5); }
${P} .kc-chips { grid-column: 2; grid-row: 3; align-self: end; display: flex; justify-content: flex-end; align-items: center; gap: 4px; min-width: 0; }
${P} .kc-chip { display: flex; align-items: center; gap: 3px; height: 24px; padding: 0 5px; color: var(--m-text); background: rgba(var(--m-edge),0.12); font: 700 13px/24px var(--m-head); }
${P} .kc-chip svg { display: block; height: 16px; width: 32px; }
${P} .kc-chip.off { color: var(--m-dim); background: none; box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.14); }
${P} .kc-chip.off svg { opacity: 0.45; }
${P} .kc-chip b { font-weight: 700; }
${P} .kc-pop { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 6; padding: 10px; background: var(--m-base); box-shadow: inset 0 0 0 1px rgba(var(--m-edge),0.5), 0 22px 44px rgba(0,0,0,0.7); }
${P} .kc-pop.open { display: block; }
${P} .kc-picks { display: flex; align-items: stretch; gap: 6px; }
${P} .kc-pick-key { flex: 0 0 64px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; padding-bottom: 9px; color: var(--m-soft); font: 600 9px/5px var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; }
${P} .kc-pick-key span { display: block; height: 5px; white-space: nowrap; }
${P} .kc-pick { flex: 1 1 0; min-width: 0; max-width: 190px; display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 8px 9px 8px 8px; color: var(--m-text); background: rgba(var(--m-edge),0.06); border: 0; border-left: 3px solid transparent; border-radius: 0; font: inherit; text-align: left; cursor: pointer; }
${P} .kc-pick:hover { background: rgba(var(--m-edge),0.14); }
${P} .kc-pick.on { background: rgba(var(--m-edge),0.16); border-left-color: var(--m-soft); }
${PL}.focus .kc-row.sel.open ~ .kc-pop .kc-pick.on { background: rgba(var(--m-accent-rgb),0.12); border-left-color: var(--m-accent); }
${P} .kc-pick.off { opacity: 0.4; }
${P} .kc-pick-ico { display: block; height: 34px; aspect-ratio: 2 / 1; max-width: 100%; color: var(--m-btn-text); }
${P} .kc-pick-ico svg { display: block; width: 100%; height: 100%; }
${P} .kc-pick-ico.none { opacity: 0.28; }
${P} .kc-pick-name { display: block; font: 700 14px/18px var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-pick-bars { display: flex; flex-direction: column; gap: 6px; margin-top: 3px; }
${P} .kc-pick-bars.off { visibility: hidden; }
${P} .kc-pick-bars .kc-bar-t { position: relative; display: block; flex: 0 0 5px; height: 5px; box-shadow: none; background: rgba(var(--m-edge),0.16); }
${P} .kc-pick-bars .kc-bar-t .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--m-text); }
${P} .kc-pop[data-pop="secondary"] { left: auto; width: min(100%, 640px); }
${P} .kc-pop .kc-kids { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; margin: 8px 0 0 70px; padding: 0; border: 0; }
${P} .kc-pop .kc-kids .kc-row { display: grid; grid-template-columns: 26px 16px minmax(0, 1fr) 16px; grid-template-rows: 12px 20px; gap: 4px 2px; align-items: center; padding: 7px 5px 7px 6px; }
${P} .kc-pop .kc-kids .kc-row > .kc-ico { display: block; grid-column: 1; grid-row: 2; height: 13px; width: 26px; }
${P} .kc-pop .kc-kids .kc-line { display: contents; }
${P} .kc-pop .kc-kids .kc-label { grid-column: 1 / -1; grid-row: 1; padding-left: 2px; font-size: 9px; letter-spacing: 0.12em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-pop .kc-kids .kc-val, ${P} .kc-pop .kc-kids .kc-val.num { grid-column: 3; grid-row: 2; min-width: 0; text-align: center; font-size: 13px; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-pop .kc-kids .kc-val.num { font-size: 16px; }
${P} .kc-pop .kc-kids .kc-line button:nth-of-type(1) { grid-column: 2; grid-row: 2; width: 16px; height: 20px; }
${P} .kc-pop .kc-kids .kc-line button:nth-of-type(2) { grid-column: 4; grid-row: 2; width: 16px; height: 20px; }
${P} .kc-pop .kc-kids .kc-row.lent, ${P} .kc-pop .kc-kids .kc-row.idle { grid-column: span 2; }   /* (a count with words beside it: the mission's own, or of no use here) */
${P} .kc-pop:has(.kc-row.refused) { padding-bottom: 30px; }
${P} .kc-gun > .kc-row > .kc-note { display: none !important; }   /* (a gun's refusal is on the card's own line, or in its open pop-up) */
${P} .kc-pop-note { display: none; margin: 8px 0 0 70px; font-size: 12px; line-height: 18px; color: #e8c15a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-pop-note.on { display: block; }
/* the rest of the kit: one line of small tiles */
${P} .kc-gear { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; }
${P} .kc-gear .kc-row, ${P} .kc-gear .kc-row[data-field="big"] { display: grid; grid-column: auto; grid-template-columns: 20px minmax(0, 1fr) 20px; grid-template-rows: 34px minmax(22px, auto) auto; gap: 4px 0; align-items: center; align-content: start; padding: 10px 3px 9px 0; }
${P} .kc-gear .kc-row > .kc-ico, ${P} .kc-gear .kc-row[data-field="big"] > .kc-ico { display: block; grid-column: 1 / -1; grid-row: 1; justify-self: center; height: 34px; width: auto; aspect-ratio: 2 / 1; }
${P} .kc-gear .kc-line { display: contents; }
${P} .kc-gear .kc-line button:nth-of-type(1) { grid-column: 1; grid-row: 1; width: 20px; height: 26px; z-index: 1; }   /* (the arrows stand either side of the thing drawn: its value has the tile's width) */
${P} .kc-gear .kc-line button:nth-of-type(2) { grid-column: 3; grid-row: 1; width: 20px; height: 26px; z-index: 1; }
${P} .kc-gear .kc-val, ${P} .kc-gear .kc-val.num { grid-column: 1 / -1; grid-row: 2; padding: 0 3px; min-width: 0; text-align: center; font-size: 12px; line-height: 22px; letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .kc-gear .kc-val:not(.num) { white-space: normal; overflow: visible; line-height: 1.2; }   /* (a long name — the big slot's — takes a second line) */
${P} .kc-gear .kc-val.num { font-size: 19px; }
${P} .kc-gear .kc-row.lent .kc-val.num { font-size: 12px; letter-spacing: 0.02em; }   /* (a count with the mission's word beside it is read whole in a narrow tile, never cut) */
${P} .kc-gear .kc-label { grid-column: 1 / -1; grid-row: 3; padding: 0 4px; text-align: center; font-size: 9px; line-height: 1.3; letter-spacing: 0.12em; white-space: normal; overflow: visible; }
/* the colours and the sets: a strip under the kit */
${P} .kc-look { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
${P} .kc-look .kc-row { display: flex; align-items: center; gap: 8px; flex: 0 1 auto; min-width: 0; padding: 4px 6px 4px 8px; }
${P} .kc-look .kc-row > .kc-ico { display: block; flex: 0 0 auto; height: 16px; width: 32px; }
${P} .kc-look .kc-line { display: flex; flex-wrap: nowrap; align-items: center; gap: 4px; min-width: 0; }
${P} .kc-look .kc-label { flex: 0 0 auto; margin-right: 4px; }
${P} .kc-look .kc-val { flex: 0 1 auto; order: 3; min-width: 0; font-size: 12px; text-align: center; white-space: nowrap; }
${P} .kc-look .kc-line button:nth-of-type(1) { order: 2; }
${P} .kc-look .kc-line button:nth-of-type(2) { order: 4; }
${P} .kc-look .kc-sets { order: 0; margin: 0 0 0 auto; align-self: center; }   /* (after the colours in a narrow window too: the keys walk them in that order) */
${P} .kc-look .kc-clip[data-clip="copy"] { margin-left: 10px; }
/* a quiet mission's cursor is a wider bar (QUIET_CSS: 4 px of border, the row's padding taken in to 9): here the bar is drawn inside the tile, so no tile's lay-out moves under the keys */
${QS} .kc-row.sel { border-left-width: 3px; box-shadow: inset 1px 0 0 var(--m-bright); }
${QS} .kc-gun > .kc-row.sel { padding-left: 10px; }
${QS} .kc-gun > .kc-row.sel.open { box-shadow: inset 1px 0 0 var(--m-bright), inset 0 0 0 1px rgba(var(--m-edge),0.5); }
${QS} .kc-gear .kc-row.sel { padding-left: 0; }
${QS} .kc-pop .kc-kids .kc-row.sel { padding-left: 6px; }
${QS} .kc-look .kc-row.sel { padding-left: 8px; }
@media (max-width: 1180px) { ${P} .kc-gun > .kc-row .kc-val { font-size: 18px; } ${P} .kc-gun[data-gun="secondary"] > .kc-row { grid-template-columns: minmax(0, 1fr) minmax(110px, 40%); column-gap: 10px; } ${P} .kc-stats .kc-bar-l { flex-basis: 60px; } }
/* a short window: the guns' tiles lower, so the open pop-up still ends over the foot */
@media (max-height: 740px) {
  ${P} .kc-gun > .kc-row, ${P} .kc-gun[data-gun="secondary"] > .kc-row { grid-template-rows: 14px minmax(40px, 1fr) 24px; min-height: 102px; padding-top: 8px; padding-bottom: 7px; }
  ${P} .kc-gear .kc-row, ${P} .kc-gear .kc-row[data-field="big"] { grid-template-rows: 28px minmax(20px, auto) auto; padding-top: 7px; padding-bottom: 6px; }
  ${P} .kc-gear .kc-row > .kc-ico, ${P} .kc-gear .kc-row[data-field="big"] > .kc-ico { height: 28px; }
  ${P} .kc-gun > .kc-row > .kc-ico, ${P} .kc-gun[data-gun="secondary"] > .kc-row > .kc-ico { max-height: 44px; }
  ${P} .kc-pop { padding: 8px; }
  ${P} .kc-pick { padding-top: 6px; padding-bottom: 6px; }
  ${P} .kc-pick-ico { height: 28px; }
  ${P} .kc-pop .kc-kids { margin-top: 6px; }
}
/* a window with room to spare draws the tiles larger */
@media (min-height: 900px) and (min-width: 1500px) {
  ${P} { row-gap: 8px; }
  ${P} .kc-guns, ${P} .kc-gear { gap: 8px; }
  ${P} .kc-gun > .kc-row, ${P} .kc-gun[data-gun="secondary"] > .kc-row { min-height: 176px; padding: 12px 14px 12px 12px; }
  ${QS} .kc-gun > .kc-row.sel { padding-left: 12px; }
  ${P} .kc-gun > .kc-row > .kc-ico, ${P} .kc-gun[data-gun="secondary"] > .kc-row > .kc-ico { max-height: 108px; }
  ${P} .kc-gun > .kc-row, ${P} .kc-gun[data-gun="secondary"] > .kc-row { grid-template-rows: 14px minmax(56px, 1fr) 30px; }
  ${P} .kc-gun > .kc-row > .kc-line { grid-template-rows: 14px minmax(0, 1fr) 30px; }
  ${P} .kc-gun > .kc-row .kc-val { font-size: 24px; line-height: 30px; }
  ${P} .kc-gear .kc-row, ${P} .kc-gear .kc-row[data-field="big"] { grid-template-rows: 46px minmax(26px, auto) auto; padding: 14px 3px 12px 0; }
  ${P} .kc-gear .kc-row > .kc-ico, ${P} .kc-gear .kc-row[data-field="big"] > .kc-ico { height: 46px; }
  ${P} .kc-gear .kc-val.num { font-size: 22px; }
  ${P} .kc-gear .kc-label { font-size: 10px; }
  ${P} .kc-pick-ico { height: 48px; }
}
`;
/** the dense card's rules, once a page (ui/kitCard.ts asks when it makes a dense card) */
export function denseStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = DENSE_CSS; document.head.appendChild(s);
}
