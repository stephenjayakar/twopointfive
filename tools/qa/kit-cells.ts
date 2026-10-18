// A LOADOUT AS A COMMAND — tools/qa/ships.ts's stand (the play-through as the page ships it: glass parts, the movement pass, the light turn weight, the cast,
// the defenders' frags) with THE KIT CARDS SET FROM A JSON SPEC before each run, and every run's row saying what the squad carried in and what it spent.
// For the kit-slots tallies ('what is a stun canister / a door charge / a frag worth to the scripted squad'): a cell is a command, not a code edit.
//   bun run tools/qa/kit-cells.ts --name no-stun --kit '{"1":{"bangs":0},"2":{"bangs":0}}' --scn warehouse-four --seeds 1-144 --jobs 4 --cap 420 --json out.json
//     --kit JSON    member index → card fields (0 = you, 1‥4 = the teammates in staging order: Red One, Red Two, Blue One, Blue Two). A field is one of the
//                   member's own card rows (src/game/kit.ts kitRows: weapon suppressed light nvg bangs charges frags suit trim; you: weapon cans frags
//                   shells suit trim) and its value one the row offers — set through kitSet, the card's own click, so nothing a card cannot do can be asked.
//                   "all" = every teammate (1‥4): --kit '{"all":{"bangs":3}}'. No --kit = every card as issued = ships.ts, run for run.
//     --name cell   the cell's name (goes in the JSON and the total line)
//     --hard · --weather rain|downpour|fog|dust · --callout · --regroup · --base (the harness's own stand) · --set '{…}'      exactly ships.ts's
//     --scn --seeds --jobs --cap --json --md                                                                              exactly playthrough.ts's
//     --trace scn:seed   one run with its timeline (the kit applied)
//     env passes through (PT_HOUR, PT_SEARCH, PT_SQUAD, PT_WEDGED=charge … — playthrough.ts's head lists them)
//   bun run tools/qa/kit-cells.ts --table cell.json [cell2.json …] [--against baseline.json] [--boot 4000]
//     one markdown row per file and scenario: runs, taken, teammates up of staged, the PAIRED difference against the baseline over the seeds both have with its
//     95 % bootstrap interval (teammates up — the same dice and draws as tools/qa/lost-men.ts, so the two agree — and runs taken), mean seconds, what the squad
//     carried, what it USED per run (thrown / blown: mean, sd, and how many runs used 0‥n), runs that used every stun canister / every door charge, defenders'
//     frags thrown. --against takes several files (repeat it, or a.json+b.json): each scenario is paired with the baseline file that has it. A note is printed
//     under the table when a cell and its baseline were not run on the same cap, --set or env (e.g. PT_WEDGED on one side): the interval then holds both changes
//
// EVERY RUN'S ROW (RunOut.kit, beside everything playthrough.ts files):
//   n        teammates staged
//   carried  the squad's counted stun canisters / door charges / frags as the run began (doortools.ts's own counts after kit.ts kitStage)
//   spent    of each, net of refunds (an order reserves its can and gives it back unused): counted at DoorTools.take / .refund, the one place they move
//   held     of `spent`, what never went off: a can still in the hand of an order the run's end cut short (a 'bang and clear' takes its can when given and
//            throws it at the door — a squad wiped in the stack ends with it reserved), a charge set on a door and not blown. USED = spent − held is what
//            --table reports (a file from before this field: spent − tools.bangs / tools.blown, the same number)
//   left     the counts at the end · carried = left + spent, checked against kit.ts kitPool for the cards (a mismatch is filed in `check` and counted)
//   you      the commander's own belt at the end {smoke, stun, frags, shells}: THE SCRIPTED COMMANDER THROWS AND FIRES NOTHING, so these are carried, never
//            spent — your smoke, your stun, your frags and the 40 mm are UNMEASURED by this tool, not worthless
//   also in the row, from playthrough.ts: tools.bangs (cans that went off), tools.blown (charges blown), frag.theirs (defenders' frags thrown)
// WHAT THE SCRIPTED COMMANDER SPENDS (playthrough.ts playRooms): 'bang and clear' on every held room while the squad has a can, else 'open and clear'. He gives
// NO charge order and NO frag order by himself: door charges are spent only under PT_WEDGED=charge (a door the stack finds wedged from inside gets a charge,
// not the boot), frags never. A tool he never uses is unmeasured: a cell that changes only such a tool plays the baseline's runs again, and says nothing of it.
// exit 0 = every run ended by the scenario's own rules · 1 = a run threw or stalled, or a run's count check failed · 2 = bad flags / kit spec (nothing run)
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { play, report, entryOf, type RunOut } from './playthrough.ts';   // (first, so the game's modules load in the order they do under playthrough.ts)
import { ROOT } from './headless.ts';

