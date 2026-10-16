// THE BLOCK IN THE DEFAULT LOOK (src/scene/look.ts): tools/levels/block.ts's level, box for box, in other clothes — tools/levels/gwotSkin.ts says what may change
// (paint and finish, decals, the paint of a prop) and checks that nothing a round, a charge or a blast reads did. `bun run tools/levels/export.ts block-gwot`.
// ITS OWN PLACE: a district telephone exchange — the comms room and its racks, the frame room, the battery room, the switch room, the linemen's mess and its
// kitchen, the repair shop and its tool crib, the cable store and the jointers' room, a loading hall. Cement render outside, cream over a PISTACHIO dado inside (the
// yellow-green gloss of a state building: every door frame, the window frames, the lockers). What it alone has: CABLE TRENCHES. Their steel cover plates, a metre
// each, come in under the stair tower's door (a spur off the chamber there runs to the mains on the loading hall's wall) and meet the trunk that runs down the
// hall's north side (the level's own plates); a branch leaves it through each door a cable has business behind — the battery room, the frame room and on through
// the heel door to the switchboard round the comms room's turn, the comms room's own door and up its near leg to the racks, the switch room, the store and
// round ITS turn — and one runs down the loading hall, through the tool crib and its heel door into the back of the workshop. So the plates draw the level's
// two ways to a far leg on the floor: the store's goes ROUND the turn; the comms room's and the workshop's come in by the HEEL door (the comms room's other
// one stops at the racks, short of the turn). The mess has none: no cable has business there. Every fifth plate along the floor's length is a lifting plate
// in the dado's paint. Drum rings in the store. No letters, no numbers, no lines, no bays, no tiles.
// tools/levels/blocksquads-gwot.ts (the same floor, other defenders) wears this SKIN.
import { build as buildPlain, NOTES as PLAIN_NOTES, BLOCK_ROOMS, BLOCK_SPACES, BLOCK_MOUTHS } from './block';
import { GWOT_MATERIALS } from '../../src/scene/gwotKit';
import { GWOT_PALETTE as P, type GwotMat } from '../../src/scene/gwotPalette';
import { skinLevel, LOOK_NOTE, type Skin } from './gwotSkin';
import { lookMarks } from './lookMarks';
import type { Level } from '../../src/scene/level';

