// The 'frameholds' family: A FRAME HOLDS A BOOT FROM THE FACE ITS DOOR OPENS TOWARD (src/game/doors.ts DOORWAY.frameHolds; the maintainer, 10-08: "for doors just make
// it realistic"). A shut leaf rests on its frame's stop on the face it opens toward: a boot there does not open it — and, the same fact from inside, a wedge or a
// dragged desk holds only a door that swings toward the man who put it there (src/game/digin.ts).
//   bun run tools/qa/probes.ts frameholds | frameholds-boot | frameholds-tools | frameholds-sam | frameholds-wedge
// All headless; nothing here looks at a picture. EVERY LINE IS RUN TWICE — the switch on, and the same staging with it off — and passes only when the rule holds
// with it on AND the old behaviour shows with it off (so each line is seen failing without the rule: the detail prints both arms).
//   frameholds-boot    the Doors alone, every door of every played level: a boot at the face a shut leaf opens toward leaves it home, the lock thrown, the keep
//                      whole, a loud thud heard as a door noise (off: flung ≥ 1 rad toward the kicker, the keep torn out); from the push face it opens as ever in
//                      both arms; steel rings as ever; the `lock` argument (a charge, a breaching round) destroys the lock from that face without driving the
//                      leaf, and a hand then pulls it; a showcase on the stage and the double-acting leaves never see the rule
//   frameholds-tools   the squad's door tools on the office (the manager's door hung the other way, so its locked face is the one it opens toward): 'open and
//                      clear' by a LOUD squad picks the cylinder and goes in — no boot, nothing broken (off: the boot); a keypad door there greys the entry rows
//                      with the reason and the order is refused in the same words, the charge row still live, the words changing when no charge is left (off:
//                      taken, booted); a lock no pick opens thrown while they walk ends the order at the door; a shared gate does not wait for a boot that will
//                      not come; from the push face the boot as ever; a charge set on that face still opens it
//                      (the two charge lines and the words with a charge already set run with the switch on only: what they hold is that the rule
//                      leaves a charge its way in. NOT staged here: a picker with a hostile in his sights, a picker shot at the lock, an order cancelled
//                      mid-pick, a real shared gate — the pick's own machinery, silent-pick's lines)
//   frameholds-sam     the player: his kick row on that face is greyed with the reason and a tap on it starts no kick; the pick row still works; a sprint into
//                      it starts no kick (off: the row live, the sprint a kick, the keep torn out); from the push face his rows as ever
//   frameholds-wedge   the last three defenders of the compound ordered into one room (a last stand wedges any door of its room), that room's doors hung to open
//                      OUT of it: nobody wedges one and each door passed over is counted (off: wedged all the same); hung to open INTO it: wedged as ever
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { tapVerb } from './verbs.ts';
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { isOfficeFamily, withOfficeScript } = await import(`${ROOT}/src/scene/level.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LASTSTAND, lastStandReport } = await import(`${ROOT}/src/game/laststand.ts`);
const { SILENT, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);
const { DIGIN, DIGIN_STATS, DIGIN_SHUT, DIGIN_LOG, digInWedged } = await import(`${ROOT}/src/game/digin.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const KEEP = { DOORWAY: { ...DOORWAY }, DOORBLAST: clone(DOORBLAST), DOORTOOLS: clone(DOORTOOLS), NIGHTBREACH: { ...NIGHTBREACH }, LASTSTAND: { ...LASTSTAND }, SILENT: clone(SILENT) };
const reset = () => { Object.assign(DOORWAY, KEEP.DOORWAY); Object.assign(DOORBLAST, clone(KEEP.DOORBLAST)); Object.assign(DOORTOOLS, clone(KEEP.DOORTOOLS)); Object.assign(NIGHTBREACH, KEEP.NIGHTBREACH); Object.assign(LASTSTAND, KEEP.LASTSTAND); Object.assign(SILENT, clone(KEEP.SILENT)); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
/** the rule's two arms: the one-way doors as shipped, the frame holding — or not */
const arm = (on: boolean) => { DOORWAY.oneWay = true; DOORWAY.frameHolds = on; };
const ARMS = [true, false] as const;

const LEVELS: (string | undefined)[] = [undefined, ...new Set<string>(SCENARIOS.map((e: any) => e.level).filter(Boolean))];
const nameOf = (f?: string) => f ? f.replace(/\.json$/, '') : 'office';
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
async function boot(file?: string): Promise<any> { Math.random = seeded(7); return quiet(() => standUp({ uploadEvery: 4, ...(file ? { level: levelOfFile(file) } : {}) })); }
/** a point off a door's face: `along` m from the hinge along the closed leaf, `o` m out of face `f` (Doors.side's sign) */
const off = (d: any, f: number, o: number, along = d.def.width * 0.55): [number, number, number] => { const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c); return [d.def.hinge[0] + ux * along - uz * o * f, 0, d.def.hinge[1] + uz * along + ux * o * f]; };
/** the face (Doors.side's sign) a shut door opens TOWARD */
const pullSide = (g: any, d: any): 1 | -1 => g.doors.pullFace(d, off(d, 1, 0.8)) ? 1 : -1;
/** hang the door so the face `f` is the one it opens toward */
const hangToward = (g: any, d: any, f: number) => { if (pullSide(g, d) !== f) d.setSwing(-d.swing as 1 | -1); };
const fresh = (d: any, lock = false) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.locked = lock; d.place(); };
const man = (d: any, f: number, o: number, over: any = {}) => ({ pos: off(d, f, o), radius: 0.34, bash: false, who: 10, quiet: false, key: true, ...over });

