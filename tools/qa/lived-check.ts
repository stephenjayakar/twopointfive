#!/usr/bin/env bun
// LIVED-IN ROOMS' CHECK (src/scene/lived.ts) — `bun run tools/qa/lived-check.ts [levels/x.json | x …] [--sheet] [--base <rev> | --base none] [--quiet]`
// The furniture that makes a room its own place is REAL (it blocks feet, rounds and sight), so it can break a level the way paint cannot. Per level file:
//   1. OFF IS THE LEVEL AS IT WAS: the file with its lived things taken out (boxes in group 'lived' / 'lived.<room>', props / lights / switchables whose id
//      starts 'lived.') equals the file at <rev> key for key, and loads to the same Level with the switch off (default rev = THE LEVEL'S OWN BASE, its row
//      in LEVEL_BASE below, the last step that changed that level's own part on purpose; a level with no row: BASE_REVS; `--base <rev>` holds every level
//      named to that one; `--base none` once no rev speaks for the level; a level its rev does not have is not asked). A lesson's WORDS and LISTS are read
//      from today's file (LESSON_FREE below says which keys, and why those);
//   2. EVERY AUTHORED POINT STILL STANDS: each floor point the level's scenarios, routes, plans, mission, chokepoints, civilians and marks name (team starts,
//      defenders' marks, pods, waypoints, deals, lesson spots) is free in the nav grid if it was, and no lived solid or prop is within a body's width of it;
//   3. NOBODY'S AIM IS WALLED: a mark's `pos` → `aimAt` line that was open is still open;
//   4. DOORS KEEP THEIR FLOOR: no lived solid or prop within 1.1 m of a door's hinge-to-latch line with a line to it from either face (the leaf's sweep, the
//      jambs a stack stands on);
//   5. THE FLOOR IS STILL ONE FLOOR: every cell a man could walk to from the spawn he still can (a cut-off pocket of 3 cells or more fails, a smaller one
//      warns), and the walk between any two authored points is no more than 30 % + 1.5 m longer;
//   6. BUDGET: boxes ≤ 900 a level (a warning past it), lights ≤ 64.
// `--sheet` prints, per `lived.<room>` group, what the room got (solids, drawn-only clutter, floor pieces, props, lights, paints) and which of the level's
// own named rooms got nothing. Lines are `- PASS — …` / `- FAIL — …` (tools/qa/gate.sh counts them); exit 0 = all pass, 1 = a check failed, 2 = bad usage.
// With no file named: every level that carries a lived thing (none = NO VERDICT, exit 0).
// THE CHECK'S OWN BREAK PATH (in memory, no file is written): `LIVED_BREAK=1` moves each level's first own box half a metre and stands its first lived solid in
// its first door — the damage furniture work can do — and must be red on line 1 and on the doors' line of every level; `LIVED_BREAK=lesson` changes every HELD
// key of each lesson's first marked step and of its frame (LESSON_HELD) and must be red on every level with a lesson; `LIVED_BREAK=words` changes EVERY key
// of the LESSON_FREE table on every step, the lesson and its frame, and must stay green: what a lesson's owner may change with no new base is that table.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const ROOT = resolve(import.meta.dir, '../..');
// The base = the last step that changed a level's own part (everything but its lived things) ON PURPOSE: newest first, and the one this checkout's HEAD descends
// from is taken, else the newest (the last entry: the commit that brought the work to this repo, where every level stood as the bases before it had left it. Those
// older bases are commits of the history before the move and are not in a clone of this repo, so they are no longer listed; the last of them was the records office's Team & kit door picture, scenarios.kitView — the LAST picture to take one: the block is exempt below; before it the police post's terminal on the bunk room's footlocker; before it the floodlit shed's roof flagged to be seen through from above; before it real-size doors, then the look levels' floor decals re-layered, then every level's floor laid in tiers, then a door hung outward or a window for every room a wedge could shut) — so the check holds on a branch from before a step and on the join after it.
// A base may itself carry lived things: its lived things are taken out like today's, and what is held is everything else.
// 6b2c35201: the crossing's east wall foot cut at the yard gate's frame (one box more; no other level's own part moved).
// fcae91f17: the snatch's footstep plan covers the whole world, so the gate hut's zone is read.
// 9fb5b67a1: the join of those two steps. The check holds EVERY level against ONE base, and each of the two holds only its own level's change, so the base
// is the first commit that carries both; a later step that changes a level's own part on purpose goes in front of it the same way (UNTIL 10-22: see CLOSED, below).
// 150575169: the glasshouse's back wall foot cut at the back door's frame (the same: one box more, no other level's own part moved).
// 113556864: the join that first carries the glasshouse's step with the two before it (one base for every level, as above).
// 105ddc056: the join that carries the long hall's two files without the ballistic shield (its issue block is empty; no other level's own part moved).
// f48b54d8d: the door names (scenarios.doorNames in 25 files: words a row reads, no box, door, mark or route moved).
// 14d5fc1f4: exits, areas and 23 doors renamed in 22 files (names only: scenarios.quiet starts / exits / wayouts, places.areas, doorNames; nothing else moved).
// 98281d690: the snatch's van and its response block (levels/snatch.json alone). 317a19cb1: the join of the two, the first here that holds both.
// 5f8c416e6: the tutorial's squad mission, a level no base before it has. It is the base for EVERY level, as each of these is (one base for all): every
//   level's 429 lines were green against it when it went in, and tut-squad's lived things are held to their tail from here.
// cb936797b: the join that first carries the ledger's own level (levels/tut-quiet.json rebuilt whole; no other level's own part moved).
// 0d3a18078: the ledger's lines and cards reworded and the rows Space offers there (words and a list in levels/tut-quiet.json alone; no box, door, mark or route moved).
// c069ca16f: a join's base. The two before it are siblings (one took the fog of war out of levels/tut-sky.json, the other reworded levels/tut-quiet.json and
//   lengthened its rows list), so neither holds both; this join is the first commit that does. No level's own part moved in the join itself.
// d13650f85: the plan mission's barrier post moved and two drums put in a corner (levels/tut-plan.json alone; a sibling of the join above).
// 3046a115e: a join's base again. c069ca16f and d13650f85 are siblings (the first holds the reworded levels/tut-quiet.json and not the plan mission's moved
//   post, the second the other way round); this join is the first commit that holds both. No level's own part moved in the join itself.
// 636e5eaef: a join's base once more. Its two parents are siblings: one glazed the hall's street window in levels/tut-squad.json (a box), reworded a card
//   there and gave a step a cue; the other is 3046a115e's line. This join is the first commit that holds both. No level's own part moved in the join itself.
// THIS LIST IS CLOSED (10-22): nothing more goes in front of it. One base for all meant that a level changed on purpose moved EVERY level's bar, and that two
// levels changed side by side on two branches left two newest bases that are siblings: on their join the one taken does not carry the other's change, and
// that level was red whatever the order. It is the base of every level with no row of its own below, and only that. (It is still a list, read newest first,
// because branches cut before the rows came still put a commit in front of it, and those lines must join without a hand; once they have it is one commit.)
const BASE_REVS = ['636e5eaef', '3046a115e', 'c069ca16f', 'd13650f85', '0d3a18078', 'f3ef62b01', 'cb936797b', '5f8c416e6', '317a19cb1', '98281d690', '14d5fc1f4', 'f48b54d8d', '105ddc056', '113556864', '150575169', '9fb5b67a1', 'fcae91f17', '6b2c35201', 'b6c0aff16'];
/** A LEVEL'S OWN BASE: the commit that level's own part (everything but its lived things) was last changed in ON PURPOSE. A level changed on purpose in its own
 *  part (a box, a door, a mark, a route, a held key of its lesson, a lesson re-cut) moves ITS row to the commit that carries the change — a commit of the
 *  checkout's own history whose file is the level as meant — and says over the row what changed; no other level's bar moves. A row is its note, its line and
 *  an empty line, and a new row goes in by the level's name: two branches that each move a row then join without a hand (two that ADD a row at one place
 *  still meet). A look twin (`<name>-gwot.json`) with no row of its own is held to the plain level's. A level with no row is held to BASE_REVS above, as it
 *  was; a level BASE_REVS does not carry must have one. */
