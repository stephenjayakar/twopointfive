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
//   ground      a NOTE when 40 m² or more of ground in one piece has nothing on it: no paint that reads against its own, no rubble or kerb, within
//               1.5 m (bareGround below; the six biggest pieces, each with a square of its own; the look twin's too). Measured from the file's boxes
//               and paints: a guide for the eye, which has the last word
//   leak        a NOTE counting the standing things whose light-cache read crosses a wall into a place a lamp or the sky lights (leakReads below), with
//               the rooms and lamps that have most of them. Where to look in a real browser: not a statement that the picture shows it, and not a
//               number a renderer's mend can move (it reads the file, not the shaders)
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
//   response    a level has a response team only where its file says so (scenarios.response, game/qrf.ts). With the block: its `why` is a sentence, a look
//               twin carries the same block, and a row of the level is one the block answers (a NOTE if none). Without: the level is in NOBODY_COMES
//               below with its reason, or it has not answered (a NOTE). In both is a FAIL. Not asked of a lesson. The block against the built floor,
//               and a call played through, are tools/qa/response-check.ts's
//   said        docs/agents names the level (its file, its generator or a row's id) — that a write-up is THERE, not that it is good
import { resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { fitPropFootprint } from '../../src/scene/levelLoad.ts';
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { setlistNames } = await import(`${ROOT}/src/audio/setlist.ts`);
const { LOOK_LEVELS } = await import(`${ROOT}/src/scene/look.ts`);
const { squadChoices, rosterOf } = await import(`${ROOT}/src/game/loadout.ts`);
const { kitDefault, kitWorn, kitCost, kitTeam, kitLoad, bigOf, SLOTS, KIT_MEMBERS } = await import(`${ROOT}/src/game/kit.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { defaultRcConfig } = await import(`${ROOT}/src/render/rc.ts`);
const { OFFICE_SCENARIOS } = await import(`${ROOT}/levels/office.scenarios.ts`) as { OFFICE_SCENARIOS: { response?: unknown } };
const { harnessProfile, pageSwitches } = await import(`${ROOT}/src/host/profile.ts`);

interface Paint { albedo: number[]; rough?: number }
interface Box { id: string; group?: string; c: number[]; h: number[]; yaw?: number; flags?: string[]; material?: string; albedo?: number[]; rough?: number; markings?: unknown[]; emissive?: unknown; rot?: unknown }
interface Light { id: string; kind: string; pos: number[]; group?: string; range?: number; intensity?: number; enabled?: boolean; dir?: number[]; outerDeg?: number }
interface Door { id: string; hinge: number[]; closedDir: number; width: number; angle?: number; locked?: boolean; steel?: boolean }
interface Bounds { x0: number; x1: number; z0: number; z1: number }
type Card = Record<string, unknown>;
interface LevelFile { meta?: { generator?: string }; materials?: Record<string, Paint>; boxes: Box[]; props?: { id: string; x: number; z: number; yaw?: number; half?: number[]; parts?: { off: [number, number, number]; h: [number, number, number]; yaw?: number }[] }[]; lights: Light[]; switchables?: { id: string; group?: string; boxes?: string[]; on?: boolean; baseEmissive?: number[] }[]; doors: Door[]; surfaces?: unknown;
  scenarios?: { roomClear?: { starts?: unknown[]; squads?: unknown[]; wallCharges?: number; rooms?: { name: string; bounds?: Bounds }[] }; rescue?: { room?: { name: string; bounds?: Bounds } };
    quiet?: { starts?: unknown[]; spots?: { place: string; area?: Bounds }[] }; places?: { areas?: { name: string; bounds: Bounds }[] }; lesson?: unknown; snatch?: unknown; kitView?: unknown; response?: { why?: unknown; team?: unknown; raid?: unknown }; issue?: { members: Record<string, Card> } } }
interface Row { id: string; title: string; kind: 'nightbreach' | 'roomclear' | 'rescue' | 'quiet'; squad: number; level?: string; group?: string; only?: string; place?: string; blurb?: string;
  untuned?: boolean; offList?: boolean; defenders?: number; ways?: readonly string[]; squads?: boolean }
/** the tables a level is registered in, as the tree has them (the red path hands a level its own, with every row taken out) */
interface Tables { music(level: string, kind: string): boolean; still(id: string): boolean; picture(id: string): boolean; docs: string; /** the five cards as n teammates wear them: the issue with a level's own cards (`block`, by place on the roster) written over it, then dealt over the men who come where the game deals them (game/kit.ts kitWorn, as a staging and ui/loadout.ts read them) */ cards(n: number, block: Record<string, Card>): Card[] }

type Mark = 'PASS' | 'FAIL' | 'NOTE';
interface Line { need: string; mark: Mark; text: string }
export const NEEDS = ['generator', 'mission', 'row', 'music', 'picture', 'kit picture', 'look', 'lived', 'floor', 'ground', 'leak', 'lamps', 'moon', 'doorway', 'roof', 'kit', 'response', 'said'] as const;

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
/** GROUND: the stretches of ground with nothing on them — what reads as one flat sheet from above. The ground is cut into squares of `cell`; each
 *  carries the TOPMOST flat paint drawn over it (every box no higher than `thin`, decal or slab, the world's own slab among them; one narrower than a
 *  square is given half a square each side so that a painted line is not lost between two middles). Two paints READ APART at `step` of the larger
 *  value, `sheen` of roughness, or `hue` of any channel's share of the colour. A BREAK is the line where two paints that read apart meet in the open, a square whose topmost box has markings on
 *  its upper face (a mat under `least`), and anything low that feet walk over (stands on the ground, no higher than `low`: rubble, a kerb, a loose
 *  thing; one wider than twice `reach` is a floor, and paint). A square with something
 *  standing on it (below `head`), or on a door's line, is not ground the eye sees, and nothing passes it. A square within about `reach` of a break,
 *  walked round what stands, is dressed. What is left is PLAIN: its pieces, joined across paints that do not read apart, are the stretches, biggest
 *  first, each named for the paint most of it wears, with the square of its own nearest its middle. A stretch is the MARGIN outside the place when no start mark
 *  (`starts`: x, z) can be walked from to it, doors open, or when `rim` of its squares lie within `edge` of the world's edge and no start mark stands
 *  within `near` of it. Numbers from the file: what a patch does to the picture nobody
 *  has seen on a GPU here, and STYLE.md's rule for a patch (darker than its ground, never under a third) is not held by this. */
const GROUND = { cell: 0.25, thin: 0.06, leaf: 0.02, low: 0.19, foot: 0.05, head: 1.9, step: 0.15, sheen: 0.3, hue: 0.08, dark: 0.03, reach: 1.5, edge: 4, rim: 0.8, near: 3, least: 10, big: 40, list: 6 };
export interface Stretch { area: number; mat: string; x: number; z: number; margin: boolean }
export function bareGround(L: LevelFile, starts: number[][] = []): Stretch[] {
  const G = GROUND, X0 = WORLD.min[0], Z0 = WORLD.min[2], W = Math.round((WORLD.max[0] - X0) / G.cell), H = Math.round((WORLD.max[2] - Z0) / G.cell), N = W * H;
  const lum = (a: number[]) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  const paints: { name: string; v: number; r: number; hue: number[] }[] = [], ids = new Map<string, number>();
  const paintOf = (b: Box): number => { const m = b.material ? L.materials?.[b.material] : undefined, a = b.albedo ?? m?.albedo ?? [0.5, 0.5, 0.5], r = b.rough ?? m?.rough ?? 1, key = `${b.material ?? ''}|${a.join(',')}|${r}`;
    let k = ids.get(key); if (k === undefined) { ids.set(key, k = paints.length); paints.push({ name: b.material ?? `a paint of its own (${a.map(n => n.toFixed(2)).join(' ')})`, v: lum(a), r, hue: a.map(n => n / Math.max(a[0] + a[1] + a[2], 1e-6)) }); } return k; };
  const reads = (p: number, q: number) => p !== q && (p < 0 || q < 0 || Math.max(paints[p].v, paints[q].v) >= G.dark) && (p < 0 || q < 0 || Math.abs(paints[p].v - paints[q].v) / Math.max(paints[p].v, paints[q].v, 1e-6) >= G.step - 1e-9 || Math.abs(paints[p].r - paints[q].r) >= G.sheen - 1e-9 || paints[p].hue.some((h, n) => Math.abs(h - paints[q].hue[n]) >= G.hue - 1e-9));
  /** every square whose middle lies in the box's footprint grown by `pad` (a box turned about the upright axis: scene/levelKit.ts frameAt) */
  const over = (b: Box, pad: number, f: (k: number) => void) => { const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), hx = b.h[0] + pad, hz = b.h[2] + pad, r = Math.hypot(hx, hz);
    const i0 = Math.max(0, Math.floor((b.c[0] - r - X0) / G.cell)), i1 = Math.min(W - 1, Math.floor((b.c[0] + r - X0) / G.cell)), j0 = Math.max(0, Math.floor((b.c[2] - r - Z0) / G.cell)), j1 = Math.min(H - 1, Math.floor((b.c[2] + r - Z0) / G.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = X0 + (i + 0.5) * G.cell - b.c[0], dz = Z0 + (j + 0.5) * G.cell - b.c[2];
      if (Math.abs(cs * dx - sn * dz) <= hx && Math.abs(sn * dx + cs * dz) <= hz) f(j * W + i); } };
  const paint = new Int32Array(N).fill(-1), standing = new Uint8Array(N), broken = new Uint8Array(N), flats: Box[] = [];
  for (const b of L.boxes) { if (b.rot || has(b, 'Glass')) continue;
    const t = b.c[1] + b.h[1], foot = b.c[1] - b.h[1], e = 1e-9, wide = Math.min(b.h[0], b.h[2]) > G.reach;
    if (t <= G.thin + e && (has(b, 'NoPrimary') || 2 * Math.max(b.h[0], b.h[2]) < G.cell)) continue;   // (not drawn; or a speck no square would show)
    // (paint: a decal, a leaf of a slab, the world's own slab, and a low pad too wide to be a thing on the ground, which is a floor)
    if (t <= G.thin + e && (has(b, 'NoShadow') || 2 * b.h[1] <= G.leaf + e || foot < 0) || t <= G.low + e && foot < G.foot - e && wide) flats.push(b);
    else if (foot < G.foot - e && t <= G.low + e) over(b, G.cell / 2, k => { broken[k] = 1; });
    else if (foot < G.head && !has(b, 'NoShadow')) over(b, G.cell / 2, k => { standing[k] = 1; }); }
  for (const p of L.props ?? []) { const fit = p.parts?.length ? fitPropFootprint(p.parts) : null, h = p.half ?? fit?.half ?? [0.2, 0.2];   // (loose things: a bin, a chair)
    over({ id: p.id, c: [p.x, 0, p.z], h: [h[0], 0, h[1]], yaw: p.yaw }, G.cell / 2, k => { if (fit && fit.height <= G.low) broken[k] = 1; else standing[k] = 1; }); }
  // (lowest first, so that the last paint laid on a square is the one on top)
  const marked = new Uint8Array(N);
  for (const b of flats.sort((a, c) => a.c[1] + a.h[1] - (c.c[1] + c.h[1]))) { const p = paintOf(b), up = 4 * b.h[0] * b.h[2] < G.least && b.markings?.some(m => (m as { face?: string }).face === '+y') ? 1 : 0;   // (a marked mat, not a marked yard)
    over(b, Math.min(b.h[0], b.h[2]) < G.cell ? G.cell / 2 : 0, k => { paint[k] = p; marked[k] = up; }); }
  for (let k = 0; k < N; k++) if (paint[k] < 0) standing[k] = 1;   // (no ground drawn here at all)
  const walled = standing.slice();   // (what stops feet: the walls and the furniture, not a door)
  for (const d of L.doors) { const n = Math.ceil(d.width / (G.cell / 2));
    for (let s = 0; s <= n; s++) { const i = Math.floor((d.hinge[0] + Math.cos(d.closedDir) * d.width * s / n - X0) / G.cell), j = Math.floor((d.hinge[1] + Math.sin(d.closedDir) * d.width * s / n - Z0) / G.cell); if (i >= 0 && i < W && j >= 0 && j < H) standing[j * W + i] = 1; } }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (standing[k]) continue; if (marked[k]) broken[k] = 1;
    for (const n of [i + 1 < W ? k + 1 : -1, j + 1 < H ? k + W : -1]) if (n >= 0 && !standing[n] && reads(paint[k], paint[n])) broken[k] = broken[n] = 1; }
  /** the squares next to k that `shut` does not close: the four beside it, and when `all` the four cornerwise, never between two shut squares */
  const beside = (k: number, all: boolean, shut: Uint8Array): number[] => { const i = k % W, j = (k - i) / W, out: number[] = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && (all || !di || !dj) && i + di >= 0 && i + di < W && j + dj >= 0 && j + dj < H
      && !shut[k + dj * W + di] && !(di && dj && (shut[k + di] || shut[k + dj * W]))) out.push(k + dj * W + di); return out; };
  // (a break's reach, walked round what stands: rings of squares, by eight and by four in turn, which is near enough a circle)
  const dressed = new Uint8Array(N); let ring: number[] = [];
  for (let k = 0; k < N; k++) if (broken[k] && !standing[k]) { dressed[k] = 1; ring.push(k); }
  for (let step = 0; step < Math.round(G.reach / G.cell); step++) { const next: number[] = [];
    for (const k of ring) for (const m of beside(k, step % 2 === 0, standing)) if (!dressed[m]) { dressed[m] = 1; next.push(m); } ring = next; }
  // (the ground the player can walk to from a start, doors open: the rest is outside the place. No start in the file: all of it)
  const walked = new Uint8Array(N).fill(starts.length ? 0 : 1), feet: number[] = [];
  for (const s of starts) { const i = Math.floor((s[0] - X0) / G.cell), j = Math.floor((s[1] - Z0) / G.cell); let best = -1, far = G.near / G.cell;
    for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const k = (j + dj) * W + i + di; if (i + di >= 0 && i + di < W && j + dj >= 0 && j + dj < H && !walled[k] && Math.hypot(di, dj) < far) { best = k; far = Math.hypot(di, dj); } }
    if (best >= 0 && !walked[best]) { walked[best] = 1; feet.push(best); } }
  for (let q = 0; q < feet.length; q++) for (const m of beside(feet[q], false, walled)) if (!walked[m]) { walked[m] = 1; feet.push(m); }
  const seen = new Uint8Array(N), out: Stretch[] = [], rim = Math.round(G.edge / G.cell);
  for (let k0 = 0; k0 < N; k0++) { if (seen[k0] || standing[k0] || dressed[k0]) continue;
    const queue = [k0], count = new Map<number, number>([[paint[k0], 1]]); seen[k0] = 1; let sx = 0, sz = 0, atRim = 0;
    for (let q = 0; q < queue.length; q++) { const k = queue[q], i = k % W, j = (k - i) / W; sx += i; sz += j; if (Math.min(i, j, W - 1 - i, H - 1 - j) < rim) atRim++;
      for (const m of beside(k, false, standing)) if (!seen[m] && !dressed[m]) { seen[m] = 1; queue.push(m); count.set(paint[m], (count.get(paint[m]) ?? 0) + 1); } }
    const area = queue.length * G.cell * G.cell; if (area < G.least) continue;
    const mi = sx / queue.length, mj = sz / queue.length, mid = queue.reduce((best, k) => Math.hypot(k % W - mi, Math.floor(k / W) - mj) < Math.hypot(best % W - mi, Math.floor(best / W) - mj) ? k : best, k0);
    const xz = (k: number): [number, number] => [X0 + (k % W + 0.5) * G.cell, Z0 + (Math.floor(k / W) + 0.5) * G.cell];
    const started = starts.some(s => queue.some(k => Math.hypot(xz(k)[0] - s[0], xz(k)[1] - s[1]) <= G.near));
    const most = [...count].sort((a, b) => b[1] - a[1])[0][0];
    out.push({ area, mat: most < 0 ? 'no paint' : paints[most].name, x: xz(mid)[0], z: xz(mid)[1], margin: !queue.some(k => walked[k]) || atRim / queue.length >= G.rim && !started }); }
  return out.sort((a, b) => b.area - a.area);
}
/** LEAK: the things in a level that the light cache is read for THROUGH A WALL. The renderer keeps bounced light in a lattice of probes a metre apart
 *  (render/rc.ts, `defaultRcConfig`) and reads it, where a ray lands on a face, one probe spacing along that face's normal, blended between the four
 *  probes round that point in plan. A wall is a hand thick: a thing stood against one has faces whose read lands beside or beyond the wall, among
 *  probes that stand in the room behind it. If a lamp lights that room and not this one, the thing can glow with the other room's light (the
 *  manager's shelves against the lit store: docs/agents/render.md, 08-12 and, on a man, 10-20; the maintainer's shots of 10-23 on the shelves again).
 *  THE MEASURE, in plan, from the file alone. A WALL is cut as tools/qa/bouncewalls-check.ts cuts one (casts a shadow, from the floor to the ceiling,
 *  long and thin: a mast or a pillar is not; its numbers are typed again here, and a turned wall is kept here), and the line of a door the file does
 *  not hold open. Between a face and a probe a wall counts a hand's width short of each end, so that a line grazing its end goes round it. A LAMP is a
 *  light of the file that is not the sun or moon and not authored off, and a flat fixture authored on that game.ts stands an area light in for (a
 *  ceiling panel, a screen: its brightest channel times its face). A probe is LIT by a lamp in range with no wall between them (a spot too: its
 *  bounce fills the room its cone is in), or by the sky where no roof is over it and the file has a sun or moon; a probe inside a wall is dark. For
 *  every box a ray can land on that is not the building's own (no decal, not glass, no group of STRUCTURE), and every loose prop, a point every `step`
 *  along each side face and the top: the read point, its four probes and their shares; a probe counts for a light when a wall parts it from the face,
 *  that light lights it, and the same light does not reach the face. A thing is named when one light's counted share on any of its points is `share`
 *  or more, by the lamp before the sky. It is STRONG when that lamp's figure there (share x strength over distance squared, no unit) is `glow` or more
 *  and more than the face has of its own: the lamps that reach the face directly, a spot in its cone only. That is the manager's shelves: a lamp
 *  close behind the wall, and the room's own lamp looking elsewhere. What this is NOT: a statement that the picture shows it, or a number a
 *  renderer's mend can move. Which reads the renderer already bounds (the gather's bounce by the plane the ray left, a man's by the nearest box), a
 *  lamp the game switches later, heights (a plan: a wall under the ceiling is no wall) and gloss are not in it. */
const LEAK = { foot: 0.45, long: 0.3, thin: 0.2, end: 0.1, tall: 0.3, step: 0.5, share: 0.25, glow: 0.5, off: 0.02, up: 1, list: 4 };
export interface LeakRead { id: string; group: string; x: number; z: number; share: number; by: string; /** the share times the lamp's strength over its distance squared: for putting the worst first, no unit */ glow: number; /** what the lamps that reach that face directly give it, on the same scale */ own: number; strong: boolean }
export function leakReads(L: LevelFile): LeakRead[] {
  const K = LEAK, sx = WORLD.rcSize[0] / defaultRcConfig.nx, sz = WORLD.rcSize[2] / defaultRcConfig.nz, X0 = WORLD.rcMin[0], Z0 = WORLD.rcMin[2], nx = defaultRcConfig.nx as number, nz = defaultRcConfig.nz as number;
  type Plan = { x: number; z: number; hx: number; hz: number; cs: number; sn: number; r: number };
  const plan = (b: Box, trim = 0): Plan => { const hx = b.h[0] - (b.h[0] > b.h[2] ? trim : 0), hz = b.h[2] - (b.h[0] > b.h[2] ? 0 : trim); return { x: b.c[0], z: b.c[2], hx, hz, cs: Math.cos(b.yaw ?? 0), sn: Math.sin(b.yaw ?? 0), r: Math.hypot(hx, hz) }; };
  const isWall = (b: Box) => !b.rot && !has(b, 'Glass') && !has(b, 'NoShadow') && b.c[1] - b.h[1] <= K.foot && b.c[1] + b.h[1] >= WORLD.ceilingY - 0.1 && Math.max(b.h[0], b.h[2]) > K.long && Math.min(b.h[0], b.h[2]) < K.thin;
  const whole: Plan[] = L.boxes.filter(isWall).map(b => plan(b)), walls: Plan[] = L.boxes.filter(isWall).map(b => plan(b, K.end));
  const doors: Plan[] = [];
  for (const d of L.doors) if (!d.angle) doors.push({ x: d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, z: d.hinge[1] + Math.sin(d.closedDir) * d.width / 2, hx: d.width / 2, hz: 0.03, cs: Math.cos(-d.closedDir), sn: Math.sin(-d.closedDir), r: d.width / 2 + 0.03 });
  walls.push(...doors); whole.push(...doors);
  const roofs: Plan[] = L.boxes.filter(b => !b.rot && !has(b, 'Glass') && b.c[1] - b.h[1] >= WORLD.ceilingY - 0.4 && Math.min(b.h[0], b.h[2]) >= 0.45).map(b => plan(b));
  /** a point in the box's own frame (a box turned about the upright axis: scene/levelKit.ts frameAt) */
  const local = (w: Plan, x: number, z: number): [number, number] => [w.cs * (x - w.x) - w.sn * (z - w.z), w.sn * (x - w.x) + w.cs * (z - w.z)];
  const solid = whole.slice(0, whole.length - doors.length);
  const within = (ws: Plan[], x: number, z: number) => ws.some(w => { const [lx, lz] = local(w, x, z); return Math.abs(lx) <= w.hx && Math.abs(lz) <= w.hz; });
  /** does the line from a to b in plan cross this box? (the slab test, in the box's frame) */
  const crosses = (w: Plan, ax: number, az: number, bx: number, bz: number): boolean => { const [px, pz] = local(w, ax, az), [qx, qz] = local(w, bx, bz); let t0 = 0, t1 = 1;
    for (const [p, d, h] of [[px, qx - px, w.hx], [pz, qz - pz, w.hz]]) { if (Math.abs(d) < 1e-12) { if (Math.abs(p) > h) return false; continue; }
      const a = (-h - p) / d, b = (h - p) / d; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); if (t0 > t1) return false; }
    return true; };
  const parted = (ax: number, az: number, bx: number, bz: number, near: Plan[] = walls) => near.some(w => crosses(w, ax, az, bx, bz));
  // (the lamps: the file's lights that burn as authored, and the fixtures that glow as authored)
  type Lamp = { id: string; pos: number[]; range: number; power: number; dir?: number[]; cos: number };
  const lum = (a: number[]) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2], byId = new Map(L.boxes.map(b => [b.id, b]));
  const lamps: Lamp[] = L.lights.filter(l => l.kind !== 'dir' && l.enabled !== false).map(l => ({ id: l.id, pos: l.pos, range: l.range ?? 8, power: l.intensity ?? 1, dir: l.kind === 'spot' ? l.dir : undefined, cos: Math.cos((l.outerDeg ?? 90) * Math.PI / 180) }));
  for (const s of L.switchables ?? []) { if (s.on !== true || !s.baseEmissive || /^(server_leds|emergency|vehicle)$/.test(s.group ?? '')) continue;   // (game.ts, the flat fixtures it lights the scene by)
    for (const id of s.boxes ?? []) { const b = byId.get(id); if (!b) continue; const h = [...b.h].sort((p, q) => q - p), power = Math.max(...s.baseEmissive, 1e-3) * 4 * h[0] * h[1];
      if (h[2] <= 0.06 && 4 * h[0] * h[1] >= 0.01) lamps.push({ id: s.id, pos: b.c, range: Math.min(26, Math.max(3, Math.sqrt(power / 0.0015))), power, cos: -1 }); } }
  /** what this lamp gives a point a metre up, walls aside: nothing out of its range, or (`cone`) out of a spot's cone */
  const reach = (l: Lamp, x: number, z: number, cone: boolean) => { const v = [x - l.pos[0], K.up - l.pos[1], z - l.pos[2]], d = Math.hypot(v[0], v[1], v[2]); if (d > l.range) return 0;
    if (cone && l.dir && d > 1e-6) { const n = Math.hypot(l.dir[0], l.dir[1], l.dir[2]) || 1; if ((v[0] * l.dir[0] + v[1] * l.dir[1] + v[2] * l.dir[2]) / (d * n) < l.cos) return 0; }
    return l.power / Math.max(1, d * d); };
  const sky = L.lights.some(l => l.kind === 'dir');
  // (what lights each probe's column: the lamps that see it, and the sky; none inside a wall)
  const lights: number[][] = Array.from({ length: nx * nz }, (_, k) => { const cx = X0 + (k % nx + 0.5) * sx, cz = Z0 + (Math.floor(k / nx) + 0.5) * sz; if (within(solid, cx, cz)) return [];
    return [...lamps.flatMap((l, n) => reach(l, cx, cz, false) > 0 && !parted(l.pos[0], l.pos[2], cx, cz, whole) ? [n] : []), ...(sky && !within(roofs, cx, cz) ? [-1] : [])]; });
  const out: LeakRead[] = [];
  const loose: Box[] = (L.props ?? []).flatMap(p => { if (!p.parts?.length) return []; const fit = fitPropFootprint(p.parts), h = p.half ?? fit.half; return [{ id: p.id, group: 'props', c: [p.x, fit.height / 2, p.z], h: [h[0], fit.height / 2, h[1]], yaw: p.yaw }]; });
  for (const b of [...L.boxes, ...loose]) { const t = b.c[1] + b.h[1], foot = b.c[1] - b.h[1];
    if (b.rot || has(b, 'Glass') || has(b, 'NoShadow') || has(b, 'NoPrimary') || isWall(b) || b.group !== 'props' && STRUCTURE.test(b.group ?? '') || t <= K.tall || foot >= WORLD.ceilingY - 0.4) continue;   // (no ray lands on it, not drawn, the building's own, the floor's, the ceiling's)
    const w = plan(b), near = walls.filter(v => Math.hypot(v.x - w.x, v.z - w.z) <= v.r + w.r + sx + sz); if (!near.length) continue;
    const worst = { lamp: 0, n: -1, x: 0, z: 0, glow: 0, own: 0, sky: 0, sx: 0, sz: 0 };
    /** a point on a face, and its normal in plan (none: the top) */
    const point = (lx: number, lz: number, nlx: number, nlz: number) => { const wn: [number, number] = [w.cs * nlx + w.sn * nlz, -w.sn * nlx + w.cs * nlz];
      const fx = w.x + w.cs * lx + w.sn * lz + wn[0] * K.off, fz = w.z - w.sn * lx + w.cs * lz + wn[1] * K.off;
      if (within(solid, fx, fz)) return;   // (a face shut in a wall is not seen)
      const rx = fx + wn[0] * sx, rz = fz + wn[1] * sz, gx = (rx - X0) / sx - 0.5, gz = (rz - Z0) / sz - 0.5, i0 = Math.floor(gx), j0 = Math.floor(gz), roofed = within(roofs, fx, fz), share = new Map<number, number>();
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = Math.min(nx - 1, Math.max(0, i0 + di)), j = Math.min(nz - 1, Math.max(0, j0 + dj)), wt = (di ? gx - i0 : 1 - (gx - i0)) * (dj ? gz - j0 : 1 - (gz - j0));
        const cx = X0 + (i + 0.5) * sx, cz = Z0 + (j + 0.5) * sz; if (wt <= 0 || !parted(fx, fz, cx, cz, near)) continue;
        for (const n of lights[j * nx + i]) if (n < 0 ? roofed : !(reach(lamps[n], fx, fz, true) > 0 && !parted(lamps[n].pos[0], lamps[n].pos[2], fx, fz, whole))) share.set(n, (share.get(n) ?? 0) + wt); }
      for (const [n, v] of share) { if (n < 0) { if (v > worst.sky) { worst.sky = v; worst.sx = fx; worst.sz = fz; } continue; }
        const glow = v * lamps[n].power / Math.max(1, (lamps[n].pos[0] - fx) ** 2 + (lamps[n].pos[1] - K.up) ** 2 + (lamps[n].pos[2] - fz) ** 2);
        if (v >= K.share - 1e-9 && glow > worst.glow) { worst.lamp = v; worst.n = n; worst.x = fx; worst.z = fz; worst.glow = glow;
          worst.own = lamps.reduce((a, l) => a + (parted(l.pos[0], l.pos[2], fx, fz, whole) ? 0 : reach(l, fx, fz, true)), 0); } } };
    const along = (h: number) => { const n = Math.max(1, Math.round(2 * h / K.step)); return Array.from({ length: n }, (_, k) => -h + (k + 0.5) * 2 * h / n); };
    for (const u of along(w.hz)) { point(w.hx, u, 1, 0); point(-w.hx, u, -1, 0); }
    for (const u of along(w.hx)) { point(u, w.hz, 0, 1); point(u, -w.hz, 0, -1); for (const v of along(w.hz)) point(u, v, 0, 0); }
    if (worst.n >= 0) out.push({ id: b.id, group: b.group ?? '', x: worst.x, z: worst.z, share: worst.lamp, by: lamps[worst.n].id, glow: worst.glow, own: worst.own, strong: worst.glow >= K.glow && worst.glow > worst.own });
    else if (worst.sky >= K.share - 1e-9) out.push({ id: b.id, group: b.group ?? '', x: worst.sx, z: worst.sz, share: worst.sky, by: 'the sky', glow: 0, own: 0, strong: false }); }
  return out.sort((a, b) => +b.strong - +a.strong || b.glow - a.glow || b.share - a.share);
}
/** every start mark the player has in a file (`sam`, the solo night's `playerSpawn`: x, y, z), as x, z */
const startsOf = (o: unknown): number[][] => !o || typeof o !== 'object' ? [] : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
  (k === 'sam' || k === 'playerSpawn') && Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number') ? [[v[0] as number, v[2] as number]] : startsOf(v));
/** NOBODY COMES HERE, ON PURPOSE: the levels with a mission row and no response team, each with why in a few words (the long form is the response
 *  team's two bullets of docs/agents/enemies.md). A level with neither a `scenarios.response` block nor a line here has not answered. `block` and
 *  `hall` are in neither on purpose: either would suit a team and has none yet, the maintainer's call. */
export const NOBODY_COMES: Record<string, string> = {
  'quiet-relay': 'a hilltop, nobody within reach, and its wired spot brings its own men', vault: 'private hired guards who call nobody', 'lights-out': 'its one idea is the mains',
  'quiet-yard': 'the test map', 'block-squads': 'at eleven, nobody is left to come', warehouse: 'at eleven, nobody is left to come', compound: 'at eleven, nobody is left to come',
  barracks: 'at eleven, nobody is left to come', registry: 'the hostage clock is the pressure', consulate: 'the hostage clock is the pressure',
  defuse: 'it has its own clock', killhouse: 'it has its own clock', floodlit: 'one idea, and it is not this', mousehole: 'one idea, and it is not this',
  glasshouse: 'one idea, and it is not this', pass: 'a snowed-in road' };
/** a `why` shorter than this is not a sentence (the same 40 as response-check.ts's file line) */
const WHY_MIN = 40;
/** KIT: who comes with nothing but his gun, as issued, at each size the row offers — the game's own issue cards, priced by the game's own pouches
 *  (game/kit.ts kitCost: a card that fills none carries nothing), with the level's own issue written over them where a staging would put it on
 *  (scenarios.issue's cards as written; never on a lesson's level, whose page plays the plain issue with the block unread) */
const issueOf = (L: LevelFile): Record<string, Card> => (L.scenarios?.lesson ? {} : (L.scenarios?.issue?.members ?? {}) as Record<string, Card>);
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
    say('kit picture', own, own ? 'the file carries a kitView block' : 'no scenarios.kitView: Team & kit shows an empty column where the picture would be');
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
  // ---- the ground: stretches with nothing on them, the look twin's too (its ground is its own)
  for (const [who, F] of [['', L], ['look twin: ', twin]] as const) { if (!F) continue;
    const all = bareGround(F, startsOf([name === 'office' ? OFFICE_SCENARIOS : F.scenarios, (F as { mission?: unknown }).mission])), within = all.filter(s => !s.margin), big = within.filter(s => s.area >= GROUND.big), rim = all.filter(s => s.margin).reduce((a, s) => a + s.area, 0);
    const at = (s: Stretch) => `${Math.floor(s.area)} m² of ${s.mat} at [${s.x.toFixed(1)}, ${s.z.toFixed(1)}]`, edge = rim >= GROUND.big ? `; ${Math.round(rim)} m² more is bare outside the place (past its walls, or along the world's edge with no start on it)` : '';
    say('ground', big.length ? 'note' : true, who + (big.length ? `${big.length} stretch${big.length > 1 ? 'es' : ''} of ${GROUND.big} m² or more of ground with nothing on ${big.length > 1 ? 'them' : 'it'} (no paint that reads against its own, no rubble or kerb, within ${GROUND.reach} m): ${big.slice(0, GROUND.list).map(at).join('; ')}${big.length > GROUND.list ? ` and ${big.length - GROUND.list} more` : ''}${edge}`
      : `no ${GROUND.big} m² of ground is one bare sheet (the largest: ${within.length ? at(within[0]) : `under ${GROUND.least} m²`})${edge}`)); }
  // ---- light read through a wall: the count, and the places where the far lamp outweighs the room's own
  { const line = (F: LevelFile) => { const reads = leakReads(F), strong = reads.filter(r => r.strong), pairs = new Map<string, { n: number; glow: number; at: LeakRead }>();
      for (const r of strong) { const k = `${r.group.split('.').slice(0, 2).join('.') || 'no group'} by ${r.by}`, p = pairs.get(k); if (p) { p.n++; p.glow += r.glow; } else pairs.set(k, { n: 1, glow: r.glow, at: r }); }
      const top = [...pairs].sort((a, b) => b[1].glow - a[1].glow || b[1].n - a[1].n), sky = reads.filter(r => r.by === 'the sky').length, all = `${reads.length} thing${reads.length === 1 ? ' stands' : 's stand'} within a probe of a wall with light behind it (${reads.length - sky} by a lamp, ${sky} by the sky)`;
      return { note: strong.length > 0, text: strong.length ? `${strong.length} of them where the far lamp outweighs the room's own light on that face, so the light cache read through the wall can show: ${top.slice(0, LEAK.list).map(([k, p]) => `${p.n} in ${k}, as ${p.at.id} at [${p.at.x.toFixed(1)}, ${p.at.z.toFixed(1)}]`).join('; ')}${top.length > LEAK.list ? ` and ${top.length - LEAK.list} more rooms` : ''}; ${all}`
        : `${all}, none where the far lamp outweighs the room's own light on that face` }; };
    const own = line(L), other = twin ? line(twin) : null;
    say('leak', own.note ? 'note' : true, own.text); if (other && other.text !== own.text) say('leak', other.note ? 'note' : true, 'look twin: ' + other.text); }
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
    const bare = bareMen(L, e, T), walls = S.roomClear?.wallCharges, wrote = lesson ? 0 : Object.keys(S.issue?.members ?? {}).length;
    const ownCards = !wrote ? '' : ' (the level issues its own cards)';
    say('kit', !bare.length, `${e.id}: ${bare.length ? `as issued, nothing but a gun on ${bare.join(' · ')}` : 'as issued, every man who comes carries something'}${walls ? ` (the level issues ${walls} wall charge${walls > 1 ? 's' : ''} to the squad's bag)` : ''}${ownCards}`);
    // …and what the issue is FOR on this floor, to be said by whoever makes the level: none of it fails
    const worn = T.cards(e.squad, issueOf(L)), own = Array.from({ length: e.squad }, (_, k) => kitCost(k + 1, worn[k + 1]).lines as { item: string; n: number }[]), sum = (item: string) => own.reduce((s, l) => s + (l.find(x => x.item === item)?.n ?? 0), 0);
    if (e.kind === 'quiet' && e.squad > 0 && own[0]?.length) say('kit', 'note', `${e.id}: a quiet mission whose partner comes as issued for a loud one (${own[0].map(l => `${l.n} ${l.item}`).join(', ')}): nothing in the level says otherwise`);
    if ((e.kind === 'rescue' || S.snatch) && sum('frags')) say('kit', 'note', `${e.id}: ${sum('frags')} frags are issued where a frag on order is refused near ${S.snatch ? 'the man to take' : 'a hostage'}: say what the squad throws instead`); }
  { const locked = L.doors.filter(d => d.locked).length, steel = L.doors.filter(d => d.steel).length, squad = rows.filter(e => e.kind !== 'quiet' && mates(e));
    if (squad.length && (locked || steel)) { const charges = Math.max(...squad.map(e => { const worn = T.cards(e.squad, issueOf(L)); return Array.from({ length: e.squad }, (_, k) => (kitCost(k + 1, worn[k + 1]).lines as { item: string; n: number }[]).find(x => x.item === 'charges')?.n ?? 0).reduce((a, n) => a + n, 0); }));
      say('kit', 'note', `${locked} locked and ${steel} steel of ${L.doors.length} doors, against ${charges} door charge${charges === 1 ? '' : 's'} as issued (steel takes no charge, hammer or shotgun): say how each is meant to be opened`); } }
  // ---- a response team, or none on purpose
  if (rows.length && !lesson) {
    const R = name === 'office' ? OFFICE_SCENARIOS.response as NonNullable<LevelFile['scenarios']>['response'] : S.response, none = NOBODY_COMES[name];
    if (R) { const why = typeof R.why === 'string' ? R.why.trim() : '', raid = !!R.raid;
      say('response', why.length > WHY_MIN, `a response team comes here (${typeof R.team === 'string' ? R.team : 'no `team` word'}; it answers ${raid ? 'a squad\'s room clear and nothing else' : 'a quiet night gone loud'}): ${why.length > WHY_MIN ? 'the file says why' : `its \`why\` is not a sentence (over ${WHY_MIN} characters)`}`);
      if (none !== undefined) say('response', false, `NOBODY_COMES says nobody comes here ('${none}') and the file carries a response block: one of the two is stale`);
      // (game/qrf.ts live(): a raid block is called only inside a squad's clear that is no rescue; any other only outside every squad mission — the office's plain night is no row)
      if (!(raid ? rows.some(e => e.kind === 'nightbreach' || e.kind === 'roomclear') : name === 'office' || rows.some(e => e.kind === 'quiet')))
        say('response', 'note', `the block answers ${raid ? 'a squad\'s room clear' : 'a quiet night gone loud'} and no row of this level is one (${rows.map(e => `${e.id}: ${e.kind}`).join(', ')}): nobody would ever be called`);
      if (twin) { const same = JSON.stringify(twin.scenarios?.response) === JSON.stringify(R); say('response', same, same ? 'the look twin carries the same block' : 'the look twin\'s response block is not the plain file\'s'); } }
    else if (twin?.scenarios?.response) say('response', false, 'the look twin carries a response block and the plain file none');
    else say('response', none !== undefined ? true : 'note', none !== undefined ? `nobody comes here, on purpose: ${none}` : `no scenarios.response block, and ${name} is not in NOBODY_COMES (tools/qa/level-needs.ts): say whether a team comes here, or that nobody does on purpose`); }
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
  for (const n of Object.keys(NOBODY_COMES)) if (!every.includes(n) || !rowsOf(n).length) { console.error(`NOBODY_COMES names '${n}', which is no level with a mission row: take the line out`); process.exit(1); }
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
    L.meta!.generator = 'tools/levels/not-there.ts'; delete L.surfaces; delete L.scenarios!.kitView; delete L.scenarios!.issue; delete L.scenarios!.response;
    L.boxes = L.boxes.filter(b => STRUCTURE.test(b.group ?? '')); L.props = [];
    const slab = roofBand(L).find(b => has(b, 'NoPrimary')); if (slab) slab.flags = slab.flags!.filter(f => f !== 'NoPrimary');
    L.boxes.push({ id: 'planted_dado', group: 'planted', c: along ? [d.hinge[0] + 0.12, 0.55, mid] : [mid, 0.55, d.hinge[1] + 0.12], h: along ? [0.004, 0.55, 2] : [2, 0.55, 0.004], flags: ['NoShadow'] });
    L.boxes.push({ id: 'planted_ground', group: 'planted', c: [20, 0.05, 14], h: [20, 0.005, 14], material: 'planted' });   // (one sheet over every finish the level has)
    L.boxes.push({ id: 'planted_wall', group: 'planted', c: [3, 1.5, 3], h: [0.06, 1.5, 1.5] }, { id: 'planted_shelf', group: 'planted', c: [2.7, 1, 3], h: [0.15, 1, 0.4] });   // (a shelf against a wall, a bulb behind it)
    L.lights.push({ id: 'planted_bulb', kind: 'point', pos: [4.5, 2, 3], group: 'planted', range: 5, intensity: 20 });
    L.lights.push({ id: 'planted_lamp', kind: 'spot', pos: [1, 3, 1], group: 'yard' }, { id: 'planted_sun', kind: 'dir', pos: [0, 0, 0], group: 'exterior' });
    const row: Row = { ...e, id: 'planted-row', place: undefined, blurb: 'short', defenders: 12, ways: ['one', 'two', 'three'], squads: !e.squads, only: undefined };
    const bareCard = { bangs: 0, charges: 0, smoke: 0, frags: 0, walls: 0, shells: 0, big: 'none' };   // (the kit's gap is PLANTED, whatever the issue table gives: every man's card emptied)
    const planted: Tables = { music: () => false, still: () => false, picture: () => false, docs: '', cards: () => Array.from({ length: KIT_MEMBERS }, (_, j) => ({ ...kitDefault(j), ...bareCard })) };
    const lines = ask(name, L, null, [row], planted);
    // (the response need's reds want a block: the same level again with a `why` of one word, under the name of a level NOBODY_COMES holds, beside a look twin whose block is another's)
    const blocked = structuredClone(L), other = structuredClone(L); blocked.scenarios!.response = { why: 'because', team: 'the planted team', raid: {} }; other.scenarios!.response = { why: 'because', team: 'another team' };
    const blockLines = [...ask('vault', blocked, other, [{ ...row, kind: 'quiet' }], planted), ...ask(name, other, blocked, [row], planted)].filter(l => l.need === 'response' && l.mark !== 'PASS');
    // (the ground's measure, on sheets made here: the world's slab with one thing laid over it every 2.5 m, or cut in 1 m strips of two paints)
    const made = (over: Partial<Box> | null, strips?: [string, string]): LevelFile => ({ lights: [], doors: [],
      materials: { dust: { albedo: [0.2, 0.15, 0.09] }, damp: { albedo: [0.08, 0.05, 0.03] }, wet: { albedo: [0.2, 0.15, 0.09], rough: 0.4 }, gravel: { albedo: [0.19, 0.145, 0.09] } },
      boxes: [{ id: 'world', c: [20, -0.12, 14], h: [20, 0.12, 14], material: 'dust' },
        ...(over ? Array.from({ length: 16 * 11 }, (_, k) => ({ id: `p${k}`, flags: ['NoShadow'], ...over, c: [1.25 + (k % 16) * 2.5, over.h ? over.h[1] : 0.012, 1.25 + Math.floor(k / 16) * 2.5], h: over.h ?? [0.5, 0.003, 0.4] })) : []),
        ...(strips ? Array.from({ length: 28 }, (_, k) => ({ id: `s${k}`, c: [20, 0.002, k + 0.5], h: [20, 0.002, 0.5], material: strips[k % 2] })) : [])] });
    const flat = (F: LevelFile, starts?: number[][]) => bareGround(F, starts).some(s => s.area >= GROUND.big && !s.margin);
    // (two rooms of 36 m² on a floor of their own, a door between them; and a world with a block on all of it but a ring 3 m wide)
    const wall = (id: string, x0: number, z0: number, x1: number, z1: number): Box => ({ id, c: [(x0 + x1) / 2, 1.5, (z0 + z1) / 2], h: [(x1 - x0) / 2, 1.5, (z1 - z0) / 2] });
    const rooms = (door: boolean): LevelFile => ({ ...made({ material: 'damp' }), doors: door ? [{ hinge: [20, 13.5], closedDir: Math.PI / 2, width: 1 } as Door] : [],
      boxes: [...made({ material: 'damp' }).boxes, { id: 'floor', c: [20, 0.02, 14], h: [6.2, 0.002, 3.2], material: 'wet' }, wall('n', 13.8, 10.8, 26.2, 11), wall('s', 13.8, 17, 26.2, 17.2), wall('w', 13.8, 11, 14, 17), wall('e', 26, 11, 26.2, 17), wall('m0', 19.9, 11, 20.1, 13.5), wall('m1', 19.9, 14.5, 20.1, 17)] });
    const ring: LevelFile = { ...made(null), boxes: [...made(null).boxes, wall('block', 3, 3, 37, 25)] };
    const groundMissed = [!flat(made(null)) && 'a bare sheet read as dressed', flat(made({ material: 'damp' })) && 'a dark patch every 2.5 m read as bare', !flat(made({ material: 'dust' })) && 'patches of their ground\'s own paint read as marks',
      flat(made({ material: 'wet' })) && 'a patch of another sheen every 2.5 m read as bare', flat(made({ material: 'dust', h: [0.1, 0.08, 0.1], flags: [] })) && 'rubble every 2.5 m read as bare',
      !flat(made(null, ['dust', 'gravel'])) && 'strips of two paints that do not read apart read as dressed', flat(made(null, ['dust', 'damp'])) && 'strips of two paints that read apart read as bare',
      flat(made({ material: 'damp', h: [0.03, 0.003, 0.4], yaw: 0.7 })) && 'a painted line 6 cm wide every 2.5 m, turned, read as bare', !flat(made({ material: 'dust', markings: [{ face: '+y' }], h: [20, 0.003, 14] })) && 'a yard with a marking somewhere on it read as dressed',
      flat(rooms(true)) && 'two rooms of 36 m² were added up through their door', !flat(rooms(false)) && 'two rooms of 36 m² with an open gap between them read as two',
      flat(ring) && 'a bare ring along the world\'s edge, no start on it, read as a stretch of the place', !flat(ring, [[1.5, 1.5]]) && 'a bare ring along the world\'s edge with the start on it read as margin',
      flat(rooms(false), [[1.5, 1.5]]) && 'two bare rooms the start cannot walk to read as ground of the place', !flat(rooms(false), [[17, 14]]) && 'two bare rooms with the start in one read as outside the place',
      !flat(made({ material: 'damp', h: [0.01, 0.003, 0.01] })) && 'a speck of paint every 2.5 m read as a mark'].filter(Boolean) as string[];
    // (the leak's measure, on rooms made here: a wall along x = 20, a shelf west of it, a bulb, a panel or the sky east of it)
    const room = (o: { shelf?: number[]; bulb?: number[]; light?: Partial<Light>; also?: number[]; alsoLight?: Partial<Light>; prop?: boolean; open?: boolean; panel?: boolean; gap?: boolean; wallTo?: number; roof?: 'none' | 'west' | 'all'; moon?: boolean; door?: boolean }): LevelFile => ({
      doors: o.door ? [{ id: 'd', hinge: [20, 13.5], closedDir: Math.PI / 2, width: 1, angle: o.open ? 1.4 : 0 }] : [],
      props: o.prop ? [{ id: 'bin', x: 19.7, z: 16, parts: [{ off: [0, 0.3, 0], h: [0.15, 0.3, 0.15] }] }] : [],
      lights: [...(o.bulb ? [{ id: 'bulb', kind: 'point', pos: [o.bulb[0], 2, o.bulb[1]], range: 6, intensity: 20, ...o.light }] : []), ...(o.also ? [{ id: 'own', kind: 'point', pos: [o.also[0], 2, o.also[1]], range: 6, intensity: 20, ...o.alsoLight }] : []), ...(o.moon ? [{ id: 'moon', kind: 'dir', pos: [0, 0, 0] }] : [])],
      switchables: [{ id: 'panel', boxes: ['panel_box'], on: !!o.panel, baseEmissive: [11, 10.5, 9.5] }],
      boxes: [{ id: 'world', c: [20, -0.12, 14], h: [20, 0.12, 14] }, ...(o.gap || o.door ? [wall('w0', 19.94, 4, 20.06, 13.5), wall('w1', 19.94, 14.5, 20.06, 24)] : [wall('w', 19.94, 4, 20.06, o.wallTo ?? 24)]),
        { id: 'shelf', c: [o.shelf?.[0] ?? 19.7, 1, o.shelf?.[1] ?? 14], h: [0.15, 1, o.shelf?.[2] ?? 0.4] }, { id: 'panel_box', c: [22, 2.98, 14], h: [0.6, 0.02, 0.3], flags: ['NoPrimary'] },
        ...(o.roof === 'all' ? [{ id: 'roof', c: [20, 3.1, 14], h: [20, 0.1, 14] }] : o.roof === 'west' ? [{ id: 'roof', c: [10, 3.1, 14], h: [10, 0.1, 14] }] : [])] });
    const leaks = (F: LevelFile) => leakReads(F).some(r => r.id === 'shelf'), strong = (F: LevelFile) => leakReads(F).some(r => r.id === 'shelf' && r.strong);
    const leakMissed = [!leaks(room({ bulb: [22, 14] })) && 'a shelf against a wall with a bulb behind it was not named', leaks(room({ bulb: [18, 14] })) && 'a shelf lit by its own room\'s bulb was named',
      leaks(room({ bulb: [22, 14], shelf: [17, 14] })) && 'a shelf three metres off the wall was named', leaks(room({ bulb: [22, 14], gap: true })) && 'a shelf that the bulb sees through an open gap was named',
      !leaks(room({ bulb: [22, 14], door: true })) && 'a shelf beside a shut door with a bulb behind it was not named', leaks(room({})) && 'a shelf with no light in the file was named',
      leaks(room({ bulb: [30, 14] })) && 'a shelf by a bulb out of its range was named', leaks(room({ bulb: [22, 14], light: { enabled: false } })) && 'a shelf by a bulb authored off was named',
      !leaks(room({ bulb: [22, 14], light: { kind: 'spot', dir: [1, -1, 0], outerDeg: 30 } })) && 'a shelf by a spot that lights the room behind the wall, looking away from it, was not named', !leaks(room({ bulb: [22, 14], light: { kind: 'spot', dir: [-1, -0.5, 0], outerDeg: 50 } })) && 'a shelf by a spot that looks at the wall was not named',
      !leaks(room({ panel: true })) && 'a shelf against a wall with a ceiling panel on behind it was not named',
      !strong(room({ bulb: [22, 14] })) && 'a shelf in a dark room by a bulb behind the wall was not strong', strong(room({ bulb: [22, 14], also: [18, 14] })) && 'a shelf with a bulb of its own room nearer than the one behind the wall was strong',
      !leaks(room({ bulb: [22, 14], also: [18, 14] })) && 'a shelf with a bulb each side of the wall was not named', strong(room({ bulb: [25.5, 14], light: { intensity: 2 } })) && 'a shelf by a weak bulb far behind the wall was strong',
      !strong(room({ bulb: [22, 14], also: [18, 14], alsoLight: { kind: 'spot', dir: [-1, -1, 0], outerDeg: 30 } })) && 'a shelf whose own room\'s spot looks away from it was not strong',
      leakReads(room({ bulb: [22, 14], prop: true })).every(r => r.id !== 'bin') && 'a loose prop against the wall was not named', leaks(room({ bulb: [22, 14], door: true, open: true })) && 'a door the file holds open was read as shut',
      !leaks(room({ bulb: [20.6, 12], wallTo: 14, shelf: [19.7, 13.8, 0.1] })) && 'a shelf by a wall\'s end with a bulb behind the wall was not named', leaks(room({ bulb: [20.6, 16.5], wallTo: 14, shelf: [19.7, 13.8, 0.1] })) && 'a shelf by a wall\'s end that the bulb sees round it was named',
      !leaks(room({ moon: true, roof: 'west' })) && 'a shelf under a roof against a wall with open sky behind it was not named', leaks(room({ moon: true, roof: 'all' })) && 'a shelf with a roof over both sides of the wall was named',
      leaks(room({ moon: true, roof: 'none' })) && 'a shelf under the same open sky as the far side was named'].filter(Boolean) as string[];
    /** what each planted gap must be found as: the mark, and every phrase its lines must carry */
    const WANT: Record<string, { mark: Mark; says: string[] }> = {
      generator: { mark: 'FAIL', says: ['not in the tree'] }, row: { mark: 'FAIL', says: ['no `place`', '`blurb` is 5 characters', '12 defenders', 'names 3 ways in', 'squads'] }, music: { mark: 'FAIL', says: ['no row'] },
      picture: { mark: 'FAIL', says: ['planted-row.jpg'] }, 'kit picture': { mark: 'FAIL', says: ['no scenarios.kitView'] }, lived: { mark: 'FAIL', says: ['is bare'] }, floor: { mark: 'NOTE', says: ['no `surfaces`'] },
      leak: { mark: 'NOTE', says: ['1 in planted by planted_bulb, as planted_shelf'] }, lamps: { mark: 'NOTE', says: ['planted_lamp'] }, moon: { mark: 'FAIL', says: ['2 directional'] }, doorway: { mark: 'FAIL', says: ['planted_dado'] }, roof: { mark: 'FAIL', says: ['drawn slab'] },
      kit: { mark: 'FAIL', says: ['you + 1: ', 'you + 4: '] }, ground: { mark: 'NOTE', says: ['of planted at'] }, response: { mark: 'NOTE', says: ['is not in NOBODY_COMES'] }, said: { mark: 'FAIL', says: ['names neither'] } };
    const missed = Object.entries(WANT).flatMap(([need, w]) => { const text = lines.filter(l => l.need === need && l.mark === w.mark).map(l => l.text).join('\n'); return w.says.filter(s => !text.includes(s)).map(s => `${need} ('${s}')`); });
    for (const m of groundMissed) missed.push(`ground (${m})`);
    for (const m of leakMissed) missed.push(`leak (${m})`);
    for (const says of ['is not a sentence', 'is not the plain file', 'one of the two is stale', 'a squad\'s room clear and no row', 'a quiet night gone loud and no row']) if (!blockLines.some(l => l.text.includes(says))) missed.push(`response ('${says}')`);
    for (const l of [...lines, ...blockLines]) if (l.mark !== 'PASS') console.log(`- ${l.mark} — ${name} (planted) · ${l.need}: ${l.text}`);
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
