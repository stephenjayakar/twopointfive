// LESSON-CHECK: a tutorial mission's `scenarios.lesson` block (game/lesson.ts) against its file, its built floor and the missions list.
//   bun run tools/qa/lesson-check.ts <name>[.json] …        (no name: every row of scene/scenarioList.ts LESSON_MISSIONS — the tutorial's missions.
//                                                             The seven Training lessons it was written for were taken out 2026-10-23)
// PASS / FAIL lines: the file validates · the block against the floor (game/lesson.ts checkLesson: every test's kind and fields, its doors, lights and areas) ·
// no line names the grab's key or the knife once the page's rules turn it · a row of LESSON_MISSIONS names the level under the Tutorial group · that row's own query starts its mission with the lesson live on step 1 · with the
// switch off the same start has no lesson and the scenario's own objective · a checkpoint carries the step that is up (a quiet run alone) · a restart puts the
// lesson back on step 1.
// exit 0 = all pass · 1 = a FAIL · 2 = no such level
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from './headless';
const ROOT = resolve(import.meta.dir, '../..');
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { LESSON_MISSIONS, ALL_MISSIONS, entryOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { kitAsIssued } = await import(`${ROOT}/src/game/loadout.ts`);
const { kitPacks } = await import(`${ROOT}/src/game/kit.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LESSON, checkLesson, lessonLine } = await import(`${ROOT}/src/game/lesson.ts`);
const { STALK } = await import(`${ROOT}/src/game/stalk.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { RAILS } = await import(`${ROOT}/src/game/rails.ts`);
const names = process.argv.slice(2).filter(a => !a.startsWith('--')).map(a => a.replace(/\.json$/, ''));
const list: string[] = names.length ? names : [...new Set((LESSON_MISSIONS as any[]).map(e => String(e.level).replace(/\.json$/, '')))];
let fails = 0, checks = 0;
const verdict = (ok: boolean, what: string, detail = '') => { checks++; if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`); };
const log = console.log, warn = console.warn, err = console.error;
async function quiet<T>(f: () => Promise<T> | T): Promise<T> { console.log = console.warn = console.error = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; console.error = err; } }
/** a line that still names the knife, or a key to grab a man with (read sentence by sentence, the key before the word or after it, any wording of the
 *  grab): what the page's rules have taken away. 'Cut the lights' is no knife and a key in another sentence is not the grab's */
const KNIFE = /\b(kni(fe|fes|ves|fed|fing)|blades?|stab\w*)\b/i, GRAB = /\b(grab\w*|tak(e|es|ing) hold|chok\w*|seiz\w*)\b/i, GRAB_KEY = /\[(Space|E)\]|\bSpace\b/;
const namesOld = (w: string): boolean => w.split(/[.!?\n]+/).some(q => KNIFE.test(q) || (GRAB.test(q) && GRAB_KEY.test(q)));
if (!names.length) { console.log('\n=== lesson-check: the words the rules took away ===');
  const old = ['Sneak up behind him and press [Space] to grab him', 'Grab him with [Space]', '[E] takes hold of him', 'Left click to use your blade', 'Stay low, then left click to knife him', 'Knives are quiet'].filter(w => !namesOld(w));
  const fine = ['Hold left click on him from behind to grab him', 'Press [B] on the breaker box to cut the lights', 'When you grab yours, he\'ll take his. Press [Space] to open the door.', 'Right click to knock him out'].filter(namesOld);
  verdict(!old.length && !fine.length, 'the reading knows a key to grab by in any order of the words, and the knife by any of its names, and leaves a held click, a cut light and a key in another sentence alone', [...old.map(w => `missed: ${w}`), ...fine.map(w => `wrongly caught: ${w}`)].join(' · ')); }
for (const name of list) {
  console.log(`\n=== lesson-check ${name}.json ===`);
  const file = resolve(ROOT, 'levels', `${name}.json`);
  if (!existsSync(file)) { console.log(`  no levels/${name}.json`); process.exit(2); }
  const data = parseLevelData(readFileSync(file, 'utf8')), errs: string[] = validateLevelData(data).filter((e: any) => (e.severity ?? 'error') === 'error').map((e: any) => `${e.path ?? ''} ${e.message ?? e}`);
  const L = data.scenarios?.lesson;
  verdict(!errs.length && !!L, `the file validates and carries a lesson${L ? `: '${L.title}', ${L.steps.length} steps` : ''}`, errs.slice(0, 3).join(' · '));
  if (!L) continue;
  const stand = async () => { const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(file, 'utf8'))), seed: 1 })); if (L.rails) RAILS.on = true; return W; };   // (a tutorial mission's lesson is live only on its frame — rails.ts —, which the frozen stand holds off: raised here, after the stand-up put it down)
  const line0 = String(L.steps[0].line).replace(/\[([^\]]+)\]/g, '$1');   // (the small row reads a line without the brackets a rails line puts round its keys)
  const rows = (LESSON_MISSIONS as any[]).filter(e => e.level === `${name}.json`);   // (the tutorial's rows: scenarioList.ts)
  verdict(rows.length > 0 && rows.every(e => e.group === 'tutorial'), `the missions list has it under Tutorial (${rows.map(e => `'${e.title}'`).join(', ') || 'no row'})`);
  verdict(rows.every(e => kitAsIssued(e) || kitPacks(e)) && !kitAsIssued((ALL_MISSIONS as any[]).find(e => e.group !== 'tutorial')) && !kitAsIssued(null), 'its row is played with the kit as issued (every staging on its level\'s page puts the issue cards on — kit.ts kitIssuedPage —, the loadout screen shows no card: game/loadout.ts kitAsIssued) unless it is a lesson the player packs for (kit.ts ISSUE.picked, the row\'s `packs`), and no other row is');
  // THE WORDS AS THE PAGE SAYS THEM (lesson.ts lessonLine): with the held click the only way to a man (stalk.ts `only`) and no knife (close.ts `noKnife`) a
  // line may name neither the key that grabbed nor the blade. lessonLine turns the level's words by PATTERN, so a line reworded in the level could keep
  // naming one and nothing else would say so: every line and card is read through it here. LESSON_BREAK=words leaves the two rules off: it must fail
  // on a level that teaches the grab.
  { const was = [STALK.on, STALK.only, CLOSE.on, CLOSE.noKnife], up = process.env.LESSON_BREAK !== 'words'; STALK.on = STALK.only = CLOSE.on = CLOSE.noKnife = up;
    const said: [string, string][] = (L.steps as any[]).flatMap(T => [...Object.keys(T).filter(k => /[lL]ine$|^noTap$/.test(k)).map(k => T[k]), T.explain?.title, T.explain?.text, T.after?.line, T.after?.word]
      .filter((w: unknown) => typeof w === 'string').map((w: string) => [T.id, lessonLine(w)] as [string, string]));
    [STALK.on, STALK.only, CLOSE.on, CLOSE.noKnife] = was;
    const bad = said.filter(([, w]) => namesOld(w));
    verdict(!bad.length, `with the held click the only way to a man and no knife, no line or card names the key to grab or the knife (${said.length} read through lessonLine)`, bad.map(([id, w]) => `'${id}': ${w}`).join(' · ')); }
  { const W = await stand(), faults: string[] = checkLesson(W.game); verdict(!faults.length, 'the block against the built floor: every test names a kind, a door, a light and an area this floor has', faults.join(' · ')); }
  // (not a verdict: a rows list that names an act and withholds the one that puts it back — game/rails.ts rowsWithheld; its author's to judge)
  { const { rowsWithheld } = await import(`${ROOT}/src/game/rails.ts`); for (const n of rowsWithheld(JSON.parse(readFileSync(file, 'utf8')).scenarios?.lesson) as string[]) console.log(`  NOTE  ${n}`); }
  for (const e of rows) {
    const q: string = scenarioQuery(e);
    verdict(entryOfQuery(q)?.id === e.id, `'${e.title}': its link reads back to its own row`, q);
    LESSON.on = true;
    { const W = await stand(), g = W.game; const r = await quiet(() => startFromQuery(g, q)); await quiet(() => { for (let i = 0; i < 30; i++) W.step(1 / 60); });
      const o = g.lesson.objective(), line = g.objectiveText();
      verdict(!r.why && !!r.spec && !!o && g.lesson.i === 0 && line === o.text && line.includes(line0), `'${e.title}': starts, and the objective row is the lesson's first step`, r.why ?? line);
      if (e.squad === 0 && e.kind === 'quiet') {   // (a quiet run alone saves checkpoints: the lesson's place among its steps rides in the file)
        // (a tutorial mission's saves are its authored checkpoints, taken by the frame with the level's program stopped for the snapshot — rails.ts: the
        // harness's own snapshot is refused while that program runs. So there the step put up is the first that names one, and the frame's save is the one loaded)
        const ck = L.rails ? L.steps.findIndex((T: any) => !!T.checkpoint) : -1;
        const k = L.rails ? ck : Math.min(2, L.steps.length - 1); if (k >= 0) g.lesson.i = k;   // (the check's own hand on the step counter: the scripted run is lesson-run's)
        let why = k < 0 ? 'a tutorial mission played alone names no checkpoint on any step' : '';
        if (k >= 0) try {
          if (L.rails) { await quiet(() => { for (let i = 0; i < 3; i++) W.step(1 / 60); }); const kept = g.saves.newest(true, g.mission.stats.elapsed); g.lesson.i = 0;
            const no = kept ? g.saves.loadInStep(g, kept.key) : `no checkpoint was kept when step ${k + 1} came up`; if (no) why = String(no); await quiet(() => { for (let i = 0; i < 3; i++) W.step(1 / 60); }); }
          else { const snap = W.snapshot('lesson-check', true); g.lesson.i = 0; await quiet(() => { W.restore(snap); for (let i = 0; i < 3; i++) W.step(1 / 60); }); }
        } catch (x) { why = String((x as Error).message); }
        verdict(!why && g.lesson.i >= k && !!g.lesson.objective()?.text.includes(`${g.lesson.i + 1}/${L.steps.length}`), `'${e.title}': a checkpoint carries the step that is up (saved on step ${k + 1}, loaded on step ${g.lesson.i + 1})`, why); }
      g.lesson.i = Math.min(1, L.steps.length - 1);   // (the check's own hand again: every row is restarted from a step that is NOT the first)
      // a restart BETWEEN FRAMES: before the lesson's next tick the step it still holds is the last run's — neither a checkpoint nor the row may carry it
      { let snapI = -1, row = ''; await quiet(() => { g.restartEncounter(); if (!g.lesson.data) startFromQuery(g, q); snapI = g.lesson.data ? g.lesson.snapshot().i : -2; row = g.lesson.objective()?.text ?? ''; });
        verdict(snapI === 0 && row.includes(line0) && !g.lesson.finished, `'${e.title}': straight after a restart, before any frame, a checkpoint would file step 1 and the row reads step 1 (not the last run's step)`, `snapshot step ${snapI + 1} · row "${row}"`); }
      await quiet(() => { for (let i = 0; i < 30; i++) W.step(1 / 60); });
      verdict(g.lesson.i === 0 && !!g.lesson.objective()?.text.includes(line0), `'${e.title}': a restart puts the lesson back on its first step`, g.lesson.summary()); }
    LESSON.on = false;
    { const W = await stand(), g = W.game; const r = await quiet(() => startFromQuery(g, q)); await quiet(() => { for (let i = 0; i < 30; i++) W.step(1 / 60); });
      const line = g.objectiveText();
      verdict(!r.why && !g.lesson.objective() && !g.lesson.data && !!line && !line.startsWith('training'), `'${e.title}': with the switch off it is its mission alone`, line); }
    LESSON.on = true;
  }
}
// A LESSON'S PAGE AND THE KEPT KIT (kit.ts kitIssuedPage): on the page of a Training level every staging puts the ISSUE cards on the men, and the table and
// its store stay this machine's — so the loadout screen opened there for another mission (the boot card's button, or the card with no scenario up) shows the
// kept cards and keeps a change, and a start or restart of the lesson under that screen still stages the issue kit. Run once (with the first lesson, or all).
if (!names.length || names.includes('tut-solo')) { console.log('\n=== lesson-check: a lesson\'s page and the kit this machine keeps ===');
  const { El, withDom } = await import('./scenario-picker-probes.ts');
  const K = await import(`${ROOT}/src/game/kit.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`);
  const m = new Map<string, string>(), st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  const kept = (i = 0) => JSON.parse(m.get(K.KIT_LS) ?? '{}').members?.[i] ?? {};
  const rowOf = (id: string) => (LESSON_MISSIONS as any[]).find(e => e.id === id), other = (ALL_MISSIONS as any[]).find(e => e.group !== 'tutorial' && e.kind !== 'solo' && e.kind !== 'quiet');
  const standRow = async (e: any) => { const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', e.level), 'utf8'))), seed: 1 })); const r = await quiet(() => startFromQuery(W.game, scenarioQuery(e))); if (e.kind === 'quiet' && !e.squad) K.kitSolo(W.game);   // (main.ts: a mission played alone wears Sam's card through kitSolo, and every fresh Player after a restart through kitFresh)
    return { W, g: W.game, why: r.why as string | undefined }; };
  const team = (g: any) => g.guards.filter((x: any) => x.unit && x.team === 'operative');
  const lessonOn = LESSON.on; LESSON.on = true;
  // ONE CARD FOR EVERY MISSION, for this block (kit.ts KITDEAL.stealth): 'the same start off a lesson's page' is a quiet run alone, which on the page's stand wears
  // your STEALTH card, not the kept card this block sets by hand. The lines here are about the lesson's page wearing the issue kit; the stealth card on such a page
  // is tools/qa/kitstealth-check.ts's line. Held as the probe runner holds it (the word for a game stood up, the table for now); a word set by hand wins.
  const stealthHeld = process.env.TPS_KITSTEALTH === undefined, stealthWas = K.KITDEAL.stealth; if (stealthHeld) { process.env.TPS_KITSTEALTH = '0'; K.KITDEAL.stealth = false; }
  try {
    await withDom('', async () => {
      K.kitLoad(st, ''); const set = K.kitSet(0, 'weapon', 'pistol') && K.kitSet(1, 'light', false); const st0 = m.get(K.KIT_LS);   // (this machine keeps a card with no rifle — the card that left a lesson's 'press 2' unpassable — and a teammate with no weapon light)
      // (staged on two tutorial missions whose levels issue no kit of their own — tut-solo and tut-pair do, scenarios.issue, and the kept card never shows on those:
      // one played alone, one with the team)
      const alone: any = rowOf('tut-quiet'), pair: any = rowOf('tut-plan');
      // the plant is real: off a lesson's page that start wears the kept card
      const P = await standRow(alone); const plainRifle = P.g.player.hasRifle;
      K.kitIssuedPage(true);   // (main.ts on a lesson level's load)
      const A = await standRow(alone), tableA = K.KIT.members[0].weapon;
      verdict(set && !P.why && !A.why && plainRifle === false && A.g.player.hasRifle === true && tableA === 'pistol' && m.get(K.KIT_LS) === st0, `'${alone.title}' on its page is staged with the issue kit whatever this machine keeps, and the table and the store are left as the machine keeps them`,
        `kept: no rifle, member 1 no light (set ${set}) · the same start off a lesson's page has the rifle: ${plainRifle} · on its page: ${A.g.player.hasRifle} · the table after staging '${tableA}' · the store ${m.get(K.KIT_LS) === st0 ? 'unchanged' : 'CHANGED'}`);
      // … and your four counts in a lesson are what a Player is built with, not the one of each the pouches rule issues (kit.ts kitIssuedPage: a lesson may have
      // you throw more than one can); off a lesson's page the same start carries the kept card's
      { const held = (g: any) => `${g.player.canisters}/${g.player.flashbangs}/${g.player.frags}/${g.player.rifle.shells}`;
        verdict(K.SLOTS.on && held(A.g) === '4/2/2/3' && held(P.g) === '1/1/1/0', 'under the pouches rule a lesson\'s player carries what a Player is built with (4 smoke, 2 stun, 2 frags, 3 rounds of 40 mm: the kit lesson throws more than one can), while the same start off a lesson\'s page carries the kept card\'s counts',
          `smoke/stun/frag/40 mm — on its page ${held(A.g)} · off a lesson's page (the kept card: no rifle, one of each) ${held(P.g)}`); }
      // another mission's loadout over the lesson: the kept cards, a change kept — and the lesson restarted under it is still the issue kit
      const S = UI.openLoadout(other, { host: new El('BODY') as any, deploy: () => { } });
      const shown = K.KIT.members[0].weapon, cards = !!S.card, stepped = K.kitTry(0, 'suit', 1).ok, suit = K.KIT.members[0].suit, written = kept().weapon === 'pistol' && kept().suit === suit && suit !== 'issued';
      const tint0 = JSON.stringify(A.g.player.char.tint);
      await quiet(() => { A.g.restartEncounter(); if (!A.g.lesson.data) startFromQuery(A.g, scenarioQuery(alone)); for (let i = 0; i < 3; i++) A.W.step(1 / 60); });
      const under = A.g.player.hasRifle, tint1 = JSON.stringify(A.g.player.char.tint), still = K.KIT.members[0];
      verdict(shown === 'pistol' && cards && stepped && written && under === true && tint1 === tint0 && still.weapon === 'pistol' && still.suit === suit, `the loadout of another mission ('${other.title}') opened from the lesson's page shows the kept cards and keeps a change; the lesson restarted UNDER that screen is still the issue kit, and the screen's table is not touched by it`,
        `on the screen '${shown}', cards ${cards} · a suit stepped ${stepped} → ${suit}, in the store ${written} · restarted under it: rifle ${under}, his suit as issued ${tint1 === tint0} · the table after '${still.weapon}' / ${still.suit}`);
      S.back(); const stored1 = K.kitTry(0, 'trim', 1).ok && kept().trim === K.KIT.members[0].trim;
      verdict(K.KIT.members[0].weapon === 'pistol' && K.KIT.members[0].suit === suit && kept().suit === suit && stored1, 'when that screen goes the table is still the kept one, and a change after a staging is still written (the store was put back)', `table ${K.KIT.members[0].weapon} / ${K.KIT.members[0].suit} · store ${kept().weapon} / ${kept().suit} · a later change written ${stored1}`);
      // a lesson with teammates: each man the issue card, though member 1's kept card has no light
      const T = await standRow(pair), ops = team(T.g), c1 = ops[0] ? K.kitOf(ops[0]) : null;
      K.kitIssuedPage(false); const U = await standRow(pair), uops = team(U.g), u1 = uops[0] ? K.kitOf(uops[0]) : null; K.kitIssuedPage(true);
      verdict(!T.why && ops.length === pair.squad && c1?.light === true && ops[0].lightDeadUntil !== Infinity && T.g.player.hasRifle === true && u1?.light === false && K.KIT.members[1].light === false && kept(1).light === false, `'${pair.title}' on its page: every teammate is staged with his issue card (off a lesson's page the same start gives member 1 the kept card), the kept cards untouched`,
        `${ops.length} teammate(s) · member 1 staged with a light ${c1?.light} (off a lesson's page ${u1?.light}) · Sam's rifle ${T.g.player.hasRifle} · the table's member 1 light ${K.KIT.members[1].light} · the store's ${kept(1).light}`);
      // a staging that throws leaves the table, the store and the switch as they were
      let threw = false; try { K.kitStage({} as any, [{} as any]); } catch { threw = true; }
      const after = K.KIT.members[0].weapon, stored2 = K.kitTry(0, 'trim', 1).ok && kept().trim === K.KIT.members[0].trim; const B = await standRow(alone);
      verdict(threw && after === 'pistol' && stored2 && B.g.player.hasRifle === true, 'a staging that throws leaves the kept table and its store in place, and the next lesson start is still the issue kit', `threw ${threw} · table '${after}' · a change written ${stored2} · next start's rifle ${B.g.player.hasRifle}`);
    });
  } finally { UI.loadoutOpen()?.close(); K.kitIssuedPage(false); K.KIT_SOLO.on = false; K.kitLoad(null, ''); LESSON.on = lessonOn; if (stealthHeld) { delete process.env.TPS_KITSTEALTH; K.KITDEAL.stealth = stealthWas; } }
}
console.log(fails ? `\n=== lesson-check: ${fails} FAIL of ${checks} ===` : `\n=== lesson-check: ALL PASS (${checks} checks) ===`);
process.exit(fails ? 1 : 0);
