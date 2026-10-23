// HOW MUCH YOU'RE TOLD — the fourth difficulty lever and the squad fog lever's bottom rung (src/game/told.ts — TOLD.on, TOLD.fogOff; both off as shipped
// in the module and on the frozen stand, both on in the page).
//   bun run tools/qa/probes.ts told          (family: told)        ·  bun run tools/qa/told-check.ts
// What it holds:
//   the rules     off = three levers, three rungs of fog, every question answers as Bare; on = a fourth lever (guided | standard | bare) that standard puts on
//                 Standard and hard on Bare, moved alone without touching the defenders' tables or the fog's rows, put back by a level, read from the URL
//                 and the store and carried on a link where nothing can be kept; `told=0` is never a rung
//   the marks     a room clear with Sam put beside a defender and taken away again: on Standard the mark stands and is gone inside `TOLD.standard` seconds,
//                 on Guided it is still there then and gone inside `TOLD.guided`, on Bare and with the switch off there is never one — and the four runs
//                 digest the same (the mark is the HUD's alone)
//   the fog off   the squad lever's bottom rung: a squad mission's link raises no fog and hides nobody, a quiet mission's and a lesson's links are read
//                 as they were, the lever put back raises the fog again; with the switch off 'off' is no rung
//   the screens   the mission sheet on a fake DOM: the fourth row under Enemy kit and the fog row's fourth button on a squad row, a press on each, Standard
//                 puts both back; the rows a quiet mission and a lesson show
//   the stands    the two rows of FROZEN_HOLDS with their words, the table in a recording, and a recording from before the keys
// TOLD_BREAK=1 leaves both switches down: exit 1. Run it on both stands (plain, and TPS_PROFILE=shipped): it raises what it needs itself.
// Nothing here looks at a picture: how the mark and the row READ is for a browser.
import { standUp, ROOT } from './headless.ts';
import { stage, quiet } from './thresholdmenu-probes.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const D = await import(`${ROOT}/src/game/difficulty.ts`);
const T = await import(`${ROOT}/src/game/told.ts`);
const RUN = await import(`${ROOT}/src/game/scenarioRun.ts`);
const QF = await import(`${ROOT}/src/game/quietfog.ts`);
const { PRESSURE } = await import(`${ROOT}/src/game/pressure.ts`);
const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { SCENARIOS, LESSON_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

const TOLD = T.TOLD, BREAK = process.env.TOLD_BREAK === '1', up = !BREAK;
const J = (o: unknown) => JSON.stringify(o);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const tables = () => J({ P: PRESSURE, D: DIGIN, cone: FOG.cone, own: FOG.own });
const keys = () => (D.leversNow() as { key: string; rungs: { id: string }[] }[]).map(l => `${l.key}:${l.rungs.map(r => r.id).join('|')}`).join(' ');
const Q = (s: string) => new URLSearchParams(s);
/** a store for the length of `fn` (null: a machine that can keep nothing), the page's own put back after */
async function withStore<R>(init: Record<string, string> | null, fn: (m: Map<string, string>) => Promise<R> | R): Promise<R> {
  const G = globalThis as any, had = 'localStorage' in G, prev = G.localStorage, m = new Map(Object.entries(init ?? {}));
  if (init === null) delete G.localStorage; else G.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
  try { return await fn(m); } finally { if (had) G.localStorage = prev; else delete G.localStorage; }
}
/** the module as a fresh page finds it: standard, no lever moved */
function fresh() { D.difficultyHere(''); D.setConeVisit(null); D.setDifficulty('standard', false); FOG.own = false; }

/** Sam put a stride from a defender nobody sees, then taken back: what the fog's last-seen list says along the way (tools/qa/calls-probes.ts's staging, FOG.lastSeen left at 0) */
async function sighting(rung: string | null) {
  const R = await stage(SCENARIOS.find((e: any) => e.id === 'room-clear-pair'), 1), g = R.g; FOG.lastSeen = 0; g.fogOfWar.on = true; g.aiEnabled = false;
  TOLD.on = rung !== null && up; fresh(); if (rung) D.setLever('told', rung, false);   // (after the stand: every game the frozen stand stands up puts its switches down again)
  for (const m of R.team) m.dazzledUntil = 1e9;   // (the team's own eyes shut: Sam's is the only one, where the probe puts it)
  const start = [...g.player.char.pos], hostiles = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
  await quiet(() => R.step(30)); const h = hostiles.find((x: any) => g.fogOfWar.hidden(x)); if (!h) return { ok: false, why: 'no defender out of the picture at the start' } as any;
  const hp = [...h.char.pos], before = g.fogOfWar.lastSeen().length;
  let near: number[] | null = null; for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9]]) { const p = [hp[0] + dx, 0, hp[2] + dz]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.5, p[2]], [hp[0], 1.5, hp[2]])) { near = p; break; } }
  if (!near) return { ok: false, why: 'no floor beside the defender' } as any;
  R.aim = [hp[0], 1.0, hp[2]]; g.teleportPlayer(near); await quiet(() => R.step(20)); const seen = g.fogOfWar.seen(h), during = g.fogOfWar.lastSeen().length;
  R.aim = null; g.teleportPlayer(start); const lostAt = g.time; await quiet(() => R.step(45)); const lost = g.fogOfWar.hidden(h);
  const mark = () => g.fogOfWar.lastSeen().find((x: any) => x.gd === h), m0 = mark(), early = !!m0, off = m0 ? flat(m0.at, hp) : -1, life = m0?.life ?? 0, age0 = m0?.age ?? -1;
  const until = async (age: number) => { await quiet(() => R.step(Math.max(0, Math.round((lostAt + age - g.time) * 60)))); return !!mark(); };   // (stepped until Sam has been gone `age` seconds: the same frames on every rung)
  FOG.lastSeen = 3; const byRow = mark()?.life ?? 0; FOG.lastSeen = 0;   // (the debugger's own row turned up is the seconds on every rung; at 0 the lever decides)
  const mid = await until(TOLD.standard + 1), late = await until(TOLD.guided + 1);
  return { ok: true, before, seen, during, lost, early, off, life, age0, byRow, mid, late, digest: hashDigest(digestGame(g, true)) };
}

