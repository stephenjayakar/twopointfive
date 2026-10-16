// MENU STILLS — a picture that did not come ONCE is asked for again (src/ui/menuStills.ts).
//
//   bun run tools/qa/menustills-check.ts            exit 0 = every line holds, 1 = one does not
//
// The card pictures are files beside the page. A list that is not there (404, the one-file build) is the answer for the page's life: nothing is asked twice.
// A server that did not answer, a 5xx, or a picture that failed to load is NOT an answer: it used to be held for the page's life all the same, so one bad
// moment left every card on its drawn plan until a reload. No DOM, no GPU: fetch, document and Image are stand-ins here.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const G = globalThis as any;
let fails = 0;
const verdict = (ok: boolean, what: string, got = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${got ? `  (${got})` : ''}`); if (!ok) fails++; };

/** what the next fetch of the list does, and how many were made */
let net: 'down' | number = 200, fetches = 0, onePage = false;
const badPics = new Set<string>(); let images = 0;
G.fetch = async () => { fetches++; if (net === 'down') throw new TypeError('fetch failed'); return { ok: net === 200, status: net, json: async () => ({ v: 1, stills: { a: {}, b: {} } }) }; };
G.document = { baseURI: 'http://localhost/', querySelector: (s: string) => (onePage && s.includes('tps-one-page') ? {} : null) };
G.Image = class { decoding = ''; naturalWidth = 0; onload: null | (() => void) = null; onerror: null | (() => void) = null;
  set src(u: string) { images++; const bad = [...badPics].some(id => u.endsWith(`/${id}.jpg`)); queueMicrotask(() => { if (bad) this.onerror?.(); else { this.naturalWidth = 760; this.onload?.(); } }); } };

/** a fresh copy of the module (its list and pictures are kept per page: one copy = one page visit) */
let n = 0;
const page = async () => { net = 200; fetches = 0; images = 0; onePage = false; badPics.clear(); return await import(`${ROOT}/src/ui/menuStills.ts?visit=${++n}`) as { stillOf(id: string): Promise<unknown> }; };

console.log('menu stills: a picture that did not come once is asked for again');
{ const S = await page(); net = 'down';
  const first = await S.stillOf('a'); net = 200; const second = await S.stillOf('a');
  verdict(first === null && second !== null, 'the server did not answer, then did: the picture comes on the next ask', `first ${first === null ? 'none' : 'a picture'}, second ${second === null ? 'none' : 'a picture'}, ${fetches} asks for the list`); }
{ const S = await page(); net = 503;
  const first = await S.stillOf('a'); net = 200; const second = await S.stillOf('a');
  verdict(first === null && second !== null, 'a 503 for the list, then the list: the picture comes on the next ask', `${fetches} asks for the list`); }
{ const S = await page(); badPics.add('a');
  const first = await S.stillOf('a'); badPics.clear(); const second = await S.stillOf('a'), third = await S.stillOf('a');
  verdict(first === null && second !== null && third === second && images === 2, 'a picture that failed to load is asked for again, one that came is kept', `${images} loads`); }
{ const S = await page(); net = 404;
  const first = await S.stillOf('a'), second = await S.stillOf('b');
  verdict(first === null && second === null && fetches === 1 && images === 0, 'no list beside the page (404): none, and it is asked once', `${fetches} asks for the list`); }
{ const S = await page(); onePage = true;
  const first = await S.stillOf('a');
  verdict(first === null && fetches === 0, 'the one-file build asks for nothing', `${fetches} asks for the list`); }
{ const S = await page();
  const a = await S.stillOf('a'), none = await S.stillOf('not-a-mission'), again = await S.stillOf('a');
  verdict(a !== null && again === a && none === null && fetches === 1 && images === 1, 'the list and a picture that came are kept: one ask each', `${fetches} for the list, ${images} loads`); }

console.log(fails ? `=== menustills-check: ${fails} FAILED ===` : '=== menustills-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
