// Tiny capture sink for automated screenshots: POST /shot?name=foo (image body) → docs/shots/foo.jpg, or docs/shots/ab/foo.png when the body is a PNG
// (__png's lossless readbacks for pixel A/B); POST /perf?name= (the F9 recorder's dump) → docs/perf/<name>.json; POST /session?name= (the F10 session journal) → tools/qa/sessions/<name>.json.gz. PORT=… runs a second sink for a lane's own worktree (the page posts to window.__shotPort, default 5174).
// Listens on LOOPBACK only (HOST=… overrides that on purpose) and grants CORS only to loopback origins — a dev server on any port, lanes run their own —
// so some other page open in the same browser gets a 403 and no grant: it cannot write files here.
import { mkdirSync } from 'node:fs';
const dir = new URL('../docs/shots/', import.meta.url).pathname; mkdirSync(dir + 'ab/', { recursive: true });
const port = Number(process.env.PORT ?? 5174);
const hostname = process.env.HOST ?? '127.0.0.1';
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
Bun.serve({
  port, hostname,
  async fetch(req) {
    const origin = req.headers.get('origin');
    if (origin && !LOOPBACK_ORIGIN.test(origin)) return new Response(`origin ${origin} refused: the capture sink answers loopback pages only`, { status: 403 });   // (no CORS headers on the refusal: the browser hands that page nothing)
    const cors = { 'Access-Control-Allow-Origin': origin ?? '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/perf') {   // the perf recorder's dump (src/ui/perfrec.ts, F9): docs/perf/<name>.json
      const name = (url.searchParams.get('name') ?? `perf-${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
      const perfDir = new URL('../docs/perf/', import.meta.url).pathname; mkdirSync(perfDir, { recursive: true });
      const body = await req.text(); await Bun.write(perfDir + name + '.json', body);
      console.log(`perf dump → docs/perf/${name}.json (${(body.length / 1024).toFixed(0)} KB)`);
      return new Response(`docs/perf/${name}.json ${body.length}`, { headers: cors });
    }
    if (req.method === 'POST' && url.pathname === '/session') {   // the session journal's file (src/ui/sessionrec.ts, F10): tools/qa/sessions/<name>.json.gz — the replay fixtures' folder (tools/qa/replay.ts --all)
      const name = (url.searchParams.get('name') ?? `session-${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
      const sesDir = new URL('./qa/sessions/', import.meta.url).pathname; mkdirSync(sesDir, { recursive: true });
      const body = await req.text(); const gz = Bun.gzipSync(new TextEncoder().encode(body)); await Bun.write(sesDir + name + '.json.gz', gz);   // (gzipped: a session is a lot of digits — ~5× smaller — and the replay tool reads .json.gz as it reads .json)
      console.log(`session journal → tools/qa/sessions/${name}.json.gz (${(body.length / 1024).toFixed(0)} KB → ${(gz.length / 1024).toFixed(0)} KB gzipped)`);
      return new Response(`tools/qa/sessions/${name}.json.gz ${gz.length}`, { headers: cors });
    }
    if (req.method === 'POST' && url.pathname === '/clip') {   // the smoke battery's clips (tools/qa/smoke-battery.js: MediaRecorder off the canvas): docs/shots/clips/<name>.webm
      const name = (url.searchParams.get('name') ?? `clip-${Date.now()}`).replace(/[^a-zA-Z0-9_.\/-]/g, '_').replace(/\.\.+/g, '_').replace(/^\/+/, '').slice(0, 160);   // (one level of sub-folder allowed: <clip>/meta.json)
      const clipDir = dir + 'clips/'; mkdirSync(clipDir + (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : ''), { recursive: true });
      const file = name.endsWith('.json') ? name : `${name}.webm`;   // (the battery's manifest rides the same road)
      const bytes = new Uint8Array(await req.arrayBuffer()); await Bun.write(`${clipDir}${file}`, bytes);
      console.log(`clip → docs/shots/clips/${file} (${(bytes.length / 1024).toFixed(0)} KB)`);
      return new Response(`docs/shots/clips/${file} ${bytes.length}`, { headers: cors });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/prefs/')) {   // the judgments so far (docs/perf/<name>.jsonl) — the pairs page fits them online to pick the next most informative pair
      const name = url.pathname.slice('/prefs/'.length).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100);
      const f = Bun.file(`docs/perf/${name}.jsonl`); const text = (await f.exists()) ? await f.text() : '';
      return new Response(text, { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'POST' && url.pathname === '/clipframe') {   // the battery's FLIPBOOK clips: one JPEG per frame → docs/shots/clips/<clip>/f0001.jpg (+ meta.json via /clip?name=<clip>/meta.json)
      const clip = (url.searchParams.get('clip') ?? 'clip').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120); const i = Math.max(0, Math.min(99999, Number(url.searchParams.get('i') ?? 0) | 0));
      const clipDir = `${dir}clips/${clip}/`; mkdirSync(clipDir, { recursive: true });
      const bytes = new Uint8Array(await req.arrayBuffer()); await Bun.write(`${clipDir}f${String(i).padStart(4, '0')}.jpg`, bytes);
      return new Response('ok', { headers: cors });
    }
    if (req.method === 'POST' && url.pathname === '/pref') {    // the preference page's judgments (tools/qa/smoke-pref.html): appended as JSON lines to docs/perf/<name>.jsonl
      const name = (url.searchParams.get('name') ?? 'smoke-pref').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
      const perfDir = new URL('../docs/perf/', import.meta.url).pathname; mkdirSync(perfDir, { recursive: true });
      const body = (await req.text()).trim(); const file = Bun.file(perfDir + name + '.jsonl'); const prev = (await file.exists()) ? await file.text() : '';
      await Bun.write(file, prev + body + '\n');
      console.log(`pref → docs/perf/${name}.jsonl (+${body.length} B)`);
      return new Response('ok', { headers: cors });
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/clips/')) {   // … and serves them back to the preference page (any loopback page may read)
      const name = url.pathname.slice('/clips/'.length).replace(/[^a-zA-Z0-9_.\/-]/g, '_').replace(/\.\.+/g, '_').replace(/^\/+/, '');
      const f = Bun.file(`${dir}clips/${name}`); if (!(await f.exists())) return new Response('no such clip', { status: 404, headers: cors });
      const type = name.endsWith('.json') ? 'application/json' : name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.html') ? 'text/html; charset=utf-8' : 'video/webm';
      return new Response(f, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': name.endsWith('.jpg') ? 'max-age=3600' : 'no-store' } });
    }
    if (req.method === 'POST' && url.pathname === '/shot') {
      const name = (url.searchParams.get('name') ?? 'shot').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const bytes = new Uint8Array(await req.arrayBuffer());
      const png = bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;   // PNG magic
      const file = png ? `ab/${name}.png` : `${name}.jpg`;
      await Bun.write(`${dir}${file}`, bytes);
      console.log(`saved ${file} (${(bytes.length / 1024).toFixed(0)} KB)`);
      return new Response('ok', { headers: cors });
    }
    return new Response('capture sink: POST /shot?name=', { headers: cors });
  },
});
console.log(`shot server on http://${hostname}:${port} → ${dir}${hostname === '127.0.0.1' || hostname === 'localhost' ? '' : '  (HOST override: NOT loopback-only)'}`);
