// A TAKEN ROOM'S OTHER DOOR IS WATCHED — the check behind doortools.ts `DOORTOOLS.otherDoorM` (the men an entry leaves in a room: one of them has the
// room's other door).
// The fault it holds shut: a bang / open and clear put every man on his corners, the floor and then a sector across the room he had just searched; the
// room's OTHER door was nobody's. The warehouse's front office (door `off`, from the manager's office) and the compound's garage (door `g_e`, from the
// yard) each lost two men in a tenth of a second to one defender who walked up to that door and opened it on their backs.
//   bun run tools/qa/other-door-check.ts [--scn warehouse-four,compound-four] [--seeds 1-12] [--cap 420] [--jobs 4] [--pair 1,2,3,4,5,6] [--off]
//                                        [--on-json a.json,b.json --off-json c.json,d.json]
// What it does: plays each scenario × seed TWICE through tools/qa/ships.ts --json (the stand that file plays with no flag: the shipped profile where it
// has one) — the rule as shipped, and the rule at 0 — and reads two things.
// THE DOORS (playthrough.ts RunOut.other): of the other doors of every room taken and held that nobody of the squad had been beyond, how many had a gun on
// them by somebody's ORDER (or cover job) a second after the entry ended, and how many the rule dealt a man to.
// THE DEATHS (Death.other): a man who dropped IN A ROOM HIS OWN ENTRY HAD TAKEN (he had crossed its frame on that order), to a round that came through
// ANOTHER door of that room — or to a man who had walked in by one in the eight seconds before — where, a second before he dropped, no living teammate's
// order had a gun on that door (where the order points the gun, read off the game's own assignments ten times a second — not where a fight had swung it).
// Each such death with the rule is listed with what it was:
//   · the room's          he was still on the entry's own order (in it, or holding the room after it): what the rule is for
//   · · been beyond       … and by the death's own row the round did not come from floor nobody had stood on beyond THAT door: a door the squad has
//                         been beyond is one the rule leaves alone by design (a defender had since walked onto that floor). Listed apart, counted
//                         with the room's
//   · moved on            any later order (fall in, a stack on the next door, a hold, a wall charge) had taken him off the entry's: the watch ends with
//                         the order, by design. Listed, never counted — and under the scripted commander, who calls fall in ten to thirteen seconds
//                         after the men cross, MOST deaths through the compound's `g_e` are of this kind (men under 'fall in' still standing in the room)
// THE BAR IS A RATE AGAINST THE RULE AT 0, not zero deaths: the rule cuts these deaths, it does not end them, and which seed shows one moves with any
// change to the game (three fixed seeds at zero tolerance went red 900 commits after they were picked: two men lost after a later order had taken the
// watch, one through a door the squad had been beyond — none the fault). What is barred on is what the rule
// DOES — is the door watched — because that shows in every run; the deaths are its consequence, and on a build where the team loses few men that way
// even with the rule at 0 a dozen seeds show too few of them to bar on. Per scenario it FAILS when
//   · the rule deals a man to fewer than a QUARTER of such doors (it is not running, or mostly not), or the rule at 0 deals any (the switch did not
//     reach the game)
//   · the share of such doors with a gun on them a second after the entry is not at least FIVE POINTS higher with the rule than at 0
// and over the scenarios together it FAILS when the room's deaths (above) with the rule are more than those at 0 plus two: the rule making it worse.
// WHAT THE BAR DOES NOT READ, and the PASS line says so in numbers: whether the watch SAVES the man. Both bars read what the rule writes (the order's
// watch point); a watcher who does no good moves a death from 'nobody's door' to 'somebody's'. The rows print every death through a taken room's other
// door, whoever's it was, for both arms — read those, over a long count (--on-json / --off-json), for the outcome. Nor does it read whether the watch is
// KEPT after that one look a second in, nor the two doors the fault was found on by name.
// (Where the bar was read, windows of 12 seeds: the tree the rule was built on, 144 seeds a map — the share 7 to 36 points higher on the warehouse, 19 and
//  up on the compound, dealt 53 % of such doors at the least, the room's deaths 20 against 168 and 1 against 5; the build at c3fa7069 under the shipped
//  profile, 48 seeds a map — numbers and files in rebuild/missions/fixes/other-door.md in the project files. Fewer than 12 seeds a map is seed luck:
//  on the first tree's runs a random 6 seeds fail a bar about one time in thirty-five, 12 about one in three hundred.)
// THE PAIR STAGING (after the play-throughs, in this process): an entry of TWO keeps both its guns on the room until its floor is looked over. The office's
// break room behind a charge on its west door, a floor already alerted (doortools-probes.ts's own rig, the first-man probe's staging), each seed twice — the
// rule as shipped and the rule at 0. It FAILS when a man of the pair is dealt a door before the entry's 'in' (the fault as first built: the first man through,
// turned to the north door a second after he crossed, was shot by a man of the room the charge had only stunned), when more first men are lost with the rule
// than without it up to six seconds after the entry ended (that part reads the doors dealt AT 'in': before it the two arms are the same game), when the rule at 0
// deals anything, when a seed gives no entry, or when no door of that room is dealt after 'in' at all (the staging looked at nothing). `--pair 1,2,3` picks its
// seeds (a comma list, no ranges), `--pair 0` skips it — and the PASS line then says so.
//   --off      the red path: the arm at 0 is read as the rule's arm too (the rule against itself). The check is expected to FAIL (exit 1) on the two
//              per-scenario bars — nothing dealt, the share no higher — which is the proof that it can; failing for any other reason is said apart
//   --on-json / --off-json   read earlier play-throughs (ships.ts --json files, comma lists; both wanted) instead of playing: a long count read against
//              the same bar. Only seeds present in BOTH arms of a scenario are read (a seed twice in an arm: its last row); `--seeds` beside them
//              picks among those, and the head line says how many of the seeds asked for were there
// exit 0 = every bar above held on every scenario asked for · 1 = a bar failed, a run errored, or a scenario took no room with another door nobody had
// been beyond (NO VERDICT: the check looked at nothing) · 2 = bad flags, a file that cannot be read. A run that STALLED (the scripted commander stuck: the
// play-through's own red) is read like any other and counted on its scenario's row — it is not this check's to fail
import { resolve } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const VALUE = ['--scn', '--seeds', '--cap', '--jobs', '--pair', '--on-json', '--off-json'], BARE = ['--off'];
const argv = process.argv.slice(2), given = new Map<string, string>();
for (let i = 0; i < argv.length; i++) { const a = argv[i];
  if (BARE.includes(a)) { given.set(a, ''); continue; }
  if (!VALUE.includes(a)) { console.error(`unknown ${a.startsWith('--') ? 'flag' : 'word'} ${a} (${[...VALUE, ...BARE].join(' ')})`); process.exit(2); }
  const v = argv[++i]; if (v === undefined || v.startsWith('--')) { console.error(`${a} wants a value${a === '--pair' ? ' (seeds, comma separated; 0 skips the pair staging)' : ''}`); process.exit(2); }
  given.set(a, v); }
