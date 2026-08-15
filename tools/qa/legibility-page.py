#!/usr/bin/env python3
# Builds docs/review/legibility.html for the exp/legibility lane from docs/shots/lg*_*.jpg: inline CSS, JPEG crops as data: URIs, light + dark + data-theme.
# usage: python3 tools/qa/legibility-page.py [qa.json]   (qa.json = {gate, tour, soak, build, stress_*} strings substituted into the text; needs Pillow)
import base64, io, json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SH = ROOT + '/docs/shots/'
OUT = ROOT + '/docs/review/legibility.html'
QA = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}

total_bytes = 0
def uri(name, maxw=None, q=85, crop=None, scale=None, ref=None):
    """data URI of docs/shots/<name> (optionally cropped (x,y,w,h) - in 1600x1000 coordinates scaled to the frame when ref=1600 - upscaled by `scale`, and/or downscaled to maxw), re-encoded JPEG q"""
    global total_bytes
    p = SH + name
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB')
    if crop:
        x, y, w, h = crop
        if ref: k = im.width / ref; x, y, w, h = round(x * k), round(y * k), round(w * k), round(h * k)
        im = im.crop((x, y, x + w, y + h))
    if scale and scale != 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if maxw and im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); data = b.getvalue(); total_bytes += len(data)
    return 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii'), im.width, im.height
def fig(name, cap, cls='tile', maxw=None, q=85, crop=None, style='', scale=None, ref=None):
    r = uri(name, maxw, q, crop, scale, ref)
    if not r: return f'<figure><div class="missing">{name} missing</div><figcaption>{cap}</figcaption></figure>'
    u, w, h = r
    return f'<figure><img class="{cls}" src="{u}" width="{w}" height="{h}" alt="{cap}" style="{style}"><figcaption>{cap}</figcaption></figure>'

H = []
H.append('''<title>exp/legibility — object legibility from markings: rectangles, in 2D, on box faces</title>
<style>
:root { --bg:#f6f5f1; --fg:#1d1d1b; --dim:#6b6a63; --card:#ffffff; --line:#dcd9cf; --acc:#8a5a00; --good:#1f7a3a; --warn:#a35f00; --bad:#a12121; --code:#efece4; --zoom:1; }
@media (prefers-color-scheme: dark) { :root { --bg:#141413; --fg:#e9e7df; --dim:#9c9a90; --card:#1c1c1a; --line:#34332e; --acc:#e0a94a; --good:#5fcf82; --warn:#f0b35a; --bad:#ff7d7d; --code:#24231f; } }
:root[data-theme="light"] { --bg:#f6f5f1; --fg:#1d1d1b; --dim:#6b6a63; --card:#ffffff; --line:#dcd9cf; --acc:#8a5a00; --good:#1f7a3a; --warn:#a35f00; --bad:#a12121; --code:#efece4; }
:root[data-theme="dark"] { --bg:#141413; --fg:#e9e7df; --dim:#9c9a90; --card:#1c1c1a; --line:#34332e; --acc:#e0a94a; --good:#5fcf82; --warn:#f0b35a; --bad:#ff7d7d; --code:#24231f; }
html { background: var(--bg); color: var(--fg); }
body { margin: 0; font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--fg); overflow-x: hidden; }
main { max-width: 1240px; margin: 0 auto; padding: 28px 20px 80px; }
h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.01em; text-wrap: balance; }
h2, h3 { text-wrap: balance; }
.controls button:focus-visible, a:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
h2 { font-size: 20px; margin: 42px 0 10px; padding-top: 12px; border-top: 1px solid var(--line); }
h3 { font-size: 16px; margin: 22px 0 8px; }
p { margin: 8px 0; }
.dim { color: var(--dim); }
.lede { font-size: 16px; max-width: 1000px; }
code, .k { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--code); padding: 1px 4px; border-radius: 3px; }
pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--code); padding: 8px 10px; border-radius: 4px; overflow-x: auto; line-height: 1.25; }
blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid var(--acc); background: var(--card); color: var(--fg); }
table { border-collapse: collapse; font-size: 13px; }
th, td { border: 1px solid var(--line); padding: 5px 8px; vertical-align: top; text-align: left; }
th { background: var(--code); font-weight: 600; }
td.n { text-align: right; font-variant-numeric: tabular-nums; }
.wrap { overflow-x: auto; max-width: 100%; }
.d { color: var(--dim); font-size: 11.5px; }
.tag { display: inline-block; font-size: 11px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--line); margin-left: 4px; }
.good { color: var(--good); font-weight: 600; } .warn { color: var(--warn); font-weight: 600; } .bad { color: var(--bad); font-weight: 600; }
.view { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin: 18px 0; }
.view h3 { margin-top: 0; }
figcaption { font-size: 12px; color: var(--dim); margin-top: 3px; max-width: 520px; }
.strip { overflow-x: auto; max-width: 100%; padding-bottom: 6px; }
.row { display: flex; gap: 10px; align-items: flex-start; width: max-content; }
.row figure { margin: 0; }
img.tile { display: block; image-rendering: pixelated; image-rendering: crisp-edges; height: auto; border-radius: 3px; max-width: none; width: auto; zoom: var(--zoom); }
img.shot { display: block; height: auto; border-radius: 4px; max-width: 100%; }
.controls { position: sticky; top: 0; background: var(--bg); padding: 8px 0; z-index: 5; border-bottom: 1px solid var(--line); font-size: 13px; }
.controls button { font: inherit; padding: 3px 10px; margin-right: 6px; border: 1px solid var(--line); background: var(--card); color: var(--fg); border-radius: 4px; cursor: pointer; }
.controls button.on { border-color: var(--acc); color: var(--acc); }
.missing { width: 300px; height: 200px; display: grid; place-items: center; background: var(--code); color: var(--dim); font-size: 12px; }
.small { font-size: 12.5px; }
ul { padding-left: 20px; } li { margin: 3px 0; }
.toc a { color: var(--acc); text-decoration: none; margin-right: 12px; font-size: 13px; }
.rules li b { color: var(--acc); }
</style>
<main>
''')

H.append('''
<h1>exp/legibility — object legibility from markings: rectangles, in 2D, on box faces</h1>
<p class="lede">Branch <code>exp/legibility</code> off main @ <code>5d8eb46</code> (the full renderer-v3 pipeline including phase 4's finishes and detail layer). The
designer's ask, verbatim: <i>"I think I'd prioritize object legibility to start … in the manager's office, the monitor looks great but the keyboard doesn't. similarly, the
cardboard boxes are hard to recognize. same for vending machine. are there very simple textures that we'd use judiciously across our objects to make them more
recognizable?"</i> — then the strategic intent: <i>"see how much we can push into textures and OUT OF GEOMETRY to speed up our rendering pipeline; curious how well this
works with everything we're doing (e.g. RT reflections)"</i>. The answer built here: legibility at follow-camera distance comes from one or two <b>signifiers</b> per object
class made of the same thing the world is made of — rectangles, in 2D, ON a face — as a tiny <b>palette-indexed bitmap</b> per marking, authored image-style (generators
for key grids / seams / text bars / LED rows / can rows, ASCII art for the this-side-up glyphs and labels) and rendered <b>analytically</b> on a world-space texel lattice.
Short version of the verdict, ahead of the pictures: at follow height on high the keyboard, the cartons and the two vending machines now read as what they are (§2, the
verdict rows); the whole set costs nothing measurable at any tier (≤ one 65 µs timer quantum, §7); with everything off the frame is main's, hash for hash (§8); an
emissive marking is a real light and the meter in front of the vending window reads what it read in front of the old glowing slab (§6); the geometry demotion took the
office from 925 to 772 boxes but — honestly — saved no ray time, because nearly all the relief it replaced was already raster-only (§9).</p>

<div class="view rules"><h3>The hard rules this was built and judged under (the designer's, verbatim where quoted)</h3><ul>
<li><b>The KEYBOARD must read as a keyboard at follow height</b> — it is a headline object beside the cartons and the vending machine: a single slab box + a cap / gap grid on
the base lattice, a longer space-bar run, a slightly lighter cap colour than the deck. Verdict row at follow height ×1 / ×3, then close-up, five tiers (§2, §3).</li>
<li><b>NO GRADIENTS anywhere in a marking</b> — flat colour per texel, ≤ 3 colours (a palette entry per marking is a MATERIAL: albedo — absolute, or × the box's own —
roughness, emitted radiance). The one place with more than three lit hues is the vending window (three entries: two product colours + the backlight; the rails are the
machine's own body showing through the transparent cells).</li>
<li><b>NO BAKED LIGHTING of any kind</b> — no painted shadows, no faux-AO in seams beyond the flat seam colour, no bevels on key caps, no vignettes: a marking writes albedo /
roughness / genuine emission only, so every bit of shading on it comes from the real lights (a moving torch, the mirror floors, the light meter). With the palette holding
materials rather than shaded colours <b>this is impossible by construction</b> — there is no field to put a shadow in (§1; the albedo-view crops in §5 show the flat cells).
Nothing authored had to be flattened: the first cut already had no depth edges or vignettes.</li>
<li><b>"Simple enough — low resolution, intentionally kinda like pixel art — so it doesn't draw attention to how it's a flat texture"</b>: ONE world-space base texel
(<code>MARKING_TEXEL</code> 2.5 cm) with a nesting ladder <code>fine</code> = 1.25 cm / <code>coarse</code> = 5 cm per marking; every rect / grid line / glyph cell snaps to
its lattice; anti-aliasing only at cell boundaries; under ~1 output pixel per cell a marking fades to a local, then global, mean instead of aliasing (§1, §4).</li>
<li><b>Never demote a free-standing object</b> to a marking on the surface under it, however thin — papers, notes, books, trays keep their boxes ("the sheet's edge is what
makes it a thing on the table"); markings go ON objects (papers get grey text bars, one gets a scribble); what may be demoted is only relief that belongs to a face (§9).</li>
</ul></div>

<div class="controls">tiles: <button data-z="0.5">×½</button><button data-z="1" class="on">×1</button><button data-z="1.5">×1.5</button>
<span class="dim">— crops of the OUTPUT frame (1777×1000 at high) upscaled ×3 nearest at capture (so "×3" tiles are 3 output px per screen px at zoom ×1); scroll a strip sideways. Theme:</span>
<button data-t="light">light</button><button data-t="dark">dark</button>
<span class="toc"><a href="#how">how it works</a><a href="#verdict">verdict rows</a><a href="#tiers">five tiers</a><a href="#res">world resolution</a><a href="#vending">vending: night / lit / mirror</a><a href="#lights">emissive = lights</a><a href="#cost">cost</a><a href="#identity">identity</a><a href="#demote">geometry → markings</a><a href="#refl">reflections + GI</a><a href="#honest">honest read</a><a href="#defaults">defaults</a><a href="#drive">drive it</a></span></div>
<script>
document.querySelectorAll('.controls button[data-z]').forEach(b => b.onclick = () => { document.documentElement.style.setProperty('--zoom', b.dataset.z); document.querySelectorAll('.controls button[data-z]').forEach(x => x.classList.toggle('on', x === b)); });
document.querySelectorAll('.controls button[data-t]').forEach(b => b.onclick = () => { document.documentElement.dataset.theme = b.dataset.t; });
</script>
''')

