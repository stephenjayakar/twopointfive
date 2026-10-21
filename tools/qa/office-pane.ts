// The office's glass panes BY WHERE THEY STAND, never by index: a level export that adds a box moves every index after it (the door-size export of 10-10 moved the
// conference glazing one along, and every probe that said "pane 110" was shooting its neighbour's edge). levels/office.json boxes[i] ≡ world.statics[i].
import office from '../../levels/office.json';

/** the index of the office's pane whose centre stands at (x, z); throws when there is none (a probe aimed at a pane that is gone should say so, not shoot a wall) */
export function officePane(x: number, z: number): number {
  const i = (office as { boxes: { c: number[]; flags?: string[] }[] }).boxes.findIndex(b => !!b.flags?.includes('Glass') && Math.abs(b.c[0] - x) < 0.01 && Math.abs(b.c[2] - z) < 0.01);
  if (i < 0) throw new Error(`office-pane: no glass pane with its centre at (${x}, ${z}) in levels/office.json`);
  return i;
}
/** the conference partition's second sheet, c (7.5, 1.5, 10), h (0.5, 1, 0.006): the pane the glass probes shoot */
export const CONF_PANE = officePane(7.5, 10);
/** the partition's three sheets over the conference room, west to east (x 6‥7, 7‥8, 8‥9) */
export const CONF_PANES = [officePane(6.5, 10), CONF_PANE, officePane(8.5, 10)];
/** the lobby frontage's three full-height sheets beside the lot, south to north */
export const LOBBY_PANES = [officePane(4, 17.75), officePane(4, 19.25), officePane(4, 20.75)];
/** the pane the glass tuning tools shoot for a type (glass-tune.ts, glasstune-probes.ts, glass-fight.ts): the conference partition's second sheet · the lobby
 *  frontage's first full-height sheet · the manager's sidelight, c (26.475, 1.25, 10) */
export const TUNE_PANE = { annealed: CONF_PANE, tempered: LOBBY_PANES[0], laminated: officePane(26.475, 10) };
/** the partition's last sheet, c (12.95, 1.5, 10): the probes' second pane, clear of the first one's fallout */
export const CONF_FAR = officePane(12.95, 10);
/** every sheet of the conference partition (z 10, x under 14), west to east */
export const CONF_ALL = (office as { boxes: { c: number[]; flags?: string[] }[] }).boxes.map((b, i) => ({ b, i })).filter(({ b }) => !!b.flags?.includes('Glass') && Math.abs(b.c[2] - 10) < 0.05 && b.c[0] < 14).sort((a, b) => a.b.c[0] - b.b.c[0]).map(x => x.i);
/** THE PARTITION AS FLOAT. The glass probes written before a pane's kind came from where it sits (glassbreak.ts GLASSREAL.place) stage a KIND of glass in a frame
 *  they know by heart: plain float in the conference partition — how it stars, runs to daggers, holds a hole, is raked, what a blast and a boot do to it. By place
 *  that partition is toughened (it reaches the floor) and no float sheet in the office stands in a frame like it, so a probe about float glass says so: its stage
 *  makes the partition's sheets float with the game's own word for one pane (setType — which these probes already use to make the same sheet toughened or
 *  laminated). Everything else runs as the stand has it: every other pane by the rule, toughened glass dropping at once. Where the level puts which kind is asked
 *  by glassreal-check.ts lines 6 to 9, not here. With the placement off (the frozen stand) the partition is float already: the
 *  override is there (reset() keeps it) and no pane breaks differently for it. A stand-up in these six files that leaves it out passes on the frozen stand and fails
 *  on the page's. */
export function floatPartition(game: { glassBreak?: { setType?(bi: number, type: 'annealed'): void } | null }) { for (const bi of CONF_ALL) game.glassBreak?.setType?.(bi, 'annealed'); }
