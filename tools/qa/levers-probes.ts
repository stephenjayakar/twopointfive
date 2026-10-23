// The 'levers' family (THE DIFFICULTY LEVERS — game/difficulty.ts LEVERS / setLever, ui/levers.ts on the mission sheet and the loadout screen), run through probes.ts:
//   bun run tools/qa/probes.ts levers | levers-rules | levers-screens | levers-run          (or this file: bun run tools/qa/levers-probes.ts [name …])
// PASS / FAIL each, all headless. Nothing here looks at a picture.
//   levers-rules    the module alone: standard and hard put every lever on the level's own rung and read back as that level with nothing moved (on a plain
//                   structure and on The block, whose hard carries the stun charges); each lever moved alone writes its own rows and no other's; hard's rungs set
//                   lever by lever over standard read as hard; the level's switch puts every lever back; a moved lever is kept on this machine, read back at the
//                   next page load, left out of a Training lesson, and a ?fog= / ?enemyai= / ?enemykit= on the URL stands over it for the visit; links carry a moved lever
//                   only where the machine could not keep it, and with none moved are the links they were; every room clear's row says whether squads hold its
//                   level, as its level file has it (ScenarioEntry.squads → difficulty.ts squadsOf), and is worded so
//   levers-screens  the real screens on a fake DOM: the mission sheet carries a row per lever under its Standard | Hard row, the lit rung the tables' own; a press
//                   moves that lever alone and every row's link follows; A / D leave a mix alone; the solo night, a quiet mission and a Training lesson grey the rows; the loadout of a squad mission
//                   carries the same three rows (its keys' rows unchanged), the solo night's and a Training lesson's carry none, and Deploy loads the link with the levers put right on it
//   levers-run      the levers in a run: the fog lever's top rung is in force in a Game built after it (over what the machine keeps for the fog's own option);
//                   the enemy kit on stun charges with the AI on standard has charges go off through doors (the office room clear with the four, eight seeds)
//                   where the same runs without it have none — the lever plays alone. A defender throws his charge at a door he is coming through, so the
//                   check plays a floor whose defenders come: The block's, since its rebuild, hold their rooms on standard and throw none either way.
//                   LEVERS_BREAK=1 plays both arms without the lever: must fail
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const D = await import(`${ROOT}/src/game/difficulty.ts`);
const { PRESSURE } = await import(`${ROOT}/src/game/pressure.ts`);
const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { QUIETFOG } = await import(`${ROOT}/src/game/quietfog.ts`);   // (a quiet row's fog lever is live while that rule is on: the page, the shipped stand)

type Verdict = (ok: boolean, label: string, detail: string) => void;
const { threeLevers } = await import('./told-check.ts');   // (the fourth lever and the squad's fog-off rung are held down here: these lines count three levers — told-check.ts has them up)
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o);
const tables = () => J({ P: PRESSURE, D: DIGIN });
const fog = () => `${FOG.cone ? 'cone' : 'round'}${FOG.own ? '+own' : ''}`;
const shown = () => { const S = D.leversShown(); return `${S.fog}/${S.ai}/${S.kit}`; };
/** a store for the length of `fn` (null: a machine that can keep nothing), the page's own put back after */
async function withStore<T>(init: Record<string, string> | null, fn: (m: Map<string, string>) => Promise<T> | T): Promise<T> {
  const G = globalThis as any, had = 'localStorage' in G, prev = G.localStorage, m = new Map(Object.entries(init ?? {}));
  if (init === null) delete G.localStorage; else G.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
  try { return await fn(m); } finally { if (had) G.localStorage = prev; else delete G.localStorage; }
}
/** the module as a fresh page finds it: standard, no lever moved, the structure a plain one, the fog's own option off */
function fresh() { D.difficultyHere(''); D.setConeVisit(null); D.setDifficulty('standard', false); FOG.own = false; }

