// The 'whistle' probe family (run through probes.ts: `bun run tools/qa/probes.ts whistle | whistle-reach | whistle-door | whistle-nearest | whistle-twice |
// whistle-keys | whistle-alert | whistle-torch`): Sam's low whistle (V, src/game/whistle.ts) staged one situation at a time on the real game stood up headless
// (headless.ts) — who hears it along the propagation, who answers, what he does and does not do (no radio, no pistol), the second-time search, the player's
// cooldown and meter — printed with the numbers the design asks about (reach through a shut door), PASS / FAIL each.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const Wh = await import(`${ROOT}/src/game/whistle.ts`);
const { WHISTLE, WHISTLE_STATS, WHISTLE_LOG, whistleMem, whistleLines, whistleReadyIn, tryWhistle } = Wh;
const { handCarry, inHand, resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const LOOK = new Set<string>(whistleLines('look')), TWICE = new Set<string>(whistleLines('twice'));
const f2 = (x: number) => x.toFixed(2);

/** Every guard from index `keep` on out of it: parked in the south-west corner by the spawn (well outside the whistle's 12 m horizon of every staging below —
 *  the corridor from x 14 east, the break-room door), held, pinned, blind and deaf. */
function parkFrom(game: any, keep: number) {
  game.guards.slice(keep).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [4.5, 0, 19 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.char.update(0); });
}
/** Stand a man at `p` facing `face`, calm, on nobody's errand. `hold` = the tour's flag: he stays on the spot (patrol) / watches from it (suspicious). */
function placeGuard(gd: any, p: Vec3, face: Vec3, hold = true) {
  gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0;
  gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.reactT = 0; gd.searchT = 0; gd.task = null; gd.bodyDuty = null; gd.path = []; gd.pathGoal = null; gd.hold = hold; gd.pinned = false; gd.dazzledUntil = -1;
  gd.char.update(0); gd.char.update(DT);
}
/** the common floor: seeded dice, the game up, Sam somewhere with the meter dark, ten frames to settle */
async function floor(seed: number, sam: Vec3) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.playerInvisible = false;
  game.teleportPlayer(v3.copy(sam)); game.player.visibility = 0; game.player.crouch = false;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.player.visibility = 0;
  return W;
}
/** press V this frame and step once; returns whether an event went out (the blown counter moved) */
function pressV(W: any): boolean { const n0 = WHISTLE_STATS.blown; W.input.pressed.add('KeyV'); W.step(DT); return WHISTLE_STATS.blown > n0; }
/** what the propagation says between Sam's mouth and a man's head right now (the numbers hearWhistle works from) */
function propTo(game: any, gd: any) { const c = game.player.char; return game.col.sound.propagate([c.pos[0], game.player.crouch ? 1.0 : 1.55, c.pos[2]], v3.add(gd.char.pos, [0, 1.5, 0])); }

