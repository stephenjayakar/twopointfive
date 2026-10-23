// A MISSION'S OWN CARD FOR YOU IS THE WHOLE KIT (src/game/kit.ts ISSUE.whole; ?issuelend puts it off, TPS_ISSUEWHOLE=1 raises it on a frozen run).
//   bun run tools/qa/probes.ts issuewhole                     (frozen: the rule is held off; every line raises it by hand)
//   TPS_PROFILE=shipped bun run tools/qa/probes.ts issuewhole  (the page's stand)
//   ISSUEWHOLE_BREAK=1 … on either: the rule's broken path (the build before: the mission's hand-overs land over the card) — MUST FAIL.
// What it holds: off, a mission of the quiet kind whose level names your card is handed the launcher's five sponge rounds (and a fog's cameras and wand)
// over it, and the launcher comes up on the sponge rounds (the build before, to the count). On: that card is everything he carries — no sponge round, no
// camera, no wand, the launcher on the first load he does carry; a card that names sponge rounds (`rings`) carries that many — while a block that names no card for you (the long hall's, empty), a mission with no
// block and a lesson's page with none are handed what they ever were, and with the card as a tree off (no sponge row) nothing moves. The tutorial's
// solo mission is stood up as its page stands it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, standUp } from './headless.ts';
import { rig } from './doortools-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { KITTREE } = await import(`${ROOT}/src/game/kittree.ts`);
const { GUNSLOTS } = await import(`${ROOT}/src/game/gunslots.ts`);
const { STICKY, stickyVisitSet } = await import(`${ROOT}/src/game/stickycam.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { QUIETFOG } = await import(`${ROOT}/src/game/quietfog.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);

const J = (x: unknown) => JSON.stringify(x);
const STAND = harnessProfile() as string, BROKEN = process.env.ISSUEWHOLE_BREAK === '1', FILE = 'tut-solo.json';
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const TEXT = readFileSync(resolve(ROOT, 'levels', FILE), 'utf8'), text = () => TEXT;
const held = (g: any) => { const pl = g.player, rf = pl.rifle; return { rings: rf.rings, cams: rf.attachments.includes('cam') ? rf.cams : 0, wand: !!pl.wand, smoke: pl.canisters, stun: pl.flashbangs, frags: pl.frags, shells: rf.shells, load: rf.attachment as string }; };

