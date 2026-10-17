// THE SOLO NIGHT OPENS UNDER THE FOG OF WAR (src/game/quietfog.ts — QUIETFOG.solo, off as shipped in the module and on the frozen stand).
//   bun run tools/qa/probes.ts solo-fog          (family: solofog)        ·  bun run tools/qa/solofog-check.ts
// The solo night's own link (`?solo`, no scenario on it) is read as a quiet row's: the fog of war up on the rung a quiet mission starts on, the mission's
// sticky cameras and its wand handed to the card, a guard no eye has taken out of the picture, all of it again after a restart; `quietfog=off` on the link = every guard shown; a rung named
// on the link is the rung played; a page stood up plain (no `solo`), a showcase's link and a lesson are as they were; with the switch down `?solo` raises
// nothing and hands out nothing, and the same seconds of the plain night digest the same; the screens' no-load start is taken only where the page already
// stands in the link's fog; the two stands' row and a recording from before the key. SOLOFOG_BREAK=1 leaves the switch down: exit 1.
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switches it needs itself. Nothing here looks at a picture.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const QF = await import(`${ROOT}/src/game/quietfog.ts`);
const SC = await import(`${ROOT}/src/game/stickycam.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const KIT = await import(`${ROOT}/src/game/kit.ts`);
const RUN = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DT = 1 / 60, BREAK = process.env.SOLOFOG_BREAK === '1';

/** a game stood up plain on the bundled office (or `file`), the quiet fog's switches as the page has them, QUIETFOG.solo as asked; then the link staged as the page stages its own */
async function night(seed: number, link: string | null, solo: boolean, file: string | null = null) {
  Math.random = seeded(0x501f + seed * 7919);
  const level = file ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) : undefined;
  const W = await hushed(() => standUp(level ? { uploadEvery: 1, level } : { uploadEvery: 1 })) as any, g = W.game;
  SC.STICKY.on = true; WAND.on = true; QF.QUIETFOG.on = true; QF.QUIETFOG.def = 'team'; QF.QUIETFOG.wand = true; QF.QUIETFOG.solo = solo; QF.quietFogForget();
  if (link !== null) { const q = new URLSearchParams(link); await hushed(() => RUN.startFromQuery(g, q)); await hushed(() => KIT.kitSoloIf(g, q.has('solo'))); }
  for (let i = 0; i < 40; i++) W.step(DT);
  const fog = g.fogOfWar, pl = g.player, live = (g.guards as any[]).filter(x => x.state !== 'dead' && !fog.onTeam?.(x));
  return { W, g, fog, pl, on: !!fog.on, active: !!fog.active, held: QF.quietFogHeld(), cone: !!FOG.cone, visit: SC.stickyVisit(g) as number, cams: (pl.rifle?.cams ?? 0) as number, wand: !!pl.wand,
    guards: live.length, hidden: live.filter(x => fog.hidden(x)).length };
}
const say = (n: Awaited<ReturnType<typeof night>>) => `fog on ${n.on}, live ${n.active}, rung held ${n.held}, cones ${n.cone} · handed ${n.visit}, on the rifle ${n.cams}, wand ${n.wand} · guards hidden ${n.hidden} of ${n.guards}`;

export async function soloFog(): Promise<boolean> {
  const title = 'solo-fog: the solo night opens under the fog of war, the mission\'s cameras and wand with it';
  console.log(`\n=== ${title} ===`); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  await hushed(() => standUp({ uploadEvery: 1 }));   // (the stand's own values are on the tables from the first game it stands up: read them after one)
  const was = { ...QF.QUIETFOG }, stood = QF.QUIETFOG.solo, stickyWas = SC.STICKY.on, wandWas = WAND.on, coneWas = FOG.cone, ownWas = FOG.own, soloWas = { ...KIT.KIT_SOLO }, rnd = Math.random;
  const games: any[] = [], up = !BREAK;
  try {
    const a = await night(1, '?solo', up); games.push(a.g);
    verdict(a.on && a.active && a.held && !a.cone && a.visit === SC.STICKY.issue && a.cams === SC.STICKY.issue && a.wand && a.hidden > 0,
      'the solo night\'s own link with the switch up: the fog of war is live on the rung a quiet mission starts on (all round), the mission\'s cameras ride the rifle and the wand is in hand, and guards no eye has are out of the picture', say(a));
    // a restart of the night (a death, the pause card's restart): a fresh player, the fog and the rung still up, the cameras and the wand handed again
    for (let i = 0; i < 3; i++) a.pl.rifle.cams = 0; await hushed(() => a.g.restartEncounter()); for (let i = 0; i < 40; i++) a.W.step(DT);
    const r = { on: !!a.fog.on, active: !!a.fog.active, held: QF.quietFogHeld(), cams: a.g.player.rifle?.cams ?? 0, wand: !!a.g.player.wand, fresh: a.g.player !== a.pl };
    verdict(r.on && r.active && r.held && r.cams === SC.STICKY.issue && r.wand, 'the night restarted: the fog and its rung are still up and the mission\'s cameras and wand are handed again', `fog on ${r.on}, live ${r.active}, rung held ${r.held} · on the rifle ${r.cams}, wand ${r.wand} · a fresh player ${r.fresh}`);
    const b = await night(1, '?solo', false); games.push(b.g);
    verdict(!b.on && !b.active && !b.held && b.visit === 0 && b.hidden === 0 && b.guards === a.guards,
      'the same link with the switch down: no fog, nothing handed out, every guard shown — the solo night as it was', say(b));
    const c = await night(1, '?solo&quietfog=off', up); games.push(c.g);
    verdict(!c.on && c.visit === 0 && c.hidden === 0, '?solo&quietfog=off: every guard shown and no camera with it, the switch up', say(c));
    const d = await night(1, '?solo&quietfog=cones&cams=0', up); games.push(d.g);
    verdict(d.on && d.active && d.cone && d.visit === 0, '?solo&quietfog=cones&cams=0: the rung named on the link is the rung played (the cones), and no cameras handed', say(d));
    const e = await night(1, '', up), f = await night(1, null, up), s = await night(1, '?solo&demo', up), nf = await night(1, '?solo&nofow', up); games.push(e.g, f.g, s.g, nf.g);
    verdict(!e.on && !f.on && !s.on && !nf.on && e.visit + f.visit + s.visit + nf.visit === 0, 'a page stood up plain (no `solo` on its link), a game no link was staged on, a showcase\'s link beside `solo`, and ?solo&nofow: no fog and nothing handed, the switch up', `'' → ${say(e)}\n    (none) → ${say(f)}\n    ?solo&demo → ${say(s)}\n    ?solo&nofow → ${say(nf)}`);
    { const n = await night(1, null, up); games.push(n.g); QF.QUIETFOG.on = false; const q = new URLSearchParams('?solo'); await hushed(() => RUN.startFromQuery(n.g, q)); for (let i = 0; i < 10; i++) n.W.step(DT);
      verdict(!n.g.fogOfWar.on && SC.stickyVisit(n.g) === 0 && !QF.soloFogRow(), 'with the quiet fog\'s own switch down (QUIETFOG.on) the solo switch alone raises nothing', `QUIETFOG.on false, solo ${QF.QUIETFOG.solo}: fog on ${n.g.fogOfWar.on}, handed ${SC.stickyVisit(n.g)}, a fog row ${QF.soloFogRow()}`); QF.QUIETFOG.on = true; }
    const l = await night(1, '?solo&levelFile=train-move.json', up, 'train-move.json'); games.push(l.g);
    verdict(!l.on && l.visit === 0, 'the solo link on a Training lesson\'s level: taught on the level as it is, no fog', say(l));
    // the plain night itself is not touched by the switch: the same seconds digest the same with it down and up
    const run = async (solo: boolean) => { const n = await night(7, '', solo); games.push(n.g); Math.random = seeded(99); for (let i = 0; i < 240; i++) n.W.step(DT); return hashDigest(digestGame(n.g, true)); };
    const h0 = await run(false), h1 = await run(up);
    verdict(h0 === h1, 'four seconds of the plain night (no `solo` on the link) digest the same with the switch down and up', `down ${h0} · up ${h1}`);
    // the links the screens write, and their no-load start
    QF.QUIETFOG.solo = up; QF.quietFogForget();
    const bare = QF.quietFogHref('?solo', QF.soloFogRow()); QF.setQuietFog('cones', false); const moved = QF.quietFogHref('?solo', QF.soloFogRow()); QF.setQuietFog('off', false); const off = QF.quietFogHref('?solo', QF.soloFogRow()); QF.quietFogForget();
    verdict(QF.soloFogRow() && bare === '?solo' && /quietfog=cones/.test(moved) && /quietfog=off/.test(off) && RUN.fogOfQuery(new URLSearchParams(bare)) && !RUN.fogOfQuery(new URLSearchParams(off)),
      'the solo row is one the fog lever is live on: its bare link is the fog, a moved lever is named on it, the bottom rung is quietfog=off', `row ${QF.soloFogRow()} · bare '${bare}' · cones '${moved}' · off '${off}'`);
    const loads = !RUN.sameFog('?solo', ''), stays = RUN.sameFog('?solo', '?solo') && RUN.sameFog('?solo&quietfog=off', ''); QF.QUIETFOG.solo = false; const asWas = RUN.sameFog('?solo', ''); QF.QUIETFOG.solo = up;
    verdict(loads && stays && asWas, 'the screens\' no-load start: off a plain page the solo night under the fog is a load of its own link; where the page already stands in that fog, or the link asks for none, or the switch is down, it is the shortcut it was', `'?solo' off a plain page: same fog ${!loads} · off '?solo': ${RUN.sameFog('?solo', '?solo')} · quietfog=off off a plain page: ${RUN.sameFog('?solo&quietfog=off', '')} · switch down: ${asWas}`);
    // the two stands' row, the word, and a recording from before the key
    const ENV = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], PR = await import(`${ROOT}/src/host/profile.ts`), JR = await import(`${ROOT}/src/game/journal.ts`);
    const shipped = process.env.TPS_PROFILE === 'shipped';
    verdict(stood === (shipped || process.env.TPS_SOLOFOG === '1'), 'as the stand stands a game up: the switch up on the shipped stand, down on the frozen one unless its word raises it', `${shipped ? 'shipped' : 'frozen'} stand: QUIETFOG.solo ${stood}`);
    const W2 = await hushed(() => standUp({ uploadEvery: 1 })) as any; QF.QUIETFOG.on = true; QF.QUIETFOG.solo = true;
    const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W2.game))), old = JSON.parse(JSON.stringify(snap)); const had = snap.tables.QUIETFOG?.solo === true;
    QF.QUIETFOG.solo = false; JR.applyKnobs(W2.game, snap); const kept = QF.QUIETFOG.solo; delete old.tables.QUIETFOG.solo; QF.QUIETFOG.solo = true; JR.applyKnobs(W2.game, old); const before = QF.QUIETFOG.solo;
    verdict(ENV.includes('TPS_SOLOFOG') && PR.FROZEN_HOLDS['QUIETFOG.solo'] === 'TPS_SOLOFOG=1' && had && kept === true && before === false, 'the switch is a row of the two stands\' list with its word, rides a recording\'s tables, and a recording from before the key replays with it down', `STAND_ENV ${ENV.includes('TPS_SOLOFOG')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['QUIETFOG.solo']} · in the tables ${had} · an old recording: ${before} · one recorded with it up: ${kept}`);
  } catch (e) { verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally {
    for (const g of games) try { await hushed(() => RUN.quitScenario(g)); QF.quietFogEnd(); SC.stickyVisitSet(g, 0); } catch { /* nothing staged */ }
    Object.assign(QF.QUIETFOG, was); QF.quietFogForget(); SC.STICKY.on = stickyWas; WAND.on = wandWas; FOG.cone = coneWas; FOG.own = ownWas; Object.assign(KIT.KIT_SOLO, soloWas); Math.random = rnd;
  }
  console.log(`=== solo-fog: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) { const ok = await soloFog(); process.exit(ok ? 0 : 1); }