type Three = { stun: number; charges: number; frags: number };
export interface KitOut { n: number; carried: Three; spent: Three; held?: Three; left: Three; you: { smoke: number; stun: number; frags: number; shells: number } | null; check: string }
type KitSpec = Record<string, Record<string, string | number | boolean>>;
type Run = RunOut & { kit?: KitOut; frag?: { theirs?: number } };

const argv = process.argv.slice(2);
const bad = (why: string): never => { console.error(why); process.exit(2); };
const VALUED = ['--kit', '--name', '--set', '--weather', '--scn', '--seeds', '--cap', '--jobs', '--json', '--trace', '--one', '--out', '--against', '--boot'], BARE = ['--hard', '--callout', '--regroup', '--base', '--md', '--table', '--verbose'];
const val = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n: string) => argv.includes(n);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const files: string[] = [];   // (--table's files: the only arguments that are not flags)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (BARE.includes(a)) continue; if (!a.startsWith('--') && has('--table')) { files.push(a); continue; } if (!VALUED.includes(a)) bad(`unknown flag ${a} — ${[...VALUED, ...BARE].join(' ')}`); if (argv[i + 1] === undefined) bad(`${a} wants a value`); i++; }

// ───────────────────────────────────────────────────────────── the cards ───────────────────────────────────────────
const K = await import(`${ROOT}/src/game/kit.ts`);
/** the spec with "all" spread over the four teammates, checked against each member's own rows; the cards are SET (this process) */
function applyKit(spec: KitSpec): KitSpec {
  const out: KitSpec = {}; if (!spec || typeof spec !== 'object' || Array.isArray(spec)) bad('--kit wants an object: member index → card fields');
  for (const [who, fields] of Object.entries(spec)) {
    if (who !== 'all' && !/^[0-4]$/.test(who)) bad(`--kit: '${who}' is not a member (0 = you, 1 to 4 = the teammates, or "all" = every teammate)`);
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) bad(`--kit: member ${who} wants an object of card fields`);
    for (const i of who === 'all' ? [1, 2, 3, 4] : [Number(who)]) out[i] = { ...(who === 'all' ? fields : {}), ...(out[i] ?? {}), ...(who === 'all' ? {} : fields) };   // (a member's own row wins over "all")
  }
  for (const [i, fields] of Object.entries(out)) for (const [f, v] of Object.entries(fields)) {
    const row = K.kitRows(Number(i)).find((r: any) => r.field === f);
    if (!row) bad(`--kit: member ${i}'s card has no '${f}' row (${K.kitRows(Number(i)).map((r: any) => r.field).join(' ')})`);
    if (!K.kitSet(Number(i), f, v)) bad(`--kit: member ${i}'s '${f}' row does not offer ${JSON.stringify(v)} (${row.values.map((x: unknown) => JSON.stringify(x)).join(' ')})`);
  }
  return out;
}
/** the five cards in words, and what the cards bring to the squad's count with the four staged */
function cardsInWords(): string[] {
  const m = K.KIT.members;
  return Array.from({ length: K.KIT_MEMBERS }, (_x, i) => `${K.kitName(i).title}${i ? ` (${K.kitName(i).sub.split(' · ')[0]})` : ''}: ${K.kitWords(i)}${K.SLOTS.on ? '' /* (under the pouches rule the line names them itself) */ : i ? ` · ${m[i].frags} frag${m[i].frags === 1 ? '' : 's'}` : ` · ${m[0].frags} frags · ${m[0].shells} 40 mm`}${K.kitChanged(i) ? '  [changed]' : ''}`);
}

