// THE HAND-OVER, on a page: every kept replay as one downloaded file (keepstore.ts makeDump). Shared by the game page (the start page's row, __replay.dump) and the
// replay viewer. Nothing is sent anywhere: the browser saves a file, and what it carried is marked so the next hand-over holds only what is new.
import type { KeptStore, Dump, KeptSummary } from './keepstore';
import { browserStore, makeDump, keptSummary } from './keepstore';

let store: KeptStore | null = null;
/** this browser's store of kept tapes (one connection a page) */
export const keptStore = (): KeptStore => store ??= browserStore();
/** the page that is keeping a tape right now hands in how to bring the store up to the moment (ui/replaykey.ts) */
let live: (() => Promise<void>) | null = null;
export const setLiveKeeper = (f: (() => Promise<void>) | null): void => { live = f; };

export const mb = (bytes: number): string => bytes >= 1048576 * 10 ? `${Math.round(bytes / 1048576)} MB` : bytes >= 104858 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
export const mins = (s: number): string => s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;
/** what is kept, in a line */
export function keptWords(S: KeptSummary): string {
  if (!S.visits) return 'nothing kept yet';
  const all = `${S.visits} kept (${mins(S.seconds)}, ${mb(S.bytes)})`;
  return S.fresh ? `${S.fresh} new (${mins(S.freshSeconds)}, ${mb(S.freshBytes)}) · ${all}` : `${S.noted ? 'new notes' : 'nothing new'} · ${all}`;
}
export async function keptNow(): Promise<KeptSummary> { try { await live?.(); } catch { /* */ } return keptSummary(keptStore()); }

let busy = false;
/** download the kept replays as one file. `all`: every kept visit, not only what no hand-over has carried. Resolves to what was handed over (null: nothing to) */
export async function dumpNow(opts: { all?: boolean } = {}, say: (s: string) => void = () => {}): Promise<Dump | null> {
  if (busy) return null; busy = true;
  try {
    say('Packing…');
    try { await live?.(); } catch { /* */ }
    const d = await makeDump(keptStore(), { all: opts.all, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined });
    if (!d) { say(opts.all ? 'Nothing kept yet' : 'Nothing new'); return null; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(d.blob); a.download = d.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    await d.sent();   // (a page cannot tell a save from a cancelled one: 'everything kept' hands it all over again)
    say(d.visits ? `Downloaded ${d.visits} visit${d.visits === 1 ? '' : 's'}, one file (${mb(d.blob.size)})` : d.files ? `Downloaded ${d.files} saved replay${d.files === 1 ? '' : 's'} (${mb(d.blob.size)})` : `Downloaded the new notes (${mb(d.blob.size)})`);
    return d;
  } catch (e) { say(`The kept replays could not be packed: ${String((e as Error | undefined)?.message ?? e).slice(0, 160)}`); return null; }
  finally { busy = false; }
}
