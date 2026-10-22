// 'reachup' — CROUCHED BEHIND A STANDING MAN, THE GRAB'S REACH GOES UP FOR HIS NECK (CLOSE.reachUp → anim.readyUp, character.ts READY_UP). The maintainer, off
// the stealth tutorial mission with a still of Sam crouched behind a sentry: "the closer than ever animations are still a bit wonky". The tell's free hand is
// measured off Sam's own shoulder, which at the crouch is level with the man's belt: the open hand went to the small of his back and Sam's face to his seat.
//   bun run tools/qa/reachup-check.ts        (also `probes.ts reachup`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   up        crouched and stopped behind a standing man at three gaps, the key up against the key down: the left hand is over 1.05 m off the floor (it was
//             under 0.95), his head is higher, the hand is not inside the man, and the crouch the game reads has not moved.
//   stand     on his feet behind the same man: the pose is the same to the bit with the key up or down (the point is not over him); and crouched with the
//             pistol up ('grabGun': the gun keeps its aim) the same to the bit too.
//   ease      crouched: in to reach, a second there, back out — the left wrist's largest one-frame move (off his own root) with the key up is no more than a quarter over what it is with the key down.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?noreachup` puts it off), rides a
//             recording's tables, and a recording from before the key replays with it off.
// REACHUP_BREAK=1 = the key left down where `up` asks for it up: up must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here is a picture (tools/qa/close-stills.ts + pose-mesh-raster.py draw the same staging on the worn mesh).
import { standUp, ROOT } from './headless.ts';

const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.REACHUP_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, LOBBY: P3 = [10.2, 0, 19.5];
const f2 = (n: number) => n.toFixed(2);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** the lobby's open floor (close-stills.ts's staging): the shift parked, one man stood facing east, Sam hands empty behind him, the key as given */
async function lobby(key: boolean) {
  Math.random = seeded(7301); const W: any = await quiet(() => standUp()), g = W.game; CLOSE.on = true; CLOSE.reachUp = key;
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const place = (gd: any, p: P3) => { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = EAST; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.char.update(0); gd.char.update(DT); };
  const [A, ...rest] = g.guards; rest.forEach((gd: any, i: number) => { place(gd, [37.5, 0, 6 + i * 1.5]); gd.heardUpTo = 1e12; }); place(A, LOBBY); A.wp = 1;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; each?.(); } };
  const samAt = (d: number, crouch: boolean) => { g.teleportPlayer([A.char.pos[0] - d, 0, A.char.pos[2]]); g.player.crouch = crouch; const pl = g.player.char; pl.bodyYaw = pl.aimYaw = EAST; step(90); };
  const at = (c: any, node: string): P3 => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world; return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
  return { W, g, A, step, samAt, at };
}
interface Read { hand: P3; head: P3; neck: P3; crouch: number; ready: string | null; joints: Float32Array }
async function stopped(key: boolean, gap: number, crouch: boolean, pistol = false): Promise<Read> {
  const S = await lobby(key), c = S.g.player.char; if (pistol) S.g.player.holstered = false; S.samAt(gap, crouch);
  return { hand: S.at(c, 'handL'), head: S.at(c, 'head'), neck: S.at(S.A.char, 'neck'), crouch: c.anim.crouch, ready: c.anim.ready, joints: Float32Array.from(c.skel.jointData) };
}

