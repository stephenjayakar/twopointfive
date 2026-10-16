#!/usr/bin/env python3
"""DIRECT-QUALITY lane — build docs/review/direct-quality.html: self-contained (crops as data-URI JPEG), light + dark + data-theme, < 8 MB.
Inputs: docs/perf/dq-high.json + docs/perf/dq-tier-<tier>.json (tools/qa/dq-scenes.js → __dq.saveJson), docs/shots/dq_*.jpg (the harness's crops).
  python3 tools/qa/dq-page.py"""
import os, sys, json, base64, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = os.path.join(ROOT, 'docs/shots/dq'); OUT = os.path.join(ROOT, 'docs/review/direct-quality.html')
def load(name):
    try: return json.load(open(os.path.join(ROOT, 'docs/perf', name)))
    except Exception: return None
H = load('dq-high.json') or {}
TIERS = {t: load(f'dq-tier-{t}.json') for t in ['ultra', 'high', 'medium', 'low', 'verylow']}
ID = load('dq-identity.json') or {}
COSTQ = load('dq-cost-quiet.json') or {}

def img(name, w=None, h=None, q=82, crop=None, scale=None, nearest=False):
    p = os.path.join(SH, name if name.endswith('.jpg') else name + '.jpg')
    if not os.path.exists(p): return f'<div class="missing">{name}: no crop</div>'
    im = Image.open(p).convert('RGB')
    if crop: im = im.crop(crop)
    if scale: im = im.resize((round(im.size[0] * scale), round(im.size[1] * scale)), Image.NEAREST if nearest else Image.LANCZOS)
    if w and im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); s = base64.b64encode(b.getvalue()).decode()
    return f'<img alt="{name}" src="data:image/jpeg;base64,{s}" width="{im.size[0]}" height="{im.size[1]}" loading="lazy">'

def fig(name, cap, **kw): return f'<figure>{img(name, **kw)}<figcaption>{cap}</figcaption></figure>'
def strip(cells, title=None): return (f'<div class="striptitle">{title}</div>' if title else '') + f'<div class="cells">{"".join(cells)}</div>'
fmt = lambda v, d=2: '—' if v is None else (f'{v:.{d}f}' if isinstance(v, (int, float)) else str(v))

# ---------------------------------------------------------------- numbers gathered in the session (high, 1368×770 → 1777×1000), when the JSON lacks them
S4_HIGH = (H.get('s4') or {}) if H else {}
S6N = H.get('s6noise') or {}
SURVEY = H.get('survey') or []
CEN = ((H.get('s6final') or {}).get('cen')) or {}

def s6_noise_table():
    tags = [('old', 'OLD renderer (leader path, all v3 off, 1777 native)'), ('main', 'main = ReSTIR + sharp (K 0)'), ('hyOnly', 'hybrid K 4 alone'), ('ship', '<b>SHIP</b>: hybrid K 4 + sliver rule + GBAA clamp'), ('held2', 'ship, K 2'), ('held8', 'ship, K 8'), ('noSharp', 'ship with sharp direct off (TAAU only)')]
    tiles = [('poolIn', 'moving pool — lit INTERIOR'), ('poolAll', 'pool + its edge band'), ('door', 'door frame tile'), ('wall', 'wall tile'), ('floor', 'lino tile')]
    h = ['<div class="scroll"><table><caption>S6 · per-pixel NOISE under the sweep: sd of 8-bit luma between two seeds of the same deterministic sweep, frames 12‥39, ÷√2 (high). Detail, aliasing and the light\'s own motion cancel; only what the dice change remains.</caption><thead><tr><th>variant</th>' + ''.join(f'<th>{t[1]}</th>' for t in tiles) + '</tr></thead><tbody>']
    for k, lab in tags:
        r = S6N.get(k)
        if not r: continue
        h.append(f'<tr><td>{lab}</td>' + ''.join(f'<td>{fmt(r.get(t[0], {}).get("noiseSd"), 3)}</td>' for t in tiles) + '</tr>')
    h.append('</tbody></table></div>'); return ''.join(h)

