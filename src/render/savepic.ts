// A SAVE'S PICTURE, READ BACK WITHOUT A STALL (the host's: main.ts takeSavePictures; the switch is host/savepic.ts SAVEPIC).
//
// The picture was `drawImage(the WebGPU canvas)` into a small 2D canvas straight after the frame was drawn: the browser reads the whole canvas back from the
// GPU for that, on the page's own thread, and waits for the frame it has just been handed to finish first — tens of milliseconds on a frame that had 16.
// Here the frame is boxed down to the picture's own size ON the GPU (one small pass sampling the canvas's texture, 4 × 4 taps to a pixel) and that small
// target is copied to a buffer and mapped: the page never waits, and the pixels arrive a frame or a few later. The canvas's texture must be one a pass may
// sample (gpu/device.ts initGpu `canvasRead`); without that, or until the pipeline is built, the host takes the picture the old way.
import { makeShader } from '../gpu/device';

const WGSL = /* wgsl */`
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return V(vec4f(c * 2.0 - 1.0, 0.0, 1.0), vec2f(c.x, 1.0 - c.y));
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let dx = dpdx(v.uv); let dy = dpdy(v.uv);   // one picture pixel's reach on the frame
  var s = vec3f(0.0);
  for (var j = 0; j < 4; j++) { for (var i = 0; i < 4; i++) {
    let o = (vec2f(f32(i), f32(j)) + 0.5) / 4.0 - 0.5;
    s += textureSampleLevel(src, smp, v.uv + dx * o.x + dy * o.y, 0.0).rgb;
  } }
  return vec4f(s / 16.0, 1.0);
}`;

export class SavePicture {
  private pipe: GPURenderPipeline | null = null;
  private target: GPUTexture | null = null;
  /** pictures asked for and not yet handed back (a read-out; nothing waits on it) */
  pending = 0;
  /** how many were handed back, and how many came to nothing */
  taken = 0; lost = 0;
  constructor(private device: GPUDevice, private samp: GPUSampler) {
    const mod = makeShader(device, WGSL, 'savepic');
    // (made by the device's own call, off the boot's count of pipelines: one small optional pass must not read as one of the programs a boot or a cut waits on)
    device.createRenderPipelineAsync({ label: 'save picture', layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] }, primitive: { topology: 'triangle-list' } })
      .then(p => { this.pipe = p; }, e => { console.warn(`save picture: the pass was not built (${e?.message ?? e}); the picture is taken the old way`); });
  }
  /** built, and so able to take one */
  get ready(): boolean { return !!this.pipe; }
  /** The frame in `frame` (the canvas's current texture, asked in the frame callback that drew it) boxed down to w × h: RGBA8, rows top to bottom, alpha full.
   *  Null when it came to nothing (the device lost, a pass the device refused): the save stands without a picture. */
  async take(frame: GPUTexture, w: number, h: number): Promise<Uint8ClampedArray | null> {
    const dev = this.device, pipe = this.pipe; if (!pipe) return null;
    this.pending++;
    try {
      if (!this.target || this.target.width !== w || this.target.height !== h) { this.target?.destroy(); this.target = dev.createTexture({ label: 'save picture', size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }); }
      const bpr = Math.ceil(w * 4 / 256) * 256;
      const buf = dev.createBuffer({ label: 'save picture', size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      // (a pass the device refuses does not throw: its error is read from a scope pushed and popped in this one task, so no other pass's error lands in it)
      dev.pushErrorScope('validation'); let refused: Promise<GPUError | null>;
      try {
        const bg = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: frame.createView() }, { binding: 1, resource: this.samp }] });
        const enc = dev.createCommandEncoder({ label: 'save picture' });
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.target.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
        pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.draw(3); pass.end();
        enc.copyTextureToBuffer({ texture: this.target }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
        dev.queue.submit([enc.finish()]);
      } finally { refused = dev.popErrorScope().catch(() => null); }
      try {
        await buf.mapAsync(GPUMapMode.READ);
        if (await refused) { buf.unmap(); this.lost++; return null; }
        const src = new Uint8Array(buf.getMappedRange()), out = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) out.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
        buf.unmap(); this.taken++; return out;
      } finally { buf.destroy(); }
    } catch { this.lost++; return null; }
    finally { this.pending--; }
  }
}
