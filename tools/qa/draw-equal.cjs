// DRAW EQUAL: the picture-equality rig. Pinned, deterministic frames of the REAL PAGE, drawn in headless Chromium on the software WebGPU adapter (SwiftShader — no
// GPU needed; the recipe of tools/qa/page-look.cjs), saved as raw RGBA so two builds can be compared pixel for pixel. For renderer changes that must leave the
// picture exactly as it was: capture the base build, capture the changed build the same way, compare.
//
//   node tools/qa/draw-equal.cjs capture <outDir> [--port 5261] [--views a,b,..] [--size 640x360] [--quality high] [--frames 3,7] [--seed 4242]
//       per view a FRESH browser and a fresh page (`/?paused&quality=<q>&mute&<the view's query>`), staged the same way every run, stepped a fixed number of
//       drawn frames (each waited for), read back at two checkpoints (`--frames a,b`: after drawn frame a and after drawn frame b). Writes, per checkpoint,
//       <view>-a.png / .rgba (w·h·4 bytes, alpha 255) / .json { sha256 of the rgba, w, h, boot pipelines, errors, env, facts } and <outDir>/index.json.
//       Exit 0 = every view captured with no console / page error and every view's subject proven on screen (json.unmet empty); 1 = not; 2 = the driver died.
//   node tools/qa/draw-equal.cjs compare <dirA> <dirB> [--diff <dir>]
//       per capture: EQUAL, or the number of differing pixels + the largest channel delta + their bounding box (from the .rgba files; --diff writes an amplified
//       difference PNG per unequal capture). Exit 0 iff both sides hold the same capture names and every one is equal; 1 otherwise; 2 = bad arguments.
//   node tools/qa/draw-equal.cjs views      the views and their queries
//
// THE VIEWS (VIEWS below): office-night (three torch-carrying guards + Sam in the corridor) · squad-cast (the depot's room clear on its start line at midday: Sam, four teammates, a defender,
// the modelled cast) · glass-broken (the conference partition shot out: holes, shards in the air) · weather (rain at dusk over the office's lot) · firefight (the
// cubicles under fire: bullet marks, a stun scorch, GPU particles, destruction debris, muzzle-flash lights). Plus wall-blown (two walls holed by a charge: statics appended mid-run) on builds
// that have the wall-breaking engine (the one build from dee9595 on; on an older build the view reports itself unmet — leave it out with --views). Each checkpoint's `facts` say what was really on
// screen (characters projected through the camera, live particles / decals / debris / glass cells / lights), and `unmet` lists what a view promised and did not show.
//
// DETERMINISM (CLAUDE.md 'Judging renderer output'): ?paused boot, Math.random ← a mulberry32 straight after __ready, game.restartEncounter() before any staging,
// every character's anim.phase zeroed, the camera pinned with __stage, the rAF loop never let run, the simulation between stagings stepped with the renderer
// stubbed out, every DRAWN frame followed by device.queue.onSubmittedWorkDone() + two macrotask yields (so each frame's GPU readbacks — the light meter, the
// particle pool's header — land before the next frame starts), one config per fresh boot. Drawn frames go to the engine's offscreen target (render's `present`
// forced false), so the frame read back IS the last frame stepped — no extra render for the readback.
// WHAT IT DOES NOT COVER: the smoke solver (its pipelines do not compile on this adapter — 5 storage textures in a stage, the limit is 4 — so
// smoke.params.enabled is false for every view); anything the software adapter rounds differently from a real GPU (this is an EQUALITY rig, not a look rig).
// Slow by nature: ~95 s to boot a page, 11–25 s per drawn frame at 640x360 high on four cores. One view at a time.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
// what the software adapter always says at boot (page-look.cjs): the smoke solver's pipelines fail to compile. Only lines that NAME a smoke pipeline / layout, or
// are that one sentence, are passed over, and only up to NOISE_MAX of them: anything else, or more of it, is an error like any other.
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const NOISE_MAX = 80;
const BANNER = /WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// IN THE PAGE. Everything below this line up to VIEWS runs inside page.evaluate: no closures over node values.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// straight after __ready: the dice, the flags, the helpers (window.__de), a fresh encounter under the seeded dice
const PREP = (seed) => {
  window.__testVisible = true; window.__pauseLoop = true;
  let s0 = seed | 0;
  Math.random = () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const E = window.__engine, g = window.__game;
  window.__menu.close(); window.__smoke.params.enabled = false;
  const real = E.render;
  const DE = window.__de = { stub: false, drawn: 0, notes: {} };
  // every drawn frame goes to the offscreen target (present false); with DE.stub up the frame is not drawn at all (the simulation alone steps)
  E.render = function (cam, t, dt) { if (DE.stub) return; DE.drawn++; return real.call(E, cam, t, dt, false); };
  DE.stubbed = (fn) => { const was = DE.stub; DE.stub = true; try { return fn(); } finally { DE.stub = was; } };
  DE.play = (n, dt = 1 / 60) => DE.stubbed(() => window.__runFrames(n, dt));
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  DE.settle = async () => { await E.device.queue.onSubmittedWorkDone(); await yieldMacro(); await yieldMacro(); };
  DE.draw = async (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { window.__runFrames(1, dt); await DE.settle(); } };
  DE.men = () => [{ name: 'Sam', team: 'player', char: g.player.char, gd: null }, ...g.guards.map(gd => ({ name: gd.callsign, team: gd.team, char: gd.char, gd })), ...(g.civilians || []).map(gd => ({ name: gd.callsign, team: 'civilian', char: gd.char, gd }))];
  DE.zeroPhases = () => { for (const m of DE.men()) if (m.char && m.char.anim) m.char.anim.phase = 0; };
  /** guards[i] for i in `lit` keep their torch; every other guard's lens is held dead against the carry rule (rig-identity.js) */
  DE.torches = (lit) => g.guards.forEach((gd, i) => { gd.lightDeadUntil = lit.includes(i) ? 0 : 1e9; });
  g.restartEncounter();   // fresh Player / Guards / scenario cast under the SEEDED dice (construction-time glance clocks, waits, placements)
  DE.play(1);
  return { time: g.time, guards: g.guards.length };
};
// the last drawn frame, as base64 of w·h·4 RGBA bytes (alpha forced 255)
const READ = async () => {
  const E = window.__engine; const fr = await E.readbackFrame(); if (!fr) return { err: 'no frame' };
  const d = fr.data;
  if (fr.bgra) for (let i = 0; i < d.length; i += 4) { const b = d[i]; d[i] = d[i + 2]; d[i + 2] = b; }
  let sum = 0, lit = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; sum += l; if (l > 12) lit++; d[i + 3] = 255; }
  let s = ''; const CH = 0x8000; for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(3), litPct: +(100 * lit / (fr.w * fr.h)).toFixed(1), b64: btoa(s) };
};
// what is on screen / alive right now (each item on its own try: a build without a hook reports the hole, not a throw)
const FACTS = () => {
  const E = window.__engine, g = window.__game, DE = window.__de, out = {};
  const t = (k, f) => { try { out[k] = f(); } catch (x) { out[k] = { threw: String(x && x.message || x).slice(0, 160) }; } };
  const r2 = (v) => +v.toFixed(2);
  t('frame', () => ({ gameTime: +g.time.toFixed(4), drawn: DE.drawn, frameIdx: E.frameIdx, internal: [E.width, E.height], out: [E.outWidth, E.outHeight] }));
  t('camera', () => { const p = window.__cam.pin; return p ? { look: [...p.look], yaw: p.yaw, pitch: p.pitch, dist: p.dist } : null; });
  t('characters', () => { const vp = window.__cam.viewProj, hid = g.fogOfWar && g.fogOfWar.on ? g.fogOfWar.hiddenChars : null;
    const list = DE.men().map(m => { const x = m.char.pos[0], y = m.char.pos[1] + 1.0, z = m.char.pos[2];
      const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      const nx = cx / cw, ny = cy / cw, inFrame = cw > 0 && Math.abs(nx) < 0.96 && Math.abs(ny) < 0.96;
      return { name: m.name, team: m.team, state: m.gd ? m.gd.state : (g.player.down ? 'down' : 'up'), pos: [r2(m.char.pos[0]), r2(m.char.pos[2])], ndc: [r2(nx), r2(ny)], inFrame, torch: m.gd ? !!m.gd.flashlight.enabled : null,
        fogHidden: !!(hid && hid.has && hid.has(m.char)) }; });
    const inF = list.filter(m => m.inFrame && !m.fogHidden);   // (a man the fog of war hides is not drawn)
    return { total: list.length, inFrame: inF.length, inFrameNames: inF.map(m => m.name), inFrameByTeam: inF.reduce((a, m) => { a[m.team] = (a[m.team] || 0) + 1; return a; }, {}), torchesInFrame: inF.filter(m => m.torch).length, list }; });
  t('lights', () => { const L = E.lights.lights, on = L.filter(l => l.enabled);
    return { total: L.length, enabled: on.length, uploaded: E.lights.activeCount, transientAlive: on.filter(l => l.ttl >= 0 || l.transient).map(l => ({ name: l.name, ttl: l.ttl, age: l.age === undefined ? null : +l.age.toFixed(4), owner: l.owner })).length,
      flashes: on.filter(l => l.name === 'flash').length, heldByCharacters: on.filter(l => l.owner).length, kinds: on.reduce((a, l) => { a[l.kind] = (a[l.kind] || 0) + 1; return a; }, {}) }; });
  t('particles', () => { const s = window.__particles.stats, P = E.particles; return { on: E.particlesOn, alive: s.alive, asleep: s.asleep, live: s.live, born: s.born, emitted: s.emitted, queued: P && P.queue ? P.queue.length : null, droppedRecs: s.droppedRecs, droppedBirths: s.droppedBirths }; });
  t('rain', () => { const R = window.__rain; return R ? { on: R.on, active: R.stats && R.stats.active, totalBirths: R.stats && R.stats.totalBirths } : null; });
  t('decals', () => ({ list: g.decals.list.length, kinds: g.decals.list.reduce((a, d) => { a[d.kind] = (a[d.kind] || 0) + 1; return a; }, {}), drawn: g.decals.stats.count, enabled: g.decals.enabled }));
  t('debris', () => { const D = g.destr.debris; return { n: D.list.length, moving: D.moving, kinds: D.list.reduce((a, c) => { a[c.kind] = (a[c.kind] || 0) + 1; return a; }, {}) }; });
  t('destruction', () => { const s = window.__destr.stats; return { chaos: g.tune.chaos, rounds: s.rounds, bangs: s.bangs, decals: s.decals, sheets: s.sheets, bursts: s.bursts, knocks: s.knocks, screens: s.screens, tiles: s.tiles, hidden: window.__destr.inventory().hidden }; });
  t('glass', () => { const gb = window.__glassbreak, P = gb.panes(); return { fx: window.__glass.fx, on: gb.on, gpu: gb.gpu, live: gb.live, panesListed: window.__glass.panes.length, stars: window.__glass.cracks,
    broken: P.filter(p => p.out > 0 || p.gone).map(p => ({ bi: p.bi, type: p.type, hits: p.hits, cellsOut: p.out, gone: p.gone, open: +p.open.toFixed(3) })), cellsOut: P.reduce((n, p) => n + p.out, 0), stats: { ...gb.stats } }; });
  t('shards', () => { const sh = window.__shards; return sh ? { on: sh.on, live: sh.live, plates: sh.plates, particles: sh.particles, born: sh.stats.born, fragments: sh.stats.fragments } : null; });
  t('weather', () => { const w = g.weather; return { kind: w.kind === undefined ? null : w.kind, enabled: w.enabled, rain: E.weather ? E.weather.rain : null, wet: E.weather ? E.weather.wet : null, flash: E.weather ? E.weather.flash : null, summary: w.summary() }; });
  t('hour', () => ({ id: window.__hour.id, summary: window.__hour.summary() }));
  t('fog', () => g.fogOfWar ? { on: g.fogOfWar.on, stats: { ...g.fogOfWar.stats } } : null);
  t('scenario', () => (g.roomClear && g.roomClear.active) ? 'roomclear' : (g.nightBreach && g.nightBreach.active) ? 'nightbreach' : (g.rescue && g.rescue.active) ? 'rescue' : null);
  t('squad', () => window.__orders.squad().map(m => m.callsign));
  t('smoke', () => ({ enabled: window.__smoke.params.enabled, live: window.__smoke.stats.live }));
  t('passes', () => [...E.timer.names]);   // the timed passes the LAST drawn frame encoded, in order (GpuTimer.names)
  t('world', () => ({ boxes: E.world.all.length, dynamic: E.world.dynamics.length, glassListed: E.world.glassList.length }));
  t('notes', () => DE.notes);
  return out;
};
// the machine and the build's settings (once per view)
const ENV = () => {
  const E = window.__engine, lim = E.device.limits, s = E.settings, pick = {};
  for (const k of ['maxStorageBuffersPerShaderStage', 'maxStorageTexturesPerShaderStage', 'maxSampledTexturesPerShaderStage', 'maxBindingsPerBindGroup', 'maxTextureDimension2D', 'maxComputeInvocationsPerWorkgroup']) pick[k] = lim[k];
  return { adapter: E.gpu && E.gpu.adapterInfo, limits: pick, features: [...E.device.features], meshShadowsAvailable: E.meshShadowsAvailable, meshShadowsOn: !!E.meshShadowsOn, sharpOn: !!E.sharpOn, particlesOn: !!E.particlesOn, glassFracture: E.glassFracture, timer: !!(E.timer && E.timer.enabled),
    settings: { renderScale: s.renderScale, maxInternalHeight: s.maxInternalHeight, restir: s.restir, restirRays: s.restirRays, heldRays: s.heldRays, taau: s.taau, sharpDirect: s.sharpDirect, gbaa: s.gbaa, froxelVol: s.froxelVol, volumetrics: s.volumetrics, rtReflect: s.rtReflect, rtReflectDiv: s.rtReflectDiv, meshShadows: s.meshShadows, meshShadowsNear: s.meshShadowsNear,
      gatherThird: s.gatherThird, volQuarter: s.volQuarter, checkerDirect: s.checkerDirect, giResample: s.giResample, gatherStrata: s.gatherStrata, denoiser: s.denoiser, gpuParticles: s.gpuParticles, particleRain: s.particleRain, decals: s.decals, glass: s.glass, glassRefract: s.glassRefract, markings: s.markings, charMats: s.charMats, wetChars: s.wetChars, charSelfShadow: s.charSelfShadow, debugView: s.debugView },
    quality: window.__quality ? { current: window.__quality.current, label: window.__quality.label, adaptive: window.__quality.adaptive } : null, ua: navigator.userAgent };
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE VIEWS. query = what follows `?paused&quality=<q>&mute&`. stage() runs once on the fresh encounter (in the page; returns notes); settle = undrawn simulation
// frames after it (poses, torches, lights take their places); before(f) runs in the page right before drawn frame f (1-based); expect(facts at a checkpoint, tag)
// returns what the view promised and is NOT there (node side).
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
const VIEWS = {
  // the office at night: the shift's three men in the corridor, each lit by his own torch, Sam crouched among them (rig-identity.js corr3, opened out)
  'office-night': {
    query: '', settle: 6,
    stage: () => { const DE = window.__de, D = Math.PI / 180;
      const st = window.__stage({ look: [25, 0, 11.1], yaw: 90 * D, pitch: 48 * D, dist: 10.5 }, { park: true,
        guards: [{ i: 0, pos: [22.5, 0, 11.4], yaw: Math.PI / 2, torch: true, aimPitch: -0.3 }, { i: 1, pos: [25.5, 0, 10.7], yaw: -Math.PI / 2, torch: true, aimPitch: -0.35 }, { i: 2, pos: [27.8, 0, 11.3], yaw: Math.PI, torch: true, aimPitch: -0.25 }],
        player: { pos: [24.2, 0, 11.5], yaw: 1.57, holstered: true, invisible: true, crouch: true } });
      DE.torches([0, 1, 2]); return st; },
    expect: (F) => { const u = [], c = F.characters; if (!(c.inFrame >= 4)) u.push(`characters in frame ${c.inFrame} < 4`); if (!(c.torchesInFrame >= 3)) u.push(`torches in frame ${c.torchesInFrame} < 3`); if (!(c.inFrameByTeam && c.inFrameByTeam.player === 1)) u.push('Sam not in frame'); return u; },
  },
  // the depot's room clear with the four-man squad, where the scenario itself stands them (no room or spot of the level is named here: the depot was rebuilt once
  // already and the old staging room is open yard now): Sam and his four teammates on their start line under a midday sun (the scenario stages the level dark and
  // the start line has no lamp of its own), a defender stood three metres in front of Sam facing them, the camera fitted round the six from whichever side shows them whole.
  // The stage notes say which side was taken and whether anyone is behind a static from the camera; a wall in the way is reported as unmet, not compared.
  'squad-cast': {
    query: 'levelFile=depot.json&roomclear&squad4&freshstart=0&hour=midday', settle: 6,
    stage: () => { const g = window.__game, DE = window.__de, C = window.__cam, D = Math.PI / 180;
      const foe = g.guards.findIndex(x => x.team === 'hostile');
      const S = g.player.char, fx = Math.sin(S.bodyYaw), fz = Math.cos(S.bodyYaw), ahead = [S.pos[0] + fx * 3.2, 0, S.pos[2] + fz * 3.2];
      const cast = DE.men().filter(m => m.team === 'player' || m.team === 'operative').map(m => ({ name: m.name, p: [m.char.pos[0], m.char.pos[1], m.char.pos[2]] }));
      if (foe >= 0) cast.push({ name: g.guards[foe].callsign, p: ahead });
      const xs = cast.map(m => m.p[0]), zs = cast.map(m => m.p[2]), look = [(Math.min(...xs) + Math.max(...xs)) / 2, 0.9, (Math.min(...zs) + Math.max(...zs)) / 2];   // (the middle of the ground they cover, at half a man's height)
      // the framing fits itself: from each side in turn (ahead of the line first: their fronts), the nearest distance that holds all six head to foot inside the frame
      // (camera.ts rebuild's eye and basis, its own fov and aspect); the first side with nobody behind a static is taken, else the one hiding the fewest points
      const pitch = 55 * D, cp = Math.cos(pitch), sp = Math.sin(pitch), th = Math.tan(C.fov / 2), pts = (m) => [0.1, 1.0, 1.75].map(h => [m.p[0], m.p[1] + h, m.p[2]]);
      const frame = (yaw) => { const sy = Math.sin(yaw), cy = Math.cos(yaw), f = [-sy * cp, -sp, -cy * cp], r = [cy, 0, -sy], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
        for (let dist = 7; dist <= 24; dist += 0.5) { const eye = [look[0] - f[0] * dist, look[1] - f[1] * dist, look[2] - f[2] * dist];
          const fits = cast.every(m => pts(m).every(q => { const v = [q[0] - eye[0], q[1] - eye[1], q[2] - eye[2]], z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
            return z > 0 && Math.abs((v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * th * C.aspect)) < 0.86 && Math.abs((v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * th)) < 0.84; }));
          if (fits || dist === 24) return { yaw, dist, eye, fits, hid: cast.reduce((n, m) => n + pts(m).filter(q => g.col.segmentBlocked(eye, q)).length, 0) }; } };
      const sides = [12, -12, 168, 192].map(a => frame(S.bodyYaw + a * D)), pick = sides.find(x => x.fits && !x.hid) || sides.slice().sort((x, y) => x.hid - y.hid)[0];
      const st = window.__stage({ look, yaw: pick.yaw, pitch, dist: pick.dist }, { guards: foe >= 0 ? [{ i: foe, pos: ahead, yaw: S.bodyYaw + Math.PI, aimPitch: -0.1 }] : [] });
      DE.notes.defender = foe >= 0 ? g.guards[foe].callsign : null;
      DE.notes.cast = { sam: [+S.pos[0].toFixed(2), +S.pos[2].toFixed(2)], eye: pick.eye.map(v => +v.toFixed(2)), side: sides.indexOf(pick), fits: pick.fits, sides: sides.map(x => ({ dist: x.dist, fits: x.fits, hid: x.hid })),
        hidden: cast.filter(m => pts(m).some(q => g.col.segmentBlocked(pick.eye, q))).map(m => m.name) };
      return st; },
    expect: (F) => { const u = [], c = F.characters, by = c.inFrameByTeam || {}, N = F.notes && F.notes.cast; if (F.scenario !== 'roomclear') u.push(`scenario ${F.scenario}`); if (!(F.squad && F.squad.length === 4)) u.push(`squad of ${F.squad && F.squad.length}`);
      if (by.player !== 1) u.push('Sam not in frame'); if (!(by.operative >= 4)) u.push(`teammates in frame ${by.operative || 0} < 4`); if (!(by.hostile >= 1)) u.push('no defender in frame');
      if (!N) u.push('no stage notes'); else { if (!N.fits) u.push('the six do not fit one frame'); if (N.hidden.length) u.push(`behind a static from the camera: ${N.hidden.join(', ')}`); } if (!F.hour || F.hour.id !== 'midday') u.push(`hour ${F.hour && F.hour.id}`); return u; },
  },
  // the conference partition (annealed float, six panes along z = 10, found by where they stand in `before` below: a level export moves their indices) shot out from the corridor's side, seen from over the room: holes, rigid shards and glass particles falling
  // toward the camera in the first checkpoint, a torch in the corridor through what is left of it
  'glass-broken': {
    query: '', settle: 6,
    stage: () => { const DE = window.__de, D = Math.PI / 180;
      const st = window.__stage({ look: [9.7, 1.0, 10.0], yaw: 180 * D, pitch: 36 * D, dist: 6.5 }, { park: true,
        guards: [{ i: 0, pos: [8.4, 0, 11.3], yaw: Math.PI, torch: true, aimPitch: -0.1 }], player: { pos: [10.8, 0, 11.3], yaw: Math.PI, holstered: true, invisible: true } });
      DE.torches([0]); return st; },
    before: (f) => { if (f !== 2) return null; const g = window.__game, gb = window.__glassbreak, DE = window.__de;   // (after ONE drawn frame: the world's pane list is packed by the upload a render makes)
      const panes = window.__glass.panes.map(bi => ({ bi, b: g.level.boxes[bi] })).filter(x => Math.abs(x.b.c[2] - 10) < 0.05 && x.b.c[0] < 14).sort((a, b) => a.b.c[0] - b.b.c[0]);   // the partition, west to east
      const hit = [];
      for (const k of [1, 2, 4]) { const X = panes[k]; if (!X) continue; const c = X.b.c;
        for (let j = 0; j < 6; j++) gb.hit(X.bi, [c[0] + (j - 2.5) * 0.05, c[1] + (j % 3 - 1) * 0.08, c[2]], [0, 0, -1], 1);   // six rounds' worth a hand's breadth apart, travelling north: the glass falls into the room
        hit.push(X.bi); }
      const blast = gb.blast([9.6, 1.2, 10.6], {});   // + a charge's blast on the corridor's side: stars on every pane in reach, cells off the near ones
      return (DE.notes.glass = { partition: panes.map(x => x.bi), hit, blast }); },
    expect: (F, tag) => { const u = [], G = F.glass; if (!(G.gpu && G.live)) u.push('glass fracture not live'); if (!(G.broken && G.broken.length >= 2)) u.push(`broken panes ${G.broken && G.broken.length} < 2`); if (!(G.cellsOut >= 10)) u.push(`cells out ${G.cellsOut} < 10`);
      if (tag === 'a' && !(F.debris.kinds && F.debris.kinds.shard >= 1) && !(F.shards && F.shards.plates >= 1)) u.push('no shard debris alive at the first checkpoint'); if (!(F.characters.inFrame >= 2)) u.push(`characters in frame ${F.characters.inFrame} < 2`); return u; },
  },
  // a picked weather and hour: rain at dusk over the office's south lot (the cars, the street lamp, the frontage's glazing), Sam and one of the shift out in it
  // a wall blown open (builds with the wall-breaking engine, game/wallbreak.ts — the one build from dee9595 on): a charge's blast at the foot of the two breakable walls
  // nearest the corridor view — statics appended and re-shaped mid-run, the trace grid rebuilt, reach masks decided again; Sam and a guard's torch on the hole
  'wall-blown': {
    query: '', settle: 6,
    stage: () => { const DE = window.__de, D = Math.PI / 180;
      const st = window.__stage({ look: [9.7, 1.0, 10.0], yaw: 180 * D, pitch: 36 * D, dist: 7.5 }, { park: true,
        guards: [{ i: 0, pos: [8.4, 0, 11.3], yaw: Math.PI, torch: true, aimPitch: -0.1 }], player: { pos: [10.8, 0, 11.3], yaw: Math.PI, holstered: true, invisible: true } });
      DE.torches([0]); return st; },
    before: (f) => { if (f !== 2) return null; const g = window.__game, d = window.__destr, DE = window.__de;
      if (!d || !d.walls) return (DE.notes.wall = { engine: false });
      const near = d.walls.all().filter(w => w.kind === 'wall').map(w => ({ w, r: Math.hypot(w.box.c[0] - 9.7, w.box.c[2] - 10.0) })).sort((a, b) => a.r - b.r).slice(0, 2);
      const n0 = g.col.boxes.length, res = [];
      for (const { w } of near) { const b = w.box, thinX = b.h[0] < b.h[2]; res.push({ id: w.id, r: d.blast([b.c[0] + (thinX ? 0.3 : 0), 0.3, b.c[2] + (thinX ? 0 : 0.3)], { power: 1.5 }) }); }
      return (DE.notes.wall = { engine: true, on: d.on, res, statics: [n0, g.col.boxes.length], inventory: d.walls.inventory(), serial: d.walls.serial }); },
    expect: (F) => { const u = [], W = F.notes && F.notes.wall; if (!W || !W.engine) u.push('no wall-breaking engine on this build'); else { if (!(W.serial > 0)) u.push('no wall changed'); if (!(W.statics[1] > W.statics[0])) u.push('no static appended'); } return u; },
  },
  // THE SAME BLAST WITH THE REACH MASKS LANDED: 'wall-blown' draws while the lights' masks are still being re-decided a few a frame, so two builds that pace that work
  // differently show the same wall under different masks for those frames. Here the queue is drained on the spot: what is compared is the masks' BITS, not when they land.
  'wall-landed': {
    query: '', settle: 6,
    stage: () => { const DE = window.__de, D = Math.PI / 180;
      const st = window.__stage({ look: [9.7, 1.0, 10.0], yaw: 180 * D, pitch: 36 * D, dist: 7.5 }, { park: true,
        guards: [{ i: 0, pos: [8.4, 0, 11.3], yaw: Math.PI, torch: true, aimPitch: -0.1 }], player: { pos: [10.8, 0, 11.3], yaw: Math.PI, holstered: true, invisible: true } });
      DE.torches([0]); return st; },
    before: (f) => { if (f !== 2) return null; const g = window.__game, d = window.__destr, DE = window.__de;
      if (!d || !d.walls) return (DE.notes.wall = { engine: false });
      const near = d.walls.all().filter(w => w.kind === 'wall').map(w => ({ w, r: Math.hypot(w.box.c[0] - 9.7, w.box.c[2] - 10.0) })).sort((a, b) => a.r - b.r).slice(0, 2);
      const n0 = g.col.boxes.length, res = [];
      for (const { w } of near) { const b = w.box, thinX = b.h[0] < b.h[2]; res.push({ id: w.id, r: d.blast([b.c[0] + (thinX ? 0.3 : 0), 0.3, b.c[2] + (thinX ? 0 : 0.3)], { power: 1.5 }) }); }
      let ticks = 0; while (g.reachPending && ticks < 20000) { g.reachTick(); ticks++; }   // the lights' reach masks all re-decided NOW, before the next frame is drawn: both builds then draw from the same masks whatever pace each lands them at
      return (DE.notes.wall = { engine: true, on: d.on, res, statics: [n0, g.col.boxes.length], inventory: d.walls.inventory(), serial: d.walls.serial, reachTicks: ticks, reachLeft: g.reachPending }); },
    expect: (F) => { const u = [], W = F.notes && F.notes.wall; if (!W || !W.engine) u.push('no wall-breaking engine on this build'); else { if (!(W.serial > 0)) u.push('no wall changed'); if (!(W.statics[1] > W.statics[0])) u.push('no static appended'); } return u; },
  },
  'weather': {
    query: 'weather=rain&hour=dusk', settle: 30,
    stage: () => { const DE = window.__de, D = Math.PI / 180;
      const st = window.__stage({ look: [15, 0, 23.9], yaw: 0, pitch: 40 * D, dist: 16.5 }, { park: true,
        guards: [{ i: 0, pos: [18, 0, 26.2], yaw: -Math.PI / 2, torch: true, aimPitch: -0.2 }], player: { pos: [13.5, 0, 26.0], yaw: 0, holstered: true, invisible: true } });
      DE.torches([0]); return st; },
    expect: (F) => { const u = [], W = F.weather; if (W.kind !== 'rain') u.push(`weather kind ${W.kind}`); if (!(W.rain > 0)) u.push('no rain in the frame block'); if (F.hour.id !== 'dusk') u.push(`hour ${F.hour.id}`);
      if (!(F.rain && F.rain.active && F.rain.totalBirths > 0)) u.push('particle rain not running'); if (!(F.characters.inFrame >= 2)) u.push(`characters in frame ${F.characters.inFrame} < 2`); return u; },
  },
  // the cubicles under fire: a stun charge's destruction + scorch on a desk, ten FN2000 rounds into the monitors behind it (undrawn), then a round right before
  // each of the first two drawn frames — bullet marks, damage decals, impact particles, casings, a dropped tile / knocked housings, and the muzzle flash's
  // transient lights alive at the first checkpoint
  'firefight': {
    query: '', settle: 6,
    stage: () => { const g = window.__game, DE = window.__de, D = Math.PI / 180, X = window.__destr;
      const st = window.__stage({ look: [21.6, 0, 16.6], yaw: -20 * D, pitch: 55 * D, dist: 9.5 }, { park: true,
        guards: [{ i: 0, pos: [18.9, 0, 18.4], yaw: 0.9, torch: true, aimPitch: -0.3 }], player: { pos: [20.6, 0, 18.7], yaw: Math.PI, holstered: false, invisible: true } });
      DE.torches([0]); g.godMode = true; g.infiniteAmmo = true;
      DE.targets = [[21.8, 1.08, 15.58], [24.2, 1.08, 15.58], [21.8, 0.8, 15.83], [22.6, 0.9, 15.4]];   // two monitors' screens, the papers and the desk between them
      DE.play(4);
      const at = [22.6, 0.8, 16.1]; X.bang(at); window.__marks.bang([at[0], 0, at[2] + 0.7]);
      DE.stubbed(() => { for (let k = 0; k < 10; k++) { if (k) window.__runFrames(3, 1 / 60); X.burst(DE.targets[k % DE.targets.length], 1); } });
      return { st, bangAt: at, rounds: 10 }; },
    before: (f) => { const DE = window.__de; if (f > 2) return null; window.__destr.burst(DE.targets[(f - 1) % DE.targets.length], 1); return { round: f }; },
    expect: (F, tag) => { const u = []; if (!(F.decals.list >= 8)) u.push(`decals ${F.decals.list} < 8`); if (!(F.decals.kinds && (F.decals.kinds.scorch >= 1))) u.push('no scorch decal'); if (!(F.destruction.rounds >= 10 && F.destruction.bangs >= 1)) u.push('destruction saw no burst / bang');
      if (!(F.debris.n >= 1)) u.push('no debris alive'); if (!(F.particles.on && (F.particles.alive > 0 || F.particles.born > 0 || F.particles.emitted > 0))) u.push('no particles alive'); if (tag === 'a' && !(F.lights.transientAlive >= 1)) u.push('no transient light alive at the first checkpoint');
      if (!(F.characters.inFrame >= 2)) u.push(`characters in frame ${F.characters.inFrame} < 2`); return u; },
  },
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// node side
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/** an 8-bit RGBA PNG of w·h·4 bytes (filter 0 on every row) */
function png(rgba, w, h) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function args(argv) { const pos = [], opt = {}; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const eq = a.indexOf('='); if (eq > 0) opt[a.slice(2, eq)] = a.slice(eq + 1); else opt[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; } else pos.push(a); } return { pos, opt }; }
function usage(code) { console.error('usage: draw-equal.cjs capture <outDir> [--port 5261] [--views a,b,..] [--size 640x360] [--quality high] [--frames 3,7] [--seed 4242]\n       draw-equal.cjs compare <dirA> <dirB> [--diff <dir>]\n       draw-equal.cjs views\nviews: ' + Object.keys(VIEWS).join(', ')); process.exit(code); }

async function captureView(name, opt, outDir) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const V = VIEWS[name], t0 = Date.now(), [W, H] = opt.size;
  const R = { view: name, query: V.query, url: null, quality: opt.quality, size: `${W}x${H}`, seed: opt.seed, frames: opt.frames, dt: 1 / 60, errors: [], noise: 0, banners: 0, notes: [], pipelines: null, env: null, staged: null, before: {}, checkpoints: {}, seconds: {} };
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && t !== 'warning') return;
      if (/Failed to load resource/.test(x)) return;   // (named with its URL by the response / requestfailed hooks below)
      if (t === 'warning' && BANNER.test(x)) { R.banners++; return; }
      if (NOISE.test(x) && R.noise < NOISE_MAX) R.noise++; else R.errors.push(`${t}: ${x.slice(0, 500)}`); });
    page.on('requestfailed', r => R.errors.push(`request failed: ${r.url()} — ${r.failure() ? r.failure().errorText : '?'}`));
    page.on('response', r => { if (r.status() >= 400) { const u = r.url(); if (/favicon/.test(u)) R.notes.push(`${r.status()} ${u}`); else R.errors.push(`http ${r.status()}: ${u}`); } });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    R.url = `http://localhost:${opt.port}/?paused&quality=${opt.quality}&mute${V.query ? '&' + V.query : ''}`;
    log(name, 'goto', R.url);
    await page.goto(R.url);
    const ready = await page.evaluate(async () => { await window.__ready; return { fatal: (document.getElementById('fatal') || {}).textContent || '', pipelines: window.__boot ? window.__boot.pipelines : null }; });
    R.pipelines = ready.pipelines; R.seconds.boot = +((Date.now() - t0) / 1000).toFixed(0); if (ready.fatal) R.errors.push('fatal: ' + ready.fatal);
    R.prep = await page.evaluate(PREP, opt.seed);
    log(name, `ready in ${R.seconds.boot} s`, JSON.stringify(ready.pipelines));
    R.staged = await page.evaluate(V.stage);
    await page.evaluate((n) => { const DE = window.__de; DE.zeroPhases(); DE.play(n); window.__resetClock(); }, V.settle);
    const last = opt.frames[opt.frames.length - 1], tF = Date.now();
    for (let f = 1; f <= last; f++) {
      if (V.before) { const b = await page.evaluate(V.before, f); if (b !== null && b !== undefined) R.before[f] = b; }
      await page.evaluate(() => window.__de.draw(1));
      const k = opt.frames.indexOf(f); if (k < 0) continue;
      const tag = String.fromCharCode(97 + k), cap = await page.evaluate(READ), facts = await page.evaluate(FACTS);
      if (!R.env) R.env = await page.evaluate(ENV);
      if (cap.err) { R.errors.push(`${tag}: ${cap.err}`); continue; }
      const rgba = Buffer.from(cap.b64, 'base64'), sha = crypto.createHash('sha256').update(rgba).digest('hex'), base = path.join(outDir, `${name}-${tag}`);
      const unmet = V.expect ? V.expect(facts, tag) : [];
      fs.writeFileSync(base + '.rgba', rgba); fs.writeFileSync(base + '.png', png(rgba, cap.w, cap.h));
      R.checkpoints[tag] = { name: `${name}-${tag}`, afterDrawnFrame: f, sha256: sha, w: cap.w, h: cap.h, mean: cap.mean, litPct: cap.litPct, unmet, facts };
      log(name, `checkpoint ${tag} (drawn frame ${f}): ${cap.w}x${cap.h} sha ${sha.slice(0, 16)} mean ${cap.mean} lit ${cap.litPct}%${unmet.length ? ' · UNMET: ' + unmet.join('; ') : ''}`);
    }
    R.seconds.frames = +((Date.now() - tF) / 1000).toFixed(0); R.seconds.perFrame = +(R.seconds.frames / last).toFixed(1);
    await page.evaluate(() => window.__de.settle()).catch(() => {});   // (anything the last frame still had to say reaches the console before the page goes)
    await page.close();
  } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); }
  await browser.close().catch(() => {});
  R.seconds.total = +((Date.now() - t0) / 1000).toFixed(0);
  // one json per checkpoint (self-contained), the view's whole record in index.json
  for (const [tag, C] of Object.entries(R.checkpoints)) fs.writeFileSync(path.join(outDir, `${name}-${tag}.json`), JSON.stringify({ name: C.name, view: name, checkpoint: tag, sha256: C.sha256, w: C.w, h: C.h, afterDrawnFrame: C.afterDrawnFrame, url: R.url, query: R.query, quality: R.quality, size: R.size, seed: R.seed, dt: R.dt,
    pipelines: R.pipelines, errors: R.errors, noiseLines: R.noise, banners: R.banners, notes: R.notes, unmet: C.unmet, mean: C.mean, litPct: C.litPct, seconds: R.seconds, staged: R.staged, before: R.before, facts: C.facts, env: R.env }, null, 1));
  const unmet = Object.values(R.checkpoints).reduce((n, C) => n + C.unmet.length, 0), got = Object.keys(R.checkpoints).length;
  R.ok = !R.errors.length && !unmet && got === opt.frames.length;
  log(name, R.ok ? 'clean' : `NOT CLEAN (${R.errors.length} errors, ${unmet} unmet, ${got}/${opt.frames.length} checkpoints)`, `· ${R.seconds.total} s (boot ${R.seconds.boot}, ${R.seconds.perFrame} s a drawn frame) · ${R.noise} lines of smoke-pipeline noise passed over`);
  R.errors.forEach(e => console.log('   >', e));
  return R;
}

