// THE END CARD OPENS THE RUN'S REPLAY (src/ui/replaykey.ts openViewer / canView; src/ui/menu.ts debrief(); src/main.ts wires them).
//   bun run tools/qa/probes.ts cardreplay        (family `replay`)        CARDREPLAY_BREAK=1 = the browser hands back no tab (a pop-up refused): must FAIL
// the maintainer, 10-14, of the verdict card: "would be nice to be able to open the replay immediately here". The card's Replay button does Shift+F7's work: a tab
// opened inside the click's own handler, pointed at the viewer once the shelf has the file, shut if none was shelved; no button where there is no viewer page
// (the one-file build) or no buffer (?noreplay). Headless, with the page's globals stubbed round the key's own calls: no page, no shelf, nothing drawn.
// the maintainer, 10-15: "clicking on replay after a mission should start in engine". The card's tab goes to the game page playing the file's run tape (?playtape=<shelf
// id>, from the tape's last restart), and to the map viewer only where the file has no tape to play; the key's (Shift+F7) is the map viewer's as before.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
export async function cardReplayCheck(): Promise<boolean> {
  const BRK = process.env.CARDREPLAY_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== cardreplay: the end card opens the run's replay${BRK ? ' (the window never leaves: must fail)' : ''} ===`);
  const G: any = globalThis, kept: Record<string, any> = {}; let one = false, search = '';
  const went: string[] = [], store = new Map<string, string>(), HERE = 'http://localhost/index.html?squad4';   // (where the window was sent, in order; this tab's sessionStorage; the game page's address)
  const stub: Record<string, any> = {
    window: { addEventListener() { /* the key's listeners: the check calls openViewer itself */ }, open: (url: string) => { opened.push(url); return null; } },
    location: { get search() { return search; }, href: HERE, assign: (url: string) => { if (!BRK) went.push(url); } }, history: { length: 3 }, navigation: { currentEntry: { key: 'slot-of-the-game' } },
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } }, localStorage: { getItem: () => null, setItem() { /* */ }, removeItem() { /* */ } },
    document: { baseURI: 'http://localhost/', body: { appendChild() { /* */ } }, createElement: () => ({ style: {}, textContent: '', click() { /* */ }, remove() { /* */ } }), querySelector: (q: string) => one && /tps-one-page/.test(q) ? {} : null },
  };
  const opened: string[] = [];   // (a tab asked of the browser: there is to be none)
  const W: any = await standUp();
  try {
    for (const k of Object.keys(stub)) { kept[k] = Object.getOwnPropertyDescriptor(G, k); Object.defineProperty(G, k, { value: stub[k], configurable: true, writable: true }); }
    const { ReplayKey, viewerUrl, engineUrl, VISIT_FLAGS, CAME_FROM } = await import(`${ROOT}/src/ui/replaykey.ts`); const { backToGame } = await import(`${ROOT}/src/replay/format.ts`); const { tapeSearch } = await import(`${ROOT}/src/replay/engineplay.ts`);
    store.set(CAME_FROM, '{"href":"an older trip"}');   // (a game page that boots drops the last trip's mark)
    const key = new ReplayKey(W.game, W.cam, () => { /* */ }), K = key as any, dropped = !store.has(CAME_FROM);
    const tick = () => new Promise(r => setTimeout(r, 5));
    // a file on the shelf: THIS window goes to the viewer on it, once the save has answered (the file is on the shelf before the page that made it goes), with the
    // mark its way back reads; a second press inside the wait is not a second save or a second leaving; and no tab is asked of the browser
    const again = () => { K.leaving = 0; went.length = 0; };   // (the stub's page never leaves: a real one is gone after the first)
    { let asked = '', saves = 0; K.save = async (why: string) => { asked = why; saves++; await tick(); return 7; };
      key.openViewer('key'); key.openViewer('key'); const early = went.length;
      await tick(); await tick(); key.openViewer('key'); await tick(); await tick(); const mark = JSON.parse(store.get(CAME_FROM) ?? 'null');   // (…and a third press, the window on its way)
      verdict(early === 0 && went.length === 1 && went[0] === viewerUrl(7) && asked === 'key' && saves === 1 && dropped && mark?.href === HERE && mark?.key === 'slot-of-the-game' && mark?.id === 7 && opened.length === 0, "one press sends THIS window to the viewer on the file the save shelved, after the save answers, leaving the way back's mark; no tab is opened (the key's road)",
        `moves before the save answered ${early} · after: ${went.length} → ${went[0] ?? 'nowhere'} · saved as '${asked}', ${saves} save${saves === 1 ? '' : 's'} for three presses · an older trip's mark dropped at boot: ${dropped} · the mark ${JSON.stringify(mark)} · tabs asked for ${opened.length}`); }
    // the card's press: the game page playing the run again, from the tape's last restart — a real tape, off this key's own buffer (a try, a restart, a second try)
    { const N1 = 40, N2 = 25; for (let f = 0; f < N1; f++) W.step(1 / 60); W.game.restartEncounter(); for (let f = 0; f < N2; f++) W.step(1 / 60);
      const file = JSON.parse(JSON.stringify(K.file('card'))), T = file?.rerun, live = !!T && !('dead' in T) && T.ticks === N1 + N2;
      const put = (f: unknown) => { K.save = async () => { await tick(); K.last = { id: 7, file: f }; return 7; }; };
      again(); put(file); key.openViewer('card'); await tick(); await tick(); const card = went[0];
      const noRow = { ...file, rerun: { ...T, x: (T?.x ?? []).filter((r: any) => r[1] !== 'restart') } };   // (a restart made INSIDE a step — Shift+Enter, Enter once down — is on no tape row: the trace's mark has it)
      const once = { ...noRow, lines: file.lines.filter((l: any) => l.k !== 'mark') };   // (one try: nothing to run through first)
      const old = { ...file, lines: once.lines };   // (a restart older than the trace's window: the tape's row has it)
      const inStep = engineUrl(7, noRow), nIn = Number(new URL(inStep ?? 'http://x/').searchParams.get('at'));
      const dead = { ...file, rerun: { dead: 'a checkpoint was loaded', tick: 12 } }, bare = { ...file, rerun: undefined };
      again(); put(dead); key.openViewer('card'); await tick(); await tick(); const cardDead = went[0];
      again(); put(file); key.openViewer('key'); await tick(); await tick(); const keyTab = went[0];
      const want = `http://localhost/index.html?playtape=7&at=`, nCard = Number(new URL(card ?? 'http://x/').searchParams.get('at')), after = (n: number) => n > N1 && n <= N1 + 4;   // (the new try's first steps: the step after the tape's row, or the trace's first sample from the mark on — 20 a second)
      verdict(live && file.why === 'card' && !!card?.startsWith(want) && after(nCard) && after(nIn) && engineUrl(7, old) === `${want}${N1 + 1}` && engineUrl(7, once) === 'http://localhost/index.html?playtape=7' && engineUrl(7, dead) === null && engineUrl(7, bare) === null && cardDead === viewerUrl(7) && keyTab === viewerUrl(7),
        "the card's press sends the window to the game page playing the run's tape from the first steps of its last try, read off the trace's mark and off the tape's row; a file with no tape to play, and the key's press, go to the map viewer",
        `tape ${live ? `${T.ticks} steps, restart rows at ${(T.x as any[]).filter(r => r[1] === 'restart').map(r => r[0]).join(', ')}` : `none (${T?.dead ?? 'no rerun'})`} · the card: ${card ?? 'nowhere'} · a restart on no tape row: ${inStep} · one older than the trace: ${engineUrl(7, old)} · one try: ${engineUrl(7, once)} · a dead tape: ${cardDead ?? 'nowhere'} · the key: ${keyTab ?? 'nowhere'}`);
      // the visit's own words ride along (replaykey.ts VISIT_FLAGS): a run played at a chosen quality, or muted, replays the same way; the run's words and the harness's `paused` do not
      search = '?levelFile=pass.json&quality=low&mute&paused&squad4'; const vOnce = engineUrl(7, once), vOld = engineUrl(7, old); search = '';
      verdict(vOnce === 'http://localhost/index.html?playtape=7&mute=&quality=low' && vOld === `${want}${N1 + 1}&mute=&quality=low`, "the replay's address keeps the game page's quality and mute, and nothing else of it", `one try: ${vOnce} · after a restart: ${vOld}`); }
      // …and on the page that replays it (engineplay.ts tapeSearch): the run's words are the tape's, every visit word is THIS visit's — one the tape was recorded
      // under (a picture word of that day's address) does not come back with it, whichever goal put it on VISIT_FLAGS
      { const words = (VISIT_FLAGS as string[]).filter(k => k !== 'paused'), rec = { ticks: 1, recipe: { search: `?roomclear&squad4&${words.map(k => `${k}=tape`).join('&')}`, seed: 7 } };
        const bare = new URLSearchParams(tapeSearch(rec, new URLSearchParams('?playtape=7'), '7')), mine = new URLSearchParams(tapeSearch(rec, new URLSearchParams(`?playtape=7&${words.map(k => `${k}=visit`).join('&')}`), '7'));
        const run = (q: URLSearchParams) => q.has('roomclear') && q.has('squad4') && q.get('seed') === '7' && q.get('playtape') === '7';
        verdict(words.length >= 8 && run(bare) && run(mine) && words.every(k => !bare.has(k)) && words.every(k => mine.get(k) === 'visit'), "the replay page takes the run's words from the tape and every visit word from its own address, never the tape's",
          `${words.length} visit words · with none on the address: ${bare.toString()} · tape's words that came back: ${words.filter(k => bare.has(k)).join(' ') || 'none'} · not the visit's own: ${words.filter(k => mine.get(k) !== 'visit').join(' ') || 'none'}`); }
    // Shift+F7 IN A LIVE RUN: the first press only says what the second costs (the replay plays in this window: the run is left), the second goes; with the
    // run over one press goes
    { again(); let saves = 0; const said: string[] = [], say0 = K.say; K.save = async () => { saves++; await tick(); return 7; }; K.say = (t: string) => { said.push(t); };
      const stage0 = W.game.mission.stage, live = !W.game.quietUtility && !W.game.puppet && stage0 !== 'done' && stage0 !== 'failed';
      key.keyView(); await tick(); await tick(); const first = { saves, went: went.length, said: said.join(' | ') };
      key.keyView(); await tick(); await tick(); const second = { saves, went: went.length };
      again(); saves = 0; W.game.mission.stage = 'done'; key.keyView(); await tick(); await tick(); const over = { saves, went: went.length }; W.game.mission.stage = stage0; K.say = say0;
      verdict(live && first.saves === 0 && first.went === 0 && /again leaves this run/.test(first.said) && second.saves === 1 && second.went === 1 && over.saves === 1 && over.went === 1,
        'Shift+F7 in a live run takes two presses, the first saying the run will be left; with the run over one press goes',
        `a live run: ${live} · first press: ${JSON.stringify(first)} · second: ${JSON.stringify(second)} · the run over, one press: ${JSON.stringify(over)}`); }
    // THE WAY BACK (format.ts backToGame): the game's own entry of the history when the window still holds it; two presses are one going and the second does not
    // fall to the title page (the mark is read, not taken); a traverse that fails leaves no rejection uncaught and is made good by the address
    { const nav = G.navigation, doc = G.document, perf = performance.now.bind(performance); let t = 1e6, fail = false; const asked: string[] = [], loose: unknown[] = [];
      const onLoose = (e: unknown) => { loose.push(e); }; process.on('unhandledRejection', onLoose);
      performance.now = () => t; doc.visibilityState = 'visible';
      nav.entries = () => [{ key: 'slot-of-the-game' }, { key: 'here' }];
      nav.traverseTo = (k: string) => { asked.push(k); const p = () => fail ? Promise.reject(new Error('the traverse failed')) : new Promise(() => { /* the page goes */ }); return { committed: p(), finished: p() }; };
      const mark = JSON.stringify({ href: HERE, key: 'slot-of-the-game', id: 7 });
      store.set(CAME_FROM, mark); went.length = 0; backToGame(7, 'http://localhost/index.html'); backToGame(7, 'http://localhost/index.html'); const twice = { asked: asked.length, went: went.length, kept: store.get(CAME_FROM) === mark };
      t += 9000; backToGame(7, 'http://localhost/index.html'); const later = { asked: asked.length, went: went.slice() };   // (a press after the wait, the page still here: the same road, not the title)
      t += 9000; asked.length = 0; nav.entries = () => [{ key: 'here' }]; backToGame(7, 'http://localhost/index.html'); const gone = { asked: asked.length, went: went.slice() }; went.length = 0;
      t += 9000; backToGame(8, 'http://localhost/index.html'); const other = went.slice(); went.length = 0;   // (a mark left for another shelf entry is not trusted)
      t += 9000; nav.entries = () => [{ key: 'slot-of-the-game' }]; fail = true; backToGame(7, 'http://localhost/index.html'); await tick(); await tick(); const failed = { went: went.slice(), loose: loose.length };
      performance.now = perf; process.off('unhandledRejection', onLoose); delete nav.entries; delete nav.traverseTo; store.delete(CAME_FROM); went.length = 0;
      verdict(twice.asked === 1 && twice.went === 0 && twice.kept && later.asked === 2 && later.went.length === 0 && gone.asked === 0 && gone.went.join() === HERE && other.join() === 'http://localhost/index.html' && failed.went.join() === HERE && failed.loose === 0,
        "the way back goes to the game's own history entry; two presses are one going and neither falls to the title; with the entry gone, or the traverse failed, the address left — and no rejection is left uncaught",
        `two presses: ${JSON.stringify(twice)} · a press after the wait: ${JSON.stringify(later)} · the entry gone: ${JSON.stringify(gone)} · another entry's mark: ${other.join() || 'nowhere'} · a failed traverse: ${JSON.stringify(failed)}`); }
    // nothing shelved (nothing played, a shelf that refused): the window stays on the game, and the next press is taken
    { again(); let saves = 0; K.save = async () => { saves++; await tick(); return null; };
      key.openViewer('card'); await tick(); await tick(); key.openViewer('card'); await tick(); await tick();
      verdict(went.length === 0 && saves === 2 && opened.length === 0, 'a save that shelved nothing leaves the window on the game, and the next press tries again', `moves ${went.length} · saves for two presses ${saves} · tabs asked for ${opened.length}`); }
    // where the button is offered: a viewer page and a buffer
    { const page = key.canView; one = true; const onePage = key.canView;
      again(); let saved = 0; K.save = async () => { saved++; return 7; }; key.openViewer('card'); await tick();
      one = false; search = '?noreplay'; const off = new ReplayKey(W.game, W.cam, () => { /* */ }); search = '';
      verdict(page === true && onePage === false && went.length === 0 && saved === 1 && off.canView === false, 'the button is offered only where a replay can be viewed: not on the one-file build (a plain save there, the window stays), not under ?noreplay',
        `page ${page} · one-file build ${onePage}, moves ${went.length}, saves ${saved} · ?noreplay ${off.canView}`); }
  } finally {
    for (const k of Object.keys(stub)) { if (kept[k]) Object.defineProperty(G, k, kept[k]); else delete G[k]; }
    if (W.game.replayTap) W.game.replayTap = null;
  }
  // the card and the page's wiring, read off the source (the card is DOM: the page check sees it drawn)
  { const menu = readFileSync(`${ROOT}/src/ui/menu.ts`, 'utf8'), main = readFileSync(`${ROOT}/src/main.ts`, 'utf8'), rk = readFileSync(`${ROOT}/src/ui/replaykey.ts`, 'utf8');
    const card = /const view = this\.d\.replay\?\.\(\) \?\? null; if \(view\) \{ const b = button\('Replay', \(\) => \{ if \(performance\.now\(\) - shown >= 500\) view\(\); \}, 'replay'\);[^\n]*actions\.push\(b\);/.test(menu);
    const wired = /replay: \(\) => viewReplay,/.test(main) && /viewReplay = replaykey\.canView \? \(\) => replaykey\.openViewer\('card'\) : null;/.test(main);
    const keyToo = /if \(e\.shiftKey\) this\.keyView\(\); else void this\.save\('key'\);/.test(rk);
    const viewer = readFileSync(`${ROOT}/src/replay/viewer.ts`, 'utf8');
    const toEngine = /leaveFor\(\(why === 'card' && this\.last\?\.id === id \? engineUrl\(id, this\.last\.file\) : null\) \?\? viewerUrl\(id\), id\);/.test(rk) && /a\.href = new URL\(`index\.html\?playtape=\$\{shelfId\}`, document\.baseURI\)\.href;/.test(viewer);
    // (the maintainer, 10-15: "replays should just play in the current window, not open a new tab") — no road between the game, the replay and the map asks for a tab
    const roads: [string, string][] = [['ui/replaykey.ts', rk], ['replay/viewer.ts', viewer], ['replay/engineplay.ts', readFileSync(`${ROOT}/src/replay/engineplay.ts`, 'utf8')], ['replay.html', readFileSync(`${ROOT}/replay.html`, 'utf8')]];
    const tabbed = roads.filter(([, text]) => /window\.open\(|_blank/.test(text)).map(([name]) => name);
    verdict(tabbed.length === 0, 'no way between the game, the replay and the map viewer opens a tab', `window.open or _blank in: ${tabbed.join(', ') || 'none of ' + roads.map(r => r[0]).join(', ')}`);
    // THE F7 TAG AND THE REPLAY BAR WEAR THE FIGHT SCREEN'S LOOK (docs/agents/menus.md "The fight screen wears the menus' look"; hud-look-check.ts reads the page's
    // sheet, not these two files' own rules): no colour of the old mint family, no near-black tinted green or blue, no typeface by name. The scan must also
    // find all three in the tag as it was, or its silence means nothing.
    const cold = (text: string): string[] => { const bad: string[] = [];
      for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        const h = m[1] ? (m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]) : '', [r, g, b] = h ? [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16)) : [+m[2], +m[3], +m[4]];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, hue = !d ? -1 : (60 * (hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) + 360) % 360;
        if (hi < 40 ? (g > r + 1 || b > r + 1) : (hue >= 75 && hue <= 190 && d / hi > 0.12)) bad.push(m[0]); }
      for (const m of text.matchAll(/font(?:-family)?:[^;'"`}]*?\b(ui-monospace|SFMono[\w-]*|Menlo|Consolas|Inter|Helvetica|Arial|Avenir)\b/g)) bad.push(m[1]);
      return bad; };
    const was = cold('background:rgba(5,9,11,0.94);font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#79d69a;'), now = [roads[0], roads[2]].map(([name, text]) => [name, cold(text)] as const);
    verdict(was.length === 3 && now.every(([, bad]) => bad.length === 0), 'the F7 tag and the replay bar hold no mint green, no cool black and no typeface by name',
      `the old tag read by the same scan: ${was.join(' · ')} · now ${now.map(([name, bad]) => `${name}: ${bad.join(' ') || 'none'}`).join(' · ')}`);
    // THE REPLAY'S PACES (engineplay.ts TAPE_SPEEDS): slow motion is on the list, a step either way is one pace and the ends hold; and the map viewer's own
    // list (replay.html's <select id="speed">) offers the same paces under the same names, 1× the one it opens on
    { const { TAPE_SPEEDS, speedStep, speedName } = await import(`${ROOT}/src/replay/engineplay.ts`); const S = TAPE_SPEEDS as number[];
      const down = S.map(v => speedStep(v, -1)), up = S.map(v => speedStep(v, 1)), list = /<select id="speed"[^>]*>(.*?)<\/select>/s.exec(readFileSync(`${ROOT}/replay.html`, 'utf8'))?.[1] ?? '';
      const opts = [...list.matchAll(/<option value="([^"]+)"( selected)?>([^<]*)<\/option>/g)].map(m => ({ v: Number(m[1]), first: !!m[2], name: m[3] }));
      verdict(S.map(speedName).join(' ') === '¼× ½× 1× 2× 4×' && down.join() === [S[0], ...S.slice(0, -1)].join() && up.join() === [...S.slice(1), S[S.length - 1]].join() && speedStep(3, -1) === 0.5 && speedStep(3, 1) === 2
        && opts.map(o => o.v).join() === S.join() && opts.map(o => o.name).join(' ') === S.map(speedName).join(' ') && opts.filter(o => o.first).map(o => o.v).join() === '1',
        'a replay plays at ¼× ½× 1× 2× 4× in the game and in the map viewer alike, one pace a step and the ends hold', `named ${S.map(speedName).join(' ')} · a step down ${down.join(' ')} · a step up ${up.join(' ')} · off the list (3): down ${speedStep(3, -1)} up ${speedStep(3, 1)} · the map viewer's list ${opts.map(o => o.name + (o.first ? ' (opens on)' : '')).join(' ')}`); }
    verdict(card && wired && keyToo && toEngine, "the end card has a Replay button only when the page hands it a viewer, armed like the card's other buttons; Shift+F7 goes the same road, and the card's press goes where the viewer's 'Play in engine' goes",
      `menu.ts debrief(): ${card} · main.ts wiring: ${wired} · the key: ${keyToo} · the engine page's address: ${toEngine}`); }
  console.log(`=== cardreplay: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