def s4_table():
    rows = [('tr1', 'main — 1 ray (the transient stratum as it was)'), ('tr2', '2 stratified'), ('tr4', '<b>4 stratified (high\'s K)</b>'), ('tr8', '8 stratified (ultra\'s K)'), ('old', 'OLD renderer (8 / 4 / 3 leaders)'), ('steadyNew', 'the same light as a NEW persistent light, first frame through the reservoirs')]
    tiles = [('samShadow', "Sam's own shadow"), ('cartonEdge', 'carton shadow edge'), ('partShadow', 'partition shadow'), ('chairNE', 'chair + shadow'), ('floorMid', 'open lit floor')]
    h = ['<div class="scroll"><table><caption>S4 · THE FLASH FRAME, 8 times: per-pixel sd across the 8 (8-bit luma; hp = spatial high-pass) — high</caption><thead><tr><th>variant</th>' + ''.join(f'<th>{t[1]}<br><span class="kind">sd · μ</span></th>' for t in tiles) + '</tr></thead><tbody>']
    for k, lab in rows:
        r = S4_HIGH.get(k)
        if not r: continue
        cells = []
        for t, _ in tiles:
            v = r.get(t, '')
            try: mu = v.split('μ ')[1].split(' ')[0]; sd = v.split('sd ')[1].split(' ')[0]
            except Exception: mu = sd = '—'
            cells.append(f'<td>{sd} · <span class="kind">{mu}</span></td>')
        h.append(f'<tr><td>{lab}</td>' + ''.join(cells) + '</tr>')
    h.append('</tbody></table></div>'); return ''.join(h)

def survey_table():
    if not SURVEY: return '<p class="missing">survey: no rows</p>'
    h = ['<div class="scroll"><table><caption>The SLIVER census over the floor at the follow camera (55°, 21 m, fov 28°, high 1777×1000 = 1 777 000 px): the twelve views with the MOST leaks</caption><thead><tr><th>look point (x, z)</th><th>sliver px</th><th>%</th><th>ring-only px</th><th>traced</th><th>ray found DARK what rule 0 lent lit (= a bright leak)</th><th>ray found lit what it lent dark</th></tr></thead><tbody>']
    for r in SURVEY[:12]:
        h.append(f"<tr><td>({r['x']}, {r['z']})</td><td>{r['sliver']}</td><td>{r['sliverPct']}</td><td>{r['ring']}</td><td>{r['traced']}</td><td><b>{r['overDark']}</b> ({r['leakPct']} %)</td><td>{r['overLit']}</td></tr>")
    h.append('</tbody></table></div>'); return ''.join(h)

