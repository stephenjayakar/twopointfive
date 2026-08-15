#!/usr/bin/env python3
"""DESTRUCTION lane — build docs/review/destruction.html: self-contained (strips + ×3 crops as data-URI JPEG), light + dark + data-theme, < 8 MB.
Inputs: docs/shots/destr_*.jpg (tools/qa/destr-scenes.js captures), docs/perf/destr-*.json (the cost takes), the probe / soak / gate results pasted below.
  python3 tools/qa/destr-page.py"""
import os, json, base64, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = os.path.join(ROOT, 'docs/shots'); OUT = os.path.join(ROOT, 'docs/review/destruction.html')

def load(name):
    try: return json.load(open(os.path.join(ROOT, 'docs/perf', name)))
    except Exception: return None
COST_HIGH = load('destr-cost-high.json'); AB_HIGH = load('destr-ab-high.json'); AB_ULTRA = load('destr-ab-ultra.json'); MISC = load('destr-misc.json') or {}

def enc(im, q=82):
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
def frame(name, w=560, q=80):
    p = os.path.join(SH, f'destr_{name}.jpg')
    if not os.path.exists(p): return f'<div class="missing">{name}: no capture</div>'
    im = Image.open(p).convert('RGB'); im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
    return f'<img alt="{name}" src="{enc(im, q)}" width="{im.size[0]}" height="{im.size[1]}" loading="lazy">'
def crop(name, box, scale=3, w=None, q=84):
    """box = (x, y, w, h) in the capture's own pixels; nearest-neighbour ×scale (the renderer's pixels, not a resample's)"""
    p = os.path.join(SH, f'destr_{name}.jpg')
    if not os.path.exists(p): return f'<div class="missing">{name}: no capture</div>'
    im = Image.open(p).convert('RGB'); x, y, cw, chh = box; t = im.crop((x, y, x + cw, y + chh)).resize((cw * scale, chh * scale), Image.NEAREST)
    if w and t.size[0] > w: t = t.resize((w, round(t.size[1] * w / t.size[0])), Image.LANCZOS)
    return f'<img alt="{name} crop" src="{enc(t, q)}" width="{t.size[0]}" height="{t.size[1]}" loading="lazy">'

def strip(title, sub, frames):
    cells = ''.join(f'<figure>{frame(n)}<figcaption><b>{lab}</b>{(" — " + note) if note else ""}</figcaption></figure>' for n, lab, note in frames)
    return f'<section class="strip"><header><h3>{title}</h3><p>{sub}</p></header><div class="reel">{cells}</div></section>'

def fmt(v, d=2): return '—' if v is None else f'{v:.{d}f}'
def stat(t, k, f='mean'):
    if not t: return None
    if k == 'union': return t.get('union', {}).get(f)
    p = t.get(k) if k in t else (t.get('passes') or {}).get(k)
    return p.get(f) if isinstance(p, dict) else p

def cost_table_stress():
    if not COST_HIGH: return '<p class="missing">docs/perf/destr-cost-high.json missing</p>'
    rows = []
    for label, key in [('fight: true (the torture take)', 'fightTrue'), ('fight: false (the gate as written)', 'fightFalse')]:
        T = COST_HIGH.get(key) or {}
        base = T.get('0')
        for c in ['0', '0.5', '1']:
            t = T.get(c)
            if not t: continue
            du = (stat(t, 'union') or 0) - (stat(base, 'union') or 0)
            rows.append(f"<tr><td>{label if c == '0' else ''}</td><td>{c}</td><td>{fmt(stat(t,'union'))} · <span class='muted'>{fmt(stat(t,'union','p95'))}</span></td><td>{'' if c == '0' else f'{du:+.2f}'}</td>"
                        f"<td>{fmt(stat(t,'direct'))}</td><td>{fmt(stat(t,'volFroxel'))}</td><td>{fmt(stat(t,'particles'))}</td><td>{fmt(stat(t,'smoke'))}</td><td>{fmt(stat(t,'gbuffer'))}</td><td>{t.get('peakMoving', '—')}</td></tr>")
    return ("<div class='scroll'><table><caption>The stress minute (tools/qa/stress-scene.js: QRF deployed with weapon lights, rain, two canisters, the orbit) + a 3 s FN2000 full-auto burst into the tan cluster per take · high 1368×770 · 240 serialized frames each · ms, GPU-pass UNION mean · <span class='muted'>p95</span></caption>"
            "<thead><tr><th></th><th>chaos</th><th>union</th><th>Δ vs 0</th><th>direct</th><th>froxel</th><th>particles</th><th>smoke</th><th>g-buffer</th><th>movers</th></tr></thead><tbody>" + ''.join(rows) + "</tbody></table></div>")