// ───────────────────────────────────────────────────────────── the table of cells ──────────────────────────────────
if (has('--table')) {
  if (!files.length) bad('--table wants one or more kit-cells.ts / playthrough.ts --json files');
  if (val('--boot') !== undefined && (!/^\d+$/.test(val('--boot')!) || +val('--boot')! < 1)) bad(`--boot wants a whole number of 1 or more, got '${val('--boot')}'`);
  const BOOT = Number(val('--boot') ?? 4000), WELL = new Set(['taken', 'rescued']);
  type File = { f: string; cell: any; cap: unknown; set: unknown; runs: Run[] };
  const load = (f: string): File => { try { const j = JSON.parse(readFileSync(f, 'utf8')); if (!Array.isArray(j.runs)) throw new Error('no "runs" array'); return { f, cell: j.cell ?? null, cap: j.cap, set: j.set, runs: j.runs }; } catch (e) { return bad(`cannot read ${f}: ${(e as Error).message}`); } };
  const dice = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /** 95 % interval of the SUM of paired differences, the pairs resampled (lost-men.ts boot, one scenario: the same dice, the same draws) */
  const boot = (d: number[]): [number, number] => { const rnd = dice(4000), sims: number[] = []; for (let b = 0; b < BOOT; b++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[(rnd() * d.length) | 0]; sims.push(t); } sims.sort((a, b) => a - b); return [sims[Math.floor(0.025 * BOOT)], sims[Math.min(BOOT - 1, Math.floor(0.975 * BOOT))]]; };
  const sgn = (x: number, d = 0) => (x > 0 ? '+' : '') + x.toFixed(d);
  const msd = (a: number[]) => { if (!a.length) return '—'; const m = sum(a) / a.length; return `${m.toFixed(2)} (sd ${Math.sqrt(sum(a.map(x => (x - m) ** 2)) / Math.max(1, a.length - 1)).toFixed(2)})`; };
  const dist = (a: number[]) => { const n = Math.max(0, ...a); return Array.from({ length: n + 1 }, (_x, k) => a.filter(x => x === k).length).join(' '); };
  /** what went off: spent less what was still held at the end (a file from before `held`: the door tools' own count of cans thrown / charges blown) */
  const used = (r: Run, what: 'stun' | 'charges'): number => { const k = r.kit; if (!k) return what === 'stun' ? (r.tools?.bangs ?? 0) : (r.tools?.blown ?? 0); return k.held ? k.spent[what] - k.held[what] : Math.min(k.spent[what], what === 'stun' ? (r.tools?.bangs ?? k.spent.stun) : (r.tools?.blown ?? k.spent.charges)); };
  const refs = argv.flatMap((a, i) => a === '--against' ? argv[i + 1].split('+') : []).map(load), notes = new Set<string>();
  console.log(`| cell | map | runs | taken | teammates up of staged | up against baseline (95 %) | taken against baseline (95 %) | mean s | carried (stun · charges · frags) | stun thrown a run | runs throwing 0‥n stun | charges blown a run | runs blowing 0‥n charges | runs that used every stun · every charge | taken but never thrown or blown (stun · charges, all runs) | their frags a run |`);
  console.log(`|${'---|'.repeat(16)}`);
  for (const f of files.flatMap(x => x.split('+'))) { const F = load(f);
    for (const scn of [...new Set(F.runs.map(r => r.scn))]) {
      const ref = refs.find(R => R.runs.some(r => r.scn === scn)) ?? null, base = new Map((ref?.runs ?? []).filter(r => r.scn === scn).map(r => [r.seed, r]));
      // (a seed that ended 'error' on either side is dropped from both, as lost-men.ts drops it from every column)
      const all = F.runs.filter(r => r.scn === scn), errs = all.filter(r => r.end === 'error' || base.get(r.seed)?.end === 'error'), rs = all.filter(r => !errs.includes(r)).sort((a, b) => a.seed - b.seed); if (!rs.length) continue;
      const kits = rs.map(r => r.kit).filter(Boolean) as KitOut[], carried = kits.length ? [...new Set(kits.map(k => `${k.carried.stun} · ${k.carried.charges} · ${k.carried.frags}`))].join(' / ') : 'not filed';
      const stun = rs.map(r => used(r, 'stun')), chg = rs.map(r => used(r, 'charges'));
      let dUp = ref ? 'no seed in common' : '— (no --against)', dWon = dUp;
      if (ref) { const pairs = rs.filter(r => base.has(r.seed)).map(r => [base.get(r.seed)!, r] as const);
        const env = (c: any) => JSON.stringify(Object.fromEntries(Object.entries(c?.env ?? {}).filter(([k]) => /^(PT_|LASTSTAND$)/.test(k) && k !== 'PT_DIGEST').sort()   /* (the digest is a bystander) */));
        if (JSON.stringify(F.cap) !== JSON.stringify(ref.cap) || JSON.stringify(F.set) !== JSON.stringify(ref.set) || env(F.cell) !== env(ref.cell)) notes.add(`${F.cell?.name ?? f} against ${ref.cell?.name ?? ref.f}: not the same stand — cap ${F.cap} / ${ref.cap} · --set ${JSON.stringify(F.set)} / ${JSON.stringify(ref.set)} · env ${env(F.cell)} / ${env(ref.cell)}: the difference holds that change too`);
        if (pairs.length) { const du = pairs.map(([a, b]) => b.team - a.team), dw = pairs.map(([a, b]) => +WELL.has(b.end) - +WELL.has(a.end)), [ulo, uhi] = boot(du), [wlo, whi] = boot(dw), same = pairs.filter(([a, b]) => a.end === b.end && a.t === b.t && a.team === b.team).length;
          dUp = `${sgn(sum(du))} (${sgn(ulo)} to ${sgn(uhi)}) over ${pairs.length} seeds = ${sgn(sum(du) / pairs.length, 2)} a run (${sgn(ulo / pairs.length, 2)} to ${sgn(uhi / pairs.length, 2)}); ${same} runs the same run`;
          dWon = `${sgn(sum(dw))} (${sgn(wlo)} to ${sgn(whi)}) = ${sgn(100 * sum(dw) / pairs.length, 1)} pts (${sgn(100 * wlo / pairs.length, 1)} to ${sgn(100 * whi / pairs.length, 1)})`; } }
      const won = rs.filter(r => WELL.has(r.end)).length, withKit = rs.filter(r => r.kit), checks = kits.filter(k => k.check).length;
      const every = (what: 'stun' | 'charges') => !withKit.length ? '—' : withKit.every(r => r.kit!.carried[what] === 0) ? 'none carried' : String(withKit.filter(r => r.kit!.carried[what] > 0 && used(r, what) >= r.kit!.carried[what]).length);
      const idle = (what: 'stun' | 'charges') => withKit.length ? String(sum(withKit.map(r => r.kit!.spent[what] - used(r, what)))) : '—';
      console.log(`| ${F.cell?.name ?? f.split('/').pop()} | ${scn} | ${rs.length}${errs.length ? ` (+${errs.length} dropped: error)` : ''} | ${won} (${(100 * won / rs.length).toFixed(1)} %) | ${sum(rs.map(r => r.team))}/${sum(rs.map(r => r.of))} (${(sum(rs.map(r => r.team)) / rs.length).toFixed(2)} a run) | ${dUp} | ${dWon} | ${(sum(rs.map(r => r.t)) / rs.length).toFixed(0)} | ${carried}${checks ? ` (${checks} runs FAILED the count check)` : ''} | ${msd(stun)} | ${dist(stun)} | ${msd(chg)} | ${dist(chg)} | ${every('stun')} · ${every('charges')} | ${idle('stun')} · ${idle('charges')} | ${(sum(rs.map(r => r.frag?.theirs ?? 0)) / rs.length).toFixed(2)} |`);
    } }
  for (const n of notes) console.log(`\n(note — ${n})`);
  process.exit(0);
}

