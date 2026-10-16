// A DOOR THE SQUAD WORKS IS SEEN (src/game/fogofwar.ts FOG.squadDoors) — the maintainer, 10-11: "if teammates open a door to clear a room while you're not
// looking at it, their movement is visible, but it looks like they're walking through a closed door. we should be able to see actions that our squad takes."
//
//   bun run tools/qa/squaddoors-check.ts [level.json] [--doors N] [--seed N] [--verbose] [--trace]      (probes.ts squaddoors; SQUADDOORS_BREAK=1 = the rule left off: must fail)
//   (--seed = the check's own dice, 1; --trace = --verbose + who stood at the doorway each time a leaf was drawn stale there)
//
// Played: a room clear with the four, the fog on, Sam stood at his start with his back to the door, 'open and clear' ordered on a door — under hard's cones
// and under 'only my own eyes', the rule off (the fault: men walk past a leaf the picture still has shut) and on (never).
// Staged: a leaf opened with no teammate near stays as the picture had it; a teammate within reach with a line brings it up to date whichever way he faces;
// one within reach behind a wall does not, nor one a metre past the reach with a line, nor a dazzled one at the leaf; the switch off = only the fog's own
// eyes; the stand's word.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The check's own dice. A harness Game draws Math.random, and the probe runner leaves Math.random wherever the probe before left it — so the played runs
 *  below used to be another deal alone, in the family and under another runner. Each staging here starts from the same seed (`--seed N`, 1). */
const dice = (a: number) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export async function squaddoorsCheck(): Promise<boolean> {
  const was = Math.random;
  try { return await check(); } finally { Math.random = was; }
}