async function up() {
  console.log('\n=== up: crouched behind a standing man, the hand goes up for his neck ===');
  const rows: string[] = []; let bad = 0;
  for (const gap of [1.0, 0.85, 0.72]) {
    const U = await stopped(!BREAK, gap, true), D = await stopped(false, gap, true);
    const off = Math.hypot(U.hand[0] - U.neck[0], U.hand[2] - U.neck[2]);
    const ok = U.ready === 'grab' && D.ready === 'grab' && U.hand[1] >= 1.05 && D.hand[1] <= 0.95 && U.head[1] >= D.head[1] + 0.08 && off >= 0.15 && off <= 0.75 && U.crouch > 0.99 && D.crouch > 0.99;
    if (!ok) bad++;
    rows.push(`${f2(gap)} m: the hand ${f2(U.hand[1])} m up (was ${f2(D.hand[1])}; his neck ${f2(U.neck[1])}), ${f2(off)} m short of his spine · the head ${f2(U.head[1])} (was ${f2(D.head[1])}) · the crouch ${f2(U.crouch)} / ${f2(D.crouch)} · the tell ${U.ready} / ${D.ready}`);
  }
  verdict(bad === 0, 'at three gaps the left hand is over 1.05 m up with the key up and under 0.95 with it down, the head at least 0.08 m higher, the hand 0.15 ‥ 0.75 m short of his spine, and the crouch the game reads whole either way', rows.join('\n    '));
}
async function stand() {
  console.log('\n=== stand: on his feet the tell is what it was ===');
  const U = await stopped(true, 0.85, false), D = await stopped(false, 0.85, false); let worst = 0; for (let i = 0; i < U.joints.length; i++) worst = Math.max(worst, Math.abs(U.joints[i] - D.joints[i]));
  verdict(U.ready === 'grab' && worst === 0 && U.hand[1] > 1.2, 'standing 0.85 m behind him: every joint the same to the bit with the key up or down, the hand up at his neck as it was', `the tell ${U.ready} · the largest difference in any joint's matrix ${worst} · the hand ${f2(U.hand[1])} m up (his neck ${f2(U.neck[1])})`);
  const GU = await stopped(true, 0.85, true, true), GD = await stopped(false, 0.85, true, true); let gw = 0; for (let i = 0; i < GU.joints.length; i++) gw = Math.max(gw, Math.abs(GU.joints[i] - GD.joints[i]));
  verdict(GU.ready === 'grabGun' && gw === 0, 'crouched 0.85 m behind him with the pistol up: the gun keeps its aim — every joint the same to the bit with the key up or down', `the tell ${GU.ready} · the largest difference in any joint's matrix ${gw}`);
}
async function ease() {
  console.log('\n=== ease: in to reach, a second there, and back out — no pop ===');
  const run = async (key: boolean) => {
    const S = await lobby(key), g = S.g, c = g.player.char; S.samAt(2.6, true); let last: P3 | null = null, worst = 0, peak = 0;
    const tap = () => { const h = S.at(c, 'handL'), r = [h[0] - c.pos[0], h[1], h[2] - c.pos[2]]; if (last) worst = Math.max(worst, Math.hypot(r[0] - last[0], r[1] - last[1], r[2] - last[2])); last = r; peak = Math.max(peak, h[1]); };
    S.W.input.keys.add('KeyD'); let n = 0; while (S.A.char.pos[0] - c.pos[0] > 0.85 && n++ < 900) S.step(1, tap); S.W.input.keys.delete('KeyD'); S.step(60, tap);
    S.W.input.keys.add('KeyA'); S.step(70, tap); S.W.input.keys.delete('KeyA'); S.step(40, tap);
    return { worst, peak, out: S.at(c, 'handL')[1] };
  };
  const U = await run(true), D = await run(false);
  verdict(U.peak >= 1.05 && U.worst <= Math.max(0.05, D.worst * 1.25) && U.out <= 0.8, 'the left wrist, off his own root, never moves more in one frame with the key up than a quarter as much again as with it down (or 5 cm), and is back down once he is out of reach', `key up: ${(U.worst * 100).toFixed(1)} cm a frame at most, the hand as high as ${f2(U.peak)} m, ${f2(U.out)} m at the end · key down: ${(D.worst * 100).toFixed(1)} cm a frame at most`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_REACHUP, want = word !== undefined ? word === '1' : shipped;
  CLOSE.reachUp = shipped ? found : !want;   // (the frozen stand's pin writes the key at every stand-up, so it is set wrong first; the page's stand has it from the page's boot, read once when the harness loads: `found`, put back after the lines above wrote it)
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), stood = CLOSE.reachUp;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = 'reachUp' in snap.tables.CLOSE;
  CLOSE.reachUp = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CLOSE.reachUp = false; JR.applyKnobs(W.game, snapUp); const kept = CLOSE.reachUp;
  delete snap.tables.CLOSE.reachUp; CLOSE.reachUp = true; JR.applyKnobs(W.game, snap); const old = CLOSE.reachUp;
  const read = (q: string) => { CLOSE.reachUp = !CLOSE.reachUp; PR.pageSwitches(new URLSearchParams(q)); return CLOSE.reachUp; }, plain = read(''), off = read('noreachup');
  verdict((STAND_ENV as string[]).includes('TPS_REACHUP') && PR.FROZEN_HOLDS['CLOSE.reachUp'] === 'TPS_REACHUP=1' && stood === want && found === want && had && kept === true && old === false && plain === true && off === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?noreachup',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_REACHUP')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CLOSE.reachUp']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plain} · ?noreachup ${off}`);
}

/** the whole card (probes.ts 'reachup'): true = every check passed. The switches are put back as they were found. */
export async function reachUpCheck(): Promise<boolean> {
  const was = { ...CLOSE }, rnd = Math.random; allPass = true; found = CLOSE.reachUp;
  try { await up(); await stand(); await ease(); await harness(); }
  finally { Object.assign(CLOSE, was); Math.random = rnd; }
  console.log(`\n=== reachup: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await reachUpCheck() ? 0 : 1);