const json = (n: string, dflt: string) => { try { return JSON.parse(val(n) ?? dflt); } catch (e) { return bad(`${n}: not JSON — ${(e as Error).message}`); } };
const cap = Number(val('--cap') ?? 300), spec = applyKit(json('--kit', '{}') as KitSpec), name = val('--name') ?? (Object.keys(spec).length ? 'unnamed' : 'issued');   // (set here too: the parent checks the spec and words the cards; every run sets them again in its own process)

// ───────────────────────────────────────────────────────────── one run (a child of the sweep, or --trace's) ────────
if (val('--one')) {
  const [scn, seed] = val('--one')!.split(':'), verbose = has('--verbose');
  if (!entryOf(scn)) bad(`no scenario '${scn}'`);
  // the door tools' counts move in two places only (DoorTools.take / .refund): counted there, on the prototype, and the instance kept for the counts at the end
  const { DoorTools } = await import(`${ROOT}/src/game/doortools.ts`); const proto = DoorTools.prototype as any, take0 = proto.take, refund0 = proto.refund, sync0 = proto.sync;
  const WORD = { bang: 'stun', charge: 'charges', frag: 'frags' } as const; let D: any = null; const took: Three = { stun: 0, charges: 0, frags: 0 }, back: Three = { stun: 0, charges: 0, frags: 0 };
  proto.sync = function () { D = this; return sync0.call(this); };
  proto.take = function (what: keyof typeof WORD) { D = this; const ok = take0.call(this, what); if (ok) took[WORD[what]]++; return ok; };
  proto.refund = function (what: keyof typeof WORD) { D = this; back[WORD[what]]++; return refund0.call(this, what); };
  const set = json('--set', '{}'), r = await play(scn, Number(seed), cap, verbose, set), { trace: _t, ...rest } = r, out = rest as Run;
  if (D) { const left: Three = { stun: D.bangs, charges: D.charges, frags: D.frags }, spent: Three = { stun: took.stun - back.stun, charges: took.charges - back.charges, frags: took.frags - back.frags };
    const ops: any[] = D.ops ?? [], held: Three = { stun: ops.filter(o => o.bangHeld && !o.frag).length, charges: (D.set ?? []).length, frags: ops.filter(o => o.bangHeld && o.frag).length };
    const carried: Three = { stun: left.stun + spent.stun, charges: left.charges + spent.charges, frags: left.frags + spent.frags }, n = Math.min(K.KIT_STAGED.ops.length, K.KIT_MEMBERS - 1), pl = D.g?.player;
    // (the cards' own sum — kit.ts kitPool, the number the loadout screen shows — asked with the tables as shipped: skipped when --set moved the counts' knobs)
    const moved = !!(set.DOORTOOLS && ('bangs' in set.DOORTOOLS || 'charges' in set.DOORTOOLS)) || !!(set.FRAG && ('squad' in set.FRAG || 'on' in set.FRAG)), pool = K.kitPool(n);
    const check = r.end === 'error' || moved || !n || !K.KIT.on || (pool.bangs === carried.stun && pool.charges === carried.charges && pool.frags === carried.frags) ? '' : `the cards sum to ${pool.bangs} stun ${pool.charges} charges ${pool.frags} frags, the run counted ${carried.stun} ${carried.charges} ${carried.frags}`;
    out.kit = { n, carried, spent, held, left, you: pl ? { smoke: pl.canisters, stun: pl.flashbangs, frags: pl.frags, shells: pl.rifle?.shells ?? 0 } : null, check }; }
  if (verbose) console.log(`\n${r.scn}:${r.seed} ${r.end} at ${r.t} s — ${r.why.split('\n')[0]} · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} up · ${kitLine(out)}`);
  if (val('--out')) writeFileSync(val('--out')!, JSON.stringify(out));   // (to a file: a long line on stdout is cut short by the exit)
  process.exit(verbose && (r.end === 'error' || r.end === 'stalled') ? 1 : 0);
}
function kitLine(r: Run): string { const k = r.kit; return k ? `carried ${k.carried.stun} stun ${k.carried.charges} charges ${k.carried.frags} frags · spent ${k.spent.stun} ${k.spent.charges} ${k.spent.frags}${k.held && k.held.stun + k.held.charges + k.held.frags ? ` (of them never used: ${k.held.stun} ${k.held.charges} ${k.held.frags})` : ''}${k.check ? ` · COUNT CHECK: ${k.check}` : ''} · their frags ${r.frag?.theirs ?? 0}` : 'no kit count (the run never stood)'; }

