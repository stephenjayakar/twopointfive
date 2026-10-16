// THE ROWS CUT FROM THE MISSION LIST ARE DRAWN ON NO LIST, AND STILL OPEN BY THEIR OWN ADDRESS — scene/scenarios.ts `offList`, ui/missions.ts OFFLIST_UI /
// listedMissions. The maintainer's tap, 2026-10-13 ('Three'): the four-man office room clear and both yard rows leave the list, and one of the two block rows
// when the block's rebuild says which (it said: the three squads); their rows, level files and
// every check that names them stay. Headless: the lists as data and the two screens on the fake DOM (tools/qa/scenario-picker-probes.ts El / withDom).
//   bun run tools/qa/probes.ts offlist        (family missions)        bun run tools/qa/offlist-check.ts
//   1. the table: the rows that carry `offList` are exactly the ones his tap named, and each is still a row of the table with its own address
//   2. the module's default is OFF (the page's entry puts it on — main.ts): in a harness the lists hold every row, as every list probe pins them
//   3. on: listedMissions and the start page's list hold every other row once, in the order they stood, and none of the cut ones; so do both screens' rows
//   4. on: a cut row still reads back from its own address (missionOfQuery), and a visit that names one (`?loadout=<id>`, a `select`) has it drawn that once
//   5. off (?offlist=0): the lists are the whole table again
//   OFFLIST_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';

/** his tap: these and no other (the block's row joined when its rebuild said which of the two it was for) */
const CUT = ['room-clear-four', 'block-squads', 'quiet-yard-alone', 'quiet-yard-two'];

export async function offlistCheck(): Promise<boolean> {
  const { El, withDom } = await import('./scenario-picker-probes.ts');
  const M = await import(`${ROOT}/src/ui/missions.ts`), SP = await import(`${ROOT}/src/ui/startpage.ts`);
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const brk = process.env.OFFLIST_BREAK === '1', was = M.OFFLIST_UI.on;
  type Mi = { id: string; scenario: { offList?: boolean } | null };
  let failed = false, checks = 0;
  const line = (ok: boolean, s: string, detail = '') => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const ids = (L: Mi[]) => L.map(m => m.id), same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const drawn = (tiles: boolean, select?: string) => withDom('?mute', () => {
    const host = new El('DIV'), list = tiles ? SP.startPageList(M.listedMissions(undefined, select)).list : undefined;
    const S = M.openMissions({ root: host as any, list: list as any, fold: tiles, tiles, select }), got = host.all((e: any) => e.cls.has('mrow')).map((a: any) => a.attrs['data-mission'] as string);
    S.close(); return got as string[];
  });
  try {
    const all: Mi[] = M.missionList(), cutRows = (ALL_MISSIONS as { id: string; offList?: boolean }[]).filter(e => e.offList).map(e => e.id);
    line(same([...cutRows].sort(), [...CUT].sort()) && CUT.every(id => all.some(m => m.id === id)), 'the table: the rows cut from the list are the ones his tap named, and each is still a row of the table', cutRows.join(', '));
    line(was === false && same(ids(M.listedMissions()), ids(all)), 'the module\'s default is off: in a harness the list holds every row (the page\'s entry puts the switch on)', `${all.length} rows`);

    M.OFFLIST_UI.on = !brk;
    const want = ids(all).filter(id => !CUT.includes(id));
    { const L: Mi[] = M.listedMissions(), S: Mi[] = SP.startPageList().list;
      line(same(ids(L), want) && same([...ids(S)].sort(), [...want].sort()), 'on: the list and the start page\'s list hold every other row once, the list in the order it stood, and none of the cut ones', `${L.length} of ${all.length} rows · start page ${S.length}`);
      const A = await drawn(true), B = await drawn(false);
      line(same([...A].sort(), [...want].sort()) && same(B, want), 'on: the start page\'s cards and the older list\'s rows are those rows and no other', `cards ${A.length} · list ${B.length}`); }
    { const back = CUT.map(id => { const m = all.find(x => x.id === id)!; return M.missionOfQuery('?' + String(M.missionHref(m, '')).replace(/^[^?]*\?/, ''))?.id; });
      const named = await Promise.all(CUT.map(async id => { const A = await drawn(true, id), B = await drawn(false, id); return A.includes(id) && B.includes(id) && A.length === want.length + 1 && B.length === want.length + 1; }));
      line(same(back as string[], CUT) && (brk || named.every(Boolean)), 'on: a cut row still reads back from its own address, and a visit that names one has it drawn that once, beside the listed rows and no other cut row', `read back: ${back.join(', ')} · named: ${named.join(', ')}`); }

    M.OFFLIST_UI.on = false;
    line(same(ids(M.listedMissions()), ids(all)) && same(await drawn(false), ids(all)), 'off (?offlist=0): the lists are the whole table again', `${all.length} rows`);
  } catch (e) { failed = true; console.log(`- FAIL — threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); }
  finally { M.OFFLIST_UI.on = was; }
  const ok = !failed && checks > 0;
  console.log(ok ? '=== offlist-check: ALL PASS ===' : '=== offlist-check: FAILED ===');
  return ok;
}

if (import.meta.main) process.exit(await offlistCheck() ? 0 : 1);
