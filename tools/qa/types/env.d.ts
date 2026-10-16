// Hand-written declarations for the slice of bun's / node's runtime that tools/qa/*.ts uses: the `process` and `Bun` globals, `Buffer`, `require`, `import.meta`'s
// bun fields and the `node:` / `bun:` modules the tools import. The repo has NO npm dependencies (so no @types/bun, no @types/node): this file is what
// `tsc -p tools/qa/tsconfig.json` knows of the runtime. Kept to what the tools call — extend it when a tool makes a new call (tsc will say so). Loose where the
// real signature is wide (spawn, the fs options), exact where a mistake is cheap to catch (process.exit never returns, env values may be undefined).

interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
  readUInt8(o?: number): number; readUInt16BE(o?: number): number; readUInt16LE(o?: number): number; readUInt32BE(o?: number): number; readUInt32LE(o?: number): number;
  readInt32BE(o?: number): number; readInt32LE(o?: number): number; readFloatLE(o?: number): number; readDoubleLE(o?: number): number;
  writeUInt8(v: number, o?: number): number; writeUInt16BE(v: number, o?: number): number; writeUInt16LE(v: number, o?: number): number;
  writeUInt32BE(v: number, o?: number): number; writeUInt32LE(v: number, o?: number): number; writeInt32BE(v: number, o?: number): number; writeInt32LE(v: number, o?: number): number;
  write(s: string, o?: number, len?: number | string, enc?: string): number;
  copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  equals(other: Uint8Array): boolean;
  latin1Slice(start?: number, end?: number): string; utf8Slice(start?: number, end?: number): string;
}
declare const Buffer: {
  from(data: string | ArrayLike<number> | ArrayBufferLike | ArrayBufferView, encodingOrOffset?: string | number, length?: number): Buffer;
  alloc(size: number, fill?: number | string): Buffer;
  allocUnsafe(size: number): Buffer;
  concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
  byteLength(s: string | ArrayBufferView | ArrayBufferLike, encoding?: string): number;
  isBuffer(x: unknown): x is Buffer;
};

declare module 'node:fs' {
  type PathLike = string | URL;
  type Enc = string | { encoding: string; flag?: string };
  export function readFileSync(path: PathLike | number, options: Enc): string;
  export function readFileSync(path: PathLike | number, options?: { encoding?: null; flag?: string } | null): Buffer;
  export function writeFileSync(path: PathLike | number, data: string | ArrayBufferView | ArrayBufferLike, options?: any): void;
  export function appendFileSync(path: PathLike | number, data: string | ArrayBufferView, options?: any): void;
  export function existsSync(path: PathLike): boolean;
  export function mkdirSync(path: PathLike, opts?: { recursive?: boolean; mode?: number }): string | undefined;
  export function mkdtempSync(prefix: string, opts?: any): string;
  export function readdirSync(path: PathLike): string[];
  export function readdirSync(path: PathLike, opts: { withFileTypes: true; recursive?: boolean }): { name: string; isFile(): boolean; isDirectory(): boolean }[];
  export function readdirSync(path: PathLike, opts: any): string[];
  export function statSync(path: PathLike): { mtimeMs: number; mtime: Date; size: number; isFile(): boolean; isDirectory(): boolean };
  export function rmSync(path: PathLike, opts?: { recursive?: boolean; force?: boolean }): void;
  export function unlinkSync(path: PathLike): void;
  export function renameSync(a: PathLike, b: PathLike): void;
  export function copyFileSync(a: PathLike, b: PathLike): void;
  export function openSync(path: PathLike, flags?: string | number, mode?: number): number;
  export function closeSync(fd: number): void;
  export function readSync(fd: number, buf: ArrayBufferView, offset?: number, length?: number, position?: number | null): number;
  export function writeSync(fd: number, data: string | ArrayBufferView, ...rest: any[]): number;
  export function createReadStream(path: PathLike, opts?: any): AsyncIterable<Buffer> & { pipe<T>(to: T): T };
}
declare module 'fs' { export * from 'node:fs'; }
declare module 'node:path' {
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(p: string): boolean;
  export const sep: string;
}
declare module 'path' { export * from 'node:path'; }
declare module 'node:os' {
  export function tmpdir(): string;
  export function homedir(): string;
  export function cpus(): { model: string; speed: number }[];
  export function platform(): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
  export function pathToFileURL(path: string): URL;
}
declare module 'node:zlib' {
  export function gzipSync(data: string | ArrayBufferView | ArrayBufferLike, opts?: any): Buffer;
  export function gunzipSync(data: ArrayBufferView | ArrayBufferLike, opts?: any): Buffer;
  export function deflateSync(data: string | ArrayBufferView | ArrayBufferLike, opts?: any): Buffer;
  export function inflateSync(data: ArrayBufferView | ArrayBufferLike, opts?: any): Buffer;
  export function createGunzip(opts?: any): AsyncIterable<Buffer>;
}
declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(data: string | ArrayBufferView): any; digest(encoding: string): string; digest(): Buffer };
}
declare module 'node:child_process' {
  export interface ChildProcess {
    pid?: number; exitCode: number | null; killed: boolean; stdin: any; stdout: any; stderr: any;
    kill(signal?: number | string): boolean;
    on(ev: string, fn: (...a: any[]) => void): this;
    once(ev: string, fn: (...a: any[]) => void): this;
  }
  export interface SpawnSyncResult { pid: number; status: number | null; signal: string | null; stdout: any; stderr: any; error?: Error; output: any[] }
  export function spawn(cmd: string, args?: readonly string[] | Record<string, any>, opts?: Record<string, any>): ChildProcess;
  export function spawnSync(cmd: string, args?: readonly string[] | Record<string, any>, opts?: Record<string, any>): SpawnSyncResult;
  export function execSync(cmd: string, opts?: Record<string, any>): any;
  export function execFileSync(file: string, args?: readonly string[] | Record<string, any>, opts?: Record<string, any>): any;
}
declare module 'bun:jsc' {
  export function heapStats(): { heapSize: number; heapCapacity: number; extraMemorySize: number; objectCount: number; protectedObjectCount: number; globalObjectCount: number; objectTypeCounts: Record<string, number>; protectedObjectTypeCounts: Record<string, number> };
  export function heapSize(): number;
  export function memoryUsage(): Record<string, number>;
}
declare module 'bun' {
  export function plugin(p: { name?: string; setup(build: any): void | Promise<void> }): void;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode: number | undefined;
  pid: number; platform: string; version: string; versions: Record<string, string>; execPath: string; arch: string;
  cwd(): string;
  exit(code?: number): never;
  kill(pid: number, signal?: number | string): boolean;
  uptime(): number;
  on(ev: string, fn: (...a: any[]) => void): void;
  once(ev: string, fn: (...a: any[]) => void): void;
  off(ev: string, fn: (...a: any[]) => void): void;
  stdout: { write(s: string | Uint8Array): boolean; isTTY?: boolean; columns?: number };
  stderr: { write(s: string | Uint8Array): boolean; isTTY?: boolean };
  stdin: any;
  hrtime: { (prev?: [number, number]): [number, number]; bigint(): bigint };
  memoryUsage: { (): { rss: number; heapUsed: number; heapTotal: number; external: number; arrayBuffers: number }; rss(): number };
  cpuUsage(prev?: { user: number; system: number }): { user: number; system: number };
};
declare function setImmediate(fn: (...a: any[]) => void, ...args: any[]): number;
declare const require: { (id: string): any; resolve(id: string): string };
declare const global: typeof globalThis;
interface ImportMeta { dir: string; main: boolean; path: string; file: string; url: string; resolve(spec: string): string; }

