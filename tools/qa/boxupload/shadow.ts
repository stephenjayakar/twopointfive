// a device whose writeBuffer lands in a shadow byte array per buffer
export function shadowDevice() {
  const stats = { writes: 0, bytes: 0 };
  const dev: any = {
    stats,
    createBuffer(d: any) { return { label: d.label, size: d.size, bytes: new Uint8Array(d.size), dead: false, destroy() { this.dead = true; } }; },
    queue: { writeBuffer(buf: any, off: number, data: any, dOff = 0, size?: number) {
      if (buf.dead) throw new Error('write to destroyed ' + buf.label);
      let src: Uint8Array;
      if (ArrayBuffer.isView(data)) { const el = (data as any).BYTES_PER_ELEMENT ?? 1; src = new Uint8Array(data.buffer, data.byteOffset + dOff * el, size !== undefined ? size * el : data.byteLength - dOff * el); }
      else src = new Uint8Array(data, dOff, size !== undefined ? size : data.byteLength - dOff);
      if (off % 4 || src.byteLength % 4) throw new Error('alignment ' + buf.label);
      if (off + src.byteLength > buf.size) throw new Error('overrun ' + buf.label);
      buf.bytes.set(src, off); stats.writes++; stats.bytes += src.byteLength;
    } },
  };
  return dev;
}
export const BUFS = ['geoBuf', 'matBuf', 'visibleBuf', 'cellBuf', 'itemBuf', 'infoBuf', 'capsuleBuf'];
