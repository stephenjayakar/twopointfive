// A HAND TORCH HANGS WHEN THE WALL IS AT HIS HAND — the check behind guards.ts torchLow (calmtorch.ts TORCH.wallLow: on in the page, ?torchwall=0; off on the
// frozen stand, TPS_TORCHWALL=1; TORCH.wallDark, ?torchwall=dark, is the other answer to the same reading).
//   bun run tools/qa/torchwall-check.ts        (also `probes.ts torch-wall`)
// The office, the night shift on its own beats with every patrol torch burning (the calm-torch rule held off), Sam out of everybody's sight. Every frame the
// check reads each patrolling man's carry ITSELF — his hand to seven points across the beam the relaxed carry would point, at a margin either side of the rule's
// two distances — and keeps its own clocks:
//   (a) with the switch off the flaw is there: frames of a torch burning level with its whole beam ended at arm's length for longer than the rule would allow
//   (b) with it on there is no such frame, and torches did hang
//   (c) it comes back up: no frame of a torch still hanging a second after the carry has run clear past the far distance
//   (d) the other answer: with wallDark the torch is out for those frames instead, and never tipped
//   (e) off, nothing reads it: the same game frame for frame with its numbers moved
//   (f) the stand's own word, and a recording carries the key
// What it cannot say: what a hanging torch looks like (never seen on a GPU), or what it does to a night of sneaking — nobody has played it.
// TORCHWALL_BREAK=1 = the rule answers "not at a wall" with its switch on: (b) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function fnv() { let h = 0x811c9dc5 >>> 0; return { eat: (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } }, hex: () => (h >>> 0).toString(16).padStart(8, '0') }; }

