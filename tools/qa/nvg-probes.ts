// The 'nvg' family: THE TEAM'S NIGHT VISION (the maintainer, 10-06: "the squad members should have night vision and use it accordingly. this could either be
// following your lead or knowing when they haven't been compromised and flashlight would ruin that" · "but the lights make sense too, especially when things
// are loud" · "ready or not is a good base case here"). The rule is game/nvg.ts; this family is its check. Run through probes.ts:
//   bun run tools/qa/probes.ts nvg | nvg-quiet | nvg-lead | nvg-loud | nvg-sight | nvg-fight | nvg-rig | nvg-off
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each row's own level; nothing is drawn). THE SCENARIOS are scene/scenarioList.ts
// SCENARIOS, row by row, each started as a click on its row starts it (bang-tally.ts stage()).
//   nvg-quiet   NOT COMPROMISED, IN THE DARK: every scenario with the floor emptied of hostiles (nothing but the rule decides), the team told to fall in and then
//               sent to stack on a held room's door — the walk af55d89 lit ("a pair sent down a dark corridor"). The team is 'dark' the whole way, no weapon
//               light burns but a man's whom the tube shows nothing (no light of the place at all somewhere he is looking: nvg.ts blackAt — the log line says
//               so), and every unlit man in a dim place has his goggles down (a moonlit lot is not dim: bare eyes, no light). The same walk with NVG.on false shows the old picture: lights, no goggles.
//   nvg-lead    FOLLOWING SAM'S LEAD, both ways. His goggles down and his light off on a floor that has just gone LOUD: the team stays dark all the same, not
//               one light, black places included. His own weapon light on, on a quiet floor: theirs are free again (the light rule's picture, as with the
//               switch off), and dark again a moment after he puts it out. NVG.lead false: his goggles decide nothing.
//   nvg-loud    ITS OWN JUDGEMENT. A charge goes off in the team's ears: 'compromised' inside a frame, the walk is lit again by the light rule, a lit man's
//               goggles come up. NVG.quietSecs of quiet later the team goes dark again and one of them says so. An alarm on the floor does the same as the
//               charge. NVG.own false: no judgement of its own (lights by the light rule).
//   nvg-sight   WHAT THE GOGGLES DO, through the one sight function (guards.ts sightGainOn). The tube's curve is the picture's own (post.wgsl's lines are
//               still the ones nvg.ts copies), monotone, nothing from nothing. Then every living hostile of every scenario where he stands, at eight metres:
//               the same eye with goggles down against bare — hostiles a bare eye has no real sighting of and the tube does must exist, the tube never sees
//               LESS, a man in a place with no light at all is as unseen as before, a man with his goggles up gains nothing, and a hostile's eye is the same
//               with the switch on or off (they have none).
//   nvg-fight   END TO END: Sam's goggles down (the team dark whatever happens), the team sent through a held door with the room's men alive, every
//               scenario. Not one weapon light burns from start to finish, and the team still takes targets: counted, the ones it could only have taken
//               through the tube (the fight's own sight test on that frame says a real sighting with the goggles and none without).
//   nvg-rig     ON THE MAN: every living teammate's rig has the goggles' four boxes (down over the eyes and glowing when they are down, parked on the
//               forehead and dim when up), no hostile has any, and with the switch off nobody has.
//   nvg-off     THE SWITCH: NVG.on false is the module absent — no state, no goggles, no sight term, nothing said — and the Tab panel's rows are kept by
//               teamfeel.ts like the others. (The frame-for-frame identity against af55d89 is `bun run tools/qa/nvg-probes.ts digest`: it prints one hash per
//               scenario of a scripted minute with the switch off; the same file copied into a checkout of af55d89 must print the same lines.)
//               Not frozen as a fixture: the per-frame digests frozen elsewhere in this harness do not reproduce from one machine's maths library to
//               another's (needs-identity's does not on linux), so the two checkouts are run side by side on the same machine instead.
// The family's own red path: NVG_BREAK=1 bun run tools/qa/probes.ts nvg-quiet must FAIL (the rule switched off under the probe).
import { readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { stage, setKnobs, hasKnobs } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const RFT: any = await import(`${ROOT}/src/game/roomfight.ts`);
const CVM: any = await import(`${ROOT}/src/game/cover.ts`).catch(() => null);   // (a checkout from before the cover: no table to pin)
const ORM: any = await import(`${ROOT}/src/game/orders.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const DGM: any = await import(`${ROOT}/src/game/digin.ts`).catch(() => null);   // (the dig-in: `digest` pins its later default-on brace rule off where the checkout has it)
const GEARM: any = await import(`${ROOT}/src/game/gear.ts`).catch(() => null);   // (the 2010s issue kit, where the checkout has it: its goggles are six boxes and dark)
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`).catch(() => null);   // (null in a checkout from before the module: only `digest` runs there)
const RWM: any = await import(`${ROOT}/src/game/rearwatch.ts`).catch(() => null);   // (the stack's rear man on the door behind: a later default-on switch the shipped stand raises at every stand-up, so `digest` pins it off AFTER the stage, where the checkout has it)
const NVG: any = NVM?.NVG ?? { on: false };

const VERBOSE = process.argv.includes('--verbose');
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const NVG_DEFAULTS = JSON.parse(JSON.stringify(NVG));
// (bang-tally.ts stage() puts every knob table back to the build's own before each staging: an override goes through its setKnobs — and is taken off the
//  table here as well, for the game already standing)
const reset = () => { setKnobs({}); Object.assign(NVG, JSON.parse(JSON.stringify(NVG_DEFAULTS))); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => x.toFixed(2);
const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(0)} %` : '-';
const IDS: string[] = (SCENARIOS as any[]).map(e => e.id);

// ---------------------------------------------------------------- the staging the first three probes share
/** what the floor is made to be before the walk: `loud` = a charge let off twelve metres from Sam (in every teammate's ears), `nv` = Sam's goggles down,
 *  `light` = Sam's pistol up with its light burning, `alarm` = the floor's alarm up a step */
interface Prep { loud?: boolean; nv?: boolean; light?: boolean; alarm?: boolean }
interface Walk {
  team: number; frames: number; modes: Map<string, number>;
  /** man-frames on the way to a post (further than the light rule's onM from it) · of them: light on · goggles down */
  walk: number; lit: number; gog: number;
  /** man-frames with a light on that the rule did not call black · man-frames unlit in a place the probe's own reading calls dim, and of them goggles down ·
   *  the longest run of frames one man had his light on AND his goggles down */
  litNotBlack: number; dimUnlit: number; dimUnlitGog: number; both: number;
  log: string[]; said: string[]; door: string;
}
const samLight = (g: any, on: boolean) => { const pl = g.player; if (on) { pl.slot = 'pistol'; pl.holstered = false; } pl.pistol.lightOn = on; };
const bang = (g: any) => { const p = g.player.char.pos; g.events.push({ kind: 'bang', pos: [p[0] + 12, 1, p[2]], time: g.time, loud: true }); };
const modeOf = (g: any): string => { const st = NVM.nvgState(g); return st.mode === 'off' ? 'off' : `${st.mode}/${st.why}`; };
/** a scenario with every hostile taken off the floor and the team fallen in on Sam — nothing but the orders and the rule decides what follows */
async function emptied(scn: string) {
  const S: any = await quiet(() => stage(scn, 1)); const { g, step } = S; const O = g.orders;
  const cands: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!cands.some(c => c.ent === e)) cands.push({ ent: e, dist: flat(g.player.char.pos, e.at) });
  cands.sort((a, b) => a.dist - b.dist);
  for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead') await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'); const sam = g.player.char.pos;
  step(60 * 6);   // (the hand-off's own noise is out of everybody's ears)
  await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); step(60 * 3);
  return { ...S, O, team, cands, sam };
}
/** the walk: the team sent to stack on the nearest held room's door it can be sent to, watched until every man is there (and three seconds on the stack) */
async function walk(X: any, prep: Prep): Promise<Walk | null> {
  const { g, step, O, team } = X; NVM.NVG_LOG.length = 0;
  if (prep.nv) g.player.nv = true;
  if (prep.light) samLight(g, true);
  if (prep.alarm) await quiet(() => GDM.raiseEscalation(g, 1));
  if (prep.loud) bang(g);
  step(prep.light ? 30 : 3);   // (the pistol comes up before its light is one)
  const R: Walk = { team: team.length, frames: 0, modes: new Map(), walk: 0, lit: 0, gog: 0, litNotBlack: 0, dimUnlit: 0, dimUnlitGog: 0, both: 0, log: [], said: [], door: '' };
  const feet = (x: any) => g.visibilityOf(NVM.nvgPlaceLight(g, [x.char.pos[0], 1.2, x.char.pos[2]]));   // (the place's own light under him, the moon included: the rule's own reading, taken afresh)
  const run = new Map<any, number>(), dimRun = new Map<any, number>();
  const watch = () => {
    R.frames++; const m = modeOf(g); R.modes.set(m, (R.modes.get(m) ?? 0) + 1); const st = NVM.nvgState(g);
    for (const x of team) { if (x.state === 'dead') continue;
      const lit = !!x.flashlight?.enabled, gog = NVM.nvgDown(g, x), A = O.of(x), black = !!st.men.find((q: any) => q.gd === x)?.black;
      if (A?.post && flat(x.char.pos, A.post) >= GDM.LIGHTS.onM + 0.4) { R.walk++; if (lit) R.lit++; if (gog) R.gog++; }
      if (lit && !black) R.litNotBlack++;
      const b = lit && gog ? (run.get(x) ?? 0) + 1 : 0; run.set(x, b); R.both = Math.max(R.both, b);
      const d = !lit && feet(x) < NVG.darkAt * 0.8 ? (dimRun.get(x) ?? 0) + 1 : 0; dimRun.set(x, d);
      if (d > 60 * (NVG.downSecs + 0.5) + 2) { R.dimUnlit++; if (gog) R.dimUnlitGog++; }   // (past the half second his reading of the place may be old and the moment the flip takes)
    }
  };
  let why: string | void = 'no door';
  for (const c of X.cands) { why = await quiet(() => O.give('stack', O.targetAt(c.ent.door.frameCentre), 'all')); if (!why) { R.door = c.ent.door.def.name; break; } }
  if (why) return null;
  for (let f = 0; f < 60 * 30; f++) { step(); watch(); if (team.every((x: any) => x.state === 'dead' || O.of(x)?.arrived)) break; }
  for (let f = 0; f < 180; f++) { step(); watch(); }
  R.log = NVM.NVG_LOG.map((n: any) => `${n.who} ${n.what}`);
  return R;
}
/** Sam's light on and the team sent to a door: the first man seen walking with his light on and his goggles up, on that frame (null: nobody in 20 s) */
async function litWalker(X: any): Promise<any | null> {
  const { g, step, O, team } = X; samLight(g, true); step(30);
  for (const c of X.cands) if (!(await quiet(() => O.give('stack', O.targetAt(c.ent.door.frameCentre), 'all')))) break;
  for (let f = 0; f < 60 * 20; f++) { step(); const m = team.find((x: any) => x.state !== 'dead' && x.flashlight?.enabled && !NVM.nvgDown(g, x)); if (m) return m; }
  return null;
}
const modes = (R: Walk) => [...R.modes].map(([m, n]) => `${m} ${pct(n, R.frames)}`).join(', ');
const only = (R: Walk, m: string, slack = 3) => R.frames - (R.modes.get(m) ?? 0) <= slack;

// ---------------------------------------------------------------- nvg-quiet
export const nvgQuiet = guarded(async () => {
  const F = family('nvg-quiet: not compromised and in the dark, the team walks on its goggles — no light but where the tube has nothing');
  if (process.env.NVG_BREAK) console.log('  (NVG_BREAK: the rule is OFF under this probe — it must FAIL)');
  let cleanDark = 0, oldLit = 0;
  for (const id of IDS) {
    setKnobs(process.env.NVG_BREAK ? { NVG: { on: false } } : {}); const on = await walk(await emptied(id), {}); reset();
    setKnobs({ NVG: { on: false } }); const off = await walk(await emptied(id), {}); reset();
    if (!on || !off) { F.verdict(false, `${id}: a door to walk to`, 'no held room\'s door took the stack order'); continue; }
    const tubeless = on.log.filter(l => l.includes('too dark for the tube')).length;
    if (on.lit === 0 && on.dimUnlit > 0) cleanDark++; if (off.lit > 0) oldLit++;
    F.verdict(on.walk > 60 && only(on, 'dark/not compromised') && on.litNotBlack === 0 && on.dimUnlitGog >= 0.97 * on.dimUnlit && on.both <= 60 * NVG.upSecs + 12,
      `${id}: dark to the door (${on.door})`,
      `${on.team} men · ${modes(on)} · walking man-frames ${on.walk}: lit ${pct(on.lit, on.walk)}, goggles down ${pct(on.gog, on.walk)} · lit where the tube had something: ${on.litNotBlack} · unlit in a dim place: goggles down ${pct(on.dimUnlitGog, on.dimUnlit)} of ${on.dimUnlit}${tubeless ? ` · ${tubeless}× 'too dark for the tube' (no light of the place there at all)` : ''}\n    switch off, same walk: lit ${pct(off.lit, off.walk)} of ${off.walk}, goggles down ${off.gog}, ${modes(off)}`);
    F.verdict(only(off, 'off', 0) && off.gog === 0 && off.dimUnlitGog === 0 && off.log.length === 0, `${id}: the switch off — no goggles, no rule`, `${modes(off)} · goggles man-frames ${off.gog} · log lines ${off.log.length}`);
  }
  F.verdict(cleanDark >= 4 && oldLit >= 4, 'not vacuous: most floors are walked with no light at all and the goggles down, and the same walks were lit before',
    `${cleanDark} of ${IDS.length} scenarios with not one lit man-frame on the walk and goggled man-frames in the dim · ${oldLit} of ${IDS.length} lit on the same walk with the switch off`);
  return F.done();
});

// ---------------------------------------------------------------- nvg-lead
export const nvgLead = guarded(async () => {
  const F = family('nvg-lead: Sam\'s goggles keep the team dark through anything; Sam\'s light frees theirs');
  let litFree = 0;
  for (const id of IDS) {
    const dark = await walk(await emptied(id), { loud: true, nv: true });
    const X = await emptied(id); const free = await walk(X, { light: true }); const samLit = !!X.g.player.light.enabled;
    setKnobs({ NVG: { on: false } }); const off = await walk(await emptied(id), { light: true }); reset();
    if (!dark || !free || !off) { F.verdict(false, `${id}: a door to walk to`, 'no held room\'s door took the stack order'); continue; }
    F.verdict(dark.walk > 60 && only(dark, 'dark/your goggles') && dark.lit === 0 && dark.litNotBlack === 0 && dark.dimUnlitGog >= 0.97 * dark.dimUnlit,
      `${id}: his goggles down, a charge just gone off — dark all the same`,
      `${modes(dark)} · walking man-frames ${dark.walk}: lit ${dark.lit}, goggles down ${pct(dark.gog, dark.walk)} · unlit in a dim place: goggles down ${pct(dark.dimUnlitGog, dark.dimUnlit)} of ${dark.dimUnlit}`);
    if (free.lit > 0) litFree++;
    F.verdict(samLit && only(free, 'free/your light') && free.lit === off.lit && free.walk === off.walk && free.both <= 60 * NVG.upSecs + 12,
      `${id}: his light on — theirs are the light rule's again, as with the switch off`,
      `Sam's light ${samLit ? 'burning' : 'NOT burning (the probe could not light it)'} · ${modes(free)} · walking man-frames ${free.walk}: lit ${free.lit} (switch off: ${off.lit} of ${off.walk}) · longest light-and-goggles overlap ${free.both} frames`);
    // …and out again: dark a moment after
    samLight(X.g, false); X.step(Math.round(60 * (NVG.leadTail + 1.5)));
    const after = modeOf(X.g), lit = X.team.filter((x: any) => x.flashlight?.enabled && !NVM.nvgState(X.g).men.find((q: any) => q.gd === x)?.black).length;
    F.verdict(after === 'dark/not compromised' && lit === 0, `${id}: his light out — dark again`, `${f2(NVG.leadTail + 1.5)} s after: ${after} · lights burning where the tube has something: ${lit}`);
  }
  F.verdict(litFree >= 4, 'not vacuous: with his light on the walks are lit', `${litFree} of ${IDS.length} scenarios with lit man-frames on the walk`);
  { setKnobs({ NVG: { lead: false } }); const r = await walk(await emptied(IDS[0]), { loud: true, nv: true }); reset();
    F.verdict(!!r && only(r, 'free/compromised'), 'NVG.lead false: his goggles decide nothing', r ? modes(r) : 'no walk'); }
  return F.done();
});

