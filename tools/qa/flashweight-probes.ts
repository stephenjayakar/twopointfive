// The 'flashweight' family: A FLASHBANG THAT COUNTS ON A DOOR, AND A TEAM THAT MOVES WITH WEIGHT (the maintainer, 10-05, off the merged build: "it feels like
// flashbangs are too weak. using them for breaching doesn't seem to help" and "teammate movement is too fast. in ready or not they did a good job of making
// everyone feel weighty. they should probably never really sprint"). Run through probes.ts:
//   bun run tools/qa/probes.ts flashweight | flashweight-pace | flashweight-flash | flashweight-night | flashweight-fog | flashweight-lights | flashweight-corners | flashweight-entry | flashweight-feel
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each row's own level; nothing is drawn). THE SCENARIOS are scene/scenarioList.ts
// SCENARIOS, row by row, each started as a click on its row starts it (bang-tally.ts stage()).
//   flashweight-pace    in each scenario: the team told to fall in behind a Sam who SPRINTS a lap of the floor near the start, then sent to stack on the nearest
//                       held room's door and through it. Every frame, every living teammate: the speed his legs are asked for never passes guards.ts PACE.max
//                       (and so never reaches the animator's sprint band, character.ts BLEND.jogAt), it never rises faster than PACE.accel, and the ground he
//                       actually covers in any quarter second agrees. Not vacuous: somebody must have moved at better than a stroll. The line also says what the
//                       same script does with PACE off and the order paces as they were (the red path: it must show the old run).
//   flashweight-flash   the canister's rule in a room fight (combat.ts FLASH), on a held room of every scenario: a can let off inside the open door —
//                       every defender the fireball has a line to is blind for FLASH.secs and doubled over for FLASH.stagger of it, none of them fires a
//                       round while folded; the team stood outside in plain view of it, past FLASH.ownM, is untouched; the same can behind the SHUT door
//                       touches nobody inside. And FLASH.on false is the dazzle as it was (the team outside is blinded by Sam's own can: the old rule).
//   flashweight-night   the night game's stun canister is as it was: no scenario up, a guard with a line to it is dazzled by effects.ts bang's numbers and
//                       never folded.
//   flashweight-entry   what it buys: bang-tally.ts over every held room's every door in every scenario, a few seeds, 'open and clear' against 'bang and
//                       clear' from the same staging — per scenario the bang must lose a smaller share of the team AND take at least as many rooms.
//                       (FLASHWEIGHT_SEEDS=1-6 widens it; the default is 1-3, ~10 minutes on four cores.)
//   flashweight-lights  LIGHT DISCIPLINE ("friendlies also need to have flashlight discipline"), every scenario, the floor emptied of hostiles first so nothing
//                       but the orders decides: the team falls in, stacks on a held room's door, is sent through it, and is called back. Dark while following,
//                       dark on the stack, every man's light ON as he crosses the frame and while the room is being looked over, dark again within a few
//                       seconds of 'holding the room' (but for a man the entry left on another door of the room — DOORTOOLS.otherDoorM: a door is held lit), dark following Sam out. LIGHTS.on false must show the old picture (lit long after the entry). A light the rule owes is not owed in a LIT PLACE
//                       (LIGHTS.litOff: judged by the rule's own reading of the place); none may burn on in one, and with that rule off nothing is spared.
//   flashweight-corners CHECK THE CORNERS ("teammates clearing rooms seem to miss enemies. they need to check their corners"), every scenario: into an emptied
//                       held room, every man's muzzle is on the near corner of his own side inside DOORTOOLS.cornerCap of crossing, and the entry does not
//                       end until the room's floor has been looked over (fewer than DOORTOOLS.deadCells cells no muzzle was ever on). Then the count that
//                       matters, from bang-tally.ts: entries the team walked out of with men of the room still standing in it ('missed'), the search on
//                       against off, same seeds — on must miss fewer, and lose no more of the team.
//   flashweight-feel    the Tab panel's 'Team feel' rows (game/teamfeel.ts) under a stand-in localStorage: only what differs from the build is stored, a fresh
//                       Game reads it back, a bad stored value is passed over, the reset drops it. Also in the 'ui' family.
// The family's own red path: FLASHWEIGHT_BREAK=1 bun run tools/qa/probes.ts flashweight-pace must FAIL (the pace rule switched off under the probe).
import { standUp, ROOT } from './headless.ts';
import { stage, setKnobs } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const ORM: any = await import(`${ROOT}/src/game/orders.ts`);
const CHM: any = await import(`${ROOT}/src/game/character.ts`);
const FXM: any = await import(`${ROOT}/src/game/effects.ts`);
const FWM: any = await import(`${ROOT}/src/game/fogofwar.ts`);
const FOG_DEFAULTS = JSON.parse(JSON.stringify(FWM.FOG));

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const DTM: any = await import(`${ROOT}/src/game/doortools.ts`);
const DEFAULTS = { PACE: clone(GDM.PACE), FLASH: clone(CBM.FLASH), ORD: clone(ORM.ORDERS), LIGHTS: clone(GDM.LIGHTS), DT: clone(DTM.DOORTOOLS) };
// (bang-tally.ts stage() puts every knob table back to the build's own before each staging: an override goes through its setKnobs)
const reset = () => { setKnobs({}); Object.assign(GDM.PACE, clone(DEFAULTS.PACE)); Object.assign(CBM.FLASH, clone(DEFAULTS.FLASH)); Object.assign(ORM.ORDERS, clone(DEFAULTS.ORD)); Object.assign(GDM.LIGHTS, clone(DEFAULTS.LIGHTS)); Object.assign(DTM.DOORTOOLS, clone(DEFAULTS.DT)); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => x.toFixed(2);

/** the door of a held room nearest the team, with the geometry outside it */
function nearestEntry(S: any) {
  const g = S.g, sam = g.player.char.pos; let best: any = null;
  for (const d of S.defs) for (const e of d.room.entries) { const dist = flat(sam, e.at); if (!best || dist < best.dist) best = { ent: e, room: d.room, dist }; }
  return best as { ent: any; room: any; dist: number } | null;
}

// ---------------------------------------------------------------- pace
interface PaceRun { asked: number; rise: number; covered: number; men: number; moved: boolean }
/** the script: fall in behind a sprinting Sam, then stack on the nearest held room's door, then through it */
async function paceRun(scn: string): Promise<PaceRun> {
  const S: any = await quiet(() => stage(scn, 1)); const { g, step } = S; const O = g.orders, nav = g.col.nav;
  // This is the check of the CAP (guards.ts PACE) — what a teammate's legs do with teampace.ts off, and the floor that rule stands on. With it on the team
  // walks under the cap and runs for a reason (with a sprinting Sam, from a grenade, to cover): that is teampace-check.ts's, and it is held off here.
  (await import(`${ROOT}/src/game/teampace.ts`)).TEAMPACE.on = false;
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead');
  const out: PaceRun = { asked: 0, rise: 0, covered: 0, men: team.length, moved: false };
  const was = new Map<any, number>(team.map(x => [x, x.speed])); const trail = new Map<any, number[][]>(team.map(x => [x, []]));
  const WIN = 15;   // a quarter second of frames
  const watch = () => { for (const x of team) { if (x.state === 'dead') continue;
    out.asked = Math.max(out.asked, x.speed); out.rise = Math.max(out.rise, (x.speed - was.get(x)!) / DT); was.set(x, x.speed);
    const tr = trail.get(x)!; tr.push([x.char.pos[0], 0, x.char.pos[2]]); if (tr.length > WIN) { const a = tr[tr.length - 1 - WIN]; let L = 0; for (let i = tr.length - WIN; i < tr.length; i++) L += flat(tr[i], tr[i - 1]); if (flat(a, tr[tr.length - 1]) < 1.5) out.covered = Math.max(out.covered, L / (WIN * DT)); tr.shift(); }   // (a jump of a metre and a half inside the window is a stager's teleport, not a pace)
    if (x.speed > 1.6) out.moved = true; } };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { step(); watch(); } };
  // Sam sprints: out along the walkable floor to the far end of a path and back, the team falling in behind him
  const sam = g.player.char.pos; const start: number[] = [sam[0], 0, sam[2]];
  await quiet(() => O.give('fallIn', O.targetAt(start), 'all'));
  let goal: number[] | null = null, bestL = 0;
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; for (const r of [14, 10, 7]) { const p = [start[0] + Math.sin(a) * r, 0, start[2] + Math.cos(a) * r]; if (nav.isBlocked(p[0], p[2])) continue; const path = nav.findPath(start, p, 4000); if (!path?.length) continue; let L = 0, prev = start; for (const q of path) { L += flat(q, prev); prev = q; } if (L > bestL && L < 30) { bestL = L; goal = p; } } }
  if (goal) {
    const path: number[][] = [start, ...nav.findPath(start, goal, 4000)!]; const lap = [...path, ...[...path].reverse().slice(1)];
    let i = 1; const at = [...start]; const SPRINT = g.tune.playerSprint ?? 4.7;
    for (let f = 0; f < 60 * 14 && i < lap.length; f++) { let left = SPRINT * DT;
      while (left > 0 && i < lap.length) { const d = flat(at, lap[i]); if (d <= left) { at[0] = lap[i][0]; at[2] = lap[i][2]; left -= d; i++; } else { at[0] += (lap[i][0] - at[0]) / d * left; at[2] += (lap[i][2] - at[2]) / d * left; left = 0; } }
      g.player.char.pos[0] = at[0]; g.player.char.pos[2] = at[2]; tick(); }
  }
  tick(90);
  // onto the nearest held room's door, and through it
  const E = nearestEntry(S);
  if (E) { const fc = E.ent.door.frameCentre;
    await quiet(() => O.give('stack', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 25; f++) { tick(); if (team.every(x => x.state === 'dead' || O.of(x)?.arrived)) break; }
    await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); tick(60 * 10); }
  return out;
}
export const flashweightPace = guarded(async () => {
  const F = family('flashweight-pace: the team never runs — every scenario, behind a sprinting Sam, onto a door and through it');
  const P = clone(DEFAULTS.PACE), jogAt = CHM.BLEND.jogAt;
  if (process.env.FLASHWEIGHT_BREAK) { setKnobs({ PACE: { on: false }, ORDERS: { run: 4.7, brisk: 3.4, briskIn: 2.2, onto: 1.7, entry: 3.4 } }); console.log('  (FLASHWEIGHT_BREAK: the pace rule is OFF under this probe — it must fail)'); }
  F.verdict(P.max < jogAt && ORM.ORDERS.run <= P.max && ORM.ORDERS.brisk <= P.max && ORM.ORDERS.entry <= P.max, 'the knobs: no pace the team is asked for reaches the sprint band',
    `PACE.max ${P.max} m/s, accel ${P.accel} m/s² · orders: fall in ≤ ${ORM.ORDERS.run}, a leg to a mark ${ORM.ORDERS.brisk} then ${ORM.ORDERS.onto} onto it, an entry ${ORM.ORDERS.entry} · the animator's sprint clip starts past ${jogAt} m/s (the walk carries to ${CHM.BLEND.walkTop})`);
  for (const E of SCENARIOS as any[]) {
    const r = await paceRun(E.id);
    const ok = r.men > 0 && r.moved && r.asked <= P.max + 1e-6 && r.rise <= P.accel + 1e-3 && r.covered <= P.max + 0.35;
    F.verdict(ok, `${E.title}: ${r.men} teammates`, `fastest asked of anybody's legs ${f2(r.asked)} m/s (cap ${P.max}) · fastest pick-up ${f2(r.rise)} m/s² (cap ${P.accel}) · most ground covered in any quarter second ${f2(r.covered)} m/s${r.moved ? '' : ' · NOBODY MOVED at better than a stroll: nothing was measured'}`);
  }
  // the red path, as a number: the same script with the rule off and the order paces as they were must show the old run
  if (!process.env.FLASHWEIGHT_BREAK) {
    setKnobs({ PACE: { on: false }, ORDERS: { run: 4.7, brisk: 3.4, briskIn: 2.2, onto: 1.7, entry: 3.4 } });
    const E = (SCENARIOS as any[])[0]; const r = await paceRun(E.id); reset();
    F.verdict(r.asked > jogAt + 0.3, `the probe sees a run when there is one (${E.title}, PACE off, the order paces as they were)`, `fastest asked ${f2(r.asked)} m/s — past the sprint band's ${jogAt}`);
  }
  return F.done();
});