// ───────────────────────────────────────────────────────────── the sweep: ships.ts's stand, playthrough.ts's loop ──
// (ships.ts, line for line: what the page sets that the harness holds off)
let set: Record<string, Record<string, unknown>> = json('--set', '{}'); const last: string[] = [], base = has('--base');
const merge = (n: string, o: Record<string, unknown>) => { set[n] = { ...o, ...(set[n] ?? {}) }; };   // (an explicit --set row wins)
if (!base) merge('FRAG', { defenders: true });
if (has('--hard')) merge('DIFFICULTY', { level: 'hard' });
if (val('--weather')) merge('WEATHER', { kind: val('--weather') });
if (has('--callout')) last.push('callout'); if (has('--regroup')) last.push('regroup');
const env: Record<string, string | undefined> = { ...process.env, ...(base ? {} : { GLASSFX: 'on', TPS_MOVES: '1', TPS_TURN: '1', TPS_CAST: '1' }), ...(last.length ? { LASTSTAND: last.join(',') } : {}) };
const stand = `${base ? 'the harness\'s own stand (--base)' : 'as shipped (ships.ts: glass parts, moves, turn, cast, defenders\' frags)'}${has('--hard') ? ' · Hard' : ' · Standard'}${val('--weather') ? ` · ${val('--weather')}` : ''}${process.env.PT_HOUR ? ` · ${process.env.PT_HOUR}` : ' · night'}${last.length ? ` · ${last.join(' + ')}` : ''}`;
const one = (job: string, extra: string[], io: 'inherit' | 'ignore') => Bun.spawn(['bun', 'run', import.meta.path, '--one', job, '--cap', String(cap), '--set', JSON.stringify(set), '--kit', JSON.stringify(spec), ...extra], { stdout: io, stderr: io === 'inherit' ? 'inherit' : 'pipe', env });

