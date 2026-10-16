// The 'picker' family (the start card's SCENARIO PICKER — scene/scenarioList.ts SCENARIOS, ui/missions.ts — the rows moved off the card onto the mission list, game/scenarioRun.ts), run through probes.ts:
//   bun run tools/qa/probes.ts picker | picker-list | picker-card | picker-start | picker-level | picker-rescue
// PASS / FAIL each, all headless. Nothing here looks at a picture: the card is the real Menu class rendered on a fake DOM (what it would put on the page, not how
// it looks), and main.ts's own glue — location / history, the camera cut on quit — is not run at all (it is the page's).
//
// A PICK IS A PAGE LOAD, so a 'boot' below is a CHILD PROCESS (this file with --boot '<query>'): fresh modules, the level the query names loaded off levels/ as
// the page's ?levelFile= loads it, the harness Game stood up on it, then game/scenarioRun.ts startFromQuery — the function main.ts calls — and a report of who
// stands where; a restart after a teammate is shot and Sam has walked off; a quit. One Game per process, as on the page.
//   picker-list    the list as data: unique ids and titles, a line and a team size on every row, the pair and the four both offered, every kind there; each row's
//                  query reads back to that row; a pick keeps the visitor's other flags and replaces an older scenario's; a quit drops them
//   picker-card    the real Menu on a fake DOM: the start card (and the boot card) open the mission list (ui/missions.ts — its own family, 'missions'), which
//                  holds one row per entry, a link to its own URL, and the difficulty switch; under a staged scenario the pause card names it with its team and offers 'Restart scenario' and
//                  'Quit to scenarios' — pressed, the first stages the same team again and the second leaves the picker up over the plain night; the down card
//                  offers the quit too; with no scenario up none of it shows
//   picker-start   every entry booted twice — by the href of its row on the card (a visitor's ?quality= and ?mute riding along) and by the bare flag a person
//                  types (?nightbreach ?roomclear ?squad4 ?rescue): it starts unrefused, is the entry's kind, stands exactly `squad` teammates beside Sam (the
//                  HUD's squad block lists as many), a restart after a man is down and Sam has moved puts the SAME team back on the SAME marks alive, and a quit
//                  leaves no cast, the shift and the civilians as a plain boot has them, the knob at the pair
//   picker-level   an entry with a level of its own (levels/test-rooms.json, not on the list): its query boots that level and stands the team on THAT level's
//                  marks, pair and four, restart and all; and what the module-level team-start knobs do when two Games of two levels share one process (the
//                  foundation's claim — printed, and why a pick being a page load never meets it)
//   picker-rescue  the hostage rescue's staging as shipped: what checkRescue says of the office's marks (the foundation's claim: four of them stand in
//                  furniture), where those men really are once staged and two seconds on, whether that is the same at every restart; and ?rescue&squad4 = the
//                  pair (four in the rescue is not built — why it is not on the list)
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const { ALL_MISSIONS: ALL } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { SCENARIOS, SCENARIO_KEYS, specOfQuery, entryOfQuery, pickSearch, quitSearch, teamWords } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, quitScenario, activeScenario, runningScenario, teamOf, fogOfQuery, plainFog, refusalWords } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { RESCUE, checkRescue } = await import(`${ROOT}/src/game/rescue.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${f2(p[0])}, ${f2(p[2])})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const NB_DEFAULTS = { ...NIGHTBREACH, samAt: [...NIGHTBREACH.samAt] }, RC_DEFAULTS = { ...ROOMCLEAR }, RS_DEFAULTS = { ...RESCUE, samAt: [...RESCUE.samAt], opsAt: RESCUE.opsAt.map((p: number[]) => [...p]) };
const resetKnobs = () => { Object.assign(NIGHTBREACH, NB_DEFAULTS, { samAt: [...NB_DEFAULTS.samAt] }); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(RESCUE, RS_DEFAULTS, { samAt: [...RS_DEFAULTS.samAt], opsAt: RS_DEFAULTS.opsAt.map((p: number[]) => [...p]) }); };
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

/** a fresh Level of a file under levels/, as the page's ?levelFile= loads it (the office family gets the office's script and scenario data) */
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }

// ───────────────────────────────────────────────────────────── a boot, in a process of its own ─────────────────────────────────────────────────────────────
interface Man { name: string; pos: number[]; alive: boolean; pair: string | null }
interface Shot { why: string | null; active: string | null; title: string | null; team: string | null; entry: string | null; staged: number; ops: Man[]; operatives: number; hostiles: number; hostages: number;
  sam: number[]; samDown: boolean; hudMen: number; fog: boolean; squadKnob: number; staff: number; units: number; civilians: number; level: string }
interface BootReport { query: string; spec: any; start: Shot; restart: Shot; quit: Shot; quitWas: string | null; errors: string[]; threw: string | null;
  /** the floor as it stood just before the restart: teammates dead, how far Sam was off his start */
  spoiled: { dead: number; samOff: number } }

function shotOf(W: any, why: string | null, levelFile: string | null): Shot {
  const g = W.game, run = runningScenario(g, levelFile), ops: any[] = teamOf(g);
  const men: Man[] = ops.map((gd: any) => ({ name: gd.callsign, pos: [...gd.char.pos], alive: gd.state !== 'dead', pair: gd.unit?.pair ?? null }));
  const sam = [...g.player.char.pos];
  for (let i = 0; i < 2; i++) { g.player.visibility = 0.05; W.step(DT); }   // (the HUD's block reads this frame's cursor and camera: two frames first; the men stand as staged)
  const names = new Set(men.map(m => m.name)); let hudMen = 0;
  for (const row of g.orders.hud().status) for (const o of row.opts) { const t = String(o.text).replace(/^[▸·] /, ''); if ([...names].some(n => t.startsWith(`${n} · `))) hudMen++; }
  return { why, active: activeScenario(g), title: run?.title ?? null, team: run?.team ?? null, entry: run?.entry?.id ?? null, staged: g.rescue.active ? g.rescue.staged : g.nightBreach.staged, ops: men,
    operatives: g.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead').length, hostiles: g.guards.filter((x: any) => x.unit && x.team === 'hostile').length,
    hostages: g.rescue.active ? g.rescue.hostages.length : 0, sam, samDown: !!g.player.down, hudMen, fog: !!g.fogOfWar.on, squadKnob: NIGHTBREACH.squad,
    staff: g.guards.filter((x: any) => !x.unit).length, units: g.guards.filter((x: any) => !!x.unit).length, civilians: g.civilians?.length ?? 0, level: `${g.level.boxes.length} boxes` };
}
/** THE CHILD: one page load of `query`, as main.ts takes it — the level, the Game, startFromQuery — then a restart and a quit */
async function boot(query: string): Promise<BootReport> {
  const errors: string[] = []; let threw: string | null = null;
  const q = new URLSearchParams(query), lf = q.get('levelFile'), levelFile = lf && /^[\w.-]+\.json$/.test(lf) ? lf : null;
  const R: Partial<BootReport> = { query, spec: specOfQuery(q) };
  const err = console.error; console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ').split('\n')[0]); };
  try {
    Math.random = seeded(0x51c4);
    const W = await standUp({ uploadEvery: 4, ...(levelFile ? { level: levelOfFile(levelFile) } : {}) });
    const g = W.game; g.godMode = true;   // (nothing is fired at Sam in the frames below; god mode keeps a stray round from ending the run under the check)
    const { why } = startFromQuery(g, q);
    R.start = shotOf(W, why, levelFile);
    // a restart from a spoiled floor: a second of play, the last teammate shot, Sam walked off his mark — then what Shift+Enter and the pause card's Restart do
    for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; W.step(DT); }
    const team: any[] = teamOf(g); if (team.length) killGuard(g, team[team.length - 1], [1, 0, 0], false, 'shot', 'player');
    { const p = g.player.char.pos, to: [number, number, number] = [p[0] + 0.8, 0, p[2]]; if (!g.col.nav.isBlocked(to[0], to[2])) g.teleportPlayer(to); }
    for (let i = 0; i < 30; i++) { g.player.visibility = 0.05; W.step(DT); }
    R.spoiled = { dead: teamOf(g).filter((x: any) => x.state === 'dead').length, samOff: R.start ? dist(g.player.char.pos, R.start.sam) : 0 };
    g.restartEncounter();
    R.restart = shotOf(W, null, levelFile);
    R.quitWas = quitScenario(g, false);
    for (let i = 0; i < 30; i++) { g.player.visibility = 0.05; W.step(DT); }
    R.quit = shotOf(W, null, levelFile);
  } catch (e: any) { threw = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { console.error = err; }
  return { ...(R as BootReport), errors, threw };
}
const TAG = 'PICKER-BOOT ';
if (import.meta.main && process.argv.includes('--boot')) {
  const query = process.argv[process.argv.indexOf('--boot') + 1] ?? '';
  const log = console.log; console.log = console.warn = () => {};
  const r = await boot(query);
  log(TAG + JSON.stringify(r));
  process.exit(0);
}
/** the parent's side: run the child, read its one line */
async function bootChild(query: string): Promise<BootReport> {
  const p = Bun.spawn(['bun', 'run', import.meta.path, '--boot', query], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(p.stdout).text(), errText = await new Response(p.stderr).text(); await p.exited;
  const line = out.split('\n').find(l => l.startsWith(TAG));
  if (!line) return { query, spec: null, errors: [], threw: `the boot printed no report (exit ${p.exitCode}): ${(errText || out).trim().split('\n').slice(-3).join(' | ')}` } as unknown as BootReport;
  return JSON.parse(line.slice(TAG.length));
}

// ───────────────────────────────────────────────────────────── a fake DOM for the real Menu ─────────────────────────────────────────────────────────────
export class El {
  nodeType = 1; children: any[] = []; parentElement: El | null = null; style: Record<string, string> = {}; title = ''; onclick: null | (() => void) = null; disabled = false; _text = ''; _html = ''; attrs: Record<string, string> = {};
  type = ''; checked = false; value = ''; min = ''; max = ''; step = ''; onchange: unknown = null; oninput: unknown = null; width = 0; height = 0; onmousemove: unknown = null;
  cls = new Set<string>();
  classList = { add: (...c: string[]) => c.forEach(x => this.cls.add(x)), remove: (...c: string[]) => c.forEach(x => this.cls.delete(x)), contains: (c: string) => this.cls.has(c), toggle: (c: string, f?: boolean) => { const on = f ?? !this.cls.has(c); if (on) this.cls.add(c); else this.cls.delete(c); return on; } };
  constructor(public tagName: string) {}
  get className() { return [...this.cls].join(' '); } set className(v: string) { this.cls = new Set(v.split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; } set innerHTML(v: string) { this._html = v; this.children = []; this._text = ''; }
  appendChild(c: any) { this.children.push(c); c.parentElement = this; return c; }
  append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? Object.assign(new El('#text'), { nodeType: 3, _text: c }) : c); }
  get textContent(): string { return this.nodeType === 3 ? this._text : this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v: string) { this.children = []; this._text = v; }
  get isConnected() { return true; }
  getContext() { return null; } getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 280 }; }
  focus() {} addEventListener() {} setAttribute(k: string, v: string) { this.attrs[k] = v; } getAttribute(k: string) { return this.attrs[k] ?? null; }
  all(sel: (e: El) => boolean, out: El[] = []): El[] { for (const c of this.children) { if (c.nodeType === 1) { if (sel(c)) out.push(c); c.all(sel, out); } } return out; }
}
/** run `fn` with a document whose #menu is a fresh fake element and a location whose search is `search` */
export async function withDom<T>(search: string, fn: (root: El) => Promise<T> | T): Promise<T> {
  const G = globalThis as any, had = { doc: 'document' in G, loc: 'location' in G, win: 'window' in G }, prev = { doc: G.document, loc: G.location, win: G.window };
  const root = new El('DIV');
  G.document = { createElement: (t: string) => new El(t.toUpperCase()), createTextNode: (s: string) => Object.assign(new El('#text'), { nodeType: 3, _text: s }), getElementById: (id: string) => (id === 'menu' ? root : new El('DIV')) };
  G.location = { search }; if (!had.win) G.window = {};   // (the pause card's settings page asks window for the read-out hook: none here)
  try { return await fn(root); }
  finally { if (had.doc) G.document = prev.doc; else delete G.document; if (had.loc) G.location = prev.loc; else delete G.location; if (!had.win) delete G.window; }
}
export interface Row { id: string; href: string; title: string; team: string; tags: string[]; blurb: string }
export const rowsOf = (root: El): Row[] => root.all(e => e.cls.has('scn')).map(a => ({ id: a.attrs['data-scenario'] ?? '', href: a.attrs.href ?? '', title: a.all(e => e.cls.has('st'))[0]?.textContent ?? '', team: a.all(e => e.cls.has('team'))[0]?.textContent ?? '',
  tags: a.all(e => e.cls.has('tag') && !e.cls.has('team')).map(t => t.textContent), blurb: a.all(e => e.cls.has('sb'))[0]?.textContent ?? '' }));
// the mission list's rows (ui/missions.ts — the scenario rows moved there off the start card), the solo night left out: the same Row shape, the level's name off nowhere (it is on the sheet)
export const missionRows = (r: El, soloId: string): Row[] => r.all(e => e.cls.has('mrow') && e.attrs['data-mission'] !== soloId).map(a => ({ id: a.attrs['data-mission'] ?? '', href: a.attrs.href ?? '', title: a.all(e => e.cls.has('mtitle'))[0]?.textContent ?? '', team: a.all(e => e.cls.has('team'))[0]?.textContent ?? '', tags: [], blurb: '' }));
const buttons = (root: El) => root.all(e => e.tagName === 'BUTTON');
const buttonOf = (root: El, text: string) => buttons(root).find(b => b.textContent === text);

// ───────────────────────────────────────────────────────────── list ─────────────────────────────────────────────────────────────
export async function pickerList(): Promise<boolean> {
  const F = family('picker-list: the scenario list as data, and a row to its URL and back');
  const L: any[] = SCENARIOS;
  const ids = new Set(L.map(e => e.id)), titles = new Set(L.map(e => e.title));
  F.verdict(L.length >= 3 && L.length <= 24 && ids.size === L.length && titles.size === L.length, 'a few scenarios, each with its own id and title', L.map(e => `${e.id} '${e.title}'`).join(' · '));
  F.verdict(L.every(e => typeof e.blurb === 'string' && e.blurb.length >= 20 && e.blurb.length <= 140 && (e.squad === 2 || e.squad === 4)), 'every row has its line (20 to 140 characters) and a team size', L.map(e => `${e.id}: ${teamWords(e)}, ${e.blurb.length} chars`).join(' · '));
  F.verdict(L.some(e => e.squad === 2) && L.some(e => e.squad === 4) && ['nightbreach', 'roomclear', 'rescue'].every(k => L.some(e => e.kind === k)), 'the pair and the four are both offered; the night breach, the room clear and the rescue are all there', `pair: ${L.filter(e => e.squad === 2).map(e => e.id).join(', ')} · four: ${L.filter(e => e.squad === 4).map(e => e.id).join(', ')}`);
  { const bad = L.filter(e => entryOfQuery(scenarioQuery(e)) !== e || entryOfQuery(pickSearch(e, '?quality=high&mute&hud')) !== e);
    F.verdict(bad.length === 0, "every row's query reads back to that row (scenarioQuery → entryOfQuery), a visitor's flags beside it or not", L.map(e => `${e.id} → ${scenarioQuery(e)}`).join(' · ') + (bad.length ? ` — NOT: ${bad.map(e => e.id).join(', ')}` : '')); }
  { const four = L.find(e => e.squad === 4)!, pair = L.find(e => e.kind === 'rescue')!;
    const a = pickSearch(pair, '?roomclear=7&squad4&quality=high&mute&levelFile=x.json'), b = pickSearch(four, '?rescue&mute'), c = quitSearch('?roomclear=7&squad4&quality=high&mute&levelFile=x.json'), d = quitSearch('?rescue');
    F.verdict(a === '?rescue&quality=high&mute' && b === `${scenarioQuery(four)}&mute` && c === '?quality=high&mute' && d === '',
      "a pick replaces an older scenario's flags and keeps the rest; a quit drops every scenario flag", `pick the rescue over a four's URL → ${a} · pick the four over the rescue's → ${b} · quit → '${c}' and '${d}' · scenario keys: ${SCENARIO_KEYS.join(' ')}`); }
  { const cases: [string, string | null, number][] = [['?nightbreach', 'nightbreach', 2], ['?roomclear', 'roomclear', 2], ['?roomclear=7', 'roomclear', 2], ['?squad4', 'roomclear', 4], ['?squad4=3', 'roomclear', 4], ['?roomclear&squad4', 'roomclear', 4],
      ['?nightbreach&squad4', 'nightbreach', 4], ['?rescue', 'rescue', 2], ['?rescue&squad4', 'rescue', 2], ['?quality=high', null, 0], ['', null, 0]];
    const bad = cases.filter(([s, k, n]) => { const sp = specOfQuery(s); return k === null ? sp !== null : !sp || sp.kind !== k || sp.squad !== n; });
    const seeds = specOfQuery('?roomclear=7')?.seed === 7 && specOfQuery('?squad4=3')?.seed === 3 && specOfQuery('?roomclear')?.seed === undefined;
    F.verdict(bad.length === 0 && seeds, 'the typed flags read as the page has always started them (?squad4 alone = the room clear with four; beside ?rescue it is ignored; seeds carried)', cases.map(([s, k, n]) => `${s || "''"} → ${k ? `${k}/${n}` : 'none'}`).join(' · ') + (bad.length ? ` — NOT: ${bad.map(c => c[0]).join(', ')}` : '')); }
  { const Q = (t: string) => new URLSearchParams(t);
    const cases: [string, boolean][] = [['?nightbreach', false], ['?nightbreach&squad4', false], ['?roomclear', true], ['?roomclear=7', true], ['?squad4', true], ['?rescue', true], ['?rescue&squad4', true], ['', false], ['?quality=high', false],
      ['?nightbreach&fow', true], ['?nightbreach&fogofwar', true], ['?fow', true], ['?roomclear&nofow', false], ['?squad4&nofogofwar', false], ['?rescue&nofow', false], ['?roomclear&fow&nofow', false]];
    const bad = cases.filter(([t, on]) => fogOfQuery(Q(t)) !== on);
    const plain = plainFog(Q('?roomclear')) === false && plainFog(Q('?rescue&fow')) === true && plainFog(Q('?fow&nofow')) === false && plainFog(Q('')) === false;
    F.verdict(bad.length === 0 && plain, 'fog of war by the URL as it always was: on under the room clear and the rescue, off under the night breach, ?fow / ?fogofwar force it on and ?nofow / ?nofogofwar off; with no scenario up only ?fow turns it on',
      cases.map(([t, on]) => `${t || "''"} → ${on ? 'on' : 'off'}`).join(' · ') + (bad.length ? ` — NOT: ${bad.map(c => c[0]).join(', ')}` : '')); }
  { const e = L[0], a = pickSearch(e, '?demo&mute'), b = pickSearch(e, '?breach&quality=low'), c = pickSearch(e, '?level=relief&mute');
    F.verdict(a === `${scenarioQuery(e)}&mute` && b === `${scenarioQuery(e)}&quality=low` && c === `${scenarioQuery(e)}&level=relief&mute`, "a row clicked on a showcase page's card does not carry ?demo / ?breach into the scenario (?level= does ride along)", `${a} · ${b} · ${c}`); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── card ─────────────────────────────────────────────────────────────
export async function pickerCard(): Promise<boolean> {
  const F = family('picker-card: the real Menu on a fake DOM — the mission list off the start card, the scenario on the pause card, restart and quit');
  const SEARCH = '?quality=high&mute';
  try {
    await withDom(SEARCH, async (root) => {
      const { Menu, bootCard } = await import(`${ROOT}/src/ui/menu.ts`);
      Math.random = seeded(0x51c4); resetKnobs();
      const W = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game; g.godMode = true;
      let quits = 0;
      const deps: any = { engine: W.engine, game: g, quality: { auto: false, current: 'high', adaptive: true, lastChange: '' }, audio: { volume: { master: 1, sfx: 1, ambience: 1, music: 1 }, setVolumes() {} }, overlay: { showLightDots: true },
        startTour() {}, onStart() {} };
      const menu = new Menu(deps);
      menu.setScenario({ current: () => runningScenario(g, null), quit: () => { quits++; quitScenario(g, false); menu.open('start'); } });   // (main.ts's quit minus its page glue: the URL, the camera cut)
      // ---- the start card
      menu.open('start');
      // (the rows left the start card for the mission list — ui/missions.ts, its own layer off the card's Missions button; the 'missions' family holds the list
      //  itself: every row, the sheet, the keys, a pick. Here: the card's side of it, and the scenario rows' links and difficulty switch where they now live)
      const MS = await import(`${ROOT}/src/ui/missions.ts`);
      // (the list is every mission in its GROUPS' order — training, quiet alone, quiet as two, loud with the squad — not the squad table's: the model the rows are held against is the list's own)
      const L: any[] = MS.missionList().filter((m: any) => m.id !== MS.SOLO_NIGHT.id).map((m: any) => m.scenario);
      const mrowsOf = (r: El): Row[] => missionRows(r, MS.SOLO_NIGHT.id);
      F.verdict(rowsOf(root).length === 0 && !!buttonOf(root, 'Missions') && !!buttonOf(root, 'Start') && !buttonOf(root, 'Quit to scenarios'), "the start card carries no scenario rows of its own any more: a Missions button opens the list; the solo night's Start button is still there; no quit on the start card", buttons(root).map(b => b.textContent).join(' · '));
      buttonOf(root, 'Missions')!.onclick!();
      const mroot: El = MS.currentMissions()!.root as any, rows = mrowsOf(mroot);
      F.verdict(rows.length === L.length && L.length === ALL.length && ALL.every((e: any) => L.includes(e)) && rows.every((r, i) => r.id === L[i].id && r.title === L[i].title), 'the mission list holds every entry of every table, in the list\'s order, by its title (beside the solo night)', rows.map(r => r.title).join(' · '));
      F.verdict(rows.every((r, i) => r.href === pickSearch(L[i], SEARCH) && r.href.startsWith(scenarioQuery(L[i])) && r.href.endsWith('quality=high&mute') && entryOfQuery(r.href) === L[i]), "each row is a link to its entry's own URL, the visitor's other flags kept", rows.map(r => r.href).join(' · '));
      // the difficulty switch on the list's sheet (ui/missions.ts, game/difficulty.ts): standard as shipped, hard one press away, standard one press back
      { const { PRESSURE, PRESSURE_DEFAULTS } = await import(`${ROOT}/src/game/pressure.ts`), { DIGIN, DIGIN_DEFAULTS } = await import(`${ROOT}/src/game/digin.ts`), { difficultyNow, HARD } = await import(`${ROOT}/src/game/difficulty.ts`);
        const db = () => mroot.all((e: El) => !!e.attrs['data-difficulty']), lit = () => db().filter((e: El) => e.cls.has('on')).map((e: El) => e.attrs['data-difficulty']).join(',');
        const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        const was = lit(), n = db().length, now0 = difficultyNow();
        db().find((e: El) => e.attrs['data-difficulty'] === 'hard')?.onclick?.(); const hard = lit(), nowH = difficultyNow(), onH = PRESSURE.on && DIGIN.on && DIGIN.reachM === HARD.reachM && DIGIN.keeper === HARD.keeperDigs && PRESSURE.warned === HARD.warned && PRESSURE.second === HARD.second && PRESSURE.picket === HARD.picket && PRESSURE.byWay === HARD.byWay && PRESSURE.wayOut === HARD.wayOut && PRESSURE.drilled === HARD.drilled && !DIGIN.stay && !DIGIN.gather, hrefH = mrowsOf(mroot).map(r => r.href);
        PRESSURE.flank = !PRESSURE.flank; const nowC = difficultyNow(), litC = lit(); PRESSURE.flank = !PRESSURE.flank;
        DIGIN.cover = !DIGIN.cover; const nowOff = (PRESSURE.on = false, DIGIN.on = false, difficultyNow()); PRESSURE.on = DIGIN.on = true; DIGIN.cover = !DIGIN.cover;
        db().find((e: El) => e.attrs['data-difficulty'] === 'standard')?.onclick?.(); const back = lit(), nowS = difficultyNow(), hrefS = mrowsOf(mroot).map(r => r.href);
        F.verdict(n === 2 && was === 'standard' && now0 === 'standard', 'the mission list carries the difficulty switch: two buttons, standard lit as shipped', `${n} buttons · lit: ${was} · tables read: ${now0}`);
        F.verdict(hard === 'hard' && nowH === 'hard' && onH, 'one press on hard: both harder-defender tables on (press + dig-in, stay and gather off), hard lit', `lit: ${hard} · tables read: ${nowH}`);
        F.verdict(hrefH.length === L.length && hrefH.every((h, i) => h === `${pickSearch(L[i], SEARCH)}&difficulty=hard`) && hrefS.every((h, i) => h === pickSearch(L[i], SEARCH)),
          "the press puts the level on every scenario link (a pick is a page load: the choice rides the URL too), and the press back takes it off again (standard is said on a link only over a ?hard the visitor arrived with — the 'missions' family holds that)", `${hrefH[0]} · ${hrefS[0]}`);
        F.verdict(nowC === 'custom' && nowOff === 'standard', 'a row under the switch moved by hand reads custom while a switch is on; both switches off reads standard whatever the rows say', `one row moved: ${nowC} (lit before repaint: ${litC}) · both off, a row moved: ${nowOff}`);
        F.verdict(back === 'standard' && nowS === 'standard' && eq(PRESSURE, PRESSURE_DEFAULTS) && eq(DIGIN, DIGIN_DEFAULTS), 'one press back on standard: both tables are the build\'s again, key for key', `lit: ${back} · tables read: ${nowS}`);
      }
      MS.closeMissions();
      { bootCard(); const mb = buttonOf(root, 'Missions'); mb?.onclick?.(); const b = MS.currentMissions() ? mrowsOf(MS.currentMissions()!.root as any) : []; MS.closeMissions();
        F.verdict(!!mb && !mb.disabled && b.length === L.length && b.every((r, i) => r.href === rows[i].href), 'the boot card (up while the shaders compile) opens the same list, already live', `${b.length} rows`); }
      // ---- a scenario up: the pause card
      const SQ: any[] = SCENARIOS, SCN = SQ.find(e => e.squad === 4) ?? SQ[0];   // (the squad's table: the office's own four-man room clear, as this probe always started)
      const { why } = await quiet(() => startFromQuery(g, pickSearch(SCN, SEARCH)));
      for (let i = 0; i < 3; i++) { g.player.visibility = 0.05; W.step(DT); }
      menu.open('pause');
      const head = root.all(e => e.cls.has('head'))[0]?.innerHTML ?? '';
      F.verdict(why === null && head.includes(`paused · ${SCN.title.replace(/&/g, '&amp;')} · ${teamWords(SCN)}`), `under '${SCN.title}' the pause card names the scenario and its team`, head.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      F.verdict(!!buttonOf(root, 'Restart scenario') && !!buttonOf(root, 'Quit to scenarios') && !buttonOf(root, 'Restart encounter'), "it offers 'Restart scenario' and 'Quit to scenarios'", buttons(root).map(b => b.textContent).filter(t => !/^(Settings|Controls|Run so far)$/.test(t)).join(' · '));
      // ---- Restart scenario, pressed
      { const before = teamOf(g).map((x: any) => [...x.char.pos]), staged = g.nightBreach.staged;
        killGuard(g, teamOf(g)[0], [1, 0, 0], false, 'shot', 'player'); for (let i = 0; i < 10; i++) { g.player.visibility = 0.05; W.step(DT); }
        await quiet(() => buttonOf(root, 'Restart scenario')!.onclick!());
        const T: any[] = teamOf(g), moved = Math.max(...T.map((x: any, i: number) => dist(x.char.pos, before[i])));
        F.verdict(menu.mode === 'closed' && g.nightBreach.staged === staged + 1 && T.length === SCN.squad && T.every((x: any) => x.state !== 'dead') && moved < 0.02, "'Restart scenario' pressed with a teammate down: the card closes and the same team stands on the same marks, alive",
          `${T.length} teammates (${T.map((x: any) => x.callsign).join(', ')}) · staging ${staged} → ${g.nightBreach.staged} · furthest from his first mark ${f2(moved)} m`); }
      // ---- the down card
      { g.mission.stage = 'failed'; menu.open('debrief'); const has = !!buttonOf(root, 'Quit to scenarios'), restart = !!buttonOf(root, 'Restart scenario'); g.mission.stage = 'infiltrate';
        F.verdict(has && restart, 'the down card under a scenario offers the quit beside the restart', buttons(root).map(b => b.textContent).join(' · ')); }
      // ---- Quit to scenarios, pressed
      menu.open('pause');
      await quiet(() => buttonOf(root, 'Quit to scenarios')!.onclick!());
      for (let i = 0; i < 5; i++) { g.player.visibility = 0.05; W.step(DT); }
      { const r2 = buttons(root).filter(b => b.textContent === 'Missions'), units = g.guards.filter((x: any) => x.unit).length;
        F.verdict(quits === 1 && menu.mode === 'start' && r2.length === 1 && activeScenario(g) === null && units === 0 && NIGHTBREACH.squad === 2 && !g.fogOfWar.on, "'Quit to scenarios' pressed: the scenario is off, the start card (and its Missions button) is up again over the plain night",
          `menu '${menu.mode}' with ${r2.length} Missions button · scenario ${activeScenario(g) ?? 'none'} · ${units} units left · ${g.guards.length} of the shift back · squad knob ${NIGHTBREACH.squad} · fog ${g.fogOfWar.on ? 'on' : 'off'}`); }
      // ---- no scenario: none of it
      menu.close(); menu.open('pause');
      F.verdict(!buttonOf(root, 'Quit to scenarios') && !!buttonOf(root, 'Restart encounter') && /paused<\/div>/.test(root.all(e => e.cls.has('head'))[0]?.innerHTML ?? ''), 'with no scenario up the pause card is the plain one', buttons(root).map(b => b.textContent).filter(t => !/^(Settings|Controls|Run so far)$/.test(t)).join(' · '));
      // ---- a refused pick (the sandbox's 'no AI' ticked, then a row clicked): nothing staged, the plain floor's fog and knob, the reason on the card
      { menu.close(); g.aiEnabled = false;
        const r = await quiet(() => startFromQuery(g, '?squad4&mute')); g.aiEnabled = true;
        const words = r.spec && r.why ? refusalWords(r.spec, r.why) : null;
        menu.setScenario({ current: () => runningScenario(g, null), quit: () => {}, refused: () => words });
        menu.open('start');
        const note = root.all(e => e.cls.has('refused'))[0]?.textContent ?? null;
        F.verdict(!!r.why && activeScenario(g) === null && !g.fogOfWar.on && NIGHTBREACH.squad === 2 && g.guards.filter((x: any) => x.unit).length === 0 && !!note && note === words && !!buttonOf(root, 'Missions'),
          "a pick the game refuses (no AI) stages nothing, leaves fog off and the knob at the pair, and the start card says why under its buttons", `start() said: ${r.why} · the card: "${note}" · fog ${g.fogOfWar.on ? 'on' : 'off'} · knob ${NIGHTBREACH.squad}`);
        menu.setScenario({ current: () => runningScenario(g, null), quit: () => {} }); menu.open('start');
        F.verdict(root.all(e => e.cls.has('refused')).length === 0, 'no refusal, no note', buttons(root).map(b => b.textContent).join(' · ')); }
    });
  } catch (e: any) { F.verdict(false, 'the card builds and its buttons run', String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ')); }
  finally { resetKnobs(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── start ─────────────────────────────────────────────────────────────
/** the checks one boot of one entry must pass; returns the failures (none = good) */
function judge(r: BootReport, e: { kind: string; squad: number; id?: string }, plain: Shot | null, marks: number[][] | null = null): string[] {
  const bad: string[] = [];
  if (r.threw) return [`threw: ${r.threw}`];
  if (r.errors.length) bad.push(`console errors: ${r.errors.slice(0, 2).join(' | ')}`);
  const s = r.start, t = r.restart, q = r.quit;
  if (s.why) bad.push(`refused: ${s.why}`);
  if (s.active !== e.kind) bad.push(`started '${s.active}', want '${e.kind}'`);
  if (e.id && s.entry !== e.id) bad.push(`the running scenario reads as entry '${s.entry}', want '${e.id}'`);
  for (const [what, x] of [['start', s], ['restart', t]] as [string, Shot][]) {
    if (x.ops.length !== e.squad || x.operatives !== e.squad || !x.ops.every(m => m.alive)) bad.push(`${what}: ${x.ops.length} teammates staged, ${x.operatives} alive on the floor (want ${e.squad})`);
    if (x.hudMen !== e.squad) bad.push(`${what}: the HUD's squad block lists ${x.hudMen} men (want ${e.squad})`);
    if (x.samDown) bad.push(`${what}: Sam is down`);
    if (e.kind !== 'nightbreach' && !x.fog) bad.push(`${what}: fog of war is off`);
    if (e.kind === 'nightbreach' && x.fog) bad.push(`${what}: fog of war is on under the night breach`);
    for (let i = 0; i < x.ops.length; i++) for (let j = i + 1; j < x.ops.length; j++) if (dist(x.ops[i].pos, x.ops[j].pos) < 0.6) bad.push(`${what}: ${x.ops[i].name} and ${x.ops[j].name} stand ${f2(dist(x.ops[i].pos, x.ops[j].pos))} m apart`);
    for (const m of x.ops) if (dist(m.pos, x.sam) < 0.6) bad.push(`${what}: ${m.name} stands ${f2(dist(m.pos, x.sam))} m from Sam`);
  }
  if (e.squad === 4 && (s.ops.filter(m => m.pair === 'red').length !== 2 || s.ops.filter(m => m.pair === 'blue').length !== 2)) bad.push(`the four are not a red pair and a blue pair: ${s.ops.map(m => `${m.name}/${m.pair}`).join(', ')}`);
  if (r.spoiled.dead < 1 || r.spoiled.samOff < 0.3) bad.push(`the floor was not spoiled before the restart (${r.spoiled.dead} teammates down, Sam ${f2(r.spoiled.samOff)} m off his start): the restart check would be vacuous`);
  if (t.staged !== s.staged + 1) bad.push(`the restart staged it ${t.staged - s.staged} times`);
  if (t.ops.map(m => m.name).join() !== s.ops.map(m => m.name).join()) bad.push(`the restart's team is ${t.ops.map(m => m.name).join(', ')}, was ${s.ops.map(m => m.name).join(', ')}`);
  else { const far = Math.max(dist(s.sam, t.sam), ...s.ops.map((m, i) => dist(m.pos, t.ops[i].pos))); if (far > 0.02) bad.push(`after the restart somebody stands ${f2(far)} m from where the first staging put him`); }
  if (t.hostiles !== s.hostiles || t.hostages !== s.hostages) bad.push(`the restart stands ${t.hostiles} hostiles / ${t.hostages} hostages, the start ${s.hostiles} / ${s.hostages}`);
  if (marks) { const far = Math.max(...marks.map((m, i) => (s.ops[i] ? dist(m, s.ops[i].pos) : 99))); if (far > 0.02) bad.push(`a teammate stands ${f2(far)} m off the level's own mark`); }
  if (r.quitWas !== e.kind) bad.push(`quit stopped '${r.quitWas}'`);
  if (q.active !== null || q.units !== 0 || q.squadKnob !== 2 || q.fog) bad.push(`after the quit: scenario ${q.active ?? 'none'}, ${q.units} units, squad knob ${q.squadKnob}, fog ${q.fog ? 'on' : 'off'}`);
  if (plain && (q.staff !== plain.staff || q.civilians !== plain.civilians)) bad.push(`after the quit ${q.staff} of the shift and ${q.civilians} civilians (a plain boot: ${plain.staff} and ${plain.civilians})`);
  return bad;
}
const tell = (r: BootReport) => r.threw ? 'threw' : `${r.start.title} [${r.start.team}] · ${r.start.ops.map(m => `${m.name} ${at(m.pos)}`).join(', ')} · Sam ${at(r.start.sam)} · ${r.start.hostiles} armed men${r.start.hostages ? ` · ${r.start.hostages} hostages` : ''} · HUD ${r.start.hudMen} men · restart (after ${r.spoiled.dead} teammate down, Sam ${f2(r.spoiled.samOff)} m off): ${r.restart.ops.filter(m => m.alive).length} alive on the same marks · quit: ${r.quit.staff} shift, ${r.quit.civilians} civilians, ${r.quit.units} units`;