# ---- 1. how it works
H.append('''
<h2 id="how">1. What was built — the representation, the shader, the rules in numbers</h2>
<p><b>Representation (image-style authoring, analytic rendering).</b> A marking = <code>{ face, res, at: [U0, V0], size: [W, H] ≤ 32×32, pal: ≤ 3 material entries, cells: H strings of W chars from ". a b c" }</code>
— a 2-bit-per-cell bitmap whose bottom-left cell sits at integer lattice coordinates (U0, V0) from the FACE CENTRE along the face's (u = right, v = up seen from outside; on ±y u = +x, v = ∓z) axes,
cell size = 2.5 cm × ½ / 1 / 2 (<code>fine</code> / <code>base</code> / <code>coarse</code>, all nesting on the same face). A palette entry is a <b>material</b>: <code>albedo</code> (absolute linear rgb) or <code>mul</code> (× the box's own albedo),
<code>rough</code> (absent = the box's), <code>emit</code> (radiance rgb). ≤ 4 markings per box (<code>BoxData.markings</code> / <code>PropPartData.markings</code> in the level file, validated: keys, enums, the bitmap inside its face, cell alphabet ≤ palette length;
canonical serialize; both load directions; the level identity probe compares them leaf for leaf). Procedural kinds are <b>generators</b> (<code>scene/markings.ts GEN.grid / seams / lines / scribble / dots / window / glyph</code> painting a
<code>CellCanvas</code>); hand-drawn kinds are ASCII art in <code>scene/markingDefaults.ts</code>. The office's per-KIND defaults live there (keyboard, monitor UI bars, carton tape + print + label, shelf cartons, filing cabinet, cupboards, binder,
book run, papers, sheets, whiteboard, both vending machines, keypad, extinguisher / cabinet / cylinder, rack vents + LEDs, door leaf plates, clock, lobby sign, placard, plate / LED / display helpers, pallet deck, first-aid cross) and
<code>officeGen.ts</code> calls them at the object sites, so <code>levels/office.json</code> carries every marking explicitly (243 KB → 251 KB with cells; 149 records / 1.7 k table rows at run time). Two examples as stored:</p>
<pre>keyboard (0.4 × 0.14 m slab, +y, base 2.5 cm → 14 × 4      carton print (+z, fine 1.25 cm, ASCII art,      shipping label (−z, fine, 12 × 8):
after the inward snap; generated by GEN.grid):              12 × 8):
  "at": [-7, -2], "size": [14, 4]                              ..a....b...b   a, b = ink 0.16 / 0.12 / 0.08     aaaaaaaaaaaa   a = label paper 0.86
  ababababababab   a = deck  albedo 0.035  rough 0.6           .aaa...b...b                                     abbbbbbb.a.a   b = grey text bars 0.42
  aaaaaaaaaaaaaa   b = cap   albedo 0.15   rough 0.45          a.a.a..bbbbb                                     a........a.a
  abababbbbaabab   ← the space-bar run                         ..a.....bbb.                                     abbbbb...a.a
  aaaaaaaaaaaaaa                                               ..a......b..                                     a........a.a
                                                               ..a......b..                                     abbbbbbb.a.a
                                                               ..a.....bbb.                                     a...........
                                                               aaaaa.......                                     aaaaaaaaaaaa</pre>
<p><b>GPU.</b> No image, no texture binding, no sampling in any ray pass. The table lives in the <b>tail of the existing boxMat storage buffer</b> (no new binding anywhere — the fragment stages were at 9 of Metal's 10): a record = 8 header vec4 rows
(where / which face / res, coverage fractions, three material entries) + ⌈W·H / 48⌉ cell rows (12 cells per float as an exact small integer — no bit pattern a float load could renormalise). A box's first record row rides in the top 14 bits of its GPU
flags word (bits 18‥31; the glass probe now asserts they are set exactly on marked boxes); the secondary rays read a 4th mat row = the box albedo with the markings' area average folded in on the CPU (§10). Frame uniform +16 B (<code>markCfg</code>
@688: base texel — 0 = off everywhere —, contrast, emission ×, evaluate-at-reflection-hits; frame-layout probe green, materials-frame compares the first 688 B against main's <code>writeFrame</code>). Evaluation (<code>render/shaders/markings.wgsl</code>):</p>
<ul>
<li><b>g-buffer</b> (<code>fsBox</code>, after the detail layer, before the encounter's decals): box-local position + face from the flat normal; per record on this face: cell coords = face uv ÷ texel − (U0, V0); the pixel footprint per axis from
<code>dpdx/dpdy</code> of the world position (taken in uniform control flow, rotated into the face); the two nearest cells per axis blended by the footprint's <b>analytic coverage of the boundary between them</b> — a hard step at zero footprint, a
one-cell ramp at one cell per pixel — so AA exists only at cell edges and is stable under the TAAU jitter (three consecutive frames at low: tile mean luma 139.51 / 139.56 / 139.53); writes albedo (entries with an albedo lerp from the pixel's own by
<code>contrast</code>) and roughness. <b>Minification</b>: past 0.75 cells per pixel the taps fade to the plain box average of the ≤ 4×4 cells under the footprint (a LOCAL mean: a row of LEDs stays a row of dim dots), past ~3 cells per pixel to the
record's global coverage fractions × how much of the footprint the bitmap covers (a tint, never noise).</li>
<li><b>composite</b> adds the emission of emissive entries at the primary hit (× the box's <code>markGain</code> — the switchable's supply, so a blackout / the OCP / a flicker take the vending window and a monitor's UI bars down with the fixture — ×
<code>emissiveScale</code>), so it blooms and reads in NV like a fixture. <b>reflect.wgsl / reflect_p5.wgsl</b> evaluate the hit box's markings at reflection hits (albedo + emission), band-limited by a cone = the receiver pixel's footprint + 2α ×
hit distance (§10). Gather / cascade / probe hits never evaluate cells: they read the folded albedo row.</li>
<li><b>Legibility arithmetic.</b> Follow camera: pitch 55°, distance 21 m, vertical fov 28°, 1000 output rows at high → 1.05 cm per output pixel across the view; on a desk top 1.05 × 1.28 cm per px, on a vertical face facing the camera 1.05 × 1.83.
So one <b>base</b> cell (2.5 cm) is ≈ 2.4 × 2.0 output px on tops and 2.4 × 1.4 on fronts (over the 1.5 px floor); a <b>fine</b> cell is 1.2 × 1.0 (under it: only for close cameras — it fades toward its mean at follow height, mostly on the lower
tiers); a <b>coarse</b> cell 4.8 × 4. Internally at high (0.77 scale, 770 rows) a base cell is 1.84 px, at medium 1.44, at low 1.03, at verylow 0.71 (→ the mean: the keyboard is a grey slab with a lighter middle at verylow, §3).</li>
</ul>
''')

# ---- 2. verdict rows
VIEWS = [
 ('keyboard', "Keyboard on the manager's desk under the desk lamp", "verdict: <span class='good'>reads as a keyboard</span> at ×1 and ×3 — two rows of caps + the space-bar run on a near-black deck; the papers beside it get their bars. In the dark monitor above it the key grid shows again, mirrored (RT reflections at a screen's 0.08 roughness)."),
 ('cartons', 'Cartons on the storage floor under the bare bulb (+ the shelf cartons behind)', "verdict: <span class='good'>read as shipping cartons</span> — the brown tape band over the top seam and down the near face is the signifier that works at 21 m; the fine print (this-side-up arrows + fragile glass) survives as small dark marks low on the faces and reads fully from ~8 m in. First cut had light kraft tape: invisible at follow height, changed to brown."),
 ('cartonsCub', 'Cartons against the cubicles\' west partition (moonlit, mostly dark)', "verdict: <span class='warn'>tape reads where any light reaches; in the unlit corner nothing does</span> — markings are albedo: no light, no signifier (by the rules). The recycling box (blue) has no tape by design."),
 ('vending', 'The two vending machines in the break room, front (they face south), the room dark as at night', "verdict: <span class='good'>instantly two vending machines</span> — A (left) the drinks machine: four shelves of tall bottles in the machine's red + dark cola against a warm red backlight, a lit button column, flap and coin panel; B the snack machine: seven shelves of packets in blue / orange, tags, a keypad block (real 3 cm box, fine key grid), bin + coin return. Before: two uniform glowing slabs."),
 ('vendingRefl', 'Their image in the break-room lino (rough 0.22)', "verdict: <span class='good'>the windows land in the floor</span> as soft red / blue lobes hardening toward the contact, through the reflection pass evaluating the emissive marking at its hits (band-limited by the lino's cone: no can structure in the lobe, physically right) plus the registered light's analytic image."),
 ('cabinets', 'The filing cabinets against the corridor partition (drawers face the cubicles)', "verdict: <span class='good'>three drawers each, seams + pulls</span> (coarse 5 cm cells: a seam is 5 cm — chunky and legible; replaces nine NoShadow pull-strip boxes)."),
 ('papers', 'Papers on a cubicle desk', "verdict: <span class='good'>documents, not white slabs</span> — grey bars a cell tall, ragged, a paragraph break; the sheets keep their boxes and their edge shadow."),
 ('whiteboard', 'Conference-room whiteboard (marker writing in two muted colours + a green scribble; the sticky notes stay boxes)', "verdict: <span class='good'>reads as a used whiteboard</span>; the three stroke boxes it had are demoted into these markings."),
 ('door', 'Server-room door, corridor face (dim: one corridor panel lit)', "verdict: <span class='warn'>kick plate + push plate are there and correct, but a stainless plate on a dark leaf in a dark corridor is a low-contrast signifier</span> — it reads when a torch or the panel catches its lower roughness (0.32 vs the leaf's 0.55), which is the physically honest version."),
 ('extinguisher', 'Extinguisher on the corridor wall west of the server door', "verdict: <span class='good'>the white label band makes the red cylinder an extinguisher</span> rather than a red post (70 output px tall at follow height; the band is 3 of them)."),
 ('racks', 'Server racks, west bank, LED faces', "verdict: <span class='good'>the LED rows read exactly as the old emissive nubs did</span> (fine dots, the amber fault light included; 96 boxes gone) — after the local-mean minification fix: the first cut smeared each LED bitmap into a green bar at follow height. The vent grille on the lower doors is subtle by intent (texture of the metal)."),
 ('binders', 'Three binders stood on a cubicle desk', "verdict: <span class='warn'>white spine labels visible up close; at follow height three 6 cm spines are 6 px each — the labels are a couple of pixels: they help a little, the silhouette does the work</span>."),
]
H.append('<h2 id="verdict">2. The verdict rows — BEFORE (main\'s office, <code>?level=relief</code>) vs AFTER at follow-camera height, then the close showcase angle</h2>')
H.append('<p>Every pair is the same staged deterministic frame (guards parked dark, Sam invisible, phases zeroed, 26–30 settled renders at high 1368×770 → 1777×1000): the game camera\'s own pitch 55° / distance 21 m / fov 28° looking at the object ("follow"), cropped ×3 nearest (and ×1 for the three headline objects), then a closer angle. Left / first = before, right / second = after.</p>')
for key, title, verdict in VIEWS:
    H.append(f'<div class="view"><h3>{title}</h3><p>{verdict}</p><div class="strip"><div class="row">')
    if key in ('keyboard', 'cartons', 'vending'):
        H.append(fig(f'lgB_{key}_f_x1.jpg', 'before · follow ×1'))
        H.append(fig(f'lgA_{key}_f_x1.jpg', 'after · follow ×1'))
    H.append(fig(f'lgB_{key}_f_x3.jpg', 'before · follow ×3'))
    H.append(fig(f'lgA_{key}_f_x3.jpg', 'after · follow ×3'))
    H.append('</div></div><div class="strip"><div class="row">')
    H.append(fig(f'lgB_{key}_close.jpg', 'before · close', cls='shot', maxw=760, q=82))
    H.append(fig(f'lgA_{key}_close.jpg', 'after · close', cls='shot', maxw=760, q=84))
    H.append('</div></div></div>')
