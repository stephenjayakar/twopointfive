// WHAT A MISSION HANDS YOU SHOWS ON YOUR CARD (src/ui/kitCard.ts MemberCardOpts.lent, src/ui/loadout.ts lentNow; switch KIT_LENT, `?nokitlent`).
//
//   bun run tools/qa/kitlent-check.ts          (KITLENT_BREAK=1 = the switch put off under the check: every 'the tile shows it' line must fail)
//
// A quiet mission played under the fog hands Sam its sticky cameras for the visit (scenarioRun.ts scenarioStart → stickycam.ts stickyVisitSet, read by
// kit.ts kitPlayer on a card with the rifle) and, where quietfog.ts QUIETFOG.wand is up, an optical wand with them. The Team & kit card read his CARD
// alone: 'none' beside a thing he was about to be handed. This check opens the loadout screen on a headless DOM (as wand-check's tile lines do) and reads
// the tiles: under the fog with the cameras on, the cameras tile and the wand tile show what he will have and are marked `lent`; with the fog off, the
// cameras lever on None, the mission's wand off, a card that already carries as much, a squad mission, the solo night, a teammate's card or the switch
// off, they read the card as ever; and nothing of his card or his pouches is written by any of it. It sets the switches it needs itself, so it asks the
// same on either stand. Looks at no picture: never seen on a GPU.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { STICKY } = await import(`${ROOT}/src/game/stickycam.ts`);
const QF = await import(`${ROOT}/src/game/quietfog.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
const { startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const STAND = harnessProfile() as string, BROKEN = process.env.KITLENT_BREAK === '1';
const memStore = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
type Tile = { lent: boolean; idle: boolean; val: string; title: string; note: string; dimIco: boolean };

export async function lentTiles(): Promise<boolean> {
  const F = family('kitlent-tiles: the cameras and the wand a quiet mission hands you show on your card\'s own tiles');
  const G = globalThis as any, hadLS = 'localStorage' in G, prevLS = G.localStorage, Q = QF.QUIETFOG;
  const was = { cards: K.KIT.members.map((m: any) => ({ ...m })), on: K.KIT.on, slots: K.SLOTS.on, wand: WAND.on, sticky: STICKY.on, qf: Q.on, def: Q.def, qwand: Q.wand, team: K.kitTeam(), solo: K.KIT_SOLO.on };
  let KC: any = null, lentWas = true;
  try {
    await withDom('?quality=high&mute', async () => {
      G.localStorage = memStore(); G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
      const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`); KC = await import(`${ROOT}/src/ui/kitCard.ts`);
      lentWas = KC.KIT_LENT.on; KC.KIT_LENT.on = !BROKEN;
      K.KIT.on = true; K.SLOTS.on = true; WAND.on = true; STICKY.on = true; Q.on = true; Q.wand = true; QF.quietFogForget();
      K.kitLoad(null, ''); K.kitReset(); K.kitSet(0, 'wand', false); K.kitSet(0, 'cams', 0);
      const SEARCH = '?quality=high&mute', list: any[] = M.missionList(), pickWas = M.MISSIONS.onPick, up: any[] = []; M.MISSIONS.onPick = null;
      const N = STICKY.issue as number, HAND = `${N} · ${KC.LENT_WORD}`;
      try {
        const tiles = (root: El) => Object.fromEntries(root.all(e => e.cls.has('kc-row')).map(r => [r.attrs['data-field'], { lent: r.cls.has('lent'), idle: r.cls.has('idle'), val: r.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '', title: r.title, note: r.all(e => e.cls.has('kc-note'))[0]?.textContent ?? '', dimIco: !!r.all(e => e.cls.has('kc-ico'))[0]?.cls.has('none') }])) as Record<string, Tile>;
        const open = (id: string) => { const m = list.find(x => x.id === id); if (!m) throw new Error(`no mission '${id}' on the list`); const host = new El('DIV') as any; const L = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { } }); up.push(L); return { L, root: L.root as unknown as El }; };
        const press = (root: El, lever: string, attr: string, v: string) => { const b = root.all(e => e.attrs['data-lever'] === lever)[0]?.all(e => e.tagName === 'BUTTON').find(x => x.attrs[attr] === v) as any; if (!b?.onclick) throw new Error(`no ${lever} button ${v} on the quiet loadout`); b.onclick(); };
        const say = (t: Record<string, Tile>) => ['cams', 'wand'].map(f => `${f} '${t[f]?.val}'${t[f]?.lent ? ' lent' : ''}${t[f]?.idle ? ' idle' : ''}${t[f]?.dimIco ? ' (dim)' : ''}`).join(' · ');
        const plain = (t: Record<string, Tile>) => !!t.cams && !!t.wand && !t.cams.lent && !t.wand.lent && t.cams.val === '0' && !/mission/.test(t.wand.val) && t.cams.dimIco && t.wand.dimIco && !t.cams.title && !t.wand.title;
        const card0 = JSON.stringify(K.KIT.members[0]), cost0 = K.kitCost(0).used;

        // a quiet mission under the fog, its cameras on: the two tiles show what he will have
        const quiet = open('bazaar-quiet'); press(quiet.root, 'fog', 'data-rung', 'team'); press(quiet.root, 'cams', 'data-cams', '1'); const a = tiles(quiet.root);
        const others = Object.entries(a).filter(([f]) => f !== 'cams' && f !== 'wand');
        F.verdict(!!a.cams && !!a.wand && a.cams.lent && a.cams.val === HAND && !a.cams.dimIco && a.cams.title === KC.LENT_WHY && a.wand.lent && a.wand.val === KC.LENT_WORD && !a.wand.dimIco && a.wand.title === KC.LENT_WHY
          && !/none/i.test(a.wand.note) && !/none/i.test(a.cams.note) && others.length > 2 && others.every(([, r]) => !r.lent),
          `A QUIET MISSION UNDER THE FOG, CAMERAS ON, a card that carries neither: the cameras tile reads '${HAND}' and the wand tile '${KC.LENT_WORD}', each drawn lit and marked lent with the reason on the tile, its line the line of a man who has it; no other tile is marked`,
          `${say(a)} · wand's line: '${a.wand?.note}' · cameras' line: '${a.cams?.note}'${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);
        F.verdict(JSON.stringify(K.KIT.members[0]) === card0 && K.kitCost(0).used === cost0, '… and nothing of his card or his pouches is written by it', `pouches ${K.kitCost(0).used} (were ${cost0}) · card unchanged ${JSON.stringify(K.KIT.members[0]) === card0}`);

        // the levers on that screen decide, live
        press(quiet.root, 'cams', 'data-cams', '0'); const noCams = tiles(quiet.root); press(quiet.root, 'cams', 'data-cams', '1'); const back = tiles(quiet.root);
        press(quiet.root, 'fog', 'data-rung', 'off'); const noFog = tiles(quiet.root); press(quiet.root, 'fog', 'data-rung', 'team'); press(quiet.root, 'cams', 'data-cams', '1');
        F.verdict(plain(noCams) && back.cams.lent && back.wand.lent && plain(noFog), 'THE LEVERS ON THAT SCREEN: the cameras put on None and both tiles are empty tiles again at once; put back, lent again; the fog put off, empty again', `None: ${say(noCams)}\n    back on: ${say(back)}\n    fog off: ${say(noFog)}${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);

        // the mission's wand off (quietfog.ts QUIETFOG.wand): the cameras are still handed, no wand
        Q.wand = false; const q2 = open('bazaar-quiet'), b = tiles(q2.root); Q.wand = true;
        F.verdict(b.cams.lent && b.cams.val === HAND && !b.wand.lent && b.wand.dimIco && !b.wand.title, 'THE MISSION\'S WAND OFF: the cameras are still shown as handed, the wand tile is an empty tile', `${say(b)}${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);

        // a card that carries as much reads as his own; one camera of his under the mission's is the mission's count
        for (const f of ['smoke', 'bangs', 'frags', 'shells']) K.kitSet(0, f, 0);   // (room in his pouches for them)
        const tw = K.kitTry(0, 'wand', 1), tc = K.kitTry(0, 'cams', N); const q3 = open('bazaar-quiet'), c = tiles(q3.root);
        K.kitSet(0, 'wand', false); K.kitSet(0, 'cams', 1); const q4 = open('bazaar-quiet'), d = tiles(q4.root); K.kitReset(); K.kitSet(0, 'wand', false); K.kitSet(0, 'cams', 0);
        F.verdict(tw.ok && tc.ok && !c.wand.lent && /carried/i.test(c.wand.val) && !c.cams.lent && c.cams.val === String(N) && (N <= 1 || (d.cams.lent && d.cams.val === `1 · ${KC.LENT_WORD} ${N}` && /pouch/.test(d.cams.note))) && d.wand.lent && !/pouch/.test(d.wand.note) && !/pouch/.test(a.cams.note),
          'A CARD THAT CARRIES THEM: its own wand reads carried and its own cameras their count, nothing marked; one camera of his under the mission\'s keeps his own count in front of the mission\'s (an arrow pressed moves what the tile reads) and still says what his own costs — a tile the mission fills alone names no pouch', `carried: ${say(c)}\n    one camera, no wand: ${say(d)} · cameras' line: '${d.cams?.note}' · wand's line: '${d.wand?.note}'${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);

        // no rifle on the card: no launcher for the cameras (kit.ts kitPlayer), the wand is handed all the same
        const gun = K.KIT.members[0].weapon; K.kitSet(0, 'weapon', 'pistol'); const q5 = open('bazaar-quiet'), e = tiles(q5.root); K.kitSet(0, 'weapon', gun);
        F.verdict(K.KIT.members[0].weapon === gun && !!e.cams && !e.cams.lent && e.wand.lent, 'THE PISTOL ALONE ON HIS CARD: no cameras shown as handed (no launcher to send them), the wand still is', `${say(e)}${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);

        // the man drawn beside the card (S.worn(): the kit he will be staged with) carries what the tiles say; and mounted inside the start page (no lever
        // rows of its own: the sheet over it carries them) the tiles say the same
        { const L = open('bazaar-quiet'), w = L.L.worn(), m = list.find(x => x.id === 'bazaar-quiet'), host = new El('DIV') as any;
          const E = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { }, embedded: { keys: () => true } }); up.push(E); const et = tiles(E.root as unknown as El);
          F.verdict(w.cams === N && w.wand === true && K.KIT.members[0].cams === 0 && !K.KIT.members[0].wand && et.cams?.lent && et.cams.val === HAND && et.wand?.lent, 'THE MAN DRAWN BESIDE IT is handed the same kit (worn(): the mission\'s cameras and wand laid over his card, the card itself untouched); and the card mounted inside the start page says the same as the screen of its own', `worn: cams ${w.cams}, wand ${w.wand} · his card: cams ${K.KIT.members[0].cams}, wand ${K.KIT.members[0].wand} · embedded: ${say(et)}${BROKEN ? ' · KITLENT_BREAK=1' : ''}`); }

        // THE GAME'S OWN WORD: the link that screen would deploy, started in a game — what the card promised is what is on him
        { const L = open('bazaar-quiet'), link = L.L.search() as string, t = tiles(L.root), q = new URLSearchParams(link.replace(/^[^?]*\?/, '')), file = q.get('levelFile') ?? specOfQuery(q)?.level;
          const promised = { cams: t.cams.lent ? N : 0, wand: t.wand.lent };
          const W: any = await hushed(() => standUp({ uploadEvery: 1, ...(file ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) } : {}) })), g = W.game;
          Q.on = true; Q.wand = true; STICKY.on = true; WAND.on = true; K.KIT.on = true; K.SLOTS.on = true;   // (a game stood up puts the stand's rows back: raised again, as the screen had them)
          await hushed(() => { startFromQuery(g, link); K.kitSoloIf(g, false); }); for (let i = 0; i < 10; i++) W.step(1 / 60);   // (kitSoloIf: the page's own question after a start — a quiet mission alone wears your card; the frozen stand never asks it by itself)
          const pl = g.player, got = { cams: pl.rifle?.cams ?? 0, wand: !!pl.wand };
          F.verdict(!!specOfQuery(q) && got.cams === promised.cams && promised.cams === N && got.wand === promised.wand && promised.wand, 'THE GAME\'S OWN WORD: that screen\'s link started in a game — the cameras the tile promised are the cameras on his rifle, and the wand is on him (quietfog.ts quietWand)', `link ${link} · promised ${JSON.stringify(promised)} · on him ${JSON.stringify(got)}${BROKEN ? ' · KITLENT_BREAK=1' : ''}`);
          await hushed(() => quitScenario(g)); }

        // elsewhere nothing is handed: a squad mission, the solo night, a teammate's card on the quiet mission
        const soloFogWas = QF.QUIETFOG.solo; QF.QUIETFOG.solo = false;   // (the solo night as it was: under the fog it is handed the mission's cameras and wand as a quiet mission is — solofog-check.ts)
        const four = tiles(open('room-clear-four').root), solo = tiles(open('solo-night').root); QF.QUIETFOG.solo = soloFogWas;
        const duo = list.find(x => /quiet/.test(x.id) && /duo|two|pair/.test(x.id)); let mate: Record<string, Tile> | null = null;
        if (duo) { const L = open(duo.id); L.L.pick(1); mate = tiles(L.root); }
        F.verdict(plain(four) && !solo.cams.lent && !solo.wand.lent && (!mate || Object.values(mate).every(r => !r.lent)), 'ELSEWHERE: a squad mission, the solo night and a teammate\'s card show nothing as handed', `room clear: ${say(four)} · solo night: ${say(solo)} · a teammate's card on ${duo ? duo.id : '(no quiet mission for two on the list: not asked)'}: ${mate ? Object.entries(mate).filter(([, r]) => r.lent).map(([f]) => f).join(' ') || 'none lent' : 'n/a'}`);

        // the switch off: every tile reads the card alone
        const on = KC.KIT_LENT.on; KC.KIT_LENT.on = false; const off = tiles(open('bazaar-quiet').root); KC.KIT_LENT.on = on;
        F.verdict(plain(off), 'THE SWITCH OFF (?nokitlent): the same mission, the same levers, and both tiles are the card\'s own empty tiles — the build before', say(off));
      } finally { for (const L of up) L.close?.(); QF.setQuietFog('off'); QF.quietFogForget(); M.MISSIONS.onPick = pickWas; }
    });
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally {
    if (KC) KC.KIT_LENT.on = lentWas;
    K.kitLoad(null, ''); WAND.on = was.wand; STICKY.on = was.sticky; Q.on = was.qf; Q.def = was.def; Q.wand = was.qwand; K.SLOTS.on = was.slots; K.KIT.on = was.on; K.kitTeam(was.team); K.KIT_SOLO.on = was.solo;
    for (let i = 0; i < was.cards.length; i++) K.KIT.members[i] = was.cards[i];
    if (hadLS) G.localStorage = prevLS; else delete G.localStorage;
  }
  return F.done();
}

export async function kitlentCheck(): Promise<boolean> {
  console.log(`kitlent-check on the ${STAND.toUpperCase()} stand (it sets the switches it needs itself)${BROKEN ? ' — KITLENT_BREAK=1: the switch is put off under it, the lines that ask for a lent tile must FAIL' : ''}`);
  const ok = await lentTiles();
  console.log(`\nkitlent-check (${STAND} stand): ${ok ? 'ALL PASS' : 'FAILED'}`);
  return ok;
}
if (import.meta.main) { const ok = await kitlentCheck(); process.exit(ok ? 0 : 1); }
