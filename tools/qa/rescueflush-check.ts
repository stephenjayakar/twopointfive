// THE MEN LEFT ALIVE ON A RESCUE COME FOR THE HOSTAGES — the check behind src/game/rescueflush.ts (RESCUEFLUSH.on: on in the page, ?norescueflush; off on
// the frozen stand, TPS_RESCUEFLUSH=1).
//   bun run tools/qa/rescueflush-check.ts      (also `probes.ts rescueflush`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
//   RESCUEFLUSH_SEEDS=7,8,9                    the dice each floor is staged under (default 7)
// Every rescue of the mission list (RESCUES) is staged as tools/qa/answers.ts stages a floor (the mission's own row, no teammates, Sam out of everybody's
// sight and unhurt, so NOBODY stops a man of theirs) and the check's own hand does what a team would have done: one loud round at the hostage door, the
// men posted with the hostages put down. What the men left alive then do is theirs. The switch is thrown through the stand's own word for it.
//   (a) THEY COME: the first man's word is RESCUEFLUSH.afterSecs after the room falls, the next gapSecs after it; every man of theirs alive outside the
//       room is sent (or held short by a covered lane, and logged so) inside the time that takes plus 12 s; where the room has a side door the second word
//       names it;
//   (b) THE GUN ON HER: with nobody to stop him a man who came turns his gun on a hostage and she is shot, inside 40 s of the fall — and she is logged
//       'executed', never the team's own fire;
//   (c) NOT WHEN QUIET: the same men put down without a sound and no loud thing done — 30 s on nobody has been sent and nobody has been shot;
//   (d) THEY'RE GONE: the hostages stood at the way out before the fall (as a team that walked them there would have them; the end rule held off so the
//       run does not end on it) — a man reaches the empty room and says so, men are then sent to the way out or the team's noise, and a hostage is shot
//       where she stands, outside the room, by a man who is outside it too;
//   (e) the state saved, scribbled over and restored is the state it was;
//   (f) the switch OFF = as it was: (a)'s floor for 40 s — nobody is sent, nobody outside the room takes the clock, no hostage is shot.
// NOT ASKED HERE: a corridor the team's guns hold (lanes.ts — the rule asks laneHolds / laneWarns before every word and the walk itself is the fight
// AI's, priced and gated by the lanes like any other; staging a held lane needs a team, and this floor has none: `probes.ts lanes` holds the lanes' own rules).
// RESCUEFLUSH_BREAK=1 = the rule left OFF for (a)–(e) and ON for (f): the check must fail.
// exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a word on the net is a string, a line to a hostage is the collision's segment test. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const RESCUES = ['hostage-rescue', 'rescue-registry', 'rescue-consulate'], DT = 1 / 60;
const SEEDS = (process.env.RESCUEFLUSH_SEEDS ?? '7').split(',').map(Number).filter(Number.isFinite);
const f1 = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) ? x.toFixed(1) : '—';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function pin<T>(words: Record<string, boolean>, fn: () => Promise<T>): Promise<T> {
  const was: Record<string, string | undefined> = {};
  for (const [k, on] of Object.entries(words)) { was[k] = process.env[k]; process.env[k] = on ? '1' : '0'; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(was)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

export async function rescueflushCheck(): Promise<boolean> {
  const { RESCUEEND } = await import(`${ROOT}/src/game/rescueend.ts`), { RESCUEFLUSH } = await import(`${ROOT}/src/game/rescueflush.ts`);
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { answerStand, seeded } = await import('./answers.ts');
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const was = { end: { ...RESCUEEND }, flush: { ...RESCUEFLUSH } }, rnd = Math.random; let all = true;
  const BREAK = process.env.RESCUEFLUSH_BREAK === '1', K = RESCUEFLUSH;
  const line = (ok: boolean, what: string, detail: string) => { if (!ok) all = false; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  /** one floor: the mission staged under `seed`; `loud`: a round of Sam's at the hostage door before the room's own men are put down (else they go down
   *  without a sound); `out`: the hostages stood at the way out first */
  const floor = async (id: string, seed: number, on: boolean, o: { loud: boolean; out?: boolean; end?: boolean }) => await pin({ TPS_RESCUEFLUSH: on, TPS_RESCUEEND: o.end ?? true }, async () => {
    Math.random = seeded(seed);
    const E = (ALL_MISSIONS as any[]).find(e => e.id === id), { W, g, why } = await answerStand(E); if (why) throw new Error(`${id}: ${why}`);
    const R = g.rescue, B = R.bounds, log = console.log, inB = (p: number[]) => p[0] >= B.x0 && p[0] <= B.x1 && p[2] >= B.z0 && p[2] <= B.z1;
    const shotAt: { who: string; at: number[]; by: string | null; byAt: number[] | null }[] = []; let acts = 0;
    const step = (s: number, until?: () => boolean) => { console.log = () => {}; try { for (let i = 0; i < Math.round(s / DT); i++) {
      const up = R.hostages.filter((h: any) => h.state !== 'dead'), cap = R.captor();
      W.step(DT);
      for (const h of up) if (h.state === 'dead') shotAt.push({ who: h.callsign, at: [...h.char.pos], by: cap?.callsign ?? null, byAt: cap ? [...cap.char.pos] : null });
      acts = R.log.filter((l: any) => l.what === 'act').length;
      if (until?.()) return true; } return false; } finally { console.log = log; } };
    step(1);
    if (o.out) { const O = R.ending.out; R.hostages.forEach((h: any, i: number) => { const p = g.col.nav.nearestFreePoint(O[0] + 0.8 * i, O[2] + 0.6 * (i % 2)) ?? O; h.char.pos[0] = p[0]; h.char.pos[2] = p[2]; h.civ.cowerAt = [p[0], 0, p[2]]; }); }
    if (o.loud) { const P = R.outsidePoint; g.events.push({ kind: 'shot', pos: [P[0], 0, P[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID }); step(0.5); }
    for (const c of R.cast()) if (c.inRoom) killGuard(g, c.gd, [1, 0, 0], !o.loud, o.loud ? 'shot' : 'struck', 'player');
    const t0 = g.time; step(2 * DT);
    const lines = (re: RegExp) => R.log.filter((l: any) => re.test(l.what)).map((l: any) => ({ t: l.t - t0, what: l.what as string }));
    return { W, g, R, B, inB, step, t0, lines, shotAt, acts: () => acts, up: (l: any[]) => l.filter(x => x.state !== 'dead') };
  });
  try {
    for (const id of RESCUES) for (const seed of SEEDS) {
      const tag = `${id}${SEEDS.length > 1 ? ` · seed ${seed}` : ''}`, on = !BREAK;
      { // (a) (b): they come; the gun on her
        const F = await floor(id, seed, on, { loud: true }), { R } = F;
        const outside = F.up(R.hostiles).filter((h: any) => !F.inB(h.char.pos)), need = K.afterSecs + outside.length * K.gapSecs + 12;
        F.step(need);
        const words = F.lines(/^flush:(room|side|noise|out):/), held = F.lines(/^flush:lane:/), first = words[0], second = words[1];
        const named = new Set([...words, ...held].map(l => l.what.split(':')[2])), missed = outside.filter((h: any) => h.state !== 'dead' && !named.has(h.callsign)).map((h: any) => h.callsign);
        const side = !!R.data.side;
        line(F.lines(/^flush:fell$/).length === 1 && !!first && Math.abs(first.t - K.afterSecs) < 0.2 && /^flush:room:/.test(first.what) && (outside.length < 2 || (!!second && second.t - first.t >= K.gapSecs - 0.05 && (!side || /^flush:side:/.test(second.what)))) && !missed.length,
          `(a) ${tag}: once it is loud and the room has fallen, every man left alive outside it is sent for the hostages, one after another`,
          `${outside.length} alive outside the room · first word ${first ? `${first.what} at ${f1(first.t)} s` : 'none'} (afterSecs ${K.afterSecs}) · second ${second ? `${second.what} at ${f1(second.t)} s` : 'none'} · held short by a lane ${held.length} · never sent: ${missed.join(', ') || 'nobody'}`);
        F.step(Math.max(0, 40 - need), () => F.shotAt.length > 0);
        if (side && second && /^flush:side:/.test(second.what)) { const so = R.sideOutside, thr = F.lines(/^flush:through:/)[0];
          line(!!so && !F.inB(so) && (!!thr || F.shotAt.length > 0), `(a) ${tag}: the man sent round is sent to the floor OUTSIDE the side door, and goes in from there`,
            `the side door's far floor ${so ? `(${f1(so[0])}, ${f1(so[2])}) — ${F.inB(so) ? 'IN' : 'outside'} the room` : 'none'} · ${thr ? `${thr.what} at ${f1(thr.t)} s` : `not through it before a hostage was shot (${F.shotAt.length})`}`); }
        const ex = F.lines(/^executed:/), tf = F.lines(/^teamfire:/), s0 = F.shotAt[0];
        line(F.acts() > 0 && ex.length > 0 && !tf.length && ex[0].t <= 40 && !!s0?.by, `(b) ${tag}: with nobody to stop him, a man who came shoots a hostage`,
          `'act' ${F.acts()} · ${ex[0] ? `${ex[0].what} at ${f1(ex[0].t)} s` : 'nobody shot'}${s0 ? ` by ${s0.by ?? '—'}` : ''} · the team's own fire logged ${tf.length} · result ${R.result ? `${R.result.state} (${R.result.why})` : 'none'}`);
      }
      { // (c) not when quiet
        const F = await floor(id, seed, on, { loud: false }), { R } = F; F.step(30);
        const words = F.lines(/^flush:/);
        line(!words.length && !F.acts() && !F.shotAt.length && R.noiseAt === null, `(c) ${tag}: the room taken without a sound — nobody is sent and nobody is shot`,
          `flush lines ${words.length} · 'act' ${F.acts()} · shot ${F.shotAt.length} · the team's last loud thing: ${R.noiseAt ? 'one' : 'none'}`);
      }
      { // (a): round by the side door and in — the man sent round alone (every other man of theirs put down the moment he is sent)
        const F = await floor(id, seed, on, { loud: true }), { g, R } = F;
        F.step(K.afterSecs + 4 * K.gapSecs + 2, () => F.lines(/^flush:side:/).length > 0);
        const sent = F.lines(/^flush:side:/)[0], man = sent ? R.hostiles.find((h: any) => h.callsign === sent.what.split(':')[2]) : null;
        if (man) for (const h of R.hostiles) if (h !== man && h.state !== 'dead') killGuard(g, h, [1, 0, 0], true, 'struck', 'player');
        F.step(45, () => F.lines(/^flush:through:/).length > 0); const thr = F.lines(/^flush:through:/)[0];
        F.step(25, () => F.shotAt.length > 0 || (!!man && F.inB(man.char.pos)));
        line(!!man && !!thr && (F.shotAt.length > 0 || F.inB(man.char.pos)), `(a) ${tag}: the man sent round, alone, walks to the side door and goes in by it for them`,
          `${sent ? sent.what : 'nobody sent round'} · ${thr ? `${thr.what} at ${f1(thr.t)} s` : 'never at the side door'} · ${man ? `he ended ${F.inB(man.char.pos) ? 'IN the room' : `at (${f1(man.char.pos[0])}, ${f1(man.char.pos[2])})`}, ${man.state}` : ''} · hostages shot ${F.shotAt.length}`);
      }
      { // (d) (e): they're gone; the state's pair
        const F = await floor(id, seed, on, { loud: true, out: true, end: false }), { R } = F;
        F.step(90, () => F.shotAt.length > 0);
        const gone = F.lines(/^flush:gone:/)[0], after = gone ? F.lines(/^flush:(out|noise):/).filter((l: any) => l.t >= gone.t) : [], s0 = F.shotAt[0];
        line(!!gone && after.length > 0 && !!s0 && !F.inB(s0.at) && !!s0.byAt && !F.inB(s0.byAt) && !F.lines(/^teamfire:/).length, `(d) ${tag}: the hostages stood at the way out — the room is found empty, men are sent on, and one of them shoots a hostage out there`,
          `${gone ? `${gone.what} at ${f1(gone.t)} s` : 'the room never found empty'} · sent on after it: ${after.map((l: any) => l.what).join(', ') || 'nobody'} · ${s0 ? `${s0.who} shot at (${f1(s0.at[0])}, ${f1(s0.at[2])}) by ${s0.by ?? '—'}${s0.byAt ? ` at (${f1(s0.byAt[0])}, ${f1(s0.byAt[2])})` : ''} — ${F.inB(s0.at) ? 'IN' : 'outside'} the room` : 'nobody shot inside 90 s'}`);
        const snap = JSON.parse(JSON.stringify(R.flush.snapshot())); R.flush.reset(); const blank = JSON.stringify(R.flush.snapshot()); R.flush.restore(snap); const back = JSON.stringify(R.flush.snapshot());
        line(back === JSON.stringify(snap) && blank !== back && snap.sent.length > 0, `(e) ${tag}: the rule's state saved and restored is the state it was`, `men in the saved state ${snap.sent.length} · fell ${f1(snap.fellAt - F.t0)} s · the same after the restore ${back === JSON.stringify(snap)}`);
      }
      { // (f) off = as it was
        const F = await floor(id, seed, BREAK, { loud: true }), { R } = F; let outCap = 0;
        F.step(40, () => { const c = R.captor(); if (c && !F.inB(c.char.pos)) outCap++; return false; });
        const words = F.lines(/^flush:/);
        line(!words.length && !outCap && !F.shotAt.length, `(f) ${tag}: the switch off — nobody is sent, nobody outside the room has the clock, no hostage is shot`,
          `flush lines ${words.length} · frames a man outside the room held the clock ${outCap} · shot ${F.shotAt.length} · 'act' ${F.acts()}`);
      }
    }
  } finally { Object.assign(RESCUEEND, was.end); Object.assign(RESCUEFLUSH, was.flush); Math.random = rnd; }
  console.log(`\n=== rescueflush: ${all ? 'ALL PASS' : 'FAILED'}${BREAK ? ' (RESCUEFLUSH_BREAK=1: a failure is the expected result)' : ''} ===`);
  return all;
}
if (import.meta.main) process.exit((await rescueflushCheck()) ? 0 : 1);
