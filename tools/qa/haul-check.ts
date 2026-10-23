// 'haul' — THE CHOKE HAULS HIM UP AND BACK (TAKEDOWN.haul, character.ts HOLD.haul). The maintainer, off the stealth tutorial mission: "the choking animation
// needs to be more intense. in chaos theory sam has him in a chokehold and then lifts him up and back out of the air a bit when choking". The choke was posed
// standing: the elbow closed, Sam leaned back four degrees, and the man sagged on his own two feet until he was lowered.
//   bun run tools/qa/haul-check.ts        (also `probes.ts haul`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   haul      a man held on the lobby's open floor, the choke started, read 0.4, 0.65 and 0.9 s in, against the same run with the key down: both his feet
//             are over 6 cm off where they stood, his head is over 5 cm up, Sam's neck is over 8 cm further back, the choking wrist is where it was
//             against his neck to 3 cm, his two hands are where they were against that wrist to 4 cm, and neither man's root has moved.
//   heads     the two heads never come closer than with the key down, any frame of the haul (a first cut lifted his cap through Sam's head: 15.6 cm
//             where the key down has 18), and at its height they are over 22 cm apart.
//   down      he is set down before he is lowered: 1.5 s in his feet are where the key down has them to a centimetre, from 1.6 s in every joint of both
//             men is the key down's, and he is out on the same frame.
//   pops      the whole choke with the key up: no joint of either man moves more than 5 cm in a frame (the older choke checks' bar; they run with the
//             haul held off).
//   ease      the key put down in the middle of a haul: his feet come down over the next half second, never more than 3 cm in a frame.
//   regrab    the hold broken in the middle of a haul and a man grabbed again a quarter of a second on: neither man's hips, head or feet move further in a
//             frame than the same with the key down, to 2 cm (the haul kept from the broken hold came back whole on the new one's first frame: 13 cm).
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?nohaul` puts it off), rides a
//             recording's tables, and a recording from before the key replays with it off.
// HAUL_BREAK=1 = the key left down where `haul` asks for it up: haul must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: bones are read, nothing is drawn. Pictures of the same run: tools/qa/close-stills.ts --scene choke.
import { standUp, ROOT } from './headless.ts';

const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { TAKEDOWN } = await import(`${ROOT}/src/game/takedown.ts`);
const { startGrab, freeHeld } = await import(`${ROOT}/src/game/player.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

type P3 = number[];
const BREAK = process.env.HAUL_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, LOBBY: P3 = [10.2, 0, 19.5];
const f3 = (n: number) => n.toFixed(3), cm = (n: number) => (n * 100).toFixed(1);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Frame { t: number; feet: [number, number]; head: number; samBack: number; apart: number; wrist: number; hands: [number, number]; roots: P3; joints: Float32Array[]; bones: Record<string, P3>[] }
/** the lobby's open floor (close-stills.ts's staging): one man stood facing east, Sam behind him, the grab, a second and a half held, the choke — a frame
 *  read every frame of it from the frame the choke's phase starts. `keyAt` = the key as a function of the choke's seconds. */