// ───────────────────────────────────────────────────────────── rules ─────────────────────────────────────────────────────────────
export const leversRules = (): Promise<boolean> => threeLevers(leversRules3);
async function leversRules3(): Promise<boolean> {
  const F = family('levers-rules: the difficulty levers as rules — a level puts every lever on its rung, a lever moved alone writes its own rows and no other\'s');
  const ownWas = FOG.own;
  try {
    fresh();
    // ---- the table
    { const L: any[] = D.LEVERS, keys = L.map(l => l.key).join(','), params = L.map(l => l.param);
      F.verdict(keys === 'fog,ai,kit' && L[0].rungs.length === 3 && L.every(l => l.rungs.length >= 2 && l.rungs.length <= 5 && l.rungs.every((r: any) => r.label.length <= 12 && r.words.length >= 20)) && new Set(params).size === 3 && !params.some(p => ['hard', 'difficulty', 'pressure', 'digin', 'fogcone', 'fogown'].includes(p)),
        'three levers — fog of war (three rungs), enemy AI, enemy kit — each rung with a short label and a line of words, each lever a URL key of its own', L.map(l => `${l.label} [?${l.param}=]: ${l.rungs.map((r: any) => r.id).join(' · ')}`).join('\n    ')); }
    // ---- a level is every lever on its own rung
    { const rows: string[] = []; let ok = true;
      for (const here of ['', 'the block']) { D.difficultyHere(here);
        for (const lv of D.DIFFICULTIES) { D.setDifficulty(lv, false); const want = D.presetLevers(lv);
          const good = J(D.leversShown()) === J(want) && D.difficultyNow() === lv && Object.keys(D.leversSet()).length === 0 && !D.leversMixed() && D.leversBase() === lv;
          ok &&= good; rows.push(`${here || '(a plain level)'} · ${lv}: ${shown()} · fog ${fog()} · stuns ${PRESSURE.stuns}${good ? '' : ' — NOT'}`); } }
      D.difficultyHere(''); D.setDifficulty('standard', false);
      F.verdict(ok && J(D.presetLevers('hard', '')) === J({ fog: 'cones', ai: 'hard', kit: 'none' }) && J(D.presetLevers('hard', 'the block')) === J({ fog: 'cones', ai: 'hard', kit: 'stuns' }) && J(D.presetLevers('standard', 'the block')) === J({ fog: 'team', ai: 'standard', kit: 'none' }),
        'standard and hard put every lever on the level\'s own rung and read back as that level, nothing moved: hard is cones + hard AI, with the stun charges on The block alone', rows.join('\n    ')); }
    // ---- each lever alone, over standard
    { const std = tables(), stdFog = fog(); D.setDifficulty('hard', false); const hard = tables(); D.setDifficulty('standard', false);
      const hardP = JSON.parse(hard).P, hardNoKit = J({ P: { ...hardP, stuns: 0 }, D: JSON.parse(hard).D });
      D.setLever('fog', 'cones', false); const a = { t: tables(), f: fog(), now: D.difficultyNow(), mix: D.leversMixed() };
      D.setLever('fog', 'own', false); const b = { t: tables(), f: fog() };
      D.setLever('fog', 'team', false); const c = { t: tables(), f: fog(), now: D.difficultyNow() };
      D.setLever('fog', null, false); const d = { t: tables(), f: fog(), now: D.difficultyNow(), set: J(D.leversSet()) };
      F.verdict(a.t === std && a.f === 'cone' && a.now === 'custom' && a.mix && b.t === std && b.f === 'cone+own' && c.t === std && c.f === 'round' && c.now === 'standard' && d.t === std && d.f === stdFog && d.now === 'standard' && d.set === '{}',
        'the fog lever alone, over standard: cones, then your own eyes, then back — the defenders\' rows never move; the level\'s own rung set by hand still reads as the level; let go, it is the level\'s again',
        `cones → fog ${a.f}, reads ${a.now} · own → ${b.f} · team → ${c.f}, reads ${c.now} · let go → ${d.f}, moved ${d.set}`);
      D.setLever('ai', 'hard', false); const e = { t: tables(), f: fog(), now: D.difficultyNow(), s: shown() }; D.setLever('ai', null, false);
      F.verdict(e.t === hardNoKit && e.f === stdFog && e.now === 'custom' && tables() === std, 'the AI lever alone: every row hard\'s defenders stand on (the press, the dig-in join, the drilled room) and nothing of the fog or the kit; let go, standard\'s rows to the byte',
        `${e.s} · fog ${e.f} · press ${JSON.parse(e.t).P.on} · dig in ${JSON.parse(e.t).D.on} · stuns ${JSON.parse(e.t).P.stuns}`);
      D.setLever('kit', 'stuns', false); const k = { t: tables(), f: fog(), now: D.difficultyNow(), s: shown() }; D.setLever('kit', null, false);
      const stdP = JSON.parse(std).P;
      F.verdict(k.t === J({ P: { ...stdP, stuns: D.LEVER_STUNS }, D: JSON.parse(std).D }) && k.f === stdFog && k.now === 'custom' && D.LEVER_STUNS === 1 && tables() === std, 'the kit lever alone: a stun charge each and no other row — the press stays off',
        `${k.s} · press ${JSON.parse(k.t).P.on} · stuns ${JSON.parse(k.t).P.stuns}`);
      // ---- hard, built lever by lever, is hard; hard with one lever let down is a mix with the others in force
      D.setLever('fog', 'cones', false); D.setLever('ai', 'hard', false); const built = { t: tables(), f: fog(), now: D.difficultyNow(), mix: D.leversMixed() };
      D.setDifficulty('hard', false); const h = { t: tables(), f: fog(), set: J(D.leversSet()) };
      D.setLever('fog', 'team', false); const soft = { t: tables(), f: fog(), now: D.difficultyNow(), mix: D.leversMixed() };
      D.setDifficulty('standard', false);
      F.verdict(built.t === hard && built.f === 'cone' && built.now === 'hard' && !built.mix && h.t === hard && h.f === 'cone' && h.set === '{}' && soft.t === hard && soft.f === 'round' && soft.now === 'custom' && soft.mix && tables() === std && fog() === stdFog,
        'hard\'s rungs set lever by lever over standard ARE hard (rows to the byte, and it reads hard); the level\'s switch puts every lever back; hard with the fog let down is hard\'s defenders seen all round',
        `built: reads ${built.now} · hard, fog → team: reads ${soft.now}, fog ${soft.f}, press ${JSON.parse(soft.t).P.on}`); }
    // ---- the fog's own kept option (teamfeel.ts FOG.own) is the lever's only while the lever is moved
    { FOG.own = true; D.setDifficulty('hard', false); const kept = fog();
      D.setLever('fog', 'cones', false); const over = fog(); D.setLever('fog', null, false); const back = fog(); D.setDifficulty('standard', false); const std = fog(); FOG.own = false;
      F.verdict(kept === 'cone+own' && over === 'cone' && back === 'cone+own' && std === 'round+own', 'a machine that keeps the fog\'s own-eyes option: the level leaves it alone, the fog lever stands over it while moved, and it is back when the lever lets go', `hard ${kept} · lever on cones ${over} · let go ${back} · standard ${std}`); }
    // ---- the structure: a level's own kit follows it where the kit lever was left alone
    { D.setDifficulty('hard', false); D.setLever('fog', 'own', false); D.difficultyHere('the block'); const a = `${shown()} stuns ${PRESSURE.stuns}`, aOk = PRESSURE.stuns === 1 && FOG.own;
      D.setLever('kit', 'none', false); const b = `${shown()} stuns ${PRESSURE.stuns}`, bOk = PRESSURE.stuns === 0 && PRESSURE.on;
      D.difficultyHere(''); D.setLever('kit', null, false); const c = `${shown()} stuns ${PRESSURE.stuns}`, cOk = PRESSURE.stuns === 0;
      D.setDifficulty('standard', false); D.setLever('kit', 'stuns', false); D.difficultyHere('the block'); const d = `${shown()} stuns ${PRESSURE.stuns}`, dOk = PRESSURE.stuns === 1 && !PRESSURE.on;
      fresh();
      F.verdict(aOk && bOk && cOk && dOk, 'hard with a lever moved, started on The block: its stun charges come with the level; the kit lever on guns takes them off there and nowhere else changes; standard with the kit lever on stuns carries them onto any level',
        `hard + fog own on The block: ${a} · kit → guns: ${b} · off The block, kit let go: ${c} · standard + stuns on The block: ${d}`); }
    // ---- kept on this machine; the URL over it for a visit; not on a Training lesson
    await withStore({}, m => {
      D.setLever('fog', 'own'); D.setLever('kit', 'stuns'); const stored = m.get('twopointsix.levers') ?? '', name = m.get('twopointsix.difficulty') ?? '(none)';
      fresh(); D.initDifficulty(new URLSearchParams('')); const a = shown();
      fresh(); D.initDifficulty(new URLSearchParams('difficulty=hard')); const b = `${shown()} base ${D.leversBase()}`;
      fresh(); D.initDifficulty(new URLSearchParams('fog=team&enemyai=hard&enemykit=junk')); const c = shown();
      fresh(); D.initDifficulty(new URLSearchParams(''), true); const p = `${shown()} moved ${J(D.leversSet())}`;
      fresh(); D.initDifficulty(new URLSearchParams('')); D.setDifficulty('hard'); const cleared = m.get('twopointsix.levers') ?? '(none)', nameH = m.get('twopointsix.difficulty');
      D.setLever('ai', 'standard'); const overHard = `${m.get('twopointsix.levers')} over ${m.get('twopointsix.difficulty')}`;
      fresh(); D.initDifficulty(new URLSearchParams('')); const d = `${shown()} base ${D.leversBase()}`;
      D.setDifficulty('standard'); const end = `${m.get('twopointsix.levers') ?? '(none)'} · ${m.get('twopointsix.difficulty') ?? '(none)'}`;
      m.set('twopointsix.levers', '{"fog":"sideways","ai":7,"kit":"stuns","extra":1}'); fresh(); D.initDifficulty(new URLSearchParams('')); const junk = `${shown()} moved ${J(D.leversSet())}`;
      fresh();
      F.verdict(stored === '{"fog":"own","kit":"stuns"}' && name === '(none)' && a === 'own/standard/stuns' && b === 'own/hard/stuns base hard' && c === 'team/hard/stuns' && p === 'team/standard/none moved {}'
        && cleared === '(none)' && nameH === 'hard' && overHard === '{"ai":"standard"} over hard' && d === 'cones/standard/none base hard' && end === '(none) · (none)' && junk === 'team/standard/stuns moved {"kit":"stuns"}',
        'a moved lever is kept on this machine and stands over whichever level the next page starts at; the URL\'s own lever stands over the kept one for the visit; a Training lesson reads none; the level\'s switch drops them; a rung the build does not have is not read',
        `stored ${stored} · next load ${a} · on a ?difficulty=hard link ${b} · ?fog=team&enemyai=hard ${c} · a lesson ${p}\n    Hard pressed: levers ${cleared}, name ${nameH} · AI let down over it: ${overHard} → next load ${d} · Standard pressed: ${end} · a store with junk in it: ${junk}`);
    });
    // ---- links
    { const plain = '?roomclear&squad4&mute';
      const none = { std: D.difficultyHref(plain), stdL: D.leversHref(plain) }; D.setDifficulty('hard', false); const noneH = { h: D.difficultyHref(plain), l: D.leversHref(`${plain}&difficulty=hard`) }; D.setDifficulty('standard', false);
      const kept = await withStore({}, () => { D.setLever('fog', 'own'); const r = { d: D.difficultyHref(plain), over: D.difficultyHref(`${plain}&difficulty=hard&fog=team`), l: D.leversHref(`${plain}&difficulty=hard&fog=team&enemykit=stuns`) }; D.setDifficulty('standard'); return r; });
      const bare = await withStore(null, () => { D.setLever('fog', 'own'); D.setLever('ai', 'hard'); const r = { d: D.difficultyHref(plain), l: D.leversHref(`${plain}&difficulty=hard&fog=team`) }; D.setDifficulty('standard'); return r; });
      fresh();
      F.verdict(none.std === plain && none.stdL === plain && noneH.h === `${plain}&difficulty=hard` && noneH.l === `${plain}&difficulty=hard`, 'no lever moved: the links are the links they were (standard on a link that names no level is left alone; hard rides on it)', `${none.std} · hard ${noneH.h}`);
      F.verdict(kept.d === `${plain}&difficulty=standard` && kept.over === `${plain}&difficulty=standard` && kept.l === `${plain}&difficulty=hard`, 'a moved lever the machine KEPT: the link names the level the levers stand over and carries no lever (the page it loads reads them back); a link that names its own level keeps it, and loses whatever levers it carried',
        `${kept.d} · a row's own hard link → ${kept.l}`);
      F.verdict(bare.d === `${plain}&difficulty=standard&fog=own&enemyai=hard` && bare.l === `${plain}&difficulty=hard&fog=own&enemyai=hard`, 'where nothing can be kept the link carries the moved levers itself, in place of whatever it carried', `${bare.d} · ${bare.l}`); }
    // ---- other roads: the kept own-eyes option, a lever the visitor arrived with, rows moved by hand, a lesson's page, a level's own kit
    { const plain = '?roomclear&squad4&mute', flip = () => { const k = Object.keys(PRESSURE).find(k => typeof (PRESSURE as any)[k] === 'boolean' && k !== 'on')!; (PRESSURE as any)[k] = !(PRESSURE as any)[k]; };
      // the Game's constructor reads the kept feel rows back ROUND the fog lever (leversFog): a machine with no kept option, then one that keeps own eyes
      fresh(); D.setLever('fog', 'own', false); D.leversFog(() => { /* nothing kept */ }); const heldOn = FOG.own; D.setDifficulty('standard', false); const a = `${heldOn ? 'own' : 'NOT own'} → ${FOG.own ? 'STILL own' : 'off'}`, aOk = heldOn && !FOG.own;
      fresh(); D.setLever('fog', 'team', false); D.leversFog(() => { FOG.own = true; }); const heldOff = !FOG.own; D.setDifficulty('standard', false); const b = `${heldOff ? 'off' : 'NOT off'} → ${FOG.own ? 'own again' : 'LOST'}`, bOk = heldOff && FOG.own; FOG.own = false;
      F.verdict(aOk && bOk, 'a new Game reads the kept feel rows back round the fog lever: own eyes held by the lever goes when the lever lets go on a machine that keeps none, and a kept own-eyes option is back after the lever held it off', `nothing kept, lever own eyes: ${a} · own eyes kept, lever all round: ${b}`);
      // a page that arrived with ?fog=own, then Standard pressed: the link loses it
      const arrived = await withStore({}, () => { fresh(); D.initDifficulty(new URLSearchParams('fog=own')); const on = D.difficultyHref(`${plain}&fog=own`); D.setDifficulty('standard'); const off = D.difficultyHref(`${plain}&fog=own`), offL = D.leversHref(`${plain}&difficulty=hard&fog=own`); return { on, off, offL }; });
      F.verdict(arrived.on === `${plain}&difficulty=standard&fog=own` && arrived.off === plain && arrived.offL === `${plain}&difficulty=hard`, 'a lever the visitor ARRIVED with (?fog=own) rides the links while it stands, and is off them once the level\'s switch has let it go', `${arrived.on} · Standard pressed: ${arrived.off}`);
      // levers pressed in another order than the table's are still KEPT ones (the link carries none)
      const order = await withStore({}, () => { fresh(); D.setLever('kit', 'stuns'); D.setLever('fog', 'own'); const h = D.difficultyHref(plain); D.setDifficulty('standard'); return h; });
      F.verdict(order === `${plain}&difficulty=standard`, 'levers moved kit first, fog second, are kept ones like any: the link carries no lever', order);
      // the tables moved by another road since the level was set: the level is read back off them, and the fog lever writes no defenders' row
      fresh(); D.setDifficulty('hard', false); PRESSURE.on = false; DIGIN.on = false; const read = D.difficultyNow(); D.setLever('fog', 'cones', false); const c = `reads ${read} · fog lever moved: press ${PRESSURE.on ? 'BACK ON' : 'off'}, level under the levers ${D.leversBase()}`, cOk = read === 'standard' && !PRESSURE.on && !DIGIN.on && D.leversBase() === 'standard';
      fresh(); D.setDifficulty('hard', false); flip(); const t = tables(); D.setLever('fog', 'own', false); const d = `rows ${tables() === t ? 'as they stood' : 'REWRITTEN'} · fog ${fog()}`, dOk = tables() === t && fog() === 'cone+own' && D.difficultyNow() === 'custom';
      const cust = await withStore({}, m => { fresh(); D.setLever('ai', 'hard'); D.setLever('fog', 'own'); flip(); D.difficultyCustom(); const kept = m.get('twopointsix.levers') ?? '(none)', name = m.get('twopointsix.difficulty') ?? '(none)';
        fresh(); D.initDifficulty(new URLSearchParams('')); return { kept, name, fogOnly: fog() === 'cone+own' }; });
      fresh();
      F.verdict(cOk && dOk && cust.kept === '{"fog":"own"}' && cust.name === '(none)' && cust.fogOnly, 'tables moved by another road (both switches put off by hand under hard; a row moved under them): the level under the levers is read back off the tables, the fog lever writes the fog\'s rows alone, and rows moved by hand drop the kept AI and kit levers (the fog lever is its own)',
        `hard, both switches off by hand: ${c}\n    hard, a row moved by hand, fog lever → own eyes: ${d} · AI + fog levers kept, then a row moved by hand: kept ${cust.kept}, name ${cust.name}`);
      // a lesson's page keeps the kept levers off its tables; a lever moved there is moved AMONG them
      const lesson = await withStore({ 'twopointsix.levers': '{"fog":"own","kit":"stuns"}' }, m => { fresh(); D.initDifficulty(new URLSearchParams(''), true); const on = shown(); D.setLever('ai', 'hard'); const r = { on, after: shown(), kept: m.get('twopointsix.levers') }; D.initDifficulty(new URLSearchParams('')); fresh(); return r; });
      F.verdict(lesson.on === 'team/standard/none' && lesson.after === 'own/hard/stuns' && lesson.kept === '{"fog":"own","kit":"stuns","ai":"hard"}', 'on a Training lesson\'s page the kept levers are off the tables, and a lever moved there joins them: none is dropped from what the machine keeps', `the lesson: ${lesson.on} · AI moved there: ${lesson.after}, kept ${lesson.kept}`);
      // the kit a LEVEL carries on a mission's own structure, on a page that stands elsewhere; a press on the level's own rung there pins nothing
      fresh(); D.setDifficulty('hard', false); const at = `${D.leversShown('the block').kit} on The block, ${D.leversShown('').kit} elsewhere`;
      D.setLever('kit', 'none', false, 'the block'); const pinned = J(D.leversSet()); D.setLever('kit', 'stuns', false, 'the block'); const back = J(D.leversSet()); D.setLever('kit', 'none', false, ''); D.setLever('fog', 'cones', false, ''); D.setLever('ai', 'hard', false, ''); const own = J(D.leversSet());
      const fs = await import('node:fs'), blockFile = fs.readFileSync(new URL('../../levels/block.json', import.meta.url), 'utf8'), named = Object.keys(D.HARD_AT).every(k => k === D.structureOfLevel('block.json') && new RegExp(`"name":\\s*"${k}"`).test(blockFile));
      fresh();
      F.verdict(at === 'stuns on The block, none elsewhere' && pinned === '{"kit":"none"}' && back === '{}' && own === '{}' && named && D.structureOfLevel('depot.json') === '', 'the mission sheet shows the kit the level carries on the mission\'s OWN structure (hard: a charge each on The block); a lever put on another rung there is pinned, and one put on the level\'s own rung is let go of',
        `hard: ${at} · guns on The block: moved ${pinned} · stuns again: moved ${back} · every level file HARD_AT names is in the table: ${named}`); }
    // ---- the words
    { D.setLever('fog', 'own', false); const mix = D.difficultyWords(D.difficultyNow()), line = D.leversLine(), all = D.leversLine(true); D.setDifficulty('standard', false);
      F.verdict(mix.startsWith('your own mix') && line === 'fog of war: own eyes' && all === 'fog of war: own eyes · enemy AI: standard · enemy kit: guns' && D.leversLine() === '' && D.leverWords('fog', 'own').length > 20 && D.leverWords('fog', null) === '',
        'a mix says so and names every lever; the short line names only the levers moved (none moved: nothing)', `${mix}\n    moved: ${line}`); }
    // ---- a squad map is worded as one because its ROW says so, and every row says what its level file holds
    { const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`), fs = await import('node:fs');
      const rows = (ALL_MISSIONS as any[]).filter(e => e.kind === 'roomclear' && e.level);   // (a Training lesson too: its page reads no lever, but a kept Hard stands on it)
      const held = (file: string) => { try { return (JSON.parse(fs.readFileSync(new URL(`../../levels/${file}`, import.meta.url), 'utf8')).scenarios?.roomClear?.squads ?? []).length > 0; } catch { return null; } };
      const wrong = rows.filter(e => held(e.level) !== !!D.squadsOf(e)).map(e => `${e.id}: ${e.level} ${held(e.level) === null ? 'does not read' : held(e.level) ? 'names squads, the row does not (add squads: true to it)' : 'names no squads, the row says squads'}`);
      const pool = D.difficultyWords('hard', D.squadsOf({ level: 'new-map.json' })), flagged = D.difficultyWords('hard', D.squadsOf({ level: 'new-map.json', squads: true })), own = D.difficultyWords('hard', D.squadsOf((ALL_MISSIONS as any[]).find(e => e.id === 'compound-four')));
      const none = D.squadsOf(null) === false && D.squadsOf({}) === false && D.squadsOf({ squads: true }) === true, std = D.difficultyWords('standard', D.squadsOf({ level: 'new-map.json', squads: true }));
      F.verdict(wrong.length === 0 && rows.some(e => D.squadsOf(e)) && /come at you together/.test(pool) && /^hard: the squads are a drilled garrison/.test(flagged) && !/come at you together/.test(flagged) && /call it gone on the radio/.test(own) && none && std === D.difficultyWords('standard'),
        'every room clear on the list says on its own row whether squads hold its level, as the level file has it; a row that says so words Hard as the squads\' (a map with no sentence of its own: a drilled garrison), one that does not as the one pool',
        `${rows.length} rows, ${rows.filter(e => D.squadsOf(e)).length} held by squads${wrong.length ? `\n    ${wrong.join('\n    ')}` : ''}\n    a new map, flagged: ${flagged.slice(0, 60)}…`); }
  } finally { fresh(); FOG.own = ownWas; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── screens ─────────────────────────────────────────────────────────────
// (the three difficulty levers: the sheet's 'Sticky cameras' row carries data-lever too, is a quiet mission's own and is held by tools/qa/sticky-check.ts)
const leverRowsOf = (root: El) => root.all(e => !!e.attrs['data-lever'] && e.attrs['data-lever'] !== 'cams').map(r => ({ key: r.attrs['data-lever'], el: r, na: r.cls.has('na'), moved: r.cls.has('moved'),
  btns: r.all(e => e.tagName === 'BUTTON'), lit: r.all(e => e.tagName === 'BUTTON' && e.cls.has('on')).map(b => b.attrs['data-rung']).join(','), note: r.all(e => e.tagName === 'SPAN').at(-1)?.textContent ?? '' }));
const press = (root: El, key: string, rung: string) => { const b = leverRowsOf(root).find(r => r.key === key)?.btns.find(b => b.attrs['data-rung'] === rung); if (!b?.onclick) throw new Error(`no ${key}:${rung} button`); b.onclick(); };
export const leversScreens = (): Promise<boolean> => threeLevers(leversScreens3);
async function leversScreens3(): Promise<boolean> {
  const F = family('levers-screens: the lever rows on the mission sheet and the loadout screen (the real screens on a fake DOM)');
  const SEARCH = '?quality=high&mute', G = globalThis as any, ownWas = FOG.own;
  try {
    await withStore({}, async store => { await withDom(SEARCH, async () => {
      G.location.pathname = '/'; G.location.hash = ''; const loads: string[] = []; G.location.assign = (u: string) => { loads.push(u); }; G.location.reload = () => { loads.push('(reload)'); };
      const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`), { SCENARIOS, TRAINING_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      fresh(); M.MISSIONS.onPick = null;
      const host = new El('DIV') as any, list: any[] = M.missionList(), four = list.find(m => m.id === 'room-clear-four'), solo = M.SOLO_NIGHT, quietM = list.find(m => m.scenario?.kind === 'quiet' && m.scenario.group !== 'training' && m.scenario.group !== 'tutorial')   /* (a tutorial mission's fog is its frame's, game/rails.ts: its lever is greyed, as a lesson's) */, lessonM = list.find(m => m.scenario?.group === 'training');
      // ---- the mission sheet
      const S = M.openMissions({ root: host, select: four.id, search: SEARCH, onPick: () => {} }), root = S.root as unknown as El;
      const rows0 = leverRowsOf(root), href0 = S.hrefOf(four);
      F.verdict(rows0.map(r => r.key).join(',') === 'fog,ai,kit' && rows0.map(r => r.btns.filter(b => (b as any).style.display !== 'none').length).join(',') === '3,2,2' && rows0.map(r => r.lit).join('/') === 'team/standard/none' && rows0.every(r => !r.na && !r.moved && r.note.length > 20 && r.el.cls.has('mlever'))
        && root.all(e => !!e.attrs['data-difficulty']).length === 2 && href0 === M.missionHref(four, SEARCH),
        'the sheet of a squad mission: a row per lever under Standard | Hard — fog of war with three rungs, enemy AI and enemy kit with two — each lit on standard\'s rung with its line of words', rows0.map(r => `${r.key} [${r.btns.map(b => b.textContent).join(' | ')}] lit ${r.lit}: ${r.note}`).join('\n    '));
      press(root, 'fog', 'own'); const r1 = leverRowsOf(root), href1 = S.hrefOf(four), go1 = root.all(e => e.cls.has('mgo'))[0]?.attrs.href, dn1 = root.all(e => !!e.attrs['data-difficulty'] && e.cls.has('on')).length;
      const t1 = { fog: fog(), press: PRESSURE.on, stuns: PRESSURE.stuns, kept: store.get('twopointsix.levers') };
      F.verdict(r1.map(r => r.lit).join('/') === 'own/standard/none' && r1[0].moved && !r1[1].moved && t1.fog === 'cone+own' && !t1.press && t1.stuns === 0 && t1.kept === '{"fog":"own"}' && dn1 === 0 && D.leversMixed()
        && href1 === `${href0}&difficulty=standard` && go1 === href1 && root.all(e => e.cls.has('mrow')).every((a, i) => a.attrs.href === S.hrefOf(list[i])),
        '"own eyes" pressed: that lever alone moves (the fog is the player\'s own cone; the defenders\' rows are standard\'s), it is kept on this machine, neither Standard nor Hard is lit, and every row\'s link follows',
        `lit ${r1.map(r => r.lit).join('/')} · fog ${t1.fog} · kept ${t1.kept} · ${href1}`);
      M.missionsKey({ code: 'KeyD' }); const afterD = shown(); M.missionsKey({ code: 'KeyA' }); const afterA = shown();
      press(root, 'ai', 'hard'); press(root, 'fog', 'cones'); const built = `${shown()} reads ${D.difficultyNow()}`, hardLit = root.all(e => e.attrs['data-difficulty'] === 'hard')[0]?.cls.has('on');
      F.verdict(afterD === 'own/standard/none' && afterA === 'own/standard/none' && built === 'cones/hard/none reads hard' && !!hardLit, 'A / D on a mix leave it alone (a hand resting on the keys does not throw a mix away); the levers brought to hard\'s rungs one by one light Hard',
        `after D, A: ${afterA} · then AI hard, fog cones: ${built}`);
      root.all(e => e.attrs['data-difficulty'] === 'standard')[0].onclick!(); const back = `${shown()} moved ${J(D.leversSet())} kept ${store.get('twopointsix.levers') ?? '(none)'}`, hrefB = S.hrefOf(four);
      M.missionsKey({ code: 'KeyD' }); const keyHard = `${shown()} reads ${D.difficultyNow()}`; M.missionsKey({ code: 'KeyA' });
      F.verdict(back === 'team/standard/none moved {} kept (none)' && hrefB === href0 && keyHard === 'cones/hard/none reads hard' && D.difficultyNow() === 'standard',
        'Standard pressed: every lever back on standard\'s rung, nothing kept, the links as they were; with no mix A / D are standard / hard as ever', `${back} · D → ${keyHard}`);
      S.select(solo.id); const soloRows = leverRowsOf(root); if (quietM) S.select(quietM.id); const quietRows = quietM ? leverRowsOf(root) : []; if (lessonM) S.select(lessonM.id); const lessonRows = lessonM ? leverRowsOf(root) : [];
      const said = (rows: typeof soloRows) => rows.map(r => `${r.key} ${r.na ? 'greyed' : 'live'}`).join(' · ');
      F.verdict(soloRows.every(r => (r.key === 'fog' && QUIETFOG.on && QUIETFOG.solo ? !r.na : r.na && r.note === '')) && (!quietM || quietRows.every(r => r.key === 'fog' && QUIETFOG.on ? !r.na : r.na)) && lessonRows.every(r => r.na),
        'the solo night greys all three rows (no fog of war, and its shift is the level\'s own — but its fog row is live where game/quietfog.ts QUIETFOG.solo is up); so does a quiet mission (its shift is the level\'s own; its fog lever is live only while game/quietfog.ts\'s rule is on, tools/qa/quietfog-check.ts) and a Training lesson (its page reads no lever)',
        `solo: ${said(soloRows)}${quietM ? ` · ${quietM.id}: ${said(quietRows)}` : ' · (no quiet mission on this build)'}${lessonM ? ` · ${lessonM.id}: ${said(lessonRows)}` : ''}`);
      S.close();
      // ---- the loadout
      const e4 = SCENARIOS.find((e: any) => e.id === 'room-clear-four'), deployed: string[] = [];
      const L = UI.openLoadout(e4, { host, search: `${M.missionHref(four, SEARCH)}`, deploy: (s: string) => deployed.push(s), back: () => {} }), lroot = L.root as unknown as El;
      const lr = leverRowsOf(lroot), nRows = L.rows.length;
      press(lroot, 'kit', 'stuns'); const l1 = leverRowsOf(lroot), noteL = lroot.all(e => e.cls.has('lo-levnote'))[0]?.textContent ?? '';
      L.deploy(); const to = deployed[0] ?? '';
      F.verdict(lr.map(r => r.key).join(',') === 'fog,ai,kit' && lr.map(r => r.lit).join('/') === 'team/standard/none' && l1.map(r => r.lit).join('/') === 'team/standard/stuns' && l1[2].moved && PRESSURE.stuns === 1 && !PRESSURE.on && noteL.includes('enemy kit: stuns')
        && store.get('twopointsix.levers') === '{"kit":"stuns"}' && to.includes('roomclear') && !to.includes('enemykit') && !!L.rows[0].el.cls.has('lo-team'),
        'the loadout of a squad mission carries the same three rows (its keys\' rows as they were, the team first); a press moves the lever, says so, and is kept; Deploy loads the mission\'s link (the kept lever is read back by the page it loads)',
        `${nRows} keyed rows · lit ${l1.map(r => r.lit).join('/')} · '${noteL}' · deploy ${to}`);
      // (opened on a link that names another level than the machine's: that level under the levers while the screen is up; closed untouched, the machine's again)
      const Lh = UI.openLoadout(e4, { host, search: `${M.missionHref(four, SEARCH)}&difficulty=hard`.replace('&difficulty=standard', ''), deploy: (s: string) => deployed.push(s), back: () => {} });
      const up = `${shown()} base ${D.leversBase()}`; Lh.deploy(); const toH = deployed[1] ?? ''; const after = `${shown()} base ${D.leversBase()}`;
      F.verdict(up === 'cones/hard/stuns base hard' && toH.includes('difficulty=hard') && !toH.includes('enemykit') && after === 'team/standard/stuns base standard', 'opened on a row\'s own hard link: hard\'s rungs under the kept lever while the screen is up, the link\'s own level on what Deploy loads; closed with no lever pressed, the machine\'s level again',
        `up: ${up} · deploy ${toH} · after: ${after}`);
      D.setDifficulty('standard');
      // (a squad mix kept on the machine says its line on a squad mission's loadout only: none of it acts on a quiet mission or the solo night)
      { D.setLever('fog', 'own', false); D.setLever('kit', 'stuns', false); const mixed = D.leversMixed(), noteOf = (L: any) => { const t = (L.root as unknown as El).all(e => e.cls.has('lo-levnote'))[0]?.textContent ?? ''; L.close(); return t; };
        const n4 = noteOf(UI.openLoadout(e4, { host, search: `${M.missionHref(four, SEARCH)}`, deploy: () => {}, back: () => {} })), nS = noteOf(UI.openLoadout(UI.entryOfMission(solo), { host, deploy: () => {}, back: () => {} }));
        const nQ = quietM ? noteOf(UI.openLoadout(UI.entryOfMission(quietM), { host, deploy: () => {}, back: () => {} })) : '';
        D.setDifficulty('standard', false);
        F.verdict(mixed && n4.includes('Your own mix') && nS === '' && nQ === '', 'a squad mix kept on the machine: its line under a squad mission\'s lever rows, none under the solo night\'s or a quiet mission\'s (the mix does not act there)',
          `squad '${n4}' · solo '${nS}' · ${quietM ? `${quietM.id} '${nQ}'` : '(no quiet mission on this build)'}`); }
      const Ls = UI.openLoadout(UI.entryOfMission(solo), { host, deploy: () => {}, back: () => {} }); const soloLR = leverRowsOf(Ls.root as unknown as El), soloL = soloLR.length, soloFog = QUIETFOG.on && QUIETFOG.solo; Ls.close();
      const lesson = (TRAINING_MISSIONS as any[])[0]; let lessonL = -1; if (lesson) { const Lt = UI.openLoadout(lesson, { host, deploy: () => {}, back: () => {} }); lessonL = leverRowsOf(Lt.root as unknown as El).length; Lt.close(); }
      F.verdict((soloFog ? soloLR.map(r => r.key).join(',') === 'fog,ai,kit' && soloLR.every(r => (r.key === 'fog') !== r.na) : soloL === 0) && lessonL <= 0,
        'the solo night\'s loadout and a Training lesson\'s carry no lever rows (where game/quietfog.ts QUIETFOG.solo is up the solo night\'s carries the three, the fog\'s alone live)', `solo ${soloL} rows${soloFog ? ` (${soloLR.map(r => `${r.key} ${r.na ? 'greyed' : 'live'}`).join(' · ')})` : ''} · lesson ${lesson ? `${lesson.id} ${lessonL} rows` : '(none on this build)'}`);
    }); });
  } finally { fresh(); FOG.own = ownWas; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── run ─────────────────────────────────────────────────────────────
export const leversRun = (): Promise<boolean> => threeLevers(leversRun3);
async function leversRun3(): Promise<boolean> {
  const F = family('levers-run: the levers in a run — the fog lever in a Game built after it, the enemy kit playing with the AI on standard');
  const ownWas = FOG.own;
  try {
    fresh();
    { D.setLever('fog', 'own', false); const W = await quiet(() => standUp({ uploadEvery: 4 })); const a = fog(); void W;
      D.setLever('fog', 'cones', false); await quiet(() => standUp({ uploadEvery: 4 })); const b = fog();
      D.setLever('fog', null, false); await quiet(() => standUp({ uploadEvery: 4 })); const c = fog(); fresh();
      F.verdict(a === 'cone+own' && b === 'cone' && c === 'round', 'a Game built with the fog lever on your own eyes has the player\'s own cone in force (over the machine\'s kept feel rows, read in its constructor); on cones, the team\'s; let go, as the level', `own → ${a} · cones → ${b} · let go → ${c}`); }
    { const dir = mkdtempSync(resolve(tmpdir(), 'levers-')), runs: string[] = [], broken = process.env.LEVERS_BREAK === '1'; let bangsOn = 0, bangsOff = 0, errs = 0;
      try {
        for (const kit of ['none', 'stuns']) {
          const file = resolve(dir, `${kit}.json`);
          const pr = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--scn', 'room-clear-four', '--seeds', '1-8', '--jobs', '4', '--cap', '300', '--set', J({ DIFFICULTY: { level: 'standard', kit: broken ? 'none' : kit }, SQUADDEAL: { on: false } }), '--json', file], { stdout: 'ignore', stderr: 'ignore' });
          await pr.exited;
          const out = JSON.parse(readFileSync(file, 'utf8')), list: any[] = out.runs ?? out;
          for (const r of list) { const n = r.def?.tactics?.bangs ?? 0; if (kit === 'stuns') bangsOn += n; else bangsOff += n; if (r.end === 'error' || r.error) errs++;
            if (kit === 'stuns' && (r.difficulty !== 'custom' || !String(r.levers).includes('enemy kit: stuns'))) errs++;
            if (kit === 'none' && r.difficulty !== 'standard') errs++;
            runs.push(`${kit} · ${r.scn}:${r.seed} ${r.end} ${r.t} s · team ${r.team}/${r.of} · their charges ${n}`); }
        }
      } finally { rmSync(dir, { recursive: true, force: true }); }
      F.verdict(errs === 0 && bangsOff === 0 && bangsOn >= 3 && runs.length === 16, 'enemy kit on stun charges, the AI on standard (the office room clear with the four, eight seeds): their charges go off through doors, where the same runs on guns have none — every run ends and reports its levers',
        `their charges: ${bangsOn} with the lever, ${bangsOff} without\n    ${runs.join('\n    ')}`); }
  } finally { fresh(); FOG.own = ownWas; }
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2).filter(a => !a.startsWith('--')), all: [string, () => Promise<boolean>][] = [['levers-rules', leversRules], ['levers-screens', leversScreens], ['levers-run', leversRun]];
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