// ---------------------------------------------------------------- nvg-loud
export const nvgLoud = guarded(async () => {
  const F = family('nvg-loud: once the floor is loud the lights are the light rule\'s again; quiet long enough, the team goes dark and says so');
  let lit = 0;
  for (const id of IDS) {
    const X = await emptied(id); const r = await walk(X, { loud: true });
    setKnobs({ NVG: { on: false } }); const off = await walk(await emptied(id), { loud: true }); reset();
    if (!r || !off) { F.verdict(false, `${id}: a door to walk to`, 'no held room\'s door took the stack order'); continue; }
    if (r.lit > 0) lit++;
    F.verdict(only(r, 'free/compromised') && r.lit === off.lit && r.walk === off.walk && r.both <= 60 * NVG.upSecs + 12,
      `${id}: a charge in their ears — compromised, lights as the light rule has them`,
      `${modes(r)} · walking man-frames ${r.walk}: lit ${r.lit} (switch off: ${off.lit} of ${off.walk}), goggles down ${pct(r.gog, r.walk)} · longest light-and-goggles overlap ${r.both} frames`);
    // quiet again: NVG.quietSecs after the charge the team is dark, and somebody said so
    const { g, step, team } = X; let said = '', darkAt = NaN; const t0 = g.time, calls = new Set<string>();
    for (let f = 0; f < 60 * (NVG.quietSecs + 5); f++) { step(); for (const x of team) if (x.bubble?.text === 'going dark.' && g.time - x.bubble.t < 0.05) { said = x.callsign; calls.add(`${x.callsign}@${x.bubble.t}`); } if (isNaN(darkAt) && modeOf(g) === 'dark/not compromised') darkAt = g.time; }
    const burning = team.filter((x: any) => x.flashlight?.enabled && !NVM.nvgState(g).men.find((q: any) => q.gd === x)?.black).length;
    F.verdict(!isNaN(darkAt) && calls.size === 1 && burning === 0 && modeOf(g) === 'dark/not compromised', `${id}: ${NVG.quietSecs} s of quiet — dark again, and called once`,
      `dark ${isNaN(darkAt) ? 'never' : `${f2(darkAt - t0)} s after the walk`} · 'going dark.' from ${said || 'nobody'}${calls.size > 1 ? ` (${calls.size} CALLS)` : ''} · lights burning where the tube has something: ${burning}`);
  }
  F.verdict(lit >= 4, 'not vacuous: loud, the walks are lit', `${lit} of ${IDS.length} scenarios with lit man-frames on the walk`);
  { const r = await walk(await emptied(IDS[0]), { alarm: true });
    F.verdict(!!r && only(r, 'free/compromised'), 'an alarm on the floor compromises like a charge', r ? modes(r) : 'no walk'); }
  { setKnobs({ NVG: { own: false } }); const r = await walk(await emptied(IDS[0]), {}); reset();
    setKnobs({ NVG: { on: false } }); const off = await walk(await emptied(IDS[0]), {}); reset();
    F.verdict(!!r && !!off && only(r, 'free/no rule') && r.lit === off.lit, 'NVG.own false: no judgement of its own — lights by the light rule', r && off ? `${modes(r)} · lit ${r.lit} (switch off ${off.lit})` : 'no walk'); }
  return F.done();
});

