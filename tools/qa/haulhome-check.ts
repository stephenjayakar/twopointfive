// haulhome-check.ts — THE FURNITURE COMES HOME (src/game/digin.ts HAULHOME): a defender hauling furniture to a door was asked whether it had made it the
// frame he stopped at his stand, with the thing still a hand short and seconds of his haul clock unspent — and gave it up. On, he brings it the rest of
// the way while that clock runs.
//
//   bun run tools/qa/haulhome-check.ts [--seeds 1,2,…] [--trace]         (frozen stand; the default plays deals 1‥8 with the switch off and keeps those that show the fault)
//   TPS_PROFILE=shipped bun run tools/qa/haulhome-check.ts               (the page's stand)
//   HAULHOME_BREAK=1 …                                                    the 'on' arm played with the switch left off: must FAIL (exit 1)
//
// THE STAGING is the last stand on the compound (laststand-probes.ts's, as frameholds-probes.ts plays it): five on eleven, the team left on its start mark,
// the defenders taken down by hand to three, who are ordered into one room and dig in — a last stand wedges any door of its room. Its doors are hung to open
// INTO the room (a wedge holds only a door that opens toward the man) and close on their own (the stay-open switch, manners and off-the-hinges pinned off:
// what a man does about a door left standing open is DIGIN.shutOpen's ground, not this rule's). Each deal is played twice, the switch off and on — the check
// writes it itself after the game stands, so both stands ask the same thing.
//
// WHAT IT ASKS
//   1  off: on these deals a man gives his furniture up at the door ('the furniture did not make it to the door') — the staging does exercise the rule
//   2  on: he says he brings it the last of the way, and nobody gives furniture up on a deal where somebody did with it off
//   3  on: more doors end wedged over the deals than off, and no deal ends with fewer
//   4  a recording from before the key replays with it off; one that carries the key keeps its own word (journal.ts applyKnobs)
// NOT ASKED: what the hauled thing looks or sounds like on the page — never seen on a GPU, never heard.
export { };
const { standUp, ROOT } = await import('./headless.ts');
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LASTSTAND, lastStandReport } = await import(`${ROOT}/src/game/laststand.ts`);
const { HAULHOME, DIGIN_STATS, DIGIN_LOG, digInWedged } = await import(`${ROOT}/src/game/digin.ts`);
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const TRACE = argv.includes('--trace'), BREAK = process.env.HAULHOME_BREAK === '1', STAND = process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen';
// THE DEALS ARE FOUND, NOT NAMED: a re-deal of the compound (as its hand placement was) moves which deals show the fault, so every one of these is played with
// the switch off and the ones where a man gives his furniture up at the door are the ones played again with it on (10-13: 3, 5, 6 on the page's stand, 6 on
// the frozen one). None found = nothing here exercises the rule any more: red, and --seeds asks others
const ASKED = (flag('--seeds') ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Run { seed: number; on: boolean; room: string | null; hung: string[]; hauls: number; short: number; home: number; wedged: number; log: string[] }
async function stand(seed: number, on: boolean): Promise<Run> {
  const was = { LS: { ...LASTSTAND }, way: { ...DOORWAY }, stay: DOORSTAY.on, manners: DOORMANNERS.on, blast: DOORBLAST.on, home: HAULHOME.on, rnd: Math.random };
  try {
    Object.assign(LASTSTAND, { regroup: true, callOut: false }); DOORWAY.oneWay = true; DOORWAY.frameHolds = true; DOORMANNERS.on = false; DOORBLAST.on = false; Math.random = seeded(seed);
    const W: any = await quiet(async () => { const W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) });
      DOORSTAY.on = false; HAULHOME.on = on; await startFromQuery(W.game, new URLSearchParams(`?levelFile=compound.json&roomclear=${seed}&squad4`)); return W; });   // (standUp has written the stand's own word for the switch: the arm's goes over it)
    const g = W.game, step = (secs: number, each?: () => void) => { for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(DT); each?.(); } };
    step(1); const kept: any[] = [];
    for (const R of g.roomClear.rooms) { const stay = ['office', 'bunk', 'back'].includes(R.def.id) ? R.defenders[0] : null; if (stay) kept.push(stay); for (const h of R.defenders.slice()) if (h !== stay && h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); }
    DIGIN_LOG.length = 0;   // (a ring, never cleared between games in one process: emptied here so that this stand's lines are all of them)
    const s0 = { ...DIGIN_STATS }, l0 = 0; let room: any = null, hung: string[] = [], setT = -1, n = 0;
    while (n < 150 * 60 && (setT < 0 || n < setT * 60 + 300)) step(1 / 60, () => { n++; const R = lastStandReport(g);
      if (!room && R.room) { const there = kept.find((h: any) => h.state !== 'dead' && g.roomClear.roomAt(h.char.pos) === R.room); room = (g.fight.defs as any[]).find(D => D.gd === there)?.room ?? null;
        if (room) for (const e of room.entries) { const inside: [number, number, number] = [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8];
          if (!g.doors.pullFace(e.door, inside) && Math.abs(e.door.angle) < 0.05) e.door.setSwing(-e.door.swing); hung.push(`${e.door.def.name} ${g.doors.pullFace(e.door, inside) ? 'in' : 'out'}`); } }
      if (setT < 0 && R.said.some((l: any) => l.kind.startsWith('set'))) setT = n / 60; });
    const log = (DIGIN_LOG as any[]).slice(l0).map(l => `${l.t.toFixed(1)} ${l.who}: ${l.what}`);
    return { seed, on, room: lastStandReport(g).room as string | null, hung, hauls: DIGIN_STATS.hauls - s0.hauls, short: log.filter(l => /did not make it to the door/.test(l)).length,
      home: log.filter(l => /brings it the last of the way/.test(l)).length, wedged: room ? digInWedged(g, room).length : -1, log };
  } finally { Object.assign(LASTSTAND, was.LS); Object.assign(DOORWAY, was.way); DOORSTAY.on = was.stay; DOORMANNERS.on = was.manners; DOORBLAST.on = was.blast; HAULHOME.on = was.home; Math.random = was.rnd; }
}

