// MENU STILLS — the picture on a mission's card and on a group's tile of the Play page: a moment of that mission being PLAYED.
//
// The maintainer, 10-11: "our art style is also AWESOME so if we could highlight it (maybe with prerendered level screenshots or something)"; and, 10-12, of the
// first set (composed pictures of men stood on their start): "they look somewhat staged and repetitive" · "our actual gameplay looks a lot cooler!"
//
// The pictures are FILES beside the page (public/assets/menu/<mission id>.jpg + stills.json, which lists them), taken ahead of time by tools/menu-shots: the
// mission booted from its own link, played to a moment by a scripted player on the keys and the order menu, and that frame of the real renderer drawn from a
// camera pinned for the still (its head comments say how; a mission with no recipe there keeps a picture composed by tools/menu-art.ts). Nothing here draws the
// game. A picture is one run's moment, not the visit's deal — who stands where differs — so the menu marks nothing on it (the way in is marked on the map sheet
// beside the list).
// WHERE THE FILES DID NOT COME (the one-file build, a mission added since the pictures were made) every call answers null and the caller draws what it drew
// before: the menu's own model of the place (ui/planArt.ts).
interface Manifest { v: number; stills: Record<string, unknown> }
export interface StillPic { img: HTMLImageElement }

let manifest: Promise<Manifest | null> | null = null;
const pics = new Map<string, Promise<StillPic | null>>();
const at = (file: string) => new URL(`assets/menu/${file}`, document.baseURI).href;   // (beside the page, as the cast's files are: the build is served from a folder)

/** the list of pictures. A list that is not there (404, the one-file build, no DOM) is the answer for the page's life; a server that did not answer or a
 *  5xx is NOT an answer — it is forgotten, so the next ask (the Play page opened again) fetches again instead of every card staying on its drawn plan */
function manifestOf(): Promise<Manifest | null> {
  return manifest ??= (async () => {
    const later = () => { manifest = null; return null; };
    try {
      if (typeof fetch !== 'function' || typeof document === 'undefined' || typeof Image === 'undefined') return null;
      if (document.querySelector?.('meta[name="tps-one-page"]')) return null;   // (the one-file build has no folder beside it: nothing is asked for)
    } catch { return null; }
    let r: Response;
    try { r = await fetch(at('stills.json')); } catch { return later(); }
    if (!r.ok) return r.status >= 500 ? later() : null;
    try { const m = await r.json() as Manifest; return m && m.v === 1 && m.stills && typeof m.stills === 'object' ? m : null; } catch { return null; }
  })();
}
/** a mission's picture; null = none (no file, no such mission, no DOM). A picture that came, and a mission the list does not name, are kept; a list that was
 *  forgotten (above) or a picture that failed to load is asked for again by the next call */
export function stillOf(id: string): Promise<StillPic | null> {
  let p = pics.get(id);
  if (!p) {
    const asked = manifestOf(), mine: Promise<StillPic | null> = asked.then(m => {
      const forget = () => { if (pics.get(id) === mine) pics.delete(id); return null; };
      if (!m) return manifest === asked ? null : forget();   // (still the list's answer = there is none; forgotten = it did not come)
      if (!Object.prototype.hasOwnProperty.call(m.stills, id)) return null;
      return new Promise<StillPic | null>(res => { const img = new Image(); img.decoding = 'async';
        img.onload = () => res(img.naturalWidth > 0 ? { img } : null); img.onerror = () => res(forget()); img.src = at(`${id}.jpg`); });
    });
    pics.set(id, p = mine);
  }
  return p;
}
/** the picture laid over a canvas, filling it (cut at the long sides where the shapes differ) */
export function drawStill(g: CanvasRenderingContext2D, W: number, H: number, P: StillPic) {
  const iw = P.img.naturalWidth, ih = P.img.naturalHeight, k = Math.max(W / iw, H / ih), dw = iw * k, dh = ih * k;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(P.img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
