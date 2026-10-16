// A WHOLE RUN'S BOX UPLOADS, HASHED: preload this in front of any headless tool and every BoxWorld.upload of the run lands on a shadow device (shadow.ts); one line of
// hashes per upload (every GPU buffer, the CPU grid, the info block, the box counts) goes to UPWATCH_OUT at exit. Run the same tool the same way from two checkouts and
// diff the two files: equal files = the two trees left the same bytes on the GPU after every upload of that run.
//   UPWATCH_OUT=a.txt bun run --preload <this file> tools/qa/playthrough.ts --one block-four:1 --out a.json      (from each checkout: the tree watched is the cwd's)
import { writeFileSync } from 'node:fs';
import { shadowDevice, BUFS } from './shadow.ts';
const ROOT = process.cwd(), OUT = process.env.UPWATCH_OUT;
if (OUT) {
  await import(`${ROOT}/src/host/gpuEnums.ts`);
  const BX = await import(`${ROOT}/src/scene/boxes.ts`), MK = await import(`${ROOT}/src/scene/markings.ts`);
  const up0 = BX.BoxWorld.prototype.upload; const lines: string[] = []; let n = 0;
  const H = (u: Uint8Array) => Bun.hash.xxHash64(u).toString(16);
  const u8 = (t: any, len?: number) => new Uint8Array(t.buffer, t.byteOffset, len === undefined ? t.byteLength : len * t.BYTES_PER_ELEMENT);
  BX.BoxWorld.prototype.upload = function (this: any) {
    if (!this.__sh) {
      this.__sh = true; const d = shadowDevice(); this.device = d; const mk = (label: string, size: number) => d.createBuffer({ label, size });
      this.geoBuf = mk('boxGeo', this.maxBoxes * 32); this.matBuf = mk('boxMat', this.maxBoxes * 64 + MK.MARK_TABLE_ROWS * 16 + (BX.GB_ROWS ?? 0) * 16);
      this.cellBuf = mk('gridCells', this.cellStart.byteLength); this.itemBuf = mk('gridItems', this.items.byteLength);
      this.infoBuf = mk('sceneInfo', this.infoData.byteLength); this.capsuleBuf = mk('capsules', this.capsuleData.byteLength); this.visibleBuf = mk('visibleBoxes', this.visible.byteLength);
    }
    const r = up0.call(this); const w = this;
    const parts = BUFS.map((b: string) => H(w[b].bytes));
    parts.push(H(u8(w.cellStart)), String(w.itemCount), H(u8(w.items, 2 * w.itemCount)), w.globals.join('.'), H(u8(w.infoData)), String(w.all.length), String(w.statics.length));
    lines.push(n++ + ' ' + parts.join(' '));
    return r;
  };
  process.on('exit', () => { try { writeFileSync(OUT, lines.join('\n') + '\n'); } catch {} });
}