const LEVEL_BASE: Record<string, string> = {
  // the pair mission's gate yard re-laid with ruts and stones, the partner's ways out of every line
  'tut-pair.json': '9048a2e01',

  // the plan mission's hall has no lookout on the word's own step (a step's `eye` gone)
  'tut-plan.json': '6cdeafa97',

  // the ledger's whistled man looks from the lane's gap and turns away to smoke by a chair (three volumes, a chair, a gas bottle, a tin)
  'tut-quiet.json': '87c7cebef',

  // the tunnel station, played with no fog of war (its lesson's rails.fog)
  'tut-sky.json': 'f3ef62b01',

  // the squad mission after a first play: the hall's street window glazed, a step given a cue
  'tut-squad.json': 'be980f1e1',
};
/** WHAT OF A LESSON ITS OWNER MAY CHANGE WITH NO NEW BASE (scenarios.lesson; scene/scenarios.ts LessonData, LessonStep, RailsData): its WORDS and its LISTS,
 *  read from today's file and never held to the base. Decided 10-22, when four re-bases in a day were each a lesson's words:
 *   · words the player reads — the lesson's `title`; a step's `line` and the lines that stand in for it (`setupLine`, `ringLine`, `blowLine`, `menuLine`,
 *     `pageLine`, `planLine`), its `noTap` words, its card (`explain`) and its line once the order is given (`after`: the line, the word's line, the orders it waits on);
 *   · lists of what the frame offers — a step's `allow` / `deny`, the frame's `allow`, `orders` and `rows`.
 *  Furniture cannot touch one and none names a place. What holds them instead: tools/qa/lesson-check.ts (plain run: every Training and tutorial level) reads
 *  the block against the floor, and tools/qa/lesson-gate.ts <level> plays the mission through (its plain run is Training's levels: a tutorial mission is
 *  gated BY NAME, so an owner who changes a list runs it on his level). */
const LESSON_FREE = { lesson: ['title'], step: ['line', 'setupLine', 'ringLine', 'blowLine', 'menuLine', 'pageLine', 'planLine', 'noTap', 'explain', 'after', 'allow', 'deny'],
  rails: ['allow', 'orders', 'rows'] };
/** STILL HELD, each a one-line move of the level's own row: the steps themselves (their number and order), a step's `id`, its `done` test and `hold`, every PLACE
 *  (`at`, `atMan`, `toward`, `eye`, the frame's `sky`) and what the frame does (`cue`, `checkpoint`, `fog`, `onWay`, `respawn`, `lasers`): a mark moved to
 *  make room for a desk is the damage this check is for. A key of a lesson that is in NEITHER table is a red line until it is put in one: the choice is made
 *  in the open, by whoever adds the key. */
const LESSON_HELD = { lesson: ['steps', 'rails'], step: ['id', 'done', 'hold', 'at', 'atMan', 'toward', 'eye', 'cue', 'checkpoint', 'fog', 'onWay'], rails: ['respawn', 'fog', 'sky', 'lasers'] };
/** today's value for every free key, the base's for every other, in today's key order (the loaded Levels are compared as text); `n` counts the free keys that moved */
function readFree(now: any, then: any, keys: string[], n: { v: number }): any { const t: any = {};
  for (const k of Object.keys(now)) { if (keys.includes(k)) { t[k] = now[k]; if (JSON.stringify(now[k]) !== JSON.stringify(then[k])) n.v++; } else if (k in then) t[k] = then[k]; }
  for (const k of Object.keys(then)) if (!(k in t)) { if (keys.includes(k)) n.v++; else t[k] = then[k]; }
  return t; }
