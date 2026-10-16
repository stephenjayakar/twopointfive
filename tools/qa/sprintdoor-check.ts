// A SPRINT INTO A DOOR HAS WEIGHT — the check behind src/game/sprintdoor.ts (SPRINTDOOR.on: on in the page, ?nosprintdoor; off on the frozen stand, TPS_SPRINTDOOR=1).
//   bun run tools/qa/sprintdoor-check.ts        (also `probes.ts sprintdoor`; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
// Headless; nothing here looks at a picture. The office with nobody in it, the one-way doors and the frame rule as the page has them, the switch thrown by hand;
// every run is the real player under real keys (W + Shift held from 3 m off, the camera turned so W runs him square at the leaf) on two doors with that much
// floor before both faces. Each rule line is run with the switch on AND off and passes only when the rule shows on and the old behaviour shows off:
//   (1) the face it opens AWAY from, unlocked: a shoulder through it — the loud bash, the leaf leaving him at `bashVel` (it leads him), he keeps `keep` of his speed (0.75) and
//       has the sprint back inside half a second, through no more than a tenth of a second later than before (off: not a centimetre a second lost);
//   (2) the face it opens TOWARD, unlocked and shut in its frame: a boot at the run — he plants short of the leaf (never touching it: no bash, no thud), the
//       leaf comes off its hinges away from him with the kicked door's own noise, he is through the open frame with the keys still held about a second later
//       than before (off: full speed through a leaf hauled round on the full bash);
//   (2b) where a boot is not the thing (`kick: false`, or doors that never come off): the handle — checked to about a walk, the leaf brought round toward him
//       at the lower loudness (the game's own event for it is not `loud`), sprinting again and through about a third of a second later than before;
//   (2c) the boot's edges: none at a leaf standing ajar, none with the frame rule off, none from a run begun on top of the door; one from a stride off;
//   (2d) booted out of a room onto a corridor (no room beyond for the leaf to lie in): off its hinges all the same, the slab back down through its doorway;
//   (3) locked against him: the kick from the face it opens away from, a wall and nothing broken from the other — the same in both arms;
//   (4) a glancing shoulder costs less than a square one, and so does a leaf met standing ajar (the module's own rule, asked directly: 60° off square costs half);
//   (5) his body turns a shoulder into the leaf for a quarter second and comes back square, his head staying on the run; it is the shoulder nearer the LATCH
//       that leads — asked on a door and on the same door hung the other way, where the turn must come out the other way round;
//   (6) the stamps ride a checkpoint taken mid-rip;
//   (7) never on a puppet or under a show: his contact carries nothing;
//   (8) off: he goes through both faces on the full bash, no contact carries the rule, neither stamp is ever written, the sprint eases his gun down as ever.
//       A SANITY LINE: 'off = the build as it was' is the frame-for-frame comparison with the build head named in docs/agents/doors.md, and the gate's digests.
// SPRINTDOOR_BREAK=1 = the switch left OFF for the 'on' arms: (1), (2), (2b), (2c), (2d) and (5) must fail.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