const flag = (n: string) => given.get(n);
const scn = flag('--scn') ?? 'warehouse-four,compound-four', cap = flag('--cap') ?? '420', jobs = flag('--jobs') ?? '4', off = given.has('--off'), seeds = flag('--seeds') ?? '1-12';
const scns = [...new Set(scn.split(',').filter(Boolean))]; if (!scns.length) { console.error('bad --scn'); process.exit(2); }
if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(seeds)) { console.error('bad --seeds'); process.exit(2); }
if (!/^\d+$/.test(cap) || !/^\d+$/.test(jobs)) { console.error('bad --cap / --jobs (whole numbers)'); process.exit(2); }
const pairArg = flag('--pair') ?? '1,2,3,4,5,6'; if (!/^\d+(,\d+)*$/.test(pairArg)) { console.error('bad --pair (seeds, comma separated; 0 skips the pair staging)'); process.exit(2); }
const pairSeeds = pairArg.split(',').map(Number).filter(n => n > 0);
const onJson = flag('--on-json'), offJson = flag('--off-json');
if (!!onJson !== !!offJson) { console.error('--on-json and --off-json come together, each with its files (comma separated)'); process.exit(2); }
if (onJson && off) { console.error('--off plays its own arm: not with --on-json / --off-json'); process.exit(2); }

