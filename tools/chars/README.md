# tools/chars — the character cast

Builds `public/assets/chars/cast.gltf` (the operators, the defenders, the civilians as swappable PARTS on the
mannequin's skeleton) from nothing but the mannequin already in the repo. No downloads, no Blender needed to build.

```bash
python3 tools/chars/build_cast.py && python3 tools/chars/check_cast.py     # ~3 s; needs numpy only
```

Renders and deformation checks (headless Blender as a Python module: `python3.11 -m venv ~/bvenv &&
~/bvenv/bin/python -m pip install bpy numpy pillow`, `apt-get install -y --no-install-recommends libegl1`, ImageMagick):

```bash
~/bvenv/bin/python -I tools/chars/render_cast.py <outdir> lineup turn topdown --spp 48   # Cycles stills
~/bvenv/bin/python -I tools/chars/render_cast.py <outdir> strips --quick                 # Workbench animation strips
~/bvenv/bin/python -I tools/chars/render_cast.py <outdir> turn --quick --only operator_1 # fast look at one variant
```

## Files

| file | what |
|---|---|
| `kit.py` | mannequin loader (welds, islands, weights), ray casting, `Master` lofts, primitives, normals / top-4 weights, the glTF writer |
| `head.py` | the parametric head every hair style and piece of headgear is sampled from |
| `build_cast.py` | the parts and the variants table; run it to write the asset |
| `check_cast.py` | the file-contract check (plain python3 + numpy); exit 1 on any failure |
| `render_cast.py` | bpy: reads cast.gltf with its own parser, skins it to the mannequin's armature, renders |

## The file contract (what `check_cast.py` asserts)

One glTF 2.0 JSON, buffer embedded as base64, no textures, no animations. Each PART = one node with `mesh` + `skin: 0`,
unique lowercase name, <= 32 parts. `skins[0].joints` are nodes named as the mannequin's 53 joints (the file carries the
mannequin's own node TRS and inverse bind matrices verbatim, but the loader maps by NAME and uses the mannequin's). Vertex
positions are in the mannequin's bind space (metres, +Y up, +Z front, +X = the character's left, feet on Y=0, T-pose).
Every primitive: POSITION, NORMAL, JOINTS_0 (u8 x4), WEIGHTS_0 (f32 x4, normalised, <= 4 non-zero), u16 indices, triangles,
one primitive per SLOT per part, material NAME = the slot: `skin cloth_uniform cloth_plain webbing boot helmet metal_dark
rubber lens accent eye` (eleven; `eye`, slot id 10, appended last, is the whites of the eyes, the same off-white on every side; `accent`, slot id 9, was appended on 2026-10-08 and the order is never changed: it is the member's
marking colour — the operators' helmet band and brassards — and, since stage 4, also the tucked shirt's tie, the tee under the open
jacket and the straw hat: what each of those is drawn as is the side's material table's business). `extras.cast = { version: 1, variants: { name: { side, parts[] } } }`.

## Method

- **Garments are lofts cast onto the mannequin.** `kit.Master` shoots rings of rays from a limb's axis out to the
  mannequin's own island (torso / arm / leg — the mannequin is five closed islands plus 28 finger pieces), every
  centimetre, keeps the FARTHEST hit, smooths the radii along the limb (never below the raw surface — this is what fills
  the purple joint bands) and stores the mannequin's skin weights at each hit. A garment samples that field at chosen
  heights with an offset per ring (`tube_of`), so it carries the mannequin's weights at the very points it was cast from
  and layers (skin < trousers < blouse < vest < pouches) never cross. Why lofts rather than duplicating the mannequin's
  faces: the mannequin's body is only ~4.4k triangles but in bands and steps, its fingers are 9.3k; a loft puts the rings
  where a hem, cuff, roll or blouse needs them and costs a fraction.
- **Shirt tails follow the thighs** (`tail_weights`): below the hip joint a growing share of each vertex goes to the thigh on
  its side, so a raised thigh carries the hem instead of coming through it.
- **Hands:** the mannequin's own palm faces (its weights) + new six-sided finger tubes on its finger joints (90 triangles a
  finger instead of ~800).
- **The head** is a new parametric surface (`head.py`), rigid on DEF-head; the neck is the torso loft cut back from the
  mannequin's bull neck to a human one. Hair, caps, hats and the helmet are shells of that same surface.
- **Hard gear** (pouches, pack, holster, NVG, buckles) = chamfered solids rigid on ONE joint each (`stuck`).
- Right side = the left side mirrored with .L/.R weights swapped.

## Stage 3: told apart (2026-10-08)

What changed on top of Stage 2 (whose tables below are the FIRST cast, kept as its record; where the two differ, this section is the file):

