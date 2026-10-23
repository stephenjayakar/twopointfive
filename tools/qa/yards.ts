// THE THREE STAGE YARDS: levels that were Training lessons (1, 5 and 7) and are kept, with no row on the mission list (and no lesson, but for train-orders,
// whose lesson one check still plays), because checks are staged on their floors (docs/agents/missions.md, "The seven Training lessons are out"). A check that started one by its row finds the row here: the same
// kind, team size, level and seed the list's row had, and nothing a menu reads.
export interface YardRow { id: string; title: string; kind: 'quiet' | 'roomclear'; squad: number; level: string; seed?: number }
export const YARD_ROWS: YardRow[] = [
  { id: 'train-move', title: 'the motor pool yard', kind: 'quiet', squad: 0, level: 'train-move.json' },
  { id: 'train-orders', title: 'the quarters yard', kind: 'roomclear', squad: 2, level: 'train-orders.json', seed: 1 },
  { id: 'train-silent', title: 'the well court yard', kind: 'quiet', squad: 1, level: 'train-silent.json' },
];
export const yardRow = (id: string): YardRow | undefined => YARD_ROWS.find(r => r.id === id);