async function capture(outDir, opt) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const name of opt.views) report.push(await captureView(name, opt, outDir));   // one at a time: the software rasteriser takes every core
  const idxFile = path.join(outDir, 'index.json'); let idx = { tool: 'tools/qa/draw-equal.cjs', views: {} };
  try { const old = JSON.parse(fs.readFileSync(idxFile, 'utf8')); if (old && old.views) idx = old; } catch { /* first run into this dir */ }
  idx.when = new Date().toISOString(); idx.port = opt.port; idx.quality = opt.quality; idx.size = opt.size.join('x'); idx.frames = opt.frames; idx.seed = opt.seed;
  for (const R of report) idx.views[R.view] = { ok: R.ok, query: R.query, url: R.url, seconds: R.seconds, pipelines: R.pipelines, errors: R.errors, noiseLines: R.noise, env: R.env,
    checkpoints: Object.fromEntries(Object.entries(R.checkpoints).map(([t, C]) => [t, { name: C.name, afterDrawnFrame: C.afterDrawnFrame, sha256: C.sha256, w: C.w, h: C.h, mean: C.mean, unmet: C.unmet }])) };
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1));
  const bad = report.filter(r => !r.ok);
  for (const R of report) for (const C of Object.values(R.checkpoints)) console.log(`${C.name.padEnd(18)} ${C.sha256}  ${C.w}x${C.h}`);
  console.log(bad.length ? `=== draw-equal capture: ${bad.length} of ${report.length} NOT clean: ${bad.map(r => r.view).join(', ')} ===` : `=== draw-equal capture: ${report.length} views clean → ${outDir} ===`);
  return bad.length ? 1 : 0;
}

