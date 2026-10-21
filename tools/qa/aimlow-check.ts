// 'aimlow' — A MAN WHO IS LOW IS AIMED AT WHERE HE IS (player.ts manAim, AIM.player.low). The maintainer, off the build: "weird issue where if an enemy is bent
// over from a flash, I can't shoot them even if i'm directly clicking on them -- gun is forced to be level". The reticle took the man by his posed chest, but the
// round and the gun's pitch went to a standing man's chest over his feet whatever he was doing: a man with his head down has his crown under that line.
//   bun run tools/qa/aimlow-check.ts        (also `probes.ts aimlow`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   low-round    a man with his head down (the animator's crouch held at 1, as guards.ts writes it for a man under fire or on a drill's knee) on the open strip,
//                the rifle and the pistol, three ranges. Knob 1: the reticle has him, the gun comes DOWN onto him and ONE click drops him. Knob 0 is the fault
//                as it was: the reticle has him, the gun is carried as at a standing man, three clicks all end metres beyond him and he lives. Also with his
//                side and his back to Sam, and with Sam crouched.
//   low-flash    the same man doubled over a flash on top of it (the dazzle's stamps, the motion pass on so its hunch is in the pose): the same two results.
//   stand-same   a man ON HIS FEET — upright, hunched by a flash, folded — is aimed at exactly as before: the round's end and the gun's pitch are the same number
//                at knob 0 and knob 1, and one click drops him either way.
//   low-real     the game's own two states, in a room fight: a stun canister let off inside the nearest held room's open door and the blast filed with morale.ts
//                as a door charge files its own — a man it blinds DUCKS. Sam is stood where he has a line, the cursor on the man's chest. Knob 1: one click,
//                he is down. Knob 0: the round goes over him.
//   low-harness  standUp() on the frozen stand puts the knob at 0 (every older probe, digest and tally aimed at a standing chest); on the page's stand the card
//                finds it at 1, and the page's boot writes 1 for a plain address and 0 for ?noaimlow. A session file from before the key replays with it
//                off, one that has it replays as recorded (journal.ts applyKnobs).
// AIMLOW_BREAK=1 = the knob left at 0 where a line asks for 1: low-round must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here is a picture. What is measured is the pose the renderer is handed (aimPitch) and where the rounds end.
import { standUp, ROOT } from './headless.ts';
import { stage as stageScenario } from './bang-tally.ts';
const { AIM, AIM_DEFAULTS } = await import(`${ROOT}/src/game/aim.ts`);
const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const MOR: any = await import(`${ROOT}/src/game/morale.ts`);
const J: any = await import(`${ROOT}/src/game/journal.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60, DEG = 180 / Math.PI, BREAK = process.env.AIMLOW_BREAK === '1';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
let allPass = true, found = NaN;   // (found: the knob as the card found it)
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const knob = (v: 0 | 1) => { AIM.player.low = BREAK ? 0 : v; };
/** the open strip south of the office (aimlevel-probes.ts): 40 m clear east of here */
const P0: Vec3 = [12, 0, 2], EAST = Math.PI / 2;
const ahead = (d: number, side = 0): Vec3 => [P0[0] + d, 0, P0[2] + side];
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; }
type Pose = 'stand' | 'dazzle' | 'fold' | 'low' | 'low+dazzle';
interface Shot { taken: boolean; pitch: number; crown: number; chest: number; rounds: number; to: Vec3 | null; over: number; dead: boolean; manX: number }
/** the height of a round's line where it passes the man (`from` → `to`, at his distance along it on the floor) */
function heightAt(from: number[], to: number[], man: number[]): number { const L = Math.hypot(to[0] - from[0], to[2] - from[2]), d = Math.hypot(man[0] - from[0], man[2] - from[2]); return from[1] + (to[1] - from[1]) * (L > 1e-6 ? d / L : 0); }
/** Sam on the strip facing east with `gun`, one hostile `D` metres in front of him facing him in `pose`, the cursor on his chest; up to `clicks` clicks, a beat apart */
async function strip(low: 0 | 1, gun: 'rifle' | 'pistol', D: number, pose: Pose, clicks: number, yaw = -EAST, samLow = false): Promise<Shot> {
  Math.random = seeded(7);
  const W: any = await standUp(); const { game: g, input } = W; knob(low); AIM.player.level = 1; if (pose.includes('dazzle') || pose === 'fold') MOVES.on = 1; if (pose === 'fold') MOVES.fold = 1;   // (the motion pass, and the fold with it: the frozen stand holds both off)
  g.godMode = true; g.infiniteAmmo = true; g.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => park(gd, i));
  g.teleportPlayer(P0); g.player.crouch = samLow; g.player.char.bodyYaw = g.player.char.aimYaw = EAST; W.cam.yaw = Math.PI; W.cam.rebuild(); W.step(DT);
  input.pressed.add(gun === 'rifle' ? 'Digit2' : 'Digit1'); W.step(DT); for (let i = 0; i < 80; i++) { W.cursorAt(ahead(8)); W.step(DT); }
  const gd = g.guards[0], an = gd.char.anim;
  if (pose.startsWith('low')) Object.defineProperty(an, 'crouchTarget', { get: () => 1, set() { }, configurable: true });   // (guards.ts writes it every frame: 1 for a man with his head down)
  const keep = () => { gd.char.pos = ahead(D); gd.char.bodyYaw = gd.char.aimYaw = yaw; if (pose.includes('dazzle')) { gd.dazzledUntil = g.time + 5; gd.dazzledAt = ahead(D - 3); gd.reactT = 5; } if (pose === 'fold') { gd.staggerUntil = g.time + 5; gd.reactT = 5; } };
  const on = () => { keep(); g.player.crouch = samLow; W.cursorAt(gd.char.bones.chest); W.step(DT); };
  for (let i = 0; i < 90; i++) { keep(); W.cursorAt(ahead(Math.min(3, D * 0.5))); W.step(DT); }
  for (let i = 0; i < 40; i++) on();
  const R: Shot = { taken: g.aimGuard === gd, pitch: g.player.char.aimPitch * DEG, crown: gd.char.bones.headTop?.[1] ?? NaN, chest: gd.char.bones.chest[1], rounds: 0, to: null, over: NaN, dead: false, manX: gd.char.pos[0] };
  for (let k = 0; k < clicks && gd.state !== 'dead'; k++) {
    const seen = new Set(g.events); keep(); W.cursorAt(gd.char.bones.chest); input.clicked |= 1; input.buttons |= 1; W.step(DT); input.buttons = 0;
    for (const e of g.events) if (!seen.has(e) && e.kind === 'shot' && e.to) { R.to = [e.to[0], e.to[1], e.to[2]]; R.rounds++; if (e.from) R.over = heightAt(e.from, e.to, gd.char.pos); }
    for (let i = 0; i < 25 && gd.state !== 'dead'; i++) on();
  }
  R.dead = gd.state === 'dead'; return R;
}
const say = (r: Shot) => `crown ${f2(r.crown)} m · reticle ${r.taken ? 'has him' : 'NOT on him'} · gun ${f1(r.pitch)}° · ${r.rounds} round${r.rounds === 1 ? '' : 's'}, the last to x ${r.to ? f1(r.to[0]) : '—'} (he is at x ${f1(r.manX)}), passing him at ${f2(r.over)} m · ${r.dead ? 'down' : 'ALIVE'}`;

type Case = ['rifle' | 'pistol', number, string?, number?, boolean?];   // gun, metres, [what is different about it, his facing, Sam crouched]
async function lowRound(pose: Pose, title: string, cases: Case[]) {
  console.log(`\n=== ${title} ===`);
  for (const [gun, D, what, yaw, samLow] of cases) {
    const a = await quiet(() => strip(1, gun, D, pose, 1, yaw, samLow)), b = await quiet(() => strip(0, gun, D, pose, 3, yaw, samLow)), name = `${gun}, ${D} m${what ? `, ${what}` : ''}`;
    verdict(a.taken && a.crown < 1.2 && a.dead && a.rounds === 1 && a.pitch < b.pitch - 1, `${name}, knob 1: the reticle has him, the gun comes down onto him, one click drops him`, say(a));
    if (!BREAK) verdict(b.taken && !b.dead && b.rounds === 3 && !!b.to && b.to[0] > b.manX + 3 && b.over > b.crown, `${name}, knob 0 (the fault as it was): the reticle has him, three clicks pass over his crown and end beyond him, he lives`, say(b));
  }
}
async function standSame() {
  console.log('\n=== stand-same: a man on his feet is aimed at exactly as before ===');
  let upright = NaN;
  for (const pose of ['stand', 'dazzle', 'fold'] as Pose[]) {
    const a = await quiet(() => strip(1, 'rifle', 6, pose, 1)), b = await quiet(() => strip(0, 'rifle', 6, pose, 1));
    const same = !!a.to && !!b.to && a.to.every((x, i) => x === b.to![i]) && a.pitch === b.pitch;
    const posed = pose === 'stand' ? a.crown > 1.65 : a.crown >= 1.5 && a.crown < upright - 0.05; if (pose === 'stand') upright = a.crown;   // (the stamps must have bent him, or the line is the upright man again)
    verdict(same && posed && a.dead && b.dead, `${pose}: ${pose === 'stand' ? 'upright' : 'bent, his crown under the upright man\'s and still over 1.5 m'} — the round's end and the gun's pitch are the same number at knob 1 and knob 0; one click drops him either way`, `knob 1: ${say(a)}\n    knob 0: ${say(b)}`);
  }
}
/** the room fight: the can's own dazzle and morale's own duck on a man of the nearest held room, Sam stood `D` metres off him with a line */
async function real(low: 0 | 1) {
  const S: any = await stageScenario('room-clear-pair', 1); const { g, step, W } = S, O = g.orders, nav = g.col.nav, input = W.input; knob(low); MOR.MORALE.on = true; MOR.MORALE.training = 'green'; MOR.MORALE.nerve = 'brittle';   // (morale on, and the room's men of the kind a blast puts down on either stand)
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  let E: any = null; for (const d of S.defs) for (const ent of d.room.entries) { const k = flat(ent.at, g.player.char.pos); if (!E || k < E.k) E = { k, ent, room: d.room }; }
  if (!E) return null;
  const ent = E.ent, d = ent.door, ox = ent.out[0], oz = ent.out[1];
  const outPt = (back: number, lat: number): number[] => [ent.at[0] + ox * back - oz * lat, 0, ent.at[2] + oz * back + ox * lat];
  const men: any[] = S.defs.filter((x: any) => x.room === E.room).map((x: any) => x.gd);
  O.squad().filter((x: any) => x.state !== 'dead').forEach((gd: any, i: number) => { const p = outPt(5 + i, 1.5); gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.path = []; gd.pathGoal = null; });
  g.teleportPlayer(outPt(2.5, 0) as any); O.give('hold', O.targetAt(outPt(6.5, 0)), 'all'); step(5);
  { const s = -g.doors.side(d, outPt(0.6, 0)); d.latched = false; d.closing = false; d.vel = s * 5.5; d.quietT = -3600; d.lastWho = g.player.char.id; if (d.locked && !d.lockBroken) d.lockBroken = true; step(24); }
  let land: number[] = outPt(-1.2, 0); for (const b of [1.8, 1.5, 1.2, 0.9]) { const p = outPt(-b, 0); if (!nav.isBlocked(p[0], p[2])) { land = p; break; } }
  input.pressed.add('Digit2'); step(30);
  const seen = new Set<any>(g.events); let bang = false;
  CBM.dropThrowable(g, 'flash', land as any);
  for (let i = 0; i < 120 && !bang; i++) { step(); for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'bang') bang = true; } }
  if (!bang) return null;
  MOR.moraleBlast(g, [land[0], 0.3, land[2]], g.player.char.id);   // (doortools.ts blow files its charge's blast the same way, beside the report and flash it borrows from the can)
  const gd = men.filter(x => x.state !== 'dead' && x.dazzledUntil > g.time).sort((a, b) => flat(a.char.pos, g.player.char.pos) - flat(b.char.pos, g.player.char.pos))[0];
  if (!gd) return null;
  let put: number[] | null = null;
  for (let a = 0; a < 16 && !put; a++) { const p = [gd.char.pos[0] + Math.cos(a * Math.PI / 8) * 4, 0, gd.char.pos[2] + Math.sin(a * Math.PI / 8) * 4]; if (!nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([p[0], 1.3, p[2]], [gd.char.pos[0], 1.2, gd.char.pos[2]]) && !g.col.segmentBlocked([p[0], 0.4, p[2]], [gd.char.pos[0], 0.4, gd.char.pos[2]])) put = p; }
  if (!put) return null;
  const pl = g.player.char; g.teleportPlayer(put as any); pl.bodyYaw = pl.aimYaw = Math.atan2(gd.char.pos[0] - put[0], gd.char.pos[2] - put[2]);
  const on = () => { W.cursorAt(gd.char.bones.chest); g.player.visibility = 0.05; W.step(DT); };
  for (let i = 0; i < 60; i++) on();
  const R = { ducked: gd.char.anim.crouch > 0.5, blind: gd.dazzledUntil > g.time, taken: g.aimGuard === gd, crown: gd.char.bones.headTop?.[1] ?? NaN, pitch: pl.aimPitch * DEG, over: NaN, dead: false };
  const sn = new Set(g.events); W.cursorAt(gd.char.bones.chest); input.clicked |= 1; input.buttons |= 1; W.step(DT); input.buttons = 0;
  for (const e of g.events) if (!sn.has(e) && e.kind === 'shot' && e.to && e.from) R.over = heightAt(e.from, e.to, gd.char.pos);
  for (let i = 0; i < 20; i++) on();
  R.dead = gd.state === 'dead'; return R;
}
async function lowReal() {
  console.log('\n=== low-real: the can\'s own dazzle and a blast\'s own duck, in a room fight ===');
  const was = { ...MOR.MORALE };
  try {
    const a = await quiet(() => real(1)), b = await quiet(() => real(0));
    const line = (r: any) => r ? `${r.blind ? 'blind' : 'NOT blind'}, ${r.ducked ? 'ducked' : 'NOT ducked'}, crown ${f2(r.crown)} m · reticle ${r.taken ? 'has him' : 'NOT on him'} · gun ${f1(r.pitch)}° · the round passes him at ${f2(r.over)} m · ${r.dead ? 'down' : 'ALIVE'}` : 'the staging found no blinded man with a line to stand Sam on';
    verdict(!!a && a.blind && a.ducked && a.taken && a.dead, 'knob 1: a man of the room blinded by the can and ducked by the blast, the cursor on his chest: one click, he is down', line(a));
    if (!BREAK) verdict(!!b && b.blind && b.ducked && b.taken && !b.dead && b.over > b.crown, 'knob 0 (the fault as it was): the same man, the same click: the round goes over his crown, he lives', line(b));
  } finally { Object.assign(MOR.MORALE, was); }
}
async function lowHarness() {
  console.log('\n=== low-harness: the frozen stand is at 0, the game ships at 1; a session file from before the key replays with it off ===');
  const frozen = harnessProfile() === 'frozen';
  AIM.player.low = 1; const W: any = await quiet(() => standUp()); const stood = AIM.player.low;
  if (frozen) verdict(stood === 0 && AIM_DEFAULTS.player.low === 1, 'standUp() on the frozen stand puts the knob at 0; the table\'s own value is 1', `after standUp ${stood} · AIM_DEFAULTS ${AIM_DEFAULTS.player.low}`);
  else {
    const P: any = await import(`${ROOT}/src/host/profile.ts`);
    AIM.player.low = 0; P.pageSwitches(new URLSearchParams('')); const open = AIM.player.low; P.pageSwitches(new URLSearchParams('noaimlow')); const off = AIM.player.low; P.pageSwitches(new URLSearchParams(''));
    verdict(found === 1 && open === 1 && off === 0 && AIM.player.low === 1, 'the page\'s stand: the card found the knob at 1; the page\'s boot writes 1 for a plain address and 0 for ?noaimlow', `found ${found} · plain ${open} · ?noaimlow ${off}`);
  }
  const g = W.game, full = J.knobsSnapshot(g);
  try {
    AIM.player.low = 1; const old = J.knobsSnapshot(g); delete old.tables.AIM.player.low; J.applyKnobs(g, old); const a = AIM.player.low;
    AIM.player.low = 1; const yes = J.knobsSnapshot(g); AIM.player.low = 0; J.applyKnobs(g, yes); const b = AIM.player.low;
    AIM.player.low = 0; const no = J.knobsSnapshot(g); AIM.player.low = 1; J.applyKnobs(g, no); const c = AIM.player.low;
    verdict(a === 0 && b === 1 && c === 0, 'applyKnobs: a file with no such key → 0; a file recorded at 1 → 1; a file recorded at 0 → 0', `no key ${a} · recorded 1 → ${b} · recorded 0 → ${c}`);
  } finally { J.applyKnobs(g, full); }
}

/** the whole card (probes.ts 'aimlow'): true = every check passed. The knobs are put back as they were found. */
export async function aimLow(): Promise<boolean> {
  const was = { low: AIM.player.low, level: AIM.player.level, moves: MOVES.on, fold: MOVES.fold, rnd: Math.random }; allPass = true; found = was.low;
  try {
    await lowRound('low', 'low-round: a man with his head down', [['rifle', 3], ['rifle', 6], ['rifle', 10], ['pistol', 3], ['pistol', 6], ['pistol', 10], ['rifle', 6, 'his side to Sam', 0], ['rifle', 6, 'his back to Sam', EAST], ['pistol', 3, 'his side to Sam', 0], ['rifle', 6, 'Sam crouched', -EAST, true]]);
    await lowRound('low+dazzle', 'low-flash: the same man doubled over a flash', [['rifle', 6], ['pistol', 3]]);
    await standSame(); await lowReal(); await lowHarness();
  } finally { AIM.player.low = was.low; AIM.player.level = was.level; MOVES.on = was.moves; MOVES.fold = was.fold; Math.random = was.rnd; }
  console.log(`\n=== aimlow: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await aimLow() ? 0 : 1);
