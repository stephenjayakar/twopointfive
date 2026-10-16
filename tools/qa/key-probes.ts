// The 'guard-key' probe (run through probes.ts: `bun run tools/qa/probes.ts guard-key` — also in the 'grab' family and 'all'): the man who gives the keyed door up
// under questioning ('…we all carry one, mine's on my belt' — dialogue.ts intel kind 'door') gives his KEY up with it — game.ts interrogate → player.ts takeKey:
// Player.keys gains what Guard.keys held (the floor key every man on nights carries), the clack of it at his hip, one for the debrief, Sam's word on it over Sam
// as the man's line ends (a 'key' remark: nobody answers, no stage moves, and like every line of his it is never cut) — and from then on the keyed doors treat
// Sam as they treat the staff: on the corridor face a tap of Space turns the key and pushes it open (a small clack + the creak, nothing loud, no pick, no kick),
// a hold eases key and leaf round in silence, walking into it pushes it, and the closer springs the bolt again behind him (where doors stay where they are left — DOORSTAY, the page — his own hand pulling it to does). The control cases: the same door
// without the key still demands the pick / the kick / walls him off; a second man 'giving' a key Sam already has changes nothing; the cubicle man (no keyed
// door on his beat) never offers one, nor does a man whose belt is already empty; a restart empties Sam's pocket and refills theirs; the sandbox's bare
// exchange (no hold) takes the key too, wordlessly. Staged and driven like grab-probes / dialogue-probes: the full game headless, the real inputs.
import { standUp, ROOT } from './headless.ts';
import { tapVerb, endFor } from './verbs.ts';
import type { AudioCall } from './headless.ts';
const IK = 'Space';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const playerMod = await import(`${ROOT}/src/game/player.ts`);
const { startGrab, heldTalk, buildInteractables, samBeat } = playerMod;
const { rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
const { Doors, FLOOR_KEY } = await import(`${ROOT}/src/game/doors.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held (the scripted flag), facing east, deaf */
function park(gd: any, i: number) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
const f2 = (x: number) => x.toFixed(2);
const posS = (p: Vec3) => `(${f2(p[0])}, ${f2(p[2])})`;

/** The exchange staging (dialogue-probes' own): the level up with the pistol holstered (the ARM hold), Sam dark and immortal, `who` (0 = Kowalski, the corridor
 *  man — his beat passes the keyed server-room door; 2 = Reyes, lobby + break room, whose loop walks the corridor past three; 1 = Novak, the cubicles, none)
 *  planted mid-corridor facing east, the others parked deaf on the lot, no radio check due (a live one outranks the door in the generator's order), Sam crouched
 *  0.8 m behind him and the grab made by the call, stepped until the hold proper is on. Everything said, logged and played is tapped. */
async function stageHold(seed: number, who = 0, W0?: any) {
  if (!W0) Math.random = seeded(seed);
  const W = W0 ?? await standUp(); const { game } = W;
  game.player.visibility = 0.02; game.godMode = true; game.player.slot = 'pistol'; game.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const A = game.guards[who]; game.guards.forEach((o: any, i: number) => { if (o !== A) park(o, i); });
  A.hold = false; place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; A.heardUpTo = game.eventSeq;
  rollcallState(game).nextAt = game.time + 300;
  game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); game.player.visibility = 0.02;
  const msgs: { t: number; text: string }[] = W.__msgs ?? []; if (!W.__msgs) { W.__msgs = msgs; const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); }; }
  const log: AudioCall[] = W.audioLog ?? []; W.audioLog = log;
  startGrab(game, A);
  for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT);
  game.player.fHeld = false; W.step(DT);
  return { W, game, A, msgs, log };
}
/** tap Space on his row and step until the man has ANSWERED it (talk.stage went up), then on until the row would take the next without cutting anything and no
 *  remark of Sam's waits or hangs (heldTalk.settled && !H.after) plus `slack` s; returns the frame times { tap, answered } (answered −1 if it never came in 4 s) */
function exchange(S: any, slack = 0.4): { tap: number; answered: number } {
  const { W, game, A } = S; const st0 = A.talk.stage; const tap = game.time;
  W.input.pressed.add(IK); W.step(DT);
  let answered = -1; for (let i = 0; i < 240 && answered < 0; i++) { W.step(DT); if (A.talk.stage > st0) answered = game.time; }
  for (let i = 0; i < 60 * 14; i++) { const H = game.player.holding; if (H && !H.after && heldTalk(game, H).settled) break; W.step(DT); }
  for (let i = 0; i < Math.round(slack / DT); i++) W.step(DT);
  return { tap, answered };
}
/** every door event as the game hears it (game.ts onDoorEvent → a GameEvent of kind 'door' / 'kick' with its level and loudness), recorded off a wrap of that
 *  handler — the events queue itself forgets after half a second and is rebuilt every frame */
function doorTap(game: any) { const ev: any[] = []; const orig = game.onDoorEvent.bind(game); game.onDoorEvent = (e: any) => { orig(e); const g = game.events[game.events.length - 1]; if (g && (g.kind === 'door' || g.kind === 'kick') && g.time === game.time) ev.push({ ...g, sound: e.sound }); }; return ev; }

export async function guardKey() {
  console.log('\n=== guard-key: question the man with the key until he gives the keyed door up and Sam pockets his key — then the keyed doors open to Sam as to the staff (unlock: a clack and it swings · ease: silent · walk into it), and without it they still want the pick or the boot ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };

  // ================================================================ (a) the exchange to the key: three taps on Kowalski (steady: the useful thing at the third — the server-room door on his beat).
  //      The frame that answer lands: Player.keys has the floor key, his belt is empty, the clack played at his hip, the log line, one for the debrief. Sam's word
  //      on it goes up the frame the man's line ends — a 'key' remark, his beat long, never over the answer — and a tap while it hangs does nothing (he is never
  //      cut); the next tap after it is the ordinary fourth exchange (his 'nothing left'), and no second key ever comes of this man.
  let carry: any = null;   // (a)'s world, Sam keyed and Kowalski still in his arm, handed on to (c)
  {
    const S = await stageHold(541); const { W, game, A, msgs, log } = S; const fails: string[] = [];
    if (game.player.holding?.phase !== 'held' || game.player.holding.variant !== 'arm') fails.push(`staging: hold ${game.player.holding?.phase}/${game.player.holding?.variant}`);
    if (!A.keys?.has(FLOOR_KEY) || game.player.keys.size) fails.push(`staging: his belt [${[...(A.keys ?? [])].join(',')}], Sam's pocket [${[...game.player.keys].join(',')}] (want floor / empty)`);
    if (D.keyedDoorOnRoute(game, A) !== 'the server room door') fails.push(`staging: keyed door on his beat = ${D.keyedDoorOnRoute(game, A)}`);
    const t0 = game.time;
    exchange(S); exchange(S);
    if (game.player.keys.size) fails.push(`a key changed hands before the door was given (after two exchanges: [${[...game.player.keys].join(',')}])`);
    // the third, frame by frame: the answer lands → key; its bubble ends → the remark
    const st0 = A.talk.stage; W.input.pressed.add(IK); W.step(DT);
    let landT = -1, keyT = -1, remarkT = -1, remark: any = null, ansEnd = -1, overlap = 0, tapDuringRemark = false, remarkCut = false; let ansBubble: any = null;
    for (let i = 0; i < 60 * 12; i++) {
      W.step(DT);
      if (landT < 0 && A.talk.stage > st0) { landT = game.time; ansBubble = A.bubble ? { ...A.bubble } : null; ansEnd = ansBubble ? ansBubble.t + ansBubble.dur : -1; }
      if (keyT < 0 && game.player.keys.has(FLOOR_KEY)) keyT = game.time;
      const sb = game.player.bubble; const H = game.player.holding;
      if (remarkT < 0 && sb && landT >= 0 && sb.t > landT + 1e-6 && Math.abs(sb.t - game.time) < 1e-9) { remarkT = sb.t; remark = { ...sb, id: D.samMemoryOf(game).last }; }
      if (remarkT >= 0 && !tapDuringRemark && game.time > remarkT + 0.4) { tapDuringRemark = true; const askedBefore = !!H?.ask, stBefore = A.talk.stage; W.input.pressed.add(IK); W.step(DT); if (game.player.holding?.ask || A.talk.stage !== stBefore || game.player.bubble?.t !== remarkT || askedBefore) remarkCut = true; }
      const ab = A.bubble && A.talk.lastT >= 0 && Math.abs(A.bubble.t - A.talk.lastT) < 1e-6 && game.time - A.bubble.t < A.bubble.dur - 1e-9;
      if (sb && game.time - sb.t < sb.dur - 1e-9 && ab) overlap++;
      if (remarkT >= 0 && game.time > remarkT + 2.0) break;
    }
    const pick = A.talk.last;
    if (landT < 0) fails.push('the third answer never came');
    if (pick?.kind !== 'door') fails.push(`the third answer was ${pick?.kind ?? pick?.id} (want the door — the key rides on it)`);
    if (keyT < 0) fails.push('Sam never got the key'); else if (Math.abs(keyT - landT) > 1e-9) fails.push(`the key changed hands ${(keyT - landT).toFixed(3)} s after the answer landed (want that frame)`);
    if (A.keys.size) fails.push(`his belt still holds [${[...A.keys].join(',')}]`);
    const clack = log.filter(c => c.name === 'lockPick' && Math.abs(c.t - landT) < DT + 1e-6);
    if (clack.length !== 1) fails.push(`lockPick ×${clack.length} on the frame the key was taken (want 1 — the clip off his belt)`);
    else { const c = clack[0]; const d = c.pos ? Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]) : 99; if (d > 0.5 || !c.pos || c.pos[1] < 0.8 || c.pos[1] > 1.2 || !((c.opts?.rate as number) > 1.3)) fails.push(`the clack at ${c.pos ? posS(c.pos as Vec3) + ' y ' + f2(c.pos[1]) : 'nowhere'} rate ${c.opts?.rate} (want on him at hip height, pitched up)`); }
    if (!msgs.some(m => m.t === landT && /^took Kowalski's key/.test(m.text))) fails.push(`no 'took Kowalski's key…' log line that frame (log: ${msgs.slice(-4).map(m => m.text).join(' | ')})`);
    if (game.mission.stats.keys !== 1) fails.push(`stats.keys ${game.mission.stats.keys} (want 1)`);
    const line = remark ? D.SAM_LINES.find((l: any) => l.id === remark.id) : null;
    if (remarkT < 0) fails.push("Sam's word on the key never went up");
    else {
      if (ansEnd > 0 && (remarkT < ansEnd - 1e-6 || remarkT > ansEnd + DT + 1e-6)) fails.push(`the remark went up ${(remarkT - ansEnd).toFixed(3)} s off the end of the man's line (want the frame it ended)`);
      if (line?.s !== 'key') fails.push(`the remark [${remark.id}] "${remark.text}" is not a 'key' line`);
      if (Math.abs(remark.dur - samBeat(remark.text.length)) > 1e-6 || remark.text.length > D.SAM_MAX_CHARS || /[{}]/.test(remark.text)) fails.push(`remark "${remark.text}" dur ${f2(remark.dur)} (${remark.text.length} chars)`);
      if (!msgs.some(m => m.text === `you ▸ ${remark.text}`)) fails.push("the remark did not reach the log as 'you ▸ …'");
      if (!tapDuringRemark) fails.push('staging: never tapped during the remark'); else if (remarkCut) fails.push('a tap while Sam had his say cut it / opened an exchange (he is never cut)');
    }
    if (overlap) fails.push(`Sam's bubble and the man's answer both live on ${overlap} frame(s)`);
    // then the ordinary fourth exchange, and no second key from him however long you lean
    const keysBefore = game.player.keys.size, clacksBefore = log.filter(c => c.name === 'lockPick').length;
    const e4 = exchange(S); const p4 = A.talk.last; exchange(S); exchange(S);
    if (e4.answered < 0 || A.talk.stage < 4 || p4?.kind) fails.push(`the fourth exchange: answered ${e4.answered >= 0}, stage ${A.talk.stage}, gave ${p4?.kind ?? 'nothing'} (want his nothing-left, no intel)`);
    if (game.player.keys.size !== keysBefore || log.filter(c => c.name === 'lockPick').length !== clacksBefore || game.mission.stats.keys !== 1) fails.push('a second key / clack / tally came of the same man');
    if (!game.player.holding || A.state === 'dead') fails.push('the hold ended under questioning');
    verdict(fails.length === 0, '(a) three taps on the corridor man: the door comes third and his key with it — that frame Sam has it, the belt is empty, the clack at his hip, the log, the tally; Sam\'s word on it as the line ends, uncuttable; then questions as ever and never a second key',
      `${A.callsign} (${D.temperamentOf(A)}) · answer 3 at ${landT >= 0 ? f2(landT - t0) : '—'} s: ${pick?.kind ? 'INTEL ' + pick.kind : pick?.id} "${ansBubble?.text ?? '—'}" (${ansBubble ? f2(ansBubble.dur) : '—'} s) → keys [${[...game.player.keys].join(',')}] at +${keyT >= 0 ? f2(keyT - t0) : '—'} s · remark [${remark?.id ?? '—'} ${line?.s ?? ''}] "${remark?.text ?? '—'}" at +${remarkT >= 0 ? f2(remarkT - t0) : '—'} s (line ended +${ansEnd > 0 ? f2(ansEnd - t0) : '—'} s) · stage now ${A.talk.stage} · card keys ${game.mission.stats.keys}\n    log: ${msgs.filter(m => /key|you ▸/.test(m.text)).map(m => `${f2(m.t - t0)}s ${m.text}`).join(' | ')}`, fails);
    carry = S;
  }

  // ================================================================ (b) with the key, the doors. Kowalski choked out first (the hold ends the only way it can), then Sam alone at each keyed door's corridor face:
  //      the row reads 'locked — you have the key' / 'Space  unlock — his key'; a TAP: the key's clack (a 'door' event at KEY_LEVEL) and the creak, the leaf swings,
  //      d.locked stays thrown, nothing loud, no pick, no kick, and he walks through; the closer latches it locked behind him (DOORSTAY on: it stands open, bolt thrown, until he pulls it to — then it is locked again). A HOLD on the storage door: it eases
  //      open with no door event at all. WALKING into the (re-latched) server door with no key pressed: it pushes open ahead of him like any shut door.
  {
    const S = carry; const { W, game, A, msgs, log } = S; const fails: string[] = []; const notes: string[] = [];
    const dev = doorTap(game);
    // end the hold: the choke's row, tapped, run through
    endFor(W, HOLD.secs.chokeHold + HOLD.secs.choke + 0.3); for (let i = 0; i < 30; i++) W.step(DT);
    if (game.player.holding || A.state !== 'dead') fails.push(`staging: the choke did not end the hold (${game.player.holding?.phase}, A ${A.state})`);
    if (!game.player.keys.has(FLOOR_KEY)) fails.push('the key did not survive the end of the hold');
    const server = game.doors.byName('server'), storage = game.doors.byName('storage');
    for (const d of [server, storage]) { d.reset(); }   // latched, locked, as authored
    // ---- the tap, at the server door
    game.teleportPlayer([17.6, 0, 10.75]); game.player.crouch = false; game.player.char.bodyYaw = Math.PI; W.step(DT);   // corridor face (the key side), square to the leaf, standing
    const p = game.player.char.pos;
    if (game.doors.side(server, p) !== server.keySide || !server.latched || !server.locked) fails.push(`staging: Sam on side ${game.doors.side(server, p)} of a leaf latched ${server.latched} locked ${server.locked}`);
    if (game.doors.lockedOut(server, p, game.player.keys)) fails.push('lockedOut(…, his keys) is still true with the key in his pocket');
    if (!game.doors.lockedOut(server, p)) fails.push('lockedOut(…) without keys went false — the lock itself moved');
    W.cursorAt(server.pos); W.step(DT);
    buildInteractables(game, W.cam, W.input.mouseX, W.input.mouseY, W.canvas.clientWidth, W.canvas.clientHeight);
    const row = game.interactables.find((it: any) => it.door === server);
    if (!row || !/you have the key/.test(row.line1) || !/^Space {2}unlock — his key {2}· {2}Space {2}ease it open — silent$/.test(row.line2) || /pick|kick/i.test(row.line2) || !row.inReach) fails.push(`the marker: "${row?.line1}" / "${row?.line2}" inReach ${row?.inReach} (want 'locked — you have the key' / the unlock and ease rows, no pick / kick)`);
    if (game.hover?.door !== server || game.hover?.verb !== 'unlock') fails.push(`staging: the highlighted row is ${game.hover?.kind}/${game.hover?.door?.def?.name}/${game.hover?.verb} (want the server door's unlock)`);
    notes.push(`row: "${row?.line1}" / "${row?.line2}"`);
    const tTap = game.time; const ev0 = dev.length; const lockOpen0 = log.filter((c: any) => c.name === 'lockOpen').length;
    W.input.pressed.add(IK); W.step(DT);   // a one-frame tap
    let openAt = -1; for (let i = 0; i < 90; i++) { W.step(DT); if (openAt < 0 && !server.latched && Math.abs(server.angle) > 0.3) openAt = game.time - tTap; }
    const evTap = dev.slice(ev0);
    if (openAt < 0) fails.push(`the tap did not open it (angle ${f2(server.angle)}, latched ${server.latched})`);
    if (game.player.picking || game.player.kick || game.player.char.anim.kicking) fails.push(`the tap started a ${game.player.picking ? 'pick' : 'kick'}`);
    if (!server.locked || server.lockBroken || server.pick > 0) fails.push(`the lock itself changed: locked ${server.locked} broken ${server.lockBroken} pick ${server.pick} (want it merely turned: still a thrown lock to anyone keyless)`);
    if (evTap.some(e => e.kind === 'kick' || e.loud)) fails.push(`loud / kick events on the tap: ${evTap.map(e => `${e.kind}${e.loud ? '!' : ''} ${e.level}`).join(', ')}`);
    const unlockEv = evTap.filter(e => e.kind === 'door' && Math.abs(e.level - Doors.KEY_LEVEL) < 1e-9), creakEv = evTap.filter(e => e.kind === 'door' && Math.abs(e.level - 0.2) < 1e-9);
    if (unlockEv.length !== 1 || creakEv.length !== 1 || evTap.length !== 2) fails.push(`door events on the tap: ${evTap.map(e => `${e.kind} ${e.level}`).join(', ') || 'none'} (want the key's clack at ${Doors.KEY_LEVEL} + the creak at 0.2, nothing else)`);
    if (unlockEv[0] && unlockEv[0].who !== PLAYER_ID) fails.push(`the clack blamed on ${unlockEv[0].who}`);
    if (log.filter((c: any) => c.name === 'lockOpen').length !== lockOpen0 + 1) fails.push(`lockOpen ×${log.filter((c: any) => c.name === 'lockOpen').length - lockOpen0} (want 1: the key turning)`);
    notes.push(`tap → open in ${openAt >= 0 ? f2(openAt) : '—'} s, events [${evTap.map(e => `${e.kind} ${e.level}`).join(', ')}]`);
    // walk through into the server room, then let the closer take it: latched AND still locked behind him
    game.puppet = { goal: [17.6, 0, 7.8], aim: [17.6, 1.0, 5.0] };   // well clear of the leaf's swing on the far side, so the closer has nothing resting on it
    let inAt = -1; for (let i = 0; i < 60 * 5; i++) { W.step(DT); if (inAt < 0 && game.player.char.pos[2] < 9.5) inAt = game.time - tTap; }
    game.puppet = null;
    if (inAt < 0) fails.push(`Sam never got through the doorway (at ${posS(game.player.char.pos)}, leaf ${f2(server.angle)})`);
    let relatchAt = -1; for (let i = 0; i < 60 * 8; i++) { W.step(DT); if (relatchAt < 0 && server.latched) relatchAt = game.time - tTap; }
    // (doors.ts DOORSTAY — doors stay where they are left, the page's rule: there is no closer. The leaf stands open behind him, its bolt still thrown, and it is
    //  his own hand that pulls it to; then the lock bites again. With the rule off — the frozen stand — the closer does it, as this check was written)
    const stay = !!game.doors.stay; let pulledAt = -1;
    if (!stay) { if (relatchAt < 0) fails.push('the closer never latched it again behind him'); }
    else {
      if (relatchAt >= 0) fails.push(`doors stay where they are left, and this one latched by itself at +${f2(relatchAt)} s`);
      if (!server.locked || server.lockBroken) fails.push(`standing open, its lock changed: locked ${server.locked} broken ${server.lockBroken} (want the bolt still thrown)`);
      const tPull = game.time; game.doors.use(server, [17.6, 0, 9.6], PLAYER_ID);
      for (let i = 0; i < 60 * 8; i++) { W.step(DT); if (pulledAt < 0 && server.latched) pulledAt = game.time - tPull; }
      if (pulledAt < 0) fails.push('pulled to by his own hand from inside, it never latched');
    }
    if (!server.locked || !game.doors.lockedOut(server, [17.6, 0, 10.75])) fails.push(`behind him the corridor face is ${server.locked ? '' : 'UN'}locked / lockedOut(keyless)=${game.doors.lockedOut(server, [17.6, 0, 10.75])} (want it sprung locked again to anyone without a key)`);
    notes.push(`through at +${inAt >= 0 ? f2(inAt) : '—'} s, ${stay ? `stood open 8 s (doors stay where left), pulled to by hand → latched +${pulledAt >= 0 ? f2(pulledAt) : '—'} s` : `latched again +${relatchAt >= 0 ? f2(relatchAt) : '—'} s`} (locked ${server.locked})`);
    // ---- the 'ease it open' row, at the storage door: silent, and it goes on round by itself
    game.teleportPlayer([32.6, 0, 10.75]); game.player.crouch = true; game.player.char.bodyYaw = Math.PI; W.step(DT);
    W.cursorAt(storage.pos); W.step(DT);
    if (game.hover?.door !== storage || !game.hover?.inReach) fails.push(`staging: at the storage door the highlighted row is ${game.hover?.kind}/${game.hover?.door?.def?.name} inReach ${game.hover?.inReach}`);
    const ev1 = dev.length; const audio1 = log.length;
    const eased = tapVerb(W, 'door', 'ease'); for (let i = 0; i < Math.round(1.6 / DT); i++) W.step(DT);
    const evHold = dev.slice(ev1); const doorAudio = log.slice(audio1).filter((c: any) => /^door|^lock/.test(c.name));
    if (!eased) fails.push('no ease row on the keyed storage door');
    if (Math.abs(storage.angle) < 0.3) fails.push(`the ease row took it only to ${f2(storage.angle)} rad in 1.6 s (want it cracked open, ≥ 0.3)`);
    if (game.player.picking || storage.pick > 0) fails.push(`the ease row started a pick (picking ${!!game.player.picking}, pick ${f2(storage.pick)})`);
    if (evHold.length) fails.push(`door events while easing it: ${evHold.map(e => `${e.kind} ${e.level}`).join(', ')} (want none — the key goes round with the handle)`);
    if (doorAudio.length) fails.push(`door / lock audio while easing it: ${doorAudio.map((c: any) => c.name).join(', ')}`);
    if (!storage.locked) fails.push('easing it unlocked the lock itself');
    notes.push(`ease on storage → ${f2(storage.angle)} rad, events [${evHold.map(e => e.kind).join(',') || 'none'}], picking ${!!game.player.picking}`);
    // ---- walking into the server door again (latched, locked) with nothing pressed: it pushes open ahead of him
    server.reset(); game.teleportPlayer([17.6, 0, 11.4]); game.player.crouch = true; W.step(DT);
    game.puppet = { goal: [17.6, 0, 8.4], aim: [17.6, 1.0, 5.0] };
    let pushedAt = -1, throughAt = -1, blocked = 0; const tW = game.time;
    for (let i = 0; i < 60 * 6; i++) { W.step(DT); if (pushedAt < 0 && !server.latched) pushedAt = game.time - tW; if (throughAt < 0 && game.player.char.pos[2] < 9.5) throughAt = game.time - tW; if (game.player.char.pos[2] > 10.3 && game.time - tW > 2) blocked++; }
    game.puppet = null;
    if (pushedAt < 0 || throughAt < 0) fails.push(`walking into it: unlatched at ${pushedAt >= 0 ? f2(pushedAt) : 'never'}, through at ${throughAt >= 0 ? f2(throughAt) : 'never'} (Sam at ${posS(game.player.char.pos)}) — the leaf walled him`);
    if (game.player.kick || game.player.picking) fails.push('walking into it started a kick / pick');
    notes.push(`walk-in → unlatched +${pushedAt >= 0 ? f2(pushedAt) : '—'} s, through +${throughAt >= 0 ? f2(throughAt) : '—'} s`);
    if (msgs.some((m: any) => m.t >= tTap && /kicked it in|picking the lock|locked — pick it/.test(m.text))) fails.push(`a lock line reached the log with the key in his pocket: ${msgs.filter((m: any) => m.t >= tTap).map((m: any) => m.text).join(' | ')}`);
    verdict(fails.length === 0, '(b) keyed: the server door offers unlock + ease; a tap (unlock highlighted) = the key\'s clack + the creak and it swings (lock still thrown, nothing loud, no pick / kick), through, and it latches locked behind him (the closer — or, where doors stay where they are left, his own hand pulling it to); the ease row on the storage door takes it round in silence; walked into, the leaf gives',
      notes.join(' · '), fails);
  }

  // ================================================================ (c) the control: a fresh floor, NO key — the same server door from the same spot walls him and wants the pick or the boot: the rows say so; the kick
  //      row is the boot (loud, the lock broken), the crouched 'try the handle' row only rattles it, the pick row (the highlighted one: a plain tap) plants him picking, and walked into it he stops at the leaf.
  {
    Math.random = seeded(543);
    const W = await standUp(); const { game } = W; const fails: string[] = []; const notes: string[] = [];
    game.player.visibility = 0.02; game.godMode = true; game.player.holstered = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    game.guards.forEach((o: any, i: number) => park(o, i));
    const dev = doorTap(game); const server = game.doors.byName('server');
    const at = (crouch: boolean) => { server.reset(); for (let i = 0; i < 90 && (game.player.kick || game.player.char.anim.kicking); i++) W.step(DT); game.teleportPlayer([17.6, 0, 10.75]); game.player.fHeld = false; game.player.crouch = crouch; game.player.char.bodyYaw = Math.PI; W.step(DT); W.cursorAt(server.pos); W.step(DT); };   // (a kick still coming down is waited out: teleportPlayer cancels the pick / kick records, the leg finishes on its own clock)
    // the row
    at(false);
    buildInteractables(game, W.cam, W.input.mouseX, W.input.mouseY, W.canvas.clientWidth, W.canvas.clientHeight);
    const row = game.interactables.find((it: any) => it.door === server);
    if (!row || !/^door · locked$/.test(row.line1) || !/pick the lock/.test(row.line2) || !/kick it in/.test(row.line2) || /his key|you have the key/.test(row.line1 + row.line2)) fails.push(`keyless row: "${row?.line1}" / "${row?.line2}"`);
    if (!game.doors.lockedOut(server, game.player.char.pos, game.player.keys)) fails.push('lockedOut(…, his empty pocket) is false');
    notes.push(`row: "${row?.line1}" / "${row?.line2}"`);
    const rowsC = game.nearby.map((r: any) => r.verb).join('/'); if (rowsC !== 'pick/kick') fails.push(`keyless rows standing: ${rowsC} (want pick/kick)`);
    // the kick row → kick
    { const e0 = dev.length; const had = tapVerb(W, 'door', 'kick'); let kicked = !!game.player.kick; for (let i = 0; i < 90; i++) { W.step(DT); kicked ||= !!game.player.kick; }
      const ev = dev.slice(e0); if (!had || !kicked || !ev.some(e => e.kind === 'kick' && e.loud) || !server.lockBroken) fails.push(`kick row: offered ${had}, kick ${kicked}, events [${ev.map(e => e.kind + (e.loud ? '!' : '')).join(',')}], lockBroken ${server.lockBroken} (want the boot, loud, the keep torn out)`); notes.push(`kick row → kick ${kicked}, [${ev.map(e => e.kind + (e.loud ? '!' : '')).join(',')}]`);
      for (let i = 0; i < 60; i++) W.step(DT); }
    // crouched, the 'try the handle' row → rattle only
    { at(true); const e0 = dev.length; const had = tapVerb(W, 'door', 'rattle'); for (let i = 0; i < 40; i++) W.step(DT);
      const ev = dev.slice(e0); if (!had || game.player.kick || game.player.picking || !server.latched || !ev.some(e => e.kind === 'door' && Math.abs(e.level - 0.12) < 1e-9) || ev.some(e => e.loud)) fails.push(`rattle row crouched: offered ${had}, kick ${!!game.player.kick} picking ${!!game.player.picking} latched ${server.latched} events [${ev.map(e => `${e.kind} ${e.level}`).join(',')}] (want the rattle alone)`); notes.push(`rattle row → [${ev.map(e => `${e.kind} ${e.level}`).join(',')}]`); }
    // a plain tap with the pick highlighted (back on the top row: the highlight had stayed on the handle it just tried — same door, same rows) → picking, and it goes on by itself
    { at(true); game.selectVerb('door', 'pick'); const hv = game.hover?.verb; W.input.pressed.add(IK); let picking = false; for (let i = 0; i < Math.round(1.2 / DT); i++) { W.step(DT); picking ||= game.player.picking === server; } const stillAt = game.player.picking === server; for (let i = 0; i < 10; i++) W.step(DT);
      if (hv !== 'pick' || !picking || !stillAt || Math.abs(server.angle) > 1e-3) fails.push(`plain tap: highlight ${hv}, picking ${picking} (1.2 s on: ${stillAt}), angle ${f2(server.angle)} (want the pick highlighted, him planted at the cylinder and staying there, the leaf shut)`); notes.push(`tap (${hv}) → picking ${picking}, pick ${f2(server.pick)}`); }
    // walk into it → walled
    { at(true); game.teleportPlayer([17.6, 0, 11.4]); W.step(DT); game.puppet = { goal: [17.6, 0, 8.4], aim: [17.6, 1.0, 5.0] }; let minZ = 99; for (let i = 0; i < 60 * 3; i++) { W.step(DT); minZ = Math.min(minZ, game.player.char.pos[2]); } game.puppet = null;
      if (minZ < 10.25 || !server.latched) fails.push(`walked into it keyless: got to z ${f2(minZ)}, latched ${server.latched} (want stopped at the leaf, ≥ 10.25)`); notes.push(`walk-in keyless → min z ${f2(minZ)}, latched ${server.latched}`); }
    verdict(fails.length === 0, '(c) control, no key: the rows are pick / kick (+ try the handle crouched); the kick row is loud and tears the keep out, the handle only rattles, a plain tap plants him picking on his own clock, and walked into it the leaf is a wall', notes.join(' · '), fails);
  }

  // ================================================================ (d) who yields a key, and only once: the LOBBY man (Reyes, hard — rattled so he gives: floor up) gives the door and Sam, empty-pocketed, takes his key;
  //      a SECOND man giving the door when Sam already has the floor key changes nothing (no clack, no remark, no tally — the belt still empties); the CUBICLE man
  //      never has the door to give (none on his beat); a man whose belt is already empty no longer offers it (the intel is not live for him); and the SANDBOX's
  //      bare exchange (no hold, the panel's button) takes the key too — wordlessly. Then a RESTART: Sam's pocket empty, every belt full again.
  {
    const fails: string[] = []; const notes: string[] = [];
    // Reyes: his loop walks the corridor — a keyed door on it; hard, so he gives only rattled: raise the floor first
    { const S = await stageHold(544, 2); const { game, A, log } = S;
      if (D.temperamentOf(A) !== 'hard' || !D.keyedDoorOnRoute(game, A)) fails.push(`staging: ${A.callsign} ${D.temperamentOf(A)} door ${D.keyedDoorOnRoute(game, A)}`);
      game.escalation = 1; game.escalationT = game.time + 300; A.witness.heard.shots = 1; A.talk.abortT = game.time;   // rattled for good: the floor up (+0.22), gunfire in his ears earlier (+0.15), a choke Sam eased off (+0.20) against his −0.10 — mid band however long the arm settles him (−0.12 at most)
      const band2 = D.bandOf(D.agitationOf(game, A));
      let gave: string | null = null; for (let i = 0; i < 4 && !gave; i++) { exchange(S); gave = A.talk.last?.kind ?? null; }
      const clacks = log.filter(c => c.name === 'lockPick').length;
      if (gave !== 'door') fails.push(`${A.callsign} (band ${band2}) gave ${gave ?? 'nothing'} in four (want the door)`);
      if (!game.player.keys.has(FLOOR_KEY) || A.keys.size || clacks !== 1) fails.push(`after ${A.callsign}'s door: pocket [${[...game.player.keys].join(',')}] belt [${[...A.keys].join(',')}] clacks ${clacks}`);
      notes.push(`${A.callsign} (hard, ${band2}) gave ${gave} → pocket [${[...game.player.keys].join(',')}]`);
      // the door is no longer live for him (belt empty), given or not
      A.talk.given.delete('door'); const live = D.gather(game, A).intel.find((x: any) => x.kind === 'door');
      if (live?.live) fails.push(`with his belt empty the door intel is still live for ${A.callsign}`);
      notes.push(`belt empty → door live ${live?.live}`);
    }
    // a second man's key when Sam already has one: Kowalski after Reyes, same world? Simpler: a fresh hold on Kowalski with the floor key put in Sam's pocket first
    { const S = await stageHold(545, 0); const { game, A, log, msgs } = S;
      game.player.keys.add(FLOOR_KEY); const statsBefore = game.mission.stats.keys;
      let gave: string | null = null; for (let i = 0; i < 4 && !gave; i++) { exchange(S); gave = A.talk.last?.kind ?? null; }
      let remark = false; for (let i = 0; i < 60 * 9; i++) { S.W.step(DT); const sb = game.player.bubble; if (sb && Math.abs(sb.t - game.time) < 1e-9 && D.SAM_LINES.find((l: any) => l.id === D.samMemoryOf(game).last)?.s === 'key') remark = true; }
      const clacks = log.filter(c => c.name === 'lockPick').length;
      if (gave !== 'door') fails.push(`staging: Kowalski gave ${gave}`);
      if (clacks || remark || game.mission.stats.keys !== statsBefore || msgs.some(m => /^took /.test(m.text)) || A.keys.size || game.player.keys.size !== 1) fails.push(`a key Sam already had: clacks ${clacks}, remark ${remark}, tally ${game.mission.stats.keys - statsBefore}, log ${msgs.filter(m => /^took /.test(m.text)).length}, belt [${[...A.keys].join(',')}], pocket [${[...game.player.keys].join(',')}] (want nothing to happen but the belt emptying)`);
      notes.push(`second holder → clacks ${clacks} remark ${remark} belt [${[...A.keys].join(',')}]`);
    }
    // the cubicle man: no keyed door on his beat — six exchanges, never the door, never a key
    { const S = await stageHold(546, 1); const { game, A } = S;
      if (D.keyedDoorOnRoute(game, A)) fails.push(`staging: ${A.callsign} has ${D.keyedDoorOnRoute(game, A)} on his beat`);
      const kinds: string[] = []; for (let i = 0; i < 6; i++) { exchange(S, 0.2); if (A.talk.last?.kind) kinds.push(A.talk.last.kind); }
      if (kinds.includes('door') || game.player.keys.size || !A.keys.has(FLOOR_KEY)) fails.push(`${A.callsign}: gave [${kinds.join(',')}], Sam's pocket [${[...game.player.keys].join(',')}], his belt [${[...A.keys].join(',')}] (want no door, no key taken, belt untouched)`);
      notes.push(`${A.callsign} (cubicles) gave [${kinds.join(',') || 'nothing'}], pocket [${[...game.player.keys].join(',')}]`);
    }
    // the sandbox's bare exchange: no hold — Game.interrogate on a free man in reach; the key comes, no line of Sam's
    { Math.random = seeded(547); const W = await standUp(); const { game } = W;
      game.player.visibility = 0.02; game.godMode = true; for (let i = 0; i < 5; i++) W.step(DT);
      const A = game.guards[0]; game.guards.forEach((o: any, i: number) => { if (o !== A) park(o, i); }); place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true; rollcallState(game).nextAt = game.time + 300;
      game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02;
      const log: AudioCall[] = []; W.audioLog = log;
      let gave: string | null = null; for (let i = 0; i < 4 && gave !== 'door'; i++) { const p = game.interrogate(A, seeded(60 + i)); gave = p?.kind ?? null; for (let f = 0; f < 30; f++) W.step(DT); }
      let samSpoke = false; for (let f = 0; f < 60 * 8; f++) { W.step(DT); if (game.player.bubble && game.time - game.player.bubble.t < 0.02) samSpoke = true; }
      if (gave !== 'door' || !game.player.keys.has(FLOOR_KEY) || A.keys.size || log.filter(c => c.name === 'lockPick').length !== 1) fails.push(`sandbox: gave ${gave}, pocket [${[...game.player.keys].join(',')}], belt [${[...A.keys].join(',')}], clacks ${log.filter(c => c.name === 'lockPick').length}`);
      if (samSpoke || game.player.holding) fails.push('sandbox: a line of Sam\'s went up / a hold appeared (the bare exchange has no Sam side)');
      notes.push(`sandbox → gave ${gave}, pocket [${[...game.player.keys].join(',')}], Sam silent ${!samSpoke}`);
      // restart: pocket empty, belts full, and the doors' locks as authored
      game.restartEncounter(); W.step(DT);
      if (game.player.keys.size || game.guards.some((g2: any) => !g2.keys.has(FLOOR_KEY)) || game.doors.list.some((d: any) => d.locked !== !!d.def.locked)) fails.push(`after restartEncounter: pocket [${[...game.player.keys].join(',')}], belts [${game.guards.map((g2: any) => [...g2.keys].join('+')).join(' ')}]`);
      notes.push(`restart → pocket [${[...game.player.keys].join(',') || 'empty'}], belts [${game.guards.map((g2: any) => [...g2.keys].join('+')).join(' ')}]`);
    }
    verdict(fails.length === 0, '(d) who yields: the rattled lobby man gives his key; a second holder of a key already pocketed changes nothing; the cubicle man never has the door; an emptied belt no longer offers it; the sandbox exchange takes it wordlessly; a restart empties the pocket and refills the belts', notes.join(' · '), fails);
  }
  console.log(`=== guard-key: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
