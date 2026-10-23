// A RESCUE'S MEN CHECK IN BY RADIO — the check behind src/game/rescuecheck.ts (RESCUECHECK.on: on in the page, ?norescuecheck; off on the frozen stand,
// TPS_RESCUECHECK=1).
//   bun run tools/qa/rescuecheck-check.ts        (also `probes.ts rescuecheck`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
// The floors are staged as tools/qa/answers.ts stages them (the mission's own row, no teammates, Sam out of everybody's sight, standing still: the captor's
// clock is never started by him) and its three plans are run on them. The switch is thrown by the check through the stand's own word for it.
//   (a) (b) (c) on each rescue of RESCUES, the QUIET way in (the back room's men put down one a second without a sound): the radio check, the man asked for
//       by his post (never by the team's label for him) and the word that one goes there are on the net in that order; ONE man leaves his post before the body is found, and he is neither
//       the captor nor a man in the hostage room; his word is `LEAD_S` or more before he is at the silent post; he finds the body and says so; nobody of
//       the cast has learned of the team before that (the rescue's own clocks are not started by a man walking to look);
//   (d) the LOUD way in on RESCUES[0]: no radio check is said after the first bang; the roamer says he is coming before the rescue lets him off his post,
//       and he comes to the noise (not to the doorway its echo reached him through) `LEAD_S` or more after his word;
//   (e) the LIGHTS cut on RESCUES[0]: nothing loud to go to — the roamer says he is going to the hostage door, and comes to it `LEAD_S` or more later;
//   (f) a checkpoint in the middle: the rule's state saved and loaded as JSON while the man is on his way (module state dropped in between) — the run ends
//       as the unbroken one did, line for line and by digest;
//   (g) the switch off = the base: the quiet and the loud way in on a stand with the switch off — no radio check, no word from a roamer, nobody off his
//       post on the quiet one, and each digests as one on a stand the rule was never thrown on.
// RESCUECHECK_BREAK=1 = the rule left OFF for (a)–(f) and ON for (g): each must fail.
// exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a line on the net is a string, a body is found by the CPU's estimate of the light on it. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const RESCUES = ['hostage-rescue', 'rescue-registry', 'rescue-consulate'], LEAD_S = 1.5;
const CHECK = /\(radio\): radio check — sound off/, ASK = /\(radio\): (.+?), sound off … \1\?/, GOES = /^\S+ (.+?) \(radio\): nothing from (.+?) — (?:one moving there|I'm heading over)!/;
const FOUND = /\(radio\): man down, (.+?) — they're inside!/, TO_NOISE = /\(radio\): heard that — moving to cover it!/, TO_DOOR = /\(radio\): on my way — moving to the hostage door!/;

const f1 = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) ? x.toFixed(1) : '—';
const env0 = process.env.TPS_RESCUECHECK;
/** a run with the stand's own word for the switch set, so the stand-up inside stages the floor with the rule as asked */
async function pin<T>(on: boolean, fn: () => Promise<T>): Promise<T> { process.env.TPS_RESCUECHECK = on ? '1' : '0'; try { return await fn(); } finally { if (env0 === undefined) delete process.env.TPS_RESCUECHECK; else process.env.TPS_RESCUECHECK = env0; } }

