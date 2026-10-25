// A WINDOW'S BAR BREAKS FROM ONE ROUND (src/game/winbars.ts WINBARS, src/scene/bars.ts; the maintainer: 'for gameplay it'd be nice if they broke off with the
// glass and just as fast. so each bar breaks up with just a single bullet?').
//   bun run tools/qa/winbars-check.ts        (or: bun run tools/qa/probes.ts winbars)        exit 0 = every line PASS, 1 = a FAIL line
// Headless, real rounds from Sam's guns (combat.ts fireWeapon) on the barracks (windows with bars and no glass) and The Pass (bars between panes); nothing
// here looks at a picture. The rule is set by the check itself on either stand (the frozen stand holds it off).
//   inventory   on every level file the rule names every upright the kit stood in a window (told by the kit's own paint on the plain levels) and nothing
//               else; a level's GWOT twin has the same bars; the office's floor-to-ceiling conference uprights are not bars
//   stand       the stand's own word after the stand-up, and its FROZEN_HOLDS row
//   off         the rule off: a rifle round at a bar stops in it, the man behind stands, the bar stands, the line of fire across it is blocked
//   rifle       on: the line of fire across a STANDING bar is clear while sight and a plain ray still meet it; one rifle round and the bar is gone to
//               every question, in pieces in the debris pool, and the round went on into the man behind
//   pistol      one pistol round does the same; one shell of buck breaks the one bar once
//   near        a man on the near side of the bar takes the round: the bar stands as it stood
//   glazed      a bar between two panes (The Pass): one round takes it, and the round goes on to the glass where it stood, or past it
//   blast       a blast the destruction lane judges takes the bar it has a line to and leaves the one behind a wall
//   restart     a restart stands every bar up again
//   checkpoint  a broken bar is gone again in a fresh game loaded from the file; a file with no bar broken carries no slice
//   journal     a recording carries the switch, one from before the table replays with it off; the page opens with it on and ?winbars=0 puts it off
//   showcase    inert while a showcase runs
// WINBARS_BREAK=1: the switch reads on and the rule does nothing — red.
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
type Vec3 = [number, number, number];
const BREAK = process.env.WINBARS_BREAK === '1';

