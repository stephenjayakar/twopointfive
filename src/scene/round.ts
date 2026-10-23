// ROUND THINGS ARE ROUND ("Round things into the game": drums, tyres, stoves, the oven).
// The level kit (scene/gwotKit.ts round) stands a round thing up as an OCTAGON of four slabs through one centre, 45° apart, and every level file carries those four
// boxes. With the switch up, when a level is stood up (host/standup.ts populateHost, before its boxes go to the world and before the Game is built) each octagon
// becomes ONE box that is ROUND (Box.round): the cylinder about the box's own y, radius h[0] (= h[2]), half height h[1].
//
// ONE MODEL — everybody meets the same round:
//   · the picture: the g-buffer's cut pass draws it (a twelve-sided prism standing round the cylinder; its sides shaded with one turning normal, its marks run
//     round it, a rolled rim on its lid — gbuffer_cut.wgsl ROUND);
//   · GPU rays: common.wgsl isectBox behind the scene prelude's `const ROUND_BOXES` (shadows, bounce, reflections, the light meter, smoke sight lines, particles);
//   · CPU rays and segments: boxes.ts rayBox, collision.ts lineBox (rounds, aim, sight, sound, throw arcs, the cursor);
//   · MOVEMENT: collision.ts collideCircle / circleTouches push a body off the circle, and the walk grid is baked by the same question.
// What still meets the box round it (a square of side 2 × radius, its sides along the world's axes): the trace grid's and the ray grid's registration (a superset:
// it only costs a test), a shoved prop's, a ragdoll's and a piece of debris's own contact, the smoke solver's obstacle bake, the replay's map, and a blast, which
// takes it as that box (furnblast.ts). A round thing a round can chew through (wallbreak.ts: one in a cover paint) is ONE cell: it goes whole, never in pieces.
//
// The other three slabs stay in the list where they were (a level file's box indices are names) as specks no pass, ray or body meets. What each box was is kept
// on it (Box.was): the level's fingerprint is taken over the boxes AS AUTHORED (savestate.ts), so a checkpoint or a recording is this level's with the switch up
// or down, and roundLevel(…, false) puts every box back.
//
// THE SWITCH: ROUND.on — ON in the page (`?round=0` puts it off), OFF in the module and on the frozen
// stand (FROZEN_HOLDS; TPS_ROUND=1 raises it there). Read ONCE, as a level is stood up: a recording from before the table has it put down before its level stands
// (roundTape: replay/engineplay.ts and tools/qa/rerun.ts `tables`; journal.ts applyKnobs says the same afterwards), and the debugger's row reloads the page. Off =
// no box touched, no flag, no branch taken: the build as it was by run digest. The GPU's half is roundConfig.gpu, raised at boot before the first pipeline is
// compiled (main.ts: the switch AND the cut switch, whose table and pipeline draw a round); without it (`?nocutboxes`) a round box is drawn and traced by the GPU as
// the square box round it while the game still meets the cylinder — the switch is the simulation's, and a picture setting may not move it.
// CHECK: tools/qa/round-check.ts (probes.ts round; ROUND_BREAK=1 must fail), both stands. Nothing here has been seen on a GPU.
import { BoxFlag, type Box } from './boxes';
import { MARKING_TEXEL, MAX_MARKS_PER_BOX, texelOf, type MarkingDef, type MarkFace } from './markings';
import type { Vec3 } from '../math/vec';

export const ROUND = {
  /** the switch */
  on: false,
};
/** the GPU's half: the scene prelude's ROUND_BOXES const, the round bit in a box's flags word and the prism's rows in the cut table. Mutate only at boot. */
export const roundConfig = { gpu: false };
export const ROUND_STATS = { made: 0, levels: 0 };

/** the round's radius over the octagon's inner one (its slabs' half length): the circle with the octagon's own area, √(8 tan 22.5° ÷ π). The kit's slabs are 0.96
 *  of the radius it was asked for, so a kit drum's round is 0.985 of that. */
const R_OF_SLAB = 1.026;
const near = (a: number, b: number, e = 1e-4) => Math.abs(a - b) < e;
const TAN8 = Math.tan(Math.PI / 8);
/** an octagon of slabs, as the kit and the level generators write a round thing: boxes[i‥i+3] are four plain slabs through one centre, 45° apart, tan 22.5° as
 *  deep as they are long, in one paint, on one floor, their tops stepped down by one small step (2 mm from the kit, 3 mm from two older generators) */
