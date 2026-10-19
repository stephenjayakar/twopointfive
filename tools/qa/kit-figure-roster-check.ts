// THE MAN ON THE KIT SCREEN IS THE MAN THE MISSION STANDS UP: for every kind of mission with teammates, the cast variant the Team & kit figure shows for each
// roster place (ui/kitFigure.ts figureMan) is the variant the staged game hands that teammate (game/cast.ts castVariantOf), and the screen's roster names him.
// A rescue stands its captors up before the team, which used to move every teammate's id — and his face with it — off the figure's.
//   bun run tools/qa/kit-figure-roster-check.ts        exit 0 = all pass, 1 = a FAIL
//   ROSTER_BREAK=1 …                                    = the mission's man taken by the old deal (his id, which a rescue's captors move): must fail
// …AND HE HOLDS HIS GUN AS THE MISSION'S MAN DOES (game/inhand.ts INHAND, the figure's own bake: ui/kitFigure.ts `hold`): for every gun pose the screen draws — you
// and a teammate, the rifle, the carbine, both pistols — the figure is told the word the game's drawer says of his right hand, the grip is in the hollow of that
// hand (inhand-check's own tolerances: 1.5 cm a long gun, 2.4 cm and 3° a pistol), a long gun and the hand on its fore-end are where they were without the rule,
// and with the rule off the figure says no word. Both stands (the tool raises the switch itself).
// …AND SO WITH A GUN THAT IS A MODEL OF ITS OWN (game/gunlook.ts GUNLOOK, raised here with the two slots' switches): a pose per model — the Mk 12, MP7, Mk 46
// and M1014 by the pistol grip of the model (its `grip` part), the HK45 and Glock 18 by the pistol group's — under the same rows, and the hand on the fore-end
// is laid by the model's own hold.
//   KITFIGHAND_BREAK=1 …                                = the figure laid out without the word: must fail
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { standUp } = await import(`${ROOT}/tools/qa/headless.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { castVariantOf } = await import(`${ROOT}/src/game/cast.ts`);
const { castSide } = await import(`${ROOT}/src/anim/gltf.ts`);
const { rosterOf } = await import(`${ROOT}/src/game/loadout.ts`);
const { figureMan } = await import(`${ROOT}/src/ui/kitFigure.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { figureHold } = await import(`${ROOT}/src/ui/kitFigure.ts`);
const { loadCastOf } = await import(`${ROOT}/tools/qa/headless.ts`);
const { kitDefault } = await import(`${ROOT}/src/game/kit.ts`);
const { lookDress } = await import(`${ROOT}/src/scene/look.ts`);
const { INHAND } = await import(`${ROOT}/src/game/inhand.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const { GUNLOOK, longModel, pistolModel } = await import(`${ROOT}/src/game/gunlook.ts`);
const { GUNSLOTS } = await import(`${ROOT}/src/game/gunslots.ts`);
const { BIGSLOT } = await import(`${ROOT}/src/game/kit.ts`);

const brk = process.env.ROSTER_BREAK === '1';
let failed = false, checks = 0;
const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; console.error = e; } };

// [what it is, the level file (null = the office), the mission's query, teammates]
const RUNS: [string, string | null, string, number][] = [
  ['room clear, the four', null, 'roomclear&squad4', 4],
  ['room clear, the pair', null, 'roomclear', 2],
  ['hostage rescue (office), the pair', null, 'rescue', 2],
  ['hostage rescue (office), four', null, 'rescue&squad=4', 4],
  ['the registry (rescue), four', 'registry.json', 'rescue&squad=4', 4],
  ['the consulate (rescue), four', 'consulate.json', 'rescue&squad=4', 4],
  ['quiet, as two', 'quiet-yard.json', 'quiet&squad=1', 1],
];
const knobs0 = knobsCopy();
for (const [what, file, query, n] of RUNS) {
  const level = file ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) : undefined;
  const W: any = await quiet(() => standUp({ uploadEvery: 4, cast: true, level, seed: 3 }));
  const g = W.game, res = await quiet(() => startFromQuery(g, query));
  await quiet(() => { for (let i = 0; i < 20; i++) W.step(1 / 60); });
  const team = g.guards.filter((x: any) => x.unit && x.team === 'operative'), cast = g.ch.cast;
  if (res.why || !cast || team.length !== n) { line(false, `${what}: staged with ${team.length} teammates of ${n}${res.why ? ` (${res.why})` : ''}${cast ? '' : ' — no cast loaded'}`); knobsBack(knobs0); continue; }
  const ops = castSide(cast, 'operator'), roster = rosterOf(n);
  const off: string[] = [];
  team.forEach((gd: any, i: number) => { const game = (brk ? ops[1 + gd.char.id % (ops.length - 1)] : castVariantOf(g, gd.char))?.name, fig = figureMan(cast, i + 1)?.name;
    if (game !== fig) off.push(`${gd.callsign} (id ${gd.char.id}) is ${game} in the mission, ${fig} on the screen`);
    if (roster[i]?.name !== gd.callsign) off.push(`place ${i + 1} is ${roster[i]?.name} on the screen, ${gd.callsign} in the mission`); });
  if (castVariantOf(g, g.player.char) !== figureMan(cast, 0)) off.push('you are another man on the screen');
  const names = new Set([castVariantOf(g, g.player.char)?.name, ...team.map((gd: any) => castVariantOf(g, gd.char)?.name)]);
  if (names.size !== Math.min(n + 1, ops.length)) off.push(`two of the team wear one variant (${[...names].join(' ')})`);
  line(off.length === 0, `${what}: the screen's man is the mission's for all ${n} (ids ${team.map((gd: any) => gd.char.id).join(' ')})${off.length ? '\n    ' + off.join('\n    ') : ''}`);
  knobsBack(knobs0);
}

// ------------------------------------------------------------ the hand on the grip
{ type V3 = [number, number, number];
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
  const qrot = (q: number[], v: V3): V3 => { const [x, y, z, w] = q, ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0]; return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
  /** a joint of the DRAWN skeleton, world (the look-only pass may have moved it off the simulation's) */
  const joint = (c: any, node: number): V3 => { const w = c.world, p = c.skel.nodePos(node); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
  /** the hollow of the right fist, as inhand-check has it */
  const hollow = (c: any): V3 => { const h = joint(c, c.anim.nodes.handR), hf = c.handFrameR(); return [0, 1, 2].map(i => h[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03) as V3; };
  const handBrk = process.env.KITFIGHAND_BREAK === '1', knobs1 = knobsCopy(), cm = (x: number) => (x * 100).toFixed(1), G0 = [GUNLOOK.on, GUNSLOTS.on, BIGSLOT.on];
  const casts = await quiet(async () => ({ own: await loadCastOf(lookDress()), other: await loadCastOf(!lookDress()) }));
  interface Hold { rig: string; long: boolean; model: string | null; word: string; gap: number; across: number; gun: string; grip: V3; wristR: V3; wristL: V3 }
  /** the figure built with the rule as `rule`, his idle played two seconds: the worst of every frame, and where things were on the first */
  const hold = (member: number, card: any, rule: boolean): Hold | null => { INHAND.on = rule; let r: Hold | null = null;
    figureHold(casts, { member, squad: 4, suit: false, look: lookDress(), card }, 2, (c: any, bx: any[], meta: any[]) => {
      const gm = meta.find(x => /^(sc20k|carbine|pistol|guardPistol)\.grip$/.test(x.path));
      if (!gm) {   // (a long gun that is a model of its own: no nodes — its boxes are the tagged run as long as its part table, the grip the part that says so)
        const id = c.gunLook?.hand, L = longModel(id), gi = L ? L.parts.findIndex((p: any) => p.is === 'grip') : -1; if (!L || gi < 0) return;
        const N = L.parts.length, tag = (i: number) => bx[i]?.name === 'gunmodel'; let i0 = -1;
        for (let i = 0; i + N <= bx.length && i0 < 0; i++) if (tag(i) && !tag(i - 1)) { let k = 0; while (tag(i + k)) k++; if (k === N) i0 = i; }
        if (i0 < 0) return;
        const n = c.anim.nodes, gap = len(sub(bx[i0 + gi].c, hollow(c)));
        r ??= { rig: id, long: true, model: id, word: c.inHand?.kind ?? 'none', gap: 0, across: 0, gun: JSON.stringify(bx.slice(i0, i0 + N).map((b: any) => [b.c, b.h, b.rot])), grip: [...bx[i0 + gi].c] as V3, wristR: joint(c, n.handR), wristL: joint(c, n.handL) };
        r.gap = Math.max(r.gap, gap); return; }
      const rig = gm.path.split('.')[0], grp = meta.find(x => x.path === rig), sl = meta.find(x => x.path === rig + '.slide'), n = c.anim.nodes;
      const gap = len(sub(bx[gm.boxStart].c, hollow(c))); let across = 0;
      if (sl && bx[sl.boxStart]?.rot) { const b = bx[sl.boxStart], ax = (b.h[0] >= b.h[1] && b.h[0] >= b.h[2] ? [1, 0, 0] : b.h[1] >= b.h[2] ? [0, 1, 0] : [0, 0, 1]) as V3; across = Math.acos(Math.min(1, Math.abs(dot(qrot(b.rot, ax), c.gripFrameR().bore)))) * 180 / Math.PI; }
      const pm = pistolModel(c.gunLook?.hand), drawn = pm && Math.abs(bx[gm.boxStart].h[0] - pm.grip.thick) < 1e-6 ? c.gunLook.hand : null;   // (a hand gun's model lies in the pistol group it stands in for: its own grip's size says it is the one drawn)
      r ??= { rig, long: rig === 'sc20k' || rig === 'carbine', model: drawn, word: c.inHand?.kind ?? 'none', gap: 0, across: 0, gun: JSON.stringify(bx.slice(grp.boxStart, grp.boxStart + grp.boxCount).map((b: any) => [b.c, b.h, b.rot])), grip: [...bx[gm.boxStart].c] as V3, wristR: joint(c, n.handR), wristL: joint(c, n.handL) };
      r.gap = Math.max(r.gap, gap); r.across = Math.max(r.across, across); });
    return r; };
  const card = (i: number, o: any = {}) => ({ ...kitDefault(i), ...o });
  const POSES: [string, number, any][] = [
    ['you, the rifle', 0, card(0)], ['you, the pistol', 0, card(0, { weapon: 'pistol' })],
    ['a teammate, the quiet rifle', 1, card(1, { weapon: 'rifle', suppressed: true })], ['a teammate, the loud rifle', 1, card(1, { weapon: 'rifle', suppressed: false })], ['a teammate, the shotgun', 2, card(2, { weapon: 'shotgun' })],
    ['a teammate, the quiet pistol', 3, card(3, { weapon: 'pistol', suppressed: true })], ['a teammate, the loud pistol', 4, card(4, { weapon: 'pistol', suppressed: false })],
  ];
  // the guns with a model of their own, one pose each (and yours with the belt-fed: the fitted hold)
  const MODELS: [string, number, any, string][] = [
    ['a teammate, the Mk 12', 1, card(1, { weapon: 'rifle', primary: 'mk12' }), 'mk12'], ['a teammate, the MP7', 2, card(2, { weapon: 'rifle', primary: 'mp7' }), 'mp7'],
    ['a teammate, the Mk 46', 3, card(3, { weapon: 'rifle', primary: 'mk46' }), 'mk46'], ['a teammate, the M1014', 4, card(4, { weapon: 'rifle', primary: 'm1014' }), 'm1014'],
    ['you, the Mk 46', 0, card(0, { weapon: 'rifle', primary: 'mk46' }), 'mk46'],
    ['a teammate, the HK45', 3, card(3, { weapon: 'pistol', secondary: 'hk45' }), 'hk45'], ['a teammate, the Glock 18', 4, card(4, { weapon: 'pistol', secondary: 'g18' }), 'g18'],
  ];
  const fit = KITANIM.on && KITANIM.grips;
  for (const [what, member, c, model] of [...POSES, ...MODELS] as [string, number, any, string?][]) {
    const own = !!model; GUNLOOK.on = own || G0[0]; GUNSLOTS.on = own || G0[1]; BIGSLOT.on = own || G0[2];   // (the old cards on the stand as it stands)
    const off = hold(member, c, false), on = hold(member, c, !handBrk);
    if (!off || !on) { line(false, `${what}: no figure, or no gun in his hands`); continue; }
    const long = on.long, fitted = member === 0 && long && fit;   // (yours under kit handling: the GUN is drawn into the hand, GRIPFIT — the game says no word then)
    const want = !long ? 'pistol' : fitted ? 'none' : 'long', moved = len(sub(on.grip, off.grip)), handR = len(sub(on.wristR, off.wristR)), handL = len(sub(on.wristL, off.wristL));
    const ok = off.word === 'none' && on.word === want && (!own || on.model === model) && (long ? on.gap <= 0.015 && on.gun === off.gun && handL <= 0.001 && (fitted || off.gap > 0.035) : on.gap <= 0.024 && on.across <= 3);
    line(ok, `${what} (${on.rig}${own ? on.model === model ? ', its own model' : `, NOT drawn as the ${model}` : ''}): the word is '${on.word}'${on.word === want ? '' : ` (the game says '${want}')`}, grip to the fist's hollow ${cm(off.gap)} cm without the rule → ${cm(on.gap)} cm` +
      (long ? ` · the gun ${on.gun === off.gun ? 'where it was' : 'MOVED'}, the trigger hand moved ${cm(handR)} cm, the hand on the fore-end ${(handL * 1000).toFixed(1)} mm${fitted ? ' (fitted into the hand by kit handling, as in the game)' : ''}`
        : ` · ${on.across.toFixed(1)}° across the hand, the gun moved ${cm(moved)} cm into it`)); }
  // the hand on the fore-end is laid as the game lays it: yours by kit handling's fitted hold (player.ts), a teammate's by the plain one (game.ts) — his rifle is drawn unfitted
  const { sc20kGrip, modelGrip } = await import(`${ROOT}/src/game/rigProps.ts`);
  for (const [what, member, c, id] of [['you, the rifle', 0, card(0), null], ['a teammate, the quiet rifle', 1, card(1, { weapon: 'rifle', suppressed: true }), null],
    ['you, the MP7', 0, card(0, { weapon: 'rifle', primary: 'mp7' }), 'mp7'], ['a teammate, the Mk 46', 3, card(3, { weapon: 'rifle', primary: 'mk46' }), 'mk46']] as [string, number, any, string | null][]) {
    let got: any = null; INHAND.on = true; GUNLOOK.on = id ? true : G0[0]; GUNSLOTS.on = id ? true : G0[1]; BIGSLOT.on = id ? true : G0[2];
    figureHold(casts, { member, squad: 4, suit: false, look: lookDress(), card: c }, 0, (ch: any) => { got ??= ch.anim.longGrip; });
    const fitted = member === 0 && fit, want = id ? modelGrip(id, fitted) : sc20kGrip(undefined, fitted), off = got && want ? len(sub(got.wrist, want.wrist)) : NaN;
    line(!!got && off < 1e-6, `${what}: the hand on the fore-end is laid by the ${id ? "model's " : ''}${fitted ? 'fitted' : 'plain'} hold, as the game lays it (${got ? cm(off) + ' cm off it' : 'no long gun in his hands'})`); }
  knobsBack(knobs1);
}
console.log(failed ? `=== kit-figure-roster-check: FAIL ===` : `=== kit-figure-roster-check: ALL PASS (${checks}) ===`);
process.exit(failed ? 1 : 0);