// ---------------------------------------------------------------- nvg-sight
export const nvgSight = guarded(async () => {
  const F = family('nvg-sight: goggles down, a man in the dark is seen — by the picture\'s own tube, through the one sight function');
  // the tube's curve is the picture's
  { const src = readFileSync(`${ROOT}/src/render/shaders/post.wgsl`, 'utf8');
    const same = src.includes('var sig = log(1.0 + lum * g) / log(1.0 + g);') && src.includes('sig = sig + n * 0.16 * (1.0 - sig * 0.85);') && src.includes('color * frame.exposure');
    F.verdict(same, 'post.wgsl still has the tube nvg.ts copies', same ? 'the gain curve, the noise line and the exposure in front of them are where they were' : 'the shader\'s night-vision lines changed: nvg.ts tubeVis must follow them'); }
  const S: any = await quiet(() => stage(IDS[0], 1)); const g = S.g;
  { const Es = [0, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 50]; const vs = Es.map(E => NVM.tubeVis(g, E)); let mono = true; for (let i = 1; i < vs.length; i++) if (vs[i] < vs[i - 1] - 1e-9) mono = false;
    const floorE = g.tune.visFloor ?? 0.03, gain0 = g.engine.settings.nvGain; g.engine.settings.nvGain = gain0 / 8; const lowGain = NVM.tubeVis(g, 0.01); g.engine.settings.nvGain = gain0;
    F.verdict(mono && vs[0] === 0 && vs.every(v => v >= 0 && v <= 1) && NVM.tubeVis(g, floorE) > 0.4 && g.visibilityOf(floorE) < 0.01 && lowGain < NVM.tubeVis(g, 0.01),
      'the tube: nothing from nothing, monotone, and the bare eye\'s zero is plain to it',
      `E → through the tube: ${Es.map((E, i) => `${E}→${f2(vs[i])}`).join(' · ')} · at the meter's zero (E ${floorE}): bare ${f2(g.visibilityOf(floorE))}, tube ${f2(NVM.tubeVis(g, floorE))} · an eighth of settings.nvGain: 0.01→${f2(lowGain)}`); }
  // every hostile where he stands, at eight metres, to a goggled teammate
  let tubeOnly = 0, both = 0, neither = 0, black = 0, worse = 0, blackGain = 0, hostileDiff = 0, floors = 0; const lines: string[] = [];
  for (const id of IDS) {
    const X: any = id === IDS[0] ? S : await quiet(() => stage(id, 1)); const G = X.g; X.step(30);
    const eye = G.orders.squad().find((x: any) => x.state !== 'dead' && NVM.nvgDown(G, x)); if (!eye) { lines.push(`${id}: no goggled teammate`); continue; }
    let t = 0, b = 0, n = 0;
    for (const h of G.guards) { if (h.team !== 'hostile' || h.state === 'dead' || !h.unit) continue;
      NVG.on = true; const tube = GDM.sightGainOn(G, eye, h, 8), back1 = GDM.sightGainOn(G, h, eye, 8);
      NVG.on = false; const bare = GDM.sightGainOn(G, eye, h, 8), back0 = GDM.sightGainOn(G, h, eye, 8); NVG.on = true;
      if (tube < bare - 1e-12) worse++; if (back1 !== back0) hostileDiff++;
      if (h.irradiance <= 0) { black++; if (tube !== bare) blackGain++; }
      if (tube > 0.25 && bare <= 0.25) t++; else if (bare > 0.25) b++; else n++; }
    tubeOnly += t; both += b; neither += n; if (t) floors++;
    lines.push(`${id}: ${t} by the tube only · ${b} either way · ${n} by neither`);
  }
  F.verdict(tubeOnly >= 6 && floors >= 4 && worse === 0, 'hostiles in the dark at 8 m: no real sighting with a bare eye, one with the goggles down',
    `${tubeOnly} hostiles seen by the tube only (in ${floors} of ${IDS.length} scenarios) · ${both} seen either way · ${neither} by neither · the tube ever seeing less: ${worse}\n    ${lines.join('\n    ')}`);
  F.verdict(blackGain === 0, 'a man with no light on him at all is as unseen as before (headless: the direct light only — the page\'s meter adds the bounce)', `${black} hostiles reading E = 0 · of them the goggles changed the rate for ${blackGain}`);
  F.verdict(hostileDiff === 0, 'the other side has no night vision: a hostile\'s eye on a teammate is the same with the switch on or off', `${hostileDiff} pairs differed`);
  // goggles up = a bare eye
  { const X = await emptied(IDS[0]); const up = await litWalker(X); const G = X.g; const h = G.guards.find((x: any) => x.team === 'hostile');
    if (!up || !h) F.verdict(false, 'goggles up: a bare eye', 'no teammate walked with his light on and his goggles up');
    else { const o = { ...h, irradiance: 0.03, visibility: 0 }; F.verdict(NVM.nvgSight(G, up, o) === 0 && NVM.tubeVis(G, 0.03) > 0.4, 'goggles up: a bare eye', `${up.callsign}, goggles up: the tube's term on a man at E 0.03 is ${f2(NVM.nvgSight(G, up, o))} (down it would be ${f2(NVM.tubeVis(G, 0.03))})`); } }
  return F.done();
});