// ---------------------------------------------------------------- the canister's rule
/** a held room's door opened by hand, the team stood outside in view of the opening (3 to 5 m back), a can let off `inM` inside (negative: outside, the door SHUT) */
async function flashRun(scn: string, opts: { shut?: boolean } = {}) {
  const S: any = await quiet(() => stage(scn, 1)); const { g, step } = S; const O = g.orders, nav = g.col.nav;
  const E = nearestEntry(S); if (!E) return null;
  const ent = E.ent, d = ent.door, ox = ent.out[0], oz = ent.out[1];
  const outPt = (back: number, lat: number): number[] => [ent.at[0] + ox * back - oz * lat, 0, ent.at[2] + oz * back + ox * lat];
  const men: any[] = S.defs.filter((x: any) => x.room === E.room).map((x: any) => x.gd);
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead');
  const others = g.guards.filter((x: any) => x.team === 'hostile' && !men.includes(x) && x.state !== 'dead'); for (const x of others) await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
  // the team outside, square to the opening so the can inside is in plain view of each
  const spots: number[][] = []; for (const back of [3.4, 4.2, 5.0, 5.8]) for (const lat of [0, 0.5, -0.5]) { const p = outPt(back, lat); if (!nav.isBlocked(p[0], p[2]) && !spots.some(s => flat(s, p) < 0.7)) spots.push(p); }
  team.forEach((gd, i) => { const p = spots[i % Math.max(1, spots.length)] ?? outPt(4, 0); gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
  await quiet(() => g.teleportPlayer(outPt(6.5, 0) as any)); await quiet(() => O.give('hold', O.targetAt(outPt(6.5, 0)), 'all'));
  step(5);
  if (!opts.shut) { const s = -g.doors.side(d, outPt(0.6, 0)); d.latched = false; d.closing = false; d.vel = s * 5.5; d.quietT = -3600; d.lastWho = g.player.char.id; if (d.locked && !d.lockBroken) d.lockBroken = true; step(24); }
  let land: number[] = outPt(opts.shut ? 1.0 : -1.2, 0); if (!opts.shut) for (const b of [1.8, 1.5, 1.2, 0.9]) { const p = outPt(-b, 0); if (!nav.isBlocked(p[0], p[2])) { land = p; break; } }
  const seen = new Set<any>(g.events); let bangT = NaN, bangAt: number[] | null = null;
  await quiet(() => CBM.dropThrowable(g, 'flash', land as any));
  for (let i = 0; i < 120 && isNaN(bangT); i++) { step(); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'bang') { bangT = e.time; bangAt = e.pos; } } }
  if (isNaN(bangT) || !bangAt) return null;
  const B = FXM.bang, from = [bangAt[0], bangAt[1] + 0.3, bangAt[2]];
  const head = (x: any) => x.char.bones.head ?? [x.char.pos[0], 1.65, x.char.pos[2]];
  const row = (x: any) => ({ gd: x, d: Math.hypot(head(x)[0] - bangAt![0], head(x)[1] - bangAt![1], head(x)[2] - bangAt![2]), line: !g.col.segmentBlocked(from as any, head(x)), blind: x.dazzledUntil - bangT, folded: x.staggerUntil - bangT });
  const inside = men.filter(x => x.state !== 'dead').map(row), ours = team.filter(x => x.state !== 'dead').map(row);
  // rounds from the room's men while each is folded
  let foldedRounds = 0; const until = new Map<any, number>(inside.map(r => [r.gd.char.id, r.gd.staggerUntil]));
  for (let i = 0; i < 60 * 4; i++) { step(); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'guardShot' && until.has(e.who) && e.time < until.get(e.who)!) foldedRounds++; } }
  return { g, B, inside, ours, foldedRounds, bangT, door: d.def.name };
}
export const flashweightFlash = guarded(async () => {
  const F = family('flashweight-flash: the canister in a room fight — blind AND folded, its own side spared, walls and shut doors as ever');
  const K = CBM.FLASH; let reached = 0, lined = 0;
  for (const E of SCENARIOS as any[]) {
    const r = await flashRun(E.id); if (!r) { F.verdict(false, `${E.title}`, 'no held room with a door, or the can never went off'); continue; }
    const inR = r.inside.filter(x => x.d <= r.B.dazzleRadius), withLine = inR.filter(x => x.line); lined += withLine.length; reached += inR.filter(x => x.blind > 0).length;
    const lo = Math.min(...K.secs) - 0.05, hi = Math.max(...K.secs) + 0.05;
    const blindOk = withLine.every(x => x.blind >= lo && x.blind <= hi && x.folded >= Math.min(...K.stagger) - 0.05 && x.folded <= Math.max(...K.stagger) + 0.05);
    const oursFar = r.ours.filter(x => x.d > K.ownM), oursOk = oursFar.every(x => x.blind <= 0 && x.folded <= 0);
    F.verdict(blindOk && oursOk && r.foldedRounds === 0, `${E.title} · ${r.door}: ${inR.length} of the room's men inside the radius, ${withLine.length} with a line to it`,
      `with a line: ${withLine.map(x => `${x.gd.callsign} ${f2(x.d)} m blind ${f2(x.blind)} s folded ${f2(x.folded)} s`).join(', ') || '—'}${inR.filter(x => !x.line).length ? ` · without one: ${inR.filter(x => !x.line).map(x => `${x.gd.callsign} ${x.blind > 0 ? `the bang alone, ${f2(x.blind)} s` : 'untouched (walled off)'}`).join(', ')}` : ''} · rounds fired by a folded man ${r.foldedRounds} · the team outside (${oursFar.length} past ${K.ownM} m, in view of it): ${oursFar.filter(x => x.blind > 0).length} blinded`);
  }
  F.verdict(lined > 0 && reached > 0, 'not vacuous: defenders were reached', `${lined} defenders had a line to the can across the seven scenarios, ${reached} were blinded`);
  { const E = (SCENARIOS as any[])[0]; const r = await flashRun(E.id, { shut: true });
    F.verdict(!!r && r.inside.every(x => x.blind <= 0 && x.folded <= 0), `${E.title}: the same can outside the SHUT door`, r ? `the room's men: ${r.inside.map(x => `${x.gd.callsign} ${x.blind > 0 ? `BLIND ${f2(x.blind)} s` : 'untouched'}`).join(', ')}` : 'the can never went off'); }
  { setKnobs({ FLASH: { on: false } }); const E = (SCENARIOS as any[])[0]; const r = await flashRun(E.id); reset();
    const far = r ? r.ours.filter(x => x.d > DEFAULTS.FLASH.ownM && x.d < r.B.dazzleRadius && x.line) : [];
    F.verdict(!!r && r.inside.filter(x => x.line).every(x => x.folded <= 0 && x.blind > 0 && x.blind <= r.B.dazzleSeconds + 0.05) && (!far.length || far.every(x => x.blind > 0)), `${E.title}: FLASH.on false is the dazzle as it was`,
      r ? `the room's men with a line: ${r.inside.filter(x => x.line).map(x => `${x.gd.callsign} blind ${f2(x.blind)} s, folded ${x.folded > 0 ? f2(x.folded) : 'no'}`).join(', ') || '—'} · the team in view of Sam's own can: ${far.filter(x => x.blind > 0).length} of ${far.length} blinded (the old rule)` : 'the can never went off'); }
  return F.done();
});