def ab_table(AB, title):
    if not AB: return f'<p class="missing">{title}: no take</p>'
    takes = AB.get('takes') or {}
    rows = []
    def agg(c, k, f='p50'):
        vals = [stat(t, k, f) for t in takes.get(c, [])]; vals = [v for v in vals if v is not None]
        return sum(vals) / len(vals) if vals else None
    b_u = agg('0', 'union'); b_um = agg('0', 'union', 'mean')
    for c in ['0', '0.5', '1']:
        if c not in takes: continue
        u, um = agg(c, 'union'), agg(c, 'union', 'mean')
        rows.append(f"<tr><td>{c}</td><td>{fmt(u)} · <span class='muted'>{fmt(um)}</span></td><td>{'' if c == '0' else f'{(u or 0) - (b_u or 0):+.2f} · <span class=muted>{(um or 0) - (b_um or 0):+.2f}</span>'}</td>"
                    f"<td>{fmt(agg(c,'direct'))}</td><td>{fmt(agg(c,'volFroxel'))}</td><td>{fmt(agg(c,'gather'))}</td><td>{fmt(agg(c,'particles'))}</td><td>{fmt(agg(c,'smoke'))}</td><td>{fmt(agg(c,'gbuffer'))}</td>"
                    f"<td>{max((t.get('smokeLive') or 0) for t in takes[c])}</td><td>{max((t.get('debris') or 0) for t in takes[c])}</td><td>{max((t.get('pslots') or 0) for t in takes[c])}</td></tr>")
    res = AB.get('res'); n = len(takes.get('0', []))
    return (f"<div class='scroll'><table><caption>{title} · {res[0]}×{res[1]} · the north desk raked from the north under the cubicle panels, 30 rounds in 3 s per take, {n} takes per level interleaved 0 → 0.5 → 1, everything reset between · ms, MEDIAN over frames then mean over takes · <span class='muted'>mean</span></caption>"
            "<thead><tr><th>chaos</th><th>union p50 · <span class='muted'>mean</span></th><th>Δ vs 0</th><th>direct</th><th>froxel</th><th>gather</th><th>particles</th><th>smoke</th><th>g-buffer</th><th>smoke domains</th><th>debris</th><th>particle slots</th></tr></thead><tbody>" + ''.join(rows) + "</tbody></table></div>")

