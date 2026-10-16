// DIRECT-QUALITY bench (lane v3/direct-quality, docs/internal/direct-quality.md): the maintainer's 08-12 notes at HIGH — "odd glowing at contact points … the light from
// muzzle flashes looks pretty noisy … weird light leaking in door frame … weird red wall leaking on sam … noise in flashing light in cubicle" — as five deterministic scenes,
// plus the sharp path's SLIVER census / paint and the readbacks that attribute them. Dev only: on a `?paused&quality=<p>&mute` boot of THIS lane's server,
//     await import('/qa/dq-scenes.js'); await __dq.boot(); await __dq.stage('S1'); await __dq.cap('tag')  …  __dq.res
// Scenes (camera pinned VERBATIM through __stage, guards parked dark unless staged, phases zeroed, grain off, dice seeded, the flickering tube held steady unless the scene drives it):
//   S1  DOOR FRAME — the storage door from the corridor at the follow camera's own framing (55°, 28° fov), the corridor panel east of it the one light: the leaf's edges, the
//       reveals, the name plate, the tripwire posts — thin faces at 1–3 output px.  S1b = the manager's door in the corridor's dark middle (its sidelight mullions).
//   S2  SILHOUETTE / CONTACT — Sam standing against the red spine partition under the cubicles panel, a guard against the corridor wall under its panel; close (dist 7).
//   S3  SHADOW-EDGE FRINGE — a guard on the open floor lit by the warm desk lamp (sharp class) AND the cool server panel through the door (broad): his two shadows cross.
//   S4  MUZZLE FLASH — Sam fires the Five-seveN in the dark cubicle aisle: the flash frame (a transient light) → tile sd on the lit floor vs a STEADY light of equal power there.
//   S5  STROBE — tjank scene A (the tube's dropout pattern driven through offscreen renders): per-frame tile sd within a level + the mean-vs-drive curve.
// Crops post to docs/shots/dq_*.jpg through the shot sink; the ones the note / page cite are kept under docs/shots/dq/ (tools/qa/dq-page.py reads there).
// Readbacks: census() = sharpE[0].a per output pixel (sharp_direct.wgsl's fallback code: ring / sliver / traced / unshadowed-default) → counts + mask; dirTerm() = the sharp
// path's shadowed direct pair itself (linear, output size) as an image — the direct-only view UNDER sharp direct (the debug views bypass the sharp path, so 'view 3' is not it).
(async () => {
  if (!window.__perf) await import('/qa/perf-harness.js');
  if (!window.__pf) await import('/qa/perf-frames.js');
  const E = () => window.__engine, S = () => window.__engine.settings, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  let fakeHidden = false;
  try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => fakeHidden }); } catch (e) { /* an earlier import defined it */ }
  const luma = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  let seeded = false;
  function seed() { if (seeded) return; seeded = true; let s0 = 4242; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pinViewport(cssW = 1280, cssH = 720, dpr = 2) {
    const cv = document.getElementById('view');
    Object.defineProperty(cv, 'clientWidth', { configurable: true, get: () => cssW });
    Object.defineProperty(cv, 'clientHeight', { configurable: true, get: () => cssH });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => dpr });
  }
  const panel11 = () => G().targets.find(t => t.name === 'panel_cubicles_11');
  const PARK = { pos: [30.8, 0, 9.2], yaw: 3.1, holstered: true, invisible: true };   // Sam out of every shot unless the scene stages him
  let steadyLight = null;   // S4's steady stand-in for the flash (same place / colour / power / radius, persistent)
  const SCENES = {
    // S1: the storage door (32.6, 10) from the corridor — the follow camera's own numbers (pitch 55°, dist 21, fov 28°) yawed a little east so the west reveal shows; the panel over x 32 lights it from the corridor side
    S1:  { pin: { look: [32.3, 0.6, 10.7], yaw: 12 * DEG, pitch: 55 * DEG, dist: 21 }, opts: { park: true, player: PARK }, tiles: { headW: [[32.1, 2.18, 10.0], 260, 120], jambW: [[32.05, 1.2, 10.05], 140, 260], jambE: [[33.18, 1.2, 10.05], 140, 260], plate: [[33.5, 1.55, 10.07], 200, 140], foot: [[32.6, 0.02, 10.3], 300, 120] } },
    // S1b: the manager's door (25.6, 10) + its sidelight (x 26.2‥26.75) in the corridor's unlit middle — lit only by the two corridor panels 6–11 m either side and what comes through the sidelight
    S1b: { pin: { look: [25.9, 0.6, 10.7], yaw: -10 * DEG, pitch: 55 * DEG, dist: 21 }, opts: { park: true, player: PARK }, tiles: { head: [[25.6, 2.18, 10.0], 300, 120], side: [[26.47, 1.2, 10.0], 160, 300], jambW: [[25.05, 1.1, 10.05], 140, 260], foot: [[25.6, 0.02, 10.35], 300, 120] } },
    // S1c: the same storage door CLOSE (dist 9) — the framing a player zoomed in gets
    S1c: { pin: { look: [32.5, 0.8, 10.5], yaw: 15 * DEG, pitch: 50 * DEG, dist: 9 }, opts: { park: true, player: PARK }, tiles: { headW: [[32.2, 2.17, 10.0], 300, 140], jambW: [[32.05, 1.3, 10.05], 160, 300], jambE: [[33.18, 1.3, 10.05], 160, 300], leafTop: [[32.9, 2.15, 10.0], 300, 100] } },
    // S2: Sam against the red spine partition's north face under panel_cubicles_11 (16.5, 2.9, 20.6) — the partition (box 265: x 16.5, z 19‥22.2, 1.4 m) at his back, close camera from the north-east
    S2:  { pin: { look: [16.9, 0.8, 20.3], yaw: 215 * DEG, pitch: 50 * DEG, dist: 7 }, opts: { park: true, player: { pos: [16.95, 0, 20.3], yaw: -1.57, holstered: true, invisible: false, crouch: false } }, tiles: { torso: [[16.95, 1.15, 20.3], 220, 260], legs: [[16.95, 0.35, 20.3], 220, 240], feet: [[16.95, 0.03, 20.3], 260, 140], partTop: [[16.5, 1.4, 20.9], 300, 120] } },
    // S2b: a guard standing against the corridor's north wall under panel_corridor_20 (32, 2.9, 11.1), torch off, seen along the corridor — the 'white outline round the mannequin' framing
    S2b: { pin: { look: [30.9, 0.9, 10.5], yaw: -60 * DEG, pitch: 45 * DEG, dist: 6.5 }, opts: { park: true, guards: [{ i: 0, pos: [30.9, 0, 10.35], yaw: 0, torch: false }], player: PARK }, tiles: { head: [[30.9, 1.6, 10.35], 220, 200], torso: [[30.9, 1.1, 10.35], 240, 240], feet: [[30.9, 0.03, 10.4], 280, 150], wallEdge: [[31.6, 1.0, 10.06], 200, 260] } },
    // S3: a guard on the manager's carpet between TWO harness lights of different colour AND class — a warm small point (sharp) east of him, a cool wide one (broad) west (s3Lights) — so
    // his two shadows cross: the band only the warm one cannot reach is lit blue, the band only the cool one cannot reach yellow (coloured penumbrae — the 'yellow / blue fringes')
    S3:  { pin: { look: [26.2, 0.3, 7.3], yaw: 20 * DEG, pitch: 58 * DEG, dist: 6.0 }, opts: { park: true, guards: [{ i: 1, pos: [26.3, 0, 6.9], yaw: 2.4, torch: false }], player: PARK }, tiles: { shadowA: [[25.7, 0.02, 7.5], 340, 240], shadowB: [[26.9, 0.02, 7.7], 340, 240], feet: [[26.3, 0.03, 6.95], 280, 170] } },
    // S4: Sam in the dark cubicle aisle, pistol up, aiming west along the aisle; the flash fires at the muzzle — floor, chair legs, the partition ends, his own legs cast the flash's shadows
    S4:  { pin: { look: [19.6, 0.4, 18.0], yaw: 160 * DEG, pitch: 52 * DEG, dist: 9 }, opts: { park: true, player: { pos: [20.4, 0, 18.0], yaw: -1.57, holstered: false, invisible: false } }, tiles: { samShadow: [[391, 664], 300, 200], chairNE: [[1185, 201], 280, 200], floorMid: [[1066, 498], 300, 200], partShadow: [[1398, 154], 260, 180], cartonEdge: [[900, 569], 260, 160] } },   // (output-px anchors placed off dq_look_S4_lit.jpg)
    // S5 = tjank scene A (its own harness stages it)
    // S6: TORCH SWEEP — guard 0 in the corridor by the storage door, torch on, turning at a fixed rate (and sliding a little, as a walking man's torch does) so the cone sweeps off Sam
    // (standing against the north wall) along the wall, across the storage door's frame and the lino; the follow camera's own numbers, closer (dist 13). Tiles in output px off the capture.
    S6:  { pin: { look: [31.4, 0.6, 10.5], yaw: -18 * DEG, pitch: 52 * DEG, dist: 11.5 }, opts: { park: true, player: { pos: [30.6, 0, 10.42], yaw: 0.3, holstered: true, invisible: false } },
           sweep: { p0: [31.2, 0.95, 11.75], p1: [31.7, 0.95, 11.7], from: [30.0, 0.25, 10.15], to: [33.9, 0.3, 10.15], frames: 40 },   // the torch slides half a metre east at hand height while its aim point runs along the north wall's foot from Sam to past the storage door
           tiles: { sam: [[30.6, 0.9, 10.42], 240, 330], door: [[32.6, 0.9, 10.05], 260, 300], wall: [[31.6, 1.0, 10.06], 300, 180], floor: [[31.8, 0.02, 10.9], 320, 180], strip: [[31.9, 0.6, 10.6], 800, 440] } },
  };
  async function boot() {
    for (let i = 0; i < 300 && !(window.__engine && window.__runFrames && document.getElementById('view')); i++) await yieldTask();
    pinViewport();
    if (!window.__errs) { window.__errs = []; E().device.addEventListener('uncapturederror', ev => window.__errs.push(ev.error.message)); }
    window.__testVisible = true; window.__shotPort = window.__shPort ?? (parseInt(location.port, 10) + 1); window.__pauseLoop = true;
    seed(); window.__menu?.close();
    if (window.__weather) { try { window.__weather.setEnabled(false); } catch { /* */ } }
    const p = panel11(); if (p) p.fluorescentFlicker = false;   // the tube steady unless a scene drives it (its dropout pattern follows the clock: a source of run-to-run difference in every cubicle capture)
    window.__runFrames(2, 1 / 60); await window.__perf.settle();
    return { res: [E().width, E().height, E().outWidth, E().outHeight], q: window.__quality?.current, sharpOn: E().sharpOn, knobs: window.__sharp?.knobs?.(), errs: window.__errs.slice(0, 3) };
  }
  /** stage scene `name` (pin + actors + hygiene), `steps` game steps so poses settle, then `settle` offscreen renders so every history converges; opts.each(k) between renders */
  async function stage(name, o = {}) {
    const sc = SCENES[name]; if (!sc) throw new Error('scenes: ' + Object.keys(SCENES).join(' '));
    const { steps = 10, settle = 40 } = o;
    window.__menu?.close(); seed();
    if (steadyLight) steadyLight.enabled = false;
    window.__stage(sc.pin, sc.opts); window.__perf.still();
    for (const gd of G().guards) if (gd.flashlight) gd.flashlight.enabled = false;
    await window.__perf.step(steps); window.__perf.still();
    if (sc.opts.player && sc.opts.player.holstered === false) { const pl = G().player; if (pl.setHolstered) pl.setHolstered(false); }
    await window.__perf.render(settle);
    return `${name} staged: ${steps} steps + ${settle} renders at ${E().width}×${E().height} → ${E().outWidth}×${E().outHeight}`;
  }
  async function readback() { const fr = await E().readbackFrame(); if (!fr) throw new Error('no offscreen frame'); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return { w: fr.w, h: fr.h, data: fr.data }; }
  function tileRect(p, w, h, fr) { const q = p.length === 2 ? [Math.round(p[0] * fr.h / 1000), Math.round(p[1] * fr.h / 1000)] : window.__perf.projectOut(p); if (!q) return null;   /* (a 2-vector = an OUTPUT-px anchor at 1000 rows, for tiles placed off a capture rather than a world point) */ const k = fr.h / 1000; const tw = Math.round(w * k), th = Math.round(h * k); return { x: Math.max(0, Math.min(fr.w - tw, q[0] - (tw >> 1))), y: Math.max(0, Math.min(fr.h - th, q[1] - (th >> 1))), w: tw, h: th }; }
  async function postCanvas(name, c, q = 0.9) { const blob = await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q)); const port = Number(window.__shotPort) || 5174; try { const r = await fetch(`http://localhost:${port}/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return `${name}.jpg ${c.width}x${c.height} → ${r.status}`; } catch (e) { return `${name}: ${e}`; } }
  async function postCrop(name, fr, r, scale = 3) {
    const c = document.createElement('canvas'); c.width = r.w * scale; c.height = r.h * scale; const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height);
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const so = ((r.y + Math.floor(j / scale)) * fr.w + (r.x + Math.floor(i / scale))) * 4, o = (j * c.width + i) * 4; img.data[o] = fr.data[so]; img.data[o + 1] = fr.data[so + 1]; img.data[o + 2] = fr.data[so + 2]; img.data[o + 3] = 255; }
    cx.putImageData(img, 0, 0); return postCanvas(name, c);
  }
  /** the whole readback as a JPEG (÷ down) — the page's context frames */
  async function postFrame(name, fr, down = 2, q = 0.85) {
    const c = document.createElement('canvas'); c.width = Math.floor(fr.w / down); c.height = Math.floor(fr.h / down); const cx = c.getContext('2d'); const img = cx.createImageData(c.width, c.height);
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { let rr = 0, gg = 0, bb = 0; for (let dy = 0; dy < down; dy++) for (let dx = 0; dx < down; dx++) { const so = ((j * down + dy) * fr.w + (i * down + dx)) * 4; rr += fr.data[so]; gg += fr.data[so + 1]; bb += fr.data[so + 2]; } const n = down * down, o = (j * c.width + i) * 4; img.data[o] = rr / n; img.data[o + 1] = gg / n; img.data[o + 2] = bb / n; img.data[o + 3] = 255; }
    cx.putImageData(img, 0, 0); return postCanvas(name, c, q);
  }
  /** the sharp path's shadowed direct pair (sharpE[0] + sharpE[1], linear, output size) → an 8-bit image through the frame's own exposure and a Reinhard curve: the direct-only view UNDER sharp direct */
  async function dirTerm() {
    const P = E().passes; if (!E().sharpOn || P.sharpE.length !== 2) return null;
    const a = await window.__perf.readTexture(P.sharpE[0]); const b = await window.__perf.readTexture(P.sharpE[1]);
    const w = a.w, h = a.h; const out = new Uint8ClampedArray(w * h * 4); const ex = S().exposure ?? 1;
    for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) { const v = (a.data[i * 4 + k] + b.data[i * 4 + k]) * ex / Math.PI; const t = v / (1 + v); out[i * 4 + k] = Math.round(255 * Math.pow(t, 1 / 2.2)); } out[i * 4 + 3] = 255; }
    return { w, h, data: out, code: a };
  }
  /** the INTERNAL denoised direct pair (passes.dS[0] + dS[1]) the same way — what the sharp kernel upsamples from */
  async function dirTermInternal() {
    const P = E().passes; const a = await window.__perf.readTexture(P.dS[0]); const b = await window.__perf.readTexture(P.dS[1]);
    const w = a.w, h = a.h; const out = new Uint8ClampedArray(w * h * 4); const ex = S().exposure ?? 1;
    for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) { const v = (a.data[i * 4 + k] + b.data[i * 4 + k]) * ex / Math.PI; const t = v / (1 + v); out[i * 4 + k] = Math.round(255 * Math.pow(t, 1 / 2.2)); } out[i * 4 + 3] = 255; }
    return { w, h, data: out };
  }
  /** capture the CURRENT frame under tag: whole frame (÷2), the scene's tiles ×3, the direct term's tiles ×3, the census; opts.paint = also a sliver-paint frame of the same tiles */
  async function cap(tag, name, o = {}) {
    const sc = SCENES[name]; const { paint = true, dir = true, whole = true } = o;
    const shots = []; const fr = await readback();
    if (whole) shots.push(await postFrame(`dq_${tag}_${name}_frame`, fr));
    const rects = {}; for (const [tn, [p, w, h]] of Object.entries(sc.tiles)) { const r = tileRect(p, w, h, fr); if (r) { rects[tn] = r; shots.push(await postCrop(`dq_${tag}_${name}_${tn}`, fr, r)); } }
    let census = null;
    if (E().sharpOn) {
      census = await T.census();
      if (dir) { const d = await dirTerm(); if (d) for (const [tn, r] of Object.entries(rects)) shots.push(await postCrop(`dq_${tag}_${name}_${tn}_dir`, d, r)); }
      if (paint) {
        const d0 = S().sharpDiag; S().sharpDiag = 1; await window.__perf.render(1); const pf = await readback(); S().sharpDiag = d0;
        for (const [tn, r] of Object.entries(rects)) shots.push(await postCrop(`dq_${tag}_${name}_${tn}_paint`, pf, r));
        await window.__perf.render(2);   // (the paint frame entered the TAA history: two clean renders wash most of it out; re-settle before measuring)
      }
    } else if (dir) { const d = await dirTermInternal(); const k = d.w / fr.w; for (const [tn, r] of Object.entries(rects)) shots.push(await postCrop(`dq_${tag}_${name}_${tn}_dirI`, d, { x: Math.floor(r.x * k), y: Math.floor(r.y * k), w: Math.floor(r.w * k), h: Math.floor(r.h * k) }, Math.round(3 / k))); }
    const out = { tag, name, res: [E().width, E().height, E().outWidth, E().outHeight], sharpOn: E().sharpOn, knobs: window.__sharp?.knobs?.(), census, rects, shots };
    ((T.res[name] = T.res[name] || {}))[tag] = out;
    return out;
  }
  /** the sliver census of the last frame with the LEAK counts: overDark = sliver pixels whose ray found dark what rule 0 would have borrowed lit (the bright lines), overLit = the reverse;
   *  opts.rect = only inside an output-px rect */
  async function census(rect = null) {
    const c = await window.__sharp.census(true); if (!c) return null;
    let ring = 0, sliver = 0, traced = 0, overDark = 0, overLit = 0, unsh = 0, n = 0;
    const x0 = rect ? rect.x : 0, y0 = rect ? rect.y : 0, x1 = rect ? rect.x + rect.w : c.w, y1 = rect ? rect.y + rect.h : c.h;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = c.mask[y * c.w + x]; n++; if ((k & 3) === 1) ring++; else if ((k & 3) === 2) sliver++; if (k & 4) traced++; if (k & 8) unsh++; if (k & 16) overDark++; if (k & 32) overLit++; }
    return { px: n, ring, sliver, traced, overDark, overLit, unshadowedDefault: unsh, sliverPct: +(100 * sliver / n).toFixed(3), leakPct: +(100 * overDark / n).toFixed(4) };
  }
  /** LEAK SURVEY: the follow camera (55°, dist, fov 28°) pinned over a grid of look points across the floor (x0‥x1 × z0‥z1 every `step` m, yaw as given), `settle` renders each,
   *  the census per view → rows sorted by overDark (where rule 0 drew the most bright slivers). Needs rule 1 live (the rays are what detect the leak). */
  async function survey(o = {}) {
    const { x0 = 6, x1 = 36, z0 = 6, z1 = 24, step = 3, yaw = -22 * DEG, pitch = 55 * DEG, dist = 21, settle = 16 } = o;
    const rows = [];
    for (let z = z0; z <= z1; z += step) for (let x = x0; x <= x1; x += step) {
      window.__stage({ look: [x, 0.4, z], yaw, pitch, dist }, { park: true, player: PARK }); window.__perf.still();
      await window.__perf.step(2); await window.__perf.render(settle);
      const c = await census(); rows.push({ x, z, ...c });
    }
    rows.sort((a, b) => b.overDark - a.overDark);
    T.surveyRows = rows; return rows.slice(0, 12);
  }
  /** S3's two lights: warm (1, .72, .42) point r 0.05 SHARP at (27.6, 1.7, 6.2), cool (.5, .66, 1) point r 0.3 BROAD at (24.6, 2.0, 8.1) — the manager's own lamp switched off so they are the only two */
  let s3L = null;
  function s3Lights(on) {
    const g = G(); try { g.setGroup('manager', !on); } catch { /* */ }
    if (!s3L) s3L = [E().lights.add({ name: 'dq_warm', group: 'test', kind: 0, pos: [27.6, 1.7, 6.2], dir: [0, -1, 0], color: [1.0, 0.72, 0.42], intensity: 7, range: 12, innerDeg: 0, outerDeg: 180, radius: 0.05, volumetric: 0.3, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 7 }),
                      E().lights.add({ name: 'dq_cool', group: 'test', kind: 0, pos: [24.6, 2.0, 8.1], dir: [0, -1, 0], color: [0.5, 0.66, 1.0], intensity: 9, range: 12, innerDeg: 0, outerDeg: 180, radius: 0.3, volumetric: 0.3, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 9, broad: true })];
    for (const l of s3L) l.enabled = !!on;
    for (const gd of G().guards) if (gd.flashlight) gd.flashlight.enabled = false;
    return s3L.map(l => l.name + (l.enabled ? ':on' : ':off'));
  }
  /** S4's light by hand: the muzzle flash's numbers (effects.ts shot: colour (1, .62, .26), power 90 × the Five-seveN's gain × the suppressed row's 0.45 ≈ 49, range 8, radius 0.08) at the muzzle
   *  point 0.45 m ahead of Sam at 1.35 m — as a TRANSIENT that never expires (lights.ts: the transient bit without a ttl = the stratum's path every frame: a flash frame held still, so its
   *  per-frame noise can be measured over many frames), as the same light PERSISTENT (the reservoirs' path, converged), or off */
  let flashL = null;
  function flashLight(mode = 'transient', o = {}) {
    const pos = o.pos || [19.95, 1.35, 18.0]; const I = o.intensity ?? 49; const radius = o.radius ?? 0.08;
    if (!flashL) flashL = E().lights.add({ name: 'dq_flash', group: 'test', kind: 0, pos: [...pos], dir: [0, -1, 0], color: [1.0, 0.62, 0.26], intensity: I, range: o.range ?? 8, innerDeg: 0, outerDeg: 180, radius, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I });
    flashL.pos = [...pos]; flashL.intensity = flashL.peakIntensity = I; flashL.radius = radius;
    flashL.enabled = mode !== 'off'; flashL.transient = mode === 'transient';
    return { mode, pos: flashL.pos, I, radius, transient: flashL.transient, enabled: flashL.enabled };
  }
  /** temporal statistics over `frames` offscreen renders of the CURRENT (still) state, per tile of scene `name`: mean luma, per-pixel temporal sd (mean over the tile), mean |Δ| frame to frame,
   *  and the spatial high-pass rms per frame (mean) — a flash frame's grain is spatial, a strobe's is both */
  async function noise(name, frames = 30, o = {}) {
    const sc = SCENES[name]; const { each = null } = o;
    let rects = null; const acc = {};
    let prevL = {};
    for (let f = 0; f < frames; f++) {
      if (each) await each(f);
      await window.__perf.render(1); const fr = await readback();
      if (!rects) { rects = {}; for (const [tn, [p, w, h]] of Object.entries(sc.tiles)) { const r = tileRect(p, w, h, fr); if (r) { rects[tn] = r; acc[tn] = { s1: new Float64Array(r.w * r.h), s2: new Float64Array(r.w * r.h), d: 0, dn: 0, hp: 0, means: [] }; } } }
      for (const [tn, r] of Object.entries(rects)) {
        const a = acc[tn]; const N = r.w * r.h; const L = new Float32Array(N); let m = 0;
        for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const v = luma(fr.data, ((r.y + j) * fr.w + r.x + i) * 4); const k = j * r.w + i; L[k] = v; a.s1[k] += v; a.s2[k] += v * v; m += v; }
        a.means.push(m / N);
        if (prevL[tn]) { let d = 0; const P = prevL[tn]; for (let k = 0; k < N; k++) d += Math.abs(L[k] - P[k]); a.d += d / N; a.dn++; }
        let hp = 0; for (let j = 1; j < r.h - 1; j++) for (let i = 1; i < r.w - 1; i++) { let sum = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += L[(j + dj) * r.w + i + di]; const d = L[j * r.w + i] - sum / 9; hp += d * d; } a.hp += Math.sqrt(hp / Math.max(1, (r.w - 2) * (r.h - 2)));
        prevL[tn] = L;
      }
    }
    const out = {};
    for (const [tn, a] of Object.entries(acc)) { const N = a.s1.length; let sd = 0; for (let k = 0; k < N; k++) { const m = a.s1[k] / frames; sd += Math.sqrt(Math.max(0, a.s2[k] / frames - m * m)); } out[tn] = { mean: +(a.means.reduce((x, y) => x + y, 0) / frames).toFixed(2), sd: +(sd / N).toFixed(3), absDelta: +(a.d / Math.max(1, a.dn)).toFixed(3), hp: +(a.hp / frames).toFixed(3), rect: rects[tn] }; }
    return out;
  }
  /** THE FLASH FRAME, K times: the scene dark and settled (`darkN` renders), the dice moved on, the flash light ON for exactly one render (= a muzzle flash's first frame: no history of it
   *  anywhere — the reservoirs never hold a transient, the shadow denoiser jumps, the TAA clips), read back; per tile the per-pixel sd ACROSS the K flash frames (the flash's own sampling
   *  noise as presented), the mean, the spatial high-pass; capture `keep` of them as crops (tag). mode 'transient' | 'steady' (the same light as a persistent one: the reservoirs' first frame of a NEW light) */
  async function flashFrames(name, K = 8, o = {}) {
    const { darkN = 16, mode = 'transient', tag = null, keep = 1, light = {} } = o;
    const sc = SCENES[name]; let rects = null; const acc = {}; const shots = [];
    for (let k = 0; k < K; k++) {
      flashLight('off'); await window.__perf.render(darkN);
      E().frameIdx += 7;
      flashLight(mode, light); await window.__perf.render(1);
      const fr = await readback();
      if (!rects) { rects = {}; for (const [tn, [p, w, h]] of Object.entries(sc.tiles)) { const r = tileRect(p, w, h, fr); if (r) { rects[tn] = r; acc[tn] = { s1: new Float64Array(r.w * r.h), s2: new Float64Array(r.w * r.h), hp: 0, means: [] }; } } }
      for (const [tn, r] of Object.entries(rects)) {
        const a = acc[tn]; const N = r.w * r.h; const L = new Float32Array(N); let m = 0;
        for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const v = luma(fr.data, ((r.y + j) * fr.w + r.x + i) * 4); const kk = j * r.w + i; L[kk] = v; a.s1[kk] += v; a.s2[kk] += v * v; m += v; }
        a.means.push(m / N);
        let hp = 0; for (let j = 1; j < r.h - 1; j++) for (let i = 1; i < r.w - 1; i++) { let sum = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += L[(j + dj) * r.w + i + di]; const d = L[j * r.w + i] - sum / 9; hp += d * d; } a.hp += Math.sqrt(hp / Math.max(1, (r.w - 2) * (r.h - 2)));
        if (tag && k < keep) shots.push(await postCrop(`dq_${tag}_${name}_${tn}_f${k}`, fr, r));
      }
      if (tag && k === 0) shots.push(await postFrame(`dq_${tag}_${name}_flash`, fr));
    }
    flashLight('off'); await window.__perf.render(4);
    const out = { K, mode, shots, tiles: {} };
    for (const [tn, a] of Object.entries(acc)) { const N = a.s1.length; let sd = 0; for (let kk = 0; kk < N; kk++) { const m = a.s1[kk] / K; sd += Math.sqrt(Math.max(0, a.s2[kk] / K - m * m)); } out.tiles[tn] = { mean: +(a.means.reduce((x, y) => x + y, 0) / K).toFixed(2), sd: +(sd / N).toFixed(3), hp: +(a.hp / K).toFixed(3) }; }
    return out;
  }
  // ------------------------------------------------------------------ S6: the torch sweep
  // A SYNTHETIC held torch — the guards' own numbers (game.tune.flashIntensity / flashInner / flashOuter, settings.flashlightRadius) on a light the harness owns, its OWNER byte set
  // (250: nobody's id, but a carried light to the estimator) — moved along a scripted hand-height path while it yaws: what a walking man's torch does to the picture, to the pixel,
  // run after run (a staged man's hand sways on clocks that differ by the run's start time: his pool landed tens of pixels apart between variants and no frame could be compared).
  let torchL = null;
  function torchLight(on, o = {}) {
    const g = G(); const tn = g.tune || {}; const I = o.intensity ?? tn.flashIntensity ?? 70; const inner = o.innerDeg ?? tn.flashInner ?? 7; const outer = o.outerDeg ?? tn.flashOuter ?? 19; const radius = o.radius ?? S().flashlightRadius ?? 0.07;
    if (!torchL) torchL = E().lights.add({ name: 'dq_torch', group: 'test', kind: 1, pos: [31, 0.95, 11.7], dir: [0, -0.3, -1], color: [1.0, 0.92, 0.78], intensity: I, range: 16, innerDeg: inner, outerDeg: outer, radius, volumetric: 1.0, owner: 250, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I, card: true });
    torchL.intensity = torchL.peakIntensity = I; torchL.innerDeg = inner; torchL.outerDeg = outer; torchL.radius = radius; torchL.owner = o.owner ?? 250; torchL.enabled = !!on;
    return torchL;
  }
  const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  /** the torch's pose at sweep parameter u ∈ [0, 1]: hand height, sliding along the corridor, aimed at a point that runs along the north wall's foot from `from` to `to` */
  function torchPose(sw, u) { const pos = [sw.p0[0] + (sw.p1[0] - sw.p0[0]) * u, sw.p0[1] + (sw.p1[1] - sw.p0[1]) * u, sw.p0[2] + (sw.p1[2] - sw.p0[2]) * u]; const aim = [sw.from[0] + (sw.to[0] - sw.from[0]) * u, sw.from[1] + (sw.to[1] - sw.from[1]) * u, sw.from[2] + (sw.to[2] - sw.from[2]) * u]; return { pos, dir: norm3([aim[0] - pos[0], aim[1] - pos[1], aim[2] - pos[2]]) }; }
  /** ONE variant of the sweep: stage S6 (Sam against the wall, guards parked dark, the pin), the torch on its first bearing for `warm` renders, the clocks back to a known point,
   *  then `frames` OFFSCREEN RENDERS each moving the torch one step (nothing else moves: no game step) and read back → per tile per frame: mean luma, spatial high-pass, the tile's
   *  lumas kept (T.sweeps[tag]) for rmse against another variant's same frames; the MOVING pool = a tile that follows the beam's landing point (its lit interior, and the whole with
   *  the cone's edge); the sharp path's census inside the sam / door rects every `censusEvery` frames; `strip` frames kept for the filmstrip + crops. */
  async function sweep(tag, o = {}) {
    const sc = SCENES.S6; const sw = { ...sc.sweep, ...(o.sweep || {}) }; const { warm = 40, strip = [4, 12, 20, 28, 36], seedIdx = 100, shots = true, censusEvery = 8, dt = 1 / 60 } = o;
    window.__menu?.close(); seed(); if (steadyLight) steadyLight.enabled = false; flashLight('off');
    window.__stage(sc.pin, sc.opts); window.__perf.still();
    fakeHidden = true; try { window.__runFrames(6, dt, []); } finally { fakeHidden = false; } await window.__perf.settle(); window.__perf.still();
    const L = torchLight(true, o.torch || {});
    const setPose = (k) => { const u = Math.max(0, Math.min(1, k / (sw.frames - 1))); const tp = torchPose(sw, u); L.pos = tp.pos; L.dir = tp.dir; };
    const beamHit = () => { const o2 = L.pos, d = L.dir; let t = 1e9; if (d[2] < -1e-3) t = Math.min(t, (10.06 - o2[2]) / d[2]); if (d[1] < -1e-3) t = Math.min(t, (0.0 - o2[1]) / d[1]); t = Math.min(t, 12); return [o2[0] + d[0] * t, o2[1] + d[1] * t, o2[2] + d[2] * t]; };
    setPose(0);
    let time = 500; for (let i = 0; i < warm; i++) { E().render(window.__cam, time, dt, false); time += dt; await window.__perf.settle(); }
    E().frameIdx = seedIdx; E().passes.resetClocks?.(); time = 600;
    for (let i = 0; i < 4; i++) { E().render(window.__cam, time, dt, false); time += dt; await window.__perf.settle(); }
    let rects = null; const per = {}; const keep = {}; const cen = []; const store = [];
    for (let k = 0; k < sw.frames; k++) {
      setPose(k);
      E().render(window.__cam, time, dt, false); time += dt; await window.__perf.settle();
      const fr = await readback();
      if (!rects) { rects = {}; for (const [tn, [p, w, h]] of Object.entries(sc.tiles)) { const r = tileRect(p, w, h, fr); if (r) { rects[tn] = r; per[tn] = { mean: [], hp: [] }; } } per.poolIn = { mean: [], hp: [] }; per.poolAll = { mean: [], hp: [] }; }
      const hit = beamHit(); const rIn = tileRect(hit, 130, 80, fr), rAll = tileRect(hit, 380, 240, fr);
      const dyn = { poolIn: rIn, poolAll: rAll };
      const frameStore = {};
      for (const [tn, r] of [...Object.entries(rects), ...Object.entries(dyn)]) {
        if (tn === 'strip' || !r) continue;
        const N = r.w * r.h; const Lm = new Float32Array(N); let m = 0;
        for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const v = luma(fr.data, ((r.y + j) * fr.w + r.x + i) * 4); Lm[j * r.w + i] = v; m += v; }
        per[tn].mean.push(+(m / N).toFixed(3));
        let hp = 0; for (let j = 1; j < r.h - 1; j++) for (let i = 1; i < r.w - 1; i++) { let sum = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += Lm[(j + dj) * r.w + i + di]; const d = Lm[j * r.w + i] - sum / 9; hp += d * d; } per[tn].hp.push(+Math.sqrt(hp / Math.max(1, (r.w - 2) * (r.h - 2))).toFixed(3));
        frameStore[tn] = Lm;
      }
      store.push(frameStore);
      if (E().sharpOn && censusEvery > 0 && k % censusEvery === 0) { const c = await window.__sharp.census(true); if (c) { const inRect = (r) => { let sl = 0, od = 0, ol = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const v = c.mask[y * c.w + x]; if ((v & 3) === 2) sl++; if (v & 16) od++; if (v & 32) ol++; } return { sliver: sl, overDark: od, overLit: ol }; }; cen.push({ k, sam: inRect(rects.sam), door: inRect(rects.door), pool: inRect(rAll), all: { sliver: c.sliver, traced: c.traced } }); } }
      if (strip.includes(k)) { keep[k] = fr; keep[k].poolAll = rAll; }
    }
    T.sweeps[tag] = store;
    const shotsOut = [];
    if (shots) { for (const [k, fr] of Object.entries(keep)) { shotsOut.push(await postCrop(`dq_${tag}_S6_strip_f${String(k).padStart(2, '0')}`, fr, rects.strip, 2)); shotsOut.push(await postCrop(`dq_${tag}_S6_poolAll_f${String(k).padStart(2, '0')}`, fr, fr.poolAll, 3)); for (const tn of ['sam', 'door']) shotsOut.push(await postCrop(`dq_${tag}_S6_${tn}_f${String(k).padStart(2, '0')}`, fr, rects[tn], 3)); } const kk = Object.keys(keep); if (kk.length) shotsOut.push(await postFrame(`dq_${tag}_S6_frame_f${kk[2] ?? kk[0]}`, keep[kk[2] ?? kk[0]])); }
    L.enabled = false; await window.__perf.render(2);
    const out = { tag, frames: sw.frames, rects, per, census: cen, shots: shotsOut, knobs: window.__sharp?.knobs?.(), res: [E().width, E().height, E().outWidth, E().outHeight] };
    ((T.res.S6 = T.res.S6 || {}))[tag] = out;
    return out;
  }
  /** rmse per tile per frame of sweep `tag` against sweep `ref` (same frames, same rects) + the mean over frames; the temporal |Δ| per tile (mean over frames) of `tag` alone */
  function sweepCompare(tag, ref) {
    const A = T.sweeps[tag], R = ref ? T.sweeps[ref] : null; if (!A) return null; const out = {};
    const names = Object.keys(A[0] || {});
    for (const tn of names) {
      const rm = []; const dl = [];
      for (let k = 0; k < A.length; k++) {
        const L = A[k][tn]; if (!L) continue; if (R && R[k] && R[k][tn] && R[k][tn].length === L.length) { const Q = R[k][tn]; let sq = 0; for (let i = 0; i < L.length; i++) { const d = L[i] - Q[i]; sq += d * d; } rm.push(Math.sqrt(sq / L.length)); }
        if (k > 0 && A[k - 1][tn] && A[k - 1][tn].length === L.length && tn !== 'poolIn' && tn !== 'poolAll') { const P0 = A[k - 1][tn]; let d = 0; for (let i = 0; i < L.length; i++) d += Math.abs(L[i] - P0[i]); dl.push(d / L.length); }
      }
      out[tn] = { rmseRef: rm.length ? +(rm.reduce((x, y) => x + y, 0) / rm.length).toFixed(3) : null, rmseByFrame: rm.map(v => +v.toFixed(2)), absDelta: +(dl.reduce((x, y) => x + y, 0) / Math.max(1, dl.length)).toFixed(3) };
    }
    return out;
  }
  /** THE HYBRID'S COST: three guards with torches lit + Sam's pistol light in ONE corridor view (S6's camera pulled back), AI off, torches turning slowly (a sweep every frame, as
   *  in play); per K in `ks` (interleaved `rounds` times): `n` serialized game frames → the direct pass mean / p95, the shadow denoiser, the union. */
  async function costHeld(o = {}) {
    const { ks = [0, 2, 3, 4, 8], rounds = 3, n = 24, warm = 6 } = o;
    const g = G(); const S0 = S(); const RP = ['gbuffer', 'composite', 'post', 'fxaa', 'pdraw', 'gdown'];
    const ai0 = g.aiEnabled; g.aiEnabled = false; if (steadyLight) steadyLight.enabled = false; flashLight('off');
    const pin = { look: [30.6, 0.5, 11.0], yaw: -18 * DEG, pitch: 52 * DEG, dist: 15 };
    const gs = [{ i: 0, pos: [28.4, 0, 11.6], yaw: 0, torch: true, aimPitch: -0.35 }, { i: 1, pos: [31.0, 0, 11.7], yaw: 0, torch: true, aimPitch: -0.35 }, { i: 2, pos: [33.4, 0, 11.5], yaw: 0, torch: true, aimPitch: -0.35 }];
    window.__stage(pin, { park: true, guards: gs, player: { pos: [30.0, 0, 10.6], yaw: 1.4, holstered: false, invisible: false } });
    for (const q of gs) { const gd = g.guards[q.i]; gd.state = 'patrol'; gd.awareness = 0; }
    const pl = g.player; if (pl.setHolstered) pl.setHolstered(false); pl.pistol.lightOn = true; pl.aimHeld = true;
    window.__perf.still();
    const pose = (k) => { for (let j = 0; j < gs.length; j++) { const gd = g.guards[gs[j].i]; const y = 0.6 * Math.sin(k * 0.05 + j * 2.1) + (j - 1) * 0.4 + 3.3; gd.char.bodyYaw = y; gd.char.aimYaw = y; gd.char.aimPitch = -0.35; gd.char.pos = [...gs[j].pos]; } };
    fakeHidden = true; try { for (let i = 0; i < 60; i++) { pose(i); window.__runFrames(1, 1 / 60, []); } } finally { fakeHidden = false; } await window.__perf.settle();
    const t = E().timer; const out = {}; let k = 60;
    const one = async () => { pose(k++); const before = t.resolved; fakeHidden = true; try { window.__runFrames(1, 1 / 60, []); } finally { fakeHidden = false; } await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); for (let z = 0; z < 400 && t.resolved === before; z++) { if ((z & 15) === 15) await E().device.queue.onSubmittedWorkDone(); await yieldTask(); } if (t.resolved === before) return null; const passes = {}; for (const [kk, v] of t.lastFrame) passes[kk] = v; return { direct: passes.direct ?? 0, softblur: passes.softblur ?? 0, sharpU: passes.sharpU ?? 0, union: t.unionMs ? t.unionMs(RP) : 0 }; };
    for (let r = 0; r < rounds; r++) for (const K of (r % 2 ? [...ks].reverse() : ks)) { S0.heldRays = K; for (let i = 0; i < warm; i++) await one(); const acc = { direct: [], softblur: [], sharpU: [], union: [] }; for (let i = 0; i < n; i++) { const f = await one(); if (!f) continue; for (const kk of Object.keys(acc)) acc[kk].push(f[kk]); } (out['K' + K] = out['K' + K] || []).push(Object.fromEntries(Object.entries(acc).map(([kk, a]) => { const b = [...a].sort((x, y) => x - y); return [kk, { mean: +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(3), p95: +(b[Math.min(b.length - 1, Math.floor(0.95 * (b.length - 1)))] ?? 0).toFixed(3) }]; }))); }
    S0.heldRays = base ? base.heldRays : 4; g.aiEnabled = ai0; pl.aimHeld = false;
    const lit = E().lights.lights.filter(l => l.enabled && (l.owner & 255)).map(l => l.name);
    const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    const summary = Object.fromEntries(Object.entries(out).map(([kk, rows]) => [kk, { direct: +med(rows.map(r => r.direct.mean)).toFixed(2), directP95: +med(rows.map(r => r.direct.p95)).toFixed(2), softblur: +med(rows.map(r => r.softblur.mean)).toFixed(2), union: +med(rows.map(r => r.union.mean)).toFixed(2), unionP95: +med(rows.map(r => r.union.p95)).toFixed(2) }]));
    return { heldLights: lit, res: [E().width, E().height, E().outWidth, E().outHeight], summary, rows: out };
  }
  /** ONE TIER's battery (the page's per-tier rows): pin the preset, then S6 noise (main vs ship, two seeds each, frames 12‥), S4's flash frame (main = 1 ray vs the tier's K vs old),
   *  the hybrid's cost rig (K 0 vs the tier's K vs 8) → T.tiers[tier]; opts.parts to run a subset */
  async function tierRun(tier, o = {}) {
    const { parts = ['s6', 's4', 'cost'], costRounds = 2 } = o;
    if (window.__quality?.pin) { window.__quality.pin(tier); }
    fakeHidden = true; try { window.__runFrames(3, 1 / 60, []); } finally { fakeHidden = false; } await window.__perf.settle();
    rebase(); const K = S().heldRays; const out = { tier, res: [E().width, E().height, E().outWidth, E().outHeight], K, scale: S().renderScale };
    if (parts.includes('s6')) {
      const V = { main: () => { oldRenderer(false); apply('main'); }, ship: () => { oldRenderer(false); apply('ship'); } };
      if (o.withOld) V.old = () => { apply('main'); oldRenderer(true); };
      out.s6 = {};
      for (const [tag, ap] of Object.entries(V)) { ap(); await window.__perf.render(4); await sweep(`${tier}_${tag}A`, { censusEvery: 0, shots: tag !== 'old' && !!o.shots, seedIdx: 100, strip: [20] }); await sweep(`${tier}_${tag}B`, { censusEvery: 0, shots: false, seedIdx: 137 }); const c = sweepCompare(`${tier}_${tag}B`, `${tier}_${tag}A`); out.s6[tag] = Object.fromEntries(Object.entries(c).map(([tn, v]) => { const f = v.rmseByFrame.slice(12); const m = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length); return [tn, +(m / Math.SQRT2).toFixed(3)]; })); delete T.sweeps[`${tier}_${tag}A`]; delete T.sweeps[`${tier}_${tag}B`]; }
      oldRenderer(false); apply('ship');
    }
    if (parts.includes('s4')) {
      out.s4 = {}; apply('ship'); await stage('S4');
      S().heldRays = 0; out.s4.main = (await flashFrames('S4', 8, { tag: o.shots ? `${tier}fl0` : null })).tiles;
      S().heldRays = K; out.s4.ship = (await flashFrames('S4', 8, { tag: o.shots ? `${tier}flK` : null })).tiles;
      if (o.withOld) { oldRenderer(true); await window.__perf.render(20); out.s4.old = (await flashFrames('S4', 8, {})).tiles; oldRenderer(false); }
      apply('ship');
    }
    if (parts.includes('cost')) { out.cost = (await costHeld({ ks: [...new Set([0, K, 8])], rounds: costRounds, n: 20 })).summary; apply('ship'); }
    T.tiers[tier] = out; return out;
  }
  /** POST T.res-ish JSON to the shot sink's /perf → docs/perf/<name>.json */
  async function saveJson(name, obj) { const port = Number(window.__shotPort) || 5174; const r = await fetch(`http://localhost:${port}/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } }); return r.status; }
  /** per-tile mean luma + spatial high-pass rms of the current frame (a still's grain) */
  async function tileStats(name) {
    const sc = SCENES[name]; const fr = await readback(); const out = {};
    for (const [tn, [p, w, h]] of Object.entries(sc.tiles)) { const r = tileRect(p, w, h, fr); if (!r) continue; let m = 0; const L = new Float32Array(r.w * r.h); for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const v = luma(fr.data, ((r.y + j) * fr.w + r.x + i) * 4); L[j * r.w + i] = v; m += v; } m /= L.length; let hp = 0; for (let j = 1; j < r.h - 1; j++) for (let i = 1; i < r.w - 1; i++) { let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += L[(j + dj) * r.w + i + di]; const d = L[j * r.w + i] - s / 9; hp += d * d; } out[tn] = { mean: +m.toFixed(2), hp: +Math.sqrt(hp / Math.max(1, (r.w - 2) * (r.h - 2))).toFixed(3) }; }
    return out;
  }
  /** apply a variant by name (each ONE switch off the shipping config unless noted) → the settings written */
  const VARIANTS = {
    ship:      {},                                            // this branch's defaults (rule 1 slivers, gbaa clamp, flash / jump rays per tier)
    main:      { sharpSliver: 0, gbaaClamp: false, heldRays: 0, restirHueSplit: false },   // = main's behaviour on this build (every new switch at its 'as it was' value)
    sliver0:   { sharpSliver: 0 },                            // the old borrow-anything fallback alone
    noRayCap0: { sharpSliverCap: 0 },                         // rule 1 with NO rays: the conservative remainder rule for the whole class
    clampOff:  { gbaaClamp: false },
    gbaaOff:   { gbaa: false },
    decOff:    { sharpDecouple: false },
    sharpOff:  { sharpDirect: false },                        // (the internal path: TAAU upscale of the internal composite)
    held0:     { heldRays: 0 }, held2: { heldRays: 2 }, held3: { heldRays: 3 }, held8: { heldRays: 8 },   // the hybrid's K alone (0 = the transient stratum as it was)
  };
  const BASE_KEYS = ['sharpSliver', 'sharpSliverCap', 'sharpDiag', 'gbaaClamp', 'gbaa', 'sharpDecouple', 'sharpDirect', 'heldRays', 'restirHueSplit', 'meshShadows', 'restir', 'denoiser', 'froxelVol', 'taau', 'renderScale'];
  let base = null;
  function apply(name, extra = {}) {
    const s = S(); if (!base) { base = {}; for (const k of BASE_KEYS) base[k] = s[k]; }
    const v = { ...(VARIANTS[name] || {}), ...extra }; if (!VARIANTS[name] && !Object.keys(extra).length) throw new Error('variants: ' + Object.keys(VARIANTS).join(' '));
    for (const k of BASE_KEYS) s[k] = base[k];
    for (const [k, val] of Object.entries(v)) s[k] = val;
    return Object.fromEntries(BASE_KEYS.map(k => [k, s[k]]));
  }
  /** after a preset hop: forget the captured base (its renderScale / K belong to the old tier) so the next apply() re-reads the tier's own */
  function rebase() { base = null; return apply('ship'); }
  /** the OLD renderer for the flash / strobe references: every v3 system off, scale 1.0 (tjank's allOff) */
  function oldRenderer(on) { const s = S(); if (!base) apply('ship'); if (on) { s.restir = false; s.denoiser = 'legacy'; s.froxelVol = false; s.taau = false; s.renderScale = 1.0; s.sharpDirect = false; } else { for (const k of BASE_KEYS) s[k] = base[k]; } return { restir: s.restir, denoiser: s.denoiser, froxelVol: s.froxelVol, taau: s.taau, scale: s.renderScale }; }
  const T = { SCENES, VARIANTS, res: {}, sweeps: {}, tiers: {}, boot, stage, cap, apply, oldRenderer, census, survey, flashLight, noise, flashFrames, sweep, sweepCompare, torchLight, torchPose, costHeld, tierRun, saveJson, rebase, s3Lights, readback, tileRect, postCrop, postFrame, postCanvas, dirTerm, dirTermInternal, tileStats, seed, pinViewport, get steadyLight() { return steadyLight; }, set steadyLight(v) { steadyLight = v; }, setFakeHidden(v) { fakeHidden = !!v; } };
  window.__dq = T;
  return 'dq ready: __dq.{boot, stage(S1|S1b|S1c|S2|S2b|S3|S4), cap(tag, scene), apply(variant), tileStats(scene), dirTerm()}';
})();
