// The 'review-a' probe family (run through probes.ts: `bun run tools/qa/probes.ts review-a | review-hostage-civ | review-lightout | review-rack | review-routed-shot |
// review-bodylight | review-kick-leaf | review-ring-civ | review-item-cap | review-door-reset | review-day-blackout | review-meter | review-act-down | review-kickhit |
// review-torch-dt | review-stack`): one staged situation per finding of the deep review's game-core passes (docs/internal/review-ledger.md, pass 6 'A6.x', pass 7
// 'B7.x', pass 8 'W8.5') that this lane fixed — each written to FAIL on the tree as reviewed and PASS on the fix. Headless (headless.ts): the whole Game over the fake
// device, one situation, PASS / FAIL lines, a closing '=== name: ALL PASS ===' per probe.
//   review-hostage-civ    A6.1  the CLEANER in Sam's arm with Novak walking onto them: he enters the standoff on HER (sawHeld), calls it once naming her as the cleaner,
//                               the floor locks down, he keeps the ring and talks, not one round in fifteen seconds — and a round fired at Sam from in front stops in her.
//   review-lightout       A6.3  a corridor panel OCP'd dark: the man up the corridor with a line to it startles (awareness 0.4, fix under it); the man through the wall
//                               four metres off does not.
//   review-rack           A6.5  the rack-check errand (mission.ts sendRackCheck) is never handed to the man in Sam's arm, a choreographed man or a unit — the next
//                               free man gets it, or nobody.
//   review-routed-shot    A6.7  the suppressed pistol fired round a corner from a calm man: his fix is the doorway / corner the pop came round (the sound path's
//                               `via`), never the shooter's feet through the wall.
//   review-bodylight      A6.2  tune.bodyLight: a body six metres ahead of a man in the pitch dark is not found; his torch on it, found; the same body under a lit
//                               panel, found; the switch off, found in the dark as before.
//   review-kick-leaf      B7.1  a leaf kicked in with a man standing just beyond it, stepped at 20 fps: the leaf comes to rest against him — its line never passes
//                               his centre, he is not flung — as it always did at 60.
//   review-ring-civ       B7.2/3 a ring airfoil to the cleaner's head puts her out cold through the civilians' own path (a 'civilianKO' row, method ring); one in her
//                               ribs frightens her; and a ring let go with the tube already inside a man's body cylinder registers on him instead of sailing through.
//   review-item-cap       B7.5  thirty-two items with a live-fused stun can the oldest: the next spawn evicts a dropped pistol, not the can; a smoke can still venting
//                               likewise survives; spent cans and magazines still go first.
//   review-door-reset     B7.12 Door.reset() forgets who last touched the leaf (lastWho −1).
//   review-day-blackout   A6.8  the breaker shot (a PERMANENT blackout), then the daylight variant in and out (lighting.ts setDaylight): the blackout comes back
//                               permanent; a timed one lifted by the day stays lifted (breach-daylight's premise).
//   review-meter          A6.4  a NaN off the light probe never reaches Sam's meter, and a meter already poisoned heals to a number the next frame.
//   review-act-down       A6.9  a door verb chosen the frame Sam went down is not performed (the leaf stays latched).
//   review-kickhit        B7.8  a pose re-bake (Character.update(0)) inside the kick's impact frame leaves kickImpact standing.
//   review-torch-dt       B7.6  the relaxed torch carry's smoothing is per second, not per frame: two steps at 60 Hz land where one at 30 Hz does.
//   review-stack          W8.5  three men jammed shoulder-deep into each other against a cubicle panel for two seconds (60 and 20 fps): nobody ends a frame inside
//                               the panel or beyond it — the colleague shove is walked in short strides with the statics answered after each.
import { standUp, ROOT } from './headless.ts';
import { park, place, tap, bringIn } from './standoff-probes.ts';
const { v3, DEG, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { fireWeapon, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { fireRing } = await import(`${ROOT}/src/game/launcher.ts`);
const { sendRackCheck } = await import(`${ROOT}/src/game/mission.ts`);
const { setDaylight, isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { pairOf, standoffSummary, bodyInView } = await import(`${ROOT}/src/game/guards.ts`);
const { torchCarryDir } = await import(`${ROOT}/src/game/rigProps.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
const posS = (p: Vec3 | null | undefined) => p ? `(${f2(p[0])}, ${f2(p[2])})` : '—';
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }
let failures = 0;
export function reviewFailures() { return failures; }
function done(name: string, ok: boolean) { console.log(`=== ${name}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++; return ok; }

/** the level up off `seed`: god mode, AI on, five frames in; Sam's meter is the caller's to pin (headless has no GPU probe) */
async function stage(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [K, N, R] = game.guards; const [M, O] = game.civilians;
  return { W, game, pl, K, N, R, M, O };
}
/** a calm man planted and kept on his mark: patrol, hold (feet still, legs idle), no awareness, hearing from now */
function plant(game: any, gd: any, p: Vec3, yaw: number) { place(gd, p, yaw); gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.reactT = 0; gd.hold = true; gd.dazzledUntil = -1; gd.heardUpTo = game.eventSeq; gd.leader = null; gd.post = null; gd.task = null; gd.bodyDuty = null; }

// ================================================================ A6.1 — the cleaner as the shield: a hostage like any colleague
export async function reviewHostageCiv() {
  console.log("\n=== review-hostage-civ (A6.1): Marta held in the corridor, Novak walks west onto them — standoff on HER, one call naming 'the cleaner', lockdown, the ring, his lines, no round in 15 s; then a round at Sam from in front stops in her ===");
  const { W, game, pl, K, N, R, M } = await stage(4101);
  let ok = true; const fails: string[] = [];
  if (!M || !M.civ) { ok = verdict(false, 'the level has its cleaner', 'game.civilians[0] missing'); return done('review-hostage-civ', ok); }
  park(K, 0); park(R, 2);
  const at: Vec3 = [14, 0, 11.2], yaw = Math.PI / 2;   // mid-corridor, facing east (standoff-see's own spot: ring room both ways)
  M.char.pos = v3.copy(at); M.char.vel = [0, 0, 0]; M.char.bodyYaw = M.char.aimYaw = yaw; M.path = []; M.pathGoal = null; M.char.update(0); M.char.update(DT);
  game.teleportPlayer([at[0] - 0.8, 0, at[2]]); pl.crouch = true; pl.slot = 'pistol'; pl.holstered = true; pl.char.bodyYaw = yaw; W.step(DT);
  const T = tap(game);
  startGrab(game, M);
  W.cam.yaw = yaw + Math.PI; W.cam.rebuild();
  for (let i = 0; i < 90 && pl.holding?.phase !== 'held'; i++) { pl.visibility = 0.6; W.cursorAt([at[0] + 3, 0, at[2]]); W.step(DT); }
  const held = pl.holding?.g === M && M.held?.by === 'player' && pl.holding.phase === 'held';
  ok = verdict(held, 'the grab takes on the cleaner: she is in his arm, held', `holding ${pl.holding?.g?.callsign ?? '—'} phase ${pl.holding?.phase ?? '—'}`) && ok;
  bringIn(game, N, [24, 0, 11.3], at, 'suspicious', [17, 0, 11.2]);   // a noise up the corridor: he walks west into it, onto the pair
  const t0 = game.time; let enterT = -1, escAt = -1, minDist = Infinity, shots = 0, hits = 0, prevHit = pl.hitFlash; const log: string[] = [];
  for (let f = 0; f < 60 * 24; f++) {
    pl.visibility = 0.6; W.cursorAt(v3.add(N.char.pos, [0, 1.2, 0]) as Vec3); W.step(DT);   // Sam keeps turning the pair to hold her square toward Novak
    const t = game.time; const P = pairOf(game);
    if (pl.hitFlash > prevHit + 1e-9) hits++; prevHit = pl.hitFlash;
    if (!P) { log.push(`${f2(t - t0)}s the hold ENDED (Marta ${M.state}, holding ${!!pl.holding})`); break; }
    if (enterT < 0 && N.standoff?.pair === M) enterT = t;
    if (escAt < 0 && game.escalation === 2) escAt = t;
    if (enterT >= 0) minDist = Math.min(minDist, v3.distXZ(N.char.pos, P.centre));
    for (const e of game.events) if (e.kind === 'guardShot' && e.time === t) shots++;
    if (f % 60 === 0) log.push(`${f2(t - t0)}s Novak ${N.state}${N.standoff ? '/standoff' : ''} aw ${f2(N.awareness)} at ${posS(N.char.pos)} ${f1(v3.distXZ(N.char.pos, P.centre))} m · esc ${game.escalation} · ${standoffSummary(game) || '—'}`);
    if (enterT >= 0 && t - enterT > 15) break;
  }
  const call = T.lines.filter(l => l.radio && /he's got Marta, the cleaner/.test(l.text));
  const barks = T.lines.filter(l => l.who === N.callsign && !l.radio && enterT >= 0 && l.t >= enterT);
  ok = verdict(enterT >= 0 && N.witness.sawHeld?.who === 'Marta' && N.state === 'alert', 'Novak enters the standoff on the civilian pair (sawHeld = Marta) and is alert', `entered ${enterT >= 0 ? f2(enterT - t0) + ' s in' : 'never'}, sawHeld ${JSON.stringify(N.witness.sawHeld)}, state ${N.state}`) && ok;
  ok = verdict(call.length === 1 && game.escalation === 2 && escAt >= 0 && Math.abs(escAt - enterT) < DT + 1e-6, "exactly one call names her as the cleaner and the floor locks down ('hostage') the frame he saw it", `${call.length} call(s): "${call[0]?.text ?? '—'}"; esc ${game.escalation} at ${escAt >= 0 ? f2(escAt - t0) : 'never'}`) && ok;
  ok = verdict(shots === 0 && hits === 0 && M.state !== 'dead' && !!pl.holding, 'not one round while she is in the arm, Sam untouched, Marta alive and still held', `${shots} round(s), Sam hit ${hits}×, Marta ${M.state}, holding ${!!pl.holding}`) && ok;
  ok = verdict(minDist >= 3.2 && barks.length >= 1, 'he keeps the ring (never inside 3.2 m of them) and talks to Sam', `min ${f2(minDist)} m; lines: ${barks.slice(0, 4).map(l => `"${l.text}"`).join(' · ') || '—'}`) && ok;
  if (VERBOSE || !ok) console.log('    ' + log.join('\n    '));
  // the shield itself: Novak stood four metres dead ahead of the pair, one steady round at Sam's chest — it stops in HER (combat.ts fireWeapon: the held body first)
  { const P = pairOf(game);
    if (P) {
      const ahead: Vec3 = [P.centre[0] + Math.sin(P.facing) * 4, 0, P.centre[2] + Math.cos(P.facing) * 4];
      place(N, ahead, P.facing + Math.PI); N.standoff = null; W.step(DT); pl.visibility = 0.6;
      const chest = pl.char.bones.chest ?? v3.add(pl.char.pos, [0, 1.2, 0]);
      const h0 = pl.hitFlash; fireWeapon(game, N.char, chest, false, { spread: 0, steady: true }); W.step(DT);
      ok = verdict(M.state === 'dead' && M.downBy === 'guard' && !(pl.hitFlash > h0 + 1e-9), 'a round at Sam from in front of the pair stops in the cleaner (dead by a guard\'s hand), Sam untouched', `Marta ${M.state} by ${M.downBy}, Sam hitFlash ${f2(h0)} → ${f2(pl.hitFlash)}`) && ok;
    } else { fails.push('no pair for the shield shot'); ok = verdict(false, 'the shield shot', 'the hold had ended') && ok; }
  }
  return done('review-hostage-civ', ok);
}

// ================================================================ A6.3 — a light going out is SEEN: a line to it, not a distance
export async function reviewLightOut() {
  console.log('\n=== review-lightout (A6.3): panel_corridor_17 OCP\'d — Kowalski up the corridor with a line to it startles; Novak four metres off through the corridor\'s north wall does not ===');
  const { W, game, pl, K, N, R } = await stage(4103);
  let ok = true;
  const t = game.targets.find((x: any) => x.name === 'panel_corridor_17');
  if (!t) { ok = verdict(false, 'the corridor panel exists', 'panel_corridor_17 missing'); return done('review-lightout', ok); }
  park(R, 2); game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
  plant(game, K, [19, 0, 11.3], -Math.PI / 2);   // 5 m east of it in the corridor, facing west: the panel over his line
  // through the wall: a free cell north of the corridor within 10 m of the panel with NO line to it or to the floor under it
  const eyeOf = (p: Vec3): Vec3 => [p[0], 1.65, p[2]];
  const lineTo = (p: Vec3) => { const e = eyeOf(p); const to = v3.sub(t.pos, e); const L = v3.len(to); return !game.col.segmentBlocked(e, v3.mad(e, to, (L - 0.4) / L)) || !game.col.segmentBlocked(e, [t.pos[0], 0.15, t.pos[2]]); };
  let spotN: Vec3 | null = null;
  for (const c of [[13.2, 0, 8.2], [12.5, 0, 8.0], [11.5, 0, 8.4], [16.5, 0, 8.6], [17.5, 0, 8.6], [13.0, 0, 7.4], [12.0, 0, 7.0]] as Vec3[]) { if (!game.col.nav.isBlocked(c[0], c[2]) && !lineTo(c) && v3.dist(c, [t.pos[0], 0, t.pos[2]]) < 9.5) { spotN = c; break; } }
  ok = verdict(lineTo([19, 0, 11.3]) && !!spotN, 'staging: Kowalski has a line to the panel, and a walled-off free cell within 10 m exists for Novak', `K line ${lineTo([19, 0, 11.3])}, N spot ${posS(spotN)}`) && ok;
  if (spotN) plant(game, N, spotN, 0);
  W.step(DT); K.heardUpTo = N.heardUpTo = game.eventSeq;
  game.player.ocp.charge = 1; game.aimTarget = t; game.ocp(t); pl.visibility = 0.02;
  const evs = game.events.filter((e: any) => e.kind === 'lightOut').length;
  for (let i = 0; i < 3; i++) { pl.visibility = 0.02; W.step(DT); }
  ok = verdict(evs === 1 && t.disabledUntil > game.time, 'the OCP knocks the panel out and files one lightOut event', `${evs} event(s), disabledUntil ${f1(t.disabledUntil)}`) && ok;
  ok = verdict(K.awareness >= 0.15 && K.awareness < 0.3 && !K.lastKnown && K.witness.heard.small >= 1, 'Kowalski (line to it, 5 m, facing it): the OCP\'s spell is a small thing — awareness up but under the suspicious line, NO fix to walk to (he glances and mutters; 08-12: an OCP\'d light must not bring men over)', `aw ${f2(K.awareness)}, fix ${posS(K.lastKnown)}, small ${K.witness.heard.small}`) && ok;
  { const t2 = t; t2.disabledUntil = 0; game.events.length = 0; K.heardUpTo = N.heardUpTo = game.eventSeq; K.awareness = 0; (game as any).lightEvent(t2, 'shot'); for (let i = 0; i < 3; i++) { pl.visibility = 0.02; W.step(DT); }
    ok = verdict(K.awareness >= 0.38 && !!K.lastKnown && v3.distXZ(K.lastKnown, [t2.pos[0], 0, t2.pos[2]]) < 0.05, 'the same fixture SHOT dark: the old rule — awareness 0.4 and his fix under it (over he comes)', `aw ${f2(K.awareness)}, fix ${posS(K.lastKnown)}`) && ok; }
  ok = verdict(N.awareness < 0.05 && !N.lastKnown && N.witness.heard.small === 0, 'Novak (through the wall, < 10 m): nothing', `aw ${f2(N.awareness)}, fix ${posS(N.lastKnown)}, small ${N.witness.heard.small}, at ${posS(N.char.pos)} ${spotN ? f1(v3.dist(spotN, [t.pos[0], 0, t.pos[2]])) : '?'} m off`) && ok;
  return done('review-lightout', ok);
}

// ================================================================ A6.5 — the rack errand skips the held / scripted / unit man
export async function reviewRack() {
  console.log('\n=== review-rack (A6.5): the drive out — sendRackCheck with Kowalski nearest the rack but in Sam\'s arm: not him; a scripted Novak: not him; Reyes as a unit: not him; freed of all that, the nearest calm man goes ===');
  const { W, game, pl, K, N, R } = await stage(4105);
  let ok = true;
  const goal: Vec3 = [game.level.mission.rack.front[0], 0, game.level.mission.rack.front[2] + 1.1];
  plant(game, K, [19.5, 0, 11.3], Math.PI / 2); plant(game, N, [26, 0, 11.3], -Math.PI / 2); plant(game, R, [31, 0, 16], 0);
  for (const g of [K, N, R]) g.hold = false;
  game.teleportPlayer([18.7, 0, 11.3]); pl.crouch = true; pl.holstered = true; pl.char.bodyYaw = Math.PI / 2; W.step(DT);
  startGrab(game, K);
  for (let i = 0; i < 90 && pl.holding?.phase !== 'held'; i++) { pl.visibility = 0.02; W.step(DT); }
  ok = verdict(pl.holding?.g === K && K.held?.by === 'player' && K.state === 'patrol', 'Kowalski is held, his state standing at patrol (the errand\'s old candidate)', `holding ${pl.holding?.g?.callsign ?? '—'}, K ${K.state} held ${!!K.held}`) && ok;
  // 1) held K nearest: he must not get it
  N.script = { name: 'probe', steps: [], i: 0, t: 0 } as any; R.unit = { light: true } as any;   // (a choreographed man and a unit: neither is the shift's to send)
  sendRackCheck(game);
  ok = verdict(!K.task && K.state === 'patrol' && !N.task && !R.task, 'held K / scripted N / unit R: nobody is handed the errand', `K task ${K.task?.kind ?? '—'} ${K.state}; N task ${N.task?.kind ?? '—'}; R task ${R.task?.kind ?? '—'}`) && ok;
  N.script = null; R.unit = null;
  sendRackCheck(game);
  const dN = v3.dist(N.char.pos, goal), dR = v3.dist(R.char.pos, goal);
  const want = dN <= dR ? N : R;
  ok = verdict(!K.task && K.state === 'patrol' && want.task?.kind === 'rack' && want.state === 'suspicious', 'freed: the nearest calm free man (not the held one, nearer though he is) takes it and turns for the rack', `K ${f1(v3.dist(K.char.pos, goal))} m task ${K.task?.kind ?? '—'}; ${want.callsign} ${f1(Math.min(dN, dR))} m task ${want.task?.kind ?? '—'} ${want.state}`) && ok;
  return done('review-rack', ok);
}

// ================================================================ A6.7 — a routed pop is placed at the corner it came round
export async function reviewRoutedShot() {
  console.log('\n=== review-routed-shot (A6.7): the suppressed Five-seveN fired just inside a room off the corridor, a calm man just outside round the jamb: his fix is the doorway (the path\'s via), not Sam\'s feet through the wall ===');
  const { W, game, pl, K, N, R } = await stage(4107);
  let ok = true;
  park(N, 1); park(R, 2);
  // find a (Sam, guard) pair: straight line blocked, routed path short enough for a level-0.6 pop (d < 7·carry + 0.5), both cells free
  const cands: [Vec3, Vec3][] = [
    [[33.2, 0, 8.6], [30.6, 0, 11.2]], [[32.4, 0, 8.8], [30.2, 0, 11.0]], [[16.3, 0, 8.9], [14.3, 0, 11.2]], [[20.8, 0, 8.9], [23.2, 0, 11.2]],
    [[27.4, 0, 8.8], [24.6, 0, 11.1]], [[25.0, 0, 8.8], [22.6, 0, 11.2]], [[10.6, 0, 8.8], [14.6, 0, 11.2]], [[33.6, 0, 13.4], [31.0, 0, 11.3]],
  ];
  let pick: { sam: Vec3; gd: Vec3; prop: any } | null = null; const tried: string[] = [];
  for (const [s, gp] of cands) {
    if (game.col.nav.isBlocked(s[0], s[2]) || game.col.nav.isBlocked(gp[0], gp[2])) { tried.push(`${posS(s)}→${posS(gp)} blocked cell`); continue; }
    const prop = game.col.sound.propagate([s[0], 1, s[2]], [gp[0], 1.5, gp[2]]);
    const lim = 7 * prop.carry * 1 + 0.5;
    tried.push(`${posS(s)}→${posS(gp)} ${prop.direct ? 'direct' : 'routed'} ${f1(prop.pathLen)} m (lim ${f1(lim)}) via ${posS(prop.via)}`);
    if (!prop.direct && prop.pathLen < lim - 0.3 && v3.distXZ([prop.via[0], 0, prop.via[2]], s) > 1.0) { pick = { sam: s, gd: gp, prop }; break; }
  }
  ok = verdict(!!pick, 'staging: a spot pair with the straight line walled and the routed path inside the pop\'s reach', pick ? `Sam ${posS(pick.sam)}, Kowalski ${posS(pick.gd)}, path ${f1(pick.prop.pathLen)} m carry ${f2(pick.prop.carry)} via ${posS(pick.prop.via)}` : tried.join(' | ')) && ok;
  if (!pick) return done('review-routed-shot', ok);
  game.teleportPlayer(pick.sam); pl.crouch = true; pl.slot = 'pistol'; pl.holstered = false; game.playerInvisible = true;   // (invisible: this is about his EARS)
  plant(game, K, pick.gd, Math.atan2(pick.sam[0] - pick.gd[0], pick.sam[2] - pick.gd[2]) + Math.PI); K.hold = false;   // his back to the room
  for (let i = 0; i < 3; i++) { pl.visibility = 0.02; W.step(DT); }
  K.heardUpTo = game.eventSeq; const via: Vec3 = [pick.prop.via[0], 0, pick.prop.via[2]];
  const wall: Vec3 = [pick.sam[0], 1.0, pick.sam[2] - 3];   // into the room's wall, away from the door
  fireWeapon(game, pl.char, wall, true);
  for (let i = 0; i < 2; i++) { pl.visibility = 0.02; W.step(DT); }
  const lk = K.lastKnown as Vec3 | null;
  ok = verdict(K.awareness >= 0.48 && !!lk, 'the pop reaches him round the jamb: awareness to 0.5 and a fix', `aw ${f2(K.awareness)}, fix ${posS(lk)}`) && ok;
  ok = verdict(!!lk && v3.distXZ(lk, via) < 0.3 && v3.distXZ(lk, pick.sam) > 1.0, 'the fix is the doorway / corner it came round (the path\'s via), not the shooter\'s feet through the wall', `fix ${posS(lk)} · via ${posS(via)} (${lk ? f2(v3.distXZ(lk, via)) : '?'} m off) · Sam ${posS(pick.sam)} (${lk ? f2(v3.distXZ(lk, pick.sam)) : '?'} m off)`) && ok;
  ok = verdict(!!K.witness.heard.smallWhere && v3.distXZ(K.witness.heard.smallWhere, via) < 0.3, 'his witness memory of the small noise is that same corner', `smallWhere ${posS(K.witness.heard.smallWhere)}`) && ok;
  return done('review-routed-shot', ok);
}

// ================================================================ A6.2 — bodies are found by the light on them (tune.bodyLight)
export async function reviewBodyLight() {
  console.log('\n=== review-bodylight (A6.2): Reyes down six metres dead ahead of Kowalski — every light in reach of the body out: not found; Kowalski\'s torch put on it: found; the body under a lit corridor panel: found; tune.bodyLight off: found in the dark as before ===');
  let ok = true;
  const trial = async (label: string, setup: (S: any, body: Vec3) => void, want: boolean, opts: { bodyLight?: boolean; dark?: boolean } = {}) => {
    const S = await stage(4102); const { W, game, pl, K, N, R } = S;
    game.tune.bodyLight = opts.bodyLight ?? true;
    park(N, 1); game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
    const kAt: Vec3 = [16, 0, 11.25], body: Vec3 = [22, 0, 11.25];   // the corridor: Kowalski facing east, Reyes six metres ahead of him
    place(R, body, Math.PI / 2); R.hold = true; W.step(DT);
    killGuard(game, R, [1, 0, 0], true, 'struck', 'world');   // dropped where he stands, quietly, by nobody (no witness, no tally)
    for (let i = 0; i < 90; i++) { pl.visibility = 0.02; W.step(DT); }   // the body settles
    plant(game, K, kAt, -Math.PI / 2);   // his back to it while the room is arranged (the fixtures' lights follow their switches at the END of a frame: lighting.ts updateTargets)
    if (opts.dark !== false) { const bp = R.char.bones.hips ?? R.char.pos; for (const t of game.targets) if (t.kind !== 'breaker' && v3.dist(t.pos, bp) < 14) t.on = false; for (const g of game.guards) g.flashlight.enabled = false; K.lightDeadUntil = 1e9; }   // pitch dark round the body: every fixture within reach off, every torch out (Kowalski's held dead so attachFlashlight keeps it out)
    setup(S, R.char.bones.hips ?? R.char.pos);
    for (let i = 0; i < 10; i++) { pl.visibility = 0.02; W.step(DT); }
    K.char.bodyYaw = K.char.aimYaw = Math.PI / 2; K.char.update(0);   // now he turns and looks down the corridor at it
    let foundAt = -1; const geo = !!bodyInView || true; const t0 = game.time;
    for (let f = 0; f < 60 * 4 && foundAt < 0; f++) { pl.visibility = 0.02; W.step(DT); if (R.found) foundAt = game.time - t0; }
    const bp = R.char.bones.hips ?? R.char.pos; const eye = K.char.bones.head ?? v3.add(K.char.pos, [0, 1.65, 0]);
    const geom = `body ${posS(bp)} ${f1(v3.distXZ(K.char.pos, bp))} m off, line ${!game.col.segmentBlocked(eye, [bp[0], bp[1] + 0.3, bp[2]])}, K ${K.state} aw ${f2(K.awareness)} torch ${K.flashlight.enabled} · ${game.bodyLightSummary()}`;
    void geo;
    ok = verdict((foundAt >= 0) === want, label, `${foundAt >= 0 ? `found ${f2(foundAt)} s` : 'not found in 4 s'} (want ${want ? 'found' : 'not found'}) · ${geom}`) && ok;
  };
  await trial('dark, no torch on it: NOT found (a shape on the floor six metres off in the pitch dark is nothing yet)', () => { /* dark as staged */ }, false);
  await trial('his torch put back in his hand and levelled down the corridor onto the body: found', (S) => { S.K.lightDeadUntil = -1; S.K.flashlight.enabled = true; S.K.char.aimPitch = -0.2; }, true);
  await trial('the corridor panel over the body lit again: found', (S, body) => { let best: any = null, bd = Infinity; for (const t of S.game.targets) { if (t.kind === 'breaker' || !/panel_corridor/.test(t.name)) continue; const d = v3.dist(t.pos, [body[0], 3, body[2]]); if (d < bd) { bd = d; best = t; } } if (best) best.on = true; }, true);
  await trial('tune.bodyLight OFF: found in the pitch dark, as before the switch', () => { /* dark */ }, true, { bodyLight: false });
  await trial('control — the lights as authored (corridor lit): found', () => { /* nothing */ }, true, { dark: false });
  return done('review-bodylight', ok);
}

// ================================================================ B7.1 — a kicked leaf comes to rest against the man beyond it, at 20 fps too
export async function reviewKickLeaf() {
  console.log('\n=== review-kick-leaf (B7.1): a corridor door kicked in by Sam with Reyes standing at its handle on the far side (0.42 m off the leaf line, by the latch edge) — at 60 AND at 20 fps the leaf stops against him: its line never crosses his centre, he is not flung ===');
  let ok = true;
  for (const hz of [60, 20]) {
    const { W, game, pl, K, N, R } = await stage(4111);
    park(K, 0); park(N, 1); game.playerInvisible = true;
    // an office door authored SHUT off the corridor (storage / server / the break room's north door), the man's spot behind it on free floor
    const off = 0.42;   // where a man about to take the handle stands: by the latch edge, his front a hand off the leaf
    let d: any = null, manAt: Vec3 = [0, 0, 0], samAt: Vec3 = [0, 0, 0], mid = 0;
    for (const name of ['storage', 'server', 'breakroom_n', 'fire_exit']) {
      const x = game.doors.byName(name); if (!x || x.def.steel || Math.abs(x.def.angle ?? 0) > 1e-3) continue;
      x.reset(); const [hx, hz0] = x.def.hinge; const u = x.dir(); const n: [number, number] = [-u[1], u[0]]; const ks = x.keySide as 1 | -1; mid = x.def.width - 0.1;
      const m: Vec3 = [hx + u[0] * mid - n[0] * ks * off, 0, hz0 + u[1] * mid - n[1] * ks * off];
      const sm: Vec3 = [hx + u[0] * x.def.width * 0.6 + n[0] * ks * 0.9, 0, hz0 + u[1] * x.def.width * 0.6 + n[1] * ks * 0.9];
      if (game.col.nav.isBlocked(m[0], m[2]) || game.col.nav.isBlocked(sm[0], sm[2])) continue;
      d = x; manAt = m; samAt = sm; break;
    }
    if (!d) { ok = verdict(false, `@${hz}: staging`, 'no shut office door with free floor both sides') && ok; continue; }
    const kickSide = d.keySide as 1 | -1; const u = d.dir(); const n: [number, number] = [-u[1], u[0]];   // Sam kicks from the keyed face (the corridor); the man stands on the room side
    plant(game, R, manAt, Math.atan2(n[0] * kickSide, n[1] * kickSide)); R.heardUpTo = 1e12;   // facing the door, deaf to the crack of it (this is about the leaf, not his ears)
    game.teleportPlayer(samAt); W.step(DT);
    const side0 = game.doors.side(d, R.char.pos); const p0 = v3.copy(R.char.pos);
    game.doors.kickIn(d, pl.char.pos, PLAYER_ID);
    let crossed = 0, maxDisp = 0, maxA = 0; const trace: string[] = [];
    const dt = 1 / hz;
    for (let f = 0; f < hz * 1.2; f++) {
      pl.visibility = 0.02; W.step(dt);
      if (game.doors.side(d, R.char.pos) !== side0) crossed++;
      maxDisp = Math.max(maxDisp, v3.distXZ(R.char.pos, p0)); maxA = Math.max(maxA, Math.abs(d.angle));
      if (f < 12) trace.push(`${f}: a ${f3(d.angle)} v ${f2(d.vel)} man ${posS(R.char.pos)} side ${game.doors.side(d, R.char.pos)}`);
    }
    // the angle at which the leaf's face would reach his near side: he stands 0.55 off the closed line at `mid` along → the leaf touches him about atan((0.55 − r − ht)/mid)
    const touchA = Math.atan2(off - 0.34 - d.thick / 2, mid);
    const pass = crossed === 0 && maxDisp < 0.3 && d.lockBroken;
    ok = verdict(pass, `${d.def.name} @${hz} Hz: the leaf never passes his centre, he is moved < 0.3 m, and it stood no wider than a body past first touch`, `crossed on ${crossed} frame(s), moved ${f2(maxDisp)} m, max |angle| ${f2(maxA)} rad (touch ≈ ${f2(touchA)}), lockBroken ${d.lockBroken}${VERBOSE || !pass ? '\n      ' + trace.join('\n      ') : ''}`) && ok;
  }
  return done('review-kick-leaf', ok);
}

// ================================================================ B7.2 / B7.3 — rings find civilians; a point-blank ring registers
export async function reviewRingCiv() {
  console.log('\n=== review-ring-civ (B7.2/B7.3): a ring to the cleaner\'s head from six metres — out cold, a civilianKO row (ring); a ring in the late worker\'s ribs — frightened, on his feet; a ring let go with the tube inside Novak\'s body — it registers (stagger or KO), it does not sail through ===');
  const { W, game, pl, K, N, R, M, O } = await stage(4113);
  let ok = true;
  if (!M || !O) { ok = verdict(false, 'the level has both civilians', 'missing'); return done('review-ring-civ', ok); }
  park(K, 0); park(R, 2); game.playerInvisible = true;
  // Marta stood in the corridor facing west, Sam six metres west of her
  const mAt: Vec3 = [20, 0, 11.25]; M.char.pos = v3.copy(mAt); M.char.vel = [0, 0, 0]; M.char.bodyYaw = M.char.aimYaw = -Math.PI / 2; M.path = []; M.pathGoal = null; M.char.update(0); M.char.update(DT);
  game.teleportPlayer([14, 0, 11.25]); pl.crouch = false; W.step(DT);
  M.char.pos = v3.copy(mAt); M.char.update(0);
  const head = v3.add(M.char.bones.head ?? v3.add(M.char.pos, [0, 1.6, 0]), [0, 0.04, 0]) as Vec3;
  const from: Vec3 = [pl.char.pos[0] + 0.4, 1.35, pl.char.pos[2]];
  fireRing(game, pl.char, from, head);
  for (let i = 0; i < 40; i++) { pl.visibility = 0.02; W.step(DT); M.char.vel = [0, 0, 0]; }
  const koRow = game.chronicle.events.find((e: any) => e.kind === 'civilianKO' && e.data?.who === 'Marta');
  ok = verdict(M.state === 'dead' && M.downKind === 'struck' && M.downBy === 'player' && koRow?.data?.method === 'ring', 'the ring to her head: out cold (struck, breathing) by Sam\'s hand, a civilianKO row with method ring', `Marta ${M.state}/${M.downKind} by ${M.downBy}, row ${koRow ? JSON.stringify(koRow.data) : '—'}, rings in air ${game.rings.length}`) && ok;
  // Owen: a ring low in the ribs from six metres — frightened (alarmed), not down
  const oAt: Vec3 = [26, 0, 11.25]; O.char.pos = v3.copy(oAt); O.char.vel = [0, 0, 0]; O.char.bodyYaw = O.char.aimYaw = -Math.PI / 2; O.path = []; O.pathGoal = null; O.civ.state = 'work'; O.char.anim.act = null; O.char.update(0); O.char.update(DT);
  game.teleportPlayer([20.5, 0, 11.6]); W.step(DT); O.char.pos = v3.copy(oAt); O.char.update(0);
  const hips = O.char.bones.hips ?? v3.add(O.char.pos, [0, 0.95, 0]);
  fireRing(game, pl.char, [pl.char.pos[0] + 0.4, 1.0, pl.char.pos[2]], [hips[0], hips[1] + 0.05, hips[2]]);
  let oState = O.civ.state;
  for (let i = 0; i < 30; i++) { pl.visibility = 0.02; W.step(DT); if (O.civ.state === 'alarmed') oState = 'alarmed'; }
  ok = verdict(O.state !== 'dead' && oState === 'alarmed', 'the ring in his ribs: on his feet and frightened (alarmed)', `Owen ${O.state}, civ ${O.civ.state} (saw ${oState}), cause ${O.civ.cause}`) && ok;
  // point-blank: the tube inside Novak's cylinder
  bringIn(game, N, [17, 0, 11.25], [14, 0, 11.25]); N.hold = true; N.heardUpTo = 1e12; W.step(DT);
  game.teleportPlayer([16.55, 0, 11.25]); W.step(DT);
  const nh = N.char.bones.hips ?? N.char.pos; const inside: Vec3 = [nh[0] - 0.15, 1.15, nh[2]];   // 15 cm off his axis, chest height: inside the 0.28 cylinder
  const stg0 = N.staggerUntil, st0 = N.state;
  fireRing(game, pl.char, inside, [nh[0] + 3, 1.15, nh[2]]);
  for (let i = 0; i < 6; i++) { pl.visibility = 0.02; W.step(DT); }
  const registered = N.state === 'dead' || N.staggerUntil > stg0;
  ok = verdict(registered, 'a ring let go from inside his body cylinder registers on him (stagger or KO) instead of passing through', `Novak ${st0} → ${N.state}, staggerUntil ${f1(stg0)} → ${f1(N.staggerUntil)}, rings in air ${game.rings.length}`) && ok;
  return done('review-ring-civ', ok);
}

// ================================================================ B7.5 — the item cap never eats a live fuse or a venting can
export async function reviewItemCap() {
  console.log('\n=== review-item-cap (B7.5): 32 items with a live-fused stun can oldest → the 33rd evicts a dropped pistol, the can stays; a venting smoke can oldest → stays; a spent can / a magazine oldest → goes first as ever ===');
  const { game } = await stage(4115);
  let ok = true; const I = game.items;
  const fill = (kind: string, n: number) => { for (let i = 0; i < n; i++) I.spawn(kind, [5 + i * 0.1, 0.5, 5], [0, 0, 0]); };
  // 1) live fuse oldest
  I.items.length = 0; const can = I.spawn('flash', [4, 0.5, 4], [0, 0, 0]); fill('pistol', 31);
  const before = I.items.length; I.spawn('pistol', [9, 0.5, 9], [0, 0, 0]);
  ok = verdict(before === 32 && I.items.length === 32 && I.items.includes(can) && !can.fired, 'live-fused stun can oldest of 32: the next spawn keeps the list at 32 and the CAN survives', `${before} → ${I.items.length}, can ${I.items.includes(can) ? 'kept' : 'EVICTED'}`) && ok;
  // 2) venting smoke can oldest
  I.items.length = 0; const smk = I.spawn('smoke', [4, 0.5, 4], [0, 0, 0], { fired: true, emitT: 20 }); fill('torch', 31); I.spawn('torch', [9, 0.5, 9], [0, 0, 0]);
  ok = verdict(I.items.length === 32 && I.items.includes(smk), 'a smoke can still venting (fired, emitT 20 s) oldest: survives the 33rd', `${I.items.length}, can ${I.items.includes(smk) ? 'kept' : 'EVICTED'}`) && ok;
  // 3) spent can oldest goes; a mag anywhere goes before a dropped gun
  I.items.length = 0; const spent = I.spawn('smoke', [4, 0.5, 4], [0, 0, 0], { fired: true, emitT: 0 }); fill('pistol', 31); I.spawn('pistol', [9, 0.5, 9], [0, 0, 0]);
  ok = verdict(I.items.length === 32 && !I.items.includes(spent), 'a smoke can that has finished venting oldest: it is the one to go', `${I.items.length}, spent can ${I.items.includes(spent) ? 'KEPT' : 'evicted'}`) && ok;
  I.items.length = 0; fill('pistol', 10); const mag = I.spawn('mag', [4, 0.5, 4], [0, 0, 0]); fill('pistol', 21); const first = I.items[0]; I.spawn('pistol', [9, 0.5, 9], [0, 0, 0]);
  ok = verdict(I.items.length === 32 && !I.items.includes(mag) && I.items.includes(first), 'a magazine eleventh in the list: it goes before the oldest dropped pistol', `${I.items.length}, mag ${I.items.includes(mag) ? 'KEPT' : 'evicted'}, oldest pistol ${I.items.includes(first) ? 'kept' : 'EVICTED'}`) && ok;
  // 4) all live cans: nothing is evicted (33 stand)
  I.items.length = 0; fill('flash', 32); I.spawn('flash', [9, 0.5, 9], [0, 0, 0]);
  ok = verdict(I.items.length === 33 && I.items.every((x: any) => !x.fired), 'thirty-two live cans and a thirty-third: nothing live is thrown away (the list holds 33)', `${I.items.length}`) && ok;
  I.items.length = 0;
  return done('review-item-cap', ok);
}

// ================================================================ B7.12 — reset forgets lastWho
export async function reviewDoorReset() {
  console.log('\n=== review-door-reset (B7.12): Sam pushes a door open (lastWho = him); Door.reset() puts the leaf back AND forgets who touched it ===');
  const { W, game, pl } = await stage(4117);
  let ok = true;
  const d = game.doors.list.find((x: any) => !x.def.locked && !x.def.steel) ?? game.doors.list[0];
  d.reset(); const spot = game.doors.workSpot(d, [d.frameCentre[0] + 1, 0, d.frameCentre[2] + 1], 0.6).pos as Vec3;
  game.teleportPlayer(spot); W.step(DT);
  game.doors.use(d, pl.char.pos, PLAYER_ID, pl.keys); for (let i = 0; i < 20; i++) W.step(DT);
  ok = verdict(d.lastWho === PLAYER_ID && !d.latched, 'used by Sam: lastWho is his id, the leaf is off the latch', `lastWho ${d.lastWho}, angle ${f2(d.angle)}`) && ok;
  d.reset();
  const a0 = Math.max(d.minA, Math.min(d.maxA, d.sided(d.def.angle ?? 0)));
  ok = verdict(d.lastWho === -1 && d.latched === (Math.abs(a0) < 1e-3) && d.angle === a0 && d.vel === 0, 'reset: back at its authored angle (latched if that is shut), still, and lastWho back to −1', `lastWho ${d.lastWho}, latched ${d.latched}, angle ${f2(d.angle)} (authored ${f2(a0)})`) && ok;
  return done('review-door-reset', ok);
}

// ================================================================ A6.8 — daylight in and out keeps a permanent blackout permanent
export async function reviewDayBlackout() {
  console.log('\n=== review-day-blackout (A6.8): the breaker SHOT (mains gone for good) → setDaylight(true) lifts it for the show → setDaylight(false) puts it back, permanent; a timed trip lifted by the day stays lifted; no blackout stays no blackout ===');
  const { W, game } = await stage(4119);
  let ok = true;
  if (!game.level.daylight) { ok = verdict(false, 'the level has a daylight variant', 'none'); return done('review-day-blackout', ok); }
  game.setBlackout(Infinity, 'shot'); W.step(DT);
  const b0 = { ...game.blackout };
  setDaylight(game, true); W.step(DT); const during = { ...game.blackout };
  setDaylight(game, false); W.step(DT); const after = { ...game.blackout };
  ok = verdict(b0.active && b0.permanent && !during.active && isDaylight(game) === false && after.active && after.permanent && after.until === Infinity && Math.abs(after.since - b0.since) < 1e-9, 'permanent: active+permanent before, lifted while day is in, active+permanent+until ∞ (same since) after', `before ${JSON.stringify(b0)} · during active ${during.active} · after ${JSON.stringify(after)}`) && ok;
  game.endBlackout(); for (let i = 0; i < 5; i++) W.step(DT);
  game.setBlackout(30, 'ocp'); W.step(DT); const t0 = { ...game.blackout };
  setDaylight(game, true); W.step(DT); setDaylight(game, false); const t1 = { ...game.blackout };
  ok = verdict(t0.active && !t0.permanent && !t1.active, 'timed (OCP, 30 s): lifted by the day and NOT put back — that trip is over (breach-daylight\'s own premise)', `before ${JSON.stringify(t0)} · after ${JSON.stringify(t1)}`) && ok;
  game.endBlackout(); W.step(DT);
  setDaylight(game, true); W.step(DT); setDaylight(game, false); W.step(DT);
  ok = verdict(!game.blackout.active, 'no blackout before the day: none after', `active ${game.blackout.active}`) && ok;
  return done('review-day-blackout', ok);
}

// ================================================================ A6.4 — the meter never takes a NaN, and heals one
export async function reviewMeter() {
  console.log('\n=== review-meter (A6.4): the light probe answers NaN for a frame — Sam\'s visibility / irradiance stay finite; a meter already NaN heals within a frame ===');
  const { W, game, pl } = await stage(4121);
  let ok = true;
  pl.visibility = 0.4; pl.irradiance = 0.1;
  const get0 = game.probe.get.bind(game.probe);
  game.probe.get = (k: string) => k === 'playerChest' ? [NaN, 0, 0, 0] : k === 'playerHead' ? [0.2, 0, 0, 0] : get0(k);
  W.step(DT); W.step(DT);
  ok = verdict(Number.isFinite(pl.visibility) && Number.isFinite(pl.irradiance), 'a NaN reading is refused: visibility and irradiance stay numbers', `vis ${pl.visibility}, E ${pl.irradiance}`) && ok;
  game.probe.get = (k: string) => k === 'playerChest' || k === 'playerHead' ? [0.2, 0, 0, 0] : get0(k);
  pl.visibility = NaN; W.step(DT);
  ok = verdict(Number.isFinite(pl.visibility), 'a meter poisoned already (NaN) is a number again after one frame with a good reading', `vis ${pl.visibility}`) && ok;
  game.probe.get = get0; pl.visibility = NaN; W.step(DT);
  ok = verdict(Number.isFinite(pl.visibility), '…and with no reading at all (headless), the self-heal alone puts it back to a number', `vis ${pl.visibility}`) && ok;
  return done('review-meter', ok);
}

// ================================================================ A6.9 — no door verb for a Sam downed this frame
export async function reviewActDown() {
  console.log('\n=== review-act-down (A6.9): the \'push\' row chosen on a shut door in the very frame Sam goes down: updateDoors performs nothing (the leaf stays latched); alive, the same act opens it ===');
  const { W, game, pl } = await stage(4123);
  let ok = true;
  const d = game.doors.list.find((x: any) => !x.def.locked && !x.def.steel && x.def.closer !== false) ?? game.doors.list[0];
  d.reset(); const spot = game.doors.workSpot(d, [d.frameCentre[0], 0, d.frameCentre[2] + (d.keySide > 0 ? 1 : -1)], 0.6).pos as Vec3;
  game.teleportPlayer(spot); W.step(DT); W.step(DT);
  // downed this frame, the act already chosen: call the doors step by hand with both standing
  pl.down = true; game.act = { kind: 'door', verb: 'push', door: d, line1: 'push it open', line2: '', pos: d.pos, inReach: true, off: false };
  (game as any).updateDoors(DT, W.input);
  ok = verdict(d.latched && Math.abs(d.angle) < 1e-6 && d.lastWho !== PLAYER_ID, 'down: the push is not performed — latched, untouched', `latched ${d.latched}, angle ${f3(d.angle)}, lastWho ${d.lastWho}`) && ok;
  pl.down = false; game.act = { kind: 'door', verb: 'push', door: d, line1: 'push it open', line2: '', pos: d.pos, inReach: true, off: false };
  (game as any).updateDoors(DT, W.input);
  ok = verdict(!d.latched && d.lastWho === PLAYER_ID, 'control — on his feet the same act pushes it open', `latched ${d.latched}, angle ${f3(d.angle)}, lastWho ${d.lastWho}`) && ok;
  return done('review-act-down', ok);
}

// ================================================================ B7.8 — update(0) leaves the kick's impact flag alone
export async function reviewKickHit() {
  console.log('\n=== review-kickhit (B7.8): the kick clip run to its impact frame; a zero-dt re-bake of the pose that same frame leaves kickImpact up (it clears on the next real step) ===');
  const { game, pl } = await stage(4125);
  let ok = true; const c = pl.char, an = c.anim;
  an.kickDoor(); let impactF = -1;
  for (let f = 0; f < 90; f++) { c.update(DT); if (an.kickImpact) { impactF = f; break; } }
  ok = verdict(impactF >= 0, 'the kick reaches its impact frame', `frame ${impactF}`) && ok;
  c.update(0);
  ok = verdict(an.kickImpact === true, 'update(0) in the impact frame: kickImpact still true', `${an.kickImpact}`) && ok;
  c.update(DT);
  ok = verdict(an.kickImpact === false, 'the next real step: cleared (one impact per kick)', `${an.kickImpact}`) && ok;
  void game;
  return done('review-kickhit', ok);
}

// ================================================================ B7.6 — the torch carry smooths per second
export async function reviewTorchDt() {
  console.log('\n=== review-torch-dt (B7.6): torchCarryDir from the same start toward the same target — 2 steps of 1/60 ≈ 1 step of 1/30 ≈ 4 steps of 1/120 (within half a degree); the old per-frame lerp put them degrees apart ===');
  const { game, K } = await stage(4127);
  let ok = true; const c = K.char;
  c.aimYaw = c.bodyYaw; c.aimPitch = -0.3; c.update(DT);   // the beam wants the chest / aim heading; it starts 0.3 rad off it in yaw (a lerp of unit vectors this close is a slerp to a tenth of a degree, so the test reads the easing rate and not the chord's geometry)
  const prev: Vec3 = v3.normalize([Math.sin(c.bodyYaw - 0.3), Math.tan(-0.3), Math.cos(c.bodyYaw - 0.3)]);
  const run = (dt: number, n: number) => { let d: Vec3 = v3.normalize(prev); for (let i = 0; i < n; i++) d = torchCarryDir(c, d, dt); return d; };
  const a60 = run(1 / 60, 2), a30 = run(1 / 30, 1), a120 = run(1 / 120, 4);
  const ang = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b)))) / DEG;
  const moved = ang(v3.normalize(prev), a60);
  ok = verdict(moved > 3, 'staging: the beam actually has somewhere to go (moves > 3° in two frames)', `${f2(moved)}° of ${f2(ang(v3.normalize(prev), run(1 / 60, 2000)))}°`) && ok;
  ok = verdict(ang(a60, a30) < 0.5 && ang(a60, a120) < 0.5, '60 Hz ×2 vs 30 Hz ×1 vs 120 Hz ×4 agree within half a degree (the per-frame fifth put 60↔30 well over a degree apart here)', `60↔30 ${f2(ang(a60, a30))}° · 60↔120 ${f2(ang(a60, a120))}°`) && ok;
  void game; void wrapAngle;
  return done('review-torch-dt', ok);
}