// ---------------------------------------------------------------- nvg-fight
export const nvgFight = guarded(async () => {
  const F = family('nvg-fight: Sam\'s goggles down, a held room taken with not one light on — the targets come through the tube');
  let tubeTotal = 0, takenTotal = 0, downTotal = 0;
  for (const id of IDS) {
    const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders, D = g.doorTools;
    g.player.nv = true; const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'); const sam = g.player.char.pos;
    const cands: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!cands.some(c => c.ent === e)) cands.push({ ent: e, dist: flat(sam, e.at) });
    cands.sort((a, b) => a.dist - b.dist);
    const before = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length;
    let lit = 0, taken = 0, tube = 0, frames = 0, notDark = 0; const last = new Map<any, any>();
    // (the rule is asked while a man of the team stands: with every teammate down there is no team to be dark, and the mode says so)
    const watch = () => { frames++; if (team.some(x => x.state !== 'dead') && modeOf(g) !== 'dark/your goggles') notDark++;
      for (const x of team) if (x.state !== 'dead' && x.flashlight?.enabled) lit++;
      for (const P of g.fight.ops) { const h = P.tgt; if (h && h !== last.get(P.gd) && h.state !== 'dead') { taken++;
          NVG.on = false; const bare = g.fight.sightOn(P.gd, h).sighting; NVG.on = true; const withTube = g.fight.sightOn(P.gd, h).sighting; if (withTube && !bare) tube++; }
        last.set(P.gd, h); } };
    await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) { step(); watch(); }
    let why: string | void = 'no door', fc: any = null;
    for (const c of cands) { fc = c.ent.door.frameCentre; why = await quiet(() => O.give('stack', O.targetAt(fc), 'all')); if (!why) break; }
    if (why) { F.verdict(false, `${id}: a door to stack on`, String(why)); continue; }
    for (let f = 0; f < 60 * 30; f++) { step(); watch(); if (team.every(x => x.state === 'dead' || O.of(x)?.arrived)) break; }
    for (let f = 0; f < 120; f++) { step(); watch(); }
    const sent = await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); let op: any = null, endT = NaN;
    for (let f = 0; f < 60 * 60; f++) { step(); watch(); op ??= D.ops[0] ?? null; if (op && !D.ops.includes(op) && isNaN(endT)) endT = g.time; if (!isNaN(endT) && g.time - endT > 8) break; }
    const alive = team.filter(x => x.state !== 'dead').length, down = before - g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length;
    tubeTotal += tube; takenTotal += taken; downTotal += down;
    F.verdict(lit === 0 && notDark <= 3, `${id}: dark from the first step to the last`,
      `${frames} frames · lit man-frames ${lit} · frames not 'dark/your goggles' ${notDark}${sent ? ` · the entry was refused (${sent}): the walk and the wait only` : ''} · targets taken ${taken}, ${tube} of them through the tube alone · hostiles down ${down} of ${before} · team standing ${alive} of ${team.length}`);
  }
  F.verdict(tubeTotal >= 3 && downTotal >= 3, 'not vacuous: men are found and dropped with no light burning, some of them only because of the goggles',
    `${takenTotal} targets taken over ${IDS.length} scenarios, ${tubeTotal} with a real sighting through the tube and none bare · ${downTotal} hostiles down`);
  return F.done();
});

