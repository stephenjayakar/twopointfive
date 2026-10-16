// The WebGPU enum globals the CPU-side render modules name when they build their (fake) resources — installed only where the platform has none (bun; a bare JS global). A
// side-effect module: import it FIRST in a headless host (src/host/stub.ts does) so it evaluates before any module that reads one at load. In the browser every `??=` is a no-op.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G = globalThis as any;
G.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
G.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
G.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
G.GPUMapMode ??= { READ: 1, WRITE: 2 };
G.GPUColorWrite ??= { RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 };   // (the TAAU reactive-mask target in render/particles.ts names a write mask)
export {};
