// QUIET-YARD: the quiet mission's own throwaway — tools/levels/kit-yard.ts's floor, wall for wall (a walled yard, a bunkhouse of two rooms, a store, two
// gates), with a NIGHT SHIFT on it and a `scenarios.quiet` block: the smallest level that carries everything the contract names
// (rebuild/play-style-levels/quiet-missions/contract.md), there so game/quiet.ts is proved on a floor that is none of the office's.
//   three routes (the yard, the bunkhouse, the store) in three patrol sets · a camera over the yard · a cleaner in the bunkhouse
//   two starts (outside either gate) · three spots (a cabinet in the radio room, a locker in the bunks, a shelf in the store) · both gates are ways out
//   the shift's own errands (a smoke by the south wall, water in the bunks) and the cleaner's way off the floor
// NOT a level to play for its own sake: the levels built for the play styles are their own generators' — copy the `quiet` block below as a start.
//   bun run tools/levels/export.ts quiet-yard [--check]     → levels/quiet-yard.json
//   bun run tools/qa/quiet-check.ts quiet-yard.json          the block against the built floor
//   page: ?levelFile=quiet-yard.json&quiet   (&squad=1: with one partner · &quiet=7: the deal pinned)
import type { Level } from '../../src/scene/level';
import type { LevelScenarios, QuietData, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { build as buildYard } from './kit-yard';

export const NAME = 'quiet-yard';
export const NOTES = 'The quiet mission\'s test map: the kit yard (tools/levels/kit-yard.ts) with a night shift, a camera, a cleaner and a scenarios.quiet block. Regenerate: bun run tools/levels/export.ts quiet-yard';

const BUNKS: Rect = { x0: 10.12, x1: 16.94, z0: 6.12, z1: 11.88 }, RADIO: Rect = { x0: 17.06, x1: 23.88, z0: 6.12, z1: 11.88 }, STORE: Rect = { x0: 22.12, x1: 31.88, z0: 16.12, z1: 21.88 };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const Y = buildYard(), level = Y.level;
  // ---- the night shift: three beats, each a loop a man walks all night (points are free floor; wait = seconds stood at each) ----
  level.routes = [
    { name: 'yard', points: [[28.6, 0, 13.6], [16.0, 0, 13.4], [11.0, 0, 16.6], [13.6, 0, 20.4], [20.4, 0, 20.2], [20.6, 0, 14.6]], wait: [4, 0, 3, 0, 3, 0] },
    { name: 'bunkhouse', points: [[12.4, 0, 9.0], [15.8, 0, 10.4], [18.6, 0, 9.0], [22.2, 0, 8.6], [19.4, 0, 10.6], [15.6, 0, 8.6]], wait: [5, 0, 0, 4, 0, 0] },
    { name: 'store', points: [[28.6, 0, 18.2], [24.0, 0, 18.4], [23.4, 0, 20.6], [26.2, 0, 20.0], [30.4, 0, 20.4]], wait: [4, 0, 3, 0, 3] },
  ];
  // ---- a camera on the store's north wall, sweeping the yard between the buildings; a cleaner doing the bunkhouse ----
  level.devices = [
    { kind: 'camera', name: 'cam_yard', pos: [28.6, 2.7, 15.84], yaw: Math.PI, pitch: -0.35, sweep: [Math.PI - 0.6, Math.PI + 0.6], sweepPeriod: 10, fovDeg: 70, range: 12, mains: true },
  ];
  level.civilians = [
    { name: 'Irena', kind: 'cleaner', tint: [0.78, 0.62, 0.08], tint2: [0.05, 0.06, 0.1],
      points: [[11.8, 0, 7.4], [14.6, 0, 10.6], [18.4, 0, 7.4], [22.4, 0, 10.2]], wait: [12, 10, 12, 10], tasks: ['wipe', 'bin', 'wipe', 'bin'], face: [Math.PI, 0, Math.PI, 0] },
  ];
  // ---- the quiet mission: where it starts, what is taken from where, the ways out, who is on tonight ----
  const quiet: QuietData = {
    thing: 'the ledger',
    starts: [
      { name: 'the west gate', sam: [5.6, 0, 14.0], samYaw: Math.PI / 2, mate: [4.6, 0, 14.8] },
      { name: 'the south gate', sam: [20.0, 0, 24.4], samYaw: Math.PI, mate: [21.0, 0, 25.2] },
    ],
    spots: [
      { place: 'the radio room', area: { ...RADIO }, door: 'n_e', holder: 'the grey cabinet', rackIndex: 0, front: [23.0, 1.0, 10.6], halfW: 0.3 },
      { place: 'the bunk room', area: { ...BUNKS }, door: 'n_w', holder: 'the locker', rackIndex: 1, front: [16.4, 1.0, 7.0], halfW: 0.3 },
      { place: 'the store', area: { ...STORE }, door: 's_n', holder: 'the far shelf', rackIndex: 2, front: [27.4, 1.0, 21.1], halfW: 0.6 },
    ],
    exits: [
      { name: 'the west gate', door: 'gate_w', x: 7.2, z: 14.0, out: [-1, 0] },
      { name: 'the south gate', door: 'gate_s', x: 20.0, z: 22.8, out: [0, 1] },
    ],
    patrols: [['yard', 'bunkhouse'], ['yard', 'store'], ['bunkhouse', 'store'], ['yard', 'bunkhouse', 'store']],
    needs: {
      smoke: { name: 'the south wall', pos: [11.2, 0, 20.8], face: Math.PI / 2 },
      water: { name: 'the tap in the bunks', pos: [11.4, 0, 11.0], face: -Math.PI / 2 },
    },
    wayouts: [{ name: 'the south gate', pos: [20.0, 0, 24.2], face: 0 }],
  };
  // the level's own mission in the shape every level file carries: the first spot, the first exit (the plain night on this floor; a quiet run deals its own)
  level.playerSpawn = [5.6, 0, 14.0];
  level.mission = { serverRoom: { ...RADIO }, entryDoor: 'n_e', rack: { index: 0, front: [23.0, 1.0, 10.6], halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: 7.2, exfilZ: 14.0, exfilOut: [-1, 0] };
  // THE TEAM & KIT PICTURE (scene/scenarios.ts KitViewData; src/host/kitViewPlan.ts measures the rest): the west gate from the first start's side.
  return { level, scenarios: { quiet, kitView: { ways: [{ door: 'gate_w', ref: [5.6, 14.0], side: -1 }] } }, groups: Y.groups, surfaces: Y.surfaces };
}