function compare(dirA, dirB, diffDir) {
  const names = (d) => fs.readdirSync(d).filter(f => f.endsWith('.rgba')).map(f => f.slice(0, -5)).sort();
  const A = names(dirA), B = names(dirB), all = [...new Set([...A, ...B])].sort(); let bad = 0;
  if (!all.length) { console.log(`no .rgba captures in ${dirA} or ${dirB}`); return 1; }
  if (diffDir) fs.mkdirSync(diffDir, { recursive: true });
  const dims = (d, n) => { try { const j = JSON.parse(fs.readFileSync(path.join(d, n + '.json'), 'utf8')); return [j.w, j.h]; } catch { return null; } };
  for (const n of all) {
    if (!A.includes(n) || !B.includes(n)) { bad++; console.log(`${n.padEnd(18)} MISSING in ${A.includes(n) ? dirB : dirA}`); continue; }
    const a = fs.readFileSync(path.join(dirA, n + '.rgba')), b = fs.readFileSync(path.join(dirB, n + '.rgba')), da = dims(dirA, n), db = dims(dirB, n);
    if (a.length !== b.length || (da && db && (da[0] !== db[0] || da[1] !== db[1]))) { bad++; console.log(`${n.padEnd(18)} SIZE DIFFERS: ${da ? da.join('x') : a.length + ' B'} vs ${db ? db.join('x') : b.length + ' B'}`); continue; }
    if (a.equals(b)) { console.log(`${n.padEnd(18)} EQUAL  (${a.length / 4} px${da ? ', ' + da.join('x') : ''})`); continue; }
    const w = da ? da[0] : 0; let px = 0, max = 0, sum = 0, over2 = 0, over8 = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    const diff = diffDir && da ? Buffer.alloc(a.length) : null;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (diff) { diff[i] = Math.min(255, Math.abs(a[i] - b[i]) * 16); diff[i + 1] = Math.min(255, Math.abs(a[i + 1] - b[i + 1]) * 16); diff[i + 2] = Math.min(255, Math.abs(a[i + 2] - b[i + 2]) * 16); diff[i + 3] = 255; }
      if (!d) continue; px++; sum += d; if (d > max) max = d; if (d > 2) over2++; if (d > 8) over8++;
      if (w) { const p = i / 4, x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    bad++;
    console.log(`${n.padEnd(18)} DIFFERENT  ${px} px of ${a.length / 4} (${(100 * px / (a.length / 4)).toFixed(3)} %) · max channel delta ${max} · mean delta of those ${(sum / px).toFixed(2)} · >2: ${over2} · >8: ${over8}${w ? ` · box x ${x0}‥${x1} y ${y0}‥${y1}` : ''}`);
    if (diff) fs.writeFileSync(path.join(diffDir, n + '-diff.png'), png(diff, da[0], da[1]));
  }
  console.log(bad ? `=== draw-equal compare: ${bad} of ${all.length} NOT equal ===` : `=== draw-equal compare: ${all.length} captures EQUAL ===`);
  return bad ? 1 : 0;
}

module.exports = { VIEWS, PREP, FLAGS, NOISE, BANNER };   // (tools/qa/lightwork/count.cjs stages the same views)
if (require.main === module) (async () => {
  const { pos, opt } = args(process.argv.slice(2)), cmd = pos[0];
  if (cmd === 'views') { for (const [n, V] of Object.entries(VIEWS)) console.log(`${n.padEnd(14)} ?paused&quality=<q>&mute${V.query ? '&' + V.query : ''}`); process.exit(0); }
  if (cmd === 'compare') { if (pos.length !== 3) usage(2); for (const d of pos.slice(1)) if (!fs.existsSync(d)) { console.error(`no such directory: ${d}`); process.exit(2); } process.exit(compare(pos[1], pos[2], opt.diff && opt.diff !== '1' ? opt.diff : null)); }
  if (cmd === 'capture') {
    if (pos.length !== 2) usage(2);
    const views = (opt.views && opt.views !== '1' ? opt.views.split(',') : Object.keys(VIEWS)).filter(Boolean), unknown = views.filter(v => !VIEWS[v]);
    if (unknown.length) { console.error(`unknown view(s): ${unknown.join(', ')} — known: ${Object.keys(VIEWS).join(', ')}`); process.exit(2); }
    const size = (opt.size || '640x360').split('x').map(Number), frames = (opt.frames || '3,7').split(',').map(Number).filter(n => n > 0).sort((a, b) => a - b);
    if (size.length !== 2 || !(size[0] > 0) || !(size[1] > 0) || !frames.length || frames.length > 26) usage(2);
    process.exit(await capture(pos[1], { port: Number(opt.port || 5261), views, size, quality: opt.quality || 'high', frames, seed: Number(opt.seed || 4242) }));
  }
  usage(2);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 1200)); process.exit(2); });
