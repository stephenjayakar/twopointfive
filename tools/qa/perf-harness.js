// In-page measurement harness for the renderer perf / noise pass (docs/internal/perf-2026-08-10.md). Plain JS: paste the whole file into the page's
// console (or hand it to the Browser pane's javascript tool) on a `?paused&quality=<preset>&mute` boot once the hooks exist and #view has a size;
// everything then hangs off window.__perf. Nothing here is bundled or shipped.
//
// The protocols it encodes (CLAUDE.md "GPU timing — known traps" / "Judging renderer output"):
//  * timing: every frame is followed by `await device.queue.onSubmittedWorkDone()` + a MessageChannel yield, so frames never overlap on the GPU and each
//    frame's timestamp readback resolves before the next is encoded; per-pass numbers are the UNSMOOTHED per-frame values (GpuTimer.lastFrame) averaged
//    over n frames after `warm` discarded ones. Two baselines taken this way must agree to ~0.05 ms before any delta is believed; interleave A/B/A/B.
//    Keep the tab FRONTED while it runs and set window.__testVisible = true (a hidden pane gives garbage).
//  * captures: offscreen renders of the current game state (no game step) read back as RGBA8 (the final LDR frame: set engine.passes.grain = 0 first, the
//    film grain is animated) or as the linear rgba16f intermediates (passes.gi[0] = the filtered indirect the composite reads, passes.dS[c] = denoised
//    direct per class …). Temporal statistics over K consecutive captures of a still scene = the renderer's own noise.
//  * staging: __stage pins the camera and places men; life()/grainOff() remove the two animated things that are not renderer noise.
(() => {
  const E = () => window.__engine, C = () => window.__cam;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const f16 = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); };
  const P = {
    time: 100,   // frame.time for offscreen renders (only the haze drift and light flicker read it)
    /** serialize: wait for the GPU to drain and give the timestamp readback's promise a turn */
    async settle() { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); },
    /** n game+render steps (dt each, keys held), serialized */
    async step(n = 1, dt = 1 / 60, keys = []) { for (let i = 0; i < n; i++) { window.__runFrames(1, dt, keys); await P.settle(); } },
    /** n offscreen renders of the CURRENT game state (nothing steps), serialized — the last is what readback() returns */
    async render(n = 1) { for (let i = 0; i < n; i++) { E().render(C(), P.time, 1 / 60, false); P.time += 1 / 60; await P.settle(); } },
    /** per-pass GPU ms over n serialized frames after `warm` discarded ones: { pass: {ms, sd}, …, frames, computeMs } (still = offscreen renders instead of game steps) */
    async passes(n = 30, opts = {}) {
      const { warm = 10, still = false, dt = 1 / 60 } = opts;
      const t = E().timer; const acc = new Map(), sq = new Map(); let got = 0;
      for (let i = 0; i < warm + n; i++) {
        const before = t.resolved;
        if (still) await P.render(1); else await P.step(1, dt);
        for (let k = 0; k < 400 && t.resolved === before; k++) { if ((k & 15) === 15) await E().device.queue.onSubmittedWorkDone(); await yieldTask(); }   // (no setTimeout: a hidden pane clamps it to ≥ 1 s)
        if (i < warm || t.resolved === before) continue;
        got++; for (const [k, v] of t.lastFrame) { acc.set(k, (acc.get(k) ?? 0) + v); sq.set(k, (sq.get(k) ?? 0) + v * v); }
      }
      const out = {}; let compute = 0;
      for (const [k, v] of acc) { const m = v / got; out[k] = { ms: +m.toFixed(3), sd: +Math.sqrt(Math.max(0, sq.get(k) / got - m * m)).toFixed(3) }; if (!['gbuffer', 'composite', 'post', 'fxaa'].includes(k)) compute += m; }
      out.frames = got; out.computeMs = +compute.toFixed(3);
      return out;
    },
    /** interleaved A/B timing: apply(a) / apply(b) alternately `rounds` times, `n` frames each → per-pass means for A and B and B−A */
    async ab(applyA, applyB, opts = {}) {
      const { rounds = 3, n = 30, warm = 10, still = false, passes = ['direct', 'softblur', 'gather', 'temporal', 'volumetrics', 'rc c0', 'mesh'] } = opts;
      const A = [], B = [];
      for (let r = 0; r < rounds; r++) { applyA(); A.push(await P.passes(n, { warm, still })); applyB(); B.push(await P.passes(n, { warm, still })); }
      applyA();
      const mean = (arr, k) => { const v = arr.map(x => x[k]?.ms).filter(x => x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
      const out = { rounds, n };
      for (const k of [...passes, 'computeMs']) { const a = k === 'computeMs' ? A.reduce((s, x) => s + x.computeMs, 0) / A.length : mean(A, k), b = k === 'computeMs' ? B.reduce((s, x) => s + x.computeMs, 0) / B.length : mean(B, k); if (isNaN(a) && isNaN(b)) continue; out[k] = { A: +a.toFixed(3), B: +b.toFixed(3), d: +(b - a).toFixed(3), Aruns: A.map(x => x[k]?.ms ?? x.computeMs), Bruns: B.map(x => x[k]?.ms ?? x.computeMs) }; }
      return out;
    },
    /** RGBA8 pixels of the last offscreen render: { w, h, data } (rows top-down, RGBA) */
    async readback() {
      const fr = await E().readbackFrame(); if (!fr) throw new Error('no offscreen frame: call __perf.render() first');
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      return { w: fr.w, h: fr.h, data: fr.data };
    },
    /** a linear rgba16float texture (passes.gi[0], passes.indHist[p], passes.dS[c], passes.indirect, passes.spec …) → { w, h, data: Float32Array rgba } */
    async readTexture(tex) {
      const dev = E().device; const w = tex.width, h = tex.height; const bpr = Math.ceil(w * 8 / 256) * 256;
      const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = dev.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]); dev.queue.submit([enc.finish()]);
      await buf.mapAsync(GPUMapMode.READ); const u16 = new Uint16Array(buf.getMappedRange().slice(0)); buf.unmap(); buf.destroy();
      const out = new Float32Array(w * h * 4);
      for (let y = 0; y < h; y++) { const row = y * bpr / 2; for (let x = 0; x < w * 4; x++) out[y * w * 4 + x] = f16(u16[row + x]); }
      return { w, h, data: out };
    },
    /** world point → OUTPUT-frame pixel (what readback() / crop() / temporalStats() index under TAAU; = project() without it) */
    projectOut(p) { const q = P.project(p); if (!q) return null; const e = E(); const ow = e.outWidth ?? e.width, oh = e.outHeight ?? e.height; return [Math.round(q[0] * ow / e.width), Math.round(q[1] * oh / e.height)]; },
    /** world point → INTERNAL-resolution pixel of the current camera (the g-buffer's / dS's / every screen pass's grid; null when off screen) — NOT the readback's under TAAU, see projectOut */
    project(p) {
      const vp = C().viewProj; const x = p[0], y = p[1], z = p[2];
      const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (cw <= 0) return null; const e = E();
      return [Math.round((cx / cw * 0.5 + 0.5) * e.width), Math.round((0.5 - cy / cw * 0.5) * e.height)];
    },
    /** Temporal statistics of a still scene over `frames` consecutive offscreen renders inside the full-res tile (x, y, w, h):
     *  ldr: per-pixel temporal sd of luma (mean over the tile, in 8-bit steps), mean |Δ| frame to frame, fraction of pixel-frames with |Δluma| > thr ('boiling');
     *  lin (opts.linear = a texture getter, e.g. () => __engine.passes.gi[0], sampled at its own resolution over the tile's footprint): temporal sd / mean of
     *  luminance (relative noise) and the tile mean (for energy checks). */
    async temporalStats(x, y, w, h, opts = {}) {
      const { frames = 16, thr = 8, linear = null } = opts;
      const n = w * h;   // (x, y, w, h) are in the READBACK's pixels — the OUTPUT frame under TAAU (fr.w × fr.h), the internal frame without it; the linear texture's footprint is scaled from that
      const sum = new Float64Array(n), sum2 = new Float64Array(n); let prev = null; let dsum = 0, boil = 0, dcount = 0;
      let lt = null, ls = null, ls2 = null, ln = 0, lw = 0, lh = 0, lx0 = 0, ly0 = 0, ldiv = 1, lmeanAcc = 0;
      for (let f = 0; f < frames; f++) {
        await P.render(1);
        const fr = await P.readback(); const W = fr.w; const cur = new Float32Array(n);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * W + (x + i)) * 4; const L = 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; const k = j * w + i; cur[k] = L; sum[k] += L; sum2[k] += L * L; }
        if (prev) for (let k = 0; k < n; k++) { const d = Math.abs(cur[k] - prev[k]); dsum += d; dcount++; if (d > thr) boil++; }
        prev = cur;
        if (linear) {
          const tex = linear(); const t = await P.readTexture(tex);
          if (!lt) { ldiv = W / t.w; lx0 = Math.floor(x / ldiv); ly0 = Math.floor(y / ldiv); lw = Math.max(1, Math.floor(w / ldiv)); lh = Math.max(1, Math.floor(h / ldiv)); ln = lw * lh; ls = new Float64Array(ln); ls2 = new Float64Array(ln); lt = true; }
          let m = 0;
          for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) { const o = ((ly0 + j) * t.w + (lx0 + i)) * 4; const L = 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; const k = j * lw + i; ls[k] += L; ls2[k] += L * L; m += L; }
          lmeanAcc += m / ln;
        }
      }
      let sdMean = 0; for (let k = 0; k < n; k++) { const m = sum[k] / frames; sdMean += Math.sqrt(Math.max(0, sum2[k] / frames - m * m)); }
      const out = { tile: [x, y, w, h], frames, ldr: { sd: +(sdMean / n).toFixed(3), meanAbsDelta: +(dsum / Math.max(1, dcount)).toFixed(3), boilFrac: +(boil / Math.max(1, dcount)).toFixed(5), thr } };
      if (linear) { let sd = 0, mean = 0; for (let k = 0; k < ln; k++) { const m = ls[k] / frames; mean += m; sd += Math.sqrt(Math.max(0, ls2[k] / frames - m * m)); } out.lin = { texels: ln, mean: +(lmeanAcc / frames).toExponential(4), sd: +(sd / ln).toExponential(4), relSd: +((sd / ln) / Math.max(1e-9, mean / ln)).toFixed(4) }; }
      return out;
    },
    /** difference of two RGBA8 readbacks: max channel diff, mean, pixel counts over 2 and over 8 */
    diff(a, b) {
      let mx = 0, sum = 0, n2 = 0, n8 = 0; const n = a.data.length / 4;
      for (let i = 0; i < a.data.length; i += 4) { const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])); if (d > mx) mx = d; sum += d; if (d > 2) n2++; if (d > 8) n8++; }
      return { max: mx, mean: +(sum / n).toFixed(4), over2: n2, over8: n8, pixels: n };
    },
    /** FNV-1a over the RGB bytes of a readback (bit-identity checks across builds) */
    hash(a) { let h = 0x811c9dc5; for (let i = 0; i < a.data.length; i++) { if ((i & 3) === 3) continue; h ^= a.data[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); },
    /** crop (x, y, w, h) of the last readback, nearest-neighbour upscaled × scale, posted as JPEG `name` to the shot server (window.__shotPort) → docs/shots/<name>.jpg */
    async crop(name, x, y, w, h, scale = 3, q = 0.92, fr = null) {
      fr = fr ?? await P.readback();
      const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(w * scale, h * scale);
      for (let j = 0; j < h * scale; j++) for (let i = 0; i < w * scale; i++) { const so = ((y + Math.floor(j / scale)) * fr.w + (x + Math.floor(i / scale))) * 4, o = (j * w * scale + i) * 4; img.data[o] = fr.data[so]; img.data[o + 1] = fr.data[so + 1]; img.data[o + 2] = fr.data[so + 2]; img.data[o + 3] = 255; }
      cx.putImageData(img, 0, 0);
      const blob = await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q));
      const port = Number(window.__shotPort) || 5174;
      const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      return `${name}.jpg ${c.width}x${c.height} ${(blob.size / 1024).toFixed(0)} KB → ${r.status}`;
    },
    /** the whole last readback as a lossless PNG `name` (→ docs/shots/ab/<name>.png on this lane's shot server) */
    async png(name, fr = null) {
      fr = fr ?? await P.readback();
      const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h; const d = new Uint8ClampedArray(fr.data.length); d.set(fr.data); for (let i = 3; i < d.length; i += 4) d[i] = 255;
      c.getContext('2d').putImageData(new ImageData(d, fr.w, fr.h), 0, 0);
      const blob = await new Promise(res => c.toBlob(b => res(b), 'image/png'));
      const port = Number(window.__shotPort) || 5174;
      const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      return `${name}.png ${fr.w}x${fr.h} ${(blob.size / 1024).toFixed(0)} KB → ${r.status}`;
    },
    // ---- per-frame GPU TIMELINES (docs/internal/p0a-cascades.md): passes are not serialized on the GPU — Metal runs independent compute passes side by side
    // when the queue is full (the direct pass beside the whole cascade chain is the normal state at play cadence), so a per-pass duration can span time spent
    // on another pass and the SUM over passes double-counts. These read the timer's raw intervals (GpuTimer.lastRaw) and report the UNION as well. ----
    /** one serialized game frame → { wall, stale, raw: [{name, b, e}] (ms from the frame's first stamp), union, sum } */
    async frame1(dt = 1 / 60) {
      const t = E().timer; const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']; const before = t.resolved; const w0 = performance.now();
      window.__runFrames(1, dt, []); await E().device.queue.onSubmittedWorkDone(); const wall = performance.now() - w0;
      await yieldTask(); await yieldTask();
      for (let k = 0; k < 400 && t.resolved === before; k++) { if ((k & 15) === 15) await E().device.queue.onSubmittedWorkDone(); await yieldTask(); }   // (no setTimeout: a hidden pane clamps it to a second)
      return { wall: +wall.toFixed(2), stale: t.resolved === before, raw: t.lastRaw.map(x => ({ name: x.name, b: +x.begin.toFixed(3), e: +x.end.toFixed(3) })), union: +t.unionMs(RP).toFixed(3), sum: +t.sumMs(RP).toFixed(3) };
    },
    /** n serialized frames after `warm`, the camera pinned round `look` and yawed `dyaw` rad per frame (0 = static; 0.0105 = the 0.6°/frame orbit of the v3 doc);
     *  each(i) runs before frame i (negative during warm-up) for staging changes mid-run. Returns the frames for decomp(). */
    async orbit(opts = {}) {
      const { n = 60, warm = 10, dyaw = 0.0105, look = [23.0, 0, 19.4], pitch = 0.96, dist = 18, yaw0 = -0.42, dt = 1 / 60, each = null } = opts;
      const frames = []; let yaw = yaw0;
      for (let i = 0; i < warm + n; i++) {
        if (i >= warm) yaw += dyaw;
        window.__stage({ look, yaw, pitch, dist }, {});
        if (each) each(i - warm);
        const f = await P.frame1(dt);
        if (i >= warm) { f.i = i - warm; frames.push(f); }
      }
      return frames;
    },
    /** FIELD CADENCE: n frames submitted back to back with only `pace` task yields between them (a GPU-bound rAF loop, no drain) → whichever readbacks resolved, for decomp() */
    async cadence(opts = {}) {
      const { n = 150, dyaw = 0.0105, look = [23.0, 0, 19.4], pitch = 0.96, dist = 18, yaw0 = -0.42, pace = 2 } = opts;
      const t = E().timer; const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']; const got = []; let lastRes = t.resolved; let yaw = yaw0;
      for (let i = 0; i < n; i++) {
        yaw += dyaw; window.__stage({ look, yaw, pitch, dist }, {});
        window.__runFrames(1, 1 / 60, []);
        for (let k = 0; k < pace; k++) await yieldTask();
        if (t.resolved !== lastRes) { lastRes = t.resolved; got.push({ i, wall: 0, stale: false, raw: t.lastRaw.map(x => ({ name: x.name, b: +x.begin.toFixed(3), e: +x.end.toFixed(3) })), union: t.unionMs(RP), sum: t.sumMs(RP) }); }
      }
      await P.settle();
      return got;
    },
    /** stats over frames from orbit() / cadence(): per pass {mean, sd, p50, p95, max}, the cascade sum, Σ compute, the UNION of compute intervals, wall, how many
     *  frames had a cascade pass overlapping the direct pass (> 0.2 ms) and by how much at most; `clean` = the light-independent canary (softblur) and direct held
     *  still, i.e. no other GPU client got in (another WebGPU tab on this machine inflates both) */
    decomp(frames) {
      const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'], RC = ['rc c3', 'rc c2', 'rc c1', 'rc c0', 'rc dice'];
      const st = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); const q = p => +s[Math.floor(p * (s.length - 1))].toFixed(3); return { mean: +m.toFixed(3), sd: +sd.toFixed(3), p50: q(0.5), p95: q(0.95), max: +s[s.length - 1].toFixed(3) }; };
      const dur = (f, name) => { const x = f.raw.find(r => r.name === name); return x ? x.e - x.b : undefined; };
      const names = [...new Set(frames.flatMap(f => f.raw.map(r => r.name)))].filter(n => !RP.includes(n));
      const per = {}; for (const nm of names) per[nm] = st(frames.map(f => dur(f, nm)).filter(v => v !== undefined));
      const overl = frames.map(f => { const d = f.raw.find(x => x.name === 'direct'); if (!d) return 0; let o = 0; for (const x of f.raw) if (RC.includes(x.name)) o += Math.max(0, Math.min(x.e, d.e) - Math.max(x.b, d.b)); return o; });
      const out = { n: frames.length, per, rcSum: st(frames.map(f => RC.reduce((s, k) => s + (dur(f, k) || 0), 0))), computeSum: st(frames.map(f => f.sum)), computeUnion: st(frames.map(f => f.union)), wall: st(frames.map(f => f.wall)),
        overlapFrames: overl.filter(v => v > 0.2).length, maxOverlapMs: +Math.max(0, ...overl).toFixed(2), stale: frames.filter(f => f.stale).length };
      const sb = per.softblur, di = per.direct; out.clean = !!(sb && di && sb.p95 <= sb.p50 * 1.25 + 0.1 && sb.max <= sb.p50 * 1.6 + 0.2 && di.sd < 0.7);
      return out;
    },
    /** the rows a report wants from decomp() */
    brief(d) { return { n: d.n, clean: d.clean, rcSum: d.rcSum, c3: d.per['rc c3'], c2: d.per['rc c2'], c1: d.per['rc c1'], c0: d.per['rc c0'], dice: d.per['rc dice'], direct: d.per.direct, softblur: d.per.softblur, gather: d.per.gather, computeSum: d.computeSum, computeUnion: d.computeUnion, wall: d.wall, overlapFrames: d.overlapFrames, maxOverlapMs: d.maxOverlapMs, stale: d.stale }; },
    /** the timeline of one frame as text rows, earliest first */
    timeline(f) { return [...f.raw].sort((a, b) => a.b - b.b).map(x => `${x.name} [${x.b.toFixed(2)}–${x.e.toFixed(2)}] ${(x.e - x.b).toFixed(2)}`); },
    /** capture hygiene: the life layer and the foot lock off (a still man's silhouette then holds to the pixel), film grain off, every character's anim phase zeroed */
    still() { const A = window.__anim; if (A) { A.LIFE.on = 0; A.FEET.on = 0; } E().passes.grain = 0; for (const gd of window.__game.guards) gd.char.anim.phase = 0; window.__game.player.char.anim.phase = 0; return 'LIFE/FEET off, grain 0, phases 0'; },
    /** The staged scenes of docs/internal/perf-2026-08-10.md, from a fresh `?paused&quality=…&mute` boot (menu closed here). Resolves once the scene has
     *  been stepped to a settled state; returns the full-res pixel of the point of interest (the torch spot / the penumbra).
     *   's1'  storage room, its bulb off, a hand-placed torch (the game kills a dropped one within a second) 0.43 m off the north wall at 0.28 m, beam level-ish
     *         onto the wall; guards parked, Sam out of shot. The indirect-noise / energy scene.
     *   's2'  corridor: guard 0 standing 0.8 m off the corridor's north wall facing it, torch lit (his patrol carry), the others parked. A real carried torch.
     *   's3'  the boil geometry (torch-shadow pass 2): guard 1 killed on the storage floor, guard 0 standing 1.6 m off with his torch on the body from ~0.9 m
     *         height, camera tight on the body's shadow edge. */
    async scene(name) {
      const g = window.__game, e = E(); const DEG = Math.PI / 180;
      if (!(document.getElementById('view')?.clientWidth > 0)) throw new Error('#view has no size (hidden pane straight after a navigation): take one screenshot of the tab first, then stage');
      window.__menu?.close();
      if (name === 's1') {
        g.setGroup('storage', false);
        if (!window.__s1light) { const d = [0, -0.12, -1]; const l = Math.hypot(...d); window.__s1light = e.lights.add({ name: 's1_torch', group: 'test', kind: 1, pos: [33.0, 0.28, 4.55], dir: d.map(v => v / l), color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.05, volumetric: 1.0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70, card: true }); }
        window.__stage({ look: [33.1, 0, 5.0], yaw: -10 * DEG, pitch: 50 * DEG, dist: 7.5 }, { park: true, player: { pos: [30.8, 0, 9.0], yaw: 3.1, holstered: true, invisible: true } });
        P.still(); await P.step(40); await P.render(60);
        return { spot: P.project([33.0, 0.23, 4.12]) };
      }
      if (name === 's2') {
        window.__stage({ look: [27.4, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 8 }, { park: true, guards: [{ i: 0, pos: [27.5, 0, 10.9], yaw: Math.PI, torch: true, aimPitch: -0.25 }], player: { pos: [22.0, 0, 11.2], yaw: 1.57, holstered: true, invisible: true } });
        P.still(); await P.step(90); await P.render(60);
        const fl = g.guards[0].flashlight; const t = 2.0; return { spot: P.project([fl.pos[0] + fl.dir[0] * 0.9, fl.pos[1] + fl.dir[1] * 0.9, fl.pos[2] + fl.dir[2] * 0.9]), torch: { pos: fl.pos, dir: fl.dir } };
      }
      if (name === 's3') {
        // (a real guard's torch will not hold still for this: the kill makes him suspicious and `hold` then aims his torch at the noise; so the torch is a placed
        // light at hand height, owner 0, and every living man is parked)
        g.setGroup('storage', false);
        window.__stage({ look: [32.9, 0, 6.5], yaw: -30 * DEG, pitch: 48 * DEG, dist: 6.0 }, { park: true, guards: [{ i: 1, pos: [32.6, 0, 6.5], yaw: 1.2, torch: false }], player: { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true } });
        P.still(); await P.step(5);
        window.__killGuard(1, 'struck');   // (main.ts hook: killGuard where he stands, quietly; his torch is off so nothing sputters and nobody parked hears)
        await P.step(150);
        const b = g.guards[1].char.pos; const hips = g.guards[1].char.bones?.hips ?? [b[0], 0.15, b[2]];
        if (!window.__s3light) { window.__s3light = e.lights.add({ name: 's3_torch', group: 'test', kind: 1, pos: [31.3, 0.9, 7.7], dir: [1, 0, 0], color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: e.settings.flashlightRadius, volumetric: 1.0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70, card: true }); }
        const L = window.__s3light; const d = [hips[0] - L.pos[0], (hips[1] ?? 0.15) - L.pos[1], hips[2] - L.pos[2]]; const l = Math.hypot(...d); L.dir = d.map(v => v / l);
        await P.step(10); await P.render(60);
        return { body: P.project([hips[0], hips[1] ?? 0.15, hips[2]]), hips, torch: { pos: L.pos, dir: L.dir } };
      }
      throw new Error('unknown scene ' + name);
    },
  };
  window.__perf = P;
  return 'perf harness ready: __perf.{settle,step,render,passes,ab,frame1,orbit,cadence,decomp,brief,timeline,readback,readTexture,project,temporalStats,diff,hash,crop,png,still,scene}';
})();
