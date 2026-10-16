// The 'shield' family (a teammate's ballistic shield — game/shield.ts, the kit card's 'Shield' row), run through probes.ts:
//   bun run tools/qa/probes.ts shield | shield-card | shield-rounds | shield-entry | shield-defenders | shield-identity
// PASS / FAIL each, all headless; nothing here looks at a picture (the plate's boxes are counted and placed, not seen).
//   shield-card       the row as data: teammates have it, you do not; it steps on and off, is kept and read back, a stored card without it or with rubbish in it
//                     is 'none'; a staged man whose card has it carries a pistol whatever his weapon row says, has the carry arm switched on and the plate's
//                     boxes drawn with his owner byte; a restart stages him with it again; SHIELD.on off hands out nothing
//   shield-rounds     the model: lines swept round a standing carrier every 10° at 4 m. In his front arc the chest line stops in the plate before it reaches
//                     him; from the side and behind it reaches him and the plate is not on it; at his shins from the front it reaches him under the plate;
//                     a teammate's line is never stopped. Then real rounds through fireWeapon: five at the chest from the front leave him standing with five
//                     counted in the plate, one from behind drops him, and a dead man's shield stops nothing and lies flat
//   shield-entry      the server room's door on the four, the shield on teammate 1 and on teammate 2, by bang-and-clear, open-and-clear and from the
//                     threshold, and by a plain 'stack up' turned into an entry: the shield man is on the lead's mark, he is the first across the frame line,
//                     he never throws the can; the night breach's F drill puts him at #1
//   shield-defenders  what the other side does: a defender's first rounds at the trunk die in the plate; before SHIELD.learnSecs of that he aims as ever, after
//                     it (two rounds of his, the first that long ago) he aims at the shins when that line is open (and that round drops the man), from the
//                     flank he never changes anything, and a teammate stood behind the plate is no better a man to switch to. Three played runs: no
//                     exception, he led entries (the counts of rounds stopped are the tally's)
//   shield-identity   with nobody carrying one, a seeded run digests the same before and after another game in the same process handed one out, and with the
//                     row switched off (the comparison against the base commit is in rebuild/gear/shield/read-first.md, not here)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const SH = await import(`${ROOT}/src/game/shield.ts`);
const { KIT, KIT_LS } = K;
const { SHIELD, SHIELD_STATS } = SH;
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { fireWeapon, bodyHit, handProps, solidBetween } = await import(`${ROOT}/src/game/combat.ts`);
const { isHostile } = await import(`${ROOT}/src/game/teams.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
type V3 = [number, number, number];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
/** every card back as issued, the table on, nothing kept; the shield's own table as shipped */
const SHIPPED = { ...SHIELD, half: [...SHIELD.half] };
/** every card as issued, on the FREE rows (?noslots: these probes hold the shield itself; what it costs a man's pouches is the 'pouches' family's) */
function issued() { K.kitLoad(null, '?noslots'); K.kitReset(); Object.assign(SHIELD, SHIPPED, { half: [...SHIPPED.half] }); }
function zero() { for (const k of Object.keys(SHIELD_STATS)) (SHIELD_STATS as any)[k] = 0; }
function memStore(seed?: string) { const m = new Map<string, string>(); if (seed !== undefined) m.set(KIT_LS, seed); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }

/** a scenario staged as the page stages it (the kit cards as they stand), with a frame stepper that keeps Sam unseen */
/** `fn` with the row switched off, by hand AND by its word (a stand-up writes the word over a hand: the frozen stand pins the shield in, and the shipped
 *  stand's probes hold it in — probes.ts SHIELD_AS_IT_WAS), both put back after */
async function shieldOff<T>(fn: () => Promise<T>): Promise<T> {
  const word = process.env.TPS_SHIELD, was = SHIELD.on; process.env.TPS_SHIELD = '0'; SHIELD.on = false;
  try { return await fn(); } finally { SHIELD.on = was; if (word === undefined) delete process.env.TPS_SHIELD; else process.env.TPS_SHIELD = word; }
}
async function stageOf(id: string, seed = 0x51c4): Promise<{ W: any; g: any; team: () => any[]; step: (n?: number) => void; until: (p: () => boolean, secs: number) => boolean }> {
  const E = (SCENARIOS as any[]).find(e => e.id === id); if (!E) throw new Error(`no scenario '${id}'`);
  Math.random = seeded(seed);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game; g.godMode = true;
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E)))); if (why) throw new Error(`${id}: start refused — ${why}`);
  const step = (n = 1) => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } } finally { console.log = log; console.error = err; console.warn = warn; } };
  return { W, g, team: () => teamOf(g), step, until: (p, secs) => { for (let i = 0; i < secs * 60 && !p(); i++) step(); return p(); } };
}
const chestOf = (gd: any): V3 => { const t = gd.char.bones.chest ?? gd.char.pos; return [t[0], gd.char.pos[1] + 1.25, t[2]]; };
const shinOf = (gd: any): V3 => { const h = gd.char.bones.hips ?? gd.char.pos; return [h[0], gd.char.pos[1] + SHIELD.lowY, h[2]]; };
const norm = (a: V3, b: V3): { d: V3; L: number } => { const v: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(v[0], v[1], v[2]); return { d: [v[0] / L, v[1] / L, v[2] / L], L }; };
/** the way his plate faces (square to his shoulder line); with no plate up, the way his chest does */
const faceOf = (gd: any): number => { const b = SH.shieldBox(gd); if (b) return b.yaw; const cd = gd.char.chestDir; return Math.atan2(cd[0], cd[2]); };
/** a point `dist` from the carrier at `deg` off his plate's facing (0 = dead ahead, + = round to his left), `y` over his soles */
function around(gd: any, deg: number, dist: number, y: number): V3 {
  const yaw = faceOf(gd) + deg * Math.PI / 180, at = gd.char.bones.chest ?? gd.char.pos;
  return [at[0] + Math.sin(yaw) * dist, gd.char.pos[1] + y, at[2] + Math.cos(yaw) * dist];
}
/** one line from `from` to `to` at the carrier, as fireWeapon reads it: where the body column is met, and whether a plate of a side hostile to `team` is met first */
function line(g: any, gd: any, team: string, from: V3, to: V3): { body: number; stop: boolean; wall: boolean } {
  const { d, L } = norm(from, to), st = g.col.raycast(from, d, L - 0.4);
  const body = bodyHit(gd.char, from, d, 60, false), sh = SH.shieldStop(g, team, from, d, body >= 0 ? body : 60);
  return { body, stop: !!sh && sh.gd === gd, wall: !!st };
}

/** ONE REAL ROUND through fireWeapon from `from` at `to`, fired as the defender `H`'s: his muzzle (and the shoulder behind it — fireWeapon asks whether his arm is
 *  through a panel) put on the line for the call and put back after it; nothing is stepped in between. No spread. */
async function shoot(g: any, H: any, from: V3, to: V3) {
  const c = H.char, m0 = c.muzzle, a0 = c.bones.upperArmR, { d } = norm(from, to);
  c.muzzle = [...from]; c.bones.upperArmR = [from[0] - d[0] * 0.3, from[1], from[2] - d[2] * 0.3];
  try { await quiet(() => fireWeapon(g, c, to, false, { steady: true, spread: 0 })); } finally { c.muzzle = m0; c.bones.upperArmR = a0; }
}

/** the muzzle point `from` of a staged round at `to` is in free air: no panel between it and the shoulder shoot() puts behind it. A point 4 m off the carrier can
 *  lie INSIDE a partition (where the squad is stood is the stand's), and the ray cast from in there toward him meets nothing — but fireWeapon asks first whether
 *  the shooter's arm is through a panel (armThrough) and such a round goes into that panel at the muzzle: it never flies, so it tests nothing of the plate. */
const openAir = (g: any, from: V3, to: V3): boolean => { const { d } = norm(from, to); return !solidBetween(g, [from[0] - d[0] * 0.3, from[1], from[2] - d[2] * 0.3], from); };

// ─────────────────────────────────────────────────────────────── card ───────────────────────────────────────────────────────────────
export async function shieldCard(): Promise<boolean> {
  const F = family('shield-card: the row on a teammate\'s card, and the man it stages');
  issued(); zero();
  try {
    const rows = (i: number) => K.kitRows(i).map((r: any) => r.field);
    F.verdict(!rows(0).includes('shield') && [1, 2, 3, 4].every(i => rows(i).includes('shield')) && KIT.members.every((m: any) => m.shield === false) && [1, 2, 3, 4].every(i => !K.kitChanged(i)),
      'teammates have a Shield row, you do not; nobody is issued one', `you: ${rows(0).join(' ')} · a teammate: ${rows(1).join(' ')}`);
    const row = K.kitRows(1).find((r: any) => r.field === 'shield');
    const v1 = K.kitStep(1, 'shield', 1), w1 = K.kitWords(1), g1 = K.kitGun(KIT.members[1]), n1 = row.note(KIT.members[1]), ch = K.kitChanged(1), v0 = K.kitStep(1, 'shield', 1), w0 = K.kitWords(1), g0 = K.kitGun(KIT.members[1]);
    F.verdict(v1 === true && v0 === false && /shield/.test(w1) && !/shield/.test(w0) && g1 === 'fiveseven' && g0 === 'fn2000' && ch && row.values.length === 2 && row.word(true) === 'ballistic shield' && row.word(false) === 'none',
      'the row steps on and back off; on, his card reads a pistol and "shield", and says what it changes', `on: "${w1}" (${g1}) — ${n1} · off: "${w0}" (${g0})`);
    K.kitSet(2, 'suppressed', false); K.kitSet(2, 'shield', true); const bare = K.kitGun(KIT.members[2]); issued();
    F.verdict(bare === 'guard9mm', 'with the suppressor row off his pistol is the bare 9 mm', bare);
    const st = memStore(); K.kitLoad(st, '?noslots'); K.kitSet(3, 'shield', true); const kept = st.m.get(KIT_LS) ?? ''; K.kitLoad(memStore(kept), '?noslots'); const back = KIT.members[3].shield;
    const old = JSON.parse(kept); for (const m of old.members) delete m.shield; K.kitLoad(memStore(JSON.stringify(old)), '?noslots'); const none = KIT.members.map((m: any) => m.shield);
    old.members[1].shield = 'yes'; old.members[2].shield = 7; K.kitLoad(memStore(JSON.stringify(old)), '?noslots'); const junk = KIT.members.map((m: any) => m.shield);
    F.verdict(back === true && none.every((x: any) => x === false) && junk.every((x: any) => x === false), 'kept and read back; a stored card from before the row, or with rubbish in it, is "none"', `read back ${back} · no field ${none.join(',')} · rubbish ${junk.join(',')}`);

    issued(); K.kitSet(1, 'shield', true);
    const S = await stageOf('room-clear-four'); S.step(30);
    const T = S.team(), C = T[0], boxes: any[] = []; handProps(S.g, boxes);
    const mine = boxes.filter(b => b.owner === (C.char.id & 0xff) && Math.abs(b.h[0] - SHIELD.half[0]) < 1e-9 && Math.abs(b.h[1] - SHIELD.half[1]) < 1e-9), plate = SH.shieldBox(C);
    F.verdict(SH.shieldCarried(C) && SH.plateUp(C) && T.slice(1).every((m: any) => !SH.shieldCarried(m)) && C.weapon.def.cls === 'pistol' && C.char.anim.shield === true && T.slice(1).every((m: any) => m.char.anim.shield === false && m.weapon.def.id === 'fn2000'),
      'the staged man whose card has it carries the shield and a pistol, his carry arm on; the other three are as issued', T.map((m: any) => `${m.callsign}: ${m.weapon.def.id}${SH.shieldCarried(m) ? ' + shield' : ''}`).join(' · '));
    const fy = faceOf(C), cd = [Math.sin(fy), 0, Math.cos(fy)], ahead = plate ? (plate.c[0] - C.char.bones.chest[0]) * cd[0] + (plate.c[2] - C.char.bones.chest[2]) * cd[2] : NaN;
    F.verdict(mine.length === 1 && !!plate && Math.abs(mine[0].c[0] - plate.c[0]) < 1e-9 && Math.abs(mine[0].c[2] - plate.c[2]) < 1e-9 && Math.abs(mine[0].yaw - plate.yaw) < 1e-9 && ahead > 0.25 && ahead < 0.45 && Math.abs(plate.c[1] - plate.h[1] - C.char.pos[1] - SHIELD.bottom) < 0.02,
      'the plate drawn is the plate the round test uses: one box with his owner byte, in front of his chest, its bottom edge half a metre up', `drawn ${mine.length} · ${f2(ahead)} m ahead of the chest · bottom ${f2(plate ? plate.c[1] - plate.h[1] - C.char.pos[1] : NaN)} m · top ${f2(plate ? plate.c[1] + plate.h[1] - C.char.pos[1] : NaN)} m · ${f2(2 * SHIELD.half[0])} × ${f2(2 * SHIELD.half[1])} m`);
    await quiet(() => S.g.restartEncounter()); S.step(10); const T2 = S.team();
    F.verdict(T2[0] !== C && SH.plateUp(T2[0]) && T2[0].weapon.def.cls === 'pistol' && T2.slice(1).every((m: any) => !SH.shieldCarried(m)), 'a restart stages him with it again (a fresh man, the same card)', T2.map((m: any) => `${m.callsign}: ${m.weapon.def.id}${SH.shieldCarried(m) ? ' + shield' : ''}`).join(' · '));
    const S3 = await shieldOff(() => stageOf('room-clear-four')), T3 = S3.team();
    F.verdict(T3.every((m: any) => !SH.shieldCarried(m) && m.weapon.def.id === 'fn2000' && m.char.anim.shield === false), 'the row switched off (SHIELD.on): nobody is handed one and he keeps his rifle', T3.map((m: any) => m.weapon.def.id).join(' '));
  } finally { issued(); }
  return F.done();
}

// ─────────────────────────────────────────────────────────────── rounds ───────────────────────────────────────────────────────────────
export async function shieldRounds(): Promise<boolean> {
  const F = family('shield-rounds: rounds from the front stop in the plate; the side, the back and the shins still drop him');
  issued(); zero();
  try {
    K.kitSet(1, 'shield', true);
    const S = await stageOf('room-clear-four'); S.step(30);
    const g = S.g, C = S.team()[0], H = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    F.verdict(!!H && isHostile(H.team, C.team) && SH.plateUp(C), 'a shield man on the four and a defender whose side is hostile to him', `${C.callsign} (${C.team}) · ${H?.callsign} (${H?.team})`);
    // THE SWEEP: every 10° round him at 4 m from shoulder height, at the chest and at the shins
    const rows: { deg: number; chest: ReturnType<typeof line>; shin: ReturnType<typeof line>; mate: ReturnType<typeof line> }[] = [];
    for (let deg = -180; deg < 180; deg += 10) { const from = around(C, deg, 4, 1.4); rows.push({ deg, chest: line(g, C, 'hostile', from, chestOf(C)), shin: line(g, C, 'hostile', from, shinOf(C)), mate: line(g, C, 'operative', from, chestOf(C)) }); }
    const front = rows.filter(r => Math.abs(r.deg) <= 30), flank = rows.filter(r => Math.abs(r.deg) >= 60);
    const edge = rows.filter(r => r.chest.stop).map(r => r.deg), arc = edge.length ? `${Math.min(...edge)}° to ${Math.max(...edge)}°` : 'none';
    F.verdict(rows.every(r => r.chest.body >= 0) && front.length === 7 && front.every(r => r.chest.stop), 'in his front arc (30° either side) the chest line stops in the plate before it reaches him', `${front.length} lines · stopped at every one · the plate is on the chest line from ${arc}`);
    F.verdict(flank.length === 25 && flank.every(r => !r.chest.stop && r.chest.body >= 0), 'from the side and from behind (60° round and more) the line reaches his body and the plate is not on it', `${flank.length} lines, none stopped · bearings stopped: ${edge.join(' ')}`);
    F.verdict(rows.every(r => r.shin.body >= 0) && front.every(r => !r.shin.stop), 'at his shins from the front the line passes under the plate and reaches him', `${front.length} lines from 4 m, none stopped · bottom edge ${f2(SHIELD.bottom)} m, aimed ${f2(SHIELD.lowY)} m`);
    F.verdict(rows.every(r => !r.mate.stop), 'a teammate\'s line is never stopped by it (his side\'s rounds pass it as they pass him)', `${rows.length} lines`);
    const near = [1, 1.5, 2, 3].map(d => ({ d, r: line(g, C, 'hostile', around(C, 0, d, 1.4), shinOf(C)) }));
    F.verdict(near.find(x => x.d === 3)!.r.stop === false && near.find(x => x.d === 1)!.r.stop === true, 'under it is geometry: from close in, the line down at his shins meets the plate; from further off it clears the bottom edge', near.map(x => `${x.d} m: ${x.r.stop ? 'plate' : 'shins'}`).join(' · '));
    // REAL ROUNDS through fireWeapon, the defender's muzzle put where the line starts (nothing stepped in between)
    const s0 = SHIELD_STATS.stopped; const fr = front.filter(r => !r.chest.wall && openAir(g, around(C, r.deg, 4, 1.4), chestOf(C)) && openAir(g, around(C, r.deg, 4, 1.4), shinOf(C))).sort((a, b) => Math.abs(a.deg) - Math.abs(b.deg))[0];
    for (let i = 0; i < 5; i++) await shoot(g, H, around(C, fr.deg, 4, 1.4), chestOf(C));
    F.verdict(C.state !== 'dead' && SHIELD_STATS.stopped - s0 === 5, 'five real rounds at his chest from the front: all five in the plate, he stands', `from ${fr.deg}° at 4 m: stopped ${SHIELD_STATS.stopped - s0} · ${C.callsign} ${C.state}`);
    const s1 = SHIELD_STATS.stopped;
    await shoot(g, H, around(C, fr.deg, 4, 1.4), shinOf(C)); const lowKill = C.state === 'dead';
    // (he is down: stage the same again for the round from behind)
    const S2 = await stageOf('room-clear-four'); S2.step(30); const g2 = S2.g, C2 = S2.team()[0], H2 = g2.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    // (a bearing with no wall on the line and none of his own men stood in it — a hostile round would stop in the first of them)
    const clearOf = (deg: number) => { const from = around(C2, deg, 4, 1.4), { d } = norm(from, chestOf(C2)); return !line(g2, C2, 'hostile', from, chestOf(C2)).wall && openAir(g2, from, chestOf(C2)) && !S2.team().some((m: any) => m !== C2 && bodyHit(m.char, from, d, 6, false) >= 0); };
    const rear = [180, 170, -170, 160, -160, 150, -150, 120, -120, 90, -90].find(clearOf)!;
    await shoot(g2, H2, around(C2, rear, 4, 1.4), chestOf(C2)); const rearKill = C2.state === 'dead';
    F.verdict(lowKill && rearKill && SHIELD_STATS.stopped === s1, 'one real round at his shins from the front drops him; one at his chest from behind drops him (no hit points: one round, like anybody)', `shins: ${lowKill ? 'down' : 'standing'} · from ${rear}°: ${rearKill ? 'down' : 'standing'} · stopped in the plate ${SHIELD_STATS.stopped - s1}`);
    S2.step(20); const boxes: any[] = []; handProps(g2, boxes); const flat = boxes.filter(b => b.owner === (C2.char.id & 0xff) && Math.abs(b.h[1] - SHIELD.half[2]) < 1e-9 && Math.abs(b.h[2] - SHIELD.half[1]) < 1e-9);
    const dead = line(g2, C2, 'hostile', around(C2, 0, 4, 1.4), chestOf(C2));
    F.verdict(!SH.plateUp(C2) && SH.shieldBox(C2) === null && !dead.stop && flat.length === 1 && flat[0].c[1] - C2.char.pos[1] < 0.05, 'a dead man\'s shield stops nothing and lies flat on the floor by him', `plate up: ${SH.plateUp(C2)} · drawn flat ${flat.length} at ${f2(flat[0]?.c[1] - C2.char.pos[1])} m`);
  } finally { issued(); }
  return F.done();
}

// ─────────────────────────────────────────────────────────────── a grenade's burst ───────────────────────────────────────────────────────────────
/** shield-blast: the plate against a grenade's burst (frag.ts blast, shield.ts shieldBlast; the gear build's own seam — neither part had both files) */
export async function shieldBlast(): Promise<boolean> {
  const F = family('shield-blast: a burst in front of the plate leaves the carrier standing; behind him, at his feet, or with the switch off, it judges him bare');
  const FR = await import(`${ROOT}/src/game/frag.ts`);
  issued(); zero();
  try {
    K.kitSet(1, 'shield', true);
    // one burst on a fresh stage: `deg` round him, `dist` off, on the floor — thrown by a defender. Bearings are tried in order until one has no wall on it.
    const burst = async (degs: number[], dist: number, on: boolean) => {
      for (const deg of degs) {
        const S = await stageOf('room-clear-four'); S.step(30); const g = S.g, C = S.team()[0], H = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
        const at = around(C, deg, dist, 0), from: V3 = [at[0], at[1] + FR.FRAG.lift, at[2]];
        if (FR.exposure(g, from, C.char.pos, C.char.bones.head ?? [C.char.pos[0], C.char.pos[1] + 1.65, C.char.pos[2]]) < 1) continue;   // a wall or furniture in the way: not this bearing
        SHIELD.blast = on; const up = SH.plateUp(C), covers = SH.shieldCovers(C, from, chestOf(C));
        const rep = await quiet(() => FR.blast(g, at, { who: H.char.id, fx: false, serial: 7 }));
        const hit = rep.hits.find((h: any) => h.id === C.char.id);
        return { deg, up, covers, result: hit?.result ?? 'out of reach', state: C.state, d: hit?.d ?? NaN, who: C.callsign };
      }
      return null;
    };
    const front = await burst([0, 10, -10, 20, -20], 2.5, true);
    F.verdict(!!front && front.up && front.covers && front.result === 'shielded' && front.state !== 'dead', 'a burst 2.5 m in front of his plate, nothing else in the way: he is the blast\'s \'shielded\' outcome and stands', front ? `${front.who} from ${front.deg}°, ${f2(front.d)} m: ${front.result} · ${front.state}` : 'no clear bearing');
    const rear = await burst([180, 170, -170, 160, -160, 150, -150, 120, -120], 2.5, true);
    F.verdict(!!rear && rear.up && !rear.covers && rear.result === 'killed' && rear.state === 'dead', 'the same burst behind him: the plate is not on that line, and he is killed like a bare man', rear ? `from ${rear.deg}°, ${f2(rear.d)} m: ${rear.result} · ${rear.state}` : 'no clear bearing');
    const feet = await burst([0, 10, -10, 20, -20], 0.45, true);
    F.verdict(!!feet && !feet.covers && feet.result === 'killed', 'a grenade at his feet goes under the plate\'s bottom edge: killed (the plate is geometry, not a rule about fronts)', feet ? `from ${feet.deg}°, 0.45 m off: ${feet.result} · bottom edge ${f2(SHIELD.bottom)} m over the floor, the burst judged ${f2(FR.FRAG.lift)} m over it` : 'no clear bearing');
    const off = await burst([0, 10, -10, 20, -20], 2.5, false);
    F.verdict(!!off && off.covers && off.result === 'killed' && off.state === 'dead', 'SHIELD.blast off: the same burst in front judges him bare, as before the two parts met', off ? `from ${off.deg}°: ${off.result} · ${off.state}` : 'no clear bearing');
    // nobody but the carrier: a teammate stood behind him on the burst's line is judged by walls and furniture alone
    { const S = await stageOf('room-clear-four'); S.step(30); const g = S.g, C = S.team()[0], M = S.team()[1], H = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'); SHIELD.blast = true;
      const deg = [0, 10, -10, 20, -20].find(dg => { const a = around(C, dg, 2.5, 0); return FR.exposure(g, [a[0], a[1] + FR.FRAG.lift, a[2]], C.char.pos, C.char.bones.head) >= 1; }) ?? 0;
      const at = around(C, deg, 2.5, 0), back = around(C, deg + 180, 0.9, 0); M.char.pos[0] = back[0]; M.char.pos[2] = back[2]; const e = FR.exposure(g, [at[0], at[1] + FR.FRAG.lift, at[2]], M.char.pos, [back[0], M.char.pos[1] + 1.65, back[2]]);
      const rep = await quiet(() => FR.blast(g, at, { who: H.char.id, fx: false, serial: 7 })); const hc = rep.hits.find((h: any) => h.id === C.char.id), hm = rep.hits.find((h: any) => h.id === M.char.id);
      F.verdict(hc?.result === 'shielded' && (e <= 0 || (!!hm && hm.result !== 'shielded')), 'only the carrier: a teammate a stride behind him on the same line is judged by what is solid between him and the burst, and the plate is not', `${C.callsign}: ${hc?.result} · ${M.callsign} behind him, exposed ${f2(e)}: ${hm?.result ?? 'not reached'}`); }
  } finally { SHIELD.blast = true; issued(); }
  return F.done();
}

// ─────────────────────────────────────────────────────────────── entry ───────────────────────────────────────────────────────────────
export async function shieldEntry(): Promise<boolean> {
  const F = family('shield-entry: the shield man leads the stack and is first across');
  issued(); zero();
  try {
    const DOOR = 'server';
    const run = async (who: number, tool: string, viaStack = false, scn = 'room-clear-four') => {
      issued(); if (who) K.kitSet(who, 'shield', true);
      const S = await stageOf(scn, 7); S.step(30); const g = S.g, T = S.team(), d = g.doors.list.find((x: any) => x.def.name === DOOR), D = g.doorTools, O = g.orders;
      let why: string | null = null;
      if (viaStack) { why = O.give('stack', O.targetAt(d.frameCentre)); S.until(() => T.every((m: any) => O.of(m)?.arrived), 25); }
      // One row of the door's tools, given as the player gives it, and worked until it has ended (or, held from outside, until the jambs say they hold).
      let op: any; const said: string[] = [];
      const go = (id: string) => { if (why !== null) return; why = O.give(id, O.targetAt(d.frameCentre)); if (why !== null) return; op = D.ops[D.ops.length - 1]; said.push(id);
        for (let i = 0; i < 60 * 60 && D.ops.length && !op?.thr?.told; i++) { S.step(1); if (op?.phase === 'armed') D.blow(); } };   // (a charge waits for the word: given the moment it is set and the squad stood off)
      // What the page's stand changes of these stagings' premises and the frozen one does not — each read here, as staged, and the row then given as a player gives it there:
      //  · DOORTOOLS.outsidePlain: there is no 'step in once it goes quiet' order; row 4 is 'clear from outside' (the jambs held until told) and 'open and clear' given
      //    to the men holding it is the order that steps them in. The threshold entry is those two rows.
      //  · DOORTOOLS.testDoor: an entry order at a door nobody had tried halts on it ('found shut', the men left stacked) and the same row again is the order that takes
      //    it. The entry is this check's subject, so the row is given that second time; the lead, the crossing and the cans are read off the order that went in.
      const held = tool === 'threshold' && DOORTOOLS.outsidePlain;
      go(held ? 'thresholdHold' : tool);
      if (op?.ended === 'found shut') go(held ? 'thresholdHold' : tool);
      if (held && op?.thr?.told && D.ops.includes(op)) { why = O.give('openClear', O.targetAt(d.frameCentre)); said.push('openClear'); for (let i = 0; i < 60 * 60 && D.ops.length; i++) S.step(1); }
      const crossed = op ? [...op.crossed.entries()].sort((a: any, b: any) => a[1] - b[1]).map((e: any) => e[0].callsign) : [];
      const sm = who ? T[who - 1] : null, beats = (op?.beats ?? []).map((b: any) => b.what);
      const toss = beats.filter((b: string) => /^toss:/.test(b)).map((b: string) => b.slice(5).split(' · ')[0]);
      const lead = (/· lead (.+)$/.exec(beats[0] ?? '') ?? [])[1];   // (the lead as the order named him: op.lead moves on when a lead is lost)
      return { why, op, sm, lead, crossed, beats, toss, T, rows: said.length > 1 ? ` · rows given: ${said.join(', then ')}` : '' };
    };
    for (const who of [1, 2]) for (const tool of ['bangClear', 'openClear', 'threshold']) {
      const r = await run(who, tool), name = r.sm.callsign;
      F.verdict(r.why === null && r.lead === name && r.crossed[0] === name && r.beats.some((b: string) => b === `first:${name} · the shield`) && r.toss.every((t: string) => t !== name),
        `teammate ${who} carries it, ${tool}: he is the lead on the door, the first across the frame line, and the can is another man's`, `lead ${r.lead} · across: ${r.crossed.join(', ')} · can: ${r.toss.join(', ') || 'none thrown'}${r.rows}`);
    }
    for (const who of [1, 2]) { const r = await run(who, 'charge'), name = r.sm.callsign, setter = (/· (\S+(?: \S+)?) sets it$/.exec(r.beats[0] ?? '') ?? [])[1];
      F.verdict(r.why === null && r.crossed[0] === name && r.beats.some((b: string) => b === `first:${name} · the shield`), `teammate ${who} carries it, a breaching charge: whoever set it, the shield man is first across once it is blown`, `set by ${setter} · across: ${r.crossed.join(', ')}`); }
    for (const [scn, who] of [['room-clear-four', 1], ['room-clear-pair', 1], ['room-clear-pair', 2]] as const) { const r = await run(who, 'openClear', true, scn), name = r.sm.callsign;
      F.verdict(r.why === null && r.lead === name && r.crossed[0] === name, `${scn}, teammate ${who} carries it: a plain "stack up", then open-and-clear — the stack dealt him the lead's mark and he is first across`, `lead ${r.lead} · across: ${r.crossed.join(', ')} · ${r.beats[0]}`); }
    { const a = await run(0, 'bangClear'), b = await run(0, 'threshold');
      F.verdict(a.why === null && b.why === null && !a.beats.some((x: string) => /the shield/.test(x)) && !b.beats.some((x: string) => /the shield/.test(x)), 'nobody carries one: no beat names a shield (the door is worked by the build\'s own rules)', `bang: lead ${a.lead}, across ${a.crossed.join(', ')} · threshold: lead ${b.lead}, across ${b.crossed.join(', ')}${b.rows}`); }
    { const { alongOf } = await import(`${ROOT}/src/game/doortools.ts`);
      const files = (r: any) => { const d = r.op.door, W = d.def.width, O = r.T[0] && r.op, side = (m: any) => alongOf(d, O.post.get(m).pos) > W / 2; return { red: side(r.T[0]) === side(r.T[1]), blue: side(r.T[2]) === side(r.T[3]) }; };
      const a = await run(0, 'openClear'), b = await run(3, 'openClear'), fa = files(a), fb = files(b), name = b.sm.callsign;
      F.verdict(b.why === null && b.lead === name && b.crossed[0] === name && (!fa.red || fb.red) && (!fa.blue || fb.blue), 'teammate 3 (the other pair) carries it: he is the lead and first across, and each pair still stands together on one side of the door as it did without a shield (the partners traded marks too)',
        `lead ${b.lead} · across: ${b.crossed.join(', ')} · pairs on one side — without: red ${fa.red}, blue ${fa.blue} · with: red ${fb.red}, blue ${fb.blue}${b.rows}`); }
    // THE NIGHT BREACH'S F DRILL: #1 boots the door and goes in first
    for (const who of [1, 2]) { issued(); K.kitSet(who, 'shield', true);
      const S = await stageOf('night-breach', 7); S.step(20); const NB = S.g.nightBreach, T = S.team(), sm = T[who - 1];
      F.verdict(!!NB.drill && NB.drill.a === sm && SH.plateUp(sm), `night breach, teammate ${who} carries it: he is the drill's #1 (the kick, and first in)`, `#1 ${NB.drill?.a?.callsign} · #2 ${NB.drill?.b?.callsign}`); }
  } finally { issued(); }
  return F.done();
}

