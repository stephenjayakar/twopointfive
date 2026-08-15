// The SDF character rig's radius fit, offline: loads the mannequin glTF the game ships, runs render/sdfrig.ts fitRig over it and prints the per-slot table
// (hand radius → fitted r0 / r1, vertices used, rms / max residual, share inside, segment length). `--json` prints the fit as JSON (the review page embeds it).
//   bun run tools/qa/sdfrig-fit.ts [--json]
import { resolve } from 'node:path';
import { loadGltfCharacter } from '../../src/anim/gltf';
import { fitRig, rigTable, RIG_K, FOLD_ORDER, RIG_SLOT_NAMES } from '../../src/render/sdfrig';

const ROOT = resolve(import.meta.dir, '../..');
const url = 'file://' + ROOT + '/public/assets/ual/AnimationLibrary_Godot_Standard.gltf';
const ch = await loadGltfCharacter(url);
const fit = fitRig(ch);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ slots: fit.slots, k: RIG_K, fold: FOLD_ORDER, names: RIG_SLOT_NAMES, verts: fit.verts, ms: +fit.ms.toFixed(1) }, null, 1));
} else {
  console.log('=== sdf rig fit: round-cone radii per slot, least squares over the vertices each slot\'s joints dominate ===');
  console.log(rigTable(fit));
}
