#!/usr/bin/env python3
"""twopointsix — systems atlas. One page naming every system the demo has grown, what it does, how it couples to the
others, and where it lives (main / prototype branch / design). Body-only HTML for the Artifact tool; images inlined.
ATLAS_IMG_DIR=<dir with the downscaled jpgs under atlas/> python3 tools/qa/systems-page.py → docs/review/systems.html (the lead keeps the downscaled hero shots out of the repo; regenerate them with sips -Z 900 from docs/shots as listed in SHOTS)"""
import base64, os, html
ROOT = '/Users/sujay/code/twopointsix'
SP = os.environ.get('ATLAS_IMG_DIR', os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs/review/systems.html')

def img(name, alt, cap):
    p = os.path.join(SP, 'atlas', name + '.jpg')
    b = base64.b64encode(open(p, 'rb').read()).decode()
    return f'<figure><img src="data:image/jpeg;base64,{b}" alt="{html.escape(alt)}" loading="lazy"><figcaption>{cap}</figcaption></figure>'

# status: M = on main, B = prototype branch, D = design / research only
GROUPS = [
 ('perception', 'Perception & the guards', 'One model for the picture and the AI: whatever lights, hides or muffles the player is the same quantity the guards read.', [
  ('The light meter', 'M', 'A GPU probe reads the irradiance falling on the player’s chest and head from the same lights, shadows and bounce the frame is made of; the HUD meter, a guard’s chance of seeing him, a camera’s lens gain and “was that body lying in the light?” all read that one number. A torch a guard drops goes dark and the meter with it.', 'read by: guard vision · devices · bodies-by-light · civilians'),
  ('Sight lines through smoke', 'M', 'A guard’s line of sight is marched through the smoke solver’s density field on the GPU — the plume the player sees is the plume that blinds the guard, including a plume bent along the floor by an HVAC vent.', 'reads: smoke solver'),
  ('Sound propagation', 'M', 'Footsteps, doors, shots, whistles and screams travel along the same propagation paths (through open doors, muffled by shut and sealed leaves, floor material changing the footfall) that the audio mixer uses to place them in the room. A guard hears what the player hears, from where it really came — a routed pop points him at the doorway it came through.', 'read by: guard hearing · civilians · the mixer'),
  ('Guard minds', 'M', 'Patrol → suspicious → alert → search with escalation tiers, pairing, lockdown doors, body aftermath, radio roll-calls and a spokesman; an aim-settle model both ways (track / acquire, target crossing, planting to shoot) and suppression (rounds past a man make him flinch, duck, displace).', ''),
  ('Pursuit tactics', 'M', 'Men hunting a fix they cannot see deal roles over the nav grid: a presser takes the corner that sees the fix and kneels, a flanker paths round with the presser’s corridor penalised and radios “set”, then everyone pushes; a lone man on an armed intruder holds a corner and calls it in; a doorway where a colleague dropped becomes a kill zone the shift stacks on, slices and crosses instead of walking through.', 'reads: nav grid · sight · radio'),
  ('Needs-driven patrol variation', 'M', 'Each staff man is dealt two or three needs (coffee, a smoke outside, water, a stretch) that fill on a calm floor; a full need is telegraphed twenty seconds ahead (a glance at the watch, a line to the nearest colleague or the radio) and walked as a real trip the player can exploit — cancelled the frame anything alarms him.', ''),
  ('Civilians', 'M', 'The cleaner and the late worker perceive through the guards’ own functions with their own cones and nerves: startle, scream (which the men hear through propagation), flee to the cheapest of a calm guard, a wall phone or an exit, report what they saw first- or second-hand, cower, settle. The player can grab, question (real intel: a door code, the response team’s stairs), or tell them to stay down.', 'reads: sight · sound · nav'),
  ('The response to going loud', 'M', 'Sustained gunfire heard by the shift or two bodies found calls a four-man element through the west stair door on a radioed timeline; they file, fan, stack and clear rooms with a stun charge under their own senses, hand off to the fight on contact, and a perimeter tier lights the exterior and posts men outside.', ''),
  ('Devices', 'M', 'Wall cameras see through the guards’ eye test and the player’s light meter and integrate lit-seconds into a radio call; keypad doors take codes learned from dialogue or overheard through the sound model; laser tripwires are broken by capsules and thrown items and end at the first solid thing, glass included.', 'reads: light meter · sight · sound'),
  ('Whistle, bodies, dialogue', 'M', 'A low whistle resolved once against every man through propagation (the nearest free hearer comes to look, torch still in hand; twice in a minute and he searches); bodies are found by the light on them or the finder’s torch; barks, radio traffic and interrogation lines run through one dialogue table with per-man temperament.', ''),
 ]),
 ('player', 'The player’s verbs & the objects', 'Chaos Theory authenticity breaks ties: one-shot lethality both ways, silent takedowns, light and sound meters, weapons leaving dying hands as physical items.', [
  ('One interaction grammar', 'M', 'Every verb near the player is a row (push / ease a door, pick · rattle · kick a lock, grab, question · choke · pistol-whip a held man, drag a body, pull the drive, throw the breaker); tap Space for the highlighted row, hold to choose, release to act, Esc to back out. Sustained verbs (easing a door, picking a lock, a chokehold) run on their own and cancel on movement.', ''),
  ('Doors and locks', 'M', 'Hinged leaves with latch, ease, fling and kick; locks keyed per side with lock ids and keys on guards’ belts (taken through interrogation), picking heard click by click, a kick heard like a shot; sound-sealed leaves are obstacles to the smoke solver and to sound alike; steel doors clang and refuse.', 'feeds: sound · smoke obstacles · nav'),
  ('The kit', 'M', 'The Five-seveN with the OCP that knocks out a light or a guard’s lit torch; the FN2000 (semi / auto, its own spread and reload stages) with a ring-airfoil launcher on the attachment rail — head hits knock out, body hits stagger, misses clack and become items; smoke and stun canisters that are real solver sources and real blinding events; night vision; a gun light posed off whichever weapon is in hand.', ''),
  ('Physical items', 'M', 'Canisters, dropped magazines and the weapons that fall from dying hands are thrown, bounce, rest and can be kicked; pushable furniture slides and blocks doors and sight; a hauled body is a capsule the lasers see.', ''),
  ('Checkpoints & the session journal', 'M', 'Autosaves at quiet moments (refused inside a response or a set piece, regretted if an alarm follows within seconds) as plain JSON of every man, body, door, fixture and the run’s chronicle; a record mode journals every value the simulation takes off the GPU so a session replays headlessly digest for digest — the seam that keeps a GPU-coupled game deterministic under test.', ''),
  ('The debrief', 'M', 'A chronicle of the run (spotted, heard, shots, knockouts, bodies found, doors kicked…) with the player’s path, scored against a price list into a rating, drawn as a map with pins on the end card.', ''),
 ]),
 ('characters', 'Characters & animation', 'glTF mannequins on a clip graph with procedural layers on top — not fully procedural; the learned-motion pipeline is researched and parked.', [
  ('Clip graph + procedural layers', 'M', 'Locomotion and postures from an animation library, with procedural aim, gaze stabilisation, tactical long-gun carriages solved per posture (low ready, patrol, shouldered, port), IK “tells” (a glance at the watch, a stretch), hand signals, kicks, lock-picking, whole-body task clips for civilians; ragdolls on death that settle and persist.', ''),
  ('Shadow & reflection proxies', 'M', 'Every mannequin casts and reflects through fifteen round cones least-squares fitted to its mesh at load; at ultra (and near contact at high) shadow rays walk the skinned mesh itself through a refit BVH; characters shadow themselves from a lifted origin.', 'feeds: every ray in the renderer'),
  ('Wet characters', 'M', 'Rain soaks whoever stands under open sky: darker, glossier cloth with a streaky film and running drops, dripping and wet footprints indoors, drying over half a minute; a waterline lets a man be wet only up to the depth he waded.', 'reads: weather · roof test'),
  ('Learned motion (Kimodo / SOMA)', 'D', 'Researched with a costed plan (a SOMA rig plus motion matching, weeks of work, style found blunt and seed-fragile); parked pending a decision.', ''),
 ]),
 ('world', 'World & modelling', 'Boxes only, on purpose: detail comes from physical systems (light, materials, markings), never from painted textures.', [
  ('The level as data', 'M', 'A validated JSON format (782 boxes, 22 glass panes, vents, lights, switchables, doors and locks, routes, props, devices, civilians’ marks, mission, drill plans, daylight variant) with canonical serialisation, digests and structural diffs; an in-browser editor and workbench (level, materials, character and prop viewer in one shell) round-trips it.', ''),
  ('Materials & markings', 'M', 'A finish per box (GGX roughness, metal, anisotropy) feeding one BRDF at primary and reflection hits; “markings” are tiny palette-indexed bitmaps of materials on a box face (keyboards, carton labels, rack LEDs, vending fronts whose emissive cells are real lights) evaluated analytically with proper minification — no texture atlas anywhere.', ''),
  ('Glass', 'M', 'Panes are analytic: tinted by the glass actually crossed (Beer–Lambert), Fresnel reflection with glints and dust, true refraction of what lies behind, bullet stars drawn where rounds stopped; sight passes, sound and bodies do not, a line of fire does not — one rule set the AI and the picture share.', 'read by: sight · sound · shots · wind'),
  ('Decals & wear', 'M', 'A ring of marks (bullet holes, scorches, scuffs, chips, wet prints, damage) bucketed per metre and read by the g-buffer so light and bounce respond by themselves; a traffic map traced from the patrol routes wears lanes and grimes wall feet on polished floors.', ''),
 ]),
 ('light', 'Light transport', 'Every photon is dynamic: no lightmaps, no baked probes. Sized emitters, traced visibility, a traced gather over a live radiance cache, and one denoiser.', [
  ('Direct light — ReSTIR DI', 'M', 'Exact unshadowed irradiance from every sized emitter per pixel, visibility estimated with a fixed shadow-ray budget through per-pixel reservoirs re-mapped by light identity, per-tile light beliefs, a hybrid path for lights carried by characters, and a twin program under camera motion that scales a pixel’s memory by its own screen motion. Nearly flat in the light count.', ''),
  ('Indirect — traced gather over radiance cascades', 'M', 'A final gather of stratified cosine rays whose hits read a radiance-cascade cache (bounded to the surface the ray left, so light does not leak behind shelves); at ultra the gather resamples its own reservoirs. Switch a light and the bounce follows within frames.', ''),
  ('One denoiser, three clients', 'M', 'Shadows in ratio space (visibility smoothed, the exact unshadowed light never entering a history — switches and flashes are immediate), diffuse and specular radiance with reprojection, per-pixel history, variance-guided à-trous; the specular client reprojects through virtual hit points for the ray-traced reflections.', ''),
  ('Reflections & finish', 'M', 'GGX-sampled reflection rays on anything glossier than a threshold (polished stone, lino, screens, steel, the wet car park), analytic glints of every lamp, characters as their mesh at ultra; contact-hardening from the hit distance.', ''),
  ('Volumetrics', 'M', 'A froxel volume for haze with analytic lit chords and shadowed injection, temporally integrated; smoke marched per pixel through the solver’s domains and lit per step by its strongest lights; rain streaks and lightning-lit sky in the same pass.', 'reads: smoke solver · weather'),
  ('Resolve', 'M', 'Temporal upsampling from a jittered internal resolution with per-pixel object motion, a “sharp direct” path that re-scores direct light at output resolution over an unjittered raster, geometric edge anti-aliasing from the boxes’ own edges, bloom, AgX.', ''),
  ('GPU particles', 'M', 'One pool for sparks, chips, brass, dust and sheets of paper (a lit two-sided leaf with lift and flutter that lands flat and sleeps), plus the near-field rain; collisions traced through the scene grid, shading from the strongest shadow-tested lights, impulses from bangs and impacts, drag against the wind field.', 'reads: wind · lights'),
  ('Quality tiers & the budget', 'M', 'Five presets and an auto mode that calibrates a per-pass cost model behind the start card, then a ladder that trims and climbs on measured GPU headroom; worst-case caps (lights per volumetric step, particle births, full-rate smoke domains) bound the loud minute at every tier.', ''),
 ]),
 ('fluids', 'Smoke, wind, weather — and fire and water on branches', 'The Eulerian solver is the hub: canisters, dust, muzzle smoke and (on its branch) fire all live in it, the wind forces it, the guards see through it.', [
  ('Smoke solver', 'M', 'A pool of 64³ domains placed where smoke is, red-black SOR pressure, door leaves as obstacles re-baked when they move, calm domains stepped less often, shadow rays testing only the plumes they can reach; density, render occupancy and mass kept as a matched set so sight lines and pixels read the same field.', 'read by: sight lines · volumetrics · shadow rays'),
  ('Wind', 'M', 'One analytic field — six ceiling diffusers from the level data (cone jets that turn to run along the floor), the storm outdoors, a gust through every open exterior door — handed identically to the particles (drag against moving air, resting paper trembling and lifting) and to the solver (a plume under a vent pinned to the carpet).', 'forces: particles · smoke'),
  ('Weather', 'M', 'A storm with its own dice: particle rain lit as water near the camera over a drawn lattice farther out, lightning as a transient light the light meter includes (a guard can glimpse the player in a flash), thunder delayed by distance, a wet glossy car park, wet characters.', ''),
  ('Fire', 'B', 'On its branch: flammables ignite and spread by dose, the plume runs through the solver’s own temperature and buoyancy with an updraft in the wind field, flames are blackbody emission inside the smoke march, two flickering lights per fire; measured at +3.3–3.9 ms a fire at high when framed, so it will ship as an opt-in.', 'lives in: smoke solver · wind · lights'),
  ('Water', 'B', 'On its branch: a dispersive height-field surface (one field drives normals, the displaced waterline and the caustic), a still mirror at rest, disturbed by thrown items, blasts, wading and drops, with spray and foam; characters lit in the reflection. Under review on a smaller scene next.', ''),
 ]),
 ('destruction', 'Destruction', 'Bounded, deterministic, and lit like everything else: nothing breaks that the renderer and the guards do not then see.', [
  ('Sustained fire escalates', 'M', 'One chaos knob; rounds and charges pour heat into a coarse grid and escalation gates what a hit does on top of its mark: damage decals by material, paper stacks converted to sheet particles, monitors dying cracked, dust puffs injected into the smoke solver (real density the beams light and the guards’ probe marches), desk clutter and housings knocked off as rigid debris, and past a threshold the ceiling tile over the beaten zone drops — every count capped per frame, second and encounter, every choice hashed.', 'feeds: smoke · particles · decals · hearing (a landing tile is heard)'),
  ('Rigid debris & impulses', 'M', 'A capped pool of tumbling boxes with swept contact, lay-flat and sleep, evicting the oldest at rest; bangs, impacts and body falls kick settled paper, chips and brass back into the air.', ''),
  ('Glass that comes apart', 'B', 'On the physics-showcase branch: impacts on a pane build a Voronoi crack network; on the third round a cell falls as rigid shards with chips, unsupported tongues follow, a charge finishes the panes beside it, tempered exterior glass dices whole — and the hole is real to view, mirror and shadow rays, to rounds, sound and the wind.', ''),
  ('Walls that open', 'B', 'Same branch: sustained fire into one stud bay of drywall swaps the wall for statics framing a ragged hole with the studs standing, so light, sight, sound, rounds and smoke pass because the geometry changed; gypsum chunks and solver dust.', ''),
 ]),
 ('scripting', 'Level design & scripting', 'Levels are data; set pieces are scripts against an injected API; the tour and the breach are the two showcases.', [
  ('The Director', 'M', 'A level’s script is a plain function handed a typed API: handles by name (marks, doors, volumes, routes, plans), programs with triggers (on start, after, on event, on entering a volume, when a predicate holds) that start generator beats resumed inside the game step; verbs over spawning units, squad orders, the breach and room-clear drills, doors, lights, radio and real stimuli (an item on its fuse, real rounds); camera and caption verbs only in programs declared showcase. The manifest is linted against the level at boot. The daytime breach is such a script, beat for beat.', ''),
  ('Showcases', 'M', 'A three-minute tour that drives the real player through the systems with synthetic input under cuts and fades, and the breach — two operatives taking a held room by battle drill six in daylight, real rounds, pinned cameras.', ''),
  ('Editor & workbench', 'M', 'Every edit a function over one undo stack (boxes, lights, doors with cut openings, routes, volumes, markings, devices), lint, play-from-here; the workbench houses the level, materials, character and effects modes on one engine.', ''),
  ('Next', 'D', 'The tour as a program, a Director mode in the workbench with keyframes and scrub, teams as data, saves inside a set piece — designed, not built.', ''),
 ]),
 ('sound', 'Sound', 'Heard where it happened, through what lies between.', [
  ('Propagation-driven mixer', 'M', 'A positional mixer whose occlusion, routing and level come from the same propagation paths the guards hear through; a voice cap and culling, procedural effects (doors by material, footsteps by surface, the whistle’s two notes, thunder near and far), and a score that follows the alarm state.', 'reads: sound propagation'),
 ]),
 ('tools', 'Tools & proof', 'A tech demo that is tested like a product: verdicts, not vibes.', [
  ('Headless harness', 'M', 'The whole game runs over a proxy GPU device at about a second of wall clock per simulated minute: the tour with its by-hand checks as assertions, seeded randomized soaks with per-frame invariants, some sixty probe families with real exit codes, a gate script that is red on any silent probe, journal replays that must stay digest-identical across refactors.', ''),
  ('Renderer instruments', 'M', 'Deterministic boots, pinned cameras and staged actors for captures; lossless pixel A/B with noise floors and identity hashes for every “off = unchanged” claim; serialized GPU timing with interleaved takes on a quiet GPU; hot-swapping any pass’s shader into a staged scene; in-page labs per subsystem and self-contained review pages with the by-eye calls named.', ''),
 ]),
]

TAG = {'M': ('on main', 'm'), 'B': ('prototype branch', 'b'), 'D': ('designed / parked', 'd')}

CSS = r'''
:root {
  --ground: #f2f5f1; --panel: #ffffff; --ink: #16201b; --ink2: #52625a; --rule: #d5ddd7; --accent: #2b7a52; --accent-soft: #dcece3;
  --amber: #a8700e; --amber-soft: #f2e5c9; --slate: #5b6470; --slate-soft: #e4e7eb;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --ground: #0c1210; --panel: #121a16; --ink: #dfe9e3; --ink2: #9db1a6; --rule: #22302a; --accent: #79d69a; --accent-soft: #16281f; --amber: #e0a640; --amber-soft: #2f2714; --slate: #a9b4c2; --slate-soft: #1c222a; }
}
:root[data-theme="dark"] { --ground: #0c1210; --panel: #121a16; --ink: #dfe9e3; --ink2: #9db1a6; --rule: #22302a; --accent: #79d69a; --accent-soft: #16281f; --amber: #e0a640; --amber-soft: #2f2714; --slate: #a9b4c2; --slate-soft: #1c222a; }
html { background: var(--ground); color: var(--ink); }
body { background: var(--ground); margin: 0; font-family: var(--sans); font-size: 16px; line-height: 1.55; }
.wrap { max-width: 68rem; margin: 0 auto; padding: 2.4rem 1.25rem 5rem; display: grid; grid-template-columns: 13rem 1fr; gap: 2.5rem; }
@media (max-width: 860px) { .wrap { grid-template-columns: 1fr; } nav.index { position: static; } }
header.top { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0.7rem; padding-bottom: 1.6rem; border-bottom: 1px solid var(--rule); }
.eyebrow { font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink2); }
h1 { margin: 0; font-size: 2.1rem; line-height: 1.1; letter-spacing: -0.015em; font-weight: 750; text-wrap: balance; max-width: 30ch; }
h1 em { font-style: normal; color: var(--accent); }
header.top p { margin: 0; max-width: 66ch; color: var(--ink2); }
.legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.1rem; font-size: 0.85rem; color: var(--ink2); align-items: center; }
nav.index { position: sticky; top: 1.2rem; align-self: start; display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.9rem; }
nav.index a { color: var(--ink2); text-decoration: none; padding: 0.28rem 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; gap: 0.5rem; }
nav.index a:hover, nav.index a:focus-visible { background: var(--accent-soft); color: var(--ink); outline: none; }
nav.index a span { font-family: var(--mono); font-size: 0.75rem; color: var(--ink2); }
main { display: flex; flex-direction: column; gap: 3rem; min-width: 0; }
section.group { display: flex; flex-direction: column; gap: 1.1rem; }
section.group > h2 { margin: 0; font-size: 1.35rem; letter-spacing: -0.01em; text-wrap: balance; }
section.group > p.thesis { margin: -0.6rem 0 0; color: var(--ink2); max-width: 64ch; }
.entries { display: flex; flex-direction: column; gap: 0; border-top: 1px solid var(--rule); }
article.sys { display: grid; grid-template-columns: 12.5rem 1fr; gap: 0.4rem 1.4rem; padding: 0.95rem 0; border-bottom: 1px solid var(--rule); }
@media (max-width: 640px) { article.sys { grid-template-columns: 1fr; } }
article.sys h3 { margin: 0; font-size: 0.98rem; line-height: 1.3; font-weight: 650; display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
article.sys p { margin: 0; max-width: 68ch; }
article.sys .reads { font-family: var(--mono); font-size: 0.76rem; color: var(--ink2); margin-top: 0.35rem; letter-spacing: 0.01em; }
.tag { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.12em 0.5em; border-radius: 3px; font-weight: 500; white-space: nowrap; }
.tag.m { background: var(--accent-soft); color: var(--accent); } .tag.b { background: var(--amber-soft); color: var(--amber); } .tag.d { background: var(--slate-soft); color: var(--slate); }
.shots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
@media (max-width: 640px) { .shots { grid-template-columns: 1fr; } }
figure { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
figure img { width: 100%; height: auto; border-radius: 4px; border: 1px solid var(--rule); background: #05080a; display: block; }
figcaption { font-size: 0.82rem; color: var(--ink2); }
code { font-family: var(--mono); font-size: 0.88em; }
footer { grid-column: 1 / -1; border-top: 1px solid var(--rule); padding-top: 1.2rem; color: var(--ink2); font-size: 0.88rem; max-width: 70ch; }
'''

def entries(items):
    out = []
    for name, st, text, reads in items:
        label, cls = TAG[st]
        rd = f'<div class="reads">{html.escape(reads)}</div>' if reads else ''
        out.append(f'<article class="sys"><h3>{html.escape(name)} <span class="tag {cls}">{label}</span></h3><div><p>{text}</p>{rd}</div></article>')
    return '\n'.join(out)

SHOTS = {
 'perception': [('04_smoke_canister', 'smoke canister in a doorway', 'A canister’s plume in a doorway: what hides the player from the camera hides him from the guard, whose sight line marches the same density.'), ('09_door_crack', 'light through a cracked door', 'Light through a door eased open a crack — the guard inside reads the same change the player sees.')],
 'light': [('02_lobby', 'lobby at night', 'The lobby: sized emitters, traced shadows, bounce off the stone, reflections in the polished floor.'), ('board_firefight', 'firefight', 'A firefight: muzzle flashes as transient lights, tracer heads, smoke lit per step.')],
 'fluids': [('rainmerge_lot', 'rain in the car park', 'The storm in the car park: particle rain lit by the sodium lamp, the wet lot glossed.'), ('director_breach_t12_main', 'breach stack', 'The breach at ten in the morning: the daylight variant, two operatives stacked — a script driving real men.')],
 'destruction': [('pphys_glass_t20', 'glass crack network', 'The physics branch: a Voronoi crack network between impacts, cells about to fall as shards.'), ('pphys_wall_t03', 'hole in drywall', 'The moment a stud bay gives: corridor light through the studs into a room that was black.')],
}

counts = {g[0]: len(g[3]) for g in GROUPS}
nav = '\n'.join(f'<a href="#{gid}">{html.escape(title.split(" — ")[0].split(" &")[0] if False else title)} <span>{counts[gid]}</span></a>' for gid, title, _, _ in GROUPS)
sections = []
for gid, title, thesis, items in GROUPS:
    shots = ''
    if gid in SHOTS:
        shots = '<div class="shots">' + ''.join(img(n, a, c) for n, a, c in SHOTS[gid]) + '</div>'
    sections.append(f'<section class="group" id="{gid}"><h2>{html.escape(title)}</h2><p class="thesis">{html.escape(thesis)}</p>{shots}<div class="entries">{entries(items)}</div></section>')

n_main = sum(1 for g in GROUPS for it in g[3] if it[1] == 'M'); n_b = sum(1 for g in GROUPS for it in g[3] if it[1] == 'B'); n_d = sum(1 for g in GROUPS for it in g[3] if it[1] == 'D')
body = f'''<meta charset="utf-8">
<title>twopointsix — systems atlas</title>
<style>{CSS}</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">twopointsix · systems atlas · August 2026</div>
  <h1>Everything the demo has grown, and <em>what reads what</em>.</h1>
  <p>A top-down stealth tech demo on raw WebGPU, boxes only, every photon dynamic. The through-line is one model for the picture and the AI: the light meter, the smoke and the sound the player is shown are the quantities the guards perceive. This page names each system in a paragraph, says what it couples to, and where it lives.</p>
  <div class="legend"><span class="tag m">on main</span> {n_main} systems · <span class="tag b">prototype branch</span> {n_b} · <span class="tag d">designed / parked</span> {n_d}</div>
</header>
<nav class="index" aria-label="sections">{nav}</nav>
<main>
{''.join(sections)}
</main>
<footer>Written from the project’s own engineering notes on 12 August 2026. “On main” means shipped in the playable build; “prototype branch” means a reviewed page exists and a merge is a decision away; “designed / parked” means a document, not code. Numbers quoted elsewhere (frame times, probe counts) live in the review pages per subsystem.</footer>
</div>
'''
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(body)
print('wrote', OUT, f'{len(body)/1024:.0f} KB')
