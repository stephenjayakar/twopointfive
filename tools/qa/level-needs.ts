// WHAT A LEVEL NEEDS, ASKED OF A LEVEL — the checker of .claude/skills/level/SKILL.md (the list of everything a level has been seen to need, each item with
// what was missed when it was learnt). It asks what stands AROUND a level's file: the tables it is registered in, the kit its team is issued, and three
// things about its boxes that no other check holds. The floor itself (structure, nav, size, the scripted runs) is tools/qa/map-check.ts's, which --run runs.
// Read off the level FILES and the tables: no game is stood up, nothing is played.
//   bun run tools/qa/level-needs.ts [name …] [--run] [--jobs 4] [--skip need,…] [--quiet] [--md out.md] [--json out.json]
//     name      levels to ask (levels/<name>.json; a look twin `<name>-gwot.json` is asked with its plain file, never by itself); none = every level file
//     --run     also run the level's OWN checks as they stand (export --check, map-check --no-runs, level-lint, door-size, second-way-check, lived-check,
//               kitview-plan, level-names-check, floor-order-check, quiet-check, lesson-check), each a line with its exit code, `--jobs` at a time
//     --skip    needs left out (their names below): to see the exit code of the rest while one is red everywhere
//     --quiet   FAIL and NOTE lines only, and the tally
//     --md      a table, a row per level and a column per need, written to a file (the statement of how the levels stand)
//   NEEDS_BREAK=1 bun run tools/qa/level-needs.ts    the red path: one level is given every gap this tool can see (in memory: nothing is written) and each
//               must be found: exit 1 = every planted gap was found, 0 = one was MISSED (the line says which)
//   run it on BOTH stands (TPS_PROFILE=shipped in front): --run's own checks are the stand's. THE NEEDS THEMSELVES ARE ASKED OF THE PAGE AS IT OPENS on
//               either stand (host/profile.ts pageSwitches with no flag and the kit read with nothing kept, as the shipped stand boots): a rule the
//               frozen stand holds off would call a man bare whom no player sees bare. `KITDEAL_BREAK=1` in front shows the cards as the table
//               writes them: red on every row that brings a third man
// exit 0 = no FAIL · 1 = a FAIL (a NOTE never fails) · 2 = no such level, or an unknown need to skip
// WHAT IS ASKED (the word in front is the need's name in the table and in the skill):
//   generator   the file says which generator wrote it, and that generator is in the tree
//   mission     a row of scene/scenarioList.ts plays it (a NOTE without one: a yard, a test floor)
//   row         each row's words are there and the length the lists hold them to (place 6‥64; blurb 20‥160, a squad row's 20‥140), it names as many
//               ways in as the file gives starts, its defenders are the cap's eleven or fewer, and it says `squads` exactly when the file carries defender
//               squads; a NOTE while it is `untuned`
//   music       audio/setlist.ts has the level's two pieces (the game's own lookup, by level and by kind)
//   picture     each row's mission picture is on disk and in the stills list
//   kit picture the Team & kit picture's block is in the file (a lesson's is data only: not asked), and a look twin carries the same block to the byte
//   look        the look twin and scene/look.ts agree; a loud level with neither a twin nor the look's own kit is a NOTE (it plays in the plain look alone)
//   lived       the rooms the level names have things standing in them (lived-in things, the generator's own furniture, loose props); a NOTE names the
//               bare ones. A count, not a judgement: whether a room has a use and a face is the eye's
//   floor       a NOTE where the file has no footstep map of its own (it is walked on the office's rectangles, or a quiet level on lino throughout)
//   lamps       a NOTE for each lamp under open sky that is not in the light group `exterior` (the photocell puts those out at midday: any other burns
//               through the day, which is right only for a lamp the mission switches itself)
//   moon        one directional light, in `exterior` (the hour's sun goes in at its place)
//   doorway     no painted band or other wall decal runs across a doorway
//   roof        no DRAWN slab at ceiling height (the camera cannot see the room under it), and no more roofs than the rain reads (four)
//   kit         as issued, at every team size the row offers, every man who comes carries something besides his gun. The issue is ONE table for five men
//               (game/kit.ts), worn shared out over the men who come (KITDEAL, kitWorn), a level's own cards written over the table's first as a
//               staging does: were the table to leave a man bare this is red on every row that brings him, and the mend is that table's, not a
//               level's. Bare = no pouch filled and nothing in the big slot.
//               NOTES for what the issue is for on this floor: locked and steel doors against the door charges issued, frags issued where a frag on
//               order is refused (a hostage, a man to take), a quiet mission's partner kitted as issued for a loud one
//   said        docs/agents names the level (its file, its generator or a row's id) — that a write-up is THERE, not that it is good
import { resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { setlistNames } = await import(`${ROOT}/src/audio/setlist.ts`);
const { LOOK_LEVELS } = await import(`${ROOT}/src/scene/look.ts`);
const { squadChoices, rosterOf } = await import(`${ROOT}/src/game/loadout.ts`);
const { kitDefault, kitWorn, kitIssueCards, kitCost, kitTeam, kitLoad, bigOf, SLOTS, KIT_MEMBERS } = await import(`${ROOT}/src/game/kit.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { harnessProfile, pageSwitches } = await import(`${ROOT}/src/host/profile.ts`);

interface Box { id: string; group?: string; c: number[]; h: number[]; yaw?: number; flags?: string[] }
interface Light { id: string; kind: string; pos: number[]; group?: string }
interface Door { id: string; hinge: number[]; closedDir: number; width: number; locked?: boolean; steel?: boolean }
interface Bounds { x0: number; x1: number; z0: number; z1: number }
type Card = Record<string, unknown>;
interface LevelFile { meta?: { generator?: string }; boxes: Box[]; props?: { id: string; x: number; z: number }[]; lights: Light[]; doors: Door[]; surfaces?: unknown;
  scenarios?: { roomClear?: { starts?: unknown[]; squads?: unknown[]; wallCharges?: number; rooms?: { name: string; bounds?: Bounds }[] }; rescue?: { room?: { name: string; bounds?: Bounds } };
    quiet?: { starts?: unknown[]; spots?: { place: string; area?: Bounds }[] }; places?: { areas?: { name: string; bounds: Bounds }[] }; lesson?: unknown; snatch?: unknown; kitView?: unknown; issue?: { members: Record<string, Card> } } }
interface Row { id: string; title: string; kind: 'nightbreach' | 'roomclear' | 'rescue' | 'quiet'; squad: number; level?: string; group?: string; only?: string; place?: string; blurb?: string;
  untuned?: boolean; offList?: boolean; defenders?: number; ways?: readonly string[]; squads?: boolean }
/** the tables a level is registered in, as the tree has them (the red path hands a level its own, with every row taken out) */
interface Tables { music(level: string, kind: string): boolean; still(id: string): boolean; picture(id: string): boolean; docs: string; /** the five cards as n teammates wear them: the issue with a level's own cards (`block`, by place on the roster) written over it, then dealt over the men who come where the game deals them (game/kit.ts kitWorn, as a staging and ui/loadout.ts read them) */ cards(n: number, block: Record<string, Card>): Card[] }

type Mark = 'PASS' | 'FAIL' | 'NOTE';
interface Line { need: string; mark: Mark; text: string }
export const NEEDS = ['generator', 'mission', 'row', 'music', 'picture', 'kit picture', 'look', 'lived', 'floor', 'lamps', 'moon', 'doorway', 'roof', 'kit', 'said'] as const;

/** the cap on the men who hold a floor (the balance rule: eleven) */
const DEFENDERS_MAX = 11;
/** a row's words, as the lists hold them: the mission sheet's place line, the blurb (the start card holds a squad row's to the shorter) */
const WORDS = { place: [6, 64], blurb: [20, 160], squadBlurb: [20, 140] } as const;
/** a wall decal: a drawn-only box this thin, standing this tall, that starts below a door's head */
const DECAL = { thin: 0.02, tall: 0.05, head: 1.9, off: 0.3, jamb: 0.05, across: 0.1 };
/** the office's building (its footstep map's own rectangle: levels/office.json surfaces.building) */
const OFFICE = { x0: 4, x1: 36, z0: 4, z1: 24 };
/** a bare room: fewer than this many things standing in it (a thing: a loose prop, or a box that is not the building's own or the weather's, taller than a
 *  floor decal, starting under head height) */
const BARE = { things: 3, top: 0.12, under: 1.9 };
const STRUCTURE = /(^|\.)(ground|floors?|ceiling|roof|walls?|doorframe|beacons|lights|lamps|exterior|look|breaker|devices|road|lot|outside|kerb|snow)(\.|$)/;
/** cover over a lamp: a slab over it (its underside no lower than the lamp's own height less this), at least this far across (weather.ts roofsOf's width) */
const COVER = { below: 0.3, half: 0.45, pad: 0.06 };

const f2 = (v: number) => v.toFixed(2);
const has = (b: Box, f: string) => !!b.flags?.includes(f);
const inside = (r: Bounds, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const plainOf = (name: string) => name.replace(/-gwot$/, '');
const onDisk = (name: string) => existsSync(resolve(ROOT, 'levels', `${name}.json`));
const FILES = new Map<string, LevelFile>();
const read = (name: string): LevelFile => { let L = FILES.get(name); if (!L) FILES.set(name, L = JSON.parse(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')) as LevelFile); return L; };
export const rowsOf = (name: string): Row[] => (ALL_MISSIONS as Row[]).filter(e => (e.level ?? 'office.json') === `${name}.json`);
/** the generator a file names (meta.generator), as a path in the tree */
const generatorOf = (L: LevelFile) => L.meta?.generator?.match(/[\w./-]+\.ts/)?.[0] ?? null;
/** the slabs in the rain's roof band (game/weather.ts roofsOf: underside from 0.25 m under the ceiling's height, top no more than 0.45 m over it, 0.9 m
 *  across both ways) */
const roofBand = (L: LevelFile) => L.boxes.filter(b => b.c[1] - b.h[1] >= WORLD.ceilingY - 0.25 && b.c[1] + b.h[1] <= WORLD.ceilingY + 0.45 && b.h[0] >= 0.45 && b.h[2] >= 0.45);

/** DOORWAY: the wall decals that run across a door's opening — a drawn-only box (NoShadow), thin along the wall's normal, standing taller than a floor
 *  decal's few millimetres, on a face within a wall's thickness of the door's line and over more than a hand of the opening between the jambs. */
export function decalsAcross(L: LevelFile): string[] {
  const out: string[] = [];
  for (const d of L.doors) {
    const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir); if (Math.abs(ux) > 1e-3 && Math.abs(uz) > 1e-3) continue;   // (a door hung off the axes: not asked)
    const alongZ = Math.abs(uz) > 0.5, a = alongZ ? 2 : 0, n = alongZ ? 0 : 2;   // the leaf's line runs along axis a; the wall's normal is axis n
    const h0 = d.hinge[alongZ ? 1 : 0], h1 = h0 + d.width * (alongZ ? uz : ux), lo = Math.min(h0, h1) + DECAL.jamb, hi = Math.max(h0, h1) - DECAL.jamb, at = d.hinge[alongZ ? 0 : 1];
    for (const b of L.boxes) {
      if (!has(b, 'NoShadow') || has(b, 'Glass') || b.yaw || b.h[n] > DECAL.thin || b.h[1] < DECAL.tall || b.c[1] - b.h[1] > DECAL.head) continue;
      if (Math.abs(b.c[n] - at) > DECAL.off) continue;
      const over = Math.min(hi, b.c[a] + b.h[a]) - Math.max(lo, b.c[a] - b.h[a]);
      if (over > DECAL.across) out.push(`${b.id} (${b.group ?? 'no group'}) runs ${f2(over)} m across door '${d.id}'`);
    }
  }
  return out;
}
/** ROOF: `drawn` the slabs at ceiling height the camera cannot see through (no NoPrimary: the kit's ceiling carries it), `n` how many slabs there are */
export function roofs(L: LevelFile): { n: number; drawn: string[] } {
  const band = roofBand(L);
  return { n: band.length, drawn: band.filter(b => !has(b, 'NoPrimary') && !has(b, 'Glass')).map(b => `${b.id} (${b.group ?? 'no group'}) at [${f2(b.c[0])}, ${f2(b.c[2])}]`) };
}
/** LAMPS: the lamps with open sky over them that are not in the photocell's group */
export function lampsOutside(L: LevelFile): string[] {
  const covered = (x: number, y: number, z: number) => L.boxes.some(b => b.c[1] - b.h[1] >= y - COVER.below && b.h[0] >= COVER.half && b.h[2] >= COVER.half
    && Math.abs(x - b.c[0]) <= b.h[0] + COVER.pad && Math.abs(z - b.c[2]) <= b.h[2] + COVER.pad);
  return L.lights.filter(l => l.kind !== 'dir' && l.group !== 'exterior' && !covered(l.pos[0], l.pos[1], l.pos[2])).map(l => `${l.id} (group ${l.group ?? 'none'})`);
}
/** KIT: who comes with nothing but his gun, as issued, at each size the row offers — the game's own issue cards, priced by the game's own pouches
 *  (game/kit.ts kitCost: a card that fills none carries nothing), with the level's own issue written over them where a staging would put it on
 *  (scenarios.issue through kitIssueCards; never on a lesson's level, whose page plays the plain issue with the block unread) */
const issueOf = (L: LevelFile): Record<string, Card> => (L.scenarios?.lesson ? {} : kitIssueCards(L.scenarios?.issue?.members ?? {}) as Record<string, Card>);
export function bareMen(L: LevelFile, e: Row, T: Tables): string[] {
  const issue = issueOf(L), out: string[] = [];
  for (const c of squadChoices(e) as { n: 0 | 1 | 2 | 3 | 4; ok: boolean }[]) {
    if (!c.ok || c.n === 0) continue;
    const names = (rosterOf(c.n) as { name: string }[]).map(m => m.name), bare: string[] = [];
    const worn = T.cards(c.n, issue);
    for (let i = 1; i <= c.n; i++) if (kitCost(i, worn[i]).used === 0 && bigOf(worn[i]) === 'none') bare.push(names[i - 1] ?? `teammate ${i}`);   // (tools/qa/kitdeal-check.ts comesBare)
    if (bare.length) out.push(`you + ${c.n}: ${bare.join(', ')}`);
  }
  return out;
}
/** the rooms a level names (the room clear's, the rescue's, the quiet spots', its places) */
function roomsOf(L: LevelFile): { name: string; bounds: Bounds }[] {
  const S = L.scenarios ?? {}, out: { name: string; bounds: Bounds }[] = [];
  for (const r of S.roomClear?.rooms ?? []) if (r.bounds) out.push({ name: r.name, bounds: r.bounds });
  if (S.rescue?.room?.bounds) out.push({ name: S.rescue.room.name, bounds: S.rescue.room.bounds });
  for (const s of S.quiet?.spots ?? []) if (s.area) out.push({ name: s.place, bounds: s.area });
  for (const a of S.places?.areas ?? []) out.push({ name: a.name, bounds: a.bounds });
  return out.filter((r, i) => out.findIndex(o => o.name === r.name) === i);
}

/** every need, asked of one level (`twin`: its look file, where it has one) */
export function ask(name: string, L: LevelFile, twin: LevelFile | null, rows: Row[], T: Tables): Line[] {
  const out: Line[] = [], say = (need: string, ok: boolean | 'note', text: string) => out.push({ need, mark: ok === 'note' ? 'NOTE' : ok ? 'PASS' : 'FAIL', text });
  const S = L.scenarios ?? {}, lesson = !!S.lesson, loud = rows.some(e => e.kind === 'roomclear' || e.kind === 'rescue') && !lesson, gen = generatorOf(L), genThere = !!gen && existsSync(resolve(ROOT, gen));
  // ---- generator
  say('generator', genThere, gen ? `written by ${gen}${genThere ? '' : ', which is not in the tree'}` : 'the file does not say which generator wrote it (meta.generator)');
  // ---- mission, and each row
  if (!rows.length) say('mission', 'note', 'no row of scene/scenarioList.ts plays it: nothing below that asks a row is asked');
  else say('mission', true, rows.map(e => `${e.id}${e.offList ? ' (off the list)' : ''}`).join(', '));
  for (const e of rows) {
    const bad: string[] = [], len = (what: string, s: string | undefined, [lo, hi]: readonly [number, number]) => { if (!s) { if (!e.offList) bad.push(`no \`${what}\``); } else if (s.length < lo || s.length > hi) bad.push(`\`${what}\` is ${s.length} characters, the lists hold it to ${lo}‥${hi}`); };
    len('place', e.place, WORDS.place); len('blurb', e.blurb, e.kind !== 'quiet' && e.group !== 'training' ? WORDS.squadBlurb : WORDS.blurb);
    if ((e.defenders ?? 0) > DEFENDERS_MAX) bad.push(`${e.defenders} defenders, the cap is ${DEFENDERS_MAX}`);
    if (name !== 'office') {
      const starts = e.kind === 'roomclear' ? S.roomClear?.starts?.length ?? 0 : 0, want = starts ? starts + 1 : 0;
      if ((e.ways?.length ?? 0) !== want) bad.push(`names ${e.ways?.length ?? 0} ways in, the file gives ${want || 'one (no row of ways)'}`);
      if (e.kind === 'roomclear' && !!e.squads !== !!S.roomClear?.squads?.length) bad.push(e.squads ? '`squads` on the row, no defender squads in the file' : 'defender squads in the file, no `squads` on the row');
    }
    say('row', !bad.length, `${e.id}: ${bad.length ? bad.join('; ') : 'words, ways and defenders agree with the file'}`);
    if (e.untuned) say('row', 'note', `${e.id} is marked untuned: nobody has said it plays well`);
  }
  // ---- music, pictures
  { const none = rows.filter(e => !T.music(name, e.kind)).map(e => e.id);
    if (rows.length) say('music', !none.length, none.length ? `no row in audio/setlist.ts SETLISTS for ${none.join(', ')}: the list for a level nobody chose for is played` : 'its two pieces are in audio/setlist.ts'); }
  for (const e of rows) { const disk = T.picture(e.id), list = T.still(e.id);
    say('picture', disk && list, `${e.id}: ${disk && list ? 'public/assets/menu has its picture' : !disk ? `no public/assets/menu/${e.id}.jpg (the card falls back to the drawn plan)` : 'on disk, not in stills.json'}`); }
  // ---- the Team & kit picture
  if (rows.length && !lesson) {
    const own = name === 'office' ? /KIT_VIEW/.test(readFileSync(resolve(ROOT, 'levels/office.scenarios.ts'), 'utf8')) : S.kitView !== undefined;
    say('kit picture', own, own ? 'the file carries a kitView block' : 'no scenarios.kitView: Team & kit shows the standing man');
    if (twin && own) { const same = JSON.stringify(twin.scenarios?.kitView) === JSON.stringify(S.kitView); say('kit picture', same, same ? 'the look twin carries the same block' : 'the look twin\'s kitView block is not the plain file\'s'); }
  }
  // ---- the look twin
  { const listed = (LOOK_LEVELS as Record<string, string>)[`${name}.json`], there = onDisk(`${name}-gwot`);
    if (listed || there) say('look', !!listed && there, listed && there ? `${listed} is listed in scene/look.ts and on disk` : listed ? `${listed} is listed in scene/look.ts and not on disk` : `levels/${name}-gwot.json is on disk and not in scene/look.ts LOOK_LEVELS: never loaded`);
    else if (loud && name !== 'office') { const kit = genThere && /gwotKit/.test(readFileSync(resolve(ROOT, gen!), 'utf8'));
      say('look', kit ? true : 'note', kit ? 'built on the look\'s own kit: one file' : 'a loud level with no look twin, not built on the look\'s kit: it plays in the plain look alone'); } }
  // ---- lived-in rooms: a room with fewer than three things standing in it is bare (a `lived` thing, the generator's own furniture, a loose prop)
  { const rooms = roomsOf(L), n = (r: Bounds) => L.boxes.filter(b => inside(r, b.c[0], b.c[2]) && b.c[1] + b.h[1] > BARE.top && b.c[1] - b.h[1] < BARE.under && !STRUCTURE.test(b.group ?? '')).length + (L.props ?? []).filter(p => inside(r, p.x, p.z)).length;
    const bare = rooms.filter(r => n(r.bounds) < BARE.things).map(r => r.name);
    if (rows.length && rooms.length) { say('lived', bare.length < rooms.length, bare.length < rooms.length ? `${rooms.length - bare.length} of ${rooms.length} named rooms have things standing in them` : `every one of its ${rooms.length} named rooms is bare: walls, doors and nothing else`);
      if (bare.length && bare.length < rooms.length) say('lived', 'note', `fewer than ${BARE.things} things stand in: ${bare.join(', ')}`); } }
  // ---- the floor underfoot
  if (rows.length && name !== 'office') { const own = L.surfaces !== undefined, R = roofBand(L), near = (v: number, w: number) => Math.abs(v - w) < 0.3;
    const shell = R.length > 0 && Math.min(...R.map(b => b.c[0] - b.h[0])) < OFFICE.x0 + 0.3 && near(Math.max(...R.map(b => b.c[0] + b.h[0])), OFFICE.x1) && near(Math.min(...R.map(b => b.c[2] - b.h[2])), OFFICE.z0) && near(Math.max(...R.map(b => b.c[2] + b.h[2])), OFFICE.z1);
    say('floor', own ? true : 'note', own ? 'its own footstep map' : `no \`surfaces\` block: ${S.quiet ? 'every step is on lino, the yard\'s too' : shell ? 'built in the office\'s shell and walked on the office\'s footstep map: right only where its rooms lie as the office\'s do' : 'walked on the office\'s footstep map, and the building is not where the office\'s is: its carpet, lino and stone fall where they fall'}`); }
  // ---- lamps and the moon
  for (const [who, F] of [['', L], ['look twin: ', twin]] as const) { if (!F) continue;
    const lamps = lampsOutside(F); if (who && !lamps.length) continue;
    say('lamps', lamps.length ? 'note' : true, who + (lamps.length ? `under open sky and not on the photocell (group exterior), so lit at midday; right only for a lamp the mission switches itself: ${lamps.join(', ')}` : 'every lamp under open sky is on the photocell')); }
  { const moons = L.lights.filter(l => l.kind === 'dir');
    say('moon', moons.length === 1 && moons[0].group === 'exterior', moons.length === 1 ? moons[0].group === 'exterior' ? `one moon ('${moons[0].id}')` : `the moon '${moons[0].id}' is in group ${moons[0].group ?? 'none'}, not exterior` : `${moons.length} directional lights: the hour's sun wants one moon to stand in for`); }
  // ---- doorways and roofs, the look twin's too (its decals are its own)
  for (const [who, F] of [['', L], ['look twin: ', twin]] as const) { if (!F) continue;
    const across = decalsAcross(F), R = roofs(F);
    if (!who || across.length) say('doorway', !across.length, who + (across.length ? across.join('; ') : `no wall decal crosses any of ${F.doors.length} doorways`));
    if (!who || R.drawn.length) say('roof', !R.drawn.length, who + (R.drawn.length ? `a drawn slab at ceiling height hides what is under it: ${R.drawn.join('; ')}` : `${R.n} ceiling slabs, each seen through`));
    if (!who && R.n > 4) say('roof', 'note', `${R.n} slabs at ceiling height: the rain reads the four biggest`); }
  // ---- the kit as issued
  const mates = (e: Row) => (squadChoices(e) as { n: number; ok: boolean }[]).some(c => c.ok && c.n > 0);   // (false: a row played alone, no teammate to ask)
  for (const e of rows) { if (!mates(e)) continue;
    const bare = bareMen(L, e, T), walls = S.roomClear?.wallCharges, wrote = lesson ? 0 : Object.keys(S.issue?.members ?? {}).length, wears = Object.keys(issueOf(L)).length;
    const ownCards = !wrote ? '' : wears === wrote ? ' (the level issues its own cards)' : ` (the level writes ${wrote} card${wrote > 1 ? 's' : ''} of its own; ${wears ? `${wrote - wears} not` : 'none'} worn while the shield is out of the game: the plain issue is, there)`;
    say('kit', !bare.length, `${e.id}: ${bare.length ? `as issued, nothing but a gun on ${bare.join(' · ')}` : 'as issued, every man who comes carries something'}${walls ? ` (the level issues ${walls} wall charge${walls > 1 ? 's' : ''} to the squad's bag)` : ''}${ownCards}`);
    // …and what the issue is FOR on this floor, to be said by whoever makes the level: none of it fails
    const worn = T.cards(e.squad, issueOf(L)), own = Array.from({ length: e.squad }, (_, k) => kitCost(k + 1, worn[k + 1]).lines as { item: string; n: number }[]), sum = (item: string) => own.reduce((s, l) => s + (l.find(x => x.item === item)?.n ?? 0), 0);
    if (e.kind === 'quiet' && e.squad > 0 && own[0]?.length) say('kit', 'note', `${e.id}: a quiet mission whose partner comes as issued for a loud one (${own[0].map(l => `${l.n} ${l.item}`).join(', ')}): nothing in the level says otherwise`);
    if ((e.kind === 'rescue' || S.snatch) && sum('frags')) say('kit', 'note', `${e.id}: ${sum('frags')} frags are issued where a frag on order is refused near ${S.snatch ? 'the man to take' : 'a hostage'}: say what the squad throws instead`); }
  { const locked = L.doors.filter(d => d.locked).length, steel = L.doors.filter(d => d.steel).length, squad = rows.filter(e => e.kind !== 'quiet' && mates(e));
    if (squad.length && (locked || steel)) { const charges = Math.max(...squad.map(e => { const worn = T.cards(e.squad, issueOf(L)); return Array.from({ length: e.squad }, (_, k) => (kitCost(k + 1, worn[k + 1]).lines as { item: string; n: number }[]).find(x => x.item === 'charges')?.n ?? 0).reduce((a, n) => a + n, 0); }));
      say('kit', 'note', `${locked} locked and ${steel} steel of ${L.doors.length} doors, against ${charges} door charge${charges === 1 ? '' : 's'} as issued (steel takes no charge, hammer or shotgun): say how each is meant to be opened`); } }
  // ---- named in the write-ups
  if (rows.length) { const words = [`${name}.json`, `tools/levels/${name}.ts`, ...rows.map(e => e.id)], hit = words.find(w => new RegExp(`(^|[^\\w-])${w.replace(/[.\\/]/g, '\\$&')}($|[^\\w-])`, 'm').test(T.docs));
    say('said', !!hit, hit ? `docs/agents names it ('${hit}')` : `docs/agents names neither ${words.join(', ')}`); }
  return out;
}

/** THE LEVEL'S OWN CHECKS, as they stand in the tree. `some`: the command for these levels (null = none of them is this check's); `all`: the check's own
 *  no-name run, used when every level is asked (it reads every file, the look twins too); `each`: one run a level. */
interface Own { name: string; some(levels: string[]): string[] | null; all?: string[]; each?: boolean }
const twins = (l: string[], as: (n: string) => string) => l.flatMap(n => onDisk(`${n}-gwot`) ? [as(n), as(`${n}-gwot`)] : [as(n)]);
const OWN: Own[] = [
  { name: 'export --check', each: true, some: ([n]) => { const g = generatorOf(read(n)); return n === 'office' ? ['tools/level-export.ts', '--check'] : g && /^tools\/levels\/[\w-]+\.ts$/.test(g) && existsSync(resolve(ROOT, g)) ? ['tools/levels/export.ts', g.slice(13, -3), '--check'] : null; } },
  { name: 'map-check', each: true, some: ([n]) => { const S = n === 'office' ? { roomClear: {} } : read(n).scenarios ?? {}; return rowsOf(n).length && (S.roomClear || S.quiet) ? ['tools/qa/map-check.ts', n, '--no-runs'] : null; } },   // (a map with a room clear or a quiet block: a rescue alone is not map-check's)
  { name: 'level-lint', some: l => ['tools/qa/level-lint.ts', ...twins(l, n => `levels/${n}.json`), '--quiet'] },
  { name: 'door-size', all: ['tools/qa/door-size.ts'], some: l => ['tools/qa/door-size.ts', ...twins(l, n => n)] },
  { name: 'second-way-check', all: ['tools/qa/second-way-check.ts'], some: l => { const f = l.filter(n => rowsOf(n).some(e => e.kind !== 'quiet')); return f.length ? ['tools/qa/second-way-check.ts', ...twins(f, n => `${n}.json`)] : null; } },
  { name: 'lived-check', all: ['tools/qa/lived-check.ts', '--quiet'], some: l => ['tools/qa/lived-check.ts', ...twins(l, n => n), '--quiet'] },
  { name: 'kitview-plan', all: ['tools/qa/kitview-plan.ts', '--quiet'], some: l => ['tools/qa/kitview-plan.ts', ...l, '--quiet'] },
  { name: 'level-names-check', all: ['tools/qa/level-names-check.ts', '--no-play'], some: l => { const f = l.filter(n => !/^office/.test(n) && Object.keys(read(n).scenarios ?? {}).length); return f.length ? ['tools/qa/level-names-check.ts', '--levels', f.join(','), '--no-play'] : null; } },
  { name: 'floor-order-check', all: ['tools/qa/floor-order-check.ts'], some: l => ['tools/qa/floor-order-check.ts', ...twins(l, n => `${n}.json`)] },
  { name: 'quiet-check', all: ['tools/qa/quiet-check.ts'], some: l => { const f = l.filter(n => read(n).scenarios?.quiet); return f.length ? ['tools/qa/quiet-check.ts', ...f.map(n => `${n}.json`)] : null; } },
  { name: 'lesson-check', all: ['tools/qa/lesson-check.ts'], some: l => { const f = l.filter(n => read(n).scenarios?.lesson); return f.length ? ['tools/qa/lesson-check.ts', ...f] : null; } },
];
async function runOwn(levels: string[], all: boolean, jobs: number): Promise<Line[]> {
  const cmds: { name: string; args: string[] }[] = [];
  for (const c of OWN) {
    if (c.each) for (const l of levels) { const a = c.some([l]); if (a) cmds.push({ name: c.name, args: a }); }
    else { const a = all && c.all ? c.all : c.some(levels); if (a) cmds.push({ name: c.name, args: a }); }
  }
  const out: Line[] = new Array(cmds.length); let next = 0;
  const worker = async () => { for (let i = next++; i < cmds.length; i = next++) { const { name, args } = cmds[i], t = Date.now();
    const p = Bun.spawn(['bun', 'run', ...args], { cwd: ROOT, env: process.env, stdout: 'pipe', stderr: 'pipe' }), [so, se, rc] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    const said = args.join(' '), tail = `${so}${se}`.trim().split('\n').filter(Boolean).pop()?.slice(0, 160) ?? '';
    out[i] = { need: name, mark: rc === 0 ? 'PASS' : 'FAIL', text: `bun run ${said.length > 150 ? `${said.slice(0, 150)} …` : said} — exit ${rc} in ${Math.round((Date.now() - t) / 1000)} s${rc === 0 ? '' : `: ${tail}`}` }; } };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2), VALUED = ['--md', '--json', '--jobs', '--skip'], flag = (f: string) => argv.includes(f), val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const MD = val('--md'), JSON_OUT = val('--json'), QUIET = flag('--quiet'), RUN = flag('--run'), JOBS = Number(val('--jobs') ?? 4) || 4, BREAK = process.env.NEEDS_BREAK === '1';
  const SKIP = (val('--skip') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  for (const s of SKIP) if (!(NEEDS as readonly string[]).includes(s)) { console.error(`no need called '${s}' (${NEEDS.join(', ')})`); process.exit(2); }
  const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1])).map(a => plainOf(a.replace(/^levels\//, '').replace(/\.json$/, '')));
  const files = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).map(f => f.slice(0, -5)).sort();
  const every = files.filter(f => !f.endsWith('-gwot')), todo = names.length ? [...new Set(names)] : every;
  for (const n of todo) if (!files.includes(n)) { console.error(`no level file levels/${n}.json`); process.exit(2); }
  const menu = resolve(ROOT, 'public/assets/menu'), docsDir = resolve(ROOT, 'docs/agents'), stills = JSON.parse(readFileSync(resolve(menu, 'stills.json'), 'utf8')).stills as Record<string, unknown>;
  if (harnessProfile() !== 'shipped') { pageSwitches(new URLSearchParams('')); kitLoad(null, ''); }   // (the page as it opens, on either stand: see the head of this file; the shipped stand booted so as tools/qa/headless.ts loaded)
  if (!SLOTS.ok) { console.error('src/game/slots.json was refused as the game loaded it: no kit can be priced, so nothing here is said of a level'); process.exit(1); }
  const T: Tables = { music: (level, kind) => setlistNames(level, kind).own, still: id => Object.hasOwn(stills, id), picture: id => existsSync(resolve(menu, `${id}.jpg`)),
    cards: (n, block) => { const was = kitTeam(); kitTeam(n); try { return (kitWorn(n, Array.from({ length: KIT_MEMBERS }, (_, j) => ({ ...kitDefault(j), ...(block[String(j)] ?? {}) }))) as Card[]).map(m => ({ ...m })); } finally { kitTeam(was); } },
    docs: readdirSync(docsDir).filter(f => f.endsWith('.md')).map(f => readFileSync(resolve(docsDir, f), 'utf8')).join('\n') };
  const twinOf = (n: string) => files.includes(`${n}-gwot`) ? read(`${n}-gwot`) : null;
  console.log(`# what a level needs — ${BREAK ? 'the red path' : `${todo.length} level${todo.length > 1 ? 's' : ''}`}, the ${harnessProfile()} stand${SKIP.length ? ` (not asked: ${SKIP.join(', ')})` : ''}`);

  if (BREAK) {
    // one level with every gap this tool can see, planted in memory: each must come back, in the words that say it was THIS gap
    const name = 'hall', L = structuredClone(read(name)), e = rowsOf(name)[0], d = L.doors[0], along = Math.abs(Math.sin(d.closedDir)) > 0.5, mid = d.hinge[along ? 1 : 0] + d.width * (along ? Math.sin(d.closedDir) : Math.cos(d.closedDir)) / 2;
    L.meta!.generator = 'tools/levels/not-there.ts'; delete L.surfaces; delete L.scenarios!.kitView; delete L.scenarios!.issue;
    L.boxes = L.boxes.filter(b => STRUCTURE.test(b.group ?? '')); L.props = [];
    const slab = roofBand(L).find(b => has(b, 'NoPrimary')); if (slab) slab.flags = slab.flags!.filter(f => f !== 'NoPrimary');
    L.boxes.push({ id: 'planted_dado', group: 'planted', c: along ? [d.hinge[0] + 0.12, 0.55, mid] : [mid, 0.55, d.hinge[1] + 0.12], h: along ? [0.004, 0.55, 2] : [2, 0.55, 0.004], flags: ['NoShadow'] });
    L.lights.push({ id: 'planted_lamp', kind: 'spot', pos: [1, 3, 1], group: 'yard' }, { id: 'planted_sun', kind: 'dir', pos: [0, 0, 0], group: 'exterior' });
    const row: Row = { ...e, id: 'planted-row', place: undefined, blurb: 'short', defenders: 12, ways: ['one', 'two', 'three'], squads: !e.squads, only: undefined };
    const bareCard = { bangs: 0, charges: 0, smoke: 0, frags: 0, walls: 0, shells: 0, shield: false, big: 'none' };   // (the kit's gap is PLANTED, whatever the issue table gives: every man's card emptied)
    const lines = ask(name, L, null, [row], { music: () => false, still: () => false, picture: () => false, docs: '', cards: () => Array.from({ length: KIT_MEMBERS }, (_, j) => ({ ...kitDefault(j), ...bareCard })) });
    /** what each planted gap must be found as: the mark, and every phrase its lines must carry */
    const WANT: Record<string, { mark: Mark; says: string[] }> = {
      generator: { mark: 'FAIL', says: ['not in the tree'] }, row: { mark: 'FAIL', says: ['no `place`', '`blurb` is 5 characters', '12 defenders', 'names 3 ways in', 'squads'] }, music: { mark: 'FAIL', says: ['no row'] },
      picture: { mark: 'FAIL', says: ['planted-row.jpg'] }, 'kit picture': { mark: 'FAIL', says: ['no scenarios.kitView'] }, lived: { mark: 'FAIL', says: ['is bare'] }, floor: { mark: 'NOTE', says: ['no `surfaces`'] },
      lamps: { mark: 'NOTE', says: ['planted_lamp'] }, moon: { mark: 'FAIL', says: ['2 directional'] }, doorway: { mark: 'FAIL', says: ['planted_dado'] }, roof: { mark: 'FAIL', says: ['drawn slab'] },
      kit: { mark: 'FAIL', says: ['you + 1: ', 'you + 4: '] }, said: { mark: 'FAIL', says: ['names neither'] } };
    const missed = Object.entries(WANT).flatMap(([need, w]) => { const text = lines.filter(l => l.need === need && l.mark === w.mark).map(l => l.text).join('\n'); return w.says.filter(s => !text.includes(s)).map(s => `${need} ('${s}')`); });
    for (const l of lines) if (l.mark !== 'PASS') console.log(`- ${l.mark} — ${name} (planted) · ${l.need}: ${l.text}`);
    for (const m of missed) console.log(`- MISSED — a planted gap was not found: ${m}`);
    console.log(missed.length ? `\nthe red path is GREEN on ${missed.length} planted gap(s): this tool cannot see them` : `\nall the gaps planted in ${Object.keys(WANT).length} needs were found (exit 1, as the red path must)`);
    process.exit(missed.length ? 0 : 1);
  }

  const table: Record<string, Line[]> = {}; let fails = 0, notes = 0;
  for (const name of todo) {
    const lines = ask(name, read(name), twinOf(name), rowsOf(name), T).filter(l => !SKIP.includes(l.need)); table[name] = lines;
    for (const l of lines) { if (l.mark === 'FAIL') fails++; if (l.mark === 'NOTE') notes++; if (!QUIET || l.mark !== 'PASS') console.log(`- ${l.mark} — ${name} · ${l.need}: ${l.text}`); }
  }
  if (RUN) { const lines = await runOwn(todo, !names.length, JOBS); table['(own checks)'] = lines;
    for (const l of lines) { if (l.mark === 'FAIL') fails++; if (!QUIET || l.mark !== 'PASS') console.log(`- ${l.mark} — own check · ${l.need}: ${l.text}`); } }
  console.log(`\n${fails ? `${fails} FAIL` : 'no FAIL'}, ${notes} NOTE over ${todo.length} level${todo.length > 1 ? 's' : ''}${RUN ? '' : ' (the levels\' own checks were not run: --run)'}. What no tool can ask (the idea, the light, the play) is the skill's: .claude/skills/level/SKILL.md`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ stand: harnessProfile(), table }, null, 1));
  if (MD) {
    const asked = NEEDS.filter(n => !SKIP.includes(n)), cell = (ls: Line[], need: string) => { const m = ls.filter(l => l.need === need); return !m.length ? '·' : m.some(l => l.mark === 'FAIL') ? 'GAP' : m.some(l => l.mark === 'NOTE') ? 'note' : 'ok'; };
    const head = `| level | ${asked.join(' | ')} |\n|---|${asked.map(() => '---').join('|')}|\n`;
    const body = todo.map(n => `| ${n} | ${asked.map(need => cell(table[n], need)).join(' | ')} |`).join('\n');
    const gaps = [...todo, ...(RUN ? ['(own checks)'] : [])].flatMap(n => table[n].filter(l => l.mark !== 'PASS' || n === '(own checks)').map(l => `- ${l.mark === 'FAIL' ? 'GAP' : l.mark === 'NOTE' ? 'note' : 'ok'} · ${n} · ${l.need}: ${l.text}`)).join('\n');
    writeFileSync(MD, `${head}${body}\n\n${gaps}\n`);
  }
  process.exit(fails ? 1 : 0);
}
