// The 'irlight' family: AN INFRARED LIGHT ON THE GOGGLES (the maintainer, 10-15: "maybe we should model IR lights on the nvg so even totally dark rooms are
// visible. and we can assume enemies never have nvg"). The rule is game/irlight.ts; this family is its check. Run through probes.ts:
//   bun run tools/qa/probes.ts irlight | irl-list | irl-unseen | irl-team | irl-off          (both stands: TPS_PROFILE=shipped in front for the page's)
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each scenario's own level, started as a click on its row starts it — bang-tally.ts
// stage()). NOTHING IS DRAWN: how a room reads through the tube under the flood is not judged here and has never been seen on a GPU; the GPU's light meter is
// not run (headless it is the CPU stand-in). What is held is the mechanism: which lights exist, in which list, with which bits, and who reads them.
//   irl-list    WHO BURNS ONE, AND WHERE IT IS KEPT. Every scenario: Sam's once his goggles are down (and out again when they are up), one per teammate whose
//               goggles are down and for no other man, never an enemy's; each a spot at its carrier's brow along his aim at IRLIGHT.power through the tube;
//               never in the list every other reader sums (LightSet.lights). The upload: with the picture bare-eyed not one is handed to the renderer; with
//               the tube's, each is, flagged infrared and NOT transient (a steady light: the flash's path costs the bounce a ray per flood per hit), at the tail — and no light of the level's ever carries the infrared bit. The shader's
//               text: the light meter's reading (probe.wgsl → evalLightTrue) and the cascades' (directIrradiance) both refuse the bit.
//   irl-unseen  NOBODY WITHOUT GOGGLES READS ONE. Every scenario played through a held door from one seed with Sam's goggles down: the light on (the team
//               half off — yours alone) and off (the first scenario a third time, as the control). Hashed every frame: the whole game's digest, every man's awareness, state, light and visibility,
//               every camera, the light list, and the CPU's light estimate on the floor in front of Sam — where his flood falls. On ≡ off, while the count
//               says the flood was there. Its red path: IRLIGHT_BREAK=1 puts the infrared lights where a careless build would — in the list everybody
//               sums — and this probe must FAIL.
//   irl-team    A GOGGLED TEAMMATE SEES BY IT, AND NO PLACE IS TOO DARK FOR HIS TUBE. A man with no light on him at all, stood in a goggled teammate's
//               flood: that teammate's tube reads him; with the team half off, the switch off, out of the cone or behind a wall it reads nothing, and an
//               enemy's eye reads nothing ever. The same held-door play with the light on and off: not one man-frame 'too dark for the tube' with it on.
//   irl-off     THE SWITCH AND THE STANDS: off = no infrared light anywhere and the tube's term as nvg.ts had it; the frozen stand holds it off
//               (TPS_IRLIGHT=1 raises it), the shipped stand has it on as the page does; the Team feel rows are kept by teamfeel.ts.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, standUp } from './headless.ts';
import { stage } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const ILM: any = await import(`${ROOT}/src/game/irlight.ts`);
const LTM: any = await import(`${ROOT}/src/render/lights.ts`);
const TFM: any = await import(`${ROOT}/src/game/teamfeel.ts`);
const IRLIGHT = ILM.IRLIGHT;
const ON_AT_LOAD: boolean = IRLIGHT.on;   // (what the stand left it at as the harness loaded: the shipped stand writes the page's switches once, then — profile.ts shippedBoot)

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const BREAK = !!process.env.IRLIGHT_BREAK;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DEFAULTS = JSON.parse(JSON.stringify(IRLIGHT));
const reset = () => { Object.assign(IRLIGHT, JSON.parse(JSON.stringify(DEFAULTS))); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const IDS: string[] = (SCENARIOS as any[]).map(e => e.id);
const mates = (g: any): any[] => g.orders.squad().filter((x: any) => x.state !== 'dead');
const doorsOf = (S: any): any[] => { const sam = S.g.player.char.pos; const c: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!c.some(q => q.ent === e)) c.push({ ent: e, dist: flat(sam, e.at) }); c.sort((a, b) => a.dist - b.dist); return c.map(q => q.ent); };
function fnv() { let h = 0x811c9dc5 >>> 0; return { eat: (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } }, hex: () => (h >>> 0).toString(16).padStart(8, '0') }; }
const headOf = (c: any): number[] => c.bones.head ?? [c.pos[0], c.pos[1] + 1.62, c.pos[2]];
const f2 = (x: number) => x.toFixed(2);
/** a scenario as its row starts it with the light as asked, the team fallen in on Sam, Sam's goggles as asked, four seconds on */
async function settled(id: string, on: boolean, team: boolean, nv: boolean) {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; IRLIGHT.on = on; IRLIGHT.team = team; g.player.nv = nv;
  await quiet(() => g.orders.give('fallIn', g.orders.targetAt(g.player.char.pos), 'all')); step(240);
  return S;
}