export const flashweightNight = guarded(async () => {
  const F = family('flashweight-night: the night game\'s stun canister is as it was');
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game; g.godMode = true; g.playerInvisible = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } }; step(10);
  const gd = g.guards.find((x: any) => x.state !== 'dead'); const p = gd.char.pos; const nav = g.col.nav;
  let land: number[] | null = null; for (const r of [2.5, 2, 3]) for (let k = 0; k < 8 && !land; k++) { const q = [p[0] + Math.sin(k * Math.PI / 4) * r, 0, p[2] + Math.cos(k * Math.PI / 4) * r]; if (!nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([q[0], 0.6, q[2]] as any, [p[0], 1.65, p[2]] as any)) land = q; }
  if (!land) { F.verdict(false, 'a spot for the can', 'no free floor in view of the first guard'); return F.done(); }
  const seen = new Set<any>(g.events); let bangT = NaN, at: number[] | null = null;
  await quiet(() => CBM.dropThrowable(g, 'flash', land as any));
  for (let i = 0; i < 120 && isNaN(bangT); i++) { step(); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'bang') { bangT = e.time; at = e.pos; } } }
  const B = FXM.bang, h = gd.char.bones.head ?? [p[0], 1.65, p[2]], d = at ? Math.hypot(h[0] - at[0], h[1] - at[1], h[2] - at[2]) : NaN;
  const want = B.dazzleSeconds + (B.dazzleMin - B.dazzleSeconds) * Math.min(1, d / B.dazzleRadius), got = gd.dazzledUntil - bangT;
  F.verdict(!isNaN(bangT) && Math.abs(got - want) < 0.25 && !(gd.staggerUntil > bangT), `${gd.callsign ?? 'the first guard'}, ${f2(d)} m from it, no scenario up`, `dazzled ${f2(got)} s (effects.ts bang's own fall-off says ${f2(want)}) · folded: ${gd.staggerUntil > bangT ? 'YES' : 'no'}`);
  return F.done();
});

