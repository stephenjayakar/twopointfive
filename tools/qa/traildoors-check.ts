// tools/qa/traildoors-check.ts — a follower goes by the doors Sam took (orders.ts ORDERS.trailDoors: trailWay).
//
// Seen on the registry level's walk with four behind Sam, on the page's stand: at the copy room's gallery door the lead follower gives way to the leaf,
// the men behind him go in past him, and by the time it is his turn Sam is out of the room's far door and into the hall. His place is in the hall,
// the hall is nearer by the gallery than through the copy room, and he walks round the room the file went through, apart from his partner. With the
// rule he walks Sam's trail to his place: in by the gallery door and out by the hall door.
//
// The fault on the walk as it falls needs the page's own door rules to make him lose his turn, so the differential here is staged by hand, the same on
// both stands: the lead follower is HELD where he stands from the frame Sam steps into the copy room until Sam is well into the hall, then let go.
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) rule off, held and let go: he goes round — never in the copy room — and ends with Sam;
//   (3) rule on, the same: the trail way is handed to him, he walks through the copy room, and ends with Sam;
//   (4) rule on, the whole walk with nobody held: every man enters every space Sam does and ends with him, and the trail way is a rare thing;
//   (5) rule on, the trail made too long a way round to be worth it (trailLong 0): it is not handed out, and he goes round as with the rule off;
//   (6) off, nothing reads its numbers;
//   (7) a recording from before the key replays with it off; one that carries it keeps it; ?traildoors=0 puts it off.
//
//   bun run tools/qa/traildoors-check.ts          (both stands: it raises the switch itself; also `probes.ts trail-doors`, family registry)
//   TRAILDOORS_BREAK=1 …                          (the rule's own body left out, the same lines asked: must fail)
// What it cannot say: one level, one seed, the script's Sam at a walk. Not staged: a locked door on the trail (the walk unlocks every door), and an
// opening with no door in it, which the rule does not count as a way of its own. Never seen on a GPU, nobody has played it.
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { walk } = (await import('./registry-probes.ts')) as any;
const { REGISTRY_ROOMS } = (await import(`${ROOT}/tools/levels/registry.ts`)) as any;
const { ORDERS } = (await import(`${ROOT}/src/game/orders.ts`)) as any;
const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = (await import(`${ROOT}/src/game/knobs.ts`)) as any;

type Rect = { x0: number; x1: number; z0: number; z1: number };
const inRoom = (p: number[], r: Rect) => p[0] > r.x0 && p[0] < r.x1 && p[2] > r.z0 && p[2] < r.z1;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const COPY: Rect = REGISTRY_ROOMS.copy, HALL: Rect = REGISTRY_ROOMS.hall;
class Enough extends Error { }
const AFTER = 9;   // seconds watched after he is let go

interface Held { stood: boolean; who: string; heldS: number; inCopy: number; took: number; gap: number; at: number[]; g: any; from: number[] }
/** the walk up to the copy room, the lead follower held from the frame Sam is in it until Sam is a metre and a half into the hall, then AFTER seconds more */
async function held(on: boolean, set: Record<string, unknown> = {}): Promise<Held> {
  const H: Held = { stood: false, who: '', heldS: 0, inCopy: 0, took: 0, gap: 99, at: [0, 0, 0], g: null, from: [0, 0, 0] }; let lead: any = null, pin: number[] | null = null, phase = 0, t1 = 0;
  try { await walk(4, (g: any, men: any[]) => {
    const sam = g.player.char.pos, O = g.orders;
    if (!H.g) { H.g = g; H.stood = !!ORDERS.trailDoors; ORDERS.trailDoors = on; Object.assign(ORDERS, set);
      const tw = O.trailWay.bind(O); O.trailWay = (...a: any[]) => { const r = tw(...a); if (r.length && a[0] === lead && phase === 2) H.took++; return r; }; }
    if (phase === 0 && inRoom(sam, COPY)) { phase = 1; lead = men.find((m: any) => O.of(m)?.follow === 0) ?? men[0]; H.who = lead.callsign; pin = [...lead.char.pos]; H.from = [...pin]; }
    if (phase === 1) { const c = lead.char; c.pos[0] = pin![0]; c.pos[2] = pin![2]; c.vel[0] = c.vel[2] = 0; H.heldS += 1 / 60;
      if (inRoom(sam, HALL) && sam[0] > HALL.x0 + 1.5) { phase = 2; t1 = g.time; } }
    if (phase === 2) { if (inRoom(lead.char.pos, COPY)) H.inCopy++; H.gap = flat(lead.char.pos, sam); H.at = [...lead.char.pos]; if (g.time - t1 > AFTER) throw new Enough(); }
  }); } catch (e) { if (!(e instanceof Enough)) throw e; }
  return H;
}

