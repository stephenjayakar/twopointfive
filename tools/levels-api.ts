// The dev server's level-file API (tools/serve.ts mounts it; tools/qa/editor-probes.ts calls it directly with Request objects):
//   GET  /levels/                → { levels: [{ name, bytes, mtime }] }   the repo's levels/*.json (not the *.lint.json sidecars)
//   GET  /levels/<name>.json     → the file            GET /levels/<name>.lint.json → its lint sidecar (404 if none)
//   POST /levels/<name>.json     → validate (validateLevelData) + write levels/<name>.json in canonical form → { ok, name, bytes, path }
// Dev-only by construction (the static build has no server). Guard rails, since a dev server on localhost is reachable from any page open in
// the same browser: <name> must match NAME_RE (no paths, no dots), the Host header must be a loopback host (and tools/serve.ts BINDS loopback only, so
// that header is no longer the one thing between the LAN and the write path), a POST must be same-origin (Origin, when present, must be this server),
// carry Content-Type: application/json AND the editor's own `X-Level-Editor: 1` header (either forces a preflight from a cross-origin page, which
// gets no CORS grant here — the custom header also refuses a same-origin fetch that is not the editor's), the body is capped, and only text that
// parses AND validates is written — re-serialized, never the raw bytes.
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '..');
const { validateLevelData, serializeLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);

export const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** the request header a POST must carry (value '1') — the level editor's mark on its own writes */
export const EDITOR_HEADER = 'X-Level-Editor';
export const MAX_BYTES = 8 * 1024 * 1024;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Handle /levels/* or return null for anything else. `rootDir` = the repo root whose levels/ directory is served (a scratch dir in the probes). */
export async function handleLevels(req: Request, rootDir: string = ROOT): Promise<Response | null> {
  const url = new URL(req.url);
  let path: string; try { path = decodeURIComponent(url.pathname); } catch { return json(400, { error: 'bad path encoding' }); }
  if (path !== '/levels' && !path.startsWith('/levels/')) return null;
  // who is asking: loopback Host only (DNS rebinding), and for writes the page must be ours
  const host = req.headers.get('host') ?? '';
  if (!LOOPBACK.test(host)) return json(403, { error: `host '${host}' refused: the level API answers loopback hosts only` });
  const dir = join(rootDir, 'levels');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return json(405, { error: 'GET or POST' });
  const rest = path.replace(/^\/levels\/?/, '');
  if (rest === '') {   // index
    if (req.method === 'POST') return json(405, { error: 'POST to /levels/<name>.json' });
    if (!existsSync(dir)) return json(200, { levels: [] });
    const levels = readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json') && NAME_RE.test(f.slice(0, -5))).map(f => { const st = statSync(join(dir, f)); return { name: f.slice(0, -5), bytes: st.size, mtime: st.mtimeMs }; }).sort((a, b) => a.name.localeCompare(b.name));
    return json(200, { levels });
  }
  // a single file: <name>.json or <name>.lint.json — nothing else, no sub-paths
  const m = /^([^/]+?)(\.lint)?\.json$/.exec(rest);
  if (!m || !NAME_RE.test(m[1])) return json(400, { error: `bad level name '${rest}': use letters, digits, _ or - (1–64) + .json` });
  const name = m[1]; const sidecar = !!m[2]; const file = join(dir, `${name}${sidecar ? '.lint' : ''}.json`);
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!existsSync(file)) return json(404, { error: `no such level file: levels/${name}${sidecar ? '.lint' : ''}.json` });
    return new Response(req.method === 'HEAD' ? null : readFileSync(file), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  // POST: write a level (never a sidecar)
  if (sidecar) return json(405, { error: 'lint sidecars are edited by hand' });
  const origin = req.headers.get('origin');
  if (origin) { let ok = false; try { const o = new URL(origin); ok = LOOPBACK.test(o.host) && o.host === host; } catch { /* */ } if (!ok) return json(403, { error: `cross-origin write refused (origin ${origin})` }); }
  const ctype = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (ctype !== 'application/json') return json(415, { error: 'Content-Type must be application/json' });
  if ((req.headers.get(EDITOR_HEADER) ?? '') !== '1') return json(403, { error: `writes must carry the editor's '${EDITOR_HEADER}: 1' header (src/editor/persist.ts serverSave sends it)` });
  const len = Number(req.headers.get('content-length') ?? '0'); if (len > MAX_BYTES) return json(413, { error: `body too large (${len} > ${MAX_BYTES})` });
  let text: string; try { text = await req.text(); } catch { return json(400, { error: 'unreadable body' }); }
  if (text.length > MAX_BYTES) return json(413, { error: 'body too large' });
  let data: any; try { data = JSON.parse(text); } catch (e) { return json(400, { error: `not JSON: ${(e as Error).message}` }); }
  const errs: string[] = validateLevelData(data);
  if (errs.length) return json(422, { error: `${errs.length} validation error(s)`, errors: errs.slice(0, 50) });
  const out: string = serializeLevelData(data);
  try { mkdirSync(dir, { recursive: true }); writeFileSync(file, out); } catch (e) { return json(500, { error: `write failed: ${(e as Error).message}` }); }
  const bytes = Buffer.byteLength(out);
  console.log(`levels: wrote levels/${name}.json (${(bytes / 1024).toFixed(1)} KB, ${data.boxes?.length ?? '?'} boxes)`);
  return json(200, { ok: true, name, bytes, path: `levels/${name}.json` });
}
