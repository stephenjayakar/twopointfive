// The 'doorpath' family: EACH MAN OF A ROOM ENTRY WALKS A REAL PATH THROUGH THE DOOR (src/game/doorpath.ts DOORPATH; on in the page — ?nodoorpath is the entry as it was —, TPS_DOORPATH=1 in the harness).
// The checks are made on whole seeded playthroughs (tools/qa/playthrough.ts — the scripted commander, the real door orders, the real fight), each watched by
// tools/qa/paths-watch.ts on every frame of every room entry:
//   doorpath-paths   with the switch ON, over the seeded runs below: no man of an entry in a door leaf (and no leaf swept through one), none through a
//                    friend, no two on one spot (centres under 0.45 m for over 0.3 s), none in a jamb or any other static — and the walk was really used (men sent on it, most of them walked it out)
//   doorpath-gun     with the switch ON AND ITS GUN RULE ON (TPS_DOORPATH=1,gun=1 — the rule ships off: doorpath.ts says why): no man of an entry carries his rifle, or shines his weapon light, through a door leaf — each its own line. A spell
//                    of `GUN_SECS` or longer fails; a shorter brush (a muzzle swung past a leaf's edge) is listed, not failed
//   doorpath-file    with the switch ON: the men cross the frame line one at a time in the order dealt (nobody crosses while a man dealt ahead of him is
//                    still outside; nobody is dealt ahead of a man who stood well nearer the frame AT HIS OWN JAMB), no two nearer than a body apart
//                    as they cross, and nobody is kept waiting past the cap. The order dealt is the entry's own queue, kept by the watcher from the
//                    frame it is dealt; until 10-13 it was guessed from who stood nearer the frame at the go, whichever jamb he stood at — which a
//                    stack split unevenly round a door breaks by the deal alone (the rebuilt barracks' s1: the two sides go in turn about, the far
//                    side's man stands 0.86 m further off and is dealt second). That crossing is listed, not failed. ITS RED PATH:
//                    `DOORPATH_FILE_BREAK=1` preloads tools/qa/doorpath-backward.ts (the walk lets each entry go back to front) and must FAIL on
//                    the order line, with a "red path" line that must PASS
//   doorpath-off     with the switch OFF nothing of the walk is in the run: each run ends the same way and digests the same as the same run with
//                    tools/qa/doorpath-inert.ts preloaded in front of it (every method of the walk throwing but its three per-frame entries, which
//                    are emptied; every knob but `on` set to nonsense), and each of the runs sends men through a door — three runs on the harness's
//                    frozen stand and three on the stand the page ships (TPS_PROFILE=shipped), the walk pinned off on both; all of DOORPATH_RUNS
//                    with DOORPATH_ALL=1. THE TREE IS COMPARED WITH ITSELF, so play moving on for any other reason never turns it red (it read
//                    frozen digests until 10-13: ordinary merges after the last freeze had moved them, at least six times, and it had been red
//                    for two days with the walk not in it). ITS RED PATHS, each must FAIL: `DOORPATH_OFF_BREAK=1` the walk on in both runs (the
//                    preloaded one dies on its first frame) · `=2` the walk switched on behind the pin in the preloaded run alone (the two runs
//                    end, and digest apart) · `=3` the walk on in both and only the knobs set to nonsense in the second (the nonsense is read) — and each
//                    says, in a "red path" line that must PASS, that it went red for that reason and not for a preload that fell over.
//                    WHAT IT DOES NOT SHOW: that off = the build before the module (taken once, 48 runs of 48 against 4b510dd, when the walk went
//                    in), nor an edit to the entry's own switched-off branch (doortools.ts, the `: t < q.at` arm of the queue) — that changes both
//                    runs alike and is the door tools' checks to catch. A recorded digest would show both, and is what went stale
// THE FAMILY'S OWN RED PATH: `DOORPATH_OLD=1 bun run tools/qa/probes.ts doorpath-paths` (and `… doorpath-gun`) runs the same check on the entry AS IT WAS (the
// switch off) and must FAIL — on the build this was written against a door leaf goes through a man of the entry in every one of these runs, and a rifle and
// its light through the server room's leaf in the first (room-clear-four seed 1, 22 s: the still the cast goal's clip caught). doorpath-file and doorpath-off
// have red paths of their own (DOORPATH_FILE_BREAK, DOORPATH_OFF_BREAK: above).
// `PT_NOCLOSER=1` in front of any of them: no door shuts itself — the leaves an entry meets once doors stay open.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
/** the seeded runs: pairs and fours, a kicked door and a bang, the office and the built levels — each one reaches a room entry on both stands (the depot's
 *  seed 2 was here until 10-13: on the depot as rebuilt its scripted four is wiped in the yard before any door, as that floor means it to be) */