// ---------------------------------------------------------------- frameholds-boot
export const frameholdsBoot = guarded(async () => {
  const F = family('frameholds-boot: a boot at the face a shut door opens toward — every door of every played level');
  interface Tot { n: number; held: number; opened: number; pushOk: number; pushN: number; lockArg: number; pulled: number; walked: number; steel: number; steelOk: number; bad: string[] }
  const tot = (): Tot => ({ n: 0, held: 0, opened: 0, pushOk: 0, pushN: 0, lockArg: 0, pulled: 0, walked: 0, steel: 0, steelOk: 0, bad: [] });
  const T = { on: tot(), off: tot() };
  let staged = { n: 0, flung: 0 }, twoWay = { n: 0, flung: 0 };
  for (const file of LEVELS) for (const on of ARMS) {
    arm(on); const g = (await boot(file)).game, R = on ? T.on : T.off;
    let heard: { sound: string; level: number }[] = []; const emit0 = g.doors.emit; g.doors.emit = (e: any) => { heard.push({ sound: e.sound, level: e.level }); emit0(e); };
    const run = (d: any, men: any[], secs: number) => { let widest = 0; for (let t = 0; t < secs; t += DT) { g.doors.update(DT, men); widest = Math.max(widest, Math.abs(d.angle)); } return widest; };
    for (const d of g.doors.list) {
      const pf = pullSide(g, d), where = `${nameOf(file)} ${d.def.name}`;
      if (d.def.steel) { for (const f of [1, -1]) { fresh(d, true); heard = []; const c = man(d, f, 0.76); g.doors.kickIn(d, c.pos, c.who); const w = run(d, [c], 1.0); R.steel++; if (w < 0.01 && d.locked && !d.lockBroken && heard.some(h => h.sound === 'clang')) R.steelOk++; else R.bad.push(`${where}: steel did not ring and hold`); } fresh(d, !!d.def.locked); continue; }
      // (1) the boot from the face it opens toward, the lock thrown
      { fresh(d, true); heard = []; const k = g.doors.kickSpot(d, off(d, pf, 0.8)), c = man(d, pf, 0.76, { pos: k.pos }); const gave = g.doors.kickIn(d, c.pos, c.who); const w = run(d, [c], 1.2); R.n++;
        const thud = heard.find(h => h.sound === 'thud');
        if (!gave && w < 0.01 && d.locked && !d.lockBroken && d.latched && thud && thud.level >= 1 && !heard.some(h => h.sound === 'kick')) R.held++;
        else if (gave && w >= 1.0 && d.lockBroken && !d.locked && heard.some(h => h.sound === 'kick')) R.opened++;
        else R.bad.push(`${where}: pull-face boot → open ${f2(w)}, locked ${d.locked}, keep broken ${d.lockBroken}, heard ${heard.map(h => h.sound).join(',')}`); }
      // (2) …and from the face it opens away from: the boot as ever
      { fresh(d, true); heard = []; const k = g.doors.kickSpot(d, off(d, -pf, 0.8)), c = man(d, -pf, 0.76, { pos: k.pos }); const gave = g.doors.kickIn(d, c.pos, c.who); const w = run(d, [c], 1.2); R.pushN++;
        if (gave && w >= 1.0 && d.lockBroken && !d.locked && heard.some(h => h.sound === 'kick') && !heard.some(h => h.sound === 'thud')) R.pushOk++; else R.bad.push(`${where}: push-face boot → open ${f2(w)}, keep broken ${d.lockBroken}`); }
      // (3) the lock itself destroyed from the face it opens toward (kickIn's `lock`): the keep gone, the leaf not driven — two seconds on (it has clicked back
      //     onto its latch by then) it is locked against neither face, and a hand pulls it from this one / a man walks it open from the other
      { fresh(d, true); heard = []; const c = man(d, pf, 0.9); const gave = g.doors.kickIn(d, c.pos, c.who, true); const w = run(d, [], 2.0);
        const gone = gave && d.lockBroken && !d.locked && !g.doors.lockedOut(d, off(d, 1, 0.8)) && !g.doors.lockedOut(d, off(d, -1, 0.8));
        if (on ? gone && w < 0.01 : gone && w >= 1.0) R.lockArg++; else R.bad.push(`${where}: lock destroyed from its pull face → gave ${gave}, open ${f2(w)}, keep broken ${d.lockBroken}, locked ${d.locked}`);
        if (on) { g.doors.pull(d, c.who); const w2 = run(d, [c], 1.5); if (w2 >= 0.9) R.pulled++; else R.bad.push(`${where}: its lock gone, a hand pulled it only to ${f2(w2)}`);
          fresh(d, true); g.doors.kickIn(d, off(d, pf, 0.9), 10, true); run(d, [], 2.0); const p = man(d, -pf, 0.5, { key: false }); let w3 = 0; for (let t = 0; t < 2.5; t += DT) { p.pos = off(d, -pf, Math.max(-0.6, 0.5 - t * 1.2)); g.doors.update(DT, [p]); w3 = Math.max(w3, Math.abs(d.angle)); }
          if (w3 >= 0.5) R.walked++; else R.bad.push(`${where}: its lock gone, a keyless man walking at its push face opened it only to ${f2(w3)}`); } }
      fresh(d, !!d.def.locked);
    }
    // a showcase on the stage, and the double-acting leaves: the rule is not there (the switch ON)
    if (on && file === undefined) {
      const was = g.doors.staged; g.doors.staged = () => true;
      for (const d of g.doors.list) { if (d.def.steel) continue; const pf = pullSide(g, d); fresh(d, true); const c = man(d, pf, 0.76); const held = g.doors.bootHolds(d, c.pos); g.doors.kickIn(d, c.pos, c.who); const w = run(d, [c], 1.2); staged.n++; if (!held && w >= 1.0 && d.lockBroken) staged.flung++; fresh(d, !!d.def.locked); }
      g.doors.staged = was; DOORWAY.oneWay = false;
      for (const d of g.doors.list) { if (d.def.steel) continue; const pf = pullSide(g, d); fresh(d, true); const c = man(d, pf, 0.76); const held = g.doors.bootHolds(d, c.pos); g.doors.kickIn(d, c.pos, c.who); const w = run(d, [c], 1.2); twoWay.n++; if (!held && w >= 1.0 && d.lockBroken) twoWay.flung++; fresh(d, !!d.def.locked); }
      DOORWAY.oneWay = true;
    }
    g.doors.emit = emit0;
  }
  const A = T.on, B = T.off, bads = (R: Tot) => R.bad.length ? `\n    WRONG: ${R.bad.slice(0, 6).join('; ')}${R.bad.length > 6 ? ` … and ${R.bad.length - 6} more` : ''}` : '';
  F.verdict(A.n > 0 && A.held === A.n && B.n === A.n && B.opened === B.n,
    'a boot at the face a shut, locked door opens toward: kickIn answers that it did not give — the leaf stays home, the lock thrown, the keep whole, a thud at level 1 and no kick — and with the switch off every one of them flies open with its keep torn out',
    `on: ${A.held} of ${A.n} held (${A.opened} opened) · off: ${B.opened} of ${B.n} opened ≥ 1.0 rad, keep broken (${B.held} held) — ${LEVELS.length} levels${bads(A)}${bads(B)}`);
  F.verdict(A.pushOk === A.pushN && B.pushOk === B.pushN && A.pushN === A.n, 'the same boot from the face it opens away from: open ≥ 1.0 rad, the keep torn out, a kick heard — the same in both arms', `on: ${A.pushOk} of ${A.pushN} · off: ${B.pushOk} of ${B.pushN}`);
  F.verdict(A.lockArg === A.n && A.pulled === A.n && A.walked === A.n && B.lockArg === B.n, "kickIn's `lock` (a charge, a breaching round) from the face it opens toward: the keep gone, the leaf not driven and locked against neither face two seconds on; a hand then pulls it open, and a keyless man walks it open from the other face — off, the argument changes nothing (it is flung)",
    `on: lock destroyed, leaf home ${A.lockArg} of ${A.n}; then pulled open ${A.pulled} of ${A.n}; walked open from the far face ${A.walked} of ${A.n} · off: flung as a boot ${B.lockArg} of ${B.n}`);
  F.verdict(A.steelOk === A.steel && B.steelOk === B.steel && A.steel > 0, 'steel rings and holds from both faces as ever, in both arms', `on: ${A.steelOk} of ${A.steel} · off: ${B.steelOk} of ${B.steel}`);
  F.verdict(staged.n > 0 && staged.flung === staged.n && twoWay.flung === twoWay.n, 'the switch on, but a showcase on the stage — or the double-acting leaves: bootHolds says no and the boot opens it as it always did', `staged: ${staged.flung} of ${staged.n} flung · two-way: ${twoWay.flung} of ${twoWay.n} flung`);
  return F.done();
});

