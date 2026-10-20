// THE LOAD BRIEF (src/ui/loadbrief.ts, LOADBRIEF): what a mission's page shows while it loads, held headless.
//   bun run tools/qa/probes.ts loadbrief          (or this file; LOADBRIEF_BREAK=1 must FAIL — the switch is left down where the check raises it)
//   words    every row of the mission list, Training lessons and the solo night with it: the address the list gives the row reads back as THAT row's brief —
//            its id, title, place and one line, the heading it sits under, the team as the row stages it; a row deployed at another size is still that row,
//            with the team as deployed; a plain address, the old cards' address and a combination no row is on have no brief
//   screen   the brief on a fake DOM: with the switch off there is none; on, it is up at once with the mission's words and Start / Controls / Back and no
//            list of keys; the boot's status line fills the block by its 'N / M'; a press while it boots is kept and the run starts the moment it is live,
//            once; live and unpressed it holds, then Enter starts it, once; a key of the game's pressed under it is not passed on; Esc is a page load of the
//            address a quit leaves, with the list asked for; off() goes without starting
//   wiring   main.ts makes one only for a page somebody sits at (no replay, no ?kitview window, no ?paused, no benchmark scene), holds the world behind a live
//            one and drops it for a script; the switch is on in the page by its URL flag alone
//   stands   a page-only screen: the module's switch is off on whichever stand this runs on, before and after a Game is stood up, and no stand's word names it
// Nothing here is a picture: tools/qa/loadbrief-page.cjs boots the real page.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const BREAK = process.env.LOADBRIEF_BREAK === '1';

// ---- a DOM just big enough for the brief: elements that keep their class, text, attributes and children; a window that keeps its listeners
class El {
  tag: string; id = ''; className = ''; _text = ''; type = ''; children: El[] = []; parent: El | null = null; attrs: Record<string, string> = {}; style: Record<string, string> = {}; listeners: Record<string, ((e: any) => void)[]> = {};
  onclick: ((e?: any) => void) | null = null; onload: (() => void) | null = null; alt = ''; decoding = ''; src = ''; complete = false; focused = 0;
  constructor(tag: string) { this.tag = tag.toUpperCase(); }
  get classList() { const self = this; const set = () => new Set(self.className.split(/\s+/).filter(Boolean));
    return { add(c: string) { const s = set(); s.add(c); self.className = [...s].join(' '); }, remove(c: string) { const s = set(); s.delete(c); self.className = [...s].join(' '); }, contains(c: string) { return set().has(c); },
      toggle(c: string, on?: boolean) { const s = set(), want = on ?? !s.has(c); if (want) s.add(c); else s.delete(c); self.className = [...s].join(' '); return want; } }; }
  get textContent(): string { return this._text + this.children.map(c => c.textContent).join(' '); }
  set textContent(v: string) { this._text = v; this.children = []; }
  appendChild(c: El) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); } getAttribute(k: string) { return this.attrs[k] ?? null; } removeAttribute(k: string) { delete this.attrs[k]; }
  addEventListener(ev: string, f: (e: any) => void) { (this.listeners[ev] ??= []).push(f); }
  focus() { this.focused++; }
  find(pred: (e: El) => boolean): El | null { if (pred(this)) return this; for (const c of this.children) { const r = c.find(pred); if (r) return r; } return null; }
  all(pred: (e: El) => boolean, out: El[] = []): El[] { if (pred(this)) out.push(this); for (const c of this.children) c.all(pred, out); return out; }
}
const cls = (c: string) => (e: El) => e.className.split(/\s+/).includes(c);

