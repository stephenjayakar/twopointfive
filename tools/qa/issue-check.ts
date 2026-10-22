// A KIT ISSUED BY THE LEVEL — the check behind src/game/kit.ts `kitIssue` (`ISSUE.on`, the level block `scenarios.issue`; today levels/hall.json alone).
//   bun run tools/qa/issue-check.ts
// What it holds (the game stood up by the harness, the long hall's room clear staged with the four):
//   1. the file: the block is read (the long hall's names no card: the plain issue for every man), and the validator refuses a place that is no member, an unknown field and a count out of range
//   2. the staging: with a CHANGED kit kept on the machine (Red Two keeps a pistol, Red One has no cans) the men are staged with the level's cards — the plain
//      issue, a rifle and his cans for every man — and neither the table nor its store is written
//      and A BLOCK THAT NAMES A CARD (no level file has one today: the long hall's own text with the first teammate's card written into its block — a pistol,
//      no charges, no frags) stages that man with it and the others plain, over the same kept kit
//   3. a restart stages the same cards again
//      and YOUR OWN four counts are what a level with no block gives you, with the pouches rule on (one of each) and off (what a Player is built with)
//      and at EVERY SQUAD SIZE a URL can stage (4, 3, 2, 1, 0; pouches rule on) the named card is on the first man who comes and on nobody else
//   4. off (`ISSUE.on` false, the page's ?noissue): the same staging wears the kept kit
//   5. a level without the block: the switch on and off stage the same game, digest for digest, over two seconds
//   ISSUE_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const FILE = 'hall.json', PLAIN = 'killhouse.json';
/** the card the check writes into the long hall's block for its 'a block that names a card' lines: the first teammate's place */
const CARD = { weapon: 'pistol', bangs: 2, charges: 0, frags: 0 };

