// EVERY ROOM THE DEFENDERS CAN SHUT HAS ANOTHER WAY IN (the maintainer, 10-11, on the barricading: "i worry that it effectively requires the player to blow
// open the door with a door charge or 40mm. maybe we just need to design levels so there's always another route in? and then the gameplay element is trying to
// surprise the enemies from an entrance or window they don't expect?").
//
// What the defenders can do (src/game/digin.ts, asked here through the game's own predicates — nothing is re-derived): a room of the room fight (roomfight.ts
// roomAt: the floor reached without crossing a door) has its doors as ENTRIES; a man whose room it is hauls furniture to a door and wedges it when the door is
// `wedgeable` (not steel, not locked in the level file, no keypad), when the wedge HOLDS (doors.ts wedgeHolds: the leaf opens toward him), when his squad may
// (enemysquads.ts: a squad's `barricade` list — as shipped; `--nolists` asks it as one pool or a last stand would have it: any door), and while his room has
// wedged fewer than DIGIN.wedges doors.
//
// THE QUESTION is the squad's WALK IN FROM OUTSIDE, not one room's doors: with every room that has men in it (a room the level's structure names, or one a
// defender stands in as any of the level's missions is staged, or a rescue's data may deal one into: every roamer mark counts) wedging what it can — all of its doors that open into it when those are DIGIN.wedges or fewer,
// ANY DIGIN.wedges of them when there are more, every choice tried — is each such room still reached from the team's start and the ground round the place
// (floor that runs to the edge of the map, or 600 m² and over) without a charge or a 40 mm? Two rooms that each keep 'another door' which only joins them
// to each other are both shut, and the check says so. A WEDGE SHUTS A DOOR ONE WAY: it is locked against the face away from the man who set it, so
// nobody comes INTO his room by it, and from inside his room it is pulled open by hand. WHAT FOLLOWS: a room passes by a door that opens OUT of it (its
// own men cannot wedge that; the neighbours' wedge on it stops only the walk the other way) from floor the squad reaches, by a window from such floor,
// or by more doors than wedges.
// Furniture is not asked for (a wedge needs a piece in reach; furniture moves and a level gains it): the cautious answer.
//   door     a door no room has wedged that the squad can open: by hand, the pick or the boot — not locked steel (no pick, boot or charge shifts it), and a
//            keypad's bolt only from the face a boot drives it from
//   window   a pane of glass with floor on both faces that a round opens and a man walks through (bottom under 0.2 m, top at 1.85 m or over, not laminated,
//            not solid glass, and the player's own circle walked across it with the pane out) — Sam's feet and everybody's rounds; the nav grid has no way
//            through a broken pane, so teammates shoot through it and come in by a door
//   wall     ONLY on a level whose structure ISSUES wall charges for the run (scenarios.roomClear.wallCharges — the clinic, whose one idea is that the walls
//            are the way in): a place on a wall of the room where a wall charge is accepted from floor already reached. Those charges are the level's own
//            issue, on top of the kit. On every other level a wall charge spends one of the kit's, so it is listed (`--walls`), never counted.
//
//   bun run tools/qa/second-way-check.ts [level.json …] [--list] [--walls] [--nolists] [--verbose]     exit 0 = every such room is reached, 1 = a FAIL line,
//                                                                                                       2 = an unknown flag or level (nothing ran)
//   SECONDWAY_BREAK=1 …  = a window and an issued wall charge are not counted: must fail (the kill house's four rooms, the clinic's three)
//   bun run tools/qa/probes.ts secondway   (family `missions`; run in a process of its own)
// It stands AS SHIPPED whatever TPS_PROFILE says: which way a door opens is dealt under the page's door rules — on the frozen stand every leaf swings both
// ways, a wedge holds any of them, and the check would have nothing to say. A stand word in the caller's environment that takes the page's door rules or
// its breaking glass away (ONEWAY=0, QA_EXITSOUT=1, GLASSFX=off, GLASSBREAK=off …) is not the game the question is about: the check says so and exits 2.
// LIMITS: who stands where and where the team starts are taken together over a level's mission kinds (only the office has more than one, and it has no
// room to mend); a window counts only where glass breaks (the page as shipped: chaos over 0, the glass switches on).
// A NEW LEVEL is checked the day it has a row in scenarioList.ts (SCENARIOS, squad rows); before that: `second-way-check.ts <file>.json`.
// THE MENDS, when a room fails: hang one of its doors — one that leads to floor the squad reaches — to open OUT of it (`swing` on the level's door: no wedge
// inside holds it, and a wedge the neighbours set on it stops only the walk INTO their room), or give it a window a man steps through (an opening from under WINDOW_SILL up to WINDOW_HEAD
// or over — and under 1.9 m, or door-size.ts reads it as a doorway without a leaf — glass 'whole', wide enough not to be laminated: the kill house's `port`).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DT = 1 / 60, f1 = (x: number) => x.toFixed(1);
/** a window a man steps through: its bottom under this (the walker's band starts at 0.2 m: a kerb that high stops him) and its top at this or over */
export const WINDOW_SILL = 0.2, WINDOW_HEAD = 1.85;
const FLAGS = ['--list', '--walls', '--nolists', '--verbose'];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export interface WayDoor { name: string; to: string; /** the room whose men can wedge it ('' = nobody) */ by: string; why: string }
export interface WayWindow { box: number; at: [number, number]; type: string; to: string }
export interface RoomWays {
  level: string; room: string; cells: number; at: [number, number]; defenders: number; held: boolean;
  /** men are, or may be, at home here: a structure's room, or a defender stands in it as a mission is staged */
  manned: boolean; open: boolean; /** the squad walks here to begin with: its start, or ground that runs to the edge of the map */ source: boolean;
  doors: WayDoor[]; windows: WayWindow[]; walls: number;
  /** the squad gets here with no charge whatever the defenders wedge; if not, the wedges that shut it */
  reached: boolean; shutBy: string;
  /** with some choice of wedges the only walk here is through a window (this room's or one on the way): the player's feet alone, teammates follow by a door he opens */
  byWindow: boolean;
}

