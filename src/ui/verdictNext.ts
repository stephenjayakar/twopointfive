// A LESSON DONE LEADS TO THE NEXT ONE: the end card of a Training lesson that was won offers the next row of the Training group as its first button (ui/menu.ts
// debrief) — that row's own page load, the visitor's other flags kept, as a pick of it on the mission list would be. Null on any other page, after the last
// lesson, and with no verdict (?noverdict: the card as it was).
import { VERDICT } from '../game/verdict';
import { TRAINING_MISSIONS as TRAINING, TUTORIAL_MISSIONS } from '../scene/scenarioList';
import { missionHref, missionList } from './missions';

/** `id` = the Training row that is up (the running scenario's own entry: what was staged, not what the query asked for) */
export function nextLessonOf(id: string | null | undefined, search: string = typeof location !== 'undefined' ? location.search ?? '' : ''): { id: string; title: string; href: string; start(): void } | null {
  if (!VERDICT.on || !id) return null;
  const TRAINING_MISSIONS = TUTORIAL_MISSIONS.some(e => e.id === id) ? TUTORIAL_MISSIONS : TRAINING;   // (a tutorial mission's next is the tutorial's own)
  const i = TRAINING_MISSIONS.findIndex(e => e.id === id), next = i >= 0 ? TRAINING_MISSIONS[i + 1] : undefined, m = next && missionList().find(x => x.scenario?.id === next.id);
  if (!m) return null;
  const href = missionHref(m, search);
  return { id: m.id, title: m.title, href, start: () => { const L = location as Location; L.assign((L.pathname ?? '') + href + (L.hash ?? '')); } };
}