export const trailDoorsCheck = guarded(async () => {
  const F = family('trail-doors: a follower goes by the doors Sam took');
  const knobs0 = knobsCopy(), rnd0 = Math.random, log = console.log;
  try {
    const say = (h: Held) => `${h.who} held ${h.heldS.toFixed(1)} s at (${h.from[0].toFixed(1)}, ${h.from[2].toFixed(1)}) · in the ${AFTER} s after: ${(h.inCopy / 60).toFixed(1)} s in the copy room, the trail way handed to him ${h.took} time(s), ${h.gap.toFixed(1)} m from Sam at the end`;
    const off = await held(false);
    { const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_TRAILDOORS, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['ORDERS.trailDoors'];
      F.verdict(off.stood === want && row === 'TPS_TRAILDOORS=1', `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${off.stood} · TPS_TRAILDOORS ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }
    F.verdict(off.heldS > 1 && off.inCopy === 0 && off.took === 0 && off.gap < 5.5, 'rule off, the lead follower held at the copy room\'s door and let go with Sam in the hall: he goes round the room, and ends with Sam', say(off));
    const on = await held(true);
    F.verdict(on.heldS > 1 && on.inCopy > 30 && on.took >= 1 && on.gap < 5.5, 'rule on, the same: he is handed Sam\'s trail, walks through the copy room, and ends with Sam', say(on));
    { let asks = 0, took = 0, G: any = null; console.log = () => { };
      const w = await walk(4, (g: any) => { if (!G) { G = g; ORDERS.trailDoors = true; const O = g.orders, tw = O.trailWay.bind(O); O.trailWay = (...a: any[]) => { asks++; const r = tw(...a); if (r.length) took++; return r; }; } });
      console.log = log;
      const spaces = Object.keys(REGISTRY_ROOMS), miss = w.theirs.map((t: Set<string>) => spaces.filter(s => w.sam.has(s) && !t.has(s)).join('+') || '—');
      F.verdict(w.alive && !w.short && miss.every((k: string) => k === '—') && w.end.every((d: number) => d < 5.5) && w.doorway.length === 0 && asks > 0 && took <= 3, 'rule on, the whole walk with nobody held: every man enters every space Sam does and ends with him; the trail way is asked for and is a rare thing',
        `spaces a man never entered: ${miss.join(' / ')} · at the end ${w.end.map((d: number) => d.toFixed(2)).join(' / ')} m from Sam · asked ${asks} times in ${w.secs.toFixed(0)} s, handed out ${took}${w.short ? ` · ${w.short.slice(0, 120)}` : ''}`); }
    { const far = await held(true, { trailLong: 0 });
      F.verdict(far.heldS > 1 && far.inCopy === 0 && far.took === 0 && far.gap < 5.5, 'rule on, the trail too long a way round to be worth it (trailLong 0): it is not handed to him, and he goes round the room as with the rule off', say(far)); }
    { const moved = await held(false, { trailReachM: 9, trailLong: 9 });
      F.verdict(moved.inCopy === off.inCopy && moved.took === 0 && flat(moved.at, off.at) < 1e-6, 'off, nothing reads them: the same held run with its numbers moved', `${say(moved)} · his last place ${flat(moved.at, off.at).toFixed(6)} m from the first run's`); }
    { const g = on.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      ORDERS.trailDoors = true; const old = snap(); delete old.tables.ORDERS.trailDoors; JOURNAL.applyKnobs(g, old); const without = ORDERS.trailDoors;
      ORDERS.trailDoors = true; const own = snap(); ORDERS.trailDoors = false; JOURNAL.applyKnobs(g, own); const withIt = ORDERS.trailDoors;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = ORDERS.trailDoors; PROFILE.pageSwitches(new URLSearchParams('traildoors=0')); const b = ORDERS.trailDoors;
      F.verdict(without === false && withIt === true && a === true && b === false, 'a recording from before the key replays with the rule off (journal.ts applyKnobs), one that carries it keeps it; the page opens with it on and ?traildoors=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'traildoors=0' → ${b}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; }
  return F.done();
});

if (import.meta.main) process.exit((await trailDoorsCheck()) ? 0 : 1);