export const DOORPATH_RUNS = ['room-clear-four:1', 'room-clear-pair:1', 'hostage-rescue:1', 'depot-four:1', 'records-pair:1', 'barracks-four:1'];
/** a rifle or a light through a leaf this long is a failure (seconds; the runs step at 60 Hz) */
export const GUN_SECS = 0.2;

function check(title: string) {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const memo = new Map<string, Promise<any>>();
/** one seeded playthrough in a process of its own (the tables it sets are that process's), its JSON back */
function runOne(spec: string, env: Record<string, string>, pre = ''): Promise<any> {
  const key = spec + '|' + JSON.stringify(env) + (pre && '|' + pre); let p = memo.get(key);
  if (!p) { p = (async () => { const f = `${tmpdir()}/doorpath-${process.pid}-${memo.size}.json`, E: Record<string, string> = { ...(process.env as any), PT_DIGEST: '1', ...env };
      for (const k of ['TPS_DOORPATH', 'TPS_CAST', 'TPS_MOVES', 'TPS_TURN', 'PT_PATHS', 'DOORPATH_INERT']) if (!(k in env)) delete E[k];
      if (!('PT_PATHS' in env)) delete E.PT_NOCLOSER;   // (the digests are the runs as they were: doors shut themselves)
      const pr = Bun.spawn(['bun', 'run', ...(pre ? ['--preload', pre] : []), `${ROOT}/tools/qa/playthrough.ts`, '--one', spec, '--out', f], { env: E, stdout: 'ignore', stderr: 'pipe' });
      if (await pr.exited !== 0 || !existsSync(f)) throw new Error(`${spec}: the run did not finish — ${await new Response(pr.stderr).text()}`);
      const out = JSON.parse(readFileSync(f, 'utf8')); rmSync(f, { force: true }); return out; })(); memo.set(key, p); }
  return p;
}
type Job = [spec: string, env: Record<string, string>, pre?: string];
/** a list of runs, four at a time (`soft`: a run that did not finish comes back as { error } in its place) */
async function runJobs(jobs: Job[], soft = false): Promise<any[]> {
  const out: any[] = new Array(jobs.length); let next = 0;
  await Promise.all([0, 1, 2, 3].map(async () => { while (next < jobs.length) { const i = next++; out[i] = await runOne(...jobs[i]).catch(e => { if (!soft) throw e; return { error: String(e?.message ?? e) }; }); } }));
  return out;
}
const OLD = () => !!process.env.DOORPATH_OLD;
const watched = (knobs = '', pre = '') => runJobs(DOORPATH_RUNS.map((s): Job => [s, { PT_PATHS: '1', ...(OLD() ? {} : { TPS_DOORPATH: '1' + knobs }) }, pre]));

export async function doorpathPaths(): Promise<boolean> {
  const C = check(`doorpath-paths: nobody of a room entry in a leaf, through a friend or in a jamb — ${OLD() ? 'THE ENTRY AS IT WAS (DOORPATH_OLD: this must fail)' : 'the switch on'}`);
  const R = await watched();
  for (const kind of ['leaf', 'friend', 'near', 'jamb'] as const) {
    const bad = R.flatMap(r => (r.paths.spells as any[]).filter(s => s.kind === kind).map(s => `${r.scn}:${r.seed} ${s.who} ${kind === 'leaf' ? `${s.swept ? 'swept by' : 'in'} the leaf of ${s.what}` : kind === 'friend' ? `through ${s.what}` : kind === 'near' ? `on one spot with ${s.what}` : `in a static at ${s.what}`} at ${s.t0} s (${s.frames} frames)`));
    C.verdict(bad.length === 0, kind === 'leaf' ? 'no man of an entry stands in a door leaf, and no leaf goes through one' : kind === 'friend' ? 'no man of an entry stands through a friend' : kind === 'near' ? 'no two living men stand on one spot during an entry (centres under 0.45 m for over 0.3 s; a teammate and a teammate, or a defender)' : 'no man of an entry stands in a jamb, a wall or furniture',
      bad.length ? `${bad.length}: ${bad.slice(0, 6).join(' · ')}${bad.length > 6 ? ' · …' : ''}` : `${R.reduce((a, r) => a + r.paths.entries, 0)} entries, ${R.reduce((a, r) => a + r.paths.frames, 0)} man-frames watched over ${R.length} runs`);
  }
  { const B = R.flatMap(r => (r.paths.spells as any[]).filter(s => s.kind === 'body').map(s => `${r.scn}:${r.seed} ${s.who} on ${s.what} at ${s.t0} s`));
    console.log(`- (listed, not judged) a man of an entry standing on a fallen defender for over 0.3 s: ${B.length}${B.length ? ` — ${B.slice(0, 4).join(' · ')}${B.length > 4 ? ' · …' : ''}` : ''}`); }
  for (const kind of ['rifle', 'light'] as const) { const n = R.reduce((a, r) => a + (r.paths.spells as any[]).filter(s => s.kind === kind && s.frames / 60 >= GUN_SECS).length, 0);
    console.log(`- (listed, not judged here — the gun rule ships off; doorpath-gun judges it with the rule on) a ${kind === 'rifle' ? 'rifle' : 'burning weapon light'} through a door leaf for ${GUN_SECS} s or more: ${n}`); }
  if (!OLD()) { const sent = R.reduce((a, r) => a + (r.doorpath?.sent ?? 0), 0), walked = R.reduce((a, r) => a + (r.doorpath?.walked ?? 0), 0), gave = R.reduce((a, r) => a + (r.doorpath?.gaveUp ?? 0), 0);
    C.verdict(sent > 0 && walked >= sent * 0.6, 'the walk is what carried them: men were sent on it and most walked it out', `sent ${sent}, walked to the point ${walked}, handed back to the nav ${gave}, taken by the fight ${R.reduce((a, r) => a + (r.doorpath?.taken ?? 0), 0)}, no way round a leaf ${R.reduce((a, r) => a + (r.doorpath?.noRound ?? 0), 0)}`); }
  return C.done();
}

export async function doorpathGun(): Promise<boolean> {
  const C = check(`doorpath-gun: no rifle carried, no weapon light shone, through a door leaf — ${OLD() ? 'THE ENTRY AS IT WAS (DOORPATH_OLD: this must fail)' : 'the switch on WITH ITS GUN RULE (TPS_DOORPATH=1,gun=1: the rule ships off)'}`);
  const R = await watched(',gun=1'), secs = (s: any) => s.frames / 60;   // (the frames he was in it: the runs step at 60 Hz)
  for (const kind of ['rifle', 'light'] as const) {
    const all = R.flatMap(r => (r.paths.spells as any[]).filter(s => s.kind === kind).map(s => ({ ...s, run: `${r.scn}:${r.seed}` }))), bad = all.filter(s => secs(s) >= GUN_SECS);
    const row = (s: any) => `${s.run} ${s.who} through the leaf of ${s.what} at ${s.t0} s for ${secs(s).toFixed(2)} s, ${kind === 'rifle' ? 'muzzle' : 'lens'} ${s.worst} m beyond`;
    C.verdict(bad.length === 0, kind === 'rifle' ? `no man of an entry has his rifle through a door leaf for ${GUN_SECS} s` : `no man of an entry has his burning weapon light through a door leaf for ${GUN_SECS} s`,
      bad.length ? `${bad.length}: ${bad.slice(0, 6).map(row).join(' · ')}${bad.length > 6 ? ' · …' : ''}` : `${all.length} shorter brush${all.length === 1 ? '' : 'es'}${all.length ? ` (${all.slice(0, 4).map(row).join(' · ')})` : ''} over ${R.reduce((a, r) => a + r.paths.entries, 0)} entries`);
  }
  if (!OLD()) C.verdict(R.some(r => (r.doorpath?.gunS ?? 0) + (r.doorpath?.gunAhead ?? 0) > 0), 'the rule is what did it: guns were lowered, or carried along the walk, at a leaf', R.map(r => `${r.scn}:${r.seed} down ${(r.doorpath?.gunS ?? 0).toFixed(1)} s, along the walk ${(r.doorpath?.gunAhead ?? 0).toFixed(1)} s`).join(' · '));
  return C.done();
}

export async function doorpathFile(): Promise<boolean> {
  const word = process.env.DOORPATH_FILE_BREAK ?? '', brk = word === '1';
  if (!['', '0', '1'].includes(word) || brk && OLD()) throw new Error(`DOORPATH_FILE_BREAK='${word}' not understood: 1 (and not with DOORPATH_OLD: the old entry never asks the walk)`);
  const C = check('doorpath-file: the men go in one at a time, in the order dealt, a body apart');
  if (brk) console.log('  DOORPATH_FILE_BREAK=1: the walk lets every entry go back to front — the "dealt ahead of him" line below must FAIL and the "red path" line must PASS');
  const R = await watched('', brk ? `${ROOT}/tools/qa/doorpath-backward.ts` : '');
  const cross = R.flatMap(r => (r.paths.cross as any[]).map(c => ({ ...c, run: `${r.scn}:${r.seed}` }))), said = (c: any) => `${c.run} ${c.who} at ${c.door}, ${c.t} s`;
  const unread = cross.filter(c => !(c.turn >= 0)), jumped = cross.filter(c => c.jumped), own = cross.filter(c => c.far === 'own'), other = cross.filter(c => c.far === 'other' && !c.jumped);
  const close = cross.filter(c => c.gapM !== null && c.gapM < 0.6), gaps = cross.filter(c => c.gapS !== null && c.gapS < 6).map(c => c.gapS as number).sort((a, b) => a - b);
  C.verdict(cross.length > 0 && unread.length === 0, 'the order dealt was read for every man who crossed', unread.length ? unread.map(said).join(' · ') : `${cross.length} crossings`);
  C.verdict(jumped.length === 0, 'nobody crosses the frame line while a man dealt ahead of him is still outside', jumped.length ? jumped.map(said).join(' · ') : 'none');
  C.verdict(own.length === 0, 'nobody is dealt ahead of a man who stood well nearer the frame at his own jamb', own.length ? own.map(said).join(' · ')
    : other.length ? `listed, not failed — dealt ahead of a man who stood over half a metre nearer at the OTHER jamb (the two sides go in turn about): ${other.map(said).join(' · ')}` : 'none, at either jamb');
  if (brk) C.verdict(jumped.length > 0 && unread.length === 0, 'the red path: let go back to front, men read as crossing out of turn', `${jumped.length} of ${cross.length} crossings`);
  C.verdict(close.length === 0, 'no two men nearer than 0.6 m as the second crosses the frame line', close.length ? close.map(c => `${c.run} ${c.who} ${c.gapM} m behind at ${c.t} s`).join(' · ') : `gaps between men of one entry: median ${gaps[gaps.length >> 1]} s, least ${gaps[0]} s, most ${gaps[gaps.length - 1]} s`);
  if (!OLD()) C.verdict(R.every(r => (r.doorpath?.capped ?? 0) === 0), 'nobody was held short for the whole cap', R.map(r => `${r.scn}:${r.seed} held ${(r.doorpath?.heldS ?? 0).toFixed(1)} s, let go late ${r.doorpath?.late ?? 0}`).join(' · '));
  return C.done();
}

/** the walk taken out of a process: preloaded in front of the second run of each pair */
const INERT = `${ROOT}/tools/qa/doorpath-inert.ts`;
/** the short list: a four in the office, a four on a built level, the rescue (each sends men through a door on both stands — asserted below) */
const OFF_RUNS = DOORPATH_RUNS.filter(s => /^(room-clear-four|depot-four|hostage-rescue):/.test(s));
const OFF_ARMS: [string, Record<string, string>][] = [["the harness's frozen stand", { TPS_PROFILE: 'frozen' }], ['the stand the page ships', { TPS_PROFILE: 'shipped' }]];
const OUT = 'with the walk taken out of the process and its knobs set to nonsense';
/** DOORPATH_OFF_BREAK: what each red path pins the walk to in both runs, what it tells the preload to do in the second, and what that second run then is */
const OFF_BREAKS: Record<string, [pin: string, inert: string, second: string]> = { '': ['0', '', OUT], '0': ['0', '', OUT], '1': ['1', '', OUT],
  '2': ['0', 'leak', 'with the walk switched on behind the pin'], '3': ['1', 'scramble', 'with the walk on and its knobs alone set to nonsense'] };

export async function doorpathOff(): Promise<boolean> {
  const C = check('doorpath-off: with the switch off nothing of the walk is in the run');
  const word = process.env.DOORPATH_OFF_BREAK ?? '';
  if (!Object.hasOwn(OFF_BREAKS, word)) throw new Error(`DOORPATH_OFF_BREAK='${word}' not understood: 1 | 2 | 3`);
  const [on, inert, second] = OFF_BREAKS[word], red = on !== '0' || !!inert;
  const specs = process.env.DOORPATH_ALL === '1' ? DOORPATH_RUNS : OFF_RUNS, pin = { TPS_DOORPATH: on }, pre: Record<string, string> = inert ? { DOORPATH_INERT: inert } : {};
  if (red) console.log(`  DOORPATH_OFF_BREAK=${word}: every "end and digest the same" line below must FAIL, and every "red path" line must PASS`);
  C.verdict(OFF_RUNS.length === 3, 'the short list is three of the family\'s runs: a four in the office, a four on a built level, the rescue', OFF_RUNS.join(', ') || 'none of them is in DOORPATH_RUNS');
  // the preload evaluates doorpath.ts ahead of every other game module: sound only while that file brings in no other game module's values
  const src = readFileSync(`${ROOT}/src/game/doorpath.ts`, 'utf8'), value: string[] = []; let types = 0, outside = 0;
  for (const m of src.matchAll(/^(?:import\s*(?:(type\s)?([^'";]*?)\sfrom\s*)?|export\s+(type\s)?(?:\*|\{[^}]*\})[^'";]*?\sfrom\s*)['"]([^'"]+)['"]/gm)) {
    const names = /^\{([^}]*)\}$/.exec((m[2] ?? '').trim())?.[1].split(',').map(n => n.trim()).filter(Boolean);
    if (m[1] || m[3] || names?.length && names.every(n => /^type\s/.test(n))) types++;
    else if (new URL(m[4], 'file:///src/game/doorpath.ts').pathname.startsWith('/src/game/')) value.push(m[0].replace(/\s+/g, ' '));
    else outside++;
  }
  if (/\bimport\s*\(/.test(src)) value.push('an import() call');
  C.verdict(value.length === 0, 'src/game/doorpath.ts brings in no other game module but for its types (the preload may evaluate it first)',
    value.length ? value.join(' · ') : `${types} imports of types${outside ? `, ${outside} of values from outside src/game (not followed)` : ''}`);
  // every run of both stands, plain and with the walk out, through the one pool
  const R = await runJobs(OFF_ARMS.flatMap(([, env]) => specs.flatMap((s): Job[] => [[s, { ...env, ...pin }], [s, { ...env, ...pin, ...pre }, INERT]])), true);
  /** a run that never started says why on bun's `error:` line (the lines before it are the source frame) */
  const died = (e: unknown) => { const l = String(e).split('\n'); return (l.find(x => /^error:/.test(x)) ?? l[0]).slice(0, 200); };
  const said = (r: any) => r.error ? `did not finish (${died(r.error)})` : `${r.end} at ${Number(r.t).toFixed(1)} s, ${r.digest || 'no digest'}${r.end === 'error' ? ` (${String(r.why).split('\n')[0].slice(0, 160)})` : ''}`;
  OFF_ARMS.forEach(([name], a) => {
    const at = (i: number) => [R[(a * specs.length + i) * 2], R[(a * specs.length + i) * 2 + 1]];
    const ended = (r: any) => !r.error && r.end !== 'error' && !!r.digest;
    const same = (i: number) => { const [p, q] = at(i); return ended(p) && ended(q) && p.end === q.end && p.digest === q.digest; };
    const bad = specs.filter((_, i) => !same(i)), idle = specs.filter((_, i) => !(at(i)[0].entry?.pods > 0));
    C.verdict(bad.length === 0, `${specs.length} runs on ${name} end and digest the same ${second}`,
      bad.length ? bad.map(s => { const [p, q] = at(specs.indexOf(s)); return `${s}: ${said(p)} as it is; ${said(q)} ${inert ? second : 'with the walk out'}`; }).join(' · ') : specs.map((s, i) => `${s} ${at(i)[0].digest}`).join(', '));
    C.verdict(idle.length === 0, `each of them sends men through a door on ${name} (the walk would have had a say)`,
      specs.map((s, i) => { const p = at(i)[0]; return `${s} ${p.error ? 'did not finish' : `${p.entry?.pods ?? 0} places dealt inside`}`; }).join(', '));
    // a red path is red for ITS reason: the take-out stopping a walk that is on, or two whole runs on digests apart — never a preload that fell over
    if (red) { const why = (i: number) => { const [p, q] = at(i); return inert ? ended(p) && ended(q) && p.digest !== q.digest : ended(p) && q.end === 'error' && /DOORPATH\.on was set/.test(String(q.why)); };
      const off = specs.filter((_, i) => !why(i));
      C.verdict(off.length === 0, inert ? `the red path on ${name}: both runs of every pair ended, on digests apart` : `the red path on ${name}: the take-out stopped every run on its first frame of a walk that is on`,
        off.length ? off.map(s => { const [p, q] = at(specs.indexOf(s)); return `${s}: ${said(p)}; ${said(q)}`; }).join(' · ') : `${specs.length} of ${specs.length}`); }
  });
  return C.done();
}

if (import.meta.main) {
  let ok = true; for (const f of [doorpathPaths, doorpathGun, doorpathFile, doorpathOff]) ok = await f() && ok; process.exit(ok ? 0 : 1);
}
