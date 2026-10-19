// The 'debrief' family (run through probes.ts: `bun run tools/qa/probes.ts debrief` — also in 'all'): the run's chronicle and the debrief made of it
// (src/game/chronicle.ts, ui/debrief.ts). What is held:
//   debrief-run    (a) a scripted run writes the expected timeline, in order, with the right rooms, and scores in the expected band with the expected badges —
//                      seen once by a staged corridor man → he loses Sam → gives the search up → the floor goes up (a radio line with it) → grabbed, questioned to
//                      his key, choked out → a door kicked in → a muffled shot a second man hears; and a quiet run — a lock picked, a panel OCP'd, an exit sign
//                      shot out, a canister thrown, the mission walked to its end — that comes out GHOST with the quiet badges lit and the end card asked for;
//                  (b) restartEncounter empties it (timeline, path, counters) and the tour's flag keeps it empty;
//   debrief-rooms  (c) roomOf() names thirteen known points right (the eight rooms + the four sides of the grounds) and the level's spawn / rack / exfil marks;
//   debrief-doorname (c2) a kicked, picked or keyed door's row calls it what its level calls it (WORDS.doors), worded when the row is read;
//   debrief-charge (c3) the rows a wall charge makes are worded as a charge's (no 'shot dead', no 'round');
//   debrief-score  (d) the score only ever goes down: from 300 random records, bumping any one count never raises it; a clean record scores ≥ 90 (GHOST); a kill
//                      costs more than a knockout; the bands are ordered;
//   debrief-dom    (e) the card builds headlessly on a small fake DOM off a finished run: rating + score, the stats grid, eight chips, a timeline row per entry,
//                      a pin per pinned entry + the three marks, and the copy button's line.
import { standUp, ROOT } from './headless.ts';
import { endFor } from './verbs.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const CH = await import(`${ROOT}/src/game/chronicle.ts`);
const { roomOf, stealthScore, ratingOf, badgesOf, blankCounts, debriefOf, fmtEvent, pinned, BANDS, SCORE } = CH;
const { startGrab, startKick, startPicking, throwOrigin, doThrow } = await import(`${ROOT}/src/game/player.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { DRIVE_SECS } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked on the north verge (grass, outside the walls, far from every fixture the runs touch), held, facing north, deaf */
function park(gd: any, i: number) { gd.hold = true; place(gd, [8 + i * 3, 0, 1.6], Math.PI); gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
const f1 = (x: number) => x.toFixed(1);
const steps = (W: any, secs: number, until?: () => boolean) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { W.step(DT); if (until?.()) return true; } return !until; };
/** is `want` a subsequence of `got` (other rows may sit between) — returns the first wanted kind that could not be matched, or '' */
function subseqMiss(got: string[], want: string[]): string { let i = 0; for (const k of got) if (i < want.length && k === want[i]) i++; return i < want.length ? want[i] : ''; }
const kindsOf = (game: any): string[] => game.chronicle.events.map((e: any) => e.kind);
const verdictLine = (ok: boolean, label: string, detail: string, fails: string[]) => console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);

// ================================================================ (a) + (b)
export async function debriefRun() {
  console.log('\n=== debrief-run: a scripted run writes the expected timeline (kinds in order, rooms), the score lands in the expected band with the expected badges; a quiet run to the end comes out GHOST and asks for the card; a restart empties it ===');
  let allPass = true;
  // ---------------------------------------------------------------- (a1) the loud half: seen → lost → calm → the floor up → grab / question / key / choke → a door kicked in → a muffled shot heard
  let carried: any = null;
  {
    Math.random = seeded(9051);
    const W = await standUp(); const { game } = W; const fails: string[] = []; const notes: string[] = [];
    game.player.visibility = 0.02; game.godMode = true; game.player.slot = 'pistol'; game.player.holstered = true;
    steps(W, 0.1);
    const [A, B, Cc] = game.guards;   // Kowalski (corridor), Novak (cubicles), Reyes (lobby / break room)
    park(B, 1); park(Cc, 2);
    A.hold = false; place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; A.heardUpTo = game.eventSeq;
    rollcallState(game).nextAt = game.time + 900;
    // seen: Sam planted 4 m in front of him, lit
    game.teleportPlayer([18, 0, 11.2]); game.player.crouch = false; steps(W, DT); game.player.visibility = 1.0;
    const seenAt = game.time;
    const spotted = steps(W, 6, () => game.mission.stats.spotted > 0);
    if (!spotted) fails.push(`never spotted in 6 s lit in front of ${A.callsign} (his state ${A.state}, awareness ${f1(A.awareness)})`);
    notes.push(`spotted after ${f1(game.time - seenAt)} s (${A.callsign} ${A.state})`);
    // gone: across the floor, dark — he runs to the spot, loses him, searches, gives up; the floor goes up a step on it
    game.teleportPlayer([33, 0, 20]); game.player.visibility = 0.02; steps(W, DT);
    const lostBy = steps(W, 40, () => kindsOf(game).includes('lost'));
    const calmBy = steps(W, 45, () => kindsOf(game).includes('calm'));
    const upBy = steps(W, 10, () => game.escalation >= 1);
    if (!lostBy || !calmBy || !upBy) fails.push(`the hunt did not run its course: lost ${lostBy} calm ${calmBy} floor-up ${upBy} (${A.callsign} ${A.state}, escalation ${game.escalation})`);
    notes.push(`hunt over at +${f1(game.time - seenAt)} s, floor ${game.escalation}`);
    steps(W, 1.0);
    // grabbed from behind, questioned until the door (and his key) comes, choked out
    place(A, [16, 0, 11.2], Math.PI / 2); A.hold = false;
    game.teleportPlayer([15.2, 0, 11.2]); game.player.crouch = true; steps(W, DT); game.player.visibility = 0.02;
    startGrab(game, A);
    const held = steps(W, 3, () => game.player.holding?.phase === 'held');
    if (!held) fails.push(`the grab never settled (holding ${game.player.holding?.phase ?? 'none'}, ${A.callsign} ${A.state})`);
    game.player.fHeld = false; steps(W, DT);
    let gave: string | null = null; const kinds: string[] = [];
    for (let i = 0; i < 8 && gave !== 'door'; i++) { const p = game.interrogate(A, seeded(60 + i)); gave = p?.kind ?? null; if (p?.kind) kinds.push(p.kind); steps(W, 0.5); }
    if (gave !== 'door') fails.push(`eight exchanges never brought the keyed door (gave [${kinds.join(',') || 'nothing'}])`);
    if (!game.player.keys.size) fails.push('no key came off him');
    notes.push(`questioned: gave [${kinds.join(',') || '—'}], keys [${[...game.player.keys].join(',')}]`);
    if (game.player.holding) { endFor(W, HOLD.secs.chokeHold + HOLD.secs.choke + 0.3); steps(W, 0.6); }
    if (A.state !== 'dead' || A.downKind !== 'choked') fails.push(`the choke did not put him down breathing (${A.state} / ${A.downKind})`);
    // a door kicked in (nobody able to hear it: the parked pair are deaf, the corridor man is out)
    const storage = game.doors.byName('storage');
    game.teleportPlayer([32.6, 0, 10.9]); game.player.crouch = false; game.player.char.bodyYaw = Math.PI; steps(W, 2 * DT);
    startKick(game, storage);
    const kicked = steps(W, 2.0, () => storage.lockBroken); steps(W, 0.8);
    if (!kicked) fails.push(`the kick never landed (kick ${!!game.player.kick}, lockBroken ${storage.lockBroken})`);
    // a muffled shot three metres behind the cubicle man (un-deafened, planted facing away): he hears it, looks into it, raises nothing
    B.heardUpTo = game.eventSeq; place(B, [20, 0, 18], Math.PI); B.hold = true;
    game.teleportPlayer([20, 0, 21]); game.player.crouch = true; game.player.slot = 'pistol'; game.player.holstered = false; steps(W, 0.3); game.player.visibility = 0.02;
    const alertsBefore = game.mission.stats.alerts;
    fireWeapon(game, game.player.char, [20, 0.4, 23.6], true);
    steps(W, 1.5);
    if (game.mission.stats.alerts !== alertsBefore || B.state === 'alert') fails.push(`the muffled shot raised an alarm (alerts ${alertsBefore} → ${game.mission.stats.alerts}, ${B.callsign} ${B.state})`);
    // ---- the timeline
    const ev = game.chronicle.events as any[]; const kindsGot = kindsOf(game);
    const WANT = ['contact', 'spotted', 'lost', 'calm', 'alarm', 'grab', 'interrogated', 'keyTaken', 'ko', 'doorKicked', 'shot', 'heard'];
    const miss = subseqMiss(kindsGot, WANT);
    if (miss) fails.push(`timeline kinds [${kindsGot.join(' ')}] — '${miss}' missing / out of order (want the subsequence ${WANT.join(' › ')})`);
    const first = (k: string) => ev.find(e => e.kind === k);
    const roomWant: Record<string, string> = { contact: 'corridor', spotted: 'corridor', grab: 'corridor', ko: 'corridor', doorKicked: 'corridor', shot: 'cubicles', heard: 'cubicles' };
    for (const [k, r] of Object.entries(roomWant)) { const e = first(k); if (e && e.room !== r) fails.push(`'${k}' happened in '${e.room}' (want '${r}')`); }
    { const e = first('contact'); if (e && (e.data.who !== A.callsign || e.data.cause !== 'sight')) fails.push(`contact row: ${JSON.stringify(e.data)} (want ${A.callsign} by sight)`); }
    { const e = first('spotted'); if (e && (e.data.by !== A.callsign || e.data.lvl !== 0)) fails.push(`spotted row: ${JSON.stringify(e.data)} (want by ${A.callsign}, floor calm)`); }
    { const e = first('alarm'); if (e && (!e.data.up || e.data.stage !== 1 || e.data.cause !== 'search')) fails.push(`alarm row: ${JSON.stringify(e.data)} (want ▲ heightened, cause search)`); }
    if (!ev.some(e => e.kind === 'radio' && e.t >= (first('alarm')?.t ?? 1e9) - 1e-6)) fails.push('no radio row with / after the floor going up (the order goes over the net)');
    { const e = first('ko'); if (e && (e.data.who !== A.callsign || e.data.method !== 'choke')) fails.push(`ko row: ${JSON.stringify(e.data)} (want ${A.callsign} choked)`); }
    { const e = first('doorKicked'); if (e && e.data.door !== 'storage') fails.push(`doorKicked row: ${JSON.stringify(e.data)}`); }
    { const e = first('heard'); if (e && (e.data.what !== 'a muffled shot' || !String(e.data.by).includes(B.callsign) || e.data.react === 'alerted')) fails.push(`heard row: ${JSON.stringify(e.data)} (want a muffled shot · ${B.callsign} investigates)`); }
    { const e = first('shot'); if (e && (e.data.near !== false || e.data.into !== 'geometry')) fails.push(`shot row: ${JSON.stringify(e.data)} (want into geometry, nobody near)`); }
    if (ev.some(e => e.kind === 'kill' || e.kind === 'bodyFound' || e.kind === 'down')) fails.push(`rows that cannot have happened: ${kindsGot.filter(k => k === 'kill' || k === 'bodyFound' || k === 'down').join(',')}`);
    for (let i = 1; i < ev.length; i++) if (ev[i].t < ev[i - 1].t - 1e-9) { fails.push(`timeline not in time order at row ${i} (${fmtEvent(ev[i - 1])} then ${fmtEvent(ev[i])})`); break; }
    // ---- the numbers, the score, the badges
    const D = debriefOf(game); const c = D.counts;
    if (c.seen !== 1 || c.alarms !== 1 || c.esc1 !== 1 || c.esc2 !== 0 || c.kos !== 1 || c.kills !== 0 || c.kicked !== 1 || c.picked !== 0 || c.keys !== 1 || c.shots !== 1 || c.shotsNearMen !== 0 || c.bodies !== 0) fails.push(`counts: seen ${c.seen} alarms ${c.alarms} esc ${c.esc1}/${c.esc2} kos ${c.kos} kills ${c.kills} kicked ${c.kicked} picked ${c.picked} keys ${c.keys} shots ${c.shots} near ${c.shotsNearMen} bodies ${c.bodies} (want 1 1 1/0 1 0 1 0 1 1 0 0)`);
    const wantScore = 100 - SCORE.seen - SCORE.alarm - SCORE.heightened - SCORE.ko;
    if (D.score !== wantScore || D.rating !== 'SHADOW' || D.state !== 'sofar') fails.push(`score ${D.score} ${D.rating} (${D.state}) — want ${wantScore} SHADOW sofar; docked: ${D.lines.map((l: any) => `−${l.pts} ${l.label}`).join(', ')}`);
    const on = new Set(D.badges.filter((b: any) => b.on).map((b: any) => b.id));
    for (const [id, want] of [['nokills', true], ['pacifist', true], ['unseen', false], ['quiet', false], ['locksmith', false], ['talkative', false], ['speedrun', false], ['lightsout', false]] as const) if (on.has(id) !== want) fails.push(`badge '${id}' ${on.has(id) ? 'lit' : 'dim'} (want ${want ? 'lit' : 'dim'})`);
    if (game.chronicle.pathN < 4) fails.push(`path has ${game.chronicle.pathN} points after ${f1(c.elapsed)} s of run`);
    if (!/^twopointsix — SHADOW \d+ · \d\d:\d\d · seen 1 · alarms 1 · /.test(D.summary) || !/run so far/.test(D.summary)) fails.push(`summary line: "${D.summary}"`);
    notes.push(`timeline (${ev.length}): ${ev.map((e: any) => fmtEvent(e)).join(' | ')}`);
    notes.push(`→ ${D.rating} ${D.score} · badges [${[...on].join(', ')}] · path ${game.chronicle.pathN} pts`);
    const ok = fails.length === 0; allPass &&= ok;
    verdictLine(ok, '(a1) seen once by the corridor man → lost → he gives up → floor ▲ heightened (+ the radio) → grabbed, questioned to his key, choked out → the storage door kicked in → a muffled shot the cubicle man hears: those rows in that order in those rooms, counts 1/1/1/1ko/1kick/1key/1shot, score = 100 − seen − alarm − heightened − ko = SHADOW, no kills + pacifist lit, the rest dim', notes.join('\n    '), fails);
    carried = W;
  }
  // ---------------------------------------------------------------- (b) restart empties it; the tour's flag keeps it empty
  {
    const W = carried; const { game } = W; const fails: string[] = [];
    const old = game.chronicle;
    game.restartEncounter(); steps(W, DT);
    const C = game.chronicle;
    if (C === old) fails.push('restartEncounter kept the same Chronicle object');
    if (C.events.length || C.pathN > 1 || C.dropped || C.questioned.size || Object.entries(C.counts).some(([, v]) => v !== 0 && v !== false && v !== '')) fails.push(`after restart: ${C.events.length} rows, ${C.pathN} path pts, counts ${JSON.stringify(C.counts)}`);
    if (game.mission.stats.spotted || game.mission.stats.alerts || debriefOf(game).score !== 100) fails.push(`after restart the mission stats / score are not fresh (${JSON.stringify(game.mission.stats)}, ${debriefOf(game).score})`);
    // under the tour's flag nothing lands: a shot, a generic row, the path
    game.quietUtility = true; const n0 = C.events.length, p0 = C.pathN, shots0 = game.mission.stats.shots;
    game.player.slot = 'pistol'; game.player.holstered = false; steps(W, 0.2);
    fireWeapon(game, game.player.char, [game.player.char.pos[0] + 3, 0.5, game.player.char.pos[2]], true);
    CH.chronicle(game, 'checkpoint', { what: 'save' }); steps(W, 2.0);
    if (C.events.length !== n0 || C.pathN !== p0 || game.mission.stats.shots !== shots0) fails.push(`under quietUtility: rows ${n0} → ${C.events.length}, path ${p0} → ${C.pathN}, shots ${shots0} → ${game.mission.stats.shots} (want nothing to move)`);
    game.quietUtility = false; steps(W, 1.2);
    if (C.pathN <= p0) fails.push('with the flag down again the path did not resume');
    const e = CH.chronCheckpoint(game, 'load', 'probe'); if (!e || game.chronicle.counts.loads !== 1 || e.kind !== 'checkpoint') fails.push(`chronCheckpoint('load') live: row ${e?.kind}, loads ${game.chronicle.counts.loads}`);
    const ok = fails.length === 0; allPass &&= ok;
    verdictLine(ok, '(b) restartEncounter hands the game a fresh, empty chronicle (rows, path, counters, questioned) with fresh stats; under the tour\'s quietUtility a shot / a row / the path sample land nowhere; the flag down again, the path resumes and G5\'s checkpoint seam writes and counts', `rows ${C.events.length}, path ${C.pathN}, loads ${C.counts.loads}`, fails);
  }
  // ---------------------------------------------------------------- (a2) the quiet half, to the end: pick, OCP, a sign shot out, a canister, the mission → GHOST, the card asked for
  {
    Math.random = seeded(9052);
    const W = await standUp(); const { game, level } = W; const fails: string[] = []; const notes: string[] = [];
    game.player.visibility = 0.02; game.player.slot = 'pistol'; game.player.holstered = true;
    steps(W, 0.1);
    game.guards.forEach((gd: any, i: number) => park(gd, i)); rollcallState(game).nextAt = game.time + 900;
    // the server door's lock, picked
    const server = game.doors.byName('server');
    game.teleportPlayer([17.6, 0, 10.75]); game.player.crouch = true; game.player.char.bodyYaw = Math.PI; steps(W, 2 * DT);
    startPicking(game, server);
    const picked = steps(W, 9, () => !server.locked); steps(W, 0.3);
    if (!picked) fails.push(`the pick never opened it (picking ${!!game.player.picking}, pick ${f1(server.pick)}, locked ${server.locked})`);
    // a corridor panel, OCP'd
    const panel = game.targets.find((t: any) => t.kind === 'emissive' && t.interactive && t.group === 'corridor' && /^panel_/.test(t.name) && t.factor > 0);
    if (!panel) fails.push('staging: no lit corridor panel to OCP'); else { game.ocp(panel); if (panel.disabledUntil <= game.time) fails.push('the OCP did not take'); }
    // the west exit sign, shot out from four metres
    const sign = game.targets.find((t: any) => t.name === 'exit_sign_w');
    game.teleportPlayer([8.5, 0, 11.1]); game.player.crouch = false; game.player.char.bodyYaw = -Math.PI / 2; game.player.holstered = false; steps(W, 0.3);
    if (!sign) fails.push('staging: no exit_sign_w target'); else { fireWeapon(game, game.player.char, sign.pos, true); steps(W, 0.2); if (!sign.broken) fails.push('the round did not break the exit sign'); }
    // a smoke canister into the lobby
    { const sol = game.items.solve(throwOrigin(game), [8.5, 0.1, 15]); doThrow(game, sol, 'smoke'); const thrown = steps(W, 2.0, () => kindsOf(game).includes('thrown')); if (!thrown) fails.push('the canister never left his hand'); }
    // the mission: into the server room, the drive, out through the fire exit
    const M = level.mission;
    game.player.holstered = true; game.teleportPlayer([18.0, 0, 8.9]); steps(W, 0.3);
    if (game.mission.stage !== 'drive') fails.push(`in the server room the stage is ${game.mission.stage} (want drive)`);
    game.teleportPlayer([M.rack.front[0], 0, M.rack.front[2] + 0.65]); game.player.crouch = false; steps(W, 2 * DT);
    W.cursorAt(M.rack.front); steps(W, DT);
    let pressed = false;
    for (let i = 0; i < Math.round((DRIVE_SECS + 2.5) / DT) && !game.mission.pulled; i++) { W.cursorAt(M.rack.front); if (!pressed && game.selectVerb('objective', 'drive')) { W.input.pressed.add('Space'); pressed = true; } W.step(DT); }
    if (!game.mission.pulled) fails.push(`the drive did not come out (pressed ${pressed}, driveT ${f1(game.mission.driveT)}, stage ${game.mission.stage}, Sam ${f1(Math.hypot(game.player.char.pos[0] - M.rack.front[0], game.player.char.pos[2] - M.rack.front[2]))} m off the rack)`);
    game.teleportPlayer([36.9, 0, 20.6]); steps(W, 0.3);
    if (game.mission.stage !== 'done') fails.push(`past the fire exit the stage is ${game.mission.stage} (want done)`);
    if (!game.mission.debrief) fails.push('mission.debrief was not raised for the end card');
    // ---- the timeline, the numbers, the badges
    const ev = game.chronicle.events as any[]; const kindsGot = kindsOf(game);
    const WANT = ['lockPicked', 'ocp', 'lightShot', 'shot', 'thrown', 'objective', 'objective', 'objective', 'objective'];
    const miss = subseqMiss(kindsGot, WANT); if (miss) fails.push(`timeline kinds [${kindsGot.join(' ')}] — '${miss}' missing / out of order (want ${WANT.join(' › ')})`);
    const objs = ev.filter(e => e.kind === 'objective');
    if (objs.length !== 4 || objs[0].room !== 'server room' || !/server room/.test(objs[0].data.text) || !/hands on/.test(objs[1]?.data.text ?? '') || !/drive is out/.test(objs[2]?.data.text ?? '') || !/fire exit/.test(objs[3]?.data.text ?? '') || objs[3]?.room !== 'east side') fails.push(`objective rows: ${objs.map(o => `${o.room}: ${o.data.text}`).join(' | ')}`);
    { const e = ev.find(x => x.kind === 'lockPicked'); if (e && (e.data.door !== 'server' || e.room !== 'corridor')) fails.push(`lockPicked row ${e.room} ${JSON.stringify(e.data)}`); }
    { const e = ev.find(x => x.kind === 'lightShot'); if (e && (!/exit sign/.test(String(e.data.name)) || e.room !== 'corridor')) fails.push(`lightShot row ${e.room} ${JSON.stringify(e.data)}`); }
    { const e = ev.find(x => x.kind === 'ocp'); if (e && !/corridor ceiling panel/.test(String(e.data.what))) fails.push(`ocp row ${JSON.stringify(e.data)}`); }
    if (ev.some(e => ['contact', 'spotted', 'alarm', 'heard', 'kill', 'ko', 'down'].includes(e.kind))) fails.push(`rows a quiet run cannot have: ${kindsGot.join(' ')}`);
    const D = debriefOf(game); const c = D.counts;
    if (c.picked !== 1 || c.kicked !== 0 || c.ocps !== 1 || c.lightsShot !== 1 || c.thrown !== 1 || c.shots !== 1 || c.seen || c.alarms || c.kills || c.kos) fails.push(`counts: picked ${c.picked} kicked ${c.kicked} ocps ${c.ocps} lights ${c.lightsShot} thrown ${c.thrown} shots ${c.shots} seen ${c.seen} alarms ${c.alarms}`);
    if (D.score !== 100 - SCORE.light || D.rating !== 'GHOST' || D.state !== 'done') fails.push(`score ${D.score} ${D.rating} ${D.state} (want ${100 - SCORE.light} GHOST done)`);
    const on = new Set(D.badges.filter((b: any) => b.on).map((b: any) => b.id));
    for (const [id, want] of [['unseen', true], ['quiet', true], ['nokills', true], ['pacifist', true], ['locksmith', true], ['speedrun', true], ['lightsout', false], ['talkative', false]] as const) if (on.has(id) !== want) fails.push(`badge '${id}' ${on.has(id) ? 'lit' : 'dim'} (want ${want ? 'lit' : 'dim'})`);
    if (!/^twopointsix — GHOST 99 · 00:\d\d · seen 0 · alarms 0 · bodies found 0 · KOs 0 · kills 0 · shots 1 · OCP 1 · doors kicked 0 \/ picked 1 · .*locksmith/.test(D.summary) || /run so far|went down/.test(D.summary)) fails.push(`summary line: "${D.summary}"`);
    if (!/GHOST 99/.test(game.objectiveText())) fails.push(`objective line once done: "${game.objectiveText()}"`);
    // nothing more is written once done: a shot now changes neither the rows nor the shots
    { const n0 = ev.length, s0 = game.mission.stats.shots; game.player.holstered = false; steps(W, 0.2); fireWeapon(game, game.player.char, [30, 0.5, 20.6], true); steps(W, 0.6); if (game.chronicle.events.length !== n0 || game.mission.stats.shots !== s0) fails.push(`after 'done' a shot still wrote (rows ${n0} → ${game.chronicle.events.length}, shots ${s0} → ${game.mission.stats.shots})`); }
    notes.push(`timeline (${ev.length}): ${ev.map((e: any) => fmtEvent(e)).join(' | ')}`);
    notes.push(`→ ${D.rating} ${D.score} in ${f1(c.elapsed)} s · badges [${[...on].join(', ')}] · path ${game.chronicle.pathN} pts · "${D.summary}"`);
    const ok = fails.length === 0; allPass &&= ok;
    verdictLine(ok, '(a2) the quiet run to the end — the server lock picked, a corridor panel OCP\'d, the west exit sign shot out, a smoke canister, into the server room, the drive pulled by its row, out past the fire exit: those rows in order (objectives in the right rooms), 99 GHOST done, never seen / no alarms / no kills / pacifist / locksmith / speedrun lit, the end card raised, and nothing written after', notes.join('\n    '), fails);
    (globalThis as any).__debriefDoneWorld = W;   // (e) builds the card off this finished run
  }
  console.log(`=== debrief-run: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) rooms
