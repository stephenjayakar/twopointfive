// THE BALLISTIC SHIELD IS OUT OF THE PAGE (src/game/shield.ts SHIELD.on, src/game/kit.ts shieldIn; the maintainer, 10-15: "we should also probably just get
// rid of the ballistic shield, doesn't match the vibes (feels more like swat)"), headless:
//   bun run tools/qa/noshield-check.ts [stands|card|staged|tape]      (NOSHIELD_BREAK=1 = the card ignores the switch: the card and staged lines must fail)
//   stands  the frozen stand stands a game up WITH the shield (its probes, tallies and fixtures stage one; TPS_SHIELD=0 takes it away), the shipped stand
//           without (TPS_SHIELD=1 = back); the row of the two stands' list, its word, the knob registry, the journal's tables
//   card    the switch off, the big slot on and off: no card has a Shield row, no big row offers the shield, a hand that sets one is refused, a stored card
//           that says shield loads as a card without one and its words name none; the switch on again: the row offers it (nothing was cut)
//   staged  the long hall, whose issue block hands Red One the shield: staged with the switch off nobody carries one and Red One holds his own gun;
//           with it on he carries it (the control). No mission's words say shield
//   tape    a recording made with the shield in the game carries the table, and applied over a game without it puts it back: an older run replays
// Run it on both stands (plain, and TPS_PROFILE=shipped): it sets the switch itself and says which stand it ran on. Nothing here looks at a picture.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const SH = await import(`${ROOT}/src/game/shield.ts`);
const { SHIELD } = SH;
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
/** the kit table, its switches and the stand's own word put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = K.KIT.on, big = K.BIGSLOT.on, rule = K.SLOTS.on, issue = K.ISSUE.on, plate = SHIELD.on, word = process.env.TPS_SHIELD;
  try { return await fn(); } finally { K.kitLoad(null, ''); K.SLOTS.on = rule; K.BIGSLOT.on = big; K.KIT.on = on; K.ISSUE.on = issue; SHIELD.on = plate; for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; if (word === undefined) delete process.env.TPS_SHIELD; else process.env.TPS_SHIELD = word; }
}

export async function noshieldStands(): Promise<boolean> {
  const F = family('noshield-stands: the shield is a row of the two stands — in on the frozen one, out of the page');
  await kept(async () => {
    try {
      const env = process.env.TPS_SHIELD; await hushed(() => standUp()); const stood = SHIELD.on as boolean;
      const want = env !== undefined ? env !== '0' : STAND === 'frozen';
      F.verdict(stood === want, `the ${STAND} stand stands a game up ${want ? 'WITH' : 'WITHOUT'} the shield${env !== undefined ? ` (TPS_SHIELD=${env})` : STAND === 'frozen' ? ' (as its probes and fixtures were recorded: TPS_SHIELD=0 takes it away)' : ' (as the page opens: TPS_SHIELD=1 = back)'}`, `SHIELD.on after the stand-up: ${stood}`);
      const flip = STAND === 'frozen' ? '0' : '1'; process.env.TPS_SHIELD = flip; await hushed(() => standUp()); const other = SHIELD.on as boolean;
      if (env === undefined) delete process.env.TPS_SHIELD; else process.env.TPS_SHIELD = env;
      F.verdict(other === (flip === '1'), `and the word turns it: TPS_SHIELD=${flip} stands one up ${flip === '1' ? 'with' : 'without'} it`, `SHIELD.on: ${other}`);
      const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], KN = await import(`${ROOT}/src/game/knobs.ts`), R = KN.knobRegistry(), JN = (KN.JOURNAL_KNOBS as readonly string[]).includes('SHIELD');
      F.verdict(s.includes('TPS_SHIELD') && FROZEN_HOLDS['SHIELD.on'] === 'TPS_SHIELD=0' && R.SHIELD === SHIELD && JN, 'the switch is a row of the two stands\' list with its word, in the knob registry and among the tables a recording carries', `STAND_ENV ${s.includes('TPS_SHIELD')} · FROZEN_HOLDS ${FROZEN_HOLDS['SHIELD.on']} · registry ${R.SHIELD === SHIELD} · JOURNAL_KNOBS ${JN}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldCard(): Promise<boolean> {
  const F = family('noshield-card: with the shield out no card offers one, and a card that says shield is a card without');
  await kept(async () => {
    try {
      await hushed(() => standUp());
      for (const [big, rule] of [[true, true], [false, true], [false, false]] as const) {
        const q = rule ? '' : 'noslots'; K.BIGSLOT.on = big; SHIELD.on = false; K.kitLoad(null, q);   // (kitLoad reads the pouches rule off the address)
        const per = [0, 1, 2, 3, 4].map(i => ({ f: fields(i), big: ((rowOf(i, 'big')?.values ?? []) as string[]) }));
        F.verdict(per.every(p => !p.f.includes('shield') && !p.big.includes('shield')) && (!big || per.every(p => p.big.includes('hammer'))),
          `the shield OUT, the big slot ${big ? 'ON' : rule ? 'OFF' : 'OFF and the pouches OFF (the free rows)'}: no card has a Shield row${big ? ', and no big row offers the shield (the hammer and the shotgun stand)' : ''}`, per.map((p, i) => `${i}: ${p.f.join(' ')}${big ? ` · big ${p.big.join('/')}` : ''}`).join(' · ') + B);
        const bare = { bangs: 0, charges: 0, frags: 0, smoke: 0 }; Object.assign(K.KIT.members[1], bare);   // (empty pouches: under the pouches rule the shield costs two, and a full card would refuse it for that alone)
        const set = K.kitSet(1, 'shield', true), after = K.KIT.members[1].shield;
        F.verdict(set === false && after === false, 'a hand that sets the shield on a teammate\'s card is refused, and the card is as it was', `kitSet(1, 'shield', true) → ${set} · card.shield ${after}${B}`);
        // a card stored by the build before, the shield on Red One (and, the big slot on, a hammer beside it: with the shield out it is the hammer he has)
        const st = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i === 1 ? { ...K.kitDefault(1), ...bare, shield: true, big: 'hammer' } : K.kitDefault(i))) }) });
        K.kitLoad(st as any, q); const m = K.KIT.members[1], words = String(K.kitWords(1)), gun = K.kitGun(m) as string;
        F.verdict(K.bigOf(m) !== 'shield' && !/shield/i.test(words) && gun !== 'fiveseven' && gun !== 'guard9mm' && (!rule || K.kitLegal() === null) && (!big || K.bigOf(m) === 'hammer'),   // (a legal fill is the pouches rule's question)
          `a STORED card that says shield${big ? ' and hammer' : ''} (and nothing in its pouches) loads as a card without a shield: his own gun, ${big ? 'the hammer in the big slot' : 'no shield row'}, no word of one, a legal kit`, `big slot reads ${K.bigOf(m)} · gun ${gun} · words: "${words}" · legal: ${rule ? K.kitLegal() ?? 'yes' : 'not asked, the rule is off'}${B}`);
        K.kitLoad(null, '');
      }
      // the rows follow the switch at once (the debugger's toggle, a recording's table applied mid-visit): no stale row is handed out
      { K.BIGSLOT.on = true; SHIELD.on = true; K.kitLoad(null, ''); const a = ((rowOf(1, 'big')?.values ?? []) as string[]).includes('shield'); SHIELD.on = false; const b = ((rowOf(1, 'big')?.values ?? []) as string[]).includes('shield'); SHIELD.on = true; const c = ((rowOf(1, 'big')?.values ?? []) as string[]).includes('shield');
        F.verdict(a && !b && c, 'the rows follow the switch at once, with no load in between: in, out, in again', `offered ${a} → ${b} → ${c}${B}`); }
      // the table's own squad kit that carries one (slots.json: 'Shield and shotgun') is not on the list, and cannot be put on
      { K.BIGSLOT.on = true; SHIELD.on = true; K.kitLoad(null, ''); const has = (id: string) => (K.kitLoadouts() as any[]).some(l => l.id === id), tbl = (K.SLOTS.table.loadouts as any[]).filter(L => L.counts.some((c: any) => (c.shield ?? 0) > 0)).map(L => L.id as string);
        const inn = tbl.filter(has); SHIELD.on = false; const out = tbl.filter(has), why = tbl.map(id => K.kitLoadout(id) as string | null), worn = [1, 2, 3, 4].some(i => K.bigOf(K.KIT.members[i]) === 'shield');
        F.verdict(tbl.length > 0 && inn.length === tbl.length && out.length === 0 && why.every(w => typeof w === 'string') && !worn, 'the table\'s squad kit that carries a shield is not on the list and cannot be put on (with the shield in, it is as it was)', `the table's: ${tbl.join(', ') || 'none'} · listed with the shield in: ${inn.join(', ') || 'none'} · out: ${out.join(', ') || 'none'} · put on: ${why.map(w => w ?? 'TAKEN').join(' | ')}${B}`); }
      // a paste (kit.ts kitPaste — C / V on Team & kit) from a card that still says shield: the pasted man has none, and a teammate takes the rest
      { K.BIGSLOT.on = true; SHIELD.on = false; K.kitLoad(null, ''); const from = { ...K.kitDefault(3), shield: true, bangs: 2 }, r = K.kitPaste(2, from), m = K.KIT.members[2], words = String(K.kitWords(2));
        F.verdict(r.ok && m.bangs === 2 && K.bigOf(m) !== 'shield' && K.kitGun(m) !== 'fiveseven' && K.kitGun(m) !== 'guard9mm' && !/shield/i.test(words) && K.kitLegal() === null, 'a card that says shield PASTED onto a teammate: the rest of it is taken (its two stun cans), he has no shield, his own gun, no word of one, a legal kit', `paste: ${r.ok ? 'taken' : r.why} · stun ${m.bangs} · big slot reads ${K.bigOf(m)} · gun ${K.kitGun(m)} · words: "${words}"${B}`); K.kitLoad(null, ''); }
      // nothing was cut: the switch on again and the row offers it
      K.BIGSLOT.on = true; SHIELD.on = true; K.kitLoad(null, ''); const back = ((rowOf(1, 'big')?.values ?? []) as string[]).includes('shield'), ok = K.kitSet(1, 'shield', true), now = K.bigOf(K.KIT.members[1]);
      F.verdict(back && ok && now === 'shield', 'the switch ON again (?shield, a recording made with one): a teammate\'s big row offers the shield and takes it — nothing was cut', `offered ${back} · set ${ok} · big slot reads ${now}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldStaged(): Promise<boolean> {
  const F = family('noshield-staged: a mission that issued the shield stages without it, and no mission\'s words name one');
  await kept(async () => {
    try {
      const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
      const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`), { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
      const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', 'hall.json'), 'utf8')), issue = data.scenarios?.issue?.members ?? null, squad0 = NIGHTBREACH.squad;
      const seed0 = ROOMCLEAR.seed, way0 = ROOMCLEAR.way; K.kitLoad(null, '');   // (the cards as issued: the staging with no issue block read wears what is in memory)
      const stage = async (on: boolean, issueOn = true) => {
        process.env.TPS_SHIELD = on ? '1' : '0'; ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0; NIGHTBREACH.squad = 4; K.ISSUE.on = issueOn;
        const W: any = await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(data), seed: 5 })), g = W.game; SHIELD.on = on;
        const why = await hushed(() => g.roomClear.start(0)); await hushed(() => { for (let i = 0; i < 6; i++) W.step(1 / 60); });
        const men = g.orders.men('all', { down: true }) as any[], who = Object.keys(issue ?? {}).filter(k => (issue as any)[k].shield === true).map(k => men[+k - 1]);
        return { why, issue, n: men.length, pool: `${g.doorTools.bangs} stun ${g.doorTools.charges} charges ${g.doorTools.frags} frags`, carried: men.filter(m => SH.shieldCarried(m)).map(m => m.callsign as string), guns: men.map(m => `${m.callsign} ${m.weapon.def.id}`), red: who[0]?.weapon?.def?.cls as string };
      };
      let off, on, plain; try { off = await stage(false); on = await stage(true); plain = await stage(false, false); } finally { NIGHTBREACH.squad = squad0; ROOMCLEAR.seed = seed0; ROOMCLEAR.way = way0; K.ISSUE.on = true; }
      const issued = !!off.issue && Object.values(off.issue as Record<string, any>).some(c => c.shield === true);
      F.verdict(issued && off.why === null && off.n >= 4 && off.carried.length === 0 && off.red !== 'pistol', 'THE LONG HALL (its issue block hands the first teammate the shield), the shield OUT: staged, nobody carries one and that man holds his own gun', `issue block says shield ${issued} · staged: ${off.why ?? 'ok'}, ${off.n} men · carrying a shield: ${off.carried.join(', ') || 'nobody'} · ${off.guns.join(', ')}${B}`);
      F.verdict(off.pool === plain.pool && on.pool !== off.pool, 'and he carries the plain issue: the card that traded his charges and frags for the shield is not put on without it', `the squad's count, the shield out: ${off.pool} · the same staging with no issue block read: ${plain.pool} · the shield in: ${on.pool}${B}`);
      F.verdict(on.why === null && on.carried.length === 1 && on.red === 'pistol', 'the control, the shield IN (the frozen stand, ?shield): the same staging hands him the shield and a pistol', `carrying a shield: ${on.carried.join(', ') || 'nobody'} · ${on.guns.join(', ')}`);
      const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const named = (SCENARIOS as any[]).filter(s => /shield/i.test([s.title, s.place, s.blurb, s.only].filter(Boolean).join(' '))).map(s => s.id as string);
      F.verdict(named.length === 0, 'no mission\'s title, place, blurb or note says shield', `missions whose words name one: ${named.join(', ') || 'none'} of ${(SCENARIOS as any[]).length}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldTape(): Promise<boolean> {
  const F = family('noshield-tape: a recording made with the shield in the game replays with it');
  await kept(async () => {
    try {
      const W: any = await hushed(() => standUp()), g = W.game, JR = await import(`${ROOT}/src/game/journal.ts`);
      SHIELD.on = true; const withIt = JR.knobsSnapshot(g), carried = (withIt.tables as any).SHIELD?.on;
      SHIELD.on = false; const without = JR.knobsSnapshot(g);
      await hushed(() => JR.applyKnobs(g, withIt)); const a = SHIELD.on as boolean;
      await hushed(() => JR.applyKnobs(g, without)); const b = SHIELD.on as boolean;
      F.verdict(carried === true && a === true && b === false, 'a recording made with the shield carries the table and, applied over a game without it, puts it back; one made without replays without', `the snapshot's table says ${carried} · applied the older one: ${a} · applied one made now: ${b}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function noshieldCheck(only?: string): Promise<boolean> {
  console.log(`noshield-check on the ${STAND.toUpperCase()} stand${BROKEN ? ' — NOSHIELD_BREAK=1: the card ignores the switch, the card and staged lines below must FAIL' : ''}`);
  let ok = true;
  const parts: [string, () => Promise<boolean>][] = [['stands', noshieldStands], ['card', noshieldCard], ['staged', noshieldStaged], ['tape', noshieldTape]];
  for (const [name, fn] of parts) if (!only || only === name) ok = (await fn()) && ok;
  console.log(`\nnoshield-check (${STAND} stand): ${ok ? 'ALL PASS' : 'FAILED'}`);
  return ok;
}
if (import.meta.main) { const ok = await noshieldCheck(process.argv[2]); process.exit(ok ? 0 : 1); }
