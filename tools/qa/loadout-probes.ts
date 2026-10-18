// The 'loadout' family (the LOADOUT SCREEN and the squad sizes behind it — src/game/loadout.ts, src/ui/loadout.ts; the staging in nightbreach.ts / rescue.ts),
// run through probes.ts:
//   bun run tools/qa/probes.ts loadout | loadout-pure | loadout-screen | loadout-stage
//   bun run tools/qa/loadout-probes.ts --table        the scenario × size table as markdown (what loadout-stage boots, one row a scenario)
// PASS / FAIL each, all headless. Nothing here looks at a picture: the screen is the real openLoadout on the picker probes' fake DOM (what it puts on the page
// and what its keys do, not how it looks), and a 'boot' is a CHILD PROCESS (this file with --boot '<query>'), as a pick is a page load: fresh modules, the level
// the query names, the harness Game, game/scenarioRun.ts startFromQuery — the function main.ts calls.
//   loadout-pure     the size as data: `?squad=N` and `?squad4` read back (squad=N wins; the rescue never reads the bare flag; a bad N asks for nothing); every
//                    kind offers five sizes with exactly one its own; the roster of each size; Deploy's query string — untouched at the mission's own size, else
//                    `squad=N` in place of `squad4`, the visitor's other flags kept — reads back to that size; the store remembers per mission and survives junk
//   loadout-screen   the real screen on a fake DOM, for a pair mission, a four mission and a rescue: five slots, the mission's own size lit at first, each man
//                    who comes with his kit in a line, ONE [data-member="i"] host under them holding the picked member's real kit card (ui/kitCard.ts), A D /
//                    the stepper / a size button / an empty slot's click change the size, a filled slot's click picks its man, the keys walk team → members →
//                    down through the card → the buttons and change a card row on the way (the table, the slot's line and the squad's count all follow),
//                    Enter deploys the query of the size shown, Esc backs out without deploying — from inside a card too —, a greyed size cannot be chosen and
//                    says why, the size last deployed is what it opens on next time, and the flow: a pick on the mission list opens it, Deploy loads the list's URL, Esc is the list again; the solo night too
//   loadout-stage    every scenario on the list booted at every size 0‥4 (60 boots, and 12 more by the row's own URL): it starts unrefused (or the screen greys that size, with the reason), stands
//                    exactly N teammates with the roster's names and pairs on free floor a body apart, the F drill exists only with two or more on a level with
//                    a breach plan, the pause card's words say the size, ten seconds of play throw nothing, a restart puts the same N back, a quit leaves the
//                    knobs at the pair; with every defender dropped by the player's hand the scenario ends won at every size, alone too (the room clear: taken; the rescue: Sam holds the hostage room himself; the night breach with fewer than two: 'room clear' — with two or more that end is the F drill's, as ever); and at its OWN size the boot by `squad=N` stands the same men on the same marks as the row's own URL
import { standUp, ROOT } from './headless.ts';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { El, withDom } from './scenario-picker-probes.ts';

