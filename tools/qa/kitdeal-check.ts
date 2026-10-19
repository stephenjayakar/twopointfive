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
//
// `KITDEAL.more` (`?nokitmore`, TPS_KITMORE=1; KITMORE_BREAK=1 = nobody is lent a tool and nobody is handed the canister: the 'a tool each pair' lines
// must fail). The families above ask of the deal ALONE (they hold `more` off, but for the seeded walk of presses, which walks the whole rule);
// kitdeal-more asks what the key adds: of three or four as issued Red Two wears the breaching shotgun and, of four, Blue Two the hammer with their pouches as they
// were; no card of the table or the store ever holds a lent tool — not after another row is changed, not after a counted thing is — so a pair comes as it
// did and the key off is the deal alone at once; a big thing put on by hand is his; a slot emptied by hand stays empty (the lent tool taken off, or a
// thing put on by hand and cleared again) and moves nothing a smaller team carries; a card shows what every press of the big row said; cards that leave
// a named kit keep its empty slots; and the Quiet kit of four has a canister for its fourth man, which the squad's count holds. kitdeal-run stages
// them: the men carry the tools, the door tools have the big slot's row, a pair staged after the screen stood on four carries none.
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
const STAND = harnessProfile() as string, BROKEN = process.env.KITDEAL_BREAK === '1', MORE_BROKEN = process.env.KITMORE_BREAK === '1', B = (BROKEN ? ' · KITDEAL_BREAK=1' : '') + (MORE_BROKEN ? ' · KITMORE_BREAK=1' : '');
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
  const was = K.KIT.members.map((m: Card) => ({ ...m })), on = K.KIT.on, big = K.BIGSLOT.on, rule = K.SLOTS.on, deal = K.KITDEAL.on, more = K.KITDEAL.more, issue = K.ISSUE.on, team = K.kitTeam();
  try { return await fn(); } finally { K.KITDEAL.more = more; K.KITDEAL.on = false; K.kitLoad(null, ''); K.SLOTS.on = rule; K.BIGSLOT.on = big; K.KIT.on = on; K.ISSUE.on = issue; K.kitTeam(team); for (let i = 0; i < was.length; i++) K.KIT.members[i] = was[i]; K.KITDEAL.on = deal; }
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
      K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.kitLoad(null, ''); K.KITDEAL.more = false;   // (the deal alone: what `more` adds is kitdeal-more's)
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
          const rnd = seeded(0x51de), bad: string[] = []; let presses = 0, refused = 0, dealt = 0; K.KITDEAL.more = true;   // (the walk is of the whole rule: tools lent, taken off, put back)
          for (const n of [3, 4]) { K.kitTeam(n); K.kitReset();
            for (let p = 0; p < 1500; p++) { if (p % 40 === 0) K.kitLoadout(kits[Math.floor(rnd() * kits.length)]);
              const i = Math.floor(rnd() * K.KIT_MEMBERS), rows = K.kitRows(i) as { field: string; values: unknown[] }[], r = rows[Math.floor(rnd() * rows.length)], dir = rnd() < 0.6 ? 1 : -1, was = stored(), how = rnd(); presses++;
              const others = () => JSON.stringify((K.kitWorn() as Card[]).filter((_c, j) => j !== i).map(({ bare: _mark, ...c }) => c)), rest = others();   // (what he WEARS: the mark an emptied big slot carries — cards leaving a named kit are given it — is not a thing worn)
              if (K.kitWorn() !== K.KIT.members) dealt++;
              if (how < 0.7) { const peek = K.kitPeek(i, r.field, dir), t = K.kitTry(i, r.field, dir); if (!t.ok) { refused++; if (stored() !== was || peek.why !== t.why) bad.push(`+${n} ${i}.${r.field}: a refusal that wrote, or not the peek's`); } else if (peek.why || peek.value !== t.value) bad.push(`+${n} ${i}.${r.field}: the peek and the step disagree`); else if (i > 0 && COUNTS.includes(r.field as never) && K.kitShown(i)[r.field] !== t.value) bad.push(`+${n} ${i}.${r.field}: the step said ${t.value} and his card shows ${K.kitShown(i)[r.field]}`); else if (i > 0 && r.field === 'big' && K.bigOf(K.kitShown(i)) !== t.value) bad.push(`+${n} press ${p} ${i}.big: the step said ${t.value} and his card shows ${K.bigOf(K.kitShown(i))}`); }
              else if (how < 0.9) { if (!K.kitSet(i, r.field, r.values[Math.floor(rnd() * r.values.length)])) { refused++; if (stored() !== was) bad.push(`+${n} ${i}.${r.field}: a refused set wrote`); } }
              else { const t = K.kitPreset(i, K.KIT_PRESETS[Math.floor(rnd() * K.KIT_PRESETS.length)].id); if (!t.ok) { refused++; if (stored() !== was) bad.push(`+${n} ${i}: a refused set wrote`); } }
              if (others() !== rest) bad.push(`+${n} press ${p} (${i}.${r.field}): another man's card moved as worn`);
              const a = K.kitLegal(), b = K.kitLegal(K.kitWorn()); if (a || b) bad.push(`+${n} after press ${p} (${i}.${r.field}): ${a ? `stored — ${a}` : `worn — ${b}`}`); } }
          K.kitLoad(null, ''); K.KITDEAL.more = false;
          F.verdict(!bad.length && refused > 0 && (BROKEN || dealt > 100), '3000 SEEDED PRESSES with the deal on, teams of three and four, a squad kit put on every forty: row steps, values set outright and sets, on every card — the stored cards and the worn cards are never outside the rule, a refusal writes nothing, what the arrows promise (kitPeek) is what a press does and what his card then shows, and no press on one man moves another man\'s card as worn', `${presses} presses, ${refused} refused, ${dealt} made on dealt cards${bad.length ? ` · ${bad.slice(0, 4).join(' · ')}` : ''}`);
        } finally { WAND.on = wOn; WAND.mate = wMate; } }
      // off: the table's cards
      { const bad: string[] = []; for (const id of kits) for (const n of [3, 4]) { const r = put(id, n, false); if (things(r.cards[3]) + things(r.cards[4]) !== 0) bad.push(`${id} +${n}`); }
        F.verdict(!bad.length, 'the control, the switch OFF: every kit at three and four is worn as the table writes it, the Blue men with nothing counted', bad.join(' · ') || `${kits.length} kits as written`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function dealMore(): Promise<boolean> {
  const F = family('kitdeal-more: three or four as issued are lent a big tool each pair, and nobody comes with a gun alone');
  await kept(() => {
    try {
      K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.kitLoad(null, '');
      const kits = (K.kitLoadouts() as { id: string; name: string }[]).map(l => l.id);
      const putM = (id: string, n: number, more: boolean) => { K.KITDEAL.more = more; return put(id, n, true); };
      const bigsOf = (c: Card[], n: number) => c.slice(1, n + 1).map(m => K.bigOf(m)).join('/'), bigs = (n = 4) => bigsOf(worn(n), n), pouches = (c: Card[], n: number) => c.slice(1, n + 1).map(m => COUNTS.map(k => m[k]).join()).join('|');
      const fresh = (S: ReturnType<typeof memStore> | null = null) => { K.KITDEAL.on = false; K.kitLoad(S, ''); K.kitTeam(4); K.kitReset(); K.KITDEAL.on = true; K.KITDEAL.more = true; };
      // a tool each pair, as issued; no named kit is lent one
      { const bad: string[] = [], seen: string[] = [];
        for (const n of [1, 2, 3, 4]) { const off = putM('issued', n, false), on = putM('issued', n, true), want = n >= 3 ? ['none', 'shotgun', 'none', 'hammer'].slice(0, n).join('/') : Array(n).fill('none').join('/'), got = bigsOf(on.cards, n);
          if (got !== want || pouches(on.cards, n) !== pouches(off.cards, n) || on.stored !== off.stored || on.legal || on.is !== 'issued' || on.pool !== off.pool) bad.push(`+${n}: big slots ${got} (want ${want})${on.stored !== off.stored ? ', the table\'s cards moved' : ''}${on.legal ? `, ${on.legal}` : ''}${on.pool !== off.pool ? `, the squad ${off.pool} → ${on.pool}` : ''}, reads as ${on.is}`); seen.push(`+${n}: ${on.words}`); }
        for (const id of kits) if (id !== 'issued') for (const n of [3, 4]) { const off = putM(id, n, false), on = putM(id, n, true); if (bigsOf(on.cards, n) !== bigsOf(off.cards, n)) bad.push(`${id} +${n}: big slots ${bigsOf(on.cards, n)}`); }
        F.verdict(BROKEN || !bad.length, 'A TOOL EACH PAIR: as issued, of four Red Two wears the breaching shotgun and Blue Two the hammer — each pair\'s second man — and of three Red Two alone; every man\'s pouches are what the deal alone gave him, the squad counts what it counted, the worn cards are a legal fill, the table\'s cards are the cards they were and the kit reads As issued; one or two teammates wear no tool; no named squad kit is lent one', `${bad.join(' · ') || 'as said'} · ${seen.join(' · ')}${B}`); }
      // it reads as the issue
      { fresh(); const sets = [1, 2, 3, 4].map(i => K.kitPresetOf(i)), marked = [1, 2, 3, 4].filter(i => K.kitChanged(i)), issued = [2, 4].map(i => K.kitIssuedShown(i).big).join('/');
        F.verdict(BROKEN || (sets.every(x => x === 'issued') && !marked.length && issued === 'shotgun/hammer' && K.kitLoadoutOf() === 'issued'), 'IT IS THE ISSUE: of four, every worn card reads as the set As issued and none as changed, and what Red Two and Blue Two are issued for the big slot is the shotgun and the hammer', `sets ${sets.join(', ')} · marked changed: ${marked.map(i => NAMES[i]).join(', ') || 'nobody'} · issued big slots ${issued} · the squad kit reads ${K.kitLoadoutOf()}${B}`); }
      // another row changed at four: a lent tool is never written
      { const S = memStore(); fresh(S); const a = K.kitSet(2, 'suit', 'black'), b = K.kitSet(4, 'suit', 'black'), table = bigsOf(K.KIT.members, 4), kept4 = (JSON.parse(S.getItem(K.KIT_LS) ?? '{}').members as Card[] | undefined)?.slice(1).map(m => m.big).join('/'), four = bigs(4);
        K.kitTeam(2); const pair = `${bigs(2)} ${pool(2)}`; K.kitTeam(4);
        F.verdict(BROKEN || (a && b && table === 'none/none/none/none' && kept4 === 'none/none/none/none' && four === 'none/shotgun/none/hammer' && pair === 'none/none 3/2/2/0/0'), 'A LENT TOOL IS NEVER WRITTEN: with another row changed on the two men who wear one (their suits, of four), the table\'s cards and the store still hold empty big slots, the four still wear the tools, and a pair comes with none and the whole kit', `set ${a}, ${b} · the table ${table} · the store ${kept4} · worn of four ${four} · the pair ${pair}${B}`); }
      // a big thing put on by hand is his
      { fresh(); const a = K.kitSet(2, 'big', 'hammer'), four = bigs(4), table = bigsOf(K.KIT.members, 4), is = K.kitLoadoutOf(); K.kitTeam(2); const pair = bigs(2);
        F.verdict(BROKEN || (a && four === 'none/hammer/none/hammer' && table === 'none/hammer/none/none' && pair === 'none/hammer'), 'A BIG THING PUT ON BY HAND IS HIS: the hammer on Red Two (of four) is written on his card — he carries it at every size — and Blue Two still wears the one he is lent, unwritten', `set ${a} · worn of four ${four} · the table ${table} (reads ${is ?? 'a mix of your own'}) · the pair ${pair}${B}`); }
      // the tool taken off stays off; put back, the cards are the issue again
      { const S = memStore(); fresh(S); const off = K.kitSet(2, 'big', 'none'), four = bigs(4), is = K.kitLoadoutOf(), marked = K.kitChanged(2) as boolean, tableOff = bigsOf(K.KIT.members, 4); K.kitTeam(2); const pairOff = `${bigs(2)} ${pool(2)}`; K.kitTeam(3); const threeOff = pool(3); for (const n of [2, 4]) K.kitTeam(n); const stepped = bigs(4);
        K.kitLoad(S, ''); K.kitTeam(4); const read = bigs(4), on = K.kitSet(2, 'big', 'shotgun'), back = bigs(4), table = bigsOf(K.KIT.members, 4), is2 = K.kitLoadoutOf(); K.kitTeam(2); const pair = `${bigs(2)} ${pool(2)}`; K.kitTeam(4);
        K.kitSet(4, 'big', 'none'); const mid = bigs(4), why = K.kitLoadout('issued'), again = bigs(4); K.kitLoad(null, '');
        F.verdict(BROKEN || (off && four === 'none/none/none/hammer' && tableOff === 'none/none/none/none' && pairOff === 'none/none 3/2/2/0/0' && threeOff === '3/2/2/0/0' && is === null && marked && stepped === four && read === four && on && back === 'none/shotgun/none/hammer' && table === 'none/none/none/none' && is2 === 'issued' && pair === 'none/none 3/2/2/0/0' && mid === 'none/shotgun/none/none' && why === null && again === 'none/shotgun/none/hammer'), 'THE TOOL TAKEN OFF STAYS OFF: the shotgun stepped off Red Two (of four) leaves his slot empty and his card marked changed — through the size stepped away and back, and the same store read again — while Blue Two keeps his hammer, no card of the table holds a tool, and a pair and a three still carry the whole kit; put back by hand the cards are the issue again, in the table\'s layout with no tool written, and a pair carries the whole kit; the hammer taken off Blue Two comes back when As issued is pressed', `off ${off}: ${four} (reads ${is ?? 'a mix of your own'}, Red Two marked ${marked}; the table ${tableOff}; the pair ${pairOff}, three ${threeOff}) · stepped ${stepped} · read back ${read} · back on ${on}: ${back}, the table ${table}, reads ${is2} · the pair ${pair} · Blue Two's off: ${mid} · As issued: ${again}${B}`); }
      // a card pasted onto the man who wears a lent tool is the card he then wears: its empty big slot too
      { fresh(); const clip = { ...K.KIT.members[1] }, was = bigs(4), p = K.kitPaste(2, clip), four = bigs(4), wears = K.kitWears(2, clip), table = bigsOf(K.KIT.members, 4); K.kitTeam(2); const pair = bigs(2); K.kitTeam(4);
        const tool = { ...K.KIT.members[1], big: 'hammer' as const }, q = K.kitPaste(2, tool), four2 = bigs(4), table2 = bigsOf(K.KIT.members, 4); K.kitLoad(null, '');
        F.verdict(BROKEN || (was === 'none/shotgun/none/hammer' && p.ok && p.changed.includes('big') && four === 'none/none/none/hammer' && wears && table === 'none/none/none/none' && pair === 'none/none' && q.ok && four2 === 'none/hammer/none/hammer' && table2 === 'none/hammer/none/none'), 'A PASTE IS A CHANGE BY HAND: Red One\'s card (an empty big slot) pasted onto Red Two, of four, says the big slot moved and leaves him wearing none, as the copied card has it, with no tool written; a card with a hammer pasted on is written, his', `worn before ${was} · pasted ${p.ok} (${p.changed.join(' ') || 'nothing'}) · worn ${four}, wears the copy ${wears} · the table ${table} · a pair ${pair} · then the hammer card: ${q.ok}, worn ${four2}, the table ${table2}`); }
      // a counted thing changed: the cards are the player's own, and still no tool is written
      { const S = memStore(); fresh(S); const r = K.kitTry(1, 'bangs', -1), four = bigs(4), table = bigsOf(K.KIT.members, 4), kept4 = (JSON.parse(S.getItem(K.KIT_LS) ?? '{}').members as Card[] | undefined)?.slice(1).map(m => m.big).join('/'), is = K.kitLoadoutOf();
        const wand = WAND.on, mate = WAND.mate; WAND.on = WAND.mate = true; let wandOk = false, tableW = ''; try { wandOk = K.kitSet(2, 'wand', true); tableW = bigsOf(K.KIT.members, 4); K.kitSet(2, 'wand', false); } finally { WAND.on = wand; WAND.mate = mate; }
        K.kitTeam(2); const pair = bigs(2); K.kitTeam(4); K.KITDEAL.more = false; const offNow = bigs(4); K.KITDEAL.more = true; K.kitLoad(null, '');
        F.verdict(BROKEN || (r.ok && four === 'none/shotgun/none/hammer' && table === 'none/none/none/none' && kept4 === table && is === null && tableW === table && pair === 'none/none' && offNow === 'none/none/none/none'), 'A COUNTED THING CHANGED WRITES NO TOOL EITHER: a stun canister taken off Red One (of four) makes the cards the player\'s own, the two men still wear their tools, and neither the table\'s cards nor the store hold one — nor after a wand on Red Two; a pair of those cards carries no tool, and with the key put off the four wear none', `the change ${r.ok ? 'taken' : r.why} · worn ${four} · the table ${table} · the store ${kept4} (reads ${is ?? 'a mix of your own'}) · after a wand on Red Two (${wandOk}): ${tableW} · the pair ${pair} · the key off: ${offNow}${B}`); }
      // a card shows what every press of the big row said — a thing put on by hand and cleared is an empty slot
      { fresh(); const a = K.kitSet(2, 'big', 'hammer'), b = K.kitSet(2, 'big', 'none'), cleared = bigs(4), bad: string[] = [];
        for (const i of [2, 4]) for (const dir of [1, -1]) { fresh(); const n = ((K.kitRows(i) as { field: string; values: unknown[] }[]).find(x => x.field === 'big')?.values.length ?? 0) + 1; for (let k = 0; k < n; k++) { const t = K.kitTry(i, 'big', dir), shows = K.bigOf(K.kitShown(i)); if (!t.ok || t.value !== shows) bad.push(`${NAMES[i]} ${dir > 0 ? 'forward' : 'back'} step ${k + 1}: the press said ${t.ok ? t.value : t.why}, his card shows ${shows}`); } }
        F.verdict(BROKEN || (a && b && cleared === 'none/none/none/hammer' && !bad.length), 'WHAT A PRESS SAYS IS WHAT HIS CARD SHOWS: the hammer put on Red Two by hand and cleared again leaves his slot empty (no tool comes back unasked), and the Big slot row of Red Two and of Blue Two stepped right round, both ways, shows after every press the value that press gave', `hammer on ${a}, cleared ${b}: ${cleared} · ${bad.join(' · ') || 'every press as shown'}${B}`); }
      // cards that leave a named kit keep its empty slots
      { fresh(); const why = K.kitLoadout('quiet'), named = bigs(4), r = K.kitTry(1, 'bangs', -1), own = bigs(4), is = K.kitLoadoutOf(), back = K.kitTry(1, 'bangs', 1), again = K.kitLoadoutOf(), settled = bigs(4);
        F.verdict(BROKEN || (why === null && named === 'none/none/none/none' && r.ok && own === named && is === null && back.ok && again === 'quiet' && settled === named), 'CARDS THAT LEAVE A NAMED KIT KEEP ITS EMPTY SLOTS: under the Quiet kit of four nobody is lent a tool; a canister taken off Red One makes the cards the player\'s own and still nobody is; put back, the cards are the Quiet kit again', `Quiet ${named} · a canister off ${r.ok}: ${own} (reads ${is ?? 'a mix of your own'}) · put back ${back.ok}: reads ${again}, ${settled}${B}`); }
      // nobody comes with a gun alone
      { const bad: string[] = [], q: string[] = [];
        for (const id of kits) for (const n of [1, 2, 3, 4]) { const off = putM(id, n, false), on = putM(id, n, true), gain = n >= 3 ? off.bare.length : 0, stun = (r: typeof on) => +r.pool.split('/')[0];
          if (on.stored !== off.stored || on.legal || on.is !== id || (n >= 3 && on.bare.length) || stun(on) !== stun(off) + gain || on.pool.replace(/^\d+/, '') !== off.pool.replace(/^\d+/, '')) bad.push(`${id} +${n}: ${off.pool} → ${on.pool}, bare ${on.bare.map(i => NAMES[i]).join(', ') || 'nobody'}${on.legal ? `, ${on.legal}` : ''}, reads as ${on.is}`);
          if (id === 'quiet') q.push(`+${n}: ${on.pool} (${on.words})`); }
        const q0 = putM('quiet', 4, false), q4 = putM('quiet', 4, true);
        F.verdict(BROKEN || (!bad.length && q0.bare.join() === '4' && q0.pool === '3/0/0/0/0' && q4.pool === '4/0/0/0/0' && !q4.bare.length), 'NOBODY COMES WITH A GUN ALONE: under every kit a team of three or four has no man with nothing — the man the deal alone left bare is handed one stun canister, which the squad\'s count holds, and nothing else of the count moves; the Quiet kit of four carries four where it carried three and Blue Two his pistol only; the table\'s cards are the cards they were', `${bad.join(' · ') || 'as said'} · Quiet ${q.join(' · ')} · key off, of four: ${q0.pool}, bare ${q0.bare.map(i => NAMES[i]).join(', ')}${B}`); }
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
      const stage = async (file: string, squad: number, deal: boolean, o: { frames?: number; dealtFor?: number; block?: Record<string, Card>; /** the cards made the player's own first: a stun canister taken off Red One by hand */ own?: boolean; /** KITDEAL.more for this staging (off: the deal alone) */ more?: boolean; /** a squad kit put on first */ kit?: string; /** the big slot raised for this staging, whatever the stand (`more` raises it itself; every game stood up reads the stand's own again) */ big?: boolean } = {}) => {
        const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); if (o.block) (data.scenarios ??= {} as any).issue = { members: o.block } as any;
        ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0; NIGHTBREACH.squad = squad;
        const W: any = await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(data), seed: 5 })), g = W.game;
        K.KIT.on = true; K.SLOTS.on = true; K.ISSUE.on = true; if (o.more || o.big) K.BIGSLOT.on = true; K.KITDEAL.on = false; K.kitLoad(null, ''); K.kitTeam(4); K.kitReset(); K.KITDEAL.on = deal; K.KITDEAL.more = !!o.more; if (o.kit) K.kitLoadout(o.kit); if (o.dealtFor) K.kitTeam(o.dealtFor); if (o.own) K.kitTry(1, 'bangs', -1);
        const before = cards(), why = await hushed(() => g.roomClear.start(0)); await hushed(() => { for (let i = 0; i < (o.frames ?? 6); i++) W.step(1 / 60); });
        const men = g.orders.men('all', { down: true }) as any[];
        return { why, n: men.length, pool: `${g.doorTools.bangs} stun ${g.doorTools.charges} charges ${g.doorTools.frags} frags`, h: hashDigest(digestGame(g, true)) as string, before, worn: men.map(m => cardWords(K.kitOf(m) ?? {})).join(' | '), big: men.map(m => K.kitBig(m)).join('/'), row: (g.doorTools as any).bigRow === true };
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
        const mine = await stage('hall.json', 4, true, { own: true });
        F.verdict(BROKEN ? true : mine.n === 4 && mine.pool === out.pool && mine.worn === out.worn && !/nothing/.test(mine.worn), '… AND THE ISSUE IS NOBODY\'S OWN LAYOUT: with the cards changed by hand first (a stun canister taken off Red One, so the stored cards are the player\'s own) the same mission stages the same dealt issue — nobody of the four with nothing', `${mine.pool} · worn: ${mine.worn} · the cards untouched: ${out.worn}${B}`);
        // `more`: the tools are carried, the door tools have their row, the count is the count
        const c4 = await stage('pass.json', 4, true, { frames: 240, big: true }), t4 = await stage('pass.json', 4, true, { frames: 240, more: true }), t3 = await stage('pass.json', 3, true, { more: true }), t2 = await stage('pass.json', 2, true, { more: true, dealtFor: 4 });
        F.verdict(BROKEN || (t4.big === 'none/shotgun/none/hammer' && t3.big === 'none/shotgun/none' && t4.row && t4.pool === c4.pool && c4.big === 'none/none/none/none' && !c4.row && t2.big === 'none/none' && t2.pool === two0.pool), 'A TOOL EACH PAIR, STAGED (The pass, `more` on): of four, Red Two carries the breaching shotgun and Blue Two the hammer, of three Red Two alone; the squad\'s door tools then have the big slot\'s row and count what they counted; a pair staged after the screen stood on four carries no tool; with the key off nobody carried one and there was no row', `four ${t4.big} (row ${t4.row}, ${t4.pool}) · three ${t3.big} · the pair ${t2.big} (${t2.pool}) · key off: ${c4.big} (row ${c4.row}, ${c4.pool})${B}`);
        const h4 = await stage('hall.json', 4, true, { more: true });
        F.verdict(BROKEN || (h4.big === 'none/shotgun/none/hammer' && h4.pool === out.pool), 'A MISSION\'S OWN PLAIN ISSUE lends them too (the long hall, four): the same two tools, the same count', `${h4.big} · ${h4.pool} (was ${out.pool})${B}`);
        const q0 = await stage('pass.json', 4, true, { kit: 'quiet', big: true }), q = await stage('pass.json', 4, true, { kit: 'quiet', more: true });
        F.verdict(BROKEN || (/^4 stun /.test(q.pool) && /^3 stun /.test(q0.pool) && !/nothing/.test(q.worn) && q.big === 'none/none/none/none'), 'THE QUIET KIT OF FOUR, STAGED: every man has a canister, the door tools count four where they counted three, and nobody is lent a loud tool', `${q.pool} (key off: ${q0.pool}) · worn: ${q.worn} · big slots ${q.big}${B}`);
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
          const read = (deal: boolean, more = false) => {
            K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.KITDEAL.on = false; K.kitLoad(null, ''); K.kitTeam(4); K.kitReset(); K.KITDEAL.on = deal; K.KITDEAL.more = more;
            const m = list.find(x => x.id === 'pass-four'); if (!m) throw new Error('no mission \'pass-four\' on the list');
            const host = new El('DIV') as any, L = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { } }); up.push(L); L.setSquad(4);
            const root = L.root as unknown as El, slot = (i: number) => root.all(e => e.cls.has('lo-slot')).find(s => s.attrs['data-slot'] === String(i));
            const of = (i: number, c: string) => slot(i)?.all(e => e.cls.has(c))[0]?.textContent ?? '';
            L.pick(4); const rows4 = root.all(e => e.cls.has('kc-row')), big4 = rows4.find(r => r.attrs['data-field'] === 'big')?.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '', rows4Changed = rows4.filter(r => r.cls.has('changed')).map(r => r.attrs['data-field']);
            L.pick(3); const rows = root.all(e => e.cls.has('kc-row')), val = (f: string) => rows.find(r => r.attrs['data-field'] === f)?.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '';
            return { big: big4, rows4Changed, card: `charges '${val('charges')}' frags '${val('frags')}' stun '${val('bangs')}'`, rowsChanged: rows.filter(r => r.cls.has('changed')).map(r => r.attrs['data-field']), pouch: [1, 2, 3, 4].map(i => of(i, 'lo-pouch')), sum: [1, 2, 3, 4].map(i => of(i, 'lo-sum')), chips: [1, 2, 3, 4].map(i => slot(i)?.all(e => e.cls.has('lo-ic')).length ?? 0), changed: [1, 2, 3, 4].filter(i => slot(i)?.all(e => e.cls.has('lo-name'))[0]?.cls.has('changed')), pool: root.all(e => e.cls.has('lo-pool'))[0]?.textContent ?? '', kit: root.all(e => e.cls.has('lo-kits'))[0]?.all(e => e.cls.has('on')).map(b => b.textContent).join(',') ?? '' };
          };
          const off = read(false), on = read(true);
          F.verdict(on.pouch.every(p => /^pouches [1-4] \/ 4$/.test(p)) && on.pool === off.pool && /3 stun · 2 charges · 2 frags/.test(on.pool), 'THE PASS, FOUR, AS ISSUED: every teammate on the roster has something in his pouches, and the squad\'s line reads the count it read', `pouches ${on.pouch.join(' · ')} · ${on.pool}${B}`);
          F.verdict(on.changed.length === 0 && /as issued/i.test(on.kit) && on.rowsChanged.length === 0 && (BROKEN || on.card !== off.card), 'no worn card is marked as changed, the squad kit row still lights As issued, and Blue One\'s own card shows his share with no tile marked', `marked changed: ${on.changed.map(i => NAMES[i]).join(', ') || 'nobody'} · lit: ${on.kit} · Blue One's card: ${on.card} (the switch off: ${off.card}) · tiles marked: ${on.rowsChanged.join(', ') || 'none'}${B}`);
          F.verdict(off.pouch[2] === 'pouches 0 / 4' && off.pouch[3] === 'pouches 0 / 4', 'the control, the switch off: the Blue men\'s pouches read empty, as the shot of the screen showed', `pouches ${off.pouch.join(' · ')} · Blue One: ${off.sum[2]}`);
          const lent = read(true, true);
          F.verdict(BROKEN || (/hammer/i.test(lent.big) && !/hammer/i.test(on.big) && lent.changed.length === 0 && lent.rowsChanged.length === 0 && lent.rows4Changed.length === 0 && /as issued/i.test(lent.kit) && lent.pool === on.pool && lent.pouch.join() === on.pouch.join()), 'A TOOL EACH PAIR ON THE SCREEN (`more` on): Blue Two\'s Big slot tile reads the hammer, no tile of his or of Blue One\'s and no man is marked changed, As issued is still lit, and every pouch line and the squad\'s line read as they did', `Blue Two's big slot: '${lent.big}' (key off: '${on.big}') · marked: ${lent.changed.map(i => NAMES[i]).join(', ') || 'nobody'}, tiles ${[...lent.rowsChanged, ...lent.rows4Changed].join(', ') || 'none'} · lit: ${lent.kit} · pouches ${lent.pouch.join(' · ')}${B}`);
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
      const env = process.env.TPS_KITDEAL, W: any = await hushed(() => standUp()), g = W.game, stood = K.KITDEAL.on as boolean, more0 = K.KITDEAL.more as boolean;
      const want = STAND === 'frozen' ? env === '1' : env === undefined ? true : env === '1';
      F.verdict(stood === want, `the ${STAND} stand stands a game up with the switch ${want ? 'ON' : 'OFF'}${env !== undefined ? ` (TPS_KITDEAL=${env})` : STAND === 'frozen' ? ' (held off: TPS_KITDEAL=1 raises it)' : ' (as the page opens: TPS_KITDEAL=0 holds it off)'}`, `KITDEAL.on after the stand-up: ${stood}`);
      const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], KN = await import(`${ROOT}/src/game/knobs.ts`), R = KN.knobRegistry(), JN = (KN.JOURNAL_KNOBS as readonly string[]).includes('KITDEAL');
      F.verdict(s.includes('TPS_KITDEAL') && String(FROZEN_HOLDS['KITDEAL.on']).startsWith('TPS_KITDEAL=1') && R.KITDEAL === K.KITDEAL && JN, 'the switch is a row of the two stands\' list, has its word, is in the knob registry and among the tables a recording carries', `STAND_ENV ${s.includes('TPS_KITDEAL')} · FROZEN_HOLDS ${FROZEN_HOLDS['KITDEAL.on']} · registry ${R.KITDEAL === K.KITDEAL} · JOURNAL_KNOBS ${JN}`);
      const JR = await import(`${ROOT}/src/game/journal.ts`);
      K.KITDEAL.on = true; const own = JR.knobsSnapshot(g), carried = (own.tables as any).KITDEAL?.on, old = JR.knobsSnapshot(g); delete (old.tables as any).KITDEAL;
      await hushed(() => JR.applyKnobs(g, old)); const without = K.KITDEAL.on as boolean;
      await hushed(() => JR.applyKnobs(g, own)); const withIt = K.KITDEAL.on as boolean;
      { K.KITDEAL.more = true; const full = JR.knobsSnapshot(g), o2 = JR.knobsSnapshot(g), had = (o2.tables as any).KITDEAL?.more; delete (o2.tables as any).KITDEAL.more; await hushed(() => JR.applyKnobs(g, o2)); const before = K.KITDEAL.more as boolean; await hushed(() => JR.applyKnobs(g, full)); const again = K.KITDEAL.more as boolean;
        const src = readFileSync(resolve(ROOT, 'src/host/profile.ts'), 'utf8');
        const envM = process.env.TPS_KITMORE, wantM = STAND === 'frozen' ? envM === '1' : envM === undefined ? true : envM === '1';
        F.verdict(more0 === wantM && s.includes('TPS_KITMORE') && String(FROZEN_HOLDS['KITDEAL.more']).startsWith('TPS_KITMORE=1') && had === true && before === false && again === true && /KITDEAL\.more = !q\.has\('nokitmore'\)/.test(src), `THE KEY \`more\` is a switch of its own: the ${STAND} stand stands a game up with it ${wantM ? 'ON' : 'OFF'}, it has its word and its row of the two stands' list, a recording carries it, one whose KITDEAL table has no such key replays with it OFF (the deal alone), and the page puts it off with ?nokitmore`, `KITDEAL.more after the stand-up: ${more0} · STAND_ENV ${s.includes('TPS_KITMORE')} · FROZEN_HOLDS ${FROZEN_HOLDS['KITDEAL.more']} · the snapshot says ${had} · applied without the key: ${before} · with its own: ${again}`); }
      F.verdict(carried === true && without === false && withIt === true, 'a recording made with the switch on carries it and replays with it on; one from before the table replays with it OFF', `the snapshot's table says ${carried} · applied with no KITDEAL table: ${without} · applied with its own: ${withIt}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

if (import.meta.main) {
  let ok = true;
  for (const f of [dealCards, dealMore, dealRun, dealScreen, dealStands]) ok = (await f()) && ok;
  process.exit(ok ? 0 : 1);
}
