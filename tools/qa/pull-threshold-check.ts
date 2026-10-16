// A DOOR WORKED FROM THE FACE IT OPENS TOWARD: nobody of the order is left holding the back of the open leaf (doortools.ts DOORTOOLS.thrPull).
//   bun run tools/qa/pull-threshold-check.ts [--off]        exit 0 = every line passes · 1 = a line fails (`--off`: the rule off — must fail)
// the maintainer, 10-10, a pair told to work a door from outside: "guy working the door from the other side is blocked by the door." On a one-way door ordered from its
// pull face the leaf comes round onto the team's own side and stands out from the hinge jamb, across that jamb's diagonal: the man 'holding the jamb' there had
// the leaf between him and the doorway, and 'clear from outside' ended its arc on the same spot. Staged on the office's two doors with floor on their pull face
// (break room west, fire exit), the room clear's pair, the defenders taken off the floor (this is about where the men stand, not the fight): 'work it from the
// threshold' (held) and 'clear from outside' are given from that face, and once the order holds, for each man of it who is not rear security —
//   · the open leaf is not across his line to the point he watches, nor to the middle of the doorway;
//   · he stands at least 0.5 m from the leaf.
// Headless; the one-way doors and doors-stay-open are turned on here, as the page has them (the frozen stand has the old two-way leaves, where no door opens
// toward anybody and the rule is inert).
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { despawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const OFF = process.argv.includes('--off');
const f2 = (x: number) => x.toFixed(2);
let all = true, lines = 0;
const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; lines++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
console.log(`\n=== pull-threshold-check: a door worked from the face it opens toward${OFF ? ' (the rule OFF: must fail)' : ''} ===`);
for (const kind of ['threshold', 'outside'] as const) for (const name of ['breakroom_w', 'fire_exit']) {
  DOORWAY.oneWay = true; DOORSTAY.on = true;
  const R = await rig(1, { stage: 'rc', knobs: { thrPull: !OFF } }), g = R.game, d = R.door(name); DOORWAY.oneWay = true; DOORSTAY.on = true;
  for (const h of [...g.guards]) if (h.team === 'hostile') despawnUnit(g, h);
  const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), H = d.def.hinge, W = d.def.width;
  const off = (f: number, o: number, along = W * 0.5): [number, number, number] => [H[0] + ux * along - uz * o * f, 0, H[1] + uz * along + ux * o * f];
  const f = [1, -1].find(f => g.doors.pullFace(d, off(f, 0.8)))!, sam = off(f, 2.6), side = sideOf(d, sam);
  d.reset(); d.locked = false; g.teleportPlayer(sam); R.step(10);
  const w = R.D.order(kind, R.ops.filter((x: any) => x.state !== 'dead'), d, side, null, kind === 'threshold');
  if (typeof w === 'string') { verdict(false, `${kind} on ${name}, from the face it opens toward`, `refused: ${w}`); continue; }
  const op = w; R.until(() => op.phase === 'held' || op.phase === 'thr' || R.D.ops.indexOf(op) < 0, 40); R.step(60 * 4);
  const a = d.angle, tx = H[0] + Math.cos(c + a) * W, tz = H[1] + Math.sin(c + a) * W;
  const o = (ax: number, az: number, bx: number, bz: number, px: number, pz: number) => (bx - ax) * (pz - az) - (bz - az) * (px - ax);
  const cross = (p: number[], q: number[]) => o(H[0], H[1], tx, tz, p[0], p[2]) * o(H[0], H[1], tx, tz, q[0], q[2]) < 0 && o(p[0], p[2], q[0], q[2], H[0], H[1]) * o(p[0], p[2], q[0], q[2], tx, tz) < 0;
  const gap = (p: number[]) => { const k = Math.max(0, Math.min(1, ((p[0] - H[0]) * (tx - H[0]) + (p[2] - H[1]) * (tz - H[1])) / (W * W))); return Math.hypot(p[0] - H[0] - (tx - H[0]) * k, p[2] - H[1] - (tz - H[1]) * k); };
  const rows = op.men.filter((m: any) => m.state !== 'dead' && !op.rear?.has(m)).map((m: any) => { const A = R.O.of(m), p = m.char.pos, watch = A?.watch ?? d.frameCentre;
    const bad = cross(p, watch) || cross(p, d.frameCentre) || gap(p) < 0.5;
    return { bad, text: `${m.callsign}${m === op.lead ? ' (lead)' : ''}: ${f2((p[0] - H[0]) * ux + (p[2] - H[1]) * uz)} m along the frame from the hinge, ${f2((ux * (p[2] - H[1]) - uz * (p[0] - H[0])) * side)} m off it · leaf across his line to his watch point ${cross(p, watch)}, to the doorway's middle ${cross(p, d.frameCentre)} · ${f2(gap(p))} m from the leaf` }; });
  const reached = op.phase === 'held' || op.phase === 'thr', open = Math.abs(a) > 1.0 && Math.sign(a) === Math.sign(d.swing);
  verdict(reached && open && rows.length > 0 && !rows.some((r: any) => r.bad), `${kind === 'threshold' ? "'work it from the threshold'" : "'clear from outside'"} on ${name}, from the face it opens toward: nobody holds the back of the open leaf`,
    `phase ${op.phase} · leaf ${f2(a)} rad, on the team's side ${open}\n    ${rows.map((r: any) => r.text).join('\n    ')}`);
}
console.log(`=== pull-threshold-check: ${all && lines > 0 ? 'ALL PASS' : 'FAILED'} ===`);
process.exit(all && lines > 0 ? 0 : 1);
