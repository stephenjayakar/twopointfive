// THE SQUAD'S KIT IS DEALT OVER THE MEN WHO COME (src/game/kit.ts KITDEAL, deal, kitTeam; `?nokitdeal`, TPS_KITDEAL=1).
//
//   bun run tools/qa/kitdeal-check.ts          (KITDEAL_BREAK=1 = the deal hands everything to the first two men again: the 'nobody comes bare' lines must fail)
//
// The issued kit and every named squad kit are written down as the first two teammates carry them, so a team of three or four showed the others with a gun
// and four empty pouches ("as issued still has blue team pretty empty"). The deal is how the table's cards are WORN, never a rewrite of them. This check
// asks, of the kit table alone: with three or four coming no man wears nothing while the kit has a thing for him, each pair of the four has a charge and a
// stun of its own as issued, the squad's count is the count it was at every size under every kit and the table's cards are the cards they were, a counted
// thing changed on a teammate's card makes the worn cards the player's own while any other change leaves the layout (so a smaller team still carries the
// whole kit), a peek writes nothing, a size-specific layout never reaches the store unasked, and men put back on their shares are the named kit again. Of a
// staged game: a team of four on The pass is the same run by digest with the deal on as off and its men carry the worn cards, smaller teams count what
// they counted, and a mission's own issue — the long hall's own block (it names nobody since the shield left the game), a block that names only you — counts what it counted. Of the Team & kit screen (a
// headless DOM): the roster of four shows things on both Blue men and marks nobody changed. And the switch is a row of the two stands, in the knob
// registry and in a recording's tables. It sets the switches it needs itself, so it asks the same on either stand. Looks at no picture: never seen on a GPU.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const STAND = harnessProfile() as string, BROKEN = process.env.KITDEAL_BREAK === '1', B = BROKEN ? ' · KITDEAL_BREAK=1' : '';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
const COUNTS = ['bangs', 'charges', 'frags', 'smoke'] as const, NAMES = ['You', 'Red One', 'Red Two', 'Blue One', 'Blue Two'];
type Card = Record<string, any>;
const things = (m: Card) => COUNTS.reduce((s, k) => s + (m[k] as number), 0);
/** a card in words (tools/qa/kit-audit.ts prints the same) · a man who comes with empty pouches and an empty big slot */
export const cardWords = (m: Card): string => [m.bangs && `${m.bangs} stun`, m.charges && `${m.charges} charge${m.charges === 1 ? '' : 's'}`, m.frags && `${m.frags} frag${m.frags === 1 ? '' : 's'}`, m.smoke && `${m.smoke} smoke`, m.walls && `${m.walls} wall charge${m.walls === 1 ? '' : 's'}`, K.bigOf(m) !== 'none' && K.bigOf(m) !== 'wall' && K.bigOf(m), m.wand && 'wand', m.weapon && m.weapon !== 'rifle' && m.weapon].filter(Boolean).join(' + ') || 'nothing';
export const comesBare = (i: number, m: Card): boolean => K.kitCost(i, m).used === 0 && K.bigOf(m) === 'none';
const worn = (n: number): Card[] => (K.kitWorn(n) as Card[]).map(m => ({ ...m }));
const cards = (n = 4) => worn(n).slice(1, n + 1).map(cardWords).join(' | ');
const stored = () => JSON.stringify(K.KIT.members);
const pool = (n: number) => { const P = K.kitPool(n); return `${P.bangs}/${P.charges}/${P.frags}/${K.kitSmokes(n)}/${K.kitWalls(n)}`; };
/** the kit table, its switches and the team size put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const was = K.KIT.members.map((m: Card) => ({ ...m })), on = K.KIT.on, big = K.BIGSLOT.on, rule = K.SLOTS.on, deal = K.KITDEAL.on, issue = K.ISSUE.on, team = K.kitTeam();
  try { return await fn(); } finally { K.KITDEAL.on = false; K.kitLoad(null, ''); K.SLOTS.on = rule; K.BIGSLOT.on = big; K.KIT.on = on; K.ISSUE.on = issue; K.kitTeam(team); for (let i = 0; i < was.length; i++) K.KIT.members[i] = was[i]; K.KITDEAL.on = deal; }
}
/** one kit on a team of n, the deal as asked: the cards as worn and as the table holds them, the squad's count, who comes bare */
function put(id: string, n: number, deal: boolean) {
  K.KITDEAL.on = false; K.kitTeam(4); K.kitReset(); K.KITDEAL.on = deal; K.kitTeam(n); const why = K.kitLoadout(id) as string | null, w = worn(n);
  const who = Array.from({ length: n }, (_x, k) => k + 1);
  return { why, pool: pool(n), legal: K.kitLegal(w) as string | null, is: K.kitLoadoutOf() as string | null, bare: who.filter(i => comesBare(i, w[i])), things: who.reduce((s, i) => s + things(w[i]), 0), cards: w, stored: stored(), words: cards(n) };
}