// ---------------------------------------------------------------- nvg-rig
export const nvgRig = guarded(async () => {
  const F = family('nvg-rig: the goggles are on the man — down and glowing, up and dim; no hostile has any');
  for (const id of [IDS[0], IDS[IDS.length - 1]]) {
    const X = await emptied(id); const { g, team } = X; X.step(30);
    const boxes = () => { const out: any[] = []; CBM.handProps(g, out); return out; };
    const of = (bs: any[], gd: any) => bs.filter(b => b.owner === gd.char.id), glow = (bs: any[]) => bs.reduce((s, b) => s + (b.emissive ? b.emissive[0] + b.emissive[1] + b.emissive[2] : 0), 0);
    NVG.on = true; const on = boxes(); NVG.on = false; const off = boxes(); NVG.on = true;
    const hostiles = g.guards.filter((x: any) => x.team === 'hostile');
    const perMan = team.map((x: any) => of(on, x).length - of(off, x).length), hostileExtra = hostiles.reduce((s: number, x: any) => s + of(on, x).length - of(off, x).length, 0);
    const downMan = team.find((x: any) => NVM.nvgDown(g, x)); const downGlow = downMan ? glow(of(on, downMan)) - glow(of(off, downMan)) : NaN;
    const gear = !!GEARM?.GEAR.on, NB = gear ? 6 : 4;   // (the old cluster: four boxes, lenses lit · the two tubes: six, dark up or down)
    F.verdict(perMan.every((n: number) => n === NB) && hostileExtra === 0 && on.length - off.length === NB * team.length && !!downMan && (gear ? downGlow === 0 : downGlow > 0),
      `${id}: ${NB} boxes a teammate, none on anybody else`, `boxes with the rule on − off per teammate: ${perMan.join(', ')} · on hostiles: ${hostileExtra} · everything else: ${on.length - off.length - NB * team.length} · ${downMan?.callsign ?? 'nobody'} goggles down: lens glow ${f2(downGlow)}`);
    // up: after a lit walk the lit men's goggles are on the forehead, dimmer
    const upMan = await litWalker(X);
    if (!upMan) { F.verdict(false, `${id}: goggles up on the forehead`, 'no teammate walked with his light on and his goggles up'); continue; }
    NVG.on = true; const on2 = boxes(); NVG.on = false; const off2 = boxes(); NVG.on = true;
    const upGlow = glow(of(on2, upMan)) - glow(of(off2, upMan)), upN = of(on2, upMan).length - of(off2, upMan).length;
    F.verdict(upN === NB && upGlow >= 0 && (gear ? upGlow === 0 : upGlow < downGlow), `${id}: goggles up on the forehead, ${gear ? 'dark' : 'dimmer'}`, `${upMan.callsign} goggles up: ${upN} boxes, lens glow ${f2(upGlow)} (down ${f2(downGlow)})`);
  }
  return F.done();
});

