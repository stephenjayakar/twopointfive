// SQUADS THAT STAY IN THEIR ROOMS STILL MISS A ROOM THAT GOES SILENT — the check behind src/game/stayask.ts (STAYASK.on: on in the page, ?nostayask; off on
// the frozen stand, TPS_STAYASK=1).
//   bun run tools/qa/stayask-check.ts        (also `probes.ts stayask`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
// The floors are staged as tools/qa/answers.ts stages them (the mission's own row, no teammates, Sam out of everybody's sight) and its quiet plan is run on
// them: the back room's men put down one a second without a sound. The switch is thrown by the check (through the stand's own word for it, so the staging
// reads it), and the squads' senses with it as the page has them (enemysquads.ts SQUADS.radioCheck · noticedEyes · callBeat: a frozen stand holds them off).
//   (a) (b) on each level of STAY (every squad told to stay in its rooms): the roll call, the squad asked for by name, and the word that one man goes are on
//       the net in that order; ONE man leaves his post before any squad is in contact; his word is `LEAD_S` or more before he is at the silent post; his
//       squad keeps a man at home;
//   (c) a level with a squad that may leave its rooms (LEAVES): the rule does not hold there — no roll call of the squads is said;
//   (d) a lesson whose squads all stay (LESSON): the rule does not hold there either — no roll call;
//   (e) the switch off = the base: the same quiet way in on a stand with the switch off — no roll call, nobody leaves his post before a contact, and the
//       run digests as one on a stand the rule was never thrown on (a run the rule changes when it is on: the break path's digest differs);
//   (f) a squad's count of its own men is as it was: ONE man of a room put down quietly — what his mate does and what the net says are the same with the
//       rule on and off (the roll call aside): nobody says he is alone, no other squad sends a man.
// STAYASK_BREAK=1 = the rule left OFF for (a) (b) and ON for (e): each must fail ((c) (d) (f) hold either way: they are where the rule does nothing).
// exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a line on the net is a string, a boot is an event. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const STAY = ['block-four', 'mousehole-four'], LEAVES = 'warehouse-four', LESSON = 'train-orders', LEAD_S = 1.5;
const ROLL = /\(radio\): [^:]+: all squads — radio check/, GOES = /\(radio\): [^:]+: nothing from ([^—]+) — one moving to their rooms!/;
/** the net's ask for a SQUAD by name (a squad's own ask for a man reads the same but for the name: held to the squad the word that one goes names) */
const askFor = (squad: string) => new RegExp(`\\(radio\\): [^:]+: ${squad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\? … [^,]+, sound off`);

const f1 = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) ? x.toFixed(1) : '—';
const env0 = process.env.TPS_STAYASK;
/** a run with the stand's own word for the switch set, so the stand-up inside stages the floor with the rule as asked */
async function pin<T>(on: boolean, fn: () => Promise<T>): Promise<T> { process.env.TPS_STAYASK = on ? '1' : '0'; try { return await fn(); } finally { if (env0 === undefined) delete process.env.TPS_STAYASK; else process.env.TPS_STAYASK = env0; } }

