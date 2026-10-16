// THE HEAR-AGAIN PICTURE. The sound lanes' "hear again" (replay/soundlanes.ts relisten) pauses the replay and plays a stretch of its recorded sounds
// over and over; the game cannot step backwards, so the picture stood still while the stretch looped. This keeps a small FILMSTRIP of what was drawn
// while the replay played — one low-res JPEG per `everyMs` of TAPE time — and shows the frame for the hear-again head's time over the game view.
//
//   capture(t)  once per DRAWN frame, RIGHT AFTER the engine's render and in the same task: a WebGPU canvas's contents are only good until the frame
//               is presented, so a call from another rAF callback that runs BEFORE the render (the lanes' own paint loop does) reads an expired
//               canvas. Cheap when it takes nothing (two compares). The JPEG is encoded off the hot path, at most two at a time: a capture that
//               would queue a third is dropped, not queued.
//   show(t)     the kept frame nearest at or before t (within a second) laid over the view: ONE <canvas id="sndfilm">, made on first use right
//               after the view in the tree, so it covers the picture and sits under every HUD row, bar and dock. A cyan edge and a "↺" in its
//               corner say it is the recorded picture, not the live game.
//
// Picture only: nothing here reads or writes the game, rolls a die, listens or keeps a timer. No top-level statement uses an import (there is none).

export interface SoundFilmOpts { everyMs?: number; width?: number; maxFrames?: number; quality?: number }
interface Frame { t: number; blob: Blob }

const CYAN = '#7fc8ff', NEAR_S = 1, CACHE = 4, IN_FLIGHT = 2;

export class SoundFilm {
  private readonly every: number; private readonly width: number; private readonly max: number; private readonly quality: number;
  private frames: Frame[] = [];
  private lastT = -Infinity;      // the tape time of the last frame TAKEN (kept, or still being encoded)
  private busy = 0; private gen = 0; private dead = false;
  private enc: OffscreenCanvas | null = null; private encCtx: OffscreenCanvasRenderingContext2D | null = null;
  private el: HTMLCanvasElement | null = null; private elCtx: CanvasRenderingContext2D | null = null;
  private serial = 0; private want: Frame | null = null; private on = false;
  private cache: { f: Frame; bmp: ImageBitmap }[] = [];
  /** where the picture is laid: null = over the whole view (a "↺" drawn in its corner); else LETTERBOXED — its aspect kept, dark round it, the cyan edge on all four
   *  sides — in the rectangle this answers, asked each time it is placed (the lanes: what their dock leaves of the view; they put their own worded tag on it) */
  box: (() => { left: number; top: number; width: number; height: number }) | null = null;
  private readonly n = { taken: 0, dropped: 0, failed: 0 };
  /** for a debug hook (`__sndlanes.film.stats` on a page with the lanes): frames captured, captures dropped because two encodes were already in flight, frames that
   *  failed to encode, frames the strip holds now */
  get stats(): { taken: number; dropped: number; failed: number; kept: number } { return { ...this.n, kept: this.frames.length }; }

  constructor(private readonly view: HTMLCanvasElement, opts: SoundFilmOpts = {}) {
    this.every = Math.max(0, opts.everyMs ?? 100) / 1000; this.width = Math.max(16, Math.round(opts.width ?? 640));
    this.max = Math.max(1, Math.round(opts.maxFrames ?? 3000)); this.quality = Math.min(1, Math.max(0.05, opts.quality ?? 0.6));
  }