// ---------------------------------------------------------------- nvg-off
export const nvgOff = guarded(async () => {
  const F = family('nvg-off: the switch off is the module absent; its rows are kept like the other team-feel rows');
  setKnobs({ NVG: { on: false } }); const S: any = await quiet(() => stage(IDS[0], 1)); const g = S.g; NVM.NVG_LOG.length = 0;
  await quiet(() => g.orders.give('fallIn', g.orders.targetAt(g.player.char.pos), 'all')); g.player.nv = true; S.step(240);
  const team: any[] = g.orders.squad(); const st = NVM.nvgState(g);
  const any = team.some(x => NVM.nvgDown(g, x) || NVM.nvgWorn(g, x) || NVM.nvgDark(g, x)), sight = team.reduce((s, x) => s + NVM.nvgSight(g, x, { irradiance: 0.03, visibility: 0 }), 0);
  F.verdict(st.mode === 'off' && st.men.length === 0 && !any && sight === 0 && NVM.NVG_LOG.length === 0 && NVM.nvgSummary(g).startsWith('night vision off'),
    'NVG.on false: no state, no goggles, no sight term, nothing logged — Sam\'s goggles down or not', `state '${st.mode}' · men ${st.men.length} · any man worn / down / dark: ${any} · Σ sight term ${sight} · log ${NVM.NVG_LOG.length} · "${NVM.nvgSummary(g)}"`);
  reset();
  // a flip in play: on → off inside a frame, off → on picks the floor up fresh
  { const X: any = await quiet(() => stage(IDS[0], 1)); const G = X.g; await quiet(() => G.orders.give('fallIn', G.orders.targetAt(G.player.char.pos), 'all')); X.step(120);
    const was = modeOf(G), gogWas = G.orders.squad().filter((x: any) => NVM.nvgDown(G, x)).length; NVG.on = false; X.step(2); const mid = modeOf(G), gogMid = G.orders.squad().filter((x: any) => NVM.nvgDown(G, x)).length;
    NVG.on = true; X.step(60); const back = modeOf(G), gogBack = G.orders.squad().filter((x: any) => NVM.nvgDown(G, x)).length;
    F.verdict(was.startsWith('dark') && gogWas > 0 && mid === 'off' && gogMid === 0 && back === was && gogBack === gogWas, 'flipped in play: off inside two frames, on again picks the floor up',
      `${was} (${gogWas} goggled) → ${mid} (${gogMid}) → ${back} (${gogBack})`); }
  // the panel's rows: teamfeel.ts keeps them
  { const TFM: any = await import(`${ROOT}/src/game/teamfeel.ts`);
    const rows = ['on', 'lead', 'own', 'quietSecs', 'darkAt', 'blackAt'], kept = rows.filter(k => TFM.feelRange('NVG', k) !== undefined), sw = ['on', 'lead', 'own'].every(k => TFM.feelRange('NVG', k) === null);
    F.verdict(kept.length === rows.length && sw && TFM.feelTables().NVG === NVG && rows.every(k => k in NVG), 'the Team feel rows: three switches and three numbers, the table the module reads',
      `kept: ${kept.join(', ')} · switches are switches: ${sw} · feelTables().NVG is nvg.ts NVG: ${TFM.feelTables().NVG === NVG}`); }
  return F.done();
});

