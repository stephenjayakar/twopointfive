// capsule-cleanup lane: deterministic identity stills with MEN ON SCREEN (paste into a ?paused&quality=<p>&mute boot once __ready resolved).
// window.__idrun(tag, {png}) → window.__idres = { tag, preset, res, views: { name: hash } } ; PNGs to this lane's sink (:5215) when png.
(() => {
  window.__testVisible = true; window.__shotPort = 5215;
  const E = () => window.__engine, G = () => window.__game;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  function seed(s0 = 4242) { Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // views: corridor with the shift's three men lit by their own torches; the lobby's four men under the two panels; the cubicles with two men and a torch; cubicles empty (the reproducible reference)
  const VIEWS = {
    corr3: { pin: { look: [24.5, 0, 11.1], yaw: 90 * DEG, pitch: 38 * DEG, dist: 7 }, guards: [{ i: 0, pos: [22.5, 0, 11.4], yaw: Math.PI / 2, torch: true, aimPitch: -0.3 }, { i: 1, pos: [25.5, 0, 10.7], yaw: -Math.PI / 2, torch: true, aimPitch: -0.35 }, { i: 2, pos: [27.8, 0, 11.3], yaw: Math.PI, torch: true, aimPitch: -0.25 }], player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } },
    lobby4: { pin: { look: [9.4, 0, 21.4], yaw: 180 * DEG, pitch: 40 * DEG, dist: 6.8 }, lights: ['lobby'], guards: [{ i: 0, pos: [8.4, 0, 21.2], yaw: 3.14, torch: false }, { i: 1, pos: [10.6, 0, 21.8], yaw: -1.2, torch: false }, { i: 2, pos: [9.4, 0, 23.2], yaw: 3.14, torch: false }], player: { pos: [9.7, 0, 19.9], yaw: 0, holstered: true, invisible: true } },
    cub2: { pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 9 }, guards: [{ i: 0, pos: [19.2, 0, 17.0], yaw: 0.6, torch: true, aimPitch: -0.3 }, { i: 1, pos: [21.4, 0, 18.6], yaw: -2.2, torch: false }], player: { pos: [20.3, 0, 16.2], yaw: 2.4, holstered: true, invisible: true, crouch: true } },
    cubicles: { pin: { look: [20, 0, 17.5], yaw: -20 * DEG, pitch: 55 * DEG, dist: 11 }, guards: [], player: { pos: [14, 0, 20], yaw: 1.57, holstered: true, invisible: true } },
  };
  function hash(a) { let h = 0x811c9dc5; for (let i = 0; i < a.data.length; i++) { if ((i & 3) === 3) continue; h ^= a.data[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  async function readback() { const fr = await E().readbackFrame(); if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; } return fr; }
  async function png(name, fr) {
    const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h; const d = new Uint8ClampedArray(fr.data.length); d.set(fr.data); for (let i = 3; i < d.length; i += 4) d[i] = 255;
    c.getContext('2d').putImageData(new ImageData(d, fr.w, fr.h), 0, 0);
    const blob = await new Promise(res => c.toBlob(b => res(b), 'image/png'));
    const r = await fetch(`http://localhost:5215/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
    return r.status;
  }
  let litGroups = [];
  async function stageView(name) {
    const v = VIEWS[name]; const g = G();
    window.__stage(v.pin, { park: true, guards: v.guards, player: v.player });
    g.guards.forEach(gd => { gd.lightDeadUntil = 1e9; }); for (const s of v.guards) { const gd = g.guards[s.i]; if (gd) gd.lightDeadUntil = s.torch ? 0 : 1e9; }   // parked / torch:false men hold their lens dead against the carry rule
    for (const gr of litGroups) if (!(v.lights ?? []).includes(gr)) g.setGroup(gr, false);
    for (const gr of v.lights ?? []) g.setGroup(gr, true);
    litGroups = [...(v.lights ?? [])];
    const A = window.__anim; if (A) { A.LIFE.on = 0; A.FEET.on = 0; } E().passes.grain = 0;
    for (const gd of g.guards) gd.char.anim.phase = 0; g.player.char.anim.phase = 0;
  }
  async function one(name, frames, opts) {
    await stageView(name);
    for (let i = 0; i < 6; i++) { window.__runFrames(1, 1 / 60, []); await settle(); }   // poses / torches / lights settle a few game frames
    window.__resetClock(); E().passes.grain = 0;
    for (let i = 0; i < frames; i++) { window.__runFrames(1, 1 / 60, []); if ((i & 7) === 7) await settle(); }
    await settle();
    E().render(window.__cam, 100, 1 / 60, false); await settle();   // (frame.time = 100 as p5's identityHash renders it, not the stepped clock: time-keyed terms — flicker, blink, rain phase — jump for this one frame, identically on every boot / tree; a __png of the same staging will NOT hash alike)
    const fr = await readback();
    const h = hash(fr);
    let posted = null; if (opts.png) posted = await png(`${opts.tag}_${name}`, fr);
    return { hash: h, res: [fr.w, fr.h], posted };
  }
  window.__idrun = (tag, opts = {}) => {
    const { png: doPng = false, frames = 40, views = ['corr3', 'lobby4', 'cub2', 'cubicles'], size = [1422, 800], debug = 0 } = opts;
    window.__idres = null; window.__iderr = null;
    (async () => {
      try {
        const view = document.getElementById('view'); view.style.width = size[0] + 'px'; view.style.height = size[1] + 'px'; document.body.style.minWidth = size[0] + 'px'; document.body.style.minHeight = size[1] + 'px';
        window.__menu?.close(); seed(4242);
        G().restartEncounter();   // fresh Player / Guards under the SEEDED dice: every construction-time random (glance clocks, waits) the same on every boot
        window.__runFrames(1, 1 / 60, []); await settle();
        E().settings.debugView = debug;
        const out = { tag, preset: window.__quality?.current, scale: E().settings.renderScale, views: {}, res: null, settings: { restir: E().settings.restir, taau: E().settings.taau, sharp: E().settings.sharpDirect, mesh: E().settings.meshShadows, rt: E().settings.rtReflect, fitted: !!(window.__sdfrig && window.__sdfrig.live), smooth: E().settings.sdfRigSmooth, soft: E().settings.charSoftShadow, debug } };
        for (const vn of views) { const r = await one(vn, frames, { png: doPng, tag }); out.views[vn] = r.hash; out.res = r.res; out['posted_' + vn] = r.posted; }
        window.__idres = out;
      } catch (e) { window.__iderr = String(e && e.stack || e); }
    })();
    return 'started ' + tag;
  };
  return 'identity script ready: __idrun(tag, {png, frames, views, size, debug}) → poll window.__idres / __iderr';
})();