- **Body builds.** `Build` (build_cast.py, after the masters) scales the masters' ring RADII per (height, angle) and leaves the weights alone, so one skeleton and one set of skin weights carry four bodies: `human` (the ordinary man every part is built on unless it names a build: lats and upper arms taken in, waist let out, thighs and calves a size down), `wiry` (tank_top, bandolier), `big` (jacket_open: a belly), `woman` (cleaner). Nothing is scaled above y = 1.435: the head part's neck starts there for everybody. A part is built inside ONE build (`built(name, fn)` in PARTS), so a part worn by two variants is the same body on both.
- **Trousers hang.** `rmin` floors on the thigh rings of the fatigues, the jeans and the operators' trousers: cloth falls from the seat instead of following the thigh in.
- **The part list is re-dealt inside the same 32 bits** (the mask stays a u32, the layout is untouched): `op_uniform` + `op_kit` + `op_boots` are one part `op_suit` (no variant wore one without the others); `nvg_down` is gone (anim/gltf.ts castGoggles only ever drew the mesh pair UP); new `head_b` (the second face), `cleaner` (which carries her own head: look c), `rsp_kit`, `rsp_radio`. 32 of 32 used, none free (anim/gltf.ts CAST_MAX_PARTS; bit 31 is in use, the masks are `>>> 0` everywhere they are built).
- **Faces.** `head.skin_head(look='a'|'b'|'c')`: three faces (see head.py): `head` = A, `head_b` = B, and C (a woman) built into `cleaner`. Brows, lidded eyes, a nose with nostrils, a mouth line, a jaw, ears. The moustache is two halves that follow the lip, on three men (operator_4, defender_3, civilian_2). The operators wear `hair_short` under the helmet (the nape was bare skin). `head.surf()` is unchanged, so every hat, hair and helmet sits where it sat.
- **Hats.** `hat_boonie`: a soft flat-topped crown, a drooping wavy brim, a dark band. `bandana`: on the ACCENT slot (pale cloth on the irregulars' table; on `helmet` it took the caps' colours and read as a small helmet), outside the short hair under it, low on the forehead with no rolled edge, creased, tied behind the left ear with two tails. `nvg_up` is flipped up and lies back along the shell tangent over the brow, nothing below the rim, nothing over the crown.
- **The response team** wears `rsp_kit` over `shirt_tucked` (the tie is under the vest, its knot behind the collar): a full-cut steel helmet with a rolled rim, a flak vest with a standing collar and shoulder caps, three pouches, a radio, a belt, a roll (on `cloth_plain`) across the small of the back. `rsp_radio` (one responder only): a manpack in a pale carrier high on the back and a whip aerial; the one-outfit rule in cast-probes.ts lets it, a face and hair differ. Its chin strap and the operators' are one ribbon (`chin_strap()`): out from under the shell at the temple, down the cheek a finger's width inside the face's outline, in under the jaw and across under the point of the chin, 19 mm of webbing (22 under the chin) lying 2 mm proud of whichever of the two helmeted faces stands further out there. (It was a band from the temple straight to a point under the lip: a V from the front.)
- **The office worker's collar** (`shirt_tucked`) is 1.4 cm lower in front: level, it crossed his mouth from the game's camera.
- **The cleaner** is one part `cleaner` (her own head, a tunic, an apron on `accent` with a bib and two straps over the shoulders and down the back into the tie, slim trousers, hair in a bun under a kerchief on `accent`: in the tunic's yellow it read as a hard hat) + hands_skin + shoes.

### Variants (14)

| variant | side | tris | what tells them apart | parts |
|---|---|---|---|---|
| operator_1 | operator | 10,886 | team leader: radio box on the back, tape antenna, face A | head, helmet, hair_short, hands_glove, op_suit, nvg_up, kit_lead |
| operator_2 | operator | 11,114 | breacher: ram slung across the back (8 cm lower than it was), charge satchel, shell loops, face A | head, helmet, hair_short, hands_glove, op_suit, nvg_up, kit_breacher |
| operator_3 | operator | 10,774 | rifleman: small assault pack, face B | head_b, helmet, hair_short, hands_glove, op_suit, nvg_up, kit_rifleman |
| operator_4 | operator | 10,864 | rifleman: slick, hydration carrier, moustache, face A | head, helmet, hair_short, hands_glove, op_suit, nvg_up, kit_slick, moustache |
| operator_5 | operator | 10,946 | medic: big pack and roll, face B | head_b, helmet, hair_short, hands_glove, op_suit, nvg_up, kit_medic |
| defender_1 | defender | 8,032 | ball cap, loose shirt, fatigues, boots; the ordinary build, face A | head, hands_skin, hair_short, cap_ball, shirt_loose, trousers_fatigue, boots_low |
| defender_2 | defender | 8,686 | straw hat, tank top, bandolier, jeans; the WIRY build, face B | head_b, hands_skin, hair_full, hat_straw, tank_top, bandolier, trousers_jeans, shoes |
| defender_3 | defender | 8,894 | pale bandana tied behind his left ear, open jacket over a tee; the BIG build (a belly, wider through the trunk and arms), face A + moustache | head, hands_skin, moustache, hair_short, bandana, jacket_open, trousers_fatigue, boots_low |
| defender_4 | defender | 8,746 | bare head (full hair), shirt + chest rig, jeans, face A | head, hands_skin, hair_full, shirt_loose, chest_rig, trousers_jeans, boots_low |
| defender_5 | defender | 9,586 | soft boonie with a drooping brim and a band, shirt + chest rig, face B | head_b, hands_skin, hair_short, hat_boonie, shirt_loose, chest_rig, trousers_fatigue, shoes |
| responder_1 | responder | 11,046 | steel helmet, flak vest with collar and shoulder caps, roll across the small of the back, belt pouches, gloves, face B; the RADIO MAN: a pale manpack high on the back and a whip aerial | head_b, hands_glove, hair_short, shirt_tucked, rsp_kit, trousers_fatigue, boots_low, rsp_radio |
| responder_2 | responder | 10,826 | the same kit without the radio, face A | head, hands_glove, hair_short, shirt_tucked, rsp_kit, trousers_fatigue, boots_low |
| civilian_1 | civilian | 9,014 | the cleaner: the WOMAN build, tunic to the thigh, apron with a bib on two straps and a bow behind, a kerchief in the apron colour over hair in a bun, her own face (look c, inside the part) | hands_skin, cleaner, shoes |
| civilian_2 | civilian | 7,750 | office worker: long-sleeved shirt, tie, belt, fuller hair, face A + moustache | head, hands_skin, hair_full, moustache, shirt_tucked, trousers_fatigue, shoes |

Union: 32 parts (limit 32), 41,550 tris, 32,192 verts.

### Parts (32): tris / verts

head 2,388 / 1,291 · head_b 2,388 / 1,291 · moustache 64 / 36 · hair_short 588 / 309 · hair_full 392 / 223 · cap_ball 374 / 260 · hat_boonie 812 / 617 · hat_straw 644 / 533 · bandana 668 / 499 · helmet 1,100 / 872 · nvg_up 260 / 424 · hands_skin 1,278 / 672 · hands_glove 1,470 / 816 · op_suit 4,948 / 4,359 · kit_lead 244 / 518 · kit_breacher 472 / 948 · kit_rifleman 132 / 136 · kit_slick 158 / 189 · kit_medic 304 / 346 · shirt_loose 1,608 / 954 · tank_top 1,800 / 1,257 · jacket_open 2,112 / 1,466 · shirt_tucked 2,000 / 1,494 · chest_rig 1,284 / 1,876 · bandolier 556 / 843 · trousers_fatigue 1,208 / 681 · trousers_jeans 1,208 / 681 · boots_low 588 / 568 · shoes 420 / 364 · cleaner 7,316 / 4,665 · rsp_kit 2,546 / 2,550 · rsp_radio 220 / 454

Checked for this stage: check_cast.py PASS; `probes.ts cast`, `charmats`, `sdfrig`, `frame-layout` ALL PASS plain and with `TPS_CAST=1`; every variant looked at in a Workbench line-up and turnaround, the changed outfits in the 13 deformation frames; the line-up, top-down and close head sheets rendered with the game's colour tables (tools/chars/look). NOT checked: anything on a GPU; the movement pass's blinded and carry poses against the new hats and vest (its pose tool is not in this tree). operator_2's shoulder proxy is fitted to 10 vertices, as it was (the ram's chest cone covers the rest): moving the ram up again drops it under the fit's 8.