export async function secondWay(o: { levels?: string[]; walls?: boolean; nolists?: boolean; verbose?: boolean; list?: boolean } = {}): Promise<{ ok: boolean; rooms: RoomWays[]; /** false = the stand was not the page's: nothing was checked */ stand?: boolean }> {
  process.env.TPS_PROFILE = 'shipped';   // (before the harness is imported: it reads its stand as it loads)
  const { standUp, ROOT } = await import('./headless.ts');
  const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery, squadBarricade } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { wallAt, WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { glassBreakLive } = await import(`${ROOT}/src/game/glassbreak.ts`);
  const BREAK = process.env.SECONDWAY_BREAK === '1', OPEN = 2400, K = DIGIN.wedges as number;
  const rows: any[] = [...SCENARIOS].filter((e: any) => e.kind !== 'quiet');
  // every KIND of squad mission a level has is staged (the office: night breach, room clear, rescue), each at its largest squad: who stands where differs
  const byLevel = new Map<string, any[]>();
  for (const e of rows) { const f = e.level ?? 'office.json', L = byLevel.get(f) ?? []; const i = L.findIndex(w => w.kind === e.kind); if (i < 0) L.push(e); else if ((e.squad ?? 0) > (L[i].squad ?? 0)) L[i] = e; byLevel.set(f, L); }
  const LEVELS = o.levels?.length ? o.levels.map(f => basename(f)) : [...byLevel.keys()].sort();
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  const out: RoomWays[] = []; let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const rnd = Math.random, dOn = DESTRUCTION.on, wOn = WALLCHARGE.on, wOuter = WALLCHARGE.outer;

  try {
    for (const file of LEVELS) {
      const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'));
      const load = () => isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data);
      const lvl0 = load(), entries = byLevel.get(file) ?? [];
      const queries: string[] = entries.length ? entries.map((e: any) => scenarioQuery(e).slice(1).split('&').filter((k: string) => !k.startsWith('levelFile=')).join('&'))
        : [lvl0.scenarios?.roomClear ? 'roomclear&squad4' : lvl0.scenarios?.rescue ? 'rescue' : ''];
      // ---- stage each mission: the rooms (the same flood every time: keyed by their first cell), who stands in which, where the team starts
      const men = new Map<number, number>(), starts = new Set<number>(); let notStarted = '';
      let g: any = null, F: any = null, nav: any = null, cs = 0.5, rooms: any[] = [];
      const keyOf = (R: any): number => R.__key ??= Math.min(...R.cells);
      for (const q of queries) {
        Math.random = seeded(0x2a71);
        const W: any = await quiet(() => standUp({ level: g ? load() : lvl0 })); const gg = W.game;
        if (q) { const r: any = await quiet(() => startFromQuery(gg, new URLSearchParams(q))); if (r?.why) notStarted = `${q}: ${r.why}`; }
        for (let i = 0; i < 20; i++) { for (const gd of gg.guards) if (gd.team !== 'operative') { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; } gg.player.visibility = 0.05; W.step(DT); }
        const FF = gg.fight, n = gg.col.nav;
        const at = (p: number[]): any => p[0] < 0 || p[2] < 0 || p[0] >= n.W * n.cell || p[2] >= n.H * n.cell || n.isBlocked(p[0], p[2]) ? null : FF.roomAt([p[0], 0, p[2]]);
        const here = new Map<number, number>();
        for (const gd of gg.guards) if (gd.team !== 'operative' && gd.state !== 'dead') { const R = at(gd.char.pos); if (R) here.set(keyOf(R), (here.get(keyOf(R)) ?? 0) + 1); }
        for (const [k, c] of here) men.set(k, Math.max(men.get(k) ?? 0, c));
        const S0 = at(gg.player.char.pos); if (S0) starts.add(keyOf(S0));
        if (!g) {   // (the first staging is the one whose doors, panes and walls are asked)
          const off = [!DOORWAY.oneWay && 'doors swing both ways', DOORWAY.exitsOut && 'outside doors are dealt outward', !glassBreakLive(gg) && 'glass does not break'].filter(Boolean);
          if (off.length) { console.error(`second-way-check: this is not the page as shipped (${off.join(', ')}): a stand word in the environment? nothing was checked`); return { ok: false, rooms: [], stand: false }; }
          g = gg; F = FF; nav = n; cs = n.cell;
          const seen = new Set<any>();
          for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { if (nav.blocked[nav.idx(x, z)] === 1) continue; const R = F.roomAt([(x + 0.5) * cs, 0, (z + 0.5) * cs]); if (R && !seen.has(R)) { seen.add(R); rooms.push(R); } }
        }
      }
      const lvl = g.level, boxes = g.col.boxes;
      const roomAtXZ = (x: number, z: number): any => x < 0 || z < 0 || x >= nav.W * cs || z >= nav.H * cs || nav.isBlocked(x, z) ? null : F.roomAt([x, 0, z]);
      const S = lvl.scenarios?.roomClear, sRooms: any[] = S?.rooms ?? [];
      const names = new Map<any, { name: string; held: boolean }>();
      const named = (R: any): { name: string; held: boolean } => {
        let got = names.get(R); if (got) return got;
        let best: any = null, n = 0;
        for (const r of sRooms) { let k = 0; for (const c of R.cells) { const x = ((c % nav.W) + 0.5) * cs, z = (((c / nav.W) | 0) + 0.5) * cs; if (x >= r.bounds.x0 && x <= r.bounds.x1 && z >= r.bounds.z0 && z <= r.bounds.z1) k++; } if (k > n) { n = k; best = r; } }
        got = best && n >= R.cells.size * 0.3 ? { name: best.name ?? best.id, held: true } : R.cells.size >= OPEN ? { name: 'open floor', held: false } : { name: `floor by ${R.entries.map((e: any) => e.door.def.name).slice(0, 2).join(' / ')}`, held: false };
        names.set(R, got); return got;
      };
      const idx = new Map<any, number>(rooms.map((R, i) => [R, i]));
      // a rescue's cast is DEALT (which roamer marks are manned is drawn at each staging): every place the level may stand a man counts, whatever this staging drew
      const Rs = lvl.scenarios?.rescue;
      if (Rs) for (const m of [Rs.captor, Rs.doorMan?.inside, Rs.doorMan?.outside, ...(Rs.roamers ?? []), ...(Rs.guards ?? [])]) {
        const R = m?.pos ? roomAtXZ(m.pos[0], m.pos[2]) : null; if (R) men.set(keyOf(R), Math.max(men.get(keyOf(R)) ?? 0, 1)); }
      const manned = rooms.map(R => R.cells.size < OPEN && R.entries.length > 0 && (named(R).held || (men.get(keyOf(R)) ?? 0) > 0));
      // which squad's list a door is on (a level with squads: a door on no list is never wedged by a squad's man)
      const squads: any[] = S?.squads ?? [], lists = squads.map((sq: any) => new Set<string>(squadBarricade(sq, sRooms)));
      const onList = (d: any) => o.nolists || !squads.length || lists.some(L => L.has(d.def.name));
      // ---- doors: the two rooms each joins, the one it opens into (whose men a wedge holds for), and whether anybody may wedge it at all
      interface DoorRec { d: any; name: string; a: number; b: number; into: number; away: boolean; plain: string; pad: boolean; lockedSteel: boolean }
      const doors = new Map<any, DoorRec>();
      rooms.forEach((R, i) => { for (const e of R.entries) {
        let rec = doors.get(e.door);
        if (!rec) {
          const d = e.door; let other: any = null; for (const k of [0.6, 0.8, 1.0, 1.3, 1.7]) { other = roomAtXZ(e.at[0] + e.out[0] * k, e.at[2] + e.out[1] * k); if (other && other !== R) break; other = null; }
          const pad = !!g.devices?.padOf(d), locked = !!(d.def.locked || d.locked);
          rec = { d, name: d.def.name, a: i, b: other ? idx.get(other) ?? -1 : -1, into: -1, pad,
            away: g.doors.wedgeHolds(d, [e.at[0] + e.out[0] * 0.8, 0, e.at[2] + e.out[1] * 0.8]),   // (opens toward the floor beyond: open ground lists no doors of its own)
            lockedSteel: !!d.def.steel && locked, plain: d.def.steel ? 'steel' : locked ? 'locked in the level' : pad ? 'keypad' : !onList(d) ? 'on no squad\'s list' : '' };
          doors.set(d, rec);
        }
        if (g.doors.wedgeHolds(e.door, [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8])) rec.into = i;
      } });
      const recs = [...doors.values()];
      const W_of = rooms.map((_, i) => manned[i] ? recs.filter(r => r.into === i && !r.plain) : []);
      // ---- windows, once: a sheet a round opens and a man walks through, with floor of two rooms at its faces
      const wins: { box: number; a: number; b: number; type: string; at: [number, number] }[] = [];
      for (let bi = 0; bi < boxes.length; bi++) {
        const b = boxes[bi]; if (!(b.flags & BoxFlag.Glass)) continue;
        const thinX = b.h[0] < b.h[2], t = Math.min(b.h[0], b.h[2]); if (t > 0.05 || b.c[1] - b.h[1] >= WINDOW_SILL - 1e-6 || b.c[1] + b.h[1] < WINDOW_HEAD || Math.max(b.h[0], b.h[2]) < 0.3) continue;
        const type = g.glassBreak.typeOfPane(bi); if (type === 'laminated') continue;
        // …and once the glass is out a man WALKS through: the player's own circle and height band taken across the sheet with this pane open (a kerb 0.2 m
        // high, a lintel under his head or furniture against the glass stops him — and then the window is no way in)
        const walks = (): boolean => { const was = g.col.glassWalkable; g.col.glassWalkable = (i: number) => i === bi || !!was?.(i); try { for (let s = -0.7; s <= 0.7 + 1e-6; s += 0.1) { const p = thinX ? [b.c[0] + s, 0, b.c[2]] : [b.c[0], 0, b.c[2] + s], q: [number, number, number] = [p[0], 0, p[2]]; g.col.collideCircle(q, 0.42, 0.2, 1.7, 2); if (Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.02) return false; } return true; } finally { g.col.glassWalkable = was; } };
        for (const off of [0.45, 0.75]) {
          const A = thinX ? roomAtXZ(b.c[0] - off, b.c[2]) : roomAtXZ(b.c[0], b.c[2] - off), C = thinX ? roomAtXZ(b.c[0] + off, b.c[2]) : roomAtXZ(b.c[0], b.c[2] + off);
          if (!A || !C || A === C) continue;
          if (walks()) wins.push({ box: bi, a: idx.get(A)!, b: idx.get(C)!, type, at: [b.c[0], b.c[2]] }); break;
        }
      }
      // ---- wall places, once (only where asked): where a wall charge is accepted, from which room into which
      const issued = ((S as any)?.wallCharges ?? 0) > 0, askWalls = !!o.walls || issued;   // (wall charges issued for the run: a wall place is a way in on this level)
      const wallsInto = rooms.map(() => new Map<number, number>());   // [room it opens] → from-room → places
      if (askWalls) {
        DESTRUCTION.on = true; WALLCHARGE.on = true; WALLCHARGE.outer = true;
        try {
          const N = Math.min(g.destr.walls.authored, boxes.length), C = g.wallCharge as any;
          for (let i = 0; i < N; i++) {
            const b = boxes[i]; if (b.h[1] < 0.9 || Math.min(b.h[0], b.h[2]) > 0.2 || Math.max(b.h[0], b.h[2]) < 0.75) continue;
            const alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2];
            for (let u = -L + 0.1; u <= L - 0.1 + 1e-6; u += 0.5) for (const side of [1, -1]) {
              const at: [number, number, number] = alongX ? [b.c[0] + u, 0, b.c[2]] : [b.c[0], 0, b.c[2] + u];
              const from: [number, number, number] = alongX ? [at[0], 0, b.c[2] + side * 1.0] : [b.c[0] + side * 1.0, 0, at[2]];
              const A = roomAtXZ(from[0], from[2]), B = alongX ? roomAtXZ(at[0], b.c[2] - side * 1.0) : roomAtXZ(b.c[0] - side * 1.0, at[2]);
              if (!A || !B || A === B || B.cells.size >= OPEN) continue;
              const w0 = wallAt(g, at, from); if (!w0 || w0.index !== i || !w0.ok) continue;
              const w = C.settle(w0); if (C.setSpot(w) && !C.openAt(w) && C.farFloor(w)) { const m = wallsInto[idx.get(B)!], a = idx.get(A)!; m.set(a, (m.get(a) ?? 0) + 1); }
            }
          }
        } finally { DESTRUCTION.on = dOn; WALLCHARGE.on = wOn; WALLCHARGE.outer = wOuter; }
      }
      // ---- the walk in: from the open floor and the team's starts, through whatever is not wedged
      // (the ground round the place — floor that runs to the edge of the map — is the squad's to walk whatever the level calls a room: a lot or a lane
      // under 600 m² is still outside)
      const edge = (R: any): boolean => { for (const c of R.cells) { const x = c % nav.W, z = (c / nav.W) | 0; if (x <= 1 || z <= 1 || x >= nav.W - 2 || z >= nav.H - 2) return true; } return false; };
      const sources = rooms.map((R, i) => R.cells.size >= OPEN || starts.has(keyOf(R)) || (edge(R) && !manned[i]));   // (a room with men at home is never 'outside', wherever it lies)
      const squadOpens = (r: DoorRec, to: number) => !r.lockedSteel && (!r.pad || r.into === to);   // (a keypad's bolt gives to a boot only from its push face)
      const walk = (blocked: Set<DoorRec>, glass = true): boolean[] => {
        const got = sources.slice(); let more = true;
        while (more) {
          more = false;
          // (a wedge locks a door against its FAR face only — digin.ts wedge(): `keySide` = the side away from the man who set it — so nobody comes INTO
          // the room it was wedged from by that door, and from inside that room it is pulled open by hand: a wedged door is a one-way door)
          for (const r of recs) if (r.a >= 0 && r.b >= 0) { const w = blocked.has(r);
            if (got[r.a] && !got[r.b] && squadOpens(r, r.b) && !(w && r.into === r.b)) { got[r.b] = more = true; }
            if (got[r.b] && !got[r.a] && squadOpens(r, r.a) && !(w && r.into === r.a)) { got[r.a] = more = true; } }
          if (!BREAK) {
            if (glass) for (const w of wins) { if (got[w.a] !== got[w.b]) { got[w.a] = got[w.b] = more = true; } }
            if (issued) rooms.forEach((_, i) => { if (!got[i]) for (const a of wallsInto[i].keys()) if (got[a]) { got[i] = more = true; break; } });
          }
        }
        return got;
      };
      // every choice the defenders have: a room with more doors than wedges picks which
      const fixed = new Set<DoorRec>(), choosers: DoorRec[][][] = [];
      const subsets = (L: DoorRec[], k: number): DoorRec[][] => k === 0 || !L.length ? [[]] : L.length <= k ? [L] : [...subsets(L.slice(1), k - 1).map(s => [L[0], ...s]), ...subsets(L.slice(1), k)];
      rooms.forEach((_, i) => { const L = W_of[i]; if (!L.length) return; if (L.length <= K) for (const r of L) fixed.add(r); else choosers.push(subsets(L, K)); });
      const combos = choosers.reduce((n, c) => n * c.length, 1), unreached = rooms.map(() => ''), glassOnly = rooms.map(() => false); let tried = 0;
      const tell = (blocked: Set<DoorRec>) => { tried++; const got = walk(blocked); rooms.forEach((_, i) => { if (!got[i] && !unreached[i]) unreached[i] = [...blocked].filter(r => r.a === i || r.b === i).map(r => r.name).join(', ') || 'no door leads to it'; });
        // (a window is Sam's alone — the nav grid has no way through a broken pane — so a room reached only THROUGH a window, its own or one further out, is named)
        if (wins.length && !BREAK) { const dry = walk(blocked, false); rooms.forEach((_, i) => { if (got[i] && !dry[i]) glassOnly[i] = true; }); } };
      if (combos <= 20000) { const rec = (k: number, B: Set<DoorRec>) => { if (k === choosers.length) return tell(B); for (const s of choosers[k]) rec(k + 1, new Set([...B, ...s])); }; rec(0, fixed); }
      else tell(new Set([...fixed, ...choosers.flat(2)]));   // (too many choices to try: every door any of them could wedge taken as wedged — the cautious answer)
      // ---- the list and the verdict
      const mine: RoomWays[] = [];
      rooms.forEach((R, i) => {
        if (!R.entries.length) return;   // (floor no door leads onto)
        let sx = 0, sz = 0; for (const c of R.cells) { sx += ((c % nav.W) + 0.5) * cs; sz += (((c / nav.W) | 0) + 0.5) * cs; }
        const nm = named(R), nameOf = (j: number) => j < 0 ? '?' : named(rooms[j]).name;
        const ds: WayDoor[] = recs.filter(r => r.a === i || r.b === i).map(r => ({ name: r.name, to: nameOf(r.a === i ? r.b : r.a), by: !r.plain && r.into >= 0 && manned[r.into] ? nameOf(r.into) : '', why: r.plain || (r.into < 0 ? (r.away ? 'opens away from the room' : 'opens both ways') : r.into === i ? (manned[i] ? '' : 'nobody at home here') : manned[r.into] ? '' : 'opens away from the room') }));
        const ws: WayWindow[] = wins.filter(w => w.a === i || w.b === i).map(w => ({ box: w.box, at: w.at, type: w.type, to: nameOf(w.a === i ? w.b : w.a) }));
        let walls = 0; for (const c of wallsInto[i].values()) walls += c;
        mine.push({ level: file, room: nm.name, cells: R.cells.size, at: [sx / R.cells.size, sz / R.cells.size], defenders: men.get(keyOf(R)) ?? 0, held: nm.held, manned: manned[i], open: R.cells.size >= OPEN, source: sources[i], doors: ds, windows: ws, walls, reached: !unreached[i], shutBy: unreached[i], byWindow: glassOnly[i] });
      });
      out.push(...mine);
      if (o.list || o.verbose) for (const r of mine) console.log(`    ${file.padEnd(20)} ${r.room.padEnd(30).slice(0, 30)} ${String(Math.round(r.cells / 4)).padStart(4)} m²  men ${r.defenders}  doors ${r.doors.map(d => `${d.name} → ${d.to}${d.by ? ` [wedged from ${d.by}]` : d.why ? ` (${d.why})` : ''}`).join(', ')}${r.windows.length ? `  · windows ${r.windows.length} (${[...new Set(r.windows.map(w => w.type + ' → ' + w.to))].join('; ')})` : ''}${askWalls ? `  · wall places ${r.walls}` : ''}${r.source ? '  · the squad walks here' : ''}${r.reached ? '' : `  · SHUT by ${r.shutBy}`}`);
      const bad = mine.filter(r => r.manned && !r.reached), empty = mine.filter(r => !r.manned && !r.open && !r.reached);   // (a room nobody is posted in and no structure names is noted, not failed: nobody is at home in it to shut it)
      const byGlass = mine.filter(r => r.manned && r.reached && r.byWindow), byWall = issued ? mine.filter(r => r.manned && r.reached && !byGlass.includes(r) && r.walls && r.doors.every(d => d.by)) : [];
      verdict(!notStarted && !bad.length, `${file}: every room they can shut has another way in`,
        notStarted ? `a mission did not start (${notStarted})` : `${mine.length} rooms, ${mine.filter(r => r.manned).length} with men at home, ${queries.length} mission${queries.length > 1 ? 's' : ''} staged, ${tried} wedge choice${tried > 1 ? 's' : ''} tried${bad.length ? ` — NO WAY IN BUT A CHARGE: ${bad.map(r => `${r.room} (at ${f1(r.at[0])}, ${f1(r.at[1])}; doors ${r.doors.map(d => `${d.name} → ${d.to}`).join(', ')}; shut by ${r.shutBy})`).join(' · ')}` : ''}${byGlass.length ? ` — by a window alone (the player first: teammates do not climb through): ${byGlass.map(r => r.room).join(', ')}` : ''}${byWall.length ? ` — by its walls alone (wall charges are issued here): ${byWall.map(r => `${r.room} ${r.walls} places`).join(', ')}` : ''}${empty.length ? ` · nobody posted, not counted: ${empty.map(r => `${r.room} (${r.doors.map(d => d.name).join(', ')})`).join(', ')}` : ''}`);
    }
  } finally { Math.random = rnd; DESTRUCTION.on = dOn; WALLCHARGE.on = wOn; WALLCHARGE.outer = wOuter; }
  console.log(fails ? `=== second-way: ${fails} of ${checks} FAILED ===` : `=== second-way: ALL PASS (${checks}) ===`);
  return { ok: !fails, rooms: out };
}

if (import.meta.main) {
  const args = process.argv.slice(2), levels = args.filter(a => !a.startsWith('--')).map(a => basename(a)), dir = resolve(import.meta.dir, '../../levels');
  const badFlag = args.filter(a => a.startsWith('--') && !FLAGS.includes(a)), badLevel = levels.filter(f => !existsSync(resolve(dir, f)));
  if (badFlag.length || badLevel.length) {
    if (badFlag.length) console.error(`second-way-check: unknown flag ${badFlag.join(' ')} — the flags are ${FLAGS.join(' ')}`);
    if (badLevel.length) console.error(`second-way-check: no such level ${badLevel.join(' ')} — levels/ has ${readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('-gwot')).join(' ')}`);
    process.exit(2);
  }
  const r = await secondWay({ levels, walls: args.includes('--walls'), nolists: args.includes('--nolists'), verbose: args.includes('--verbose'), list: args.includes('--list') });
  process.exit(r.stand === false ? 2 : r.ok ? 0 : 1);
}