// ================================================================ (a) reach in open air: 6 m behind a calm man → he answers; 11 m → nothing
export async function whistleReach(): Promise<boolean> {
  console.log('\n=== whistle-reach: a calm man with his back turned, 6 m of open corridor away, then 11 m — who answers, what he does, what he does not ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  for (const D of [6, 11]) {
    const W = await floor(700 + D, [14, 0, 11.1]); const { game, audioCounts } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [14 + D, 0, 11.1], [40, 0, 11.1]);   // facing east, Sam due west of him
    for (let i = 0; i < 5; i++) W.step(DT);
    const pr = propTo(game, gd); const reach = WHISTLE.reachK * pr.carry;
    const radio0 = audioCounts.get('radio') ?? 0, wh0 = audioCounts.get('whistle') ?? 0;
    const went = pressV(W); const tEvent = game.time; W.step(DT);   // (the man may run before Sam in nobody's order — one more frame and everybody has had the event)
    const M = whistleMem(gd); const said = gd.bubble && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null;
    const radioD = (audioCounts.get('radio') ?? 0) - radio0, whD = (audioCounts.get('whistle') ?? 0) - wh0;
    if (D === 6) {
      const f: string[] = [];
      if (!went) f.push('no event went out on V');
      if (whD !== 1) f.push(`the whistle voice played ${whD}× (want 1)`);
      if (gd.state !== 'suspicious') f.push(`state ${gd.state} (want suspicious)`);
      if (!gd.lastKnown || v3.distXZ(gd.lastKnown, game.player.char.pos) > 0.3) f.push(`fix ${gd.lastKnown ? `(${f2(gd.lastKnown[0])}, ${f2(gd.lastKnown[2])})` : 'none'} is not Sam's spot (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`);
      if (Math.abs(gd.awareness - WHISTLE.awareness) > 0.02) f.push(`awareness ${f2(gd.awareness)} (want ${WHISTLE.awareness})`);
      if (!said || !LOOK.has(said)) f.push(`said ${JSON.stringify(said)} (want one of the look lines)`);
      if (gd.bubble?.radio) f.push('his line went out over the radio');
      if (radioD !== 0) f.push(`the radio blip played ${radioD}× (want 0: nothing on the net)`);
      if (!M || M.responses !== 1 || M.searches !== 0) f.push(`memory ${JSON.stringify(M)}`);
      if (handCarry(gd) !== 'torch' || inHand(gd) !== 'torch') f.push(`carries ${handCarry(gd)} / in hand ${inHand(gd)} (want the torch: a whistle is not worth the pistol)`);
      const stateAt = gd.state, awAt = gd.awareness, fixAt = gd.lastKnown ? v3.copy(gd.lastKnown) : null;
      // now let him go and watch the whole diversion: off the hold, Sam unseen (invisible once heard — the arrival is not the point here); over to the spot, the look
      // round, the line he talks himself out of it with, and away again
      gd.hold = false; game.playerInvisible = true; const spot = v3.copy(game.player.char.pos); const d0 = v3.distXZ(gd.char.pos, spot);
      let dMin = d0, torchAllWay = true, drewAt = -1, arrivedAt = -1, calmAt = -1, calmLine: string | null = null, leftAt = -1;
      for (let i = 0; i < 60 * 20 && leftAt < 0; i++) {
        W.step(DT); const d = v3.distXZ(gd.char.pos, spot); dMin = Math.min(dMin, d);
        if (arrivedAt < 0 && d < 1.0) arrivedAt = game.time - tEvent;
        if (gd.state === 'suspicious' && handCarry(gd) !== 'torch' && drewAt < 0) { drewAt = game.time; torchAllWay = false; }
        if (calmAt < 0 && gd.state === 'patrol') { calmAt = game.time - tEvent; calmLine = gd.bubble && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null; }
        if (calmAt >= 0 && d > 2.5) leftAt = game.time - tEvent;
      }
      if (arrivedAt < 0) f.push(`he never got within a metre of the spot (nearest ${f2(dMin)} m of ${f2(d0)})`);
      if (calmAt < 0) f.push('he never talked himself out of it in 20 s');
      if (arrivedAt >= 0 && calmAt >= 0 && calmAt - arrivedAt < 2) f.push(`only ${f2(calmAt - arrivedAt)} s at the spot before giving it up (want a look round: ≥ 2)`);
      if (calmAt >= 0 && leftAt < 0) f.push('calm again but never walked away from the spot');
      if (!torchAllWay) f.push(`the pistol came out on the way over (at ${f2(drewAt)} s) with nothing but the whistle to go on`);
      if (game.guards.some((o: any) => o.state === 'alert')) f.push('somebody went to alert');
      verdict(f.length === 0, `(a1) ${D} m of open corridor behind him: he answers — a look line, suspicious toward Sam's spot, torch kept, nothing on the net — walks over, looks round, gives it up, goes back`,
        `propagation: ${pr.direct ? 'direct' : pr.routed ? 'routed' : 'sealed'}, path ${f2(pr.pathLen)} m, carry ${f2(pr.carry)} → reach ${f2(reach)} m · said ${JSON.stringify(said)} → ${stateAt} aw ${f2(awAt)} fix ${fixAt ? `(${f2(fixAt[0])}, ${f2(fixAt[2])})` : 'none'} · in hand ${inHand(gd)} · at the spot +${f2(arrivedAt)} s, calm +${f2(calmAt)} s ("${calmLine}"), ${f2(calmAt - arrivedAt)} s looking round, walking off +${f2(leftAt)} s · radio blips ${radioD}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
    } else {
      const f: string[] = [];
      if (!went) f.push('no event went out on V');
      if (gd.state !== 'patrol' || gd.awareness > 0 || gd.lastKnown) f.push(`state ${gd.state} aw ${f2(gd.awareness)} fix ${!!gd.lastKnown} (want untouched)`);
      if (said) f.push(`said ${JSON.stringify(said)}`);
      if (M && (M.responses || M.glances || M.cues)) f.push(`memory ${JSON.stringify(M)} (want nothing)`);
      const L = WHISTLE_LOG[WHISTLE_LOG.length - 1];
      if (L && Math.abs(L.t - tEvent) < 1e-9 && L.hearers.length) f.push(`the log says it reached ${L.hearers.join('/')}`);
      verdict(f.length === 0, `(a2) ${D} m of open corridor: out of reach — nothing at all happens to him`,
        `propagation: ${pr.direct ? 'direct' : pr.routed ? 'routed' : 'sealed'}, path ${f2(pr.pathLen)} m, carry ${f2(pr.carry)} → reach ${f2(reach)} m (path ≥ reach: unheard) · state ${gd.state} aw ${f2(gd.awareness)}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
    }
  }
  return allPass;
}