# extra closes
H.append('<div class="view"><h3>More of the set, close (after)</h3><div class="strip"><div class="row">')
for name, cap in [('lg_lobbySign_close.jpg', 'lobby sign panel: the mark + two lines of name are markings now (4 boxes demoted; same look)'), ('lg_breakEast_close2.jpg', 'the kitchen wall: microwave clock (fine emissive bars), coffee LED, cupboard door seams tiled over 4.4 m, the sink inset in the counter top'), ('lg_kb_close.jpg', 'the keyboard mirrored in the manager\'s dark monitor: markings evaluated at reflection hits')]:
    H.append(fig(name, cap, cls='shot', maxw=700, q=82))
H.append('</div></div></div>')

# ---- 3. tiers
H.append('<h2 id="tiers">3. Five tiers at follow height — does it degrade to a tint, does it crawl?</h2>')
H.append('<p>ultra 2133×1200 · high 1368×770 → 1777×1000 · medium 1072×603 → 1600×900 · low 768×432 → 1280×720 · verylow 533×300 → 1066×600 (each crop is the same region of its own output frame ×3, so the tiles shrink with the output). Keyboard: keys distinct at ultra / high, visible at medium, key rows soft at low, <b>a grey slab with a lighter interior at verylow — a tint, no noise</b>, as designed. Vending: the coarse windows read at every tier. <b>Shimmer</b>: three consecutive frames of the keyboard tile at low (below, ×4) — mean luma 139.51 / 139.56 / 139.53, no crawl by eye: the AA is analytic against the lattice, so the TAAU jitter moves nothing.</p>')
H.append('<div class="strip"><div class="row">')
for p in ['ultra', 'high', 'medium', 'low', 'verylow']: H.append(fig(f'lg_tier_{p}_kb_x3.jpg', f'{p} · keyboard · follow ×3'))
H.append('</div></div><div class="strip"><div class="row">')
for p in ['ultra', 'high', 'medium', 'low', 'verylow']: H.append(fig(f'lg_tier_{p}_vend_x3.jpg', f'{p} · vending · follow ×3'))
H.append('</div></div><div class="strip"><div class="row">')
for k in range(3): H.append(fig(f'lg_low_kb_f{k}_x4.jpg', f'low · frame {k} · ×4'))
H.append('</div></div>')

# ---- 4. world resolution
H.append('''<h2 id="res">4. World resolution — the base texel at 2 / 2.5 / 4 cm (the level regenerated at each: <code>tools/level-export.ts --texel</code>, <code>?levelFile=office-t20.json</code>)</h2>
<div class="wrap"><table><tr><th>base texel</th><th>output px per BASE cell at follow height, high (desk top · front face)</th><th>per FINE cell</th><th>per COARSE cell</th><th>keyboard 0.4 × 0.14 m</th></tr>
<tr><td>2.0 cm</td><td class="n">1.9 × 1.6 · 1.9 × 1.1</td><td class="n">0.95 × 0.8</td><td class="n">3.8 × 3.1</td><td>19 × 7 cells: three key rows + the bar — most keyboard-like, keys 1.9 px</td></tr>
<tr><td><b>2.5 cm</b> (shipped)</td><td class="n"><b>2.4 × 2.0 · 2.4 × 1.4</b></td><td class="n">1.2 × 1.0</td><td class="n">4.8 × 3.9</td><td>15 × 5: two rows + the bar, keys 2.4 px — reads, cleanly over the 1.5 px floor</td></tr>
<tr><td>4.0 cm</td><td class="n">3.8 × 3.1 · 3.8 × 2.2</td><td class="n">1.9 × 1.6</td><td class="n">7.6 × 6.2</td><td>9 × 3: one row of four keys + a bar — a control panel, not a keyboard</td></tr></table></div>
<p><b>Recommendation: keep 2.5 cm as the base.</b> 2 cm buys the keyboard a third row and is still (just) over the pixel at high, but everything base-lattice drops to 1.5 px at medium and under a pixel at low — the whole set would live in the
minification fade on the tiers most players get; 4 cm is right for big things (it is what <code>coarse</code> already gives the cabinet fronts, kick plates and vending windows) and wrong for desk objects. The ladder does the real work: desk
objects on base, carton print / LEDs / clock hands / keypads on fine (accepting they are close-camera detail), fronts over 0.8 m on coarse. <b>Does the fine carton print earn its keep at play distance?</b> Partly: after the local-mean fix the
arrows + glass survive at 21 m as small dark marks that say "printed carton" without being legible; the tape does the recognising. I would keep the print (it costs nothing and pays off whenever the camera comes in — the tour, a zoom, the
breach) and not add more of it.</p>''')
H.append('<div class="strip"><div class="row">')
for t, cap in [('t20', '2.0 cm'), ('tier_high', '2.5 cm'), ('t40', '4.0 cm')]:
    nm = f'lg_{t}_kb_f_x3.jpg' if t != 'tier_high' else 'lg_tier_high_kb_x3.jpg'
    H.append(fig(nm, f'{cap} · keyboard · follow ×3'))
H.append('</div></div><div class="strip"><div class="row">')
for t, cap in [('lg_t20_kb_close.jpg', '2.0 cm · close'), ('lg_kb_close.jpg', '2.5 cm · close'), ('lg_t40_kb_close.jpg', '4.0 cm · close')]:
    H.append(fig(t, cap, cls='shot', maxw=560, q=82, crop=(560, 300, 700, 420)))
H.append('</div></div><div class="strip"><div class="row">')
for t, cap in [('lg_t20_cartons_close.jpg', '2.0 cm · cartons close (tape base 4 cm wide, print fine 1 cm)'), ('lgA_cartons_close.jpg', '2.5 cm (tape 5 cm, print 1.25 cm)'), ('lg_t40_cartons_close.jpg', '4.0 cm (tape 8 cm coarse-ish, print 2 cm — the most legible print from afar)')]:
    H.append(fig(t, cap, cls='shot', maxw=560, q=82, crop=(500, 120, 900, 640)))
H.append('</div></div><div class="strip"><div class="row">')
for t, cap in [('lg_t20_cartons_f_x3.jpg', '2.0 cm · cartons · follow ×3'), ('lgA_cartons_f_x3.jpg', '2.5 cm · follow ×3'), ('lg_t40_cartons_f_x3.jpg', '4.0 cm · follow ×3')]:
    H.append(fig(t, cap))
H.append('</div></div><div class="strip"><div class="row">')
for t, cap in [('lg_t20_vend_close.jpg', '2.0 cm · vending close (windows are coarse = 4 cm cells here)'), ('lgA_vending_close.jpg', '2.5 cm (5 cm cells)'), ('lg_t40_vend_close.jpg', '4.0 cm (8 cm cells: fewer, bigger products)')]:
    H.append(fig(t, cap, cls='shot', maxw=560, q=82, crop=(440, 100, 900, 780)))
H.append('</div></div>')

# ---- 5. vending
H.append('''<h2 id="vending">5. The vending corner: night, lit, the mirror, direct-only, and the flat cells</h2>
<p class="dim">These are the FIRST-CUT machines (multi-hue can windows) as reviewed; they were restyled on 08-10 &mdash; &sect;10b has the red / blue single-chroma machines, their reflections and the reflection-path fixes. Kept here as the record of what the designer reacted to.</p>
<p>The product window is the one <b>emissive</b> marking that matters, so it gets its own checks: at night (the room's panels off, as the level starts) the windows are the corner's light; with the break-room panels on they sit in a lit
room without blowing out; the bloom is the same modest halo the old slabs had (the windows are calibrated to the old slabs' luminous intensity over nearly the same area, so their mean radiance — what bloom and tone mapping see — is about
where it was: peaks 3.1 (A, red) / 1.75 (B, blue) W/sr/m² per channel against the old flat 2.6 / 2.8). The <b>direct-only</b> view shows the two registered lights laying red and blue light on the lino and the west wall — the marking's
light is in the direct pass like any fixture. The <b>albedo</b> view shows what a marking is made of: flat cells, three materials, nothing shaded.</p>''')
H.append('<div class="strip"><div class="row">')
H.append(fig('lgA_vending_close.jpg', 'night (panels off): after, close', cls='shot', maxw=640, q=84))
H.append(fig('lg_vend_lit_close.jpg', 'break-room panels ON: the machines in a lit room (the door beyond: kick + push plate)', cls='shot', maxw=640, q=84))
H.append(fig('lg_vend_direct_close.jpg', 'direct-only (debug view 3), the corner: the windows\' registered lights on the lino and the wall', cls='shot', maxw=640, q=82))
H.append('</div></div><div class="strip"><div class="row">')
H.append(fig('lg_vend_refl_close.jpg', 'the mirror image in the lino, close', cls='shot', maxw=640, q=84))
H.append(fig('lg_albedo_vend_x1.jpg', 'albedo view (debug 1): flat cells — rails = the body showing through transparent cells, products, backlight; the keypad block\'s fine grid', cls='shot', maxw=560, q=84))
H.append(fig('lg_albedo_kb_x2.jpg', 'albedo view of the desk: key caps on the deck, text bars on the papers — no shading in the data', cls='shot', maxw=560, q=84))
H.append('</div></div>')

