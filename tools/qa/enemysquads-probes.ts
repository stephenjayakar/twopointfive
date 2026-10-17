// The 'enemysquads' family (game/enemysquads.ts — defender SQUADS on a level whose room clear structure declares them), run through probes.ts:
//   bun run tools/qa/probes.ts enemysquads | enemysquads-stage | enemysquads-noise | enemysquads-contact | enemysquads-radiocheck
// PASS / FAIL each, all headless (the Game of headless.ts on levels/block-squads.json, started exactly as the page's scenario row starts it). No order is given
// to the team in any of them: what is under test is what each squad DOES with what it hears — how a whole clear goes is the scripted tally's
// (tools/qa/playthrough.ts --scn block-squads, whose RunOut carries every squad's timeline).
//   enemysquads-stage    the file's three squads stand as dealt (Alpha 3 in the mess, Bravo 5 in the workshop + store, Charlie 3 in comms), sixteen characters;
//                        SQUADS.on off, or a level with no squads block (records), stages none — and the seams answer 'not mine'
//   enemysquads-noise    surprise lost on open floor (one loud report where the team starts, nobody in contact): every squad says ONE thing on its net and
//                        gets on its doors, nobody is sent at the noise, and the first contact call is answered at once (SQUADS.openPair = the first cut) — not all of
//                        them out, not all of them at home when a way round exists
//   enemysquads-contact  the team met in one squad's room (Sam stood in the mess): Alpha calls it, Bravo answers inside its beat with men OUT (help or a
//                        pair round) and a man left in each of its rooms, Charlie locks down; the same staging with SQUADS.on off: no squad says anything
//   enemysquads-radiocheck  SQUADS.radioCheck (unseen drops are found by radio check or body): a man dropped silently where no mate can make the body out —
//                        off: his squad is in contact that frame (the rule as it was); on: nothing until he is asked for by name on the net, men WALK to
//                        his post, one of them has the body at his feet, THEN contact; a body in a mate's open view is contact by his eyes; a man taken
//                        from his post (held) is asked for, looked for, 'no sign', the men back at their posts and no call on the net; a loud drop is contact at once
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SQUADS, squadsReport, squadsLive, squadOwns, squadStaysIn, squadCalls, squadMen, mate } = await import(`${ROOT}/src/game/enemysquads.ts`);   // (mate: a man's name as his own squad says it on the net — it follows the dialogue pass, so the expected lines do too)
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { BODY_LIGHT } = await import(`${ROOT}/src/game/guards.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const CHOICES = ['barricade', 'flank', 'help'];
async function rig(file: string, seed: number, on = true) {
  const was = SQUADS.on; SQUADS.on = on; Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn;
  let W: any, why: string | null = null, data: any;
  try {
    data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'));
    console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(data) }); why = (await startFromQuery(W.game, new URLSearchParams(`?levelFile=${file}&roomclear=${seed}&squad4`))).why ?? null;
  } catch (e) { SQUADS.on = was; throw e; }   // (a rig that never stood leaves the switch as it found it)
  finally { console.log = log; console.error = err; console.warn = warn; }
  const g = W.game; g.godMode = true;
  const said: string[] = []; { const say = g.say.bind(g); g.say = (gd: any, t: string, radio?: boolean) => { if (radio) said.push(t); return say(gd, t, radio); }; }
  if (g.cues?.net) { const net = g.cues.net.bind(g.cues); g.cues.net = (gd: any, t: string, cls: number) => { said.push(t); return net(gd, t, cls); }; }   // (a line on the net that is no bubble: the radio check's, the last stand's)
  return { W, g, data, why, said, step(secs: number) { for (let i = 0; i < secs * 60; i++) { g.player.visibility = 0.05; W.step(DT); } }, done() { SQUADS.on = was; },
    choices(name: string) { return (squadsReport(g).find((q: any) => q.name === name)?.events ?? []).filter((e: any) => CHOICES.includes(e.what)); } };
}
// where 'the team is in the mess' is staged: Alpha's own rally point as the level file gives it. The block's rooms turn a corner since its rebuild, and the
// spot these probes had picked by eye off the old plan is behind a wall on the new one; the rally is where the file's author gathers the squad, on open floor
// of the mess in its men's view on the block as it stands (nothing in the format promises that: the lines that stand Sam here say where he ended up, and
// 'Alpha is in contact' is red when nobody of it sees him)
const messSpot = (R: any): number[] => { const r = R.data.scenarios.roomClear.squads.find((q: any) => q.id === 'alpha')?.rally; if (!r) throw new Error('enemysquads probes: block-squads.json gives Alpha no rally point to stand Sam on'); return [r[0], 0, r[2]]; };
const stood = (g: any) => `Sam at ${g.player.char.pos[0].toFixed(1)}, ${g.player.char.pos[2].toFixed(1)}${inRoom(g, 'mess', g.player.char.pos) ? ', in the mess' : ', NOT in the mess'}`;
const inRoom = (g: any, id: string, p: number[]) => { const b = g.roomClear.structure.rooms.find((r: any) => r.id === id).bounds; return p[0] >= b.x0 && p[0] <= b.x1 && p[2] >= b.z0 && p[2] <= b.z1; };

export async function enemysquadsStage(): Promise<boolean> {
  const F = family('enemysquads-stage: the squads of the file stand as dealt; off, or no squads block, stages none');
  const R = await rig('block-squads.json', 1);
  try {
    const g = R.g, rep = squadsReport(g);
    F.verdict(validateLevelData(R.data).length === 0 && !R.why, 'levels/block-squads.json validates and the scenario starts', `validate ${validateLevelData(R.data).length} errors · start ${R.why ?? 'ok'}`);
    F.verdict(rep.map((q: any) => `${q.name} ${q.men}`).join(' · ') === 'Alpha 3 · Bravo 5 · Charlie 3' && squadsLive(g), 'three squads take the eleven defenders by the rooms they were dealt into', rep.map((q: any) => `${q.name} ${q.men} ${q.state}`).join(' · '));
    F.verdict(1 + g.guards.length === 16 && g.nightBreach.hostiles.length === 11, 'sixteen characters on the floor: Sam, the four, eleven defenders', `${1 + g.guards.length} characters · ${g.nightBreach.hostiles.length} defenders`);
    const H = g.nightBreach.hostiles;
    F.verdict(H.every((h: any) => squadOwns(g, h)) && H.filter((h: any) => squadStaysIn(g, h)).length === 3, 'every defender is a squad\'s man; Charlie\'s three stay in its rooms', `owned ${H.filter((h: any) => squadOwns(g, h)).length}/11 · stay in ${H.filter((h: any) => squadStaysIn(g, h)).length}`);
    R.step(6);
    F.verdict(squadsReport(g).every((q: any) => q.state === 'hold' && !q.events.length) && !R.said.length, 'with nothing heard and nobody met, every squad holds and the net is silent', squadsReport(g).map((q: any) => `${q.name} ${q.state}`).join(' · ') + ` · ${R.said.length} radio lines`);
  } finally { R.done(); }
  const Off = await rig('block-squads.json', 1, false);
  try { F.verdict(!squadsLive(Off.g) && !squadsReport(Off.g).length && !Off.g.nightBreach.hostiles.some((h: any) => squadOwns(Off.g, h)), 'SQUADS.on off: the same eleven men, no squads — one pool', `live ${squadsLive(Off.g)} · ${Off.g.nightBreach.hostiles.length} defenders`); } finally { Off.done(); }
  // (squaddeal.ts, a later rule, cuts a level with no squads block into squads of its rooms: held off for this stand-up by the stand's own word — squaddeal-check.ts holds that rule)
  const sd0 = process.env.TPS_SQUADDEAL; process.env.TPS_SQUADDEAL = '0';
  const B = await rig('records.json', 1).finally(() => { if (sd0 === undefined) delete process.env.TPS_SQUADDEAL; else process.env.TPS_SQUADDEAL = sd0; });   // (the block carried no squads until its rebuild dealt its eight men into four; records is a room clear whose file declares none)
  try { F.verdict(!B.why && B.g.nightBreach.hostiles.length > 0 && !squadsLive(B.g) && !B.g.nightBreach.hostiles.some((h: any) => squadOwns(B.g, h) || squadStaysIn(B.g, h)), 'a level with no squads block (records): its defenders stand, none staged, the seams answer no', `start ${B.why ?? 'ok'} · live ${squadsLive(B.g)} · ${B.g.nightBreach.hostiles.length} defenders`); } finally { B.done(); }
  return F.done();
}

export async function enemysquadsNoise(): Promise<boolean> {
  const F = family('enemysquads-noise: surprise lost on open floor — nobody walks out at a noise, every squad stands to on its doors, and the first call is answered at once');
  let went = 0, runs = 0;
  for (const seed of [1, 2, 3]) {
    const R = await rig('block-squads.json', seed);
    try {
      const g = R.g; R.step(1);
      const at = [g.player.char.pos[0], 0, g.player.char.pos[2]];
      g.events.push({ kind: 'shot', pos: at, time: g.time, loud: true, level: 1, who: PLAYER_ID });
      R.step(6.5);
      const rep = squadsReport(g), ch = rep.map((q: any) => ({ name: q.name, c: R.choices(q.name) }));
      const words = ch.map((x: any) => `${x.name}: ${x.c.map((e: any) => `${e.what}@${e.t}`).join(',') || '-'}`).join(' · ');
      F.verdict(ch.every((x: any) => x.c.length === 1), `seed ${seed}: every squad has said one thing`, words);
      F.verdict(ch.every((x: any) => x.c[0]?.what === 'barricade') && rep.every((q: any) => q.out === 0), `seed ${seed}: nobody is sent at a noise nobody can place — every squad is on its doors`, `${ch.filter((x: any) => x.c[0]?.what === 'barricade').length} of ${ch.length} barricade · ${rep.reduce((n: number, q: any) => n + q.out, 0)} men out`);
      const charlie = g.roomClear.rooms.find((r: any) => r.def.id === 'comms').defenders;
      F.verdict(charlie.every((h: any) => inRoom(g, 'comms', h.char.pos)), `seed ${seed}: Charlie (mayLeave false) stays in comms`, charlie.map((h: any) => `${h.callsign} (${h.char.pos[0].toFixed(1)}, ${h.char.pos[2].toFixed(1)})`).join(' '));
      F.verdict(ch.every((x: any) => R.said.some(t => t.startsWith(`${x.name}:`))), `seed ${seed}: each word was said on the net under the squad's name`, R.said.join(' | ').slice(0, 300));
      // then the team is on the mess (a loud round inside it, Sam stood there in plain light): the squads that stood to have their answer out after the
      // net's lag and a short beat, not a thinking beat — men sent, or 'stays on its doors' when too few of it are free of their door work to spare a pair
      const mess = messSpot(R); g.teleportPlayer(mess); g.events.push({ kind: 'shot', pos: mess, time: g.time, loud: true, level: 1, who: PLAYER_ID });
      for (let i = 0; i < 4 * 60; i++) { g.player.visibility = 1; R.W.step(DT); }
      const call = squadsReport(g).find((q: any) => q.name === 'Alpha').events.find((e: any) => e.what === 'contact');
      const b = R.choices('Bravo').find((e: any) => call && e.t >= call.t);
      const word = call ? g.fight.log.find((l: any) => l.t >= call.t && /^\[squads\] Bravo (flank|help|barricade|stays on its doors)/.test(l.what)) : null;
      const lag = call && word ? word.t - call.t : NaN, cap = SQUADS.netLag + SQUADS.readyBeat + 0.35;
      F.verdict(!!call && !!word && lag <= cap, `seed ${seed}: Alpha calls contact and Bravo, stood to, has its answer inside ${cap.toFixed(2)} s (a squad taken by surprise thinks ${SQUADS.think[0]} to ${SQUADS.think[1]} s on top of the lag)`, call ? `Alpha contact @${call.t} · ${word ? `${word.what.slice(9)} @${word.t.toFixed(1)} (${lag.toFixed(2)} s)` : 'Bravo said nothing'}` : 'no contact call');
      runs++; if (b && b.what !== 'barricade') went++;
    } finally { R.done(); }
  }
  F.verdict(went >= 1, 'over the three seeds somebody went once the team was placed (they do not all sit)', `${went} of ${runs} runs: Bravo sent men at the call`);
  // the first cut, kept behind SQUADS.openPair: the squad next to the nearest one sends a pair round to the noise. WHICH squad is nearest is counted over the
  // men still on their posts when a squad's word comes, and the words come in the dice's order: when the nearest squad has spoken and its near men have left
  // their posts for their doors, the next squad finds ITSELF nearest and sits too (seeds 1 and 3 on the block's rebuilt floor) — so the line is asked over
  // three seeds: a pair goes at least once, never from two squads at once, and somebody locks down every time
  { const was = SQUADS.openPair; SQUADS.openPair = true; const cut: { seed: number; flank: number; sat: boolean; steps: number; words: string }[] = [];
    try {
      for (const seed of [1, 2, 3]) {
        const R = await rig('block-squads.json', seed);
        try {
          const g = R.g; R.step(1);
          g.events.push({ kind: 'shot', pos: [g.player.char.pos[0], 0, g.player.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID });
          let stepsHeard = 0; const seen = new Set<any>();
          for (let i = 0; i < 9 * 4; i++) { R.step(0.25); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'step' && e.who !== PLAYER_ID && g.nightBreach.hostiles.some((h: any) => h.char.id === e.who)) stepsHeard++; } }
          const ch = squadsReport(g).map((q: any) => ({ name: q.name, c: R.choices(q.name) }));
          cut.push({ seed, flank: ch.filter((x: any) => x.c[0]?.what === 'flank').length, sat: ch.some((x: any) => x.c[0]?.what === 'barricade'), steps: stepsHeard, words: ch.map((x: any) => `${x.name}: ${x.c.map((e: any) => `${e.what}@${e.t}`).join(',') || '-'}`).join(' · ') });
        } finally { R.done(); }
      }
    } finally { SQUADS.openPair = was; }
    const gone = cut.filter(r => r.flank === 1);
    F.verdict(gone.length >= 1 && cut.every(r => r.flank <= 1 && r.sat) && gone.every(r => r.steps > 0), 'openPair on (the first cut): over the three seeds a squad sends a pair round to the noise at least once and never two squads at once, its boots filed as hearing events, somebody locks down every time', cut.map(r => `seed ${r.seed}: ${r.words} · ${r.steps} step events`).join(' | '));
  }
  return F.done();
}

