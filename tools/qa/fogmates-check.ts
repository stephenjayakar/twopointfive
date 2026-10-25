// A TEAMMATE SEES WHAT THE PICTURE SHOWS (src/game/fogofwar.ts FOG.mates; src/game/guards.ts eyeThrough). The maintainer, 10-25, asked whether the men's own
// eyes should pass thin things as the fog's lines do: "i think teammates should see whatever we see".
//   bun run tools/qa/probes.ts fog-mates        (family fog; FOGMATES_BREAK=1 = the row is put off where the lines ask for it: they must go red)
//   bar       The Pass, the squad staged: a teammate and a defender either side of a thing the level marked thin, facing each other. Without the row his own
//             sight test does not have the man, with it it does; with the thin row off it does not, whatever this row says; the defender's eye on HIM is the
//             same with and without; a wall between them is a wall either way
//   agrees    every thin mark of The Pass, pairs put across it at sixteen bearings and nine spacings: with the row a teammate's own test and the fog's own
//             line from his head say the same of every pair; the row never takes a man from him; no other side's eye changes on any pair
//   stood     the game's own frames, the two kept on those marks: with the row the room fight's read has the teammate notice the man and take him as his
//             target inside half a second, without it his meter on him stays at nothing; the defender never takes him
//   played    the squad on the pass under the fog, sent at a man it hides, 20 s: this row with the thin row off is the run without either, by its digest
//             every half second and its dice (one seed); with both rows on, two seeds, no defender's sight of a teammate differs by the row on any
//             sampled frame (reported: the pairs it gave a teammate)
//   switch    the address, the journal, the two stands (the word acts only with the thin row's), the written lines
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function fogMatesCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { FOG, fogFlags } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { canSeeChar, eyeThrough, eyeBlocked } = await import(`${ROOT}/src/game/guards.ts`);
  const { isHostile } = await import(`${ROOT}/src/game/teams.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const BREAK = process.env.FOGMATES_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== fog-mates: a teammate\'s own eye passes the thin things the fog\'s lines pass ===');
  const matesWas = FOG.mates, thinWas = FOG.thin, DT = 1 / 60;
  let stood: boolean | null = null, stoodThin: boolean | null = null;
  /** The Pass stood up with the squad of four staged on it */
  async function rig(seed: number) {
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed }));
    if (stood === null) { stood = FOG.mates; stoodThin = FOG.thin; }   // (what the stand left: read below, with the stands, and put back at the end)
    const g = W.game as any; await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4'));
    return { W, g };
  }
  /** a man stood at (x, z) looking at (tx, tz), his bones posed there */
  const put = (gd: any, x: number, z: number, tx: number, tz: number) => { const c = gd.char; c.pos = [x, 0, z]; c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = Math.atan2(tx - x, tz - z); c.aimPitch = 0; c.update(0); };
  const sees = (g: any, a: any, b: any, mates: boolean, thin = true) => { FOG.mates = mates; FOG.thin = thin; return canSeeChar(g, a, b.char, false) as { visible: boolean; inCone: boolean; dist: number }; };
  try {
    { // ---- bar and agrees: stagings across every thin mark of the level
      const A = await rig(7), g = A.g, col = g.col, PF = g.fogOfWar; for (let i = 0; i < 3; i++) A.W.step(DT);
      g.aiEnabled = false; for (const x of g.guards) x.hold = true;
      const mate = (g.guards as any[]).find(x => x.team === 'operative' && x.char.alive), foe = (g.guards as any[]).find(x => x.char.alive && mate && isHostile(x.team, 'operative') && isHostile('operative', x.team));
      const statics: any[] = g.engine.world.statics, marks = statics.filter(b => b.flags & BoxFlag.Thin);
      if (!mate || !foe || !marks.length) verdict(false, 'bar — The Pass, the squad staged: a teammate, a man hostile to him, and the level\'s thin marks', `teammate ${mate?.callsign} · hostile ${foe?.callsign} · marks ${marks.length}`);
      else {
        const home = [mate, foe].map(x => ({ p: x.char.pos.slice(), yaw: x.char.bodyYaw, aim: x.char.aimYaw }));
        const chest = (c: any) => c.bones.chest ?? [c.pos[0], c.pos[1] + 1.1, c.pos[2]], head = (c: any) => c.bones.head ?? [c.pos[0], c.pos[1] + 1.65, c.pos[2]];
        /** the fog's own line from the teammate's head to the man, the thin row on, a field all round (the cone is not on trial) */
        const fogLine = () => { FOG.thin = true; const e = { id: mate.char.id, pos: head(mate.char), look: [0, 0, 1], at: head(mate.char), fov: 360 }; return PF.lineToMan(e, foe, chest(foe.char)) as boolean; };
        let pairs = 0, gained = 0, lost = 0, differ = 0, differOff = 0, foeMoved = 0, needsThin = 0, inCone = 0; let first: { m: number[]; f: number[]; at: number[] } | null = null;
        for (const t of marks) for (let k = 0; k < 16; k++) for (const r1 of [0.8, 1.5, 3]) for (const r2 of [0.8, 1.5, 3]) {
          const a = k * Math.PI / 8, mx = t.c[0] + Math.cos(a) * r1, mz = t.c[2] + Math.sin(a) * r1, fx = t.c[0] - Math.cos(a) * r2, fz = t.c[2] - Math.sin(a) * r2;
          if (col.nav.isBlocked(mx, mz) || col.nav.isBlocked(fx, fz)) continue;
          put(mate, mx, mz, fx, fz); put(foe, fx, fz, mx, mz); pairs++;
          const off = sees(g, mate, foe, false), on = sees(g, mate, foe, !BREAK), noThin = sees(g, mate, foe, !BREAK, false), fog = fogLine();
          const eOff = sees(g, foe, mate, false), eOn = sees(g, foe, mate, true);
          if (!on.inCone) continue; inCone++;
          if (on.visible && !off.visible) { gained++; first ??= { m: [mx, mz], f: [fx, fz], at: [t.c[0], t.c[2]] }; } if (off.visible && !on.visible) lost++;
          if (on.visible !== fog) differ++; if (off.visible !== fog) differOff++; if (noThin.visible !== off.visible) needsThin++; if (eOn.visible !== eOff.visible || eOn.inCone !== eOff.inCone) foeMoved++;
        }
        { // bar: the first such pair, every way round — and a wall
          const F = first as { m: number[]; f: number[]; at: number[] } | null; let off = true, on = false, noThin = true, eOff = false, eOn = true, through = [0, 0, 0, 0], wall = [false, true], bare = [false, true, false, false];
          if (F) { put(mate, F.m[0], F.m[1], F.f[0], F.f[1]); put(foe, F.f[0], F.f[1], F.m[0], F.m[1]);
            off = sees(g, mate, foe, false).visible; on = sees(g, mate, foe, !BREAK).visible; noThin = sees(g, mate, foe, !BREAK, false).visible; eOff = sees(g, foe, mate, false).visible; eOn = sees(g, foe, mate, true).visible;
            const me = head(mate.char), him = chest(foe.char), his = head(foe.char), mine = chest(mate.char); FOG.thin = true; FOG.mates = false; bare[0] = eyeBlocked(g, mate, me, him); FOG.mates = !BREAK; bare[1] = eyeBlocked(g, mate, me, him); FOG.mates = true; bare[2] = eyeBlocked(g, foe, his, mine); FOG.mates = false; bare[3] = eyeBlocked(g, foe, his, mine);
            FOG.thin = true; FOG.mates = true; through = [eyeThrough(mate), eyeThrough(foe)]; FOG.thin = false; through.push(eyeThrough(mate)); FOG.thin = true; FOG.mates = false; through.push(eyeThrough(mate)); }
          // a wall: the first pair of free cells two metres apart either side of something solid that is no thin mark (the plain line stopped with the marks passed too)
          let W: number[] | null = null; const nav = col.nav;
          for (let z = 2; z < nav.H - 2 && !W; z++) for (let x = 2; x < nav.W - 6 && !W; x++) { const ax = (x + 0.5) * nav.cell, az = (z + 0.5) * nav.cell, bx = ax + 2;
            if (nav.isBlocked(ax, az) || nav.isBlocked(bx, az)) continue;
            if (col.segmentBlocked([ax, 1.65, az], [bx, 1.1, az], 0.02, BoxFlag.Glass | BoxFlag.Thin) && col.segmentBlocked([ax, 1.65, az], [bx, 1.6, az], 0.02, BoxFlag.Glass | BoxFlag.Thin) && col.segmentBlocked([ax, 1.0, az], [bx, 1.0, az], 0.02, BoxFlag.Glass | BoxFlag.Thin)) W = [ax, az, bx]; }
          if (W) { put(mate, W[0], W[1], W[2], W[1]); put(foe, W[2], W[1], W[0], W[1]); wall = [sees(g, mate, foe, false).visible, sees(g, mate, foe, true).visible]; }
          const G = BoxFlag.Glass, GT = BoxFlag.Glass | BoxFlag.Thin;
          verdict(!!F && !off && on && !noThin && eOff === eOn && bare[0] && !bare[1] && bare[2] === bare[3] && through[0] === GT && through[1] === G && through[2] === G && through[3] === G && !!W && !wall[0] && !wall[1],
            'bar — The Pass, a teammate and a defender either side of a thing the level marked thin, facing each other: without the row his own sight test does not have the man, with it it does, and with the thin row off it does not whatever this row says; the defender\'s eye on him is the same either way; his bare line to the man\'s chest (the room fight\'s turn-to lines) is stopped without the row and clear with it, the defender\'s the same either way; what his line is handed is glass and the marks, a defender\'s glass alone; across a wall neither row shows anybody',
            F ? `${mate.callsign} at (${F.m[0].toFixed(2)}, ${F.m[1].toFixed(2)}), ${foe.callsign} at (${F.f[0].toFixed(2)}, ${F.f[1].toFixed(2)}), the mark at (${F.at[0].toFixed(2)}, ${F.at[1].toFixed(2)}): without ${off}, with ${on}, with and the thin row off ${noThin} · the defender's eye on him: ${eOff} / ${eOn} · his bare line stopped: without ${bare[0]}, with ${bare[1]}; the defender's: ${bare[2]} / ${bare[3]} · handed: teammate ${through[0]}, defender ${through[1]}, thin row off ${through[2]}, this row off ${through[3]} (glass ${G}, glass and thin ${GT}) · across a wall${W ? ` at (${W[0].toFixed(1)}, ${W[1].toFixed(1)})` : ': none found'}: ${wall[0]} / ${wall[1]}` : `no pair found that the marks alone hide (pairs tried: ${pairs})`);
        }
        verdict(marks.length >= 6 && pairs >= 300 && inCone >= 300 && gained >= 20 && lost === 0 && differ === 0 && differOff >= 20 && needsThin === 0 && foeMoved === 0,
          'agrees — every thin mark of The Pass, a teammate and a defender put across it at sixteen bearings and nine spacings wherever both can stand: with the row the teammate\'s own test and the fog\'s own line from his head say the same of every pair (without it they part on the pairs the row gains); the row never takes a man from him; with the thin row off it gives nothing; the defender\'s eye on the teammate is the same on every pair',
          `marks ${marks.length} · pairs ${pairs}, in his cone ${inCone} · gained by the row ${gained}, lost ${lost} · his test against the fog's line: ${differ} differ with the row, ${differOff} without · differ with the thin row off: ${needsThin} · the defender's eye moved: ${foeMoved}`);
        { // stood: the game's own senses, the pair kept on the first such marks
          const F = first as { m: number[]; f: number[]; at: number[] } | null; const row: string[] = []; let ok = !!F;
          const op = () => (g.fight?.ops as any[] | undefined)?.find(o => o.gd === mate), dop = () => (g.fight?.defs as any[] | undefined)?.find(d => d.gd === foe);
          const stand = (mates: boolean) => { FOG.thin = true; FOG.mates = mates; g.aiEnabled = true; let tgt = 0, foeTook = 0;
            for (let i = 0; i < 30 && F; i++) { put(mate, F.m[0], F.m[1], F.f[0], F.f[1]); put(foe, F.f[0], F.f[1], F.m[0], F.m[1]); A.W.step(DT); if (op()?.tgt === foe) tgt++; if (foe.foe === mate || dop()?.tgt === mate) foeTook++; }
            g.aiEnabled = false; return { tgt, meter: (op()?.meters.get(foe)?.m ?? 0) as number, foeTook }; };
          const off = stand(false), on = stand(!BREAK); ok &&= !!op() && off.tgt === 0 && off.meter === 0 && on.tgt > 0 && on.meter > 0.2 && off.foeTook === 0 && on.foeTook === 0;
          row.push(`in the room fight: ${!!op()}`, `without: his target ${off.tgt} of 30 frames, his meter on the man ${off.meter.toFixed(2)}; the defender takes him ${off.foeTook}`, `with: his target ${on.tgt} of 30, his meter ${on.meter.toFixed(2)}; the defender takes him ${on.foeTook}`);
          verdict(ok, 'stood — the game\'s own frames, the teammate and the defender kept either side of that mark for half a second: with the row the room fight\'s own read has the teammate notice the man (his meter on him rises) and take him as his target; without it his meter stays at nothing; the defender never takes the teammate either way', F ? row.join(' · ') : 'no pair to stand');
        }
        [mate, foe].forEach((x, i) => { const c = x.char; c.pos = home[i].p; c.bodyYaw = home[i].yaw; c.aimYaw = home[i].aim; c.update(0); });
      }
    }
    { // ---- played: the squad on the pass under the fog
      const SECS = 20; const play = async (seed: number, mates: boolean, thin: boolean) => { const P = await rig(seed), g = P.g; FOG.mates = mates; FOG.thin = thin; g.fogOfWar.on = true; const ds: string[] = []; let bites = 0, foeBites = 0, told = '';
        for (let i = 0; i < 60 * SECS; i++) { if (i === 40) { const far = (g.guards as any[]).filter(x => x.char.alive && g.fogOfWar.hidden(x))[0]; told = far ? String(g.orders.give('move', g.orders.targetAt([far.char.pos[0], 0, far.char.pos[2]])) ?? 'given') : 'nobody hidden'; }
          P.W.step(DT); if (i % 30 === 29) ds.push(JSON.stringify(digestGame(g)));
          if (thin && i % 6 === 5) { const men = (g.guards as any[]).filter(x => x.char.alive);   // (the same pairs asked both ways: canSeeChar writes nothing)
            for (const a of men) for (const b of men) { if (a === b || !isHostile(a.team, b.team)) continue; FOG.mates = true; const w = canSeeChar(g, a, b.char, false).visible; FOG.mates = false; const wo = canSeeChar(g, a, b.char, false).visible; if (w !== wo) { if (a.team === 'operative') bites++; else foeBites++; } }
            FOG.mates = mates; } }
        return { told, d: ds.join('|'), draws: g.dice?.n ?? -1, bites, foeBites, fog: g.fogOfWar.active === true }; };
      const a = await play(3, false, false), b = await play(3, !BREAK, false), needsBoth = a.d === b.d && a.draws === b.draws; let foes = 0, fog = a.fog && b.fog, bites = 0; const rows: string[] = [`seed 3, the thin row off, this row off / on: ${a.d === b.d ? `the same ${SECS * 2} digests` : 'digests differ'}, dice ${a.draws} / ${b.draws}`];
      for (const seed of [3, 4]) { const d = await play(seed, !BREAK, true); foes += d.foeBites; fog &&= d.fog; bites += d.bites;
        rows.push(`seed ${seed}, both rows on (the order: ${d.told}): dice ${d.draws}; sampled pairs a teammate's eye has by the row alone: ${d.bites}; a defender's: ${d.foeBites}`); }
      verdict(fog && needsBoth && foes === 0, 'played — the squad on the pass under the fog, sent at a man it hides, 20 s: this row with the thin row off is the run without either, by its digest every half second and its dice; with both rows on, two seeds, no defender\'s sight of a teammate differs by this row on any sampled frame (reported: the pairs it gave a teammate)',
        rows.join(' ·· ') + ` · pairs given in all: ${bites}`);
    }
    { // ---- the switch
      const g = globalThis as any, had = 'location' in g, locWas = g.location;
      const at = (search: string, from: boolean) => { FOG.mates = from; g.location = { search }; fogFlags(); return FOG.mates; };
      const zero = at('?fogmates=0', true), bare = at('?fogmates', false), one = at('?fogmates=1', false), none = at('', true), noneOff = at('', false);
      if (had) g.location = locWas; else delete g.location;
      const JR = await import(`${ROOT}/src/game/journal.ts`), PR = await import(`${ROOT}/src/host/profile.ts`), { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
      const W2: any = await quiet(() => standUp({}));
      FOG.mates = true; const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W2.game))), old = JSON.parse(JSON.stringify(snap)); const rides = snap.tables.FOG?.mates === true;
      FOG.mates = false; JR.applyKnobs(W2.game, snap); const applied = FOG.mates; delete old.tables.FOG.mates; FOG.mates = true; JR.applyKnobs(W2.game, old); const beforeKey = FOG.mates;
      const fogText = readFileSync(resolve(ROOT, 'src/game/fogofwar.ts'), 'utf8'), moduleOn = /\n  mates: true,\n/.test(fogText);
      const gt = readFileSync(resolve(ROOT, 'src/game/guards.ts'), 'utf8');
      const helper = /export function teamThrough\(\): number \{ return FOG\.mates \? fogThrough\(\) : BoxFlag\.Glass; \}\nexport function eyeThrough\(gd: Guard\): number \{ return gd\.team === 'operative' \? teamThrough\(\) : BoxFlag\.Glass; \}/.test(gt) && /export function fogThrough\(\): number \{ return FOG\.thin \? BoxFlag\.Glass \| BoxFlag\.Thin : BoxFlag\.Glass; \}/.test(fogText);
      const pt = readFileSync(resolve(ROOT, 'src/game/picture.ts'), 'utf8'), sam = /thr = teamThrough\(\);/.test(pt) && (pt.match(/, 0\.02, thr\)/g) ?? []).length === 2;
      const rf = readFileSync(resolve(ROOT, 'src/game/roomfight.ts'), 'utf8'), bareHelper = /export function eyeBlocked\(g: Game, gd: Guard, a: Vec3, b: Vec3\): boolean \{ return g\.col\.segmentBlocked\(a, b, 0\.02, eyeThrough\(gd\)\); \}/.test(gt), fights = (rf.match(/eyeBlocked\(g, O\.gd, /g) ?? []).length, lead = (gt.match(/eyeBlocked\(g, gd, eye, /g) ?? []).length;
      const lines = /const blocked = \(g\.col\.segmentBlocked\(eye, tgt, 0\.02, through\) && g\.col\.segmentBlocked\(eye, tgt2, 0\.02, through\)\)/.test(gt), handed = (gt.match(/eyeContact\([^\n;]*?, through\)/g) ?? []).length, asks = (gt.match(/eyeThrough\(gd\)/g) ?? []).length;
      const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_FOGMATES, want = word !== undefined ? word === '1' : shipped;
      verdict(zero === false && bare === true && one === true && none === true && noneOff === false && moduleOn && rides && applied === true && beforeKey === false && helper && bareHelper && sam && lines && handed === 2 && asks === 2 && lead === 2 && fights === 6 && (STAND_ENV as string[]).includes('TPS_FOGMATES') && /^TPS_FOGMATES=1 \(acts only under FOG\.thin: with TPS_FOGTHIN=1\)$/.test(PR.FROZEN_HOLDS['FOG.mates'] ?? '') && stood === want,
        'switch — on in the module, ?fogmates=0 puts it off and a bare or =1 word on, no word leaves it; it rides a recording\'s tables and a recording from before the key replays with it off; a man\'s line is handed the marks by the one helper, as written: in canSeeChar\'s two looks, and through the bare line in the lost-behind-something test and the room fight\'s six lines from a teammate\'s eye to a man; the player\'s own line for the squad\'s net takes the team\'s mask; a row of the two stands\' list with its word; up on the shipped stand, down on the frozen one unless its word raises it',
        `?fogmates=0 → ${zero} · bare → ${bare} · =1 → ${one} · no word → ${none} / ${noneOff} · the module's on: ${moduleOn} · rides the tables ${rides}, applied ${applied}, before the key ${beforeKey} · the helper as written ${helper}, the two lines ${lines}, looks handed it ${handed}, asked ${asks} times, the bare line as written ${bareHelper}: the lead test's ${lead}, the room fight's ${fights}, the player's line for the net ${sam} · ${shipped ? 'shipped' : 'frozen'} stand${word !== undefined ? ` with TPS_FOGMATES=${word}` : ''}: stood up ${stood}`);
    }
  } finally {
    FOG.mates = stood ?? matesWas; FOG.thin = stoodThin ?? thinWas;   // (as the stand left them: the probes after this one in the process run on the stand they were asked for)
  }
  console.log(`=== fog-mates: ${fails === 0 ? 'ALL PASS' : `${fails} of ${checks} FAILED`} ===`);
  return fails === 0;
}
