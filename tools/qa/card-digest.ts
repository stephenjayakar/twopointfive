// THE CARDS AS ONE WORD: the boot card, the start card and the pause card (plain, and of a run a pick's URL started) as the real Menu puts them on the fake DOM
// (scenario-picker-probes.ts El / withDom), every element with its tag, classes, attributes, inline style, text and disabled bit, folded into one word a card.
//   bun run tools/qa/card-digest.ts [--nopicks]
// Two trees that print the same words draw the same cards. It imports nothing a build without the short list lacks (scene/picks.ts is asked for and may be
// absent), so the SAME file copied beside an older tree prints that tree's words: `--nopicks` here against that = the switch's 'off is the build as it was'.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { standUp } = await import('./headless.ts');
const { withDom } = await import('./scenario-picker-probes.ts') as typeof import('./scenario-picker-probes.ts');
const { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { mulberry32: seeded } = await import(`${ROOT}/src/math/dice.ts`);
function serial(e: any): string {
  if (e.nodeType === 3) return JSON.stringify(e._text);
  const attrs = Object.keys(e.attrs).sort().map(k => `${k}=${JSON.stringify(e.attrs[k])}`).join(' '), style = Object.keys(e.style).sort().map(k => `${k}:${e.style[k]}`).join(';');
  return `<${e.tagName} class=${JSON.stringify([...e.cls].join(' '))} ${attrs} style=${JSON.stringify(style)} ${e.disabled ? 'disabled' : ''} click=${e.onclick ? 1 : 0} title=${JSON.stringify(e.title)} html=${JSON.stringify(e._html)} text=${JSON.stringify(e._text)}>${e.children.map(serial).join('')}</${e.tagName}>`;
}
function fnv(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }

const nopicks = process.argv.includes('--nopicks'), out: Record<string, string> = {};
const P: any = await import(`${ROOT}/src/scene/picks.ts`).catch(() => null);
const log = console.log; console.log = console.warn = console.error = () => {};
await withDom('?quality=high&mute', async (root) => {
  if (P && nopicks) P.PICKS_UI.on = false;
  const { Menu, bootCard } = await import(`${ROOT}/src/ui/menu.ts`);
  Math.random = seeded(0x51c4); setDifficulty('standard', false);
  const W = await standUp({ uploadEvery: 4 });
  const menu = new Menu({ engine: W.engine, game: W.game, quality: { auto: false, current: 'high', adaptive: true, lastChange: '' }, audio: { volume: { master: 1, sfx: 1, ambience: 1, music: 1 }, setVolumes() {} }, overlay: { showLightDots: true }, onStart() {} } as any);
  const card = bootCard(); out.boot = fnv(serial(root)); card.off();
  menu.open('start'); out.start = fnv(serial(root));
  menu.open('pause'); out.pause = fnv(serial(root));
  (globalThis as any).location.search = '?levelFile=depot.json&roomclear&squad4&difficulty=standard&pick=depot&quality=high&mute'; menu.open('pause'); out.pausePick = fnv(serial(root));
  menu.close();
});
log(`CARD-DIGEST ${P ? (nopicks ? 'the short list switched off' : 'as shipped') : 'a tree without the short list'}: ${Object.entries(out).map(([k, v]) => `${k} ${v}`).join(' · ')} · all ${fnv(Object.values(out).join(''))}`);
process.exit(0);
