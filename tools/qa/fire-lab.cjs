// THE FIRE'S SHADER ALONE ON A PLAIN STAGE (src/render/shaders/fire.wgsl, the text the composite runs): a drum on dark ground under a camera at the game's own
// pitch and field of view, the flame and its embers drawn over it, the game's exposure and tone curve after — no game, no level, nothing else compiled. Where the
// flame's look is set: a page that boots in seconds, so a number can be changed and looked at again. What it is NOT: the game's picture (no bloom, no firelight
// on anything, no smoke, no upscaling) — tools/qa/fire-page.cjs looks at that.
//   node tools/qa/fire-lab.cjs            a sheet of frames 1/15 s apart from the play camera's distance and from close by, into OUT
//   env: OUT (folder, default a temp one) · DIST (m, default 5) · PITCH (degrees, default 55) · WIND (x,z m/s, default 0,0) · ALB (the ground's albedo, default 0.5) · T0 (s, default 3) · N (frames a
//        row, default 8) · DT (s between frames, default 1/15) · W / H (a frame's size, default 320 × 360) · HEAT (default 1) · POP (age of a crack at the
//        first frame, s; default 0.05) · BED (the bed of coals' radius, m; default 0.27, 0 = the lid bare)
// Headless Chromium on the software adapter. Exit 0 = the shader compiled, the pipeline was made and every frame was written with no error on the page (what is IN a
// frame is for the eye); 1 otherwise.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'fire-lab-'));
const DIST = +(process.env.DIST || 5), PITCH = +(process.env.PITCH ?? 55), T0 = +(process.env.T0 ?? 3), N = +(process.env.N || 8), DT = +(process.env.DT ?? 1 / 15);
const W = +(process.env.W || 320), H = +(process.env.H || 360), HEAT = +(process.env.HEAT ?? 1), POP = +(process.env.POP ?? 0.05);
const WIND = (process.env.WIND || '0,0').split(',').map(Number);
const ALB = +(process.env.ALB ?? 0.5);   // how much of the fire's light the ground gives back (0.5 = packed earth; 0.85 = snow, the hardest ground to see a flame against)
const BED = +(process.env.BED ?? 0.27);   // the bed of coals' radius (0 = the bare lid, as the game lights it: clipped white by the lamp a hand above it)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const fire = fs.readFileSync(path.join(__dirname, '../../src/render/shaders/fire.wgsl'), 'utf8');
const stage = /* wgsl */`
struct Lab { eye: vec4f, fwd: vec4f, right: vec4f, up: vec4f, res: vec4f, fire: FireRec };
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
@fragment fn fs(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let uv = (fp.xy / lab.res.xy) * 2.0 - 1.0;
  let th = lab.res.z;   // tan(fov / 2)
  let rd = normalize(lab.fwd.xyz + lab.right.xyz * (uv.x * th * lab.res.x / lab.res.y) - lab.up.xyz * (uv.y * th));
  let ro = lab.eye.xyz;
  let F = lab.fire; let base = F.a.xyz; let flick = F.c.z;
  // the stage: ground at y = 0, a drum under the coals (radius 0.29, its mouth at the coals' height)
  var tS = 1e30; var col = vec3f(0.0);
  let lightP = base + vec3f(0.0, 0.37, 0.0); let Li = vec3f(1.0, 0.5, 0.2) * (9.0 * flick * F.b.y);
  if (rd.y < 0.0) { let t = -ro.y / rd.y; let P = ro + rd * t; let d = lightP - P; let d2 = dot(d, d); tS = t;
    let sh = fireCyl(P, normalize(d), base - vec3f(0.0, base.y, 0.0), 0.29, 0.0, base.y);   // the drum's own shadow
    let lit = select(1.0, 0.0, sh.x <= sh.y && sh.y > 0.0);
    col = vec3f(${ALB}, ${(ALB * 0.96).toFixed(3)}, ${(ALB * 0.92).toFixed(3)}) * (Li * (lit * max(d.y, 0.0) / (d2 * sqrt(d2))) + vec3f(0.004, 0.005, 0.008)) / 3.14159; }
  let dc = fireCyl(ro, rd, base - vec3f(0.0, base.y, 0.0), 0.29, 0.0, base.y);
  if (dc.x <= dc.y && dc.x > 0.0 && dc.x < tS) { tS = dc.x; let P = ro + rd * dc.x;
    if (P.y > base.y - 0.002) { let r = length(P.xz - base.xz); col = select(vec3f(0.05, 0.02, 0.01), vec3f(40.0, 30.0, 18.0), length(P.xz - base.xz) < 0.275); }
    else { col = vec3f(0.07, 0.035, 0.02) + vec3f(0.3, 0.1, 0.03) * smoothstep(0.5, 0.9, P.y / base.y) * 0.05; } }
  let cpix = 2.0 * th / lab.res.y;
  let jit = fract(52.9829189 * fract(0.06711056 * fp.x + 0.00583715 * fp.y) + lab.res.w * 0.61803399);
  let fa = fireAir(F, ro, rd, tS, cpix, jit);
  col = col * fa.a + fa.rgb;
  return vec4f(agx(col * 2.0), 1.0);
}`;
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
    const pipe = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: fmt }] } });
    const e = await dev.popErrorScope(); if (e) return 'pipeline: ' + e.message;
    const buf = dev.createBuffer({ size: 80 + 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bg = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
    window.__draw = (u) => { dev.queue.writeBuffer(buf, 0, new Float32Array(u)); const enc = dev.createCommandEncoder(); const p = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      p.setPipeline(pipe); p.setBindGroup(0, bg); p.draw(3); p.end(); dev.queue.submit([enc.finish()]); return dev.queue.onSubmittedWorkDone(); };
    return 'ok';
  }, { code: fire + stage });
  if (ok !== 'ok') { console.log('FAIL', ok, errs.join('\n')); await browser.close(); process.exit(1); }
  // the light's flicker and the cracks, as game/fire.ts makes them (kept in step with it by hand: this page is for looking)
  const flick = t => 1 + 0.22 * (0.9 * Math.sin(6.283 * 1.3 * t + 1) + 0.7 * Math.sin(6.283 * 2.7 * t + 2) + 0.45 * Math.sin(6.283 * 4.9 * t + 3) + 0.2 * Math.sin(6.283 * 8.3 * t + 4)) / 2.25;
  const rec = (t, popAge) => [0, 0.89, 0, 0.22, 0.75, HEAT, 0.37, t, WIND[0], WIND[1], flick(t) + 0.25 * Math.exp(-Math.max(popAge, 0) / 0.12) * (popAge >= 0 ? 1 : 0), 10, BED, 0, 0, 0, popAge, 0.9, 0.3, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0];
  const cam = (dist, pitch, look, frame) => { const p = pitch * Math.PI / 180, yaw = 0.5; const f = [-Math.sin(yaw) * Math.cos(p), -Math.sin(p), -Math.cos(yaw) * Math.cos(p)];
    const eye = [look[0] - f[0] * dist, look[1] - f[1] * dist, look[2] - f[2] * dist]; const r = [Math.cos(yaw), 0, -Math.sin(yaw)]; const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [...eye, 0, ...f, 0, ...r, 0, ...u, 0, W, H, Math.tan(14 * Math.PI / 180), frame]; };
  const rows = [{ name: 'play', dist: DIST, pitch: PITCH, look: [0, 0.9, 0] }, { name: 'close', dist: 2.2, pitch: 30, look: [0, 1.15, 0] }, { name: 'far', dist: 16, pitch: PITCH, look: [0, 0.9, 0] }];
  const files = [];
  for (const row of rows) for (let k = 0; k < N; k++) {
    const t = T0 + k * DT; await page.evaluate(u => window.__draw(u), [...cam(row.dist, row.pitch, row.look, k), ...rec(t, POP + k * DT)]);
    const file = path.join(OUT, `lab_${row.name}_${String(k).padStart(2, '0')}.png`); await page.screenshot({ path: file }); files.push(file);
  }
  console.log(JSON.stringify({ out: OUT, frames: files.length, errs }));
  await browser.close(); process.exit(errs.length ? 1 : 0);
})();
