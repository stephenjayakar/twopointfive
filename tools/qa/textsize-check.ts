// THE GAME'S OWN TEXT SIZE (src/ui/textsize.ts, TEXTSIZE): what can be checked with no page.
//   1. the factor: a window at the reference size and under draws at 1, a larger one by its ratio, capped; a page zoomed from the browser's menu (a smaller
//      window, denser pixels) comes out the same size on the glass; a step multiplies it, the default step is the window's alone, and no step takes the
//      layout under its floor;
//   2. an `@media` width or height is asked of the real window at px × factor, and a factor of 1 leaves the rule's text alone;
//   3. the keys a browser zooms with are read as larger / smaller / back, with Ctrl or ⌘ only;
//   4. the page's rules: no bare viewport unit in a zoomed layer (each is written `/ var(--tz, 1)`), every `@media` on the game page is a px width or height
//      (what the rewrite can scale), every layer the factor is put on is in the page or made by a module that names it, the switch is off in the module;
//   5. nothing under src/game, src/scene, src/anim or src/math reads it (a look, never a rule).
//   bun run tools/qa/textsize-check.ts        (probes.ts textsize; TEXTSIZE_BREAK=1 must FAIL — the window's reference halved)
// The page itself — sizes on the real screens, the keys, the kept step, the switch off — is tools/qa/textsize-page.cjs. Neither stand reads this module:
// the result is the same under TPS_PROFILE=shipped.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { TEXTSIZE, zoomFor, scaledQuery, zoomKey, textZoom } = await import(`${ROOT}/src/ui/textsize.ts`);
const BREAK = process.env.TEXTSIZE_BREAK === '1';

