// The WIND lane's look rigs, one-model check and cost takes (game/wind.ts, docs/internal/wind.md). Plain JS, nothing bundled; on a `?paused&quality=<tier>&mute` boot:
//     await import('/qa/wind-scenes.js');                 // → window.__ws
//     await __ws.plume({ wind: 1 }) / ({ wind: 0 })        // a smoke can under the middle-aisle diffuser: strip at +1 … +8 s → docs/shots/wind/plume-w1_*.jpg (w0 = still air)
//     await __ws.paper({ wind: 1 })                        // two reams settled on the desk under vent_cub_nw, then eight seconds of the vent → the leaves tremble, some slide
//     await __ws.door({ wind: 1 })                         // a can inside the open fire exit in the storm: the plume leans into the room
//     await __ws.moths()                                   // the east sodium lamp's head at night, six frames a sixth of a second apart
//     await __ws.tube() / .lock() / .breaker()             // the fixture deaths: a corridor panel shot out, the server door's lock kicked through, the breaker shot
//     await __ws.sight()                                   // ONE MODEL: a guard's smoke sight line through the vent-bent plume vs the unbent one (probe transmittance, both ways)
//     await __ws.cost()                                    // serialized unions: idle office wind on / off, a plume under a vent on / off (+ the smoke pass), the moths on screen
// Every scene restores what it touched (tune.wind, the weather, the door) and clears smoke / particles when done. Deterministic staging (Math.random seeded per scene).
(() => {
  const G = () => window.__game, E = () => window.__engine, C = () => window.__cam, W = () => window.__wind;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  const shot = (name, q = 0.9) => window.__shot('wind/' + name, q);
  const run = (n, dt = 1 / 60) => window.__runFrames(n, dt);
  /** serialized frames: each followed by a queue drain + a yield, so the timer's readbacks are this frame's (CLAUDE.md 'GPU timing') */
  async function runSerial(n, each) { for (let i = 0; i < n; i++) { run(1); await settle(); if (each) each(i); } }
  let torch = null;
  function torchAt(pos, dir, on = true, intensity = 70, outerDeg = 17) {
    const l = Math.hypot(...dir); const d = dir.map(x => x / l);
    if (!torch) torch = E().lights.add({ name: 'windTorch', group: 'test', kind: 1, pos: [...pos], dir: d, color: [1.0, 0.92, 0.78], intensity, range: 16, innerDeg: 6, outerDeg, radius: 0.02, volumetric: 1, owner: 0, enabled: on, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: intensity });
    torch.pos = [...pos]; torch.dir = d; torch.intensity = torch.peakIntensity = intensity; torch.enabled = on; torch.outerDeg = outerDeg;
    return torch;
  }
  const park = (player) => ({ park: true, player: { holstered: true, invisible: true, ...player } });
  const S0 = {};
  function begin(seed = 4242) {
    const g = G(); window.__testVisible = true; window.__menu?.close(); Math.random = mulberry32(seed); g.godMode = true;
    g.clearAftermath(); g.resetGuards(); g.props.reset(); g.repairLights?.(); window.__particles?.clear(); window.__smoke?.clearAll?.();
    S0.wind = g.tune.wind; S0.storm = { on: g.weather.enabled, storm: g.weather.storm, rain: g.weather.rainRate, wind: [...g.weather.wind] }; S0.ai = g.aiEnabled;
    for (const gd of g.guards) gd.char.anim.phase = 0;
    return g;
  }
  function end() {
    const g = G(); g.tune.wind = S0.wind ?? 1; g.aiEnabled = S0.ai ?? true; C().pin = null; if (torch) torch.enabled = false;
    if (S0.storm) { g.weather.storm = S0.storm.storm; g.weather.rainRate = S0.storm.rain; g.weather.wind[0] = S0.storm.wind[0]; g.weather.wind[1] = S0.storm.wind[1]; }
    if (S.heldDoor) { S.heldDoor = null; }
  }
  /** hold a door open at `angle` (its closer would pull it to): re-set every frame the scene steps */
  function holdDoor(name, angle) { const d = G().doors.byName(name); if (!d) return null; d.angle = angle; d.vel = 0; d.latched = false; d.closing = false; d.place(); S.heldDoor = { d, angle }; return d; }
  function runHeld(n) { for (let i = 0; i < n; i++) { if (S.heldDoor) { const { d, angle } = S.heldDoor; d.angle = angle; d.vel = 0; d.latched = false; d.place(); } run(1); } }

  const S = {
    heldDoor: null, log: [],
    /** PLUME: a smoke can 0.55 m east of the middle-aisle diffuser's axis (vent_aisle at 19.8 / 14.6): still air = the plume rises to the slab and mushrooms; the vent on = the
     *  down-jet meets it, folds it over and drives it out along the floor away from the axis. Strip +1 / +2 / +3 / +4.5 / +6 / +8 s. opts { wind 0|1, tag } */
    async plume(opts = {}) {
      const { wind = 1, tag = `w${opts.wind ?? 1}`, at = [20.3, 0, 14.95], secs = [1, 2, 3, 4.5, 6, 8] } = opts;
      const g = begin(21); g.tune.wind = wind;
      window.__stage({ look: [20.05, 1.25, 14.8], yaw: 0 * DEG, pitch: 9 * DEG, dist: 4.9 }, park({ pos: [13.6, 0, 22.6], yaw: 1.57 }));   // from the south end of the middle aisle, chest height, looking north at the corridor partition: the diffuser overhead, the can on the floor 0.5 m east of its axis
      torchAt([22.4, 1.4, 17.2], [-0.62, -0.1, -0.78], true, 60, 20);   // a raking torch across the aisle from the south-east so the plume's body reads
      run(20);
      window.__smoke.spawnCanister([at[0], 0.02, at[2]]);
      const out = []; let f = 0;
      for (const s of secs) { const n = Math.round(s * 60) - f; run(n); f += n; await settle(); out.push(await shot(`plume-${tag}_t${String(s).replace('.', '')}`)); }
      const res = { shots: out, wind: W().summary(), smoke: { live: window.__smoke.stats.live, windSrcs: window.__smoke.stats.windSrcs } };
      window.__smoke.clearAll(); end(); return res;
    },
    /** PAPER: 200 leaves thrown up over the red cluster's north-west desk (under vent_cub_nw at 15.3 / 14.1) in STILL air and left four seconds to settle on the desk, the
     *  partition tops and the floor; then `wind` for eight seconds — strip at 0 / +1 / +2 / +4 / +6 / +8 s. wind 1: they tremble, and gust by gust some lift and slide off. */
    async paper(opts = {}) {
      const { wind = 1, ventK = 1, tag = `w${opts.wind ?? 1}${(opts.ventK ?? 1) !== 1 ? 'k' + opts.ventK : ''}` } = opts;
      const g = begin(22); g.tune.wind = 0; const ventK0 = W().knobs.ventK; W().knobs.ventK = ventK;
      for (const t of g.targets) if (t.group === 'cubicles' && t.kind === 'emissive' && Math.hypot(t.pos[0] - 16.5, t.pos[2] - 15.2) < 1) t.on = true;   // the panel over the red cluster lit (authored off): light to see the desk by
      window.__stage({ look: [15.35, 0.8, 14.6], yaw: -90 * DEG, pitch: 36 * DEG, dist: 2.7 }, park({ pos: [13.6, 0, 22.6], yaw: 1.57 }));   // from the west aisle, over the partition, down at the desk top
      torchAt([13.3, 1.7, 16.9], [0.6, -0.32, -0.73], true, 55, 24);
      run(10);
      window.__particles.emit('sheet', [15.3, 1.25, 14.65], [0, 1, 0], 200, { shape: 'burst', spread: 0.5, lift: 0.3, speed: 2.2, speedJit: 0.7, life: 120, lifeJit: 0.1, size: 0.21, sizeJit: 0.15, aspect: 1.41, tumble: 6, nrmJit: 0.5, posJit: 0.45, color: [0.86, 0.86, 0.82] });
      run(240); await settle();
      const out = []; out.push(await shot(`paper-${tag}_t0`));
      g.tune.wind = wind; let f = 0;
      for (const s of [1, 2, 4, 6, 8]) { const n = s * 60 - f; run(n); f += n; await settle(); out.push(await shot(`paper-${tag}_t${s}`)); }
      const st = window.__particles.stats; const res = { shots: out, woken: st.windWoken, kicked: st.kicked, alive: st.alive, asleep: st.asleep, wind: W().summary(), airAtDesk: W().at([15.5, 0.8, 14.5]) };
      W().knobs.ventK = ventK0; for (const t of g.targets) if (t.group === 'cubicles' && t.kind === 'emissive') t.on = g.initialOn?.get(t) ?? t.on;
      end(); return res;
    },
    /** DOOR: the fire exit (x 36, z 20‥21.2) held wide open in the storm (wind from the east, 3 m/s), a smoke can a metre and a half inside it: still air = the plume stands;
     *  the gust = it leans west into the cubicle floor. Strip +1 … +8 s. */
    async door(opts = {}) {
      const { wind = 1, tag = `w${opts.wind ?? 1}` } = opts;
      const g = begin(23); g.tune.wind = wind;
      g.weather.setEnabled(true); g.weather.storm = 0.8; g.weather.rainRate = 0.5; g.weather.wind[0] = -3.0; g.weather.wind[1] = 0.4;   // blowing in from the lot to the east
      window.__stage({ look: [34.8, 1.15, 20.6], yaw: -100 * DEG, pitch: 15 * DEG, dist: 5.0 }, park({ pos: [13.6, 0, 22.6], yaw: 1.57 }));   // inside the break room looking east at the open leaf, the lot's lamp beyond
      torchAt([31.0, 1.4, 23.5], [0.72, -0.12, -0.68], true, 60, 22);
      holdDoor('fire_exit', -1.5); runHeld(20);
      window.__smoke.spawnCanister([34.6, 0.02, 20.7]);
      const out = []; let f = 0;
      for (const s of [1, 2, 3, 4.5, 6, 8]) { const n = Math.round(s * 60) - f; runHeld(n); f += n; await settle(); out.push(await shot(`door-${tag}_t${String(s).replace('.', '')}`)); }
      const res = { shots: out, wind: W().summary(), doorSrc: W().sources().find(s => s.name === 'door:fire_exit'), smoke: { live: window.__smoke.stats.live, windSrcs: window.__smoke.stats.windSrcs } };
      window.__smoke.clearAll(); const d = g.doors.byName('fire_exit'); if (d) d.reset(); end(); return res;
    },
    /** MOTHS: the east sodium lamp's cobra head (38.25 / 5.15 / 22) from just below and south, six frames ten frames apart — the moths circling under the lens. opts.gale: the
     *  storm turned up to 7 m/s first (they scatter). */
    async moths(opts = {}) {
      const { gale = false, tag = gale ? 'gale' : 'calm' } = opts;
      const g = begin(25); g.tune.wind = 1; g.tune.moths = true;
      if (gale) { g.weather.setEnabled(true); g.weather.storm = 1; g.weather.wind[0] = -6.5; g.weather.wind[1] = 2.5; } else { g.weather.wind[0] = 0.8; g.weather.wind[1] = 0.3; }
      window.__stage(opts.close ? { look: [38.25, 4.8, 22.0], yaw: 220 * DEG, pitch: -6 * DEG, dist: 2.2 } : { look: [38.0, 0.3, 22.0], yaw: 200 * DEG, pitch: 58 * DEG, dist: 8.5 }, park({ pos: [13.6, 0, 22.6], yaw: 1.57 }));   // the play view down onto the lamp's pool (the moths between the eye and the lit asphalt), or close: up at the head from beside the wall
      run(gale ? 200 : 240); await settle();
      const out = []; for (let k = 0; k < 6; k++) { out.push(await shot(`moths-${tag}${opts.close ? '-close' : ''}_f${k}`)); run(10); await settle(); }
      const res = { shots: out, summary: W().moths.summary, airAtHead: W().at([38.25, 5.2, 22.0]) };
      end(); return res;
    },
    /** TUBE: the corridor panel at x 20 (z 11.1) shot out from the west with the FN2000 — the flash, then the glass and phosphor showering onto the lino under the dying light. */
    async tube(opts = {}) {
      const { tag = '' } = opts; const g = begin(26); g.tune.wind = 1;
      window.__stage({ look: [14.0, 1.4, 11.1], yaw: 90 * DEG, pitch: 13 * DEG, dist: 4.6 }, { park: true, player: { pos: [9.6, 0, 11.45], yaw: Math.PI / 2, holstered: false } });   // the LIT corridor panel at x 14 (the x 20 one is authored off: an unlit fixture cannot be shot out) from the corridor east of it looking west, Sam beyond with the rifle
      g.player.slot = 'rifle'; run(30); await settle();
      const out = []; out.push(await shot(`tube${tag}_0pre`));
      window.__destr.burst([14.0, 2.95, 11.1], 1, 1); run(2); await settle(); out.push(await shot(`tube${tag}_f02`));
      for (const [n, name] of [[8, 'f10'], [14, 'f24'], [24, 'f48'], [42, 'f90'], [90, 'f180']]) { run(n); await settle(); out.push(await shot(`tube${tag}_${name}`)); }
      const res = { shots: out, panel: g.targets.filter(t => t.group === 'corridor' && t.broken).map(t => t.name) };
      end(); g.repairLights?.(); return res;
    },
    /** LOCK: the server door kicked through from the corridor — the leaf flung, the plaster off the jamb (kickDustFx) and now the long splinters of the torn keep thrown into
     *  the room with it. Frames +2 / +6 / +12 / +24 / +60. */
    async lock(opts = {}) {
      const { tag = '' } = opts; const g = begin(27); g.tune.wind = 1;
      const d = g.doors.byName('server'); d.reset();
      window.__stage({ look: [17.6, 0.9, 9.75], yaw: 180 * DEG, pitch: 28 * DEG, dist: 2.5 }, { park: true, player: { pos: [17.7, 0, 10.9], yaw: Math.PI, holstered: true } });   // from the server room's front aisle looking south at the leaf
      run(20); await settle();
      const out = []; out.push(await shot(`lock${tag}_0pre`));
      g.doors.kickIn(d, [17.7, 0, 10.9], 1); run(2); await settle(); out.push(await shot(`lock${tag}_f02`));
      for (const [n, name] of [[4, 'f06'], [6, 'f12'], [12, 'f24'], [36, 'f60']]) { run(n); await settle(); out.push(await shot(`lock${tag}_${name}`)); }
      const res = { shots: out, lockBroken: d.lockBroken };
      d.reset(); end(); return res;
    },
    /** BREAKER: the panel in the storage room shot — the arc-over burst and the soot, then the dark (the beacons come up). */
    async breaker(opts = {}) {
      const { tag = '' } = opts; const g = begin(28); g.tune.wind = 1;
      const bp = g.level.breaker.pos;
      window.__stage({ look: [bp[0], 1.3, bp[2] - 0.4], yaw: 205 * DEG, pitch: 22 * DEG, dist: 2.9 }, { park: true, player: { pos: [bp[0] + 0.9, 0, bp[2] - 2.2], yaw: -0.35, holstered: false } });   // from inside the storage room north-west of the panel; Sam north-east of it, pistol on it
      g.player.slot = 'pistol'; run(30); await settle();
      const out = []; out.push(await shot(`breaker${tag}_0pre`));
      window.__destr.burst([bp[0], bp[1], bp[2] - 0.05], 1, 1); run(2); await settle(); out.push(await shot(`breaker${tag}_f02`));
      for (const [n, name] of [[6, 'f08'], [10, 'f18'], [30, 'f48'], [72, 'f120']]) { run(n); await settle(); out.push(await shot(`breaker${tag}_${name}`)); }
      const res = { shots: out, blackout: { ...g.blackout } };
      end(); g.repairLights?.(); return res;
    },
    /** ONE MODEL: Novak planted 4 m WEST of the aisle vent looking east through the plume's ground at Sam standing 3 m east of it (both pinned, AI off); a can popped where
     *  plume() pops it. Per variant (wind 1 / 0, fresh staging each): the guard's probe transmittance toward Sam's chest sampled every half second for ten seconds + a shot at
     *  +3 and +6 s. The bent plume is driven along the floor and out of the chest-height line sooner / differently than the standing one — whatever the picture shows, the
     *  numbers must show. Returns both series side by side. */
    async sight(opts = {}) {
      const { secs = 10 } = opts; const series = {}; const shots = {};
      for (const wind of [1, 0]) {
        const g = begin(29); g.tune.wind = wind;
        const gd = g.guards[1] ?? g.guards[0];
        window.__stage({ look: [20.0, 1.0, 16.0], yaw: 90 * DEG, pitch: 42 * DEG, dist: 9 }, { park: true, guards: [{ i: g.guards.indexOf(gd), pos: [19.9, 0, 19.4], yaw: Math.PI, torch: true, aimPitch: -0.05 }], player: { pos: [20.15, 0, 13.0], yaw: 0, holstered: true, invisible: false } });   // Novak at the south end of the middle aisle looking NORTH up it at Sam by the corridor partition; the can 0.5 m east of the vent's axis between them
        gd.hold = true; gd.pinned = true; g.aiEnabled = false;
        run(30); await settle(); run(2); await settle();
        const sample = () => +(gd.smokeTrans ?? 1).toFixed(3);
        const s = [sample()];
        window.__smoke.spawnCanister([20.3, 0.02, 14.95]);
        for (let k = 1; k <= secs * 2; k++) { run(30); await settle(); s.push(sample()); if (k === 6 || k === 12) (shots[wind] ??= []).push(await shot(`sight-w${wind}_t${k / 2}`)); }
        series[wind] = s;
        window.__smoke.clearAll(); g.aiEnabled = true; end();
      }
      const diff = series[1].map((v, i) => +(v - series[0][i]).toFixed(3));
      return { tHalfSecs: series[1].map((_, i) => i / 2), windOn: series[1], windOff: series[0], diff, maxAbsDiff: Math.max(...diff.map(Math.abs)), shots };
    },
    /** COST (serialized frames; read the UNION): (a) the idle office from the spawn view, wind 1 vs 0; (b) the plume under the aisle vent, wind 1 vs 0 — union + the smoke and
     *  particles passes; (c) the moths view. `frames` per take after `warm`. Interleaved A/B/A/B for (a) and (b). */
    async cost(opts = {}) {
      const { frames = 60, warm = 30 } = opts; const e = E(), t = e.timer;
      const take = async (label, setup, n = frames) => {
        await setup(); for (let i = 0; i < warm; i++) { run(1); await settle(); }
        const per = new Map(); const unions = [];
        for (let i = 0; i < n; i++) { run(1); await settle(); const u = t.unionMs?.(); if (u > 0) unions.push(u); for (const [k, v] of (t.lastFrame ?? new Map())) { if (typeof v !== 'number' || !(v >= 0)) continue; const a = per.get(k) ?? []; a.push(v); per.set(k, a); } }   // (lastFrame: the last resolved readback's unsmoothed per-pass ms — a Map)
        const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); const p95 = a => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * 0.95))] ?? 0; };
        const passes = {}; for (const [k, a] of per) passes[k] = +mean(a).toFixed(3);
        return { label, union: { mean: +mean(unions).toFixed(2), p95: +p95(unions).toFixed(2), n: unions.length }, smoke: passes.smoke, particles: passes.particles, passes };
      };
      const out = [];
      // (a) idle office, spawn view
      const idle = wind => async () => { const g = begin(31); g.tune.wind = wind; C().pin = null; window.__stage({ look: [8.5, 0.5, 15.5], yaw: 40 * DEG, pitch: 55 * DEG, dist: 11 }, { player: { pos: [5.1, 0, 15.2] } }); };
      out.push(await take('idle wind 1', idle(1))); out.push(await take('idle wind 0', idle(0))); out.push(await take('idle wind 1 (b)', idle(1))); out.push(await take('idle wind 0 (b)', idle(0)));
      // (b) plume under the vent
      const plume = wind => async () => { const g = begin(32); g.tune.wind = wind; window.__stage({ look: [20.05, 1.25, 14.8], yaw: 0, pitch: 9 * DEG, dist: 4.9 }, park({ pos: [13.6, 0, 22.6] })); run(5); window.__smoke.spawnCanister([20.3, 0.02, 14.95]); run(90); };
      out.push(await take('plume wind 1', plume(1))); out.push(await take('plume wind 0', plume(0))); out.push(await take('plume wind 1 (b)', plume(1))); out.push(await take('plume wind 0 (b)', plume(0)));
      window.__smoke.clearAll();
      // (c) the moths on screen
      out.push(await take('moths view', async () => { const g = begin(34); g.tune.wind = 1; window.__stage({ look: [38.25, 4.75, 22.0], yaw: 160 * DEG, pitch: 12 * DEG, dist: 2.4 }, park({ pos: [13.6, 0, 22.6] })); }));
      out.push(await take('moths view (moths off)', async () => { const g = begin(34); g.tune.wind = 1; g.tune.moths = false; window.__stage({ look: [38.25, 4.75, 22.0], yaw: 160 * DEG, pitch: 12 * DEG, dist: 2.4 }, park({ pos: [13.6, 0, 22.6] })); }));
      G().tune.moths = true; end();
      return out;
    },
    /** GPU validation: an error scope round a plume under the vent + a papered desk + a bang, at the current tier; null = clean */
    async validate() {
      const dev = E().device; dev.pushErrorScope('validation');
      const g = begin(35); g.tune.wind = 1;
      window.__stage({ look: [20.05, 1.25, 14.8], yaw: 0, pitch: 9 * DEG, dist: 4.9 }, { park: true, guards: [{ i: 0, pos: [13.4, 0, 13.3], yaw: 0, torch: true }], player: { pos: [26.0, 0, 22.6], holstered: true } });
      window.__smoke.spawnCanister([20.35, 0.02, 14.75]); window.__particles.emit('sheet', [15.3, 1.25, 14.65], [0, 1, 0], 120, { shape: 'burst', spread: 0.5, lift: 0.3, speed: 2.2, life: 60, size: 0.21, aspect: 1.41, tumble: 6, nrmJit: 0.5, posJit: 0.45, color: [0.86, 0.86, 0.82] });
      run(120); window.__destr.kick([15.4, 0.8, 14.6], 'bang'); run(120); await settle();
      const err = await dev.popErrorScope();
      window.__smoke.clearAll(); end();
      return err ? String(err.message ?? err) : null;
    },
  };
  window.__ws = S;
})();
