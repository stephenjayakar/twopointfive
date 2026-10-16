// cut-stills.cjs — BEFORE / AFTER stills of broken walls, cover and furniture (the loud level levels/block-squads.json; the warehouse's front office for `office`), drawn by the real page in headless
// Chromium on the software WebGPU adapter (SwiftShader: the cloud box has no GPU). One FRESH BOOT per scene, every step scripted, so two runs of the
// same checkout give the same scene: same seed, same pinned camera, same frame counts.
//
//   node tools/qa/cut-stills.cjs --root <checkout dir> --out <dir> --tag before|after [--cut] [--scene wall|cover|furniture|all] [--quality high] [--w 960 --h 540]
//
//   --cut            adds `cutboxes` to the page's URL (broken pieces are cut boxes); without it `nocutboxes` (plain boxes, whatever localStorage says)
//   --scene          wall (stills wall-near, wall-top) · cover (cover-near) · furniture (furniture-near) · outer (a wall charge on the compound hut's OUTER wall: outer-near, outer-out, outer-top) · office (a wall charge on the warehouse's front office: the desk and two
//                    cabinets behind the wall — office-near, office-top) · room (the workshop after all three events: room-wide) · all (default)
//   --settle N       render-only frames before each read-back, nothing moving (40)        --physics N   game frames stepped UNDRAWN after the event (240 = 4 s)
//   --sharp          leave the page's output-resolution direct light on (default: `nosharp` in the URL — it halves a software frame; the same picture a little softer)
//   --exposure K     the picture's exposure × K (1)                                         --port N      the dev server's port (default: a free one)
//   --rounds N       cover scene: rifle rounds fired (6)                                    --chaos K     tune.chaos (0.5)
//   --q 'a=1&b'      more page flags
//   --cam a,b        only these cameras of the scene (a still is minutes on the software adapter)
//   --pre 'js'       evaluated in the page right before the event (e.g. `__game.destr.breaks.look.on = false`: the wall's edges cut by the break table, no edge-look plates)
// Files: <out>/<scene>-<camera>-<tag>.png and <out>/stills-<tag>-<scene>.json (what was done, the numbers, the errors seen).
//
// WHAT A SCENE DOES (all in page, ?paused — nothing runs but what is stepped here):
//   boot → __ready → menu closed → SMOKE SOLVER OFF (`__smoke.params.enabled = false`: its 15 pipelines cannot be made on SwiftShader and one live domain — a
//   blast's dust puff — makes every frame an invalid command buffer; so NO dust / smoke is in these pictures) → weather off (no lightning stroke in a still) →
//   Math.random seeded (4242) → restartEncounter() → anim phases zeroed → god mode, AI off, chaos set, the workshop's light group on → __stage(pin, { park, player parked far off, holstered,
//   invisible }) → __resetClock() → 2 drawn frames → THE EVENT → `physics` game frames with engine.render stubbed out (the page's own frame order, nothing drawn)
//   → 1 drawn frame (the GPU takes the scene; waiting particle records are born) → `settle` render-only frames at a held game clock (the first settle−10 with a
//   particle dt of 1/15 s so chips and paper land, the last 10 at 1/480 s) → the engine's own read-back → PNG.
// Sam is never in a still: he is parked at PARK (outside the building, out of every frame), holstered (no light), `playerInvisible` set.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);
if (!flag('--root') || !flag('--out') || !/^(before|after)$/.test(flag('--tag', ''))) { console.error('usage: node stills.cjs --root <checkout dir> --out <dir> --tag before|after [--cut] [--scene wall|cover|furniture|all] [--quality high] [--w 960 --h 540] [--settle 40] [--physics 240] [--sharp] [--exposure 1] [--port N]'); process.exit(2); }
const ROOT = path.resolve(flag('--root')), OUT = path.resolve(flag('--out')), TAG = flag('--tag'), CUT = has('--cut');
const QUALITY = flag('--quality', 'high'), VW = Number(flag('--w', 960)), VH = Number(flag('--h', 540));
const SETTLE = Number(flag('--settle', 40)), PHYSICS = Number(flag('--physics', 240)), EXPOSURE = Number(flag('--exposure', 1)) || 1;
const ROUNDS = Number(flag('--rounds', 6)), CHAOS = Number(flag('--chaos', 0.5)), SEED = 4242;
const WANT = flag('--scene', 'all');
const DEG = Math.PI / 180;
const LEVEL = 'block-squads.json';
const LIT = ['shop'];   // light groups switched ON for every scene (game.setGroup): the workshop's second ceiling panel, (20.5, 2.98, 17) — off as authored — so pieces by the partition cast shadows; its first, (17, 2.98, 19.5), is on anyway
const PARK = [30, 0, 2];   // Sam's place for every still: outside the north wall, 18 m or more from every look-at point

