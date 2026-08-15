// The 'review-b' probe family (run through probes.ts: `bun run tools/qa/probes.ts review-b | checkpoint-civilians (also rb-checkpoint-civilians) | rb-refuse-over | rb-tactics-reset | rb-gate-civilians |
// rb-laser-civilian | rb-whistle-load | rb-score-cap | rb-rain-annex | rb-glass-reset | rb-nocivilians [--verbose]`): the deep review's game-systems findings
// fixed by lane game-fixes-B (docs/internal/review-ledger.md pass 3 + pass 9), each held by a directed headless repro:
//   checkpoint-civilians  (G3.1 / G3.7) the cleaner told to stay down and the late worker knocked out are SAVED: a minute of play later the file loads to exactly
//                         that — her corner and her promise, his body where it lay (asleep), the card's counts and price unchanged but for the load; a civilian
//                         mid-run to a phone loads mid-run (same target, same spot, same path) and gets there; and right after a load whose abandoned future had
//                         run the event count on, a stun charge a metre from a working civilian FRIGHTENS him (the deafness: a fresh civilian's ear marker was
//                         stamped off the future's count) — with no second construction of the civilians on the load (the double reset). Also rides 'checkpoints'.
//   rb-refuse-over        (G3.2) a civilian killed under tune.civilianKillFails fails the run with Sam standing: canSave says so and saveState throws; a hand-made
//                         file whose stage is 'failed' (or 'done') is refused by canLoad / loadState — never poured over a living man as 'exfil'.
//   rb-tactics-reset      (G3.3) a doorway marked dangerous, then restartEncounter (and resetGuards alone): no dangerous doorway survives into the fresh shift.
//   rb-gate-civilians     (G3.4) the autosave gate names a frightened / running / telling / phoning civilian and one hiding from HIM untold; a complied one and
//                         a body are no objection; the queue of words due (a guard's radio a beat after her report) holds it too.
//   rb-laser-civilian     (G3.6) the cleaner stood in the corridor beam: the beam is drawn CUT at her shins and does not trip; gone again, the beam is whole.
//   rb-whistle-load       (G3.8) a whistle in the air at the save is not in the loaded game's event queue: nobody answers it a second time.
//   rb-score-cap          (U9.2) the timeline filled to its cap with rows, then the floor locked down: the score still drops by SCORE.lockdown; a checkpoint SAVE
//                         row is chatter past the soft cap (a LOAD row is kept), a coffee-break row likewise; the counters move regardless.
//   rb-rain-annex         (U9.9) the rain bed's gain: full out in the lot, a third inside the building AND inside the roofed stair tower (ANNEX).
//   rb-glass-reset        (U9.10) a pane starred, then restartEncounter: the glass's hit count / log go with the crack decals.
//   rb-nocivilians        (coordinator) ?nocivilians on a FRESH profile (no stored record): nobody but the shift — the URL flag is read whatever storage holds.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const SS = await import(`${ROOT}/src/game/savestate.ts`);
const { saveState, loadState, canSave, canLoad } = SS;
const CV = await import(`${ROOT}/src/game/civilians.ts`);
const { civPanic, civilianComply, civilianCompromise, CIV_STATS, loadCivTune, resetCivilians } = CV;
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { rollcallState, raiseEscalation } = await import(`${ROOT}/src/game/guards.ts`);
const { markDanger, dangerDoors } = await import(`${ROOT}/src/game/tactics.ts`);
const { tryWhistle, WHISTLE_STATS } = await import(`${ROOT}/src/game/whistle.ts`);
const { chronicle, chronCheckpoint, debriefOf, SCORE, MAX_EVENTS, SOFT_EVENTS } = await import(`${ROOT}/src/game/chronicle.ts`);
const { glassState, crackNear, glassPanes } = await import(`${ROOT}/src/game/glass.ts`);
const { ANNEX } = await import(`${ROOT}/src/game/weather.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x)), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const posS = (p: Vec3 | null | undefined) => p ? `(${f1(p[0])}, ${f1(p[2])})` : '—';
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }
let failures = 0;
export function reviewBFailures() { return failures; }
const steps = (W: any, secs: number, until?: () => boolean) => { const n = Math.max(1, Math.round(secs / DT)); for (let i = 0; i < n; i++) { W.step(DT); if (until?.()) return true; } return !until; };
/** the floor up off `seed`: god mode, Sam parked unseen on the verge, the men deaf to the staging unless asked, the radio check far off */
async function stage(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.saves.enabled = false;   // (no autosaves under the probes' feet: each case writes / loads its own)
  steps(W, 5 * DT);
  game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true; pl.crouch = true; pl.visibility = 0.02;
  rollcallState(game).nextAt = 1e9;
  const [K, N, R] = game.guards; const [M, O] = game.civilians;
  return { W, game, pl, K, N, R, M, O };
}
const civLine = (cv: any) => { const C = cv.civ; return cv.state === 'dead' ? `${cv.callsign} DOWN(${cv.downKind}) @${posS(cv.char.pos)}` : `${cv.callsign} ${C.state}${C.cause ? `[${C.cause}${C.armed ? ',armed' : ''}]` : ''}${C.target ? `→${C.target.name}` : ''}${C.complied ? ' complied' : ''}${C.reported ? ' reported' : ''} @${posS(cv.char.pos)} aw ${f2(cv.awareness)} heard ${cv.heardUpTo}`; };

// ================================================================================================================================ G3.1 / G3.7
export async function checkpointCivilians() {
  console.log('\n=== checkpoint-civilians: the civilians are IN the checkpoint — a complied cleaner + a knocked-out worker load as they were a minute later (counts and price consistent); a civilian mid-run loads mid-run and gets there; a stun charge a metre off frightens a working civilian straight after a load (no deafness); no double construction ===');
  let ok = true;
  // ---- (1) Marta grabbed and told to stay down, Owen knocked out at his desk; a manual checkpoint; a minute on; the event count run far on; the checkpoint loaded
  {
    const S = await stage(4242); const { W, game, pl, M, O } = S;
    steps(W, 60 * 2);   // (two minutes in: Marta at the filing cabinet facing east, Owen typing)
    for (const gd of game.guards) gd.heardUpTo = 1e12;   // (the shift deaf to the staging: this is about the civilians and the file)
    game.playerInvisible = false; game.teleportPlayer([M.char.pos[0] - 0.7, 0, M.char.pos[2]]); pl.char.bodyYaw = Math.PI / 2; pl.holstered = true; steps(W, 2 * DT);
    startGrab(game, M); steps(W, 3, () => pl.holding?.phase === 'held');
    const grabbed = pl.holding?.g === M;
    const complied = grabbed && civilianComply(game); steps(W, 0.5);
    killGuard(game, O, [0, 0, 1], true, 'struck');   // (the takedown's blow, by the player: −10 on the card)
    game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true;
    steps(W, 12, () => !!O.char.ragdoll?.sleeping); const settledIn = game.time - O.diedAt; steps(W, 0.5);   // (the body asleep before a plain save may file it — canSave's falling rule, civilians included now)
    if (VERBOSE) console.log(`    Owen's body asleep ${settledIn.toFixed(1)} s after the blow`);
    for (const gd of game.guards) { gd.heardUpTo = game.eventSeq; gd.awareness = 0; gd.state = 'patrol'; gd.lastKnown = null; }
    const before = { marta: { state: M.civ.state, complied: M.civ.complied, complyUntil: M.civ.complyUntil, pos: v3.copy(M.char.pos), cause: M.civ.cause }, owen: { state: O.state, downKind: O.downKind, hips: v3.copy(O.char.ragdoll?.x ? [O.char.ragdoll.x[0], O.char.ragdoll.x[1], O.char.ragdoll.x[2]] : O.char.pos), sleeping: O.char.ragdoll?.sleeping }, counts: { ...game.chronicle.counts }, score: debriefOf(game).score, t: game.time };
    const why = canSave(game); const res = why ? null : game.saves.write(game, 'manual', 'civilians');
    ok = verdict(!!grabbed && !!complied && O.state === 'dead' && !why && !!res?.ok, '(1) staged: Marta grabbed + complied, Owen out cold (his body asleep); the checkpoint writes', `grabbed ${grabbed}, complied ${complied}, Owen ${O.state}/${O.downKind} asleep after ${settledIn.toFixed(1)} s, canSave ${why ?? 'yes'}, ${res?.ok ? `${(res.bytes / 1024).toFixed(1)} KB → ${res.info.key}` : res?.why ?? '—'}; score ${before.score}, civKO ${before.counts.civKO}, civComplied ${before.counts.civComplied}`) && ok;
    if (res?.ok) {
      const fileCiv = res.state.civilians;
      ok = verdict(!!fileCiv && fileCiv.list.length === 2 && fileCiv.list.some((c: any) => c.id === 'Marta' && c.state === 'cower' && c.complied) && fileCiv.list.some((c: any) => c.id === 'Owen' && c.down?.kind === 'struck' && c.down.rag?.x?.length === 48), '(1) the file carries the civilians slice: Marta cowering + complied, Owen down (struck) with his 16 particles', fileCiv ? fileCiv.list.map((c: any) => `${c.id} ${c.down ? `down/${c.down.kind} rag ${c.down.rag ? c.down.rag.x.length / 3 : 0}` : `${c.state}${c.complied ? ' complied' : ''}`} heard ${c.heardUpTo}`).join(' · ') + ` · queue ${fileCiv.floor.pending.length}` : 'no slice') && ok;
      // a minute of the abandoned future: Sam wanders the corridor unseen; then the event count is run far on (a long future) before the load
      steps(W, 60); game.eventSeq += 1000; const seqFuture = game.eventSeq;
      const spawned0 = CIV_STATS.spawned;
      const lw = game.saves.load(game, res.info.key); W.cam.target = v3.copy(game.player.char.pos); steps(W, DT);
      const [M2, O2] = game.civilians;
      const spawnedBy = CIV_STATS.spawned - spawned0;
      const dM = v3.distXZ(M2.char.pos, before.marta.pos); const hips2: Vec3 = O2.char.ragdoll?.x ? [O2.char.ragdoll.x[0], O2.char.ragdoll.x[1], O2.char.ragdoll.x[2]] : O2.char.pos; const dO = Math.hypot(hips2[0] - before.owen.hips[0], hips2[2] - before.owen.hips[2]);
      ok = verdict(!lw && M2 !== M && M2.civ.state === 'cower' && M2.civ.complied && Math.abs(M2.civ.complyUntil - before.marta.complyUntil) < 0.02 && dM < 0.02 && !M2.held && M2.civ.cause === before.marta.cause, '(1) after the load: Marta (a fresh object) cowering where she was, complied, her promise\'s clock intact, nobody\'s arm round her', `load ${lw ?? 'ok'}; ${civLine(M2)}; ${(dM * 100).toFixed(1)} cm off; complyUntil ${f1(M2.civ.complyUntil)} (was ${f1(before.marta.complyUntil)})`) && ok;
      ok = verdict(O2.state === 'dead' && O2.downKind === 'struck' && !!O2.char.ragdoll?.sleeping && dO < 0.03 && !O2.found, '(1) after the load: Owen out cold where he lay, asleep, unfound', `${civLine(O2)}; pelvis ${(dO * 100).toFixed(1)} cm off the save, sleeping ${O2.char.ragdoll?.sleeping}`) && ok;
      const c2 = game.chronicle.counts; const sc2 = debriefOf(game).score;
      ok = verdict(c2.civKO === before.counts.civKO && c2.civComplied === before.counts.civComplied && c2.civKO === 1 && c2.civComplied === 1 && c2.loads === 1 && sc2 === before.score - SCORE.load, '(1) the card: civKO 1 / civComplied 1 carried, one load counted, the score = at-save − the load\'s price (nothing double, nothing lost)', `civKO ${c2.civKO}, civComplied ${c2.civComplied}, loads ${c2.loads}; score ${before.score} → ${sc2} (−${SCORE.load})`) && ok;
      ok = verdict(spawnedBy === 2 && M2.heardUpTo <= game.eventSeq && game.eventSeq < seqFuture, '(1) ONE construction of the two civilians on the load (restart only — no second reset in the restore), and their ear markers at or under the wound-back event count', `spawned +${spawnedBy}; Marta heardUpTo ${M2.heardUpTo} ≤ eventSeq ${game.eventSeq} (the future had reached ${seqFuture})`) && ok;
      // and the promise holds after the load: a quiet half minute with the men kept off her corner (one walking ONTO her gets it out of her — by design, not by the load), she has told nobody
      for (const gd of game.guards) { gd.hold = true; gd.heardUpTo = 1e12; }
      steps(W, 30); ok = verdict(M2.civ.state === 'cower' && !M2.civ.reported && !M2.civ.foundTold, '(1) half a minute on (the men held off her corner): still down, still silent (the promise survived the load)', civLine(M2)) && ok;
    }
  }
  // ---- (2) Owen sent running for a phone; saved MID-RUN (harness snapshot); half a minute on he has rung it in; loaded: mid-run again, same target / spot / path, and he gets there
  {
    const S = await stage(5151); const { W, game, O, M } = S;
    steps(W, 20); for (const gd of game.guards) gd.heardUpTo = 1e12;
    M.heardUpTo = 1e12;   // (Marta deaf to his shout: this case is about HIS run)
    const sent = civPanic(game, O, 'phone');
    steps(W, 6, () => O.civ.state === 'flee' && O.speed > 1.5 && O.path.length > 0 && v3.distXZ(O.char.pos, O.civ.target?.pos ?? O.char.pos) > 4);
    const mid = { state: O.civ.state, target: O.civ.target?.name ?? null, pos: v3.copy(O.char.pos), pathI: O.pathI, pathN: O.path.length, speed: O.speed, dice: O.civ.dice };
    let s: any = null; let why = '';
    try { s = saveState(game, { label: 'mid-run', kind: 'harness' }); } catch (e) { why = (e as Error).message; }
    ok = verdict(mid.state === 'flee' && !!mid.target && !!s, '(2) staged: Owen mid-run to a phone; a harness snapshot taken mid-run', `${sent}; ${civLine(O)} path ${mid.pathI}/${mid.pathN} speed ${f2(mid.speed)}; ${s ? 'saved' : why}`) && ok;
    if (s) {
      steps(W, 30); const later = `${O.civ.state}${O.civ.phoned ? ' (phoned)' : ''}`;
      loadState(game, JSON.parse(JSON.stringify(s))); W.cam.target = v3.copy(game.player.char.pos);
      const O2 = game.civilians[1]; const d = v3.distXZ(O2.char.pos, mid.pos);
      ok = verdict(O2.civ.state === 'flee' && O2.civ.target?.name === mid.target && d < 0.02 && O2.pathI === mid.pathI && O2.path.length === mid.pathN && Math.abs(O2.speed - mid.speed) < 0.01 && O2.civ.dice === mid.dice && O2.civ.pinTarget, '(2) loaded (30 s of future thrown away): Owen mid-run again — same target, same spot, same path leg, same speed, same dice, still SENT', `future was: ${later}; now ${civLine(O2)} path ${O2.pathI}/${O2.path.length} speed ${f2(O2.speed)}, ${(d * 100).toFixed(1)} cm off`) && ok;
      const t0 = game.time; steps(W, 40, () => O2.civ.state === 'phone' || O2.civ.phoned); const reachedIn = game.time - t0;
      steps(W, 12, () => O2.civ.phoned);
      ok = verdict(O2.civ.phoned, '(2) and he gets there and rings it in (the run under way survives a load functionally, not just as fields)', `on the phone after ${f1(reachedIn)} s, phoned ${O2.civ.phoned}; ${civLine(O2)}`) && ok;
    }
  }
  // ---- (3) the deafness by itself: both at work, a snapshot, ten seconds, the event count run on a thousand, the load — a stun charge a metre from Owen must frighten him on the frame
  {
    const S = await stage(6262); const { W, game } = S;
    steps(W, 2); for (const gd of game.guards) gd.heardUpTo = 1e12;
    const s = saveState(game, { label: 'ears', kind: 'harness' });
    steps(W, 10); game.eventSeq += 1000; const fut = game.eventSeq;
    loadState(game, JSON.parse(JSON.stringify(s))); W.cam.target = v3.copy(game.player.char.pos);
    for (const gd of game.guards) gd.heardUpTo = 1e12;
    const O2 = game.civilians[1]; const ear0 = O2.heardUpTo, seq0 = game.eventSeq, st0 = O2.civ.state;
    const at: Vec3 = [O2.char.pos[0] + 1.0, 0.4, O2.char.pos[2]];
    game.events.push({ kind: 'bang', pos: v3.copy(at), time: game.time, loud: true });
    steps(W, 2 * DT);
    ok = verdict(st0 === 'work' && ear0 <= seq0 && O2.civ.state === 'alarmed' && O2.civ.cause === 'bang', '(3) straight after a load whose future had run the event count on: a stun charge 1 m from the working Owen FRIGHTENS him (his ear marker ≤ the wound-back count — was stamped off the future before the fix: deaf for minutes)', `ear ${ear0} vs eventSeq ${seq0} (future ${fut}); ${st0} → ${civLine(O2)}`) && ok;
    // and a file WITHOUT the slice (an older checkpoint): fresh civilians on their marks, ears still set right
    const old = JSON.parse(JSON.stringify(s)); delete old.civilians; steps(W, 5); game.eventSeq += 500;
    loadState(game, old); const O3 = game.civilians[1];
    ok = verdict(O3.heardUpTo <= game.eventSeq && O3.civ.state === 'work', '(3b) a file from before the slice loads: fresh civilians on their marks, ear markers set right all the same', `ear ${O3.heardUpTo} ≤ ${game.eventSeq}, ${civLine(O3)}`) && ok;
  }
  console.log(`=== checkpoint-civilians: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ G3.2
export async function refuseOver() {
  console.log('\n=== rb-refuse-over: a run that is over with Sam standing (a civilian killed under civilianKillFails) cannot be saved; a file of a finished run cannot be loaded ===');
  let ok = true;
  const S = await stage(7373); const { W, game, M } = S;
  steps(W, 2); for (const gd of game.guards) gd.heardUpTo = 1e12;
  const good = saveState(game, { label: 'alive', kind: 'harness' });
  game.tune.civilianKillFails = true;
  killGuard(game, M, [0, 0, 1], false, 'shot'); steps(W, 3);
  const why = canSave(game); let threw = false; try { saveState(game, { force: true }); } catch { threw = true; }
  const gate = game.saves.gate(game);
  ok = verdict(game.mission.stage === 'failed' && !game.player.down && /run is over/.test(why ?? '') && threw && !!gate, 'the cleaner shot dead under civilianKillFails: mission failed, Sam up — canSave names it, saveState throws (forced too), the autosave gate is shut', `stage ${game.mission.stage}, down ${game.player.down}; canSave '${why}'; threw ${threw}; gate '${gate}'`) && ok;
  game.tune.civilianKillFails = false;
  for (const st of ['failed', 'done']) {
    const bad = JSON.parse(JSON.stringify(good)); bad.stage = st; bad.mission.stage = st;
    const wl = canLoad(game, bad); let lthrew = false; const stageBefore = game.mission.stage;
    try { loadState(game, bad); } catch { lthrew = true; }
    ok = verdict(/finished run/.test(wl ?? '') && lthrew && game.mission.stage === stageBefore, `a hand-made file with stage '${st}': canLoad names it, loadState throws, the running game untouched (never rewritten to 'exfil')`, `canLoad '${wl}'; threw ${lthrew}; stage still ${game.mission.stage}`) && ok;
    const viaSaves = game.saves.load(game, bad); ok = verdict(typeof viaSaves === 'string' && /finished run/.test(viaSaves), `…and Checkpoints.load says the same for '${st}'`, `'${viaSaves}'`) && ok;
  }
  { const fine = JSON.parse(JSON.stringify(good)); const wl = canLoad(game, fine); let lthrew = false; try { loadState(game, fine); } catch (e) { lthrew = true; if (VERBOSE) console.log((e as Error).message); } ok = verdict(!wl && !lthrew && game.mission.stage === 'infiltrate' && game.civilians[0].state !== 'dead', 'the same file with its honest stage loads (and the cleaner is alive again in it)', `canLoad ${wl ?? 'ok'}, threw ${lthrew}, stage ${game.mission.stage}, ${civLine(game.civilians[0])}`) && ok; }
  console.log(`=== rb-refuse-over: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ G3.3
export async function tacticsResetProbe() {
  console.log('\n=== rb-tactics-reset: a doorway marked dangerous does not survive restartEncounter / resetGuards into the fresh shift ===');
  let ok = true;
  const S = await stage(8484); const { W, game } = S;
  const d = game.doors.byName('storage') ?? game.doors.list[0];
  markDanger(game, d, 'guard', 'rounds', 'Kowalski'); steps(W, 2 * DT);
  const n0 = dangerDoors(game).length;
  game.restartEncounter(); steps(W, 2 * DT);
  const n1 = dangerDoors(game).length;
  ok = verdict(n0 === 1 && n1 === 0, 'markDanger → 1 dangerous doorway; restartEncounter → none', `${n0} → ${n1}`) && ok;
  markDanger(game, d, 'guard', 'body', 'Novak'); const n2 = dangerDoors(game).length; game.resetGuards(); const n3 = dangerDoors(game).length;
  ok = verdict(n2 === 1 && n3 === 0, 'and resetGuards alone (the tour\'s stops reset the men through it) drops it too', `${n2} → ${n3}`) && ok;
  // a checkpoint's kill-zone doorway still comes back through a load (tacticsRestore runs after the reset)
  { for (const gd of game.guards) gd.heardUpTo = 1e12; markDanger(game, d, 'guard', 'rounds', 'Reyes'); const s = saveState(game, { kind: 'harness' }); game.restartEncounter(); const nA = dangerDoors(game).length; loadState(game, JSON.parse(JSON.stringify(s))); const nB = dangerDoors(game).length;
    ok = verdict(nA === 0 && nB === 1, 'a checkpoint\'s dangerous doorway still comes back through a load (the restore runs after the reset)', `after restart ${nA}, after load ${nB}`) && ok; }
  console.log(`=== rb-tactics-reset: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ G3.4
export async function gateCivilians() {
  console.log('\n=== rb-gate-civilians: the autosave gate holds for a frightened / running / telling / phoning civilian, one hiding from him untold, and a word of theirs on its way; a complied one / a body are no objection ===');
  let ok = true;
  const S = await stage(9595); const { W, game, pl, M, O, N } = S;
  steps(W, 60 * 2); for (const gd of game.guards) { gd.heardUpTo = 1e12; gd.hold = true; }   // (the men parked deaf: the gate's guard terms are the checkpoint family's business; here only the civilians move it)
  const G = () => game.saves.gate(game);
  const g0 = G();
  ok = verdict(g0 === null, 'a calm floor two minutes in: the gate is open', `${g0 ?? 'open'}`) && ok;
  // frightened → running → (report or phone) → cower reported: the gate names her throughout, and opens once it is in the men's hands (or she is down and quiet)
  O.heardUpTo = 1e12;
  civPanic(game, M, 'panic'); steps(W, DT);
  const seen: Record<string, { gate: string | null; civ: string | null }> = {}; const t0 = game.time;
  for (let f = 0; f < 60 * 45; f++) { W.step(DT); const st = M.civ.state; if (!(st in seen)) seen[st] = { gate: G(), civ: civilianCompromise(game) }; if (st === 'cower' && G() === null) break; }
  const badOpen = Object.entries(seen).filter(([st, w]) => ['alarmed', 'flee', 'report', 'phone'].includes(st) && !(w.gate && w.civ && /Marta/.test(w.civ)));   // (the gate itself may name the man her scream raised first — as shut; the civilians' own term must name HER)
  ok = verdict(('alarmed' in seen || 'flee' in seen) && badOpen.length === 0, 'panicked: while alarmed / fleeing / reporting / phoning the gate is SHUT and the civilians\' term names her', Object.entries(seen).map(([st, w]) => `${st}: gate '${w.gate ?? 'open'}' / civ '${w.civ ?? '—'}'`).join(' · ')) && ok;
  // the queue: right after she has told a man, his radio call is due a beat later — the gate says so (or names the man she raised, which is as shut)
  const qWhy = civilianCompromise(game);
  if (VERBOSE) console.log(`    after ${f1(game.time - t0)} s: ${civLine(M)}; compromise '${qWhy}'; gate '${G()}'`);
  // settle: let the floor calm right down (the man she told searches, gives up); the men re-parked calm; she is cowering REPORTED → no objection of hers
  steps(W, 5); for (const gd of game.guards) { gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.task = null; gd.reactT = 0; } game.escalation = 0; game.escalationT = -1; game.alarm.episode = false; steps(W, 4);
  const cw = civilianCompromise(game);
  ok = verdict(M.civ.state === 'cower' ? (M.civ.reported ? cw === null || !/Marta is/.test(cw) : /Marta/.test(cw ?? '')) : true, 'cowering and REPORTED (it is in the men\'s hands): she is no objection; cowering unreported from HIM would be', `${civLine(M)} → '${cw ?? 'none'}'`) && ok;
  // hiding from HIM, nobody told: shut. Told to stay down: open. A body: open.
  { const C = M.civ; const keep = { state: C.state, cause: C.cause, reported: C.reported, complied: C.complied };
    C.state = 'cower'; C.cause = 'sam'; C.reported = false; C.complied = false; const hid = civilianCompromise(game);
    C.complied = true; C.complyUntil = game.time + 60; const cmp = civilianCompromise(game);
    C.cause = 'noise'; C.complied = false; const noise = civilianCompromise(game);
    Object.assign(C, keep);
    ok = verdict(/hiding/.test(hid ?? '') && (cmp === null || !/Marta/.test(cmp)) && (noise === null || !/Marta/.test(noise)), 'cowering unreported after SEEING him: shut ("hiding from you"); the same but told to stay down: open; cowering from a mere crash: open', `sam/untold '${hid}' · complied '${cmp ?? 'open'}' · noise '${noise ?? 'open'}'`) && ok; }
  { for (const cv of game.civilians) cv.heardUpTo = 1e12; killGuard(game, O, [0, 0, 1], true, 'struck'); steps(W, 3); const b = civilianCompromise(game); ok = verdict(b === null || !/Owen/.test(b), 'a civilian out cold on the floor is no objection (an unfound body is none either)', `'${b ?? 'open'}'`) && ok; }
  // the queue term directly: a report just delivered → 'reportRadio' pending → shut for its beat
  { const S2 = await stage(9696); const { W: W2, game: g2, M: M2, N: N2 } = S2; steps(W2, 60); for (const gd of g2.guards) { gd.heardUpTo = 1e12; }
    N2.hold = false; N2.char.pos = [M2.char.pos[0] + 1.2, 0, M2.char.pos[2]]; N2.char.update(0); N2.state = 'patrol'; N2.awareness = 0;
    civPanic(g2, M2, 'panic'); let sawQueue: string | null = null;
    for (let f = 0; f < 60 * 30 && !sawQueue; f++) { W2.step(DT); const w = civilianCompromise(g2); if (w && /about to/.test(w)) sawQueue = w; }
    ok = verdict(!!sawQueue, 'the queue of words due holds the gate for its beat (a guard\'s radio call after her telling / the floor step after that)', `'${sawQueue ?? 'never seen'}' (${civLine(M2)})`) && ok; }
  void pl; void N;
  console.log(`=== rb-gate-civilians: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ G3.6
export async function laserCivilian() {
  console.log('\n=== rb-laser-civilian: the cleaner standing in the corridor beam cuts the DRAWN beam at her legs and trips nothing; gone, the beam is whole again ===');
  let ok = true;
  const S = await stage(1717); const { W, game, M } = S;
  const L = game.devices?.lasers?.[0];
  if (!L) { ok = verdict(false, 'a tripwire on the level', 'none'); console.log('=== rb-laser-civilian: FAILURES above ==='); failures++; return false; }
  steps(W, 0.5); const full = L.cut, len = L.len, trips0 = L.trips;
  const mid: Vec3 = [(L.def.from[0] + L.def.to[0]) / 2, 0, (L.def.from[2] + L.def.to[2]) / 2];
  const park = (p: Vec3) => { M.char.pos = v3.copy(p); M.char.vel = [0, 0, 0]; M.speed = 0; M.path = []; M.pathGoal = null; M.wait = 100; M.civ.state = 'work'; M.civ.settleT = -1; M.char.update(0); };
  park(mid); steps(W, 3 * DT); park(mid); steps(W, 2 * DT);
  const cutIn = L.cut, trips1 = L.trips; const expect = v3.dist(L.def.from, [mid[0], L.def.from[1], mid[2]]);
  ok = verdict(cutIn < len - 0.3 && Math.abs(cutIn - expect) < 0.45 && trips1 === trips0, 'Marta stood mid-beam: the beam ends at her (cut ≈ emitter → her legs) and no trip is filed (staff, to the system)', `len ${f2(len)} m, cut ${f2(full)} → ${f2(cutIn)} m (she stands ${f2(expect)} m from the emitter), trips ${trips0} → ${trips1}`) && ok;
  park([mid[0] + 3, 0, mid[2] + 6]); steps(W, 3 * DT);
  ok = verdict(Math.abs(L.cut - full) < 0.02, 'gone again: the beam is whole', `cut ${f2(L.cut)} (whole ${f2(full)})`) && ok;
  console.log(`=== rb-laser-civilian: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ G3.8
export async function whistleLoad() {
  console.log('\n=== rb-whistle-load: a whistle in the air at the save is not put back by the load — nobody answers it twice ===');
  let ok = true;
  const S = await stage(2828); const { W, game, pl, K } = S;
  steps(W, 1);
  // Sam in the corridor six metres west of Kowalski, unseen but audible; he whistles; the same frame is saved (forced harness snapshot: the event is in the queue)
  game.playerInvisible = false; pl.visibility = 0.02; game.teleportPlayer([K.char.pos[0] - 6, 0, K.char.pos[2]]); steps(W, 2 * DT); pl.visibility = 0.02;
  const blew = tryWhistle(game);
  const inQueue = game.events.some((e: any) => e.kind === 'whistle');
  const s = saveState(game, { kind: 'harness', force: true });
  const fileHas = s.events.some((e: any) => e.kind === 'whistle');
  steps(W, 0.3); const res0 = WHISTLE_STATS.resolved, ans0 = WHISTLE_STATS.answered;
  loadState(game, JSON.parse(JSON.stringify(s))); W.cam.target = v3.copy(game.player.char.pos);
  const afterLoad = game.events.some((e: any) => e.kind === 'whistle');
  steps(W, 1.0);
  const res1 = WHISTLE_STATS.resolved, ans1 = WHISTLE_STATS.answered;
  ok = verdict(blew && inQueue && fileHas && !afterLoad && res1 === res0 && ans1 === ans0, 'blown, in the queue, in the file — and NOT in the loaded game\'s queue: no second resolution, no second answer over the next second', `blew ${blew}, queue ${inQueue}, file ${fileHas}, after load ${afterLoad}; resolved ${res0} → ${res1}, answered ${ans0} → ${ans1}; Kowalski ${game.guards[0].state} aw ${f2(game.guards[0].awareness)}`) && ok;
  console.log(`=== rb-whistle-load: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ U9.2
export async function scoreCap() {
  console.log('\n=== rb-score-cap: the timeline at its cap still prices a lockdown; a checkpoint SAVE row / a coffee-break row are chatter past the soft cap, a LOAD row is kept; counters move regardless ===');
  let ok = true;
  const S = await stage(3939); const { W, game } = S;
  steps(W, 0.5); for (const gd of game.guards) { gd.heardUpTo = 1e12; gd.hold = true; }
  const C = game.chronicle;
  // to the soft cap with plain rows; then chatter is refused but counted
  while (C.events.length < SOFT_EVENTS) chronicle(game, 'objective', { text: 'filler' });
  const n0 = C.events.length; chronCheckpoint(game, 'save', 'x'); const nSave = C.events.length; const saves = C.counts.saves;
  chronCheckpoint(game, 'load', 'x'); const nLoad = C.events.length; const loads = C.counts.loads;
  chronicle(game, 'needBreak', { who: 'Kowalski', kind: 'coffee', what: 'left' }); const nNeed = C.events.length;
  ok = verdict(n0 === SOFT_EVENTS && nSave === n0 && saves === 1 && nLoad === n0 + 1 && loads === 1 && nNeed === nLoad, `at the soft cap (${SOFT_EVENTS}): a checkpoint SAVE row is refused (chatter) but counted, a LOAD row lands and is counted, a needBreak row is refused`, `rows ${n0} → save ${nSave} (saves ${saves}) → load ${nLoad} (loads ${loads}) → needBreak ${nNeed}; dropped ${C.dropped}`) && ok;
  // to the hard cap; then the floor locks down: no row can land, the price must
  while (C.events.length < MAX_EVENTS) chronicle(game, 'objective', { text: 'filler' });
  const score0 = debriefOf(game).score, esc20 = C.counts.esc2, rows0 = C.events.length, dropped0 = C.dropped;
  raiseEscalation(game, 2, null, 'search'); steps(W, DT);
  const score1 = debriefOf(game).score, esc21 = C.counts.esc2;
  ok = verdict(rows0 === MAX_EVENTS && C.events.length === MAX_EVENTS && esc21 === esc20 + 1 && score1 === score0 - SCORE.lockdown, `at the hard cap (${MAX_EVENTS}): the lockdown's row is dropped but esc2 counts and the score drops by SCORE.lockdown (${SCORE.lockdown})`, `rows ${rows0} → ${C.events.length} (dropped ${dropped0} → ${C.dropped}); esc2 ${esc20} → ${esc21}; score ${score0} → ${score1}`) && ok;
  console.log(`=== rb-score-cap: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ U9.9
export async function rainAnnex() {
  console.log('\n=== rb-rain-annex: the rain bed is a third indoors — inside the building AND inside the roofed stair tower — and full out in the lot ===');
  let ok = true;
  const S = await stage(1414); const { W, game } = S;
  let bed = -1; game.audio.rain = (v: number) => { bed = v; };
  const wx = game.weather; wx.setEnabled(true); wx.rainRate = 1; wx.storm = 0;
  const at = (p: Vec3) => { game.player.char.pos = v3.copy(p); wx.update(DT, 0); return bed; };   // (a raw write and the weather's own update: the bed reads the position only, and the annex's floor is the QRF's landing — no walk there to be had, and no collision to argue with in between)
  void W;
  const lot = at([20, 0, 26]), lobby = at([8, 0, 18]), annex = at([(ANNEX[0] + ANNEX[2]) / 2, 0, (ANNEX[1] + ANNEX[3]) / 2]), verge = at([2, 0, 2]);
  ok = verdict(lot > 0.9 && verge > 0.9 && Math.abs(lobby - lot * 0.32) < 0.02 && Math.abs(annex - lobby) < 0.02, 'lot / verge full; lobby a third; the stair tower (ANNEX) a third like the lobby (was full before the fix)', `lot ${f2(lot)} · verge ${f2(verge)} · lobby ${f2(lobby)} · annex ${f2(annex)}`) && ok;
  console.log(`=== rb-rain-annex: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ U9.10
export async function glassReset() {
  console.log('\n=== rb-glass-reset: the glass\'s hit count / log go with the crack decals on restartEncounter ===');
  let ok = true;
  const S = await stage(1515); const { W, game } = S;
  const panes = glassPanes(game); const b = game.level.boxes[panes[0]];
  const n = crackNear(game, [b.c[0], b.c[1], b.c[2]], 0.5, 0); steps(W, DT);
  const GS = glassState(game); const hits0 = GS.hits, log0 = GS.log.length, decals0 = game.decals.list.filter((d: any) => d.kind === 'glassHit').length;
  game.restartEncounter(); steps(W, DT);
  const GS2 = glassState(game);
  ok = verdict(n >= 1 && hits0 >= 1 && log0 >= 1 && decals0 >= 1 && GS2.hits === 0 && GS2.log.length === 0 && GS2.lastHitT <= -100 && game.decals.list.length === 0, 'a pane starred (hits, log, decals) → restart → hits 0, log empty, decals gone', `${n} pane(s): hits ${hits0} / log ${log0} / stars ${decals0} → hits ${GS2.hits} / log ${GS2.log.length} / decals ${game.decals.list.length}`) && ok;
  console.log(`=== rb-glass-reset: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================================================================================ ?nocivilians on a fresh profile
export async function nociviliansFresh() {
  console.log('\n=== rb-nocivilians: ?nocivilians with NOTHING in storage (a fresh profile) still means nobody but the shift ===');
  let ok = true;
  const S = await stage(1616); const { game } = S;
  const G = globalThis as any; const hadLS = 'localStorage' in G, hadLoc = 'location' in G; const ls0 = G.localStorage, loc0 = G.location;
  const mem = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); } };
  try {
    G.location = { search: '?nocivilians' };
    game.tune.civilians = true; loadCivTune(game); const fresh = game.tune.civilians;
    mem.set('twopointsix.civilians', JSON.stringify({ on: true, killFails: false, greet: true })); game.tune.civilians = true; loadCivTune(game); const stored = game.tune.civilians;
    G.location = { search: '' }; game.tune.civilians = false; loadCivTune(game); const noFlag = game.tune.civilians;   // (the stored 'on' comes back with no flag)
    game.tune.civilians = fresh; resetCivilians(game); const onFloor = game.civilians.length;
    ok = verdict(fresh === false && stored === false && noFlag === true && onFloor === 0, 'fresh storage + ?nocivilians → off; a stored "on" + ?nocivilians → off; the stored "on" alone → on; and off means nobody spawned', `fresh ${fresh} · stored+flag ${stored} · stored alone ${noFlag} · civilians on the floor with it off: ${onFloor}`) && ok;
  } finally {
    if (hadLS) G.localStorage = ls0; else delete G.localStorage;
    if (hadLoc) G.location = loc0; else delete G.location;
  }
  console.log(`=== rb-nocivilians: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}
