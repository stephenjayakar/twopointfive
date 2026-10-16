// THE BOX UPLOAD AGAINST A BASE CHECKOUT, BYTE FOR BYTE: this tree's BoxWorld and the base's (BASE=<path to a checkout of the build to compare with>, default .worktrees/base)
// on recording devices, fed the same boxes; every GPU buffer and the CPU grid compared after every upload.
//   BASE=<checkout> bun run tools/qa/boxupload/throw.ts                   an upload that throws part way must leave the next good frame equal to the base's
import { resolve } from 'node:path';
const BR = process.env.BR ?? resolve(import.meta.dir, '../../..'), BASE = process.env.BASE ?? resolve(BR, '.worktrees/base');
await import(`${BR}/src/host/gpuEnums.ts`);
import { shadowDevice, BUFS } from './shadow.ts';
const A = await import(`${BASE}/src/scene/boxes.ts`), B = await import(`${BR}/src/scene/boxes.ts`);
const wa: any = new A.BoxWorld(shadowDevice()), wb: any = new B.BoxWorld(shadowDevice());
const st = [B.makeBox({ c: [5, 1, 5], h: [1, 1, 1] }), B.makeBox({ c: [9, 1, 9], h: [1, 1, 1] })]; const d = B.makeBox({ c: [12, 1, 12], h: [.3, .3, .3] });
const cmp = (t: string) => console.log(t, BUFS.filter(n => Bun.hash(wa[n].bytes) !== Bun.hash(wb[n].bytes)).join(',') || 'equal');
for (const w of [wa, wb]) { for (const b of st) w.addStatic(b); w.dynamics = [d]; w.upload(); } cmp('frame 0');
// (1) a static changes on the frame a dynamic is malformed
st[0].flags |= 3; st[0].emissive[0] = 2;
for (const w of [wa, wb]) { w.dynamics = [d, { c: [0, 0, 0] }]; try { w.upload(); } catch (e) { } w.dynamics = [d]; w.upload(); } cmp('after a throw in packBox + 1 good frame');
for (const w of [wa, wb]) w.upload(); cmp('… + another');
// (2) heal, then a throw in finishInfo (a rig without r0) on a frame the dynamics moved
st[0].emissive[0] = 3; for (const w of [wa, wb]) w.upload(); cmp('healed by the next static change');
d.c[0] = 20;
for (const w of [wa, wb]) { w.resetCapsules(); w.addCharacterCapsules(1, [1, 1, 1], Array.from({ length: 15 }, () => [1, 1, 1, .1, 1, 2, 1]), [1, 1, 1, 1]); w.rig = { kPad: 0 }; try { w.upload(); } catch (e) { } w.rig = null; w.upload(); } cmp('after a throw in applyRig + 1 good frame');
