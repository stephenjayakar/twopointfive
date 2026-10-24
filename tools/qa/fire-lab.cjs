// THE FIRE'S SHADER ALONE ON A PLAIN STAGE (src/render/shaders/fire.wgsl, the text the composite runs): a drum on lit ground under a camera at the game's own
// pitch and field of view, the flame, its smoke and its shimmer drawn over it, then the game's bloom (near enough: five halved levels summed back × 0.06, no
// Karis weight), exposure and tone curve — no game, no level, nothing else compiled. Where the flame's look is set: a page that boots in seconds, so a number
// can be changed and looked at again. What it is NOT: the game's picture (no embers: those are GPU particles; no firelight on anything but the ground, no
// solver smoke, no upscaling, no temporal filter — SUB marches a pixel stand in for the frames that gathers) — tools/qa/fire-page.cjs looks at that.
//   node tools/qa/fire-lab.cjs            a sheet of frames 1/15 s apart from the play camera's distance and from close by, into OUT
//   env: OUT (folder, default a temp one) · SRC (another fire.wgsl to draw) · LOOK ('tall=1.5,core=2': the look's numbers, game/fire.ts FIRE.look) · ROWS (play,close,far) ·
//        DIST (m, default 5) · PITCH (degrees, default 55) · WIND (x,z m/s, default 0,0) · ALB (the ground's albedo, default 0.5; snow 0.85) · T0 (s, default 3) · N (frames a
//        row, default 8) · DT (s between frames, default 1/15) · W / H (a frame's size, default 320 × 360) · HEAT (default 1) · FH (the flame's height, m; default 1.15) · POP (age of a crack at the
//        first frame, s; default 0.05) · BED (the bed of coals' radius, m; default 0.27, 0 = the lid bare) · LAMP, SIZE, LAMPK, LAMPC (the stage's lamp: metres over the coals, its
//        radius; default 0.66 and 0.24, the game's) · BLOOM (default 0.06, the game's) · SUB (marches a pixel, default 4)
// Headless Chromium on the software adapter. Exit 0 = the shader compiled, the pipelines were made and every frame was written with no error on the page (what is IN a
// frame is for the eye); 1 otherwise.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'fire-lab-'));
const DIST = +(process.env.DIST || 5), PITCH = +(process.env.PITCH ?? 55), T0 = +(process.env.T0 ?? 3), N = +(process.env.N || 8), DT = +(process.env.DT ?? 1 / 15);
const W = +(process.env.W || 320), H = +(process.env.H || 360), HEAT = +(process.env.HEAT ?? 1), POP = +(process.env.POP ?? 0.05);
const WIND = (process.env.WIND || '0,0').split(',').map(Number);
const ALB = +(process.env.ALB ?? 0.5);   // how much of the fire's light the ground gives back (0.5 = packed earth; 0.85 = snow, the hardest ground to see a flame against)
const LAMP = +(process.env.LAMP ?? 0.66), SIZE = +(process.env.SIZE ?? 0.24), LAMPK = +(process.env.LAMPK ?? 1.25), LAMPC = (process.env.LAMPC || '1,0.36,0.1').split(',').map(Number);   // the stage's lamp: metres over the coals (the level hangs it 0.16 up, FIRE.lift 0.5 more; LAMPK = its strength × the level's 9, FIRE.bright; LAMPC = its colour, the level's × FIRE.warm) and its radius (FIRE.size; 0 = a pinpoint and a drawn shadow)
const BED = +(process.env.BED ?? 0.27);   // the bed of coals' radius (0 = the bare lid, as the game lights it: clipped white by the lamp a hand above it)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const fire = fs.readFileSync(process.env.SRC || path.join(__dirname, '../../src/render/shaders/fire.wgsl'), 'utf8');
// THE LOOK'S NUMBERS (game/fire.ts FIRE.look, kept in step by hand): LOOK='gain=1,core=1,…' moves one
const LOOK = { gain: 3, core: 4, sigma: 2.5, speed: 0.7, tall: 0.95, torn: 1.1, plume: 1, shimmer: 0.019, soot: 0.5, breathe: 1, ref: 3.2, lo: 0.2, react: 1, lean: 0.2, steps: 40 };
for (const kv of (process.env.LOOK || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); if (!(k in LOOK)) { console.log('FAIL unknown look key', k); process.exit(1); } LOOK[k] = +v; }
const SUB = +(process.env.SUB ?? 4), FH = +(process.env.FH ?? 1.15), BLOOM = +(process.env.BLOOM ?? 0.06);
const stage = /* wgsl */`
struct Lab { eye: vec4f, fwd: vec4f, right: vec4f, up: vec4f, res: vec4f, fire: FireRec, look: FireLook };
@group(0) @binding(0) var<uniform> lab: Lab;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 0.0, 1.0); }
fn agxContrast(x: vec3f) -> vec3f { let x2 = x * x; let x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
fn agx(cin: vec3f) -> vec3f {
  let inset = mat3x3f(vec3f(0.842479062253094, 0.0423282422610123, 0.0423756549057051), vec3f(0.0784335999999992, 0.878468636469772, 0.0784336), vec3f(0.0792237451477643, 0.0791661274605434, 0.879142973793104));
  var v = inset * max(cin, vec3f(1e-10)); v = clamp(log2(v), vec3f(-12.47393), vec3f(4.026069)); v = (v + 12.47393) / 16.5; v = agxContrast(v);
  let lum = dot(v, vec3f(0.2126, 0.7152, 0.0722)); v = pow(v, vec3f(1.15)); v = lum + 1.1 * (v - lum);
  let outset = mat3x3f(vec3f(1.19687900512017, -0.0528968517574562, -0.0529716355144438), vec3f(-0.0980208811401368, 1.15190312990417, -0.0980434501171241), vec3f(-0.0990297440797205, -0.0989611768448433, 1.15107367264116));
  return clamp(outset * v, vec3f(0.0), vec3f(1.0));
}
fn rayAt(p: vec2f) -> vec3f { let uv = (p / lab.res.xy) * 2.0 - 1.0; let th = lab.res.z; return normalize(lab.fwd.xyz + lab.right.xyz * (uv.x * th * lab.res.x / lab.res.y) - lab.up.xyz * (uv.y * th)); }
@fragment fn fs(@builtin(position) fp0: vec4f) -> @location(0) vec4f {
  // the shimmer of the hot air: the picture behind the column is read a little aside (the composite does the same with its own pixel)
  let sh = fireShimmer(lab.fire, lab.look, lab.eye.xyz, rayAt(fp0.xy));
  var fp = fp0; if (sh.z > 0.0) { let px = 2.0 * lab.res.z / lab.res.y * sh.z; fp = vec4f(fp0.xy + vec2f(sh.x, -sh.y) / px, fp0.zw); }
  let uv = (fp.xy / lab.res.xy) * 2.0 - 1.0;
  let th = lab.res.z;   // tan(fov / 2)
  let rd = normalize(lab.fwd.xyz + lab.right.xyz * (uv.x * th * lab.res.x / lab.res.y) - lab.up.xyz * (uv.y * th));
  let ro = lab.eye.xyz;
  let F = lab.fire; let base = F.a.xyz; let flick = F.c.z;
  // the stage: ground at y = 0, a drum under the coals (radius 0.29, its mouth at the coals' height)
  var tS = 1e30; var col = vec3f(0.0);
  let lightP = base + vec3f(0.0, ${LAMP.toFixed(3)}, 0.0); let Li = vec3f(${LAMPC.map(v => v.toFixed(3)).join(', ')}) * (${(9 * LAMPK).toFixed(3)} * flick * F.b.y);
  if (rd.y < 0.0) { let t = -ro.y / rd.y; let P = ro + rd * t; let d = lightP - P; let d2 = dot(d, d); tS = t;
    var lit = 0.0;   // the drum's own shadow, from a lamp as big as the flame: sixteen points of its ball, turned by the pixel (the same sixteen everywhere drew sixteen stacked edges)
    let turn = 6.2831853 * fireHu(u32(fp.x) + u32(fp.y) * 4099u);
    for (var k = 0.0; k < 16.0; k += 1.0) { let z = 1.0 - (2.0 * k + 1.0) / 16.0; let rr = sqrt(max(1.0 - z * z, 0.0)); let ph = k * 2.399963 + turn;
      let dk = lightP + vec3f(rr * cos(ph), z, rr * sin(ph)) * ${SIZE.toFixed(3)} - P;
      let sh = fireCyl(P, normalize(dk), base - vec3f(0.0, base.y, 0.0), 0.29, 0.0, base.y);
      lit += select(1.0, 0.0, sh.x <= sh.y && sh.y > 0.0) / 16.0; }
    col = vec3f(${ALB}, ${(ALB * 0.96).toFixed(3)}, ${(ALB * 0.92).toFixed(3)}) * (Li * (lit * max(d.y, 0.0) / (d2 * sqrt(d2))) + vec3f(0.004, 0.005, 0.008)) / 3.14159; }
  let dc = fireCyl(ro, rd, base - vec3f(0.0, base.y, 0.0), 0.29, 0.0, base.y);
  if (dc.x <= dc.y && dc.x > 0.0 && dc.x < tS) { tS = dc.x; let P = ro + rd * dc.x;
    if (P.y > base.y - 0.002) { let r = length(P.xz - base.xz); col = select(vec3f(0.05, 0.02, 0.01), vec3f(2.86, 0.99, 0.23), length(P.xz - base.xz) < 0.275); }
    else { col = vec3f(0.07, 0.035, 0.02) + vec3f(0.3, 0.1, 0.03) * smoothstep(0.5, 0.9, P.y / base.y) * 0.05; } }
  let cpix = 2.0 * th / lab.res.y;
  let jit = fract(52.9829189 * fract(0.06711056 * fp.x + 0.00583715 * fp.y) + lab.res.w * 0.61803399);
  var fa = vec4f(0.0); for (var k = 0.0; k < ${SUB}.0; k += 1.0) { fa += fireAir(F, lab.look, ro, rd, tS, cpix, fract(jit + k * 0.61803399)) / ${SUB}.0; }   // (SUB marches, as the game's temporal filter gathers frames)
  col = col * fa.a + fa.rgb;
  return vec4f(col, 1.0);
}
// the game's bloom, near enough (bloom.wgsl: no threshold, five levels each half the last, the sum added back × passes.bloom), then its exposure and tone curve
@group(0) @binding(0) var srcT: texture_2d<f32>; @group(0) @binding(1) var smp: sampler;
@fragment fn fsDown(@builtin(position) fp: vec4f) -> @location(0) vec4f { let ts = 1.0 / vec2f(textureDimensions(srcT)); let uv = fp.xy * 2.0 * ts;
  return vec4f(min((textureSampleLevel(srcT, smp, uv + ts * vec2f(-1.0, -1.0), 0.0).rgb + textureSampleLevel(srcT, smp, uv + ts * vec2f(1.0, -1.0), 0.0).rgb + textureSampleLevel(srcT, smp, uv + ts * vec2f(-1.0, 1.0), 0.0).rgb + textureSampleLevel(srcT, smp, uv + ts * vec2f(1.0, 1.0), 0.0).rgb) * 0.25, vec3f(64.0)), 1.0); }
@group(0) @binding(2) var b1: texture_2d<f32>; @group(0) @binding(3) var b2: texture_2d<f32>; @group(0) @binding(4) var b3: texture_2d<f32>; @group(0) @binding(5) var b4: texture_2d<f32>; @group(0) @binding(6) var b5: texture_2d<f32>;
@fragment fn fsOut(@builtin(position) fp: vec4f) -> @location(0) vec4f { let uv = fp.xy / vec2f(textureDimensions(srcT));
  let bl = textureSampleLevel(b1, smp, uv, 0.0).rgb + textureSampleLevel(b2, smp, uv, 0.0).rgb + textureSampleLevel(b3, smp, uv, 0.0).rgb + textureSampleLevel(b4, smp, uv, 0.0).rgb + textureSampleLevel(b5, smp, uv, 0.0).rgb;
  return vec4f(agx((textureLoad(srcT, vec2i(fp.xy), 0).rgb + bl * ${BLOOM}) * 2.0), 1.0); }`;