# ---- 6. lights
H.append('''<h2 id="lights">6. Emissive markings ARE lights (the one-model rule)</h2>
<p>Any marking entry with <code>emit</code> on a switchable's box registers a one-sided rectangular emitter over its bitmap exactly as an emissive fixture box does (<code>game.ts</code>: radiance × area → on-axis intensity, the disc never wider than
the rect's short side, 7 cm proud of the face, in the target's <code>areaLights</code> so lighting.ts drives it with the supply; the marking is then flagged area-lit so a reflection ray takes only <code>emitTraceK</code> of its traced radiance
and the analytic image carries the rest — one window either way). Below an on-axis intensity of 0.05 nothing registers (LED rows 0.01, a monitor's UI bars 0.02, the drinks machine's buttons 0.002 — they glow on screen and in mirrors only, as
the raster-only nubs they replace did; the dimmest real fixture light on the floor is an exit sign at 0.46). The office registers exactly two: <code>vending</code> 2.28 and <code>vending2</code> 1.29 W/sr — the light list has the same
count as main's (the old slab lights were 2.84 / 2.22 on the peak channel; the windows are calibrated on <b>luminous</b> intensity because their light is whiter than the pure red / blue slabs — matched on the peak channel the meter read a third
more). ReSTIR shadows, froxel beams, the bounce and the light meter see them because they are lights, full stop.</p>
<p><b>Proof — the light meter</b> (the irradiance probe at Sam's chest / head, W/m², guards parked, torches off; before = <code>?level=relief</code> = main's slabs, after = the windows):</p>
<div class="wrap"><table><tr><th>Sam standing at</th><th>chest before</th><th>chest after</th><th>Δ</th><th>head before</th><th>head after</th><th>Δ</th></tr>
<tr><td>(29.1, 14.3) — 1 m in front of the machines</td><td class="n">1.2741</td><td class="n">1.2877</td><td class="n good">+1.1 %</td><td class="n">1.0360</td><td class="n">1.1054</td><td class="n warn">+6.7 %</td></tr>
<tr><td>(29.1, 16.0) — 2.7 m in front</td><td class="n">0.2910</td><td class="n">0.2892</td><td class="n good">−0.6 %</td><td class="n">0.2933</td><td class="n">0.2938</td><td class="n good">+0.2 %</td></tr>
<tr><td>(31.5, 15.0) — off axis, toward the table</td><td class="n">0.1293</td><td class="n">0.1295</td><td class="n good">+0.2 %</td><td class="n">0.1356</td><td class="n">0.1366</td><td class="n good">+0.7 %</td></tr>
<tr><td>(33.5, 20.5) — the far south-east corner</td><td class="n">0.0295</td><td class="n">0.0293</td><td class="n good">−0.7 %</td><td class="n">0.0326</td><td class="n">0.0322</td><td class="n good">−1.2 %</td></tr>
<tr><td>(23.0, 16.3) — control: the cubicles</td><td class="n">0.6470</td><td class="n">0.6470</td><td class="n">0</td><td class="n">0.7464</td><td class="n">0.7464</td><td class="n">0</td></tr></table></div>
<p class="small">Chest within 1.1 % everywhere (the brief asked 2 %); the head 1 m in front reads +6.7 % because the window is taller than the old slab and reaches head height — geometry, not a leak. First cut (windows off-centre, calibrated on the
peak channel) read +35 % — both fixed: the windows are centred where the slabs were and calibrated on luminance.</p>''')

# ---- 7. cost
H.append('''<h2 id="cost">7. Cost — markings on vs off, per tier (serialized offscreen renders, interleaved AB, medians; the designer was playing on the same GPU: p95s carry their contention, medians held)</h2>
<div class="wrap"><table><tr><th>tier · view</th><th>g-buffer stamp off → on</th><th>reflect</th><th>direct</th><th>gather</th><th>Σ compute / union off → on</th><th>Δ union</th></tr>
<tr><td>high 1368×770 · vending follow</td><td class="n">0.197 → 0.197</td><td class="n">0.328 → 0.328</td><td class="n">2.163 → 2.097</td><td class="n">1.442 → 1.442</td><td class="n">7.078 → 7.078</td><td class="n good">0.00</td></tr>
<tr><td>high · keyboard close (most marked pixels)</td><td class="n">0.131 → 0.197</td><td class="n">0.066 → 0.066</td><td class="n">1.638 → 1.638</td><td class="n">1.835 → 1.835</td><td class="n">6.947 → 6.881</td><td class="n good">−0.07</td></tr>
<tr><td>high · cubicles overview</td><td class="n">0.197 → 0.131</td><td class="n">0.066 → 0.131</td><td class="n">2.359 → 2.359</td><td class="n">1.835 → 1.835</td><td class="n">7.602 → 7.668</td><td class="n good">+0.07</td></tr>
<tr><td>ultra 2133×1200 · vending follow</td><td class="n">0.131 → 0.131</td><td class="n">1.245 → 1.311</td><td class="n">4.981 → 4.981</td><td class="n">5.112 → 5.177</td><td class="n dim">19.4 → 25.2 ¹</td><td class="n dim">contended</td></tr>
<tr><td>medium 1072×603 · vending follow</td><td class="n">0.066 → 0.066</td><td class="n">0.131 → 0.131</td><td class="n">1.311 → 1.311</td><td class="n">1.049 → 1.049</td><td class="n">4.850 → 4.784</td><td class="n good">−0.07</td></tr>
<tr><td>low 768×432 · vending follow</td><td class="n">0.066 → 0.066</td><td class="n">—</td><td class="n">0.786 → 0.721</td><td class="n">1.049 → 0.852</td><td class="n dim">6.55 → 5.83 ¹</td><td class="n dim">contended</td></tr>
<tr><td>verylow 533×300 · vending follow</td><td class="n">0.066 → 0.066</td><td class="n">—</td><td class="n">0.328 → 0.328</td><td class="n">0.459 → 0.459</td><td class="n">2.097 → 2.097</td><td class="n good">0.00</td></tr></table></div>
<p class="small">¹ the ultra and low takes drew the designer's frames in one block (p95 25 ms at ultra in BOTH variants, 10 ms at low in the OFF block); their per-pass columns are clean and move by at most one 65 µs quantum, like every other row.
Verdict: <b>≤ +0.07 ms union at high (target +0.1), 0 at verylow, every pass within one timer quantum at every tier</b> — the evaluation lives in the g-buffer's fragment stage and in the few composite / reflection-hit pixels that land on a marked
box, and the offscreen g-buffer stamp (honest offscreen: 0.13–0.20 ms) does not move. Table upload: once, 27 KB. Frame uniform +16 B.</p>''')

# ---- 8. identity
H.append('''<h2 id="identity">8. Identity — everything off = main, hash for hash; the level identity gate</h2>
<ul><li><b><code>?level=relief&amp;nomarkings</code> vs main @ 5d8eb46</b> served from a scratch worktree, the P4 harness's deterministic still (<code>__p4.identityHash</code>: seeded dice, parked guards, zeroed phases, <code>__resetClock</code>,
40 frames + one offscreen render, FNV over the RGBA readback): <b>high</b> cubicles <code>56247efe = 56247efe</code>, vending <code>e4e919fe = e4e919fe</code>, storage <code>aa8e482f = aa8e482f</code>; <b>medium</b> cubicles
<code>8109c591 = 8109c591</code>, vending <code>290932a4 = 290932a4</code>. What the branch changes on that path and why none of it reaches a pixel: the mat rows are 4 vec4 a box instead of 3 (same numbers, other addresses; the g-buffer's
previous-transform index follows), the Frame is 704 B with markCfg.x = 0, fsBox takes two derivatives it never uses and a branch it never enters, composite / the reflection passes test a slot that is 0, the seven secondary-hit sites read
<code>boxAlbedoSec</code> = the same three floats as <code>boxAlbedo</code>, door leaves carry marking data the upload ignores.</li>
<li><b>Level.</b> <code>levels/office-relief.json</code> (generator with <code>{ markings: false, demote: false }</code>) is <b>byte-identical to main's <code>levels/office.json</code></b> (digest 7168ed9858f17); the new
<code>levels/office.json</code> is what the generator writes by default (digest ed51c1e88d6e6): <code>probes.ts level</code> — generator ≡ file 0 diffs, digest three ways equal, not stale, canonical, validator + planted faults + round trip ALL PASS.</li>
<li><b>Gates</b> (this tree): typecheck clean · <code>tools/qa/gate.sh perf frame-layout level materials player glass</code>: {GATE} · <code>tour.ts --runs 1</code>: {TOUR} · <code>soak.ts --seeds 2 --minutes 4</code>: {SOAK} ·
<code>bun run build</code>: {BUILD} · GPU validation (an error scope + the uncaptured list across the five presets × markings on / off × debug views 0 / 1 / 14 / 15): 0 errors.</li></ul>''')