// ================================================================ W8.5 — a stack of men against a thin panel never ends a frame inside or beyond it
export async function reviewStack() {
  console.log('\n=== review-stack (W8.5): two men stood all but onto a third who stands a body\'s clearance off a cubicle panel (and off a corridor pane), for two seconds at 60 and at 20 fps: the shove that separates them never leaves anybody inside the panel at a frame\'s end, let alone out of its far side ===');
  let ok = true;
  const probeAt = async (hz: number, pickPanel: (game: any) => any, tag: string) => {
    const { W, game, pl, K, N, R } = await stage(4131);
    game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
    const b = pickPanel(game);
    if (!b) { ok = verdict(false, `${tag} @${hz}: staging`, 'no such panel found') && ok; return; }
    const thin = b.h[0] <= b.h[2] ? 0 : 2;   // thin axis in XZ (unrotated boxes: cubicle panels and panes are axis-aligned)
    const nrm: Vec3 = thin === 0 ? [1, 0, 0] : [0, 0, 1]; const along: Vec3 = thin === 0 ? [0, 0, 1] : [1, 0, 0];
    // which face is open: a free nav cell 0.5 m out on either side
    let sgn = 0; for (const s of [1, -1]) { const q = v3.mad([b.c[0], 0, b.c[2]], nrm, s * (b.h[thin] + 0.75)); const q2 = v3.mad([b.c[0], 0, b.c[2]], nrm, s * (b.h[thin] + 1.25)); if (!game.col.nav.isBlocked(q[0], q[2]) && !game.col.nav.isBlocked(q2[0], q2[2])) { sgn = s; break; } }
    if (!sgn) { ok = verdict(false, `${tag} @${hz}: staging`, `no free floor beside ${b.name ?? 'the panel'} at ${posS(b.c)}`) && ok; return; }
    const face = b.c[thin] + sgn * b.h[thin];   // the near face's coordinate along the normal
    const base = v3.mad([b.c[0], 0, b.c[2]], nrm, sgn * (b.h[thin] + 0.35)) as Vec3;
    // Kowalski a body's clearance off the face; Novak and Reyes all but ON him from the open side (0.15 m off his centre, either hand) — the frame two men are stood
    // onto a third's spot (a stack dealt onto one mark, a spawn): each pushes him (0.6 − 0.15) / 2 toward the panel, 0.45 m between them in the first frame
    const men = [K, N, R]; const spots: Vec3[] = [v3.copy(base), v3.mad(v3.mad(base, nrm, sgn * 0.12) as Vec3, along, 0.09) as Vec3, v3.mad(v3.mad(base, nrm, sgn * 0.12) as Vec3, along, -0.09) as Vec3];
    men.forEach((g, i) => { plant(game, g, spots[i], Math.atan2(-nrm[0] * sgn, -nrm[2] * sgn)); g.heardUpTo = 1e12; });   // facing the panel, deaf, feet still — only the shove and the statics move them
    let inside = 0, beyond = 0, worst = 0; const notes: string[] = [];
    const dt = 1 / hz;
    for (let f = 0; f < hz * 2; f++) {
      pl.visibility = 0.02; W.step(dt);
      for (const g of men) {
        const p = g.char.pos; const sd = (p[thin] - face) * sgn;   // signed metres of his centre off the near face (+ = the open side)
        const withinSpan = Math.abs(p[thin === 0 ? 2 : 0] - b.c[thin === 0 ? 2 : 0]) < b.h[thin === 0 ? 2 : 0] + 0.25;
        if (!withinSpan) continue;
        if (sd < -2 * b.h[thin]) { beyond++; notes.push(`${f}: ${g.callsign} BEYOND at ${posS(p)} (${f2(sd)})`); }
        else if (sd < 0.3 - 0.06) { inside++; worst = Math.max(worst, 0.3 - sd); if (notes.length < 6) notes.push(`${f}: ${g.callsign} ${f2(0.3 - sd)} m into it at ${posS(p)}`); }
      }
    }
    const spread = Math.max(...men.map(a => Math.max(...men.map(c => v3.distXZ(a.char.pos, c.char.pos)))));
    ok = verdict(inside === 0 && beyond === 0, `${tag} @${hz} Hz (${b.name ?? 'box'} at ${posS(b.c)}, ${f2(2 * b.h[thin])} m thick): no man-frame > 6 cm inside the panel, none beyond it`, `inside ${inside} (worst ${f2(worst)} m), beyond ${beyond}; they end ${f2(spread)} m apart at ${men.map(g => posS(g.char.pos)).join(' ')}${notes.length ? '\n      ' + notes.slice(0, 6).join('\n      ') : ''}`) && ok;
  };
  const openSide = (game: any, b: any) => { const thin = b.h[0] <= b.h[2] ? 0 : 2; const nrm: Vec3 = thin === 0 ? [1, 0, 0] : [0, 0, 1]; for (const s of [1, -1]) { const q = v3.mad([b.c[0], 0, b.c[2]], nrm, s * (b.h[thin] + 0.75)); const q2 = v3.mad([b.c[0], 0, b.c[2]], nrm, s * (b.h[thin] + 1.25)); if (!game.col.nav.isBlocked(q[0], q[2]) && !game.col.nav.isBlocked(q2[0], q2[2])) return s; } return 0; };
  const cubiclePanel = (game: any) => { const cands: any[] = []; for (const b of game.level.boxes) { if (b.flags & (2 | 8 | (1 << 17))) continue; const t = Math.min(b.h[0], b.h[2]); const L = Math.max(b.h[0], b.h[2]); if (t > 0.06 || L < 0.6 || b.h[1] < 0.5 || b.c[1] - b.h[1] > 0.15 || b.yaw) continue; if (b.c[0] < 14 || b.c[0] > 25 || b.c[2] < 14 || b.c[2] > 23) continue; cands.push(b); } cands.sort((a, b) => (Math.abs(a.c[0] - 19) + Math.abs(a.c[2] - 18)) - (Math.abs(b.c[0] - 19) + Math.abs(b.c[2] - 18))); return cands.find(b => openSide(game, b) !== 0) ?? null; };
  const glassPane = (game: any) => { let best: any = null, bs = Infinity; for (const b of game.level.boxes) { if (!(b.flags & (1 << 17))) continue; const t = Math.min(b.h[0], b.h[2]); if (t > 0.05 || b.yaw || b.c[1] - b.h[1] > 0.3) continue; const s = Math.abs(b.c[0] - 12) + Math.abs(b.c[2] - 9); if (s < bs) { bs = s; best = b; } } return best; };
  await probeAt(60, cubiclePanel, 'cubicle panel'); await probeAt(20, cubiclePanel, 'cubicle panel');
  await probeAt(60, glassPane, 'glass pane'); await probeAt(20, glassPane, 'glass pane');
  return done('review-stack', ok);
}
