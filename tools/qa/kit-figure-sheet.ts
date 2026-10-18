// THE KIT FIGURE WITHOUT A PAGE (src/ui/kitFigure.ts): the picked man of the Team & kit step, drawn by the page's own software view, for many kit cards at once.
//   TPS_PROFILE=shipped bun run tools/qa/kit-figure-sheet.ts --out DIR [--set name] [--w 300 --h 660] [--turn rad] [--only substr] [--passes 40 --frames 8 --secs 0 --moving] [--conv 1,2,4,8] [--part k/n]
// One PNG a sheet (a row of men, each under its config's name); the page's switches are stood as the page ships them (the shipped profile).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { standUp, loadCastOf } from './headless';
import { figureOffline, type FigureAsk } from '../../src/ui/kitFigure';
import { kitDefault, kitPresetCard, type MemberKit } from '../../src/game/kit';
import { lookDress } from '../../src/scene/look';

const arg = (k: string, d = '') => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'docs/shots/kitfigure'), W = +arg('w', '300'), H = +arg('h', '660'), TURN = +arg('turn', '0'), ONLY = arg('only'), SET = arg('set', 'all');

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Uint8Array) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
export function png(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const raw = new Uint8Array((w * 4 + 1) * h); for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const chunk = (t: string, d: Uint8Array) => { const o = new Uint8Array(12 + d.length), v = new DataView(o.buffer); v.setUint32(0, d.length); o.set([...t].map(c => c.charCodeAt(0)), 4); o.set(d, 8); v.setUint32(8 + d.length, crc(o.subarray(4, 8 + d.length))); return o; };
  const ih = new Uint8Array(13), v = new DataView(ih.buffer); v.setUint32(0, w); v.setUint32(4, h); ih.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}

export interface Cfg { name: string; ask: FigureAsk; turn?: number }
const card = (i: number, over: Partial<MemberKit> = {}): MemberKit => ({ ...kitDefault(i), ...over });
export function configs(): Cfg[] {
  const L: Cfg[] = [], look = true;
  const a = (name: string, member: number, c: MemberKit, o: Partial<FigureAsk> = {}, turn?: number) => L.push({ name, ask: { member, squad: 4, suit: false, look, card: c, ...o }, turn });
  // guns, you
  a('you rifle', 0, card(0)); a('you pistol', 0, card(0, { weapon: 'pistol' })); a('you shotgun', 0, card(0, { weapon: 'shotgun' }));
  a('you quiet set', 0, kitPresetCard(0, 'quiet')); a('you loud set', 0, kitPresetCard(0, 'loud'));
  a('you suit rifle', 0, card(0), { suit: true }); a('you suit pistol', 0, card(0, { weapon: 'pistol' }), { suit: true });
  a('you office', 0, card(0), { look: false }); a('you office pistol', 0, card(0, { weapon: 'pistol' }), { look: false }); a('you office suit', 0, card(0), { look: false, suit: true });
  // each member, issued / pistol / shotgun
  for (let m = 1; m <= 4; m++) { a(`m${m} issued`, m, card(m)); a(`m${m} pistol`, m, card(m, { weapon: 'pistol' })); a(`m${m} shotgun`, m, card(m, { weapon: 'shotgun' })); }
  a('m1 office', 1, card(1), { look: false }); a('m1 quiet duo suit', 1, kitPresetCard(1, 'quiet'), { squad: 1, suit: true });
  // suits and trims
  for (const s of ['black', 'grey', 'navy', 'olive', 'jungle', 'khaki', 'desert'] as const) a(`suit ${s}`, 0, card(0, { suit: s }));
  for (const t of ['black', 'red', 'blue', 'green', 'amber', 'white'] as const) a(`trim ${t}`, 0, card(0, { trim: t }));
  // loads
  a('all pouches', 0, card(0, { smoke: 3, bangs: 3, frags: 3, shells: 4, charges: 2, walls: 1, wand: true } as Partial<MemberKit>));
  // the mission's hour: its own sun and sky on him
  for (const h of ['dawn', 'midday', 'overcast', 'dusk'] as const) { a(`hour ${h}`, 0, card(0), { hour: h }); a(`hour ${h} m2 pistol`, 2, card(2, { weapon: 'pistol' }), { hour: h }); }
  a('hour midday suit', 0, card(0), { hour: 'midday', suit: true }); a('hour dusk office', 0, card(0), { hour: 'dusk', look: false });
  // … under a picked weather's cloud (the page hands the weather's own)
  a('cloud midday grey', 0, card(0), { hour: 'midday', cloud: 0.9 }); a('cloud dusk downpour', 0, card(0), { hour: 'dusk', cloud: 1 }); a('cloud overcast rain', 0, card(0), { hour: 'overcast', cloud: 0.95 });
  // turned
  for (const [n, t] of [['back', Math.PI], ['left', 1.6], ['right', -1.0], ['front', 0.6]] as const) { a(`rifle ${n}`, 0, card(0), {}, t); a(`pistol ${n}`, 0, card(0, { weapon: 'pistol' }), {}, t); }
  return L;
}

if (import.meta.main) {
  standUp();   // (the page's switches, as the profile in front of the tool says)
  const own = await loadCastOf(lookDress()), other = await loadCastOf(!lookDress());
  mkdirSync(OUT, { recursive: true });
  let L = configs(); if (ONLY) L = L.filter(c => c.name.includes(ONLY));
  // --conv 1,2,4,8 = the first config again at each of those pass counts (how the light settles)
  const conv = arg('conv') ? arg('conv').split(',').map(Number) : null, passOf = new Map<object, number>();
  if (conv) L = conv.map(p => { const c = { ...L[0], name: `${L[0].name} · ${p} passes` }; passOf.set(c, p); return c; });
  const per = +arg('per', '8'), [pk, pn] = arg('part', '0/1').split('/').map(Number);   // --part k/n = every n-th sheet from the k-th (n processes draw the sweep side by side)
  if (!(pn > 0 && pk >= 0 && pk < pn)) { console.error('--part k/n wants 0 <= k < n'); process.exit(2); }
  for (let s = 0; s * per < L.length; s++) { if (s % pn !== pk) continue;
    const row = L.slice(s * per, (s + 1) * per), sw = W * row.length, img = new Uint8Array(sw * H * 4);
    for (let i = 0; i < img.length; i += 4) { img[i] = 13; img[i + 1] = 12; img[i + 2] = 11; img[i + 3] = 255; }
    row.forEach((c, k) => { const t0 = performance.now(); const stats: Record<string, number> = {};
      const px = figureOffline({ own, other }, c.ask, W, H, (c.turn ?? 0) + TURN, { passes: passOf.get(c) ?? +arg('passes', '40'), frames: +arg('frames', '8'), secs: +arg('secs', '0'), moving: process.argv.includes('--moving'), stats });
      console.log(`${c.name}: ${px ? (performance.now() - t0).toFixed(0) + ' ms · ' + Object.entries(stats).map(([k, v]) => `${k} ${v < 100 ? v.toFixed(2) : v.toFixed(0)}`).join(' · ') : 'NOT DRAWN'}`); if (!px) return;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, a = px[o + 3] / 255, d = (y * sw + k * W + x) * 4; for (let j = 0; j < 3; j++) img[d + j] = px[o + j] * a + img[d + j] * (1 - a); } });
    writeFileSync(`${OUT}/sheet-${SET}-${String(s + 1).padStart(2, '0')}.png`, png(img, sw, H));
    console.log(`→ ${OUT}/sheet-${SET}-${String(s + 1).padStart(2, '0')}.png: ${row.map(c => c.name).join(' | ')}`);
  }
}
