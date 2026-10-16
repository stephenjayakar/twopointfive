// bun run tools/qa/dust-look-check.ts — the volumetric pass's DUST TWIN (src/render/dustLookVol.ts) is built by swapping five statements (eleven sites) of volumetrics.wgsl's text;
// an edit that rewrites one of them turns the dust look off at boot with a console error and nothing else. This is the headless check that it still builds: exit 0 = the
// twin's text exists and carries every swap, 1 = the march has moved (re-point dustLookVol.ts SWAPS at the new statements).
import { dustLookVol } from '../../src/render/dustLookVol';
const vol = await Bun.file(new URL('../../src/render/shaders/volumetrics.wgsl', import.meta.url)).text();
const twin = dustLookVol(vol);
const ok = !!twin && twin.includes('dustDensity(X, onMask, true)') && twin.includes('smokeSelfShadowLook(') && !twin.includes('let dens = fogSmoke(smokeDensityIn(X, onMask), X);');
console.log(ok ? `  PASS — the dust twin builds from volumetrics.wgsl (${twin!.length} chars, ${vol.length} in the plain march)` : '  FAIL — the dust twin does not build: see the console error above');
process.exit(ok ? 0 : 1);