// ---------------------------------------------------------------- the room clear on the office, its squad of four (as silent-probes.ts stands it)
const AISLE: number[] = [15, 0, 17.6];
async function rig(seed: number, on: boolean, o: { blast?: boolean; charges?: number; silent?: Record<string, unknown> } = {}) {
  reset(); arm(on); DOORBLAST.on = !!o.blast; Object.assign(NIGHTBREACH, { squad: 4 }); if (o.charges !== undefined) DOORTOOLS.charges = o.charges;
  Math.random = seeded(seed);
  const W: any = await quiet(() => standUp()); const game = W.game, input = W.input;
  DOORTOOLS.testDoor = false;   // (the shipped stand writes it on at stand-up: these lines ask what the FRAME answers — the pick, the refusal, the boot with the rule off — and a halt at a door found shut ends the order before any of it. reset() puts the stand's own back)
  if (o.silent) Object.assign(SILENT, { on: true }, o.silent);   // (the harness stands the game up with the posture row off the menu; it is dealt when the squad stands up)
  const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const why = RC.start(seed); const seen = new Set<any>();
  const R = { W, game, input, O, D, why, said, kicks: 0, thuds: 0, note: '',
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'kick') R.kicks++; } } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    target(name: string) { return O.targetAt(R.door(name).frameCentre); },
    give(id: string, name: string): string | null { return O.give(id, R.target(name)); },
    /** an order given on the floor (the posture rows) */
    give2(id: string): string | null { return O.give(id, O.targetAt(AISLE)); },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => b.what).join(' | '); },
    /** X on the door, its tools page read off the panel, Esc */
    tools(name: string): { id: string; text: string; off: boolean; why: string | null }[] {
      const p = R.door(name).frameCentre; W.cursorAt([p[0], 2.2, p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(24);   // (the cursor on its lintel: nothing stands between that and the camera)
      const opener = O.menu?.rows.find((r: any) => r.opens); if (!opener) { R.note = `menu ${O.menu ? `${O.menu.target.kind}: ${O.menu.rows.map((r: any) => r.id).join(' ')}` : 'did not come up'}`; input.pressed.add('Escape'); R.step(); return []; }
      input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4);
      const M = O.menu, body = (O.hud().menu?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel');
      const rows = M && M.page === opener.opens ? M.rows.map((d: any, i: number) => ({ id: d.id as string, text: String(body[i]?.opts?.[0]?.text ?? ''), off: !!body[i]?.off, why: (M.why[i] ?? null) as string | null })) : [];
      for (let i = 0; i < 3 && O.menu; i++) { input.pressed.add('Escape'); R.step(); }
      return rows; },
  };
  { const emit0 = game.doors.emit; game.doors.emit = (e: any) => { if (e.sound === 'thud') R.thuds++; emit0(e); }; }
  R.step(30);
  for (const h of game.guards) if (h.team === 'hostile' && h.state !== 'dead') killGuard(game, h, [0, 0, 1], true);   // (nothing but the orders decides what follows)
  R.step(60 * 4);
  return R;
}
/** the face of that door the team's order lands on, and the door hung so that face is / is not the one it opens toward */
const faceTeam = (R: any, name: string, toward: boolean) => { const d = R.door(name), side = R.target(name).side as 1 | -1; hangToward(R.game, d, toward ? side : -side); return { d, side }; };