// ---------------------------------------------------------------- digest (the cross-commit identity: run this file's `digest` here and in a checkout of af55d89)
/** one hash per scenario of a scripted minute with NVG.on false (or with no nvg.ts at all): fall in, stack, open and clear with the room's men alive —
 *  every man's place, facing, state, awareness and light, every frame */
export async function digestLines(): Promise<string[]> {
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`); const out: string[] = [];
  const brace0 = DGM?.DIGIN.braceInRoom; if (DGM && 'braceInRoom' in DGM.DIGIN) DGM.DIGIN.braceInRoom = false;   // (the brace goal rule and the fall-back's building rule: later default-on rules, off here so this stays the base's digest; the first is put back below, the second is the knob set's)
  for (const id of IDS) {
    // (… and what has shipped ON since af55d89 off with it, where the build has the table: the entry points moved off uncleared doors, the cover's kept guns,
    //  the step to see through an open door, the entry's corner and first-man rules)
    setKnobs({ ...(hasKnobs('CUES') ? { CUES: { on: false } } : {}), ...(NVM ? { NVG: { on: false } } : {}), ...(hasKnobs('IRLIGHT') ? { IRLIGHT: { on: false } } : {}), ...(hasKnobs('SILENT') ? { SILENT: { on: false } } : {}), ...('workOut' in ORM.ORDERS ? { ORDERS: { workOut: false, ...('hallFile' in ORM.ORDERS ? { hallFile: false } : {}), ...('secondFloor' in ORM.ORDERS ? { secondFloor: false } : {}), ...('cleared' in ORM.ORDERS ? { cleared: false, knownFace: false, ownDoor: false } : {}), ...('roundCap' in ORM.ORDERS ? { roundCap: 0 } : {}), ...('fileHold' in ORM.ORDERS ? { fileHold: false } : {}), ...('backEnd' in ORM.ORDERS ? { backEnd: false } : {}), ...('inWay' in ORM.ORDERS ? { inWay: false } : {}), ...('walkTries' in ORM.ORDERS ? { walkTries: false } : {}) } } : {}), ...(hasKnobs('ENTRY') ? { ENTRY: { offOpenings: false } } : {}), ...(hasKnobs('REAR') ? { REAR: { settle: false } } : {}),
      ...(hasKnobs('COVER') ? { COVER: { step: false, ...(CVM && 'backKeep' in CVM.COVER ? { backKeep: false } : {}) } } : {}), ...(hasKnobs('ROOMFIT') ? { ROOMFIT: { on: false } } : {}), ...('litMan' in GDM.LIGHTS ? { LIGHTS: { litMan: false } } : {}), ROOMFIGHT: { samTravel: false, samBeside: false, noShotGo: 0, keepTrack: false, ...('doorEars' in RFT.ROOMFIGHT ? { doorEars: false } : {}), ...('sights' in RFT.ROOMFIGHT ? { sights: false } : {}), ...('fallBackIn' in RFT.ROOMFIGHT ? { fallBackIn: false } : {}) }, DOORTOOLS: { cornerOwed: false, collapse: false, cornerTurn: false, leadSeen: false, thrFirst: 0, thrLast: false, buddy: false, otherDoorM: 0, ownCan: false, flowOn: false, openAir: false, flowMax: 0, threatFirst: false, bangWay: false, openHand: false, behindSam: false, haltBack: false, thrHand: false }, ...(hasKnobs('BUDDY') ? { BUDDY: { on: false } } : {}), ...(hasKnobs('DOORMANNERS') ? { DOORMANNERS: { on: false } } : {}) });   // (DOORMANNERS: doorway manners, doorway.ts, a later default-on rule, off where the checkout has it)   // (BUDDY: the lone defender's radio call for a buddy, a later rule (it ships off; pinned so the digest holds on a machine that keeps it on), off where the checkout has it)   // (sights: the eyes-on-the-sights rule, a later default-on rule, off with the rest; … and the room fight's four rescue-with-goggles rules and the threshold's two later ones at their old values, as threshold-identity pins them; litMan: the night breach hunt's default-on light rule, pinned off where the checkout has it)
    const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders; let h = 0x811c9dc5 >>> 0; if (RWM) { RWM.REARWATCH.on = false; RWM.REARWATCH.room = false; }
    const eat = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
    const frame = () => { step(); eat(JSON.stringify(digestGame(g, true))); for (const x of g.guards) eat(`${x.flashlight?.enabled ? 1 : 0}${x.state[0]}${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)}`); };
    const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) frame();
    const cands: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!cands.some(c => c.ent === e)) cands.push({ ent: e, dist: flat(sam, e.at) });
    cands.sort((a, b) => a.dist - b.dist); let fc: any = null;
    for (const c of cands) { fc = c.ent.door.frameCentre; if (!(await quiet(() => O.give('stack', O.targetAt(fc), 'all')))) break; }
    for (let f = 0; f < 60 * 15; f++) frame();
    await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 40; f++) frame();
    const alive = g.guards.filter((x: any) => x.state !== 'dead').length;
    out.push(`${id}: ${(h >>> 0).toString(16).padStart(8, '0')} · ${g.guards.length} on the floor, ${alive} standing at ${g.time.toFixed(2)} s`);
    reset();
  }
  if (DGM && 'braceInRoom' in DGM.DIGIN) DGM.DIGIN.braceInRoom = brace0;
  return out;
}
if (import.meta.main && process.argv[2] === 'digest') { for (const l of await digestLines()) console.log(l); process.exit(0); }
