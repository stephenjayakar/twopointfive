// QUIET MISSIONS UNDER THE FOG OF WAR (src/game/quietfog.ts — the fog lever's rungs on a quiet mission's row, asked here with off as the default: QUIETFOG.def 'off'), all headless:
//   bun run tools/qa/quietfog-check.ts            (probes.ts quietfog, also under `fog` and `quiet`; QUIETFOG_BREAK=1 = the switch left off: must fail)
// The maintainer, 10-11: "stealth missions don't have fog of war" · "i think we should make it part of the fog of war difficulty slider".
//   rules     the query rule with the switch off (nothing reads a rung) and on (a quiet mission's link with a rung is played under the fog; a rung nobody
//             knows, a Training lesson, ?nofow and a mission that is not quiet are as they were)
//   links     the pick is this machine's own (its own key, never the squad lever's store), a quiet mission's link carries it, no other link does, a stale
//             rung is taken off a link, the switch's own quietfog=0 stays
//   screens   the real mission sheet and loadout on a fake DOM: a quiet row's fog lever is live with four rungs lit on 'off'; a press moves the quiet pick
//             alone and that row's link follows; a squad row never shows the off rung and keeps the squad lever; a Training lesson stays greyed
//   runs      a quiet mission alone and as two, at each rung: the fog on, the fog's two rows as the rung says, the right eyes, men out of sight left out of
//             the picture and a man beside the player in it; quit puts the rows back (over a kept squad lever too); ?fogown on the URL speaks over the
//             rung; no rung = the run as it was by digest, switch on or off; alone, a checkpoint saved under the fog loads under it
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself and holds QUIETFOG.def at 'off' (the rungs as a pick over all shown). Nothing here looks at a picture.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const QF = await import(`${ROOT}/src/game/quietfog.ts`);
const D = await import(`${ROOT}/src/game/difficulty.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { fogOfQuery, quietRungOfQuery, startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const SAVE = await import(`${ROOT}/src/game/savestate.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
const { threeLevers } = await import('./told-check.ts');   // (the fourth lever and the squad's fog-off rung are held down here: these lines count three levers — told-check.ts has them up)
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const J = (o: unknown) => JSON.stringify(o), DT = 1 / 60;
const Q = (s: string) => new URLSearchParams(s);
const fog = () => `${FOG.cone ? 'cone' : 'round'}${FOG.own ? '+own' : ''}`;
/** a store for the length of `fn`, the process's own put back after */
async function withStore<T>(init: Record<string, string>, fn: (m: Map<string, string>) => Promise<T> | T): Promise<T> {
  const G = globalThis as any, had = 'localStorage' in G, prev = G.localStorage, m = new Map(Object.entries(init));
  G.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
  try { return await fn(m); } finally { if (had) G.localStorage = prev; else delete G.localStorage; }
}
/** the modules as a fresh page finds them: standard, no lever moved, no quiet pick read, nothing held */
function fresh() { QF.quietFogEnd(); D.difficultyHere(''); D.setConeVisit(null); D.setDifficulty('standard', false); FOG.own = false; QF.quietFogForget(); }
async function stand(seed: number, file: string) {
  Math.random = seeded(0x51ed + seed * 7919);
  return await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) })) as any;
}
const steps = (W: any, n: number) => { for (let i = 0; i < n; i++) W.step(DT); };

// the lever rows of a screen as the stand-in DOM holds them, and a press on one rung
const rowsOf = (root: El) => root.all(e => !!e.attrs['data-lever']).map(r => { const btns = r.all(e => e.tagName === 'BUTTON'); return { key: r.attrs['data-lever'], na: r.cls.has('na'), moved: r.cls.has('moved'), btns,
  shown: btns.filter(b => (b as any).style.display !== 'none').map(b => b.attrs['data-rung']).join(','), lit: btns.filter(b => b.cls.has('on') && (b as any).style.display !== 'none').map(b => b.attrs['data-rung']).join(','), note: r.all(e => e.tagName === 'SPAN').at(-1)?.textContent ?? '' }; });
const press = (root: El, key: string, rung: string) => { const b = rowsOf(root).find(r => r.key === key)?.btns.find(b => b.attrs['data-rung'] === rung); if (!b?.onclick) throw new Error(`no ${key}:${rung} button`); b.onclick(); };

