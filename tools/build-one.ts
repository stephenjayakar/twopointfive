// THE ONE-FILE BUILD: the game page and everything it asks for at run time, packed into ONE self-contained HTML file — dist/one/twopointsix.html. Put it
// on any host that serves a single page, hand it to someone, or open it from disk in a WebGPU browser: there is no folder beside it and no server behind
// it. (From disk the Team & kit picture stays the standing man: a file: page and its second instance cannot post to each other — ui/kitView.ts.)
//   bun run build:one [out.html]
// What goes in: index.html as it is; the game's module, bundled with no chunks (shaders are text in it already); src/host/onefile.ts, the
// small boot script that answers the page's own requests from the pack (how: its header); and THE PACK, one inert block per file —
//   assets/ual/* · assets/chars/*   the animation library with its .bin, both casts            gzip
//   assets/menu/*                   the mission pictures and their list                         as they are (a picture is read synchronously)
//   levels/*.json                   every mission's level file (the dev server's /levels/)      gzip
//   qa/commit                       the commit this was built from (recordings name it)         as it is; left out of a build of uncommitted changes
// What stays out: the tool pages (workbench, replay viewer, sounds, music) and the replays the sounds page plays. The page carries the
// `tps-one-page` meta the game already reads (ui/menu.ts lists no tool page; ui/replaykey.ts: F7 hands its file over as a download).
// `bun run build` (dist/, the page with its folder) is untouched by this and wipes dist/one with the rest of dist.
import { $ } from "bun";
import { readdirSync } from "node:fs";
const out = process.argv[2] ?? "dist/one/twopointsix.html";
const fail = (why: string): never => { console.error(`build:one — ${why}`); process.exit(1); };
const bundle = async (entry: string, format: "esm" | "iife") => {
  const res = await Bun.build({ entrypoints: [entry], minify: true, target: "browser", format, loader: { ".wgsl": "text" } });
  if (!res.success) { for (const m of res.logs) console.error(m); fail(`${entry} did not bundle`); }
  if (res.outputs.length !== 1) fail(`${entry} bundled to ${res.outputs.length} files, not one`);
  const js = await res.outputs[0].text();
  if (js.includes("<!--")) fail(`${entry}: the bundle holds "<!--", which an inline script cannot carry`);
  return js.replace(/<\/script/gi, "<\\/script");
};
const [game, boot] = [await bundle("./src/main.ts", "esm"), await bundle("./src/host/onefile.ts", "iife")];

const TYPES: Record<string, string> = { gltf: "application/json", json: "application/json", bin: "application/octet-stream", jpg: "image/jpeg", png: "image/png", md: "text/plain", "": "text/plain" };
const pack: string[] = []; let packedBytes = 0;
async function add(path: string, data: Uint8Array | string, gzip: boolean) {
  const raw = typeof data === "string" ? new TextEncoder().encode(data) : data, body = gzip ? Bun.gzipSync(raw, { level: 9 }) : raw;
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? "", type = TYPES[ext] ?? "application/octet-stream";
  pack.push(`<script type="application/octet-stream" data-pack="${path}" data-type="${type}"${gzip ? ' data-enc="gzip"' : ""}>${Buffer.from(body).toString("base64")}</script>`);
  packedBytes += body.length;
}
const folder = async (dir: string, as: string, keep: (f: string) => boolean, gzip: (f: string) => boolean) => {
  for (const f of readdirSync(dir).sort()) if (keep(f)) await add(`${as}/${f}`, new Uint8Array(await Bun.file(`${dir}/${f}`).arrayBuffer()), gzip(f));
};
await folder("public/assets/ual", "assets/ual", f => /\.(gltf|bin)$/.test(f), () => true);
await folder("public/assets/chars", "assets/chars", f => f.endsWith(".gltf"), () => true);
await folder("public/assets/menu", "assets/menu", f => /\.(json|jpg|png)$/.test(f), () => false);
await folder("levels", "levels", f => f.endsWith(".json"), () => true);
// the commit, where the tree IS that commit (a build of uncommitted changes names none: a recording must not point at a commit that cannot rebuild it)
const dirty = (await $`git status --porcelain`.nothrow().quiet().text()).trim() !== "";
const commit = dirty ? "" : (await $`git rev-parse --short=12 HEAD`.nothrow().quiet().text()).trim();
if (/^[0-9a-f]{7,40}$/.test(commit)) await add("qa/commit", commit, false);

// index.html as it is, with three changes: the mark the game reads, and — where its module tag was — the pack, the boot script and the module itself
const html = await Bun.file("index.html").text();
const MODULE = /<script type="module"[^>]*\ssrc="\.\/src\/main\.ts"[^>]*><\/script>/;
if (!MODULE.test(html)) fail("index.html: no module tag for ./src/main.ts");
const rest = html.replace(MODULE, "");
if (/<(script|link|img|source|video|audio|iframe)\b[^>]*\s(src|href)=/i.test(rest) || /@import|url\(\s*['"]?(?!data:)/i.test(rest)) fail("index.html names a file beside the page: pack it here first");
if (!/<meta name="viewport"[^>]*>/.test(html)) fail("index.html: no viewport meta to put the one-page mark after");
const page = html
  .replace(/<meta name="viewport"[^>]*>/, m => `${m}\n  <meta name="tps-one-page" content="1">`)
  .replace(MODULE, () => `${pack.join("\n")}\n<script>${boot}</script>\n<script type="module">${game}</script>`);
await $`mkdir -p ${out.replace(/[^/]*$/, "") || "."}`;
await Bun.write(out, page);
const mb = (n: number) => (n / 1048576).toFixed(1) + " MB";
console.log(`${out}: ${mb(Buffer.byteLength(page))} — the game ${mb(game.length)}, ${pack.length} packed files (${mb(packedBytes)} before base64), ${commit ? `commit ${commit}` : "no commit named (uncommitted changes)"}`);