// ---------------------------------------------------------------- irl-list
export const irlList = guarded(async () => {
  const F = family('irl-list: an infrared light for every pair of goggles that is down, kept where only a tube\'s picture finds it');
  let menDown = 0;
  for (const id of IDS) {
    const S = await settled(id, true, true, true); const { g, step } = S; const L = g.engine.lights, pl = g.player, team = mates(g), fails: string[] = [];
    const X = g.engine.settings.exposure > 0 ? g.engine.settings.exposure : 1;
    const sam = L.ir.find((l: any) => l.owner === pl.char.id);
    if (!(pl.nvAmount > 0.9)) fails.push(`Sam's goggles never came down (nvAmount ${f2(pl.nvAmount)})`);
    if (!sam) fails.push('Sam\'s goggles are down and he burns none');
    let down = 0;
    for (const x of team) { const gog = NVM.nvgDown(g, x), has = L.ir.some((l: any) => l.owner === x.char.id); if (gog) down++; if (gog !== has) fails.push(`${x.callsign}: goggles ${gog ? 'down' : 'up'}, a light ${has ? 'burning' : 'missing'}`); }
    menDown += down;
    const foes = g.guards.filter((x: any) => x.team === 'hostile'); if (L.ir.some((l: any) => foes.some((h: any) => h.char.id === l.owner))) fails.push('an enemy carries one');
    if (L.ir.length !== (sam ? 1 : 0) + down) fails.push(`${L.ir.length} in the list for ${(sam ? 1 : 0) + down} pairs of goggles down`);
    if (L.ir.some((l: any) => L.lights.includes(l))) fails.push('one is in the list every reader sums');
    for (const l of L.ir) {
      const c = l.owner === pl.char.id ? pl.char : team.find((x: any) => x.char.id === l.owner)?.char; if (!c) { fails.push(`${l.name}: nobody's`); continue; }
      const h = headOf(c), d = Math.hypot(l.pos[0] - h[0], l.pos[1] - h[1], l.pos[2] - h[2]), along = l.dir[0] * Math.sin(c.aimYaw) + l.dir[2] * Math.cos(c.aimYaw);
      if (!(l.kind === 1 && l.enabled && d < 0.2 && along > 0.9 && l.dir[1] < 0 && Math.abs(l.intensity * X - IRLIGHT.power) < 1e-6 && l.volumetric === 0)) fails.push(`${l.name}: kind ${l.kind}, ${f2(d)} m off his brow, ${f2(along)} along his aim, × exposure ${f2(l.intensity * X)}`);
    }
    // ---- the upload: none for a bare-eyed picture, every one for the tube's, with the bits
    const words = () => (L as any).u32 as Uint32Array, bitAt = (slot: number) => words()[slot * 16 + 3];
    L.tube = false; const n0 = L.upload(0), ft0 = L.firstTransientSlot; let bare = 0; for (let s = 0; s < n0; s++) if (bitAt(s) & LTM.LIGHT_IR) bare++;
    if (bare || L.irCount || L.ir.some((l: any) => (l.slot ?? -1) >= 0)) fails.push(`a bare-eyed picture was handed ${Math.max(bare, L.irCount)}`);
    L.tube = true; const n1 = L.upload(0); let flagged = 0, level = 0;
    for (const l of L.ir) { const s = l.slot ?? -1; if (s >= 0 && (bitAt(s) & LTM.LIGHT_IR) && !(bitAt(s) & 256)) flagged++; }
    for (const l of L.lights) { const s = l.slot ?? -1; if (s >= 0 && (bitAt(s) & LTM.LIGHT_IR)) level++; }
    const room = LTM.MAX_LIGHTS - n0, due = Math.min(L.ir.length, room);
    if (flagged !== due || L.irCount !== due || n1 !== n0 + due || level || L.firstTransientSlot !== (ft0 < n0 ? ft0 : n1)) fails.push(`the tube's picture: ${flagged} of ${due} flagged infrared and steady (${n1} lights for ${n0} + ${due}), ${level} of the level's own flagged, first transient slot ${L.firstTransientSlot} (without them: ${ft0})`);
    L.tube = false;
    // ---- goggles up: his is out; the team half off: theirs are; the switch off: nothing
    pl.nv = false; let early = 0; for (let f = 0; f < 120; f++) { step(1); if (pl.nvAmount > 0.5 && !L.ir.some((l: any) => l.owner === pl.char.id)) early++; }   // (his goggles lift before the picture goes back: the light stays for as long as the picture is the tube's)
    if (early) fails.push(`his light was out under ${early} frames of a picture that was still the tube's`);
    const upGone = !L.ir.some((l: any) => l.owner === pl.char.id), mateStay = L.ir.length;
    pl.nv = true; step(60); IRLIGHT.team = false; step(2); const alone = L.ir.length === 1 && L.ir[0].owner === pl.char.id;
    IRLIGHT.on = false; step(1); const none = L.ir.length === 0;
    if (!upGone) fails.push('his goggles up and his light still burns'); if (!alone) fails.push(`the team half off: ${L.ir.length} burning`); if (!none) fails.push(`the switch off: ${L.ir.length} burning`);
    F.verdict(!fails.length, `${id}: Sam and ${team.length} teammates, four seconds after falling in`, fails.join('; ') || `Sam's and ${down} teammates' (goggles down) burn, ${L.ir.length === 0 ? 'none' : 'no other'}; at the brow, along the aim, ${IRLIGHT.power} through the tube · upload: 0 for a bare-eyed picture, ${due} for the tube's flagged infrared, steady, none of the level's ${n0} flagged · Sam's goggles up: his out (${mateStay} still burning); the team half off: his alone; the switch off: none`);
    reset();
  }
  F.verdict(menDown > 0, 'not vacuous: teammates had their goggles down', `${menDown} teammates with goggles down over ${IDS.length} scenarios`);
  // ---- the shader's own text: the game's readings refuse the bit
  { const src = readFileSync(resolve(ROOT, 'src/render/shaders/common.wgsl'), 'utf8'), probe = readFileSync(resolve(ROOT, 'src/render/shaders/probe.wgsl'), 'utf8');
    const fnBody = (name: string) => { const i = src.indexOf(`fn ${name}(`); return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i)); };
    const bit = /const LIGHT_IR: u32 = 0x8000000u;/.test(src) && LTM.LIGHT_IR === 0x8000000;
    const tru = /LIGHT_IR/.test(fnBody('evalLightTrue')), casc = /LIGHT_IR/.test(fnBody('directIrradiance')), meter = /evalLightTrue\(/.test(probe) && !/evalLight\(/.test(probe) && !/evalLightRaw\(/.test(probe);
    F.verdict(bit && tru && casc && meter, 'the light meter and the cascades it reads refuse an infrared light (the shader\'s text)', `the bit is the same on both sides: ${bit} · evalLightTrue refuses it: ${tru} · directIrradiance (the cascades) skips it: ${casc} · probe.wgsl asks evalLightTrue and nothing else: ${meter}`); }
  return F.done();
});

// ---------------------------------------------------------------- irl-unseen / irl-team: the same held-door play
interface Play { hash: string; frames: number; irFrames: number; irMax: number; flood: number; awMax: number; black: number; white: number; gog: number; shots: number; down: number }
async function play(id: string, on: boolean, team: boolean, nv: boolean): Promise<Play | null> {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders; IRLIGHT.on = on; IRLIGHT.team = team; g.player.nv = nv;
  const L = g.engine.lights, foes = g.guards.filter((x: any) => x.team === 'hostile'), H = fnv();
  const R: Play = { hash: '', frames: 0, irFrames: 0, irMax: 0, flood: 0, awMax: 0, black: 0, white: 0, gog: 0, shots: 0, down: 0 };
  const shots0 = foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0);
  const frame = () => {
    if (BREAK) for (const l of L.ir) if (!L.lights.includes(l)) L.lights.push(l);   // (the red path: the infrared lights in the list everybody sums)
    step(); R.frames++;
    H.eat(JSON.stringify(digestGame(g, true)));
    for (const x of g.guards) H.eat(`${x.callsign}:${x.state}:${x.awareness.toFixed(5)}:${x.flashlight?.enabled ? 1 : 0}:${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)}:${(x.irradiance ?? 0).toFixed(5)}:${(x.visibility ?? 0).toFixed(5)}|`);
    for (const c of g.devices?.cameras ?? []) H.eat(`cam:${c.seen.toFixed(5)}:${c.state}|`);
    for (const l of L.lights) if (!L.ir.includes(l)) H.eat(`${l.name}:${l.kind}:${l.enabled ? 1 : 0}:${l.intensity.toFixed(4)}:${l.pos[0].toFixed(3)},${l.pos[1].toFixed(3)},${l.pos[2].toFixed(3)}|`);
    // the floor in front of Sam, where his flood falls: what every eye and lens without goggles would read there
    const c = g.player.char, P = [c.pos[0] + Math.sin(c.aimYaw) * 3, 1.2, c.pos[2] + Math.cos(c.aimYaw) * 3];
    H.eat(`sam:${g.player.visibility.toFixed(5)}:${GDM.lightEstimateAt(g, P).toFixed(6)}|`);
    const flood = ILM.irLightAt(g, P); if (flood > 0) R.flood++;
    if (L.ir.length) R.irFrames++; R.irMax = Math.max(R.irMax, L.ir.length);
    for (const x of foes) if (x.state !== 'dead') R.awMax = Math.max(R.awMax, x.awareness);
    const st = NVM.nvgState(g); for (const m of st.men) { if (m.gd.state === 'dead') continue; if (m.black) R.black++; if (m.down) R.gog++; if (m.gd.flashlight?.enabled) R.white++; }
  };
  const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) frame();
  let fc: any = null, why: string | void = 'no door';
  for (const e of doorsOf(S)) { fc = e.door.frameCentre; why = await quiet(() => O.give('stack', O.targetAt(fc), 'all')); if (!why) break; }
  if (why) { reset(); return null; }
  for (let f = 0; f < 60 * 14; f++) frame();
  await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 20; f++) frame();
  R.hash = H.hex(); R.shots = foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0) - shots0; R.down = foes.filter((x: any) => x.state === 'dead').length;
  reset(); return R;
}