export const quietfogCheck = (): Promise<boolean> => threeLevers(quietfogCheck3);
async function quietfogCheck3(): Promise<boolean> {
  const F = family('quietfog: a quiet mission can be played under the fog of war — the fog lever\'s rungs, asked with all shown as where a quiet mission starts');
  const BREAK = process.env.QUIETFOG_BREAK === '1', onWas = QF.QUIETFOG.on, defWas = QF.QUIETFOG.def, soloWas = QF.QUIETFOG.solo, ownWas = FOG.own, rnd = Math.random;
  // the rungs are asked with the bottom rung as the quiet missions' default, as they were written (QUIETFOG.def 'off': the frozen stand's); the page's own default — the fog all round — is sticky-check.ts's `default` family
  const raise = () => { QF.QUIETFOG.on = !BREAK; QF.QUIETFOG.def = 'off'; QF.QUIETFOG.solo = false; };   // (…and the solo night with no fog, as these rows were written: its own rule is solofog-check.ts)
  try {
    // ───────────────────────────── rules
    { QF.QUIETFOG.on = false; QF.QUIETFOG.def = 'off'; fresh();
      const off = await withStore({ 'twopointsix.quietfog': 'cones' }, () => { QF.quietFogForget(); return { fow: fogOfQuery(Q('levelFile=bazaar.json&quiet&quietfog=cones')), pick: QF.quietFog(), href: QF.quietFogHref('/?levelFile=bazaar.json&quiet', true), row: QF.quietFogRow({ kind: 'quiet' }) }; });
      F.verdict(off.fow === false && off.pick === 'off' && off.href === '/?levelFile=bazaar.json&quiet' && off.row === false, 'the switch off: a rung on a quiet link is not read, the kept pick reads off, a link comes back as it came, no row is the lever\'s', J(off));
      raise(); fresh();
      const cases: [string, boolean, string][] = [
        ['levelFile=bazaar.json&quiet', false, 'a quiet mission, no rung'], ['levelFile=bazaar.json&quiet&quietfog=team', true, 'all round'], ['levelFile=bazaar.json&quiet=3&quietfog=cones', true, 'cones'],
        ['levelFile=quiet-yard.json&quiet&squad=1&quietfog=own', true, 'own eyes, as two'], ['levelFile=bazaar.json&quiet&quietfog=off', false, 'the off rung named'], ['levelFile=bazaar.json&quiet&quietfog=thick', false, 'a rung nobody knows'],
        ['levelFile=bazaar.json&quiet&quietfog=0', false, 'the switch\'s own word'], ['levelFile=tut-quiet.json&quiet&quietfog=cones', false, 'a tutorial mission'], ['levelFile=bazaar.json&quiet&quietfog=cones&nofow', false, '?nofow beside it'],
        ['quietfog=cones', false, 'the solo night'], ['solo&quietfog=own', false, '?solo'], ['roomclear&quietfog=cones', true, 'a room clear (its own fog)'], ['nightbreach&quietfog=cones', false, 'the night breach'], ['levelFile=bazaar.json&quiet&fow', true, '?fow beside a quiet mission, as ever'],
      ];
      const got = cases.map(([q, want, name]) => ({ name, q, want, is: fogOfQuery(Q(q)) })), bad = got.filter(c => c.is !== c.want);
      const rungs = ['team', 'cones', 'own'].map(r => quietRungOfQuery(Q(`levelFile=bazaar.json&quiet&quietfog=${r}`))).join(',');
      F.verdict(bad.length === 0 && rungs === 'team,cones,own', 'the switch on: a quiet mission whose link names a rung is played under the fog; no rung, an unknown one, a Training lesson, ?nofow and every mission that is not quiet are as they were',
        got.map(c => `${c.is === c.want ? 'ok ' : 'NOT'} ${c.name}: ?${c.q} → fog ${c.is ? 'on' : 'off'}`).join('\n    ')); }
    // ───────────────────────────── links and the store
    await withStore({ 'twopointsix.levers': '{"fog":"own"}' }, store => {
      raise(); fresh(); D.initDifficulty(Q(''));
      const squadLever = `${J(D.leversSet())} fog ${fog()}`, pick0 = QF.quietFog(), bare = QF.quietFogHref('/?quality=high&levelFile=bazaar.json&quiet', true);
      QF.setQuietFog('cones'); const kept = store.get('twopointsix.quietfog'), levers = store.get('twopointsix.levers');
      const quiet = QF.quietFogHref('/?quality=high&levelFile=bazaar.json&quiet', true), squad = QF.quietFogHref('/?quality=high&roomclear&quietfog=own', false), lesson = QF.quietFogHref('/?levelFile=tut-quiet.json&quiet&quietfog=team', false);
      const stale = QF.quietFogHref('/?levelFile=bazaar.json&quiet&quietfog=own', true), zero = QF.quietFogHref('/?quietfog=0&levelFile=bazaar.json&quiet', true), only = QF.quietFogHref('/?quietfog=own', false);
      QF.quietFogForget(); const reread = QF.quietFog();
      QF.setQuietFog('off'); const gone = store.has('twopointsix.quietfog'), after = QF.quietFogHref('/?quality=high&levelFile=bazaar.json&quiet&quietfog=cones', true);
      F.verdict(pick0 === 'off' && bare === '/?quality=high&levelFile=bazaar.json&quiet' && kept === 'cones' && levers === '{"fog":"own"}' && J(D.leversSet()) === '{"fog":"own"}'
        && quiet === '/?quality=high&levelFile=bazaar.json&quiet&quietfog=cones' && squad === '/?quality=high&roomclear' && lesson === '/?levelFile=tut-quiet.json&quiet' && stale === '/?levelFile=bazaar.json&quiet&quietfog=cones'
        && zero === '/?quietfog=0&levelFile=bazaar.json&quiet&quietfog=cones' && only === '/' && reread === 'cones' && !gone && after === '/?quality=high&levelFile=bazaar.json&quiet',
        'the pick is the quiet missions\' own: a machine that keeps the squad lever on own eyes starts its quiet missions off; moved, it is kept under its own key, a quiet link carries it and no other link does, a stale rung is taken off, and off again keeps nothing',
        `squad lever ${squadLever} · quiet pick at first ${pick0} · kept '${kept}' beside levers ${levers} · quiet ${quiet} · squad ${squad} · lesson ${lesson} · stale → ${stale} · read again ${reread} · off → kept ${gone}, ${after}`);
      store.delete('twopointsix.levers'); D.initDifficulty(Q('')); fresh();
    });
    { const { quitSearch, pickSearch, QUIET_MISSIONS, SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const quit = quitSearch('?levelFile=bazaar.json&quiet&quietfog=cones&mute'), zero = quitSearch('?levelFile=bazaar.json&quiet&quietfog=0&mute'), next = pickSearch((SCENARIOS as any[])[0], '?levelFile=bazaar.json&quiet&quietfog=own&mute'), nextQ = pickSearch((QUIET_MISSIONS as any[])[0], '?roomclear&quietfog=own&mute');
      F.verdict(quit === '?mute' && zero === '?quietfog=0&mute' && !/quietfog/.test(next) && !/quietfog/.test(nextQ), 'a quit, and a pick of another mission from a quiet mission\'s page, take the rung off the link (it is one mission\'s pick, as the way in is); the rule\'s own quietfog=0 stays', `quit ${quit} · with quietfog=0: ${zero} · next mission ${next} · a bare pick of a quiet row ${nextQ}`); }
    // ───────────────────────────── screens
    await withStore({}, async store => { await withDom('?quality=high&mute', async () => {
      const G = globalThis as any; G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
      raise(); fresh();
      const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`), { QUIET_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const SEARCH = '?quality=high&mute', pickWas = M.MISSIONS.onPick; M.MISSIONS.onPick = null;
      const host = new El('DIV') as any, list: any[] = M.missionList(), four = list.find(m => m.id === 'room-clear-four'), quietM = list.find(m => m.id === 'bazaar-quiet'), twoM = list.find(m => m.id === 'quiet-yard-two'), lessonM = list.find(m => m.scenario?.group === 'tutorial' && m.scenario.kind === 'quiet');
      const S = M.openMissions({ root: host, select: quietM.id, search: SEARCH, onPick: () => { } }), root = S.root as unknown as El;
      const q0 = rowsOf(root), href0 = S.hrefOf(quietM);
      F.verdict(q0[0]?.key === 'fog' && !q0[0].na && q0[0].shown === 'off,team,cones,own' && q0[0].lit === 'off' && !q0[0].moved && /no fog of war/.test(q0[0].note) && q0.filter(r => r.key === 'ai' || r.key === 'kit').length === 2 && q0.filter(r => r.key !== 'fog' && r.key !== 'cams').every(r => r.na) && !/quietfog/.test(href0),   // (the Sticky cameras row — stickycam.ts, shown on a quiet row while STICKY is on, so on the shipped stand — is not a difficulty lever: sticky-check holds it)
        'the sheet of a quiet mission: the fog lever is live with four rungs — off, all round, cones, own eyes — lit on off, saying so; the defenders\' two levers stay greyed; the link names no rung',
        q0.map(r => `${r.key} ${r.na ? 'greyed' : 'live'} [${r.shown}] lit ${r.lit || '-'}: ${r.note}`).join('\n    ') + `\n    ${href0}`);
      press(root, 'fog', 'cones'); const q1 = rowsOf(root), href1 = S.hrefOf(quietM), go1 = root.all(e => e.cls.has('mgo'))[0]?.attrs.href, hrefTwo = twoM ? S.hrefOf(twoM) : '', hrefFour = S.hrefOf(four), hrefSolo = S.hrefOf(M.SOLO_NIGHT), hrefLesson = lessonM ? S.hrefOf(lessonM) : '';
      F.verdict(q1[0].lit === 'cones' && q1[0].moved && /cone/.test(q1[0].note) && href1 === `${href0}&quietfog=cones` && go1 === href1 && (!twoM || /quietfog=cones/.test(hrefTwo)) && !/quietfog/.test(hrefFour) && !/quietfog/.test(hrefSolo) && !/quietfog/.test(hrefLesson)
        && store.get('twopointsix.quietfog') === 'cones' && !store.has('twopointsix.levers') && J(D.leversSet()) === '{}' && fog() === 'round' && D.difficultyNow() === 'standard',
        '"cones" pressed there: the quiet pick alone moves and is kept on this machine; every quiet mission\'s link carries it, the Go link too; a squad mission\'s, the solo night\'s and a lesson\'s do not; the squad lever, the level and the fog\'s rows are untouched',
        `lit ${q1[0].lit} · kept ${store.get('twopointsix.quietfog')} · levers kept ${store.get('twopointsix.levers') ?? '(none)'} · ${href1}\n    as two: ${hrefTwo}\n    squad: ${hrefFour}\n    solo: ${hrefSolo}`);
      S.select(four.id); const s0 = rowsOf(root); press(root, 'fog', 'own'); const s1 = rowsOf(root), hrefFour1 = S.hrefOf(four), hrefQ2 = S.hrefOf(quietM);
      S.select(quietM.id); const q2 = rowsOf(root); if (lessonM) S.select(lessonM.id); const l0 = lessonM ? rowsOf(root) : [];
      F.verdict(s0[0].shown === 'team,cones,own' && s0[0].lit === 'team' && !s0[0].moved && s1[0].lit === 'own' && store.get('twopointsix.levers') === '{"fog":"own"}' && store.get('twopointsix.quietfog') === 'cones' && !/quietfog/.test(hrefFour1) && /quietfog=cones/.test(hrefQ2)
        && q2[0].lit === 'cones' && q2[0].shown === 'off,team,cones,own' && l0.every(r => r.na),
        'a squad mission\'s row never shows the off rung and its lever is the squad\'s own (lit all round with the quiet pick on cones); moved to own eyes it is kept apart, and the quiet row still reads cones; a Training lesson stays greyed',
        `squad row [${s0[0].shown}] lit ${s0[0].lit} → ${s1[0].lit} · kept levers ${store.get('twopointsix.levers')} quiet ${store.get('twopointsix.quietfog')} · back on the quiet row: lit ${q2[0].lit}${lessonM ? ` · ${lessonM.id}: ${l0.map(r => r.na ? 'greyed' : 'live').join('/')}` : ''}`);
      S.close(); D.setDifficulty('standard');
      // the loadout of a quiet mission
      const eq = (QUIET_MISSIONS as any[]).find(e => e.id === 'bazaar-quiet'), deployed: string[] = [];
      const L = UI.openLoadout(eq, { host, search: M.missionHref(quietM, SEARCH), deploy: (s: string) => deployed.push(s), back: () => { } }), lroot = L.root as unknown as El, lr = rowsOf(lroot);
      let pressed = ''; if (lr.length) { press(lroot, 'fog', 'own'); pressed = rowsOf(lroot)[0].lit; } L.deploy(); const to = deployed[0] ?? '';
      F.verdict(lr.length === 0 ? /quietfog=cones/.test(to) : lr[0].key === 'fog' && !lr[0].na && lr[0].lit === 'cones' && lr[0].shown === 'off,team,cones,own' && pressed === 'own' && /quietfog=own/.test(to) && !/quietfog=cones/.test(to) && store.get('twopointsix.quietfog') === 'own',
        'the loadout of a quiet mission: the same lever, lit on the kept pick; moved there, Deploy loads the mission under that rung', lr.length ? `lit ${lr[0].lit} → ${pressed} · deploy ${to}` : `(no lever rows on this loadout) deploy ${to}`);
      L.close?.(); QF.setQuietFog('off'); fresh(); M.MISSIONS.onPick = pickWas;
    }); });
    // ───────────────────────────── runs
    for (const [file, two] of [['bazaar.json', false], ['quiet-yard.json', true]] as [string, boolean][]) {
      const lines: string[] = []; let ok = true;
      for (const rung of ['team', 'cones', 'own'] as const) {
        raise(); fresh(); const W = await stand(3, file), g = W.game; raise();
        const before = fog(), r = await hushed(() => startFromQuery(g, `?levelFile=${file}&quiet=1${two ? '&squad=1' : ''}&quietfog=${rung}`));
        const rows = fog(), want = rung === 'team' ? 'round' : rung === 'cones' ? 'cone' : 'cone+own', held = QF.quietFogHeld(); let threw = '';
        try { steps(W, 90); } catch (e) { threw = String(e); }
        const men: any[] = g.guards.filter((x: any) => !x.unit && x.char.alive), hid = men.filter(x => g.fogOfWar.hidden(x)).length, eyes = g.fogOfWar.eyes.length, wantEyes = two && rung !== 'own' ? 2 : 1;
        // a man beside the player, in front of him with a line, is in the picture (the player turned to face him)
        let near = 'no man could be stood beside';
        { const gd = men.find(x => g.fogOfWar.hidden(x)); if (gd) { const p = gd.char.pos; let spot: [number, number, number] | null = null;
            for (let a = 0; a < 16 && !spot; a++) { const s: [number, number, number] = [p[0] + Math.cos(a * Math.PI / 8) * 1.6, 0, p[2] + Math.sin(a * Math.PI / 8) * 1.6];
              if (!g.col.nav.isBlocked(s[0], s[2]) && !g.col.segmentBlocked([s[0], 1.5, s[2]], [p[0], 1.5, p[2]], 0.05)) spot = s; }
            if (spot) { g.godMode = true; g.teleportPlayer(spot); let saw = false; try { steps(W, 2); for (let i = 0; i < 45 && !saw; i++) { W.cursorAt([gd.char.pos[0], 1.2, gd.char.pos[2]]); steps(W, 1); saw = g.fogOfWar.seen(gd) && !g.fogOfWar.hidden(gd); } } catch (e) { threw ||= String(e); }
              near = saw ? 'seen' : 'NOT seen'; } } }
        const on = g.fogOfWar.on; await hushed(() => quitScenario(g)); const afterQuit = `${fog()}${QF.quietFogHeld() ? ' HELD' : ''}${g.fogOfWar.on ? ' fog ON' : ''}`;
        const good = !r.why && on && rows === want && held && !threw && hid > 0 && eyes === wantEyes && near === 'seen' && afterQuit === before;
        ok &&= good; lines.push(`${good ? 'ok ' : 'NOT'} ${rung}: ${r.why ? `refused: ${r.why}` : `fog ${on ? 'on' : 'OFF'}`} · rows ${rows} (want ${want}) · ${eyes} eye${eyes === 1 ? '' : 's'} · ${hid} of ${men.length} men left out of the picture · the man beside him ${near}${threw ? ` · THREW ${threw}` : ''} · after quit ${afterQuit}`);
      }
      F.verdict(ok, `${file}${two ? ', as two' : ', alone'}: at each rung the mission starts under the fog, the fog's rows are the rung's, the eyes are the player's${two ? ' and his partner\'s (own eyes: his alone)' : ''}, men out of sight are left out of the picture and a man he faces from beside is in it; quit puts the rows back`, lines.join('\n    '));
    }
    // over a kept squad lever, and under a ?fogown on the URL
    { raise(); fresh(); D.setLever('fog', 'own', false); const W = await stand(4, 'bazaar.json'), g = W.game; raise(); const before = fog();
      await hushed(() => startFromQuery(g, '?levelFile=bazaar.json&quiet=1&quietfog=team')); steps(W, 30); const during = fog(), again = (D.difficultyHere(''), fog()); await hushed(() => quitScenario(g)); const after = fog();
      D.setLever('fog', null, false); fresh();
      const W2 = await stand(4, 'bazaar.json'), g2 = W2.game; raise(); FOG.own = true;   // (as ?fogown wrote it at the page's boot)
      await hushed(() => startFromQuery(g2, '?levelFile=bazaar.json&quiet=1&quietfog=team&fogown')); const over = fog(); await hushed(() => quitScenario(g2)); const overAfter = fog(); FOG.own = false;
      F.verdict(before === 'cone+own' && during === 'round' && again === 'round' && after === 'cone+own' && over === 'round+own' && overAfter === 'round+own',
        'a machine that keeps the squad lever on own eyes plays a quiet mission at ITS rung (all round), through a later write of the level\'s rows, and has its own again at the quit; ?fogown on the URL speaks over the rung',
        `squad lever own eyes: ${before} → in the quiet mission ${during} (after the level's rows are written again: ${again}) → quit ${after} · ?fogown beside quietfog=team: ${over}, after quit ${overAfter}`); }
    // the squad's lever while a rung is held: the mission sheet opened from the pause card of a quiet mission being played under the fog
    await withStore({}, async () => {
      const M = await import(`${ROOT}/src/ui/missions.ts`);
      const sheet = async (fn: (S: any, root: El, four: any) => void) => { await withDom('?levelFile=bazaar.json&quiet&quietfog=own&mute', async () => {
        const G = globalThis as any; G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
        const pickWas = M.MISSIONS.onPick; M.MISSIONS.onPick = null;
        try { const four = (M.missionList() as any[]).find(m => m.id === 'room-clear-four'), S = M.openMissions({ root: new El('DIV') as any, select: four.id, search: '?mute', onPick: () => { } }); fn(S, S.root as unknown as El, four); }
        finally { M.MISSIONS.onPick = pickWas; } }); };
      const fogRow = (root: El) => rowsOf(root).find(r => r.key === 'fog')!;
      // (a) nothing kept, the quiet mission on own eyes: the squad row lights all round; cones pressed there and Hard pressed move the squad's lever, not the mission; the quit has them
      raise(); fresh(); const W = await stand(7, 'bazaar.json'), g = W.game; raise();
      await hushed(() => startFromQuery(g, '?levelFile=bazaar.json&quiet=1&quietfog=own')); steps(W, 10); const a0 = fog(); let aLit = '', aLit2 = '', aAfter = '', aHard = '', aSet = '';
      await sheet((S, root, four) => { aLit = fogRow(root).lit; press(root, 'fog', 'cones'); aLit2 = fogRow(root).lit; aAfter = fog(); aSet = J(D.leversSet()); S.difficulty('hard'); aHard = fog(); });
      steps(W, 10); const aPlay = fog(); await hushed(() => quitScenario(g)); const aQuit = fog(); D.setLever('fog', null, false);
      // (b) the squad lever kept on own eyes, the quiet mission all round: the squad row lights own eyes; put back on all round there, the quit leaves the fog all round
      fresh(); D.setLever('fog', 'own', false); const W2 = await stand(7, 'bazaar.json'), g2 = W2.game; raise();
      await hushed(() => startFromQuery(g2, '?levelFile=bazaar.json&quiet=1&quietfog=team')); const b0 = fog(); let bLit = '', bAfter = '';
      await sheet((_S, root) => { bLit = fogRow(root).lit; press(root, 'fog', 'team'); bAfter = fog(); });
      await hushed(() => quitScenario(g2)); const bQuit = fog(); D.setLever('fog', null, false);
      // (e) the squad's AI lever kept on hard, the quiet mission on cones: the rows read as all of Hard, but the squad's level is a MIX — the sheet's D key stays
      //     dead (it would run Hard with keep and drop the kept lever), and the squad's own words read all round (the levers thread's read, 10-11)
      fresh(); D.setLever('ai', 'hard', false); const W5 = await stand(7, 'bazaar.json'), g5 = W5.game; raise();
      await hushed(() => startFromQuery(g5, '?levelFile=bazaar.json&quiet=1&quietfog=cones')); const e0 = fog(), eRaw = D.difficultyNow(); let eNow = '', eKey = false, eSet = '', eLine = '', eNote = '';
      await sheet((_S, root) => { eNow = QF.quietFogAside(D.difficultyNow); eLine = QF.quietFogAside(() => D.leversLine(true)); eNote = root.all(e => e.cls.has('dn') && !!e.parentElement?.cls.has('mdiff') && !e.parentElement.cls.has('mlever'))[0]?.textContent ?? '';
        eKey = M.missionsKey({ code: 'KeyD' }); eSet = J(D.leversSet()); });
      const ePlay = fog(); await hushed(() => quitScenario(g5)); const eQuit = fog(); D.setLever('ai', null, false);
      // (c) a cone pinned by hand before the start is the pin again at the quit; (d) `quiet` beside `roomclear` is the room clear: no rung read
      fresh(); const W3 = await stand(7, 'bazaar.json'), g3 = W3.game; raise(); D.setConeVisit(true); const c0 = fog();
      await hushed(() => startFromQuery(g3, '?levelFile=bazaar.json&quiet=1&quietfog=team')); const c1 = fog(); await hushed(() => quitScenario(g3)); const c2 = fog(); D.setConeVisit(null);
      const mixed = quietRungOfQuery(Q('roomclear&quiet&quietfog=cones'));
      fresh();
      F.verdict(a0 === 'cone+own' && aLit === 'team' && aLit2 === 'cones' && aAfter === 'cone+own' && aHard === 'cone+own' && aPlay === 'cone+own' && aQuit === 'cone'
        && b0 === 'round' && bLit === 'own' && bAfter === 'round' && bQuit === 'round'
        && e0 === 'cone' && eRaw === 'hard' && eNow === 'custom' && /^your own mix/.test(eNote) && /all round/.test(eNote) && /"ai":"hard"/.test(eSet) && /all round/.test(eLine) && !/cones/.test(eLine) && ePlay === 'cone' && eQuit === 'round' && c0 === 'cone' && c1 === 'round' && c2 === 'cone' && mixed === 'off',
        'the mission sheet opened while a quiet mission is played under its rung: a squad row lights the SQUAD lever, a press there and Standard | Hard move it and leave the mission\'s rung, and the quit puts back what they wrote; a kept AI lever beside a held rung still reads as a mix (D does not run Hard over it); a cone pinned by hand before the start is back at the quit; `quiet` beside `roomclear` reads no rung',
        `quiet on own eyes ${a0}: squad row lit ${aLit} → cones pressed: lit ${aLit2}, rows ${aAfter}, kept ${aSet} → Hard: ${aHard} → played on ${aPlay} → quit ${aQuit}\n    squad lever own eyes, quiet all round ${b0}: squad row lit ${bLit} → all round pressed: ${bAfter} → quit ${bQuit}\n    squad AI kept on hard, quiet on cones ${e0}: the rows alone read '${eRaw}', the sheet reads '${eNow}', its note "${eNote}" · D pressed (taken ${eKey}): kept ${eSet} · the squad's line: ${eLine} · played on ${ePlay} → quit ${eQuit}\n    cone pinned by hand ${c0} → quiet all round ${c1} → quit ${c2} · roomclear&quiet&quietfog=cones reads ${mixed}`);
    });
    // no rung = the run as it was, switch on or off
    { const run = async (on: boolean) => { fresh(); const W = await stand(5, 'bazaar.json'), g = W.game; QF.QUIETFOG.on = on; QF.QUIETFOG.def = 'off'; await hushed(() => startFromQuery(g, '?levelFile=bazaar.json&quiet=2')); const fow = g.fogOfWar.on; steps(W, 240); const h = hashDigest(digestGame(g, true)); await hushed(() => quitScenario(g)); return { fow, h, rows: fog() }; };
      const a = await run(false), b = await run(true);
      F.verdict(!a.fow && !b.fow && a.h === b.h && a.rows === b.rows, 'a quiet mission with the lever left on off is the run it was: no fog, the same digest after four seconds with the switch off and on', `off: fog ${a.fow} ${a.h} · on: fog ${b.fow} ${b.h}`); }
    // alone, a checkpoint under the fog
    { raise(); fresh(); const W = await stand(6, 'bazaar.json'), g = W.game; raise();
      await hushed(() => startFromQuery(g, '?levelFile=bazaar.json&quiet=1&quietfog=cones')); steps(W, 30);
      const gate = SAVE.canSave(g, false), snap = await hushed(() => W.snapshot('probe', true)), sam0 = [...g.player.char.pos];
      steps(W, 60); let threw = ''; try { await hushed(() => W.restore(snap)); steps(W, 60); } catch (e) { threw = String(e); }
      const men: any[] = g.guards.filter((x: any) => !x.unit && x.char.alive), hid = men.filter(x => g.fogOfWar.hidden(x)).length, d = Math.hypot(g.player.char.pos[0] - sam0[0], g.player.char.pos[2] - sam0[2]);
      const fowOn = g.fogOfWar.on, good = !gate && !threw && fowOn && fog() === 'cone' && QF.quietFogHeld() && hid > 0 && d < 0.5; await hushed(() => quitScenario(g));
      F.verdict(good, 'alone, a checkpoint may be saved under the fog and loads under it: the fog still on at its rung, men out of sight still left out of the picture, a second of play after it', `canSave: ${gate ?? 'ok'} · after the load: fog ${fowOn ? 'on' : 'OFF'} · ${hid} of ${men.length} left out · the player ${d.toFixed(2)} m from where he saved${threw ? ` · THREW ${threw}` : ''}`); }
    // a tripwire under the fog senses the floor as it stands, not the picture (the office's storage beam: its door swung into it out of the player's sight)
    // (staged with the leaves double-acting on either stand: one-way, this door opens away from its beam and no leaf can be swung into one)
    { const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`), oneWay = DOORWAY.oneWay; DOORWAY.oneWay = false;
      try { fresh(); const W = await stand(9, 'office.json'), g = W.game, FW = g.fogOfWar, L = g.devices.lasers.find((x: any) => x.def.name === 'laser_storage'), d = g.doors.byName('storage');
      const hold = () => { for (const gd of g.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; } }, run = (n: number, a?: number) => { for (let i = 0; i < n; i++) { hold(); if (a !== undefined) { d.angle = a; d.vel = 0; } W.step(DT); } };
      let ang = 0, real = NaN; await hushed(() => { run(10); for (const a of [1, -1, 0.6, -0.6]) { run(4, a); if (L.sense < L.len - 0.3) { ang = d.angle; real = L.sense; break; } } });
      const stage = async (fogOn: boolean) => { await hushed(() => { g.restartEncounter(); FW.on = fogOn; FOG.cone = false; FOG.own = false; run(40); run(8, ang); });
        const r = { held: FW.doorHeld(d) as boolean, cut: L.cut as number, sense: L.sense as number }; FW.on = false; return r; };
      const on = ang ? await stage(true) : null, off = ang ? await stage(false) : null;
      F.verdict(!!on && !!off && on.held && on.cut > L.len - 0.1 && Math.abs(on.sense - real) < 0.05 && !off.held && Math.abs(off.cut - real) < 0.05 && off.sense === off.cut,
        'a tripwire under the fog senses the floor as it stands: a leaf swung into the beam out of sight is still drawn shut and the drawn beam runs its length, the sensor\'s beam ends on the leaf; no fog = one reach, as it was',
        ang ? `storage door at ${ang.toFixed(2)} rad cuts the ${L.len.toFixed(2)} m beam at ${real.toFixed(2)} m · under the fog: leaf drawn as remembered ${on!.held}, drawn beam ${on!.cut.toFixed(2)} m, sensor ${on!.sense.toFixed(2)} m · no fog: drawn ${off!.cut.toFixed(2)} m, sensor ${off!.sense.toFixed(2)} m` : 'no angle of the storage door cut the beam on this stand'); } finally { DOORWAY.oneWay = oneWay; } }
  } catch (e) { F.verdict(false, 'the check ran to its end', e instanceof Error ? e.stack ?? e.message : String(e)); }
  finally { QF.quietFogEnd(); D.setLever?.('fog', null, false); fresh(); QF.QUIETFOG.on = onWas; QF.QUIETFOG.def = defWas; QF.QUIETFOG.solo = soloWas; FOG.own = ownWas; Math.random = rnd; }
  return F.done();
}

if (import.meta.main) process.exit((await quietfogCheck()) ? 0 : 1);
