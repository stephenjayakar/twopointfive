// The 'qrf' probe family (run through probes.ts: `bun run tools/qa/probes.ts qrf | qrf-trigger | qrf-timeline | qrf-element | qrf-wave | qrf-reset | qrf-gating |
// qrf-limits | qrf-perimeter [--verbose]`): the response to going loud (src/game/qrf.ts) — what calls it (a locked-down floor that has HEARD Sam's gunfire, or found
// two men down; never the suppressed pistol's odd noise, never under the tour), the radio telegraph's timings, the west stair door (steel: locked
// to Sam, no pick, a boot only rings off it; thrown open from the landing on arrival), the four-man element (spawned as ordered, files in, moves as one, stacks /
// bangs / flows into the room holding the fix, fights on sight and re-forms when it goes cold), one wave a night, everything back as it was on a restart, the
// renderer's character / light budgets held, and the perimeter tier (its three triggers, the outside posts taken facing the doors, the lot's lamps up and back,
// the fire exit still the way out).
import { standUp, ROOT } from './headless.ts';
const { v3, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { raiseEscalation, spawnUnit, units, lightEstimateAt } = guardsMod;
const { fireWeapon, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const qrfMod = await import(`${ROOT}/src/game/qrf.ts`);
const { QRF_MARKS, requestQrf, callPerimeter, RESPONSE } = qrfMod;
const { startKick } = await import(`${ROOT}/src/game/player.ts`);
const { inBounds } = await import(`${ROOT}/src/game/squad.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function family(title: string) {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); return ok; }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const steadyLights = (game: any) => game.engine.lights.lights.filter((l: any) => l.ttl < 0).length;
/** every 'radio: …' line the game files from here on, with its game time (game.messages keeps five) */
function tapRadio(game: any) { const lines: { t: number; text: string }[] = []; const orig = game.msg.bind(game); game.msg = (t: string) => { if (t.startsWith('radio: ')) lines.push({ t: game.time, text: t.slice(7) }); return orig(t); }; return lines; }
function step(W: any, n: number, vis?: number) { for (let i = 0; i < n; i++) { if (vis !== undefined) W.game.player.visibility = vis; W.step(DT); } }
/** Sam goes loud: stood in the corridor with the FN2000 up, three rounds into the east end wall — real rounds through fireWeapon, so the report is the row's (level 1)
 *  and reaches the shift's ears through the hearing model — then the floor is put at lockdown by hand (two alarm episodes' worth, in a frame) */
function goLoud(W: any, opts: { rounds?: number; raise?: boolean; at?: Vec3 } = {}) {
  const { game } = W; const at = opts.at ?? [22, 0, 11.2];
  game.teleportPlayer(at); game.player.slot = 'rifle'; game.player.holstered = false; step(W, 2, 0.6);
  for (let k = 0; k < (opts.rounds ?? 3); k++) { fireWeapon(game, game.player.char, [35.5, 1.2, 11.2], true); step(W, 10, 0.6); }
  if (opts.raise !== false) raiseEscalation(game, 2);
}
/** Sam out of it: on the lot's far corner, dark, invisible to the AI (the men are the probe's subject, not him) */
function hideSam(W: any) { const { game } = W; game.teleportPlayer([37.5, 0, 26.5]); game.player.visibility = 0.02; game.playerInvisible = true; game.player.crouch = true; }
async function fresh(seed: number, opts: { eta?: number; perimeter?: boolean } = {}) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.tune.qrfEta = opts.eta ?? 20; game.tune.perimeter = opts.perimeter ?? false; game.tune.qrf = true; game.tune.qrfSize = 4;
  game.tune.qrfSquad = false;   // (this family measures the element's OWN drill on the level's marks — on either stand; the squad's code under it is qrf-squad-check.ts)
  RESPONSE.on = false;   // (… and the team as the office's one stairwell on the sandbox's two numbers, in the office's words — on either stand; the level's own team is response-check.ts. The runner puts the table back)
  step(W, 20, 0.05);
  return W;
}

// ================================================================ (a) the trigger — and the door Sam came in by
export async function qrfTrigger() {
  const F = family('qrf-trigger: what calls the response team (ALARM II + Sam\'s gunfire HEARD, or two men found down; never the suppressed pistol, never with the knob off) — and the west stair door: steel, locked to Sam, no keyway, a boot only rings off it');
  // (1) lockdown + three FN2000 rounds in the corridor → requested (reason gunfire), and the request goes out on the net from a staff man
  { const W = await fresh(11); const { game } = W; const rx = tapRadio(game);
    goLoud(W); step(W, 4, 0.6);
    const Q = game.qrf;
    F.verdict(Q.state !== 'idle' && Q.reason === 'gunfire' && rx.some(l => /response team/.test(l.text)), '(1) ALARM II with his rifle fire in their ears: requested, reason gunfire, called in on the net', `state ${Q.state} · reason ${Q.reason} · loud heard ${f1(game.time - Q.loudT)} s ago · alarm ${game.escalation} · "${rx.find(l => /response team/.test(l.text))?.text ?? '—'}"`); }
  // (2) the same rounds with the floor only heightened: nothing (it takes the lockdown)
  { const W = await fresh(12); const { game } = W;
    goLoud(W, { raise: false }); raiseEscalation(game, 1); step(W, 120, 0.05);
    F.verdict(game.qrf.state === 'idle', '(2) the same rounds on a floor at ALARM I: not requested', `state ${game.qrf.state} · alarm ${game.escalation} · loud heard ${game.qrf.loudT > -1e8}`); }
  // (3) the suppressed Five-seveN (level 0.6) emptied into the wall on a locked-down floor: an odd noise, never 'shots fired' — not requested; then ONE rifle round: requested
  { const W = await fresh(13); const { game } = W;
    game.teleportPlayer([22, 0, 11.2]); game.player.slot = 'pistol'; game.player.holstered = false; step(W, 2, 0.3);
    for (let k = 0; k < 6; k++) { fireWeapon(game, game.player.char, [35.5, 1.2, 11.2], true); step(W, 14, 0.3); }
    raiseEscalation(game, 2); step(W, 120, 0.05);
    const idleAfterPistol = game.qrf.state === 'idle' && game.qrf.loudT < -1e8;
    game.player.slot = 'rifle'; step(W, 2, 0.3); fireWeapon(game, game.player.char, [35.5, 1.2, 11.2], true); step(W, 6, 0.3);
    F.verdict(idleAfterPistol && game.qrf.state !== 'idle' && game.qrf.reason === 'gunfire', '(3) six suppressed pistol rounds at ALARM II: nothing heard as gunfire, not requested — one FN2000 round after: requested', `after the pistol: idle ${idleAfterPistol} · after the rifle round: ${game.qrf.state}/${game.qrf.reason}`); }
  // (4) bodies, no shots: one man found down at ALARM II → nothing; a second found → requested (reason bodies)
  { const W = await fresh(14); const { game } = W; hideSam(W);
    const [A, B] = game.guards; killGuard(game, A, [1, 0, 0], true); A.found = true; raiseEscalation(game, 2); step(W, 90);
    const oneBody = game.qrf.state;
    killGuard(game, B, [1, 0, 0], true); B.found = true; step(W, 10);
    F.verdict(oneBody === 'idle' && game.qrf.state !== 'idle' && game.qrf.reason === 'bodies', '(4) no shots: one body found at ALARM II — nothing; two — requested, reason bodies', `one body: ${oneBody} · two: ${game.qrf.state}/${game.qrf.reason} · loud ever ${game.qrf.loudT > -1e8}`); }
  // (5) the knob off: lockdown + rifle fire → nothing; and the panel's request works regardless (a live run)
  { const W = await fresh(15); const { game } = W; game.tune.qrf = false;
    goLoud(W); step(W, 60, 0.3);
    const off = game.qrf.state; const ok = requestQrf(game, 'panel');
    F.verdict(off === 'idle' && ok && game.qrf.state === 'requested', '(5) tune.qrf off: the trigger never fires; the panel\'s "call QRF now" still does', `off → ${off} · panel → ${ok}/${game.qrf.state}`); }
  // (6) the west stair door: there, steel, keyed 'stairwell' on the corridor face — Sam is locked out with no 'pick' row, a kick rings off it (a loud 'door' noise, no
  //     'kick', bolt and keep intact), it opens from the landing side, and the landing's nav cells connect to the corridor through it
  { const W = await fresh(16); const { game } = W; const d = game.doors.byName(QRF_MARKS.door);
    const f: string[] = [];
    if (!d) f.push('no door named stairwell');
    else {
      if (!d.def.steel || !d.locked || d.lockId !== 'stairwell' || !d.latched) f.push(`def: steel ${d.def.steel} locked ${d.locked} lock ${d.lockId} latched ${d.latched}`);
      if (!game.doors.lockedOut(d, [6, 0, 11.1]) || game.doors.lockedOut(d, [2.5, 0, 11.2])) f.push(`lockedOut corridor ${game.doors.lockedOut(d, [6, 0, 11.1])} landing ${game.doors.lockedOut(d, [2.5, 0, 11.2])}`);
      if (game.guards.some((x: any) => x.keys?.has('stairwell')) || game.player.keys.has('stairwell')) f.push('somebody on the floor carries the stairwell key');
      game.playerInvisible = true; game.teleportPlayer([5.0, 0, 11.2]); game.player.crouch = false; step(W, 3);
      W.cursorAt(d.pos); step(W, 2);
      const rows = game.nearby.filter((r: any) => r.kind === 'door' && r.door === d).map((r: any) => r.verb);
      if (rows.includes('pick') || !rows.includes('kick')) f.push(`rows on it: [${rows.join(',')}] (want kick + rattle, no pick)`);
      const ev0 = game.events.length; startKick(game, d); let clang = false, kickEv = false;
      for (let i = 0; i < 90; i++) { W.step(DT); for (const e of game.events) { if (e.kind === 'kick') kickEv = true; if (e.kind === 'door' && (e.level ?? 0) >= 0.99 && e.who === 1) clang = true; } }
      if (!clang || kickEv || !d.locked || d.lockBroken || !d.latched || Math.abs(d.angle) > 0.01) f.push(`after the kick: clang ${clang} kickEvent ${kickEv} locked ${d.locked} broken ${d.lockBroken} latched ${d.latched} angle ${f2(d.angle)}`);
      // from the landing: use() swings it into the corridor (Sam moved off first — stood at the kick spot his body stops the leaf at half a radian, as it should); and the nav grid joins the landing to the corridor through the doorway
      game.teleportPlayer([9.0, 0, 11.2]); step(W, 2);
      game.doors.use(d, [3.0, 0, 11.25], 20); step(W, 30);
      const opened = d.angle < -0.5;
      const path = game.col.nav.findPath([2.25, 0, 11.25], [8, 0, 11.1]);
      if (!opened) f.push(`use() from the landing: angle ${f2(d.angle)} (want swung east, negative)`);
      if (!path) f.push('no nav path landing → corridor');
      for (const [i, p] of QRF_MARKS.landing.entries()) if (game.col.nav.isBlocked(p[0], p[2])) f.push(`landing mark ${i} on a blocked cell`);
      for (const [i, p] of QRF_MARKS.entry.entries()) if (game.col.nav.isBlocked(p[0], p[2])) f.push(`entry mark ${i} on a blocked cell`);
      void ev0;
    }
    F.verdict(f.length === 0, '(6) the stair door: steel, bolted, keyed to nobody\'s key; Sam locked out with kick + rattle rows and no pick; the kick is a loud door noise and nothing gives; opens from the landing into the corridor; landing ↔ corridor walkable; every mark on a free cell', f.join(' · ') || `rows [kick, rattle], clang heard as a level-1 door noise, bolt intact; use() from the landing swung it to ${f2(d.angle)}; nav path ${'yes'}`); }
  return F.done();
}

// ================================================================ (b) the telegraph and the arrival
export async function qrfTimeline() {
  const F = family('qrf-timeline: request → control\'s answer → thirty seconds → ten seconds (the men on the landing, boots on the stairs) → the door — each on the net at its time; four men, staff side, trained, carbines with lights, a bang each in the pool');
  const W = await fresh(21, { eta: 45 }); const { game } = W; const rx = tapRadio(game); const audio: any[] = []; W.audioLog = audio;
  const L0 = steadyLights(game), g0 = game.guards.length;
  goLoud(W); hideSam(W); step(W, 1);
  const Q = game.qrf; const t0 = Q.requestedAt;
  const seenState: Record<string, number> = { [Q.state]: game.time - t0 };
  for (let f = 0; f < 60 * 52 && Q.state !== 'deployed'; f++) { W.step(DT); if (seenState[Q.state] === undefined) seenState[Q.state] = game.time - t0; }
  step(W, 60 * 4);
  const at = (re: RegExp) => { const l = rx.find(x => re.test(x.text)); return l ? l.t - t0 : NaN; };
  const tReq = at(/response team/), tCtl = at(/^CONTROL — copy two-six/), t30 = at(/thirty seconds/), t10 = at(/QRF on the stairs/), tDoor = at(/in through the west stairs/);
  const near = (x: number, want: number, tol = 0.55) => Number.isFinite(x) && Math.abs(x - want) <= tol;
  F.verdict(near(tReq, 0, 0.1) && near(tCtl, 1.6, 0.2) && near(t30, 45 - 30) && near(t10, 45 - 10) && near(tDoor, 45), 'the five lines at +0 / +1.6 / ETA−30 / ETA−10 / ETA (±0.5 s), ETA 45', `request +${f2(tReq)} · control +${f2(tCtl)} · thirty +${f2(t30)} · ten +${f2(t10)} · door +${f2(tDoor)}${VERBOSE ? '\n    ' + rx.map(l => `+${f1(l.t - t0)} ${l.text}`).join('\n    ') : ''}`);
  F.verdict(seenState.requested !== undefined && near(seenState.inbound ?? NaN, 1.6, 0.2) && near(seenState.arriving ?? NaN, 35) && near(Q.deployedAt - t0, 45, 0.1), 'the states: requested → inbound (+1.6) → arriving (ETA−10) → deployed (ETA)', `${Object.entries(seenState).map(([k, v]) => `${k} +${f1(v)}`).join(' → ')} → deployed +${f1(Q.deployedAt - t0)}`);
  const boots = audio.find(a => a.name === 'stairBoots'), slam = audio.find(a => a.name === 'stairDoor');
  F.verdict(!!boots && near(boots.t - t0, 35) && !!slam && near(slam.t - t0, 45, 0.1) && boots.pos && boots.pos[0] < 3.9, 'the sounds: boots on the stairs at ETA−10 from behind the door (on the landing), the steel door thrown at ETA', `stairBoots +${boots ? f1(boots.t - t0) : '—'} at x ${boots?.pos ? f1(boots.pos[0]) : '—'} · stairDoor +${slam ? f1(slam.t - t0) : '—'}`);
  const men = Q.men as any[];
  const kit = men.map(m => `${m.callsign}#${m.char.id} ${m.team} ${m.weapon.def.id} light ${m.flashlight.enabled ? 'on' : 'off'} trained ${m.trained} foe ${m.foe === 'player' ? 'Sam' : m.foe}`);
  const idsOk = new Set(game.guards.map((x: any) => x.char.id)).size === game.guards.length && men.every(m => m.char.id >= 20 && m.char.id < 250) && !game.guards.some((x: any) => !x.unit && x.char.id >= 20);
  F.verdict(men.length === 4 && game.guards.length === g0 + 4 && steadyLights(game) === L0 + 4 && men.every(m => m.team === 'guard' && m.unit && m.trained && m.weapon.def.id === 'aks74u' && guardsMod.rigOf(m) === 'carbine' && m.flashlight.enabled && m.foe === 'player') && Q.bangs + Q.log.filter((l: any) => l.what === 'bang-out').length === 4 && idsOk, 'four men: side guard (the shift\'s colleagues, Sam their foe), units, trained, AKS-74U rigged as the carbine with its light burning, +4 steady lights, four bangs in the pool, ids fresh, unique and inside the unit range', `${kit.join(' · ')} · bangs ${Q.bangs} · guards ${g0}→${game.guards.length} · steady lights ${L0}→${steadyLights(game)}`);
  // hostility both ways round, by the table the AI reads
  const teams = await import(`${ROOT}/src/game/teams.ts`);
  F.verdict(teams.isHostile(men[0].team, 'player') && teams.isHostile('player', men[0].team) && !teams.isHostile(men[0].team, 'guard'), 'by the sides table: they and Sam are enemies both ways, they and the shift are colleagues', `team ${men[0].team}`);
  // the door on arrival: unlatched and swung into the corridor at ETA, and the file: through it one at a time
  const ins = Q.log.filter((l: any) => /^in:/.test(l.what)).map((l: any) => l.t - Q.deployedAt);
  const gaps = ins.slice(1).map((t: number, i: number) => t - ins[i]);
  const d = game.doors.byName(QRF_MARKS.door);
  F.verdict(ins.length === 4 && gaps.every((x: number) => x >= 0.4) && Q.log.some((l: any) => l.what === 'door'), 'the entry: the door thrown at ETA and four men sent through it one at a time, ≥ 0.4 s apart', `door ${d ? f2(d.angle) : '—'} · in at +${ins.map(f2).join(' +')} (gaps ${gaps.map(f2).join(' ')})`);
  W.audioLog = null;
  return F.done();
}

// ================================================================ (c) the element: one unit — the walk, the room, the fight, the re-form
export async function qrfElement() {
  const F = family('qrf-element: they move as ONE element (the file never more than ~6 m end to end), take the room holding the fix together (stack, bang, all four in within 3 s of the first, one and two square to their corners), fight on sight as the guards do, and re-form when it goes cold');
  const W = await fresh(31, { eta: 15 }); const { game } = W;
  // Sam fires from INSIDE the server room doorway so the fix (and the alarm) is placed in that room, then vanishes: the element should walk the corridor in file and take the server room
  game.teleportPlayer([18.0, 0, 8.6]); game.player.slot = 'rifle'; game.player.holstered = false; step(W, 2, 0.7);
  for (let k = 0; k < 3; k++) { fireWeapon(game, game.player.char, [21.5, 1.2, 5.0], true); step(W, 10, 0.7); }
  step(W, 60, 0.7);   // a second lit in the doorway: somebody's eyes or ears put the fix in here
  raiseEscalation(game, 2); game.alarm.pos[0] = 18; game.alarm.pos[2] = 8; game.alarm.placed = true;
  hideSam(W);
  for (const x of game.guards) if (!x.unit) { x.lastKnown = [18.2, 0, 8.4]; }   // (the shift's fix: in the server room, where the rounds came from)
  const Q = game.qrf;
  let maxSpread = 0, spreadAt = '', moveFrames = 0; const server = game.level.clearPlans.find((p: any) => p.room === 'server room');
  let tStack = NaN, tFirstIn = NaN, tAllIn = NaN, cornersOk: boolean | null = null, cornerDetail = '', targetRoom = '';
  const inRoom = (m: any) => inBounds(m.char.pos, server.bounds, 0.1);
  for (let f = 0; f < 60 * 110; f++) {
    W.step(DT); game.player.visibility = 0.02;
    const el = Q.men.filter((m: any) => m.state !== 'dead');
    if (Q.state === 'deployed' && Q.phase === 'move' && el.length === 4) {
      moveFrames++;
      if (moveFrames > 90) { let s = 0; for (const a of el) for (const b of el) s = Math.max(s, v3.distXZ(a.char.pos, b.char.pos)); if (s > maxSpread) { maxSpread = s; spreadAt = `t ${f1(game.time)} ${el.map((m: any) => `${m.callsign}@${f1(m.char.pos[0])},${f1(m.char.pos[2])}`).join(' ')}`; } }
    } else moveFrames = 0;
    if (Q.phase === 'stack' && isNaN(tStack) && Q.target?.room === 'server room') tStack = game.time;
    if (!isNaN(tStack) && Q.target?.room === 'server room') {
      const n = el.filter(inRoom).length;
      if (n >= 1 && isNaN(tFirstIn)) tFirstIn = game.time;
      if (n >= 4 && isNaN(tAllIn)) tAllIn = game.time;
      if (Q.phase === 'called' && cornersOk === null) {   // as the room is called: one and two planted on the plan's points of domination, chests within 35° of the authored facing
        const errs = [0, 1].map(k => { const m = el[k]; const pod = server.entry[k][server.entry[k].length - 1]; return { d: v3.distXZ(m.char.pos, pod), a: Math.abs(wrapAngle(m.char.bodyYaw - server.podFace[k])) * 180 / Math.PI }; });
        cornersOk = errs.every(e => e.d < 0.9 && e.a < 35); cornerDetail = errs.map((e, k) => `#${k + 1} ${f2(e.d)} m off his point, ${e.a.toFixed(0)}° off its facing`).join(' · ');
      }
    }
    if (!targetRoom && Q.target?.kind === 'room') targetRoom = Q.target.room;
    if (Q.phase === 'hold' && Q.cleared.has('server room')) break;
  }
  F.verdict(maxSpread > 0 && maxSpread <= 6.5, 'on the move (a second into each leg and after): the four never more than 6.5 m end to end', `worst ${f2(maxSpread)} m — ${spreadAt}`);
  F.verdict(targetRoom === 'server room' && !isNaN(tStack), 'the room holding the fix (the server room) is the one they stack on first', `first room target ${targetRoom || '—'} · stacked at t ${f1(tStack)} · log: ${Q.log.filter((l: any) => /^target/.test(l.what)).map((l: any) => l.what.split(':').slice(1).join(':')).join(' → ')}`);
  F.verdict(!isNaN(tFirstIn) && tFirstIn - tStack < 12 && !isNaN(tAllIn) && tAllIn - tFirstIn <= 3.0, 'from the stack: the first man inside within 12 s (stack, shove, the bang cooking), all four inside within 3 s of him', `stack → first in ${f1(tFirstIn - tStack)} s · first → all four ${f2(tAllIn - tFirstIn)} s · beats: ${Q.log.filter((l: any) => l.t >= tStack - 0.01).slice(0, 8).map((l: any) => `${l.what}+${f1(l.t - tStack)}`).join(' ')}`);
  F.verdict(cornersOk === true, 'as it is called: one and two on the plan\'s points of domination, square to their corners (± 35°)', cornerDetail || 'never reached the call');
  F.verdict(Q.log.some((l: any) => l.what === 'bang') && Q.bangs === 3 && Q.cleared.has('server room') && game.clearedAt.has('server room'), 'a stun charge went in ahead of them (the pool 4 → 3), the room was called and written to the ledger the shift\'s pair reads', `bangs ${Q.bangs} · cleared ${[...Q.cleared.keys()].join(', ')} · shift ledger ${[...game.clearedAt.keys()].join(', ')}`);
  // the fight: Sam stood lit in the corridor in front of them → every man alert inside a second, on Sam; then Sam gone → after ~8 s cold they re-form and move again
  game.playerInvisible = false; const lead = Q.men.find((m: any) => m.state !== 'dead');
  const spot: Vec3 = [lead.char.pos[0] + Math.sin(lead.char.bodyYaw) * 3, 0, lead.char.pos[2] + Math.cos(lead.char.bodyYaw) * 3];
  const free = game.col.nav.isBlocked(spot[0], spot[2]) ? game.col.nav.nearestFreePoint(spot[0], spot[2]) : spot;
  game.teleportPlayer(free); game.player.crouch = false;
  let tAlert = NaN; const tShow = game.time;
  for (let f = 0; f < 60 * 3; f++) { game.player.visibility = 0.9; W.step(DT); if (isNaN(tAlert) && Q.phase === 'fight' && Q.men.filter((m: any) => m.state !== 'dead').every((m: any) => m.state === 'alert' && !m.script)) tAlert = game.time - tShow; }
  F.verdict(!isNaN(tAlert) && tAlert < 1.2, 'Sam stood lit three metres in front of the point man: the whole element off the script and ALERT inside 1.2 s (the AI has the fight)', `+${f2(tAlert)} s · ${Q.men.map((m: any) => `${m.callsign}:${m.state}${m.script ? '*' : ''} aw ${f2(m.awareness)}`).join(' ')}`);
  hideSam(W);
  let tRegroup = NaN; const tGone = game.time; let movedAgain = false;
  for (let f = 0; f < 60 * 30; f++) { W.step(DT); game.player.visibility = 0.02; if (isNaN(tRegroup) && Q.phase === 'regroup') tRegroup = game.time - tGone; if (!isNaN(tRegroup) && (Q.phase === 'move' || Q.phase === 'stack' || Q.phase === 'hold')) { movedAgain = true; break; } }
  F.verdict(!isNaN(tRegroup) && tRegroup >= 7.5 && tRegroup <= 16 && movedAgain, 'Sam gone: eight-odd seconds cold and they re-form on the point man, then move off again as one', `regroup +${f1(tRegroup)} s after he vanished · moving again ${movedAgain} · ${Q.men.map((m: any) => `${m.callsign}:${m.state}${m.script ? '*' : ''}`).join(' ')}`);
  F.verdict(Q.men.every((m: any) => m.state === 'dead' || m.state === 'alert' || m.state === 'search'), 'nobody of theirs is ever below the hunt (alert in the fight, search under the script)', Q.men.map((m: any) => `${m.callsign}:${m.state}`).join(' '));
  return F.done();
}

// ================================================================ (d) one wave
export async function qrfWave() {
  const F = family('qrf-wave: one wave a night — a second request is refused on the radio while they are inbound, while they are on the floor, and after every one of them is dead');
  const W = await fresh(41, { eta: 15 }); const { game } = W; const rx = tapRadio(game);
  goLoud(W); hideSam(W); const Q = game.qrf;
  step(W, 60);
  const r1 = requestQrf(game, 'gunfire'); const l1 = rx[rx.length - 1]?.text ?? '';
  for (let f = 0; f < 60 * 20 && Q.state !== 'deployed'; f++) W.step(DT);
  step(W, 120);
  Q.refusedAt = -100; const r2 = requestQrf(game, 'bodies'); const l2 = rx[rx.length - 1]?.text ?? '';
  for (const m of Q.men) if (m.state !== 'dead') killGuard(game, m, [1, 0, 0], false, 'shot', 'player');
  step(W, 120);
  Q.refusedAt = -100; game.qrf.loudT = game.time; step(W, 5);   // the trigger's own conditions stand again (lockdown, fresh gunfire): still nothing new
  const r3 = requestQrf(game, 'gunfire'); const l3 = rx[rx.length - 1]?.text ?? '';
  F.verdict(!r1 && /already rolling/.test(l1), 'inbound: refused — "already rolling"', `${r1} · "${l1}"`);
  F.verdict(!r2 && /everyone we've got/.test(l2), 'on the floor: refused — "that\'s everyone we\'ve got tonight"', `${r2} · "${l2}"`);
  F.verdict(!r3 && Q.state === 'deployed' && units(game).filter((u: any) => u.state !== 'dead').length === 0 && Q.lost === 4, 'all four dead: still deployed (spent), still refused, the losses counted', `${r3} · state ${Q.state} · lost ${Q.lost} · "${l3}"`);
  return F.done();
}

// ================================================================ (e) reset
export async function qrfReset() {
  const F = family('qrf-reset: restartEncounter puts everything back — no units, state idle and unspent, the steady lights and ids as they were, the stair door bolted and latched, the lot\'s lamps as authored, the mission\'s QRF mark cleared');
  const W = await fresh(51, { eta: 15, perimeter: true }); const { game } = W;
  const L0 = steadyLights(game), ids0 = game.guards.map((x: any) => x.char.id).join(','), lampW0 = game.targets.find((t: any) => t.name === 'street_lamp_w')?.on;
  goLoud(W); hideSam(W); const Q = game.qrf;
  for (let f = 0; f < 60 * 20 && Q.state !== 'deployed'; f++) W.step(DT);
  step(W, 60); callPerimeter(game, 'panel'); step(W, 60);
  const during = `${units(game).length} units · steady ${steadyLights(game)} · perim ${!!Q.perim} · lampW ${game.targets.find((t: any) => t.name === 'street_lamp_w')?.on} · mission.qrf ${game.mission.stats.qrf}`;
  game.restartEncounter(); step(W, 5);
  const d = game.doors.byName(QRF_MARKS.door);
  const f: string[] = [];
  if (units(game).length) f.push(`${units(game).length} units left`);
  if (game.qrf.state !== 'idle' || game.qrf.men.length || game.qrf.perim || game.qrf.requestedAt !== -1) f.push(`qrf ${game.qrf.state} men ${game.qrf.men.length} perim ${!!game.qrf.perim}`);
  if (steadyLights(game) !== L0) f.push(`steady lights ${steadyLights(game)} ≠ ${L0}`);
  if (game.guards.map((x: any) => x.char.id).join(',') !== ids0) f.push(`ids ${game.guards.map((x: any) => x.char.id).join(',')}`);
  if (!d || !d.locked || !d.latched || Math.abs(d.angle) > 1e-3 || d.lockBroken) f.push(`door locked ${d?.locked} latched ${d?.latched} angle ${d?.angle}`);
  if (game.targets.find((t: any) => t.name === 'street_lamp_w')?.on !== lampW0) f.push('street_lamp_w not restored');
  if (game.mission.stats.qrf !== 0 || game.mission.stats.qrfAt !== -1) f.push(`mission qrf ${game.mission.stats.qrf}/${game.mission.stats.qrfAt}`);
  // and it can all happen again (unspent): lockdown + rifle fire → requested
  game.playerInvisible = false; goLoud(W); step(W, 4);
  if (game.qrf.state === 'idle') f.push('not requestable again after the restart');
  F.verdict(f.length === 0, 'restart: everything back, and the trigger arms again', f.join(' · ') || `during: ${during} → after: 0 units, idle, steady ${L0}, ids ${ids0}, door bolted, lamp as authored; re-armed: ${game.qrf.state}`);
  // resetGuards alone (the tour's own reset) does the same to the men and the state
  { const W2 = await fresh(52, { eta: 15 }); const g2 = W2.game; goLoud(W2); hideSam(W2); for (let i = 0; i < 60 * 20 && g2.qrf.state !== 'deployed'; i++) W2.step(DT); step(W2, 30); g2.resetGuards(); step(W2, 2);
    F.verdict(units(g2).length === 0 && g2.qrf.state === 'idle', 'resetGuards (what the tour and the panel call): men gone, state idle', `units ${units(g2).length} · ${g2.qrf.state}`); }
  return F.done();
}

// ================================================================ (f) never under the tour
export async function qrfGating() {
  const F = family('qrf-gating: the showcase tour (its firefight stop fires real rounds on a floor it locks down) never requests the response team; nor does anything with the AI off');
  { Math.random = seeded(61); const W = await standUp(); const { game, cam, input } = W; game.tune.qrfEta = 15;
    const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
    const demo = new Demo(game, cam, W.smoke, input);
    let everState = 'idle', everUnits = 0, exc = '', frames = 0, finished = false, escMax = 0, shots = 0;
    demo.onStop = (fin: boolean) => { finished = fin; };
    try { demo.start(); for (frames = 0; frames < 60 * 240 && demo.active; frames++) { const p = demo.update(DT); W.step(DT, p); if (game.qrf.state !== 'idle') everState = game.qrf.state; everUnits = Math.max(everUnits, units(game).length); escMax = Math.max(escMax, game.escalation); shots += game.events.filter((e: any) => e.time === game.time && (e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1).length; } }
    catch (e: any) { exc = String(e?.stack ?? e).split('\n').slice(0, 2).join(' ⏎ '); }
    F.verdict(!exc && finished && everState === 'idle' && everUnits === 0, 'the tour, all stops to the hand-over: QRF idle throughout, no unit ever, no exception', `${exc || `${frames} frames`} · finished ${finished} · qrf ever ${everState} · units ever ${everUnits} · level-1 reports fired under it ${shots} · alarm peaked ${escMax}`); }
  { const W = await fresh(63); const { game } = W; game.aiEnabled = false; goLoud(W); step(W, 60, 0.5);
    F.verdict(game.qrf.state === 'idle', 'AI off: lockdown + rifle fire → nothing', game.qrf.state); }
  return F.done();
}

// ================================================================ (g) the renderer's budgets
export async function qrfLimits() {
  const F = family('qrf-limits: Sam + 3 staff + 4 QRF = the eight characters the shadow-capsule list holds — ten seconds of all of them alive and fighting with no exception, capsule / skin counts at their caps and not past them, a ninth character refused, the steady lights inside the buffer');
  const W = await fresh(71, { eta: 15 }); const { game, engine } = W;
  const { BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`); const { MAX_CHARS } = await import(`${ROOT}/src/anim/characters.ts`); const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`); const { MESH_MAX_CHARS } = await import(`${ROOT}/src/render/meshbvh.ts`);
  goLoud(W); const Q = game.qrf;
  for (let f = 0; f < 60 * 20 && Q.state !== 'deployed'; f++) W.step(DT);
  game.playerInvisible = false; game.teleportPlayer([9, 0, 11.2]);
  let exc = '', maxChars = 0, maxCaps = 0, maxSteady = 0, maxActive = 0;
  try { for (let f = 0; f < 60 * 10; f++) { game.player.visibility = 0.8; W.step(DT); engine.lights.upload(game.time); maxChars = Math.max(maxChars, engine.world.charCount); maxCaps = Math.max(maxCaps, engine.world.capsuleCount); maxSteady = Math.max(maxSteady, steadyLights(game)); maxActive = Math.max(maxActive, engine.lights.activeCount ?? 0); } }
  catch (e: any) { exc = String(e?.stack ?? e).split('\n').slice(0, 3).join(' ⏎ '); }
  F.verdict(!exc, 'ten seconds of eight characters in a fight: no exception from the game or the CPU halves of the renderer', exc || `ok · ${game.guards.map((x: any) => `${x.callsign}:${x.state}`).join(' ')}`);
  F.verdict(1 + game.guards.length === 8 && maxChars === 8 && maxCaps === 8 * BoxWorld.CAPS_PER_CHAR && maxCaps <= BoxWorld.MAX_CAPSULES && 8 <= MAX_CHARS && 8 <= MESH_MAX_CHARS, 'characters: 8 listed, 8 uploaded (the capsule list\'s cap, none dropped), 8 × 15 capsules ≤ 128, within the skinning (16) and mesh-shadow (8) slots', `chars ${1 + game.guards.length} · uploaded ${maxChars} · capsules ${maxCaps}/${BoxWorld.MAX_CAPSULES} · skin slots ${MAX_CHARS} · mesh-shadow slots ${MESH_MAX_CHARS}`);
  let err = ''; try { spawnUnit(game, { team: 'guard', pos: [20, 0, 18] }); } catch (e: any) { err = String(e?.message ?? e); }
  F.verdict(/budget/.test(err) && 1 + game.guards.length === 8, 'a ninth character is refused with the budget named (so the perimeter tier must peel, not spawn, on this floor)', err ? `"${err.slice(0, 100)}…"` : 'no error');
  F.verdict(maxSteady <= MAX_LIGHTS && maxActive <= MAX_LIGHTS, 'lights: steady lights (their four weapon lights included) and the frame\'s active count inside the 64-slot buffer', `steady peak ${maxSteady} · active peak ${maxActive} · cap ${MAX_LIGHTS}`);
  return F.done();
}

// ================================================================ (h) the perimeter tier
export async function qrfPerimeter() {
  const F = family('qrf-perimeter: the compound locked down round him — each of its three triggers, control\'s word, the lot\'s lamps up (and back on a restart), men on the outside posts within ETA+10 facing the doors, the fire exit still the way out, nothing spawned past the budget, ids distinct');
  // the three triggers, each on its own run: a QRF man killed; three men down; a running gunfight after they have settled in
  for (const [k, why] of [[0, 'a QRF man down'], [1, '3 men down'], [2, 'a running gunfight']] as [number, string][]) {
    const W = await fresh(81 + k, { eta: 15, perimeter: true }); const { game } = W; goLoud(W); hideSam(W); const Q = game.qrf;
    for (let f = 0; f < 60 * 20 && Q.state !== 'deployed'; f++) W.step(DT);
    step(W, 60 * 10);   // ten seconds on the floor (past the settle-in) with nothing happening: no perimeter yet
    const before = !!Q.perim;
    if (k === 0) killGuard(game, Q.men[1], [1, 0, 0], false, 'shot', 'player');
    if (k === 1) { const staff = game.guards.filter((x: any) => !x.unit && x.state !== 'dead'); for (const s of staff.slice(0, 3)) killGuard(game, s, [1, 0, 0], true, 'struck', 'player'); }
    if (k === 2) { game.playerInvisible = false; game.teleportPlayer([37, 0, 8]); for (let i = 0; i < 3; i++) { fireWeapon(game, game.player.char, [39.5, 1.0, 8], true); step(W, 20, 0.1); } hideSam(W); }
    step(W, 30);
    F.verdict(!before && !!Q.perim && new RegExp(why.replace(/[()]/g, '.')).test(Q.log.map((l: any) => l.what).join(' ')), `trigger ${k + 1}: ${why} → the perimeter is called (and not before it)`, `before ${before} · after ${!!Q.perim} · ${Q.log.filter((l: any) => /^perimeter/.test(l.what)).map((l: any) => l.what).join(' ')}`);
  }
  // the full run of it: called by hand on a deployed element; lamps, posts, facing, timing, ids, budget; then the exit
  const W = await fresh(90, { eta: 15, perimeter: true }); const { game } = W; const rx = tapRadio(game); game.tune.perimeterEta = 45;
  const lampsAuth = game.targets.filter((t: any) => t.group === 'exterior').map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join(' ');
  goLoud(W); hideSam(W); const Q = game.qrf;
  for (let f = 0; f < 60 * 20 && Q.state !== 'deployed'; f++) W.step(DT);
  step(W, 60 * 6);
  const g0 = game.guards.length; const ok = callPerimeter(game, 'panel'); const tCall = game.time;
  const P = Q.perim;
  F.verdict(ok && !!P && P.spawned === 0 && P.peeled === 2 && game.guards.length === g0 && Q.men.filter((m: any) => m.state !== 'dead').length === 2 && game.mission.stats.qrf === 2, 'called on this floor: nothing to spawn into (8 of 8) — the element\'s rear pair peels off, two stay inside; the mission marked for the debrief', `spawned ${P?.spawned} peeled ${P?.peeled} · guards ${g0}→${game.guards.length} · element left ${Q.men.filter((m: any) => m.state !== 'dead').map((m: any) => m.callsign).join(',')} · outside ${P?.men.map((p: any) => `${p.gd.callsign}→${p.post.name}`).join(', ')} · mission.qrf ${game.mission.stats.qrf}`);
  F.verdict(game.targets.filter((t: any) => t.group === 'exterior').every((t: any) => t.on) && rx.some(l => /lock the compound down/.test(l.text)), 'control says it and the lot\'s lamps all come up (the dark west one too)', `"${rx.find(l => /lock the compound down/.test(l.text))?.text.slice(0, 70) ?? '—'}…" · lamps ${game.targets.filter((t: any) => t.group === 'exterior').map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join(' ')} (authored ${lampsAuth})`);
  let tSet = NaN;
  for (let f = 0; f < 60 * 70; f++) { W.step(DT); if (isNaN(tSet) && P!.state === 'set') tSet = game.time - tCall; if (!isNaN(tSet) && game.time - tCall > tSet + 2) break; }
  const posts = P!.men.map((p: any) => ({ name: p.post.name, d: v3.distXZ(p.gd.char.pos, p.post.pos), a: Math.abs(wrapAngle(p.gd.char.bodyYaw - p.post.yaw)) * 180 / Math.PI, arrived: p.arrivedAt >= 0 ? p.arrivedAt - tCall : NaN, pinned: p.gd.pinned, id: p.gd.char.id }));
  F.verdict(!isNaN(tSet) && tSet <= 45 + 10 && posts.every((p: any) => p.d < 1.0 && p.a < 35 && p.pinned) && rx.some(l => /perimeter set/.test(l.text)), 'within ETA+10: both on their posts (< 1 m), facing the door they cover (± 35°), pinned there, and it is said on the net', `set +${f1(tSet)} s · ${posts.map((p: any) => `${p.name}: ${f2(p.d)} m, ${p.a.toFixed(0)}°, arrived +${f1(p.arrived)} s, pinned ${p.pinned}, #${p.id}`).join(' · ')}`);
  F.verdict(new Set(game.guards.map((x: any) => x.char.id)).size === game.guards.length && 1 + game.guards.length <= 8, 'ids all distinct, characters within the budget', `ids ${game.guards.map((x: any) => x.char.id).join(',')} · chars ${1 + game.guards.length}`);
  // the way out is still the way out: Sam (god mode) at the exfil stage walks out through the fire exit's frame → done; and how long a lit man lasts out there
  game.mission.stage = 'exfil'; game.playerInvisible = false; game.player.crouch = false;
  game.teleportPlayer([35.2, 0, 20.6]); step(W, 2, 0.3);
  const fireExit = game.doors.byName('fire_exit'); if (fireExit) game.doors.use(fireExit, game.player.char.pos, 1);
  let tSeen = NaN; const tOut = game.time; let done = false;
  const post = P!.men.find((p: any) => p.post.name === 'fire exit');
  for (let f = 0; f < 60 * 12; f++) {
    const pc = game.player.char; const E = lightEstimateAt(game, pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0])); game.player.visibility = game.visibilityOf(E);   // (headless the meter never answers: the CPU estimate of the same lights stands in — the lot's lamps and their weapon lights)
    if (f < 60 * 4) { W.input.keys.add('KeyD'); } else W.input.keys.delete('KeyD');   // walk east out through the frame and on into the lot for four seconds, then stand
    W.step(DT);
    if (isNaN(tSeen) && post && (post.gd.sawPlayerThisFrame || (post.gd.state === 'alert' && !post.gd.script))) tSeen = game.time - tOut;
    if (game.mission.stage === 'done') done = true;
  }
  W.input.keys.delete('KeyD');
  F.verdict(done, 'the mission still completes through the fire exit (god mode: he walks out through the frame and it is done)', `stage ${game.mission.stage} · Sam at ${f1(game.player.char.pos[0])},${f1(game.player.char.pos[2])}`);
  console.log(`    (exfil under the perimeter, walking straight out lit by the east lamp: the fire-exit post had eyes on him ${isNaN(tSeen) ? 'NEVER in 12 s' : `+${f2(tSeen)} s after the door`}; his meter out there read ${f2(game.player.visibility)}; Sam ${game.player.down ? 'DOWN' : 'up (god mode)'} — the post man ${post ? `${post.gd.callsign} ${post.gd.state}, ${f1(v3.distXZ(post.gd.char.pos, game.player.char.pos))} m off` : 'absent'})`);
  // restart: lamps back as authored
  game.restartEncounter(); step(W, 3);
  F.verdict(game.targets.filter((t: any) => t.group === 'exterior').map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join(' ') === lampsAuth && !game.qrf.perim && units(game).length === 0, 'restart: the lamps as authored again, no perimeter, no units', game.targets.filter((t: any) => t.group === 'exterior').map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join(' '));
  return F.done();
}