async function chokeRun(keyAt: (t: number) => boolean, secs = 3, breakAt = -1): Promise<{ frames: Frame[]; outAt: number; again: number }> {
  Math.random = seeded(7303); const W: any = await quiet(() => standUp()), g = W.game; CLOSE.on = true; TAKEDOWN.on = true; TAKEDOWN.haul = keyAt(0);
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const place = (gd: any, p: P3) => { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = EAST; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.char.update(0); gd.char.update(DT); };
  const [A, ...rest] = g.guards; rest.forEach((gd: any, i: number) => { place(gd, [37.5, 0, 6 + i * 1.5]); gd.heardUpTo = 1e12; }); place(A, LOBBY); A.wp = 1;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const pl = g.player.char, step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([pl.pos[0] + Math.sin(pl.bodyYaw) * 6, 1.0, pl.pos[2] + Math.cos(pl.bodyYaw) * 6]); W.step(DT); g.player.visibility = 0.02; } };
  g.teleportPlayer([A.char.pos[0] - 0.8, 0, A.char.pos[2]]); g.player.crouch = true; pl.bodyYaw = pl.aimYaw = EAST; W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); for (let i = 0; i < 60; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.step(DT); g.player.visibility = 0.02; }
  startGrab(g, A); step(90);
  const at = (c: any, node: string): P3 => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world; return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
  const frames: Frame[] = []; let outAt = -1, t = -1, broke = -1, again = -1;
  if (!g.selectVerb('held', 'choke')) return { frames, outAt, again }; W.input.pressed.add('Space');
  for (let f = 0; f < (secs + 0.6) * 60; f++) {
    const H = g.player.holding; if (t < 0 && H && H.phase === 'choke') t = 0;
    if (t >= 0) TAKEDOWN.haul = keyAt(t + DT);
    if (breakAt >= 0 && broke < 0 && t >= breakAt) { freeHeld(g, 'cancel'); broke = f; }
    if (broke >= 0 && again < 0 && f === broke + 15) { A.state = 'patrol'; A.awareness = 0; startGrab(g, A);   // (forced: a freed man is alert and cannot be grabbed again — in play it is Sam's side that meets this, the man shot dead in his arm and another grabbed at once)
      again = g.player.holding ? frames.length : -2; }
    step();
    if (t < 0) continue; t += DT; if (outAt < 0 && !g.player.holding) outAt = t;
    const hn = at(pl, 'head'), hh = at(A.char, 'head'), nk = at(A.char, 'neck'), wr = at(pl, 'handL'), sn = at(pl, 'neck'), hl = at(A.char, 'handL'), hr = at(A.char, 'handR'), dist = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    frames.push({ t, feet: [at(A.char, 'footL')[1], at(A.char, 'footR')[1]], head: hh[1], samBack: pl.pos[0] - sn[0], apart: Math.hypot(hn[0] - hh[0], hn[1] - hh[1], hn[2] - hh[2]), wrist: Math.hypot(wr[0] - nk[0], wr[1] - nk[1], wr[2] - nk[2]), hands: [dist(hl, wr), dist(hr, wr)],
      roots: [...pl.pos, ...A.char.pos], joints: [Float32Array.from(pl.skel.jointData), Float32Array.from(A.char.skel.jointData)], bones: [pl, A.char].map((c: any) => Object.fromEntries(Object.keys(c.anim.nodes).filter(k => typeof c.anim.nodes[k] === 'number').map(k => [k, at(c, k)]))) });
    if (t > secs) break;
  }
  return { frames, outAt, again };
}
const frameAt = (R: { frames: Frame[] }, t: number) => R.frames[Math.min(R.frames.length - 1, Math.max(0, Math.round(t * 60) - 1))];
const maxDiff = (a: Float32Array, b: Float32Array) => { let m = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.abs(a[i] - b[i])); return a.length === b.length ? m : Infinity; };