def tier_table():
    h = ['<div class="scroll"><table><caption>All five tiers · S6 pool-interior / edge / door noise (two-seed sd, frames 12‥) main → SHIP · S4 Sam\'s-shadow flash sd main (1 ray) → SHIP (K) · the hybrid\'s cost with THREE torches + Sam\'s pistol light in view, torches turning (direct pass ms, K 0 → K → 8; interleaved medians — the maintainer on the GPU: read the deltas)</caption><thead><tr><th>tier</th><th>internal → output</th><th>K</th><th>S6 pool interior</th><th>S6 pool + edge</th><th>S6 door</th><th>S4 Sam\'s shadow</th><th>S4 carton edge</th><th>direct ms K0 → K → K8</th><th>union K0 → K</th></tr></thead><tbody>']
    for t in ['ultra', 'high', 'medium', 'low', 'verylow']:
        d = TIERS.get(t)
        if not d: h.append(f'<tr><td>{t}</td><td colspan="9" class="missing">not run</td></tr>'); continue
        K = d.get('K'); res = d.get('res', ['?'] * 4)
        s6 = d.get('s6') or {}
        if t == 'high' and not s6 and S6N: s6 = {'main': {k: v.get('noiseSd') for k, v in S6N.get('main', {}).items()}, 'ship': {k: v.get('noiseSd') for k, v in S6N.get('ship', {}).items()}}
        def s6c(tile):
            a = (s6.get('main') or {}).get(tile); b = (s6.get('ship') or {}).get(tile)
            return f'{fmt(a, 3)} → <b>{fmt(b, 3)}</b>'
        s4 = d.get('s4') or {}
        def s4c(tile):
            def sd(v):
                if v is None: return None
                return v.get('sd') if isinstance(v, dict) else None
            a = sd((s4.get('main') or {}).get(tile)); b = sd((s4.get('ship') or {}).get(tile))
            if t == 'high' and a is None and S4_HIGH:
                try: a = float(S4_HIGH['tr1'][tile].split('sd ')[1].split(' ')[0]); b = float(S4_HIGH['tr4'][tile].split('sd ')[1].split(' ')[0])
                except Exception: pass
            return f'{fmt(a)} → <b>{fmt(b)}</b>'
        c = COSTQ.get(t) or d.get('cost') or {}
        k0 = c.get('K0', {}); kk = c.get(f'K{K}', {}); k8 = c.get('K8', {})
        cost = f"{fmt(k0.get('direct'))} → <b>{fmt(kk.get('direct'))}</b> → {fmt(k8.get('direct'))}"
        un = f"{fmt(k0.get('union'))} → {fmt(kk.get('union'))}"
        h.append(f'<tr><td>{t}</td><td>{res[0]}×{res[1]} → {res[2]}×{res[3]}</td><td>{K}</td><td>{s6c("poolIn")}</td><td>{s6c("poolAll")}</td><td>{s6c("door")}</td><td>{s4c("samShadow")}</td><td>{s4c("cartonEdge")}</td><td>{cost}</td><td>{un}</td></tr>')
    h.append('</tbody></table></div>'); return ''.join(h)

def census_rows():
    if not CEN: return ''
    h = ['<div class="scroll"><table><caption>S6 · the census inside the Sam / door / pool rects along the sweep (high): sliver px, and of those how many the ray overturned DARK (rule 0 would have drawn them lit)</caption><thead><tr><th>frame</th><th>main: sam</th><th>main: door</th><th>main: pool</th><th>SHIP: sam (leaks caught)</th><th>SHIP: door</th><th>SHIP: pool</th></tr></thead><tbody>']
    for a, b in zip(CEN.get('main', []), CEN.get('ship', [])):
        f = lambda c: f"{c['sliver']}" if not c.get('overDark') else f"{c['sliver']} ({c['overDark']})"
        h.append(f"<tr><td>{a['k']}</td><td>{f(a['sam'])}</td><td>{f(a['door'])}</td><td>{f(a['pool'])}</td><td>{f(b['sam'])}</td><td>{f(b['door'])}</td><td>{f(b['pool'])}</td></tr>")
    h.append('</tbody></table></div>'); return ''.join(h)

def ident_table():
    if not ID: return '<p class="missing">identity: not recorded</p>'
    h = ['<div class="scroll"><table><caption>OFF = main byte for byte: the deterministic still\'s FNV hash (tools/qa/sharp-harness.js identityHash, first call after boot) — this branch with every new switch at its as-it-was value vs main @ 0f33b7f served beside it</caption><thead><tr><th>tier · view</th><th>main @ 0f33b7f</th><th>this branch, hybrid 0 · sliver 0 · clamp off</th><th></th></tr></thead><tbody>']
    for k, v in ID.items():
        h.append(f"<tr><td>{k}</td><td><code>{v.get('base')}</code></td><td><code>{v.get('mine')}</code></td><td>{'identical' if v.get('base') == v.get('mine') else '<b>DIFFERS</b>'}</td></tr>")
    h.append('</tbody></table></div>'); return ''.join(h)

