// The two conversions between the level FILE (levelData.ts LevelData: ids, flag names, material keys) and the level the game RUNS (level.ts Level: Box[]
// with bit flags, array indices, LightDef[] …):
//   loadLevel(data)          → Level   what buildLevel() does with levels/office.json at every boot (browser, headless harness, tools alike)
//   levelToData(level, opts) → LevelData   the exporter's direction (tools/level-export.ts turns the legacy procedural generator's output into the file),
//                                           and the round-trip probe's (tools/qa/level-probes.ts)
// Both preserve ARRAY ORDER exactly — data.boxes[i] ⇄ level.boxes[i] ⇄ world.statics[i] — and resolve every cross reference (a light's fixture, a
// switchable's boxes, the breaker's pair, a beacon's dome) id ⇄ index. Nothing here is procedural: the one computed thing is a prop's collision footprint
// fitted from its parts (fitPropFootprint, the generator's own rule), and a file may pin that too (PropData.half / height).
import type { Vec3 } from '../math/vec';
import { Box, BoxFlag, makeBox, ROUGH_DEFAULT } from './boxes';
import type { Level, LightDef, PropDef, PropPart, LevelDoorDef, PatrolRoute, Chokepoint, RoomClearPlan, BreachPlan, DaylightDef, DeviceDef, CivilianDef, VentDef, VolumeDef } from './level';
import { withScript } from './level';
import { LEVEL_SCRIPTS } from './levelScripts';
import { LevelData, LEVEL_DATA_VERSION, BoxData, DoorData, LightData, PropData, MaterialData, FloorData, SurfacesData, RoomClearPlanData, BreachPlanData, ObjectiveData, DeviceData, CivilianData, VentData, validateLevelData, flagsToBits, bitsToFlags } from './levelData';
import { copyMarkings } from './markings';
import { LIVED, isLived } from './lived';   // (no imports of its own: the lived-in rooms' switch and what counts as lived)
import { DESTRUCTION, DRESS_GROUP } from '../game/destructionSwitch';   // (no imports of its own: the one switch + the dressing group's name)

const V = (v: readonly number[]): Vec3 => [v[0], v[1], v[2]];
const VV = (a: readonly (readonly number[])[]): Vec3[] => a.map(V);
/** structured deep copy for the plan blobs (plain JSON data: arrays, objects, numbers, strings) */
/** per loaded level (the runtime object): the FILE's own records as this stand loaded them — the boxes (index for index `level.boxes`: ids, groups and flags
 *  as written, which a runtime box does not carry), the doors, the lamps and the loose props (index for index `level.props`, with their ids) — and `left`: the NAMES of what this stand left out of the
 *  file (lived-in rooms or the dressing switched off: each such box's id and group, each such prop's id), so that a name written for them is known for one. What src/host/kitViewPlan.ts measures a way in from (src/host/kitView.ts) */
export const levelFileOf = new WeakMap<object, { boxes: readonly BoxData[]; doors: readonly DoorData[]; lights: readonly LightData[]; props: readonly PropData[]; left: readonly string[] }>();
function clone<T>(v: T): T { if (Array.isArray(v)) return v.map(clone) as unknown as T; if (v && typeof v === 'object') { const o: any = {}; for (const k of Object.keys(v)) { const x = (v as any)[k]; if (x !== undefined) o[k] = clone(x); } return o; } return v; }

/** The collision footprint the physics layer wants for a loose prop, fitted from its parts exactly as the generator's fitProp measured it: the bounding
 *  rectangle of the (yawed) parts in the prop frame → half extents (≥ 5 cm), and the tallest part top → height (≥ 10 cm). Parts are expected centred on
 *  the prop origin (the generator re-centred them; the editor's lint checks it). `mid` = that rectangle's centre in the prop frame, which the generators'
 *  fitProp re-centres the origin on (officeGen.ts, levelKit.ts). */
