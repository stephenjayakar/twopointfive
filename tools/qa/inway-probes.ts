// YOU'RE IN THE WAY (src/game/orders.ts ORDERS.inWay, noRoomWords, IN_WAY_WORDS) — a door order refused 'no room on that door' ONLY because Sam's own body
// is on one of the stack's places is refused in other words: the man who speaks says he is in the way. Words only: no order is taken that was refused, no
// place is dealt that was not, nobody stands anywhere else by the key.
//   bun run tools/qa/probes.ts stack-inway          (family 'inway'; TPS_PROFILE=shipped for the page's stand, TPS_INWAY=1 raises the key on the frozen one)
// Headless, staged the same on either stand; nothing here looks at a picture or hears a voice (the line is read off Game.say and the order's own answer).
//   tight   the barracks, the south gallery's west door from the gallery (sg_w): the four put on that face a few metres back, the stack's four places read
//           with Sam away, Sam then stood on the LAST of them. 'stack up' for all four is refused, and the words — the order's answer, the line a man says,
//           the menu's greyed word, the door tools' own test of the same face — are IN_WAY_WORDS with the key on, 'no room on that door.' with it off.
//   off     the same door, Sam stepped off: the order is taken, each of the four dealt a place of his own, one of them the place Sam stood on (so the line was true)
//   none    the compound, the hall's north door from the yard (hall_n): no room for four with Sam nowhere near, and none with him stood in front of it:
//           'no room on that door.' with the key on as with it off (the line is never said of a door that has no room without him)
//   same    key on against key off, each on a fresh staging: every man's order, door, place and position after each case are the same
//   quiet   the second ask leaves nothing behind: the makers' counters, the run digest and the die are as they stood before it
//   cold    all of the above read the door's places with Sam away first, so every memo the makers keep (the stack-room book's floors, the shots asked
//           through glass) is warm before the key is ever asked. Here the game has NEVER asked that door: the four and Sam are put by coordinates handed
//           over from the warm staging, the order is given bare (no menu word, no tool test), Sam steps off, it is given again and played. Key on against
//           key off: the words differ as they should; every man's dealt place and where he stands after are the same; the four counter tables moved by
//           the same amounts; the run digest at the end is the same, but for the bubble of the man who spoke the refusal (digest.ts folds its words in)
//   journal a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
// INWAY_BREAK=1 = the key is left off in this probe's key-on runs: 'tight' (and with it the verdict) must fail on both stands.
import { ROOT } from './headless.ts';
const BT: any = await import('./bang-tally.ts');
const { ORDERS, IN_WAY_WORDS } = await import(`${ROOT}/src/game/orders.ts`);
const { STACK_OWN, DOORMANNERS_STATS } = await import(`${ROOT}/src/game/doorway.ts`);
const { STACKROOM_STATS } = await import(`${ROOT}/src/game/stackroom.ts`);
const { GLASSPEN_STATS } = await import(`${ROOT}/src/game/glasspen.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);

const PLAIN = 'no room on that door.';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
const frame = (d: any, side: 1 | -1) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre;
  return { at: (b: number, l: number): number[] => [c[0] + n[0] * b + u[0] * l, 0, c[2] + n[1] * b + u[1] * l] }; };
interface Man { who: string; order: string; door: string; post: number[] | null; pos: number[] }
interface Case { why: string | null; said: string[]; menu: string | null; tool: unknown; /** every man as the order left him, the moment it was given */ dealt: Man[]; /** … and after the seconds played */ men: Man[] }

/** a level stood up with the four and nobody to fight, the key set AFTER the stand-up (the frozen stand pins it off, the page's raises it) */
async function fresh(scn: string, key: boolean) {
  const S: any = await quiet(() => BT.stage(scn, 1)); const g = S.g, O = g.orders;
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
  ORDERS.inWay = key;
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'), said: string[] = [], say = g.say.bind(g);
  g.say = (gd: any, text: string, ...rest: any[]) => { said.push(`${gd.callsign}: ${text}`); return say(gd, text, ...rest); };
  const men = (): Man[] => team.map(m => { const A = O.of(m); return { who: m.callsign, order: A?.order ?? '-', door: A?.door?.def.name ?? '-', post: A?.post ? [A.post[0], 0, A.post[2]] : null, pos: [m.char.pos[0], 0, m.char.pos[2]] }; });
  /** 'stack up' on that face for all four, as the menu gives it: the order's answer, what was said, the greyed word and the door tools' test, then `secs` played */
  const give = async (d: any, side: 1 | -1, secs: number, bare = false): Promise<Case> => { const t = { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side }, n0 = said.length;
    const menu = bare ? null : O.whyNot(O.defs.find((x: any) => x.id === 'stack'), O.forMen(t, team), team), tool = bare ? null : g.doorTools.canThreshold(O.forMen(t, team), team);   // (`bare`: the order alone — nothing asks the door before it)
    const why = await quiet(() => O.give('stack', t, 'all')), heard = said.slice(n0), dealt = men(); await quiet(() => S.step(Math.round(60 * secs)));
    return { why: why ?? null, said: heard, menu, tool, dealt, men: men() }; };
  const put = async (p: number[]) => { await quiet(() => g.teleportPlayer([p[0], 0, p[2]] as any)); };
  return { S, g, O, team, give, put, men };
}

/** floor on that face of a door to put the four and Sam on, a few metres back, each with a short walk to its front (the grid alone: no stack place is asked) */
function spotsOn(g: any, d: any, side: 1 | -1): number[][] { const X = frame(d, side), nav = g.col.nav, gate = X.at(0.7, 0), spots: number[][] = [];
  for (const back of [2.4, 3.2, 4.2, 1.6]) for (const lat of [3.5, -3.5, 4.5, -4.5, 2.6, -2.6, 5.5, -5.5, 1.5, -1.5, 0.4]) { const p = X.at(back, lat); if (nav.isBlocked(p[0], p[2]) || spots.some(s => flat(s, p) < 0.8)) continue;
    const path = nav.findPath(p, gate); if (!path || !path.length) continue; let len = 0, q = p; for (const w of path) { len += flat(q, w); q = w; } if (len < 9) spots.push(p); }
  return spots; }
const STATS = (): Record<string, number>[] => [STACK_OWN, DOORMANNERS_STATS, STACKROOM_STATS, GLASSPEN_STATS];
/** the cold case on one setting of the key: a game that has never asked sg_w for a place. `spots`, `last` and `aside` are the warm staging's own numbers */
async function cold(key: boolean, spots: number[][], last: number[], aside: number[]) {
  const B = await fresh('barracks-four', key), d = B.g.doors.byName('sg_w'), was = STATS().map(T => ({ ...T }));
  B.team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
  await B.put(last); const tight = await B.give(d, 1, 2, true);
  await B.put(aside); const off = await B.give(d, 1, 10, true);
  const moved = STATS().map((T, i) => Object.fromEntries(Object.keys(T).map(k => [k, T[k] - (was[i][k] ?? 0)]).filter(([, v]) => v !== 0)));
  return { tight, off, stats: JSON.stringify(moved), digest: digestGame(B.g, true) };
}

/** the three cases on one setting of the key, each from a fresh staging of its level */
async function play(key: boolean) {
  // ---- the barracks' sg_w from the gallery: the four a few metres back on that face, Sam off to one side
  const B = await fresh('barracks-four', key), d = B.g.doors.byName('sg_w'), side = 1 as const;
  const spots = spotsOn(B.g, d, side);
  if (spots.length < B.team.length + 1) throw new Error(`sg_w: no floor to put the four and Sam on that face (${spots.length} spots)`);
  B.team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
  await B.put([1e4, 0, 1e4]); const places: number[][] = (B.O.stackPostsWait(d, side, B.team) ?? []).map((P: any) => [P.pos[0], 0, P.pos[2]]);   // (the door's places with Sam away)
  const aside = spots.slice(B.team.length).find(p => places.every(q => flat(p, q) >= 1.5)); if (!places.length || !aside) throw new Error(`sg_w: ${places.length} places with Sam away, ${aside ? 'a' : 'no'} spot off them for him`);
  const last = places[places.length - 1]; await B.put(last); const stood = [...B.g.player.char.pos] as number[];
  // (the second ask alone, before any order: what it leaves behind)
  const tabs = () => JSON.stringify([STACK_OWN, DOORMANNERS_STATS, STACKROOM_STATS, GLASSPEN_STATS]), dig = () => JSON.stringify(digestGame(B.g, true)), die = Math.random; let draws = 0;
  const t0 = tabs(), d0 = dig(), keyWas = ORDERS.inWay; ORDERS.inWay = true; Math.random = () => { draws++; return die(); };
  let words = ''; try { words = B.O.noRoomWords(PLAIN, () => B.O.stackPostsWait(d, side, B.team)); } finally { Math.random = die; ORDERS.inWay = keyWas; }
  const quietAsk = { words, tabs: tabs() === t0, digest: dig() === d0, draws, stillNone: B.O.stackPostsWait(d, side, B.team) === null };
  const tight = await B.give(d, side, 2);
  await B.put(aside); const off = await B.give(d, side, 10);
  // ---- the compound's hall_n from the yard: no room for four, Sam where the level put him and then stood in front of the door
  const C = await fresh('compound-four', key), h = C.g.doors.byName('hall_n'), samFar = flat(C.g.player.char.pos, h.frameCentre);
  await C.put([1e4, 0, 1e4]); const bare = C.O.stackPostsWait(h, 1, C.team); await C.put([2.0, 0, 17.0]);
  const none = await C.give(h, 1, 2); await C.put(frame(h, 1).at(0.8, 0)); const samNear = flat(C.g.player.char.pos, h.frameCentre), noneNear = await C.give(h, 1, 2);
  return { places, last, stood, aside, spots, quietAsk, tight, off, bare, samFar, samNear, none, noneNear };
}

export async function stackInWay(): Promise<boolean> {
  console.log('\n=== stack-inway: a stack refused only for Sam\'s own body says so (ORDERS.inWay) ==='); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const BREAK = process.env.INWAY_BREAK === '1'; if (BREAK) console.log('  (INWAY_BREAK: ORDERS.inWay is left off in this probe\'s key-on runs — the line \'tight\' must fail)');
  const keyWas = ORDERS.inWay;
  try {
    const on = await play(!BREAK), off = await play(false);
    const refused = (c: Case, words: string) => c.why === words && c.said.length === 1 && c.said[0].endsWith(`: ${words}`) && c.menu === words && c.dealt.every(m => m.order !== 'stack') && c.men.every(m => m.order !== 'stack');
    const say = (c: Case) => `give → ${c.why === null ? 'taken' : `REFUSED "${c.why}"`} · said: ${c.said.join(' / ') || 'nothing'} · the menu's greyed word: ${c.menu ?? 'none'} · the door tools' test: ${c.tool}`;
    const taken = (c: Case, r: typeof on) => c.why === null && c.dealt.length === 4 && c.dealt.every(m => m.order === 'stack' && m.door === 'sg_w' && !!m.post) && c.dealt.every((m, i) => c.dealt.every((o, j) => i === j || flat(m.post!, o.post!) > 0.6))
      && c.dealt.filter(m => flat(m.post!, r.last) < 0.02).length === 1 && c.men.every(m => m.order === 'stack' && m.door === 'sg_w');   // (the places are dealt afresh at the order — the men have moved since they were read with Sam away — but the one Sam stood on is among them)
    verdict(on.places.length === 4 && flat(on.stood, on.last) < 0.7 && refused(on.tight, IN_WAY_WORDS) && on.tight.tool === IN_WAY_WORDS,
      'tight (key on): Sam on the last of the four places at the barracks\' sg_w — the stack is refused, and the man says he is in the way',
      `the places with Sam away ${on.places.map(at).join(' ')} · Sam stood at ${at(on.stood)}, ${flat(on.stood, on.last).toFixed(2)} m off the last · ${say(on.tight)}`);
    verdict(taken(on.off, on),
      'off (key on): the same door with Sam stepped off — the order is taken, each of the four dealt a place of his own, one of them the place Sam stood on',
      `Sam at ${at(on.aside)} · ${say(on.off)} · ${on.off.dealt.map(m => `${m.who} → ${m.post ? at(m.post) : '-'}`).join(' · ')}`);
    verdict(on.bare === null && on.samFar > 6 && refused(on.none, PLAIN) && on.none.tool === PLAIN && on.samNear < 1.5 && refused(on.noneNear, PLAIN) && on.noneNear.tool === PLAIN,
      'none (key on): a door with no room without him — the compound\'s hall_n — says \'no room on that door.\', Sam far off or stood in front of it',
      `places with Sam away: ${on.bare === null ? 'none' : 'some'} · Sam ${on.samFar.toFixed(1)} m off: ${say(on.none)} · Sam ${on.samNear.toFixed(1)} m off: ${say(on.noneNear)}`);
    verdict(refused(off.tight, PLAIN) && off.tight.tool === PLAIN && taken(off.off, off) && refused(off.none, PLAIN) && refused(off.noneNear, PLAIN),
      'CONTROL (INWAY_BREAK does not touch it) — key off: the tight door says \'no room on that door.\' as it did, and the other cases end as with the key on',
      `tight: ${say(off.tight)} · off: ${say(off.off)} · none: ${say(off.none)}`);
    const cases: [string, Case, Case][] = [['tight', on.tight, off.tight], ['off', on.off, off.off], ['none', on.none, off.none], ['none, Sam near', on.noneNear, off.noneNear]];
    const gapOf = (A: Man[], B: Man[]) => Math.max(0, ...A.map((m, i) => { const o = B[i]; return !o || m.who !== o.who || m.order !== o.order || m.door !== o.door || !m.post !== !o.post ? 99 : Math.max(flat(m.pos, o.pos), m.post && o.post ? flat(m.post, o.post) : 0); })), gap = (a: Case, b: Case) => Math.max(gapOf(a.dealt, b.dealt), gapOf(a.men, b.men));
    const gaps = cases.map(([n, a, b]) => [n, gap(a, b)] as const), placed = Math.max(0, ...on.places.map((p, i) => off.places[i] ? flat(p, off.places[i]) : 99));
    verdict(gaps.every(([, m]) => m < 1e-6) && placed < 1e-6 && on.places.length === off.places.length && cases.every(([, a, b]) => (a.why === null) === (b.why === null)),
      'CONTROL (INWAY_BREAK does not touch it) — same: no order is taken or refused by the key, and every man\'s order, door, place and position, as each order left him and after the seconds played, are the same key on and key off',
      `${gaps.map(([n, m]) => `${n}: ${m.toFixed(6)} m`).join(' · ')} · the door's places with Sam away: ${placed.toFixed(6)} m apart · ${cases.map(([n, a]) => `${n} ${a.men.length} men`).join(', ')}`);
    const Q = on.quietAsk, Q2 = off.quietAsk;
    verdict([Q, Q2].every(q => q.words === IN_WAY_WORDS && q.tabs && q.digest && q.draws === 0 && q.stillNone),
      'CONTROL (INWAY_BREAK does not touch it) — quiet: the second ask (asked here with the key held on) answers, and leaves the makers\' counters, the run digest and the die as they stood; the door is still refused',
      [Q, Q2].map(q => `"${q.words}" · counters ${q.tabs ? 'as they stood' : 'MOVED'} · digest ${q.digest ? 'equal' : 'DIFFERS'} · ${q.draws} draws · the plain ask after it: ${q.stillNone ? 'no places' : 'PLACES'}`).join(' | '));
    // cold: the same door on games that have never asked it (the warm staging's coordinates, the order given bare) — key held ON whatever the break word says
    { const a = await cold(true, on.spots, on.last, on.aside), b = await cold(false, on.spots, on.last, on.aside);
      const m = Math.max(gap(a.tight, b.tight), gap(a.off, b.off)), bare = (c: Case, words: string) => c.why === words && c.said.length === 1 && c.said[0].endsWith(`: ${words}`) && c.dealt.every(x => x.order !== 'stack');
      const differs: string[] = diffDigest(a.digest, b.digest, 24), words = differs.filter(l => /\]\.bubble: /.test(l)), rest = differs.filter(l => !words.includes(l)), took = (c: Case) => c.why === null && c.dealt.length === 4 && c.dealt.every(x => x.order === 'stack' && x.door === 'sg_w' && !!x.post) && c.dealt.filter(x => flat(x.post!, on.last) < 0.02).length === 1;
      verdict(bare(a.tight, IN_WAY_WORDS) && bare(b.tight, PLAIN) && took(a.off) && took(b.off) && m < 1e-6 && a.stats === b.stats && rest.length === 0 && words.length <= 1,
        'CONTROL (INWAY_BREAK does not touch it) — cold: on a game that has never asked that door, Sam on the last place — the words differ by the key and nothing else does: once he steps off the order is taken, every man\'s dealt place and where he stands after the seconds played, the makers\' counters and the run digest at the end (but the bubble of the man who spoke: it holds the words) are the same key on and key off',
        `key on: ${a.tight.said.join(' / ') || 'nothing said'} · key off: ${b.tight.said.join(' / ') || 'nothing said'} · stepped off: ${a.off.why === null ? 'taken' : `REFUSED "${a.off.why}"`} / ${b.off.why === null ? 'taken' : `REFUSED "${b.off.why}"`} · places and positions differ by ${m.toFixed(6)} m · counters moved ${a.stats === b.stats ? 'alike' : `APART: on ${a.stats} · off ${b.stats}`} · digest ${rest.length ? `DIFFERS: ${rest.slice(0, 6).join(' · ')}` : 'equal'}${words.length ? ` but ${words.join(' · ')}` : ''}`); }
    // the journal: a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
    const R = await fresh('barracks-four', false), g = R.g, J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), KN: any = await import(`${ROOT}/src/game/knobs.ts`), kept = KN.knobsCopy();
    try {
      ORDERS.inWay = true; const old = snap(); if (old.tables.ORDERS) delete old.tables.ORDERS.inWay; if (old.flags) delete old.flags.inWay; J.applyKnobs(g, old); const x = ORDERS.inWay;
      ORDERS.inWay = true; const yes = snap(); ORDERS.inWay = false; J.applyKnobs(g, yes); const y = ORDERS.inWay;
      ORDERS.inWay = false; const no = snap(); ORDERS.inWay = true; J.applyKnobs(g, no); const z = ORDERS.inWay;
      verdict(x === false && y === true && z === false, 'CONTROL (plumbing: INWAY_BREAK does not touch it) — the journal: a recording from before ORDERS.inWay replays with it off, one made with it on replays on, one made with it off replays off', `old → ${x} · recorded on → ${y} · recorded off → ${z}`);
    } finally { KN.knobsBack(kept); }
  } finally { ORDERS.inWay = keyWas; }
  console.log(`=== stack-inway: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
