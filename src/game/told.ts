// HOW MUCH YOU'RE TOLD — the fourth difficulty lever (difficulty.ts LEVERS are fog of war, enemy AI, enemy kit), and the fog lever's bottom rung on a squad mission.
//
// The maintainer, 10-23: "how do we communicate friendly and enemy AI state to the player (especially on easier difficulties)". Every setting the game had
// only took signs away (the fog's cones, own eyes). This lever is the other way round: EASIER BY CLEARER, never by hit points. Three rungs, from the
// easiest: GUIDED · STANDARD · BARE. Standard is the level standard, Bare is hard's; Guided is no level's — it is reached by moving the lever.
//
// WHAT A RUNG DOES TODAY: one thing, the last-seen mark (fogofwar.ts lastSeen, the '(?)' ui/overlay.ts already draws for FOG.lastSeen and for the wand).
// An enemy who goes out of the team's sight keeps a fading mark on the spot he was last seen at for `TOLD.standard` seconds on Standard, `TOLD.guided` on
// Guided, and none on Bare (FOG.lastSeen, the debugger's row, is 0 as shipped: turned up it is the seconds on every rung). The mark is the HUD's alone:
// nothing in the game reads it, so a run is the same run on every rung, digest for digest. It is drawn only under a fog: the screens grey the lever's row
// where the mission would start with none.
//
// A LATER RULE ASKS THE LEVER, never the difficulty: `toldNow()` is the rung in force and `toldAtLeast('standard')` / `toldAtLeast('guided')` is 'this sign
// is shown here'. With the switch off both answer as Bare: the build as it was, nothing more told than it ever told.
//
// WHERE THE RUNG LIVES: `TOLD.rung`, a row of this table, written by difficulty.ts with the other levers (the rung of the level the other three stand on — so
// hard's three rungs set by hand are Hard, Bare with them — or the one moved by hand:
// kept per machine with the others, `?told=guided|standard|bare` for a visit), so a recording's tables carry it.
//
// THE FOG OFF ON A SQUAD MISSION (`TOLD.fogOff`): the quiet missions' fog lever has a bottom rung, off (quietfog.ts); with this up a squad mission's fog
// lever has it too — every enemy drawn. No fog is no fog for the squad's own code as well (fogofwar.ts sighting / hidden answer for every enemy, so a charge
// spot, a pair's foe list and the 40 mm count men nobody has seen), and the rung's words say so: it is the cheap test, the floor under Guided, not Guided.
// The rung is the squad lever's (difficulty.ts SET.fog 'off', kept with the levers, `?fog=off` for a visit); scenarioRun.ts fogOfQuery reads it where a
// mission starts, unless the link asks for the fog by name (`fow`).
//
// THE SWITCHES: `TOLD.on` (the lever) and `TOLD.fogOff` (the rung) — both ON in the page (`?told=0`, `?fogoff=0`), OFF here and on the frozen harness
// stand (`TPS_TOLD=1`, `TPS_FOGOFF=1`). Off is the build as it was: three levers, three rungs of fog, FOG.lastSeen alone deciding the mark. A recording
// from before the keys replays with both off (journal.ts).
export type ToldRung = 'guided' | 'standard' | 'bare';
/** the rungs from the easiest up, as a lever lists them */
export const TOLD_RUNGS: readonly ToldRung[] = ['guided', 'standard', 'bare'];

export const TOLD: { on: boolean; rung: ToldRung; guided: number; standard: number; fogOff: boolean } = {
  /** the lever (off: three levers, and every question below answers as Bare) */
  on: false,
  /** the rung in force while the lever is on (difficulty.ts writes it: the level's own, or the one moved by hand) */
  rung: 'standard',
  /** seconds a last-seen mark stays on Guided, and on Standard (Bare: none) */
  guided: 10, standard: 4,
  /** the fog lever on a squad mission has a bottom rung, off */
  fogOff: false,
};

const isRung = (v: unknown): v is ToldRung => TOLD_RUNGS.includes(v as ToldRung);
/** the rung in force (Bare with the switch off: the build as it was) */
export const toldNow = (): ToldRung => (TOLD.on ? (isRung(TOLD.rung) ? TOLD.rung : 'standard') : 'bare');
/** is a sign that belongs to `rung` and to every easier one shown now? ('standard': on Standard and Guided; 'guided': on Guided alone) */
export const toldAtLeast = (rung: ToldRung): boolean => TOLD_RUNGS.indexOf(toldNow()) <= TOLD_RUNGS.indexOf(rung);
/** seconds an enemy's last-seen mark stays, by the rung (0 = none) */
export function toldLastSeen(): number { const r = toldNow(); return r === 'guided' ? Math.max(0, TOLD.guided) : r === 'standard' ? Math.max(0, TOLD.standard) : 0; }
/** the level's own rung: Standard on standard, Bare on hard */
export const toldOfLevel = (level: 'standard' | 'hard'): ToldRung => (level === 'hard' ? 'bare' : 'standard');