let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const line = (r: Run) => `seed ${r.seed}, ${r.on ? 'on' : 'off'}: room ${r.room} (${r.hung.join(', ')}) · ${r.hauls} hauls, ${r.short} given up at the door, ${r.home} brought the last of the way, ${r.wedged} doors wedged`;

console.log(`haulhome-check · ${STAND} stand · deals ${ASKED.join(', ')}${BREAK ? ' · HAULHOME_BREAK: the switch left off under the on arm' : ''}`);
const ALL: Run[] = []; for (const s of ASKED) ALL.push(await stand(s, false));
const OFF = ALL.filter(r => r.short >= 1), SEEDS = OFF.map(r => r.seed), ON: Run[] = [];
for (const s of SEEDS) ON.push(await stand(s, !BREAK));
console.log(`  ${ALL.length} deals played with the switch off; a man gives furniture up at the door on ${SEEDS.length ? SEEDS.join(', ') : 'none'}`);
if (TRACE) for (const r of ALL.filter(r => r.short < 1)) console.log(`  (not played on) ${line(r)}`);
if (TRACE) for (const r of [...OFF, ...ON]) console.log(`--- ${line(r)}\n${r.log.join('\n')}`);
const rows = (rs: Run[]) => rs.map(line).join('\n    ');
const staged = OFF.length >= 1 && OFF.every(r => !!r.room && r.hung.length > 0 && r.hung.every(h => h.endsWith('in')) && r.hauls >= 1) && ON.every((r, i) => r.room === OFF[i].room && r.hauls >= 1);
verdict(staged && OFF.every(r => r.short >= 1 && r.home === 0), 'off: on each deal a man stops at his door with the furniture a hand short and gives it up', rows(OFF));
verdict(staged && ON.every(r => r.home >= 1 && r.short === 0), 'on: he brings it the last of the way, and nobody gives furniture up at the door', rows(ON));
{ const a = OFF.reduce((n, r) => n + r.wedged, 0), b = ON.reduce((n, r) => n + r.wedged, 0);
  verdict(staged && b > a && ON.every((r, i) => r.wedged >= OFF[i].wedged), 'on: more doors end wedged over these deals, and no deal ends with fewer', `off ${a} doors wedged over ${SEEDS.length} deals, on ${b}`); }

// ---- a recording from before the key replays with the haul as it was; one that carries the key keeps its own word (journal.ts applyKnobs)
{ const J = await import(`${ROOT}/src/game/journal.ts`), W: any = await quiet(() => standUp({ uploadEvery: 4 })), g = W.game, was = HAULHOME.on;
  const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
  console.log('\nreplays');
  HAULHOME.on = true; const made = snap(); verdict(made.tables.HAULHOME?.on === true, 'a recording carries the key', `tables.HAULHOME ${JSON.stringify(made.tables.HAULHOME)}`);
  HAULHOME.on = true; const old = snap(); delete old.tables.HAULHOME; J.applyKnobs(g, old);
  verdict(HAULHOME.on === false, 'a recording from before the key replays with it off', `HAULHOME.on ${HAULHOME.on}`);
  HAULHOME.on = false; J.applyKnobs(g, made);
  verdict(HAULHOME.on === true, 'a recording made with it on keeps its own word', `HAULHOME.on ${HAULHOME.on}`);
  HAULHOME.on = true; const no = snap(); no.tables.HAULHOME = { on: false }; J.applyKnobs(g, no);
  verdict(HAULHOME.on === false, 'a recording made with it off keeps its own word', `HAULHOME.on ${HAULHOME.on}`);
  HAULHOME.on = was; }

console.log(fails ? `\n=== haulhome-check: ${fails} FAIL ===` : '\n=== haulhome-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