# ---- 9. demotion
H.append('''<h2 id="demote">9. Geometry → markings: the rule, what moved per room, what it saved (honestly: box count yes, ray time no)</h2>
<blockquote>The rule (the designer's, applied): NEVER demote a free-standing object to a marking on the surface under it, however thin — papers, folders, notes, books, trays, mats keep their boxes (the sheet's edge shadow / its offset from the
desk is what makes it a thing on the table); markings go ON objects (papers get text bars, one gets a scribble; whiteboards get marker strokes; the keyboard keeps its one slab and gets the key grid). What MAY be demoted is only RELIEF THAT
BELONGS TO A FACE — sub-part boxes whose removal deletes no object: pull strips flush on a drawer front, LED nubs, glow / trim strips, screen sheets flush on a housing, door-gap strips, deck boards, painted marks modelled as 2 mm boxes.</blockquote>
<div class="wrap"><table><tr><th>room</th><th>demoted (boxes → markings on the parent face)</th><th>boxes</th><th>deliberately stayed a box (+ what it got ON it)</th></tr>
<tr><td>lobby</td><td>the sign panel's mark (square + punched centre) and two lines of 'name'</td><td class="n">−4</td><td>the sign-in book's open page (a signature scribble on it), the magazines, the counter's phone / bell / pen, canvases</td></tr>
<tr><td>cubicles</td><td>3 filing cabinets × 3 pull strips; the photo in its frame; the clock's face + two hands; the two placards' letter bars and squares (both faces); the printer's LED nub</td><td class="n">−22</td><td>every papers() sheet (text bars ON them), the three binders (spine labels), the whiteboard on the south pier (marker writing), the box fan, jacket, pot plant, monitors, keyboards (key grid ON the slab)</td></tr>
<tr><td>corridor</td><td>—</td><td class="n">0</td><td>the extinguisher (label band on it), its cabinet (pictogram + handle slot), the notice board, name plates, prints, the bench</td></tr>
<tr><td>conference</td><td>the whiteboard's three stroke boxes; the clock's face + hands</td><td class="n">−6</td><td>the four sticky notes, the marker tray and markers, the papers on the table (bars), jug, glasses, phone + keypad</td></tr>
<tr><td>server</td><td>96 LED nubs (8 racks × the populated 4U slots × 3) → fine emissive dots the rack's switchable drives; the UPS display plate + 2 LEDs; the crash cart's screen sheet; the whiteboard's rack-map bars (3); the cable cover's yellow line</td><td class="n">−104</td><td>the racks' glow strips (they ARE the lights: NoPrimary + NoShadow, an area light each), the cable tray, drops, crash cart, agent cylinder (label on it), the whiteboard + tray, breaker LED (its target drives the box's own emissive)</td></tr>
<tr><td>manager</td><td>—</td><td class="n">0</td><td>the four book / binder runs on the shelves (spines + labels ON them), his certificate (lines), papers, briefcase, phone, coat stand</td></tr>
<tr><td>storage</td><td>—</td><td class="n">0</td><td>every carton (tape + print), the shelf cartons, the stock clipboard's sheet (a stock list ON it), hi-vis vest, hand truck, mop bucket, the keep-clear hatching (45° strips: not representable on the lattice — left)</td></tr>
<tr><td>break room</td><td><b>the two vending machines' glowing front slabs (traced!)</b> → product windows; the microwave clock nub; the coffee machine LED; the sink inset sheet; the fridge's door-split strip; the wall cupboards' two gap strips; the bracket TV's screen sheet; the first-aid cross</td><td class="n">−10 (+1 keypad block)</td><td>the fridge handle, the notice board's four pinned sheets (bars on them), mugs, magazines (bars), chairs, the table</td></tr>
<tr><td>exterior</td><td>the pay-and-display's screen + instruction band; the dumpster's open-half dark sheet; <b>the pallet's five deck boards (traced)</b></td><td class="n">−8</td><td>bay lines, wheel stops, the bike, bollards, bulkhead lenses, car lights, the P plate (a letter: not drawn)</td></tr>
<tr><th>total</th><th>925 → 772 statics (−154 + 1); traced statics 627 → 620 (−7); rasterised statics 865 → 712 (−153)</th><th class="n">−153</th><th></th></tr></table></div>
<p><b>What it saved, measured.</b> Boxes per trace-grid cell (parked stage, same both ways): items 2775 → 2761 (−0.5 %), max per cell 18 → 18, cubicles mean 4.04 → 4.04, storage 4.89 → 4.89, server 3.63 → 3.63, break room 1.84 → 1.81, empty cells 349 → 349.
Serialized medians at high, relief → demoted: cubicles overview direct 2.425 → 2.490, gather 1.901 → 1.901, reflect 0.131 → 0.131, union 7.93 → 7.93; vending follow direct 2.163 → 2.163, gather 1.507 → 1.442, reflect 0.328 → 0.328,
softblur 0.983 → 0.918, union 7.47 → 7.34 (−0.13, the two slabs out of the break room's busiest cells — one quantum territory). The stress minute (QRF + rain + two canisters, no fight, 150 serialized frames orbiting at high, 41 lights):
Σ compute p50 {STRESS_R} → {STRESS_D} ms, direct {STRESS_RD} → {STRESS_DD}, gather {STRESS_RG} → {STRESS_DG}, reflect {STRESS_RR} → {STRESS_DR} (the 'before' take drew the designer's frames — its p95 was 17.8 ms against 10.6 — so read the gather column as contention, not a saving; direct and reflect agree with the calm views). <b>So: no ray-time speed-up from this pass, and the reason is instructive</b> — 146 of the 153 boxes it removed
were authored <code>NoShadow</code> (raster-only relief: never in the trace grid, so no ray ever paid for them) and the seven traced ones (the vending slabs, the pallet boards) sit in cells nothing expensive crosses. The office was already lean
where rays go. What the system buys instead is the strategic thing: <b>future dressing detail — legends, labels, panels, grilles, seams — now costs zero rays and zero boxes</b>, reads in the RT reflections and the light meter by
construction, and the raster list is 18 % shorter (upload / motion-vector snapshot / instance count, all under the timer's resolution here).</p>''')

# ---- 10. reflections + GI
H.append('''<h2 id="refl">10. Markings at reflection hits, and the GI fold</h2>
<p><b>Reflection hits</b> (<code>reflect.wgsl</code> / <code>reflect_p5.wgsl</code> <code>shadeReflHit</code> + <code>reflHitParts</code>; restir / denoise / froxel / taau / volumetrics untouched): the hit box's markings on the hit face are
composited into the hit albedo and their emission added, band-limited by a cone footprint = the receiver pixel's own footprint + 2α × hit distance (α = roughness²) instead of derivatives — so the keyboard two metres off in the lino (rough 0.22)
is its mean colour, and in the manager's dark screen (0.08) at arm's length it is keys (§2's last close-up); the vending windows in the lino are the soft lobes of §5. Cost of the reflect pass at high on the vending view: 0.328 → 0.328 ms
(one quantum on the cubicles view: 0.066 → 0.131). Switch: <code>settings.markingReflect</code> / Tab row.</p>
<p><b>Gather / cascade / probe hits do NOT evaluate cells.</b> Each marked box's albedo for the secondary rays is its own albedo + Σ over its markings of (mean albedo change × bitmap area ÷ the box's total surface), computed once on the CPU when
the list is packed (<code>markings.ts secondaryAlbedo</code> → the 4th mat row → <code>boxAlbedoSec</code> at the seven secondary-hit sites in fgather / lighting_common / cards) — the same energy the per-pixel evaluation returns averaged over
the box, at zero ray-path cost. Emission needs no fold: the emissive markings that matter are registered lights (their box is not flagged Emissive, so no gather ray double counts them — exactly the AreaLit rule), and the LED-class ones replace
NoShadow nubs no ray ever saw. <b>Check</b>: the indirect-only view (debug 4) of the break room from the follow camera, 8-bit luma means, main's geometry vs the marked level: the lino tile in front of the machines 19.66 → 19.51 (−0.7 %), the
whole visible room 14.46 → 14.22 (−1.6 %) — against a run-to-run wander of ±1 % on the same tile (19.77 / 19.51 in two default takes): unchanged within the gather's own noise.</p>''')

# ---- 10b. reflections follow-up (08-10)
VR = (560, 345, 400, 300)      # the top two-thirds of the machines' image in the lino, from just under their feet (1600x1000 coords)
MON = (655, 350, 470, 230)     # the manager's screen
SN1 = (250, 630, 340, 150); SN2 = (700, 640, 360, 150)   # carton feet on the stone (night, stand-in torch)
FOL1 = (585, 370, 420, 240); FOL3 = (690, 430, 210, 120)
def vr(tag, cap, k=3, q=78): return fig('lgR_%s.jpg' % tag, cap, crop=VR, scale=k, ref=1600, q=q, maxw=1200)
P = []
P.append('<h2 id="refl2">10b. Follow-up (08-10): &ldquo;the markings don&rsquo;t show up in the glossy reflections &mdash; like the vending machine?&rdquo; &mdash; the diagnosis, two fixes, two rules, the restyled machines</h2>')
P.append('''<p><b>What the designer saw</b>: the vending windows mirrored in the break-room lino as featureless glowing lobes (&sect;5) &mdash; none of the pixel art. <b>The lead&rsquo;s diagnosis</b> from reading the shaders, both confirmed in the code:
(1) a <b>double blur</b> &mdash; <code>markReflHit</code> band-limited the art at a traced hit by a cone growing 2&alpha; per metre (&alpha; = rough&sup2;), but the reflection RAYS are already drawn from the GGX lobe and the specular denoiser averages them, so the lobe was
applied twice; (2) the <b>emissive split</b> &mdash; the window is a registered rectangular light, so on a rough receiver <code>reflect.wgsl</code> takes 1 &minus; <code>emitTraceK(rough)</code> of its image through the ANALYTIC highlight, which knows the
rectangle and not the art: a uniform panel. (3) Nothing else gates them off: <code>markCfg.w</code> is on by default, the vending bodies are statics (not props) and every box &mdash; static or dynamic &mdash; takes its slot bits through the one upload
loop; <code>reflect_p5.wgsl</code> carries the same lines at ultra.</p>
<p><b>What measuring added</b> (before touching anything): at this view the visible blur is neither of those &mdash; it is the <b>lobe itself</b>. The raw traced signal (history 1, no &agrave;-trous; first crop) is a cloud of one-ray dots with no
structure at any cone setting, and cone 0 / 0.25&alpha; / 2&alpha; render identically after the denoiser (next row): on 0.22 lino, &alpha; = 0.048, the reflected lobe&rsquo;s median radius is &asymp; 9.6 cm per metre of mirror path (p80 &asymp; 20 cm) &mdash; a 16 cm
can pitch cannot survive past ~0.4 m of path, and the window&rsquo;s bottom edge already sat 0.3 m above the floor. The old slab looked &ldquo;sharp&rdquo; only because a uniform rectangle has nothing to lose but its edge. So the two fixes below are right
and cheap, but what actually puts a machine&rsquo;s design INTO a satin floor is design at the scale the lobe passes: <b>large luminance structure</b> (a control-column notch, a ribbon, a roundel) &mdash; which is where the designer&rsquo;s restyle landed anyway.</p>''')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_dbg_rt14_raw.jpg', 'BEFORE any fix - the RT term RAW (debug 14, history 1, a-trous 0) at the vending view (the can windows): one GGX-lobe ray per half-res texel. The dots carry the can colours; their spread IS the 0.22 lobe. No prefilter setting changes this picture.', crop=(520, 300, 620, 420), scale=2, ref=1600, q=78, maxw=1100) +
  fig('lgR_dbg_mat.jpg', 'material view (15): the lino reads rough 0.22 everywhere under the machines (red = roughness; the wear map only nudges it) - so kEmit = emitTraceK(0.22) = 0.90: 90 % of the window came through TRACED hits, 10 % analytic', crop=(520, 300, 620, 420), scale=2, ref=1600, q=70, maxw=1100) +
  '</div></div>')
