// THE UNPLAYED ROWS STAND APART ON THE MISSION LIST — the check behind `UNPLAYED_UI.on` (src/ui/missions.ts: unplayed, unplayedLast, unplayedClass).
// A row is UNPLAYED when it is `untuned` and the short list does not name it (scene/picks.ts onShortList). With the switch on, a group's unplayed rows come after
// its others and are drawn quieter (`.mrow.unplayed`), the first of them under a break (`.mrow.unplayed.first`); with it off (`?unplayed=0`) the list is the one
// the build drew before.
//   bun run tools/qa/unplayed-check.ts   ·   bun run tools/qa/probes.ts unplayed (family missions)
// Nothing here looks at a picture: the lists are the page's own functions (missionList, the start page's startPageList) and the screens the real openMissions on
// the picker probes' fake DOM — the start page's cards (`tiles`) and the older list. What it holds:
//   1. on, the rule: unplayed(m) is `untuned` and not on the short list, on every row; no short-list row is unplayed
//   2. on, the order (both lists): every mission once, the groups in one run each, in no group a played row after an unplayed one, the short list's rows
//      still first in their group, and the whole order = the switch-off order after a stable partition of each group
//   3. on, the screens (cards and list): the rows stand in the list's order and the keys walk them in it; every unplayed row wears `unplayed` and no other
//      does; `first` is worn by the first unplayed row of each group that holds a played one before it, and by no other; the classes outlive the cursor
//   4. off: both orders are what the code gave before the switch existed (written out again below, not asked of the code), and no row of either screen wears either class
//   5. ?nopicks (the short list off): its untuned rows count as unplayed and go to the back with the rest
//   6. ?nogroups (a flat list): nothing is reordered — the switch moves no row — and its unplayed rows wear `unplayed` alone
//   UNPLAYED_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';