// ---------------------------------------------------------------- the fog of war: a door opened unseen, an enemy's laser where nobody looks
/** the fog's own rule written again here: can any of the team's eyes see this point (statics and leaves as they stand; glass passes) */
const eyeSees = (g: any, p: number[]) => g.fogOfWar.eyes.some((e: any) => !g.col.segmentBlocked(e.pos, p));
const leafPts = (d: any, ang: number): number[][] => { const a = d.def.closedDir + ang, [hx, hz] = d.def.hinge, W = d.def.width; const out: number[][] = []; for (const f of [0.95, 0.6, 0.25]) for (const y of [1.0, 1.8]) out.push([hx + Math.cos(a) * W * f, y, hz + Math.sin(a) * W * f]); return out; };
const leafSeen = (g: any, d: any, ang: number) => leafPts(d, ang).some(p => g.fogOfWar.eyes.some((e: any) => { const L = Math.hypot(p[0] - e.pos[0], p[1] - e.pos[1], p[2] - e.pos[2]); if (L < 0.3) return true; const k = 1 - 0.12 / L; return !g.col.segmentBlocked(e.pos, [e.pos[0] + (p[0] - e.pos[0]) * k, e.pos[1] + (p[1] - e.pos[1]) * k, e.pos[2] + (p[2] - e.pos[2]) * k]); }));
const doorBoxOf = (g: any, d: any) => g.dynBoxes.find((b: any) => b.name === d.box.name);

export const flashweightFog = guarded(async () => {
  const F = family('flashweight-fog: a door that opens where the team cannot see, and an enemy\'s laser where nobody looks, are not in the picture');
  let fogged = 0;
  for (const E of SCENARIOS as any[]) {
    reset(); Object.assign(FWM.FOG, clone(FOG_DEFAULTS));
    const S: any = await quiet(() => stage(E.id, 1)); const { g, step } = S; const FW = g.fogOfWar;
    g.aiEnabled = false; step(3);   // (everybody stands where the staging put him: the picture's rule is what is asked, not the fight)
    if (!FW.on) {
      const d = g.doors.list[0]; d.latched = false; d.quietT = -3600; d.angle = 1.2; d.place(); step(2);
      F.verdict(doorBoxOf(g, d) === d.box && FW.doorsHeld === 0, `${E.title}: no fog of war in this one — every leaf is drawn where it stands`, `${d.def.name} opened by hand: the picture's leaf is the door's own box`);
      continue;
    }
    fogged++;
    // ---- a door: one of a held room's, shut, that no eye has a line to shut or open
    const doors: any[] = []; for (const x of S.defs) for (const e of x.room.entries) if (!doors.includes(e.door)) doors.push(e.door);
    for (const x of g.doors.list) if (!doors.includes(x)) doors.push(x);
    step(2);
    const swing = (d: any) => { const a = Math.abs(d.maxA) > 1.0 ? 1.2 : -1.2; return Math.max(d.minA, Math.min(d.maxA, a)); };
    const d = doors.find(x => Math.abs(x.angle) < 0.01 && !leafSeen(g, x, 0) && !leafSeen(g, x, swing(x)));
    if (!d) { F.verdict(false, `${E.title}: a shut door nobody on the team can see`, 'none on this floor from the staging'); continue; }
    const open = swing(d), shutPose = d.poseAt(0);
    d.latched = false; d.closing = false; d.vel = 0; d.quietT = -3600; d.angle = open; d.place(); step(2);
    const b1 = doorBoxOf(g, d), held1 = FW.doorHeld(d), asShut = !!b1 && b1 !== d.box && Math.abs(b1.yaw - shutPose.yaw) < 1e-6 && flat(b1.c, shutPose.c) < 1e-6;
    FWM.FOG.doors = false; step(2); const live = doorBoxOf(g, d) === d.box; FWM.FOG.doors = true;   // (the knob off forgets what was seen: back on, the picture starts from the floor as it stands)
    d.angle = 0; d.place(); step(2); d.angle = open; d.place(); step(2); const again = doorBoxOf(g, d) !== d.box && FW.doorHeld(d);
    // Sam walks to where he can see it: the leaf comes up to date; he leaves, it shuts unseen: the picture keeps it open
    const home = [...g.player.char.pos]; const ent = S.defs.flatMap((x: any) => x.room.entries).find((e: any) => e.door === d);
    const fc = d.frameCentre, n = ent ? ent.out : [Math.cos(d.def.closedDir + Math.PI / 2), Math.sin(d.def.closedDir + Math.PI / 2)];
    let stood: number[] | null = null;
    for (const sgn of [1, -1]) for (const back of [2.0, 1.5, 2.8, 1.1]) for (const lat of [0, 0.5, -0.5]) { if (stood) break; const p = [fc[0] + n[0] * back * sgn - n[1] * lat, 0, fc[2] + n[1] * back * sgn + n[0] * lat]; if (g.col.nav.isBlocked(p[0], p[2])) continue; await quiet(() => g.teleportPlayer(p as any)); step(2); if (FW.doorHeld(d)) continue; stood = p; }
    const seenNow = !!stood && doorBoxOf(g, d) === d.box;
    await quiet(() => g.teleportPlayer(home as any)); step(2);
    const farAgain = !leafSeen(g, d, d.angle) && !leafSeen(g, d, 0);
    d.angle = 0; d.place(); step(2);
    const b2 = doorBoxOf(g, d), openPose = d.poseAt(open), keptOpen = !!b2 && b2 !== d.box && Math.abs(b2.yaw - openPose.yaw) < 1e-6;
    F.verdict(held1 && asShut && live && again && seenNow && (!farAgain || keptOpen), `${E.title}: ${d.def.name}, opened where no eye of the team has a line to it`,
      `drawn still shut: ${asShut ? 'yes' : 'NO'} (the picture's leaf at the shut pose, not the door's own box) · FOG.doors off draws it live: ${live ? 'yes' : 'NO'} · Sam ${stood ? `stood at (${f2(stood[0])}, ${f2(stood[2])}) with a line to it` : 'found no place to see it from'}: drawn as it stands ${seenNow ? 'yes' : 'NO'} · he leaves and it shuts unseen: ${farAgain ? (keptOpen ? 'drawn still open' : 'NOT kept') : 'still in view from the staging — not asked'}`);
    d.angle = 0; d.place(); d.quietT = 10; d.latched = true; step(3);
    // ---- a laser: a defender Sam sees through his room's door, his beam turned eight ways
    let done = false;
    for (const x of S.defs) {
      if (done) break; const gd = x.gd; if (gd.state === 'dead') continue;
      for (const e of x.room.entries) {
        if (done) break; const dd = e.door, o = e.out;
        const sw = swing(dd); dd.latched = false; dd.closing = false; dd.vel = 0; dd.quietT = -3600; dd.angle = sw; dd.place();
        let at: number[] | null = null;
        for (const back of [1.6, 2.4, 1.0, 3.2]) for (const lat of [0, 0.6, -0.6, 1.2, -1.2]) { if (at) break; const p = [e.at[0] + o[0] * back - o[1] * lat, 0, e.at[2] + o[1] * back + o[0] * lat]; if (g.col.nav.isBlocked(p[0], p[2])) continue; await quiet(() => g.teleportPlayer(p as any)); step(2); if (FW.seen(gd)) at = p; }
        if (!at) { dd.angle = 0; dd.place(); dd.quietT = 10; dd.latched = true; step(1); continue; }
        const c = gd.char, chest = c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]]; let full = 0, drawn = 0, wrong = 0, samples = 0, clipped = 0, dots = 0, dotsWrong = 0;
        for (let k = 0; k < 8; k++) {
          const dir = [Math.sin(k * Math.PI / 4), 0, Math.cos(k * Math.PI / 4)]; c.gunDir = dir; c.muzzle = [chest[0] + dir[0] * 0.5, chest[1], chest[2] + dir[2] * 0.5];
          CBM.LASER.enemy = true;   // (the fog's cut of an enemy's beam is measured with the enemies' lasers on, as before combat.ts LASER — off, there is nothing to cut: laser-probes.ts)
          FWM.FOG.lasers = false; const all: any[] = []; CBM.laserBoxes(g, gd, all); FWM.FOG.lasers = true; const cut: any[] = []; CBM.laserBoxes(g, gd, cut);
          const len = (l: any[]) => l.filter(b => b.h[2] > 0.02).reduce((a, b) => a + 2 * b.h[2], 0);
          const La = len(all), Lc = len(cut); full += La; drawn += Lc; if (Lc < La - 0.3) clipped++;
          for (const b of cut) { if (b.h[2] <= 0.02) { dots++; if (!eyeSees(g, [b.c[0] - dir[0] * 0.05, b.c[1], b.c[2] - dir[2] * 0.05])) dotsWrong++; continue; } for (let t = -b.h[2] + 0.05; t <= b.h[2] - 0.05; t += 0.1) { samples++; if (!eyeSees(g, [b.c[0] + dir[0] * t, b.c[1], b.c[2] + dir[2] * t])) wrong++; } }
        }
        // out of sight again: inside the linger he is still drawn, and his beam is not
        await quiet(() => g.teleportPlayer(home as any)); dd.angle = 0; dd.place(); dd.quietT = 10; dd.latched = true; step(2);
        const lingering = FW.drawn(gd) && !FW.seen(gd); const none: any[] = []; CBM.laserBoxes(g, gd, none); CBM.LASER.enemy = false;
        F.verdict(samples > 0 && wrong <= samples * 0.05 && dotsWrong === 0 && clipped > 0 && (!lingering || none.length === 0), `${E.title}: ${gd.callsign}, seen through ${dd.def.name}, his laser turned eight ways`,
          `${f2(drawn)} m of beam drawn of ${f2(full)} m (cut in ${clipped} of 8 directions) · of the drawn beam, ${wrong} of ${samples} points are where no eye has a line (≤ 5 % allowed: a jamb's width) · ${dots} dot${dots === 1 ? '' : 's'} drawn, ${dotsWrong} out of sight · Sam gone, ${lingering ? `he lingers in the picture and ${none.length ? 'his beam is STILL DRAWN' : 'his beam is not drawn'}` : 'he is out of the picture at once'}`);
        done = true;
      }
    }
    if (!done) F.verdict(false, `${E.title}: a defender to see through his door`, 'none could be put in Sam\'s sight');
  }
  F.verdict(fogged >= 3, 'the scenarios with the fog of war on were asked', `${fogged} of ${(SCENARIOS as any[]).length}`);
  Object.assign(FWM.FOG, clone(FOG_DEFAULTS));
  return F.done();
});