export async function loadbriefCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, text: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); };
  // (imported with no window in the room, as every other headless tool imports them: a module that reads `window` once at its load reads the harness's answer)
  const { LOADBRIEF, loadBrief, briefOfQuery } = await import(`${ROOT}/src/ui/loadbrief.ts`);
  const { missionList, missionHref, teamWordsOf } = await import(`${ROOT}/src/ui/missions.ts`);
  const { MISSION_GROUPS } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { quitSearch } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = LOADBRIEF.on;

  // ---- words
  { const list = missionList(), bad: string[] = [];
    for (const m of list) {
      const W = briefOfQuery(missionHref(m, '')); const head = MISSION_GROUPS.find((g: any) => g.id === m.group)?.title;
      if (!W || W.mission.id !== m.id || W.mission.title !== m.title || W.mission.place !== m.place || W.mission.blurb !== m.blurb || !m.blurb || !m.place || !head || W.group !== head || W.team !== teamWordsOf(m)) bad.push(`${m.id} → ${W ? W.mission.id : 'none'}`);
    }
    const kinds = new Set(list.map((m: any) => m.scenario?.kind ?? 'solo')), lessons = list.filter((m: any) => m.group === 'training').length;
    line(!bad.length && list.length >= 30 && kinds.size === 5 && lessons >= 5, `words: each of the list's ${list.length} rows (${[...kinds].join(', ')}; ${lessons} Training lessons) reads back from its own address as its own brief — title, place, its line, its heading, its team${bad.length ? ` — NOT: ${bad.slice(0, 5).join(' · ')}` : ''}`);
    const at = (q: string) => briefOfQuery(q);
    const two = at('?levelFile=depot.json&roomclear&squad=2'), keep = at('?levelFile=depot.json&roomclear&squad4&mute&quality=low&seed=7'), yardA = at('?levelFile=quiet-yard.json&quiet'), yardB = at('?levelFile=quiet-yard.json&quiet&squad=1');
    line(two?.mission.id === 'depot-four' && two.team === teamWordsOf({ squad: 2 }) && keep?.mission.id === 'depot-four' && keep.team === teamWordsOf({ squad: 4 }) && yardA?.mission.id === 'quiet-yard-alone' && yardB?.mission.id === 'quiet-yard-two',
      `words: a row deployed at another size is still that row, with the team as deployed (${two?.mission.id}, ${two?.team}); a visitor's own flags change nothing; one level's two rows are told apart by the team (${yardA?.mission.id} · ${yardB?.mission.id})`);
    line(at('') === null && at('?cards') === null && at('?quality=low&mute') === null && at('?levelFile=no-such-level.json&roomclear') === null && at('?solo')?.mission.id === 'solo-night' && at('?solo&levelFile=depot.json&roomclear')?.mission.id !== 'solo-night',
      'words: a plain address, the old cards\' and a level no row is on have no brief; ?solo alone is the solo night');
    line(at('?level=local&roomclear&squad4') === null && at('?level=relief&nightbreach') === null && at('?level=local&solo') === null && at('?nightbreach')?.mission.id === 'night-breach',
      'words: a level the address picks by ?level= (the editor\'s own, the office as it was) has no brief — the list\'s words are not said over another level, and a level being built plays the moment it loads');
  }

  // ---- screen
  const G = globalThis as any, saved: Record<string, PropertyDescriptor | undefined> = {};
  for (const k of ['document', 'window', 'location', 'sessionStorage']) saved[k] = Object.getOwnPropertyDescriptor(G, k);
  const put = (k: string, v: unknown) => Object.defineProperty(G, k, { value: v, configurable: true, writable: true });
  const winL: { ev: string; f: (e: any) => void }[] = [];
  const head = new El('head'), body = new El('body'), app = new El('div'); app.id = 'app'; body.appendChild(app);
  const doc = { head, body, activeElement: body as El | null, createElement: (t: string) => new El(t), getElementById: (id: string) => head.find(e => e.id === id) ?? body.find(e => e.id === id), querySelector: () => null };
  const loads: string[] = [], store: Record<string, string> = {};
  const key = (code: string, target: El | null = null, ctrlKey = false) => { const e = { code, target, repeat: false, metaKey: false, ctrlKey, altKey: false, stopped: false, prevented: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
    for (const l of [...winL]) { if (l.ev !== 'keydown') continue; if (e.stopped) break; l.f(e); } return e; };
  try {
    put('document', doc); put('window', { addEventListener: (ev: string, f: (e: any) => void) => { winL.push({ ev, f }); }, removeEventListener: (ev: string, f: (e: any) => void) => { const i = winL.findIndex(l => l.ev === ev && l.f === f); if (i >= 0) winL.splice(i, 1); } });
    put('location', { search: '?levelFile=depot.json&roomclear&squad4&quality=low', pathname: '/', hash: '', assign: (u: string) => { loads.push(u); } });
    put('sessionStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
    const Q = '?levelFile=depot.json&roomclear&squad4&quality=low';
    LOADBRIEF.on = false; const none = loadBrief(Q);
    line(none === null && !doc.getElementById('brief'), 'screen: with the switch off there is no brief (the caller\'s boot card, as before)');
    LOADBRIEF.on = !BREAK;
    // (1) pressed while it boots
    let started = 0; const B1 = loadBrief(Q), root1 = doc.getElementById('brief');
    const text = root1?.textContent ?? '', go1 = root1?.find(cls('bgo')) ?? null, fill = go1?.find(e => e.tag === 'I') ?? null;
    line(!!B1 && !!root1 && root1.parent === app && cls('on')(root1) && root1.getAttribute('data-mission') === 'depot-four' && /The depot/.test(text) && text.includes(B1.words.mission.place) && text.includes(B1.words.mission.blurb) && /Start/.test(text) && /Controls/.test(text) && /Back/.test(text)
      && !root1.find(cls('controls')) && !/W A S D|Shift sprint/.test(text) && !!doc.getElementById('brief-style') && winL.filter(l => l.ev === 'keydown').length === 1,
      'screen: on, the brief is up at once in a layer of its own — the mission\'s title, place and line, Start, Controls, Back — and no list of keys');
    B1?.status('compiling shaders 40 / 97 …'); const w40 = fill?.style.width, s40 = root1?.find(cls('bstatus'))?.textContent; B1?.status('97 shaders ready — setting up'); const w100 = fill?.style.width;
    line(w40 === '41%' && s40 === 'compiling shaders 40 / 97 …' && w100 === '100%' && B1?.up === true && B1?.held === false, `screen: the boot's status line is shown and fills the block (${w40}, then ${w100}); booting, nothing is held`);
    go1?.onclick?.(); const armed = !!root1 && cls('armed')(root1) && B1?.up === true && !B1?.held;
    B1?.live(() => { started++; });
    line(armed && started === 1 && B1?.up === false && B1?.held === false && !!root1 && cls('out')(root1) && winL.length === 0, 'screen: a press while it boots is kept, and the run starts the moment it is live — once, with no second press');
    go1?.onclick?.(); B1?.live(() => { started++; }); B1?.off();
    line(started === 1, 'screen: a started brief starts nothing again');
    // (2) live, then Enter; a game key under it goes nowhere
    root1?.remove(); let started2 = 0; const B2 = loadBrief(Q), root2 = doc.getElementById('brief');
    B2?.live(() => { started2++; }); const heldLive = B2?.held === true && started2 === 0 && !!root2 && cls('live')(root2);
    const w = key('KeyW'), tab = key('Tab'), f9 = key('F9'), sp = key('Space', root2?.find(e => cls('bq')(e) && e.textContent === 'Controls') ?? null);
    const quietKeys = w.stopped && w.prevented && tab.stopped && !tab.prevented && !f9.stopped && sp.stopped && !sp.prevented && started2 === 0 && B2?.held === true;
    const en = key('Enter');
    line(heldLive && quietKeys && en.stopped && en.prevented && started2 === 1 && B2?.up === false, 'screen: live and unpressed it holds; a key of the game\'s under it is passed to nobody, Tab and the F-keys are left alone; Enter starts it, once');
    // (3) Esc is Back; off() starts nothing
    root2?.remove(); let started3 = 0; const B3 = loadBrief(Q); B3?.live(() => { started3++; });
    key('Escape'); const want = '/' + quitSearch(Q);
    line(loads.length === 1 && loads[0] === want && Object.values(store).includes('1') && started3 === 0, `screen: Esc is Back — a page load of the address a quit leaves (${loads[0]}), with the list asked for`);
    B3?.off(); const root3 = doc.getElementById('brief');
    line(started3 === 0 && B3?.up === false && !root3 && winL.length === 0, 'screen: off() takes it away without starting, and its keys with it');
    // (4) a kept press is the player's to take back; Controls puts the focus on START first; a start that throws is not the boot's; a chorded Esc goes nowhere
    let started4 = 0; const B4 = loadBrief(Q), root4 = doc.getElementById('brief'), go4 = root4?.find(cls('bgo')) ?? null, keys4 = root4?.find(e => cls('bq')(e) && e.textContent === 'Controls') ?? null;
    go4?.onclick?.(); const on1 = !!root4 && cls('armed')(root4); go4?.onclick?.(); const off1 = !!root4 && !cls('armed')(root4);
    B4?.live(() => { started4++; }); const waits = B4?.held === true && started4 === 0;
    const chord = key('Escape', null, true), loadsWas = loads.length;
    const f0 = go4?.focused ?? 0; try { keys4?.onclick?.(); } catch { /* (the options layer on a DOM this small) */ }
    line(on1 && off1 && waits && chord.stopped && loads.length === loadsWas && started4 === 0 && (go4?.focused ?? 0) > f0, 'screen: a second press while it boots takes the first back (live, it waits); Esc with a chord held reaches nobody; Controls leaves the focus on START, so Enter after reading is Start');
    B4?.off(); root4?.remove();
    const B5 = loadBrief(Q), root5 = doc.getElementById('brief'); root5?.find(cls('bgo'))?.onclick?.();
    const err = console.error; let threw = false, said = 0; console.error = () => { said++; };
    try { B5?.live(() => { throw new Error('no sound'); }); } catch { threw = true; } finally { console.error = err; }
    line(!threw && said === 1 && B5?.up === false && winL.length === 0, 'screen: a start that throws is logged and the brief is still gone — the kept press starts inside the page\'s boot, and must not be its end'); root5?.remove();
    // (6) the map: the mission list's own sheet of the level, the way in its address asks for marked — and no picture
    const B6 = loadBrief(Q + '&way=2'), root6 = doc.getElementById('brief'); await new Promise(r => setTimeout(r, 5));
    const cv6 = root6?.find(e => e.tag === 'CANVAS') ?? null, img6 = root6?.find(e => e.tag === 'IMG') ?? null, mark6 = cv6?.getAttribute('data-mark') ?? '';
    B6?.off(); const left6 = winL.length;
    const B7 = loadBrief('?solo'), root7 = doc.getElementById('brief'); await new Promise(r => setTimeout(r, 5)); const cv7 = root7?.find(e => e.tag === 'CANVAS') ?? null; B7?.off();
    const B8 = loadBrief(Q), root8 = doc.getElementById('brief'); await new Promise(r => setTimeout(r, 5)); const cv8 = root8?.find(e => e.tag === 'CANVAS') ?? null, w8 = (cv8 as any)?.width, h8 = (cv8 as any)?.height; B8?.off();
    line(!!cv6 && !img6 && cv6.getAttribute('data-level') === lookLevelFile('depot.json') && mark6 === 'roomclear|2' && cv8?.getAttribute('data-mark') === 'roomclear|0' && w8 === 760 && h8 === 532 && (cv8 as any)?.width === 0 && left6 === 0 && cv7?.getAttribute('data-level') === 'office.json' && cv7.getAttribute('data-mark') === 'solo|0',
      `screen: beside the words is the map of the mission's own level as the page loads it, asked of the mission list's sheet with the way in the address names (${cv6?.getAttribute('data-level')} ${mark6} · ${cv8?.getAttribute('data-mark')} ${w8} x ${h8} · ${cv7?.getAttribute('data-level')} ${cv7?.getAttribute('data-mark')}), in the sheet's own shape, its pixels let go when the brief goes — and no picture`);
  } catch (e: any) { line(false, `screen: threw — ${e?.stack ?? e}`); }
  finally { LOADBRIEF.on = was; for (const k of Object.keys(saved)) { if (saved[k]) Object.defineProperty(G, k, saved[k]!); else delete G[k]; } }

  // ---- wiring (the page's own entry, read as text: the harness never runs it)
  { const main = readFileSync(`${ROOT}/src/main.ts`, 'utf8');
    const flag = /LOADBRIEF\.on = q\.get\('loadbrief'\) !== '0';/.test(main);
    const made = /const brief = [^\n;]*q\.has\('paused'\)[^\n;]*\? null : loadBrief\(location\.search\);/.test(main) && /const card = brief \?\? bootCard\(\)/.test(main);
    const go = /brief\.live\(/.test(main) && /const briefGo = [^\n;]*!automated/.test(main);
    const hold = /frozen: \(\) => \([^\n]*briefHolds\(\)/.test(main) && /const briefHolds = [^\n]*automated \|\| scripted[^\n]*brief\.off\(\)/.test(main);
    line(flag && made && go && hold, `wiring: main.ts still has the brief's places after whatever was merged round them — the switch by its URL flag, a brief only for a page somebody sits at, the world held behind a live one, dropped for a script (${[flag, made, go, hold].map(x => x ? 'y' : 'N').join('')})`);
  }

  // ---- stands
  { const before = LOADBRIEF.on; const log = console.log, warn = console.warn; console.log = console.warn = () => { };
    try { await standUp({ seed: 1 }); } finally { console.log = log; console.warn = warn; }
    const named = Object.keys(FROZEN_HOLDS).some(k => /loadbrief/i.test(k)) || Object.values(FROZEN_HOLDS).some(v => /LOADBRIEF/.test(String(v)));
    line(before === false && LOADBRIEF.on === false && !named && loadBrief('?nightbreach') === null, `stands: a page-only screen — the module's switch is off on this stand (${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'}) before and after a Game is stood up, no stand's word names it, and no brief is made where there is no page`);
  }
  console.log(`=== loadbrief: ${fails ? `${fails} FAILED` : 'ALL PASS'} ===`);
  return fails === 0;
}
if (import.meta.main) process.exit((await loadbriefCheck()) ? 0 : 1);