export async function winbarsCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const { WINBARS, WINBARS_STATS, barsLive, barAt, barsStanding, barsGone } = await import(`${ROOT}/src/game/winbars.ts`);
  const { barLevel } = await import(`${ROOT}/src/scene/bars.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const PROFILE = await import(`${ROOT}/src/host/profile.ts`);
  const DT = 1 / 60, SHIPPED = process.env.TPS_PROFILE === 'shipped'; const f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = WINBARS.on, destr0 = DESTRUCTION.on; let stood: boolean | null = null;
  const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow;
  const dataOf = (file: string): any => parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'));
  const levelOf = (file: string): any => { const data = dataOf(file); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
  /** the bar's own axis through its wall (unit, plan): its deep side */
  const deepN = (b: any): Vec3 => { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return b.h[0] > b.h[2] ? [cs, 0, -sn] : [sn, 0, cs]; };
  const park = (g: any, keep: number) => g.guards.slice(keep).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [1.5 + i * 0.9, 0, 1.5]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
  /** a man of the other side stood at `p` facing `face`, thinking nothing */
  const man = (g: any, p: Vec3, face: Vec3): any => { const gd = spawnUnit(g, { team: 'hostile', pos: v3.copy(p), yaw: 0, name: `man${g.guards.length}` }); dummy(gd, p, face); return gd; };
  const dummy = (gd: any, p: Vec3, face: Vec3) => {
    gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0;
    gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.task = null; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.flashlight.enabled = false;
    gd.char.update(0); gd.char.update(DT);
  };
  /** a fresh game on `file`, the rule as asked, nobody thinking */
  const world = async (file: string, on: boolean, destr = false) => {
    if (destr) DESTRUCTION.on = true;
    const W: any = await quiet(() => standUp({ level: levelOf(file) })); const g = W.game; if (stood === null) stood = WINBARS.on;
    if (destr) DESTRUCTION.on = true; WINBARS.on = on;   // AFTER standUp: the stand-up line would otherwise write them back
    g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.infiniteAmmo = true; g.tune.chaos = destr ? 0.5 : 0; park(g, 0);
    return W;
  };
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** the first standing bar with floor `off` m out from both its faces, nothing but itself on the line across it at chest height, and (glazed: false) no pane inside it */
  const across = (g: any, off: number, glazed: boolean, skip: number[] = []) => {
    for (const index of barsStanding(g) as number[]) {
      if (skip.includes(index)) continue;
      const b = g.col.boxes[index], n = deepN(b), half = Math.max(b.h[0], b.h[2]), y = 1.3; if (b.c[1] - b.h[1] > y - 0.15 || b.c[1] + b.h[1] < y + 0.15) continue;
      const A: Vec3 = [b.c[0] + n[0] * (half + off), 0, b.c[2] + n[2] * (half + off)], B: Vec3 = [b.c[0] - n[0] * (half + off), 0, b.c[2] - n[2] * (half + off)];
      if (!free(g, A) || !free(g, B)) continue;
      const from: Vec3 = [A[0], y, A[2]], d: Vec3 = [-n[0], 0, -n[2]], L = 2 * (half + off); const h = g.col.raycast(from, d, L);
      if (!h || h.index !== index || Math.abs(h.t - off) > 0.02) continue;
      const f0 = b.flags; b.flags |= HIDE; const beyond = g.col.raycast(from, d, L + 0.6); b.flags = f0;   // (the line with the bar out of it)
      const pane = !!beyond && beyond.index < 1e6 && !!(g.col.boxes[beyond.index].flags & BoxFlag.Glass) && beyond.t < off + 2 * half + 0.02;
      if (glazed ? !pane : !!beyond) continue;
      if (g.props.raycast(from, d, L + 0.6)) continue;
      return { b, index, n, half, A, B, y, at: [b.c[0], y, b.c[2]] as Vec3, flags: f0 as number };
    }
    return null;
  };
  /** Sam at `sam` with `slot` up, facing `aim` */
  const stage = async (W: any, sam: Vec3, slot: 'pistol' | 'rifle', aim: Vec3) => {
    const g = W.game; g.teleportPlayer(v3.copy(sam)); const pl = g.player; pl.slot = slot; pl.holstered = false; for (let i = 0; i < 90; i++) { W.cursorAt(aim); W.step(DT); }
    return { pc: pl.char, def: (pl.gunInHand() ?? pl.pistol).def };
  };
  /** where a man stands to be on the line from Sam's muzzle through `at`, `past` metres beyond it (floor) */
  const onLine = (pc: any, at: Vec3, past: number): Vec3 => { const d = v3.sub(at, pc.muzzle), l = Math.hypot(d[0], d[2]); return [at[0] + d[0] / l * past, 0, at[2] + d[2] / l * past]; };
  const shotOf = (g: any, ev0: number) => g.events.slice(ev0).filter((e: any) => e.kind === 'shot').pop();
  const gone = (g: any, X: any): boolean => !barAt(g, X.index) && (X.b.flags & HIDE) === HIDE && barsGone(g).includes(X.index);
  const stands = (g: any, X: any): boolean => barAt(g, X.index) && X.b.flags === X.flags && !barsGone(g).includes(X.index);

  try {
    // ------------------------------------------------------------ inventory: what the rule names, on every level
    { const files = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.includes('.lint')); let total = 0, kitTotal = 0; const bad: string[] = [], counts: Record<string, number> = {}; let office = '';
      for (const f of files) {
        const data = dataOf(f); let L: any; try { L = loadLevel(data, { validate: false }); } catch { continue; }
        const n = barLevel(L.boxes); counts[f] = n; total += n;
        const gf = data.materials?.glassFrame?.albedo as Vec3 | undefined; if (!gf || f.endsWith('-gwot.json')) continue;   // (a GWOT twin repaints its frames: it is held to its plain level's count below)
        const kit = L.boxes.filter((b: any) => !(b.flags & BoxFlag.Glass) && Math.abs(b.albedo[0] - gf[0]) + Math.abs(b.albedo[1] - gf[1]) + Math.abs(b.albedo[2] - gf[2]) < 1e-6 && b.h[1] > Math.max(b.h[0], b.h[2]) && Math.abs(2 * Math.min(b.h[0], b.h[2]) - 0.08) < 1e-6);
        const sill = kit.filter((b: any) => b.c[1] - b.h[1] > 0.1), floor = kit.length - sill.length; kitTotal += sill.length;
        const miss = sill.filter((b: any) => !(b.flags & BoxFlag.Bar)).length, extra = L.boxes.filter((b: any) => b.flags & BoxFlag.Bar && !sill.includes(b)).length;
        if (miss || extra) bad.push(`${f}: ${miss} missed, ${extra} extra`);
        if (f === 'office.json') office = `${floor} floor-to-ceiling uprights left as structure`;
      }
      const twins = files.filter(f => f.endsWith('-gwot.json') && counts[f.replace('-gwot', '')] !== undefined), odd = twins.filter(f => counts[f] !== counts[f.replace('-gwot', '')]);
      line(total > 0 && !bad.length && !odd.length && counts['pass.json'] === 4, `the rule names every upright the kit stood in a window and nothing else: ${total} bars over ${files.length} level files, ${kitTotal} told by the kit's paint on the plain ones (${bad.length ? bad.join(' · ') : 'none missed, none extra'}); ${twins.length} GWOT twins carry their plain level's count (${odd.length ? `NOT ${odd.join(', ')}` : 'all'}); The Pass has ${counts['pass.json']}; the office: ${office || 'no kit paint read'}`); }

    // ------------------------------------------------------------ the levels the rounds are fired on
    const W0 = await world('barracks.json', true), g0 = W0.game; const P = across(g0, 1.6, false);
    { const env = process.env.TPS_WINBARS, want = env !== undefined ? env === '1' : SHIPPED, row = PROFILE.FROZEN_HOLDS['WINBARS.on'];
      line(stood === want && row === 'TPS_WINBARS=1', `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word (after the stand-up: ${stood} · TPS_WINBARS ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'frozen'} · row '${row}')`); }
    line(!!P, `the barracks has a window bar with no glass, floor both sides and a clear line across it (${P ? `static ${P.index}, ${f2(2 * Math.min(P.b.h[0], P.b.h[2]))} m across, ${f2(2 * P.half)} deep, ${f2(P.b.c[1] - P.b.h[1])}‥${f2(P.b.c[1] + P.b.h[1])} m up` : 'NONE'})`);
    if (!P) throw new Error('nothing to fire at');
    const bar = (g: any) => { const b = g.col.boxes[P.index]; return { ...P, b, flags: b.flags as number }; };

    // ------------------------------------------------------------ fired rounds: off, then on with each gun
    const fired = async (on: boolean, slot: 'pistol' | 'rifle') => {
      const W = await world('barracks.json', on), g = W.game, X = bar(g), st = await stage(W, P.A, slot, P.at), at = onLine(st.pc, P.at, 1.3), gd = man(g, at, P.A); const chest: Vec3 = [at[0], P.y, at[2]];
      const eyeA: Vec3 = [P.A[0], P.y, P.A[2]], eyeB: Vec3 = [P.B[0], P.y, P.B[2]];
      const before = { fire: g.col.shotBlocked(eyeA, eyeB) as boolean, sight: g.col.segmentBlocked(eyeA, eyeB) as boolean, ray: g.col.raycast(eyeA, [-P.n[0], 0, -P.n[2]], 2)?.index === P.index };
      const s0 = { ...WINBARS_STATS }, ev0 = g.events.length, deb0 = g.destr.debris.list.length;
      fireWeapon(g, st.pc, P.at, true);
      const shot = shotOf(g, ev0), far = shot ? v3.dist(shot.from, shot.to) : -1, toBar = v3.dist(st.pc.muzzle, P.at);
      const after = { fire: g.col.shotBlocked(eyeA, eyeB) as boolean, sight: g.col.segmentBlocked(eyeA, eyeB) as boolean, ray: g.col.raycast(eyeA, [-P.n[0], 0, -P.n[2]], 2)?.index === P.index };
      return { W, g, X, st, gd, chest, before, after, far, toBar, dead: gd.state === 'dead', broken: WINBARS_STATS.broken - s0.broken, chunks: WINBARS_STATS.chunks - s0.chunks, demoted: WINBARS_STATS.demoted - s0.demoted, deb: g.destr.debris.list.length - deb0 };
    };
    { const r = await fired(false, 'rifle');
      line(stands(r.g, r.X) && !r.dead && r.broken === 0 && r.deb === 0 && r.before.fire && r.after.fire && r.before.ray && r.after.ray && r.far < r.toBar + 0.05,
        `off, a rifle round at the bar with a man 1.3 m behind it: the round stops in the bar (${f2(r.far)} m out, the bar's middle ${f2(r.toBar)} m), the man stands, the bar stands with its flags as authored, nothing counted, and the line of fire across it is blocked before and after`); }
    for (const slot of ['rifle', 'pistol'] as const) {
      const r = await fired(true, slot);
      line(!r.before.fire && r.before.sight && r.before.ray, `on, before a shot: the line of fire across the standing bar is clear (blocked ${r.before.fire}) while sight (${r.before.sight}) and a plain ray (${r.before.ray}) still meet it`);
      line(gone(r.g, r.X) && r.broken === 1 && !r.after.sight && !r.after.ray && !r.after.fire, `on, one ${slot} round (${r.st.def.id}): the bar is gone to every question — a ray, sight and the line of fire across where it stood all pass (${r.after.ray}, ${r.after.sight}, ${r.after.fire}), one bar counted (${r.broken})`);
      line(r.dead && r.far > r.toBar + 0.5, `…and the round flew on: it stopped ${f2(r.far)} m out, ${f2(r.far - r.toBar)} m past the bar, in the man behind — he is down (${r.gd.state})`);
      line(r.chunks + r.demoted === Math.round(WINBARS.pieces) && r.deb === r.chunks, `…and the bar left as ${r.chunks + r.demoted} pieces (${r.chunks} rigid in the debris pool, ${r.demoted} as chips)`);
      if (slot === 'rifle') {
        for (let i = 0; i < 240; i++) r.W.step(DT);
        const mine = (r.g.destr.debris.list as any[]).slice(-r.deb), moving = mine.filter(c => !c.rest).length, low = mine.filter(c => c.box.c[1] < r.X.b.c[1] - r.X.b.h[1]).length;
        line(moving === 0 && low === mine.length && gone(r.g, r.X), `four seconds on: every piece is still (${moving} moving) and down below the sill (${low} of ${mine.length}); the bar is still gone`);
        // a second round down the same line meets nothing where the bar stood
        const ev0 = r.g.events.length; fireWeapon(r.g, r.st.pc, P.at, true); const s2 = shotOf(r.g, ev0);
        line(!!s2 && v3.dist(s2.from, s2.to) > r.toBar + 0.5 , `a second round down the same line flies through where the bar stood (${s2 ? f2(v3.dist(s2.from, s2.to)) : '?'} m out)`);
      }
    }
    // a shell of buck: one bar, once
    { const W = await world('barracks.json', true), g = W.game, X = bar(g), st = await stage(W, P.A, 'rifle', P.at), pl = g.player; const sg = Object.values((await import(`${ROOT}/src/game/weapons.ts`)).WEAPONS as Record<string, any>).find(w => w.pellets);
      if (!sg) console.log('  (no shotgun row in the weapons table: the shell line is skipped)');
      else { const s0 = WINBARS_STATS.broken; fireWeapon(g, st.pc, P.at, true, { weapon: sg }); void pl;
        line(gone(g, X) && WINBARS_STATS.broken - s0 === 1, `one shell of buck (${sg.id}, ${sg.pellets.n} pellets): the bar is gone and counted once (${WINBARS_STATS.broken - s0})`); } }

    // ------------------------------------------------------------ a man on the near side takes the round
    { const W = await world('barracks.json', true), g = W.game, X = bar(g), far: Vec3 = [P.A[0] + P.n[0] * 1.4, 0, P.A[2] + P.n[2] * 1.4];
      if (!free(g, far)) console.log('  (no floor 3 m out from the bar: the near-side line is skipped)');
      else { const st = await stage(W, far, 'rifle', P.at), d = v3.sub(P.at, st.pc.muzzle), l = Math.hypot(d[0], d[2]), gd = man(g, [P.at[0] - d[0] / l * 1.0, 0, P.at[2] - d[2] / l * 1.0], far); const s0 = { ...WINBARS_STATS }; fireWeapon(g, st.pc, P.at, true);
        line(gd.state === 'dead' && stands(g, X) && WINBARS_STATS.broken === s0.broken, `a man 1 m on the NEAR side of the bar, on the line: the round stops in him (${gd.state}) and the bar stands as it stood (flags as authored, nothing counted)`); } }

    // ------------------------------------------------------------ glazed: a bar between two panes
    { const W = await world('pass.json', true), g = W.game, G = across(g, 1.5, true);
      line(!!G, `The Pass has a bar between two panes with floor both sides (${G ? `static ${G.index}` : 'NONE'}; ${barsStanding(g).length} bars standing)`);
      if (G) { const st = await stage(W, G.A, 'rifle', G.at), ev0 = g.events.length, toBar = v3.dist(st.pc.muzzle, G.at) - G.half; fireWeapon(g, st.pc, G.at, true); const shot = shotOf(g, ev0), far = shot ? v3.dist(shot.from, shot.to) : -1;
        line(gone(g, G) && far > toBar + G.half - 0.03, `one rifle round at it: the bar is gone, and the round went on ${f2(far - toBar)} m past the bar's face — ${far > toBar + 2 * G.half + 0.3 ? 'through the glass where it stood and on (rounds go through glass on this stand)' : 'to the glass where it stood (a pane stops a round on this stand)'}`); } }

    // ------------------------------------------------------------ a blast
    { const W = await world('barracks.json', true, true), g = W.game, X = bar(g); const at: Vec3 = [P.A[0] - P.n[0] * 0.6, 1.0, P.A[2] - P.n[2] * 0.6];
      const others = (barsStanding(g) as number[]).filter(i => i !== P.index), s0 = WINBARS_STATS.byBlast;
      g.destr.blast(at, { who: 1, radius: 2.5 });
      const far = others.filter(i => v3.dist(g.col.boxes[i].c, at) > 6), farUp = far.filter(i => barAt(g, i)).length;
      line(gone(g, X) && WINBARS_STATS.byBlast - s0 >= 1 && farUp === far.length, `a blast 1 m from the bar (radius 2.5 m, the destruction lane on): the bar is gone by the blast (${WINBARS_STATS.byBlast - s0} taken) and the ${far.length} bars more than 6 m off stand (${farUp})`);
      for (const side of [1, -1]) {
        const Wf = await world('barracks.json', true, true), gf = Wf.game, Xf = bar(gf), foot: Vec3 = [P.b.c[0] + side * P.n[0] * (P.half + 0.2), 0.1, P.b.c[2] + side * P.n[2] * (P.half + 0.2)], deb0 = gf.destr.debris.list.length;
        gf.destr.blast(foot, { who: 1, radius: 2.5 });
        const mine = (gf.destr.debris.list as any[]).slice(deb0).filter(c => Math.hypot(c.box.c[0] - P.b.c[0], c.box.c[2] - P.b.c[2]) < 0.2 && Math.abs(c.box.h[0] - P.b.h[0]) < 1e-6 && Math.abs(c.box.h[2] - P.b.h[2]) < 1e-6);
        const away = mine.filter(c => (c.v[0] * P.n[0] + c.v[2] * P.n[2]) * -side > 0).length;
        line(gone(gf, Xf) && mine.length > 0 && away === mine.length, `a blast on the floor 0.2 m out from the wall's foot under the window, ${side > 0 ? 'one' : 'the other'} side: the bar goes (its own sill is no shield) and its ${mine.length} pieces fly away from the blast (${away})`);
      }
      const W2 = await world('barracks.json', false, true), g2 = W2.game, X2 = bar(g2); g2.destr.blast(at, { who: 1, radius: 2.5 });
      line(barAt(g2, X2.index), `the rule off, the same blast: the bar stands`); }

    // ------------------------------------------------------------ restart, checkpoint
    { const W = await world('barracks.json', true), g = W.game, X = bar(g), st = await stage(W, P.A, 'rifle', P.at);
      const whole = saveState(g); fireWeapon(g, st.pc, P.at, true); const broke = gone(g, X); const file = JSON.parse(JSON.stringify(saveState(g)));
      line(broke && whole.bars === undefined && Array.isArray(file.bars?.s) && file.bars.s.length === 1 && file.bars.s[0] === P.index, `a checkpoint with nothing broken carries no slice (${whole.bars === undefined}); one made after the round carries the bar (${JSON.stringify(file.bars)})`);
      g.restartEncounter(); for (let i = 0; i < 5; i++) W.step(DT);
      line(stands(g, bar(g)) && g.col.boxes[P.index].flags === P.flags, `a restart stands the bar up again, its flags as authored`);
      const W2 = await world('barracks.json', true), g2 = W2.game; loadState(g2, file); for (let i = 0; i < 5; i++) W2.step(DT);
      const eyeA: Vec3 = [P.A[0], P.y, P.A[2]], eyeB: Vec3 = [P.B[0], P.y, P.B[2]];
      line(gone(g2, bar(g2)) && !g2.col.segmentBlocked(eyeA, eyeB) && g2.destr.debris.list.length === 0, `the file loaded into a fresh game: the bar is gone again, sight passes where it stood, and nothing was thrown (${g2.destr.debris.list.length} pieces)`);
      const bad = JSON.parse(JSON.stringify(file)); bad.bars.s = [0]; let refused = ''; try { loadState(g2, bad); } catch (e) { refused = (e as Error).message; }
      line(/window bars/.test(refused), `a file whose slice names a static that is no bar is refused (${refused || 'LOADED'})`); }

    // ------------------------------------------------------------ recordings, the page, a showcase
    { const W = await world('barracks.json', true), g = W.game; const snap = knobsSnapshot(g); const has = !!snap.tables.WINBARS && (snap.tables.WINBARS as any).on === true;
      WINBARS.on = false; applyKnobs(g, snap); const back = WINBARS.on;
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WINBARS; WINBARS.on = true; applyKnobs(g, old); const older = WINBARS.on;
      const keep = knobsCopy(); PROFILE.pageSwitches(new URLSearchParams('')); const a = WINBARS.on; PROFILE.pageSwitches(new URLSearchParams('winbars=0')); const b = WINBARS.on; knobsBack(keep);   // (the page's switches write every table: all of them as they stood, for whatever probe runs next in this process)
      line(has && back === true && older === false && a === true && b === false, `a recording carries the switch (its WINBARS row ${has ? 'is there' : 'is MISSING'}; put back: ${back}) and one from before the table replays with it off (${older}); the page opens with it on (${a}) and ?winbars=0 puts it off (${b})`);
      WINBARS.on = true; const live = barsLive(g); g.touring = true; const show = barsLive(g), pass = g.col.firePass ? g.col.firePass() : -1; g.touring = false;
      line(live === !BREAK && show === false && pass === 0, `a showcase on the stage: the rule is inert (live ${live} → ${show}; the line of fire passes nothing: ${pass})`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { WINBARS.on = was; DESTRUCTION.on = destr0; }
  console.log(failed ? '=== winbars-check: FAIL ===' : '=== winbars-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await winbarsCheck()) ? 0 : 1);