CSS = """
:root{--ground:#eceef0;--panel:#f7f8f9;--ink:#1c232b;--muted:#5d6773;--rule:#cfd5db;--accent:#a35f14;--accent-soft:#e9dcc9;--good:#2f7d4f;--warn:#a35f14;--bad:#a8322a;--code:#e3e7eb;--shadow:0 1px 0 rgba(0,0,0,.04)}
@media (prefers-color-scheme: dark){:root{--ground:#0f1216;--panel:#161b21;--ink:#d7dce2;--muted:#8b95a1;--rule:#2a323b;--accent:#d99a3e;--accent-soft:#3a2c17;--good:#6fbf8e;--warn:#d99a3e;--bad:#e07a70;--code:#1d242c;--shadow:none}}
:root[data-theme="dark"]{--ground:#0f1216;--panel:#161b21;--ink:#d7dce2;--muted:#8b95a1;--rule:#2a323b;--accent:#d99a3e;--accent-soft:#3a2c17;--good:#6fbf8e;--warn:#d99a3e;--bad:#e07a70;--code:#1d242c;--shadow:none}
:root[data-theme="light"]{--ground:#eceef0;--panel:#f7f8f9;--ink:#1c232b;--muted:#5d6773;--rule:#cfd5db;--accent:#a35f14;--accent-soft:#e9dcc9;--good:#2f7d4f;--warn:#a35f14;--bad:#a8322a;--code:#e3e7eb;--shadow:0 1px 0 rgba(0,0,0,.04)}
*{box-sizing:border-box}html{background:var(--ground)}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1140px;margin:0 auto;padding:40px 28px 96px;display:flex;flex-direction:column;gap:56px}
h1{font-size:30px;line-height:1.15;letter-spacing:-.01em;margin:0 0 10px;font-weight:700;text-wrap:balance}
h2{font-size:20px;line-height:1.25;margin:0;font-weight:700;letter-spacing:-.005em;text-wrap:balance}
h3{font-size:15px;margin:0;font-weight:700}
p{margin:0}a{color:var(--accent)}
.eyebrow{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;display:block}
.lede{font-size:16px;color:var(--ink);max-width:74ch}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:16px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted)}
.meta b{color:var(--ink);font-weight:600}
section.block{display:grid;grid-template-columns:150px 1fr;gap:18px 28px;align-items:start}
section.block>.label{font:600 11px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding-top:5px;border-top:2px solid var(--accent);}
section.block>.body{display:flex;flex-direction:column;gap:16px;min-width:0}
.body>p,.body li{max-width:78ch}
ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
code,kbd{font:12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:3px}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--panel);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
caption{caption-side:top;text-align:left;padding:10px 12px;color:var(--muted);font-size:12.5px;border-bottom:1px solid var(--rule)}
th,td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--rule);white-space:nowrap}
th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}
thead th{font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--ground)}
tbody tr:last-child td{border-bottom:0}
td.l,th.l{text-align:left;white-space:normal}
.muted{color:var(--muted)}
.strip{display:flex;flex-direction:column;gap:10px}
.strip header{display:flex;flex-direction:column;gap:4px}.strip header p{color:var(--muted);font-size:13.5px;max-width:90ch}
.reel{display:flex;gap:12px;overflow-x:auto;padding:12px;background:var(--panel);border:1px solid var(--rule);scroll-snap-type:x proximity}
.reel figure{margin:0;flex:0 0 auto;display:flex;flex-direction:column;gap:6px;scroll-snap-align:start}
.reel img{display:block;height:auto;max-width:none;border:1px solid var(--rule)}
figcaption{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);max-width:560px}figcaption b{color:var(--ink);font-weight:600}
.crops{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.crops figure{margin:0;display:flex;flex-direction:column;gap:6px;background:var(--panel);border:1px solid var(--rule);padding:10px}
.crops img{width:100%;height:auto;image-rendering:pixelated;border:1px solid var(--rule)}
.levels td:first-child{font-weight:700}
.pill{display:inline-block;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:4px 7px;border-radius:3px;letter-spacing:.04em}
.pill.good{background:color-mix(in srgb,var(--good) 18%,transparent);color:var(--good)}.pill.warn{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}.pill.bad{background:color-mix(in srgb,var(--bad) 18%,transparent);color:var(--bad)}
.callout{border-left:3px solid var(--accent);background:var(--accent-soft);padding:12px 14px;max-width:82ch}
.missing{color:var(--bad);font:12px ui-monospace,monospace;padding:8px}
@media (max-width:760px){section.block{grid-template-columns:1fr}main{padding:24px 16px 64px}}
"""

