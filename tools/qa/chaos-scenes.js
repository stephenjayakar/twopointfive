// FAST-PHYSICS scenes (image-quality program, docs/internal/image-quality.md §1e — the maintainer's question: twopointfive's fast physics made the direct light
// noisy; how much of that is here?). Six deterministic scenes on a `?paused&quality=<p>&mute` boot, each captured frame by frame under any renderer configuration
// and graded AGAINST A HISTORY-FREE REFERENCE render of the very same game frames (variant 'ref' below: the pre-v3 chain at scale 1.0 with the direct light's
// history off and the gather's temporal flag down — every frame stands alone), on the SAME output grid:
//   P1  KICKED DOOR — the storage door kicked in from the corridor with the storage bulb off: the corridor panels light a wedge on the storage floor through the
//       opening as the leaf flings (Doors.kickIn: 9 rad/s ≈ 8 m/s at the tip); camera on the floor inside. 30 frames from impact.
//   P2  CANISTER thrown across the desk-lamp pool (the sharp lane's V1): a stun can that never fires, 5 m/s across the manager's desk between lamp and desk top.
//   P2b the same can through a torch beam in the corridor's haze (V2's fixed spot): the froxel case.
//   P3  RAGDOLL — a guard staged in the desk lamp's spill, dropped by one round: he folds through the pool.
//   P4  CHAIR shoved through the panels' light in the cubicles (desk A's chair, 3 m/s along +x).
//   P5  CHURN — P2's throw while 6 mags + 4 cans spawn and go within 20 frames: the dynamic list reorders under a flying object (index-matched motion vectors).
//   P6  CHAOS SCALE — N ∈ {8, 16, 32, 64} debris boxes tumbling for 3 s in the cubicles' aisle (own seeded integrator on game.fx boxes) — cost + the same metrics vs N.
// Metrics per frame k (0 = the event) over the scene's ROI, on RECEIVER pixels (static geometry in every frame of BOTH the run and the reference — the g-buffer's id
// read back, dynamic boxes and men dilated 2 px and excluded): rmse vs the reference; ghost = mean |Δ| on pixels the reference says did not change since k−1;
// lagArea = receiver px off the reference by > 8 levels; sweep = px the reference itself changed by > 8 since k−1 → trailFrames = lagArea ∕ sweep (how many
// frames of the shadow's sweep the picture trails); onObj = mean |Δ| on the moving object's own pixels (smear); + boil map (max − min over the take) of run and
// reference; + per-frame GPU pass times (P6). Crops of frames +1 / +2 / +4 / +8 and the |Δ| heat map are posted for the page.
//     await import('/qa/chaos-scenes.js'); await __chaos.boot(); await __chaos.run('P1', 'ref'); r = await __chaos.run('P1', 'main'); __chaos.text('P1')
(async () => {
  if (!window.__iq) { await import('/qa/iq-harness.js'); for (let i = 0; i < 200 && !window.__iq; i++) await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); }
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  const mean = a => { let s = 0, n = 0; for (const v of a) { if (v === null || v === undefined || Number.isNaN(v)) continue; s += v; n++; } return n ? s / n : NaN; };
  const r3 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : +v.toFixed(3);
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // THE REFERENCE: every v3 history off — the leader / tail direct estimator (no reservoirs) with the direct term's history at 0 (dtemporal skipped), softblur (spatial only), the gather's temporal
  // accumulation flag down, the per-pixel volumetric march (no froxel history), no reflection pass (its specular history), no TAA (FXAA at scale 1.0). Rendered on the same OUTPUT grid.
  const TEMPORAL = 2048;
  const REF = { taau: false, restir: false, denoiser: 'legacy', froxelVol: false, rtReflect: false, directHistory: 0, renderScale: 1.0 };
  function applyRef() { const r = window.__iq.apply(REF); S().flags = S().flags & ~TEMPORAL; return r; }
  function applyVar(v, extra) { const r = window.__iq.apply(v, extra); if (flags0 !== null) S().flags = flags0; return r; }
  let flags0 = null;

  // ------------------------------------------------------------------ readbacks: the LDR frame + the g-buffer's id (whose box each pixel shows)
  async function readback() { return window.__iq.readback(); }
  // the id target has no COPY_SRC usage: a four-line kernel of our own reads it into a storage buffer (nothing of the renderer's is touched)
  let idPipe = null, idBufs = null;
  async function readIds() {   // the id target as drawn (the OUTPUT-size one under sharp direct, else internal): Uint32 per texel + its size
    const gb = E().gbuffer; const tex = (E().sharpOn && gb.idO) ? gb.idO : gb.id; const w = tex.width, h = tex.height; const dev = E().device;
    if (!idPipe) {
      const mod = dev.createShaderModule({ code: 'struct D { w: u32, h: u32 }; @group(0) @binding(0) var t: texture_2d<u32>; @group(0) @binding(1) var<storage, read_write> o: array<u32>; @group(0) @binding(2) var<uniform> d: D;\n@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) g: vec3u) { if (g.x >= d.w || g.y >= d.h) { return; } o[g.y * d.w + g.x] = textureLoad(t, vec2i(g.xy), 0).x; }' });
      idPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
    }
    if (!idBufs || idBufs.n < w * h) { if (idBufs) { idBufs.st.destroy(); idBufs.rd.destroy(); } idBufs = { n: w * h, st: dev.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }), rd: dev.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), u: dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }) }; }
    dev.queue.writeBuffer(idBufs.u, 0, new Uint32Array([w, h, 0, 0]));
    const bg = dev.createBindGroup({ layout: idPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: tex.createView() }, { binding: 1, resource: { buffer: idBufs.st } }, { binding: 2, resource: { buffer: idBufs.u } }] });
    const enc = dev.createCommandEncoder(); const p = enc.beginComputePass(); p.setPipeline(idPipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end();
    enc.copyBufferToBuffer(idBufs.st, 0, idBufs.rd, 0, w * h * 4); dev.queue.submit([enc.finish()]);
    await idBufs.rd.mapAsync(GPUMapMode.READ); const data = new Uint32Array(idBufs.rd.getMappedRange(0, w * h * 4).slice(0)); idBufs.rd.unmap();
    return { w, h, data };
  }
  /** dynamic-coverage mask of an OUTPUT-px rect: 1 where the pixel (or anything within `dil` px) shows a dynamic box (index ≥ statics) or a character */
  function dynMask(ids, fr, r, nStat, dil = 2) {
    const m = new Uint8Array(r.w * r.h); const kx = ids.w / fr.w, ky = ids.h / fr.h;
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const tx = Math.min(ids.w - 1, Math.floor((r.x + i + 0.5) * kx)), ty = Math.min(ids.h - 1, Math.floor((r.y + j + 0.5) * ky)); const id = ids.data[ty * ids.w + tx]; const isChar = ((id >>> 28) & 1) === 1; const bi = id & 0xFFFFF; if (isChar || (bi !== 0xFFFFF && bi >= nStat && id !== 0xFFFFFFFF)) m[j * r.w + i] = 1; }
    if (dil <= 0) return m;
    const o = new Uint8Array(r.w * r.h);
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { let v = 0; for (let dj = -dil; dj <= dil && !v; dj++) for (let di = -dil; di <= dil; di++) { const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue; if (m[y * r.w + x]) { v = 1; break; } } o[j * r.w + i] = v; }
    return o;
  }
  function tileLumas(fr, r) { const out = new Float32Array(r.w * r.h); for (let j = 0; j < r.h; j++) { let o = ((r.y + j) * fr.w + r.x) * 4; for (let i = 0; i < r.w; i++, o += 4) out[j * r.w + i] = luma(fr.data, o); } return out; }
  const rectOf = (t, fr) => { const k = fr.h / 1000; const w = Math.round(t[2] * k), h = Math.round(t[3] * k); const cx = Math.round(t[0] * k), cy = Math.round(t[1] * k); return { x: Math.max(0, Math.min(fr.w - w, cx - (w >> 1))), y: Math.max(0, Math.min(fr.h - h, cy - (h >> 1))), w, h }; };
  async function postCanvas(name, c, q = 0.88) { const blob = await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q)); const port = Number(window.__shotPort) || 5174; try { const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return `${name}.jpg ${c.width}x${c.height} → ${r.status}`; } catch (e) { return `${name}: ${e}`; } }
  async function postCrop(name, fr, r, scale = 3) { const c = document.createElement('canvas'); c.width = r.w * scale; c.height = r.h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height); for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const so = ((r.y + Math.floor(j / scale)) * fr.w + (r.x + Math.floor(i / scale))) * 4, o = (j * c.width + i) * 4; img.data[o] = fr.data[so]; img.data[o + 1] = fr.data[so + 1]; img.data[o + 2] = fr.data[so + 2]; img.data[o + 3] = 255; } cx.putImageData(img, 0, 0); return postCanvas(name, c); }
  async function postField(name, field, w, h, gain = 1, scale = 3) { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height); for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const v = Math.max(0, Math.min(255, Math.round(field[Math.floor(j / scale) * w + Math.floor(i / scale)] * gain))); const o = (j * c.width + i) * 4; img.data[o] = v; img.data[o + 1] = Math.round(v * 0.55); img.data[o + 2] = 0; img.data[o + 3] = 255; } cx.putImageData(img, 0, 0); return postCanvas(name, c); }

  // ------------------------------------------------------------------ P6's debris: own integrator on game.fx boxes (seeded; nothing of the game's dice)
  const debris = { list: [], rnd: null };
  function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
  function qnorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  function spawnDebris(N, seed = 777, area = { x0: 18.6, x1: 20.6, z0: 17.2, z1: 20.2 }) {
    clearDebris(); const rnd = debris.rnd = mulberry32(seed); const g = G();
    for (let i = 0; i < N; i++) {
      const hs = 0.03 + rnd() * 0.045; const h = [hs * (0.7 + 0.6 * rnd()), hs * (0.5 + 0.5 * rnd()), hs * (0.7 + 0.6 * rnd())];
      const box = { c: [area.x0 + rnd() * (area.x1 - area.x0), 1.0 + rnd() * 1.2, area.z0 + rnd() * (area.z1 - area.z0)], h, yaw: 0, rot: [0, 0, 0, 1], albedo: [0.25 + 0.5 * rnd(), 0.25 + 0.5 * rnd(), 0.25 + 0.5 * rnd()], emissive: [0, 0, 0], flags: 8 /* Dynamic */, owner: 0, cutHeight: 1e6, name: 'debris' + i, mkey: 0x5000 + i };
      const d = { box, v: [(rnd() - 0.5) * 6, 1 + rnd() * 3, (rnd() - 0.5) * 6], w: [(rnd() - 0.5) * 20, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20], rest: false, fx: { box, ttl: 1e9 } };
      debris.list.push(d); g.fx.push(d.fx);
    }
    return debris.list.length;
  }
  function stepDebris(dt = 1 / 60) {
    for (const d of debris.list) {
      if (d.rest) continue;
      d.v[1] -= 9.81 * dt; const c = d.box.c; c[0] += d.v[0] * dt; c[1] += d.v[1] * dt; c[2] += d.v[2] * dt;
      const hy = Math.max(d.box.h[0], d.box.h[1], d.box.h[2]);
      if (c[1] < hy) { c[1] = hy; if (d.v[1] < 0) d.v[1] = -d.v[1] * 0.42; d.v[0] *= 0.72; d.v[2] *= 0.72; d.w = d.w.map(x => x * 0.6); if (Math.abs(d.v[1]) < 0.4 && Math.hypot(d.v[0], d.v[2]) < 0.3) { d.rest = true; d.v = [0, 0, 0]; d.w = [0, 0, 0]; } }
      const wl = Math.hypot(...d.w); if (wl > 1e-6) { const a = wl * dt; const s = Math.sin(a / 2) / wl; d.box.rot = qnorm(qmul([d.w[0] * s, d.w[1] * s, d.w[2] * s, Math.cos(a / 2)], d.box.rot)); }
    }
  }
  function clearDebris() { const g = G(); for (const d of debris.list) { const i = g.fx.indexOf(d.fx); if (i >= 0) g.fx.splice(i, 1); } debris.list.length = 0; }

  // ------------------------------------------------------------------ scenes
  const park = { park: true, player: { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } };
  let can = null, torch = null;
  const SCENES = {
    P0: {   // THE CALM CASE: a man WALKING (1.4 m/s, slid rigidly — his shadow is what is graded, not his gait) through the fixed torch's beam in the corridor (V2): a hard moving shadow on wall + lino
      frames: 40, warm: 40, pin: [{ look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, { park: true, guards: [{ i: 0, pos: [23.9, 0, 11.05], yaw: 3.14, torch: false }], player: { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } }],
      rois: { beam: [760, 430, 600, 400], wall: [560, 200, 300, 300] },
      setup(g) { torchOn(true); },
      act(g, k) { const c = g.guards[0].char; if (k > 0) c.pos = [c.pos[0] - 1.4 / 60, c.pos[1], c.pos[2]]; return +c.pos[0].toFixed(3); },
      teardown() { torchOn(false); },
      speedOf() { return 1.4; },
    },
    P0p: {  // … and the same walk under the corridor PANELS alone (broad emitters: the everyday case — soft shadows, small changes)
      frames: 40, warm: 40, pin: [{ look: [27.2, 0, 11.0], yaw: -15 * DEG, pitch: 52 * DEG, dist: 6.5 }, { park: true, guards: [{ i: 0, pos: [25.9, 0, 11.1], yaw: -1.57, torch: false }], player: { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } }],
      rois: { lino: [900, 560, 800, 420] },
      setup(g) { },
      act(g, k) { const c = g.guards[0].char; if (k > 0) c.pos = [c.pos[0] + 1.4 / 60, c.pos[1], c.pos[2]]; return +c.pos[0].toFixed(3); },
      teardown() { },
      speedOf() { return 1.4; },
    },
    P1: {   // the storage door kicked in from the corridor, storage bulb off: the corridor panels' wedge on the storage floor as the leaf flings
      frames: 45, warm: 40, pin: [{ look: [32.5, 0, 8.9], yaw: 180 * DEG, pitch: 58 * DEG, dist: 6.0 }, park],   // inside the dark storage room, high, facing the door wall: the corridor's light comes through the opening as the leaf swings in toward the camera
      rois: { floor: [640, 560, 720, 420], leaf: [1180, 470, 480, 460] },
      setup(g) { g.setGroup('storage', false); const d = g.doors.byName('storage'); d.reset(); S().exposure = 5.0; },   // (exposure up for the take: the unlit room's wedge sits a few levels off black at 2.0 — the same for every variant and the reference)
      act(g, k) { const d = g.doors.byName('storage'); if (k === 0) g.doors.kickIn(d, [32.6, 0, 10.7], 0); return +d.angle.toFixed(3); },
      teardown(g) { g.setGroup('storage', true); g.doors.byName('storage').reset(); S().exposure = 2.0; },
      speedOf(g) { const d = g.doors.byName('storage'); return Math.abs(d.vel) * d.def.width; },   // leaf tip m/s
    },
    P2: {   // a stun can (fuse never runs out) thrown across the manager's desk between the lamp and the desk top: its shadow sweeps the pool
      frames: 30, warm: 40, pin: [{ look: [26.62, 0.5, 6.22], yaw: -20 * DEG, pitch: 60 * DEG, dist: 3.4 }, park],
      rois: { desk: [880, 470, 700, 380], floor: [420, 760, 500, 300] },
      setup(g) { rmCans(g); },
      act(g, k) { if (k === 0) can = g.items.spawn('flash', [25.75, 0.87, 6.35], [4.6, 0.9, -0.12], { fuse: 1e9, life: 1e9, yaw: 0.3, spin: 9, tumble: 0, tumbleRate: 11 }); /* ten centimetres over the desk top, under the lamp: its shadow right beneath it, sweeping the pool, a bounce mid-desk */ return can ? +can.pos[0].toFixed(2) : 0; },
      teardown(g) { rmCans(g); },
      speedOf() { return can ? Math.hypot(...can.vel) : 0; },
    },
    P2b: {  // the same can through the fixed torch's beam in the corridor haze (the sharp lane's V2 spot)
      frames: 30, warm: 40, pin: [{ look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, park],
      rois: { beam: [760, 430, 600, 400], wall: [560, 200, 300, 300] },
      setup(g) { rmCans(g); torchOn(true); },
      act(g, k) { if (k === 0) can = g.items.spawn('flash', [25.0, 0.8, 11.0], [-4.5, 1.5, 0.0], { fuse: 1e9, life: 1e9, yaw: 0.3, spin: 9, tumble: 0, tumbleRate: 11 }); return can ? +can.pos[0].toFixed(2) : 0; },   /* along the corridor at knee height: it crosses the beam's core (x 23.3, y 0.8 at z 11) mid-flight */
      teardown(g) { rmCans(g); torchOn(false); },
      speedOf() { return can ? Math.hypot(...can.vel) : 0; },
    },
    P3: {   // a guard standing IN the fixed torch's beam (V2), one round: he folds through it, his hard shadow on wall and lino with him (god mode irrelevant: nobody shoots back at an invisible man)
      frames: 40, warm: 40, pin: [{ look: [22.6, 0.3, 10.9], yaw: -75 * DEG, pitch: 40 * DEG, dist: 5.5 }, { park: true, guards: [{ i: 0, pos: [23.15, 0, 11.0], yaw: 1.4, torch: false }], player: { pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } }],
      rois: { beam: [760, 430, 600, 400], wall: [560, 200, 300, 300] },
      setup(g) { torchOn(true); },
      act(g, k) { if (k === 0) window.__killGuard(0, 'shot'); const c = g.guards[0].char; return +(c.bones?.hips?.[1] ?? c.pos[1]).toFixed(3); },
      teardown(g) { torchOn(false); /* the next __stage parks him; restartEncounter would touch histories */ },
      speedOf(g) { const c = g.guards[0].char; return Math.hypot(...(c.vel || [0, 0, 0])); },
    },
    P4: {   // desk A's chair shoved along +x through the panels' light (props.ts: a velocity, the solver does the rest)
      frames: 36, warm: 40, pin: [{ look: [22.5, 0.4, 16.4], yaw: -20 * DEG, pitch: 55 * DEG, dist: 8.0 }, park],
      rois: { lane: [900, 560, 760, 380] },
      setup(g) { g.props.reset(); },
      act(g, k) { const p = chairA(g); if (k === 0 && p) { p.vx = 3.2; p.vz = 0.3; p.w = 2.0; p.wake(); } return p ? +p.x.toFixed(3) : 0; },
      teardown(g) { g.props.reset(); },
      speedOf(g) { const p = chairA(g); return p ? p.speed : 0; },
    },
    P5: {   // CHURN: P2's throw while magazines and cans come and go under it (the dynamic list reorders every few frames)
      frames: 30, warm: 40, pin: [{ look: [26.62, 0.5, 6.22], yaw: -20 * DEG, pitch: 60 * DEG, dist: 3.4 }, park],
      rois: { desk: [880, 470, 700, 380] },
      setup(g) { rmCans(g); },
      act(g, k) {
        if (k === 0) can = g.items.spawn('flash', [25.75, 0.87, 6.35], [4.6, 0.9, -0.12], { fuse: 1e9, life: 1e9, yaw: 0.3, spin: 9, tumble: 0, tumbleRate: 11 }); /* ten centimetres over the desk top, under the lamp: its shadow right beneath it, sweeping the pool, a bounce mid-desk */
        if (k >= 2 && k <= 12 && (k % 2) === 0) g.items.spawn('mag', [24.6 + 0.3 * k, 0.5, 4.6], [0.5, 0, 0.5], { life: (k % 4) === 0 ? 0.05 : 30, fill: 0.5 });   // out of shot: half of them die three frames later
        if (k === 3 || k === 6 || k === 9 || k === 12) g.items.spawn('smoke', [24.2, 0.3, 4.4 + 0.1 * k], [0, 0, 0], { fuse: 1e9, life: k === 6 || k === 12 ? 0.05 : 30, emitT: 0 });
        if (k === 5 || k === 10) { const i = g.items.items.findIndex(x => x.kind === 'mag'); if (i >= 0) g.items.items.splice(i, 1); }
        return g.items.items.length;
      },
      teardown(g) { rmCans(g); },
      speedOf() { return can ? Math.hypot(...can.vel) : 0; },
    },
    P6: {   // CHAOS SCALE: N debris boxes tumbling in the aisle by the tan cluster for 3 s (opts.N)
      frames: 60, warm: 30, pin: [{ look: [19.6, 0.3, 18.7], yaw: 200 * DEG, pitch: 55 * DEG, dist: 7.5 }, park],
      rois: { aisle: [888, 520, 900, 520] },
      setup(g, opts) { clearDebris(); },
      act(g, k, opts) { if (k === 0) spawnDebris(opts.N ?? 32, opts.seed ?? 777); stepDebris(); return debris.list.filter(d => !d.rest).length; },
      teardown() { clearDebris(); },
      speedOf() { return mean(debris.list.filter(d => !d.rest).map(d => Math.hypot(...d.v))); },
    },
  };
  function rmCans(g) { g.items.items = g.items.items.filter(it => false); can = null; }
  function chairA(g) { let best = null, bd = 1e9; for (const p of g.props.props) { if (p.def.kind !== 'chair') continue; const d = Math.hypot(p.home[0] - 21.83, p.home[1] - 16.55); if (d < bd) { bd = d; best = p; } } return best; }
  function torchOn(on) {
    if (!torch) { const d = [-0.26, -0.30, -0.92]; const l = Math.hypot(...d); torch = E().lights.add({ name: 'chaosTorch', group: 'test', kind: 1, pos: [23.5, 1.05, 11.8], dir: d.map(x => x / l), color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70, card: true }); }
    torch.enabled = on;
  }

  // ------------------------------------------------------------------ the run
  const C = {
    SCENES, REF, res: {}, refs: {}, busy: null, err: null,
    async boot() { const b = await window.__iq.boot(); flags0 = S().flags; window.__iq.gameStep && 0; return b; },
    applyRef, applyVar, spawnDebris, stepDebris, clearDebris, readIds,
    /** ONE variant of ONE scene. variant 'ref' = the history-free reference (stored per scene+tag for the others to compare with); anything else = an __iq variant name or a settings object.
     *  opts: { tag, N (P6), shots = true, cost = false (per-frame pass times), extra = {} } */
    async run(scName, variant = 'main', opts = {}) {
      const sc = SCENES[scName]; if (!sc) throw new Error('scenes: ' + Object.keys(SCENES).join(' '));
      const { tag = '', shots = true, cost = scName === 'P6', extra = {}, cropAt = [1, 2, 4, 8], as = null, costOnly = false } = opts;   // costOnly: no readbacks / metrics — the per-frame pass times alone (P6's cost curve over N)
      const key = scName + (opts.N ? '_' + opts.N : '') + tag; const name = as || (typeof variant === 'string' ? variant : 'custom');
      const g = G(); const isRef = variant === 'ref';
      const vinfo = isRef ? applyRef() : applyVar(variant, extra);
      // stage: pin, park / place, hygiene, scene setup, warm-up under THIS variant (histories converge on the pre-event picture), clocks reset so every variant draws the same jitter / dice
      window.__menu?.close(); window.__stage(sc.pin[0], sc.pin[1]); __perf.still();
      let s0 = 4242; Math.random = mulberry32(s0);
      sc.setup(g, opts);
      for (let i = 0; i < 6; i++) await window.__iq.gameStep();
      __perf.still();
      for (let i = 0; i < (opts.warm ?? sc.warm); i++) await window.__iq.gameStep();
      window.__resetClock(); await window.__iq.gameStep(); await window.__iq.gameStep(); E().frameIdx = 0; E().passes.resetClocks(); Math.random = mulberry32(9001);
      const nStat = E().world.statics.length; const t = E().timer;
      const frames = opts.frames ?? sc.frames; const drive = []; const speeds = []; const store = []; const masks = []; const passRows = [];
      let rects = null; const keep = {};
      for (let k = 0; k < frames; k++) {
        drive.push(sc.act(g, k, opts));
        const before = t.resolved;
        await window.__iq.gameStep();
        speeds.push(+sc.speedOf(g).toFixed(3));
        if (cost) { for (let q = 0; q < 300 && t.resolved === before; q++) await yieldTask(); const row = {}; if (t.resolved !== before) for (const [pk, pv] of t.lastFrame) row[pk] = +pv.toFixed(3); row.union = t.unionMs ? +t.unionMs(['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown']).toFixed(3) : null; passRows.push(row); }
        if (costOnly) continue;
        const fr = await readback(); const ids = await readIds();
        if (!rects) { rects = {}; for (const [rn, rt] of Object.entries(sc.rois)) rects[rn] = rectOf(rt, fr); }
        const fs = {}, ms = {};
        for (const [rn, r] of Object.entries(rects)) { fs[rn] = tileLumas(fr, r); ms[rn] = dynMask(ids, fr, r, nStat, 2); }
        store.push(fs); masks.push(ms);
        if (shots && cropAt.includes(k)) keep[k] = fr;
      }
      sc.teardown(g);
      const out = { scene: scName, key, variant: name, vinfo, res: [E().width, E().height, E().outWidth, E().outHeight], frames, drive, speeds, rects, shots: [], metrics: {} };
      if (costOnly) { rects = {}; }
      else if (isRef) { C.refs[key] = { store, masks, rects }; }
      const ref = C.refs[key];
      // ---- metrics, per ROI. The reference is a DIFFERENT renderer (the pre-v3 chain), so |run − ref| per pixel carries their static differences (AA, estimator bias, reflections…) as
      // well as lag: it is used only for TIMING — WHEN each receiver pixel's true value changes and settles (geometry + light, renderer-independent) — and every run is then graded
      // against ITSELF: how many frames after the truth settled does the pixel reach its own final value (lag), how far off its own final value is it 1 / 2 / 4 / 8 frames after the
      // truth settled (residue, 8-bit levels), and how much do never-swept receivers move at all (boil = temporal sd). onObj keeps the plain |run − ref| on the object's own pixels
      // (read it between runs of the same scene, not absolutely).
      const THR = opts.thr ?? 8, SWEPT = opts.swept ?? 16;   // (a soft-shadow scene can lower both: the corridor panels' walking shadow changes a lino pixel by ten levels, not thirty)
      for (const rn of Object.keys(rects)) {
        const r = rects[rn]; const N = r.w * r.h; const K = frames; const kEnd = K - 1;
        const recv = new Uint8Array(N).fill(1);
        for (let k = 0; k < K; k++) { const m = masks[k][rn]; const mr = ref ? ref.masks[k]?.[rn] : null; for (let i = 0; i < N; i++) if (m[i] || (mr && mr[i])) recv[i] = 0; }
        let nRecv = 0; for (let i = 0; i < N; i++) nRecv += recv[i];
        const Lend = store[kEnd][rn], L0 = store[0][rn];
        // settle frame of a series X at pixel i: the first k after which |X[k'] − X[end]| < thr for all k' ≥ k
        const settleOf = (get, i, thr) => { let k = kEnd; while (k > 0 && Math.abs(get(k - 1)[i] - get(kEnd)[i]) < thr) k--; return k; };
        const M = { receivers: nRecv, swept: 0, static: 0, lagMean: null, lagP90: null, residue: { 1: null, 2: null, 4: null, 8: null }, boilStatic: null, boilSwept: null, onObj: [], errRef: [], sweepPerFrame: [] };
        const boilMap = new Float32Array(N); const lagMap = new Float32Array(N);
        if (ref) {
          const Rget = k => ref.store[k][rn]; const Lget = k => store[k][rn];
          const Rend = Rget(kEnd), R0 = Rget(0);
          const lags = []; const res = { 1: [], 2: [], 4: [], 8: [] }; const boilS = [], boilW = [];
          const sweepCount = new Int32Array(K);
          // the reference's RANGE per pixel over the take: a shadow that passes through and leaves (a thrown can's) sweeps a pixel whose first and last values agree — the range sees it
          const rMin = new Float32Array(N).fill(1e9), rMax = new Float32Array(N).fill(-1e9);
          for (let k = 0; k < K; k++) { const R = Rget(k); for (let i = 0; i < N; i++) { if (R[i] < rMin[i]) rMin[i] = R[i]; if (R[i] > rMax[i]) rMax[i] = R[i]; } }
          for (let i = 0; i < N; i++) {
            if (!recv[i]) continue;
            // temporal sd of the run at this pixel over the take (boil), split below by whether the truth ever changed here
            let s1 = 0, s2 = 0; for (let k = 0; k < K; k++) { const v = Lget(k)[i]; s1 += v; s2 += v * v; } const m1 = s1 / K; const sd = Math.sqrt(Math.max(0, s2 / K - m1 * m1));
            const change = rMax[i] - rMin[i];
            if (change < THR) { boilS.push(sd); boilMap[i] = sd; continue; }
            if (change < SWEPT) continue;   // (in between: neither plainly static nor plainly swept — left out of both)
            boilW.push(sd);
            const tTrue = settleOf(Rget, i, THR); sweepCount[Math.min(K - 1, tTrue)]++;
            const own = Math.abs(Lend[i] - L0[i]); const thrL = Math.max(THR, 0.25 * own);
            const tRun = settleOf(Lget, i, thrL);
            const lag = Math.max(0, tRun - tTrue); lags.push(lag); lagMap[i] = lag;
            for (const d of [1, 2, 4, 8]) { const k = tTrue + d; if (k <= kEnd) res[d].push(Math.abs(Lget(k)[i] - Lend[i])); }
          }
          lags.sort((x, y) => x - y);
          M.swept = lags.length; M.static = boilS.length;
          M.lagMean = r3(mean(lags)); M.lagP90 = lags.length ? lags[Math.floor(0.9 * (lags.length - 1))] : null; M.lagMax = lags.length ? lags[lags.length - 1] : null;
          for (const d of [1, 2, 4, 8]) M.residue[d] = r3(mean(res[d]));
          M.boilStatic = r3(mean(boilS)); M.boilSwept = r3(mean(boilW)); M.sweepPerFrame = Array.from(sweepCount);
          // the object's own pixels vs the reference (relative between runs), and the plain rmse vs the reference per frame (static renderer differences included — for the record)
          for (let k = 0; k < K; k++) { const L = Lget(k), R = Rget(k); const m = masks[k][rn]; let ob = 0, nb = 0, se = 0, ne = 0; for (let i = 0; i < N; i++) { const d = L[i] - R[i]; if (recv[i]) { se += d * d; ne++; } else if (m[i]) { ob += Math.abs(d); nb++; } } M.onObj.push(r3(nb ? ob / nb : null)); M.errRef.push(r3(Math.sqrt(se / Math.max(1, ne)))); }
          M.onObjMean = r3(mean(M.onObj.filter(v => v !== null)));
          // speed → pixels: trailPx = lag (frames) × the occluder's displacement per frame in output px at the ROI's depth (px per metre from the pin: 1000 rows span 2·dist·tan(fov/2) m at the look-at)
          const cam = window.__cam; const pxPerM = 1000 / (2 * sc.pin[0].dist * Math.tan((cam.fov || 0.9) / 2)) * ((E().outHeight || E().height) / 1000);
          const kAct = M.sweepPerFrame.reduce((best, v, k) => v > 50 ? k : best, 1);   // last frame something still swept
          const spd = mean(speeds.slice(0, Math.max(2, kAct)));
          M.speed = r3(spd); M.pxPerFrame = r3(spd / 60 * pxPerM); M.trailPx = r3((M.lagMean ?? 0) * spd / 60 * pxPerM); M.trailPxPerMps = r3(spd > 0.1 ? M.trailPx / spd : null);
        } else { for (let i = 0; i < N; i++) { if (!recv[i]) continue; let s1 = 0, s2 = 0; for (let k = 0; k < K; k++) { const v = store[k][rn][i]; s1 += v; s2 += v * v; } const m1 = s1 / K; boilMap[i] = Math.sqrt(Math.max(0, s2 / K - m1 * m1)); } M.boilStatic = r3(mean(Array.from(boilMap).filter((v, i) => recv[i]))); }
        out.metrics[rn] = M;
        if (shots) { out.shots.push(await postField(`chaos_${key}_${name}_${rn}_boil`, boilMap, r.w, r.h, 24, 2)); if (ref) out.shots.push(await postField(`chaos_${key}_${name}_${rn}_lag`, lagMap, r.w, r.h, 40, 2)); }
      }
      if (shots) for (const k of Object.keys(keep)) for (const rn of Object.keys(rects)) out.shots.push(await postCrop(`chaos_${key}_${name}_${rn}_f${String(k).padStart(2, '0')}`, keep[k], rects[rn], 2));
      if (cost && passRows.length) { const ks = [...new Set(passRows.flatMap(r => Object.keys(r)))]; const st = a => { const b = a.filter(v => v !== undefined && v !== null).sort((x, y) => x - y); if (!b.length) return null; return { mean: r3(mean(b)), p50: r3(b[Math.floor(0.5 * (b.length - 1))]), p95: r3(b[Math.floor(0.95 * (b.length - 1))]), max: r3(b[b.length - 1]) }; }; out.cost = Object.fromEntries(ks.map(k2 => [k2, st(passRows.map(r => r[k2]))])); }
      applyVar('main');
      ((C.res[key] = C.res[key] || {}))[name] = out;
      return out;
    },
    /** the scene under the reference then each listed variant (fire-and-forget; poll __chaos.busy) */
    go(scName, variants = ['main'], opts = {}) {
      C.busy = { scene: scName, at: 'ref', done: [] }; C.err = null;
      (async () => { try { await C.run(scName, 'ref', opts); for (const v of variants) { const [as, base, extra] = Array.isArray(v) ? v : [v, v, {}]; C.busy.at = as; await C.run(scName, base, { ...opts, as, extra }); C.busy.done.push(as); } C.busy.at = 'done'; } catch (e) { C.err = String(e?.stack || e); C.busy.at = 'error'; } })();
      return 'started ' + scName;
    },
    /** several scenes back to back: [[scene, variants, opts], …], saving __chaos.res as docs/perf/chaos-<name>.json after each (fire-and-forget; poll __chaos.all) */
    goAll(name, list) {
      C.all = { at: null, done: [] }; C.err = null;
      (async () => {
        try {
          for (const [sc, variants, opts] of list) {
            C.all.at = sc + (opts?.N ? '_' + opts.N : ''); if (!opts?.costOnly) await C.run(sc, 'ref', opts || {});
            for (const v of variants) { const [as, base, extra] = Array.isArray(v) ? v : [v, v, {}]; C.all.at = sc + ':' + as; await C.run(sc, base, { ...(opts || {}), as, extra }); }
            C.all.done.push(C.all.at); await C.save('chaos-' + name);
          }
          C.all.at = 'done';
        } catch (e) { C.err = String(e?.stack || e); C.all.at = 'error'; }
      })();
      return 'started ' + list.length + ' scenes';
    },
    text(key) {
      const R = C.res[key]; if (!R) return 'no results for ' + key;
      const rows = [];
      for (const [v, o] of Object.entries(R)) for (const [rn, m] of Object.entries(o.metrics)) rows.push(`${v.padEnd(10)} ${rn.padEnd(7)} recv ${m.receivers} swept ${m.swept} lag ${m.lagMean} f (p90 ${m.lagP90}, max ${m.lagMax}) = ${m.trailPx} px (${m.trailPxPerMps} px per m/s @ ${m.speed} m/s, ${m.pxPerFrame} px/f) residue +1/+2/+4/+8 ${m.residue?.[1]}/${m.residue?.[2]}/${m.residue?.[4]}/${m.residue?.[8]} boil static ${m.boilStatic} swept ${m.boilSwept} onObj ${m.onObjMean}` + (o.cost ? ` · cost ∪ ${o.cost.union?.mean}/${o.cost.union?.p95} direct ${o.cost.direct?.mean} sh ${o.cost.softblur?.mean} gbuf ${o.cost.gbuffer?.mean} taau ${o.cost.taau?.mean}` : ''));
      return rows.join('\n');
    },
    async save(name) { const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(C.res), headers: { 'Content-Type': 'application/json' } }); return r.status; },
  };
  window.__chaos = C;
  return 'chaos ready: await __chaos.boot(); __chaos.go("P1", ["main"]) → __chaos.text("P1")';
})();
