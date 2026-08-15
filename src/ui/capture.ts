// Frame capture for the automation hooks (__shot / __png on the game page, __shot on the viewer): read the engine's last rendered frame back into
// an opaque RGBA canvas, and post an encoded blob to the capture sink (tools/shot-server.ts on :5174 → docs/shots/). The caller renders first
// with its own clock, and picks the encoding.
import type { Engine } from '../engine';

/** The frame the engine last rendered offscreen as a 2D canvas — BGRA swizzled to RGBA when the swap chain is BGRA, alpha forced to 255 —
 *  or null when there is nothing to read back. */
export async function frameCanvas(engine: Engine): Promise<HTMLCanvasElement | null> {
  const fr = await engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer as ArrayBuffer), fr.w, fr.h), 0, 0);
  return c2;
}

/** POST a capture to the sink under `name`; resolves to the HTTP status. The sink is :5174 unless a script sets `window.__shotPort` (a lane running
 *  its own tools/shot-server.ts with PORT=… so its captures land in its own worktree). */
export async function postShot(name: string, blob: Blob): Promise<number> {
  const port = Number((window as unknown as { __shotPort?: number }).__shotPort) || 5174;
  const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  return r.status;
}