export async function dealCards(): Promise<boolean> {
  const F = family('kitdeal-cards: with three or four teammates the squad\'s kit is shared out among the men who come, and the squad carries what it carried');
  await kept(() => {
    try {
      K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.kitLoad(null, '');
      const kits = (K.kitLoadouts() as { id: string; name: string }[]).map(l => l.id);
      // nobody comes bare while the kit has a thing for him
      { const bad: string[] = [], seen: string[] = [];
        for (const id of kits) for (const n of [3, 4]) { const r = put(id, n, true), may = Math.max(0, n - r.things - r.cards.slice(1, n + 1).filter((m: Card) => K.bigOf(m) !== 'none').length); if (r.why || r.bare.length > may) bad.push(`${id} +${n}: ${r.why ?? `${r.bare.map(i => NAMES[i]).join(', ')} bare`}`); if (id === 'issued') seen.push(`+${n}: ${r.words}`); }
        F.verdict(kits.length >= 2 && !bad.length, 'NOBODY COMES BARE: under the issued kit and every named squad kit, a team of three or of four has no man with empty pouches and an empty big slot while the kit has a thing for him', `${kits.length} kits (${kits.join(', ')}) · ${bad.join(' · ') || 'none bare'} · as issued ${seen.join(' · ')}${B}`); }
      // each pair of the four works a door alone, as issued
      { const r = put('issued', 4, true), has = (a: number, b: number, k: string) => (r.cards[a][k] as number) + (r.cards[b][k] as number);
        F.verdict(has(1, 2, 'bangs') >= 1 && has(1, 2, 'charges') >= 1 && has(3, 4, 'bangs') >= 1 && has(3, 4, 'charges') >= 1, 'A PAIR, A DOOR: as issued, of four, the Red pair and the Blue pair each carry a stun canister and a door charge of their own', `Red ${has(1, 2, 'bangs')} stun ${has(1, 2, 'charges')} charge · Blue ${has(3, 4, 'bangs')} stun ${has(3, 4, 'charges')} charge · ${r.words}${B}`); }
      // the squad's count is the count it was, the worn cards are legal, the table's cards are the cards they were
      { const bad: string[] = []; let n0 = 0;
        for (const id of kits) for (const n of [0, 1, 2, 3, 4]) { const off = put(id, n, false), on = put(id, n, true); n0++; if (on.pool !== off.pool || on.legal || on.is !== id || off.is !== id || on.stored !== off.stored) bad.push(`${id} +${n}: ${off.pool} → ${on.pool}${on.legal ? ` (${on.legal})` : ''}, reads as ${on.is}${on.stored !== off.stored ? ', the table\'s cards moved' : ''}`); if (n < 3 && JSON.stringify(on.cards) !== JSON.stringify(off.cards)) bad.push(`${id} +${n}: a small team wears other cards`); }
        F.verdict(!bad.length, 'THE SAME COUNT, THE SAME TABLE: stun, charges, frags, smoke and wall charges the squad carries are the same with the deal on as off, at every size from none to four under every kit; the cards in the table are the same cards; as worn they are a legal fill; the kit still reads as itself; two or fewer wear the table\'s own', `${n0} kit-and-size pairs · ${bad.join(' · ') || 'all the same'}`); }
      // the size stepped: nothing is written, the worn cards follow
      { K.KITDEAL.on = false; K.kitTeam(2); K.kitReset(); const base = stored(), offPool: Record<number, string> = {}; for (const n of [0, 1, 2, 3, 4]) { K.kitTeam(n); offPool[n] = pool(n); }
        K.KITDEAL.on = true; K.kitTeam(2); K.kitReset(); const walk: string[] = []; let ok = true;
        for (const n of [4, 3, 1, 2, 4, 0, 3]) { K.kitTeam(n); const is = K.kitLoadoutOf(), p = pool(n), w = worn(n), fine = stored() === base && (n < 3 ? JSON.stringify(w) === base : BROKEN || !Array.from({ length: n }, (_x, k) => k + 1).some(i => comesBare(i, w[i]))); ok &&= is === 'issued' && p === offPool[n] && fine; walk.push(`+${n} ${p} ${is}`); }
        F.verdict(ok, 'THE SIZE STEPPED (four, three, one, two, four, none, three) on cards as issued: the table\'s cards never move, the squad carries what the build before carried at each size, three and four wear the deal and two or fewer the table\'s own', walk.join(' → ')); }
      // a counted thing changed on a teammate: the worn cards become the player's own
      { K.KITDEAL.on = true; K.kitTeam(4); K.kitReset(); const before = worn(4), r = K.kitTry(3, 'smoke', 1), mine = stored(), want = JSON.stringify(before.map((c, i) => (i === 3 ? { ...c, smoke: 1 } : c))), was = K.kitLoadoutOf(); for (const n of [2, 3, 1, 4]) K.kitTeam(n);
        F.verdict(BROKEN || (r.ok && mine === want && was === null && stored() === mine && pool(4) === '3/2/2/1/0'), 'A COUNTED THING CHANGED BY HAND (a smoke canister onto Blue One, of four): the cards as worn, with that change, are now the table\'s — a kit of the player\'s own — and stepping the size two, three, one, four moves no card', `taken ${r.ok} · ${cards(4)} · reads as ${was ?? 'a mix of your own'} · the squad of four ${pool(4)}${B}`); }
      // anything else changed: the layout stays, so a smaller team still carries the whole kit
      { K.KITDEAL.on = true; K.kitTeam(4); K.kitReset(); const base = K.KIT.members.map((m: Card) => COUNTS.map(k => m[k]).join()).join('|');
        const a = K.kitSet(0, 'smoke', 0), b = K.kitSet(4, 'suppressed', false), c = K.kitSet(3, 'suit', 'black'), now = K.KIT.members.map((m: Card) => COUNTS.map(k => m[k]).join()).join('|').replace(/^[^|]*/, base.split('|')[0]);
        const four = cards(4), bareNow = [1, 2, 3, 4].filter(i => comesBare(i, worn(4)[i])); K.kitTeam(2); const pair = pool(2); K.kitTeam(1); const one = pool(1);
        F.verdict(a && b && c && now === base && K.KIT.members[4].suppressed === false && K.KIT.members[3].suit === 'black' && (BROKEN || !bareNow.length) && pair === '3/2/2/0/0' && one === '2/1/1/0/0', 'ANYTHING ELSE CHANGED BY HAND (your own smoke, Blue Two\'s suppressor, Blue One\'s suit, of four): the change is kept, the teammates\' counted things stay in the table\'s layout and are still worn shared out — so the pair and one man alone carry all of what they carried', `taken ${a} ${b} ${c} · worn of four: ${four} · then the pair ${pair} · one man ${one}`); }
      // a peek writes nothing; the store never gets a size's layout unasked
      { K.KITDEAL.on = true; const S = memStore(); K.kitLoad(S, ''); K.kitTeam(4); K.kitReset(); const base = stored(); K.kitPeek(3, 'smoke', 1); K.kitPresetWhy(3, 'quiet'); K.kitPastePeek(3, K.KIT.members[1]); const peeked = stored() === base;
        K.kitSet(3, 'suit', 'black'); const kept = JSON.parse(S.getItem(K.KIT_LS) ?? '{}').members as Card[] | undefined, laid = !!kept && things(kept[3]) === 0 && things(kept[4]) === 0 && kept[1].bangs === 2 && kept[3].suit === 'black';
        K.KITDEAL.on = false; K.kitLoad(S, ''); K.kitTeam(2); const off = `${K.kitLoadoutOf()} ${pool(2)}`; K.kitLoad(null, '');
        F.verdict(peeked && laid && off === 'issued 3/2/2/0/0', 'A PEEK WRITES NOTHING, AND THE STORE KEEPS THE TABLE\'S LAYOUT: a row, a set and a paste asked about on Blue One move no card; a suit changed at four is written with the teammates\' counts as the table has them, so the same store read with the deal off is the issued kit and a pair carries all of it', `peeks left the cards ${peeked ? 'alone' : 'CHANGED'} · the store after the suit: Red One ${kept ? cardWords(kept[1]) : '?'}, Blue One ${kept ? cardWords(kept[3]) : '?'} · read with the deal off: ${off}`); }
      // a man's own set is his share; men put back on their shares are the kit again
      { K.KITDEAL.on = true; K.kitTeam(4); K.kitReset(); const sets = [1, 2, 3, 4].map(i => K.kitPresetOf(i)), marked = [1, 2, 3, 4].filter(i => K.kitChanged(i)); K.kitTry(3, 'smoke', 1); const mid = K.kitLoadoutOf(), r = K.kitPreset(3, 'issued'), back = K.kitLoadoutOf(); K.kitTeam(2); const pair = pool(2);
        F.verdict(BROKEN || (sets.every(s => s === 'issued') && !marked.length && mid === null && r.ok && back === 'issued' && pair === '3/2/2/0/0'), 'A MAN\'S OWN "AS ISSUED" on a team of four is his share of the deal: every worn card reads as that set and none as changed; pressed on a card changed by hand it puts the squad back on the issued kit, in the table\'s layout — a pair again carries all of it', `the four read ${sets.join(', ')} · marked changed: ${marked.map(i => NAMES[i]).join(', ') || 'nobody'} · after the change: ${mid ?? 'a mix of your own'} · pressed on Blue One: ${r.ok ? 'ok' : r.why} · the squad kit reads ${back} · the pair ${pair}${B}`); }
      // cards changed by hand that come to read as a named kit's table are still the player's own
      { K.KITDEAL.on = true; const S = memStore(); K.kitLoad(S, ''); K.kitTeam(3); const why = K.kitLoadout('quiet'), a = K.kitTry(1, 'bangs', 1), b = K.kitTry(3, 'bangs', -1), shown = [1, 2, 3].map(i => K.kitShown(i).bangs).join('/'), is = K.kitLoadoutOf(), p3 = pool(3);
        K.kitLoad(S, ''); K.kitTeam(3); const read = [1, 2, 3].map(i => K.kitShown(i).bangs).join('/'); K.kitLoadout('quiet'); const again = [1, 2, 3].map(i => K.kitShown(i).bangs).join('/'), is2 = K.kitLoadoutOf(); K.kitLoad(null, '');
        F.verdict(BROKEN || (why === null && a.ok && b.ok && b.value === 0 && shown === '2/1/0' && is === null && p3.startsWith('3/') && read === '2/1/0' && again === '1/1/1' && is2 === 'quiet'), 'CARDS OF YOUR OWN THAT READ AS A KIT\'S TABLE (Quiet, of three: a stun canister added to Red One, Blue One\'s given up — the counts the Quiet kit is written with) stay as you made them: Blue One shows none, the squad kit row names no kit, the same store read back shows the same; Quiet pressed again shares it out', `the kit put on: ${why ?? 'ok'} · Blue One's step said ${b.ok ? b.value : b.why} · stun as worn ${shown} · squad kit: ${is ?? 'a mix of your own'} · carries ${p3} · read back ${read} · Quiet pressed: ${again}, ${is2}${B}`); }
      // a thing that costs a pouch and is not counted (the wand), and a seeded walk of presses: the stored cards and the worn ones never outside the rule
      { const wOn = WAND.on, wMate = WAND.mate; WAND.on = true; WAND.mate = true; K.KITDEAL.on = true;
        try {
          const S = memStore(); K.kitLoad(S, ''); K.kitTeam(4); K.kitReset();
          const blue = K.kitSet(3, 'wand', true), laid = things(K.KIT.members[3]) === 0 && K.KIT.members[3].wand === true && K.kitLegal() === null, pairB = (K.kitTeam(2), pool(2)); K.kitTeam(4);
          const red = K.kitSet(1, 'wand', true), legal = K.kitLegal(), wornLegal = K.kitLegal(K.kitWorn()), has = K.kitShown(1).wand === true, used = K.kitCost(1).used;
          K.kitLoad(S, ''); K.kitTeam(4); const after = K.kitShown(1).wand === true && K.kitLegal() === null; K.kitLoad(null, '');
          F.verdict(BROKEN || (blue && laid && pairB === '3/2/2/0/0' && red && legal === null && wornLegal === null && has && used === 3 && after), 'A THING THAT COSTS A POUCH AND IS NOT COUNTED (the wand, of four as issued): on Blue One, whose card in the table is empty, it is written onto the table\'s layout and a pair still carries all of the kit; on Red One, whose card in the table is full, the worn cards are kept instead — no stored card is ever over its pouches, and the same store read back still has his wand', `Blue One: ${blue ? 'taken' : 'refused'}, the table's layout ${laid ? 'kept' : 'MOVED'}, a pair ${pairB} · Red One: ${red ? 'taken' : 'refused'}, ${used} of 4 pouches · stored cards ${legal ?? 'legal'} · worn cards ${wornLegal ?? 'legal'} · read back: ${after ? 'the wand is on his card' : 'LOST'}${B}`);
          const rnd = seeded(0x51de), bad: string[] = []; let presses = 0, refused = 0, dealt = 0;
          for (const n of [3, 4]) { K.kitTeam(n); K.kitReset();
            for (let p = 0; p < 1500; p++) { if (p % 40 === 0) K.kitLoadout(kits[Math.floor(rnd() * kits.length)]);
              const i = Math.floor(rnd() * K.KIT_MEMBERS), rows = K.kitRows(i) as { field: string; values: unknown[] }[], r = rows[Math.floor(rnd() * rows.length)], dir = rnd() < 0.6 ? 1 : -1, was = stored(), how = rnd(); presses++;
              const others = () => JSON.stringify((K.kitWorn() as Card[]).filter((_c, j) => j !== i)), rest = others();
              if (K.kitWorn() !== K.KIT.members) dealt++;
              if (how < 0.7) { const peek = K.kitPeek(i, r.field, dir), t = K.kitTry(i, r.field, dir); if (!t.ok) { refused++; if (stored() !== was || peek.why !== t.why) bad.push(`+${n} ${i}.${r.field}: a refusal that wrote, or not the peek's`); } else if (peek.why || peek.value !== t.value) bad.push(`+${n} ${i}.${r.field}: the peek and the step disagree`); else if (i > 0 && COUNTS.includes(r.field as never) && K.kitShown(i)[r.field] !== t.value) bad.push(`+${n} ${i}.${r.field}: the step said ${t.value} and his card shows ${K.kitShown(i)[r.field]}`); }
              else if (how < 0.9) { if (!K.kitSet(i, r.field, r.values[Math.floor(rnd() * r.values.length)])) { refused++; if (stored() !== was) bad.push(`+${n} ${i}.${r.field}: a refused set wrote`); } }
              else { const t = K.kitPreset(i, K.KIT_PRESETS[Math.floor(rnd() * K.KIT_PRESETS.length)].id); if (!t.ok) { refused++; if (stored() !== was) bad.push(`+${n} ${i}: a refused set wrote`); } }
              if (others() !== rest) bad.push(`+${n} press ${p} (${i}.${r.field}): another man's card moved as worn`);
              const a = K.kitLegal(), b = K.kitLegal(K.kitWorn()); if (a || b) bad.push(`+${n} after press ${p} (${i}.${r.field}): ${a ? `stored — ${a}` : `worn — ${b}`}`); } }
          K.kitLoad(null, '');
          F.verdict(!bad.length && refused > 0 && (BROKEN || dealt > 100), '3000 SEEDED PRESSES with the deal on, teams of three and four, a squad kit put on every forty: row steps, values set outright and sets, on every card — the stored cards and the worn cards are never outside the rule, a refusal writes nothing, what the arrows promise (kitPeek) is what a press does and what his card then shows, and no press on one man moves another man\'s card as worn', `${presses} presses, ${refused} refused, ${dealt} made on dealt cards${bad.length ? ` · ${bad.slice(0, 4).join(' · ')}` : ''}`);
        } finally { WAND.on = wOn; WAND.mate = wMate; } }
      // off: the table's cards
      { const bad: string[] = []; for (const id of kits) for (const n of [3, 4]) { const r = put(id, n, false); if (things(r.cards[3]) + things(r.cards[4]) !== 0) bad.push(`${id} +${n}`); }
        F.verdict(!bad.length, 'the control, the switch OFF: every kit at three and four is worn as the table writes it, the Blue men with nothing counted', bad.join(' · ') || `${kits.length} kits as written`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function dealRun(): Promise<boolean> {
  const F = family('kitdeal-run: a staged run is the run it was — the deal moves cards, never the squad\'s count');
  await kept(async () => {
    try {
      const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
      const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`), { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`), { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
      const squad0 = NIGHTBREACH.squad, seed0 = ROOMCLEAR.seed, way0 = ROOMCLEAR.way;
      const stage = async (file: string, squad: number, deal: boolean, o: { frames?: number; dealtFor?: number; block?: Record<string, Card> } = {}) => {
        const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); if (o.block) (data.scenarios ??= {} as any).issue = { members: o.block } as any;
        ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0; NIGHTBREACH.squad = squad;
        const W: any = await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(data), seed: 5 })), g = W.game;
        K.KIT.on = true; K.SLOTS.on = true; K.ISSUE.on = true; K.KITDEAL.on = false; K.kitLoad(null, ''); K.kitTeam(4); K.kitReset(); K.KITDEAL.on = deal; if (o.dealtFor) K.kitTeam(o.dealtFor);
        const before = cards(), why = await hushed(() => g.roomClear.start(0)); await hushed(() => { for (let i = 0; i < (o.frames ?? 6); i++) W.step(1 / 60); });
        const men = g.orders.men('all', { down: true }) as any[];
        return { why, n: men.length, pool: `${g.doorTools.bangs} stun ${g.doorTools.charges} charges ${g.doorTools.frags} frags`, h: hashDigest(digestGame(g, true)) as string, before, worn: men.map(m => cardWords(K.kitOf(m) ?? {})).join(' | ') };
      };
      try {
        const off = await stage('pass.json', 4, false, { frames: 240 }), on = await stage('pass.json', 4, true, { frames: 240 });
        F.verdict(off.why === null && on.why === null && on.n === 4 && on.pool === off.pool && on.h === off.h, 'THE PASS, FOUR, four seconds of the mission: the same run by digest with the deal on as off, and the door tools count the same', `off ${off.h} (${off.pool}) · on ${on.h} (${on.pool}) · ${on.n} men`);
        F.verdict(BROKEN ? true : on.worn !== off.worn && !/nothing/.test(on.worn), 'and the men of that run wear the dealt cards: nobody of the four staged with nothing', `off: ${off.worn} · on: ${on.worn}${B}`);
        const two0 = await stage('pass.json', 2, false), two = await stage('pass.json', 2, true, { dealtFor: 4 }), one0 = await stage('pass.json', 1, false), one = await stage('pass.json', 1, true, { dealtFor: 4 });
        F.verdict(two.pool === two0.pool && one.pool === one0.pool && two.n === 2 && one.n === 1, 'THE SCREEN LEFT ON FOUR, THEN STAGED SMALLER: a pair and one man alone carry what that team always carried (the staging wears the cards for the men who came)', `worn of four before the pair's staging: ${two.before} · the pair ${two.pool} (was ${two0.pool}) · one man ${one.pool} (was ${one0.pool})`);
        const you = { '0': { frags: 2 } }, y20 = await stage('hall.json', 2, false, { block: you }), y2 = await stage('hall.json', 2, true, { block: you, dealtFor: 4 }), y30 = await stage('hall.json', 3, false, { block: you }), y3 = await stage('hall.json', 3, true, { block: you, dealtFor: 4 });
        F.verdict(y2.pool === y20.pool && y3.pool === y30.pool && y2.n === 2 && y3.n === 3, 'A MISSION\'S ISSUE THAT NAMES ONLY YOU (a block written over the long hall\'s for this line): a pair and a three count what they counted', `the pair ${y2.pool} (was ${y20.pool}) · three ${y3.pool} (was ${y30.pool})`);
        const out0 = await stage('hall.json', 4, false), out = await stage('hall.json', 4, true);
        F.verdict(out.pool === out0.pool && out.n === 4, 'A MISSION\'S OWN ISSUE (the long hall: its block names nobody since the shield left the game, so the four are staged in the plain issue under it) counts what it counted', `${out.pool} (was ${out0.pool}) · ${out.n} men`);
      } finally { NIGHTBREACH.squad = squad0; ROOMCLEAR.seed = seed0; ROOMCLEAR.way = way0; }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function dealScreen(): Promise<boolean> {
  const F = family('kitdeal-screen: Team & kit shows things on every man of a team of four');
  const G = globalThis as any, hadLS = 'localStorage' in G, prevLS = G.localStorage;
  await kept(async () => {
    try {
      await withDom('?quality=high&mute', async () => {
        G.localStorage = memStore(); G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
        const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`);
        const SEARCH = '?quality=high&mute', list: any[] = M.missionList(), pickWas = M.MISSIONS.onPick, up: any[] = []; M.MISSIONS.onPick = null;
        try {
          const read = (deal: boolean) => {
            K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.KITDEAL.on = false; K.kitLoad(null, ''); K.kitTeam(4); K.kitReset(); K.KITDEAL.on = deal;
            const m = list.find(x => x.id === 'pass-four'); if (!m) throw new Error('no mission \'pass-four\' on the list');
            const host = new El('DIV') as any, L = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { } }); up.push(L); L.setSquad(4);
            const root = L.root as unknown as El, slot = (i: number) => root.all(e => e.cls.has('lo-slot')).find(s => s.attrs['data-slot'] === String(i));
            const of = (i: number, c: string) => slot(i)?.all(e => e.cls.has(c))[0]?.textContent ?? '';
            L.pick(3); const rows = root.all(e => e.cls.has('kc-row')), val = (f: string) => rows.find(r => r.attrs['data-field'] === f)?.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '';
            return { card: `charges '${val('charges')}' frags '${val('frags')}' stun '${val('bangs')}'`, rowsChanged: rows.filter(r => r.cls.has('changed')).map(r => r.attrs['data-field']), pouch: [1, 2, 3, 4].map(i => of(i, 'lo-pouch')), sum: [1, 2, 3, 4].map(i => of(i, 'lo-sum')), chips: [1, 2, 3, 4].map(i => slot(i)?.all(e => e.cls.has('lo-ic')).length ?? 0), changed: [1, 2, 3, 4].filter(i => slot(i)?.all(e => e.cls.has('lo-name'))[0]?.cls.has('changed')), pool: root.all(e => e.cls.has('lo-pool'))[0]?.textContent ?? '', kit: root.all(e => e.cls.has('lo-kits'))[0]?.all(e => e.cls.has('on')).map(b => b.textContent).join(',') ?? '' };
          };
          const off = read(false), on = read(true);
          F.verdict(on.pouch.every(p => /^pouches [1-4] \/ 4$/.test(p)) && on.pool === off.pool && /3 stun · 2 charges · 2 frags/.test(on.pool), 'THE PASS, FOUR, AS ISSUED: every teammate on the roster has something in his pouches, and the squad\'s line reads the count it read', `pouches ${on.pouch.join(' · ')} · ${on.pool}${B}`);
          F.verdict(on.changed.length === 0 && /as issued/i.test(on.kit) && on.rowsChanged.length === 0 && (BROKEN || on.card !== off.card), 'no worn card is marked as changed, the squad kit row still lights As issued, and Blue One\'s own card shows his share with no tile marked', `marked changed: ${on.changed.map(i => NAMES[i]).join(', ') || 'nobody'} · lit: ${on.kit} · Blue One's card: ${on.card} (the switch off: ${off.card}) · tiles marked: ${on.rowsChanged.join(', ') || 'none'}${B}`);
          F.verdict(off.pouch[2] === 'pouches 0 / 4' && off.pouch[3] === 'pouches 0 / 4', 'the control, the switch off: the Blue men\'s pouches read empty, as the shot of the screen showed', `pouches ${off.pouch.join(' · ')} · Blue One: ${off.sum[2]}`);
        } finally { for (const L of up) try { L.close?.(); } catch { /* a screen already closed */ } M.MISSIONS.onPick = pickWas; }
      });
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
    finally { if (hadLS) G.localStorage = prevLS; else delete G.localStorage; }
  });
  return F.done();
}

export async function dealStands(): Promise<boolean> {
  const F = family('kitdeal-stands: the deal is a switch of the two stands, in the registry and in a recording\'s tables');
  await kept(async () => {
    try {
      const env = process.env.TPS_KITDEAL, W: any = await hushed(() => standUp()), g = W.game, stood = K.KITDEAL.on as boolean;
      const want = STAND === 'frozen' ? env === '1' : env === undefined ? true : env === '1';
      F.verdict(stood === want, `the ${STAND} stand stands a game up with the switch ${want ? 'ON' : 'OFF'}${env !== undefined ? ` (TPS_KITDEAL=${env})` : STAND === 'frozen' ? ' (held off: TPS_KITDEAL=1 raises it)' : ' (as the page opens: TPS_KITDEAL=0 holds it off)'}`, `KITDEAL.on after the stand-up: ${stood}`);
      const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], KN = await import(`${ROOT}/src/game/knobs.ts`), R = KN.knobRegistry(), JN = (KN.JOURNAL_KNOBS as readonly string[]).includes('KITDEAL');
      F.verdict(s.includes('TPS_KITDEAL') && String(FROZEN_HOLDS['KITDEAL.on']).startsWith('TPS_KITDEAL=1') && R.KITDEAL === K.KITDEAL && JN, 'the switch is a row of the two stands\' list, has its word, is in the knob registry and among the tables a recording carries', `STAND_ENV ${s.includes('TPS_KITDEAL')} · FROZEN_HOLDS ${FROZEN_HOLDS['KITDEAL.on']} · registry ${R.KITDEAL === K.KITDEAL} · JOURNAL_KNOBS ${JN}`);
      const JR = await import(`${ROOT}/src/game/journal.ts`);
      K.KITDEAL.on = true; const own = JR.knobsSnapshot(g), carried = (own.tables as any).KITDEAL?.on, old = JR.knobsSnapshot(g); delete (old.tables as any).KITDEAL;
      await hushed(() => JR.applyKnobs(g, old)); const without = K.KITDEAL.on as boolean;
      await hushed(() => JR.applyKnobs(g, own)); const withIt = K.KITDEAL.on as boolean;
      F.verdict(carried === true && without === false && withIt === true, 'a recording made with the switch on carries it and replays with it on; one from before the table replays with it OFF', `the snapshot's table says ${carried} · applied with no KITDEAL table: ${without} · applied with its own: ${withIt}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

if (import.meta.main) {
  let ok = true;
  for (const f of [dealCards, dealRun, dealScreen, dealStands]) ok = (await f()) && ok;
  process.exit(ok ? 0 : 1);
}