export async function pickerStart(): Promise<boolean> {
  const F = family("picker-start: every entry booted by its row's link and by its typed flag — the team after the start, after a restart, and the quit");
  const SEARCH = '?quality=high&mute';
  const L: any[] = SCENARIOS;
  // the hrefs as the mission LIST renders them (not recomputed here): ui/missions.ts on a fake DOM
  let hrefs: Row[] = [];
  try { hrefs = await withDom(SEARCH, async () => { const MS = await import(`${ROOT}/src/ui/missions.ts`); const host = new El('DIV'); MS.openMissions({ root: host as any }); const r = missionRows(host, MS.SOLO_NIGHT.id); MS.closeMissions(); return r; }); } catch (e: any) { F.verdict(false, 'the rows render', String(e?.message ?? e)); return F.done(); }
  const TYPED: Record<string, string> = { 'nightbreach/2': '?nightbreach', 'roomclear/2': '?roomclear', 'roomclear/4': '?squad4', 'rescue/2': '?rescue' };
  const plainRun = await bootChild('');
  const plain = plainRun.threw ? null : plainRun.start;
  F.verdict(!!plain && plain.active === null && plain.units === 0 && plainRun.quitWas === null, 'a boot with no scenario flag starts none (the start card\'s floor: the night shift)', plain ? `${plain.staff} of the shift · ${plain.civilians} civilians · no units · fog ${plain.fog ? 'on' : 'off'}` : String(plainRun.threw));
  const jobs: { e: any; how: string; query: string }[] = [];
  for (const e of L) {
    const row = hrefs.find(r => r.id === e.id);
    jobs.push({ e, how: "its row's link", query: row?.href ?? '(no row)' });
    const flag = TYPED[`${e.kind}/${e.squad}`] ?? scenarioQuery(e);
    jobs.push({ e, how: 'typed', query: e.level ? `?levelFile=${e.level}&${flag.slice(1)}` : flag });
  }
  // an entry on a level of its own is judged against THAT level: its file's box count, its own team marks, and its own plain floor after the quit
  const files: string[] = [...new Set(L.filter(e => e.level).map(e => e.level as string))];
  const ownLevel: Record<string, { level: any; plain: Shot | null }> = {};
  for (const f of files) { let level: any = null; try { level = levelOfFile(f); } catch { /* judged below: the boot throws too */ } const p = await bootChild(`?levelFile=${f}`); ownLevel[f] = { level, plain: p.threw ? null : p.start }; }
  const reports = await Promise.all(jobs.map(j => bootChild(j.query)));
  jobs.forEach((j, i) => { const r = reports[i], own = j.e.level ? ownLevel[j.e.level] : null;
    const S = own?.level?.scenarios, T = S ? (j.e.kind === 'rescue' ? S.rescue?.team : j.e.kind === 'roomclear' ? S.roomClear?.team : null) : null;
    const marks: number[][] | null = T?.ops && T.ops.length >= j.e.squad ? T.ops.slice(0, j.e.squad) : null;
    const bad = judge(r, j.e, own ? own.plain : plain, marks);
    if (own && !r.threw) { if (!own.level) bad.push(`levels/${j.e.level} does not load`); else if (r.start.level !== `${own.level.boxes.length} boxes`) bad.push(`it booted on a level of ${r.start.level}, the file has ${own.level.boxes.length}`);
      if (!own.plain) bad.push(`a plain boot of ${j.e.level} threw`); if (T && dist(r.start.sam, T.sam) > 0.02) bad.push(`Sam stands ${at(r.start.sam)}, the level's start is ${at(T.sam)}`); }
    F.verdict(bad.length === 0, `${j.e.title} (${teamWords(j.e)}${j.e.level ? `, on ${j.e.level}` : ''}) by ${j.how}: ${j.query}`, bad.length ? bad.join(' · ') : tell(r) + (own?.plain ? ` (that level's plain floor: ${own.plain.staff} shift, ${own.plain.civilians} civilians${marks ? '; the team on the level\'s own marks' : ''})` : '')); });
  // the two ways in stand the same floor
  for (const e of L) { const a = reports[jobs.findIndex(j => j.e === e && j.how !== 'typed')], b = reports[jobs.findIndex(j => j.e === e && j.how === 'typed')];
    const same = !a.threw && !b.threw && a.start.ops.length === b.start.ops.length && a.start.ops.every((m, i) => dist(m.pos, b.start.ops[i].pos) < 0.02) && dist(a.start.sam, b.start.sam) < 0.02 && a.start.hostiles === b.start.hostiles;
    F.verdict(same, `${e.title}: the link and the typed flag stage the same team on the same marks`, same ? `${a.start.ops.length} teammates, ${a.start.hostiles} armed men, Sam ${at(a.start.sam)}` : 'they differ'); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── a level of its own ─────────────────────────────────────────────────────────────
const TEST_LEVEL = 'test-rooms.json';
export async function pickerLevel(): Promise<boolean> {
  const F = family(`picker-level: an entry with a level of its own (${TEST_LEVEL}) — one new row, no picker code`);
  let level: any; try { level = levelOfFile(TEST_LEVEL); } catch (e: any) { F.verdict(false, `levels/${TEST_LEVEL} loads`, String(e?.message ?? e)); return F.done(); }
  const S = level.scenarios ?? {};
  const rows: any[] = [];
  if (S.roomClear) rows.push({ id: 't-pair', title: 'Test rooms', kind: 'roomclear', squad: 2, level: TEST_LEVEL, blurb: 'a row a level task would add' }, { id: 't-four', title: 'Test rooms, four', kind: 'roomclear', squad: 4, level: TEST_LEVEL });
  if (S.rescue) rows.push({ id: 't-rescue', title: 'Test rescue', kind: 'rescue', squad: 2, level: TEST_LEVEL });
  if (!rows.length) { F.verdict(false, 'the test level carries scenario data', 'no roomClear and no rescue block'); return F.done(); }
  { const q = rows.map(e => scenarioQuery(e)), ok = rows.every(e => { const sp = specOfQuery(scenarioQuery(e)); return sp && sp.level === TEST_LEVEL && sp.kind === e.kind && sp.squad === e.squad && entryOfQuery(scenarioQuery(e), rows) === e && entryOfQuery(scenarioQuery(e)) === null; });
    F.verdict(ok, 'its rows go to URLs that name the level file, read back to those rows, and to none of the office\'s', q.join(' · ')); }
  try { const lv = await withDom('', async () => { const MS = await import(`${ROOT}/src/ui/missions.ts`); const host = new El('DIV'), S = MS.openMissions({ root: host as any, list: MS.missionList([...SCENARIOS, ...rows]) });
      const out = missionRows(host, MS.SOLO_NIGHT.id);   // the level's name is on the SHEET of the highlighted mission (its 'level' fact), not on the row
      for (const r of out) { S.select(r.id); r.tags = [host.all(e => e.attrs['data-fact'] === 'level')[0]?.all(e => e.tagName === 'B')[0]?.textContent ?? '']; }
      MS.closeMissions(); return out; });
    const mine = lv.filter(r => rows.some(e => e.id === r.id));
    F.verdict(lv.length === SCENARIOS.length + rows.length && mine.length === rows.length && mine.every(r => r.tags.includes('test-rooms') && r.href.includes(`levelFile=${TEST_LEVEL}`)), "added to the list they are missions like any other, their sheet naming the level", mine.map(r => `${r.title} [${r.team} · ${r.tags.join(' · ')}] → ${r.href}`).join(' · ')); }
  catch (e: any) { F.verdict(false, 'the rows render', String(e?.message ?? e)); }
  const reports = await Promise.all(rows.map(e => bootChild(scenarioQuery(e))));
  rows.forEach((e, i) => { const r = reports[i];
    const T = e.kind === 'rescue' ? S.rescue.team : S.roomClear.team, marks: number[][] | null = T?.ops ? T.ops.slice(0, e.squad) : null;
    const bad = judge(r, { kind: e.kind, squad: e.squad }, null, marks && marks.length === e.squad ? marks : null);   // (these rows are not on the child's list: it reads the kind's plain name)
    if (!r.threw && r.start.entry !== null) bad.push(`it reads as the office's entry '${r.start.entry}'`);
    if (!r.threw && r.start.level !== `${level.boxes.length} boxes`) bad.push(`it booted on a level of ${r.start.level}, the file has ${level.boxes.length}`);
    if (!r.threw && T && dist(r.start.sam, T.sam) > 0.02) bad.push(`Sam stands ${at(r.start.sam)}, the level's start is ${at(T.sam)}`);
    F.verdict(bad.length === 0, `${e.title} (${e.kind}, ${teamWords(e)}): ${scenarioQuery(e)} boots on the level and stands the team on the level's own start, restart and quit as on the office`, bad.length ? bad.join(' · ') : tell(r)); });
  // ---- the module-level team-start knobs, two levels in ONE process (the foundation's claim). Printed as found; what is HELD is the page's case above (one level a process).
  try {
    Math.random = seeded(0x51c4); resetKnobs();
    const A = await quiet(() => standUp({ uploadEvery: 4 })); const kind = S.rescue ? 'rescue' : 'roomclear';
    const qa = kind === 'rescue' ? '?rescue' : '?roomclear', startA = await quiet(() => startFromQuery(A.game, qa));
    const samA = [...A.game.player.char.pos];
    const B = await quiet(() => standUp({ uploadEvery: 4, level: levelOfFile(TEST_LEVEL) })); const startB = await quiet(() => startFromQuery(B.game, qa));
    const samB = [...B.game.player.char.pos];
    await quiet(() => A.game.restartEncounter()); const samA2 = [...A.game.player.char.pos];
    const reused = dist(samA2, samB) < 1.0 && dist(samA2, samA) > 2.0;   // (put on the other level's mark; this floor's furniture may shove him a step off it)
    await quiet(() => { quitScenario(A.game); quitScenario(B.game); });
    F.verdict(startA.why === null && startB.why === null, `two Games of two levels in one process, the ${kind} on both (what a page never does — a pick is a load)`,
      `office start: Sam ${at(samA)} · ${TEST_LEVEL} start: Sam ${at(samB)} · the office restaged AFTER the other level's start: Sam ${at(samA2)}, ${f2(dist(samA2, samB))} m from the other level's mark and ${f2(dist(samA2, samA))} m from its own — ${reused ? "the OTHER level's mark: the foundation's claim holds (the knobs are module globals, written at start(), read at every staging)" : dist(samA2, samA) < 0.05 ? 'its own mark: the claim does not reproduce here' : 'neither mark'}. Only a second level started in the same process can do this; the picker never does it`);
  } catch (e: any) { F.verdict(false, 'two Games of two levels in one process', String(e?.stack ?? e).split('\n').slice(0, 2).join(' | ')); }
  finally { resetKnobs(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the rescue's staging ─────────────────────────────────────────────────────────────
export async function pickerRescue(): Promise<boolean> {
  const F = family("picker-rescue: the hostage rescue's staging on the office as shipped — the marks the data check names, where those men really stand, and the four");
  try {
    Math.random = seeded(0x51c4); resetKnobs();
    const W = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game; g.godMode = true;
    const S = g.level.scenarios.rescue;
    const claims: string[] = checkRescue(g);
    console.log(`  checkRescue on the office, before any staging — ${claims.length} line(s):${claims.map(c => `\n    · ${c}`).join('') || ' none'}`);
    const { why } = await quiet(() => startFromQuery(g, '?rescue'));
    const R = g.rescue;
    type Who = { what: string; mark: number[]; gd: any };
    const cast = (): Who[] => { const out: Who[] = [];
      R.ops.forEach((gd: any, i: number) => out.push({ what: `teammate ${i + 1}`, mark: RESCUE.opsAt[i], gd }));
      R.hostages.forEach((gd: any, i: number) => out.push({ what: `hostage ${i + 1}`, mark: S.hostages[i].pos, gd }));
      for (const gd of R.hostiles) { const m = [S.captor, S.doorMan.inside, S.doorMan.outside, ...S.roamers].map((x: any) => x.pos).sort((a: number[], b: number[]) => dist(a, gd.char.pos) - dist(b, gd.char.pos))[0]; out.push({ what: gd.callsign, mark: m, gd }); }   // (asked on the frame he is staged: the nearest mark is his)
      return out; };
    const propsAt = () => g.props.props.map((p: any) => [p.x, 0, p.z]);
    const snap = async () => { const c0 = cast(), at0 = c0.map(c => [...c.gd.char.pos]), p0 = propsAt(); for (let i = 0; i < 120; i++) { g.player.visibility = 0.05; W.step(DT); } const c1 = cast();
      return { who: c0.map(c => c.what), mark: c0.map(c => c.mark), at0, at2: c1.map(c => [...c.gd.char.pos]), propMoved: propsAt().map((p: number[], i: number) => dist(p, p0[i])), alive: c1.every(c => c.gd.state !== 'dead') }; };
    const a = await quiet(snap);
    F.verdict(why === null && R.ops.length === 2 && R.hostages.length === 2, 'the rescue stages: the pair, two hostages, the captor and his men', `${a.who.join(', ')}`);
    const off0 = a.who.map((w, i) => ({ w, d: dist(a.at0[i], a.mark[i]) })), off2 = a.who.map((w, i) => ({ w, d: dist(a.at2[i], a.mark[i]) }));
    const shoved = a.propMoved.map((d: number, i: number) => ({ name: g.props.props[i].def.name, d })).filter((x: any) => x.d > 0.02);
    console.log(`  on the frame it is staged, off his mark: ${off0.map(o => `${o.w} ${f2(o.d)} m`).join(' · ')}`);
    console.log(`  two seconds on (nobody ordered, nobody fired): ${off2.map(o => `${o.w} ${f2(o.d)} m`).join(' · ')}`);
    console.log(`  furniture moved in those two seconds: ${shoved.length ? shoved.map((x: any) => `${x.name} ${f2(x.d)} m`).join(' · ') : 'none'}`);
    F.verdict(a.alive && off2.every(o => o.d < 1.0), 'two seconds after the staging everybody is alive and within a metre of his mark (the men the check names are shoved clear of the furniture, not stuck in it)', `furthest: ${off2.slice().sort((x, y) => y.d - x.d).slice(0, 3).map(o => `${o.w} ${f2(o.d)} m`).join(' · ')} · ${shoved.length} piece(s) of furniture moved`);
    // the same at every restart? (the roamers are dealt by a staging-time draw: compared by who is on which mark)
    const runs = [a]; for (let k = 0; k < 3; k++) { await quiet(() => g.restartEncounter()); runs.push(await quiet(snap)); }
    const key = (r: typeof a, w: string) => { const i = r.who.indexOf(w); return i < 0 ? null : r.at2[i]; };
    const fixed = ['teammate 1', 'teammate 2', 'hostage 1', 'hostage 2', 'Captor', 'Door man'];
    const spread = fixed.map(w => { const ps = runs.map(r => key(r, w)).filter(Boolean) as number[][]; return { w, d: ps.length === runs.length ? Math.max(...ps.map(p => dist(p, ps[0]))) : Infinity }; });   // (a name that is not there in every run fails, not passes)
    F.verdict(runs.every(r => r.alive && r.who.length === a.who.length) && spread.every(s => s.d < 0.05), 'four stagings in a row put the pair, the hostages, the captor and the door man in the same places two seconds on (to 5 cm)', spread.map(s => `${s.w} ±${f2(s.d)} m`).join(' · '));
    { const S2 = g.level.scenarios.rescue, lines = runs.map((r, k) => r.who.map((w, i) => ({ w, i })).filter(x => x.w.startsWith('Roamer')).map(x => { const n = S2.roamers.findIndex((m: any) => dist(m.pos, r.mark[x.i]) < 0.01); return `${x.w} on roamer mark ${n + 1} ${at(r.mark[x.i])}, ${f2(dist(r.at2[x.i], r.mark[x.i]))} m off it two seconds on`; }).join(', ') || 'no roamer').map((t, k) => `staging ${k + 1}: ${t}`);
      console.log(`  the roamer (dealt by a staging-time draw between the two marks):\n    ${lines.join('\n    ')}`); }
    await quiet(() => quitScenario(g));
    // ---- the four in the rescue
    const r4 = await bootChild('?rescue&squad4');
    F.verdict(!r4.threw && r4.start.active === 'rescue' && r4.start.ops.length === 2 && r4.start.title === 'Hostage rescue', '?rescue&squad4 stages the PAIR: four in the rescue is not built, so it is not on the list', r4.threw ?? `${r4.start.ops.length} teammates (${r4.start.ops.map(m => m.name).join(', ')}) · reads as '${r4.start.title}' [${r4.start.team}]`);
  } catch (e: any) { F.verdict(false, 'the rescue stages on the office', String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ')); }
  finally { resetKnobs(); }
  return F.done();
}

if (import.meta.main && !process.argv.includes('--boot')) {
  const all = [await pickerList(), await pickerCard(), await pickerStart(), await pickerLevel(), await pickerRescue()];
  process.exit(all.every(Boolean) ? 0 : 1);
}
