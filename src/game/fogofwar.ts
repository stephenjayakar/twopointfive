// FOG OF WAR — a try at the Door Kickers rule on this engine (Game.fogOfWar, __fow, ?fow / ?nofow, Tab ▸ Sandbox ▸ Fog of war): what nobody on Sam's TEAM can see
// is taken out of the picture. Off (the default outside the room-clear flag) nothing here runs: update() returns on its first line, filter() hands the list back,
// hidden() says false, and the renderer's pass is never dispatched — the game and the frame exactly as they were.
//
// THE CALLS MADE (the maintainer said 'maybe we could try' and not what it hides or whose sight lifts it — each is his to overrule):
//   1. SIGHT IS SHARED BY THE TEAM: Sam and every living operative (teams.ts), each an EYE at his head (for the picture's mask: over his feet at a nominal height for his stance — FogEye.at). A dazzled operative (magnesium in his eyes) is no eye
//      while it lasts; Sam's stays even once he is down (the screen does not go dark on the man playing).
//   2. SIGHT IS THE GAME'S OWN TEST, not a second model and not light: guards.ts eyeContact — the one line-of-sight test every eye on the floor takes (nothing
//      solid, a static or a door leaf, between the eye and the man's chest AND his head; glass passes) — then the smoke marched along the same line by the
//      renderer's probe through Game.sensors (the guards' own threshold: under 0.3 he is lost in the plume). No reach limit and, by default, no cone: every eye
//      sees all round (FOG.fovDeg narrows it to a wedge about where chest and head point, with a near field of FOG.nearM all round — the knob is there to try).
//      How dark the room is plays no part: the picture already shows dark as dark.
//   3. A MAN NOBODY ON THE TEAM SEES IS NOT DRAWN, with what he carries: no skin instance, none of his shadow / reflection proxies, no gun, torch body or
//      laser, no marker or speech bubble over his head. He stays drawn FOG.linger seconds past the last frame he was seen (an edge of a door frame does not make
//      him flicker). A BODY is drawn from the moment the team has seen it lying there (or saw the man go down) and stays drawn: the dead do not move.
//      A MAN THE SQUAD IS SHOOTING AT is in the picture for FOG.squadFireSecs after a teammate's last aimed round at him, whoever's eyes lift the fog
//      (FOG.squadFire, below): drawn like a man lingering — no laser — and never 'seen' for anything that asks seen().
//      NOT hidden: the LIGHT he carries (a weapon light is light — it falls where it falls, and the meter and the other men's eyes read it), his rounds'
//      tracers, muzzle flashes and impacts, anything he dropped, and every sound he makes.
//   4. FLOOR AND WALLS OUTSIDE THE TEAM'S COMBINED SIGHT STAY VISIBLE, dimmed and desaturated (render/fogofwar.ts + shaders/fogofwar.wgsl: per pixel, a ray
//      from each eye through the renderer's own trace grid in plan at eye height — the same boxes and leaves the CPU test walks). Smoke does not cut the
//      floor's mask (the plume is itself drawn); it only hides men. The native (Metal) build does not have the pass: there the men are hidden and nothing is dimmed.
//   4b. A DOOR IN THE FOG IS DRAWN AS THE TEAM LAST SAW IT (FOG.doors; the maintainer after playing: 'seeing doors open within fog of war … gives them away'):
//      a leaf that moves where no eye has a line to it — nor to the place it is drawn standing — stays in the picture at the angle it was last seen at, and
//      comes up to date the frame somebody sees it (or the place). The REMEMBERED leaf is what the renderer is handed: its shadow, the light it keeps in, the
//      cursor's pick and the dimmed floor's own rays all go by the door as drawn (so a torch swung through a door opened unseen does not spill past the leaf the
//      picture still shows shut). Everything the CPU decides — collision, sight, sound, rounds — goes by the real leaf, as ever.
//   4c. AN ENEMY'S LASER IS DRAWN ONLY WHERE THE TEAM HAS A LINE TO IT (FOG.lasers; the same note: '… or enemy's lasers'): a man nobody sees never showed his
//      beam, but a man one teammate had a sliver of drew all of it — a red line across fogged floor, pointing back at him. Now only the stretches of the beam
//      some eye has a clear line to are drawn (and the dot only if its end is one), and none of it for a man who is only lingering in the picture.
//   4d. A LOOSE THING THAT MOVES OUT OF THE TEAM'S SIGHT STAYS WHERE IT WAS LAST SEEN (FOG.things; the maintainer: 'seeing the furniture move in rooms behind fog
//      of war also gives away information' and 'curious if there's a better systems approach to make it so fog of war doesn't leak information'). THE SYSTEMS
//      ANSWER: one invariant — a pixel nobody on the team sees is made only of the static level and of things as the team last saw them; nothing live enters
//      it — held at the places the picture's inputs come in, not kind by kind. GEOMETRY comes in at one place, the frame's list of dynamic boxes handed to the
//      renderer (game.ts), and things() stands there: a keyed thing (furniture, a dropped or thrown item, debris, a look piece) is handed over live only where
//      an eye sees the floor it is on; moved unseen, the picture keeps the boxes it had when last seen at rest; a thing nobody has seen, one last seen in
//      flight, and one whose remembered place is looked at and found empty are not in the picture; unkeyed one-frame boxes (flash, tracer, spark, shell) only
//      where seen. Men and what they carry, door leaves (4b), wall devices and the moths keep their own rules. The list is rewritten in place, so the picture,
//      its shadows, the cursor's pick and every other reader of world.dynamics go by the thing as drawn; collision, sight, sound and rounds go by the real one.
//   4e. THE FOG HAS ITS OWN LIGHT (FOG.flat; 0 = off = as it was, the frozen stand's; on in the page since 10-13, when a guard's torch showed in the fog). RADIANCE comes in at the fog pass: with a level set, an
//      unseen pixel is the surface's paint under one fixed light instead of the live frame dimmed — so no lamp, weapon light, flash, smoke, beam or particle
//      in the fog shows. NOT HELD YET: edits to the static level made unseen (marks, a wall or a pane coming apart) show at once.
//   4f. THE FOG IS LIT AS THE TEAM LAST KNEW IT (FOG.lit; under 4e's own light, which is then its fill — the maintainer, 10-14: 'fog of war looks very flat' ·
//      'would be nice for it to have some RT lighting, maybe just based on last known state'). With it on an unseen pixel is still the paint alone, but the
//      light on it is traced in the fog pass from a list this module makes (litBlock): the level's own fixtures — a lamp, a panel, a lit sign — each ON OR
//      OFF AS THE TEAM LAST SAW IT (first met: as the building stands; a lamp shot out, switched or knocked out where nobody looks stays as remembered until
//      the team has a look at it — lampSeen: the floor under it, the fixture itself, or floor it lights), the mains as they are (the trip and the reset are
//      told to the whole floor), and the sun or moon. Shadows fall from the boxes as handed to the picture — the statics, the leaves and the loose things
//      where the team last saw them — never from a man or what he carries. The fixed light, lower, is the fill: a corner, the foot of a wall and the floor
//      under a table lose most of it, so a dark room is readable and darker than a lit one. No torch, weapon light, flash, beacon or lightning is in the list.
//   4g. THE FOG GETS THE FULL PICTURE, LESS WHAT THE TEAM SHOULD NOT SEE (FOG.full, over 4e / 4f — the maintainer after looking at 4f, 10-14: 'fog of war still looks
//      really bad. we should find a way to have it get the full visual pass but just hide things (like flashlights) that shouldn't be visible to the player').
//      With it on an unseen pixel is the LIVE FRAME dimmed and greyed again — every pass of the renderer, its bounce, its soft shadows, its air — and what must
//      not show there is taken out WHERE IT IS MADE, not painted over afterwards: each light is uploaded with a class (lights.ts LightSet.fogClass, from the team
//      this module hands it every frame — fullBlock; decided at the upload, so a flash born after the fog's turn is classed on its first frame) that the
//      renderer asks at every place it evaluates a light (common.wgsl evalLight → lightFogK), of a table of where the team sees that the renderer writes at the
//      head of the frame from this frame's eyes (render/fogofwar.ts FogSight; the fog pass's own rule, by bearing, its own ray walked wherever the table is in doubt).
//        class 1, 'only where the team sees': every light a man carries who is not on Sam's team (torch, weapon light), and every flash and timed light that is
//                 not a teammate's own (a muzzle flash, a bang, a blast, a lamp bursting). It still falls on floor the team DOES see — a torch swung through a
//                 doorway lights the seen side of it — and gives nothing to the picture of a place nobody watches: no pool, no beam in the dust, no bounce
//                 off a wall nobody sees, no glint.
//        class 2, 'only where it does not': a lamp that is OUT but that the team last saw lit (4f's memory — lampKnown) is still lit in the picture of the room
//                 nobody has looked into since; a lamp that is LIT but remembered out is class 1. The mains follow at once (told to the whole floor).
//        no class: the level's own lamps as they stand, the sun, the moon and the lightning, the team's own lights.
//      WHAT IS NOT LIGHT goes by the same table: with FOG.air off the picture's march of the smoke takes no density over floor the team does not see
//      (common.wgsl fogSmoke — volumetrics.wgsl and its dust twin; with it on, as the page has it, a plume is drawn wherever it stands), and a spark, a puff, a chip, a case, a sheet or a shard there is not drawn (particles_draw.wgsl; the weather's
//      drops stay: the same everywhere). Shadow rays and the game's readings take the smoke as it is.
//      The game's own readings of light (the meter's direct term, the guards' eyes — probe.wgsl) take the lights as they ARE. NOT PICTURE ONLY ON A GPU,
//      though: the BOUNCE the meter adds is read from the picture's cascades, which hold class 1 as the picture has it — a torch on a wall nobody on the team
//      sees (with the cone on: the wall behind Sam, past his near field) bounces nothing onto him in the guards' reading, so he reads a little DARKER than he
//      is. Never brighter: a remembered lamp (class 2) is kept out of the cascades (common.wgsl directIrradiance). Size never measured (no GPU here).
//      FOG.fullFill adds 4e's fixed
//      light, corner-shaped as 4f's fill, on top of the dimmed frame (0 = none: a room with no lamp lit is as dark in the fog as it is).
//      UNTIL THE TABLE IS LIVE (its program compiling on the first fogged frame; or never, should it fail) nothing can be cut, so the pass draws 4f's fog —
//      whose rows this module fills all the same (FogFrame.sight, the renderer's word).
//      NOT HELD: a fixture's own glowing FACE follows the lamp as it is — a tell both ways (shot out unseen: the room stays lit, its panel is dark; switched
//      on unseen: the room stays dark, its panel glows; the upload knows which marking a light stands for — RtLight.markRef — a later mend); marks and a wall coming apart
//      unseen show at once (4e's line); a seen wall an enemy's torch lights bounces into the fog beside it, as the light the team does see would.
//   5. SOUND COMES THROUGH AS TODAY. Nothing here touches hearing or the mixer. A line a hidden man SPEAKS goes to the log (guards.ts say, civilians.ts civSay:
//      the road an off-screen man's line takes) instead of a bubble over the spot where he stands.
//
//   6. ON HARD AN EYE IS A CONE (FOG.cone — difficulty.ts writes it with the level: HARD.cone; ?fogcone / ?fogcone=0 or the Tab row for a visit; the maintainer after playing:
//      'fog of war being 360 degrees around the players isn't quite realistic. it really should just be the cone they're looking at', then 'i think the status
//      quo is fine for normal difficulty' / 'but we should have more realistic vision cones on hard'): each eye sees FOG.coneDeg about where his chest and head
//      point and FOG.coneNearM all round him (what is at a man's shoulder he knows of), in place of fovDeg / nearM. Everything above goes by the cone: a man
//      behind every teammate's back is not drawn, a leaf that moves behind them is remembered where it stood, the floor there is dimmed — the picture shows which
//      flanks the team is watching. In the picture the wedge's edge comes in over FOG.coneSoftDeg (and the near field's over FOG.coneNearSoftM); the men are in
//      or out on the cone's own line. Standard never raises the row: every eye all round, as it was.
//   6b. ONLY THE PLAYER'S OWN EYES (FOG.own — an OPTION, off; the Tab row is kept per machine (teamfeel.ts), ?fogown / ?fogown=0 for a visit; his next lines:
//      'and maybe you should only see what your character does, not even your teammates' · 'we can make it an option and see how it feels'): the teammates are
//      no eyes — what they see and he does not is out of the picture. On any level of difficulty (with the cone: his own cone alone; without: all round him
//      alone). Hard ships with the team's eyes shared (the picture then shows the flanks nobody watches, which is the Door Kickers read).
//   7. WHAT THE CONE HIDES IS CALLED (FOG.calls; his next line: 'we'll need telegraphing with sound and dialogue to make it work on harder difficulties'). Only
//      while eyes are cones or the player's own alone — the all-round team fog says nothing new. A TEAMMATE says it, a bubble over him and a row on the radio
//      strip that squelches as it arrives (cues.ts call(): the Cues object's own bubble and rows — never Guard.bubble, which the bark clocks and the digest read):
//        contact   he has a living enemy in HIS eyes (the fog's own line and cone, off his own head) whom the player's own eye has not had these `callKnown`
//                  seconds: 'contact left!' / 'right!' / 'behind!' / 'front!' in the player's own room (sides off the way the PLAYER's man looks), else the
//                  place by the level's own room names — 'contact — in the mess!', 'behind us — contact in the hall!'
//        heard     an enemy's footfall reached him (roomfight.ts's own ears: the step he turns his head to) from a man NOBODY's eye has: 'movement behind us —
//                  the hall!' / 'steps — the mess!'
//      One call a man every `callSecs`, the floor `callGap` apart. The SOUND is the game's own, as rule 5 has it: a hidden man's footfalls, shots and doors play
//      placed and muffled by the walls between exactly as a seen man's do — the cone takes the picture of him, never the sound.
//
// ONE FUNCTION: seen(gd) is the answer per character for this frame — the picture reads it (drawn / hidden / filter), and anything else may (an order menu
// greying out a target, an AI that should not be told what its side cannot see). Nobody's perception, fire or movement reads it: the fights digest the same with
// it on (probes.ts fog-identity). What DOES differ with it on, all of it by design or by consequence of a man not being in the picture:
//   · Sam's reticle does not snap to a hidden man under the cursor (player.ts updateAim — a ring finding men in a dark room was the fog's own leak), the
//     interaction list offers no row on him or on a body the team has not seen (buildInteractables), another man's laser is not cut short on him (combat.ts
//     laserBoxes), and Sam's creeping carriage near a man (game.ts, presentation) does not start for one he cannot see;
//   · a hidden man's spoken line takes the log (above);
//   · it asks the probe for smoke along the team's sight lines (≤ 6 segments a frame, queued LAST — flushAsks — so they are the ones dropped when the table is
//     full; the switch and FOG ride in an F10 journal's knobs, so a recording made under it replays);
//   · in the page a hidden man's shadow / reflection proxies and rig boxes are out of the scene, so the light meter no longer has his shadow in it and a CPU
//     ray (a tripwire beam's end, the cursor's aim point) no longer meets his gun. Small, real, and invisible to the headless probes.
//
// (src/game is one import cycle: nothing below is built from another game module's exports at module load — the knobs are a plain literal.)
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard, LightTarget } from './game';
import { type RtLight, packLight } from '../render/lights';
import type { Character } from './character';
import { isHostile } from './teams';
import { placeName } from './dialogue';
import type { Door, Doors } from './doors';
import { type Box, BoxFlag, MKEY } from '../scene/boxes';
import { type FogFrame, makeFogFrame, FOG_EYES, FOG_LIGHTS } from '../render/fogofwar';
import { WAND, WAND_STATS, wandEye } from './wand';
import { mateWandEye, mateWandEyes } from './wandorder';
import { peekEye } from './peeksight';
import { STICKY_STATS, stickyEyes } from './stickycam';
import { toldLastSeen } from './told';   // (called inside lastSeen() only)
import { runnerNobody } from './runner';   // (asked inside a tick only: false with its switch off)
import { gpuFx } from './particleFx';   // (called inside begin() / done() / hush() only)