export const irlUnseen = guarded(async () => {
  const F = family('irl-unseen: nobody without goggles reads an infrared light — no enemy, no camera, no light estimate differs for yours or for none');
  let flood = 0;
  for (const id of IDS) {
    const twice = id === IDS[0];   // (the control — the same run again — once: that this harness repeats itself is not a thing to ask of every level)
    const A = await play(id, true, false, true), B = await play(id, false, false, true), A2 = twice ? await play(id, true, false, true) : A;
    if (!A || !B || !A2) { F.verdict(false, `${id}: a door to stack on`, 'the stack order was refused'); continue; }
    flood += A.flood;
    const same = A.hash === B.hash, control = A.hash === A2.hash;
    F.verdict(same && control && A.irFrames > 0 && B.irFrames === 0, `${id}: ${A.frames} frames through a held door from one seed, the light on and off, Sam's goggles down`,
      `the light on (yours alone): burning in ${A.irFrames} frames, its flood on the floor ahead of you in ${A.flood}; off: ${B.irFrames} · the game, every man's awareness, light and visibility, every camera, the light list and the light estimate on that floor, frame for frame: ${same ? 'identical' : 'DIFFERENT'}${twice ? ` (the control, on twice: ${control ? 'identical' : 'DIFFERENT — this harness run is not deterministic'})` : ''} · enemies: highest awareness ${f2(A.awMax)} / ${f2(B.awMax)}, rounds ${A.shots} / ${B.shots}, down ${A.down} / ${B.down}`);
  }
  F.verdict(flood > 0, 'not vacuous: the flood lay on the floor the estimate was asked of', `${flood} frames over ${IDS.length} scenarios with infrared light on the point 3 m ahead of Sam`);
  return F.done();
});