export async function torchwallCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { TORCH } = await import(`${ROOT}/src/game/calmtorch.ts`);
  const { torchCarryWant } = await import(`${ROOT}/src/game/rigProps.ts`);
  const { HOUR } = await import(`${ROOT}/src/game/hours.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const J: any = await import(`${ROOT}/src/game/journal.ts`);
  const DT = 1 / 60, SECS = 150, MARGIN = 0.15, rnd0 = Math.random, was = { ...TORCH }, hour0 = { id: HOUR.id, sun: HOUR.sun }; let all = true;
  const fanOf = (d: number[]): number[][] => { const out: number[][] = []; for (const a of [0, -0.17, 0.17, -0.33, 0.33]) { const c = Math.cos(a), k = Math.sin(a); out.push([d[0] * c + d[2] * k, d[1], d[2] * c - d[0] * k]); } for (const e of [-0.3, 0.3]) { const v = [d[0], d[1] + e, d[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; out.push([v[0] / l, v[1] / l, v[2] / l]); } return out; };
  const check = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== torch-wall: a hand torch whose beam would end on the wall at his hand hangs, its beam on the floor at his feet ===');
  const staff = (g: any) => g.guards.filter((x: any) => !x.unit && x.team === 'guard' && x.state === 'patrol' && !x.drawn);
  /** the check's own reading: does the whole carried beam end on something solid inside `m` of his hand */
  const ends = (g: any, x: any, m: number): boolean => { const hand = x.char.bones.handR; if (!hand) return false; const d = torchCarryWant(x.char);
    return fanOf(d).every(r => g.col.segmentBlocked(hand, [hand[0] + r[0] * m, hand[1] + r[1] * m, hand[2] + r[2] * m])); };
  interface Tally { n: number; levelAtWall: number; litAtWall: number; atWall: number; hung: number; hungInOpen: number; hash: string; stoodOn: boolean }
  const walk = async (set: (first: boolean) => void): Promise<Tally> => {
    Math.random = seeded(11); HOUR.id = 'night'; HOUR.sun = 1; const W: any = await quiet(() => standUp()), g = W.game; const stoodOn = !!TORCH.wallLow; g.playerInvisible = true; g.godMode = true; TORCH.calmOff = false; set(true);
    const T: Tally = { n: 0, levelAtWall: 0, litAtWall: 0, atWall: 0, hung: 0, hungInOpen: 0, hash: '', stoodOn }, H = fnv(), near = new Map<any, number>(), clear = new Map<any, number>();
    for (let f = 0; f < SECS * 60; f++) { W.step(DT); H.eat(JSON.stringify(digestGame(g, true)));
      for (const x of g.guards) H.eat(`${x.flashlight?.enabled ? 1 : 0}${(x.flashlight?.dir?.[1] ?? 0).toFixed(3)}`);
      for (const x of staff(g)) { T.n++; const fl = x.flashlight, y = fl.dir[1];
        const n = ends(g, x, TORCH.wallM - MARGIN) ? (near.get(x) ?? 0) + 1 : 0; near.set(x, n); const c = !ends(g, x, TORCH.wallBackM + MARGIN) ? (clear.get(x) ?? 0) + 1 : 0; clear.set(x, c);
        if (n > 0.7 * 60) { T.atWall++; if (fl.enabled) { T.litAtWall++; if (y > -0.75) T.levelAtWall++; } }
        if (y < -0.75) { T.hung++; if (c > 60) T.hungInOpen++; } } }
    T.hash = H.hex(); return T; };
  try {
    const off = await walk(() => { TORCH.wallLow = false; TORCH.wallDark = false; }), on = await walk(() => { TORCH.wallLow = true; TORCH.wallDark = false; }), dark = await walk(() => { TORCH.wallLow = false; TORCH.wallDark = true; });
    check(off.levelAtWall > 0, '(a) with the switch off the flaw is there: a patrol\'s torch burns level into the wall at his hand', `man-frames on patrol ${off.n} over ${SECS} s · the carried beam ended inside ${(TORCH.wallM - MARGIN).toFixed(2)} m for over 0.7 s: ${off.atWall} · of those, torch burning and level: ${off.levelAtWall}`);
    check(on.levelAtWall === 0 && on.hung > 0, '(b) with it on there is no such frame, and torches did hang', `burning level at the wall ${off.levelAtWall} → ${on.levelAtWall} (want 0) · man-frames a torch hung: ${on.hung} of ${on.n}`);
    check(on.hungInOpen === 0, '(c) it comes back up: no torch still hanging a second after the carry runs clear', `man-frames hanging with the carry clear past ${(TORCH.wallBackM + MARGIN).toFixed(2)} m for over a second: ${on.hungInOpen} (want 0)`);
    check(dark.litAtWall === 0 && dark.atWall > 0 && dark.hung === 0, '(d) the other answer: with wallDark the torch is out at the wall instead, and never tipped', `at the wall ${dark.atWall} man-frames · burning there ${off.litAtWall} → ${dark.litAtWall} (want 0) · tipped ${dark.hung} (want 0)`);
    { const moved = await walk(() => { TORCH.wallLow = false; TORCH.wallDark = false; TORCH.wallM = 5; TORCH.wallBackM = 6; TORCH.lowTan = 9; TORCH.lowRate = 1; });
      check(moved.hash === off.hash, '(e) off, nothing reads it: the same game frame for frame with its numbers moved', `${off.hash} · numbers moved ${moved.hash}`); Object.assign(TORCH, was); }
    { const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_TORCHWALL, want = word !== undefined ? word === '1' : shipped;
      check(off.stoodOn === want, '(f) the stand: on as the page opens, off on the frozen stand (TPS_TORCHWALL has the say on either)', `stood up with it ${off.stoodOn ? 'on' : 'off'} · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_TORCHWALL=${word}` : ''}`);
      const W: any = await quiet(() => standUp()), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(W.game)));
      TORCH.wallLow = true; const own = snap(), old = snap(); delete old.tables.TORCH.wallLow;
      TORCH.wallLow = false; J.applyKnobs(W.game, own); const carried = TORCH.wallLow; TORCH.wallLow = true; TORCH.wallDark = true; J.applyKnobs(W.game, old); const before = TORCH.wallLow || TORCH.wallDark;
      check(carried === true && before === false, '    … and a recording carries it: one made with it on replays with it on, one from before the key with it off', `the key in the file, on: ${carried} · no key: ${before}`); }
  } catch (e) { check(false, 'the check ran', e instanceof Error ? String(e.stack).slice(0, 600) : String(e)); }
  finally { Object.assign(TORCH, was); Math.random = rnd0; HOUR.id = hour0.id; HOUR.sun = hour0.sun; }
  console.log(`=== torch-wall: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all;
}
if (import.meta.main) process.exit((await torchwallCheck()) ? 0 : 1);