/** The knobs (Tab ▸ Sandbox ▸ Fog of war, __fow.knobs; read every frame). */
export const FOG = {
  /** how far down the unseen floor and walls are pushed: radiance × this … */
  dim: 0.4,
  /** … and how far toward grey (0 = colour kept, 1 = grey). 0 since 10-15 — the maintainer, on a replay of the mouse hole: 'given how pretty the game is, i think
   *  having fog of war mute the colors is unfortunate' (was 0.75: ?fogdesat=0.75 puts it back, ?fogdesat=share another). The picture only. Never seen on a GPU */
  desat: 0,
  /** each eye's field in plan, degrees (360 = all round — the default; under it a wedge about where his chest and head point) */
  fovDeg: 360,
  /** with a wedge: inside this many metres he sees all round regardless */
  nearM: 2,
  /** THE CONE (hard's fog: difficulty.ts setDifficulty writes this row from HARD.cone with the level; ?fogcone / ?fogcone=0 for a visit; the Tab row flips it
   *  live): every eye sees a wedge of `coneDeg` about where he looks with `coneNearM` all round him, in place of fovDeg / nearM. false = as it was */
  cone: false,
  /** … the wedge, degrees in plan (a man's two eyes together take in about 120°; the defenders' own cone is 116° — guards.ts GUARD_EYE) */
  coneDeg: 120,
  /** … and the all-round near field, metres (a man knows what is at his shoulder) */
  coneNearM: 1.5,
  /** the PICTURE's edges under the cone: the dimming comes in over this many degrees across the wedge's edge (0 = a hard line, as fovDeg's wedge has) … */
  coneSoftDeg: 12,
  /** … and over this many metres outward from the near field's rim */
  coneNearSoftM: 0.6,
  /** ONLY THE PLAYER'S OWN EYES lift the fog: the teammates are no eyes (false = the team's sight is shared, as it was). An option on any level of difficulty:
   *  the Tab row is kept per machine (teamfeel.ts), ?fogown / ?fogown=0 for a visit */
  own: false,
  /** THE TEAM CALLS WHAT THE CONE HIDES (only while `cone` or `own` is up): a teammate with eyes on an enemy the player's own eye has not, or with a step in his
   *  ears from a man nobody sees, says where — a bubble over him and a row on the radio strip. false = nobody says anything */
  calls: true,
  /** … s before the same enemy is called again · s between any two calls on the floor · s an enemy the player's own eye has just had goes uncalled */
  callSecs: 10, callGap: 3, callKnown: 3,
  /** smoke along the line: transmittance under this and the man is lost in the plume (the guards' own bar — guards.ts eyeContact; 0 = smoke hides nobody) */
  smoke: 0.3,
  /** seconds a man stays drawn after the last frame somebody saw him */
  linger: 0.25,
  /** the picture only: a top face above the eye (a wall's top, a tall cabinet's) is taken as seen when the line reaches within this of it — 0 = wall tops always dim */
  topPad: 0.3,
  /** a door leaf that moves where nobody on the team can see it is drawn where it was last seen (false = every leaf drawn live, as before) */
  doors: true,
  /** A DOOR THE SQUAD WORKS IS SEEN (rule 4b's other half; the maintainer, 10-11: "if teammates open a door to clear a room while you're not looking at it,
   *  their movement is visible, but it looks like they're walking through a closed door. we should be able to see actions that our squad takes"): a leaf with a
   *  living teammate within `squadDoorsM` of it and a line from him to it — or to the place the picture has it standing — comes up to date in the picture
   *  whichever way he and the player are looking, and whether or not his eyes lift the fog (hard's cones, 'only my own eyes'). Only a leaf: no man and no floor
   *  is seen by it. false = only the fog's own eyes bring a leaf up to date, as before. The cursor's ray meets the leaf as drawn, so the frozen harness stand
   *  pins it off (src/host/standup.ts, `TPS_SQUADDOORS=1`); ?squaddoors=0 for a visit */
  squadDoors: true, squadDoorsM: 2,
  /** A MAN THE SQUAD IS SHOOTING AT IS IN THE PICTURE (the maintainer, 10-11: "in fog of war mode we should still see enemies when your squad is actually
   *  shooting at them. otherwise it feels a bit weird to see them shooting at nothing"): the man a teammate has just put an aimed round at — the room
   *  fight's own count of his rounds and the man they were for — is drawn, with what he carries, for `squadFireSecs` after the last of them, whoever's eyes lift
   *  the fog and whichever way they look ('only my own eyes'; a teammate past the fog's eyes, FOG.eyes; a line a plume shuts by the fog's bar). ONLY that man and only
   *  while the rounds go: no floor is lit by it, nobody else is shown, a gun held on a man without firing shows nobody. He is DRAWN, not SEEN: seen() and
   *  everything that asks it are as they were (his laser stays out, the calls still call him, no AI learns anything); what asks hidden() takes him as it takes a
   *  man lingering in the picture — the reticle, the rows, his bubble. If the rounds drop him the body stays in the picture (he was watched going down). false =
   *  only the fog's own eyes put a man in the picture, as before. NOT COUNTED, by choice: rounds put into COVER a man is behind (coverfire.ts: no target, the
   *  cover is what the rounds meet and nobody has a line to him), a blind burst, a drill's own staged exchange. The reticle can take a man the rule draws, so the frozen harness stand pins it off
   *  (src/host/standup.ts, `TPS_SQUADFIRE=1`); ?squadfire=0 for a visit */
  squadFire: true, squadFireSecs: 1,
  /** an enemy's laser is drawn only along the stretches the team has a line to, and not at all for a man who is only lingering (false = a drawn man's whole beam, as before) */
  lasers: true,
  /** NOTHING MOVES IN THE FOG (rule 4d): every loose thing in the picture's list — furniture, things dropped or thrown, debris, one-frame effects — is handed to
   *  the renderer live only where the team sees the floor it is on; out of sight it is drawn where it was last seen at rest, or not at all (false = the list as it
   *  was: a chair dragged in a room nobody watches moves in the dimmed picture). The cursor's ray meets the list as handed over, so the rule can turn Sam's
   *  facing a few degrees: the frozen harness stand pins it off (src/host/standup.ts, `TPS_FOGTHINGS=1`) so stored tallies reproduce */
  things: true,
  /** THE FOG'S OWN LIGHT (rule 4e; the picture only): > 0 = a pixel nobody on the team sees is the building's paint under one fixed light at this displayed
   *  level — nothing of the LIVE frame is in it: no lamp or weapon light coming on in a room nobody watches, no muzzle flash, tracer, smoke, beam
   *  or particle there. 0 = the live frame dimmed and greyed, as it was: a guard's torch in a room nobody watches lit that room's floor in the fog and gave him
   *  away (the maintainer, 10-13: 'you can see enemies flashlights in fog of war'). ON in the page since then at FOG_FLAT_ON — on software-adapter stills
   *  of the mouse hole the level at which a lamp-lit room nobody sees is as bright as the old fog had it (0.2 was 40% brighter). ?fogflat=0 = the fog as
   *  it was, ?fogflat=level another level; the frozen harness stand pins 0 (src/host/standup.ts, `TPS_FOGFLAT=1`). THE COST: a DARK room nobody sees is
   *  the same grey as a lit one (it was black), so on a night map the fog can be brighter than the ground the team stands on. Never seen on a GPU: the
   *  level, and whether the fog should rather keep dark rooms dark, are the maintainer's to judge */
  flat: 0.12,
  /** THE FOG LIT AS THE TEAM LAST KNEW IT (rule 4f; the picture only; read only while `flat` > 0 — with that at 0 the fog is the live frame dimmed, whatever
   *  this says): > 0 = an unseen pixel is its paint under the level's own lamps as the team last saw each (their light × this × `dim`, with shadows from the
   *  picture's own boxes) + the sun or moon + `flat`'s fixed light as a fill. 0 = `flat`'s one fixed light alone, as it was (?foglit=0; the frozen stand
   *  pins 0 — src/host/standup.ts, `TPS_FOGLIT=1`, with `TPS_FOGFLAT=1`). ON in the page since 10-14 at FOG_LIT_ON. Never seen on a GPU: the levels, the fill
   *  and what a never-seen room should look like are the maintainer's to judge */
  lit: 1,
  /** THE FULL PICTURE UNDER THE FOG (rule 4g; the picture only): true = an unseen pixel is the live frame dimmed (`dim`, `desat`) with the lights the team should
   *  not see there cut where the renderer evaluates them — `flat` and `lit` are then not what draws the fog. false = `flat` / `lit` as they were (?fogfull=0; the
   *  frozen stand pins it off — src/host/standup.ts, `TPS_FOGFULL=1`). ON in the page since 10-14. Never seen on a GPU */
  full: true,
  /** THE AIR IS THE PLACE (the picture only; under `full` alone — it rides the sight table): true = the solver's smoke is drawn over floor the team does not see
   *  too, dimmed with the ground behind it on the screen — a fire's plume, a grenade's cloud (the maintainer, 10-23, on a fire with no flame in the fog:
   *  'I think we should at least show everything in the environment visible at the start of the level all the time?'). What a hidden MAN breathes, smokes or fires
   *  is not filed with the solver at all (snowBreath.ts, smokebreak.ts and combat.ts ask the fog at the source — airHides below), and a hidden light still gives
   *  a plume nothing (lightFogK). The puffs the PARTICLES draw (a blast's dust ring, a round's chip of plaster) are `ours`'s, below: particles_draw.wgsl. false = the
   *  march takes no density over unseen floor, as it was (common.wgsl fogSmoke). ON in the page since 10-23 (?fogair=0 puts it off; the frozen stand pins it
   *  off — src/host/standup.ts, `TPS_FOGAIR=1`). Never seen on a GPU */
  air: true,
  /** THIN THINGS THAT STAND FREE DO NOT CUT THE FOG'S SIGHT (the maintainer, 10-23, of a taken room on The Pass: 'weird vertical striations due to fog of
   *  war + squad's vision'): every static stopped the fog's eye — the squad's own lines (segmentBlocked) and the picture's ray (occludedTBoxes) — so a
   *  stovepipe, a window's bar or a lone post each threw a sliver of 'not seen' across the room behind it, and with men looking in through barred windows
   *  the floor was fans of seen and unseen. With this the statics a level marks as thin and free (scene/thin.ts thinLevel: under 25 cm both ways in plan,
   *  nothing beside them — never a door's jamb or stop, never a wall's end) are passed by BOTH: the fog's own lines here (`sightBlocked`: to a man, a body,
   *  a spot, a door, a lamp) and, under `full`, the picture's fog eye (render/fogofwar.ts FogFrame.thinBits → common.wgsl fogThinBox), which then also
   *  passes what another man carries — a box the squad's own lines never met. It is the FOG's sight alone: a guard's eye, a round, a sound and a shadow
   *  meet those boxes as ever. Not the picture alone: who the squad has seen can differ behind a pipe, so a run's digest can. false = every static stops
   *  it, as it was (a teammate's own eye passes them too under `mates`, below). ON in the page since 10-24 (?fogthin=0 puts it off; the frozen stand pins it off — src/host/standup.ts, `TPS_FOGTHIN=1`). Never seen on a GPU */
  thin: true,
  /** HOW MANY EYES LIFT THE FOG (the fourth of the fog's principles: to see more, get more eyes on it): Sam, the living teammates in list order, then a
   *  sticky camera's feed, then a tutorial's lookout or a step's own eye — as many as this. 5 until 10-24: a squad of four filled it, so a camera that sent
   *  was 'drawn, blind' (stickycam.ts STICKY_STATS.blind) and a lookout had no place. 7 = the room the renderer's block and its sight table have
   *  (render/fogofwar.ts FOG_EYES; fogEyeCount below: under five is five, over seven is seven). Not the picture alone: an eye more is a man more the squad may have seen. 5 = as it was. 7 in the
   *  page since 10-24 (?fogeyes=5 puts it back; the frozen stand pins 5 — src/host/standup.ts, `TPS_FOGEYES=1`). Never seen on a GPU */
  eyes: 7,
  /** WHAT OTHERS LEFT BEHIND STAYS AS THE TEAM LAST SAW IT (the third of the fog's principles; the picture alone, under `full`): (1) a lamp the team has in
   *  another state than it is in keeps its FACE that way too — the fog already lit the room by a lamp put out unseen while its ceiling panel went dark at
   *  once (Box.fogEmit, which the upload alone reads: the game's Box.emissive is the real lamp's); (2) a case, a chip or a leaf of paper at rest that the
   *  team has seen lying there stays in the picture when they look away (render/fogofwar.ts FogFrame.kept → shaders/particles.wgsl), where it used to be
   *  cut and come back. false = both as they were. ON in the page since 10-24 (?fogkept=0 puts it off; the frozen stand pins it off —
   *  src/host/standup.ts, `TPS_FOGKEPT=1`). Never seen on a GPU */
  kept: true,
  /** A CHECKPOINT CARRIES WHAT THE FOG HOLDS (principle 3 through a load: a load's restart forgets all the fog knew, so the picture after it had every door,
   *  lamp and chair as it stands — what a man did unseen, told by a load). true = a save files what the picture has another way than the world stands (a
   *  door's shown angle, a lamp's known state and face, furniture where it was last seen or left out — FogOfWar.snapshot → savestate.ts SaveState.fog) and a
   *  load hands it back (restore). false = no key in the file and none read: the build as it was. NOT the picture alone (the remembered leaf and chair are
   *  what the cursor's ray meets, as before the save), so it is no row of the replay page's look. ON in the page since 10-24 (?fogfiled=0 puts it off; the
   *  frozen stand pins it off — src/host/standup.ts, `TPS_FOGFILED=1`) */
  filed: true,
  /** A MAN NOBODY SEES LEAVES HIS TRACKS (principle 3 on snow; the maintainer, 10-23: 'I won't see tracks forming in fog of war, right? but if an enemy off
   *  screen makes tracks and then I see snow, I'll see the tracks?'). true = what a hidden man presses into lying snow (boot prints, the hollow he falls in) is
   *  kept off the prints' map and is there, whole, when the team next sees that snow after having had it out of sight — never shown forming, no snow kicked up
   *  (snowTracks.ts SnowTracks.unseen, by half-metre square; snow the team is LOOKING at while a man it cannot see crosses it stays clean until they look away
   *  and back: his steps one by one would be him). false = a hidden man presses nothing at all, as it was: a guard who crossed a yard unseen left it clean. The picture only. ON in the
   *  page since 10-24 (?fogtracks=0 puts it off; the frozen stand pins it off — src/host/standup.ts, `TPS_FOGTRACKS=1`). Never seen on a GPU */
  tracks: true,
  /** A TEAMMATE SEES WHAT THE PICTURE SHOWS (the maintainer, 10-25, asked whether the men's own eyes should pass thin things as the fog's do: 'i think
   *  teammates should see whatever we see'). Under `thin` the fog's lines pass a static the level marked thin and free while a teammate's own eye (guards.ts
   *  eyeContact) stopped at it: a man behind a window's bar was in the picture, and called, before the teammate standing there could notice or shoot him.
   *  true = an OPERATIVE's own sight line passes what the fog's passes (guards.ts eyeThrough: the marks of scene/thin.ts — a level's, and an opened wall's
   *  bare studs — only while `thin` is on: one mask, `fogThrough`, for the picture and for the men in it), in his sight test, in the room fight's own
   *  lines from his eye to a man (guards.ts eyeBlocked), and in the player's own line that tells the squad's net of a man the picture shows him
   *  (picture.ts lookSam). Sight alone: his rounds still meet the bar (clearShot holds a shot the thing is across; a man with a walk left
   *  walks on, a planted man waits with his gun on him), and no other side's eye changes — the enemy never reads the fog. false = his eye stops at a thin
   *  thing, as it was. NOT the picture alone: who a teammate has seen is the game's. ON in the page since 10-25 (?fogmates=0 puts it off; the frozen stand pins it off — src/host/standup.ts, `TPS_FOGMATES=1`). Never seen on a GPU */
  mates: true,
  /** WHAT THE TEAM DOES IS ALWAYS SHOWN (the picture — and, with it, what the cursor's ray meets: the boxes handed to the renderer; under `full` alone; the maintainer, of the tutorial's wall charge: 'still can't see the wall shot detonate' — the
   *  fog was taken off that mission for it): the flash of a blast one of the team set or threw lights the fog's picture too (lights.ts RtLight.fogBy: its
   *  class is the doer's, as a carried light's is its carrier's), the streak of a teammate's round is drawn its whole length, the rubble the team throws is drawn
   *  on its way down and lies where it fell (things(): debris.ts Chunk.who), and the sparks, dust and chips
   *  of what the team fires or blows are drawn over floor nobody sees (particles.ts Particles.ours → PB_OURS; particles_draw.wgsl). It adds NO EYE: the
   *  room a charge opens is the fog's picture of it, dimmed, and nobody in it is drawn until one of the team has a line. An enemy's blast, round and
   *  sparks are as they were: cut where the team does not see; a round of the team's that stops in a man nobody sees throws nothing up off him (combat.ts hush). false = every flash nobody carries lights only what the team sees, and no particle but the
   *  weather's is drawn there, as it was. ON in the page since 10-23 (?fogours=0; the frozen stand pins it off — `TPS_FOGOURS=1`). Never seen on a GPU */
  ours: true,
  /** … a fill added on top of the dimmed frame: this share of `flat`'s level, corner-shaped by `litAo` / `litAoM` (0 = none — a dark room is dark in the fog) */
  fullFill: 0,
  /** THE FOG'S SOFT EDGE (the maintainer, 10-15, on the pass level: 'fog of war edges shouldn't be so sharp'; the picture only; under `full` alone — it reads the
   *  sight table): the band, in metres, the fog comes in over ACROSS a sight edge — the line a wall's corner casts across open floor — half on each side: the
   *  last quarter metre of what is seen is a little dimmer, the first quarter metre of what is not a little less (it is the fog's own picture there, dimmed
   *  less: nothing hidden is drawn, and a hidden light is still cut on the line). A wall's own face keeps its line; the band is nothing at the corner that casts
   *  the line and widens behind it. 0 = the hard line as it was (?fogedge=0, ?fogedge=metres another band; the frozen stand pins 0 — src/host/standup.ts,
   *  `TPS_FOGEDGE=1`). ON in the page since 10-15 at FOG_EDGE_ON. Never seen on a GPU: the width is the maintainer's to judge */
  edge: 0.5,
  /** … its fill: the share of `flat`'s level that every unseen surface keeps whatever its lamps do (under 1, so a dark room reads darker than a lit one) */
  litFill: 0.5,
  /** … how much of that fill a corner, the foot of a wall or the floor under a table loses (0 = none, and no rays asked) and how far a box shuts it out from (m) */
  litAo: 0.75, litAoM: 1.5,
  /** … a lamp that would add less than this, as displayed, at a pixel is not traced (one under twice it is faded in: no line where a lamp's reach ends) */
  litCut: 0.006,
  /** WHERE HE WAS LAST SEEN: a living enemy who has gone out of the team's sight keeps a fading '?' on the spot he was last seen at for this many seconds
   *  (the HUD's alone: lastSeen() below — nothing in the game reads it). 0 (as it ships) = the 'you're told' lever decides (told.ts: a few seconds on
   *  Standard, longer on Guided, none on Bare or with that lever off, which is no mark, as it was); turned up, this is the seconds on every rung */
  lastSeen: 0,
};
/** the field every eye has this frame, degrees in plan (360 = all round) and its all-round near field (m): the cone's rows under FOG.cone, else fovDeg / nearM */
export function fieldDeg(): number { return FOG.cone ? Math.min(FOG.fovDeg, FOG.coneDeg) : FOG.fovDeg; }
export function fieldNear(): number { return FOG.cone ? FOG.coneNearM : FOG.nearM; }
/** WHERE A MAN LOOKS, for the cone (unit, in plan): where his head points — and, with a long gun in the shoulder and level along his aim, his aim: his eyes are
 *  on his sights (guards.ts canSeeChar's own rule for that; the two are blended over the last of the bore coming level, so the cone does not jump as the gun
 *  comes up). Not the chest: a rifleman stands bladed, his chest some 50° off what he is looking at — which the all-round fog's optional wedge (fovDeg) never
 *  showed and a 120° cone would: all of it to one side of his aim. */
