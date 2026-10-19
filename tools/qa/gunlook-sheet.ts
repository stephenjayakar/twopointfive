// EACH GUN ON THE KIT FIGURE, WITHOUT A PAGE (src/game/gunlook.ts GUNLOOK; ui/kitFigure.ts figureOffline — the Team & kit step's own software view, as
// kit-figure-sheet.ts draws it): one sheet per view, a man per gun of the two slots (gunslots.ts PICKS), each holding it as the game hands it to him — the
// model, the support hand and the muzzle the game deals — with his other gun where it rides.
//   TPS_PROFILE=shipped bun run tools/qa/gunlook-sheet.ts --out DIR [--w 420 --h 760] [--member 1] [--off]
//     → DIR/guns-<view>.png (views: front, left, right, back)      --off: the switch held off (each gun as the stand-in it was): the before
// A SOFTWARE picture of the figure: not the game's renderer, not a GPU. It shows shape, place and hands; it does not show the game's light.
import { writeFileSync, mkdirSync } from 'node:fs';
import { standUp, loadCastOf } from './headless';
import { figureOffline, type FigureAsk } from '../../src/ui/kitFigure';
import { kitDefault, type MemberKit } from '../../src/game/kit';
import { lookDress } from '../../src/scene/look';
import { GUNLOOK } from '../../src/game/gunlook';
import { png } from './kit-figure-sheet';

const arg = (k: string, d = '') => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'docs/shots/gunlook'), W = +arg('w', '420'), H = +arg('h', '760'), MEMBER = +arg('member', '1');
const VIEWS: [string, number][] = [['front', 0.6], ['left', 1.6], ['right', -1.0], ['back', Math.PI]];
const GUNS: [string, Partial<MemberKit>][] = [
  ['Mk 18', { weapon: 'rifle', primary: 'mk18' }], ['Mk 12', { weapon: 'rifle', primary: 'mk12' }], ['MP7', { weapon: 'rifle', primary: 'mp7' }], ['Mk 46', { weapon: 'rifle', primary: 'mk46' }],
  ['M1014', { weapon: 'rifle', primary: 'm1014' }], ['Glock 19', { weapon: 'pistol', secondary: 'g19' }], ['HK45', { weapon: 'pistol', secondary: 'hk45' }], ['Glock 18', { weapon: 'pistol', secondary: 'g18' }],
  ['Mk 46 + Glock 18', { weapon: 'rifle', primary: 'mk46', secondary: 'g18' }], ['MP7 + HK45', { weapon: 'rifle', primary: 'mp7', secondary: 'hk45' }],
] as [string, Partial<MemberKit>][];

if (import.meta.main) {
  standUp();
  if (process.argv.includes('--off')) GUNLOOK.on = false;
  const own = await loadCastOf(lookDress()), other = await loadCastOf(!lookDress());
  mkdirSync(OUT, { recursive: true });
  const only = arg('only');
  for (const [view, turn] of VIEWS) { if (only && !only.split(',').includes(view)) continue;
    const sw = W * GUNS.length, img = new Uint8Array(sw * H * 4);
    for (let i = 0; i < img.length; i += 4) { img[i] = 13; img[i + 1] = 12; img[i + 2] = 11; img[i + 3] = 255; }
    GUNS.forEach(([name, over], k) => {
      const ask: FigureAsk = { member: MEMBER, squad: 4, suit: false, look: true, card: { ...kitDefault(MEMBER), ...over } as MemberKit };
      const px = figureOffline({ own, other }, ask, W, H, turn, { passes: +arg('passes', '24'), frames: 8, secs: 0, moving: false, stats: {} });
      console.log(`${view} · ${name}: ${px ? 'drawn' : 'NOT DRAWN'}`); if (!px) return;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, a = px[o + 3] / 255, d = (y * sw + k * W + x) * 4; for (let j = 0; j < 3; j++) img[d + j] = px[o + j] * a + img[d + j] * (1 - a); } });
    writeFileSync(`${OUT}/guns-${view}.png`, png(img, sw, H));
    console.log(`→ ${OUT}/guns-${view}.png: ${GUNS.map(g => g[0]).join(' | ')}`);
  }
}
