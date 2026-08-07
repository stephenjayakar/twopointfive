// Fold the production build into ONE self-contained HTML page (./dist/twopointsix.html).
//
// The target is a host that serves a single document under a strict CSP: no second request may
// leave the page, so the module bundle is inlined as a classic <script type="module"> body and the
// character rig — a 2.4 MB glTF plus its 1.6 MB buffer — rides along base64'd. Two details make
// that affordable and legal:
//
//   - gzip + DecompressionStream. The rig is 4 MB on disk and 1 MB deflated (the JSON is almost
//     entirely digits); base64 of the deflated pair is what the page actually carries.
//   - a fetch shim rather than data: / blob: URLs. The loader asks for the rig by URL, and both
//     data: and blob: are things a CSP can refuse. Serving those two URLs from memory as synthetic
//     Responses touches no fetch directive at all, so the page cannot be broken by a policy we do
//     not control.
//
// The bundle is emitted raw rather than deflated for the same reason: un-deflating it would mean
// eval or a blob: worth of script, and 440 KB is not worth an 'unsafe-eval' the host may well deny.
import { $ } from "bun";

const OUT = "dist/twopointsix.html";              // a whole document — open it from disk, mail it, drop it on any host
const FRAG = "dist/twopointsix.fragment.html";    // the same page as bare content, for hosts that supply their own <head>/<body>
const RIG = "public/assets/ual/AnimationLibrary_Godot_Standard";

await $`bun run tools/build.ts`.quiet();

const b64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
const pack = (bytes: Uint8Array) => b64(Bun.gzipSync(bytes, { level: 9 }));

// The rig's JSON is pretty-printed on disk; re-stringifying drops ~800 KB before it is ever deflated.
const gltf = new TextEncoder().encode(JSON.stringify(await Bun.file(`${RIG}.gltf`).json()));
const bin = new Uint8Array(await Bun.file(`${RIG}.bin`).arrayBuffer());

const html = await Bun.file("dist/index.html").text();
const tag = html.match(/<script type="module"[^>]*src="\.?\/?([^"]+)"[^>]*><\/script>/);
if (!tag) throw new Error("no module <script> in dist/index.html — did tools/build.ts change?");

let js = await Bun.file(`dist/${tag[1]}`).text();
js = js.replace(/^\/\/# sourceMappingURL=.*$/m, "");        // the .map is a second request, and there is no second request
if (js.includes("</script")) throw new Error("bundle contains '</script' — inlining it would close the tag early");

const boot = `
(() => {
  const unb64 = (s) => { const raw = atob(s), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i); return u8; };
  const gunzip = (u8) => new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const PACK = {
    'AnimationLibrary_Godot_Standard.gltf': ['application/json', ${JSON.stringify(pack(gltf))}],
    'AnimationLibrary_Godot_Standard.bin': ['application/octet-stream', ${JSON.stringify(pack(bin))}],
  };
  // One decode for the page; every fetch of a packed name awaits it and gets its own copy of the bytes.
  const ready = (async () => {
    const m = new Map();
    for (const k of Object.keys(PACK)) m.set(k, { type: PACK[k][0], buf: await gunzip(unb64(PACK[k][1])), });
    return m;
  })();
  const passthrough = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const path = url.split(/[?#]/)[0];
    for (const [name, a] of await ready) if (path.endsWith(name)) return new Response(a.buf.slice(0), { status: 200, headers: { 'content-type': a.type } });
    return passthrough(input, init);
  };

  // Without a GPU the app's own fatal card says 'navigator.gpu missing', which is true and unhelpful:
  // the single most likely reason a visitor sees it is an embedding frame, and the fix is a new tab.
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  addEventListener('DOMContentLoaded', async () => {
    let why = null;
    if (!('gpu' in navigator)) why = 'This browser does not expose WebGPU.';
    else try { if (!await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })) why = 'WebGPU is here, but no adapter would start — a software fallback is usually blocked, and some machines refuse the discrete GPU on battery.'; }
    catch (e) { why = 'The WebGPU adapter request failed: ' + (e && e.message || e); }
    if (!why) return;
    const el = document.createElement('div');
    el.id = 'nogpu';
    el.innerHTML = '<div class="card"><h1>This one needs WebGPU</h1><p class="why"></p>'
      + (framed ? '<p><a class="btn" target="_blank" rel="noopener">Open in its own tab \\u2197</a></p><p class="sub">Embedded frames are the usual reason \\u2014 a tab of its own generally has the GPU the frame was denied.</p>' : '')
      + '<p class="sub">Runs in Chrome or Edge 113+, Firefox 145+ on Apple Silicon, or Safari 26+ on macOS Tahoe. A discrete or integrated GPU is required; there is no software path \\u2014 every pixel here is traced.</p></div>';
    el.querySelector('.why').textContent = why;
    const a = el.querySelector('.btn'); if (a) a.href = location.href;
    document.body.appendChild(el);
    const l = document.getElementById('loading'); if (l) l.style.display = 'none';
  });
})();
`.trim();

const style = `
<style>
  #nogpu { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; background: radial-gradient(ellipse at 50% 45%, #0b1512, #04080a 70%); font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  #nogpu .card { max-width: 460px; padding: 26px 30px; background: rgba(6,12,10,0.9); border: 1px solid rgba(121,214,154,0.3); border-radius: 6px; color: #c9dbd3; }
  #nogpu h1 { margin: 0 0 12px; font: 300 26px/1.1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.04em; color: #eef6f2; }
  #nogpu .why { color: #dfe; }
  #nogpu .sub { font-size: 12px; color: #8a9890; }
  #nogpu .btn { display: inline-block; margin: 4px 0; padding: 8px 14px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #041008; background: #79d69a; border-radius: 3px; text-decoration: none; font-weight: 600; }
  #nogpu .btn:hover { background: #9ff3c9; }
</style>
`.trim();

// Function replacers, not string ones: the minified bundle contains `$&`, and as a replacement
// string that re-inserts the very <script src=...> tag we are trying to remove.
const page = html
  .replace("</head>", () => `${style}\n</head>`)
  .replace(tag[0], () => `<script>\n${boot}\n</script>\n<script type="module">\n${js}\n</script>`);

if (page.includes(tag[1])) throw new Error(`output still references ${tag[1]} — it would fetch a second file`);

// The fragment is the same bytes minus the document skeleton: everything the original <head> carried
// except its <meta>/<title> (the host writes those), then the <body> contents. <style> and <script>
// are both valid in body flow, so the page behaves identically.
const head = page.slice(page.indexOf("<head>") + 6, page.indexOf("</head>"));
const body = page.slice(page.indexOf("<body>") + 6, page.indexOf("</body>"));
const fragment = head.replace(/^[ \t]*<(meta|title)\b[^>]*>(?:[^<]*<\/title>)?[ \t]*\n?/gim, "").trim() + "\n" + body.trim() + "\n";

await Bun.write(OUT, page);
await Bun.write(FRAG, fragment);
const kb = (n: number) => (n / 1024).toFixed(0).padStart(6) + " KB";
const nonAscii = [...fragment].filter(c => c.codePointAt(0)! > 127).length;
console.log(`${kb(js.length)}  bundle (inline)
${kb(page.length - js.length)}  rig + page
${kb(page.length)}  ${OUT}
${kb(fragment.length)}  ${FRAG}   (${nonAscii} non-ASCII chars — the host must serve UTF-8)`);
