// A WALL TAKEN WITHOUT THE KEY — the check behind WALLSNAP.press (src/game/wallsnap.ts, player.ts wallPress / pressFace; on in the page, ?wallpress=0; off in the
// module and on the frozen stand, TPS_WALLPRESS=1; it acts only with the wall hold's feel pass, WALLSNAP.on, which these lines turn on).
//   bun run tools/qa/probes.ts wallpress        (families `wallsnap`, `wall-snap`)        WALLPRESS_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-20: "when you like push against the wall, you snap to it … I do want it to feel really great".
// WHAT IS ASKED, on the office corridor's north wall (the feel pass's own rig, wallsnap-probes.ts world) unless said:
//   walk up     a walk straight at the wall has it BEFORE he touches it (inside pressFlow), at the pace he was walking (no frame of the take outruns his walk by
//               half), and it ends as Q's hold ends: 0.45 m off the face, back to it, stance 'wall', nothing said
//   turn in     stood against the wall, the key turned into it takes it after pressSecs (the frame's grain either way)
//   not asked   a diagonal along the wall, a run at it, the key let go before pressFlow, a shut door's leaf: never a hold
//   any camera  24 yaws × 8 key combinations, stood against the wall: a hold if and only if the stick is within pressDeg of square into it
//   the hands   the rifle stacks in his hands; the pistol goes away and comes back on the step off; with an ENEMY alert the pistol does NOT go away (no hold),
//               the rifle and empty hands still take it, and a man of his own side alert changes nothing; inside pressAfterShot of a round of his own, with
//               a mouse button held, or with the pistol's magazine out, nothing takes it (and the reload is not thrown away)
//   let go      Q with the key still held into the wall: off, and not pulled back on while it stays held, a tap of Shift or not; the key up and down again
//               takes it; Shift steps him off and the key still held does not put him back; the stick held away lets go in a tenth of a second, takes
//               nothing for pressAgain, and kept held across the corridor has the FAR wall as he arrives; in a corner, Q off one wall and the stick turned
//               into the other takes the other
//   a thing     with the mains breaker on the wall he walks into, or a door a step along it, the wait is pressThing and none of it is counted on the walk up;
//               the same wall further along is taken on the walk up
//   off         the switch off: none of the above ever holds, and Q still does
//   recordings  a recording carries the key; one from before it replays with it off; the frozen stand holds it off by name
//   checkpoint  under SAVETIMELINE.holds (savestate.ts; ?saveholds=0, TPS_SAVEHOLDS=1) a save made on a wall loads ON the wall and what he does next is what he
//               did, the pistol the hold put away back in his hand off it; the take's latch rides the file too; a slice he could not be in is no hold; with
//               the saves' switch off a file says nothing of it and a load stands him free, as it was
// Headless: positions, clocks and the animator's stance are read; how the take LOOKS has never been seen.
import { ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
type V = [number, number, number];
const DT = 1 / 60, DEG = Math.PI / 180, WZ = 10.06, R = 0.42;
export async function wallPressCheck(): Promise<boolean> {
  const BRK = process.env.WALLPRESS_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== wallpress: a move key held into a wall takes it, no Q${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = { on: WALLSNAP.on, press: WALLSNAP.press }, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
  try {
    const S = await quiet(() => world(true, 95, false)); const { pl, c, g, W } = S as any; const set = (rule: boolean) => { WALLSNAP.on = true; WALLSNAP.press = rule && !BRK; }; set(true);
    const gap = () => c.pos[2] - WZ - R;   // what is left between his body and the north wall
    /** hold `ks` from (x 21, z, yaw) for `frames`: the frame a hold began, the gap then, the frame his back was on it, the longest stride of the take, what was said */
    const run = (z: number, yaw: number, ks: string[], kit: 'empty' | 'pistol' | 'rifle' = 'empty', frames = 120, each?: (f: number) => void) => {
      S.place(21, z, yaw, kit); g.messages.length = 0; S.keys(...ks); let took = -1, seated = -1, gapAt = NaN, stride = 0, walk = 0, prev = c.pos[2];
      for (let f = 0; f < frames; f++) { each?.(f); S.step(1); const st = Math.abs(c.pos[2] - prev); prev = c.pos[2]; if (pl.wall) { if (took < 0) { took = f; gapAt = gap() + st; } if (seated < 0) stride = Math.max(stride, st); if (seated < 0 && pl.wall.settle >= 1) seated = f; } else walk = Math.max(walk, st); }
      const said = g.messages.map((m: any) => m.text).filter((t: string) => /wall/.test(t)); return { took, seated, gapAt, stride, walk, said };
    };
    const rest = () => { S.keys(); S.step(20); };

    // ---- walk up
    { const r = run(11.5, 180, ['KeyW']); const w = pl.wall, off = gap() + R, yaw = w ? Math.abs(Math.atan2(Math.sin(c.bodyYaw - Math.atan2(w.n[0], w.n[2])), Math.cos(c.bodyYaw - Math.atan2(w.n[0], w.n[2])))) / DEG : NaN;
      const ok = r.took >= 0 && r.gapAt > 0.03 && r.gapAt <= WALLSNAP.pressFlow + 0.03 && r.seated >= 0 && (r.seated - r.took) * DT <= 0.3 * (WALLSNAP.slow ? WALLSNAP.slowTake : 1) && r.stride <= r.walk * 1.5 + 1e-4 && Math.abs(off - 0.45) <= 0.012 && yaw <= 3 && c.anim.stance === 'wall' && !r.said.length;
      verdict(ok, 'a walk straight at the wall has it before he touches it, at his walking pace, and ends as Q\'s hold does',
        `hold at ${r.took < 0 ? 'never' : f2(r.took * DT) + ' s'} with ${f2(r.gapAt)} m to go (pressFlow ${WALLSNAP.pressFlow}) · back on the wall ${r.seated < 0 ? 'never' : f2((r.seated - r.took) * DT) + ' s later'} · longest stride of the take ${f3(r.stride)} m against his walk's ${f3(r.walk)} · ${f3(off)} m off the face, back ${f2(yaw)}° off square, stance '${c.anim.stance}' · said: ${r.said.join(' | ') || 'nothing'}`); rest(); }
    // ---- turn in
    { const r = run(WZ + R + 0.03, 90, ['KeyW']); const t = r.took * DT;
      verdict(r.took >= 0 && t >= WALLSNAP.pressSecs - 2 * DT && t <= WALLSNAP.pressSecs + 2 * DT, 'stood against the wall, the key turned into it takes it after the wait', `hold after ${r.took < 0 ? 'never' : f3(t) + ' s'} (pressSecs ${WALLSNAP.pressSecs})`); rest(); }
    // ---- not asked for
    { const diag = run(WZ + R + 0.1, 90, ['KeyW', 'KeyD'], 'empty', 180); rest(); const sprint = run(11.5, 180, ['KeyW', 'ShiftLeft'], 'empty', 150); rest();
      let upAt = -1; const bump = run(11.5, 180, ['KeyW'], 'empty', 120, () => { if (upAt < 0 && gap() <= WALLSNAP.pressFlow + 0.05) { upAt = 1; S.keys(); } }); rest();
      const d = g.doors.byName('server'); if (d) { d.angle = 0; d.vel = 0; }
      S.place(17.6, 10.75, 180); S.keys('KeyW'); let leaf = false; for (let f = 0; f < 120; f++) { S.step(1); leaf ||= !!pl.wall; } rest();
      verdict(diag.took < 0 && sprint.took < 0 && bump.took < 0 && !leaf && !!d, 'not asked for, never a hold: a diagonal along the wall, a run at it, the key let go before the take, a shut door\'s leaf',
        `diagonal for 3 s ${diag.took < 0 ? 'no hold' : 'HELD'} · sprint into it ${sprint.took < 0 ? 'no hold' : 'HELD'} · key up ${f2(WALLSNAP.pressFlow + 0.05)} m out ${bump.took < 0 ? 'no hold' : 'HELD'} · into the server door's leaf ${d ? (leaf ? 'HELD' : 'no hold') : '(no door found)'}`); }
    // ---- any camera
    { const combos: string[][] = [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyD', 'KeyS'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyA', 'KeyW']]; let asked = 0, held = 0; const wrong: string[] = [];
      for (let k = 0; k < 24; k++) { const camYaw = k * 15 * DEG;
        for (const ks of combos) { W.cam.yaw = camYaw; W.cam.rebuild(); const B = W.cam.planarBasis(); let mx = 0, mz = 0;
          for (const key of ks) { const s = key === 'KeyW' || key === 'KeyD' ? 1 : -1, v = key === 'KeyW' || key === 'KeyS' ? B.fwd : B.right; mx += s * v[0]; mz += s * v[2]; }
          const l = Math.hypot(mx, mz), ang = Math.acos(Math.max(-1, Math.min(1, -mz / l))) / DEG;   // from square INTO the north wall (its normal is +z)
          if (Math.abs(ang - WALLSNAP.pressDeg) < 2) continue;
          S.place(21, WZ + R + 0.03, 90); W.cam.yaw = camYaw; W.cam.rebuild(); S.keys(...ks); let took = false; for (let f = 0; f < 30; f++) { S.step(1); took ||= !!pl.wall && Math.abs(pl.wall.n[2] - 1) < 0.01; } S.keys(); S.step(12);
          asked++; if (took) held++; if (took !== (ang < WALLSNAP.pressDeg)) wrong.push(`camera ${k * 15}° ${ks.map(x => x.slice(3)).join('+')} (${ang.toFixed(0)}° off square) ${took ? 'held' : 'no hold'}`); } }
      W.cam.yaw = 0; W.cam.rebuild();
      verdict(!wrong.length && held >= 24 && asked - held >= 96, 'whichever way the camera is turned: a hold if and only if the stick is within pressDeg of square into the wall', `${asked} asked, ${held} held · wrong: ${wrong.slice(0, 4).join(' · ') || 'none'}${wrong.length > 4 ? ` (+${wrong.length - 4})` : ''}`); }
    // ---- the hands
    { const rifle = run(11.5, 180, ['KeyW'], 'rifle'); const stack = pl.wall?.kind === 'stack' && pl.rifleUp; rest();
      const pistol = run(11.5, 180, ['KeyW'], 'pistol'); const away = !!pl.wall && pl.holstered; S.keys('KeyS'); S.step(40); const back = !pl.wall && !pl.holstered && pl.slot === 'pistol'; rest();
      const gd = g.guards[0], st0 = gd.state; gd.state = 'alert';
      const pA = run(11.5, 180, ['KeyW'], 'pistol'); const kept = !pl.holstered; rest(); const rA = run(11.5, 180, ['KeyW'], 'rifle'); rest(); const eA = run(11.5, 180, ['KeyW']); rest(); gd.state = st0;
      const shot = run(11.5, 180, ['KeyW'], 'rifle', 50, f => { if (f === 0) pl.lastFireT = g.time; }); let later = -1; for (let f = 0; f < 90; f++) { S.step(1); if (pl.wall && later < 0) later = f; } rest();
      const tm = gd.team; gd.state = 'alert'; gd.team = 'operative'; const own = run(11.5, 180, ['KeyW'], 'pistol'); rest(); gd.state = st0; gd.team = tm;
      S.place(21, 11.5, 180, 'pistol'); pl.pistol.mag = Math.max(0, pl.pistol.mag - 3); S.tap('KeyR'); S.step(2); const began = pl.pistol.reloading; S.keys('KeyW'); let inRel = false, relDone = -1, afterRel = -1;
      for (let f = 0; f < 360; f++) { S.step(1); if (pl.pistol.reloading && pl.wall) inRel = true; if (relDone < 0 && !pl.pistol.reloading) relDone = f; if (afterRel < 0 && pl.wall) afterRel = f; } rest();
      const relOk = began && !inRel && relDone >= 0 && afterRel >= relDone;
      S.input.buttons = 4; const btn = run(11.5, 180, ['KeyW'], 'empty', 90); S.input.buttons = 0; let upB = -1; for (let f = 0; f < 60; f++) { S.step(1); if (pl.wall && upB < 0) upB = f; } rest();
      verdict(rifle.took >= 0 && stack && pistol.took >= 0 && away && back && pA.took < 0 && kept && rA.took >= 0 && eA.took >= 0 && shot.took < 0 && later >= 0 && btn.took < 0 && upB >= 0 && own.took >= 0 && relOk, 'the hands: the rifle stacks, the pistol goes away and comes back; an enemy alert keeps the pistol up; a round of his own, a button held or a magazine out holds it all off',
        `rifle: hold ${rifle.took >= 0}, stacked in his hands ${stack} · pistol: hold ${pistol.took >= 0}, put away ${away}, back in hand off the wall ${back} · an enemy alert: pistol hold ${pA.took >= 0} (still in hand ${kept}), rifle ${rA.took >= 0}, empty hands ${eA.took >= 0} · just fired: hold inside ${f2(50 * DT)} s ${shot.took >= 0}, once pressAfterShot (${WALLSNAP.pressAfterShot} s) is past ${later >= 0} · a mouse button held: hold ${btn.took >= 0}, with it let go ${upB >= 0} · one of his own side alert: pistol hold ${own.took >= 0} · the pistol reloading: began ${began}, a hold while it ran ${inRel}, the hold once it was done ${afterRel >= 0 && afterRel >= relDone}`); }
    // ---- let go
    { const hold = () => { S.place(21, 11.5, 180); S.keys('KeyW'); S.step(70); return !!pl.wall; };
      const on = hold(); S.tap('KeyQ'); S.step(1); const off = !pl.wall; let pulled = false; for (let f = 0; f < 60; f++) { if (f === 20) S.keys('KeyW', 'ShiftLeft'); if (f === 23) S.keys('KeyW'); S.step(1); pulled ||= !!pl.wall; }
      S.keys(); S.step(4); S.keys('KeyW'); S.step(40); const again = !!pl.wall; rest();
      const on2 = hold(); S.keys('KeyW', 'ShiftLeft'); S.step(20); const ranOff = !pl.wall; S.keys('KeyW'); let back = false; for (let f = 0; f < 90; f++) { S.step(1); back ||= !!pl.wall; } rest();
      const on3 = hold(); S.keys('KeyS'); let offF = -1, early = false, farF = -1; const again0 = Math.round(WALLSNAP.pressAgain / DT);
      for (let f = 0; f < 150; f++) { S.step(1); if (!pl.wall && offF < 0) offF = f; if (offF >= 0 && pl.wall && f - offF < again0) early = true; if (offF >= 0 && farF < 0 && pl.wall && pl.wall.n[2] < -0.99) farF = f; } rest();
      S.place(34.6, 10.9, 180); S.keys('KeyW'); S.step(70); const cornerOn = !!pl.wall && pl.wall.n[2] > 0.99; S.tap('KeyQ'); S.step(1); S.keys('KeyD'); let east = -1; for (let f = 0; f < 90; f++) { S.step(1); if (east < 0 && pl.wall && pl.wall.n[0] < -0.99) east = f; } rest();
      verdict(on && off && !pulled && again && on2 && ranOff && !back && on3 && offF >= 0 && offF * DT <= 0.15 && !early && farF >= 0 && cornerOn && east >= 0,
        'letting go: Q or Shift with the key still into the wall is off and stays off; the key up and down again takes it; the stick held away lets go at once, and kept held has the far wall as he arrives; in a corner the other wall is his',
        `on ${on} → Q: off ${off}, pulled back on in the next second (a Shift tap in it) ${pulled} → key up and down: on ${again} · Shift: off ${ranOff}, back on with the key still held ${back} · held away: off after ${offF < 0 ? 'never' : f2(offF * DT) + ' s'}, a hold inside pressAgain (${WALLSNAP.pressAgain} s) ${early}, the far wall ${farF < 0 ? 'never' : f2((farF - offF) * DT) + ' s after'} · corner: on the first wall ${cornerOn}, Q then the stick into the other: ${east < 0 ? 'never' : 'his after ' + f2(east * DT) + ' s'}`); }
    // ---- a thing to use on the wall
    { const bp: V = g.level.breaker.pos; let plain = -1, thing = -1, row = false, touchP = -1, touchT = -1;
      const at = (x: number) => { S.keys(); g.teleportPlayer([x, 0, bp[2] - 1.3]); c.bodyYaw = c.aimYaw = 0; pl.holstered = true; pl.crouch = false; S.setCursor([x, 1.2, bp[2] + 2]); S.step(30); };
      const z0 = () => c.pos[2];
      at(bp[0]); { S.keys('KeyS'); let prev = z0(); for (let f = 0; f < 150; f++) { S.step(1); row ||= g.nearby.some((it: any) => it.kind === 'breaker' && it.inReach); if (touchT < 0 && Math.abs(z0() - prev) < 1e-4 && f > 5) touchT = f; prev = z0(); if (pl.wall && thing < 0) thing = f; } } const heldT = !!pl.wall; S.keys('KeyW'); S.step(30); rest();
      at(bp[0] - 2.6); { S.keys('KeyS'); let prev = z0(); for (let f = 0; f < 150; f++) { S.step(1); if (touchP < 0 && Math.abs(z0() - prev) < 1e-4 && f > 5) touchP = f; prev = z0(); if (pl.wall && plain < 0) plain = f; } } S.keys('KeyW'); S.step(30); rest(); S.setCursor(null);
      const dr = g.doors.byName('server'); if (dr) { dr.angle = 0; dr.vel = 0; } const byDoor = run(11.2, 180, ['KeyW'], 'empty', 150); const dGap = byDoor.gapAt; rest();
      S.place(dr ? dr.frameCentre[0] + 0.7 : 18.45, 11.2, 180); S.keys('KeyW'); let dTook = -1, dAt = NaN; for (let f = 0; f < 150; f++) { S.step(1); if (pl.wall && dTook < 0) { dTook = f; dAt = gap(); } } rest();
      const waited = thing >= 0 && touchT >= 0 ? (thing - touchT) * DT : NaN;
      verdict(!!dr && dTook >= 0 && dAt <= WALLSNAP.pressTouch + 0.03 && byDoor.took >= 0 && dTook - byDoor.took >= 20 && row && heldT && thing >= 0 && plain >= 0 && (touchP < 0 || plain <= touchP) && waited >= WALLSNAP.pressThing - 0.12 && waited <= WALLSNAP.pressThing + 0.05, 'a thing to use on the wall he walks into (the mains breaker, a door a step along): the wait is the long one and starts at the wall; the same wall further along is taken on the walk up',
        `breaker row in reach ${row} · at the breaker: stopped by the wall at frame ${touchT}, hold at frame ${thing} = ${Number.isFinite(waited) ? f2(waited) + ' s' : '—'} at the wall (pressThing ${WALLSNAP.pressThing}) · 2.6 m along: hold at frame ${plain}${touchP >= 0 ? `, the wall reached at ${touchP}` : ', before the wall was reached'} · 0.7 m from the server door's middle: hold at frame ${dTook}, ${f2(dAt)} m off the face; 3.25 m from it: at frame ${byDoor.took} with ${f2(dGap)} m to go`); }
    // ---- the switch off
    { WALLSNAP.on = true; WALLSNAP.press = false; const a = run(11.5, 180, ['KeyW']); rest(); const b = run(WZ + R + 0.03, 90, ['KeyW']); rest(); S.place(21, 10.6, 0); S.tap('KeyQ'); S.step(30); const q = !!pl.wall; S.tap('KeyQ'); S.step(20); set(true);
      verdict(a.took < 0 && b.took < 0 && q, 'the switch off: a key held into the wall is a man walking into a wall, and Q takes it as ever', `walk up ${a.took < 0 ? 'no hold' : 'HELD'} · turn in ${b.took < 0 ? 'no hold' : 'HELD'} · Q ${q ? 'holds' : 'NO HOLD'}`); }
    // ---- recordings and the stands
    { WALLSNAP.press = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.WALLSNAP?.press === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WALLSNAP.press;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = WALLSNAP.press === false; applyKnobs(g, snap); return off && WALLSNAP.press === true; });
      verdict(has && offOld && FROZEN_HOLDS['WALLSNAP.press'] === 'TPS_WALLPRESS=1', 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name', `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['WALLSNAP.press']}`); }
    // ---- a checkpoint (THE LAST LINE THAT USES THE RIG'S MAN: a load makes a new Player, and world()'s place / run / gap keep the old one)
    { const SS = await import(`${ROOT}/src/game/savestate.ts`); const holds0 = SS.SAVETIMELINE.holds; SS.SAVETIMELINE.holds = true; const P = () => g.player;
      const save = (label: string) => quiet(() => SS.saveState(g, { label, kind: 'harness' })), load = async (file: any) => { const yaw = W.cam.yaw; await quiet(() => SS.loadState(g, JSON.parse(JSON.stringify(file)))); W.cam.yaw = yaw; W.cam.rebuild(); };
      const worstOf = (a: number[], b: number[]) => { let w = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) w = Math.max(w, Math.abs((a[i] ?? 1e9) - (b[i] ?? -1e9))); return w; };
      const hold = () => { const out: number[] = []; for (let f = 0; f < 60; f++) { S.step(1); out.push(P().wall ? 1 : 0); } return out; };
      // (every save first, the loads after: once a load has made a new Player the rig's place() is no use)
      // the take's latch: Q off with the key still into the wall, saved with the key down (empty hands: a save waits for a hand that is changing what it holds)
      set(true); S.place(21, 11.5, 180); S.keys('KeyW'); S.step(70); S.tap('KeyQ'); S.step(2); const offQ = !pl.wall; const latched = await save('just off the wall'); const la = hold(); S.keys(); S.step(20);
      // the hold itself, taken with Q, the pistol in hand (the walk-in take off: the file is the saves' business, not the take's)
      WALLSNAP.press = false; S.place(21, 10.6, 0, 'pistol'); S.tap('KeyQ'); S.step(90); const on = !!pl.wall && pl.wall.settle >= 1 && pl.holstered && pl.wall.drawn;
      const file = await save('on the wall'), inFile = !!file.wallHold?.hold; SS.SAVETIMELINE.holds = false; const plain = await save('the switch off'); SS.SAVETIMELINE.holds = true;
      const walk = () => { const out: number[] = []; S.keys('KeyD'); for (let f = 0; f < 90; f++) { S.step(1); out.push(P().char.pos[0], P().char.pos[2], P().wall ? P().wall.u : -1); } S.keys('KeyS'); for (let f = 0; f < 60; f++) { S.step(1); out.push(P().char.pos[0], P().char.pos[2], P().wall ? 1 : 0); } S.keys(); S.step(40); return out; };
      const a = walk(), gunA = !P().holstered; await load(file); const back = !!P().wall && Math.abs(P().wall.n[2] - 1) < 0.01 && P().wall.settle >= 1; const b = walk(), gunB = !P().holstered, worst = worstOf(a, b);
      set(true); await load(latched); S.keys('KeyW'); const lb = hold(), retaken = la.includes(1) || lb.includes(1);
      const cut = JSON.parse(JSON.stringify(latched)); delete cut.wallHold; await load(cut); S.keys('KeyW'); const lc = hold(), cutRetaken = lc.includes(1); S.keys(); S.step(20);
      // a slice that is not a hold he could be in where he stands is no hold
      const bad = JSON.parse(JSON.stringify(file)); bad.wallHold.hold.d += 3; await load(bad); const refused = !P().wall;
      SS.SAVETIMELINE.holds = false; await load(file); const offLoad = !P().wall; SS.SAVETIMELINE.holds = holds0; set(true);
      verdict(on && inFile && back && worst < 1e-9 && gunA && gunB && offQ && !retaken && (BRK || cutRetaken) && refused && offLoad && plain.wallHold === undefined,
        'a checkpoint made on a wall loads on the wall and plays on as the save did, the pistol back in his hand off it; the take\'s latch rides the file; a hold he could not be in is none; with the saves\' switch off a file says nothing',
        `Q, pistol out: on the wall at the save ${on} · the hold in the file ${inFile} · on it after the load ${back} · 2.5 s of sliding and stepping off: the worst difference ${worst < 1e-9 ? 'none' : worst.toExponential(1)} · the pistol in hand after, carried on ${gunA}, loaded ${gunB} · Q off with the key held, saved: off ${offQ}, pulled back on in the next second, carried on or loaded ${retaken}; the file with the slice cut out pulls him back ${cutRetaken} · the plane moved 3 m in the file: no hold ${refused} · SAVETIMELINE.holds off: the load leaves him free ${offLoad}, the file's key ${plain.wallHold === undefined ? 'absent' : 'THERE'}`); }
  } finally { WALLSNAP.on = was.on; WALLSNAP.press = was.press; console.log = log; console.error = err; console.warn = warn; }
  console.log(`=== wallpress: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await wallPressCheck()) ? 0 : 1);
