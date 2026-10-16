// IN-PAGE half of look-stills.cjs (injected as text; defines window.__look). Uses only what the game page exposes on window.
(() => {
  const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const g = () => window.__game;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  const everybody = () => [g().player.char, ...g().guards.map(x => x.char), ...g().civilians.map(x => x.char)];
  const rec = (name) => name === 'Sam' ? null : g().guards.find(x => x.callsign === name) ?? g().civilians.find(x => (x.civ && x.civ.name === name) || x.callsign === name);
  const L = {
    gpuErrors: [],
    // the clean slate every page starts from: menu away, smoke off (the software adapter), seeded dice, a FRESH encounter (fresh Characters: nobody's outfit is
    // cached yet), AI off, nobody shoots. `trained` = callsigns to mark as the response element (+ the QRF's two tints) BEFORE anything is stepped.
    prep(seed, opts = {}) {
      const G = g();
      window.__testVisible = true; window.__pauseLoop = true;
      window.__menu.close(); window.__smoke.params.enabled = false;
      window.__engine.device.addEventListener('uncapturederror', e => { if (L.gpuErrors.length < 20) L.gpuErrors.push(String(e.error && e.error.message || e).slice(0, 300)); });
      Math.random = mulberry32(seed);
      G.restartEncounter();
      G.aiEnabled = false; G.godMode = true;
      if (G.fogOfWar) G.fogOfWar.on = false;
      for (const cs of opts.trained || []) { const r = rec(cs); if (!r) throw new Error('no man called ' + cs); r.trained = true; if (opts.carbine) r.route = Object.assign({}, r.route, { weapon: 'aks74u' }); r.char.tint = [0.1, 0.11, 0.13]; r.char.tint2 = [0.05, 0.055, 0.06]; }   // (qrf.ts: the element's tints)
      for (const c of everybody()) c.anim.phase = 0;
      L.flash0 = G.tune.flashIntensity;
      return L.roster();
    },
    roster() {
      const G = g(), cast = G.ch.cast;
      const pop = (x) => { let n = 0; x >>>= 0; while (x) { n += x & 1; x >>>= 1; } return n; };
      const side = (sd) => cast.variants.filter(v => v.side === sd);
      const worn = (c, r) => { if (!cast || !c.parts) return null;   // (game/cast.ts's rule, re-stated: the page does not expose who wears what — checked against the part mask he is drawn with)
        const ops = side('operator'), pick = (l, skip = 0) => l.length > skip ? l[skip + c.id % (l.length - skip)] : l[c.id % l.length];
        const v = !r ? ops[0] : r.team === 'operative' ? pick(ops, 1) : r.team === 'civilian' ? pick(side('civilian').length ? side('civilian') : side('defender')) : pick(side(r.trained && r.team === 'guard' && side('responder').length ? 'responder' : 'defender'));
        const d = pop(v.mask ^ c.parts); return d === 0 ? v.name : d <= 2 ? v.name + ' (goggles as the game has them)' : v.name + ' EXPECTED, mask differs by ' + d + ' parts'; };
      const row = (name, r, c, team) => ({ name, team, id: c.id, variant: worn(c, r), parts: c.parts ?? null, trained: !!(r && r.trained), unit: !!(r && r.unit), state: r ? r.state : 'player',
        pos: c.pos.map(v => +v.toFixed(2)), yaw: +c.bodyYaw.toFixed(2), tint: c.tint.map(v => +v.toFixed(3)), tint2: c.tint2.map(v => +v.toFixed(3)), torch: r ? !!r.flashlight?.enabled : !!G.player.light?.enabled });
      return [row('Sam', null, G.player.char, 'player'), ...G.guards.map(x => row(x.callsign, x, x.char, x.team)), ...G.civilians.map(x => row(x.civ?.name ?? x.callsign, x, x.char, x.team))];
    },
    // light: 'lit' = the lobby's ceiling panels on and every hand torch dark (the outfit under one known light); 'night' = the level as authored, torches as the game rules them
    light(mode) { const G = g(); G.setGroup('lobby', mode === 'lit'); G.tune.flashIntensity = mode === 'lit' ? 0 : L.flash0; return mode; },
    // men = [{ who, pos:[x,z], yaw }] (who: 'Sam', a callsign, a civilian's name). Everybody else is parked off the level and — the eight-figure shadow-proxy
    // budget goes down the guard list in order — put LAST in the list, so the men in frame are the ones that cast shadows.
    stage(pin, men, parkSam = [-30, 0, -40]) {
      const G = g(); const listed = men.filter(m => m.who !== 'Sam').map(m => { const r = rec(m.who); if (!r) throw new Error('no man called ' + m.who); return { r, m }; });
      const first = listed.filter(x => G.guards.includes(x.r)).map(x => x.r);
      const rest = G.guards.filter(x => !first.includes(x)); G.guards.length = 0; G.guards.push(...first, ...rest);
      const sam = men.find(m => m.who === 'Sam');
      const res = window.__stage(pin, { park: true, guards: listed.filter(x => G.guards.includes(x.r)).map(x => ({ i: G.guards.indexOf(x.r), pos: [x.m.pos[0], 0, x.m.pos[1]], yaw: x.m.yaw, aimPitch: 0 })),
        player: sam ? { pos: [sam.pos[0], 0, sam.pos[1]], yaw: sam.yaw, crouch: false } : { pos: parkSam, crouch: false } });
      for (const gd of G.guards) { if (gd.script) gd.script = null; gd.char.vel = [0, 0, 0]; gd.char.aimYaw = gd.char.bodyYaw; if (gd.char.anim) gd.char.anim.crouchTarget = 0; }
      L.civs = []; G.civilians.forEach((cv, k) => { const x = listed.find(q => q.r === cv); const s = x ? { cv, pos: [x.m.pos[0], 0, x.m.pos[1]], yaw: x.m.yaw } : { cv, pos: [-40 - 3 * k, 0, -46], yaw: 0 }; L.civs.push(s);
        // a civilian's own loop (civilians.ts work) walks her round her marks and plays the task there: her round becomes ONE mark, here, task 'stand', facing our way, for ever
        const C = cv.civ; C.def = Object.assign({}, C.def, { points: [s.pos.slice()], wait: [1e6], tasks: ['stand'], face: [s.yaw] }); cv.route = Object.assign({}, cv.route, { points: [s.pos.slice()], wait: [1e6] });
        cv.wp = 0; cv.wait = 1e6; cv.path = []; cv.pathGoal = null; C.state = 'work'; C.seated = false; C.settleT = -1; C.riseT = 0; C.taskT = 0; cv.char.anim.act = null; cv.char.anim.crouchTarget = 0; cv.lookPhase = 0; });
      L.sam = sam ? { pos: [sam.pos[0], 0, sam.pos[1]], yaw: sam.yaw } : null;
      L.men = listed.filter(x => G.guards.includes(x.r)).map(x => ({ gd: x.r, pos: [x.m.pos[0], 0, x.m.pos[1]], yaw: x.m.yaw }));
      const fix = (c, yaw) => { for (const k of ['bodyYaw', 'aimYaw']) Object.defineProperty(c, k, { configurable: true, enumerable: true, get: () => yaw, set: () => {} }); };
      for (const s of L.men) fix(s.gd.char, s.yaw); for (const s of L.civs) fix(s.cv.char, s.yaw); if (L.sam) fix(G.player.char, L.sam.yaw);
      L.hold(); return res;
    },
    // the civilians have no hold flag the page can set from __stage: put back on their marks after every step (their own loop may walk them off)
    hold() { const G = g(); for (const s of L.civs || []) { const c = s.cv.char; c.pos = [s.pos[0], 0, s.pos[2]]; c.vel = [0, 0, 0]; c.bodyYaw = s.yaw; c.aimYaw = s.yaw; }
      for (const s of L.men || []) { const c = s.gd.char; c.pos[0] = s.pos[0]; c.pos[2] = s.pos[2]; c.bodyYaw = s.yaw; c.aimYaw = s.yaw; c.aimPitch = 0; }
      if (L.sam) { const c = G.player.char; c.bodyYaw = L.sam.yaw; c.aimYaw = L.sam.yaw; } },
    // simulate `secs` with the renderer stubbed (poses settle: a teleported man blends to his idle)
    play(secs) { const e = window.__engine, real = e.render; let threw = null; e.render = () => {};
      try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); L.hold(); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
      return threw; },
    // draw n frames one at a time (each waited for; dt tiny so nobody moves), read the last back
    async draw(n) {
      const dev = window.__engine.device, ms = [];
      for (let i = 0; i < n; i++) { const t = performance.now(); window.__runFrames(1, 1 / 600); L.hold(); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); ms.push(Math.round(performance.now() - t)); console.log(`LOOK frame ${i + 1}/${n} ${ms[i]} ms`); }
      window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      let sum = 0, nz = 0; for (let i = 0; i < fr.data.length; i += 4) { const l = fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; sum += l; if (l > 12) nz++; fr.data[i + 3] = 255; }
      let h = 2166136261; for (let i = 0; i < fr.data.length; i++) { h ^= fr.data[i]; h = Math.imul(h, 16777619); }
      const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
      // where each staged man lands on screen (head and feet through the camera's own matrix): the crop box for the x3 tile
      const vp = window.__cam.viewProj, pr = (p) => { const x = p[0], y = p[1], z = p[2]; const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; return [(0.5 + 0.5 * (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * fr.w, (0.5 - 0.5 * (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * fr.h]; };
      const boxes = L.roster().filter(r => r.pos[0] > -20).map(r => { const a = pr([r.pos[0], 0, r.pos[2]]), b = pr([r.pos[0], 1.9, r.pos[2]]); return { name: r.name, feet: a.map(Math.round), head: b.map(Math.round), px: Math.round(Math.hypot(a[0] - b[0], a[1] - b[1])) }; });
      return { w: fr.w, h: fr.h, internal: [window.__engine.width, window.__engine.height], mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), litPct: +(100 * nz / (fr.w * fr.h)).toFixed(1), fnv: (h >>> 0).toString(16), frameMs: ms, boxes, url: c2.toDataURL('image/png') };
    },
  };
  window.__look = L;
})();
