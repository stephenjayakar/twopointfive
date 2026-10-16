// HOW DESTRUCTION DUST LOOKS (look only; render/shaders/dust_look.wgsl is the GPU half, smoke/dustTint.ts carries the tint to it and holds the A/B switch). Nothing here
// is read by play: no dice of the lane's are drawn (no hash01(serial++), no rate cap taken, no debris chunk) and the solver puffs are emitted exactly as before — the
// same record, the same frame, the same caps.
//
//  · dustTint(surf): what colour the cloud scatters — gypsum is a pale warm white, concrete a grey, wood and board a tan. It rides on the puff's emitter record as
//    `tint` (a field the solver never reads) and reaches only the view march of the volumetric pass.
import type { Vec3 } from '../math/vec';
import type { Surf } from './particleFx';

/** the scattering tint of a surface's dust (1 1 1 = smoke's white): its colour only — how much it HIDES is not this number, and a darker one read as brown smoke in
 *  a dark room without stopping a weapon light burning the cloud out */
export function dustTint(surf: Surf): Vec3 {
  switch (surf) {
    case 'drywall': return [0.9, 0.87, 0.81];
    case 'concrete': return [0.72, 0.71, 0.69];
    case 'wood': case 'cardboard': return [0.78, 0.68, 0.54];
    case 'fabric': case 'carpet': return [0.76, 0.75, 0.74];
    default: return [0.82, 0.8, 0.77];
  }
}