interface Other { door: string; entry: string; held: number; watchers: string[]; now: string[] }
interface Death { t: number; who: string; by: string; d: number; off: number; order?: string; door?: string | null; thru?: string | null; came?: string | null; other?: Other | null }
interface Run { scn: string; seed: number; end: string; why: string; deaths?: Death[]; other?: { rooms: number; doors: number; watched: number; dealt?: number } }
const RULE0 = '{"DOORTOOLS":{"otherDoorM":0}}';
/** the bar: the watched share must be this much higher with the rule · the rule must deal this share of such doors · the room's deaths with the rule may exceed those at 0 by this many */
const SHARE = 0.05, DEALT = 0.25, WORSE = 2;
let lastErr = '';
/** one arm played: every scenario × seed through ships.ts as the page ships it (`zero`: with the rule at 0) */
const playArm = async (zero: boolean): Promise<Run[]> => {
  const file = resolve(tmpdir(), `other-door-check-${process.pid}-${zero ? 'off' : 'on'}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--scn', scns.join(','), '--seeds', seeds, '--cap', cap, '--jobs', jobs, '--json', file, ...(zero ? ['--set', RULE0] : [])], { stdout: 'ignore', stderr: 'pipe' });
  const err = await new Response(pr.stderr).text(), code = await pr.exited; if (err.trim()) lastErr = err.trim().split('\n').pop()!.slice(0, 160);
  if (code === 2) { console.error(err.trim() || 'ships.ts refused its flags'); process.exit(2); }
  try { return JSON.parse(readFileSync(file, 'utf8')).runs; } catch { return []; } finally { try { rmSync(file); } catch { /* not there */ } }
};
// (files read: every run of theirs — or, `--seeds` given beside them, those seeds only)
const seedSet = new Set(seeds.split(',').flatMap(x => { const [a, b = a] = x.split('-').map(Number); return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i); })), want = flag('--seeds') === undefined ? null : seedSet;
/** one row a scenario × seed (a seed twice in an arm's files: its last row) */
const once = (R: Run[]): Run[] => [...new Map(R.map(r => [`${r.scn}:${r.seed}`, r])).values()];
const read = (list: string): Run[] => list.split(',').flatMap(f => { try { return (JSON.parse(readFileSync(f, 'utf8')).runs as Run[]).filter(r => !want || want.has(r.seed)); } catch { console.error(`cannot read ${f}`); process.exit(2); } });
// (the two arms one after the other: each already plays --jobs runs at once)
const runs0 = once(onJson ? read(offJson!) : await playArm(true)), runs1 = onJson ? once(read(onJson)) : off ? runs0 : once(await playArm(false));

console.log(`other-door-check · ${scns.join(',')} · ${onJson ? `read from ${onJson} against ${offJson}${want ? ` · seeds ${seeds}` : ''}` : `seeds ${seeds}`} · the rule ${off ? 'at 0 read as BOTH arms (the red path)' : 'as shipped, against the rule at 0'}`);
let failed = false, barred = 0, other = 0; const passed: string[] = [];   // (barred: the per-scenario bars that failed · other: every other failure)
// (Death.order opens with his assignment's order, Death.door is the phase of a door order still under way for him: an entry order's word with no order
//  under way, or one in its 'enter', is the entry that took this room — its men holding it, or still going in; the same word under a stack / a charge being
//  set is the NEXT door's order, given while he stood here)
const ENTRY = /^(openClear|bangClear|charge|threshold)/, own = (d: Death) => ENTRY.test(d.order ?? '') && (d.door == null || d.door === 'enter');
const p1 = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)} %` : 'none';
const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : 'none';
/** one arm of one scenario, over the seeds both arms played */
const tally = (mine: Run[], arm: string) => { const T = { played: 0, stalled: 0, rooms: 0, doors: 0, watched: 0, dealt: 0, deaths: 0, thru: 0, held: 0, room: 0, known: 0, moved: 0, lines: [] as string[] };
  for (const r of mine) {
    if (r.end === 'error') { failed = true; other++; console.log(`- FAIL — ${r.scn}:${r.seed} (${arm}) did not play (${r.why.split('\n')[0].slice(0, 160)})`); continue; }
    T.played++; if (r.end === 'stalled') T.stalled++; T.rooms += r.other?.rooms ?? 0; T.doors += r.other?.doors ?? 0; T.watched += r.other?.watched ?? 0; T.dealt += r.other?.dealt ?? 0;
    for (const d of r.deaths ?? []) { T.deaths++; const o = d.other; if (!o) continue; T.thru++;
      if (o.watchers.length) { T.held++; continue; }
      const stay = own(d), known = stay && d.thru !== `door:${o.door}` && d.came !== `door:${o.door}`;
      if (!stay) T.moved++; else { T.room++; if (known) T.known++; }
      T.lines.push(`${r.scn}:${r.seed} @ ${d.t} s · ${d.who} dropped in the room taken by ${o.entry} (${o.held} s after he crossed), by ${d.by} ${d.d} m off through ${o.door} · nobody's order had a gun on ${o.door} · ${!stay ? `moved on (${(d.order ?? '?').split(' · ')[0]}${ENTRY.test(d.order ?? '') ? `, ${d.door}` : ''})` : known ? 'the room\'s, a door the squad had been beyond' : 'the room\'s'}`); } }
  return T; };
let room1 = 0, room0 = 0, thru1 = 0, thru0 = 0;
if (!runs1.length || !runs0.length) { failed = true; other++; console.log(`- FAIL — nothing ${onJson ? 'read' : 'played'} ${[!runs1.length && !off ? 'with the rule' : '', !runs0.length ? 'with the rule at 0' : ''].filter(Boolean).join(', nor ')}${onJson ? '' : ` (the play-through's last line: ${lastErr || 'none'})`}`); }
// each scenario is its own verdict: one map's rooms never stand in for another's
else for (const id of scns) {
  const s0 = new Set(runs0.filter(r => r.scn === id).map(r => r.seed)), both = new Set(runs1.filter(r => r.scn === id && s0.has(r.seed)).map(r => r.seed));
  const A = tally(runs1.filter(r => r.scn === id && both.has(r.seed)), 'the rule'), B = off ? A : tally(runs0.filter(r => r.scn === id && both.has(r.seed)), 'the rule at 0');
  if (want && both.size < want.size) console.log(`  ${id}: ${both.size} of the ${want.size} seeds asked for were in both arms`);
  const row = (T: typeof A, name: string) => console.log(`  ${id} · ${name}: ${T.played} runs${T.stalled ? ` (${T.stalled} stalled)` : ''} · ${T.rooms} rooms taken and held, ${T.doors} other doors of theirs nobody had been beyond: ${T.watched} (${pct(T.watched, T.doors)}) with a gun on them a second after the entry, ${T.dealt} dealt by the rule · ${T.deaths} teammates lost, ${T.thru} through a taken room's other door: ${T.held} with it somebody's, ${T.room} the room's with it nobody's (${T.known} of them a door the squad had been beyond), ${T.moved} moved on`);
  row(A, off ? 'the rule at 0' : 'the rule'); if (!off) row(B, 'the rule at 0');
  for (const l of A.lines) console.log(`    · ${l}`);
  room1 += A.room; room0 += B.room; thru1 += A.thru; thru0 += B.thru;
  const bad: string[] = [], bars: string[] = [];   // (bars: the two the red path must trip)
  if (!A.played || !B.played) bad.push(`- FAIL — ${id}: nothing played in both arms`);
  else if (!A.doors || !B.doors) bad.push(`- NO VERDICT — ${id}: no room with another door nobody had been beyond was taken and held: the check looked at nothing`);
  else {
    if (A.dealt < DEALT * A.doors) bars.push(`- FAIL — ${id}: ${A.doors} such doors and the rule dealt a man to ${A.dealt ? `${A.dealt} of them (${p1(A.dealt, A.doors)}; a quarter wanted): it is mostly not running` : 'none of them: it is not running (a pass here would be luck)'}`);
    if (!off && B.dealt) bad.push(`- FAIL — ${id}: the rule at 0 still dealt ${B.dealt} doors: the switch did not reach the game, and the comparison is the rule against itself`);
    if (A.watched / A.doors < B.watched / B.doors + SHARE) bars.push(`- FAIL — ${id}: such doors with a gun on them a second after the entry: ${p1(A.watched, A.doors)} with the rule, ${p1(B.watched, B.doors)} at 0 — not ${Math.round(SHARE * 100)} points higher`);
  }
  for (const b of [...bad, ...bars]) console.log(b);
  barred += bars.length; other += bad.length;
  if (bad.length + bars.length) failed = true; else passed.push(`${id} (${A.doors} such doors, ${pct(A.dealt, A.doors)} dealt, ${pct(A.watched, A.doors)} watched against ${pct(B.watched, B.doors)} at 0; the room's deaths ${A.room} against ${B.room})`);
}
if (runs1.length && runs0.length && room1 > room0 + WORSE) { failed = true; other++; console.log(`- FAIL — men holding a taken room lost through a door of it nobody's order was on: ${room1} with the rule, ${room0} at 0 over ${scns.join(',')} — more than ${WORSE} more with it`); }
// ---------------------------------------------------------------- the pair staging
const before = failed; failed = false;
if (pairSeeds.length) {
  const { rig } = await import('./doortools-probes.ts');
  const f1 = (x: number) => x.toFixed(1);
  /** the break room behind a charge, a pair, the floor alerted: who was dealt a door and when against the entry's 'in', and whether the first man through is still up */
  const play = async (knob: number | null) => { const out = { n: 0, first: 0, dealt: 0, early: [] as string[], noIn: 0, refused: [] as number[] };
    for (const seed of pairSeeds) { const R: any = await rig(seed, { door: 'breakroom_w', hot: true, ...(knob === null ? {} : { knobs: { otherDoorM: knob } }) }); const D = R.D;
      R.give('charge', 'breakroom_w'); const op = D.ops[0]; if (!op) { out.refused.push(seed); continue; }
      for (let i = 0; i < 60 * 45 && D.ops.length; i++) { R.step(); if (op.phase === 'armed') R.press('KeyF'); }
      R.step(60 * 6); out.n++;
      const tIn = op.beats.find((b: any) => b.what === 'in')?.t, deals = op.beats.filter((b: any) => /^other door · .+ on /.test(b.what)); if (tIn === undefined) out.noIn++;
      out.dealt += deals.length;
      for (const b of deals) if (tIn === undefined || b.t < tIn) out.early.push(`seed ${seed}: ${b.what.replace('other door · ', '')} at ${f1(b.t - R.t0)} s, ${tIn === undefined ? 'and the entry never called the room' : `${f1(tIn - b.t)} s before the room was called`}`);
      const first = op.crossed.size ? [...op.crossed.entries()].sort((a: any, b: any) => a[1] - b[1])[0][0] : op.lead; if (first.state === 'dead') out.first++; }
    return out; };
  const base = await play(0), on = off ? base : await play(null);
  console.log(`  pair (office break room, a charge on its west door, floor alerted, seeds ${pairSeeds.join(' ')}): ${on.n} entries · ${on.dealt} doors dealt, ${on.early.length} of them before the room was called · ${on.n - on.noIn} rooms called · first man through lost ${on.first}/${on.n}${off ? '' : ` (rule at 0: ${base.first}/${base.n}, ${base.dealt} doors dealt)`}`);
  const refused = [...new Set([...on.refused, ...base.refused])];
  if (refused.length || !on.n) { failed = true; console.log(`- FAIL — pair: the staging gave no entry${refused.length ? ` on seed ${refused.join(', ')}` : ''}`); }
  else if (!off && base.dealt) { failed = true; console.log(`- FAIL — pair: the rule at 0 still dealt ${base.dealt} doors: the knob did not reach the game, and the comparison below would be the rule against itself`); }
  else if (off) { if (on.dealt) { failed = true; console.log(`- FAIL — pair: --off, and the rule still dealt ${on.dealt} doors`); } else console.log('  pair: nothing dealt with the rule off (the pair fault was the rule\'s own: there is nothing of it to reproduce here)'); }
  else {
    for (const e of on.early) console.log(`- FAIL — pair: a man of an entry of two taken off the room mid-search · ${e}`);
    if (on.early.length) failed = true;
    if (on.first > base.first) { failed = true; console.log(`- FAIL — pair: more first men lost with the rule (${on.first}/${on.n}) than without it (${base.first}/${base.n}), up to six seconds after the entry ended`); }
    if (!on.dealt) { failed = true; console.log('- NO VERDICT — pair: no door of the room was dealt at all, before or after the room was called: the staging looked at nothing'); }
    if (!on.early.length && on.first <= base.first && on.dealt) passed.push(`the pair (${on.dealt} doors dealt, all after the room was called; first man lost ${on.first}/${on.n} against ${base.first}/${base.n} with the rule at 0)`);
  }
}
if (failed) other++; failed ||= before;
if (off) console.log(barred && !other ? `  the red path: the rule at 0 against itself FAILED its ${barred} per-scenario bars, as it must (exit 1 is the expected answer here)` : barred ? `  the red path: ${barred} per-scenario bars failed as they must — and something else failed with them (above): read that first` : '  the red path did NOT fail on the bars: no proof here that the check can (what failed, if anything, is above)');
if (!failed) console.log(`- PASS — with the rule a taken room's other doors are dealt and more of them are watched, and the men holding one who were lost through a door nobody's order was on are not over ${WORSE} more than at 0 (${room1} against ${room0})${pairSeeds.length ? '; no man of a pair was taken off the room mid-search' : ' (the pair staging was skipped: --pair 0)'}: ${passed.join(' · ')} · NOT barred on, for the reader: men lost through a taken room's other door, whoever's it was, ${thru1} with the rule against ${thru0} at 0`);
process.exit(failed ? 1 : 0);