P.append('''<h3>Fix 1 &mdash; the traced-hit cone is the pixel&rsquo;s ray cone + a small share of the lobe</h3>
<p><code>markings.wgsl</code>: fp(t) = fp&#8320; + t&middot;(c<sub>pix</sub> + k&middot;&alpha;), where fp&#8320; = the receiver pixel&rsquo;s footprint, c<sub>pix</sub> = its angular size (a planar mirror keeps the primary cone diverging at the same rate &mdash; this term was missing) and
k = <code>settings.markingReflCone</code>, default <b>0.25</b> (was a hard 2.0): the rays + the denoiser realise the lobe; the per-hit prefilter only trades a little bias for one-ray noise. Tab &#9656; Renderer &mdash; markings &#9656; &lsquo;reflection-hit cone&rsquo;, <code>__mark.set({cone})</code>. The three settings side by side, everything else fixed (after the restyle, high, &times;3):</p>''')
P.append('<div class="strip"><div class="row">' + vr('after_vrefl_cone0', 'cone k = 0 (pixel cone only)') + vr('after_vrefl', 'k = 0.25 (default)') + vr('after_vrefl_cone2', 'k = 2.0 (the old double blur)') + '</div></div>')
P.append('''<p class="dim">Identical to the eye at this distance, as predicted: with 90 % of the signal traced, the lobe (realised by the ray distribution) dominates any per-hit prefilter. The knob matters on polish at short mirror paths (a keyboard in a screen at arm&rsquo;s length), where 2&alpha;&middot;t was still small &mdash; which is why nothing looked wrong there either.</p>
<h3>Fix 2 &mdash; the analytic highlight of a marking&rsquo;s light is textured with the marking (flux-conserving)</h3>
<p>An area light registered for an emissive marking now carries a link to it (<code>lights.ts RtLight.markRef</code> = box &laquo; 2 | ordinal, in the kind word&rsquo;s bits 11&#8229;24, bit 10 = present; <code>common.wgsl lightMarkRef</code>). In
<code>rtGlints</code>&rsquo; kind-3 branch (both reflect modules) the light&rsquo;s uniform, lobe-convolved image is multiplied by <code>markPatternAtMirror</code>: the marking&rsquo;s emission at the point where the receiver&rsquo;s MIRROR ray meets the marking&rsquo;s plane,
&divide; (the record&rsquo;s mean emission &times; the footprint&rsquo;s coverage of the bitmap), band-limited by the pixel cone + the WHOLE lobe (2&alpha; per metre &mdash; the analytic image has no ray distribution to realise the blur, so its texture takes all of it), clamped
0&#8229;6, handed back to 1 as the overlap thins. Extent and fall-off stay the lobe&rsquo;s D (coverage is divided back out); only the relative pattern is imprinted, so its mean over the window is 1 &mdash; flux-neutral by construction. A/B switch:
<code>settings.markingReflPattern</code> (Tab &lsquo;A/B: textured analytic highlight&rsquo;; the sign of <code>frame.markCfg.w</code> &mdash; no Frame growth, still 704 B).</p>''')
P.append('<div class="strip"><div class="row">' + vr('after_vrefl_patoff', 'analytic share UNIFORM (pattern off) - after the restyle, high') + vr('after_vrefl', 'analytic share TEXTURED (default)') + vr('after_vrefl_reflectoff', "markings at reflection hits OFF altogether (settings.markingReflect = false): the hit returns the body's plain albedo, no emission - what is left is the 10 % analytic share of the two lights") + '</div></div>')
P.append('''<p class="dim">On this floor the textured analytic share is a 10 % term under a 90 % traced one, so the first pair differ by a shade in the notch and in the ribbon&rsquo;s glow; on a worn lane at rough 0.3 (kEmit 0.35) it is two-thirds of the image. The third crop is the honest measure of how much of the reflection is the marking at all: nearly all of it.</p>
<h3>The two rules (the designer&rsquo;s), now stated in the code and held by construction</h3>
<blockquote><b>FLUX.</b> An emissive marking redistributes radiance across its face but integrates to its registered light: the kind-3 rectangle is DERIVED from the pattern (colour = mean chroma, intensity = luminance-calibrated radiance &times; area), the
box&rsquo;s own emissive is zero, and every visual path draws the pattern itself &mdash; the g-buffer + composite at the primary hit (<code>markEmissiveAt</code>, nothing added on top of the light), traced reflection hits (<code>markReflHit</code> &times; kEmit),
the analytic highlight (&times; pattern &divide; mean). Illumination, shadows, froxels, GI and the light meter read only the rectangle. <b>Numerically</b> (high, the lino tile under the machines, direct-only view, mean 8-bit luma): pattern textured 94.99 &middot;
uniform 95.01 &middot; markings not drawn at all 95.02 &mdash; identical to 0.03 %; the chest meter 1 m in front of machine A 3.219 / 3.216 W/m&sup2;, between the machines 0.4394 / 0.4370, room middle 0.1013 / 0.1010 (the far control spot wanders 0.045&#8229;0.049 with the gather&rsquo;s own noise).</blockquote>
<blockquote><b>ONE CHROMA per emitter.</b> An emitting bitmap keeps one hue and redistributes LUMINANCE only &mdash; the dominant colour, its light tint / white, a dark &mdash; because ONE rectangular light stands for it and that light&rsquo;s colour is the pattern&rsquo;s
mean chroma; a genuinely two-hue front would need two registered lights (not now). The multi-hue can rows are gone. Where a design wants a second hue (the roundel&rsquo;s red wedge below) it is plain albedo, not emission.</blockquote>
<h3>The restyle &mdash; a red machine and a blue one, &ldquo;in spirit and with our art style&rdquo;</h3>
<p>From the designer&rsquo;s reference photos. Shared structure: a full-height single-hue BACKLIT front on the coarse lattice (18 &times; 29 / 16 &times; 29 cells) with a black cap and frame; a dark CONTROL COLUMN inset on the right quarter (base lattice,
NOT emissive: navy field, the bill / coin unit near the top with a black mouth, seven light-grey selection buttons each with a muted label chip to its left, the coin-return recess with a light lip); the DISPENSER as a <b>real recess</b> &mdash; each
machine is now an upper body on a black plinth set 6 cm back over its left two-thirds plus a flush block under the column (+3 boxes a machine, 772 &rarr; 776; footprint and height unchanged, so nav and collision are untouched), the recess&rsquo;s back
wall marked black with a flap bar. <b>Machine 1</b> (red): a red field, ONE white motif = the diagonal ribbon (a 3-cell band with a slight S, walked as a 3 &times; 3 stamp so it stays continuous however steep) from the lower left of the upper
two-thirds to the top right, three white blocks of varied widths stepping up the open field beside it (the vertical wordmark, suggested &mdash; no letters); palette red (emit) &middot; white (emit, 2.2 &times; the luminance, same warm cast) &middot; black
(no emission). <b>Machine 2</b> (blue): a deep-blue field on a near-black navy body (the transparent cap / frame cells show it), a 9-cell ROUNDEL in the upper third &mdash; white ring and wave band, the upper wedge RED IN ALBEDO ONLY, the lower
wedge the field&rsquo;s blue &mdash; and four white blocks under it; palette blue (emit) &middot; white (emit) &middot; red (albedo). Both calibrated as before: the field&rsquo;s LUMINOUS intensity = the old slab&rsquo;s &times; <code>VENDING_FLUX_K</code> (1.0), one light
each, coloured its mean: A I&#8320; 2.48 over 1.305 m&sup2; (colour 1 / 0.26 / 0.21), B 1.91 over 1.16 m&sup2; (0.23 / 0.37 / 1). Recipes: <code>markingDefaults.ts vendingRedMarks / vendingBlueMarks</code> (<code>ribbonField</code>, <code>globeField</code>,
<code>controlColumn</code>, <code>dispenserMarks</code>); bodies in officeGen&rsquo;s vending block.</p>''')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_before_vend.jpg', 'BEFORE (the branch as first reviewed, b5bcf74): the multi-hue can windows', maxw=760, q=80) +
  fig('lgR_after_vend.jpg', 'AFTER: red ribbon machine + blue roundel machine, dark control columns, recessed dispensers (close, high)', maxw=760, q=82) +
  '</div></div>')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_before_vend_follow.jpg', 'before - follow height x1', crop=FOL1, ref=1600, q=82) + fig('lgR_before_vend_follow.jpg', 'before x3', crop=FOL3, scale=3, ref=1600, q=82) +
  fig('lgR_new3_vend_follow.jpg', 'AFTER - follow height x1 (high)', crop=FOL1, ref=1600, q=82) + fig('lgR_new3_vend_follow.jpg', 'after x3 (high): both read at 21 m - the ribbon, the roundel, the columns', crop=FOL3, scale=3, ref=1600, q=82) +
  fig('lgR_afterU_vend_follow.jpg', 'after x3 (ultra)', crop=FOL3, scale=3, ref=1600, q=82) +
  '</div></div>')
