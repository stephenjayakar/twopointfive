// Which sound table the game's mixer plays (src/audio/audio.ts `gameSfx`): as shipped the redone table with the voices the maintainer picked as better before laid
// over it from the old one (audio/sfxWas.ts `WAS_IN_GAME`), all of the old table under SFX_TABLE.was (?oldsounds), all of the redone one under SFX_TABLE.redone (?newsounds).
//   bun run tools/qa/gunfire-table-check.ts        exit 0 = holds, 1 = a line failed        GUNFIRE_BREAK=1 = the overlay left out: must fail
import { SFX_TABLE, gameSfx } from '../../src/audio/audio';
import { buildSfx } from '../../src/audio/sfx';
import { buildSfxWas, wasInGame, wasOnly, WAS_IN_GAME } from '../../src/audio/sfxWas';
import type { SfxBuffer, SfxContext } from '../../src/audio/backend';

const ctx = (rate: number): SfxContext => ({ sampleRate: rate, createBuffer: (_c: number, len: number, sr: number) => { const d = new Float32Array(len); return { getChannelData: () => d, duration: len / sr, length: len, sampleRate: sr } as unknown as SfxBuffer; } }) as unknown as SfxContext;
const same = (a: SfxBuffer | undefined, b: SfxBuffer | undefined) => { if (!a || !b) return false; const x = a.getChannelData(0), y = b.getChannelData(0); if (x.length !== y.length) return false; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; };
let bad = 0; const line = (ok: boolean, what: string) => { console.log(`  - ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) bad++; };
const kept = WAS_IN_GAME as readonly string[];
/** his votes of 10-12, as he typed them */
const BEFORE = ['pistolSuppressed', 'carbineReport', 'dryFire', 'click', 'nvOn', 'nvOff', 'stairBoots', 'lockPick', 'powerDown', 'powerUp', 'alarmChirp', 'glassTinkle'];
const AFTER = ['pistolLoud', 'launcher', 'magDrop', 'casingTink', 'bulletImpact', 'bodyHit', 'equip', 'canisterBounce', 'doorCreak', 'doorBash', 'lockOpen', 'lockBreak', 'padBeep', 'padOpen', 'bodyFall', 'chokeStrain', 'whipThud', 'lightOff', 'propThud', 'glassCrack', 'glassShatter', 'glassCrunch', 'stunBang', 'radio'];
line(BEFORE.every(n => kept.includes(n)) && AFTER.every(n => !kept.includes(n)), `the list: his twelve 'better before' are in it, none of his twenty-four 'better after' is (${kept.length} names)`);

for (const rate of [48000, 44100]) {
  const c = ctx(rate), now = buildSfx(c) as Record<string, SfxBuffer>, was = buildSfxWas(c) as Record<string, SfxBuffer>, picked = wasInGame(c) as Record<string, SfxBuffer>, one = wasOnly(c, ['doorCreak']) as Record<string, SfxBuffer>;
  const names = Object.keys(now);
  line(Object.keys(picked).length === kept.length && kept.every(n => same(picked[n], was[n])) && Object.keys(one).length === 1 && same(one.doorCreak, was.doorCreak), `${rate} Hz: the voices rendered alone out of the old table are the old table's, sample for sample`);
  line(kept.every(n => !same(now[n], was[n])) && AFTER.every(n => !same(now[n], was[n])), `${rate} Hz: each voice he voted on differs between the two tables (there is something to choose)`);
  SFX_TABLE.was = false; SFX_TABLE.redone = false;
  const ship = (process.env.GUNFIRE_BREAK ? now : gameSfx(c)) as Record<string, SfxBuffer>;
  line(kept.every(n => same(ship[n], was[n])), `${rate} Hz, as shipped: the ${kept.length} kept voices are the old ones`);
  line(AFTER.every(n => same(ship[n], now[n])), `${rate} Hz, as shipped: his 'better after' picks are the redone ones, the pistol's loud report among them`);
  line(names.filter(n => !kept.includes(n)).every(n => same(ship[n], now[n])) && Object.keys(ship).length === names.length, `${rate} Hz, as shipped: every other sound is the redone table's (${names.length - kept.length} of them)`);
  SFX_TABLE.redone = true;
  const red = gameSfx(c) as Record<string, SfxBuffer>;
  line(names.every(n => same(red[n], now[n])), `${rate} Hz, ?newsounds: the redone table whole`);
  SFX_TABLE.redone = false; SFX_TABLE.was = true;
  const old = gameSfx(c) as Record<string, SfxBuffer>;
  line(names.every(n => same(old[n], was[n] ?? now[n])), `${rate} Hz, ?oldsounds: the old table whole (a voice it never had keeps the redone one)`);
  SFX_TABLE.was = false;
}
console.log(bad ? `=== gunfire-table-check: ${bad} FAILED ===` : '=== gunfire-table-check: ALL PASS ===');
process.exit(bad ? 1 : 0);