export async function stayaskCheck(): Promise<boolean> {
  const { STAYASK } = await import(`${ROOT}/src/game/stayask.ts`);
  const { SQUADS } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { ALL_MISSIONS: SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { answer, answerSetup } = await import('./answers.ts');
  const was = { ...STAYASK }, senses0 = { r: SQUADS.radioCheck, e: SQUADS.noticedEyes, c: SQUADS.callBeat }; let all = true;
  const BREAK = process.env.STAYASK_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== stayask: squads that stay in their rooms still miss a room that goes silent ===');
  const row = (id: string) => (SCENARIOS as any[]).find(e => e.id === id);
  /** the squads' senses as the page has them (a stand-up writes the held ones again: thrown the moment the game stands) */
  const senses = () => { SQUADS.radioCheck = true; SQUADS.noticedEyes = true; SQUADS.callBeat = true; };
  /** the quiet way in (`take`: the most men of the back room put down) */
  const hush = (id: string, on: boolean, take?: number) => pin(on, () => answer(row(id), 'quiet', undefined, senses, take)) as Promise<any>;
  const at = (A: any, re: RegExp) => { const l = (A.lines as string[]).find(s => re.test(s)); return l ? parseFloat(l) : NaN; };
  const CONTACT = /\(radio\): [^:]+: contact — /;
  /** the men who left their posts before any squad was in contact (after it, squads lock their doors and men cross their rooms) */
  const early = (A: any) => (A.tracks as any[]).filter(T => !(T.t[0] > at(A, CONTACT)));
  try {
    answerSetup({ seed: 7 });
    const on = !BREAK;
    for (const [i, id] of STAY.entries()) {
      const A = await hush(id, on), said = (A.lines as string[]).find(s => GOES.test(s)) ?? '', silent = GOES.exec(said)?.[1].trim() ?? '';
      const roll = at(A, ROLL), ask = silent ? at(A, askFor(silent)) : NaN, goes = at(A, GOES), E = early(A);
      const order = roll < ask && ask < goes, one = E.length === 1, lead = A.kind === 'look' && A.lands - goes >= LEAD_S;
      line(order && one && lead, `(${'ab'[i]}) ${id}: the roll call, the ask by name, the word that one man goes; one man leaves his post; his word ${LEAD_S} s or more before he is there`,
        `roll call ${f1(roll)} s · ${silent || 'no squad'} asked by name ${f1(ask)} s · "one moving" ${f1(goes)} s · ${A.kind}, there ${f1(A.lands)} s (lead ${f1(A.lands - goes)}) · left their posts before any contact (${f1(at(A, CONTACT))} s): ${E.map((T: any) => T.who).join(', ') || 'nobody'} · "${said}"`);
    }
    // (c) (d) where the rule does not hold
    { const A = await hush(LEAVES, true), roll = at(A, ROLL);
      line(!(roll >= 0), `(c) ${LEAVES} (a squad that may leave its rooms): the rule does not hold — no roll call of the squads`, Number.isFinite(roll) ? `a roll call at ${f1(roll)} s` : `${A.kind} · ${(A.lines as string[]).length} line(s) on the net, none a roll call`); }
    { const A = await hush(LESSON, true), roll = at(A, ROLL);
      line(!(roll >= 0) && !A.note.startsWith('start refused'), `(d) ${LESSON} (a lesson, every squad stays): the rule does not hold — no roll call of the squads`, Number.isFinite(roll) ? `a roll call at ${f1(roll)} s` : `${A.kind} · ${(A.lines as string[]).length} line(s) on the net, none a roll call${A.note ? ` · ${A.note}` : ''}`); }
    // (e) the switch off = the base, on the quiet way in of (a): a run the rule changes
    { const id = STAY[0], base = await hush(id, false), again = await hush(id, BREAK), roll = at(again, ROLL), E = early(again);
      line(!(roll >= 0) && !E.length && again.digest === base.digest && !!base.digest, '(e) the switch off = the base: no roll call, nobody leaves his post, the quiet way in digests the same',
        `${id} (${again.squads} squads): ${roll >= 0 ? `A ROLL CALL at ${f1(roll)} s` : 'no roll call'} · ${E.length} off their posts before any contact · ${again.kind} · digest ${again.digest} against ${base.digest}`); }
    // (f) one man of a room: what his mate does is his squad's own business, with the rule on as with it off
    { const id = STAY[0], A = await hush(id, true, 1), B = await hush(id, false, 1);
      const said = (X: any) => (X.lines as string[]).filter(s => !ROLL.test(s)), left = (X: any) => (X.tracks as any[]).map(T => `${T.who} at ${f1(T.t[0])} s`).join(', ') || 'nobody';
      const sent = said(A).filter(s => /I'm alone here|moving to you|moving to their rooms/.test(s));
      const same = said(A).join('\n') === said(B).join('\n') && left(A) === left(B) && A.digest === B.digest && !!A.digest;
      line(same && !sent.length, '(f) one man of a room put down quietly: what his mate does and what the net says are the same with the rule on and off (the roll call aside) — nobody says he is alone, no other squad sends a man',
        `${id}: ${said(A).length} line(s) on the net with the rule on, ${said(B).length} with it off${same ? ', the same' : ' — THEY DIFFER'} · left their posts: ${left(A)} / ${left(B)} · digest ${A.digest} against ${B.digest}${sent.length ? ` · "${sent[0]}"` : ''}${said(A)[0] ? ` · first: "${said(A)[0]}"` : ''}`); }
  } finally { Object.assign(STAYASK, was); SQUADS.radioCheck = senses0.r; SQUADS.noticedEyes = senses0.e; SQUADS.callBeat = senses0.c; if (env0 === undefined) delete process.env.TPS_STAYASK; else process.env.TPS_STAYASK = env0; }
  console.log(`=== stayask: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}

if (import.meta.main) process.exit((await stayaskCheck()) ? 0 : 1);