P.append('''<p class="dim">Honest: at the old slabs&rsquo; luminous intensity the fields render as pale as the old slabs did (salmon / powder blue) &mdash; AgX desaturates radiance &asymp; 2 at this exposure; the roundel&rsquo;s red wedge, unlit in a dark room, reads near-black (a Pepsi globe by moonlight does too). <code>VENDING_FLUX_K</code> &asymp; 0.5 gives a properly red / blue front in a break room half as bright &mdash; one constant, the designer&rsquo;s call. The white blocks are blocks: letters wait for the SDF-glyph follow-up.</p>
<h3>(i) Their image in the lino &mdash; before / after, high and ultra (night, fronts lit; &times;3)</h3>''')
P.append('<div class="strip"><div class="row">' + vr('main_vrefl', "MAIN's old uniform slabs (relief level) - the reference the designer remembers: a soft rectangle") + vr('before_vrefl', 'BEFORE (b5bcf74): the can windows - featureless lobes') + vr('after_vrefl', "AFTER (high): the ribbon's glow sweeping through the red image, the column notch, the roundel / block column in the blue - the front, blurred by a satin floor") + '</div></div>')
P.append('<div class="strip"><div class="row">' + vr('mainU_vrefl', 'main, ULTRA') + vr('beforeU_vrefl', 'before, ULTRA') + vr('afterU_vrefl', 'AFTER, ULTRA (2 rays, rough &le; 0.55)') + '</div></div>')
P.append('<h3>The lino&rsquo;s finish is the real lever (physics, not the fix) &mdash; the same frame with the floor at 0.22 / 0.15 / 0.10</h3>')
P.append('<div class="strip"><div class="row">' + vr('after_vrefl', 'lino rough 0.22 (as authored: "soft-edged rectangles hardening at the contact")') + vr('after_vrefl_rough15', "0.15 (the lobby stone's finish): the ribbon and the blocks appear") + vr('after_vrefl_rough10', '0.10: the front, mirrored') + '</div></div>')
P.append('''<p class="dim">One number in <code>officeGen OFFICE_FINISH.lino</code>; it also sharpens every ceiling panel and torch in the corridor and break-room floors, which is why 0.22 was chosen in the RT-reflections lane. Parked as a taste call, not changed.</p>
<h3>(ii) The keyboard in the manager&rsquo;s dark screen (rough 0.08) &mdash; before / after, high and ultra (&times;3)</h3>''')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_before_mon.jpg', 'before (high)', crop=MON, scale=3, ref=1600, q=78, maxw=1200) + fig('lgR_after_mon.jpg', 'AFTER (high): keys, cap rows and the space bar mirrored in the glass - as before: at 0.4 m of mirror path on alpha = 0.0064 neither the old cone nor the split ever touched it', crop=MON, scale=3, ref=1600, q=78, maxw=1200) +
  '</div></div>')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_beforeU_mon.jpg', 'before (ultra)', crop=MON, scale=3, ref=1600, q=78, maxw=1200) + fig('lgR_afterU_mon.jpg', 'AFTER (ultra)', crop=MON, scale=3, ref=1600, q=78, maxw=1200) +
  '</div></div>')
P.append('''<p class="dim">The desk laminate (rough 0.5&#8229;0.6) is over every tier&rsquo;s traced range but ultra&rsquo;s edge, so &ldquo;in the desk&rsquo;s surface&rdquo; has no reflection to show &mdash; by the finish table, not by the markings. The papers sit outside the screen&rsquo;s mirror frustum from any camera that also sees the keyboard in it.</p>
<h3>(iii) Marked cartons on the lobby stone (0.15) &mdash; night, a stand-in torch (a 40-cd spot where a guard would hold one), before / after, high and ultra (&times;3)</h3>''')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_after_stoneN.jpg', 'the staged view (after, high): three cartons pushed onto the stone, lit from the left', maxw=700, q=80) +
  fig('lgR_before_stoneN.jpg', "before x3 - the this-side-up / fragile print mirrored at the stack's foot", crop=SN1, scale=3, ref=1600, q=78, maxw=1100) + fig('lgR_after_stoneN.jpg', 'AFTER x3 - the same (albedo markings at traced hits were never affected; the cone change is sub-cell here)', crop=SN1, scale=3, ref=1600, q=78, maxw=1100) +
  '</div></div>')
P.append('<div class="strip"><div class="row">' +
  fig('lgR_beforeU_stoneN.jpg', 'before, ultra x3', crop=SN2, scale=3, ref=1600, q=78, maxw=1100) + fig('lgR_afterU_stoneN.jpg', "AFTER, ultra x3 - the middle carton's glyphs and tape in the stone", crop=SN2, scale=3, ref=1600, q=78, maxw=1100) +
  '</div></div>')
P.append('''<p class="dim">By day the same cartons mirror nothing visible in sunlit stone (captured, not shown: a dark face over a bright floor at F &asymp; 0.04 is below the eye) &mdash; physically right, and a reminder that &ldquo;shows in reflections&rdquo; needs the reflected thing lit.</p>
<h3>Cost and noise</h3>
<div class="wrap"><table>
<tr><th>vending-reflection view, serialized medians</th><th>reflect pass (ms)</th><th>union (ms)</th><th>lino tile temporal sd, 8-bit luma: mean / p99</th></tr>
<tr><td>main &mdash; the old uniform slabs (relief level), HIGH</td><td class="n">0.590</td><td class="n">7.08</td><td class="n">0.111 / 0.481</td></tr>
<tr><td>before &mdash; the branch as reviewed (can windows, 2&alpha; cone, uniform analytic), HIGH</td><td class="n">0.655</td><td class="n">6.75</td><td class="n">0.314 / 0.709</td></tr>
<tr><td><b>after</b> &mdash; restyle + fixes, HIGH</td><td class="n"><b>0.655</b></td><td class="n">6.88</td><td class="n"><b>0.136 / 0.536</b></td></tr>
<tr><td>after, analytic pattern off (A/B, same session)</td><td class="n">0.590</td><td class="n">6.88</td><td class="n">0.190 / 0.663</td></tr>
<tr><td>after, markings at reflection hits off</td><td class="n">0.590</td><td class="n">6.82</td><td class="n">0.194 / 0.453</td></tr>
<tr><td>main, ULTRA</td><td class="n">2.163</td><td class="n">18.81</td><td class="n">0.104 / 0.474</td></tr>
<tr><td>before, ULTRA</td><td class="n">2.490</td><td class="n">18.81</td><td class="n">0.256 / 0.641</td></tr>
<tr><td><b>after, ULTRA</b></td><td class="n"><b>2.621</b></td><td class="n">18.61</td><td class="n"><b>0.075 / 0.416</b></td></tr>
<tr><td>manager&rsquo;s screen view, high / ultra (before &rarr; after)</td><td class="n">0.066 &rarr; 0.066 / 0.262 &rarr; 0.197</td><td class="n">6.36 &rarr; 6.23 / 16.7 &rarr; 16.0</td><td></td></tr>
<tr><td>stone-by-night view, high / ultra (before &rarr; after)</td><td class="n">0.459 &rarr; 0.459 / 1.507 &rarr; 1.507</td><td class="n">9.31 &rarr; 9.24 / 22.7 &rarr; 22.8</td><td></td></tr>
</table></div>
<p>So: the textured analytic highlight costs <b>one 65 &micro;s quantum</b> of the reflect pass on the view that is all vending machine (0.590 &rarr; 0.655 at high; +0.13 at ultra with 2 rays), nothing on the union; the cone change costs nothing. The lino
tile is <b>quieter</b> than the branch was (0.31 &rarr; 0.14 at high, 0.26 &rarr; 0.08 at ultra) and at parity with main&rsquo;s uniform slab (0.11 / 0.10) &mdash; a large single-hue field with a few big light shapes is an easier signal for one ray per pixel than
rows of small bright cans. Meter and direct light: in the flux rule&rsquo;s box above; against MAIN the front-of-machine reading is 3.42 &rarr; 3.22 W/m&sup2; (&minus;6 %: the light is now the whole front, centred 12 cm higher and whiter) &mdash; the lead waived the
1&#8229;2 % hold for the restyle; the direct-only lino tile 97.3 &rarr; 95.0; direct-only shows red light on the lino under machine 1 (below).</p>''')
P.append('<div class="strip"><div class="row">' + fig('lgR_after_vrefl_direct.jpg', 'direct light only (debug 3), after: the two rectangles lighting the lino and the wall - the RED and blue light of the registered emitters, no pattern in it (correct: illumination reads the rectangle)', crop=(440, 200, 760, 520), ref=1600, q=78, maxw=900) + fig('lgR_before_vrefl_direct.jpg', 'the same, before (b5bcf74)', crop=(440, 200, 760, 520), ref=1600, q=78, maxw=900) + '</div></div>')
P.append('<p class="dim">GPU validation: error scopes clean through every capture above at high, ultra and medium incl. debug views 3 / 14 / 15 and the three switches; low / verylow do not run the pass (the g-buffer / composite modules that carry markings.wgsl compiled at every boot). Gates re-run after the change: typecheck, frame-layout (Frame still 704 B), materials, glass (slot bits), level identity (0 diffs, not stale, canonical), tour 1/1.</p>')
H.append('\n'.join(P))