export function fitPropFootprint(parts: readonly { off: Vec3; h: Vec3; yaw?: number }[]): { half: [number, number]; height: number; mid: [number, number] } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, height = 0.1;
  for (const q of parts) {
    const yaw = q.yaw ?? 0; const cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw)); const ex = cs * q.h[0] + sn * q.h[2], ez = sn * q.h[0] + cs * q.h[2];
    x0 = Math.min(x0, q.off[0] - ex); x1 = Math.max(x1, q.off[0] + ex); z0 = Math.min(z0, q.off[2] - ez); z1 = Math.max(z1, q.off[2] + ez); height = Math.max(height, q.off[1] + q.h[1]);
  }
  return { half: [Math.max(0.05, (x1 - x0) / 2), Math.max(0.05, (z1 - z0) / 2)], height, mid: [(x0 + x1) / 2, (z0 + z1) / 2] };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ LevelData → Level
/** the name of the file a loaded level came from (LevelData.name) — beside the Level, not on it: its shape is what generators and round trips compare.
 *  Asked by game/weather.ts for a level built for snow (game/weatherKinds.ts SNOW_LEVELS). A Level nobody loaded from data (a generator's, a bare stage) has none. */
const levelNames = new WeakMap<Level, string>();
export function levelNameOf(level: Level | null | undefined): string | null { return (level && levelNames.get(level)) ?? null; }
/** Build the runtime Level from level data. Validates first (throws listing every problem) unless told the caller already has. Every vector is copied:
 *  the game mutates its Level (box flags, scratch routes) and two loads must never share state. */