export function gazeOf(c: Character): Vec3 {
  const h = c.headDir(); let x = h[0], z = h[2]; const hl = Math.hypot(x, z); if (hl > 1e-6) { x /= hl; z /= hl; } else { x = Math.sin(c.bodyYaw); z = Math.cos(c.bodyYaw); }
  if (c.alive && c.anim.longShown === 'shoulder') {
    const ax = Math.sin(c.gunYaw), az = Math.cos(c.gunYaw), gl = Math.hypot(c.gunDir[0], c.gunDir[2]);
    const lv = gl > 1e-6 ? (c.gunDir[0] * ax + c.gunDir[2] * az) / gl : 0;   // how level along his aim the bore lies, in plan
    const t = Math.min(1, Math.max(0, (lv - GAZE_SIGHTS[0]) / (GAZE_SIGHTS[1] - GAZE_SIGHTS[0]))), rl = Math.min(1, Math.max(c.anim.rlShown.carry, c.anim.rlShown.head));   // (rl, gunhand.ts longReload: how far a magazine change has his gun off its line and his eyes down at the well — 0 with that rule off)
    const w = t * t * (3 - 2 * t) * (1 - rl * rl * (3 - 2 * rl));   // (…by which the gaze goes back to his head, over the third of a second the gun and the head take: the cone swings, it does not jump)
    if (w > 0) { x += (ax - x) * w; z += (az - z) * w; const l = Math.hypot(x, z); if (l > 1e-6) { x /= l; z /= l; } else { x = ax; z = az; } }
  }
  return [x, 0, z];
}
/** the bore's cosine to his aim over which the gaze goes from his head to his sights (the second is guards.ts SIGHTS_COS, cos 30°) */
const GAZE_SIGHTS = [0.7, 0.866];
/** the calls' sides of the player's man: within 45° of where he looks is his front, past 120° off it is behind him */
const COS_FRONT = Math.SQRT1_2, COS_BEHIND = -0.5;
/** the calls are looked over every this many update()s */
const CALL_EVERY = 6;
/** the level the fog's own light is on at in the page (FOG.flat): what a bare ?fogflat and the frozen stand's TPS_FOGFLAT=1 set */
export const FOG_FLAT_ON = 0.12;
/** the gain the lit fog is on at in the page (FOG.lit): what a bare ?foglit and the frozen stand's TPS_FOGLIT=1 set */
export const FOG_LIT_ON = 1;
/** how far toward grey the fog went until 10-15 (FOG.desat): what a bare ?fogdesat puts back */
export const FOG_DESAT_WAS = 0.75;
/** the band the fog's soft edge is on at in the page (FOG.edge, metres): what a bare ?fogedge and the frozen stand's TPS_FOGEDGE=1 set */
export const FOG_EDGE_ON = 0.5;
/** FOG.eyes as the page has it, and as it was before 10-24 (the frozen stand's, and a recording's from before the key) */
export const FOG_EYES_ON = 7, FOG_EYES_WAS = 5;
/** FOG.eyes as the count the game uses, the one clamp the list, the address and the checks share: from five (as it was) to the room the renderer has
 *  (render/fogofwar.ts FOG_EYES); a row that is no number is five */
export function fogEyeCount(v: number): number { return Number.isNaN(v) ? FOG_EYES_WAS : Math.max(FOG_EYES_WAS, Math.min(FOG_EYES, Math.floor(v))); }
/** ?fogown / ?fogown=0 · ?fogcalls=0 — the two options for a visit, over the kept rows (the Game's constructor, right after teamfeel.ts has read those back;
 *  no page — the harness — nothing) */
export function fogFlags() { try { const q = new URLSearchParams(location.search); if (q.has('fogown')) FOG.own = q.get('fogown') !== '0'; if (q.has('fogcalls')) FOG.calls = q.get('fogcalls') !== '0';
  if (q.has('fogflat')) { const v = parseFloat(q.get('fogflat') ?? ''); FOG.flat = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : FOG_FLAT_ON; } if (q.has('foglit')) { const v = parseFloat(q.get('foglit') ?? ''); FOG.lit = Number.isFinite(v) ? Math.min(4, Math.max(0, v)) : FOG_LIT_ON; } if (q.has('fogfull')) FOG.full = q.get('fogfull') !== '0'; if (q.has('fogair')) FOG.air = q.get('fogair') !== '0'; if (q.has('fogours')) FOG.ours = q.get('fogours') !== '0'; if (q.has('fogthin')) FOG.thin = q.get('fogthin') !== '0'; if (q.has('fogkept')) FOG.kept = q.get('fogkept') !== '0'; if (q.has('fogfiled')) FOG.filed = q.get('fogfiled') !== '0'; if (q.has('fogtracks')) FOG.tracks = q.get('fogtracks') !== '0'; if (q.has('fogmates')) FOG.mates = q.get('fogmates') !== '0'; if (q.has('fogeyes')) { const v = parseInt(q.get('fogeyes') ?? '', 10); FOG.eyes = v === 0 ? FOG_EYES_WAS : !Number.isFinite(v) || v === 1 ? FOG_EYES_ON : fogEyeCount(v); } if (q.has('fogdesat')) { const v = parseFloat(q.get('fogdesat') ?? ''); FOG.desat = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : FOG_DESAT_WAS; } if (q.has('fogedge')) { const v = parseFloat(q.get('fogedge') ?? ''); FOG.edge = Number.isFinite(v) ? Math.min(1.5, Math.max(0, v)) : FOG_EDGE_ON; } if (q.has('fogthings')) FOG.things = q.get('fogthings') !== '0'; if (q.has('squaddoors')) FOG.squadDoors = q.get('squaddoors') !== '0'; if (q.has('squadfire')) FOG.squadFire = q.get('squadfire') !== '0'; if (q.has('fogdesat')) FOG_PAGE.desat = FOG.desat; if (q.has('fogedge')) FOG_PAGE.edge = FOG.edge; if (q.has('fogair')) FOG_PAGE.air = FOG.air; if (q.has('fogkept')) FOG_PAGE.kept = FOG.kept; } catch { /* no page */ } }
/** THE FOG'S LOOK ON THIS PAGE (`desat`, `edge`, `air`: the picture alone — NOT `ours`: what it hands the renderer is what the cursor's ray meets, so a tape keeps its own), as the module ships it and the address words change it (fogFlags) — never what a tape's knob
 *  tables laid over FOG. THE ENGINE REPLAY SHOWS A TAPE UNDER THIS, not under the look the tape was recorded with (FogOfWar.pageLook, which it alone calls):
 *  the maintainer judged both on a replay, and a recording from before either would otherwise show the old fog for ever. The tape's own values still ride its
 *  knobs — the harness replays them as recorded (journal.ts applyKnobs: a file from before `edge` replays with the hard line). A tape from before the full
 *  picture (FOG.full off in its tables: no sight table) keeps its hard line and takes the colour only: `full` is not the picture alone, so it is the tape's. */
const FOG_PAGE = { desat: FOG.desat, edge: FOG.edge, air: FOG.air, kept: FOG.kept };
/** a leaf this far (rad) from where the picture has it counts as moved */
const DOOR_EPS = 0.01;
/** THINGS (rule 4d). The low bits of a key that number the PARTS of one thing, per keyed system (scene/boxes.ts MKEY: a prop's parts are id × 16 + part, an
 *  item's serial × 8 + part; every other keyed box is a thing by itself) · the systems the rule leaves alone: the leaves (4b's own memory), what a man carries
 *  (it goes with the man: combat.ts handProps), the wall devices and the staging boxes (bolted on or ambient: a camera's pan and a moth give nobody away) */
const THING_BITS: Record<number, number> = { [MKEY.prop >>> 24]: 4, [MKEY.item >>> 24]: 3 };
const THING_PASS = new Set<number>([MKEY.door >>> 24, MKEY.rig >>> 24, MKEY.device >>> 24]);
const THING_TEST = MKEY.test >>> 24;
/** A BROKEN FIXTURE's boxes (fixtureBreak.ts keys them MKEY.test + 0x5000 + serial << 5 + part, serial < 256: lows 0x5000‥0x6FFF). Parts 0‥5 are its BODY (its
 *  `hang` list: tray, cover, face, two tubes, the lead — one rigid thing); the parts after them are what came off it (the diffuser's halves, the glass), each lying
 *  where it fell: each a thing by itself, seen where IT is. (`probes.ts fog-things` breaks a real panel and holds the six.) */
const FIXTURE_LO = 0x5000, FIXTURE_HI = 0x7000, FIXTURE_BODY = 6;
/** Which THING a keyed box belongs to (one number per thing: a prop's parts share it, an item's, a broken fixture's body), or -1 for a box the rule leaves alone
 *  (a leaf, what a man carries, a wall device, the moths — the test range's 0x4000s). */
export function thingKeyOf(b: Box): number {
  const k = b.mkey!, sys = k >>> 24, low = k & 0xFFFFFF;
  if (THING_PASS.has(sys)) return -1;
  if (sys === THING_TEST) { if (low >= 0x4000 && low < 0x5000) return -1; return sys * 0x1000000 + (low >= FIXTURE_LO && low < FIXTURE_HI && (low & 31) < FIXTURE_BODY ? low >>> 5 : low); }   // (a loose piece — and any other test box: main.ts's cut test pieces from 0x8000 — keeps its whole key: no body's, no other piece's)
  return sys * 0x1000000 + (low >>> (THING_BITS[sys] ?? 0));
}
/** a part this far (m / rad) from where the picture has it counts as moved · the first frames of an encounter everything is taken as it stands (the building as
 *  the team knows it) · a thing held where it was last seen is looked for again every this many frames · remembered things at most */
const THING_EPS = 1e-3, THING_PRIME = 30, THING_EVERY = 3, THING_CAP = 768;
/** WHAT THE FOG HOLDS, IN A CHECKPOINT (FOG.filed; FogOfWar.snapshot / restore; savestate.ts files it under `fog`): only what the picture has another way than
 *  the world stands — a door by its name (as the doors' own slice is poured) with the angle the picture shows it at; a lamp by its name (as the targets' is)
 *  with the state the team knows it in (1 lit) and, for one known lit, its boxes' emission as they glowed; a piece of furniture the picture holds, by its thing
 *  key with its parts' poses (x y z yaw); and the keys of the furniture the picture leaves out (last seen on the move, or the team has looked at the place it left).
 *  An empty slice says the fog was up and held nothing: the load still makes the furniture's memory (restore), so no opening half second follows it */
export interface FogSnap { doors?: [string, number][]; lamps?: [string, 0 | 1, number[][]?][]; things?: [number, number[][]][]; out?: number[]; /** the dead the team has seen lying, by their place on the roster (as the guards' slice goes): a body stays in the picture for good */ bodies?: number[]; }
interface ThingRec { /** the parts as the picture has them: copies, posed where they were last seen */ ghost: Box[]; /** the middle of it in plan */ x: number; z: number; /** half its long side in plan, as a vector (0, 0 = a small thing: its middle alone is asked) */ ox: number; oz: number;
  /** update() count it was last in the live list · it was moving when last seen (then nobody knows where it stopped: out of sight it is not drawn) · held: the picture shows the ghost */
  f: number; moving: boolean; held: boolean; }