## Stage 5: read from the game's camera (2026-10-08)

The look review's findings on the operators and the response team (the camera looks down at about 55 degrees: it sees the crown of
the head and the tops of the shoulders), and on the colour tables. Union 41,020 -> 41,550 triangles (+530). Parts, variants, slots: unchanged.

- **helmet** (964 -> 1,100): the pair band stands 2 mm proud of the shell (3.5 was a lampshade); `crown_stripe()` = a 6 cm stripe (6 mm proud) in
  `accent` from the band at the brow over the crown to the band at the back; the rear rim is 2 cm lower (h .33 / .26 at 135 / 180 degrees);
  `chin_strap()` = the jaw-following ribbon described under the response team above (it was a V from the temples across the cheeks
  and the corners of the mouth, then a straight band to a bar under the lip). The response team's helmet wears the same strap.
- **op_suit** (4,720 -> 4,948): the blouse's collar is a gaiter (to y 1.60 at the back and sides, dipping 3.5 cm under the chin); the
  brassard runs from x .205, over the deltoid (it began at .262); `op_shoulder_marks()` = an `accent` panel on the top of each shoulder,
  a patch of the vest's own grid 3 mm proud of it (it repeats the vest's top rows: keep it in step with part_op_kit).
- **rsp_kit** (2,380 -> 2,546): the collar stands at the back (4.5 cm higher there, drawn in to the neck at its top); the three pouches,
  the belt and the two hip pouches are on the `helmet` slot (the helmet's grey on the black vest); the element's mark on `accent`
  (white on their table; the duty shirt's tie, also `accent`, is wholly under the vest): an 8 cm disc on the helmet's crown and a bar
  across the back of the vest at y 1.45. **rsp_radio**: the set's lid is `accent` too (it stands in front of the bar).
- Colours (src/render/charMaterials.ts): the irregulars' shirts are eleven earth and wash colours with no saturated red, blue or
  green (the squad's pair colours), hats and denim likewise; hair is a list of four by the man (`HAIR`) and matte; the cleaner's apron
  and kerchief are pale (the civilians' `accent` row is a list of two dealt by the id parity the two civilian variants are dealt by);
  the response team's `accent` is its white mark. The Red pair's suit tint is a step lighter (game/nightbreach.ts SQUAD4).

## Stage 2: the set (2026-10-08)

Rebuild: `python3 tools/chars/build_cast.py` (about 4 s; writes cast.gltf through a temp file + rename, so the
file on disk is always whole; `build_cast.py <path>` writes elsewhere). Check: `python3 tools/chars/check_cast.py`,
then `bun run tools/qa/probes.ts cast-file` and `cast-fit`.

### Variants (14): 5 operators, 5 defenders, 2 responders, 2 civilians

| variant | side | tris | what tells him apart from above | parts |
|---|---|---|---|---|
| operator_1 | operator | 8,826 | team leader: dark radio box on the back, tape antenna to 1.92 m, handset on the left shoulder | OP + nvg_up, kit_lead |
| operator_2 | operator | 9,098 | breacher: dark ram diagonal across the back, charge satchel, shell loops on the chest, goggles DOWN | OP + nvg_down, kit_breacher |
| operator_3 | operator | 8,714 | rifleman: small assault pack | OP + nvg_up, kit_rifleman |
| operator_4 | operator | 8,772 | rifleman: slick, flat hydration carrier + hose, moustache | OP + nvg_up, kit_slick, moustache |
| operator_5 | operator | 8,886 | medic / support: big pack, side pouches, bedroll across the top | OP + nvg_up, kit_medic |
| defender_1 | defender | 6,884 | ball cap, loose short-sleeved shirt, fatigue trousers, boots | DEF + moustache, hair_short, cap_ball, shirt_loose, trousers_fatigue, boots_low |
| defender_2 | defender | 7,506 | wide straw hat, tank top, bandolier, jeans, shoes | DEF + hair_full, hat_straw, tank_top, bandolier, trousers_jeans, shoes |
| defender_3 | defender | 7,458 | bandana, open jacket over a tee | DEF + moustache, hair_short, bandana, jacket_open, trousers_fatigue, boots_low |
| defender_4 | defender | 7,598 | bare head (full hair), shirt + three-cell chest rig, jeans | DEF + moustache, hair_full, shirt_loose, chest_rig, trousers_jeans, boots_low |
| defender_5 | defender | 8,070 | boonie hat, shirt + chest rig, fatigues, shoes | DEF + hair_short, hat_boonie, shirt_loose, chest_rig, trousers_fatigue, shoes |
| responder_1 | responder | 8,720 | the trained response team (added by the lead): ball cap, tucked long-sleeved duty shirt + belt, three-cell chest rig, fatigue trousers, boots, GLOVES | RSP + hair_short, cap_ball, shirt_tucked, chest_rig, trousers_fatigue, boots_low |
| responder_2 | responder | 8,752 | the same man with a moustache | RSP + moustache, hair_short, cap_ball, shirt_tucked, chest_rig, trousers_fatigue, boots_low |
| civilian_1 | civilian | 6,310 | the cleaner: loose short-sleeved work shirt worn out over jeans, no tie, bare head | DEF + hair_short, shirt_loose, trousers_jeans, shoes |
| civilian_2 | civilian | 6,538 | office worker: long-sleeved shirt, tie, belt, fuller hair, a moustache | DEF + hair_full, moustache, shirt_tucked, trousers_fatigue, shoes |

OP = head, helmet, hands_glove, op_uniform, op_kit, op_boots. DEF = head, hands_skin. RSP = head, hands_glove (the responders).
Union: 31 parts (limit 32), 27,164 tris, 22,208 verts. Bounding box x +-0.968, y 0..1.910, z -0.378..0.264.

### Parts (31) and their slots

| part | tris | slots | notes |
|---|---|---|---|
| head | 1,208 | skin, rubber (eyes, brows) | head + neck, every variant |
| moustache | 32 | rubber | |
| hair_short / hair_full | 588 / 392 | rubber | hair_full sits lower on the neck and stands 1-2 cm off |
| cap_ball / hat_boonie / hat_straw / bandana | 374 / 476 / 644 / 444 | helmet; the straw hat is accent (+ a rubber hat band) | |
| helmet | 1,100 | helmet, accent (pair band), rubber (ear cups, mic), webbing (chin strap), metal_dark (mount) | |
| nvg_up / nvg_down | 216 / 260 | metal_dark, lens | |
| hands_skin / hands_glove | 1,278 / 1,470 | skin / rubber | |
| op_uniform | 2,456 | cloth_uniform, accent (brassards) | blouse, sleeves, bloused trousers |
| op_kit | 1,680 | webbing, metal_dark, rubber | vest, pouches, belt, canteens, holster, knee pads. NO pack any more: the pack is the role part |
| op_boots | 588 | boot | |
| kit_lead / kit_breacher / kit_rifleman / kit_slick / kit_medic | 244 / 472 / 132 / 158 / 304 | webbing, metal_dark, rubber; the medic's roll is cloth_uniform | rigid on DEF-spine.003; exactly one per operator |
| shirt_loose | 1,608 | cloth_plain, skin (forearms) | untucked, short sleeves |
| tank_top | 1,800 | cloth_plain, skin (arms, shoulders) | a cut top edge (scooped neck, armholes) and two straps that lie on the shoulder (`over_shoulder`) |
| jacket_open | 2,112 | cloth_plain (jacket), accent (the tee under it), skin (wrists) | a real opening (`open_front`) |
| shirt_tucked | 2,000 | cloth_plain, accent (tie), boot (belt), metal_dark (buckle), skin (wrists) | the office worker and the responders; the tie's knot sits in the collar |
| chest_rig / bandolier | 1,284 / 556 | webbing, metal_dark | chest_rig is cut for shirt_loose, bandolier for tank_top |
| trousers_fatigue / trousers_jeans | 1,208 / 1,208 | cloth_uniform | |
| boots_low / shoes | 588 / 420 | boot | |

### Conventions added in stage 2

- A defender's sleeve head is scaled down (`SOFT`) and its offsets are small at the shoulder: no squared cap. Operators keep the squared vest shoulders.
- A hanging hem (blouse skirt, shirt tail, jacket) is kept outside both thighs (`over_legs` in `tube_of`, `leg_envelope`) and part-weighted to the thighs (`tail_weights`).
- Straps over the shoulder are 3D bands (`band3d`). The chest rig's, the tank top's and the bandolier's run along `over_shoulder()`: a line of the NECK master at a fixed distance off the midline, each cross-section flat on the surface under it and carrying that master's weights (so it lies on the slope of the shoulder and moves with the cloth). The bandolier crosses the shoulder `BANDO_X` off the midline, clear of the tank top's strap beside it.
- The tee under the open jacket and the civilian's tie were on `cloth_uniform` (the trouser colour); they are on `accent` now (stage 4).
- The variant `role` strings live in build_cast.py only; the file's `extras.cast.variants` carries `side` and `parts` and nothing else.

### Checked / not checked (stage 2, at the moment the set first existed)

Checked: check_cast.py PASS (now also: every part worn, no two variants the same set, every variant floor to > 1.7 m, 5/4/1 sides);
`probes.ts cast-file` ALL PASS; `probes.ts cast-fit` ALL PASS; every variant looked at once in Workbench with back-face culling
(Idle_Loop frame 1, four yaws for six of them, the line-up for all twelve): no holes, no inside-out parts seen.
NOT checked yet: any clip other than Idle_Loop frame 1 for the ten new variants and for the changed hems (walk, sprint, crouch, aim, death);
the game camera views; the game itself with twelve variants; Cycles renders (the renders named quick-* are Workbench).
Known rough: the chest rig's shoulder straps stand a few cm off the upper back; faces are still mask-like; boots and shoes pointed;
the trouser tops show a brief-shaped crease at the crotch; the civilian's collar is a plain ring; the NVG block is small.

## Stage 3: deformation pass, the `accent` slot, kit out of the arms' way, final renders (2026-10-08)

### Slot change
- A tenth slot `accent` (slot id 9, appended after `lens`; the order of `SLOTS` in kit.py / check_cast.py is never changed) = the
  member's marking colour. The operators' helmet band (`part_helmet`) and brassards (`part_op_uniform`) moved from `cloth_plain`
  to `accent` (312 triangles in all). Nothing else moved: `cloth_plain` is plain cloth only again (defender and civilian tops).
  render_cast.py puts the pair colours (red / blue) on `accent`.
- check_cast.py now also asserts that every variant's lowest vertex is at y = 0 +- 2 mm (bind pose, metres) and prints it:
  all twelve are 0.0000 (boots and shoes snap every vertex under 2 cm to y = 0, so the whole sole is flat on the floor).

### Deformation fixes (looked at in Walk, Sprint, Jog, Crouch idle / walk, Pistol aim neutral / down, Sitting, Death01, 13 poses a variant)
- Shirt tails, the blouse skirt and the jacket hem: `tail_weights` keeps the SEAT with the hips (25 % to the thighs behind, 85 % in
  front and at the sides), so a crouch no longer pushes the trouser seat through the back of the hem.
- `over_legs` hems are also kept 2 cm outside the trouser SEAT (the TORSO master), not only outside the two legs: the seat came
  through the hem in the sprint.
- The jacket's patch pockets moved up to y 1.115 (they rode the hem's thigh weights and came off the cloth).
- The lead's tape antenna: 7.5 cm outboard of the spine, leaned back 14 deg, top at 1.87 m: clear of the helmet in every pose of the sheet
  (crouch, aim down, death included).
- Left as they are (seen, judged small at game size): the vest's shoulder against the sleeve head in the sprint; a kneeling foot's
  crumpled boot toe; a hem ring that stands off the body in the death poses.

### Kit out of the arms' way (the lead's measurements from the game's own poses, renders/poses/)
- op_kit, front magazine pouches: 24 mm deep instead of 42, back still on the carrier: the faces are 18 mm less proud
  (lids likewise, 26 mm instead of 44). Bevel 6 mm.
- op_kit, the outer pair of that row (was at +-38 deg, in the left forearm's way in the rifle carry) now sits at +-126 deg: on the back
  of the flank, behind the elbow line ("kidney" pouches), same shallow size. The front row is the centre pair only.
- op_kit, the vest's flank under both arms: 20 mm thinner (33 mm off the body -> 13 mm), only where |sin(theta)| > 0.85 (full
  at 0.97) and between y 1.09 and 1.36 (ramps over 5 cm at each end). Front and back plates, shoulders and the top-down outline are as
  they were. (Taking the thinning up to y 1.40 left operator_2 only 4 shoulder vertices outside its chest cone in `probes.ts cast-fit`;
  at 1.36 the probe passes. That slot is marginal on the breacher: say so if it ever fails again.)
- chest_rig: all three cells and both side pouches 10 mm shallower (cells 34 mm deep instead of 44, side pouches 26 instead of 36), their
  backs where they were; lids and studs follow.
- Measured by the lead afterwards through the animator poses: throw-ready hands in the pouch row 43.7 -> 31.2 mm (313 -> 203 edges);
  chest rig against the forearm 17.7 -> 7.7 mm. The carry-walk elbow (58 mm) and forearm (28 / 31 mm) did not move: that elbow is inside the
  body itself (50-56 mm into the defenders' own shirts in the same carry), the animation's to un-tuck. The vest is NOT to be thinned further.
- chest_rig shoulder straps: every path point now rides its own height off the body (the loose shirt's offset there + 0.8 cm: 3.0 cm at the
  cells, 1.8 cm over the shoulder, 3.3 cm at the back of the waist; it was 2.6 cm everywhere), three more points down the back, and the
  strap's flat lies along the surface's own normal (`tpath`, entries with a third number). On the loose shirt it lies on the cloth; on the
  responders' tucked shirt (thinner on the back) it stands about a centimetre off between the shoulder blades and the waist.

### Responders (side `responder`, two variants, no new part)
chest_rig over shirt_tucked, looked at closely (Workbench turnaround of responder_2 + its deformation rows): the cells sit on the shirt (their
backs 2.7 cm off the body, the shirt 1.6-2.0 cm), the tie runs down BEHIND the centre cell and ends above the belt, it does not come through
the cell's face; the rig's waist band clears the shirt; the cap sits over hair_short as on defender_1. The shirt's wide collar ring
covers the straps at the neck. render_cast.py draws them with the defenders (sheets `*-defenders` and `*-all`), grey shirt / charcoal trousers / black cap
as a stand-in (the game colours are the materials part's).

### Renders (all in renders/, made by render_cast.py from the final build)
- `deform-operators.png`, `deform-defenders.png` (defenders + responders + civilians): Workbench, one row a variant from the front and one from the back.
- `turnaround-<variant>.png` x 14, `lineup-operators|defenders|all.png`, `topdown-operators|defenders|all.png`: Cycles, 32 spp, Standard view
  transform (no Filmic / AgX), key / fill / rim 330 / 90 / 160 W, world 0.22: slot colours read as given. The top-down sheets carry six
  panels: 57 deg from 14 m (fov 28) and straight down from 14 m, each lit, shaded in one grey, and as a flat grey silhouette (the straight-down panels
  use a longer lens, fov 20, so the row fills the frame; men stand 1.25 m apart on the long sheets, 1.05 m on `topdown-operators`).
- `CAST_GLTF=<path>` in front of render_cast.py renders a scratch build instead of the installed file.

### Still rough (polish, not done)
Faces mask-like; (boots, collar, jacket front: see stage 4);
the trousers' crotch crease; the NVG block is small; short sleeves have a squared cap.
Two small dark marks show at the bare wrists from behind (turnaround-defender_5, responder_1): not looked into yet.
The top-down sheets size their width to the row (160 px a metre), the line-ups' raised panel its height: nobody is cut off at 14 variants.

## Stage 4: mesh faults from the look review (2026-10-08)

Each was seen in a render before and after (Workbench close-ups with back-face culling; the hands also in Cycles).
- **hair_short / hair_full, the hole at the back of the head.** Two causes: the neck tube stands up to 2.4 cm behind the skull under
  its widest and came through the nape (`over_neck()` keeps a hair shell's vertices under y 1.665 outside the NECK master), and
  hair_short's five sine-spaced rows left a first face from h .15 to .45 that cut inside the skull's bulge (`H.shell(gs=…)`: ten rows,
  close together at the nape and at the crown; 308 -> 588 tris).
- **hands, the black specks.** The palm was the mannequin's faces with every vertex beyond x .745: a saw edge whose notches reached
  x .773, past the end of every wrist / cuff tube (.758) = a hole on the back of each hand, bare and gloved. It is cut at the hand's own
  wrist ring now (x > .72: 243 faces instead of 193).
- **tank_top** has two shoulder straps (cloth_plain, 5.6 cm, `top_path()` over the shoulder at x 8.6 cm, both ends starting inside the
  tube's top edge).
- **shirt_tucked's collar** is a narrow turned-down band (y 1.548-1.574, 2.1-2.5 cm off the neck, two short points in front) instead of
  the ring from y 1.495 that lay over the shoulders. **chest_rig's shoulder straps** moved out to x 10.6 cm (were 9.2) and climb at a
  constant distance from the neck (`th_x()`): they clear the collar and no longer kink at the collar bone.
- **helmet**: the pair band is twice as tall (h .685-.845 with three rows between, it was .685-.765 and hid under the crown from the game's camera).
- **jacket_open**: the front is a real opening (`open_front()`: two straight edges with a lip turned in, faces between them dropped),
  no longer the tube dipped under the tee; the tee has a crew neck to y 1.540 (the hole at the collar was the neck's skin coming through
  the strip of dipped jacket above a tee that stopped at 1.512) and a hem row.
- **boots / shoes (op_boots too)**: rows under 3.4 cm take that ring (`SOLE`; the LEG master flares at the sole: the foot was 20 cm wide,
  now 14.4), and `blunt_toe()` eases everything ahead of z .085 toward .168: the tip is at z .149 (was .21), the foot 25.5 cm long. Soles still at y 0.
- **responders wear hands_glove** (`RSP`).
- Not done: the short sleeve's squared cap / the step at the sleeve head (item left as it was). The collar reads as a low stand collar more
  than a pointed one. The tank top's neckline is still a straight edge between the straps.

## Stage 6: the look — a second file, `cast-gwot.gltf` (2026-10-10)

The game's default look (src/scene/look.ts `LOOK.on`; the page: on unless `?look=plain`; headless: off unless `TPS_LOOK=1`) draws the men out of a
SECOND file built by the same builder. `cast.gltf` is untouched: `python3 tools/chars/build_cast.py` still writes it byte for byte.

    python3 tools/chars/build_cast.py --look gwot          # → public/assets/chars/cast-gwot.gltf
    python3 tools/chars/check_cast.py public/assets/chars/cast-gwot.gltf
    bun run tools/qa/probes.ts cast                        # cast-file and cast-fit run on BOTH files; cast-look holds the switch

Same contract (32 parts, eleven slots, 14 variants with the SAME names on the same sides in the same order, so `src/game/cast.ts` deals a man the same
variant name under either look). What differs:

- **Operators** keep their part lists. `helmet` is `part_helmet_gwot()`: the same high-cut shell plus two side rails, a counterweight pouch on the back
  and a marker-light block. Their 2010s read is mostly COLOUR (src/render/charMaterials.ts `CHAR_MATS_LOOK.operator`): tan-khaki uniform, ranger-green
  carrier / pouches / belt / packs and helmet, coyote boots, tan-brown gloves and knee pads.
  THE PAIR MARKING is small in this file (`part_helmet('gwot')`, `part_op_suit('gwot')`; measured on the game-camera sheet it is 3–5 % of an operator's
  pixels, where the plain file's band + stripe + brassards + shoulder panels are 10–18 %): ONE solid panel on the crown, 11 × 10.6 cm (`crown_panel`,
  `CROWN_HALF`; the shell is 22 × 27 cm from above, so the shell's own colour is left as a rim of half the radius), a 2.5 cm cat-eye band across the back
  of the shell (`cat_eye`, 12.5 cm wide), and a 10 × 8 cm patch on the top of each deltoid (the three columns of the arm tube round its top, x .20–.29)
  in place of the ring round the arm. No stripe, no band round the helmet, no panels on the shoulders of the vest. Its colour is the pair's `tint2`
  dusted (× 0.8, a fifth of the suit's cloth mixed in).
- **Defenders** are re-dressed. Nine parts of the plain file are dropped (`cap_ball hat_boonie hat_straw bandana shirt_loose tank_top jacket_open bandolier
  trousers_jeans`) and nine new ones take their bits:
  `local_suit` (a knee-length loose shirt with curved shirt-tail hems rising at the hips, a band collar and long loose sleeves, over loose trousers
  gathered at the ankle; slot `cloth_plain`) · `waistcoat` (`cloth_uniform`) · `patu` (a shawl worn as a band a forearm wide: across the back of the shoulders, over both of them and the caps of both
  arms, its ends down the chest — one to the hip, one a hand under the collar bone; `lens`) · `scarf` (a shemagh round the neck with its triangle on the chest; `lens`) · `pakol` (flat wool cap with a rolled band;
  `helmet`) · `turban` (wrapped, with a tail down the back; `accent`) · `kufi` (`accent`) · `beard_full` (`rubber`) · `sandals` (skin foot, `metal_dark`
  sole, `boot` straps). `chest_rig`, `shoes`, `boots_low`, `hair_*`, `moustache` are the plain file's.
  The five: pakol + waistcoat + beard · turban + chest rig + beard + sandals · kufi + shawl + sandals · bare head + shemagh + chest rig + beard ·
  pakol + shemagh + waistcoat. All five stand on the one `human` build (the plain file's wiry / big builds went with the tank top and the open jacket).
- **Slots re-used for cloth**: the shawl and the shemagh ride `lens`, the turban and the kufi `accent` — slots no other defender part uses — so each takes
  its own pick from its own palette (`CHAR_MATS_LOOK.defender`). Under `?nocharmats` (the flat placeholder colours) `lens` is the placeholder's dark green.
- **Budgets**: union 41,818 triangles / 32,194 vertices (45,000 / 65,536); variants 8.5–11.9 k (14,000).
- Responders and civilians: the same parts, the same colours.

Look sheets of this file: `CAST_GLTF=<repo>/public/assets/chars/cast-gwot.gltf TPS_LOOK=1` in front of tools/chars/look's two steps (dump_look.ts reads
the tables the switch selects; render_look.py refuses a look.json of another cast). Page stills: `QUERY=look=plain` in front of look-stills.cjs gives the
'before' off the same served tree.

Still rough: the shawl lies as close as a yoke (no hanging fold, and where a man's pick of wrap is near his shirt's colour it is hard to see at all); the turban is a smooth dome with shallow ridges; the shirt's hem does
not swing (it is skinned to the thighs); nobody has a rolled sleeve.

### The goggle mount on the operators' helmet (for two-tube goggles; the tubes are NOT modelled here)

DRESS ONLY: what is in the hands and on the heads (rifles, pistols, goggles) is not this file's. The helmet (`helmet`, both cast files, every operator
variant) carries a brow plate — the shroud — rigid to `DEF-head`: a 4.8 × 4.4 cm block 1.4 cm thick on the shell's centre line (`part_helmet()`,
"NVG mount plate"), with nothing of the helmet in front of its outer face (`probes.ts cast-look` holds that, in both files).

**The plate is at the SAME place in both files**: `part_helmet_gwot()` is `part_helmet()` with the look's marking, plus the rails, the pouch and the light, so the shell,
the brow and the plate of `cast-gwot.gltf` are `cast.gltf`'s to the vertex, and the two files' `DEF-head` bind matrices are the same. Goggles hung
off the head bone at `RIG.goggles` sit on the look's helmet exactly as they sit on today's.

The centre of its OUTER FACE, the point to hang a goggle arm on (the same numbers for `cast.gltf` and `cast-gwot.gltf`):

| frame | position (m) | facing (unit) | the plate's own up (unit) |
|---|---|---|---|
| model space, bind pose (x the figure's left, y up, z ahead) | (0, 1.775, 0.142) | (0, 0.469, 0.883) = 28° above straight ahead | (0, 0.883, −0.469) |
| the game's head frame (rigProps `gogglesBoxes`: origin `c.bones.head` = the `DEF-head` joint, x side, y up, z ahead, turned by `c.headRot()`) | (0, **+0.206 up**, **+0.137 ahead**) | (0, 0.469, 0.883) | (0, 0.883, −0.469) |

(`DEF-head`'s bind origin is (0, 1.5687, 0.0051); its own axes sit 1.9° off the model's about x, which the game's head frame does not use.)
The plate's face is 4.8 cm wide (x) and 4.4 cm tall along its own up. The helmet's rim is below it; above it, in the plain file the pair-colour stripe starts, in the look's the shell runs bare to the crown panel.
Today's goggles: the rig's box pair (`RIG.goggles`, `on` 0.105 ahead / 0.1 up, `off` 0.075 ahead / 0.185 up of the same head origin) and the mesh part
`nvg_up` (a flipped-up pair with an arm to this plate, drawn only on an operator the game gives no goggles — anim/gltf.ts `castGoggles`); a new pair
replaces either without touching the helmet.
