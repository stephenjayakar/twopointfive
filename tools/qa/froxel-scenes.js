// The froxel lane's LOOK rigs (docs/internal/p2b-froxels.md): fixed test torches (torch parameters = game.tune's hand torch) instead of a guard's hand, so a
// march / froxel pair frames the same beam to the pixel; the staging calls; and the capture batches the report's crops come from. Dev only. On a
// `?paused&quality=<p>&mute` boot with #view visible and the shot sink up (window.__shotPort):
//     await import('/qa/froxel-scenes.js'); __fxs.install(); await __fxs.beams(); await __fxs.trail(); await __fxs.door(); await __fxs.lot(); await __fxs.plume()
// Every batch leaves settings as it found them (froxelVol back on, debug view 0, grain restored) and returns the shot names it posted (p2b_<name>.jpg).
(() => {
  const E = () => window.__engine, G = () => window.__game;
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const F = {
    torches: null,
    /** two static torch-like spots (intensity / cone / radius = the guards' hand torch), the storm's lightning off (rain stays), everyone parked */
    install() {
      if (F.torches) return F.torches;
      const mk = (name, pos, dir) => E().lights.add({ name, group: 'test', kind: 1, pos, dir: norm(dir), color: [1.0, 0.92, 0.78], intensity: 70, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 70 });
      F.torches = [mk('testA', [26.5, 1.2, 18.6], [-1, -0.12, -0.35]), mk('testB', [17.5, 1.1, 15.6], [1, -0.06, 0.25])];
      if (window.__weather) window.__weather.storm = 0;
      return F.torches;
    },
    stageStatic() { window.__stage({ look: [22, 0, 16], yaw: -0.35, pitch: 0.96, dist: 16 }, { park: true, player: { pos: [30, 0, 10], invisible: true } }); },
    stageDoor() { window.__stage({ look: [32.6, 0, 9.6], yaw: 0.0, pitch: 1.05, dist: 11 }, { park: true, player: { pos: [8, 0, 20], invisible: true } }); },
    stageLot() { window.__stage({ look: [16, 0, 23.5], yaw: 0.35, pitch: 0.85, dist: 15 }, { park: true, player: { pos: [30, 0, 8], invisible: true } }); },
    /** final + volumetrics-only (debug view 5) pair under `name` */
    async capv(name) { const S = E().settings; const a = await window.__shot('p2b/' + name, 0.92); S.debugView = 5; window.__runFrames(1, 1 / 60); const b = await window.__shot('p2b/' + name + '-vol', 0.92); S.debugView = 0; return [name, a, b]; },
    /** the beam apex / edge rig: march vs froxel at the preset's grid (+ any extra { name: settings } variants) */
    async beams(variants = {}) {
      F.install(); const S = E().settings; const keep = { froxelVol: S.froxelVol, froxelH: S.froxelH, froxelD: S.froxelD, froxelSharp: S.froxelSharp };
      F.torches[0].enabled = true; F.torches[1].enabled = true; F.stageStatic(); window.__runFrames(30, 1 / 60);
      const out = [];
      S.froxelVol = false; window.__runFrames(20, 1 / 60); out.push(await F.capv('s-march'));
      S.froxelVol = true; window.__runFrames(40, 1 / 60); out.push(await F.capv('s-frox'));
      for (const [n, set] of Object.entries(variants)) { Object.assign(S, set); F.stageStatic(); window.__runFrames(40, 1 / 60); out.push(await F.capv('s-' + n)); }
      Object.assign(S, keep); return out;
    },
    /** a canister in torch A's beam, frozen once developed: plume detail + the shadowed core, march vs froxel */
    async plume() {
      F.install(); const S = E().settings; const sm = window.__smoke;
      F.torches[0].enabled = true; F.torches[1].enabled = true; F.stageStatic(); S.froxelVol = true;
      sm.spawnCanister([23.5, 0, 17.6]);
      for (let i = 0; i < 8; i++) { window.__runFrames(30, 1 / 60); await new Promise(r => setTimeout(r, 10)); }
      sm.params.frozen = true; window.__runFrames(20, 1 / 60);
      const out = [];
      out.push(await F.capv('h-frox'));
      S.froxelVol = false; window.__runFrames(20, 1 / 60); out.push(await F.capv('h-march'));
      S.froxelVol = true; sm.params.frozen = false; return out;
    },
    /** torch A swept 36° over 12 frames (180°/s) then held: the moving frame and 1 / 2 / 4 / 8 frames after the stop, volumetrics-only, no grain, march vs froxel */
    async trail() {
      F.install(); const S = E().settings, P = E().passes; const g0 = P.grain; P.grain = 0; S.debugView = 5;
      const tA = F.torches[0]; F.torches[1].enabled = false; tA.enabled = true;
      const dirAt = deg => { const a = deg * Math.PI / 180; const b = [-1, -0.12, -0.35]; const c = Math.cos(a), s = Math.sin(a); return norm([b[0] * c - b[2] * s, b[1], b[0] * s + b[2] * c]); };
      const out = [];
      for (const v of ['frox', 'march']) {
        S.froxelVol = v === 'frox'; tA.dir = dirAt(0); F.stageStatic(); window.__runFrames(40, 1 / 60);
        for (let f = 1; f <= 12; f++) { tA.dir = dirAt(f * 3); window.__runFrames(1, 1 / 60); }
        out.push(['trail-' + v + '-move', await window.__shot(`p2b/trail-${v}-move`, 0.95)]);
        let at = 0; for (const k of [1, 2, 4, 8]) { window.__runFrames(k - at, 1 / 60); at = k; out.push([`trail-${v}-stop${k}`, await window.__shot(`p2b/trail-${v}-stop${k}`, 0.95)]); }
      }
      tA.dir = dirAt(0); F.torches[1].enabled = true; S.froxelVol = true; S.debugView = 0; P.grain = g0; return out;
    },
    /** a muzzle flash (ttl 0.04 s: alive over frames 0‥2, gone by 3) in the beam rig: frames 0‥4, volumetrics-only, march vs froxel — 0‥2 = 'lights at once, at the march\'s energy', 3‥4 = 'leaves nothing' */
    async flash() {
      F.install(); const S = E().settings, P = E().passes; const g0 = P.grain; P.grain = 0; S.debugView = 5;
      const out = [];
      for (const v of ['frox', 'march']) {
        S.froxelVol = v === 'frox'; F.stageStatic(); window.__runFrames(40, 1 / 60);
        E().lights.flash([22.5, 1.3, 16.5], [1.0, 0.75, 0.45], 60, 7, 0.04, 0);   // ≈ a carbine's muzzle flash (combat.ts numbers are of this order), shorter than a frame
        for (const k of [0, 1, 2, 3, 4]) { window.__runFrames(1, 1 / 60); out.push([`flash-${v}-${k}`, await window.__shot(`p2b/flash-${v}-${k}`, 0.95)]); }
      }
      S.froxelVol = true; S.debugView = 0; P.grain = g0; return out;
    },
    /** thin-occluder leak: torch B inside the storage room at its door, the corridor's lights off; door shut then ajar (0.22 rad), march vs froxel */
    async door() {
      F.install(); const S = E().settings; const g = G();
      const [tA, tB] = F.torches; tA.enabled = false; tB.enabled = true; tB.pos = [32.6, 1.2, 7.2]; tB.dir = norm([0, -0.08, 1]);
      const groups = [...new Set(E().lights.lights.map(l => l.group))];
      for (const gr of groups) if (!['test', 'exterior', 'flashlights', 'player', 'transient', 'tracer', 'devices'].includes(gr)) g.setGroup(gr, false);
      F.stageDoor();
      const door = (g.doors.list || g.doors.doors)[3];
      const out = [];
      door.angle = 0; if ('target' in door) door.target = 0;
      S.froxelVol = true; window.__runFrames(40, 1 / 60); out.push(await F.capv('door3-shut-frox'));
      S.froxelVol = false; window.__runFrames(10, 1 / 60); out.push(await F.capv('door3-shut-march'));
      door.locked = false; door.angle = 0.22; if ('target' in door) door.target = 0.22;
      S.froxelVol = true; window.__runFrames(40, 1 / 60); out.push(await F.capv('door3-crack-frox'));
      S.froxelVol = false; window.__runFrames(10, 1 / 60); out.push(await F.capv('door3-crack-march'));
      door.angle = 0; if ('target' in door) door.target = 0; door.locked = true;
      for (const gr of groups) if (!['test', 'exterior', 'flashlights', 'player', 'transient', 'tracer', 'devices'].includes(gr)) g.setGroup(gr, true);
      tA.enabled = true; tB.pos = [17.5, 1.1, 15.6]; tB.dir = norm([1, -0.06, 0.25]); S.froxelVol = true; return out;
    },
    /** the south street lamp's sodium cone in the rain, march vs froxel */
    async lot() {
      F.install(); const S = E().settings; F.torches[0].enabled = false; F.torches[1].enabled = false;
      F.stageLot(); const out = [];
      S.froxelVol = true; window.__runFrames(40, 1 / 60); out.push(await F.capv('lot-frox'));
      S.froxelVol = false; window.__runFrames(10, 1 / 60); out.push(await F.capv('lot-march'));
      S.froxelVol = true; F.torches[0].enabled = true; F.torches[1].enabled = true; return out;
    },
    /** N lossless frames of the static rig, volumetrics-only, no grain, for the per-pixel temporal sd (docs/shots/ab/<prefix>-<v>-NN.png; the lane's numpy script reads them) */
    async sdFrames(prefix = 'p2b-sd2', n = 24) {
      F.install(); const S = E().settings, P = E().passes; const g0 = P.grain; P.grain = 0; S.debugView = 5;
      F.torches[0].enabled = true; F.torches[1].enabled = true; F.stageStatic();
      for (const v of ['frox', 'march']) {
        S.froxelVol = v === 'frox'; window.__runFrames(40, 1 / 60);
        for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60); await window.__png(`${prefix}-${v}-${String(i).padStart(2, '0')}`); }
      }
      S.froxelVol = true; S.debugView = 0; P.grain = g0; return `${2 * n} pngs`;
    },
  };
  window.__fxs = F;
})();