interface BunFile { text(): Promise<string>; json(): Promise<any>; arrayBuffer(): Promise<ArrayBuffer>; bytes(): Promise<Uint8Array>; exists(): Promise<boolean>; stream(): ReadableStream<Uint8Array>; size: number; name?: string; type: string }
/** `Bun.spawn` / `Bun.spawnSync` take two call shapes and a wide options bag; the handles are typed only as far as the tools read them */
interface BunSubprocess { pid: number; stdin: any; stdout: any; stderr: any; exited: Promise<number>; exitCode: number | null; signalCode: string | null; killed: boolean; kill(signal?: number | string): void; unref(): void }
interface BunSyncSubprocess { exitCode: number; success: boolean; signalCode?: string; stdout: Buffer; stderr: Buffer; pid: number }
declare const Bun: {
  version: string; revision: string; main: string; argv: string[]; env: Record<string, string | undefined>;
  write(dest: string | URL | BunFile | number, data: string | ArrayBufferView | ArrayBufferLike | Blob | Response | BunFile): Promise<number>;
  file(path: string | URL | number, opts?: { type?: string }): BunFile;
  serve(opts: Record<string, any>): { port: number; hostname: string; url: URL; stop(force?: boolean): void };
  spawn(cmd: string[] | (Record<string, any> & { cmd: string[] }), opts?: Record<string, any>): BunSubprocess;
  spawnSync(cmd: string[] | (Record<string, any> & { cmd: string[] }), opts?: Record<string, any>): BunSyncSubprocess;
  hash: { (data: string | ArrayBufferView | ArrayBufferLike, seed?: number | bigint): number | bigint; [algo: string]: (data: string | ArrayBufferView | ArrayBufferLike, seed?: any) => any };
  sleep(ms: number): Promise<void>;
  sleepSync(ms: number): void;
  gc(force?: boolean): void;
  nanoseconds(): number;
  gzipSync(data: Uint8Array | string | ArrayBuffer, opts?: any): Uint8Array;
  gunzipSync(data: Uint8Array | ArrayBuffer): Uint8Array;
  inspect(v: unknown, opts?: any): string;
  build(opts: Record<string, any>): Promise<{ success: boolean; outputs: any[]; logs: any[] }>;
  Transpiler: new (opts?: Record<string, any>) => { transformSync(code: string, loader?: string): string; scan(code: string): any };
  CryptoHasher: new (algo: string) => { update(data: string | ArrayBufferView): any; digest(enc?: string): any };
  stdin: BunFile; stdout: BunFile; stderr: BunFile;
  /** the shell tag (`await Bun.$`…``): left wide */
  $: any;
};
