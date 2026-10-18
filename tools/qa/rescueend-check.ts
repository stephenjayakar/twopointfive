// HOW A HOSTAGE RESCUE ENDS — the check behind src/game/rescueend.ts (RESCUEEND.on: on in the page, ?norescueend; off on the frozen stand, TPS_RESCUEEND=1).
//   bun run tools/qa/rescueend-check.ts        (also `probes.ts rescueend`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
//   RESCUEEND_SEEDS=7,8,9                      the dice each floor is staged under (default 7)
// Every rescue of the mission list (RESCUES) is staged as tools/qa/answers.ts stages a floor (the mission's own row, no teammates, Sam out of everybody's
// sight and unhurt) and the check's own hand does what a team would have done: the men posted with the hostages are put down, Sam stands in the room.
// The switch is thrown through the stand's own word for it; the men coming for the hostages (rescueflush.ts) are held off, so nobody of theirs dies or
// kills here but by the check's hand.
//   (a) NOT BEFORE: the room taken and stood in for 20 s (longer than the old 15 s hold) with men of theirs alive elsewhere — the room is 'secured' and the
//       run has NOT ended;
//   (b) THE ROW: beside a hostage, Space's row on her is 'on your feet — with me'; tapped, every living hostage is led by the player's own character;
//   (c) OUT: Sam walks the nav grid's way back to the mark he was staged on — the run ends RESCUED, its line says they are out, every hostage alive and
//       inside RESCUEEND.outM of that mark, men of theirs still alive;
//   (d) STAY: on a fresh floor the word and then its opposite: they stop where they stand, down again, and the row reads 'on your feet' again;
//   (e) CLEARED: all but one of theirs put down and the room stood in for 20 s — not over; the last one put down — RESCUED inside clearSecs (+0.25 s),
//       its line says the building is cleared, with the hostages never moved;
//   (f) the state saved, scribbled over and restored is the state it was;
//   (g) the switch OFF = as it was: the room taken and held RESCUE.holdSecs ends it RESCUED on its old line, and no row is offered on a hostage.
// RESCUEEND_BREAK=1 = the rule left OFF for (a)–(f) and ON for (g): the check must fail.
// exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a row is a record, a hostage on her feet is a position. Nobody has seen any of this in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const RESCUES = ['hostage-rescue', 'rescue-registry', 'rescue-consulate'], DT = 1 / 60;
const SEEDS = (process.env.RESCUEEND_SEEDS ?? '7').split(',').map(Number).filter(Number.isFinite);
const f1 = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) ? x.toFixed(1) : '—';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** a run with the stand's own words for the two switches set, so the stand-up inside stages the floor with the rules as asked */
async function pin<T>(words: Record<string, boolean>, fn: () => Promise<T>): Promise<T> {
  const was: Record<string, string | undefined> = {};
  for (const [k, on] of Object.entries(words)) { was[k] = process.env[k]; process.env[k] = on ? '1' : '0'; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(was)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

export async function rescueendCheck(): Promise<boolean> {
  const { RESCUEEND } = await import(`${ROOT}/src/game/rescueend.ts`), { RESCUEFLUSH } = await import(`${ROOT}/src/game/rescueflush.ts`), { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { answerStand, seeded } = await import('./answers.ts');
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);
  const was = { end: { ...RESCUEEND }, flush: { ...RESCUEFLUSH } }, rnd = Math.random; let all = true;
  const BREAK = process.env.RESCUEEND_BREAK === '1';
  const line = (ok: boolean, what: string, detail: string) => { if (!ok) all = false; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  /** one floor: the mission staged under `seed`, the room's own men put down by the check, Sam stood in the room */
  const floor = async (id: string, seed: number, on: boolean) => await pin({ TPS_RESCUEEND: on, TPS_RESCUEFLUSH: false }, async () => {
    Math.random = seeded(seed);
    const E = (ALL_MISSIONS as any[]).find(e => e.id === id), { W, g, why } = await answerStand(E); if (why) throw new Error(`${id}: ${why}`);
    const R = g.rescue, B = R.bounds, log = console.log;
    const step = (s: number, until?: () => boolean) => { console.log = () => {}; try { for (let i = 0; i < Math.round(s / DT); i++) { W.step(DT); if (until?.()) return true; } return false; } finally { console.log = log; } };
    const at = (what: string | RegExp) => R.log.find((l: any) => typeof what === 'string' ? l.what === what : what.test(l.what))?.t as number | undefined;
    const walk = (to: number[], speed = 2.4) => { let q = [...g.player.char.pos];
      for (const w of g.col.nav.findPath(g.player.char.pos, to, 12000) ?? [to]) { const L = flat(q, w), n = Math.max(1, Math.ceil(L / (speed * DT))); for (let i = 1; i <= n && !R.result; i++) { g.teleportPlayer([q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n]); step(DT); } q = [...w]; } };
    step(1);
    for (const c of R.cast()) if (c.inRoom) killGuard(g, c.gd, [1, 0, 0], false, 'shot', 'player');
    g.teleportPlayer([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]);
    /** Sam stood 1.2 m from a hostage, on whichever side has clear floor to her (eight tried), a frame run: her row, or null */
    const rowOn = (h: any) => { const p = h.char.pos; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.teleportPlayer([p[0] + Math.sin(a) * 1.2, 0, p[2] + Math.cos(a) * 1.2]); step(2 * DT); const it = g.interactables.find((x: any) => x.guard === h && x.inReach); if (it) return it; } return null; };
    const tap = () => { W.input.pressed.add(INTERACT_KEY); step(2 * DT); };   // (a press and its release inside one frame: the tap, as the other checks give it)
    return { W, g, R, B, step, at, walk, rowOn, tap, up: (l: any[]) => l.filter(x => x.state !== 'dead') };
  });
  try {
    for (const id of RESCUES) for (const seed of SEEDS) {
      const tag = `${id}${SEEDS.length > 1 ? ` · seed ${seed}` : ''}`, on = !BREAK;
      { // (a) (b) (c): not before, the row, out
        const F = await floor(id, seed, on), { g, R } = F;
        F.step(20);
        const others = F.up(R.hostiles).length;
        line(R.state === 'secured' && !R.result && others > 0 && F.at('secured') !== undefined, `(a) ${tag}: the room taken and stood in for 20 s does not end it`,
          `state ${R.state} · result ${R.result ? `${R.result.state} (${R.result.why})` : 'none'} · theirs alive ${others} of ${R.hostiles.length} · 'secured' at ${f1(F.at('secured'))}`);
        const h0 = F.up(R.hostages)[0], it = F.rowOn(h0), sel = g.selectVerb('guard', 'lead'); F.tap();
        const led = F.up(R.hostages).filter((h: any) => h.civ.lead === g.player.char).length;
        line(!!it && /on your feet — with me/.test(it.line2) && sel && led === F.up(R.hostages).length && R.ending.lead === g.player.char, `(b) ${tag}: Space on a hostage gets every living hostage on her feet behind the player`,
          `row ${it ? `"${it.line1}" / "${it.line2}"` : 'none'} · selected ${sel} · led ${led} of ${F.up(R.hostages).length} · 'lead' logged ${F.at('lead') !== undefined}`);
        { g.player.holstered = true; F.W.input.clicked |= 1; F.step(2 * DT); const blow = !!g.player.takedown; F.step(1.5); g.player.holstered = false;
          line(!!it && !blow && h0.state !== 'dead' && !R.result, `(b) ${tag}: a click with the hands empty beside her is no blow on a hostage`, `her row ${it ? 'in reach' : 'none'} · a takedown begun ${blow} · she is ${h0.state} · result ${R.result ? `${R.result.state} (${R.result.why})` : 'none'}`); }
        const O = R.ending.out, t0 = g.time; F.walk(O); F.step(30, () => !!R.result);
        const far = Math.max(...F.up(R.hostages).map((h: any) => flat(h.char.pos, O)));
        line(R.result?.state === 'rescued' && /hostages out$/.test(R.result.why) && R.result.hostages === R.hostages.length && far < RESCUEEND.outM && F.up(R.hostiles).length > 0, `(c) ${tag}: led back to the mark the team was staged on, the run is won`,
          `result ${R.result ? `${R.result.state} · ${R.result.grade} · ${R.result.why}` : 'none'} · ${f1(g.time - t0)} s after setting off · the farthest hostage ${f1(far)} m from the way out (outM ${RESCUEEND.outM}) · theirs alive ${F.up(R.hostiles).length}`);
      }
      { // (d) (f): stay; the state's pair
        const F = await floor(id, seed, on), { g, R } = F; F.step(1);
        const given = R.ending.word(g.player.char); F.walk(R.outsidePoint); F.step(1.5);
        const snap = JSON.parse(JSON.stringify(R.ending.snapshot())); const moved = F.up(R.hostages).filter((h: any) => flat(h.char.pos, h.civ.def.points[0]) > 1).length;
        const stayed = R.ending.word(null); F.step(2);
        const p0 = F.up(R.hostages).map((h: any) => [...h.char.pos]), far0 = Math.min(...p0.map((p: number[]) => flat(p, g.player.char.pos)));
        F.walk(R.ending.out); F.step(2);   // (on, away from them: nobody follows)
        const went = Math.min(...p0.map((p: number[]) => flat(p, g.player.char.pos))) - far0;
        const still = went > 3 && F.up(R.hostages).every((h: any, i: number) => flat(h.char.pos, p0[i]) < 0.3), down = F.up(R.hostages).every((h: any) => h.char.anim.bound === 1 && !h.civ.lead);
        const it = F.rowOn(F.up(R.hostages)[0]);
        line(given && stayed && moved > 0 && still && down && !!it && /on your feet/.test(it.line2), `(d) ${tag}: told to stay, they stop where they stand and the row offers the word again`,
          `word given ${given} · moved off their marks ${moved} · told to stay ${stayed} · Sam walked on ${f1(went)} m · stood still after ${still} · down again ${down} · row "${it?.line2 ?? 'none'}"`);
        const now = JSON.stringify(R.ending.snapshot()); R.ending.restore(snap); const back = R.ending.snapshot(), again = F.up(R.hostages).filter((h: any) => h.civ.lead === g.player.char).length;
        line(JSON.stringify(back) === JSON.stringify(snap) && now !== JSON.stringify(snap) && again === F.up(R.hostages).length, `(f) ${tag}: the rule's state saved and restored is the state it was`,
          `saved ${JSON.stringify(snap)} · before the restore ${now} · after ${JSON.stringify(back)} · led again ${again}`);
      }
      { // (e) cleared
        const F = await floor(id, seed, on), { g, R } = F; F.step(1);
        const left = F.up(R.hostiles), last = left[left.length - 1];
        for (const h of left) if (h !== last) killGuard(g, h, [1, 0, 0], false, 'shot', 'player');
        g.playerInvisible = true; F.step(20);
        const early = !!R.result; const tK = g.time; if (last.state !== 'dead') killGuard(g, last, [1, 0, 0], false, 'shot', 'player');
        F.step(RESCUEEND.clearSecs + 2, () => !!R.result);
        const unmoved = F.up(R.hostages).every((h: any) => flat(h.char.pos, h.civ.def.points[0]) < 1);
        line(!early && R.result?.state === 'rescued' && /building cleared$/.test(R.result.why) && g.time - tK <= RESCUEEND.clearSecs + 0.25 && g.time - tK >= RESCUEEND.clearSecs - 0.1 && unmoved, `(e) ${tag}: one man of theirs left alive keeps it open; the last one down ends it`,
          `over with one left ${early} · result ${R.result ? `${R.result.state} · ${R.result.why}` : 'none'} · ${f1(g.time - tK)} s after the last man (clearSecs ${RESCUEEND.clearSecs}) · hostages unmoved ${unmoved}`);
      }
      { // (g) off = as it was
        const F = await floor(id, seed, BREAK), { g, R } = F;
        const it = F.rowOn(F.up(R.hostages)[0]); g.teleportPlayer([(F.B.x0 + F.B.x1) / 2, 0, (F.B.z0 + F.B.z1) / 2]);
        F.step(RESCUE.holdSecs + 6, () => !!R.result);
        const tS = F.at('secured'), tR = F.at('rescued');
        line(!it && R.result?.state === 'rescued' && /hostages alive$/.test(R.result.why) && tS !== undefined && tR !== undefined && Math.abs(tR - tS - RESCUE.holdSecs) < 0.5, `(g) ${tag}: the switch off — the room held ${RESCUE.holdSecs} s ends it, and a hostage has no row`,
          `row ${it ? `"${it.line2}"` : 'none'} · result ${R.result ? `${R.result.state} · ${R.result.why}` : 'none'} · ${f1(tR !== undefined && tS !== undefined ? tR - tS : NaN)} s after 'secured'`);
      }
    }
  } finally { Object.assign(RESCUEEND, was.end); Object.assign(RESCUEFLUSH, was.flush); Math.random = rnd; }
  console.log(`\n=== rescueend: ${all ? 'ALL PASS' : 'FAILED'}${BREAK ? ' (RESCUEEND_BREAK=1: a failure is the expected result)' : ''} ===`);
  return all;
}
if (import.meta.main) process.exit((await rescueendCheck()) ? 0 : 1);