const { SCENARIOS, specOfQuery, pickSearch, quitSearch, teamWords } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, quitScenario, activeScenario, runningScenario, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const L = await import(`${ROOT}/src/game/loadout.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

// ───────────────────────────────────────────────────────────── a boot, in a process of its own ─────────────────────────────────────────────────────────────
interface Man { name: string; pos: number[]; pair: string | null; alive: boolean; blocked: boolean }
interface Shot { active: string | null; team: string | null; title: string | null; ops: Man[]; hostiles: number; drill: boolean; noDrill: boolean; plan: boolean; knobNB: number; knobRS: number; ordersActive: boolean; line: string }
interface BootReport { query: string; spec: any; why: string | null; start: Shot; start5: Shot; after: Shot; restart: Shot; won: string | null; quit: Shot; errors: string[]; threw: string | null }
function shotOf(W: any, levelFile: string | null, line = ''): Shot {
  const g = W.game, run = runningScenario(g, levelFile), ops: any[] = teamOf(g);
  return { active: activeScenario(g), team: run?.team ?? null, title: run?.title ?? null,
    ops: ops.map((gd: any) => ({ name: gd.callsign, pos: [...gd.char.pos], pair: gd.unit?.pair ?? null, alive: gd.state !== 'dead', blocked: g.col.nav.isBlocked(gd.char.pos[0], gd.char.pos[2]) })),
    hostiles: g.guards.filter((x: any) => x.unit && x.team === 'hostile').length, drill: !!g.nightBreach.drill, noDrill: !!g.nightBreach.noDrill, plan: !!g.level.breach,
    knobNB: NIGHTBREACH.squad, knobRS: RESCUE.squad, ordersActive: !!g.orders.active, line };
}
async function boot(query: string): Promise<BootReport> {
  const errors: string[] = []; let threw: string | null = null;
  const q = new URLSearchParams(query), lf = q.get('levelFile'), levelFile = lf && /^[\w.-]+\.json$/.test(lf) ? lf : null;
  const R: Partial<BootReport> = { query, spec: specOfQuery(q) };
  const err = console.error; console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ').split('\n')[0]); };
  try {
    Math.random = seeded(0x51c4);
    const W = await standUp({ uploadEvery: 4, ...(levelFile ? { level: levelOfFile(levelFile) } : {}) });
    const g = W.game; g.godMode = true;
    let line = ''; const msg = g.msg.bind(g); g.msg = (t: string, ...r: unknown[]) => { if (!line && /armed men|hostage|rescue/i.test(t)) line = t; return msg(t, ...r); };
    const { why } = startFromQuery(g, q); R.why = why;
    R.start = shotOf(W, levelFile, line);
    // ten seconds of play with the keys a player presses first: F (the drill's word, or the rescue's), then X twice (the order menu up and away)
    for (let i = 0; i < 600; i++) { g.player.visibility = 0.05; if (i === 60 || i === 200) W.input.pressed.add('KeyF'); if (i === 320 || i === 340) W.input.pressed.add('KeyX'); W.step(DT); if (i === 4) R.start5 = shotOf(W, levelFile); }
    R.after = shotOf(W, levelFile);
    g.restartEncounter();
    for (let i = 0; i < 5; i++) { g.player.visibility = 0.05; W.step(DT); }
    R.restart = shotOf(W, levelFile);
    // every defender dropped by the player's hand: the scenario's own end, whoever came (alone, nobody else could have won it)
    { let said = ''; const m2 = g.msg.bind(g); g.msg = (t: string, ...r: unknown[]) => { if (/room clear|rooms clear|CLEAN|COSTLY|FAILED|rescued|lost/i.test(t)) said = t; return m2(t, ...r); };
      for (const h of g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead')) killGuard(g, h, [1, 0, 0], false, 'shot', 'player');
      const B = g.rescue?.active ? (g.rescue as any).bounds : null; if (B) g.teleportPlayer([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]);   // (the rescue is won by HOLDING the hostage room: Sam stands in it himself)
      for (let i = 0; i < 180 + (B ? Math.ceil(RESCUE.holdSecs * 60) : 0); i++) { g.player.visibility = 0.05; W.step(DT); }
      R.won = g.roomClear?.active ? `${g.roomClear.end} (${g.roomClear.endWhy})` : g.rescue?.active ? (g.rescue.result ? `${g.rescue.result.state} ${g.rescue.result.grade}` : null) : said ? said.replace(/\. Shift.*$/, '') : null; }
    quitScenario(g, false);
    for (let i = 0; i < 30; i++) { g.player.visibility = 0.05; W.step(DT); }
    R.quit = shotOf(W, levelFile);
  } catch (e: any) { threw = String(e?.stack ?? e).split('\n').slice(0, 4).join(' | '); }
  finally { console.error = err; }
  return { ...(R as BootReport), errors, threw };
}
const TAG = 'LOADOUT-BOOT ';
if (import.meta.main && process.argv.includes('--boot')) {
  const query = process.argv[process.argv.indexOf('--boot') + 1] ?? '';
  const log = console.log; console.log = console.warn = () => {};
  const r = await boot(query);
  log(TAG + JSON.stringify(r));
  process.exit(0);
}
async function bootChild(query: string): Promise<BootReport> {
  const p = Bun.spawn(['bun', 'run', import.meta.path, '--boot', query], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(p.stdout).text(), errText = await new Response(p.stderr).text(); await p.exited;
  const line = out.split('\n').find(l => l.startsWith(TAG));
  if (!line) return { query, spec: null, errors: [], threw: `the boot printed no report (exit ${p.exitCode}): ${(errText || out).trim().split('\n').slice(-3).join(' | ')}` } as unknown as BootReport;
  return JSON.parse(line.slice(TAG.length));
}
/** `jobs` at a time */
async function pool<T, R>(items: T[], jobs: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => { for (;;) { const i = k++; if (i >= items.length) return; out[i] = await fn(items[i]); } }));
  return out;
}

// ───────────────────────────────────────────────────────────── loadout-pure ─────────────────────────────────────────────────────────────
export async function loadoutPure(): Promise<boolean> {
  const { verdict, done } = family('loadout-pure: the squad size as data');
  { const rd = (s: string, f = true) => L.squadOfQuery(s, f);
    const got = [rd('?squad=0'), rd('?squad=1'), rd('?squad=3'), rd('?squad4'), rd('?squad4&squad=1'), rd('?squad=9'), rd('?squad=many'), rd('?roomclear'), rd('?squad4', false), rd('?squad=4', false), rd('?squad=')];
    const want = [0, 1, 3, 4, 1, null, null, null, null, 4, null];
    verdict(JSON.stringify(got) === JSON.stringify(want), '?squad=N reads 0‥4, ?squad4 is 4, squad=N wins, junk asks for nothing', `read ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  { const s = (x: string) => specOfQuery(x)?.squad ?? null, k = (x: string) => specOfQuery(x)?.kind ?? null;
    const rows: [string, string | null, number | null][] = [['?roomclear', 'roomclear', 2], ['?squad4', 'roomclear', 4], ['?roomclear&squad=3', 'roomclear', 3], ['?roomclear&squad4&squad=1', 'roomclear', 1], ['?nightbreach&squad=0', 'nightbreach', 0],
      ['?nightbreach&squad4', 'nightbreach', 4], ['?rescue', 'rescue', 2], ['?rescue&squad4', 'rescue', 2], ['?rescue&squad=4', 'rescue', 4], ['?rescue&squad=0', 'rescue', 0], ['?squad=3', null, null], ['?roomclear&squad=7', 'roomclear', 2]];
    const bad = rows.filter(([q, kind, n]) => k(q) !== kind || s(q) !== n);
    verdict(!bad.length, 'the page reads a scenario with its size: the old URLs as ever, squad=N on any of the three kinds, alone it names no scenario', bad.length ? bad.map(([q]) => `${q} → ${k(q)} / ${s(q)}`).join(' · ') : rows.map(([q, , n]) => `${q} → ${n ?? 'none'}`).join(' · ')); }
  { const bad: string[] = [];
    for (const e of SCENARIOS) { const C = L.squadChoices(e); if (C.length !== 5 || C.filter((c: any) => c.own).length !== 1 || C.find((c: any) => c.own).n !== e.squad || !C.find((c: any) => c.own).ok) bad.push(e.id); for (const c of C) if (!c.ok && !c.note) bad.push(`${e.id}:${c.n} greyed with no reason`); }
    verdict(!bad.length, 'every mission offers five sizes, exactly one its own (and that one can be staged); a greyed size says why', bad.join(' · ') || `${SCENARIOS.length} missions · greyed: ${SCENARIOS.flatMap((e: any) => L.squadChoices(e).filter((c: any) => !c.ok).map((c: any) => `${e.id}:${c.n}`)).join(', ') || 'none'}`); }
  { const R = [0, 1, 2, 3, 4].map(n => L.rosterOf(n).map((m: any) => `${m.name}/${m.pair}`).join(', '));
    const want = ['', 'Blue One/blue', 'Blue One/blue, Blue Two/blue', 'Red One/red, Red Two/red, Blue One/blue', 'Red One/red, Red Two/red, Blue One/blue, Blue Two/blue'];
    verdict(JSON.stringify(R) === JSON.stringify(want), 'the roster of each size: the pair as ever up to two, the four-man squad\'s first three or all of it past that', R.map((r, n) => `${n}: ${r || 'nobody'}`).join(' · '));
    const w = [0, 1, 2, 3, 4].map(n => teamWords({ squad: n })); verdict(w.join('|') === 'solo|you + one|you + the pair|you + three|you + four', 'the words for each size', w.join(' · ')); }
  { const bad: string[] = []; let same = 0, changed = 0;
    for (const e of SCENARIOS) { const pick = pickSearch(e, '?quality=low&mute&loadout=' + e.id);
      for (const n of [0, 1, 2, 3, 4]) { const to = L.squadSearch(pick, n, e.squad), spec = specOfQuery(to), q = new URLSearchParams(to);
        if (n === e.squad) { same++; if (to !== pickSearch(e, '?quality=low&mute')) bad.push(`${e.id}@${n}: its own size changed the URL (${to})`); } else { changed++; if (q.has('squad4') || q.get('squad') !== String(n)) bad.push(`${e.id}@${n}: ${to}`); }
        if (!spec || spec.kind !== e.kind || spec.squad !== n || (spec.level ?? '') !== (e.level ?? '')) bad.push(`${e.id}@${n}: reads back as ${JSON.stringify(spec)}`);
        if (q.get('quality') !== 'low' || !q.has('mute') || q.has('loadout')) bad.push(`${e.id}@${n}: the visitor's flags (${to})`);
        if (quitSearch(to) !== '?quality=low&mute') bad.push(`${e.id}@${n}: a quit leaves ${quitSearch(to)}`); } }
    verdict(!bad.length, 'Deploy\'s query: the row\'s own URL untouched at its own size, squad=N in place of squad4 otherwise; reads back to that size; other flags ride; a quit drops it', bad.slice(0, 4).join(' · ') || `${same} at the mission's own size, ${changed} changed · e.g. ${L.squadSearch(pickSearch(SCENARIOS[2], ''), 3, 4)}`); }
  { const st = memStore(), e = SCENARIOS.find((x: any) => x.id === 'depot-four');
    const a = L.startSize(e, st); L.storeSquad(e.id, 1, st); const b = L.startSize(e, st), other = L.startSize(SCENARIOS[0], st);
    st.setItem(L.LOADOUT_LS, '{"squad":{"depot-four":7},"kit":{"keep":1}}'); const c = L.startSize(e, st); L.storeSquad(e.id, 3, st); const kept = JSON.parse(st.getItem(L.LOADOUT_LS)!);
    st.setItem(L.LOADOUT_LS, 'not json'); const d = L.startSize(e, st);
    verdict(a === 4 && b === 1 && other === SCENARIOS[0].squad && c === 4 && d === 4 && kept.kit?.keep === 1 && kept.squad['depot-four'] === 3, `the store (${L.LOADOUT_LS}): a mission opens on what was deployed last, missions apart, junk read as nothing, another part's keys kept`, `fresh ${a} · after deploying 1: ${b} (another mission: ${other}) · a stored 7: ${c} · unreadable: ${d} · kept ${JSON.stringify(kept)}`); }
  return done();
}

