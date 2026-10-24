// The 'checkpoints' family (run through probes.ts: `bun run tools/qa/probes.ts checkpoints` — also in 'all'): the encounter serialised and put back
// (src/game/savestate.ts saveState / loadState, the autosave controller Game.saves). What is held:
//   checkpoint-identity  (a) a rich mid-mission state — a man choked out and hauled, a door kicked in, a key in Sam's pocket, the mains thrown, a beam tripped,
//                            marks on the walls, the drive out, a chair shoved, a torch on the floor — is saved; then THREE ten-second futures are digested once a
//                            second over guards / Sam / doors / mission / chronicle / lights / devices / items with the seeded Math.random re-seeded to one
//                            value at their start: A = the game simply stepped on after the save, B = the SAME game after loadState(snapshot), C = a FRESH game
//                            after loadState(snapshot). A ≡ B ≡ C (the file holds everything the next frames hang on), and save(load(s)) ≡ s slice by slice;
//   checkpoint-turn      (a2) a man caught in the MIDDLE OF A TURN (character.ts TURN, the turn weight: on in the page, raised here on either stand by
//                            TPS_TURN=1) is filed with it under SAVETIMELINE.turn (GuardSnap.turn, character.ts turnSnap; TPS_SAVETURN=1, raised here
//                            too) and goes on turning after a load: every man's place and yaws agree frame for frame over the first half second, A ≡ B ≡ C
//                            over three seconds, and the file made from a fresh game after a load holds the same turn. Twice: as his own update left him,
//                            and with a wish written AFTER his update on the frame of the save (two men turning to talk do that), which the loader's bake
//                            must hand back. With the switch off no file says a turn and one that has it loads as the keyless file. CHECKPOINT_TURN_BREAK=1 = the key taken out of the file before it is
//                            loaded, as a file from before the key: he starts from rest, and the futures must part (lines 1 and 2 fail);
//   checkpoint-autosave  (b) every autosave trigger fires exactly once in a scripted run — a room entered, the stage advancing, a body hauled away, 90 s of
//                            quiet — and NOTHING is written while compromised: a man alert / searching / over the awareness line, Sam mid-pick, a can on its
//                            fuse (the request waits, then lands or lapses); the slots rotate through three; the HUD tag and the chronicle row appear;
//   checkpoint-death     (c) Sam shot dead after a checkpoint: the newest slot loads, he stands where it was written with the run's chronicle intact (+ the
//                            'loaded' row, the score's load count), no double guards / leaked items / stale cursor, and the run walks on to the fire exit;
//   checkpoint-slots     (d) three autosaves + a manual fill auto.0‥2 + manual and the fourth autosave overwrites auto.0; export → import → load round-trips
//                            (the imported file lands in the manual slot and loads to the same digest); a file of another 'level' / version is refused;
//   checkpoint-refuse    (e) refused with the reason: the tour flag up, daylight in, the QRF requested, a unit on the floor, Sam down, a man scripted / the
//                            pair clearing (plain), Sam holding a man (plain) — and `force` files the last two (the hold let go of in the FILE, not the game).
import { standUp, ROOT } from './headless.ts';
const { v3, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);
const SS = await import(`${ROOT}/src/game/savestate.ts`);
const { saveState, loadState, canSave, canLoad, CKPT, levelFingerprint } = SS;
const ringSize = (): number => SS.SAVETIMELINE.on ? SS.SAVETIMELINE.auto : CKPT.autoSlots;   // how many autosaves the stand keeps
const { killGuard, fireWeapon, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { startGrab, startKick, startPicking, toggleDrag } = await import(`${ROOT}/src/game/player.ts`);
const { requestQrf, resetQrf } = await import(`${ROOT}/src/game/qrf.ts`);
const { spawnUnit, despawnUnit, rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
const { setDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { ambientState, hashStr } = await import(`${ROOT}/src/game/dialogue.ts`);
const { HOLD, TURN } = await import(`${ROOT}/src/game/character.ts`);
const { debriefOf } = await import(`${ROOT}/src/game/chronicle.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
export function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const steps = (W: any, secs: number, until?: () => boolean) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { W.step(DT); if (until?.()) return true; } return !until; };
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
const verdictLine = (ok: boolean, label: string, detail: string, fails: string[]) => console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
let familyFails = 0;
export function checkpointFailures(): number { return familyFails; }

/** ONE sample of everything the identity claim is over: guards / Sam / doors / mission / chronicle / lights / devices / items / the floor's memory. Positions to
 *  the millimetre, clocks to the hundredth. The soak's --checkpoint-at reads it too. Lives in src/game/digest.ts now (the session journal digests a recording with
 *  the same function); this name stays for the probes that import it from here. */
export const digestSample: (game: any) => any = (await import(`${ROOT}/src/game/digest.ts`)).digestGame;
/** Step `secs`, sampling once a second: the samples and one hash over them all. Math.random is re-seeded to `seed` FIRST (the identity claim's terms). */
export function digestRun(W: any, secs: number, seed: number): { hash: string; samples: any[] } {
  Math.random = seeded(seed);
  const samples: any[] = [digestSample(W.game)];
  for (let s = 0; s < secs; s++) { steps(W, 1); samples.push(digestSample(W.game)); }
  const hash = hashStr(JSON.stringify(samples)).toString(16);
  return { hash, samples };
}
/** the first difference between two sample lists, in words ('' = none) */
function firstDiff(a: any[], b: any[]): string {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = JSON.stringify(a[i]), y = JSON.stringify(b[i]); if (x === y) continue;
    // narrow to the key
    const A = a[i] ?? {}, B = b[i] ?? {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const xa = JSON.stringify(A[k]), xb = JSON.stringify(B[k]); if (xa === xb) continue;
      if (k === 'guards' && Array.isArray(A[k]) && Array.isArray(B[k])) { for (let j = 0; j < A[k].length; j++) { const ga = JSON.stringify(A[k][j]), gb = JSON.stringify(B[k][j]); if (ga !== gb) return `sample ${i} (t ${A.t}) guard ${j}: ${ga.slice(0, 300)} ≠ ${gb.slice(0, 300)}`; } }
      return `sample ${i} (t ${A.t}) '${k}': ${String(xa).slice(0, 300)} ≠ ${String(xb).slice(0, 300)}`;
    }
    return `sample ${i} differs (unnarrowed)`;
  }
  return '';
}
/** slice-by-slice comparison of two SaveStates, ignoring what a save legitimately stamps afresh (wall time, the appended checkpoint rows / counters, the label) */
function stateDiff(a: any, b: any): string[] {
  const r2 = (v: number[]) => v.map(x => Math.round(x * 100) / 100);
  const strip = (s: any) => { const c = JSON.parse(JSON.stringify(s)); delete c.savedAt; delete c.label; delete c.kind; delete c.messages; c.chronicle.events = c.chronicle.events.filter((e: any) => e.kind !== 'checkpoint'); c.chronicle.counts.saves = 0; c.chronicle.counts.loads = 0; c.autosave.lastSaveT = 0;
    for (const gd of c.guards) if (gd.state === 'dead') { delete gd.pos; delete gd.lastPos; delete gd.beamDir; delete gd.rag; }   // (a body is laid down again by Ragdoll.settleAt, its trunk snapped rigid: its geometry is compared apart, to a tolerance — bodyDrift below)
    return c; };
  const A = strip(a), B = strip(b); const out: string[] = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const x = JSON.stringify(A[k]), y = JSON.stringify(B[k]); if (x !== y) out.push(`${k}: ${firstJsonDiff(A[k], B[k], k)}`); }
  return out;
}
/** the largest distance any particle of any body moved between two files (m) — the settle's trunk snap, a centimetre or two by design */
function bodyDrift(a: any, b: any): number { let m = 0; a.guards.forEach((g0: any, i: number) => { const g1 = b.guards[i]; if (g0.state !== 'dead' || !g0.rag || !g1?.rag) return; for (let k = 0; k < g0.rag.x.length; k += 3) m = Math.max(m, Math.hypot(g0.rag.x[k] - g1.rag.x[k], g0.rag.x[k + 1] - g1.rag.x[k + 1], g0.rag.x[k + 2] - g1.rag.x[k + 2])); m = Math.max(m, Math.hypot(g0.pos[0] - g1.pos[0], g0.pos[2] - g1.pos[2])); }); return m; }
function firstJsonDiff(a: any, b: any, path: string): string {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${path} ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`;
  const keys = Array.isArray(a) ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) { if (JSON.stringify(a[k as any]) !== JSON.stringify(b[k as any])) return firstJsonDiff(a[k as any], b[k as any], `${path}.${String(k)}`); }
  return `${path} (order?)`;
}

/** The rich mid-mission state every case starts from: seeded, staged step by step through the game's own verbs, then left CALM (Sam dark and away, the men on
 *  patrol) so a checkpoint is allowed. Returns the standing game and notes on what was staged. */
export async function stageRich(seed = 4471): Promise<{ W: any; notes: string[] }> {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const notes: string[] = [];
  game.player.visibility = 0.02; game.godMode = true; game.saves.enabled = false;   // (no autosaves while staging: the cases write their own)
  steps(W, 0.2);
  const [A, B, C] = game.guards;   // Kowalski (corridor), Novak (cubicles), Reyes (lobby / break room)
  rollcallState(game).nextAt = game.time + 900;   // (the radio check kept out of the ten-second windows: it asks after the choked man on its own clock otherwise — legitimate, but a coin-flip on WHICH window it lands in is not what (a) is about)
  // 1. Kowalski grabbed from behind in the corridor, questioned to his key, choked out; the body hauled two metres and let go
  place(A, [16, 0, 11.2], Math.PI / 2); A.heardUpTo = game.eventSeq;
  game.teleportPlayer([15.2, 0, 11.2]); game.player.crouch = true; steps(W, DT); game.player.visibility = 0.02;
  startGrab(game, A);
  steps(W, 3, () => game.player.holding?.phase === 'held'); game.player.fHeld = false; steps(W, DT);
  let gave: string | null = null; for (let i = 0; i < 8 && gave !== 'door'; i++) { const p = game.interrogate(A, seeded(60 + i)); gave = p?.kind ?? null; steps(W, 0.5); }
  notes.push(`questioned ${A.callsign}: ${gave === 'door' ? 'gave the door + key' : 'no key (' + gave + ')'}; keys [${[...game.player.keys].join(',')}]`);
  if (game.player.holding) { const { endFor } = await import('./verbs.ts'); endFor(W, HOLD.secs.chokeHold + HOLD.secs.choke + 0.3); steps(W, 0.8); }
  notes.push(`${A.callsign} ${A.state}/${A.downKind}`);
  steps(W, 2.5);   // (let him settle on the floor)
  toggleDrag(game, A); const from = v3.copy(game.player.char.pos);
  for (let i = 0; i < 150 && game.player.dragging; i++) { W.input.keys.add('KeyA'); W.step(DT); } W.input.keys.delete('KeyA'); steps(W, DT);
  if (game.player.dragging) toggleDrag(game); steps(W, 1.5);
  notes.push(`hauled ${v3.distXZ(from, game.player.char.pos).toFixed(1)} m, dropped; torch item ${A.dropped ? A.dropped.kind : 'none'}`);
  // 2. the storage door kicked in (the parked pair deaf to it), marks on the leaf; a round into the corridor wall (a bullet hole)
  B.heardUpTo = 1e12; C.heardUpTo = 1e12;
  const storage = game.doors.byName('storage');
  game.teleportPlayer([32.6, 0, 10.9]); game.player.crouch = false; game.player.char.bodyYaw = Math.PI; steps(W, 2 * DT);
  startKick(game, storage); steps(W, 2.0, () => storage.lockBroken); steps(W, 1.0);
  game.player.slot = 'pistol'; game.player.holstered = false; steps(W, 0.3);
  fireWeapon(game, game.player.char, [30, 1.2, 10.05], true); steps(W, 0.5);
  game.player.holstered = true; steps(W, 0.2);
  notes.push(`storage lockBroken ${storage.lockBroken}, decals ${game.decals.list.length}`);
  // 3. the mains thrown by hand (permanent till reset), a chair shoved in the break room, the corridor beam walked through (a trip on the log)
  game.setBlackout(86400, 'hand'); steps(W, 0.5);
  for (const gd of game.guards) if (gd.task?.kind === 'breaker') { gd.task = null; gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; }   // (nobody walks to the breaker inside the windows: the errand is its own probe's)
  { const chair = game.props.props.find((p: any) => p.def.kind === 'chair'); if (chair) { game.props.applyImpulse(chair, [chair.x, 0.4, chair.z], [40, 0, 15], 1); } steps(W, 1.5); notes.push(`chair ${chair ? `${chair.id} moved ${Math.hypot(chair.x - chair.home[0], chair.z - chair.home[1]).toFixed(2)} m` : 'none'}`); }
  { const L = game.devices?.lasers?.[0]; if (L) { const mid: Vec3 = [(L.def.from[0] + L.def.to[0]) / 2, 0, (L.def.from[2] + L.def.to[2]) / 2]; game.teleportPlayer([mid[0] - 1.2, 0, mid[2]]); for (let i = 0; i < 90; i++) { W.input.keys.add('KeyD'); W.step(DT); } W.input.keys.delete('KeyD'); steps(W, 0.5); notes.push(`beam ${L.def.name} trips ${L.trips}`); } }
  // 4. the mission on: into the server room (stage → drive), the drive pulled by hand (stage → exfil, the rack dark, the clunk in the queue)
  { const M = game.level.mission; const R = M.serverRoom; game.teleportPlayer([(R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2]); steps(W, 0.3);
    game.teleportPlayer([M.rack.front[0], 0, M.rack.front[2] + 0.7]); steps(W, 0.2); const { drivePulled } = await import(`${ROOT}/src/game/mission.ts`); if (game.mission.stage === 'drive') drivePulled(game); steps(W, 0.3);
    game.mission.sweepAt = -1;   // (the rack check would send a man in mid-window — again its own probe's business)
    notes.push(`mission ${game.mission.stage}, rack pulled ${game.mission.pulled}`); }
  // 5. calm again: everybody deaf no more, on patrol, Sam dark in the cubicles' SW corner; a couple of seconds to settle
  for (const gd of game.guards) { if (gd.state === 'dead') continue; gd.heardUpTo = game.eventSeq; gd.awareness = 0; gd.state = 'patrol'; gd.lastKnown = null; gd.task = null; gd.hold = false; }
  game.events.length = 0;
  if (game.clearing) { game.clearing.cancel(); game.clearing = null; for (const gd of game.guards) if (gd.state !== 'dead') { gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; } }   // (a pair the staging's alarm had clearing rooms is let go of like every other errand above: which second the body was found in is the level's walls' business, not this state's)
  game.teleportPlayer([16.5, 0, 22.5]); game.player.crouch = true; steps(W, DT); game.player.visibility = 0.02;
  if (game.clearing) { game.clearing.cancel(); game.clearing = null; for (const gd of game.guards) if (gd.state !== 'dead') { gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; } }   // (and once more a frame on: the men put to patrol above END the alarm's episode on the next frame, and an episode that came to nothing deals the pair its rooms afresh — guards.ts updateEscalation — unless the floor was raised inside the last second and a half, which is which second a civilian rang it in)
  steps(W, 2.0);
  notes.push(`t ${game.time.toFixed(1)} s: ${game.guards.map((x: any) => `${x.callsign} ${x.state} ${x.awareness.toFixed(2)}`).join(', ')}; chronicle ${game.chronicle.events.length} rows; canSave: ${canSave(game) ?? 'yes'}`);
  return { W, notes };
}

/** the three futures of one file, each run the same way: A the game that simply goes on, B the same game with the file loaded into it, C a fresh game with it loaded */
async function futures<T>(W: any, file: () => any, run: (W: any) => T): Promise<{ A: T; B: T; C: T; W2: any }> {
  const A = run(W);
  loadState(W.game, file()); W.cam.target = v3.copy(W.game.player.char.pos);
  const B = run(W);
  Math.random = seeded(777);   // (whatever the fresh boot draws)
  const W2 = await standUp(); loadState(W2.game, file()); W2.cam.target = v3.copy(W2.game.player.char.pos);
  const C = run(W2);
  return { A, B, C, W2 };
}

// ================================================================================================================================ (a) identity
export async function checkpointIdentity() {
  console.log('\n=== checkpoint-identity: a rich mid-mission state saved; A (stepped on) ≡ B (same game, loaded) ≡ C (fresh game, loaded) over ten seconds digested once a second under one seed; save(load(s)) ≡ s ===');
  const fails: string[] = []; const notes: string[] = [];
  const { W, notes: staged } = await stageRich(); const { game } = W; notes.push(...staged);
  // no conversation under way at the save (one is cut short by a load, by design — documented; the identity is claimed outside it)
  steps(W, 12, () => !ambientState(game).run); if (ambientState(game).run) fails.push('an ambient conversation would not end inside 12 s');
  const why = canSave(game); if (why) { fails.push(`cannot save the staged state: ${why}`); verdictLine(false, '(a) identity', notes.join('\n    '), fails); familyFails++; return; }
  const s = saveState(game, { label: 'identity', kind: 'harness' }); const json = JSON.stringify(s);
  notes.push(`saved ${(json.length / 1024).toFixed(1)} KB · ${s.guards.filter((x: any) => x.state === 'dead').length} body · ${s.items.length} items · ${s.decals.length} decals · ${s.chronicle.events.length} rows · blackout ${s.blackout.active} · stage ${s.stage}`);
  const SEED = 90210, SECS = 10;
  const { A, B, C: Cd, W2 } = await futures(W, () => JSON.parse(json), (w) => digestRun(w, SECS, SEED));
  notes.push(`digests: A ${A.hash} · B ${B.hash} · C ${Cd.hash}`);
  if (A.hash !== B.hash) fails.push(`A ≠ B — ${firstDiff(A.samples, B.samples)}`);
  if (B.hash !== Cd.hash) fails.push(`B ≠ C — ${firstDiff(B.samples, Cd.samples)}`);
  // save(load(s)) ≡ s: the fresh game's own snapshot straight after another load of the same file
  { Math.random = seeded(1); const W3 = await standUp(); loadState(W3.game, JSON.parse(json)); const s2 = saveState(W3.game, { label: 'identity', kind: 'harness' }); const d = stateDiff(s, s2); const drift = bodyDrift(s, s2); if (d.length) fails.push(`save(load(s)) ≠ s in ${d.length} slice(s): ${d.slice(0, 4).join(' · ')}`); else if (drift > 0.03) fails.push(`the body's particles drifted ${drift.toFixed(3)} m through load→save`); else notes.push(`save(load(s)) ≡ s in every slice (the body re-laid within ${(drift * 100).toFixed(1)} cm)`); }
  // the body came back settled where it lay, the torch item with it, the marks, the chair, the blackout, the key
  { const g2 = W2.game; const dead = g2.guards.find((x: any) => x.state === 'dead'); const d0 = s.guards.find((x: any) => x.state === 'dead');
    if (!dead || !d0) fails.push('no body in the loaded game'); else { const dx = Math.hypot(dead.char.ragdoll.x[0] - d0.rag.x[0], dead.char.ragdoll.x[2] - d0.rag.x[2]); if (dx > 0.03 || !dead.char.ragdoll.sleeping) fails.push(`body pelvis ${dx.toFixed(3)} m off the file / sleeping ${dead.char.ragdoll.sleeping}`); if (!dead.dropped) fails.push('the torch item link is gone'); }
    if (g2.decals.list.length !== s.decals.length) fails.push(`decals ${g2.decals.list.length} ≠ ${s.decals.length}`);
    if (!g2.blackout.active) fails.push('blackout not restored'); if (!g2.player.keys.size && s.player.keys.length) fails.push('key not restored'); if (!g2.doors.byName('storage').lockBroken) fails.push('kicked lock not restored'); if (g2.mission.stage !== 'exfil' || !g2.mission.pulled) fails.push(`mission ${g2.mission.stage} pulled ${g2.mission.pulled}`); }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(a) the staged state (body hauled, door kicked, key taken, mains thrown, beam tripped, marks, chair, drive out) saves; A ≡ B ≡ C over 10 s at one seed; save∘load is the identity on the file; the body / marks / blackout / key / lock / stage are back in a fresh game', notes.join('\n    '), fails);
}

// ================================================================================================================================ (a2) a man caught mid-turn
export async function checkpointTurn() {
  console.log('\n=== checkpoint-turn: a man in the middle of a turn at the save is filed with it and goes on turning after a load (the turn weight and the save\'s own switch raised: TPS_TURN=1 TPS_SAVETURN=1) ===');
  const { SAVETIMELINE } = SS; const BREAK = process.env.CHECKPOINT_TURN_BREAK === '1'; const env = { turn: process.env.TPS_TURN, save: process.env.TPS_SAVETURN }, was = { turn: TURN.on, save: SAVETIMELINE.turn };
  process.env.TPS_TURN = '1'; process.env.TPS_SAVETURN = '1';
  const lines: { ok: boolean; what: string; notes: string[]; fails: string[] }[] = [];
  try {
    Math.random = seeded(4242); let W = await standUp();
    // the patrols walk until a living man's weight is carrying him round (speed in his feet, his AI's wish well ahead of where he has got to) on a frame that can be saved
    const mid = (g: any) => g.guards.filter((gd: any) => { const t = gd.state !== 'dead' && gd.char.turnSnap(); return !!t && Math.abs(t[2]) > 1 && Math.abs(wrapAngle(t[4] - t[0])) > 0.3; });
    const turns = (f: any) => JSON.stringify(f.guards.map((x: any) => [x.turn ?? null, x.bodyYaw, x.aimYaw]));
    // every man's place and yaws on each of the first frames, to the bit (a turn that starts from rest parts from the run that went on in its first frame, by a
    // fraction of a degree — the once-a-second digest after it would see it only as the millimetres his feet end up off), then the family's digest
    const FRAMES = 30, SEED = 31337, SECS = 3;
    const run = (w: any) => { Math.random = seeded(SEED); const f: string[] = []; for (let i = 0; i < FRAMES; i++) { w.step(DT); f.push(JSON.stringify(w.game.guards.map((gd: any) => [gd.callsign, gd.char.pos[0], gd.char.pos[2], gd.char.bodyYaw, gd.char.aimYaw]))); } return { f, d: digestRun(w, SECS, SEED) }; };
    const part = (a: string[], b: string[]) => { const i = a.findIndex((x, k) => x !== b[k]); if (i < 0) return ''; const x = JSON.parse(a[i]), y = JSON.parse(b[i]); const m = x.find((r: any, k: number) => JSON.stringify(r) !== JSON.stringify(y[k])); return `frame ${i + 1}${m ? `, ${m[0]}` : ''}`; };
    const one = async (what: string, wish: boolean) => {
      const fails: string[] = [], notes: string[] = []; const { game } = W;
      const hit = steps(W, 90, () => mid(game).length > 0 && !canSave(game) && !ambientState(game).run);
      if (TURN.on <= 0.5 || !SAVETIMELINE.turn) fails.push(`the switches are not up under TPS_TURN=1 TPS_SAVETURN=1 (TURN.on ${TURN.on}, SAVETIMELINE.turn ${SAVETIMELINE.turn})`);
      if (!hit) { fails.push('no man was caught mid-turn on a frame that can be saved inside 90 s'); lines.push({ ok: false, what, notes, fails }); return; }
      const men = mid(game), who = men.map((gd: any) => gd.callsign);
      if (wish) { const c = men[0].char; c.bodyYaw = wrapAngle(c.bodyYaw + 0.4); notes.push(`${who[0]}'s body yaw written 0.4 rad on after his own update, as a man turning to talk has it written`); }
      const s = saveState(game, { label: 'turn', kind: 'harness' }); const json = JSON.stringify(s);
      const filed = s.guards.filter((x: any) => Array.isArray(x.turn)); const t0 = filed.find((x: any) => x.callsign === who[0])?.turn as number[] | undefined;
      notes.push(`t ${game.time.toFixed(2)}: ${who.join(', ')} mid-turn (${t0 ? `${Math.abs(wrapAngle(t0[4] - t0[0])).toFixed(2)} rad still to come round, ${Math.abs(t0[2]).toFixed(1)} rad/s in his feet` : 'NOT in the file'}); ${filed.length} of ${s.guards.length} men filed with a turn`);
      if (!t0 || t0.length !== 9) fails.push('the man mid-turn has no turn in the file');
      if (wish && t0 && s.guards.find((x: any) => x.callsign === who[0]).bodyYaw === t0[0]) fails.push('the staged wish is not in the file');
      const file = () => { const f = JSON.parse(json); if (BREAK) for (const x of f.guards) delete x.turn; return f; };   // (the break: a file from before the key)
      const { A, B, C, W2 } = await futures(W, file, run);
      const ab = part(A.f, B.f), bc = part(B.f, C.f);
      notes.push(`the first ${FRAMES} frames: A against B ${ab ? `part at ${ab}` : 'the same'}, B against C ${bc ? `part at ${bc}` : 'the same'} · digests over the ${SECS} s after: A ${A.d.hash} · B ${B.d.hash} · C ${C.d.hash}${BREAK ? ' (CHECKPOINT_TURN_BREAK=1: the key taken out of the file — the futures must part)' : ''}`);
      if (ab) fails.push(`A ≠ B from ${ab}`); else if (A.d.hash !== B.d.hash) fails.push(`A ≠ B — ${firstDiff(A.d.samples, B.d.samples)}`);
      if (bc) fails.push(`B ≠ C from ${bc}`); else if (B.d.hash !== C.d.hash) fails.push(`B ≠ C — ${firstDiff(B.d.samples, C.d.samples)}`);
      if (!BREAK) { Math.random = seeded(1); const W3 = await standUp(); loadState(W3.game, file()); const s2 = saveState(W3.game, { label: 'turn', kind: 'harness' }); if (turns(s) !== turns(s2)) fails.push('save(load(s)) does not hold the same turns and yaws'); }   // (under the break the file has no turn to hold: the futures above are what must part)
      lines.push({ ok: !fails.length, what, notes, fails }); W = W2;   // (the next case walks on in the fresh game)
    };
    await one('(a2.1) a man caught mid-turn is filed with his turn; every man\'s place and yaws agree frame for frame over the first half second and A ≡ B ≡ C over the 3 s after; the file made after a load holds the same turns', false);
    await one('(a2.2) … and with a wish written after his own update on the frame of the save: the loader poses him where his weight had got him and hands the wish back', true);
    // the switch off: no file says a turn (the file as it was), and a file that has one is loaded as the same file without the key
    { const fails: string[] = [], notes: string[] = []; const { game } = W; const hit = steps(W, 90, () => mid(game).length > 0 && !canSave(game) && !ambientState(game).run);
      if (!hit) fails.push('no man was caught mid-turn on a frame that can be saved inside 90 s'); else {
        const on = saveState(game, { label: 'turn', kind: 'harness' }), json = JSON.stringify(on); SAVETIMELINE.turn = false; const off = saveState(game, { label: 'turn', kind: 'harness' });
        const nOn = on.guards.filter((x: any) => 'turn' in x).length, nOff = off.guards.filter((x: any) => 'turn' in x).length; const bare = JSON.parse(json); for (const x of bare.guards) delete x.turn;
        const same = JSON.stringify(bare.guards) === JSON.stringify(off.guards);
        notes.push(`${nOn} men filed with a turn with the switch on, ${nOff} with it off; the guards' slice bar the key ${same ? 'the same' : 'DIFFERENT'}`);
        if (!nOn || nOff || !same) fails.push('SAVETIMELINE.turn off does not write the file as it was');
        const load = (f: any) => { loadState(game, f); W.cam.target = v3.copy(game.player.char.pos); return run(W); };
        const keyed = load(JSON.parse(json)), plain = load(JSON.parse(JSON.stringify(bare))); SAVETIMELINE.turn = true; const put = load(JSON.parse(json));
        const kp = part(keyed.f, plain.f) || (keyed.d.hash !== plain.d.hash ? 'the digest after' : ''), pp = part(put.f, plain.f);
        notes.push(`the switch off, the file with its turns against the same file with the key taken out: ${kp ? `part at ${kp}` : `the same over ${FRAMES} frames and the ${SECS} s after`}; the switch on again, the same two ${pp ? `part at ${pp}` : 'do not part'}`);
        if (kp) fails.push(`with the switch off a file's turn is still put back (parts from the keyless file at ${kp})`);
        if (!pp) fails.push('with the switch on the file\'s turn made no difference: this line proves nothing'); }
      lines.push({ ok: !fails.length, what: '(a2.3) with SAVETIMELINE.turn off no file says a turn, the rest of the guards\' slice is what it was, and a file that has one loads as the same file without the key', notes, fails }); }
  } finally { for (const [k, v] of [['TPS_TURN', env.turn], ['TPS_SAVETURN', env.save]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } TURN.on = was.turn; SAVETIMELINE.turn = was.save; }
  for (const L of lines) { if (!L.ok) familyFails++; verdictLine(L.ok, L.what, L.notes.join('\n    '), L.fails); }
}

// ================================================================================================================================ (b) autosave triggers + gates
export async function checkpointAutosave() {
  console.log('\n=== checkpoint-autosave: each trigger fires once (room / stage / body / quiet), nothing is written while compromised (alert man, awareness over the line, mid-pick, a live can), the request waits then lands or lapses; slots rotate; the tag + the row appear ===');
  const fails: string[] = []; const notes: string[] = [];
  Math.random = seeded(515);
  const W = await standUp(); const { game } = W; const S = game.saves; const store = S.store;
  game.player.visibility = 0.02; game.godMode = true; game.playerInvisible = true;   // (unseen, unheard: this is about the controller, not the senses)
  const written: any[] = []; S.onSaved = (s: any, info: any) => written.push({ label: s?.label ?? info?.label, key: info?.key, t: game.time, why: S.log[S.log.length - 1]?.what });
  game.guards.forEach((gd: any, i: number) => { gd.heardUpTo = 1e12; place(gd, [8 + i * 3, 0, 1.6], Math.PI); gd.hold = true; gd.flashlight.enabled = false; });   // parked on the north verge, held
  for (const cv of game.civilians ?? []) cv.heardUpTo = 1e12;   // (the cleaner / the late worker deaf too: a stun can going off in the cubicles sends her to the phone, and a civilian on the phone to security rightly holds the gate — review G3.4 — which is the senses' business, not the controller's)
  rollcallState(game).nextAt = 1e9;
  steps(W, 0.5);
  const req0 = S.stats.requests;
  // ROOM: teleport into the conference room (a region he has not been in — he starts in the lobby) → a request 'room', written after the debounce
  game.teleportPlayer([8, 0, 8]); steps(W, DT);
  if (S.stats.requests !== req0 + 1 || !/room/.test(S.pending?.why ?? '')) fails.push(`entering the conference room raised ${S.stats.requests - req0} request(s) (pending ${S.pending?.why}; log ${S.log.slice(-2).map((l: any) => l.what).join(' | ')})`);
  steps(W, CKPT.debounceSecs + 0.5);
  if (written.length !== 1) fails.push(`the room request wrote ${written.length} save(s) after the debounce (gate ${S.gate(game)}; log ${S.log.slice(-2).map((l: any) => l.what).join(' | ')})`); else notes.push(`room → ${written[0].key} at ${written[0].t.toFixed(1)} s`);
  if (!written.length) { verdictLine(false, '(b) autosave', notes.join('\n    '), fails); familyFails++; return; }
  // the same room again: nothing; another new room inside minGap: requested, deferred past the gap, then written
  game.teleportPlayer([9.5, 0, 8.5]); steps(W, 0.5); if (S.pending) fails.push('re-entering the conference room raised a request');
  game.teleportPlayer([20, 0, 11]); steps(W, DT); const tReq = game.time;   // the corridor
  if (!S.pending) fails.push('the corridor raised no request');
  steps(W, CKPT.debounceSecs + 0.5); if (written.length !== 1) fails.push(`a save landed ${(game.time - written[0].t).toFixed(1)} s after the last (min gap ${CKPT.minGapSecs})`);
  steps(W, CKPT.minGapSecs); if (written.length !== 2) fails.push(`the deferred corridor request never landed (${written.length} saves, pending ${S.pending?.why ?? 'none'})`); else notes.push(`corridor deferred ${(written[1].t - tReq).toFixed(1)} s by the gap → ${written[1].key}`);
  // COMPROMISED: a man alert → the cubicles entered raises a request that must NOT land while he is alert; calm him under pendingSecs → it lands
  const [A, B] = game.guards;
  steps(W, CKPT.minGapSecs + 1);
  A.hold = false; A.state = 'alert'; A.awareness = 1; A.lastKnown = [30, 0, 6]; A.lastSeenT = game.time - 30; A.pinned = true;   // (pinned: alert in place, going nowhere)
  game.teleportPlayer([20, 0, 16]); steps(W, DT); if (!S.pending) fails.push('the cubicles raised no request');
  const nBefore = written.length; steps(W, 8); if (written.length !== nBefore) fails.push(`a save was WRITTEN with ${A.callsign} alert`); if (!/alert|search/.test(S.gate(game) ?? '')) fails.push(`gate says '${S.gate(game)}' with a man alert`);
  A.state = 'patrol'; A.awareness = 0; A.lastKnown = null; A.pinned = false; A.hold = true; A.path = []; game.alarm.episode = false; game.escalation = 0; game.escalationT = -1; steps(W, 1.0);
  if (written.length !== nBefore + 1) fails.push(`the cubicles request did not land once he calmed (${written.length - nBefore}, pending ${S.pending?.why ?? 'none'}, gate ${S.gate(game)})`); else notes.push('alert man: held off, landed on calm');
  // awareness over the line (suspicious 0.5) blocks; 0.35 does not
  steps(W, CKPT.minGapSecs + 1);
  const pinB = (aw: number, secs: number) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { B.awareness = aw; B.state = 'suspicious'; B.lastKnown = [22, 0, 18]; B.reactT = 1; W.step(DT); } };   // (his suspicion held at that level frame by frame: left alone it decays under the line inside the debounce, which is the gate working, not failing)
  S.request(game, 'probe', 'over the line'); pinB(0.5, CKPT.debounceSecs + 1); const nb2 = written.length; if (written.length !== nBefore + 1) fails.push('a save landed with a man at awareness 0.5');
  pinB(0.35, 1); if (written.length !== nb2 + 1) fails.push(`awareness 0.35 (under ${CKPT.awareMax}) still blocked the save (gate ${S.gate(game)})`); else notes.push('awareness 0.5 blocks, 0.35 passes');
  B.awareness = 0; B.state = 'patrol'; B.lastKnown = null; B.reactT = 0;
  // MID-ACTION: picking a lock → blocked; the pick ends → lands. A live stun can → blocked till it has gone off.
  steps(W, CKPT.minGapSecs + 1);
  { const d = game.doors.byName('server'); const spot: Vec3 = [d.frameCentre[0], 0, d.def.hinge[1] + d.keySide * 0.9]; game.teleportPlayer(spot); game.player.crouch = true; steps(W, 2 * DT);
    if (game.doors.lockedOut(d, game.player.char.pos, game.player.keys)) { startPicking(game, d); steps(W, 0.3); S.request(game, 'probe', 'mid-pick'); steps(W, CKPT.debounceSecs + 0.5); const nb = written.length; if (game.player.picking && written.length !== nb) fails.push('a save landed mid-pick'); if (!/pick/.test(S.gate(game) ?? '') && game.player.picking) fails.push(`gate '${S.gate(game)}' mid-pick`);
      const nb3 = written.length; steps(W, 6, () => !game.player.picking); steps(W, 1); if (written.length !== nb3 + 1) fails.push(`the mid-pick request did not land when the pick ended (${written.length - nb3}; pending ${S.pending?.why ?? 'none'}; gate ${S.gate(game)})`); else notes.push('mid-pick: held, landed after'); }
    else fails.push('STAGING: the server door is not locked against him at its keyed face — the mid-pick case could not run'); }   // (a documented case that cannot be staged is a red, never a quiet skip)
  steps(W, CKPT.minGapSecs + 1);
  { game.dropThrowable('flash', [game.player.char.pos[0] + 3, 0, game.player.char.pos[2]]); for (const gd of game.guards) gd.dazzledUntil = -1;
    S.request(game, 'probe', 'live can'); const nb = written.length; steps(W, 0.2); if (!/fuse|air/.test(S.gate(game) ?? '')) fails.push(`gate '${S.gate(game)}' with a stun can on its fuse`);
    steps(W, CKPT.debounceSecs + 2.5); for (const gd of game.guards) { gd.awareness = 0; gd.state = 'patrol'; gd.lastKnown = null; gd.dazzledUntil = -1; gd.reactT = 0; } steps(W, 1.5);
    if (written.length !== nb + 1) fails.push(`the live-can request: ${written.length - nb} saves (pending ${S.pending?.why ?? 'none'}, gate ${S.gate(game)})`); else notes.push('stun can on its fuse: held, landed after the bang'); }
  // LAPSE: a request that cannot land inside pendingSecs is dropped, counted
  steps(W, CKPT.minGapSecs + 1);
  { const dropped0 = S.stats.dropped, nb = written.length; S.request(game, 'probe', 'will lapse'); const n = Math.round((CKPT.pendingSecs + 2) / DT); for (let i = 0; i < n; i++) { B.awareness = 0.7; B.state = 'suspicious'; B.lastKnown = [22, 0, 18]; B.reactT = 1; W.step(DT); }   // (a man kept over the line for longer than a request may wait)
    if (S.pending || S.stats.dropped !== dropped0 + 1 || written.length !== nb) fails.push(`an unmeetable request did not lapse (pending ${!!S.pending}, dropped ${S.stats.dropped - dropped0}, written ${written.length - nb})`); else notes.push(`unmet request lapsed after ${CKPT.pendingSecs} s`); B.state = 'patrol'; B.awareness = 0; B.lastKnown = null; B.reactT = 0; }
  // BODY: choke a parked man out, haul him 2 m, let go → 'body' request
  steps(W, 2);
  { const Cg = game.guards[2]; Cg.hold = false; place(Cg, [30, 0, 20], 0); killGuard(game, Cg, [0, 0, 1], true, 'choked'); steps(W, 2.5);
    for (const gd of game.guards) if (gd.state !== 'dead') { gd.awareness = 0; gd.state = 'patrol'; }
    const hips = Cg.char.bones.hips ?? Cg.char.pos; game.teleportPlayer([hips[0], 0, hips[2] - 0.75]); game.player.crouch = true; steps(W, CKPT.debounceSecs + 0.5);   // (the break room is a new region: its own request lands first)
    toggleDrag(game, Cg); if (!game.player.dragging) fails.push(`could not take hold of the body (${v3.distXZ(game.player.char.pos, hips).toFixed(2)} m off his hips)`);
    const rag = Cg.char.ragdoll; const b0: Vec3 = [rag.x[0], 0, rag.x[2]];
    for (let i = 0; i < 540 && game.player.dragging && Math.hypot(rag.x[0] - b0[0], rag.x[2] - b0[2]) < CKPT.bodyHideM + 0.3; i++) { W.input.keys.add('KeyS'); W.step(DT); } W.input.keys.delete('KeyS'); steps(W, DT);
    const hauled = Math.hypot(rag.x[0] - b0[0], rag.x[2] - b0[2]);
    const r0 = S.stats.requests; if (game.player.dragging) toggleDrag(game); steps(W, 2 * DT);
    if (S.stats.requests !== r0 + 1 || !/body/.test(S.pending?.why ?? '')) fails.push(`letting go of a body hauled ${hauled.toFixed(2)} m raised ${S.stats.requests - r0} request(s) (${S.pending?.why ?? S.log[S.log.length - 1]?.what})`); else notes.push(`body hauled ${hauled.toFixed(2)} m and dropped → request`);
    steps(W, CKPT.debounceSecs + 1); }
  // STAGE: into the server room → 'stage' request (+ maybe 'room')
  steps(W, CKPT.minGapSecs + 1);
  { const R = game.level.mission.serverRoom; const r0 = S.stats.requests; game.teleportPlayer([(R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2]); steps(W, 2 * DT);
    if (game.mission.stage !== 'drive') fails.push(`server room did not advance the stage (${game.mission.stage})`);
    if (!S.log.some((l: any) => /request: (room\+)?stage|request: stage/.test(l.what) || /\+stage/.test(l.what))) fails.push(`no 'stage' request in the log: ${S.log.slice(-3).map((l: any) => l.what).join(' | ')}`); else notes.push(`stage → requested (${S.stats.requests - r0} with the room)`);
    steps(W, CKPT.debounceSecs + 1); }
  // QUIET: 90 s of nothing → exactly one 'quiet' request per 90 s
  { const q0 = S.log.filter((l: any) => /request: quiet/.test(l.what)).length; steps(W, CKPT.quietSecs * 2 + CKPT.minGapSecs + 5); const q1 = S.log.filter((l: any) => /request: quiet/.test(l.what)).length;
    if (q1 - q0 !== 2) fails.push(`${q1 - q0} quiet requests in ${CKPT.quietSecs * 2 + 15} s of quiet (want 2)`); else notes.push('quiet: one request per 90 s'); }
  // REGRET: a man going alert inside regretSecs of an autosave marks that slot; newest() then passes over it for the one before (a checkpoint a stride ahead of being seen is a death loop)
  steps(W, CKPT.minGapSecs + 1);
  { S.request(game, 'probe', 'will be regretted'); steps(W, CKPT.debounceSecs + 0.5); const last = written[written.length - 1]; if (last?.label !== 'will be regretted') fails.push(`the regret case's save did not land (${last?.label})`);
    else { const before = S.newest(); steps(W, 2); A.hold = false; A.pinned = true; A.state = 'alert'; A.awareness = 1; A.lastKnown = v3.copy(game.player.char.pos); steps(W, 0.5);
      const info = S.slots().find((x: any) => x.key === last.key); const nw = S.newest();
      if (!info?.regret) fails.push(`the slot written 2 s before ${A.callsign} went alert carries no regret (${JSON.stringify(info)})`); else if (nw?.key === last.key && S.slots().filter((x: any) => x.runId === S.runId && !x.regret).length) fails.push('newest() still offers the regretted slot with a sound one stored'); else notes.push(`regret: '${info.regret}' → the cards offer '${nw?.label}' instead (was '${before?.label}')`);
      A.state = 'patrol'; A.awareness = 0; A.lastKnown = null; A.pinned = false; A.hold = true; game.alarm.episode = false; game.escalation = 0; game.escalationT = -1; steps(W, 1); } }
  // every write: never with a man alert / searching / over the line at that frame (the onSaved hook stamped the gate's world)
  // slots: only the ring's autosaves (+ index) in the store — auto.0‥2, or five of them under SAVETIMELINE — the index names no more, the newest is the last written
  { const N = ringSize(); const keys = [...store.map.keys()].filter((k: string) => k !== 'twopointsix.save.index' && !k.includes('.save.pic.')).sort(); if (keys.some((k: string) => { const m = /auto\.(\d)$/.exec(k); return !m || +m[1] >= N; })) fails.push(`store keys ${keys.join(',')}`);
    const slots = S.slots(); if (slots.length > N || (written.length >= N && slots.length !== N)) fails.push(`${slots.length} slots indexed after ${written.length} autosaves`);
    if (slots[0]?.label !== written[written.length - 1]?.label) fails.push(`newest slot '${slots[0]?.label}' ≠ last written '${written[written.length - 1]?.label}'`);
    notes.push(`${written.length} autosaves → slots [${slots.map((x: any) => x.key.replace('twopointsix.save.', '') + ':' + x.label).join(', ')}]`); }
  // the tag and the row
  if (!S.flash || S.flash.text !== 'CHECKPOINT') fails.push(`HUD flash ${JSON.stringify(S.flash)}`);
  { const rows = game.chronicle.events.filter((e: any) => e.kind === 'checkpoint' && e.data.what === 'save').length; if (rows !== written.length) fails.push(`${rows} 'checkpoint saved' rows for ${written.length} autosaves`); }
  if (game.chronicle.counts.saves !== written.length) fails.push(`counts.saves ${game.chronicle.counts.saves} ≠ ${written.length}`);
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(b) triggers: room (once per region), stage, body hauled + dropped, quiet/90 s — each a request; gates: alert / search / awareness > 0.4 / mid-pick / a can on its fuse hold the write, calm lands it, an unmet one lapses at 25 s; debounce 2 s, gap 10 s; three rotating slots; the HUD tag + a chronicle row per save', notes.join('\n    '), fails);
}

// ================================================================================================================================ (c) load after death
export async function checkpointDeath() {
  console.log('\n=== checkpoint-death: shot dead after a checkpoint → the newest slot loads: Sam up where it was written, the chronicle carried (+ loaded row, load counted), nothing doubled or leaked, and the run walks on out through the fire exit ===');
  const fails: string[] = []; const notes: string[] = [];
  const { W, notes: staged } = await stageRich(4499); const { game } = W; const S = game.saves;
  notes.push(staged[staged.length - 1]);
  steps(W, 4, () => !ambientState(game).run);
  const res = S.write(game, 'auto', 'before the end'); if (!res.ok) { fails.push(`could not write: ${res.why}`); verdictLine(false, '(c)', notes.join('\n    '), fails); familyFails++; return; }
  const at = v3.copy(game.player.char.pos); const rows0 = game.chronicle.events.length; const score0 = debriefOf(game).score; const elapsed0 = game.mission.stats.elapsed;
  notes.push(`checkpoint '${res.info.label}' ${(res.bytes / 1024).toFixed(1)} KB at (${at[0].toFixed(1)}, ${at[2].toFixed(1)}), ${rows0} rows, score ${score0}`);
  // wander off, get shot dead (god off), the down card's flag comes up
  game.teleportPlayer([20, 0, 11.2]); game.godMode = false; steps(W, 3);
  hitPlayer(game, [1, 0, 0]); steps(W, 3.5);
  if (!game.player.down || game.mission.stage !== 'failed') fails.push(`Sam not down / mission not failed (${game.player.down}, ${game.mission.stage})`);
  const guardObjs = new Set(game.guards);
  // 'restart from checkpoint': the newest slot
  const newest = S.newest(); if (!newest) { fails.push('no newest slot'); verdictLine(false, '(c)', notes.join('\n    '), fails); familyFails++; return; }
  notes.push(`card would say: restart from checkpoint (${S.ageWords(game, newest)})`);
  const why = S.load(game, newest.key); if (why) fails.push(`load refused: ${why}`);
  W.cam.target = v3.copy(game.player.char.pos); steps(W, DT);
  const pl = game.player;
  if (pl.down || v3.distXZ(pl.char.pos, at) > 0.05) fails.push(`after load: down ${pl.down}, ${v3.distXZ(pl.char.pos, at).toFixed(2)} m off the checkpoint`);
  if (game.mission.stage !== 'exfil') fails.push(`stage ${game.mission.stage} (want exfil)`);
  if (game.guards.length !== 3 || game.guards.some((x: any) => guardObjs.has(x))) fails.push(`guards ${game.guards.length}, reused objects ${game.guards.filter((x: any) => guardObjs.has(x)).length}`);
  if (game.guards.filter((x: any) => x.state === 'dead').length !== 1) fails.push(`${game.guards.filter((x: any) => x.state === 'dead').length} bodies (want the one)`);
  { const ck = game.chronicle.events.filter((e: any) => e.kind === 'checkpoint'); if (ck.length !== 2 || ck[0].data.what !== 'save' || ck[1].data.what !== 'load') fails.push(`checkpoint rows ${ck.map((e: any) => e.data.what).join(',')} (want save, load)`);
    if (game.chronicle.counts.loads !== 1) fails.push(`counts.loads ${game.chronicle.counts.loads}`); if (game.chronicle.events.some((e: any) => e.kind === 'down')) fails.push("the 'down' row of the abandoned future survived the load");
    const sc = debriefOf(game).score; if (sc !== score0 - 3) fails.push(`score ${sc} (want ${score0} − 3 for the load)`); else notes.push(`score ${score0} → ${sc} (−3 the load)`);
    if (Math.abs(game.mission.stats.elapsed - elapsed0) > 0.05) fails.push(`mission clock ${game.mission.stats.elapsed.toFixed(2)} ≠ ${elapsed0.toFixed(2)}`); }
  if (game.items.items.some((it: any) => !it.settled) || game.events.length > 4 || game.hover || game.act) fails.push(`leaks: ${game.items.items.filter((it: any) => !it.settled).length} flying items, ${game.events.length} events, hover ${!!game.hover}`);
  if (game.fx.length || game.tracers.live) fails.push(`fx ${game.fx.length} tracers ${game.tracers.live}`);
  // and on: walk out through the fire exit → done, debrief flag
  { const M = game.level.mission; game.godMode = true; game.player.visibility = 0.02; for (const gd of game.guards) gd.heardUpTo = 1e12;
    game.teleportPlayer([M.exfilX - 1.5, 0, M.exfilZ]); steps(W, 2 * DT); const ex = game.doors.byName(M.exfilDoor); if (ex) { ex.locked = false; ex.latched = false; ex.angle = ex.maxA * 0.9; ex.place(); }
    for (let i = 0; i < 240 && game.mission.stage !== 'done'; i++) { W.input.keys.add('KeyD'); W.step(DT); } W.input.keys.delete('KeyD');
    if (game.mission.stage !== 'done') { game.teleportPlayer([M.exfilX + 0.5, 0, M.exfilZ]); steps(W, 0.2); }
    if (game.mission.stage !== 'done') fails.push(`the run did not complete after the load (stage ${game.mission.stage} at ${game.player.char.pos.map((v: number) => v.toFixed(1))})`); else notes.push(`out through the fire exit: ${debriefOf(game).rating} ${debriefOf(game).score}, loads on the card: ${debriefOf(game).counts.loads}`); }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(c) shot dead → newest slot loads: Sam up at the checkpoint, fresh guard objects with the one body, chronicle = save + load rows and −3 on the score, mission clock carried, nothing in the air / on the cursor; then out through the fire exit → done', notes.join('\n    '), fails);
}

// ================================================================================================================================ (d) slots + export / import
export async function checkpointSlots() {
  console.log('\n=== checkpoint-slots: three autosaves rotate through auto.0‥2, a manual sits apart; export → import → load round-trips to the same digest; another level / version is refused ===');
  const fails: string[] = []; const notes: string[] = [];
  Math.random = seeded(8080);
  const W = await standUp(); const { game } = W; const S = game.saves; game.player.visibility = 0.02; game.godMode = true; for (const gd of game.guards) gd.heardUpTo = 1e12; rollcallState(game).nextAt = 1e9;
  steps(W, 0.5);
  const labels: string[] = [];
  const N = ringSize();   // three, or five under SAVETIMELINE (whose own check holds the two rings apart: savetimeline-check.ts)
  for (let i = 0; i < N + 1; i++) { const r = S.write(game, 'auto', `auto #${i}`); if (!r.ok) fails.push(`auto #${i}: ${r.why}`); labels.push(r.info?.key.replace('twopointsix.save.', '')); steps(W, 1); }
  const m = S.write(game, 'manual', 'by hand'); if (!m.ok) fails.push(`manual: ${m.why}`);
  const slots = S.slots();
  { const want = [...Array.from({ length: N }, (_, i) => `auto.${i}`), 'auto.0'].join(','); if (labels.join(',') !== want) fails.push(`rotation ${labels.join(',')} (want ${want})`); }
  if (slots.length !== N + 1) fails.push(`${slots.length} slots (want ${N} auto + manual)`);
  { const a0 = slots.find((x: any) => x.key.endsWith('auto.0')); if (a0?.label !== `auto #${N}`) fails.push(`auto.0 holds '${a0?.label}' (want the one past the ring, 'auto #${N}')`); }
  if (S.newest()?.label !== 'by hand') fails.push(`newest '${S.newest()?.label}' (want the manual, written last)`);
  notes.push(`slots: ${slots.map((x: any) => `${x.key.replace('twopointsix.save.', '')}='${x.label}' ${(x.bytes / 1024).toFixed(0)}K`).join(', ')}`);
  // export (the manual slot's text) → a fresh game imports it → manual slot there → load → digest ≡ loading the object directly
  const text = S.store.get('twopointsix.save.manual'); if (!text) fails.push('nothing to export');
  else {
    Math.random = seeded(1); const W2 = await standUp(); const S2 = W2.game.saves;
    const info = S2.importText(W2.game, text); if (typeof info === 'string') fails.push(`import refused: ${info}`);
    else { const why = S2.load(W2.game, info.key); if (why) fails.push(`imported slot would not load: ${why}`); const D1 = digestRun(W2, 5, 31337);
      Math.random = seeded(1); const W3 = await standUp(); loadState(W3.game, JSON.parse(text)); const D2 = digestRun(W3, 5, 31337);
      if (D1.hash !== D2.hash) fails.push(`import→load ≠ direct load: ${firstDiff(D1.samples, D2.samples)}`); else notes.push(`export ${(text.length / 1024).toFixed(1)} KB → import → load ≡ direct load (${D1.hash})`); }
    // refusals: version, level
    const bad = JSON.parse(text); bad.v = 99; if (!/version/.test(canLoad(game, bad) ?? '')) fails.push(`a v99 file: '${canLoad(game, bad)}'`);
    const other = JSON.parse(text); other.level.fp = 'deadbeef'; if (!/another level/.test(canLoad(game, other) ?? '')) fails.push(`another level's file: '${canLoad(game, other)}'`);
    if (typeof S.importText(game, '{not json') !== 'string') fails.push('garbage imported');
    notes.push('v99 / another level / garbage refused with the reason');
  }
  S.clear(); if (S.slots().length) fails.push(`clear left ${S.slots().length} slots`);
  // the harness's own helpers over the same two functions (headless.ts W.snapshot / W.restore): a probe staged once, restarted from the object
  { const at = v3.copy(game.player.char.pos); const snap = W.snapshot('harness helper'); game.teleportPlayer([20, 0, 11]); steps(W, 1); W.restore(snap); steps(W, 0.5); if (v3.distXZ(game.player.char.pos, at) > 0.05 || snap.kind !== 'harness') fails.push(`W.restore: ${v3.distXZ(game.player.char.pos, at).toFixed(2)} m off, kind ${snap.kind}`); else notes.push('W.snapshot() / W.restore() round-trip'); }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(d) auto.0 → 1 → 2 → 0 (the 4th overwrites the 1st), the manual apart, newest = last written; export → import (manual slot) → load ≡ a direct load; wrong version / level / garbage refused; clear empties the store', notes.join('\n    '), fails);
}

// ================================================================================================================================ (e) refusals
export async function checkpointRefuse() {
  console.log('\n=== checkpoint-refuse: no checkpoint under the tour flag, in daylight, with the QRF past idle, with a unit on the floor, with Sam down; a scripted man / Sam holding a man refuse a plain save and FILE under force (let go of in the file, untouched in the game) ===');
  const fails: string[] = []; const notes: string[] = [];
  Math.random = seeded(6060);
  const W = await standUp(); const { game } = W; game.player.visibility = 0.02; game.godMode = true; for (const gd of game.guards) gd.heardUpTo = 1e12; rollcallState(game).nextAt = 1e9;
  steps(W, 0.5);
  const expect = (label: string, re: RegExp, force = false) => { const why = canSave(game, force); if (!why || !re.test(why)) fails.push(`${label}: canSave → '${why}' (want ${re})`); else notes.push(`${label}: '${why}'`); let threw = false; try { saveState(game, { force }); } catch { threw = true; } if (!threw) fails.push(`${label}: saveState did not throw`); };
  // tour flag
  game.quietUtility = true; game.touring = true; expect('tour', /show/); game.quietUtility = false; game.touring = false;
  game.puppet = { goal: null, aim: null }; expect('puppet', /show/); game.puppet = null;
  // daylight
  if (game.level.daylight) { setDaylight(game, true); expect('daylight', /daylight/); setDaylight(game, false); steps(W, DT); } else fails.push('STAGING: the level has no daylight variant — the daylight refusal could not be exercised');   // (every soft-skip below is likewise a FAIL: six documented refusals must all be staged)
  // QRF requested
  { const ok = requestQrf(game, 'panel'); if (!ok) fails.push(`STAGING: the QRF would not come from the panel here (qrf ${game.qrf?.state}) — the QRF refusal could not be exercised`); else { expect('qrf requested', /response team/); } resetQrf(game); for (const gd of [...game.guards]) if (gd.unit) despawnUnit(game, gd); steps(W, DT); }
  // a unit
  { let u: any = null; try { u = spawnUnit(game, { team: 'guard', pos: [6, 0, 11], yaw: 0, weapon: 'guard9mm', name: 'Probe' }); } catch (e) { fails.push(`STAGING: spawnUnit threw (${(e as Error).message.slice(0, 60)}) — the unit refusal could not be exercised`); }
    if (u) { expect('unit on the floor', /unit/); despawnUnit(game, u); steps(W, DT); } }
  // a scripted man: plain refuses, force files him unscripted (and leaves the game's man scripted)
  { const A = game.guards[0]; A.script = { goal: null, face: 0 }; expect('scripted man', /scripted/); const s = saveState(game, { force: true }); if (s.guards[0].state === 'dead' || !s.forced.some((f: string) => /scripted/.test(f))) fails.push(`force did not file the scripted man sanely (${s.guards[0].state}, forced [${s.forced.join(',')}])`); if (!A.script) fails.push('force touched the running game (script gone)'); else notes.push(`force: files him '${s.guards[0].state}', forced [${s.forced.join(', ')}], game untouched`); A.script = null; A.char.anim.stance = 'none'; }
  // Sam holding a man: plain refuses (mid-action), force files the pair apart
  { const B = game.guards[1]; place(B, [16, 0, 11.2], Math.PI / 2); game.teleportPlayer([15.2, 0, 11.2]); game.player.crouch = true; steps(W, DT); startGrab(game, B); steps(W, 3, () => game.player.holding?.phase === 'held');
    if (!game.player.holding) fails.push(`STAGING: the grab did not settle into a hold (holding ${game.player.holding?.phase ?? 'none'}) — the held-man refusal could not be exercised`);
    else { expect('holding a man', /holding/); const s = saveState(game, { force: true }); if (!game.player.holding || !B.held) fails.push('force freed the man in the RUNNING game'); if (s.guards[1].state === 'dead' || s.forced.length === 0) fails.push(`forced file: ${s.guards[1].state}, forced [${s.forced.join(',')}]`);
      // and that file loads to a free man on his feet and a free Sam
      Math.random = seeded(2); const W2 = await standUp(); loadState(W2.game, JSON.parse(JSON.stringify(s))); steps(W2, 0.5); const b2 = W2.game.guards[1]; if (b2.held || W2.game.player.holding || b2.state === 'dead') fails.push(`loaded: held ${!!b2.held} holding ${!!W2.game.player.holding} ${b2.state}`); else notes.push(`force + hold: file loads to ${b2.callsign} ${b2.state}, free, Sam's hands free`);
      game.freeHeld('cancel'); steps(W, 0.5); } }
  // a body still FALLING: a plain save refuses (it would be filed settled in mid-air — review finding); forced, the file lets it fall from rest on load
  { const C = game.guards[2]; place(C, [30, 0, 20], 0); killGuard(game, C, [0, 0, 1], false, 'shot'); steps(W, 1.0, () => game.items.items.every((it: any) => it.settled) && !C.char.ragdoll?.sleeping && game.time - C.diedAt > 0.5);   // (past his pistol settling, the body still awake)
    if (!C.char.ragdoll || C.char.ragdoll.sleeping) fails.push(`STAGING: the shot man's body was asleep at once (ragdoll ${C.char.ragdoll ? 'sleeping' : 'none'}) — the mid-fall refusal could not be exercised`);
    else { expect('a body mid-fall', game.items.items.every((it: any) => it.settled) ? /falling/ : /falling|in the air/); const s = saveState(game, { force: true }); const r0 = s.guards[2].rag; if (!r0 || r0.sleeping !== false) fails.push(`forced file: rag ${r0 ? 'sleeping ' + r0.sleeping : 'missing'}`);
      let hMax0 = 0; for (let k = 1; k < r0.x.length; k += 3) hMax0 = Math.max(hMax0, r0.x[k]);
      Math.random = seeded(4); const W2 = await standUp(); loadState(W2.game, JSON.parse(JSON.stringify(s))); steps(W2, 4); const rag = W2.game.guards[2].char.ragdoll; let hMax = 0; for (let k = 1; k < rag.x.length; k += 3) hMax = Math.max(hMax, rag.x[k]);
      if (!rag.sleeping || hMax > 0.45) fails.push(`after loading the mid-fall file: sleeping ${rag.sleeping}, highest particle ${hMax.toFixed(2)} m (was ${hMax0.toFixed(2)} m in the file)`); else notes.push(`mid-fall body (highest particle ${hMax0.toFixed(2)} m in the forced file) fell to rest after the load: ${hMax.toFixed(2)} m, asleep`); }
    steps(W, 3); }
  // Sam down
  { game.godMode = false; hitPlayer(game, [1, 0, 0]); steps(W, 0.2); expect('Sam down', /down/); }
  // and the autosave controller says the same through its gate / never writes: a request under the tour flag is dropped at once
  { Math.random = seeded(3); const W3 = await standUp(); const g3 = W3.game; const S3 = g3.saves; steps(W3, 0.3); g3.quietUtility = true; g3.touring = true; S3.request(g3, 'probe', 'under tour'); steps(W3, 3); if (S3.pending || S3.stats.autosaves) fails.push(`under the tour flag: pending ${!!S3.pending}, autosaves ${S3.stats.autosaves}`); else notes.push('autosave: a request under the tour flag is dropped, nothing written'); }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(e) refused with the reason: tour / puppet, daylight, QRF requested, a unit, Sam down; scripted man + held man refuse plain and file under force without touching the game, and the forced file loads sane', notes.join('\n    '), fails);
}
