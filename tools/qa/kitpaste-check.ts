// COPY AND PASTE FOR LOADOUTS (src/game/kit.ts kitPasteCard / kitPastePeek / kitPaste / kitWears; the two buttons and the keys are ui/kitCard.ts's), headless:
//   bun run tools/qa/kitpaste-check.ts [fit|cases]      (KITPASTE_BREAK=1 = a paste writes the copied card as it is, unfitted and unasked: must FAIL)
// The maintainer, 10-15: "we should have copy and paste for loadouts".
//   fit     squads made by the tiles' own steps under a seed, every way the card's rules stand (the pouches rule, the big slot, your own charges with the
//           wand and the sticky cameras — each on and off), and every man's card pasted onto every man's: the squad is still a legal one, every row of
//           the card pasted onto holds a value its own tile offers (or, where it could not show the copied value at all, what it held), a count is the
//           copied one or his tile's most, the man's colours and every field his
//           card has no tile for are as they were, nobody else's card moved, the copied card did not, `changed` names the tiles that moved, a second
//           paste moves nothing (he wears it), and the store is written once for a paste that moved a tile and not at all for one that moved none
//   cases   by name, with the big slot on: a shield man onto you (no shield for you: your big slot keeps what it held), your own card copied and
//           pasted back with the pouches rule off (nothing moves), you onto a teammate (his row's most, no
//           launcher round, wand or camera), a teammate onto you (your launcher rounds go: his card carries none), a pistol card onto you, colours kept,
//           and under a table with a squad limit a paste the squad has no room for is refused with the reason and nothing is written
// Run it on both stands (plain, and TPS_PROFILE=shipped): it sets every switch it reads itself, puts them back, and says which stand it ran on.
// Nothing here looks at the page: the buttons, the keys and the roster's marks are tools/qa/kitpaste-page.cjs's.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { STICKY } = await import(`${ROOT}/src/game/stickycam.ts`);
const { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`);
const { SHIELD } = await import(`${ROOT}/src/game/shield.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const J = (o: unknown) => JSON.stringify(o);
const STAND = harnessProfile() as string, BROKEN = process.env.KITPASTE_BREAK === '1';
const N = K.KIT_MEMBERS as number;
const memStore = () => { const m = new Map<string, string>(); const S = { writes: 0, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { S.writes++; m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; return S; };
const rows = (i: number): any[] => K.kitRows(i);
const cards = (): any[] => K.KIT.members.map((m: any) => ({ ...m }));
/** the fields of a card a paste onto member i may write: his tiles' own, and what a tile of several fields is made of (the big slot's three; your cans'
 *  two; the launcher's rounds and cameras, which go home with the rifle) */
function writable(i: number): Set<string> {
  const w = new Set<string>();
  for (const r of rows(i)) { w.add(r.field); if (r.field === 'big') { w.add('walls'); w.add('shield'); } if (r.field === 'cans') { w.add('smoke'); w.add('bangs'); } if (r.field === 'weapon' && i === 0) { w.add('shells'); w.add('cams'); } }
  w.delete('suit'); w.delete('trim'); return w;
}
/** the kit table, its rules and the switches this check moves, as they stood, put back after `fn` (the store the table writes to is left on nothing) */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const was = cards(), on = K.KIT.on, slots = K.SLOTS.on, big = K.BIGSLOT.on, wand = WAND.on, sticky = STICKY.on, own = OWNCHARGE.on, plate = SHIELD.on, team = K.kitTeam(), table = JSON.parse(readFileSync(resolve(ROOT, 'src/game/slots.json'), 'utf8'));
  try { return await fn(); } finally { K.slotsSet(table); K.kitLoad(null, ''); WAND.on = wand; STICKY.on = sticky; OWNCHARGE.on = own; SHIELD.on = plate; K.BIGSLOT.on = big; K.SLOTS.on = slots; K.KIT.on = on; K.kitTeam(team); for (let i = 0; i < N; i++) K.KIT.members[i] = was[i]; }
}
/** the rules put one way, the cards as issued, a store that counts its writes under the table */
function stand(o: { slots: boolean; big: boolean; extras: boolean }) {
  WAND.on = STICKY.on = OWNCHARGE.on = o.extras; K.BIGSLOT.on = o.big;
  SHIELD.on = true;   // (the shield in the game, as the cases below ask of it: the page has it out — shield.ts — and run by itself on the shipped stand this check read a shield man's card as a card with an empty big slot; the probe runner held it up, the check did not)
  const store = memStore(); K.kitLoad(store, o.slots ? '' : '?noslots'); K.BIGSLOT.on = o.big; K.kitTeam(N - 1); K.kitReset(); store.writes = 0;
  return store;
}

// ───────────────────────────────────────────────────────────── fit
export async function pasteFit(): Promise<boolean> {
  const F = family('kitpaste-fit: any man\'s card pasted onto any man\'s is a card his own tiles could have made, and the squad is still a legal one');
  await kept(() => {
    const SEEDS = 40;
    for (const slots of [true, false]) for (const big of [true, false]) for (const extras of [true, false]) {
      const store = stand({ slots, big, extras }), bad: string[] = []; let pastes = 0, moved = 0, refused = 0, clamped = 0, dropped = 0;
      const say = (s: string) => { if (bad.length < 6) bad.push(s); else if (bad.length === 6) bad.push('…'); };
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rnd = seeded(0x9e37 + seed * 7919); K.kitReset();
        for (let k = 0; k < 90; k++) { const i = Math.floor(rnd() * N), R = rows(i), r = R[Math.floor(rnd() * R.length)]; K.kitTry(i, r.field, rnd() < 0.65 ? 1 : -1); }   // (a squad the tiles made: legal by the tiles' own rule)
        if (slots && K.kitLegal()) { say(`seed ${seed}: the tiles' own steps left an illegal squad (${K.kitLegal()}) — not this check's to judge`); continue; }
        const squad = cards();
        for (let from = 0; from < N; from++) for (let to = 0; to < N; to++) {
          for (let i = 0; i < N; i++) K.KIT.members[i] = { ...squad[i] };
          const clip = { ...squad[from] }, clip0 = J(clip), before = cards(), W = writable(to), w0 = store.writes, at = `seed ${seed}, ${from} onto ${to}`;
          const r = K.kitPaste(to, clip); pastes++;
          const after = cards(), wrote = store.writes - w0, diff = rows(to).filter(x => K.rowGet(x, before[to]) !== K.rowGet(x, after[to])).map(x => x.field as string);
          if (J(clip) !== clip0) say(`${at}: the copied card itself was written to`);
          for (let i = 0; i < N; i++) if (i !== to && J(after[i]) !== J(before[i])) say(`${at}: member ${i}'s card moved`);
          if (!r.ok) { refused++; if (!r.why) say(`${at}: refused with no reason`); if (J(after[to]) !== J(before[to]) || wrote) say(`${at}: refused, yet written`); continue; }
          if (slots && K.kitLegal()) say(`${at}: the squad is not legal — ${K.kitLegal()}`);
          for (const x of rows(to)) { const v = K.rowGet(x, after[to]), src = K.rowGet(x, clip);
            const was = K.rowGet(x, before[to]);
            if (!x.values.includes(v) && v !== was) say(`${at}: his '${x.field}' tile reads ${J(v)}, which it does not offer (${x.values.join('/')}) and did not hold`);
            if (x.field === 'suit' || x.field === 'trim') continue;
            if (typeof v === 'number' && typeof src === 'number') { const most = Math.max(...x.values as number[]), want = Math.min(src, most);
              if (x.field === 'shells' || x.field === 'cams' ? v > want : v !== want) say(`${at}: '${x.field}' is ${v}, the copied card has ${src} and his tile's most is ${most}`);
              if (v < src) clamped++; }
            else if (x.values.includes(src) ? v !== src : (dropped++, v !== was)) say(`${at}: '${x.field}' reads ${J(v)} for a copied ${J(src)}, and held ${J(was)}`); }
          if (after[to].suit !== before[to].suit || after[to].trim !== before[to].trim) say(`${at}: his colours changed`);
          for (const k of Object.keys(after[to])) if (!W.has(k) && J(after[to][k]) !== J(before[to][k])) say(`${at}: '${k}', which his card has no tile for, went from ${J(before[to][k])} to ${J(after[to][k])}`);
          if (J([...r.changed].sort()) !== J([...diff].sort())) say(`${at}: changed says ${r.changed.join(' ') || 'nothing'}, the tiles that moved are ${diff.join(' ') || 'none'}`);
          if (wrote !== (diff.length ? 1 : 0)) say(`${at}: the store was written ${wrote} times for ${diff.length} tiles moved`);
          if (diff.length) moved++;
          if (!K.kitWears(to, clip)) say(`${at}: pasted, and he does not wear it`);
          if (from === to && diff.length) say(`${at}: his own card pasted back onto him moved ${diff.join(' ')}`);
          const w1 = store.writes, again = K.kitPaste(to, clip); if (!again.ok || again.changed.length || store.writes !== w1 || J(K.KIT.members[to]) !== J(after[to])) say(`${at}: a second paste moved ${again.changed.join(' ') || 'something'}`);
        }
      }
      F.verdict(!bad.length && pastes === SEEDS * N * N, `pouches rule ${slots ? 'on' : 'off'}, big slot ${big ? 'on' : 'off'}, own charges / wand / cameras ${extras ? 'on' : 'off'}: every paste leaves a legal squad and a card of the man's own tiles`,
        `${pastes} pastes over ${SEEDS} seeded squads · ${moved} moved a tile, ${refused} refused · ${clamped} counts brought down to a tile's most, ${dropped} tiles that cannot show the copied value left as they were${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
    }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── cases
export async function pasteCases(): Promise<boolean> {
  const F = family('kitpaste-cases: what a paste carries over, by name');
  await kept(() => {
    const put = (i: number, o: Record<string, unknown>) => { K.KIT.members[i] = { ...K.kitDefault(i), ...o }; };
    { const store = stand({ slots: true, big: true, extras: true });
      put(3, { shield: true, charges: 2, bangs: 1 }); put(0, { big: 'hammer' });
      const r = K.kitPaste(0, { ...K.KIT.members[3] }), you = K.KIT.members[0];
      F.verdict(r.ok && you.shield === false && K.bigOf(you) === 'hammer' && you.charges === 2 && you.bangs === 1 && you.shells === 0 && !K.kitLegal(),
        'a shield man onto you: his counts are yours, the shield is not (it is no tile of yours) and your big slot keeps the hammer it held', `you: ${J(you)} · legal: ${K.kitLegal() ?? 'yes'}`);
      // … and with the shield out of the game (the page as it opens): his card's shield is nothing, so what is copied is a card with an empty big slot, and yours is emptied as any paste of one would
      { SHIELD.on = false; K.kitReset(); put(3, { shield: true, charges: 2, bangs: 1 }); put(0, { big: 'hammer' });
        const o = K.kitPaste(0, { ...K.KIT.members[3] }), y = K.KIT.members[0]; SHIELD.on = true;
        F.verdict(o.ok && y.shield === false && K.bigOf(y) === 'none' && y.charges === 2 && y.bangs === 1 && !K.kitLegal(), 'the same paste with the shield out of the game: the copied card\'s big slot is empty, so yours is emptied with it (no shield comes, and no row of yours is left unasked)', `you: ${J(y)} · legal: ${K.kitLegal() ?? 'yes'}`); }
      K.kitReset(); put(0, { smoke: 3, bangs: 0, frags: 0, shells: 1, wand: false, cams: 0 }); put(2, {});
      const smokeMost = Math.max(...(rows(2).find(x => x.field === 'smoke')?.values ?? [0]) as number[]);
      const r2 = K.kitPaste(2, { ...K.KIT.members[0] }), mate = K.KIT.members[2];
      F.verdict(r2.ok && mate.smoke === Math.min(3, smokeMost) && mate.shells === 0 && mate.wand === false && mate.cams === 0 && mate.bangs === 0 && mate.frags === 0 && !K.kitLegal(),
        `you onto a teammate: three smoke come down to his tile's most (${smokeMost}), and no launcher round, wand or camera rides along`, `Red Two: ${J(mate)} · legal: ${K.kitLegal() ?? 'yes'}`);
      K.kitReset(); put(1, { bangs: 2, charges: 1, frags: 1, big: 'shotgun' });
      const r3 = K.kitPaste(0, { ...K.KIT.members[1] }), y3 = K.KIT.members[0];
      F.verdict(r3.ok && y3.bangs === 2 && y3.charges === 1 && y3.frags === 1 && y3.big === 'shotgun' && y3.shells === 0 && y3.smoke === 0 && y3.suppressed && y3.light && y3.nvg && !K.kitLegal(),
        'a teammate onto you: his four pouches and his shotgun, and none of your launcher rounds or smoke (his card carries none)', `you: ${J(y3)}`);
      K.kitReset(); put(4, { weapon: 'pistol', suppressed: true, light: false }); put(0, { shells: 1, smoke: 1, bangs: 1, frags: 1 });
      const r4 = K.kitPaste(0, { ...K.KIT.members[4] }), y4 = K.KIT.members[0];
      F.verdict(r4.ok && y4.weapon === 'pistol' && y4.shells === 0 && y4.light === true && !K.kitLegal(), 'a pistol card onto you: the pistol, and the launcher\'s rounds stay home with the rifle; your light is not a tile and stays', `you: ${J(y4)}`);
      K.kitReset(); put(1, { bangs: 3, charges: 0, frags: 1, suit: 'black', trim: 'red' }); put(2, { suit: 'olive', trim: 'blue' }); const w0 = store.writes;
      const r5 = K.kitPaste(2, { ...K.KIT.members[1] }), m5 = K.KIT.members[2];
      F.verdict(r5.ok && m5.bangs === 3 && m5.suit === 'olive' && m5.trim === 'blue' && store.writes - w0 === 1 && !r5.changed.includes('suit') && !r5.changed.includes('trim'),
        'colours are kept: the kit goes over, the suit and the trim stay the man\'s own, in one write of the store', `Red Two: bangs ${m5.bangs}, ${m5.suit} / ${m5.trim} · changed ${r5.changed.join(' ')} · ${store.writes - w0} write`);
      F.verdict(K.kitWears(2, K.KIT.members[1]) && !K.kitWears(3, K.KIT.members[1]) && K.kitPastePeek(3, K.KIT.members[1]).why === '', 'he wears it once pasted (whatever his colours); a man who does not is not said to', `Red Two wears Red One's: ${K.kitWears(2, K.KIT.members[1])} · Blue One: ${K.kitWears(3, K.KIT.members[1])}`);
    }
    { const store = stand({ slots: false, big: true, extras: true });
      put(0, { smoke: 2, bangs: 1 }); const mine = { ...K.KIT.members[0] }, wears = K.kitWears(0, mine), r = K.kitPaste(0, mine), w = store.writes;
      put(2, { bangs: 3 }); const r2 = K.kitPaste(0, { ...K.KIT.members[2] }), you = K.KIT.members[0];
      F.verdict(wears && r.ok && !r.changed.length && w === 0 && r2.ok && you.smoke === 2 && you.bangs === 1,
        'the pouches rule off, your cans a split of your own (2 smoke, 1 stun): your own card copied and pasted back moves nothing, and a teammate\'s card leaves your cans as they were (the one row cannot show his counts)', `wears own copy ${wears} · changed ${r.changed.join(' ') || 'nothing'} · after a teammate's: smoke ${you.smoke}, stun ${you.bangs}`);
    }
    { const store = stand({ slots: true, big: true, extras: true });
      const table = JSON.parse(readFileSync(resolve(ROOT, 'src/game/slots.json'), 'utf8')); table.squad.pouches = 7;
      const why0 = K.slotsSet(table); K.kitReset(); store.writes = 0;
      const before = J(K.KIT.members), r = K.kitPaste(3, { ...K.KIT.members[1] }), why = K.kitPastePeek(3, K.KIT.members[1]).why;
      F.verdict(why0 === null && !r.ok && /squad/.test(r.why) && why === r.why && J(K.KIT.members) === before && store.writes === 0 && !K.kitLegal(),
        'under a table with a squad limit of seven pouches (all of them issued): Red One\'s card onto Blue One is refused, the reason says the squad has no room, nothing is written', `table: ${why0 ?? 'taken'} · paste: ${r.ok ? 'TAKEN' : r.why} · writes ${store.writes}`);
    }
  });
  return F.done();
}

export async function kitpasteCheck(only?: string): Promise<boolean> {
  console.log(`kitpaste-check on the ${STAND.toUpperCase()} stand (it sets the card's rules itself, each way)${BROKEN ? ' — KITPASTE_BREAK=1: a paste writes the copied card unfitted, the lines below must FAIL' : ''}`);
  let ok = true;
  const parts: [string, () => Promise<boolean>][] = [['fit', pasteFit], ['cases', pasteCases]];
  for (const [name, fn] of parts) if (!only || only === name) ok = (await fn()) && ok;
  console.log(`\nkitpaste-check (${STAND} stand): ${ok ? 'ALL PASS' : 'FAILED'}`);
  return ok;
}
if (import.meta.main) { const ok = await kitpasteCheck(process.argv[2]); process.exit(ok ? 0 : 1); }
