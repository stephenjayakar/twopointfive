// png.ts — a minimal PNG reader for the QA tools (no npm): 8-bit RGB / RGBA / grey, non-interlaced, all five scanline filters; node:zlib inflate for the IDAT stream.
// Enough for the shot sink's __png captures (tools/shot-server.ts) so a probe can diff two frames pixel by pixel instead of comparing file hashes.
export interface Png { w: number; h: number; rgba: Uint8Array }
export async function decodePng(bytes: Uint8Array): Promise<Png> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0; const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const n = dv.getUint32(pos), type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)); const data = bytes.subarray(pos + 8, pos + 8 + n);
    if (type === 'IHDR') { w = dv.getUint32(pos + 8); h = dv.getUint32(pos + 12); depth = bytes[pos + 16]; ctype = bytes[pos + 17]; interlace = bytes[pos + 20]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + n;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`png: unsupported depth ${depth} / interlace ${interlace}`);
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : ctype === 4 ? 2 : 0; if (!ch) throw new Error(`png: unsupported colour type ${ctype}`);
  const all = new Uint8Array(idat.reduce((s, a) => s + a.length, 0)); { let o = 0; for (const a of idat) { all.set(a, o); o += a.length; } }
  const raw = new Uint8Array((await import('node:zlib')).inflateSync(all));   // (zlib-wrapped: node:zlib; Bun.inflateSync wants raw deflate)
  const stride = w * ch; const out = new Uint8Array(w * h * ch); let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0; let x = row[i];
      if (f === 1) x += a; else if (f === 2) x += b; else if (f === 3) x += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); x += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = x & 255;
    }
    prev = cur;
  }
  if (ch === 4) return { w, h, rgba: out };
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const s = i * ch; rgba[i * 4] = out[s]; rgba[i * 4 + 1] = ch >= 3 ? out[s + 1] : out[s]; rgba[i * 4 + 2] = ch >= 3 ? out[s + 2] : out[s]; rgba[i * 4 + 3] = ch === 2 ? out[s + 1] : 255; }
  return { w, h, rgba };
}
/** two frames compared: differing pixels (any channel Δ > 0 / > 8), the max channel Δ, the mean |Δ| — the shape of a mismatch (a stochastic sampler: many small; a staging: a region) */
export function diffPng(a: Png, b: Png): { same: boolean; pixels: number; over8: number; maxD: number; meanD: number; sizeMismatch: boolean } {
  if (a.w !== b.w || a.h !== b.h) return { same: false, pixels: -1, over8: -1, maxD: 255, meanD: NaN, sizeMismatch: true };
  let px = 0, o8 = 0, maxD = 0, sum = 0; const n = a.w * a.h;
  for (let i = 0; i < n; i++) { let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.rgba[i * 4 + c] - b.rgba[i * 4 + c])); if (d) px++; if (d > 8) o8++; if (d > maxD) maxD = d; sum += d; }
  return { same: px === 0, pixels: px, over8: o8, maxD, meanD: sum / n, sizeMismatch: false };
}