async function check(): Promise<boolean> {
  const DT = 1 / 60, argv = process.argv.slice(2), file = argv.find(a => a.endsWith('.json')) ?? 'records.json';
  const nDoors = Number(argv[argv.indexOf('--doors') + 1]) > 0 && argv.includes('--doors') ? Number(argv[argv.indexOf('--doors') + 1]) : 3, verbose = argv.includes('--verbose') || argv.includes('--trace'), trace = argv.includes('--trace');
  const seed = argv.includes('--seed') && Number.isFinite(Number(argv[argv.indexOf('--seed') + 1])) ? Number(argv[argv.indexOf('--seed') + 1]) : 1;
  /** a man this near the doorway's middle is AT it: what walking through a leaf is counted by, and where a stale leaf is the fault and not the fog's memory */
  const AT_M = 1.0;
  /** a leaf drawn this far (rad, about nine degrees) from where it stands is drawn WRONG to an eye; less is a leaf settling on its stop behind the wall it swung to */
  const OFF_RAD = 0.15;
  const BREAK = process.env.SQUADDOORS_BREAK === '1';
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const log = console.log;
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
  let fails = 0;
  const verdict = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (detail) log(`    ${detail}`); };

  // ---- the stand's word (asked first: everything after sets the switch itself)
  const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_SQUADDOORS;
  const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  Math.random = dice(seed);
  const W: any = await quiet(() => standUp({ level: lvl })); const g = W.game; g.godMode = true;
  { const want = frozen || word !== undefined ? word === '1' : true, row = FROZEN_HOLDS['FOG.squadDoors'];
    verdict(FOG.squadDoors === want && typeof row === 'string' && /TPS_SQUADDOORS=1/.test(row) && STAND_ENV.includes('TPS_SQUADDOORS'),
      frozen ? 'the frozen stand holds the rule off unless TPS_SQUADDOORS=1 (the cursor\'s ray meets a leaf as drawn), and the row is on the list of what separates the stands' : 'the shipped stand has the rule on, as the page does',
      `after standUp: ${FOG.squadDoors} · TPS_SQUADDOORS ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · FROZEN_HOLDS['FOG.squadDoors'] ${row ?? '—'}`); }

  await quiet(() => startFromQuery(g, new URLSearchParams('roomclear&squad4')));
  const FW = g.fogOfWar; FW.on = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
  await quiet(() => step(30));
  const spawn = [...g.player.char.pos] as number[];
  const mid = (d: any) => [d.def.hinge[0] + Math.cos(d.def.closedDir) * d.def.width / 2, d.def.hinge[1] + Math.sin(d.def.closedDir) * d.def.width / 2];
  const fresh = (cone: boolean, own: boolean, rule: boolean) => quiet(() => { Math.random = dice(seed); g.restartEncounter(); FW.on = true; FOG.cone = cone; FOG.own = own; FOG.squadDoors = rule; step(30); });
  const holdFoes = () => { for (const gd of g.guards) if (gd.team !== 'operative') { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; } };
  const samAway = (d: any) => { const [mx, mz] = mid(d), c = g.player.char; c.pos[0] = spawn[0]; c.pos[2] = spawn[2]; c.aimYaw = c.bodyYaw = Math.atan2(-(mx - spawn[0]), -(mz - spawn[2])); };

  // ---- played: the order, Sam's back turned
  // A leaf drawn stale is counted twice: IN ALL (any frame the picture has it somewhere it no longer stands) and AT THE DOORWAY (those frames with a living
  // man of the order within AT_M of the doorway's middle AND the leaf drawn more than OFF_RAD from where it stands: with less, a leaf bouncing on its stop
  // out of the passing man's sight sat a hundredth of a radian off for a fifth of a second and was counted as the fault). The bound is on the second. The first also counts a leaf that moves with nobody of the team in
  // reach — a closer swinging it to behind men who have gone on into the room — which is the fog remembering a door as it should, for as long as nobody looks.
  /** (--trace) has this man a line from his head to a point of the leaf, where it stands or where the picture has it: the rule's own question, asked for the log only */
  const sees = (m: any, d: any) => { const from = m.char.bones?.head ?? [m.char.pos[0], 1.6, m.char.pos[2]];
    for (const ang of [d.angle, FW.doorShown(d)]) { const a = d.def.closedDir + ang; for (const f of [0.95, 0.6, 0.25]) for (const y of [1.0, 1.8]) {
      const p = [d.def.hinge[0] + Math.cos(a) * d.def.width * f, y, d.def.hinge[1] + Math.sin(a) * d.def.width * f]; const L = Math.hypot(p[0] - from[0], p[1] - from[1], p[2] - from[2]); if (L < 0.3) return true;
      const k = 1 - 0.12 / L; if (!g.col.segmentBlocked(from, [from[0] + (p[0] - from[0]) * k, from[1] + (p[1] - from[1]) * k, from[2] + (p[2] - from[2]) * k])) return true; } }
    return false; };
  interface Tally { ordered: number; opened: number; stale: number; worst: number; at: number; atWorst: number; crossed: number; doors: string[] }
  async function play(cone: boolean, own: boolean, rule: boolean, names: string[]): Promise<Tally> {
    const T: Tally = { ordered: 0, opened: 0, stale: 0, worst: 0, at: 0, atWorst: 0, crossed: 0, doors: [] };
    for (const name of names) {
      await fresh(cone, own, rule);
      const d = g.doors.byName(name), men = g.orders.men('all'); if (!d || men.length < 2) continue;
      const side = g.doors.side(d, men[0].char.pos) >= 0 ? 1 : -1; samAway(d);
      const op: any = await quiet(() => g.doorTools.order('openClear', men, d, side)); if (typeof op === 'string') continue;
      T.ordered++; const [mx, mz] = mid(d); const was = new Map<any, number>(men.map((m: any) => [m, g.doors.side(d, m.char.pos) >= 0 ? 1 : -1]));
      let run = 0, worst = 0, held = 0, at = 0, atRun = 0, atWorst = 0, cross = 0, opened = false; const notes: string[] = [];
      await quiet(() => { for (let f = 0; f < 60 * 30; f++) { holdFoes(); samAway(d); W.step(DT);
        if (Math.abs(d.angle) > 0.3) opened = true;
        const h = FW.doorHeld(d); if (h) { held++; run++; worst = Math.max(worst, run); } else run = 0;
        const near = h && Math.abs(d.angle - FW.doorShown(d)) > OFF_RAD ? men.filter((m: any) => m.state !== 'dead' && Math.hypot(m.char.pos[0] - mx, m.char.pos[2] - mz) < AT_M) : [];
        if (near.length) { at++; atRun++; atWorst = Math.max(atWorst, atRun);
          if (trace && (atRun === 1 || atRun % 6 === 0)) notes.push(`f ${f} (run ${atRun}) leaf ${d.angle.toFixed(2)} drawn ${FW.doorShown(d).toFixed(2)} vel ${(d.vel ?? 0).toFixed(2)} · ` + near.map((m: any) => `${m.callsign ?? m.name} ${Math.hypot(m.char.pos[0] - mx, m.char.pos[2] - mz).toFixed(2)} m side ${g.doors.side(d, m.char.pos) >= 0 ? '+' : '-'}${g.time < m.dazzledUntil ? ' DAZZLED' : ''} line ${sees(m, d) ? 'yes' : 'no'}`).join(', ')); }
        else atRun = 0;
        for (const m of men) { const s = g.doors.side(d, m.char.pos) >= 0 ? 1 : -1;
          if (s !== was.get(m) && Math.hypot(m.char.pos[0] - mx, m.char.pos[2] - mz) < AT_M && h && Math.abs(FW.doorShown(d)) < 0.3) cross++;
          was.set(m, s); } } });
      if (!opened) continue;
      T.opened++; T.stale += held; T.worst = Math.max(T.worst, worst); T.at += at; T.atWorst = Math.max(T.atWorst, atWorst); T.crossed += cross;
      T.doors.push(`${name}: drawn stale with a man at the doorway ${at} frames (longest ${(atWorst / 60).toFixed(2)} s) · in all ${held} frames (longest ${(worst / 60).toFixed(2)} s) · men through a leaf drawn shut ${cross}`);
      for (const n of notes) T.doors.push(`    ${name} ${n}`);
    }
    return T;
  }
  const all = g.doors.list.map((d: any) => d.def.name as string);
  // (the doors the order can be given on from the start, the first few: found once, with the fog's eyes as on standard)
  const names: string[] = [];
  for (const name of all) { if (names.length >= nDoors) break; await fresh(false, false, false); const d = g.doors.byName(name), men = g.orders.men('all'); if (Math.abs(d.angle) > 0.05 || men.length < 2) continue;
    const op: any = await quiet(() => g.doorTools.order('openClear', men, d, g.doors.side(d, men[0].char.pos) >= 0 ? 1 : -1)); if (typeof op !== 'string') names.push(name); }
  log(`${file}: 'open and clear' by the four on ${names.join(', ')} · Sam at his start, back to the door`);
  for (const [label, cone, own] of [['hard\'s cones', true, false], ['only my own eyes', false, true]] as const) {
    const off = await play(cone, own, false, names), on = await play(cone, own, !BREAK, names);
    if (verbose) { for (const x of off.doors) log(`    off · ${x}`); for (const x of on.doors) log(`    on  · ${x}`); }
    const row = (t: Tally) => `${t.opened} doors opened · drawn stale with a man at the doorway ${t.at} frames, longest ${(t.atWorst / 60).toFixed(2)} s · in all ${t.stale} frames, longest ${(t.worst / 60).toFixed(2)} s · men through a leaf drawn shut ${t.crossed}`;
    verdict(on.opened > 0 && on.crossed === 0 && on.atWorst <= 12, `${label}: with the rule no teammate walks through a leaf the picture has shut, and no leaf is drawn stale for more than a fifth of a second with a teammate at its doorway`,
      `rule on:  ${row(on)}`);
    log(`    rule off: ${row(off)}${off.crossed ? '' : '   (the fault did not show on these doors under this fog)'}`);
    if (label === 'only my own eyes') verdict(off.crossed > 0 || off.worst > 30, 'only my own eyes, the rule off: the fault is there to fix (a leaf drawn shut while the men go through)', `longest stale ${(off.worst / 60).toFixed(2)} s · through a leaf drawn shut ${off.crossed}`);
  }

  // ---- staged: who brings a leaf up to date
  { const col = g.col, HEAD = 1.6;
    const leafPts = (d: any, ang: number) => { const out: number[][] = [], a = d.def.closedDir + ang; for (const f of [0.95, 0.6, 0.25]) for (const y of [1.0, 1.8]) out.push([d.def.hinge[0] + Math.cos(a) * d.def.width * f, y, d.def.hinge[1] + Math.sin(a) * d.def.width * f]); return out; };
    const openA = (d: any) => (d.maxA > 0.5 ? 1 : -1) * Math.min(1.2, Math.max(Math.abs(d.maxA), Math.abs(d.minA)));
    const lineTo = (from: number[], p: number[]) => { const L = Math.hypot(p[0] - from[0], p[1] - from[1], p[2] - from[2]); if (L < 0.3) return true; const k = 1 - 0.12 / L; return !col.segmentBlocked(from, [from[0] + (p[0] - from[0]) * k, from[1] + (p[1] - from[1]) * k, from[2] + (p[2] - from[2]) * k]); };
    const nav = g.col.nav ?? g.nav; const walk = (x: number, z: number) => { const cx = Math.floor(x / nav.cell), cz = Math.floor(z / nav.cell); return cx >= 0 && cz >= 0 && cx < nav.W && cz < nav.H && !nav.blocked[cz * nav.W + cx]; };
    /** stage: the door opened by nobody, Sam away, the men where `place` puts the first of them (the rest far), facing `yaw` */
    const stage = async (d: any, rule: boolean, place: number[] | null, yaw = 0, shut = false, dazzled = false) => { await fresh(true, true, rule); const men = g.orders.men('all'); samAway(d);
      const seg = col.segmentBlocked; if (shut && place) col.segmentBlocked = (a: number[], b: number[], ...r: any[]) => Math.hypot(a[0] - place[0], a[2] - place[1]) < 0.6 ? true : seg.call(col, a, b, ...r);   // (every line from where he stands shut, as a wall would)
      await quiet(() => { for (let f = 0; f < 8; f++) { holdFoes(); samAway(d); if (f === 2) { d.angle = openA(d); d.vel = 0; }
        if (place) { const c = men[0].char; c.pos[0] = place[0]; c.pos[2] = place[1]; c.aimYaw = c.bodyYaw = yaw; if (dazzled) men[0].dazzledUntil = g.time + 5; }
        W.step(DT); } });
      col.segmentBlocked = seg;
      const near = Math.min(...men.map((m: any) => Math.min(...leafPts(d, d.angle).concat(leafPts(d, 0)).map(p => Math.hypot(m.char.pos[0] - p[0], m.char.pos[2] - p[2])))));
      return { held: FW.doorHeld(d) as boolean, angle: d.angle as number, near, men }; };
    // a door none of the team stands within 4 m of at the start
    const far = all.map((n: string) => g.doors.byName(n)).filter((d: any) => Math.abs(d.angle) < 0.05);
    let done = false;
    for (const d of far) {
      const a = await stage(d, true, null); if (a.near < 4 || Math.abs(a.angle) < 0.3) continue;
      const [mx, mz] = mid(d), nx = -Math.sin(d.def.closedDir), nz = Math.cos(d.def.closedDir);
      // a place in front of the doorway with a line to the leaf, and one within reach with none
      let front: number[] | null = null, blind: number[] | null = null; const pts = leafPts(d, openA(d)).concat(leafPts(d, 0));
      for (const s of [1, -1]) for (const r of [1.2, 1.0, 1.5]) { const p = [mx + nx * s * r, mz + nz * s * r]; if (!front && walk(p[0], p[1]) && pts.some(q => lineTo([p[0], HEAD, p[1]], q))) front = p; }
      for (let ix = -24; ix <= 24 && !blind; ix++) for (let iz = -24; iz <= 24 && !blind; iz++) { const p = [mx + ix * 0.125, mz + iz * 0.125]; if (!walk(p[0], p[1])) continue;
        const reach = Math.min(...pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[2]))); if (reach > FOG.squadDoorsM - 0.15 || reach < 0.5) continue;
        if (pts.every(q => !lineTo([p[0], HEAD, p[1]], q) && !lineTo([p[0], 1.75, p[1]], q) && !lineTo([p[0], 1.45, p[1]], q))) blind = p; }
      if (!front) continue;
      const awayYaw = Math.atan2(front[0] - mx, front[1] - mz);   // (his back to the door)
      const b = await stage(d, !BREAK, front, awayYaw), c = await stage(d, false, front, awayYaw);
      verdict(a.held, `${d.def.name} opened with no teammate within four metres and Sam's back turned: the picture keeps the leaf where it had it, rule on`, `nearest teammate ${a.near.toFixed(1)} m · leaf at ${a.angle.toFixed(2)} rad · drawn as remembered ${a.held}`);
      verdict(!b.held && b.near <= FOG.squadDoorsM, 'a teammate within reach of the leaf with a line to it, his back to it, under cones and own eyes: the leaf is drawn where it stands', `teammate ${b.near.toFixed(2)} m from the leaf · drawn as remembered ${b.held}`);
      verdict(c.held, 'the same with the switch off: only the fog\'s own eyes bring a leaf up to date, as before', `teammate ${c.near.toFixed(2)} m from the leaf · drawn as remembered ${c.held}`);
      const e = await stage(d, true, blind ?? front, blind ? 0 : awayYaw, !blind);
      verdict(e.held && e.near <= FOG.squadDoorsM, blind ? 'a teammate within reach but with a wall between him and the leaf does not see it move' : 'a teammate within reach with every line from him to the leaf shut (by hand: this door has no place within reach behind a wall) does not see it move',
        `teammate ${e.near.toFixed(2)} m from the leaf at (${(blind ?? front)[0].toFixed(1)}, ${(blind ?? front)[1].toFixed(1)}) · drawn as remembered ${e.held}`);
      // THE BOUND (the fog thread's read, 10-11): the rule reaches `squadDoorsM` and no further — a teammate a metre past it with a clear line, facing the
      // leaf, is no eye of the fog's under 'only my own eyes' and does not bring it up to date (what keeps a door an enemy opens across a room hidden)
      let past: number[] | null = null;
      for (let ix = -32; ix <= 32 && !past; ix++) for (let iz = -32; iz <= 32 && !past; iz++) { const p = [mx + ix * 0.125, mz + iz * 0.125]; if (!walk(p[0], p[1])) continue;
        const reach = Math.min(...pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[2]))); if (reach < FOG.squadDoorsM + 0.8 || reach > FOG.squadDoorsM + 1.3) continue;
        if (pts.some(q => lineTo([p[0], HEAD, p[1]], q))) past = p; }
      if (past) { const f = await stage(d, true, past, Math.atan2(mx - past[0], mz - past[1]));
        verdict(f.held && f.near > FOG.squadDoorsM, 'the bound: a teammate a metre past the reach with a clear line to the leaf, facing it, under own eyes, does not bring it up to date', `teammate ${f.near.toFixed(2)} m from the leaf (reach ${FOG.squadDoorsM} m) · drawn as remembered ${f.held}`); }
      else log('    (no floor a metre past the reach with a line to this leaf: the bound is not staged on this door)');
      // a blinded teammate is nobody's eyes: at the leaf, with the line the second check above had, dazzled
      { const h = await stage(d, true, front, awayYaw, false, true);
        verdict(h.held && h.near <= FOG.squadDoorsM, 'a dazzled teammate within reach of the leaf with a line to it does not bring it up to date', `teammate ${h.near.toFixed(2)} m from the leaf, dazzled · drawn as remembered ${h.held}`); }
      done = true; break;
    }
    if (!done) verdict(false, 'a door none of the team starts near, with floor in front of it, was found to stage the lines on');
  }
  log(fails ? `\n=== squaddoors: ${fails} FAIL ===` : '\n=== squaddoors: ALL PASS ===');
  return fails === 0;
}
if (import.meta.main) process.exit((await squaddoorsCheck()) ? 0 : 1);
