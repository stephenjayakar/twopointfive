// THE REPLAY'S FOG SWITCH CHANGES THE PICTURE ONLY (src/game/game.ts fogLift / fogBack, src/game/fogofwar.ts `viewer` / `bared` / raw() / everybody(),
// src/replay/engineplay.ts 'Fog') — the maintainer, 10-12: "in engine replays should let you ctrl drag to rotate. also a switch to remove fog of war".
//
//   bun run tools/qa/replayfog-check.ts [level.json] [--secs N] [--verbose]      (probes.ts replayfog; REPLAYFOG_BREAK=1 = the step's list not packed again after the draw: must fail)
//
// Played: a room clear with the four under the fog (hard's cones, nothing live in the fog), 'open and clear' ordered, the defenders free — three times from one
// seed: plain, plain again (the rig's own control), and with the fog lifted and handed back after EVERY step as the replay's draw does. The three must digest the
// same. While lifted: nobody is hidden to the HUD, the fog pass is off, the renderer's list holds what the fog had cut; handed back: every one of those as it was,
// and a ray meets what it met. With no viewer raised (play) the lift does nothing.
//
// THE VIEWER'S NIGHT VISION (the replay's 'NV': Game.fogLift's second argument; "also turning on and off night vision") is held the same way, two more pairs of runs:
// goggles UP in the run and the viewer's tube ON for every draw (the squad's infrared lines are in the drawn list, none in the step's; with the fog lifted on
// every other frame too), and goggles DOWN in the run (its own control: the goggles are the run's) with the viewer's tube OFF for every draw (the step's infrared
// lines left out of the drawn list). Each must digest as its control, hand the step's list back unwritten, and leave the player's goggles alone.
//
// THIN LINES AT THE PICTURE'S OWN PIXEL (src/game/thinline.ts, Game.fogLift's third argument; "what happened to the laser, why so thick?"): a laser beam or a tracer is
// made at least a pixel wide by the STEP's view, which in a replay is the recording's — so the draw re-fits them for the view the picture is drawn with. Two more
// runs, every draw fitted to a pixel six times the step's or an eighth of it: with the viewer's tube on (the lines the tube adds are fitted) and with the run's
// goggles down and nothing else lifted (the step's own lines are fitted). Each must digest as its control, every noted line must come out at the width that pixel
// asks carrying the same light, nothing un-noted may change, and the step's list and its boxes must be handed back unwritten.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { hudExpireBubbles } from '../../src/game/journal.ts';
import { resolve } from 'node:path';

