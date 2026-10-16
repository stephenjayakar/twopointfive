// THE ONE-FILE BUILD'S BOOT (tools/build-one.ts → dist/one/twopointsix.html: the whole game page as ONE self-contained file — no folder beside it, no server
// behind it). The game is not told how it is packed: it goes on asking for the files beside the page (the animation library, the cast, a mission's level file, a
// menu picture, the build's commit) and for a page load of its own address with other flags (a mission picked, a showcase link, a restart). This script, a
// CLASSIC one that runs before the game's module, answers both from inside the page:
//   - THE PACK. Every file the build carried is an inert <script type="application/octet-stream" data-pack="<path>"> block of base64 (gzipped where
//     data-enc="gzip"). `fetch` of an address whose path ends in a packed path is answered from its block; an <img> whose src is set to one gets the block
//     as a data: address (pictures are packed as they are, so that this is synchronous). Anything not in the pack goes to the real fetch as before.
//   - THE FLAGS. A page that lives where its address cannot carry a query (a frame another page owns), or where a load of address + query is not served,
//     still has to be able to load itself with other flags. A load of the page's OWN address with another query that the PAGE starts (location.assign /
//     replace / reload, a link clicked) is taken over (the Navigation API): the query is put in the history entry's STATE, on the address the page was
//     first served from — a new entry where the load would have made one, so Back is still the page before (and Back / Forward between this page's own
//     entries, which is no load at all, reloads as the entry it lands on) — and the page reloads; this script then writes the kept query into the
//     address with history.replaceState before the game reads location.search. No Navigation API = the plain load, as it was. NOT TAKEN OVER, because
//     the page is not asked: the browser's own reload button and a link opened in a new tab — each asks the server for address + query, which is fine
//     wherever that is served (a file on disk, any ordinary host).
//     A SECOND INSTANCE of the page in an <iframe> (the Team & kit picture, ui/kitView.ts: the page's own address plus the mission's query) gets the same
//     treatment from the other side: its src becomes the address as first served and its query rides in the frame's NAME, which that instance reads here.
// Nothing here is imported by the game and nothing here imports it: the build bundles this file by itself (tsconfig still checks it).
(() => {
  const KEY = 'twopointsix.onefile.search', FRAME = 'twopointsix.onefile:';
  const home = location.href;

  // ---- the flags ----
  const stateOf = (): Record<string, unknown> => { const st: unknown = history.state; return st && typeof st === 'object' ? st as Record<string, unknown> : {}; };
  const homeAt = (hash: string) => home.replace(/#.*$/, '') + hash;
  const flagsOf = (): string | null => { const st = stateOf()[KEY]; return typeof st === 'string' ? st : null; };   // (this history entry's own flags)
  try {
    const kept = flagsOf() ?? (window.name.startsWith(FRAME) ? window.name.slice(FRAME.length) : null);   // (… else the ones this frame was born with)
    if (kept !== null && kept !== location.search) history.replaceState({ ...stateOf(), [KEY]: kept }, '', location.pathname + kept + location.hash);
  } catch (e) { console.warn('one-file build: the kept flags could not be put back —', e); }
  const mine = location.search;   // (the flags this document boots with)
  /** `url` as a load of this very page: its query ('' = none) and hash, else null */
  const ownQuery = (url: string): { search: string; hash: string } | null => {
    let to: URL; try { to = new URL(url, document.baseURI); } catch { return null; }
    const here = new URL(home); return to.origin === here.origin && to.pathname === here.pathname ? { search: to.search, hash: to.hash } : null;
  };
  type NavEvent = Event & { cancelable: boolean; hashChange: boolean; downloadRequest: string | null; navigationType: string; destination: { url: string; sameDocument: boolean } };
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  let ours = false;   // (the history calls and the reload below are navigations too: not taken over twice)
  nav?.addEventListener('navigate', ev => {
    const e = ev as NavEvent;
    if (ours || !e.cancelable || e.hashChange || e.downloadRequest !== null || e.destination.sameDocument || e.navigationType === 'traverse') return;
    const to = ownQuery(e.destination.url); if (!to) return;   // (another page: not ours to take)
    e.preventDefault(); ours = true;
    try {
      if (e.navigationType === 'push') { history.replaceState({ ...stateOf(), [KEY]: location.search }, '', homeAt(location.hash)); history.pushState({ [KEY]: to.search }, '', homeAt(to.hash)); }
      else history.replaceState({ [KEY]: to.search }, '', homeAt(to.hash));
    } catch (e2) { console.warn('one-file build: the flags could not be kept for the reload —', e2); }
    location.reload(); ours = false;
  });
  // Back / Forward between two entries of this page is no load at all (they are one document's entries): the entry's flags are not this document's → reload as it
  addEventListener('popstate', () => {
    if ((flagsOf() ?? location.search) === mine) return;
    ours = true; try { history.replaceState({ ...stateOf(), [KEY]: flagsOf() ?? location.search }, '', homeAt(location.hash)); } catch { /* the address stays */ }
    location.reload(); ours = false;
  });
  const fsrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  if (fsrc?.set && fsrc.get) Object.defineProperty(HTMLIFrameElement.prototype, 'src', { ...fsrc, set(this: HTMLIFrameElement, v: string) {
    const to = ownQuery(String(v));
    if (to && to.search !== new URL(home).search) { this.name = FRAME + to.search; fsrc.set!.call(this, homeAt(to.hash)); } else fsrc.set!.call(this, v);
  } });

  // ---- the pack ----
  const blocks = new Map<string, HTMLScriptElement>();
  for (const s of document.querySelectorAll<HTMLScriptElement>('script[data-pack]')) blocks.set(s.dataset.pack!, s);
  const packed = (url: string): HTMLScriptElement | null => {
    if (!blocks.size || /^(data|blob):/i.test(url)) return null;
    let path: string; try { path = decodeURIComponent(new URL(url, document.baseURI).pathname); } catch { return null; }
    for (const [name, s] of blocks) if (path.endsWith('/' + name)) return s;
    return null;
  };
  const bytes = (s: HTMLScriptElement): Uint8Array<ArrayBuffer> => { const raw = atob(s.textContent!.trim()), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i); return u8; };
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const s = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'GET' ? packed(input instanceof Request ? input.url : String(input)) : null;
    if (!s) return realFetch(input, init);
    try {
      const body = new Blob([bytes(s)]), headers = { 'Content-Type': s.dataset.type ?? 'application/octet-stream' };
      return Promise.resolve(new Response(s.dataset.enc === 'gzip' ? body.stream().pipeThrough(new DecompressionStream('gzip')) : body, { status: 200, headers }));
    } catch (e) { return Promise.reject(e); }
  };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (src?.set && src.get) Object.defineProperty(HTMLImageElement.prototype, 'src', { ...src, set(this: HTMLImageElement, v: string) {
    const s = packed(String(v));
    src.set!.call(this, s && s.dataset.enc !== 'gzip' ? `data:${s.dataset.type ?? 'application/octet-stream'};base64,${s.textContent!.trim()}` : v);
  } });
})();