export async function issueCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const K = await import(`${ROOT}/src/game/kit.ts`), { ISSUE, KIT, KIT_LS } = K;
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`), { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
  const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const brk = process.env.ISSUE_BREAK === '1', knobs0 = knobsCopy();

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; console.error = e; } };
  const textOf = (file: string) => readFileSync(resolve(ROOT, 'levels', file), 'utf8');
  const memStore = (seed?: string) => { const m = new Map<string, string>(); if (seed !== undefined) m.set(KIT_LS, seed); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  /** the long hall's text with CARD in its block, at the first teammate's place */
  const named = () => { const d = JSON.parse(textOf(FILE)); d.scenarios.issue = { members: { '1': CARD } }; return JSON.stringify(d); };
  /** a Game on `file` (or on `text`, a level's own words) with its room clear staged for `squad` teammates (the four unless said); the men in roster order */
  async function stage(file: string, on: boolean, dice: number | null = 5, slots?: boolean, squad = 4, text = textOf(file)) {
    ISSUE.on = on && !brk; ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0; NIGHTBREACH.squad = squad;
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(text)), seed: dice }));
    if (slots !== undefined) K.SLOTS.on = slots && K.SLOTS.ok;
    const g = W.game, why = await quiet(() => g.roomClear.start(0)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`);
    const men = () => g.orders.men('all', { down: true }) as any[];
    return { W, g, men, step: (n = 1) => quiet(() => { for (let i = 0; i < n; i++) W.step(1 / 60); }) };
  }
  const worn = (men: any[]) => men.map(m => `${m.callsign}: ${m.weapon.def.cls}, ${K.kitOf(m)?.bangs} stun`).join(' · ');
  const pistol = (m: any) => m.weapon.def.cls === 'pistol';

  try {
    // 1. the file
    const data = parseLevelData(textOf(FILE)), D = data.scenarios?.issue;
    line(!!D && Object.keys(D.members).length === 0, `${FILE} carries an issue, and it names no card (the plain issue for every man): ${JSON.stringify(D?.members)}`);
    const refused = (patch: unknown) => { const d = JSON.parse(textOf(FILE)); d.scenarios.issue = patch; return validateLevelData(d).some((e: string) => /issue/.test(e)); };
    line(validateLevelData(JSON.parse(textOf(FILE))).length === 0 && validateLevelData(JSON.parse(named())).length === 0 && refused({ members: { '7': { bangs: 1 } } }) && refused({ members: { '1': { armour: 3 } } }) && refused({ members: { '1': { bangs: 12 } } }) && refused({ members: { '1': { light: 'yes' } } })
      && !refused({ members: { '0': { charges: 1, walls: 1 } } }) && refused({ members: { '2': { shells: 1 } } }) && refused({ members: { '1': { weapon: 'cannon' } } }),
      'the validator takes the file, and the file with a card in its block, and refuses a place that is no member, an unknown field, a count out of range, a switch that is not true / false, 40 mm on a teammate\'s and a weapon no card has, and takes charges on your own card (read where your own charges are on)');

    // 2. the staging over a changed kit
    K.kitLoad(null, '?noslots'); K.kitReset();
    const mine = KIT.members.map((m: any) => ({ ...m })); mine[1].bangs = 0; mine[2].weapon = 'pistol';
    const st = memStore(JSON.stringify({ v: 2, members: mine })); K.kitLoad(st, '?noslots');
    const kept0 = JSON.stringify(KIT.members), store0 = st.m.get(KIT_LS);
    line((KIT.members[2] as any).weapon === 'pistol' && (KIT.members[1] as any).bangs === 0, 'the machine keeps another kit: Red Two with a pistol, Red One with no cans');
    const issue1 = K.kitDefault(1);
    // 2a. the long hall as it is filed: the plain issue for every man
    const H = await stage(FILE, true); await H.step(3);
    { const m = H.men();
      line(m.length === 4 && m.every(x => !pistol(x)) && K.kitOf(m[0])?.bangs === issue1.bangs && K.kitOf(m[0])?.charges === issue1.charges && issue1.bangs > 0,
        `${FILE} staged with the plain issue whatever is kept (no pistol on Red Two, Red One's cans on him) — ${worn(m)}`);
      line(JSON.stringify(KIT.members) === kept0 && st.m.get(KIT_LS) === store0, 'the table and its store are as the machine kept them: nothing worn, nothing written'); }
    // 2b. a block that names a card: its fields over the issue card of that place, the others plain
    const A = await stage(FILE, true, 5, undefined, 4, named()); await A.step(3);
    { const m = A.men();
      line(m.length === 4 && pistol(m[0]) && m.slice(1).every(x => !pistol(x)),
        `a block that names a card (${JSON.stringify(CARD)} for the first teammate): staged with the level's cards whatever is kept — ${worn(m)}`);
      line(K.kitOf(m[0])?.bangs === CARD.bangs && K.kitOf(m[0])?.charges === CARD.charges && K.kitOf(m[0])?.frags === CARD.frags && K.kitOf(m[0])?.light === issue1.light && CARD.charges !== issue1.charges,
        `Red One's card is the level's, and what the block does not name is the issue's: ${K.kitOf(m[0])?.bangs} bangs, ${K.kitOf(m[0])?.charges} charges, light ${K.kitOf(m[0])?.light}`);
      line(JSON.stringify(KIT.members) === kept0 && st.m.get(KIT_LS) === store0, 'the table and its store are as the machine kept them: nothing worn, nothing written'); }

    // 3. a restart
    await quiet(() => A.g.restartEncounter()); await A.step(3);
    { const m = A.men(); line(m.length === 4 && pistol(m[0]) && m.slice(1).every(x => !pistol(x)) && K.kitOf(m[0])?.charges === CARD.charges && JSON.stringify(KIT.members) === kept0, `a restart stages the same cards — ${worn(m)}`); }
    await quiet(() => H.g.restartEncounter()); await H.step(3);
    { const m = H.men(); line(m.length === 4 && m.every(x => !pistol(x)) && K.kitOf(m[0])?.bangs === issue1.bangs && JSON.stringify(KIT.members) === kept0, `… and of ${FILE} as filed, the plain issue again — ${worn(m)}`); }

    // 3b. your own counts follow the pouches rule as on any level
    K.kitLoad(null, ''); K.kitReset();
    for (const rule of [true, false]) {
      const mine = (g: any) => [g.player.canisters, g.player.flashbangs, g.player.frags, g.player.rifle.shells].join(' / ');
      const h = mine((await stage(FILE, true, 5, rule)).g), p = mine((await stage(PLAIN, true, 5, rule)).g);
      line(h === p && K.SLOTS.on === rule, `pouches rule ${rule ? 'on' : 'off'}: your smoke / stun / frags / 40 mm are ${h}, as on a level with no block (${p})`);
    }

    // 3c. every squad size a URL can stage, with the pouches rule on: the block's named card is on the FIRST man of whoever comes (Red One of the four or
    //     three, Blue One of the pair or alone — the row itself deploys at four only), nobody else has it, and alone nobody has
    { const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`), { squadChoices } = await import(`${ROOT}/src/game/loadout.ts`);
      const row = SCENARIOS.find((e: any) => e.id === 'hall-four'), sizes = row ? squadChoices(row).filter((c: any) => c.ok).map((c: any) => c.n) : [];
      line(!!row && sizes.join() === '4' && row.blurb.length <= 140, `the row deploys at four only (a URL or a tool still stages the other sizes, next lines) — sizes offered: ${sizes.join(', ') || 'none'}`); }
    for (const n of [4, 3, 2, 1, 0]) {
      const C = await stage(FILE, true, 5, true, n, named()); await C.step(3); const m = C.men();
      line(m.length === n && m.every((x, i) => pistol(x) === (i === 0)) && (n === 0 || (K.kitOf(m[0])?.bangs === CARD.bangs && K.kitOf(m[0])?.charges === CARD.charges)),
        `${n} teammate${n === 1 ? '' : 's'}, pouches rule on, the block with its card: ${n ? `${worn(m)} · ${m[0].callsign} has ${K.kitOf(m[0])?.charges} charges` : 'nobody comes, nobody carries it'}`);
    }

    // 4. off
    K.kitLoad(st, '?noslots');
    const B = await stage(FILE, false); await B.step(3);
    { const m = B.men(); line(!brk && !pistol(m[0]) && pistol(m[1]) && K.kitOf(m[0])?.bangs === 0, `switch off: the kept kit is worn — ${worn(m)}`); }
    K.kitLoad(null, '?noslots'); K.kitReset();

    // 5. a level without the block
    const run = async (on: boolean) => { const R = await stage(PLAIN, on); const h: string[] = []; for (let i = 0; i < 4; i++) { await R.step(30); h.push(hashDigest(digestGame(R.g, true))); } ISSUE.on = on; return h.join(' '); };
    const hOn = await run(true), hOff = await run(false);
    line(hOn === hOff, `${PLAIN} (no block): switch on and off are the same game over two seconds — ${hOn === hOff ? 'four digests equal' : `${hOn} ≠ ${hOff}`}`);
  } catch (e) { failed = true; console.log(`- FAIL — threw: ${(e as Error).stack ?? e}`); }
  finally { K.kitLoad(null, ''); K.kitReset(); knobsBack(knobs0); }
  console.log(`=== issue-check: ${failed ? 'FAILURES above' : 'ALL PASS'} (${checks} lines) ===`);
  return !failed;
}

if (import.meta.main) issueCheck().then(ok => process.exit(ok ? 0 : 1));