const BASE_REV = BASE_REVS.find(r => spawnSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', r, 'HEAD']).status === 0) ?? BASE_REVS[0];
/** roomclear.ts propGap, repeated (this tool imports nothing of src/game): the floor distance from a point to a prop's yawed footprint */
function propGap(p: { home: [number, number, number]; hx: number; hz: number }, at: number[]): number {
  const dx = at[0] - p.home[0], dz = at[2] - p.home[1], c = Math.cos(p.home[2]), s = Math.sin(p.home[2]);
  return Math.hypot(Math.max(0, Math.abs(c * dx - s * dz) - p.hx), Math.max(0, Math.abs(s * dx + c * dz) - p.hz));
}
type V3 = [number, number, number];
interface Pt { p: V3; path: string }

export async function livedCheck(argv: string[]): Promise<boolean | null> {
  await import('./headless.ts');   // (the game modules are one import cycle: enter it the way every probe does)
  const { parseLevelData, structuralDiff } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { isLived } = await import(`${ROOT}/src/scene/lived.ts`);
  const { StaticCollision, NavGrid } = await import(`${ROOT}/src/scene/collision.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

  const flags = new Set<string>(), files: string[] = []; let named: string | undefined;   // (`named`: a base given with --base, for every level asked; else each level's own)
  for (let i = 0; i < argv.length; i++) { const a = argv[i];
    if (a === '--base') named = argv[++i] ?? ''; else if (a.startsWith('--')) flags.add(a); else files.push(a); }
  for (const f of flags) if (!['--sheet', '--quiet'].includes(f)) { console.error(`lived-check: unknown flag ${f} (--sheet, --quiet, --base <rev|none>)`); process.exit(2); }
  const sheet = flags.has('--sheet'), quiet = flags.has('--quiet');
  if (named === '') { console.error('lived-check: --base wants a revision, or none'); process.exit(2); }
  const allBase = named ?? '', BREAK = process.env.LIVED_BREAK ?? '';
  if (!['', '1', 'lesson', 'words'].includes(BREAK)) { console.error(`lived-check: LIVED_BREAK=${BREAK}? (1, lesson, words)`); process.exit(2); }
  { const one = allBase || BASE_REV, dup = (['lesson', 'step', 'rails'] as const).flatMap(k => LESSON_FREE[k].filter(x => LESSON_HELD[k].includes(x)).map(x => `${k}.${x}`));
    if (one !== 'none' && spawnSync('git', ['-C', ROOT, 'cat-file', '-e', `${one}^{commit}`]).status !== 0) { console.error(`lived-check: no commit ${one} in this checkout (a shallow clone? --base <rev> or --base none)`); process.exit(2); }   // (a base that is not there used to read as 'a new level' and pass)
    if (dup.length) { console.error(`lived-check: ${dup.join(', ')} in both LESSON_FREE and LESSON_HELD`); process.exit(2); } }
  const rowOf = (name: string): string | undefined => LEVEL_BASE[name] ?? LEVEL_BASE[name.replace(/-gwot\.json$/, '.json')];   // (a look twin with no row of its own: the plain level's)
  const fileOf = (a: string) => { if (a.endsWith('.json') && existsSync(resolve(a))) return resolve(a); const n = basename(a).replace(/\.json$/, ''); return resolve(ROOT, 'levels', n + '.json'); };   // (a path to a file anywhere, or a level's name)
  const hasLived = (d: any) => d.boxes.some((b: any) => isLived(b.group)) || [d.props, d.lights, d.switchables].some((l: any[]) => (l ?? []).some(x => isLived(x.id)));
  let list = files.map(fileOf);
  if (!list.length) list = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json')).map(f => resolve(ROOT, 'levels', f))
    .filter(f => { try { return hasLived(JSON.parse(readFileSync(f, 'utf8'))); } catch { return false; } });
  if (!list.length) { console.log('lived-check: no level carries a lived thing yet — nothing to check'); return null; }

  let ok = true, checks = 0;
  const pass = (s: string) => { checks++; if (!quiet) console.log(`- PASS — ${s}`); };
  const fail = (s: string) => { checks++; ok = false; console.log(`- FAIL — ${s}`); };
  const warn = (s: string) => console.log(`  warn — ${s}`);
  const f2 = (x: number) => x.toFixed(2), at = (p: number[]) => `(${f2(p[0])}, ${f2(p[p.length - 1])})`;

  /** a lesson's key that is in neither table: nobody has said whether its owner may change it */
  const unsaid = (name: string, data: any) => { const L = data.scenarios?.lesson, un = new Set<string>(), ask = (o: any, k: 'lesson' | 'step' | 'rails') => { for (const x of Object.keys(o ?? {})) if (!LESSON_FREE[k].includes(x) && !LESSON_HELD[k].includes(x)) un.add(`${k}.${x}`); };
    if (L) { ask(L, 'lesson'); for (const s of L.steps ?? []) ask(s, 'step'); ask(L.rails, 'rails'); }
    if (un.size) fail(`${name}: its lesson has ${un.size > 1 ? 'keys' : 'a key'} in neither LESSON_FREE nor LESSON_HELD (${[...un].join(', ')}): say in tools/qa/lived-check.ts whether a lesson's owner may change ${un.size > 1 ? 'them' : 'it'} with no new base`); };
  // (with no file named that question is asked of EVERY level with a lesson, furniture or none: a key added to a bare level is in neither table just the same)
  if (!files.length) for (const f of readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json')).map(f => resolve(ROOT, 'levels', f))) if (!list.includes(f)) {
    try { const d = JSON.parse(readFileSync(f, 'utf8')); if (d.scenarios?.lesson) unsaid(basename(f), d); } catch { /* (not a level file: the level checks' own red) */ } }
  for (const k of Object.keys(LEVEL_BASE)) if (!existsSync(resolve(ROOT, 'levels', k))) fail(`LEVEL_BASE has a row for '${k}', which is no file under levels/ (a level renamed, or a name mistyped: the row holds nothing)`);
  for (const file of list) {
    const name = basename(file);
    if (!existsSync(file)) { fail(`${name}: no such level file`); continue; }
    const text = readFileSync(file, 'utf8'), data: any = parseLevelData(text);
    // (the level's own base, unless one was named for all)
    const rowed = !allBase && !!rowOf(name), base = allBase || rowOf(name) || BASE_REV;
    if (BREAK) { const L = data.scenarios?.lesson, tail = ' (said another way)';   // (the check's own break path: today's level damaged in memory, as the header says)
      const mut = (v: any): any => typeof v === 'string' ? v + tail : Array.isArray(v) ? (v.length && v.every(x => typeof x === 'number') ? [v[0] + 0.5, ...v.slice(1)] : [...v, 'x'])
        : v && typeof v === 'object' ? { ...v, x: 1 } : typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : tail;
      if (BREAK === '1') { const own = data.boxes.find((b: any) => !isLived(b.group)), d = (data.doors ?? [])[0];
        const sofa = data.boxes.find((b: any) => isLived(b.group) && !(b.flags ?? []).includes('NoShadow') && b.c[1] + b.h[1] > 0.5 && b.c[1] - b.h[1] < 1);
        if (own) own.c = [own.c[0] + 0.5, own.c[1], own.c[2]];
        if (sofa && d) sofa.c = [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, sofa.c[1], d.hinge[1] + Math.sin(d.closedDir) * d.width / 2]; }
      // (every held key the first marked step and the frame carry, the step's id apart: a step under another id is held whole whatever the tables say)
      if (BREAK === 'lesson' && L) { const s = L.steps.find((x: any) => Array.isArray(x.at)) ?? L.steps[0]; let did = 0;
        for (const k of LESSON_HELD.step) if (k !== 'id' && k in s) { s[k] = mut(s[k]); did++; }
        if (L.rails) for (const k of LESSON_HELD.rails) if (k in L.rails) { L.rails[k] = mut(L.rails[k]); did++; }
        if (!did) s.hold = 1; }
      // (every free key, there or not, on every step, the lesson and its frame
      //  — each as the loader will take it: a word, a card, a list; a free key of another shape wants its line in `as`)
      if (BREAK === 'words' && L) { const word = (v: any) => (v ?? 'Words') + tail, list = (v: any) => [...(v ?? []), 'x'];
        const as: Record<string, (v: any) => any> = { explain: v => ({ ...v, text: word(v?.text) }), after: v => ({ ...v, line: word(v?.line) }), allow: list, deny: list, orders: list, rows: list };
        const all = (o: any, keys: string[]) => { for (const k of keys) o[k] = (as[k] ?? word)(o[k]); };
        all(L, LESSON_FREE.lesson); for (const s of L.steps) all(s, LESSON_FREE.step); if (L.rails) all(L.rails, LESSON_FREE.rails); } }
    console.log(`\n${name}`);

    // ---- 1. off = the level as it was
    const bare = { ...data, boxes: data.boxes.filter((b: any) => !isLived(b.group)), props: data.props.filter((p: any) => !isLived(p.id)),
      lights: data.lights.filter((l: any) => !isLived(l.id)), switchables: data.switchables.filter((s: any) => !isLived(s.id)) };
    const nLived = { boxes: data.boxes.length - bare.boxes.length, props: data.props.length - bare.props.length, lights: data.lights.length - bare.lights.length,
      switchables: data.switchables.length - bare.switchables.length };
    // (a ROW's commit must be in this checkout's own history: one that is only on a branch beside it passes on one machine and nowhere else)
    let held = base !== 'none';
    if (held && rowed && spawnSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', base, 'HEAD']).status !== 0) { held = false;
      fail(`${name}: its row's commit ${base} is not in this checkout's history (LEVEL_BASE names a commit of a branch not joined, or the clone is shallow)`); }
    unsaid(name, data);
    if (held) {
      const g = spawnSync('git', ['-C', ROOT, 'show', `${base}:levels/${name}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
      // (a level its base does not carry: a ROW that names such a commit holds nothing and is red; so is a level in HEAD that has furniture and no row — since
      //  BASE_REVS closed no later base will ever take it in. A file not yet in a commit has nothing to be held to, and is told what it will need)
      if (g.status !== 0) { const kept = spawnSync('git', ['-C', ROOT, 'cat-file', '-e', `HEAD:levels/${name}`]).status === 0;
        if (rowed) fail(`${name}: its row's commit ${base} has no levels/${name} (a commit from before the level, or from before a rename: the row holds nothing)`);
        else if (kept && !allBase && (nLived.boxes || nLived.props || nLived.lights || nLived.switchables)) fail(`${name}: it carries lived things and has nothing to be held to — ${base} has no such level and LEVEL_BASE no row for it: give it one, the commit that carries the level as meant`);
        else if (!kept) warn(`${name}: not in ${base} and not in a commit yet — nothing to hold it to. Once it is in a commit with furniture it needs its own LEVEL_BASE row (that commit, or a later one that carries the level as meant), or this check is red`);
        else console.log(`  (not in ${base}: nothing to hold it to)`); }
      else { const out: string[] = [];
        // (a lesson step's LINE is words on the objective row, reworded since the base by other work — 'drags it' became 'takes hold of him' when bodies came to be carried —
        //  and nothing furniture can touch: the base's lines are read as today's. So are the lines a step shows under a newer rule in place of that one —
        //  `setupLine`, `ringLine` (scenarios.ts LessonStep): Training 4 gained four when a gun's key again came to open its setup, and this check was red on
        //  that file against every base from before them until the base was moved. Every other key of a step, its done-test and marker included, is still held)
        // (THE BALLISTIC SHIELD LEFT THE GAME (10-18): a base whose issue block hands a man the shield — the long hall's, and its look twin — is a file today's
        //  reader refuses, in words. The card that carried it was that man's whole trade for the plate and went with it, and the level's note said so: neither is
        //  a thing furniture can touch, and levels are staged on branches side by side, so this takes NO new base revision either. Such a base's issue block and
        //  note are read as today's and said so; every other key is still held, and tools/qa/noshield-check.ts holds that no level issues one)
        let baseText = g.stdout;
        { const raw = JSON.parse(baseText), cards = Object.values(raw.scenarios?.issue?.members ?? {}) as any[];
          if (cards.some(c => c && typeof c === 'object' && 'shield' in c)) {
            console.log(`  (${base}'s issue block hands a man the ballistic shield, which left the game: the block and the level's note are read as today's, not held to the base)`);
            if (data.scenarios?.issue !== undefined) raw.scenarios.issue = JSON.parse(JSON.stringify(data.scenarios.issue)); else delete raw.scenarios.issue;
            if (raw.meta && data.meta?.notes !== undefined) raw.meta.notes = data.meta.notes;
            baseText = JSON.stringify(raw); } }
        const was: any = parseLevelData(baseText), ls = data.scenarios?.lesson?.steps, ws = was.scenarios?.lesson?.steps;
        // (a base from after the rooms came carries lived things of its own: taken out the same way, so the base's own part is what today's is held to — nothing changes for a bare base)
        was.boxes = was.boxes.filter((x: any) => !isLived(x.group)); was.props = was.props.filter((x: any) => !isLived(x.id));
        was.lights = was.lights.filter((x: any) => !isLived(x.id)); was.switchables = was.switchables.filter((x: any) => !isLived(x.id));
        const moved = { v: 0 }, LN = data.scenarios?.lesson, LW = was.scenarios?.lesson;   // (LESSON_FREE: today's words and lists, the base's value for every other key)
        if (Array.isArray(ls) && Array.isArray(ws) && ls.length === ws.length) ws.forEach((s: any, i: number) => { if (s.id === ls[i].id) ws[i] = readFree(ls[i], s, LESSON_FREE.step, moved); });
        // (a lesson RE-CUT since the base — a step added or dropped — is no longer read as today's: with a base of its own a level's re-cut moves that level's
        //  row and no other bar, and while it was read as today's every mark and test of such a lesson went unheld. Until 10-22 it was, and said so)
        if (LN && LW) { if (LN.rails && LW.rails) LW.rails = readFree(LN.rails, LW.rails, LESSON_FREE.rails, moved); was.scenarios.lesson = readFree(LN, LW, LESSON_FREE.lesson, moved);
          if (moved.v) console.log(`  (${moved.v} of the lesson's words and lists are not ${base}'s: the lesson's own, read from today's file and not held to the base)`); }
        // (THE GEAR SCREEN'S BLOCK — scenarios.kitView, src/host/kitView.ts: the start page's picture of the team at the way in, per level. Picture only: no rule of
        //  the game reads it, a bespoke set's boxes are never in the level, and furniture cannot change a key of it — so a level given its picture, or a picture
        //  re-tuned, is not 'a step that changed the level's own part' and takes NO new base revision (levels are staged on branches side by side: each would have
        //  appended to BASE_REVS). The base's block is read as today's and said so; every OTHER key of `scenarios` is still held, and tools/qa/kitview-plan.ts
        //  holds the block itself: its places on free floor, its anchor, its sets)
        { const kv = data.scenarios?.kitView, wkv = was.scenarios?.kitView;
          if (JSON.stringify(kv) !== JSON.stringify(wkv)) { console.log(`  (the gear screen's block, scenarios.kitView, is not ${base}'s: ${wkv === undefined ? 'new' : kv === undefined ? 'gone' : 're-tuned'} since — picture only, not held to the base)`);
            if (kv !== undefined) (was.scenarios ??= {}).kitView = JSON.parse(JSON.stringify(kv)); else { delete was.scenarios.kitView; if (!Object.keys(was.scenarios).length && data.scenarios === undefined) delete was.scenarios; } } }
        // (THE RESPONSE TEAM'S BLOCK — scenarios.response, src/game/qrf.ts: who comes for the level, by which ways in, where they stand. A rule does read it, but
        //  furniture cannot change a key of it and levels are given one side by side on branches, so it takes no new base revision either. The base's block is
        //  read as today's and said so; every place it names is still asked in 2 below, against the floor as it is now, and tools/qa/response-check.ts holds
        //  the block itself: its ways, its doors, its marks on floor a man can stand on)
        { const rs = data.scenarios?.response, wrs = was.scenarios?.response;
          if (JSON.stringify(rs) !== JSON.stringify(wrs)) { console.log(`  (the response team's block, scenarios.response, is not ${base}'s: ${wrs === undefined ? 'new' : rs === undefined ? 'gone' : 're-tuned'} since — not held to the base)`);
            if (rs !== undefined) (was.scenarios ??= {}).response = JSON.parse(JSON.stringify(rs)); else { delete was.scenarios.response; if (!Object.keys(was.scenarios).length && data.scenarios === undefined) delete was.scenarios; } } }
        // (the exporter numbers generated box ids by place in the list, so every box after the lived ones — the dressing, the look's decals — has another NUMBER than it
        //  had; nothing names those boxes — export.ts refuses a kept thing that does — so past the first lived box the ids are not compared)
        const first = data.boxes.findIndex((b: any) => isLived(b.group)), noId = (l: any[]) => first < 0 ? l : l.map((b, i) => i < first ? b : { ...b, id: undefined });
        const n = structuralDiff({ ...was, boxes: noId(was.boxes) }, { ...bare, boxes: noId(bare.boxes) }, out, 6);
        if (n) fail(`${name}: with its lived things taken out the file differs from ${base} in ${n} place${n > 1 ? 's' : ''}: ${out.slice(0, 4).join(' · ')}`);
        else pass(`${name}: with its lived things taken out the file is ${base}'s, key for key`);
        const a = JSON.stringify(loadLevel(was, { lived: false, dressing: true })), b = JSON.stringify(loadLevel(data, { lived: false, dressing: true }));
        if (a !== b) fail(`${name}: loaded with the switch off it is not the Level ${base}'s file loads to`); else pass(`${name}: loaded with the switch off = ${base}'s Level`); }
    }
    if (!nLived.boxes && !nLived.props && !nLived.lights && !nLived.switchables) { warn(`${name}: carries no lived thing — nothing more to ask of it`); continue; }
    for (const b of data.boxes) if (isLived(b.group) && b.group === 'lived' && sheet) { warn(`${name}: box ${b.id} is in group 'lived' with no room (use lived.<room>)`); break; }

    const L0 = loadLevel(data, { lived: false, dressing: true }), L1 = loadLevel(data, { lived: true, dressing: true });
    const col0 = new StaticCollision(L0.boxes), col1 = new StaticCollision(L1.boxes), nav0 = new NavGrid(col0), nav1 = new NavGrid(col1);
    // the lived boxes as loaded: the on-level's boxes that the off-level has not (file order holds, lived things sit between the generator's own and the dressing)
    const livedIdx: number[] = []; data.boxes.forEach((b: any, i: number) => { if (isLived(b.group)) livedIdx.push(i); });
    const dataOn = data.boxes;   // (both switches on: the loaded list is the file's)
    const solid = (B: any) => !(B.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic)) && B.c[1] - B.h[1] < 1.5 && B.c[1] + B.h[1] >= 0.2 - 1e-9;   // (what stops a BODY: the game collides a man from 0.2 m up — squad.ts, civilians.ts — while the nav grid bakes from 0.25)
    const livedBoxes = livedIdx.map(i => ({ B: L1.boxes[i], d: dataOn[i] })), livedSolids = livedBoxes.filter(x => solid(x.B));
    const livedProps = (L1.props as any[]).filter((_, i) => isLived(data.props[i]?.id)).map((P: any, k) => ({ P, d: data.props.filter((p: any) => isLived(p.id))[k] }));
    const colLived = new StaticCollision(livedSolids.map(x => x.B));
    console.log(`  lived: ${nLived.boxes} boxes (${livedSolids.length} solid), ${nLived.props} props, ${nLived.lights} lights, ${nLived.switchables} switchables · level ${data.boxes.length} boxes, ${data.lights.length} lights`);

    // ---- the authored points
    const hands: { p: V3; d0: number; path: string }[] = [];   // things reached by hand, and how near free floor came to each before the furniture
    const pts: Pt[] = [], aims: { pos: V3; aim: V3; path: string }[] = [], rooms: { name: string; b: any }[] = [];
    const SKIP = /aim|face|look|front|normal|dir|size|^h$|half|albedo|colou?r|tint|emissive|hinge|bounds|area|^wait$/i, FLAT = /(at|pos|spot|post|stand|point|mark|spawn|exit|start)s?$/i;
    const inWorld = (x: number, z: number) => x > 0 && x < nav0.W * nav0.cell && z > 0 && z < nav0.H * nav0.cell;
    const num = (a: any, n: number) => Array.isArray(a) && a.length === n && a.every((v: any) => typeof v === 'number' && Number.isFinite(v));
    const walk = (v: any, path: string, key: string) => {
      if (v == null || typeof v !== 'object' || path === 'scenarios.kitView.sets' || /^scenarios\.kitView\.ways\[\d+\]\.add$/.test(path)) return;   // (a gear screen SET is a stage of its own, never in the level: its boxes' places are no floor point of this one — nor are a way's ADDED pieces, `add`: boxes and lamps no mission loads, a low box's centre no place a man goes)
      if (Array.isArray(v)) {
        if (num(v, 3)) {
          // (a thing reached by hand — an objective's or a holder's `front`, the breaker — is a point ON A FACE, not floor: what must stay is the floor a man
          //  stands on to reach it, the nearest free floor as it was; a lesson step's `at` is floor whatever height its marker floats at)
          if (/^front$/i.test(key) || /breaker\.pos$/.test(path)) { if (inWorld(v[0], v[2])) { const f = nav0.isBlocked(v[0], v[2]) ? nav0.nearestFreePoint(v[0], v[2]) : [v[0], 0, v[2]]; if (f && Math.hypot(f[0] - v[0], f[2] - v[2]) < 1.3) hands.push({ p: [v[0], 0, v[2]], d0: Math.hypot(f[0] - v[0], f[2] - v[2]), path }); } return; }
          if (!SKIP.test(key) && (Math.abs(v[1]) <= 0.3 || /^at$/i.test(key)) && inWorld(v[0], v[2])) pts.push({ p: [v[0], 0, v[2]], path }); return; }
        if (num(v, 2)) { if (FLAT.test(key) && !SKIP.test(key) && inWorld(v[0], v[1])) pts.push({ p: [v[0], 0, v[1]], path }); return; }
        v.forEach((x, i) => walk(x, `${path}[${i}]`, key)); return; }
      if (num(v.pos, 3) && num(v.aimAt, 3)) aims.push({ pos: v.pos, aim: v.aimAt, path });
      if (num(v.mark, 3) && num(v.watch, 3)) aims.push({ pos: v.mark, aim: v.watch, path });   // (a rescue route's leg: where a man stands and what he watches from there)
      if (v.bounds && typeof v.bounds.x0 === 'number' && (v.name || v.id)) rooms.push({ name: String(v.name ?? v.id), b: v.bounds });
      if (typeof v.x === 'number' && typeof v.z === 'number' && !('y' in v) && !('x0' in v) && inWorld(v.x, v.z) && /exfil|exit|spot|post|mark|stand/i.test(String(v.kind ?? key))) pts.push({ p: [v.x, 0, v.z], path });
      for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`, k);
    };
    for (const k of ['scenarios', 'routes', 'plans', 'mission', 'chokepoints', 'civilians', 'marks', 'breaker']) walk(data[k], k, k);
    const seen = new Set<string>(), uniq = pts.filter(q => { const s = `${Math.round(q.p[0] * 20)}:${Math.round(q.p[2] * 20)}`; if (seen.has(s)) return false; seen.add(s); return true; });

    // ---- 2. points stand
    { const bad: string[] = []; let wasBlocked = 0;
      for (const q of uniq) {
        if (nav0.isBlocked(q.p[0], q.p[2])) { wasBlocked++; continue; }
        if (nav1.isBlocked(q.p[0], q.p[2])) { bad.push(`${q.path} ${at(q.p)}: its cell is blocked`); continue; }
        const t: V3 = [q.p[0], 0, q.p[2]];
        if (livedSolids.length && colLived.collideCircle(t, 0.45, 0.2, 1.5, 1) && Math.hypot(t[0] - q.p[0], t[2] - q.p[2]) > 0.005) { bad.push(`${q.path} ${at(q.p)}: a lived solid within 0.45 m`); continue; }
        const pr = livedProps.find(x => Math.hypot(x.P.pos?.[0] - q.p[0] || x.d.x - q.p[0], x.P.pos?.[2] - q.p[2] || x.d.z - q.p[2]) < 0.7);
        if (pr) { bad.push(`${q.path} ${at(q.p)}: lived prop ${pr.d.id} within 0.7 m`); continue; }
        // (the game's own rule for a man's mark, roomclear.ts MARK_CLEAR_M: a loose prop's FOOTPRINT within 0.45 m and the room clear refuses to stage — a wide
        //  crate can keep its centre 0.7 m off and still stand in him; asked of every authored point, since a mark is not told from a waypoint here)
        const gp = livedProps.map(x => ({ x, gap: propGap({ home: [x.P.x, x.P.z, x.P.yaw ?? 0], hx: x.P.half?.[0] ?? 0, hz: x.P.half?.[1] ?? 0 }, q.p) })).find(y => y.gap < 0.45);
        if (gp) bad.push(`${q.path} ${at(q.p)}: lived prop ${gp.x.d.id}'s footprint ${gp.gap.toFixed(2)} m off (a mark wants 0.45)`);
      }
      // (a thing reached by hand keeps free floor about as near as it had — never further than a metre: the drive's reach is 1.1 — though not the same cell: a shelf
      //  beside a rack may take the nearest one and leave the next)
      for (const h of hands) { const f = nav1.isBlocked(h.p[0], h.p[2]) ? nav1.nearestFreePoint(h.p[0], h.p[2]) : h.p, d1 = f ? Math.hypot(f[0] - h.p[0], f[2] - h.p[2]) : Infinity, lim = Math.min(1.0, Math.max(h.d0, 0.6) + 0.4);
        if (d1 > lim + 1e-6) bad.push(`${h.path} ${at(h.p)}: free floor was ${f2(h.d0)} m from it, now ${d1 === Infinity ? 'none' : f2(d1) + ' m'} (≤ ${f2(lim)})`); }
      if (!uniq.length) fail(`${name}: no authored point found — the collector does not know this level's shape, so nothing was asked`);
      else if (bad.length) fail(`${name}: ${bad.length} of ${uniq.length} authored points lost their floor — ${bad.slice(0, 5).join(' · ')}`);
      else pass(`${name}: all ${uniq.length} authored points keep their floor${hands.length ? `, ${hands.length} thing${hands.length > 1 ? 's' : ''} reached by hand keep${hands.length > 1 ? '' : 's'} floor before ${hands.length > 1 ? 'them' : 'it'}` : ''}${wasBlocked ? ` (${wasBlocked} were never free in the nav grid: not asked)` : ''}`); }

    // ---- 3. aim lines
    { const bad: string[] = [];
      for (const a of aims) { const p: V3 = [a.pos[0], 1.4, a.pos[2]], q: V3 = [a.aim[0], a.aim[1] > 0.5 ? a.aim[1] : 1.2, a.aim[2]];
        if (!col0.segmentBlocked(p, q) && col1.segmentBlocked(p, q)) bad.push(`${a.path} ${at(a.pos)} → ${at(a.aim)}`); }
      if (bad.length) fail(`${name}: ${bad.length} of ${aims.length} marks' aim lines are now blocked — ${bad.slice(0, 5).join(' · ')}`);
      else pass(`${name}: ${aims.length} marks' aim lines as open as they were`); }

    // ---- 4. doors
    { const bad: string[] = [], ZONE = 1.1;
      const nearOnBox = (B: any, x: number, z: number): [number, number] => { const c = Math.cos(B.yaw || 0), s = Math.sin(B.yaw || 0), dx = x - B.c[0], dz = z - B.c[2];
        const lx = Math.max(-B.h[0], Math.min(B.h[0], dx * c - dz * s)), lz = Math.max(-B.h[2], Math.min(B.h[2], dx * s + dz * c)); return [B.c[0] + lx * c + lz * s, B.c[2] - lx * s + lz * c]; };
      for (const d of data.doors as any[]) { const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir), nx = -uz, nz = ux, mx = d.hinge[0] + ux * d.width / 2, mz = d.hinge[1] + uz * d.width / 2;
        const sees = (x: number, z: number) => [0.35, -0.35].some(k => !col0.segmentBlocked([mx + nx * k, 1.0, mz + nz * k], [x, 1.0, z], 0.02, 0));
        const near = (x: number, z: number) => { let best = Infinity, bx = x, bz = z; for (let i = 0; i <= 8; i++) { const sx = d.hinge[0] + ux * d.width * i / 8, sz = d.hinge[1] + uz * d.width * i / 8, r = Math.hypot(sx - x, sz - z); if (r < best) best = r, bx = sx, bz = sz; } return [best, bx, bz]; };
        for (const x of livedSolids) { let best = Infinity, q: [number, number] = [0, 0];
          for (let i = 0; i <= 8; i++) { const sx = d.hinge[0] + ux * d.width * i / 8, sz = d.hinge[1] + uz * d.width * i / 8, n = nearOnBox(x.B, sx, sz), r = Math.hypot(n[0] - sx, n[1] - sz); if (r < best) best = r, q = n; }
          // (seen from the doorway by ANY of: the nearest point, the centre, a corner — a cabinet flush to the door's wall has its nearest point behind the frame's own return)
          const B = x.B, cy = Math.cos(B.yaw || 0), sy = Math.sin(B.yaw || 0), probe: [number, number][] = [q, [B.c[0], B.c[2]]];
          for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) probe.push([B.c[0] + a * B.h[0] * cy + b * B.h[2] * sy, B.c[2] - a * B.h[0] * sy + b * B.h[2] * cy]);
          if (best < ZONE && probe.some(t => sees(t[0], t[1]))) bad.push(`${x.d.id} (${x.d.group}) ${f2(best)} m from door ${d.id ?? d.name}`); }
        for (const x of livedProps) { const px = x.d.x, pz = x.d.z, r = near(px, pz)[0]; if (r < ZONE + 0.3 && sees(px, pz)) bad.push(`prop ${x.d.id} ${f2(r)} m from door ${d.id ?? d.name}`); } }
      if (bad.length) fail(`${name}: ${bad.length} lived thing${bad.length > 1 ? 's' : ''} inside ${ZONE} m of a door's line — ${bad.slice(0, 6).join(' · ')}`);
      else pass(`${name}: ${data.doors.length} doors keep ${ZONE} m of floor clear of lived things`); }

    // ---- 5. one floor, walks no longer
    { const W = nav0.W, H = nav0.H, cs = nav0.cell, cellOf = (p: number[]) => Math.min(H - 1, Math.max(0, Math.floor(p[2] / cs))) * W + Math.min(W - 1, Math.max(0, Math.floor(p[0] / cs)));
      const field = (nav: any, from: number): Float64Array => { const d = new Float64Array(W * H).fill(Infinity); if (nav.blocked[from]) return d; d[from] = 0;
        const heap: [number, number][] = [[0, from]]; const push = (v: [number, number]) => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const t = heap[0], l = heap.pop()!; if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
        while (heap.length) { const [dd, c] = pop(); if (dd > d[c]) continue; const x = c % W, z = (c - x) / W;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const n = Z * W + X; if (nav.blocked[n]) continue;
            if (dx && dz && (nav.blocked[z * W + X] || nav.blocked[Z * W + x])) continue; const nd = dd + (dx && dz ? Math.SQRT2 : 1) * cs; if (nd < d[n]) { d[n] = nd; push([nd, n]); } } }
        return d; };
      const spawn = (data.mission?.playerSpawn ?? L0.playerSpawn) as number[]; let s0 = cellOf(spawn);
      if (nav0.blocked[s0]) { const f = nav0.nearestFreePoint(spawn[0], spawn[2]); if (f) s0 = cellOf(f); }
      const r0 = field(nav0, s0), r1 = field(nav1, s0);
      // cut-off floor: reachable before, not blocked now, not reachable now — grouped into pockets
      const cut = new Uint8Array(W * H); let nCut = 0; for (let i = 0; i < W * H; i++) if (r0[i] < Infinity && !nav1.blocked[i] && r1[i] === Infinity) cut[i] = 1, nCut++;
      const pockets: { n: number; x: number; z: number }[] = [];
      for (let i = 0; i < W * H; i++) if (cut[i] === 1) { let n = 0; const st = [i]; cut[i] = 2; while (st.length) { const c = st.pop()!; n++; const x = c % W, z = (c - x) / W;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const m = Z * W + X; if (cut[m] === 1) cut[m] = 2, st.push(m); } }
        pockets.push({ n, x: (i % W + 0.5) * cs, z: (Math.floor(i / W) + 0.5) * cs }); }
      const big = pockets.filter(p => p.n >= 3);
      if (big.length) fail(`${name}: lived things cut ${nCut} cells of floor off from the spawn — ${big.slice(0, 5).map(p => `${p.n} cells at ${at([p.x, p.z])}`).join(' · ')}`);
      else pass(`${name}: every cell a man could walk to from the spawn he still can${pockets.length ? ` (${pockets.length} pocket${pockets.length > 1 ? 's' : ''} under 3 cells)` : ''}`);
      for (const p of pockets.filter(p => p.n < 3)) warn(`${name}: a ${p.n}-cell pocket at ${at([p.x, p.z])} is walled in by furniture`);
      const free = uniq.filter(q => !nav0.blocked[cellOf(q.p)] && !nav1.blocked[cellOf(q.p)]), bad: { s: string; k: number }[] = []; let pairs = 0;
      const cells = [...new Set(free.map(q => cellOf(q.p)))], label = new Map<number, string>(); for (const q of free) if (!label.has(cellOf(q.p))) label.set(cellOf(q.p), `${q.path} ${at(q.p)}`);
      for (const a of cells) { const d0 = field(nav0, a), d1 = field(nav1, a);
        for (const b of cells) { if (b <= a || d0[b] === Infinity) continue; pairs++;
          if (d1[b] > d0[b] * 1.3 + 1.5) bad.push({ s: `${label.get(a)} ↔ ${label.get(b)}: ${f2(d0[b])} m → ${d1[b] === Infinity ? 'no way' : f2(d1[b]) + ' m'}`, k: d1[b] - d0[b] }); } }
      bad.sort((x, y) => y.k - x.k);
      if (bad.length) fail(`${name}: ${bad.length} of ${pairs} walks between authored points are more than 30 % + 1.5 m longer — ${bad.slice(0, 4).map(x => x.s).join(' · ')}`);
      else pass(`${name}: ${pairs} walks between authored points are no more than 30 % + 1.5 m longer`); }

    // ---- 6. budget
    if (data.lights.length > 64) fail(`${name}: ${data.lights.length} lights (64 a frame)`); else pass(`${name}: ${data.lights.length} authored lights (≤ 64; level-lint counts what a frame carries, emitters in)`);

    // ---- a low solid the grid cannot see: a body is stopped by anything topping out at 0.2 m or over, the nav grid bakes from 0.25 — a lived solid whose top
    //      is in between stalls a walker on a cell his path calls free (the bazaar's ghost, on a two-sack stack at exactly 0.2)
    { const bad: string[] = [];
      for (const x of livedBoxes) { const B = x.B, top = B.c[1] + B.h[1]; if ((B.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic)) || top < 0.2 - 1e-9 || top >= 0.25 || B.c[1] - B.h[1] >= 1.5) continue;
        const cy = Math.cos(B.yaw || 0), sy = Math.sin(B.yaw || 0), probe: [number, number][] = [[B.c[0], B.c[2]]];
        for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) probe.push([B.c[0] + a * B.h[0] * cy + b * B.h[2] * sy, B.c[2] - a * B.h[0] * sy + b * B.h[2] * cy]);
        if (probe.some(t => !nav1.isBlocked(t[0], t[1]))) bad.push(`${x.d.id} (${x.d.group}) top ${top.toFixed(3)} at ${at([B.c[0], B.c[2]])}`); }
      if (bad.length) fail(`${name}: ${bad.length} lived solid${bad.length > 1 ? 's top' : ' tops'} out between 0.20 and 0.25 m on floor the nav grid calls free (a man is stopped where his path says walk: make it 0.19 or under, or 0.26 or over) — ${bad.slice(0, 6).join(' · ')}`);
      else pass(`${name}: no lived solid in the 0.20‥0.25 m band the nav grid cannot see`);
      // (the same gap at the top: the nav grid and every AI body ask up to 1.5 m, a standing Sam up to 1.7 — a lived solid whose underside is between the two over free floor stops him alone, where every guard walks under it)
      const high: string[] = [];
      for (const x of livedBoxes) { const B = x.B, bot = B.c[1] - B.h[1]; if ((B.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic)) || bot < 1.5 - 1e-9 || bot >= 1.7) continue;
        const cy = Math.cos(B.yaw || 0), sy = Math.sin(B.yaw || 0), probe: [number, number][] = [[B.c[0], B.c[2]]];
        for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) probe.push([B.c[0] + a * B.h[0] * cy + b * B.h[2] * sy, B.c[2] - a * B.h[0] * sy + b * B.h[2] * cy]);
        if (probe.some(t => !nav1.isBlocked(t[0], t[1]))) high.push(`${x.d.id} (${x.d.group}) underside ${bot.toFixed(3)} at ${at([B.c[0], B.c[2]])}`); }
      if (high.length) fail(`${name}: ${high.length} lived solid${high.length > 1 ? 's hang' : ' hangs'} with the underside between 1.50 and 1.70 m over floor the nav grid calls free (a standing player is stopped where every guard walks under: make it drawn only, or lower / raise it) — ${high.slice(0, 6).join(' · ')}`);
      else pass(`${name}: no lived solid hangs in the 1.50‥1.70 m band only a standing player meets`); }

    // ---- 7. nothing stands in anything: a lived solid on a kept prop, a lived prop in a solid (props are not in the nav grid, so no check above sees either)
    { const bad: string[] = [], nearOn = (B: any, x: number, z: number): [number, number] => { const c = Math.cos(B.yaw || 0), s = Math.sin(B.yaw || 0), dx = x - B.c[0], dz = z - B.c[2];
        const lx = Math.max(-B.h[0], Math.min(B.h[0], dx * c - dz * s)), lz = Math.max(-B.h[2], Math.min(B.h[2], dx * s + dz * c)); return [B.c[0] + lx * c + lz * s, B.c[2] - lx * s + lz * c]; };
      const foot = (P: any) => ({ home: [P.x, P.z, P.yaw ?? 0] as [number, number, number], hx: P.half?.[0] ?? 0, hz: P.half?.[1] ?? 0 });
      const inProp = (P: any, B: any) => { const n = nearOn(B, P.x, P.z); return propGap(foot(P), [n[0], 0, n[1]]) <= 0 && B.c[1] - B.h[1] < (P.height ?? 1); };   // (the box's nearest point to the prop's centre lies inside the prop's footprint: they overlap — sound, and it can miss a corner-to-corner graze)
      const keptProps = (L1.props as any[]).filter((_, i) => !isLived(data.props[i]?.id)), allSolids = (L1.boxes as any[]).filter(solid);
      for (const x of livedSolids) for (const P of keptProps) if (inProp(P, x.B)) { const s = `${x.d.id} (${x.d.group}) stands in the level's own prop ${P.name}`; if (x.B.c[1] - x.B.h[1] < 0.3) bad.push(s); else warn(`${name}: ${s} (over it, off the floor)`); }
      for (const x of livedProps) for (const B of allSolids) if (inProp(x.P, B)) { const s = `prop ${x.d.id} stands in a solid at ${at([B.c[0], B.c[2]])}`; if (B.c[1] - B.h[1] < 0.3) bad.push(s); else warn(`${name}: ${s} (under it, e.g. tucked under a table top: check it by eye)`); }
      // (a lived solid whose CENTRE is inside a solid of the level's own is mostly hidden in it — a trough stood in a wood pile; flush against a wall or on a table top its centre is outside. A warning: the plan is the judge)
      { const keptSolids = (L1.boxes as any[]).filter((B, i) => solid(B) && !isLived(data.boxes[i]?.group)), sunk: string[] = [];
        for (const x of livedSolids) { const c = x.B.c; for (const B of keptSolids) { if (Math.abs(c[1] - B.c[1]) > B.h[1] - 0.02) continue; const co = Math.cos(B.yaw || 0), si = Math.sin(B.yaw || 0), dx = c[0] - B.c[0], dz = c[2] - B.c[2];
          if (Math.abs(dx * co - dz * si) < B.h[0] - 0.02 && Math.abs(dx * si + dz * co) < B.h[2] - 0.02) { sunk.push(`${x.d.id} (${x.d.group}) at ${at([c[0], c[2]])}`); break; } } }
        if (sunk.length) warn(`${name}: ${sunk.length} lived solid${sunk.length > 1 ? 's have their centres' : ' has its centre'} inside a solid of the level's own (hidden in it? look at the plan): ${sunk.slice(0, 6).join(' · ')}`); }
      // (…and box against box, for the pairs with no turn on either: a lived solid PUSHED more than 5 cm into a kept one on all three axes — a crate half in a wall — with its centre still
      //  outside, which the test above passes. A warning: a shelf let into an alcove is meant)
      { const keptSolids = (L1.boxes as any[]).filter((B, i) => solid(B) && !isLived(data.boxes[i]?.group) && !(B.yaw || 0)), dug: string[] = [];
        for (const x of livedSolids) { if (x.B.yaw || 0) continue; const A = x.B; for (const B of keptSolids) { let d = Infinity; for (let k = 0; k < 3; k++) d = Math.min(d, A.h[k] + B.h[k] - Math.abs(A.c[k] - B.c[k]));
          if (d > 0.05) { dug.push(`${x.d.id} (${x.d.group}) at ${at([A.c[0], A.c[2]])}, ${(d * 100).toFixed(0)} cm`); break; } } }
        if (dug.length) warn(`${name}: ${dug.length} lived solid${dug.length > 1 ? 's are' : ' is'} pushed into a solid of the level's own: ${dug.slice(0, 6).join(' · ')}`); }
      if (bad.length) fail(`${name}: ${bad.length} thing${bad.length > 1 ? 's' : ''} standing in another — ${bad.slice(0, 6).join(' · ')}`);
      else pass(`${name}: no lived solid stands in a prop of the level's, no lived prop in a solid`); }
    // (the look's own rugs and patches are dealt as if the furniture were not there: a lived floor piece at a decal's height under it shimmers with the switch on)
    { let n = 0, eg = ''; const flat = (B: any) => (B.flags & BoxFlag.NoShadow) && B.c[1] + B.h[1] < 0.12;
      const looks = (L1.boxes as any[]).filter((B, i) => data.boxes[i]?.group === 'look' && flat(B));
      for (const x of livedBoxes) if (flat(x.B)) for (const D of looks) { const ox = Math.min(x.B.c[0] + x.B.h[0], D.c[0] + D.h[0]) - Math.max(x.B.c[0] - x.B.h[0], D.c[0] - D.h[0]), oz = Math.min(x.B.c[2] + x.B.h[2], D.c[2] + D.h[2]) - Math.max(x.B.c[2] - x.B.h[2], D.c[2] - D.h[2]);
        if (ox > 0.1 && oz > 0.1 && ox * oz > 0.05 && Math.abs((x.B.c[1] + x.B.h[1]) - (D.c[1] + D.h[1])) < 0.003) { n++; eg ||= `${x.d.id} (${x.d.group}) at ${at([x.B.c[0], x.B.c[2]])}`; } }
      if (n) warn(`${name}: ${n} lived floor piece${n > 1 ? 's lie' : ' lies'} at the same height as a decal of the look over the same floor (they will fight in the picture): ${eg}`); }
    if (data.boxes.length > 900) warn(`${name}: ${data.boxes.length} boxes (the page asks ≤ ~900 a level)`);

    // ---- the sheet
    if (sheet) { const by = new Map<string, any>();
      const row = (room: string) => { let r = by.get(room); if (!r) by.set(room, r = { solids: 0, clutter: 0, floor: 0, props: 0, lights: 0, sw: 0, mats: new Set<string>(), x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }); return r; };
      const roomOf = (tag: string) => tag.split('.')[1] ?? '(no room)';
      for (const x of livedBoxes) { const r = row(roomOf(x.d.group)), B = x.B; r.mats.add(String(x.d.material ?? 'inline'));
        if (B.flags & BoxFlag.NoShadow) { if (B.c[1] + B.h[1] < 0.12 && B.h[0] * B.h[2] > 0.25) r.floor++; else r.clutter++; } else r.solids++;
        r.x0 = Math.min(r.x0, B.c[0]); r.x1 = Math.max(r.x1, B.c[0]); r.z0 = Math.min(r.z0, B.c[2]); r.z1 = Math.max(r.z1, B.c[2]); }
      for (const p of data.props) if (isLived(p.id)) row(roomOf(p.id)).props++;
      for (const l of data.lights) if (isLived(l.id)) row(roomOf(l.id)).lights++;
      for (const s of data.switchables) if (isLived(s.id)) row(roomOf(s.id)).sw++;
      console.log(`  sheet — room · solids · drawn-only clutter · floor pieces · props · lights (switchable) · paints · where`);
      for (const [room, r] of [...by].sort()) console.log(`    ${room.padEnd(18)} ${String(r.solids).padStart(3)} · ${String(r.clutter).padStart(3)} · ${r.floor} · ${r.props} · ${r.lights} (${r.sw}) · ${r.mats.size} · x ${f2(r.x0)}‥${f2(r.x1)} z ${f2(r.z0)}‥${f2(r.z1)}`);
      const seenRoom = new Set<string>();
      for (const R of rooms) { if (seenRoom.has(R.name)) continue; seenRoom.add(R.name);
        const n = livedBoxes.filter(x => x.B.c[0] >= R.b.x0 && x.B.c[0] <= R.b.x1 && x.B.c[2] >= R.b.z0 && x.B.c[2] <= R.b.z1).length;
        if (!n) warn(`${name}: the level's own room '${R.name}' has no lived thing inside its bounds`); else if (!quiet) console.log(`    (${R.name}: ${n} lived boxes inside its bounds)`); } }
  }
  console.log(ok ? `\n=== lived-check: ALL PASS (${checks} checks) ===` : `\n=== lived-check: FAILED ===`);
  return ok;
}

if (import.meta.main) { const r = await livedCheck(process.argv.slice(2)); process.exit(r === false ? 1 : 0); }