export async function enemysquadsContact(): Promise<boolean> {
  const F = family('enemysquads-contact: the team met in the mess — Alpha calls it, Bravo sends men, Charlie locks down; off: nobody says anything');
  for (const on of [true, false]) {
    const R = await rig('block-squads.json', 2, on);
    try {
      const g = R.g; R.step(1);
      g.teleportPlayer(messSpot(R)); g.player.visibility = 1;
      for (let i = 0; i < 9 * 60; i++) { g.player.visibility = 1; R.W.step(DT); }
      const rep = squadsReport(g);
      if (!on) { F.verdict(!rep.length && !R.said.some(t => /^(Alpha|Bravo|Charlie):/.test(t)), 'SQUADS.on off: no squad line on the net (the stock rally and the room fight as ever)', `${R.said.length} radio lines, none a squad's`); continue; }
      const ev = (n: string) => rep.find((q: any) => q.name === n).events;
      F.verdict(ev('Alpha').some((e: any) => e.what === 'contact') && R.said.some(t => /^Alpha: contact/.test(t)), 'Alpha is in contact and says so', ev('Alpha').map((e: any) => `${e.what}@${e.t}`).join(',') + ' · ' + (R.said.find(t => /^Alpha/.test(t)) ?? '-') + ' · ' + stood(g));
      const b = R.choices('Bravo')[0], bravo = rep.find((q: any) => q.name === 'Bravo');
      F.verdict(!!b && (b.what === 'help' || b.what === 'flank') && b.t <= 1 + 0.8 + SQUADS.think[1] + 3, 'Bravo answers inside its beat with men out: help, or a pair round', b ? `${b.what} at ${b.t} s: ${b.why}` : 'nothing');
      const out = g.roomClear.rooms.filter((r: any) => r.def.id === 'shop' || r.def.id === 'store').map((r: any) => ({ id: r.def.id, home: r.defenders.filter((h: any) => h.state !== 'dead' && inRoom(g, r.def.id, h.char.pos)).length }));
      F.verdict(!!b && b.n >= 2 && bravo.men - b.n >= 2 && bravo.men - b.n <= SQUADS.helpMen, 'two or three of Bravo went, a man stayed for each of its rooms', b ? `${bravo.men - b.n} sent, ${b.n} at home at the word · now ${out.map((o: any) => `${o.id} ${o.home}`).join(', ')}` : '-');
      F.verdict(R.choices('Charlie')[0]?.what === 'barricade' && R.choices('Charlie').length === 1, 'Charlie locks down, once', R.choices('Charlie').map((e: any) => `${e.what}@${e.t}`).join(','));
      // Charlie locks down in one of two lines, and which is the game's to say: 'holding' while Alpha has a man up, "Alpha's not answering" once it has none
      // (the team's four are on the floor and fight for themselves: as shipped they have the mess cleared before Charlie's word). The line said must be the one
      // Alpha's state at that word calls for
      const cT = R.choices('Charlie')[0]?.t ?? NaN, aDown = ev('Alpha').find((e: any) => e.what === 'down'), gone = !!aDown && aDown.t <= cT, want = gone ? /^Charlie: Alpha's not answering — lock the doors/ : /^Charlie: holding — lock the doors/, other = gone ? /^Charlie: holding/ : /^Charlie: Alpha's not answering/;
      F.verdict(R.said.some(t => /^Bravo: (moving to Alpha|two going round)/.test(t)) && R.said.some(t => want.test(t)) && !R.said.some(t => other.test(t)), `both said it on the net (Charlie: ${gone ? `"Alpha's not answering", Alpha down @${aDown.t} before its word @${cT}` : `"holding", Alpha still up at its word @${cT}`})`, R.said.filter(t => /^(Bravo|Charlie)/.test(t)).join(' | '));
    } finally { R.done(); }
  }
  return F.done();
}

