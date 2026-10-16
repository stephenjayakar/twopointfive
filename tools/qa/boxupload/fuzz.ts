// THE BOX UPLOAD AGAINST A BASE CHECKOUT, BYTE FOR BYTE: this tree's BoxWorld and the base's (BASE=<path to a checkout of the build to compare with>, default .worktrees/base)
// on recording devices, fed the same boxes; every GPU buffer and the CPU grid compared after every upload.
//   BASE=<checkout> bun run tools/qa/boxupload/fuzz.ts <seed> <frames>   random edits to statics / dynamics / glass / markings / switches; prints 'fails 0' when equal throughout
import { resolve } from 'node:path';
const BR = process.env.BR ?? resolve(import.meta.dir, '../../..'), BASE = process.env.BASE ?? resolve(BR, '.worktrees/base');
await import(`${BR}/src/host/gpuEnums.ts`);
import { shadowDevice, BUFS } from './shadow.ts';
const A = await import(`${BASE}/src/scene/boxes.ts`), B = await import(`${BR}/src/scene/boxes.ts`);
const { TableDevice } = await import(`${BR}/src/host/tableDevice.ts`);
const { buildLevel } = await import(`${BR}/src/scene/level.ts`);
const SEED = +(process.argv[2] ?? 1), FR = +(process.argv[3] ?? 20000);
let a = SEED >>> 0; const R = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (n: number) => Math.floor(R() * n);
const F = B.BoxFlag;
const wa: any = new A.BoxWorld(shadowDevice()), wb: any = new B.BoxWorld(shadowDevice());
const td = new TableDevice((_n: string, bytes: number, ring: number) => new ArrayBuffer(bytes * ring)); const wt: any = new B.BoxWorld(td.asGpuDevice());
const worlds = [wa, wb, wt];
const level = buildLevel(); const lib = level.boxes;
const clone = (b: any) => ({ ...b, c: [...b.c], h: [...b.h], albedo: [...b.albedo], emissive: [...b.emissive], rot: b.rot ? [...b.rot] : undefined });
let statics: any[] = lib.slice(0, 300 + ri(400)).map(clone); let dyn: any[] = [];
const rndBox = (big = 0) => B.makeBox({ c: [R() * 44 - 2, R() * 4, R() * 32 - 2], h: big === 2 ? [6 + R() * 20, 0.1 + R(), 6 + R() * 12] : big === 1 ? [4.4, 0.5, 4.9] : [0.05 + R() * 1.2, 0.05 + R() * 1.5, 0.05 + R() * 1.2], yaw: R() < 0.5 ? 0 : R() * 6.3, albedo: [R(), R(), R()], emissive: R() < 0.1 ? [R(), 0, 0] : [0, 0, 0], flags: F.Dynamic | (R() < 0.1 ? F.NoShadow : 0) | (R() < 0.1 ? F.NoPrimary : 0), owner: ri(4), mkey: R() < 0.5 ? ri(1000) + 1 : undefined, rot: R() < 0.1 ? norm([R() - .5, R() - .5, R() - .5, R() - .5]) : undefined, marks: R() < 0.05 ? lib.find((x: any, k: number) => x.marks && k > ri(lib.length))?.marks : undefined });
function norm(q: number[]) { const l = Math.hypot(...q) || 1; return q.map(x => x / l); }
// glass state shared
const broken = new Map<number, number>();
const fillA = (si: number, dst: Float32Array, off: number) => { const v = broken.get(si); if (v === undefined) return false; for (let k = 0; k < 20; k++) dst[off + k] = v + k + si; return true; };
const fillB = (si: number, dst: Float32Array, off: number) => { const v = broken.get(si); if (v === undefined) return false; for (let k = 0; k < 30; k++) dst[off + k] = -(v + k); return true; };
let fill: any = null, gridOn = true, glassOn = true, marksOn = true, motion = true, focus: any = [20, 0, 14];
let caps = 0;
const eq = (x: Uint8Array, y: Uint8Array) => { if (x.length !== y.length) return -2; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return i; return -1; };
const u8 = (t: any, n?: number) => new Uint8Array(t.buffer, t.byteOffset, n === undefined ? t.byteLength : n * t.BYTES_PER_ELEMENT);
let fails = 0; const opsLog: string[] = [];
const LBL: any = { geoBuf: 'boxGeo', matBuf: 'boxMat', visibleBuf: 'visibleBoxes', cellBuf: 'gridCells', itemBuf: 'gridItems', infoBuf: 'sceneInfo', capsuleBuf: 'capsules' };
for (let f = 0; f < FR; f++) {
  const ops: string[] = []; const nops = R() < 0.45 ? 0 : 1 + ri(3);
  for (let k = 0; k < nops; k++) {
    const o = ri(34); ops.push(String(o));
    switch (o) {
      case 0: case 1: dyn.push(rndBox()); break;
      case 2: if (dyn.length) dyn.splice(ri(dyn.length), 1); break;
      case 3: if (dyn.length) { if (R() < 0.5) dyn.pop(); else { const b = dyn[ri(dyn.length)]; const e = R() * 0.2; b.c[1] += e; b.h[1] += e; } } break;
      case 4: if (dyn.length) { const b = dyn[ri(dyn.length)]; b.c[0] += (R() - .5) * 0.01; b.c[1] += (R() - .5) * 0.002; } break;   // tiny: mostly the same cells
      case 5: if (dyn.length) { const b = dyn[ri(dyn.length)]; b.c[0] += (R() - .5) * 3; b.c[2] += (R() - .5) * 3; } break;
      case 6: if (dyn.length) { const b = dyn[ri(dyn.length)]; b.flags ^= [F.NoShadow, F.NoPrimary, F.Glass][ri(3)]; } break;
      case 7: dyn.push(rndBox(2)); break;
      case 8: if (dyn.length > 1) { const i = ri(dyn.length), j = ri(dyn.length); const t = dyn[i]; dyn[i] = dyn[j]; dyn[j] = t; } break;
      case 9: if (R() < 0.3) dyn = []; break;
      case 10: if (R() < 0.05) for (let q = 0; q < 420; q++) dyn.push(rndBox(1)); break;   // item buffer regrowth
      case 11: if (dyn.length > 100) dyn.length = ri(50); break;
      case 12: if (statics.length) { const b = statics[ri(statics.length)]; b.flags ^= (F.NoPrimary | F.NoShadow); } break;   // destruction's hide / restore
      case 13: if (statics.length) { const b = statics[ri(statics.length)]; b.emissive[0] = R(); } break;
      case 14: if (statics.length) { const b = statics[ri(statics.length)]; b.c[ri(3)] += R() - .5; } break;
      case 15: statics.push(clone(lib[ri(lib.length)])); break;
      case 16: if (statics.length) statics.pop(); break;
      case 17: if (statics.length) statics.splice(ri(statics.length), 1); break;
      case 18: if (statics.length) { const i = ri(statics.length); statics[i] = clone(statics[i]); } break;   // same values, new object
      case 19: if (statics.length) { const i = ri(statics.length); statics[i] = clone(lib[ri(lib.length)]); } break;   // same count, other box
      case 20: if (R() < 0.1) { statics = lib.slice(ri(200), 300 + ri(480)).map(clone); } break;   // workbench swap
      case 21: if (statics.length && dyn.length) { statics.pop(); dyn.unshift(rndBox()); } break;   // all.length kept, nStat −1
      case 22: if (dyn.length) { dyn.shift(); statics.push(clone(lib[ri(lib.length)])); } break;    // all.length kept, nStat +1
      case 23: gridOn = !gridOn; break;
      case 24: glassOn = !glassOn; break;
      case 25: marksOn = !marksOn; break;
      case 26: motion = !motion; break;
      case 27: focus = [R() * 40, 0, R() * 28]; break;
      case 28: fill = [null, fillA, fillB][ri(3)]; break;
      case 29: { const g = statics.map((b, i) => b.flags & F.Glass ? i : -1).filter(i => i >= 0); if (g.length) broken.set(g[ri(g.length)], ri(100)); } break;
      case 30: if (R() < 0.5) broken.clear(); else { const ks = [...broken.keys()]; if (ks.length) broken.delete(ks[ri(ks.length)]); } break;
      case 31: { const t = [0.0125, 0.025, 0.05][ri(3)]; for (const w of worlds) w.repackMarkings(t); } break;
      case 32: for (const w of worlds) w.resetMarkTable(); break;
      case 33: caps = ri(9); break;
    }
  }
  if (statics.length + dyn.length > 4000) dyn.length = 0;
  td.beginFrame(f);
  for (const w of worlds) {
    w.statics.length = 0; for (const b of statics) w.statics.push(b); if (R.length === 0 && ops.length) w.staticsDirty = true;
    w.dynamics = dyn; w.gridEnabled = gridOn; w.glassEnabled = glassOn; w.markingsEnabled = marksOn; w.motionIds = motion; w.glassFocus = focus; w.glassCellFill = fill;
    w.resetCapsules(); for (let c = 0; c < caps; c++) w.addCharacterCapsules(c + 1, [0.5, 0.4, 0.3], Array.from({ length: 15 }, (_, i) => [c, i * 0.1 + (f % 7) * 0.01, 2, 0.1, c, i * 0.1 + 0.1, 2]), [c, 1, 2, 1.5]);
    w.upload();
  }
  opsLog.push(ops.join(',')); if (opsLog.length > 6) opsLog.shift();
  const bad: string[] = [];
  for (const n of BUFS) { const i = eq(wa[n].bytes, wb[n].bytes); if (i !== -1) bad.push(`GPU ${n}@${i}`); }
  for (const n of BUFS) { const v = td.tables.get(LBL[n])!.slots[td.slot]; const ref = wa[n].bytes; const L = Math.min(v.length, ref.length); const i = eq(v.subarray(0, L), ref.subarray(0, L)); if (i !== -1) bad.push(`TABLE ${n}@${i}`); }
  if (eq(u8(wa.cellStart), u8(wb.cellStart)) !== -1) bad.push("cpu cellStart");
  if (wa.itemCount !== wb.itemCount) bad.push('cpu itemCount'); else if (eq(u8(wa.items, 2 * wa.itemCount), u8(wb.items, 2 * wb.itemCount)) !== -1) bad.push('cpu items');
  if (wa.items.length !== wb.items.length) bad.push('items.length');
  if (JSON.stringify(wa.globals) !== JSON.stringify(wb.globals)) bad.push('globals');
  if (JSON.stringify(wa.gridStats) !== JSON.stringify(wb.gridStats)) bad.push('gridStats ' + JSON.stringify(wa.gridStats) + JSON.stringify(wb.gridStats));
  if (eq(u8(wa.infoData), u8(wb.infoData)) !== -1) bad.push('infoData');
  if (eq(u8(wa.geoU32), u8(wb.geoU32)) !== -1) bad.push('geoData'); if (eq(u8(wa.matData), u8(wb.matData)) !== -1) bad.push('matData');
  if (JSON.stringify(wa.glassList) !== JSON.stringify(wb.glassList)) bad.push('glassList');
  for (let q = 0; q < 2; q++) { const ro = [R() * 40, 1 + R(), R() * 28], rd = norm([R() - .5, (R() - .5) * .2, R() - .5]); if (JSON.stringify(wa.raycast(ro, rd)) !== JSON.stringify(wb.raycast(ro, rd))) bad.push('raycast'); }
  if (bad.length) { console.log(`frame ${f} nStat ${statics.length} nDyn ${dyn.length} grid ${gridOn}: ${bad.join(' | ')}  ops: ${opsLog.join(' ; ')}`); if (++fails > 8) break; }
}
console.log(`seed ${SEED} frames ${FR} fails ${fails} builds ${JSON.stringify(wb.gridBuilds)} items.len ${wb.items.length} bytes base ${wa.device.stats.bytes} branch ${wb.device.stats.bytes}`);
