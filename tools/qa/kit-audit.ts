// WHO CARRIES WHAT, ON EVERY MISSION (a listing, not a check: it always exits 0).
//
//   bun run tools/qa/kit-audit.ts            (markdown on stdout; --deal=off prints the cards of the build before the deal — src/game/kit.ts KITDEAL — and --more=off those of the deal alone, before its key `more`)
//
// The squad's kit is ONE table for every level (src/game/kit.ts ISSUED, src/game/slots.json's named kits): a level changes it only by carrying a block of
// its own (`scenarios.issue.members`) or wall charges of its own (`scenarios.roomClear.wallCharges`). So this prints the table once — every squad kit at
// every team size, each man's pouches, who comes with nothing — and then one row a mission with what its level adds or asks: the sizes it offers, whether
// the cards can be changed there, its own issue, its locked and steel doors against the charges the squad brings, and whether frags can be ordered at all
// (never with a hostage, the man a snatch came for, or a civilian in the blast: src/game/squadthrow.ts). A level's author reads his row.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './headless.ts';
import { cardWords, comesBare } from './kitdeal-check.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { squadChoices, rosterOf } = await import(`${ROOT}/src/game/loadout.ts`);
const { OFFICE_SCENARIOS } = await import(`${ROOT}/levels/office.scenarios.ts`) as { OFFICE_SCENARIOS: any };

const DEAL = !process.argv.includes('--deal=off'), MORE = DEAL && !process.argv.includes('--more=off');
type Card = Record<string, any>;
const MEN = ['You', 'Red One', 'Red Two', 'Blue One', 'Blue Two'];   // (the cards by the four's names: a level's issue block names cards)
/** card i of a team of n by the name the roster calls him (game/loadout.ts rosterOf: one or two teammates are 'Blue One', 'Blue Two', on cards 1 and 2) */
const man = (n: number, i: number): string => (i === 0 ? 'You' : rosterOf(n)[i - 1]?.name ?? MEN[i]);
const line = (m: Card) => cardWords(m).replace(/ \+ /g, ', ').replace(/^nothing$/, '**nothing**');