const PROP_SYS = MKEY.prop >>> 24, isProp = (thingKey: number): boolean => Math.floor(thingKey / 0x1000000) === PROP_SYS;
/** a box copied for the picture's memory: its own centre, half-sizes and turn, so it does not follow the live one */
const ghostBox = (s: Box): Box => ({ ...s, c: [s.c[0], s.c[1], s.c[2]], h: [s.h[0], s.h[1], s.h[2]], rot: s.rot ? [s.rot[0], s.rot[1], s.rot[2], s.rot[3]] : undefined });
/** the beam is looked at every this many metres, each end of a seen stretch then found to BEAM_FINE */
const BEAM_STEP = 0.75, BEAM_FINE = 0.1;

/** WHAT THE TEAM'S SIGHT LINES PASS (col.segmentBlocked's `through`): glass, and under FOG.thin the statics marked thin and free (scene/thin.ts; an opened
 *  wall's bare studs). The fog's own lines ask it (sightBlocked); under FOG.mates a teammate's own eye and the player's line for the squad's net are handed
 *  the same (guards.ts teamThrough / eyeThrough): ONE mask, so the picture and the men in it cannot part. */
export function fogThrough(): number { return FOG.thin ? BoxFlag.Glass | BoxFlag.Thin : BoxFlag.Glass; }
/** one of the team's eyes this frame */
export interface FogEye {
  id: number;
  /** his head: where the sight test on MEN starts (the guards' own eye point) */
  pos: Vec3; look: Vec3;
  /** where the PICTURE's ray starts: over his feet, at a nominal eye height for his stance. Not the animated head bone — that bobs across the cubicle partitions'
   *  tops (1.40 m) with every sprinting stride and across the sills' crouched, and the whole mask would strobe at gait frequency; and never inside a leaf he leans on */
  at: Vec3;
  /** an eye with a field of its own (the optical wand's lens — wand.ts): its wedge in degrees and its all-round near field in metres, in place of fieldDeg() /
   *  fieldNear(); absent = the team's, as every man's eye is */
  fov?: number; near?: number;
  /** this eye is the player's wand under a door, standing in his own eye's place */
  wand?: true;
}
/** the picture's eye heights over the feet: standing, crouched (also a man down) */
const EYE_STAND = 1.55, EYE_CROUCH = 0.95;
interface Rec { seen: boolean; /** in the picture through a frame's eye alone this frame (rails.ts RAILS.eyeView): drawn, not seen */ framed?: boolean; t: number; /** where he stood at that sighting (FOG.lastSeen) */ at?: Vec3; /** the last time the wand's lens itself had a line to him (wand.ts: his mark then stays WAND.markSecs) */ wandT?: number; body: boolean; /** the last smoke verdict the probe's answers decided, and the frame of it */ smoked: boolean; smokeF: number; }
/** smoke segments asked of the probe a frame (its table holds 32 for everybody: sensors.ts), and how many of a man's nearest clear-lined eyes are asked about */
const SMOKE_ASKS = 6, SMOKE_EYES = 2;
/** frames an un-asked pair's last answer still counts (the readback's latency is one or two), and a man's last smoke verdict while none of his pairs has an answer */
const SMOKE_FRESH = 8, SMOKE_KEEP = 30;
const DEG = Math.PI / 180;
/** a lamp's face drawn dark (lampFace) */
const DARK: Readonly<Vec3> = [0, 0, 0];
/** how much of a kept face's glow is held from one update to the next while the lamp is dimmer (faceSeen: a peak that fades in about a second) */
const FACE_HOLD = 0.98;
/** doorSeen's points: along the leaf, and their heights */
const DOOR_F = [0.95, 0.6, 0.25], DOOR_Y = [1.0, 1.8];
/** update()'s scratch: a man's eyes nearest first, and their squared distances */
const nearEyes: FogEye[] = [], nearD2: number[] = [];

export class FogOfWar {
  /** THE SWITCH (main.ts: on under ?roomclear, ?fow / ?nofow force it; the Tab row; __fow.on) */
  on = false;
  readonly knobs = FOG;
  /** what the renderer's pass reads (render/fogofwar.ts; main.ts hands this object to the engine once): the eyes, the look */
  readonly frame: FogFrame = makeFogFrame();
  /** this frame's eyes (empty while off) */
  eyes: FogEye[] = [];
  /** this frame's living teammates, for the doors they work (`FOG.squadDoors`; empty while that is off) */
  private mates: Character[] = [];
  /** the characters left out of the picture this frame (what the probes read: the drawn set is everybody else) */
  readonly hiddenChars = new Set<Character>();
  stats = { frames: 0, eyes: 0, tested: 0, seen: 0, hidden: 0, smokeAsks: 0, smokeHid: 0, /** men in the picture this frame only because the squad is shooting at them (FOG.squadFire) */ byFire: 0 };
  /** FOG.squadFire's memory: each teammate's count of aimed rounds as of the last update (roomfight.ts Op.rounds) · per man fired at, when — on the module's own
   *  clock (s of update()s; never Game.time: a checkpoint load puts that back) */
  private firedN = new SideMap<object, number>(); private firedAt = new SideMap<Guard, number>(); private fireClock = 0;
  /** men a level's script has put in the picture (director.ts `show`): drawn as the squad's targets are — not SEEN, no laser, nobody's AI learns anything —
   *  for as long as the script says, whoever's eyes lift the fog. A staged man the lesson is about must be there to be looked at */
  private shown = new SideSet<Guard>();
  show(gd: Guard, on: boolean) { if (on) this.shown.add(gd); else this.shown.delete(gd); }
  private recs = new SideMap<Guard, Rec>();
  /** per door: the angle the picture has it at, and the three boxes drawn in its place while that is not where it stands */
  private doorRecs = new Map<Door, { shown: number; ghost: Box[] | null }>();
  /** the leaves drawn as remembered this frame (what the probes read) */
  doorsHeld = 0;
  /** rule 4f's memory: per fixture, whether the team has it lit (its own state — switched, shot out, knocked out by the OCP; never the mains) · this frame's
   *  tallies: fixtures that carry light, the lamps handed to the pass, and the fixtures the fog shows otherwise than they stand */
  /** each lamp's face as it glowed while the team knew it lit, a row a box of the target's (FOG.kept, faceSeen): what lampFace draws once it is out unseen */
  private faceRecs = new Map<LightTarget, Vec3[]>();
  private lampRecs = new Map<LightTarget, boolean>(); private lampPick: { l: RtLight; I: number; d: number }[] = []; private lampN = 0;
  litStats = { lamps: 0, lights: 0, held: 0 };
  /** rule 4d's memory: thing → how the picture has it; the list handed to the renderer; this frame's tallies (held = drawn as remembered, out = left out) */
  private thingRecs = new Map<number, ThingRec>(); /** a load made the furniture's memory (restore): the opening half second, which takes everything as it stands, passes the furniture by — until it ends, or the rule's memory is dropped */ private propsLoaded = false; /** a load's records were made and no update() has run since (restore): the fog found off on that first one forgets them */ private loaded = false; private thingOut: Box[] = []; /** the update() count the memory began at (−1: not begun) */ private thingSince = -1;
  thingStats = { held: 0, out: 0, tests: 0 };
  /** the stretch of the frame's list that is what the men carry (Game.stepFxAndDynBoxes notes it): left as it is — a man's kit goes with the man */
  rigFrom = 0; rigTo = 0;
  private spanX = 0; private spanZ = 0; private cellSeen = new Map<number, boolean>();
  /** the module's own frame count (never Game.time: a checkpoint load puts that back), the frame each smoke key was last asked, the asks waiting for flushAsks(),
   *  and whose turn it is to be asked first */
  private frameNo = 0; private asked = new Map<string, number>(); private pending: { key: string; a: Vec3; b: Vec3 }[] = []; private turn = 0;
  /** A VIEWER'S PICTURE WITHOUT THE FOG (the engine replay's 'Fog' switch, replay/engineplay.ts → Game.fogLift / fogBack): `viewer` is raised by whoever may ask
   *  for one — never by play — and then each frame's list is also kept as it stood before the rules above cut it (`raw()`); `bared` is up only while that picture
   *  and its HUD are drawn, between two steps, and makes `hidden()` / `lastSeen()` answer as if nobody were left out. No step reads either: a run is the same run. */
  viewer = false; bared = false;
  /** fog frames left to put the picture under the page's own fog look (FOG_PAGE) — THE ENGINE REPLAY'S CALL, made as it takes the frame and after every table
   *  of the tape's it lays over FOG (replay/engineplay.ts): a few frames, so that word is the last; after them the Tab rows are the viewer's to move. Never
   *  called by play or the harness: there FOG is what the knobs say. */
  pageLook(): void { this.lookFrames = 3; }
  private lookFrames = 0;
  private rawList: Box[] = []; private rawAt = -1; private doorFrom = 0; private doorN = 0;
  constructor(private g: Game) { }

  /** is it doing anything this frame: the switch, and no show running (the tour, a showcase, the attract mode's quiet floor are pictures of everything) */
  get active(): boolean { const g = this.g; return this.on && !g.touring && !g.quietUtility; }
  /** is this man on the team whose sight it is (Sam's side, AI-led) */
  onTeam(gd: Guard): boolean { return gd.team === 'operative'; }