const html = `<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas></body>`;

(async () => {
  const browser = await chromium.launch({ args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || /error|invalid/i.test(m.text())) errs.push(m.text()); });
  await page.route('https://fire.lab/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://fire.lab/');
  const ok = await page.evaluate(async ({ code }) => {
    const ad = await navigator.gpu?.requestAdapter(); if (!ad) return 'no adapter';
    const dev = await ad.requestDevice(); const cv = document.getElementById('c'), ctx = cv.getContext('webgpu'), fmt = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
    dev.pushErrorScope('validation');
    const mod = dev.createShaderModule({ code }); const info = await mod.getCompilationInfo(); const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
    if (bad.length) return 'shader: ' + bad.join(' | ');
    const HDR = 'rgba16float';
    const mk = (entry, format) => dev.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: entry, targets: [{ format }] } });
    const pipe = mk('fs', HDR), pDown = mk('fsDown', HDR), pOut = mk('fsOut', fmt);
    const e = await dev.popErrorScope(); if (e) return 'pipeline: ' + e.message;
    const buf = dev.createBuffer({ size: 80 + 64 + 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bg = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
    const tex = (w, h) => dev.createTexture({ size: [Math.max(1, w), Math.max(1, h)], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const hdr = tex(cv.width, cv.height), lv = [1, 2, 3, 4, 5].map(k => tex(cv.width >> k, cv.height >> k)), smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const downBg = [hdr, ...lv.slice(0, 4)].map(t => dev.createBindGroup({ layout: pDown.getBindGroupLayout(0), entries: [{ binding: 0, resource: t.createView() }, { binding: 1, resource: smp }] }));
    const outBg = dev.createBindGroup({ layout: pOut.getBindGroupLayout(0), entries: [{ binding: 0, resource: hdr.createView() }, { binding: 1, resource: smp }, ...lv.map((t, i) => ({ binding: 2 + i, resource: t.createView() }))] });
    window.__draw = (u) => { dev.queue.writeBuffer(buf, 0, new Float32Array(u)); const enc = dev.createCommandEncoder();
      const run = (view, pl, g) => { const p = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] }); p.setPipeline(pl); p.setBindGroup(0, g); p.draw(3); p.end(); };
      run(hdr.createView(), pipe, bg); lv.forEach((t, i) => run(t.createView(), pDown, downBg[i])); run(ctx.getCurrentTexture().createView(), pOut, outBg);
      dev.queue.submit([enc.finish()]); return dev.queue.onSubmittedWorkDone(); };
    return 'ok';
  }, { code: fire + (/fn fireGas\(/.test(fire) ? '' : 'fn fireGas(p: vec3f) -> f32 { return 0.0; }\n') + stage });
  if (ok !== 'ok') { console.log('FAIL', ok, errs.join('\n')); await browser.close(); process.exit(1); }
  // the light's flicker and the cracks, as game/fire.ts makes them (kept in step with it by hand: this page is for looking)
  const flick = t => 1 + 0.29 * (0.9 * Math.sin(6.283 * 1.3 * t + 1) + 0.7 * Math.sin(6.283 * 2.7 * t + 2) + 0.45 * Math.sin(6.283 * 4.9 * t + 3) + 0.2 * Math.sin(6.283 * 8.3 * t + 4)) / 2.25;
  const L = LOOK, look = [L.gain, L.core, L.sigma, L.speed, L.tall, L.torn, L.plume, L.shimmer, L.soot, L.breathe, L.ref, L.lo, L.react, L.lean, L.steps, 0];
  const rec = (t, popAge) => [0, 0.89, 0, 0.22, FH, HEAT, 0.37, t, WIND[0], WIND[1], flick(t) + 0.6 * Math.exp(-Math.max(popAge, 0) / 0.12) * (popAge >= 0 ? 1 : 0), 0, BED, 0, 0, 0, ...look];
  const cam = (dist, pitch, look, frame) => { const p = pitch * Math.PI / 180, yaw = 0.5; const f = [-Math.sin(yaw) * Math.cos(p), -Math.sin(p), -Math.cos(yaw) * Math.cos(p)];
    const eye = [look[0] - f[0] * dist, look[1] - f[1] * dist, look[2] - f[2] * dist]; const r = [Math.cos(yaw), 0, -Math.sin(yaw)]; const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [...eye, 0, ...f, 0, ...r, 0, ...u, 0, W, H, Math.tan(14 * Math.PI / 180), frame]; };
  const rows = [{ name: 'play', dist: DIST, pitch: PITCH, look: [0, 1.3, 0] }, { name: 'close', dist: 3.4, pitch: 25, look: [0, 1.7, 0] }, { name: 'far', dist: 16, pitch: PITCH, look: [0, 0.9, 0] }].filter(r => !process.env.ROWS || process.env.ROWS.split(',').includes(r.name));
  const files = [];
  for (const row of rows) for (let k = 0; k < N; k++) {
    const t = T0 + k * DT; await page.evaluate(u => window.__draw(u), [...cam(row.dist, row.pitch, row.look, k), ...rec(t, POP + k * DT)]);
    const file = path.join(OUT, `lab_${row.name}_${String(k).padStart(2, '0')}.png`); await page.screenshot({ path: file }); files.push(file);
  }
  console.log(JSON.stringify({ out: OUT, frames: files.length, errs }));
  await browser.close(); process.exit(errs.length ? 1 : 0);
})();