let manId = 0;
export const irlTeam = guarded(async () => {
  const F = family('irl-team: a goggled teammate sees a man by the infrared light, an enemy never does, and no place is too dark for his tube');
  // ---- a man with no light on him, stood in a goggled teammate's flood
  let asked = 0;
  for (const id of IDS) {
    const S = await settled(id, true, true, false); const { g } = S; const L = g.engine.lights, team = mates(g);
    const m = team.find((x: any) => NVM.nvgDown(g, x) && L.ir.some((l: any) => l.owner === x.char.id)); if (!m) { reset(); continue; }
    const mine = L.ir.find((l: any) => l.owner === m.char.id), all = [...L.ir], c = m.char, fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw);
    let r = 0; for (const d of [4, 3, 2, 1.5]) if (!g.col.segmentBlocked(mine.pos, [c.pos[0] + fx * d, 1.2, c.pos[2] + fz * d])) { r = d; break; }
    if (!r) { reset(); continue; }
    asked++;
    const man = (x: number, z: number) => ({ char: { pos: [x, 0, z], bones: {}, id: 9000 + (manId++) }, irradiance: 0, visibility: 0, callsign: 'nobody' });
    const foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    L.ir.length = 0; L.ir.push(mine);   // (his own flood alone: the others' must not light the man behind him)
    const ahead = NVM.nvgSight(g, m, man(c.pos[0] + fx * r, c.pos[2] + fz * r)), behind = NVM.nvgSight(g, m, man(c.pos[0] - fx * 3, c.pos[2] - fz * 3));
    const E = ILM.irLightAt(g, [c.pos[0] + fx * r, 1.2, c.pos[2] + fz * r]), own = ILM.irLightAt(g, [c.pos[0] + fx * r, 1.2, c.pos[2] + fz * r], m.char.id);
    const byFoe = foe ? NVM.nvgSight(g, foe, man(c.pos[0] + fx * r, c.pos[2] + fz * r)) : 0;
    const bare = NVM.tubeVis(g, 0);
    IRLIGHT.team = false; const teamOff = NVM.nvgSight(g, m, man(c.pos[0] + fx * r, c.pos[2] + fz * r)); IRLIGHT.team = true;
    IRLIGHT.on = false; const off = NVM.nvgSight(g, m, man(c.pos[0] + fx * r, c.pos[2] + fz * r)); IRLIGHT.on = true;
    // behind a wall: the first floor past the nearest wall along his aim
    let walled: number | null = null; for (let d = r + 0.5; d < 20; d += 0.5) { const P = [c.pos[0] + fx * d, 1.2, c.pos[2] + fz * d]; if (g.col.segmentBlocked(mine.pos, P) && g.col.segmentBlocked(P, mine.pos) && !g.col.segmentBlocked([P[0], 0.1, P[2]], [P[0], 2, P[2]])) { walled = NVM.nvgSight(g, m, man(P[0], P[2])); break; } }   // (blocked both ways: a point INSIDE the wall's own box is blocked only from outside it, and no man stands there)
    L.ir.length = 0; for (const l of all) L.ir.push(l);
    F.verdict(ahead > 0.4 && behind === 0 && byFoe === 0 && teamOff === 0 && off === 0 && bare === 0 && E > 0 && own === 0 && (walled === null || walled === 0), `${id}: a man with no light on him ${f2(r)} m in front of ${m.callsign}, whose goggles are down`,
      `${m.callsign}'s tube reads him ${f2(ahead)} (the infrared light on him ${E.toFixed(3)} W/m²; with no light at all a tube reads ${f2(bare)}) · three metres behind ${m.callsign}: ${f2(behind)} · past the first wall along his aim: ${walled === null ? 'no wall inside 20 m' : f2(walled)} · the team half off: ${f2(teamOff)} · the switch off: ${f2(off)} · to an enemy's eye (${foe?.callsign ?? 'none standing'}): ${f2(byFoe)} · the carrier's own light on himself: ${own.toFixed(3)}`);
    reset();
  }
  F.verdict(asked > 0, 'not vacuous: a goggled teammate with clear floor ahead of him was found', `${asked} of ${IDS.length} scenarios`);
  // ---- too dark for the tube: never, with a light of his own
  let blackOff = 0, blackOn = 0, gogOn = 0, gogOff = 0, whiteOn = 0, whiteOff = 0; const rows: string[] = [];
  for (const id of IDS) {
    const A = await play(id, true, true, false), B = await play(id, false, false, false); if (!A || !B) continue;
    blackOn += A.black; blackOff += B.black; gogOn += A.gog; gogOff += B.gog; whiteOn += A.white; whiteOff += B.white;
    rows.push(`${id}: black ${A.black} / ${B.black}, goggles down ${A.gog} / ${B.gog}, a white light burning ${A.white} / ${B.white}, most infrared lights at once ${A.irMax}, enemies down ${A.down} / ${B.down}`);
  }
  F.verdict(blackOn === 0 && gogOn > 0, 'with a light of his own no man is ever "too dark for the tube" (man-frames, the light on / off, Sam\'s goggles up)', rows.join(' · ') + ` — in all: black ${blackOn} / ${blackOff}, goggles down ${gogOn} / ${gogOff}, a white light burning ${whiteOn} / ${whiteOff}${blackOff === 0 ? ' (these plays never met a black place with the light off either: the rule is held by the first part and by nvg.ts readPlace, not by a difference here)' : ''}`);
  return F.done();
});

