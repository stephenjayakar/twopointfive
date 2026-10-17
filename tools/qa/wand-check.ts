// THE OPTICAL WAND (src/game/wand.ts — a piece of YOUR kit; carrying it, 'look under it' on a shut door's rows where the fog of war hides the room), headless:
//   bun run tools/qa/wand-check.ts [kit|tile|look|costs|doors|mate|off] (probes.ts wand; WAND_BREAK=1 = the switch left off: must fail)
// The maintainer, 10-11: "maybe we can add the optical wand/cable as prep? what's actually realistic here?" · "yeah let's add it to kit".
//   kit     the row on your card only with the switch; under the pouches rule the issued card is full, so the wand is refused until a pouch is given up, then
//           it takes one; the store keeps it and a build with the switch off reads the same store as none; teammates have no such row while their own switch (WAND.mate) is off; staging puts it on
//           the Player; a checkpoint's player slice carries it
//   tile    the real Team & kit screen on a stand-in DOM, a wand and two sticky cameras on your card: on the solo night (never a fog of war) both tiles say
//           'no use here' where their value is and are marked idle, every other tile as ever; on a squad mission they read as carried; on a quiet mission
//           they are idle until its fog lever is raised on that screen, and again when it is put back
//   look    a four-man room clear in the office, a defender behind the shut server door: the row is there only with the switch, the wand, a fog and a shut
//           door that is not steel; hidden before and all through the feed; seen once the lens is through and turned on him; turned away, hidden again;
//           the lens stands in HIS eye's place (no sixth eye), on the floor, with its own wedge in the picture's row; under the cone fog the wedge is the cone's
//   costs   the pan keeps to its rate and its stops (the strip beside the door is never his); a step, Space, the door opening and a blast each pull it out
//           and no round leaves for the stow; the man he saw keeps a '(?)' for markSecs and no longer; a plain save waits while he looks; the lens is on
//           the floor: what stands on the floor hides what is behind it (counted against a standing eye in the same place, over every door face)
//   doors   every door of every squad level, both faces: the lens is on the far side of the shut leaf and not inside anything solid
//   mate    (wandorder.ts, switch WAND.mate) a teammate's card may carry it at a pouch's price; carried and never ordered nothing happens; X on a shut door,
//           then V: the carrier alone walks up, kneels and feeds it, his eye among the fog's is the lens; blinded, re-ordered, the leaf moving each end it;
//           refused in words on an open door, a steel one, men with no wand; carried and not ordered = the same run by digest
//   off     the switch off, and the switch on with the wand carried and never used: the same run by digest
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself. Nothing here looks at a picture.
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const WD = await import(`${ROOT}/src/game/wand.ts`);
const { WAND, WAND_STATS, wandLens, wandOffered, wandFov, wandPanMax, wandEye, wandFits } = WD;
const WO = await import(`${ROOT}/src/game/wandorder.ts`);
const WH = await import(`${ROOT}/src/game/whistle.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { FOG, fieldDeg } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SCENARIOS, QUIET_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { tearOff, DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`);
const { KITANIM, kitLockMax } = await import(`${ROOT}/src/game/kitanim.ts`);
const { KIT: KIT_HANDS } = await import(`${ROOT}/src/game/character.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const SAVE = await import(`${ROOT}/src/game/savestate.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const J = (o: unknown) => JSON.stringify(o), DT = 1 / 60, DEG = Math.PI / 180;
const BREAK = process.env.WAND_BREAK === '1';
const raise = () => { WAND.on = !BREAK; };
const steps = (W: any, n: number, each?: () => void) => { for (let i = 0; i < n; i++) { each?.(); W.step(DT); } };
const memStore = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
/** the kit table and its rule as they stood, put back after `fn` (the store the table writes to is left on nothing) */
async function keepKit<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = K.KIT.on, slots = K.SLOTS.on;
  try { return await fn(); } finally { K.kitLoad(null, ''); for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; K.KIT.on = on; K.SLOTS.on = slots; }
}
async function stand(seed: number, file?: string) {
  Math.random = seeded(0x3a9d + seed * 7919);
  const level = file ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) : undefined;
  return await hushed(() => standUp({ uploadEvery: 4, ...(level ? { level } : {}) })) as any;
}
const rowsOf = (g: any) => g.nearby.filter((x: any) => x.kind === 'door').map((x: any) => x.verb as string);
// (owncharge.ts: a door charge by hand is ONE row past the three, under every row Space had before it — so it is not one of 'the three' the wand gives way inside,
// and it never sits above the wand's row; a close-in hint line, which no key gives, may stand under it)
const isOwn = (r: string) => r === 'charge' || r === 'door:charge';
const three = (rows: string[]) => { const own = rows.filter(isOwn), k = rows.findIndex(isOwn); return rows.length - own.length <= 3 && own.length <= 1 && (k < 0 || !rows.slice(k + 1).some(r => r === 'wand' || r === 'door:wand')); };
/** the office's four-man room clear, AI still, Sam knelt-distance off the middle of `name`'s leaf on the face the defender behind it is NOT on */
async function atDoor(seed: number, name = 'server', foe = 'Tango 5') {
  const W = await stand(seed), g = W.game; raise();   // (the frozen stand pins the switch off as it stands a game up: raised after)
  const r = await hushed(() => startFromQuery(g, 'roomclear&squad4'));
  await hushed(() => steps(W, 30));
  const d = g.doors.list.find((x: any) => x.def.name === name), T = g.guards.find((x: any) => x.callsign === foe);
  if (!d || !T) throw new Error(`no ${name} door / ${foe} (start: ${r?.why})`);
  const side = -g.doors.side(d, T.char.pos) as 1 | -1, L = wandLens(d, side);
  const u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5;
  const spot = [hx + u[0] * w - Math.sin(L.yaw) * 0.9, 0, hz + u[1] * w - Math.cos(L.yaw) * 0.9];
  g.aiEnabled = false; g.teleportPlayer(spot);
  await hushed(() => steps(W, 20));
  return { W, g, pl: g.player, d, T, side, L, spot };
}
/** the row picked and one Space */
function begin(W: any) { const ok = W.game.selectVerb('door', 'wand'); if (ok) { W.input.pressed.add('Space'); W.step(DT); } return ok && !!W.game.player.wanding; }
/** stepped with the cursor held on `at` until the lens is through (or `cap` frames) → frames taken */
function feed(W: any, at: number[], cap = 300) { let n = 0; while (n < cap && W.game.player.wanding && !W.game.player.wanding.live) { W.cursorAt(at); W.step(DT); n++; } return n; }

