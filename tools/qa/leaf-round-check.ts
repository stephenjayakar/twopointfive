// A TEAMMATE AT A WALK GOES ROUND A LEAF STANDING OPEN ACROSS HIS WAY (doorway.ts DOORMANNERS.leafRound; doors.ts DoorContact.round, ROUND_*).
//   bun run tools/qa/leaf-round-check.ts [--verbose]        exit 0 = every line PASS, 1 = a FAIL line
// Headless, on the door rules' stand (the door switches on, set below before anything is imported): nothing here looks at a picture.
// The registry's copy room: its gallery door opens out into the gallery, and pulled open it stands across the file's way down the gallery.
//   file    the leaf stood open clear of its doorway, Sam in the room, the men in the gallery behind the leaf and sent in ('move there'), 10 s — played with
//           the rule OFF and ON. OFF: the leaf is turned toward shut under them (the fault: it must be there to be mended). ON: it stands where it was
//           left, the doors count a leaf gone round, every man is in the room, and the last of them no later than with the rule off
//   wedged  one man held on the spot behind the same leaf (no way round for him), his walk still on: the leaf holds for a second, then turns under him as
//           it always did
//   stood   one man stood still against the back of the leaf: he is not walked along it (his feet all but still, no leaf counted)
// LEAFROUND_BREAK=1: the 'ON' runs are played with the rule off — the file line and the wedged line must go red.
export {};   // (a module: the top-level awaits below need it for the tools/qa typecheck)
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

const VERBOSE = process.argv.includes('--verbose'), BREAK = !!process.env.LEAFROUND_BREAK;
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: V) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`, f2 = (x: number) => x.toFixed(2);
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

const SCN = 'rescue-registry', DOOR = 'copy', OPEN = 1.7;
/** the scene: nobody hostile, no lock, the leaf stood open and still, Sam in the room. The door's own frame gives every place (nothing typed from the level) */
const stage = async (rule: boolean) => {
  const S: any = await quiet(() => BT.stage(SCN, 1)), g = S.g, O = g.orders;
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
  for (const d of g.doors.list) d.locked = false;
  DOORMANNERS.leafRound = rule && !BREAK;
  const d = g.doors.byName(DOOR), th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * d.swing, u[0] * d.swing], h = d.def.hinge as V, W = d.def.width as number;
  /** a point by the frame: `along` m from the hinge along the shut leaf, `out` m to the side it opens into (the gallery; negative = in the room) */
  const pt = (along: number, out: number): V => [h[0] + u[0] * along + n[0] * out, 0, h[1] + u[1] * along + n[1] * out];
  const open = () => { d.latched = false; d.closing = false; d.angle = d.swing * Math.min(OPEN, Math.abs(d.swing > 0 ? d.maxA : d.minA) - 0.05); d.vel = 0; d.pullT = 0; d.passers = 0; d.openT = 10; d.place(); };
  const men: any[] = O.squad().filter((x: any) => x.state !== 'dead');
  const put = (m: any, p: V) => { m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; m.path = []; m.pathGoal = null; };
  const inRoom = (p: V) => (p[0] - h[0]) * n[0] + (p[2] - h[1]) * n[1] < -0.3;   // (through the frame by more than his own half breadth)
  await quiet(() => g.teleportPlayer(pt(W / 2 + 1.0, -2.2)));
  return { S, g, O, d, men, pt, open, put, inRoom, W, step: (k = 1) => quiet(() => S.step(k)) };
};
const lean = (d: any) => Math.abs(d.angle);

log(`=== leaf-round-check: ${SCN}, the ${DOOR} room's gallery door${BREAK ? ' (LEAFROUND_BREAK: the rule is off in every run)' : ''} ===`);

