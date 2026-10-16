// THE SHARED WALLED YARD'S WEST GATE AS THE SHELL OF A TEAM & KIT SET (scene/scenarios.ts KitViewSet; the yard is tools/levels/train-ground.ts).
// The picture's column shows the men on the track, the wall, the gate, and a strip some two metres deep behind the wall on the stack's side — so every level
// on this yard looks the same from its own gate unless what makes it that level stands in that strip. A level that wants its own picture takes this shell
// (the ground, the west wall and its gate as the yard has them, the north wall's west half, the gate's frame and leaf) and dresses the strip in its own file:
//   const Y = yardGateShell('tm');
//   kitView: { sets: { pool: { ...Y, boxes: [...Y.boxes, …the level's own pieces…] } }, ways: [{ door: 'tm_gate', set: 'pool', side: -1, pane: false }] }
// The numbers are the yard's as exported (the gate after the door-size fit: hinge 13.82, 0.86 wide), copied: a change to the yard is made here too. Left out:
// what the column cannot show (the south and east walls, the pier caps, the frame's stops).
// `p` prefixes every id (a set's ids are its own: unique in the file, never `kitset_`). Paint is by the yard kit's material names (TRAIN_MATERIALS).
// Free floor a dressing must leave: the gate's lane (z 13.8..14.7) for 2.25 m behind the wall, where a can is put and the stand-in man is stood.
import type { KitViewSet } from '../../src/scene/scenarios';
import { HALF } from './train-ground';

export function yardGateShell(p: string): Pick<KitViewSet, 'ref' | 'doors' | 'boxes'> {
  return {
    ref: [5.2, 14.0],
    doors: [{ id: `${p}_gate`, hinge: [8, 13.82], closedDir: HALF, width: 0.86, exterior: true }],
    boxes: [
      { id: `${p}_ground`, c: [20, -0.125, 14], h: [20, 0.125, 14], material: 'dust' },
      { id: `${p}_yard`, c: [20, 0.002, 14], h: [12, 0.002, 8], material: 'dirt' },
      { id: `${p}_track`, c: [4, 0.002, 14], h: [4, 0.002, 1.4], material: 'gravel' },
      { id: `${p}_wall_n`, c: [8, 1.2, 9.9], h: [0.12, 1.2, 3.9], material: 'mud' },
      { id: `${p}_wall_head`, c: [8, 2.225, 14.25], h: [0.12, 0.175, 0.45], material: 'mud' },
      { id: `${p}_wall_s`, c: [8, 1.2, 18.35], h: [0.12, 1.2, 3.65], material: 'mud' },
      { id: `${p}_cope`, c: [8, 2.435, 14], h: [0.15, 0.035, 8], material: 'mudLight' },
      { id: `${p}_post_n`, c: [8, 1.22, 6], h: [0.22, 1.22, 0.22], material: 'mud' },
      { id: `${p}_post_s`, c: [8, 1.22, 22], h: [0.22, 1.22, 0.22], material: 'mud' },
      { id: `${p}_wall_north`, c: [14, 1.2, 6], h: [6, 1.2, 0.12], material: 'mud' },
      { id: `${p}_jamb_a`, c: [8, 1.025, 13.79], h: [0.132, 1.025, 0.03], albedo: [0.2, 0.21, 0.23] },
      { id: `${p}_jamb_b`, c: [8, 1.025, 14.71], h: [0.132, 1.025, 0.03], albedo: [0.2, 0.21, 0.23] },
      { id: `${p}_lintel`, c: [8, 2.065, 14.25], h: [0.132, 0.05, 0.49], albedo: [0.2, 0.21, 0.23] },
    ],
  };
}
