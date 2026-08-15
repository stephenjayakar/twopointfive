// Minimal dev server: bundles index.html + workbench.html (+ viewer.html / editor.html, now forwards into it; TS, WGSL as text) via Bun's HTML imports, serves ./public statically,
// and answers the level editor's file API under /levels/ (tools/levels-api.ts: index, read, validated write into levels/ — loopback + same-origin only).
// Listens on LOOPBACK only (HOST=… overrides that on purpose): a dev server bound to 0.0.0.0 was reachable — its write API included — from the whole LAN.
import index from "../index.html";
import viewer from "../viewer.html";   // a FORWARD into /workbench#mode=chars (the character / prop viewer is its Characters mode) — see VIEWER.md
import editor from "../editor.html";   // a FORWARD into /workbench#mode=level (the level editor is its Level mode) — see docs/level-format.md 'Editor'
import workbench from "../workbench.html";   // the WORKBENCH: editor + viewer in one shell (src/workbench.ts → src/workbench/, src/editor/, src/viewer/)
import { handleLevels } from "./levels-api.ts";

const COMMIT = (() => { try { const r = Bun.spawnSync(["git", "rev-parse", "--short=12", "HEAD"]); return r.success ? new TextDecoder().decode(r.stdout).trim() : ""; } catch { return ""; } })();   // (read once at start: a dev server outlives commits, but the journal only wants "about which build")
const port = Number(process.env.PORT ?? 5173);
const hostname = process.env.HOST ?? "127.0.0.1";
const server = Bun.serve({
  port, hostname,
  development: { hmr: false, console: true },
  routes: {
    "/": index, "/viewer": viewer, "/editor": editor, "/workbench": workbench,
    "/gait": req => Response.redirect("/workbench" + new URL(req.url).search + "#mode=chars&scene=sam/walk", 302),   // the gait lab is the workbench's Characters ▸ Sam ▸ walk / jog / … now; old links land there
  },
  async fetch(req) {
    const url = new URL(req.url);
    let path: string; try { path = decodeURIComponent(url.pathname); } catch { return new Response("bad path encoding", { status: 400 }); }
    if (path.includes("..")) return new Response("bad path", { status: 400 });
    if (path === "/index.html") return Response.redirect("/" + url.search + url.hash, 302);   // the game is '/', but a built page's neighbour link (the editor's ▶ play: 'index.html?level=local') must open here too
    if (path === "/viewer.html" || path === "/viewer/") return Response.redirect("/viewer" + url.search, 302);   // one canonical URL per route (keep ?quality=…); /viewer and /editor themselves forward into /workbench in the page
    if (path === "/editor.html" || path === "/editor/") return Response.redirect("/editor" + url.search + url.hash, 302);
    if (path === "/workbench.html" || path === "/workbench/") return Response.redirect("/workbench" + url.search + url.hash, 302);
    if (path === "/gaitlab.html" || path === "/gait/") return Response.redirect("/workbench" + url.search + "#mode=chars&scene=sam/walk", 302);
    const lv = await handleLevels(req); if (lv) return lv;
    if (path === "/qa/commit") return new Response(COMMIT, { headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });   // the commit this server was started on (the session journal files it with a recording: src/ui/sessionrec.ts)
    if (/^\/qa\/[\w.-]+\.js$/.test(path)) { const qa = Bun.file("./tools" + path); if (await qa.exists()) return new Response(qa, { headers: { "Cache-Control": "no-store" } }); }   // the in-page measurement harnesses (dev only, never bundled): `await import('/qa/perf-harness.js')` → window.__perf, '/qa/perf-frames.js' → window.__pf
    { const m = path.match(/^\/qa\/shader\/([a-z_0-9]+)\.wgsl$/); if (m) { const sf = Bun.file(`./src/render/shaders/${m[1]}.wgsl`); if (await sf.exists()) return new Response(sf, { headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } }); } }   // a pass shader's current source on disk, for the page's hot-swap hook (main.ts __hotVol): edit, fetch, recompile, A/B — without rebooting a staged scene
    const f = Bun.file("./public" + path);
    if (await f.exists()) return new Response(f);
    return new Response("not found: " + path, { status: 404 });
  },
});
console.log(`dev server: http://${hostname === "127.0.0.1" ? "localhost" : hostname}:${server.port}${hostname === "127.0.0.1" || hostname === "localhost" ? "" : "  (HOST override: NOT loopback-only)"}  ·  workbench: /workbench (level · materials · characters · effects; /viewer /editor /gait forward into it)  ·  level files: /levels/`);