// ================================================================ (a3) through a door: 4 m apart across the break room's corridor door, shut then open
export async function whistleDoor(): Promise<boolean> {
  console.log('\n=== whistle-door: 4 m apart through the break room\'s corridor door — shut (the leaf eats it) vs standing open (straight through the doorway) ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  for (const open of [false, true]) {
    const W = await floor(710 + (open ? 1 : 0), [30.6, 0, 10.7]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    const d = game.doors.byName('breakroom_n'); d.reset(); d.vel = 0; d.closing = false;
    if (open) { d.latched = false; d.angle = 1.4; } else { d.angle = 0; d.latched = true; }
    d.place?.();
    placeGuard(gd, [30.6, 0, 14.7], [30.6, 0, 30]);   // inside the break room, back to the door, Sam in the corridor 4 m north through it
    for (let i = 0; i < 5; i++) W.step(DT);
    const pr = propTo(game, gd); const reach = WHISTLE.reachK * pr.carry; const shouldHear = pr.pathLen < reach;
    const went = pressV(W); W.step(DT);
    const M = whistleMem(gd); const answered = !!M && M.responses === 1 && gd.state === 'suspicious';
    const said = gd.bubble && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null;
    const f: string[] = [];
    if (!went) f.push('no event went out on V');
    if (answered !== shouldHear) f.push(`the propagation says ${shouldHear ? 'heard' : 'unheard'} (path ${f2(pr.pathLen)} vs reach ${f2(reach)}) but he ${answered ? 'answered' : 'did not'}`);
    if (!open && answered) f.push('a shut door 4 m off should have eaten it (carry 0.32 → 2.6 m of reach)');
    if (open && !answered) f.push('an open doorway 4 m off should carry it (direct, or routed at 0.72 → 5.8 m)');
    if (answered && (!said || !LOOK.has(said))) f.push(`answered but said ${JSON.stringify(said)}`);
    verdict(f.length === 0, `(a3) door ${open ? 'OPEN' : 'SHUT'}: ${shouldHear ? 'heard — he answers' : 'not heard — nothing'}`,
      `door angle ${f2(d.angle)} latched ${d.latched} · propagation: ${pr.direct ? 'direct' : pr.routed ? 'routed' : 'sealed'}${pr.routed ? ` via (${f2(pr.via[0])}, ${f2(pr.via[2])})` : ''}, path ${f2(pr.pathLen)} m, muffle ${f2(pr.muffle)}, carry ${f2(pr.carry)} → reach ${f2(reach)} m · state ${gd.state} aw ${f2(gd.awareness)} · said ${JSON.stringify(said)}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // ---- (a4) round the corner: the door open but the wall between them — it comes in through the doorway, and THAT is where he goes to look
  for (const samX of [33.2, 35.5]) {
    const W = await floor(715 + Math.round(samX), [samX, 0, 11.0]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    const d = game.doors.byName('breakroom_n'); d.reset(); d.vel = 0; d.closing = false; d.latched = false; d.angle = 1.4; d.place?.();
    placeGuard(gd, [30.4, 0, 14.0], [30.4, 0, 30]);   // inside, back to the doorway; Sam up the corridor east of it, the wall between them
    for (let i = 0; i < 5; i++) W.step(DT);
    const pr = propTo(game, gd); const reach = WHISTLE.reachK * pr.carry; const shouldHear = pr.pathLen < reach;
    const went = pressV(W); W.step(DT);
    const M = whistleMem(gd); const answered = !!M && M.responses === 1 && gd.state === 'suspicious';
    const fix = gd.lastKnown ? v3.copy(gd.lastKnown) : null; const via: Vec3 = [pr.via[0], 0, pr.via[2]];
    const f: string[] = [];
    if (!went) f.push('no event went out on V');
    if (pr.direct) f.push('staging: the line was direct, not routed (the wall should be between them)');
    if (answered !== shouldHear) f.push(`the propagation says ${shouldHear ? 'heard' : 'unheard'} (path ${f2(pr.pathLen)} vs reach ${f2(reach)}) but he ${answered ? 'answered' : 'did not'}`);
    if (answered && (!fix || v3.distXZ(fix, via) > 0.6)) f.push(`his fix (${f2(fix?.[0] ?? NaN)}, ${f2(fix?.[2] ?? NaN)}) is not the doorway it came through (${f2(via[0])}, ${f2(via[2])})`);
    if (answered && fix && v3.distXZ(fix, game.player.char.pos) < 1.0) f.push('his fix is Sam himself through the wall (want the doorway)');
    verdict(f.length === 0, `(a4) Sam ${f2(v3.distXZ(game.player.char.pos, gd.char.pos))} m off round the corner, door open: ${shouldHear ? 'heard through the doorway — he answers, and walks to the DOORWAY' : 'too far round — nothing'}`,
      `propagation: ${pr.direct ? 'direct' : pr.routed ? 'routed' : 'sealed'} via (${f2(via[0])}, ${f2(via[2])}), path ${f2(pr.pathLen)} m, muffle ${f2(pr.muffle)}, carry ${f2(pr.carry)} → reach ${f2(reach)} m · ${answered ? `answered: fix (${f2(fix![0])}, ${f2(fix![2])}), Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})` : `state ${gd.state} aw ${f2(gd.awareness)}`}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  return allPass;
}

// ================================================================ (b) two men hear it: only the nearer answers, the other turns his head
export async function whistleNearest(): Promise<boolean> {
  console.log('\n=== whistle-nearest: two calm men 4 m and 7 m up the corridor, backs turned — one answers, one glances ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const W = await floor(720, [14, 0, 11.1]); const { game } = W;
  parkFrom(game, 2); const [A, B] = game.guards;
  placeGuard(A, [21, 0, 11.1], [40, 0, 11.1]); placeGuard(B, [18, 0, 11.3], [40, 0, 11.3]);   // B the nearer (4 m), A behind him at 7 m — roster order the other way about on purpose (A's ears run first)
  for (let i = 0; i < 5; i++) W.step(DT);
  const went = pressV(W); const tEvent = game.time; W.step(DT);
  const MA = whistleMem(A), MB = whistleMem(B);
  const saidA = A.bubble && game.time - A.bubble.t < 0.1 ? A.bubble.text : null, saidB = B.bubble && game.time - B.bubble.t < 0.1 ? B.bubble.text : null;
  let crane = 0; for (let i = 0; i < 20; i++) { W.step(DT); crane = Math.max(crane, Math.abs(A.char.anim.lookYawExtra)); }   // the far man's neck over the next third of a second
  const L = WHISTLE_LOG[WHISTLE_LOG.length - 1];
  const f: string[] = [];
  if (!went) f.push('no event went out on V');
  if (B.state !== 'suspicious' || !MB || MB.responses !== 1 || !saidB || !LOOK.has(saidB)) f.push(`the near man: state ${B.state}, memory ${JSON.stringify(MB)}, said ${JSON.stringify(saidB)} (want him answering)`);
  if (A.state !== 'patrol' || A.awareness > 0.01 || (MA?.responses ?? 0) !== 0 || saidA) f.push(`the far man: state ${A.state} aw ${f2(A.awareness)} responses ${MA?.responses} said ${JSON.stringify(saidA)} (want untouched but for the head)`);
  if (!MA || MA.glances !== 1 || Math.abs(MA.glanceUntil - (tEvent + WHISTLE.glanceSecs)) > 1e-6) f.push(`the far man's glance: ${JSON.stringify(MA)}`);
  if (crane < 0.8) f.push(`the far man's neck turned only ${f2(crane)} rad toward it (want the clamp, ~${WHISTLE.glanceMax})`);
  if (!L || Math.abs(L.t - tEvent) > 1e-9 || L.hearers.length !== 2) f.push(`the log's last entry: ${JSON.stringify(L)}`);
  const responders = game.guards.filter((x: any) => { const m = whistleMem(x); return !!m && Math.abs(m.respondedAt - tEvent) < 1e-9; }).length;
  if (responders !== 1) f.push(`${responders} men answered the one whistle`);
  verdict(f.length === 0, '(b) only the nearest calm hearer answers; the other hears it (in the log), turns his head, keeps his state',
    `log: heard by ${L?.hearers.join('/')} → ${L?.responder} to answer, ${L?.answered} did · near ${B.callsign}: ${B.state} "${saidB}" · far ${A.callsign}: ${A.state} aw ${f2(A.awareness)}, glances ${MA?.glances}, neck ${f2(crane)} rad${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  return allPass;
}

// ================================================================ (c) the twice rule: a second inside the window → a search; once, 70 s, once → another look
export async function whistleTwice(): Promise<boolean> {
  console.log('\n=== whistle-twice: the same man whistled over twice inside a minute searches the place; once, seventy seconds, once = just another look ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  // ---- (c1) twice, three seconds apart, the man free to come
  {
    const W = await floor(730, [14, 0, 11.1]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], false); gd.wp = 1;   // free: he will come (wp 1: his own route runs east from here, so left alone he walks AWAY from Sam)
    for (let i = 0; i < 3; i++) W.step(DT);
    pressV(W); W.step(DT);
    const first = { state: gd.state, said: gd.bubble?.text ?? null };
    for (let i = 0; i < 60 * 3; i++) W.step(DT);   // three seconds on: he is on his way over (and Sam, meter dark, is not seen at this range)
    const dMid = v3.distXZ(gd.char.pos, game.player.char.pos); const seenMid = gd.state === 'alert';
    const went2 = pressV(W); W.step(DT);
    const M = whistleMem(gd); const said2 = gd.bubble && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null; const state2 = gd.state;
    game.playerInvisible = true;   // (from here the arrival is not the point: nobody is to be found)
    let planned = false, planFix: Vec3 | null = null, spots = 0, searchSecs = 0, endedWith: string | null = null, alertEver = false, radioLine = false;
    const fixAt = v3.copy(gd.lastKnown ?? [0, 0, 0]);
    for (let i = 0; i < 60 * 40 && !endedWith; i++) {
      W.step(DT);
      if (gd.state === 'search') { searchSecs += DT; if (gd.searchPlan && !planned) { planned = true; planFix = v3.copy(gd.searchPlan.fix); spots = gd.searchPlan.spots.length; } }
      else if (searchSecs > 0) endedWith = gd.bubble?.text ?? '(nothing said)';
      if (gd.state === 'alert') alertEver = true; if (gd.bubble?.radio && game.time - gd.bubble.t < DT) radioLine = true;
    }
    const f: string[] = [];
    if (first.state !== 'suspicious' || !first.said || !LOOK.has(first.said)) f.push(`the first: state ${first.state}, said ${JSON.stringify(first.said)}`);
    if (seenMid) f.push('he had gone to alert before the second whistle (staging: Sam was seen)');
    if (!went2) f.push(`the second V sent nothing (cooldown ${WHISTLE.cooldown} s, 3 s apart)`);
    if (state2 !== 'search') f.push(`after the second: state ${state2} (want search)`);
    if (!said2 || !TWICE.has(said2)) f.push(`after the second he said ${JSON.stringify(said2)} (want a twice line)`);
    if (!M || M.responses !== 2 || M.searches !== 1) f.push(`memory ${JSON.stringify(M)}`);
    if (!planned) f.push('no search plan was ever dealt'); else if (planFix && v3.distXZ(planFix, fixAt) > 1.0) f.push(`the plan was dealt round (${f2(planFix[0])}, ${f2(planFix[2])}), not the whistle's spot (${f2(fixAt[0])}, ${f2(fixAt[2])})`);
    if (searchSecs < 11.5) f.push(`searched only ${f2(searchSecs)} s (the search's own floor is 12)`);
    if (alertEver) f.push('he went to ALERT off two whistles');
    if (radioLine) f.push('a line of his went out over the radio');
    if (handCarry(gd) === 'torch' && gd.state === 'search') f.push('searching with the torch in his hand (a search has the gun out)');
    verdict(f.length === 0, '(c1) whistle, 3 s, whistle: the second makes it a search — a twice line, the search state, a plan of spots round the spot, ≥ 12 s of it, never alert, never the radio',
      `first: ${first.state} "${first.said}" · at the second he was ${f2(dMid)} m off → ${state2} "${said2}" · plan ${planned ? `${spots} spots round (${f2(planFix![0])}, ${f2(planFix![2])})` : 'none'} · searched ${f2(searchSecs)} s, ended with "${endedWith}" · memory responses ${M?.responses} searches ${M?.searches}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // ---- (c2) once, seventy seconds (well past the window), once — a man held on his mark so the first look plays out on the spot
  {
    const W = await floor(731, [14, 0, 11.1]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], true);
    for (let i = 0; i < 3; i++) W.step(DT);
    pressV(W); W.step(DT); const s1 = gd.state, said1 = gd.bubble?.text ?? null;
    for (let i = 0; i < 60 * 70; i++) W.step(DT);   // seventy seconds: he watches the spot from his mark, talks himself out of it, stands calm again
    const sMid = gd.state; placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], true);   // (square him up again where he stands: seventy seconds of idle look-about drift his facing)
    W.step(DT);
    const went = pressV(W); W.step(DT);
    const M = whistleMem(gd); const said2 = gd.bubble && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null;
    const f: string[] = [];
    if (s1 !== 'suspicious' || !said1 || !LOOK.has(said1)) f.push(`the first: ${s1} "${said1}"`);
    if (sMid !== 'patrol') f.push(`70 s on he was still ${sMid} (want calm again)`);
    if (!went) f.push('the second V sent nothing');
    if (gd.state !== 'suspicious') f.push(`after the second: ${gd.state} (want suspicious — another look, not a search: ${WHISTLE.twiceWindow} s window)`);
    if (!said2 || !LOOK.has(said2)) f.push(`after the second he said ${JSON.stringify(said2)} (want a look line)`);
    if (said1 && said2 && said1 === said2 && LOOK.size > 1) f.push(`the same line twice running: "${said2}"`);
    if (!M || M.responses !== 2 || M.searches !== 0) f.push(`memory ${JSON.stringify(M)}`);
    verdict(f.length === 0, `(c2) whistle, 70 s, whistle: two looks, no search (the window is ${WHISTLE.twiceWindow} s)`,
      `first: ${s1} "${said1}" · after 70 s: ${sMid} · second: ${gd.state} "${said2}" · memory responses ${M?.responses} searches ${M?.searches}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  return allPass;
}

// ================================================================ (d) + (f) the player's side: cooldown, the meter, the voice, down = nothing, invisible = unheard
export async function whistleKeys(): Promise<boolean> {
  console.log('\n=== whistle-keys: V twice inside a second is one whistle; the meter ticks to the level; nothing while down; the tour\'s unseen Sam is unheard ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const W = await floor(740, [14, 0, 11.1]); const { game, audioCounts, input } = W;
  parkFrom(game, 0);   // nobody about: these are the player's own numbers
  for (let i = 0; i < 3; i++) W.step(DT);
  // (d) cooldown + (f) meter + the voice
  {
    const b0 = WHISTLE_STATS.blown, a0 = audioCounts.get('whistle') ?? 0; const events: number[] = [];
    const countEv = () => game.events.filter((e: any) => e.kind === 'whistle' && e.time === game.time).length;
    input.pressed.add('KeyV'); W.step(DT); events.push(countEv()); const noise1 = game.player.noise; const ready1 = whistleReadyIn(game);
    const ev = game.events.find((e: any) => e.kind === 'whistle');
    for (let i = 0; i < 29; i++) W.step(DT);
    input.pressed.add('KeyV'); W.step(DT); events.push(countEv());   // 0.5 s later: inside the cooldown
    for (let i = 0; i < Math.ceil((WHISTLE.cooldown - 0.5) / DT) + 2; i++) W.step(DT);
    input.pressed.add('KeyV'); W.step(DT); events.push(countEv());   // just past it
    const blown = WHISTLE_STATS.blown - b0, voiced = (audioCounts.get('whistle') ?? 0) - a0;
    const f: string[] = [];
    if (blown !== 2 || voiced !== 2) f.push(`blown ${blown}, voiced ${voiced} (want 2 / 2: the press inside the cooldown does nothing)`);
    if (events.join() !== '1,0,1') f.push(`events on the three presses: ${events.join(',')} (want 1,0,1)`);
    if (Math.abs(noise1 - WHISTLE.level) > 1e-6) f.push(`the meter read ${noise1.toFixed(3)} on the frame of the whistle (want ${WHISTLE.level})`);
    if (!(ready1 > WHISTLE.cooldown - 2 * DT)) f.push(`ready-in read ${f2(ready1)} right after (want ~${WHISTLE.cooldown})`);
    if (!ev || ev.who !== PLAYER_ID || ev.level !== WHISTLE.level || ev.loud !== false || Math.abs(ev.pos[1]) > 1e-6) f.push(`the event: ${JSON.stringify(ev)} (want who ${PLAYER_ID}, level ${WHISTLE.level}, quiet, at his feet)`);
    verdict(f.length === 0, '(d)+(f) V, V at +0.5 s, V past the cooldown = two whistles; the SOUND meter reads the level on the frame; the event is Sam\'s, quiet, at his feet',
      `blown ${blown} · voiced ${voiced} · events per press ${events.join(',')} · meter ${noise1.toFixed(3)} · ready again in ${f2(ready1)} s${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // down: nothing
  {
    for (let i = 0; i < Math.ceil(WHISTLE.cooldown / DT) + 2; i++) W.step(DT);
    game.godMode = false; game.player.down = true; game.player.hitsLeft = 0;
    const b0 = WHISTLE_STATS.blown; input.pressed.add('KeyV'); W.step(DT); const direct = tryWhistle(game);
    const f: string[] = []; if (WHISTLE_STATS.blown !== b0 || direct) f.push(`blown ${WHISTLE_STATS.blown - b0}, tryWhistle ${direct}`);
    verdict(f.length === 0, '(d2) down: V and tryWhistle do nothing', `blown ${WHISTLE_STATS.blown - b0}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // invisible (the tour): the whistle goes out, nobody hears it — a fresh floor, one calm man 6 m off who WOULD answer it
  {
    const W2 = await floor(741, [14, 0, 11.1]); const game2 = W2.game;
    parkFrom(game2, 1); const gd = game2.guards[0]; placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], true);
    for (let i = 0; i < 3; i++) W2.step(DT);
    game2.playerInvisible = true; const r0 = WHISTLE_STATS.resolved;
    const went = pressV(W2); W2.step(DT); game2.playerInvisible = false;
    const f: string[] = [];
    if (!went) f.push('nothing went out');
    if (WHISTLE_STATS.resolved !== r0) f.push('it was resolved against the guards (want: dropped before that, as his steps are)');
    if (gd.state !== 'patrol' || gd.awareness > 0.01 || whistleMem(gd)?.responses) f.push(`the man 6 m off: ${gd.state} aw ${f2(gd.awareness)} mem ${JSON.stringify(whistleMem(gd))}`);
    verdict(f.length === 0, '(h) playerInvisible (the tour): V still sounds, no guard is even asked', `went ${went} · resolved ${WHISTLE_STATS.resolved - r0} · guard ${gd.state} aw ${f2(gd.awareness)}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  return allPass;
}

// ================================================================ (e) an alert man: a cue toward the spot, no 'hello?', still alert
export async function whistleAlert(): Promise<boolean> {
  console.log('\n=== whistle-alert: a man already hunting takes it as a fix on you — nothing said, nothing lowered; a searching man\'s plan moves onto it ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  // ---- alert, pinned on his spot, working from a stale fix up the corridor
  {
    const W = await floor(750, [14, 0, 11.1]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], false);
    gd.state = 'alert'; gd.awareness = 1; gd.lastKnown = [30, 0, 11.1]; gd.lastSeenT = -100; gd.reactT = 0; resetChase(gd); gd.pinned = true; gd.witness.alertT = game.time;
    for (let i = 0; i < 5; i++) W.step(DT);
    const bub0 = gd.bubble?.t ?? -1;
    const went = pressV(W); W.step(DT);
    const M = whistleMem(gd); const said = gd.bubble && gd.bubble.t !== bub0 && game.time - gd.bubble.t < 0.1 ? gd.bubble.text : null;
    const f: string[] = [];
    if (!went) f.push('nothing went out');
    if (gd.state !== 'alert') f.push(`state ${gd.state} (want alert still)`);
    if (!gd.lastKnown || v3.distXZ(gd.lastKnown, game.player.char.pos) > 0.3) f.push(`fix ${gd.lastKnown ? `(${f2(gd.lastKnown[0])}, ${f2(gd.lastKnown[2])})` : 'none'} did not move onto Sam's spot`);
    if (said && (LOOK.has(said) || TWICE.has(said))) f.push(`he said "${said}"`);
    if (!M || M.cues !== 1 || M.responses !== 0) f.push(`memory ${JSON.stringify(M)} (want 1 cue, no answer)`);
    if (handCarry(gd) !== 'weapon') f.push('the gun is not out');
    verdict(f.length === 0, '(e1) alert (no eyes on Sam for a while): the fix jumps to the whistle, state and gun stay, no whistle line',
      `state ${gd.state} · fix ${gd.lastKnown ? `(${f2(gd.lastKnown[0])}, ${f2(gd.lastKnown[2])})` : 'none'} vs Sam (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}) · said ${JSON.stringify(said)} · cues ${M?.cues}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // ---- alert WITH eyes on Sam this second: he trusts his eyes (the fix stays)
  {
    const W = await floor(751, [14, 0, 11.1]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], false);
    gd.state = 'alert'; gd.awareness = 1; gd.lastKnown = [30, 0, 11.1]; gd.reactT = 0; resetChase(gd); gd.pinned = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    gd.lastSeenT = game.time;   // 'saw him' this very frame, over at the stale fix
    pressV(W); W.step(DT);
    const f: string[] = []; if (!gd.lastKnown || v3.distXZ(gd.lastKnown, [30, 0, 11.1]) > 0.3) f.push(`fix moved to (${f2(gd.lastKnown?.[0] ?? NaN)}, ${f2(gd.lastKnown?.[2] ?? NaN)})`);
    if ((whistleMem(gd)?.cues ?? 0) !== 1) f.push(`cues ${whistleMem(gd)?.cues}`);
    verdict(f.length === 0, '(e2) alert with a sighting under a second old: it reaches him (a cue counted) but his own eyes\' fix stands', `fix (${f2(gd.lastKnown?.[0] ?? NaN)}, ${f2(gd.lastKnown?.[2] ?? NaN)})${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  // ---- searching round a spot 6 m up the corridor: the plan is re-dealt round the whistle
  {
    const W = await floor(752, [14, 0, 11.1]); const { game } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    placeGuard(gd, [21, 0, 11.1], [40, 0, 11.1], false);
    gd.state = 'search'; gd.awareness = 0.7; gd.lastKnown = [24, 0, 11.1]; gd.searchT = 0; gd.searchPlan = null; resetChase(gd);
    for (let i = 0; i < 30; i++) W.step(DT);
    const fix0 = gd.searchPlan ? v3.copy(gd.searchPlan.fix) : null;
    game.teleportPlayer([15, 0, 11.1]); game.player.visibility = 0; for (let i = 0; i < 2; i++) W.step(DT);
    const went = pressV(W); for (let i = 0; i < 3; i++) W.step(DT);
    const fix1 = gd.searchPlan ? v3.copy(gd.searchPlan.fix) : null; const M = whistleMem(gd);
    const f: string[] = [];
    if (!went) f.push('nothing went out'); if (!fix0) f.push('no plan before');
    if (gd.state !== 'search') f.push(`state ${gd.state}`);
    if (!fix1 || v3.distXZ(fix1, game.player.char.pos) > 1.0) f.push(`the plan's fix is (${f2(fix1?.[0] ?? NaN)}, ${f2(fix1?.[2] ?? NaN)}), not the whistle's spot`);
    if ((M?.cues ?? 0) !== 1) f.push(`cues ${M?.cues}`);
    verdict(f.length === 0, '(e3) searching: the whistle moves his fix and the plan of hiding places is dealt again round it',
      `plan fix (${f2(fix0?.[0] ?? NaN)}, ${f2(fix0?.[2] ?? NaN)}) → (${f2(fix1?.[0] ?? NaN)}, ${f2(fix1?.[2] ?? NaN)}) · Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}) · state ${gd.state}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  }
  return allPass;
}

// ================================================================ (g) the torch stays until something more than a whistle reaches him
export async function whistleTorch(): Promise<boolean> {
  console.log('\n=== whistle-torch: answering a whistle he keeps the torch; a footfall on top of it and the pistol comes out; calm again, the torch is back ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const W = await floor(760, [14, 0, 11.1]); const { game } = W;
  parkFrom(game, 1); const gd = game.guards[0];
  placeGuard(gd, [20, 0, 11.1], [40, 0, 11.1], true);
  for (let i = 0; i < 3; i++) W.step(DT);
  pressV(W); W.step(DT);
  const h0 = handCarry(gd), up0 = gd.char.anim.upper, lightAtLens0 = gd.flashlight.enabled;
  for (let i = 0; i < 60; i++) W.step(DT);
  const h1 = handCarry(gd), up1 = gd.char.anim.upper;
  game.events.push({ kind: 'step', pos: [17.5, 0, 11.1], time: game.time, loud: false, level: 0.8 });   // a running footfall 2.5 m off him (Sam's: no who)
  W.step(DT); W.step(DT);
  const h2 = handCarry(gd), aw2 = gd.awareness, st2 = gd.state, up2 = gd.char.anim.upper;
  // and calm again → patrol → torch as ever; then a whistle → torch; then CONTACT by hand → weapon; back to suspicious after → weapon still (alerted since)
  gd.awareness = 0.05; for (let i = 0; i < 5; i++) W.step(DT); const st3 = gd.state, h3 = handCarry(gd);
  for (let i = 0; i < Math.ceil(WHISTLE.cooldown / DT); i++) W.step(DT);
  const tw0 = WHISTLE.twiceWindow; WHISTLE.twiceWindow = 1;   // (a FRESH whistle to him: outside the twice window — shrunk for the two frames rather than seventy seconds stepped)
  pressV(W); W.step(DT); WHISTLE.twiceWindow = tw0; const h4 = handCarry(gd), st4 = gd.state;
  gd.awareness = 1; W.step(DT); const st5 = gd.state; gd.awareness = 0.4; gd.state = 'suspicious'; W.step(DT); const h6 = handCarry(gd);
  const f: string[] = [];
  if (h0 !== 'torch' || h1 !== 'torch') f.push(`answering: carries ${h0} then ${h1} (want torch, torch)`);
  if (up1 !== Wh.WHISTLE_SOFT_UPPER && up1 !== 'none') f.push(`upper body '${up1}' on the way over (want '${Wh.WHISTLE_SOFT_UPPER}')`);
  if (st2 !== 'suspicious' || h2 !== 'weapon' || !(aw2 > WHISTLE.awareness + 0.02)) f.push(`after the footfall: ${st2} aw ${f2(aw2)} carrying ${h2} upper '${up2}' (want suspicious, > ${WHISTLE.awareness + 0.02}, weapon)`);
  if (st3 !== 'patrol' || h3 !== 'torch') f.push(`calm again: ${st3} carrying ${h3}`);
  if (st4 !== 'suspicious' || h4 !== 'torch') f.push(`whistled again once calm: ${st4} carrying ${h4} (want the torch again)`);
  if (st5 !== 'alert' || h6 !== 'weapon') f.push(`after CONTACT and back to suspicious: ${st5} then carrying ${h6} (want weapon: he has been alert since the whistle)`);
  verdict(f.length === 0, '(g) torch while it is only a whistle; pistol the moment a footfall lands on top of it; torch again on a fresh whistle once calm; never the torch after contact',
    `answer: ${h0}/${up0} (lens lit ${lightAtLens0}) · +1 s: ${h1}/${up1} · footfall: ${st2} aw ${f2(aw2)} → ${h2}/${up2} · calm: ${st3} ${h3} · fresh whistle: ${st4} ${h4} · contact→suspicious: ${h6}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
  return allPass;
}

/** the whole family */
export async function whistleFamily(): Promise<boolean> { let ok = true; for (const f of [whistleReach, whistleDoor, whistleNearest, whistleTwice, whistleKeys, whistleAlert, whistleTorch]) ok = (await f()) && ok; return ok; }