export async function replayfogCheck(): Promise<boolean> {
  const DT = 1 / 60, argv = process.argv.slice(2), file = argv.find(a => a.endsWith('.json')) ?? 'records.json', verbose = argv.includes('--verbose');
  const secs = argv.includes('--secs') ? Number(argv[argv.indexOf('--secs') + 1]) || 25 : 25, BREAK = process.env.REPLAYFOG_BREAK === '1';
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { thinWant } = await import(`${ROOT}/src/game/thinline.ts`);
  const { irMade } = await import(`${ROOT}/src/game/irlaser.ts`);
  const log = console.log;
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
  let fails = 0;
  const verdict = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (detail) log(`    ${detail}`); };
  const seeded = (s: number) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };

  const armArg = argv.includes('--arm') ? argv[argv.indexOf('--arm') + 1] : '';
  interface Arm { digests: string[]; lifted: number; hiddenMax: number; more: number; doors: number; bad: string[]; ir: number; irMax: number; thin: number; thinMax: number; fat: number }
  if (!armArg) {   // (each run in a process of its own: a restart inside one process does not replay — serials, the mission clock)
    const run = (name: string, env: Record<string, string> = {}): Arm => { const r = Bun.spawnSync([process.execPath, 'run', import.meta.path, file, '--secs', String(secs), '--arm', name], { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
      const out = r.stdout.toString(), i = out.lastIndexOf('ARM '); if (i < 0) throw new Error(`arm ${name} gave no result: ${r.stderr.toString().slice(-600)}`); return JSON.parse(out.slice(i + 4)); };
    const a = run('plain'), b = run('plain'), c = run('lift'), d = run('noviewer');
    const same = (x: Arm, y: Arm) => { const i = x.digests.findIndex((h, k) => h !== y.digests[k]); return i < 0 && x.digests.length === y.digests.length ? '' : `part at ${((i + 1) * 0.5).toFixed(1)} s (${x.digests[i]} ≠ ${y.digests[i]})`; };
    log(`${file}: room clear, the four, fog on (cones, nothing live in the fog), 'open and clear', ${secs} s · ${a.digests.length} digests a run · last ${a.digests[a.digests.length - 1]}`);
    verdict(!same(a, b), 'the rig plays the same run twice (control)', same(a, b));
    verdict(!same(a, c), 'lifting the fog for a draw after every step and handing it back plays the same run', same(a, c) || `lifted on ${c.lifted} frames · up to ${c.hiddenMax} men hidden at once · the lifted list longer than the fogged on ${c.more} frames · a leaf drawn elsewhere than it stands under the fog on ${c.doors}`);
    verdict(c.lifted > 60 * secs * 0.9 && c.hiddenMax > 0 && c.more > 0 && c.doors > 0, 'the fog was really up, hid men and held a leaf where it was last seen, and the lifted picture held more than the fogged one', `lifted ${c.lifted} · hidden max ${c.hiddenMax} · longer on ${c.more} · leaves on ${c.doors}`);
    verdict(c.bad.length === 0, 'while lifted nobody is hidden and the pass is off; handed back, the list, the fog\'s answers and the rays are as the step left them', c.bad.join(' · '));
    verdict(!same(a, d) && d.bad.length === 0 && d.lifted === 0, 'with no viewer raised (play) a lift does nothing', same(a, d) || d.bad.join(' · '));
    const t = run('tube'), gc = run('goggles'), u = run('untube');
    verdict(!same(a, t) && t.bad.length === 0, 'the viewer\'s tube on for every draw (the run\'s goggles up) plays the same run, the step\'s list handed back unwritten, the player\'s goggles untouched', same(a, t) || t.bad.join(' · '));
    verdict(t.ir > 0, 'with the viewer\'s tube on the squad\'s infrared lines are in the drawn list, and none in the step\'s', `infrared boxes drawn on ${t.ir} frames · up to ${t.irMax} at once`);
    verdict(!same(gc, u) && u.bad.length === 0, 'the viewer\'s tube off for every draw (the run\'s goggles down) plays the same run as its control', same(gc, u) || u.bad.join(' · '));
    verdict(u.ir > 0, 'with the viewer\'s tube off the step\'s infrared lines are left out of the drawn list', `the step made infrared boxes on ${u.ir} frames · up to ${u.irMax} at once · none drawn`);
    verdict(d.ir === 0, 'with no viewer raised (play) a tube asked for adds nothing', `infrared boxes on ${d.ir} frames`);
    const th = run('thin'), to = run('thinonly');   // (thin: the viewer's tube adds the lines and they are fitted · thinonly: the run's own goggles down, the STEP's own lines fitted, nothing else lifted)
    verdict(!same(a, th) && !same(gc, to) && th.bad.length + to.bad.length === 0, 'thin lines fitted to another pixel than the step\'s for every draw plays the same run, and no box of the step is written', same(a, th) || same(gc, to) || [...th.bad, ...to.bad].join(' · '));
    verdict(th.thin > 0 && th.fat > 0 && to.thin > 0 && to.fat > 0, 'a laser\'s line is drawn at the width the picture\'s own pixel asks, whatever the step\'s was', `lines the viewer's tube adds: fitted on ${th.thin} frames, up to ${th.thinMax} at once, ${th.fat} lines drawn over twice as wide · the step's own lines (goggles down): fitted on ${to.thin} frames, up to ${to.thinMax} at once, ${to.fat} lines drawn over twice as wide`);
    if (verbose) log(`    digests: ${a.digests.slice(-4).join(' ')} · goggles down ${gc.digests.slice(-2).join(' ')}`);
    log(fails ? `=== replayfog-check: ${fails} FAILED ===` : '=== replayfog-check: ALL PASS ===');
    return fails === 0;
  }
  const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  Math.random = seeded(11);
  const W: any = await quiet(() => standUp({ level: lvl })); const g = W.game, world = g.engine.world, FW = g.fogOfWar; g.godMode = true;
  await quiet(() => startFromQuery(g, new URLSearchParams('roomclear&squad4')));
  FOG.cone = true; FOG.own = false; FOG.things = true; FOG.doors = true; FOG.squadDoors = false;   // (squadDoors off on either stand: the door the squad works is then a leaf the fog draws where it was last seen — the case the lift must put right)

  async function arm(lift: boolean, viewer: boolean, tube: boolean | null = null, goggles = false, thin = false): Promise<Arm> {
    const A: Arm = { digests: [], lifted: 0, hiddenMax: 0, more: 0, doors: 0, bad: [], ir: 0, irMax: 0, thin: 0, thinMax: 0, fat: 0 };
    if (goggles) g.player.nv = true;   // (the RUN's goggles: the team's own night vision rules read them, so this is another run with a control of its own)
    const note = (f: number, what: string) => { if (A.bad.length < 6) A.bad.push(`f${f}: ${what}`); };
    await quiet(() => { FW.on = true; FW.viewer = viewer; for (let i = 0; i < 30; i++) W.step(DT);
      const men = g.orders.men('all');
      for (const d of g.doors.list) { if (Math.abs(d.angle) > 0.05) continue; const op: any = g.doorTools.order('openClear', men, d, g.doors.side(d, men[0].char.pos) >= 0 ? 1 : -1); if (typeof op !== 'string') break; }
      const at = (b: any) => JSON.stringify([b.center, b.half, b.yaw ?? 0]);
      for (let f = 0; f < 60 * secs; f++) {
        W.step(DT);
        if (!lift && tube === null) hudExpireBubbles(g);   // (the HUD's one write to the game, made after every step on a page: here in every arm, in the lift arm inside the lifted draw as the player makes it)
        if (thin) {   // (the picture's own pixel: the same draw twice, at the step's pixel and at another — only the thin lines' width and glow may differ, and only in the drawn list)
          const dyn = world.dynamics, before = dyn.slice(), was = before.map((b: any) => `${b.h}|${b.emissive}`), px = BREAK ? 0 : g.mPerPx * (f % 2 ? 6 : 1 / 8);
          g.fogLift(false, tube, 0); world.upload(); const LA = world.dynamics.slice(); hudExpireBubbles(g); g.fogBack();
          g.fogLift(false, tube, px); world.upload(); const LB = world.dynamics; let n = 0;
          if (LB.length !== LA.length) note(f, `the fitted list holds ${LB.length} boxes, the unfitted ${LA.length}`);
          else for (let i = 0; i < LA.length; i++) { const a: any = LA[i], b: any = LB[i], want = thinWant(a, px), same = a.h[0] === b.h[0] && a.h[1] === b.h[1];
            if (want === null) { if (i < before.length ? b !== before[i] : !same) note(f, 'a box nobody noted was changed'); continue; }
            if (Math.abs(b.h[0] - want) > 0.021 * want || b.h[0] !== b.h[1]) note(f, `a line ${b.h[0].toFixed(4)} m half wide, the picture wants ${want.toFixed(4)}`);
            if (b.h[2] !== a.h[2] || b.c.some((v: number, k: number) => v !== a.c[k])) note(f, 'a fitted line moved or changed length');
            if ([0, 1, 2].some(k => Math.abs(b.emissive[k] * b.h[0] - a.emissive[k] * a.h[0]) > 1e-6 * (1 + a.emissive[k]))) note(f, 'a fitted line does not carry the same light');
            if (!same) { n++; if (b.h[0] > 2 * a.h[0]) A.fat++; } }
          if (n) { A.thin++; A.thinMax = Math.max(A.thinMax, n); if (LB === dyn) note(f, 'fitted lines written into the step\'s own list'); }
          if (world.dynamics.length > before.length) A.ir++;
          g.fogBack();
          if (world.dynamics !== dyn) note(f, 'the step\'s list not handed back');
          if (dyn.length !== before.length || dyn.some((b: any, i: number) => b !== before[i] || `${b.h}|${b.emissive}` !== was[i])) note(f, 'the step\'s list or a box in it was written to');
          if (FW.bared) note(f, 'the fog left lifted');
        } else if (tube !== null) {   // (the viewer's tube: only the infrared lines change, and only in the drawn list)
          const eye = [...g.player.char.pos] as number[]; eye[1] = 1.2;
          const dyn = world.dynamics, before = dyn.slice(), nv = g.player.nv, k = g.player.nvAmount, irStep = before.filter(irMade).length, bare = tube && f % 2 === 0;
          const ray = (i: number) => { const a = i * 0.7 + f * 0.01, r = world.raycast(eye, [Math.sin(a), 0, Math.cos(a)], 30); return r ? `${r.t.toFixed(5)}:${r.index ?? ''}` : '-'; };
          const hits = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(ray).join(' ');
          g.fogLift(bare, tube); world.upload();
          const irNow = world.dynamics.filter(irMade).length;
          if (tube) { if (irStep) note(f, 'the step made infrared boxes with the run\'s goggles up'); if (irNow) { A.ir++; A.irMax = Math.max(A.irMax, irNow); if (world.dynamics === dyn) note(f, 'infrared boxes written into the step\'s own list'); } }
          else { if (irStep) { A.ir++; A.irMax = Math.max(A.irMax, irStep); } if (irNow) note(f, 'an infrared box drawn with the viewer\'s tube off'); if (world.dynamics.length !== before.length - irStep) note(f, 'more than the infrared boxes left out'); }
          hudExpireBubbles(g); g.fogBack();
          if (world.dynamics !== dyn) note(f, 'the step\'s list not handed back');
          if (dyn.length !== before.length || dyn.some((b: any, i: number) => b !== before[i])) note(f, 'the step\'s list was written to');
          if (g.player.nv !== nv || g.player.nvAmount !== k) note(f, 'the player\'s goggles were touched');
          if (FW.bared) note(f, 'the fog left lifted');
          if ([0, 1, 2, 3, 4, 5, 6, 7, 8].map(ray).join(' ') !== hits) note(f, 'a ray meets something else after the hand-back');
        } else if (lift) {
          const eye = [...g.player.char.pos] as number[]; eye[1] = 1.2;   // (the rays from where Sam stands now: the boxes the fog changes are round the team)
          const dyn = world.dynamics, before = dyn.slice(), on = FW.frame.on, hid = g.guards.filter((x: any) => FW.hidden(x)), marks = FW.lastSeen().length;
          const ray = (k: number) => { const a = k * 0.7 + f * 0.01, r = world.raycast(eye, [Math.sin(a), 0, Math.cos(a)], 30); return r ? `${r.t.toFixed(5)}:${r.index ?? ''}` : '-'; };
          const hits = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(ray).join(' ');
          g.fogLift(true, viewer ? null : true, viewer ? 0 : g.mPerPx * 6); world.upload();   // (the draw packs what it was handed: engine.render; with no viewer a tube and another pixel are asked for as well, and must add and fit nothing)
          if (!viewer && world.dynamics.some(irMade)) A.ir++;
          if (viewer && FW.active) { A.lifted++; A.hiddenMax = Math.max(A.hiddenMax, hid.length);
            if (g.guards.some((x: any) => FW.hidden(x))) note(f, 'a man still hidden to the HUD while lifted');
            if (FW.frame.on) note(f, 'the fog pass still on while lifted');
            if (FW.lastSeen().length) note(f, 'last-seen marks while lifted');
            if (world.dynamics === dyn) note(f, 'the renderer was handed the step\'s own list');
            if (world.dynamics.length > before.length) A.more++;
            if (FW.raw() === null) note(f, 'no list from before the fog was kept for this frame');
            if (FW.doorN) { const T: any[] = []; g.doors.boxes(T); const L = world.dynamics, k0 = FW.doorFrom;   // (leaves the fog draws where they were last seen: lifted, each stands where it is)
              if (T.some((b, i) => !L[k0 + i] || at(L[k0 + i]) !== at(b))) note(f, 'a door leaf not drawn where it stands while lifted');
              if (FW.doorN !== T.length || T.some((b, i) => at(before[k0 + i]) !== at(b))) A.doors++; }
            if (hid.length && world.dynamics.length < before.length) note(f, `fewer boxes lifted (${world.dynamics.length}) than fogged (${before.length})`);
          } else if (world.dynamics !== dyn || FW.bared) note(f, 'a lift with no viewer raised changed the picture');
          hudExpireBubbles(g);
          if (!BREAK) g.fogBack(); else { g.fogBack = function () { }; FW.bared = false; FW.frame.on = on; world.dynamics = dyn; g.fogHeld = null; }   // (BREAK: everything put back but the pack)
          if (world.dynamics !== dyn) note(f, 'the step\'s list not handed back');
          if (dyn.length !== before.length || dyn.some((b: any, i: number) => b !== before[i])) note(f, 'the step\'s list was written to');
          if ((FW.frame.on !== on || FW.bared || g.guards.filter((x: any) => FW.hidden(x)).length !== hid.length || FW.lastSeen().length !== marks)) note(f, 'the fog\'s own answers not put back');
          if ([0, 1, 2, 3, 4, 5, 6, 7, 8].map(ray).join(' ') !== hits) note(f, 'a ray meets something else after the hand-back');
        }
        if (f % 30 === 29) A.digests.push(hash(JSON.stringify(digestGame(g, true))));
      } });
    FW.viewer = false;
    return A;
  }
  const A = armArg === 'thin' ? await arm(false, true, true, false, true) : armArg === 'thinonly' ? await arm(false, true, null, true, true) : armArg === 'tube' ? await arm(false, true, true) : armArg === 'untube' ? await arm(false, true, false, true) : armArg === 'goggles' ? await arm(false, false, null, true) : await arm(armArg !== 'plain', armArg === 'lift');
  log('ARM ' + JSON.stringify(A));
  return true;
}
if (import.meta.main) process.exit((await replayfogCheck()) ? 0 : 1);