async function haul() {
  console.log('\n=== haul · down · ease: the choke with the key up, against the same choke with it down ===');
  const off = await chokeRun(() => false), on = await chokeRun(() => !BREAK);
  if (off.frames.length < 150 || on.frames.length < 150) { verdict(false, '(staging) the choke ran', `frames ${off.frames.length} / ${on.frames.length}`); return; }
  const rows: string[] = []; let bad = 0;
  for (const t of [0.4, 0.65, 0.9]) {
    const a = frameAt(on, t), b = frameAt(off, t), feet = Math.min(a.feet[0] - b.feet[0], a.feet[1] - b.feet[1]), head = a.head - b.head, back = a.samBack - b.samBack, wr = Math.abs(a.wrist - b.wrist), root = Math.max(...a.roots.map((q, i) => Math.abs(q - b.roots[i]))), hd = Math.max(Math.abs(a.hands[0] - b.hands[0]), Math.abs(a.hands[1] - b.hands[1]));
    if (!(feet >= 0.06 && head >= 0.05 && back >= 0.08 && wr <= 0.03 && hd <= 0.04 && root < 1e-9)) bad++;
    rows.push(`${t} s in: his feet ${cm(feet)} cm up (the lower one), his head ${cm(head)} cm up, Sam's neck ${cm(back)} cm further back, the wrist to his neck ${cm(a.wrist)} cm (${cm(b.wrist)} with the key down), his hands to that wrist L ${cm(a.hands[0])} R ${cm(a.hands[1])} cm (${cm(b.hands[0])} / ${cm(b.hands[1])}), roots apart ${root.toExponential(1)}`);
  }
  verdict(bad === 0, 'the key up: both his feet over 6 cm off where they stood, his head over 5 cm up, Sam\'s neck over 8 cm further back, the wrist against his neck as it was to 3 cm, his hands against that wrist as they were to 4 cm, the roots unmoved', rows.join('\n    '));
  { let closer = 0, at = 0, least = Infinity, leastOff = Infinity; const n = Math.round(1.5 * 60);
    for (let i = 0; i < n; i++) { const d = off.frames[i].apart - on.frames[i].apart; if (d > closer) { closer = d; at = on.frames[i].t; } least = Math.min(least, on.frames[i].apart); leastOff = Math.min(leastOff, off.frames[i].apart); }
    const top = Math.min(frameAt(on, 0.4).apart, frameAt(on, 0.65).apart, frameAt(on, 0.9).apart);
    verdict(closer <= 0.005 && top >= 0.22, 'the two heads are never closer than with the key down, any frame of the haul, and over 22 cm apart at its height', `closest ${cm(least)} cm (${cm(leastOff)} with the key down) · the most the key up brings them closer in any frame ${cm(closer)} cm${closer > 0 ? ` (${f3(at)} s in)` : ''} · at its height ${cm(top)} cm`); }
  { const a = frameAt(on, 1.5), b = frameAt(off, 1.5), feet = Math.max(Math.abs(a.feet[0] - b.feet[0]), Math.abs(a.feet[1] - b.feet[1])); let j = 0, n = 0;
    for (let i = Math.round(1.6 * 60); i < Math.min(on.frames.length, off.frames.length); i++) { j = Math.max(j, maxDiff(on.frames[i].joints[0], off.frames[i].joints[0]), maxDiff(on.frames[i].joints[1], off.frames[i].joints[1])); n++; }
    verdict(feet <= 0.01 && j <= 1e-6 && n > 50 && on.outAt === off.outAt && on.outAt > 2, 'set down before he is lowered: 1.5 s in his feet are the key down\'s to a centimetre, from 1.6 s in every joint of both men is the key down\'s, and he is out on the same frame', `feet ${cm(feet)} cm apart at 1.5 s · joints ${j.toExponential(1)} apart over the ${n} frames from 1.6 s · out at ${f3(on.outAt)} s (${f3(off.outAt)})`); }
  { let pop = 0, at = ''; const end = Math.round(on.outAt * 60) - 2;
    for (let i = 1; i < end; i++) for (const w of [0, 1]) { const a = on.frames[i].bones[w], b = on.frames[i - 1].bones[w]; for (const k of Object.keys(a)) { const d = Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2]); if (d > pop) { pop = d; at = `${w ? 'the man' : 'Sam'}'s ${k}, ${f3(on.frames[i].t)} s in`; } } }
    verdict(BREAK || (pop <= 0.05 && end > 100), 'the whole choke with the key up: no joint of either man moves more than 5 cm in a frame', `fastest ${cm(pop)} cm (${at})`); }
  { const R = await chokeRun(t => t < 0.8), k0 = Math.round(0.8 * 60) - 1; let jump = 0; for (let i = k0; i < k0 + 60; i++) jump = Math.max(jump, Math.abs(R.frames[i + 1].feet[0] - R.frames[i].feet[0]), Math.abs(R.frames[i + 1].feet[1] - R.frames[i].feet[1]));
    const a = frameAt(R, 1.4), b = frameAt(off, 1.4), left = Math.max(Math.abs(a.feet[0] - b.feet[0]), Math.abs(a.feet[1] - b.feet[1])), up = frameAt(R, 0.8).feet[0] - frameAt(off, 0.8).feet[0];
    verdict(up >= 0.06 && jump <= 0.03 && left <= 0.015, 'the key put down 0.8 s in, mid-haul: his feet come down over the next half second, never more than 3 cm in a frame', `up ${cm(up)} cm when it went · the most in one frame ${cm(jump)} cm · ${cm(left)} cm left 0.6 s on`); }
}
/** the largest move of any joint of either man in one frame, over the frames [i0, i1) */
const fastest = (F: Frame[], i0: number, i1: number, only?: string[]) => { let pop = 0, at = ''; for (let i = Math.max(1, i0); i < Math.min(i1, F.length); i++) for (const w of [0, 1]) { const a = F[i].bones[w], b = F[i - 1].bones[w]; for (const k of only ?? Object.keys(a)) { const d = Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2]); if (d > pop) { pop = d; at = `${w ? 'the man' : 'Sam'}'s ${k}, ${f3(F[i].t)} s in`; } } } return { pop, at }; };
async function regrab() {
  console.log('\n=== regrab: the hold broken mid-haul, a man grabbed again a quarter of a second on ===');
  const off = await chokeRun(() => false, 1.6, 0.6), on = await chokeRun(() => true, 1.6, 0.6);
  if (on.again < 0 || off.again < 0) { verdict(false, '(staging) the second grab took', `again ${on.again} / ${off.again}`); return; }
  const BODY = ['hips', 'head', 'footL', 'footR'];   // (the forced grab throws Sam's hands a third of a metre in a frame either way: the bodies are what the haul moves)
  const a = fastest(on.frames, on.again - 2, on.again + 40, BODY), b = fastest(off.frames, off.again - 2, off.again + 40, BODY);
  verdict(a.pop <= b.pop + 0.02 && a.pop > 0, 'the hold broken mid-haul and grabbed again a quarter of a second on: neither man\'s hips, head or feet move further in a frame than with the key down, to 2 cm', `fastest ${cm(a.pop)} cm (${a.at}) · with the key down ${cm(b.pop)} cm (${b.at})`);
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_HAUL, want = word !== undefined ? word === '1' : shipped;
  if (!shipped) TAKEDOWN.haul = !want; else TAKEDOWN.haul = found;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp()), stood = TAKEDOWN.haul;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = 'haul' in snap.tables.TAKEDOWN;
  TAKEDOWN.haul = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); TAKEDOWN.haul = false; JR.applyKnobs(W.game, snapUp); const kept = TAKEDOWN.haul;
  delete snap.tables.TAKEDOWN.haul; TAKEDOWN.haul = true; JR.applyKnobs(W.game, snap); const old = TAKEDOWN.haul;
  const read = (q: string) => { TAKEDOWN.haul = !TAKEDOWN.haul; PR.pageSwitches(new URLSearchParams(q)); return TAKEDOWN.haul; }, plain = read(''), off = read('nohaul');
  verdict((STAND_ENV as string[]).includes('TPS_HAUL') && PR.FROZEN_HOLDS['TAKEDOWN.haul'] === 'TPS_HAUL=1' && stood === want && (!shipped || word !== undefined || found === want) && had && kept === true && old === false && plain === true && off === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?nohaul',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_HAUL')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['TAKEDOWN.haul']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plain} · ?nohaul ${off}`);
}

/** the whole card (probes.ts 'haul'): true = every check passed. The switches are put back as they were found. */
export async function haulCheck(): Promise<boolean> {
  const was = { td: { ...TAKEDOWN }, close: { ...CLOSE } }, rnd = Math.random; allPass = true; found = TAKEDOWN.haul;
  try { await haul(); await regrab(); Object.assign(TAKEDOWN, was.td); Object.assign(CLOSE, was.close); await harness(); }
  finally { Object.assign(TAKEDOWN, was.td); Object.assign(CLOSE, was.close); Math.random = rnd; }
  console.log(`\n=== haul: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await haulCheck() ? 0 : 1);
