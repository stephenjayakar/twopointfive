// The destruction lane's look rigs + cost takes (docs/internal/destruction.md, docs/review/destruction.html): four staged situations captured as 3-frame strips
// + ×3 crops, and the stress minute with a scripted FN2000 burst at chaos 0 / 0.5 / 1 per tier. Plain JS, nothing bundled; on a `?paused&quality=<tier>&mute`
// boot once the hooks exist:
//     await import('/qa/destr-scenes.js');           // → window.__ds
//     await __ds.paper()   / .dust() / .tile() / .monitor()      // each: stage, act, capture → docs/shots/destr_<scene>_*.jpg via the shot sink on __shotPort
//     await __ds.cost({ chaos: [0, 0.5, 1], frames: 300 })       // the stress minute (tools/qa/stress-scene.js) + a 3 s full-auto burst into the cubicles per take
//     await __ds.sight()                                            // one-model check: a guard's smoke sight line through a dust-filled doorway (probe transmittance)
//     await __ds.kickBang() / .kickRounds() / .kickBody()          // the IMPULSES: a stun can among the leaves of a burst, rounds walked over a papered desk, a man dropping among leaves
//     await __ds.kickCost({ n: 2000 })                              // what a bang's impulse costs the particles pass with 2000 live sheets in reach (serialized, occlusion on / off)
// Every scene puts chaos back, resets the destruction and clears particles when it is done. Deterministic staging (Math.random seeded per scene).
(() => {
  const G = () => window.__game, E = () => window.__engine, C = () => window.__cam, D = () => window.__destr;
  const DEG = Math.PI / 180;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  const shot = (name, q = 0.9) => window.__shot('destr/' + name, q);
  const run = (n, dt = 1 / 60) => window.__runFrames(n, dt);
  let torch = null;
  function torchAt(pos, dir, on = true, intensity = 70) {
    const l = Math.hypot(...dir); const d = dir.map(x => x / l);
    if (!torch) torch = E().lights.add({ name: 'destrTorch', group: 'test', kind: 1, pos: [...pos], dir: d, color: [1.0, 0.92, 0.78], intensity, range: 16, innerDeg: 7, outerDeg: 19, radius: 0.07, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: intensity, card: true });
    torch.pos = [...pos]; torch.dir = d; torch.intensity = torch.peakIntensity = intensity; torch.enabled = on;
  }
  const park = (player) => ({ park: true, player: { holstered: false, ...player } });
  /** fire `n` FN2000 rounds from Sam's muzzle at the points pts[i % pts.length], one every `every` frames; `onFrame(k)` after each round's frames (captures) */
  async function rake(pts, n, every, onRound) { for (let r = 0; r < n; r++) { D().burst(pts[r % pts.length], 1, 1); run(every); if (onRound) await onRound(r); } }
  function begin(chaos, seed = 4242) { const g = G(); window.__testVisible = true; window.__menu?.close(); Math.random = mulberry32(seed); g.godMode = true; g.clearAftermath(); g.resetGuards(); g.props.reset(); g.repairLights?.(); S.chaos0 = D().chaos; D().chaos = chaos; if ('impulses' in D()) { S.imp0 = D().impulses; D().impulses = true; } D().reset(); window.__particles?.clear(); window.__marks?.clear(); S.ai0 = g.aiEnabled; return g; }   // (a fresh shift on its marks — a man KO'd by the last scene would lie where the next one seeds its leaves — nothing in the air, the impulses ON whatever this profile's panel says: the rigs are about them)
  function end() { D().chaos = S.chaos0; if ('impulses' in D() && S.imp0 !== undefined) D().impulses = S.imp0; G().aiEnabled = S.ai0 ?? true; C().pin = null; if (torch) torch.enabled = false; }

  const S = {
    chaos0: 0.5, log: [],
    /** PAPER: the tan cluster's north-east desk raked from the north — the lit monitor dies cracked, the two paper stacks go up under the flickering panel, binders /
     *  phone off the desk behind. Strip: pre · mid-burst · +0.4 s · +3 s (settled) + crops of the sheets mid-air and the dead screen. */
    async paper(opts = {}) {
      const { chaos = 1.0, tag = '' } = opts; const g = begin(chaos, 11);
      window.__stage({ look: [17.75, 0.75, 21.1], yaw: 25 * DEG, pitch: 48 * DEG, dist: 4.6 }, park({ pos: [17.75, 0, 23.3], yaw: Math.PI }));
      g.player.slot = 'rifle'; run(30);
      const out = []; out.push(await shot(`paper${tag}_0pre`));
      const pts = [[17.7, 1.1, 20.99], [17.55, 0.82, 21.3], [17.75, 0.8, 21.25], [17.9, 0.95, 21.0], [17.45, 0.9, 21.05], [17.7, 1.15, 21.0], [18.0, 0.8, 21.3], [17.3, 0.85, 21.2]];
      await rake(pts, 24, 6, async r => { if (r === 3 || r === 9 || r === 16) out.push(await shot(`paper${tag}_r${r}`)); });
      out.push(await shot(`paper${tag}_end`)); run(24); out.push(await shot(`paper${tag}_p04`)); run(36); out.push(await shot(`paper${tag}_p1`)); run(120); out.push(await shot(`paper${tag}_p3`));
      const res = { shots: out, stats: { ...D().stats }, debris: D().debris, log: D().log.slice(-10) };
      end(); return res;
    },
    /** DUST: a burst into the corridor's north wall (plaster) beside the fixed torch — the beam crossing the dust the rounds knock out (froxels), chips on the lino.
     *  Strip: pre · mid · end · +1 s · +3 s (the haze thinning). */
    async dust(opts = {}) {
      const { chaos = 1.0, tag = '' } = opts; const g = begin(chaos, 12);
      window.__stage({ look: [22.2, 0.6, 10.6], yaw: -70 * DEG, pitch: 38 * DEG, dist: 5.4 }, park({ pos: [20.6, 0, 11.7], yaw: Math.PI }));   // (inside the corridor: z 10.06‥12.14 between its walls)
      torchAt([24.2, 1.1, 11.9], [-0.55, -0.18, -0.82], true, 80);
      g.player.slot = 'rifle'; run(30);
      const out = []; out.push(await shot(`dust${tag}_0pre`));
      const pts = [[21.6, 1.2, 10.02], [22.0, 0.9, 10.02], [21.3, 1.5, 10.02], [22.4, 1.3, 10.02], [21.8, 0.6, 10.02], [22.7, 1.0, 10.02]];
      await rake(pts, 30, 6, async r => { if (r === 6 || r === 14 || r === 22) out.push(await shot(`dust${tag}_r${r}`)); });
      out.push(await shot(`dust${tag}_end`)); run(60); out.push(await shot(`dust${tag}_p1`)); run(120); out.push(await shot(`dust${tag}_p3`)); run(180); out.push(await shot(`dust${tag}_p6`));
      const res = { shots: out, stats: { ...D().stats }, smoke: window.__smoke?.stats?.live, log: D().log.slice(-8) };
      end(); return res;
    },
    /** TILE: a stun charge's worth of destruction on the red cluster's aisle (bang, no flash) — the tile above see-saws down through the panel light; captured every
     *  6 frames while it falls, then landed. */
    async tile(opts = {}) {
      const { chaos = 0.5, tag = '', at = [20.5, 0.05, 16.3] } = opts;   // (a square clear of the light panels whichever way the jitter walks it)
      begin(chaos, 13);
      window.__stage({ look: [at[0], 1.2, at[2]], yaw: 200 * DEG, pitch: 35 * DEG, dist: 6.2 }, park({ pos: [14, 0, 22.5], yaw: 1.57, holstered: true, invisible: true }));
      run(20);
      const out = []; out.push(await shot(`tile${tag}_0pre`));
      D().bang(at); run(2);
      for (let k = 0; k < 9; k++) { out.push(await shot(`tile${tag}_f${String(k * 6 + 2).padStart(2, '0')}`)); run(6); }
      run(60); out.push(await shot(`tile${tag}_landed`));
      const res = { shots: out, stats: { ...D().stats }, debris: D().debris, log: D().log.slice(-8) };
      end(); return res;
    },
    /** MONITOR: the lit screen on the red cluster's north-west desk (monitor4, 15.3 / 15.57, facing north) takes one round, then a burst: dead + cracked + sparks, then off
     *  its stand. Strip: lit · the frame after the round · +0.5 s · after the burst. */
    async monitor(opts = {}) {
      const { chaos = 0.5, tag = '' } = opts; const g = begin(chaos, 14);
      window.__stage({ look: [15.3, 0.95, 15.7], yaw: 15 * DEG, pitch: 32 * DEG, dist: 3.4 }, park({ pos: [15.4, 0, 17.9], yaw: Math.PI }));
      g.player.slot = 'rifle'; run(30);
      const out = []; out.push(await shot(`monitor${tag}_0lit`));
      D().burst([15.32, 1.1, 15.6], 1, 1); run(2); out.push(await shot(`monitor${tag}_1hit`)); run(30); out.push(await shot(`monitor${tag}_2dead`));
      await rake([[15.3, 1.05, 15.58], [15.45, 1.12, 15.58], [15.2, 1.0, 15.58], [15.35, 0.85, 15.5]], 14, 6);
      run(40); out.push(await shot(`monitor${tag}_3burst`)); run(120); out.push(await shot(`monitor${tag}_4after`));
      const res = { shots: out, stats: { ...D().stats }, debris: D().debris, log: D().log.slice(-8) };
      end(); return res;
    },
    /** ONE MODEL: a guard at the corridor's east end looking west at Sam through the storage doorway's stretch of corridor; dust puffs raised between them by a burst
     *  into the wall beside the line; the probe's smoke transmittance for that guard (gd.smokeTrans) sampled before / during / after. Needs the real GPU probe. */
    async sight(opts = {}) {
      const { chaos = 1.0 } = opts; const g = begin(chaos, 15);
      const gd = g.guards[0];
      window.__stage({ look: [24, 0.8, 11.2], yaw: -90 * DEG, pitch: 45 * DEG, dist: 9 }, { park: true, guards: [{ i: 0, pos: [27.5, 0, 11.2], yaw: -Math.PI / 2, torch: false }], player: { pos: [20.5, 0, 11.2], yaw: Math.PI / 2, holstered: false, invisible: true } });
      gd.hold = true; gd.pinned = true; g.aiEnabled = false;
      run(30); await settle();
      const sample = () => +(gd.smokeTrans ?? 1).toFixed(3);
      const before = sample();
      // dust between them: rounds into the north wall at x 23‥25 (z 10.02), low, so the puffs drift across the sight line at chest height
      const pts = [[23.2, 1.0, 10.02], [24.0, 1.2, 10.02], [24.8, 0.9, 10.02], [23.6, 1.4, 10.02], [24.4, 1.1, 10.02]];
      const during = [];
      await rake(pts, 30, 6, async r => { if (r % 5 === 4) { await settle(); during.push(sample()); } });
      const after = []; for (let k = 0; k < 6; k++) { run(60); await settle(); after.push(sample()); }
      const res = { before, during, after, minDuring: Math.min(...during), puffs: D().stats.puffs, smoke: window.__smoke?.stats?.live };
      g.aiEnabled = true; end(); return res;
    },
    /** COST: the stress minute (stress-scene.js setup, fight true) + a 3 s FN2000 full-auto burst into the cubicles at each chaos level; per take: passes mean / p95, union
     *  p95, the rigid mover peak, particle slots. Serialized frames. opts: { chaos = [0, 0.5, 1], frames = 240, setup = true } */
    async cost(opts = {}) {
      const { chaos = [0, 0.5, 1], frames = 240, setup = true } = opts;
      if (!window.__stress) await import('/qa/stress-scene.js');
      const st = window.__stress; const g = G();
      if (setup) S.log.push(await st.setup({ fight: true }));
      const takes = {};
      for (const c of chaos) {
        D().chaos = c; D().reset(); st.reseed(99);
        const e = E(), t = e.timer, cam = C();
        const per = new Map(); const unions = []; let peakMoving = 0, peakLive = 0, got = 0;
        const pts = [[18.4, 0.9, 20.2], [17.9, 1.0, 20.3], [18.2, 0.8, 20.0], [17.6, 1.1, 20.25], [18.6, 0.85, 20.4], [17.7, 0.95, 20.99]];
        for (let i = 0; i < frames; i++) {
          cam.pin.yaw += st.orbitDeg * DEG;
          if (i < 180 && i % 6 === 0) D().burst(pts[(i / 6) % pts.length], 1, 1);   // 3 s of full auto (10 rounds/s) into the tan cluster from wherever Sam stands
          const before = t.resolved;
          run(1); await settle();
          for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1));
          if (t.resolved === before) continue;
          got++;
          for (const [k, v] of t.lastFrame) { if (!per.has(k)) per.set(k, []); per.get(k).push(v); }
          unions.push(t.unionMs ? t.unionMs() : 0);
          const db = D().debris; peakMoving = Math.max(peakMoving, db.moving); peakLive = Math.max(peakLive, db.n);
        }
        const stat = a => { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: +m.toFixed(2), p95: +s[Math.floor(0.95 * (s.length - 1))].toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
        const passes = {}; for (const [k, a] of per) passes[k] = stat(a);
        takes[c] = { frames: got, union: stat(unions), particles: passes.particles, pdraw: passes.pdraw, smoke: passes.smoke, gbuffer: passes.gbuffer, direct: passes.direct, restir: passes.restir, volFroxel: passes.volFroxel, volumetrics: passes.volumetrics, peakMoving, peakLive, stats: { ...D().stats }, pslots: E().particles?.liveSlots, res: [e.width, e.height], preset: window.__quality?.label };
        S.log.push(`chaos ${c}: union ${JSON.stringify(takes[c].union)} particles ${JSON.stringify(passes.particles)} movers ${peakMoving}`);
      }
      D().chaos = S.chaos0;
      return takes;
    },
    // ------------------------------------------------------------------ IMPULSES (destruction.ts bangImpulse / impactImpulse / thud → particles.ts impulse; docs/internal/destruction.md
    // 'Impulses'): what already lies about kicked again by what happens next. Strips → docs/shots/kick-*.jpg (tools/qa/filmstrip.py tiles the frames).
    /** KICK-BANG (the money shot): the tan cluster's north desk raked for three seconds at the given chaos — its stacks in the air, then all over the floor — and a stun
     *  can rolled in among the leaves a second later: they go up again and flutter down. Frames: papered · det+3 · +8 · +14 · +24 · +40 · +70.
     *  opts.flash false = the destruction's bang without the can (no flash / dazzle: __destr.bang), 'kick' = the impulse ALONE (nothing converted or dropped). */
    async kickBang(opts = {}) {
      const { chaos = 0.5, tag = '', flash = true, canAt = [18.3, 0, 21.95], frames = [3, 8, 14, 24, 40, 70] } = opts;   // (the can comes to rest by the desk's north-east corner, among the leaves the burst left there)
      const g = begin(chaos, 31);
      window.__stage({ look: [17.85, 0.3, 21.7], yaw: (opts.yawDeg ?? 158) * DEG, pitch: (opts.pitchDeg ?? 55) * DEG, dist: opts.dist ?? 10.5 }, park({ pos: [17.75, 0, 23.2], yaw: Math.PI }));   // (the play view: the follow camera's own pitch and yaw, zoomed in from its 21 m as a player watching his burst would be)
      g.player.slot = 'rifle'; run(30);
      const pts = [[17.55, 0.82, 21.3], [17.7, 1.1, 20.99], [17.75, 0.8, 21.25], [17.9, 0.95, 21.0], [17.45, 0.9, 21.05], [17.3, 0.85, 21.2], [18.0, 0.8, 21.3], [17.6, 0.79, 21.35], [18.25, 1.0, 20.66], [17.2, 1.0, 20.7]];
      await rake(pts, 30, 6);          // 3 s of AUTO across the desk: the stacks convert on the first rounds, chips / dust / the binders follow
      run(150);                        // 2.5 s: everything down and asleep
      const out = []; out.push(await shot(`kick-bang${tag}_0papered`));
      const k0 = window.__particles.stats.kicked; const b0 = D().stats.bangs; let fuse = 0;
      if (flash === true) { g.dropThrowable('flash', canAt); while (D().stats.bangs === b0 && fuse < 120) { run(1); fuse++; } }   // fuse 0.35 s from where it comes to rest → step to the very frame it goes off (keyed on the destruction's own bang count, which moves whether or not the impulses are on)
      else if (flash === 'kick') { window.__destr.kick([canAt[0], 0.13, canAt[2]], 'bang'); run(1); }
      else { window.__destr.bang([canAt[0], 0.13, canAt[2]]); run(1); }
      let at = 0; for (const f of frames) { run(f - at); at = f; out.push(await shot(`kick-bang${tag}_f${String(f).padStart(2, '0')}`)); }
      run(120); out.push(await shot(`kick-bang${tag}_settled`)); await settle();
      const res = { shots: out, fuse, kicked: window.__particles.stats.kicked - k0, imp: JSON.parse(JSON.stringify(D().knobs.imp ?? null)), pstats: { ...window.__particles.stats }, stats: { ...D().stats }, debris: D().debris, log: D().log.slice(-8) };
      end(); return res;
    },
    /** KICK-ROUNDS: forty leaves settled over the red cluster's north-west desk top (test sheets, as a scattered stack leaves them), then single FN2000 rounds walked along
     *  the desk a foot apart, one every 15 frames: each hop-and-scoots the leaves beside its hole along its travel. Frames: settled · after each of rounds 1, 3, 5, 7 · +1 s. */
    async kickRounds(opts = {}) {
      const { chaos = 0.5, tag = '' } = opts; const g = begin(chaos, 32);
      window.__stage({ look: [15.35, 0.72, 14.62], yaw: 195 * DEG, pitch: 58 * DEG, dist: 2.9 }, park({ pos: [15.15, 0, 13.25], yaw: 0 }));
      torchAt([16.7, 1.9, 13.4], [-0.55, -0.6, 0.58], true, 55);   // (the red cluster's corner is unlit at night: a torch on the aisle side, down across the desk)
      g.player.slot = 'rifle'; run(20);
      window.__particles.emit('sheet', [15.3, 0.98, 14.62], [0, 1, 0], 44, { shape: 'burst', spread: 0.4, lift: 0.2, speed: 0.6, speedJit: 0.7, life: 120, lifeJit: 0.1, size: 0.2, sizeJit: 0.15, aspect: 1.41, tumble: 3, nrmJit: 0.45, posJit: 0.42, color: [0.86, 0.86, 0.82] });
      run(160);
      const out = []; out.push(await shot(`kick-rounds${tag}_0settled`)); const k0 = window.__particles.stats.kicked;
      const line = [[14.75, 0.77, 14.5], [15.05, 0.77, 14.62], [15.35, 0.77, 14.45], [15.6, 0.77, 14.66], [15.85, 0.77, 14.5], [16.0, 0.77, 14.7], [15.2, 0.77, 14.75], [15.5, 0.77, 14.4]];
      for (let r = 0; r < line.length; r++) { D().burst(line[r], 1, 1); run(5); if (r % 2 === 0) out.push(await shot(`kick-rounds${tag}_r${r + 1}`)); run(10); }
      run(60); out.push(await shot(`kick-rounds${tag}_after`)); await settle();
      const res = { shots: out, kicked: window.__particles.stats.kicked - k0, stats: { ...D().stats } };
      end(); return res;
    },
    /** KICK-BODY: Novak standing among a hundred settled leaves in the cubicles' aisle is struck and drops; the leaves he lands among jump with the thud (game.ts bodyThud →
     *  destr.thud). Frames: standing · falling · the landing · +0.3 s · +1 s. */
    async kickBody(opts = {}) {
      const { chaos = 0.5, tag = '', i = 1, at = [17.9, 0, 18.5] } = opts; begin(chaos, 33);
      window.__stage({ look: [at[0], 0.35, at[2]], yaw: 30 * DEG, pitch: 48 * DEG, dist: 3.6 }, { park: true, guards: [{ i, pos: at, yaw: 2.4, torch: false }], player: { pos: [14.2, 0, 22.6], yaw: 1.57, holstered: true, invisible: true } });
      const gd = G().guards[i]; gd.hold = true; gd.pinned = true; G().aiEnabled = false;   // (end() puts the AI back whatever happens below)
      try {
      run(10);
      for (let k = 0; k < 3; k++) window.__particles.emit('sheet', [at[0] + (k - 1) * 0.5, 0.3, at[2] + (k - 1) * 0.25], [0, 1, 0], 36, { shape: 'burst', spread: 0.3, lift: 0.3, speed: 1.0, speedJit: 0.7, life: 120, lifeJit: 0.1, size: 0.21, sizeJit: 0.15, aspect: 1.41, tumble: 4, nrmJit: 0.5, posJit: 0.5, color: [0.86, 0.86, 0.82] });
      run(180);
      const out = []; out.push(await shot(`kick-body${tag}_0standing`)); const k0 = window.__particles.stats.kicked, t0 = D().stats.impThud;
      window.__killGuard(i, 'struck');
      for (const [f, name] of [[24, 'falling'], [22, 'landing'], [14, 'landed'], [20, 'p03'], [60, 'p1']]) { run(f); out.push(await shot(`kick-body${tag}_${name}`)); }
      await settle();
      return { shots: out, thuds: D().stats.impThud - t0, kicked: window.__particles.stats.kicked - k0 };
      } finally { end(); }
    },
    /** KICK-COST: `n` live sheets settled within reach of one point on the aisle, then (serialized frames) the particles pass over 40 idle frames vs the bang frame, three takes,
     *  occlusion rays on and off. What the impulses cost the GPU: the record loop is O(live particles) with one any-hit ray per particle in reach. */
    async kickCost(opts = {}) {
      const { n = 2000, chaos = 0.5, at = [17.9, 0.02, 18.6] } = opts; begin(chaos, 21); window.__particles.clear();
      window.__stage({ look: [at[0], 0.4, at[2]], yaw: 25 * DEG, pitch: 50 * DEG, dist: 5.0 }, { park: true, player: { pos: [14.5, 0, 18.3], yaw: 1.57, holstered: true, invisible: true } });
      const e = E(), t = e.timer; const P = window.__particles;
      const frame1 = async () => { const before = t.resolved; run(1); await settle(); for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1)); return t.resolved !== before ? { p: t.lastFrame.get('particles') ?? 0, u: t.unionMs ? t.unionMs() : 0 } : null; };
      const per = Math.ceil(n / 50); let born = 0;
      for (let k = 0; k < 50; k++) { const a = k * 2.399, r = 0.4 + 3.0 * Math.sqrt((k + 0.5) / 50); born += P.emit('sheet', [at[0] + Math.cos(a) * r, 0.4, at[2] + Math.sin(a) * r], [0, 1, 0], per, { shape: 'burst', spread: 0.3, lift: 0.3, speed: 1.5, speedJit: 0.7, life: 120, lifeJit: 0.1, size: 0.21, sizeJit: 0.15, aspect: 1.41, tumble: 5, nrmJit: 0.5, posJit: 0.35, color: [0.86, 0.86, 0.82] }); }
      run(200);
      const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null; const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null;
      const res = { sheets: born, live: P.sys.liveSlots, res: [e.width, e.height], preset: window.__quality?.label, takes: {} };
      for (const occ of [true, false]) {
        P.sys.impulseOcclusion = occ;
        const idle = []; for (let i = 0; i < 40; i++) { const f = await frame1(); if (f) idle.push(f); }
        const bangs = [], unions = [];
        for (let k = 0; k < 3; k++) { const kicked0 = P.stats.kicked; window.__destr.kick([at[0], 0.13, at[2]], 'bang'); const b = await frame1(); run(12); await frame1(); await frame1(); bangs.push({ particles: b?.p, union: b?.u, kicked: P.stats.kicked - kicked0 }); run(180); await frame1(); }
        res.takes[occ ? 'occluded' : 'unoccluded'] = { idle: { particlesMean: mean(idle.map(x => x.p)), particlesMed: med(idle.map(x => x.p)), unionMean: mean(idle.map(x => x.u)) }, bang: bangs };
      }
      P.sys.impulseOcclusion = true; res.pstats = { ...P.stats };
      end(); return res;
    },
    /** GPU validation: five presets × a burst, collecting console errors (call after hooking console.error into window.__errs) */
    torchAt, rake, begin, end,
  };
  window.__ds = S;
  return 'destr scenes ready: await __ds.paper() / .dust() / .tile() / .monitor() / .sight() / .cost()';
})();