export async function enemysquadsRadiocheck(): Promise<boolean> {
  const F = family('enemysquads-radiocheck: a drop nobody saw or heard is found out by the squad\'s radio check or by a mate\'s eyes on the body — off, the drop itself is contact');
  const wasOn = SQUADS.radioCheck, wasLit = { lit: BODY_LIGHT.lit, litNear: BODY_LIGHT.litNear };
  SQUADS.callBeat = false;   // (the lines before section 18 ask about the drop and the eyes rules alone; the shipped stand opens with the call beat on, which puts a squad's contact a call's length after its man's — section 18 raises it itself)
  const dark =(on: boolean) => { BODY_LIGHT.lit = on ? 99 : wasLit.lit; BODY_LIGHT.litNear = on ? 99 : wasLit.litNear; };   // (a floor too dark to make a body out past the near rule's 2 m)
  const flatD = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const bravo = (g: any) => { const rs = g.roomClear.rooms.filter((r: any) => r.def.id === 'shop' || r.def.id === 'store'); return rs.flatMap((r: any) => r.defenders.filter((h: any) => h.state !== 'dead')); };
  // the Bravo man standing farthest from his nearest mate: the drop a mate is least likely to have at his feet
  const loneliest = (g: any) => { const B = bravo(g); let best = B[0], bd = -1; for (const m of B) { const d = Math.min(...B.filter((x: any) => x !== m).map((x: any) => flatD(x.char.pos, m.char.pos))); if (d > bd) { bd = d; best = m; } } return { m: best, d: bd }; };
  const ev = (g: any, n: string) => squadsReport(g).find((q: any) => q.name === n).events as any[];
  const first = (E: any[], what: string) => E.find(e => e.what === what)?.t ?? NaN;
  const until = (R: any, secs: number, stop: () => boolean) => { for (let i = 0; i < secs * 60 && !stop(); i++) { R.g.player.visibility = 0.05; R.W.step(DT); } };
  try {
    // ---- 1 · off: the drop itself is contact (the rule as it was)
    { SQUADS.radioCheck = false; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), t0 = g.time; killGuard(g, m, [1, 0, 0], true); R.step(0.1);
        const c = first(ev(g, 'Bravo'), 'contact');
        F.verdict(c - t0 <= 0.11 && R.said.some(t => /^Bravo: contact/.test(t)), 'off: a man of Bravo dropped silently in the dark — the squad is in contact that frame and calls it', `${m.callsign} down @${t0.toFixed(2)} · Bravo contact @${c} · ${R.said.join(' | ')}`);
      } finally { R.done(); } }
    // ---- 2 · on, dark: nothing at the drop; asked for by name; men walk to his post; the body at a man's feet; contact
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m, d } = loneliest(g), t0 = g.time, at = [m.char.pos[0], 0, m.char.pos[2]]; killGuard(g, m, [1, 0, 0], true); R.step(0.1);
        F.verdict(!ev(g, 'Bravo').some(e => e.what === 'contact') && !R.said.some(t => /contact/.test(t)), 'on: the same drop — no contact at the drop, nothing said', `${m.callsign} down @${t0.toFixed(2)}, his nearest mate ${d.toFixed(1)} m off · Bravo ${squadsReport(g).find((q: any) => q.name === 'Bravo').state} · ${R.said.length} radio lines`);
        let walked = 0, n = 0; until(R, 90, () => { for (const x of bravo(g)) if (x.script && x.speed > 0.4) { walked = Math.max(walked, x.speed); n++; } return ev(g, 'Bravo').some(e => e.what === 'contact'); });
        const E = ev(g, 'Bravo'), asks = first(E, 'asks'), looks = first(E, 'looks'), found = first(E, 'found'), c = first(E, 'contact');
        const iAsk = R.said.findIndex(t => new RegExp(`^Bravo: ${mate(m)}\\? … ${mate(m)}, sound off`).test(t)), iGo = R.said.findIndex(t => new RegExp(`^Bravo: nothing from ${mate(m)} — (one|two) moving to his post!`).test(t)), iC = R.said.findIndex(t => /^Bravo: contact/.test(t));
        F.verdict(asks > t0 && looks > asks && found >= looks && c >= found, 'he is asked for, then looked for, then found, then it is contact — in that order', `down @${t0.toFixed(1)} · asks @${asks} · looks @${looks} · found @${found} · contact @${c} (${(c - t0).toFixed(1)} s after the drop; off: 0.0) · ${E.map(e => `${e.what}@${e.t}`).join(',')} · ${E.find(e => e.what === 'contact')?.why ?? ''}`);
        F.verdict(iAsk >= 0 && iGo > iAsk && iC > iGo, 'the cue is on the radio in the squad\'s name: asked for by name, "moving to his post", and only then the contact call', R.said.filter(t => /^Bravo/.test(t)).join(' | '));
        F.verdict(walked > 0.4 && walked <= g.tune.guardInvestigate + 0.3, 'the men who go to look WALK (the pace of a man going to look, their boots filed)', `fastest looker ${walked.toFixed(2)} m/s over ${n} frames · walk ${g.tune.guardInvestigate} · the chase ${g.tune.guardChase}`);
        const others = ['Alpha', 'Charlie'].map(q => ({ q, e: ev(g, q).filter(e => e.t < c && e.what !== 'check') }));
        F.verdict(others.every(o => !o.e.length) && !R.said.slice(0, iC).some(t => /^(Alpha|Charlie): (?!radio check)/.test(t)), 'no other squad moves or speaks before the body is found (their own radio checks aside)', others.map(o => `${o.q}: ${o.e.map(e => e.what).join(',') || '-'}`).join(' · '));
        const b = m.char.bones.hips ?? m.char.pos; F.verdict(flatD(b, at) < 3, '(the body lay where he stood)', `${flatD(b, at).toFixed(1)} m from the spot`);
      } finally { R.done(); } }
    // ---- 3 · on, lit: a body in a mate's open view is contact by his eyes, no check needed
    { SQUADS.radioCheck = true; dark(false); BODY_LIGHT.lit = 0; BODY_LIGHT.litNear = 0;   // (a floor light enough everywhere: what is under test is eyes, cone and line)
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const B = bravo(g);
        // the man a mate is looking at: nearest to the line of a mate's chest
        let m = B[0], best = -2; for (const v of B) for (const x of B) { if (x === v) continue; const to = [v.char.pos[0] - x.char.pos[0], v.char.pos[2] - x.char.pos[2]], l = Math.hypot(to[0], to[1]) || 1, c = (to[0] * x.char.chestDir[0] + to[1] * x.char.chestDir[2]) / l; if (l < 10 && c > best && !g.col.segmentBlocked([x.char.pos[0], 1.6, x.char.pos[2]], [v.char.pos[0], 0.9, v.char.pos[2]])) { best = c; m = v; } }
        const t0 = g.time; killGuard(g, m, [1, 0, 0], true); until(R, 6, () => ev(g, 'Bravo').some(e => e.what === 'contact'));
        const E = ev(g, 'Bravo'), found = first(E, 'found'), c = first(E, 'contact');
        F.verdict(best > 0.5 && c - t0 < 3 && found <= c && !E.some(e => e.what === 'asks' || e.what === 'looks'), 'lit: a man dropped in a mate\'s view — his mate has the body in sight, contact, nobody had to ask', `${m.callsign} (cos ${best.toFixed(2)} off a mate's chest) down @${t0.toFixed(2)} · found @${found} · contact @${c} · ${E.map(e => e.what).join(',')}`);
      } finally { R.done(); } }
    // ---- 4 · on: a man taken from his post — asked for, looked for, no sign: back on their doors, nothing on the net
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), t0 = g.time, home = bravo(g).length;
        const away = () => { m.held = true; m.char.pos[0] = -60; m.char.pos[2] = -60; }; away();   // (in somebody's arm, carried clean off the floor: nobody's eyes on either of them)
        until(R, 120, () => { away(); return ev(g, 'Bravo').some(e => e.what === 'no sign'); });
        const E = ev(g, 'Bravo'), asks = first(E, 'asks'), looks = first(E, 'looks'), none = first(E, 'no sign');
        F.verdict(asks > t0 && looks > asks && none > looks && !E.some(e => e.what === 'contact'), 'a held man is asked for, looked for, and not found: no contact', `asks @${asks} · looks @${looks} · no sign @${none} · ${E.map(e => e.what).join(',')}`);
        F.verdict(R.said.some(t => new RegExp(`^Bravo: no sign of ${mate(m)} — back on our doors!`).test(t)), 'they say so on the radio', R.said.filter(t => /^Bravo/.test(t)).join(' | '));
        until(R, 25, () => { away(); return false; });
        const rep = squadsReport(g), back = bravo(g).filter((x: any) => x !== m && (inRoom(g, 'shop', x.char.pos) || inRoom(g, 'store', x.char.pos))).length;
        const men = bravo(g).filter((x: any) => x !== m);
        F.verdict(men.every((x: any) => x.state !== 'alert' && x.state !== 'search' && x.awareness < 0.5 && !x.script), 'and nobody is roused by it: they saw no one (wary at most, back on their posts)', men.map((x: any) => `${x.callsign} ${x.state} ${x.awareness.toFixed(2)}`).join(' · '));
        F.verdict(back === home - 1 && rep.find((q: any) => q.name === 'Bravo').out === 0, 'the men who went are back in the squad\'s rooms', `${back} of ${home - 1} in the workshop and store · ${rep.find((q: any) => q.name === 'Bravo').out} out`);
        F.verdict(['Alpha', 'Charlie'].every(q => !ev(g, q).some(e => e.what !== 'check')) && !ev(g, 'Bravo').some(e => (e.what === 'asks' && e.t > none) || e.what === 'contact') && squadsReport(g).every((q: any) => q.state === 'hold'), 'no other squad is told, nobody is in contact, and he is not asked for again', ['Alpha', 'Charlie'].map(q => `${q}: ${ev(g, q).map(e => e.what).join(',') || '-'}`).join(' · '));
      } finally { R.done(); } }
    // ---- 4b · on: a man let go of while they are on their way — they turn back, and he is asked for again the next time he is taken
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), p0 = [m.char.pos[0], m.char.pos[1], m.char.pos[2]];
        const away = () => { m.held = true; m.char.pos[0] = -60; m.char.pos[2] = -60; }; away();
        until(R, 120, () => { away(); return ev(g, 'Bravo').some(e => e.what === 'looks'); });
        m.held = false; m.char.pos[0] = p0[0]; m.char.pos[2] = p0[2]; until(R, 20, () => false);
        const E = ev(g, 'Bravo');
        F.verdict(R.said.some(t => new RegExp(`^Bravo: ${mate(m)}'s answering — back on our doors!`).test(t)) && !R.said.some(t => /no sign of/.test(t)), 'let go of while they walk: "he\'s answering", not "no sign"', R.said.filter(t => /^Bravo/.test(t)).join(' | '));
        const n0 = E.filter(e => e.what === 'asks').length; until(R, 80, () => { away(); return ev(g, 'Bravo').filter(e => e.what === 'asks').length > n0; });
        F.verdict(ev(g, 'Bravo').filter(e => e.what === 'asks').length > n0, 'taken again, he is asked for again', ev(g, 'Bravo').map(e => `${e.what}@${e.t}`).join(','));
      } finally { R.done(); } }
    // ---- 4c · on: the last man of a squad goes to look himself, finds the body, and CALLS it
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const A = g.roomClear.rooms.find((r: any) => r.def.id === 'mess').defenders.filter((h: any) => h.state !== 'dead');
        // the two of Alpha standing nearest each other go down in the dark; the third is the squad
        let pair = [A[0], A[1]], bd = Infinity; for (const a of A) for (const b of A) if (a !== b && flatD(a.char.pos, b.char.pos) < bd) { bd = flatD(a.char.pos, b.char.pos); pair = [a, b]; }
        const lastMan = A.find((x: any) => !pair.includes(x)); for (const x of pair) killGuard(g, x, [1, 0, 0], true);
        until(R, 120, () => ev(g, 'Alpha').some(e => e.what === 'contact' || e.what === 'no sign'));
        const E = ev(g, 'Alpha');
        F.verdict(A.length === 3 && E.some(e => e.what === 'looks') && E.some(e => e.what === 'contact') && R.said.some(t => /^Alpha: contact/.test(t)), 'one man left of Alpha: he asks, goes himself, finds a body and calls contact on the net', `${lastMan?.callsign} · ${E.map(e => `${e.what}@${e.t}`).join(',')} · ${R.said.filter(t => /^Alpha/.test(t)).join(' | ')}`);
      } finally { R.done(); } }
    // ---- 5 · on: a loud drop is contact at once (a drop a mate heard keeps the reaction it had)
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), t0 = g.time;
        g.events.push({ kind: 'shot', pos: [m.char.pos[0], 0, m.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, m, [1, 0, 0], false); R.step(0.5);
        const c = first(ev(g, 'Bravo'), 'contact');
        F.verdict(c - t0 <= 0.2, 'a man shot down LOUD in its rooms: contact at once, switch on or off', `down @${t0.toFixed(2)} · Bravo contact @${c}`);
      } finally { R.done(); } }
    // ---- 6 · on: the same from OUTSIDE the wall — the report is not in its rooms, but a mate at home heard gunfire as he dropped: contact, as it was
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), t0 = g.time, p = g.player.char.pos;
        g.events.push({ kind: 'shot', pos: [p[0], 0, p[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, m, [1, 0, 0], false); R.step(1.2);
        const E = ev(g, 'Bravo'), c = first(E, 'contact');
        F.verdict(!inRoom(g, 'shop', p) && !inRoom(g, 'store', p) && c - t0 <= 1.2 && !E.some(e => e.what === 'asks'), 'a man shot down by gunfire heard from outside its rooms: contact at once, nobody asks', `shot from (${p[0].toFixed(1)}, ${p[2].toFixed(1)}) · down @${t0.toFixed(2)} · ${E.map(e => `${e.what}@${e.t}`).join(',')}`);
      } finally { R.done(); } }
    // ---- 7 · the second piece (noticedEyes): a hard sighting by a man who has not noticed is not the squad's contact; his own alert is
    for (const on of [false, true]) { SQUADS.radioCheck = false; SQUADS.noticedEyes = on; dark(false);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g), t0 = g.time;
        const glimpse = (secs: number) => { for (let i = 0; i < secs * 60; i++) { m.lastSeenT = g.time; g.player.visibility = 0.05; R.W.step(DT); } };
        glimpse(0.5);
        const E = ev(g, 'Bravo'), c = first(E, 'contact'), st = `${m.callsign} ${m.state} ${m.awareness.toFixed(2)}`;
        if (!on) F.verdict(c - t0 <= 0.11, 'eyes, off: a hard sighting by a man of Bravo who has noticed nothing (patrol) — the squad is in contact that frame, as it was', `${st} · sighting from @${t0.toFixed(2)} · Bravo contact @${c}`);
        else {
          F.verdict(!E.some(e => e.what === 'contact') && E.some(e => e.what === 'glimpse') && !R.said.some(t => /contact/.test(t)) && m.state !== 'alert', 'eyes, on: the same half second of sighting — no contact, nothing said, and the squad\'s log says why', `${st} · ${E.map(e => `${e.what}@${e.t.toFixed(2)}`).join(',')}`);
          const t1 = g.time; m.awareness = 1; glimpse(0.2);   // (his own bar: guards.ts moves him to 'alert' at awareness 0.85)
          const c2 = first(ev(g, 'Bravo'), 'contact');
          F.verdict(m.state === 'alert' && c2 >= t1 && c2 - t1 <= 0.11 && R.said.some(t => /^Bravo: contact/.test(t)), 'eyes, on: the frame HE goes alert on it the squad is in contact and calls it — the man is no slower, the squad no longer ahead of him', `${m.callsign} ${m.state} · his alert from @${t1.toFixed(2)} · Bravo contact @${c2}`);
        }
      } finally { R.done(); } }
    SQUADS.noticedEyes = false;
    // ---- 8 · a fall HEARD (the dropped man's weapon on the floor, by the ordinary hearing model): the hearer asks for him by name; heardAsks off = he does not
    for (const asks of [true, false]) { SQUADS.radioCheck = true; SQUADS.heardAsks = asks; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const B = bravo(g);
        let m = B[0], bd = Infinity; for (const x of B) { const d = Math.min(...B.filter((y: any) => y !== x).map((y: any) => flatD(y.char.pos, x.char.pos))); if (d < bd) { bd = d; m = x; } }   // the man with a mate nearest him
        const t0 = g.time, at = m.char.pos; killGuard(g, m, [1, 0, 0], true); R.step(0.6);
        g.events.push({ kind: 'prop', pos: [at[0], 0, at[2]], time: g.time, level: 0.5, who: 0 });   // (his weapon on the floor, as a drop in play files it ~0.6 s on: staged, so the probe does not hang on where the gun bounced)
        until(R, 5, () => ev(g, 'Bravo').some(e => e.what === 'asks' || e.what === 'contact'));
        const E = ev(g, 'Bravo'), heard = E.find(e => e.what === 'check' && /heard something/.test(e.why))?.t ?? NaN, a = first(E, 'asks'), line = `${m.callsign} down @${t0.toFixed(2)}, his nearest mate ${bd.toFixed(1)} m off · ${E.map(e => `${e.what}@${e.t.toFixed(2)}`).join(',') || 'nothing'}`;
        if (asks) F.verdict(heard > t0 && a > heard && a - t0 < 4 && !E.some(e => e.what === 'contact'), 'ears: a mate who hears him fall asks for him by name within a few seconds — no contact from the sound', line);
        else F.verdict(!(heard > 0) && !(a > 0) && !E.some(e => e.what === 'contact'), 'ears, heardAsks off: the same fall leads to no call at all in the next 5 s (his own turn of the head, then the routine check)', line);
      } finally { R.done(); } }
    // ---- 9 · the check keeps its own dice: until the switch changes something, the run with it on is the run with it off
    { const moved: string[] = [], draws: number[] = [], checks: number[] = [];
      for (const on of [false, true]) { SQUADS.radioCheck = on; dark(false);
        const R = await rig('block-squads.json', 3);
        try { const g = R.g; const die = Math.random; let n = 0; Math.random = () => { n++; return die(); };
          R.step(50); Math.random = die;
          const d = digestGame(g, true) as any; for (const x of d.guards ?? []) delete x.bubble;
          moved.push(hashDigest(d)); draws.push(n); checks.push(R.said.filter((t: string) => /radio check — sound off$/.test(t)).length);
        } finally { R.done(); } }
      F.verdict(moved[0] === moved[1] && draws[0] === draws[1] && checks[0] === 0 && checks[1] >= 3, 'dice: 50 s with nobody dropped — the squads\' checks are called, and the game is the one it is with the switch off (same digest but for the bubbles, the same number of draws from the game\'s dice)', `off ${moved[0]} · ${draws[0]} draws · ${checks[0]} checks  |  on ${moved[1]} · ${draws[1]} draws · ${checks[1]} checks`);
    }
    // ================ the review's findings (rebuild/quiet-squad-maps/review/findings.md): each of these fails on the switch as first built
    const park = (g: any) => { for (const o of g.nightBreach.ops) { o.char.pos[0] = -80; o.char.pos[2] = -80; } };   // (the team clean off the floor: what is under test is the squad and its own man)
    // ---- 10 · A1: a body the round threw a metre from the post is found by the men sent to it (they stop short of the post; it is at their feet all the same)
    // (which men: on the rebuilt block the store's two stand 2 m apart, and the one left has the other's body in his plain eyes the moment he turns from his door —
    //  a true find, by the eyes rule and not this one. The lit case drops a man of the workshop, whose mates come to him round the room's corner)
    for (const c of [{ v: 0, dir: [0, 0, -1], real: true, name: 'the floor\'s own light' }, { v: 2, dir: [1, 0, 0], real: false, name: 'a floor too dark to see a body on' }]) { SQUADS.radioCheck = true; SQUADS.noticedEyes = true; dark(!c.real);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; park(g); R.g.player.visibility = 0.05; R.W.step(DT); park(g); for (let i = 0; i < 59; i++) { R.W.step(DT); park(g); }
        const m = bravo(g)[c.v], at = [m.char.pos[0], 0, m.char.pos[2]]; killGuard(g, m, c.dir, false);
        until(R, 150, () => { park(g); return ev(g, 'Bravo').some(e => e.what === 'no sign' || e.what === 'contact'); });
        const E = ev(g, 'Bravo'), h = m.char.bones.hips ?? m.char.pos, found = E.find(e => e.what === 'found');
        F.verdict(E.some(e => e.what === 'looks') && !!found && /sent to look/.test(found.why) && E.some(e => e.what === 'contact') && !E.some(e => e.what === 'no sign') && !R.said.some(t => /no sign of/.test(t)),
          `A1 (${c.name}): the men sent to a silent post find the body lying ${flatD(h, at).toFixed(2)} m from it — never "no sign" over a body at their feet`, `${m.callsign} · ${E.map(e => `${e.what}@${e.t}`).join(',')} · ${found?.why ?? 'not found'}`);
      } finally { R.done(); } }
    SQUADS.noticedEyes = false;
    // ---- 11 · A2: what only a dead man heard dies with him — nobody else asks for the first man by name on the dead hearer's clock
    { SQUADS.radioCheck = true; SQUADS.heardAsks = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const B = bravo(g);
        // the man with TWO mates nearest him (his second-nearest mate the closest of anybody's), and furniture knocked hard as he went down — the event game.ts
        // files for a prop struck at that speed (level 1, loud), which turns a corner: the rooms of the rebuilt block each turn one, and the lines below need
        // a first hearer AND a second. A dropped weapon's clatter (0.5 at most) has ONE hearer for every man of Bravo on that floor: the second line's case
        // cannot come of a clatter there
        let m = B[0], bd = Infinity; for (const x of B) { const d = B.filter((y: any) => y !== x).map((y: any) => flatD(y.char.pos, x.char.pos)).sort((p: number, q: number) => p - q)[1]; if (d < bd) { bd = d; m = x; } }
        const at = m.char.pos; killGuard(g, m, [1, 0, 0], true); R.step(0.6);
        g.events.push({ kind: 'prop', pos: [at[0], 0, at[2]], time: g.time, loud: true, level: 1, who: 0 });
        const heardRow = () => ev(g, 'Bravo').find(e => e.what === 'check' && /heard something/.test(e.why));
        until(R, 3, () => !!heardRow());
        const hr = heardRow(), ear = B.find((x: any) => hr && hr.why.startsWith(`${x.callsign} heard`));
        const tDead = g.time; if (ear) killGuard(g, ear, [1, 0, 0], true);   // (the hearer drops as quietly, before he has asked)
        R.step(SQUADS.checkHeard[1] + 1.5);
        const E = ev(g, 'Bravo'), routine = (t: number) => E.some(e => e.what === 'check' && /calls the squad/.test(e.why) && e.t >= tDead - 0.05 && e.t <= t);
        // (a mate who heard the fall HIMSELF has a row of his own for it, and his ask is his: only an ask by a man with no such row is on the dead man's clock)
        const own = (e: any) => E.find(c => c.what === 'check' && c.t >= tDead - 0.05 && c.t <= e.t && c.why.includes(`heard something where ${m.callsign} stands`) && !c.why.startsWith(`${ear?.callsign} heard`) && e.why.includes(`: ${c.why.split(' heard')[0]} asks`));
        const asks = E.filter(e => e.what === 'asks' && e.t >= tDead - 0.05 && new RegExp(`no answer from ${m.callsign}:`).test(e.why));
        const bad = asks.find(e => !routine(e.t) && !own(e));
        F.verdict(!!ear && !bad, 'A2: the first man to hear the fall is dropped before he asks — nobody who did not hear it himself asks for the first man by name on his clock (the routine check comes when it was due)',
          `${m.callsign} down, ${ear?.callsign ?? 'nobody'} heard it and went down @${tDead.toFixed(2)} · ${E.map(e => `${e.what}@${e.t}`).join(',')}${bad ? ` · ${bad.why}` : ''}`);
        const second = asks.find(e => !!own(e));
        F.verdict(!!ear && !!second, 'fix-review 4: a second man who heard the fall himself is not left behind "nobody else heard it" — with the first hearer off the net he asks on his own ears',
          second ? `${own(second)!.why} · ${second.why} @${second.t}` : `nobody asks for ${m.callsign} · ${E.map(e => `${e.what}@${e.t}`).join(',')}`);
      } finally { R.done(); } }
    // ---- 12 · A3: news of the team between the ask and the send — nobody walks off to look
    { SQUADS.radioCheck = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g; R.step(1); const { m } = loneliest(g);
        const away = () => { m.held = true; m.char.pos[0] = -60; m.char.pos[2] = -60; }; away();
        until(R, 120, () => { away(); return ev(g, 'Bravo').some(e => e.what === 'asks'); });
        const tAsk = g.time; until(R, 1, () => { away(); return false; });
        const a = g.roomClear.rooms.find((r: any) => r.def.id === 'mess').defenders.filter((h: any) => h.state !== 'dead')[0];   // Alpha is hit, loud: the whole floor hears of the team
        g.events.push({ kind: 'shot', pos: [a.char.pos[0], 0, a.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, a, [1, 0, 0], false);
        let walkers = 0; until(R, Math.max(SQUADS.checkSend, SQUADS.checkAsk + 1) + 1, () => { away(); return false; });
        const E = ev(g, 'Bravo'), looks = E.filter(e => e.what === 'looks' && e.t >= tAsk - 0.05);
        for (const x of bravo(g)) if (x.script && Math.abs((x.script.speed ?? 0) - g.tune.guardInvestigate) < 1e-6) walkers++;
        F.verdict(E.some(e => e.what === 'asks') && !looks.length && !walkers && !R.said.some(t => /moving to his post/.test(t)), 'A3: the squad hears of the team a second after it asked for its man — the check is dropped, nobody is sent to look',
          `asks @${tAsk.toFixed(1)} · the shot @${(tAsk + 1).toFixed(1)} · ${E.map(e => `${e.what}@${e.t}`).join(',')} · ${walkers} at a looker's walk`);
      } finally { R.done(); } }
    // ---- 13 · A5: a LOUD drop by the player at home is contact on the frame it is with the switch off, and the run after it is the same run
    { const frames: number[] = [], after: string[] = [], draws: number[] = [];
      for (const on of [false, true]) { SQUADS.radioCheck = on; dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); const die = Math.random; let n = 0; Math.random = () => { n++; return die(); };
          g.events.push({ kind: 'shot', pos: [m.char.pos[0], 0, m.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, m, [1, 0, 0], false);
          let f = 0; while (f < 30 && squadsReport(g).find((q: any) => q.name === 'Bravo').state !== 'contact') { g.player.visibility = 0.05; R.W.step(DT); f++; }
          R.step(5); Math.random = die;
          const d = digestGame(g, true) as any; for (const x of d.guards ?? []) delete x.bubble;
          frames.push(f); after.push(hashDigest(d)); draws.push(n);
        } finally { R.done(); } }
      F.verdict(frames[0] === 1 && frames[1] === frames[0] && after[0] === after[1] && draws[0] === draws[1], 'A5: a man shot down loud at home — contact on the same frame with the switch on as off, and five seconds on the game is the same game (digest but for the bubbles, draws from the game\'s dice)',
        `off: contact ${frames[0]} frame(s) after the round · ${after[0]} · ${draws[0]} draws  |  on: ${frames[1]} frame(s) · ${after[1]} · ${draws[1]} draws`);
    }
    // ---- 14 · B1: the check's lines are never a man's bubble (his own barks wait behind his bubble and draw the game's dice) — the whole digest agrees, bubbles and all
    { const whole: string[] = [], bub: number[] = [], lines: number[] = [], cls: string[] = [];
      for (const on of [false, true]) { SQUADS.radioCheck = on; dark(false);
        const R = await rig('block-squads.json', 3);
        try { const g = R.g; let n = 0; let acc = '';
          for (let i = 0; i < 50 * 60; i++) { g.player.visibility = 0.05; R.W.step(DT); if (g.guards.some((x: any) => x.bubble && /sound off|moving to his post|back on our doors/.test(x.bubble.text))) n++; if (i % 30 === 29) acc = hashDigest({ acc, d: digestGame(g, true) }); }
          whole.push(acc); bub.push(n); lines.push(R.said.filter((t: string) => /radio check — sound off$/.test(t)).length);
          cls.push([...new Set((g.cues?.log ?? []).filter((r: any) => /sound off$/.test(r.text)).map((r: any) => r.cls))].join(','));
        } finally { R.done(); } }
      F.verdict(lines[1] >= 3 && bub[1] === 0 && whole[0] === whole[1] && cls[1] === '6', 'B1: 50 s of routine checks — said on the net (the strip\'s last class: a routine line never crowds out an ask or a contact call), never in a man\'s bubble, and the game\'s digest every half second is the one it is with the switch off, bubbles included',
        `off ${whole[0]} · ${lines[0]} checks  |  on ${whole[1]} · ${lines[1]} checks · ${bub[1]} frames with a check line in a bubble · strip class of the routine line: ${cls[1] || 'not filed'}`);
    }
    // ================ the fix's own review (rebuild/quiet-squad-maps/review/fix-review.md): each of these fails on the fix as first made (6449f95)
    // ---- 15 · finding 1: the warehouse's dock doorway — the man sent to look stops in it with the leaf he is pushing between his eye and the body, a metre
    //          from his feet. One glance on the frame he arrives said "no sign" and closed the book; he looks about him for a second now, walking on
    //          (the two men are the shipping office's and the tool cage's. They were the Dock squad's until the warehouse's defenders were placed by hand;
    //          they are a squad of their own now, Stores, and the one who goes to look is the other, through the door between their two rooms — the
    //          squad is asked of the module: squadMen)
    //          NOT A PROOF OF THE LOOK-ABOUT BEAT ANY MORE: on these posts one glance is enough. With the beat at zero in a scratch copy of the tree all five
    //          lines pass, and so does every one of the eleven defenders dropped in each of four directions in the dark (2026-10-13). What they still hold:
    //          the man is asked for, somebody goes, the body is found, and "no sign" is never said over it
    for (const c of [{ v: 10, dir: [0, 0, -1], real: true }, { v: 9, dir: [0, 0, -1], real: true }, { v: 10, dir: [-1, 0, 0], real: true }, { v: 9, dir: [1, 0, 0], real: false }, { v: 10, dir: [-1, 0, 0], real: false }]) { SQUADS.radioCheck = true; SQUADS.noticedEyes = true; dark(!c.real);
      const R = await rig('warehouse.json', 1);
      try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
        const m = g.fight.defs[c.v].gd, at = [m.char.pos[0], 0, m.char.pos[2]];
        const his = (squadsReport(g) as any[]).find(q => squadMen(g, q.name).includes(m)).name;
        killGuard(g, m, c.dir, false);
        until(R, 90, () => { park(g); return ev(g, his).some(e => e.what === 'no sign' || e.what === 'contact'); });
        until(R, 0.5, () => { park(g); return false; });
        const E = ev(g, his), h = m.char.bones.hips ?? m.char.pos, found = E.find(e => e.what === 'found');
        F.verdict(E.some(e => e.what === 'looks') && !!found && E.some(e => e.what === 'contact') && !E.some(e => e.what === 'no sign') && !R.said.some(t => /no sign of/.test(t)),
          `fix-review 1 (${m.callsign} thrown ${c.dir.join(',')}, ${c.real ? 'the floor\'s own light' : 'too dark to see a body on'}): the man sent through the doorway to his post finds the body ${flatD(h, at).toFixed(2)} m from it — "no sign" is never said over it`, `${his} · ${E.map(e => `${e.what}@${e.t}`).join(',')} · ${found?.why ?? 'not found'}`);
      } finally { R.done(); } }
    SQUADS.noticedEyes = false;
    // ---- 16 · finding 2: a fight sputtering somewhere else (a loud report on the open floor every six seconds) does not keep a missing man unlooked-for
    { SQUADS.radioCheck = true; SQUADS.noticedEyes = true; dark(true);
      const R = await rig('block-squads.json', 1);
      try { const g = R.g, p0 = [...g.nightBreach.ops[0].char.pos];
        const off = () => { park(g); g.player.char.pos[0] = -80; g.player.char.pos[2] = -78; };
        off(); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); off(); }
        const m = g.fight.defs[9].gd; killGuard(g, m, [0, 0, 1], true);
        let next = g.time + 3; const went = () => ev(g, 'Bravo').some(e => e.what === 'looks' || e.what === 'found');
        until(R, 150, () => { off(); if (g.time >= next) { next += 6; g.events.push({ kind: 'shot', pos: [...p0], time: g.time, loud: true, level: 1 }); } return went(); });
        const E = ev(g, 'Bravo'), asks = E.filter(e => e.what === 'asks'), drops = g.fight.log.filter((l: any) => /^\[squads\] Bravo check dropped/.test(l.what));
        const wrong = drops.find((l: any) => / not asked for/.test(l.what) && asks.some(a => a.t <= l.t + 0.05 && l.t - a.t < SQUADS.checkSend));
        F.verdict(went() && !wrong, 'fix-review 2: a man dropped quietly while gunfire the squad has answered goes on elsewhere — he is asked for and men go to look (before: asked for twice, nobody ever sent, in 150 s)',
          `${m.callsign} down @1.0 · ${E.filter(e => /check|asks|looks|found|no sign/.test(e.what)).map(e => `${e.what}@${e.t}`).join(',')} · ${drops.length} check(s) dropped${wrong ? ` · "${wrong.what.slice(9)}" said after he was asked for` : ''}`);
      } finally { R.done(); } }
    SQUADS.noticedEyes = false;
    // ---- 17 · finding 4: a charge going off as he drops (the door blown in on the man behind it) is as loud as gunfire — contact on the frame it is with the switch off
    { const frames: number[] = [], after: string[] = [], draws: number[] = [];
      for (const on of [false, true]) { SQUADS.radioCheck = on; SQUADS.noticedEyes = on; dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; park(g); for (let i = 0; i < 300; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
          const m = g.fight.defs[9].gd; const die = Math.random; let n = 0; Math.random = () => { n++; return die(); };
          g.events.push({ kind: 'bang', pos: [m.char.pos[0] + 6, 0, m.char.pos[2]], time: g.time, loud: true }); killGuard(g, m, [1, 0, 0], false);
          let f = 0; while (f < 30 && squadsReport(g).find((q: any) => q.name === 'Bravo').state !== 'contact') { g.player.visibility = 0.05; R.W.step(DT); park(g); f++; }
          for (let i = 0; i < 300; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); } Math.random = die;
          const d = digestGame(g, true) as any; for (const x of d.guards ?? []) delete x.bubble;
          frames.push(f); after.push(hashDigest(d)); draws.push(n);
        } finally { R.done(); } }
      F.verdict(frames[0] === 1 && frames[1] === frames[0] && after[0] === after[1] && draws[0] === draws[1], 'fix-review 3: a man dropped with a charge going off six metres from him — contact on the same frame with the switch on as off, and five seconds on the game is the same game',
        `off: contact ${frames[0]} frame(s) after the blast · ${after[0]} · ${draws[0]} draws  |  on: ${frames[1] >= 30 ? 'none in 30' : frames[1]} frame(s) · ${after[1]} · ${draws[1]} draws`);
    }
    SQUADS.noticedEyes = false;
    // ---- 18 · the third piece (callBeat): on a quiet floor what one man has noticed is his until his call ends — and a call can be cut off
    { const three = (call: boolean, body = true) => { SQUADS.radioCheck = true; SQUADS.noticedEyes = true; SQUADS.callBeat = call; SQUADS.callBody = body; };
      const keyLine = (m: any) => new RegExp(`^Bravo: ${mate(m)} — I've got—$`);
      // he notices: awareness past his own bar with one of them in his eye, every frame (the staging of step 7)
      const sees = (R: any, m: any, secs: number, each?: () => void) => { for (let i = 0; i < secs * 60; i++) { m.lastSeenT = R.g.time; R.g.player.visibility = 0.05; R.W.step(DT); each?.(); } };
      // 15a · the squad learns at the END of the call, not at its start; the cue is on the net and over him, never his own bubble
      { three(true); dark(false);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1; let bub = 0, alertT = NaN, early = false;
          sees(R, m, 0.5, () => { if (m.state === 'alert' && !(alertT === alertT)) alertT = g.time; if (m.bubble && /I've got—/.test(m.bubble.text)) bub++; });
          const E0 = ev(g, 'Bravo'), k = first(E0, 'calls'); early = E0.some(e => e.what === 'contact') || R.said.some(t => /contact/.test(t));
          const state05 = squadsReport(g).find((q: any) => q.name === 'Bravo').state, cue = g.cues?.bubbleOf?.(m)?.text ?? '', due = Number(/has it in ([\d.]+) s/.exec(E0.find(e => e.what === 'calls')?.why ?? '')?.[1]);
          sees(R, m, 2.6, () => { if (m.bubble && /I've got—/.test(m.bubble.text)) bub++; });
          const E = ev(g, 'Bravo'), c = first(E, 'contact'), iKey = R.said.findIndex(t => keyLine(m).test(t)), iC = R.said.findIndex(t => /^Bravo: contact/.test(t));
          F.verdict(k - alertT <= 0.11 && !early && state05 === 'hold', 'call beat: the frame he goes alert he keys up — and half a second on his squad is NOT in contact and nobody has said so', `${m.callsign} alert @${alertT.toFixed(2)} · keys up @${k} · Bravo ${state05} half a second in · ${E0.map(e => `${e.what}@${e.t.toFixed(2)}`).join(',')}`);
          F.verdict(c - k >= SQUADS.callSecs[0] - 0.11 && c - k <= SQUADS.callSecs[1] + 0.11 && Math.abs(c - k - due) < 0.11, `the squad is in contact when his call ENDS (${SQUADS.callSecs[0]} to ${SQUADS.callSecs[1]} s, the length drawn when he keyed up), not before`, `keys up @${k} · due in ${due} s · Bravo contact @${c} (${(c - k).toFixed(2)} s; the timeline's stamps are tenths) · ${E.find(e => e.what === 'contact')?.why ?? ''}`);
          F.verdict(iKey >= 0 && iC > iKey && keyLine(m).test(cue) && bub === 0 && (g.cues?.log ?? []).some((r: any) => /I've got—$/.test(r.text) && r.cls === 2), 'the cue: his line goes out on the net when he keys up (the strip\'s row in his squad\'s name, class 2, and a cue over him) — never his own bubble — and the contact call follows it', `${R.said.filter(t => /^Bravo/.test(t)).join(' | ')} · cue over him at 0.5 s: "${cue}" · ${bub} frames with the line in his own bubble`);
        } finally { R.done(); } }
      // 15b · a caller dropped (or taken) inside the beat does not complete it; what follows is the switch's own rules
      for (const how of ['dropped', 'taken'] as const) { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); const k = first(ev(g, 'Bravo'), 'calls'), t1 = g.time;
          const away = () => { m.held = true; m.char.pos[0] = -60; m.char.pos[2] = -60; };
          if (how === 'dropped') killGuard(g, m, [1, 0, 0], true); else away();
          until(R, 4, () => { if (how === 'taken') away(); return false; });
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off');
          F.verdict(k > 0 && !!cut && cut.t - t1 <= 0.11 && !E.some(e => e.what === 'contact') && !R.said.some(t => /contact/.test(t)) && squadsReport(g).find((q: any) => q.name === 'Bravo').state === 'hold', `the caller ${how} ${(t1 - k).toFixed(1)} s into his call: it is cut off, and four seconds on (past where it would have ended) no squad is in contact and nobody has called one`, `keys up @${k} · ${how} @${t1.toFixed(2)} · ${cut ? cut.why : 'no cut off row'} · ${E.map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}`);
          // (the review's finding 1) half a sentence went out on the squad's own net: a mate asks for him by name a second or two after the cut — not at the next routine check half a minute on
          const ask = E.find(e => e.what === 'asks' && new RegExp(m.callsign).test(e.why)), line = R.said.find((t: string) => new RegExp(`^Bravo: ${mate(m)}\\? … ${mate(m)}, sound off`).test(t));
          F.verdict(!!cut && !!ask && ask.t - cut.t >= SQUADS.callCutAsk[0] - 0.11 && ask.t - cut.t <= SQUADS.callCutAsk[1] + 0.11 && !!line && / asks for him in /.test(cut.why), `… and the squad does not sit on a call that broke off: a mate asks for ${m.callsign} by name ${SQUADS.callCutAsk[0]} to ${SQUADS.callCutAsk[1]} s after the cut, on the net`, `cut off @${cut?.t.toFixed(2)} · asks @${ask ? ask.t.toFixed(2) : 'never in 4 s'} · ${line ?? 'no ask on the net'} · ${cut?.why ?? ''}`);
          if (how === 'dropped') { until(R, 30, () => ev(g, 'Bravo').some(e => e.what === 'looks' || e.what === 'contact'));
            const E2 = ev(g, 'Bravo'); F.verdict(E2.some(e => e.what === 'looks') && first(E2, 'looks') - cut!.t < 12, '… and with no answer, men walk to his post within a dozen seconds of the cut (the radio check\'s own road from there)', E2.filter(e => e.what !== 'calls').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')); }
        } finally { R.done(); } }
      // 15b' · a man in no state to call does not key up again every frame: taken or reeling WHERE HE STANDS with the team still in his eye, his call is cut off
      //        once, and nothing more goes out until he is fit — then, still seeing, he keys up afresh and his squad has it at the end of THAT call
      for (const how of ['reeling', 'taken'] as const) { three(true); dark(false);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); const t1 = g.time, said0 = R.said.filter((t: string) => keyLine(m).test(t)).length;
          if (how === 'reeling') m.staggerUntil = g.time + 2; else m.held = true;
          sees(R, m, 1.9, () => { m.state = 'alert'; });
          const E = ev(g, 'Bravo'), nCalls = E.filter(e => e.what === 'calls').length, nCut = E.filter(e => e.what === 'cut off').length, lines = R.said.filter((t: string) => keyLine(m).test(t)).length, onAir = squadCalls(g).length;
          F.verdict(said0 === 1 && nCalls === 1 && nCut === 1 && lines === 1 && onAir === 0 && !E.some(e => e.what === 'contact'), `the caller ${how} where he stands, the team still in his eye: one call, cut off once — he does not key up again while he cannot, and his squad is told nothing`, `${how} @${t1.toFixed(2)} · 1.9 s on: ${nCalls} 'calls' row${nCalls === 1 ? '' : 's'}, ${nCut} 'cut off', ${lines} key-up line${lines === 1 ? '' : 's'} on the net, ${onAir} on the air`);
          if (how === 'reeling') { sees(R, m, 3.2, () => { m.state = 'alert'; }); const E2 = ev(g, 'Bravo'), ks = E2.filter(e => e.what === 'calls'), c = first(E2, 'contact');
            F.verdict(ks.length === 2 && c === c && c - ks[1].t > 0.3 && c - ks[1].t <= SQUADS.callSecs[1] + 0.11, '… fit again and still seeing, he keys up afresh: his squad is in contact by the SECOND call (at its end, or sooner if his own first round is heard under it)', `${E2.map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')} · shots heard by Bravo by then: ${bravo(g).reduce((n: number, x: any) => n + x.witness.heard.shots, 0)}`); }
        } finally { R.done(); } }
      // 15b'' · the LAST man of a squad dropped inside his call: cut off like any other — no call left on the air behind a squad that is down
      { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); const on0 = squadCalls(g).length;
          for (const x of bravo(g)) killGuard(g, x, [1, 0, 0], true);
          R.step(0.5);
          const E = ev(g, 'Bravo');
          F.verdict(on0 === 1 && E.some(e => e.what === 'cut off') && squadCalls(g).length === 0 && E.some(e => e.what === 'down'), 'the last man of his squad dropped inside his call: cut off, and no call is left on the air behind a squad that is down', `${on0} on the air before · ${E.map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')} · ${squadCalls(g).length} on the air after`);
        } finally { R.done(); } }
      // 15c · gunfire heard: calls are instant, as they were — before he keys up, and under a call already on the air
      for (const when of ['before', 'under'] as const) { three(true); dark(false);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); const shot = () => g.events.push({ kind: 'shot', pos: [g.player.char.pos[0], 0, g.player.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID });
          if (when === 'before') { shot(); R.step(0.2); }
          const heard = bravo(g).filter((x: any) => x.witness.heard.shots > 0).length; m.awareness = 1; const t0 = g.time; let alertT = NaN, shotT = NaN;
          sees(R, m, 1.2, () => { if (m.state === 'alert' && !(alertT === alertT)) alertT = g.time; if (when === 'under' && !(shotT === shotT) && g.time - t0 >= 0.5) { shot(); shotT = g.time; } });
          const E = ev(g, 'Bravo'), c = first(E, 'contact'), k = first(E, 'calls');
          if (when === 'before') F.verdict(heard > 0 && !(k === k) && c - alertT <= 0.11, 'gunfire heard by the squad BEFORE he notices: no call to wait for — contact the frame he goes alert, as it was', `${heard} of Bravo had heard the shot · ${m.callsign} alert @${alertT.toFixed(2)} · Bravo contact @${c} · no 'calls' row`);
          else F.verdict(k === k && c - shotT <= 0.11 && c - k < SQUADS.callSecs[0] - 0.3, 'gunfire heard UNDER his call: the floor is not quiet any more — the call is through at once', `keys up @${k} · the shot @${shotT.toFixed(2)} · Bravo contact @${c} (${(c - k).toFixed(2)} s into a call of ${SQUADS.callSecs[0]} s or more)`);
        } finally { R.done(); } }
      // 15d · a body seen is one man's knowledge too (callBody): the mate who has it in sight keys up, 'found' and contact at the end of his call; callBody off = at once, as with two pieces
      { const got: Record<string, { c: number; k: number; found: number }> = {};
        for (const body of [true, false]) { three(true, body); dark(false); BODY_LIGHT.lit = 0; BODY_LIGHT.litNear = 0;
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; R.step(1); const B = bravo(g);
            let m = B[0], best = -2; for (const v of B) for (const x of B) { if (x === v) continue; const to = [v.char.pos[0] - x.char.pos[0], v.char.pos[2] - x.char.pos[2]], l = Math.hypot(to[0], to[1]) || 1, c = (to[0] * x.char.chestDir[0] + to[1] * x.char.chestDir[2]) / l; if (l < 10 && c > best && !g.col.segmentBlocked([x.char.pos[0], 1.6, x.char.pos[2]], [v.char.pos[0], 0.9, v.char.pos[2]])) { best = c; m = v; } }
            const t0 = g.time; killGuard(g, m, [1, 0, 0], true); until(R, 8, () => ev(g, 'Bravo').some(e => e.what === 'contact'));
            const E = ev(g, 'Bravo'); got[String(body)] = { c: first(E, 'contact') - t0, k: first(E, 'calls') - t0, found: first(E, 'found') - t0 };
          } finally { R.done(); } }
        const a = got.true, b = got.false;
        F.verdict(a.k >= -0.06 && a.c - a.k >= SQUADS.callSecs[0] - 0.11 && a.c - a.k <= SQUADS.callSecs[1] + 0.11 && a.found >= a.c - 0.02 && !(b.k === b.k) && b.c < a.c - 1, 'a man dropped in a mate\'s view: the mate keys up, and the body is found and contact called when his call ends; with callBody off it is contact as soon as he has it in sight, no call', `callBody on: keys up ${a.k.toFixed(2)} s after the drop, found ${a.found.toFixed(2)}, contact ${a.c.toFixed(2)}  |  off: contact ${b.c.toFixed(2)}, no 'calls' row`);
      }
      // 15e · plain ?radiocheck / SQUADS=radiocheck leaves this piece OFF (its own value turns it on), read off a fresh process each
      { const read = (env: string) => { const r = Bun.spawnSync(['bun', '-e', `const { SQUADS: S } = await import('${ROOT}/src/game/enemysquads.ts'); console.log([S.radioCheck, S.noticedEyes, S.callBeat, S.callBody, S.callCutAsk[1] > 0, S.netAsk].map(Number).join(''))`], { env: { ...process.env, SQUADS: env } }); return r.stdout.toString().trim(); };
        const got = ['', 'radiocheck', 'radiocheck-drop', 'radiocheck-eyes', 'radiocheck-call', 'radiocheck-call-eyes', 'radiocheck-call-noask', 'radiocheck-net'].map(e => `${e || '(unset)'}=${read(e)}`);
        F.verdict(got.join(' ') === '(unset)=000110 radiocheck=110110 radiocheck-drop=100110 radiocheck-eyes=010110 radiocheck-call=111110 radiocheck-call-eyes=111010 radiocheck-call-noask=111100 radiocheck-net=111111', 'the harness\'s SQUADS= values: plain radiocheck (and each one piece) leaves the call beat off; radiocheck-call is all three, radiocheck-call-eyes the same with a body seen left instant, radiocheck-call-noask the same with nobody asking after a cut-off call; the net\'s ask is on under radiocheck-net alone', got.join(' · ') + ' (radioCheck, noticedEyes, callBeat, callBody, callCutAsk on, netAsk)');
      }
      // 15f · the men sent to look, with this piece on: the one who has the body in sight keys up over it, and while his call is on the air nobody sent with him
      // turns for home or says 'no sign' — found and contact when his call ends (section 10's staging: a body the round threw a metre from the post)
      { three(true, true); dark(false);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; park(g); R.g.player.visibility = 0.05; R.W.step(DT); park(g); for (let i = 0; i < 59; i++) { R.W.step(DT); park(g); }
          const m = bravo(g)[4]; killGuard(g, m, [0, 0, -1], false);
          until(R, 150, () => { park(g); return ev(g, 'Bravo').some(e => e.what === 'no sign' || e.what === 'contact'); });
          const E = ev(g, 'Bravo'), looksT = first(E, 'looks'), call = E.find(e => e.what === 'calls' && e.t >= looksT && /down in his sight/.test(e.why)), found = E.find(e => e.what === 'found'), cT = first(E, 'contact');
          const home = (g.fight.log as any[]).filter(n => call && n.t >= call.t - 0.06 && n.t <= cT + 0.06 && /goes back; his mate is still on his way/.test(n.what));
          F.verdict(looksT === looksT && !!call && !!found && found.t - call.t >= SQUADS.callSecs[0] - 0.11 && found.t - call.t <= SQUADS.callSecs[1] + 0.11 && cT >= found.t - 0.02 && !home.length && !E.some(e => e.what === 'no sign') && !R.said.some(t => /no sign of/.test(t)),
            'sent to look with the call beat on: the man who sees the body keys up over it, nobody sent with him turns for home or says "no sign" under his call, found and contact when it ends',
            `${m.callsign} · ${E.map(e => `${e.what}@${e.t}`).join(',')} · turned for home under the call: ${home.length ? home.map(n => `${n.who}@${n.t.toFixed(1)}`).join(' ') : 'nobody'}`);
        } finally { R.done(); } }
      // ================ the ask after a cut-off call (callCutAsk), and the cases its own review named (rebuild/quiet-squad-maps/review/ask-review.md)
      const asked = (g: any, who: any) => ev(g, 'Bravo').find(e => e.what === 'asks' && e.why.startsWith(`no answer from ${who.callsign}:`));
      const soundOffs = (R: any, from: number) => R.said.slice(from).filter((t: string) => /^Bravo: radio check — sound off$/.test(t)).length;
      // 15g · callCutAsk [0, 0] = no ask: the knob as it was first built (and as the one build carries it)
      { three(true); dark(true); const was = SQUADS.callCutAsk; SQUADS.callCutAsk = [0, 0];
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); killGuard(g, m, [1, 0, 0], true); until(R, 2.6, () => false);
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off');
          F.verdict(!!cut && !/ask/.test(cut.why) && !E.some(e => e.what === 'asks' || e.what === 'check' || e.what === 'contact'), 'callCutAsk [0, 0]: the same cut-off call and nobody asks for him on its account — no ask, no check called, in the 2.6 s after it', `${cut?.why ?? 'no cut off row'} · ${E.map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}`);
        } finally { R.done(); SQUADS.callCutAsk = was; } }
      // 15h · the check already has its hands full (asking for ANOTHER man) when the call breaks off: the caller is not asked for a whole beat later behind a
      //        fresh 'sound off' — he is asked for by name as soon as the men who went for the first are home
      { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m: X } = loneliest(g), X0 = [X.char.pos[0], 0, X.char.pos[2]];
          const takeX = () => { X.held = true; X.char.pos[0] = -60; X.char.pos[2] = -60; };
          until(R, 70, () => { takeX(); return !!asked(g, X); });
          const m = bravo(g).filter((x: any) => x !== X).sort((a: any, b: any) => flatD(b.char.pos, X0) - flatD(a.char.pos, X0))[0]; m.awareness = 1;
          sees(R, m, 0.5, takeX); const n0 = R.said.length; killGuard(g, m, [1, 0, 0], true);
          until(R, 120, () => { takeX(); return !!asked(g, m) || ev(g, 'Bravo').some(e => e.what === 'contact'); });
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off'), noSign = E.find(e => e.what === 'no sign'), aM = asked(g, m), again = E.find(e => e.what === 'check' && /has not forgotten/.test(e.why)), so = soundOffs(R, n0);
          F.verdict(!!asked(g, X) && !!cut && /once the check under way is done/.test(cut.why) && !!noSign && !!again && !!aM && aM.t >= noSign.t && aM.t - again.t <= 0.2 && so === 0 && !E.some(e => e.what === 'contact'),
            'a call cut off while the check is asking for another man: the caller waits his turn and is asked for by name once the men who went for the first are home — no fresh "sound off" round, no whole beat',
            `${X.callsign} asked for @${asked(g, X)?.t.toFixed(1)} · ${cut?.why ?? 'no cut off row'} · no sign @${noSign?.t.toFixed(1)} · "${again?.why ?? 'no row'}" @${again?.t.toFixed(1)} · ${m.callsign} asked for @${aM ? aM.t.toFixed(1) : 'never'} · ${so} "sound off" in between`);
        } finally { R.done(); } }
      // 15i · two callers cut off on ONE frame (both taken): both are asked for by name, one after the other
      { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m: a } = loneliest(g), b = bravo(g).filter((x: any) => x !== a).sort((x: any, y: any) => flatD(y.char.pos, a.char.pos) - flatD(x.char.pos, a.char.pos))[0];
          a.awareness = 1; b.awareness = 1;
          // (the team clean off the floor, Sam too: the men who go for the first of the two walk the loading hall between the workshop and the store on the
          // rebuilt block, past where the team stands — met there it is contact, a true thing and another line's)
          const clear = () => { park(g); g.player.char.pos[0] = -80; g.player.char.pos[2] = -78; };
          sees(R, a, 0.6, () => { b.lastSeenT = g.time; clear(); });
          const on0 = squadCalls(g).length, n0 = R.said.length, take = () => { for (const x of [a, b]) { x.held = true; x.char.pos[0] = -60; x.char.pos[2] = -60; } clear(); };
          until(R, 150, () => { take(); return (!!asked(g, a) && !!asked(g, b)) || ev(g, 'Bravo').some(e => e.what === 'contact'); });
          const E = ev(g, 'Bravo'), cuts = E.filter(e => e.what === 'cut off'), ta = asked(g, a)?.t ?? NaN, tb = asked(g, b)?.t ?? NaN, t1 = Math.min(ta, tb), so = soundOffs(R, n0);
          F.verdict(on0 === 2 && cuts.length === 2 && Math.abs(cuts[0].t - cuts[1].t) < 0.02 && cuts.filter(c => / asks for him in /.test(c.why)).length === 1 && cuts.filter(c => /once the check under way is done/.test(c.why)).length === 1 && t1 - cuts[0].t <= SQUADS.callCutAsk[1] + 0.11 && ta === ta && tb === tb && so === 0 && !E.some(e => e.what === 'contact'),
            'two callers cut off on one frame: the first is asked for by name within the knob\'s beat, the second once that check is done — both by name, neither behind a "sound off" round',
            `${on0} on the air · ${cuts.map(c => `cut @${c.t.toFixed(2)}`).join(', ')} · ${a.callsign} asked for @${ta.toFixed(1)}, ${b.callsign} @${tb.toFixed(1)} · ${so} "sound off" in between · ${E.filter(e => e.what !== 'calls' && e.what !== 'cut off').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}`);
        } finally { R.done(); } }
      // 15j · a caller who drops OUTSIDE his squad's rooms: asked for, and men go to where he fell (as first built the ask led nowhere: no record of him, the check idle a frame later)
      { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); const p = g.player.char.pos, at = [p[0] + 1, 0, p[2]];
          m.char.pos[0] = at[0]; m.char.pos[2] = at[2]; killGuard(g, m, [1, 0, 0], true);
          until(R, 14, () => ev(g, 'Bravo').some(e => e.what === 'looks' || e.what === 'contact'));
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off'), aM = asked(g, m), looksT = first(E, 'looks');
          F.verdict(!inRoom(g, 'shop', at) && !inRoom(g, 'store', at) && !!cut && !!aM && looksT - cut.t < 12 && looksT > aM.t,
            'a caller dropped outside his squad\'s rooms: he is filed where he fell, asked for by name, and men go there — the ask leads somewhere',
            `down at (${at[0].toFixed(1)}, ${at[2].toFixed(1)}), outside the shop and the store · ${E.filter(e => e.what !== 'calls').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}`);
        } finally { R.done(); } }
      // 15k · with no call cut off the ask changes NOTHING: a man dropped unseen, the routine check, its ask and its men to his post land on the same frames with
      //        the ask on as with [0, 0] — the same game 75 s on (the ask on / ask off tallies are paired seed for seed on this)
      { const got: { h: string; ev: string }[] = [], was = SQUADS.callCutAsk;
        for (const ask of [[1, 2], [0, 0]] as [number, number][]) { three(true); dark(true); SQUADS.callCutAsk = ask;
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const { m } = loneliest(g); killGuard(g, m, [1, 0, 0], true);
            for (let i = 0; i < 75 * 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const d = digestGame(g, true) as any; for (const x of d.guards ?? []) delete x.bubble;
            got.push({ h: hashDigest(d), ev: ev(g, 'Bravo').map(e => `${e.what}@${e.t}`).join(',') });
          } finally { R.done(); SQUADS.callCutAsk = was; } }
        F.verdict(got[0].h === got[1].h && got[0].ev === got[1].ev && /asks@/.test(got[0].ev) && /looks@/.test(got[0].ev) && !/cut off/.test(got[0].ev),
          'no call cut off: the routine check, its ask by name and its men to the post are the same with the ask on as with [0, 0] — the same game 75 s on',
          `ask on: ${got[0].h} · ${got[0].ev}  |  [0, 0]: ${got[1].h} · ${got[1].ev}`);
      }
      // ================ the ask's second review (rebuild/quiet-squad-maps/review/ask-review-2.md): each of these fails on the ask as it stood (1ebae9a)
      const post0 = (g: any) => new Map<any, number[]>(g.fight.defs.map((D: any) => [D.gd, [D.station[0], 0, D.station[2]]]));
      const noted = (g: any, re: RegExp) => (g.fight.log as any[]).find(l => re.test(l.what));
      // 16a · 4.1: a caller cut off because he is REELING is on the net, and nobody asks — but dropped half a second later without having keyed up again, his
      //        mates heard half a sentence and then nothing: asked for by name inside the knob's beat of the drop, not at the next routine check
      { three(true); dark(true); SQUADS.heardAsks = false;
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); m.staggerUntil = g.time + 4; until(R, 0.5, () => false);
          const cut = ev(g, 'Bravo').find(e => e.what === 'cut off'), t1 = g.time, n0 = R.said.length; killGuard(g, m, [1, 0, 0], true);
          until(R, 5, () => !!asked(g, m) || ev(g, 'Bravo').some(e => e.what === 'contact'));
          const a = asked(g, m), row = noted(g, new RegExp(`${m.callsign}, whose call broke off [\\d.]+ s ago, is down and has said nothing since`));
          F.verdict(!!cut && /blinded or reeling/.test(cut.why) && !/ask/.test(cut.why) && !!a && a.t - t1 <= SQUADS.callCutAsk[1] + 0.15 && !!row && soundOffs(R, n0) === 0 && !ev(g, 'Bravo').some(e => e.what === 'contact'),
            'ask-review-2 4.1: a call cut off under a reeling man, the man dropped quietly half a second on — his mates ask for him by name inside the knob\'s beat of the drop (before: an ordinary silent drop, found at the next routine check)',
            `${cut?.why ?? 'no cut off row'} · dropped @${t1.toFixed(2)} · asked for @${a ? a.t.toFixed(2) : 'never in 5 s'} · ${row ? row.what.slice(9) : 'no row for it'}`);
        } finally { R.done(); SQUADS.heardAsks = true; } }
      // 16b · 4.2: the routine check's own time survives the polls. A call breaks off while men are out looking for another man (the check polls until they are
      //        home); the caller is let go of — nobody is owed an ask, and the next "sound off" comes when it was due, not five seconds after a poll
      { three(true); dark(true); SQUADS.heardAsks = false;
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m: X } = loneliest(g), X0 = [X.char.pos[0], 0, X.char.pos[2]];
          const takeX = () => { X.held = true; X.char.pos[0] = -60; X.char.pos[2] = -60; };
          until(R, 70, () => { takeX(); return !!asked(g, X); });
          const m = bravo(g).filter((x: any) => x !== X).sort((a: any, b: any) => flatD(b.char.pos, X0) - flatD(a.char.pos, X0))[0]; m.awareness = 1;
          sees(R, m, 0.5, takeX); m.held = true;
          until(R, 30, () => { takeX(); m.held = true; return ev(g, 'Bravo').some(e => e.what === 'looks'); });
          until(R, 2.5, () => { takeX(); m.held = true; return false; });
          const looksT = first(ev(g, 'Bravo'), 'looks'), tFree = g.time; m.held = false; m.awareness = 0; m.state = 'patrol';
          const called = () => ev(g, 'Bravo').find(e => e.what === 'check' && /calls the squad's radio check/.test(e.why) && e.t > tFree);
          until(R, 80, () => { takeX(); return !!called() || ev(g, 'Bravo').some(e => e.what === 'contact'); });
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off'), so = called(), due = looksT + SQUADS.checkEvery * (1 - SQUADS.checkJitter), home = E.find(e => e.what === 'no sign');
          F.verdict(!!cut && looksT === looksT && !!so && so.t >= due - 0.2 && !asked(g, m) && !E.some(e => e.what === 'contact'),
            'ask-review-2 4.2: a call broken off while the check polls (men out looking), the caller let go of before he is asked for — the next "sound off" comes when the routine check was due (before: five seconds after a poll)',
            `looks @${looksT} · ${cut?.why.slice(0, 60) ?? 'no cut off row'}… · let go of @${tFree.toFixed(1)} · the men home @${home?.t ?? '-'} · next "sound off" @${so ? so.t : 'never'} (due no sooner than ${due.toFixed(1)}) · ${m.callsign} asked for: ${asked(g, m) ? 'yes' : 'no'}`);
        } finally { R.done(); SQUADS.heardAsks = true; } }
      // 16c · 4.3: a man sent to look who keys up by his eyes on his way, and is taken where he stands: filed THERE, not at the post he left
      { three(true); dark(true); SQUADS.heardAsks = false;
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const P0 = post0(g), { m: X } = loneliest(g);
          const takeX = () => { X.held = true; X.char.pos[0] = -60; X.char.pos[2] = -60; };
          until(R, 90, () => { takeX(); return ev(g, 'Bravo').some(e => e.what === 'looks'); });
          let L: any = null; until(R, 12, () => { takeX(); L = bravo(g).find((x: any) => x !== X && x.script && x.speed > 0.4 && flatD(x.char.pos, P0.get(x)!) > 4.5) ?? null; return !!L; });
          if (L) { L.awareness = 1; sees(R, L, 0.4, () => { takeX(); L.state = 'alert'; }); }   // (his own bar, as step 15b' stages it: a man walking on the squad's errand)
          const keyed = !!L && ev(g, 'Bravo').some(e => e.what === 'calls' && e.why.startsWith(`${L.callsign} keys up`));
          const p = L ? [L.char.pos[0], 0, L.char.pos[2]] : [0, 0, 0], hold = () => { takeX(); if (L) { L.held = true; L.char.pos[0] = p[0]; L.char.pos[2] = p[2]; } };
          const went = () => ev(g, 'Bravo').find(e => e.what === 'looks' && L && new RegExp(`to where ${L.callsign} stood`).test(e.why));
          let goerAt: number[] | null = null; until(R, 150, () => { hold(); const w = went(); if (w && !goerAt) { const go = bravo(g).find((x: any) => w.why.startsWith(x.callsign)); goerAt = go ? [go.char.pos[0], 0, go.char.pos[2]] : null; } return !!w || ev(g, 'Bravo').some(e => e.what === 'contact'); });
          const w = went(), N = Number(/, (\d+) m off/.exec(w?.why ?? '')?.[1]), st = L ? P0.get(L)! : [0, 0, 0], dHere = goerAt ? flatD(goerAt, p) : NaN, dPost = goerAt ? flatD(goerAt, st) : NaN;
          F.verdict(!!L && keyed && ev(g, 'Bravo').some(e => e.what === 'cut off' && e.why.startsWith(`${L.callsign}'s call`)) && !!w && flatD(p, st) > 4.5 && Math.abs(N - dHere) <= 0.6 && Math.abs(dHere - dPost) > 1.2,
            'ask-review-2 4.3: a looker who keyed up by his eyes on his way and was taken where he stood — the men who go for him go THERE, not to the post he left',
            `${L?.callsign ?? 'no looker on his way'} taken ${flatD(p, st).toFixed(1)} m from his post · ${w ? w.why.slice(0, 70) : 'nobody went for him'}… · the goer is ${dHere.toFixed(1)} m from where he was taken, ${dPost.toFixed(1)} m from his post`);
        } finally { R.done(); SQUADS.heardAsks = true; } }
      // 16d · 4.4: a caller shot dead OUTSIDE the squad's rooms with the gunfire heard at home — news from outside by the mates' own ears, not 'contact — here!'
      //        said by a man at home about a spot he cannot see; the man stays filed and is asked for
      { three(true); dark(true);
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); const p = g.player.char.pos, at = [p[0] + 1, 0, p[2]];
          m.char.pos[0] = at[0]; m.char.pos[2] = at[2];
          g.events.push({ kind: 'shot', pos: [p[0], 0, p[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, m, [1, 0, 0], false);
          R.step(1.6);
          const E0 = ev(g, 'Bravo'), bad = E0.find(e => e.what === 'found' && /heard the (shot|blast) that dropped/.test(e.why)), here = R.said.find((t: string) => /^Bravo: contact — here!/.test(t)), heard = bravo(g).filter((x: any) => x.witness.heard.shots > 0).length;
          const st16 = squadsReport(g).find((q: any) => q.name === 'Bravo').state;
          until(R, 40, () => !!asked(g, m) || ev(g, 'Bravo').some(e => e.what === 'contact'));
          F.verdict(!inRoom(g, 'shop', at) && !inRoom(g, 'store', at) && heard > 0 && !bad && !here && !E0.some(e => e.what === 'contact') && !!asked(g, m),
            'ask-review-2 4.4: a caller shot dead outside the rooms, the shot heard at home — nobody at home calls "contact — here!" for a spot he cannot see; the squad has the shot as news from outside and asks for its man by name',
            `down at (${at[0].toFixed(1)}, ${at[2].toFixed(1)}) · ${heard} of Bravo heard the shot · Bravo ${st16} 1.6 s on · ${ev(g, 'Bravo').filter(e => e.what !== 'calls').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}${bad ? ` · ${bad.why}` : ''}`);
        } finally { R.done(); } }
      // 16e · 4.5: who is asked for first. A mate's ears are about to ask for one man when ANOTHER man's call breaks off on the net: the voice that has just
      //        stopped is asked for first, inside the knob's beat — the first man after (before: the caller waited behind the whole look for the first)
      { three(true); dark(true); SQUADS.heardAsks = true;
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const B = bravo(g);
          let A = B[0], bd = Infinity; for (const x of B) { const d = Math.min(...B.filter((y: any) => y !== x).map((y: any) => flatD(y.char.pos, x.char.pos))); if (d < bd) { bd = d; A = x; } }
          const at = [A.char.pos[0], 0, A.char.pos[2]]; killGuard(g, A, [1, 0, 0], true); R.step(0.6);
          g.events.push({ kind: 'prop', pos: at, time: g.time, level: 0.5, who: 0 });
          const heardRow = () => ev(g, 'Bravo').find(e => e.what === 'check' && /heard something/.test(e.why));
          until(R, 3, () => !!heardRow());
          const hr = heardRow(), ear = B.find((x: any) => hr && hr.why.startsWith(`${x.callsign} heard`));
          const b2 = B.filter((x: any) => x !== A && x !== ear).sort((x: any, y: any) => flatD(y.char.pos, at) - flatD(x.char.pos, at))[0]; b2.awareness = 1;
          sees(R, b2, 0.3); killGuard(g, b2, [1, 0, 0], true);
          until(R, 6, () => !!asked(g, b2) || ev(g, 'Bravo').some(e => e.what === 'contact'));
          const E = ev(g, 'Bravo'), cut = E.find(e => e.what === 'cut off'), aB = asked(g, b2), aA0 = asked(g, A);
          until(R, 120, () => !!asked(g, A) || ev(g, 'Bravo').some(e => e.what === 'contact' || (e.what === 'found' && e.why.includes(A.callsign))));
          const aA = asked(g, A), E2 = ev(g, 'Bravo');
          F.verdict(!!ear && !!cut && /asks for him first/.test(cut.why) && !!aB && aB.t - cut.t <= SQUADS.callCutAsk[1] + 0.15 && (!aA0 || aA0.t > aB.t) && (!!aA || E2.some(e => e.what === 'contact')),
            'ask-review-2 4.5: a call breaks off while a mate\'s ears were about to ask for another man — the caller is asked for first, inside the knob\'s beat, and the other man is not forgotten (asked for after, or the squad is in contact over the first)',
            `${A.callsign} down, ${ear?.callsign ?? 'nobody'} heard it · ${cut?.why ?? 'no cut off row'} · ${b2.callsign} asked for @${aB ? aB.t.toFixed(1) : 'never'} · ${A.callsign} asked for @${aA ? aA.t.toFixed(1) : 'never'} · ${E2.filter(e => e.what !== 'calls').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')}`);
        } finally { R.done(); } }
      // 16f · 3.2 / 4.6: the 'cut off' row promises an ask; contact by another road before it is made — the trace says the ask is dropped
      { three(true); dark(true); SQUADS.heardAsks = false;
        const R = await rig('block-squads.json', 1);
        try { const g = R.g; R.step(1); const { m } = loneliest(g); m.awareness = 1;
          sees(R, m, 0.6); killGuard(g, m, [1, 0, 0], true); R.step(0.3);
          const cut = ev(g, 'Bravo').find(e => e.what === 'cut off'), o = bravo(g)[0];
          g.events.push({ kind: 'shot', pos: [o.char.pos[0], 0, o.char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, o, [1, 0, 0], false); R.step(3);
          const E = ev(g, 'Bravo'), row = noted(g, new RegExp(`nobody asks for ${m.callsign} after all`));
          F.verdict(!!cut && / asks for him in /.test(cut.why) && E.some(e => e.what === 'contact') && !asked(g, m) && !!row,
            'ask-review-2 3.2: a cut-off row that promised an ask, and contact by another road before it was made — the trace says nobody asks after all (before: the promise stood in the log, unkept and unexplained)',
            `${cut?.why ?? 'no cut off row'} · ${E.filter(e => e.what !== 'calls').map(e => `${e.what}@${e.t.toFixed(1)}`).join(',')} · ${row ? row.what.slice(9) : 'no row for it'}`);
        } finally { R.done(); SQUADS.heardAsks = true; } }
      // ================ the net asks after a squad that has gone silent (SQUADS.netAsk; ?radiocheck=net / SQUADS=radiocheck-net)
      { const net = (on: boolean) => { three(true); SQUADS.netAsk = on; };
        const alpha = (g: any) => g.roomClear.rooms.find((r: any) => r.def.id === 'mess').defenders.filter((h: any) => h.state !== 'dead');
        const all = (g: any) => (squadsReport(g) as any[]).flatMap(q => q.events.map((e: any) => ({ ...e, q: q.name }))).sort((a, b) => a.t - b.t);
        const netRows = (g: any) => all(g).filter(e => /^net /.test(e.what)).map(e => `${e.q} ${e.what}@${e.t.toFixed(1)}`).join(',');
        const defenders = (g: any) => g.nightBreach.hostiles.filter((h: any) => h.state !== 'dead');
        const cls = (g: any, re: RegExp) => [...new Set((g.cues?.log ?? []).filter((r: any) => re.test(r.text)).map((r: any) => r.cls))].join(',');
        const RE_ROLL = /^[A-Z][a-z]+: all squads — radio check$/, RE_ASK = /^(Bravo|Charlie): Alpha\? … Alpha, sound off$/, RE_GO = /^Bravo: nothing from Alpha — (one|two) moving to their rooms!$/;
        // 17a · a whole squad dropped silently in the dark: nothing at the drop; the net's roll call; the squad asked for by name; a pair of the nearest squad
        //        that can spare them WALKS to its posts; every other squad wary, none in contact; contact when a looker has a body in his eye and has said so
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g), t0 = g.time; for (const x of A) killGuard(g, x, [1, 0, 0], true);
            for (let i = 0; i < 12; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const quiet0 = !all(g).some(e => e.what === 'contact') && !R.said.some((t: string) => /contact/.test(t));
            let early = '', walked = 0, homeMin = 99; const seesIt = () => all(g).find(e => (e.what === 'calls' || e.what === 'found') && /Alpha's posts|down in his sight/.test(e.why));
            until(R, 200, () => { park(g); const k = seesIt();
              if (!k) { const c = squadsReport(g).find((q: any) => q.state === 'contact' || q.state === 'alerted'), a = defenders(g).find((x: any) => x.state === 'alert' || x.state === 'search'); if (c && !early) early = `${c.name} ${c.state} @${g.time.toFixed(1)}`; if (a && !early) early = `${a.callsign} ${a.state} @${g.time.toFixed(1)}`; }
              for (const x of bravo(g)) if (x.script && x.speed > 0.4) walked = Math.max(walked, x.speed);
              if (!k) homeMin = Math.min(homeMin, ['shop', 'store'].filter(id => bravo(g).some((x: any) => inRoom(g, id, x.char.pos))).length);
              return all(g).some(e => e.what === 'contact' || (e.what === 'no sign' && /Alpha/.test(e.why))); });
            const E = all(g), nc = E.find(e => e.what === 'net check'), na = E.find(e => e.what === 'net asks'), nl = E.find(e => e.what === 'net looks'), fd = E.find(e => e.what === 'found'), c = E.find(e => e.what === 'contact');
            const iRoll = R.said.findIndex((t: string) => RE_ROLL.test(t)), iAsk = R.said.findIndex((t: string) => RE_ASK.test(t)), iGo = R.said.findIndex((t: string) => RE_GO.test(t)), iC = R.said.findIndex((t: string) => /contact/.test(t));
            F.verdict(A.length === 3 && quiet0, 'net: the three of Alpha dropped silently in the dark — nothing at the drop: no squad in contact, nothing said', `down @${t0.toFixed(2)} · ${squadsReport(g).map((q: any) => `${q.name} ${q.state}`).join(' · ')}`);
            F.verdict(!!nc && !!na && !!nl && nc.t - t0 <= SQUADS.netEvery * (1 + SQUADS.checkJitter) && Math.abs(na.t - nc.t - SQUADS.checkAsk) <= 0.15 && Math.abs(nl.t - na.t - SQUADS.checkAsk) <= 0.15,
              `the beat: the net's roll call inside its ${SQUADS.netEvery} s, the silent squad asked for by name ${SQUADS.checkAsk} s after it, men sent ${SQUADS.checkAsk} s after that — no sooner`, `${netRows(g)} · ${na?.why ?? ''}`);
            F.verdict(iRoll >= 0 && iAsk > iRoll && iGo > iAsk && (iC < 0 || iC > iGo) && cls(g, RE_ROLL) === '6' && cls(g, RE_ASK) === '2' && cls(g, RE_GO) !== '',
              'the cue: all of it on the radio in a squad\'s name, on the strip — the roll call (the strip\'s last class), "Alpha? … Alpha, sound off" (class 2), "nothing from Alpha — two moving to their rooms!"', R.said.filter((t: string) => RE_ROLL.test(t) || RE_ASK.test(t) || RE_GO.test(t)).join(' | ') + ` · classes ${cls(g, RE_ROLL)}/${cls(g, RE_ASK)}/${cls(g, RE_GO)}`);
            F.verdict(!!nl && nl.q === 'Bravo' && walked > 0.4 && walked <= g.tune.guardInvestigate + 0.3 && homeMin === 2 && / and /.test(nl.why),
              'the men who go are Bravo\'s (Charlie may not leave its rooms), at a looker\'s walk, a man left in each of Bravo\'s rooms', `${nl?.why ?? 'nobody sent'} · fastest ${walked.toFixed(2)} m/s · rooms of Bravo's with a man in them, at the fewest: ${homeMin}`);
            F.verdict(!!nl && !early && !!noted(g, /Bravo is wary \(Alpha is not answering\)/) && !!noted(g, /Charlie is wary \(Alpha is not answering\)/),
              'no instant knowledge: until a looker has a body in his eye no squad is in contact or has its word due and no defender is alert or searching — the squads are WARY (stood to), and the log says so', early ? `first thing roused: ${early}` : `nobody roused before ${seesIt() ? `${seesIt()!.what} @${seesIt()!.t.toFixed(1)}` : 'the end'} · ${(g.fight.log as any[]).filter(l => /is wary/.test(l.what)).map(l => l.what.slice(9, 40)).join(' | ')}`);
            const kc = E.find(e => e.q === 'Bravo' && e.what === 'calls' && /down in his sight/.test(e.why));
            F.verdict(!!fd && !!kc && kc.t > nl!.t && fd.t - kc.t >= SQUADS.callSecs[0] - 0.11 && /has said it/.test(fd.why) && !!c && c.q === 'Bravo' && c.t >= fd.t - 0.02 && R.said.some((t: string) => /^Bravo: contact — here!/.test(t)),
              'contact when a man sent there has a body of Alpha in his eye and has SAID so (his call\'s own beat) — his own squad\'s call, "contact — here!", from where he stands', `${kc?.why ?? 'nobody keyed up'} · ${fd?.why ?? 'nothing found'} · ${R.said.filter((t: string) => /contact/.test(t)).join(' | ')} · ${c ? `${c.q} contact @${c.t.toFixed(1)}, ${(c.t - t0).toFixed(1)} s after the drop` : 'no contact'} · ${E.filter(e => e.t > t0 && e.what !== 'check').map(e => `${e.q[0]}:${e.what}@${e.t.toFixed(1)}`).join(',')}`);
          } finally { R.done(); } }
        // 17b · the same with the whole of Alpha TAKEN (nobody and nothing at its posts): asked for, looked for at its posts, "no sign of Alpha" — no contact,
        //        the men home, and the net does not ask for it again
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g), away = () => { park(g); for (const x of A) { x.held = true; x.char.pos[0] = -60; x.char.pos[2] = -60 - 2 * A.indexOf(x); } }; away();
            const none = () => all(g).find(e => e.what === 'no sign' && /nobody of Alpha is at its posts|no way to Alpha's posts/.test(e.why));
            until(R, 240, () => { away(); return !!none() || all(g).some(e => e.what === 'contact'); });
            const tNone = g.time, nl = all(g).find(e => e.what === 'net looks'), stops = Number(/posts \((\d+) of them\)/.exec(nl?.why ?? '')?.[1]);
            until(R, SQUADS.netEvery * 1.4 + 25, () => { away(); return false; });
            const E = all(g), asksN = R.said.filter((t: string) => RE_ASK.test(t)).length, men = bravo(g), rep = squadsReport(g);
            F.verdict(!!nl && !!none() && /nobody of Alpha is at its posts/.test(none()!.why) && !E.some(e => e.what === 'contact') && R.said.some((t: string) => /^Bravo: no sign of Alpha — back on our doors!$/.test(t)),
              'net, nothing to find: Alpha taken clean off the floor — asked for, its posts walked, "no sign of Alpha — back on our doors!", and no squad in contact', `${netRows(g)} · ${stops} posts · no sign @${tNone.toFixed(1)} · ${R.said.filter((t: string) => /Alpha/.test(t)).join(' | ')}`);
            F.verdict(asksN === 1 && rep.every((q: any) => q.state === 'hold') && rep.find((q: any) => q.name === 'Bravo').out === 0 && men.every((x: any) => x.state !== 'alert' && x.state !== 'search' && !x.script) && men.filter((x: any) => inRoom(g, 'shop', x.char.pos) || inRoom(g, 'store', x.char.pos)).length === men.length,
              `… and ${(g.time - tNone).toFixed(0)} s on: Alpha was asked for once, the men who went are back in Bravo's rooms, nobody is roused, every squad holds`, `${asksN} ask(s) for Alpha · ${rep.map((q: any) => `${q.name} ${q.state}`).join(' · ')} · ${men.map((x: any) => `${x.callsign} ${x.state}`).join(' ')}`);
          } finally { R.done(); } }
        // 17c · nothing when a call got through: Alpha put a contact call on the net before it went silent — the floor knows why it is quiet, and nobody asks
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g);
            g.events.push({ kind: 'shot', pos: [A[0].char.pos[0], 0, A[0].char.pos[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); killGuard(g, A[0], [1, 0, 0], false);
            for (let i = 0; i < 90; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const called = R.said.some((t: string) => /^Alpha: contact/.test(t)); for (const x of A.slice(1)) killGuard(g, x, [1, 0, 0], true);
            until(R, 150, () => { park(g); return false; });
            F.verdict(called && !R.said.some((t: string) => RE_ASK.test(t)) && !all(g).some(e => e.what === 'net asks' || e.what === 'net looks'),
              'net, a call got through: Alpha called contact and was then dropped to a man — in the 150 s after, nobody asks the net for Alpha and nobody is sent to its posts by it (the squads have their own words for a fight)', `${R.said.filter((t: string) => /^Alpha: contact/.test(t)).length} contact call(s) by Alpha · net rows: ${netRows(g) || 'none'} · ${squadsReport(g).map((q: any) => `${q.name} ${q.state}`).join(' · ')}`);
          } finally { R.done(); } }
        // 17d · trouble heard, and nothing after: the last voice of Alpha breaks off mid call and the squad is down — asked for by name after the trouble's beat
        //        (netBeat), without waiting for the roll call
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g), m = A[0]; m.awareness = 1; sees(R, m, 0.4, () => park(g));
            for (const x of A) killGuard(g, x, [1, 0, 0], true);
            until(R, SQUADS.netBeat[1] + 2, () => { park(g); return all(g).some(e => e.what === 'net asks'); });
            const E = all(g), cut = E.find(e => e.what === 'cut off'), na = E.find(e => e.what === 'net asks');
            F.verdict(!!cut && !!na && /since the trouble on its net/.test(na.why) && na.t - cut.t >= SQUADS.netBeat[0] - 0.11 && na.t - cut.t <= SQUADS.netBeat[1] + 0.15 && !R.said.some((t: string) => RE_ROLL.test(t)) && R.said.some((t: string) => RE_ASK.test(t)) && !E.some(e => e.what === 'contact'),
              `net, trouble and then nothing: a call of Alpha's breaks off and nobody of it speaks again — another squad asks for Alpha by name ${SQUADS.netBeat[0]} to ${SQUADS.netBeat[1]} s on, with no roll call first and no contact by it`, `cut off @${cut?.t.toFixed(1)} · ${na ? `${na.q} asks @${na.t.toFixed(1)}: ${na.why}` : 'nobody asked'}`);
          } finally { R.done(); } }
        // 17e · the last man of a squad does not walk off alone: he says so on the net, stays at home, and men of the nearest squad go to the post in his place
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g); let pair = [A[0], A[1]], bd = Infinity; for (const a of A) for (const b of A) if (a !== b && flatD(a.char.pos, b.char.pos) < bd) { bd = flatD(a.char.pos, b.char.pos); pair = [a, b]; }
            const last = A.find((x: any) => !pair.includes(x)); for (const x of pair) killGuard(g, x, [1, 0, 0], true);
            let left = false; until(R, 200, () => { park(g); if (last.state !== 'dead' && (!inRoom(g, 'mess', last.char.pos) || (last.script && last.speed > 0.4)) && !all(g).some(e => e.what === 'contact')) left = true; return all(g).some(e => e.what === 'contact' || (e.q === 'Bravo' && e.what === 'no sign')); });
            const E = all(g), nh = E.find(e => e.what === 'net help'), c = E.find(e => e.what === 'contact');
            F.verdict(!!nh && nh.q === 'Alpha' && !E.some(e => e.q === 'Alpha' && e.what === 'looks') && !left && R.said.some((t: string) => /^Alpha: nothing from .+ — I'm alone here, somebody look!$/.test(t)) && R.said.some((t: string) => /^Bravo: copy, Alpha — (one|two) moving to you!$/.test(t)),
              'net, one man left: the last of Alpha asks, says he is alone, and STAYS — men of Bravo walk to the post in his place (with the net\'s ask off he goes himself: step 4c)', `${nh?.why ?? 'no help asked'} · ${last.callsign} ${left ? 'LEFT the mess' : 'stayed in the mess'} · ${R.said.filter((t: string) => /alone here|copy, Alpha/.test(t)).join(' | ')}`);
            F.verdict(!!c && c.q === 'Bravo' && E.some(e => e.q === 'Bravo' && e.what === 'found'), '… and it is Bravo\'s man, a body of Alpha at his feet, who calls the contact', E.filter(e => e.what !== 'check').map(e => `${e.q[0]}:${e.what}@${e.t.toFixed(1)}`).join(','));
          } finally { R.done(); } }
        // 17h · nobody can be sent (review M1): Alpha and Bravo dropped silently, Charlie may not leave its rooms — each is asked for ONCE by name, "nobody to
        //        send, stay on your doors!" is said, Charlie is wary, and then the net is quiet: no squad is asked for over and over
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            for (const x of [...alpha(g), ...bravo(g)]) killGuard(g, x, [1, 0, 0], true);
            until(R, 260, () => { park(g); return false; });
            const E = all(g), asks = R.said.filter((t: string) => /^Charlie: (Alpha|Bravo)\? … (Alpha|Bravo), sound off$/.test(t)), stay = R.said.filter((t: string) => /^Charlie: nothing from (Alpha|Bravo) — nobody to send, stay on your doors!$/.test(t)), rolls = R.said.filter((t: string) => RE_ROLL.test(t)).length;
            F.verdict(asks.length === 2 && new Set(asks).size === 2 && stay.length === 2 && rolls <= 3 && !E.some(e => e.what === 'net looks' || e.what === 'contact') && !!noted(g, /Charlie is wary \((Alpha|Bravo) is not answering\)/) && !!noted(g, /the net does not ask for it again/),
              'net, nobody to send: Alpha and Bravo silent, Charlie kept to its rooms — each is asked for by name once, "nobody to send, stay on your doors!" each time, Charlie WARY, and after that the net is quiet (before: Alpha asked for every 55 s for ever, no line, nobody wary, Bravo never asked for)',
              `${rolls} roll call(s) · ${asks.join(' | ')} · ${stay.join(' | ')} · ${netRows(g)} · ${squadsReport(g).map((q: any) => `${q.name} ${q.state}`).join(' · ')}`);
          } finally { R.done(); } }
        // 17i · the answer is what the man knows (review M2), and a squad waiting on its own men sends nobody (review M3): a man of Bravo is taken, the man
        //        who walks to his post is taken too — asked what is going on, Bravo says who it has not heard of (never "all up here"); then Alpha goes silent, is
        //        asked for, and Bravo, with men of its own not heard of, is not the squad that goes
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const B = bravo(g), gone: any[] = [B[0]], away = () => { park(g); gone.forEach((x, i) => { x.held = true; x.char.pos[0] = -60; x.char.pos[2] = -60 - 2 * i; }); }; away();
            const evB = () => all(g).filter(e => e.q === 'Bravo');
            until(R, 120, () => { away(); const l = evB().find(e => e.what === 'looks'); if (l) for (const x of bravo(g)) if (x.script && !gone.includes(x)) gone.push(x); return !!l; });
            const sent = gone.length - 1; away();
            until(R, 60, () => { away(); return all(g).some(e => e.what === 'net query' && /asks Bravo/.test(e.why) && !/still at it/.test(e.why)); });
            until(R, 3, () => { away(); return false; });
            const q = all(g).filter(e => e.what === 'net query' && /asks Bravo/.test(e.why)), ans = R.said.filter((t: string) => /^Bravo: (still nothing from|all up here|still looking|checking our own)/.test(t));
            F.verdict(sent >= 1 && q.length >= 1 && q.length <= 2 && ans.some((t: string) => /^Bravo: still nothing from /.test(t)) && !ans.some((t: string) => /all up here/.test(t)) && !!noted(g, /Charlie is wary \(.+ of Bravo is not answering\)/),
              'net, the answer: Bravo has a man taken and the man sent to his post taken too — asked "what\'s going on?" (twice at the most) it says who it has not heard of, the squads go wary, and "all up here" is not said (before: "all up here — nothing more", and the question closed)',
              `${sent} looker(s) taken · ${q.map(e => `@${e.t.toFixed(1)} ${e.why}`).join(' | ')} · ${ans.join(' | ') || 'no answer said'}`);
            for (const x of alpha(g)) killGuard(g, x, [1, 0, 0], true);
            until(R, 200, () => { away(); return R.said.some((t: string) => /nothing from Alpha — /.test(t)) || all(g).some(e => e.what === 'contact'); });
            const E = all(g);
            F.verdict(R.said.some((t: string) => /^(Bravo|Charlie): Alpha\? … Alpha, sound off$/.test(t)) && R.said.some((t: string) => /^(Bravo|Charlie): nothing from Alpha — nobody to send, stay on your doors!$/.test(t)) && !E.some(e => e.what === 'net looks' || e.what === 'contact'),
              'net, a squad with men of its own missing sends nobody: Alpha is asked for and does not answer — Bravo, still waiting on its own, is not sent across the floor ("nobody to send, stay on your doors!"; before: a squad was free to send again the frame its own lookers were dropped)',
              `${netRows(g)} · ${R.said.filter((t: string) => /Alpha/.test(t)).join(' | ')}`);
          } finally { R.done(); } }
        // 17j · a man the net sent who keys up and is cut off is the alarm (netCutAlarm): Alpha dropped, the pair of Bravo on its way — one of them has
        //        something in his eye, keys up, and is dropped mid call: a man of Bravo at home calls contact AT ALPHA'S POSTS, and Charlie hears of it. Off:
        //        his broken call is one more man to ask for, and no squad is in contact
        for (const alarm of [true, false]) { net(true); dark(true); SQUADS.netCutAlarm = alarm;
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const home0 = new Map<any, number[]>(bravo(g).map((x: any) => [x, [x.char.pos[0], 0, x.char.pos[2]]]));
            for (const x of alpha(g)) killGuard(g, x, [1, 0, 0], true);
            until(R, 200, () => { park(g); return all(g).some(e => e.what === 'net looks'); });
            let L: any = null; until(R, 12, () => { park(g); L = bravo(g).find((x: any) => x.script && x.speed > 0.4 && flatD(x.char.pos, home0.get(x)!) > 4.5) ?? null; return !!L; });
            if (L) { L.awareness = 1; sees(R, L, 0.4, () => { park(g); L.state = 'alert'; }); }
            const keyed = !!L && all(g).some(e => e.q === 'Bravo' && e.what === 'calls' && e.why.startsWith(`${L.callsign} keys up`));
            const before = all(g).some(e => e.what === 'contact'); if (L) killGuard(g, L, [1, 0, 0], true);
            until(R, 8, () => { park(g); return false; });
            const E = all(g), cut = E.find(e => e.q === 'Bravo' && e.what === 'cut off'), c = E.find(e => e.what === 'contact'), line = R.said.find((t: string) => /^Bravo: (Tango \d+|[A-Z][a-z-]+) cut off at Alpha — contact, Alpha!$/.test(t));
            const heard = !!noted(g, /Charlie hears of them \(Bravo's call\)/);
            if (alarm) F.verdict(keyed && !before && !!cut && /sent to look at Alpha, and his breaking off is what he found/.test(cut.why) && !!c && c.q === 'Bravo' && /Alpha's posts: .+ keyed up and was cut off/.test(c.why) && !!line && heard,
              'net, a looker cut off is the alarm: a man of the pair sent to Alpha keys up and is dropped mid call — a man of Bravo at home calls "Tango N cut off at Alpha — contact, Alpha!", the place is the post he was sent to, and Charlie hears of it (before: one more missed check; 27 of the 43 pairs sent in the sample ended that way)',
              `${L?.callsign ?? 'no looker on his way'} ${keyed ? 'keyed up' : 'did NOT key up'} · ${cut?.why ?? 'no cut off row'} · ${line ?? 'no line'} · ${c ? `${c.q} contact @${c.t.toFixed(1)}: ${c.why}` : 'no contact'} · Charlie ${heard ? 'hears of it' : 'hears nothing'}`);
            else F.verdict(keyed && !!cut && !/what he found/.test(cut.why) && !c && !line,
              '… and with that rule off (netCutAlarm) the same broken call is one more man to ask for: no squad in contact 8 s on', `${cut?.why ?? 'no cut off row'} · ${E.filter(e => e.what === 'contact').length} contact row(s)`);
          } finally { R.done(); SQUADS.netCutAlarm = true; } }
        // 17f · off is off, and the roll call keeps its own dice: nobody dropped, 100 s — the roll call is on the net, and the game is the one it is without it
        { const whole: string[] = [], rolls: number[] = [], rows: number[] = [];
          for (const on of [false, true]) { net(on); dark(false);
            const R = await rig('block-squads.json', 3);
            try { const g = R.g; let acc = '';
              for (let i = 0; i < 100 * 60; i++) { g.player.visibility = 0.05; R.W.step(DT); if (i % 30 === 29) acc = hashDigest({ acc, d: digestGame(g, true) }); }
              whole.push(acc); rolls.push(R.said.filter((t: string) => RE_ROLL.test(t)).length); rows.push(all(g).filter(e => /^net /.test(e.what)).length);
            } finally { R.done(); } }
          F.verdict(rolls[0] === 0 && rows[0] === 0 && rolls[1] >= 1 && whole[0] === whole[1], 'net, dice: 100 s with nobody dropped — off: no roll call, no net row; on: the roll call is on the net and the game\'s digest every half second is the one it is with it off (the call-beat game)',
            `off ${whole[0]} · ${rolls[0]} roll calls  |  on ${whole[1]} · ${rolls[1]} roll calls, ${rows[1]} net rows`);
        }
        // 17k · a squad that goes down in the middle of its own count does not hold the roll call up for good (second review, N1): a man of Alpha is dropped,
        //        Alpha calls its own "sound off", and the rest of it is dropped on that frame — the net still calls its roll and asks for Alpha by name
        { net(true); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            const A = alpha(g); killGuard(g, A[0], [1, 0, 0], true);
            const own = () => all(g).find(e => e.q === 'Alpha' && e.what === 'check');
            until(R, 150, () => { park(g); return !!own(); });
            const mid = own(); for (const x of A) if (x !== A[0]) killGuard(g, x, [1, 0, 0], true);
            const t0 = g.time; until(R, 200, () => { park(g); return R.said.some((t: string) => RE_ASK.test(t)) || all(g).some(e => e.what === 'contact'); });
            const E = all(g), rolled = E.some(e => e.what === 'net check' && e.t > t0), asked = R.said.some((t: string) => RE_ASK.test(t));
            F.verdict(!!mid && rolled && asked && !E.some(e => e.what === 'contact'),
              'net, a squad down in the middle of its own count: Alpha calls "sound off" with a man missing and the rest of it is dropped on that frame — the roll call still comes and Alpha is asked for by name (before: the unfinished count held the roll call up for the rest of the run)',
              `${mid ? `Alpha's check @${mid.t.toFixed(1)}` : 'Alpha never called its own check'} · down @${t0.toFixed(1)} · ${netRows(g) || 'no net row'} · ${(g.time - t0).toFixed(1)} s on`);
          } finally { R.done(); } }
        // 17g · off under the ask's own value: the staging of 17a with the net's ask off — 120 s, and nobody asks after Alpha
        { net(false); dark(true);
          const R = await rig('block-squads.json', 1);
          try { const g = R.g; park(g); for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; R.W.step(DT); park(g); }
            for (const x of alpha(g)) killGuard(g, x, [1, 0, 0], true);
            until(R, 120, () => { park(g); return false; });
            F.verdict(!R.said.some((t: string) => RE_ROLL.test(t) || RE_ASK.test(t)) && !all(g).some(e => /^net /.test(e.what)) && !all(g).some(e => e.what === 'contact'),
              'net off (the call-beat game): the same three dropped, 120 s — no roll call, nobody asks for Alpha, no squad in contact: the gap this switch is for', `${squadsReport(g).map((q: any) => `${q.name} ${q.state}`).join(' · ')} · ${R.said.filter((t: string) => /Alpha/.test(t)).length} lines naming Alpha`);
          } finally { R.done(); } }
        SQUADS.netAsk = false;
      }
      SQUADS.callBeat = false; SQUADS.callBody = true; SQUADS.noticedEyes = false;
    }
  } finally { SQUADS.netAsk = false; SQUADS.radioCheck = wasOn; SQUADS.noticedEyes = false; SQUADS.callBeat = false; SQUADS.callBody = true; SQUADS.heardAsks = true; SQUADS.callCutAsk = [1, 2]; BODY_LIGHT.lit = wasLit.lit; BODY_LIGHT.litNear = wasLit.litNear; }
  return F.done();
}
