// The 'pouches' family (the pouches rule of game/kit.ts: breaching tools and throwables come out of each man's pouches, and the four teammates' together out
// of the squad's; the costs are game/slots.json, the balance's table), run through probes.ts and also under 'kit':
//   bun run tools/qa/probes.ts pouches | pouch-table | pouch-card | pouch-stage
// PASS / FAIL each, all headless. The MECHANICS are held on the probe's own table (T0 below, in slots.json's shape: a swap of slots.json for other numbers
// must not move them); the SHIPPED table is held by what must be true of any table: the issued kit a legal fill, each set and each named loadout a legal fill
// for all five, no walk of the rows, the sets and kitSet ever outside the rule.
//   pouch-table   the table as data: a row stepped past the man's pouches is refused with a reason and nothing written, one past the SQUAD's the same with
//                 the squad's reason, and a pouch given up on one card is another's to take; a row of choices walks past a choice that does not fit and says
//                 which; a most-a-squad; the sets are the table's loadouts and a single card's set the squad has no room for is refused; kitLoadout; a saved
//                 kit over the rule comes back inside it (only what it added over the issued kit given up, last man first for the squad, the store
//                 untouched, a line for the card); the build before's store is read; a table that breaks the issued kit or a set is refused whole; the switch
//                 off (?noslots) = the rows, sets and counts of the build before the rule, word for word (fixtures/kit-rows-base.json) and nothing is refused
//   pouch-card    the real memberCard and loadout screen on a fake DOM: pips and 'n / m', the squad's line on a teammate, each priced row's cost in words, a
//                 refused press says why on its row (mouse and keys; a held key and a digit do nothing) and changes nothing, a trade across two cards, a set
//                 refused, a passed choice named, a sanitized save says so; off: no meter, no cost words, the Cans row
//   pouch-wall    the wall charge row: there only in a build whose wall charge takes its count from the cards (wallHere — held here with a stand-in for
//                 that hook where the build has none), two pouches, one to a squad; kitStage tells the wall charge at every staging; the squad kit row;
//                 and, with every squad kit there to walk, the card in a line (kitWords) names each tool that fills a pouch, on every kit and set
//   pouch-stage   legal changed cards staged on the room clear with four: the squad's count, kitPool and the run agree; your smoke and stun counts are on the
//                 player (and none of either leaves his hand on something else); YOU CARRY WHAT A TEAMMATE CARRIES: as many pouches, the issued card fills
//                 them, a staging under the rule puts one smoke / stun / frag / round on the player, a quit gives back what a Player is built with, and
//                 with the rule off nothing of it is written; every card as issued digests the same rule off and table off IN THIS BUILD, and under the
//                 rule the same run to the second (the cross-build comparison with the build before the rule is run beside the probes)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { El, withDom } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { KIT, KIT_MEMBERS, KIT_LS, KIT_NOTE, KIT_PRESETS, SLOTS } = K;
const { SCENARIOS, pickSearch, quitSearch } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, teamOf, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function memStore(seed?: string) { const m = new Map<string, string>(); if (seed !== undefined) m.set(KIT_LS, seed); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }
const text = (e: El) => e.textContent.replace(/\s+/g, ' ').trim();
const byCls = (root: El, c: string) => root.all(e => e.cls.has(c));
const keyEv = (key: string) => ({ key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, repeat: false, stopped: false, preventDefault() { this.stopped = true; }, stopPropagation() {} });

/** the table the build ships (the balance part's slots.json) */
const SHIPPED = JSON.parse(readFileSync(resolve(ROOT, 'src/game/slots.json'), 'utf8'));
/** THE PROBE'S OWN TABLE (the mechanics are held on this, whatever ships), in slots.json's shape: you four pouches like a teammate, the four teammates
 *  seven between them; one thing to a pouch, the wall charge two. With it the issued cards read you 4/4, Red One 4/4, Red Two 3/4, the squad 7/7.
 *  (You had eleven until slots.json v6 — the maintainer, 10-10: "an unrealistic number of pouches … symmetric with the team" — and were issued 4 smoke,
 *  2 stun, 2 frags, 3 rounds of 40 mm; now one of each. Every figure of YOURS below is that change; no teammate's moved.) */
const mates = (n: number) => [1, 2, 3, 4].map(i => ({ i, kind: 'mate', pouches: n }));
const T0 = { v: 4, members: [{ i: 0, kind: 'you', pouches: 4 }, ...mates(4)], squad: { pouches: 7 as number | null },
  tools: [
    { id: 'smoke', pouches: 1, who: ['you'], maxPerMan: { you: 4 }, inBuild: true },
    { id: 'stun', pouches: 1, who: ['you', 'mate'], maxPerMan: { you: 4, mate: 3 }, inBuild: true },
    { id: 'frag', pouches: 1, who: ['you', 'mate'], maxPerMan: { you: 3, mate: 2 }, inBuild: true },
    { id: 'shell40', pouches: 1, who: ['you'], maxPerMan: { you: 4 }, inBuild: true },
    { id: 'doorCharge', pouches: 1, who: ['mate'], maxPerMan: { mate: 2 }, inBuild: true },
    { id: 'shotgun', pouches: 1, who: ['you', 'mate'], maxPerMan: { you: 1, mate: 1 }, inBuild: true },
    { id: 'wallCharge', pouches: 2, who: ['mate'], maxPerMan: { mate: 1 }, maxPerSquad: 1, inBuild: false } as Record<string, unknown>,
  ],
  loadouts: [
    { id: 'wall', members: [{ smoke: 1, stun: 1, frag: 1, shell40: 1 }, { wallCharge: 1, stun: 2 }, { stun: 1, frag: 2 }, {}, {}] },
    { id: 'stun', members: [{ smoke: 1, stun: 2, shell40: 1 }, { stun: 3, doorCharge: 1 }, { stun: 3 }, {}, {}] },
    { id: 'quiet', cards: { 0: { weapon: 'pistol', shells: 0 }, 1: { weapon: 'pistol', suppressed: true, light: false } }, members: [{ smoke: 3, frag: 1 }, { stun: 2 }, { stun: 1 }, {}, {}] },
    { id: 'shotgun', cards: { 1: { weapon: 'pistol' }, 2: { weapon: 'shotgun' } }, members: [{ smoke: 1, stun: 1, frag: 1, shell40: 1 }, { stun: 3, frag: 1 }, { shotgun: 1, stun: 1, frag: 1 }, {}, {}] },
  ] };
const tool = (id: string, patch: Record<string, unknown>) => T0.tools.map(t => (t.id === id ? { ...t, ...patch } : t));
/** the rule on, a table in force, every card as issued */
function under(table: unknown) { K.kitLoad(null, ''); const why = K.slotsSet(table); if (why) throw new Error(`the probe's table was refused: ${why}`); K.kitReset(); }
function shipped() { K.kitLoad(null, ''); K.slotsSet(SHIPPED); K.kitReset(); }
const fill = (i: number, m = KIT.members[i]) => { const c = K.kitCost(i, m); return `${c.used}/${c.total}`; };
const sq = () => { const c = K.squadCost(); return c ? `${c.used}/${c.total}` : 'no squad limit'; };
const fills = () => `${[0, 1, 2, 3, 4].map(i => fill(i)).join(' ')} · squad ${sq()}`;
const snap = () => JSON.stringify(KIT.members);
const M = () => KIT.members as any[];

