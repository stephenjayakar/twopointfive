// Impulses lane A/B against main (docs/internal/destruction.md 'Impulses'): the SAME staged sheet scene on this build and on main served beside it —
// (1) __png captures of 240 seeded leaves in flight and settled (no impulse anywhere: the flight equations' ×air = ×1.0 and the aux repack must leave
// every pixel as main draws it), (2) the particles pass over 40 serialized idle frames with 2000 settled sheets (the kernel's per-frame cost without
// impulses = main's). Plain JS; on a `?paused&quality=high&mute` boot of either build:  await import('/qa/kick-ab.js'); await __kab.run('branch'|'main')
(() => {
  const E = () => window.__engine;
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const settle = async () => { await E().device.queue.onSubmittedWorkDone(); await yieldTask(); await yieldTask(); };
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SHEET = { shape: 'burst', spread: 0.3, lift: 0.35, speed: 2.6, speedJit: 0.7, life: 120, lifeJit: 0.1, size: 0.21, sizeJit: 0.15, aspect: 1.41, tumble: 6, nrmJit: 0.5, posJit: 0.3, color: [0.86, 0.86, 0.82] };
  async function stage() {
    window.__testVisible = true; window.__menu?.close(); Math.random = mulberry32(4242);
    const g = window.__game; g.godMode = true;
    for (const c of [g.player.char, ...g.guards.map(x => x.char)]) if (c.anim) c.anim.phase = 0;
    window.__stage({ look: [17.9, 0.3, 18.6], yaw: 0.44, pitch: 0.95, dist: 5.2 }, { park: true, player: { pos: [14.5, 0, 22.5], yaw: 1.57, holstered: true, invisible: true } });
    window.__particles.clear(); window.__runFrames(4);
  }
  const S = {
    /** the identity captures: 240 leaves thrown up off the aisle floor, __png at +20 (in flight), +60 (landing) and +200 (asleep) frames → docs/shots/ab/kickab_<tag>_f*.png */
    async identity(tag) {
      await stage();
      window.__particles.emit('sheet', [17.9, 0.5, 18.6], [0, 1, 0], 240, SHEET);
      const out = []; let at = 0;
      for (const f of [20, 60, 200]) { window.__runFrames(f - at); at = f; await settle(); out.push(await window.__png(`kickab_${tag}_f${String(f).padStart(3, '0')}`)); }
      return out;
    },
    /** the idle cost: 2000 sheets settled about the same point, then 40 serialized frames' particles-pass ms (mean / median) + union */
    async idle(tag, n = 2000) {
      await stage();
      const P = window.__particles; const per = Math.ceil(n / 50);
      for (let k = 0; k < 50; k++) { const a = k * 2.399, r = 0.4 + 3.0 * Math.sqrt((k + 0.5) / 50); P.emit('sheet', [17.9 + Math.cos(a) * r, 0.4, 18.6 + Math.sin(a) * r], [0, 1, 0], per, { ...SHEET, speed: 1.5, posJit: 0.35 }); }
      window.__runFrames(200);
      const t = E().timer; const xs = [], us = [];
      for (let i = 0; i < 40; i++) { const before = t.resolved; window.__runFrames(1); await settle(); for (let k = 0; k < 50 && t.resolved === before; k++) await new Promise(r => setTimeout(r, 1)); if (t.resolved === before) continue; xs.push(t.lastFrame.get('particles') ?? 0); us.push(t.unionMs ? t.unionMs() : 0); }
      const mean = a => +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(4); const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
      return { tag, frames: xs.length, particlesMean: mean(xs), particlesMed: med(xs), particlesMax: Math.max(...xs), unionMean: mean(us), live: P.sys.liveSlots, res: [E().width, E().height] };
    },
    async run(tag) { const id = await S.identity(tag); const idle = await S.idle(tag); return { id, idle }; },
  };
  window.__kab = S;
  return 'kick A/B ready: await __kab.run(tag)';
})();