export async function rescuecheckCheck(): Promise<boolean> {
  const { RESCUECHECK, rescueCheckTimeline, rescueCheckSnapshot, rescueCheckRestore, rescueCheckReset } = await import(`${ROOT}/src/game/rescuecheck.ts`);
  const { ALL_MISSIONS: SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { answer, answerSetup } = await import('./answers.ts');
  const was = { ...RESCUECHECK }; let all = true;
  const BREAK = process.env.RESCUECHECK_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== rescuecheck: a rescue\'s men check in by radio ===');
  const row = (id: string) => (SCENARIOS as any[]).find(e => e.id === id);
  /** one plan run; `mid`: called after every step with the game (the checkpoint line's hook). Returns the answer, the game it ran on and the rule's timeline */
  const go = async (id: string, plan: 'loud' | 'quiet' | 'lights', on: boolean, mid?: (g: any) => void) => { let G: any = null;
    const A: any = await pin(on, () => answer(row(id), plan, (g: any, W: any) => { G = g; if (mid) { const step = W.step.bind(W); W.step = (dt: number) => { step(dt); mid(g); }; } }));
    return { A, g: G, ev: G ? [...rescueCheckTimeline(G)] as any[] : [], cast: G?.rescue?.cast?.() as any[] ?? [] }; };
  const at = (A: any, re: RegExp) => { const l = (A.lines as string[]).find(s => re.test(s)); return l ? parseFloat(l) : NaN; };
  try {
    answerSetup({ seed: 7 });
    const on = !BREAK; let first: any = null;
    for (const [i, id] of RESCUES.entries()) {
      const R = await go(id, 'quiet', on), A = R.A; if (i === 0) first = R;
      const said = (A.lines as string[]).find(s => GOES.test(s)) ?? '', m = GOES.exec(said), goer = m?.[1] ?? '', silent = m?.[2] ?? '';
      const check = at(A, CHECK), ask = at(A, ASK), goes = at(A, GOES), found = at(A, FOUND), foundEv = R.ev.find(e => e.what === 'found');
      const early = (A.tracks as any[]).filter(T => !(T.t[0] > found)), C = R.cast.find(c => c.gd.callsign === goer);
      const order = check < ask && ask < goes && goes < found, one = early.length === 1 && early[0].who === goer, who = !!C && C.role !== 'captor' && !C.inRoom;
      const lead = A.kind === 'look' && A.lands - goes >= LEAD_S, clocks = !!foundEv && R.cast.every(c => isNaN(c.learnedAt) || c.learnedAt >= foundEv.t - 0.05);
      line(order && one && who && lead && clocks, `(${'abc'[i]}) ${id}, the quiet way in: the radio check, the ask by post, the word that one goes, the body found; one man off his post, not the captor nor a man of the hostage room; his word ${LEAD_S} s or more before he is there; nobody has learned of the team before the body is found`,
        `radio check ${f1(check)} s · ${silent || 'nobody'} asked for ${f1(ask)} s · "one moving" ${f1(goes)} s (${goer || 'nobody'}${C ? `, ${C.role}${C.inRoom ? ' IN THE HOSTAGE ROOM' : ''}` : ''}) · ${A.kind}, there ${f1(A.lands)} s (lead ${f1(A.lands - goes)}) · found ${f1(found)} s · off their posts before that: ${early.map((T: any) => T.who).join(', ') || 'nobody'} · learned before it: ${foundEv ? R.cast.filter(c => c.learnedAt < foundEv.t - 0.05).map(c => c.gd.callsign).join(', ') || 'nobody' : '(no body found)'}`);
    }
    // (d) (e) the other two plans on the first rescue: no check under fire; the roamer's word, and where it takes him
    { const { A } = await go(RESCUES[0], 'loud', on), check = at(A, CHECK), word = at(A, TO_NOISE);
      line(!(check >= 0) && A.kind === 'counter' && A.nearNoise <= 6 && A.lands - word >= LEAD_S, `(d) ${RESCUES[0]}, the loud way in: no radio check after the bang; the roamer says he is coming and comes to the noise, his word ${LEAD_S} s or more before he is there`,
        `${check >= 0 ? `A RADIO CHECK at ${f1(check)} s` : 'no radio check'} · word ${f1(word)} s · ${A.kind}, there ${f1(A.lands)} s (lead ${f1(A.lands - word)}) · nearest he came to the noise ${f1(A.nearNoise)} m · "${A.line}"`); }
    { const { A } = await go(RESCUES[0], 'lights', on), word = at(A, TO_DOOR);
      line(A.kind === 'pull' && A.lands - word >= LEAD_S && !(at(A, TO_NOISE) >= 0), `(e) ${RESCUES[0]}, the lights cut: nothing loud to go to — the roamer says he is going to the hostage door and comes to it, his word ${LEAD_S} s or more before he is there`,
        `word ${f1(word)} s · ${A.kind}, there ${f1(A.lands)} s (lead ${f1(A.lands - word)}) · "${A.line}"`); }
    // (f) a checkpoint while the man is on his way
    { let done = false;
      const R = await go(RESCUES[0], 'quiet', on, g => { if (done || !rescueCheckTimeline(g).some((e: any) => e.what === 'goes')) return; done = true;
        const s = JSON.parse(JSON.stringify(rescueCheckSnapshot(g) ?? null)); rescueCheckReset(g); rescueCheckRestore(g, s); });
      const same = !!first && R.A.lines.join('\n') === first.A.lines.join('\n') && R.A.digest === first.A.digest && !!R.A.digest;
      line(done && same && at(R.A, FOUND) >= 0, '(f) a checkpoint while the man is on his way (the rule\'s state saved, dropped, loaded): the run ends as the unbroken one did, line for line and by digest',
        `${done ? 'saved and loaded' : 'NEVER SAVED: nobody was sent'} · ${R.A.lines.length} line(s) against ${first?.A.lines.length ?? 0}${same ? ', the same' : ' — THEY DIFFER'} · found ${f1(at(R.A, FOUND))} s · digest ${R.A.digest} against ${first?.A.digest}`); }
    // (g) the switch off = the base
    { const id = RESCUES[0], bq = await go(id, 'quiet', false), q = await go(id, 'quiet', BREAK), bl = await go(id, 'loud', false), l = await go(id, 'loud', BREAK);
      const words = (A: any) => (A.lines as string[]).filter(s => CHECK.test(s) || TO_NOISE.test(s) || TO_DOOR.test(s)).length;
      line(!words(q.A) && !words(l.A) && !q.A.tracks.length && q.A.digest === bq.A.digest && l.A.digest === bl.A.digest && !!bq.A.digest && !!bl.A.digest, '(g) the switch off = the base: no radio check, no word from a roamer, nobody off his post on the quiet way in; the quiet and the loud way in digest the same',
        `${id}: quiet — ${words(q.A)} line(s) of the rule's, ${q.A.tracks.length} off their posts, ${q.A.kind}, digest ${q.A.digest} against ${bq.A.digest} · loud — ${words(l.A)} line(s) of the rule's, ${l.A.kind}, digest ${l.A.digest} against ${bl.A.digest}`); }
  } finally { Object.assign(RESCUECHECK, was); if (env0 === undefined) delete process.env.TPS_RESCUECHECK; else process.env.TPS_RESCUECHECK = env0; }
  console.log(`=== rescuecheck: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}

if (import.meta.main) process.exit((await rescuecheckCheck()) ? 0 : 1);