// ---------------------------------------------------------------- lights, corners
/** a scenario with every hostile taken off the floor, the team told to fall in, stacked on the nearest held room's door and sent through it: per phase,
 *  what the weapon lights did and where the muzzles went */
async function emptyEntry(scn: string) {
  const S: any = await quiet(() => stage(scn, 1)); const { g, step } = S; const O = g.orders, D = g.doorTools;
  if (!nearestEntry(S)) return null;
  const cands: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!cands.some(c => c.ent === e)) cands.push({ ent: e, dist: flat(g.player.char.pos, e.at) });
  cands.sort((a, b) => a.dist - b.dist);
  for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead') await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'); const lit = () => team.filter(x => x.flashlight?.enabled).length;
  // (LIGHTS.litOff: a light the rule owes is not owed where the place itself is lit. The rule's own last reading says so (placeLitSeen) AND the probe's own
  //  reading of the floor under him agrees (`feet`: the place's lights alone, to within the half second the rule's reading may be old) — a rule that called
  //  a dark place lit is a dark light here. `spared` counts the man-frames that spared a light, `litInLit` the ones a light burned on in a lit place past the
  //  rule's tail, `burnDark` the ones a light burned where the probe's own reading of his feet is dark: the rule on, lights still burn in the dark)
  //  (… read as the best of the spot and a short step to each side of it: one point, taken in a frame, lands inside the swung leaf or a jamb and reads 0.00 on
  //  floor that is lit — a man who goes through a door behind another, not beside him, crosses nearer the middle of the frame, where that happened)
  const feetAt = (px: number, pz: number) => g.visibilityOf(GDM.lightEstimateAt(g, [px, 1.2, pz], () => true));
  const feet = (x: any) => { const [px, , pz] = x.char.pos; return Math.max(feetAt(px, pz), feetAt(px + 0.3, pz), feetAt(px - 0.3, pz), feetAt(px, pz + 0.3), feetAt(px, pz - 0.3)); };
  const litOk = (x: any) => !!x.flashlight?.enabled || (GDM.placeLitSeen(g, x) && feet(x) >= GDM.LIGHTS.litAt * 0.8); let spared = 0, litInLit = 0, burnDark = 0; const run = new Map<any, number>();
  const watch = () => { for (const x of team) { const on = !!x.flashlight?.enabled, pl = GDM.placeLitSeen(g, x); if (!on && pl) spared++; if (on && feet(x) < GDM.LIGHTS.litAt) burnDark++; const r = on && pl ? (run.get(x) ?? 0) + 1 : 0; run.set(x, r); if (r > 60 * GDM.LIGHTS.tail + 3) litInLit++; } };
  const sam = g.player.char.pos;
  step(60 * 6);   // (the hand-off's own noise is out of everybody's ears)
  await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all'));
  const close = () => team.every(x => flat(x.char.pos, sam) <= GDM.LIGHTS.aloneM);   // (a man coming back to Sam from further off than that is walking alone: lit, by the rule)
  const inFile = (secs: number) => { let n = 0, run = 0; for (let f = 0; f < 60 * secs; f++) { step(); run = close() ? run + 1 : 0; if (run >= 90) n = Math.max(n, lit()); if (run >= 240) break; } return n; };   // (lit men once the whole file has been close behind Sam for a second and a half, watched for two and a half more)
  const follow = inFile(30);
  // the nearest held room's door the team can be sent through (a door behind one locked against Sam is refused: the next)
  let walk = 0, walkDark = 0, stacked = 0, why: string | void = 'no door', E: any = null;
  for (const c of cands) { const fc = c.ent.door.frameCentre;
    if (await quiet(() => O.give('stack', O.targetAt(fc), 'all'))) continue;
    for (let f = 0; f < 60 * 30; f++) { step(); for (const x of team) { const A = O.of(x); if (!A?.post || flat(x.char.pos, A.post) < GDM.LIGHTS.onM + 0.4) continue; walk++; if (!litOk(x)) walkDark++; } watch(); if (team.every(x => O.of(x)?.arrived)) break; }
    for (let f = 0; f < 180; f++) { step(); if (f >= 60) stacked = Math.max(stacked, lit()); }
    why = await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); E = c; if (!why) break; }
  if (!E) return null;
  // the entry: who crossed with his light on, when each man's muzzle first came onto his near corner, how long the room took, what was left unseen
  // (DOORTOOLS.otherDoorM: a man of the entry with a line to another door of the room holds THAT door from where he stands, and a door is held lit by a man
  //  with no goggles (thrDoorsLit) for as long as he holds it — he is judged as a door holder: lit, or in a lit place. 'All dark' and 'lit holding the
  //  room' are everybody else's)
  const onDoor = (x: any) => (D as any).held?.get(x)?.door ?? null, litFree = () => team.filter(x => !onDoor(x) && x.flashlight?.enabled).length;
  const cross = new Map<any, { t: number; lit: boolean; corner: number }>(); let op: any = null, inT = NaN, darkAt = NaN, searching = 0, searchLit = 0;
  for (let f = 0; f < 60 * 60; f++) { step(); op ??= D.ops[0] ?? null;
    if (op) for (const [gd, t] of op.crossed) { if (!cross.has(gd)) cross.set(gd, { t, lit: litOk(gd), corner: NaN });
      const C = op.corner.get(gd), r = cross.get(gd)!; if (C?.pts.length && isNaN(r.corner) && Math.abs(Math.atan2(Math.sin(gd.char.aimYaw - Math.atan2(C.pts[0][0] - gd.char.pos[0], C.pts[0][2] - gd.char.pos[2])), Math.cos(gd.char.aimYaw - Math.atan2(C.pts[0][0] - gd.char.pos[0], C.pts[0][2] - gd.char.pos[2])))) < DTM.DOORTOOLS.cornerRad) r.corner = g.time - t; }
    if (op && D.ops.includes(op) && op.phase === 'enter' && cross.size) { searching++; watch(); if ([...cross.keys()].every(gd => litOk(gd))) searchLit++; }
    if (op && !D.ops.includes(op) && isNaN(inT)) inT = g.time;
    if (!isNaN(inT)) { if (!litFree() && isNaN(darkAt)) darkAt = g.time - inT; if (g.time - inT > 10) break; } }
  const held = litFree(), doorMen = team.filter(x => onDoor(x)), doorDark = doorMen.filter(x => !litOk(x)).length, doors = doorMen.map(x => `${x.callsign} on ${onDoor(x).def.name}${x.flashlight?.enabled ? '' : ' (dark)'}`).join(', ');
  await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all'));
  const out = inFile(40);
  const beat = (op?.beats ?? []).map((b: any) => b.what).find((w: string) => w.startsWith('searched')) ?? '';
  const m = beat.match(/searched · (\d+) of (\d+) cells unseen · (\d+) moved/);
  const withCorner = [...cross.entries()].filter(([gd]) => op?.corner.get(gd)?.pts.length);
  return { door: E.ent.door.def.name, team: team.length, why, spared, litInLit, burnDark, follow, walk, walkDark, stacked, cross, withCorner, searching, searchLit, inT, darkAt, held, doorMen: doorMen.length, doorDark, doors, out, ended: op?.ended ?? '(running)', secs: op ? inT - op.t0 : NaN,
    unseen: m ? +m[1] : NaN, cells: m ? +m[2] : NaN, moves: m ? +m[3] : NaN, beat };
}
export const flashweightLights = guarded(async () => {
  const F = family('flashweight-lights: weapon lights off until they help — every scenario: dark in file behind Sam, lit walking to a door alone, dark stacked on it, lit through the entry and the search, dark holding the room and following out');
  // (THE LIGHT RULE ALONE: since nvg.ts a quiet team in the dark walks on its goggles with no light at all — probes.ts nvg has that; what LIGHTS does with
  // the lights when they are its own to burn is measured here with the goggles off, as it was written)
  const bare = (set: Record<string, Record<string, unknown>> = {}) => setKnobs({ ...set, NVG: { on: false } }); bare();
  const L = GDM.LIGHTS; let spared = 0, burned = 0, burnDark = 0;
  for (const E of SCENARIOS as any[]) {
    const r = await emptyEntry(E.id); if (!r) { F.verdict(false, `${E.title}`, 'no held room to enter'); continue; }
    const crossed = [...r.cross.values()], litIn = crossed.filter(c => c.lit).length; spared += r.spared; burned += r.litInLit; burnDark += r.burnDark;
    const ok = !r.why && r.follow === 0 && r.stacked === 0 && r.walkDark === 0 && r.litInLit === 0 && crossed.length > 0 && litIn === crossed.length && r.searching > 0 && r.searchLit >= r.searching * 0.95 && r.darkAt <= L.afterSecs + L.hotSecs + L.tail + 0.5 && r.held === 0 && r.doorDark === 0 && r.out === 0;
    F.verdict(ok, `${E.title}: ${r.team} teammates, the ${r.door} door`, `${r.why ? `ORDER REFUSED: ${r.why} · ` : ''}lit in file behind Sam ${r.follow} · DARK while walking to the door on their own ${r.walkDark} of ${r.walk} man-frames · lit stacked on it ${r.stacked} · crossed the frame lit (or in a lit place) ${litIn} of ${crossed.length} · lights the lit place spared ${r.spared} man-frames, burning on in one ${r.litInLit} · lit through the search ${r.searchLit} of ${r.searching} frames · all dark ${f2(r.darkAt)} s after the room was called (bound ${f2(L.afterSecs + L.hotSecs + L.tail + 0.5)}) · lit holding the room ${r.held} · holding another door of it ${r.doorMen}${r.doorMen ? ` (${r.doors}), dark where the place is dark ${r.doorDark}` : ''} · following out ${r.out}`);
  }
  // the place rule at the bar it ships with: the start card's floors are night offices, mostly under it — so the lights BURN there (by the probe's own
  // reading of the floor, not the rule's) and none burns on in a place the rule calls lit
  F.verdict(burnDark > 0 && burned === 0, 'in the dark the lights burn, and none burns on in a place the rule calls lit (LIGHTS.litOff, as shipped)', `${burnDark} man-frames lit on floor the probe itself reads dark · ${spared} man-frames a lit place spared a light · ${burned} burning on in a lit place past the tail`);
  // …and a floor that IS over the bar keeps them off: the four-man room clear with the bar let down to where its corridor passes (0.2), every other check
  // of the entry still holding — then the same entry with the rule off burns them, as it was
  { const E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-four') ?? (SCENARIOS as any[])[0], bound = L.afterSecs + L.hotSecs + L.tail + 0.5;
    const whole = (r: any) => { const crossed = [...r.cross.values()]; return !r.why && r.walkDark === 0 && crossed.length > 0 && crossed.every((c: any) => c.lit) && r.searching > 0 && r.searchLit >= r.searching * 0.95 && r.darkAt <= bound && r.follow === 0 && r.stacked === 0 && r.held === 0 && r.doorDark === 0 && r.out === 0; };
    const words = (r: any) => `spared ${r.spared} · burning on in a lit place ${r.litInLit} · dark walking alone ${r.walkDark} of ${r.walk} · crossed lit (or in a lit place) ${[...r.cross.values()].filter((c: any) => c.lit).length} of ${r.cross.size} · lit through the search ${r.searchLit} of ${r.searching} frames · all dark ${f2(r.darkAt)} s after the call · lit in file ${r.follow}, stacked ${r.stacked}, holding ${r.held}, on another door ${r.doorMen}${r.doorMen ? ` (${r.doors}; dark in the dark ${r.doorDark})` : ''}, following out ${r.out}`;
    bare({ LIGHTS: { litAt: 0.2 } }); const on = await emptyEntry(E.id); reset(); bare();
    F.verdict(!!on && on.spared > 0 && on.litInLit === 0 && whole(on), `a place over the bar keeps the lights off (${E.title}, LIGHTS.litAt 0.2)`, on ? words(on) : 'nothing staged');
    bare({ LIGHTS: { litAt: 0.2, litOff: false } }); const off = await emptyEntry(E.id); reset(); bare();
    F.verdict(!!off && off.spared === 0 && whole(off), `the place rule off: lit or dark, the lights as they were (${E.title}, LIGHTS.litOff false)`, off ? words(off) : 'nothing staged'); }
  // the red path: the rule off is the old picture — the lights of the first entry still burning long after it
  bare({ LIGHTS: { on: false } });
  const E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-pair') ?? (SCENARIOS as any[])[0]; const r = await emptyEntry(E.id); reset();
  F.verdict(!!r && r.held > 0 && r.out > 0, `the probe sees the old picture when the rule is off (${E.title}, LIGHTS.on false)`, r ? `lit holding the room ${r.held} of ${r.team - r.doorMen} not on another door of it · following Sam out ${r.out}` : 'nothing staged');
  return F.done();
});
const tallyRows = async (args: string[]): Promise<any[]> => {
  const file = `${process.env.TMPDIR ?? '/tmp'}/flashweight-${process.pid}-${Math.random().toString(36).slice(2)}.json`;
  const p = Bun.spawn(['bun', 'run', `${ROOT}/tools/qa/bang-tally.ts`, ...args, '--jobs', '4', '--json', file], { stdout: 'ignore', stderr: 'pipe' }); const err = await new Response(p.stderr).text(); const code = await p.exited;
  if (code > 1) throw new Error(`bang-tally ${args.join(' ')} exited ${code}\n${err.slice(-600)}`);   // (1 = a scenario's own verdict line failed — the rows are whole; anything else = it did not run them)
  try { const j = JSON.parse(await Bun.file(file).text()); return j.results ?? []; } finally { try { (await import('node:fs')).unlinkSync(file); } catch { } }
};
export const flashweightCorners = guarded(async () => {
  const F = family('flashweight-corners: men going in check their corners and look the room over — every scenario');
  const K = DTM.DOORTOOLS;
  for (const E of SCENARIOS as any[]) {
    const r = await emptyEntry(E.id); if (!r) { F.verdict(false, `${E.title}`, 'no held room to enter'); continue; }
    const late = r.withCorner.filter(([, c]: any) => !(c.corner <= K.cornerCap));
    const ok = !r.why && r.cross.size > 0 && late.length === 0 && r.ended === 'in' && r.unseen < K.deadCells;
    F.verdict(ok, `${E.title}: the ${r.door} door, ${r.cross.size} in`, `${r.why ? `ORDER REFUSED: ${r.why} · ` : ''}muzzle on his near corner after crossing: ${r.withCorner.map(([gd, c]: any) => `${gd.callsign} ${Number.isFinite(c.corner) ? f2(c.corner) + ' s' : 'NEVER'}`).join(', ') || '(no corner to a hand of this door)'} (cap ${K.cornerCap}) · the room: ${Number.isFinite(r.unseen) ? `${r.unseen} of ${r.cells} cells never under a muzzle` : 'NOT SEARCHED'} (dead floor is ${K.deadCells}+), ${r.moves || 0} sent on · ${f2(r.secs)} s from 'going in' to 'holding the room' · ended '${r.ended}'`);
  }
  // the red path, and what it buys: the same entries behind a bang, with the search and the corners off — men left standing in rooms the team walked into
  const seeds = process.env.FLASHWEIGHT_SEEDS ?? '1-3';
  const [on, off] = [await tallyRows(['--seeds', seeds, '--arms', 'bang']), await tallyRows(['--seeds', seeds, '--arms', 'bang', '--set', JSON.stringify({ DOORTOOLS: { search: false, corners: false } })])];
  const count = (rs: any[]) => { const live = rs.filter(x => x.of > 0 && !x.note); return { n: live.length, missed: live.filter(x => x.still > 0).length, lost: live.reduce((a, x) => a + x.lost, 0), men: live.reduce((a, x) => a + x.team, 0), taken: live.filter(x => x.taken).length }; };
  const A = count(on), B = count(off);
  F.verdict(A.n > 0 && A.n === B.n && (A.missed < B.missed || A.missed === 0) && A.lost <= B.lost + Math.ceil(B.men * 0.02), `behind a bang, every held room's every door (seeds ${seeds}): fewer rooms left with men standing in them, and no more of the team lost for it`,
    `with the corners and the search: ${A.missed} of ${A.n} entries ended with the team alive, its order over and a man of the room still standing IN the room · ${A.taken} rooms taken · ${A.lost} of ${A.men} lost — without: ${B.missed} of ${B.n} · ${B.taken} taken · ${B.lost} of ${B.men} lost`);
  return F.done();
});

