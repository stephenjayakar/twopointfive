// Static production build into ./dist (bundle + copy public/). Two real pages — the game (index.html) and the WORKBENCH (workbench.html: level editor + character viewer in one
// shell) — plus the forwards that keep old links working: viewer.html → workbench.html#mode=chars, editor.html → workbench.html#mode=level (both plain pages, bundled as they are),
// gaitlab.html (written here) → the workbench's Characters ▸ Sam ▸ walk.
import { $ } from "bun";
await $`rm -rf dist`;
const res = await Bun.build({ entrypoints: ["./index.html", "./workbench.html", "./viewer.html", "./editor.html", "./replay.html", "./sounds.html", "./music.html"], outdir: "./dist", minify: true, target: "browser", sourcemap: "linked", loader: { ".wgsl": "text" } });
if (!res.success) { for (const m of res.logs) console.error(m); process.exit(1); }
await $`cp -R public/. dist/`;
await Bun.write("dist/gaitlab.html", `<!doctype html><meta charset="utf-8"><title>twopointsix — gait lab → workbench</title>
<meta http-equiv="refresh" content="0; url=workbench.html#mode=chars&scene=sam/walk">
<script>location.replace('workbench.html' + location.search + '#mode=chars&scene=sam/walk')</script>
<p style="font:12px ui-monospace,monospace;color:#9cb;background:#000">The gait lab moved into the workbench: <a href="workbench.html#mode=chars&scene=sam/walk">workbench.html#mode=chars&amp;scene=sam/walk</a></p>
`);
console.log("built:", [...res.outputs.map(o => o.path), "dist/gaitlab.html (forward)"].join("\n"));
