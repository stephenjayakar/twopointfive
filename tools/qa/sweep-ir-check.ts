// The F8 sweep's two goggles rows ('goggles: infrared lights off' / 'one infrared light alone', src/ui/perfsweep.ts) against the renderer's own light set: the
// cap they write (render/lights.ts LightSet.irCap) really takes infrared lamps out of an upload, the first that burns alone under 1, gives them their slots back
// when it lifts, and never touches the list the game reads nor a light that is not infrared. No level, no GPU: the device is a stand-in that takes every write.
//   bun run tools/qa/sweep-ir-check.ts   (exit 0 = all pass)
import { PerfSweep } from '../../src/ui/perfsweep';
import { LightSet, type RtLight } from '../../src/render/lights';
let now = 0; (performance as any).now = () => now;
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
(globalThis as any).GPUBufferUsage ??= new Proxy({}, { get: () => 0 });
const device: any = { createBuffer: () => ({}), queue: { writeBuffer() {} } };
const light = (name: string, group: string): RtLight => ({ name, group, kind: 1, pos: [0, 2, 0], dir: [0, 0, 1], color: [1, 1, 1], intensity: 4, range: 22, innerDeg: 40, outerDeg: 65, radius: 0.04, volumetric: 0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 4 });
const ls = new LightSet(device), lamps = ['ir_sam', 'ir_1', 'ir_2', 'ir_3', 'ir_4'].map(n => light(n, 'infrared'));
ls.lights.push(light('ceiling', 'room')); ls.ir.push(...lamps); ls.tube = true;
const slots = () => lamps.map(l => l.slot ?? -1).join(',');
check(ls.irCap === Infinity, 'the cap is off as the light set is made');
ls.upload(0); check(ls.irCount === 5 && ls.activeCount === 6 && slots() === '1,2,3,4,5' && ls.firstTransientSlot === 6, `no cap: all five are taken, after the room's own light, and none of them is a transient (slots ${slots()})`);
ls.irCap = 1; ls.upload(0); check(ls.irCount === 1 && ls.activeCount === 2 && slots() === '1,-1,-1,-1,-1', `cap 1: the first lamp alone, in its old slot; the others have lost theirs (${slots()})`);
ls.irCap = 0; ls.upload(0); check(ls.irCount === 0 && ls.activeCount === 1 && slots() === '-1,-1,-1,-1,-1' && ls.lights[0].slot === 0, 'cap 0: none, and the room\'s own light is where it was');
lamps[0].enabled = false; ls.irCap = 1; ls.upload(0); check(ls.irCount === 1 && slots() === '-1,1,-1,-1,-1', `cap 1 with the first lamp dark: the first that burns is the one taken (${slots()})`); lamps[0].enabled = true;
ls.irCap = Infinity; ls.upload(0); check(ls.irCount === 5 && slots() === '1,2,3,4,5' && ls.ir.length === 5 && ls.ir.every((l, i) => l === lamps[i]), 'cap off: all five again, and the list the game reads was never written');
ls.tube = false; ls.upload(0); check(ls.irCount === 0 && slots() === '-1,-1,-1,-1,-1', 'goggles up: none, whatever the cap'); ls.tube = true; ls.upload(0);
const ev: any[] = [], rec: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { ev.push(JSON.parse(t)); } };
const sw = new PerfSweep({ settings: { renderScale: 0.8 }, width: 100, height: 50, timer: { enabled: true }, lights: ls } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec, () => {});
sw.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['irLight', 'irLightOne'] });
const rows = ev.find(x => x.op === 'begin')?.rows ?? [];
check(sw.active && rows.length === 2 && rows.every((r: any) => r.from.irLights === 5), `on the real light set both rows arm (${JSON.stringify(rows)})`);
const seen: Record<string, Set<number>> = {};
for (let i = 0; i < 400 && sw.active; i++) { now += 16; sw.tick(); if (!sw.active) break; ls.upload(0); (seen[sw.flipped] ??= new Set()).add(ls.irCount); }
ls.upload(0);
const only = (id: string, n: number) => !!seen[id] && seen[id].size === 1 && seen[id].has(n);
check(sw.last === 'done' && only('irLight', 0) && only('irLightOne', 1) && only('base', 5), `through a whole sweep the real upload takes 0 under the first row, 1 under the second, 5 between (${Object.entries(seen).map(([k, v]) => `${k}: ${[...v].join('/')}`).join(' · ')})`);
check(ls.irCap === Infinity && ls.irCount === 5 && ls.ir.every((l, i) => l === lamps[i]), 'and after it the cap is off, the five are in the picture, the list untouched');
process.exit(red ? 1 : 0);