CSS = """
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a63;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a3261c;--code:#f1efe8}
@media (prefers-color-scheme: dark){:root{--bg:#141412;--fg:#e9e7df;--mut:#9c9a91;--card:#1c1c19;--line:#33322d;--acc:#f0b45c;--good:#6fd08a;--bad:#ff8a7d;--code:#24231f}}
:root[data-theme="light"]{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a63;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a3261c;--code:#f1efe8}
:root[data-theme="dark"]{--bg:#141412;--fg:#e9e7df;--mut:#9c9a91;--card:#1c1c19;--line:#33322d;--acc:#f0b45c;--good:#6fd08a;--bad:#ff8a7d;--code:#24231f}
html{background:var(--bg);color:var(--fg)}body{max-width:1180px;margin:0 auto;padding:28px 18px 80px;font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:38px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}h3{font-size:16px;margin:24px 0 8px}
p{margin:8px 0}.lede{color:var(--mut)}blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--acc);background:var(--card);border-radius:0 8px 8px 0}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:13px}.kind{color:var(--mut);font-size:12px}
.scroll{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;font-size:13px;min-width:640px;font-variant-numeric:tabular-nums}h1,h2,h3{text-wrap:balance}a:focus-visible,summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px}caption{caption-side:top;text-align:left;color:var(--mut);padding:4px 0 8px}
th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}th{background:var(--card)}
.cells{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 18px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px;max-width:100%}
figure img{display:block;max-width:100%;height:auto;image-rendering:pixelated;border-radius:4px}figcaption{font-size:12px;color:var(--mut);margin-top:4px;max-width:560px}
.striptitle{font-weight:600;margin-top:14px}.missing{color:var(--bad);font-size:12px}.verdict{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:14px 0}
.verdict b{color:var(--acc)}.good{color:var(--good)}.bad{color:var(--bad)}ul{padding-left:22px}li{margin:4px 0}
"""

