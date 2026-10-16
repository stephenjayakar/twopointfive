// THE PLAY-THROUGH AS THE BUILD SHIPS — tools/qa/playthrough.ts stood up the way the PAGE stands the game, not the way the harness does. The harness holds the
// newer rules off so every frozen digest still means what it meant; a mission judged for a player has to be played with them on. This wrapper runs the
// play-through under THE SHIPPED PROFILE (src/host/profile.ts: TPS_PROFILE=shipped — none of the harness's pins, the rows the page's boot writes, the cast), which
// `node tools/qa/shipped-page.cjs` holds equal to the real page switch for switch, and passes everything else through.
// Still NOT the page: Sam is the scripted commander (god mode, unseen, never fires), the engine is JavaScriptCore not V8, there is no GPU light meter (headless
// light skips the moon) and no smoke sight lines, and nothing a machine has kept (localStorage) is in it.
//   bun run tools/qa/ships.ts [--hard] [--weather rain|downpour|fog|dust] [--callout] [--regroup] [--noplaces] [--base | --partial] <any playthrough.ts flags>
//     --hard      DIFFICULTY.level hard          --weather K   WEATHER.kind (the page's ?weather=)        --callout / --regroup   the last defenders' switches
//     --base      the harness's own (frozen) stand, nothing set: the comparison arm
//     --partial   this wrapper as it was before the shared profile — GLASSFX=on TPS_MOVES=1 TPS_TURN=1 TPS_CAST=1 and the defenders' frags, nothing else: the stand
//                 every tally made with ships.ts up to the one build 527a92a was run on (it left the pouches rule, the destruction switch, the door walk, the
//                 night's opening, the silent net, the silent order, Sam's aim rows and the defender squads' radio check off)
//                 THE CHECKS THAT CALL THIS FILE PASS --partial (barracks-check, brace-room-check, callout-place-check, fallback-in-check, level-names-check,
//                 records-front-check (other-door-check plays the shipped stand now: its bar was read there); kit-cells.ts sets the same rows itself): their bounds were read on that stand. Each drops the flag
//                 once its bound has been read again under the profile.
//   env passes through: PT_HOUR=midday, PT_SEARCH=1, PT_SQUAD=2, PT_MORTAL=1 … (playthrough.ts's head lists them); a pin's own word still holds under the profile
//   (TPS_MOVES=0 bun run tools/qa/ships.ts = as shipped but for the movement pass)
//   exit code = playthrough.ts's
import { resolve } from 'node:path';
const argv = process.argv.slice(2), rest: string[] = [];
let set: Record<string, Record<string, unknown>> = {}, base = false, partial = false, hard = false, weather: string | null = null; const last: string[] = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i];
  if (a === '--set') set = JSON.parse(argv[++i] ?? '{}');
  else if (a === '--base') base = true;
  else if (a === '--partial') partial = true;
  else if (a === '--hard') hard = true;
  else if (a === '--weather') weather = argv[++i] ?? null;
  else if (a === '--callout') last.push('callout');
  else if (a === '--regroup') last.push('regroup');
  else if (a === '--noplaces') last.push('noplaces');   // (laststand.ts `places` off: the call out's lines as they were)
  else rest.push(a); }
const merge = (name: string, o: Record<string, unknown>) => { set[name] = { ...o, ...(set[name] ?? {}) }; };   // (an explicit --set row wins)
if (base && partial) { console.error('ships.ts: --base and --partial are two different stands'); process.exit(2); }
if (partial) merge('FRAG', { defenders: true });
if (hard) merge('DIFFICULTY', { level: 'hard' });
if (weather) merge('WEATHER', { kind: weather });
const env: Record<string, string | undefined> = { ...process.env, ...(base ? { TPS_PROFILE: 'frozen' } : partial ? { TPS_PROFILE: 'frozen', GLASSFX: 'on', TPS_MOVES: '1', TPS_TURN: '1', TPS_CAST: '1' } : { TPS_PROFILE: 'shipped' }), ...(last.length ? { LASTSTAND: last.join(',') } : {}) };
const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'playthrough.ts'), ...rest, '--set', JSON.stringify(set)], { stdout: 'inherit', stderr: 'inherit', env });
process.exit(await pr.exited);