export const frameholdsTools = guarded(async () => {
  const F = family('frameholds-tools: the squad at a door locked on the face it opens toward');
  const WORDS = 'opens toward us. no boot. charge it.';
  // (a) a cylinder lock: 'open and clear' by a loud squad
  const pick = async (on: boolean) => { const R = await rig(7, on); const { d, side } = faceTeam(R, 'manager', true); const locked = d.locked, held = R.game.doors.bootHolds(d, off(d, side, 0.6));
    const w = R.give('openClear', 'manager'); const op = R.D.ops[0]; R.until(() => R.D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 70); R.step(30);
    return { R, d, locked, held, w, op, picks: R.D.stats.picks as number, crossed: op?.crossed?.size ?? 0, saidPick: R.said.filter((t: string) => /opens toward us\. picking it/.test(t)).length, saidKick: R.said.filter((t: string) => /locked\. kicking it/.test(t)).length }; };
  { const A = await pick(true), B = await pick(false);
    F.verdict(A.locked && A.held && A.w === null && A.R.kicks === 0 && A.R.thuds === 0 && A.picks === 1 && !A.d.lockBroken && !A.d.locked && A.saidPick === 1 && A.crossed > 0
      && B.locked && !B.held && B.w === null && B.R.kicks >= 1 && B.d.lockBroken && B.picks === 0 && B.saidKick === 1,
      "a loud squad told 'open and clear' at a cylinder lock on the face the door opens toward: nobody boots it — the lead says so, picks it, the keep is whole and they go in (off: 'locked. kicking it.', the boot, the keep torn out)",
      `on: refused ${A.w} · boots ${A.R.kicks} · picks ${A.picks} · keep broken ${!!A.d.lockBroken} · said it ${A.saidPick} · over the line ${A.crossed} · ${A.R.beats(A.op)}\n    off: boots ${B.R.kicks} · picks ${B.picks} · keep broken ${!!B.d.lockBroken} · over the line ${B.crossed} · ${B.R.beats(B.op)}`); }
  // (b) no cylinder (a keypad's bolt): the entry rows greyed with the reason, the order refused in the same words, the charge row live
  /** the keypad door between the manager's office and the server room, come at from the office (its keyed face), the office's own door unlocked: Sam stands in the office, so the order lands on that face */
  const padStage = (R: any) => { const g = R.game, d = R.door('server_manager'), ks = d.keySide as 1 | -1; R.door('manager').locked = false; hangToward(g, d, ks);
    for (const o of [2.0, 1.7, 1.4]) { g.teleportPlayer(off(d, ks, o)); R.step(90); if (g.doors.side(d, g.player.char.pos) === ks && Math.hypot(g.player.char.pos[0] - d.frameCentre[0], g.player.char.pos[2] - d.frameCentre[2]) > 1.2) break; }
    return { d, side: R.target('server_manager').side as 1 | -1, ks }; };
  const pad = async (on: boolean, charges?: number) => { const R = await rig(7, on, { charges }); const { d, side, ks } = padStage(R); const staged = side === ks && d.locked;
    const rows = R.tools('server_manager'); const row = (id: string) => rows.find((r: any) => r.id === id);
    const w = R.give('openClear', 'server_manager'), wB = R.D.ops.length ? null : R.give('bangClear', 'server_manager'); const op = R.D.ops[0]; R.until(() => R.D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 60); R.step(30);
    return { R, d, staged, rows, open: row('openClear'), bang: row('bangClear'), charge: row('charge'), w, wB, viaCode: R.D.ops.length ? null : R.D.order('openClear', R.team, d, side) }; };
  { const A = await pad(true), B = await pad(false), C = await pad(true, 0);
    const greyed = (r: any, words: string) => !!r && r.off && r.text.includes(words.replace(/\.$/, ''));
    F.verdict(A.staged && B.staged && greyed(A.open, WORDS) && greyed(A.bang, WORDS) && A.w === WORDS && A.wB === WORDS && A.viaCode === WORDS && !!A.charge && !A.charge.off && A.R.kicks === 0 && A.R.thuds === 0 && A.R.D.ops.length === 0
      && !!B.open && !B.open.off && B.w === null && B.R.kicks >= 1,
      'a keypad door (no cylinder) on the face it opens toward: "open and clear" and "bang and clear" are greyed with the reason, refused in the same words from the menu and from code (the rescue\'s order), the charge row stays live, nobody walks up and boots it (off: the row live, the order taken, the boot)',
      `on: ${A.R.note}${A.rows.map((r: any) => `${r.id}${r.off ? ' (off)' : ''}: ${r.text}`).join(' | ')} · give → ${A.w} / ${A.wB} · order() → ${A.viaCode} · boots ${A.R.kicks}\n    off: ${B.rows.map((r: any) => `${r.id}${r.off ? ' (off)' : ''}`).join(' | ')} · give → ${B.w} · boots ${B.R.kicks} · keep broken ${!!B.d.lockBroken}`);
    F.verdict(C.w === 'opens toward us. no boot, no charge.' && !!C.charge?.off, 'with no door charge carried the words do not send them for one', `charges 0: give → ${C.w} · charge row: ${C.charge?.text}${C.charge?.off ? ' (off)' : ''}`); }
  { const R = await rig(7, true, { blast: true }); const { d } = padStage(R); const w0 = R.give('charge', 'server_manager'); const set = R.until(() => !!R.D.chargeOn(d), 60); R.step(30);
    const rows = R.tools('server_manager'), open = rows.find((r: any) => r.id === 'openClear'), w = R.give('openClear', 'server_manager');
    F.verdict(w0 === null && set && w === 'opens toward us. no boot. blow the charge.' && !!open?.off, 'with a charge already set on that door the words point at it', `charge order refused ${w0} · set ${set} · give → ${w} · row: ${open?.text}${open?.off ? ' (off)' : ''}`); }
  // (b') a SILENT squad with its picks switched off (silent.ts SILENT.picks): the frame's rule does not hand it the pick — silent's own answer, no boot, no pick
  { const quietRun = async (on: boolean) => { const R = await rig(7, on, { silent: { picks: false } }); R.give2('silent'); R.step(5); const { d } = faceTeam(R, 'manager', true);
      const w = R.give('openClear', 'manager'); const op = R.D.ops[0]; R.until(() => R.D.ops.length === 0, 60); R.step(30);
      return { R, d, w, silent: squadSilent(R.game) as boolean, picks: R.D.stats.picks as number, ended: op?.ended as string | undefined, said: R.said.filter((t: string) => /no boot while we(?: are|'re) silent/.test(t)).length }; };
    const A = await quietRun(true), B = await quietRun(false);
    F.verdict(A.silent && A.w === null && A.picks === 0 && A.R.kicks === 0 && A.R.thuds === 0 && !A.d.lockBroken && A.d.locked && A.said === 1 && B.picks === 0 && B.R.kicks === 0 && B.said === 1,
      'a silent squad with its picks switched off, at a cylinder lock on the face the door opens toward: silent\'s own answer — "no boot while we are silent" — no pick, no boot, in both arms', `on: silent ${A.silent} · picks ${A.picks} · boots ${A.R.kicks} · said ${A.said} · ended: ${A.ended} · off: picks ${B.picks} · boots ${B.R.kicks} · said ${B.said} · ended: ${B.ended}`); }
  // (c) a lock no pick opens thrown while they walk (the order was good when given): it ends at the door, in words, nobody boots
  const late = async (on: boolean) => { const R = await rig(7, on); const { d } = faceTeam(R, 'manager', true); d.locked = false;
    const w = R.give('openClear', 'manager'); const op = R.D.ops[0]; R.step(20); d.locked = true; (d as any).lockId = `wedge:${d.def.name}`;
    R.until(() => R.D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 60); R.step(30);
    return { R, d, w, op, noBoot: R.D.stats.noBoot as number, said: R.said.filter((t: string) => t.includes('opens toward us. no boot')).length }; };
  { const A = await late(true), B = await late(false);
    F.verdict(A.w === null && A.R.kicks === 0 && A.R.thuds === 0 && A.noBoot === 1 && A.said === 1 && A.R.D.ops.length === 0 && /opens toward us/.test(A.op?.ended ?? '') && !A.d.lockBroken && B.R.kicks >= 1 && B.d.lockBroken && B.noBoot === 0,
      'locked by something no pick opens while they walked to it: the lead says it opens toward them and the order ends at the door, like steel — no boot (off: the boot)',
      `on: boots ${A.R.kicks} · said ${A.said} · ended: ${A.op?.ended} · ${A.R.beats(A.op)}\n    off: boots ${B.R.kicks} · keep broken ${!!B.d.lockBroken} · ${B.R.beats(B.op)}`); }
  // (d) the gate's question, and the push face
  { const q = async (on: boolean) => { const R = await rig(7, on); const m = faceTeam(R, 'manager', true), s = padStage(R); R.door('manager').locked = true; const wk = (x: any) => (R.D as any).willKick({ door: x.d, side: x.side, men: [] }) as boolean; return { cyl: wk(m), pad: wk(s) }; };
    const A = await q(true), B = await q(false);
    F.verdict(A.cyl && !A.pad && B.cyl && B.pad, 'willKick — the question a shared gate asks before it waits on a door: yes for the lock that will give (the pick), no for the door whose order will be refused (no gate is run here: the answer alone)', `on: cylinder ${A.cyl}, keypad ${A.pad} · off: cylinder ${B.cyl}, keypad ${B.pad}`); }
  { const push = async (on: boolean) => { const R = await rig(7, on); const { d } = faceTeam(R, 'manager', false); const w = R.give('openClear', 'manager'); const op = R.D.ops[0]; R.until(() => R.D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 60); return { R, d, w, picks: R.D.stats.picks as number }; };
    const A = await push(true), B = await push(false);
    F.verdict(A.w === null && A.R.kicks >= 1 && A.d.lockBroken && A.picks === 0 && A.R.thuds === 0 && B.R.kicks === A.R.kicks && B.d.lockBroken, 'the same door hung the way it was dealt (locked on the face it opens away from): the boot as ever, in both arms', `on: boots ${A.R.kicks}, keep broken ${!!A.d.lockBroken}, picks ${A.picks} · off: boots ${B.R.kicks}, keep broken ${!!B.d.lockBroken}`); }
  // (e) a charge set on the face it opens toward still opens it — off its hinges, or (that switch off) the lock destroyed and the leaf brought round
  for (const blast of [true, false]) { const R = await rig(7, true, { blast }); const { d } = faceTeam(R, 'manager', true); const w = R.give('charge', 'manager');
    const set = R.until(() => !!R.D.chargeOn(d), 60); R.step(60 * 3); const did = R.D.blow(R.D.chargeOn(d)); R.step(60 * 2);
    F.verdict(w === null && set && !!did && d.lockBroken && (blast ? d.off : !d.off && Math.abs(d.angle) > 0.9) && R.thuds === 0, `a charge set on that face${blast ? '' : ' (off-hinges switched off)'}: ${blast ? 'the leaf comes off' : 'the lock is destroyed and the leaf comes round on its hinge'}`, `refused ${w} · set ${set} · blown ${!!did} · off its hinges ${!!d.off} · angle ${f2(d.angle)} · keep broken ${!!d.lockBroken}`); }
  return F.done();
});

// ---------------------------------------------------------------- frameholds-sam
export const frameholdsSam = guarded(async () => {
  const F = family('frameholds-sam: the player at a door locked on the face it opens toward');
  const stage = async (on: boolean, toward: boolean) => { reset(); arm(on); const W = await boot(), g = W.game; g.godMode = true; g.playerInvisible = true; g.tune.civilians = false; g.guards.length = 0;
    const d = g.doors.list.find((x: any) => x.def.name === 'manager'), ks = d.keySide as number; hangToward(g, d, toward ? ks : -ks); fresh(d, true);
    const at = () => { for (let i = 0; i < 90 && (g.player.kick || g.player.char.anim.kicking); i++) W.step(DT); fresh(d, true); g.teleportPlayer(off(d, ks, 0.9, d.def.width * 0.7)); g.player.crouch = false; g.player.fHeld = false; W.step(DT); W.cursorAt(d.pos); W.step(DT); W.step(DT); };
    const said: string[] = []; { const msg = g.msg.bind(g); g.msg = (t: string) => { said.push(t); msg(t); }; }
    let thuds = 0, kicks = 0; { const emit0 = g.doors.emit; g.doors.emit = (e: any) => { if (e.sound === 'thud') thuds++; if (e.sound === 'kick') kicks++; emit0(e); }; }
    let yaw = 0; at(); const rows = (g.nearby as any[]).filter(r => r.kind === 'door' && r.door === d), kick = rows.find(r => r.verb === 'kick'), pick = rows.find(r => r.verb === 'pick');
    // a tap on the kick row
    const had = tapVerb(W, 'door', 'kick'); let kicked = !!g.player.kick; for (let i = 0; i < 100; i++) { W.step(DT); kicked ||= !!g.player.kick; }
    const tap = { had, kicked, broken: !!d.lockBroken, open: Math.abs(d.angle) };
    // a sprint into it: the camera turned so W runs him square at the leaf, W + Shift held from 1.8 m off (the corridor's furniture allows no more)
    at(); g.teleportPlayer(off(d, ks, 1.8, d.def.width * 0.7)); W.step(DT);
    const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), out = (): number => Math.abs(-(g.player.char.pos[0] - d.def.hinge[0]) * uz + (g.player.char.pos[2] - d.def.hinge[1]) * ux);   // (metres off the plane of the shut leaf)
    const want = [uz * ks, -ux * ks], far = out(); { let best = -2; for (let i = 0; i < 360; i++) { W.cam.yaw = i * Math.PI / 180; W.cam.rebuild(); const f = W.cam.planarBasis().fwd, dot = f[0] * want[0] + f[2] * want[1]; if (dot > best) { best = dot; yaw = W.cam.yaw; } } }
    let sprintKick = false, near = Infinity, fastest = 0;
    W.input.keys.add('KeyW'); W.input.keys.add('ShiftLeft');
    for (let i = 0; i < 90; i++) { W.cam.yaw = yaw; W.cam.rebuild(); W.step(DT); sprintKick ||= !!g.player.kick; fastest = Math.max(fastest, g.player.char.vel[0] * want[0] + g.player.char.vel[2] * want[1]); near = Math.min(near, out()); }
    W.input.keys.delete('KeyW'); W.input.keys.delete('ShiftLeft'); for (let i = 0; i < 100; i++) W.step(DT);
    const ran = far > 1.2 && near < 0.75 && fastest > 1.5 ? 1 : 0, sprint = `from ${f2(far)} m off the leaf to ${f2(near)} m at up to ${f2(fastest)} m/s into it`;
    // the pick still works from that face
    at(); const picking = tapVerb(W, 'door', 'pick'); let picked = false; for (let i = 0; i < 60 * 7 && !picked; i++) { W.step(DT); picked = !d.locked; }
    return { d, kick, pick, tap, sprintKick, ran, sprint, picking, picked, said, thuds, kicks, holds: g.doors.bootHolds(d, off(d, ks, 0.9)) };
  };
  const A = await stage(true, true), B = await stage(false, true), P = await stage(true, false);
  const line = (r: any) => r ? `${r.off ? '(off) ' : ''}${r.line2}` : 'no row';
  F.verdict(!!A.kick && A.kick.off && /opens toward you: a boot will not shift it/.test(A.kick.line2) && !/sprint/.test(A.kick.line2) && !!A.pick && !A.pick.off && !!B.kick && !B.kick.off && /kick it in — LOUD/.test(B.kick.line2),
    'his kick row at that door is greyed and says why; the pick row beside it is live (off: the kick row live, "or sprint into it")', `on: ${line(A.kick)} | ${line(A.pick)}\n    off: ${line(B.kick)}`);
  F.verdict(A.tap.had && !A.tap.kicked && !A.tap.broken && A.tap.open < 0.01 && A.said.some(t => /a boot will not shift it/.test(t)) && A.thuds === 0 && A.kicks === 0 && B.tap.had && B.tap.kicked && B.tap.broken,
    'a tap on the greyed row: a word, no kick thrown, no noise, the lock whole (off: the kick, the keep torn out)', `on: kick started ${A.tap.kicked} · keep broken ${A.tap.broken} · said: ${A.said.filter(t => /boot/.test(t)).join(' / ')}\n    off: kick started ${B.tap.kicked} · keep broken ${B.tap.broken} · open ${f2(B.tap.open)}`);
  F.verdict(A.ran === 1 && !A.sprintKick && !A.d.lockBroken && B.ran === 1 && B.sprintKick, 'a sprint into that face starts no kick: he stops on it as on any locked door (off: the sprint is a kick)', `on: ran at it ${A.sprint}, a kick started ${A.sprintKick} · off: ran at it ${B.sprint}, a kick started ${B.sprintKick}`);
  F.verdict(A.picking && A.picked && !A.d.lockBroken, 'and the pick opens it from there as from any face', `pick started ${A.picking} · unlocked ${A.picked}`);
  F.verdict(!P.holds && !!P.kick && !P.kick.off && P.tap.kicked && P.tap.broken && P.ran === 1 && P.sprintKick, 'the same door hung the way it was dealt (locked on the face it opens away from), the switch on: the kick row live, the tap a kick, the sprint a kick', `${line(P.kick)} · tap kicked ${P.tap.kicked}, keep broken ${P.tap.broken} · sprint kick ${P.sprintKick}`);
  return F.done();
});

// ---------------------------------------------------------------- frameholds-wedge
// The last stand on the compound (laststand-probes.ts's staging: five on eleven, the team left on its start mark, the defenders taken down by hand to three, who
// are ordered into one room and dig in — a last stand wedges ANY door of its room). The moment the room is named, every door of it is hung to open OUT of the
// room (or INTO it: the control), and the three are left to it.
async function standRig(seed: number, on: boolean, ship = false) {
  // (the staging is laststand-probes.ts's, written on the harness's own doors: the stay-open / manners / off-hinges switches are pinned off for it, whatever the
  // environment asked. `ship`: all three ON instead, as the build ships them — standWedges then shuts the room's doors behind the men by hand, see there)
  reset(); arm(on); const was = { ...LASTSTAND }, env = { stay: process.env.QA_DOORSTAY === '1', manners: DOORMANNERS.on, blast: DOORBLAST.on }; Object.assign(LASTSTAND, { regroup: true, callOut: false }); DOORMANNERS.on = ship; DOORBLAST.on = ship; Math.random = seeded(seed);
  const W: any = await quiet(async () => { const W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }); DOORSTAY.on = ship; await startFromQuery(W.game, new URLSearchParams(`?levelFile=compound.json&roomclear=${seed}&squad4`)); return W; });
  return { W, restore: () => { Object.assign(LASTSTAND, was); DOORSTAY.on = env.stay; DOORMANNERS.on = env.manners; DOORBLAST.on = env.blast; } };
}
// `ship` (doors stay where they are left): the three walk in by the room's doors and leave them standing open. What dig-in does about that is its own rule
// (digin.ts DIGIN.shutOpen; without it he waited 2.5 s on a leaf that takes longer, wedged nothing in either arm, and the room's other door was never gone to —
// stay-open-digin below is its line), not the hold test: here the probe is the hand that shuts each door of the room behind them (the game's own pull, whenever nobody living is within 2 m of the doorway), and the hold test then decides as it does with closers.
// `hand` false (stay-open-digin): nobody shuts anything for them — what dig-in does with the doors they left open is the thing looked at.
// `noise` (stay-open-digin): the men of the room keep hearing the team just outside that entry of it (the room fight's own noise fields, written every frame).
async function standWedges(seed: number, on: boolean, hang: 'out' | 'in' | number, ship = false, hand = true, noise = -1) {   // (a number: that entry of the room alone opens out of it, the rest into it)
  const { W, restore } = await standRig(seed, on, ship); try {
    const g = W.game, step = (secs: number, each?: () => void) => { for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(DT); each?.(); } };
    step(1); const kept: any[] = [];
    for (const R of g.roomClear.rooms) { const stay = ['office', 'bunk', 'back'].includes(R.def.id) ? R.defenders[0] : null; if (stay) kept.push(stay); for (const h of R.defenders.slice()) if (h !== stay && h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); }
    const s0 = { ...DIGIN_STATS }, h0 = { ...DIGIN_SHUT }, l0 = DIGIN_LOG.length; let room: any = null, hung: string[] = [], setT = -1, n = 0;
    while (n < 150 * 60 && (setT < 0 || n < setT * 60 + 300)) step(1 / 60, () => { n++; const R = lastStandReport(g);
      if (!room && R.room) { const there = kept.find((h: any) => h.state !== 'dead' && g.roomClear.roomAt(h.char.pos) === R.room); room = (g.fight.defs as any[]).find(D => D.gd === there)?.room ?? null;
        if (room) for (const [i, e] of room.entries.entries()) { const inside: [number, number, number] = [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8], toward = g.doors.pullFace(e.door, inside), wantOut = typeof hang === 'number' ? i === hang : hang === 'out';
          if (toward === wantOut && Math.abs(e.door.angle) < 0.05) e.door.setSwing(-e.door.swing); hung.push(`${e.door.def.name} ${g.doors.pullFace(e.door, inside) ? 'in' : 'out'}`); } }
      if (noise >= 0 && room?.entries[noise]) { const e = room.entries[noise]; for (const D of g.fight.defs as any[]) if (D.room === room && D.gd.state !== 'dead') { D.noiseAt = [e.at[0] + e.out[0], 0, e.at[2] + e.out[1]]; D.noiseT = g.time; D.noiseOut = true; } }
      if (ship && hand && room) for (const e of room.entries) if (!e.door.latched && !e.door.off && !g.guards.some((h: any) => h.state !== 'dead' && Math.hypot(h.char.pos[0] - e.at[0], h.char.pos[2] - e.at[2]) < 2)) g.doors.pullTo(e.door, 0);
      if (setT < 0 && R.said.some((l: any) => l.kind.startsWith('set'))) setT = n / 60; });
    const d = (k: string) => (DIGIN_STATS as any)[k] - (s0 as any)[k];
    const doors = room ? (room.entries as any[]).map(e => `${e.door.def.name} ${e.door.latched ? 'shut' : `open ${f2(Math.abs(e.door.angle))} rad`}`) : [], open = room ? (room.entries as any[]).filter(e => !e.door.latched).length : -1;
    const shut: Record<string, number> = {}; for (const k of Object.keys(h0)) shut[k] = (DIGIN_SHUT as any)[k] - (h0 as any)[k];
    return { doors, open, shut, counted: Object.values(shut).reduce((a, b) => a + b, 0), pulled: d('pulledTo'), log: (DIGIN_LOG as any[]).slice(l0).map(l => `${l.t.toFixed(1)} ${l.who}: ${l.what}`), room: lastStandReport(g).room as string | null, hung, n: room ? room.entries.length as number : 0, on: room ? (digInWedged(g, room) as any[]).map(e => e.door.def.name as string) : [], wedged: room ? digInWedged(g, room).length : -1, braced: d('braced'), away: d('wedgedAway'), passed: d('opensAway'), setT };
  } finally { restore(); }
}
/** the warehouse's loading dock doors (dock_s, dock_n), asked the hold test from the dock's floor and from the lot, hung to open into the dock and out of it */
async function dockHolds(on: boolean) {
  reset(); arm(on); Math.random = seeded(1);
  const W: any = await quiet(async () => { const W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'warehouse.json'), 'utf8'))) }); await startFromQuery(W.game, new URLSearchParams('?levelFile=warehouse.json&roomclear=1&squad4')); return W; });
  const g = W.game; for (let i = 0; i < 30; i++) W.step(DT);
  const rows: { name: string; room: string; dealt: string; inward: [boolean, boolean]; outward: [boolean, boolean] }[] = [], seen = new Set<any>();
  for (const D of g.fight.defs as any[]) for (const e of (D.room?.entries ?? []) as any[]) {
    if (!/^dock_[sn]$/.test(e.door.def.name) || seen.has(e.door)) continue; seen.add(e.door);
    const ins: [number, number, number] = [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8], outs: [number, number, number] = [e.at[0] + e.out[0] * 0.8, 0, e.at[2] + e.out[1] * 0.8];
    const dealt = g.doors.pullFace(e.door, ins) ? 'in' : 'out';
    const ask = (inward: boolean): [boolean, boolean] => { if (g.doors.pullFace(e.door, ins) !== inward) e.door.setSwing(-e.door.swing); return [g.doors.wedgeHolds(e.door, ins), g.doors.wedgeHolds(e.door, outs)]; };
    rows.push({ name: e.door.def.name, room: String(D.room.id ?? D.room.def?.id ?? '?'), dealt, inward: ask(true), outward: ask(false) }); ask(dealt === 'in');
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
export const frameholdsWedge = guarded(async () => {
  const F = family('frameholds-wedge: defenders wedge only a door that opens toward them (the last stand on the compound, its room\'s doors hung out of it)');
  // (the deal: one on which the room's men get their furniture to a door in every arm, so that the hold test is what decides. The compound's hand placement
  // re-dealt it — on the old seed 5 the carton stops 0.1 m short of the door on the page's stand and the man never reaches his prop beside doors that stay,
  // rule on or off: dig-in's haul, not the frame. FH_SEED=<n> asks another deal: 1‥8 on both stands, 1 alone wedges in every arm of both)
  const SEED = Number(process.env.FH_SEED ?? 1);
  const A = await standWedges(SEED, true, 'out'), B = await standWedges(SEED, false, 'out'), C = await standWedges(SEED, true, 'in'), D = await standWedges(SEED, false, 'in');
  const line = (r: any) => `room ${r.room} (${r.hung.join(', ')}) · ${r.wedged} doors wedged, ${r.braced} wedges placed, ${r.away} on a door opening away, ${r.passed} doors passed over`;
  F.verdict(!!A.room && A.hung.length > 0 && A.hung.every((h: string) => h.endsWith('out')) && A.wedged === 0 && A.braced === 0 && A.away === 0 && A.passed >= 1 && B.room === A.room && B.wedged >= 1 && B.away >= 1 && B.passed === 0,
    'every door of their room opens out of it: nobody wedges one — there is nothing to wedge on that side — and each door passed over is counted once (off: they wedge it all the same)', `on: ${line(A)}\n    off: ${line(B)}`);
  F.verdict(C.hung.every((h: string) => h.endsWith('in')) && C.wedged >= 1 && C.away === 0 && C.passed === 0 && D.wedged === C.wedged && D.braced === C.braced && D.away === 0,
    'the same doors hung to open into the room: wedged as ever, the same count in both arms', `on: ${line(C)}\n    off: ${line(D)}`);
  // the same two beside the door switches the build ships with (doors stay where they are left, manners, off the hinges), the leaves shut behind the men by hand
  { const [A, B, C, D] = [await standWedges(SEED, true, 'out', true), await standWedges(SEED, false, 'out', true), await standWedges(SEED, true, 'in', true), await standWedges(SEED, false, 'in', true)];
    F.verdict(!!A.room && A.hung.length > 0 && A.hung.every((h: string) => h.endsWith('out')) && A.wedged === 0 && A.braced === 0 && A.away === 0 && A.passed >= 1 && B.room === A.room && B.wedged >= 1 && B.away >= 1 && B.passed === 0
      && C.hung.every((h: string) => h.endsWith('in')) && C.wedged >= 1 && C.away === 0 && C.passed === 0 && D.wedged === C.wedged && D.braced === C.braced && D.away === 0,
      'the same beside doors that stay where they are left, door manners and off the hinges, all on (the room\'s doors shut behind the men by the probe): opening out, nobody wedges one (off: wedged all the same); opening in, wedged as ever in both arms',
      `out, on: ${line(A)}\n    out, off: ${line(B)}\n    in, on: ${line(C)}\n    in, off: ${line(D)}`); }
  // the mixed room: one door of it opens out, the rest in — the wedges go on the doors a wedge can hold, whichever door they are expected by
  for (const k of [0, 1]) { const M = await standWedges(SEED, true, k), out = M.hung.find((h: string) => h.endsWith('out'))?.split(' ')[0];
    F.verdict(M.n >= 2 && !!out && M.hung.filter((h: string) => h.endsWith('out')).length === 1 && M.wedged === M.n - 1 && !M.on.includes(out) && M.away === 0 && M.passed === 1,
      `one door of the room (${out}) opens out of it, the rest into it: every other door is wedged, that one is passed over`, `on: ${line(M)} · wedged: ${M.on.join(', ')}`); }
  // the warehouse's dock doors: the same predicate, from the dock's floor and from the lot. (Hung to open OUT, the lot is the side a wedge holds from: this
  // rule does not keep a dock man inside the building — the brace GOAL rule, the missions build's DIGIN.braceInRoom, does)
  { const on = await dockHolds(true), no = await dockHolds(false), t = (r: any) => `${r.name} (room ${r.room}, dealt to open ${r.dealt}): opening in, holds from the dock ${r.inward[0]} / from the lot ${r.inward[1]} · opening out, from the dock ${r.outward[0]} / from the lot ${r.outward[1]}`;
    F.verdict(on.length === 2 && on.every(r => r.inward[0] && !r.inward[1] && !r.outward[0] && r.outward[1]) && no.length === 2 && no.every(r => r.inward[0] && r.inward[1] && r.outward[0] && r.outward[1]),
      'warehouse dock_s / dock_n: a wedge holds them from the dock\'s floor only while they open into the dock; hung to open out, only from the lot (off: from either side, whichever way)', `on: ${on.map(t).join('\n        ')}\n    off: ${no.map(t).join('\n         ')}`); }
  return F.done();
});

// ---------------------------------------------------------------- stay-open-digin (probes.ts: the 'stay-open' family; the staging is frameholds-wedge's)
// DEFENDERS SHUT THE DOORS OF A ROOM THEY HOLD (src/game/digin.ts DIGIN.shutOpen). The last three of the compound walk into one room and dig in, its doors hung
// to open into it (a wedge holds them). With closers the doors come to behind them and two are wedged. Where doors stay as they are left the men leave them
// standing open: the bracer hauls his furniture to one, pulls it, and — the old 2.5 s wait — walks off before a leaf with no closer is home. NOBODY SHUTS A DOOR
// FOR THEM HERE in any arm.
// THE DEAL is found, not written down: which room the three walk into and whether a man's furniture reaches a door are dig-in's haul and the compound's
// placement, and every re-deal of either moved a fixed seed off the staging (seed 5 held it until the hand placement; after it no one deal of 1‥8 stages it on
// both stands). So deals 1‥8 are asked in turn with THE RULE OFF, and the first that stages it is taken: closers wedge both doors, and where doors stay the men
// wedge none and leave a door of the room open, wedges allowed or not. The rule's own arms are never asked in the choosing. No deal stages it = red, nothing
// proved. SD_SEED=<n> asks that deal alone. SHUTOPEN_BREAK=1: the rule left off in its own arms — lines 1 and 2 are red on the deal taken.
export const stayOpenDigin = guarded(async () => {
  const F = family('stay-open-digin: defenders shut and wedge the doors of a room they walked into, where doors stay as they are left (the last stand on the compound)');
  const was = { shutOpen: DIGIN.shutOpen, wedges: DIGIN.wedges }, BREAK = process.env.SHUTOPEN_BREAK === '1'; let SEED = 0;
  const run = async (ship: boolean, shutOpen: boolean, wedges = was.wedges, noise = -1) => { DIGIN.shutOpen = shutOpen && !BREAK; DIGIN.wedges = wedges; try { return await standWedges(SEED, true, 'in', ship, false, noise); } finally { DIGIN.shutOpen = was.shutOpen; DIGIN.wedges = was.wedges; } };
  const line = (r: any) => `room ${r.room} · ${r.wedged} doors wedged · ${r.doors.join(', ')} · pulls ${r.pulled} · all set at ${f2(r.setT)} s · the rule: pushed home ${r.shut.home}, held past 2.5 s ${r.shut.held}, pulled again ${r.shut.again}, other doors gone to ${r.shut.more}, let be ${r.shut.left}`;
  // the deal (see the head of this probe): the rule off in all three of the arms asked here — A closers, B doors that stay, D the same with no wedge allowed
  const deals = process.env.SD_SEED ? [Number(process.env.SD_SEED)] : [1, 2, 3, 4, 5, 6, 7, 8], over: string[] = []; let A: any = null, B: any = null, D: any = null;
  for (const s of deals) { SEED = s; const a = await run(false, false);
    if (!a.room || a.wedged !== 2) { over.push(`${s}: closers wedge ${a.wedged} of room ${a.room}'s doors`); continue; }
    const b = await run(true, false); if (b.room !== a.room || b.wedged !== 0 || b.open < 1) { over.push(`${s}: where doors stay, room ${b.room}, ${b.wedged} wedged, ${b.open} open`); continue; }
    const d = await run(true, false, 0); if (d.wedged !== 0 || d.open < 1) { over.push(`${s}: no wedge allowed, ${d.open} open`); continue; }
    A = a; B = b; D = d; break; }
  if (!A) { F.verdict(false, `a deal of ${deals.join(', ')} stages it with the rule off (closers wedge both doors of the room; where doors stay nobody wedges one and a door stands open, wedges allowed or not): none does — nothing proved`, over.join('\n    ')); return F.done(); }
  console.log(`    deal ${SEED} of the compound${over.length ? ` (passed over — ${over.join(' · ')})` : ''}`);
  const A1 = await run(false, true), C = await run(true, true);
  if (process.env.DIGIN_SHUT_LOG) for (const [k, r] of [['closers', A1], ['stay-open, rule off', B], ['stay-open, rule on', C]] as const) console.log(`--- ${k}\n${r.log.join('\n')}`);
  F.verdict(!!A.room && A.wedged === 2 && A1.room === A.room && A1.wedged === 2 && B.room === A.room && B.wedged === 0 && B.open >= 1 && C.room === A.room && C.wedged === 2 && C.open === 0 && C.shut.home + C.shut.held >= 1 && A.counted === 0 && A1.counted === 0 && B.counted === 0,
    'closers: 2 doors wedged. Doors that stay open, the rule off: 0 wedged, a door of their room open all stand. The rule on: 2 wedged, every door of the room shut — and the rule counts nothing in the other arms (with closers, on or off)',
    `closers: ${line(A1)}\n    closers, rule off: ${line(A)}\n    stay-open, rule off: ${line(B)}\n    stay-open, rule on: ${line(C)}`);
  // the room's OTHER door: no furniture for anybody (no wedge allowed), so a door is shut only by a man who walks to it
  const E = await run(true, true, 0);
  if (process.env.DIGIN_SHUT_LOG) for (const [k, r] of [['no wedges, rule off', D], ['no wedges, rule on', E]] as const) console.log(`--- ${k}\n${r.log.join('\n')}`);
  F.verdict(D.wedged === 0 && D.counted === 0 && D.open >= 1 && E.wedged === 0 && E.open === 0 && E.shut.more >= 1,
    'the same room with no wedges allowed: every door of it is shut by hand before they take cover (the rule off: shown beside)', `rule off: ${line(D)}\n    rule on: ${line(E)}`);
  // …and with the team heard just outside a door of the room the whole time: nobody goes door to door — to cover, as without the rule
  for (const k of [0, 1]) { const N = await run(true, true, 0, k), O = await run(true, false, 0, k);
    if (process.env.DIGIN_SHUT_LOG) console.log(`--- heard at entry ${k}, rule on\n${N.log.join('\n')}`);
    F.verdict(N.shut.more === 0 && N.open === O.open && N.pulled === O.pulled && N.setT > 0, `the team heard at a door of the room (entry ${k}) all the while: no man goes to shut another door — the same doors stand as with the rule off`, `rule on: ${line(N)}\n    rule off: ${line(O)}`); }
  return F.done();
});
