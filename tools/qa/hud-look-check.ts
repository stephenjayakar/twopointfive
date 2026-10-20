// THE FIGHT SCREEN WEARS THE MENUS' LOOK: is the page's own style sheet (index.html) free of the old mint green and its literal typefaces, and do its `--h-…`
// tokens still say what the menus' tokens say (src/ui/theme.ts)?
//   bun run tools/qa/hud-look-check.ts              every check below; exit 0 = all pass, 1 = one failed (named)
//   HUDLOOK_BREAK=1 bun run tools/qa/hud-look-check.ts   the red path: one rule in the old look (a green, a typeface by name) is added to the sheet as read —
//                                                       'no green' and 'type' must then FAIL, and with them 'tally' and 'tally pair' (their own two old rules)
// Reads files only: no game is stood up, so there is no frozen or shipped stand to run it on, and it says nothing about what the page DRAWS.
// WHAT IS HELD:
//   no green   no colour literal in a rule of the sheet is of the green-to-teal family (hue 75°‥190°, the pale mints the old look used for text included), and
//              no near-black is tinted green or blue; a colour written in a form this file does not read (hsl(), a space-separated rgb()) is red too: the old HUD was
//              `#79d69a` on `rgba(4,10,12)`. What is green because the THING is (a smoke can, a frag; two keys of the debrief's map) is named below
//              and nowhere else.
//   tokens     each `--h-x: var(--m-y, literal)` carries the literal theme.ts gives `--m-y`: the fallback is what the page shows before the first script has run
//   type       outside the token block every `font` / `font-family` in the fight screen's part of the sheet is a token (`var(--…)`) or `inherit`
//   tally      the run tally on the pause card and the debrief (`#menu .db-stats`, ui/debrief.ts) cuts no label: no rule of it holds an ellipsis, a `nowrap` or a
//              line clamp (a long label takes a second line) and a tile holds its number at its foot, so the numbers of a row stay on one line
//   tally pair the tally and its map wrap by the card's width, and their least widths side by side fit the debrief card with a scroll bar of 17 px drawn (the
//              widest a browser draws): the map does not drop under the tally at an ordinary window on a machine that draws its scroll bars
//   overlay    src/ui/overlay.ts, which colours a few marks from code, holds no green either (the only file of code read: a tool's or a debug view's own
//              colours, `ui/panel.ts`, `ui/replaykey.ts`, `ui/windviz.ts` …, are not this check's)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(import.meta.dir, '..', '..');
const { MENU_TOKENS } = await import(`${ROOT}/src/ui/theme.ts`);
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

