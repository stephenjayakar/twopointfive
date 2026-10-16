// framecost under V8 — `V8_ENTRY=<tool.ts> FC_OUT=<file> node --no-warnings --trace-gc --import ./tools/qa/framecost-v8.mjs tools/qa/playthrough.ts --one <scn>:<seed> --out <res>`
// (tools/qa/framecost.ts --v8 does it and reads the collector's own lines off stdout). The same scripted play as the bun runs, on the page's JavaScript engine, with what bun
// cannot say: the GARBAGE COLLECTOR's pauses. Per run to $FC_OUT: every frame's ms (W.step) and Game.update's, and per frame whether a collection ran INSIDE it or in the gap
// before it (the scripted player's own code) — seen exactly, as a drop of the young / old generation's used bytes between two readings (the play loop never yields, so
// perf_hooks' 'gc' entries are not delivered while it runs). The pauses' lengths are V8's own (--trace-gc), matched to those frames in order by framecost.ts.
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
register('./framecost-v8-loader.mjs', import.meta.url);
// bun's fetch reads file: URLs and plain paths (the glTF); node's does not
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = typeof u === 'string' ? u : u?.href ?? u?.url ?? String(u);
  if (/^https?:/.test(s)) return realFetch(u, o);
  try { return new Response(readFileSync(s.startsWith('file:') ? fileURLToPath(s) : s)); } catch (e) { return new Response(String(e), { status: 404 }); }
};
let iNew = -1, iOld = -1;
const heap = () => { const s = v8.getHeapSpaceStatistics(); if (iNew < 0) { iNew = s.findIndex(x => x.space_name === 'new_space'); iOld = s.findIndex(x => x.space_name === 'old_space'); } return [s[iNew].space_used_size, s[iOld].space_used_size]; };
const start = [], frame = [], update = [], flags = [], standin = []; let t0 = 0, hn = 0, ho = 0, f = 0, si = 0, inFrame = false;
// FC_ALLOC=1: V8's sampling heap profiler from the first frame on, counting what the collector has already taken back too — WHO allocates the garbage, by function (self bytes)
let session = null, sampling = false;
// FC_HOT=1: V8's sampling CPU profiler (200 µs) from the first frame on — WHO burns the time, by function (self time)
const ALLOC = !!process.env.FC_ALLOC, HOT = !!process.env.FC_HOT;
if (ALLOC || HOT) { const { Session } = await import('node:inspector'); session = new Session(); session.connect(); if (ALLOC) session.post('HeapProfiler.enable'); if (HOT) { session.post('Profiler.enable'); session.post('Profiler.setSamplingInterval', { interval: 200 }); } }
const startSampling = () => { sampling = true; if (ALLOC) session.post('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); if (HOT) session.post('Profiler.start'); };
function hotTable() {
  let prof = null; session.post('Profiler.stop', (err, r) => { if (!err) prof = r.profile; }); if (!prof) return null;
  const node = new Map(prof.nodes.map(n => [n.id, n])), parent = new Map(); for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map(); let total = 0; prof.samples.forEach((id, i) => { const dt = prof.timeDeltas[i] ?? 0; self.set(id, (self.get(id) ?? 0) + dt); total += dt; });
  const nameOf = n => n.callFrame.functionName || '(anonymous)';
  const by = new Map();
  for (const [id, us] of self) { const n = node.get(id), cf = n.callFrame, key = `${nameOf(n)}\t${cf.url.replace(/^file:\/\//, '')}:${cf.lineNumber + 1}`; const e = by.get(key) ?? { us: 0, callers: new Map() }; e.us += us; const p = parent.has(id) ? nameOf(node.get(parent.get(id))) : '(root)'; e.callers.set(p, (e.callers.get(p) ?? 0) + us); by.set(key, e); }
  const rows = [...by.entries()].sort((a, b) => b[1].us - a[1].us).slice(0, 80).map(([k, e]) => { const [fn, where] = k.split('\t'); return { fn, where, us: e.us, callers: [...e.callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) }; });
  return { total, rows };
}
function allocTable() {
  if (!ALLOC) return undefined;
  let prof = null; session.post('HeapProfiler.stopSampling', (err, r) => { if (!err) prof = r.profile; }); if (!prof) return null;
  const by = new Map(); let total = 0;
  const walk = (n, parent) => { const cf = n.callFrame, key = `${cf.functionName || '(anonymous)'}\t${cf.url.replace(/^file:\/\//, '')}:${cf.lineNumber + 1}`; if (n.selfSize) { total += n.selfSize; const e = by.get(key) ?? { bytes: 0, callers: new Map() }; e.bytes += n.selfSize; e.callers.set(parent, (e.callers.get(parent) ?? 0) + n.selfSize); by.set(key, e); } for (const c of n.children ?? []) walk(c, cf.functionName || '(anonymous)'); };
  walk(prof.head, '(root)');
  const rows = [...by.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 60).map(([k, e]) => { const [fn, where] = k.split('\t'); return { fn, where, bytes: e.bytes, callers: [...e.callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => [c, v]) }; });
  return { total, rows };
}
globalThis.__V8FC = {
  // flags: 1 = a scavenge in the gap before this frame · 2 = a scavenge inside it · 4 / 8 = the old generation shrank (a mark-compact finished) before / inside it
  b() { if (session && !sampling) startSampling(); const [n, o] = heap(); f = (hn && n < hn ? 1 : 0) | (ho && o < ho ? 4 : 0); hn = n; ho = o; si = 0; inFrame = true; t0 = performance.now(); },
  standIn(fn) { if (!inFrame) return fn(); const t = performance.now(); try { return fn(); } finally { si += performance.now() - t; } },
  u() { update.push(performance.now() - t0 - si); },
  e() { const t = performance.now(); const [n, o] = heap(); f |= (n < hn ? 2 : 0) | (o < ho ? 8 : 0); hn = n; ho = o; inFrame = false; start.push(t0); frame.push(t - t0 - si); standin.push(si); flags.push(f); },
};
process.on('exit', () => {
  const out = process.env.FC_OUT; if (!out) return;
  const f32 = a => Buffer.from(Float32Array.from(a).buffer).toString('base64');
  const ns = v8.getHeapSpaceStatistics().find(x => x.space_name === 'new_space');
  try { writeFileSync(out, JSON.stringify({ v: 1, v8: true, runtime: `node ${process.version} (V8 ${process.versions.v8})`, newSpaceBytes: ns?.space_size ?? 0, frames: frame.length, frame: f32(frame), update: f32(update), standin: f32(standin), start: Buffer.from(Float64Array.from(start).buffer).toString('base64'), flags, hot: HOT && sampling ? hotTable() : undefined, alloc: session && sampling ? allocTable() : undefined })); }
  catch (e) { console.error(`framecost-v8: could not write ${out} — ${e}`); }
});
