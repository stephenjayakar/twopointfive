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