if (val('--trace')) { if (!entryOf(val('--trace')!.split(':')[0])) bad(`no scenario '${val('--trace')!.split(':')[0]}'`); const [scn, seed] = val('--trace')!.split(':'); process.exit(await one(`${scn}:${seed ?? 1}`, ['--verbose'], 'inherit').exited); }

const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
const ids = (val('--scn') ?? bad('--scn wants one or more scenario ids (warehouse-four,compound-four,barracks-four …)')).split(',');
for (const id of ids) if (!entryOf(id)) bad(`no scenario '${id}'`);
const seeds = seedsOf(val('--seeds') ?? '1-6'), jobs = Math.max(1, Number(val('--jobs') ?? 4));
const todo = ids.flatMap(scn => seeds.map(seed => ({ scn, seed }))), runs: Run[] = []; let next = 0; const t0 = Date.now();
const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
  const file = resolve(tmpdir(), `kit-cells-${process.pid}-${j.scn}-${j.seed}.json`);
  const pr = one(`${j.scn}:${j.seed}`, ['--out', file], 'ignore');
  const errText = await new Response(pr.stderr as ReadableStream).text(); await pr.exited;
  let r: Run; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn: j.scn, seed: j.seed, end: 'error', why: `the run left no result — ${errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`, t: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, orders: 0, refused: [], smells: [], rooms: 0, note: '' }; }
  runs.push(r); console.error(`  ${j.scn}:${j.seed} ${r.end} ${r.t} s · team ${r.team}/${r.of} · theirs ${r.hostiles}/${r.hostilesOf} up · ${kitLine(r)}${r.end === 'error' ? ` — ${r.why.split('\n')[0]}` : ''}`); } };
await Promise.all(Array.from({ length: jobs }, worker));
runs.sort((a, b) => ids.indexOf(a.scn) - ids.indexOf(b.scn) || a.seed - b.seed);
console.log(report(runs, has('--md')));
console.log(`\n${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
// THE TOTAL LINE: the cell, the cards in words, and per scenario what was carried and spent
const cards = cardsInWords(), checks = runs.filter(r => r.kit?.check).length;
console.log(`\ncell '${name}' · ${stand} · cap ${cap} s · --kit ${JSON.stringify(spec)}`);
for (const c of cards) console.log(`    ${c}`);
for (const scn of ids) { const rs = runs.filter(r => r.scn === scn && r.end !== 'error'), ks = rs.map(r => r.kit).filter(Boolean) as KitOut[]; if (!rs.length) continue;
  const mean = (f: (k: KitOut) => number) => ks.length ? (sum(ks.map(f)) / ks.length).toFixed(2) : '—', won = rs.filter(r => r.end === 'taken' || r.end === 'rescued').length;
  console.log(`  ${scn}: ${rs.length} runs · ${won} taken (${(100 * won / rs.length).toFixed(1)} %) · teammates up ${sum(rs.map(r => r.team))}/${sum(rs.map(r => r.of))} · mean ${(sum(rs.map(r => r.t)) / rs.length).toFixed(0)} s · carried ${mean(k => k.carried.stun)} stun ${mean(k => k.carried.charges)} charges ${mean(k => k.carried.frags)} frags · spent a run ${mean(k => k.spent.stun)} stun ${mean(k => k.spent.charges)} charges ${mean(k => k.spent.frags)} frags · their frags a run ${(sum(rs.map(r => r.frag?.theirs ?? 0)) / rs.length).toFixed(2)}`); }
if (checks) console.log(`  COUNT CHECK FAILED in ${checks} runs (the cards' sum is not what the run counted): ${runs.filter(r => r.kit?.check).slice(0, 6).map(r => `${r.scn}:${r.seed} ${r.kit!.check}`).join(' · ')}`);
if (val('--json')) writeFileSync(val('--json')!, JSON.stringify({ cap, set, cell: { name, kit: spec, cards, stand, env: Object.fromEntries(Object.entries(env).filter(([k]) => /^(PT_|LASTSTAND$|GLASS|TPS_)/.test(k))) }, runs }, null, 1));
process.exit(runs.some(r => r.end === 'error' || r.end === 'stalled') || checks ? 1 : 0);