export async function debriefRooms() {
  console.log('\n=== debrief-rooms: roomOf() names known floor points ===');
  const cases: [Vec3, string][] = [
    [[6, 0, 11.1], 'corridor'], [[34, 0, 11.4], 'corridor'], [[8, 0, 18], 'lobby'], [[20, 0, 18], 'cubicles'], [[32, 0, 18], 'break room'],
    [[18, 0, 7], 'server room'], [[8, 0, 7], 'conference room'], [[26, 0, 7], "manager's office"], [[33, 0, 7], 'storage'],
    [[20, 0, 26], 'south lot'], [[38, 0, 15], 'east side'], [[20, 0, 2], 'north side'], [[2, 0, 15], 'west side'],
  ];
  const fails: string[] = [];
  for (const [p, want] of cases) { const got = roomOf(p); if (got !== want) fails.push(`(${p[0]}, ${p[2]}) → '${got}' (want '${want}')`); }
  // the level's own marks agree: the spawn is in the lobby, the rack in the server room, the fire exit's outside step on the east side
  const W = (globalThis as any).__debriefDoneWorld ?? await standUp(); const L = W.level;
  if (roomOf(L.playerSpawn) !== 'lobby') fails.push(`playerSpawn → ${roomOf(L.playerSpawn)}`);
  if (roomOf(L.mission.rack.front) !== 'server room') fails.push(`rack front → ${roomOf(L.mission.rack.front)}`);
  if (roomOf([L.mission.exfilX + 0.2, 0, L.mission.exfilZ]) !== 'east side') fails.push(`exfil → ${roomOf([L.mission.exfilX + 0.2, 0, L.mission.exfilZ])}`);
  const ok = fails.length === 0;
  verdictLine(ok, `(c) ${cases.length} points across the eight rooms and the four sides of the grounds, plus the level's spawn / rack / exfil marks`, cases.map(([p, w]) => `(${p[0]},${p[2]}) ${w}`).join(' · '), fails);
  console.log(`=== debrief-rooms: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (c2) a door row calls its door what its level calls it
/** The timeline names a kicked, picked or keyed door by the name its level wrote for it, as the squad's rows do (chronicle.ts eventText with the game behind
 *  the row → doornames.ts doorWrittenName, WORDS.doors): the office's break room door off the cubicles is 'the cubicles-side break room door' on the card.
 *  The row holds only the id and is worded when it is READ: the SAME rows read as they always did once the key is down, with the words pass off, or with no
 *  game behind them, and so does a door nobody named. First the stand's own keys (the frozen stand: every row as it was; the shipped one: the name), then
 *  the keys set by hand. `DOORNAMES_BREAK=1` asks for the name with the key down: must fail. */
export async function debriefDoorName() {
  console.log('\n=== debrief-doorname: a kicked, picked or keyed door is called on the card what its level calls it ===');
  const { WORDS } = await import(`${ROOT}/src/game/words.ts`), N = await import(`${ROOT}/src/game/doornames.ts`);
  const W = await standUp(), g = W.game, fails: string[] = [], was = { on: WORDS.on, doors: WORDS.doors };
  const want = (got: string, exp: string, what: string) => { if (got !== exp) fails.push(`${what}: '${got}' (want '${exp}')`); };
  const NAME = 'cubicles-side break room door';
  try {
    const named = g.doors.byName('breakroom_w'), plain = g.doors.byName('storage');
    if (!named || !plain) fails.push(`the office has no door 'breakroom_w' / 'storage'`);
    else {
      const kick = CH.chronDoor(g, 'doorKicked', named), pick = CH.chronDoor(g, 'lockPicked', named), other = CH.chronDoor(g, 'doorKicked', plain);
      const ev = (kind: string, data: any): any => ({ t: 0, kind, room: '', pos: [0, 0, 0], data });
      const keyed = ev('codeEntered', { door: 'breakroom_w' }), told = ev('codeLearned', { door: 'breakroom_w', how: 'told', from: 'Alpha' }), heard = ev('codeLearned', { door: 'breakroom_w', how: 'overheard' });
      if (!kick || !pick || !other) fails.push('chronDoor made no row (the mission is not live?)');
      else {
        want(JSON.stringify(kick.data), '{"door":"breakroom w"}', "the row's data (the id's words as ever: nothing in it to go stale)");
        // the stand's own keys, untouched
        want(CH.eventText(kick, g), was.on && was.doors ? `kicked in the ${NAME}` : 'kicked in the breakroom w door', `this stand's own keys (words ${was.on}, door names ${was.doors})`);
        // the keys up
        WORDS.on = true; WORDS.doors = !process.env.DOORNAMES_BREAK;
        want(CH.eventText(kick, g), `kicked in the ${NAME}`, 'key up, the named door kicked');
        want(CH.eventText(pick, g), `picked the lock on the ${NAME}`, 'key up, the named door picked');
        want(CH.eventText(keyed, g), `keyed the code — the ${NAME}`, 'key up, its code keyed');
        want(CH.eventText(told, g), `Alpha gave up the code to the ${NAME}`, 'key up, its code told');
        want(CH.eventText(heard, g), `overheard the code to the ${NAME}`, 'key up, its code overheard');
        want(CH.fmtEvent(kick, g).split(' · ').pop()!, `kicked in the ${NAME}`, "key up, the pin's hover line");
        want(CH.eventText(other, g), 'kicked in the storage door', 'key up, a door nobody named');
        want(CH.eventText(kick), 'kicked in the breakroom w door', "key up, no game behind the row: the id's words");
        // the SAME rows with the key down (a page reopened with ?doornames=0 on a loaded checkpoint), then with the words pass off: every row as it was
        const asWas = (what: string) => {
          want(CH.eventText(kick, g), 'kicked in the breakroom w door', `${what}, kicked`); want(CH.eventText(pick, g), "picked the breakroom w door's lock", `${what}, picked`);
          want(CH.eventText(keyed, g), 'keyed the code — the breakroom w door', `${what}, keyed`); want(CH.eventText(told, g), 'Alpha gave up the breakroom w code', `${what}, told`);
          want(CH.eventText(heard, g), 'overheard the breakroom w code', `${what}, overheard`); want(CH.eventText(other, g), 'kicked in the storage door', `${what}, a door nobody named`); };
        WORDS.doors = false; asWas('key down');
        WORDS.on = false; WORDS.doors = true; asWas('the words pass off');
      }
      // a written name is the whole name (no ' door' added to a gate, no possessive hung on it): a made-up level's doors
      WORDS.on = true; WORDS.doors = true;
      const ds = ['gate_n', 'dd'].map(id => ({ def: { name: id } })), stub: any = { doors: { byName: (n: string) => ds.find(d => d.def.name === n) } };
      N.nameDoors({ scenarios: { doorNames: [{ door: 'gate_n', name: 'yard gate' }, { door: 'dd', name: 'double doors' }] } } as any, false, ds);
      want(CH.eventText(ev('doorKicked', { door: 'gate n' }), stub), 'kicked in the yard gate', "a written name that is no 'door'");
      want(CH.eventText(ev('lockPicked', { door: 'dd' }), stub), 'picked the lock on the double doors', "a written name that ends in 's'");
      want(CH.eventText(ev('doorKicked', { door: 'gone' }), stub), 'kicked in the gone door', "a door the level does not have: the id's words");
    }
  } finally { WORDS.on = was.on; WORDS.doors = was.doors; }
  const ok = fails.length === 0;
  verdictLine(ok, "(c2) the office's break room door off the cubicles, kicked, picked and keyed: the name its level wrote with the key up (this stand's own keys first), and the SAME rows as they always read with the key down, the words pass off or no game behind the row; a door nobody named reads as it did; a written name is the whole name", 'breakroom_w · storage · a made-up level', fails);
  console.log(`=== debrief-doorname: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (c3) a charge's rows say a charge
/** The rows a wall charge makes (wallcharge.ts WALLKILL: a man at the charge when it went, the player with them) are worded as a charge's, not a gun's:
 *  nobody was 'shot dead' and a charge has no 'round'. Every other kill and down row reads as it did. No game needed: the rows' own words. */
export async function debriefCharge() {
  console.log("\n=== debrief-charge: a man the wall charge took is not 'shot dead', and the player is not down to its 'round' ===");
  const fails: string[] = [], ev = (kind: string, data: any): any => ({ t: 0, kind, room: '', pos: [0, 0, 0], data });
  const want = (got: string, exp: string, what: string) => { if (got !== exp) fails.push(`${what}: '${got}' (want '${exp}')`); };
  want(CH.eventText(ev('kill', { who: 'Tango 2', weapon: 'a wall charge' })), 'Tango 2 killed — the wall charge', 'a man at the charge');
  want(CH.eventText(ev('down', { by: 'the wall charge' })), 'DOWN — the wall charge', 'the player at the charge');
  want(CH.eventText(ev('kill', { who: 'Tango 2', weapon: 'knife' })), 'Tango 2 killed — the knife', 'the knife, as it read');
  want(CH.eventText(ev('kill', { who: 'Tango 2', weapon: 'a round' })), 'Tango 2 shot dead (a round)', 'a round, as it read');
  want(CH.eventText(ev('down', { by: 'Tango 2' })), "DOWN — Tango 2's round", "a man's round, as it read");
  want(CH.eventText(ev('down', { by: '' })), 'DOWN', 'nobody named, as it read');
  // the knock a charge gives through the wall it opened is the charge's, not a takedown: the row's method, filed from the line the charge says
  want(CH.eventText(ev('ko', { who: 'Tango 2', method: 'charge' })), 'Tango 2 out cold — the wall charge', 'a man behind the wall');
  want(CH.eventText(ev('civilianKO', { who: 'Ines', label: 'cleaner', method: 'charge' })), 'Ines (the cleaner) out cold — the wall charge — a CIVILIAN', 'a civilian behind the wall');
  want(CH.eventText(ev('ko', { who: 'Tango 2', method: 'takedown' })), 'Tango 2 out cold — the takedown', 'the takedown, as it read');
  { const W = await standUp(), g = W.game, gd = g.guards.find((x: any) => x.state !== 'dead' && !x.civ && x.team !== 'operative');
    if (!gd) fails.push('no man to file a row for');
    else { const viaCharge = CH.chronDown(g, gd, 'struck', `${gd.callsign} down — behind the wall when it went`), byHand = CH.chronDown(g, gd, 'struck', `${gd.callsign} out cold`);
      want(String(viaCharge?.data.method), 'charge', "chronDown, the charge's own line"); want(String(byHand?.data.method), 'takedown', 'chronDown, a blow by hand'); } }
  // the words the charge files its rows under are still the ones worded here (chronicle.ts chronDown's test of the line · wallcharge.ts's chronHit)
  { const { readFileSync } = await import('node:fs'), wc = readFileSync(`${ROOT}/src/game/wallcharge.ts`, 'utf8'), ch = readFileSync(`${ROOT}/src/game/chronicle.ts`, 'utf8');
    if (!wc.includes("chronHit(g, 'the wall charge')")) fails.push("wallcharge.ts no longer files the player's row as 'the wall charge'");
    if (!ch.includes("? 'a wall charge' :")) fails.push("chronicle.ts chronDown no longer names the weapon 'a wall charge'");
    if (!wc.includes('behind the wall when it went`')) fails.push("wallcharge.ts no longer says 'behind the wall when it went' of the man it knocks through the wall"); }
  const ok = fails.length === 0;
  verdictLine(ok, "(c3) a man at the wall charge reads 'killed — the wall charge', the player 'DOWN — the wall charge', a man or a civilian knocked out behind the wall 'out cold — the wall charge'; the knife, a round, a man's round, a nameless down and a takedown read as they did; the charge still files its rows under those words", 'the rows\' own words', fails);
  console.log(`=== debrief-charge: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (d) the score's shape
export async function debriefScore() {
  console.log('\n=== debrief-score: the score only ever goes down; clean ≥ 90; a kill costs more than a knockout; bands ordered ===');
  const fails: string[] = []; const notes: string[] = [];
  const clean = stealthScore(blankCounts());
  if (clean.score < 90 || ratingOf(clean.score).word !== 'GHOST' || clean.lines.length) fails.push(`a clean record scores ${clean.score} ${ratingOf(clean.score).word} with ${clean.lines.length} deductions (want 100 GHOST, none)`);
  { const done = { ...blankCounts(), done: true, stage: 'done', elapsed: 200 }; const b = badgesOf(done).filter((x: any) => x.on).map((x: any) => x.id).sort().join(','); if (b !== 'nokills,pacifist,quiet,speedrun,unseen,unseenStaff') fails.push(`a clean finished run's badges: [${b}] (want nokills,pacifist,quiet,speedrun,unseen,unseenStaff)`); }   // (+ 'unseen by staff': the civilians' badge, chronicle.ts — lit on a run no cleaner / late worker ever saw)
  const BUMP = ['seen', 'seenUp', 'alarms', 'esc1', 'esc2', 'bodies', 'kills', 'kos', 'shotsNearMen', 'lightsShot', 'hits', 'loads', 'civSeen', 'civReported', 'civKO', 'civKilled'] as const;   // (+ the civilians' terms, chronicle.ts SCORE: they too only ever take away)
  const rnd = seeded(77); let trials = 0, ups = 0;
  for (let n = 0; n < 300; n++) {
    const base: any = blankCounts();
    for (const k of BUMP) base[k] = Math.floor(rnd() * rnd() * 6);
    base.elapsed = rnd() * 40 * 60; base.down = rnd() < 0.2;
    const s0 = stealthScore(base).score;
    for (const k of BUMP) { const b2 = { ...base, [k]: base[k] + 1 }; const s1 = stealthScore(b2).score; trials++; if (s1 > s0) { ups++; if (ups <= 3) fails.push(`bumping ${k} ${base[k]} → ${base[k] + 1} raised the score ${s0} → ${s1} (${JSON.stringify(base)})`); } }
    { const s1 = stealthScore({ ...base, elapsed: base.elapsed + 600 }).score; trials++; if (s1 > s0) { ups++; fails.push(`ten more minutes raised the score ${s0} → ${s1}`); } }
    { const s1 = stealthScore({ ...base, down: true }).score; trials++; if (s1 > s0) { ups++; fails.push(`going down raised the score ${s0} → ${s1}`); } }
  }
  notes.push(`${trials} bumps over 300 random records, ${ups} raised the score`);
  { const ck = stealthScore({ ...blankCounts(), civKilled: 1 }).score, cko = stealthScore({ ...blankCounts(), civKO: 1 }).score, gk = stealthScore({ ...blankCounts(), kills: 1 }).score; if (!(ck < cko && ck < gk && cko < stealthScore({ ...blankCounts(), kos: 1 }).score)) fails.push(`civilian killed ${ck} / knocked out ${cko} vs a guard killed ${gk} (want the civilian's death dearest, her knockout dearer than a guard's)`); notes.push(`civ killed ${ck} · civ ko ${cko}`); }
  { const k = stealthScore({ ...blankCounts(), kills: 1 }).score, o = stealthScore({ ...blankCounts(), kos: 1 }).score; if (!(k < o)) fails.push(`one kill ${k} vs one knockout ${o} (want the kill lower)`); notes.push(`kill ${k} · ko ${o} · seen once ${stealthScore({ ...blankCounts(), seen: 1, alarms: 1, esc1: 1 }).score}`); }
  for (let i = 1; i < BANDS.length; i++) if (!(BANDS[i - 1].min > BANDS[i].min)) fails.push(`bands out of order at ${BANDS[i].word}`);
  if (ratingOf(90).word !== 'GHOST' || ratingOf(89).word !== 'SHADOW' || ratingOf(70).word !== 'SHADOW' || ratingOf(69).word !== 'OPERATIVE' || ratingOf(40).word !== 'OPERATIVE' || ratingOf(39).word !== 'ASSAULT' || ratingOf(0).word !== 'ASSAULT') fails.push('band edges wrong');
  { const worst: any = { ...blankCounts(), seen: 9, alarms: 9, esc1: 3, esc2: 3, bodies: 5, kills: 6, down: true, elapsed: 3600 }; const s = stealthScore(worst).score; if (s !== 0) fails.push(`a disastrous record scores ${s} (want the floor, 0)`); }
  const ok = fails.length === 0;
  verdictLine(ok, '(d) clean = 100 GHOST with nothing docked (and a clean finish lights exactly unseen / quiet / nokills / pacifist / speedrun / unseen-by-staff); no single bump of any count, ten more minutes, or going down ever raises the score; a kill costs more than a knockout; the four bands sit in order with the right edges; the floor is 0', notes.join(' · '), fails);
  console.log(`=== debrief-score: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (e) the card, headless
export async function debriefDom() {
  console.log('\n=== debrief-dom: the card builds on a fake DOM off a finished run ===');
  const fails: string[] = []; const notes: string[] = [];
  // ---- a small fake DOM: enough Element for ui/debrief.ts (createElement, className/classList, textContent, append, title, style, onclick, canvas w/h, no 2d context)
  class El {
    nodeType = 1; children: any[] = []; parentElement: El | null = null; style: Record<string, string> = {}; title = ''; width = 0; height = 0; onclick: null | (() => void) = null; onmousemove: unknown = null; _text = '';
    cls = new Set<string>();
    classList = { add: (...c: string[]) => c.forEach(x => this.cls.add(x)), remove: (...c: string[]) => c.forEach(x => this.cls.delete(x)), contains: (c: string) => this.cls.has(c), toggle: (c: string, f?: boolean) => { const on = f ?? !this.cls.has(c); if (on) this.cls.add(c); else this.cls.delete(c); return on; } };
    constructor(public tagName: string) {}
    get className() { return [...this.cls].join(' '); } set className(v: string) { this.cls = new Set(v.split(/\s+/).filter(Boolean)); }
    appendChild(c: any) { this.children.push(c); c.parentElement = this; return c; }
    append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? Object.assign(new El('#text'), { nodeType: 3, _text: c }) : c); }
    get textContent(): string { return this.nodeType === 3 ? this._text : this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(v: string) { this.children = []; this._text = v; }
    getContext() { return null; } getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 280 }; }
    focus() {} setAttribute(k: string, v: string) { (this as any)[k] = v; }
    all(sel: (e: El) => boolean, out: El[] = []): El[] { for (const c of this.children) { if (c.nodeType === 1) { if (sel(c)) out.push(c); c.all(sel, out); } } return out; }
  }
  const G = globalThis as any; const hadDoc = 'document' in G; const prevDoc = G.document;
  G.document = { createElement: (t: string) => new El(t.toUpperCase()) };
  let copied = ''; const prevNav = G.navigator;
  try { Object.defineProperty(G, 'navigator', { value: { clipboard: { writeText: async (s: string) => { copied = s; } } }, configurable: true, writable: true }); } catch { /* bun's navigator may be read-only: the button then falls back to showing the line */ }
  try {
    const { renderDebrief } = await import(`${ROOT}/src/ui/debrief.ts`);
    const W = G.__debriefDoneWorld ?? await (async () => { const w = await standUp(); return w; })();
    const game = W.game;
    const host = new El('DIV'); const btnA = new El('BUTTON'); btnA.textContent = 'Again';
    const ui = renderDebrief(host as any, game, [btnA as any]);
    const root: El = host.children[0];
    if (!root || !root.cls.has('db')) fails.push('no .db root appended to the host');
    const by = (c: string) => root.all(e => e.cls.has(c));
    const D = debriefOf(game);
    { const r = by('db-rating')[0]; const word = r?.children.find((x: El) => x.tagName === 'B')?.textContent; const score = by('db-score')[0]?.textContent; if (word !== D.rating || score !== String(D.score)) fails.push(`header shows ${word} ${score} (want ${D.rating} ${D.score})`); notes.push(`header ${word} ${score}`); }
    { const t1 = by('db-t1')[0]?.textContent; if (t1 !== (D.state === 'done' ? 'mission complete' : D.state === 'down' ? "you're down" : 'run so far')) fails.push(`title '${t1}' for state ${D.state}`); }
    { const n = by('st').length; if (n < 14) fails.push(`stats grid has ${n} cells (want ≥ 14)`); notes.push(`${n} stat cells`); }
    { const chips = by('chip'); const lit = chips.filter(c => c.cls.has('on')).map(c => c.textContent); if (chips.length !== 9) fails.push(`${chips.length} badge chips (want 9: eight + the civilians' unseen-by-staff)`); const wantLit = D.badges.filter((b: any) => b.on).map((b: any) => b.name); if (lit.join('|') !== wantLit.join('|')) fails.push(`lit chips [${lit.join(', ')}] vs badges on [${wantLit.join(', ')}]`); notes.push(`chips lit [${lit.join(', ')}]`); }
    { const rows = by('ev').filter(r => !r.cls.has('empty')); const n = game.chronicle.events.length; if (rows.length !== n) fails.push(`${rows.length} timeline rows for ${n} entries`); const first = rows[0]?.textContent ?? ''; if (n && !first.startsWith(fmtEvent(game.chronicle.events[0]).slice(0, 5))) fails.push(`first row "${first}" vs "${fmtEvent(game.chronicle.events[0])}"`); notes.push(`${rows.length} timeline rows`); }
    { const pins = by('pin'), marks = root.all(e => e.cls.has('mark') && e.tagName === 'I'); const want = game.chronicle.events.filter((e: any) => pinned(e)).length; if (pins.length !== want) fails.push(`${pins.length} pins for ${want} pinned entries`); if (marks.length !== 3) fails.push(`${marks.length} marks (want spawn / rack / exit)`); if (pins.some(p => !p.title || !/^\d\d:\d\d · /.test(p.title)) || pins.some(p => !/%$/.test(p.style.left ?? '') || !/%$/.test(p.style.top ?? ''))) fails.push('a pin without its timeline row as title / without a percent position'); notes.push(`${pins.length} pins, ${marks.length} marks`); }
    { const cv = root.all(e => e.tagName === 'CANVAS')[0]; if (!cv || cv.width < 100 || cv.height < 60) fails.push(`canvas ${cv?.width}×${cv?.height}`); else notes.push(`canvas ${cv.width}×${cv.height}`); }
    { const btns = by('btn'); const copy = btns.find(b => b.cls.has('db-copy')); if (!root.all(e => e === (btnA as any)).length) fails.push("the host's button was not placed"); if (!copy) fails.push('no copy-summary button'); else { try { copy.onclick?.(); await new Promise(r => setTimeout(r, 5)); } catch (e) { fails.push(`copy button threw: ${e}`); } if (ui.copyText !== D.summary) fails.push('copyText is not the summary line'); if (copied && copied !== D.summary) fails.push(`clipboard got "${copied}"`); notes.push(`copy → ${copied ? 'clipboard' : 'fallback line'}: "${ui.copyText.slice(0, 60)}…"`); } }
    // and the 'run so far' shape off a fresh world (empty timeline row, sofar title)
    { const W2 = await standUp(); const host2 = new El('DIV'); renderDebrief(host2 as any, W2.game); const root2: El = host2.children[0]; const empty = root2.all(e => e.cls.has('empty')); const t1 = root2.all(e => e.cls.has('db-t1'))[0]?.textContent; if (empty.length !== 1 || t1 !== 'run so far') fails.push(`fresh world: ${empty.length} empty-row(s), title '${t1}'`); notes.push(`fresh: '${t1}', ${root2.all(e => e.cls.has('pin')).length} pins`); }
    // and the card's own readers word a door row with the game behind it (ui/debrief.ts: the timeline's row and the map pin's hover line — debrief-doorname has the words' rules)
    { const { WORDS } = await import(`${ROOT}/src/game/words.ts`), was = { on: WORDS.on, doors: WORDS.doors };
      try { const W3 = await standUp(), d = W3.game.doors.byName('breakroom_w'); WORDS.on = true; WORDS.doors = !process.env.DOORNAMES_BREAK; if (d) CH.chronDoor(W3.game, 'doorKicked', d);
        const host3 = new El('DIV'); renderDebrief(host3 as any, W3.game); const root3: El = host3.children[0];
        const row = root3.all(e => e.cls.has('k-doorKicked'))[0]?.textContent ?? '', pin = root3.all(e => e.cls.has('pin')).map(p => p.title).find(t => /kicked/.test(t)) ?? '';
        if (!row.endsWith('kicked in the cubicles-side break room door') || !pin.endsWith('kicked in the cubicles-side break room door')) fails.push(`a named door kicked, on the card: row "${row}" · pin "${pin}" (want both to end 'kicked in the cubicles-side break room door')`);
        notes.push(`door row: ${row.slice(-44)}`); }
      finally { WORDS.on = was.on; WORDS.doors = was.doors; } }
  } catch (e: any) { fails.push(`building the card threw: ${e?.stack ?? e}`); }
  finally { if (hadDoc) G.document = prevDoc; else delete G.document; try { Object.defineProperty(G, 'navigator', { value: prevNav, configurable: true, writable: true }); } catch { /* leave it */ } }
  const ok = fails.length === 0;
  verdictLine(ok, '(e) the card off a finished run on a fake DOM: rating + score in the header, the right title, ≥ 14 stat cells, 9 chips lit as the badges are, a timeline row per entry, a pin per pinned entry (titled, percent-placed) + 3 marks, a sized canvas, the host\'s buttons + a working copy button; and a fresh world renders "run so far" with the empty row', notes.join(' · '), fails);
  console.log(`=== debrief-dom: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}