// ───────────────────────────────────────────────────────────── table ───────────────────────────────────
export async function pouchTable(): Promise<boolean> {
  const F = family('pouch-table: the pouches rule as data');
  try {
    // ── the shipped table
    shipped();
    F.verdict(SLOTS.ok && SLOTS.on && SLOTS.why === '' && K.kitLegal() === null && M().every((_m, i) => !K.kitChanged(i)) && [2, 3, 4].every(n => K.kitPool(n).bangs === DOORTOOLS.bangs && K.kitPool(n).charges === DOORTOOLS.charges),
      'slots.json is taken, the rule is on, and the kit as issued is a legal fill: every man inside his pouches (and, where a table sets one, the teammates together inside the squad\'s); the squad\'s count is the game\'s', `${M().map((_m, i) => `${K.kitName(i).title} ${fill(i)}${K.kitCost(i).lines.length ? ` (${K.kitCost(i).lines.map((l: any) => `${l.n} ${l.item} = ${l.pouches}`).join(', ')})` : ''}`).join(' · ')} · squad ${sq()} · kitPool(4) ${JSON.stringify(K.kitPool(4))}${K.slotsUnknown().length ? ` · priced, no row in this build: ${K.slotsUnknown().join(', ')}` : ''}`);
    // ── the shipped table sets NO squad limit (v7; the maintainer: "feels weird that there's a limit on the whole squad when individuals have free pouches"):
    //    as issued, a teammate with free pouches fills them — up to his own four and each tool's most a man — and a man whose own are full is refused in his own words
    { const lim = SLOTS.table.squad, cost0 = K.squadCost(), full = K.kitTry(1, 'bangs', 1), blue = [K.kitTry(3, 'bangs', 1), K.kitTry(3, 'bangs', 1), K.kitTry(3, 'frags', 1), K.kitTry(3, 'frags', 1)], b3 = fill(3), fifth = K.kitTry(3, 'smoke', 1), other = [K.kitTry(4, 'charges', 1), K.kitTry(4, 'smoke', 1)], legal = K.kitLegal(), pool = K.kitPool(4), smokes = K.kitSmokes(4), all = fills();
      shipped();
      F.verdict(lim === null && cost0 === null && !full.ok && /pouch/.test(full.why) && !/squad/.test(full.why) && blue.every(x => x.ok) && b3 === '4/4' && !fifth.ok && !/squad/.test(fifth.why) && other.every(x => x.ok) && legal === null && pool.bangs === DOORTOOLS.bangs + 2 && pool.frags === 4 && pool.charges === DOORTOOLS.charges + 1 && smokes === 1,
        'the shipped table sets no squad limit: with the kit as issued Blue One fills his own four pouches (two stun, two frags) and Blue Two takes a door charge and a smoke, nothing given up by anybody; what stops a man is his own pouches (Red One, full as issued; Blue One\'s fifth), said without a word about the squad; the squad\'s count is what the cards carry',
        `squad limit ${lim} · Red One +1 stun: '${full.why}' · Blue One ${b3}, a fifth: '${fifth.why}' · ${all} · carries ${JSON.stringify(pool)}, ${smokes} smoke`); }
    { const rows: string[] = []; let ok = true;
      for (const p of KIT_PRESETS) { K.kitPresetAll(p.id); const legal = K.kitLegal(), each = M().map((_m, i) => K.kitPresetOf(i)); const good = legal === null && each.every(x => x === p.id) && (p.id !== 'issued' || M().every((_m, i) => !K.kitChanged(i))); ok &&= good; rows.push(`${p.id}: ${fills()}${good ? '' : ` ✗ ${legal ?? each.join(',')}`}`); }
      // … and pressed on ONE card with the others as issued: taken (the card is exactly the set) or refused with the reason and nothing written
      let taken = 0, refused = 0;
      for (const p of KIT_PRESETS) for (let i = 0; i < KIT_MEMBERS; i++) { shipped(); const c = JSON.stringify(K.kitPresetCard(i, p.id)), was = snap(), why = K.kitPresetWhy(i, p.id), r = K.kitPreset(i, p.id);
        const good = r.ok ? (why === '' && JSON.stringify(KIT.members[i]) === c && K.kitPresetOf(i) === p.id && K.kitLegal() === null) : (!!r.why && r.why === why && snap() === was); ok &&= good; if (r.ok) taken++; else refused++; if (!good) rows.push(`${p.id} on ${i} ✗`); }
      shipped();
      F.verdict(ok, 'the three sets (as issued, quiet, loud) put on everybody are legal fills on the shipped table and each card then reads as that set; pressed on one card alone a set is taken exactly, or refused with the reason and nothing written', `${rows.join(' | ')} · one card at a time: ${taken} taken, ${refused} refused`); }
    { const rows: string[] = []; let ok = true, put = 0;
      for (const L of SLOTS.table.loadouts as any[]) { shipped(); const was = snap(), why = K.kitLoadout(L.id), good = why === null ? K.kitLegal() === null : (K.loadoutMissing(L).length > 0 && /no row for/.test(why) && snap() === was); ok &&= good; if (why === null) put++; rows.push(`${L.id}: ${why === null ? `${fills()} · carries ${JSON.stringify(K.kitPool(4))}` : `not here — ${why}`}${good ? '' : ' ✗'}`); }
      const none = K.kitLoadout('no-such'); shipped();
      F.verdict(ok && put >= 2 && /no loadout/.test(none ?? ''), 'every named loadout of the shipped table goes on all five cards at once as a legal fill (kitLoadout: what the tallies stage), or is refused by name for a tool this build has no row for; an unknown name is refused', rows.join(' | ')); }
    { // a seeded walk over the rows (steps and outright sets), the sets and your canister splits: never outside the rule, a refusal has a reason and writes nothing
      const rnd = seeded(0x90c4); let steps = 0, refused = 0, bad: string[] = [], whys = new Set<string>();
      for (let n = 0; n < 4000; n++) { const i = Math.floor(rnd() * KIT_MEMBERS), rows = K.kitRows(i), r = rows[Math.floor(rnd() * rows.length)], dir = rnd() < 0.62 ? 1 : -1, was = snap(), how = rnd(); steps++;
        if (how < 0.7) { const peek = K.kitPeek(i, r.field, dir), t = K.kitTry(i, r.field, dir);
          if (!t.ok) { refused++; whys.add(`${i}.${r.field}`); if (!t.why || snap() !== was || peek.why !== t.why) bad.push(`${i}.${r.field}: a refusal with no reason, or one that wrote`); }
          else if (peek.why || peek.value !== t.value) bad.push(`${i}.${r.field}: the peek and the step disagree`); }
        else if (how < 0.86) { const v = r.values[Math.floor(rnd() * r.values.length)]; if (!K.kitSet(i, r.field, v)) { refused++; if (snap() !== was) bad.push(`${i}.${r.field}: a refused set wrote`); } }
        else if (how < 0.96) { const p = KIT_PRESETS[Math.floor(rnd() * KIT_PRESETS.length)].id, t = K.kitPreset(i, p); if (!t.ok) { refused++; if (!t.why || snap() !== was) bad.push(`${i} ${p}: a refused set wrote`); } }
        else if (!K.kitSet(0, 'cans', ['issued', 'smoke', 'even', 'stun'][Math.floor(rnd() * 4)])) { refused++; if (snap() !== was) bad.push('cans: a refused split wrote'); }
        const legal = K.kitLegal(); if (legal) bad.push(`after step ${n}: ${legal}`); }
      F.verdict(!bad.length && refused > 0, 'shipped table, 4000 seeded presses — row steps, values set outright, sets, your canister splits by name — over every card: the five cards are never outside the rule, every refusal says why and writes nothing, and what the arrows promise (kitPeek) is what a press does', `${steps} presses, ${refused} refused, step refusals on ${whys.size} different rows${bad.length ? ` · ${bad.slice(0, 4).join(' · ')}` : ''}`); }

    { // the same walk on a table that narrows what a man may carry below what his rows offer (no shotgun for a teammate, three smoke at most for you, no named
      // loadouts): the choices and the splits have a most-a-man too
      under({ ...T0, tools: tool('shotgun', { who: ['you'], maxPerMan: { you: 1 } }).map(t => (t.id === 'smoke' ? { ...t, maxPerMan: { you: 3 } } : t)), loadouts: [] });
      K.kitTry(1, 'frags', -1); K.kitTry(1, 'charges', -1); K.kitTry(1, 'weapon', 1); const sh = K.kitTry(1, 'weapon', 1), shSet = K.kitSet(1, 'weapon', 'shotgun'), mine = K.kitPeek(0, 'weapon', -1), cans = K.kitSet(0, 'cans', 'smoke'), legal0 = K.kitLegal(); K.kitReset();
      const rnd = seeded(0x51a7); let bad = 0, refused = 0, first = '';
      for (let n = 0; n < 3000; n++) { const i = Math.floor(rnd() * KIT_MEMBERS), rows = K.kitRows(i), r = rows[Math.floor(rnd() * rows.length)], how = rnd();
        const ok = how < 0.6 ? K.kitTry(i, r.field, rnd() < 0.6 ? 1 : -1).ok : how < 0.85 ? K.kitSet(i, r.field, r.values[Math.floor(rnd() * r.values.length)]) : how < 0.95 ? K.kitPreset(i, KIT_PRESETS[Math.floor(rnd() * 3)].id).ok : K.kitSet(0, 'cans', ['issued', 'smoke', 'even', 'stun'][Math.floor(rnd() * 4)]);
        if (!ok) refused++; const legal = K.kitLegal(); if (legal) { bad++; first ||= `after press ${n}: ${legal}`; } }
      F.verdict(sh.ok && sh.value === 'rifle' && /^shotgun: the shotgun is not his to carry/.test(sh.passed) && !shSet && mine.value === 'shotgun' && !mine.why && !cans && legal0 === null && bad === 0 && refused > 0,
        'a table that narrows what a man may carry below what his rows offer: a choice over his most is refused with that reason (the shotgun: a teammate\'s weapon row, two pouches of his own free, walks past it and says so, and set outright it is not taken; your own row still offers it), as is a canister split by name over your most of smoke, and 3000 seeded presses never leave the cards outside the rule',
        `Red One weapon › › : ${sh.value}, passed '${sh.passed}' · 'cans' → all smoke taken: ${cans} · ${refused} refused${first ? ` · ${first}` : ''}`); }

    // ── the mechanics, on the probe's own table
    under(T0);
    { const st = memStore(); K.kitLoad(st, ''); K.kitReset(); const kept0 = st.m.get(KIT_LS), start = fills();
      const own = K.kitTry(1, 'bangs', 1), kept1 = st.m.get(KIT_LS), set = K.kitSet(1, 'bangs', 3), stepV = K.kitStep(1, 'bangs', 1);
      const two = K.kitTry(2, 'bangs', 1), room2 = K.kitCost(2).free, blue = K.kitTry(3, 'bangs', 1), kept2 = st.m.get(KIT_LS);
      const down = K.kitTry(1, 'frags', -1), mid = sq(), up = K.kitTry(3, 'bangs', 1), full = sq(), back = K.kitTry(1, 'frags', 1), free1 = K.kitCost(1).free;
      F.verdict(start === '4/4 4/4 3/4 0/4 0/4 · squad 7/7' && !own.ok && /needs a pouch, none free \(4 of 4 full\): give something up first/.test(own.why) && own.value === 2 && kept1 === kept0 && set === false && stepV === 2
        && !two.ok && room2 === 1 && /the squad has none free \(7 of 7 full\): take something off a teammate first/.test(two.why) && !blue.ok && blue.why === two.why && kept2 === kept0
        && down.ok && mid === '6/7' && up.ok && up.value === 1 && full === '7/7' && !back.ok && free1 === 1 && /the squad has none free/.test(back.why),
        'a row cannot be stepped past the budget, and says whose: Red One, his own four pouches full, is refused a third stun canister (by the arrows, by kitSet, by kitStep; nothing written); Red Two has a pouch of his own free and Blue One four, and both are refused by the SQUAD\'s seven; Red One\'s frag given up is the pouch Blue One\'s stun canister takes, and then Red One cannot have the frag back',
        `issued ${start} · Red One +1 stun: '${own.why}' · Red Two +1 stun (${room2} of his own free): '${two.why}' · after Red One −1 frag: squad ${mid}, Blue One stun ${up.value}, squad ${full} · frag back: '${back.why}'`);
      under(T0); }
    { // the squad's pouches are the teammates' WHO COME (the loadout screen's size): cards cut for a pair, then the team grows
      K.kitTeam(2); const pairSq = sq(); K.kitTry(1, 'frags', -1); const blue = [K.kitTry(3, 'bangs', 1), K.kitTry(3, 'bangs', 1)], red = K.kitTry(1, 'frags', 1), pairNow = sq(), legal2 = K.kitLegal(), legal4 = K.kitLegal(KIT.members, 4);
      const notes0 = KIT_NOTE.join(''), grown = K.kitTeam(4), after = fills(), b3 = M()[3].bangs, note3 = KIT_NOTE[3], legalG = K.kitLegal(), back = K.kitTeam(2), solo = (K.kitTeam(0), K.squadCost());
      F.verdict(pairSq === '7/7' && blue.every(x => x.ok) && red.ok && pairNow === '7/7' && legal2 === null && /teammates together need 9 pouches/.test(legal4 ?? '') && notes0 === '' && grown === 4 && after === '4/4 4/4 3/4 0/4 0/4 · squad 7/7' && b3 === 0 && /^No room in the squad's pouches with this team: 2 stun canisters left behind\.$/.test(note3) && legalG === null && back === 2 && solo?.used === 0,
        'the squad\'s pouches are counted over the teammates who come: with a pair, a man who stays behind is held by his own pouches only (Blue One takes two stun canisters while the pair fill all seven); when the team grows to four the men who now come are over the seven between them, and the last man who added something gives it up, his card saying so',
        `pair: squad ${pairSq} → Blue One 2 stun, Red One his frag back, squad ${pairNow}; as a four that would be: '${legal4}' · grown to four: ${after} · Blue One: '${note3}'`);
      under(T0); }
    { // your card: smoke and stun are counted rows of their own, out of your four and never the squad's
      const rows = K.kitRows(0).map((r: any) => r.field), s2 = K.kitTry(0, 'smoke', 1), b2 = K.kitTry(0, 'bangs', 1);
      K.kitTry(0, 'shells', -1); K.kitTry(0, 'frags', -1); K.kitTry(0, 'bangs', -1); const s4 = (K.kitTry(0, 'smoke', 1), K.kitTry(0, 'smoke', 1), K.kitTry(0, 'smoke', 1)), c = fill(0), words = K.kitWords(0), most = K.kitRows(0).find((r: any) => r.field === 'smoke').values.slice(-1)[0], round = K.kitTry(0, 'smoke', 1), sqSame = sq();
      under(T0); K.kitTry(0, 'bangs', -1); K.kitTry(0, 'shells', -1); const before = fill(0), wrap = K.kitTry(0, 'shells', -1), after = fill(0), f2 = K.kitTry(0, 'frags', 1);
      F.verdict(rows.includes('smoke') && rows.includes('bangs') && !rows.includes('cans') && !s2.ok && /none free \(4 of 4 full\)/.test(s2.why) && !b2.ok && s4.ok && s4.value === 4 && most === 4 && c === '4/4' && /4 smoke, no stun/.test(words) && round.ok && round.value === 0 && sqSame === '7/7'
        && before === '2/4' && wrap.ok && wrap.value === 2 && after === '4/4' && !f2.ok,
        'your canisters are two counted rows (smoke, stun), a pouch each, not four fixed splits of six: as issued one more of either is refused; the launcher\'s grenade, the frag and the stun canister left behind buy three more smoke; the row ends at the table\'s most and › from there comes round to none (as every row does); ‹ off none lands on the most that still fits (two grenades, not four); and none of it touches the squad\'s pouches',
        `rows ${rows.join(' ')} · +1 smoke '${s2.why}' · shells, frag, stun 0 → smoke ${s4.value} (${c}) · '${words}' · › again ${round.value} · ‹ off 0 shells with 2 free: ${wrap.value} (${before} → ${after}) · second frag then: '${f2.why}'`);
      under(T0); }
    { // the big thing and the row of choices: the wall charge takes two pouches, the shotgun's shells one; a man with both is charged both
      // (the wall charge's row is this build's — kit.ts wallHere, asked below: a build whose wall charge takes no count has no two-pouch thing to hold this on)
      const sh = K.kitTry(1, 'walls', 1), shSet = K.kitSet(1, 'walls', 1); K.kitTry(1, 'frags', -1); const sh1 = K.kitTry(1, 'walls', 1); K.kitTry(1, 'charges', -1); const sh2 = K.kitTry(1, 'walls', 1), full = fills();
      const w = [K.kitTry(2, 'weapon', 1), K.kitTry(2, 'weapon', 1)]; K.kitTry(2, 'frags', -1); const gun = K.kitTry(2, 'weapon', -1), withGun = fills();
      const noRoom = K.kitSet(1, 'weapon', 'shotgun'); K.kitTry(1, 'bangs', -1); const both = K.kitSet(1, 'weapon', 'shotgun'), bothCost = fill(1), lines = K.kitCost(1).lines.map((l: any) => l.item).join('+');
      F.verdict(K.wallHere() && !sh.ok && /needs 2 pouches, none free \(4 of 4 full\)/.test(sh.why) && !shSet && !sh1.ok && /needs 2 pouches, only 1 free \(3 of 4 full\)/.test(sh1.why) && sh2.ok && sh2.value === 1 && full === '4/4 4/4 3/4 0/4 0/4 · squad 7/7'
        && w[0].ok && w[0].value === 'pistol' && w[0].passed === '' && w[1].ok && w[1].value === 'rifle' && /^shotgun: needs a pouch, the squad has none free/.test(w[1].passed) && gun.ok && gun.value === 'shotgun' && gun.passed === '' && withGun === '4/4 4/4 3/4 0/4 0/4 · squad 7/7' && !noRoom && both && bothCost === '4/4' && /walls/.test(lines) && /shotgun/.test(lines),
        'a big thing takes two pouches (Red One, full, is refused the wall charge; one frag given up is not enough and the reason says only one is free; a charge too, and it fits); a row of choices walks on past a choice with no room and SAYS what it passed and why (Red Two\'s weapon row steps rifle, pistol, rifle: the shotgun\'s shells want a pouch the squad has not got); a pouch freed, he takes the shotgun; and a man with the wall charge and the shotgun on his card is charged both (full, he is refused the gun; a stun canister given up, its shells have their pouch)',
        `wall charge: '${sh.why}' · after −1 frag: '${sh1.why}' · after −1 charge: wall charges ${sh2.value} (${full}) · Red Two weapon › › : ${w.map(x => x.value).join(', ')}, passed '${w[1].passed}' · after −1 frag, ‹: ${gun.value} (${withGun}) · Red One wall charge + shotgun: ${bothCost} (${lines})`);
      // a most-a-squad (the probe's table allows one wall charge to a squad; the shipped one sets no such limit: pouch-wall)
      under(T0); K.kitTry(1, 'frags', -1); K.kitTry(1, 'charges', -1); const first = K.kitTry(1, 'walls', 1); K.kitTry(2, 'frags', -1); K.kitTry(2, 'charges', -1); const second = K.kitTry(3, 'walls', 1), roomWas = sq();
      F.verdict(first.ok && roomWas === '5/7' && !second.ok && /one wall charge to a squad, and a teammate carries it/.test(second.why), 'a tool the table allows one of to a squad: with room in his own pouches and in the squad\'s, a second man is refused it because a teammate carries it', `squad ${roomWas}, Blue One wall charge: '${second.why}'`);
      under(T0); }
    { // the sets are the table's loadouts: Quiet its 'quiet', Loud its 'stun'; looks and guns are the set's own
      const cards = [0, 1, 2, 3, 4].map(i => KIT_PRESETS.map((p: any) => K.kitPresetCard(i, p.id))), q0 = cards[0][1] as any, l0 = cards[0][2] as any, q1 = cards[1][1] as any, l1 = cards[1][2] as any, l2 = cards[2][2] as any;
      const legal = KIT_PRESETS.map((p: any) => { K.kitPresetAll(p.id); return K.kitLegal() === null && M().every((_m, i) => K.kitPresetOf(i) === p.id) ? fills() : null; }); under(T0);
      // one card alone, with the squad's room taken by a teammate
      K.kitPreset(2, 'quiet'); const afterQuiet = sq(); K.kitTry(3, 'bangs', 1); K.kitTry(3, 'bangs', 1); const was = snap(), why = K.kitPresetWhy(2, 'issued'), r = K.kitPreset(2, 'issued'), same = snap() === was; K.kitPresetAll('issued'); const all = !M().some((_m, i) => K.kitChanged(i)) && K.kitLegal() === null;
      // a table that names no loadouts: a set's pouches are the issued kit's
      under({ ...T0, loadouts: [] }); const bare = K.kitPresetCard(1, 'loud') as any, bareQ = K.kitPresetCard(0, 'quiet') as any; under(T0);
      F.verdict(legal.every(Boolean) && q0.weapon === 'pistol' && q0.smoke === 3 && q0.bangs === 0 && q0.frags === 1 && q0.shells === 0 && l0.smoke === 1 && l0.bangs === 2 && l0.frags === 0 && l0.shells === 1 && q1.bangs === 2 && q1.charges === 0 && q1.frags === 0 && q1.weapon === 'pistol' && l1.bangs === 3 && l1.charges === 1 && l1.frags === 0 && l2.bangs === 3 && l2.charges === 0 && l1.suppressed === false
        && cards.every((cs, i) => JSON.stringify(cs[0]) === JSON.stringify(K.kitDefault(i))) && afterQuiet === '5/7' && !r.ok && r.why === why && /needs 2 pouches, the squad has none free \(7 of 7 full\)/.test(why) && same && all
        && bare.bangs === 2 && bare.charges === 1 && bare.frags === 1 && bare.suppressed === false && bareQ.smoke === 1 && bareQ.shells === 0 && bareQ.weapon === 'pistol',
        'a set\'s guns and looks are its own and what fills the pouches is the table\'s loadout of that name — Quiet the table\'s "quiet" (your launcher grenades stay behind with the rifle), Loud its "stun" — each a legal fill for all five; as issued is the issued kit; a set pressed on one card when a teammate holds the pouches it wants is refused with the reason and nothing written, while a set on everybody is never refused; a table that names no loadouts leaves a set\'s pouches as issued (bar the launcher grenades of a set that carries no rifle)',
        `all five: ${legal.map((x: any, k: any) => `${KIT_PRESETS[k].id} ${x}`).join(' | ')} · you quiet ${q0.smoke} smoke ${q0.bangs} stun ${q0.shells} shells, loud ${l0.smoke}/${l0.bangs} · Red One loud ${l1.bangs} stun ${l1.charges} charge ${l1.frags} frag · Red Two back to issued with Blue One on 2 stun: '${why}'`); }
    { // the launcher's rounds go home with the rifle (the table's rule: a count is charged whatever else is on the card)
      under(T0); const st = memStore(); K.kitLoad(st, ''); K.kitReset(); const start = fill(0);
      const gone = K.kitTry(0, 'weapon', 1), s0 = M()[0].shells, c0 = fill(0), note = K.kitRows(0).find((r: any) => r.field === 'shells').note(M()[0]), more = K.kitTry(0, 'shells', 1), down = K.kitTry(0, 'shells', -1), set = K.kitSet(0, 'shells', 2), kept = JSON.parse(st.m.get(KIT_LS)!).members[0].shells;
      const gun = K.kitTry(0, 'weapon', 1), s1 = M()[0].shells, back = K.kitSet(0, 'weapon', 'rifle'), s2 = M()[0].shells, c2 = fill(0), again = [K.kitTry(0, 'shells', 1), K.kitTry(0, 'shells', 1)], c3 = fill(0);
      // a kit saved with launcher rounds beside a pistol (the rule off, or a build before it): read under the rule they are left behind, and the card says so
      const raw = JSON.stringify({ v: 2, members: [{ ...K.kitDefault(0), weapon: 'pistol' }, null, null, null, null] }); K.kitLoad(memStore(raw), ''); const l = { ...M()[0] }, lNote = KIT_NOTE[0], lLegal = K.kitLegal(), lFill = fill(0);
      // a card with rounds and no rifle written from code (no load to fit it): only MORE rounds are refused — every other row still steps, the rounds too, down
      KIT.members[0] = { ...K.kitDefault(0), weapon: 'pistol' }; const other = K.kitTry(0, 'frags', -1).ok, suitOk = K.kitSet(0, 'suit', 'black') && !K.kitTry(0, 'shells', 1).ok && K.kitTry(0, 'shells', -1).ok;
      const bad = K.kitLegal([{ ...K.kitDefault(0), weapon: 'shotgun', smoke: 3 }, ...[1, 2, 3, 4].map(i => K.kitDefault(i))]);
      // the rule off: the free row of the build before it keeps its count whatever the gun
      // (a card of your own for this line — two rounds: the rule's as-issued one of each, read with the rule off, is the as-built card: the check further down)
      K.kitLoad(memStore(JSON.stringify({ v: 2, members: [{ ...K.kitDefault(0), weapon: 'pistol', shells: 2 }, null, null, null, null] })), '?noslots'); const off = M()[0].shells, offStep = (K.kitTry(0, 'weapon', 1), M()[0].shells), offNote = K.kitRows(0).find((r: any) => r.field === 'shells').note(M()[0]);
      K.kitLoad(null, ''); K.kitReset(); under(T0);
      F.verdict(start === '4/4' && gone.ok && gone.value === 'pistol' && s0 === 0 && c0 === '3/4' && /none carried/.test(note) && !more.ok && /no FN2000, no launcher to fire them: take the rifle first/.test(more.why) && !down.ok && !set && kept === 0
        && gun.ok && gun.value === 'shotgun' && s1 === 0 && back && s2 === 0 && c2 === '3/4' && again[0].ok && !again[1].ok && c3 === '4/4'
        && l.weapon === 'pistol' && l.shells === 0 && lNote === 'No FN2000 in your saved kit: 1 launcher grenade left behind.' && other && suitOk && lLegal === null && lFill === '3/4' && /launcher grenades and no FN2000/.test(bad ?? '')
        && off === 2 && offStep === 2 && offNote === 'no FN2000, no launcher: these stay home',
        'the launcher\'s rounds go home with the rifle: swap the FN2000 away and the 40 mm row comes to none and its pouches are free (kept so in the store); with no rifle the row is refused a round, by the arrows either way and set outright, with the reason (and only that: a card written from code with rounds and no rifle still steps its other rows, and its rounds down); the rifle back, the row is still none and the pouch is his to fill again (one fits, a second is refused); a saved kit with rounds beside a pistol leaves them behind on load and says so; five cards with rounds and no rifle are no legal squad; with the rule off the free row keeps its count whatever the gun',
        `as issued ${start} → ${gone.value}: ${s0} rounds, ${c0}, '${note}' · +1: '${more.why}' · ‹ off none: '${down.why}' · rifle back: ${s2} rounds ${c2} → ${c3} · saved pistol + 1: ${l.shells} rounds, '${lNote}' · five cards: '${bad}' · ?noslots, a pistol card with 2: ${off} rounds kept, note '${offNote}'`); }
    { // kitLoadout: all five cards at once from the table, by name (the tallies' way in)
      const a = K.kitLoadout('shotgun'), m1 = { ...M()[1] }, m2 = { ...M()[2] }, f = fills(), pool = K.kitPool(4), legal = K.kitLegal(); under(T0);
      const was = snap(), wall = K.kitLoadout('wall'), afterWall = snap(), wallOk = K.wallHere() ? wall === null && M()[1].walls === 1 : /wallCharge, which this build has no row for/.test(wall ?? '') && afterWall === was, none = K.kitLoadout('heavy'), same = snap() === afterWall, q = K.kitLoadout('quiet'), q0 = { ...M()[0] }, q1 = { ...M()[1] }; under(T0);
      F.verdict(a === null && legal === null && m1.weapon === 'pistol' && m1.bangs === 3 && m1.charges === 0 && m1.frags === 1 && m2.weapon === 'shotgun' && m2.bangs === 1 && m2.frags === 1 && m2.charges === 0 && f === '4/4 4/4 3/4 0/4 0/4 · squad 7/7' && pool.bangs === 4 && pool.charges === 0 && pool.frags === 2
        && wallOk && /no loadout "heavy"/.test(none ?? '') && same && q === null && q0.weapon === 'pistol' && q0.smoke === 3 && q0.bangs === 0 && q0.shells === 0 && q1.weapon === 'pistol' && q1.suppressed === true && q1.light === false && q1.charges === 0,
        'a named loadout of the table goes on all five cards at once — its counts, and the rows it names (the pistol on Red One, the shotgun on Red Two, your pistol on the quiet one: read as the store reads a card) — and kitPool carries it; one that needs a tool this build has no row for (the wall charge, in a build whose wall charge takes no count from the cards) is refused by name with nothing written, as is a name the table does not have',
        `shotgun: ${f} · Red One ${m1.weapon} ${m1.bangs} stun · Red Two ${m2.weapon} ${m2.bangs} stun ${m2.frags} frag · kitPool(4) ${JSON.stringify(pool)} · wall: '${wall}' · heavy: '${none}'`); }
    { // a saved kit outside the rule
      const over = { v: 2, members: [{ ...K.kitDefault(0), smoke: 6, bangs: 4, frags: 3, shells: 4, suit: 'navy' }, { ...K.kitDefault(1), bangs: 3, charges: 2, frags: 2, weapon: 'pistol' }, { ...K.kitDefault(2), bangs: 0, charges: 0, frags: 0 }, { ...K.kitDefault(3), bangs: 3, charges: 1 }, K.kitDefault(4)] }, raw = JSON.stringify(over);
      const st = memStore(raw); K.kitLoad(st, ''); const m = M().map((x: any) => ({ ...x })), notes = [...KIT_NOTE], untouched = st.m.get(KIT_LS) === raw, legal = K.kitLegal(), f = fills();
      const atLeast = (i: number) => (['smoke', 'bangs', 'frags', 'shells', 'charges'] as const).every(k => m[i][k] >= Math.min((over.members[i] as any)[k], (K.kitDefault(i) as any)[k]) && m[i][k] <= (over.members[i] as any)[k]);
      K.kitTry(1, 'suit', 1); const noteGone = KIT_NOTE[1] === '' && KIT_NOTE[0] !== '', rewritten = st.m.get(KIT_LS) !== raw && K.kitLegal() === null;
      K.kitLoad(memStore(raw), '?noslots'); const freeBack = JSON.stringify(KIT.members) === JSON.stringify(over.members), freeNotes = KIT_NOTE.every((n: string) => n === '');
      // a legal trade saved comes back as saved, with nothing to say
      under(T0); const st3 = memStore(); K.kitLoad(st3, ''); K.kitReset(); K.kitTry(1, 'frags', -1); K.kitTry(3, 'bangs', 1); const traded = snap(); K.kitLoad(memStore(st3.m.get(KIT_LS)), ''); const kept = snap() === traded && KIT_NOTE.every((n: string) => n === '');
      F.verdict(legal === null && [0, 1, 2, 3, 4].every(atLeast) && m[0].suit === 'navy' && m[1].weapon === 'pistol' && m[2].bangs === 0 && m[2].frags === 0 && m[3].bangs === 3 && m[3].charges === 0 && f === '4/4 4/4 0/4 3/4 0/4 · squad 7/7' && m[0].smoke === 1 && m[0].bangs === 1 && m[0].frags === 1 && m[0].shells === 1
        && /left behind/.test(notes[0]) && /1 frag, 1 door charge/.test(notes[1]) && /1 stun canister/.test(notes[1]) && !notes[2] && /^Your saved kit was over the pouches: 1 door charge left behind\.$/.test(notes[3]) && !notes[4] && untouched && noteGone && rewritten && freeBack && freeNotes && kept,
        'a saved kit outside the rule is brought back inside it on load: a man over his own pouches gives up only what his card added over the issued kit (nothing issued is taken, nothing a card dropped is put back, his other rows are kept); then, the teammates still over the squad\'s seven, the LAST man who added something gives one up (Blue One his door charge, keeping three stun); each card says what was left behind; the store is not rewritten until a row is next changed — the same store read with the rule off is the free kit as saved — and a legal trade saved comes back as saved',
        `${f} · you ${m[0].smoke} smoke ${m[0].bangs} stun ${m[0].frags} frag ${m[0].shells} shells '${notes[0]}' · Red One ${m[1].bangs}/${m[1].charges}/${m[1].frags} '${notes[1]}' · Blue One ${m[3].bangs} stun ${m[3].charges} charges '${notes[3]}' · store untouched by the load ${untouched}, legal after a change ${rewritten} · ?noslots: as saved ${freeBack}`);
      // the build before's store: your canisters as a named split (no smoke count; its bangs meant nothing)
      under(T0);
      const old = (cans: string) => JSON.stringify({ v: 1, members: [{ weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 0, charges: 0, cans, frags: 2, shells: 3, suit: 'issued', trim: 'issued' }, null, null, null, null] });
      // (six cans were a legal fill of your eleven pouches; of your four they are not, so under the rule the split is read and then brought inside them — what
      // was left behind says how it was read — and with the rule off it is the split itself)
      K.kitLoad(memStore(old('stun')), ''); const o = { ...M()[0] }, oLegal = K.kitLegal(), oNote = KIT_NOTE[0]; K.kitLoad(memStore(old('even')), ''); const eNote = KIT_NOTE[0]; K.kitLoad(memStore(old('issued')), ''); const o2 = !K.kitChanged(0); K.kitLoad(memStore(old('constructor')), ''); const o3 = !K.kitChanged(0);
      K.kitLoad(memStore(old('stun')), '?noslots'); const offRow = K.rowGet(K.kitRows(0).find((r: any) => r.field === 'cans'), M()[0]), offCard = { ...M()[0] }; K.kitLoad(memStore(old('even')), '?noslots'); const e = { ...M()[0] };
      const st1 = memStore(); K.kitLoad(st1, ''); K.kitReset(); const kept1 = st1.m.get(KIT_LS), setOn = K.kitSet(0, 'cans', 'stun'), unwritten = st1.m.get(KIT_LS) === kept1;
      const st2 = memStore(); K.kitLoad(st2, '?noslots'); const setOk = K.kitSet(0, 'cans', 'stun'), w = JSON.parse(st2.m.get(KIT_LS)!);
      F.verdict(o.smoke === 1 && o.bangs === 1 && oLegal === null && /1 smoke canister, 3 stun canisters/.test(oNote) && /2 smoke canisters, 2 stun canisters/.test(eNote) && offCard.smoke === 2 && offCard.bangs === 4 && e.smoke === 3 && e.bangs === 3 && o2 && o3 && offRow === 'stun' && !setOn && unwritten && setOk && w.v === 2 && w.members[0].cans === 'stun' && w.members[0].smoke === 2 && w.members[0].bangs === 4,
        'a store from the build before the rule (your canisters a named split of six, a stun count of 0 that meant nothing) is read as that split, not as no stun: with the rule off it is that split, and under the rule — six cans are over your four pouches — it comes back inside them and the card says what of the split was left behind; a name that is no split is the issued one; a split by name is refused under the rule with nothing written, and what the rule-off build writes still names the split',
        `'stun' under the rule → ${o.smoke} smoke ${o.bangs} stun, '${oNote}' · 'even': '${eNote}' · rule off: 'stun' → ${offCard.smoke}/${offCard.bangs}, 'even' → ${e.smoke}/${e.bangs}, the Cans row reads '${offRow}' · 'issued' → as issued ${o2} · 'constructor' → as issued ${o3} · 'cans' set under the rule: ${setOn} · written with it off: v ${w.v}, cans '${w.members[0].cans}', ${w.members[0].smoke}/${w.members[0].bangs}`);
      under(T0); }
    { // YOUR COUNT OVER ITS ROW'S TOP IS CLAMPED, NOT DROPPED: the all-smoke card of the build before you were cut to four pouches (its row went to six)
      under(T0); const four = () => `${M()[0].smoke}/${M()[0].bangs}/${M()[0].frags}/${M()[0].shells}`, cansRow = () => K.rowGet([...K.kitRows(0)].find((r: any) => r.field === 'cans'), M()[0]);
      const mine = (c: Record<string, unknown>) => JSON.stringify({ v: 2, members: [{ ...K.kitDefault(0), ...c }, { ...K.kitDefault(1), bangs: 99 }, null, null, null] });
      const raw = mine({ smoke: 6, bangs: 0, frags: 2, shells: 3 }); K.kitLoad(memStore(raw), ''); const on = four(), note = KIT_NOTE[0], legal = K.kitLegal(), mate = M()[1].bangs === K.kitDefault(1).bangs;
      K.kitLoad(memStore(raw), '?noslots'); const off = four(), row = cansRow();
      K.kitLoad(memStore(mine({ smoke: 99, bangs: 0, frags: 7, shells: -2 })), '?noslots'); const wild = four();
      F.verdict(on === '1/0/2/1' && note === 'Your saved kit was over the pouches: 5 smoke canisters, 2 launcher grenades left behind.' && legal === null && mate && off === '6/0/2/3' && row === 'smoke' && wild === '6/0/3/3',
        'a stored count of YOURS above its row\'s top is clamped, not dropped to the issued one: the old all-smoke card (6 smoke, no stun, 2 frags, 3 rounds) read under the rule goes through the fit like any kit over the pouches — no stun put back, nothing issued taken — and the card names every can left behind, the five smoke among them; read with the rule off it is that card (the Cans row on \'6 smoke, no stun\'); a count past anything a row ever held is the row\'s most, a negative one still the issued one, and a teammate\'s count over his row is still junk',
        `6/0/2/3 under the rule → ${on}, '${note}' · rule off → ${off}, Cans '${row}' · 99 smoke, 7 frags, −2 rounds with the rule off → ${wild} · Red One's 99 stun as issued: ${mate}`);
      // AS ISSUED THE OTHER WAY THE RULE STANDS IS AS ISSUED (kitSave writes all five cards on any change, and what you are issued follows the switch)
      K.kitLoad(null, '?noslots'); K.kitReset(); const built = K.kitDefault(0); under(T0);
      K.kitLoad(memStore(JSON.stringify({ v: 2, members: [{ ...built, cans: 'issued' }, { ...K.kitDefault(1), suit: 'navy' }, null, null, null] })), ''); const a = four(), aNote = KIT_NOTE[0], aSame = !K.kitChanged(0) && M()[1].suit === 'navy' && K.kitLegal() === null;
      K.kitLoad(memStore(JSON.stringify({ v: 1, members: [{ weapon: 'rifle', suppressed: true, light: true, nvg: true, bangs: 0, charges: 0, cans: 'issued', frags: 2, shells: 3, suit: 'issued', trim: 'issued' }, null, null, null, null] })), ''); const o = four(), oNote = KIT_NOTE[0];
      const st = memStore(); K.kitLoad(st, ''); K.kitReset(); const wrote = K.kitSet(1, 'suit', 'navy'), kept = st.m.get(KIT_LS)!; K.kitLoad(memStore(kept), '?noslots'); const b = four(), bSame = !K.kitChanged(0) && M()[1].suit === 'navy', bRow = cansRow();
      // … and a card you really changed loads as you left it, either way
      const st2 = memStore(); K.kitLoad(st2, ''); K.kitReset(); const less = K.kitTry(0, 'smoke', -1).ok, kept2 = st2.m.get(KIT_LS)!; K.kitLoad(memStore(kept2), ''); const c1 = four(), cNote = KIT_NOTE[0]; K.kitLoad(memStore(kept2), '?noslots'); const c2 = four(), cOwn = K.kitChanged(0);
      F.verdict(a === '1/1/1/1' && aNote === '' && aSame && o === '1/1/1/1' && oNote === '' && wrote && b === '4/2/2/3' && bSame && bRow === 'issued' && less && c1 === '0/1/1/1' && cNote === '' && c2 === '0/1/1/1' && cOwn,
        'a card of yours nobody touched stays as issued across the switch: the as-built 4 smoke, 2 stun, 2 frags, 3 rounds a store holds (written whole when a TEAMMATE\'s row changed, by the build before your four pouches or with the rule off; or that build\'s named split) is read under the rule as the one of each you are issued, with no line about a kit over the pouches; the rule\'s one of each read with the rule off is the as-built card, not a split of your own; a card you did change (no smoke) comes back as you left it either way',
        `as-built card under the rule → ${a}, note '${aNote}' · the older store's 'issued' split → ${o}, note '${oNote}' · the rule's card (Red One's suit changed) with the rule off → ${b}, Cans '${bRow}', changed ${!bSame} · your own 0/1/1/1 → ${c1} under the rule, ${c2} with it off`);
      // the switch thrown by hand on a pistol card (the harness, the knobs put back): the launcher's rounds go home, as on a load
      K.kitLoad(null, '?noslots'); K.kitReset(); const pistol = K.kitSet(0, 'weapon', 'pistol'); SLOTS.on = true; const p = four(), pLegal = K.kitLegal(), pGun = M()[0].weapon;
      F.verdict(pistol && p === '1/1/1/0' && pLegal === null && pGun === 'pistol', 'the pouches rule switched ON by hand over a pistol card as issued: the card carried across is a legal one — one of each and no launcher round beside no rifle', `${pGun} ${p} · ${pLegal ?? 'legal'}`);
      under(T0); }
    { // a table that would break the issued kit or a set is refused whole; odd tables are refused with a reason; a tool this build has no row for is carried
      const was = JSON.stringify(SLOTS.table), mem = (n: number) => [{ i: 0, kind: 'you', pouches: n }, ...mates(4)];
      const tight = K.slotsSet({ ...T0, members: mem(3) }), squadTight = K.slotsSet({ ...T0, squad: { pouches: 6 } }), low = K.slotsSet({ ...T0, tools: tool('stun', { maxPerMan: { you: 4, mate: 1 } }) }), unpriced = K.slotsSet({ ...T0, tools: T0.tools.filter(t => t.id !== 'frag') });
      const badSet = K.slotsSet({ ...T0, loadouts: [{ id: 'stun', members: [{ smoke: 1, stun: 2, shell40: 1 }, { stun: 3, doorCharge: 1, frag: 1 }, { stun: 3 }, {}, {}] }] });
      const otherKit = K.slotsSet({ ...T0, issued: { members: [{ smoke: 1, stun: 1, frag: 1, shell40: 1 }, { stun: 2, doorCharge: 2, frag: 1 }, { stun: 1, doorCharge: 1, frag: 1 }, {}, {}] } }), sameKit = K.slotsSet({ ...T0, issued: { members: [{ smoke: 1, stun: 1, frag: 1, shell40: 1 }, { stun: 2, doorCharge: 1, frag: 1 }, { stun: 1, doorCharge: 1, frag: 1 }, {}, {}] } });
      const junk = [K.slotsSet(null), K.slotsSet({ v: 4, members: [{ i: 0, pouches: 4 }], tools: [] }), K.slotsSet({ ...T0, tools: tool('frag', { pouches: 1.5 }) }), K.slotsSet({ ...T0, squad: { pouches: 'seven' } })];
      const same = JSON.stringify(SLOTS.table) === was;
      const more = K.slotsSet({ ...T0, members: [{ i: 0, kind: 'you', pouches: 12 }, ...mates(5)], squad: { pouches: null }, tools: [...tool('shell40', { maxPerMan: { you: 9 } }), { id: 'ladder', pouches: 2, who: ['mate'], maxPerMan: { mate: 1 }, inBuild: true }] });
      const unknown = K.slotsUnknown(), roomy = [K.kitTry(3, 'bangs', 1), K.kitTry(3, 'bangs', 1), K.kitTry(3, 'bangs', 1)], noSquad = K.squadCost(), shellsMost = K.kitRows(0).find((r: any) => r.field === 'shells').values.slice(-1)[0], fifth = K.kitTry(0, 'shells', 1);
      F.verdict(/member 0 needs 4 pouches and has 3: the issued kit/.test(tight ?? '') && /teammates together need 7 pouches and the squad has 6: the issued kit/.test(squadTight ?? '') && /issued kit/.test(low ?? '') && /does not price frag/.test(unpriced ?? '') && /the loud set \(loadout "stun"\) is not a legal fill/.test(badSet ?? '') && junk.every(j => typeof j === 'string' && j.length > 0) && /"issued" gives member 1 2 of "doorCharge" and this build issues him 1/.test(otherKit ?? '') && sameKit === null && same
        && more === null && roomy.every(x => x.ok) && noSquad === null && K.kitCost(3).total === 5 && unknown.includes('ladder') && unknown.includes('wallCharge') === !K.wallHere() && shellsMost === 4 && fifth.ok && fifth.value === 2,
        'a table that breaks the issued kit (a pouch too few for a man, or for the squad; a most under what is issued), that leaves a tool of this build unpriced, or whose loadout makes a set illegal or whose own account of the issued kit is not this build\'s, is refused whole with the reason and the one in force stands, as is a malformed one; a legal one is taken and the budgets follow (no squad limit: each man\'s own only); a tool priced that this build has no row for is carried and named, priced for nobody; and a most above what a row can deliver is read as the row\'s own',
        `a pouch too few: '${tight}' · squad too few: '${squadTight}' · most under issued: '${low}' · unpriced: '${unpriced}' · illegal set: '${String(badSet).slice(0, 96)}…' · another build's issued kit: '${otherKit}' · malformed: ${junk.map(j => `'${String(j).slice(0, 44)}'`).join(' ')} · roomier table, no squad limit: Blue One stun ${roomy[2].value} (${fill(3)}) · no row here: ${unknown.join(', ') || 'none'} · shells row ends at ${shellsMost} under a most of 9`);
      under(T0); }

    // ── the switch off: the rows of the build before the rule
    { K.kitLoad(null, '?noslots'); K.kitReset();
      const fx = JSON.parse(readFileSync(resolve(ROOT, 'tools/qa/fixtures/kit-rows-base.json'), 'utf8'));
      const now = { members: [] as any[], pool: [0, 1, 2, 3, 4].map(n => K.kitPool(n)) };
      for (let i = 0; i < KIT_MEMBERS; i++) now.members.push({ rows: K.kitRows(i).map((r: any) => ({ field: r.field, label: r.label, values: r.values, words: r.values.map((v: any) => r.word(v)), note: r.note(KIT.members[i]) })),
        sets: KIT_PRESETS.map((p: any) => { K.kitPreset(i, p.id); const w = K.kitWords(i), rows = K.kitRows(i).map((r: any) => K.rowGet(r, KIT.members[i])); K.kitPreset(i, 'issued'); return { id: p.id, words: w, rows }; }) });
      // (that build's teammate had one more row, a thing taken out of the game since — 10-18 — so it is taken out of the FIXTURE's side before the comparison:
      // its row and its value in each set, which must be false. The file stays that build's run word for word.)
      let goneFree = true; for (let i = 1; i < KIT_MEMBERS; i++) { const m = fx.members[i], k = m.rows.findIndex((r: any) => r.field === 'shield'); if (k < 0) { goneFree = false; continue; } m.rows.splice(k, 1); for (const st of m.sets) goneFree &&= st.rows.splice(k, 1)[0] === false; }
      // (a teammate's Smoke canisters row came after that build — squadsmoke.ts, none as issued — so it is taken out of this side before the comparison: its
      // row and its value in each set, which must be 0)
      let smokeFree = true; for (let i = 1; i < KIT_MEMBERS; i++) { const m = now.members[i], k = m.rows.findIndex((r: any) => r.field === 'smoke'); if (k < 0) { smokeFree = false; continue; } m.rows.splice(k, 1); for (const st of m.sets) smokeFree &&= st.rows.splice(k, 1)[0] === 0; }
      const eq = smokeFree && goneFree && JSON.stringify(now.members) === JSON.stringify(fx.members) && JSON.stringify(now.pool) === JSON.stringify(fx.pool);
      let refused = 0, stepsOff = 0; for (let i = 0; i < KIT_MEMBERS; i++) for (const r of K.kitRows(i)) for (let n = 0; n < r.values.length; n++) { stepsOff++; if (!K.kitTry(i, r.field, 1).ok) refused++; }
      const three = K.kitSet(1, 'bangs', 3) && K.kitSet(1, 'charges', 2) && K.kitSet(1, 'frags', 2) && K.kitSet(1, 'smoke', 2) && K.kitSet(1, 'weapon', 'shotgun'), loudAll = [1, 2, 3, 4].every(i => K.kitPreset(i, 'loud').ok), pool = K.kitPool(4);
      F.verdict(!SLOTS.on && eq && refused === 0 && three && loudAll && K.squadCost() === null && pool.bangs === DOORTOOLS.bangs + 4 && pool.charges === DOORTOOLS.charges,
        'the switch off (?noslots): every card\'s rows — fields, labels, values, words, notes — its three sets and the squad counts are the build before the rule\'s exactly (the fixture written from that build by tools/qa/kit-rows-fixture.ts; the one row of a teammate\'s card that is out of the game since, off in every set there, left out of its side; a teammate\'s Smoke canisters row, added since and none in every set, left out of the comparison), no step of any row is refused, a man may carry the most of everything, and the loud set is one more stun canister on every man again', `${fx.from} · ${now.members.map((m: any) => m.rows.length).join(' ')} rows · ${stepsOff} steps, ${refused} refused · loud on all four: kitPool(4) ${JSON.stringify(pool)}`);
      const flags = pickSearch(SCENARIOS.find((e: any) => e.id === 'room-clear-four'), '?noslots&quality=low'), quit = quitSearch(flags);
      F.verdict(new URLSearchParams(flags).has('noslots') && new URLSearchParams(quit).has('noslots'), 'the switch is the visitor\'s own flag: it rides a Deploy and a Quit like quality does', `pick '${flags}' · quit '${quit}'`); }
  } finally { shipped(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the card and the screen ─────────────────
export async function pouchCard(): Promise<boolean> {
  const F = family('pouch-card: pouches on the member card and the loadout screen (fake DOM)');
  try {
    under(T0);
    const { memberCard } = await import(`${ROOT}/src/ui/kitCard.ts`);
    type Deck = { hosts: El[]; cards: any[]; changes: () => number; rowOf: (i: number, f: string) => El; note: (i: number, f: string) => string; val: (i: number, f: string) => string; arrows: (i: number, f: string) => El[]; meter: (i: number) => { off: boolean; n: number; lit: number; words: string; squad: string }; refresh: () => void };
    const deck = (root: El): Deck => {
      const hosts = Array.from({ length: KIT_MEMBERS }, () => { const h = new El('DIV'); root.appendChild(h); return h; }); let n = 0;
      const cards: any[] = []; for (let i = 0; i < KIT_MEMBERS; i++) cards.push(memberCard(hosts[i] as unknown as HTMLElement, i, { onChange: () => { n++; for (const c of cards) c.refresh(); } }));   // (as the kit page does: one card's change redraws them all)
      const rowOf = (i: number, f: string) => byCls(hosts[i], 'kc-row').find(r => r.attrs['data-field'] === f)!;
      return { hosts, cards, changes: () => n, rowOf, note: (i, f) => text(byCls(rowOf(i, f), 'kc-note')[0]), val: (i, f) => text(byCls(rowOf(i, f), 'kc-val')[0]), arrows: (i, f) => byCls(rowOf(i, f), 'kc-step'),
        meter: i => { const p = byCls(hosts[i], 'kc-pouch')[0], pips = byCls(p, 'kc-pips')[0].children as El[]; return { off: p.cls.has('off'), n: pips.length, lit: pips.filter(x => x.cls.has('on')).length, words: text(p), squad: text(byCls(p, 'kc-squad')[0]) }; },
        refresh: () => { for (const c of cards) c.refresh(); } };
    };
    await withDom('', async root => {
      const D = deck(root), mt = D.hosts.map((_h, i) => D.meter(i));
      F.verdict(mt.every((m, i) => !m.off && m.n === K.kitCost(i).total && m.lit === K.kitCost(i).used && m.words.startsWith(`Pouches${K.kitCost(i).used} / ${K.kitCost(i).total}`) && m.squad === (i ? 'squad 7 / 7' : '')) && mt[0].lit === 4 && mt[0].n === mt[1].n && mt[1].lit === 4 && mt[2].lit === 3 && mt[3].lit === 0,
        'each card\'s head shows the man\'s pouches — a pip each, the full ones lit, and used of total in figures — and a teammate\'s the squad\'s beside them; yours has no squad line (your four — as many as a teammate has — are your own)', mt.map((m, i) => `${K.kitName(i).title}: ${m.lit} of ${m.n} lit, '${m.words}'`).join(' · '));
      const cost = (i: number, f: string) => text(byCls(D.rowOf(i, f), 'kc-cost')[0] ?? new El('I')), costs = ([[0, 'smoke'], [0, 'bangs'], [0, 'frags'], [0, 'shells'], [1, 'bangs'], [1, 'charges'], [1, 'frags'], [1, 'walls'], [1, 'weapon'], [3, 'bangs']] as [number, string][]).map(([i, f]) => `${i}.${f}: '${cost(i, f)}'`);
      const plain = ['suppressed', 'light', 'nvg', 'suit', 'trim'].every(f => byCls(D.rowOf(1, f), 'kc-cost').length === 0);
      F.verdict(cost(0, 'smoke') === '1 pouch · a pouch each' && cost(0, 'shells') === '1 pouch · a pouch each' && cost(1, 'bangs') === '2 pouches · a pouch each' && cost(1, 'charges') === '1 pouch · a pouch each' && cost(3, 'bangs') === 'a pouch each' && cost(1, 'walls') === '2 pouches each' && cost(1, 'weapon') === 'the shotgun\'s shells take a pouch' && plain && /^1 pouch · a pouch each · /.test(D.note(1, 'charges')),
        'every row that spends pouches says what it costs in plain words ahead of its note — its rate, and for a counted row with some carried how many pouches they fill; a row that spends none (the suppressor, a light, goggles, colours) says nothing of pouches', costs.join(' · '));
      const sqLit = [0, 1, 2, 3, 4].map(i => !!byCls(byCls(D.hosts[i], 'kc-pouch')[0], 'kc-squad')[0]?.cls.has('full')), narrow = (i: number, f: string) => byCls(D.rowOf(i, f), 'kc-val')[0].cls.has('num');
      F.verdict(sqLit.join() === 'false,false,true,true,true' && narrow(1, 'bangs') && narrow(1, 'charges') && narrow(0, 'smoke') && narrow(0, 'shells') && !narrow(1, 'weapon') && !narrow(1, 'suit') && !narrow(0, 'weapon'),
        'the squad\'s count is lit on a card whose own pouches have room while the squad\'s are full — Red Two, Blue One and Blue Two as issued; not Red One, whose own four are full, nor yours — and a count row\'s value box is the narrow one (its long label then leaves both arrows inside the card) while a row of choices keeps the wide one', `lit ${sqLit.join()}`);
      // the mouse: Red One's stun › is refused by his own pouches
      const st = () => D.arrows(1, 'bangs'), dim0 = st()[1].cls.has('off'), tip = st()[1].title, was = snap(), ch0 = D.changes();
      // (pressed AS A BROWSER DELIVERS IT: the arrow's handler, then every ancestor's unless the arrow stopped it — the row under the arrow listens for clicks too)
      const press = (e: any) => { const ev = { stopped: false, stopPropagation() { this.stopped = true; } }; for (let n = e; n && !ev.stopped; n = n.parentElement) n.onclick?.(ev); };
      press(st()[1]); const said = D.note(1, 'bangs'), flagged = D.rowOf(1, 'bangs').cls.has('refused');
      F.verdict(dim0 && /pouch/.test(tip) && snap() === was && D.changes() === ch0 && D.val(1, 'bangs') === '2' && flagged && said === tip && /give something up first/.test(said) && !st()[0].cls.has('off'),
        'the mouse: the arrow of a step that would not fit is dimmed and its tip says why; pressed, nothing changes and the row itself says why in place of its note', `› dimmed ${dim0} · row now '${said}' · value ${D.val(1, 'bangs')} · ${D.changes() - ch0} change calls`);
      // the trade across two cards, by mouse: Blue One's stun › is the squad's to refuse; Red One's frag ‹ frees a pouch of the squad's; Blue One takes it
      const blueTip = D.arrows(3, 'bangs')[1].title, blueDim = D.arrows(3, 'bangs')[1].cls.has('off');
      D.arrows(1, 'frags')[0].onclick?.(); const cleared = !D.rowOf(1, 'bangs').cls.has('refused'), m1 = D.meter(1), blueOpen = !D.arrows(3, 'bangs')[1].cls.has('off'), blueSq = D.meter(3).squad;
      D.arrows(3, 'bangs')[1].onclick?.(); const m3 = D.meter(3), redShut = D.arrows(1, 'frags')[1].cls.has('off'), redTip = D.arrows(1, 'frags')[1].title, redOwn = D.meter(1);
      F.verdict(blueDim && /take something off a teammate first/.test(blueTip) && cleared && m1.lit === 3 && m1.squad === 'squad 6 / 7' && blueOpen && blueSq === 'squad 6 / 7' && D.val(3, 'bangs') === '1' && m3.lit === 1 && m3.squad === 'squad 7 / 7' && redShut && /the squad has none free/.test(redTip) && redOwn.lit === 3 && redOwn.squad === 'squad 7 / 7',
        'the trade across two cards (each card redrawn on a change, as the kit page wires them): Blue One, his own pouches empty, has his stun arrow dimmed by the squad\'s; Red One\'s frag given up puts a pip out and the squad to 6 / 7 on every teammate\'s card, Blue One\'s arrow opens, his stun canister takes the pouch, and now it is Red One\'s frag arrow that is dimmed, by the squad', `Blue One › tip '${blueTip}' · after Red One ‹ frag: his ${m1.lit} lit, ${m1.squad} · Blue One stun '${D.val(3, 'bangs')}', ${m3.squad} · Red One frag › tip '${redTip}'`);
      // the keys: on your card, S to the smoke row, D is refused; a held key and a digit do nothing; A A then S D D goes through
      const c0 = D.cards[0]; c0.focus(); const smokeAt = K.kitRows(0).findIndex((r: any) => r.field === 'smoke'); for (let n = 0; n < smokeAt; n++) c0.key(keyEv('s'));
      const before = snap(); c0.key(keyEv('d')); const kSaid = D.note(0, 'smoke'), kSame = snap() === before; c0.key(keyEv('s')); const moved = !D.rowOf(0, 'smoke').cls.has('refused'); c0.key(keyEv('w'));
      c0.key({ ...keyEv('a'), repeat: true }); const held = snap() === before; const digit = c0.key({ ...keyEv('3'), code: 'Digit3' }), digitSame = snap() === before && digit === false;
      c0.key(keyEv('a')); const s0 = M()[0].smoke, m0 = D.meter(0); c0.key(keyEv('s')); c0.key(keyEv('d')); const b2 = M()[0].bangs, m0b = D.meter(0);
      F.verdict(c0.at() === smokeAt + 1 && kSame && /none free \(4 of 4 full\)/.test(kSaid) && moved && held && digitSame && s0 === 0 && m0.lit === 3 && b2 === 2 && m0b.lit === 4 && D.val(0, 'bangs') === '2',
        'the keys alone: D on your smoke row as issued is refused and says why; moving off the row clears it; a key held down (a repeat) and a digit change nothing; A gives up your pouch of smoke, S D spends it on stun', `D: '${kSaid}' · smoke ${s0} (${m0.words}) · stun ${b2} (${m0b.words})`);
      for (const c of D.cards) c.destroy();
    });
    // a set the squad has no room for, and a choice walked past
    under(T0);
    await withDom('', async root => {
      const D = deck(root), setBtn = (i: number, id: string) => byCls(D.hosts[i], 'kc-set').find(b => b.attrs['data-set'] === id)!, wordsOf = (i: number) => byCls(D.hosts[i], 'kc-words')[0];
      D.arrows(2, 'weapon')[1].onclick?.(); const first = D.note(2, 'weapon'); D.arrows(2, 'weapon')[1].onclick?.(); const passed = D.note(2, 'weapon'), gun = M()[2].weapon, mark = D.rowOf(2, 'weapon').cls.has('refused');
      setBtn(2, 'quiet').onclick?.(); const afterQuiet = D.meter(2).squad; D.arrows(3, 'bangs')[1].onclick?.(); D.arrows(3, 'bangs')[1].onclick?.();
      const b = setBtn(2, 'issued'), dim = b.cls.has('off'), tip = b.title, was = snap(); b.onclick?.(); const w = text(wordsOf(2)), flagged = wordsOf(2).cls.has('refused'), same = snap() === was, quietLit = setBtn(2, 'quiet').cls.has('on');
      D.arrows(2, 'suit')[1].onclick?.(); const gone = !wordsOf(2).cls.has('refused');
      F.verdict(!/passed/.test(first) && /^passed shotgun: needs a pouch, the squad has none free/.test(passed) && gun === 'rifle' && mark && afterQuiet === 'squad 5 / 7' && dim && /needs 2 pouches, the squad has none free/.test(tip) && same && flagged && w === `As issued: ${tip}` && quietLit && gone,
        'a row of choices that walked past one with no room says which and why on the row (Red Two\'s weapon: pistol, then back to the rifle past the shotgun); a set the squad has no room for (Red Two back to as issued once Blue One holds the two pouches his quiet set gave up) is dimmed with the reason as its tip and, pressed, says so under the rows and changes nothing; the next change clears it',
        `weapon › › : '${passed}' · quiet on Red Two: ${afterQuiet} · As issued dimmed ${dim} · pressed: '${w}'`);
      for (const c of D.cards) c.destroy();
    });
    // a sanitized save says so on the card, until the next change
    await withDom('', async root => {
      K.kitLoad(memStore(JSON.stringify({ v: 2, members: [null, { ...K.kitDefault(1), bangs: 3, charges: 2, frags: 2 }, null, null, null] })), '');
      const h = new El('DIV'); root.appendChild(h); const c = memberCard(h as unknown as HTMLElement, 1, {}), w0 = text(byCls(h, 'kc-words')[0]);
      byCls(byCls(h, 'kc-row').find(r => r.attrs['data-field'] === 'suit')!, 'kc-step')[1].onclick?.(); const w1 = text(byCls(h, 'kc-words')[0]); c.destroy();
      F.verdict(/Your saved kit was over the pouches: 1 stun canister, 1 frag, 1 door charge left behind\./.test(w0) && !/left behind/.test(w1), 'a saved kit brought inside the pouches on load says so under the card\'s rows, until the card is next changed', `'${w0}' → '${w1}'`);
    });
    // the loadout screen: each man who comes shows his pouches, the squad's beside the count line; the count line is as it was
    under(T0);
    { const UI = await import(`${ROOT}/src/ui/loadout.ts`), E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-four');
      const shot = async (search: string) => withDom(search, async () => { const host = new El('BODY') as any, S = UI.openLoadout(E, { host, deploy: () => {} }); const one = (c: string) => host.all((x: El) => x.cls.has(c))[0] as El | undefined;
        const p = host.all((x: El) => x.cls.has('lo-pouch')).map((x: El) => text(x)), pool = text(one('lo-pool')!), squad = text(one('lo-squadp') ?? new El('I')), foot = text(one('lo-foot')!), meterOff = one('kc-pouch')?.cls.has('off'), fields = host.all((x: El) => x.cls.has('kc-row')).map((x: El) => x.attrs['data-field']), costs = host.all((x: El) => x.cls.has('kc-cost')).length; S.back(); return { p, pool, squad, foot, meterOff, fields, costs }; });
      const on = await shot('');
      // … and driven: a pair's cards cut on the screen, the size stepped up to four and back
      const live = await withDom('', async () => { const host = new El('BODY') as any, S = UI.openLoadout(E, { host, deploy: () => {}, squad: 2 }); const one = (c: string) => text((host.all((x: El) => x.cls.has(c))[0] as El | undefined) ?? new El('I')), pouches = () => host.all((x: El) => x.cls.has('lo-pouch')).map((x: El) => text(x)).join(' · ');
        const arrow = (f: string, k: number) => (host.all((x: El) => x.cls.has('kc-row')).find((r: El) => r.attrs['data-field'] === f) as El).all((x: El) => x.cls.has('kc-step'))[k];
        const open2 = `${pouches()} · ${one('lo-squadp')}`; S.pick(1); arrow('frags', 0).onclick?.(); const traded = `${pouches()} · ${one('lo-squadp')} · ${one('lo-pool')}`; S.pick(2); arrow('bangs', 1).onclick?.(); const filled = `${pouches()} · ${one('lo-squadp')}`, dim = arrow('charges', 1).cls.has('off');
        K.kitSet(3, 'bangs', 2); const hidden = one('lo-squadp'); S.setSquad(4); const four = `${pouches()} · ${one('lo-squadp')}`, blue = M()[3].bangs; S.pick(3); const says = one('kc-words'); S.setSquad(2); const pair = one('lo-squadp'); S.back(); return { open2, traded, filled, dim, hidden, four, blue, says, pair }; });
      under(T0);
      F.verdict(live.open2 === 'pouches 4 / 4 · pouches 4 / 4 · pouches 3 / 4 · Squad pouches 7 / 7' && live.traded === 'pouches 4 / 4 · pouches 3 / 4 · pouches 3 / 4 · Squad pouches 6 / 7 · Squad carries · 3 stun · 2 charges · 1 frag' && live.filled === 'pouches 4 / 4 · pouches 3 / 4 · pouches 4 / 4 · Squad pouches 7 / 7' && live.dim && live.hidden === 'Squad pouches 7 / 7' && live.four === 'pouches 4 / 4 · pouches 3 / 4 · pouches 4 / 4 · pouches 0 / 4 · pouches 0 / 4 · Squad pouches 7 / 7' && live.blue === 0 && /No room in the squad's pouches with this team: 2 stun canisters left behind\./.test(live.says) && live.pair === 'Squad pouches 7 / 7',
        'the loadout screen driven: on a pair the slots, the squad\'s pouches and the count line follow each press on a card (a frag given up, a stun canister taken by the other man, his next arrow dimmed); a man who is not coming does not count against the pair; stepped up to four, the squad is brought back inside its seven and the card of the man who gave something up says so',
        `pair: ${live.open2} → ${live.traded} → ${live.filled} · with Blue One (not coming) on 2 stun: ${live.hidden} · as four: ${live.four} · Blue One's card: '…${live.says.slice(-78)}'`);
      K.kitLoad(null, '?noslots'); K.kitReset(); const off = await shot('?noslots'); under(T0);
      F.verdict(on.p.length === 5 && on.p[0] === 'pouches 4 / 4' && on.p[1] === 'pouches 4 / 4' && on.p[2] === 'pouches 3 / 4' && on.p[3] === 'pouches 0 / 4' && on.squad === 'Squad pouches 7 / 7' && on.pool === 'Squad carries · 3 stun · 2 charges · 2 frags' && on.meterOff === false && on.fields.includes('smoke') && on.costs > 0 && !/noslots/.test(on.foot),
        'the loadout screen: every man who comes shows his pouches used of total in his slot, the squad\'s pouches stand beside the count line, the picked card carries the meter and the costs, and the squad\'s count line is the game\'s', `${on.p.join(' · ')} · '${on.squad}' · '${on.pool}'`);
      F.verdict(off.p.length === 0 && off.squad === '' && off.meterOff === true && off.costs === 0 && off.fields.includes('cans') && !off.fields.includes('smoke') && off.pool === on.pool && /pouches rule off \(\?noslots\)/.test(off.foot),
        'the switch off on the screen: no pouches anywhere (no slot line, no squad line, no meter, no cost words), your Cans row as the build before had it, and the foot says the rule is off', `rows ${off.fields.join(' ')} · foot '…${off.foot.slice(-52)}'`); }
  } finally { shipped(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── staged ──────────────────────────────────
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
async function stageOf(id: string, seed = 0x51c4) {
  const E = (SCENARIOS as any[]).find(e => e.id === id); Math.random = seeded(seed);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game; g.godMode = true;
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E)))); if (why) throw new Error(`${id}: start refused — ${why}`);
  return { W, g, restart: () => quiet(() => g.restartEncounter()) };
}
export async function pouchStage(): Promise<boolean> {
  const F = family('pouch-stage: legal fills on the floor');
  const was = process.env.PT_DIGEST;
  try {
    under(T0);
    // Red One gives up his frag, Red Two his frag for a second door charge, Blue One takes a stun canister (the squad's seven exactly); you: no smoke, two stun
    const steps: [number, string, 1 | -1][] = [[1, 'frags', -1], [2, 'frags', -1], [2, 'charges', 1], [3, 'bangs', 1], [0, 'smoke', -1], [0, 'bangs', 1]];
    const all = steps.every(([i, f, d]) => K.kitTry(i, f, d).ok), want = K.kitPool(4), fl = fills();
    const S = await stageOf('room-clear-four'); S.g.doorTools.sync(); const dt = S.g.doorTools, run = { bangs: dt.bangs, charges: dt.charges, frags: dt.frags }, p = S.g.player, you = { smoke: p.canisters, stun: p.flashbangs };
    await S.restart(); S.g.doorTools.sync(); const again = { bangs: dt.bangs, charges: dt.charges, frags: dt.frags }, you2 = { smoke: S.g.player.canisters, stun: S.g.player.flashbangs };
    F.verdict(all && K.kitLegal() === null && fl === '4/4 3/4 3/4 1/4 0/4 · squad 7/7' && want.bangs === 2 + 1 + 1 && want.charges === 1 + 2 && want.frags === 0 && JSON.stringify(run) === JSON.stringify(want) && JSON.stringify(again) === JSON.stringify(want) && you.smoke === 0 && you.stun === 2 && you2.smoke === 0 && you2.stun === 2 && teamOf(S.g).length === 4,
      'legal changed cards staged on the room clear with four: the run\'s door tools hold exactly what the cards add up to (kitPool), a restart included, and your smoke and stun counts are on the player', `pouches ${fl} · cards → ${JSON.stringify(want)} · staged ${JSON.stringify(run)} · restart ${JSON.stringify(again)} · you ${JSON.stringify(you)}`);
    // a named loadout staged: the pistol and the shotgun are in the men's hands
    under(T0); const lw = K.kitLoadout('shotgun'), wantL = K.kitPool(4);
    const L = await stageOf('room-clear-four'); L.g.doorTools.sync(); const ld = L.g.doorTools, team = teamOf(L.g) as any[], guns = team.map(gd => gd.weapon.def.id);
    F.verdict(lw === null && ld.bangs === wantL.bangs && ld.charges === wantL.charges && ld.frags === wantL.frags && wantL.charges === 0 && team.length === 4 && guns[1] === 'm870' && guns[0] === K.kitGun(M()[1]) && M()[1].weapon === 'pistol' && guns[0] !== guns[2],
      'a named loadout of the table (pistol and shotgun) staged: the run carries its counts — no door charge — and its guns are in the men\'s hands', `kitLoadout: ${lw ?? 'put on'} · staged ${JSON.stringify({ bangs: ld.bangs, charges: ld.charges, frags: ld.frags })} · guns ${guns.join(' ')}`);
    // cards made legal for a PAIR (Blue One takes two stun canisters while the pair fill all seven) and then staged with FOUR: the run fits them to the men who came
    under(T0); K.kitTeam(2); K.kitTry(1, 'frags', -1); const took = [K.kitTry(3, 'bangs', 1).ok, K.kitTry(3, 'bangs', 1).ok, K.kitTry(1, 'frags', 1).ok], pairOk = K.kitLegal() === null, fourNo = K.kitLegal(KIT.members, 4);
    const O = await stageOf('room-clear-four'); O.g.doorTools.sync(); const od = O.g.doorTools, fitted = K.kitLegal(KIT.members, 4), wantO = K.kitPool(4);
    F.verdict(took.every(x => x) && pairOk && !!fourNo && fitted === null && K.kitTeam() === 4 && od.bangs === wantO.bangs && od.bangs <= 3 + 1 && /left behind/.test(KIT_NOTE[3]),
      'cards that are legal for a pair but over the squad\'s pouches with four, staged with four (the loadout screen left without a Deploy, then Start): the staging fits them to the men who came — last man gives up first, his card says what — so no run starts over the budget', `as a pair ${pairOk ? 'legal' : 'ILLEGAL'} · with four: ${fourNo} · staged: ${fitted ?? 'legal'}, door tools ${JSON.stringify({ bangs: od.bangs, charges: od.charges, frags: od.frags })} · Blue One: '${KIT_NOTE[3]}'`);
    // none of either canister: the hand is not left on a slot that holds nothing
    under(T0); K.kitTry(0, 'smoke', -1); K.kitTry(0, 'bangs', -1);
    const Z = await stageOf('room-clear-four'), zp = Z.g.player, first = zp.slot; zp.slot = 'flash'; K.kitPlayer(Z.g); const offFlash = zp.slot; zp.slot = 'smoke'; K.kitPlayer(Z.g); const offSmoke = zp.slot;
    F.verdict(zp.canisters === 0 && zp.flashbangs === 0 && first !== 'smoke' && first !== 'flash' && offFlash !== 'flash' && offFlash !== 'smoke' && offSmoke !== 'smoke' && offSmoke !== 'flash' && fill(0) === '2/4', 'your card with no canisters at all: none on the player, and a hand that was on a canister slot (put there for the probe) is moved off it', `smoke ${zp.canisters} stun ${zp.flashbangs} · slot as staged '${first}' · from 'flash' → '${offFlash}' · from 'smoke' → '${offSmoke}' · pouches ${fill(0)}`);
    // YOU CARRY WHAT A TEAMMATE CARRIES (slots.json v6 — the maintainer, 10-10: "sam also has an unrealistic number of pouches. we should make him symmetric
    // with the team"), on the SHIPPED table: as many pouches as a teammate, the issued card fills exactly those, and the staging puts it on the player
    { const held = (g: any) => `${g.player.canisters}/${g.player.flashbangs}/${g.player.frags}/${g.player.rifle.shells}`;
      KIT.on = false; const P0 = await stageOf('room-clear-four'), built = held(P0.g); KIT.on = true;   // (what a Player is built with: the table off touches nobody)
      shipped(); const you = K.kitCost(0), mate = K.kitCost(1), card = M()[0], lines = you.lines.map((l: any) => `${l.n} ${l.item}`).join(', ');
      F.verdict(you.total === mate.total && you.total === 4 && you.used === you.total && card.smoke === 1 && card.bangs === 1 && card.frags === 1 && card.shells === 1 && !K.kitChanged(0) && K.kitLegal() === null,
        'you have the pouches a teammate has (four), and what you are issued fills exactly those: one smoke canister, one stun canister, one frag, one 40 mm round', `you ${you.used}/${you.total} (${lines}) · Red One ${mate.used}/${mate.total}`);
      const Y = await stageOf('room-clear-four'), staged = held(Y.g); await Y.restart(); const again = held(Y.g);
      K.kitShow(Y.g); const shown = held(Y.g);   // (a showcase starting on this player: his card comes off)
      const quit = quitScenario(Y.g), floor = held(Y.g); await quiet(() => Y.g.restartEncounter()); const floor2 = held(Y.g);
      F.verdict(built === '4/2/2/3' && staged === '1/1/1/1' && again === '1/1/1/1' && shown === built && quit === 'roomclear' && floor === built && floor2 === built,
        'a squad scenario staged with the rule on and every card as issued: the player holds one smoke, one stun, one frag and one 40 mm round, a restart included; his card taken off (kitShow) and the scenario quit back to the plain floor each give him what a Player is built with', `smoke/stun/frag/40 mm — built ${built} · staged ${staged} · restart ${again} · card off ${shown} · quit '${quit}': ${floor}, the floor restarted ${floor2}`);
      // the rule off (?noslots), and switched off by hand as the harness does: the card as issued is what a Player is built with, and nothing is written
      K.kitLoad(null, '?noslots'); K.kitReset(); const offCard = `${M()[0].smoke}/${M()[0].bangs}/${M()[0].frags}/${M()[0].shells}`, offSame = !K.kitChanged(0), N = await stageOf('room-clear-four'), off = held(N.g); N.g.player.canisters = 3; K.kitPlayer(N.g); const unwritten = N.g.player.canisters === 3;
      shipped(); SLOTS.on = false; const hand = `${M()[0].smoke}/${M()[0].bangs}/${M()[0].frags}/${M()[0].shells}`, handSame = !K.kitChanged(0), H = await stageOf('room-clear-four'), handHeld = held(H.g); SLOTS.on = true; const handBack = `${M()[0].smoke}/${M()[0].bangs}/${M()[0].frags}/${M()[0].shells}`;
      // … and a card of your own is carried across the switch as it is
      shipped(); K.kitTry(0, 'frags', -1); SLOTS.on = false; const ownOff = `${M()[0].smoke}/${M()[0].bangs}/${M()[0].frags}/${M()[0].shells}`; SLOTS.on = true; shipped();
      F.verdict(offCard === built && offSame && off === built && unwritten && hand === built && handSame && handHeld === built && handBack === '1/1/1/1' && ownOff === '1/1/0/1',
'with the pouches rule off (?noslots, or SLOTS.on put down by hand as the harness does) nothing changed: your card as issued is the build\'s 4 smoke, 2 stun, 2 frags, 3 rounds, a staging writes none of it onto the player (a count changed on him stays), and the switch put back up finds the card as issued again; a card of your own crosses the switch as it is', `?noslots: card ${offCard}, staged ${off}, written ${!unwritten} · by hand: card ${hand}, staged ${handHeld}, rule back on ${handBack} · your own 1/1/0/1 with the rule put down: ${ownOff}`);
      // THE HARNESS'S SHIPPED STAND PLAYS THE PAGE'S SOLO SAM (kit.ts kitSoloStand; src/host/profile.ts shippedBoot raises KIT_SOLO.stand — raised here by hand, the rule on):
      // stood up plain, restarted, or on a quiet mission alone he wears your card as the page's ?solo / quiet-alone Sam does; the frozen stand writes nothing
      const plain = async (file?: string, query?: string) => { Math.random = seeded(0x51c4); const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(file ? { level: levelOfFile(file) } : {}) })); if (query) { const r = await quiet(() => startFromQuery(W.game, query)); if (r.why) throw new Error(`${file} ${query}: ${r.why}`); } return W.game; };
      shipped(); K.KIT_SOLO.on = false; K.KIT_SOLO.stand = true;
      try {
        const P = await plain(), stood = held(P), flag = K.KIT_SOLO.on; await quiet(() => P.restartEncounter()); const fresh = held(P);
        const Q = await plain('quiet-yard.json', '?quiet'), alone = held(Q); await quiet(() => Q.restartEncounter()); const alone2 = held(Q);
        const S4 = await stageOf('room-clear-four'), squad = held(S4.g), down = !K.KIT_SOLO.on; quitScenario(S4.g); const after = held(S4.g);
        const T = await plain('train-kit.json', '?quiet'), lesson = held(T);
        K.KIT_SOLO.stand = false; K.KIT_SOLO.on = false; const Z = await plain(), frozen = held(Z), Zq = await plain('quiet-yard.json', '?quiet'), frozenQ = held(Zq), untouched = K.KIT_SOLO.on === false;
        F.verdict(stood === '1/1/1/1' && flag && fresh === '1/1/1/1' && alone === '1/1/1/1' && alone2 === '1/1/1/1' && squad === '1/1/1/1' && down && after === built && lesson === built && frozen === built && frozenQ === built && untouched,
          'the shipped harness stand plays the page\'s solo Sam: a game stood up plain (the solo night as the mission list deploys it), a restart of it, and a quiet mission alone started on it each hold one smoke, one stun, one frag and one round, not the eleven things a Player is built with; a squad scenario started on it is its own staging\'s and the solo flag comes down (quit: the plain floor\'s built Player, as on the page); a Training level keeps what a Player is built with; and with the stand\'s flag down — the frozen stand — nothing is written, the rule on or not', `flag up — plain ${stood}, restart ${fresh} · quiet alone ${alone}, restart ${alone2} · room clear ${squad}, quit ${after} · train-kit ${lesson} · flag down — plain ${frozen}, quiet alone ${frozenQ}`);
      } finally { K.KIT_SOLO.stand = false; K.KIT_SOLO.on = false; } }
    // identity: every card as issued — the rule off and the table off digest the same; the rule on is the same run with your four counts the issued ones
    // (it digested the same too while you were issued what a Player is built with: slots.json before v6)
    shipped(); process.env.PT_DIGEST = '1';
    const { play } = await import('./playthrough.ts');
    for (const scn of ['room-clear-four', 'night-breach']) {
      shipped(); const a = await play(scn, 3, 240); K.kitLoad(null, '?noslots'); K.kitReset(); const b = await play(scn, 3, 240); shipped(); KIT.on = false; const c = await play(scn, 3, 240); KIT.on = true;
      F.verdict(a.end !== 'error' && !!b.digest && b.digest === c.digest && b.t === c.t && a.end === b.end && a.t === b.t && !!a.digest && a.digest !== b.digest, `${scn} seed 3, every card as issued, in THIS build: the run digests the same with the kit table on and the pouches rule off as with the kit table off; with the rule on it is the same run to the second (the play-through throws nothing of yours) and its digest differs — your counts, one of each, are in it`, `${a.end} ${a.t} s · rule on ${String(a.digest).slice(0, 16)} / rule off ${String(b.digest).slice(0, 16)} / table off ${String(c.digest).slice(0, 16)}${a.end === 'error' ? ` · ${a.why.split('\n')[0]}` : ''}`);
    }
  } finally { if (was === undefined) delete process.env.PT_DIGEST; else process.env.PT_DIGEST = was; KIT.on = true; shipped(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the wall charge ─────────────────────────
/** Run `fn` in a build WITH the hook (the real WallCharge.setCarried where there is one, a stand-in that only takes the number where there is none — every
 *  call noted) or WITHOUT it (taken off for the length of the call). */
async function hooked<T>(have: boolean, fn: (calls: (number | null)[]) => Promise<T> | T): Promise<T> {
  const { WallCharge } = await import(`${ROOT}/src/game/wallcharge.ts`), proto = WallCharge.prototype as any, own = Object.hasOwn(proto, 'setCarried'), real = proto.setCarried, calls: (number | null)[] = [];
  if (have) proto.setCarried = function (this: any, n: number | null) { calls.push(n); if (typeof real === 'function') return real.call(this, n); this.carriedByProbe = n; };
  else delete proto.setCarried;
  try { return await fn(calls); } finally { if (own) proto.setCarried = real; else delete proto.setCarried; K.slotsSet(SHIPPED); }
}
export async function pouchWall(): Promise<boolean> {
  const F = family('pouch-wall: the wall charge on the cards');
  const fields = (i: number) => K.kitRows(i).map((r: any) => r.field);
  try {
    const { WallCharge } = await import(`${ROOT}/src/game/wallcharge.ts`), real = typeof (WallCharge.prototype as any).setCarried === 'function';
    // ── a build whose wall charge takes no count: no row, no loadout, nothing told
    await hooked(false, async calls => {
      shipped(); const here = K.wallHere(), rows = [0, 1, 2, 3, 4].map(i => fields(i).includes('walls')), kits = K.kitLoadouts().map((l: any) => l.id), put = K.kitLoadout('wall'), w = K.kitWalls(4), unk = K.slotsUnknown();
      K.kitLoad(memStore(JSON.stringify({ v: 2, members: [null, { walls: 1 }, null, null, null] })) as any, ''); const stored = M()[1].walls, f = fills();
      shipped(); const S = await stageOf('room-clear-four');
      F.verdict(!here && unk.includes('wallCharge') && rows.every(x => !x) && !kits.includes('wall') && kits[0] === 'issued' && /wallCharge, which this build has no row for/.test(put ?? '') && w === 0 && stored === 0 && f.startsWith('4/4 4/4 3/4') && calls.length === 0 && !!S.g,
        'a build whose wall charge takes no count from the cards (no WallCharge.setCarried): no card has a wall charge row, the squad kits do not list the wall loadout and it cannot be put on, a stored wall charge is not read, and a staging tells the wall charge nothing', `wallHere ${here} · squad kits: ${kits.join(' ')} · kitLoadout('wall'): '${put}' · stored walls read as ${stored} · ${calls.length} calls at staging`);
    });
    // ── a build that has it
    await hooked(true, async calls => {
      shipped(); const here = K.wallHere(), rows = [0, 1, 2, 3, 4].map(i => fields(i).includes('walls')), row = K.kitRows(1).find((r: any) => r.field === 'walls'), cost = K.kitRowCost(1, row);
      const full = K.kitTry(1, 'walls', 1), gave = [K.kitTry(1, 'bangs', -1).ok, K.kitTry(1, 'bangs', -1).ok], took = K.kitTry(1, 'walls', 1), f1 = fills(), words = K.kitWords(1), cost1 = K.kitRowCost(1, row);
      const room = [K.kitTry(2, 'charges', -1).ok, K.kitTry(2, 'frags', -1).ok], second = K.kitTry(2, 'walls', 1), legal = K.kitLegal(), both = K.kitWalls(4);
      const mine = (await import(`${ROOT}/src/game/owncharge.ts`)).OWNCHARGE.on;   // (your card has the row while you carry charges of your own: owncharge.ts)
      F.verdict(here && rows[0] === mine && rows.slice(1).every(x => x) && cost?.rate === '2 pouches each' && cost.pouches === 0 && !full.ok && /needs 2 pouches, none free \(4 of 4 full\): give something up first/.test(full.why) && gave.every(x => x) && took.ok && f1.startsWith('4/4 4/4 3/4') && cost1.pouches === 2 && /wall charge/.test(words)
        && room.every(x => x) && second.ok && both === 2 && legal === null,
        'a build that has it: every teammate\'s card has a wall charge row (yours too, only while you carry charges of your own) that takes two pouches each; as issued Red One has no room for it and the row says so; two stun canisters given up, it fits; a second one on another man, with pouches of his own free for it, fits too — the pouches are the only limit, there is no one to a squad — and the squad then carries two', `rows on the five: ${rows.map(x => x ? 'yes' : 'no').join(' ')} · rate '${cost?.rate}' · as issued: '${full.why}' · after giving up 2 stun: ${f1}, '${words}' · Red Two: ${second.ok ? 'takes one' : `'${second.why}'`} · kitWalls(4) ${both} · ${legal ?? 'a legal squad'}`);
      // the table's own loadout, the squad kits, which one the cards are
      shipped(); M()[1].suit = 'navy'; const kits = K.kitLoadouts().map((l: any) => `${l.id}=${l.name}`), put = K.kitLoadout('wall'), of = K.kitLoadoutOf(), f2 = fills(), w4 = K.kitWalls(4), w0 = K.kitWalls(0), pool = K.kitPool(4), kept = M()[1].suit, legal2 = K.kitLegal();
      K.kitTry(2, 'frags', -1); const own = K.kitLoadoutOf(), back = K.kitLoadout('issued'), iss = K.kitLoadoutOf(), kept2 = M()[1].suit, plain = [0, 1, 2, 3, 4].every(i => JSON.stringify({ ...M()[i], suit: 'issued' }) === JSON.stringify(K.kitDefault(i)));
      F.verdict(kits[0] === 'issued=As issued' && kits[1] === 'wall=One wall charge' && kits.length === SHIPPED.loadouts.length + 1 && put === null && of === 'wall' && legal2 === null && w4 === 1 && w0 === 0 && pool.charges === 0 && M()[1].walls === 0 && kept2 === 'navy' && kept === 'navy' && own === null && back === null && iss === 'issued' && plain,
        'the squad kits a press can put on are the issued kit and then the table\'s loadouts in its order — "One wall charge" first; put on, the cards are a legal fill carrying one wall charge and no door charge, each man keeps his colours, and the cards answer which kit they are (none once a row is changed by hand)', `${kits.join(' · ')} · wall: ${put ?? 'put on'}, ${f2}, kitWalls(4) ${w4}, kitPool(4) ${JSON.stringify(pool)}, Red One's suit ${kept} · after a frag given up: ${own ?? 'a mix of your own'} · issued: ${iss}`);
      // the card in a line (kitWords: the loadout strip's summary, the foot of the open card) names everything that fills a pouch, so its counts add up to the pouches beside it
      { const NAMED: Record<string, (n: number) => RegExp> = { smoke: n => new RegExp(`\\b${n} smoke`), bangs: n => new RegExp(`\\b${n} stun`), frags: n => new RegExp(`\\b${n} frags?\\b`), shells: n => new RegExp(`\\b${n}\\s×\\s40\\smm`), charges: n => new RegExp(`\\b${n} charges?\\b`), walls: () => /wall charge/, shotgun: () => /M870/ };
        const miss: string[] = [], seen: string[] = [], walk = (tag: string) => { for (let c = 0; c < KIT_MEMBERS; c++) { const w = K.kitWords(c); for (const l of K.kitCost(c).lines) if (!NAMED[l.item]?.(l.n).test(w)) miss.push(`${tag} ${c}: ${l.n} ${l.item} not in '${w}'`); if (c === 2) seen.push(`${tag} '${w}' (${K.kitCost(c).used})`); } };
        let on = 0; const kitsAll = K.kitLoadouts();   // (a kit or a set that was not really put on is a miss: the walk would be reading the issued cards under its name)
        for (const l of kitsAll) { shipped(); if (K.kitLoadout(l.id) === null && K.kitLoadoutOf() === l.id) on++; else miss.push(`kit ${l.id} not put on`); walk(l.id); }
        for (const s of KIT_PRESETS) { shipped(); K.kitPresetAll(s.id); if (K.kitLegal() === null && M().every((_m: any, c: number) => K.kitPresetOf(c) === s.id)) on++; else miss.push(`set ${s.id} not put on`); walk(`set ${s.id}`); }
        shipped(); const you = K.kitWords(0), mine = M()[0]; K.kitLoad(null, '?noslots'); const off = `${K.kitWords(0)} | ${K.kitWords(1)}`; shipped();
        F.verdict(miss.length === 0 && on === kitsAll.length + KIT_PRESETS.length && kitsAll.some((l: any) => l.id === 'wall') && mine.frags > 0 && mine.shells > 0 && new RegExp(`${mine.frags} frags?, ${mine.shells}\\s×\\s40\\smm`).test(you) && !/frag|40 mm/.test(off),
          'the one-line summary of a card names every tool that fills a pouch, with its count — frags and your 40 mm rounds too — on every squad kit and every set, so the line adds up to the pouches shown beside it; with the rule off the line is the build before\'s (no frags, no 40 mm)', miss.length ? miss.slice(0, 4).join(' · ') : `you, as issued: '${you}' · Red Two: ${seen.join(' · ')} · rule off: '${off}'`); }
      // staged: the wall charge is told the number at every staging — none as issued — and never with the rule off or the kit table off
      shipped(); calls.length = 0; const A = await stageOf('room-clear-four'), asIssued = [...calls], wcA = A.g.wallCharge as any, heldA = real ? `${wcA.carried}/${wcA.affordable}/${wcA.wallsLeft}` : ''; await A.restart(); const again = [...calls];
      shipped(); K.kitLoadout('wall'); calls.length = 0; const B = await stageOf('room-clear-four'), one = [...calls], wcB = B.g.wallCharge as any, heldB = real ? `${wcB.carried}/${wcB.affordable}/${wcB.wallsLeft}` : ''; await B.restart(); const one2 = [...calls], heldB2 = real ? `${wcB.carried}/${wcB.affordable}/${wcB.wallsLeft}` : '', charges = (B.g.doorTools.sync(), B.g.doorTools.charges);
      K.kitLoad(null, '?noslots'); K.kitReset(); calls.length = 0; await stageOf('room-clear-four'); const off = [...calls];
      shipped(); KIT.on = false; calls.length = 0; await stageOf('room-clear-four'); const noKit = [...calls]; KIT.on = true;
      shipped(); K.kitLoadout('wall'); calls.length = 0; K.kitStage(B.g, []); const soloSize = [...calls];
      K.kitLoad(null, '?noslots'); K.kitReset(); const offPut = K.kitLoadout('wall'), offWalls = M()[1].walls;
      shipped(); K.kitLoadout('wall'); K.slotsSet({ ...SHIPPED, tools: SHIPPED.tools.filter((t: any) => t.id !== 'wallCharge'), loadouts: SHIPPED.loadouts.filter((l: any) => l.id !== 'wall') }); const unpriced = `${K.kitWalls(4)} counted, row ${fields(1).includes('walls') ? 'there' : 'gone'}`;
      shipped(); K.kitLoadout('wall'); calls.length = 0; const Pr = (SCENARIOS as any[]).find(e => e.squad === 2 && e.id !== 'hostage-rescue') ?? (SCENARIOS as any[]).find(e => e.squad === 2); const C = Pr ? await stageOf(Pr.id) : null, pair = [...calls];
      F.verdict(asIssued.length === 1 && asIssued[0] === 0 && again.length === 2 && again[1] === 0 && one.length === 1 && one[0] === 1 && one2.length === 2 && one2[1] === 1 && charges === 0 && off.length === 0 && noKit.length === 0 && soloSize.length === 0 && /wallCharge, which this build has no row for/.test(offPut ?? '') && offWalls === 0 && unpriced === '0 counted, row gone' && (!C || (pair.length === 1 && pair[0] === 1)) && (!real || (heldA === '0/false/0' && heldB === '1/true/1' && heldB2 === '1/true/1')),
        'staged: the wall charge is told how many the men who came carry once per staging, a restart included — none as issued, one with the wall loadout on (and the run then carries no door charge) — and is never told with the pouches rule off, the kit table off, or when no teammate came (the solo size of a squad mission: the wall charge keeps its own rule); with the rule off the wall loadout cannot be put on, and under a table that does not price the wall charge a card that held one counts for nothing', `as issued: ${JSON.stringify(asIssued)}, restart ${JSON.stringify(again)} · wall loadout: ${JSON.stringify(one)}, restart ${JSON.stringify(one2)}, door charges ${charges} · ?noslots: ${JSON.stringify(off)} (kitLoadout('wall') there: '${offPut}') · ?nokit: ${JSON.stringify(noKit)} · nobody came: ${JSON.stringify(soloSize)} · table without the wall charge: ${unpriced}${Pr ? ` · ${Pr.id} (a pair): ${JSON.stringify(pair)}` : ''} · ${real ? `the build's own hook — the wall charge then holds carried/affordable/wallsLeft ${heldA} as issued, ${heldB} with the loadout, ${heldB2} after a restart` : 'a stand-in hook (this build has none: what the wall charge does with the number is not held here)'}`);
      // a stored kit: read, and over the pouches it is the wall charge that stays home (he was issued none)
      shipped(); K.kitLoad(memStore(JSON.stringify({ v: 2, members: [null, { walls: 1, bangs: 0 }, null, null, null] })) as any, ''); const fit = `${M()[1].walls} wall, ${fill(1)}`, n1 = KIT_NOTE[1];
      K.kitLoad(memStore(JSON.stringify({ v: 2, members: [null, { walls: 1 }, null, null, null] })) as any, ''); const over = `${M()[1].walls} wall, ${fill(1)}`, n2 = KIT_NOTE[1];
      F.verdict(fit === '1 wall, 4/4' && !n1 && over === '0 wall, 4/4' && /1 wall charge left behind/.test(n2), 'a stored wall charge is read back; one stored over his pouches is left behind and his card says so', `fits: ${fit} · over: ${over}, '${n2}'`);
      // the loadout screen's squad kit row
      shipped();
      const UI = await import(`${ROOT}/src/ui/loadout.ts`), E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-four');
      const scr = await withDom('', async () => { const host = new El('BODY') as any, S = UI.openLoadout(E, { host, deploy: () => {} }); const one = (c: string) => text((host.all((x: El) => x.cls.has(c))[0] as El | undefined) ?? new El('I'));
        const btns = () => host.all((x: El) => x.cls.has('lo-set')) as El[], lit = () => btns().filter(b => b.cls.has('on')).map(b => text(b)).join(','), names = btns().map(b => text(b)), lit0 = lit(), rowAt = S.rows.findIndex((r: any) => r.el.attrs?.['data-row'] === 'squadkit');
        const sel = () => S.rows.map((r: any) => (r.el.cls.has('sel') ? '■' : '□')).join(''), walk = [sel()]; for (const k of ['KeyS', 'KeyS', 'KeyW', 'KeyW', 'KeyW', 'KeyS']) { S.key(k); walk.push(sel()); }
        btns()[1].onclick?.(); const pressed = { lit: lit(), pool: one('lo-pool'), sq: one('lo-squadp'), red1: M()[1].walls, pouch: host.all((x: El) => x.cls.has('lo-pouch')).map((x: El) => text(x)).join(' · ') };
        const picked = () => btns().filter(b => b.cls.has('pick')).map(b => text(b)).join(','); S.sel = rowAt; S.paint(); S.key('KeyD'); const moved = `${picked()}/${lit()}`; S.key('Enter'); const right = lit(); S.key('KeyA'); S.key('KeyA'); S.key('Space'); const left = lit(), poolBack = one('lo-pool'); S.key('KeyA'); S.key('Enter'); const edge = lit();
        S.pick(1); (host.all((x: El) => x.cls.has('kc-row')).find((r: El) => r.attrs['data-field'] === 'frags') as El).all((x: El) => x.cls.has('kc-step'))[0].onclick?.(); const own = { lit: lit(), says: one('lo-kits-own') };
        // you alone on a squad mission: the row is dimmed and says why; a press and Enter put nothing on; a teammate back, it works again
        K.kitLoadout('issued'); const went = S.setSquad(0), before = snap(); S.sel = rowAt; S.paint(); btns()[2].onclick?.(); S.key('KeyD'); S.key('Enter'); const alone = { went, says: one('lo-kits-own'), dim: btns().every(x => (x as any).disabled === true), same: snap() === before }; S.setSquad(4); btns()[2].onclick?.(); const again = { dim: btns().some(x => (x as any).disabled === true), lit: lit() }; K.kitLoadout('issued');
        S.back(); return { names, lit0, rowAt, pressed, right, left, poolBack, edge, own, moved, alone, again, walk: walk.join(' ') }; });
      K.kitLoad(null, '?noslots'); K.kitReset(); const offRow = await withDom('?noslots', async () => { const host = new El('BODY') as any, S = UI.openLoadout(E, { host, deploy: () => {} }); const n = host.all((x: El) => x.cls.has('lo-set')).length, rows = S.rows.length; S.back(); return { n, rows }; });
      shipped();
      F.verdict(scr.names[0] === 'As issued' && scr.names[1] === 'One wall charge' && scr.names.length === SHIPPED.loadouts.length + 1 && scr.lit0 === 'As issued' && scr.rowAt === 1 && scr.walk === '■□□□□ □■□□□ □□■□□ □■□□□ ■□□□□ □□□□■ ■□□□□' && scr.pressed.lit === 'One wall charge' && scr.pressed.red1 === 1 && /· 0 charges · .* · 1 wall charge$/.test(scr.pressed.pool) && scr.pressed.sq === (SHIPPED.squad?.pouches == null ? '' : `Squad pouches ${SHIPPED.squad.pouches} / ${SHIPPED.squad.pouches}`) && scr.moved === 'Stun heavy/One wall charge' && scr.right === 'Stun heavy' && scr.left === 'As issued' && !/wall charge/.test(scr.poolBack) && scr.edge === 'As issued' && scr.own.lit === '' && scr.own.says === 'a mix of your own' && scr.alone.went && scr.alone.dim && scr.alone.same && scr.alone.says === 'you go alone: no squad to kit' && !scr.again.dim && scr.again.lit === 'Stun heavy' && offRow.n === 0,
        'the loadout screen: a Squad kit row under the team row — "As issued", then "One wall charge" beside it, then the table\'s other loadouts — the lit one is what the cards are; one press puts the wall loadout on all five and the count line says the squad carries a wall charge; W / S walk onto it like any row (five rows now, and they wrap), A / D move a pick along it that changes nothing until Enter or Space puts it on; a row changed by hand reads as a mix of your own; with nobody along the row is dimmed, says why and puts nothing on, by the mouse or the keys, and works again once a teammate comes; with the rule off there is no such row', `${scr.names.join(' | ')} · S S W W W S: ${scr.walk} · pressed: lit '${scr.pressed.lit}', ${scr.pressed.pouch}, '${scr.pressed.sq}', '${scr.pressed.pool}' · D: picked/lit '${scr.moved}', Enter: '${scr.right}' · A A Space: '${scr.left}' · after a frag given up: '${scr.own.says}' · alone: '${scr.alone.says}', dimmed ${scr.alone.dim}, cards as they were ${scr.alone.same}; four again: '${scr.again.lit}' · ?noslots: ${offRow.n} buttons`);
      // the free rows are the base's still, hook or no hook
      K.kitLoad(null, '?noslots'); K.kitReset(); const offFields = [1, 2, 3, 4].some(i => fields(i).includes('walls')); shipped();
      F.verdict(!offFields, 'with the pouches rule off no card has a wall charge row, hook or no hook (the free rows are the build-before\'s)', `walls row with ?noslots: ${offFields ? 'THERE' : 'none'}`);
    });
  } finally { KIT.on = true; shipped(); }
  return F.done();
}