K.KIT.on = true; K.SLOTS.on = true; K.BIGSLOT.on = true; K.KITDEAL.more = MORE; K.kitLoad(null, '');   // (the page's stand for these rows: the pouches rule and the big slot on)
const kits = K.kitLoadouts() as { id: string; name: string }[];
const out: string[] = [];
out.push(`# Who carries what`, '', `The squad's kit dealt over the men who come: **${DEAL ? 'on' : 'off'}**. Pouches are out of four a man; ${MORE ? 'of three or four as issued, Red Two is lent the breaching shotgun and, of four, Blue Two the hammer for the big slot (a pair is issued neither)' : 'nobody is issued anything for his big slot'}.`, '');
out.push('## Every squad kit at every team size', '', '| Squad kit | Team | Squad carries (stun / charges / frags / smoke / wall) | Each teammate (pouches used) | Comes with nothing |', '|---|---|---|---|---|');
const bareAt: Record<string, string[]> = {};
for (const L of kits) for (const n of [1, 2, 3, 4]) {
  K.KITDEAL.on = DEAL; K.kitTeam(n); const why = K.kitLoadout(L.id) as string | null, P = K.kitPool(n), W = K.kitWorn(n) as Card[];
  const who = Array.from({ length: n }, (_x, k) => k + 1), bare = who.filter(i => comesBare(i, W[i])).map(i => man(n, i));
  if (bare.length) (bareAt[L.name] ??= []).push(`+${n}: ${bare.join(', ')}`);
  out.push(`| ${L.name} | +${n} | ${why ?? `${P.bangs} / ${P.charges} / ${P.frags} / ${K.kitSmokes(n)} / ${K.kitWalls(n)}`} | ${who.map(i => `${man(n, i)}: ${line(W[i])} (${K.kitCost(i, W[i]).used})`).join(' · ')} | ${bare.join(', ') || 'nobody'} |`);
}
out.push('', '## Every mission', '', '| Mission | Kind | Its own team | Sizes offered | Cards on Team & kit | The level\'s own kit | Doors: locked / steel of all | Frags on order | Kit picture placed |', '|---|---|---|---|---|---|---|---|---|');
const notes: string[] = [];
K.kitTeam(1); K.kitLoadout('issued'); const partner = line(K.KIT.members[1]);   // (one man alone, as issued)
for (const s of ALL_MISSIONS as any[]) {
  const file = s.level ?? 'office.json', d = JSON.parse(readFileSync(resolve(ROOT, 'levels', file), 'utf8')), sc = d.scenarios ?? (file === 'office.json' ? OFFICE_SCENARIOS : {}), rc = sc.roomClear ?? {}, doors: any[] = d.doors ?? [];   // (the office's block is levels/office.scenarios.ts, attached at load)
  const sizes = (squadChoices(s) as { n: number; ok: boolean }[]).filter(c => c.ok).map(c => (c.n ? `+${c.n}` : 'alone')).join(' ');
  const block = sc.issue?.members as Record<string, Card> | undefined;
  const own = [block ? `issue block: ${Object.entries(block).map(([i, c]) => `${MEN[+i]} ${JSON.stringify(c)}`).join('; ')}${!Object.keys(block).length ? '(names nobody: every man in the plain issue)' : ''}` : '', typeof rc.wallCharges === 'number' && rc.wallCharges > 0 ? `${rc.wallCharges} wall charge${rc.wallCharges === 1 ? '' : 's'} of its own` : ''].filter(Boolean).join(' · ') || 'none';
  const cards = s.group === 'training' ? 'none: a lesson is played as issued' : block ? 'none: the mission issues its own' : s.kind === 'quiet' && s.squad === 0 ? 'yours' : 'all who come';
  const locked = doors.filter(x => x.locked).length, steel = doors.filter(x => x.steel).length;
  const noFrag = s.kind === 'rescue' ? 'refused near a hostage' : sc.snatch || rc.snatch || /snatch/.test(s.id) ? 'refused near the man you came for' : (d.civilians ?? sc.civilians)?.length ? 'refused near a civilian' : 'yes';
  const ways = Math.max(1, (s.ways ?? []).length), kv = (sc.kitView?.ways ?? []).length;
  out.push(`| ${s.title}${s.offList ? ' (off the list)' : ''} | ${s.kind} | ${s.squad ? `+${s.squad}` : 'alone'} | ${sizes} | ${cards} | ${own} | ${locked} / ${steel} of ${doors.length} | ${noFrag} | ${kv >= ways ? 'yes' : kv ? `${kv} of ${ways} ways in` : 'no'} |`);
  if (s.kind === 'rescue') notes.push(`${s.title}: the two frags of the issued kit cannot be ordered into a room with a hostage in it.`);
  if (locked > 2 && s.kind !== 'quiet') notes.push(`${s.title}: ${locked} locked doors and two door charges as issued; the rest are the pick's, the boot's or a big-slot tool's${MORE ? ': of three or four as issued Red Two carries the breaching shotgun and, of four, Blue Two the hammer; a pair is issued neither' : ', and nobody is issued one'}.`);
  if (steel) notes.push(`${s.title}: ${steel} steel door${steel === 1 ? '' : 's'}: no hammer or shotgun opens one.`);
  if (s.kind === 'quiet' && s.squad > 0 && s.group !== 'training') notes.push(`${s.title}: a quiet mission whose partner comes as issued, with ${partner} on his card.`);
}
out.push('', '## Read off the two tables', '');
for (const [kit, at] of Object.entries(bareAt)) out.push(`- ${kit}: a man comes with nothing at ${at.join('; ')}.`);
if (!Object.keys(bareAt).length) out.push('- No kit leaves a man who comes with nothing.');
for (const n of notes) out.push(`- ${n}`);
console.log(out.join('\n'));
