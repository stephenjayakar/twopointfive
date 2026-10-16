// The 'ko-witness' probe family (run through probes.ts: `bun run tools/qa/probes.ts ko-witness | ko-kinds | ko-rollcall | witness`): the KO-vs-dead side record
// (combat.ts killGuard's how / by → Guard.downKind / downBy, isBreathing, the men's lines over a man out cold, the debrief's knocked-out / killed columns), the
// radio check treating an unconscious man exactly like a corpse, and the per-guard witness record's knowledge gating (game.ts Witness: a man remembers only what
// HE saw or heard — the watcher gets sawAct, the man round the corner gets heard.shots and nothing else, a man out on the lot who perceived nothing stays
// empty; a found body is remembered breathing or not; a stun charge in his open view is counted; nothing at all is written with the AI off). Each stands the
// full game up headless (headless.ts), stages one situation, steps it, prints what happened, PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { startTakedown } = await import(`${ROOT}/src/game/player.ts`);
const { isBreathing, newWitness, missionRating, TEMPERAMENT, CALLSIGNS } = await import(`${ROOT}/src/game/game.ts`);
const { debriefRows } = await import(`${ROOT}/src/game/mission.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { witnessSummary, pointInView } = guardsMod;

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight tests read them; the ragdoll seeds its momentum from the last two bakes). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held, facing east (away from everything) — still hearing (the whole point of the round-the-corner man), unless `deaf` */
function park(gd: any, i: number, deaf = false) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); if (deaf) gd.heardUpTo = 1e12; }
const chest = (gd: any): Vec3 => gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]);
const eyeOf = (gd: any): Vec3 => gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
/** the witness record with nothing in it, for 'stayed empty' comparisons (peakAwareness aside: a man's own patrol jitters it by nothing, but compare it loosely) */
function pristine(w: any): string { const bad: string[] = []; const z = newWitness(); for (const k of Object.keys(z) as string[]) { if (k === 'peakAwareness') { if (w.peakAwareness > 0.02) bad.push(`peakAwareness ${w.peakAwareness.toFixed(2)}`); continue; } if (JSON.stringify(w[k]) !== JSON.stringify((z as any)[k])) bad.push(`${k} ${JSON.stringify(w[k])}`); } return bad.join(', '); }
/** tap game.say / game.msg into arrays (returns them) */
function tap(game: any) {
  const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const msgs: { t: number; text: string }[] = [];
  const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: gd.callsign, text, radio }); return origSay(gd, text, radio); };
  const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
  return { lines, msgs };
}

// ================================================================ (1) KO vs dead: what killGuard's how / by leave behind, what the men say over him, what the card counts
/** (a) the takedown (player.ts startTakedown → killGuard(dir, true)): downKind 'struck', by 'player', breathing; the log line; knockouts 1 · kills 0 on a live mission
 *  and the card's row; still a ghost until somebody finds him — then the finder's call names him out cold, his sawBody says breathing, and it is a panther.
 *  (b) a round from the Five-seveN (fireWeapon → killGuard 'shot' / 'player'): dead, 'man down!', kills 1, sawBody not breathing.
 *  (c) the other call shapes: a colleague's round ('shot' / 'guard') and the world are on nobody's card; 'choked' is a knockout that says so.
 *  (d) the room clear's grim lines over a man out cold inside the room the pair takes: the breathing set. PASS / FAIL each. */
export async function koKinds() {
  console.log('\n=== ko-kinds: struck / choked = out cold and breathing, shot = dead — the record, the lines over him, the debrief columns ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  /** stage: A (the corridor man) planted mid-corridor facing east, Sam crouched behind him in the dark; B and C parked deaf on the lot; live mission (no sandbox flags) */
  const stage = async (seed: number) => {
    Math.random = seeded(seed);
    const W = await standUp(); const { game } = W;
    game.player.visibility = 0.02;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards;
    place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true;
    park(B, 0, true); park(C, 1, true);
    game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.step(DT);
    return { W, game, A, B, C, ...tap(game) };
  };
  /** bring B in to find the body: 5 m east of it on the corridor, facing it, free to act; run until he has called it (or 6 s) plus the aftermath for a while */
  const findWith = (S: any, secs = 30) => {
    const { W, game, A, B } = S; const bp = guardsMod.bodyPos(A);
    game.teleportPlayer([37.5, 0, 26.5]); game.player.crouch = false;   // Sam out of it in the far corner of the lot
    B.hold = false; B.heardUpTo = game.eventSeq; place(B, [bp[0] + 5, 0, 11.2], -Math.PI / 2); B.state = 'patrol'; B.awareness = 0; B.wp = 3;   // (wp 3 of the corridor route lies west of him: he would walk onto the body anyway)
    let foundAt = -1; for (let f = 0; f < 60 * secs; f++) { W.step(DT); if (foundAt < 0 && A.found) foundAt = game.time; }
    return foundAt;
  };
  // ---- (a) the takedown
  {
    const S = await stage(301); const { W, game, A, B, C, lines, msgs } = S;
    const offered = game.interactables?.some?.((x: any) => x.kind === 'guard' && x.guard === A && x.inReach);
    startTakedown(game, A);
    for (let i = 0; i < 90; i++) W.step(DT);   // the cross lands at 0.28 s; control back at 0.62 s
    const st = game.mission.stats; const rows = debriefRows(st); const koRow = rows.find((r: [string, string]) => /knocked out/.test(r[0]));
    const fails: string[] = [];
    if (A.state !== 'dead') fails.push(`A is ${A.state}, not down`);
    if (A.downKind !== 'struck' || A.downBy !== 'player') fails.push(`downKind ${A.downKind} / downBy ${A.downBy} (want struck / player)`);
    if (!isBreathing(A)) fails.push('isBreathing(A) false');
    if (isBreathing(B)) fails.push('isBreathing(living B) true');
    if (st.knockouts !== 1 || st.kills !== 0) fails.push(`stats knockouts ${st.knockouts} kills ${st.kills} (want 1 / 0)`);
    if (!koRow || koRow[1] !== '1 · 0') fails.push(`debrief row ${JSON.stringify(koRow)} (want 'knocked out · killed' = '1 · 0')`);
    if (missionRating(st) !== 'ghost') fails.push(`rating ${missionRating(st)} before anybody found him (want ghost: a knockout nobody finds is not a kill)`);
    if (!msgs.some(m => /takedown — out cold/.test(m.text))) fails.push(`log line: ${msgs.map(m => m.text).join(' | ') || 'none'} (want 'takedown — out cold')`);
    const ratingBefore = missionRating(st);
    // now somebody finds him
    const foundAt = findWith(S);
    const call = lines.find(l => l.radio && l.who === B.callsign && /radioing it in/.test(l.text));
    const remark = lines.find(l => /stay sharp/.test(l.text)); const closing = lines.find(l => /^no sign of him/.test(l.text));
    if (foundAt < 0) fails.push('B never found the body in 30 s (staging)');
    if (!call || !/out cold but breathing/.test(call.text) || !call.text.includes(A.callsign)) fails.push(`finder's call: "${call?.text ?? 'none'}" (want "it's ${A.callsign} — he's down, out cold but breathing…")`);
    if (!B.witness.sawBody || B.witness.sawBody.victim !== A.callsign || B.witness.sawBody.breathing !== true) fails.push(`B.witness.sawBody ${JSON.stringify(B.witness.sawBody)} (want ${A.callsign}, breathing true)`);
    if (!C.witness.calledToBody || C.witness.calledToBody.breathing !== true) fails.push(`C.witness.calledToBody ${JSON.stringify(C.witness.calledToBody)} (want breathing true: he heard the call)`);
    if (st.bodies !== 1) fails.push(`stats.bodies ${st.bodies} after the find (want 1: a sleeping guard found is as much an alarm)`);
    if (missionRating(st) !== 'panther') fails.push(`rating ${missionRating(st)} after the find (want panther)`);
    if (game.escalation < 1) fails.push(`escalation ${game.escalation} after the find (want ≥ 1: consequences identical to a corpse)`);
    verdict(fails.length === 0, '(a) the takedown: struck, breathing, a knockout on the card, found and called in as out cold',
      `takedown offered=${offered ?? '?'} · A ${A.state}/${A.downKind}/${A.downBy} breathing=${isBreathing(A)} · stats ko ${st.knockouts} kills ${st.kills} bodies ${st.bodies} · rating ${ratingBefore} → ${missionRating(st)} · card row ${JSON.stringify(koRow)}\n    found at ${foundAt >= 0 ? (foundAt).toFixed(1) : '—'} s · call: "${call?.text ?? '—'}" · 2nd man: "${remark?.text ?? '—'}" · closing: "${closing?.text ?? '—'}"\n    B: ${witnessSummary(game, B) || '—'} · C: ${witnessSummary(game, C) || '—'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) a round
  {
    const S = await stage(302); const { W, game, A, B, C, lines, msgs } = S;
    game.player.crouch = false; W.step(DT);
    fireWeapon(game, game.player.char, chest(A), true);
    for (let i = 0; i < 60; i++) W.step(DT);
    const st = game.mission.stats; const koRow = debriefRows(st).find((r: [string, string]) => /knocked out/.test(r[0]));
    const fails: string[] = [];
    if (A.state !== 'dead' || A.downKind !== 'shot' || A.downBy !== 'player') fails.push(`A ${A.state}/${A.downKind}/${A.downBy} (want dead / shot / player)`);
    if (isBreathing(A)) fails.push('isBreathing(A) true for a shot man');
    if (st.kills !== 1 || st.knockouts !== 0 || st.shots !== 1) fails.push(`stats kills ${st.kills} ko ${st.knockouts} shots ${st.shots} (want 1 / 0 / 1)`);
    if (!koRow || koRow[1] !== '0 · 1') fails.push(`debrief row ${JSON.stringify(koRow)} (want '0 · 1')`);
    // the log line over a SHOT man says so since the KO-vs-dead wording pass (7ecfb42, 08-09: 'guard down' → 'guard down — dead', beside 'takedown — out cold,
    // breathing (a knockout, not a kill)' and 'choked out — he'll keep, breathing' — CLAUDE.md: "out cold — breathing … in the log"): the exact line, not a prefix
    if (!msgs.some(m => m.text === 'guard down — dead')) fails.push(`log line: ${msgs.map(m => m.text).join(' | ')} (want 'guard down — dead')`);
    if (msgs.some(m => /breathing|out cold/.test(m.text))) fails.push(`a breathing / out-cold line over a SHOT man: ${msgs.map(m => m.text).filter(t => /breathing|out cold/.test(t)).join(' | ')}`);
    const foundAt = findWith(S);
    const call = lines.find(l => l.radio && l.who === B.callsign && /radioing it in/.test(l.text));
    const remark = lines.find(l => /stay sharp/.test(l.text));
    if (!call || call.text !== 'man down! — radioing it in') fails.push(`finder's call: "${call?.text ?? 'none'}" (want 'man down! — radioing it in')`);
    if (!B.witness.sawBody || B.witness.sawBody.breathing !== false) fails.push(`B.witness.sawBody ${JSON.stringify(B.witness.sawBody)} (want breathing false)`);
    if (!C.witness.calledToBody || C.witness.calledToBody.breathing !== false) fails.push(`C.witness.calledToBody ${JSON.stringify(C.witness.calledToBody)} (want breathing false)`);
    verdict(fails.length === 0, '(b) a round from the Five-seveN: shot, dead, a kill on the card, "man down!"',
      `A ${A.state}/${A.downKind}/${A.downBy} breathing=${isBreathing(A)} · stats kills ${st.kills} ko ${st.knockouts} bodies ${st.bodies} rating ${missionRating(st)} · card row ${JSON.stringify(koRow)}\n    found at ${foundAt >= 0 ? foundAt.toFixed(1) : '—'} s · call: "${call?.text ?? '—'}" · 2nd man: "${remark?.text ?? '—'}"${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) the other call shapes
  {
    const S = await stage(303); const { W, game, A, B, C, msgs } = S;
    killGuard(game, A, [1, 0, 0], false, 'shot', 'guard');   // a colleague's round (the human shield's friendly fire, one day)
    B.hold = false; place(B, [20, 0, 11.2], -Math.PI / 2); W.step(DT);
    killGuard(game, B, [0, 0, 1], true, 'choked');            // the choke-out from a hold (slice 1 of the design)
    place(C, [26, 0, 11.2], -Math.PI / 2); W.step(DT);
    killGuard(game, C, [0, 0, 1], false, 'shot', 'world');
    for (let i = 0; i < 30; i++) W.step(DT);
    const st = game.mission.stats; const fails: string[] = [];
    if (A.downKind !== 'shot' || A.downBy !== 'guard' || isBreathing(A)) fails.push(`A ${A.downKind}/${A.downBy} breathing ${isBreathing(A)}`);
    if (B.downKind !== 'choked' || B.downBy !== 'player' || !isBreathing(B)) fails.push(`B ${B.downKind}/${B.downBy} breathing ${isBreathing(B)}`);
    if (C.downKind !== 'shot' || C.downBy !== 'world' || isBreathing(C)) fails.push(`C ${C.downKind}/${C.downBy} breathing ${isBreathing(C)}`);
    if (st.kills !== 0 || st.knockouts !== 1) fails.push(`stats kills ${st.kills} ko ${st.knockouts} (want 0 / 1: only the choke is the player's, and it is a knockout)`);
    if (!msgs.some(m => /hit by his own side/.test(m.text)) || !msgs.some(m => /choked out/.test(m.text))) fails.push(`log lines: ${msgs.map(m => m.text).join(' | ')}`);
    // a second killGuard on a man already down changes nothing (his record is written once)
    killGuard(game, B, [1, 0, 0], false, 'shot', 'player'); if (B.downKind !== 'choked' || st.kills !== 0) fails.push(`killGuard on a downed man rewrote him: ${B.downKind}, kills ${st.kills}`);
    verdict(fails.length === 0, "(c) a colleague's round / the world / a choke-out: only the player's own count, and a choke is a knockout",
      `A shot-by-guard → ${A.downKind}/${A.downBy}; B choked → ${B.downKind}/${B.downBy} breathing ${isBreathing(B)}; C shot-by-world → ${C.downKind}/${C.downBy}; stats kills ${st.kills} ko ${st.knockouts}; log: ${msgs.map(m => m.text).filter(t => /down|choked|takedown/.test(t)).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (d) the room clear's grim lines over a man out cold: lockdown, the pair sent to the room the third man lies in
  {
    Math.random = seeded(304);
    const W = await standUp(); const { game } = W; const { lines } = tap(game);
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([4.9, 0, 23.2]);
    for (let i = 0; i < 30; i++) W.step(DT);
    game.escalate(); game.escalate(); if (game.clearing) { game.clearing.cancel(); game.clearing = null; }
    for (let i = 0; i < 60 * 12; i++) W.step(DT);
    game.teleportPlayer([20.5, 0, 11.3]); game.clearNearestRoom(); game.teleportPlayer([4.9, 0, 23.2]);   // fix mid-corridor: server room + manager's office
    let third: any = null; for (let i = 0; i < 60 * 30 && !third; i++) { W.step(DT); const Cl = game.clearing; if (Cl && Cl.stage === 'approach') third = game.guards.find((x: any) => x.state !== 'dead' && x !== Cl.a && x !== Cl.b) ?? null; }
    const Cl = game.clearing; const fails: string[] = []; let grim: string[] = [];
    if (!third || !Cl?.cur?.bounds) fails.push('staging: no approach / no third man / no room bounds');
    else {
      const Bd = Cl.cur.bounds; const q: Vec3 = [(Bd.x0 + Bd.x1) / 2 - 1.2, 0, Bd.z1 - 2.2];
      third.post = null; place(third, q, Math.PI); killGuard(game, third, [0, 0, -1], true);   // out cold, a couple of metres inside the door
      const t0 = game.time; for (let f = 0; f < 60 * 60; f++) { W.step(DT); if (game.time - t0 > 45 && !game.clearing) break; }
      grim = lines.filter(l => l.t > t0 && /breathing|out cold/.test(l.text)).map(l => `${l.who}: ${l.text}`);
      if (!third.found) fails.push('the pair never found him');
      if (!grim.some(t => /room's clear — nobody but him, and he's breathing|checking under… just him\. breathing|still breathing|out cold/.test(t))) fails.push(`no out-cold line from the drill: ${lines.filter(l => l.t > t0).map(l => l.text).slice(0, 12).join(' | ')}`);
    }
    verdict(fails.length === 0, '(d) the room clear over a man out cold inside the room: the breathing set of grim lines', `${grim.join(' | ') || '—'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== ko-kinds: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (2) the radio check: an unconscious man fails to answer exactly like a dead one
/** The missing-colleague staging (ai-probes.ts missing (A)): the lobby man put down behind the reception desk on his own loop, Sam gone, a calm floor — once out
 *  cold (the takedown's 'struck'), once shot dead, same seed. Both: nothing before the check, the count-in without him, his name asked ≈ 4 s after the call, a man
 *  sent ≈ 8 s after it, the body found on the walk, the floor up a step. The timings must agree between the two to the frame (the dice are the same until the
 *  words differ); only the finder's call differs — out cold vs 'man down!'. PASS / FAIL. */
export async function koRollcall() {
  console.log('\n=== ko-rollcall: a man out cold is as silent on the net as a corpse — same check, same errand, same alarm; only the words over him differ (the SHIFT ALONE on the floor: civilians off) ===');
  let allPass = true;
  type Run = { how: string; tKill: number; tCall: number; tAsk: number; tSend: number; tFound: number; tEsc: number; esc: number; call: string; preLeak: string; answers: string; fails: string[] };
  const runs: Run[] = [];
  for (const how of ['struck', 'shot'] as const) {
    Math.random = seeded(201);
    const W = await standUp(); const { game } = W;
    // RESTAGED with the civilians OFF (probe-restaging lane, docs/internal/probe-restage.md): this probe is about the SHIFT's own net — the count-in, the man sent
    // round the route, HIS find. Since the civilians merged (d7c3289) the late worker's loop brings him on the body behind the reception desk ≈ 16 s after the man
    // is sent and before the walk gets there (measured 08-12, seed 201: Owen '→ alarmed [body, armed]' at +113.5 s, runs to Novak, tells him at +119.6, control puts
    // the floor up on cause 'civilian' — "somebody's on the floor who shouldn't be" — at +122.4); the run ends on that escalation with the body never found by the
    // shift's walk — a different, possibly legitimate outcome the maintainer has not ruled on. Nobody but the shift here: exactly the floor the probe was written
    // against (the devices / teams probes pin them off the same way).
    // TODO(civilians-on variant, awaiting the maintainer): is "a civilian called it in first" a third legitimate outcome of the missing-man staging? If yes, add
    // koRollcallCivilians: same seed with them on, expecting the floor up on 'civilian' before the walk finds him, and the finder's words checked when he does.
    game.tune.civilians = false; game.civilians.length = 0;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    const { lines, msgs } = tap(game);
    for (let i = 0; i < 60 * 5; i++) W.step(DT);
    const victim = game.guards[2];   // lobby_break
    place(victim, [7.6, 0, 16.1], -Math.PI / 2);
    killGuard(game, victim, [-1, 0, 0], true, how);   // (quiet both times — folded where he stood, nothing clattering — so the ONLY difference between the runs is dead vs out cold: a thrown body and a dropped torch's clatter are the loud kill's physics, not the net's doing)
    const tKill = game.time; const others = game.guards.filter((x: any) => x !== victim);
    let tCall = -1, tAsk = -1, tSend = -1, tFound = -1, tEsc = -1; let preLeak = '';
    for (let f = 0; f < 60 * 260; f++) {
      W.step(DT); const t = game.time;
      if (tCall < 0) {
        const l = lines.find(x => /sound off/.test(x.text)); if (l) tCall = l.t;
        else if (!preLeak) { if (victim.found) preLeak = `${t.toFixed(1)}s body found`; else if (game.escalation) preLeak = `${t.toFixed(1)}s escalation`; else for (const o of others) if (o.state !== 'patrol' || o.task || o.bodyDuty) { preLeak = `${t.toFixed(1)}s ${o.callsign} ${o.state}`; break; } }
      }
      if (tCall >= 0 && tAsk < 0) { const l = lines.find(x => x.t > tCall && x.text.includes(`${victim.callsign}?`)); if (l) tAsk = l.t; }
      if (tCall >= 0 && tSend < 0 && others.some((x: any) => x.task?.kind === 'checkOn' && x.task.who === victim)) tSend = t;
      if (tFound < 0 && victim.found) tFound = t;
      if (tEsc < 0 && game.escalation > 0) tEsc = t;
      if (tEsc >= 0 && t > tEsc + 3) break;
    }
    const call = lines.find(l => l.radio && /radioing it in/.test(l.text))?.text ?? '';
    const answers = msgs.filter(m => /^radio: …/.test(m.text)).map(m => m.text).join(' / ');
    const fails: string[] = [];
    if (victim.downKind !== how) fails.push(`downKind ${victim.downKind} (want ${how})`);
    if (preLeak) fails.push(`something moved before the radio check: ${preLeak}`);
    if (tCall < 0 || tCall - tKill > 100) fails.push(`radio check at ${tCall < 0 ? 'never' : '+' + (tCall - tKill).toFixed(1) + ' s'}`);
    if (tAsk < 0 || Math.abs(tAsk - tCall - 4) > 0.6) fails.push(`asked for at ${tAsk < 0 ? 'never' : '+' + (tAsk - tCall).toFixed(1) + ' s after the call'} (want ≈ +4)`);
    if (tSend < 0 || Math.abs(tSend - tCall - 8) > 0.6) fails.push(`sent at ${tSend < 0 ? 'never' : '+' + (tSend - tCall).toFixed(1) + ' s after the call'} (want ≈ +8)`);
    if (answers.includes(victim.callsign)) fails.push(`he answered the count-in: ${answers}`);
    if (tFound < 0) fails.push('never found on the walk');
    if (!(tEsc >= 0 && game.escalation >= 1)) fails.push(`floor stayed at ${game.escalation}`);
    if (how === 'struck' && !/out cold but breathing/.test(call)) fails.push(`finder's call "${call}" (want out cold)`);
    if (how === 'shot' && call !== 'man down! — radioing it in') fails.push(`finder's call "${call}" (want 'man down!')`);
    runs.push({ how, tKill, tCall, tAsk, tSend, tFound, tEsc, esc: game.escalation, call, preLeak, answers, fails });
  }
  const [ko, dead] = runs; const rel = (r: Run, t: number) => t >= 0 ? `+${(t - r.tKill).toFixed(1)} s` : 'never';
  const same = ['tCall', 'tAsk', 'tSend', 'tFound'].every(k => Math.abs(((ko as any)[k] - ko.tKill) - ((dead as any)[k] - dead.tKill)) < 1.0);
  if (!same) ko.fails.push('the out-cold run and the dead run diverge in timing (the net treated them differently)');
  for (const r of runs) { const ok = r.fails.length === 0; allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${r.how === 'struck' ? 'out cold (the takedown)' : 'shot dead'}: radio check ${rel(r, r.tCall)} · asked for ${rel(r, r.tAsk)} · sent ${rel(r, r.tSend)} · found ${rel(r, r.tFound)} · floor → ${r.esc} at ${rel(r, r.tEsc)}\n    count-in: ${r.answers || '—'} · finder: "${r.call || '—'}"${r.fails.length ? '\n    ✗ ' + r.fails.join('\n    ✗ ') : ''}`); }
  console.log(`  timings agree between the two runs (< 1 s each): ${same}`);
  console.log(`=== ko-rollcall: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (3) the witness record: a man remembers only what he saw or heard
/** (a) Sam shoots A on the corridor with his SUPPRESSED pistol (level 0.6 since 8b3f69d: an odd noise within ≈ 7.5 m, not gunfire): B six metres off with A in
 *      his open view remembers seeing it (sawAct shot / A) and hearing the odd noise (heard.small, placed at the muzzle; heard.shots 0; never alert); C out on the
 *      lot hears NOTHING of it (shots / small / bang 0, no sawAct, never alert) and knows only B's call (calledToBody dead). Sam himself is in the dark to both
 *      (visibility 0.02): B saw the VICTIM drop. (The loud carry to the lot lives on in (e)'s level-1 shot and (d)'s charges.)
 *  (b) the quiet takedown of A with B watching: B's sawAct says struck; a frame later he finds the body — sawBody breathing; D on the lot gets the call (calledToBody
 *      breathing) and nothing else.
 *  (c) the same takedown with nobody looking (B and D on the lot facing away): both records stay empty for ten seconds — no sound of it reaches them, no call.
 *  (d) a stun charge three metres in front of B: dazzled 1, heard.bang 1; C behind the building's walls: bang 1, dazzled 0.
 *  (e) with the AI off: a shot, a kill in B's view and a stun charge at his feet write nothing into anybody's record.
 *  Plus the temperament table covers every callsign. PASS / FAIL each; the summaries are printed as the panel would show them. */
export async function witness() {
  console.log('\n=== witness: knowledge gating — the watcher saw it, the man round the corner heard it, the man on the lot knows nothing ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  /** A mid-corridor facing east, Sam crouched dark behind him; B six metres east facing west (A — and Sam beyond him — in his cone, open corridor between);
   *  C parked on the lot (walls between, hearing). Returns after one settled frame with the LOS facts checked. */
  const stage = async (seed: number, opts: { bWatching?: boolean } = {}) => {
    Math.random = seeded(seed);
    const W = await standUp(); const { game } = W;
    game.player.visibility = 0.02; game.godMode = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards;
    place(A, [14, 0, 11.2], Math.PI / 2); A.hold = true;
    if (opts.bWatching !== false) { place(B, [20, 0, 11.2], -Math.PI / 2); B.hold = true; } else park(B, 0);
    park(C, 1);
    game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02;
    const los = { bSeesA: pointInView(game, B, chest(A)), cSeesA: pointInView(game, C, chest(A)), cWall: game.col.segmentBlocked(eyeOf(C), chest(A)), bSeesSam: B.sawPlayerThisFrame };
    return { W, game, A, B, C, los, ...tap(game) };
  };
  // ---- (a) the shot from Sam's SUPPRESSED pistol, watched by B; C on the lot
  // Since 8b3f69d (08-09, "the suppressed pistol is an odd noise nearby, not a gunshot floor-wide") the Five-seveN's report is level 0.6 < 1: guards.ts hearingCheck
  // does NOT count it as gunfire (heard.shots, 0.92, 'that was a shot', the whole floor + the lot) but as a SMALL noise within ≈ 7.5 m of open air (heard.small,
  // suspicion 0.5, placed at its source, no radio). So the gating this staging shows today: B six metres off SAW the act and heard the odd noise of it (small ≥ 1,
  // shots 0, never over the alert line — nothing that loud reached him); C out on the lot heard NOTHING of it (shots 0, small 0, no sawAct) and knows only what the
  // net tells him once B calls the body in (calledToBody, dead), his awareness lifted to the call's 0.45 and no further. The old expectation (C hears the shot, both
  // alerted by sound, C at 0.92) was the LOUD pistol's; the loud carry to the lot is still held by (e) below (a level-1 shot: B and C heard.shots 1 each) and (d).
  {
    const S = await stage(401); const { W, game, A, B, C, los } = S;
    const fails: string[] = [];
    if (!los.bSeesA) fails.push('staging: A is not in B\'s open view'); if (los.cSeesA || !los.cWall) fails.push('staging: C on the lot has a line to A'); if (los.bSeesSam) fails.push('staging: B already has eyes on Sam (meant to be dark)');
    const preB = pristine(B.witness), preC = pristine(C.witness);
    if (preB || preC) fails.push(`records not empty before the shot: B {${preB}} C {${preC}}`);
    if (!game.player.pistol?.def?.suppressed || !((game.player.pistol.def.report?.level ?? 1) < 1)) fails.push(`premise: Sam's pistol is not the suppressed sub-gunshot row this probe now expects (suppressed ${game.player.pistol?.def?.suppressed}, level ${game.player.pistol?.def?.report?.level}) — if the Five-seveN went loud again, restore the loud expectations`);
    game.player.crouch = false; W.step(DT);
    fireWeapon(game, game.player.char, chest(A), true);
    const actB0 = B.witness.sawAct ? { ...B.witness.sawAct } : null;   // written inside killGuard, before anyone has heard anything
    const ev = game.events.find((e: any) => e.kind === 'shot' && e.time === game.time);   // Sam's report as filed this frame
    W.step(DT);
    const smallB1 = B.witness.heard.small, whereB1 = B.witness.heard.smallWhere ? v3.copy(B.witness.heard.smallWhere) : null;   // one frame on: the report alone has reached B (the body's fall and the find come later)
    for (let i = 0; i < 89; i++) W.step(DT);   // a second and a half in all: everything that carries has carried, the far man's reactT would have passed
    if (A.downKind !== 'shot') fails.push(`A ${A.state}/${A.downKind}`);
    if (!ev || (ev.level ?? 0) >= 1 || ev.loud || ev.weapon !== game.player.pistol.def.id) fails.push(`the shot event: ${ev ? `level ${ev.level} loud ${ev.loud} weapon ${ev.weapon}` : 'none filed'} (want the ${game.player.pistol.def.id}'s, level < 1, not loud: the suppressed report)`);
    if (!actB0 || actB0.kind !== 'shot' || actB0.victim !== A.callsign) fails.push(`B.sawAct right after the shot: ${JSON.stringify(actB0)} (want shot / ${A.callsign})`);
    if (smallB1 < 1 || !whereB1 || v3.distXZ(whereB1, game.player.char.pos) > 1.0) fails.push(`B one frame after the shot: heard.small ${smallB1} placed ${whereB1 ? `(${whereB1[0].toFixed(1)}, ${whereB1[2].toFixed(1)})` : 'nowhere'} (want ≥ 1, at the muzzle through open air: Sam stands at (${game.player.char.pos[0].toFixed(1)}, ${game.player.char.pos[2].toFixed(1)}))`);
    if (B.witness.heard.shots !== 0) fails.push(`B.heard.shots ${B.witness.heard.shots} (want 0: a suppressed report is not gunfire to anybody's ears)`);
    if (B.witness.alertedBy !== null || B.witness.peakAwareness >= 0.9) fails.push(`B alerted by ${B.witness.alertedBy}, peak ${B.witness.peakAwareness.toFixed(2)} (want never over the line: the odd noise is suspicion, the body a call-in — Sam himself stayed dark)`);
    if (B.witness.peakAwareness < 0.5) fails.push(`B.peakAwareness ${B.witness.peakAwareness.toFixed(2)} (want ≥ 0.5: the odd noise six metres off)`);
    if (C.witness.sawAct) fails.push(`C.sawAct ${JSON.stringify(C.witness.sawAct)} — he is behind two walls`);
    if (C.witness.heard.shots !== 0 || C.witness.heard.small !== 0 || C.witness.heard.bang !== 0) fails.push(`C heard something of it out on the lot: shots ${C.witness.heard.shots} small ${C.witness.heard.small} bang ${C.witness.heard.bang} (want 0 / 0 / 0: ≈ 7.5 m of open air is all a suppressed report carries)`);
    if (C.witness.alertedBy !== null) fails.push(`C.alertedBy ${C.witness.alertedBy} (want null: nothing took him over the line)`);
    if (C.witness.peakAwareness >= 0.9) fails.push(`C.peakAwareness ${C.witness.peakAwareness.toFixed(2)} (want < 0.9: he never heard a shot)`);
    if (!B.witness.sawBody || B.witness.sawBody.victim !== A.callsign || B.witness.sawBody.breathing !== false) fails.push(`B.sawBody ${JSON.stringify(B.witness.sawBody)} (want ${A.callsign}, breathing false: he called the body in from where he stood)`);
    if (!C.witness.calledToBody || C.witness.calledToBody.victim !== A.callsign || C.witness.calledToBody.breathing !== false) fails.push(`C.calledToBody ${JSON.stringify(C.witness.calledToBody)} (want ${A.callsign} dead: ALL he knows is the call)`);
    if (A.witness.sawAct) fails.push('the victim has a sawAct of his own death');
    verdict(fails.length === 0, '(a) Sam\'s suppressed pistol drops A: B (A in view, 6 m) SAW it and heard only an odd noise; C (on the lot) heard NOTHING of it and knows only the call',
      `LOS: B→A ${los.bSeesA}, C→A ${los.cSeesA} (wall ${los.cWall}), B eyes on Sam ${los.bSeesSam} · shot event level ${ev?.level} loud ${ev?.loud}\n    B: ${witnessSummary(game, B)}\n    C: ${witnessSummary(game, C)}\n    A (victim): ${witnessSummary(game, A) || '—'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) the quiet takedown, watched: struck, then found breathing
  {
    const S = await stage(402); const { W, game, A, B, C, los, lines } = S;
    const fails: string[] = []; if (!los.bSeesA) fails.push('staging: A not in B\'s view');
    B.hold = false;   // free to walk up and call it
    startTakedown(game, A);
    let actB: any = null; let foundAt = -1;
    for (let i = 0; i < 60 * 8; i++) { W.step(DT); if (!actB && B.witness.sawAct) actB = { ...B.witness.sawAct, at: game.time }; if (foundAt < 0 && A.found) foundAt = game.time; }
    if (A.downKind !== 'struck' || !isBreathing(A)) fails.push(`A ${A.downKind} breathing ${isBreathing(A)}`);
    if (!actB || actB.kind !== 'struck' || actB.victim !== A.callsign) fails.push(`B.sawAct ${JSON.stringify(actB)} (want struck / ${A.callsign})`);
    if (foundAt < 0) fails.push('B never called the body in 8 s');
    if (!B.witness.sawBody || B.witness.sawBody.victim !== A.callsign || !B.witness.sawBody.breathing) fails.push(`B.sawBody ${JSON.stringify(B.witness.sawBody)} (want ${A.callsign} breathing)`);
    if (!C.witness.calledToBody || !C.witness.calledToBody.breathing || C.witness.calledToBody.victim !== A.callsign) fails.push(`C.calledToBody ${JSON.stringify(C.witness.calledToBody)}`);
    if (C.witness.sawAct || C.witness.sawBody || C.witness.heard.shots || C.witness.heard.small) fails.push(`C knows more than the call: ${witnessSummary(game, C)}`);
    if (B.witness.heard.shots) fails.push(`B heard ${B.witness.heard.shots} shots off a silent takedown`);
    const call = lines.find((l: any) => l.radio && /radioing it in/.test(l.text))?.text ?? '—';
    verdict(fails.length === 0, '(b) the quiet takedown with B watching: he saw A DROPPED (struck), then found him breathing; C only heard the call',
      `B: ${witnessSummary(game, B)}\n    C: ${witnessSummary(game, C)}\n    call: "${call}"${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) the quiet takedown, unwatched: nobody's record moves
  {
    const S = await stage(403, { bWatching: false }); const { W, game, A, B, C } = S;
    const fails: string[] = [];
    startTakedown(game, A);
    for (let i = 0; i < 60 * 10; i++) W.step(DT);
    if (A.downKind !== 'struck') fails.push(`A ${A.state}/${A.downKind}`);
    const pb = pristine(B.witness), pc = pristine(C.witness);
    if (pb) fails.push(`B's record moved: ${pb}`); if (pc) fails.push(`C's record moved: ${pc}`);
    if (A.found) fails.push('somebody found him (staging: they are meant to be out on the lot facing away)');
    verdict(fails.length === 0, '(c) the same takedown with nobody looking and nobody near: both records stay empty for 10 s',
      `B: ${witnessSummary(game, B) || 'empty'} · C: ${witnessSummary(game, C) || 'empty'} · A found=${A.found}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (d) the stun charge: in B's open view, behind walls for C
  {
    const S = await stage(404); const { W, game, A, B, C } = S;
    const fails: string[] = [];
    game.teleportPlayer([37.5, 0, 26.5]);   // Sam out of it
    A.hold = true; A.heardUpTo = 1e12; place(A, [6, 0, 11.2], -Math.PI / 2);   // A deaf at the far west end facing away: this one is about B and C
    game.dropThrowable('flash', [17, 0, 11.2]);   // three metres in front of B, on the open corridor
    for (let i = 0; i < 60 * 3; i++) W.step(DT);
    if (B.witness.dazzled !== 1) fails.push(`B.dazzled ${B.witness.dazzled} (want 1)`);
    if (B.witness.heard.bang < 1) fails.push(`B.heard.bang ${B.witness.heard.bang}`);
    if (C.witness.dazzled !== 0) fails.push(`C.dazzled ${C.witness.dazzled} behind the walls`);
    if (C.witness.heard.bang < 1) fails.push(`C.heard.bang ${C.witness.heard.bang} (a stun charge carries to the lot)`);
    if (!(game.time < B.dazzledUntil + 10)) fails.push('staging: B was never dazzled');
    // a second one: the count goes to 2
    game.dropThrowable('flash', [17.5, 0, 11.6]); for (let i = 0; i < 60 * 3; i++) W.step(DT);
    if (B.witness.dazzled !== 2) fails.push(`B.dazzled ${B.witness.dazzled} after the second (want 2)`);
    verdict(fails.length === 0, '(d) stun charges in B\'s open view: dazzled counts 1 then 2, C behind the walls only hears the bangs',
      `B: ${witnessSummary(game, B)}\n    C: ${witnessSummary(game, C)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (e) AI off: nothing is remembered
  {
    const S = await stage(405); const { W, game, A, B, C } = S;
    const fails: string[] = [];
    game.aiEnabled = false;
    game.player.crouch = false; W.step(DT);
    fireWeapon(game, game.player.char, chest(A), true);        // a kill in B's view, a shot everyone would hear
    game.dropThrowable('flash', [17, 0, 11.2]);                 // and a stun charge at B's feet
    for (let i = 0; i < 60 * 4; i++) W.step(DT);
    if (A.state !== 'dead') fails.push('staging: A not down');
    for (const [n, gd] of [['A', A], ['B', B], ['C', C]] as [string, any][]) { const p = pristine(gd.witness); if (p) fails.push(`${n}'s record written with the AI off: ${p}`); }
    if (!(B.dazzledUntil > game.time - 4)) fails.push('staging: the charge never dazzled B physically');
    // and back on: from here things are remembered again (the events themselves are long gone — half a second's queue)
    game.aiEnabled = true; game.events.push({ kind: 'shot', pos: [10, 0, 11.2], time: game.time, loud: true, level: 1 }); for (let i = 0; i < 30; i++) W.step(DT);
    if (B.witness.heard.shots !== 1 || C.witness.heard.shots !== 1) fails.push(`after AI back on, a fresh shot: B ${B.witness.heard.shots} C ${C.witness.heard.shots} (want 1 each)`);
    verdict(fails.length === 0, '(e) with the AI off a shot, a kill in view and a stun charge write nothing; back on, the next shot is heard',
      `B: ${witnessSummary(game, B) || 'empty'} · C: ${witnessSummary(game, C) || 'empty'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- the temperament table
  {
    const missingT = CALLSIGNS.filter((c: string) => !TEMPERAMENT[c]); const vals = new Set(Object.values(TEMPERAMENT));
    const ok = missingT.length === 0 && [...vals].every(v => ['steady', 'nervy', 'hard'].includes(v as string));
    allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — temperament table: ${CALLSIGNS.map((c: string) => `${c} ${TEMPERAMENT[c] ?? 'MISSING'}`).join(', ')}`);
  }
  console.log(`=== witness: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
