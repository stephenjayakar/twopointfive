// The 'teams' probe family (run through probes.ts: `bun run tools/qa/probes.ts teams | teams-table | teams-fight | teams-player | teams-dark | teams-despawn |
// teams-identity [--verbose] [--print]`): SIDES for the AI (guards.ts teams — the 'Breach' showcase's two operatives clearing a room of hostiles, all AI) —
// who is hostile to whom, AI men perceiving / targeting / shooting hostile AI men through the same senses they use on Sam, the spawn / despawn / engage seam
// the stage lane calls, and above all IDENTITY: with no unit spawned the guards-versus-Sam game is the game it was, frame for frame and round for round.
//   teams-identity  a seeded 45 s fight staged like weapons-identity's guard section and then let off the leash (a second man freed, Sam teleported out of their
//                   sight and back): a digest of every man's state / position / aim / awareness / fix and of Sam's, every frame, plus the frames the rounds left
//                   on — FROZEN on the tree before the teams change (EXPECT below); the tree with teams must reproduce it exactly. `--print` re-measures it.
//   teams-table     the hostility table, both ways round, for every pair of sides.
//   teams-fight     two operatives (FN2000) and two hostiles (AKS-74U) spawned nine metres apart up the cubicles' north aisle, lit, in each other's sight, all four
//                   put in the fight by engage(): inside six seconds somebody is dead, rounds went BOTH ways (the shot events by who fired them), nobody ever had a
//                   man of his own side as his foe, and the three staff guards parked on the lot said and radioed nothing and the floor's alarm never moved.
//   teams-player    an operative two metres in front of a lit Sam for five seconds never takes him as a foe (friendly) and never fires; a hostile put in the same
//                   place has him as his foe inside a second.
//   teams-dark      a hostile standing in the dark (his room's lights out) round a partition from an alert operative: not acquired in five seconds; the moment he
//                   fires the operative has a fix on him (heard); lights back on and in the open, acquired by sight inside two seconds.
//   teams-despawn   spawn four, despawn them: the guards list, the light list, the character ids and the probe keys are back to what they were, and a headless
//                   showcase tour run straight after in the same process passes.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { resetChase } = guardsMod;
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const PRINT = process.argv.includes('--print');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }
/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east, deaf (weapons-identity's parking, kept letter for letter: the digest depends on it) */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
/** alert, licensed (a sighting this frame), the gun coming round in `fireCd`; `pinned`: fires from where he was put (weapons-identity's man) or free to close and step */
function armAlert(gd: any, game: any, fireCd = 0.3, pinned = true) { gd.hold = false; gd.pinned = pinned; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; resetChase(gd); }

/** FNV-1a over strings, 32 bits, chained: the digest of a run */
class Digest {
  h = 0x811c9dc5 >>> 0; n = 0;
  add(s: string) { for (let i = 0; i < s.length; i++) { this.h ^= s.charCodeAt(i); this.h = Math.imul(this.h, 0x01000193) >>> 0; } this.n++; }
  num(x: number | null | undefined) { this.add(x === null || x === undefined ? '~' : String(x)); }   // (String(x): every bit of the double — identity means identity)
  vec(p: number[] | null | undefined) { if (!p) { this.add('~'); return; } this.num(p[0]); this.num(p[1]); this.num(p[2]); }
  get hex() { return this.h.toString(16).padStart(8, '0'); }
}

// ================================================================ (f) identity: no unit spawned, the fight against Sam is the fight it was
/** The staging is weapons-identity's guard section (seed, spots, the parked pair, the pinned man 6.5 m up the corridor from a lit god-mode Sam) for the first
 *  fifteen seconds — so its frozen shot frames are a second witness — and then everything the teams change had to route through a 'foe' is exercised with the
 *  men FREE: at 15 s the corridor man is unpinned and the cubicles man is stood in the corridor behind him and freed too (closing, the colleague in the line,
 *  the side-step, muzzle discipline, the bore's last look, a colleague's shots placing Sam); at 25 s Sam is teleported into the server room out of their sight
 *  (the fix led through the doorway, the chase, the pie, the search and its spots); at 35 s back into the corridor in front of them (re-acquired, the aim
 *  model's track from nothing). Every frame: each man's state, position, body / aim yaw, aim pitch, awareness, fireCd, reloadT, fix, path length and Sam's
 *  position + hitFlash go into the digest; the frames a report played on are listed. */
async function identityRun(): Promise<{ digest: string; frames: number; shotFrames: number[]; states: string; hits: number }> {
  Math.random = seeded(502);
  const W = await standUp(); const { game } = W; const pl = game.player;
  if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (civilians scream and run under gunfire: this family's frozen numbers predate them — switched off like the other identity probes)
  game.godMode = true; game.aiEnabled = true;
  if ('tactics' in game.tune) game.tune.tactics = false;   // (the pursuit tactics — game/tactics.ts, after this digest was frozen — re-deal two free alert men on one fix by design; this card measures the TEAMS change alone, so they are pinned off here: their own identity card, tools/qa tactics-identity, holds their off path to the old chase)
  if ('devices' in game.tune) game.tune.devices = false;   // (the level's cameras — game/devices.ts, also after the freeze — see Sam standing lit in the corridor and send the parked third man to look ('aas' at 15 s, two rounds different): pinned off for the same reason; the devices family holds its own vision digest)
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(B, 1); park(C, 2);
  game.teleportPlayer([24.0, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(A, [17.5, 0, 11.3], Math.PI / 2); W.step(DT); pl.visibility = 0.9;
  armAlert(A, game, 0.3, true);
  const audio: any[] = []; W.audioLog = audio;
  const D = new Digest(); const shotFrames: number[] = []; let idx = 0; let states = ''; let hits = 0;
  const FRAMES = 60 * 45;
  for (let frame = 0; frame < FRAMES; frame++) {
    if (frame === 60 * 15) { A.pinned = false; resetChase(A); B.dazzledUntil = -1; place(B, [12.5, 0, 11.2], Math.PI / 2); armAlert(B, game, 0.5, false); B.heardUpTo = -1; A.heardUpTo = -1; }   // off the leash, both, and listening again
    if (frame === 60 * 25) game.teleportPlayer([18.0, 0, 7.0]);    // into the server room, out of their sight
    if (frame === 60 * 35) game.teleportPlayer([26.0, 0, 11.3]);   // back out in the corridor, east of them
    pl.visibility = 0.9; W.step(DT);
    if (pl.hitFlash > 0.9) hits++; pl.hitFlash = 0;
    for (; idx < audio.length; idx++) { const a = audio[idx]; if (a.name === 'pistolLoud' || a.name === 'pistolSuppressed') shotFrames.push(frame); }
    for (const gd of game.guards) { D.add(gd.state); D.vec(gd.char.pos); D.num(gd.char.bodyYaw); D.num(gd.char.aimYaw); D.num(gd.char.aimPitch); D.num(gd.awareness); D.num(gd.fireCd); D.num(gd.reloadT); D.vec(gd.lastKnown); D.num(gd.path.length); D.num(gd.muzzleDown ? 1 : 0); }
    D.vec(pl.char.pos); D.num(game.events.length);
    if (frame % 300 === 0) states += game.guards.map((g: any) => g.state[0]).join('') + ' ';
  }
  W.audioLog = null;
  return { digest: D.hex, frames: FRAMES, shotFrames, states, hits };
}
export async function teamsIdentity() {
  console.log('\n=== teams-identity: no unit spawned — a seeded 45 s fight (weapons-identity\'s pinned man, then two free men, Sam out of sight and back) digested frame by frame against the digest frozen before the teams change ===');
  const R = await identityRun();
  if (PRINT) console.log(`\n--- measured (paste over EXPECT_IDENTITY) ---\nconst EXPECT_IDENTITY = ${JSON.stringify({ digest: R.digest, frames: R.frames, shotFrames: R.shotFrames, states: R.states, hits: R.hits })};\n`);
  const E = EXPECT_IDENTITY; let allPass = true;
  const first15 = R.shotFrames.filter(f => f < 60 * 15 - 1);   // (the pinned spell: weapons-identity's own frames, its second witness — up to the frame the leash comes off)
  allPass = verdict(JSON.stringify(first15) === JSON.stringify(WEAPONS_IDENTITY_FIRST15), 'the pinned fifteen seconds are weapons-identity\'s frames', `rounds at ${JSON.stringify(first15)}${JSON.stringify(first15) === JSON.stringify(WEAPONS_IDENTITY_FIRST15) ? '' : `\n    want ${JSON.stringify(WEAPONS_IDENTITY_FIRST15)}`}`) && allPass;
  allPass = verdict(JSON.stringify(R.shotFrames) === JSON.stringify(E.shotFrames), 'every round of the 45 s on the frame it was', `${R.shotFrames.length} rounds${JSON.stringify(R.shotFrames) === JSON.stringify(E.shotFrames) ? '' : `\n    got  ${JSON.stringify(R.shotFrames)}\n    want ${JSON.stringify(E.shotFrames)}`}`) && allPass;
  allPass = verdict(R.states === E.states && R.hits === E.hits, 'states every 5 s and rounds in Sam as they were', `${R.states.trim()} · ${R.hits} in Sam${R.states === E.states && R.hits === E.hits ? '' : ` — want ${E.states.trim()} · ${E.hits}`}`) && allPass;
  allPass = verdict(R.digest === E.digest && R.frames === E.frames, 'the per-frame digest of everybody\'s state / position / aim / awareness / fix', `${R.digest} over ${R.frames} frames${R.digest === E.digest ? '' : ` — want ${E.digest}`}`) && allPass;
  console.log(`=== teams-identity: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
/** weapons-identity's frozen guard shot frames inside its first fifteen seconds (tools/qa/weapons-probes.ts EXPECT.guard.shotFrames, < 900) */
const WEAPONS_IDENTITY_FIRST15 = [18, 79, 116, 154, 212, 246, 309, 362, 407, 463, 501, 563, 667, 724, 785, 827, 878];
// frozen on the tree before the teams change, commit c8402f2 = main's code (`teams-identity --print` regenerates the literal)
const EXPECT_IDENTITY = {"digest":"6934142b","frames":2700,"shotFrames":[18,79,116,154,212,246,309,362,407,463,501,563,667,724,785,827,878,926,969,1032,1082,1122,1178,1227,1331,1382,1424,1471,2523,2586,2644,2676,2695],"states":"app app app aap aap aap ssp ssp ssp ","hits":33};

// ================================================================ shared staging for the behaviour probes
const teamsMod = await import(`${ROOT}/src/game/teams.ts`);
const { spawnUnit, despawnUnit, despawnUnits, units, engage, engagementOf, lightEstimateAt, canSeeChar } = guardsMod;
const chestOf = (c: any): Vec3 => c.bones.chest ?? v3.add(c.pos, [0, 1.1, 0]);
const eyeOf = (c: any): Vec3 => c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]);
/** the three staff parked on the lot east of the building — held, pinned, blind and deaf (standoff-probes' parking): out of every unit's sight and hearing */
function parkStaff(game: any) { game.guards.forEach((gd: any, i: number) => { if (gd.unit) return; gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); }); }
/** what everybody says (game.say) and radios, by side, from here on */
function tapSay(game: any) {
  const lines: { t: number; who: string; team: string; text: string; radio: boolean }[] = [];
  const orig = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => { const r = orig(gd, text, radio); if (gd.bubble && gd.bubble.text === text && gd.bubble.t === game.time) lines.push({ t: game.time, who: gd.callsign, team: gd.team, text, radio }); return r; };
  return lines;
}
/** gunfire events raised since the last call, by the side of who fired (events are re-filtered every frame: identity set) */
function shotCounter(game: any) {
  const seen = new Set<any>(); const byTeam: Record<string, number> = {}; const byWho: Record<string, number> = {};
  return {
    pump() { for (const e of game.events) { if (seen.has(e) || (e.kind !== 'shot' && e.kind !== 'guardShot') || (e.level ?? 0) < 1) continue; seen.add(e); const t = e.kind === 'shot' ? 'player' : teamsMod.teamOfId(game, e.who ?? -1); byTeam[t] = (byTeam[t] ?? 0) + 1; const w = e.kind === 'shot' ? 'Sam' : (game.guards.find((x: any) => x.char.id === e.who)?.callsign ?? `#${e.who}`); byWho[w] = (byWho[w] ?? 0) + 1; } },
    byTeam, byWho,
  };
}

// ================================================================ (a) the hostility table
export async function teamsTable() {
  console.log('\n=== teams-table: who is hostile to whom (teams.ts HOSTILE) — the design\'s table, every pair both ways round ===');
  const { isHostile, TEAMS, HOSTILE } = teamsMod;
  // The FIFTH side is 'civilian' since the civilians merged (d7c3289, teams.ts's own head comment: "hostile to NOBODY and nobody hostile to them … the row is
  // here so a held / downed civilian's Guard record has a side to name"). The sixteen pairs of the four fighting sides are exactly as designed before them; the
  // nine civilian pairs are all neutral — a probe written for four sides read the fifth as a regression, which it is not.
  const want: Record<string, boolean> = {
    'guard→player': true, 'player→guard': true, 'operative→hostile': true, 'hostile→operative': true, 'hostile→player': true, 'player→hostile': true,
    'operative→player': false, 'player→operative': false, 'guard→hostile': false, 'hostile→guard': false, 'guard→operative': false, 'operative→guard': false,
    'guard→guard': false, 'operative→operative': false, 'hostile→hostile': false, 'player→player': false,
    'civilian→guard': false, 'civilian→operative': false, 'civilian→hostile': false, 'civilian→player': false, 'civilian→civilian': false,
    'guard→civilian': false, 'operative→civilian': false, 'hostile→civilian': false, 'player→civilian': false,
  };
  let allPass = true; const rows: string[] = [];
  for (const a of TEAMS) { rows.push(`${a.padEnd(9)} → ` + TEAMS.map((b: string) => `${b} ${isHostile(a, b) ? 'HOSTILE' : '·      '}`).join('  ')); for (const b of TEAMS) { const k = `${a}→${b}`; if (isHostile(a, b) !== want[k]) { allPass = false; console.log(`    ✗ ${k}: ${isHostile(a, b)}, want ${want[k]}`); } } }
  for (const r of rows) console.log('    ' + r);
  allPass = verdict(allPass, 'the table', `${Object.keys(want).length} ordered pairs as designed: staff ↔ Sam hostile (the game as it was), operative ↔ hostile both ways, hostiles would shoot Sam and he them, operatives are Sam's friends, staff and the showcase's sides never meet (neutral), civilians are nobody's enemy and have none, nobody is his own enemy`) && allPass;
  const civRow = TEAMS.every((t: string) => !isHostile('civilian', t) && !isHostile(t, 'civilian'));
  allPass = verdict(civRow, 'the civilian row and column are neutral through and through (nobody acquires, lines up on or is shot at by a cleaner)', TEAMS.map((t: string) => `civilian↔${t} ${isHostile('civilian', t) || isHostile(t, 'civilian') ? 'HOSTILE' : 'neutral'}`).join(' · ')) && allPass;
  allPass = verdict(Object.keys(HOSTILE).length === 5 && TEAMS.length === 5 && TEAMS.join(',') === 'guard,operative,hostile,player,civilian', 'five sides, no more (the four that fight + the civilians)', TEAMS.join(', ')) && allPass;
  console.log(`=== teams-table: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (b) two on two up the cubicles' north aisle
/** One aisle fight off `seed`: the three staff parked, Sam shut in the conference room dark, two operatives at the west end of the cubicles' north aisle and two
 *  hostiles nine metres east of them, everybody facing the other side, half a second for poses and meters to settle, engage() (fair: no surprise), then run to
 *  the engagement's own end (40 s cap). Everything the verdicts need comes back. */
async function aisleFight(seed: number, opts: { surprise?: number } = {}) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (civilians scream and run under gunfire: this family's frozen numbers predate them — switched off like the other identity probes)
  game.aiEnabled = true; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  parkStaff(game); game.teleportPlayer([8.0, 0, 7.0]); game.player.visibility = 0.02;   // Sam in the conference room behind its shut door, dark: no part of it
  W.step(DT); W.step(DT);
  const lines = tapSay(game); const shots = shotCounter(game);
  const guards0 = game.guards.length, esc0 = game.escalation;
  const ops = [spawnUnit(game, { team: 'operative', pos: [14.2, 0, 13.35], yaw: Math.PI / 2, name: 'Archer' }), spawnUnit(game, { team: 'operative', pos: [14.0, 0, 12.65], yaw: Math.PI / 2, name: 'Bishop' })];
  const hos = [spawnUnit(game, { team: 'hostile', pos: [23.2, 0, 13.35], yaw: -Math.PI / 2, name: 'Vasquez' }), spawnUnit(game, { team: 'hostile', pos: [23.4, 0, 12.7], yaw: -Math.PI / 2, name: 'Drake' })];
  for (let i = 0; i < 30; i++) W.step(DT);   // posed, and half a second for the meters to settle (eased at Sam's rate from nought)
  const all = [...ops, ...hos];
  const kit = all.map((u: any) => `${u.callsign} ${u.team} ${u.weapon.def.id} rig ${guardsMod.rigOf(u)} longGun ${u.char.anim.longGun} vis ${f2(u.visibility)}`);
  const kitOk = ops.every((u: any) => u.weapon.def.id === 'fn2000' && guardsMod.rigOf(u) === 'sc20k' && u.char.anim.longGun) && hos.every((u: any) => u.weapon.def.id === 'aks74u' && guardsMod.rigOf(u) === 'carbine' && u.char.anim.longGun);
  const los = ops.map((a: any) => hos.map((b: any) => !game.col.segmentBlocked(eyeOf(a.char), chestOf(b.char)) || !game.col.segmentBlocked(eyeOf(a.char), eyeOf(b.char))));
  const stagingOk = los.flat().every(Boolean) && all.every((u: any) => u.visibility > 0.3) && all.every((u: any) => u.state === 'patrol' && u.awareness < 0.3);   // (calm on their marks until the word: nobody has jumped the gun)
  const staging = `LOS ${JSON.stringify(los)}; ${all.map((u: any) => `${u.callsign} vis ${f2(u.visibility)} ${u.state} aw ${f2(u.awareness)}`).join(', ')}; ${f1(v3.distXZ(ops[0].char.pos, hos[0].char.pos))} m apart`;
  const E = engage(game, ops, hos, { timeout: 40, surprise: opts.surprise ?? 0 });
  const foes0 = all.map((u: any) => `${u.callsign}→${u.foe === 'player' ? 'Sam' : u.foe ? u.foe.callsign : '—'}`).join(' ');
  const engagedOk = all.every((u: any) => u.state === 'alert' && u.foe && u.foe !== 'player' && u.foe.team !== u.team && !u.hold && !u.script);
  let sameSide = 0, sameSideWho = ''; let firstKillT = -1; let staffMoved = false; const staffPos = game.guards.filter((x: any) => !x.unit).map((x: any) => v3.copy(x.char.pos));
  const roundsAt6: Record<string, number> = {};
  for (let f = 0; f < 60 * 41 && !(E.done && f > 60 * 6); f++) {
    W.step(DT); shots.pump();
    for (const u of all) if (u.foe && u.foe !== 'player' && u.foe.team === u.team) { sameSide++; sameSideWho = `${u.callsign}→${u.foe.callsign}`; }
    if (firstKillT < 0 && all.some((u: any) => u.state === 'dead')) firstKillT = game.time - E.t0;
    game.guards.filter((x: any) => !x.unit).forEach((x: any, i: number) => { if (v3.distXZ(x.char.pos, staffPos[i]) > 0.05 || x.state !== 'patrol') staffMoved = true; });
    if (f === 60 * 6 - 1) Object.assign(roundsAt6, shots.byTeam);
  }
  const after = all.map((u: any) => `${u.callsign}:${u.state}`).join(' ');
  return { game, W, ops, hos, E, lines, shots, kit, kitOk, stagingOk, staging, foes0, engagedOk, sameSide, sameSideWho, firstKillT, staffMoved, roundsAt6, guards0, esc0, after };
}
export async function teamsFight() {
  console.log('\n=== teams-fight: two operatives (FN2000) v two hostiles (AKS-74U), 9 m apart up the cubicles\' north aisle, lit, in sight, engage() with no surprise either way — three seeds: a kill inside 6 s every time, rounds from BOTH sides across them (an open aisle is a coin flip on who fires first, and first mostly wins), nobody\'s foe is ever his own side, the parked staff say / radio / escalate nothing, every engagement resolves with a record ===');
  let allPass = true; const agg: Record<string, number> = {}; const outcomes: string[] = [];
  for (const seed of [611, 612, 613]) {
    const R = await aisleFight(seed);
    const { game, E } = R;
    console.log(`  --- seed ${seed} ---`);
    allPass = verdict(R.kitOk, 'spawned as ordered (FN2000s rigged as the bullpup, AKS-74Us as the carbine, long guns armed)', R.kit.join(' · ')) && allPass;
    allPass = verdict(R.stagingOk, 'staging: every operative has a line of sight to every hostile, all four stand lit (meter > 0.3) and calm on their marks', R.staging) && allPass;
    allPass = verdict(R.engagedOk, 'engage(): all four alert, off their marks, each on an ENEMY', R.foes0) && allPass;
    allPass = verdict(R.firstKillT >= 0 && R.firstKillT <= 6, 'inside six seconds somebody is dead', R.firstKillT >= 0 ? `first man down at +${f2(R.firstKillT)} s` : 'nobody died in 6 s') && allPass;
    allPass = verdict(!R.roundsAt6.player && !R.roundsAt6.guard && ((R.roundsAt6.operative ?? 0) + (R.roundsAt6.hostile ?? 0)) > 0, 'the rounds in those six seconds are the units\' — none from Sam or the staff', `${JSON.stringify(R.roundsAt6)} · by man ${JSON.stringify(R.shots.byWho)}`) && allPass;
    for (const [k, n] of Object.entries(R.shots.byTeam)) agg[k] = (agg[k] ?? 0) + (n as number);
    allPass = verdict(R.sameSide === 0, 'nobody ever had a man of his own side as his foe', R.sameSide ? `${R.sameSide} guard-frames, e.g. ${R.sameSideWho}` : `0 frames over ${f1(game.time - E.t0)} s`) && allPass;
    const staffLines = R.lines.filter((l: any) => l.team === 'guard');
    allPass = verdict(staffLines.length === 0 && game.escalation === R.esc0 && !game.alarm.episode && guardsMod.rollcallState(game).stage === 'idle' && !R.staffMoved, 'the parked staff: not a word, not a radio call, no alarm episode, no lockdown, nobody moved', `staff lines ${staffLines.length}${staffLines.length ? ` (${staffLines.slice(0, 3).map((l: any) => `${l.who}: ${l.text}`).join(' | ')})` : ''}; escalation ${game.escalation}; episode ${game.alarm.episode}; radio check ${guardsMod.rollcallState(game).stage}; moved ${R.staffMoved}`) && allPass;
    allPass = verdict(E.done && !!E.result && ['cleared', 'wiped', 'timeout'].includes(E.result.outcome), 'the engagement resolves with a record', E.result ? `${E.result.outcome.toUpperCase()} after ${f1(E.result.secs)} s · kills ${E.result.kills.map((k: any) => `${k.victim}(${k.team}) by ${k.by} +${f1(k.t)}s`).join(', ') || 'none'} · rounds ${JSON.stringify(E.result.rounds)} · left ${E.result.operativesLeft} op / ${E.result.hostilesLeft} ho · then ${R.after}` : 'not done') && allPass;
    if (E.result) outcomes.push(`${seed}:${E.result.outcome}`);
    const winners = (E.result?.outcome === 'cleared' ? R.ops : E.result?.outcome === 'wiped' ? R.hos : []).filter((u: any) => u.state !== 'dead');
    if (winners.length) allPass = verdict(winners.every((u: any) => u.state !== 'alert' && u.state !== 'search'), 'the side left standing comes off the alert when the last enemy drops (no search dealt round a room just won)', winners.map((u: any) => `${u.callsign}:${u.state} aw ${f2(u.awareness)}`).join(' ')) && allPass;
    const unitLines = R.lines.filter((l: any) => l.team !== 'guard');
    console.log(`    (the units said: ${unitLines.slice(0, 10).map((l: any) => `${l.who} "${l.text}"`).join(' | ')}${unitLines.length > 10 ? ' …' : ''})`);
    if (VERBOSE) for (const u of [...R.ops, ...R.hos]) console.log(`    ${u.callsign} (${u.team}): ${u.state}${u.state === 'dead' ? ` killer #${u.killerId}` : ''} at ${f1(u.char.pos[0])},${f1(u.char.pos[2])} · rounds ready ${u.weapon.roundsReady} · sup ${f2(u.sup.v)}`);
    allPass = verdict(game.guards.length === R.guards0 + 4, 'all four still in the guards list (bodies stay until despawned)', `${game.guards.length} guards`) && allPass;
  }
  allPass = verdict((agg.operative ?? 0) > 0 && (agg.hostile ?? 0) > 0, 'across the seeds rounds went BOTH ways (shot events by the side of `who`)', `${JSON.stringify(agg)} · outcomes ${outcomes.join(' ')}`) && allPass;
  // and the stage's knob: the room caught flat (surprise 1.0 s) is the operatives' to win
  { const R = await aisleFight(611, { surprise: 1.0 }); allPass = verdict(R.E.result?.outcome === 'cleared' && R.E.result.operativesLeft === 2, 'engage(…, { surprise: 1 }): the same aisle with the room a second slow — cleared, both operatives standing', R.E.result ? `${R.E.result.outcome} in ${f1(R.E.result.secs)} s, kills ${R.E.result.kills.map((k: any) => `${k.victim} by ${k.by} +${f1(k.t)}s`).join(', ')}, rounds ${JSON.stringify(R.E.result.rounds)}` : 'not done') && allPass; }
  console.log(`=== teams-fight: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) an operative never takes Sam; a hostile does
export async function teamsPlayer() {
  console.log('\n=== teams-player: a lit Sam two metres in front of an ALERT operative for 5 s — never his foe, never a round; a hostile stood in the same place has him inside a second and fires ===');
  Math.random = seeded(612);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.aiEnabled = true; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  parkStaff(game);
  game.teleportPlayer([21.5, 0, 11.3]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; W.step(DT); W.step(DT); pl.visibility = 0.9;
  const shots = shotCounter(game);
  let allPass = true;
  // the operative: alert (as engage would leave him after a fight), nobody acquired, Sam lit at 2 m dead ahead
  const op = spawnUnit(game, { team: 'operative', pos: [19.5, 0, 11.3], yaw: Math.PI / 2, name: 'Archer' });
  op.hold = false; op.state = 'alert'; op.awareness = 1; op.reactT = 0; op.fireCd = 0.2; W.step(DT);
  let everFoe = false, hits = 0, sawSam = false, visibleFrames = 0;
  for (let f = 0; f < 60 * 5; f++) { pl.visibility = 0.9; W.step(DT); shots.pump(); if (op.foe) everFoe = true; if (op.sawPlayerThisFrame || op.sawFoeThisFrame) sawSam = true; if (canSeeChar(game, op, pl.char, true).visible) visibleFrames++; if (pl.hitFlash > 0.9) hits++; pl.hitFlash = 0; }
  allPass = verdict(!everFoe && !sawSam && (shots.byTeam.operative ?? 0) === 0 && hits === 0, 'operative: Sam in plain sight (the sight test itself says visible), yet never a foe, never "seen", not one round, Sam untouched', `visible to the sight test on ${visibleFrames} of 300 frames · foe ever ${everFoe} · saw ${sawSam} · operative rounds ${shots.byTeam.operative ?? 0} · hits ${hits} · his state at the end ${op.state}`) && allPass;
  allPass = verdict(visibleFrames >= 60, 'staging: the operative COULD see him for at least a second of it (so the verdict above is the table, not a wall or his back)', `dist ${f1(v3.distXZ(op.char.pos, pl.char.pos))} m, Sam vis ${f2(pl.visibility)}, ${visibleFrames} frames`) && allPass;
  despawnUnit(game, op); W.step(DT);
  // the hostile in the same place, calm on his mark (patrol, held): his eyes do the rest
  const ho = spawnUnit(game, { team: 'hostile', pos: [19.5, 0, 11.3], yaw: Math.PI / 2, name: 'Vasquez' });
  W.step(DT);
  let acquiredAt = -1, alertAt = -1, firedAt = -1; const t0 = game.time; const before = shots.byTeam.hostile ?? 0;
  for (let f = 0; f < 60 * 5; f++) {
    pl.visibility = 0.9; W.step(DT); shots.pump();
    if (acquiredAt < 0 && ho.foe === 'player' && ho.sawFoeThisFrame) acquiredAt = game.time - t0;
    if (alertAt < 0 && ho.state === 'alert') alertAt = game.time - t0;
    if (firedAt < 0 && (shots.byTeam.hostile ?? 0) > before) firedAt = game.time - t0;
    pl.hitFlash = 0;
  }
  allPass = verdict(acquiredAt >= 0 && acquiredAt <= 1.0 && alertAt >= 0 && alertAt <= 1.5, 'hostile: eyes on Sam inside a second, CONTACT inside a second and a half', `saw him +${f2(acquiredAt)} s, alert +${f2(alertAt)} s`) && allPass;
  allPass = verdict(firedAt >= 0, 'hostile: and he fires on him', firedAt >= 0 ? `first burst +${f2(firedAt)} s (${shots.byTeam.hostile} rounds in 5 s)` : 'no round in 5 s') && allPass;
  despawnUnits(game);
  console.log(`=== teams-player: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (d) line of sight and light gate acquisition exactly as they gate a guard's sight of Sam
export async function teamsDark() {
  console.log('\n=== teams-dark: an alert operative and a hostile 8 m off in his cone — (1) a wall between: never acquired, until the hostile fires and is placed by ear; (2) in the open with the room\'s lights out: not acquired in 5 s; lights on: acquired by sight inside 2 s ===');
  Math.random = seeded(613);
  const W = await standUp(); const { game } = W;
  game.aiEnabled = true; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  parkStaff(game); game.teleportPlayer([37.0, 0, 26.0]); game.player.visibility = 0; W.step(DT); W.step(DT);   // Sam out on the lot's far corner: no part of it
  let allPass = true;
  // ---- (1) the wall: operative in the corridor facing west, hostile in the server room beyond the corridor's north wall
  {
    const op = spawnUnit(game, { team: 'operative', pos: [22.0, 0, 11.3], yaw: -Math.PI / 2, name: 'Archer', light: false });
    const ho = spawnUnit(game, { team: 'hostile', pos: [16.5, 0, 7.5], yaw: Math.PI / 2, name: 'Vasquez', light: false });
    op.hold = false; op.pinned = true; op.state = 'alert'; op.awareness = 1; op.reactT = 0; op.lastKnown = null;   // alert with nothing, planted (pinned: he covers, he does not wander off to search)
    ho.heardUpTo = 1e12; ho.dazzledUntil = 1e9;   // the hostile is a prop here: deaf and blind, he stands
    W.step(DT); W.step(DT);
    const wall = game.col.segmentBlocked(eyeOf(op.char), chestOf(ho.char)) && game.col.segmentBlocked(eyeOf(op.char), eyeOf(ho.char));
    let everFoe = false;
    for (let f = 0; f < 60 * 3; f++) { W.step(DT); if (op.foe) everFoe = true; }
    allPass = verdict(wall && !everFoe && !op.lastKnown, '(1) a wall between them: three seconds, never acquired, no fix', `wall ${wall} · foe ever ${everFoe} · fix ${op.lastKnown ? 'set' : 'none'} · hostile lit ${f2(ho.visibility)}`) && allPass;
    // the hostile fires one round into the wall in front of him: the operative hears an ENEMY's report and places it
    fireWeapon(game, ho.char, [19.0, 1.2, 7.5], false, { spread: 0, steady: true });
    for (let f = 0; f < 30; f++) W.step(DT);
    const fix = op.lastKnown; const dFix = fix ? v3.distXZ(fix, ho.char.pos) : Infinity;
    allPass = verdict(!!fix && dFix < 4.5 && op.witness.heard.shots >= 1 && !op.foe, '(1) he fires: heard as a threat — a fix within a few metres of him (placed by ear through the doorway), still no foe (nothing seen)', `fix ${fix ? `(${f1(fix[0])}, ${f1(fix[2])})` : 'none'} ${f1(dFix)} m off him · shots heard ${op.witness.heard.shots} · foe ${op.foe ? 'set' : 'none'}`) && allPass;
    despawnUnits(game); W.step(DT);
  }
  // ---- (2) the light: both in the cubicles' north aisle, 8 m apart, in the open; the floor's lights out, then on
  {
    for (const grp of ['cubicles', 'monitors', 'lobby', 'corridor', 'breakroom']) game.setGroup(grp, false);
    W.step(DT);
    const op = spawnUnit(game, { team: 'operative', pos: [14.2, 0, 13.35], yaw: Math.PI / 2, name: 'Bishop', light: false });   // (his own weapon light off: it would light the man he is looking at — true, and the point of a torch, but not this probe's question)
    const ho = spawnUnit(game, { team: 'hostile', pos: [22.2, 0, 13.35], yaw: -Math.PI / 2, name: 'Drake', light: false });
    op.hold = false; op.pinned = true; op.state = 'alert'; op.awareness = 1; op.reactT = 0; op.lastKnown = null;
    ho.heardUpTo = 1e12; ho.dazzledUntil = 1e9;
    W.step(DT); W.step(DT);
    const los = !game.col.segmentBlocked(eyeOf(op.char), chestOf(ho.char)) || !game.col.segmentBlocked(eyeOf(op.char), eyeOf(ho.char));
    const inCone = canSeeChar(game, op, ho.char, false);
    const Edark = lightEstimateAt(game, chestOf(ho.char));
    let everFoe = false; let visMax = 0;
    for (let f = 0; f < 60 * 5; f++) { W.step(DT); if (op.foe) everFoe = true; visMax = Math.max(visMax, ho.visibility); }
    allPass = verdict(los && inCone.visible && !everFoe, '(2) lights out: in the open, in his cone, line of sight clear — five seconds and never acquired (the meter reads him dark)', `LOS ${los} · canSee ${inCone.visible} at ${f1(inCone.dist)} m · E at his chest ${Edark.toFixed(3)} W/m² → vis peak ${f2(visMax)} (floor ${game.tune.visFloor}) · foe ever ${everFoe}`) && allPass;
    for (const grp of ['cubicles', 'monitors', 'lobby', 'corridor', 'breakroom']) game.setGroup(grp, true);
    let acquiredAt = -1; const t0 = game.time; let Elit = 0;
    for (let f = 0; f < 60 * 3; f++) { W.step(DT); if (f === 30) Elit = ho.irradiance; if (acquiredAt < 0 && op.foe === ho && op.sawFoeThisFrame) acquiredAt = game.time - t0; }
    allPass = verdict(acquiredAt >= 0 && acquiredAt <= 2.0, '(2) lights on: acquired by sight inside two seconds', `+${f2(acquiredAt)} s · E at his chest lit ${Elit.toFixed(2)} W/m² → vis ${f2(ho.visibility)}`) && allPass;
    despawnUnits(game);
  }
  console.log(`=== teams-dark: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (e) despawn cleans up; the tour runs clean in the same process after
export async function teamsDespawn() {
  console.log('\n=== teams-despawn: spawn four, fight a little, despawn — guards / steady lights / ids / meter keys back as they were, the budget errors say what they mean, and the showcase tour run straight after in-process finishes by itself with Sam never hit ===');
  Math.random = seeded(614);
  const W = await standUp(); const { game, input, cam } = W;
  game.aiEnabled = true; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  let allPass = true;
  const steady = () => game.engine.lights.lights.filter((l: any) => l.ttl < 0).length;
  const ids = () => game.guards.map((x: any) => x.char.id).join(',');
  const g0 = game.guards.length, L0 = steady(), ids0 = ids();
  parkStaff(game); game.teleportPlayer([37.0, 0, 26.0]); W.step(DT);
  const ops = [spawnUnit(game, { team: 'operative', pos: [14.2, 0, 13.35], yaw: Math.PI / 2 }), spawnUnit(game, { team: 'operative', pos: [14.0, 0, 12.65], yaw: Math.PI / 2 })];
  const hos = [spawnUnit(game, { team: 'hostile', pos: [23.2, 0, 13.35], yaw: -Math.PI / 2 }), spawnUnit(game, { team: 'hostile', pos: [23.4, 0, 12.7], yaw: -Math.PI / 2 })];
  allPass = verdict(game.guards.length === g0 + 4 && steady() === L0 + 4 && units(game).length === 4 && new Set(game.guards.map((x: any) => x.char.id)).size === game.guards.length, 'spawned: +4 guards, +4 steady lights, four distinct fresh ids', `guards ${g0} → ${game.guards.length} · steady lights ${L0} → ${steady()} · ids ${ids()}`) && allPass;
  // the character budget: Sam + 3 staff + 4 units = 8 — a ninth must be refused, and say why
  let err = ''; try { spawnUnit(game, { team: 'hostile', pos: [20, 0, 18] }); } catch (e: any) { err = String(e?.message ?? e); }
  allPass = verdict(/budget/.test(err) && game.guards.length === g0 + 4, 'a ninth character is refused with the budget named, nothing half-spawned', err ? `"${err.slice(0, 110)}…"` : 'no error thrown') && allPass;
  let errP = ''; try { spawnUnit(game, { team: 'player', pos: [20, 0, 18] }); } catch (e: any) { errP = String(e?.message ?? e); }
  allPass = verdict(/Sam alone/.test(errP), "the 'player' side cannot be spawned", errP ? `"${errP.slice(0, 80)}…"` : 'no error thrown') && allPass;
  { const was = game.tune.teams; game.tune.teams = false; let errT = ''; try { spawnUnit(game, { team: 'hostile', pos: [20, 0, 18] }); } catch (e: any) { errT = String(e?.message ?? e); } game.tune.teams = was;
    allPass = verdict(/switched off/.test(errT) && was === true, 'the kill switch: tune.teams is on by default, and off it refuses any spawn', errT ? `default ${was} · "${errT.slice(0, 70)}…"` : 'no error thrown') && allPass; }
  const E = engage(game, ops, hos, { timeout: 20 });
  for (let f = 0; f < 60 * 4; f++) W.step(DT);
  const dead = [...ops, ...hos].filter((u: any) => u.state === 'dead').length;
  game.spectate = game.guards.indexOf(hos[1]);   // the camera on a unit: despawn must not leave it dangling
  despawnUnits(game);
  const dangling = game.guards.some((o: any) => (o.foe && o.foe !== 'player' && !game.guards.includes(o.foe)) || (o.standoff && !game.guards.includes(o.standoff.pair)));
  allPass = verdict(game.guards.length === g0 && steady() === L0 && ids() === ids0 && units(game).length === 0 && game.spectate === -1 && !dangling, 'despawned: guards, steady lights and ids exactly as before, camera back on Sam, no reference left behind', `guards ${game.guards.length} · steady lights ${steady()} · ids ${ids()} · spectate ${game.spectate} · (${dead} of them had died in the 4 s)`) && allPass;
  for (let f = 0; f < 10; f++) W.step(DT);
  allPass = verdict(E.done && E.result?.outcome !== undefined, 'the engagement running on them ended (reset / decided) rather than hanging', E.result ? `${E.result.outcome} after ${f1(E.result.secs)} s` : 'still open') && allPass;
  const keysLeft = [...game.probe.results.keys()].filter((k: string) => k.startsWith('unit'));
  allPass = verdict(keysLeft.length === 0, 'no meter answers kept under unit keys', keysLeft.join(',') || 'none') && allPass;
  // ids do not leak: a fresh spawn starts again at the bottom of the unit range
  const again = spawnUnit(game, { team: 'hostile', pos: [23.2, 0, 13.35] }); const idAgain = again.char.id; despawnUnit(game, again);
  allPass = verdict(idAgain === 20, 'ids come back: the next spawn is #20 again', `#${idAgain}`) && allPass;
  // resetGuards under living units: they go, the staff come back fresh
  spawnUnit(game, { team: 'operative', pos: [14.2, 0, 13.35] }); spawnUnit(game, { team: 'hostile', pos: [23.2, 0, 13.35] }); W.step(DT);
  game.restartEncounter(); W.step(DT);
  allPass = verdict(game.guards.length === g0 && steady() === L0 && units(game).length === 0 && game.guards.every((x: any) => x.team === 'guard' && x.foe === 'player' && x.state === 'patrol'), 'restartEncounter with units standing: units gone, staff fresh on their routes on Sam', `guards ${game.guards.length} · steady lights ${steady()} · ${game.guards.map((x: any) => `${x.callsign}:${x.team}/${x.state}`).join(' ')}`) && allPass;
  // ---- the showcase tour, in this same process and Game, straight after: constructed as main.ts does, run to its own end
  const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
  const demo = new Demo(game, cam, W.smoke, input);
  let exc: string | null = null, hits = 0, prevHit = 0, lastPlayer: any = null, frames = 0, finished = false, nan = '';
  demo.onStop = (fin: boolean) => { finished = fin; };
  try {
    demo.start();
    for (frames = 0; frames < 60 * 240 && demo.active; frames++) {
      if (game.player !== lastPlayer) { lastPlayer = game.player; game.player.visibility = 0.05; prevHit = game.player.hitFlash; }
      const p = demo.update(DT); W.step(DT, p);
      const hf = game.player.hitFlash; if (hf > prevHit + 1e-9) hits++; prevHit = hf;
      if (!nan) { const pp = game.player.char.pos; if (![pp[0], pp[2], cam.yaw, cam.distance].every(Number.isFinite)) nan = `NaN at frame ${frames}`; for (const gd of game.guards) if (!Number.isFinite(gd.char.pos[0]) || !Number.isFinite(gd.awareness)) nan = `guard NaN at frame ${frames}`; }
    }
  } catch (e: any) { exc = String(e?.stack ?? e).split('\n').slice(0, 3).join(' ⏎ '); }
  allPass = verdict(!exc && finished && !demo.active && hits === 0 && !nan && units(game).length === 0 && game.guards.length === g0, 'the tour after: ran all its stops to the hand-over by itself, no exception, nothing NaN, Sam never hit, no unit anywhere', `${exc ? `EXCEPTION ${exc}` : `${frames} frames (${f1(frames / 60)} s sim)`} · finished ${finished} · hits ${hits} · ${nan || 'finite'} · guards ${game.guards.length}`) && allPass;
  console.log(`=== teams-despawn: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
