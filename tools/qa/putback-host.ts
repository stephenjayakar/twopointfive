// THE HOST'S OWN PUT-BACK, RUN HEADLESS (src/host/putback.ts hostAfterPutBack — what the page's `saves.onPutBack` calls after a save kept in memory is put back).
// The harness's engine has no GPU books to forget, so the calls it lacks are stood in as no-ops for the call; everything else the hook does is the hook's own.
// Returns the names stood in. A check of "a save put back drops X" runs THIS, never a hand on the host's field (the stand-in list is fire-check.ts's own, here once).
import { ROOT } from './headless.ts';

export async function hostPutBack(g: any): Promise<string[]> {
  const { hostAfterPutBack } = await import(`${ROOT}/src/host/putback.ts`);
  const lacking: string[] = [], E: any = g.engine, noop = () => { };
  for (const [o, k] of [[E.world, 'forgetSent'], [E.lights, 'forgetSent'], [g.chars, 'forgetSent'], [g.decals, 'touch'], [g, 'rehand'], [E, 'resetTaa'], [E, 'invalidateWorldCache']] as [any, string][])
    if (o && typeof o[k] !== 'function') { o[k] = noop; lacking.push(k); }
  hostAfterPutBack(g);
  return lacking;
}