// ─────────────────────────────────────────────────────────────── defenders ───────────────────────────────────────────────────────────────
export async function shieldDefenders(): Promise<boolean> {
  const F = family('shield-defenders: they stop shooting the plate once they have seen it eat their rounds');
  issued(); zero();
  try {
    K.kitSet(1, 'shield', true);
    const S = await stageOf('room-clear-four'); S.step(30);
    const g = S.g, C = S.team()[0], H = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'), H2 = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead' && x !== H);
    const fdeg = [0, 10, -10, 20, -20].find(deg => !line(g, C, 'hostile', around(C, deg, 4, 1.4), chestOf(C)).wall && openAir(g, around(C, deg, 4, 1.4), chestOf(C)) && openAir(g, around(C, deg, 4, 1.4), shinOf(C)))!;
    const front = () => around(C, fdeg, 4, 1.4), side = () => around(C, [90, -90, 100, -100, 80, -80].find(deg => !line(g, C, 'hostile', around(C, deg, 4, 1.4), chestOf(C)).wall)!, 4, 1.4);
    const a0 = SH.shieldAim(g, H, C, front(), chestOf(C)), b0 = SH.shieldBlocks(g, H, C, front());
    await shoot(g, H, front(), chestOf(C));
    const a1 = SH.shieldAim(g, H, C, front(), chestOf(C)), b1 = SH.shieldBlocks(g, H, C, front());
    S.step(Math.ceil((SHIELD.learnSecs + 0.1) * 60));
    const a2 = SH.shieldAim(g, H, C, front(), chestOf(C));   // (one round and a wait: a stray teaches nobody)
    F.verdict(a0 === null && !b0 && a1 === null && !b1 && a2 === null && C.state !== 'dead', 'before any of his rounds has met it, right after the first, and however long after ONE: he aims at the trunk as ever', `before: ${a0} · after one round: ${a1} · ${f2(SHIELD.learnSecs + 0.1)} s after that one: ${a2}`);
    await shoot(g, H, front(), chestOf(C)); const a3 = SH.shieldAim(g, H, C, front(), chestOf(C)), learned = SHIELD_STATS.learned;
    F.verdict(!!a3 && learned === 1, `his second round into it, ${f2(SHIELD.learnSecs)} s and more after the first: now he knows`, `aim ${a3 ? 'low' : 'unchanged'} · learned ${learned}`);
    const low = SH.shieldAim(g, H, C, front(), chestOf(C)), blk = SH.shieldBlocks(g, H, C, front()), flankAim = SH.shieldAim(g, H, C, side(), chestOf(C)), flankBlk = SH.shieldBlocks(g, H, C, side());
    const other = SH.shieldAim(g, H2, C, front(), chestOf(C));
    F.verdict(!!low && Math.abs(low[1] - C.char.pos[1] - SHIELD.lowY) < 1e-6 && blk, 'from the front, knowing it: his aim point is under the plate at the shins', `aim ${low ? `${f2(low[1] - C.char.pos[1])} m over the floor` : 'unchanged'} · the plate is what he would hit: ${blk}`);
    F.verdict(flankAim === null && !flankBlk, 'the same man with the flank: the plate is not on his line, he aims at the trunk', `aim ${flankAim} · blocked ${flankBlk}`);
    F.verdict(other === null, 'a defender whose own rounds have not met it has learned nothing (each man learns by his own rounds)', `${H2?.callsign}: ${other}`);
    // the man BEHIND the plate is no better a target: from the front the carrier's plate is on the line to a teammate stood a metre behind him, not on the line to one stood beside him
    // ('behind' and 'beside' as the defender sees them — along his line through the carrier and square to it: the question shieldScreens asks is of HIS line. With the
    //  defender dead ahead, bearing 0, that is the carrier's own back and side; where the stand leaves no clear line dead ahead and he is stood 20° round, a man at the
    //  carrier's back is in plain view past the plate's edge, and that is geometry, not a screen that failed.)
    const mate = S.team()[1].char, keep = [...mate.bones.chest], kp = [...mate.pos], fp = front(), bl = Math.hypot(C.char.pos[0] - fp[0], C.char.pos[2] - fp[2]), back: V3 = [(C.char.pos[0] - fp[0]) / bl, 0, (C.char.pos[2] - fp[2]) / bl];
    const put = (at: V3) => { mate.bones.chest = [at[0], keep[1], at[2]]; mate.pos = [at[0], C.char.pos[1], at[2]]; };
    put([C.char.pos[0] + back[0], 0, C.char.pos[2] + back[2]]); const behind = SH.shieldScreens(C, front(), mate);
    put([C.char.pos[0] - back[2] * 1.5, 0, C.char.pos[2] + back[0] * 1.5]); const beside = SH.shieldScreens(C, front(), mate); mate.bones.chest = keep; mate.pos = kp;
    F.verdict(behind && !beside, 'a teammate stood behind the plate is screened by it (no better a man to switch to); one stood beside it is not', `the defender ${fdeg}° round from dead ahead · a metre behind him: screened ${behind} · a metre and a half to his side: screened ${beside}`);
    const near = SH.shieldAim(g, H, C, around(C, 0, 1, 1.4), chestOf(C));
    F.verdict(near === null, 'from a metre off nothing shows under it: he has no low line and keeps the trunk', `aim ${near}`);
    await shoot(g, H, front(), low);
    F.verdict(C.state === 'dead', 'the round down that low line drops the shield man', `${C.callsign} ${C.state}`);
    // PLAYED RUNS: the counters over three seeded play-throughs of the room clear with four, the shield on teammate 1
    const { play } = await import('./playthrough.ts'); zero(); const ends: string[] = [];
    for (const seed of [1, 2, 3]) { issued(); K.kitSet(1, 'shield', true); const r = await quiet(() => play('room-clear-four', seed, 300)); ends.push(`${seed}: ${r.end} ${r.t} s team ${r.team}/${r.of}`); }
    F.verdict(SHIELD_STATS.given === 3 && SHIELD_STATS.led > 0 && !ends.some(e => /error/.test(e)), 'three played runs with the shield on teammate 1: no exception, and he led entries (how many rounds the plate stops in play is the tally\'s to count, not three runs\')', `${ends.join(' · ')} · ${JSON.stringify(SHIELD_STATS)}`);
  } finally { issued(); }
  return F.done();
}