# ---- 11. honest
H.append('''<h2 id="honest">11. Honest read, object by object — what still doesn't read, and what reads as painted</h2>
<ul>
<li><b>Keyboard</b> — reads. Two rows of keys is fewer than a keyboard has (five); the base lattice cannot do more in 14 cm and the designer asked for base. If it ever bothers anyone, <code>fine</code> caps (five rows) read up close and become a
grey slab with a light middle at follow height — the same as verylow today. The mirrored keys in the dark monitor are a happy accident of §10 worth keeping.</li>
<li><b>Cartons</b> — read, on the strength of the brown tape. The fine print is close-camera detail (said above); the shipping label on the far face is rarely seen from the follow camera (it faces away on most cartons) — harmless. Nothing reads
as painted: tape and print are what cartons have. In an unlit corner (the cubicle stack by moonlight) nothing reads, correctly.</li>
<li><b>Vending machines</b> &mdash; RESTYLED on 08-10 to the designer&rsquo;s references (&sect;10b: a red ribbon machine and a blue roundel machine, single-chroma emissive fields, dark control columns, recessed dispensers); they read instantly at
follow height. Honest costs: the fields are as pale as the old slabs at the same flux (AgX at radiance &asymp; 2 &mdash; <code>VENDING_FLUX_K</code> is the one-constant taste call), the roundel&rsquo;s albedo-red wedge is dark in a dark room, and the
white blocks are blocks until the SDF-glyph follow-up gives them letters.</li>
<li><b>Filing cabinets</b> — read (three drawers, pulls). Coarse seams are 5 cm dark lines: at ×3 they look drawn-on rather than a shadowed gap — which is the rule working as intended (no baked shadow); a real 3 mm gap would be invisible at 21 m.</li>
<li><b>Papers / notice sheets / certificate</b> — read as documents. The scribble variant (sign-in book, whiteboard) is a pixel zigzag: fine up close, a faint smudge at follow height — kept for close cameras, as briefed.</li>
<li><b>Whiteboards</b> — read as used boards. The blue block is one line short of touching a sticky note; nobody will notice.</li>
<li><b>Door leaves</b> — the plates are correct and physically shaded, and therefore nearly invisible on a dark leaf in a dark corridor until a light finds their lower roughness. If "door" needed help (it doesn't: the frame and the leaf's swing say
door), a lighter leaf paint would do more than any marking.</li>
<li><b>Extinguisher / cylinder / cabinet</b> — the label bands work; the cabinet's hollow-square pictogram is a placeholder for a real extinguisher symbol (an SDF glyph, later).</li>
<li><b>Racks</b> — LEDs read as before (that was the bar to clear); the vent grille is deliberately faint and mostly shows in the reflection of a torch — if it reads as 'painted mesh' to the designer, its two greys are one constant apart
(<code>rackMarks</code>: 0.05 / 0.07) and can go.</li>
<li><b>Binders</b> — marginal at follow height (2 px labels); fine up close. The book runs on the manager's shelves (spine seams + a label band) read better because they are bigger.</li>
<li><b>Monitors</b> — left almost alone as asked: two UI bars a hair brighter than the screen glow on lit screens only; from the follow camera the screen is 4 px tall and the bars are not separable from it — they exist for the close camera and
the mirror. Dark screens get nothing (their switchable would not gate the glow).</li>
<li><b>What is missing entirely</b>: text and logos (never draw letters at this resolution — an SDF-glyph atlas keyed into the same table is the follow-up, not built), the storage floor's 45° hatching (off-lattice), anything on characters.</li>
</ul>''')

# ---- 12. defaults
H.append('''<h2 id="defaults">12. Recommended defaults (one-line constants; where they live)</h2>
<div class="wrap"><table><tr><th>knob</th><th>recommended</th><th>where</th><th>why</th></tr>
<tr><td>markings</td><td><b>ON</b></td><td><code>settings.markings</code> · Tab ▸ Renderer — markings · <code>?nomarkings</code></td><td>the ask; costs nothing</td></tr>
<tr><td>base texel</td><td><b>2.5 cm</b> (fine 1.25 / coarse 5)</td><td><code>MARKING_TEXEL</code>, per level <code>meta.markTexel</code>; <code>level-export --texel</code></td><td>§4: base cells 2.4 px at follow height on high; 2 cm puts the whole set into the fade on medium/low</td></tr>
<tr><td>contrast</td><td><b>1.0</b></td><td><code>settings.markingContrast</code></td><td>palettes are already muted; 0.7 makes the keyboard caps sink into the deck at low</td></tr>
<tr><td>emissive ×</td><td><b>1.0</b> (consider 0.7 for the vending windows' look — changes their light too)</td><td><code>settings.markingEmissive</code>; per machine <code>k</code> in officeGen</td><td>§11 vending (1)</td></tr>
<tr><td>markings in reflections</td><td><b>ON</b></td><td><code>settings.markingReflect</code></td><td>the keyboard in the screen, the windows in the lino; 0–1 quantum</td></tr>
<tr><td>light registration floor</td><td><b>I₀ ≥ 0.05 W/sr</b></td><td><code>MARK_LIGHT_MIN_I0</code> game.ts</td><td>keeps LEDs / UI bars / buttons out of the light list (first cut registered 21 lights)</td></tr>
<tr><td>minification</td><td>fade from <b>0.75</b> cells/px over 1.0; local box mean ≤ <b>4×4</b> cells, global mean past ~3</td><td><code>MK_MINIFY_LO / _W / MK_LOCAL</code> markings.wgsl</td><td>§2 racks: the global-only mean smeared LEDs into bars</td></tr>
<tr><td>keyboard</td><td>base, deck 0.035 / caps 0.15, rough 0.6 / 0.45, cap 1 gap 1 (14 × 4 after the snap: two cap rows, the space-bar run in the lower)</td><td><code>keyboardMarks</code>, <code>MK.keyDeck / keyCap</code></td><td>contrast, not hue, reads at 21 m</td></tr>
<tr><td>carton</td><td>tape <b>brown</b> 0.36/0.22/0.10 rough 0.35, 5 cm, over the top + 10 cm down the near face; print + label <b>fine</b>, ink 0.16/0.12/0.08</td><td><code>cartonMarks</code>, <code>MK.tape / ink / label</code>, <code>ART_UP_FRAGILE / ART_LABEL</code></td><td>light kraft tape read as nothing at follow height</td></tr>
<tr><td>vending A / B</td><td>full-front <b>coarse</b> backlit fields 18&times;29 / 16&times;29 (the control column&rsquo;s 4&times;16 cut out; black cap + frame), ONE chroma each: red &middot; its white &middot; black / blue &middot; its white &middot; albedo red; motif = ribbon + block stack / roundel + blocks; control column <b>base</b> 8&times;32 non-emissive; dispenser = a real 6 cm recess (plinth boxes) marked black; luminous intensity = the old slab&rsquo;s &times; VENDING_FLUX_K 1.0 &rarr; one light each (2.48 / 1.91)</td><td>&sect;10b; flux 0.5 for saturated fronts is the open taste call</td></tr>
<tr><td>cabinet / cupboards / kick plates</td><td><b>coarse</b> (fronts over 0.8 m); seams <code>mul 0.4–0.45</code>, pulls 0.2 grey rough 0.35, plates steel 0.5 rough 0.32</td><td><code>cabinetMarks / cupboardMarks / doorLeafMarks</code></td><td>32-cell cap; chunky = legible</td></tr>
<tr><td>papers / sheets / whiteboards</td><td>base bars 1 cell + 1 gap, ink grey 0.42 on paper, marker blue / red / green muted; scribble only where a close camera goes</td><td><code>paperMarks / sheetMarks / whiteboardMarks</code>, <code>GEN.lines / scribble</code></td><td></td></tr>
<tr><td>LEDs / displays / clock hands / keypad</td><td><b>fine</b>; LED radiance = the old nubs' (0.25, 6, 0.7) / amber (6, 2.2, 0.2)</td><td><code>rackMarks / ledMarks / displayMarks / clockMarks / keypadMarks</code></td><td>same look as the boxes they replace</td></tr>
<tr><td>per-box cap / bitmap cap / palette</td><td>4 markings · 32×32 cells · 3 entries</td><td><code>MAX_MARKS_PER_BOX / MAX_CELLS_* / MAX_PAL</code></td><td>the agreed representation; long fronts tile into several bitmaps</td></tr></table></div>''')

# ---- 13. drive it
H.append('''<h2 id="drive">13. Drive it</h2>
<ul class="small">
<li>URL: <code>?nomarkings</code> (off from boot: nothing evaluated, no marking lights) · <code>?level=relief</code> (main's office: the demotion pass off, no markings — the A/B 'before' and the identity reference) · <code>?levelFile=office-t20.json</code> /
<code>office-t40.json</code> (the world-resolution variants, fetched from the dev server's <code>/levels/</code>; nothing extra bundled but the relief file).</li>
<li>Tab ▸ <b>Renderer — markings</b>: on/off · lattice scale (a debug rescale; the level's cells were generated for 2.5 cm) · contrast · emissive × · markings in reflections · a stats line. Debug view 1 (albedo) shows the flat cells, 14 the RT term with the windows in it.</li>
<li>Console: <code>__mark.summary()</code> · <code>__mark.set({ on, contrast, emissive, reflect })</code> · <code>__mark.list(i)</code> / <code>__mark.art(i)</code> (a static box's markings, as records / as ASCII art; no argument = the box under the cursor) ·
<code>__mark.marked()</code> · <code>__mark.lights</code> (what was registered) · <code>__mark.stats</code>. Pane harness: <code>await import('/qa/legibility-harness.js')</code> → <code>__lg.go(view, 'follow'|'close')</code>, <code>.tiles</code>,
<code>.costAB</code>, <code>.frame1</code> (views: keyboard cartons cartonsCub vending vendingRefl cabinets papers whiteboard door extinguisher racks binders lobbySign breakEast).</li>
<li>Authoring: <code>src/scene/markingDefaults.ts</code> (the recipes + ASCII art) → <code>src/scene/officeGen.ts</code> call sites (<code>{ markings, demote, texel }</code> options) → <code>bun run tools/level-export.ts</code> (+ <code>--relief</code>,
<code>--texel 0.02</code>) → <code>probes.ts level</code>. Format: <code>src/scene/markings.ts</code> (types, validation, generators, stats, packing, the fold); GPU: <code>src/render/shaders/markings.wgsl</code>; the table + slot: <code>scene/boxes.ts</code>;
lights: <code>game.ts</code> (the block after the fixture area lights); supply: <code>lighting.ts</code> (<code>Box.markGain</code>).</li>
<li>Text / logos later: an SDF-glyph atlas addressed from the same per-box table (a fourth entry kind), evaluated in the same three places — not built here.</li>
</ul>
<p class="dim small">Page generated from docs/shots/lg*_*.jpg (this lane's shot sink on :5189) — {NIMG} images inlined, {KB} KB.</p>
</main>''')

html = '\n'.join(H)
sub = {
 'GATE': QA.get('gate', '…'), 'TOUR': QA.get('tour', '…'), 'SOAK': QA.get('soak', '…'), 'BUILD': QA.get('build', '…'),
 'STRESS_R': QA.get('stress_r', '…'), 'STRESS_D': QA.get('stress_d', '…'), 'STRESS_RD': QA.get('stress_rd', '…'), 'STRESS_DD': QA.get('stress_dd', '…'), 'STRESS_RG': QA.get('stress_rg', '…'), 'STRESS_DG': QA.get('stress_dg', '…'), 'STRESS_RR': QA.get('stress_rr', '…'), 'STRESS_DR': QA.get('stress_dr', '…'),
}
for k, v in sub.items(): html = html.replace('{' + k + '}', str(v))
nimg = html.count('data:image/jpeg')
html = html.replace('{NIMG}', str(nimg)).replace('{KB}', str(round(len(html.encode()) / 1024)))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(html)
print(f'wrote {OUT}: {len(html.encode())/1024/1024:.2f} MB, {nimg} images, image bytes {total_bytes/1024/1024:.2f} MB')
