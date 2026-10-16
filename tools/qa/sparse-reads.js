// What the smoke's READERS pay per ray (src/render/shaders/smoke_read.wgsl): the page's own reader text with a counter on every page load and every atlas fetch, run
// over the same rays twice — hopping over clear air (spgSkip true) and asking brick by brick / step by step (false) — against the field as it stands. Counts carry from any adapter; the answers of
// the two walks must be the same numbers. The page must have RENDERED a frame with the smoke alive (the Frame uniform's smoke count and flags are that frame's).
//     await import('/qa/sparse-reads.js'); await __spr.run()          (· __spr.at([[x, y, z] …]) = what a reader is handed at those points)
// → { shadow: {...}, view: {...} }: rays, how many met the bounds, loads / fetches / loop turns per such ray either way, the largest difference between the two answers.
// Plain JS, nothing bundled.
(() => {
  const G = () => window.__game, E = () => window.__engine;
  const KERNEL = `
struct Ray { o: vec3f, tmax: f32, d: vec3f, kind: f32 };
@group(1) @binding(0) var<storage, read> rays: array<Ray>;
@group(1) @binding(1) var<storage, read_write> outp: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&rays)) { return; }
  let r = rays[gid.x]; var v = 0.0; var turns = 0u;
  let sp = smokeSegment(r.o, r.d, r.tmax);
  if (sp.tExit <= sp.tEnter) { outp[gid.x] = vec4f(-1.0, 0.0, 0.0, 0.0); return; }
  if (r.kind < 0.5) { v = smokeOpticalDepth(r.o, r.d, sp.tEnter, sp.tExit, 0.44); }
  else {   // the lit marches' lattice (volumetrics.wgsl) with its hop: a fixed step over the stretch, the sample mid-step
    let dt = 0.0825; let steps = u32(ceil((sp.tExit - sp.tEnter) / dt));
    for (var s = 0u; s < steps; s++) {
      turns++;
      let X = r.o + r.d * (sp.tEnter + (f32(s) + 0.5) * dt);
      let dens = smokeDensityAt(X);
      if (dens == 0.0 && spgHole) { let hop = u32(clamp((smokeClearRun(X, r.d) - 1e-3) / dt, 0.0, 4096.0)); if (hop > 0u) { s += hop; continue; } }
      v += dens * dt;
    }
  }
  outp[gid.x] = vec4f(v, f32(cPage), f32(cAtlas), f32(turns));
}`;
  // what a reader is handed AT a point (smoke_read.wgsl smokeTexelAt)
  const KERNEL_AT = `
@group(1) @binding(0) var<storage, read> pts: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> outp: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&pts)) { return; }
  outp[gid.x] = smokeTexelAt(pts[gid.x].xyz);
}`;
  function source(skip, kernel) {
    let pre = window.__scenePrelude(false);
    const decl = '@group(0) @binding(14) var smokePage: texture_3d<u32>;';
    if (!pre.includes(decl)) throw new Error('sparse-reads: the scene prelude lost the page texture\'s binding');
    pre = pre.split('textureLoad(smokePage, ').join('pgL(').replace('return textureSampleLevel(smokeAtlas, linSamp, (o + f)', 'cAtlas++; return textureSampleLevel(smokeAtlas, linSamp, (o + f)');
    pre = pre.replace(decl, decl + '\nvar<private> cPage: u32; var<private> cAtlas: u32;\nfn pgL(c: vec3i, l: i32) -> vec4u { cPage++; return textureLoad(smokePage, c, l); }');
    const sw = 'fn spgSkip() -> bool { return smoke[0].readSkip > 0.5; }';
    if (!pre.includes(sw)) throw new Error('sparse-reads: the reader lost its switch');
    return pre.replace(sw, `fn spgSkip() -> bool { return ${skip}; }`) + kernel;
  }
  const walk = (rays, skip) => gpu(source(skip, KERNEL), rays, rays.length / 8);
  async function gpu(code, rays, n) {
    const d = E().device;
    const lay = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: 4, buffer: { type: 'read-only-storage' } }, { binding: 1, visibility: 4, buffer: { type: 'storage' } }] });
    const mod = d.createShaderModule({ code });
    const info = await mod.getCompilationInfo(); const bad = info.messages.filter(m => m.type === 'error');
    if (bad.length) throw new Error('sparse-reads: ' + bad.slice(0, 3).map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join(' | '));
    const pipe = await d.createComputePipelineAsync({ layout: d.createPipelineLayout({ bindGroupLayouts: [E().sceneLayout, lay] }), compute: { module: mod, entryPoint: 'main' } });
    const rb = d.createBuffer({ size: rays.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(rb, 0, rays);
    const ob = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }), back = d.createBuffer({ size: n * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = d.createCommandEncoder(), p = enc.beginComputePass();
    p.setPipeline(pipe); p.setBindGroup(0, E().sceneBindGroup()); p.setBindGroup(1, d.createBindGroup({ layout: lay, entries: [{ binding: 0, resource: { buffer: rb } }, { binding: 1, resource: { buffer: ob } }] }));
    p.dispatchWorkgroups(Math.ceil(n / 64)); p.end(); enc.copyBufferToBuffer(ob, 0, back, 0, n * 16); d.queue.submit([enc.finish()]);
    await back.mapAsync(GPUMapMode.READ); const out = new Float32Array(back.getMappedRange().slice(0)); back.unmap(); rb.destroy(); ob.destroy(); back.destroy();
    return out;
  }
  const R = {
    half: 9, step: 0.3, lightsPer: 3, lightReach: 14,
    /** floor points on a plan grid round `centre`; a shadow ray from each to its nearest few lights, a view ray from the camera to each */
    rays(centre = window.__cam.target) {
      const sh = [], vw = [], cam = window.__cam.pos, lights = G().level.lights.map(l => l.pos).filter(p => p && p.length === 3);
      for (let z = -R.half; z <= R.half; z += R.step) for (let x = -R.half; x <= R.half; x += R.step) {
        const P = [centre[0] + x, 0.02, centre[2] + z];
        const near = lights.map(l => [Math.hypot(l[0] - P[0], l[1] - P[1], l[2] - P[2]), l]).filter(a => a[0] < R.lightReach && a[0] > 0.1).sort((a, b) => a[0] - b[0]).slice(0, R.lightsPer);
        for (const [dist, l] of near) sh.push(P[0], P[1], P[2], dist, (l[0] - P[0]) / dist, (l[1] - P[1]) / dist, (l[2] - P[2]) / dist, 0);
        const dv = Math.hypot(P[0] - cam[0], P[1] - cam[1], P[2] - cam[2]);
        vw.push(cam[0], cam[1], cam[2], dv, (P[0] - cam[0]) / dv, (P[1] - cam[1]) / dv, (P[2] - cam[2]) / dv, 1);
      }
      return { shadow: new Float32Array(sh), view: new Float32Array(vw) };
    },
    async compare(rays) {
      const a = await walk(rays, false), b = await walk(rays, true), n = rays.length / 8;
      let met = 0, worst = 0, smoky = 0; const s = { page: [0, 0], atlas: [0, 0], turns: [0, 0] };
      for (let i = 0; i < n; i++) {
        if (a[i * 4] < 0) continue;
        met++; if (a[i * 4] > 0) smoky++;
        worst = Math.max(worst, Math.abs(a[i * 4] - b[i * 4]));
        s.page[0] += a[i * 4 + 1]; s.page[1] += b[i * 4 + 1]; s.atlas[0] += a[i * 4 + 2]; s.atlas[1] += b[i * 4 + 2]; s.turns[0] += a[i * 4 + 3]; s.turns[1] += b[i * 4 + 3];
      }
      const per = v => v.map(x => +(x / Math.max(1, met)).toFixed(2));
      return { rays: n, metBounds: met, metSmoke: smoky, pageLoadsPerRay: per(s.page), atlasFetchesPerRay: per(s.atlas), marchTurnsPerRay: per(s.turns), worstDifference: worst };
    },
    /** points [[x, y, z] …] → per point [density every reader takes, that × (1 − tint) r, g, b] */
    async at(points) { const f = new Float32Array(points.length * 4); points.forEach((p, i) => f.set(p, i * 4)); const o = await gpu(source(true, KERNEL_AT), f, points.length); return points.map((_, i) => Array.from(o.subarray(i * 4, i * 4 + 4))); },
    async run(centre) { const r = R.rays(centre); return { order: '[asking everywhere, hopping]', shadow: await R.compare(r.shadow), view: await R.compare(r.view) }; },
  };
  window.__spr = R;
})();
