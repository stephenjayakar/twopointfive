// Headless check of the viewer's scene ▸ variant table and its pure modules (no GPU / DOM): every variant applies onto a fake runtime with
// indices in range and consistent kit, a switch leaves no residue of the previous variant, the gait / LONG paste blocks keep their shape, the rig
// adj resolvers answer for every node kind.   bun run tools/qa/viewer-scenes.ts   (exit 1 on failure)
import { SCENES, applyVariant, findVariant } from '../../src/viewer/scenes.ts';
import { makeState, TAC_SHOTS, UPPERS, STANCES, PATHS } from '../../src/viewer/state.ts';
import { gaitSource, GAIT_GROUPS, setAllOff, DEFAULTS, GaitMeter } from '../../src/viewer/gait.ts';
import { longSource, shippedAdj, rigObjectFor, allChangedSource, rigChanged } from '../../src/viewer/sheet.ts';
import { LONG_STANCES } from '../../src/game/character.ts';

let fails = 0; const bad = (m: string) => { fails++; console.log('FAIL', m); };
// fake runtime for applyVariant
const calls: string[] = [];
const rt: any = { st: makeState(), char: { alive: true, bodyYaw: 0 }, spawn() { calls.push('spawn'); this.char.alive = true; }, resetMotion() { calls.push('reset'); }, die(k: string) { calls.push('die:' + k); this.char.alive = false; }, smokeCan() { calls.push('smoke'); }, stunCan() { calls.push('stun'); }, toss(k: string) { calls.push('toss:' + k); }, frame(k: string) { calls.push('frame:' + k); } };
const ids = new Set<string>();
for (const s of SCENES) for (const v of s.variants) {
  const key = s.id + '/' + v.id; if (ids.has(key)) bad('duplicate ' + key); ids.add(key);
  calls.length = 0;
  const r = applyVariant(rt, s.id, v.id); if (!r || r.id !== v.id) bad('apply ' + key);
  const st = rt.st;
  if (st.sceneId !== s.id || st.variantId !== v.id) bad('ids ' + key);
  if (!(st.upper >= 0 && st.upper < UPPERS.length)) bad('upper ' + key);
  if (!(st.stance >= 0 && st.stance < STANCES.length)) bad('stance ' + key);
  if (!(st.tacShot >= 0 && st.tacShot < TAC_SHOTS.length)) bad('tacShot ' + key);
  if (!(st.path >= 0 && st.path < PATHS.length)) bad('path ' + key);
  if (!(st.longStance >= 0 && st.longStance <= 4)) bad('longStance ' + key);
  if (st.carbine && !st.guard) bad('carbine without guard ' + key);
  if (!(st.rifle >= 0 && st.rifle <= 2)) bad('rifle idx ' + key);
  if (st.rifle === 2 && (st.guard || st.carbine)) bad('Sam\'s rifle in the hands on the guard kit ' + key);   // (one long gun in the hands at a time: the FN2000 is the player kit's)
  if (st.hold.on && st.hold.who === 1 && !st.guard) bad('held man not guard ' + key);
  if (st.hold.on && st.hold.who === 0 && st.guard) bad('holder is guard ' + key);
  if (!(st.hold.phase >= 0 && st.hold.phase < 4 && st.hold.variant >= 0 && st.hold.variant < 2)) bad('hold idx ' + key);
  if (!calls.includes('reset')) bad('no resetMotion ' + key);
  if (v.gait && !v.groups.includes('locomotion')) bad('gait variant without locomotion group ' + key);
}
// a switch fully resets: apply a heavy variant then a light one and compare to applying the light one from fresh
applyVariant(rt, 'hold', 'whip'); applyVariant(rt, 'door', 'push'); applyVariant(rt, 'sam', 'walk');
const a = JSON.stringify(rt.st);
const rt2: any = { ...rt, st: makeState(), char: { alive: true, bodyYaw: 0 } }; applyVariant(rt2, 'sam', 'walk');
if (a !== JSON.stringify(rt2.st)) { bad('variant switch leaves residue'); const A = JSON.parse(a), B = rt2.st; for (const k of Object.keys(B)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) console.log('  differs:', k, JSON.stringify(A[k]), 'vs', JSON.stringify(B[k])); }
if (!findVariant('guard', 'carbine-shoulder')) bad('findVariant');
// gait block byte-compat: header line + 10 more lines, same shape as the old lab
const gs = gaitSource().split('\n'); if (gs.length !== 11 || !gs[0].startsWith('// gait lab, ') || !gs[1].startsWith('export const defaultAnimParams: AnimParams = {walkSpeed: ')) bad('gait source shape:\n' + gaitSource());
setAllOff(true); setAllOff(false); for (const [k, d] of DEFAULTS) if (k.o[k.k] !== d) bad('allOff round trip ' + k.label);
const ls = longSource().split('\n'); { const N = LONG_STANCES.length; if (ls.length !== 2 * (N + 2) + 1 || !ls[0].startsWith('export const LONG: ') || !ls[1].startsWith('  patrolLong: { side: ') || !ls[1].includes(', steady: ') || !ls[N + 2].startsWith('export const LONG_CROUCH: ') || !ls[N + 3].startsWith('  patrolLong: { side: ') || !ls[ls.length - 1].startsWith('export const LONG_STEADY = { tau: ')) bad('long source shape:\n' + longSource()); }   // the standing table, the crouched table (one carriage a line each, `steady` the last field), then the LONG_STEADY one-liner — the three statements as character.ts has them
for (const p of ['pistol', 'pistol.slide', 'goggles.on', 'goggles.on.housing', 'goggles.off.lenses', 'torch.lens', 'carbine.gripL', 'knife.blade', 'holster', 'emitters.jetOff', 'guardPistol', 'sc20k', 'sc20k.hull', 'sc20k.gripL', 'sc20k.slung']) { const a2 = shippedAdj(p); if (!a2 || a2.off.length !== 3) bad('shippedAdj ' + p); const ro = rigObjectFor(p); if (p !== 'holster' && !p.startsWith('emitters') && !ro) bad('rigObjectFor ' + p); }
if (rigChanged()) bad('rig reads as changed at load');
if (allChangedSource({ get: () => null }) !== '') bad('allChanged not empty at load');
console.log(fails ? `${fails} FAILURES` : `OK — ${ids.size} variants over ${SCENES.length} scenes; gait / LONG sources shaped; adj resolvers fine`);
process.exit(fails ? 1 : 0);
