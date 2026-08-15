// The 'audio-hold' probe (run through probes.ts: `bun run tools/qa/probes.ts audio-hold`): the hold's sounds fire at the right moments, once each, at the pair —
// grabScuffle on the grab, heldProtest as the arm locks and under each answer, murmur with each question Sam gets in, chokeStrain in grains while (and only
// while) the choke is on, chokeLimp as he folds, whipThud as the pistol lands, shove on the release (and, quieter, when a round tears the man loose). Nothing can
// be heard headless: this records what WOULD have played (headless.ts W.audioLog — name, position, gain, game time), stages every beat of the hold through the
// real inputs (Space held / tapped / E on his row, as grab-probes and gunhold-probes do), and checks the log against the moment: the intended names exactly once,
// no per-frame repeats, the choke's grains ≤ 3 a second and none after Space comes up, every one of them placed on the pair at chest-to-head height with the
// gain player.ts means. What they SOUND like is tools/qa/audio-render.ts's business (and a human ear).
import { standUp, ROOT } from './headless.ts';
import { endThenStop, endFor } from './verbs.ts';
import type { AudioCall } from './headless.ts';
const IK = 'Space';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
/** seconds stepped after the grab's one-frame Space tap on his row (interact.ts: the tap grabs in its own frame) before waiting for the hold proper — the recorder wants the same stretch it always had */
const PRESS_SECS = 0.45;

type Vec3 = [number, number, number];
const DT = 1 / 60;
/** the hold's own voices (sfx.ts) and the gains player.ts plays them at (heldProtest: 0.18 as the arm locks, 0.16 under an answer; shove: 0.55 pushed, 0.3 torn loose) */
const HOLD_VOICES = ['grabScuffle', 'heldProtest', 'murmur', 'chokeStrain', 'chokeLimp', 'whipThud', 'shove'];
const GAINS: Record<string, number[]> = { grabScuffle: [0.4], heldProtest: [0.18, 0.16], murmur: [0.2], chokeStrain: [0.25], chokeLimp: [0.35], whipThud: [0.7], shove: [0.55, 0.3] };
const CHOKE_GRAIN = 0.4;   // player.ts's (private there): the strain grain's spacing

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
function holdKey(W: any, code: string, secs: number, each?: () => void): number { const n = Math.max(1, Math.round(secs / DT)); W.input.keys.add(code); W.input.pressed.add(code); for (let i = 0; i < n; i++) { W.step(DT); each?.(); } W.input.keys.delete(code); return n; }
function tapKey(W: any, code: string) { W.input.pressed.add(code); }
const f2 = (x: number) => x.toFixed(2);

/** A (Kowalski) planted mid-corridor facing east, calm; B and C parked deaf on the lot; Sam crouched dark 0.8 m behind A with the pistol holstered (the arm variant)
 *  or drawn (the gun variant); one settled frame; the recorder on from here */
