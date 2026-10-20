// THE SOUNDS MADE A VOICE AT A TIME ARE THE SAME SOUNDS (src/audio/audio.ts SFX_WARM, src/audio/sfx.ts buildSfxLater): the table the mixer used to synthesise whole
// inside the first click, against the table made one voice at a time — in another order, at two rates — sample for sample; and making the table of calls renders
// nothing. No browser: the synth is plain arithmetic on Float32Arrays.
//   bun run tools/qa/sfxwarm-check.ts            exit 0 = every check passed, 1 = one failed
//   SFXWARM_BREAK=1 bun run tools/qa/sfxwarm-check.ts   one voice is made with another seed's worth of time shaved off: must FAIL
import { AudioEngine, gameSfx, gameSfxLater, SFX_TABLE, SFX_WARM, warmReset, warmSfx, warmState } from '../../src/audio/audio';
import { sfxContext, type AudioBackend, type SfxBuffer, type SfxContext } from '../../src/audio/backend';

const BREAK = process.env.SFXWARM_BREAK === '1';
let red = 0; const check = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
const same = (a: SfxBuffer, b: SfxBuffer) => { if (a.length !== b.length || a.sampleRate !== b.sampleRate || a.numberOfChannels !== b.numberOfChannels) return false;
  for (let c = 0; c < a.numberOfChannels; c++) { const x = new Uint32Array(a.getChannelData(c).buffer, a.getChannelData(c).byteOffset, a.length), y = new Uint32Array(b.getChannelData(c).buffer, b.getChannelData(c).byteOffset, b.length); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; }
  return true; };

for (const [mode, set] of [['the game\'s table', () => { SFX_TABLE.was = false; SFX_TABLE.redone = false; }], ['the redone table (?newsounds)', () => { SFX_TABLE.was = false; SFX_TABLE.redone = true; }]] as const) {
  set();
  for (const rate of [48000, 44100]) {
    const whole = gameSfx(sfxContext(rate)) as Record<string, SfxBuffer>;
    // the table of calls: how many samples it rendered while being made
    let rendered = 0; const base = sfxContext(rate);
    const counting: SfxContext = { sampleRate: rate, createBuffer(c, n, sr) { if (n > 1) rendered++; return base.createBuffer(c, n, sr); } };
    const t0 = performance.now(); const later = gameSfxLater(counting); const made = performance.now() - t0;
    check(rendered === 0, `${mode} at ${rate}: the table of calls renders no voice while it is made (${rendered} rendered, ${made.toFixed(0)} ms)`);
    const names = [...later.keys()];
    check(names.length === Object.keys(whole).length && names.every(n => n in whole), `${mode} at ${rate}: the same ${Object.keys(whole).length} names (${names.length} calls)`);
    // rendered last to first, every other one first: not the order the whole table is made in
    const order = [...names.filter((_, i) => i % 2 === 0).reverse(), ...names.filter((_, i) => i % 2 === 1)];
    const bad: string[] = []; let longest = 0;
    for (const n of order) { const t = performance.now(); let buf = later.get(n)!(); longest = Math.max(longest, performance.now() - t);
      if (BREAK && n === names[3]) { const cut = base.createBuffer(1, Math.max(1, buf.length - 7), rate); cut.getChannelData(0).set(buf.getChannelData(0).subarray(0, cut.length)); buf = cut; }
      if (!same(buf, whole[n])) bad.push(n); }
    check(bad.length === 0, `${mode} at ${rate}: every voice made by itself, out of order, is the whole table's sample for sample${bad.length ? ` — differ: ${bad.slice(0, 6).join(', ')}` : ''} (longest single voice ${longest.toFixed(0)} ms here)`);
    const again = later.get(names[0])!(), first = later.get(names[0])!();
    check(again === first, `${mode} at ${rate}: a voice asked for twice is rendered once`);
  }
}
// THE MIXER'S SIDE (AudioEngine.start / play over a stand-in backend): what the page's warm-up made is handed over whole at the start; a mixer at another rate
// drops it and makes its own; a voice asked for before its turn is made on the spot.
SFX_TABLE.was = false; SFX_TABLE.redone = false;
const fake = (rate: number) => { const loaded = new Map<string, SfxBuffer>(), played: string[] = []; const sc = sfxContext(rate);
  const b: AudioBackend = { sampleRate: rate, now: () => 0, sfxContext: sc, loadBuffer: (id, buf) => { loaded.set(id, buf); }, duration: id => loaded.get(id)?.duration ?? 0,
    play: o => { played.push(o.buffer); return {}; }, setVoice() {}, stop() {}, release() {}, setListener() {}, setBus() {}, setReverb() {}, rainLevel() {} };
  return { b, loaded, played }; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
{ const whole = gameSfx(sfxContext(48000)) as Record<string, SfxBuffer>, names = Object.keys(whole);
  check(SFX_WARM.on, 'the switch ships on');
  warmSfx(48000);
  check(warmState().left === names.length && warmState().waiting === 0, `the page's ask makes nothing on the spot (${warmState().left} to make)`);
  for (let i = 0; i < 2000 && warmState().left > 0; i++) await sleep(5);
  check(warmState().left === 0 && warmState().waiting === names.length, `left alone it makes the whole table a voice at a time (${warmState().slices} slices, the longest ${warmState().longest.toFixed(0)} ms here)`);
  const F = fake(48000), a = new AudioEngine({} as never, () => F.b); const t = performance.now(); a.start(); const ms = performance.now() - t;
  check(names.every(n => F.loaded.has(n) && same(F.loaded.get(n)!, whole[n])), `a mixer starting at that rate is handed every voice, sample for sample (its start: ${ms.toFixed(0)} ms)`);
  check(warmState().waiting === 0 && warmState().live, 'and nothing is left waiting');
  // a second mixer on the same page: the warm-up is the first one's, this one makes its own table whole as it always did
  { const H = fake(48000), h = new AudioEngine({} as never, () => H.b); h.start();
    check(names.every(n => H.loaded.has(n) && same(H.loaded.get(n)!, whole[n])) && names.every(n => F.loaded.has(n)), 'a second mixer on the page has its whole table at its start, and takes nothing from the first'); }
  // a page whose guess at the rate was wrong: what it made is dropped at the start, the table is made at the device's rate a voice at a time; one asked for now is made now
  warmReset(); warmSfx(48000);
  for (let i = 0; i < 2000 && warmState().left > 0; i++) await sleep(5);
  const G = fake(44100), g = new AudioEngine({} as never, () => G.b); g.start();
  const whole44 = gameSfx(sfxContext(44100)) as Record<string, SfxBuffer>;
  check(!G.loaded.has('thunderFar') && warmState().left > 0 && warmState().rate === 44100, `a mixer at another rate starts with its table still to make (${warmState().left} left), nothing of the other rate's in it`);
  g.play('thunderFar', null, 1);
  check(G.loaded.has('thunderFar') && same(G.loaded.get('thunderFar')!, whole44.thunderFar) && G.played.includes('thunderFar'), 'a voice asked for before its turn is made on the spot and played');
  for (let i = 0; i < 2000 && warmState().left > 0; i++) await sleep(5);
  check(names.every(n => G.loaded.has(n) && same(G.loaded.get(n)!, whole44[n])), 'and the rest arrive by themselves, every one the whole table\'s at that rate'); }
console.log(red ? `${red} FAILED` : 'all passed');
process.exit(red ? 1 : 0);