export async function issueWhole(): Promise<boolean> {
  console.log(`\n=== issuewhole: a mission's own card for you is the whole kit [${STAND}${BROKEN ? ' · ISSUEWHOLE_BREAK=1' : ''}] ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  await hushed(() => rig(17, { stage: false }));   // (a game stood up first: a switch's own word set by hand is pinned at the stand-up, not as the module loads)
  const was = { whole: K.ISSUE.whole, issue: K.ISSUE.on, stealth: K.KITDEAL.stealth, deal: K.KITDEAL.on, tree: KITTREE.on, guns: GUNSLOTS.on, big: K.BIGSLOT.on, on: K.KIT.on, slots: K.SLOTS.on, sticky: STICKY.on, wand: WAND.on, qwand: QUIETFOG.wand, solo: K.KIT_SOLO.on };
  const raise = (whole: boolean, stealth = true) => { K.kitMission(null); KITTREE.on = true; GUNSLOTS.on = true; K.BIGSLOT.on = true; K.KIT.on = true; K.SLOTS.on = true; STICKY.on = true; WAND.on = true; QUIETFOG.wand = true; K.KITDEAL.on = false; K.KITDEAL.stealth = stealth; K.ISSUE.on = true; K.ISSUE.whole = whole; };
  let game: any = null;
  try {
    { const env = process.env.TPS_ISSUEWHOLE, want = env !== undefined ? env === '1' : STAND !== 'frozen';
      verdict(was.whole === want && String(FROZEN_HOLDS['ISSUE.whole']).startsWith('TPS_ISSUEWHOLE=1'), `the switch as this stand has it: ${want ? 'on' : 'off'}`, `ISSUE.whole ${was.whole} · the hold's word: ${FROZEN_HOLDS['ISSUE.whole']}`); }

    // ── the file: the one level that names your card today
    { const block = JSON.parse(text()).scenarios?.issue?.members?.['0'] ?? null;
      verdict(!!block && (block.rings === undefined || (Number.isInteger(block.rings) && block.rings >= 0 && block.rings <= K.RINGS_MAX)) && (validateLevelData(JSON.parse(text())) as string[]).length === 0 && K.kitIssueWhole({ '0': block }) === (K.ISSUE.whole && !BROKEN) && !K.kitIssueWhole({}) && !K.kitIssueWhole(null),
        'THE FILE: the solo tutorial\'s block names your card (it named its own sponge rounds, `rings`, while its lines taught the swap: none now); a block that names no card for you is not this rule\'s', `card ${J(block)}`); }

    { const errs = (c0: unknown, c1?: unknown) => { const d = JSON.parse(text()); d.scenarios.issue = { members: { '0': c0, ...(c1 ? { '1': c1 } : {}) } }; return (validateLevelData(d) as string[]).filter(e => /issue/.test(e)); };
      const takes = [0, 2, K.RINGS_MAX].every(n => errs({ weapon: 'rifle', rings: n }).length === 0) && errs({ rings: 1 }).length === 0;
      const refuses = [errs({ rings: K.RINGS_MAX + 1 }), errs({ rings: 1.5 }), errs({ rings: -1 }), errs({ weapon: 'pistol', rings: 1 }), errs({ weapon: 'shotgun', rings: 1 }), errs({}, { rings: 1 })].map(e => e.length);
      verdict(takes && refuses.every(n => n > 0) && K.RINGS_MAX === 5, 'THE VALIDATOR takes `rings` on your own card up to the launcher\'s five, and refuses more, a count that is no whole number, a card with no rifle, and a teammate\'s', `taken ${takes} · refused ${J(refuses)} · the card\'s most ${K.RINGS_MAX}`); }

    // ── the tutorial's solo mission as its page stands it
    const page = async (whole: boolean) => { let r: any = null, why = '';
      try { K.kitIssuedPage(true); const W: any = await hushed(() => standUp({ level: loadLevel(parseLevelData(text())), seed: 1 })), g = W.game; raise(whole); K.kitLoad(null, '');
        const s = await hushed(() => startFromQuery(g, `?levelFile=${FILE}&quiet`)); why = s?.why ?? ''; K.kitSoloIf(g, false); for (let i = 0; i < 5; i++) W.step(1 / 60); r = held(g);
      } catch (x) { why = String((x as Error).message); } finally { K.kitIssuedPage(false); K.KIT_SOLO.on = false; }
      return { r, why }; };
    { const off = await page(false), on = await page(true), a = off.r, b = on.r, own: number = JSON.parse(text()).scenarios?.issue?.members?.['0']?.rings ?? 0;   // (the card's own sponge rounds: two while the mission taught the swap to the grenade, none since it carries the grenade alone)
      verdict(!off.why && !on.why && !!a && !!b && a.rings === Math.max(own, KITTREE.lend) && a.load === 'ring' && b.rings === own && b.cams === 0 && !b.wand && b.load === (own ? 'ring' : 'he40') && `${b.smoke}/${b.stun}/${b.frags}/${b.shells}` === '2/2/2/3' && `${a.smoke}/${a.stun}/${a.frags}/${a.shells}` === '2/2/2/3',
        'THE SOLO TUTORIAL ON ITS PAGE: off, the launcher comes up on the lent sponge rounds, more than its block names (the build before); on, he carries the block and nothing else: the sponge rounds it names and no more, the right button on them where it names any and on the grenades where it names none', `off ${J(a)}${off.why ? ` (${off.why})` : ''} · on ${J(b)}${on.why ? ` (${on.why})` : ''}`); }

    // ── the rule on a rig: a block that names them, a mission with no block, a lesson's page with none
    { K.kitLoad(null, ''); const R: any = await hushed(() => rig(17, { stage: false })); raise(true); K.kitLoad(null, ''); const g = R.game; game = g;
      const others = g.guards.filter((gd: any) => !(gd.unit && gd.team === 'operative')), all0 = g.guards, sc = g.level.scenarios ?? (g.level.scenarios = {}), had = sc.issue;
      const run = (block: unknown, cams: number, lesson = false) => { K.kitShow(g); K.KIT_SOLO.on = true; g.guards = others; stickyVisitSet(g, cams); if (block) sc.issue = { members: { '0': block } }; else delete sc.issue;
        const k = g.player.rifle.attachments.indexOf('ring'); if (k >= 0) g.player.rifle.attIdx = k; K.kitIssuedPage(lesson); try { K.kitPlayer(g); return held(g); } finally { K.kitIssuedPage(false); } };
      const BLOCK = { weapon: 'rifle', smoke: 2, bangs: 2, frags: 2, shells: 3 };
      try {
        const table = J(K.KIT.members[0]);
        K.ISSUE.whole = false; const off = run(BLOCK, 2); K.ISSUE.whole = true; const on = run(BLOCK, 2), same = J(K.KIT.members[0]) === table;
        verdict(off.rings === KITTREE.lend && off.cams === 2 && off.wand && on.rings === 0 && on.cams === 0 && !on.wand && on.load === 'he40' && on.frags === 2 && on.shells === 3 && same,
          'A QUIET RUN ALONE UNDER A FOG, with a block: off, the mission\'s five sponge rounds, two cameras and wand land over it; on, none of them, the launcher on the grenade, and the table\'s own card is not touched', `off ${J(off)} · on ${J(on)} · the table ${same ? 'as it was' : 'CHANGED'}`);
        { const named = run({ ...BLOCK, rings: 2 }, 2), top = run({ ...BLOCK, rings: K.RINGS_MAX }, 2); K.kitShow(g); K.KIT_SOLO.on = true; g.guards = others; stickyVisitSet(g, 2); const FITS = { weapon: 'rifle', smoke: 0, bangs: 1, frags: 1, shells: 1, rings: 2 }; sc.issue = { members: { '0': FITS } }; { const k = g.player.rifle.attachments.indexOf('ring'); if (k >= 0) g.player.rifle.attIdx = k; } K.kitStage(g, []); const staged = held(g);
          K.ISSUE.whole = false; const lentOver = run({ ...BLOCK, rings: 2 }, 0); K.ISSUE.whole = true;
          verdict(named.rings === 2 && named.load === 'ring' && named.cams === 0 && !named.wand && named.shells === 3 && top.rings === K.RINGS_MAX && staged.rings === 2 && staged.load === 'ring' && staged.shells === 1 && lentOver.rings === KITTREE.lend,
            'A CARD THAT NAMES SPONGE ROUNDS (`rings`) carries that many and nothing else of the mission\'s: the launcher comes up on them with the grenades its next load; a card that fits its pouches keeps them through the squad\'s staging too (one that does not is trimmed there like any card); with the rule off the mission\'s five land over them as before', `rings 2: ${J(named)} · rings ${K.RINGS_MAX}: ${top.rings} · a fitting card through kitStage: ${J(staged)} · rule off: ${lentOver.rings} rounds`); }
        g.guards = all0; const ops0 = { members: {} }; const hall = (whole: boolean) => { K.ISSUE.whole = whole; K.kitShow(g); K.KIT_SOLO.on = true; g.guards = others; stickyVisitSet(g, 2); sc.issue = ops0; K.KITDEAL.stealth = false; { const k = g.player.rifle.attachments.indexOf('ring'); if (k >= 0) g.player.rifle.attIdx = k; } try { K.kitPlayer(g); return held(g); } finally { K.KITDEAL.stealth = true; } };
        const hallOff = hall(false), hallOn = hall(true);
        verdict(J(hallOn) === J(hallOff) && hallOn.rings === KITTREE.lend && hallOn.cams === 2 && hallOn.wand, 'A BLOCK THAT NAMES NO CARD FOR YOU (the long hall\'s, empty: written for its room clear) leaves a night alone on that level what it was handed: the same with the rule on and off', `on ${J(hallOn)} · off ${J(hallOff)}`);
        KITTREE.on = false; const flatOn = run(BLOCK, 0); K.ISSUE.whole = false; const flatOff = run(BLOCK, 0); K.ISSUE.whole = true; KITTREE.on = true;
        verdict(J(flatOn) === J(flatOff), 'WITH THE CARD AS A TREE OFF there is no sponge row and no round handed (the rifle\'s are what it is built with): the same kit with the rule on and off', `on ${J(flatOn)} · off ${J(flatOff)}`);
        const plain = run(null, 2); K.KITDEAL.stealth = false; const lentOn = run(null, 2); K.ISSUE.whole = false; const lentOff = run(null, 2); K.ISSUE.whole = true; K.KITDEAL.stealth = true;
        verdict(plain.rings === 5 && plain.cams === 2 && plain.wand && J(lentOn) === J(lentOff) && lentOn.rings === KITTREE.lend && lentOn.cams === 2 && lentOn.wand,
          'A MISSION WITH NO BLOCK is not this rule\'s: the stealth card as issued on a quiet run, and with that card off the mission\'s hand-overs, the same with the rule on and off', `stealth card ${J(plain)} · handed over, rule on ${J(lentOn)} · rule off ${J(lentOff)}`);
        const lesOn = run(null, 2, true); K.ISSUE.whole = false; const lesOff = run(null, 2, true); K.ISSUE.whole = true;
        verdict(J(lesOn) === J(lesOff) && lesOn.wand, 'A LESSON\'S PAGE WITH NO BLOCK is as it was: the same kit with the rule on and off, the mission\'s wand handed over the plain issue', `on ${J(lesOn)} · off ${J(lesOff)}`);
      } finally { K.kitShow(g); if (had) sc.issue = had; else delete sc.issue; g.guards = all0; stickyVisitSet(g, 0); K.KIT_SOLO.on = false; }
    }

    // ── a recording from before the key replays with it off
    { raise(true); const snap = knobsSnapshot(game) as { tables: Record<string, Record<string, unknown>> }; const old = JSON.parse(J(snap)); if (old.tables.ISSUE) delete old.tables.ISSUE.whole; let ok = false, why = '';
      try { applyKnobs(game, old); ok = K.ISSUE.whole === false; applyKnobs(game, snap); ok &&= K.ISSUE.whole === true; } catch (e: any) { why = String(e?.message ?? e); }
      verdict(ok && !!snap.tables.ISSUE, 'the session journal carries the key, and a recording from before it replays with it off', why || `a journal without the key → off · with it → ${K.ISSUE.whole}`); }
  } finally { K.kitMission(null); K.ISSUE.whole = was.whole; K.ISSUE.on = was.issue; K.KITDEAL.stealth = was.stealth; K.KITDEAL.on = was.deal; KITTREE.on = was.tree; GUNSLOTS.on = was.guns; K.BIGSLOT.on = was.big; K.KIT.on = was.on; K.SLOTS.on = was.slots; STICKY.on = was.sticky; WAND.on = was.wand; QUIETFOG.wand = was.qwand; K.KIT_SOLO.on = was.solo; K.kitIssuedPage(false); K.kitLoad(null, ''); K.SLOTS.on = was.slots; K.KIT.on = was.on; }
  console.log(`=== issuewhole: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) issueWhole().then(ok => process.exit(ok ? 0 : 1));
