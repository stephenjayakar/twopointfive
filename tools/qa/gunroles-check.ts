// A GUN IS USED FOR WHAT IT IS FOR, AND THE DEFENDERS DRAW FROM THE SAME TABLE (src/game/gunroles.ts GUNROLES; `GUNROLES_BREAK=1` must fail every family)
//   deal    seven missions over three seeds: every defender carries a row of the table, one belt-fed gun at most and only on a lane or in a big cast, on
//           the longest line; a pistol only on a near post, a quarter of a cast at most; the man with a hostage in his hand keeps his own gun; every row puts a man down
//           with one round and is put down by one; the same seed deals the same guns, another seed others
//   entry   four on a door with an MP7, an issue carbine, a Mk 12 and a Mk 46: the MP7 on the mark at the frame and first through, the two long guns on the
//           rear marks and last; the same four with issue carbines stack and go as with the switch off
//   fight   string length by gun: a defender's PKM against the carbine and the AKMS through the fight AI's own trigger; a teammate's Mk 46, Mk 12 and
//           issue carbine through the room fight's — what the trigger answers, and the gaps between the rounds of a staged fight at nine metres
//   lanes   the belt-fed defender keeps his post (lanes.ts laneHolds) through a fight next door; the cover's deal: the far opening to the long gun
//           before the pistol
//   off     off = the run of the build before, by digest; on with nobody dealt and the cards as issued = that run too; the stands' row, the registry,
//           the page's flag, a recording from before it
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself, by the stand's own word, before a floor is stood up. No picture.
const { standUp, ROOT } = await import('./headless.ts');
const { rig } = await import('./doortools-probes.ts');
const { readFileSync, existsSync } = await import('node:fs');
const { resolve } = await import('node:path');
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { GUNROLES, GUNROLES_STATS, gunRole, gunString, gunStringGap, gunLane, gunKeepsPost, gunFileCost, gunFileRanks, gunLast, gunBlindGap, gunHand } = await import(`${ROOT}/src/game/gunroles.ts`);
const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);
const { sideOut } = await import(`${ROOT}/src/game/gunslots.ts`);
const { WEAPONS, Firearm } = await import(`${ROOT}/src/game/weapons.ts`);
const { burstTrigger, spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { laneHolds } = await import(`${ROOT}/src/game/lanes.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const DEFAULTS = { ...GUNROLES };
/** a floor stood up with the switch as asked, by the stand's own word (so the cast is dealt, or not, as it is staged) — and every key as the module writes it */
async function withSwitch<T>(on: boolean, fn: () => Promise<T>, keys: Partial<typeof GUNROLES> = {}): Promise<T> {
  const was = process.env.TPS_GUNROLES; process.env.TPS_GUNROLES = on ? '1' : '0'; Object.assign(GUNROLES, DEFAULTS, keys);
  try { return await fn(); } finally { if (was === undefined) delete process.env.TPS_GUNROLES; else process.env.TPS_GUNROLES = was; Object.assign(GUNROLES, DEFAULTS); }
}
const seeded = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync((f => existsSync(f) ? f : resolve(ROOT, 'levels', file))(resolve(ROOT, 'levels', lookLevelFile(file))), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
/** a mission of the start card staged as the page stages it; the note the deal leaves is read back: who was given what, on how long a line */
async function stage(id: string, seed: number) {
  const E = SCENARIOS.find((e: any) => e.id === id); if (!E) throw new Error(`no mission '${id}'`);
  return hushed(async () => {
    const rnd = Math.random; Math.random = seeded(0x9137 + seed * 7919);
    try {
      const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }), g = W.game; const notes: string[] = []; const n0 = g.note.bind(g); g.note = (t: string) => { notes.push(t); n0(t); };
      const q = (scenarioQuery(E) as string).replace(/(^|[?&])(roomclear|nightbreach|rescue)(=\d+)?(?=&|$)/, `$1$2=${seed}`);
      const { why } = await startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`${id}: start refused — ${why}`);
      const hos = g.guards.filter((x: any) => x.team === 'hostile'), dealt = notes.find(n => n.startsWith('guns ▸')) ?? '';
      const lines = new Map<string, number>(); for (const m of dealt.matchAll(/([^·▸]+?) \S+ \((\d+(?:\.\d+)?) m\)/g)) lines.set(m[1].trim(), Number(m[2]));
      return { W, g, q, hos, dealt, men: hos.map((h: any) => ({ gd: h, name: h.callsign as string, gun: h.weapon.def.id as string, line: lines.get(h.callsign) ?? NaN, captor: /captor/i.test(h.callsign) })) as Man[] };
    } finally { Math.random = rnd; }
  });
}
interface Man { gd: any; name: string; gun: string; line: number; captor: boolean }
const hand = (gd: any, id: string) => gunHand(gd, id);

// ───────────────────────────────────────────────────────────── deal
const MISSIONS = ['room-clear-four', 'depot-four', 'hall-four', 'warehouse-four', 'killhouse-four', 'hostage-rescue', 'rescue-consulate'], SEEDS = [1, 2, 3];
export async function gunrolesDeal(): Promise<boolean> {
  const F = family('gunroles-deal: a cast is dealt its guns off the table');
  const K = GUNROLES, TABLE = ['aks74u', 'akms', 'pkm', 'guard9mm'];
  const casts: { id: string; seed: number; men: { name: string; gun: string; line: number; captor: boolean }[] }[] = [];
  await withSwitch(true, async () => { for (const id of MISSIONS) for (const seed of SEEDS) { const S = await stage(id, seed); casts.push({ id, seed, men: S.men.map(m => ({ name: m.name, gun: m.gun, line: m.line, captor: m.captor })) }); } });
  const count = (g: string) => casts.reduce((n, c) => n + c.men.filter(m => m.gun === g).length, 0), all = casts.reduce((n, c) => n + c.men.length, 0);
  const rows = casts.every(c => c.men.every(m => TABLE.includes(m.gun) && (WEAPONS as any)[m.gun].enabled && (WEAPONS as any)[m.gun].damage === 'oneShot'));
  F.verdict(rows && count('akms') > 0 && count('pkm') > 0 && count('guard9mm') > 0 && count('aks74u') > 0, `over ${MISSIONS.length} missions and ${SEEDS.length} seeds every defender carries a row of the table — the short carbine, the AKMS, the PKM or a pistol — and each of the four is carried by somebody; every row is one round to put a man down`, `${all} men in ${casts.length} casts: ${TABLE.map(g => `${(WEAPONS as any)[g].short} ${count(g)}`).join(' · ')}`);
  // the belt-fed gun
  const beltOk = casts.map(c => { const b = c.men.filter(m => m.gun === 'pkm'), pool = c.men.filter(m => !m.captor), far = Math.max(...pool.map(m => m.line)), earns = (far >= K.beltLane && c.men.length >= K.beltMin) || c.men.length >= K.beltSquad;
    return b.length <= 1 && (b.length === 1) === earns && (!b.length || b[0].line >= far - 0.51); });
  const withBelt = casts.filter(c => c.men.some(m => m.gun === 'pkm'));
  F.verdict(beltOk.every(Boolean) && withBelt.length > 0 && withBelt.length < casts.length, `one belt-fed gun to a cast at most, on the post with the longest line, and only where that line is a lane (${K.beltLane} m, ${K.beltMin} men or more) or the cast is a big one (${K.beltSquad} men): some casts have one, some have none`, `${withBelt.length} of ${casts.length} casts · with: ${[...new Set(withBelt.map(c => c.id))].join(', ')} · without: ${[...new Set(casts.filter(c => !withBelt.includes(c)).map(c => c.id))].join(', ')}\n    ${withBelt.slice(0, 4).map(c => `${c.id} s${c.seed}: ${c.men.find(m => m.gun === 'pkm')!.name} on ${c.men.find(m => m.gun === 'pkm')!.line} m of ${c.men.length} men`).join(' · ')}`);
  // the pistols
  const pist = casts.map(c => { const p = c.men.filter(m => m.gun === 'guard9mm'); return p.every(m => !m.captor && m.line < K.pistolNear + 0.51) && p.length <= Math.floor(c.men.length * K.pistolMax); });
  const captors = casts.flatMap(c => c.men.filter(m => m.captor)), farPistol = Math.max(0, ...casts.flatMap(c => c.men.filter(m => m.gun === 'guard9mm').map(m => m.line)));
  F.verdict(pist.every(Boolean), `a pistol only on a post watching something within ${K.pistolNear} m — a quarter of a cast at most, and never on a long line`, `${count('guard9mm')} pistols · the longest line a pistol was dealt on: ${f2(farPistol)} m`);
  // the man with a hostage in his hand: not dealt (the gun his scenario gave him), a pistol only with the `captor` key
  const keyed = await withSwitch(true, async () => { const o: string[] = []; for (const id of ['hostage-rescue', 'rescue-consulate']) o.push(...(await stage(id, 1)).men.filter(m => m.captor).map(m => m.gun)); return o; }, { captor: true });
  F.verdict(captors.length > 0 && captors.every(m => m.gun === 'aks74u') && keyed.length > 0 && keyed.every(g => g === 'guard9mm'), 'the man with a hostage in his hand is not dealt: he keeps the short carbine his rescue gave him — a pistol only with the `captor` key', `${captors.length} such men over the rescues' casts: ${[...new Set(captors.map(m => m.gun))].join(' ')} · with the key: ${keyed.join(' ')}`);
  // the same seed, another seed
  const again = await withSwitch(true, async () => (await stage('warehouse-four', 2)).men.map(m => m.gun));
  const first = casts.find(c => c.id === 'warehouse-four' && c.seed === 2)!.men.map(m => m.gun), other = casts.find(c => c.id === 'warehouse-four' && c.seed === 3)!.men.map(m => m.gun);
  F.verdict(J(again) === J(first) && J(other) !== J(first), 'the deal is the game\'s own die: the same seed deals the same guns, another seed others', `warehouse seed 2: ${first.join(' ')}\n    again:            ${again.join(' ')}\n    seed 3:           ${other.join(' ')}`);
  // the same floor opens with the same guns (samestart.ts): the mission started again on the same game, its die run on
  const twice = await withSwitch(true, async () => { const S = await stage('warehouse-four', 2), a = S.men.map(m => m.gun), at = S.men.map(m => `${m.gd.char.pos[0].toFixed(1)},${m.gd.char.pos[2].toFixed(1)}`);
    await hushed(async () => { for (let i = 0; i < 90; i++) S.W.step(1 / 60); await startFromQuery(S.g, new URLSearchParams(S.q)); });
    const hos = S.g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'); return { a, b: hos.map((h: any) => h.weapon.def.id as string), same: J(at) === J(hos.map((h: any) => `${h.char.pos[0].toFixed(1)},${h.char.pos[2].toFixed(1)}`)) }; });
  F.verdict(SAMESTART.on ? twice.same && J(twice.a) === J(twice.b) : true, 'a mission started again stands the same men on the same marks (samestart.ts) with the same guns: a draw comes off a man\'s own mark, not off the die as it has run on', SAMESTART.on ? `first:  ${twice.a.join(' ')}\n    again:  ${twice.b.join(' ')} · the same marks: ${twice.same}` : `this stand holds the same-start rule off (TPS_SAMESTART): a restart is a fresh placement, and one number off the die salts its deal · marks the same ${twice.same} · guns the same ${J(twice.a) === J(twice.b)}`);
  // never more hit points: one round each
  const downs: string[] = [];
  for (const gun of ['pkm', 'guard9mm', 'akms', 'aks74u']) downs.push(await withSwitch(true, async () => {
    const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game, at = g.player.char.pos;
    const gd = spawnUnit(g, { team: 'hostile', pos: [at[0] + 2.5, 0, at[2] - 2.4], name: 'Tango', light: false }); hand(gd, gun);
    await hushed(() => { fireWeapon(g, g.player.char, [gd.char.pos[0], 1.2, gd.char.pos[2]], true, { weapon: WEAPONS.fn2000, spread: 0, steady: true }); R.step(2); });
    return `${(WEAPONS as any)[gun].short}: ${gd.state === 'dead' ? 'down to one round' : 'STILL UP'}`;
  }));
  F.verdict(downs.length === 4 && downs.every(d => /down to one round/.test(d)), 'nobody is harder to put down for his gun: a belt-fed man, a pistol man, an AKMS man and a man with the short carbine each go down to one round', downs.join(' · '));
  return F.done();
}

// ───────────────────────────────────────────────────────────── entry
export async function gunrolesEntry(): Promise<boolean> {
  const F = family('gunroles-entry: the room gun goes first, the long guns hang back');
  const run = (on: boolean, guns: string[]): Promise<{ why: string | null; marks: { gun: string; m: number }[]; queue: string[]; beats: string }> => withSwitch(on, async () => {
    const R: any = await hushed(() => rig(3, { door: 'breakroom_w', nb: { squad: 4 } })); const d = R.door('breakroom_w');
    R.ops.forEach((gd: any, i: number) => hand(gd, guns[i])); R.step(2);
    const why = R.give('openClear', 'breakroom_w'), op0 = R.op, near = (gd: any) => { const P = op0?.post.get(gd); return P ? Math.hypot(P.pos[0] - d.frameCentre[0], P.pos[2] - d.frameCentre[2]) : NaN; };
    const marks = R.ops.map((gd: any) => ({ gun: gd.weapon.def.id as string, m: near(gd) }));
    let queue: string[] = []; R.until(() => { const q = R.op?.queue; if (q?.length && !queue.length) queue = q.map((x: any) => x.gd.weapon.def.id); return queue.length > 0; }, 25);
    return { why: why as string | null, marks: marks as { gun: string; m: number }[], queue, beats: R.beats(R.op) as string };
  });
  const MIX = ['mk12', 'mk46', 'fn2000', 'mp7'], ISSUE = ['fn2000', 'fn2000', 'fn2000', 'fn2000'];
  const off = await run(false, MIX), on = await run(true, MIX), offI = await run(false, ISSUE), onI = await run(true, ISSUE);
  const m = (r: typeof on, gun: string) => r.marks.find(x => x.gun === gun)!.m, show = (r: typeof on) => `marks ${r.marks.map(x => `${(WEAPONS as any)[x.gun].short} ${f2(x.m)} m`).join(' · ')}\n      through the door: ${r.queue.map(g => (WEAPONS as any)[g].short).join(' > ')}`;
  F.verdict(on.why === null && on.queue.length === 4 && on.queue[0] === 'mp7' && J(on.queue.slice(2).sort()) === J(['mk12', 'mk46']) && m(on, 'mp7') <= m(on, 'mk12') - 0.25 && m(on, 'mp7') <= m(on, 'mk46') - 0.25 && m(on, 'fn2000') <= m(on, 'mk12') - 0.25 && /first:[^|]*his gun is the room's|lead/.test(on.beats),
    'four on a door with a Mk 12, a Mk 46, an issue carbine and an MP7: the MP7 stands at the frame and goes first, the carbine second, the Mk 12 and the Mk 46 on the rear marks and last through', `on:  ${show(on)}`);
  F.verdict(off.queue[0] === 'mk12' && J(off.queue) !== J(on.queue), 'with the switch off the same four stack by the walk alone: the Mk 12 at the frame and first through', `off: ${show(off)}`);
  F.verdict(J(onI.marks) === J(offI.marks) && J(onI.queue) === J(offI.queue) && onI.beats === offI.beats, 'four issue carbines stack and go the same with the switch on as with it off: nothing differs until a card names another gun', `on:  ${onI.marks.map(x => f2(x.m)).join(' ')} · ${onI.beats.slice(0, 120)}\n    off: ${offI.marks.map(x => f2(x.m)).join(' ')} · ${offI.beats.slice(0, 120)}`);
  // a pair: both ways tried with the guns in it
  const pair = await withSwitch(true, async () => { const R: any = await hushed(() => rig(3, { stage: false })); const g = R.game, at = g.player.char.pos;
    const a = spawnUnit(g, { team: 'operative', pos: [at[0] + 1, 0, at[2]], name: 'A', light: false }), b = spawnUnit(g, { team: 'operative', pos: [at[0] + 2, 0, at[2]], name: 'B', light: false }); hand(a, 'mk12'); hand(b, 'm1014');
    const front: [number, number, number] = [at[0], 0, at[2]], spots: [number, number, number][] = [[at[0] + 0.8, 0, at[2]], [at[0] + 2.2, 0, at[2]]];
    const r = gunFileRanks([a, b]); hand(a, 'fn2000'); hand(b, 'fn2000'); const none = gunFileRanks([a, b]); hand(a, 'mk12'); hand(b, 'mp7'); const c = spawnUnit(g, { team: 'operative', pos: [at[0] + 3, 0, at[2]], name: 'C', light: false });
    return { asWalk: r ? gunFileCost(r, spots, front) : -1, swapped: r ? gunFileCost(r, [spots[1], spots[0]], front) : -1, none, wall: gunLast([a, c, b]).map((m: any) => m.weapon.def.id).join(' ') }; });
  F.verdict(pair.asWalk === GUNROLES.fileCost && pair.swapped === 0 && pair.none === null && pair.wall === 'fn2000 mp7 mk12', 'a Mk 12 man nearer the frame than an M1014 man is the dealing that costs; the shotgun at the frame costs nothing; two issue carbines are never priced; through a blown wall the Mk 12 man nearest the hole goes after the other two', `Mk 12 in front ${pair.asWalk} · M1014 in front ${pair.swapped} · two issue carbines ${pair.none} · through the hole: ${pair.wall}`);
  return F.done();
}

// ───────────────────────────────────────────────────────────── fight
export async function gunrolesFight(): Promise<boolean> {
  const F = family('gunroles-fight: string length by gun, on both sides');
  // a defender's trigger (the fight AI's own burstTrigger), thirty pulls a row
  const strings = await withSwitch(true, async () => { const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game, at = g.player.char.pos, out: Record<string, { min: number; max: number; mean: number }> = {};
    const gd = spawnUnit(g, { team: 'hostile', pos: [at[0] + 2, 0, at[2] + 1], yaw: 0, name: 'Gunner', light: false }); const aim: [number, number, number] = [gd.char.pos[0], 1.2, gd.char.pos[2] + 9];
    await hushed(() => { for (const id of ['aks74u', 'akms', 'pkm']) { hand(gd, id); gd.fireCd = 0; const ns: number[] = []; let cur: unknown = null;
      for (let i = 0; i < 60 * 240 && ns.length < 30; i++) { gd.fireCd = Math.max(0, gd.fireCd - 1 / 60); if (gd.weapon.roundsReady < 12) gd.weapon.rearm(); gd.reloadT = -1; burstTrigger(g, gd, 1 / 60, aim, true, true); const b = gd.weapon.burst; if (b && b !== cur) { cur = b; ns.push(b.n); } }
      out[id] = { min: Math.min(...ns), max: Math.max(...ns), mean: ns.reduce((a, b) => a + b, 0) / Math.max(1, ns.length) }; } });
    return out; });
  const P = strings.pkm, A = strings.aks74u, M = strings.akms;
  F.verdict(!!P && P.min >= 6 && P.max <= 10 && A.max <= 4 && M.max <= 3 && P.min > A.max && P.mean > 2 * A.mean, 'a defender\'s PKM fires strings of six to ten where the short carbine fires two to four and the AKMS two or three', `thirty pulls each — PKM ${P.min} to ${P.max} (mean ${f2(P.mean)}) · AKS-74U ${A.min} to ${A.max} (${f2(A.mean)}) · AKMS ${M.min} to ${M.max} (${f2(M.mean)})`);
  // a teammate's trigger in the room fight: what it answers by gun, and with the sidearm in his hands
  const ans = async (on: boolean) => withSwitch(on, async () => { const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game, at = g.player.char.pos;
    const gd = spawnUnit(g, { team: 'operative', pos: [at[0] + 1, 0, at[2] + 1], name: 'Archer', light: false }); const out: Record<string, number> = {};
    for (const id of ['fn2000', 'mp7', 'mk12', 'mk46']) { hand(gd, id); out[id] = gunString(gd); }
    out.gap46 = gunStringGap(gd); return out; });
  const aOn = await ans(true), aOff = await ans(false);
  F.verdict(aOn.mk46 >= 5 && aOn.mk12 === 1 && aOn.fn2000 === 0 && aOn.mp7 === 0 && aOn.gap46 < 0.1 && Object.entries(aOff).every(([k, v]) => k === 'gap46' || v === 0), 'a teammate\'s room-fight trigger: a string of the belt\'s own length at its cyclic rate for the Mk 46, one aimed round for the Mk 12, the controlled pair for the issue carbine and the MP7 — and the pair for every gun with the switch off', `on: Mk 46 ${aOn.mk46} rounds ${f2(aOn.gap46)} s apart · Mk 12 ${aOn.mk12} · issue ${aOn.fn2000} · MP7 ${aOn.mp7} (0 = the pair)\n    off: ${J(aOff)}`);
  // … and a staged fight at nine metres, five men in a row with empty guns: the shortest gap between two of his rounds
  const gaps = async (on: boolean, gun: string) => withSwitch(on, async () => { const R: any = await hushed(() => rig(17, { nb: { squad: 4 } })); const g = R.game, op = R.ops[0]; hand(op, gun);
    const at = op.char.pos; let dir = [1, 0], far = 0; for (let k = 0; k < 64; k++) { const a = k * Math.PI / 32, d = [Math.sin(a), Math.cos(a)], h = g.col.raycast([at[0], 1.2, at[2]], [d[0], 0, d[1]], 60), t = h ? h.t : 60; if (t > far) { far = t; dir = d; } }
    R.hostiles.forEach((h: any, k: number) => { const p = [at[0] + dir[0] * 9 + dir[1] * (k - 2) * 0.7, 0, at[2] + dir[1] * 9 - dir[0] * (k - 2) * 0.7]; h.char.pos[0] = p[0]; h.char.pos[2] = p[2]; h.route.points[0] = [p[0], 0, p[2]]; h.pinned = true; h.weapon.mag = 0; h.weapon.chamber = 0; h.reloadT = 1e9;
      h.char.yaw = h.char.aimYaw = h.char.bodyYaw = Math.atan2(-dir[0], -dir[1]); h.state = 'alert'; h.awareness = 1; h.lastSeenT = g.time; h.lastKnown = [...at]; });
    // (what the trigger sets itself after the FIRST round of a beat — the pair's second round, a string's next, the long rifle's next aimed one: read off the room fight's own clock for him, so a man who goes down to that round does not hide it)
    const after: number[] = []; let n = 0; for (let i = 0; i < 60 * 10; i++) { R.step(); const O = g.fight.opOf?.(op); if (O && O.rounds !== n) { n = O.rounds; if (O.n % 2 === 1) after.push(O.next - g.time); } }
    return { rounds: n, least: after.length ? Math.min(...after) : NaN, most: after.length ? Math.max(...after) : NaN, down: R.hostiles.filter((h: any) => h.state === 'dead').length }; });
  const b46 = await gaps(true, 'mk46'), b46off = await gaps(false, 'mk46'), b12 = await gaps(true, 'mk12'), b12off = await gaps(false, 'mk12');
  F.verdict(b46.rounds > 1 && b46.most < 0.1 && b46off.least > 0.14 && b46off.most < 0.18 && b12.least > 0.19 && b12off.most < 0.18, 'in a staged room fight at nine metres the Mk 46 man\'s next round is set at the belt\'s rate where the pair\'s second round came, and the Mk 12 man\'s a beat later: one aimed round at a time', `the wait the trigger sets after the first round of a beat — Mk 46: on ${f2(b46.least)} to ${f2(b46.most)} s, off ${f2(b46off.least)} to ${f2(b46off.most)} s (${b46.rounds} / ${b46off.rounds} rounds, ${b46.down} / ${b46off.down} men down) · Mk 12: on ${f2(b12.least)} to ${f2(b12.most)} s, off ${f2(b12off.least)} to ${f2(b12off.most)} s (${b12.rounds} / ${b12off.rounds} rounds, ${b12.down} / ${b12off.down} down)`);
  return F.done();
}

// ───────────────────────────────────────────────────────────── lanes
export async function gunrolesLanes(): Promise<boolean> {
  const F = family('gunroles-lanes: the belt-fed man keeps his post; the far opening is the long gun\'s');
  let seed = 1; for (; seed < 6; seed++) if (await withSwitch(true, async () => { const R: any = await hushed(() => rig(seed, { nb: { squad: 4 } })); return R.hostiles.some((h: any) => h.weapon.def.id === 'pkm'); })) break;
  const post = async (on: boolean, keys: Partial<typeof GUNROLES> = {}) => withSwitch(on, async () => { const R: any = await hushed(() => rig(seed, { nb: { squad: 4 } })); const g = R.game;
    let belt = R.hostiles.find((h: any) => h.weapon.def.id === 'pkm') ?? null; const dealt = !!belt; if (!belt) { belt = R.hostiles[0]; hand(belt, 'pkm'); }   // (off: nobody was dealt one — the same gun is put in a man's hands to ask the rule alone)
    const other = R.hostiles.find((h: any) => h !== belt && h.weapon.def.cls !== 'pistol'), mark = [...belt.char.pos], p0 = GUNROLES_STATS.posts;
    const holds = laneHolds(g, belt), holdsOther = other ? laneHolds(g, other) : true, keeps = gunKeepsPost(belt);
    // a fight next door: rounds on the floor, the squad let go at the door nearest them, twenty seconds
    await hushed(() => { fireWeapon(g, R.ops[0].char, [R.ops[0].char.pos[0] + 3, 1.2, R.ops[0].char.pos[2]], false, { weapon: WEAPONS.aks74u }); });
    let far = 0; for (let i = 0; i < 60 * 20; i++) { R.step(); if (belt.state !== 'dead') far = Math.max(far, Math.hypot(belt.char.pos[0] - mark[0], belt.char.pos[2] - mark[2])); }
    return { dealt, holds, holdsOther, keeps, far, asked: GUNROLES_STATS.posts - p0, up: belt.state !== 'dead', name: belt.callsign as string }; }, keys);
  const on = await post(true), off = await post(false), noPost = await post(true, { post: false });
  const digs = noPost.far > 2;   // (the stand digs its defenders in at a fight next door: the control for 'he stays')
  F.verdict(on.holds && on.keeps && !on.holdsOther && on.asked > 2 && (digs ? on.far < 1 : on.far < 1 && noPost.far < 1), 'a defender with the belt-fed gun in the office\'s room clear (the man the deal gave it to, where this stand\'s cast earns one): no rally, press, errand or hunt in the dark may take him from his gun\'s place (laneHolds answers for him and not for a rifleman), the fight asks it of him, and through twenty seconds of a fight next door he is on the mark his line was measured from, where the same man with the `post` key off walks off to dig in', `seed ${seed} · ${on.name}: ${on.dealt ? 'dealt it' : 'handed it (no cast of this stand\'s earns one in five seeds)'} · holds ${on.holds} · a rifleman ${on.holdsOther} · furthest from his mark ${f2(on.far)} m · key off ${f2(noPost.far)} m${digs ? '' : ' (nobody digs in on this stand: no control)'} · up ${on.up} · the game asked ${on.asked - 2} times`);
  F.verdict(!off.holds && !off.keeps && !noPost.holds && !noPost.keeps, 'with the switch off — or its `post` key — the same gun in a man\'s hands keeps nobody anywhere', `off: holds ${off.holds} · key off: holds ${noPost.holds}`);
  // a blinded pistol man's rounds where the room was: his gun's rate, not the carbine's
  const blind = await withSwitch(true, async () => { const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game, at = g.player.char.pos; const gd = spawnUnit(g, { team: 'hostile', pos: [at[0] + 2, 0, at[2] + 1], name: 'Tango', light: false });
    hand(gd, 'guard9mm'); const p = gunBlindGap(gd, 0.1); hand(gd, 'aks74u'); const c = gunBlindGap(gd, 0.1); hand(gd, 'guard9mm'); GUNROLES.on = false; const off = gunBlindGap(gd, 0.1); return { p, c, off }; });
  F.verdict(blind.p >= 0.5 && blind.c === 0.1 && blind.off === 0.1, 'a flashed defender firing blind fires at his own gun\'s rate: a dealt pistol a round a pull, the carbine the staging\'s tenth of a second — and that tenth for any gun with the switch off', `pistol ${f2(blind.p)} s · carbine ${f2(blind.c)} s · pistol, switch off ${f2(blind.off)} s`);
  // the cover's deal: what an opening is worth to a man for his gun
  const lane = async (on: boolean) => withSwitch(on, async () => { const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game, at = g.player.char.pos;
    const gd = spawnUnit(g, { team: 'operative', pos: [at[0] + 1, 0, at[2] + 1], name: 'Archer', light: false }); const out: Record<string, number[]> = {};
    for (const id of ['fn2000', 'mk12', 'mk46', 'mp7', 'guard9mm']) { hand(gd, id); out[id] = [gunLane(gd, 2, 9), gunLane(gd, 9, 9)]; }
    // … and the sidearm out after a dry primary: his gun is still the long gun on his sling
    hand(gd, 'mk12'); gd.second = { gun: new Firearm(WEAPONS.guard9mm), id: 'guard9mm', ahead: 0.26, out: false, t: -100, lock: -100, shots: 0 }; gd.weapon.mag = 0; gd.weapon.chamber = 0;
    const went = await hushed(() => sideOut(g, gd, 4)); out.slung = [gunLane(gd, 9, 9)]; (out as any).role = gunRole(gd); (out as any).went = went; (out as any).str = gunString(gd);
    return out as any; });
  const L = await lane(true), L0 = await lane(false);
  F.verdict(L.mk12[1] > L.mk12[0] && L.mk12[1] > 0 && L.mk46[1] > 0 && L.guard9mm[1] < L.guard9mm[0] && L.guard9mm[1] < 0 && L.mp7[1] < 0 && L.mp7[1] > L.guard9mm[1] && L.fn2000[0] === 0 && L.fn2000[1] === 0 && Object.values(L0).every((v: any) => !Array.isArray(v) || v.every((x: number) => x === 0)),
    'in the cover\'s deal a far opening is worth more to the Mk 12 and the Mk 46 man, less to a man with a pistol alone (and half as much less to an MP7), nothing either way to a carbine — and nothing to anybody with the switch off', `an opening at 2 m / 9 m — Mk 12 ${L.mk12.map(f2).join(' / ')} · Mk 46 ${L.mk46.map(f2).join(' / ')} · issue ${L.fn2000.map(f2).join(' / ')} · MP7 ${L.mp7.map(f2).join(' / ')} · pistol alone ${L.guard9mm.map(f2).join(' / ')} (the deal's scale: a kept opening is worth 1.2)`);
  F.verdict(L.went ? L.role === 'reach' && L.slung[0] > 0 && L.str === 0 : true, 'with his sidearm out after a dry primary a Mk 12 man is still the Mk 12 man for the stack and the cover — and the trigger in his hands is the pistol\'s', L.went ? `sidearm out · role ${L.role} · far opening ${f2(L.slung[0])} · string ${L.str}` : 'the two gun slots are held off on this stand (TPS_GUNSLOTS): no sidearm comes out, nothing to ask');
  return F.done();
}
// ───────────────────────────────────────────────────────────── off
export async function gunrolesOff(): Promise<boolean> {
  const F = family('gunroles-off: the switch off is the build before; on, the cast is dealt');
  const run = async (on: boolean, keys: Partial<typeof GUNROLES> = {}) => withSwitch(on, async () => {
    const R: any = await hushed(() => rig(17, { stage: false })); const g = R.game; await hushed(() => R.RC.start(17)); const hashes: string[] = [];
    for (let i = 0; i < 600; i++) { R.step(); if (i % 150 === 149) hashes.push(hashDigest(digestGame(g, true))); }
    return { hashes, guns: [...new Set(R.hostiles.map((h: any) => h.weapon.def.id as string))].sort() }; }, keys);
  const off = await run(false), bare = await run(true, { deal: false }), on = await run(true);
  F.verdict(J(off.guns) === J(['aks74u']) && J(off.hashes) === J(bare.hashes), 'ten seconds of the staged room clear with the switch off: every defender carries the short carbine; on, with the deal\'s key off and the squad\'s cards as issued, the run digests the same — no squad rule answers differently until a card names another gun', `off:              ${off.hashes.join(' ')} (${off.guns.join(' ')})\n    on, nobody dealt: ${bare.hashes.join(' ')} (${bare.guns.join(' ')})`);
  F.verdict(on.guns.length > 1, 'on, the same cast carries more than the one row', `on: ${on.hashes.join(' ')} (${on.guns.join(' ')})`);
  const reg = knobRegistry(), page = /GUNROLES\.on = !q\.has\('nogunroles'\)/.test(await Bun.file(`${ROOT}/src/host/profile.ts`).text());
  F.verdict('GUNROLES.on' in FROZEN_HOLDS && reg.GUNROLES === GUNROLES && page, 'the switch is one of the two stands\' rows, in the knob registry, and the page writes it on unless ?nogunroles', `frozen hold: ${(FROZEN_HOLDS as any)['GUNROLES.on']} · registered ${reg.GUNROLES === GUNROLES} · pageSwitches writes it: ${page}`);
  const R: any = await hushed(() => rig(17, { stage: false })); GUNROLES.on = true; const snap = knobsSnapshot(R.game); const has = !!snap.tables.GUNROLES; delete snap.tables.GUNROLES; applyKnobs(R.game, snap); const after = GUNROLES.on; Object.assign(GUNROLES, DEFAULTS);
  GUNROLES.on = true; const snap2 = knobsSnapshot(R.game); const carries = (snap2.tables.GUNROLES as any)?.captor === false; delete (snap2.tables.GUNROLES as any).captor; applyKnobs(R.game, snap2); const day = GUNROLES.captor; Object.assign(GUNROLES, DEFAULTS);   // (a file of the day the hostage holder was dealt a pistol: the table without the key)
  F.verdict(has && after === false && carries && day === true, 'a recording carries the table, and one from before it replays with the switch off — one from the day the man with a hostage was dealt a pistol replays with him dealt one', `carried ${has} · after a file without it: on = ${after} · the captor key carried ${carries} · after a file without the key: captor = ${day}`);
  return F.done();
}

if (import.meta.main) {
  const which = process.argv[2] ?? 'all', fams: Record<string, () => Promise<boolean>> = { deal: gunrolesDeal, entry: gunrolesEntry, fight: gunrolesFight, lanes: gunrolesLanes, off: gunrolesOff };
  let ok = true; for (const [k, fn] of Object.entries(fams)) if (which === 'all' || which === k) ok = (await fn()) && ok;
  console.log(`\n${ok ? 'gunroles-check: ALL PASS' : 'gunroles-check: FAILURES above'}`); process.exit(ok ? 0 : 1);
}