/** THE OLDER LEVER CHECKS' HOLD (levers-probes.ts, quietfog-check.ts, sticky-check.ts stickyWays): both switches down for `fn`. Every line of those counts three levers
 *  and the squad fog's three rungs, which is the build with told.ts's switches off; this file has them up, on both stands. The shipped stand writes the switches once,
 *  at boot, so the hold stands for the run in this process (a playthrough a check spawns stands up by its own environment: nothing it tallies reads the lever) */
export async function threeLevers<R>(fn: () => Promise<R>): Promise<R> { const on = TOLD.on, off = TOLD.fogOff; TOLD.on = false; TOLD.fogOff = false; try { return await fn(); } finally { TOLD.on = on; TOLD.fogOff = off; } }

export async function toldCheck(): Promise<boolean> {
  const title = 'told: how much you\'re told — the fourth difficulty lever, its last-seen marks, and the squad fog lever\'s bottom rung';
  console.log(`\n=== ${title} ===`); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  await quiet(() => standUp({ uploadEvery: 1 }));   // (the stand's own values are on the tables from the first game it stands up: read them after one)
  const stood = { ...TOLD }, was = { ...TOLD }, qfWas = { ...QF.QUIETFOG }, fogWas = { ...FOG }, rnd = Math.random, G = globalThis as any;
  try {
    // ───────────────────────────── the rules
    await withStore(null, async () => {
      TOLD.on = false; TOLD.fogOff = false; fresh();
      const off = { keys: keys(), same: D.leversNow() === D.LEVERS, preset: J(D.presetLevers('standard')), now: T.toldNow(), secs: T.toldLastSeen(), least: T.toldAtLeast('standard') };
      D.setLever('told', 'guided', false); D.setLever('fog', 'off', false); const offMove = `${J(D.leversSet())} ${D.leversShown().fog} fogOff ${D.fogOffNow()}`;
      verdict(off.keys === 'fog:team|cones|own ai:standard|hard kit:none|stuns' && off.same && off.preset === '{"fog":"team","ai":"standard","kit":"none"}' && off.now === 'bare' && off.secs === 0 && !off.least && offMove === '{} team fogOff false',
        'both switches down: the three levers as they were, a level names no fourth rung, every question answers as Bare, and neither new rung can be set', `${off.keys} · LEVERS itself ${off.same} · standard ${off.preset} · now ${off.now}, ${off.secs} s · a move: ${offMove}`);

      TOLD.on = up; TOLD.fogOff = up; fresh();
      const t0 = tables(), std = `${T.toldNow()} ${T.toldLastSeen()}`; D.setDifficulty('hard', false); const hard = `${T.toldNow()} ${T.toldLastSeen()} ${D.difficultyNow()}`; D.setDifficulty('standard', false);
      D.setLever('told', 'guided', false); const moved = { now: T.toldNow(), secs: T.toldLastSeen(), level: D.difficultyNow(), mixed: D.leversMixed(), line: D.leversLine(), all: D.leversLine(true), tables: tables() === t0, least: `${T.toldAtLeast('guided')}/${T.toldAtLeast('standard')}` };
      D.setLever('told', 'bare', false); const bare = `${T.toldAtLeast('guided')}/${T.toldAtLeast('standard')}/${T.toldAtLeast('bare')} ${T.toldLastSeen()}`;
      D.setDifficulty('standard', false); const back = `${T.toldNow()} ${J(D.leversSet())} ${D.difficultyNow()}`;
      verdict(keys() === 'fog:off|team|cones|own ai:standard|hard kit:none|stuns told:guided|standard|bare' && std === `standard ${TOLD.standard}` && hard === 'bare 0 hard' && moved.now === 'guided' && moved.secs === TOLD.guided && TOLD.guided > TOLD.standard && TOLD.standard > 0
        && moved.level === 'custom' && moved.mixed && /told: guided$/.test(moved.line) && /^fog of war: all round · enemy AI: standard · enemy kit: guns · /.test(moved.all) && moved.tables && moved.least === 'true/true' && bare === 'false/false/true 0' && back === 'standard {} standard',
        'the lever up: a fourth lever after the three; standard puts it on Standard and hard on Bare; moved to Guided alone it is a mix of your own, the mark stays longer, and the defenders\' tables and the fog\'s rows are untouched; a level puts it back',
        `${keys()}\n    standard: ${std} s · hard: ${hard} · guided: ${moved.secs} s, reads ${moved.level}, '${moved.line}', tables untouched ${moved.tables} · bare: ${bare} · standard again: ${back}`);

      D.setLever('fog', 'cones', false); D.setLever('ai', 'hard', false); const three = `${D.difficultyNow()} ${T.toldNow()} ${J(D.leversSet())}`; D.setLever('told', 'standard', false, ''); const four = `${D.difficultyNow()} ${T.toldNow()}`; D.setLever('told', 'bare', false, ''); const back3 = `${D.difficultyNow()} ${T.toldNow()} ${J(D.leversSet())}`; /* (a press on the rung it follows the three to lets it go, as a press on a level's own rung does) */ D.setLever('told', null, false); D.setLever('ai', 'standard', false); const two = `${D.difficultyNow()} ${T.toldNow()}`; D.setDifficulty('standard', false);
      verdict(three === 'hard bare {"fog":"cones","ai":"hard"}' && four === 'custom standard' && back3 === 'hard bare {"fog":"cones","ai":"hard"}' && two === 'custom standard', 'hard\'s three rungs set lever by lever over standard are still Hard: the fourth, left alone, follows the level the three stand on (Bare); moved back to Standard by hand it is a mix, and pressed onto Bare again it is let go of (Hard, nothing pinned); with the three on no level it is the level\'s under them',
        `fog cones + AI hard: reads ${three} · told put on standard: ${four} · and on bare again: ${back3} · AI back on standard (fog still cones): ${two}`);

      // the URL, the store, a link
      fresh(); D.initDifficulty(Q('told=guided')); const url = T.toldNow(); fresh(); D.initDifficulty(Q('told=0')); const zero = `${T.toldNow()} ${J(D.leversSet())}`;
      fresh(); D.initDifficulty(Q('told=guided'), true); const plain = T.toldNow();
      fresh(); D.setLever('told', 'guided', false); const carriedBare = D.leversHref('?roomclear&squad4');
      verdict(url === (up ? 'guided' : 'bare') && zero === (up ? 'standard {}' : 'bare {}') && plain === (up ? 'standard' : 'bare') && carriedBare === `?roomclear&squad4${up ? '&told=guided' : ''}`,
        '?told=guided is the rung for the visit, ?told=0 (the switch\'s own word) is no rung, a Training lesson\'s page reads neither, and a link carries a moved lever where nothing can be kept', `?told=guided → ${url} · ?told=0 → ${zero} · a lesson's page → ${plain} · link '${carriedBare}'`);
    });
    await withStore({ 'twopointsix.levers': '{"told":"guided","fog":"off"}' }, async store => {
      fresh(); D.initDifficulty(Q('')); const kept = `${T.toldNow()} fog ${D.leversShown().fog}`, href = D.leversHref('?roomclear&squad4');
      D.setDifficulty('standard'); const dropped = `${T.toldNow()} fog ${D.leversShown().fog} kept ${store.get('twopointsix.levers') ?? '(none)'}`;
      store.set('twopointsix.levers', '{"told":"guided","fog":"off"}'); TOLD.on = false; TOLD.fogOff = false; fresh(); D.initDifficulty(Q('')); const down = `${T.toldNow()} fog ${D.leversShown().fog} ${J(D.leversSet())}`; TOLD.on = up; TOLD.fogOff = up;
      verdict(kept === 'guided fog off' && href === '?roomclear&squad4' && dropped === 'standard fog team kept (none)' && down === 'bare fog team {}',
        'both rungs kept on this machine are read back at boot and ride on no link; Standard pressed drops them; with the switches down the kept rungs are not read', `kept → ${kept} · link '${href}' · Standard → ${dropped} · switches down → ${down}`);
      // (a visit with a switch off — ?told=0, ?fogoff=0 — and a lever moved on it: the rungs that visit hides are still kept after)
      store.set('twopointsix.levers', '{"told":"guided","fog":"off"}'); TOLD.on = false; TOLD.fogOff = false; fresh(); D.initDifficulty(Q('')); D.setLever('kit', 'stuns'); const hid = store.get('twopointsix.levers') ?? '(none)';
      D.setLever('fog', 'cones'); const over = store.get('twopointsix.levers') ?? '(none)'; D.setDifficulty('standard'); const gone = store.get('twopointsix.levers') ?? '(none)'; TOLD.on = up; TOLD.fogOff = up; fresh();
      verdict(up ? hid === '{"told":"guided","fog":"off","kit":"stuns"}' && over === '{"told":"guided","fog":"cones","kit":"stuns"}' && gone === '(none)' : false,
        'a visit with both switches off keeps the rungs it hides when a lever is moved on it (a fog rung moved there is the fog\'s), and a level picked drops them with the rest', `kit moved → ${hid} · fog moved → ${over} · Standard → ${gone}`);
    });

    // ───────────────────────────── the fog off, as a mission's start reads it
    await withStore(null, async () => {
      const four = '?roomclear&squad4', quietLink = '?quiet&levelFile=bazaar.json&quietfog=team', lesson = LESSON_MISSIONS.find((e: any) => e.kind === 'roomclear' || e.kind === 'rescue'), lessonLink = lesson ? `?${lesson.kind}&levelFile=${lesson.level}` : '';
      QF.QUIETFOG.on = true; TOLD.fogOff = up; fresh();
      const f0 = RUN.fogOfQuery(Q(four)); D.setLever('fog', 'off', false);
      const f = { off: D.fogOffNow(), shown: D.leversShown().fog, level: D.difficultyNow(), line: D.leversLine(), cone: FOG.cone, own: FOG.own, squad: RUN.fogOfQuery(Q(four)), link: RUN.fogOfLink(Q(four)), quiet: RUN.fogOfQuery(Q(quietLink)), lesson: lessonLink ? RUN.fogOfQuery(Q(lessonLink)) : true, same: RUN.sameFog(four, four) };
      const restaged = async () => { const E = SCENARIOS.find((e: any) => e.id === 'room-clear-four'), R = await stage(E, 1); TOLD.fogOff = up;   // (the stand put the switch down as it stood the game up: raised again, and the mission started again as the page starts it)
        await quiet(() => RUN.quitScenario(R.g)); const { why } = await quiet(() => RUN.startFromQuery(R.g, Q(scenarioQuery(E)))); if (why) throw new Error(`room-clear-four: ${why}`); await quiet(() => R.step(30)); return R; };
      const R = await restaged();
      const live = R.g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), offRun = `fog ${R.g.fogOfWar.on}, hidden ${live.filter((x: any) => R.g.fogOfWar.hidden(x)).length} of ${live.length}`;
      D.setConeVisit(true); const coned = `${D.leversShown().fog} cone ${FOG.cone} starts ${RUN.fogOfQuery(Q(four))}`; D.setConeVisit(null);   // (?fogcone over the kept rung: the lit rung is still the one the mission starts under)
      const named = `${RUN.fogOfQuery(Q(`${four}&fow`))} ${RUN.fogOfQuery(Q('?fow'))} ${RUN.sameFog('?solo&quietfog=off', '?fow')}`;   // (a link that asks for the fog by name gets it, so the plain page's ?fow is what a quit puts back)
      D.setLever('fog', 'cones', false); const cones = `${D.leversShown().fog} cone ${FOG.cone} fogOff ${D.fogOffNow()} ${RUN.fogOfQuery(Q(four))}`; D.setLever('fog', null, false);
      const R2 = await restaged();
      const live2 = R2.g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), onRun = `fog ${R2.g.fogOfWar.on}, hidden ${live2.filter((x: any) => R2.g.fogOfWar.hidden(x)).length} of ${live2.length}`;
      verdict(f0 && f.off && f.shown === 'off' && f.level === 'custom' && f.line === 'fog of war: off' && !f.cone && !f.own && !f.squad && f.link && f.quiet && f.lesson && /^fog false, hidden 0 of [1-9]/.test(offRun) && coned === 'off cone true starts false' && named === 'true true false' && cones === 'cones cone true fogOff false true' && /^fog true, hidden [1-9]/.test(onRun),
        'the squad fog lever on its bottom rung: a squad mission\'s link raises no fog and the run hides nobody, while the link still says the mission has a fog (the lever stays live), and a quiet mission\'s and a lesson\'s links are read as they were; another rung, or the lever let go, raises the fog again',
        `off: lever '${f.shown}' ('${f.line}', reads ${f.level}), rows cone ${f.cone} own ${f.own} · ${four}: fog ${f.squad} (the link's own ${f.link}) · quiet ${f.quiet} · lesson ${lessonLink || '(none)'} ${f.lesson}\n    the run: ${offRun} · the cone row flipped over it: ${coned} · a link with fow, the plain page's ?fow, the solo night against it: ${named} · cones: ${cones} · let go: ${onRun}`);
    });

    // ───────────────────────────── the marks
    await withStore(null, async () => {
      const std = await sighting('standard'), gui = await sighting('guided'), bare = await sighting('bare'), down = await sighting(null);
      if (!std.ok || !gui.ok || !bare.ok || !down.ok) { verdict(false, 'the staging of the sighting', std.why ?? gui.why ?? bare.why ?? down.why); return; }
      const say = (r: any) => `seen ${r.seen}, lost ${r.lost} · marks before ${r.before}, in sight ${r.during}, lost ${r.early}${r.early ? ` (${r.age0.toFixed(2)} s old of ${r.life}, ${r.off.toFixed(2)} m off)` : ''}, at ${TOLD.standard + 1} s ${r.mid}, at ${TOLD.guided + 1} s ${r.late}`;
      verdict(std.seen && std.lost && std.before === 0 && std.during === 0 && std.early && std.off < 0.3 && std.life === TOLD.standard && !std.mid && !std.late, 'Standard: an enemy seen and then lost keeps a mark where he stood, and it is gone inside the rung\'s few seconds', say(std));
      verdict(gui.seen && gui.lost && gui.during === 0 && gui.early && gui.off < 0.3 && gui.life === TOLD.guided && gui.mid && !gui.late, 'Guided: the same mark is still there when Standard\'s is gone, and gone inside its own longer life', say(gui));
      verdict(bare.seen && bare.lost && !bare.early && !bare.mid && down.seen && down.lost && !down.early && !down.mid, 'Bare, and the lever switched off: the same sighting and loss leave no mark', `bare: ${say(bare)}\n    switch down: ${say(down)}`);
      verdict(std.byRow === 3 && gui.byRow === 3 && bare.byRow === 3 && down.byRow === 3, 'the debugger\'s own row (fog ▸ last seen s) turned up is the mark\'s seconds on every rung and with the lever off, as it always was; at 0 the lever decides', `at 3 s: standard ${std.byRow} · guided ${gui.byRow} · bare ${bare.byRow} · switch down ${down.byRow}`);
      verdict(std.digest === gui.digest && gui.digest === bare.digest && bare.digest === down.digest, 'the four runs digest the same: the mark is the HUD\'s alone, a run is the same run on every rung and with the lever off', `standard ${std.digest} · guided ${gui.digest} · bare ${bare.digest} · down ${down.digest}`);
    });

    // ───────────────────────────── the screens
    await withStore({}, async store => { await withDom('?quality=high&mute', async () => {
      G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
      const M = await import(`${ROOT}/src/ui/missions.ts`);
      const rowsOf = (root: El) => root.all(e => !!e.attrs['data-lever'] && e.attrs['data-lever'] !== 'cams').map(r => ({ key: r.attrs['data-lever'], na: r.cls.has('na'), moved: r.cls.has('moved'),
        btns: r.all(e => e.tagName === 'BUTTON'), shown: r.all(e => e.tagName === 'BUTTON' && (e as any).style.display !== 'none').map(b => b.attrs['data-rung']).join('|'), lit: r.all(e => e.tagName === 'BUTTON' && e.cls.has('on')).map(b => b.attrs['data-rung']).join(','), note: r.all(e => e.tagName === 'SPAN').at(-1)?.textContent ?? '' }));
      const press = (root: El, key: string, rung: string) => { const b = rowsOf(root).find(r => r.key === key)?.btns.find(b => b.attrs['data-rung'] === rung); if (!b?.onclick) throw new Error(`no ${key}:${rung} button`); b.onclick(); };
      const sheet = (on: boolean) => { TOLD.on = on; TOLD.fogOff = on; QF.QUIETFOG.on = true; QF.QUIETFOG.solo = true; QF.quietFogForget(); fresh(); M.MISSIONS.onPick = null; const host = new El('DIV') as any, list: any[] = M.missionList();
        const S = M.openMissions({ root: host, select: 'room-clear-four', search: '?quality=high&mute', onPick: () => { } }); return { S, root: S.root as unknown as El, list }; };
      const said = (rows: ReturnType<typeof rowsOf>) => rows.map(r => `${r.key} [${r.shown}] lit ${r.lit}${r.na ? ' greyed' : ''}${r.moved ? ' moved' : ''}`).join(' · ');
      { const { S, root } = sheet(false), r = rowsOf(root); verdict(r.map(x => `${x.key} [${x.shown}]`).join(' ') === 'fog [team|cones|own] ai [standard|hard] kit [none|stuns]', 'the sheet with both switches down: the three rows, the fog\'s three rungs', said(r)); S.close(); }
      const { S, root, list } = sheet(up), r0 = rowsOf(root), four = list.find(m => m.id === 'room-clear-four');
      verdict(r0.map(x => `${x.key} [${x.shown}]`).join(' ') === 'fog [off|team|cones|own] ai [standard|hard] kit [none|stuns] told [guided|standard|bare]' && r0.map(x => x.lit).join('/') === 'team/standard/none/standard' && r0.every(x => !x.na && !x.moved && x.note.length > 20),
        'the sheet of a squad mission: a fourth row under Enemy kit lit on Standard, and the fog row has its bottom rung', `${said(r0)}\n    told: '${r0[3]?.note}'`);
      press(root, 'told', 'guided'); const r1 = rowsOf(root), dn1 = root.all(e => !!e.attrs['data-difficulty'] && e.cls.has('on')).length, mix1 = root.all(e => e.cls.has('dn'))[0]?.textContent ?? '';
      verdict(r1[3]?.lit === 'guided' && r1[3].moved && !r1[0].moved && dn1 === 0 && /^your own mix: .*told: guided$/.test(mix1) && store.get('twopointsix.levers') === '{"told":"guided"}' && T.toldNow() === 'guided',
        'Guided pressed: that row alone is moved and kept on this machine, neither Standard nor Hard is lit, and the Difficulty row says your own mix', `${said(r1)} · kept ${store.get('twopointsix.levers')} · '${mix1}'`);
      press(root, 'fog', 'off'); const r2 = rowsOf(root), go2 = root.all(e => e.cls.has('mgo'))[0]?.attrs.href ?? '';
      verdict(r2[0].lit === 'off' && r2[0].moved && !r2[0].na && /you and your team always know where every enemy is/.test(r2[0].note) && !r2[3].na && r2[3].lit === 'guided' && D.fogOffNow() && !RUN.fogOfQuery(Q(go2)) && store.get('twopointsix.levers') === '{"told":"guided","fog":"off"}',
        'the fog row\'s bottom rung pressed: lit, still live, its line says the team knows every enemy too, the mission\'s link would start with no fog, and the fourth row stays live beside it (the lever is for more signs than the fog\'s mark)', `${said(r2)}\n    '${r2[0].note}' · go '${go2}'`);
      const quietM = list.find(m => m.scenario?.kind === 'quiet' && m.scenario.group !== 'training' && m.scenario.group !== 'tutorial'), lessonM = list.find(m => m.scenario?.group === 'training');
      if (quietM) S.select(quietM.id); const rq = quietM ? rowsOf(root) : []; const qHref = quietM ? S.hrefOf(quietM) : ''; if (lessonM) S.select(lessonM.id); const rl = lessonM ? rowsOf(root) : []; S.select(four.id);
      verdict((!quietM || (rq[0].lit === QF.quietFog() && !rq[0].na && !rq[3].na && rq[1].na && RUN.fogOfQuery(Q(qHref)) === (QF.quietFog() !== 'off'))) && rl.every(x => x.na),
        'a quiet mission\'s row: its fog lever is its own pick (the squad\'s off is not put on it) and the fourth row is live there; a lesson greys all four', `${quietM ? `${quietM.id}: ${said(rq)} · its link's fog ${RUN.fogOfQuery(Q(qHref))}` : '(no quiet mission)'}\n    ${lessonM ? `${lessonM.id}: ${said(rl)}` : '(no lesson)'}`);
      root.all(e => e.attrs['data-difficulty'] === 'standard')[0].onclick!(); const r3 = rowsOf(root);
      if (lessonM) S.select(lessonM.id); const rl3 = lessonM ? rowsOf(root) : []; S.select(four.id);
      verdict(r3.map(x => x.lit).join('/') === 'team/standard/none/standard' && r3.every(x => !x.moved) && !D.fogOffNow() && T.toldNow() === 'standard' && store.get('twopointsix.levers') === undefined && (!lessonM || rl3[0].shown === 'team|cones|own'),
        'Standard pressed: all four rows back on standard\'s rungs and nothing kept; a Training lesson\'s fog row then offers no off', `${said(r3)} · kept ${store.get('twopointsix.levers') ?? '(none)'}${lessonM ? `\n    ${lessonM.id}: ${said(rl3)}` : ''}`);
      root.all(e => e.attrs['data-difficulty'] === 'hard')[0].onclick!(); const r4 = rowsOf(root), hardLit = root.all(e => e.attrs['data-difficulty'] === 'hard')[0]?.cls.has('on');
      verdict(r4[3]?.lit === 'bare' && !r4[3].moved && !!hardLit && T.toldLastSeen() === 0, 'Hard pressed: the fourth row is on Bare, its own rung there, and no mark is left', said(r4));
      root.all(e => e.attrs['data-difficulty'] === 'standard')[0].onclick!(); S.close();
      // (d) the loadout screen of the same mission: the same four rows, the fourth live beside the fog's whatever its rung
      { D.setLever('told', 'guided'); D.setLever('fog', 'off'); const UI = await import(`${ROOT}/src/ui/loadout.ts`), e4 = SCENARIOS.find((e: any) => e.id === 'room-clear-four'), L = UI.openLoadout(e4, { host: new El('DIV') as any, search: M.missionHref(four, '?quality=high&mute'), deploy: () => { }, back: () => { } }), lroot = L.root as unknown as El;
        const l0 = rowsOf(lroot); press(lroot, 'fog', 'team'); const l1 = rowsOf(lroot); L.close(); D.setDifficulty('standard');
        verdict(l0.map(x => x.key).join(',') === 'fog,ai,kit,told' && l0[0].lit === 'off' && !l0[0].na && !l0[3].na && l0[3].lit === 'guided' && !l1[3].na && l1[0].lit === 'team', 'the loadout screen of that mission: the same four rows, the fourth live beside the fog\'s on its off rung and on another', `${said(l0)}\n    fog put on all round: ${said(l1)}`); }
      const words = [D.TOLD_LEVER.label, ...D.TOLD_LEVER.rungs.map((x: any) => `${x.label} ${x.words}`), D.FOG_OFF_RUNG.words].join(' ');
      verdict(!/[6-9]|\d\d/.test(words) && !/\b(north|south|east|west)/i.test(words) && !/hit points|\bHP\b/i.test(words), 'the new rows\' words: no digit above 5, no compass word, nothing about hit points', words);
    }); });

    // ───────────────────────────── the two stands, and a recording
    const ENV = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], PR = await import(`${ROOT}/src/host/profile.ts`), JR = await import(`${ROOT}/src/game/journal.ts`);
    const shipped = process.env.TPS_PROFILE === 'shipped';
    verdict(stood.on === (shipped || process.env.TPS_TOLD === '1') && stood.fogOff === (shipped || process.env.TPS_FOGOFF === '1') && stood.rung === 'standard',
      'as the stand stands a game up: both switches up on the shipped stand, down on the frozen one unless its word raises one; the rung is Standard on both', `${shipped ? 'shipped' : 'frozen'} stand: TOLD.on ${stood.on}, TOLD.fogOff ${stood.fogOff}, rung ${stood.rung}`);
    const W2 = await quiet(() => standUp({ uploadEvery: 1 })) as any; TOLD.on = true; TOLD.fogOff = true;
    const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W2.game))), old = JSON.parse(JSON.stringify(snap)), had = snap.tables.TOLD?.on === true && snap.tables.TOLD?.fogOff === true;
    TOLD.on = false; TOLD.fogOff = false; JR.applyKnobs(W2.game, snap); const kept = `${TOLD.on}/${TOLD.fogOff}`; delete old.tables.TOLD; TOLD.on = true; TOLD.fogOff = true; JR.applyKnobs(W2.game, old); const before = `${TOLD.on}/${TOLD.fogOff}`;
    verdict(ENV.includes('TPS_TOLD') && ENV.includes('TPS_FOGOFF') && PR.FROZEN_HOLDS['TOLD.on'] === 'TPS_TOLD=1' && PR.FROZEN_HOLDS['TOLD.fogOff'] === 'TPS_FOGOFF=1' && had && kept === 'true/true' && before === 'false/false',
      'both switches are rows of the two stands\' list with their words, ride a recording\'s tables, and a recording from before the keys replays with both down', `STAND_ENV ${ENV.includes('TPS_TOLD')}/${ENV.includes('TPS_FOGOFF')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['TOLD.on']}, ${PR.FROZEN_HOLDS['TOLD.fogOff']} · in the tables ${had} · recorded up: ${kept} · an old recording: ${before}`);
  } catch (e) { verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally {
    Object.assign(TOLD, was); Object.assign(QF.QUIETFOG, qfWas); QF.quietFogForget(); try { await withStore(null, () => { fresh(); }); } catch { /* nothing to put back */ }
    Object.assign(FOG, fogWas); Math.random = rnd;
  }
  console.log(`=== told: ${all ? 'ALL PASS' : 'FAILURES above'}${BREAK ? ' · TOLD_BREAK=1' : ''} ===`);
  return all;
}
if (import.meta.main) { const ok = await toldCheck(); process.exit(ok ? 0 : 1); }
