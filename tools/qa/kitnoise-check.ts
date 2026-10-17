// THE SOUND MARKS OF A QUIET MISSION'S GEAR SCREEN SAY WHAT THE GAME DOES (src/ui/kitNoise.ts): a gun's step follows its row of WEAPONS, and each fixed
// step still has the line of the game it copies. Reads files and the weapon table only: no stand to run it on.
//   bun run tools/qa/kitnoise-check.ts        exit 0 all PASS · 1 a FAIL
// KITNOISE_BREAK=1 makes the suppressed pistol's report loud in the table before asking: 'the pistol alone is one arc' must fail.
import { readFileSync } from 'node:fs';
import { WEAPONS } from '../../src/game/weapons';
import { kitDefault, kitGun, type MemberKit } from '../../src/game/kit';
import { kitNoise, quietGear } from '../../src/ui/kitNoise';

let fails = 0;
const check = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const src = (f: string) => readFileSync(new URL(`../../src/game/${f}`, import.meta.url), 'utf8');
if (process.env.KITNOISE_BREAK === '1') (WEAPONS.fiveseven.report as { loud: boolean }).loud = true;

const sam = (weapon: string): MemberKit => ({ ...kitDefault(0), weapon } as MemberKit);
const steps = { pistol: kitNoise('weapon', sam('pistol'), 0), rifle: kitNoise('weapon', sam('rifle'), 0), shotgun: kitNoise('weapon', sam('shotgun'), 0) };
check(steps.pistol === 1 && steps.rifle === 2 && steps.shotgun === 2, 'the pistol alone is one arc', `Sam's picks: ${JSON.stringify(steps)} · reports loud: fiveseven ${WEAPONS.fiveseven.report.loud}, fn2000 ${WEAPONS.fn2000.report.loud}, m870 ${WEAPONS.m870.report.loud}`);
{ const bad: string[] = [];
  for (const weapon of ['rifle', 'pistol', 'shotgun']) for (const suppressed of [true, false]) { const m = { ...kitDefault(1), weapon, suppressed } as MemberKit, want = WEAPONS[kitGun(m)].report.loud ? 2 : 1, got = kitNoise('weapon', m, 1); if (got !== want) bad.push(`${weapon}/${suppressed}: ${got} not ${want}`); }
  check(bad.length === 0, "a teammate's gun follows the gun his card puts in his hands", bad.join(' · ') || 'six cards, each the step of WEAPONS[kitGun(card)].report'); }
{ const lines: [string, string, RegExp, number][] = [
    ['smoke', 'combat.ts', /kind: 'shot'[^\n]*loud: false[^\n]*the pop/, 1], ['cams', 'stickycam.ts', /kind: 'prop'[^\n]*loud: false/, 1],
    ['bangs', 'combat.ts', /kind: 'bang'[^\n]*loud: true/, 2], ['charges', 'combat.ts', /kind: 'bang'[^\n]*loud: true, charge: true/, 2],
    ['frags', 'frag.ts', /kind: 'bang'[^\n]*loud: true, level: 2/, 3], ['shells', 'he40.ts', /= blast\(g,/, 3] ];
  const m = kitDefault(0), bad = lines.filter(([f, file, re, n]) => kitNoise(f, m, 0) !== n || !re.test(src(file))).map(([f, file]) => `${f} (${file})`);
  check(bad.length === 0, 'each fixed step still has the line of the game it copies', bad.join(' · ') || lines.map(([f, file, , n]) => `${f} ${n} ${file}`).join(' · ')); }
check(['suit', 'trim', 'wand', 'light', 'nvg', 'suppressed'].every(f => kitNoise(f, kitDefault(1), 1) === 0), 'what he wears and fits has no mark', 'suit, trim, wand, light, nvg, suppressor: 0');
check(quietGear('quiet') && quietGear('solo') && !quietGear('roomclear') && !quietGear('rescue') && !quietGear('nightbreach') && !quietGear('quiet', '?quiet&kitloud'), 'which missions take the look', "quiet and solo; not a room clear, a rescue or the night breach; not with 'kitloud' on the address");
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