// ---------------------------------------------------------------- the scenes (metres; yaw / pitch in degrees; a camera sits at look + dist × (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch))
const SCENES = {
  // a charge on the HALL side of the hall | workshop partition (drywall, breakable #58: centre (15.43, 1.5, 15.26), 8.74 m along x, 0.12 thick), 0.3 m off its
  // north face at the column whose centre is x 17.49 (open floor both sides: 2.5 m of hall, 6 m of workshop). The workshop's lit ceiling panel is at (17, 2.98, 19.5).
  wall: {
    event: { kind: 'blast', at: [17.49, 0.3, 14.9], opts: { who: 1 } },
    cams: [
      { name: 'near', look: [17.5, 0.9, 15.6], yaw: 20, pitch: 35, dist: 6.2 },    // from the workshop (the far side), 5.1 m off on the floor: the hole, both stubs, the standing wall either side and 3 m of floor
      { name: 'top', look: [17.49, 0, 15.26], yaw: -22, pitch: 55, dist: 21 },     // the game's own follow camera (camera.ts: yaw −22°, pitch 55°, 21 m) on the same spot
      { name: 'ends', look: [17.5, 1.75, 15.3], yaw: 24, pitch: 10, dist: 6.4 },   // (only with --cam ends) eye a little over head height, level: both standing ends from the floor to the wall's top
    ],
  },
  // rifle rounds into the carton in the workshop (cover, cardboard, breakable #149: centre (16.2, 0.56, 19.4), 1.12 × 0.88 × 0.92 m, 4 cells — this level has no
  // wooden crate: its wood cover is the desks' 6 cm side panels). Sam stands 2.2 m south of it and fires down into its west half, so rounds that get through end in the floor.
  cover: {
    event: { kind: 'fire', id: 149, from: [16.2, 0, 21.6], aim: [15.92, 0.41, 19.6], rounds: ROUNDS, every: 6 },
    cams: [{ name: 'near', look: [16.0, 0.3, 19.4], yaw: -40, pitch: 40, dist: 3.8 }],   // 2.9 m off on the floor, from the south-west: the broken end of what stands faces the camera
  },
  // a blast on the workshop floor 1 m north of the desk on its south wall (top (16.6, 0.73, 23.4), 23.05 ≤ z ≤ 23.75: a monitor at x 17.1, papers at 16.5, clutter at 16.1)
  furniture: {
    event: { kind: 'blast', at: [16.6, 0.3, 22.05], opts: { who: 1 } },
    cams: [{ name: 'near', look: [16.5, 0.5, 22.8], yaw: 195, pitch: 40, dist: 5.4 }],   // from the north (the lit panel's side), 4.1 m off on the floor
  },
  // THE WAREHOUSE's front office (levels/warehouse.json): a wall charge on the corridor side of its east wall (drywall, x 10, z 15 to 21.8) at z 19.6. Behind the wall: the desk
  // with its monitor (top (8.2, 0.73, 18.2)) and the two steel cabinets standing against it (9.55, 0.66, 20.2 / 20.8) — the furniture of the wall entry.
  office: {
    level: 'warehouse.json', lit: ['offices', 'corridor'], park: [38, 0, 26],
    event: { kind: 'blast', at: [10.3, 0.3, 19.6], opts: { who: 1 } },
    again: { at: [10.3, 0.3, 17.4], opts: { who: 1 } },   // --evict: a second charge 2.2 m along the same wall, once the first one's pieces lie still
    cams: [
      { name: 'near', look: [8.9, 0.5, 19.5], yaw: -75, pitch: 38, dist: 5.6 },     // from inside the office, west of the desk: the hole, the cabinets and the desk between camera and wall
      { name: 'top', look: [9.2, 0, 19.4], yaw: -45, pitch: 62, dist: 11 },         // from above the office's south-west, over the wall into the corridor
    ],
  },
  // THE COMPOUND's guard hut (levels/compound.json): a wall charge set from OUTSIDE on the hut's outer wall — concrete, 0.24 m, static 19: x 4, z 15.5 to 24, the yard west of
  // it and the hut's lit room east — at z 20.6 (WALLCHARGE.outer: wallcharge.ts outerWall, wallbreak.ts adopt). The module's own blow(), so the report and the flash are in it.
  outer: {
    level: 'compound.json', lit: ['hut'], park: [1.5, 0, 6],   // (Sam parked WEST of the wall: the side the charge is set from is his)
    event: { kind: 'wallcharge', at: [4, 1.05, 20.6] },
    cams: [
      { name: 'near', look: [4.5, 0.8, 20.6], yaw: 78, pitch: 32, dist: 5.6 },     // from inside the hut: the breach, the standing wall either side, what it threw across the floor
      { name: 'out', look: [3.7, 0.8, 20.6], yaw: -105, pitch: 26, dist: 6.5 },    // from the yard, the side it was set from
      { name: 'top', look: [4, 0, 20.6], yaw: -22, pitch: 55, dist: 21 },          // the game's own follow camera on the same spot
    ],
  },
  // THE WORKSHOP AFTER A FIGHT: the wall scene's charge, the cover scene's rounds and the furniture scene's blast one after another, then one wide look from the game's own angle
  room: {
    events: [
      { kind: 'blast', at: [17.49, 0.3, 14.9], opts: { who: 1 } },
      { kind: 'fire', id: 149, from: [16.2, 0, 21.6], aim: [15.92, 0.41, 19.6], rounds: ROUNDS, every: 6 },
      { kind: 'blast', at: [16.6, 0.3, 22.05], opts: { who: 1 } },
    ],
    cams: [{ name: 'wide', look: [17.0, 0, 19.0], yaw: -22, pitch: 55, dist: 13 }],
  },
};
const scenes = WANT === 'all' ? Object.keys(SCENES).filter(k => k !== 'outer') : WANT.split(',');   // ('outer' is asked for by name: 'all' is the cut pieces' set, and it is run on checkouts where no outer wall takes a charge)
for (const s of scenes) if (!SCENES[s]) { console.error(`--scene: '${s}' is not one of ${Object.keys(SCENES).join(' | ')} | all`); process.exit(2); }