export async function unplayedCheck(): Promise<boolean> {
  const { El, withDom } = await import('./scenario-picker-probes.ts');
  const M = await import(`${ROOT}/src/ui/missions.ts`), SP = await import(`${ROOT}/src/ui/startpage.ts`);
  const { PICKS, PICKS_UI, onShortList } = await import(`${ROOT}/src/scene/picks.ts`);
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  // the two orders with the switch OFF, as the build gave them before it, WRITTEN OUT HERE AGAIN and not asked of the code under test: the solo night and the
  // table's rows in the groups' order (ui/missions.ts missionList), and on the start page the short list's rows first inside their group (ui/startpage.ts
  // startPageList). No literal: a row added to the table, or taken off it, moves nothing here.
  const { MISSION_GROUPS } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const gRank = (g: string) => { const i = (MISSION_GROUPS as { id: string }[]).findIndex(x => x.id === g); return i < 0 ? MISSION_GROUPS.length : i; };
  const pRank = (id: string) => { const k = [...new Set((PICKS as { mission: string }[]).map(p => p.mission))].indexOf(id); return k < 0 ? 1e9 : k; };
  const flat: { id: string; group: string }[] = [M.SOLO_NIGHT, ...(ALL_MISSIONS as unknown[]).map(e => M.missionOf(e))];
  const LIST_OFF = flat.map((m, i) => ({ m, i })).sort((a, b) => gRank(a.m.group) - gRank(b.m.group) || a.i - b.i).map(x => x.m.id);
  const START_OFF = LIST_OFF.map((id, i) => ({ id, i, g: gRank(flat.find(m => m.id === id)!.group) })).sort((a, b) => a.g - b.g || pRank(a.id) - pRank(b.id) || a.i - b.i).map(x => x.id);
  const brk = process.env.UNPLAYED_BREAK === '1', was = { u: M.UNPLAYED_UI.on, g: M.GROUPS_UI.on, p: PICKS_UI.on };
  type Mi = { id: string; group: string; untuned: boolean };

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string, detail = '') => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const ids = (L: Mi[]) => L.map(m => m.id), same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const groupsOf = (L: Mi[]) => [...new Set(L.map(m => m.group))];
  const inRuns = (L: Mi[]) => L.filter((m, i) => !i || L[i - 1].group !== m.group).length === groupsOf(L).length;   // (each group stands in one run)
  const rule = (m: Mi) => m.untuned && !onShortList(m.id);   // (the rule as the owner said it, asked of the tables themselves, not of the helper under test)
  /** a list after a STABLE partition of each group: its played rows, then its unplayed, both in the order they stood */
  const parted = (L: Mi[]) => groupsOf(L).flatMap(g => { const of = L.filter(m => m.group === g); return [...of.filter(m => !rule(m)), ...of.filter(rule)]; });
  const playedFirst = (L: Mi[]) => groupsOf(L).every(g => { const of = L.filter(m => m.group === g), k = of.findIndex(rule); return k < 0 || of.slice(k).every(rule); });
  /** the rows that should wear the break: the first unplayed of each group that holds a played row before it */
  const breaksOf = (L: Mi[]) => groupsOf(L).flatMap(g => { const of = L.filter(m => m.group === g), k = of.findIndex(rule); return k > 0 ? [of[k].id] : []; });
  const lay = (L: Mi[]) => groupsOf(L).map(g => `${g}: ${L.filter(m => m.group === g).map(m => (rule(m) ? '~' : '') + m.id).join(' ')}`).join('\n    ');
  /** the real screen over `list` on the fake DOM (`tiles`: the start page's cards; else the older list): what its rows wear, at the open and after the keys have walked every row */
  const drawn = (list: Mi[] | undefined, tiles: boolean, search = '?mute') => withDom(search, () => {
    const host = new El('DIV'), S = M.openMissions({ root: host as any, list: list as any, fold: tiles, tiles, select: 0 }), L: Mi[] = S.list;
    const rows = () => host.all((e: any) => e.cls.has('mrow')).map((a: any) => ({ id: a.attrs['data-mission'] as string, quiet: a.cls.has('unplayed') as boolean, first: a.cls.has('first') as boolean, sel: a.cls.has('sel') as boolean }));
    const at0 = rows(), walked: string[] = [], worn: boolean[] = [];
    S.select(0); for (let i = 0; i < L.length; i++) { const r = rows(), k = r.findIndex((x: { sel: boolean }) => x.sel); walked.push(r[k]?.id ?? '?'); worn.push(!!r[k] && r[k].quiet === at0[k].quiet && r[k].first === at0[k].first); M.missionsKey({ code: 'KeyS' }); }
    const tag = (id: string) => { S.select(id); return host.all((e: any) => e.cls.has('untuned'))[0]?.style.display !== 'none'; };
    const tags = L.map(m => tag(m.id)); S.close();
    return { L, rows: at0, walked, kept: worn.every(Boolean), tags };
  });
  const screenOk = (D: Awaited<ReturnType<typeof drawn>>, on: boolean, breaks: boolean) => {
    const want = on ? D.L.filter(rule).map(m => m.id) : [], wantFirst = on && breaks ? breaksOf(D.L) : [];
    return same(D.rows.map(r => r.id), ids(D.L)) && same(D.walked, ids(D.L)) && D.kept && same(D.rows.filter(r => r.quiet).map(r => r.id), want) && same(D.rows.filter(r => r.first).map(r => r.id), wantFirst) && D.rows.every(r => !r.first || r.quiet)
      && D.tags.every((t, i) => t === rule(D.L[i]));   // (the sheet's tag is the helper's rule too, whatever the switch says)
  };
  const wears = (D: Awaited<ReturnType<typeof drawn>>) => `${D.rows.length} rows · ${D.rows.filter(r => r.quiet).length} wear unplayed · first: ${D.rows.filter(r => r.first).map(r => r.id).join(', ') || 'none'} · walked in order ${same(D.walked, ids(D.L))}`;

  try {
    const all = 1 + (ALL_MISSIONS as unknown[]).length, top: string[] = [...new Set((PICKS as { mission: string }[]).map(p => p.mission))];
    // ---- the switch OFF: the build as it was, and what a stable partition of it would be
    M.UNPLAYED_UI.on = false; M.GROUPS_UI.on = true; PICKS_UI.on = true;
    const off: Mi[] = M.missionList(), offStart: Mi[] = SP.startPageList().list;
    line(same(ids(off), LIST_OFF) && same(ids(offStart), START_OFF), 'off (?unplayed=0): the list and the start page stand in the order the build gave before the switch', `list ${same(ids(off), LIST_OFF)} · start page ${same(ids(offStart), START_OFF)} · ${off.length} rows`);
    { const A = await drawn(offStart, true), B = await drawn(undefined, false);
      line(screenOk(A, false, false) && screenOk(B, false, false), 'off: no card of the start page and no row of the list wears `unplayed` or `first`; the rows stand and are walked in the old order; the sheet still tags an untuned row', `cards: ${wears(A)}\n    list: ${wears(B)}`); }

    // ---- the switch ON (UNPLAYED_BREAK=1 leaves it off: every line below that wants a row moved or a class worn then fails — which takes a table with an
    // unplayed row in it; no line here asks the table for one, so the day every row has been played the check still passes, with nothing left to set apart)
    M.UNPLAYED_UI.on = !brk;
    const on: Mi[] = M.missionList(), onStart: Mi[] = SP.startPageList().list;
    line(on.every(m => M.unplayed(m) === rule(m)) && top.every(id => { const m = on.find(x => x.id === id); return !!m && !M.unplayed(m); }),
      'the rule: a row is unplayed when it is untuned and the short list does not name it; no short-list row is unplayed', `${on.filter(m => m.untuned).length} untuned · ${on.filter(rule).length} unplayed · short list: ${top.join(', ')}`);
    for (const [name, L, offL] of [['the list (missionList)', on, off], ['the start page (startPageList)', onStart, offStart]] as [string, Mi[], Mi[]][]) {
      const once = L.length === all && new Set(ids(L)).size === all, moved = ids(L).filter((id, i) => id !== offL[i].id).length;
      line(once && inRuns(L) && playedFirst(L) && same(ids(L), ids(parted(offL))) && groupsOf(L).every(g => L.filter(m => m.group === g).length <= 8),
        `on, ${name}: every mission once, each group in one run, in no group a played row after an unplayed one, and the order = the switch-off order after a stable partition of each group`, `${L.length} of ${all} · ${moved} rows stand elsewhere than with the switch off\n    ${lay(L)}`);
    }
    line(groupsOf(onStart).every(g => { const of = onStart.filter(m => m.group === g), n = of.filter(m => top.includes(m.id)).length; return of.slice(0, n).every(m => top.includes(m.id)) && same(of.slice(0, n).map(m => m.id), top.filter(id => of.some(m => m.id === id))); }),
      'on, the start page: the short list\'s rows still stand first in their group, in play order', top.join(', '));
    { const A = await drawn(onStart, true), B = await drawn(undefined, false), want = breaksOf(onStart);
      line(screenOk(A, true, true), 'on, the start page\'s cards: every unplayed card wears `unplayed` and no other does; `first` is on the first unplayed card of each group that holds a played one, and on no other; the cards stand and are walked in the list\'s order, and keep their classes under the cursor', `${wears(A)} (wanted first: ${want.join(', ')})`);
      line(screenOk(B, true, true) && same(ids(B.L), ids(on)), 'on, the older list (the Missions button): the same on its rows, in missionList\'s order', wears(B)); }

    // ---- ?nopicks: the short list off — its untuned rows are unplayed like any other
    PICKS_UI.on = false;
    { const L: Mi[] = M.missionList(), S: Mi[] = SP.startPageList().list, was5 = top.filter(id => on.find(m => m.id === id)?.untuned), D = await drawn(S, true);
      line(was5.every(id => M.unplayed(L.find(m => m.id === id))) && L.filter(m => M.unplayed(m)).length === L.filter(m => m.untuned).length && playedFirst(L) && playedFirst(S) && new Set(ids(S)).size === all && screenOk(D, true, true),
        '?nopicks: the short list\'s untuned rows count as unplayed; they go to the back of their group with the rest and wear the class', `${was5.join(', ')} · ${L.filter(m => M.unplayed(m)).length} unplayed · ${wears(D)}`); }
    PICKS_UI.on = true;

    // ---- ?nogroups: a flat list is not reordered; only the quiet look applies
    M.GROUPS_UI.on = false;
    { const L: Mi[] = M.missionList(), S: Mi[] = SP.startPageList().list; M.UNPLAYED_UI.on = false; const L0: Mi[] = M.missionList(), S0: Mi[] = SP.startPageList().list; M.UNPLAYED_UI.on = !brk;
      const D = await drawn(S, false);
      line(same(ids(L), ids(L0)) && same(ids(S), ids(S0)) && screenOk(D, true, false), '?nogroups: the switch moves no row of the flat list; its unplayed rows wear `unplayed`, none wears `first`', wears(D)); }
    M.GROUPS_UI.on = true;
  } catch (e) { failed = true; console.log(`- FAIL — threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); }
  finally { M.UNPLAYED_UI.on = was.u; M.GROUPS_UI.on = was.g; PICKS_UI.on = was.p; }   // (the three switches back as this check found them)
  const ok = !failed && checks > 0;
  console.log(ok ? '=== unplayed-check: ALL PASS ===' : '=== unplayed-check: FAILED ===');
  return ok;
}

if (import.meta.main) process.exit(await unplayedCheck() ? 0 : 1);
