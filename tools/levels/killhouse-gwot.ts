// THE KILL HOUSE IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/killhouse.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what
// may change (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did.
// `bun run tools/levels/export.ts killhouse` writes both files.
// ITS OWN PLACE: a training shoot house on a forward base — a sandbagged shell, raw plywood partitions, barricades, crates and targets, packed earth underfoot,
// a HESCO backstop. What it alone has: THE RANGE'S OWN MARKING PAINT, violet, on the ground only, and white engineer tape. Every mark is read off the level's
// data where it is laid (the level as the skin is handed it: scenarios.roomClear and the doors), so a mark cannot say what the level does not:
//   · A START BOX at EVERY way in (the structure's `team` and each of `starts[]`), all drawn alike — none is numbered, none is 'the' start — with a tape toe
//     line where each of the five stands, on the side he faces;
//   · A NUMERAL at each held room's door, on the side the team comes to it from, its top to the door: the room's place in the level's own room list (1 tyres ·
//     2 bunks · 3 radio · 4 store · 5 mess — each room's own door is named for the room). A room with two doors wears its numeral at both
//     (the mess: at 'mess' and outside 'back');
//   · THE CLEAR LINE: one violet line across each of those doors on the room's side — past it a man is in the room;
//   · THE FIRING LINE east of the house, in front of the three ply targets: a band of violet and tape blocks, and a toe line square to each target.
// No letters, no lane lines, no bays, no tiles, no bands at a door. No accent paint on a wall.
import { build as buildPlain, NOTES as PLAIN_NOTES } from './killhouse';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P } from '../../src/scene/gwotPalette';
import { skinLevel, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';
import type { LevelScenarios, TeamStart } from '../../src/scene/scenarios';
import type { Vec3 } from '../../src/math/vec';

export const NAME = 'killhouse-gwot';
export const DRESS_AS = 'killhouse';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''} — IN THE DEFAULT LOOK (2010s GWOT: tools/levels/gwotSkin.ts): the same boxes repainted, decals added; what a man collides with, hides behind or sees through is the plain file's.`;
export const build = buildPlain;
/** the range's marking paint. The palette (src/scene/gwotPalette.ts) has no paint of this hue, so it is a colour of this file's own and only decals wear it;
 *  the outside doors' paint is this, darker: src/scene/look.ts LOOK_DOORS */
const VIOLET: Vec3 = [0.42, 0.2, 0.66];
/** the three ply targets' lanes (tools/levels/killhouse.ts, group 'range': targets at x 33.4) and where the firing line lies, between the east wall's foot and them */
const TARGET_Z = [10.4, 13.5, 16.6], FIRE_X = 29.5;
const SKIN: Skin = {
  wall: 'sandbag', house: 'ply', inner: 'ply', frameOut: 'woodGrey', frameIn: 'poplar', dado: null, ground: 'dust', verge: 'dirt', patches: 6,
  floor: { lino: 'dirt' },
  noRug: /./, metals: ['olive', 'iron', 'rust'],
  // (the two halves of the corridor: the scuffed band along a hall's walls — the scenarios name the held rooms only)
  rooms: [{ id: 'front hall', bounds: { x0: 12.12, x1: 21.54, z0: 12.06, z1: 14.44 } }, { id: 'far hall', bounds: { x0: 21.66, x1: 27.88, z0: 12.06, z1: 14.44 } }],
  // plywood for everything the plain file has in wood (the barricade, the crates, the targets, the table tops), sandbags and a HESCO berm on the range
  pick: c => c.name === 'wood' ? 'ply' : c.group === 'range' && c.name === 'partTan' ? 'sandbag' : c.group === 'range' && c.name === 'concrete' ? 'hesco' : undefined,
  dress: (_G, level, T) => {
    const M = lookMarks(T), tape = T.tone(P.plasticWhite, 0.9), worn = T.tone(VIOLET, 0.8);
    const rc = (level.scenarios as LevelScenarios | undefined)?.roomClear; if (!rc) throw new Error('killhouse-gwot: the level carries no room clear to read its marks off');
    /** where a man stands: a tape line half a metre long, a short stride ahead of his feet, square to the way he faces (yaw: he faces (sin, cos)) */
    const toe = (p: Vec3 | [number, number], yaw: number) => { const x = p[0], z = p[p.length - 1], fx = Math.sin(yaw), fz = Math.cos(yaw), cx = x + fx * 0.3, cz = z + fz * 0.3;
      M.seg(cx - fz * 0.25, cz + fx * 0.25, cx + fz * 0.25, cz - fx * 0.25, 0.07, tape); };
    // A START BOX at every way in, all alike
    const ways = [rc.team, ...(rc.starts ?? [])].filter((w): w is TeamStart => !!w);
    for (const w of ways) { const men: Vec3[] = [w.sam, ...(w.ops ?? [])], PAD = 0.7;
      const x0 = Math.min(...men.map(p => p[0])) - PAD, x1 = Math.max(...men.map(p => p[0])) + PAD, z0 = Math.min(...men.map(p => p[2])) - PAD, z1 = Math.max(...men.map(p => p[2])) + PAD;
      M.outline(x0, z0, x1, z1, 0.1, VIOLET);
      toe(w.sam, w.samYaw); for (const p of w.ops ?? []) toe(p, w.opsYaw ?? w.samYaw); }
    // A NUMERAL and THE CLEAR LINE at every door of every held room, in the room list's own order
    rc.rooms.forEach((room, k) => { if (k > 8) return; const b = room.bounds, rx = (b.x0 + b.x1) / 2, rz = (b.z0 + b.z1) / 2;
      for (const rd of room.doors) { const d = level.doors.find(q => q.name === rd.id); if (!d) throw new Error(`killhouse-gwot: room '${room.id}' names a door '${rd.id}' the level has not`);
        const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir), mx = d.hinge[0] + ux * d.width / 2, mz = d.hinge[1] + uz * d.width / 2;
        // (the door's normal, away from the room)
        let nx = -uz, nz = ux; if ((mx + nx - rx) ** 2 + (mz + nz - rz) ** 2 < (mx - nx - rx) ** 2 + (mz - nz - rz) ** 2) { nx = -nx; nz = -nz; }
        M.glyph(String(k + 1), mx + nx * 0.8, mz + nz * 0.8, 0.55, VIOLET, Math.atan2(nx, nz));
        const L = d.width / 2 + 0.25; M.seg(mx - nx * 0.45 - ux * L, mz - nz * 0.45 - uz * L, mx - nx * 0.45 + ux * L, mz - nz * 0.45 + uz * L, 0.1, worn); } });
    // THE FIRING LINE in front of the targets: a band along it, a toe line square to each target (a firer faces +x: yaw π/2)
    M.hazard(FIRE_X - 0.15, TARGET_Z[0] - 1.55, FIRE_X + 0.15, TARGET_Z[2] + 1.55, VIOLET, tape, 0.31);
    for (const z of TARGET_Z) toe([FIRE_X - 0.75, z], Math.PI / 2);
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
