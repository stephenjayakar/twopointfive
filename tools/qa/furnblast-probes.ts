// The 'furnblast' probe family — FURNITURE UNDER A BLAST (src/game/furnblast.ts, behind the destruction switch and its own knob FURNBLAST.on), run through probes.ts:
//   bun run tools/qa/probes.ts furnblast | furnblast-throw | furnblast-break | furnblast-stun | furnblast-reset | furnblast-off | furnblast-levels | furnblast-save [--verbose]
// Headless = the Proxy device; what is asserted is every CPU-side promise, on the warehouse's office (the wall entry the maintainer watched) unless said:
//   (throw)   a wall charge on the office wall: the chair behind the hole it opens is thrown AWAY from it; the same strength of blast against the wall where it
//             HOLDS (no hole) moves nothing behind it and breaks nothing behind it — while the chairs on its own side go;
//   (break)   the desk a metre from the charge is gone for sight (rays through where it stood), for feet (the nav cells under it) and for the AI's feed (a row),
//             its pieces exist inside the per-blast budget and the pool's cap, what stood on it went with it, the cabinets further in lie on their sides;
//   (stun)    a stun grenade of its own breaks and throws nothing; a charge's BORROWED bang (the door charge's road) does; the wall charge's own borrowed bang, on
//             the frame of its blast, is merged with it;
//   (reset)   restartEncounter puts every static's flags, every prop and the nav grid back, and the same blast again gives the same pieces (deterministic);
//   (off)     the knob off, chaos 0 or the tour: the same charge leaves all of it standing and counts nothing;
//   (save)    a checkpoint keeps what a blast broke: after a load the same statics are gone for sight and feet, the props that came apart stay out, no piece is
//             on the floor (none is filed); a file from before the slice loads as it did (the furniture whole); nothing broke = no slice; with cut pieces on too;
//   (levels)  on every loud level, a wall-strength blast beside each of up to 8 pieces of furniture: nothing NaN, the pool inside its cap, a restart restores.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const F = await import(`${ROOT}/src/game/furnblast.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { NOBODY_ID, PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { LOUD_LEVELS } = await import(`${ROOT}/tools/levels/dress.ts`);
const { canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { cutConfig } = await import(`${ROOT}/src/scene/cut.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
async function quiet<T>(fn: () => Promise<T> | T): Promise<T> { if (VERBOSE) return await fn(); const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } }
const resetStats = () => { for (const k of Object.keys(F.FURN_STATS)) (F.FURN_STATS as any)[k] = 0; F.FURN_LOG.length = 0; };

/** the warehouse's office: the wall between the corridor and it runs along z = 17; the charge goes on its corridor face */
const OFFICE = { file: 'warehouse.json', charge: [8.0, 0.9, 16.9] as Vec3, desk: [8.2, 18.2] as [number, number], chair: [8.2, 19.1] as [number, number], cabinets: [9.55, 20.2] as [number, number] };
/** …and the same wall further west, where the test blast is NOT let through (furn.blast alone: no wall is opened) */
interface Stage { W: any; game: any }
/** `asStands` = the level as the stand has it (furnblast-levels: every level with its lived-in furniture where the stand raises it). Every other probe here is
 *  staged BY HAND on the warehouse's office — a charge, a desk, a chair and two cabinets at marks measured in the room as its generator drew it — so it stands
 *  that room without the lived-in furniture (`lived: false`; the frozen stand's room exactly): with it the marks are among other pieces, the blast's first group
 *  is another one, and three of them (throw / reset / save) read red on the shipped stand for the staging alone */
async function stage(file = OFFICE.file, opts: { on?: boolean; knob?: boolean; chaos?: number; seed?: number; asStands?: boolean } = {}): Promise<Stage> {
  Math.random = seeded(opts.seed ?? 4401); DESTRUCTION.on = opts.on ?? true; FURNBLAST.on = opts.knob ?? true; resetStats();
  const W: any = await quiet(() => standUp({ uploadEvery: 1, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')), opts.asStands ? {} : { lived: false }) })); const game = W.game;
  game.tune.chaos = opts.chaos ?? 0.5; game.godMode = true; game.aiEnabled = false; game.playerInvisible = true;
  for (let f = 0; f < 5; f++) W.step(DT);
  return { W, game };
}
const run = (S: Stage, n: number) => { for (let f = 0; f < n; f++) S.W.step(DT); };
const wallCharge = (S: Stage, at: Vec3) => S.game.destr.blast(at, { who: PLAYER_ID, chaos: false });
const groupAt = (game: any, [x, z]: [number, number]) => game.destr.furn.inventory().list.find((G: any) => x >= G.a.x0 - 0.05 && x <= G.a.x1 + 0.05 && z >= G.a.z0 - 0.05 && z <= G.a.z1 + 0.05);
const propAt = (game: any, [x, z]: [number, number]) => game.props.all.reduce((b: any, p: any) => Math.hypot(p.home[0] - x, p.home[1] - z) < Math.hypot(b.home[0] - x, b.home[1] - z) ? p : b);
const standing = (game: any, i: number) => !(game.col.boxes[i].flags & BoxFlag.NoPrimary);
const flagsOf = (game: any) => game.col.boxes.map((b: any) => b.flags).join(',');
const posesOf = (game: any) => game.props.props.map((p: any) => `${p.id}:${p.x.toFixed(4)},${p.z.toFixed(4)},${p.yaw.toFixed(4)}`).join(' ');
const navOf = (game: any) => { let h = 0; const b = game.col.nav.blocked; for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) | 0; return h; };
const finite = (game: any) => game.destr.debris.list.every((c: any) => [...c.box.c, ...c.v, ...c.w].every(Number.isFinite)) && game.props.props.every((p: any) => [p.x, p.z, p.yaw, p.vx, p.vz, p.w].every(Number.isFinite));

/** A wall charge throws the chair behind the hole; a blast against the wall where it holds touches nothing behind it. */
export async function furnThrow(): Promise<boolean> {
  const Fm = family('furnblast-throw: pushable furniture goes away from the blast — a wall that held shields what is behind it');
  { const S = await stage(); const g = S.game; const chair = propAt(g, OFFICE.chair); const x0 = chair.x, z0 = chair.z, yaw0 = chair.yaw;
    const res = wallCharge(S, OFFICE.charge); run(S, 240);
    const dx = chair.x - x0, dz = chair.z - z0; const ax = x0 - OFFICE.charge[0], az = z0 - OFFICE.charge[2]; const al = Math.hypot(ax, az); const away = (dx * ax + dz * az) / al;
    Fm.verdict(res.walls >= 1 && away > 0.8 && g.props.props.includes(chair), 'the chair behind the blown wall is thrown away from the charge', `wall holed ${res.walls} (${res.opened} nav cells) · ${chair.def.name} ${f2(al)} m from the charge moved ${f2(Math.hypot(dx, dz))} m (${f2(away)} m along the line away), turned ${f2(chair.yaw - yaw0)} rad · thrown ${F.FURN_STATS.propsThrown}`);
    Fm.verdict(finite(g), 'nothing NaN', `${g.destr.debris.list.length} chunks, ${g.props.props.length} props`); }
  { const S = await stage(); const g = S.game; const chair = propAt(g, OFFICE.chair); const desk = groupAt(g, OFFICE.desk); const before = posesOf(g); const flags = flagsOf(g);
    const near = g.props.props.filter((p: any) => p.z < 16.8 && Math.hypot(p.x - OFFICE.charge[0], p.z - OFFICE.charge[2]) < F.FURN.throwM - 0.3).map((p: any) => ({ p, x: p.x, z: p.z }));
    g.destr.furn.blast(OFFICE.charge, 'wall', PLAYER_ID, 0.5); run(S, 240);   // the furniture's half alone: the wall is never opened
    const moved = near.filter((n: any) => Math.hypot(n.p.x - n.x, n.p.z - n.z) > 0.03).length;
    Fm.verdict(Math.hypot(chair.x - chair.home[0], chair.z - chair.home[1]) < 1e-6 && desk.members.every((i: number) => standing(g, i)) && F.FURN_STATS.propsShielded >= 1 && F.FURN_STATS.shielded >= 1, 'the wall holds: the chair and the desk behind it are untouched', `${chair.def.name} moved ${f2(Math.hypot(chair.x - chair.home[0], chair.z - chair.home[1]))} m · desk parts standing ${desk.members.filter((i: number) => standing(g, i)).length}/${desk.members.length} · shielded: ${F.FURN_STATS.shielded} pieces, ${F.FURN_STATS.propsShielded} props`);
    Fm.verdict(near.length === 0 || moved >= 1, 'what stands on the charge\'s own side goes', `${moved} of ${near.length} props on the corridor side moved (poses changed: ${before !== posesOf(g)}; statics changed: ${flags !== flagsOf(g)})`); }
  return Fm.done();
}

/** The desk beside the charge is gone for sight, feet and the feed; its pieces exist under the caps; the cabinets go over. */
export async function furnBreak(): Promise<boolean> {
  const Fm = family('furnblast-break: furniture near the charge breaks apart — one model, inside the caps');
  const S = await stage(); const g = S.game; const desk = groupAt(g, OFFICE.desk), cab = groupAt(g, OFFICE.cabinets); const serial0 = g.destr.walls.serial;
  const solid = desk.members.filter((i: number) => !(g.col.boxes[i].flags & BoxFlag.NoShadow));
  const ray = (i: number) => { const b = g.col.boxes[i]; const ro: Vec3 = [b.c[0], 2.4, b.c[2]]; const h = g.col.raycast(ro, [0, -1, 0], 2.39); return h ? h.index : -1; };
  const hitBefore = solid.filter((i: number) => solid.includes(ray(i))).length;
  const zc = (desk.a.z0 + desk.a.z1) / 2; const across = () => g.col.solidBlocked([desk.a.x0 - 0.2, 0.4, zc], [desk.a.x1 + 0.2, 0.4, zc]);
  const walk = () => g.col.collideCircle([(desk.a.x0 + desk.a.x1) / 2, 0, zc] as Vec3, 0.25, 0.1, 1.7);
  const acrossBefore = across(), walkBefore = walk();
  wallCharge(S, OFFICE.charge);
  const chunks0 = g.destr.debris.list.length, moving0 = g.destr.debris.moving;
  const hitAfter = solid.filter((i: number) => solid.includes(ray(i))).length;
  const gone = desk.members.filter((i: number) => !standing(g, i)).length;
  Fm.verdict(gone === desk.members.length, 'the desk a metre from the charge is gone — and what stood on it with it', `${gone} of ${desk.members.length} statics of it down (panels razed ${F.FURN_STATS.razed}, things on it ${F.FURN_STATS.items}, others ${F.FURN_STATS.statics})`);
  Fm.verdict(hitBefore > 0 && hitAfter === 0, 'gone for sight and rounds: rays down through where it stood find none of it', `down-rays that met the desk: ${hitBefore} before, ${hitAfter} after`);
  Fm.verdict(acrossBefore && !across() && walkBefore && !walk(), 'gone for feet and cover: a line at knee height across it met its panels, and now is clear', `solid across it at 0.4 m: ${acrossBefore} before, ${across()} after· a man's circle at its middle collides: ${walkBefore} before, ${walk()} after`);
  const rows = g.destr.walls.since(serial0) ?? []; const mine = rows.filter((r: any) => r.kind === 'cover' && r.cause === 'blast' && desk.members.includes(r.id));
  Fm.verdict(mine.length >= 1, 'the AI is told: rows in the level change feed', `${mine.length} cover rows for the desk (${rows.length} rows from this blast in all)`);
  Fm.verdict(F.FURN_STATS.chunks > 0 && F.FURN_STATS.chunks + F.FURN_STATS.demoted <= F.FURN.chunksPerBlast && chunks0 <= g.destr.debris.cap() && moving0 > 0, 'its pieces exist, inside the per-blast budget and the pool\'s cap', `${F.FURN_STATS.chunks} chunks of its own (+${F.FURN_STATS.demoted} as chips; budget ${F.FURN.chunksPerBlast}) · pool ${chunks0}/${g.destr.debris.cap()} with the wall's own`);
  let heard = 0; for (let f = 0; f < 300; f++) { const n0 = g.events.length; S.W.step(DT); heard += g.events.slice(n0).filter((e: any) => e.kind === 'prop').length; }
  const big = g.destr.debris.list.filter((c: any) => c.box.h[0] * c.box.h[1] * c.box.h[2] * 8 > 0.2);
  Fm.verdict(g.destr.debris.moving === 0 && g.destr.debris.list.length > 0 && heard > 0, 'the pieces land, are heard and stay', `${g.destr.debris.list.length} at rest after 5 s, ${g.destr.debris.moving} moving · 'prop' hearing events filed as they landed: ${heard}`);
  Fm.verdict(!!cab && cab.members.every((i: number) => !standing(g, i)) && big.length >= 1 && big.every((c: any) => c.box.c[1] < 0.45), 'the cabinets further in go over and lie on their sides', `${big.length} big pieces at heights ${big.map((c: any) => f2(c.box.c[1])).join(', ')} m (standing they were 0.66)`);
  Fm.verdict(finite(g), 'nothing NaN', F.FURN_LOG.join(' | '));
  return Fm.done();
}

/** A stun grenade does none of it; a charge's borrowed bang does; the wall charge's own is merged. */
export async function furnStun(): Promise<boolean> {
  const Fm = family('furnblast-stun: a stun grenade throws and breaks nothing — a charge\'s borrowed bang does');
  const inside: Vec3 = [8.2, 0.5, 19.7];   // on the office floor between the desk and the cabinets
  const bang = (S: Stage, at: Vec3, borrowed: boolean) => { const it = S.game.items.spawn('flash', at, [0, 0, 0], { fuse: 9, heading: 0, who: NOBODY_ID }); it.fired = true; detonateStun(S.game, it, borrowed); };
  { const S = await stage(); const g = S.game; const poses = posesOf(g); const grp = g.destr.furn.inventory().list;
    bang(S, inside, false); run(S, 120);
    const broke = grp.reduce((n: number, G: any) => n + G.members.filter((i: number) => g.destr.furn.broken(i)).length, 0);
    Fm.verdict(F.FURN_STATS.blasts === 0 && broke === 0 && posesOf(g) === poses && g.props.props.length === g.props.all.length, 'a stun grenade in the middle of the office: no furniture thrown, none broken', `furniture blasts ${F.FURN_STATS.blasts} · statics this module broke ${broke} · prop poses unchanged ${posesOf(g) === poses}`); }
  { const S = await stage(); const g = S.game; const chair = propAt(g, OFFICE.chair);
    bang(S, inside, true); run(S, 120);
    Fm.verdict(F.FURN_STATS.blasts === 1 && (F.FURN_STATS.propsThrown + F.FURN_STATS.propsBroken) >= 1 && F.FURN_STATS.groups >= 1, 'the same canister as a CHARGE\'s borrowed bang (the door charge\'s road): the furniture round it goes', `blasts ${F.FURN_STATS.blasts} · pieces of furniture broken ${F.FURN_STATS.groups} · props thrown ${F.FURN_STATS.propsThrown}, broken ${F.FURN_STATS.propsBroken} (${chair.def.name} ${g.props.props.includes(chair) ? 'moved ' + f2(Math.hypot(chair.x - chair.home[0], chair.z - chair.home[1])) + ' m' : 'came apart'})`); }
  { const S = await stage(); wallCharge(S, OFFICE.charge); const s1 = { ...F.FURN_STATS }; bang(S, [OFFICE.charge[0], 0.5, OFFICE.charge[2] + 0.09], true);
    Fm.verdict(F.FURN_STATS.merged === 1 && F.FURN_STATS.blasts === 1 && F.FURN_STATS.chunks === s1.chunks && F.FURN_STATS.propsThrown === s1.propsThrown, 'the wall charge\'s own borrowed bang, on the frame of its blast, is the same blast', `blasts ${F.FURN_STATS.blasts}, merged ${F.FURN_STATS.merged}; chunks ${s1.chunks} → ${F.FURN_STATS.chunks}, props thrown ${s1.propsThrown} → ${F.FURN_STATS.propsThrown}`); }
  return Fm.done();
}

/** A restart restores everything; the same blast again is the same blast. */
export async function furnReset(): Promise<boolean> {
  const Fm = family('furnblast-reset: a restart puts the furniture back — and the same blast breaks it the same way');
  const S = await stage(); const g = S.game; const flags = flagsOf(g), poses = posesOf(g), nav = navOf(g);
  const chunkSig = () => g.destr.debris.list.map((c: any) => `${c.box.c.map((x: number) => x.toFixed(4)).join(',')}|${c.box.h.map((x: number) => x.toFixed(4)).join(',')}|${c.v.map((x: number) => x.toFixed(4)).join(',')}`).join(' ');
  g.destr.furn.blast([8.2, 0.5, 19.0], 'wall', PLAYER_ID, 0.5);   // on the office floor: the chair beside it comes apart, the desk shatters
  const sigA = chunkSig(), statsA = JSON.stringify(F.FURN_STATS); const broken = F.FURN_STATS.propsBroken, hid = flags !== flagsOf(g);
  run(S, 120);
  Fm.verdict(broken >= 1 && g.props.props.length === g.props.all.length - broken && hid, 'staged: a blast on the office floor breaks a prop apart and furniture with it', `props broken ${broken} (list ${g.props.props.length} of ${g.props.all.length}), statics hidden ${hid}, chunks ${F.FURN_STATS.chunks}`);
  await quiet(() => g.restartEncounter()); run(S, 5);
  Fm.verdict(flagsOf(g) === flags && posesOf(g) === poses && navOf(g) === nav && g.destr.debris.list.length === 0 && g.props.props.length === g.props.all.length, 'restartEncounter: every static\'s flags, every prop (pose and presence) and the nav grid as they were, no debris', `flags ${flagsOf(g) === flags} · props ${posesOf(g) === poses} (${g.props.props.length}) · nav ${navOf(g) === nav} · debris ${g.destr.debris.list.length}`);
  resetStats(); g.destr.furn.blast([8.2, 0.5, 19.0], 'wall', PLAYER_ID, 0.5);
  Fm.verdict(chunkSig() === sigA && JSON.stringify(F.FURN_STATS) === statsA, 'the same blast after the restart: the same pieces, piece for piece (its own counter, no Math.random)', `counts equal ${JSON.stringify(F.FURN_STATS) === statsA} · ${g.destr.debris.list.length} chunks' place / size / speed equal ${chunkSig() === sigA}`);
  await quiet(() => g.restartEncounter()); run(S, 5);
  { Math.random = seeded(1234); g.destr.furn.blast([8.2, 0.5, 19.0], 'wall', PLAYER_ID, 0.5); const next = Math.random(), want = seeded(1234)();
    Fm.verdict(next === want, 'a blast draws nothing from Math.random', `the next Math.random after a blast is the seeded stream's first value: ${next === want}`); }
  { // the index is made at the first blast — by the level as AUTHORED, whatever rounds or that blast's own wall work have already taken
    await quiet(() => g.restartEncounter()); run(S, 5); const pristine = g.destr.furn.inventory(); const sig = (inv: any) => inv.list.map((G: any) => `${G.id}:${G.members.join(',')}`).join(' ');
    const panel = pristine.list.flatMap((G: any) => G.members).find((i: number) => g.destr.walls.breakableAt(i)?.kind === 'cover');
    const S2 = await stage(); const g2 = S2.game; const razed = panel !== undefined && !!g2.destr.walls.raze(panel, PLAYER_ID, [1, 0, 0]);
    const late = g2.destr.furn.inventory();
    Fm.verdict(razed && sig(late) === sig(pristine), 'indexed after a panel was already shot away: the same furniture as on the untouched level', `panel ${panel} razed first ${razed} · ${late.groups} groups / ${late.members} statics against ${pristine.groups} / ${pristine.members}`); }
  return Fm.done();
}

/** The knob off, chaos 0, the tour: nothing. */
export async function furnOff(): Promise<boolean> {
  const Fm = family('furnblast-off: knob off, chaos 0 or the tour — the same charge leaves the furniture standing');
  const one = async (label: string, opts: Parameters<typeof stage>[1], pre?: (g: any) => void) => {
    const S = await stage(OFFICE.file, opts); const g = S.game; pre?.(g); const desk = groupAt(g, OFFICE.desk); const poses = posesOf(g);
    wallCharge(S, OFFICE.charge); const it = g.items.spawn('flash', [8.2, 0.5, 19.7], [0, 0, 0], { fuse: 9, heading: 0, who: NOBODY_ID }); it.fired = true; detonateStun(g, it, true); run(S, 60);
    const up = desk.members.filter((i: number) => standing(g, i)).length; const zero = Object.values(F.FURN_STATS).every(v => v === 0);
    const broke = desk.members.filter((i: number) => g.destr.furn.broken(i)).length;
    return { ok: zero && broke === 0 && posesOf(g) === poses, detail: `${label}: counts all zero ${zero} · desk statics this module broke ${broke} (standing ${up}/${desk.members.length}) · props unmoved ${posesOf(g) === poses}` };
  };
  const a = await one('knob off (the page\'s ?nofurnblast)', { knob: false }); Fm.verdict(a.ok, 'FURNBLAST.on false: a wall charge and a borrowed bang count nothing', a.detail);
  const b = await one('chaos 0', { chaos: 0 }); Fm.verdict(b.ok, 'chaos 0', b.detail);
  const c = await one('destruction switch off', { on: false }); Fm.verdict(c.ok, 'THE ONE SWITCH off', c.detail);
  const d = await one('touring', {}, g => { g.touring = true; }); Fm.verdict(d.ok, 'under the tour', d.detail);
  FURNBLAST.on = true;
  return Fm.done();
}

/** Every loud level: blasts beside its furniture stay finite and inside the pool; a restart restores. */
export async function furnLevels(): Promise<boolean> {
  const Fm = family('furnblast-levels: every loud level — blasts beside its furniture stay bounded, a restart restores');
  for (const L of LOUD_LEVELS as { file: string }[]) {
    const S = await stage(L.file, { asStands: true }); const g = S.game; const flags = flagsOf(g), poses = posesOf(g), nav = navOf(g); const inv = g.destr.furn.inventory();
    let peak = 0, ok = true; const n = Math.min(8, inv.list.length);
    for (let k = 0; k < n; k++) { const G = inv.list[Math.floor(k * inv.list.length / n)]; g.destr.furn.blast([G.a.x0 - 0.5, 0.5, (G.a.z0 + G.a.z1) / 2], 'wall', PLAYER_ID, 0.5); run(S, 45); peak = Math.max(peak, g.destr.debris.list.length); ok &&= finite(g) && g.destr.debris.list.length <= g.destr.debris.cap(); }
    const st = { ...F.FURN_STATS }; run(S, 240); const moving = g.destr.debris.moving;
    await quiet(() => g.restartEncounter()); run(S, 5);
    const back = flagsOf(g) === flags && posesOf(g) === poses && navOf(g) === nav && g.props.props.length === g.props.all.length;
    Fm.verdict(ok && back && inv.groups > 0 && st.groups > 0 && moving === 0, `${L.file}: ${inv.groups} pieces of furniture (${inv.members} statics), ${g.props.all.length} props`, `${n} blasts: ${st.groups} pieces broken (${st.statics} statics, ${st.razed} panels, ${st.items} things on them), props ${st.propsThrown} thrown / ${st.propsBroken} broken, chunks ${st.chunks} (+${st.demoted} chips, ${st.left} left standing for want of budget) · pool peak ${peak}/${g.destr.debris.cap()} · all at rest after 4 s ${moving === 0} · restart restores ${back}`);
  }
  return Fm.done();
}

/** A checkpoint keeps what a blast broke (savestate.ts `furn` ← furnblast.ts snapshot / check / restore). */
export async function furnSave(): Promise<boolean> {
  const Fm = family('furnblast-save: a checkpoint load keeps broken furniture broken — and a file from before the slice loads as it did');
  const cut0 = cutConfig.on;
  const authored = (g: any) => { const n = g.destr.walls.authored; return g.col.boxes.slice(0, n).map((b: any) => b.flags).join(','); };
  const outProps = (g: any) => g.props.all.filter((p: any) => !g.props.props.includes(p)).map((p: any) => p.id).join(',');
  const seen = (g: any, [x, z]: [number, number]) => !g.col.segmentBlocked([x - 0.6, 0.45, z], [x + 0.6, 0.45, z]);   // a low line through where the desk stood
  try {
    for (const cut of [false, true]) {
      cutConfig.on = cut; const tag = cut ? 'cut pieces ON' : 'cut pieces off';
      // (1) the wall charge on the office wall, then a blast beside the chair so a prop comes apart too; save; load into the same game
      const S = await stage(); const g = S.game; const desk = groupAt(g, OFFICE.desk); const chair = propAt(g, OFFICE.chair);
      const whole = authored(g), nav0 = navOf(g);
      wallCharge(S, OFFICE.charge); run(S, 240); g.destr.furn.blast([chair.x - 0.25, 0.5, chair.z], 'wall', PLAYER_ID, 0.5); run(S, 300);
      const st = { ...F.FURN_STATS }; const flags = authored(g), nav = navOf(g), out = outProps(g), pieces = g.destr.debris.list.length;
      const deskDown = desk.members.filter((i: number) => !standing(g, i)).length;
      const file = JSON.parse(JSON.stringify(S.W.snapshot('furn')));
      Fm.verdict(!!file.furn && file.furn.s.length > 0 && file.furn.p.length === st.propsBroken && st.propsBroken >= 1 && deskDown > 0 && !!file.walls, `${tag}: the file carries what went`, `furn slice: ${file.furn?.s.length} statics, props [${file.furn?.p}] (${st.propsBroken} came apart) · desk parts down ${deskDown}/${desk.members.length} · walls slice ${!!file.walls} · ${pieces} pieces on the floor (not filed) · canLoad ${canLoad(g, file) ?? 'yes'}`);
      await quiet(() => S.W.restore(file)); run(S, 5);
      const same = authored(g) === flags, navSame = navOf(g) === nav;
      Fm.verdict(same && navSame && outProps(g) === out && seen(g, OFFICE.desk) && g.destr.debris.list.length === 0, `${tag}: after the load the same furniture is gone — for sight, for feet, and the prop stays out`, `authored statics' flags as at the save ${same} (as authored ${authored(g) === whole}) · nav as at the save ${navSame} (as authored ${navOf(g) === nav0}) · props out [${outProps(g)}] against [${out}] · line through the desk clear ${seen(g, OFFICE.desk)} · pieces on the floor ${g.destr.debris.list.length}`);
      const again = JSON.parse(JSON.stringify(S.W.snapshot('furn2')));
      Fm.verdict(JSON.stringify(again.furn) === JSON.stringify(file.furn) && JSON.stringify(again.walls) === JSON.stringify(file.walls), `${tag}: saved again after the load = the same slice`, `furn ${JSON.stringify(again.furn) === JSON.stringify(file.furn)} · walls ${JSON.stringify(again.walls) === JSON.stringify(file.walls)}`);
      // (2) a restart after the load puts all of it back
      await quiet(() => g.restartEncounter()); run(S, 5);
      Fm.verdict(authored(g) === whole && navOf(g) === nav0 && outProps(g) === '' && S.W.snapshot('whole').furn === undefined, `${tag}: a restart after the load restores the level, and then there is no slice`, `flags as authored ${authored(g) === whole} · nav ${navOf(g) === nav0} · props out [${outProps(g)}]`);
      // (3) the same file into a FRESH game
      const S2 = await stage(); const g2 = S2.game; await quiet(() => S2.W.restore(file)); run(S2, 5);
      Fm.verdict(authored(g2) === flags && navOf(g2) === nav && outProps(g2) === out, `${tag}: the file loaded into a fresh game gives the same level`, `flags ${authored(g2) === flags} · nav ${navOf(g2) === nav} · props out [${outProps(g2)}]`);
      // (4) a file from before the slice: the walls' holes, the furniture whole — exactly what such a file gave before
      const old = JSON.parse(JSON.stringify(file)); delete old.furn;
      const S3 = await stage(); const g3 = S3.game; const d3 = groupAt(g3, OFFICE.desk); await quiet(() => S3.W.restore(old)); run(S3, 5);
      const brk = d3.members.filter((i: number) => g3.destr.furn.broken(i)).length;
      Fm.verdict(canLoad(g3, old) === null && brk === 0 && outProps(g3) === '' && g3.destr.furn.inventory().hidden === 0, `${tag}: a file with no furniture slice loads as before`, `canLoad ${canLoad(g3, old) ?? 'yes'} · desk statics this module holds broken ${brk} · props out [${outProps(g3)}] · module's hidden ${g3.destr.furn.inventory().hidden}`);
      // (5) a slice that is not this level's is refused
      const bad = JSON.parse(JSON.stringify(file)); bad.furn.s = [9999999]; const bad2 = JSON.parse(JSON.stringify(file)); bad2.furn.p = [9999];
      const mem = new Set<number>(g3.destr.furn.inventory().list.flatMap((G: any) => G.members)); const structural = [...Array(g3.destr.walls.authored).keys()].find(i => !mem.has(i))!;
      const bad3 = JSON.parse(JSON.stringify(file)); bad3.furn.s = [structural];
      Fm.verdict(typeof canLoad(g3, bad) === 'string' && typeof canLoad(g3, bad2) === 'string' && typeof canLoad(g3, bad3) === 'string', `${tag}: a slice naming a static that is not furniture (out of range, or the building's own) or a prop the level does not have is refused`, `${canLoad(g3, bad)} · ${canLoad(g3, bad3)} · ${canLoad(g3, bad2)}`);
    }
    cutConfig.on = cut0;
    // (6) the door charge's road, inside the office: its bang knocks things off the desk BEFORE the furniture under them breaks. After the load nothing that had
    //     gone stands again (a mug back in the air over a desk that stays gone), and the feed's last word is the load's.
    { const S = await stage(); const g = S.game; const desk = groupAt(g, OFFICE.desk);
      const it = g.items.spawn('flash', [8.2, 0.5, 18.95], [0, 0, 0], { fuse: 9, heading: 0, who: NOBODY_ID }); it.fired = true; detonateStun(g, it, true); run(S, 300);
      const flags = authored(g), nav = navOf(g), out = outProps(g); const down = desk.members.filter((i: number) => !standing(g, i)); const items = down.filter((i: number) => g.destr.itemOf(i)).length;
      const file = JSON.parse(JSON.stringify(S.W.snapshot('door')));
      const filed = !!file.furn && down.every((i: number) => file.furn.s.includes(i) || g.destr.walls.breakableAt(i));
      Fm.verdict(filed && down.length > 0 && items > 0, 'a door charge by the desk: every part of the desk that went is in the file (its cover panels in the walls\' slice)', `desk parts down ${down.length}/${desk.members.length} (${items} of them the lane's own things: screens, papers, clutter) · slice ${file.furn?.s.length} statics, props [${file.furn?.p}] · walls slice ${!!file.walls}`);
      await quiet(() => S.W.restore(file)); run(S, 1);
      const rows = g.destr.walls.changes, last = rows[rows.length - 1]; const up = desk.members.filter((i: number) => standing(g, i)).length;
      Fm.verdict(authored(g) === flags && navOf(g) === nav && outProps(g) === out && up === desk.members.length - down.length, 'after the load nothing that had gone stands again', `authored statics' flags as at the save ${authored(g) === flags} · nav ${navOf(g) === nav} · desk parts standing ${up} (at the save ${desk.members.length - down.length}) · props out [${outProps(g)}]`);
      Fm.verdict(!!last && last.kind === 'reset' && last.cause === 'load', "the change feed's last row is the load's", `last row ${last?.kind} / ${last?.cause} of ${rows.length}`); }
    // (7) furniture with no cover panel in it, broken with no wall touched: the furniture's slice ALONE in the file (no walls' slice to lean on for the re-bake or the row)
    { const S = await stage(); const g = S.game; const G = g.destr.furn.inventory().list.find((x: any) => x.members.every((i: number) => !g.destr.walls.breakableAt(i)) && x.members.some((i: number) => !(g.col.boxes[i].flags & BoxFlag.NoShadow)));
      g.destr.furn.blast([G.a.x0 - 0.4, 0.5, (G.a.z0 + G.a.z1) / 2], 'wall', PLAYER_ID, 0.5); run(S, 300);
      const flags = authored(g), nav = navOf(g); const down = G.members.filter((i: number) => !standing(g, i)).length; const file = JSON.parse(JSON.stringify(S.W.snapshot('alone')));
      await quiet(() => S.W.restore(file)); run(S, 1); const rows = g.destr.walls.changes, last = rows[rows.length - 1];
      Fm.verdict(!!file.furn && !file.walls && down > 0 && authored(g) === flags && navOf(g) === nav && last?.kind === 'reset' && last?.cause === 'load', 'the furniture slice alone (no walls\' slice in the file): gone again after the load, nav re-baked, the feed told', `piece ${G.id}: ${down}/${G.members.length} parts down · file: furn ${file.furn?.s.length} statics, walls ${!!file.walls} · flags as at the save ${authored(g) === flags} · nav ${navOf(g) === nav} · last row ${last?.kind} / ${last?.cause}`); }
    // (8) nothing broke: no slice, whatever the switches say
    { const S = await stage(); Fm.verdict(S.W.snapshot('none').furn === undefined && !('furn' in JSON.parse(JSON.stringify(S.W.snapshot('none')))), 'nothing broke: the file has no furniture slice', 'snapshot().furn undefined, no key in the JSON'); }
    { const S = await stage(OFFICE.file, { knob: false }); wallCharge(S, OFFICE.charge); run(S, 120); const f = S.W.snapshot('off'); Fm.verdict(f.furn === undefined && !!f.walls, 'the furniture knob off: a wall charge files its hole and no furniture slice', `furn ${f.furn === undefined ? 'absent' : 'present'} · walls ${!!f.walls}`); FURNBLAST.on = true; }
  } finally { cutConfig.on = cut0; }
  return Fm.done();
}