// ---------------------------------------------------------------- what it buys
export const flashweightEntry = guarded(async () => {
  const F = family('flashweight-entry: behind the bang, every scenario loses fewer and takes or empties as many rooms (bang-tally.ts)');
  const seeds = process.env.FLASHWEIGHT_SEEDS ?? '1-3';
  const p = Bun.spawn(['bun', 'run', `${ROOT}/tools/qa/bang-tally.ts`, '--seeds', seeds, '--arms', 'open,bang', '--jobs', '4'], { stdout: 'pipe', stderr: 'ignore' });
  const text = await new Response(p.stdout).text(); const code = await p.exited;
  const lines = text.split('\n'); let n = 0;
  for (const l of lines) { const m = l.match(/^(PASS|FAIL) — ([^:]+): (.*)$/); if (!m) continue; n++; F.verdict(m[1] === 'PASS', `${m[2]} (seeds ${seeds})`, m[3]); }
  F.verdict(code === 0 && n === (SCENARIOS as any[]).length, 'every scenario on the start card was counted', `${n} of ${(SCENARIOS as any[]).length} scenarios gave a line · the tally's exit ${code}`);
  if (VERBOSE) console.log(text);
  return F.done();
});

// ---------------------------------------------------------------- flashweight-feel: the Tab panel's 'Team feel' rows keep a changed rule across a page load
/** game/teamfeel.ts under a stand-in localStorage: only what differs from the build is stored, a fresh Game reads it back before its squad systems do, a
 *  stored value of the wrong type or for a key the build does not keep is passed over, and the reset puts the build's values back and drops the stored copy. */
