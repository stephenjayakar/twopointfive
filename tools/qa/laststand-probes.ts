// The 'laststand' family (game/laststand.ts — what the last few defenders of a room clear do once most are down: two switches, both shipped off), run through
// probes.ts:   bun run tools/qa/probes.ts laststand | laststand-callout | laststand-regroup | laststand-keep
// PASS / FAIL each, all headless — no picture and no sound here. Each stages levels/compound.json (five on eleven, three squads), leaves the team on its start
// mark and takes the defenders down by hand to the three the probe names, so the endgame starts on a known floor.
//   laststand-callout   `callOut` alone against both switches off, same seed: every man, door and item digests the same every half second (telling only);
//                       off = no state at all; on = a radio check, answers naming the rooms the men are truly in, the count and the asker's room, the strip
//                       draws them, the objective brackets exactly those rooms and its marker sits on one; a man with the team in his sight does not answer
//                       and is not counted; down to one, he says he is the last and where (a man at his post: the net names his room; a man out hunting:
//                       it names none). LASTSTAND_BREAK=1 = call out off for the two last-man runs: those two lines must fail
//   laststand-regroup   `regroup`: nothing before three are left; then the check, an order naming one room, the others say so and walk to it, every man of it
//                       digs in and sets, one of them says the room is shut; the rooms they left are clear for the room clear and the marker is on the stand;
//                       two minutes later they are still set in it (no stand-down), still asking the net by the room's name
//   laststand-keep      `regroup` with the Keep's three (a squad whose men stay in its rooms): whoever moves stays inside the Keep's rooms
//   laststand-few       'most are down' is never more than a third of the staging: on the block's eight (levels/block.json) three up says nothing, two
//                       up starts the check
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LASTSTAND, lastStandReport, lastStandHint } = await import(`${ROOT}/src/game/laststand.ts`);
const { digInPhase, digInWedged } = await import(`${ROOT}/src/game/digin.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { stripRows } = await import(`${ROOT}/src/game/cues.ts`);
const { placeIn } = await import(`${ROOT}/src/game/dialogue.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { NETQUIET } = await import(`${ROOT}/src/game/netquiet.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
type Sw = { regroup: boolean; callOut: boolean };
async function rig(seed: number, sw: Sw, level = 'compound') {
  LASTSTAND.regroup = sw.regroup; LASTSTAND.callOut = sw.callOut; Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try { console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${level}.json`), 'utf8'))) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=${level}.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return W;
}
const up = (g: any) => g.nightBreach.hostiles.filter((h: any) => h.state !== 'dead');
const roomOf = (g: any, gd: any): string | null => g.roomClear.roomAt(gd.char.pos);
const nameOf = (g: any, id: string | null) => g.roomClear.rooms.find((r: any) => r.def.id === id)?.def.name ?? '?';
/** the team stays on its start mark, unseen; every defender but the first of each room in `keep` is taken down by hand (quietly: no shot for anybody to hear) */
function thin(W: any, keep: string[]) {
  const g = W.game, kept: any[] = [];
  for (const R of g.roomClear.rooms) { const stay = keep.includes(R.def.id) ? R.defenders[0] : null; if (stay) kept.push(stay); for (const h of R.defenders.slice()) if (h !== stay && h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); }
  return kept;
}
function steps(W: any, secs: number, each?: (i: number) => void) { const g = W.game; for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(DT); each?.(i); } }
const said = (g: any) => lastStandReport(g).said as { t: number; who: string; kind: string; text: string }[];