// (node 22's maths in the page — film.cjs's flags — then the SwiftShader set that lets a WebGPU canvas present: rebuild/iteration/probe.md §4)
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's 15 pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0), log = (...a) => console.log(`[${secs()}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

let srv = null, browser = null;
const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });

async function scene(port, name) {
  const S = SCENES[name], t0 = Date.now(), errors = []; let noise = 0;
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error') return; if (NOISE.test(x)) { noise++; return; } errors.push(x.slice(0, 500)); if (errors.length < 10) log('console.error', x.slice(0, 400)); });
  const LVL = S.level || LEVEL, LITS = S.lit || LIT, PARKED = S.park || PARK;
  const q = ['paused', 'mute', `quality=${QUALITY}`, `levelFile=${LVL}`, CUT ? 'cutboxes' : 'nocutboxes', has('--sharp') ? '' : 'nosharp', flag('--q', '')].filter(Boolean).join('&');
  const url = `http://localhost:${port}/?${q}`;
  log(name, 'goto', url);
  await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 240) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  // ---- boot, the determinism recipe, the staging
  const CAMS = flag('--cam') ? S.cams.filter(c => flag('--cam').split(',').includes(c.name)) : S.cams.filter(c => c.name !== 'ends'); if (!CAMS.length) throw new Error(`no camera ${flag('--cam')} in scene ${name}`);
  const c0 = CAMS[0];
  const pinOf = c => ({ look: c.look, yaw: c.yaw * DEG, pitch: c.pitch * DEG, dist: c.dist });
  const boot = await page.evaluate(async ([seed, chaos, pin, park, exposure, lit]) => {
    window.__testVisible = true; await window.__ready; if (window.__cut && window.__cut.programs && window.__cut.programs.swap) await window.__cut.programs.ready;   /* the second set of ray programs (render/cutSwap.ts) compiles after boot: a cut piece is traced whole until it is in */
    const g = window.__game, E = window.__engine;
    window.__menu.close();
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false;   // THE TRAP: no live smoke domain on SwiftShader (see the head)
    try { window.__weather.setEnabled(false); } catch { }
    let s0 = seed; Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    g.restartEncounter();
    for (const c of [g.player.char, ...g.guards.map(x => x.char)]) c.anim.phase = 0;
    g.godMode = true; g.aiEnabled = false; window.__destr.chaos = chaos; for (const grp of lit) { try { g.setGroup(grp, true); } catch (e) { console.warn('setGroup ' + grp + ': ' + e); } }
    if (exposure !== 1) E.settings.exposure *= exposure;
    const staged = window.__stage(pin, { park: true, player: { pos: park, yaw: 0, holstered: true, invisible: true } });
    window.__resetClock();
    // the page's frame order with nothing drawn: engine.render stubbed (it still tells us the clock the loop is on)
    const real = E.render.bind(E); window.__lastT = 0;
    window.__draw = on => { E.render = on ? (c, t, dt, p) => { window.__lastT = t; return real(c, t, dt, p); } : (c, t) => { window.__lastT = t; }; };
    window.__real = real; window.__draw(true);
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    window.__fnvFrame = async () => { const fr = await E.readbackFrame(); if (!fr) return null; let h = 2166136261; for (let i = 0; i < fr.data.length; i++) { h ^= fr.data[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    const b = window.__boot || {};
    return { pipelines: b.pipelines, adapter: E.gpu && E.gpu.adapterInfo, internal: [E.width, E.height], output: [E.outWidth, E.outHeight], sharp: !!E.sharpOn, destruction: window.__destr.on, chaos: g.tune.chaos,
      cut: (() => { try { return new URLSearchParams(location.search).has('cutboxes'); } catch { return null; } })(), guards: g.guards.length, statics: g.col.boxes.length, breakables: window.__destr.walls.summary(), staged,
      exposure: E.settings.exposure, smoke: window.__smoke.params.enabled, fatal: (document.getElementById('fatal') || {}).textContent || '' };
  }, [SEED, CHAOS, pinOf(c0), PARKED, EXPOSURE, LITS]);
  log(name, 'staged', JSON.stringify(boot)); if (boot.fatal) throw new Error('page: ' + boot.fatal);
  const draw = (n, dt = 1 / 60) => page.evaluate(async ([n, dt]) => { const ms = []; for (let i = 0; i < n; i++) { const t = performance.now(); window.__draw(true); window.__runFrames(1, dt); await window.__done(); ms.push(Math.round(performance.now() - t)); } return ms; }, [n, dt]);
  const skip = n => page.evaluate(n => { window.__draw(false); try { window.__runFrames(n, 1 / 60); } finally { window.__draw(true); } return window.__game.time; }, n);
  log(name, 'warm frames ms', JSON.stringify(await draw(2)));
  if (flag('--pre')) log(name, 'pre', JSON.stringify(await page.evaluate(src => { try { return String((0, eval)(src)); } catch (e) { return 'threw: ' + e; } }, flag('--pre'))));
  // ---- the event
  const dids = [];
  for (const ev of (S.events || [S.event])) { let did;
  if (ev.kind === 'blast') did = await page.evaluate(([at, opts]) => ({ res: window.__game.destr.blast(at, opts), t: window.__game.time }), [ev.at, ev.opts]);
  else if (ev.kind === 'wallcharge') did = await page.evaluate(at => { const g = window.__game, C = window.__wallcharge, W = C.spot(g.orders.targetAt(at)); if (!W || !W.ok) return { err: `no wall a charge goes on at ${at} — ${W ? W.why : 'no wall there'}` };
    C.set.push({ wall: W, t: g.time, by: 'still', paid: 0 }); const res = C.blow(C.set[C.set.length - 1]); return { res, wall: W.index, outer: !!W.outer, t: g.time }; }, ev.at);
  else did = await page.evaluate(([ev, park]) => {
    const g = window.__game, D = window.__destr, cam = window.__cam, view = document.getElementById('view');
    const cov = () => D.walls.all().find(x => x.id === ev.id); const c = cov(); if (!c || c.kind !== 'cover') return { err: `breakable #${ev.id} is not cover on this level` };
    window.__draw(false);
    try {
      g.player.slot = 'rifle'; g.player.holstered = false; g.teleportPlayer([ev.from[0], 0, ev.from[2]]);
      const yaw = Math.atan2(ev.aim[0] - ev.from[0], ev.aim[2] - ev.from[2]); const face = () => { g.player.char.bodyYaw = g.player.char.aimYaw = yaw; };
      // the cursor on the aim point (the player's own aim follows it), through the pinned camera's own matrix
      { const m = cam.viewProj, p = ev.aim; const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
        window.__mouse((x / w * 0.5 + 0.5) * view.clientWidth, (1 - (y / w * 0.5 + 0.5)) * view.clientHeight, 0); }
      face(); window.__runFrames(20, 1 / 60); face();
      const muzzle = Array.from(g.player.char.muzzle || []).map(v => +v.toFixed(2)); const per = [];
      for (let r = 0; r < ev.rounds; r++) { face(); D.burst(ev.aim, 1); window.__runFrames(ev.every, 1 / 60); const now = cov(); per.push(now ? now.open : -1); }
      const now = cov();
      // Sam out of the picture again before anything is drawn
      window.__stage(window.__cam.pin, { player: { pos: park, yaw: 0, holstered: true, invisible: true } }); window.__runFrames(2, 1 / 60);
      return { muzzle, openPerRound: per, cells: now ? now.cells : null, open: now ? now.open : null, t: g.time, sam: Array.from(g.player.char.pos).map(v => +v.toFixed(1)) };
    } finally { window.__draw(true); }
  }, [ev, PARKED]);
  log(name, 'event', JSON.stringify(did)); if (did.err) throw new Error(did.err);
  dids.push(did); if (S.events) await skip(90); }
  const ev = S.events || S.event, did = dids.length === 1 ? dids[0] : dids;
  const tEnd = await skip(PHYSICS);
  const state = await page.evaluate(() => { const g = window.__game, D = window.__destr, W = D.walls, L = g.destr.debris.list; const f2 = v => +v.toFixed(2);
    const a = W.authored, pieces = []; for (let i = a; i < g.col.boxes.length; i++) { const b = g.col.boxes[i]; pieces.push({ c: Array.from(b.c).map(f2), h: Array.from(b.h).map(f2), cut: !!b.cut }); }
    return { t: g.time, walls: W.summary(), broken: W.all().filter(w => w.open).map(w => ({ id: w.id, kind: w.kind, surf: w.surf, open: w.open, cells: w.cells })), pieces, summary: D.summary(),
      debris: { n: L.length, moving: g.destr.debris.moving, cut: L.filter(c => c.box.cut).length, kinds: L.reduce((m, c) => (m[c.kind] = (m[c.kind] || 0) + 1, m), {}), at: L.map(c => Array.from(c.box.c).map(f2)) },
      sam: Array.from(g.player.char.pos).map(f2), smokeLive: window.__smoke.stats.live, gpuErrs: window.__gpuErrs.length }; });
  log(name, `physics: ${PHYSICS} undrawn frames to game clock ${tEnd.toFixed(2)} s ·`, JSON.stringify({ ...state, pieces: state.pieces.length, debris: { ...state.debris, at: undefined } }));
  // ---- the stills
  const stills = [];
  for (const c of CAMS) {
    const t1 = Date.now();
    const pin = await page.evaluate(([pin, first]) => { const r = window.__stage(pin, {}); if (!first) window.__cam.update(1 / 60, pin.look, null); return r.pin; }, [pinOf(c), c === c0]);
    const first = c === c0 ? await draw(1) : [];   // (the first camera: one whole page frame, so the GPU has the scene as it lies and the waiting particles are born)
    const cap = await page.evaluate(async ([n]) => {
      const E = window.__engine, cam = window.__cam, t = window.__lastT, ms = []; let h1 = null;
      for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__real(cam, t, i < n - 10 ? 1 / 15 : 1 / 480, false); await window.__done(); ms.push(Math.round(performance.now() - t0)); if (i === 0) h1 = await window.__fnvFrame(); }
      const fr = await E.readbackFrame(); if (!fr) return { err: 'no frame' };
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      let sum = 0, nz = 0, h = 2166136261; for (let i = 0; i < fr.data.length; i += 4) { const l = fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; sum += l; if (l > 0) nz++; fr.data[i + 3] = 255; }
      for (let i = 0; i < fr.data.length; i++) { h ^= fr.data[i]; h = Math.imul(h, 16777619); }
      const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
      const P = window.__particles && window.__particles.stats;
      return { w: fr.w, h: fr.h, meanRGB: +(sum / (fr.w * fr.h * 3)).toFixed(2), nonBlackPct: +(100 * nz / (fr.w * fr.h)).toFixed(1), fnv: (h >>> 0).toString(16), firstSettleFnv: h1, ms,
        gpuErrs: window.__gpuErrs.length, gpuErrSample: window.__gpuErrs.slice(0, 3), particles: P ? { alive: P.alive, asleep: P.asleep, live: P.live } : null, eye: Array.from(cam.pos).map(v => +v.toFixed(2)), url: c2.toDataURL('image/png') };
    }, [SETTLE]);
    if (cap.err) throw new Error(cap.err);
    const file = path.join(OUT, `${name}-${c.name}-${TAG}.png`); fs.writeFileSync(file, Buffer.from(cap.url.split(',')[1], 'base64')); delete cap.url;
    const per = cap.ms.reduce((a, b) => a + b, 0) / cap.ms.length / 1000; cap.ms = undefined;
    const row = { file, camera: c, pinApplied: pin, frames: { firstDrawn: first.length, settle: SETTLE }, secondsPerFrame: +per.toFixed(1), wallSeconds: Math.round((Date.now() - t1) / 1000), ...cap, frameMoved: cap.firstSettleFnv !== cap.fnv };
    stills.push(row); log(name, c.name, '→', file, JSON.stringify({ ...row, file: undefined, camera: undefined }));
    if (cap.gpuErrs) log(name, c.name, `WARNING: ${cap.gpuErrs} GPU errors — the frame may be invalid`, JSON.stringify(cap.gpuErrSample));
    if (!row.frameMoved) log(name, c.name, 'WARNING: the picture did not change over the settle frames — frames are probably invalid');
  }
  // ---- --evict: the pool at its cap (run it at --quality medium: 32 pieces). The scene's `again` charge needs slots, so the oldest pieces at rest are dropped
  // (debris.ts spawn → breaks.evicted: a crumble into the piece's own material). Three pictures from one pin over the pieces that will go: 'before' (they lie
  // there), 'after' (the frame they went: ~0.05 s of particle time on) and 'later' (~0.6 s of particle time on, the game clock held).
  if (has('--evict')) {
    if (!S.again) throw new Error(`--evict: scene '${name}' has no second event`);
    const tgt = await page.evaluate(() => { const g = window.__game, D = g.destr.debris, f2 = v => +v.toFixed(2);
      const rest = D.list.filter(c => c.rest).slice(0, 3); if (!rest.length) return null;
      const look = [0, 0, 0]; for (const c of rest) { look[0] += c.box.c[0] / rest.length; look[2] += c.box.c[2] / rest.length; }
      window.__ev = []; const br = D.breaks; if (br) { const old = br.evicted.bind(br); br.evicted = c => { window.__ev.push({ t: f2(g.time), kind: c.kind, c: Array.from(c.box.c).map(f2), h: Array.from(c.box.h).map(f2), cut: !!c.box.cut }); return old(c); }; }
      return { look: look.map(f2), breaks: !!br, pool: D.summary(), first: rest.map(c => ({ kind: c.kind, c: Array.from(c.box.c).map(f2), h: Array.from(c.box.h).map(f2), cut: !!c.box.cut })) }; });
    if (!tgt) throw new Error('--evict: nothing lies at rest');
    log(name, 'evict: the oldest pieces at rest', JSON.stringify(tgt));
    const epin = { look: tgt.look, yaw: Number(flag('--evict-yaw', -45)) * DEG, pitch: Number(flag('--evict-pitch', 60)) * DEG, dist: Number(flag('--evict-dist', 3.4)) };
    await page.evaluate(pin => { window.__stage(pin, {}); window.__cam.update(1 / 60, pin.look, null); }, epin);
    const shoot = async (label, dts) => { const t1 = Date.now();
      const cap = await page.evaluate(async dts => { const E = window.__engine, cam = window.__cam, t = window.__lastT;
        for (const dt of dts) { window.__real(cam, t, dt, false); await window.__done(); }
        const fr = await E.readbackFrame(); if (!fr) return { err: 'no frame' };
        if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
        for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
        const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
        const P = window.__particles && window.__particles.stats;
        return { gpuErrs: window.__gpuErrs.length, particles: P ? { alive: P.alive, asleep: P.asleep, live: P.live } : null, pool: window.__game.destr.debris.summary(), url: c2.toDataURL('image/png') }; }, dts);
      if (cap.err) throw new Error(cap.err);
      const file = path.join(OUT, `${name}-evict-${label}-${TAG}.png`); fs.writeFileSync(file, Buffer.from(cap.url.split(',')[1], 'base64')); delete cap.url;
      log(name, 'evict', label, '→', file, JSON.stringify({ ...cap, frames: dts.length, particleSeconds: +dts.reduce((a, b) => a + b, 0).toFixed(3), wallSeconds: Math.round((Date.now() - t1) / 1000) })); return file; };
    const NS = Number(flag('--evict-settle', SETTLE));   // (its own count, so `--settle 2` can hurry the scene's own cameras past)
    stills.push({ file: await shoot('before', Array.from({ length: NS }, (_, i) => i < NS - 10 ? 1 / 15 : 1 / 480)) });
    const went = await page.evaluate(([at, opts]) => { const g = window.__game; const res = g.destr.blast(at, opts); let frames = 0;
      window.__draw(false); try { while (!window.__ev.length && frames < 240) { window.__runFrames(1, 1 / 60); frames++; } } finally { window.__draw(true); }
      return { res, frames, evicted: window.__ev.slice(), t: g.time, pool: g.destr.debris.summary() }; }, [S.again.at, S.again.opts]);
    log(name, 'evict: the second charge', JSON.stringify(went));
    if (!went.evicted.length) log(name, 'WARNING: nothing was evicted — the after / later pictures show no eviction');
    await draw(1);   // one whole page frame: the pieces that went are out of the GPU's list and their chips are born
    stills.push({ file: await shoot('after', Array.from({ length: NS }, () => 1 / 960)) });
    stills.push({ file: await shoot('later', Array.from({ length: NS }, (_, i) => i < 12 ? 1 / 20 : 1 / 960)) });
  }
  await page.close();
  const rep = { scene: name, tag: TAG, cut: CUT, url, level: LVL, seed: SEED, chaos: CHAOS, quality: QUALITY, size: [VW, VH], park: PARKED, lit: LITS, physicsFrames: PHYSICS, settleFrames: SETTLE, exposure: EXPOSURE, event: ev, did, boot, state, stills,
    smoke: 'solver off (__smoke.params.enabled = false) before anything is stepped: no dust or smoke is drawn', errors, smokePipelineNoise: noise, wallSeconds: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(path.join(OUT, `stills-${TAG}-${name}.json`), JSON.stringify(rep, null, 1));
  log(name, `done in ${rep.wallSeconds} s · ${errors.length} console / page errors · ${noise} smoke-pipeline lines ignored`);
  return rep;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = flag('--port') ? Number(flag('--port')) : await freePort();
  srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'inherit'] });
  log(`dev server pid ${srv.pid} on :${port} from ${ROOT}`);
  let up = false; for (let i = 0; i < 120 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up');
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });   // ONE software browser; the scenes run one after another, a fresh page (a fresh boot) each
  let bad = 0;
  for (const s of scenes) { try { const r = await scene(port, s); if (r.errors.length || r.stills.some(x => x.gpuErrs || !x.frameMoved)) bad++; } catch (e) { bad++; console.error(`scene ${s} FAILED:`, String(e && e.stack || e)); } }
  await browser.close().catch(() => { }); browser = null;
  const pid = srv.pid; stop();
  await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); if (left) { log(`port ${port} still held by ${left}: killing by pid`); for (const p of left.split(/\s+/)) { try { process.kill(Number(p)); } catch { } } } } catch { }
  log(`dev server (pid ${pid}) stopped · ${scenes.length} scene(s) · ${bad ? bad + ' with errors or warnings' : 'clean'}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
