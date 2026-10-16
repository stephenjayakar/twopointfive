// A DEFENDER STEPPING OFF AN OPEN DOORWAY STEPS TO COVER (doorway.ts offThreshold, DOORMANNERS.stepCover / planeDeg).
//   GLASSFX=on bun run tools/qa/doorway-step-check.ts [id …] [--door name] [--verbose] [--dump file]      exit 0 = every line PASS, 1 = a FAIL line
//   DOORSTEP_BREAK=1 in front = the rule held off in the arm that should have it: the check must FAIL
// Headless, the rule asked by itself (nothing here plays a fight): one defender is stood in each door of the level, the door open, and for every walkable
// place his man (or his fix) could be — a metre lattice over the level — `offThreshold` is run until he has stepped, once as a man with nobody in his
// sights (a fix, the pinned branch) and once, where he has the shot from the frame, as the man planted with it. Where he ended is then asked the
// question the rule is about, by this file's own lines: would a RIFLE at that place reach him there (chest or head), and only through glass?
//   up      rule OFF: counted, the steps that end MORE exposed to that rifle than the frame he stood in (covered < reached only through glass <
//           reached in clear air), and of them the ones from a covered frame to behind a window (the fault: it must be there to be mended; each
//           is asked again of the stack rule's own test, glasspen.ts shotThroughGlass). Rule ON: none.
//   worse   no run ends more exposed with the rule on than with it off (where he stood counts as where he ended), and some end less
//   frame   a frame reached in clear air: he steps off it whenever the old rule did (the rule never leaves a man in the open for a window's sake)
//   plane   them along the door's own wall (within planeDeg of it), nobody in his sights: steps to the face the half-plane calls THEIRS are
//           counted, and every one ends on covered floor (never out toward them into their fire)
//   same    planted with the shot in a frame reached in clear air — nothing for the rule to say — ON steps exactly where OFF does
//   squad   a teammate stood in the same doorways: ON steps exactly where OFF does (the rule is the defenders')
//   off     DOORMANNERS.fight off: nobody steps
export {};
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
process.env.GLASSFX ??= 'on';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORMANNERS, DOORMANNERS_STATS, offThreshold } = await import(`${ROOT}/src/game/doorway.ts`);
const { frameOf } = await import(`${ROOT}/src/game/guards.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { GLASSPEN, glassPenLive, shotThroughGlass } = await import(`${ROOT}/src/game/glasspen.ts`);
const fs = await import('node:fs');

const argv = process.argv.slice(2), BREAK = !!process.env.DOORSTEP_BREAK, VERBOSE = argv.includes('--verbose');
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; }, ONLY = opt('--door'), DUMP = opt('--dump');
const named = argv.filter((a, i) => !a.startsWith('--') && !['--door', '--dump'].includes(argv[i - 1]));
const IDS = named.length ? named : ['records-pair', 'room-clear-four', 'depot-four', 'warehouse-four', 'barracks-four', 'compound-four', 'rescue-registry', 'block-four', 'glasshouse-four'];
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: V) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const DT = 1 / 60;

log(`=== doorway-step-check: ${IDS.join(', ')}${BREAK ? ' (DOORSTEP_BREAK: the rule held off)' : ''} ===`);
const T = { trials: 0, upOff: 0, upOn: 0, glassOff: 0, glassAgree: 0, worse: 0, better: 0, frameLost: 0, toward: 0, towardHit: 0, same: 0, differ: 0, stayedOn: 0, stayedOff: 0, offStepped: 0, stray: 0, sqSame: 0, sqDiffer: 0, endOff: [0, 0, 0], endOn: [0, 0, 0] };
const shown: string[] = [], dump: string[] = [];
for (const id of IDS) {
  let S: any; try { S = await quiet(() => BT.stage(id, 1)); } catch (e) { all = false; log(`- FAIL — ${id} does not stage: ${(e as Error).message.slice(0, 120)}`); continue; }
  const g = S.g, col = g.col;
  if (!glassPenLive(g)) { all = false; log(`- FAIL — ${id}: rounds through glass are not live on this stand (GLASSFX=on in front)`); continue; }
  const H = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'); if (!H) { all = false; log(`- FAIL — ${id}: no defender to stand in a doorway`); continue; }
  for (const x of g.guards) if (x !== H && x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
  const OP = g.guards.find((x: any) => x.team === 'operative' && x.state !== 'dead');
  let far = 0; for (const x of g.guards) if (x !== H) { x.char.pos = [-80 - 3 * far++, 0, -80]; }   // (the squad and the bodies: off the floor, so no spot is 'taken')
  g.teleportPlayer([-80, 0, -90]); H.script = null; H.hold = false; const opScript = OP?.script;
  // every walkable place on a metre lattice
  const nav = col.nav, fixes: V[] = []; for (let x = 0.5; x < nav.W * nav.cell; x += 1) for (let z = 0.5; z < nav.H * nav.cell; z += 1) if (!nav.isBlocked(x, z)) fixes.push([x, 1.1, z]);
  /** how a man stood at p is exposed to a rifle at `from` (this file's own lines): 0 covered · 1 reached only through glass · 2 reached in clear air */
  const exposed = (from: V, p: V): number => { let e = 0; for (const y of [1.1, 1.5]) { const P = [p[0], y, p[2]]; if (col.shotBlocked(from, P, 0.02, GLASSPEN.stackEnergy)) continue; if (!col.solidBlocked(from, P)) return 2; e = 1; } return e; };
  for (const d of g.doors.list) {
    if (ONLY && d.def.name !== ONLY) continue;
    const F = frameOf(d), fc: V = [F.hx + F.ux * F.W / 2, 0, F.hz + F.uz * F.W / 2], K = DOORMANNERS;
    for (const o of g.doors.list) { o.angle = 0; o.vel = 0; o.latched = true; o.place(); }
    const open = Math.abs(d.maxA) > Math.abs(d.minA) ? d.maxA : d.minA; d.latched = false; d.angle = open * 0.95; d.vel = 0; d.place();
    if (Math.abs(d.angle) < 0.6) continue;
    const cands: { p: V; side: number }[] = []; for (const side of [1, -1]) for (const lat of [F.W + K.past, -K.past]) cands.push({ side, p: [F.hx + F.ux * lat + F.nx * side * K.through, 0, F.hz + F.uz * lat + F.nz * side * K.through] });
    /** one run of the rule: the candidate spot he stepped to (null = he stood) */
    const trial = (aim: V, needShot: boolean, who: any = H): { p: V; side: number } | null => {
      g.time += 6; const park = [...who.char.pos]; who.char.pos = [fc[0], 0, fc[2]]; who.speed = 0; who.char.vel = [0, 0, 0]; let stepped = false;
      for (let f = 0; f < 300; f++) { g.time += DT; if (offThreshold(g, who, aim, DT, needShot)) stepped = true; else if (stepped) break; }
      const end: V = [...who.char.pos]; if (who !== H) who.char.pos = park;
      if (!stepped) return null;
      const c = cands.slice().sort((a, b) => flat(a.p, end) - flat(b.p, end))[0]; if (flat(c.p, end) > 0.35) T.stray++; return c; };
    H.char.pos = [-80, 0, -70];
    let n = 0;
    for (const aim of fixes) {
      if (flat(aim, fc) < 2) continue;
      const off = (aim[0] - F.hx) * F.nx + (aim[2] - F.hz) * F.nz, sgn = off >= 0 ? 1 : -1;
      const hasShot = !col.shotBlocked([fc[0], 1.4, fc[2]], aim), eHere = exposed(aim, fc);
      for (const needShot of hasShot ? [false, true] : [false]) {
        K.stepCover = false; const a = trial(aim, needShot);
        K.stepCover = !BREAK; const b = trial(aim, needShot); K.stepCover = true;
        T.trials++; const ea = a ? exposed(aim, a.p) : eHere, eb = b ? exposed(aim, b.p) : eHere, sa = a ? at(a.p) : '-', sb = b ? at(b.p) : '-';
        if (DUMP) dump.push(`${id} ${d.def.name} ${at(aim)} ${needShot ? 'shot' : 'fix'} off=${sa} on=${sb}`);
        if (!a) T.stayedOff++; if (!b) T.stayedOn++; T.endOff[ea]++; T.endOn[eb]++;
        if (a && ea > eHere) { T.upOff++; if (ea === 1) { T.glassOff++; if ([1.1, 1.5].some(y => shotThroughGlass(g, [aim], [a.p[0], y, a.p[2]]) > 0)) T.glassAgree++;
          if (shown.length < 5 && !shown.some(x => x.startsWith(`${id} ${d.def.name}:`))) shown.push(`${id} ${d.def.name}: them at ${at(aim)}${needShot ? ' (in his sights)' : ' (a fix)'}, the frame covered from there — off: stepped to ${sa}, which a rifle there reaches through glass; on: ${b ? `${sb}, ${['covered', 'behind glass', 'in the open'][eb]}` : 'stays in the covered frame'}`); } }
        if (b && eb > eHere) T.upOn++;
        if (eb > ea) { T.worse++; if (VERBOSE) log(`    (worse) ${id} ${d.def.name} them ${at(aim)} ${needShot ? 'shot' : 'fix'}: off ${sa} e${ea}, on ${sb} e${eb}, frame e${eHere}`); } else if (eb < ea) T.better++;
        if (eHere === 2 && a && !b) T.frameLost++;
        if (b && b.side === sgn) { T.toward++; if (eb > 0) T.towardHit++; }
        if (needShot && eHere === 2) { if (sa === sb) T.same++; else { T.differ++; if (VERBOSE) log(`    (same) ${id} ${d.def.name} them ${at(aim)}: off ${sa} ≠ on ${sb}`); } }
        // the squad's man in the same frame, a sample: the rule is not his
        if (OP && !needShot && n++ % 5 === 0) { OP.script = null; K.stepCover = false; const x = trial(aim, false, OP); K.stepCover = true; const y = trial(aim, false, OP); OP.script = opScript; if ((x ? at(x.p) : '-') === (y ? at(y.p) : '-')) T.sqSame++; else T.sqDiffer++; }
      }
    }
    // the fight rule off: nobody steps
    K.fight = false; for (const aim of fixes.filter((_, i) => i % 37 === 0)) if (flat(aim, fc) >= 2 && trial(aim, false)) T.offStepped++; K.fight = true;
  }
}
if (DUMP) fs.writeFileSync(DUMP, dump.join('\n') + '\n');
for (const s of shown) log(`    e.g. ${s}`);
const ends = (e: number[]) => `${e[0]} covered · ${e[1]} behind glass · ${e[2]} in the open`;
verdict(T.trials > 500 && T.stray === 0, 'the rule was asked', `${T.trials} runs (a door × a place for his man × in his sights or not); he stood in the frame in ${T.stayedOff} with the rule off and ${T.stayedOn} with it on; ${T.stray} ended off every candidate spot`);
verdict(T.glassOff > 0 && T.glassAgree === T.glassOff, 'up, rule off: the fault is there', `${T.upOff} steps ended more exposed to a rifle at his man than the frame he left, ${T.glassOff} of them from a covered frame to behind a window (the stack rule's own test agrees on ${T.glassAgree})`);
verdict(T.upOn === 0, 'up, rule on: no step ends more exposed than the frame he left', `${T.upOn} such steps (off ${T.upOff})`);
verdict(T.worse === 0 && T.better > 0, 'worse: no run ends more exposed with the rule than without', `${T.worse} worse, ${T.better} better. Where the runs ended — off: ${ends(T.endOff)}; on: ${ends(T.endOn)}`);
verdict(T.frameLost === 0, 'frame: in a frame reached in clear air he steps whenever the old rule stepped', `${T.frameLost} runs where the old rule got him off such a frame and the new one left him in it`);
verdict(T.towardHit === 0 && (!!ONLY || T.toward > 0), 'plane: the face the half-plane calls theirs only under cover', `${T.toward} steps to that face (them along the door's wall, within ${DOORMANNERS.planeDeg}°), ${T.towardHit} of them anywhere a rifle at them reaches`);
verdict(T.differ === 0 && (!!ONLY || T.same > 100), 'same: planted with the shot in an open frame, the step is the old step', `${T.same} runs equal, ${T.differ} differ`);
verdict(T.sqDiffer === 0 && (!!ONLY || T.sqSame > 100), 'squad: a teammate in the same doorways steps as he did', `${T.sqSame} runs equal, ${T.sqDiffer} differ`);
verdict(T.offStepped === 0, 'off: with the fight rule off nobody steps', `${T.offStepped} steps`);
log(`    (counters: stepCover ${DOORMANNERS_STATS.stepCover} · stepGlass ${DOORMANNERS_STATS.stepGlass})`);
log(all ? '=== doorway-step-check: ALL PASS ===' : '=== doorway-step-check: FAIL ===');
process.exit(all ? 0 : 1);
