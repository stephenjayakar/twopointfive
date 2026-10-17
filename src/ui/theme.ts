// THE MENUS' ONE LOOK: the colours and the two type stacks every menu screen draws with — the title and pause cards (index.html #menu…), the starting page
// and the mission list (#missions…, ui/missions.ts + ui/startpage.ts), the loadout and its kit cards (ui/loadout.ts, ui/kitCard.ts), the options screen
// (ui/options.ts), the debrief. Warm black ground, sand text (the game's own dust and plaster, 10-11: the blue slate before it was nobody's), ONE accent: change `--m-accent` (and its `-rgb` twin) and every screen follows. The fight screen is
// not a menu but wears the same look: its rules (index.html) read these tokens as `--h-…`, each with this file's value as its fallback (tools/qa/hud-look-check.ts). WHAT A STYLE SHEET CANNOT REACH repeats two of these as literals and moves with them: the canvases (the floor plans of
// ui/missions.ts, the debrief's map in ui/debrief.ts) and the dark cut-outs of the kit silhouettes (ui/kitIcons.ts) paint `--m-base`.
// Each of those files calls menuTheme() where it puts its own rules in the page, so the tokens are there whichever screen comes up first. Plain strings: nothing
// at module level uses another module's exports.
const ID = 'menu-theme';
export const MENU_TOKENS = `
:root {
  --m-accent: #f0912e; --m-accent-hi: #ffb561; --m-accent-rgb: 240,145,46; --m-on-accent: #140d05;
  --m-bright: #f0e9d9; --m-bright-rgb: 240,233,217; --m-text: #d2c9b5; --m-btn-text: #ded5c2; --m-soft: #a0977f; --m-dim: #938b76; --m-faint: #857d69;
  --m-edge: 214,200,170;
  --m-base: #0c0b09; --m-base-rgb: 12,11,9; --m-panel-rgb: 21,19,16; --m-panel2-rgb: 30,27,22; --m-btn-rgb: 44,40,33; --m-hover-rgb: 66,60,50; --m-sel-rgb: 58,42,22;
  --m-font: Inter, ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif;
  --m-head: 'Avenir Next Condensed', 'DIN Condensed', 'Roboto Condensed', 'Arial Narrow', Inter, ui-sans-serif, system-ui, sans-serif;
  --m-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
`;
/** the tokens are in the page (once) */
export function menuTheme() {
  if (typeof document === 'undefined' || !document.head || document.getElementById?.(ID)) return;
  const s = document.createElement('style'); s.id = ID; s.textContent = MENU_TOKENS; document.head.appendChild?.(s);
}