export const NAME = 'block-gwot';
export const DRESS_AS = 'block';
export const MATERIALS = GWOT_MATERIALS;
export const NOTES = `${PLAIN_NOTES ?? ''}${LOOK_NOTE}`;
export const build = buildPlain;
const R = BLOCK_ROOMS;
/** the one accent (a word to change it — and the outside doors' paint beside it: src/scene/look.ts LOOK_DOORS) */
const ACCENT: GwotMat = 'prodGreen';
/** where the plates are counted from: the loading hall's east wall (block.ts: the partition on x = 11) */
const ZERO = 11;
export const SKIN: Skin = {
  wall: 'hesco', house: 'hesco', inner: 'whitewash', frameOut: ACCENT, frameIn: ACCENT, dado: null, noRug: /./, patches: 6,   // (the dado is laid below: the skin's own comes with a rug, and a rug here would lie under the lockers)
  floor: { stone: 'slab', lino: 'canvas', carpet: 'slab' },
  metals: ['galv', 'iron', 'tin', 'woodGrey'],
  // the gang's lockers in the mess (and any tall steel cabinet of the comms room) in the same paint
  pick: c => c.steel && c.y0 < 0.1 && c.y1 > 1.9 && c.b.albedo[0] < 0.4 && (c.group === 'mess' || c.group === 'comms') ? ACCENT : undefined,
  dress: (G, level, T) => {
    const M = lookMarks(T), W = 0.5;
    // THE DADO: round every space of the floor, held or not, under the window sills (0.9 m), cut at every door, at the hall's open mouth and at the turn of every L (no wall there)
    { const cuts: { x: boolean; line: number; a: number; b: number }[] = level.doors.map(d => { const x = Math.abs(Math.sin(d.closedDir)) < 0.5, h = x ? d.hinge[0] : d.hinge[1]; return { x, line: x ? d.hinge[1] : d.hinge[0], a: h - 0.08, b: h + d.width + 0.08 }; });
      cuts.push({ x: false, line: ZERO, a: R.hall.z0 - 0.01, b: R.hall.z1 + 0.01 }, ...BLOCK_MOUTHS.map(m => ({ ...m, a: m.a - 0.01, b: m.b + 0.01 })));
      const face = (x: boolean, at: number, a: number, b: number, side: 1 | -1) => { let s = a;
        for (const c of cuts.filter(c => c.x === x && Math.abs(c.line - at) < 0.2 && c.b > a && c.a < b).sort((p, q) => p.a - q.a)) { if (c.a - s > 0.1) G.skirt(x ? 'x' : 'z', at, s, c.a, side, ACCENT, 0.85, 0); s = Math.max(s, c.b); }
        if (b - s > 0.1) G.skirt(x ? 'x' : 'z', at, s, b, side, ACCENT, 0.85, 0); };
      for (const r of BLOCK_SPACES) { face(true, r.z0, r.x0, r.x1, 1); face(true, r.z1, r.x0, r.x1, -1); face(false, r.x0, r.z0, r.z1, 1); face(false, r.x1, r.z0, r.z1, -1); } }
    // A TRENCH: cover plates a metre long, cut on the whole metres of the floor's own grid, each the floor's colour darker with the floor showing in the joints;
    // east of the loading hall's wall every fifth is a lifting plate, painted (heights of their own: over the doors' wear, under lookMarks' band)
    let n = 0;
    const plate = (x0: number, z0: number, x1: number, z1: number, lift: boolean) => { const x = (x0 + x1) / 2, z = (z0 + z1) / 2, fa = T.floorAt(x, z); if (fa && x1 - x0 > 0.08 && z1 - z0 > 0.08) T.flat(x, z, x1 - x0, z1 - z0, lift ? P[ACCENT] : T.tone(fa, 0.58), 0, 0.01162 + (n++ % 6) * 0.00002); };
    const trench = (pts: [number, number][]) => {
      for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], alongX = Math.abs(bx - ax) > Math.abs(bz - az);
        // (a stretch after a corner starts past the corner's own plate; every stretch but the last runs half a width on, so the corner is whole)
        const s = alongX ? Math.sign(bx - ax) : Math.sign(bz - az), from = (alongX ? ax : az) + (i ? s * W / 2 : 0), to = (alongX ? bx : bz) + (i + 2 < pts.length ? s * W / 2 : 0), lo = Math.min(from, to), hi = Math.max(from, to);
        for (let a = lo; a < hi - 1e-6;) { const b = Math.min(hi, Math.floor(a + 1 + 1e-6));
          if (alongX) plate(a + 0.03, az - W / 2, b - 0.03, az + W / 2, b - a > 0.99 && b > ZERO + 1 && Math.round(b - ZERO) % 5 === 0); else plate(ax - W / 2, a + 0.03, ax + W / 2, b - 0.03, false); a = b; } }
    };
    // in from the street under the stair tower's door to the trunk in the hall (the level's own plates, z 12.62); a branch down the loading hall to the tool crib's door
    trench([[4.2, 11.1], [9.9, 11.1], [9.9, 12.62], [12.4, 12.62]]); trench([[9.9, 12.9], [9.9, 21.4], [ZERO, 21.4]]);
    trench([[9.9, 10.66], [9.9, 10.0], [10.9, 10.0]]);   // … and a spur from the chamber by the stair door to the mains (block.ts: the breaker, on the wall at (10.9, 10.0))
    // NORTH of the hall: a spur to the battery room's cells; through the frame room's door to the frame, and on through the heel door to the switchboard round the
    // comms room's turn; through the comms room's own door and straight up its near leg to the racks
    trench([[24.4, 11.7], [24.4, 8.0]]);
    trench([[30.4, 11.7], [30.4, 9.3], [31.4, 9.3]]); trench([[30.15, 9.3], [28.4, 9.3], [28.4, 5.9]]);
    trench([[33.4, 11.7], [33.4, 5.6]]);
    // SOUTH: the tool crib from its loading hall door, through the heel door into the back of the workshop; the switch room across the heads of its racks; the
    // store down its near leg and round the turn
    trench([[ZERO, 21.4], [14.0, 21.4], [14.0, 22.4], [18.6, 22.4]]);
    trench([[22.4, 15.5], [22.4, 17.2], [25.6, 17.2]]);
    trench([[28.4, 15.5], [28.4, 22.2], [32.5, 22.2]]);
    // a JOINTING CHAMBER's cover where the trunk branches: a square plate with the accent round its rim
    for (const [x, z] of [[9.9, 11.1], [9.9, 21.4], [30.4, 9.3], [28.4, 22.2]]) { const fa = T.floorAt(x, z); if (fa) { T.flat(x, z, 0.84, 0.84, P[ACCENT], 0, 0.01176); T.flat(x, z, 0.68, 0.68, T.tone(fa, 0.5), 0, 0.0118); } }
    // where cable drums lay on their sides: rings pressed into the floor of the store and the loading hall (thin: nothing here is a dark shape through a window)
    const ring = (x: number, z: number, r: number) => { const fa = T.floorAt(x, z); if (!fa) return; const col = T.tone(fa, 0.66), K = 8, e = r / Math.cos(Math.PI / K);
      for (let k = 0; k < K; k++) { const a = (k + 0.5) * 2 * Math.PI / K, b = (k + 1.5) * 2 * Math.PI / K; M.seg(x + Math.cos(a) * e, z + Math.sin(a) * e, x + Math.cos(b) * e, z + Math.sin(b) * e, 0.09, col); } };
    ring(29.5, 20.6, 0.75); ring(29.9, 23.0, 0.6); ring(5.5, 20.4, 0.75); ring(7.1, 21.6, 0.6);
    ring(33.5, 22.2, 0.75);   // (and the one the store's trench ends on, round the turn: the drum the cable came off)
  },
};
export const finish = (level: Level, groups: string[]) => skinLevel(level, groups, SKIN);