def page():
    P = []
    P.append('<title>Direct-light quality — torch, flash, slivers</title><style>' + CSS + '</style>')
    P.append('<h1>Direct-light quality: the torch, the flash, the slivers</h1><p class="lede">lane v3/direct-quality · 2026-08-12 · high = 1368×770 → 1777×1000 unless a row says otherwise · every scripted step rendered offscreen once, dice seeded, guards parked dark, the tube held steady · the maintainer was playing on the same GPU: read cost deltas, not levels</p>')
    P.append('<blockquote>"there\'s some odd glowing at contact points for some things. also the light from muzzle flashes looks pretty noisy and i\'m still seeing quite a bit of temporal artifacts … weird light leaking in door frame too. weird red wall leaking on sam too. looks to be from direct light? … still seeing noise in flashing light in cubicle" — then: "playing around with the guards, the flashlight direct lighting seems like a huge regression now. very noisy and lots of rims" · <code>?norestir&amp;nosharp</code> "looks great"</blockquote>')
    P.append('<div class="verdict"><b>What it was.</b> A CARRIED light moves every frame, and the reservoirs are a history: under a sweeping torch the temporal weight every pixel inherits describes the cone where it stood a frame ago — the pool\'s fully-lit interior comes out mottled and crawling, its edge band is one or two fresh rays a pixel, and the shadow denoiser (rightly) drops its own history there too. The muzzle flash never had a history: one shadow ray per pixel on the only frames it exists. <b>What ships.</b> A HYBRID estimator: every light a character carries (owner byte ≠ 0 — torches, Sam\'s gun light, flashes, tracer heads) bypasses the reservoirs and gets the old leader treatment every frame at the pixels it reaches — K stratified emitter samples per leader (ultra 8 · high 4 · medium 3 · low 2 · verylow 2), shaded exactly from the pixel\'s own point; static lights keep ReSTIR untouched. Plus the false colour ReSTIR painted along shadow boundaries under two lights of different colour (the "yellow / blue fringes": its belief hue coloured a blocked light\'s penumbra with a far light the tile still believed — a HUE SPLIT fixes it, 6 663 green px → 0), and two hygiene fixes the sliver hypothesis produced (real, but 0.01 % of a frame): the sharp path no longer borrows a ratio across surfaces, GBAA no longer blends toward a nearer third surface. Every switch off = main byte for byte (48b3212e / b4bceada at high, 2ce6cb9d at medium, on both trees).</div>')

    # ---- S6
    P.append('<h2>1 · S6 — the torch sweep (the headline)</h2><p>A synthetic torch with the guards\' own numbers (intensity / cone from <code>game.tune</code>, radius <code>settings.flashlightRadius</code>) and an OWNER byte, slid half a metre at hand height while its aim runs along the corridor\'s north wall from Sam (standing against it) across the storage door — 40 offscreen renders, the pose set per frame, so every variant draws the same 40 frames to the pixel (a staged man\'s hand sways on clocks keyed to the run\'s start time: his pool landed tens of pixels apart between variants). Crops ×3 follow the beam\'s landing point.</p>')
    for f in ['20', '36', '04']:
        cells = [fig(f'dq_{t}_S6_poolAll_f{f}', cap, w=560) for t, cap in [('old', f'OLD renderer · frame {f}'), ('main', f'main (ReSTIR + sharp) · frame {f} — the mottle across the disc'), ('ship', f'SHIP (hybrid K 4 + slivers + clamp) · frame {f}'), ('held8', f'hybrid K 8 · frame {f}')]]
        P.append(strip(cells, f'The moving pool, frame {f} of 40 (×3, 380×240 output px)'))
    P.append(s6_noise_table())
    P.append('<p>Reading it: in the moving pool\'s lit interior main carries <b>1.9×</b> the old renderer\'s per-pixel noise (0.207 vs 0.113 levels) and it is spatially correlated — the mottle in the crop, not grain; the hybrid lands ON the old renderer (0.111 at K 4, 0.110 at K 8, 0.112 even at K 2: in a fully lit pool every stratum agrees, so K matters only in penumbrae — S4). The door and wall tiles the cone crosses: main 0.40 / 0.47 → ship 0.24 / 0.30 (old 0.26 / 0.33). The TAAU-only path (sharp direct off) reads 0.98 in the pool: two seeds draw two jitter sequences, and a jittered upscale of a hard bright disc differs pixel by pixel — shimmer this metric counts and the eye reads as crawl; the sharp path\'s exact per-output-pixel U has none of it.</p>')
    cells = []
    for f in ['04', '12', '20', '28', '36']:
        cells.append(fig(f'dq_main_S6_strip_f{f}', f'main · f{f}', w=372))
    P.append(strip(cells, 'Filmstrip — main (800×440 output px round the sweep, ÷2.15)'))
    cells = []
    for f in ['04', '12', '20', '28', '36']:
        cells.append(fig(f'dq_ship_S6_strip_f{f}', f'SHIP · f{f}', w=372))
    P.append(strip(cells, 'Filmstrip — SHIP'))
    cells = []
    for f in ['04', '12', '20', '28', '36']:
        cells.append(fig(f'dq_old_S6_strip_f{f}', f'old · f{f}', w=372))
    P.append(strip(cells, 'Filmstrip — the OLD renderer'))
    P.append('<h3>The mechanism, and why the fix is structural</h3><ul><li><b>The reservoir\'s weight is a history of the class total.</b> The temporal reservoir a pixel inherits carries last frame\'s estimate of Σ E·V at the texel it came from, re-weighted only by ITS OWN light\'s change at this point. Under a sweeping cone every pixel\'s history was made where the cone stood a frame ago: even with every shadow ray clear, the interior of the pool reads a spatially varying, slowly correcting estimate — the mottle. No ray count fixes that; only not reusing does.</li><li><b>The confidence cut and the light-motion cue both fire</b> where the cone\'s falloff crosses a pixel: the history goes (correctly — it is wrong), the pool\'s edge band is shaded from one or two fresh rays, and the shadow client shows them nearly raw.</li><li><b>Thin faces</b> (a jamb\'s 4-cm reveal beside the leaf\'s 3-cm slot): the reservoir domain is the UNJITTERED pixel centre, which for a face thinner than a pixel plus its jitter lies on the next surface — its rays answered for the wrong face. Carried lights now trace from the raster\'s own point.</li><li>The old leader path traced 8 stratified rays to the top light from the pixel\'s own point every frame and had no history to be wrong — which is exactly what the hybrid gives every carried light, and only them: fixtures, panels, lamps, the vending fronts and the moon (owner 0, never move) keep the reservoirs, whose calm-frame cost and noise are why they exist.</li></ul>')
    P.append(census_rows())
    P.append('<p>The "rims": along the sweep the census finds 14–21 sliver pixels round Sam and 52–54 round the door frame, a dozen or two of them leaks the ray now catches — real, fixed, and far too few to be what was seen. What renders DASHED down every door frame under a torch is the leaf\'s 3-cm slot and 4-cm reveal at 1777 px — in the old renderer too (below, ×9): sub-pixel geometry on an unjittered raster, the residual docs/internal/image-quality.md §7 already names.</p>')
    P.append(strip([fig('dq_jold_S6_door', 'OLD renderer', w=280, crop=(30, 380, 230, 680), scale=3, nearest=True), fig('dq_jsoff_S6_door', 'TAAU only (sharp off)', w=280, crop=(30, 380, 230, 680), scale=3, nearest=True), fig('dq_jmain_S6_door', 'main', w=280, crop=(30, 380, 230, 680), scale=3, nearest=True), fig('dq_jship_S6_door', 'SHIP', w=280, crop=(30, 380, 230, 680), scale=3, nearest=True)], 'The west jamb of the storage door inside a static torch pool, ×9'))

    # ---- tiers + cost
    P.append('<h2>2 · All five tiers, and the cost</h2>')
    P.append(tier_table())
    P.append('<p>The hybrid\'s cost is bounded by where carried light falls: three torch pools and a pistol light cover a few per cent of a corridor frame, and only those pixels trace the extra 2K rays. Calm frames (no carried light in view) are the reservoirs\' as before — the identity hashes below are also the proof that nothing else moved.</p>')

    # ---- S4
    P.append('<h2>3 · S4 — the muzzle flash</h2><p>Sam in the dark cubicle aisle; the flash\'s own numbers (effects.ts <code>shot</code>: (1, .62, .26), power 90 × the pistol\'s gain × the suppressed row\'s 0.45 ≈ 49, range 8 m, radius 0.08) fired at the muzzle point for exactly ONE render over a settled dark scene, eight times with the dice moved on: the per-pixel sd across the eight is the flash\'s own sampling noise as presented (the reservoirs never hold a transient, the shadow client jumps to the frame\'s value, the TAA clips — there is no history of a flash anywhere).</p>')
    P.append(s4_table())
    for tile, cap in [('samShadow', "Sam's own shadow on the carpet"), ('cartonEdge', "the carton's shadow edge"), ('partShadow', 'the partition\'s shadow')]:
        P.append(strip([fig(f'dq_flOld_S4_{tile}_f0', 'OLD renderer', w=420), fig(f'dq_fl1_S4_{tile}_f0', 'main — 1 ray', w=420), fig(f'dq_fl4_S4_{tile}_f0', '4 stratified (high)', w=420), fig(f'dq_fl8_S4_{tile}_f0', '8 stratified (ultra)', w=420)], f'The flash frame ×3 — {cap}'))
    P.append('<p>An adaptive stop (end a light\'s strata once the first two agree) was built and measured WORSE per ray — 8 adaptive read 1.64 in Sam\'s shadow against 1.19 for a plain 4 at a like ray spend: the strata that agree first are exactly a penumbra\'s outer pixels. Not shipped; the seam is a constant.</p>')

    # ---- slivers
    P.append('<h2>4 · The sliver hypothesis — measured, refuted as the cause, kept as hygiene</h2><p>The lead\'s attribution for the leaks / rims / fringes was the sharp path\'s ratio fallback: an output pixel none of whose internal texels lies on its surface borrowed the nearest texel\'s ratio, lit or not. The census (sharp_direct.wgsl now writes its fallback code per output pixel into sharpE\'s alpha; <code>__sharp.census()</code>) over a 77-view survey of the floor at the follow camera:</p>')
    P.append(survey_table())
    P.append('<p>0.008–0.015 % of a frame are slivers and 47–70 pixels a frame are leaks by construction — scattered single pixels on chair legs, reveals and limb edges, not lines and rims. Rule 1 fixes them anyway (one deterministic output-resolution ray per class to the strongest live emitter, the remainder on the neighbours\' luminance ratio, both classes alike, ≤ 24 rays a tile), for +0.13 ms of occupancy at high (the traced kernel variant) and no measurable ray time.</p>')
    P.append(strip([fig('dq_main_S1_jambW', 'main · storage door, follow camera (×3)', w=300), fig('dq_ship_S1_jambW', 'SHIP', w=300), fig('dq_sharpOff_S1_jambW', 'sharp direct off', w=300), fig('dq_main_S1_jambW_paint', 'census paint: magenta = sliver, yellow = outer ring only', w=300)], 'S1 — the door frame at 21 m: no line to fix'))

    # ---- the other notes
    P.append('<h2>5 · The other four notes — evidence, and whose term each is</h2>')
    P.append('<h3>"Glowing at contact points" = no self-shadow on characters</h3><p>Direct-only view, a guard against the corridor wall under its panel (capsule proxies; mesh shadows read the same): his boots shine at their unshadowed value INSIDE the shadow his own legs cast round them — every shadow ray leaving a character\'s pixel skips that character\'s own proxies (the owner byte; capsules or mesh alike), so what his body shades from the panel above never darkens. Estimator-independent; it is the character-visibility term the SDF-characters lane is building (a soft self-shadow factor). Not touched here.</p>')
    P.append(strip([fig('dq_view3_S2b_frame', 'view 3 (direct only), ×2.5 on the feet', w=560, crop=(720, 600, 1020, 730), scale=2.5, nearest=True), fig('dq_view3_S2b_frame', 'the man, view 3', w=420, crop=(700, 200, 1120, 720))]))
    P.append('<h3>"Yellow / blue fringes along shadow boundaries" — physical bands, PLUS a false colour ReSTIR painted on them (fixed)</h3><p>Two lights of different colour put one object\'s shadow in two places: the band only the warm one cannot reach is lit blue, the band only the cool one cannot reach yellow — the old renderer draws the same bands (left). On top of them ReSTIR\'s shade step painted a false hue: it colours the class\'s estimated visible LUMINANCE with the hue of the light mix the pixel BELIEVES visible, and deep inside one light\'s shadow the believed set can be a far dim light of another colour that still has reach there — in this office the green exit signs: the blue lamp\'s penumbra came out green. Attribution by A/B in the direct-only view (strongly-green pixels in the shadow tile): ReSTIR on 6 663 (v3 denoiser) / 4 713 (legacy) · ReSTIR off 0 · ReSTIR with the per-sample hue A/B 0 · old 0. <b>The HUE SPLIT</b> (settings.restirHueSplit): the believed mix colours only the luminance its own lights carried; a sample of a light the pixel does not believe visible keeps its own hue → 0. Where every light is believed (the vending floor the belief hue was built for) nothing changes; off = byte-identical.</p>')
    P.append(strip([fig('dq_s3oldv3_S3_shadowA', 'OLD renderer, direct only: the physical tan / blue bands', w=400), fig('dq_s3h_hsOff_S3_shadowA', 'ReSTIR as it was, direct only: + GREEN painted along the blue lamp\'s shadow (3 858 strongly-green px)', w=400), fig('dq_s3h_hsOn_S3_shadowA', 'ReSTIR with the HUE SPLIT: 0 green px', w=400), fig('dq_s3h_final_S3_shadowA', 'SHIP, composite', w=400)]))
    P.append('<h3>"Light leaking in door frame"</h3><p>Not reproduced as a leak in any framing tried (storage / manager / break-room doors at 21 m and 9 m, corridor lit and dark, the leaf widened to shut its slots): with the corridor group off the frame is black through the sharp path and without it (docs/shots dq_darkC*). What every door does show under light is §1\'s dashed slot / reveal — geometry aliasing the old renderer shares — and, under a MOVING carried light through the reservoirs, thin faces shaded from the wrong surface\'s point (fixed by the hybrid\'s ray origin). If the line the maintainer saw is neither, a screenshot\'s framing would pin it in one capture with the census paint on.</p>')
    P.append('<h3>"Red wall leaking on Sam"</h3><p>Not the direct term (a ratio of irradiances carries no albedo). The composite\'s joint-bilateral INDIRECT upsample falls back to the nearest gather texel raw when no tap passes its depth / normal weights, and on a limb thinner than a gather texel (3 internal px at high\'s third-res gather) that texel holds the red partition\'s bounce — present in the internal path too. The gi lane\'s diffuse client owns that upsample; noted there, not built here (the maintainer\'s read of the indirect otherwise: "looking very good").</p>')
    P.append('<h3>"Noise in the flashing light" (the tube)</h3><p>The strobing tube is a STATIC light whose power jumps; the hybrid leaves it to the reservoirs. A jump-frame stratum for it (N stratified rays for a light on the frame its power jumped, its reservoirs carried over frozen) was built and measured wrong in LEVEL: the reservoirs holding other lights still carry the tube\'s old contribution in their weight (the class total lives in W, not per light), so the tube\'s own N-ray term counted it twice — the raw jump frame read +53 %, +21 % after taking it out of spatial reuse. Unfixable without per-light weights; dropped, tjank\'s numbers stand (its per-level noise 1–3× the reference is jump dynamics, iq §3 D).</p>')

    # ---- GBAA, identity, gates
    P.append('<h2>6 · GBAA\'s same-surface clamp</h2><p>An edge pixel blends toward the neighbour across its edge by the far side\'s coverage — right when that neighbour shows the far side (the background of a silhouette, the other face of a crease), wrong when a NEARER third surface stands over the edge (a man before a partition\'s top edge lent half his colour to every edge pixel his outline crossed). The clamp: blend only toward a neighbour at or behind the pixel (depth, the take-up rule\'s tolerance). <code>__iq.crawl</code> V3 / V1 unchanged to the third decimal (the partition tops have nothing nearer over them).</p>')
    P.append('<h2>7 · Identity, gates</h2>')
    P.append(ident_table())
    P.append('<p>Gates on the final build: typecheck clean · <code>tools/qa/gate.sh perf player breach glass materials weapons</code>: perf 24 · player 166 · breach 13 · glass 39 · materials 45 PASS, 0 FAIL; weapons 60 PASS / 6 FAIL — <b>the six (the weapons-identity / teams-identity frozen digests) fail identically on the base commit 0f33b7f</b> (the civilians merge moved the frozen forty-five seconds: a red on main to re-freeze knowingly, not this lane\'s) · quality-plan 0 FAIL · frame-layout PASS (the Frame block is untouched: the sliver rule and the clamp ride in sharpCfgC.zw, the hybrid\'s K and the hue bit in the ReSTIR uniform) · tour --runs 1 PASS · soak seed 2, 4 min: no violations · bun run build OK · GPU validation (error scope + OOM scope + the uncaptured list round the five presets × heldRays 0 / K / 8 × sliver 0 / 1 / cap 0 / both paints × clamp × hue split × edge rays × debug views 0 3 4 9 11 12 13 × a transient flash): clean at all five.</p>')
    P.append('<h2>8 · Residuals</h2><ul><li>The tube\'s jump frames (owner 0) — as tjank left them; a static light\'s jump budget needs per-light reservoir weights.</li><li>The wall cameras\' lens spots pan with owner 0: moving static lights, small and dim; a <code>moving</code> bit from devices.ts would put them in the stratum in one line.</li><li>Character self-shadow (the boots, the "contact glow") and the indirect upsample on thin limbs (the red rim): other lanes\' terms, evidence above.</li><li>The dashed slot / reveal on an unjittered 1777-px raster: geometry, shared with the old renderer.</li></ul>')
    return '\n'.join(P)

if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    html = page()
    open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html) / 1048576:.2f} MB')
