// The 'dialogue' probe family (run through probes.ts: `bun run tools/qa/probes.ts dialogue | dialogue-none | dialogue-sawhurt | dialogue-heard | dialogue-intel |
// dialogue-lint | dialogue-shapes | dialogue-seed | dialogue-exchange | dialogue-radio`): the interrogation engine of src/game/dialogue.ts (docs/internal/grab-interrogate-design.md
// §4) driven through Game.interrogate on staged men, and — since the G7 pass — its SCRIPTS: the comic shapes a hold is dealt (count pedantry, the self-own, the
// over-cooperator, the rambler, the fan, the stoic, the con, the arbitrary game, the room's menace), Sam's line and the man's answer authored together with a
// rejoinder after some answers. The two anchor cases from the design note — a man who never knew you were there (knows nothing) and a man who watched you shoot
// his partner (agitated, hostile, names him: no script, ever) — then the heard-only man, the INTEL generator's knowledge gating (no keyed door for the cubicle
// man, the radio-check words against the net's real clock, an errand only men who were free to hear the order can mention), the table lint (every speaker, the
// originality blocklist, lengths, coverage) + the whole knowledge × agitation × temperament matrix on synthetic contexts for both speakers, the shapes themselves
// (dealt stably per man, every useful thing still delivered by the third press under a script, the rambler's dud, the key still landing in Sam's pocket, twelve
// sample exchanges printed for the red pen), replay under a seed, the two-speaker EXCHANGE in a real hold (Sam's line over Sam, then the man's answer, then his
// rejoinder: alternation, no overlap, the pacing rules, intel and the dry path intact), and the handler's radio + the ambient pairs. Each prints what was said; PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { rollcallState, witnessSummary, pointInView } = guardsMod;
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const playerMod = await import(`${ROOT}/src/game/player.ts`);
const { startGrab, heldTalk, samBeat } = playerMod;
const { setBlackout } = await import(`${ROOT}/src/game/lighting.ts`);
const { drivePulled } = await import(`${ROOT}/src/game/mission.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held, facing east (away from everything) — still hearing, unless `deaf` */
function park(gd: any, i: number, deaf = false) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); if (deaf) gd.heardUpTo = 1e12; }
const chest = (gd: any): Vec3 => gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]);
/** tap game.say into an array (returns it) */
function tap(game: any) {
  const lines: { t: number; who: string; text: string; radio: boolean }[] = [];
  const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: gd.callsign, text, radio }); return origSay(gd, text, radio); };
  return { lines };
}
type Pick = { text: string; id: string; kind: string | null; stage: 1 | 2 | 3 | 'x'; stageN: number; cell: string; k: string; band: string; t: string; lineK: string; widened: string; after: string | null; script: string | null; shape: string | null };
/** press him n times (a beat between presses so the bubbles are real bubbles), collecting the picks; Sam is put `behind` metres behind him first (his back to Sam, dark) */
function pressN(W: any, gd: any, n: number, rnd: () => number, behind = 1.0): (Pick | null)[] {
  const { game } = W; const f = gd.char.forward();
  game.teleportPlayer([gd.char.pos[0] - f[0] * behind, 0, gd.char.pos[2] - f[2] * behind]); game.player.visibility = 0.02; W.step(DT);
  const out: (Pick | null)[] = [];
  for (let i = 0; i < n; i++) { out.push(game.interrogate(gd, rnd)); for (let f2 = 0; f2 < 20; f2++) W.step(DT); }
  return out;
}
const fmtPick = (p: Pick | null) => p ? `s${String(p.stage)} [${p.id}${p.widened ? ' ~' + p.widened : ''}] "${p.text}"${p.after ? `  ↳ SAM "${p.after}"` : ''}` : 'null';
/** the generic checks every transcript gets: no nulls, stages 1,2,3,x…, no unresolved token, no repeats (id or text), every line's own K his or '*', ≤ MAX_CHARS */
function transcriptFails(picks: (Pick | null)[], wantK: string): string[] {
  const fails: string[] = []; const ids = new Set<string>(), texts = new Set<string>();
  picks.forEach((p, i) => {
    if (!p) { fails.push(`press ${i + 1}: null pick`); return; }
    const wantStage = i < 3 ? i + 1 : 'x'; if (p.stage !== wantStage) fails.push(`press ${i + 1}: stage ${String(p.stage)} (want ${String(wantStage)})`);
    if (p.stageN !== i + 1) fails.push(`press ${i + 1}: stageN ${p.stageN}`);
    if (/[{}]/.test(p.text)) fails.push(`press ${i + 1}: unresolved token in "${p.text}"`);
    if (p.text.length > D.MAX_CHARS) fails.push(`press ${i + 1}: ${p.text.length} chars`);
    if (ids.has(p.id) && p.widened !== 'repeat') fails.push(`press ${i + 1}: repeated ${p.id} without the pool being dry`); ids.add(p.id);
    if (texts.has(p.text) && p.widened !== 'repeat') fails.push(`press ${i + 1}: repeated text`); texts.add(p.text);
    if (p.k !== wantK) fails.push(`press ${i + 1}: picked for K '${p.k}' (want ${wantK})`);
    if (p.lineK !== '*' && p.lineK !== wantK) fails.push(`press ${i + 1}: line ${p.id} is written for K '${p.lineK}', he is '${wantK}' — knowledge leaked`);
  });
  return fails;
}

// ================================================================ (1) never knew you were there: startled, knows nothing
/** Fresh floor, nothing has happened: the corridor man (Kowalski, steady) and the cubicle man (Novak, nervy) each get Sam a metre behind them in the dark and four
 *  presses. Both: knowledge 'none', agitation low (the nervy one's bias alone does not rattle him), press 1 from the startled / knows-nothing pool, stages 1 → 2 →
 *  3 → x, nothing repeated, every token resolved. The steady man's third press is the one useful thing he plausibly has (his route passes the keyed server-room
 *  door); the nervy one gives early (press 2) and, walking the cubicles past no keyed door, gives the radio-check rhythm instead. */
export async function dialogueNone() {
  console.log('\n=== dialogue-none: a man who never knew you were there — startled, knows nothing; stages advance to "nothing left" without repeats ===');
  let allPass = true;
  Math.random = seeded(501);
  const W = await standUp(); const { game } = W; tap(game);
  game.player.visibility = 0.02; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards;
  place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true; place(B, [19.9, 0, 17.0], 0); B.hold = true; park(C, 0);
  rollcallState(game).nextAt = game.time + 100;   // (no radio check in flight during the presses — the next is 'in a couple of minutes': a live one outranks the door and the cadence in the generator's order, and this probe pins which useful thing each man gives)
  for (const [gd, label] of [[A, 'corridor man'], [B, 'cubicle man']] as [any, string][]) {
    const k0 = D.knowledgeOf(game, gd), a0 = D.agitationOf(game, gd), band0 = D.bandOf(a0), t = D.temperamentOf(gd);
    const ctx0 = D.gather(game, gd);
    const picks = pressN(W, gd, 4, seeded(11));
    const fails = transcriptFails(picks, 'none');
    if (k0 !== 'none') fails.push(`knowledge ${k0} (want none) — witness: ${witnessSummary(game, gd) || 'empty'}`);
    if (band0 !== 'low') fails.push(`agitation ${a0.toFixed(2)} ${band0} (want low)`);
    const p1 = picks[0]; if (p1 && ((p1.lineK !== 'none' && !(p1.script && p1.lineK === '*')) || p1.stage !== 1 || p1.kind)) fails.push(`press 1 neither his script's opener nor the startled pool: ${fmtPick(p1)}`);
    if (picks.some(p => p && p.script !== (p1?.script ?? null) && p.stageN <= 4)) fails.push(`the script changed mid-hold: ${picks.map(p => p?.script ?? 'pools').join('/')}`);
    const gives = picks.filter(p => p?.kind).map(p => `${p!.kind}@s${String(p!.stage)}`);
    if (t === 'steady' && !(picks[2]?.kind)) fails.push(`steady man gave nothing at press 3 (${fmtPick(picks[2])})`);
    if (t === 'nervy' && !(picks[1]?.kind)) fails.push(`nervy man gave nothing at press 2 (${fmtPick(picks[1])})`);
    if (gd === B && picks.some(p => p?.kind === 'door')) fails.push('the cubicle man gave a keyed door — none is on his route');
    if (gd === A && picks[2]?.kind !== 'door') fails.push(`the corridor man's useful thing was ${picks[2]?.kind} (want door: his route passes the server room's keyed door)`);
    if (D.knowledgeOf(game, gd) !== 'none') fails.push(`knowledge moved to ${D.knowledgeOf(game, gd)} while pressed (Sam was meant to be dark and behind him): ${witnessSummary(game, gd)}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${gd.callsign} (${t}) · K ${k0} · A ${a0.toFixed(2)} ${band0} [${ctx0.why.join(', ') || '—'}] · gave ${gives.join(', ') || 'nothing'}\n    ` + picks.map(fmtPick).join('\n    ') + (fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''));
  }
  console.log(`  panel line: ${game.dialogueSummary()}`);
  console.log(`=== dialogue-none: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (2) watched you shoot his partner: agitated, hostile, names him  +  (3) the man who only heard it
/** The witness probe's staging: A (Kowalski) mid-corridor facing east with Sam dark behind him, B (Novak) six metres east facing west with A in his open view, C
 *  (Reyes) parked on the lot behind two walls, hearing. Sam stands and shoots A. B SAW it (witness.sawAct shot / Kowalski, through the real killGuard path) and
 *  goes alert on the shot; C HEARD it and saw nothing. Both are pinned where they stand (an alert man would otherwise run to the shot) and pressed four times. */
async function stageShooting(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const T = tap(game);
  game.player.visibility = 0.02; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards;
  place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true; place(B, [20, 0, 11.2], -Math.PI / 2); B.hold = true; park(C, 1);
  game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02;
  const los = { bSeesA: pointInView(game, B, chest(A)), cSeesA: pointInView(game, C, chest(A)), bSeesSam: B.sawPlayerThisFrame };
  game.player.crouch = false; W.step(DT);
  fireWeapon(game, game.player.char, chest(A), true);
  B.pinned = true; C.pinned = true;   // (alert men hold where they are: this is about what they say, not where they run)
  for (let i = 0; i < 90; i++) W.step(DT);   // a second and a half: the shot has reached everyone, B has called the body in
  game.player.visibility = 0.02;
  return { W, game, A, B, C, los, lines: T.lines };
}
export async function dialogueSawHurt() {
  console.log('\n=== dialogue-sawhurt: the man who watched you shoot his partner — sawHurt, agitation high, hostile pool, names the victim ===');
  const S = await stageShooting(502); const { W, game, A, B, los } = S;
  const fails: string[] = [];
  if (!los.bSeesA) fails.push("staging: A was not in B's open view"); if (los.bSeesSam) fails.push('staging: B had eyes on Sam before the shot');
  if (A.state !== 'dead' || A.downKind !== 'shot') fails.push(`staging: A ${A.state}/${A.downKind}`);
  if (!B.witness.sawAct || B.witness.sawAct.victim !== A.callsign || B.witness.sawAct.kind !== 'shot') fails.push(`B.witness.sawAct ${JSON.stringify(B.witness.sawAct)} (want shot / ${A.callsign})`);
  const k0 = D.knowledgeOf(game, B), a0 = D.agitationOf(game, B), band0 = D.bandOf(a0), ctx0 = D.gather(game, B);
  if (k0 !== 'sawHurt') fails.push(`knowledge ${k0} (want sawHurt)`);
  if (band0 !== 'high') fails.push(`agitation ${a0.toFixed(2)} ${band0} (want high) [${ctx0.why.join(', ')}]`);
  if (ctx0.tokens.victim !== A.callsign) fails.push(`{victim} resolves to ${ctx0.tokens.victim} (want ${A.callsign})`);
  const picks = pressN(W, B, 4, seeded(12));   // (a metre behind him as he now stands — alert, pinned, facing where the shot came from; inside 1.8 m in front even a dark Sam is seen point-blank)
  fails.push(...transcriptFails(picks, 'sawHurt'));
  const p1 = picks[0];
  if (!p1 || !p1.text.includes(A.callsign)) fails.push(`press 1 does not name the victim ${A.callsign}: ${fmtPick(p1)}`);
  if (p1 && (p1.lineK !== 'sawHurt' || p1.kind)) fails.push(`press 1 not from the hostile (sawHurt) pool: ${fmtPick(p1)}`);
  if (picks.some(p => p?.script)) fails.push(`a SCRIPT was dealt to a man who watched you shoot his partner: ${picks.map(p => p?.script ?? '—').join('/')} — sawHurt is frightened, never funny`);
  const needs1: string[] = p1 ? (D.LINES.find((l: any) => l.id === p1.id)?.needs ?? []) : [];
  if (needs1.includes('sawDrop')) fails.push(`press 1 is a takedown-witness line (${p1!.id} needs sawDrop) for a man who watched a SHOT`);
  const ok = fails.length === 0;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${B.callsign} (${D.temperamentOf(B)}, ${B.state}) after watching ${A.callsign} shot: K ${k0} · A ${a0.toFixed(2)} ${band0} [${ctx0.why.join(', ')}]\n    witness: ${witnessSummary(game, B)}\n    ` + picks.map(fmtPick).join('\n    ') + (fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''));
  // the same man, hard: Reyes in B's shoes (temperament is by callsign — swap the callsigns of B and C for a second staging) — cold fury, 'No.' at the giving stage unless rattled (he is: high)
  {
    const S2 = await stageShooting(503); const { W: W2, game: g2, A: A2, B: B2, C: C2 } = S2;
    const f2: string[] = [];
    [B2.callsign, C2.callsign] = [C2.callsign, B2.callsign];   // Reyes now stands where Novak stood (TEMPERAMENT is keyed by callsign)
    if (D.temperamentOf(B2) !== 'hard') f2.push(`staging: swapped man is ${D.temperamentOf(B2)}`);
    const kk = D.knowledgeOf(g2, B2), aa = D.agitationOf(g2, B2), cx = D.gather(g2, B2);
    const picks2 = pressN(W2, B2, 4, seeded(13));
    f2.push(...transcriptFails(picks2, 'sawHurt'));
    if (kk !== 'sawHurt') f2.push(`knowledge ${kk}`);
    if (!picks2[0]?.text.includes(A2.callsign)) f2.push(`press 1 does not name ${A2.callsign}`);
    if (D.bandOf(aa) === 'low' && picks2.some(p => p?.kind)) f2.push('a hard man at low agitation gave something');
    const gave = picks2.find(p => p?.kind); if (gave && !gave.text.startsWith('…Fine.')) f2.push(`a hard man gave "${gave.text}" without the grudging lead-in`);
    const ok2 = f2.length === 0; fails.push(...f2);
    console.log(`- ${ok2 ? 'PASS' : 'FAIL'} — the same, hard (${B2.callsign} in his place): K ${kk} · A ${aa.toFixed(2)} ${D.bandOf(aa)} [${cx.why.join(', ')}]\n    ` + picks2.map(fmtPick).join('\n    ') + (f2.length ? '\n    ✗ ' + f2.join('\n    ✗ ') : ''));
  }
  const all = fails.length === 0;
  console.log(`=== dialogue-sawhurt: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
export async function dialogueHeard() {
  console.log('\n=== dialogue-heard: the man round the corner who only HEARD the shot — the heard pool, never a line written for men who saw ===');
  const S = await stageShooting(504); const { W, game, A, C, los } = S;
  const fails: string[] = [];
  if (los.cSeesA) fails.push('staging: C on the lot had a line to A');
  if (C.witness.sawAct) fails.push(`C.sawAct ${JSON.stringify(C.witness.sawAct)} behind two walls`);
  // (the suppressed Five-seveN is an odd noise nearby now, not gunfire floor-wide — 8b3f69d — so the man on the lot no longer HEARS the shot itself: he is 'heard' by the body call that follows it)
  const k0 = D.knowledgeOf(game, C), a0 = D.agitationOf(game, C), ctx0 = D.gather(game, C);
  if (k0 !== 'heard') fails.push(`knowledge ${k0} (want heard)`);
  if (ctx0.tokens.victim) fails.push(`{victim} resolves (${ctx0.tokens.victim}) for a man who saw nothing`);
  const picks = pressN(W, C, 5, seeded(14));
  fails.push(...transcriptFails(picks.slice(0, 4), 'heard'));
  for (const p of picks) {
    if (!p) continue;
    if (['glimpsed', 'saw', 'sawHurt'].includes(p.lineK)) fails.push(`line ${p.id} is for men who SAW ('${p.lineK}'): "${p.text}"`);
    if (/\bI (saw|watched) you\b|\byou shot\b|\bI had you\b/i.test(p.text)) fails.push(`"${p.text}" claims sight`);
  }
  if (D.knowledgeOf(game, C) !== 'heard') fails.push(`knowledge moved to ${D.knowledgeOf(game, C)} while pressed`);
  const ok = fails.length === 0;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${C.callsign} (${D.temperamentOf(C)}, ${C.state}) on the lot: K ${k0} · A ${a0.toFixed(2)} ${D.bandOf(a0)} [${ctx0.why.join(', ')}] · body token ${ctx0.tokens.body ?? '—'} (he heard ${A.callsign} called in: ${!!C.witness.calledToBody})\n    witness: ${witnessSummary(game, C)}\n    ` + picks.map(fmtPick).join('\n    ') + (fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''));
  console.log(`=== dialogue-heard: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (4) INTEL gating: only what he plausibly knows
/** (a) the keyed door: resolves for the corridor and lobby men (their routes pass the server / manager / storage doors), never for the cubicle man — and six presses
 *      of him never produce one. (b) {checkEta} / {minutes} against the net's real radio-check clock (rollcallState): the words track nextAt as it is moved about,
 *      {minutes} is null before the first check and counts from its call after. (c) the errand: the lobby man dropped quietly out of everyone's sight, the corridor
 *      man 'held' (talk.heldSince stamped) BEFORE the net notices — when the check finds Reyes silent and sends Novak round his route, Novak (the checker) gives it in
 *      his own words, Kowalski held through the order cannot know it (his intel skips it), and the same Kowalski freed and grabbed afresh after the order can.
 *      (Reyes lies in the locked storage room so that no route simply finds him first: this is about the net's errand, not a body call.) */
export async function dialogueIntel() {
  console.log('\n=== dialogue-intel: the useful thing is gated by what he could know — doors on HIS route, the check clock as it is, an errand only if he heard the order ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  // ---- (a) doors on his route
  {
    Math.random = seeded(505);
    const W = await standUp(); const { game } = W; tap(game);
    game.player.visibility = 0.02; game.godMode = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; const fails: string[] = [];
    const doors = game.guards.map((gd: any) => `${game.level.routes[gd.routeI].name}: ${D.keyedDoorOnRoute(game, gd) ?? 'none'}`);
    if (!D.keyedDoorOnRoute(game, A)) fails.push('corridor man has no keyed door on his route');
    if (D.keyedDoorOnRoute(game, B)) fails.push(`cubicle man got ${D.keyedDoorOnRoute(game, B)}`);
    if (!D.keyedDoorOnRoute(game, C)) fails.push('lobby man has none (his loop walks the corridor past three)');
    place(B, [19.9, 0, 17.0], 0); B.hold = true; A.hold = true; park(C, 0, true);
    const live = D.gather(game, B).intel.filter((i: any) => i.live && i.known).map((i: any) => i.kind);
    if (live.includes('door')) fails.push(`cubicle man's live intel includes door: ${live.join(', ')}`);
    const picks = pressN(W, B, 6, seeded(21));
    if (picks.some(p => p?.kind === 'door' || (p && /\bdoor\b.*\bkey|keyed\b/i.test(p.text)))) fails.push(`a press produced a keyed door: ${picks.map(fmtPick).join(' | ')}`);
    verdict(fails.length === 0, '(a) keyed doors resolve per route; the cubicle man never mentions one in six presses',
      `${doors.join(' · ')}\n    cubicle man's live intel: ${live.join(', ') || '—'} · gave: ${picks.filter(p => p?.kind).map(p => `${p!.kind}@s${String(p!.stage)} "${p!.text}"`).join(' | ') || 'nothing'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) the radio-check words against the clock
  {
    Math.random = seeded(506);
    const W = await standUp(); const { game } = W; const { lines } = tap(game);
    game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 5; i++) W.step(DT);
    const A = game.guards[0]; const R = rollcallState(game); const fails: string[] = []; const rows: string[] = [];
    if (!(R.nextAt > game.time)) fails.push(`staging: no check scheduled (nextAt ${R.nextAt})`);
    const eta0 = D.gather(game, A).tokens.checkEta; if (eta0 !== D.etaWords(R.nextAt - game.time)) fails.push(`checkEta "${eta0}" vs clock ${(R.nextAt - game.time).toFixed(0)} s → "${D.etaWords(R.nextAt - game.time)}"`);
    rows.push(`scheduled in ${(R.nextAt - game.time).toFixed(0)} s → "${eta0}"`);
    for (const [secs, want] of [[10, 'any second now'], [60, 'in a minute or so'], [120, 'in a couple of minutes'], [240, 'in four minutes']] as [number, string][]) {
      R.nextAt = game.time + secs; const got = D.gather(game, A).tokens.checkEta; rows.push(`${secs} s → "${got}"`); if (got !== want) fails.push(`nextAt +${secs} s gives "${got}" (want "${want}")`);
    }
    if (D.gather(game, A).tokens.minutes !== null) fails.push(`{minutes} before any check: ${D.gather(game, A).tokens.minutes} (want null)`);
    R.nextAt = game.time + 1;   // let a real check run now
    let called = -1; for (let f = 0; f < 60 * 20 && called < 0; f++) { W.step(DT); const l = lines.find(x => /sound off/.test(x.text)); if (l) called = l.t; }
    if (called < 0) fails.push('no radio check ran in 20 s');
    const m1 = D.gather(game, A).tokens.minutes; if (m1 !== 'one') fails.push(`{minutes} right after the check: ${m1} (want one)`);
    const live1 = D.gather(game, A).facts.rollcallLive; rows.push(`check called at ${called.toFixed(1)} s → minutes "${m1}", rollcallLive ${live1}, checkEta "${D.gather(game, A).tokens.checkEta}"`);
    for (let f = 0; f < 60 * 100; f++) W.step(DT);
    const m2 = D.gather(game, A).tokens.minutes; const wantM2 = ['one', 'two', 'three'][Math.max(1, Math.round((game.time - R.t0) / 60)) - 1];
    if (m2 !== wantM2) fails.push(`{minutes} 100 s on: ${m2} (want ${wantM2} — from R.t0 ${R.t0.toFixed(0)}, now ${game.time.toFixed(0)})`);
    rows.push(`+100 s → minutes "${m2}" (R.t0 ${R.t0.toFixed(0)} s, checks ${R.checks})`);
    verdict(fails.length === 0, '(b) {checkEta} follows the net\'s nextAt; {minutes} is null before the first check and counts from its call', rows.join(' · ') + (fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''));
  }
  // ---- (c) the errand: only men free to hear the order
  {
    Math.random = seeded(507);
    const W = await standUp(); const { game } = W; const { lines } = tap(game);
    game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 60 * 3; i++) W.step(DT);
    const [A, B, C] = game.guards; const fails: string[] = [];
    place(C, [33.6, 0, 6.2], Math.PI); killGuard(game, C, [0, 0, -1], true, 'struck');   // the lobby man out cold in the locked storage room, where no route looks: silent on the net, never simply found
    const tKill = game.time;
    A.talk.heldSince = game.time; A.hold = true;   // Kowalski 'held' from now (what the grab will stamp) — and standing his ground, so the net sends Novak, not him
    let tSend = -1; for (let f = 0; f < 60 * 150 && tSend < 0; f++) { W.step(DT); if (B.task?.kind === 'checkOn') tSend = game.time; }
    if (tSend < 0) fails.push(`nobody was sent round ${C.callsign}'s route in 150 s (A ${A.state} task ${A.task?.kind ?? '—'}, B ${B.state} task ${B.task?.kind ?? '—'}, C found ${C.found}; lines: ${lines.filter(l => l.radio).map(l => l.text).slice(-4).join(' | ')})`);
    else {
      const heldCtx = D.gather(game, A); const item = heldCtx.intel.find((i: any) => i.kind === 'checkOn');
      const heldGive = D.intelFor(heldCtx, A.talk);
      if (!item?.live) fails.push('checkOn not live for A while B walks the route');
      if (item?.known) fails.push(`A, held since ${A.talk.heldSince.toFixed(0)} s (order at ${B.task.t0.toFixed(0)} s), KNOWS the errand`);
      if (heldGive?.kind === 'checkOn') fails.push(`held A would give the errand: "${heldGive.text}"`);
      const selfCtx = D.gather(game, B); const selfGive = D.intelFor(selfCtx, B.talk);
      if (selfGive?.kind !== 'checkOn' || !/I was sent (round|to walk)/.test(selfGive.text) || !selfGive.text.includes(C.callsign)) fails.push(`the checker's own useful thing: ${JSON.stringify(selfGive)} (want checkOn in his own words naming ${C.callsign})`);
      A.talk.heldSince = -1;   // let go and grabbed afresh after the order went out: now he heard it
      const freeCtx = D.gather(game, A); const freeGive = D.intelFor(freeCtx, A.talk);
      if (freeGive?.kind !== 'checkOn' || !freeGive.text.includes(B.callsign) || !freeGive.text.includes(C.callsign)) fails.push(`A grabbed after the order: ${JSON.stringify(freeGive)} (want checkOn naming ${B.callsign} and ${C.callsign})`);
      // and through the real presses: A (steady) gives it at press 3, said as a bubble
      A.hold = true; const picks = pressN(W, A, 3, seeded(31));
      if (picks[2]?.kind !== 'checkOn') fails.push(`A's press 3: ${fmtPick(picks[2])} (want the errand)`);
      verdict(fails.length === 0, '(c) the check-on errand: unknown to a man held through the order, the checker\'s in his own words, known to a man grabbed after it',
        `${C.callsign} dropped at ${tKill.toFixed(0)} s, ${B.callsign} sent at ${tSend.toFixed(0)} s\n    held ${A.callsign}: live ${item?.live} known ${item?.known} → gives ${heldGive?.kind ?? 'nothing'}${heldGive ? ` "${heldGive.text}"` : ''}\n    checker ${B.callsign}: "${selfGive?.text ?? '—'}"\n    ${A.callsign} grabbed after: "${freeGive?.text ?? '—'}"\n    presses: ${picks.map(fmtPick).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
    if (tSend < 0) verdict(false, '(c) the check-on errand', fails.join(' · '));
  }
  console.log(`=== dialogue-intel: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (5) the table lint + the whole matrix on synthetic contexts
export async function dialogueLint() {
  console.log('\n=== dialogue-lint: the line tables — the men\'s and Sam\'s (tokens, needs, length, duplicates, every cell / category reachable) — and a sweep of the K × A × T matrix for both speakers ===');
  let allPass = true;
  const problems: string[] = D.lintDialogue();
  { const ok = problems.length === 0; allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — lintDialogue(): ${ok ? 'clean' : problems.length + ' problems'}${ok ? '' : '\n    ✗ ' + problems.join('\n    ✗ ')}`); }
  { const M = D.coverageMatrix(); console.log(`  coverage (${M.total} pool lines + ${M.intel} intel texts): stage →   1   2   3   x`); for (const r of M.rows) console.log(`    ${r.k.padEnd(20)} ${['1', '2', '3', 'x'].map(s => String(r.counts[s]).padStart(3)).join(' ')}   = ${r.total}`); }
  { const S = D.samCoverage(); console.log(`  Sam (${S.total} lines): category →  plain  gun  arm  temperament  knowledge  floor   total`); for (const r of S.rows) console.log(`    ${r.s.padEnd(8)} ${String(r.plain).padStart(15)} ${String(r.gun).padStart(4)} ${String(r.arm).padStart(4)} ${String(r.t).padStart(12)} ${String(r.k).padStart(10)} ${String(r.floor).padStart(6)} ${String(r.total).padStart(7)}`); console.log(`    q (written for the useful thing): ${Object.entries(S.q).map(([k, n]) => `${k} ${n}`).join(' · ')}`); }
  { const T = D.scriptCoverage(); console.log(`  scripts (${D.SCRIPTS.length}): shape → steady nervy hard · written for k · bands · pin`); for (const r of T) console.log(`    ${r.shape.padEnd(8)} ${['steady', 'nervy', 'hard'].map(t => String(r.byT[t as 'steady'] ?? '·').padStart(6)).join(' ')}   ${r.k.padEnd(24)} ${r.band.padEnd(13)} ${r.pin}`); }
  { // the blocklist and the length distribution: every speaker, worst-case expansion; the script beats on their own (what the pass wrote) against AIM_CHARS
    const R = D.lineLengthReport(); const dist = (list: { where: string; text: string }[]) => { const n = list.length, le = list.filter(x => x.text.length <= D.AIM_CHARS).length, mx = list.reduce((m, x) => Math.max(m, x.text.length), 0); return { n, le, pct: n ? Math.round(100 * le / n) : 100, mx }; };
    const scriptMen = R.men.filter((x: any) => /^[a-z]+-[snh]\d:/.test(x.where) || /^room /.test(x.where)), scriptSam = R.sam.filter((x: any) => !/^pool /.test(x.where));
    const a = dist(R.men), b = dist(scriptMen), c = dist(R.sam), d2 = dist(scriptSam);
    console.log(`  lengths (worst-case tokens): men — all ${a.n} lines ${a.pct} % ≤ ${D.AIM_CHARS} (max ${a.mx}); script answers + rooms ${b.n} lines ${b.pct} % ≤ ${D.AIM_CHARS} (max ${b.mx}) · Sam — all ${c.n} ${c.pct} % ≤ ${D.AIM_CHARS} (max ${c.mx}, hard cap ${D.SAM_MAX_CHARS}); scripts / rooms / radio ${d2.n} ${d2.pct} % (max ${d2.mx})`);
    const longest = scriptMen.filter((x: any) => x.text.length > D.AIM_CHARS).sort((x: any, y: any) => y.text.length - x.text.length).slice(0, 6); if (longest.length) console.log('    longest script answers: ' + longest.map((x: any) => `${x.text.length} ${x.where}`).join(' · '));
    console.log(`  originality blocklist (${D.ORIGINALITY_BLOCKLIST.length} phrases): ${D.ORIGINALITY_BLOCKLIST.join(', ')}`);
  }
  // Sam's own sweep: every K × band × T × variant × stage with the floor facts dealt at random and a different man each session — a line always comes (never '…'),
  // ≤ SAM_MAX_CHARS, tokens resolved, its needs really hold, its t / k are the man's, a 'q' line only for the thing peeked, a script's ASK only when the man then
  // gives and its plain line when he does not, no repeat inside a session while fresh lines remain; then the man answers and the peek must have named what he gave
  {
    const rnd = seeded(510); const fails: string[] = []; let picks = 0, sessions = 0, qHits = 0, qChances = 0, stale = 0, scripted = 0, asks = 0; const idsSeen = new Set<string>(); const scriptsSeen = new Set<string>();
    for (const k of D.KNOWLEDGE) for (const band of D.BANDS) for (const t of D.TEMPERAMENTS) for (const variant of ['arm', 'gun']) for (let sess = 0; sess < 6; sess++) {
      sessions++;
      const facts: Record<string, boolean> = { floorUp: rnd() < 0.3, episode: rnd() < 0.3, lockdown: rnd() < 0.2, blackout: rnd() < 0.25, heldLong: rnd() < 0.2, sawShot: k === 'sawHurt' };
      const intelLive = rnd() < 0.25 ? [] : D.INTEL_KINDS.filter(() => rnd() < 0.4);
      const talk = { stage: 0, presses: 0, said: new Set<string>(), saidN: new Map<string, number>(), given: new Set<string>(), lastT: -1, heldSince: -1, abortT: -1, last: null };
      const mem = { said: new Map<string, number>(), last: null as string | null }; const ids = new Set<string>(); const who = `sam-sweep-${sessions}`;
      for (let press = 0; press < 6; press++) {
        const ctx = D.synthCtx(k, band, t, { facts, intelLive, who }); ctx.time = press * 5;
        const sf = D.samFacts(ctx, variant); const peek = D.peekGive(ctx, talk);
        const sp = D.pickSamLine(ctx, talk, variant, mem, rnd); picks++; idsSeen.add(sp.id); if (sp.script) { scripted++; scriptsSeen.add(sp.script); }
        const where = `${k}·${band}·${t}·${variant} #${sess} press ${press + 1}`;
        const line = D.SAM_LINES.find((l: any) => l.id === sp.id);
        if (!line || sp.id === '-' || !sp.text.trim() || sp.text === '…' || /[{}]/.test(sp.text)) { fails.push(`${where}: bad pick ${sp.id} "${sp.text}"`); if (fails.length > 12) break; continue; }
        if (sp.text.length > D.SAM_MAX_CHARS) fails.push(`${where}: ${sp.text.length} chars "${sp.text}"`);
        if (line.needs?.some((n: string) => !sf[n])) fails.push(`${where}: ${sp.id} needs [${line.needs.join(', ')}] but facts say ${JSON.stringify(sf)}`);
        if (line.t && line.t !== t) fails.push(`${where}: ${sp.id} is for t '${line.t}'`); if (line.k && line.k !== k) fails.push(`${where}: ${sp.id} is for k '${line.k}'`);
        const wantStage = press < 3 ? press + 1 : 'x'; if (sp.stage !== wantStage) fails.push(`${where}: Sam's pick says stage ${String(sp.stage)} (want ${String(wantStage)})`);
        const wantCat = D.samStageOf(sp.stage, !!peek && press > 0); if (sp.s !== wantCat) fails.push(`${where}: category '${sp.s}' (want '${wantCat}': peek ${peek ?? '—'})`);
        if (line.s === 'q' && (line.q !== peek || press === 0)) fails.push(`${where}: 'q' line ${sp.id} (${line.q}) but the peek was ${peek ?? 'nothing'}`);
        if (sp.script && k === 'sawHurt') fails.push(`${where}: a script (${sp.script}) for a sawHurt man`);
        if (sp.script && press < 4 && !new RegExp(`^S:${sp.script}:${String(wantStage)}\\??$`).test(sp.id)) fails.push(`${where}: script pick id ${sp.id} (want S:${sp.script}:${String(wantStage)})`);
        if (sp.id.endsWith('?')) { asks++; if (!peek) fails.push(`${where}: the script's ASK ${sp.id} with nothing peeked`); }
        if (peek && press > 0) { qChances++; if (line.s === 'q' || sp.id.endsWith('?')) qHits++; }
        if (ids.has(sp.id) && sp.fresh) fails.push(`${where}: ${sp.id} again inside one session while marked fresh`); if (!sp.fresh) stale++; ids.add(sp.id);
        // then the man answers (his side advances exactly as the game runs it), and the peek must have named what he then gave; the same script on both sides
        const gp = D.pickLine(ctx, talk, rnd);
        if (peek && press > 0 && gp.kind !== peek) fails.push(`${where}: Sam's peek said '${peek}' but the man gave ${gp.kind ?? 'nothing'} (${gp.id})`);
        if (!peek && gp.kind && press > 0) fails.push(`${where}: no peek but the man gave '${gp.kind}'`);
        if ((gp.script ?? null) !== (sp.script ?? null) && press < 4) fails.push(`${where}: Sam played ${sp.script ?? 'the pools'} and the man ${gp.script ?? 'the pools'}`);
        if (fails.length > 12) break;
      }
    }
    const unusedPool = D.SAM_LINES.filter((l: any) => l.s !== 'script').map((l: any) => l.id).filter((id: string) => !idsSeen.has(id));
    if (sessions < 90 || picks < 6 * 90) fails.push(`the sweep ran only ${sessions} sessions / ${picks} lines (want ≥ 90 / 540: KNOWLEDGE × BANDS × TEMPERAMENTS × 2 × 6) — an emptied table would pass vacuously`);   // (the vacuity floor)
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — Sam's sweep: ${sessions} sessions, ${picks} lines (${scripted} off a script — ${scriptsSeen.size}/${D.SCRIPTS.length} scripts dealt — ${asks} of them the beat's ask), a written-for-it question ${qHits}/${qChances} times he was about to give, ${stale} stale pool picks, ${idsSeen.size} distinct ids; pool lines never drawn: ${unusedPool.length} (${unusedPool.slice(0, 24).join(', ')}${unusedPool.length > 24 ? ', …' : ''})${fails.length ? '\n    ✗ ' + fails.slice(0, 12).join('\n    ✗ ') : ''}`);
  }
  // the matrix: 5 K × 3 bands × 3 T, 24 sessions of 6 presses each with the facts / live intel dealt at random and a different man each session — TWICE: with the
  // scripts dealt as the game deals them, and with TALK_TUNE.scripts off (the pools alone, as a sawHurt man or a fifth press meets them): no line above his K,
  // no token left, no silent repeat, one script per session and none for sawHurt, every rejoinder inside Sam's limit
  for (const scriptsOn of [true, false]) {
    D.TALK_TUNE.scripts = scriptsOn;
    const rnd = seeded(508); const fails: string[] = []; let picksN = 0, sessions = 0, repeatsAfterDry = 0, gave = 0, afters = 0, scriptedPicks = 0; const idsSeen = new Set<string>(); const shapesSeen = new Map<string, number>();
    const NEED_KEYS = ['floorUp', 'lockdown', 'episode', 'bodyKnown', 'bodyCalled', 'bodyFound', 'missingKnown', 'blackout', 'heldLong', 'rollcallLive', 'dazzled', 'heardShots', 'drewOnYou', 'alertNow'];
    for (const k of D.KNOWLEDGE) for (const band of D.BANDS) for (const t of D.TEMPERAMENTS) for (let sess = 0; sess < 24; sess++) {
      sessions++;
      const facts: Record<string, boolean> = {}; for (const n of NEED_KEYS) facts[n] = rnd() < 0.3;
      if (k === 'sawHurt') { facts.sawShot = rnd() < 0.6; facts.sawDrop = !facts.sawShot; }
      const rooms = ['the corridor', 'the server room', 'the break room', 'the lobby', 'the cubicles', 'the car park', 'the back offices', "the manager's office"];
      const tokens: Record<string, string | null> = { body: facts.bodyKnown || facts.bodyCalled || facts.bodyFound ? 'Reyes' : null, missing: facts.missingKnown ? 'Okafor' : null, partner: rnd() < 0.85 ? 'Novak' : null, door: rnd() < 0.6 ? 'the storage door' : null, checker: rnd() < 0.2 ? 'Brandt' : null, checked: 'Reyes', clearRoom: rnd() < 0.2 ? 'the break room' : null, minutes: rnd() < 0.5 ? 'two' : null, room: rooms[Math.floor(rnd() * rooms.length)] };
      facts.partnerKnown = !!tokens.partner;
      const intelLive = rnd() < 0.3 ? [] : D.INTEL_KINDS.filter(() => rnd() < 0.35);   // (some sessions with nothing useful to give at all: the giving stages fall to the beat's own answer / the pools)
      const talk = { stage: 0, presses: 0, said: new Set<string>(), saidN: new Map<string, number>(), given: new Set<string>(), lastT: -1, heldSince: -1, abortT: -1, last: null };
      const ids = new Set<string>(); let script0: string | null | undefined;
      for (let press = 0; press < 6; press++) {
        const ctx = D.synthCtx(k, band, t, { facts, tokens, intelLive, who: `matrix-${sessions}` });
        const p: Pick = D.pickLine(ctx, talk, rnd); picksN++; idsSeen.add(p.id); if (p.kind) gave++; if (p.after) afters++; if (p.script) scriptedPicks++;
        const where = `${scriptsOn ? 'scripts' : 'pools'} ${k}·${band}·${t} #${sess} press ${press + 1}`;
        if (press === 0) { script0 = p.script; if (p.shape) shapesSeen.set(`${p.shape}·${t}`, (shapesSeen.get(`${p.shape}·${t}`) ?? 0) + 1); }
        else if (press < 4 && p.script !== script0 && p.script !== null) fails.push(`${where}: script ${p.script} after ${script0 ?? 'the pools'} at press 1 — one man, one script`);
        if (!scriptsOn && p.script) fails.push(`${where}: a script (${p.script}) with TALK_TUNE.scripts off`);
        if (k === 'sawHurt' && p.script) fails.push(`${where}: a script for sawHurt`);
        if (p.lineK !== '*' && p.lineK !== k) fails.push(`${where}: ${p.id} written for '${p.lineK}' — LEAK`);
        if (/[{}]/.test(p.text) || !p.text.trim() || p.text === '…') fails.push(`${where}: bad text "${p.text}" (${p.id})`);
        if (p.text.length > D.MAX_CHARS) fails.push(`${where}: ${p.text.length} chars`);
        if (p.after !== null && (p.after.length > D.SAM_MAX_CHARS || /[{}]/.test(p.after) || !p.after.trim())) fails.push(`${where}: rejoinder "${p.after}"`);
        if (ids.has(p.id)) { if (p.widened !== 'repeat') fails.push(`${where}: ${p.id} repeated while its pool still had unsaid lines`); else repeatsAfterDry++; }
        ids.add(p.id);
        const wantStage = press < 3 ? press + 1 : 'x'; if (p.stage !== wantStage) fails.push(`${where}: stage ${String(p.stage)}`);
        if (fails.length > 12) break;
      }
    }
    const unused = D.LINES.map((l: any) => l.id).filter((id: string) => !idsSeen.has(id));
    const ok = fails.length === 0; allPass &&= ok;
    const shapeLine = scriptsOn ? ` · shapes dealt at press 1 (× temperament): ${[...shapesSeen.entries()].sort().map(([s2, n]) => `${s2} ${n}`).join(', ')}` : '';
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — matrix sweep, ${scriptsOn ? 'SCRIPTS ON' : 'POOLS ONLY (TALK_TUNE.scripts off)'}: ${sessions} sessions, ${picksN} picks (${scriptedPicks} off a script, ${afters} with a rejoinder), ${gave} useful things given, ${repeatsAfterDry} repeats (all after the pool ran dry), ${idsSeen.size} distinct ids; pool lines never used: ${unused.length ? unused.join(', ') : 'none'}${shapeLine}${fails.length ? '\n    ✗ ' + fails.slice(0, 12).join('\n    ✗ ') : ''}`);
  }
  D.TALK_TUNE.scripts = true;
  console.log(`=== dialogue-lint: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (5b) the shapes: dealt stably, deliver every useful thing, the dud, the key, the samples
const newTalk = () => ({ stage: 0, presses: 0, said: new Set<string>(), saidN: new Map<string, number>(), given: new Set<string>(), lastT: -1, heldSince: -1, abortT: -1, last: null as any });
type Turn = { sam: string; samId: string; him: string; himId: string; kind: string | null; after: string | null };
/** Play a whole scripted hold on a synthetic man: four presses (or `n`), each Sam's pick then the man's, the rejoinder off the man's pick. `force` deals a named
 *  script; `who` names the man (the deal hashes it). Returns the turns and the script that played. */
function playSynth(k: string, band: string, t: string, opts: { who?: string; force?: string | null; intelLive?: string[]; tokens?: Record<string, string | null>; facts?: Record<string, boolean>; n?: number; variant?: string } = {}): { turns: Turn[]; script: string | null; shape: string | null } {
  const talk = newTalk(); if (opts.force !== undefined) D.forceScript(talk, opts.force);
  const mem = { said: new Map<string, number>(), last: null as string | null }; const rnd = seeded(4242);
  const turns: Turn[] = []; let script: string | null = null, shape: string | null = null;
  for (let press = 0; press < (opts.n ?? 4); press++) {
    const ctx = D.synthCtx(k, band, t, { who: opts.who ?? 'sample', intelLive: opts.intelLive as any, tokens: opts.tokens as any, facts: opts.facts as any }); ctx.time = press * 6;
    const sp = D.pickSamLine(ctx, talk, opts.variant ?? 'arm', mem, rnd);
    const gp = D.pickLine(ctx, talk, rnd);
    if (press === 0) { script = gp.script; shape = gp.shape; }
    turns.push({ sam: sp.text, samId: sp.id, him: gp.text, himId: gp.id, kind: gp.kind, after: gp.after });
  }
  return { turns, script, shape };
}
const fmtTurns = (turns: Turn[], indent = '      ') => turns.map((x, i) => `${indent}${i < 3 ? i + 1 : 'x'}  SAM  ${x.sam}\n${indent}   ${x.kind ? 'HIM* ' : 'HIM  '}${x.him}${x.kind ? `   [${x.kind}]` : ''}${x.after ? `\n${indent}   SAM  ${x.after}` : ''}`).join('\n');
export async function dialogueShapes() {
  console.log('\n=== dialogue-shapes: the scripts — dealt stably per man and kept for the hold, every useful thing still delivered by the third press, the rambler\'s dud costs a press and never an item, the self-own ends with the key in Sam\'s pocket, and twelve exchanges printed for the red pen ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  // ---- (a) the deal is stable: the same man (callsign) in the same cell draws the same script every time and keeps it for all four presses; Sam's side and his
  //      agree on it; different men mostly draw different ones (reported); the rotation ranks a played shape behind the unplayed within one game (a real Game's
  //      recent map: two steady men grabbed one after the other on a fresh floor draw different shapes)
  {
    const fails: string[] = []; const rows: string[] = []; const perWho = new Map<string, string>();
    for (const t of D.TEMPERAMENTS) for (const who of ['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist', 'Brandt']) {
      const A = playSynth('none', 'low', t, { who }), B = playSynth('none', 'low', t, { who });
      if (A.script !== B.script) fails.push(`${who} (${t}): dealt ${A.script} then ${B.script}`);
      if (A.turns.some((x, i) => x.him !== B.turns[i].him || x.sam !== B.turns[i].sam)) fails.push(`${who} (${t}): same script, different words between two plays`);
      const ids = A.turns.map(x => x.himId); if (A.script && ids.slice(0, 4).some((id, i) => !id.startsWith(A.script + ':') && !id.startsWith('intel:'))) fails.push(`${who} (${t}): the man's lines left the script mid-hold: ${ids.join(' ')}`);
      const sids = A.turns.map(x => x.samId); if (A.script && sids.some(id => !id.startsWith(`S:${A.script}:`))) fails.push(`${who} (${t}): Sam's lines left the script: ${sids.join(' ')}`);
      if (!A.script) fails.push(`${who} (${t}): no script dealt on a plain floor`);
      perWho.set(`${t}:${who}`, A.script ?? '—');
    }
    for (const t of D.TEMPERAMENTS) { const dealt = ['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist', 'Brandt'].map(w => perWho.get(`${t}:${w}`)); rows.push(`${t}: ${dealt.join(' / ')} (${new Set(dealt).size} distinct of 6)`); }
    // rotation inside one real game: grab Kowalski (steady), four presses; reset the men; grab him again — the recent map now ranks his first shape last
    Math.random = seeded(561);
    const W = await standUp(); const { game } = W; tap(game); game.player.visibility = 0.02; game.godMode = true; for (let i = 0; i < 5; i++) W.step(DT);
    const dealReal = () => { const [A, B, C] = game.guards; place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true; park(B, 0, true); park(C, 1, true); rollcallState(game).nextAt = game.time + 300; const picks = pressN(W, A, 4, seeded(19)); return { picks, script: picks[0]?.script ?? null, shape: picks[0]?.shape ?? null }; };
    const r1 = dealReal(); game.resetGuards(); for (let i = 0; i < 5; i++) W.step(DT); const r2 = dealReal(); game.resetGuards(); for (let i = 0; i < 5; i++) W.step(DT); const r3 = dealReal();
    if (!r1.script || !r2.script || !r3.script) fails.push(`real deals: ${r1.script} / ${r2.script} / ${r3.script} (want a script each time)`);
    if (D.SCRIPT_ROTATE && r1.shape === r2.shape) fails.push(`the same steady man grabbed twice in one session drew the same SHAPE twice running (${r1.shape}) — the rotation should rank it last`);
    if (r1.picks.some((p, i) => i < 4 && p && p.script !== r1.script)) fails.push(`real hold: the script changed between presses: ${r1.picks.map(p => p?.script).join('/')}`);
    verdict(fails.length === 0, '(a) the deal: the same man in the same cell draws the same script and keeps it for the hold (both speakers); a second hold in one session rotates the shape',
      `${rows.join(' · ')}\n    Kowalski for real, three holds in one session: ${r1.script} → ${r2.script} → ${r3.script}\n` + r1.picks.map(fmtPick).map(x => '      ' + x).join('\n'), fails);
  }
  // ---- (b) every useful thing still lands under a script: for each INTEL_KIND × temperament, a synthetic man with just that thing live (and the tokens it needs)
  //      gives exactly it by his third press (hard: rattled — mid band), worded ≤ MAX_CHARS with no token left, whatever script he drew; and the door's every
  //      wording keeps the key on his person
  {
    const fails: string[] = []; const rows: string[] = []; let n = 0;
    const toks: Record<string, string> = { checker: 'Brandt', checked: 'Reyes', clearRoom: 'the break room', missing: 'Okafor', caller: 'Kowalski' };
    for (const kind of D.INTEL_KINDS) {
      const cells: string[] = [];
      for (const t of D.TEMPERAMENTS) for (const k of ['none', 'glimpsed']) {
        const band = t === 'hard' ? 'mid' : 'low';
        const P = playSynth(k, band, t, { who: `kind-${kind}-${t}-${k}`, intelLive: [kind], tokens: toks, facts: kind === 'lockdownPosts' || kind === 'clearing' ? { lockdown: true, floorUp: true } : {} }); n++;
        const at = P.turns.findIndex(x => x.kind === kind);
        if (at < 0 || at > 2) fails.push(`${kind} · ${t}·${k} under ${P.script ?? 'the pools'}: given at press ${at < 0 ? 'never' : at + 1} — ${P.turns.map(x => x.kind ?? '·').join('/')}`);
        else { const g = P.turns[at]; if (/[{}]/.test(g.him) || g.him.length > D.MAX_CHARS) fails.push(`${kind} · ${t}: "${g.him}"`); if (kind === 'door' && !/belt|mine|pocket|clip/i.test(g.him)) fails.push(`${kind} · ${t}: "${g.him}" does not put the key on him`); cells.push(`${t[0]}${k[0]}@${at + 1}${P.shape ? ':' + P.shape : ''}`); }
        if (P.turns.filter(x => x.kind === kind).length > 1) fails.push(`${kind} · ${t}: given twice`);
      }
      rows.push(`${kind} ${cells.join(' ')}`);
    }
    if (n < 6 || D.INTEL_KINDS.length < 3) fails.push(`only ${n} holds over ${D.INTEL_KINDS.length} intel kinds — the tables shrank under the loop (want ≥ 3 kinds × 3 temperaments × 2)`);   // (the vacuity floor)
    verdict(fails.length === 0, `(b) each of the ${D.INTEL_KINDS.length} useful things, live alone, is given by the third press by every temperament under whatever script he drew (${n} holds)`, rows.join('\n    '), fails);
  }
  // ---- (c) the rambler's dud: a nervy man, rattled, dealt a ramble script — with NOTHING pending every press is the stream and Sam's rejoinder says it was a dud
  //      (no kind, ever); with ONE thing pending it is swallowed at 2 (the stream + the dud line) and lands at 3 (RAMBLE_SWALLOWS); with TWO pending he blurts
  //      both at 2 and 3 like any nervy man — the dud costs a press, never an item; and the door pending under a ramble still lands by 3
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const sc of D.SCRIPTS.filter((s2: any) => s2.shape === 'ramble')) {
      const none = playSynth('none', 'high', 'nervy', { force: sc.id, intelLive: [] });
      if (none.turns.some(x => x.kind)) fails.push(`${sc.id}, nothing pending: gave ${none.turns.map(x => x.kind ?? '·').join('/')}`);
      if (!none.turns[1].after) fails.push(`${sc.id}, nothing pending: no rejoinder from Sam at the giving press (the player must see it was a dud, not a bug)`);
      const one = playSynth('none', 'high', 'nervy', { force: sc.id, intelLive: ['rollcall'] });
      const oneAt = one.turns.findIndex(x => x.kind === 'rollcall');
      if (D.RAMBLE_SWALLOWS > 0 ? oneAt !== 2 : oneAt !== 1) fails.push(`${sc.id}, one thing pending: given at press ${oneAt + 1} (want ${D.RAMBLE_SWALLOWS > 0 ? '3 — swallowed once' : '2'})`);
      if (D.RAMBLE_SWALLOWS > 0 && (one.turns[1].kind || !one.turns[1].after)) fails.push(`${sc.id}, one pending: press 2 was ${one.turns[1].kind ?? 'the stream'} with${one.turns[1].after ? '' : 'OUT'} the dud line`);
      const two = playSynth('none', 'high', 'nervy', { force: sc.id, intelLive: ['rollcall', 'routes'] });
      const kinds2 = two.turns.map(x => x.kind ?? '·').join('/'); if (!/^·\/rollcall\/routes\//.test(kinds2)) fails.push(`${sc.id}, two pending: ${kinds2} (want ·/rollcall/routes/· — nothing lost)`);
      const door = playSynth('none', 'high', 'nervy', { force: sc.id, intelLive: ['door'] });
      const doorAt = door.turns.findIndex(x => x.kind === 'door'); if (doorAt < 0 || doorAt > 2) fails.push(`${sc.id}, the door pending: given at ${doorAt + 1}`);
      notes.push(`${sc.id}: none → ${none.turns.map(x => x.kind ?? '·').join('/')} (dud line "${none.turns[1].after ?? '—'}") · one → @${oneAt + 1} · two → ${kinds2} · door → @${doorAt + 1}`);
    }
    if (notes.length < 1) fails.push(`no script of shape 'ramble' in SCRIPTS (${D.SCRIPTS.length} scripts) — nothing ran`);   // (the vacuity floor: the loop is over a filtered table)
    verdict(fails.length === 0, '(c) the rambler: nothing pending = a dud Sam calls out; one thing pending lands a press late; two land as ever; the door is never lost', notes.join('\n    '), fails);
  }
  // ---- (d) the self-own for real: Kowalski (steady, the server-room key on his belt) forced each selfown-s script in a real arm hold — three taps and the key is
  //      in Player.keys with Sam's word on it; and Novak-as-corridor-man (nervy) forced selfown-n gives it at the second
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const sc of D.SCRIPTS.filter((s2: any) => s2.shape === 'selfown')) {
      Math.random = seeded(571);
      const W = await standUp(); const { game } = W; tap(game); game.player.visibility = 0.02; game.godMode = true; game.player.slot = 'pistol'; game.player.holstered = true;
      for (let i = 0; i < 5; i++) W.step(DT);
      const [A, B, C] = game.guards; if (sc.t === 'nervy') { [A.callsign, B.callsign] = [B.callsign, A.callsign]; }   // (temperament is by callsign: Novak's name on the corridor man makes him the nervy one with the key)
      place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; park(B, 0, true); park(C, 1, true); rollcallState(game).nextAt = game.time + 300;
      game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02;
      D.forceScript(A.talk, sc.id);
      startGrab(game, A); for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT); game.player.fHeld = false; W.step(DT);
      const said: string[] = []; let keyAt = -1;
      for (let q = 0; q < 3 && keyAt < 0; q++) {
        for (let i = 0; i < 60 * 14; i++) { const H = game.player.holding; if (H && !H.after && heldTalk(game, H).settled) break; W.step(DT); }
        const sb0 = game.player.bubble?.text; W.input.pressed.add('Space'); W.step(DT); if (game.player.bubble?.text && game.player.bubble.text !== sb0) said.push(`S "${game.player.bubble.text}"`);
        const st = A.talk.stage; for (let i = 0; i < 150 && A.talk.stage === st; i++) W.step(DT); said.push(`G "${A.talk.last?.kind ? '[' + A.talk.last.kind + '] ' : ''}${A.bubble?.text ?? '?'}"`);
        if (game.player.keys.has('floor')) keyAt = q + 1;
      }
      let remark = ''; for (let i = 0; i < 60 * 8; i++) { W.step(DT); const sb = game.player.bubble; if (sb && Math.abs(sb.t - game.time) < 1e-9) { remark = sb.text; break; } }
      const want = sc.t === 'nervy' ? 2 : 3;
      if (D.peekScript(A.talk)?.id !== sc.id) fails.push(`${sc.id}: the forced script did not take (${D.peekScript(A.talk)?.id ?? 'none'})`);
      if (keyAt !== want) fails.push(`${sc.id}: the key came at press ${keyAt} (want ${want})`);
      if (!game.player.keys.has('floor') || A.keys.size) fails.push(`${sc.id}: pocket [${[...game.player.keys].join(',')}] belt [${[...A.keys].join(',')}]`);
      const keyLine = D.SAM_LINES.find((l: any) => l.text === remark); if (keyLine?.s !== 'key') fails.push(`${sc.id}: after the door Sam said "${remark}" (want a 'key' remark — it outranks the beat's own rejoinder)`);
      notes.push(`${sc.id} (${A.callsign}, ${D.temperamentOf(A)}): key at ${keyAt} · ${said.join(' / ')} / K "${remark}"`);
    }
    if (notes.length < 1) fails.push(`no script of shape 'selfown' in SCRIPTS (${D.SCRIPTS.length} scripts) — nothing ran`);   // (the vacuity floor)
    verdict(fails.length === 0, '(d) the self-own in a real hold: he proves he works here with the keyed door, the key comes off his belt at his giving press, Sam\'s word on the key follows', notes.join('\n    '), fails);
  }
  // ---- (e) twelve sample exchanges — 3 temperaments × 4 shapes — for the maintainer's red pen (synthetic men on a plain floor; * = the useful thing)
  {
    const plan: [string, string, string, string, string[]?][] = [
      ['steady', 'pedant-s1', 'none', 'low'], ['steady', 'selfown-s2', 'none', 'low'], ['steady', 'con-s1', 'none', 'low'], ['steady', 'fan-s3', 'heard', 'low'],
      ['nervy', 'folder-n1', 'none', 'low'], ['nervy', 'ramble-n2', 'heard', 'high', []], ['nervy', 'game-n3', 'glimpsed', 'mid'], ['nervy', 'selfown-n3', 'none', 'low'],
      ['hard', 'stoic-h2', 'saw', 'mid'], ['hard', 'game-h1', 'none', 'mid'], ['hard', 'menace-h1', 'heard', 'low'], ['hard', 'stoic-h4', 'none', 'high'],
    ];
    console.log('- INFO — (e) twelve sample exchanges (3 temperaments × 4 shapes; synthetic men in the corridor, the door / the radio check / the routes live unless noted; HIM* = the useful thing, [kind]):');
    for (const [t, id, k, band, live] of plan) {
      const P = playSynth(k, band, t, { force: id, intelLive: live, tokens: { room: id.startsWith('menace') ? 'the server room' : 'the corridor' } });
      console.log(`    ── ${id} · ${t} · knows '${k}' · ${band}${live ? ' · nothing pending' : ''}\n${fmtTurns(P.turns)}`);
    }
  }
  console.log(`=== dialogue-shapes: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}


// ================================================================ (6) replay under a seed
/** The fresh-floor staging twice with the same seeds: the eight lines (four each from the corridor and the cubicle man) come out identical; with another picker
 *  seed at least one differs (reported, not required — small pools can legitimately agree). */
export async function dialogueSeed() {
  console.log('\n=== dialogue-seed: same seed, same words ===');
  const run = async (pickSeed: number) => {
    Math.random = seeded(509);
    const W = await standUp(); const { game } = W; tap(game);
    game.player.visibility = 0.02; game.godMode = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true; place(B, [19.9, 0, 17.0], 0); B.hold = true; park(C, 0);
    const rnd = seeded(pickSeed);
    return [...pressN(W, A, 4, rnd), ...pressN(W, B, 4, rnd)].map(p => p ? `${p.id}:${p.text}` : 'null');
  };
  const a = await run(77), b = await run(77), c = await run(78);
  const same = a.length === b.length && a.every((x, i) => x === b[i]); const differs = a.some((x, i) => x !== c[i]);
  console.log(`- ${same ? 'PASS' : 'FAIL'} — two runs with picker seed 77: ${same ? 'identical' : 'DIFFER'} (8 lines); seed 78 ${differs ? 'differs' : 'happens to agree'}\n    ` + a.map((x, i) => `${x === b[i] ? '=' : '≠'} ${x}${x !== c[i] ? `   | 78: ${c[i]}` : ''}`).join('\n    '));
  console.log(`=== dialogue-seed: ${same ? 'ALL PASS' : 'FAILURES above'} ===`);
  return same;
}

// ================================================================ (7) the exchange: Sam's line over Sam, then the man's answer — in a real hold, through the real taps
/** The staging the grab family uses, without its file: the level up with the pistol holstered (the ARM hold) or drawn (the GUN hold), Sam dark and immortal, A
 *  (Kowalski, steady — his route passes the keyed server-room door, so his useful thing is 'door') planted mid-corridor facing east, B and C parked deaf on the lot,
 *  Sam crouched 0.8 m behind him, grabbed by the call and stepped until the hold proper is on. No puppet; a tap does his top row — 'question him' in the arm hold. */
async function stageExchange(seed: number, gun: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.player.visibility = 0.02; game.godMode = true; game.player.slot = 'pistol'; game.player.holstered = !gun;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards;
  place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; park(B, 0, true); park(C, 1, true);
  rollcallState(game).nextAt = game.time + 100;   // (no radio check lands mid-probe: a live one outranks the door in the generator's order, and this probe pins the door as his useful thing)
  game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); game.player.visibility = 0.02;
  const msgs: { t: number; text: string }[] = []; const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
  startGrab(game, A);
  for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT);
  game.player.fHeld = false; W.step(DT);
  return { W, game, A, msgs };
}
/** One recorder per staging: stepped INSTEAD of W.step, it watches both bubbles every frame — when each begins (Sam's / the man's answer), whether both are ever
 *  live at once, and the Sam line ids as Sam's memory names them the frame they go up. Live = inside its dur, strictly (a line cut to 'now' is over now). */
function recorder(S: any) {
  const { W, game, A } = S;
  const ev: { t: number; who: 'sam' | 'guard'; text: string; id: string; stage: number; kind: string | null; dur: number }[] = [];
  let overlap = 0, frames = 0; let lastSamT = -1, lastAnsT = -1;
  const live = (b: any) => !!b && game.time - b.t < b.dur - 1e-9;
  const answerBubble = () => { const b = A.bubble, T = A.talk; return b && T.lastT >= 0 && Math.abs(b.t - T.lastT) < 1e-6 ? b : null; };
  const step = () => {
    W.step(DT); frames++;
    const sb = game.player.bubble; if (sb && sb.t !== lastSamT && Math.abs(sb.t - game.time) < 1e-9) { lastSamT = sb.t; ev.push({ t: sb.t, who: 'sam', text: sb.text, id: D.samMemoryOf(game).last ?? '?', stage: A.talk.stage, kind: null, dur: sb.dur }); }
    const ab = answerBubble(); if (ab && ab.t !== lastAnsT && Math.abs(ab.t - game.time) < 1e-9) { lastAnsT = ab.t; ev.push({ t: ab.t, who: 'guard', text: ab.text, id: A.talk.last?.id ?? '?', stage: A.talk.stage, kind: A.talk.last?.kind ?? null, dur: ab.dur }); }
    if (live(sb) && live(answerBubble())) overlap++;
  };
  const secs = (s: number) => { for (let i = 0; i < Math.round(s / DT); i++) step(); };
  /** step until the row would take the next question without cutting anything (heldTalk.settled — which also means no line of Sam's in the air) and no remark of
   *  his still waits its turn (H.after: his word on a key just pocketed goes up when the answer ends), plus `extra` seconds of a player's own slack; false if it never came */
  const untilSettled = (extra: number, maxSecs = 14) => { for (let i = 0; i < maxSecs / DT; i++) { const H = game.player.holding; if (H && !H.after && heldTalk(game, H).settled) { secs(extra); return true; } step(); } return false; };
  const tap = () => { W.input.pressed.add('Space'); step(); };
  return { ev, step, secs, untilSettled, tap, get overlap() { return overlap; }, get frames() { return frames; } };
}
const samLine = (id: string) => D.SAM_LINES.find((l: any) => l.id === id);
/** what a line of Sam's IS, by the id his memory names it under: 'k' his remark on the key he has just pocketed (a 'key' line), 'a' a beat's rejoinder to the answer
 *  just given ('<pick id>+', queued by dialogue.ts interrogate on Hold.after), 's' a question / opener / last word (pool or script beat) */
const kindOfSam = (id: string): 's' | 'k' | 'a' => samLine(id)?.s === 'key' ? 'k' : /\+\??$/.test(id) ? 'a' : 's';
/** the category of a question of Sam's: a script beat's by its stage ('S:<script>:<stage>[?]' — '?' the beat's ask, when the man is about to give), a pool line's by its table entry */
const catOfSam = (id: string): string => { const m = /^S:.+:([123x])(\?)?$/.exec(id); if (m) return m[1] === '1' ? 'open' : m[2] ? 'ask' : m[1] === '2' ? 'press' : m[1] === '3' ? 'ask' : 'dry'; return samLine(id)?.s ?? '?'; };
/** is this text a line of Sam's from any table (pool, script beat, room threat) — a script line's {tokens} matching whatever they expanded to */
const samTextRes: RegExp[] = D.SAM_LINES.map((l: any) => new RegExp('^' + l.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[A-Za-z]+\\\}/g, '.+') + '$'));
const isSamText = (text: string) => samTextRes.some(re => re.test(text));
/** the bubble order as letters: s = a question of Sam's, k = his word on the key, a = his rejoinder to an answer, g = the man */
const orderOf = (ev: any[]) => ev.map(e => e.who === 'guard' ? 'g' : kindOfSam(e.id)).join('');
export async function dialogueExchange() {
  console.log('\n=== dialogue-exchange: each tap is Sam\'s line over Sam, THEN the man\'s answer — alternating, never both up, paced (Sam never cut · his first 1.2 s only cut short · then cut in), intel and the dry path intact, the hold\'s variant in Sam\'s mouth ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const fmtEv = (e: any, t0: number) => `${(e.t - t0).toFixed(2)}s ${e.who === 'sam' ? 'SAM  ' : 'GUARD'} [${e.id}${e.kind ? ' INTEL ' + e.kind : ''}] (${e.dur.toFixed(2)} s) "${e.text}"`;
  // ---- (a) five exchanges at a player's pace in the ARM hold: alternation, no overlap, the beat, intel at the third — the keyed door, so his KEY comes off his belt
  //      with it and Sam's word on that follows the answer down (a 'key' remark: nobody answers it) — the dry path with Sam's last word, no Sam repeats, the log.
  //      Kowalski plays whatever script he is dealt: Sam's ids run S:<script>:1/2/3/x then the dry pool; a beat's rejoinder ('a') may follow an answer once it is down.
  {
    const S = await stageExchange(521, false); const { game, A, msgs } = S; const R = recorder(S); const fails: string[] = [];
    if (game.player.holding?.phase !== 'held' || game.player.holding.variant !== 'arm') fails.push(`staging: hold ${game.player.holding?.phase}/${game.player.holding?.variant}`);
    const t0 = game.time; const k0 = D.knowledgeOf(game, A);
    const slack = [0.3, 0.7, 0.4, 1.1, 0.5];
    for (let i = 0; i < 5; i++) { if (i > 0 && !R.untilSettled(slack[i])) fails.push(`exchange ${i}: the row never settled`); R.tap(); }
    R.untilSettled(1.0);
    const ev = R.ev; const seq = orderOf(ev);
    const script = D.peekScript(A.talk); const sid = script?.id ?? null;
    if (!/^sga?sga?sgksga?sg$/.test(seq)) fails.push(`bubble order ${seq} (want s·g·[a]·s·g·[a]·s·g·k·s·g·[a]·s·g: five exchanges, Sam then the man each time, a rejoinder only after an answer, and Sam's word on the key after the third answer)`);
    if (R.overlap) fails.push(`Sam's bubble and the man's answer were BOTH live on ${R.overlap} frame(s)`);
    const keyEv = ev.filter(e => e.who === 'sam' && kindOfSam(e.id) === 'k'), afterEv = ev.filter(e => e.who === 'sam' && kindOfSam(e.id) === 'a');
    const exch = ev.filter(e => !(e.who === 'sam' && kindOfSam(e.id) !== 's'));   // the exchanges proper, remarks and rejoinders set aside
    for (let i = 0; i + 1 < exch.length; i += 2) {
      const s = exch[i], g2 = exch[i + 1]; if (s.who !== 'sam' || g2?.who !== 'guard') { fails.push(`events ${i}/${i + 1} are ${s.who}/${g2?.who} (want Sam then the man)`); continue; }
      const gap = g2.t - s.t; const want = samBeat(s.text.length);
      if (Math.abs(s.dur - want) > 1e-6) fails.push(`exchange ${i / 2 + 1}: Sam's bubble ${s.dur.toFixed(2)} s (samBeat says ${want.toFixed(2)})`);
      if (gap < want - 1e-6 || gap > want + DT + 1e-6) fails.push(`exchange ${i / 2 + 1}: the answer came ${gap.toFixed(3)} s after Sam's line (want its beat, ${want.toFixed(2)} s, to the frame)`);
      if (want < 0.9 - 1e-9 || want > 1.4 + 1e-9) fails.push(`exchange ${i / 2 + 1}: beat ${want.toFixed(2)} outside 0.9‥1.4`);
    }
    for (const a2 of afterEv) {   // a rejoinder goes up the frame the answer before it ended, holds Sam's beat, and reached the log
      const prev = [...ev].reverse().find(e => e.who === 'guard' && e.t <= a2.t); if (!prev) { fails.push(`a rejoinder "${a2.text}" with no answer before it`); continue; }
      const endT = prev.t + prev.dur; if (a2.t < endT - 1e-6 || a2.t > endT + DT + 1e-6) fails.push(`the rejoinder "${a2.text}" went up ${(a2.t - endT).toFixed(3)} s off the end of the answer (want that frame)`);
      if (Math.abs(a2.dur - samBeat(a2.text.length)) > 1e-6 || a2.text.length > D.SAM_MAX_CHARS) fails.push(`rejoinder "${a2.text}" dur ${a2.dur.toFixed(2)} / ${a2.text.length} chars`);
    }
    { // the key beat: one remark, up the frame the third answer's bubble ended (never over it), his beat long, a 'key' line; and the key itself changed hands when that answer LANDED
      const a3 = exch[5], k = keyEv[0];
      if (keyEv.length !== 1) fails.push(`${keyEv.length} key remarks (want exactly one, after the door)`);
      if (k && a3) { const endT = a3.t + a3.dur; if (k.t < endT - 1e-6 || k.t > endT + DT + 1e-6) fails.push(`the key remark went up ${(k.t - endT).toFixed(3)} s after the answer ended (want that frame)`); if (Math.abs(k.dur - samBeat(k.text.length)) > 1e-6) fails.push(`key remark held ${k.dur.toFixed(2)} s (samBeat ${samBeat(k.text.length).toFixed(2)})`); }
      if (!game.player.keys.has('floor') || A.keys.size) fails.push(`after the door was given: Player.keys [${[...game.player.keys].join(',')}], his belt [${[...A.keys].join(',')}] (want floor / empty)`);
      if (game.mission.stats.keys !== 1) fails.push(`mission stats.keys ${game.mission.stats.keys} (want 1)`);
      if (!msgs.some(m => /^you took Kowalski's key/.test(m.text))) fails.push(`no 'took Kowalski's key' line in the log`);
    }
    const sams = exch.filter(e => e.who === 'sam'), answers = exch.filter(e => e.who === 'guard');
    const cats = sams.map(e => catOfSam(e.id));
    if (sams.length === 5) {
      const want = sid ? [`S:${sid}:1`, `S:${sid}:2`, `S:${sid}:3`, `S:${sid}:x`] : null;
      if (want) { for (let i = 0; i < 4; i++) if (sams[i].id.replace(/\?$/, '') !== want[i]) fails.push(`Sam's line ${i + 1} is [${sams[i].id}] (want ${want[i]} — the script's beat)`); if (cats[4] !== 'dry') fails.push(`Sam's fifth line is '${cats[4]}' [${sams[4].id}] (want his last word to a dry man, off the pool)`); }
      else { if (cats[0] !== 'open') fails.push(`Sam's first line is '${cats[0]}' (want an opener)`); if (cats[1] !== 'press') fails.push(`Sam's second is '${cats[1]}' (want pressure)`); if (!(cats[2] === 'q' || cats[2] === 'ask')) fails.push(`Sam's third is '${cats[2]}' (want the ask)`); if (cats[3] !== 'dry' || cats[4] !== 'dry') fails.push(`Sam's 4th / 5th are '${cats[3]}' / '${cats[4]}' (want dry ×2)`); }
      if (sams[2].id.endsWith('?') !== !!(script?.beats?.[3]?.ask)) fails.push(`Sam's third line [${sams[2].id}]: the beat ${script?.beats?.[3]?.ask ? 'has' : 'has no'} ask but the '?' says otherwise`);
      if (new Set(sams.map(e => e.id)).size !== sams.length) fails.push(`Sam repeated himself inside one hold: ${sams.map(e => e.id).join(' ')}`);
      for (const e of sams) { if (!isSamText(e.text)) fails.push(`Sam text "${e.text}" [${e.id}] is in no table`); if (e.text.length > D.SAM_MAX_CHARS || /[{}]/.test(e.text)) fails.push(`Sam text "${e.text}" (${e.text.length} chars / braces)`); if (samLine(e.id)?.needs?.includes('gun')) fails.push(`a GUN line in the arm hold: ${e.id} "${e.text}"`); }
    }
    if (answers.length === 5) {
      const st = answers.map(a => a.stage).join('/'); if (st !== '1/2/3/4/5') fails.push(`the man's stage after each answer: ${st} (want 1/2/3/4/5)`);
      if (answers[2].kind !== 'door' || !A.talk.given.has('door')) fails.push(`the third answer gave ${answers[2].kind ?? 'nothing'} / talk.given [${[...A.talk.given].join(',')}] (want the door — intel must still land)`);
      if (sid) { for (const [i, s] of [[0, '1'], [1, '2'], [3, 'x']] as [number, string][]) if (answers[i].id !== `${sid}:${s}`) fails.push(`answer ${i + 1} is [${answers[i].id}] (want ${sid}:${s} — the script's beat)`); }
      const x5 = D.LINES.find((l: any) => l.id === answers[4].id); if (x5?.s !== 'x') fails.push(`answer 5 is [${answers[4].id}] (want his 'nothing left' pool — the script is four beats)`);
    }
    const you = msgs.filter(m => /^you ▸ /.test(m.text)).map(m => m.text.slice(6)); const allSam = ev.filter(e => e.who === 'sam');
    if (you.length !== allSam.length || you.some((t, i) => t !== allSam[i]?.text)) fails.push(`the log's 'you ▸' lines: ${you.join(' | ')} (want Sam's ${allSam.length} lines verbatim, key remark and rejoinders among them)`);
    if (D.knowledgeOf(game, A) !== k0) fails.push(`knowledge moved ${k0} → ${D.knowledgeOf(game, A)} under questioning`);
    if (!game.player.holding || A.state === 'dead') fails.push('the hold ended / he died under questioning');
    verdict(fails.length === 0, '(a) arm hold, five taps at a player\'s pace: s·g·[a]·… never overlapping, the answer on Sam\'s beat, the dealt script\'s four beats (the door at the third: his key off his belt, Sam\'s word on it as the answer ends) → his last word over the dry pool',
      `${A.callsign} (${D.temperamentOf(A)}, K ${k0}) · script ${sid ?? 'none'} (${script?.shape ?? '—'}) · ${R.frames} frames · order ${seq} · Sam ${sams.map(e => e.id).join(' ')} · stages ${answers.map(a => a.stage).join('/')} · gave [${[...A.talk.given].join(',')}] · Sam's keys [${[...game.player.keys].join(',')}]\n    ` + ev.map(e => fmtEv(e, t0)).join('\n    '), fails);
  }
  // ---- (b) the pacing rules, tap by tap: while Sam speaks → nothing; the answer's first 1.2 s → cut short only; the cut line gone (or past the gap) → the next (cut in: his line ends that frame, Sam's next goes up); a choke chosen over Sam's question → no answer, the stage stands, and the next tap still gets the useful thing
  {
    const S = await stageExchange(522, false); const { game, A } = S; const R = recorder(S); const fails: string[] = []; const t0 = game.time; const notes: string[] = [];
    D.forceScript(A.talk, 'pedant-s1');   // (a script whose first two beats carry no rejoinder: a rejoinder up after a cut answer holds the next tap for its beat — (d) has that rule — and this is about the taps)
    const H = () => game.player.holding;
    R.tap(); const ask0 = H()?.ask ? { ...H()!.ask } : null; const nSam0 = R.ev.length;
    if (!ask0 || nSam0 !== 1) fails.push(`tap 1: ask ${JSON.stringify(ask0)}, events ${nSam0} (want Sam's line up)`);
    R.secs(0.4); R.tap();   // inside Sam's beat
    if (R.ev.length !== 1 || !H()?.ask || Math.abs(H()!.ask!.t - ask0!.t) > 1e-9 || A.talk.stage !== 0) fails.push(`a tap 0.4 s into Sam's line: events ${R.ev.length}, ask ${JSON.stringify(H()?.ask)}, stage ${A.talk.stage} (want nothing to change)`);
    notes.push(`tap during Sam's line → events ${R.ev.length}, stage ${A.talk.stage}`);
    for (let i = 0; i < 120 && A.talk.stage < 1; i++) R.step();   // the answer lands
    const ans1 = R.ev.find(e => e.who === 'guard'); if (!ans1) fails.push('no answer to the first line');
    R.secs(0.5); const durBefore = A.bubble?.dur ?? -1; R.tap(); const durCut = A.bubble?.dur ?? -1;   // 0.5 s into the answer: cut short only
    if (R.ev.length !== 2 || A.talk.stage !== 1 || H()?.ask) fails.push(`a tap 0.5 s into the answer: events ${R.ev.length}, stage ${A.talk.stage}, ask ${!!H()?.ask} (want the line cut, nothing asked)`);
    if (!(durCut < durBefore && durCut < 0.5 + 0.3 + DT + 1e-6)) fails.push(`the cut: dur ${durBefore.toFixed(2)} → ${durCut.toFixed(2)} (want ≈ age + 0.3)`);
    notes.push(`tap 0.5 s into the answer → dur ${durBefore.toFixed(2)}→${durCut.toFixed(2)}, stage ${A.talk.stage}`);
    R.secs(0.4); R.tap();   // 0.9 s after the answer began: inside INTERROGATE_GAP still, but the cut line has been down since +0.8 — nothing of it left to keep: the second exchange opens (the row stopped offering to cut a line nobody could see)
    if (R.ev.length !== 3 || R.ev[2].who !== 'sam' || !H()?.ask) fails.push(`a tap 0.9 s after the answer began, its cut line gone: events ${R.ev.map(e => e.who).join(',')}, ask ${!!H()?.ask} (want Sam's second line up)`);
    for (let i = 0; i < 120 && A.talk.stage < 2; i++) R.step();
    const ans2 = R.ev[3]; if (ans2?.who !== 'guard' || A.talk.stage !== 2) fails.push(`second answer: ${ans2?.who} stage ${A.talk.stage}`);
    // let the second answer run 1.3 s (past the gap, well inside a ≥ 2.5 s line), then tap: CUT IN — the answer's bubble ends this very frame, Sam's third line goes up the same frame, no overlap
    R.secs(1.3); const liveBefore = A.bubble && game.time - A.bubble.t < A.bubble.dur; R.tap();
    const cutTo = A.bubble ? A.bubble.dur - (game.time - A.bubble.t) : NaN;   // (the tap was read inside the step just taken, after game.time had advanced: 'now' for it is game.time)
    if (!liveBefore) fails.push('staging: the second answer was already over at +1.3 s (want it mid-line for the cut-in)');
    if (R.ev.length !== 5 || R.ev[4].who !== 'sam') fails.push(`the cut-in tap: events ${R.ev.map(e => e.who).join(',')} (want Sam's third line up at once)`);
    if (!(Math.abs(cutTo) < 1e-6)) fails.push(`the cut-in left the answer ${cutTo.toFixed(3)} s to run (want it over that frame)`);
    notes.push(`cut-in at +1.3 s of answer 2 → answer left ${cutTo.toFixed(3)} s, Sam's 3rd up: "${R.ev[4]?.text ?? '—'}"`);
    // now, over Sam's THIRD line (the ask — Kowalski gives the door at 3), choose the choke and stop it 0.8 s on: the pending answer is dropped as the arm closes, the stage stays 2, Sam's bubble is cut; then a fresh tap → the door still comes
    R.secs(0.2); const samB = game.player.bubble; const samDur0 = samB?.dur ?? -1;
    game.selectVerb('held', 'choke'); S.W.input.pressed.add('Space'); let choked = false; for (let i = 0; i < Math.round(0.8 / DT); i++) { R.step(); if (H()?.phase === 'choke') choked = true; } S.W.input.pressed.add('Space'); R.secs(0.3);   // (the second tap stops it — read in the first of those steps)
    const samDur1 = samB?.dur ?? -1;
    if (!choked) fails.push('staging: the choke row tapped over Sam\'s line never began the choke in 0.8 s');
    if (H()?.phase !== 'held' || A.state === 'dead') fails.push(`after easing off: ${H()?.phase}, A ${A.state}`);
    if (A.talk.stage !== 2 || H()?.ask || R.ev.length !== 5) fails.push(`the choke over the question: stage ${A.talk.stage}, ask ${!!H()?.ask}, events ${R.ev.length} (want 2 / none / 5 — no answer to a question choked off)`);
    if (!(samDur1 < samDur0)) fails.push(`Sam's bubble was not cut when the choke went in (dur ${samDur0.toFixed(2)} → ${samDur1.toFixed(2)})`);
    if (A.talk.given.size) fails.push(`talk.given [${[...A.talk.given].join(',')}] before he ever answered the ask — intel booked without being said`);
    R.untilSettled(0.3); R.tap(); for (let i = 0; i < 150 && A.talk.stage < 3; i++) R.step(); R.secs(0.2);
    const ans3 = R.ev[R.ev.length - 1];
    if (A.talk.stage !== 3 || ans3?.who !== 'guard' || ans3.kind !== 'door' || !A.talk.given.has('door')) fails.push(`after the fresh tap: stage ${A.talk.stage}, last ${ans3?.who} kind ${ans3?.kind ?? '—'} given [${[...A.talk.given].join(',')}] (want 3 / the door, nothing lost)`);
    const sam3b = R.ev[R.ev.length - 2]; const l3 = samLine(sam3b?.id); notes.push(`re-ask after the aborted choke: SAM [${sam3b?.id} ${l3?.s}${l3?.q ? ':' + l3.q : ''}] "${sam3b?.text}" → GUARD ${ans3?.kind ? 'INTEL ' + ans3.kind : ans3?.id} "${ans3?.text}"`);
    if (R.overlap) fails.push(`both bubbles live on ${R.overlap} frame(s)`);
    const seq = R.ev.map(e => e.who[0]).join(''); if (seq !== 'sgsgssg') fails.push(`bubble order ${seq} (want sgsgssg — the fifth, Sam's choked-off ask, gets no answer)`);
    verdict(fails.length === 0, '(b) pacing: a tap while Sam speaks does nothing · 0.5 s into the answer only cuts it · once the cut line is gone (0.9 s) the next opens · a cut-in ends his line that frame · a choke chosen over the question drops the answer, keeps the stage, and the door still comes on the re-ask',
      `${notes.join(' · ')}\n    ` + R.ev.map(e => fmtEv(e, t0)).join('\n    '), fails);
  }
  // ---- (c) the variant in his mouth, across a few seeds. Questions are the ARM's now (player.ts: no questions over a gun): a man grabbed DRAWN has no question row at
  //      all (his one row is the whip); E holsters onto him and the three exchanges then run as ever — and in every arm exchange, from a holstered grab or a
  //      holstered-again one, Sam's lines may carry the arm / the blade (at least once over the seeds) and NEVER the pistol. The one place a [gun] line is still heard
  //      is Sam's remark as he draws mid-hold — gunhold-probes.ts hold-draw has that.
  {
    const fails: string[] = []; const seen = new Set<string>(); let armLines = 0, wrong = 0, gunQuestionRows = 0; const samples: string[] = [];
    for (const [gun, seeds] of [[true, [531, 532, 533, 534]], [false, [535, 536, 537, 538]]] as [boolean, number[]][]) for (const seed of seeds) {
      const S = await stageExchange(seed, gun); const { game, A } = S; const R = recorder(S);
      if (game.player.holding?.variant !== (gun ? 'gun' : 'arm')) fails.push(`seed ${seed}: staging — variant ${game.player.holding?.variant}`);
      if (gun) {   // over the gun: no question row to tap (the whip is his one row); then holster (E) and let the hand-over pass
        R.secs(1.5); const rows = game.nearby.map((r: any) => r.verb).join('/'); const canAsk = game.selectVerb('held', 'question'); if (canAsk) gunQuestionRows++;
        if (canAsk || rows !== 'whip' || R.ev.length || A.talk.stage) fails.push(`seed ${seed} (gun hold): rows [${rows}], question selectable ${canAsk}, events [${R.ev.map(e => e.who).join(',')}], stage ${A.talk.stage} (want the whip alone — no questions over a gun)`);
        S.W.input.pressed.add('KeyE'); R.secs(0.5);
        if (game.player.holding?.variant !== 'arm' || !game.player.holstered) fails.push(`seed ${seed}: E did not holster onto him (variant ${game.player.holding?.variant}, holstered ${game.player.holstered})`);
        if (R.ev.length) fails.push(`seed ${seed}: holstering put a bubble up: [${R.ev.map(e => `${e.who} "${e.text}"`).join(', ')}]`);
      }
      const ev0 = R.ev.length;
      for (let i = 0; i < 3; i++) { if (i > 0) R.untilSettled(0.3); R.tap(); }
      R.untilSettled(0.2);
      const ev = R.ev.slice(ev0);
      for (const e of ev.filter(x => x.who === 'sam')) {
        const l = samLine(e.id); const N: string[] = l?.needs ?? [];
        seen.add(e.id);
        if (N.includes('arm') || N.includes('knife')) armLines++;
        if (N.includes('gun')) { wrong++; fails.push(`seed ${seed} (${gun ? 'holstered-again' : 'arm'} hold): ${e.id} "${e.text}" is a gun line — put as a question`); }
      }
      if (R.overlap) fails.push(`seed ${seed}: both bubbles live on ${R.overlap} frame(s)`);
      if (orderOf(ev) !== 'sgsgsgk') fails.push(`seed ${seed}: order ${orderOf(ev)} (want sgsgsgk — three exchanges, the third the door, then Sam's word on the key)`);
      if (A.talk.stage !== 3) fails.push(`seed ${seed}: stage ${A.talk.stage} after three exchanges (want 3${gun ? ' — nothing was spent over the gun' : ''})`);
      if (seed === 531 || seed === 535) samples.push(`${gun ? 'drawn, then holstered' : 'arm'} ${seed}: ` + ev.map(e => `${e.who === 'sam' ? (samLine(e.id)?.s === 'key' ? 'K' : 'S') : 'G'} "${e.text}"`).join(' / '));
      if (!game.player.keys.has('floor')) fails.push(`seed ${seed}: no key in Sam's pocket after the door was given`);
      if (A.state === 'dead') fails.push(`seed ${seed}: he died`);
    }
    verdict(fails.length === 0, '(c) the variant in his mouth: over a gun there is no question row; holstered (from the start or by E) the exchanges run — the dealt script\'s beats — and never a pistol line as a question',
      `question rows offered over the gun: ${gunQuestionRows} of four holds · arm-side exchanges: ${armLines} pool arm/blade lines among [${[...seen].join(' ')}] · gun lines as questions ${wrong}\n    ${samples.join('\n    ')}`, fails);
  }
  // ---- (d) the rejoinder (Hold.after off a beat's `after` / `take`): the corridor man renamed Novak (nervy) with his belt emptied (no door: the key remark would take
  //      the give beat's place), forced 'folder-n1', four exchanges at an easy pace — after answers 1, 2 (the useful thing: its `take`) and the last, Sam's third
  //      turn goes up the frame the answer's bubble ends, holds his beat, reaches the log, is never up with the answer, and a tap while it hangs does nothing
  {
    const S = await stageExchange(523, false); const { game, A, msgs } = S; const R = recorder(S); const fails: string[] = []; const t0 = game.time;
    const B = game.guards[1]; [A.callsign, B.callsign] = [B.callsign, A.callsign]; A.keys.clear(); D.forceScript(A.talk, 'folder-n1');
    let tapsIgnored = 0, tapsTried = 0;
    for (let i = 0; i < 4; i++) {
      if (i > 0) { // wait for the answer to end and any rejoinder to show; tap once WHILE it hangs (nothing may happen), then wait it out
        for (let f = 0; f < 60 * 12; f++) { const H = game.player.holding; const sb = game.player.bubble; if (H && !H.after && sb && kindOfSam(D.samMemoryOf(game).last ?? '') === 'a' && game.time - sb.t > 0.2 && game.time - sb.t < sb.dur - 0.2) { tapsTried++; const n0 = R.ev.length, st0 = A.talk.stage; R.tap(); if (R.ev.length !== n0 || A.talk.stage !== st0 || game.player.holding?.ask) fails.push(`a tap while the rejoinder hung opened / cut something (events ${n0}→${R.ev.length})`); else tapsIgnored++; break; } if (H && !H.after && heldTalk(game, H).settled && !(sb && game.time - sb.t < sb.dur)) break; R.step(); }
        R.untilSettled(0.4);
      }
      R.tap();
    }
    R.untilSettled(1.5);
    const ev = R.ev; const seq = orderOf(ev); const afterEv = ev.filter(e => e.who === 'sam' && kindOfSam(e.id) === 'a');
    if (D.peekScript(A.talk)?.id !== 'folder-n1' || D.temperamentOf(A) !== 'nervy') fails.push(`staging: script ${D.peekScript(A.talk)?.id}, ${D.temperamentOf(A)}`);
    if (!/^sgasgasga?sga$/.test(seq)) fails.push(`bubble order ${seq} (want sga·sga·sg[a]·sga — a rejoinder after the opener's answer, the take after the useful thing, the last word's)`);
    if (R.overlap) fails.push(`Sam and the man both up on ${R.overlap} frame(s)`);
    for (const a2 of afterEv) { const prev = [...ev].reverse().find(e => e.who === 'guard' && e.t <= a2.t); if (!prev) { fails.push(`rejoinder "${a2.text}" before any answer`); continue; } const endT = prev.t + prev.dur; if (a2.t < endT - 1e-6 || a2.t > endT + DT + 1e-6) fails.push(`"${a2.text}" went up ${(a2.t - endT).toFixed(3)} s off the end of "${prev.text}" (want that frame)`); if (Math.abs(a2.dur - samBeat(a2.text.length)) > 1e-6) fails.push(`"${a2.text}" held ${a2.dur.toFixed(2)} (samBeat ${samBeat(a2.text.length).toFixed(2)})`); if (!msgs.some(m => m.text === `you ▸ ${a2.text}`)) fails.push(`"${a2.text}" never reached the log`); }
    const gives = ev.filter(e => e.who === 'guard' && e.kind); if (!gives.length) fails.push('the nervy man gave nothing in four (want the radio check at 2)'); else { const tk = ev[ev.indexOf(gives[0]) + 1]; const sc = D.scriptById('folder-n1'); if (!tk || kindOfSam(tk.id) !== 'a' || tk.text !== sc.beats[2].take) fails.push(`after the useful thing Sam said ${tk ? `"${tk.text}"` : 'nothing'} (want the beat's take "${sc.beats[2].take}")`); }
    if (!tapsTried) fails.push('staging: never managed a tap while a rejoinder hung'); else if (tapsIgnored !== tapsTried) fails.push('a tap during a rejoinder was not ignored');
    verdict(fails.length === 0, '(d) the rejoinder: after the opener\'s answer, after the useful thing (the beat\'s take) and after the last word, Sam\'s third turn goes up the frame the answer ends, holds his beat, logs, never overlaps, and a tap under it does nothing',
      `${A.callsign} (${D.temperamentOf(A)}) · order ${seq} · ${afterEv.length} rejoinders · taps under a rejoinder ignored ${tapsIgnored}/${tapsTried}\n    ` + ev.map(e => fmtEv(e, t0)).join('\n    '), fails);
  }
  console.log(`=== dialogue-exchange: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (8) the handler's two lines at the mission's beats, and two calm men stopping to talk
export async function dialogueRadio() {
  console.log('\n=== dialogue-radio: the handler — her line into the radio strip at a mission beat, his a beat later over him and into the strip; never in a fight, a hold or the tour — and the ambient pairs: two calm men within a few metres stop, half turn and talk, then walk on ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const radioLines = (msgs: { t: number; text: string }[], from = 0) => msgs.filter(m => m.t >= from && /^radio: (handler|you) ▸ /.test(m.text));
  // ---- (a) the beats mission.ts owns: walk into the server room ('server', a beat behind the objective line), pull the drive ('drive'), the rack check ('rack', behind
  //      the guard's own radio call); each: her line 'radio: handler ▸ …' first, his 'radio: you ▸ …' RADIO_REPLY_SECS later with a radio bubble over him, both from
  //      HANDLER_LINES with {rack} said as a number, ≤ 60, once each; then the edges she reads herself: the lights dying ('blackout')
  {
    Math.random = seeded(801);
    const W = await standUp(); const { game } = W; const fails: string[] = []; const notes: string[] = [];
    const msgs: { t: number; text: string }[] = []; const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
    game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(A, 0, true); park(B, 1, true); place(C, [30, 0, 11.2], Math.PI / 2); C.hold = false;   // (one calm man left walking, for the rack errand)
    if (game.mission.stage !== 'infiltrate') fails.push(`staging: mission ${game.mission.stage}`);
    const rack = String(game.level.mission.rack.index + 1);
    const pair = (beat: string, from: number) => { const L = radioLines(msgs, from); const h = L.find(m => m.text.startsWith('radio: handler ▸ ')), y = L.find(m => m.text.startsWith('radio: you ▸ ')); const pool = D.HANDLER_LINES[beat];
      if (!h || !y) { fails.push(`${beat}: strip lines [${L.map(m => m.text).join(' | ') || 'none'}] (want hers then his)`); return; }
      const ht = h.text.slice('radio: handler ▸ '.length), yt = y.text.slice('radio: you ▸ '.length);
      const entry = pool.find((x: any) => x.h.replace(/\{rack\}/g, rack) === ht); if (!entry) fails.push(`${beat}: "${ht}" is not one of her '${beat}' lines`); else if (entry.s.replace(/\{rack\}/g, rack) !== yt) fails.push(`${beat}: he answered "${yt}" (want "${entry.s}")`);
      const gap = y.t - h.t; if (Math.abs(gap - D.RADIO_REPLY_SECS) > DT + 1e-6) fails.push(`${beat}: his answer came ${gap.toFixed(2)} s after hers (want ${D.RADIO_REPLY_SECS})`);
      if (ht.length > 60 || yt.length > 60 || /[{}]/.test(ht + yt)) fails.push(`${beat}: lengths ${ht.length}/${yt.length} or a brace left`);
      const sb = game.player.bubble; if (!sb || sb.text !== yt || !sb.radio) fails.push(`${beat}: Sam's bubble is ${sb ? `"${sb.text}" radio ${sb.radio}` : 'none'} (want his answer, with the radio glyph)`);
      notes.push(`${beat}: +${(h.t - from).toFixed(1)} s "${ht}" → +${gap.toFixed(1)} s "${yt}"`); };
    // server room
    let tIn = game.time; game.teleportPlayer([17.5, 0, 7.5]); for (let i = 0; i < Math.round(4.5 / DT); i++) W.step(DT);
    if (game.mission.stage !== 'drive') fails.push(`walking into the server room: stage ${game.mission.stage}`); pair('server', tIn);
    // the drive
    for (let i = 0; i < Math.round(3 / DT); i++) W.step(DT); tIn = game.time; drivePulled(game); for (let i = 0; i < Math.round(4.5 / DT); i++) W.step(DT); pair('drive', tIn);
    // the rack errand: sendRackCheck fires 7 s after the pull; her line trails the guard's by RADIO_EDGE-ish
    tIn = game.time; let sent = -1; for (let i = 0; i < Math.round(12 / DT); i++) { W.step(DT); if (sent < 0 && C.task?.kind === 'rack') sent = game.time; }
    if (sent < 0) fails.push(`no rack errand went out (C ${C.state} task ${C.task?.kind ?? '—'})`); else pair('rack', sent - DT);
    // once each: pulling 'again' says nothing new
    const n0 = radioLines(msgs).length; drivePulled(game); for (let i = 0; i < Math.round(4 / DT); i++) W.step(DT); if (radioLines(msgs).length !== n0) fails.push('the drive beat sounded twice in one run');
    // the blackout edge (lighting.ts setBlackout — the guards' own radio line first, hers RADIO_EDGE_DELAY behind)
    tIn = game.time; setBlackout(game, 40, 'debug'); for (let i = 0; i < Math.round(7 / DT); i++) W.step(DT); pair('blackout', tIn); game.endBlackout?.(); for (let i = 0; i < 30; i++) W.step(DT);
    verdict(fails.length === 0, '(a) server room, drive, rack check, blackout: her line then his RADIO_REPLY_SECS later (strip + a radio bubble over him), from the table with the rack said as a number, once a run',
      notes.join('\n    ') + `\n    strip: ${radioLines(msgs).map(m => `${m.t.toFixed(1)}s ${m.text}`).join(' | ')}`, fails);
  }
  // ---- (b) the gates: nothing under the tour flag, nothing with a man at 'alert' (a queued beat waits for calm, then sounds), nothing with a man in his arm, and a
  //      restart lets every beat sound again
  {
    Math.random = seeded(802);
    const W = await standUp(); const { game } = W; const fails: string[] = []; const notes: string[] = [];
    const msgs: { t: number; text: string }[] = []; const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
    game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true; for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1, true); park(C, 2, true);
    // tour flag up: the server beat never sounds
    game.quietUtility = true; game.teleportPlayer([17.5, 0, 7.5]); for (let i = 0; i < Math.round(4 / DT); i++) W.step(DT);
    if (radioLines(msgs).length) fails.push(`under quietUtility: ${radioLines(msgs).map(m => m.text).join(' | ')}`); notes.push(`tour flag: ${radioLines(msgs).length} lines`);
    game.quietUtility = false;
    // a man alert: the drive beat is queued (delay) and waits; calm again → it sounds
    place(A, [6, 0, 20], 0); A.hold = true; A.pinned = true; A.state = 'alert'; A.awareness = 1; A.lastKnown = [8, 0, 20]; A.reactT = 5;
    const t1 = game.time; drivePulled(game); for (let i = 0; i < Math.round(4 / DT); i++) { W.step(DT); A.state = 'alert'; }
    const during = radioLines(msgs, t1).length; A.state = 'patrol'; A.awareness = 0; for (let i = 0; i < Math.round(5 / DT); i++) W.step(DT); const after = radioLines(msgs, t1).length;
    if (during) fails.push(`with a man at alert the strip got ${during} line(s)`); if (after !== 2) fails.push(`once calm the queued drive beat gave ${after} lines (want 2)`); notes.push(`alert: ${during} during, ${after} once calm`);
    // a man in his arm: the rack beat (direct call) says nothing; free again it can
    place(A, [14, 0, 11.2], Math.PI / 2); A.hold = false; A.pinned = false; A.wp = 1; game.playerInvisible = false; game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; game.player.holstered = true; W.step(DT); game.player.visibility = 0.02;
    startGrab(game, A); for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT);
    const t2 = game.time; const okHeld = D.handlerBeat(game, 'rack'); for (let i = 0; i < Math.round(3 / DT); i++) W.step(DT);
    if (okHeld || radioLines(msgs, t2).length) fails.push(`with a man in his arm handlerBeat returned ${okHeld}, strip ${radioLines(msgs, t2).length}`); notes.push(`holding: sounded ${okHeld}`);
    game.playerInvisible = true; game.freeHeld('cancel'); for (let i = 0; i < 30; i++) W.step(DT); for (const x of game.guards) { x.state = 'patrol'; x.awareness = 0; x.hold = true; x.lastKnown = null; x.searchT = 0; } for (let i = 0; i < Math.round(9 / DT); i++) W.step(DT);   // (a man let go comes off it knowing everything — alert — and she keeps quiet through a fight, rightly; calm him by hand, and let the beat the alarm queued play out and its spacing pass: this is about the arm being free)
    const t3 = game.time; const okFree = D.handlerBeat(game, 'rack'); for (let i = 0; i < Math.round(3 / DT); i++) W.step(DT); if (!okFree || radioLines(msgs, t3).length !== 2) fails.push(`free again: ${okFree}, ${radioLines(msgs, t3).length} lines — holding ${!!game.player.holding} takedown ${!!game.player.takedown} states ${game.guards.map((x: any) => x.state).join('/')} stage ${game.mission.stage} quiet ${game.quietUtility} down ${game.player.down} bubble ${game.player.bubble ? game.player.bubble.text : 'none'} strip lately: ${radioLines(msgs, t3 - 12).map(m => `${(m.t - t3).toFixed(1)} ${m.text}`).join(' | ')}`);
    // restart: the drive beat may sound again
    game.restartEncounter(); for (let i = 0; i < 5; i++) W.step(DT); game.guards.forEach((g2: any, i: number) => park(g2, i, true)); game.playerInvisible = true;
    const t4 = game.time; drivePulled(game); for (let i = 0; i < Math.round(4 / DT); i++) W.step(DT); if (radioLines(msgs, t4).length !== 2) fails.push(`after a restart the drive beat gave ${radioLines(msgs, t4).length} lines (want 2 — a fresh run)`); notes.push(`restart: ${radioLines(msgs, t4).length} lines`);
    verdict(fails.length === 0, '(b) the gates: silent under the tour flag, waits out a man at alert then sounds, silent with a man in his arm, fresh after a restart', notes.join(' · '), fails);
  }
  // ---- (c) the ambient pairs: two calm men planted 3 m apart in the corridor with long dwells — after AMBIENT.firstAfter one conversation plays: 2‥4 lines through
  //      Game.say alternating between the two, both held (standing) while it runs and let go after, ≤ 60 a line, no {token} left; nothing again inside the cooldown;
  //      a second staging: one made suspicious mid-conversation ends it that frame and frees both; a third: the floor up (escalation 1) and nobody ever starts
  {
    const fails: string[] = []; const notes: string[] = [];
    const stage3 = async (seed: number) => { Math.random = seeded(seed); const W = await standUp(); const { game } = W; const T = tap(game); game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true; game.teleportPlayer([37.5, 0, 26.5]); for (let i = 0; i < 5; i++) W.step(DT);
      const [A, B, C] = game.guards; place(A, [16, 0, 11.2], Math.PI / 2); place(B, [19, 0, 11.2], -Math.PI / 2); A.hold = B.hold = false; A.wait = B.wait = 400; park(C, 2, true); C.hold = true; rollcallState(game).nextAt = game.time + 900; return { W, game, A, B, C, lines: T.lines }; };
    { const { W, game, A, B, lines } = await stage3(811);
      let startAt = -1, endAt = -1, heldDuring = true; const t0 = game.time;
      for (let i = 0; i < Math.round((D.AMBIENT.firstAfter + 25) / DT); i++) { W.step(DT); const run = D.ambientState(game).run; if (run && startAt < 0) startAt = game.time - t0; if (run && !(A.hold && B.hold)) heldDuring = false; if (!run && startAt >= 0 && endAt < 0) endAt = game.time - t0; }
      const conv = lines.filter(l => !l.radio && (l.who === A.callsign || l.who === B.callsign));
      if (startAt < 0) fails.push(`no conversation started in ${D.AMBIENT.firstAfter + 25} s (A ${A.state} aw ${A.awareness.toFixed(2)}, B ${B.state}, dist ${v3.distXZ(A.char.pos, B.char.pos).toFixed(1)} m)`);
      else {
        if (startAt < D.AMBIENT.firstAfter - 0.1) fails.push(`started at +${startAt.toFixed(1)} s (before firstAfter ${D.AMBIENT.firstAfter})`);
        if (conv.length < 2 || conv.length > 4) fails.push(`${conv.length} lines said (want 2‥4)`);
        const talk = D.AMBIENT_PAIRS.find((p: any) => p.lines.length === conv.length && p.lines.every((l: any, i: number) => l.text.replace(/\{other\}/ig, game.guards[2].callsign) === conv[i].text));
        if (!talk) fails.push(`the lines match no AMBIENT_PAIRS entry: ${conv.map(l => `${l.who}: ${l.text}`).join(' | ')}`);
        else { const whoSeq = conv.map(l => l.who); const opener = whoSeq[0]; if (talk.lines.some((l: any, i: number) => (l.who === 0) !== (whoSeq[i] === opener))) fails.push(`speakers ${whoSeq.join('/')} do not alternate as the entry says`); }
        for (let i = 1; i < conv.length; i++) { const gap = conv[i].t - conv[i - 1].t; if (gap < 2 - 1e-6) fails.push(`line ${i + 1} came ${gap.toFixed(2)} s after line ${i} (want ≥ its bubble)`); }
        if (conv.some(l => l.text.length > 60 || /[{}]/.test(l.text))) fails.push('a line over 60 / a brace left');
        if (!heldDuring) fails.push('the men were not held (standing) while it ran'); if (endAt < 0) fails.push('the run never ended'); if (A.hold || B.hold) fails.push('a man still held after it ended');
        // cooldown: nothing new for AMBIENT.cooldown
        const n1 = lines.length; const quietFor = Math.max(1, D.AMBIENT.cooldown - (game.time - t0 - endAt) - 3); for (let i = 0; i < Math.round(quietFor / DT); i++) W.step(DT); const extra = lines.slice(n1).filter(l => !l.radio && (l.who === A.callsign || l.who === B.callsign));
        if (extra.length) fails.push(`inside the cooldown (${quietFor.toFixed(0)} s after it ended) they spoke again: ${extra.map(l => l.text).join(' | ')}`);
        let again = false; for (let i = 0; i < Math.round(12 / DT); i++) { W.step(DT); if (D.ambientState(game).run) again = true; } if (!again) fails.push('past the cooldown, still standing together, they never spoke again');
        notes.push(`talk '${talk?.id ?? '?'}' at +${startAt.toFixed(1)} s, ${conv.length} lines over ${(endAt - startAt).toFixed(1)} s: ${conv.map(l => `${l.who}: "${l.text}"`).join(' / ')}`);
      } }
    { const { W, game, A, B } = await stage3(812);   // abort: B goes suspicious on the second line
      let said = 0, aborted = false; const orig = game.say.bind(game); game.say = (gd: any, text: string, radio = false, force = false) => { if (!radio && (gd === A || gd === B)) said++; return orig(gd, text, radio, force); };
      for (let i = 0; i < Math.round((D.AMBIENT.firstAfter + 20) / DT) && !aborted; i++) { W.step(DT); if (said >= 2 && D.ambientState(game).run) { B.state = 'suspicious'; B.awareness = 0.6; B.lastKnown = [25, 0, 11.2]; B.reactT = 0.8; W.step(DT); aborted = true; } }
      if (!aborted) fails.push('abort staging: never got two lines in'); else { if (D.ambientState(game).run) fails.push('the run survived a man going suspicious'); if (A.hold || B.hold) fails.push(`after the abort: A.hold ${A.hold} B.hold ${B.hold} (want both free)`); }
      notes.push(`abort after ${said} lines: run ${D.ambientState(game).run ? 'STILL ON' : 'ended'}, holds ${A.hold}/${B.hold}`); }
    { const { W, game, A, B } = await stage3(813);   // floor up: never
      game.escalation = 1; game.escalationT = game.time + 600; A.drawn = B.drawn = true;
      let started = false; for (let i = 0; i < Math.round((D.AMBIENT.firstAfter + 15) / DT); i++) { W.step(DT); if (D.ambientState(game).run) started = true; }
      if (started) fails.push('a conversation started on a heightened floor'); notes.push(`heightened floor: started ${started}`); }
    verdict(fails.length === 0, '(c) ambient pairs: two calm men close by talk once (an AMBIENT_PAIRS entry, alternating, paced, held then freed), keep the cooldown, break off the frame one turns suspicious, never start on a floor that is up', notes.join('\n    '), fails);
  }
  console.log(`=== dialogue-radio: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
