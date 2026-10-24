// The other takes of the fourteen voices the maintainer called toys (src/audio/sfxAlt.ts): each one renders, is neither silent nor clipped, is a different sound from the
// voice in the game and from its sibling, sits at that voice's level, and rendering them leaves the game's own table sample for sample what it was. It prints each take's
// length, level and where its energy lies BESIDE the old voice ('before') and the one in the game's redone table ('after') — numbers, since nobody here can listen.
// The same holds of the two other takes of each of the grab's three beats (grabCatch, gunStrip, gunDown), which have no 'before'.
// THE TUNER'S HOOK (the sound lanes' card, src/replay/soundtune.ts): a voice built ALONE under a tune that changes nothing is the table's voice sample for sample, for
// every voice and every other take; a number laid over a layer, another seed, a muted layer each make another buffer; a layer heard alone and the voice without it add
// up to the voice (the level scale is the whole voice's) wherever the recipe only adds; a kept tune of garbage reads as no tune.
//   bun run tools/qa/sound-takes-check.ts [name …]        exit 0 = holds, 1 = a line failed        TAKES_BREAK=1 = a take handed back as the game's own voice, and the
//   'changes nothing' tune given another seed: must fail
import { gameSfx } from '../../src/audio/audio';
import { buildOne, buildSfx } from '../../src/audio/sfx';
import { buildSfxWas } from '../../src/audio/sfxWas';
import { altNames, altOne, altPicked, altSay, altTake, altTakes } from '../../src/audio/sfxAlt';
import { sfxContext, type SfxBuffer } from '../../src/audio/backend';
import { band, heard, loudest, type Layer, type Tune } from '../../src/audio/synth';
import { GUARD_PEAK, madeOf, pulledOf, renderTune, tuneOf, tuneText } from '../../src/replay/soundtune';

