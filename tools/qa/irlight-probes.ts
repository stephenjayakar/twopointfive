// The 'irlight' family: AN INFRARED LIGHT ON THE GOGGLES (the maintainer, 10-15: "maybe we should model IR lights on the nvg so even totally dark rooms are
// visible. and we can assume enemies never have nvg"). The rule is game/irlight.ts; this family is its check. Run through probes.ts:
//   bun run tools/qa/probes.ts irlight | irl-list | irl-unseen | irl-team | irl-off | irl-auto | irl-meter          (both stands: TPS_PROFILE=shipped in front for the page's)
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
//   irl-auto    IT BURNS ONLY WHERE IT IS TOO DARK FOR THE TUBE (IRLIGHT.auto; the maintainer, 10-16: "is it realistic to only have them turn on when it's
//               actually too dark to see?"). Every scenario, the places taken off the level itself (Sam's start, every door, every enemy's spot): Sam stood
//               with his goggles down where every floor he could look at inside 13 m reads over NVG.blackAt through the tube by the place's own light — no
//               light of his burns, the same place with the rule off and it does; stood on floor that reads black — it burns inside a tenth of a second
//               and is at full by half; back in the light — it is out IRLIGHT.hold and its fade later and not before. The team, played four seconds: no
//               goggled man on black floor is without his, no goggled man who can look at no black floor keeps one, and no man with his goggles up has
//               one. One light on open floor never reads past the tube's hot shoulder beyond arm's length (the brightness that was asked down). Its red
//               path: IRAUTO_BREAK=1 calls every place dark, and this probe must FAIL. The other four probes hold the rule OFF: they check a light that
//               burns whenever the goggles are down.
//   irl-meter   WHAT THE CPU CALLS DARK IS PUT TO THE RENDERER'S METER (IRLIGHT.meter; the maintainer, 10-18, of a strongroom with its own bulb off: "still
//               feels like the IR light here is unnecessary" — the CPU's estimate has no bounced light, so every room with no lamp of its own was black
//               to the rule). No renderer here: its answers are PLANTED through the hooks the harness swaps (Game.lightAt), and what is held is who
//               decides. Every scenario, Sam stood on floor the CPU's estimate calls black, his goggles brought down afresh: the renderer answers 'lit'
//               — not one frame of his light, nor of a teammate's, and with the switch off the same answers and it burns (the build before); it answers
//               'dark' — burning inside a tenth of a second and at full at once; it answers Sam's own meter and nothing else (a starved probe) — no
//               light until IRL_METER.wait, then the CPU's word; it answers nothing at all (headless as it is) or the senses are on the CPU (SENSE.cpu)
//               — nothing asked and the CPU's word at once, the rule as it was. The bounce is the PICTURE's: an answer over the line by itself and
//               under it × settings.indirectScale is dark, and with the scale at 1 it is not. Where the CPU calls the place light nothing is asked.
//               What a carrier asks is bounded (IRL_METER.slots a beat) and forgotten with his goggles. The stands, the FROZEN_HOLDS row and a
//               recording from before the key. Its red path: IRMETER_BREAK=1 holds the switch off where this probe turns it on, and it must FAIL.
//               irl-auto and the four before it hold this switch OFF (headless it changes nothing: no renderer answers).
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
const AUTO_AT_LOAD: boolean = IRLIGHT.auto, METER_AT_LOAD: boolean = IRLIGHT.meter;
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
async function settled(id: string, on: boolean, team: boolean, nv: boolean, auto = false) {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; IRLIGHT.on = on; IRLIGHT.team = team; IRLIGHT.auto = auto; IRLIGHT.meter = false; g.player.nv = nv;
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
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders; IRLIGHT.on = on; IRLIGHT.team = team; IRLIGHT.auto = false; IRLIGHT.meter = false; g.player.nv = nv;
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
  { const rows = ['on', 'team', 'auto', 'meter', 'power', 'cone', 'reach'], kept = rows.filter(k => TFM.feelRange('IRLIGHT', k) !== undefined), sw = ['on', 'team', 'auto', 'meter'].every(k => TFM.feelRange('IRLIGHT', k) === null);
    F.verdict(kept.length === rows.length && sw, 'the Team feel rows are kept per machine (teamfeel.ts)', `${kept.join(', ')} · on / team / auto are switches: ${sw}`); }
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_IRLIGHT;
    const want = frozen || word !== undefined ? word === '1' : true;
    IRLIGHT.on = frozen ? !want : want; await quiet(() => standUp());   // (frozen: stood up from the opposite of what the pin should leave; shipped: the page's switches were written once as the harness loaded, and standUp leaves them be)
    F.verdict(IRLIGHT.on === want && (frozen || ON_AT_LOAD === want), frozen ? 'standUp() on the frozen stand puts IRLIGHT.on to what TPS_IRLIGHT says (unset: off — every stored digest and tally had no such light)' : 'the shipped stand has it on from the moment the harness loads, as the page does, and standUp() leaves it', `as the harness loaded: ${ON_AT_LOAD} · after standUp: ${IRLIGHT.on} · TPS_IRLIGHT ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
    DEFAULTS.on = IRLIGHT.on; }
  return F.done();
});

// ---------------------------------------------------------------- irl-auto
/** the place's own light at a floor point, through the tube (the rule's own two terms, asked from here) */
const tubeAt = (g: any, x: number, z: number): number => NVM.tubeVis(g, NVM.nvgPlaceLight(g, [x, 1.2, z]));
/** every floor point a man stood at P could look at inside 13 m (a metre past the rule's own fan; 120 ways, half a metre apart, to the first wall), himself
 *  first: the least the tube reads — given up at the first one under `floor` (a place that is not light needs no more asking) */
function leastSeen(g: any, P: number[], floor = -1): number {
  let least = tubeAt(g, P[0], P[2]); const eye = [P[0], 1.5, P[2]]; if (least < floor) return least;
  for (let a = 0; a < 120; a++) { const fx = Math.sin(a * Math.PI / 60), fz = Math.cos(a * Math.PI / 60);
    for (let r = 1; r <= 13; r += 0.5) { const Q = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, Q)) break; least = Math.min(least, tubeAt(g, Q[0], Q[2])); if (least < floor) return least; } }
  return least;
}
const FADE_OUT = 0.5;   // (irlight.ts: the ease out after the hold)
export const irlAuto = guarded(async () => {
  const F = family('irl-auto: the infrared light burns only where the goggles alone show too little');
  const BRK = !!process.env.IRAUTO_BREAK, D: number = NVM.NVG.blackAt; let litAsked = 0, darkAsked = 0, teamDark = 0, teamOut = 0, teamLit = 0; const hot: string[] = [];
  try {
  for (const id of IDS) {
    const S = await settled(id, true, true, true, true); const { g, step } = S; const L = g.engine.lights, pl = g.player, fails: string[] = [], said: string[] = [];
    if (BRK) NVM.NVG.blackAt = Infinity;   // (the red path: every reading says dark — the light of the build before the rule; `D` keeps the real line for what this probe asks itself)
    const samLit = () => L.ir.find((l: any) => l.owner === pl.char.id);
    // ---- the team, four seconds as they stand: a goggled man on black floor burns his; a man with his goggles up burns none
    const since = new Map<any, number>(), litSince = new Map<any, number>();
    for (let f = 0; f < 240; f++) { step();
      for (const x of mates(g)) { const gog = NVM.nvgDown(g, x), has = L.ir.some((l: any) => l.owner === x.char.id);
        if (!gog) { since.delete(x); litSince.delete(x); if (has) fails.push(`${x.callsign}: goggles up and a light burning`); continue; }
        const blackFloor = tubeAt(g, x.char.pos[0], x.char.pos[2]) < D;
        if (!blackFloor) { since.delete(x); if (!has) teamOut++; }
        else { litSince.delete(x); if (!since.has(x)) since.set(x, g.time); if (g.time - since.get(x)! > 0.4) { teamDark++; if (!has) fails.push(`${x.callsign}: on black floor ${f2(g.time - since.get(x)!)} s with his goggles down and no light`); } }
        // a goggled man who can look at no black floor (asked every quarter second: it is the slow question) keeps no light past its hold and its fade
        if (!blackFloor && f % 15 === 0) { if (leastSeen(g, x.char.pos, D * 1.2) >= D * 1.2) { if (!litSince.has(x)) litSince.set(x, g.time); } else litSince.delete(x); }
        if (!blackFloor && litSince.has(x) && g.time - litSince.get(x)! > IRLIGHT.hold + FADE_OUT + 0.6) { teamLit++; if (has) fails.push(`${x.callsign}: no black floor in his sight for ${f2(g.time - litSince.get(x)!)} s and his light burns`); } }
      if (fails.length > 3) break; }
    // ---- Sam, stood where the level is light and where it is black
    g.godMode = true;
    const cands: number[][] = [[...pl.char.pos], ...doorsOf(S).map((e: any) => [e.at[0], 0, e.at[2]]), ...g.guards.filter((x: any) => x.team === 'hostile').map((x: any) => [x.char.pos[0], 0, x.char.pos[2]])];
    const lit = cands.find(P => leastSeen(g, P, D * 1.2) >= D * 1.2), dark = cands.find(P => tubeAt(g, P[0], P[2]) < D * 0.8);
    const litNow = () => leastSeen(g, pl.char.pos, D * 1.2) >= D * 1.2, blackNow = () => tubeAt(g, pl.char.pos[0], pl.char.pos[2]) < D;   // (asked of where he IS: a stand is nudged to free floor, and a door a teammate opens shows a room that was not in the picture)
    const stand = async (P: number[], n: number) => { await quiet(() => g.teleportPlayer(P)); pl.nv = true; step(n); };
    if (lit) { await stand(lit, 150); }
    if (lit && litNow()) {   // (where he IS is still a light place: a stand is nudged to free floor)
      const down = pl.nvAmount > 0.9, out1 = !samLit();
      IRLIGHT.auto = false; step(2); const ruleOff = !!samLit(); IRLIGHT.auto = true; step(150);
      if (litNow()) { litAsked++; const out2 = !samLit();
        if (!down) fails.push(`in the light: Sam's goggles never came down (nvAmount ${f2(pl.nvAmount)})`);
        if (!out1 || !out2) fails.push(`in the light (the least the tube reads of all he could look at: ${f2(leastSeen(g, pl.char.pos))}, the line ${f2(D)}): his light burns`);
        if (!ruleOff) fails.push('in the light with the rule off: his light does not burn (goggles down)');
        said.push(`light at ${lit[0].toFixed(1)},${lit[2].toFixed(1)} (tube ≥ ${f2(leastSeen(g, pl.char.pos))}): out · rule off: ${ruleOff ? 'burning' : 'OUT'}`); } }
    if (dark) { await stand(dark, 6); }
    if (dark && blackNow()) { darkAsked++;
      const X = g.engine.settings.exposure > 0 ? g.engine.settings.exposure : 1;
      const E0 = NVM.nvgPlaceLight(g, [dark[0], 1.2, dark[2]]);
      const l1 = samLit(), quick = !!l1; step(24); const l2 = samLit(), full = !!l2 && Math.abs(l2.intensity * X - IRLIGHT.power) < 1e-6;
      const E1 = NVM.nvgPlaceLight(g, [dark[0], 1.2, dark[2]]), listed = L.lights.some((l: any) => L.ir.includes(l));
      if (!quick) fails.push(`on black floor (tube ${f2(tubeAt(g, dark[0], dark[2]))}): no light 0.1 s after he stood there`);
      if (!full) fails.push(`on black floor: not at full 0.5 s on (${l2 ? f2(l2.intensity * X) : 'none'} of ${IRLIGHT.power})`);
      if (E0 !== E1 || listed) fails.push(`his own light answers the rule's question: the place's light ${E0.toFixed(4)} before, ${E1.toFixed(4)} with it burning${listed ? '; an infrared light in the list every reader sums' : ''}`);
      // (one light on open floor: the tube's signal on a floor of reflectance 0.4 from arm's length out — post.wgsl's curve; its hot add starts at 0.75)
      { const c = pl.char, gain = Math.max(g.engine.settings.nvGain, 1), sig = (E: number) => Math.log(1 + E * X * 0.4 / Math.PI * gain) / Math.log(1 + gain); const all = [...L.ir]; let most = 0, at = 0;
        if (l2) { L.ir.length = 0; L.ir.push(l2);
          for (let a = 0; a < 16; a++) { const fx = Math.sin(a * Math.PI / 8), fz = Math.cos(a * Math.PI / 8);
            for (let r = 1.5; r <= 10; r += 0.5) { const Q = [c.pos[0] + fx * r, 0.05, c.pos[2] + fz * r]; if (g.col.segmentBlocked([c.pos[0], 1.5, c.pos[2]], [Q[0], 1.2, Q[2]])) break; const v = sig(ILM.irLightAt(g, Q) * 1); if (v > most) { most = v; at = r; } } }
          L.ir.length = 0; for (const l of all) L.ir.push(l);
          if (most > 0.75) fails.push(`one light puts open floor ${at} m off at ${f2(most)} of the tube's range (its hot shoulder starts at 0.75)`); if (most > 0) hot.push(`${id} ${f2(most)} at ${at} m`); } }
      said.push(`black floor at ${dark[0].toFixed(1)},${dark[2].toFixed(1)} (tube ${f2(tubeAt(g, dark[0], dark[2]))}): burning inside 0.1 s, full by 0.5 s`);
      if (lit && !BRK && blackNow()) { await quiet(() => g.teleportPlayer(lit)); const t0 = g.time, was = litNow(); let outAt = -1; for (let f = 0; f < 240 && outAt < 0; f++) { step(); if (!samLit()) outAt = g.time - t0; }
        // (the floor under him read dark the frame before he left: out at the hold and its fade, a frame's slack either way)
        if (was && litNow()) { if (outAt < 0 || outAt > IRLIGHT.hold + FADE_OUT + 0.1 || outAt < IRLIGHT.hold + FADE_OUT - 0.1) fails.push(`back in the light: out after ${outAt < 0 ? 'never (4 s)' : f2(outAt) + ' s'} (the hold is ${IRLIGHT.hold} s, its fade ${FADE_OUT})`);
          said.push(`back in the light: out ${f2(outAt)} s later`); } } }
    pl.nv = false; step(40); if (samLit()) fails.push('goggles up: his light still burns');
    F.verdict(!fails.length, `${id}: the team as it stands, then Sam in the light and on black floor`, fails.slice(0, 6).join('; ') || said.join(' · ') || 'neither a light place nor black floor among Sam\'s start, the doors and the enemies\' spots: the team\'s part alone');
    reset(); NVM.NVG.blackAt = D;
  }
  } finally { NVM.NVG.blackAt = D; }
  F.verdict(litAsked > 0 && darkAsked > 0 && teamDark > 0 && teamLit > 0 && hot.length > 0, 'not vacuous: a light place and black floor were both found for Sam and for the team, and open floor lay in his flood', `Sam: a light place in ${litAsked} of ${IDS.length} scenarios, black floor in ${darkAsked} · goggled teammate-frames on black floor (light burning) ${teamDark}, with no black floor in sight past the hold (no light) ${teamLit}, off black floor with no light ${teamOut} · one light, the most open floor reads through the tube: ${hot.join(', ') || 'not asked'}`);
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_IRAUTO;
    const want = frozen || word !== undefined ? word === '1' : true;
    IRLIGHT.auto = frozen ? !want : want; await quiet(() => standUp());
    F.verdict(IRLIGHT.auto === want && (frozen || AUTO_AT_LOAD === want), frozen ? 'standUp() on the frozen stand puts IRLIGHT.auto to what TPS_IRAUTO says (unset: off — the light of every check written before the rule)' : 'the shipped stand has the rule on from the moment the harness loads, as the page does', `as the harness loaded: ${AUTO_AT_LOAD} · after standUp: ${IRLIGHT.auto} · TPS_IRAUTO ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
    DEFAULTS.auto = IRLIGHT.auto; }
  return F.done();
});

// ---------------------------------------------------------------- irl-meter: the renderer's word on what the CPU calls dark
const E_LIT = 0.05, E_DARK = 0, E_EDGE = 0.004;   // (W/m² the planted renderer answers: 0.05 × the picture's bounce scale reads well over NVG.blackAt through the tube; 0.004 is over the line as the meter has it and under it × 0.35)
export const irlMeter = guarded(async () => {
  const F = family('irl-meter: what the CPU calls dark is put to the renderer\'s meter');
  const BRK = !!process.env.IRMETER_BREAK, D: number = NVM.NVG.blackAt, WAIT: number = ILM.IRL_METER.wait, SLOTS: number = ILM.IRL_METER.slots; const SNS: any = (await import(`${ROOT}/src/game/sense.ts`)).SENSE;
  const meterOn = () => { IRLIGHT.meter = !BRK; };   // (the red path: the switch held off — the rule never hears the renderer)
  let asked = 0, askedMost = 0, litAsked = 0; const cpuWas = SNS.cpu;
  try {
  for (const id of IDS) {
    const S = await settled(id, true, true, true, true); const { g, step } = S; const L = g.engine.lights, pl = g.player, fails: string[] = [], said: string[] = [];
    g.godMode = true; const X = g.engine.settings.exposure > 0 ? g.engine.settings.exposure : 1, scale0 = g.engine.settings.indirectScale;
    const samLit = () => L.ir.find((l: any) => l.owner === pl.char.id);
    const cands: number[][] = [[...pl.char.pos], ...doorsOf(S).map((e: any) => [e.at[0], 0, e.at[2]]), ...g.guards.filter((x: any) => x.team === 'hostile').map((x: any) => [x.char.pos[0], 0, x.char.pos[2]])];
    const dark = cands.find(P => tubeAt(g, P[0], P[2]) < D * 0.8), lit = cands.find(P => leastSeen(g, P, D * 1.2) >= D * 1.2);
    // ---- the hooks: what the renderer answers (undefined = nothing, as headless) to Sam's own meter, to the team's own meters and to this rule's keys; what the rule asks and forgets
    let own: number | undefined, plant: number | undefined; let frameAsks = 0, firstAsk = -1, forgot = 0;
    const at0 = g.lightAt, q0 = g.lightQuery, f0 = g.lightForget;
    g.lightAt = (k: string) => k.startsWith('irl') ? plant : k === 'playerChest' || k.startsWith('unitC') ? (own ?? at0(k)) : at0(k);
    g.lightQuery = (k: string, pos: any, skip?: number) => { if (k.startsWith('irl')) { frameAsks++; if (firstAsk < 0 && k.startsWith(`irl${pl.char.id}:`)) firstAsk = g.time; } q0(k, pos, skip); };
    g.lightForget = (k: string) => { if (k.startsWith('irl')) forgot++; f0(k); };
    /** his goggles up, stood at P, his goggles down afresh, `n` frames on: how many frames his light burned, when it first did after his goggles were down
     *  (and after HIS first question, where he asked one), its strength then, and the most asked in a frame */
    const fresh = async (P: number[], n: number) => { pl.nv = false; step(40); await quiet(() => g.teleportPlayer(P)); firstAsk = -1; pl.nv = true; let burn = 0, first = -1, firstQ = -1, k0 = 0, most = 0, mateBurn = 0, sum = 0, black = true, downAt = -1;
      for (let f = 0; f < n; f++) { frameAsks = 0; step(); most = Math.max(most, frameAsks); sum += frameAsks; black &&= tubeAt(g, pl.char.pos[0], pl.char.pos[2]) < D; if (downAt < 0 && pl.nvAmount > 0.5) downAt = g.time;
        const l = samLit(); if (l) { burn++; if (first < 0) { first = downAt < 0 ? 0 : g.time - downAt; firstQ = firstAsk < 0 ? -1 : g.time - firstAsk; k0 = l.intensity * X / IRLIGHT.power; } }
        if (f > 100) mateBurn += L.ir.filter((l: any) => l.owner !== pl.char.id).length; }   // (a teammate lit by the CPU's word before the switch came on is out its hold and its fade later: 2 s, and 40 frames went before these)
      return { burn, first, firstQ, k0, most, mateBurn, mean: sum / n, black, asks: firstAsk >= 0 }; };
    if (dark) {
      // (a) the renderer answers 'lit' on floor the CPU calls black: no light, not for a frame — Sam's or a teammate's
      meterOn(); own = E_LIT; plant = E_LIT; const A = await fresh(dark, 180);
      if (A.black) { asked++; askedMost = Math.max(askedMost, A.most);
        const carriers = 1 + mates(g).filter((x: any) => NVM.nvgDown(g, x)).length;
        if (!A.asks) fails.push('the rule on, the renderer answering, and it was never asked');
        if (A.burn) fails.push(`the renderer answers lit (${E_LIT} W/m²) on floor the CPU calls black: his light burned ${A.burn} frames of 180`);
        if (A.mateBurn) fails.push(`…and a teammate's burned (${A.mateBurn} light-frames) with every answer lit`);
        if (A.most > SLOTS * carriers || A.mean > carriers * SLOTS * 4 / 60 + 0.5) fails.push(`asked ${A.most} points in one frame, ${f2(A.mean)} a frame (${carriers} carriers, ${SLOTS} a beat each)`);
        said.push(`renderer lit on CPU-black floor at ${dark[0].toFixed(1)},${dark[2].toFixed(1)}: 0 frames of light, ${A.most} asked at most in a frame (${f2(A.mean)} a frame)`);
        // (b) the switch off, the same answers: it burns — the build before
        IRLIGHT.meter = false; const B = await fresh(dark, 60);
        if (B.black && (!B.burn || B.asks)) fails.push(`the switch off: ${B.burn ? '' : 'his light does not burn on CPU-black floor'}${B.asks ? ' the renderer is still asked' : ''}`);
        // (c) the renderer answers 'dark': burning inside a tenth of a second of his goggles, at full at once
        meterOn(); own = E_DARK; plant = E_DARK; const C = await fresh(dark, 60);
        if (C.black && (C.first < 0 || C.first > 0.1 || Math.abs(C.k0 - 1) > 1e-6)) fails.push(`the renderer answers dark: ${C.first < 0 ? 'no light in a second' : 'first light ' + f2(C.first) + ' s after his goggles at ' + f2(C.k0) + ' of full'}`);
        // (d) the picture's bounce: an answer over the line as the meter has it, under it × the picture's scale, is dark — and is not with the scale at 1
        own = E_EDGE; plant = E_EDGE; const G1 = await fresh(dark, 40); g.engine.settings.indirectScale = 1; const G2 = await fresh(dark, 130); g.engine.settings.indirectScale = scale0;
        const overAlone = NVM.tubeVis(g, E_EDGE) >= D, underScaled = NVM.tubeVis(g, E_EDGE * scale0) < D, tail = G2.burn;   // (G2 starts inside the hold of G1's light: only that it is OUT by the end is asked)
        if (G1.black && G2.black && overAlone && underScaled && (!G1.burn || !!samLit())) fails.push(`an answer of ${E_EDGE} W/m² (tube ${f2(NVM.tubeVis(g, E_EDGE))} alone, ${f2(NVM.tubeVis(g, E_EDGE * scale0))} × the picture's bounce scale ${scale0}): ${G1.burn ? '' : 'no light at the picture\'s scale; '}${samLit() ? 'still burning with the scale at 1 (' + tail + ' frames)' : ''}`);
        // (e) the renderer answers Sam's own meter 'lit' and none of the fan's points (starved): nothing until the wait is over, then the CPU's word
        meterOn(); own = E_LIT; plant = undefined; const N = await fresh(dark, 60);
        if (N.black && N.asks && (N.firstQ < WAIT - 0.02 || N.firstQ > WAIT + 0.1)) fails.push(`the fan's points never answered: first light ${N.firstQ < 0 ? 'never' : f2(N.firstQ) + ' s'} after his first question (the wait is ${WAIT} s, then the CPU's word)`);
        // (f) the renderer answers nothing at all (headless as it is): nothing asked, the CPU's word at once
        own = undefined; plant = E_LIT; const H = await fresh(dark, 30);
        if (H.black && (H.asks || H.first < 0 || H.first > 0.1 || Math.abs(H.k0 - 1) > 1e-6)) fails.push(`no renderer: ${H.asks ? 'it was asked; ' : ''}${H.first < 0 ? 'no light' : 'first light ' + f2(H.first) + ' s after his goggles at ' + f2(H.k0) + ' of full'}`);
        // (g) the senses on the CPU: the same
        SNS.cpu = true; own = E_LIT; plant = E_LIT; const P = await fresh(dark, 30); SNS.cpu = cpuWas;
        if (P.black && (P.asks || !P.burn)) fails.push(`the senses on the CPU: ${P.asks ? 'the renderer was asked' : ''}${P.burn ? '' : ' no light on CPU-black floor'}`);
        said.push(`switch off: burning · renderer dark: light ${f2(C.first)} s on at full · ${E_EDGE} W/m²: dark at the picture's scale, light at 1 · points unanswered: light ${f2(N.firstQ)} s after the question · no renderer / senses on the CPU: nothing asked, light at once`);
        // (h) goggles up: what he asked is forgotten
        meterOn(); own = E_LIT; plant = E_LIT; await fresh(dark, 30); forgot = 0; pl.nv = false; step(40);
        if (!BRK && forgot < 1) fails.push('goggles up: nothing he asked of the renderer was forgotten'); }
    }
    if (lit) {   // (i) where the CPU calls every floor he could look at light, nothing is asked whatever the renderer would say
      meterOn(); own = E_DARK; plant = E_DARK; const G = await fresh(lit, 60);
      if (leastSeen(g, pl.char.pos, D * 1.2) >= D * 1.2) { litAsked++; if (G.burn || G.asks) fails.push(`floor the CPU calls light: ${G.asks ? 'the renderer was asked' : ''}${G.burn ? ' his light burned' : ''}`); else said.push('CPU-lit floor: nothing asked, no light'); } }
    g.lightAt = at0; g.lightQuery = q0; g.lightForget = f0; g.engine.settings.indirectScale = scale0;
    F.verdict(!fails.length, `${id}: the renderer's answers planted, Sam's goggles brought down afresh`, fails.slice(0, 6).join('; ') || said.join(' · ') || 'no floor the CPU calls black among Sam\'s start, the doors and the enemies\' spots');
    reset(); SNS.cpu = cpuWas;
  }
  } finally { SNS.cpu = cpuWas; }
  F.verdict(asked > 0 && litAsked > 0, 'not vacuous: floor the CPU calls black and floor it calls light were both found, and the renderer was asked about the black', `black in ${asked} of ${IDS.length} scenarios, light in ${litAsked} · the most asked in one frame: ${askedMost}`);
  { const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`); const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
    const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_IRMETER;
    const want = frozen || word !== undefined ? word === '1' : true;
    IRLIGHT.meter = frozen ? !want : want; const S: any = await quiet(() => stage(IDS[0], 1)); const stood = IRLIGHT.meter;
    const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(S.g)));
    IRLIGHT.meter = true; const carries = snap().tables.IRLIGHT?.meter === true; const old = snap(); delete old.tables.IRLIGHT.meter; await quiet(() => JOURNAL.applyKnobs(S.g, old)); const without = IRLIGHT.meter;
    const own = snap(); own.tables.IRLIGHT.meter = true; IRLIGHT.meter = false; await quiet(() => JOURNAL.applyKnobs(S.g, own)); const withIt = IRLIGHT.meter;
    const row = (FROZEN_HOLDS as any)['IRLIGHT.meter'], kept = TFM.feelRange('IRLIGHT', 'meter') === null;
    F.verdict(stood === want && (frozen || METER_AT_LOAD === want) && typeof row === 'string' && /TPS_IRMETER=1/.test(row) && carries && without === false && withIt === true && kept,
      frozen ? 'the frozen stand holds the switch off (TPS_IRMETER=1 raises it); a recording from before the key replays with it off; the Team feel row is kept' : 'the shipped stand has the switch on from the moment the harness loads, as the page does; a recording from before the key replays with it off; the Team feel row is kept',
      `as the harness loaded: ${METER_AT_LOAD} · after standUp: ${stood} · TPS_IRMETER ${word ?? 'unset'} · FROZEN_HOLDS row: ${row ?? 'none'} · the journal carries the key: ${carries}; applyKnobs without it → ${without}, with it on → ${withIt} · kept by teamfeel.ts: ${kept}`);
    IRLIGHT.meter = stood; }
  return F.done();
});