export function loadLevel(data: LevelData, opts: { validate?: boolean; dressing?: boolean; lived?: boolean } = {}): Level {
  if (opts.validate !== false) {
    const errs = validateLevelData(data);
    if (errs.length) throw new Error(`level '${data?.name ?? '?'}' (v${(data as any)?.version} vs loader v${LEVEL_DATA_VERSION}): ${errs.length} error(s)\n  ${errs.slice(0, 20).join('\n  ')}${errs.length > 20 ? `\n  … ${errs.length - 20} more` : ''}`);
  }
  const mats = new Map(Object.entries(data.materials));   // (own keys only — validate already refused 'constructor' & co. as material names)
  const albedoOf = (o: { material?: string; albedo?: Vec3 }): Vec3 => {
    if (o.material === undefined) return V(o.albedo!);
    const m = mats.get(o.material); if (!m) throw new Error(`level '${data.name}': unknown material '${o.material}'`); return V(m.albedo);
  };
  // boxes, in file order (index i of the file IS static box i)
  const boxIndex = new Map<string, number>();
  // (the DRESSING — things a level file carries only to be wrecked, appended last by tools/levels/dress.ts — is left out with the destruction switch off: every other
  // box keeps its index and the level is the one it was before there was any)
  // (the LIVED things — what furnishes a room as the office's rooms are furnished, scene/lived.ts: boxes in group 'lived.<room>', props / lights / fixtures whose id
  // starts 'lived.' — are left out the same way with their switch off: nothing else moves, and nothing that is kept may name one)
  const lived = opts.lived ?? LIVED.on, dressed = opts.dressing ?? DESTRUCTION.on;
  const fileBoxes = lived && dressed ? data.boxes : data.boxes.filter(b => (dressed || b.group !== DRESS_GROUP) && (lived || !isLived(b.group)));
  const fileProps = lived ? data.props : data.props.filter(p => !isLived(p.id)), fileLights = lived ? data.lights : data.lights.filter(l => !isLived(l.id)), fileSwitchables = lived ? data.switchables : data.switchables.filter(s => !isLived(s.id));
  const boxes: Box[] = fileBoxes.map((b, i) => {
    boxIndex.set(b.id, i);
    const p: Partial<Box> & { c: Vec3; h: Vec3 } = { c: V(b.c), h: V(b.h), yaw: b.yaw ?? 0, albedo: albedoOf(b), emissive: b.emissive ? V(b.emissive) : [0, 0, 0], flags: flagsToBits(b.flags) };
    if (b.rot) p.rot = [b.rot[0], b.rot[1], b.rot[2], b.rot[3]];
    if (b.name !== undefined) p.name = b.name;
    if (b.cutHeight !== undefined) p.cutHeight = b.cutHeight;
    const marks = copyMarkings(b.markings); if (marks) p.marks = marks;   // (through markings.ts marking(): the same structure the generator builds)
    // the finish (Box.rough / metal): the box's own, else its material's; absent both = matte dielectric — nothing written, so a file without finishes loads to
    // the very Level it always did (`metal` is only ever carried as true: false is the default and stays unwritten, as levelToData writes it)
    const m = b.material !== undefined ? mats.get(b.material) : undefined;
    const rough = b.rough ?? m?.rough, metal = b.metal ?? m?.metal;
    if (rough !== undefined) p.rough = rough;
    if (metal) p.metal = true;
    return makeBox(p);
  });
  const bx = (id: string) => { const i = boxIndex.get(id); if (i === undefined) throw new Error(`level '${data.name}': unknown box '${id}'`); return i; };
  // loose props
  const props: PropDef[] = fileProps.map(p => {
    const parts: PropPart[] = p.parts.map(q => { const part: PropPart = { off: V(q.off), h: V(q.h), yaw: q.yaw ?? 0, albedo: albedoOf(q) }; const marks = copyMarkings(q.markings); if (marks) part.marks = marks; return part; });
    const fit = fitPropFootprint(parts);
    return { kind: p.kind, name: p.name ?? p.id, x: p.x, z: p.z, yaw: p.yaw ?? 0, parts, half: p.half ? [p.half[0], p.half[1]] : fit.half, height: p.height ?? fit.height, mass: p.mass };
  });
  // lights
  const lightOf = (l: LightData): LightDef => {
    const d: LightDef = { kind: l.kind, pos: V(l.pos), dir: V(l.dir), color: V(l.color), intensity: l.intensity, range: l.range, innerDeg: l.innerDeg, outerDeg: l.outerDeg, name: l.id, group: l.group, enabled: l.enabled, volumetric: l.volumetric };
    if (l.fixture !== undefined) d.fixtureBox = bx(l.fixture);
    if (l.radius !== undefined) d.radius = l.radius;
    if (l.mains !== undefined) d.mains = l.mains;
    if (l.broad !== undefined) d.broad = l.broad;
    return d;
  };
  const lights = fileLights.map(lightOf);
  const switchables: Level['switchables'] = fileSwitchables.map(s => {
    const o: Level['switchables'][number] = { name: s.id, boxes: s.boxes.map(bx), group: s.group, on: s.on, baseEmissive: V(s.baseEmissive) };
    if (s.flicker !== undefined) o.flicker = s.flicker; if (s.mains !== undefined) o.mains = s.mains;
    return o;
  });
  const doors: LevelDoorDef[] = data.doors.map(o => {
    const d: LevelDoorDef = { name: o.id, hinge: [o.hinge[0], o.hinge[1]], closedDir: o.closedDir, width: o.width };
    if (o.angle !== undefined) d.angle = o.angle; if (o.exterior !== undefined) d.exterior = o.exterior; if (o.closer !== undefined) d.closer = o.closer;
    if (o.minAngle !== undefined) d.minAngle = o.minAngle; if (o.maxAngle !== undefined) d.maxAngle = o.maxAngle;
    if (o.locked !== undefined) d.locked = o.locked; if (o.lock !== undefined) d.lock = o.lock; if (o.keySide !== undefined) d.keySide = o.keySide; if (o.steel !== undefined) d.steel = o.steel;
    if (o.swing !== undefined) d.swing = o.swing;
    return d;
  });
  const routes: PatrolRoute[] = data.routes.map(r => { const o: PatrolRoute = { name: r.name ?? r.id, points: VV(r.points), wait: [...r.wait] }; if (r.weapon !== undefined) o.weapon = r.weapon; if (r.keys !== undefined) o.keys = [...r.keys]; return o; });
  const chokepoints: Chokepoint[] = data.chokepoints.map(c => ({ name: c.name ?? c.id, pos: V(c.pos), yaw: c.yaw }));
  const civilians: CivilianDef[] | undefined = data.civilians?.map(c => { const o: CivilianDef = { name: c.name ?? c.id, kind: c.kind, tint: V(c.tint), points: VV(c.points), wait: [...c.wait] }; if (c.tint2 !== undefined) o.tint2 = V(c.tint2); if (c.tasks !== undefined) o.tasks = [...c.tasks]; if (c.face !== undefined) o.face = [...c.face]; return o; });
  const devices: DeviceDef[] = data.devices.map(deviceOf);
  const vents: VentDef[] | undefined = data.vents?.map(v => { const o: VentDef = { name: v.id, pos: V(v.pos), dir: V(v.dir), speed: v.speed, spread: v.spread, reach: v.reach }; for (const k of ['size', 'period', 'duty', 'phase', 'mains'] as const) if (v[k] !== undefined) (o as any)[k] = v[k]; return o; });   // (id → name, floor / notes dropped like a door's; optional fields written iff present)
  const planOf = <T extends RoomClearPlanData>(p: T): Omit<T, 'id'> => { const q = clone(p) as any; delete q.id; return q; };
  const clearPlans: RoomClearPlan[] = data.plans.roomClear.map(p => planOf(p) as RoomClearPlan);
  // mission: the fixed thread's three objectives back onto Level.mission's shape (validate guaranteed one of each)
  const ob = <K extends ObjectiveData['kind']>(k: K) => data.mission.objectives.find(o => o.kind === k) as Extract<ObjectiveData, { kind: K }>;
  const reach = ob('reach'), drive = ob('drive'), exfil = ob('exfil');
  const level: Level = {
    boxes, props, lights, switchables,
    ...(data.daylight ? { daylight: { sun: lightOf(data.daylight.sun), sky: { zenith: V(data.daylight.sky.zenith), horizon: V(data.daylight.sky.horizon) }, groupsOn: [...data.daylight.groupsOn], groupsOff: [...data.daylight.groupsOff], lightsOff: [...data.daylight.lightsOff], haze: data.daylight.haze, exposure: data.daylight.exposure } satisfies DaylightDef } : {}),
    ...(data.plans.breach ? { breach: planOf(data.plans.breach) as BreachPlan } : {}),
    doors,
    devices,
    ...(vents ? { vents } : {}),
    breaker: { pos: V(data.breaker.pos), boxes: [bx(data.breaker.panel), bx(data.breaker.led)], ...(data.breaker.fumble !== undefined ? { fumble: data.breaker.fumble } : {}) },
    beacons: data.beacons.map(b => ({ pos: V(b.pos), box: bx(b.box) })),
    playerSpawn: V(data.mission.playerSpawn),
    routes, chokepoints, clearPlans,
    ...(civilians ? { civilians } : {}),
    ...(data.volumes.length ? { volumes: data.volumes.map((v): VolumeDef => ({ name: v.id, kind: v.kind, c: V(v.c), h: V(v.h), ...(v.yaw !== undefined ? { yaw: v.yaw } : {}) })) } : {}),   // the level script's trigger volumes (game/director.ts onEnter) — written iff authored, so a level with none loads key for key as before
    sky: { zenith: V(data.sky.zenith), horizon: V(data.sky.horizon) },
    mission: { serverRoom: { x0: reach.area.x0, x1: reach.area.x1, z0: reach.area.z0, z1: reach.area.z1 }, entryDoor: reach.door, rack: { index: drive.rackIndex, front: V(drive.front), halfW: drive.halfW }, exfilDoor: exfil.door, exfilX: exfil.x, exfilZ: exfil.z, ...(exfil.out ? { exfilOut: [exfil.out[0], exfil.out[1]] as [number, number] } : {}) },
    ...(data.meta.markTexel !== undefined ? { markTexel: data.meta.markTexel } : {}),
    ...(data.scenarios ? { scenarios: clone(data.scenarios) } : {}),   // (the runtime structs verbatim: scene/scenarios.ts)
  };
  // TODO(G2): data.floors / data.connectors → per-floor nav + stair links. data.volumes → Level.volumes above (the Director's onEnter).
  // data.surfaces → Level.surfaces, what game/floor.ts reads for this level's footsteps: non-enumerable, so a Level compared or written as data is what it was
  // (a file with none: floor.ts's own office map, which level-probes.ts holds equal to the office file's block).
  if (data.surfaces) Object.defineProperty(level, 'surfaces', { value: clone(data.surfaces), enumerable: false, writable: true, configurable: true });
  { const script = LEVEL_SCRIPTS[data.name]; if (script) withScript(level, script); }   // (a level that carries a script: scene/levelScripts.ts)
  levelNames.set(level, data.name); const inB = new Set(fileBoxes), inP = new Set(fileProps), left = [...new Set([...data.boxes.filter(b => !inB.has(b)).flatMap(b => b.group !== undefined ? [b.id, b.group] : [b.id]), ...data.props.filter(p => !inP.has(p)).map(p => p.id)])];
  levelFileOf.set(level, { boxes: fileBoxes, doors: data.doors, lights: fileLights, props: fileProps, left });
  return level;
}
/** one device record → its runtime def (id → name, floor / notes dropped like a door's, every vector copied, optional fields written iff present) */
function deviceOf(v: DeviceData): DeviceDef {
  if (v.kind === 'camera') {
    const d: DeviceDef = { kind: 'camera', name: v.id, pos: V(v.pos), yaw: v.yaw };
    if (v.pitch !== undefined) d.pitch = v.pitch; if (v.sweep !== undefined) d.sweep = [v.sweep[0], v.sweep[1]]; if (v.sweepPeriod !== undefined) d.sweepPeriod = v.sweepPeriod;
    if (v.fovDeg !== undefined) d.fovDeg = v.fovDeg; if (v.range !== undefined) d.range = v.range; if (v.group !== undefined) d.group = v.group; if (v.mains !== undefined) d.mains = v.mains;
    return d;
  }
  if (v.kind === 'keypad') return { kind: 'keypad', name: v.id, pos: V(v.pos), yaw: v.yaw, door: v.door, code: v.code };
  const d: DeviceDef = { kind: 'laser', name: v.id, from: V(v.from), to: V(v.to) };
  if (v.group !== undefined) d.group = v.group; if (v.mains !== undefined) d.mains = v.mains; if (v.alarm !== undefined) d.alarm = v.alarm;
  return d;
}
/** …and back (the exporter's / round trip's direction): name → id, no floor written (absent = the first, as for doors) */
function deviceData(d: DeviceDef): DeviceData {
  if (d.kind === 'camera') {
    const v: DeviceData = { id: d.name, kind: 'camera', pos: V(d.pos), yaw: d.yaw };
    if (d.pitch !== undefined) v.pitch = d.pitch; if (d.sweep !== undefined) v.sweep = [d.sweep[0], d.sweep[1]]; if (d.sweepPeriod !== undefined) v.sweepPeriod = d.sweepPeriod;
    if (d.fovDeg !== undefined) v.fovDeg = d.fovDeg; if (d.range !== undefined) v.range = d.range; if (d.group !== undefined) v.group = d.group; if (d.mains !== undefined) v.mains = d.mains;
    return v;
  }
  if (d.kind === 'keypad') return { id: d.name, kind: 'keypad', pos: V(d.pos), yaw: d.yaw, door: d.door, code: d.code };
  const v: DeviceData = { id: d.name, kind: 'laser', from: V(d.from), to: V(d.to) };
  if (d.group !== undefined) v.group = d.group; if (d.mains !== undefined) v.mains = d.mains; if (d.alarm !== undefined) v.alarm = d.alarm;
  return v;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ Level → LevelData
export interface LevelToDataOpts {
  name: string;
  /** the paint palette: any box / part albedo that equals a material's albedo exactly is written as that material key; the rest stay inline */
  materials?: Record<string, MaterialData>;
  /** per box index: the id to write (absent → a semantic id for referenced boxes, else box_NNNN) and the editor group */
  boxIds?: readonly (string | undefined)[]; boxGroups?: readonly (string | undefined)[];
  floors?: FloorData[]; surfaces?: SurfacesData; meta?: LevelData['meta'];
  /** pass-through for what Level has no slot for yet */
  volumes?: LevelData['volumes']; connectors?: LevelData['connectors'];
}
/** Convert a runtime Level (the procedural generator's, or a loaded one) into level data. Optional fields are written iff the Level had them, so
 *  loadLevel(levelToData(L)) reproduces L key for key; ids are generated deterministically (see boxIdFor) unless supplied. */
export function levelToData(level: Level, opts: LevelToDataOpts): LevelData {
  const floors: FloorData[] = opts.floors?.map(f => ({ ...f })) ?? [{ id: 'f0', name: 'ground floor', y: 0, ceiling: 3 }];
  const F0 = floors[0].id;
  const materials: Record<string, MaterialData> = {}; for (const [k, m] of Object.entries(opts.materials ?? {})) materials[k] = { albedo: V(m.albedo), ...(m.rough !== undefined ? { rough: m.rough } : {}), ...(m.metal ? { metal: true } : {}), ...(m.notes ? { notes: m.notes } : {}) };
  const matByAlbedo = new Map<string, string>(); for (const [k, m] of Object.entries(materials)) { const key = m.albedo.join(','); if (!matByAlbedo.has(key)) matByAlbedo.set(key, k); }
  const paint = (albedo: Vec3): { material: string } | { albedo: Vec3 } => { const m = matByAlbedo.get(albedo.join(',')); return m !== undefined ? { material: m } : { albedo: V(albedo) }; };
  /** the finish a box carries beyond what its paint already says: written per box only where it differs from the material's (or, inline, from matte
   *  dielectric) — so loadLevel resolves it back to the same Box, and a palette finish is ONE line in `materials`, not four hundred */
  const finish = (b: { rough?: number; metal?: boolean }, p: { material?: string }): { rough?: number; metal?: boolean } => {
    const m = p.material !== undefined ? materials[p.material] : undefined;
    const out: { rough?: number; metal?: boolean } = {};
    if (b.rough !== m?.rough) out.rough = b.rough ?? ROUGH_DEFAULT;   // (an explicit matte over a finished material: the default written out — loads back as rough 1, the same finish if not the same key)
    if (!!b.metal !== !!m?.metal) out.metal = !!b.metal;
    return out;
  };
  // box ids: supplied → the box's own name → what references it (breaker, a light's fixture, a switchable) → box_NNNN
  const n = level.boxes.length; const ids: string[] = new Array(n);
  const semantic = new Map<number, string>();
  semantic.set(level.breaker.boxes[0], 'breaker_panel'); semantic.set(level.breaker.boxes[1], 'breaker_led');
  for (const l of level.lights) if (l.fixtureBox !== undefined && !semantic.has(l.fixtureBox)) semantic.set(l.fixtureBox, `fix_${l.name}`);
  for (const s of level.switchables) s.boxes.forEach((bi, k) => { if (!semantic.has(bi)) semantic.set(bi, s.boxes.length === 1 ? `sw_${s.name}` : `sw_${s.name}_${k}`); });
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let id = opts.boxIds?.[i] ?? level.boxes[i].name ?? semantic.get(i) ?? `box_${String(i).padStart(4, '0')}`;
    if (used.has(id)) { let k = 2; while (used.has(`${id}_${k}`)) k++; id = `${id}_${k}`; }
    used.add(id); ids[i] = id;
  }
  // bits the runtime derives and may have OR'd into a Level it was handed (game.ts sets AreaLit on lit fixtures; Emissive / Rot / Dynamic live in the GPU word
  // or on prop boxes) are not authored data: masked here so 'export the level the game is running' works off game.level too. Anything else unknown still throws.
  const DERIVED = BoxFlag.AreaLit | BoxFlag.Emissive | BoxFlag.Rot | BoxFlag.Dynamic | BoxFlag.Thin | BoxFlag.Bar;
  const boxes: BoxData[] = level.boxes.map((b, i) => {
    if (b.owner) throw new Error(`box ${i}: owner ${b.owner} — level boxes belong to the world`);
    const pt = paint(b.albedo);
    const d: BoxData = { id: ids[i], floor: F0, ...(opts.boxGroups?.[i] ? { group: opts.boxGroups[i] } : {}), ...(b.name !== undefined ? { name: b.name } : {}), c: V(b.c), h: V(b.h), ...(b.yaw !== 0 ? { yaw: b.yaw } : {}), ...(b.rot ? { rot: [b.rot[0], b.rot[1], b.rot[2], b.rot[3]] } : {}), ...pt, ...finish(b, pt as { material?: string }) };
    if (b.emissive[0] !== 0 || b.emissive[1] !== 0 || b.emissive[2] !== 0) d.emissive = V(b.emissive);
    const flags = bitsToFlags(b.flags & ~DERIVED); if (flags.length) d.flags = flags;
    if (b.cutHeight !== 1e6) d.cutHeight = b.cutHeight;
    const marks = copyMarkings(b.marks); if (marks) d.markings = marks;
    return d;
  });
  const props: PropData[] = level.props.map(p => {
    const parts = p.parts.map(q => { const marks = copyMarkings(q.marks); return { off: V(q.off), h: V(q.h), ...(q.yaw !== 0 ? { yaw: q.yaw } : {}), ...paint(q.albedo), ...(marks ? { markings: marks } : {}) }; });
    const d: PropData = { id: p.name, kind: p.kind, x: p.x, z: p.z, ...(p.yaw !== 0 ? { yaw: p.yaw } : {}), mass: p.mass, parts };
    const fit = fitPropFootprint(p.parts);   // pin the footprint only where the fit would not give the authored numbers back bit for bit (plants override theirs)
    if (fit.half[0] !== p.half[0] || fit.half[1] !== p.half[1]) d.half = [p.half[0], p.half[1]];
    if (fit.height !== p.height) d.height = p.height;
    return d;
  });
  const lightData = (l: LightDef): LightData => {
    const d: LightData = { id: l.name, kind: l.kind, pos: V(l.pos), dir: V(l.dir), color: V(l.color), intensity: l.intensity, range: l.range, innerDeg: l.innerDeg, outerDeg: l.outerDeg, group: l.group, enabled: l.enabled, volumetric: l.volumetric };
    if (l.radius !== undefined) d.radius = l.radius; if (l.mains !== undefined) d.mains = l.mains; if (l.broad !== undefined) d.broad = l.broad;
    if (l.fixtureBox !== undefined) d.fixture = ids[l.fixtureBox];
    return d;
  };
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const uniqIds = (base: string[]) => { const seen = new Set<string>(); return base.map(id => { let out = id || 'x'; if (seen.has(out)) { let k = 2; while (seen.has(`${out}_${k}`)) k++; out = `${out}_${k}`; } seen.add(out); return out; }); };
  const planIds = uniqIds((level.clearPlans ?? []).map(p => `clear_${slug(p.door)}`));
  const planData = <T extends RoomClearPlan>(p: T, id: string) => ({ id, ...clone(p) });
  const M = level.mission;
  const data: LevelData = {
    version: LEVEL_DATA_VERSION,
    name: opts.name,
    meta: clone(opts.meta ?? {}),
    floors,
    materials,
    ...(opts.surfaces ? { surfaces: clone(opts.surfaces) } : {}),
    boxes, props,
    lights: level.lights.map(lightData),
    switchables: level.switchables.map(s => ({ id: s.name, boxes: s.boxes.map(bi => ids[bi]), group: s.group, on: s.on, baseEmissive: V(s.baseEmissive), ...(s.flicker !== undefined ? { flicker: s.flicker } : {}), ...(s.mains !== undefined ? { mains: s.mains } : {}) })),
    doors: level.doors.map(o => { const d: LevelData['doors'][number] = { id: o.name, hinge: [o.hinge[0], o.hinge[1]], closedDir: o.closedDir, width: o.width }; for (const k of ['angle', 'exterior', 'closer', 'minAngle', 'maxAngle', 'locked', 'lock', 'keySide', 'steel', 'swing'] as const) if (o[k] !== undefined) (d as any)[k] = o[k]; return d; }),
    routes: uniqIds(level.routes.map(r => slug(r.name))).map((id, i) => { const r = level.routes[i]; return { id, ...(r.name !== id ? { name: r.name } : {}), points: VV(r.points), wait: [...r.wait], ...(r.weapon !== undefined ? { weapon: r.weapon } : {}), ...(r.keys !== undefined ? { keys: [...r.keys] } : {}) }; }),
    chokepoints: uniqIds((level.chokepoints ?? []).map(c => slug(c.name))).map((id, i) => { const c = level.chokepoints![i]; return { id, ...(c.name !== id ? { name: c.name } : {}), pos: V(c.pos), yaw: c.yaw }; }),
    ...(level.civilians ? { civilians: uniqIds(level.civilians.map(c => slug(c.name))).map((id, i): CivilianData => { const c = level.civilians![i]; return { id, ...(c.name !== id ? { name: c.name } : {}), kind: c.kind, tint: V(c.tint), ...(c.tint2 !== undefined ? { tint2: V(c.tint2) } : {}), points: VV(c.points), wait: [...c.wait], ...(c.tasks !== undefined ? { tasks: [...c.tasks] } : {}), ...(c.face !== undefined ? { face: [...c.face] } : {}) }; }) } : {}),
    volumes: level.volumes ? level.volumes.map((v): LevelData['volumes'][number] => ({ id: v.name, kind: v.kind, c: V(v.c), h: V(v.h), ...(v.yaw !== undefined ? { yaw: v.yaw } : {}) })) : clone(opts.volumes ?? []), devices: (level.devices ?? []).map(deviceData),   // (a Level that carried volumes writes them back; one without keeps the pass-through)
    ...(level.vents ? { vents: level.vents.map((d): VentData => { const v: VentData = { id: d.name, pos: V(d.pos), dir: V(d.dir), speed: d.speed, spread: d.spread, reach: d.reach }; for (const k of ['size', 'period', 'duty', 'phase', 'mains'] as const) if (d[k] !== undefined) (v as any)[k] = d[k]; return v; }) } : {}),
    connectors: clone(opts.connectors ?? []),
    mission: { playerSpawn: V(level.playerSpawn), objectives: [
      { id: 'reach_room', kind: 'reach', area: { x0: M.serverRoom.x0, x1: M.serverRoom.x1, z0: M.serverRoom.z0, z1: M.serverRoom.z1 }, door: M.entryDoor },
      { id: 'pull_drive', kind: 'drive', rackIndex: M.rack.index, front: V(M.rack.front), halfW: M.rack.halfW },
      { id: 'exfil', kind: 'exfil', door: M.exfilDoor, x: M.exfilX, z: M.exfilZ, ...(M.exfilOut ? { out: [M.exfilOut[0], M.exfilOut[1]] as [number, number] } : {}) },
    ] },
    breaker: { pos: V(level.breaker.pos), panel: ids[level.breaker.boxes[0]], led: ids[level.breaker.boxes[1]], ...(level.breaker.fumble !== undefined ? { fumble: level.breaker.fumble } : {}) },
    beacons: level.beacons.map((b, i) => ({ id: `beacon${i}`, pos: V(b.pos), box: ids[b.box] })),
    sky: { zenith: V(level.sky.zenith), horizon: V(level.sky.horizon) },
    ...(level.daylight ? { daylight: { sun: lightData(level.daylight.sun), sky: { zenith: V(level.daylight.sky.zenith), horizon: V(level.daylight.sky.horizon) }, groupsOn: [...level.daylight.groupsOn], groupsOff: [...level.daylight.groupsOff], lightsOff: [...level.daylight.lightsOff], haze: level.daylight.haze, exposure: level.daylight.exposure } } : {}),
    plans: { roomClear: (level.clearPlans ?? []).map((p, i) => planData(p, planIds[i]) as RoomClearPlanData), ...(level.breach ? { breach: planData(level.breach, `breach_${slug(level.breach.door)}`) as BreachPlanData } : {}) },
    ...(level.scenarios && Object.prototype.propertyIsEnumerable.call(level, 'scenarios') ? { scenarios: clone(level.scenarios) } : {}),   // (the level's OWN block only: the office's is attached beside its file, non-enumerable — scene/level.ts withScenarios)
  };
  return data;
}