export async function sprintdoorCheck(): Promise<boolean> {
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { DOORBLAST, DOORBLAST_STATS } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { SPRINTDOOR, SPRINTDOOR_STATS, sprintDoorRun, sprintDoorAfter } = await import(`${ROOT}/src/game/sprintdoor.ts`);
  const DT = 1 / 60, BREAK = process.env.SPRINTDOOR_BREAK === '1'; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  console.log('\n=== sprintdoor: a sprint into a door has weight ===');
  const was = { door: { ...DOORWAY }, sd: { ...SPRINTDOOR }, blast: DOORBLAST.on, random: Math.random };
  try {
    DOORWAY.oneWay = true; DOORWAY.frameHolds = true; DOORBLAST.on = true;
    Math.random = seeded(7); const W: any = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game, pl = g.player, c = pl.char;
    g.godMode = true; g.playerInvisible = true; g.tune.civilians = false; g.guards.length = 0;
    const SPR = g.tune.playerSprint as number;
    const off = (d: any, f: number, o: number, along = d.def.width * 0.55): [number, number, number] => { const a = d.def.closedDir, ux = Math.cos(a), uz = Math.sin(a); return [d.def.hinge[0] + ux * along - uz * o * f, 0, d.def.hinge[1] + uz * along + ux * o * f]; };
    const pullSide = (d: any): 1 | -1 => g.doors.pullFace(d, off(d, 1, 0.8)) ? 1 : -1;
    const fresh = (d: any, lock = false) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.locked = lock; d.sinceBash = 10; d.place(); };
    const door = (name: string) => g.doors.list.find((x: any) => x.def.name === name);
    const DOORS = ['server_manager', 'fire_exit'];   // (3 m of clear floor before both faces, and no rolling chair near enough for one run to leave it in the next one's doorway: the break room's west door has one)
    interface Run { before: number; slow: number; back: number; cross: number; heard: { sound: string; level: number }[]; kick: boolean; angle: number; broken: boolean; bashes: number; rips: number; kicks: number; off: boolean; kickEv: boolean; reel: number; slabOut: number; fellBack: boolean; wide: number; leafVel: number; headMax: number; headRun: number; pitch: number; look: number; loud: (boolean | undefined)[]; seen?: Set<any>; leanMax: number; leanEnd: number; latchLed: number; ripU: number; bashAt: number }
    /** one run at door `name` from face `face` (±1 × the face it opens toward) with the switch `on` */
    const run = (name: string, toward: boolean, lock: boolean, on: boolean, flip = false, opt: { from?: number; ajar?: number } = {}): Run => {
      SPRINTDOOR.on = on && !BREAK; SPRINTDOOR_STATS.bashes = SPRINTDOOR_STATS.rips = SPRINTDOOR_STATS.kicks = 0;
      const d = door(name); if (flip) d.setSwing(-d.swing as 1 | -1);   // (hung the other way for this run: its push face is the other one, and so is the side of his run the latch is on)
      const face = pullSide(d) * (toward ? 1 : -1);
      for (const x of g.doors.list) fresh(x, !!x.def.locked); fresh(d, lock); if (lock) d.keySide = face;
      if (opt.ajar) { d.angle = opt.ajar * d.swing; d.latched = false; d.place(); }   // (met standing ajar, off its frame)
      const back0 = DOORBLAST_STATS.back;
      for (let i = 0; i < 90 && (pl.kick || c.anim.kicking); i++) W.step(DT);
      pl.doorBashAt = -10; pl.doorRipUntil = -1; pl.doorBashLean = 0;
      g.teleportPlayer(off(d, face, opt.from ?? 3)); pl.crouch = false; for (let i = 0; i < 5; i++) W.step(DT);
      const a = d.def.closedDir, ux = Math.cos(a), uz = Math.sin(a), dirIn = [uz * face, -ux * face];
      const out = () => (-(c.pos[0] - d.def.hinge[0]) * uz + (c.pos[2] - d.def.hinge[1]) * ux) * face;
      let yaw = 0, best = -2; for (let i = 0; i < 720; i++) { W.cam.yaw = i * Math.PI / 360; W.cam.rebuild(); const f = W.cam.planarBasis().fwd, dot = f[0] * dirIn[0] + f[2] * dirIn[1]; if (dot > best) { best = dot; yaw = W.cam.yaw; } }
      const heard: Run['heard'] = []; const emit0 = g.doors.emit; g.doors.emit = (e: any) => { if (e.door === d) heard.push({ sound: e.sound, level: e.level }); emit0.call(g.doors, e); };
      W.input.keys.add('KeyW'); W.input.keys.add('ShiftLeft');
      const R: Run = { before: 0, slow: 99, back: -1, cross: -1, heard, kick: false, angle: 0, wide: 0, leafVel: 0, headMax: 0, headRun: 0, pitch: 0, look: 0, loud: [], broken: false, bashes: 0, rips: 0, kicks: 0, off: false, kickEv: false, reel: 0, slabOut: 0, fellBack: false, leanMax: 0, leanEnd: 0, latchLed: 0, ripU: -1, bashAt: -10 };
      let last = [c.pos[0], c.pos[2]], hit = -1, lastO = out(); const runYaw = Math.atan2(dirIn[0], dirIn[1]);
      const wrap = (x: number) => x - Math.round(x / (2 * Math.PI)) * 2 * Math.PI;
      for (let i = 0; i < 170; i++) {
        W.cam.yaw = yaw; W.cam.rebuild(); W.step(DT);
        const v = ((c.pos[0] - last[0]) * dirIn[0] + (c.pos[2] - last[1]) * dirIn[1]) / DT; last = [c.pos[0], c.pos[2]]; const o = out(); R.kick ||= !!pl.kick; if (pl.kick) R.reel = Math.max(R.reel, o - lastO); lastO = o;   // (reel: the furthest one frame of a kick carried him back off the leaf)
        if (o > 0.6 && hit < 0) R.before = v;
        if (hit < 0 && (heard.length || pl.kick || (o < 0.6 && v < R.before - 0.5))) hit = i;
        if (hit >= 0 && i - hit < 40) R.slow = Math.min(R.slow, v);
        if (hit >= 0 && R.back < 0 && i > hit + 1 && v >= 0.95 * SPR - 0.1 && pl.sprinting) R.back = (i - hit) * DT;
        if (R.cross < 0 && o < -0.5) R.cross = i * DT;
        for (const e of g.events) if (e.kind === 'kick' && e.who === 1) R.kickEv = true;
        for (const e of g.events) if (e.kind === 'door' && e.who === 1 && e.level >= 0.5 && !R.seen?.has(e)) { (R.seen ??= new Set()).add(e); R.loud.push(e.loud); }
        R.wide = Math.max(R.wide, d.angle * d.swing);
        if (hit >= 0 && i === hit) R.leafVel = d.vel * d.swing;
        if (hit >= 0 && i - hit > 1 && i - hit < 30) { const h = c.headDir(); R.headMax = Math.max(R.headMax, Math.abs(wrap(Math.atan2(h[0], h[2]) - runYaw))); }
        if (hit < 0 && o < 1.2) { const h = c.headDir(); R.headRun = Math.max(R.headRun, Math.abs(wrap(Math.atan2(h[0], h[2]) - runYaw))); }   // (how far the run's own bob takes his head off the line, before any door)
        if (hit >= 0 && i - hit <= 2) { R.ripU = Math.max(R.ripU, pl.doorRipUntil - g.time); R.bashAt = Math.max(R.bashAt, pl.doorBashAt); }
        if (hit >= 0 && i - hit < 30) { const lean = wrap(c.bodyYaw - runYaw); if (Math.abs(lean) > Math.abs(R.leanMax)) { R.leanMax = lean;
          // a turn of +δ swings his front toward e = (cos yaw, −sin yaw): the shoulder on e's side falls back and the other one leads
          const latch = [d.def.hinge[0] + ux * d.def.width, d.def.hinge[1] + uz * d.def.width], side = Math.sign((latch[0] - c.pos[0]) * Math.cos(runYaw) - (latch[1] - c.pos[2]) * Math.sin(runYaw));
          R.latchLed = Math.sign(lean) === -side ? 1 : -1; } }   // +1: the shoulder on the latch's side of his run is the one ahead
        if (hit >= 0 && i - hit === 45) R.leanEnd = wrap(c.bodyYaw - runYaw);
      }
      R.pitch = c.aimPitch;
      W.input.keys.delete('KeyW'); W.input.keys.delete('ShiftLeft'); g.doors.emit = emit0;
      for (let i = 0; i < 100; i++) W.step(DT);
      R.look = c.anim.lookYawExtra; R.off = !!d.off; R.fellBack = DOORBLAST_STATS.back > back0;
      if (d.slab) R.slabOut = (-(d.slab.p[0] - d.def.hinge[0]) * uz + (d.slab.p[2] - d.def.hinge[1]) * ux) * face;   // (where the slab lies: metres on HIS side of the frame — negative is beyond it)
      if (flip) { fresh(d); d.setSwing(-d.swing as 1 | -1); }
      R.angle = d.angle * d.swing; R.broken = !!d.lockBroken; R.bashes = SPRINTDOOR_STATS.bashes; R.rips = SPRINTDOOR_STATS.rips; R.kicks = SPRINTDOOR_STATS.kicks;
      return R;
    };
    const says = (r: Run) => `before ${f2(r.before)} m/s, slowest ${f2(r.slow)} (${f2(r.slow / r.before)}), sprinting again after ${r.back < 0 ? 'never' : f2(r.back) + ' s'}, through at ${r.cross < 0 ? 'never' : f2(r.cross) + ' s'}, heard ${r.heard.map(h => `${h.sound}@${f2(h.level)}`).join(',') || 'nothing'}, leaf at ${f2(r.leafVel)} rad/s on the frame he met it, ${f2(r.wide)} rad open at its widest`;
    const bashAt = (r: Run, lv: number) => r.heard.some(h => h.sound === 'bash' && Math.abs(h.level - lv) < 1e-6);

    // (1) the face it opens away from
    for (const name of DOORS) { const A = run(name, false, false, true), B = run(name, false, false, false); const k = A.slow / A.before;
      line(bashAt(A, 1) && A.bashes === 1 && A.rips === 0 && k > SPRINTDOOR.keep - 0.06 && k < SPRINTDOOR.keep + 0.06 && A.back > 0 && A.back <= 0.5 && A.cross > 0 && A.cross - B.cross <= 0.1 && A.cross >= B.cross && A.wide > 1.2 && !A.kick && A.leafVel > SPRINTDOOR.bashVel - 0.5 && A.leafVel * 0.55 > SPR * 0.8
        && bashAt(B, 1) && B.slow / B.before > 0.98 && B.bashes === 0 && B.cross > 0 && B.wide > 1.2,
        `(1) ${name}, opens away: a shoulder through it keeps ${f2(SPRINTDOOR.keep)} of the run and has it back inside half a second (off: nothing lost)`, `on: ${says(A)}\n    off: ${says(B)}`); }
    // (2) the face it opens toward: the boot at the run
    for (const name of DOORS) { const A = run(name, true, false, true), B = run(name, true, false, false); const late = A.cross - B.cross;
      line(A.kick && A.kicks === 1 && A.rips + A.bashes === 0 && A.off && A.kickEv && A.heard.some(h => h.sound === 'kick' && h.level === 1) && !A.heard.some(h => h.sound === 'thud' || h.sound === 'bash') && A.slow < 0.1 && A.reel < 0.01 && A.back > 0 && A.back <= 1.35 && A.cross > 0 && late >= 0.6 && late <= 0.95
        && !B.kick && !B.off && B.loud[0] === true && bashAt(B, 1) && B.slow / B.before > 0.98 && B.rips + B.kicks === 0 && B.cross > 0,
        `(2) ${name}, opens toward him: a boot at the run — planted short of the leaf, the leaf off its hinges away from him with a kicked door's noise, through the open frame with the keys still held (off: full speed, the leaf hauled round on the full bash)`, `on: ${says(A)}, off its hinges ${A.off}, never carried back off the leaf ${A.reel < 0.01}, the slab at rest ${f2(-A.slabOut)} m beyond the frame${A.fellBack ? ' (no room beyond: it fell back through its doorway)' : ''}, ${f2(late)} s later than off\n    off: ${says(B)}, counted loud ${B.loud[0]}`); }
    // (2b) where a boot is not the thing: the handle
    for (const name of DOORS) { SPRINTDOOR.kick = false; const A = run(name, true, false, true); SPRINTDOOR.kick = true; DOORBLAST.on = false; const N = run(name, true, false, true); DOORBLAST.on = true; const B = run(name, true, false, false); const cap = SPR * SPRINTDOOR.ripPace;
      line(!bashAt(A, 1) && bashAt(A, SPRINTDOOR.ripLevel) && A.rips === 1 && A.bashes + A.kicks === 0 && A.slow <= cap + 0.1 && A.slow > 0.8 && A.back > 0 && A.back <= 1.0 && A.cross > 0 && A.cross - B.cross >= 0.15 && A.cross - B.cross <= 0.6 && A.wide > 1.2 && !A.kick && !A.off && Math.abs(A.leafVel - SPRINTDOOR.ripVel) < 0.5 && !A.heard.some(h => h.sound === 'kick' || h.sound === 'thud') && A.loud.length >= 1 && A.loud[0] === false
        && N.rips === 1 && N.kicks === 0 && !N.kick && !N.off && N.cross > 0 && !N.heard.some(h => h.sound === 'kick' || h.sound === 'thud'),
        `(2b) ${name}, opens toward him, no boot (kick: false; and again with doors that never come off): checked to about a walk, the leaf ripped round by the handle (no boot, no full bash, not a loud noise to the men), sprinting again with the keys still held`, `kick false: ${says(A)}, counted loud ${A.loud[0]}\n    doors never come off: ${says(N)}\n    off: ${says(B)}`); }
    // (2c) the edges of the boot: a leaf ajar, the frame rule off, a run begun on top of the door, a run begun a stride off it
    { const name = 'server_manager'; const J = run(name, true, false, true, false, { ajar: 0.5 }); DOORWAY.frameHolds = false; const F = run(name, true, false, true); DOORWAY.frameHolds = true;
      const N = run(name, true, false, true, false, { from: 0.75 }), M = run(name, true, false, true, false, { from: 1.0 });
      line(!J.kick && !J.off && J.kicks === 0 && J.cross > 0 && !F.kick && !F.off && F.rips === 1 && F.cross > 0 && !N.kick && !N.off && N.kicks === 0 && N.cross > 0 && M.kick && M.off && M.kicks === 1 && M.reel <= 0.07 && M.cross > 0,
        '(2c) no boot at a leaf standing ajar, none with the frame rule off (the handle), none from a run begun on top of the door (he would be reeled back to throw it); a run begun a stride off is still a boot, carried back no more than a hand',
        `ajar: kick ${J.kick}, off ${J.off}, through ${J.cross > 0} · frame rule off: kick ${F.kick}, rips ${F.rips} · from 0.75 m: kick ${N.kick}, rips ${N.rips}, through ${N.cross > 0} · from 1 m: kick ${M.kick}, off ${M.off}, carried back ${f2(M.reel)} m`); }
    // (2d) a door with no room beyond its frame for the leaf to lie in (a room's door onto a corridor): doorblast's own rule — to the far wall and back down through its doorway
    { const A = run('manager', true, false, true);
      line(A.kick && A.off && A.kicks === 1 && A.fellBack && A.cross > 0 && -A.slabOut > 0 && -A.slabOut < 2.2,
        '(2d) booted out of a room onto a corridor: the leaf still comes off and he is through; with no room beyond to lie in it goes to the far wall and comes back down through its own doorway (it touches nobody: doorblast.ts)',
        `manager: kick ${A.kick}, off its hinges ${A.off}, fell back ${A.fellBack}, the slab at rest ${f2(-A.slabOut)} m beyond the frame, through ${A.cross > 0}`); }
    // (3) locked against him: as ever, in both arms
    { const name = 'server_manager'; const A = run(name, false, true, true), B = run(name, false, true, false), C = run(name, true, true, true), D = run(name, true, true, false);
      line(A.kick && A.broken && !A.off && B.kick && B.broken && A.bashes + A.rips + A.kicks === 0 && !C.kick && !C.broken && !C.off && C.cross < 0 && !D.kick && !D.broken && D.cross < 0 && C.bashes + C.rips + C.kicks === 0 && Math.abs(C.angle) < 0.01,
        '(3) locked against him: the kick from the face it opens away from, a wall and nothing broken from the face it opens toward — the same in both arms',
        `away — on: kick ${A.kick}, keep broken ${A.broken} · off: kick ${B.kick}, keep broken ${B.broken}\n    toward — on: kick ${C.kick}, through ${C.cross >= 0}, heard ${C.heard.map(h => h.sound).join(',') || 'nothing'} · off: kick ${D.kick}, through ${D.cross >= 0}`); }
    // (4) a glancing shoulder: the module's own rule, asked directly
    { SPRINTDOOR.on = true; const d = door('server_manager'); fresh(d); const a = d.def.closedDir, nx = -Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = Math.sin(a);
      const ask = (deg: number, ajar = 0) => { const r = deg * Math.PI / 180, vx = (nx * Math.cos(r) + tx * Math.sin(r)) * 4, vz = (nz * Math.cos(r) + tz * Math.sin(r)) * 4; pl.speedSm = 4; c.vel = [vx, 0, vz]; pl.sprinting = true;
        const own: any = { pos: c.pos, radius: 0.34, bash: true, who: 0, quiet: false, run: sprintDoorRun(g, pl), bashed: d, bashedAt: ajar, ripped: null }; pl.doorBashAt = -10; sprintDoorAfter(g, pl, own); return pl.speedSm / 4; };
      const sq = ask(0), gl = ask(60), aj = ask(0, 0.76 * d.swing), twice = (() => { pl.speedSm = 4; c.vel = [nx * 4, 0, nz * 4]; pl.sprinting = true; pl.doorBashAt = -10; const own: any = { pos: c.pos, radius: 0.34, bash: true, who: 0, quiet: false, run: sprintDoorRun(g, pl), bashed: d, bashedAt: 0, ripped: null }; sprintDoorAfter(g, pl, own); sprintDoorAfter(g, pl, own); return pl.speedSm / 4; })(); pl.sprinting = false; pl.speedSm = 0; c.vel = [0, 0, 0]; pl.doorBashAt = -10;
      line(Math.abs(sq - SPRINTDOOR.keep) < 1e-6 && Math.abs(gl - (1 - (1 - SPRINTDOOR.keep) * 0.5)) < 1e-6 && aj > sq + 0.04 && aj < 1 && Math.abs(twice - SPRINTDOOR.keep) < 1e-6, '(4) a glancing shoulder costs less: 60° off square costs half of what square on does; a leaf met standing ajar costs less than one met shut; a second leaf in the same breath costs nothing more', `kept square on ${f2(sq)} · at 60° ${f2(gl)} · square to the frame at a leaf 0.76 rad ajar ${f2(aj)} · two leaves in one frame ${f2(twice)}`); }
    // (5) the shoulder turned in
    { const A = run('server_manager', false, false, true), B = run('server_manager', false, false, false), M = run('server_manager', false, false, true, true);
      line(Math.abs(A.leanMax) > 0.15 && Math.abs(A.leanMax) <= SPRINTDOOR.lean + 0.02 && Math.abs(A.leanEnd) < 0.03 && Math.abs(B.leanMax) < 0.03 && A.latchLed === 1 && M.latchLed === 1 && Math.abs(M.leanMax) > 0.15 && Math.sign(M.leanMax) === -Math.sign(A.leanMax) && A.headMax < A.headRun + 0.1 && M.headMax < M.headRun + 0.1 && Math.abs(A.look) < 1e-9 && M.bashes === 1,
        '(5) his body turns the shoulder nearer the latch into the leaf, his head stays on the run, and he is square again three quarters of a second on; the same door hung the other way turns him the other way (off: he never turns)', `on: turned ${f2(A.leanMax)} rad at most, ${f2(A.leanEnd)} at the end, head off the run by ${f2(A.headMax)} rad at most (the run's own bob: ${f2(A.headRun)}), its look given back ${Math.abs(A.look) < 1e-9}, the latch-side shoulder led: ${A.latchLed === 1} · hung the other way: turned ${f2(M.leanMax)}, the latch-side shoulder led: ${M.latchLed === 1} · off: ${f2(B.leanMax)} rad`); }
    // (6) the stamps ride a checkpoint (a second game with its roster whole: a checkpoint is refused on a stage somebody emptied)
    { Math.random = seeded(7); const V: any = await quiet(() => standUp({ uploadEvery: 4 })); const h = V.game, q = h.player; for (let i = 0; i < 5; i++) V.step(DT);
      q.doorRipUntil = h.time + 0.2; q.doorBashAt = h.time - 0.1; q.doorBashLean = -1; const S = V.snapshot('mid-rip', true); const want = { u: q.doorRipUntil, at: q.doorBashAt };
      q.doorRipUntil = -1; q.doorBashAt = -10; q.doorBashLean = 0; V.restore(S); const p2 = V.game.player;
      const kept = Math.abs(p2.doorRipUntil - want.u) < 1e-9 && Math.abs(p2.doorBashAt - want.at) < 1e-9 && p2.doorBashLean === -1;
      for (let i = 0; i < 90; i++) V.step(DT); const S2 = JSON.stringify(V.snapshot('after', true));
      line(kept && !/ripU|bashAt/.test(S2), '(6) a checkpoint taken while a door is in his hands puts the stamps back; one taken after carries none', `restored ${kept} · a later file names them: ${/ripU|bashAt/.test(S2)}`); }
    // (7) never on a puppet or under a show   (8) off: nothing carried, nothing written
    { SPRINTDOOR.on = true; pl.sprinting = true; const free = !!sprintDoorRun(g, pl); const pup = g.puppet; g.puppet = { walk: 1 }; const strung = !!sprintDoorRun(g, pl); g.puppet = pup; const t = g.touring; g.touring = true; const show = !!sprintDoorRun(g, pl); g.touring = t;
      SPRINTDOOR.on = false; const offRun = !!sprintDoorRun(g, pl); pl.sprinting = false;
      line(free && !strung && !show, '(7) a puppet on strings or a show on the stage: his contact carries nothing', `free ${free} · puppet ${strung} · show ${show}`);
      const B = run('server_manager', false, false, false), C = run('server_manager', true, false, false);
      line(!offRun && bashAt(B, 1) && bashAt(C, 1) && B.cross > 0 && C.cross > 0 && Math.abs(B.pitch + 0.3) < 0.01 && Math.abs(C.pitch + 0.3) < 0.01 && B.look === 0 && B.bashAt === -10 && B.ripU < 0 && C.bashAt === -10 && C.ripU < 0 && B.bashes + B.rips + C.bashes + C.rips + B.kicks + C.kicks === 0 && !C.kick && !C.off, '(8) the switch off: he runs through both faces on the full bash, no contact carries the rule, neither stamp is written, and the sprint has eased his gun down as ever', `carried ${offRun} · through ${B.cross > 0}/${C.cross > 0} · stamps after a run at each face: bash ${B.bashAt}/${C.bashAt}, rip ${f2(B.ripU)}/${f2(C.ripU)} · aim pitch at the end of each run ${f2(B.pitch)}/${f2(C.pitch)}`); }
  } catch (e) { line(false, 'the check threw', e instanceof Error ? e.stack ?? e.message : String(e)); }
  finally { Object.assign(DOORWAY, was.door); Object.assign(SPRINTDOOR, was.sd); DOORBLAST.on = was.blast; Math.random = was.random; }
  console.log(`=== sprintdoor: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await sprintdoorCheck()) ? 0 : 1);