async function stage(seed: number, drawn: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.player.visibility = 0.02; game.godMode = true;
  game.player.slot = 'pistol'; game.player.holstered = !drawn; game.player.pistol.lightOn = false;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; const at: Vec3 = [14, 0, 11.2], yaw = Math.PI / 2;
  place(A, at, yaw); A.wp = 1; park(B, 0); park(C, 1);
  game.teleportPlayer([at[0] - Math.sin(yaw) * 0.8, 0, at[2] - Math.cos(yaw) * 0.8]); game.player.crouch = true; W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); game.player.visibility = 0.02;
  const msgs: { t: number; text: string }[] = []; const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
  const log: AudioCall[] = []; W.audioLog = log;
  return { W, game, A, B, C, log, msgs };
}
/** grab A through the real press (cursor on him, a one-frame Space tap on his 'grab him' row — the grab is on that frame), then step until the hold proper has begun and one frame more */
function grabAndSettle(S: any): { grabT: number; heldT: number } {
  const { W, game, A } = S; let grabT = -1, heldT = -1;
  W.cursorAt(v3.add(A.char.pos, [0, 1.35, 0]));
  W.input.pressed.add(IK); for (let i = 0; i < Math.max(1, Math.round(PRESS_SECS / DT)); i++) { W.step(DT); if (grabT < 0 && game.player.holding) grabT = game.time; }
  for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT);
  if (game.player.holding?.phase === 'held') heldT = game.time;
  W.step(DT);
  return { grabT, heldT };
}
/** the hold voices in the log inside [t0, t1] (game time, inclusive both ends with a hair of tolerance) */
function voicesIn(log: AudioCall[], t0: number, t1: number): AudioCall[] { return log.filter(c => HOLD_VOICES.includes(c.name) && c.t >= t0 - 1e-6 && c.t <= t1 + 1e-6); }
const tally = (cs: AudioCall[]) => { const m = new Map<string, number>(); for (const c of cs) m.set(c.name, (m.get(c.name) ?? 0) + 1); return [...m.entries()].map(([k, n]) => `${k}×${n}`).join(' ') || '—'; };
const count = (cs: AudioCall[], name: string) => cs.filter(c => c.name === name).length;
/** every hold voice in `cs` sits on `who` (XZ within 0.7 m of where he is now — the pair is rooted for every beat checked this way) between 1.2 and 1.75 m up, at one of its known gains */
function placedOn(cs: AudioCall[], who: Vec3, fails: string[], label: string) {
  for (const c of cs) {
    if (!c.pos) { fails.push(`${label}: ${c.name} played non-positional`); continue; }
    const d = Math.hypot(c.pos[0] - who[0], c.pos[2] - who[2]);
    if (d > 0.7 || c.pos[1] < 1.2 || c.pos[1] > 1.75) fails.push(`${label}: ${c.name} at (${f2(c.pos[0])}, ${f2(c.pos[1])}, ${f2(c.pos[2])}) — ${f2(d)} m off the pair / not at chest-head height`);
    if (!(GAINS[c.name] ?? []).some(g => Math.abs(g - c.gain) < 1e-6)) fails.push(`${label}: ${c.name} at gain ${c.gain} (want ${GAINS[c.name]?.join(' or ')})`);
  }
}
/** the most hold-voice calls of one name inside any 1 s window, and whether any name repeats within one frame */
function spamCheck(log: AudioCall[]): { worst: string; perSec: number; sameFrame: string[] } {
  let perSec = 0, worst = '';
  for (const n of HOLD_VOICES) { const ts = log.filter(c => c.name === n).map(c => c.t); for (let i = 0; i < ts.length; i++) { let k = 0; for (let j = i; j < ts.length && ts[j] < ts[i] + 1 - 1e-6; j++) k++; if (k > perSec) { perSec = k; worst = n; } } }
  const sameFrame: string[] = []; const seen = new Set<string>();
  for (const c of log) { if (!HOLD_VOICES.includes(c.name)) continue; const key = `${c.name}@${c.t.toFixed(5)}`; if (seen.has(key)) sameFrame.push(`${c.name} twice at ${f2(c.t)} s`); seen.add(key); }
  return { worst, perSec, sameFrame };
}