function octagonAt(B: readonly Box[], i: number): boolean {
  const a = B[i];
  if (i + 3 >= B.length || a.rot || a.cut || a.round || a.flags !== 0 || !near(a.h[2], a.h[0] * TAN8, a.h[0] * 0.01)) return false;
  const top = a.c[1] + a.h[1], step = top - (B[i + 1].c[1] + B[i + 1].h[1]); if (!(step > 0.0005 && step < 0.0045)) return false;
  for (let k = 1; k < 4; k++) {
    const b = B[i + k];
    if (b.rot || b.cut || b.round || b.flags !== 0 || !near(b.c[0], a.c[0]) || !near(b.c[2], a.c[2]) || !near(b.h[0], a.h[0]) || !near(b.h[2], a.h[2])) return false;
    if (!near(b.yaw - a.yaw, k * Math.PI / 4, 1e-3) || !near(b.c[1] - b.h[1], a.c[1] - a.h[1], 1e-3) || !near(b.c[1] + b.h[1], top - step * k, 2e-4)) return false;
    if (b.albedo[0] !== a.albedo[0] || b.albedo[1] !== a.albedo[1] || b.albedo[2] !== a.albedo[2]) return false;
  }
  return true;
}
/** a round patch on a lid (a tyre's hole, an oven's mouth): the slab's own +y mark was cut to the slab, so it is drawn again as a disc of radius R */
function discMark(like: MarkingDef, R: number, texel: number): MarkingDef {
  const t = texelOf(like, texel), N = Math.min(32, 2 * Math.ceil(R / t) + 2), cells: string[] = [];
  for (let j = N - 1; j >= 0; j--) { let row = ''; for (let i = 0; i < N; i++) row += Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) * t < R ? 'a' : '.'; cells.push(row); }
  return { face: '+y', ...(like.res ? { res: like.res } : {}), at: [-N / 2, -N / 2], size: [N, N], pal: [like.pal[0]], cells };
}
const SIDES: readonly MarkFace[] = ['+x', '-x', '+z', '-z'];
/** the octagons of a box list, as the index of each one's first slab (a level file's, or a stood level's with the switch down) */
export function findOctagons(boxes: readonly Box[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 3 < boxes.length; i++) if (octagonAt(boxes, i)) { out.push(i); i += 3; }
  return out;
}

/** A LEVEL'S ROUND THINGS, as it is stood up. `on`: every octagon becomes one round box (Box.round) and its other three slabs specks nothing meets; what each
 *  box was is kept on it (Box.was). Always first: every box rounded by an earlier call is put back as authored — so the call is idempotent, and `on` false leaves
 *  the list as its file has it. Returns how many round things the list has now. */
export function roundLevel(boxes: Box[], on: boolean, texel = MARKING_TEXEL): number {
  for (const b of boxes) {
    const w = b.was; if (!w) continue;
    b.c = w.c; b.h = w.h; b.yaw = w.yaw; b.flags = w.flags; if (w.marks) b.marks = w.marks; else delete b.marks;
    delete b.round; delete b.was;
  }
  let made = 0;
  if (on) for (const i of findOctagons(boxes)) {
    const a = boxes[i], R = a.h[0] * R_OF_SLAB;
    const all = [0, 1, 2, 3].flatMap(k => boxes[i + k].marks ?? []);
    const band = all.find(m => m.face === '+z' || m.face === '-z');   // a slab's long face carries the whole band (a drum's ribs); its short ends carry a cut of it
    const lid = (a.marks ?? []).find(m => m.face === '+y');
    const marks: MarkingDef[] = [];
    if (lid && lid.pal.length === 1) marks.push(discMark(lid, R * 0.5, texel));   // (a lid of two paints is a drum's: its rim is the shader's, its bung is let go)
    if (band) for (const f of SIDES) if (marks.length < MAX_MARKS_PER_BOX) marks.push({ ...band, face: f });
    for (let k = 0; k < 4; k++) { const b = boxes[i + k]; b.was = { c: b.c, h: b.h, yaw: b.yaw, flags: b.flags, ...(b.marks ? { marks: b.marks } : {}) }; }
    a.h = [R, a.h[1], R]; a.yaw = 0; a.round = true;   // (yaw 0: whoever reads only the box — a blast's footprint, a ragdoll, the replay's map — gets the tightest square round the circle)
    if (marks.length) a.marks = marks; else delete a.marks;
    for (let k = 1; k < 4; k++) { const b = boxes[i + k]; b.flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; b.c = [a.c[0], a.c[1], a.c[2]]; b.h = [0.01, 0.01, 0.01]; delete b.marks; }
    made++;
  }
  ROUND_STATS.made = made; ROUND_STATS.levels++;
  return made;
}
/** a box's centre and half extents as its level AUTHORED them (the level's fingerprint: savestate.ts) */
export const authoredC = (b: Box): Vec3 => b.was ? b.was.c : b.c;
export const authoredH = (b: Box): Vec3 => b.was ? b.was.h : b.h;

/** A RECORDING'S TABLES, before its level is stood up (replay/engineplay.ts and tools/qa/rerun.ts `tables`): one from before this table is played on a floor
 *  whose round things are the kit's octagons, as it was recorded — journal.ts applyKnobs says the same afterwards, too late for a level already standing */
export function roundTape(tables: Record<string, unknown>) { const t = tables.ROUND; if (t === null || typeof t !== 'object') ROUND.on = false; }

/** THE PICTURE'S PRISM: the eight planes that, with the box's own four side faces, stand a regular twelve-sided prism round the cylinder — written as cut-table
 *  rows (n.xyz, d) at dst[o‥o + 32) by boxes.ts for the g-buffer's cut pass. No ray reads them. */
export function packRoundRows(dst: Float32Array, o: number, R: number) {
  for (let k = 0, q = o; k < 8; k++, q += 4) { const d = (30 + 30 * k + 30 * (k >> 1)) * Math.PI / 180; dst[q] = Math.cos(d); dst[q + 1] = 0; dst[q + 2] = Math.sin(d); dst[q + 3] = R; }   // (30° 60° · 120° 150° · 210° 240° · 300° 330°)
}
/** the core row's w of a round (gbuffer_cut.wgsl fsBoxCut reads the bit; above glass's seven) */
export const ROUND_CORE_W = 128;
