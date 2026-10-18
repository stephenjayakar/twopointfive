// THE BALLISTIC SHIELD IS GONE FROM THE GAME (the maintainer, 10-15: "we should also probably just get rid of the ballistic shield, doesn't match the vibes
// (feels more like swat)", and 10-18: "we should just remove the riot shield"). It was a switch from 10-15 to 10-18 (in on the frozen stand, out of the page);
// now there is no module, no table, no word and no row. What this holds, headless:
//   bun run tools/qa/noshield-check.ts [gone|card|staged|tape]      (NOSHIELD_BREAK=1 = the check is lied to — a shield value on the big row, a shield tape
//                                                                    waved through: the card and tape lines must FAIL)
//   gone    no shield module under src/game; no SHIELD table in the knob registry or among the tables a recording carries; no TPS_SHIELD among the stands'
//           words and no SHIELD row of the two stands' list; the word in the environment changes nothing a card offers; the kit table has no shield tool
//   card    the big slot on and off, the pouches on and off: no card has a Shield row, no big row offers one, a hand that sets one is refused; a STORED card
//           that says shield loads as a card without one (his own gun, the rest of the card kept, no word of one, a legal kit) and the next change writes the
//           store without the word; the same card PASTED; the squad kit that carried one is not on the list and cannot be put on
//   staged  the long hall (its issue block handed the first teammate the shield) stages every man on the plain issue, nobody with a pistol for his gun; no
//           level file names one, and a level whose issue card still does is REFUSED with the reason in words; no mission's words say shield
//   tape    what was recorded with one: an F10 session's knobs (the SHIELD table among them) apply without a throw and make no table — such a file LOADS,
//           and where a shield man was in it the replay parts from the file's own digests and says at which frame, as for any file the build has moved past
//           (the file does not say who carried what: nothing to refuse it by); an F7 run tape made with one is refused in words before a re-run (the map
//           viewer plays its samples as ever), and a tape made without is not
// The same lines on either stand (plain, and TPS_PROFILE=shipped): there is no switch left for them to differ in. Nothing here looks at a picture.
import { resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o);
const STAND = harnessProfile() as string, BROKEN = process.env.NOSHIELD_BREAK === '1', B = BROKEN ? ' · NOSHIELD_BREAK=1' : '';
const memStore = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
const fields = (i: number): string[] => K.kitRows(i).map((r: any) => r.field as string);
const rowOf = (i: number, f: string) => K.kitRows(i).find((r: any) => r.field === f);
/** what a man's big row offers (NOSHIELD_BREAK: the lie — a shield among them, as the build before offered it) */
const bigVals = (i: number): string[] => { const v = ((rowOf(i, 'big')?.values ?? []) as string[]).slice(); return BROKEN && v.length ? [...v, 'shield'] : v; };
/** the kit table and its switches put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = K.KIT.on, big = K.BIGSLOT.on, rule = K.SLOTS.on, issue = K.ISSUE.on, word = process.env.TPS_SHIELD;
  try { return await fn(); } finally { K.kitLoad(null, ''); K.SLOTS.on = rule; K.BIGSLOT.on = big; K.KIT.on = on; K.ISSUE.on = issue; for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; if (word === undefined) delete process.env.TPS_SHIELD; else process.env.TPS_SHIELD = word; }
}

export async function noshieldGone(): Promise<boolean> {
  const F = family('noshield-gone: no module, no table, no word, no row');
  await kept(async () => {
    try {
      const file = existsSync(resolve(ROOT, 'src', 'game', 'shield.ts'));
      const KN = await import(`${ROOT}/src/game/knobs.ts`), R = KN.knobRegistry() as Record<string, unknown>, JN = (KN.JOURNAL_KNOBS as readonly string[]).includes('SHIELD');
      const env = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], held = Object.keys(FROZEN_HOLDS as Record<string, string>).filter(k => /shield/i.test(k) || /shield/i.test((FROZEN_HOLDS as Record<string, string>)[k]));
      F.verdict(!file && !('SHIELD' in R) && !JN && !env.includes('TPS_SHIELD') && held.length === 0, 'no shield module under src/game, no SHIELD table in the knob registry or among a recording\'s, no TPS_SHIELD among the stands\' words, no row of the two stands\' list',
        `src/game/shield.ts ${file ? 'EXISTS' : 'absent'} · registry ${'SHIELD' in R} · JOURNAL_KNOBS ${JN} · STAND_ENV ${env.includes('TPS_SHIELD')} · FROZEN_HOLDS rows: ${held.join(', ') || 'none'}`);
      // the old words do nothing: stood up with TPS_SHIELD=1 (the frozen stand's word for 'in') and the page's `?shield` read by the kit, no card offers one
      process.env.TPS_SHIELD = '1'; await hushed(() => standUp()); K.BIGSLOT.on = true; K.kitLoad(null, 'shield');
      const per = [0, 1, 2, 3, 4].map(i => ({ f: fields(i), big: ((rowOf(i, 'big')?.values ?? []) as string[]) })), any = per.some(p => p.f.includes('shield') || p.big.includes('shield'));
      F.verdict(!any, `the ${STAND} stand stood up with TPS_SHIELD=1 and the kit loaded with ?shield (the old words for 'in'): no card offers one — the words are read by nothing`, per.map((p, i) => `${i}: big ${p.big.join('/') || '—'}`).join(' · '));
      const T = JSON.parse(readFileSync(resolve(ROOT, 'src', 'game', 'slots.json'), 'utf8')), tools = (T.tools as any[]).map(t => t.id as string), sets = (T.loadouts as any[]).map(l => l.id as string), counted = (T.loadouts as any[]).filter(L => (L.members as any[]).some(c => 'shield' in c)).map(L => L.id as string);
      F.verdict(!tools.includes('shield') && !sets.includes('shield') && counted.length === 0 && T.v >= 10, 'the kit table (slots.json) has no shield tool, no squad kit named for one and none that counts one', `v${T.v} · tools: ${tools.join(' ')} · squad kits: ${sets.join(' ')} · counting a shield: ${counted.join(', ') || 'none'}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldCard(): Promise<boolean> {
  const F = family('noshield-card: no card offers a shield, and a card that says shield is a card without');
  await kept(async () => {
    try {
      await hushed(() => standUp());
      for (const [big, rule] of [[true, true], [false, true], [false, false]] as const) {
        const q = rule ? '' : 'noslots'; K.BIGSLOT.on = big; K.kitLoad(null, q);   // (kitLoad reads the pouches rule off the address)
        const per = [0, 1, 2, 3, 4].map(i => ({ f: fields(i), big: bigVals(i) }));
        F.verdict(per.every(p => !p.f.includes('shield') && !p.big.includes('shield')) && (!big || per.every(p => p.big.includes('hammer'))),
          `the big slot ${big ? 'ON' : rule ? 'OFF' : 'OFF and the pouches OFF (the free rows)'}: no card has a Shield row${big ? ', and no big row offers the shield (the hammer and the shotgun stand)' : ''}`, per.map((p, i) => `${i}: ${p.f.join(' ')}${big ? ` · big ${p.big.join('/')}` : ''}`).join(' · ') + B);
        const bare = { bangs: 0, charges: 0, frags: 0, smoke: 0 }; Object.assign(K.KIT.members[1], bare);   // (empty pouches: nothing else could be why a set is refused)
        const set = K.kitSet(1, 'shield', true), setBig = big ? K.kitSet(1, 'big', 'shield') : false, after = K.KIT.members[1];
        F.verdict(set === false && setBig === false && !('shield' in after) && K.bigOf(after) !== 'shield', 'a hand that sets the shield on a teammate\'s card (the old row, the big row) is refused, and the card is as it was', `kitSet(1, 'shield', true) → ${set}${big ? ` · kitSet(1, 'big', 'shield') → ${setBig}` : ''} · card has the key: ${'shield' in after} · big slot reads ${K.bigOf(after)}`);
        // a card stored by a build that had it: the shield on the first teammate, a hammer beside it and two stun cans — the rest of the card is his
        const st = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i === 1 ? { ...K.kitDefault(1), ...bare, bangs: 2, shield: true, big: 'hammer' } : { ...K.kitDefault(i), shield: false })) }) });
        K.kitLoad(st as any, q); const m = K.KIT.members[1], words = String(K.kitWords(1)), gun = K.kitGun(m) as string, own = K.kitGun(K.kitDefault(1)) as string, keyed = K.KIT.members.some((c: any) => 'shield' in c);
        F.verdict(!keyed && K.bigOf(m) !== 'shield' && !/shield/i.test(words) && gun === own && m.bangs === 2 && (!rule || K.kitLegal() === null) && (!big || K.bigOf(m) === 'hammer'),   // (a legal fill is the pouches rule's question)
          `a STORED card that says shield${big ? ' and hammer' : ''} loads as a card without one: no card holds the key, his own gun, his two stun cans${big ? ', the hammer in the big slot' : ''}, no word of one, a legal kit`, `key on a card: ${keyed} · big slot reads ${K.bigOf(m)} · gun ${gun} (his issue: ${own}) · stun ${m.bangs} · words: "${words}" · legal: ${rule ? K.kitLegal() ?? 'yes' : 'not asked, the rule is off'}`);
        const before = /"shield"/.test(st.m.get(K.KIT_LS) ?? ''), changed = K.kitSet(2, 'bangs', K.KIT.members[2].bangs === 1 ? 0 : 1) as boolean, now = /"shield"/.test(st.m.get(K.KIT_LS) ?? '');
        F.verdict(before && changed && !now, '…and the next change of any row writes the store without the word', `the store named it before: ${before} · a row changed: ${changed} · names it after: ${now}`);
        K.kitLoad(null, '');
      }
      // the squad kit that carried one ('Shield and shotgun') is not on the list and cannot be put on
      { K.BIGSLOT.on = true; K.kitLoad(null, ''); const listed = (K.kitLoadouts() as any[]).map(l => l.id as string), why = K.kitLoadout('shield') as string | null, worn = [1, 2, 3, 4].some(i => 'shield' in K.KIT.members[i] || K.bigOf(K.KIT.members[i]) === 'shield');
        F.verdict(!listed.includes('shield') && listed.length > 0 && typeof why === 'string' && !worn, 'the squad kit that carried one is not on the list and cannot be put on by its old name', `listed: ${listed.join(', ')} · kitLoadout('shield') → ${why ?? 'TAKEN'} · on a card: ${worn}`); }
      // a paste (kit.ts kitPaste — C / V on Team & kit) of a card that still says shield: the pasted man has none, and takes the rest
      { K.BIGSLOT.on = true; K.kitLoad(null, ''); const from = { ...K.kitDefault(3), shield: true, bangs: 2 }, r = K.kitPaste(2, from), m = K.KIT.members[2], words = String(K.kitWords(2));
        F.verdict(r.ok && m.bangs === 2 && !('shield' in m) && K.bigOf(m) !== 'shield' && K.kitGun(m) === K.kitGun(K.kitDefault(2)) && !/shield/i.test(words) && K.kitLegal() === null, 'a card that says shield PASTED onto a teammate: the rest of it is taken (its two stun cans), he has no shield, his own gun, no word of one, a legal kit', `paste: ${r.ok ? 'taken' : r.why} · stun ${m.bangs} · key on the card: ${'shield' in m} · gun ${K.kitGun(m)} · words: "${words}"`); K.kitLoad(null, ''); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldStaged(): Promise<boolean> {
  const F = family('noshield-staged: the mission that issued the shield stages on the plain issue, a level that still issues one is refused in words, and no mission\'s words name one');
  await kept(async () => {
    try {
      const { parseLevelData, parseLevelDataLenient } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
      const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`), { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
      const text = readFileSync(resolve(ROOT, 'levels', 'hall.json'), 'utf8'), data = parseLevelData(text), squad0 = NIGHTBREACH.squad;
      const seed0 = ROOMCLEAR.seed, way0 = ROOMCLEAR.way; K.kitLoad(null, '');   // (the cards as issued: a staging with no issue block read wears what is in memory)
      const stage = async (issueOn: boolean) => {
        ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0; NIGHTBREACH.squad = 4; K.ISSUE.on = issueOn;
        const W: any = await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(data), seed: 5 })), g = W.game;
        const why = await hushed(() => g.roomClear.start(0)); await hushed(() => { for (let i = 0; i < 6; i++) W.step(1 / 60); });
        const men = g.orders.men('all', { down: true }) as any[];
        return { why, n: men.length, pool: `${g.doorTools.bangs} stun ${g.doorTools.charges} charges ${g.doorTools.frags} frags`, guns: men.map(m => `${m.callsign} ${m.weapon.def.id}`), pistols: men.filter(m => m.weapon.def.cls === 'pistol').map(m => m.callsign as string), plated: men.filter(m => ['shield', 'shieldW', 'shieldCarry'].some(k => k in m.char.anim)).length };
      };
      let on, plain; try { on = await stage(true); plain = await stage(false); } finally { NIGHTBREACH.squad = squad0; ROOMCLEAR.seed = seed0; ROOMCLEAR.way = way0; K.ISSUE.on = true; }
      F.verdict(on.why === null && on.n >= 4 && on.pistols.length === 0 && on.plated === 0, 'THE LONG HALL (its issue block handed the first teammate the shield and a pistol): staged, every man holds a long gun and no figure\'s animator has a plate layer', `staged: ${on.why ?? 'ok'}, ${on.n} men · ${on.guns.join(', ')} · a pistol for his gun: ${on.pistols.join(', ') || 'nobody'} · animators with a plate field: ${on.plated}`);
      F.verdict(on.pool === plain.pool && J(on.guns) === J(plain.guns), 'and the squad carries the plain issue: its issue block read or not, the same guns and the same count of cans and charges', `issue block read: ${on.pool} · not read: ${plain.pool}`);
      // no level file names one…
      const dir = resolve(ROOT, 'levels'), files = readdirSync(dir).filter(f => f.endsWith('.json')), naming: string[] = [];
      for (const f of files) { try { const d = JSON.parse(readFileSync(resolve(dir, f), 'utf8')), mem = d?.scenarios?.issue?.members; if (mem && Object.values(mem as Record<string, any>).some(c => c && typeof c === 'object' && 'shield' in c)) naming.push(f); } catch { /* not a level document: nothing to issue */ } }
      F.verdict(files.length > 0 && naming.length === 0, 'no level file\'s issue block names a shield', `${files.length} files under levels/ · naming one: ${naming.join(', ') || 'none'}`);
      // …and one that still does (a level written for the build before, a hand's own) is refused, the reason in words
      { const d = JSON.parse(text); d.scenarios.issue = { members: { 1: { shield: true, bangs: 1 } } }; const old = J(d);
        let thrown = ''; try { parseLevelData(old); } catch (e) { thrown = String((e as Error)?.message ?? e); }
        const errs = (parseLevelDataLenient(old).errors as string[]).filter(e => /shield/i.test(e));
        F.verdict(/the ballistic shield is out of the game/.test(thrown) && errs.length === 1, 'a level whose issue card still says shield is REFUSED, and the reason says what to do (the editor opens it and lists the same line)', `the game's parse: ${thrown.split('\n').find(l => /shield/i.test(l))?.trim() ?? (thrown || 'TAKEN')} · the editor's list: ${errs.length} line(s)`); }
      const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const named = (SCENARIOS as any[]).filter(s => /shield/i.test([s.title, s.place, s.blurb, s.only].filter(Boolean).join(' '))).map(s => s.id as string);
      F.verdict(named.length === 0, 'no mission\'s title, place, blurb or note says shield', `missions whose words name one: ${named.join(', ') || 'none'} of ${(SCENARIOS as any[]).length}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldTape(): Promise<boolean> {
  const F = family('noshield-tape: what was recorded with a shield — a session\'s knobs apply and make no table, and a run tape that cannot be re-run says so in words');
  await kept(async () => {
    try {
      const W: any = await hushed(() => standUp()), g = W.game, JR = await import(`${ROOT}/src/game/journal.ts`), RF = await import(`${ROOT}/src/replay/format.ts`);
      const now = JR.knobsSnapshot(g), has = 'SHIELD' in (now.tables as Record<string, unknown>);
      // an F10 session from the build before carries the SHIELD table among its tables (the cards are in no recording: kit.ts KIT is in no registry)
      const old = JSON.parse(J(now)); old.tables.SHIELD = { on: true, handsK: 1.6, first: true, blast: true, aimLow: true };
      let threw = ''; try { await hushed(() => JR.applyKnobs(g, old)); } catch (e) { threw = String((e as Error)?.message ?? e); }
      const KN = await import(`${ROOT}/src/game/knobs.ts`), reg = 'SHIELD' in (KN.knobRegistry() as Record<string, unknown>), back = J(JR.knobsSnapshot(g).tables) === J(now.tables);
      F.verdict(!has && !threw && !reg && back, 'a snapshot made now carries no SHIELD table; an older session\'s knobs (the table among them) apply without a throw, make no table and leave every other table as the file had it', `a snapshot now has the table: ${has} · applying the older one: ${threw || 'ok'} · the registry has the table: ${reg} · the tables after = the file's own: ${back}`);
      await hushed(() => JR.applyKnobs(g, now));
      // an F7 run tape: re-run only when nobody in it carried one
      const tape = (o: { on?: boolean; card?: boolean; file?: string; search?: string; where?: 'knobs' | 'tables' }) => { const T = o.on === undefined ? {} : { SHIELD: { on: o.on } };
        return { v: 1, ticks: 0, recipe: { seed: 1, search: o.search ?? '', levelFile: o.file ?? 'levels/office.json', scenario: null, env: null, knobs: o.where === 'tables' ? { tables: {} } : { tables: T }, tables: o.where === 'tables' ? T : {}, kit: { on: true, members: [{}, o.card ? { shield: true } : { shield: false }, {}] } } }; };
      const says = (o: Parameters<typeof tape>[0]): boolean => BROKEN ? false : RF.tapeShield(tape(o)) as boolean;   // (NOSHIELD_BREAK: the lie — every tape waved through)
      const rows: [string, boolean, boolean][] = [
        ['in, on a teammate\'s card', says({ on: true, card: true }), true], ['in (the table kept outside the recording\'s), on a card', says({ on: true, card: true, where: 'tables' }), true],
        ['in, the long hall', says({ on: true, file: 'levels/hall.json' }), true], ['in, the long hall in its other look', says({ on: true, file: '/levels/hall-gwot.json' }), true],
        ['in, the long hall with ?noissue', says({ on: true, file: 'levels/hall.json', search: '?noissue' }), false], ['in, on nobody\'s card, another level', says({ on: true }), false],
        ['out, the key still on a card', says({ on: false, card: true }), false], ['no table at all (a tape made now), the long hall', says({ file: 'levels/hall.json' }), false]];
      F.verdict(rows.every(r => r[1] === r[2]) && /ballistic shield/.test(RF.TAPE_SHIELD), 'a run tape made with a shield man in it is refused before a re-run, in words; one made without is not', rows.map(r => `${r[0]}: ${r[1] ? 'refused' : 're-run'}${r[1] === r[2] ? '' : ' (WRONG)'}`).join(' · ') + ` · the words: "${RF.TAPE_SHIELD}"${B}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldCheck(only?: string): Promise<boolean> {
  console.log(`noshield-check on the ${STAND.toUpperCase()} stand${BROKEN ? ' — NOSHIELD_BREAK=1: the check is lied to, the card and tape lines below must FAIL' : ''}`);
  let ok = true;
  const parts: [string, () => Promise<boolean>][] = [['gone', noshieldGone], ['card', noshieldCard], ['staged', noshieldStaged], ['tape', noshieldTape]];
  for (const [name, fn] of parts) if (!only || only === name) ok = (await fn()) && ok;
  console.log(`\nnoshield-check: ${ok ? 'ALL PASS' : 'FAILURES above'}`);
  return ok;
}
if (import.meta.main) { const only = process.argv.slice(2).find(a => !a.startsWith('-')); process.exit((await noshieldCheck(only)) ? 0 : 1); }
