// A LESSON THE PLAYER PACKS FOR (src/game/kit.ts ISSUE.picked; ?kitpack=0 puts it off, TPS_KITPACK=1 raises it on a frozen run) and the plan its
// Team & kit step teaches (src/ui/kitPlan.ts).
//   bun run tools/qa/probes.ts kitpack                      (frozen: the rule is held off; every line raises it by hand)
//   TPS_PROFILE=shipped bun run tools/qa/probes.ts kitpack  (the page's stand: also plays the mission through on five kits — KITPACK_PLAY=0 leaves that out)
//   KITPACK_BREAK=1 … on either: the rule's broken path (the build before: that row is as issued like every lesson) — MUST FAIL.
// What it holds: one tutorial row carries `packs` and has a plan written for it, and every plan is some such row's · with the rule on that row is not
// played as issued and every other lesson still is; off it is as issued again · its loadout screen shows the cards with the rule on and none with it
// off · staged as its page stages it (main.ts: kitLessonPage) he and the four carry the kept cards, with the row's least number of frags
// on him whatever his card says; off, the page's own issue to the count · a recording from before the key replays with it off · the plan's map marks lie
// inside the level's rooms of those names, and what its cards say of the kits is true of the kits (Stun heavy takes your frag; the squad's stun
// grenades as issued are no more than the rooms it goes into, under Stun heavy more) · THE MISSION ITSELF, played by its scripted player on the page's
// stand under five kits (as issued · Stun heavy · Stun heavy with a frag traded in, the plan's own answer · Frag heavy, no door charge on anybody ·
// a card with a pistol and nothing else), ends with every step done.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, standUp } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { kitAsIssued } = await import(`${ROOT}/src/game/loadout.ts`);
const { LESSON_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { KIT_PLANS } = await import(`${ROOT}/src/ui/kitPlan.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);

const J = (x: unknown) => JSON.stringify(x);
const STAND = harnessProfile() as string, BROKEN = process.env.KITPACK_BREAK === '1';
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const rows = LESSON_MISSIONS as any[], packed = rows.filter(e => e.packs), ROW = packed[0];

/** the kits the mission is played under: what is done to the kept cards before its page stages them */
const KITS: Record<string, { say: string; put(): boolean }> = {
  issued: { say: 'as issued', put: () => true },
  stun: { say: 'Stun heavy (no frag on your card)', put: () => K.kitLoadout('stun') === null },
  plan: { say: 'Stun heavy with a smoke traded for a frag (the plan\'s answer)', put: () => K.kitLoadout('stun') === null && K.kitSet(0, 'smoke', 0) && K.kitSet(0, 'frags', 1) },
  frag: { say: 'Frag heavy (no door charge on anybody)', put: () => K.kitLoadout('frag') === null },
  bare: { say: 'a pistol and empty pouches', put: () => K.kitSet(0, 'smoke', 0) && K.kitSet(0, 'bangs', 0) && K.kitSet(0, 'frags', 0) && K.kitSet(0, 'shells', 0) && K.kitSet(0, 'weapon', 'pistol') },
};
/** the page of a lesson's row names it, as main.ts does: what its stagings wear is asked of the row at each staging */
const page = (row: any) => { K.kitLessonPage(row); };
const pageOff = () => { K.kitLessonPage(null); K.kitIssuedPage(false); };

/** ONE PLAY of the mission under one kit, in a process of its own (the scripted player, the page's stand): prints one line of JSON */
async function play(name: string) {
  const kit = KITS[name]; let out: any = { code: 2, why: `no such kit '${name}'` };
  if (kit && ROW) { K.kitLoad(null, ''); const put = kit.put(); page(ROW);
    try { const { runLesson } = await import('./lesson-run.ts'); const r = await hushed(() => runLesson(String(ROW.level).replace(/\.json$/, ''), {})); out = { code: put ? r.code : 1, why: put ? r.why : 'the kit could not be put on the cards', steps: r.steps.length, secs: Math.round(r.secs), tail: r.lines.slice(-3) }; }
    catch (x) { out = { code: 1, why: String((x as Error).message) }; } finally { pageOff(); K.kitLoad(null, ''); } }
  console.log(`KITPACK_PLAY ${J(out)}`);
}

export async function kitPack(): Promise<boolean> {
  console.log(`\n=== kitpack: a lesson the player packs for, and the plan its kit step teaches [${STAND}${BROKEN ? ' · KITPACK_BREAK=1' : ''}] ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { picked: K.ISSUE.picked, solo: K.KIT_SOLO.on };
  try {
    { const env = process.env.TPS_KITPACK, want = env !== undefined ? env === '1' : STAND !== 'frozen';
      verdict(was.picked === want && String(FROZEN_HOLDS['ISSUE.picked']).startsWith('TPS_KITPACK=1'), `the switch as this stand has it: ${want ? 'on' : 'off'}`, `ISSUE.picked ${was.picked} · the hold's word: ${FROZEN_HOLDS['ISSUE.picked']}`); }

    // ── the row and its plan
    { const plans = Object.keys(KIT_PLANS), ids = packed.map(e => e.id);
      verdict(packed.length === 1 && ROW.group === 'tutorial' && ROW.squad > 0 && (ROW.packs.frags ?? 0) >= 1 && J(plans) === J(ids), 'THE ROW: one tutorial mission with a team is packed for, it names the least frags he carries there, and the plans written are that row\'s and no other\'s', `rows with packs: ${J(ids)} (${J(ROW?.packs)}) · plans: ${J(plans)}`); }

    // ── the rule: that row alone is not as issued
    { K.ISSUE.picked = true; const on = { row: kitAsIssued(ROW), packs: K.kitPacks(ROW), rest: rows.filter(e => e !== ROW).every(e => kitAsIssued(e) && !K.kitPacks(e)) };
      K.ISSUE.picked = false; const off = { row: kitAsIssued(ROW), packs: K.kitPacks(ROW), rest: rows.every(e => kitAsIssued(e)) };
      verdict(on.row === false && on.packs === true && on.rest && off.row === true && off.packs === false && off.rest && !K.kitPacks(null) && !K.kitPacks({}), 'THE RULE: on, that row is not played with the kit as issued and every other lesson still is; off, it is as issued like the rest', `on: as issued ${on.row}, packs ${on.packs}, the other ${rows.length - 1} as issued ${on.rest} · off: as issued ${off.row}, packs ${off.packs}`); }

    // ── a recording from before the key replays with the rule off; one made with it carries it
    { const W: any = await hushed(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', ROW.level), 'utf8'))), seed: 1 })), g = W.game;
      K.ISSUE.picked = true; const snap = JSON.parse(J(knobsSnapshot(g))); const carried = snap.tables?.ISSUE?.picked;
      delete snap.tables.ISSUE.picked; applyKnobs(g, snap); const old = K.ISSUE.picked;
      snap.tables.ISSUE.picked = true; applyKnobs(g, snap); const kept = K.ISSUE.picked;
      verdict(carried === true && old === false && kept === true, 'THE JOURNAL carries the key, and a recording from before it replays with the rule off', `in a snapshot: ${carried} · a snapshot without the key applies as ${old} · with it as ${kept}`); }

    // ── the loadout screen: cards with the rule on, none with it off
    { const { El, withDom } = await import('./scenario-picker-probes.ts'), UI = await import(`${ROOT}/src/ui/loadout.ts`);
      const m = new Map<string, string>(), st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
      let seen = { on: false, off: true, size: -1 };
      try { await withDom('', async () => { K.kitLoad(st, '');
        K.ISSUE.picked = true; const A = UI.openLoadout(ROW, { host: new El('BODY') as any, deploy: () => { } }); seen.on = !!A.card; seen.size = A.squad; A.close();
        K.ISSUE.picked = false; const B = UI.openLoadout(ROW, { host: new El('BODY') as any, deploy: () => { } }); seen.off = !!B.card; B.close(); }); }
      finally { UI.loadoutOpen()?.close(); K.kitLoad(null, ''); }
      verdict(seen.on === true && seen.off === false && seen.size === ROW.squad, 'ITS LOADOUT SCREEN shows the cards with the rule on, at the row\'s own team size, and none with it off', `cards on: ${seen.on} (team ${seen.size}) · cards off: ${seen.off}`); }

    // ── staged as its page stages it
    { const level = () => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', ROW.level), 'utf8')));
      const team = (g: any) => g.guards.filter((x: any) => x.unit && x.team === 'operative');
      const held = (g: any) => ({ you: `${g.player.canisters}/${g.player.flashbangs}/${g.player.frags}`, rifle: !!g.player.hasRifle, mates: team(g).map((o: any) => { const c = K.kitOf(o); return c ? `${c.bangs}/${c.charges}/${c.frags}` : '-'; }).join(' ') });
      const stage = async (rule: boolean, kit: string) => { K.ISSUE.picked = rule; K.kitLoad(null, ''); const put = KITS[kit].put(); page(ROW);
        try { const W: any = await hushed(() => standUp({ level: level(), seed: 1 })); K.ISSUE.picked = rule /* (the frozen stand pins the word at the stand-up: raised by hand after it) */; const r = await hushed(() => startFromQuery(W.game, scenarioQuery(ROW))); return { put, why: r.why as string | undefined, ...held(W.game), n: team(W.game).length }; } finally { pageOff(); K.kitLoad(null, ''); } };
      const kitOn = K.KIT.on, floor = ROW.packs.frags as number;
      if (!kitOn) verdict(true, 'STAGED AS ITS PAGE STAGES IT: not on this stand, where no card is put on anybody (KIT.on is off)', 'the staging lines are the page\'s stand\'s');
      else { const offI = await stage(false, 'issued'), offS = await stage(false, 'stun'), onI = await stage(true, 'issued'), onS = await stage(true, 'stun'), onP = await stage(true, 'plan'), onB = await stage(true, 'bare');
        K.ISSUE.picked = true; K.kitLoad(null, ''); KITS.stun.put(); const worn = JSON.parse(J(K.kitWorn(ROW.squad))) /* (a copy: with no deal on it is the table's own array, emptied below) */, want = `${worn[0].smoke}/${worn[0].bangs}/${Math.max(worn[0].frags, floor)}`, wantMates = worn.slice(1, 1 + ROW.squad).map((c: any) => `${c.bangs}/${c.charges}/${c.frags}`).join(' '); K.kitLoad(null, '');
        verdict(!offI.why && offI.n === ROW.squad && J(offI) === J({ ...offS, put: offI.put }) && offI.rifle, 'OFF, its page stages the issue whatever this machine keeps (the build before)', `smoke/stun/frag on you, stun/charge/frag on each teammate — kept as issued: ${offI.you} · ${offI.mates} — kept Stun heavy: ${offS.you} · ${offS.mates}`);
        verdict(onS.put && !onS.why && onS.you === want && onS.mates === wantMates && worn[0].frags === 0 && onS.you !== offS.you, `ON, its page stages the kept cards: under Stun heavy he and the four carry that kit, and the ${floor} frag the street asks for is on him though his card has none`, `you ${onS.you} (the card: ${worn[0].smoke}/${worn[0].bangs}/${worn[0].frags}, the least frags ${floor}) · the four ${onS.mates} (the cards: ${wantMates})`);
        { K.kitLoad(null, ''); KITS.stun.put(); K.ISSUE.picked = true; page(ROW); let late: any = null;   // (the page named its row with the rule on — and a recording's knobs then put it off, as a tape from before the key does after the boot)
          try { const W: any = await hushed(() => standUp({ level: level(), seed: 1 })); K.ISSUE.picked = false; await hushed(() => startFromQuery(W.game, scenarioQuery(ROW))); late = held(W.game); } finally { pageOff(); K.kitLoad(null, ''); }
          verdict(!!late && late.you === offS.you && late.mates === offS.mates, 'THE RULE IS READ AT EACH STAGING, not when the page names its row: put off after that (a recording\'s knobs arrive after the boot), the staging is the issue', `named with the rule on, staged with it off: ${late?.you} · ${late?.mates} (the issue: ${offS.you} · ${offS.mates})`); }
        verdict(onP.put && onP.you === `0/${worn[0].bangs}/1` && onI.you.endsWith(`/${Math.max(1, floor)}`) && onB.put && onB.you === `0/0/${floor}` && onB.rifle === false, 'ON, the plan\'s own answer is carried as packed (a smoke traded for a frag), the card as issued keeps its frag, and a card with a pistol and empty pouches is still handed the frag', `the plan's: ${onP.you} · as issued: ${onI.you} · a pistol and nothing: ${onB.you}, rifle ${onB.rifle}`); } }

    // ── the plan's words against the level and the kits
    { const P = KIT_PLANS[ROW.id], rooms = (JSON.parse(readFileSync(resolve(ROOT, 'levels', ROW.level), 'utf8')).scenarios?.roomClear?.rooms ?? []) as { name: string; bounds: { x0: number; x1: number; z0: number; z1: number } }[];
      const out = P.marks.filter((k: any) => { const r = rooms.find(x => x.name === k.room); return !r || !(k.at[0] > r.bounds.x0 && k.at[0] < r.bounds.x1 && k.at[1] > r.bounds.z0 && k.at[1] < r.bounds.z1); }).map((k: any) => k.label);
      // (the doors the lesson sends the squad to: read from what its steps hold done — a stack up on a named door, by the squad's key or by plan mode's
      //  right button — and never from the words of a line, which are free to change)
      const sends = (t: any): string[] => !t || typeof t !== 'object' ? [] : t.is === 'stackOn' ? [String(t.door)] : t.is === 'stacks' ? (t.doors ?? []).map(String) : Array.isArray(t.of) ? t.of.flatMap(sends) : [];
      const doors = [...new Set(((JSON.parse(readFileSync(resolve(ROOT, 'levels', ROW.level), 'utf8')).scenarios?.lesson?.steps ?? []) as { done?: unknown }[]).flatMap(t => sends(t.done)))];
      const ids = P.guide.beats.map((b: any) => b.id), digits = P.guide.beats.flatMap((b: any) => { const st = { squad: 4, kit: '', member: 0, worn: '', mapSeen: false, mapBig: false, frags: 0, smoke: 1, bangs: 3, kits: ['issued', 'stun'] }; return [0, 1, 2].flatMap(f => ['', 'stun'].flatMap(kit => [0, 2, 3].map(bangs => { const w = b.words({ own: 4, needs: null, rescue: false, now: { ...st, frags: f, smoke: bangs ? 1 : 0, bangs, kit } }); return `${w.title} ${w.text}`.replace(/\[[^\]]+\]/g, ''); }))); }).filter((t: string) => /\d/.test(t) || /\b(north|south|east|west)\b/i.test(t));
      verdict(out.length === 0 && P.marks.length >= 3 && new Set(ids).size === ids.length && P.guide.beats[0].row === 'map' && P.guide.beats[ids.length - 1].row === 'actions' && P.guide.auto === true && P.guide.ls !== 'twopointsix.kitguide' && digits.length === 0 && !/\d/.test(P.read) && doors.length === P.rooms && P.marks.length === P.rooms + 2 && ROW.packs.frags === 1,
        'THE PLAN: every word pinned on its map lies inside the level\'s room of that name, the rooms it counts for the squad are the doors the lesson sends the squad to, the one frag its last card promises is the row\'s, it opens on the map and ends on Deploy, it is remembered under a key of its own, and no card of it writes a digit or a compass word', `rooms ${P.rooms}, the doors the lesson sends the squad to ${J(doors)} · marks ${J(P.marks.map((k: any) => k.label))}${out.length ? ` · OUTSIDE THEIR ROOMS: ${J(out)}` : ''} · beats ${J(ids)} · key ${P.guide.ls}${digits.length ? ` · A DIGIT OR A COMPASS WORD: ${J(digits.slice(0, 2))}` : ''}`);
      if (!K.KIT.on) verdict(true, 'WHAT ITS CARDS SAY OF THE KITS: not on this stand (KIT.on is off)', 'the kits\' lines are the page\'s stand\'s');
      else { K.kitLoad(null, ''); const n = ROW.squad, issued = K.kitPool(n).bangs, you0 = K.kitWorn(n)[0].frags; const put = KITS.stun.put(), stun = K.kitPool(n).bangs, you1 = K.kitWorn(n)[0].frags, named = K.kitLoadoutOf(); K.kitLoad(null, '');
        verdict(put && named === 'stun' && you0 >= 1 && you1 === 0 && issued <= P.rooms && stun > P.rooms, 'WHAT ITS CARDS SAY OF THE KITS is true of them: as issued you carry a frag and the squad no more stun grenades than the street has rooms for them; Stun heavy takes your frag and gives the squad some to spare', `as issued: your frags ${you0}, the squad's stun grenades ${issued} · Stun heavy ('${named}'): your frags ${you1}, the squad's ${stun} · rooms ${P.rooms}`); } }

    // ── the mission played through under each kit (the page's stand: a tutorial mission is the page's)
    if (STAND === 'frozen' || process.env.KITPACK_PLAY === '0') console.log(`- (not played here: ${STAND === 'frozen' ? 'a tutorial mission is the page\'s, and its plays are the shipped stand\'s' : 'KITPACK_PLAY=0'})`);
    else { const names = Object.keys(KITS), t0 = Date.now();
      const outs = await Promise.all(names.map(async name => { const p = Bun.spawn(['bun', 'run', import.meta.path, '--play', name], { env: { ...process.env, TPS_PROFILE: 'shipped' }, stdout: 'pipe', stderr: 'pipe' }); const text = await new Response(p.stdout).text(); await p.exited;
        const line = text.split('\n').find(l => l.startsWith('KITPACK_PLAY ')); try { return { name, ...(JSON.parse(line!.slice(13)) as { code: number; why: string; steps?: number; secs?: number; tail?: string[] }) }; } catch { return { name, code: 1, why: `no result (exit ${p.exitCode}): ${text.slice(-300)}` }; } }));
      for (const o of outs) verdict(o.code === 0, `PLAYED THROUGH under ${KITS[o.name].say}: every step of the mission done`, o.code === 0 ? `${o.steps} steps · ${o.secs} s of play` : `${o.why}${o.tail ? ` · ${o.tail.join(' | ')}` : ''}`);
      console.log(`    (${names.length} plays side by side, ${Math.round((Date.now() - t0) / 1000)} s)`); }
  } catch (x) { verdict(false, 'the check ran to its end', String((x as Error).stack ?? x)); }
  finally { pageOff(); K.kitLoad(null, ''); K.ISSUE.picked = was.picked; K.KIT_SOLO.on = was.solo; }
  return all;
}
if (import.meta.main) { const k = process.argv.indexOf('--play'); if (k >= 0) { await play(process.argv[k + 1]); process.exit(0); } const ok = await kitPack(); console.log(ok ? '\n=== kitpack-check: ALL PASS ===' : '\n=== kitpack-check: FAILED ==='); process.exit(ok ? 0 : 1); }