// ─────────────────────────────────────────────────────────────── identity ───────────────────────────────────────────────────────────────
export async function shieldIdentity(): Promise<boolean> {
  const F = family('shield-identity: with nobody carrying one, nothing moves');
  issued(); const was = process.env.PT_DIGEST; process.env.PT_DIGEST = '1';
  try {
    const { play } = await import('./playthrough.ts');
    for (const scn of ['room-clear-four', 'night-breach']) {
      const a = await quiet(() => play(scn, 2, 240));
      const g0 = SHIELD_STATS.given; K.kitSet(1, 'shield', true); const mid = await quiet(() => play(scn, 2, 240)); issued(); const carried = SHIELD_STATS.given - g0;   // (a game in between that handed one out: the module has seen a shield)
      const b = await quiet(() => play(scn, 2, 240));
      const c = await shieldOff(() => quiet(() => play(scn, 2, 240)));
      F.verdict(a.end !== 'error' && !!a.digest && a.digest === b.digest && a.digest === c.digest && a.end === b.end && a.t === b.t && carried === 1 && mid.end !== 'error' && mid.digest !== a.digest,
        `${scn} seed 2: as issued digests the same before and after a shield was carried in this process, and with the row switched off`, `${a.end} ${a.t} s team ${a.team}/${a.of} · ${String(a.digest).slice(0, 16)} = ${String(b.digest).slice(0, 16)} = ${String(c.digest).slice(0, 16)} · the run in between: ${carried} shield carried, ${mid.end} ${mid.t} s, digest ${String(mid.digest).slice(0, 16)}`);
    }
  } finally { if (was === undefined) delete process.env.PT_DIGEST; else process.env.PT_DIGEST = was; issued(); }
  return F.done();
}
