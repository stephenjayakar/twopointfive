// In-page harness for the v3 DENOISER lane (renderer v3 phase 3, docs/internal/p3-denoise.md): the A/B and quality instruments behind the numbers in that
// note. Dev only — `await import('/qa/p3-harness.js')` on a `?paused&quality=<p>&mute` boot (pulls in perf-harness.js / perf-frames.js) → window.__p3.
// Everything long is fire-and-forget through __pf.run(name, fn) and polled from __pf.res[name] (the pane goes hidden between automation calls and a
// setTimeout wait then stalls; nothing here waits on a timer).
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  const E = () => window.__engine, S = () => window.__engine.settings;
  const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw'];
  const st = a => { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return { med: +q(0.5).toFixed(3), p25: +q(0.25).toFixed(3), p75: +q(0.75).toFixed(3), p95: +q(0.95).toFixed(3), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), max: +s[s.length - 1].toFixed(3), n: a.length }; };
  const DEG = Math.PI / 180;
  const P3 = {
    /** the staged views the note's crops come from (guards parked dark, Sam out of shot, life layer / grain / phases off; `settle` frames stepped) */
    async scene(name, settle = 40) {
      const pins = {
        still:    [{ look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } }],
        deskLamp: [{ look: [26.6, 0, 6.4], yaw: -25 * DEG, pitch: 56 * DEG, dist: 5.5 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } }],
        storage:  [{ look: [33.0, 0, 6.6], yaw: -15 * DEG, pitch: 55 * DEG, dist: 6.5 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } }],
        lobby:    [{ look: [8.4, 0, 17.0], yaw: 30 * DEG, pitch: 50 * DEG, dist: 9 }, { park: true, player: { pos: [30.8, 0, 9.0], yaw: 3.1, holstered: true, invisible: true } }],
        corridor: [{ look: [27.4, 0, 10.9], yaw: -15 * DEG, pitch: 50 * DEG, dist: 8 }, { park: true, guards: [{ i: 0, pos: [27.5, 0, 10.9], yaw: Math.PI, torch: true, aimPitch: -0.25 }], player: { pos: [22.0, 0, 11.2], yaw: 1.57, holstered: true, invisible: true } }],
      };
      const p = pins[name]; if (!p) throw new Error('scenes: ' + Object.keys(pins).join(' '));
      window.__menu?.close(); window.__stage(p[0], p[1]); __perf.still(); await __perf.step(settle);
      return name;
    },
    /** after every navigate: hooks up, error capture, harness ports, menu closed, (the cubicles still staged) */
    async boot(stage = true) {
      for (let i = 0; i < 150 && !(window.__engine && window.__runFrames && document.getElementById('view')?.clientWidth > 0); i++) await __pf.yieldTask();
      const dev = E().device; window.__errs = []; dev.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message));
      window.__testVisible = true; window.__shotPort = 5192;
      window.__menu?.close();
      if (stage) await __pf.stageStill();
      return 'ok ' + E().width + 'x' + E().height;
    },
    /** robust interleaved A/B: rounds × n serialized still renders per variant (ABBA order), per-frame per-pass values pooled → median / p25 / p95 (another GPU client inflates
     *  frames, never deflates them: p25–median is the honest band, p95 says how contended the take was); union = timer.unionMs over the compute passes */
    async abMed(applyA, applyB, opts = {}) {
      const { rounds = 4, n = 20, warm = 6, passes = ['direct', 'softblur', 'gather', 'temporal', 'volumetrics', 'taau'], step = false } = opts;
      const t = E().timer; const pool = [new Map(), new Map()]; const sums = [[], []]; const unions = [[], []];
      for (let r = 0; r < rounds; r++) for (let vv = 0; vv < 2; vv++) {
        const v = (r & 1) ? 1 - vv : vv; (v === 0 ? applyA : applyB)();
        for (let i = 0; i < warm + n; i++) {
          const before = t.resolved; if (step) await __perf.step(1); else await __perf.render(1);
          for (let k = 0; k < 200 && t.resolved === before; k++) await __pf.yieldTask();
          if (i < warm || t.resolved === before) continue;
          let s = 0; for (const [k, val] of t.lastFrame) { if (RP.includes(k)) continue; s += val; if (!pool[v].has(k)) pool[v].set(k, []); pool[v].get(k).push(val); }
          sums[v].push(s); unions[v].push(t.unionMs ? t.unionMs(RP) : s);
        }
      }
      applyA();
      const out = {}; for (const k of passes) out[k] = { A: st(pool[0].get(k)), B: st(pool[1].get(k)) }; out.sum = { A: st(sums[0]), B: st(sums[1]) }; out.union = { A: st(unions[0]), B: st(unions[1]) };
      const dn = v => { const a = pool[v].get('softblur') || [], b = pool[v].get('temporal') || []; const m = Math.min(a.length, b.length); const c = []; for (let i = 0; i < m; i++) c.push(a[i] + b[i]); return st(c); };
      out.denoise = { A: dn(0), B: dn(1) };   // softblur + temporal per frame = ALL denoising (either core files its work under those two names)
      out.text = [...passes, 'denoise', 'sum', 'union'].map(k => { const a = out[k]?.A, b = out[k]?.B; return a && b ? `${k.padEnd(12)} A med ${a.med.toFixed(2)} (p25 ${a.p25.toFixed(2)} p95 ${a.p95.toFixed(2)})   B med ${b.med.toFixed(2)} (p25 ${b.p25.toFixed(2)} p95 ${b.p95.toFixed(2)})   Δmed ${(b.med - a.med >= 0 ? '+' : '') + (b.med - a.med).toFixed(2)}` : k + ' -'; }).join('\n') + `\nres ${E().width}x${E().height} → ${E().outWidth}x${E().outHeight} ${window.__quality?.current}`;
      return out;
    },
    /** legacy vs v3 cost on the current scene */
    costAB(opts = {}) { return P3.abMed(() => { S().denoiser = 'legacy'; }, () => { S().denoiser = 'v3'; }, opts).then(r => { S().denoiser = 'v3'; return r; }); },
    /** ×scale crops of the same tiles under each mode after `frames` renders: docs/shots/<prefix>_<tile>_<mode>.jpg */
    async abTiles(prefix, tiles, opts = {}) {
      const { frames = 60, modes = ['legacy', 'v3'], scale = 3, apply = null } = opts; const out = {};
      for (const mode of modes) {
        if (apply) await apply(mode); else S().denoiser = mode;
        await __perf.render(frames);
        const fr = await __perf.readback();
        for (const [name, x, y, w, h] of tiles) out[name + '_' + mode] = await __perf.crop(`${prefix}_${name}_${mode}`, x, y, w, h, scale, 0.9, fr);
      }
      S().denoiser = 'v3';
      return out;
    },
    /** temporal sd (8-bit luma) per tile under each mode: settle, then `frames` still renders */
    async sdAB(tiles, opts = {}) {
      const { frames = 30, settle = 60, modes = ['legacy', 'v3'], apply = null } = opts; const out = {};
      for (const mode of modes) {
        if (apply) await apply(mode); else S().denoiser = mode;
        await __perf.render(settle);
        for (const [name, x, y, w, h] of tiles) { const r = await __perf.temporalStats(x, y, w, h, { frames, thr: 4 }); out[`${name}_${mode}`] = r.ldr; }
      }
      S().denoiser = 'v3';
      out.text = tiles.map(([n]) => { const a = out[n + '_legacy'], b = out[n + '_v3']; return a && b ? `${n.padEnd(14)} legacy sd ${a.sd.toFixed(3)} |Δ| ${a.meanAbsDelta.toFixed(3)}   v3 sd ${b.sd.toFixed(3)} |Δ| ${b.meanAbsDelta.toFixed(3)}   (${(b.sd / Math.max(a.sd, 1e-6)).toFixed(2)}×)` : n; }).join('\n');
      return out;
    },
    /** mean linear luminance of a tile of the LDR readback (bias checks: large flat-ish tiles, converged) under each mode */
    async meanAB(tiles, opts = {}) {
      const { settle = 90, modes = ['legacy', 'v3'] } = opts; const out = {};
      for (const mode of modes) {
        S().denoiser = mode; await __perf.render(settle);
        const fr = await __perf.readback(); const W = fr.w;
        for (const [name, x, y, w, h] of tiles) { let s = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * W + x + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } out[`${name}_${mode}`] = +(s / (w * h)).toFixed(3); }
      }
      S().denoiser = 'v3';
      out.text = tiles.map(([n]) => `${n.padEnd(14)} legacy ${out[n + '_legacy']}  v3 ${out[n + '_v3']}  (${((out[n + '_v3'] / Math.max(out[n + '_legacy'], 1e-6) - 1) * 100).toFixed(1)} %)`).join('\n');
      return out;
    },
    /** CONVERGENCE after every switchable light group goes off at once: per frame, the mean luma of `tile` (LDR) relative to frame 0's; frames to reach 10 % above the settled level.
     *  Runs under `mode`; restores the groups. */
    async lightsOff(tile, mode, opts = {}) {
      const { frames = 40, settle = 60 } = opts; const g = window.__game; S().denoiser = mode;
      const groups = [...new Set(E().lights.lights.filter(l => l.group && l.group !== 'test' && l.kind !== 2).map(l => l.group))];
      for (const gr of groups) g.setGroup(gr, true);
      await __perf.step(settle);   // (game steps, not bare renders: setGroup flags the light TARGETS, the lighting update applies them to the LightSet on the next step)
      const lum = fr => { const [x, y, w, h] = tile; let s = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * fr.w + x + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } return s / (w * h); };
      const seq = []; seq.push(lum(await __perf.readback()));
      for (const gr of groups) g.setGroup(gr, false);
      for (let f = 0; f < frames; f++) { await __perf.step(1); seq.push(lum(await __perf.readback())); }
      const end = seq[seq.length - 1], start = seq[0];
      const rel = seq.map(v => (v - end) / Math.max(start - end, 1e-6));
      let to50 = -1, to10 = -1, to2 = -1; for (let i = 1; i < rel.length; i++) { if (to50 < 0 && rel[i] <= 0.5) to50 = i; if (to10 < 0 && rel[i] <= 0.1) to10 = i; if (to2 < 0 && rel[i] <= 0.02) to2 = i; }
      for (const gr of groups) g.setGroup(gr, true);
      await __perf.step(10); S().denoiser = 'v3';
      return { mode, start: +start.toFixed(2), end: +end.toFixed(2), to50, to10, to2, rel: rel.slice(0, 24).map(v => +v.toFixed(3)) };
    },
    /** mean over `frames` still renders of a LINEAR texture's luminance (getTex() each frame, e.g. () => passes.dS[0]) inside tile (x, y, w, h given in that texture's
     *  own texel space) → { mean: Float64Array(w*h), w, h }; `sum2` = a second texture added per frame (dS[1]) */
    async linAvg(getTex, tile, frames, getTex2 = null) {
      const [x, y, w, h] = tile; const acc = new Float64Array(w * h);
      for (let f = 0; f < frames; f++) {
        await __perf.render(1);
        const t = await __perf.readTexture(getTex()); const t2 = getTex2 ? await __perf.readTexture(getTex2()) : null;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * t.w + x + i) * 4; let L = 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; if (t2) L += 0.2126 * t2.data[o] + 0.7152 * t2.data[o + 1] + 0.0722 * t2.data[o + 2]; acc[j * w + i] += L / frames; }
      }
      return { mean: acc, w, h };
    },
    /** BIAS / ERROR of the denoised DIRECT light against a many-frame reference of the raw estimator, in tile (full-res px): reference = the penumbra filter switched off
     *  (FrameFlags.SoftShadow down: dS holds the raw S every frame; the sampling pattern still advances) averaged over `refFrames`; then each mode converged and averaged
     *  over `avgFrames`. → per mode: tile-mean relative bias, per-pixel RMSE ÷ tile mean, and the 95th-percentile |error| ÷ mean. */
    async directRef(tile, opts = {}) {
      const { refFrames = 160, avgFrames = 12, settle = 60 } = opts; const e = E(), s = S(); const P = e.passes;
      const SOFT = 512; const flags0 = s.flags;
      s.flags = flags0 & ~SOFT; await __perf.render(4);
      const ref = await P3.linAvg(() => P.dS[0], tile, refFrames, () => P.dS[1]);
      s.flags = flags0;
      const out = { tile, refMean: 0 }; let rm = 0; for (const v of ref.mean) rm += v; rm /= ref.mean.length; out.refMean = +rm.toExponential(3);
      for (const mode of ['legacy', 'v3']) {
        s.denoiser = mode; await __perf.render(settle);
        const got = await P3.linAvg(() => P.dS[0], tile, avgFrames, () => P.dS[1]);
        let gm = 0, se = 0; const errs = [];
        for (let k = 0; k < got.mean.length; k++) { gm += got.mean[k]; const d = got.mean[k] - ref.mean[k]; se += d * d; errs.push(Math.abs(d)); }
        gm /= got.mean.length; errs.sort((a, b) => a - b);
        out[mode] = { bias: +((gm / rm - 1) * 100).toFixed(2), rmseRel: +(Math.sqrt(se / got.mean.length) / rm * 100).toFixed(2), p95Rel: +(errs[Math.floor(0.95 * (errs.length - 1))] / rm * 100).toFixed(2) };
      }
      s.denoiser = 'v3';
      out.text = `direct vs raw reference (${refFrames} fr) tile ${tile.join(',')}: legacy bias ${out.legacy.bias} % rmse ${out.legacy.rmseRel} % p95 ${out.legacy.p95Rel} %  ·  v3 bias ${out.v3.bias} % rmse ${out.v3.rmseRel} % p95 ${out.v3.p95Rel} %`;
      return out;
    },
    /** the same for the INDIRECT: reference = the raw gather texture (passes.indirect, pre-temporal) averaged; result = gi[0] (what composite upsamples). Tile in GATHER texels. */
    async indirectRef(tile, opts = {}) {
      const { refFrames = 200, avgFrames = 12, settle = 60 } = opts; const s = S(); const P = E().passes;
      const ref = await P3.linAvg(() => P.indirect, tile, refFrames);
      const out = { tile }; let rm = 0; for (const v of ref.mean) rm += v; rm /= ref.mean.length; out.refMean = +rm.toExponential(3);
      for (const mode of ['legacy', 'v3']) {
        s.denoiser = mode; await __perf.render(settle);
        const got = await P3.linAvg(() => P.gi[0], tile, avgFrames);
        let gm = 0, se = 0; const errs = [];
        for (let k = 0; k < got.mean.length; k++) { gm += got.mean[k]; const d = got.mean[k] - ref.mean[k]; se += d * d; errs.push(Math.abs(d)); }
        gm /= got.mean.length; errs.sort((a, b) => a - b);
        out[mode] = { bias: +((gm / rm - 1) * 100).toFixed(2), rmseRel: +(Math.sqrt(se / got.mean.length) / rm * 100).toFixed(2), p95Rel: +(errs[Math.floor(0.95 * (errs.length - 1))] / rm * 100).toFixed(2) };
      }
      s.denoiser = 'v3';
      out.text = `indirect vs raw reference (${refFrames} fr) tile ${tile.join(',')}: legacy bias ${out.legacy.bias} % rmse ${out.legacy.rmseRel} % p95 ${out.legacy.p95Rel} %  ·  v3 bias ${out.v3.bias} % rmse ${out.v3.rmseRel} % p95 ${out.v3.p95Rel} %`;
      return out;
    },
    /** temporal sd of a LINEAR texture's luminance in a tile over `frames` (relative to the tile mean) under each mode — the denoiser's own output noise, before composite / TAAU */
    async linSdAB(getTex, tile, opts = {}) {
      const { frames = 30, settle = 60, getTex2 = null } = opts; const s = S(); const out = {};
      for (const mode of ['legacy', 'v3']) {
        s.denoiser = mode; await __perf.render(settle);
        const [x, y, w, h] = tile; const n = w * h; const s1 = new Float64Array(n), s2 = new Float64Array(n);
        for (let f = 0; f < frames; f++) {
          await __perf.render(1);
          const t = await __perf.readTexture(getTex()); const t2 = getTex2 ? await __perf.readTexture(getTex2()) : null;
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * t.w + x + i) * 4; let L = 0.2126 * t.data[o] + 0.7152 * t.data[o + 1] + 0.0722 * t.data[o + 2]; if (t2) L += 0.2126 * t2.data[o] + 0.7152 * t2.data[o + 1] + 0.0722 * t2.data[o + 2]; s1[j * w + i] += L; s2[j * w + i] += L * L; }
        }
        let mean = 0, sd = 0; for (let k = 0; k < n; k++) { const m = s1[k] / frames; mean += m; sd += Math.sqrt(Math.max(0, s2[k] / frames - m * m)); }
        out[mode] = { mean: +(mean / n).toExponential(3), relSd: +((sd / n) / Math.max(mean / n, 1e-9) * 100).toFixed(2) };
      }
      s.denoiser = 'v3';
      out.text = `linear temporal sd (% of tile mean): legacy ${out.legacy.relSd}  v3 ${out.v3.relSd}  (${(out.v3.relSd / Math.max(out.legacy.relSd, 1e-6)).toFixed(2)}×)`;
      return out;
    },
    // ---- GHOSTING scenarios: the same deterministic sequence re-run per variant, crops of the same tile at the same frame indices ----
    /** the variants every ghost test compares: legacy · v3 with motion vectors · v3 camera-only */
    variants: { legacy: () => { S().denoiser = 'legacy'; }, v3: () => { S().denoiser = 'v3'; S().dnMotionVectors = true; }, v3nomv: () => { S().denoiser = 'v3'; S().dnMotionVectors = false; } },
    /** A man sliding along the corridor past its lit north wall, torch on, camera still: guard 0 from x0 → at `speed` m/s for `frames`; crops (`prefix_strafe_f<k>_<variant>`) of a tile round him
     *  at each frame in `at`. Kinematic slide (his pose is the idle: the g-buffer's motion vectors come from the transforms actually drawn, however he got there). */
    async strafe(prefix, opts = {}) {
      const { variants = ['legacy', 'v3', 'v3nomv'], frames = 16, at = [6, 8, 12], speed = 3.2, x0 = 16.6, z = 16.8, scale = 3, tileW = 340, tileH = 300, settle = 40 } = opts;
      const g = window.__game, DEG = Math.PI / 180; const out = {};
      for (const v of variants) {
        P3.variants[v]();
        // the cubicles still view (open floor, panels above, partitions and desks for his torch to sweep): the man slides +x across it, torch lit and pointing +z (down the frame)
        window.__stage({ look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, { park: true, guards: [{ i: 0, pos: [x0, 0, z], yaw: 0, torch: true, aimPitch: -0.3 }], player: { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } });
        __perf.still(); await __perf.step(settle);
        const gd = g.guards[0];
        for (let f = 1; f <= frames; f++) {
          gd.char.pos = [x0 + speed * f / 60, 0, z];
          await __perf.step(1);
          if (at.includes(f)) {
            const fr = await __perf.readback(); const p = __perf.project([gd.char.pos[0], 0.9, gd.char.pos[2]]);
            const sx = fr.w / __engine.width, sy = fr.h / __engine.height;   // project() is in internal px; the readback is the OUTPUT frame under TAAU
            const cx = Math.round(p[0] * sx), cy = Math.round(p[1] * sy);
            const x = Math.max(0, Math.min(fr.w - tileW, cx - Math.round(tileW * 0.55))), y = Math.max(0, Math.min(fr.h - tileH, cy - Math.round(tileH * 0.45)));
            out[`f${f}_${v}`] = await __perf.crop(`${prefix}_strafe_f${f}_${v}`, x, y, tileW, tileH, scale, 0.9, fr);
          }
        }
      }
      P3.variants.v3();
      return out;
    },
    /** A door swinging open with light behind it (the storage room's bulb into the dark corridor, or any `door` by name): angle 0 → `open` rad over `frames`, crops of the doorway tile
     *  at frames `at` per variant + the mean luma of the spill tile per frame (immediacy: the curve must not lag between variants). */
    async doorSpill(prefix, opts = {}) {
      const { door = 'storage', variants = ['legacy', 'v3'], frames = 14, at = [2, 4, 8], open = 1.45, scale = 3, settle = 40 } = opts;
      const g = window.__game, DEG = Math.PI / 180; const out = { curves: {} };
      const d = g.doors.byName(door); if (!d) return { error: 'no door ' + door + ' — names: ' + g.doors.list.map(x => x.def.name).join(',') };
      const h = d.def.hinge, w = d.def.width;
      for (const v of variants) {
        P3.variants[v]();
        d.reset?.(); d.angle = 0; d.vel = 0; d.latched = true;
        // steep, from the corridor side: the leaf swings into the corridor and the room's bulb spills across the corridor floor to the far wall (a 55° pitch frames the corridor's own wall)
        window.__stage({ look: [h[0] + 0.5, 0, h[1] + 0.9], yaw: 0, pitch: 75 * DEG, dist: 7 }, { park: true, player: { pos: [14, 0, 22], yaw: 1.57, holstered: true, invisible: true } });
        __perf.still(); await __perf.step(settle);
        const curve = [];
        const tileOf = fr => { const sx = fr.w / __engine.width; const a = __perf.project([h[0] + w * 0.5, 0.02, h[1] + 0.15]), b = __perf.project([h[0] + w * 0.8, 0.02, h[1] + 2.0]); const xs = [a[0] * sx, b[0] * sx], ys = [a[1] * sx, b[1] * sx]; const tw = 360, th = Math.min(fr.h, Math.round(Math.abs(ys[1] - ys[0]) + 120)); const cx = Math.round((xs[0] + xs[1]) / 2), cy = Math.round((ys[0] + ys[1]) / 2); return [Math.max(0, Math.min(fr.w - tw, cx - tw / 2)), Math.max(0, Math.min(fr.h - th, cy - Math.round(th / 2))), tw, th]; };
        for (let f = 1; f <= frames; f++) {
          d.latched = false; d.angle = open * Math.min(1, f / (frames * 0.6)); d.vel = 0;
          await __perf.step(1);
          const fr = await __perf.readback(); const [x, y, tw, th] = tileOf(fr);
          let s = 0; for (let j = 0; j < th; j += 2) for (let i = 0; i < tw; i += 2) { const o = ((y + j) * fr.w + x + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } curve.push(+(s / (tw * th / 4)).toFixed(2));
          if (at.includes(f)) out[`f${f}_${v}`] = await __perf.crop(`${prefix}_door_f${f}_${v}`, x, y, tw, th, scale, 0.9, fr);
        }
        out.curves[v] = curve;
        d.angle = 0; d.vel = 0; d.latched = true;
      }
      P3.variants.v3();
      return out;
    },
    /** MUZZLE FLASH: Sam fires his pistol once at a wall; crops of the tile round him on the flash frame and the frames after (any residue = history contamination) + the tile's mean luma per frame per variant. */
    async muzzle(prefix, opts = {}) {
      const { variants = ['legacy', 'v3'], after = 6, scale = 3, settle = 40 } = opts;
      const g = window.__game, DEG = Math.PI / 180; const out = { curves: {} };
      for (const v of variants) {
        P3.variants[v]();
        window.__stage({ look: [20.5, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 8 }, { park: true, player: { pos: [20.5, 0, 17.5], yaw: 0, holstered: false, invisible: true } });
        g.godMode = true; g.player.pistol && (g.player.pistol.chamber = 1);
        __perf.still(); await __perf.step(settle);
        const p0 = __perf.project([20.5, 0.5, 17.5]);
        const curve = [];
        for (let f = 0; f <= after; f++) {
          if (f === 0) { window.__mouse(__engine.gpu.canvas.clientWidth * 0.75, __engine.gpu.canvas.clientHeight * 0.5); window.__click(0); }
          await __perf.step(1);
          const fr = await __perf.readback(); const sx = fr.w / __engine.width; const cx = Math.round(p0[0] * sx), cy = Math.round(p0[1] * sx); const tw = 360, th = 280;
          const x = Math.max(0, Math.min(fr.w - tw, cx - tw / 2)), y = Math.max(0, Math.min(fr.h - th, cy - th / 2));
          let s = 0; for (let j = 0; j < th; j += 2) for (let i = 0; i < tw; i += 2) { const o = ((y + j) * fr.w + x + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; } curve.push(+(s / (tw * th / 4)).toFixed(2));
          if (f <= 3) out[`f${f}_${v}`] = await __perf.crop(`${prefix}_muzzle_f${f}_${v}`, x, y, tw, th, scale, 0.9, fr);
        }
        out.curves[v] = curve;
      }
      P3.variants.v3(); window.__game.godMode = false;
      return out;
    },
    /** BLACKOUT + RESTRIKE: the mains cut for `secs`, mean luma of a big tile per frame across the cut and the restore, per variant (the curves should overlay: U is exact either way). */
    async blackout(opts = {}) {
      const { variants = ['legacy', 'v3'], frames = 30, settle = 40 } = opts;
      const g = window.__game; const out = {};
      for (const v of variants) {
        P3.variants[v](); await __pf.stageStill(); await __perf.step(settle);
        const curve = []; const lum = fr => { let s = 0, n = 0; for (let j = 100; j < fr.h - 100; j += 4) for (let i = 100; i < fr.w - 100; i += 4) { const o = (j * fr.w + i) * 4; s += 0.2126 * fr.data[o] + 0.7152 * fr.data[o + 1] + 0.0722 * fr.data[o + 2]; n++; } return +(s / n).toFixed(2); };
        for (let f = 0; f < frames; f++) { if (f === 4) g.setBlackout(0.25, 'debug'); await __perf.step(1); curve.push(lum(await __perf.readback())); }
        out[v] = curve; if (g.blackout?.active) g.endBlackout();
        await __perf.step(90);   // let the restrike finish before the next variant
      }
      P3.variants.v3();
      return out;
    },
    /** GPU VALIDATION SWEEP under the current preset: an error scope + the uncaptured list across plain frames, every debug view, a render-scale step down and back (histories
     *  pooled + resampled), gloss on / off, night vision, TAAU off / on, legacy ↔ v3, temporal flag off / on. → { errors: [...], steps: n } */
    async validate() {
      const e = E(), s = S(), dev = e.device; const errs = []; const before = (window.__errs || []).length;
      dev.pushErrorScope('validation');
      const step = async (n = 3) => { for (let i = 0; i < n; i++) await __perf.render(1); };
      let steps = 0;
      await step(4); steps++;
      for (const dv of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0]) { s.debugView = dv; await step(2); steps++; }
      const sc0 = s.renderScale; s.renderScale = Math.max(0.5, sc0 - 0.25); await step(4); s.renderScale = sc0; await step(4); steps += 2;
      const gl0 = s.gloss; s.gloss = true; await step(6); s.gloss = false; await step(3); s.gloss = gl0; steps += 2;
      const nv0 = s.nvAmount; s.nvAmount = 1; await step(3); s.nvAmount = nv0; steps++;
      const ta0 = s.taau; s.taau = !ta0; await step(4); s.taau = ta0; await step(4); steps += 2;
      s.denoiser = 'legacy'; await step(4); s.denoiser = 'v3'; await step(4); steps += 2;
      const fl0 = s.flags; s.flags = fl0 & ~2048; await step(3); s.flags = fl0; await step(3); steps += 2;   // FrameFlags.Temporal off / on
      const dh0 = s.directHistory; s.directHistory = 0; await step(3); s.directHistory = dh0; await step(2); steps += 2;
      for (const it of [1, 5]) { s.dnShadowIters = it; s.dnGiIters = it; s.dnSpecIters = Math.min(3, it); await step(2); steps++; }
      window.__quality.apply(window.__quality.current); await step(3);
      const err = await dev.popErrorScope(); if (err) errs.push('scope: ' + err.message);
      for (const m of (window.__errs || []).slice(before)) errs.push('uncaptured: ' + m);
      return { preset: window.__quality.current, res: [e.width, e.height, e.outWidth, e.outHeight], steps, errors: errs, realloc: e.passes.lastRealloc };
    },
    /** the deterministic still for identity hashes: seeded dice, parked guards, zeroed phases, clocks reset, `frames` steps → FNV hash of the LDR readback */
    async identityHash(frames = 40) {
      let seed = 4242; Math.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.__menu?.close();
      const DEG = Math.PI / 180;
      window.__stage({ look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, { park: true, player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
      __perf.still(); E().passes.grain = 0;
      window.__resetClock();
      window.__runFrames(frames, 1 / 60);
      await E().device.queue.onSubmittedWorkDone();
      E().render(window.__cam, 100, 1 / 60, false);
      const fr = await __perf.readback();
      return { hash: __perf.hash(fr), res: [fr.w, fr.h], denoiser: S().denoiser ?? '(none: main)', taau: S().taau };
    },
  };
  window.__p3 = P3;
  return 'p3 harness ready: __p3.{boot,abMed,costAB,abTiles,sdAB,meanAB,lightsOff,linAvg,directRef,indirectRef,linSdAB,strafe,doorSpill,muzzle,blackout,validate,identityHash}';
})();