// ---------------------------------------------------------------- file
const file = async (rule: boolean) => {
  const R = await stage(rule), { g, O, d, men } = R;
  // the men in the gallery behind the leaf (the hinge's side of it), in file along the wall the door is in, a walk's distance off
  men.forEach((m, i) => R.put(m, R.pt(-1.6 - 0.9 * i, 0.8)));
  await R.step(3); R.open(); const was = lean(d), rounds0 = g.doors.rounds;
  const goal = R.pt(R.W / 2 + 0.6, -2.0), why = await quiet(() => O.give('move', O.targetAt(goal), 'all'));
  let low = was; const inT = men.map(() => NaN);
  for (let f = 0; f < 10 * 60; f++) { await R.step(1); low = Math.min(low, lean(d)); men.forEach((m, i) => { if (isNaN(inT[i]) && R.inRoom(m.char.pos)) inT[i] = f / 60; }); }
  if (VERBOSE) log(`    (file, rule ${rule ? 'on' : 'off'}) ${why ? `order refused: ${why} · ` : ''}leaf ${f2(was)} → least ${f2(low)}, ends ${f2(lean(d))} · in at ${inT.map(t => isNaN(t) ? '—' : f2(t)).join(' / ')} s · men end ${men.map(m => at(m.char.pos)).join(' ')} · rounds ${g.doors.rounds - rounds0}`);
  return { why, was, low, end: lean(d), inT, rounds: g.doors.rounds - rounds0, n: men.length };
};
{ const off = await file(false), on = await file(true), last = (r: { inT: number[] }) => Math.max(...r.inT.map(t => isNaN(t) ? Infinity : t)), tIn = (r: { inT: number[] }) => r.inT.map(t => isNaN(t) ? '—' : f2(t)).join(' / ');
  verdict(!off.why && off.low < off.was - 0.3, 'the fault is there with the rule off: the men at a walk turn the open leaf toward shut', `${off.n} men sent in from behind the leaf${off.why ? ` — order refused: ${off.why}` : ''}: it stood at ${f2(off.was)} rad, was turned to ${f2(off.low)}, ends at ${f2(off.end)} · in the room at ${tIn(off)} s`);
  verdict(!on.why && on.low > on.was - 0.1 && on.rounds > 0 && on.inT.every(t => !isNaN(t)) && last(on) <= last(off) + 0.5, 'with the rule on the leaf stands where it was left, the men go round its end, and all are in the room no later', `it stood at ${f2(on.was)} rad, least ${f2(on.low)}, ends at ${f2(on.end)} · leaves gone round: ${on.rounds} · in the room at ${tIn(on)} s (rule off: ${tIn(off)} s)`); }

// ---------------------------------------------------------------- wedged
{ const R = await stage(true), { g, O, d, men } = R, m = men[0]; for (const o of men.slice(1)) R.put(o, R.pt(-6 - men.indexOf(o), 0.8));
  await R.step(3); R.open();
  // on the spot, hard against the back of the leaf half way out along it: the leaf as it stands, a body's half breadth off its back face
  const a = d.angle, th = d.def.closedDir + a, lx = Math.cos(th), lz = Math.sin(th), h = d.def.hinge as V, bx = -lz * d.swing, bz = lx * d.swing;   // (l: along the leaf · b: off its back)
  const spot: V = [h[0] + lx * R.W * 0.5 + bx * 0.36, 0, h[1] + lz * R.W * 0.5 + bz * 0.36];
  R.put(m, spot); const was = lean(d); await quiet(() => O.give('move', O.targetAt(R.pt(R.W / 2 + 0.6, -2.0)), O.squad().indexOf(m)));
  let heldS = NaN, low = was; for (let f = 0; f < 4 * 60; f++) { m.char.pos[0] = spot[0]; m.char.pos[2] = spot[2]; await R.step(1); low = Math.min(low, lean(d)); if (isNaN(heldS) && lean(d) < was - 0.05) heldS = f / 60; }
  verdict(!isNaN(heldS) && heldS > 0.8 && heldS < 3, 'a man with no way round has it out of his way as before: the leaf holds a second, then turns under him', `held on the spot at ${at(spot)} behind the leaf with his walk on: it stood at ${f2(was)} rad for ${isNaN(heldS) ? 'all 4' : f2(heldS)} s, least ${f2(low)}`); }

// ---------------------------------------------------------------- stood
{ const R = await stage(true), { g, d, men } = R, m = men[0]; for (const o of men.slice(1)) R.put(o, R.pt(-6 - men.indexOf(o), 0.8));
  await R.step(3); R.open();
  const a = d.angle, th = d.def.closedDir + a, lx = Math.cos(th), lz = Math.sin(th), h = d.def.hinge as V, bx = -lz * d.swing, bz = lx * d.swing;
  const spot: V = [h[0] + lx * R.W * 0.5 + bx * 0.33, 0, h[1] + lz * R.W * 0.5 + bz * 0.33];
  R.put(m, spot); await quiet(() => g.orders.give('hold', g.orders.targetAt(spot), g.orders.squad().indexOf(m)));
  const rounds0 = g.doors.rounds; let trod = 0, last: V = [...m.char.pos]; for (let f = 0; f < 3 * 60; f++) { await R.step(1); trod += flat(m.char.pos, last); last = [...m.char.pos]; }
  verdict(g.doors.rounds === rounds0 && trod < 0.2, 'a man stood by the leaf is not walked along it', `stood ${at(spot)} against its back for 3 s: his feet moved ${f2(trod)} m in all, leaves gone round ${g.doors.rounds - rounds0}`); }

DOORMANNERS.leafRound = true;
log(all ? '=== leaf-round-check: ALL PASS ===' : '=== leaf-round-check: FAIL ===');
process.exit(all ? 0 : 1);