// ───────────────────────────────────────────────────────────── loadout-screen ─────────────────────────────────────────────────────────────
export async function loadoutScreen(): Promise<boolean> {
  const { verdict, done } = family('loadout-screen: the real screen on a fake DOM');
  const UI = await import(`${ROOT}/src/ui/loadout.ts`); const realCard = (await import(`${ROOT}/src/ui/kitCard.ts`)).memberCard;
  const G = globalThis as any; const hadLS = 'localStorage' in G, prevLS = G.localStorage; const st = memStore(); G.localStorage = st;
  try {
    for (const id of ['night-breach', 'depot-four', 'rescue-registry']) {
      const e = SCENARIOS.find((x: any) => x.id === id);
      await withDom('?quality=low', async () => {
        st.m.clear(); K.kitLoad(null, '?noslots'); K.kitReset();   // (the free rows: this probe holds the screen's own rows and keys; under the pouches rule it has one row more, the Squad kit — the pouches family drives that one, pouch-wall)
        const host = new El('BODY') as any; const deployed: [string, number][] = []; let backs = 0; const cards: number[] = [];
        UI.loadoutHooks.memberCard = (h: any, i: number, o: any) => { cards.push(i); return realCard(h, i, o); };
        const S = UI.openLoadout(e, { host, deploy: (s: string, n: number) => deployed.push([s, n]), back: () => backs++ });
        const slots = () => host.all((x: El) => x.cls.has('lo-slot')), inSlots = () => slots().filter((x: El) => x.cls.has('in')).length, one = (c: string, from: any = host) => from.all((x: El) => x.cls.has(c))[0] as El | undefined;
        const kitHosts = () => host.all((x: El) => x.cls.has('lo-kit')), sums = () => slots().map((x: El) => one('lo-sum', x)?.textContent ?? '');
        const lit = () => host.all((x: El) => x.cls.has('lo-size') && x.cls.has('on')).map((x: El) => x.attrs['data-squad']).join(',');
        verdict(S.squad === e.squad && lit() === String(e.squad) && slots().length === 5 && inSlots() === 1 + e.squad, `${id}: opens on the mission's own size, five slots, you and ${e.squad} filled`, `size ${S.squad} · lit ${lit()} · ${slots().length} slots, ${inSlots()} filled · title '${host.all((x: El) => x.cls.has('lo-title'))[0]?.textContent}'`);
        const H = kitHosts(), kc = () => kitHosts()[0].all((x: El) => x.cls.has('kc')), su = sums();
        verdict(H.length === 1 && H[0].attrs['data-member'] === '0' && kc().length === 1 && kc()[0].attrs['data-member'] === '0' && one('kc-title')?.textContent === 'You' && cards.join(',') === '0' && S.member === 0 && !!S.card && su.every((t: string, i: number) => t === (i <= e.squad ? K.kitWords(i) : '')),
          `${id}: one [data-member] host under the slots holds the picked member's real kit card (you, at first); every man who comes has his kit in a line on his slot`, `host data-member ${H[0]?.attrs['data-member']} · card '${one('kc-title')?.textContent}' · memberCard called for ${cards.join(', ')} · slot 1: '${su[1]}'`);
        const poolText = () => one('lo-pool')?.textContent ?? '', p0 = poolText(), P0 = S.pool();
        verdict(p0 === `Squad carries · ${K.kitPool(e.squad).bangs} stun · ${K.kitPool(e.squad).charges} charges · ${K.kitPool(e.squad).frags} frags` && P0.bangs === 3 && P0.charges === 2 && P0.frags === 2, `${id}: the squad's count is on the screen: as issued, the game's three and two`, `'${p0}'`);
        // keys: D D A, the stepper, a size button, a slot
        const walk: string[] = []; const rec = (what: string) => walk.push(`${what}→${S.squad}`);
        S.key('KeyA'); rec('A'); S.key('ArrowLeft'); rec('←'); S.key('KeyA'); rec('A'); S.key('KeyA'); rec('A'); S.key('KeyA'); rec('A');   // down to solo and no further
        const solo = S.squad === 0 && inSlots() === 1, poolSolo = poolText();
        S.key('KeyD'); rec('D'); const poolOne = poolText(); S.key('ArrowRight'); rec('→'); const two = S.squad;
        host.all((x: El) => x.attrs['data-step'] === '1')[0].onclick!(); rec('▶'); const three = S.squad;
        host.all((x: El) => x.attrs['data-squad'] === '4')[0].onclick!(); rec('+4'); const four = S.squad, names4 = slots().map((x: El) => x.all((y: El) => y.cls.has('lo-name'))[0].textContent).join(', ');
        slots()[2].onclick!(); rec('slot 2'); const picked = S.member, still4 = S.squad, cardName = one('kc-title')?.textContent, hostM = kitHosts()[0].attrs['data-member'], pickCls = slots().map((x: El) => (x.cls.has('pick') ? '■' : '□')).join('');
        host.all((x: El) => x.attrs['data-squad'] === '1')[0].onclick!(); rec('+1'); const oneN = S.squad, clamped = S.member, name1 = one('kc-title')?.textContent;
        slots()[3].onclick!(); rec('slot 3'); const three2 = S.squad;
        verdict(solo && two === 2 && three === 3 && four === 4 && inSlots() === 4 && names4 === 'You, Red One, Red Two, Blue One, Blue Two', `${id}: A / D and the arrows step the size and stop at the ends; the stepper and a size button set it; the slots show the roster`, `${walk.join(' ')} · at four: ${names4}`);
        verdict(picked === 2 && still4 === 4 && cardName === 'Red Two' && hostM === '2' && pickCls === '□□■□□' && oneN === 1 && clamped === 1 && name1 === 'Blue One' && three2 === 3,
          `${id}: a click on a filled slot picks that man (his card under the slots, by the name this size gives him); a smaller team keeps a man who still comes picked; a click on an empty slot brings the team up to it`, `slot 2 at four: member ${picked}, card '${cardName}', picks ${pickCls} · +1: member ${clamped}, card '${name1}' · empty slot 3: size ${three2}`);
        verdict(poolSolo === '' && poolOne === 'Squad carries · 2 stun · 1 charge · 1 frag', `${id}: alone there is no squad count; one man carries his own two and one`, `solo '${poolSolo}' · one '${poolOne}'`);
        // W S move the highlight: team → members → the card → the buttons (and wrap)
        const sel = () => S.rows.map((r: any) => (r.el.cls.has('sel') ? '■' : '□')).join(''); const s0 = sel(); S.key('KeyS'); const s1 = sel(); S.key('KeyW'); const s2 = sel(); S.key('ArrowUp'); const s3 = sel(); S.key('ArrowDown');
        verdict(S.rows.length === 4 && s0 === '■□□□' && s1 === '□■□□' && s2 === '■□□□' && s3 === '□□□■' && sel() === '■□□□', `${id}: W S / ↑ ↓ move the highlight between the rows (and wrap)`, `${s0} S ${s1} W ${s2} ↑ ${s3} ↓ ${sel()}`);
        // into a card by the keys: S (members) D D (member 2) Enter (his card, top row) S (suppressor) D (off) — the table, his slot's line, nothing else
        S.key('KeyS'); S.key('KeyD'); S.key('ArrowRight'); S.key('KeyA'); const m2 = S.member; S.key('Enter'); const inCard = sel(), at0 = S.card.at(), focus0 = kc()[0].cls.has('focus');
        const supAt = K.kitRows(2).findIndex((r: any) => r.field === 'suppressed');   // (the row under his gun — or his two guns: a card with a Primary and a Secondary has it one lower)
        for (let n = 0; n < supAt; n++) S.key('KeyS'); const at1 = S.card.at(); S.key('KeyD'); const sup = (K.KIT.members[2] as any).suppressed, sum2 = sums()[2], squadNow = S.squad;
        S.key('Enter'); const sup2 = (K.KIT.members[2] as any).suppressed; S.key('Enter', true); const held = (K.KIT.members[2] as any).suppressed;   // (Enter in a card is the row's next value, not Deploy; held, nothing)
        verdict(m2 === 2 && inCard === '□□■□' && at0 === 0 && focus0 && supAt >= 1 && at1 === supAt && sup === false && /AKS-74U/.test(sum2) && squadNow === 3 && sup2 === true && held === true && deployed.length === 0,
          `${id}: by the keys alone — S to the members, A / D to a man, Enter into his card, S to a row, D changes it: the table and his slot's line follow; Enter in a card steps the row and deploys nothing`, `member ${m2} · rows ${inCard} · card row ${at0} → ${at1} · suppressor ${sup} ('${sum2}') → Enter ${sup2}`);
        // stun canisters on member 1's card move the squad's count on the screen (S down to the row, A: one fewer is legal whatever the pouches cost)
        for (let n = 0; n <= supAt; n++) S.key('KeyW'); const backOnMembers = sel(); S.key('KeyA'); S.key('KeyS'); for (let n = 0; n < 12 && K.kitRows(1)[S.card.at()]?.field !== 'bangs'; n++) S.key('KeyS'); const row = K.kitRows(1)[S.card.at()].field; S.key('KeyA'); const poolUp = poolText(), b1 = (K.KIT.members[1] as any).bangs;
        // on down the card: past its last row (the sets) S walks on to the buttons; W from there comes back onto the sets
        for (let n = 0; n < 16 && S.card.at() < K.kitRows(1).length; n++) S.key('KeyS'); /* (however many rows the card has under the canisters) */ const onSets = S.card.at(); S.key('KeyS'); const onButtons = sel(); S.key('KeyW'); const backInCard = sel(), atSets = S.card.at(); S.key('KeyS');
        verdict(backOnMembers === '□■□□' && row === 'bangs' && b1 === 1 && poolUp === 'Squad carries · 2 stun · 2 charges · 2 frags' && S.pool().bangs === 2 && onSets === K.kitRows(1).length && onButtons === '□□□■' && backInCard === '□□■□' && atSets === K.kitRows(1).length,
          `${id}: W off the top of a card is the members row again; a stun canister fewer on a man's card is one fewer on the squad's count (one MORE costs a pouch: the pouches family's); S off the card's last row is the buttons, W from them the card's last row`, `W W ${backOnMembers} · member 1 '${row}' → ${b1}: '${poolUp}' · card row ${onSets}, S ${onButtons}, W ${backInCard} (row ${atSets})`);
        K.kitReset(); S.card.refresh(); S.paint();
        S.key('Enter'); const want = L.squadSearch(pickSearch(e, '?quality=low'), 3, e.squad);
        verdict(deployed.length === 1 && deployed[0][0] === want && deployed[0][1] === 3 && !S.open && host.all((x: El) => x.cls.has('lo')).length === 0 && specOfQuery(want)?.squad === 3 && L.readLoadout(st).squad[e.id] === 3, `${id}: Enter deploys the size shown — its query, the screen gone, the pick remembered`, `deploy('${deployed[0]?.[0]}', ${deployed[0]?.[1]}) · stored ${JSON.stringify(L.readLoadout(st).squad)}`);
        // again: opens on what was deployed; Esc backs out with nothing deployed; Space on Back the same
        const S2 = UI.openLoadout(e, { host, deploy: (s: string, n: number) => deployed.push([s, n]), back: () => backs++ }); const opened = S2.squad;
        S2.key('Escape'); const S3 = UI.openLoadout(e, { host, deploy: (s: string, n: number) => deployed.push([s, n]), back: () => backs++ }); S3.key('KeyW'); S3.key('KeyA'); S3.key('Space');
        const S5 = UI.openLoadout(e, { host, deploy: (s: string, n: number) => deployed.push([s, n]), back: () => backs++ }); S5.key('KeyS'); S5.key('KeyS'); S5.key('KeyS'); const deep = S5.card.at(); S5.key('Escape');   // (Esc from inside a card: back one screen)
        verdict(opened === 3 && deployed.length === 1 && backs === 3 && !S2.open && !S3.open && deep === 1 && !S5.open && UI.loadoutOpen() === null, `${id}: it opens on the size deployed last; Esc backs out — from inside a card too — and so does Space on Back: nothing deployed`, `opened on ${opened} · ${deployed.length} deploy · ${backs} backs`);
        // at the mission's own size the query is the row's own
        const S4 = UI.openLoadout(e, { host, squad: e.squad, deploy: (s: string, n: number) => deployed.push([s, n]) }); S4.deploy();
        verdict(deployed[1]?.[0] === pickSearch(e, '?quality=low'), `${id}: at its own size Deploy loads exactly the row's own URL`, `${deployed[1]?.[0]}`);
      });
    }
    // a greyed size that cannot stage (none is today — a row's `only` is another rule: one is made for the check)
    await withDom('', async () => {
      const e = SCENARIOS.find((x: any) => x.id === 'night-breach'); st.m.clear(); L.CANNOT['night-breach'] = { 4: 'four do not fit this check' };
      try { const host = new El('BODY') as any, S = UI.openLoadout(e, { host, deploy: () => {} });
        const b4 = host.all((x: El) => x.attrs['data-squad'] === '4')[0]; S.setSquad(3); S.key('KeyD'); const stays = S.squad; b4.onclick!(); const note = host.all((x: El) => x.cls.has('lo-note'))[0];
        verdict(stays === 3 && S.squad === 3 && b4.cls.has('off') && note.textContent === 'four do not fit this check' && note.cls.has('off'), 'a size a mission cannot stage is greyed: no key, button or slot picks it, and the line says why', `at 3, D → ${stays}, a click on +4 → ${S.squad} · '${note.textContent}'`); S.back(); }
      finally { delete L.CANNOT['night-breach']; }
    });
    // ONE FLOW: a pick on the mission list is this screen (the list closed first), Deploy loads the list's own URL for the row — Hard riding on it — with the
    // size on it, Back / Esc is the list again on the same row; the solo night comes through too, greyed at solo; ?loadout=<mission id> opens it
    await withDom('?mute', async () => {
      const G2 = globalThis as any, body = new El('BODY') as any; G2.document.body = body; st.m.clear();
      const M = await import(`${ROOT}/src/ui/missions.ts`), { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
      const loads: string[] = []; G2.location.pathname = '/'; G2.location.hash = ''; G2.location.assign = (u: string) => { loads.push(u); }; G2.location.reload = () => { loads.push('(reload)'); };
      const was = { pick: M.MISSIONS.onPick, label: M.MISSIONS.pickLabel };
      try {
        UI.wireMissions();
        const list = M.openMissions({ select: 'depot-four' }); list.difficulty('hard'); const href = list.hrefOf(list.selected), foot = list.root.all((x: El) => x.cls.has('mfoot'))[0]?.textContent ?? '', btn = list.root.all((x: El) => x.cls.has('mgo'))[0]?.textContent ?? '';
        M.missionsKey({ code: 'Enter' }); const S = UI.loadoutOpen(), listShut = M.currentMissions() === null;
        const own = S?.search(); S?.setSquad(1); const one = S?.search(); S?.deploy();
        verdict(listShut && S?.entry.id === 'depot-four' && own === href && /difficulty=hard|[?&]hard\b/.test(href) && loads.length === 1 && loads[0] === '/' + one && /squad=1/.test(loads[0]) && !/squad4/.test(loads[0]) && /levelFile=depot\.json&roomclear/.test(loads[0]) && /difficulty=hard/.test(loads[0]) && /loadout/.test(foot) && /Loadout/.test(btn) && UI.loadoutOpen() === null,
          'a pick on the mission list (Enter) closes the list and opens that mission\'s loadout; at its own size Deploy would load the list\'s own URL, Hard on it; with one man it loads that URL and squad=1', `list href ${href} · own ${own} · loaded ${loads.join(' ')} · list button '${btn}'`);
        // Esc steps back one screen: loadout → the list on the same row → the start card (the list closed)
        M.openMissions({ select: 'compound-four' }); M.missionsKey({ code: 'Space' }); const S2 = UI.loadoutOpen(); S2?.key('KeyS'); S2?.key('KeyS'); S2?.key('Escape');
        const back = M.currentMissions(), backOn = back?.selected.id, loShut = UI.loadoutOpen() === null; M.missionsKey({ code: 'Escape' }); const allShut = M.currentMissions() === null;
        verdict(S2?.entry.id === 'compound-four' && loShut && backOn === 'compound-four' && allShut && loads.length === 1, 'Esc on the loadout (from inside a kit card too) is the mission list again, on the same row; Esc there closes the list: nothing loaded', `back on ${backOn} · loads ${loads.length}`);
        // the solo night: your own card, no teammates offered, Deploy loads ?solo
        const solo = M.openMissions({ select: 'solo-night' }); const soloHref = solo.hrefOf(solo.selected); solo.pick(); const S3 = UI.loadoutOpen();
        const greyed = [1, 2, 3, 4].every(n => S3?.root.all((x: El) => x.attrs['data-squad'] === String(n))[0]?.cls.has('off')), refused = [1, 2, 3, 4].every(n => S3?.setSquad(n) === false), noteS = S3?.root.all((x: El) => x.cls.has('lo-note'))[0]?.textContent ?? '';
        S3?.key('KeyD'); const still = S3?.squad, cardOf = S3?.root.all((x: El) => x.attrs['data-row'] === 'kit')[0]?.attrs['data-member'], poolS = S3?.root.all((x: El) => x.cls.has('lo-pool'))[0]?.textContent ?? '';
        S3?.deploy();
        verdict(S3?.entry.kind === 'solo' && S3?.entry.id === 'solo-night' && greyed && refused && still === 0 && cardOf === '0' && poolS === '' && soloHref === '?solo&mute' && loads[1] === '/?solo&mute',
          'the solo night goes through the loadout too: every size but solo is greyed with the reason, your own card is the one mounted, no squad count, and Deploy loads ?solo with the visitor\'s flags', `'${noteS}' · card of member ${cardOf} · loaded ${loads[1]}`);
        // … and off the real start card over the plain night (MISSIONS.startSolo up) the solo night's Deploy is the card's Start: no load, and the card is to be worn
        { const QFS = (await import(`${ROOT}/src/game/quietfog.ts`)).QUIETFOG, soloFogWas = QFS.solo; QFS.solo = false;   // (QUIETFOG.solo down for this one: under the fog the solo night off a plain page is a load of its own link — solofog-check.ts; here, the start as it was)
          let starts = 0; M.MISSIONS.startSolo = () => { starts++; }; const n0 = loads.length; M.openMissions({ select: 'solo-night' }).pick(); UI.loadoutOpen()?.deploy(); const worn = K.KIT_SOLO.on; K.KIT_SOLO.on = false; M.MISSIONS.startSolo = null; QFS.solo = soloFogWas;
          verdict(starts === 1 && loads.length === n0 && worn && UI.loadoutOpen() === null, 'off the start card over the plain night the solo night\'s Deploy is Start itself — no page load — and the kit is flagged to go on the player', `starts ${starts} · loads ${loads.length - n0} · KIT_SOLO ${worn}`); }
        // one screen at a time: the list opening closes a loadout that is up (nobody's Back called), a loadout opening closes the list; closeMissions takes both down
        { const A = UI.loadoutForMission(M.missionList()[2]); const L2 = M.openMissions(); const aShut = !A.open && UI.loadoutOpen() === null && M.currentMissions() === L2; const B = UI.loadoutForMission(M.missionList()[3]); const lShut = M.currentMissions() === null && UI.loadoutOpen() === B;
          const C = UI.loadoutForMission(M.missionList()[4]); const bShut = !B.open && M.currentMissions() === null && UI.loadoutOpen() === C; const busy = M.missionsBusy(); M.closeMissions(); const gone = UI.loadoutOpen() === null && !M.missionsBusy();
          verdict(aShut && lShut && bShut && busy && gone, 'one screen at a time over the card: the list opening closes the loadout, a loadout opening closes the list (and an older loadout, without reopening the list under it); closeMissions takes down whichever is up', `list over loadout ${aShut} · loadout over list ${lShut} · loadout over loadout ${bShut} · busy ${busy} · both gone ${gone}`); }
        const Q = UI.loadoutFromQuery('?loadout=rescue-registry&squad=1'), qOn = Q?.entry.id, qN = Q?.squad; Q?.back(); const qBack = M.currentMissions()?.selected.id; M.closeMissions();
        const none = UI.loadoutFromQuery('?loadout=nope'), QS = UI.loadoutFromQuery('?loadout=solo-night'), qs = QS?.entry.kind; QS?.back(); M.closeMissions();
        verdict(qOn === 'rescue-registry' && qN === 1 && qBack === 'rescue-registry' && none === null && qs === 'solo', '?loadout=<mission id> opens that mission\'s screen (squad=N beside it preselects), its Back is the list on that row; an unknown id opens nothing', `${qOn} at ${qN}, back on ${qBack} · unknown → ${none} · solo-night → ${qs}`);
      } finally { UI.loadoutOpen()?.back(); M.closeMissions(); M.MISSIONS.onPick = was.pick; M.MISSIONS.pickLabel = was.label; setDifficulty('standard', false); }
    });
  } finally { UI.loadoutHooks.memberCard = realCard; K.kitLoad(null, ''); K.kitReset(); if (hadLS) G.localStorage = prevLS; else delete G.localStorage; }
  return done();
}

// ───────────────────────────────────────────────────────────── loadout-stage ─────────────────────────────────────────────────────────────
interface Cell { e: any; n: number; own: boolean; ok: boolean; note: string; r: BootReport | null; ref?: BootReport; bad: string[] }
async function stageAll(only?: string[]): Promise<Cell[]> {
  const cells: Cell[] = [];
  for (const e of SCENARIOS) if (!only || only.includes(e.id)) for (const c of L.squadChoices(e)) cells.push({ e, n: c.n, own: c.own, ok: c.ok, note: c.note, r: null, bad: [] });
  const jobs = Math.max(1, Math.min(4, Number(process.env.LOADOUT_JOBS ?? 4)));
  await pool(cells, jobs, async c => {
    const own = scenarioQuery(c.e) as string, q = c.own ? own.replace(/&squad4\b/, '') + `&squad=${c.n}` : L.squadSearch(own, c.n, c.e.squad);   // (its own size too is booted BY squad=N: the row's own URL is the reference below)
    c.r = await bootChild(q); if (c.own) c.ref = await bootChild(own);
    const r = c.r, bad = c.bad, lf = c.e.level ?? null;
    if (r.threw) { bad.push(`threw: ${r.threw}`); return; }
    // (a row with `only` — scenarios.ts ScenarioEntry — greys every size but its own BY DESIGN, a mission built for one size as a Training row is, and says such
    //  a size still stages from a URL: that is what is held of it here. Every other greyed size is a claim that it CANNOT stage)
    if (!c.ok && c.e.only && c.note === c.e.only) { if (r.why || r.start.ops.length !== c.n) bad.push(`greyed by the row's own-size rule, which still stages — but ${r.why ? `refused: ${r.why}` : `${r.start.ops.length} teammates came`}`); return; }
    if (!c.ok) { if (!r.why && r.start.ops.length === c.n) bad.push('greyed on the screen, but it stages'); return; }
    if (r.why) { bad.push(`refused: ${r.why}`); return; }
    if (r.errors.length) bad.push(`console errors: ${r.errors.slice(0, 2).join(' | ')}`);
    const want = c.e.kind === 'rescue' && c.n <= 2 ? L.rosterOf(c.n).map((m: any) => `${m.name}/null`) : L.rosterOf(c.n).map((m: any) => `${m.name}/${m.pair}`);   // (the rescue's pair is in no pair of the order menu's, as ever)
    for (const [when, s] of [['staged', r.start], ['restarted', r.restart]] as [string, Shot][]) {
      if (s.active !== c.e.kind) bad.push(`${when}: ${s.active} is up, not ${c.e.kind}`);
      if (s.ops.length !== c.n) bad.push(`${when}: ${s.ops.length} teammates, not ${c.n}`);
      if (s.ops.map(m => `${m.name}/${m.pair}`).join() !== want.join()) bad.push(`${when}: ${s.ops.map(m => `${m.name}/${m.pair}`).join(', ') || 'nobody'} — the roster is ${want.join(', ') || 'nobody'}`);
      if (s.ops.some((m, i) => !m.alive || (m.blocked && !(c.e.kind === 'rescue' && i < 2)))) bad.push(`${when}: a man is down or stands in something`);   // (the rescue's first two marks are its shipped stack against the wall — a blocked nav cell at ec3a2ec too; the men a size adds must stand on free floor)
      for (let i = 0; i < s.ops.length; i++) for (let j = i + 1; j < s.ops.length; j++) if (Math.hypot(s.ops[i].pos[0] - s.ops[j].pos[0], s.ops[i].pos[2] - s.ops[j].pos[2]) < 0.6) bad.push(`${when}: ${s.ops[i].name} and ${s.ops[j].name} stand in each other`);
      if (s.team !== teamWords({ squad: c.n })) bad.push(`${when}: the pause card says '${s.team}'`);
      if (s.title !== c.e.title && !(SCENARIOS.some((x: any) => x !== c.e && x.kind === c.e.kind && (x.level ?? null) === lf))) bad.push(`${when}: the pause card names it '${s.title}'`);
      if (c.e.kind !== 'rescue') { const drill = s.plan && c.n >= 2; if (s.drill !== drill || s.noDrill !== !drill) bad.push(`${when}: F's drill ${s.drill ? 'exists' : 'does not'} with ${c.n} on a level ${s.plan ? 'with' : 'without'} a breach plan`); }
      if ((c.e.kind === 'rescue' ? s.knobRS : s.knobNB) !== c.n) bad.push(`${when}: knobs ${s.knobNB} / ${s.knobRS}`);
      if (s.ordersActive !== c.n > 0) bad.push(`${when}: the order menu is ${s.ordersActive ? 'live' : 'off'} with ${c.n}`);
    }
    if (r.start.hostiles < 1) bad.push('nobody holds the floor');
    if (r.after.active !== c.e.kind || r.after.ops.length !== c.n) bad.push(`after ten seconds: ${r.after.active}, ${r.after.ops.length} men`);
    for (let i = 0; i < c.n; i++) if (r.restart.ops[i] && Math.hypot(r.restart.ops[i].pos[0] - r.start5.ops[i].pos[0], r.restart.ops[i].pos[2] - r.start5.ops[i].pos[2]) > 0.05) bad.push(`a restart stands ${r.start5.ops[i].name} elsewhere`);   // (five frames into each: the office rescue's second mark is in a wall's margin and the man is eased out of it, at ec3a2ec too)
    if ((!r.won && !(c.e.kind === 'nightbreach' && c.n >= 2)) || (c.e.kind === 'roomclear' && !/^taken/.test(r.won ?? '')) || (c.e.kind === 'rescue' && !/^rescued/.test(r.won ?? '')) || (c.e.kind === 'nightbreach' && c.n < 2 && !/clear/.test(r.won ?? ''))) bad.push(`every defender down, and it ends '${r.won}'`);
    if (c.n === 0 && c.e.kind === 'roomclear' && !/alone/.test(r.won ?? '')) bad.push(`alone, and the end reads '${r.won}'`);
    if (r.quit.active !== null || r.quit.ops.length || r.quit.knobNB !== 2 || r.quit.knobRS !== 2) bad.push(`after a quit: ${r.quit.active}, ${r.quit.ops.length} men, knobs ${r.quit.knobNB} / ${r.quit.knobRS}`);
    if (c.ref) { const a = r.start.ops.map(m => `${m.name}@${f2(m.pos[0])},${f2(m.pos[2])}`).join(' '), b = c.ref.start?.ops.map(m => `${m.name}@${f2(m.pos[0])},${f2(m.pos[2])}`).join(' ');
      const a2 = r.after.ops.map(m => `${m.name}@${f2(m.pos[0])},${f2(m.pos[2])}`).join(' '), b2 = c.ref.after?.ops.map(m => `${m.name}@${f2(m.pos[0])},${f2(m.pos[2])}`).join(' ');
      if (a !== b || a2 !== b2 || r.start.hostiles !== c.ref.start?.hostiles) bad.push(`its own size by squad=${c.n} is not the row's own URL: ${a} / ${b}`); }
  });
  return cells;
}
export async function loadoutStage(): Promise<boolean> {
  const { verdict, done } = family('loadout-stage: every scenario at every size, each a page load of its own');
  const cells = await stageAll(process.env.LOADOUT_ONLY?.split(','));
  for (const e of SCENARIOS) { const row = cells.filter(c => c.e === e); if (!row.length) continue;
    const bad = row.filter(c => c.bad.length);
    verdict(!bad.length, `${e.id} (${e.kind}${e.level ? ', ' + e.level : ''}; own ${e.squad}): sizes 0‥4`, bad.length ? bad.map(c => `[${c.n}] ${c.bad.slice(0, 3).join(' · ')}`).join('\n    ')
      : row.map(c => `${c.n}${c.own ? '*' : ''}: ${!c.ok ? `greyed (${c.note})` : `${c.r!.start.ops.map(m => m.name).join(', ') || 'alone'}${e.kind !== 'rescue' ? (c.r!.start.drill ? ' · F drill' : ' · no drill') : ''}`}`).join(' | ') + ` · ${row[0].r!.start.hostiles} hold the floor`); }
  { const lines = [...new Set(cells.filter(c => c.r?.start?.line && (c.n < 2)).map(c => `${c.n}: ${c.r!.start.line.replace(/^.*?\. /, '').slice(0, 60)}`))].slice(0, 6);
    console.log(`    (the staging's line with fewer than two: ${lines.join(' · ')})`); }
  return done();
}

if (import.meta.main && !process.argv.includes('--boot')) {
  if (process.argv.includes('--table')) {
    const cells = await stageAll(process.env.LOADOUT_ONLY?.split(','));
    console.log('| scenario | kind · level | 0 | 1 | 2 | 3 | 4 |\n|---|---|---|---|---|---|---|');
    for (const e of SCENARIOS) { const row = cells.filter(c => c.e === e); if (!row.length) continue;
      console.log(`| ${e.title} | ${e.kind} · ${e.level ?? 'office'} | ${row.map(c => (c.bad.length ? `FAILS: ${c.bad[0]}` : !c.ok ? `greyed: ${c.note}` : `${c.own ? '**own** ' : ''}works${e.kind !== 'rescue' ? (c.r!.start.drill ? ', F drill' : ', no F drill') : ''}`)).join(' | ')} |`); }
    process.exit(cells.some(c => c.bad.length) ? 1 : 0);
  }
  const ok = [await loadoutPure(), await loadoutScreen(), await loadoutStage()].every(Boolean);
  process.exit(ok ? 0 : 1);
}