export const irlOff = guarded(async () => {
  const F = family('irl-off: the switch, and the two stands');
  { const S = await settled(IDS[0], false, true, true); const { g, step } = S; const L = g.engine.lights; let most = 0; for (let f = 0; f < 120; f++) { step(); most = Math.max(most, L.ir.length); }
    const m = mates(g)[0], o = { char: { pos: [m.char.pos[0] + 2, 0, m.char.pos[2]], bones: {}, id: 9001 }, irradiance: 0.03, visibility: 0 };
    const withIt = NVM.nvgDown(g, m) ? NVM.nvgSight(g, m, o) : NVM.tubeVis(g, 0.03), plain = NVM.tubeVis(g, 0.03);
    F.verdict(most === 0 && withIt === plain && ILM.irOnMan(g, o) === 0 && !ILM.irCarried(), 'IRLIGHT.on off: no infrared light anywhere, the tube\'s term as it was', `most infrared lights in 120 frames with Sam's goggles down: ${most} · a man at E 0.03 through the tube: ${f2(withIt)} (nvg.ts alone: ${f2(plain)}) · ${ILM.irLightSummary(g)}`);
    IRLIGHT.on = true; step(2); const on = L.ir.length; IRLIGHT.on = false; step(1);
    F.verdict(on > 0 && L.ir.length === 0, 'flipped in play it takes hold inside a frame', `on: ${on} burning two frames later · off: ${L.ir.length} the next frame`);
    reset(); }
  { const rows = ['on', 'team', 'power', 'cone', 'reach'], kept = rows.filter(k => TFM.feelRange('IRLIGHT', k) !== undefined), sw = ['on', 'team'].every(k => TFM.feelRange('IRLIGHT', k) === null);
    F.verdict(kept.length === rows.length && sw, 'the Team feel rows are kept per machine (teamfeel.ts)', `${kept.join(', ')} · on / team are switches: ${sw}`); }
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_IRLIGHT;
    const want = frozen || word !== undefined ? word === '1' : true;
    IRLIGHT.on = frozen ? !want : want; await quiet(() => standUp());   // (frozen: stood up from the opposite of what the pin should leave; shipped: the page's switches were written once as the harness loaded, and standUp leaves them be)
    F.verdict(IRLIGHT.on === want && (frozen || ON_AT_LOAD === want), frozen ? 'standUp() on the frozen stand puts IRLIGHT.on to what TPS_IRLIGHT says (unset: off — every stored digest and tally had no such light)' : 'the shipped stand has it on from the moment the harness loads, as the page does, and standUp() leaves it', `as the harness loaded: ${ON_AT_LOAD} · after standUp: ${IRLIGHT.on} · TPS_IRLIGHT ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
    DEFAULTS.on = IRLIGHT.on; }
  return F.done();
});
