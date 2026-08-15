// The 'selector' probe family (run through probes.ts: `bun run tools/qa/probes.ts selector | selector-rows | selector-input | selector-sustained | selector-noise`):
// the Space selector (src/game/interact.ts) over the interaction rows (player.ts buildInteractables) — every verb its own row, the highest-priority MAX_NEAR of
// what is in reach; a TAP does the highlighted row, Space HELD past TAP_SECS opens the list (a cancel row at its foot, the feet frozen, the wheel / arrows
// choosing) and LETTING GO does the highlighted one; the sustained verbs (ease a leaf, pick a lock, the choke, the whip, the drive) start on their row and run
// on their own clock until done or stopped by a fresh Space press, Esc, or a step. Everything a verb does once begun — its timing, the leaf's curve, what the
// floor hears of it — is asserted against what the held-key grammar did before the change (numbers frozen below from that build, 60 Hz, through the same
// real input path). Each probe stands the full game up headless (headless.ts), stages one situation, drives it through input.keys / pressed / wheel and the
// rows, prints what happened, PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
const IK = 'Space';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const playerMod = await import(`${ROOT}/src/game/player.ts`);
const { EASE_RATE, EASE_MAX, MAX_NEAR, PACE_STEP } = playerMod;
const { TAP_SECS, runningVerb } = await import(`${ROOT}/src/game/interact.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { Doors } = await import(`${ROOT}/src/game/doors.ts`);
const { DRIVE_SECS, PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { isBreathing } = await import(`${ROOT}/src/game/game.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held (the scripted flag), deaf, facing east */
function park(gd: any, i: number) { gd.hold = true; gd.heardUpTo = 1e12; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
/** the rows on offer right now as 'kind:verb' (a running verb starred, the cancel row as 'cancel') */
const verbsOf = (game: any): string[] => game.nearby.map((r: any) => r.kind === 'cancel' ? 'cancel' : `${r.kind}:${r.verb ?? '—'}${r.running ? '*' : ''}`);
const rowsS = (game: any) => game.nearby.map((r: any, i: number) => `${i === game.player.nearSel ? '▸' : ' '}${r.kind}${r.verb ? ':' + r.verb : ''}${r.running ? '*' : ''} "${r.line1} / ${r.line2}"`).join(' | ') || 'none';
/** a one-frame tap (the press edge with the key already up: performed inside that step) */
function tap(W: any) { W.input.pressed.add(IK); W.step(DT); }
/** put the highlight on the row of `kind` / `verb` and tap it; false if no such row */
function tapVerb(W: any, kind: string, verb?: string): boolean { if (!W.game.selectVerb(kind, verb)) return false; tap(W); return true; }
/** every GameEvent stamped in the frames stepped, as { t (from t0), kind, level, loud, who } */
function collect(W: any, n: number, out: any[], t0: number, each?: (i: number) => void) { const { game } = W; for (let i = 0; i < n; i++) { W.step(DT); each?.(i); for (const e of game.events) if (Math.abs(e.time - game.time) < 1e-9 && !(e as any).__s) { (e as any).__s = 1; out.push({ t: +(game.time - t0).toFixed(3), kind: e.kind, level: e.level ?? null, loud: !!e.loud, who: e.who }); } } }
const evS = (ev: any[]) => ev.map(e => `${e.kind}${e.level !== null ? ' ' + f2(e.level) : ''}${e.loud ? '!' : ''}@+${f2(e.t)}`).join(', ') || '—';
/** the player's own events among `ev` (who = PLAYER_ID), as 'kind level' — steps left out (a plant / a shuffle is not the verb's noise) */
const mine = (ev: any[]) => ev.filter(e => e.who === PLAYER_ID && e.kind !== 'step');
/** compare an event list to a frozen one: same kinds / levels / loudness in order, each within `tol` s of its frozen time */
function sameEvents(got: any[], want: { kind: string; level: number; loud?: boolean; t: number }[], tol = 0.06): string | null {
  if (got.length !== want.length) return `got [${evS(got)}], want [${want.map(w => `${w.kind} ${f2(w.level)}${w.loud ? '!' : ''}@+${f2(w.t)}`).join(', ')}]`;
  for (let i = 0; i < want.length; i++) { const a = got[i], b = want[i]; if (a.kind !== b.kind || Math.abs((a.level ?? -1) - b.level) > 0.006 || !!a.loud !== !!b.loud || Math.abs(a.t - b.t) > tol) return `event ${i + 1}: got ${a.kind} ${f3(a.level ?? -1)}${a.loud ? '!' : ''}@+${f3(a.t)}, want ${b.kind} ${f2(b.level)}${b.loud ? '!' : ''}@+${f2(b.t)} (±${tol})`; }   // (levels are authored constants but for the kicked leaf's bang, |vel| / 8 — frozen to two places)
  return null;
}

// ---- frozen from the held-key build (tools run on it before the change, 60 Hz, the same stagings as below):
/** the crack: nothing for 0.233 s of the hold (doorHold > 0.22), then 0.55 rad/s a frame at a time (0.00917), standing at 0.605 (0.6 + the step that crossed it) however long the key stayed down */
const OLD_CRACK = { delay: 0.233, perFrame: 0.55 / 60, cap: 0.605 };
/** what the floor heard of each verb, from the frame the key acted (a tap: its own frame; the pick: the frame the plant began, 0.233 s into the hold) */
const OLD_EVENTS = {
  push: [{ kind: 'door', level: 0.20, t: 0.02 }],                                            // the creak as it swings away
  pull: [] as { kind: string; level: number; t: number }[],                                   // pulled to: nothing until the latch, seconds later
  rattle: [{ kind: 'door', level: 0.12, t: 0.02 }],                                          // the handle tried
  unlock: [{ kind: 'door', level: 0.12, t: 0.02 }, { kind: 'door', level: 0.20, t: 0.02 }],   // the key's clack + the creak, one frame
  ease: [] as { kind: string; level: number; t: number }[],                                   // silent, keyed or not
  kick: [{ kind: 'kick', level: 1.0, loud: true, t: 0.40 }, { kind: 'door', level: 0.60, loud: true, t: 0.67 }],   // the boot at KICK_IMPACT, the leaf banging off its stop
  pick: [{ kind: 'door', level: 0.16, t: 0.417 }, { kind: 'door', level: 0.16, t: 1.167 }, { kind: 'door', level: 0.16, t: 1.80 }, { kind: 'door', level: 0.16, t: 2.617 }, { kind: 'door', level: 0.16, t: 3.317 }, { kind: 'door', level: 0.16, t: 3.90 }, { kind: 'door', level: 0.30, t: 4.317 }],   // six clicks and the cylinder going over — re-based to the frame the plant began (the old +0.65 … +4.55 less the 0.233 s hold threshold)
  pickAbort: { secsOfWork: 1.767, pick: 0.397, events: [{ kind: 'door', level: 0.16, t: 0.417 }, { kind: 'door', level: 0.16, t: 1.167 }] },   // let go 2.0 s into the hold = 1.767 s of work: two clicks, 0.397 of the cylinder kept
  grab: [{ kind: 'prop', level: 0.12, t: 0.02 }],
  question: [] as { kind: string; level: number; t: number }[],
  choke: [{ kind: 'prop', level: 0.15, t: 0.35 }, { kind: 'prop', level: 0.30, t: 2.967 }],   // the arm closing at chokeHold, him meeting the floor at chokeHold + choke
  chokeAbort: [{ kind: 'prop', level: 0.15, t: 0.35 }],                                       // eased off at 1.5 s: only the arm going on
  whip: [{ kind: 'prop', level: 0.35, t: 0.95 }],                                             // the crack of it at chokeHold + whip
  drive: [{ kind: 'prop', level: 0.35, t: 3.533 }],                                           // the caddy's clunk at DRIVE_SECS
  breaker: [] as { kind: string; level: number; t: number }[],
};

/** the level up, Sam immortal and dark, everybody parked (or A staged), a couple of settled frames */
async function world(seed: number) { Math.random = seeded(seed); const W = await standUp(); W.game.godMode = true; W.game.player.visibility = 0.02; for (let i = 0; i < 5; i++) W.step(DT); return W; }
/** Sam standing on the corridor face of the (shut, unlocked) break-room north door, square to it, in reach */
async function atShutDoor(seed: number, crouch = false) {
  const W = await world(seed); const { game } = W; game.guards.forEach((o: any, i: number) => park(o, i));
  const d = game.doors.byName('breakroom_n'); d.reset();
  game.teleportPlayer([30.6, 0, 11.45]); game.player.crouch = crouch; game.player.char.bodyYaw = 0; W.step(DT); W.step(DT);
  return { W, game, d, input: W.input };
}
/** Sam on the corridor face of the (locked) storage door at its work spot; `key` puts the floor key in his pocket first */
async function atLockedDoor(seed: number, crouch: boolean, key = false) {
  const W = await world(seed); const { game } = W; game.guards.forEach((o: any, i: number) => park(o, i));
  const d = game.doors.byName('storage'); d.reset(); if (key) game.player.keys.add('floor');
  const spot = game.doors.workSpot(d, [32.6, 0, 10.9]);
  game.teleportPlayer([spot.pos[0] + 0.1, 0, spot.pos[2] + 0.1]); game.player.crouch = crouch; W.step(DT); W.step(DT);
  return { W, game, d, input: W.input };
}
/** A (Kowalski) planted mid-corridor facing east, calm and rooted; Sam crouched 0.8 m behind him, holstered or drawn; the cursor on him */
async function behindGuard(seed: number, drawn = false) {
  const W = await world(seed); const { game } = W; const [A, B, C] = game.guards;
  place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; A.hold = true; park(B, 0); park(C, 1);
  game.player.slot = 'pistol'; game.player.holstered = !drawn;
  game.teleportPlayer([13.2, 0, 11.2]); game.player.crouch = true; W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); game.player.visibility = 0.02;
  W.cursorAt(v3.add(A.char.pos, [0, 1.35, 0])); W.step(DT);
  return { W, game, A, input: W.input };
}
/** …and grabbed (the row tapped), stepped to the hold proper */
async function holding(seed: number, drawn = false) {
  const S = await behindGuard(seed, drawn); const { W, game } = S;
  tapVerb(W, 'guard', 'grab'); for (let i = 0; i < 120 && game.player.holding?.phase !== 'held'; i++) W.step(DT); W.step(DT);
  return S;
}

// ================================================================ (a) the rows: what is on offer, thing by thing, in which order, MAX_NEAR of them
export async function selectorRows() {
  console.log('\n=== selector-rows: every verb its own row — [push, ease] on a shut door, [pick, kick] on a lock (crouched + the handle), [unlock, ease] keyed, [grab, push, ease] behind a man by a door, [question, choke] in the arm, [whip] with the gun at his head, the body / the rack / the breaker ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const want = (game: any, exp: string[], fails: string[], tag: string) => { const got = verbsOf(game); if (got.join(',') !== exp.join(',')) fails.push(`${tag}: rows [${got.join(', ')}], want [${exp.join(', ')}]`); return got; };
  {   // doors
    const fails: string[] = []; const notes: string[] = [];
    { const { W, game, d } = await atShutDoor(101); notes.push(`shut: ${want(game, ['door:push', 'door:ease'], fails, 'shut door').join('/')}`);
      if (game.hover?.verb !== 'push' || game.player.nearSel !== 0) fails.push(`default highlight ${game.hover?.verb} @${game.player.nearSel} (want row 0, push)`);
      const m = game.interactables.find((x: any) => x.door === d); if (!m || !/^Space {2}push it open {2}· {2}Space {2}ease it open/.test(m.line2) || m.verb) notes.push(`(marker "${m?.line2}")`);
      d.angle = 0.45; d.latched = false; d.place(); W.step(DT); notes.push(`ajar 0.45: ${want(game, ['door:pull', 'door:ease'], fails, 'ajar door').join('/')}`);
      d.angle = 1.2; d.place(); W.step(DT); notes.push(`open 1.2: ${want(game, ['door:pull'], fails, 'open door').join('/')}`);
      game.player.sprinting = true; W.step(DT); if (game.nearby.length) fails.push(`sprinting past it: rows [${verbsOf(game).join(', ')}] (want none — reach wants the feet under him)`); }
    { const { game } = await atLockedDoor(102, false); notes.push(`locked standing: ${want(game, ['door:pick', 'door:kick'], fails, 'locked, standing').join('/')}`);
      const kick = game.nearby.find((r: any) => r.verb === 'kick'); if (!/LOUD/.test(kick?.line2 ?? '') || !/or sprint into it/.test(kick?.line2 ?? '')) fails.push(`kick row "${kick?.line2}" (want LOUD + the sprint hint)`);
      const pick = game.nearby.find((r: any) => r.verb === 'pick'); if (!/quiet/.test(pick?.line2 ?? '')) fails.push(`pick row "${pick?.line2}"`); }
    { const { game } = await atLockedDoor(103, true); notes.push(`locked crouched: ${want(game, ['door:pick', 'door:rattle', 'door:kick'], fails, 'locked, crouched').join('/')}`); }
    { const { game } = await atLockedDoor(104, false, true); notes.push(`keyed: ${want(game, ['door:unlock', 'door:ease'], fails, 'locked WITH the key').join('/')}`);
      const m = game.interactables.find((x: any) => x.door === game.doors.byName('storage')); if (!/you have the key/.test(m?.line1 ?? '')) fails.push(`keyed marker "${m?.line1}"`); }
    verdict(fails.length === 0, 'doors: shut → [push, ease] (push highlighted); ajar → [pull, ease]; open → [pull]; locked → [pick, kick] (+ try the handle crouched); keyed → [unlock, ease]; sprinting → nothing', notes.join(' · '), fails);
  }
  {   // a man behind + a shut door in reach: [grab, push, ease] — the man first (priority), MAX_NEAR in all; the grab row's hints by hand; refused under a counter top
    const fails: string[] = []; const notes: string[] = [];
    { const W = await world(111); const { game } = W; const [A, B, C] = game.guards; park(B, 0); park(C, 1);
      const d = game.doors.byName('breakroom_n'); d.reset(); place(A, [30.6, 0, 11.75], 0); A.hold = true; A.heardUpTo = 1e12;
      game.player.holstered = true; game.teleportPlayer([30.6, 0, 10.95]); game.player.crouch = true; W.step(DT); W.step(DT);
      notes.push(`man + door: ${want(game, ['guard:grab', 'door:push', 'door:ease'], fails, 'guard behind + shut door').join('/')}`);
      if (game.nearby.length > MAX_NEAR) fails.push(`${game.nearby.length} rows (MAX_NEAR ${MAX_NEAR})`);
      const gr = game.nearby[0]; if (!/^Space {2}grab him {2}· {2}LMB {2}takedown — silent$/.test(gr?.line2 ?? '')) fails.push(`holstered grab row "${gr?.line2}"`);
      game.player.holstered = false; game.player.slot = 'pistol'; W.step(DT); const g2 = game.nearby[0]?.line2 ?? ''; if (!/pistol to his head/.test(g2) || !/E {2}holster/.test(g2)) fails.push(`drawn grab row "${g2}"`); notes.push(`drawn: "${g2}"`);
      game.player.slot = 'smoke'; W.step(DT); const g3 = game.nearby[0]?.line2 ?? ''; if (/pistol/.test(g3) || !/E {2}holster/.test(g3)) fails.push(`canister-up grab row "${g3}"`); }
    { // under the reception counter's north overhang, crouched, a man just north of it with his back to Sam: the grab is withheld (no room to stand into it) and startGrab refuses
      const W = await world(112); const { game } = W; const [A, B, C] = game.guards; park(B, 0); park(C, 1);
      place(A, [8.2, 0, 13.72], Math.PI); A.hold = true; A.heardUpTo = 1e12;   // facing north, his back to the counter
      game.player.holstered = true; game.teleportPlayer([8.2, 0, 14.3]); game.player.crouch = true; W.step(DT);
      game.player.char.pos = [8.2, 0, 14.42]; game.player.safe = [8.2, 0, 14.42]; game.player.char.update(0); W.step(DT);   // tucked right under the lip (the teleport's own settle is standing height and stands him off it)
      const canStand = playerMod.canStand(game); const rows = verbsOf(game); const marker = game.interactables.find((x: any) => x.kind === 'guard' && x.guard === A);
      playerMod.startGrab(game, A); const grabbed = !!game.player.holding;
      const p = game.player.char.pos, q = v3.copy(p); game.col.collideCircle(q, 0.42, 0.2, 1.7, 3); const popped = v3.distXZ(q, p);
      notes.push(`under the counter: canStand ${canStand}, rows [${rows.join(',') || 'none'}], marker "${marker?.line2}", startGrab → holding ${grabbed}`);
      if (canStand) fails.push('staging: canStand() is true under the counter lip (moved?)');
      else { if (rows.includes('guard:grab')) fails.push('the grab row is offered where he cannot stand up into it'); if (!/no room to stand/.test(marker?.line2 ?? '')) fails.push(`marker does not say why: "${marker?.line2}"`); if (grabbed) fails.push('startGrab took him from under the counter (the pair would stand into the slab)'); }
      if (grabbed && popped > 0.05) fails.push(`and popped ${f2(popped)} m out of the slab`); }
    verdict(fails.length === 0, 'a man behind + a shut door: [grab, push, ease], the man on top, three rows in all; the grab row names the hand (LMB takedown / pistol to his head / holster first); no grab from under a counter top', notes.join(' · '), fails);
  }
  {   // held: arm → [question, choke]; gun → [whip]; the grab beat and a chosen choke are status / running rows
    const fails: string[] = []; const notes: string[] = [];
    { const S = await behindGuard(121, false); const { W, game } = S;
      tapVerb(W, 'guard', 'grab'); W.step(DT); const during = verbsOf(game); if (during.join() !== 'held:—') fails.push(`during the grab beat: [${during.join(', ')}] (want the one status row)`);   // (the grab lands in the tap frame's door pass, after its rows were built: read the next frame's)
      for (let i = 0; i < 60; i++) W.step(DT);
      notes.push(`arm: ${want(game, ['held:question', 'held:choke'], fails, 'held (arm)').join('/')}`);
      const q = game.nearby[0], c = game.nearby[1];
      if (!/^Space {2}“make him talk”$/.test(q?.line2 ?? '')) fails.push(`question row "${q?.line2}"`); if (!/^Space {2}choke him out — quiet {2}· {2}E {2}draw — gun to his head$/.test(c?.line2 ?? '')) fails.push(`choke row "${c?.line2}"`);
      if (game.hover?.verb !== 'question') fails.push(`highlight on ${game.hover?.verb} (want the question: a tap talks)`);
      tapVerb(W, 'held', 'choke'); const chosen = verbsOf(game); W.step(DT); const chosen2 = verbsOf(game);
      if (chosen2.join() !== 'held:choke*') fails.push(`after choosing the choke: [${chosen2.join(', ')}] (want the running row alone)`); notes.push(`choke chosen → [${chosen.join(',')}] → [${chosen2.join(',')}] "${game.nearby[0]?.line2}"`); }
    { const S = await holding(122, true); const { game } = S;
      notes.push(`gun: ${want(game, ['held:whip'], fails, 'held (gun)').join('/')}`);
      const w = game.nearby[0]?.line2 ?? ''; if (!/^Space {2}pistol-whip him/.test(w) || !/LMB {2}fire past him/.test(w) || !/E {2}holster — to question him/.test(w) || /“/.test(w)) fails.push(`whip row "${w}" (want the whip, the click and E to holster as hints, no question)`); }
    verdict(fails.length === 0, 'held: the grab beat is a status row; arm → [question (highlighted), choke]; a choke chosen becomes the one running row; gun → [whip] with LMB / E hints and no question', notes.join(' · '), fails);
  }
  {   // body / rack / breaker
    const fails: string[] = []; const notes: string[] = [];
    { const W = await world(131); const { game } = W; const A = game.guards[0]; game.guards.forEach((o: any, i: number) => park(o, i)); place(A, [20, 0, 15.6], 0); killGuard(game, A, [1, 0, 0], true); for (let i = 0; i < 90; i++) W.step(DT);
      const hips = A.char.bones.hips; game.teleportPlayer([hips[0] + 0.6, 0, hips[2] + 0.4]); W.step(DT); W.step(DT);
      notes.push(`body: ${want(game, ['body:drag'], fails, 'body').join('/')}`); tap(W); for (let i = 0; i < 10; i++) W.step(DT);
      if (game.player.dragging !== A) fails.push('the drag row did not take hold'); notes.push(`dragging: ${want(game, ['body:drop'], fails, 'dragging').join('/')} "${game.nearby[0]?.line2}"`);
      tap(W); W.step(DT); if (game.player.dragging) fails.push('the drop row did not let go'); }
    { const W = await world(132); const { game, level } = W; game.guards.forEach((o: any, i: number) => park(o, i)); game.mission.stage = 'drive';
      game.teleportPlayer([level.mission.rack.front[0], 0, level.mission.rack.front[2] + 0.65]); game.player.crouch = false; W.step(DT); W.step(DT);
      notes.push(`rack: ${want(game, ['objective:drive'], fails, 'rack').join('/')}`); tap(W); W.step(DT);
      notes.push(`pulling: ${want(game, ['objective:drive*'], fails, 'pulling').join('/')} "${game.nearby[0]?.line2}"`); if (game.mission.driveT < 0) fails.push('the drive row did not start the pull'); }
    { const W = await world(133); const { game, level } = W; game.guards.forEach((o: any, i: number) => park(o, i)); const bp = level.breaker.pos;
      game.teleportPlayer([bp[0], 0, bp[2] - 0.7]); W.step(DT); W.step(DT);
      notes.push(`breaker: ${want(game, ['breaker:breakerOff'], fails, 'breaker').join('/')}`); tap(W); W.step(DT); if (!game.blackout.active) fails.push('throwing it did nothing');
      notes.push(`thrown: ${want(game, ['breaker:breakerOn'], fails, 'thrown').join('/')}`); tap(W); W.step(DT); if (game.blackout.active) fails.push('re-arming it did nothing');
      game.teleportPlayer([bp[0], 0, bp[2] + 0.75]); W.step(DT); W.step(DT); if (game.nearby.some((r: any) => r.kind === 'breaker')) fails.push('a breaker row through the wall from the corridor side'); }
    verdict(fails.length === 0, 'body → [drag] → [let go]; the rack → [pull the drive] → the running row; the breaker → [throw it] → [re-arm] (none through the wall)', notes.join(' · '), fails);
  }
  console.log(`=== selector-rows: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (b) the input model: tap = row 0; ↓ + tap = row 1; hold opens (flag, cancel row), the wheel moves the highlight and not the pace, release performs;
//                                                                    cancel + release = nothing; Esc = cancel; feet frozen while open; the wheel is the pace otherwise — during a hold too
export async function selectorInput() {
  console.log('\n=== selector-input: tap does the highlighted row, ↓ then tap the next; held 0.3 s the list opens (cancel row, feet still, wheel scrolls it), let go performs; cancel / Esc do nothing; the wheel is the pace whenever Space is up ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  {   // tap = push (row 0): the creak, the leaf swings; ↓ then tap = ease (row 1): silent, easing
    const fails: string[] = []; const notes: string[] = [];
    { const { W, game, d } = await atShutDoor(201); const ev: any[] = []; const t0 = game.time; W.input.pressed.add(IK); collect(W, 60, ev, t0);
      if (Math.abs(d.angle) < 0.8) fails.push(`tap: leaf at ${f2(d.angle)} after 1 s (want swung open)`); const bad = sameEvents(mine(ev), OLD_EVENTS.push); if (bad) fails.push('tap → push: ' + bad); notes.push(`tap → angle ${f2(d.angle)}, [${evS(ev)}]`); }
    { const { W, game, d } = await atShutDoor(202); W.input.pressed.add('ArrowDown'); W.step(DT); const hv = game.hover?.verb; const ev: any[] = []; const t0 = game.time; W.input.pressed.add(IK); collect(W, 30, ev, t0);
      if (hv !== 'ease') fails.push(`↓ moved the highlight to ${hv} (want ease)`); if (game.player.easing !== d) fails.push('↓ + tap did not start easing'); if (mine(ev).length) fails.push(`↓ + tap → ease made noise: [${evS(ev)}]`); if (!(Math.abs(d.angle) > 0.1 && Math.abs(d.angle) < 0.5)) fails.push(`easing: ${f2(d.angle)} after 0.5 s`);
      W.input.pressed.add('ArrowUp'); W.step(DT); notes.push(`↓ → ${hv}, tap → easing ${game.player.easing === d} (${f2(d.angle)} rad @0.5 s), rows now [${verbsOf(game).join(',')}]; ↑ while it runs: sel ${game.player.nearSel}`); }
    verdict(fails.length === 0, 'tap does row 0 (push: the creak, it swings); ↓ then tap does row 1 (ease: silent, the leaf inches)', notes.join(' · '), fails);
  }
  {   // hold: opens at TAP_SECS with the cancel row, hover still row 0; wheel +1 → row 1, pace untouched; wheel back; release performs the highlighted (row 0 → push)
    const fails: string[] = []; const notes: string[] = [];
    const { W, game, d } = await atShutDoor(211); const pace0 = game.player.pace;
    W.input.keys.add(IK); W.input.pressed.add(IK);
    let openAt = -1; for (let i = 0; i < Math.round(0.4 / DT); i++) { W.step(DT); if (openAt < 0 && game.player.sel.open) openAt = (i + 1) * DT; }
    const rowsOpen = verbsOf(game); const hv0 = game.hover?.verb;
    if (openAt < 0 || Math.abs(openAt - TAP_SECS) > DT + 1e-6) fails.push(`the list opened at +${f3(openAt)} s (want TAP_SECS ${TAP_SECS})`);
    if (rowsOpen.join() !== 'door:push,door:ease,cancel') fails.push(`open rows [${rowsOpen.join(', ')}] (want push, ease, cancel)`);
    if (hv0 !== 'push') fails.push(`opening moved the highlight to ${hv0}`);
    if (Math.abs(d.angle) > 1e-6 || game.player.easing) fails.push('something happened on the press itself');
    W.input.wheel = 120; W.step(DT); const hv1 = game.hover?.verb, pace1 = game.player.pace;
    W.input.wheel = 120; W.step(DT); const hv2 = game.hover?.kind === 'cancel' ? 'cancel' : game.hover?.verb;
    W.input.wheel = -120; W.step(DT); W.input.wheel = -120; W.step(DT); const hv3 = game.hover?.verb;
    if (hv1 !== 'ease' || hv2 !== 'cancel' || hv3 !== 'push') fails.push(`wheel: +1 → ${hv1}, +1 → ${hv2}, −2 → ${hv3} (want ease, cancel, push)`);
    if (pace1 !== pace0) fails.push(`the wheel with Space down changed the pace ${pace0} → ${pace1}`);
    // feet frozen while open: W held half a second moves him nowhere
    const p0 = v3.copy(game.player.char.pos); W.input.keys.add('KeyS'); for (let i = 0; i < 30; i++) W.step(DT); W.input.keys.delete('KeyS'); const drift = v3.distXZ(game.player.char.pos, p0);
    if (drift > 0.02) fails.push(`walked ${f2(drift)} m with the list open`);
    // release: performs the highlighted (push)
    const ev: any[] = []; const t0 = game.time + DT; W.input.keys.delete(IK); collect(W, 60, ev, t0 - DT);
    if (game.player.sel.open || game.nearby.some((r: any) => r.kind === 'cancel')) fails.push('the list stayed open after Space came up');
    if (Math.abs(d.angle) < 0.8) fails.push(`release on 'push': leaf ${f2(d.angle)} (want swung)`); const bad = sameEvents(mine(ev), OLD_EVENTS.push); if (bad) fails.push('release → push: ' + bad);
    notes.push(`open +${f3(openAt)} s [${rowsOpen.join(',')}] hv ${hv0}; wheel → ${hv1} → ${hv2} → ${hv3}, pace ${pace0}→${pace1}; S held while open: ${f3(drift)} m; release → angle ${f2(d.angle)} [${evS(ev)}]`);
    verdict(fails.length === 0, 'held: opens at TAP_SECS with the cancel row, highlight unmoved; the wheel walks it (push → ease → cancel → back) and leaves the pace alone; feet frozen; letting go performs the highlighted row', notes.join(' · '), fails);
  }
  {   // hold, wheel to 'ease', release → easing (the scroll-and-let-go path); hold, wheel to cancel, release → nothing; Esc while open → nothing on release, and the press is spent
    const fails: string[] = []; const notes: string[] = [];
    { const { W, game, d } = await atShutDoor(221); W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 5; i++) W.step(DT); W.input.wheel = 100; W.step(DT);
      const openedEarly = game.player.sel.open; const hv = game.hover?.verb; W.input.keys.delete(IK); const ev: any[] = []; const t0 = game.time; collect(W, 40, ev, t0);
      if (!openedEarly) fails.push('a scroll 0.1 s into the press did not open the list (a press that scrolls is a choice, never a tap)'); if (hv !== 'ease') fails.push(`scrolled to ${hv}`);
      if (game.player.easing !== d || mine(ev).length) fails.push(`scroll to ease + let go: easing ${game.player.easing === d}, events [${evS(ev)}]`); notes.push(`hold 0.1 s + wheel → open ${openedEarly}, ${hv}; let go → easing ${game.player.easing === d}`); }
    { const { W, game, d } = await atShutDoor(222); W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 20; i++) W.step(DT);
      W.input.wheel = 100; W.step(DT); W.input.wheel = 100; W.step(DT); const onCancel = game.hover?.kind === 'cancel';
      W.input.keys.delete(IK); const ev: any[] = []; const t0 = game.time; collect(W, 60, ev, t0);
      if (!onCancel) fails.push(`two notches down landed on ${game.hover?.kind}/${game.hover?.verb} (want the cancel row)`);
      if (Math.abs(d.angle) > 1e-6 || game.player.easing || mine(ev).length || game.act) fails.push(`cancel + let go DID something: angle ${f3(d.angle)}, easing ${!!game.player.easing}, events [${evS(ev)}]`);
      if (game.player.nearSel !== 0 || game.hover?.verb !== 'push') fails.push(`after cancelling the highlight is ${game.hover?.verb} @${game.player.nearSel} (want back on row 0)`);
      notes.push(`cancel + release → angle ${f3(d.angle)}, [${evS(ev)}], highlight ${game.hover?.verb}`); }
    { const { W, game, d } = await atShutDoor(223); W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 20; i++) W.step(DT); const wasOpen = game.player.sel.open;
      W.input.pressed.add('Escape'); W.step(DT); const openAfterEsc = game.player.sel.open, spent = game.player.fHeld;
      for (let i = 0; i < 10; i++) W.step(DT); W.input.keys.delete(IK); const ev: any[] = []; const t0 = game.time; collect(W, 40, ev, t0);
      if (!wasOpen) fails.push('staging: not open at 0.33 s'); if (openAfterEsc || !spent) fails.push(`Esc: open ${openAfterEsc}, spent ${spent} (want shut, the press spent)`);
      if (Math.abs(d.angle) > 1e-6 || game.player.easing || mine(ev).length) fails.push(`Esc then let go DID something: angle ${f3(d.angle)}, [${evS(ev)}]`);
      if (game.player.fHeld) fails.push('the spent flag outlived the key coming up');
      tap(W); for (let i = 0; i < 30; i++) W.step(DT); if (Math.abs(d.angle) < 0.5) fails.push('a fresh tap after the Esc did nothing (Space never came live again)');
      notes.push(`Esc while open → shut ${!openAfterEsc}, spent ${spent}; let go → nothing; a fresh tap → angle ${f2(d.angle)}`); }
    verdict(fails.length === 0, 'hold + scroll + let go performs the scrolled-to row (an early scroll opens it); scrolled to cancel, letting go does nothing and the highlight is back on top; Esc while open backs out — the release does nothing, the next tap works', notes.join(' · '), fails);
  }
  {   // the wheel with Space up is the pace — free, and with a man in the arm (the pair's HOLD_PACE × pace); Space down but spent: neither
    const fails: string[] = []; const notes: string[] = [];
    { const { W, game } = await atShutDoor(231); const p0 = game.player.pace; W.input.wheel = 100; W.step(DT); const p1 = game.player.pace; W.input.wheel = -100; W.step(DT); const p2 = game.player.pace;
      if (Math.abs(p1 - (p0 - PACE_STEP)) > 1e-9 || Math.abs(p2 - p0) > 1e-9) fails.push(`free: pace ${p0} → ${p1} → ${p2} (want −${PACE_STEP} then back)`); notes.push(`free: ${f2(p0)}→${f2(p1)}→${f2(p2)}`); }
    { const S = await holding(232, false); const { W, game } = S; const p0 = game.player.pace; W.input.wheel = 100; W.step(DT); W.input.wheel = 100; W.step(DT); const p1 = game.player.pace;
      W.input.keys.add('KeyW'); let top = 0; for (let i = 0; i < 90; i++) { W.step(DT); top = Math.max(top, game.player.speedSm); } W.input.keys.delete('KeyW');
      if (Math.abs(p1 - (p0 - 2 * PACE_STEP)) > 1e-9) fails.push(`holding: pace ${p0} → ${p1} after two notches (want −${2 * PACE_STEP}: the wheel is live in a hold)`);
      if (top > 0.85 * p1 + 0.03 || top < 0.2) fails.push(`the pair walked at ${f2(top)} m/s (want ≤ HOLD_PACE × pace = ${f2(0.85 * p1)}, and moving)`);
      if (!game.player.holding) fails.push('the hold ended'); notes.push(`holding: ${f2(p0)}→${f2(p1)}, pair top speed ${f2(top)} m/s`); }
    verdict(fails.length === 0, 'the wheel is his pace whenever Space is up — with a man in the arm too, and the pair slows with it', notes.join(' · '), fails);
  }
  console.log(`=== selector-input: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) the sustained verbs: start on the row, run on their own, stop on Space / a step / Esc — each timed against the held-key build
export async function selectorSustained() {
  console.log('\n=== selector-sustained: ease runs to EASE_MAX at the old crack rate and stops where a step catches it; the pick clicks through 4.2 s untouched and keeps its progress when broken off; the choke lands at chokeHold + choke and eases off on a tap; the whip lands; the drive comes out at DRIVE_SECS and lets go on a step; nothing else starts meanwhile ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  {   // ease: tapped, the leaf comes round at OLD_CRACK.perFrame a frame from the very next frame (no 0.233 s threshold any more), passes the old 0.605 cap and stands at EASE_MAX on its own; the rows come back after; the closer wakes later
    const fails: string[] = []; const notes: string[] = [];
    const { W, game, d } = await atShutDoor(301);
    tapVerb(W, 'door', 'ease');   // (act this frame; the leaf moves from the next updateDoors on: this frame's already ran the start)
    const curve: number[] = []; let doneAt = -1; const t0 = game.time; const ev: any[] = [];
    collect(W, 60 * 5, ev, t0, i => { curve.push(Math.abs(d.angle)); if (doneAt < 0 && !game.player.easing) doneAt = (i + 1) * DT; });
    // slope over the first second against the old per-frame step; the frame it crosses the old cap; where it ends
    const steps = curve.slice(1, 61).map((a, i) => a - curve[i]); const meanStep = steps.reduce((s, x) => s + x, 0) / steps.length; const worst = Math.max(...steps.map(s => Math.abs(s - OLD_CRACK.perFrame)));
    const crossOld = curve.findIndex(a => a >= 0.6) + 1; const wantCross = Math.ceil(0.6 / OLD_CRACK.perFrame);
    if (Math.abs(meanStep - OLD_CRACK.perFrame) > 1e-4 || worst > 1e-4) fails.push(`per-frame step ${meanStep.toFixed(5)} (worst dev ${worst.toFixed(5)}) vs the old crack's ${OLD_CRACK.perFrame.toFixed(5)} rad`);
    if (Math.abs(crossOld - wantCross) > 1) fails.push(`crossed 0.6 rad at frame ${crossOld} (want ${wantCross}: 0.55 rad/s from the tap, the old curve less its 0.233 s hold threshold)`);
    if (doneAt < 0) fails.push('never finished in 5 s'); else { if (Math.abs(Math.abs(d.angle) - EASE_MAX) > OLD_CRACK.perFrame + 1e-6 && Math.abs(d.angle) < EASE_MAX) fails.push(`stood at ${f3(Math.abs(d.angle))} (want EASE_MAX ${EASE_MAX})`); if (Math.abs(doneAt - EASE_MAX / EASE_RATE) > 3 * DT) fails.push(`done at +${f2(doneAt)} s (want ${f2(EASE_MAX / EASE_RATE)})`); }
    if (mine(ev).length) fails.push(`noise while easing: [${evS(ev)}]`);
    if (verbsOf(game).join() !== 'door:pull') fails.push(`rows after it stood open: [${verbsOf(game).join(', ')}] (want [pull])`);
    const angleDone = d.angle; for (let i = 0; i < 60 * 5; i++) W.step(DT); const closing = Math.abs(d.angle) < Math.abs(angleDone) - 0.05;
    if (!closing) fails.push(`the closer never woke: still ${f2(d.angle)} 5 s after (crack leaves quietT at −1.5: it should take it ~3.5 s on)`);
    notes.push(`step ${meanStep.toFixed(5)} rad/frame (old ${OLD_CRACK.perFrame.toFixed(5)}), crossed 0.6 at frame ${crossOld} (old cap ${OLD_CRACK.cap} reached at frame ${wantCross} of work), done +${f2(doneAt)} s at ${f3(Math.abs(angleDone))} rad; 5 s on: ${f2(d.angle)}`);
    verdict(fails.length === 0, 'ease: from the tap the leaf comes round at exactly the old crack rate, through the old 0.6 stop, and stands at EASE_MAX on its own in EASE_MAX / EASE_RATE s, silent; the closer takes it back later', notes.join(' · '), fails);
  }
  {   // ease stopped: a step (W pressed into it) mid-way holds the leaf where it is; a second Space tap likewise; Esc likewise; walking out of reach drops it
    const fails: string[] = []; const notes: string[] = [];
    for (const how of ['step', 'space', 'esc'] as const) {
      const { W, game, d } = await atShutDoor(311); tapVerb(W, 'door', 'ease'); for (let i = 0; i < 40; i++) W.step(DT);
      const aStop = d.angle; if (how === 'step') { W.input.keys.add('KeyD'); W.input.pressed.add('KeyD'); } else if (how === 'space') W.input.pressed.add(IK); else W.input.pressed.add('Escape');
      W.step(DT); const stopped = !game.player.easing; W.input.keys.delete('KeyD'); for (let i = 0; i < 30; i++) W.step(DT);
      const held = Math.abs(d.angle - aStop) < (how === 'step' ? 0.02 : 1e-6);   // (a step sideways may brush the leaf a hair through his own contact; Space / Esc touch nothing)
      if (!stopped) fails.push(`${how}: still easing`); if (!held) fails.push(`${how}: the leaf went on ${f3(aStop)} → ${f3(d.angle)}`);
      if (how === 'space' && (game.player.sel.downT >= 0 || game.act)) fails.push('space: the stopping tap armed / performed something');
      notes.push(`${how} @0.67 s → stopped ${stopped} at ${f3(aStop)} (now ${f3(d.angle)})`);
    }
    verdict(fails.length === 0, 'ease stopped mid-way by a step / a Space tap / Esc: the leaf stays exactly where it got to', notes.join(' · '), fails);
  }
  {   // pick: tapped standing-or-crouched it plants him and clicks through on the OLD rhythm re-based to the plant (six 0.16 clicks, the 0.30 snap at +4.32), nothing else on offer while it runs, a Space tap
      // then only breaks off; a key held INTO it does not stop it, the same key pressed afresh does; broken off after 1.767 s of work it keeps 0.397 with two clicks (the old early release exactly); Esc breaks off too
    const fails: string[] = []; const notes: string[] = [];
    { const { W, game, d } = await atLockedDoor(321, true); const ev: any[] = []; const t0 = game.time + DT;   // (re-based to the frame the plant begins: the tap's own)
      W.input.keys.add('KeyW');   // held INTO the pick: it must not count (he plants; the key was down before the verb began)
      tapVerb(W, 'door', 'pick'); const planted = game.player.picking === d;
      let rowsMid = ''; collect(W, 60 * 6, ev, t0, i => { if (i === 120) rowsMid = verbsOf(game).join(','); });
      W.input.keys.delete('KeyW');
      const bad = sameEvents(mine(ev).filter(e => e.kind === 'door'), OLD_EVENTS.pick, 0.05);
      if (!planted) fails.push('the pick row did not plant him'); if (bad) fails.push('pick clicks: ' + bad); if (d.locked) fails.push('still locked after 6 s');
      if (rowsMid !== 'door:pick*') fails.push(`rows 2 s in: [${rowsMid}] (want the running pick alone — nothing else starts meanwhile)`);
      if (game.player.picking) fails.push('still picking after it opened'); notes.push(`W held into it: planted ${planted}, unlocked ${!d.locked}, [${evS(mine(ev))}], rows mid [${rowsMid}]`); }
    { const { W, game, d } = await atLockedDoor(322, true); const ev: any[] = []; const t0 = game.time + DT; tapVerb(W, 'door', 'pick');   // (t0 = the plant's frame, as above)
      collect(W, Math.round(OLD_EVENTS.pickAbort.secsOfWork / DT), ev, t0);
      W.input.keys.add('KeyS'); W.input.pressed.add('KeyS'); W.step(DT); const stopped = !game.player.picking; W.input.keys.delete('KeyS'); collect(W, 30, ev, t0);
      const bad = sameEvents(mine(ev).filter(e => e.kind === 'door'), OLD_EVENTS.pickAbort.events, 0.05);
      if (!stopped) fails.push('a fresh S did not break the pick off'); if (Math.abs(d.pick - OLD_EVENTS.pickAbort.pick) > 0.012) fails.push(`kept ${f3(d.pick)} of the cylinder (old early release: ${OLD_EVENTS.pickAbort.pick})`); if (bad) fails.push('broken-off pick: ' + bad);
      if (!game.player.crouch) fails.push('stood up on breaking off (a pick leaves you on the knee)'); notes.push(`step @${OLD_EVENTS.pickAbort.secsOfWork} s → stopped ${stopped}, pick ${f3(d.pick)}, [${evS(mine(ev))}]`); }
    { const { W, game, d } = await atLockedDoor(323, true); tapVerb(W, 'door', 'pick'); for (let i = 0; i < 90; i++) W.step(DT);
      const before = d.pick; W.input.pressed.add(IK); W.step(DT); const stoppedSpace = !game.player.picking; const startedElse = game.player.kick || game.player.easing || game.act;
      for (let i = 0; i < 5; i++) W.step(DT); tapVerb(W, 'door', 'pick'); for (let i = 0; i < 60; i++) W.step(DT); const resumed = game.player.picking === d && d.pick > before;
      W.input.pressed.add('Escape'); W.step(DT); const stoppedEsc = !game.player.picking;
      if (!stoppedSpace || startedElse) fails.push(`Space mid-pick: stopped ${stoppedSpace}, started something ${!!startedElse}`); if (!resumed) fails.push('the pick did not resume from its kept progress on the next tap'); if (!stoppedEsc) fails.push('Esc did not break it off');
      notes.push(`Space @1.5 s → stopped ${stoppedSpace}; re-tap → resumed ${resumed} (${f2(before)} → ${f2(d.pick)}); Esc → stopped ${stoppedEsc}`); }
    verdict(fails.length === 0, 'pick: plants and clicks through on the old rhythm (six clicks, the snap at +4.32 s of work), the only row while it runs; a key held into it is nothing, a fresh step / Space / Esc breaks off with the progress kept (0.397 and two clicks at the old release point), and the next tap picks up from there', notes.join(' · '), fails);
  }
  {   // the choke: chosen on its row it goes on at chokeHold and lands at chokeHold + choke exactly as the held key did (events frozen), the man out cold breathing; a tap mid-choke eases off (held, alive,
      // abortT, the line); un-chosen inside the commit beat: silent, nothing felt; a step mid-choke eases off too; the whip lands at chokeHold + whip with its 0.35 crack
    const fails: string[] = []; const notes: string[] = [];
    { const S = await holding(331, false); const { W, game, A } = S; const ev: any[] = []; const t0 = game.time; let chokeAt = -1, deadAt = -1;
      game.selectVerb('held', 'choke'); W.input.pressed.add(IK);   // (the tap's own frame is the first collected below: t0 = the frame before it, as the frozen numbers were taken)
      collect(W, 60 * 4, ev, t0, () => { if (chokeAt < 0 && game.player.holding?.phase === 'choke') chokeAt = game.time - t0; if (deadAt < 0 && A.state === 'dead') deadAt = game.time - t0; });
      const bad = sameEvents(mine(ev), OLD_EVENTS.choke, 0.03);
      if (Math.abs(chokeAt - HOLD.secs.chokeHold) > 0.02) fails.push(`the arm closed at +${f3(chokeAt)} (want chokeHold ${HOLD.secs.chokeHold})`); if (Math.abs(deadAt - (HOLD.secs.chokeHold + HOLD.secs.choke)) > 0.03) fails.push(`out at +${f3(deadAt)} (want ${f2(HOLD.secs.chokeHold + HOLD.secs.choke)})`);
      if (bad) fails.push('choke events: ' + bad); if (A.downKind !== 'choked' || !isBreathing(A)) fails.push(`A ${A.state}/${A.downKind} breathing ${isBreathing(A)}`); if (game.player.holding) fails.push('still holding');
      notes.push(`choke: on +${f3(chokeAt)}, out +${f3(deadAt)} ${A.downKind}, [${evS(mine(ev))}]`); }
    { const S = await holding(332, false); const { W, game, A } = S; const ev: any[] = []; const t0 = game.time; tapVerb(W, 'held', 'choke'); collect(W, 89, ev, t0);
      W.input.pressed.add(IK); collect(W, 1, ev, t0); const H = game.player.holding; collect(W, 30, ev, t0);
      const bad = sameEvents(mine(ev), OLD_EVENTS.chokeAbort, 0.03);
      if (H?.phase !== 'held' || A.state === 'dead' || A.talk.abortT < 0) fails.push(`tap @1.5 s: phase ${H?.phase}, A ${A.state}, abortT ${f2(A.talk.abortT)} (want held, alive, rattled)`); if (bad) fails.push('eased-off events: ' + bad);
      if (!game.messages.some((m: any) => /eased off/.test(m.text))) fails.push('no eased-off line'); if (verbsOf(game).join() !== 'held:question,held:choke') fails.push(`rows after easing off: [${verbsOf(game).join(',')}]`);
      notes.push(`tap mid-choke → ${H?.phase}, abortT ${f2(A.talk.abortT)}, [${evS(mine(ev))}]`); }
    { const S = await holding(333, false); const { W, game, A } = S; tapVerb(W, 'held', 'choke'); for (let i = 0; i < 10; i++) W.step(DT); const wind = game.player.holding?.windT ?? -1;
      W.input.pressed.add(IK); W.step(DT); for (let i = 0; i < 60; i++) W.step(DT); const H = game.player.holding;
      if (!(wind > 0)) fails.push(`staging: windT ${wind} 0.17 s after choosing`); if (H?.phase !== 'held' || H.windT !== -1 || A.talk.abortT >= 0 || game.messages.some((m: any) => /eased off/.test(m.text))) fails.push(`un-chosen in the commit beat: phase ${H?.phase} windT ${H?.windT} abortT ${A.talk.abortT} (want held, −1, never rattled, no line)`);
      if (game.events.some((e: any) => e.kind === 'prop' && e.level === 0.15)) fails.push('the arm went on anyway'); notes.push(`un-chosen @0.17 s (windT ${f2(wind)}) → ${H?.phase}, abortT ${A.talk.abortT}`); }
    { const S = await holding(334, false); const { W, game, A } = S; tapVerb(W, 'held', 'choke'); for (let i = 0; i < 60; i++) W.step(DT); const ph = game.player.holding?.phase;
      W.input.keys.add('KeyA'); W.input.pressed.add('KeyA'); W.step(DT); W.input.keys.delete('KeyA'); const H = game.player.holding; for (let i = 0; i < 30; i++) W.step(DT);
      if (ph !== 'choke') fails.push(`staging: ${ph} at 1 s`); if (H?.phase !== 'held' || A.state === 'dead' || A.talk.abortT < 0) fails.push(`a step mid-choke: ${H?.phase}, A ${A.state}, abortT ${A.talk.abortT}`); notes.push(`step mid-choke → ${H?.phase}`); }
    { const S = await holding(335, true); const { W, game, A } = S; const ev: any[] = []; const t0 = game.time; let whipAt = -1, deadAt = -1;
      tapVerb(W, 'held', 'whip'); collect(W, 120, ev, t0, () => { if (whipAt < 0 && game.player.holding?.phase === 'whip') whipAt = game.time - t0; if (deadAt < 0 && A.state === 'dead') deadAt = game.time - t0; });
      const bad = sameEvents(mine(ev), OLD_EVENTS.whip, 0.03);
      if (Math.abs(whipAt - HOLD.secs.chokeHold) > 0.02 || Math.abs(deadAt - (HOLD.secs.chokeHold + HOLD.secs.whip)) > 0.03) fails.push(`whip on +${f3(whipAt)} landed +${f3(deadAt)} (want ${HOLD.secs.chokeHold} / ${f2(HOLD.secs.chokeHold + HOLD.secs.whip)})`);
      if (bad) fails.push('whip events: ' + bad); if (A.downKind !== 'struck' || !isBreathing(A)) fails.push(`A ${A.state}/${A.downKind}`); notes.push(`whip: on +${f3(whipAt)}, landed +${f3(deadAt)} ${A.downKind}, [${evS(mine(ev))}]`); }
    verdict(fails.length === 0, 'choke: chosen → the arm at chokeHold, out at chokeHold + choke, the old events to the frame; a tap or a step mid-choke eases off (rattled); un-chosen inside the commit beat is nothing at all; the whip lands at chokeHold + whip with its crack', notes.join(' · '), fails);
  }
  {   // the drive: tapped it runs DRIVE_SECS by itself with the old clunk; a step lets go ('let go of the drive'), the row comes back and a second pull runs from zero
    const fails: string[] = []; const notes: string[] = [];
    { const W = await world(341); const { game, level } = W; game.guards.forEach((o: any, i: number) => park(o, i)); game.mission.stage = 'drive';
      game.teleportPlayer([level.mission.rack.front[0], 0, level.mission.rack.front[2] + 0.65]); game.player.crouch = false; W.step(DT); W.step(DT);
      const ev: any[] = []; const t0 = game.time; let doneAt = -1; tapVerb(W, 'objective', 'drive'); collect(W, Math.round((DRIVE_SECS + 1) / DT), ev, t0, () => { if (doneAt < 0 && game.mission.pulled) doneAt = game.time - t0; });
      const bad = sameEvents(mine(ev), OLD_EVENTS.drive, 0.03); if (bad) fails.push('drive: ' + bad); if (Math.abs(doneAt - DRIVE_SECS) > 0.05) fails.push(`out at +${f3(doneAt)} (want DRIVE_SECS ${DRIVE_SECS})`); notes.push(`pull → out +${f3(doneAt)}, [${evS(mine(ev))}]`); }
    { const W = await world(342); const { game, level } = W; game.guards.forEach((o: any, i: number) => park(o, i)); game.mission.stage = 'drive';
      game.teleportPlayer([level.mission.rack.front[0], 0, level.mission.rack.front[2] + 0.65]); game.player.crouch = false; W.step(DT); W.step(DT);
      tapVerb(W, 'objective', 'drive'); for (let i = 0; i < 60; i++) W.step(DT); const mid = game.mission.driveT;
      W.input.keys.add('KeyD'); W.input.pressed.add('KeyD'); W.step(DT); W.input.keys.delete('KeyD'); const after = game.mission.driveT; for (let i = 0; i < 20; i++) W.step(DT);
      if (!(mid > 0.9)) fails.push(`staging: driveT ${mid} at 1 s`); if (after !== -1) fails.push(`a step did not let go (driveT ${after})`); if (!game.messages.some((m: any) => /let go of the drive/.test(m.text))) fails.push('no let-go line');
      if (verbsOf(game).join() !== 'objective:drive' || game.mission.pulled) fails.push(`after letting go: rows [${verbsOf(game).join(',')}], pulled ${game.mission.pulled}`); notes.push(`step @1 s → driveT ${after}, rows [${verbsOf(game).join(',')}]`); }
    verdict(fails.length === 0, 'drive: runs DRIVE_SECS on its own with the old clunk; a step lets go and the row is back', notes.join(' · '), fails);
  }
  console.log(`=== selector-sustained: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (d) noise / witness identity: verb by verb, what the floor hears equals what the key path made it hear
export async function selectorNoise() {
  console.log('\n=== selector-noise: each verb tapped on its row emits exactly the GameEvents its key path did (kind, level, loudness, timing) — grab, question, kick, rattle, unlock, keyed ease, breaker ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const fails: string[] = []; const notes: string[] = [];
  const check = (tag: string, got: any[], want: any[], tol = 0.05) => { const bad = sameEvents(got, want, tol); if (bad) fails.push(`${tag}: ${bad}`); notes.push(`${tag} [${evS(got)}]`); };
  { const S = await behindGuard(401, false); const { W, game, A } = S; const ev: any[] = []; const t0 = game.time; game.selectVerb('guard', 'grab'); W.input.pressed.add(IK); collect(W, 60, ev, t0);
    check('grab', mine(ev), OLD_EVENTS.grab); if (game.player.holding?.g !== A) fails.push('grab: not holding');
    const ev2: any[] = []; const t1 = game.time; game.selectVerb('held', 'question'); W.input.pressed.add(IK); collect(W, 150, ev2, t1); check('question', mine(ev2), OLD_EVENTS.question); if (A.talk.stage !== 1) fails.push(`question: stage ${A.talk.stage}`); }
  { const { W, game, d } = await atLockedDoor(402, false); const ev: any[] = []; const t0 = game.time; game.selectVerb('door', 'kick'); W.input.pressed.add(IK); collect(W, 120, ev, t0);
    check('kick', mine(ev), OLD_EVENTS.kick); if (!d.lockBroken) fails.push('kick: keep not torn out'); }
  { const { W, game, d } = await atLockedDoor(403, true); const ev: any[] = []; const t0 = game.time; game.selectVerb('door', 'rattle'); W.input.pressed.add(IK); collect(W, 60, ev, t0);
    check('rattle', mine(ev), OLD_EVENTS.rattle); if (!d.latched || game.player.picking || game.player.kick) fails.push('rattle: more than a rattle'); if (!game.messages.some((m: any) => /^locked — pick it/.test(m.text))) fails.push('rattle: no hint line'); }
  { const { W, game, d } = await atLockedDoor(404, false, true); const ev: any[] = []; const t0 = game.time; game.selectVerb('door', 'unlock'); W.input.pressed.add(IK); collect(W, 90, ev, t0);
    check('unlock', mine(ev), OLD_EVENTS.unlock); if (!d.locked || Math.abs(d.angle) < 0.5) fails.push(`unlock: locked ${d.locked} angle ${f2(d.angle)} (want the lock merely turned, the leaf swung)`); }
  { const { W, game, d } = await atLockedDoor(405, false, true); const ev: any[] = []; const t0 = game.time; game.selectVerb('door', 'ease'); W.input.pressed.add(IK); collect(W, 120, ev, t0);
    check('keyed ease', mine(ev), OLD_EVENTS.ease); if (Math.abs(d.angle) < 0.5 || game.player.picking) fails.push(`keyed ease: angle ${f2(d.angle)} picking ${!!game.player.picking}`); }
  { const { W, game, d } = await atShutDoor(406); d.angle = 1.2; d.latched = false; d.place(); W.step(DT); const ev: any[] = []; const t0 = game.time; game.selectVerb('door', 'pull'); W.input.pressed.add(IK); collect(W, 120, ev, t0);
    check('pull', mine(ev), OLD_EVENTS.pull); if (Math.abs(d.angle) > 0.5) fails.push(`pull: angle ${f2(d.angle)} after 2 s`); }
  { const W = await world(407); const { game, level } = W; game.guards.forEach((o: any, i: number) => park(o, i)); const bp = level.breaker.pos; game.teleportPlayer([bp[0], 0, bp[2] - 0.7]); W.step(DT); W.step(DT);
    const ev: any[] = []; const t0 = game.time; W.input.pressed.add(IK); collect(W, 60, ev, t0); check('breaker', mine(ev), OLD_EVENTS.breaker); if (!game.blackout.active) fails.push('breaker: no blackout'); }
  verdict(fails.length === 0, 'grab 0.12 · question silent · kick 1.0! + the bang · rattle 0.12 · unlock 0.12 + 0.20 · keyed ease silent · pull silent · breaker silent — all as before', notes.join(' · '), fails);
  console.log(`=== selector-noise: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

export async function selectorAll() { const a = await selectorRows(); const b = await selectorInput(); const c = await selectorSustained(); const d = await selectorNoise(); return a && b && c && d; }
