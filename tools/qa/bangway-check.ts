// A STUN CANISTER IS NOT THROWN AT A DOOR THE SQUAD PULLS OPEN — src/game/doortools.ts DOORTOOLS.bangWay (on). The maintainer, 10-11, on the outside clear: "the
// squad does waste a lot of bangs". With doors that open one way, a 'bang and clear' given from a door's PULL face swings the leaf toward the stack, and the can,
// thrown a beat after the leaf starts to move, met it and went off on the squad's own side: the room was not flashed and the can was spent.
//   [TPS_PROFILE=shipped] bun run tools/qa/bangway-check.ts [--seeds 1-3]        exit 0 = holds, 1 = it does not
// bang-tally.ts's own staged entry (a hot room, the four a few steps outside, 'bang and clear' from the menu's order) on the depot:
//   (1) rule ON, a held room's door from its pull face: no can goes off on the squad's side, and a can does go off in every run
//   (2) rule OFF, the same door: a can goes off outside in most runs — the fault
//   (3) a door they PUSH open: the entry is the same entry with the rule on and off, run for run
// THE TWO DOORS ARE PICKED BY WHAT THEY ARE, not by a name (pick(), below): the depot's floor was rebuilt once and its side doors renamed, and a name that is
// gone made every run a skipped run. A door fits when it is an entry of a room a defender holds on EVERY seed asked and the squad's side of it (the entry's
// outside) is its pull face / its push face on every one of them (Doors.pullFace: the swing is dealt by the level's geometry on both stands). Of the doors
// that fit, the ids of PREFER come first in their order, so a floor that still has the door the lines were written on runs that door; then the fullest room.
// No door of a kind = that kind's lines FAIL with the doors the floor does have.
// (1) and (2) need doors that open one way: they are asked only where the stand has them (the shipped stand; the frozen stand's leaves swing both ways, so
// nothing is ever pulled there and the check says so). BANGWAY_BREAK=1 runs (1) with the rule off: must fail on the shipped stand.
import { ROOT } from './headless.ts';
import { run, setKnobs, stage, type Spec } from './bang-tally.ts';
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const BREAK = process.env.BANGWAY_BREAK === '1';
const seedsOf = (s: string): number[] => { const m = s.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : s.split(',').map(Number); };
const SEEDS = seedsOf(flag('--seeds') ?? '1-3');
const SCN = 'depot-four';
type At = { door: string; room: string };
/** the door each kind's lines were written on, per floor — only an order among the doors that FIT (pick()); an id that is gone or does not fit is passed over */
const PREFER = {
  pulled: ['ab',     // the corridor depot: the door between the crew room and the comms room, as the crew room's entry — it opens toward the stack on the comms side
    'b_n'],          // the motor-pool depot: the signals hut's one door, which opens out of the hut toward the stack (a held-room door that keeps its id)
  pushed: ['a_w',    // the corridor depot: the crew room's west door, which opens into the room
    'a_s'],          // the motor-pool depot: the crew room's yard door, which opens into the room (a held-room door that keeps its id; the corridor depot has one too)
};
/** every entry of every held room, with whether the squad's side of it is its pull face — kept only where room and face are the same on every seed asked */
async function doors(): Promise<(At & { pulled: boolean; men: number })[]> {
  const seen = new Map<string, At & { pulled: boolean; men: number; n: number; mixed: boolean }>();
  const log = console.log, err = console.error, warn = console.warn;
  for (const seed of SEEDS) {
    console.log = console.error = console.warn = () => { };
    let S: Awaited<ReturnType<typeof stage>>; try { S = await stage(SCN, seed); } finally { console.log = log; console.error = err; console.warn = warn; }
    const rooms = new Map<any, number>(); for (const d of S.defs) rooms.set(d.room, (rooms.get(d.room) ?? 0) + 1);
    for (const [room, men] of rooms) for (const e of room.entries) {
      const pulled = !!S.g.doors.pullFace(e.door, [e.at[0] + e.out[0] * 0.8, 0, e.at[2] + e.out[1] * 0.8]);   // (a stride outside the entry: where the stack stands)
      const k = `${e.door.def.name}|${S.roomKey(room)}`, was = seen.get(k);
      if (was) { was.n++; was.men = Math.min(was.men, men); if (was.pulled !== pulled) was.mixed = true; } else seen.set(k, { door: e.door.def.name, room: S.roomKey(room), pulled, men, n: 1, mixed: false });
    }
  }
  return [...seen.values()].filter(x => x.n === SEEDS.length && !x.mixed);
}
function pick(all: Awaited<ReturnType<typeof doors>>, kind: 'pulled' | 'pushed'): At | null {
  const rank = (x: At) => { const i = PREFER[kind].indexOf(x.door); return i < 0 ? PREFER[kind].length : i; };
  const fit = all.filter(x => x.pulled === (kind === 'pulled')).sort((a, b) => rank(a) - rank(b) || b.men - a.men || a.door.localeCompare(b.door) || a.room.localeCompare(b.room));
  return fit.length ? { door: fit[0].door, room: fit[0].room } : null;
}