  /** Once a frame from Game.update, after everybody has moved and before the picture's lists are built: the eyes, then seen / not for every man who is not on
   *  the team. A return on its first line while the switch is off. */
  update(_dt: number) {
    const F = this.frame;
    if (!this.active) { if (F.on || this.loaded) { this.loaded = false; this.propsLoaded = false; F.on = false; F.count = 0; this.eyes = []; this.hiddenChars.clear(); this.pending.length = 0; this.doorRecs.clear(); this.doorsHeld = 0; this.thingRecs.clear(); this.firedN = new SideMap(); this.firedAt = new SideMap(); this.fireClock = 0; this.lampRecs.clear(); this.faceRecs.clear(); F.lit = 0; F.lightCount = 0; F.full = false; this.fullClear(); } return; }
    this.loaded = false;
    const g = this.g; const S = this.stats; S.frames++; const frame = ++this.frameNo;
    // ---- the eyes: Sam, then the living operatives in list order, as many as FOG.eyes (the renderer takes them all; the CPU answer uses the same ones — one model; a
    //      tutorial's frame adds eyes that are the picture's alone, below)
    const eyes: FogEye[] = []; const eyeOf = (c: Character): FogEye => this.eyeOf(c); const cap = fogEyeCount(FOG.eyes);
    if (!g.rails?.skyOn) { const own = eyeOf(g.player.char); eyes.push(wandEye(g) ?? peekEye(g, own) ?? own); }   // (rails.ts, the seat with nobody on the floor: the parked player is nobody's eye)   // (looking under a door his eyes are in the scope: the lens stands in his own eye's place — wand.ts; peeking round the end of a wall they are where a head leaned round it would be — peeksight.ts, null with its switch down)
    if (!FOG.own || g.rails?.skyOn) for (const gd of g.guards) { if (eyes.length >= cap) break; if (!this.onTeam(gd) || gd.state === 'dead' || g.time < gd.dazzledUntil) continue; eyes.push(mateWandEye(g, gd) ?? eyeOf(gd.char)); }   // (a teammate ordered to look under a door: his lens in his own eye's place — wandorder.ts)
    else for (const e of mateWandEyes(g)) { if (eyes.length >= cap) break; eyes.push(e); }   // (only my own eyes: an ordered lens is a device feed, as a sticky camera's is)
    for (const e of stickyEyes(g)) { if (eyes.length >= cap) { STICKY_STATS.blind++; break; } eyes.push(e); }   // (his sticky cameras, newest first, in the places the frame has left: stickycam.ts — nothing with none out)
    // (THE FRAME'S EYES — rails.ts: the seat's lookout, a step's eye. With RAILS.eyeView they are the PICTURE's alone: `pic` is the list the mask, the doors
    //  and the loose things read, and `eyes` stays the team's own — the list every man's seen() is answered from, the same as with no frame's eye at all, the
    //  man a step's eye takes the picture's last place from included. A man only a frame's eye has a line to is drawn, not seen: `framed`, in the verdicts)
    let pic = eyes, view: FogEye[] | null = null;
    { const e = g.rails?.eye(), s = g.rails?.stepEye(), first = !!s && !!g.rails?.eyeFirst, own = !!(e || s) && !!g.rails?.eyeView;
      if (own) { pic = eyes.slice(); view = []; }
      if (s && first) { if (pic.length >= cap) pic.length = cap - 1; pic.push(s); view?.push(s); }   // (the step's own eye is what the step is about: with the places full it takes the last one — with four men up and the lookout in, it was the one dropped)
      if (e && pic.length < cap) { pic.push(e); view?.push(e); }   // (a tutorial mission's lookout in the seat with nobody on the floor: rails.ts — null off such a level)
      if (s && !first && pic.length < cap) { pic.push(s); view?.push(s); } }
    this.eyes = pic; S.eyes = pic.length;
    // (the squad's own men for the doors' rule, FOG.squadDoors: every living teammate who is not blinded, whoever's eyes lift the fog)
    this.mates.length = 0; if (FOG.squadDoors && FOG.doors) for (const gd of g.guards) if (this.onTeam(gd) && gd.state !== 'dead' && g.time >= gd.dazzledUntil) this.mates.push(gd.char);
    // (the men the squad is shooting at, FOG.squadFire: a teammate's count of aimed rounds went up since the last update — the man he is on is stamped)
    this.fireClock += _dt;
    for (const O of g.fight.ops) { const n = O.rounds, was = this.firedN.get(O); this.firedN.set(O, n);   // (the counts are kept whatever the switch says: thrown on mid-fight it starts from this frame's)
      if (FOG.squadFire && was !== undefined && n > was && O.tgt && this.onTeam(O.gd) && !this.onTeam(O.tgt)) this.firedAt.set(O.tgt, this.fireClock); }   // (a shooter dropped on the frame his round left still fired it)
    // ---- everybody else: seen by any of them?
    this.pending.length = 0; this.hiddenChars.clear(); S.tested = 0; S.seen = 0; S.hidden = 0; S.smokeHid = 0; S.byFire = 0;
    const held = g.player.holding?.g ?? null;
    const pid = g.player.char.id;   // (the smoke line of the player's lens is asked under 'W', a teammate's ordered lens under 'W' + his id)
    // (1) lines of sight: per man, the eyes with a clear line to him, nearest first — a living man with one waits on the smoke along it (2); everybody else is decided here
    const men: Guard[] = []; for (const gd of g.guards) if (!this.onTeam(gd)) men.push(gd); for (const cv of g.civilians) if (!this.onTeam(cv) && cv.civ?.state !== 'gone') men.push(cv);   // (a civilian gone through an exit is nobody)
    const lines = new Map<Guard, boolean>(); const jobs: { gd: Guard; chest: Vec3; pairs: { key: string; e: FogEye }[] }[] = [];
    for (const gd of men) {
      const dead = gd.state === 'dead';
      if (gd === held) { lines.set(gd, true); continue; }   // (the man in Sam's arm)
      if (dead) { lines.set(gd, eyes.some(e => this.eyeOnBody(e, gd))); continue; }
      const chest = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]);
      if (FOG.smoke <= 0) { lines.set(gd, eyes.some(e => this.lineToMan(e, gd, chest))); continue; }
      // the eyes with a clear line, nearest first — only whether there is one and the nearest SMOKE_EYES of them are ever read, so the eyes are tried nearest first
      // (the same stable order by the same distance the clear ones used to be sorted into) and the trying stops at the SMOKE_EYES-th clear line
      const d2 = (e: FogEye) => (e.pos[0] - chest[0]) ** 2 + (e.pos[2] - chest[2]) ** 2;
      const near = nearEyes, nearD = nearD2; let nn = 0;
      for (const e of eyes) { const d = d2(e); let k = nn++; while (k > 0 && nearD[k - 1] > d) { near[k] = near[k - 1]; nearD[k] = nearD[k - 1]; k--; } near[k] = e; nearD[k] = d; }
      const clear: FogEye[] = []; for (let k = 0; k < nn && clear.length < SMOKE_EYES; k++) if (this.lineToMan(near[k], gd, chest)) clear.push(near[k]);
      near.length = 0;
      lines.set(gd, clear.length > 0);
      if (clear.length) jobs.push({ gd, chest, pairs: clear.map(e => ({ key: `fow${e.wand ? (e.id === pid ? 'W' : 'W' + e.id) : e.id}_${gd.char.id}`, e })) });
    }
    // (2) the smoke along those lines, through the sensors. The frame's asks are dealt a pair a man, every man before anybody's second pair, starting a man
    //     further round each frame and with each man's two pairs taking the first place in turn — past the budget everybody is still served, both eyes. A pair's
    //     answer counts while the pair was asked within SMOKE_FRESH frames AND the probe has answered it since it was picked up (a pair picked up again starts from
    //     no answer — forget — not from whatever the probe last said of it). The verdict is the answered pairs' alone: any of them clear = seen, all of them thick
    //     = lost; a man with no answered pair keeps his last verdict SMOKE_KEEP frames, then stands in clear air (the guards' rule; headless, always).
    if (jobs.length) {
      this.turn = (this.turn + 1) % jobs.length;
      for (let round = 0; round < SMOKE_EYES; round++) for (let i = 0; i < jobs.length && this.pending.length < SMOKE_ASKS; i++) {
        const j = (i + this.turn) % jobs.length, J = jobs[j]; if (round >= J.pairs.length) continue;
        const P = J.pairs[(round + frame + j) % J.pairs.length];
        const last = this.asked.get(P.key); if (last === undefined || frame - last > SMOKE_FRESH) g.sensors.forget(P.key);
        this.asked.set(P.key, frame); this.pending.push({ key: P.key, a: P.e.pos, b: J.chest });
      }
      S.smokeAsks += this.pending.length;
      for (const J of jobs) {
        let r = this.recs.get(J.gd); if (!r) { r = { seen: false, t: -1e9, body: false, smoked: false, smokeF: -1e9 }; this.recs.set(J.gd, r); }
        let known = 0, open = false;
        for (const P of J.pairs) {
          const last = this.asked.get(P.key); if (last === undefined || frame - last > SMOKE_FRESH) continue;
          const T = g.sensors.read(P.key); if (T === undefined) continue;
          known++; if (T >= FOG.smoke) open = true;
        }
        if (known) { r.smoked = !open; r.smokeF = frame; }
        if (r.smoked && frame - r.smokeF <= SMOKE_KEEP) { lines.set(J.gd, false); S.smokeHid++; }
      }
      if (this.asked.size > 256) for (const [k, f] of this.asked) if (frame - f > SMOKE_KEEP) this.asked.delete(k);
    }
    // (3) the verdicts
    const judge = (gd: Guard) => {
      S.tested++;
      let r = this.recs.get(gd); if (!r) { r = { seen: false, t: -1e9, body: false, smoked: false, smokeF: -1e9 }; this.recs.set(gd, r); }
      const dead = gd.state === 'dead';
      const seen = lines.get(gd) === true;
      const since = g.time - r.t;   // (a record outlives nothing but its Guard object; a clock put back by a checkpoint load meets fresh men — and a stamp from an abandoned future is no sighting)
      const fired = !seen && this.firedOn(gd);
      const framed = r.framed = !seen && !!view && view.some(e => dead ? this.eyeOnBody(e, gd) : this.lineToMan(e, gd, gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0])));   // (walls and leaves only: no plume is asked along a frame eye's line)
      if (dead && (seen || fired || framed || this.shown.has(gd) || (since >= 0 && since < Math.max(FOG.linger, 0.5)))) r.body = true;   // seen lying there — or seen going down (under the squad's rounds too: FOG.squadFire)
      r.seen = seen; if (seen) { r.t = g.time; if (!dead) { const a = r.at ?? (r.at = [0, 0, 0]), p = gd.char.pos; a[0] = p[0]; a[1] = p[1]; a[2] = p[2]; } }   // (where he stood, kept in place whatever the knob says: a mark asked for later is never at an older spot than its time)
      if (seen) S.seen++;
      if (!this.drawn(gd)) { this.hiddenChars.add(gd.char); S.hidden++; }
      else if (fired && !dead && !(since >= 0 && since < FOG.linger)) S.byFire++;
    };
    for (const gd of men) judge(gd);
    for (const eye of eyes) if (eye.wand) for (const gd of men) {   // (whom a lens itself has, in the picture: his mark outlives the look — lastSeen; the player's, or an ordered teammate's)
      if (gd.state === 'dead' || !isHostile(gd.team, 'player')) continue; const r = this.recs.get(gd); if (!r || !r.seen) continue;
      if (this.lineToMan(eye, gd, gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]))) { if (r.wandT === undefined || g.time - r.wandT > 1 || g.time < r.wandT) WAND_STATS.marked++; r.wandT = g.time; }
    }
    this.tellCalls(_dt);
    // ---- the doors: a leaf that stands where the picture has it needs no look; one that does not comes up to date the frame an eye has a line to it or to its place
    this.doorsHeld = 0;
    if (FOG.doors) for (const d of g.doors.list) {
      let r = this.doorRecs.get(d); if (!r) { r = { shown: d.angle, ghost: null }; this.doorRecs.set(d, r); }   // (first met: the building as it stands)
      if (Math.abs(d.angle - r.shown) <= DOOR_EPS || this.doorSeen(d, r.shown)) r.shown = d.angle; else this.doorsHeld++;
    } else if (this.doorRecs.size) this.doorRecs.clear();
    // ---- the renderer's block
    if (this.lookFrames > 0) { this.lookFrames--; FOG.desat = FOG_PAGE.desat; FOG.edge = FOG_PAGE.edge; FOG.air = FOG_PAGE.air; FOG.kept = FOG_PAGE.kept; }
    F.on = true; F.count = pic.length; F.dim = FOG.dim; F.desat = FOG.desat; F.topPad = FOG.topPad; F.edge = Math.max(0, FOG.edge);
    const fov = fieldDeg(), near = fieldNear();
    const full = fov >= 360; const cosHalf = full ? -2 : Math.cos(Math.max(1, fov) * 0.5 * DEG);
    // (the picture's soft edges are the cone's alone: a plain fovDeg wedge keeps its hard line — the block's three rows 0 = the kernel's old answer, bit for bit)
    const soft = FOG.cone && !full ? Math.max(0, Math.min(FOG.coneSoftDeg, fov, 360 - fov)) : 0;
    F.full = this.fullBlock(F); F.flat = Math.max(0, FOG.flat); this.litBlock(F); F.air = FOG.air; F.kept = FOG.kept; this.thinBlock(F);
    F.softIn = soft > 0 ? Math.cos(Math.max(0, fov * 0.5 - soft * 0.5) * DEG) : 0; F.softOut = soft > 0 ? Math.cos(Math.min(180, fov * 0.5 + soft * 0.5) * DEG) : 0;
    F.nearSoft = FOG.cone && !full ? Math.max(0, FOG.coneNearSoftM) : 0;
    for (let k = 0; k < FOG_EYES; k++) {
      const e = pic[k], o = k * 4;
      if (!e) { F.eyes.fill(0, o, o + 4); F.looks.fill(0, o, o + 4); continue; }
      F.eyes[o] = e.at[0]; F.eyes[o + 1] = e.at[1]; F.eyes[o + 2] = e.at[2]; F.eyes[o + 3] = e.id;
      const L = Math.hypot(e.look[0], e.look[2]) || 1;
      F.looks[o] = e.look[0] / L; F.looks[o + 1] = e.look[2] / L;
      F.looks[o + 2] = e.fov === undefined ? cosHalf : e.fov >= 360 ? -2 : Math.cos(Math.max(1, e.fov) * 0.5 * DEG); F.looks[o + 3] = e.near ?? near;   // (an eye with its own field: the wand's lens)
    }
  }

  /** a man as an eye: off his head, looking where he looks (the cone: his gaze — gazeOf; all round or fovDeg's wedge: between his chest and his head, as it was) */
  private eyeOf(c: Character): FogEye {
    return { id: c.id, pos: c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]), look: FOG.cone ? gazeOf(c) : v3.normalize(v3.lerp(c.chestDir, c.headDir(), 0.5)),
      at: [c.pos[0], c.pos[1] + (c.alive ? EYE_STAND + (EYE_CROUCH - EYE_STAND) * Math.min(1, Math.max(0, c.anim.crouch)) : EYE_CROUCH), c.pos[2]] };
  }

  // ---------------------------------------------------------------- 7 · what the cone hides is called
  /** every call made, newest last (capped): the QA's read · the tallies */
  callLog: { t: number; who: string; of: string; kind: 'contact' | 'heard'; text: string }[] = [];
  callStats = { contact: 0, heard: 0 };
  /** the module's own clock for the calls (s of update()s; never Game.time — a checkpoint load puts that back), per enemy: when he was last called · when the
   *  player's own eye last had him; per teammate: the step in his ears already told */
  private callClock = 0; private lastCall = -1e9; private calledT = new SideMap<Guard, number>(); private knownT = new SideMap<Guard, number>(); private toldStep = new SideMap<Guard, number>(); private callN = 0;
  /** where `p` lies for the player's man, by the way he looks: 'front' / 'left' / 'right' / 'behind' */
  sideOf(p: Vec3): 'front' | 'left' | 'right' | 'behind' {
    const c = this.g.player.char, l = gazeOf(c), dx = p[0] - c.pos[0], dz = p[2] - c.pos[2], d = Math.hypot(dx, dz) || 1;
    const dot = (dx * l[0] + dz * l[2]) / d, cross = (dx * l[2] - dz * l[0]) / d;   // (cross > 0: on his left hand — the probe holds it against his own shoulders)
    return dot > COS_FRONT ? 'front' : dot < COS_BEHIND ? 'behind' : cross > 0 ? 'left' : 'right';
  }
  /** the words of one call: in the player's own room the side of him, else the place by the level's own room names (behind him said first) */
  callWords(kind: 'contact' | 'heard', p: Vec3): string {
    const g = this.g, side = this.sideOf(p), there = placeName(g.level, p), here = placeName(g.level, g.player.char.pos), k = this.callN;
    if (there === here) return kind === 'contact' ? `contact ${side}!` : side === 'behind' ? 'movement behind us!' : `movement — ${side}!`;
    const at = /^outside /.test(there) ? there : `in ${there}`;
    if (kind === 'contact') return side === 'behind' ? `behind us — contact ${at}!` : k & 1 ? `eyes on one ${at}!` : `contact — ${at}!`;
    return side === 'behind' ? `movement behind us — ${there}!` : k & 1 ? `steps — ${there}!` : `movement — ${there}!`;
  }
  private tellCalls(dt: number) {
    const g = this.g; const now = this.callClock += dt;
    if (!FOG.calls || !(FOG.cone || FOG.own) || !this.eyes.length || g.player.down || this.frameNo % CALL_EVERY) return;   // (looked over ten times a second: the lines asked here are the calls' own)
    const me = this.eyes[0];
    const foes: Guard[] = []; for (const h of g.guards) if (h.state !== 'dead' && h.char.alive && isHostile(h.team, 'player') && h !== (g.player.holding?.g ?? null) && !runnerNobody(h)) foes.push(h);   // (runner.ts nobody: a man who has dropped his gun and run is nobody's contact)
    const chestOf = (h: Guard) => h.char.bones.chest ?? v3.add(h.char.pos, [0, 1.1, 0]);
    for (const h of foes) if (this.recs.get(h)?.seen && this.lineToMan(me, h, chestOf(h))) this.knownT.set(h, now);   // (whom the player's own eye has, in the picture — not lost in a plume: nobody need tell him)
    if (now - this.lastCall < FOG.callGap) return;
    const fresh = (h: Guard) => now - (this.calledT.get(h) ?? -1e9) >= FOG.callSecs && now - (this.knownT.get(h) ?? -1e9) >= FOG.callKnown;
    const say = (gd: Guard, h: Guard, kind: 'contact' | 'heard', at: Vec3) => {
      const text = this.callWords(kind, at); this.callN++; this.lastCall = now; this.calledT.set(h, now); this.callStats[kind]++;
      this.callLog.push({ t: +g.time.toFixed(2), who: gd.callsign, of: h.callsign, kind, text }); if (this.callLog.length > 200) this.callLog.splice(0, 50);
      g.cues.call(gd, text);
    };
    const mates: Guard[] = []; for (const gd of g.guards) if (this.onTeam(gd) && gd.state !== 'dead' && g.time >= gd.dazzledUntil && !gd.held) mates.push(gd);
    // contact: the first teammate, in list order, with one of them in his eyes
    for (const gd of mates) { const e = this.eyeOf(gd.char);
      for (const h of foes) { if (!fresh(h)) continue; const chest = chestOf(h); if (!this.lineToMan(e, h, chest)) continue; say(gd, h, 'contact', chest); return; } }
    // heard: a step in a teammate's ears (roomfight.ts: the man he turns his head to) from somebody no eye of the fog's has
    for (const O of g.fight.ops) { const sb = O.stepBy; if (!sb || O.gd.state === 'dead' || this.toldStep.get(O.gd) === sb.t) continue;
      this.toldStep.set(O.gd, sb.t);
      if (sb.by.state === 'dead' || !fresh(sb.by) || this.recs.get(sb.by)?.seen || runnerNobody(sb.by)) continue;
      say(O.gd, sb.by, 'heard', sb.at); return; }
  }

  /** is the point `p` inside this eye's field in plan (the wedge, or its all-round near field; always, at 360°) */
  private inField(e: FogEye, p: Vec3): boolean {
    const fov = e.fov ?? fieldDeg(); if (fov >= 360) return true;
    const dx = p[0] - e.pos[0], dz = p[2] - e.pos[2]; const d = Math.hypot(dx, dz); if (d < (e.near ?? fieldNear()) || d < 1e-4) return true;
    const L = Math.hypot(e.look[0], e.look[2]) || 1;
    return (dx * e.look[0] + dz * e.look[2]) / (d * L) > Math.cos(fov * 0.5 * DEG);
  }
  /** The frame's smoke segments, queued for the probe. Called by Game.update AFTER Sam's own meter and the guards' sight lines have been asked: the probe's table
   *  drops what does not fit, and the fog's questions are the ones to lose. */
  flushAsks() {
    if (!this.pending.length) return; const g = this.g, S = g.sensors;
    for (const p of this.pending) { const room = S.own ? undefined : (g.probe as { room?: number } | null)?.room;   /* (the senses on the CPU — sense.ts: no table to run out of) */ const full = room !== undefined && room <= 0; S.askSegment(p.key, p.a, p.b); if (full) S.forget(p.key); }   // (an ask the table had no room for: its old answer is not this frame's — no answer, and the man keeps his last verdict a while)
    this.pending.length = 0;
  }
  /** A fresh encounter (Game.restartEncounter — a restart, a checkpoint load, the start of an F10 recording and of its replay): nobody has been seen, no pair asked. */
  reset() { this.rawAt = -1; this.bared = false; this.lampRecs.clear(); this.faceRecs.clear(); this.doorRecs.clear(); this.doorsHeld = 0; this.thingRecs.clear(); this.propsLoaded = false; this.loaded = false; this.ourLanded.clear(); this.thingSince = -1; this.recs = new SideMap(); this.asked.clear(); this.pending.length = 0; this.turn = 0; this.frameNo = 0; this.hiddenChars.clear(); this.firedN = new SideMap(); this.firedAt = new SideMap(); this.shown = new SideSet(); this.fireClock = 0;
    this.callClock = 0; this.lastCall = -1e9; this.calledT = new SideMap(); this.knownT = new SideMap(); this.toldStep = new SideMap(); this.callN = 0; this.callLog = []; this.callStats = { contact: 0, heard: 0 }; }

  /** THE FOG'S OWN LINE: is anything solid between an eye and a point — the game's sight test (statics and leaves; glass passes), which under FOG.thin also
   *  passes the statics the level marked thin and free (scene/thin.ts). With the row off this is segmentBlocked(a, b) as every caller here had it. */
  private sightBlocked(a: Vec3, b: Vec3): boolean { return this.g.col.segmentBlocked(a, b, 0.02, fogThrough()); }
  /** the picture's half of FOG.thin: the row, and WHICH statics are marked, as bits by box index (a static's index in the box world is its index on the GPU;
   *  one past the list's reach — render/fogofwar.ts FOG_THIN_WORDS × 32 — has no bit: the lines here pass it, the picture does not). Filled every frame: a
   *  breached wall's studs come and go (wallbreak.ts), and a scan of the statics' flags is nothing; the renderer uploads only when the bits differ. */
  private thinBlock(F: FogFrame) {
    F.thin = FOG.thin;
    if (!F.thin) return;
    const world = this.g.engine.world as { statics?: Box[]; geomSerial?: number }, st = world.statics, bits = F.thinBits; bits.fill(0); F.thinSerial = world.geomSerial ?? 0; F.thinCount = st?.length ?? 0;
    if (st) for (let i = 0, n = Math.min(st.length, bits.length * 32); i < n; i++) if (st[i].flags & BoxFlag.Thin) bits[i >> 5] |= 1 << (i & 31);
  }
  /** one eye on one living man, walls and leaves only: the game's own line-of-sight test (guards.ts eyeContact: statics and leaves against his chest AND his head,
   *  glass passed), inside the eye's field. The smoke along a clear line is update()'s second step. Under FOG.thin these lines pass a static the level marked
   *  thin and free; a teammate's own eye passes the same ones under FOG.mates (guards.ts eyeThrough), and with that row off it stops at them — a man behind
   *  a window's bar is then in the picture, and called, a moment before that teammate's own eye has him. */
  private lineToMan(e: FogEye, gd: Guard, chest: Vec3): boolean {
    const g = this.g, pc = gd.char;
    if (!this.inField(e, chest)) return false;
    const to = v3.sub(chest, e.pos); const L = Math.hypot(to[0], to[2]);
    if (L <= 1e-3) return true;   // (he is under the eye itself)
    // eyeContact's own verdict for an eye that faces him with no reach limit and a half-circle field (what this handed it: look = the way to his chest in plan, range
    // 1e6, 90°) — written out: such an eye always has him in its cone, so only 'he is alive, and the line to his chest or to his head is clear' is left to ask.
    // The two lines are eyeContact's (the same chest — update()'s — and head points, the chest asked first and the head only behind a blocked chest).
    if (!pc.alive) return false;
    return !(this.sightBlocked(e.pos, chest) && this.sightBlocked(e.pos, pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0])));
  }
  /** one eye on a body: a clear line to a hand's height over where it lies (the finders' own point — guards.ts), inside the eye's field */
  private eyeOnBody(e: FogEye, gd: Guard): boolean {
    const hp = gd.char.bones.hips ?? gd.char.pos; const at: Vec3 = [hp[0], Math.max(hp[1], 0) + 0.3, hp[2]];
    return this.inField(e, at) && !this.sightBlocked(e.pos, at);
  }

  /** can any eye see this point: inside its field, nothing solid (a static, a leaf where it really stands; glass passes) on the line */
  private eyeOn(p: Vec3): boolean {
    for (const e of this.eyes) if (this.inField(e, p) && !this.sightBlocked(e.pos, p)) return true;
    return false;
  }
  /** does anybody on the team see this door: a line to the leaf where it stands, or to where the picture has it (an eye on the place a leaf is drawn sees that
   *  it is not there). Points along the leaf at two heights, each taken a hand short of the leaf so the leaf itself is not what stops the line. */
  private doorSeen(d: Door, shown: number): boolean {
    const [hx, hz] = d.def.hinge, W = d.def.width; const eyes = this.eyes;
    for (let ai = 0; ai < 2; ai++) {
      const a = d.def.closedDir + (ai ? shown : d.off ? 0 : d.angle), ux = Math.cos(a), uz = Math.sin(a);   // (off its hinges: the frame it left is what there is to see)
      for (let fi = 0; fi < 3; fi++) for (let yi = 0; yi < 2; yi++) {
        const f = DOOR_F[fi]; const p: Vec3 = [hx + ux * W * f, DOOR_Y[yi], hz + uz * W * f];
        for (const e of eyes) {
          if (!this.inField(e, p)) continue;
          const L = v3.dist(e.pos, p); if (L < 0.3) return true;
          if (!this.sightBlocked(e.pos, v3.lerp(e.pos, p, 1 - 0.12 / L))) return true;
        }
        // (a door the squad works: a teammate at it sees it move, whatever he is looking at — his head, not the fog's eye)
        for (const c of this.mates) {
          const dx = c.pos[0] - p[0], dz = c.pos[2] - p[2]; if (dx * dx + dz * dz > FOG.squadDoorsM * FOG.squadDoorsM) continue;
          const from = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]); const L = v3.dist(from, p); if (L < 0.3) return true;
          if (!this.sightBlocked(from, v3.lerp(from, p, 1 - 0.12 / L))) return true;
        }
      }
    }
    return false;
  }
  /** is this door drawn where the team last saw it rather than where it stands (false for every door while the fog is off) */
  doorHeld(d: Door): boolean { const r = this.doorRecs.get(d); return !!r && this.active && FOG.doors && Math.abs(d.angle - r.shown) > DOOR_EPS; }
  /** the angle the picture has this door at */
  doorShown(d: Door): number { const r = this.doorRecs.get(d); return r && this.active && FOG.doors ? r.shown : d.angle; }
  /** the door a box in the picture's list is the remembered leaf of (the order menu's cursor: a leaf as drawn is that door), or null */
  doorOfBox(box: Box): Door | null { for (const [d, r] of this.doorRecs) if (r.ghost && r.ghost[0] === box) return d; return null; }
  /** THE DOORS' BOXES for the picture (Game.update, in place of Doors.boxes): each leaf and its handles where they stand — or, for a leaf that has moved unseen,
   *  copies posed at the angle the team last saw. The list Doors.boxes writes, box for box, while the fog is off or no leaf is held. */
  doorBoxes(doors: Doors, out: Box[]) {
    this.doorN = 0;
    if (!this.active || !FOG.doors || !this.doorsHeld) { doors.boxes(out); return; }
    this.doorFrom = out.length;
    for (const d of doors.list) {
      const r = this.doorRecs.get(d);
      if (!r || Math.abs(d.angle - r.shown) <= DOOR_EPS) { out.push(d.box, d.handleBoxes[0], d.handleBoxes[1]); continue; }
      const P = d.poseAt(r.shown);
      const G = r.ghost ??= [{ ...d.box }, { ...d.handleBoxes[0] }, { ...d.handleBoxes[1] }];
      G[0].c = P.c; G[0].yaw = P.yaw; G[0].flags = d.box.flags;
      if (d.off || G[0].rot) { G[0].h = d.leafH; G[0].marks = d.leafMarks; G[0].rot = undefined; G[1].rot = undefined; G[2].rot = undefined; }   // (a leaf blown off its hinges unseen: remembered HUNG, as last seen — not as the slab its box now is)
      for (let s = 0; s < 2; s++) { G[1 + s].c = P.handles[s]; G[1 + s].yaw = P.yaw; }
      out.push(G[0], G[1], G[2]);
    }
    this.doorN = out.length - this.doorFrom;
  }

  // ---------------------------------------------------------------- 4f · the fog lit as the team last knew it
  /** HAS THE TEAM A LOOK AT FIXTURE t this frame: an eye has the floor under it (the mask's own test), or — inside its field — a line to the fixture itself (a
   *  ceiling panel over a partition he is crouched behind; the lamp he has just shot out), or the team sees floor within two metres of it that it lights (its
   *  pool, or the dark where the pool was, on floor in the picture). */
  lampSeen(t: LightTarget): boolean {
    const x = t.pos[0], y = t.pos[1], z = t.pos[2], col = this.g.col;
    if (this.spotSeen(x, z)) return true;
    for (const e of this.eyes) {
      if (!this.inField(e, t.pos)) continue;
      const dx = x - e.at[0], dy = y - e.at[1], dz = z - e.at[2], d = Math.hypot(dx, dy, dz); if (d < 0.5) return true;
      const k = 1 - 0.3 / d; if (!this.sightBlocked(e.at, [e.at[0] + dx * k, e.at[1] + dy * k, e.at[2] + dz * k])) return true;
    }
    const from: Vec3 = [x, Math.max(0.3, y - 0.3), z];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i & 1 ? 2 : 1, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!col.segmentBlocked(from, [px, 0.3, pz]) && this.spotSeen(px, pz)) return true; }
    return false;
  }
  // ---------------------------------------------------------------- 4g · the full picture, less what the team should not see
  /** lights that would be uploaded with class 1 as the fog's turn ends · lamps out but lit in the fog's picture · lamps whose state the team does not have */
  fullStats = { hidden: 0, ghosts: 0, held: 0 };
  private fullOn = false;
  /** take every class back off the lights (the rule went off, or the fog did) */
  private fullClear() {
    if (!this.fullOn) return; const L = this.g.engine.lights;
    L.fogTeam.on = false; L.fogTeam.owners.clear(); L.fogTeam.lights.clear(); for (const l of L.lights) { l.fog = 0; l.fogGhost = 0; } this.facesLift(); this.faceRecs.clear();
    this.fullOn = false; this.fullStats.hidden = this.fullStats.ghosts = this.fullStats.held = 0;
  }
  /** THE PICTURE'S FACE OF A LAMP (FOG.kept): its boxes drawn lit — as they glowed while the team knew it lit (faceSeen; the level's own emission where
   *  nothing was kept) — or dark, whatever the lamp does, through Box.fogEmit / fogMark, which the upload alone reads (scene/boxes.ts); `lit` undefined = as
   *  it stands. The game's own Box.emissive is never touched. ONLY a box no ray reads the emission of (area-lit: its light is an analytic one; or met by no
   *  ray at all): a face a bounce ray could pick up would put remembered light into the cascades, and so into the light meter the game reads */
  private lampFace(t: Game['targets'][number], lit: boolean | undefined) {
    const st = this.g.engine.world.statics as Box[] | undefined; if (!st) return; const rec = lit ? this.faceRecs.get(t) : undefined;
    for (let i = 0; i < t.boxes.length; i++) { const b = st[t.boxes[i]]; if (!b) continue;
      if (lit === undefined) { if (b.fogEmit) { b.fogEmit = undefined; b.fogMark = undefined; } continue; }
      if (!(b.flags & (BoxFlag.AreaLit | BoxFlag.NoShadow))) continue;
      const k = rec?.[i]; b.fogEmit = lit ? (k && k[0] + k[1] + k[2] > 0 ? k : t.baseEmissive) : DARK; b.fogMark = lit ? 1 : 0; }
  }
  /** a lamp the team knows lit: its face as it glows now is kept, the brightest of the last moments (a tube's dropout or the low of a fire's swing is not the
   *  face remembered; a fire's coals glow at a share of the level's emission — fire.ts — which is why the level's own is not simply taken) */
  private faceSeen(t: Game['targets'][number]) {
    const st = this.g.engine.world.statics as Box[] | undefined; if (!st || !t.boxes.length) return;
    let rec = this.faceRecs.get(t); if (!rec) { rec = t.boxes.map((): Vec3 => [0, 0, 0]); this.faceRecs.set(t, rec); }
    for (let i = 0; i < t.boxes.length; i++) { const b = st[t.boxes[i]]; if (!b) continue; const e = b.emissive, k = rec[i];
      k[0] = Math.max(k[0] * FACE_HOLD, e[0]); k[1] = Math.max(k[1] * FACE_HOLD, e[1]); k[2] = Math.max(k[2] * FACE_HOLD, e[2]); }
  }
  /** every kept face taken off (the fog's full picture went off — or one draw is the viewer's picture without the fog: Game.fogLift), and put back as the
   *  memory has them, without asking who sees what (Game.fogBack: the step's own faces, for the draws until the next update) */
  facesLift() { for (const t of this.g.targets) this.lampFace(t, undefined); }
  facesBack() {
    if (!this.fullOn || !FOG.kept) return; const down = this.g.blackout.active;
    for (const t of this.g.targets) { if (!t.light && !t.areaLights) continue; const known = this.lampRecs.get(t), lit = this.lampLit(t);
      if (known !== undefined && known !== lit && (lit || !(t.mains && down))) this.lampFace(t, !lit); }
  }
  /** WHAT THE FOG HOLDS, FOR A CHECKPOINT (FOG.filed). Only what differs from the world is filed: the doors the picture has at another angle, the lamps it has
   *  in another state (and a lit one's face as it glowed), the furniture it shows where it was last seen, and the furniture it leaves out. An empty slice while
   *  the fog is up and holds nothing; null (no key in the file) with the row off or the fog off. And the bodies the team has seen, which the picture keeps for
   *  good. NOT filed: a living man's last-seen mark (seconds long), rubble and broken pieces (no checkpoint files debris by key), items (their keys are
   *  serials) — those still get the opening half second after a load, as they stand. Read-only on the fog. */
  snapshot(): FogSnap | null {
    if (!FOG.filed || !this.active) return null; const g = this.g, s: FogSnap = {};
    if (FOG.doors) { const doors: [string, number][] = []; for (const d of g.doors.list) { const r = this.doorRecs.get(d); if (r && Math.abs(d.angle - r.shown) > DOOR_EPS) doors.push([d.def.name, r.shown]); } if (doors.length) s.doors = doors; }
    const lamps: [string, 0 | 1, number[][]?][] = [];
    for (const t of g.targets) { const known = this.lampRecs.get(t); if (known === undefined || known === this.lampLit(t)) continue; const face = known ? this.faceRecs.get(t) : undefined;
      lamps.push(face ? [t.name, 1, face.map(v => [v[0], v[1], v[2]])] : [t.name, known ? 1 : 0]); }
    if (lamps.length) s.lamps = lamps;
    const bodies: number[] = []; g.guards.forEach((gd, i) => { if (gd.state === 'dead' && this.recs.get(gd)?.body) bodies.push(i); }); if (bodies.length) s.bodies = bodies;
    if (FOG.things) { const things: [number, number[][]][] = [], out: number[] = [], recs = this.thingRecs;
      for (const [k, r] of recs) if (r.held && isProp(k)) things.push([k, r.ghost.map(q => [q.c[0], q.c[1], q.c[2], q.yaw])]);
      // left out: a prop on the floor the picture has no record of — once the rule has had a frame, or a load made its memory (before either, nothing is known)
      if (this.propsLoaded || this.thingSince >= 0) for (const p of g.props.props) { if (!p.boxes.length) continue; const k = thingKeyOf(p.boxes[0]); if (k >= 0 && !recs.has(k)) out.push(k); }
      if (things.length) s.things = things.sort((a, b) => a[0] - b[0]); if (out.length) s.out = out.sort((a, b) => a - b); }
    return s;
  }
  /** …and handed back after a load has poured the world (savestate.ts loadState, after the restart's reset()): each a record again at once, to come up to date
   *  the frame an eye has it like any the fog made itself. Under the fog only, each kind under its own rule's switch, as snapshot() files them. A file from
   *  before the slice, the row off, a door or a lamp the level does not have, a row of another shape: left out, never a throw. Nothing of `s` is kept.
   *  THE FURNITURE'S MEMORY IS MADE WHOLE HERE: what the file holds where it was last seen, what it leaves out with no record, and every other piece on the
   *  floor at rest where it stands — so the opening half second (things(): everything as it stands) passes the furniture by, and a chair pushed unseen a
   *  moment after the load stays where the team knew it, as it would have carried on. */
  restore(s: FogSnap | null | undefined) {
    if (!s || typeof s !== 'object' || !FOG.filed || !this.active) return;
    const g = this.g, num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v), row = (e: unknown): e is unknown[] => Array.isArray(e);
    this.loaded = true;
    if (FOG.doors && row(s.doors)) for (const e of s.doors) { if (!row(e) || typeof e[0] !== 'string' || !num(e[1])) continue; const d = g.doors.byName(e[0]);
      if (d) this.doorRecs.set(d, { shown: Math.max(d.minA, Math.min(d.maxA, d.sided(e[1]))), ghost: null }); }   // (the angle as this door can have it, as the doors' own slice is poured: a file from a page with two-way leaves)
    const byName = row(s.lamps) && s.lamps.length ? new Map(g.targets.map(t => [t.name, t])) : null;   // (as the targets' own slice finds one: savestate.ts)
    if (byName && row(s.lamps)) for (const e of s.lamps) { if (!row(e) || typeof e[0] !== 'string' || (e[1] !== 0 && e[1] !== 1)) continue; const t = byName.get(e[0]); if (!t || (!t.light && !t.areaLights)) continue; this.lampRecs.set(t, e[1] === 1);
      const F = e[2]; if (e[1] === 1 && row(F) && F.length === t.boxes.length && F.every(v => row(v) && v.length === 3 && v.every(num))) this.faceRecs.set(t, (F as number[][]).map((v): Vec3 => [v[0], v[1], v[2]])); }
    if (row(s.bodies)) for (const i of s.bodies) { const gd = num(i) ? g.guards[i] : undefined; if (gd && gd.state === 'dead' && !this.recs.get(gd)) this.recs.set(gd, { seen: false, t: -1e9, body: true, smoked: false, smokeF: -1e9 }); }
    if (!FOG.things) return;
    const recs = this.thingRecs, byKey = new Map<number, Box[]>(), floor = new Map<number, Box[]>();
    for (const p of g.props.all) if (p.boxes.length) { const k = thingKeyOf(p.boxes[0]); if (k >= 0) byKey.set(k, p.boxes); }   // (PropSystem.all keeps one a blast took: its remembered place is drawn until somebody looks, as the rule's 'left the list' branch has it)
    for (const p of g.props.props) if (p.boxes.length) { const k = thingKeyOf(p.boxes[0]); if (k >= 0) floor.set(k, p.boxes); }
    const rec = (k: number, ghost: Box[], held: boolean) => { let x = 0, z = 0; for (const q of ghost) { x += q.c[0]; z += q.c[2]; } this.span(ghost, 0, ghost.length);
      recs.set(k, { ghost, x: x / ghost.length, z: z / ghost.length, ox: this.spanX, oz: this.spanZ, f: -1, moving: false, held }); };
    if (row(s.things)) for (const e of s.things) { if (!row(e) || !num(e[0]) || !row(e[1])) continue; const B = byKey.get(e[0]), P = e[1]; if (!B || P.length !== B.length || !P.every(p => row(p) && p.length === 4 && p.every(num))) continue;
      let moved = 0; const ghost = B.map((b, k): Box => { const p = P[k] as number[], q = ghostBox(b); moved += Math.abs(b.c[0] - p[0]) + Math.abs(b.c[1] - p[1]) + Math.abs(b.c[2] - p[2]) + Math.abs(b.yaw - p[3]); q.c = [p[0], p[1], p[2]]; q.yaw = p[3]; return q; });
      if (moved >= THING_EPS || !floor.has(e[0])) rec(e[0], ghost, true); }   // (one that stands where the file has it is at rest there: the pass below — one a blast took is held where it stood)
    const out = new Set<number>(); if (row(s.out)) for (const k of s.out) if (num(k) && !recs.has(k)) out.add(k);
    for (const [k, B] of floor) if (!recs.has(k) && !out.has(k)) rec(k, B.map(ghostBox), false);   // (at rest where it stands, as the team knows it)
    this.propsLoaded = true;
  }
  /** is the fixture lit, as it stands */
  private lampLit(t: Game['targets'][number]): boolean { return t.on && !t.broken && !(t.disabledUntil > 0 && this.g.time < t.disabledUntil); }
  /** the fixture as the team last saw it (4f's memory, which 4g goes by too): first met = as it stands; it comes up to date the frame it differs and the team
   *  has a look at it (lampSeen) */
  private lampKnown(t: Game['targets'][number], lit: boolean): boolean {
    let rec = this.lampRecs.get(t);
    if (rec === undefined || (rec !== lit && this.lampSeen(t))) { rec = lit; this.lampRecs.set(t, rec); }
    return rec;
  }
  /** THE LIGHTS' CLASSES for this frame (rule 4g — the picture only, nothing here is read by the game): who the team is, for the upload to class every other
   *  carried light and flash by (lights.ts LightSet.fogTeam / fogClass), and the level's lamps the team has in another state than they are in (RtLight.fog /
   *  fogGhost). false = the rule is off and every class is taken back off. The block's own rows (4e / 4f) are filled all the same after this: they are what the
   *  renderer draws until its sight table is live (FogFrame.sight). */
  private fullBlock(F: FogFrame): boolean {
    if (!FOG.full) { this.fullClear(); return false; }
    const g = this.g, S = this.fullStats, L = g.engine.lights, T = L.fogTeam; S.hidden = S.ghosts = S.held = 0; this.fullOn = true;
    F.fullFlat = Math.max(0, FOG.flat * FOG.fullFill);
    // (1) what a man carries who is not on the team, and every flash that is not a teammate's own: only where the team sees
    T.on = true; T.owners.clear(); T.lights.clear(); T.owners.add(g.player.char.id); if (g.player.light) T.lights.add(g.player.light);
    for (const gd of g.guards) if (this.onTeam(gd)) { T.owners.add(gd.char.id); if (gd.flashlight) T.lights.add(gd.flashlight); }
    // (2) the level's own lamps as the team last saw each: out but remembered lit = lit where nobody sees; lit but remembered out = lit only where the team sees
    const down = g.blackout.active, es = g.engine.settings.emissiveScale;
    for (const t of g.targets) {
      if (!t.light && !t.areaLights) continue;
      if (t.light) { t.light.fog = 0; t.light.fogGhost = 0; } if (t.areaLights) for (const al of t.areaLights) { al.light.fog = 0; al.light.fogGhost = 0; }
      this.lampFace(t, undefined);
      const lit = this.lampLit(t), known = this.lampKnown(t, lit);
      if (known === lit) { if (lit && FOG.kept) this.faceSeen(t); continue; }
      S.held++;
      if (FOG.kept && (lit || !(t.mains && down))) this.lampFace(t, !lit);   // (its face as the team last saw it: dark while it is lit unseen, lit while it is out unseen — a blackout is known to all, as below)
      if (lit) { if (t.light) t.light.fog = 1; if (t.areaLights) for (const al of t.areaLights) al.light.fog = 1; }
      else if (!(t.mains && down)) { S.ghosts++; if (t.light) t.light.fogGhost = t.light.steady?.intensity ?? t.baseIntensity; if (t.areaLights) for (const al of t.areaLights) al.light.fogGhost = al.base * es; }   // (a fire put out unseen is remembered at a fire's strength, as a burning one is below: game/fire.ts `held`)
    }
    for (const l of L.lights) if (L.fogClass(l) === 1) S.hidden++;
    return true;
  }
  private lampTake(l: RtLight, I: number, far: boolean) {
    if (!(I > 0)) return; const pick = this.lampPick, pp = this.g.player.char.pos, r = pick[this.lampN] ?? (pick[this.lampN] = { l, I: 0, d: 0 });
    r.l = l; r.I = I; r.d = far ? -1 : Math.max(0, Math.hypot(l.pos[0] - pp[0], l.pos[2] - pp[2]) - l.range); this.lampN++;
  }
  /** The lit fog's rows of the renderer's block: the levels, and the lamps (FogFrame.lights, lights.ts packLight) — every fixture of the level that carries light
   *  and that the team has as lit, at its own full strength (no flicker, no restrike ramp: the fog's light does not move), unless the mains feed it and are
   *  down; then the sun or moon. A fixture's memory comes up to date the frame it differs and the team has a look at it (lampSeen). More than FOG_LIGHTS: the
   *  ones whose reach is nearest the player (a level that has so many has rooms far from him go unlit in the fog). Nothing here is read by the game. */
  private litBlock(F: FogFrame) {
    const g = this.g, S = this.litStats; S.lamps = S.lights = S.held = 0;
    if (!(FOG.lit > 0) || !(FOG.flat > 0)) { F.lit = 0; F.lightCount = 0; if (this.lampRecs.size && !FOG.full) this.lampRecs.clear(); return; }   // (the full picture goes by the same memory)
    F.lit = FOG.lit; F.litFill = Math.max(0, FOG.flat * FOG.litFill); F.litCut = Math.max(0, FOG.litCut); F.litAo = Math.min(1, Math.max(0, FOG.litAo)); F.litAoM = Math.max(0, FOG.litAoM);
    this.lampN = 0;
    for (const l of g.engine.lights.lights) if (l.kind === 2 && l.ttl < 0 && !l.transient && l.enabled) this.lampTake(l, l.intensity, true);   // the sun or moon (never the lightning: a transient)
    const down = g.blackout.active, es = g.engine.settings.emissiveScale;
    for (const t of g.targets) {
      if (!t.light && !t.areaLights) continue;
      S.lamps++;
      const lit = this.lampLit(t), rec = this.lampKnown(t, lit);
      if (rec !== lit) S.held++;
      if (!rec || (t.mains && down)) continue;
      if (t.light) this.lampTake(t.light, t.light.steady?.intensity ?? t.baseIntensity, false);   // (a burning fire's lamp is the fire's own steady strength, game/fire.ts FIRE.bright: the colour and reach packed below are the fire's too, so the remembered ground is as bright as the seen)
      if (t.areaLights) for (const al of t.areaLights) this.lampTake(al.light, al.base * es, false);
    }
    const pick = this.lampPick; let n = this.lampN;
    if (n > FOG_LIGHTS) { pick.length = n; pick.sort((a, b) => a.d - b.d); n = FOG_LIGHTS; }
    for (let i = 0; i < n; i++) { const l = pick[i].l, live = l.pos, size = l.radius; if (l.steady) { l.pos = l.steady.pos; l.radius = l.steady.radius; }   // (a fire's lamp wanders with its flames and is as big as they are, game/fire.ts: the fog has it where the level hung it, the size the level gave it)
      packLight(F.lights, F.lightsU, i * 16, l, pick[i].I, l.kind, 0, 0); l.pos = live; l.radius = size; }
    F.lightCount = S.lights = n;
  }

  // ---------------------------------------------------------------- 4d · nothing moves in the fog
  /** is the floor at (x, z) in the lit part of the picture: some eye has it in its field and a level line to it at the picture's own eye height — the mask's
   *  rule (shaders/fogofwar.wgsl), on the statics and leaves the CPU's sight test walks */
  spotSeen(x: number, z: number): boolean { this.thingStats.tests++; return this.groundLook(x, z) === 2; }
  /** `spotSeen`'s walk, off the things' count, with what it found on the way: 2 = an eye has the spot (within its reach, or in its field with a clear line);
   *  1 = in an eye's field and every such eye's line stopped; 0 = in no eye's field (no line was walked; with no cone every spot is in one). snowTracks.ts
   *  FOG.tracks asks it for the snow a kept mark lies on. */
  groundLook(x: number, z: number): 0 | 1 | 2 {
    let r: 0 | 1 = 0;
    for (const e of this.eyes) {
      const dx = x - e.at[0], dz = z - e.at[2], d = Math.hypot(dx, dz); if (d < 0.4) return 2;
      const y = e.at[1]; if (!this.inField(e, [x, y, z])) continue;
      r = 1; const k = 1 - 0.12 / d; if (!this.sightBlocked(e.at, [e.at[0] + dx * k, y, e.at[2] + dz * k])) return 2;
    }
    return r;
  }
  /** THE PICTURE'S LIST OF LOOSE THINGS (Game.drawCharacters, the ONE place the frame's dynamic boxes are handed to the renderer): the list itself while the fog
   *  is off or nothing is held or left out — else that list REWRITTEN, thing by thing (a keyed box, or the run of keyed parts of one prop / item): live where the team sees the floor it is on; out of sight, the
   *  copy of it where it was last seen AT REST, or nothing (never seen, or last seen on the move); an unkeyed box (a flash, a tracer, a spark: one frame's
   *  effect) only where it is seen. What is remembered is also what casts the shadow, stops the picture's own eye rays and takes the cursor: one picture. */
  /** A one-frame box's spot, asked once per half-metre square a frame (a burst of sparks is one question). */
  private cellSeenAt(x: number, z: number): boolean {
    const k = (Math.floor(x * 2) + 4096) * 16384 + Math.floor(z * 2) + 4096; let v = this.cellSeen.get(k);
    if (v === undefined) { v = this.spotSeen(x, z); this.cellSeen.set(k, v); } return v;
  }
  /** A THING is seen where its middle is, or — a long one (a table, a cabinet) — either end of its long side: it is rigid, so whoever sees a part of it move has seen
   *  it move, and a part in plain view standing still while the thing has gone would be the picture lying about floor the team DOES see. */
  thingSeen(x: number, z: number, ox: number, oz: number): boolean {
    return this.spotSeen(x, z) || ((ox !== 0 || oz !== 0) && (this.spotSeen(x + ox, z + oz) || this.spotSeen(x - ox, z - oz)));
  }
  /** The long side of boxes i‥j of a list into spanX / spanZ (its biggest box's long axis in plan, 15 cm in from the ends; 0, 0 under 0.9 m long). */
  private span(list: Box[], i: number, j: number) {
    let best = 0.45; this.spanX = this.spanZ = 0;
    for (let k = i; k < j; k++) { const b = list[k], alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2]; if (L <= best) continue;
      best = L; const m = L - 0.15, cs = Math.cos(b.yaw) * m, sn = Math.sin(b.yaw) * m; this.spanX = alongX ? cs : sn; this.spanZ = alongX ? -sn : cs; }
  }
  /** Does the team see this thing (its boxes as a list)? — the rule's own test, for QA. */
  seesThing(boxes: Box[]): boolean {
    let x = 0, z = 0; for (const b of boxes) { x += b.c[0]; z += b.c[2]; } x /= boxes.length; z /= boxes.length;
    this.span(boxes, 0, boxes.length); return this.thingSeen(x, z, this.spanX, this.spanZ);
  }
  things(list: Box[]): Box[] {
    const S = this.thingStats; S.held = S.out = S.tests = 0;
    if (this.viewer && this.active) {   // (a viewer may ask for the picture without the fog: the list as the game made it, every leaf where it stands — copied, never read by a step)
      const R = this.rawList; R.length = 0; let i = 0;
      if (this.doorN) { for (; i < this.doorFrom; i++) R.push(list[i]); this.g.doors.boxes(R); i = this.doorFrom + this.doorN; }
      for (; i < list.length; i++) R.push(list[i]);
      this.rawAt = this.frameNo;
    }
    if (!this.active || !FOG.things || !this.eyes.length) { if (this.thingRecs.size) this.thingRecs.clear(); this.thingSince = -1; this.propsLoaded = false; return list; }
    const out = this.thingOut, recs = this.thingRecs, f = this.frameNo; out.length = 0;
    if (this.thingSince < 0 || f < this.thingSince) this.thingSince = f;
    const prime = f - this.thingSince < THING_PRIME;   // (the first half second of an encounter — or of the rule: everything is taken as it stands, the building as the team knows it)
    if (!prime) this.propsLoaded = false; const loadedP = this.propsLoaded;   // (FOG.filed: a load made the furniture's memory, so its opening half second takes none of it as it stands — the rule below asks it like any frame's)
    this.cellSeen.clear();
    const ours = this.oursOn, team = this.g.engine.lights.fogTeam.owners;
    // THE TEAM'S OWN RUBBLE (FOG.ours): a chunk one of the team threw (debris.ts Chunk.who: the round or the charge that set it going) is the team's doing on
    // its FIRST way down — until the picture has it at rest (the frame it lands unseen would otherwise drop it as 'last seen on the move'). After that it is a
    // thing like any other: woken where nobody sees (a body falls on it, the chair under it moves — nobody is re-blamed for those) it stays where the picture has
    // it. A piece a boot slides is nobody's. A kinked panel's second box (Chunk.mate) is a thing of its own key: both are taken.
    const mineK = this.ourChunks, landed = this.ourLanded; if (mineK.size) mineK.clear();
    const D = ours && !prime ? this.g.destr?.debris.list : undefined;
    if (D && D.length) { for (const c of D) { if (c.foot || !team.has(c.who)) continue;
      const k = thingKeyOf(c.box); if (landed.has(k)) continue;
      if (c.rest) { const r = recs.get(k); if (r && !r.moving) { landed.add(k); continue; } }
      mineK.add(k); if (c.mate && c.mate.mkey !== undefined) mineK.add(thingKeyOf(c.mate)); }
    } else if (landed.size) landed.clear();   // (the pool is empty — a restart, an encounter's end: its serials start a new life)
    const n = list.length;
    for (let i = 0; i < n;) {
      const b = list[i];
      if (i >= this.rigFrom && i < this.rigTo) { out.push(b); i++; continue; }
      if (b.mkey === undefined) { if (prime || (ours && b.owner !== 0 && team.has(b.owner)) || this.cellSeenAt(b.c[0], b.c[2])) out.push(b); else S.out++; i++; continue; }   // (a tracer's streak among them: where its middle is seen — a teammate's own, FOG.ours, its whole length)
      const tk = thingKeyOf(b); if (tk < 0) { out.push(b); i++; continue; }
      let j = i + 1; while (j < n && list[j].mkey !== undefined && thingKeyOf(list[j]) === tk) j++;
      let x = 0, z = 0; for (let k = i; k < j; k++) { x += list[k].c[0]; z += list[k].c[2]; } x /= j - i; z /= j - i;
      this.span(list, i, j); const ox = this.spanX, oz = this.spanZ;
      let r = recs.get(tk);
      const live = () => { for (let k = i; k < j; k++) out.push(list[k]); };
      const take = (moving: boolean) => {   // the picture has it as it stands
        if (!r) { r = { ghost: [], x, z, ox, oz, f, moving, held: false }; recs.set(tk, r); }
        const G = r.ghost; G.length = j - i;
        for (let k = i; k < j; k++) G[k - i] = ghostBox(list[k]);
        r.x = x; r.z = z; r.ox = ox; r.oz = oz; r.moving = moving; r.held = false;
      };
      const mine = mineK.size > 0 && mineK.has(tk);
      const pr = prime && !(loadedP && isProp(tk));
      if (!r) { if (pr || mine || this.thingSeen(x, z, ox, oz)) { take(!pr); r!.f = f; live(); } else S.out++; i = j; continue; }   // (first seen in play: nobody knows yet that it is at rest — the next frame it stands unmoved says so; lost to sight before that, it was last seen on the move)
      r.f = f;
      let same = r.ghost.length === j - i;
      for (let k = i; same && k < j; k++) { const s = list[k], q = r.ghost[k - i];
        same = Math.abs(s.c[0] - q.c[0]) + Math.abs(s.c[1] - q.c[1]) + Math.abs(s.c[2] - q.c[2]) < THING_EPS && Math.abs(s.yaw - q.yaw) < THING_EPS
          && (!s.rot || !q.rot || Math.abs(s.rot[0] - q.rot[0]) + Math.abs(s.rot[1] - q.rot[1]) + Math.abs(s.rot[2] - q.rot[2]) + Math.abs(s.rot[3] - q.rot[3]) < THING_EPS); }
      if (same) { r.moving = false; r.held = false; live(); i = j; continue; }   // where the picture has it
      if (pr || mine || ((!r.held || (f + tk) % THING_EVERY === 0) && this.thingSeen(x, z, ox, oz))) { take(true); live(); i = j; continue; }   // it moved in the team's sight (or is the team's own rubble, on its way down)
      // it moved (or is still moving) where nobody sees it
      if (!r.held) { if (r.moving || this.thingSeen(r.x, r.z, r.ox, r.oz)) { recs.delete(tk); S.out++; i = j; continue; } r.held = true; }   // (last seen on the move, or the team is looking at the place it left: it is simply not there)
      else if ((f + tk) % THING_EVERY === 1 && this.thingSeen(r.x, r.z, r.ox, r.oz)) { recs.delete(tk); S.out++; i = j; continue; }
      for (const q of r.ghost) out.push(q); S.held++; i = j;
    }
    // what has left the list altogether (broken up, picked up, burnt out) out of sight: still in the picture where it was, until somebody looks there
    if (recs.size) for (const [tk, r] of recs) { if (r.f === f) continue;
      if (r.moving || recs.size > THING_CAP || ((f + tk) % THING_EVERY === 1 || !r.held) && this.thingSeen(r.x, r.z, r.ox, r.oz)) { recs.delete(tk); continue; }
      r.held = true; for (const q of r.ghost) out.push(q); S.held++; }
    if (S.held || S.out) { list.length = out.length; for (let i = 0; i < out.length; i++) list[i] = out[i]; }   // (the frame's own list, rewritten — as the leaves' remembered boxes are written into it: whoever is handed Game.dynBoxes has the picture's)
    return list;
  }

  /** THE STRETCHES OF A BEAM THE TEAM CAN SEE: [t0, t1] pairs along `from + dir·t`, 0 ≤ t ≤ L (the whole of it while the fog is off or FOG.lasers is). Looked at
   *  every BEAM_STEP, each end of a seen stretch then found by bisection — a beam is a line in the air: a stretch behind a wall is nobody's to see. */
  beamRuns(from: Vec3, dir: Vec3, L: number): [number, number][] {
    if (!this.active || !FOG.lasers) return [[0, L]];
    const at = (t: number): Vec3 => v3.mad(from, dir, Math.min(t, Math.max(0, L - 0.05)));   // (the last of it lies ON what it lands on: looked at a hand short)
    const see = (t: number) => this.eyeOn(at(t));
    const edge = (lit: number, dark: number) => { while (Math.abs(dark - lit) > BEAM_FINE) { const m = (lit + dark) / 2; if (see(m)) lit = m; else dark = m; } return lit; };
    const runs: [number, number][] = []; const n = Math.max(1, Math.ceil(L / BEAM_STEP));
    let open = -1, prev = false, prevT = 0;
    for (let k = 0; k <= n; k++) {
      const t = k === n ? L : k * BEAM_STEP; const s = see(t);
      if (s && !prev) open = k === 0 ? 0 : edge(t, prevT);
      if (!s && prev) { runs.push([open, edge(prevT, t)]); open = -1; }
      prev = s; prevT = t;
    }
    if (prev) runs.push([open, L]);
    return runs;
  }

  /** THE ANSWER, per character, as of this frame's update: does anybody on the team see him. True for the team itself, and for everybody while it is off. */
  seen(gd: Guard): boolean { if (!this.active || this.onTeam(gd)) return true; return this.recs.get(gd)?.seen ?? false; }
  /** WHERE THE TEAM LAST HAD HIM, AND HOW LONG AGO (wallcharge.ts knownFoes, picture.ts knownPlaces: the squad's shared sight, the one record the player is shown; with picture.ts's rules on the men also act on what they heard or were told): seen now = where he
   *  stands, 0 s (so is a man the squad is shooting at: firedOn — he is in the picture, and whoever is firing at him knows where); seen before = where he
   *  stood at that sighting; never = null. Off or standing aside the picture shows everybody: where he stands. */
  sighting(gd: Guard): { at: Vec3; age: number } | null {
    if (!this.active) return { at: gd.char.pos, age: 0 };
    const r = this.recs.get(gd); if (r?.seen || this.firedOn(gd)) return { at: gd.char.pos, age: 0 }; if (!r) return null;
    return r.seen ? { at: gd.char.pos, age: 0 } : r.at ? { at: [r.at[0], r.at[1], r.at[2]], age: this.g.time - r.t } : null;   // (a copy: the record's own vector is written in place at every sighting)
  }
  /** is he in the picture: seen, or seen a moment ago (FOG.linger), or a body the team has seen */
  drawn(gd: Guard): boolean {
    if (!this.active || this.onTeam(gd)) return true;
    const r = this.recs.get(gd); if (!r) return false;
    if (r.seen || (gd.state === 'dead' && r.body)) return true;
    const since = this.g.time - r.t; return (since >= 0 && since < FOG.linger) || this.firedOn(gd) || this.shown.has(gd) || !!r.framed;
  }
  /** is the squad shooting at him: a teammate's aimed round went at him inside FOG.squadFireSecs (false while the rule is off) */
  firedOn(gd: Guard): boolean { if (!FOG.squadFire) return false; const t = this.firedAt.get(gd); return t !== undefined && this.fireClock - t < FOG.squadFireSecs; }
  /** THE LAST SIGHTINGS (FOG.lastSeen seconds of them, or at 0 the seconds of told.ts's rung; none while both are 0 or the fog stands aside): each living enemy who is out of the picture now and was
   *  in it that recently — where he stood when last seen, and how long ago. The HUD marks each with a '?' that fades (ui/overlay.ts); nobody's AI reads it. */
  lastSeen(): { gd: Guard; at: Vec3; age: number; life: number }[] {
    const secs = FOG.lastSeen > 0 ? FOG.lastSeen : toldLastSeen();   // (the debugger's row, turned up, is the mark's seconds whatever the lever says; at 0 the 'you're told' lever decides — told.ts: its seconds on Guided and Standard, 0 on Bare and with that lever off, which is FOG.lastSeen alone, as it was)
    const out: { gd: Guard; at: Vec3; age: number; life: number }[] = []; if (!this.active || this.bared || !(secs > 0 || (WAND.on && WAND.markSecs > 0))) return out;
    for (const gd of this.g.guards) { if (gd.state === 'dead' || !isHostile(gd.team, 'player') || !this.hiddenChars.has(gd.char)) continue;
      const r = this.recs.get(gd); if (!r || !r.at) continue; const age = this.g.time - r.t;
      // (a man the wand's lens had when he was last seen keeps his mark WAND.markSecs — what a look under a door leaves its owner with; anybody else FOG.lastSeen, as ever)
      const life = WAND.on && r.wandT !== undefined && Math.abs(r.t - r.wandT) < 0.5 ? Math.max(secs, WAND.markSecs) : secs;
      if (age >= 0 && age < life) out.push({ gd, at: r.at, age, life }); }
    return out;
  }
  /** left out of the picture this frame (what combat.ts handProps, the HUD's markers and the bubbles ask) — false for everybody while it is off */
  hidden(gd: Guard): boolean { return !this.bared && this.hiddenChars.size > 0 && this.hiddenChars.has(gd.char); }
  /** this frame's things that are the team's own rubble on its first way down · the ones the picture has since taken at rest (things()) */
  private ourChunks = new Set<number>(); private ourLanded = new Set<number>();
  /** the rule is live: the row on, the fog on, and the full picture's block filled this frame (the team's ids are the lights' own list, fullBlock) */
  private get oursOn(): boolean { return FOG.ours && this.active && this.fullOn; }
  /** IS WHAT `who` DOES THE TEAM'S OWN TO SEE (FOG.ours)? — false while the fog is off (nothing is cut then), with the row off, outside the full picture, for
   *  nobody (0), and for anybody not on the team. Read off the list of the team the fog filled for the lights (LightSet.fogTeam.owners — the dead too: a can
   *  thrown by a man since shot is still the team's), never off g.guards: a blast is judged with that list swapped out (combat.ts detonateStun's callers) */
  oursId(who: number | undefined): boolean { return !!who && this.oursOn && this.g.engine.lights.fogTeam.owners.has(who); }
  /** A LIGHT `who` MADE WITHOUT CARRYING IT (a blast's flash, a round's ember): its fog class is its doer's (lights.ts fogClass), so the team's own lights the
   *  fog's picture too and anybody else's is cut there as an ownerless flash always was. Nothing with the row off */
  lightBy(l: RtLight, who: number | undefined): RtLight { if (FOG.ours && who) l.fogBy = who; return l; }
  /** WHAT IS FILED FROM HERE TO done() IS `who`'S DOING: the particles are marked the team's own when he is on it (Particles.ours — drawn under the fog), and
   *  not when he is not; nobody (0) leaves the doing as it stands, so a blast inside a blast keeps its first cause. Returns what done() puts back (−1: nothing —
   *  the row off, nobody, no GPU particles). A caller pairs the two in a try / finally (no closure on the round's path) */
  begin(who: number | undefined): number { const P = FOG.ours && who ? gpuFx(this.g) : null; if (!P) return -1; const was = P.ours ? 1 : 0; P.ours = this.oursId(who); return was; }
  done(was: number) { if (was < 0) return; const P = gpuFx(this.g); if (P) P.ours = was === 1; }
  /** begin() / done() round `fn` (the blasts: a closure a blast is nothing) */
  doing<T>(who: number | undefined, fn: () => T): T { const was = this.begin(who); try { return fn(); } finally { this.done(was); } }
  /** THE REST OF THIS DOING IS NOT SHOWN (a round that stopped in a man nobody on the team sees: no spray off him says where he stands). The done() that closes
   *  the doing puts the mark back */
  hush() { if (!FOG.ours) return; const P = gpuFx(this.g); if (P) P.ours = false; }
  /** WHAT A HIDDEN MAN PUTS INTO THE AIR IS NOT FILED (FOG.air: smoke is drawn under the fog, so the gas of a shot nobody on the team sees fired would hang
   *  at his muzzle and ride it): true = `c` is out of the picture and what he would hand the smoke solver now is left out — as his breath and his cigarette
   *  already are. False with FOG.air off, and under a fog that is not the full picture (?fogfull=0: nothing draws smoke under that one): the march cuts all
   *  smoke there, and the solver gets everything, as it was */
  airHides(c: Character): boolean { return FOG.air && this.fullOn && !this.bared && this.hiddenChars.size > 0 && this.hiddenChars.has(c); }
  /** the characters to draw, of the frame's list: the list itself while nobody is hidden */
  filter(all: Character[]): Character[] { return this.hiddenChars.size ? all.filter(c => !this.hiddenChars.has(c)) : all; }
  /** …and for a viewer's picture without the fog: everybody, the men the fog leaves out LAST (the men it draws keep their places in the draw list) */
  everybody(all: Character[]): Character[] { return this.hiddenChars.size ? [...this.filter(all), ...all.filter(c => this.hiddenChars.has(c))] : all; }
  /** this frame's list of boxes as it stood before the fog cut it (a fresh copy), or null: no viewer, the fog standing aside, or nothing kept for this frame */
  raw(): Box[] | null { return this.viewer && this.active && this.rawAt === this.frameNo ? this.rawList.slice() : null; }

  /** one line for the panel / the console */
  summary(): string {
    if (!this.on) return 'fog of war off';
    if (!this.active) return 'fog of war on — standing aside for the show';
    const S = this.stats;
    return `fog of war on · ${S.eyes} eye${S.eyes === 1 ? '' : 's'} · ${S.seen}/${S.tested} seen, ${S.hidden} hidden${S.smokeHid ? ` · smoke hid ${S.smokeHid}` : ''}${fieldDeg() < 360 ? ` · ${fieldDeg()}° ${FOG.cone ? 'cone' : 'field'}` : ''}${FOG.own ? ' · your eyes only' : ''}`;
  }
}