export async function lastStandCallOut(): Promise<boolean> {
  const F = family('laststand-callout: telling only — same run with it on and off; the rooms on their net are the rooms they are in');
  const was = { ...LASTSTAND }, nq = NETQUIET.on;
  // the net goes quiet (netquiet.ts) is held OFF here: this probe's subject is the call out ALONE, which only tells. With that rule on (the shipped stand) a
  // check the dead do not answer shakes the men who hear it — by that rule's own seam (laststand.ts tickCheck → netQuietClosed), so the run with call out on
  // is no longer the run with it off, and that is the other rule's doing: `probes.ts netquiet` (Q12a) holds the two together, on the shipped stand.
  NETQUIET.on = false;
  try {
    const KEEP = ['office', 'bunk', 'back'];
    const out: { moves: string; rep: any; rows: Set<string>; obj: any; hint: string[]; truth: string[]; clean: number; first: number }[] = [];
    for (const on of [true, false]) {
      const W = await rig(5, { regroup: false, callOut: on }), g = W.game; NETQUIET.on = false;   // (again after the stand-up, which re-reads the stand's words: TPS_NETQUIET=1, the shipped stand)
      let moves = '', clean = 0, first = -1; const rows = new Set<string>();
      const frame = (i: number) => { if (i % 30 === 0) moves += hashDigest(digestGame(g, true)) + ' '; for (const r of stripRows(g) as { text: string }[]) rows.add(r.text); };
      steps(W, 1, frame); clean = said(g).length + lastStandReport(g).stats.checks;
      const kept = thin(W, KEEP);
      steps(W, 30, i => { frame(i); if (first < 0 && said(g).length) first = i / 60; });
      out.push({ moves, rep: lastStandReport(g), rows, obj: { ...g.roomClear.objective() }, hint: [...(lastStandHint(g)?.rooms ?? [])].sort(), truth: kept.map((h: any) => roomOf(g, h)).sort() as string[], clean, first });
      if (on) {   // … and one of the three in a fight (the team in his sight every frame): he does not answer the next check
        const busy = kept[1], n0 = said(g).length;
        steps(W, LASTSTAND.every + 12, () => { busy.lastSeenT = g.time; });
        const later = said(g).slice(n0), ans = later.filter(l => l.kind.startsWith('ans'));
        F.verdict(later.some(l => l.kind === 'checkN') && ans.length === 1 && !later.some(l => l.who === busy.callsign) && lastStandReport(g).known.length === 2 && !lastStandReport(g).known.includes(busy.callsign),
          'a man with the team in his sight does not answer the check, and nobody counts him', `${busy.callsign} busy: ${later.map(l => `${l.who} '${l.text}'`).join(' · ')} → known ${lastStandReport(g).known.join(', ')}`);
      }
    }
    // down to one from the start: nobody answers him, he says he is the last and where. TWO MEN, because what the net then names is two rules of laststand.ts
    // (a man is named by what he SAID; 'a man out hunting is not a room to go to' — tickCheck / tellOnly `free ? null : w`, the marker comes off him):
    //   the guard hut's — a squad of one, so no mate of his drops and he HOLDS HIS POST on both stands: he says the hut and the net names the hut;
    //   the office's — the man this line always kept. On the frozen stand his squad is in contact the frame a mate of it drops (the squads' radio check is
    //     held off there) and he is OUT HUNTING when he says it: he says where he truly is and the net names nothing, in a room or out of one. On the
    //     placement before the hand one he said it in the corridor, so 'named = the room he is in' held for want of a room; on the hand placement he says
    //     it walking through the bunk room. On the shipped stand he holds the office: the first case again.
    // LASTSTAND_BREAK=1 = call out left OFF for these two runs: both lines must fail, on both stands.
    for (const id of ['hut', 'office']) {
      const W = await rig(5, { regroup: false, callOut: process.env.LASTSTAND_BREAK !== '1' }), g = W.game; steps(W, 1); const [one] = thin(W, [id]);
      let room: string | null = null, named = '', spot = '', hunting = false, got = false;   // (where he is, what he is doing and what the net has named, the frame he says it — he may move afterwards)
      steps(W, 16, () => { if (!got && said(g).some(l => l.kind === 'lastAt')) { got = true; room = roomOf(g, one); named = [...(lastStandHint(g)?.rooms ?? [])].join(); spot = room || !LASTSTAND.places ? '' : placeIn(g.level, one.char.pos)?.name ?? ''; hunting = (g.fight.defs as any[]).find(D => D.gd === one)?.mode === 'free'; } });
      const tail = said(g), last = tail.find(l => l.kind === 'lastAt'), post = id === 'hut';
      // (no room of the structure: 'outside the …' on ground the level has no word for — or, LASTSTAND.places, 'in the corridor' by the level's own name for the floor he stands on)
      const says = !!last && last.who === one.callsign && (room ? last.text.includes(`in the ${nameOf(g, room)}`) : spot ? last.text.includes(`in ${spot}`) : /outside the /.test(last.text));
      F.verdict(tail[0]?.kind === 'check1' && says && named === (hunting ? '' : room ?? '') && (!post || (!hunting && room === id)),
        post ? 'the last man at his post: nobody answers his check, he says so and where he is, and the net names his room'
          : 'the last man: nobody answers his check, he says so and where he truly is; the net names a room only if he holds one (a man out hunting is no room to go to)',
        `${tail.map(l => `${l.who} '${l.text}'`).join(' · ') || 'nothing said'} → ${!got ? 'he never says he is the last' : `${hunting ? 'out hunting' : 'holding'}, truly ${room ? 'in ' + room : 'outside the rooms'} then, named '${named}'${spot ? `, place '${spot}'` : ''}`}`);
    }
    const [A, B] = out, a = A.moves.split(' '), b = B.moves.split(' ');
    F.verdict(A.moves === B.moves && a.length > 55, 'every man, door and item digests the same with call out on and off, every half second for 31 s (bubbles included)', `${a.length - 1} digests · ${A.moves === B.moves ? 'identical' : 'first difference at ' + (a.findIndex((h, i) => h !== b[i]) / 2).toFixed(1) + ' s'}`);
    F.verdict(B.rep.on === 'off' && B.rep.said.length === 0 && B.rep.stats.checks === 0 && B.hint.length === 0 && !/\[/.test(B.obj.text), 'both switches off: no check, no line, no state, the objective as it was', `${B.rep.said.length} lines, ${B.rep.stats.checks} checks · ${B.obj.text}`);
    const S = A.rep.said as { who: string; kind: string; text: string }[], ans = S.filter(l => l.kind === 'ansAt'), few = S.find(l => l.kind === 'fewAt');
    F.verdict(A.clean === 0 && A.first >= LASTSTAND.first[0] && A.first <= LASTSTAND.first[1] + 0.1, 'nothing is said with eleven up; the check goes out a few seconds after only three are left', `first line ${A.first.toFixed(1)} s after`);
    F.verdict(S[0]?.kind === 'check1' && ans.length === 2 && !!few && /3 of us/.test(few.text) && A.rep.known.length === 3, 'a radio check, two answers, and the asker says the count', S.slice(0, 5).map(l => `${l.who}: ${l.text}`).join(' · '));
    F.verdict(A.hint.join() === A.truth.join() && A.truth.length === 3, 'the rooms named on their net are the rooms the three are in', `named ${A.hint.join(', ')} · truly in ${A.truth.join(', ')}`);
    const drawn = [...A.rows].filter(t => /still up|still here|holding|of us/.test(t));
    F.verdict(drawn.length >= 2 && [...B.rows].every(t => !/of us|who's (still|left)/.test(t)), "the answers reach the radio strip (their net's rows)", `${drawn.length} drawn: ${drawn.slice(0, 3).join(' · ')}`);
    const br = (A.obj.text.match(/\[[^\]]+\]/g) ?? []) as string[];
    F.verdict(br.length === 3 && !!A.obj.pos, 'the objective brackets the three rooms named and keeps a marker', A.obj.text);
  } finally { Object.assign(LASTSTAND, was); NETQUIET.on = nq; }
  return F.done();
}

async function standRun(F: { verdict: Verdict }, keep: string[], seed: number, long: boolean, squadRooms: string[] | null) {
  const W = await rig(seed, { regroup: true, callOut: false }), g = W.game;
  steps(W, 1); const clean = said(g).length + lastStandReport(g).stats.checks;
  const kept = thin(W, keep), was = kept.map((h: any) => roomOf(g, h));
  let orderT = -1, setT = -1, outside = 0, n = 0; const seen = new Set<string>();
  while (n < 150 * 60 && (setT < 0 || n < setT * 60 + 300)) steps(W, 1, () => {   // (until five seconds after the room is said shut, 150 s at most)
    const i = n++, R = lastStandReport(g);
    if (orderT < 0 && R.said.some((l: any) => l.kind === 'order' || l.kind === 'orderFrom')) orderT = i / 60;
    if (setT < 0 && R.said.some((l: any) => l.kind.startsWith('set'))) setT = i / 60;
    if (squadRooms) for (const h of kept) { const id = roomOf(g, h); if (id) seen.add(id); else if (i % 6 === 0 && h.state !== 'dead') outside++; }
  });
  const R = lastStandReport(g), S = R.said as { who: string; kind: string; text: string }[], stand = R.room as string | null;
  F.verdict(clean === 0, 'nothing is said or counted with eleven up', `${clean}`);
  F.verdict(S[0]?.kind === 'check1' && S.filter(l => l.kind === 'ansAt' || l.kind === 'ansFreeAt').length >= 2 && orderT > 0, 'the check, two answers that say where, and an order', S.slice(0, 4).map(l => `${l.who}: ${l.text}`).join(' · '));
  const order = S.find(l => l.kind === 'order' || l.kind === 'orderFrom');
  F.verdict(!!order && !!stand && order.text.includes(nameOf(g, stand)) && was.includes(stand), 'the order names one room — one a man of theirs is already holding', `${order?.who}: ${order?.text} → ${stand} (they were in ${was.join(', ')})`);
  const inRoom = kept.filter((h: any) => h.state !== 'dead' && roomOf(g, h) === stand), went = S.filter(l => l.kind === 'go'), came = S.filter(l => l.kind === 'in');
  F.verdict(R.stats.sent >= 1 && went.length === R.stats.sent - R.stats.quiet && R.stats.arrived >= 1 && R.stats.arrived + R.stats.short + R.stats.met + R.stats.diedOnWay + R.stats.dropped + R.moving.length === R.stats.sent && inRoom.length === R.in.length && R.in.length >= 2,
    'every man sent says so and walks; who arrives is in the room (a man stopped on the way holds where he is and says so)', `${R.stats.sent} sent, ${R.stats.arrived} arrived, ${R.stats.short} stopped short, ${R.stats.met} met, ${R.moving.length} still walking, ${R.stats.noWay} with no way · in the room: ${inRoom.map((h: any) => h.callsign).join(', ')} · ${went.concat(came).map(l => `${l.who}: ${l.text}`).join(' · ')}`);
  const phases = inRoom.map((h: any) => digInPhase(g, h)), setLine = S.find(l => l.kind === 'set' || l.kind === 'setOpen');
  const fdefs = g.fight.defs as any[], standRoom = fdefs.find(D => D.gd === inRoom[0])?.room, wedged = standRoom ? digInWedged(g, standRoom).length : 0;
  F.verdict(phases.every((p: string) => p === 'set') && !!setLine && setLine.text.includes(nameOf(g, stand)) && (setLine.kind === 'set') === (wedged > 0), 'every man in the room digs in and sets; one of them says so ("shut" only with a door wedged)', `${phases.join(', ')} · ${setLine?.who}: ${setLine?.text} (${setT.toFixed(1)} s after three were left, ${wedged} door(s) wedged)`);
  const held = g.roomClear.rooms.filter((r: any) => !r.cleared).map((r: any) => r.def.id), loose = kept.filter((h: any) => h.state !== 'dead' && !R.in.includes(h.callsign)).length;   // (a man told to hold where he is, on his way, or out hunting — nobody's to order — still holds a room of his own)
  const obj = g.roomClear.objective(), b = g.roomClear.rooms.find((r: any) => r.def.id === stand)?.def.bounds;
  F.verdict(held.includes(stand) && held.length <= 1 + loose && !!obj.pos && !!b && Math.abs(obj.pos[0] - (b.x0 + b.x1) / 2) < 0.01 && obj.text.includes(`[${nameOf(g, stand)}]`),
    'the rooms they left are clear behind them; the marker and the bracket are on the stand room', `still held: ${held.join(', ')} · ${obj.text}`);
  if (squadRooms) F.verdict([...seen].every(id => squadRooms.includes(id)), "a squad whose men stay in its rooms: nobody is ever in a room that is not the squad's", `rooms they were in: ${[...seen].join(', ')} · ${outside} samples between rooms`);
  if (long) {
    const n0 = S.length; steps(W, 120);
    const R2 = lastStandReport(g), later = (R2.said as any[]).slice(n0), still = kept.filter((h: any) => h.state !== 'dead' && roomOf(g, h) === stand && digInPhase(g, h) === 'set');
    F.verdict(still.length >= inRoom.length && later.filter(l => l.kind === 'checkStand').length >= 3 && later.every(l => l.kind !== 'checkStand' || l.text.includes(nameOf(g, stand))),
      'two minutes on they are still set in it (no stand-down), still asking the net by the room\'s name', `${still.length} of ${inRoom.length} set · ${later.filter(l => l.kind === 'checkStand').length} checks · ${R2.stats.thumps} thuds at a wedged door`);
    // … and the last of them, once the others are down, knows it at the next check with no answer: he says so, with his room, and holds what he holds
    const left = kept.filter((h: any) => h.state !== 'dead'), last = left.find((h: any) => lastStandReport(g).in.includes(h.callsign)) ?? left[0]; for (const h of left) if (h !== last) killGuard(g, h, [1, 0, 0], true);
    const n1 = said(g).length; steps(W, LASTSTAND.again + 25);
    const end = said(g).slice(n1), line = end.find(l => l.kind === 'lastAt');
    F.verdict(left.length >= 2 && !!line && line.who === last.callsign && line.text.includes(nameOf(g, stand)) && digInPhase(g, last) === 'set' && roomOf(g, last) === stand && lastStandReport(g).stats.lastMan === 1,
      'the others down: the last man of the stand says he is the last, and where, and stays set', `${line?.who}: ${line?.text} · then ${end.filter(l => l !== line).map(l => l.kind).join(', ') || 'nothing'}`);
  }
  return { W, R };
}
export async function lastStandRegroup(): Promise<boolean> {
  const F = family('laststand-regroup: the last three gather in one room on a spoken order, dig in and stay set');
  const was = { ...LASTSTAND };
  try { await standRun(F, ['sala', 'kitchen', 'hut'], 3, true, null); } finally { Object.assign(LASTSTAND, was); }
  return F.done();
}
export async function lastStandKeep(): Promise<boolean> {
  const F = family('laststand-keep: the Keep\'s three (its men stay in its rooms) make their stand inside it');
  const was = { ...LASTSTAND };
  try { await standRun(F, ['office', 'bunk', 'back'], 5, false, ['office', 'bunk', 'back']); } finally { Object.assign(LASTSTAND, was); }
  return F.done();
}
export async function lastStandFew(): Promise<boolean> {
  const F = family('laststand-few: the last few are never more than a third of the men staged');
  const was = { ...LASTSTAND };
  try {
    const W = await rig(2, { regroup: true, callOut: true }, 'block'), g = W.game; steps(W, 1);
    const all = g.nightBreach.hostiles.slice(), down = (n: number) => { for (const h of all) if (up(g).length > n && h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); };
    down(3); steps(W, 12); const at3 = said(g).length + lastStandReport(g).stats.checks;
    down(2); steps(W, 12); const at2 = said(g);
    F.verdict(all.length === 8 && at3 === 0, 'eight staged, three up: nothing is said (three is more than a third)', `${all.length} staged · ${at3} lines or checks with three up`);
    F.verdict(at2[0]?.kind === 'check1' && lastStandReport(g).stats.up0 === 2, 'two up: the radio check goes out', at2.slice(0, 3).map(l => `${l.who}: ${l.text}`).join(' · '));
  } finally { Object.assign(LASTSTAND, was); }
  return F.done();
}