export async function flashweightFeel(): Promise<boolean> {
  const F = family('flashweight-feel: a changed feel rule is kept per machine, and only what was changed');
  const TF: any = await import(`${ROOT}/src/game/teamfeel.ts`);
  const store = new Map<string, string>(); const G: any = globalThis; const had = 'localStorage' in G, was = G.localStorage;
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  const KEY = 'twopointsix.teamfeel';
  // (whatever an earlier probe left in the tables — the bang tally's staging switches the defenders' rally off — is put by for the length of this one: the
  //  rows are judged from the build's values, and handed back as they were found)
  const T = TF.feelTables(), D = clone(TF.feelDefaults()), found = clone(T);
  try {
    TF.resetTeamFeel(); store.clear();
    F.verdict(TF.teamFeelSummary() === 'as shipped' && !store.has(KEY), 'untouched: as shipped, nothing stored', `summary '${TF.teamFeelSummary()}' · stored ${store.get(KEY) ?? 'nothing'}`);
    T.PACE.max = 1.8; TF.saveTeamFeel('PACE.max'); T.FLASH.on = false; TF.saveTeamFeel('FLASH.on'); T.FLASH.secs[0] = 5; TF.saveTeamFeel('FLASH.secs.0');
    T.COVER.on = false;   // (a URL flag for a visit, or the console: no row wrote it)
    T.LIGHTS.hotSecs = 9; TF.saveTeamFeel('LIGHTS.hotSecs'); T.LIGHTS.hotSecs = D.LIGHTS.hotSecs; TF.saveTeamFeel('LIGHTS.hotSecs');   // (a row moved and moved back)
    const stored = JSON.parse(store.get(KEY) ?? '{}');
    F.verdict(JSON.stringify(Object.keys(stored).sort()) === JSON.stringify(['FLASH.on', 'FLASH.secs.0', 'PACE.max']) && stored['PACE.max'] === 1.8 && stored['FLASH.on'] === false && stored['FLASH.secs.0'] === 5,
      'three rows changed (a fourth moved and moved back, a fifth key written by no row): exactly those three are stored', `${store.get(KEY)} · summary '${TF.teamFeelSummary()}'`);
    T.COVER.on = D.COVER.on;
    // a page load: the tables as the build ships them, then a Game constructed
    T.PACE.max = D.PACE.max; T.FLASH.on = D.FLASH.on; T.FLASH.secs[0] = D.FLASH.secs[0];
    const W = await standUp({});
    F.verdict(T.PACE.max === 1.8 && T.FLASH.on === false && T.FLASH.secs[0] === 5 && T.FLASH.secs[1] === D.FLASH.secs[1] && T.PACE.accel === D.PACE.accel && !!W.game,
      'a fresh Game reads the three back, and nothing else moves', `PACE.max ${T.PACE.max} · FLASH.on ${T.FLASH.on} · FLASH.secs ${JSON.stringify(T.FLASH.secs)} · PACE.accel ${T.PACE.accel}`);
    T.PACE.accel = 4; TF.saveTeamFeel('PACE.accel');
    F.verdict(Object.keys(JSON.parse(store.get(KEY) ?? '{}')).length === 4, 'a row moved after the load: the three read back are still kept beside it', `${store.get(KEY)}`);
    TF.resetTeamFeel();
    F.verdict(T.PACE.max === D.PACE.max && T.FLASH.on === D.FLASH.on && T.FLASH.secs[0] === D.FLASH.secs[0] && T.PACE.accel === D.PACE.accel && !store.has(KEY) && TF.teamFeelSummary() === 'as shipped',
      'reset: the build\'s values back, the stored copy gone', `PACE.max ${T.PACE.max} · FLASH.on ${T.FLASH.on} · stored ${store.get(KEY) ?? 'nothing'}`);
    store.set(KEY, JSON.stringify({ 'PACE.max': 'fast', 'PACE.on': 0, 'PACE.nope': 3, 'NOPE.x': 1, 'ORDERS.key': 'KeyQ', 'LIGHTS.aloneM': 9, 'FLASH.secs.1': null, 'PACE.accel': 0, 'LIGHTS.onM': -1, 'DOORTOOLS.bangs': 1e9 }));
    TF.loadTeamFeel();
    F.verdict(T.PACE.max === D.PACE.max && T.PACE.on === D.PACE.on && T.PACE.nope === undefined && T.ORDERS.key === D.ORDERS.key && T.FLASH.secs[1] === D.FLASH.secs[1] && T.LIGHTS.aloneM === 9
      && T.PACE.accel === D.PACE.accel && T.LIGHTS.onM === D.LIGHTS.onM && T.DOORTOOLS.bangs === D.DOORTOOLS.bangs,
      'a stored value of the wrong type, outside its row\'s range, or for a key not kept, is passed over; a good one beside it is taken', `PACE.max ${T.PACE.max} · PACE.on ${T.PACE.on} · PACE.accel ${T.PACE.accel} · LIGHTS.onM ${T.LIGHTS.onM} · DOORTOOLS.bangs ${T.DOORTOOLS.bangs} · ORDERS.key ${T.ORDERS.key} · LIGHTS.aloneM ${T.LIGHTS.aloneM}`);
    store.set(KEY, '{not json'); TF.resetTeamFeel(); store.set(KEY, '{not json'); TF.loadTeamFeel();
    F.verdict(TF.teamFeelSummary() === 'as shipped', 'an unreadable stored copy changes nothing', `summary '${TF.teamFeelSummary()}'`);
  } catch (e) { F.verdict(false, 'the probe ran to its end', String(e instanceof Error ? e.stack ?? e.message : e).split('\n').slice(0, 3).join(' / '));
  } finally {
    TF.resetTeamFeel(); store.clear();
    for (const n of Object.keys(found)) for (const k of Object.keys(found[n])) T[n][k] = found[n][k];   // (as the earlier probes left them)
    if (had) G.localStorage = was; else delete G.localStorage;
  }
  return F.done();
}