const SR = 48000, ctx = sfxContext(SR);
let bad = 0; const line = (ok: boolean, what: string) => { console.log(`  - ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) bad++; };
const same = (a: Float32Array, b: Float32Array) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const BANDS: [string, number, number][] = [['<300', 0, 300], ['300-2k', 300, 2000], ['2k-8k', 2000, 8000], ['8k+', 8000, 24000]];
function read(b: SfxBuffer) {
  const x = Float32Array.from(b.getChannelData(0)); let pk = 0, fin = true, e = 0;
  for (const s of x) { if (!Number.isFinite(s)) fin = false; const m = Math.abs(s); if (m > pk) pk = m; e += s * s; }
  const share = BANDS.map(([, lo, hi]) => { const y = band(x.slice(), SR, lo, hi); let q = 0; for (const s of y) q += s * s; return q; }); const tot = share.reduce((a, c) => a + c, 0) || 1;
  return { x, secs: x.length / SR, heard: heard(x, SR), loud: loudest(x, SR), pk, fin, rms: Math.sqrt(e / Math.max(1, x.length)), share: share.map(q => q / tot) };
}
const row = (what: string, r: ReturnType<typeof read>, say = '') => console.log(`    ${what.padEnd(7)} ${r.secs.toFixed(2).padStart(5)} s  heard ${r.heard.toFixed(3)}  loudest ${r.loud.toFixed(3)}  peak ${r.pk.toFixed(2)}  ${r.share.map((q, i) => `${BANDS[i][0]} ${(q * 100).toFixed(0).padStart(2)}%`).join(' · ')}${say ? `   ${say}` : ''}`);

const tableBefore = buildSfx(ctx) as Record<string, SfxBuffer>, was = buildSfxWas(ctx) as Record<string, SfxBuffer | undefined>;
const kept: Record<string, Float32Array> = {}; for (const n of Object.keys(tableBefore)) kept[n] = Float32Array.from(tableBefore[n].getChannelData(0));
const shipped = gameSfx(sfxContext(SR)) as Record<string, SfxBuffer>; const shippedKept: Record<string, Float32Array> = {}; for (const n of Object.keys(shipped)) shippedKept[n] = Float32Array.from(shipped[n].getChannelData(0));

const TOYS = ['rifleSuppressed', 'magOut', 'magIn', 'rack', 'footHard', 'doorBang', 'doorLatch', 'doorRattle', 'stairDoor', 'chokeLimp', 'lightBreak', 'wallDebris', 'murmur', 'heldProtest'];
/** the four he flagged on 10-13 (redone in the game's table): one other take each, to hear beside the redone voice */
const FLAGGED = ['propScrape', 'propThud', 'lockBreak', 'magDrop'];
/** his picks of 10-13 and, for the grab's catch and strip, of 10-24, as [name, place in its list]: moved into the game's table, their places kept so 'new 2' stays 'new 2' */
const PICKS: [string, number][] = [['footHard', 0], ['magIn', 1], ['rack', 1], ['grabCatch', 0], ['gunStrip', 1]];
/** the grab's three beats: two other ideas of each, written blind; he chose by ear on 10-24 (PICKS above) and the takes he passed over are still offered */
const GRAB = ['grabCatch', 'gunStrip', 'gunDown'];
const WITH = [...TOYS, ...FLAGGED, ...GRAB];
const asked = process.argv.slice(2), names = asked.length ? asked : WITH;
line(WITH.every(n => altTakes(n) >= 1) && GRAB.every(n => altTakes(n) === 2) && altNames().every(n => WITH.includes(n)) && altTakes('pistolLoud') === 0, `his fourteen toys and the four he flagged have another take, the grab's three beats have two each, and no other voice has (${altNames().length} voices)`);
{ const got: string[] = []; for (const n of WITH) for (let k = 0; k < altTakes(n); k++) if (altPicked(n, k)) got.push(`${n} new ${k + 1}`);
  const want = PICKS.map(([n, k]) => `${n} new ${k + 1}`);
  line(got.slice().sort().join() === want.sort().join() && PICKS.every(([n, k]) => altTake(ctx, n, k) === null), `his five picks keep their places and are offered no more: ${got.join(', ') || 'none'}`); }

for (const name of names) {
  console.log(`  ${name}`);
  const after = read(tableBefore[name]); if (was[name]) row('before', read(was[name]!)); row('after', after);
  const got: ReturnType<typeof read>[] = []; let first = -1;
  for (let k = 0; k < altTakes(name); k++) {
    if (altPicked(name, k)) { console.log(`    new ${k + 1}    picked: the game's own voice now (the 'after' row)`); continue; }
    if (first < 0) first = k;
    const b = process.env.TAKES_BREAK ? tableBefore[name] : altTake(ctx, name, k);
    if (!b) { line(false, `${name} new ${k + 1}: renders`); continue; }
    const r = read(b); got.push(r); row(`new ${k + 1}`, r, altSay(name, k));
    const why: string[] = [];
    if (!r.fin) why.push('not finite'); if (r.pk < 0.05 || r.rms < 0.004) why.push('silent'); if (r.pk > 1) why.push(`clipped (${r.pk.toFixed(2)})`);
    if (r.secs < 0.04 || r.secs > 4) why.push(`${r.secs.toFixed(2)} s long`);
    if (same(r.x, after.x)) why.push("the game's own voice");
    if (got.slice(0, -1).some(o => same(o.x, r.x))) why.push('the same as its sibling');
    if (Math.abs(r.heard / after.heard - 1) > 0.35) why.push(`heard ${r.heard.toFixed(3)} against the voice's ${after.heard.toFixed(3)}`);
    if (r.loud > Math.max(after.loud * 2.2, after.heard * 2.2)) why.push(`its low end is ${(r.loud / after.loud).toFixed(1)} × the voice's`);
    if (!altSay(name, k)) why.push('no words for its button');
    line(!why.length, `${name} new ${k + 1}: renders, not silent, not clipped, its own sound, at the voice's level${why.length ? ` — ${why.join(', ')}` : ''}`);
  }
  if (first >= 0) { const again = altTake(sfxContext(44100), name, first); line(!!again && again.sampleRate === 44100 && Math.abs(again.getChannelData(0).length / 44100 - got[0]?.secs) < 0.05, `${name}: renders at 44.1 kHz too, the same length`); }
}

// ---- a voice tuned (every voice of the table, whatever names were asked for)
{
  console.log('the tuner');
  const names = Object.keys(tableBefore), nothing = (): Tune => process.env.TAKES_BREAK ? { log: [], seed: 7 } : { log: [] };
  const differ: string[] = [], bare: string[] = []; let layers = 0, voiced = 0;
  for (const n of names) { const T = nothing(), b = buildOne(ctx, n, T); if (!b) { bare.push(n); continue; } voiced++; layers += T.log!.length; if (!same(kept[n], b.getChannelData(0))) differ.push(n); }
  line(!differ.length && voiced > 40, `a voice built alone under a tune that changes nothing is the table's, sample for sample: ${voiced} voices, ${layers} layers${differ.length ? ` — differ: ${differ.join(' ')}` : ''}`);
  console.log(`    not built of the instruments (no layers to tune, ${bare.length}): ${bare.join(' ')}`);
  let alts = 0; const altDiffer: string[] = [];
  for (const n of altNames()) for (let k = 0; k < altTakes(n); k++) { if (altPicked(n, k)) continue; const a = altTake(ctx, n, k), b = altOne(ctx, n, k, nothing()); if (!a || !b) continue; alts++; if (!same(a.getChannelData(0), b.getChannelData(0))) altDiffer.push(`${n} new ${k + 1}`); }
  line(!altDiffer.length && alts > 0, `…and so is every other take (${alts})${altDiffer.length ? ` — differ: ${altDiffer.join(', ')}` : ''}`);
  const unlike = (a: Float32Array, b: Float32Array) => { let d = Math.abs(a.length - b.length) ? 1 : 0; for (let i = 0; i < Math.min(a.length, b.length); i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
  const why: string[] = [], flat: string[] = []; let moved = 0;   // flat = the voice brings itself back to its own level after that layer: its level alone changes nothing (muting it does)
  for (const n of names) {
    const log: Layer[] = []; if (!buildOne(ctx, n, { log }) || !log.length) continue; const k = log.findIndex(l => 'dB' in l.p && l.kind !== 'drive'); if (k < 0) continue; moved++;
    const up = buildOne(ctx, n, { over: { [k]: { dB: -12 } } })!.getChannelData(0), seeded = buildOne(ctx, n, { seed: 4242 })!.getChannelData(0), muted = buildOne(ctx, n, { mute: [k] })!.getChannelData(0);
    if (unlike(up, kept[n]) < 1e-4) flat.push(n); if (unlike(muted, kept[n]) < 1e-4) why.push(`${n}: layer ${k} muted is the same buffer`);
    if (unlike(seeded, kept[n]) < 1e-6 && log.some(l => l.kind === 'hiss' || l.kind === 'blast' || l.kind === 'tail')) why.push(`${n}: another seed is the same buffer`);
    for (const x of [up, seeded, muted]) for (const v of x) if (!Number.isFinite(v)) { why.push(`${n}: not finite under a tune`); break; }
  }
  line(!why.length && moved > 40, `a layer at another level (most voices), a layer muted, another seed: each another buffer, each finite (${moved} voices; ${flat.length} bring their first layer's level back themselves: ${flat.join(' ')})${why.length ? ` — ${why.slice(0, 6).join('; ')}` : ''}`);
  if (flat.length > 8) line(false, 'a layer\'s level changes the buffer in all but a few voices');
  // a layer alone + the voice without it = the voice, where the recipe only adds (no drive, no slaps, no rounding of its own): the scale is the whole voice's, not each half's own
  const adds: string[] = [], MUST = ['magOut', 'footHard', 'propThud', 'propScrape', 'stairDoor'];
  for (const n of names) {
    const log: Layer[] = [], b = buildOne(ctx, n, { log }); if (!b || log.length < 2 || log[0].kind === 'slaps' || log[0].kind === 'drive') continue;
    const full = b.getChannelData(0), s = buildOne(ctx, n, { solo: 0 })!.getChannelData(0), m = buildOne(ctx, n, { mute: [0] })!.getChannelData(0); let err = 0, pk = 1e-9;
    for (let i = 0; i < Math.max(full.length, s.length, m.length); i++) { err = Math.max(err, Math.abs((full[i] ?? 0) - (s[i] ?? 0) - (m[i] ?? 0))); pk = Math.max(pk, Math.abs(full[i] ?? 0)); }
    if (err < 1e-3 * pk) adds.push(n);
  }
  line(MUST.every(n => adds.includes(n)) && adds.length >= 12, `a layer heard alone and the voice without it add up to the voice, at the voice's own level (${adds.length} voices whose recipe only adds; held: ${MUST.join(' ')})${MUST.every(n => adds.includes(n)) ? '' : ` — not: ${MUST.filter(n => !adds.includes(n)).join(' ')}`}`);
  // the tune as the card keeps it
  const plain = (base: string) => base === 'after' ? tableBefore.propScrape : null, ok = (base: string) => base === 'after' || base === 'new 1';
  const t = tuneOf({ base: 'after', seed: 141, over: { 0: { lo: 180, d: 0.15, zz: 3, at: 'x' }, 2: {}, bad: { lo: 1 } }, mute: [2, 2, -1, 'a', 1e9], hp: 90, bell: [2400, -4, 1.2], junk: 1 }, ok);
  const written = madeOf(ctx, 'propScrape', { base: 'after' }, plain), text = t ? tuneText(t, written?.layers) : '';
  console.log(`    ${text}`);
  line(JSON.stringify(t) === '{"base":"after","seed":141,"over":{"0":{"lo":180,"d":0.15}},"mute":[2],"hp":90,"bell":[2400,-4,1.2]}' && text === 'tuned from after · seed 141 · L0 hiss lo 180 Hz, D 150 ms · L2 hiss mute · hp 90 Hz · bell 2400 Hz -4 dB Q 1.2',
    'a kept tune is read as what it may be (numbers clamped, anything else dropped) and said in units, only what differs');
  line([null, 7, 'x', [], {}, { base: 7 }, { base: 'nope', hp: 90 }, { base: 'after' }, { base: 'after', over: 'x', mute: 3, hp: 'a', bell: [1, 0, 1], seed: 1.5 }].every(v => tuneOf(v, ok) === null)
    && JSON.stringify(tuneOf({ base: 'after', hp: 1e9, bell: [1e9, 99, 0], over: { 3: { dB: -999, pitch: 99, lo: NaN } } }, ok)) === '{"base":"after","over":{"3":{"dB":-60,"pitch":4}},"hp":2000,"bell":[16000,18,0.3]}', 'garbage kept as a tune is no tune; numbers out of range are clamped');
  const r = t ? renderTune(ctx, 'propScrape', t, plain) : null, post = renderTune(ctx, 'propScrape', { base: 'after', hp: 400 }, plain), raw = renderTune(ctx, 'propScrape', { base: 'after' }, plain);
  line(!!r && !!post && !!raw && same(raw.getChannelData(0), kept.propScrape) && raw !== tableBefore.propScrape && unlike(post.getChannelData(0), kept.propScrape) > 1e-3 && unlike(r.getChannelData(0), kept.propScrape) > 1e-3 && [...r.getChannelData(0)].every(Number.isFinite),
    'the tuned take: with nothing changed the base take in a buffer of its own; a high-pass alone, and the whole tune, each another finite buffer');
  // the guard: a bell's boost takes the baked buffer past full scale — it is pulled down whole to GUARD_PEAK and says by how much; a buffer that was under is left alone
  const hot = renderTune(ctx, 'pistolLoud', { base: 'after', bell: [3000, 18, 0.3] }, plain), pkOf = (b: SfxBuffer | null) => { let m = 0; if (b) for (const v of b.getChannelData(0)) m = Math.max(m, Math.abs(v)); return m; };
  line(!!hot && Math.abs(pkOf(hot) - GUARD_PEAK) < 1e-4 && pulledOf(hot) > 6 && !!raw && pulledOf(raw) === 0 && !!post && pulledOf(post) === 0,
    `a tuned buffer past full scale is pulled down to ${GUARD_PEAK} and says so (pistolLoud, bell +18 dB: pulled ${hot ? pulledOf(hot).toFixed(1) : '?'} dB), one under it is left alone`);
}

const tableAfter = buildSfx(sfxContext(SR)) as Record<string, SfxBuffer>, shippedAfter = gameSfx(sfxContext(SR)) as Record<string, SfxBuffer>;
line(Object.keys(kept).every(n => same(kept[n], tableAfter[n].getChannelData(0))) && same(kept[TOYS[1]], tableBefore[TOYS[1]].getChannelData(0)), `the redone table is sample for sample what it was before a take was rendered (${Object.keys(kept).length} voices)`);
line(Object.keys(shippedKept).every(n => same(shippedKept[n], shippedAfter[n].getChannelData(0))), "the table the game's mixer loads is sample for sample what it was");
console.log(bad ? `=== sound-takes-check: ${bad} FAILED ===` : '=== sound-takes-check: ALL PASS ===');
process.exit(bad ? 1 : 0);