export async function textsizeCheck(): Promise<boolean> {
  console.log(`\n=== textsize: the game's own text size${BREAK ? ' (TEXTSIZE_BREAK: the reference window halved)' : ''} ===`);
  let all = true; const check = (ok: boolean, what: string, detail = '') => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!ok) all = false; };
  const ref0 = TEXTSIZE.ref; if (BREAK) TEXTSIZE.ref = [ref0[0] / 2, ref0[1] / 2];
  try {
    // 1. the factor
    const T = TEXTSIZE, B = T.base, near = (a: number, b: number, e = 0.011) => Math.abs(a - b) <= e;
    const table: [number, number, number][] = [[1280, 720, 1], [1440, 900, 1], [1728, 1117, 1], [1920, 1080, 1], [2560, 1440, 1.33], [3840, 2160, 2], [3440, 1440, 1.33], [1920, 1200, 1], [7680, 4320, 3]];
    const got = table.map(([w, h]) => zoomFor(w, h, B));
    check(table.every(([, , want], i) => near(got[i], want)), 'nothing chosen: the factor is the window over 1920 × 1080, never under 1, never over the cap', table.map(([w, h, want], i) => `${w}×${h} ${got[i]} (${want})`).join(' · '));
    const glass = [1, 1.25, 1.5, 2].map(k => zoomFor(3840 / k, 2160 / k, B) * k);
    check(glass.every(g => near(g, 2, 0.02)), "a 3840 × 2160 screen zoomed from the browser's menu draws the same size on the glass", [1, 1.25, 1.5, 2].map((k, i) => `${k * 100} %: ${glass[i].toFixed(2)}`).join(' · '));
    check(T.steps[B] === 1 && T.steps.length <= 5 && T.steps.every((m: number, i: number) => i === 0 || m > T.steps[i - 1]), 'a few steps, rising, the default one the window\'s own', `steps ${T.steps.join(' ')} · default ${B}`);
    const s4k = T.steps.map((_m: number, i: number) => zoomFor(3840, 2160, i));
    check(T.steps.every((m: number, i: number) => near(s4k[i], 2 * m, 0.02)), 'on a large window a step is that multiple of the window\'s factor', `3840×2160: ${s4k.join(' ')}`);
    const small = T.steps.map((_m: number, i: number) => zoomFor(1280, 720, i)), fl = small.map((z: number) => [1280 / z, 720 / z]);
    check(fl.every(([w, h]: number[]) => w >= T.floor[0] - 8 && h >= T.floor[1] - 5) && small[small.length - 1] > small[B], 'no step takes the layout under its floor, and the largest is still larger than none', `1280×720: ${small.join(' ')} → layout ${fl.map(([w, h]: number[]) => `${Math.round(w)}×${Math.round(h)}`).join(' ')}`);
    const tight = T.steps.map((_m: number, i: number) => zoomFor(1366, 768, i)), none = T.steps.map((_m: number, i: number) => zoomFor(1100, 620, i));
    check(tight.every((z: number, i: number) => i === 0 || z > tight[i - 1]) && near(tight[tight.length - 1], 1366 / T.floor[0]) && none.slice(B).every((z: number) => z === 1) && none[0] < 1,
      'with less room than the largest step asks for the larger steps share it, each still a step; with none they are the window\'s', `1366×768: ${tight.join(' ')} · 1100×620: ${none.join(' ')}`);
    check(zoomFor(0, 0, B) === 1 && zoomFor(1920, 1080, 99) === 1 && textZoom() === 1, 'a window with no size, a step that is not one, and a page that never booted it: 1', `${zoomFor(0, 0, B)} ${zoomFor(1920, 1080, 99)} ${textZoom()}`);

    // 2. media rules
    const q1 = scaledQuery('(max-width: 720px)', 2), q2 = scaledQuery('(min-width: 1181px) and (max-height: 772px)', 1.5), q3 = scaledQuery('(prefers-reduced-motion: reduce)', 2), q4 = scaledQuery('(max-height: 620px)', 1);
    check(q1 === '(max-width: 1440px)' && q2 === '(min-width: 1771.5px) and (max-height: 1158px)' && q3 === '(prefers-reduced-motion: reduce)' && q4 === '(max-height: 620px)', 'an @media width or height is asked at px × factor; anything else, and a factor of 1, is left as written', [q1, q2, q3, q4].join(' | '));

    // 3. the keys
    const k = (key: string, code: string, m: object) => zoomKey({ key, code, ...m });
    const keys = [k('=', 'Equal', { ctrlKey: true }), k('+', 'Equal', { metaKey: true }), k('+', 'NumpadAdd', { ctrlKey: true }), k('-', 'Minus', { ctrlKey: true }), k('_', 'Minus', { metaKey: true }), k('0', 'Digit0', { ctrlKey: true }), k('0', 'Numpad0', { metaKey: true }),
      k('=', 'Equal', {}), k('-', 'Minus', {}), k('0', 'Digit0', {}), k('=', 'Equal', { ctrlKey: true, altKey: true }), k('w', 'KeyW', { ctrlKey: true })];
    check(JSON.stringify(keys) === JSON.stringify([1, 1, 1, -1, -1, 0, 0, null, null, null, null, null]), 'Ctrl or ⌘ with + = − 0 are the size keys; the bare keys, Alt chords and every other chord are not', JSON.stringify(keys));

    // 4. the page's rules
    const src = readFileSync(`${ROOT}/src/ui/textsize.ts`, 'utf8'), layers: string[] = (/const LAYERS = \[([^\]]+)\]/.exec(src)?.[1] ?? '').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
    const page = readFileSync(`${ROOT}/index.html`, 'utf8'), ui = readdirSync(`${ROOT}/src/ui`).filter(f => f.endsWith('.ts')).map(f => [`src/ui/${f}`, readFileSync(`${ROOT}/src/ui/${f}`, 'utf8')] as [string, string]);
    // (the replay played in the game page — src/replay/engineplay.ts — makes layers of its own: its bar, the note field, the play mark, the no-tape note)
    const replay = readdirSync(`${ROOT}/src/replay`).filter(f => f.endsWith('.ts')).map(f => [`src/replay/${f}`, readFileSync(`${ROOT}/src/replay/${f}`, 'utf8')] as [string, string]);
    const files: [string, string][] = [['index.html', page], ...ui, ...replay];
    // (not in a layer: the benchmark's own report, the Team & kit picture's own window)
    const EXEMPT = (file: string, line: string) => file === 'src/ui/bench.ts' || /body\.kitview::after/.test(line) || /^\s*(\/\/|\/?\*)/.test(line) && !/[{;]\s*$/.test(line);
    const bare: string[] = [];
    for (const [f, text] of files) text.split('\n').forEach((line, i) => { if (EXEMPT(f, line)) return; for (const m of line.matchAll(/(?<![\w.#])\d*\.?\d+[dsl]?v(?:w|h|min|max)\b(?!\s*\/\s*var\(--tz, 1\))/g)) { const at = m.index ?? 0; if (/[:,(]\s*[^;{}]*$/.test(line.slice(0, at)) && /[;)]/.test(line.slice(at))) bare.push(`${f}:${i + 1} ${m[0]}`); } });
    check(bare.length === 0, 'no bare viewport unit in the game page\'s rules: each is divided by the factor', bare.length ? bare.slice(0, 8).join(' · ') : `${files.length} files read`);
    const odd: string[] = [];
    for (const [f, text] of files) if (f !== 'src/ui/textsize.ts') for (const m of text.matchAll(/@media\s*(\([^{]+)\{/g)) { const cond = m[1].trim(); if (/prefers-/.test(cond)) continue; if (scaledQuery(cond, 2) === cond || /\d(em|rem|vw|vh)\b/.test(cond)) odd.push(`${f}: ${cond}`); }
    check(odd.length === 0, 'every @media on the game page is a px width or height (what the factor can scale)', odd.join(' · ') || 'all of them');
    const made = (id: string) => page.includes(`id="${id}"`) || [...ui, ...replay].some(([, t]) => t.includes(`id = '${id}'`));
    const lost = layers.filter(l => !made(l.slice(1)));
    check(layers.length >= 15 && lost.length === 0 && !layers.includes('#view'), 'every layer the factor is put on is in the page or made by a module, and the picture\'s canvas is not one', lost.length ? `not found: ${lost.join(' ')}` : `${layers.length} layers`);
    check(/export const TEXTSIZE = \{[^}]*?\bon: false,/s.test(src), 'the switch is OFF in the module (the page\'s boot raises it; ?textsize=0 leaves it)', '');

    // 5. a look, never a rule
    const readers: string[] = [];
    for (const dir of ['src/game', 'src/scene', 'src/anim', 'src/math']) for (const f of readdirSync(`${ROOT}/${dir}`)) if (f.endsWith('.ts') && /textsize|textZoom|--tz\b/.test(readFileSync(`${ROOT}/${dir}/${f}`, 'utf8'))) readers.push(`${dir}/${f}`);
    check(readers.length === 0, 'nothing in the simulation reads the text size', readers.join(' ') || 'src/game, src/scene, src/anim, src/math');
  } finally { TEXTSIZE.ref = ref0; }
  console.log(`=== textsize: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await textsizeCheck()) ? 0 : 1);