def build():
    sight = MISC.get('sight'); val = MISC.get('validation', []); soak = MISC.get('soak'); gates = MISC.get('gates')
    strips = [
        strip('A desk raked on full auto', 'The tan cluster\'s north-east desk from the north, chaos 1, 24 rounds in 2.4 s (docs/shots/destr_paper_*): the lit monitor dies on the first round and its housing goes over, both paper stacks are in the air by the third, gypsum dust off the spine partition by the ninth; three seconds after the trigger goes quiet the leaves lie on the desk and the floor, the neck stub stands, the shreds show on the partition.',
              [('paper_0pre', 'before', 'the desk as authored'), ('paper_r3', '+0.4 s', 'screen dead, paper up'), ('paper_r9', '+1.0 s', 'housing over, sparks, dust'), ('paper_p3', '+3 s after the burst', 'settled')]),
        strip('Dust in a torch beam', 'Thirty rounds into the corridor plaster beside a fixed torch (destr_dust_*): the dust the rounds knock out of the wall is smoke-solver density, so the froxels light the beam\'s shaft through it and it thins over the following seconds; the chips carpet the lino, a tile from the beaten ceiling lies by the wall.',
              [('dust_0pre', 'before', ''), ('dust_r14', '+1.5 s', 'the plume builds'), ('dust_r22', '+2.3 s', 'the beam cuts it'), ('dust_p3', '+3 s after', 'thinning · holes · chips · the tile')]),
        strip('A ceiling tile lets go', 'A stun charge\'s worth of destruction on the aisle by the carton (`__destr.bang`, no flash), captured every 0.1 s: the tile see-saws out of the plenum casting its shadow, crumbs beside it, and lands flat with a knock the floor hears (`prop` 0.4).',
              [('tile_f14', '+0.27 s', ''), ('tile_f26', '+0.47 s', ''), ('tile_f38', '+0.67 s', ''), ('tile_landed', '+1.7 s', 'down')]),
        strip('A monitor dies', 'The lit screen on the red cluster\'s desk (destr_monitor_*): one round — the emissive goes through its light target the same frame (the cell it lit goes dark), a crack decal, a fizz of sparks; then a burst knocks the housing off the neck and a tile down onto the desk.',
              [('monitor_0lit', 'lit', ''), ('monitor_1hit', 'the frame after the round', ''), ('monitor_2dead', '+0.5 s', 'dead'), ('monitor_3burst', 'after a burst', 'housing off, a tile on the desk')]),
    ]
    crops = ''.join([
        f'<figure>{crop("paper_r3", (620, 380, 300, 190))}<figcaption><b>Leaves mid-air (×3, high)</b> — oriented quads lit per leaf from both faces; the rim is antialiased over one pixel of the quad\'s own frame; no shadow under them (a splat, not a box).</figcaption></figure>',
        f'<figure>{crop("paper_r9", (700, 250, 300, 190))}<figcaption><b>The dead screen (×3)</b> — the housing on its face, sparks off the panel, chips on the desk; the crack decal is on the dark glass and reads only in a glancing light.</figcaption></figure>',
        f'<figure>{crop("dust_r22", (1090, 120, 380, 230))}<figcaption><b>The beam through the dust (×3)</b> — froxel-lit haze: no boil at the shaft\'s edge under the corridor panels; the puff is optically thin on purpose (density 11 self-shadowed into a black plume in the first captures, 3.5 is this).</figcaption></figure>',
        f'<figure>{crop("tile_f38", (960, 380, 290, 240))}<figcaption><b>The tile falling (×3)</b> — one dynamic shadow-casting box, motion-keyed (MKEY.debris) so its vectors are its own; the crumbs are chips.</figcaption></figure>',
        f'<figure>{crop("paper_p3", (600, 300, 320, 200))}<figcaption><b>Settled (×3)</b> — leaves at rest write a low reactive weight so the pile keeps its TAA history; each leaf its own tone with a 12 % rim so a leaf on a leaf keeps an edge; splinters (chips × aspect 3) between them.</figcaption></figure>',
        f'<figure>{crop("ultra_paper_r9", (950, 330, 360, 240))}<figcaption><b>The same moment at ultra (×3, 2133×1200)</b> — mesh shadows on, the housing\'s hard shadow on the desk, the sparks\' bloom.</figcaption></figure>',
    ])
    levels = """<div class='scroll'><table class='levels'><caption>What each chaos level does — the FN2000 on AUTO puts 10 rounds/s into one 2 m cell; heat saturates at rate × 2 s; a hit's escalation E = heat × 2 × chaos gates each tier ON TOP of the hole, chips and puff every round always made</caption>
<thead><tr><th>chaos</th><th class=l>1st round</th><th class=l>2nd (+0.1 s)</th><th class=l>5th (+0.4 s)</th><th class=l>12th (+1.2 s)</th><th class=l>one stun charge</th><th>knock-off speed</th></tr></thead><tbody>
<tr><td>0</td><td class=l colspan=5>the game byte for byte as it was — both hooks return on their first line (probe-held)</td><td>—</td></tr>
<tr><td>0.25</td><td class=l>—</td><td class=l>dent / shred / crack decal, paper up, a hit screen dies (E 1)</td><td class=l>bigger bursts + dust into the smoke (E 2.5)</td><td class=l>knock-offs at ~1 s (E 4); never a tile (E tops out at 5)</td><td class=l>desk cleared, papers up, no tile</td><td>1.0 m/s</td></tr>
<tr><td>0.5 · default</td><td class=l>decal, paper up, screen dead</td><td class=l>+ splinters / gypsum / fluff, dust into the smoke</td><td class=l>+ mugs, phones, binders off the desk (a housing on a direct hit), a chair spun</td><td class=l><b>a ceiling tile</b> (≥ 2.2 s apart, ≤ 8 an encounter)</td><td class=l>all of it + the tile above</td><td>1.0 m/s</td></tr>
<tr><td>0.75</td><td class=l>+ bursts and dust from the first</td><td class=l>knock-offs by the 3rd</td><td class=l>a tile at 0.55 s</td><td class=l>tiles walk about the beaten zone</td><td class=l>as 0.5, a wider paper ring</td><td>1.75 m/s</td></tr>
<tr><td>1 · kinetic seed</td><td class=l>everything but knock-offs</td><td class=l>knock-offs</td><td class=l>a tile by the 3rd–4th round</td><td class=l></td><td class=l></td><td>2.5 m/s</td></tr>
</tbody></table></div>"""
    bounds = """<div class='scroll'><table><caption>Bounded by construction — every path on this lane is a fixed pool or a hard cap; what gives first when the caps bite</caption>
<thead><tr><th class=l>thing</th><th class=l>bound</th><th class=l>at the bound</th><th class=l>held by</th></tr></thead><tbody>
<tr><td class=l>rigid debris (tiles, housings, clutter)</td><td class=l>settings.debrisCap: 64 ultra / high · 32 medium / low / verylow (the image-quality budget)</td><td class=l>evict the oldest chunk AT REST; none at rest → refuse and demote the break-off to a 24-chip burst (the static still leaves the desk)</td><td class=l>destruction-caps, -bounds, soak debris-unbounded</td></tr>
<tr><td class=l>dust puffs into the smoke solver</td><td class=l>≤ 2 a frame · ≤ 8 in any second (exact sliding window) · only while smoke.budget() ≥ 4 · past 6 live domains only inside an existing plume · the solver's own 8 domains + fullRateDomains</td><td class=l>refused, counted; the particle dust still shows</td><td class=l>destruction-caps, -dust, -bounds</td></tr>
<tr><td class=l>paper conversions</td><td class=l>≤ 6 stacks in any second · 19 stacks in the office · ~26–54 sheet particles each into the LONG ring (10 240 slots, life 60 s)</td><td class=l>refused; the stack stays for the next round</td><td class=l>destruction-caps</td></tr>
<tr><td class=l>knock-offs</td><td class=l>≤ 4 in any second (a group rides its leader's slot) · the debris pool above</td><td class=l>refused</td><td class=l>destruction-caps</td></tr>
<tr><td class=l>ceiling tiles</td><td class=l>≥ 2.2 s apart · one per 0.6 m square · ≤ 8 an encounter · indoors · nothing in the square's slot under the slab</td><td class=l>refused, counted</td><td class=l>destruction-caps</td></tr>
<tr><td class=l>damage decals</td><td class=l>≤ 12 in any second · the 512-mark ring (the bullet hole itself is always there)</td><td class=l>the ring drops its oldest</td><td class=l>soak decals-unbounded</td></tr>
<tr><td class=l>material bursts / crumbs / sparks</td><td class=l>the tier's particleBirths a frame + the 512-record carrying queue</td><td class=l>births wait a frame or two; stale sparks shed</td><td class=l>particles-queue</td></tr>
<tr><td class=l>heat, index, log</td><td class=l>a 20 × 14 Float32Array · built once (94 statics) · ≤ 200 lines</td><td class=l>—</td><td class=l>destruction-bounds, soak destr-log / destr-hidden / destr-heat</td></tr>
</tbody></table></div>"""
    sheet = """<div class='scroll'><table><caption>The sheet model's numbers (game/sheetModel.ts SHEET = particles.ts KIND_DEFAULTS.sheet slot for slot; particles_common.wgsl repeats ANG_DAMP / SPIN_MAX — destruction-sheet compares them)</caption>
<thead><tr><th class=l>constant</th><th>value</th><th class=l>what it is</th></tr></thead><tbody>
<tr><td class=l>gravity</td><td>9.8</td><td class=l>m/s²</td></tr>
<tr><td class=l>KT</td><td>0.5</td><td class=l>drag on the slip ALONG the leaf, 1/s (nothing: it glides)</td></tr>
<tr><td class=l>KN_LIN · KN_Q</td><td>1.5 · 9</td><td class=l>drag on the slip THROUGH the leaf: e^−(KN_LIN + KN_Q·|v|)·dt — the flat plate's |v|²·sin α, so a gliding leaf gets lift; face-down terminal ≈ √(g / 9) ≈ 1.04 m/s (measured 1.03)</td></tr>
<tr><td class=l>FLUT</td><td>25</td><td class=l>flutter torque α = FLUT·(−vₙ)·(vₜ × n): the normal force at the quarter chord pitches the leading edge up — 2.4 slip reversals per kicked leaf, a hard kick tumbles instead</td></tr>
<tr><td class=l>ANG_DAMP · SPIN_MAX</td><td>1.8 · 3</td><td class=l>1/s on ω (kept ⊥ n) · in-plane spin rad/s × speed, per leaf off its seed</td></tr>
<tr><td class=l>sleepV · fade · life</td><td>0.28 · 4 · 60</td><td class=l>lies flat and sleeps under 0.28 m/s on an up face (200 kicked leaves: all asleep by 1.9 s) · fade-out seconds · seconds a leaf lies there</td></tr>
<tr><td class=l>TRANS</td><td>0.3</td><td class=l>share of the BACK face's irradiance that shows through (a leaf between the eye and a torch glows)</td></tr>
<tr><td class=l>size · aspect · tumble · nrmJit</td><td>the stack's short side · long ÷ short ≤ 1.5 · 5 + 4·chaos rad/s · 0.55</td><td class=l>per conversion (destruction.ts convertPaper)</td></tr>
</tbody></table></div>"""
    val_rows = ''.join(f"<tr><td class=l>{v['tier']}</td><td>{v['res'][0]}×{v['res'][1]}</td><td>{v['nErr']}</td><td class=l>{v.get('note','')}</td></tr>" for v in val)
    validation = f"<div class='scroll'><table><caption>GPU validation — a fresh `?quality=` boot per tier, the same 24-round burst + a stun charge at chaos 1, console errors / uncaptured device errors collected (WGSL compile errors would also leave the frame black: every capture came back whole)</caption><thead><tr><th class=l>tier</th><th>internal res</th><th>errors</th><th class=l>note</th></tr></thead><tbody>{val_rows}</tbody></table></div>" if val else ''
    sight_html = ''
    if sight:
        during = ' · '.join(f'{x:.2f}' for x in sight['during']); after = ' · '.join(f'{x:.2f}' for x in sight['after'])
        sight_html = f"""<p><b>Dust vs a guard's eyes</b> (`__ds.sight()`, high, the real GPU probe): Kowalski held at the corridor's east end looking west at Sam 7 m off; thirty rounds into the north wall between them. His sight-line transmittance to Sam's chest — the number `sightGain` multiplies by clamp((T − 0.3) / 0.5) and that blinds him under 0.3 — reads <b>{sight['before']:.2f}</b> before, then <b>{during}</b> sampled through the burst, then <b>{after}</b> over the six seconds after: the dust the rounds raised takes his detection rate through that stretch of corridor down to between a seventh and two fifths of clear air for several seconds, and nothing on the AI side was written to do it — the puffs are density in the field his probe already marched. {sight['puffs']} puffs went into {sight['smoke']} solver domains.</p>"""
    gates_html = ''
    if gates: gates_html = '<ul>' + ''.join(f'<li>{g}</li>' for g in gates) + '</ul>'
    html = f"""<title>Destruction under sustained fire — stage 3b review</title>
<style>{CSS}</style>
<main>
<header>
<span class="eyebrow">twopointsix · stage 3b · lane feat/destruction</span>
<h1>Destruction under sustained fire, behind one knob</h1>
<p class="lede">Hold the FN2000's trigger across a desk and the office now comes apart in the order a real one would: the monitor dies and goes over, the paper is in the air, gypsum dust fills the panel light and the torch beams — dust the guards' eyes really lose you in — the mugs and binders leave the desk, and if you keep it up a ceiling tile lets go overhead and lands with a knock the floor hears. All of it sits behind <code>tune.chaos</code> (Tab ▸ Sandbox ▸ chaos, default 0.5): at 0 the game is byte for byte the game it was, and above 0 every path is a fixed pool or a hard cap.</p>
<div class="meta"><span><b>try</b> 2 → Z (AUTO) → hold across a cubicle desk · a stun charge under the ceiling · Tab ▸ Sandbox ▸ chaos 0 / 0.5 / 1</span><span><b>docs</b> docs/internal/destruction.md</span><span><b>probes</b> bun run tools/qa/probes.ts destruction</span><span><b>rigs</b> tools/qa/destr-scenes.js (__ds)</span></div>
</header>

<section class="block"><div class="label">The knob</div><div class="body">
{levels}
<p class="muted">Rounds — anybody's — and stun charges pour heat into a 2 m grid with a 2 s memory. A deliberate two-rounds-a-second semi cadence saturates at heat 4: it dents and scatters and raises dust but never knocks anything off at 0.5 and never drops a tile at any level under 1. The tour pins the knob to 0 (the showcase is choreographed round the office as authored).</p>
</div></section>

<section class="block"><div class="label">The look</div><div class="body">
{''.join(strips)}
<div class="crops">{crops}</div>
<p class="callout">Sheets are particles, so they cast no shadows and are not geometry once down: forty shadow-casting quads per stack is exactly the fast small occluder in hard light the image-quality program said to keep out, and a reverse conversion (a settled leaf back to a thin static) needs an asynchronous readback that would break the module's determinism. They lie there for their 60 s life; the LONG ring recycles the oldest only under load.</p>
</div></section>

<section class="block"><div class="label">Cost</div><div class="body">
<p>M4 Max, Chrome/Metal, serialized frames (each followed by onSubmittedWorkDone + a yield). <b>The GPU was shared with other sessions on the machine for every take of this lane</b> — the baseline itself reads 4–5 ms over the image-quality program's numbers for the same preset and p95 carries contention spikes that show at chaos 0 too — so the conclusions rest on interleaved MEDIANS and on deltas, and the absolute bars (high ≤ 14 · ultra ≤ 30 in the loud minute) cannot be re-derived here. What the deltas say: while a burst lasts and for the few seconds its dust hangs, chaos 0.5–1 costs <b>+2 ms union at high and +2.5–4 at ultra</b> over the same burst at chaos 0 — inside ultra's headroom, and at high enough to cross the loud minute's bar by a millisecond or two for those seconds if the auto ladder does not trim first.</p>
{ab_table(AB_HIGH, 'The burst alone · high')}
{ab_table(AB_ULTRA, 'The burst alone · ultra')}
{cost_table_stress()}
<p>Where it goes: <b>the dust in the smoke solver is the price</b> — not the solver itself (fullRateDomains held it flat in every take) but the direct pass's shadow rays and the gather's rays sampling transmittance through the extra domains, plus the froxel injection over them (+0.2). Particles read the same 0.13 ms timer quantum at every level (sheets, splinters and crumbs are inside the tier's birth cap), the g-buffer does not notice ≤ 5 debris boxes, and the rigid mover peak never passed 5 in any take against a budget of 64. The lever, if a tier ever needs one, is `puffsPerSec` / `puffDomains` (Tab ▸ Sandbox), not the debris or the paper.</p>
{validation}
</div></section>

<section class="block"><div class="label">Bounds</div><div class="body">
{bounds}
<p><b>destruction-bounds</b>: 90 s of continuous full auto + six stun charges at chaos 1 on a 32-chunk pool → debris ≤ 16/32, decals at their 512 ring, the particle queue never waiting, hidden statics ≤ 10 of the 94 indexed, puffs ≤ 8 in any second, 8 tiles then refusals, no NaN in any chunk. The soak (seeds 1, 2 × 6 min, <code>--loud-at 1 --chaos 1</code>) ran clean with the debris / hidden / log / NaN / heat / chaos-0 / under-tour invariants on every frame{(' — ' + soak) if soak else ''}.</p>
</div></section>

<section class="block"><div class="label">One model</div><div class="body">
{sight_html}
<p><b>What the floor hears</b> (destruction-hearing): a tile landing files <code>prop</code> 0.4, a monitor housing 0.5, a mug or a binder 0.25 — <code>who 0</code>, the dropped torch's rule, so a calm man goes to look (Novak two metres from a tile: patrol → suspicious, awareness 0.15); a paper stack scattered beside him and three dust puffs leave him at patrol / 0.00. No AI was written for any of it: landings go through the GameEvent kinds that existed, the dust through the smoke field the sight probe already marched.</p>
</div></section>

<section class="block"><div class="label">Identity · gates</div><div class="body">
<ul>
<li><b>chaos 0 = the game as it was</b>: destruction-identity runs the decals family's seeded 15 s corridor fight (35 rounds incl. a sustained string and a stun charge) with the hooks live at chaos 0 against the hooks cut out of combat.ts's two sites — rounds, hearing events, audio calls, the particle emit stream, the furniture's poses, the decal list and all 776 statics' flags identical, the module's counters all zero. The harness stands the game up at chaos 0, so every older probe measures the game as it was.</li>
<li><b>determinism</b>: the same seeded burst + bang at chaos 1 twice → identical destruction log, debris rest poses, 326 particle records, 288 smoke emits, 100 marks, 65 events. Nothing on the lane draws from Math.random; renderer switches (decals off, no Particles attached) never change what the hashed counter consumes.</li>
<li><b>reset</b>: 12 s of fire + a bang hid 5 statics and left 10 chunks and 6 tiles; restartEncounter → every static's flags as authored, pools empty, heat 0, the screens the module put out lit again.</li>
</ul>
{gates_html}
</div></section>

<section class="block"><div class="label">The sheet</div><div class="body">
{sheet}
</div></section>

<section class="block"><div class="label">Residuals</div><div class="body">
<ul>
<li>Sheets cast no shadow and stay particles once down; a leaf resting over a desk edge lies flat in the air past the edge (its centre is supported); leaves piled at one height merge in tone but for the rim.</li>
<li>Dust puffs are density only — the field has no per-emitter albedo — so gypsum, concrete and wood dust are the plume's grey-white, told apart only by the particle burst's tint in the first half second.</li>
<li>The ceiling slab is NoPrimary (the camera looks through it): a dropped tile leaves no visible hole and tiles are generic 60 × 60 slabs; a square under a light panel or a beacon is refused rather than shattered.</li>
<li>Knock-offs are indexed by shape, never by name (the level file carries none): 28 clutter + 8 binders qualify — mugs, phones, the jug and glasses, the desk fan, plant pots, the photo frame, the wall clock; keyboards (40 cm) and shelf cartons do not; chairs spin but never topple (3-DOF props).</li>
<li>Game state depends on the graphics tier once the debris pool saturates (64 vs 32: chunk vs chip burst decides whether a landing is heard) — accepted and documented; the pool never saturated in any take.</li>
<li>Guards do not read wreckage as evidence — only what they hear land and what the dust hides.</li>
<li>The stress-minute bars need a quiet GPU to re-derive; the deltas are what this page can vouch for.</li>
</ul>
<h3>What a kinetic mode would raise, on the same budgets</h3>
<ul>
<li>a per-domain thin-medium hint so shadow / gather rays skip puff-only domains under a density floor (the one real cost);</li>
<li>the debris pool used toward its measured 64-mover budget with authored break-offs (Voronoi-cut partitions, drywall panels) instead of whole statics, and monitors / chairs as 6-DOF bodies;</li>
<li>sheets and chips as occluders in ultra's mesh-shadow BVH; the reverse paper conversion on a deterministic readback schedule;</li>
<li>guards treating a wrecked room like an open door — suspicion on sight.</li>
</ul>
</div></section>
</main>
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html)/1024:.0f} KB')

if __name__ == '__main__': build()
