// The 'missions' family (THE MISSION LIST, the level select — ui/missions.ts; opened off ui/menu.ts's cards), run through probes.ts:
//   bun run tools/qa/probes.ts missions | missions-list | missions-screen | missions-start
// PASS / FAIL each, all headless. Nothing here looks at a picture: the screen is the real openMissions on the picker probes' fake DOM (what it puts on the page
// and what its keys and clicks do, not how it looks), and main.ts's one line for it (?solo keeps the start card shut) is the page's, not run here.
//   missions-list    the list as data: the solo night and EVERY row of SCENARIOS, in their groups (a heading per group); an id, a title, a place, a line, a lean and a
//                    defenders cell on each; every row's URL reads back to that row (and to nothing else), keeps the visitor's flags, drops an older run's
//   missions-screen  the real screen: the start card's Missions button opens it; one link per mission in order; the sheet follows the highlight (title, place,
//                    line, team, defenders, approach, level, untuned exactly where set); W S ↑ ↓ move and wrap, A D ← → set Standard | Hard and put it on every
//                    scenario link, Enter and Space start the highlighted row = a load of ITS OWN URL (every row, both keys); the solo night off the start
//                    card is Start (no load); `MISSIONS.onPick` takes the pick instead of the load; Esc goes back to the card; the boot card's and the plain
//                    pause card's buttons
//   missions-start   every row's URL booted in a process of its own (scenario-picker-probes.ts --boot, the page's own startFromQuery): it starts unrefused as
//                    that row, with the row's team beside Sam and exactly the defenders the sheet says; ?solo boots the plain night — no scenario, the shift
//                    and the civilians the solo sheet counts
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const { SCENARIOS, ALL_MISSIONS, SCENARIO_KEYS, pickSearch, quitSearch, entryOfQuery, specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const M = await import(`${ROOT}/src/ui/missions.ts`);
const { MISSION_GROUPS } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { difficultyNow, setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { PRESSURE } = await import(`${ROOT}/src/game/pressure.ts`);
const { onShortList } = await import(`${ROOT}/src/scene/picks.ts`);   // (a mission the start card's short list names does not wear 'untuned' on its sheet; under ?nopicks it does)
const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);   // (while every mission starts the same way the Way in row offers no 'Dealt': the line below reads the rule and asks for the row it gives)

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const first = (r: El, cls: string) => r.all(e => e.cls.has(cls))[0];
export interface MRow { id: string; href: string; n: string; title: string; team: string; lean: string; sel: boolean }
export const missionRowsOf = (root: El): MRow[] => root.all(e => e.cls.has('mrow')).map(a => ({ id: a.attrs['data-mission'] ?? '', href: a.attrs.href ?? '', n: first(a, 'mn')?.textContent ?? '', title: first(a, 'mtitle')?.textContent ?? '',
  team: first(a, 'team')?.textContent ?? '', lean: [...(first(a, 'mlean')?.cls ?? [])].filter(c => c !== 'mlean').join(' '), sel: a.cls.has('sel') }));
const factOf = (root: El, name: string) => root.all(e => e.attrs['data-fact'] === name)[0]?.all(e => e.tagName === 'B')[0]?.textContent ?? '';
const sheetOf = (root: El) => ({ title: first(root, 'mst')?.textContent ?? '', place: first(root, 'mplace')?.textContent ?? '', blurb: first(root, 'mblurb')?.textContent ?? '', untuned: first(root, 'untuned')?.style.display !== 'none',
  team: factOf(root, 'team'), defenders: factOf(root, 'defenders'), approach: factOf(root, 'approach'), level: factOf(root, 'level'), go: first(root, 'mgo')?.attrs.href ?? '', goId: first(root, 'mgo')?.attrs['data-mission'] ?? '', goText: first(root, 'mgo')?.textContent ?? '' });
const buttons = (root: El) => root.all(e => e.tagName === 'BUTTON');
const buttonOf = (root: El, text: string) => buttons(root).find(b => b.textContent === text);

// ───────────────────────────────────────────────────────────── list ─────────────────────────────────────────────────────────────
export async function missionsList(): Promise<boolean> {
  const F = family('missions-list: the mission list as data — the solo night and every scenario, each to its own URL and back');
  const L: any[] = M.missionList(), S: any[] = ALL_MISSIONS, FLAGS = '?quality=high&mute';   // (the squad's table and the quiet missions' — scenarioList.ts)
  // THE LIST IS IN ITS GROUPS (scene/scenarios.ts MISSION_GROUPS, ui/missions.ts groupOf): the groups in the table's order, and inside a group the solo night
  // first, then the scenarios in SCENARIOS' own order — every row once, under its own id and title
  { const rank = (g: string) => { const i = MISSION_GROUPS.findIndex((x: any) => x.id === g); return i < 0 ? MISSION_GROUPS.length : i; };
    const want = [M.SOLO_NIGHT, ...S.map(e => L.find(m => m.scenario === e))].map((m, i) => ({ m, i })).sort((a, b) => rank(a.m?.group) - rank(b.m?.group) || a.i - b.i).map(x => x.m);
    const heads = M.groupHeads(L), runs = Object.keys(heads).length, groups = new Set(L.map(m => m.group));
    M.UNPLAYED_UI.on = false; let L0: any[]; try { L0 = M.missionList(); } finally { M.UNPLAYED_UI.on = true; }   // (THIS LINE PINS THE ORDER BEFORE THE UNPLAYED ROWS WENT TO THE BACK OF THEIR GROUP — ui/missions.ts UNPLAYED_UI, held off for it; the order with it on is unplayed-check.ts's)
    F.verdict(L.length === S.length + 1 && L.includes(M.SOLO_NIGHT) && M.SOLO_NIGHT.scenario === null && M.SOLO_NIGHT.squad === 0 && want.every((m, i) => !!m && L0[i].id === m.id) && L0.length === L.length && S.every(e => { const m = L.find(x => x.scenario === e); return !!m && m.id === e.id && m.title === e.title && m.squad === e.squad && m.group === M.groupOf(e); }),
      'the solo night and every row of SCENARIOS once, each under its own id and title, in the groups\' order (inside a group: the solo night, then the list\'s own order — with the unplayed rows\' switch off, ?unplayed=0)', L0.map(m => `${m.id} '${m.title}'`).join(' · '));
    F.verdict(runs === groups.size && L.every(m => MISSION_GROUPS.some((x: any) => x.id === m.group)) && heads[0] === MISSION_GROUPS.find((x: any) => x.id === L[0].group).title && MISSION_GROUPS.map((x: any) => x.id).join(' ') === 'tutorial training raids strongholds clock quiet-alone quiet-two' && MISSION_GROUPS.every((G: any) => L.some(m => m.group === G.id) && G.title.length <= 14 && !/[.:]/.test(G.title))
      && MISSION_GROUPS.every((G: any) => L.filter(m => m.group === G.id).length <= 8) && M.SOLO_NIGHT.group === 'quiet-alone'
      && M.groupOf({ kind: 'roomclear', squad: 4 }) === 'raids' && M.groupOf({ kind: 'nightbreach', squad: 2 }) === 'raids' && M.groupOf({ kind: 'rescue', squad: 2 }) === 'clock' && M.groupOf({ kind: 'quiet', squad: 0 }) === 'quiet-alone' && M.groupOf({ kind: 'quiet', squad: 1 }) === 'quiet-two',
      'every row names a group of the table; a heading falls over the first row of each group and nowhere else; the seven groups (tutorial, training, raids, strongholds, on the clock, quiet alone, quiet as two) each hold rows under a heading of a word or two; no group holds more than eight; a row that names none: quiet by its team, a rescue on the clock, else a raid',
      MISSION_GROUPS.map((G: any) => `${G.title}: ${L.filter(m => m.group === G.id).map(m => m.id).join(', ') || '(no row yet: no heading)'}`).join('\n    ') + `\n    headings at rows ${Object.entries(heads).map(([i, t]) => `${i} '${t}'`).join(' · ')}`); }
  // THE SWITCH (?nogroups, GROUPS_UI.on false): the list drawn as it was — the solo night, then every row in its table's order, and no group heading
  { M.GROUPS_UI.on = false; let off: any[], offHeads: any; try { off = M.missionList(); offHeads = M.groupHeads(off); } finally { M.GROUPS_UI.on = true; }
    F.verdict(off.length === L.length && off[0] === M.SOLO_NIGHT && S.every((e, i) => off[i + 1].scenario === e) && Object.keys(offHeads).length === 0 && M.missionList().every((m: any, i: number) => m.id === L[i].id),
      '?nogroups: the solo night, then every row in its table\'s own order, no group heading; switched back on, the groups\' order again', off.map((m: any) => m.id).join(' · ')); }
  F.verdict(new Set(L.map(m => m.id)).size === L.length && new Set(L.map(m => m.title)).size === L.length, 'no two missions share an id or a title', `${L.length} missions`);
  F.verdict(L.every(m => m.place.length >= 6 && m.place.length <= 64 && m.blurb.length >= 20 && m.blurb.length <= 160 && ['quiet', 'loud', 'either'].includes(m.lean) && m.defenders !== '—' && m.defenders.length > 0),
    'every mission has a place, a line, a lean and a defenders cell (none left blank)', L.map(m => `${m.id}: ${m.place} · ${M.leanWords(m.lean)} · ${M.teamWordsOf(m)} · defenders ${m.defenders}`).join('\n    '));
  F.verdict(S.every(e => typeof e.place === 'string' && typeof e.defenders === 'number' && !!e.lean) && L.some(m => m.lean === 'quiet') && L.some(m => m.lean === 'loud'),
    'every SCENARIOS row carries its own display fields (place, lean, defenders); quiet and loud are both on the list', S.map(e => `${e.id} ${e.lean} ${e.defenders}`).join(' · '));
  { const was = difficultyNow(); setDifficulty('standard', false);
    const bad = L.filter(m => M.missionOfQuery(M.missionHref(m, ''), L) !== m || M.missionOfQuery(M.missionHref(m, FLAGS), L) !== m);
    const scn = L.filter(m => m.scenario), same = scn.every(m => M.missionHref(m, FLAGS) === pickSearch(m.scenario, FLAGS) && entryOfQuery(M.missionHref(m, FLAGS)) === m.scenario);
    const solo = M.missionHref(M.SOLO_NIGHT, ''), soloF = M.missionHref(M.SOLO_NIGHT, FLAGS), soloOver = M.missionHref(M.SOLO_NIGHT, '?levelFile=depot.json&roomclear&squad4&mute');
    F.verdict(bad.length === 0 && same, "every mission's URL reads back to that mission, a visitor's flags beside it or not; a scenario's is the picker's own (pickSearch)", L.map(m => `${m.id} → ${M.missionHref(m, '')}`).join(' · ') + (bad.length ? ` — NOT: ${bad.map(m => m.id).join(', ')}` : ''));
    F.verdict(solo === '?solo' && soloF === '?solo&quality=high&mute' && soloOver === '?solo&mute' && specOfQuery(solo) === null && SCENARIO_KEYS.includes(M.SOLO_KEY),
      "the solo night's URL is ?solo — no scenario flag (the page boots the plain night), the visitor's flags kept, an older run's dropped", `${solo} · ${soloF} · over a depot URL → ${soloOver}`);
    const over = pickSearch(S[0], '?solo&mute'), quit = quitSearch('?solo&mute'), none = M.missionOfQuery('?quality=high', L), mixed = M.missionOfQuery('?solo&rescue', L);
    F.verdict(over === pickSearch(S[0], '?mute') && quit === '?mute' && none === null && mixed?.scenario?.kind === 'rescue', "a scenario picked over ?solo drops it, and so does a quit; a plain URL names no mission; ?solo beside a scenario flag is the scenario (as the page boots it)",
      `${over} · quit → '${quit}' · ?quality=high → ${none?.id ?? 'none'} · ?solo&rescue → ${mixed?.id}`);
    setDifficulty('hard', false);
    const hard = scn.every(m => M.missionHref(m, FLAGS) === `${pickSearch(m.scenario, FLAGS)}&difficulty=hard`) && M.missionHref(M.SOLO_NIGHT, FLAGS) === soloF, hardWas = M.missionHref(scn[0], FLAGS);
    setDifficulty('standard', false);
    F.verdict(hard, 'with the defenders on hard every scenario URL carries it (the choice rides the load); the solo night\'s never does', `${hardWas} · ${soloF}`);
    if (was === 'hard') setDifficulty('hard', false); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── screen ─────────────────────────────────────────────────────────────
export async function missionsScreen(): Promise<boolean> {
  const F = family('missions-screen: the real screen on a fake DOM — off the start card, the sheet, the keys, a pick is a load of the row\'s own URL');
  const SEARCH = '?quality=high&mute', G = globalThis as any;
  try {
    await withDom(SEARCH, async (root) => {
      const { Menu, bootCard } = await import(`${ROOT}/src/ui/menu.ts`);
      const loads: string[] = []; G.location.pathname = '/'; G.location.hash = ''; G.location.assign = (u: string) => { loads.push(u); }; G.location.reload = () => { loads.push('(reload)'); };
      const W = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game;
      let starts = 0;
      const menu = new Menu({ engine: W.engine, game: g, quality: { auto: false, current: 'high', adaptive: true, lastChange: '' }, audio: { volume: { master: 1, sfx: 1, ambience: 1, music: 1 }, setVolumes() {} }, overlay: { showLightDots: true }, onStart() { starts++; } } as any);
      const L: any[] = M.missionList();
      setDifficulty('standard', false); M.MISSIONS.onPick = null;
      // ---- the start card
      menu.open('start');
      F.verdict(!!buttonOf(root, 'Missions') && !!buttonOf(root, 'Start') && root.all(e => e.cls.has('scn') || e.cls.has('mrow')).length === 0 && M.currentMissions() === null,
        'the start card carries a Missions button beside Start and no scenario rows of its own; the list is not up until asked for', buttons(root).map(b => b.textContent).join(' · '));
      buttonOf(root, 'Missions')!.onclick!();
      let S = M.currentMissions()!, mroot: El = S?.root as any;
      const rows = missionRowsOf(mroot);
      F.verdict(!!S && mroot.cls.has('on') && rows.length === L.length && rows.every((r, i) => r.id === L[i].id && r.title === L[i].title && r.n === String(i + 1).padStart(2, '0')), 'Missions pressed: the list is up with one numbered row per mission, in order', rows.map(r => `${r.n} ${r.title}`).join(' · '));
      F.verdict(rows.every((r, i) => r.href === M.missionHref(L[i], SEARCH) && r.href.endsWith('quality=high&mute') && r.team === M.teamTagOf(L[i]) && r.lean === L[i].lean) && rows.filter(r => r.sel).length === 1 && rows[0].sel,
        "each row is a link to its own URL (the visitor's flags kept) tagged solo / pair / four with its lean; exactly one is highlighted — the first, with nothing remembered", rows.map(r => `${r.title} [${r.team} · ${r.lean}] ${r.href}`).join('\n    '));
      // ---- the sheet follows the highlight
      { const bad: string[] = [];
        for (let i = 0; i < L.length; i++) { S.select(i); const sh = sheetOf(mroot), m = L[i];
          const ok = sh.title === m.title && sh.place === m.place && sh.blurb === m.blurb && sh.untuned === (m.untuned && !onShortList(m.id)) && sh.team === M.teamWordsOf(m) && sh.defenders === m.defenders && sh.approach === M.leanWords(m.lean)
            && sh.level === (m.scenario?.level ? m.scenario.level.replace(/\.json$/, '') : 'office') && sh.go === M.missionHref(m, SEARCH) && sh.goId === m.id && missionRowsOf(mroot).findIndex(r => r.sel) === i;
          if (!ok) bad.push(m.id); }
        S.select(L.length - 1); const last = sheetOf(mroot);
        F.verdict(bad.length === 0, "each row highlighted in turn: the sheet shows that mission's title, place, line, team, defenders, approach and level, 'untuned' exactly where set (and never on a mission the short list names), and its button links that mission's URL",
          `last: ${last.title} — ${last.place} — team ${last.team} · defenders ${last.defenders} · ${last.approach} · level ${last.level}${last.untuned ? ' · untuned' : ''} · [${last.goText}] ${last.go}` + (bad.length ? ` — NOT: ${bad.join(', ')}` : '')); }
      // ---- the keys
      { const at = () => missionRowsOf(mroot).findIndex(r => r.sel), key = (code: string, extra: any = {}) => M.missionsKey({ code, ...extra });
        S.select(0); const seq: number[] = [];
        for (const k of ['KeyS', 'ArrowDown', 'KeyW', 'ArrowUp', 'ArrowUp', 'KeyS']) { key(k); seq.push(at()); }
        const other = key('KeyQ'), mod = key('KeyS', { ctrlKey: true }), afterMod = at(), d6 = key('Digit6');
        F.verdict(JSON.stringify(seq) === JSON.stringify([1, 2, 1, 0, L.length - 1, 0]) && !other && !mod && afterMod === 0 && !d6, 'S and ↓ move down, W and ↑ up, wrapping at the ends; a key that is not the list\'s (Q, a digit, Ctrl+S) is left to the page',
          `highlight after S ↓ W ↑ ↑ S: ${seq.join(' ')} · Q taken: ${other} · Ctrl+S taken: ${mod} · 6 taken: ${d6}`);
        const RC = L.findIndex(m => m.id === 'room-clear-pair');   // (the row these difficulty checks stand on: the office room clear, wherever its group puts it)
        S.select(RC); const lit = () => mroot.all(e => !!e.attrs['data-difficulty'] && e.cls.has('on')).map(e => e.attrs['data-difficulty']).join(',');
        const l0 = lit(); key('KeyD'); const l1 = lit(), now1 = difficultyNow(), h1 = missionRowsOf(mroot); key('ArrowLeft'); const l2 = lit(), now2 = difficultyNow(); key('ArrowRight'); const l3 = lit(); key('KeyA'); const l4 = lit(), h4 = missionRowsOf(mroot);
        mroot.all(e => e.attrs['data-difficulty'] === 'hard')[0]?.onclick?.(); const l5 = lit(); mroot.all(e => e.attrs['data-difficulty'] === 'standard')[0]?.onclick?.(); const l6 = lit();
        F.verdict(l0 === 'standard' && l1 === 'hard' && now1 === 'hard' && l2 === 'standard' && now2 === 'standard' && l3 === 'hard' && l4 === 'standard' && l5 === 'hard' && l6 === 'standard'
          && h1.every((r, i) => r.href === (L[i].scenario ? `${pickSearch(L[i].scenario, SEARCH)}&difficulty=hard` : M.missionHref(L[i], SEARCH))) && h4.every((r, i) => r.href === (L[i].scenario ? pickSearch(L[i].scenario, SEARCH) : '?solo&quality=high&mute')),
          'D and → put the defenders on hard, A and ← back on standard (the buttons do the same); the choice goes on every scenario link and never on the solo night\'s', `lit: ${[l0, l1, l2, l3, l4, l5, l6].join(' → ')} · ${h1[RC].href} · ${h4[RC].href}`);
        { const V = M.openMissions({ search: '?hard&mute' }); setDifficulty('hard', false); V.select(RC); const vh = missionRowsOf(V.root as any)[RC].href; M.missionsKey({ code: 'KeyA' }); const vs = missionRowsOf(V.root as any)[RC].href, vsolo = missionRowsOf(V.root as any)[L.indexOf(M.SOLO_NIGHT)].href; V.close();
          F.verdict(vh === '?roomclear&mute&difficulty=hard' && vs === '?roomclear&mute&difficulty=standard' && vsolo === '?solo&hard&mute', 'a visitor who arrived on ?hard and switches to standard gets it SAID on the link (over the flag he came with)', `${vh} · ${vs}`); }
        buttonOf(root, 'Missions')!.onclick!(); S = M.currentMissions()!; mroot = S.root as any;
        S.select(L.indexOf(M.SOLO_NIGHT)); key('KeyD'); const soloD = difficultyNow(); setDifficulty('standard', false);
        F.verdict(soloD === 'standard', 'on the solo night A and D change nothing (the switch is the squad scenarios\')', `tables read: ${soloD}`); }
      // ---- the way in: the player's pick on the levels that give more than one start, on the link and nowhere else
      { const CP = L.findIndex(m => m.id === 'compound-four'), SOLO = L.indexOf(M.SOLO_NIGHT), hrefAt = (i: number) => missionRowsOf(mroot)[i].href, hasWay = (h: string) => /(^|[?&])way=/.test(h);
        const btns = () => mroot.all(e => !!e.attrs['data-way']), shown = () => btns().filter(b => b.style.display !== 'none').map(b => `${b.textContent}${b.cls.has('on') ? '*' : ''}`).join(' | ');
        S.select(CP); const s0 = shown(), h0 = hrefAt(CP);
        M.missionsKey({ code: 'KeyK' }); const s1 = shown(), h1 = hrefAt(CP), go1 = sheetOf(mroot).go;
        M.missionsKey({ code: 'KeyK' }); const h2 = hrefAt(CP); M.missionsKey({ code: 'KeyK' }); const h3 = hrefAt(CP); M.missionsKey({ code: 'KeyK', shiftKey: true } as any); const h3b = hrefAt(CP);
        btns().find(b => b.attrs['data-way'] === '2')!.onclick!(); const h4 = hrefAt(CP), others = missionRowsOf(mroot).filter((r, i) => i !== CP && hasWay(r.href)).length;
        S.select(SOLO); const sSolo = shown(), tSolo = M.missionsKey({ code: 'KeyK' }), hSolo = hrefAt(SOLO), rowSolo = mroot.all(e => e.cls.has('mway'))[0]?.style.display;
        const quitWay = quitSearch('?roomclear&squad4&levelFile=compound.json&way=2&mute'), overWay = pickSearch(SCENARIOS[0], '?way=2&mute');
        const V = M.openMissions({ search: '?way=2&mute' }); const leak = missionRowsOf(V.root as any).filter(r => r.id !== 'compound-four' && hasWay(r.href)).length; V.close();
        buttonOf(root, 'Missions')!.onclick!(); S = M.currentMissions()!; mroot = S.root as any; const kept = hrefAt(CP); S.select(CP); S.setWay(0); const back = hrefAt(CP);
        // (the same start rule on = two buttons and K steps way 2, back to the level's own; off = 'Dealt' is the third and K reaches way=any. WAYROW_BREAK=1 asks for the other stand's row: the line must FAIL)
        const same = SAMESTART.on !== (process.env.WAYROW_BREAK === '1'), dealt = same ? '' : ' | Dealt';
        const stepped = same ? !hasWay(h2) && h3.endsWith('&way=2') && !hasWay(h3b) : h2.endsWith('&way=any') && !hasWay(h3) && h3b.endsWith('&way=any');
        F.verdict(CP >= 0 && s0 === `the side yard gate* | the back gate${dealt}` && !hasWay(h0) && s1 === `the side yard gate | the back gate*${dealt}` && h1.endsWith('&way=2') && go1 === h1 && stepped
          && h4.endsWith('&way=2') && others === 0 && sSolo === '' && rowSolo === 'none' && tSolo && !hasWay(hSolo) && leak === 0 && kept.endsWith('&way=2') && !hasWay(back) && quitWay === '?mute' && !hasWay(overWay),
          (same ? "the Way in row: on the compound it names both gates and no 'Dealt' (every mission starts the same way), the level's own lit and nothing on the link; K steps it (way=2, back to none; Shift+K the other way) and a click picks; only"
            : "the Way in row: on the compound it names both gates and 'Dealt', the level's own lit and nothing on the link; K steps it (way=2, way=any, back to none; Shift+K the other way) and a click picks; only")
          + " that mission's link carries it, a mission with one way in shows no row, a page that came with ?way=2 hands it to no other row, the pick is still there when the list is opened again, and quitting or picking another mission takes the key off the link",
          `${s0} → ${s1} · ${h1} · ${h2} · ${h3} · ${h3b} · other rows carrying a way: ${others} · solo: '${sSolo}' row ${rowSolo} · leak: ${leak} · reopened: ${kept} · quit: '${quitWay}' · picked over: '${overWay}'`); }
      // ---- a pick = a load of that row's own URL, every row, both keys
      { setDifficulty('standard', false); const bad: string[] = [];
        for (let i = 0; i < L.length; i++) if (L[i] !== M.SOLO_NIGHT) for (const k of ['Enter', 'Space']) { loads.length = 0; S.select(i); const took = M.missionsKey({ code: k }); if (!took || loads.length !== 1 || loads[0] !== '/' + M.missionHref(L[i], SEARCH) || M.missionOfQuery(loads[0].slice(1), L) !== L[i]) bad.push(`${L[i].id}/${k} → ${loads.join(',')}`); }
        loads.length = 0; S.select(3); M.missionsKey({ code: 'Enter', repeat: true }); const rep = loads.length;
        first(mroot, 'mgo')!.onclick!(); const byButton = [...loads]; loads.length = 0;
        (mroot.all(e => e.cls.has('mrow'))[5] as any).onclick(); const clicked = missionRowsOf(mroot).findIndex(r => r.sel), clickLoads = loads.length; (mroot.all(e => e.cls.has('mrow'))[5] as any).ondblclick(); const dbl = [...loads];
        F.verdict(bad.length === 0 && rep === 0 && byButton.length === 1 && byButton[0] === '/' + M.missionHref(L[3], SEARCH) && clicked === 5 && clickLoads === 0 && dbl.length === 1 && dbl[0] === '/' + M.missionHref(L[5], SEARCH),
          'Enter and Space on each scenario row load exactly that row\'s URL (which reads back to that row); a key held down does not; the sheet\'s button loads it too; a click on a row highlights it and a double click starts it',
          `${(L.length - 1) * 2} picks checked · button → ${byButton[0]} · double click on row 6 → ${dbl[0]}` + (bad.length ? ` — NOT: ${bad.join(' · ')}` : '')); }
      // ---- the solo night off the start card is Start; anywhere else it is a load of ?solo
      { const QFS = (await import(`${ROOT}/src/game/quietfog.ts`)).QUIETFOG, soloFogWas = QFS.solo; QFS.solo = false;   // (QUIETFOG.solo down for this one: under the fog the solo night off a plain page is a load of its own link — solofog-check.ts; here, the start as it was)
        loads.length = 0; S.select(L.indexOf(M.SOLO_NIGHT)); const before = starts; M.missionsKey({ code: 'Enter' }); QFS.solo = soloFogWas;
        F.verdict(loads.length === 0 && starts === before + 1 && menu.mode === 'closed' && M.currentMissions() === null && !mroot.cls.has('on'), 'the solo night picked off the start card over the plain night is Start: the card closes, the list goes, nothing loads', `loads ${loads.length} · onStart ${starts - before} · menu '${menu.mode}'`);
        menu.open('pause'); const pauseBtn = !!buttonOf(root, 'Missions'); buttonOf(root, 'Missions')?.onclick?.(); const P = M.currentMissions()!; P.select(L.indexOf(M.SOLO_NIGHT)); loads.length = 0; P.pick();
        F.verdict(pauseBtn && loads.length === 1 && loads[0] === '/?solo&quality=high&mute' && menu.mode === 'pause', 'the plain pause card offers Missions too; the solo night picked from there is a load of ?solo (a fresh night), not a resume', `${loads.join(',')} · menu '${menu.mode}'`);
        P.close(); menu.close(); }
      // ---- the seam: onPick instead of the load
      { menu.open('start'); const got: string[] = []; M.MISSIONS.onPick = (m: any, href: string) => { got.push(`${m.id} ${href}`); };
        buttonOf(root, 'Missions')!.onclick!(); const S2 = M.currentMissions()!; loads.length = 0; const before = starts;
        S2.select(L.indexOf(M.SOLO_NIGHT)); S2.pick(); M.MISSIONS.onPick = null;
        F.verdict(got.length === 1 && got[0] === `${M.SOLO_NIGHT.id} ?solo&quality=high&mute` && loads.length === 0 && starts === before && M.currentMissions() === null && menu.mode === 'start',
          'with MISSIONS.onPick set (the loadout screen\'s way in) a pick hands over the mission and its URL instead: nothing loads, nothing starts, and the list is closed first (the next screen\'s keys are its own)', got.join(' · '));
        M.MISSIONS.onPick = (m: any, href: string) => { got.push(`${m.id} ${href}`); }; const S2b = M.openMissions({ select: L[0].id }); const backOn = S2b.selected.id; S2b.select(4); M.missionsKey({ code: 'Space' }); M.MISSIONS.onPick = null;
        F.verdict(backOn === L[0].id && got.length === 2 && got[1] === `${L[4].id} ${M.missionHref(L[4], SEARCH)}` && M.currentMissions() === null, 'that screen\'s Back reopens the list on the mission it was given (openMissions({ select })); a scenario row hands over the same way by key', got.join(' · '));
        // ---- Esc goes back to the card
        const S2c = M.openMissions(); const took = M.missionsKey({ code: 'Escape' });
        F.verdict(took && M.currentMissions() === null && menu.mode === 'start' && !(S2c.root as any).cls.has('on') && !M.missionsKey({ code: 'Escape' }) && !M.missionsKey({ code: 'KeyS' }), 'Esc closes the list and the start card is still there under it; with the list down its keys are nobody\'s (Esc is the page\'s again)', `menu '${menu.mode}'`);
        buttonOf(root, 'Missions')!.onclick!(); (M.currentMissions()!.root as any).all((e: El) => e.cls.has('mback'))[0].onclick(); const backed = M.currentMissions() === null;
        F.verdict(backed, 'the Back button does the same', `list ${backed ? 'closed' : 'still up'}`); }
      // ---- the list opens on the URL's mission, else on the one last started here
      { const S3 = M.openMissions({ search: '?levelFile=warehouse.json&roomclear&squad4&mute' }), a = S3.selected.id; S3.close();
        const S4 = M.openMissions({ search: '?solo' }), b = S4.selected.id; S4.close(); const S5 = M.openMissions({ select: 'rescue-registry' }), c = S5.selected.id; S5.close();
        F.verdict(a === 'warehouse-four' && b === 'solo-night' && c === 'rescue-registry', 'opened on a page whose URL names a mission, the list is on that row; a caller can name the row', `warehouse URL → ${a} · ?solo → ${b} · select → ${c}`); }
      // ---- three rules a review asked for: the URL read against the list GIVEN, hand-tuned defender rows kept under A / D, ?solo is not a scenario flag
      { const extra = { id: 't-pair', title: 'Test rooms', kind: 'roomclear', squad: 2, level: 'test-rooms.json' }, XL = M.missionList([...SCENARIOS, extra]);
        const X = M.openMissions({ list: XL, search: '?levelFile=test-rooms.json&roomclear&mute' }), onExtra = X.selected.id; X.close();
        setDifficulty('standard', false); PRESSURE.on = true; const custom = difficultyNow();
        const C = M.openMissions({ search: SEARCH }); C.select(M.missionList().findIndex((m: { id: string }) => m.id === 'room-clear-pair')); M.missionsKey({ code: 'KeyD' }); M.missionsKey({ code: 'ArrowLeft' }); const afterKeys = difficultyNow(), stillOn = PRESSURE.on;
        (C.root as any).all((e: El) => e.attrs['data-difficulty'] === 'standard')[0].onclick(); const afterClick = difficultyNow(); C.close(); setDifficulty('standard', false);
        menu.open('start'); const Q = M.openMissions({ search: '?solo&mute' }); loads.length = 0; const before = starts; Q.select(L.indexOf(M.SOLO_NIGHT)); Q.pick(); const soloLoads = loads.length, soloStarts = starts - before;
        F.verdict(onExtra === 't-pair' && custom === 'custom' && afterKeys === 'custom' && stillOn && afterClick === 'standard' && soloLoads === 0 && soloStarts === 1 && M.currentMissions() === null,
          "a list with a row of its own opens on that row when the URL names it; with hand-tuned defender rows ('custom') D and ← leave them alone and only a click on the switch writes over them; on a ?solo page with the start card up the solo night is still Start, no load",
          `URL → ${onExtra} · tables ${custom} → after D, ←: ${afterKeys} → after a click on standard: ${afterClick} · ?solo page: ${soloLoads} loads, onStart ${soloStarts}`); }
      // ---- the boot card
      { const card = bootCard(); const mb = buttonOf(root, 'Missions'), sb = buttonOf(root, 'Start'); mb?.onclick?.(); const up = M.currentMissions(), n = up ? missionRowsOf(up.root as any).length : 0; menu.open('start'); const kept = M.currentMissions() === up && !!up; card.off; M.closeMissions();
        F.verdict(!!mb && !mb.disabled && !!sb && sb.disabled && n === L.length && kept, 'the boot card (up while the shaders compile) has Missions live beside a waiting Start; the list opened there stays up when the real card replaces the boot card under it', `${n} rows · Start disabled: ${sb?.disabled}`);
        const card2 = bootCard(); buttonOf(root, 'Missions')!.onclick!(); card2.off();
        F.verdict(M.currentMissions() === null, 'a boot that opens no card (a scenario URL: the run is live underneath) takes the list down with the boot card', `list ${M.currentMissions() ? 'still up' : 'closed'}`); }
      menu.close();
    });
  } catch (e: any) { F.verdict(false, 'the screen probe ran to its end', String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ')); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── start ─────────────────────────────────────────────────────────────
const TAG = 'PICKER-BOOT ';
async function bootChild(query: string): Promise<any> {
  const p = Bun.spawn(['bun', 'run', `${ROOT}/tools/qa/scenario-picker-probes.ts`, '--boot', query], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(p.stdout).text(), errText = await new Response(p.stderr).text(); await p.exited;
  const line = out.split('\n').find(l => l.startsWith(TAG));
  return line ? JSON.parse(line.slice(TAG.length)) : { query, threw: `the boot printed no report (exit ${p.exitCode}): ${(errText || out).trim().split('\n').slice(-3).join(' | ')}` };
}
export async function missionsStart(): Promise<boolean> {
  const F = family('missions-start: every mission\'s URL booted in a process of its own — it starts as that row, with the team and the defenders its sheet says');
  setDifficulty('standard', false);
  const L: any[] = M.missionList(), FLAGS = '?quality=high&mute';
  const boots = await Promise.all(L.map(m => bootChild(M.missionHref(m, FLAGS))));
  const SOLO = L.indexOf(M.SOLO_NIGHT);
  for (let i = 0; i < L.length; i++) { if (i === SOLO) continue; const m = L[i], r = boots[i], s = r.start;
    // (a QUIET mission's defenders are the level's own shift — staff, not a staged side: one of its patrol sets, so 1 to the sheet's 'up to N', and nobody staged against the team)
    const men = m.scenario.kind === 'quiet' ? s?.hostiles === 0 && s?.staff >= 1 && s?.staff <= m.scenario.defenders : s?.hostiles === m.scenario.defenders;
    const ok = !r.threw && s && s.why === null && s.entry === m.id && s.operatives === m.squad && men && (r.errors ?? []).length === 0;
    F.verdict(!!ok, `${String(i + 1).padStart(2, '0')} ${m.title}: ${M.missionHref(m, FLAGS)}`, r.threw ? `threw: ${r.threw}` : `started ${s?.why === null ? 'unrefused' : `REFUSED (${s?.why})`} as '${s?.entry}' · ${s?.operatives} teammates (sheet: ${M.teamWordsOf(m)}) · ${m.scenario.kind === 'quiet' ? `${s?.staff} of the shift on` : `${s?.hostiles} defenders`} (sheet: ${m.defenders})${s?.hostages ? ` · ${s.hostages} hostages` : ''}${(r.errors ?? []).length ? ` · errors: ${r.errors.join(' | ')}` : ''}`); }
  { const m = L[SOLO], r = boots[SOLO], s = r.start, want = /^(\d+), and (\d+) civilians$/.exec(m.defenders);
    const ok = !r.threw && s && r.spec === null && s.active === null && s.operatives === 0 && s.units === 0 && !!want && s.staff === Number(want[1]) && s.civilians === Number(want[2]);
    F.verdict(!!ok, `01 ${m.title}: ${M.missionHref(m, FLAGS)}`, r.threw ? `threw: ${r.threw}` : `no scenario named or started (${s?.active ?? 'none'}) · nobody beside Sam · the shift ${s?.staff}, civilians ${s?.civilians} (sheet: ${m.defenders})`); }
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2).filter(a => !a.startsWith('-')); const on = (n: string) => !want.length || want.includes(n) || want.includes('missions');
  let ok = true;
  if (on('missions-list')) ok = (await missionsList()) && ok;
  if (on('missions-screen')) ok = (await missionsScreen()) && ok;
  if (on('missions-start')) ok = (await missionsStart()) && ok;
  process.exit(ok ? 0 : 1);
}