async function arm(on: boolean, at: { door: string; room: string }) {
  setKnobs({ DOORTOOLS: { bangWay: on } });
  try { const out = []; for (const seed of SEEDS) out.push(await run({ scn: SCN, ...at, arm: 'bang', seed } as Spec, false)); return out; }
  finally { setKnobs({}); }
}
const show = (rs: Awaited<ReturnType<typeof arm>>) => rs.map(r => r.note && !r.of ? `seed ${r.seed}: ${r.note}` : `seed ${r.seed}: ${r.bangs} can${r.bangs === 1 ? '' : 's'}, ${r.outside} outside, lost ${r.lost}/${r.team}, room ${r.down}/${r.of}`).join(' · ');

export async function bangwayCheck(): Promise<boolean> {
  let fails = 0; const line = (ok: boolean, what: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) fails++; };
  const oneWay = !!DOORWAY.oneWay;
  console.log(`=== bangway-check · ${SCN} · seeds ${SEEDS.join(',')}${BREAK ? ' · BANGWAY_BREAK: the rule off where it should be on' : ''}${oneWay ? '' : ' · doors swing both ways on this stand: no door is pulled, the pulled-door lines are not asked'} ===`);
  const all = await doors(), PULLED = pick(all, 'pulled'), PUSHED = pick(all, 'pushed');
  const have = all.map(x => `${x.door} (${x.pulled ? 'pulled' : 'pushed'}, room ${x.room})`).join(', ') || 'none';
  console.log(`  held-room doors on this floor: ${have}`);
  if (oneWay && !PULLED) line(false, `a held room has a door the squad pulls open on every seed (the pulled-door lines have nothing to run on — this floor's: ${have})`);
  if (oneWay && PULLED) {
    const onA = await arm(!BREAK, PULLED), offA = await arm(false, PULLED);
    console.log(`  pulled door ${PULLED.door}, on:  ${show(onA)}\n  pulled door ${PULLED.door}, off: ${show(offA)}`);
    const ran = (rs: typeof onA) => rs.filter(r => r.of > 0);
    line(ran(onA).length === SEEDS.length && ran(onA).every(r => r.outside === 0), `rule on: no can goes off on the squad's side of a door they pull open (${ran(onA).reduce((a, r) => a + r.outside, 0)} outside over ${ran(onA).length} runs)`);
    line(ran(onA).length === SEEDS.length && ran(onA).every(r => r.bangs >= 1), `rule on: a can still goes off on every entry (${ran(onA).filter(r => r.bangs >= 1).length} of ${ran(onA).length}): it waits for the leaf, it is not given up`);
    line(ran(offA).filter(r => r.outside > 0).length * 2 > ran(offA).length, `rule off: the can meets the leaf and goes off outside in most runs — the fault (${ran(offA).filter(r => r.outside > 0).length} of ${ran(offA).length})`);
  }
  if (!PUSHED) { line(false, `a held room has a door the squad pushes open on every seed (the pushed-door line has nothing to run on — this floor's: ${have})`); console.log(`=== bangway-check: ${fails} FAILED ===`); return false; }
  const onP = await arm(true, PUSHED), offP = await arm(false, PUSHED);
  const key = (r: (typeof onP)[number]) => `${r.seed}:${r.lost}/${r.team}:${r.down}/${r.of}:${r.bangs}:${r.outside}:${r.after}:${Number.isFinite(r.secs) ? r.secs.toFixed(3) : '-'}`;
  console.log(`  pushed door ${PUSHED.door}, on:  ${show(onP)}\n  pushed door ${PUSHED.door}, off: ${show(offP)}`);
  line(onP.every(r => r.of > 0) && onP.map(key).join(' ') === offP.map(key).join(' '), `a door they push open: the entry is the same with the rule on and off, run for run (${onP.length} runs)`);
  console.log(fails ? `=== bangway-check: ${fails} FAILED ===` : '=== bangway-check: ALL PASS ===');
  return fails === 0;
}
if (import.meta.main) process.exit((await bangwayCheck()) ? 0 : 1);