const page = readFileSync(join(ROOT, 'index.html'), 'utf8');
let sheet = page.slice(page.indexOf('<style>') + 7, page.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
if (process.env.HUDLOOK_BREAK === '1') sheet += '\n    #meters .m .num { color: #79d69a; font: 9px monospace; }\n';
const line0 = page.slice(0, page.indexOf('<style>')).split('\n').length;

type Hit = { line: number; sel: string; lit: string };
const THINGS = ['#equip .cans', '#menu .db-map .pin.ko', '#menu .db-legend .lg.ko', '#menu .db-legend .lg.path'];   // a can's own paint; the debrief map's keys: a man put to sleep, the path's ramp over time
const LIT = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
function rgbOf(lit: string): [number, number, number] {
  if (lit[0] === '#') { let h = lit.slice(1); if (h.length <= 4) h = [...h.slice(0, 3)].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; }
  return lit.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number];
}
/** green to teal, or a near-black leaning green / blue */
function isGreen([r, g, b]: [number, number, number]): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx <= 48) return g > r + 3 || b > r + 3;
  if (d / mx < 0.05) return false;
  const hue = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return hue >= 75 && hue <= 190;
}
function greens(text: string, at: (i: number) => { line: number; sel: string }): Hit[] {
  const out: Hit[] = [];
  for (const m of text.matchAll(LIT)) if (isGreen(rgbOf(m[0]))) out.push({ ...at(m.index!), lit: m[0] });
  return out;
}
const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2], line: line0 + sheet.slice(0, m.index! + m[1].length).split('\n').length - 1 }));
{
  const hits: Hit[] = [];
  for (const r of rules) { if (THINGS.some(t => r.sel.startsWith(t))) continue; hits.push(...greens(r.body, () => ({ line: r.line, sel: r.sel })));
    for (const m of r.body.matchAll(/hsla?\([^)]*\)|rgba?\(\s*\d+\s+\d+[^)]*\)/g)) hits.push({ line: r.line, sel: r.sel, lit: m[0] + ' (a form this check does not read)' }); }
  verdict(hits.length === 0, 'no green', hits.length ? hits.slice(0, 12).map(h => `index.html:${h.line} ${h.sel.slice(0, 60)} — ${h.lit}`).join('\n    ') + (hits.length > 12 ? `\n    … and ${hits.length - 12} more` : '') : `${rules.length} rules read, none holds a green`);
}
{
  const menu = new Map<string, string>([...String(MENU_TOKENS).matchAll(/(--m-[a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const root = rules.find(r => r.sel === ':root')?.body ?? '';
  const pairs = [...root.matchAll(/(--h-[a-z0-9-]+):\s*(?:rgb\()?var\((--m-[a-z0-9-]+),\s*([^;]+?)\)\)?;/g)], bad: string[] = [];
  for (const [, h, m, lit] of pairs) { const want = menu.get(m); if (want === undefined) bad.push(`${h}: theme.ts has no ${m}`); else if (want.replace(/\s+/g, ' ') !== lit.trim().replace(/\s+/g, ' ')) bad.push(`${h}: carries '${lit.trim()}', ${m} is '${want}'`); }
  verdict(pairs.length >= 12 && bad.length === 0, 'tokens', bad.length ? bad.join('\n    ') : `${pairs.length} tokens, each carrying its menu token's value`);
}
{
  const first = rules.findIndex(r => /^#(menu|missions)\b/.test(r.sel)), last = rules.findLastIndex(r => /^#(menu|missions)\b/.test(r.sel));
  const own = rules.filter((r, i) => r.sel !== ':root' && (i < first || i > last) && !r.sel.startsWith('.vpip'));
  const bad = own.filter(r => [...r.body.matchAll(/(?:^|[;\s])font(?:-family)?:\s*([^;]+)/g)].some(m => !/var\(--|^inherit\b/.test(m[1].trim())));
  verdict(first > 0 && bad.length === 0, 'type', bad.length ? bad.map(r => `index.html:${r.line} ${r.sel.slice(0, 70)}`).join('\n    ') : `${own.length} of the fight screen's rules, every typeface a token`);
}
{
  // (the red path puts back what the sheet did, a label cut and a pair too wide for its card; read here alone, so the rules do not move where the fight screen's part ends)
  const brk = process.env.HUDLOOK_BREAK === '1' ? [{ sel: '#menu .db-stats .st i', body: ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ' }, { sel: '#menu .db-left', body: ' flex: 1 1 400px; ' }] : [];
  const read = [...rules, ...brk], last = (sel: string) => read.filter(r => r.sel.endsWith(sel)).pop()?.body ?? '', px = (re: RegExp, body: string) => +(re.exec(body)?.[1] ?? NaN);
  const cut = read.filter(r => /\.db-stats\b/.test(r.sel) && /ellipsis|nowrap|line-clamp/.test(r.body)).length, tile = last('#menu .db-stats .st'), held = /flex-direction:\s*column/.test(tile) && /space-between/.test(tile);
  verdict(last('#menu .db-stats .st i') !== '' && cut === 0 && held, 'tally', cut ? `${cut} rule(s) of the tally cut a word (an ellipsis, nowrap or a line clamp)` : !held ? 'a tile no longer holds its number at the foot: a label on two lines would push it off its row\'s line' : 'a label too long for its tile takes a second line; the numbers of a row stay on one line');
  // (the debrief card's own room: its width less its padding and border, less the widest scroll bar a browser draws, 17 px)
  const grid = last('#menu .db-grid'), need = px(/flex:\s*\d+ \d+ (\d+)px/, last('#menu .db-left')) + px(/gap:\s*(\d+)px/, grid) + px(/flex:\s*\d+ \d+ (\d+)px/, last('#menu .db-right'));
  const room = px(/width:\s*min\((\d+)px/, last('#menu .card.wide')) - 2 * px(/padding:\s*\d+px (\d+)px/, last('#menu .card')) - 2 - 17;
  verdict(/flex-wrap:\s*wrap/.test(grid) && need <= room, 'tally pair', `the tally and its map want ${need} px side by side; the debrief card with a scroll bar has ${room}${need <= room ? '' : ': the map would drop under the tally at an ordinary window'}`);
}
{
  const src = readFileSync(join(ROOT, 'src/ui/overlay.ts'), 'utf8'), lines = src.split('\n');
  const hits = lines.flatMap((l, i) => greens(l, () => ({ line: i + 1, sel: '' })));
  verdict(hits.length === 0, 'overlay', hits.length ? hits.map(h => `src/ui/overlay.ts:${h.line} — ${h.lit}`).join('\n    ') : 'no green in the marks coloured from code');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
