// PLAN MODE'S CIRCLES, FAINTER (the maintainer, 10-24, playing with plan mode up: "plan mode circles should be fainter -- can you add a slider in the
// settings"): the circle at each man's feet while plan mode is up, and the player's own (ui/cmdring.ts updatePlan; index.html `.planmode .pm` and
// `.pself`), is drawn at `rings` of the strength it was built with. A PICTURE ONLY: the page's layer reads it and the game never does, so no stand, no
// recording and no replay knows of it.
//   1                 as it was built (the value here, and `?planrings=1` on the address)
//   PLANLOOK_PAGE     what the page opens with where nobody has chosen
//   Options > Game > "Plan mode circles"   the player's own, kept on this machine; Reset to defaults puts the page's back
//   ?planrings=<0..1> a visit's own word: it holds over what the machine kept and is never written as the machine's choice
// `bun run tools/qa/planlook-check.ts` (probes.ts planlook, family ui) asks it; `window.__planlook` moves it from a page check.
export const PLANLOOK = { rings: 1 };
/** the page's own strength, where no visit and no kept choice says otherwise */
export const PLANLOOK_PAGE = 0.4;
const LS = 'twopointsix.planlook';
let loaded = false;

const unit = (v: unknown): number | null => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
/** what a page starts with: the visit's own word, else what this machine kept, else the page's (`url`: the visit chose) */
export function planRingsFrom(search: string, keptJson: string | null): { rings: number; url: boolean } {
  let q: string | null = null; try { q = new URLSearchParams(search).get('planrings'); } catch { q = null; }
  const asked = q !== null && q.trim() !== '' ? unit(Number(q)) : null;
  if (asked !== null) return { rings: asked, url: true };
  let kept: number | null = null; try { kept = unit((JSON.parse(keptJson ?? 'null') as { rings?: unknown } | null)?.rings); } catch { kept = null; }
  return { rings: kept ?? PLANLOOK_PAGE, url: false };
}
/** how strongly the circles are drawn, 0 to 1 (the first ask reads the address and what this machine kept) */
export function planRings(): number {
  if (!loaded) { loaded = true;
    let search = '', kept: string | null = null;
    try { search = globalThis.location?.search ?? ''; kept = globalThis.localStorage?.getItem(LS) ?? null; } catch { /* no page, no store: the page's own */ }
    PLANLOOK.rings = planRingsFrom(search, kept).rings; }
  return PLANLOOK.rings;
}
/** the player's own choice (the Options row, the debugger's slider): drawn at once, and kept on this machine */
export function setPlanRings(v: number): void {
  planRings(); PLANLOOK.rings = unit(v) ?? PLANLOOK_PAGE;
  try { globalThis.localStorage?.setItem(LS, JSON.stringify({ rings: PLANLOOK.rings })); } catch { /* no store */ }
}
/** Reset to defaults: the page's own again, and nothing kept */
export function resetPlanRings(): void {
  loaded = true; PLANLOOK.rings = PLANLOOK_PAGE;
  try { globalThis.localStorage?.removeItem(LS); } catch { /* no store */ }
}
