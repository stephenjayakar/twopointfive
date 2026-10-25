// 'tapstep' — TAP TO STEP (src/game/tapstep.ts TAPSTEP; fed by player.ts). The maintainer: "i love the tap to step idea! curious how we can make this feel awesome. and
// also generalize between creeping on a guy to grab him vs slithering through guards".
//   bun run tools/qa/tapstep-check.ts        (also `probes.ts tapstep`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   tap       a press of a few frames, crouched: he goes `tapM` and stops dead, one footfall, at the quiet level, nothing after it.
//   hold      the key kept down: `reachM` steps with a dead stop between them, one footfall each, and every one quiet: a held key cannot scuff.
//   legs      each step moves the walk cycle on by half a turn and it stands still between steps, on a stride with both feet down.
//   rush      a second press inside the settling: the step comes at once and its footfall is well over the quiet level; mashing covers more ground than holding.
//   beat      a tap just after he settles goes `beatM`.
//   mask      a plant just after a near man's footfall is `mask` of the level.
//   land      a tap toward a man's back from a metre and a bit out carries on to the spot behind him, and the grab's key takes him from there.
//   walker    the key held behind a man walking: the gap closes.
//   crouch    standing, the keys walk as they did; Shift crouched is the quick crouch walk, no steps.
//   harness   down on the frozen stand and in the plain page, up in the lab and with ?tapstep=1, down in the lab with ?tapstep=0; rides a recording's tables, and a
//             recording from before the key replays with it down.
// TAPSTEP_BREAK=1 = the key left down where tap, hold, legs, rush and land ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no hand on a key: nobody has felt the rhythm.
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const { TAPSTEP, TAPSTEP_STATS, tapHears } = await import(`${ROOT}/src/game/tapstep.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.TAPSTEP_BREAK === '1', DT = 1 / 60, AT = [10.2, 0, 19.5], EAST = Math.PI / 2;   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const f2 = (x: number) => x.toFixed(2);
/** the lobby's floor, Sam crouched with empty hands, the men parked; with `gap` one rifleman that far along the D key's way with his back to Sam (walking on, with `walks`) */
async function world(on: boolean, gap = 0, walks = false) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = STALK.key = STALK.low = true; STALK.drag = false; STALK.orbit = false; stalkPolish(true); TAPSTEP.on = on;
  g.godMode = true; g.aiEnabled = !!walks; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([...AT]); g.player.crouch = true;
  const { right } = W.cam.planarBasis(), yaw = Math.atan2(right[0], right[2]);
  const at = (d: number) => [AT[0] + right[0] * d, 0, AT[2] + right[2] * d];
  const place = (d: number) => { A.char.pos = at(d); A.char.bodyYaw = A.char.aimYaw = yaw; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.awareness = 0; A.heardUpTo = 1e12; if (!walks) { A.hold = true; A.pinned = true; } };
  if (gap) { place(gap); if (walks) { A.route = { name: 'on', points: [at(gap), at(gap + 12)], wait: [0, 900] }; A.wp = 1; A.wait = 0; A.state = 'patrol'; } } else place(30);
  const c = g.player.char, keep = () => { TAPSTEP.on = on; STALK.drag = false; STALK.orbit = false; g.player.visibility = 0.02; };
  const seen = new Set(g.events);
  /** `n` frames with `keys` down: the footfalls filed (frame, level) and a line of where he was */
  const go = (n: number, keys: string[] = []) => { const steps: { i: number; level: number }[] = [], path: { x: number; ph: number; v: number }[] = []; W.input.keys.clear(); for (const k of keys) W.input.keys.add(k);
    for (let i = 0; i < n; i++) { keep(); if (!walks) A.char.vel = [0, 0, 0]; W.step(DT); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'step' && e.who === undefined) steps.push({ i, level: e.level }); }
      path.push({ x: (c.pos[0] - AT[0]) * right[0] + (c.pos[2] - AT[2]) * right[2], ph: c.anim.phase, v: Math.hypot(c.vel[0], c.vel[2]) }); }
    W.input.keys.clear(); return { steps, path }; };
  const along = () => (c.pos[0] - AT[0]) * right[0] + (c.pos[2] - AT[2]) * right[2], gapNow = () => Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]);
  go(40); TAPSTEP_STATS.steps = TAPSTEP_STATS.scuffs = TAPSTEP_STATS.beats = TAPSTEP_STATS.masked = TAPSTEP_STATS.lands = 0;
  return { W, g, A, c, go, along, gapNow };
}
const up = () => !BREAK, D = ['KeyD'];
async function tap() {
  console.log('\n=== tap: a press of a few frames ===');
  const C = await world(up()), x0 = C.along(); const a = C.go(5, D), b = C.go(60), f = [...a.steps, ...b.steps], went = C.along() - x0, end = b.path[b.path.length - 1].v, tail = Math.abs(b.path[59].x - b.path[45].x);
  verdict(Math.abs(went - TAPSTEP.tapM) < 0.06 && f.length === 1 && end < 0.01 && tail < 0.002, `a tap goes ${TAPSTEP.tapM} m, stops dead, and files one footfall`, `went ${f2(went)} m · ${f.length} footfalls at ${f.map(s => f2(s.level))} · speed after ${f2(end)}`);
  return f[0]?.level ?? 0;
}
async function hold() {
  console.log('\n=== hold: the key kept down ===');
  const C = await world(up()), x0 = C.along(), r = C.go(300, D), went = C.along() - x0, stops = r.path.filter((p: any, i: number) => p.v < 0.01 && i > 0 && r.path[i - 1].v >= 0.01).length;
  const levels = r.steps.map(s => s.level), most = Math.max(0, ...levels), least = Math.min(9, ...levels), each = went / Math.max(1, r.steps.length), rate = went / 5;
  verdict(r.steps.length >= 5 && stops >= r.steps.length - 1 && !TAPSTEP_STATS.scuffs && Math.abs(each - TAPSTEP.reachM) < 0.1, 'the key held: steps of the reach with a dead stop between each, one footfall each, no scuff',
    `${r.steps.length} footfalls · ${stops} stops · ${f2(each)} m each · ${f2(rate)} m/s · ${TAPSTEP_STATS.scuffs} scuffs · levels ${f2(least)} to ${f2(most)} by the floor`);
  // legs
  const ph = r.path, plants: number[] = []; for (let i = 1; i < ph.length - 9; i++) if (ph[i].v < 0.01 && ph[i - 1].v >= 0.01) plants.push(i);
  const gap = (i: number) => (ph[plants[i + 1] + 9].ph - ph[plants[i] + 9].ph + 1) % 1;   // (settled: the legs finish a little after the plant)
  const turns = plants.slice(0, -1).map((_, i) => gap(i)), wrong = turns.filter(d => Math.abs(d - 0.5) > 0.02).length;
  verdict(turns.length >= 3 && !wrong, 'each step moves the cycle on by half a turn, plant to plant', `${turns.length} steps · half turns ${turns.slice(0, 5).map(f2).join(' ')}`);
  return { most, rate };
}
async function rush(heldRate: number, safe: number) {
  console.log('\n=== rush: pressed again inside the settling ===');
  const C = await world(up()), x0 = C.along(); let loudest = 0, n = 0;
  for (let k = 0; k < 14; k++) { const a = C.go(1, D); let f = a.steps; let frames = 1; while (!f.length && frames < 90) { const b = C.go(1, D); f = b.steps; frames++; } for (const s of f) { loudest = Math.max(loudest, s.level); n++; } C.go(2); }
  verdict(loudest > safe * 2 && n >= 12, 'a press made as he lands comes at once and is well over the quiet level', `${n} footfalls · the loudest ${f2(loudest)} against ${f2(safe)} · ${TAPSTEP_STATS.scuffs} scuffs · ${f2(C.along() - x0)} m`);
}
async function beat() {
  console.log('\n=== beat: a tap just after he settles ===');
  const C = await world(up()); C.go(4, D); C.go(60); const x1 = C.along(); C.go(4, D); C.go(60); const late = C.along() - x1;   // (a second after a tap: past the beat)
  C.go(4, D); for (let w = 0; w < 90 && !C.go(1).steps.length; w++); C.go(Math.round((TAPSTEP.settle + 0.05) / DT)); const x2 = C.along(); C.go(4, D); C.go(60); const onBeat = C.along() - x2;
  verdict(Math.abs(onBeat - TAPSTEP.beatM) < 0.07 && Math.abs(late - TAPSTEP.tapM) < 0.06, `a tap on the beat goes ${TAPSTEP.beatM} m, one past it ${TAPSTEP.tapM} m`, `on the beat ${f2(onBeat)} m · late ${f2(late)} m`);
}
async function mask(safe: number) {
  console.log('\n=== mask: a plant just after a near man\'s footfall ===');
  const C = await world(up(), 4); let f: any[] = []; C.go(1, D); for (let i = 0; i < 90 && !f.length; i++) { tapHears(C.g, C.A.char.pos); f = C.go(1, D).steps; }
  verdict(f.length === 1 && Math.abs(f[0].level - safe * TAPSTEP.mask) < 0.01, `its level is ${TAPSTEP.mask} of a quiet step's`, `${f.map(s => f2(s.level))} against ${f2(safe)} · ${TAPSTEP_STATS.masked} under a step`);
}
async function land() {
  console.log('\n=== land: a tap toward a man\'s back ===');
  const C = await world(up(), 2.0); const g0 = C.gapNow(); C.go(5, D); C.go(70); const gap = C.gapNow(), man = C.A, took = TAPSTEP_STATS.lands;
  C.g.selectVerb('guard', 'grab'); C.W.input.pressed.add('Space'); let held = false; for (let i = 0; i < 60 && !held; i++) { C.W.step(DT); held = C.g.player.holding?.g === man; }
  verdict(Math.abs(gap - STALK.keyM) < 0.08 && took === 1 && (BREAK || held), `from ${f2(g0)} m one tap lands ${STALK.keyM} m behind him and the key takes him`, `gap ${f2(gap)} m · ${took} landed · in his arm ${held}`);
}
async function walker() {
  console.log('\n=== walker: the key held behind a man walking ===');
  const C = await world(up(), 3.5, true), g0 = C.gapNow(); C.go(240, D); const g1 = C.gapNow();
  verdict(g1 < g0 - 0.5, 'the gap closes at the safe pace', `gap ${f2(g0)} m to ${f2(g1)} m over 4 s · he at ${f2(Math.hypot(C.A.char.vel[0], C.A.char.vel[2]))} m/s`);
}
async function others() {
  console.log('\n=== crouch: only a crouch\'s plain keys are steps ===');
  const C = await world(true); C.g.player.crouch = false; C.go(20); const a = C.go(60, D), v = a.path[59].v, stops = a.path.filter((p: any, i: number) => i > 20 && p.v < 0.01).length;
  C.g.player.crouch = true; C.go(40); const b = C.go(60, [...D, 'ShiftLeft']), vb = b.path[59].v, stopsB = b.path.filter((p: any, i: number) => i > 20 && p.v < 0.01).length;
  verdict(v > 1.2 && !stops && vb > 2 && !stopsB, 'standing he walks, and Shift crouched is the quick crouch walk', `walk ${f2(v)} m/s · Shift ${f2(vb)} m/s · stops ${stops} ${stopsB}`);
}
async function harness() {
  console.log('\n=== harness: the lab and ?tapstep=1 have it, the page and the frozen stand do not ===');
  const shipped = process.env.TPS_PROFILE === 'shipped'; TAPSTEP.on = shipped ? found : true;
  const W: any = await quiet(() => standUp()), stood = TAPSTEP.on;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = !!snap.tables.TAPSTEP;
  TAPSTEP.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); TAPSTEP.on = false; JR.applyKnobs(W.game, snapUp); const kept = TAPSTEP.on;
  delete snap.tables.TAPSTEP; TAPSTEP.on = true; JR.applyKnobs(W.game, snap); const old = TAPSTEP.on;
  const read = (q: string) => { TAPSTEP.on = !TAPSTEP.on; PR.pageSwitches(new URLSearchParams(q)); return TAPSTEP.on; };
  const plainQ = read(''), lab = read('sneaklab'), labOff = read('sneaklab&tapstep=0'), asked = read('tapstep=1');
  verdict(stood === false && !found && (STAND_ENV as string[]).includes('TPS_TAPSTEP') && had && kept === true && old === false && !plainQ && lab && !labOff && asked, 'down as the harness stands up and in the plain page, up in the lab and with ?tapstep=1; it rides a recording, and one from before the key has it down',
    `stood ${stood} · plain ${plainQ} · lab ${lab} · lab off ${labOff} · asked ${asked} · rides ${kept} · old ${old}`);
}
export async function tapstepCheck(): Promise<boolean> {
  const hold0 = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }, table = { ...TAPSTEP }; allPass = true; found = TAPSTEP.on;
  try { const safe = await tap(), H = await hold(); await rush(H.rate, H.most || safe); await beat(); await mask(safe); await land(); await walker(); if (!BREAK) await others(); Object.assign(STALK, stalk); await harness(); }
  finally { Object.assign(HOLD, hold0); Object.assign(CLOSE, close); Object.assign(STALK, stalk); Object.assign(TAPSTEP, table); }
  console.log(`\n=== tapstep: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await tapstepCheck()) ? 0 : 1);