  capture(t: number): void {
    if (this.dead || !(t === t)) return;
    if (t < this.lastT) this.rekey(t);
    else if (t - this.lastT < this.every - 1e-6) return;   // (a hair of slack: steps of exactly the gap must not lose one to rounding)
    if (this.busy >= IN_FLIGHT) { this.n.dropped++; return; }
    const v = this.view, vw = v.width, vh = v.height;
    if (!(vw > 0 && vh > 0) || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return;
    const w = Math.min(this.width, vw), h = Math.max(1, Math.round(w * vh / vw));
    let got: Promise<ImageBitmap>;
    try { got = createImageBitmap(v, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' }); } catch { return; }   // (the copy of the canvas is taken by this call, now)
    this.lastT = t; this.busy++; this.n.taken++;
    const gen = this.gen;
    got.then(bmp => this.encode(bmp, w, h)).then(blob => { if (!this.dead && gen === this.gen && blob) this.keep({ t, blob }); else if (!blob) this.n.failed++; },
      () => { this.n.failed++; }).then(() => { this.busy--; });
  }

  show(t: number): boolean {
    const f = this.dead ? null : this.at(t);
    if (!f) { this.hide(); return false; }
    this.on = true; this.place();
    if (f === this.want) return true;
    this.want = f; const serial = ++this.serial;
    const hit = this.cache.find(c => c.f === f);
    if (hit) { this.draw(hit.bmp); return true; }
    createImageBitmap(f.blob).then(bmp => {
      if (this.dead) { bmp.close(); return; }
      this.cache.push({ f, bmp }); while (this.cache.length > CACHE) this.cache.shift()!.bmp.close();
      if (serial === this.serial && this.on) this.draw(bmp);   // (a newer show, or a hide, since: this picture is not painted)
    }, () => { if (serial === this.serial) this.want = null; });
    return true;
  }

  hide(): void { this.serial++; this.want = null; this.on = false; if (this.el) this.el.style.display = 'none'; }
  span(): [number, number] | null { const F = this.frames; return F.length ? [F[0].t, F[F.length - 1].t] : null; }
  count(): number { return this.frames.length; }
  clear(): void { this.gen++; this.frames = []; this.lastT = -Infinity; this.hide(); for (const c of this.cache) c.bmp.close(); this.cache = []; }
  dispose(): void { this.clear(); this.dead = true; this.el?.remove(); this.el = null; this.elCtx = null; this.enc = null; this.encCtx = null; }

  // ---- inside

  /** the tape went back (a reload, a seek to an earlier step, a run again): what was kept at or after t is of another pass and goes first */
  private rekey(t: number): void {
    const F = this.frames; let n = F.length; while (n > 0 && F[n - 1].t >= t) n--;
    if (n < F.length) { if (this.want && this.want.t >= t) this.want = null; F.length = n; }
    this.gen++;   // (a frame still being encoded belongs to the old pass too)
    this.lastT = -Infinity;
  }

  private encode(bmp: ImageBitmap, w: number, h: number): Promise<Blob | null> {
    try {
      if (!this.enc) { this.enc = new OffscreenCanvas(w, h); this.encCtx = this.enc.getContext('2d', { alpha: false }); }
      const c = this.enc, x = this.encCtx; if (!x) { bmp.close(); return Promise.resolve(null); }
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      x.drawImage(bmp, 0, 0, w, h); bmp.close();
      return c.convertToBlob({ type: 'image/jpeg', quality: this.quality });   // (the canvas is copied by this call: the next frame may draw over it at once)
    } catch { try { bmp.close(); } catch { /* closed */ } return Promise.resolve(null); }
  }

  private keep(f: Frame): void {
    const F = this.frames; let i = F.length; while (i > 0 && F[i - 1].t > f.t) i--;   // (two encodes may land out of order)
    if (i > 0 && F[i - 1].t === f.t) F[i - 1] = f; else F.splice(i, 0, f);
    if (F.length > this.max) F.splice(0, F.length - this.max);
  }

  /** the kept frame nearest at or before t, if it is within a second of it */
  private at(t: number): Frame | null {
    const F = this.frames; let lo = 0, hi = F.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (F[m].t <= t) lo = m + 1; else hi = m; }
    const f = lo > 0 ? F[lo - 1] : null;
    return f && t - f.t <= NEAR_S ? f : null;
  }

  private overlay(): HTMLCanvasElement {
    if (this.el) return this.el;
    const e = document.createElement('canvas'); e.id = 'sndfilm'; e.width = 2; e.height = 2;
    // right after the view in the tree with the view's own z-index: over the picture, under everything the page lays on it (HUD, bars, docks, cards)
    let z = 'auto'; try { z = getComputedStyle(this.view).zIndex || 'auto'; } catch { /* detached */ }
    e.style.cssText = `position:fixed;left:0;top:0;width:0;height:0;display:none;margin:0;padding:0;pointer-events:none;image-rendering:auto;object-fit:contain;z-index:${z};outline:2px solid ${CYAN};outline-offset:-2px;background:#07080a`;
    if (this.view.parentNode) this.view.after(e); else document.body.append(e);
    this.el = e; this.elCtx = e.getContext('2d', { alpha: false });
    return e;
  }

  private place(): { left: number; top: number; width: number; height: number } {
    const e = this.overlay(), r = this.box ? this.box() : this.view.getBoundingClientRect(), s = e.style;
    const L = `${r.left}px`, T = `${r.top}px`, W = `${r.width}px`, H = `${r.height}px`;
    if (s.left !== L) s.left = L; if (s.top !== T) s.top = T; if (s.width !== W) s.width = W; if (s.height !== H) s.height = H;
    return r;
  }

  private draw(bmp: ImageBitmap): void {
    const e = this.overlay(), x = this.elCtx; if (!x) return;
    const r = this.place();
    if (e.width !== bmp.width || e.height !== bmp.height) { e.width = bmp.width; e.height = bmp.height; }
    x.drawImage(bmp, 0, 0);
    if (this.box) { if (e.style.display !== 'block') e.style.display = 'block'; return; }   // (laid in a box: whoever gave it says what the picture is)
    // the "↺" tag, top left, sized in screen pixels whatever the strip's width
    const k = r.width > 0 ? e.width / r.width : 1, px = Math.max(8, 15 * k), pad = 4 * k, box = px + 2 * pad, off = 6 * k;
    x.fillStyle = 'rgba(17,19,22,.82)'; x.fillRect(off, off, box, box);
    x.strokeStyle = CYAN; x.lineWidth = Math.max(1, k); x.strokeRect(off + x.lineWidth / 2, off + x.lineWidth / 2, box - x.lineWidth, box - x.lineWidth);
    x.fillStyle = CYAN; x.font = `${px}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('↺', off + box / 2, off + box / 2 + px * 0.06);
    if (e.style.display !== 'block') e.style.display = 'block';
  }
}