// ───────────────────────────────────────────────────────────── kit
export async function wandKit(): Promise<boolean> {
  const F = family('wand-kit: the optical wand is a row of your card that takes a pouch, is kept per machine and rides onto the Player');
  const onWas = WAND.on, mateWas = WAND.mate, rnd = Math.random;
  WAND.mate = false;   // a teammate's row is its own switch's (wand-mate holds it)
  try {
    await keepKit(async () => {
      const fields = (i: number) => K.kitRows(i).map((r: any) => r.field as string);
      WAND.on = false; K.kitLoad(null, '');
      const offRows = fields(0);
      raise(); K.kitLoad(null, '');
      const onRows = fields(0), mates = [1, 2, 3, 4].map(i => fields(i).includes('wand'));
      F.verdict(!offRows.includes('wand') && onRows.includes('wand') && onRows.indexOf('wand') === onRows.indexOf('suit') - 1 && onRows.indexOf('wand') > onRows.indexOf('shells') && !mates.some(Boolean) && onRows.filter((f: string) => f !== 'wand').join() === offRows.join(),
        'the row is on YOUR card only with the switch, the last of your kit rows (after the 40 mm row, and after your charge rows where your card has them: owncharge.ts); no other row moves; no teammate has one while his own switch is off', `off ${offRows.join(' ')} · on ${onRows.join(' ')} · teammates ${J(mates)}`);

      // the pouches rule: issued = full
      const c0 = K.kitCost(0), t0 = K.kitTry(0, 'wand', 1), stillNone = K.KIT.members[0].wand === false;
      const gave = K.kitSet(0, 'smoke', 0), t1 = K.kitTry(0, 'wand', 1), c1 = K.kitCost(0);
      const row = K.kitRows(0).find((r: any) => r.field === 'wand'), rc = K.kitRowCost(0, row), words = K.kitWords(0), legal = K.kitLegal();
      F.verdict(K.SLOTS.on && c0.used === c0.total && !t0.ok && /pouch/.test(t0.why) && stillNone && gave && t1.ok && t1.value === true && c1.used === c1.total && rc?.pouches === 1 && /wand/.test(rc.rate) && /, wand$/.test(words) && legal === null,
        'issued, your four pouches are full: the wand is refused in words until a can is given up, then it takes that pouch and the card says so', `issued ${c0.used} of ${c0.total} · try → ${t0.ok} "${t0.why}" · smoke given up ${gave} · try → ${t1.ok} · ${c1.used} of ${c1.total} · row ${J(rc)} · "${words}" · legal ${legal}`);
      const over = K.kitTry(0, 'smoke', 1);
      F.verdict(!over.ok && /pouch/.test(over.why), 'with the wand in, the can it replaced no longer fits', `smoke +1 → ${over.ok} "${over.why}"`);

      // the store
      const st = memStore(); K.kitLoad(st, ''); K.kitSet(0, 'smoke', 0); K.kitSet(0, 'wand', true);
      const kept = JSON.parse(st.m.get(K.KIT_LS) ?? '{}').members?.[0]?.wand;
      K.kitLoad(memStore(Object.fromEntries(st.m)), ''); const back = K.KIT.members[0].wand, backCost = K.kitCost(0).used;
      const off = memStore(Object.fromEntries(st.m));
      WAND.on = false; K.kitLoad(off, ''); const offRow = fields(0).includes('wand'), offCost = K.kitCost(0).used, offWords = K.kitWords(0);
      K.kitSet(0, 'frags', 0); const offKept = JSON.parse(off.m.get(K.KIT_LS) ?? '{}').members?.[0]?.wand;   // (a row changed on a visit with the switch off: the store is written again)
      raise(); K.kitLoad(memStore(Object.fromEntries(off.m)), ''); const onAgain = K.KIT.members[0].wand;
      F.verdict(kept === true && back === true && backCost === 4 && !offRow && offCost === 3 && !/wand/.test(offWords) && offKept === true && onAgain === true,
        'the store keeps it; a fresh read has it; read with the switch off the card has no such row, a free pouch and no word of it — and a row changed on that visit does not write the wand out of the store', `stored ${kept} · read back ${back} (${backCost} of 4) · switch off: row ${offRow}, ${offCost} of 4, "${offWords}" · after a change there the store has ${offKept} · switch on again ${onAgain}`);

      // the rule off: the row is there and free
      K.kitLoad(null, '?noslots'); const free = K.kitTry(0, 'wand', 1), fr = fields(0).includes('wand');
      F.verdict(fr && free.ok, 'with the pouches rule off the row is still there and simply taken', `row ${fr} · try → ${free.ok}`);

      // staging → the Player, and the checkpoint slice
      K.kitLoad(null, ''); K.kitSet(0, 'smoke', 0); K.kitSet(0, 'wand', true);
      const W = await stand(1), g = W.game; raise();
      await hushed(() => { startFromQuery(g, 'roomclear&squad4'); steps(W, 10); });
      const staged = g.player.wand, cans = g.player.canisters;
      await hushed(() => { g.restartEncounter(); steps(W, 10); });
      const again = g.player.wand;
      K.kitSet(0, 'wand', false); await hushed(() => { g.restartEncounter(); steps(W, 10); }); const none = g.player.wand;
      F.verdict(staged === true && again === true && none === false, 'a mission staged with the wand on your card puts it on the Player, a restart keeps it, a card without it stages none', `staged ${staged} (smokes ${cans}) · after a restart ${again} · card without ${none}`);

      const W2 = await stand(2), g2 = W2.game; raise(); await hushed(() => steps(W2, 10));
      g2.player.wand = true; const s = SAVE.saveState(g2, { kind: 'harness', force: true }); const inFile = s.player.wand;
      g2.player.wand = false; const s0 = SAVE.saveState(g2, { kind: 'harness', force: true });
      await hushed(() => SAVE.loadState(g2, s)); const loaded = g2.player.wand;
      await hushed(() => SAVE.loadState(g2, s0)); const loaded0 = g2.player.wand;
      const old = JSON.parse(JSON.stringify(s)); delete old.player.wand;   // (a file from before the wand, or made with the switch off: it does not say)
      await hushed(() => SAVE.loadState(g2, old)); const loadedOld = g2.player.wand;
      WAND.on = false; const sOff = SAVE.saveState(g2, { kind: 'harness', force: true }); await hushed(() => SAVE.loadState(g2, s)); const loadedOff = g2.player.wand; raise();
      F.verdict(inFile === true && s0.player.wand === false && loaded === true && loaded0 === false && loadedOld === false && !('wand' in sOff.player) && loadedOff === false,
        'a checkpoint says whether the wand is on him and a load puts that back; a file that does not say leaves what the staging gave him; with the switch off nothing is written and a file\'s wand is not handed out', `file ${inFile} / ${s0.player.wand} · loaded ${loaded} / ${loaded0} · a file without the key ${loadedOld} · switch off: key written ${'wand' in sOff.player}, a file with it loads ${loadedOff}`);
    });
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; WAND.mate = mateWas; Math.random = rnd; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── tile
/** the maintainer, 10-12, on Team & kit of the solo night: "wand greyed out" — the tile was dimmed whole on a mission with no fog of war and still read CARRIED */
export async function wandTile(): Promise<boolean> {
  const F = family('wand-tile: a carried wand or sticky camera says so itself where the mission has no fog of war for it to look into');
  const onWas = WAND.on, G = globalThis as any, hadLS = 'localStorage' in G, prevLS = G.localStorage;
  const { STICKY } = await import(`${ROOT}/src/game/stickycam.ts`), QF = await import(`${ROOT}/src/game/quietfog.ts`), stickyWas = STICKY.on, qfWas = QF.QUIETFOG.on, soloFogWas = QF.QUIETFOG.solo;
  try {
    await keepKit(async () => { await withDom('?quality=high&mute', async () => {
      G.localStorage = memStore(); G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
      const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`), KC = await import(`${ROOT}/src/ui/kitCard.ts`);
      raise(); STICKY.on = true; QF.QUIETFOG.on = true; QF.quietFogForget();
      K.kitLoad(null, ''); for (const f of ['smoke', 'bangs', 'frags', 'shells']) K.kitSet(0, f, 0);
      const tw = K.kitTry(0, 'wand', 1), tc = K.kitTry(0, 'cams', 2), cost = K.kitCost(0);
      const SEARCH = '?quality=high&mute', list: any[] = M.missionList(), pickWas = M.MISSIONS.onPick, up: any[] = []; M.MISSIONS.onPick = null;
      try {
      const tiles = (root: El) => Object.fromEntries(root.all(e => e.cls.has('kc-row')).map(r => [r.attrs['data-field'], { idle: r.cls.has('idle'), val: r.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '', title: r.title, dimIco: !!r.all(e => e.cls.has('kc-ico'))[0]?.cls.has('none') }])) as Record<string, { idle: boolean; val: string; title: string; dimIco: boolean }>;
      const open = (id: string) => { const m = list.find(x => x.id === id); const host = new El('DIV') as any; const L = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { } }); up.push(L); return { L, root: L.root as unknown as El }; };
      const say = (t: Record<string, { idle: boolean; val: string }>) => Object.entries(t).map(([f, r]) => `${f} '${r.val}'${r.idle ? ' idle' : ''}`).join(' · ');

      // the solo night: never a fog (as it was: where QUIETFOG.solo is up — the page — it opens under the fog and is handed the mission's cameras and wand, solofog-check.ts; held down for these two lines)
      QF.QUIETFOG.solo = false;
      const solo = open('solo-night'), t0 = tiles(solo.root), others0 = Object.entries(t0).filter(([f]) => f !== 'wand' && f !== 'cams');
      F.verdict(tw.ok && tc.ok && cost.used === 3 && !!t0.wand && !!t0.cams && t0.wand.idle && t0.wand.val === KC.IDLE_WORD && t0.cams.idle && t0.cams.val === `2 · ${KC.IDLE_WORD}` && t0.wand.title === KC.IDLE_WHY && !t0.wand.dimIco
        && others0.length > 2 && others0.every(([, r]) => !r.idle && !r.title && !r.val.includes(KC.IDLE_WORD)),
        'the solo night (no fog of war, and no lever for one): the wand tile and the cameras tile say so where their value is, the count kept, and are marked idle with the reason on the tile; every other tile is as ever', `${cost.used} pouches · ${say(t0)}`);
      // …and a tile that carries none is a plain empty tile
      K.kitSet(0, 'wand', false); K.kitSet(0, 'cams', 0); const soloBare = open('solo-night'), tb = tiles(soloBare.root);
      F.verdict(!!tb.wand && !tb.wand.idle && tb.wand.val !== KC.IDLE_WORD && !tb.wand.title && !tb.cams.idle && tb.cams.val === '0', 'none carried there: the two tiles are empty tiles like any other, nothing marked', say({ wand: tb.wand, cams: tb.cams }));
      K.kitTry(0, 'wand', 1); K.kitTry(0, 'cams', 2); QF.QUIETFOG.solo = soloFogWas;

      // a squad mission: its own fog
      const four = open('room-clear-four'), t1 = tiles(four.root);
      F.verdict(!!t1.wand && !t1.wand.idle && /carried/i.test(t1.wand.val) && !t1.wand.title && !t1.cams.idle && t1.cams.val === '2', 'a squad mission (its own fog of war): the same card reads carried and 2, nothing idle', say({ wand: t1.wand, cams: t1.cams }));

      // a quiet mission: the lever on this very screen decides
      const quiet = open('bazaar-quiet');
      const lever = quiet.root.all(e => e.attrs['data-lever'] === 'fog')[0], rung = (r: string) => { const b = lever?.all(e => e.tagName === 'BUTTON').find(b => b.attrs['data-rung'] === r); if (!b?.onclick) throw new Error(`no fog rung ${r} on the quiet loadout`); b.onclick(); };
      rung('off'); const q0 = tiles(quiet.root);   // (pressed, not assumed: whichever rung the quiet missions start on — quietfog.ts QUIETFOG.def)
      rung('team'); const q1 = tiles(quiet.root); rung('off'); const q2 = tiles(quiet.root);
      F.verdict(q0.wand.idle && q0.cams.idle && !q1.wand.idle && /carried/i.test(q1.wand.val) && !q1.cams.idle && q1.cams.val === '2' && !q1.wand.title && q2.wand.idle && q2.wand.val === KC.IDLE_WORD && q2.cams.idle,
        'a quiet mission: idle while its fog lever is on off; the lever raised on that screen and the tiles read carried at once; put back, idle again', `off: ${say({ wand: q0.wand, cams: q0.cams })}\n    all round: ${say({ wand: q1.wand, cams: q1.cams })}\n    off again: ${say({ wand: q2.wand, cams: q2.cams })}`);
      } finally { for (const L of up) L.close?.(); QF.setQuietFog('off'); QF.quietFogForget(); M.MISSIONS.onPick = pickWas; }
    }); });
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; STICKY.on = stickyWas; QF.QUIETFOG.on = qfWas; QF.QUIETFOG.solo = soloFogWas; if (hadLS) G.localStorage = prevLS; else delete G.localStorage; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── look
export async function wandLook(): Promise<boolean> {
  const F = family('wand-look: at a shut door under the fog, the wand shows the room behind it — after the feed, inside its wedge, through his own eye\'s place');
  const onWas = WAND.on, nvWas = WAND.nv, coneWas = FOG.cone, rnd = Math.random, st0 = { ...WAND_STATS };
  try {
    raise();
    const { W, g, pl, d, T, L } = await atDoor(3);
    const fog = g.fogOfWar, eyes0 = fog.eyes.length;
    // who is offered the row
    const base = rowsOf(g); pl.wand = true; W.step(DT); const withIt = rowsOf(g);
    WAND.on = false; W.step(DT); const swOff = rowsOf(g); raise();
    const fogWas = fog.on; fog.on = false; W.step(DT); const noFog = rowsOf(g), noFogOffer = wandOffered(g, pl, d); fog.on = fogWas; W.step(DT);
    const steel = g.doors.list.find((x: any) => x.def.steel), open = g.doors.list.find((x: any) => !x.isClosed());
    F.verdict(!base.includes('wand') && withIt.includes('wand') && three(withIt) && !swOff.includes('wand') && !noFog.includes('wand') && !noFogOffer && (!steel || !wandOffered(g, pl, steel)) && (!open || !wandOffered(g, pl, open)) && wandOffered(g, pl, d) === !BREAK,
      'the row is on a shut door\'s list only with the switch, the wand on him and a fog up; never on a steel door or an open one; three rows at most, a charge by hand the one row under them', `bare ${base.join(' ')} · carried ${withIt.join(' ')} · switch off ${swOff.join(' ')} · no fog ${noFog.join(' ')} · steel ${steel?.def.name}: ${steel ? wandOffered(g, pl, steel) : '-'} · open ${open?.def.name}: ${open ? wandOffered(g, pl, open) : '-'}`);

    const before = fog.hidden(T);
    const started = begin(W);
    let hidFeed = true; const half = Math.floor(WAND.feedSecs / DT * 0.5);
    steps(W, half, () => { W.cursorAt(T.char.pos); }); hidFeed &&= fog.hidden(T) && !fog.eyes[0]?.wand;
    const n = feed(W, T.char.pos), took = pl.wanding ? pl.wanding.t : -1, crouched = pl.crouch, hands = pl.char.anim.lockpick;
    steps(W, 60, () => { W.cursorAt(T.char.pos); });
    const seen = !fog.hidden(T), eye = fog.eyes[0];
    F.verdict(before && started && hidFeed && n > 0 && took >= WAND.feedSecs && took < WAND.feedSecs + 0.6 && crouched && hands && seen,
      'the man behind the door is hidden before and all through the feed, and in the picture once the lens is through and on him', `hidden before ${before} · started ${started} · hidden half way ${hidFeed} · live after ${took.toFixed(2)} s on his knee (feed ${WAND.feedSecs}) · crouched ${crouched}, both hands ${hands} · seen ${seen}`);

    const fr = fog.frame, cos0 = fr?.looks?.[2], near0 = fr?.looks?.[3], y0 = fr?.eyes?.[1];
    F.verdict(!!eye?.wand && eye.id === pl.char.id && fog.eyes.length === eyes0 && Math.abs(eye.pos[1] - WAND.eyeY) < 1e-6 && eye.near === 0 && eye.fov === wandFov() && wandFov() === WAND.fovDeg,
      'the lens stands in his own eye\'s place among the fog\'s eyes: no eye added, on the floor past the leaf, its own wedge and no circle round it', `eyes ${eyes0} → ${fog.eyes.length} · eye 0 wand ${!!eye?.wand} id ${eye?.id} (his ${pl.char.id}) at y ${eye?.pos[1]} · wedge ${eye?.fov}° near ${eye?.near}${cos0 !== undefined ? ` · picture row cos ${Number(cos0).toFixed(3)} near ${near0} y ${y0}` : ''}`);
    if (cos0 !== undefined) F.verdict(Math.abs(cos0 - Math.cos(WAND.fovDeg * 0.5 * DEG)) < 1e-4 && near0 === 0, 'the picture is handed the lens\'s own wedge for that eye', `cos ${cos0} (want ${Math.cos(WAND.fovDeg * 0.5 * DEG).toFixed(4)}) · near ${near0}`);

    // turned away: he leaves the picture; turned back: he is in it again
    const ang = Math.atan2(T.char.pos[0] - L.pos[0], T.char.pos[2] - L.pos[2]) - L.yaw, a = Math.atan2(Math.sin(ang), Math.cos(ang));
    const away = [L.pos[0] + Math.sin(L.yaw - Math.sign(a) * 1.4) * 4, 0, L.pos[2] + Math.cos(L.yaw - Math.sign(a) * 1.4) * 4];
    steps(W, 150, () => { W.cursorAt(away); });
    const panAway = pl.wanding?.pan ?? 0, gone = fog.hidden(T), inWedge = Math.abs(a - panAway) < wandFov() * 0.5 * DEG;
    steps(W, 150, () => { W.cursorAt(T.char.pos); });
    const backIn = !fog.hidden(T);
    F.verdict(!inWedge && gone && backIn, 'the lens turned to the other side of the room loses him; turned back it has him again', `he stands ${(a / DEG).toFixed(0)}° off square · lens at ${(panAway / DEG).toFixed(0)}° → in its wedge ${inWedge}, hidden ${gone} · turned back: seen ${backIn}`);

    // hard: the cone's own wedge
    FOG.cone = true; W.step(DT); const softMax = Math.max(0, 90 - WAND.fovDeg * 0.5 - WAND.blindDeg) * DEG, hardFov = fog.eyes[0]?.fov, cone = fieldDeg(), hardMax = wandPanMax(), hardPan = Math.abs(pl.wanding?.pan ?? 9); FOG.cone = coneWas; W.step(DT);
    F.verdict(hardFov === cone && cone > WAND.fovDeg && hardMax < softMax && hardPan <= hardMax + 1e-9, 'under the cone fog the lens\'s wedge is the cone\'s own, and it turns less far', `wedge ${hardFov}° (the cone ${cone}°) · most turn ${(hardMax / DEG).toFixed(0)}° (${(softMax / DEG).toFixed(0)}° otherwise) · the lens came in to ${(hardPan / DEG).toFixed(0)}°`);
    // N at the wand: the goggles go down while he looks and the picture follows them; the look, its lens and what it shows are untouched
    { const tap = () => { W.cursorAt(T.char.pos); W.input.pressed.add('KeyN'); W.step(DT); }, hold = (n: number) => steps(W, n, () => { W.cursorAt(T.char.pos); });
      hold(30); const nv0 = !!pl.nv, a0 = pl.nvAmount, pan0 = pl.wanding?.pan ?? 9, fov0 = fog.eyes[0]?.fov, head0 = [...pl.char.bones.head];
      let peak = 0; const far = () => { const h = pl.char.bones.head; peak = Math.max(peak, Math.hypot(h[0] - head0[0], h[1] - head0[1], h[2] - head0[2])); };
      tap(); const on = !!pl.nv; far(); steps(W, 90, () => { W.cursorAt(T.char.pos); far(); }); far();   // (the furthest his head goes at any frame of the flip, not only where it ends)
      const aOn = pl.nvAmount, liveOn = !!pl.wanding?.live, seenOn = !fog.hidden(T), fovOn = fog.eyes[0]?.fov, wandOn = !!fog.eyes[0]?.wand, panOn = pl.wanding?.pan ?? -9;
      const moved = peak;
      tap(); const off = !!pl.nv; hold(90); const aOff = pl.nvAmount, liveOff = !!pl.wanding?.live;
      WAND.nv = false; tap(); const dead = !!pl.nv; hold(10); const liveDead = !!pl.wanding?.live; WAND.nv = nvWas;
      F.verdict(!nv0 && a0 < 0.01 && on && aOn > 0.9 && liveOn && seenOn && wandOn && fovOn === fov0 && Math.abs(panOn - pan0) < 1e-6 && moved < 0.03 && !off && aOff < 0.1 && liveOff,
        'N while he looks puts his goggles down and the picture follows; the look stays live with the same lens, wedge and man in it, his head within 3 cm of where it was at every frame of the flip; N again takes them up', `goggles ${nv0} → ${on} → ${off} · picture ${a0.toFixed(2)} → ${aOn.toFixed(2)} → ${aOff.toFixed(2)} · live ${liveOn} / ${liveOff} · he is seen ${seenOn} · lens eye ${wandOn}, wedge ${fov0}° → ${fovOn}°, pan ${(pan0 / DEG).toFixed(1)}° → ${(panOn / DEG).toFixed(1)}° · head moved ${(moved * 100).toFixed(1)} cm`);
      F.verdict(!dead && liveDead, 'with the key off (WAND.nv false) N does nothing on his knee at the door, as it was, and the look goes on', `goggles after N ${dead} · live ${liveDead}`);
    }
    F.verdict(WAND_STATS.looks === st0.looks + 1 && WAND_STATS.live === st0.live + 1 && WAND_STATS.marked >= st0.marked + 1, 'the counters saw one look, one lens through, a man marked', J(WAND_STATS));
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; WAND.nv = nvWas; FOG.cone = coneWas; Math.random = rnd; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── costs
export async function wandCosts(): Promise<boolean> {
  const F = family('wand-costs: what the look costs — slow, both hands, a narrow low view, and what pulls it out');
  const onWas = WAND.on, rnd = Math.random, mark = WAND.markSecs, lastWas = FOG.lastSeen;
  try {
    raise(); FOG.lastSeen = 0;
    // pan: rate and stops, and the strip beside the door
    { const { W, g, pl, d, T, L, side } = await atDoor(4); pl.wand = true; W.step(DT);
      const fog = g.fogOfWar; begin(W); feed(W, T.char.pos);
      const far = [L.pos[0] + Math.sin(L.yaw + 1.5) * 5, 0, L.pos[2] + Math.cos(L.yaw + 1.5) * 5];
      let worst = 0, most = 0, prev = pl.wanding.pan;
      steps(W, 240, () => { W.cursorAt(far); const p = pl.wanding?.pan ?? prev; worst = Math.max(worst, Math.abs(p - prev) / DT); most = Math.max(most, Math.abs(p)); prev = p; });
      const max = wandPanMax();
      F.verdict(worst <= WAND.panRate + 1e-6 && most <= max + 1e-9 && Math.abs(most - max) < 1e-6 && max > 0, 'the lens turns after the cursor at its own rate and stops short of the wall', `fastest ${worst.toFixed(2)} rad/s (rate ${WAND.panRate}) · furthest ${(most / DEG).toFixed(1)}° (stop ${(max / DEG).toFixed(1)}°)`);
      // a point hard beside the door on the far side, along the wall: never inside the wedge at either stop
      const u = d.dir(), strip = [L.pos[0] + u[0] * 2.5 + Math.sin(L.yaw) * 0.1, 0, L.pos[2] + u[1] * 2.5 + Math.cos(L.yaw) * 0.1];
      const sa = Math.atan2(strip[0] - L.pos[0], strip[2] - L.pos[2]) - L.yaw, s = Math.abs(Math.atan2(Math.sin(sa), Math.cos(sa)));
      F.verdict(s > max + wandFov() * 0.5 * DEG, 'floor against the wall beside the door, 2.5 m along it, is outside the wedge at its stop: the near corners are not his', `it lies ${(s / DEG).toFixed(0)}° off square · the wedge's edge at the stop ${((max + wandFov() * 0.5 * DEG) / DEG).toFixed(0)}°`);

      // the low lens: floor seen at the lens's height against a standing eye in the same place, over the room behind every door of the floor (it also sees
      // UNDER what hangs or stands on legs, so at some doors it has more: both counts are printed)
      const count = (door: any, sd: 1 | -1, y: number) => { const E = wandLens(door, sd); let n = 0, all = 0;
        for (let r = 1; r <= 6; r += 0.5) for (let k = -8; k <= 8; k++) { const b = E.yaw + k * 0.17, p = [E.pos[0] + Math.sin(b) * r, y, E.pos[2] + Math.cos(b) * r]; all++; if (!g.col.segmentBlocked([E.pos[0], y, E.pos[2]], p)) n++; } return { n, all }; };
      let fewer = 0, more = 0; const tab: string[] = [];
      for (const door of g.doors.list) for (const sd of [1, -1] as const) { const lo = count(door, sd, WAND.eyeY), hi = count(door, sd, 1.55); if (lo.n < hi.n) fewer++; if (lo.n > hi.n) more++; if (door === d && sd === side) tab.push(`${door.def.name}: ${lo.n} at the floor, ${hi.n} at a standing eye, of ${lo.all}`); }
      F.verdict(fewer > more && fewer >= 4, 'the lens is on the floor: at most doors with furniture beyond, it sees less of the room than a standing eye in its place would', `${tab.join(' ')} · of ${g.doors.list.length * 2} door faces: less at ${fewer}, more at ${more} (under things a standing eye is blocked by)`);

      // a plain save waits
      const busy = SAVE.playerBusy(g);
      F.verdict(busy === 'looking under a door', 'a checkpoint waits while he looks', `playerBusy: ${busy}`);

      // out by a step; no round for the stow; the mark stays
      steps(W, 120, () => { W.cursorAt(T.char.pos); }); const sawHim = !fog.hidden(T);
      W.input.pressed.add('KeyS'); W.input.keys.add('KeyS'); W.step(DT); W.input.keys.delete('KeyS');
      const out = !pl.wanding, lock = pl.equipT, pick = pl.char.anim.lockpick, byHand = KITANIM.on;   // (kit handling on — the page — the gun comes back up BY HAND and the lock-out is that draw's own; off, the wand's stow)
      steps(W, 120);
      const hid = fog.hidden(T), marks = fog.lastSeen().filter((m: any) => m.gd === T), life = marks[0]?.life, age = marks[0]?.age;
      F.verdict(sawHim && out && !pick && (byHand ? lock > 0.3 && lock <= kitLockMax(KIT_HANDS) : lock > WAND.stowSecs - 2 * DT && lock <= WAND.stowSecs) && hid && marks.length === 1 && life === WAND.markSecs && age > 1.5 && age < 3,
        'a step pulls it out: no round for the stow, the room goes back to fog, and the man he saw keeps a mark where he stood', `out ${out} · lock-out ${lock.toFixed(2)} s (${byHand ? 'the gun drawn by hand' : `stow ${WAND.stowSecs}`}) · hidden again ${hid} · mark ${marks.length} aged ${age?.toFixed(1)} s of ${life}`);
      steps(W, Math.ceil((WAND.markSecs - 1.5) / DT));
      const after = fog.lastSeen().filter((m: any) => m.gd === T).length;
      WAND.markSecs = 0; const none = fog.lastSeen().length; WAND.markSecs = mark;
      F.verdict(after === 0 && none === 0, 'the mark is gone after its time, and with its time at nothing there is none', `after ${WAND.markSecs} s: ${after} · markSecs 0: ${none}`);
    }
    // the other ways out
    { const { W, g, pl, d, T, L, spot } = await atDoor(5); pl.wand = true; W.step(DT);
      const go = () => { begin(W); feed(W, T.char.pos); return !!pl.wanding?.live; };
      const a = go(); W.input.pressed.add('Space'); W.step(DT); W.step(DT); const bySpace = !pl.wanding;
      steps(W, 60);
      const b = go(); W.input.pressed.add('Escape'); W.step(DT); W.step(DT); const byEsc = !pl.wanding;
      steps(W, 60);
      const stunWas = SAMSTUN.on; let c = false, byBlast = false, noRound = false;
      try { SAMSTUN.on = true;   // (the frozen stand holds 'blasts stun the player too' off: raised for this line, as the page has it)
        c = go(); pl.staggerUntil = g.time + 1; W.step(DT); byBlast = !pl.wanding; noRound = pl.equipT > 0; pl.staggerUntil = 0; } finally { SAMSTUN.on = stunWas; }
      steps(W, 90);
      // shoved off his spot with the lens through: it is out, said once (it used to go dark and come back with its line each time)
      const s1 = go(); pl.char.pos[0] += 0.5; pl.char.pos[2] += 0.5; W.step(DT); const byShove = !pl.wanding;
      g.teleportPlayer(spot); steps(W, 60);
      // a leaf a hand ajar is no shut door: no row; and one that starts to open ends the look at once
      const e = go(); const locked = d.locked; d.locked = false; d.angle = 0.1 * (d.swing || 1); d.vel = 0; W.step(DT); W.step(DT); const byAjar = !pl.wanding, ajarRows = rowsOf(g);
      d.angle = 0.9 * (d.swing || 1); W.step(DT); W.step(DT); const rows = rowsOf(g);
      d.angle = 0; d.vel = 0; d.latched = true; d.locked = locked; steps(W, 30);
      F.verdict(a && bySpace && b && byEsc && c && byBlast && noRound && s1 && byShove && e && byAjar && !ajarRows.includes('wand') && !rows.includes('wand'),
        'Space, Esc, a blast that folds him, a shove off his spot and the leaf starting to open each pull it out; a door ajar or open has no such row', `live ${a}/${b}/${c}/${s1}/${e} · Space ${bySpace} · Esc ${byEsc} · folded ${byBlast} · shoved ${byShove} · ajar 0.1 rad ${byAjar} (rows ${ajarRows.join(' ')}) · open: rows ${rows.join(' ')}`);

      // hands on something else: a script asking for the wand starts nothing; the lock's tools taken up end a look
      const P = await import(`${ROOT}/src/game/player.ts`);
      pl.coding = d; P.startWand(g, d); const whileCoding = !!pl.wanding; pl.coding = null; pl.codeT = 0;
      const p1 = go(); P.startPicking(g, d); const pickEnds = !pl.wanding && pl.picking === d; P.stopPicking(g); steps(W, 60);
      F.verdict(!whileCoding && p1 && pickEnds, 'keying a pad he cannot start a look; taking up the lock pick ends one', `started while keying ${whileCoding} · live ${p1}, the pick ended it ${pickEnds}`);

      // the door blown off its hinges with the cable under it: his hands come off it
      const blastWas = DOORBLAST.on; let t1 = false, torn = false, byTear = false;
      try { DOORBLAST.on = true;   // (the frozen stand holds 'a blast takes a door off its hinges' off: raised for this line, as the page has it)
        t1 = go(); torn = tearOff(g, d, [L.pos[0], 0.9, L.pos[2]], 0, 1); byTear = !pl.wanding; steps(W, 30); } finally { DOORBLAST.on = blastWas; }
      F.verdict(t1 && torn && byTear && pl.equipT > 0, 'the door blown off its hinges takes the wand out of his hands', `live ${t1}, torn off ${torn}, out ${byTear}`);
    }
    { const { W, g, pl, d, T } = await atDoor(6); pl.wand = true; W.step(DT);
      // the row gives way: a man in reach to grab takes a row, the door's own rows come next, and the wand is the one that goes
      const alone = g.nearby.map((x: any) => `${x.kind}:${x.verb}`);
      const H = g.guards.find((x: any) => x.team === 'hostile' && x !== T && x.state !== 'dead'), was = H ? [...H.char.pos] : null, u = d.dir();
      let crowded: string[] = [];
      if (H) { for (const sgn of [1, -1]) { const yaw = Math.atan2(u[0] * sgn, u[1] * sgn); H.char.pos = [pl.char.pos[0] + u[0] * sgn * 0.75, 0, pl.char.pos[2] + u[1] * sgn * 0.75] as any; H.char.bodyYaw = yaw; H.char.aimYaw = yaw; steps(W, 3);
          crowded = g.nearby.map((x: any) => `${x.kind}:${x.verb}`); if (crowded.some(x => x.startsWith('guard:'))) break; }
        H.char.pos = was as any; steps(W, 20); }
      F.verdict(alone.includes('door:wand') && three(alone) && crowded.some(x => x.startsWith('guard:')) && crowded.some(x => x.startsWith('door:')) && !crowded.includes('door:wand') && three(crowded),
        'the wand is the row that gives way: with a man in reach to grab, his row and the door\'s own fill the three and the wand is not among them (a charge by hand is the one row under the three)', `alone at the door: ${alone.join(' ')} · with a man beside him: ${crowded.join(' ')}`);

      // going down ends it — a dead man's lens shows the team nothing
      begin(W); feed(W, T.char.pos); steps(W, 60, () => { W.cursorAt(T.char.pos); }); const d1 = !!pl.wanding?.live, sawHim = !g.fogOfWar.hidden(T); pl.down = true; const eyeDown = WD.wandEye(g) === null; W.step(DT); const byDown = !pl.wanding; steps(W, 120); const hidDown = g.fogOfWar.hidden(T);
      F.verdict(d1 && sawHim && eyeDown && byDown && hidDown, 'a man who goes down is looking at nothing', `live ${d1}, the man behind the door seen ${sawHim} · down: no lens ${eyeDown}, out ${byDown}, the man hidden again ${hidDown}`);
    }
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; WAND.markSecs = mark; FOG.lastSeen = lastWas; Math.random = rnd; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── doors
export async function wandDoors(): Promise<boolean> {
  const F = family('wand-doors: on every door of every squad and quiet level the lens comes out on the far side of the leaf, in the open');
  const onWas = WAND.on, rnd = Math.random;
  try {
    raise();
    const files = new Set<string>(['office.json']);
    for (const s of [...SCENARIOS, ...QUIET_MISSIONS] as any[]) { const f = s.level ?? s.levelFile ?? /levelFile=([\w.-]+\.json)/.exec(s.query ?? s.href ?? '')?.[1]; if (f && existsSync(resolve(ROOT, 'levels', f))) files.add(f); }
    let faces = 0, bad: string[] = [], fits = 0; const per: string[] = [];
    for (const file of files) {
      const W = await stand(7, file === 'office.json' ? undefined : file), g = W.game; let n = 0;
      for (const d of g.doors.list) {
        if (!WD.wandFits(d)) continue; fits++;
        for (const side of [1, -1] as const) {
          faces++; n++;
          const L = wandLens(d, side), near = wandLens(d, -side as 1 | -1).pos, f = [Math.sin(L.yaw), Math.cos(L.yaw)];
          const through = g.col.segmentBlocked(near, L.pos);                                    // the shut leaf is between the kneeling side and the lens
          const ahead = g.col.segmentBlocked(L.pos, [L.pos[0] + f[0] * 0.35, L.pos[1], L.pos[2] + f[1] * 0.35]);   // nothing hard against the lens
          const up = g.col.segmentBlocked(L.pos, [L.pos[0], 1.2, L.pos[2]]);                     // … and it is not inside a wall's foot
          if (!through || ahead || up) bad.push(`${file}:${d.def.name}:${side}${!through ? ' no leaf between' : ''}${ahead ? ' blocked ahead' : ''}${up ? ' under something' : ''}`);
        }
      }
      per.push(`${file.replace('.json', '')} ${n}`);
    }
    F.verdict(files.size >= 8 && faces > 100 && bad.length === 0, 'every face of every shut door the wand fits', `${files.size} levels, ${fits} doors, ${faces} faces (${per.join(' · ')})${bad.length ? ` · BAD: ${bad.slice(0, 12).join(' | ')}${bad.length > 12 ? ` … ${bad.length}` : ''}` : ''}`);
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; Math.random = rnd; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── mate
/** The maintainer, 10-16, asked whether a teammate should look under the door with the wand first: "a, but yeah you have to order it". */
export async function wandMate(): Promise<boolean> {
  const F = family('wand-mate: a teammate may carry the wand, and looks under a shut door only on your order (X on the door, then V)');
  const onWas = WAND.on, mateWas = WAND.mate, rnd = Math.random, ownWas = FOG.own, lsWas = FOG.lastSeen;
  const raiseMate = () => { raise(); WAND.mate = !BREAK; };
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  /** Red One's card with the wand on it: under the pouches rule his issued card is full, so a stun canister is given up for it. */
  const card = () => { if (!K.kitSet(1, 'wand', true)) { K.kitSet(1, 'bangs', Math.max(0, K.KIT.members[1].bangs - 1)); K.kitSet(1, 'wand', true); } return !!K.KIT.members[1].wand; };
  try {
    await keepKit(async () => {
      // the card
      const has = (i: number) => K.kitRows(i).some((r: any) => r.field === 'wand');
      // what this machine keeps: a teammate's wand, on a visit with his row off, stays in the store and is not on his card
      {
        const mem: Record<string, string> = {}, shelf = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
        const stored = () => { try { return !!JSON.parse(mem[K.KIT_LS] ?? '{}').members?.[1]?.wand; } catch { return false; } };
        raiseMate(); K.kitLoad(shelf as any, '');
        K.kitSet(1, 'bangs', Math.max(0, K.KIT.members[1].bangs - 1)); const put = K.kitSet(1, 'wand', true); K.kitSave(); const st1 = stored();
        WAND.mate = false; K.kitLoad(shelf as any, '');
        const offCard = !!K.KIT.members[1].wand, offLine = K.kitCost(1).lines.some((l: any) => l.item === 'wand'), offRow = has(1);
        K.kitSet(2, 'bangs', Math.max(0, K.KIT.members[2].bangs - 1)); K.kitSave(); const st2 = stored();
        raiseMate(); K.kitLoad(shelf as any, '');
        const backCard = !!K.KIT.members[1].wand; K.kitSet(1, 'wand', false); K.kitSave(); const st3 = stored();
        F.verdict(put && st1 && !offCard && !offLine && !offRow && st2 && backCard && !st3, 'a wand kept on a teammate\'s card: on a visit with his row off it is not on his card (no pouch, no row) and another row changed does not write it out of the store; with the row back it is on his card, and taken off there it is gone from the store',
          `put on ${put}, stored ${st1} · row off: on his card ${offCard}, a pouch ${offLine}, a row ${offRow}, stored after another change ${st2} · row on again: on his card ${backCard}, stored once taken off ${st3}`);
      }
      raise(); WAND.mate = false; K.kitLoad(null, '');
      const rowOff = [1, 2, 3, 4].map(has);
      raiseMate();
      const rowOn = [1, 2, 3, 4].map(has), full = K.kitCost(1), t0 = K.kitTry(1, 'wand', 1), none = !K.KIT.members[1].wand;
      const gave = K.kitSet(1, 'bangs', K.KIT.members[1].bangs - 1), took = K.kitSet(1, 'wand', true), c1 = K.kitCost(1);
      F.verdict(K.SLOTS.on && !rowOff.some(Boolean) && rowOn.every(Boolean) && none && full.free === 0 && !t0.ok && /pouch/.test(t0.why) && gave && took && c1.used === full.used && c1.lines.some((l: any) => l.item === 'wand'),
        'a teammate\'s card has the row only with its switch; nobody is issued one; his issued card is full, so it is refused until he gives a pouch up, and then it takes that pouch',
        `row with it off ${rowOff.map(Number).join('')} on ${rowOn.map(Number).join('')} · issued ${full.used} of ${full.total} · tried: ${t0.ok ? 'taken' : t0.why} · a stun given up ${gave}, wand ${took}, ${c1.used} of ${c1.total} · ${c1.lines.map((l: any) => `${l.n} ${l.item}`).join(', ')}`);

      // the room clear with four, Red One carrying it, a defender behind the shut server door
      const W = await stand(5), g = W.game; raiseMate(); FOG.own = false; FOG.lastSeen = 0;
      const carded = card();
      await hushed(() => startFromQuery(g, 'roomclear&squad4')); await hushed(() => steps(W, 30));
      const S = g.orders, fog = g.fogOfWar, d = g.doors.list.find((x: any) => x.def.name === 'server'), T = g.guards.find((x: any) => x.callsign === 'Tango 5');
      if (!d || !T || !fog.active) throw new Error(`no stage: door ${!!d} man ${!!T} fog ${fog.active}`);
      g.aiEnabled = false;
      const squad: any[] = S.squad(), carriers = squad.filter(gd => K.kitOf(gd)?.wand), him = carriers[0];
      if (!him) throw new Error(`nobody was staged with the wand (card ${carded}, ${squad.length} men)`);
      const doorTgt = (x: any) => { const c = x.frameCentre; return S.targetAt([c[0], 0, c[2]]); };
      const tgt = doorTgt(d), wandEyes = () => fog.eyes.filter((e: any) => e.wand), jobs = () => WO.wandOrderJobs(g), ordersOf = () => squad.map(gd => S.of(gd)?.order ?? '-');
      const run = (n: number, each: () => void) => hushed(() => { for (let i = 0; i < n; i++) { W.step(DT); each(); } });
      const until = (cap: number, done: () => boolean, each?: () => void) => hushed(() => { let n = 0; while (n < cap && !done()) { W.step(DT); n++; each?.(); } return n; });

      let drawn0 = 0, eyes0 = 0, jobs0 = 0, knelt0 = 0;
      await run(300, () => { drawn0 += fog.drawn(T) ? 1 : 0; eyes0 += wandEyes().length; jobs0 += jobs().length; knelt0 += squad.some(gd => gd.char.anim.lockpick) ? 1 : 0; });
      F.verdict(carriers.length === 1 && tgt.kind === 'door' && !jobs0 && !eyes0 && !knelt0 && !drawn0, 'carried and never ordered, five seconds: nobody kneels at a door, no lens is among the fog\'s eyes, the man behind the door is not in the picture',
        `carrying: ${carriers.map(gd => gd.callsign).join(', ')} · jobs ${jobs0} · lens eyes ${eyes0} · frames a man knelt ${knelt0} · frames he was drawn ${drawn0}`);

      // the menu
      S.open(tgt);
      const rows: any[] = S.menu?.rows ?? [], wr = rows.find(x => x.id === WO.WAND_ORDER), high = rows.filter(x => x.key != null && +x.key > 5).map(x => x.id);
      S.close(); S.open(S.targetAt(g.player.char.pos));
      const elsewhere = (S.menu?.rows ?? []).some((x: any) => x.id === WO.WAND_ORDER), elseKind = S.menu?.target.kind; S.close();
      F.verdict(!!wr && wr.hotKey === WAND.orderKey && !wr.key && !high.length && !elsewhere, 'the order is a row of a door\'s menu on a key of its own, V: it takes no digit, no row is on a digit above 5, and no other target\'s menu lists it',
        `door menu: ${rows.map(x => `${x.id}${x.key ? `(${x.key})` : x.hotKey ? `[${x.hotKey}]` : ''}`).join(' ')} · above 5: ${high.join(',') || 'none'} · on a '${elseKind}' menu ${elsewhere}`);

      // V with no menu is still his whistle; V on the door's menu is the order, and no whistle
      const b0 = WH.WHISTLE_STATS.blown; W.input.pressed.add(WAND.orderKey); W.step(DT);
      const whistled = WH.WHISTLE_STATS.blown - b0, jobsW = jobs().length;
      await run(150, () => {});   // past the whistle's own gap
      S.open(tgt);
      const before = ordersOf(), b1 = WH.WHISTLE_STATS.blown, st0 = WO.WANDORDER_STATS.ordered;
      W.input.pressed.add(WAND.orderKey); W.step(DT);
      const js = jobs(), after = ordersOf(), others = squad.every((gd, i) => gd === him || after[i] === before[i]), side = js[0]?.side;
      F.verdict(whistled === 1 && !jobsW && !S.menu && js.length === 1 && js[0].gd === him && js[0].door === d && S.of(him)?.order === WO.WAND_ORDER && others && WH.WHISTLE_STATS.blown === b1 && WO.WANDORDER_STATS.ordered === st0 + 1,
        'X on the door, then V: the man who carries it takes the order, the other three keep theirs, the menu goes, and the press is not a whistle (with no menu up V whistles as ever and orders nobody)',
        `no menu: whistles ${whistled}, jobs ${jobsW} · on the menu: jobs ${js.map((j: any) => `${j.gd.callsign} side ${j.side}`).join(', ') || 'none'} · his order ${S.of(him)?.order} · the others ${before.join(',')} → ${after.join(',')} · whistles ${WH.WHISTLE_STATS.blown - b1}`);

      // he walks up, kneels, feeds it; the lens is his eye
      let early = 0, drawnWalk = 0;
      const walk = await until(1500, () => !!jobs()[0]?.live, () => { if (!jobs()[0]?.live) { early += wandEyes().length; drawnWalk += fog.drawn(T) ? 1 : 0; } });
      const L = wandLens(d, side), pan = wandPanMax(), e0: any = wandEyes()[0], kneel: number[] = [...him.char.pos];
      const at0 = { knelt: !!him.char.anim.lockpick, side: g.doors.side(d, him.char.pos), off: flat(him.char.pos, L.pos), there: S.of(him)?.there ?? '' };
      let bad = 0, offArc = 0, most = 0, seenN = 0, twice = 0, lo = 9, hi = -9;
      await run(360, () => {
        const es: any[] = wandEyes(); most = Math.max(most, fog.eyes.length); seenN += fog.seen(T) ? 1 : 0;
        twice += fog.eyes.filter((e: any) => e.id === him.char.id).length !== 1 ? 1 : 0;
        if (es.length !== 1 || es[0].id !== him.char.id || flat(es[0].pos, L.pos) > 1e-6 || Math.abs(es[0].pos[1] - WAND.eyeY) > 1e-6) { bad++; return; }
        const a = wrap(Math.atan2(es[0].look[0], es[0].look[2]) - L.yaw); lo = Math.min(lo, a); hi = Math.max(hi, a); if (Math.abs(a) > pan + 1e-6) offArc++;
      });
      F.verdict(walk < 1500 && !early && !drawnWalk && at0.knelt && at0.side === side && at0.off < 1.2 && !!e0 && e0.fov === wandFov() && /^looking under/.test(at0.there) && !bad && !offArc && !twice && most <= 5 && seenN > 0 && hi - lo > pan,
        'he walks to the door, kneels on the squad\'s side and feeds it: nothing is seen before the lens is through; then his eye among the fog\'s is the lens beyond the leaf, on the floor, sweeping between the wand\'s own stops, and the man behind the door is seen',
        `live after ${(walk * DT).toFixed(1)} s · lens eyes before ${early}, frames drawn before ${drawnWalk} · knelt ${at0.knelt}, side ${at0.side}/${side}, ${at0.off.toFixed(2)} m from the lens · '${at0.there}' · six seconds: frames without exactly his lens ${bad}, beyond the stops ${offArc}, counted twice ${twice}, most eyes ${most}, swept ${(lo / DEG).toFixed(0)}°‥${(hi / DEG).toFixed(0)}° of ±${(pan / DEG).toFixed(0)}° · frames the man was seen ${seenN} of 360`);

      // only the player's own eyes lift the fog: the lens he ordered still does
      FOG.own = true; let ownSeen = 0, ownIds = ''; const pid = g.player.char.id;
      await run(360, () => { ownSeen += fog.seen(T) ? 1 : 0; ownIds = fog.eyes.map((e: any) => `${e.id}${e.wand ? 'W' : ''}`).join(','); });
      FOG.own = false; await run(30, () => {});
      F.verdict(ownIds === `${pid},${him.char.id}W` && ownSeen > 0, 'under \'only my own eyes\' the fog\'s eyes are the player and the lens he ordered, nobody else, and the man is seen through it', `eyes ${ownIds} · frames seen ${ownSeen} of 360`);

      // blinded: the lens is out, and is fed again
      him.dazzledUntil = g.time + 0.5; W.step(DT); W.step(DT);
      const dz = { eyes: wandEyes().length, live: !!jobs()[0]?.live, knelt: !!him.char.anim.lockpick };
      const back = await until(900, () => !!jobs()[0]?.live);
      F.verdict(!dz.eyes && !dz.live && !dz.knelt && back < 900 && back * DT > 0.5 + WAND.feedSecs - 0.2, 'blinded, his lens shows nothing and he is off his knee; it is fed again from the start once he can see', `blind: lens eyes ${dz.eyes}, live ${dz.live}, knelt ${dz.knelt} · live again after ${(back * DT).toFixed(1)} s (blind 0.5 + feed ${WAND.feedSecs})`);

      // any other order ends the look; the man he saw keeps the wand's mark
      await run(60, () => {});
      const fell = S.give('fallIn', tgt, 'all'); W.step(DT); W.step(DT);
      const g1 = { jobs: jobs().length, knelt: !!him.char.anim.lockpick, order: S.of(him)?.order, eyes: wandEyes().length };
      const lost = await until(900, () => !fog.drawn(T)), mk = fog.lastSeen().filter((m: any) => m.gd === T)[0];
      F.verdict(fell === null && !g1.jobs && !g1.knelt && g1.order === 'fallIn' && !g1.eyes && lost < 900 && !!mk && mk.life === WAND.markSecs,
        '\'fall in\' ends it on the frame: he is up, the lens is out of the fog\'s eyes; the man he saw goes out of the picture and keeps the wand\'s own fading mark', `given: ${fell ?? 'yes'} · jobs ${g1.jobs}, knelt ${g1.knelt}, his order ${g1.order}, lens eyes ${g1.eyes} · out of the picture after ${(lost * DT).toFixed(1)} s · mark ${mk ? `life ${mk.life} s` : 'none'}`);

      // the leaf moves under the lens
      const again = S.give(WO.WAND_ORDER, tgt, 'all'), w2 = await until(1500, () => !!jobs()[0]?.live), mv0 = WO.WANDORDER_STATS.moved;
      d.angle = 0.6 * (d.swing || 1); await run(5, () => {});
      const h1 = { jobs: jobs().length, knelt: !!him.char.anim.lockpick, order: S.of(him)?.order, eyes: wandEyes().length, moved: WO.WANDORDER_STATS.moved - mv0 };
      await run(300, () => {});
      const A2 = S.of(him), stepped = flat(him.char.pos, kneel);
      F.verdict(again === null && w2 < 1500 && !h1.jobs && !h1.knelt && h1.order === 'hold' && !h1.eyes && h1.moved === 1 && !!A2?.arrived && A2.order === 'hold' && stepped > 0.4,
        'given again by code he looks again; the leaf comes off its latch under the lens: the wand is out, he is up, and he holds on the door from beside it, off the spot he knelt on', `given: ${again ?? 'yes'}, live after ${(w2 * DT).toFixed(1)} s · leaf moved: jobs ${h1.jobs}, knelt ${h1.knelt}, his order ${h1.order}, lens eyes ${h1.eyes} · five seconds on: '${A2?.there}' arrived ${A2?.arrived}, ${stepped.toFixed(2)} m from where he knelt`);

      // the room fight takes his gun: the lens is out for as long as it has him, and is fed again from the start
      const others2: any[] = g.doors.list.filter((x: any) => x !== d && wandFits(x));
      let dA: any = null; for (const x of others2) if (S.give(WO.WAND_ORDER, doorTgt(x), 'all') === null) { dA = x; break; }
      const wA = dA ? await until(2400, () => !!jobs()[0]?.live) : 2400;
      let ovEyes = 0, ovLive = 0, ovKnelt = 0;
      await hushed(() => { for (let i = 0; i < 20; i++) { if (him.script) him.script.over = { aimAt: [him.char.pos[0] + 3, 1.2, him.char.pos[2]], face: null }; W.step(DT); if (i > 1) { ovEyes += wandEyes().length; ovLive += jobs()[0]?.live ? 1 : 0; ovKnelt += him.char.anim.lockpick ? 1 : 0; } } if (him.script) him.script.over = null; });
      const ovJob = jobs().length, ovBack = await until(900, () => !!jobs()[0]?.live);
      F.verdict(!!dA && wA < 2400 && !ovEyes && !ovLive && !ovKnelt && ovJob === 1 && ovBack < 900 && ovBack * DT > WAND.feedSecs - 0.2,
        'ordered to a second shut door he looks there; while the room fight has his gun on something the lens shows nothing and he is off his knee, the order still his; let go, he feeds it again from the start', `second door ${dA?.def.name ?? 'none took the order'}, live after ${(wA * DT).toFixed(1)} s · under the fight: lens eyes ${ovEyes}, live ${ovLive}, knelt ${ovKnelt} frames of 18 · job kept ${ovJob} · live again after ${(ovBack * DT).toFixed(1)} s (feed ${WAND.feedSecs})`);

      // ordered to another door from his knees: he is up on the frame, and kneels again only at the new door
      let dB: any = null; const o0 = WO.WANDORDER_STATS.ordered;
      for (const x of others2) if (x !== dA && wandFits(x) && S.give(WO.WAND_ORDER, doorTgt(x), 'all') === null) { dB = x; break; }
      W.step(DT);
      const r1 = { knelt: !!him.char.anim.lockpick, jobs: jobs().length, door: jobs()[0]?.door, eyes: wandEyes().length, live: !!jobs()[0]?.live };
      let farKnee = 0; const LB = dB ? wandLens(dB, jobs()[0]?.side ?? 1) : null;
      const wB = dB ? await until(2400, () => !!jobs()[0]?.live, () => { if (LB && him.char.anim.lockpick && flat(him.char.pos, LB.pos) > 1.5) farKnee++; }) : 2400;
      const eB: any = wandEyes()[0];
      F.verdict(!!dB && !r1.knelt && r1.jobs === 1 && r1.door === dB && !r1.eyes && !r1.live && WO.WANDORDER_STATS.ordered === o0 + 1 && wB < 2400 && !farKnee && !!eB && !!LB && flat(eB.pos, LB.pos) < 1e-6,
        'given a third door while he kneels at the second: he is on his feet that frame with one job, for the new door; he walks there upright and the lens is under the new door', `third door ${dB?.def.name ?? 'none took the order'} · the frame after: knelt ${r1.knelt}, jobs ${r1.jobs}, for it ${r1.door === dB}, lens eyes ${r1.eyes} · frames on a knee away from it ${farKnee} · live after ${(wB * DT).toFixed(1)} s`);

      // its switch thrown under a man who is looking: a plain hold where he is
      WAND.mate = false; W.step(DT); W.step(DT);
      const sw = { jobs: jobs().length, knelt: !!him.char.anim.lockpick, order: S.of(him)?.order, eyes: wandEyes().length };
      raiseMate(); W.step(DT);
      F.verdict(!sw.jobs && !sw.knelt && sw.order === 'hold' && !sw.eyes && !jobs().length, 'its switch thrown off under a man who is looking: the lens is out, he is up and on a plain hold; thrown on again, nobody looks unasked', `off: jobs ${sw.jobs}, knelt ${sw.knelt}, his order ${sw.order}, lens eyes ${sw.eyes} · on again: jobs ${jobs().length}`);

      // what is refused, in words
      const openR = S.give(WO.WAND_ORDER, tgt, 'all');
      const steel = g.doors.list.find((x: any) => x.def.steel), steelR = steel ? S.give(WO.WAND_ORDER, doorTgt(steel), 'all') : 'no steel door';
      const shut = g.doors.list.find((x: any) => x !== d && wandFits(x)), blueR = shut ? S.give(WO.WAND_ORDER, doorTgt(shut), 'blue') : 'no shut door';
      F.verdict(typeof openR === 'string' && typeof steelR === 'string' && !!steel && typeof blueR === 'string' && !!shut && /wand/.test(blueR) && !jobs().length, 'refused in words, nobody sent: a door that is not shut, a steel door, men who carry no wand', `open: ${openR} · steel (${steel?.def.name}): ${steelR} · the blue pair on ${shut?.def.name}: ${blueR}`);

      // its switch, thrown on a running game
      WAND.mate = false; W.step(DT);
      const offDef = S.defs.some((x: any) => x.id === WO.WAND_ORDER), offRow = has(1);
      raiseMate(); W.step(DT);
      const onDef = S.defs.some((x: any) => x.id === WO.WAND_ORDER);
      F.verdict(!offDef && !offRow && onDef, 'its switch off on a running game: the order is off every menu and the card row is gone; on again, the order is back', `off: order listed ${offDef}, card row ${offRow} · on again: ${onDef}`);

      // carried and never ordered = the build without it, by digest
      const play = async (mate: boolean) => {
        const W = await stand(11), g = W.game; raise(); WAND.mate = mate; card(); Math.random = seeded(4242);
        await hushed(() => { startFromQuery(g, 'roomclear&squad4'); steps(W, 600); });
        return { h: hashDigest(digestGame(g, true)), row: g.orders.defs.some((x: any) => x.id === WO.WAND_ORDER), jobs: WO.wandOrderJobs(g).length, eyes: g.fogOfWar.eyes.filter((e: any) => e.wand).length };
      };
      const a = await play(false), b = await play(!BREAK);
      F.verdict(a.h === b.h && !a.row && b.row && !b.jobs && !b.eyes, 'ten seconds of the four-man room clear with the wand on Red One\'s card digest the same with its switch off and on: carried and not ordered, nothing differs', `off ${a.h} · on ${b.h} · order listed ${a.row}/${b.row} · jobs ${b.jobs} · lens eyes ${b.eyes}`);
    });
    const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], P = await import(`${ROOT}/src/host/profile.ts`);
    F.verdict(s.includes('TPS_WANDMATE') && P.FROZEN_HOLDS['WAND.mate'] === 'TPS_WANDMATE=1', 'the switch is a row of the two stands\' list and has its word', `STAND_ENV ${s.includes('TPS_WANDMATE')} · FROZEN_HOLDS ${P.FROZEN_HOLDS['WAND.mate']}`);
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; WAND.mate = mateWas; FOG.own = ownWas; FOG.lastSeen = lsWas; Math.random = rnd; }
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function wandOff(): Promise<boolean> {
  const F = family('wand-off: the switch off is the build as it was, and a wand carried and never used changes nothing');
  const onWas = WAND.on, rnd = Math.random;
  try {
    const run = async (on: boolean, carry: boolean) => {
      const W = await stand(11), g = W.game; WAND.on = on; Math.random = seeded(4242);
      await hushed(() => { startFromQuery(g, 'roomclear&squad4'); steps(W, 5); g.player.wand = carry; steps(W, 595); });
      return { h: hashDigest(digestGame(g, true)), row: g.doors.list.some((d: any) => wandOffered(g, g.player, d)), eye: !!g.fogOfWar.eyes[0]?.wand, rows: K.kitRows(0).some((r: any) => r.field === 'wand') };
    };
    const a = await run(false, false), b = await run(false, true), c = await run(true, false), d = await run(!BREAK, true);
    F.verdict(a.h === b.h && a.h === c.h && a.h === d.h, 'ten seconds of the four-man room clear digest the same four ways', `off ${a.h} · off, flag forced ${b.h} · on, none carried ${c.h} · on, carried ${d.h}`);
    F.verdict(!a.row && !b.row && !c.row && d.row && !a.rows && !a.eye && !d.eye, 'off, or not carried: no door offers the look and the card has no row; on and carried: shut doors offer it, and nothing is looked through unasked', `offered: ${a.row} ${b.row} ${c.row} ${d.row} · kit row with it off ${a.rows} · lens eye ${a.eye}/${d.eye}`);
    const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], P = await import(`${ROOT}/src/host/profile.ts`), R = (await import(`${ROOT}/src/game/knobs.ts`)).knobRegistry();
    F.verdict(s.includes('TPS_WAND') && P.FROZEN_HOLDS['WAND.on'] === 'TPS_WAND=1' && R.WAND === WAND, 'the switch is a row of the two stands\' list, has its word, and is in the knob registry', `STAND_ENV ${s.includes('TPS_WAND')} · FROZEN_HOLDS ${P.FROZEN_HOLDS['WAND.on']} · registry ${R.WAND === WAND}`);
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { WAND.on = onWas; Math.random = rnd; }
  return F.done();
}

export async function wandCheck(only?: string): Promise<boolean> {
  let ok = true;
  const parts: [string, () => Promise<boolean>][] = [['kit', wandKit], ['tile', wandTile], ['look', wandLook], ['costs', wandCosts], ['doors', wandDoors], ['mate', wandMate], ['off', wandOff]];
  for (const [name, fn] of parts) if (!only || only === name) ok = (await fn()) && ok;
  return ok;
}
if (import.meta.main) { const ok = await wandCheck(process.argv[2]); process.exit(ok ? 0 : 1); }