export async function audioHold() {
  console.log('\n=== audio-hold: the hold\'s sounds — grab, his first muffle, question / answer, the choke\'s grains (eased off, then through), the fold, the whip, the shove, torn loose — each once, at the pair, no spam ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };

  // ================================================================ (a) the arm variant, start to finish: grab → settle → idle → a question, a tap too soon, another question → a choke eased off → a choke through to the fold
  {
    const S = await stage(51, false); const { W, game, A, log, msgs } = S;
    const fails: string[] = [];
    const { grabT, heldT } = grabAndSettle(S);
    if (grabT < 0 || heldT < 0) fails.push(`staging: grab at ${grabT}, held at ${heldT}`);
    const pairAt = (): Vec3 => v3.copy(A.char.pos);
    // the grab: grabScuffle once, on the frame the hold began; nothing else of the hold's until it locks
    const grabWin = voicesIn(log, grabT, grabT + 1e-4);
    if (count(grabWin, 'grabScuffle') !== 1 || grabWin.length !== 1) fails.push(`grab frame: ${tally(grabWin)} (want grabScuffle×1 alone)`);
    const reach = voicesIn(log, grabT + 1e-3, heldT - 1e-3); if (reach.length) fails.push(`during the reach: ${tally(reach)} (want nothing)`);
    // the lock: heldProtest once at 0.18, HOLD.secs.grab after the grab
    const lockWin = voicesIn(log, heldT - 1e-4, heldT + 1e-4);
    if (count(lockWin, 'heldProtest') !== 1 || lockWin.length !== 1 || Math.abs(lockWin[0]?.gain - 0.18) > 1e-6) fails.push(`lock frame: ${tally(lockWin)} gain ${lockWin[0]?.gain} (want heldProtest×1 at 0.18)`);
    if (Math.abs((heldT - grabT) - HOLD.secs.grab) > 0.03) fails.push(`locked ${f2(heldT - grabT)} s after the grab (want ${HOLD.secs.grab})`);
    placedOn([...grabWin, ...lockWin], pairAt(), fails, 'grab/lock');
    // 1.5 s held, hands off: silence from the hold
    const tIdle = game.time; for (let i = 0; i < 90; i++) W.step(DT);
    const idle = voicesIn(log, tIdle + 1e-4, game.time); if (idle.length) fails.push(`1.5 s idle in the hold: ${tally(idle)} (want nothing)`);
    // a question is an EXCHANGE (player.ts askHeld / answerHeld): murmur 0.2 on the tap's frame as Sam's own line goes up over him, then — a beat later, when it
    // ends (samBeat: 0.9‥1.4 s) — the man answers (talk.stage goes up) with heldProtest 0.16 under his bubble; nothing in between
    const st0 = A.talk.stage; tapKey(W, IK); W.step(DT); const tQ1 = game.time - DT; const asked1 = !!game.player.holding?.ask;   // (the tap is read inside the step: its calls carry the time the step began with… game.time advances at the top or bottom — take the window generously)
    const q1 = voicesIn(log, tQ1 - DT, game.time);
    if (!asked1 || A.talk.stage !== st0) fails.push(`staging: the first tap did not open an exchange (ask ${asked1}, stage ${st0} → ${A.talk.stage} — he answers a beat later, not now)`);
    if (count(q1, 'murmur') !== 1 || q1.length !== 1) fails.push(`question 1, the tap's frame: ${tally(q1)} (want murmur×1 alone — the muffle comes with the answer)`);
    const mu1 = q1.find(c => c.name === 'murmur'); if (mu1?.pos && Math.hypot(mu1.pos[0] - game.player.char.pos[0], mu1.pos[2] - game.player.char.pos[2]) > 0.3) fails.push(`murmur ${f2(Math.hypot(mu1.pos[0] - game.player.char.pos[0], mu1.pos[2] - game.player.char.pos[2]))} m off Sam`);
    // a tap 0.4 s later, while Sam is still speaking: nothing at all (his line is never cut; the answer is already on its way)
    for (let i = 0; i < 23; i++) W.step(DT);
    const tMid = game.time; tapKey(W, IK); W.step(DT);
    const mid = voicesIn(log, tMid - DT, game.time);
    if (mid.length || A.talk.stage !== st0) fails.push(`a tap while Sam speaks: ${tally(mid)}, stage ${A.talk.stage} (want nothing)`);
    // the answer lands when Sam's bubble ends: heldProtest×1 at 0.16 on that frame, on the pair, and silence from the tap till then
    const tWait = game.time; let tA1 = -1; for (let i = 0; i < 120 && A.talk.stage === st0; i++) { W.step(DT); if (A.talk.stage === st0 + 1) tA1 = game.time; }
    const st1 = A.talk.stage;
    if (tA1 < 0) fails.push('no answer within 2 s of the question');
    else {
      const between = voicesIn(log, tWait + 1e-4, tA1 - DT - 1e-4); if (between.length) fails.push(`between Sam's line and the answer: ${tally(between)} (want nothing)`);
      const a1 = voicesIn(log, tA1 - DT, tA1);
      if (count(a1, 'heldProtest') !== 1 || a1.length !== 1) fails.push(`the answer's frame: ${tally(a1)} (want heldProtest×1 alone)`);
      const hp1 = a1.find(c => c.name === 'heldProtest'); if (hp1 && Math.abs(hp1.gain - 0.16) > 1e-6) fails.push(`the answer's muffle at gain ${hp1.gain} (want 0.16)`);
      const beat = tA1 - DT - tQ1; if (beat < 0.9 - DT - 1e-6 || beat > 1.4 + DT + 1e-6) fails.push(`the answer came ${f2(beat)} s after the tap (want Sam's beat, 0.9‥1.4 s)`);
      placedOn(a1, pairAt(), fails, 'answer 1');
    }
    // a tap 0.4 s into the answer: too soon — it cuts his line, Sam says nothing, so no murmur and no muffle
    for (let i = 0; i < 23; i++) W.step(DT);
    const tCut = game.time; tapKey(W, IK); W.step(DT); const st2 = A.talk.stage;
    const cut = voicesIn(log, tCut - DT, game.time);
    if (st2 !== st1 || game.player.holding?.ask) fails.push(`staging: the too-soon tap opened an exchange (stage ${st1} → ${st2}, ask ${!!game.player.holding?.ask})`);
    if (cut.length) fails.push(`the too-soon tap: ${tally(cut)} (want nothing — the line was only cut)`);
    // 1.5 s on, another: taken again → murmur now, heldProtest with the answer a beat later
    for (let i = 0; i < 90; i++) W.step(DT);
    const tQ2 = game.time; tapKey(W, IK); W.step(DT);
    const q2 = voicesIn(log, tQ2 - DT, game.time);
    if (!game.player.holding?.ask) fails.push('staging: the third tap was not taken');
    if (count(q2, 'murmur') !== 1 || q2.length !== 1) fails.push(`question 2, the tap's frame: ${tally(q2)} (want murmur×1 alone)`);
    let tA2 = -1; for (let i = 0; i < 120 && A.talk.stage === st2; i++) { W.step(DT); if (A.talk.stage === st2 + 1) tA2 = game.time; }
    if (tA2 < 0) fails.push('no second answer within 2 s');
    else { const a2 = voicesIn(log, tQ2 + DT + 1e-3, tA2); if (count(a2, 'heldProtest') !== 1 || a2.length !== 1) fails.push(`from Sam's second line to its answer: ${tally(a2)} (want heldProtest×1, on the answer)`); placedOn(a2, pairAt(), fails, 'answer 2'); }
    for (let i = 0; i < 40; i++) W.step(DT);
    // ---- the choke, chosen on its row and stopped by a second tap 1.5 s on: the choke is on for 1.15 s of it → grains at its 0, 0.4, 0.8 = 3; then back to held, and NO grain after
    const tC = game.time; let chokeOn = -1;
    endThenStop(W, 1.5, () => { if (chokeOn < 0 && game.player.holding?.phase === 'choke') chokeOn = game.time; });
    const tUp = game.time - DT; const phaseAfter = (() => { W.step(DT); W.step(DT); return game.player.holding?.phase; })();   // (the stopping tap was read inside the last step: the choke ended as that frame began)
    for (let i = 0; i < 60; i++) W.step(DT);
    const grainsA = voicesIn(log, tC, tUp).filter(c => c.name === 'chokeStrain'); const after = voicesIn(log, tUp + 1e-4, game.time);
    const chokeSecs = tUp - chokeOn; const wantA = chokeOn < 0 ? 0 : Math.floor((chokeSecs - 1e-6) / CHOKE_GRAIN) + 1;
    if (chokeOn < 0) fails.push('staging: the choke never began in 1.5 s from its row');
    if (grainsA.length !== wantA) fails.push(`eased-off choke: ${grainsA.length} grains over ${f2(chokeSecs)} s of choke (want ${wantA}: one as it goes on, one every ${CHOKE_GRAIN} s)`);
    if (grainsA.length >= 2) { const gaps = grainsA.slice(1).map((c, i) => c.t - grainsA[i].t); if (gaps.some(gp => Math.abs(gp - CHOKE_GRAIN) > DT + 1e-6)) fails.push(`grain spacing ${gaps.map(f2).join('/')} s (want ${CHOKE_GRAIN})`); }
    if (grainsA[0] && Math.abs(grainsA[0].t - chokeOn) > DT + 1e-6) fails.push(`first grain ${f2(grainsA[0].t - chokeOn)} s after the choke went on (want the same frame)`);
    if (phaseAfter !== 'held' || A.state === 'dead') fails.push(`after easing off: phase ${phaseAfter}, A ${A.state} (want held, alive)`);
    if (count(after, 'chokeStrain') || count(after, 'chokeLimp')) fails.push(`after Space came up: ${tally(after)} (want no strain, no limp — nothing to stop, nothing more started)`);
    if (voicesIn(log, tC, tUp).some(c => c.name !== 'chokeStrain')) fails.push(`during the choke: ${tally(voicesIn(log, tC, tUp))} (want only the grains)`);
    placedOn(grainsA, pairAt(), fails, 'grains');
    const easedMsg = msgs.some(m => /eased off/.test(m.text));
    if (!easedMsg) fails.push('no eased-off line (staging)');
    // ---- the choke through: chosen, 0.35 to commit + 2.6 (+ a hair) → grains at 0 … 2.0 (the guard in player.ts drops the one at 2.4: the last grain dies as he goes), chokeLimp once on the fold frame, then silence from the hold
    for (let i = 0; i < 30; i++) W.step(DT);
    const tD = game.time; let chokeOn2 = -1, deadT = -1;
    endFor(W, HOLD.secs.chokeHold + HOLD.secs.choke + 0.1, () => { if (chokeOn2 < 0 && game.player.holding?.phase === 'choke') chokeOn2 = game.time; if (deadT < 0 && A.state === 'dead') deadT = game.time; });
    for (let i = 0; i < 120; i++) W.step(DT);   // two seconds for the ragdoll to meet the floor (bodyFall is its own, printed not asserted)
    const grainsB = log.filter(c => c.name === 'chokeStrain' && c.t >= tD); const limp = log.filter(c => c.name === 'chokeLimp' && c.t >= tD);
    const wantB = Math.floor((HOLD.secs.choke - 0.3 - 1e-6) / CHOKE_GRAIN) + 1;
    if (chokeOn2 < 0 || deadT < 0) fails.push(`staging: choke on at ${chokeOn2}, down at ${deadT}`);
    if (grainsB.length !== wantB) fails.push(`full choke: ${grainsB.length} grains (want ${wantB}: 0, ${CHOKE_GRAIN} … ${f2((wantB - 1) * CHOKE_GRAIN)} s into it)`);
    if (grainsB.length && deadT >= 0 && grainsB[grainsB.length - 1].t > deadT - 0.25) fails.push(`last grain only ${f2(deadT - grainsB[grainsB.length - 1].t)} s before he went (want ≥ 0.3: it should be dying as he folds)`);
    if (limp.length !== 1 || (deadT >= 0 && Math.abs(limp[0].t - deadT) > DT + 1e-6)) fails.push(`chokeLimp ×${limp.length} at ${limp.map(c => f2(c.t)).join('/')} (want once, on the fold frame ${f2(deadT)})`);
    if (A.downKind !== 'choked') fails.push(`A ${A.state}/${A.downKind} (want choked)`);
    const afterFold = voicesIn(log, deadT + DT + 1e-4, game.time); if (afterFold.length) fails.push(`after the fold: ${tally(afterFold)} (want nothing of the hold's)`);
    placedOn([...grainsB, ...limp], pairAt(), fails, 'choke through');   // (he folds at Sam's feet: still within 0.7 m of where the pair stood)
    const floor = log.filter(c => c.name === 'bodyFall' && c.t >= deadT).length;
    const sp = spamCheck(log);
    if (sp.perSec > 3) fails.push(`${sp.worst} played ${sp.perSec}× inside one second`); if (sp.sameFrame.length) fails.push(`same-frame repeats: ${sp.sameFrame.join(', ')}`);
    verdict(fails.length === 0, '(a) arm variant: grab → lock → idle → question / cut / question → choke eased off at 1.5 s → choke through',
      `grab ${f2(grabT)} s: ${tally(grabWin)} · lock +${f2(heldT - grabT)} s: ${tally(lockWin)} · idle 1.5 s: ${tally(idle)} · Q1 (stage ${st0}→${st1}, answer +${f2(tA1 - DT - tQ1)} s): ${tally(q1)} then the muffle · mid-line tap: ${tally(mid)} · too-soon tap: ${tally(cut)} · Q2 (→${A.talk.stage >= st2 + 1 ? st2 + 1 : A.talk.stage}, answer +${f2(tA2 - DT - tQ2)} s): ${tally(q2)} then the muffle\n    eased-off choke: on at +${f2(chokeOn - tC)} s of Space, ${grainsA.length} grains at ${grainsA.map(c => '+' + f2(c.t - chokeOn)).join(' ')} of the choke, then ${phaseAfter}; after Space up: ${tally(after)}\n    full choke: ${grainsB.length} grains at ${grainsB.map(c => '+' + f2(c.t - chokeOn2)).join(' ')}, down at +${f2(deadT - chokeOn2)} s as ${A.downKind}, chokeLimp at +${limp.map(c => f2(c.t - chokeOn2)).join('/')}; bodyFall off the ragdoll after: ×${floor}; worst per-second: ${sp.worst || '—'} ×${sp.perSec}\n    whole run: ${tally(log.filter(c => HOLD_VOICES.includes(c.name)))}`, fails);
  }

  // ================================================================ (b) the gun variant: the whip checked at 0.5 s (nothing lands), then held through — whipThud once on the landing frame, and whipOut's old bodyHit / magDrop pair gone
  {
    const S = await stage(601, true); const { W, game, A, log } = S;
    const fails: string[] = [];
    const { grabT, heldT } = grabAndSettle(S);
    if (game.player.holding?.variant !== 'gun') fails.push(`staging: variant ${game.player.holding?.variant} (want gun)`);
    const pre = voicesIn(log, grabT, heldT + 1e-4);
    if (count(pre, 'grabScuffle') !== 1 || count(pre, 'heldProtest') !== 1 || pre.length !== 2) fails.push(`grab + lock: ${tally(pre)} (want grabScuffle×1 heldProtest×1 — the same in either variant)`);
    for (let i = 0; i < 30; i++) W.step(DT);
    // checked: the whip chosen, then a second tap 0.5 s on = 0.15 s into the whip
    const tChk = game.time; endThenStop(W, 0.5); const phaseMid = A.held?.phase === 'whip' || game.player.holding?.phase === 'held'; W.step(DT); W.step(DT); for (let i = 0; i < 60; i++) W.step(DT);
    const chk = voicesIn(log, tChk, game.time); const sleeve1 = log.filter(c => c.name === 'propScrape' && c.t >= tChk).length;
    if (chk.length) fails.push(`checked whip: ${tally(chk)} (want nothing of the hold's — no blow landed)`);
    if (game.player.holding?.phase !== 'held' || A.state === 'dead') fails.push(`after checking it: phase ${game.player.holding?.phase}, A ${A.state}`);
    void phaseMid;
    // through: chosen, chokeHold + whip + a hair → lands at HOLD.secs.whip of the whip
    const tW = game.time; let whipOn = -1, deadT = -1; let head: Vec3 | null = null;   // his head where it was as the blow travelled (by the time this is checked he is on the floor)
    endFor(W, HOLD.secs.chokeHold + HOLD.secs.whip + 0.1, () => { if (whipOn < 0 && game.player.holding?.phase === 'whip') whipOn = game.time; if (game.player.holding?.phase === 'whip' && A.char.bones.head) head = v3.copy(A.char.bones.head); if (deadT < 0 && A.state === 'dead') deadT = game.time; });
    for (let i = 0; i < 120; i++) W.step(DT);
    const thuds = log.filter(c => c.name === 'whipThud' && c.t >= tW);
    const oldPair = log.filter(c => c.t >= tW && deadT >= 0 && Math.abs(c.t - deadT) < 1e-6 && (c.name === 'bodyHit' || c.name === 'magDrop'));
    const sleeve2 = log.filter(c => c.name === 'propScrape' && c.t >= tW && whipOn >= 0 && Math.abs(c.t - whipOn) < 1e-6).length;
    if (whipOn < 0 || deadT < 0) fails.push(`staging: whip on at ${whipOn}, down at ${deadT}`);
    if (thuds.length !== 1 || (deadT >= 0 && Math.abs(thuds[0].t - deadT) > 1e-6)) fails.push(`whipThud ×${thuds.length} at ${thuds.map(c => f2(c.t)).join('/')} (want once, on the landing frame ${f2(deadT)})`);
    if (deadT >= 0 && whipOn >= 0 && Math.abs((deadT - whipOn) - HOLD.secs.whip) > DT + 1e-6) fails.push(`landed ${f2(deadT - whipOn)} s into the whip (want ${HOLD.secs.whip})`);
    if (oldPair.length) fails.push(`the old stand-ins still play on the landing frame: ${oldPair.map(c => c.name).join(', ')}`);
    if (A.downKind !== 'struck') fails.push(`A ${A.state}/${A.downKind} (want struck)`);
    const hd = head as Vec3 | null;
    if (!thuds[0]?.pos || !hd || v3.dist(thuds[0].pos, hd) > 0.4) fails.push(`whipThud ${thuds[0]?.pos && hd ? f2(v3.dist(thuds[0].pos, hd)) + ' m from' : 'not at'} his head as the blow travelled`);
    if (thuds[0] && Math.abs(thuds[0].gain - 0.7) > 1e-6) fails.push(`whipThud gain ${thuds[0].gain} (want 0.7)`);
    const others = voicesIn(log, tW, game.time).filter(c => c.name !== 'whipThud'); if (others.length) fails.push(`around the whip: ${tally(others)} (want only the thud)`);
    const sp = spamCheck(log); if (sp.perSec > 3) fails.push(`${sp.worst} ×${sp.perSec} inside a second`); if (sp.sameFrame.length) fails.push(`same-frame repeats: ${sp.sameFrame.join(', ')}`);
    verdict(fails.length === 0, '(b) gun variant: whip checked at 0.5 s (silence), then through — whipThud once as it lands',
      `grab + lock: ${tally(pre)} · checked whip: ${tally(chk)} (sleeve cloth ×${sleeve1}) · whip on → landed +${f2(deadT - whipOn)} s: whipThud ×${thuds.length}${thuds[0]?.pos && hd ? ` ${f2(v3.dist(thuds[0].pos, hd))} m from the head` : ''} @${thuds[0]?.gain ?? '—'}, sleeve cloth on the wind-up ×${sleeve2}, old bodyHit/magDrop on that frame ×${oldPair.length}; A ${A.downKind}\n    whole run: ${tally(log.filter(c => HOLD_VOICES.includes(c.name)))}`, fails);
  }

  // ================================================================ (c) E on his row draws the pistol to his head (player.ts swapHold — no letting him go): the equip click (not one of the hold's voices) and, the man
  //                                                                    being silent, Sam's one remark — murmur×1 on the key's frame, on Sam; E again holsters it: nothing of the hold's at all. Held throughout.
  {
    const S = await stage(61, false); const { W, game, A, log } = S;
    const fails: string[] = [];
    grabAndSettle(S); for (let i = 0; i < 60; i++) W.step(DT);
    const tE = game.time; tapKey(W, 'KeyE'); W.step(DT);
    for (let i = 0; i < 60; i++) W.step(DT);
    const win = voicesIn(log, tE - DT, game.time); const equip1 = log.filter(c => c.name === 'equip' && c.t >= tE - DT).length;
    if (count(win, 'murmur') !== 1 || win.length !== 1) fails.push(`E (draw): ${tally(win)} (want murmur×1 alone — Sam's remark as the gun comes out; nothing else of the hold's)`);
    else { if (Math.abs(win[0].t - tE) > DT + 1e-6) fails.push(`the remark's murmur ${f2(win[0].t - tE)} s after the key (want its frame)`); placedOn(win, game.player.char.pos, fails, 'remark'); }
    if (equip1 !== 1) fails.push(`equip ×${equip1} on the draw (want 1)`);
    if (!A.held || game.player.holding?.phase !== 'held' || game.player.holding.variant !== 'gun') fails.push(`after E: phase ${game.player.holding?.phase ?? 'gone'} / ${game.player.holding?.variant}, held ${!!A.held} (want still held, the gun variant)`);
    const tE2 = game.time; tapKey(W, 'KeyE'); W.step(DT); for (let i = 0; i < 60; i++) W.step(DT);
    const win2 = voicesIn(log, tE2 - DT, game.time); const equip2 = log.filter(c => c.name === 'equip' && c.t >= tE2 - DT).length;
    if (win2.length) fails.push(`E again (holster): ${tally(win2)} (want nothing of the hold's)`); if (equip2 !== 1) fails.push(`equip ×${equip2} on holstering (want 1)`);
    if (game.player.holding?.variant !== 'arm' || !A.held) fails.push(`after the second E: ${game.player.holding?.variant ?? 'free'} (want the arm again, still held)`);
    verdict(fails.length === 0, '(c) E on his row: draws — one equip click and Sam\'s remark (murmur×1); holsters again — the click alone; held throughout', `E at ${f2(tE)} s → ${tally(win)} + equip×${equip1}; E at ${f2(tE2)} s → ${tally(win2)} + equip×${equip2}; still ${game.player.holding?.phase ?? 'free'} / ${game.player.holding?.variant ?? '—'}`, fails);
  }

  // ================================================================ (d) torn loose vs cancelled: a round drops Sam with the man in his arm → a quiet shove (0.3); a teleport mid-hold (cancelActions) → nothing
  {
    const S = await stage(71, false); const { W, game, A, log } = S;
    const fails: string[] = [];
    grabAndSettle(S); for (let i = 0; i < 30; i++) W.step(DT);
    const pair = v3.copy(A.char.pos);
    const tS = game.time; game.godMode = false; hitPlayer(game, [1, 0, 0]);
    for (let i = 0; i < 5; i++) W.step(DT);
    const shot = voicesIn(log, tS - 1e-6, game.time);
    if (!game.player.down || A.held) fails.push(`staging: down ${game.player.down}, held ${!!A.held}`);
    if (count(shot, 'shove') !== 1 || shot.length !== 1 || Math.abs(shot[0]?.gain - 0.3) > 1e-6) fails.push(`torn loose: ${tally(shot)} gain ${shot[0]?.gain} (want shove×1 at 0.3)`);
    placedOn(shot, pair, fails, 'torn loose');
    // and the cancel: a fresh hold, then a teleport
    const S2 = await stage(72, false); const W2 = S2.W, g2 = S2.game, log2 = S2.log;
    grabAndSettle(S2); for (let i = 0; i < 30; i++) W2.step(DT);
    const tT = g2.time; g2.teleportPlayer([30, 0, 20]); for (let i = 0; i < 10; i++) W2.step(DT);
    const canc = voicesIn(log2, tT - 1e-6, g2.time);
    if (g2.player.holding || S2.A.held) fails.push('staging: the teleport did not end the hold');
    if (canc.length) fails.push(`cancelled (teleport): ${tally(canc)} (want nothing)`);
    verdict(fails.length === 0, '(d) torn loose by a round: one quiet shove; cancelled by a teleport: silence', `shot down: ${tally(shot)}${shot[0] ? ` @${shot[0].gain}` : ''} · teleport: ${tally(canc)}`, fails);
  }

  console.log(`=== audio-hold: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
