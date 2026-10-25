// The look prototype's "Lamps by day" row (render/lights.ts LightSet.localK, engine.ts lookLamps) against the renderer's own light set: the number scales the
// place's steady lamps and the flashlights in the UPLOAD alone, leaves the sun, a flash, a lightning stroke, an infrared illuminator, a device's sight cone
// and the Team & kit figure's staging as they are, never writes the list the game reads, and at 1 the upload is word for word what it was. No level, no
// GPU: the device is a stand-in that takes every write.
//   bun run tools/qa/looklamps-check.ts   (exit 0 = all pass; LOOKLAMPS_BREAK=1 uploads without the number and must fail)
import { LightSet, type RtLight } from '../../src/render/lights';
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
(globalThis as any).GPUBufferUsage ??= new Proxy({}, { get: () => 0 });
const device: any = { createBuffer: () => ({}), queue: { writeBuffer() {} } };
const light = (name: string, group: string, kind: 0 | 1 | 2, intensity: number, more: Partial<RtLight> = {}): RtLight => ({ name, group, kind, pos: [0, 2, 0], dir: [0, -1, 0], color: [1, 0.5, 0.25], intensity, range: 22, innerDeg: 40, outerDeg: 65, radius: 0.04, volumetric: 0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: intensity, ...more });
const ls = new LightSet(device);
const scaled = [light('bulb', 'tea', 0, 26), light('lantern', 'bay', 0, 4.5), light('flashlight0', 'flashlights', 1, 70), light('seen out', 'tea', 0, 0, { enabled: false, fogGhost: 8 })];
const kept = [light('sun', 'hour', 2, 6), light('flash', 'transient', 0, 300, { ttl: 0.05 }), light('stroke', 'weather', 2, 20, { transient: true }), light('cam_cone', 'devices', 1, 1.1), light('kitview_fill', 'kitview', 0, 3)];
ls.lights.push(...scaled, ...kept); ls.ir.push(light('ir_sam', 'infrared', 1, 4)); ls.tube = true;
const all = [...scaled, ...kept, ls.ir[0]], f32 = (ls as any).f32 as Float32Array;
const red0 = (l: RtLight) => f32[(l.slot ?? -1) * 16 + 8], words = () => Array.from(((ls as any).u32 as Uint32Array).subarray(0, ls.activeCount * 16)).join(',');
const was = all.map(l => l.intensity);
ls.upload(0); const first = words(), at1 = all.map(red0);
check(ls.localK === 1 && ls.activeCount === all.length, `the number is 1 as the light set is made, and all ${all.length} lights are taken`);
const K = 0.25; ls.localK = process.env.LOOKLAMPS_BREAK === '1' ? 1 : K; ls.upload(0);
check(scaled.every((l, i) => Math.abs(red0(l) - at1[i] * K) < 1e-6), `at ${K} a bulb, a lantern, a flashlight and a lamp remembered in the fog go up at ${K} of their strength (${scaled.map(l => red0(l).toFixed(3)).join(', ')})`);
check(kept.every((l, i) => red0(l) === at1[scaled.length + i]) && red0(ls.ir[0]) === at1[all.length - 1], 'the sun, a flash, a lightning stroke, a device\'s cone, the kit figure\'s lamp and an infrared illuminator go up as they were');
check(all.every((l, i) => l.intensity === was[i]), 'and no light\'s own intensity was written: the game\'s readers of the list see the authored one');
ls.localK = 1; ls.upload(0);
check(words() === first, 'back at 1 the upload is word for word the first one');
process.exit(red ? 1 : 0);
