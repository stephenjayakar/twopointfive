// A PARTNER'S MEN ARE ON SAM'S CARD — the check behind src/game/teamtally.ts (TEAMTALLY.on: on in the page, `?noteamtally`; off on the frozen stand,
// TPS_TEAMTALLY=1; the check sets the table itself). A quiet mission as two (levels/train-silent.json, `?quiet&squad=1`) is staged headless and defenders are put down the way
// combat.ts, pairorders.ts and spotted.ts do it for the partner — killGuard(…, 'guard'), `killerId` his where a round was his — then one step is played and the
// run's numbers, badges and timeline are read.
//   bun run tools/qa/teamtally-check.ts        (also `probes.ts teamtally`)        exit 0 = all hold · 1 = one does not
//   TEAMTALLY_BREAK=1 = the switch left off for the 'on' lines: (2), (3), (4) and (6) must fail. Both stands: plain = FROZEN, TPS_PROFILE=shipped in front.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function teamTallyCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { TEAMTALLY } = await import(`${ROOT}/src/game/teamtally.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { hostileTo } = await import(`${ROOT}/src/game/teams.ts`);
  const { runCounts, badgesOf, eventText } = await import(`${ROOT}/src/game/chronicle.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const BREAK = process.env.TEAMTALLY_BREAK === '1';
  let allPass = true; const line = (ok: boolean, label: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}`); };
  const hush = <T>(f: () => T): T => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return f(); } finally { console.log = l; console.warn = w; } };
  const text = readFileSync(resolve(ROOT, 'levels/train-silent.json'), 'utf8');
  const was = TEAMTALLY.on;

  async function stage(on: boolean, squad: 0 | 1 = 1) {
    const W: any = await hush(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(text)), seed: 3 }));
    TEAMTALLY.on = on && !BREAK;   // (after the stand-up: the frozen stand pins it off, the shipped one raises it)
    const g = W.game;
    const started = hush(() => startFromQuery(g, `?levelFile=train-silent.json&quiet${squad ? '&squad=1' : ''}`));
    if (!started.spec) throw new Error(`the quiet mission did not start: ${started.why}`);
    const step = (n = 1) => hush(() => { for (let i = 0; i < n; i++) W.step(1 / 60); });
    step(3);
    const foes = () => g.guards.filter((x: any) => x.team !== 'operative' && !x.civ && x.state !== 'dead' && hostileTo(x, 'player'));
    const mate = teamOf(g)[0] ?? null;
    /** a man put down inside a step the way the partner's sites do it (the game's own order: the kill, then whose round it was) */
    const down = (h: any, how: 'shot' | 'struck' | 'wounded', by: 'player' | 'guard', killer: number | null) => hush(() => {
      // the kill lands MID-step, as a round or a takedown does: after the step's clock has moved, before the step's tail (the fog's update is on the way there)
      const pre = g.fogOfWar.update.bind(g.fogOfWar);
      g.fogOfWar.update = (dt: number) => { g.fogOfWar.update = pre; killGuard(g, h, [1, 0, 0], how === 'struck', how, by); if (killer !== null) h.killerId = killer; return pre(dt); };
      W.step(1 / 60);
    });
    const C = () => runCounts(g), badge = (id: string) => !!badgesOf(C()).find((b: any) => b.id === id)?.on;
    const rows = () => (g.chronicle.events as any[]).filter(e => e.kind === 'kill' || e.kind === 'ko').map(e => eventText(e));
    return { W, g, step, foes, mate, down, C, badge, rows };
  }

  try {
    // (1) off: the card as it was — and the run the same run
    { const A = await stage(false); const [h] = A.foes();
      A.down(h, 'shot', 'guard', A.mate.char.id); A.step(2);
      line(!!A.mate && A.C().kills === 0 && A.C().kos === 0 && A.badge('nokills') && A.rows().length === 0, `(1) off: the partner's round kills a man and the card reads as it did — kills ${A.C().kills}, 'no kills' ${A.badge('nokills')}, rows ${A.rows().length}`); }
    // (2) on: his round is a kill on the card, with its row
    { const A = await stage(true); const [h] = A.foes();
      A.down(h, 'shot', 'guard', A.mate.char.id); A.step(2);
      line(A.C().kills === 1 && A.C().kos === 0 && !A.badge('nokills') && !A.badge('pacifist') && A.rows().length === 1 && A.rows()[0].includes(A.mate.callsign), `(2) on: the partner's round is a kill — kills ${A.C().kills}, 'no kills' ${A.badge('nokills')}, 'pacifist' ${A.badge('pacifist')}, row '${A.rows()[0] ?? ''}'`);
      A.step(30);
      line(A.C().kills === 1 && A.rows().length === 1, `(3) on: counted once — thirty steps later kills ${A.C().kills}, rows ${A.rows().length}`); }
    // (4) on: his takedown (no name on it, as pairorders.ts leaves it) is a knockout; a wounding round a knockout and a round near a man
    { const A = await stage(true); const [h, k] = A.foes();
      A.down(h, 'struck', 'guard', null); A.step(2);
      const ko1 = A.C().kos, kills1 = A.C().kills, keep = A.badge('nokills') && A.badge('pacifist');
      A.down(k, 'wounded', 'guard', A.mate.char.id); A.step(2);
      line(ko1 === 1 && kills1 === 0 && keep && A.C().kos === 2 && A.C().kills === 0 && A.badge('nokills') && !A.badge('pacifist'), `(4) on: his takedown is a knockout (KOs ${ko1}, 'pacifist' kept ${keep}); his wounding round a knockout and no pacifist's (KOs ${A.C().kos}, 'pacifist' ${A.badge('pacifist')})`); }
    // (5) on: what is not the team's stays on nobody's card; the player's own is counted once
    { const A = await stage(true); const [h, k, m] = A.foes();
      A.down(h, 'shot', 'guard', k.char.id); A.step(2);
      const stray = A.C().kills;
      A.down(k, 'shot', 'player', null); A.step(2);
      line(stray === 0 && A.C().kills === 1 && !!m, `(5) on: a defender's round into his own side is on nobody's card (kills ${stray}); the player's own kill is counted once (kills ${A.C().kills})`); }
    // (6) on, alone: no partner, no rule
    { const A = await stage(true, 0); const [h, k] = A.foes();
      A.down(h, 'struck', 'guard', null); A.step(2);
      const B = await stage(true); const [h2] = B.foes(); B.down(h2, 'struck', 'guard', null); B.step(2);
      line(!A.mate && A.C().kos === 0 && B.C().kos === 1 && !!k, `(6) on: alone, a man struck by 'guard' is nobody's (KOs ${A.C().kos}); as two he is the partner's (KOs ${B.C().kos})`); }
    // (7) off = the build as it was, by run digest; on with nobody down = the same run too
    { const run = async (on: boolean, kill: boolean) => { const A = await stage(on); const [h] = A.foes(); A.step(20); if (kill) A.down(h, 'shot', 'guard', A.mate.char.id); A.step(40); return hashDigest(digestGame(A.g)); };
      const off = await run(false, true), off2 = await run(false, true), onIdle = await run(true, false), offIdle = await run(false, false);
      line(off === off2 && onIdle === offIdle, `(7) off twice is one run (${off} / ${off2}); on with nobody down is the off run (${onIdle} / ${offIdle})`); }
  } finally { TEAMTALLY.on = was; }
  console.log(allPass ? '\nteamtally-check: all hold' : '\nteamtally-check: FAIL');
  return allPass;
}
if (import.meta.main) process.exit((await teamTallyCheck()) ? 0 : 1);
