// The game page's side of the REPLAY BUFFER (game/replaybuf.ts): the buffer is given to the Game at boot and runs from then on with nothing pressed; F7 puts the
// last stretch of play on the replay SHELF (src/replay/shelf.ts — this browser's IndexedDB) and SAYS SO ON THE PAGE in a tag of its own (`say`: the game's message line
// is drawn only on the debug read-out, which is off unless a machine asked for it — with the words only there F7 looked like it did nothing); Shift+F7 does that and opens the
// VIEWER (replay.html) on it in this window. A crash of the page (main.ts's fatal card) saves one by itself, and is filed in the buffer as a line at its moment. Off: ?noreplay for a visit, or localStorage
// `twopointsix.replay` = '0' (__replay.on = false writes it) — then no buffer is made and the Game's tap stays null: the build as it was.
// Its own key listener, as F8's: a replay must save from the pause card, the down card and a frozen frame alike.
import type { Game } from '../game/game';
import { ReplayBuffer, REPLAY } from '../game/replaybuf';
import type { ReplayMeta } from '../game/replaybuf';
import type { ReplayFile } from '../replay/format';
import { shelfPut } from '../replay/shelf';
import { CAME_FROM, clock, downloadReplay, errorMarks, lastRun, leaveFor, replayName } from '../replay/format';
import { missionLive } from '../game/mission';
export { CAME_FROM, leaveFor };
import { ReplayKeeper } from '../replay/keeper';
import { KEEP, keptSummary, pruneKept, keepBudget } from '../replay/keepstore';
import { keptStore, setLiveKeeper, dumpNow, keptWords } from '../replay/dumpui';

const LS = 'twopointsix.replay';
/** EVERY RUN IS KEPT (replay/keeper.ts): the tape is written to this browser's storage in pieces as it is played, nothing pressed. Off for a visit with ?nokeep,
 *  for the machine with localStorage `twopointsix.keep` = '0' (__replay.keeping = false writes it); off with the buffer itself */
const LS_KEEP = 'twopointsix.keep';
/** replays an error saves by itself in one page load, and the least time between two tries that made no file */
const CRASH_MAX = 3, CRASH_TRY_MS = 2000, CRASH_GAP_MS = 60000;
/** how long the page's own tag shows what F7 did (a shelf that does not answer is the shelf's own wait: shelf.ts SHELF.openMs, then the file is a download) */
const TAG_MS = 7000;
/** the tag: under the checkpoint and REC tags (index.html #checkpoint, #journal), over the cards and the debugger's panel, on a plate of its own so it reads over either */
const TAG_CSS = 'position:fixed;right:14px;top:42px;max-width:min(64ch,70vw / var(--tz, 1));z-index:45;padding:3px 7px;border-radius:3px;background:rgba(var(--h-plate,12,11,9),0.94);font:11px/1.4 var(--h-font,sans-serif);letter-spacing:0.01em;text-align:right;color:var(--h-ink,#d2c9b5);pointer-events:none;opacity:0;transition:opacity .3s';
const OFF = 'Replay buffer is off (?noreplay or the stored switch): F7 has nothing to save';
/** F7 as a key of ours: plain or with Shift, not a repeat, not typed into a field */
const f7 = (e: KeyboardEvent): boolean => e.code === 'F7' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? '');

export class ReplayKey {
  readonly buf: ReplayBuffer | null;
  /** the commit the dev server says it serves (tools/serve.ts /qa/commit); absent off a static build */
  commit: string | undefined;
  last: { id: number | null; file: ReplayFile } | null = null;
  /** the tape of this page visit being written out as it is played (null: not kept) */
  keeper: ReplayKeeper | null = null;
  /** this page visit's name: the kept tape's, and on every file F7 makes during it (so a reader knows the file is a window of that tape) */
  readonly session: string = sessionId();
  private played = false;
  constructor(private game: Game, cam: { target: ArrayLike<number>; yaw: number; distance: number }, private note: (s: string) => void, private meta: () => Partial<ReplayMeta> = () => ({})) {
    // (a game page is up — booted, or handed back by the browser as it was left: the last trip to a replay is over, and leaveFor's mark is one trip's)
    try { if (!/[?&]playtape=/.test(location.search)) { sessionStorage.removeItem(CAME_FROM); window.addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted) { try { sessionStorage.removeItem(CAME_FROM); } catch { /* */ } } }); } } catch { /* */ }
    let on = true;
    try { if (new URLSearchParams(location.search).has('noreplay') || localStorage.getItem(LS) === '0') on = false; } catch { /* a sandboxed frame: on */ }
    this.buf = on ? new ReplayBuffer() : null;
    if (!this.buf) { try { window.addEventListener('keydown', e => { if (f7(e)) this.say(OFF); }); } catch { /* */ } return; }   // (no buffer, no tap, nothing saved: only the key says why it does nothing)
    const buf = this.buf; buf.tape.born(game); game.replayTap = (dt, cmd) => { if (cmd) buf.top(game, dt, cmd); else { buf.tick(game, dt, cam); if (dt > 0 && !game.touring) this.played = true; } };   // (a step of no time is the page redrawing a still, not play)
    // (a control worked between two steps — a slider or a box of the debugger, a lab's panel, a card's button: the tape looks at every table before the next step
    // instead of on its slow round, so a number moved while playing is taped at the step it first acts on. The game's own view is not a control)
    try { for (const ev of ['input', 'change', 'click']) document.addEventListener(ev, e => { if ((e.target as Element | null)?.id !== 'view') buf.tape.touched(); }, true); } catch { /* */ }
    this.keep();
    try { void fetch('/qa/commit', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => { const c = t.trim(); if (/^[0-9a-f]{7,40}$/.test(c)) this.commit = c; }).catch(() => {}); } catch { /* no dev server */ }
    window.addEventListener('keydown', e => {
      if (!f7(e)) return;
      e.preventDefault();
      if (e.shiftKey) this.keyView(); else void this.save('key');
    });
    window.addEventListener('error', ev => { if (!/ResizeObserver loop/.test(ev.message)) this.crashed(ev.message); });
    window.addEventListener('unhandledrejection', ev => this.crashed(String((ev.reason as Error | undefined)?.message ?? ev.reason)));
  }
  private tagEl: HTMLElement | null = null; private tagT: ReturnType<typeof setTimeout> | null = null;
  /** what F7 (or an error's own save) did, said where the player sees it: the note the page handed in (the message line and the debug read-out — neither is drawn
   *  on a page that has not asked for the read-out) AND a small tag of this file's own, for a few seconds. `tag` false = the note alone: an ERROR's save that made
   *  no file is asked again every CRASH_TRY_MS while the error repeats, and the page's fatal card is already up — the tag is for what a key press did */
  private say(s: string, tag = true): void {
    try { this.note(s); } catch { /* */ }
    if (!tag) return;
    try {
      if (!this.tagEl) { const el = document.createElement('div'); el.id = 'replaytag'; el.style.cssText = TAG_CSS; document.body.appendChild(el); this.tagEl = el; }
      const el = this.tagEl; el.textContent = s; el.style.opacity = '0.9';
      if (this.tagT) clearTimeout(this.tagT);
      this.tagT = setTimeout(() => { el.style.opacity = '0'; }, TAG_MS);
    } catch { /* headless: no page to say it on */ }
  }
  private crashAt = -Infinity; private crashTry = -Infinity; private crashing = false; private crashes = 0;
  /** the page hit an error (the window's, or the frame loop's own catch — main.ts): a replay saves by itself. One file a minute at most once one HAS left the
   *  buffer — onto the shelf, or as the download a browser that keeps no shelf gets instead — and CRASH_MAX a page load (an error that repeats must fill neither
   *  the shelf, which would push out the replays F7 put there, nor the downloads folder); an error that made no file (nothing played yet) spends neither, and
   *  is asked again no sooner than CRASH_TRY_MS later (its one line on the message row must not repeat every frame).
   *  FIRST, and whatever that budget says, the error is filed in the ring as a line at the play moment it came (ReplayBuffer.pageError, which has its own rule
   *  for an error that repeats — on the play clock): the file this error saves, and every file F7 makes while the ring still holds that moment, carries it —
   *  which is how the one-file build's 'F7 downloads a replay' file, and an F7 after an error the budget swallowed, say what went wrong */
  crashed(msg: unknown): void {
    if (!this.buf) return;
    const now = performance.now(), text = String((msg as Error | undefined)?.message ?? msg).slice(0, 200);
    const saving = !this.crashing && this.crashes < CRASH_MAX && now - this.crashAt >= CRASH_GAP_MS && now - this.crashTry >= CRASH_TRY_MS;
    this.buf.pageError(text, saving);   // (a file saved FOR this error has its line at this moment, though the same words were filed half a minute of play ago)
    if (!saving) return;
    this.crashing = true; this.crashTry = now;
    void this.put(`error: ${text}`).then(r => { if (r.made) { this.crashAt = performance.now(); this.crashes++; } this.crashing = false; });   // (put never rejects)
  }
  /** the buffer as a file, as it stands (null: no buffer) */
  file(why = 'console'): ReplayFile | null {
    if (!this.buf) return null;
    let search = ''; try { search = location.search; } catch { /* */ }
    return this.buf.file(this.game, why, { commit: this.commit, url: search, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined, ...(this.keeper && !this.keeper.broke ? { session: this.session } : {}), ...this.meta() });
  }
  /** start keeping this visit's tape: a piece every KEEP.secs on a timer of the page's own (never inside a game step), in an idle moment where the browser has
   *  them, and what is left the moment the page is hidden or left. Nothing is filed until the game has been stepped in the player's hands (a title page running
   *  its reel keeps nothing). Old tapes past the budget are let go at boot, oldest and already handed over first. */
  private keep(): void {
    const buf = this.buf; if (!buf) return;
    try { if (new URLSearchParams(location.search).has('nokeep') || localStorage.getItem(LS_KEEP) === '0' || typeof indexedDB === 'undefined') return; } catch { return; }
    try {
      const store = keptStore(), game = this.game;
      const K = this.keeper = new ReplayKeeper(buf, { sid: this.session, store, played: () => this.played, say: s => this.say(s),
        head: () => { let search = ''; try { search = location.search; } catch { /* */ } return buf.head(game, { commit: this.commit, url: search, userAgent: navigator.userAgent, ...this.meta() }); } });
      setLiveKeeper(async () => { K.beat(); await K.idle(); });   // (packed like any beat's: the plain-text write is for a page that is going)
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      setInterval(() => { if (idle) idle(() => K.beat(), { timeout: 2000 }); else K.beat(); }, KEEP.secs * 1000);
      window.addEventListener('pagehide', () => { void K.leave(); });   // (and the visit is marked as left: keeper.ts leave)
      window.addEventListener('pageshow', e => { if (e.persisted) K.back(); });   // (the browser's back button brought this very page back: it is being played again)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void K.flush(); else K.back(); });   // (in front again: is its visit still there?)
      void keepBudget().then(max => pruneKept(store, max, this.session)).catch(() => {});
      try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* */ }
    } catch { this.keeper = null; }
  }
  /** there is a viewer page to open a replay in, and a buffer to make one from (false: the one-file build, ?noreplay or the stored switch) */
  get canView(): boolean { return !!this.buf && !onePage(); }
  /** save the last stretch and play it IN THIS WINDOW (the maintainer, 10-15: "replays should just play in the current window, not open a new tab"): Shift+F7's
   *  work, and the end card's Replay button (ui/menu.ts). The page goes once the shelf has the file, and stays where it is if none was shelved (save() never
   *  rejects: a save that fails says why and comes back null) or there is no viewer page (a plain save: the one-file build's is a download). One press, one
   *  leaving: a second inside the save's wait, or the first seconds of the going, does nothing. THE WAY BACK is the browser's own Back, and the replay bar's '‹ Game' (replay/engineplay.ts), which
   *  reads the mark left here (replay/format.ts leaveFor / backToGame): the address left, its slot in this window's history, the shelf entry it left for. The page left is LEFT (a mission the key leaves mid-way is over, as a
   *  reload's is; F7 alone saves and stays).
   *  THE CARD'S goes to the game page playing the run again (the maintainer, 10-15: "clicking on replay after a mission should start in engine") where the file
   *  has a tape to play (engineUrl), and to the map viewer as before where it has none; the key's is the map viewer's, as it was. */
  /** Shift+F7. IN A LIVE RUN the first press only says what the second costs — the replay plays in this window, so the run is left — and a second inside ARM_MS
   *  goes; with no run to lose (a card up, a show, a run over) one press goes, as the card's button does. */
  keyView(): void {
    const now = performance.now();
    if (this.canView && missionLive(this.game) && now > this.armed) { this.armed = now + ARM_MS; this.say('Shift+F7 again leaves this run for its replay. F7 alone saves and stays.'); return; }
    this.armed = 0; this.openViewer('key');
  }
  private armed = 0;
  openViewer(why: string): void {
    if (performance.now() < this.leaving) return; const can = this.canView; if (can) this.leaving = Infinity;   // (no viewer page, or no buffer to save from: nowhere to go)
    void this.save(why).then(id => {
      if (!can || id === null) { this.leaving = 0; return; }
      // (a leaving the visitor stopped, or a page the browser's Back hands back as it was left, takes the next press: the wait is short and ends on a show)
      this.leaving = performance.now() + LEAVE_MS; window.addEventListener('pageshow', () => { this.leaving = 0; }, { once: true });
      try { leaveFor((why === 'card' && this.last?.id === id ? engineUrl(id, this.last.file) : null) ?? viewerUrl(id), id); } catch { this.leaving = 0; }
    });
  }
  /** presses are not taken before this moment (performance.now's clock): a save is out, or the window is on its way */
  private leaving = 0;
  /** put the last stretch on the shelf; the shelf's id (null: nothing kept — and the message line says why) */
  async save(why = 'key'): Promise<number | null> { return (await this.put(why)).id; }
  /** save()'s work, saying also whether a file was MADE (shelved, or downloaded where the browser keeps no shelf: id null either way it was not shelved; on the one-file build an error's is made and kept in `last` for F7) */
  private async put(why: string): Promise<{ id: number | null; made: boolean }> {
    try { return await this.put1(why); }
    catch (e) { this.say(`Replay could not be saved: ${String((e as Error | undefined)?.message ?? e).slice(0, 160)}`, !why.startsWith('error')); return { id: null, made: false }; }   // (never quiet: a save that throws used to end in the key's own catch with nothing said)
  }
  private async put1(why: string): Promise<{ id: number | null; made: boolean }> {
    const none = { id: null, made: false }, err = why.startsWith('error'), one = onePage(), file = this.file(why);
    if (!file) { this.say(OFF, !err); return none; }
    // (a buffer that stopped itself, or was switched off from the console, still hands over what it holds, and EVERY line below that made a file says so: the tag shows one line, the last said)
    const B = this.buf!, why0 = String(B.broke).slice(0, 120);
    const stale = B.broke ? ` The replay buffer stopped itself earlier (${why0}): this is what it held.` : !B.on ? ' The replay buffer is switched off (__replay.on): this is what it held when it was.' : '';
    if (!file.samples.length) { this.say(B.broke ? `Replay buffer stopped itself before anything was played: ${why0}` : !B.on ? 'Replay buffer is switched off (__replay.on = true brings it back): nothing held' : 'Replay: nothing played yet', !err); return none; }
    // (the one-file build has no viewer page to open a shelf with: F7 hands the file itself over. An ERROR there downloads nothing by itself — a file nobody asked
    // for in a visitor's downloads — it says F7 will, and counts against the errors' budget so the line is not said again and again)
    if (one && err) { this.last = { id: null, file }; this.say(`The page hit an error: F7 downloads a replay of the last ${clock(file.seconds)}.${stale}`); return { id: null, made: true }; }
    const id = one ? null : await shelfPut(file); this.last = { id, file };   // (null: no shelf here, the browser refused it, or the shelf did not answer inside its own wait — nothing is written later)
    // (a file the KEY made that holds a page error says so, and where: the error's own line is in it at that moment)
    const E = err ? [] : errorMarks(file), held = E.length ? ` This replay holds the page's error, at ${clock(E[E.length - 1].r)}.` : '';
    if (id === null) { this.download(file); this.say(`${err ? 'The page hit an error: replay' : 'Replay'} of the last ${clock(file.seconds)} downloaded (${one ? 'this build has no viewer page: open the file in a build that has one, or drop it in a thread' : 'this browser would not keep it on the shelf'}).${held}${stale}`); return { id, made: true }; }
    this.say(`${err ? `The page hit an error: replay of the last ${clock(file.seconds)} saved. Shift+F7 leaves the game for the viewer.` : `Replay saved: the last ${clock(file.seconds)} of play. Shift+F7 leaves the game for the viewer.`}${held}${stale}`);
    return { id, made: true };
  }
  /** hand a file to the browser as a download (format.ts `downloadReplay`, the one way a replay file leaves a page: gzipped when it is large) */
  download(file: ReplayFile): void { void downloadReplay(file).catch(() => { /* headless */ }); }
  /** the console's hook (main.ts __replay) */
  hook() {
    const self = this;
    return {
      get on() { return !!self.buf && self.buf.on && !self.buf.broke; },
      set on(v: boolean) { try { localStorage.setItem(LS, v ? '1' : '0'); } catch { /* */ } if (self.buf) self.buf.on = !!v; },   // (a buffer the page booted without comes with the next load)
      knobs: REPLAY,
      save: (why = 'console') => self.save(why), file: (why = 'console') => self.file(why), download: () => { const f = self.file('console'); if (f) self.download(f); return f ? replayName(f) : null; },
      open: () => { void self.save('console').then(id => { if (id !== null) leaveFor(viewerUrl(id), id); }); },
      view: (why = 'console') => self.openViewer(why), get canView() { return self.canView; },
      summary: () => self.buf ? self.buf.summary() : 'replay buffer off (?noreplay or the stored switch)',
      get last() { return self.last; },
      // every run kept, and the hand-over (replay/keeper.ts, replay/dumpui.ts)
      get keeping() { return !!self.keeper && !self.keeper.broke; },
      set keeping(v: boolean) { try { localStorage.setItem(LS_KEEP, v ? '1' : '0'); } catch { /* */ } },   // (from the next page load)
      keep: KEEP, session: self.session,
      get keeper() { return self.keeper; }, get buf() { return self.buf; },
      kept: async () => { await self.keeper?.flush(); const S = await keptSummary(keptStore()); return { words: keptWords(S), keeper: self.keeper?.summary() ?? 'not keeping (?nokeep, the stored switch, or no buffer)', stats: self.keeper?.stats ?? null, ...S }; },
      dump: (all = false) => dumpNow({ all }, s => self.say(s)),
    };
  }
}
/** this page is all there is: the one-file build (tools/build-one.ts marks its page; ui/menu.ts lists no tool page there) ships no replay.html */
const onePage = (): boolean => { try { return !!document.querySelector?.('meta[name="tps-one-page"]'); } catch { return false; } };
const LEAVE_MS = 8000, ARM_MS = 6000;
/** the viewer page beside this one, on a shelf entry */
export function viewerUrl(id: number): string { return new URL(`replay.html#id=${id}`, document.baseURI).href; }
/** the game page playing a shelf entry's run tape (replay/engineplay.ts `?playtape=<shelf id>`; the map viewer's 'Play in engine' is the same page), from where the
 *  run the file ENDS in began (`&at=<step>`: the tries before it are run through unseen first; one try = from the top). That moment is read off BOTH halves of the
 *  file: the trace's last restart mark (format.ts lastRun, the map viewer's own rule for a card's file — the step of the first sample from it on), which also has
 *  a restart made INSIDE a step (Shift+Enter, Enter once down: on no tape row), and the tape's last restart row (one older than the trace's window), the step
 *  after it so the still it opens on is the new try's. null: no tape to play (ended early: a checkpoint loaded, a scenario started from a menu, past the tape's
 *  length) — the map viewer plays that file */
/** the address words a replay page keeps from the VISIT, not from the run it plays (replay/engineplay.ts tapeSearch): how the page is looked at and listened to is the
 *  viewer's — which sound table the mixer plays is the listener's, a replay holds no sound. The end card's Replay hands the game page's own on to its tab, bar the
 *  harness's `paused`: the replay of a run played at a chosen quality, or muted, opens the same way. */
export const VISIT_FLAGS = ['paused', 'mute', 'quality', 'hud', 'oldsounds', 'newsounds', 'onetheme', 'shuffle', 'teamnerves', 'soundlanes', 'fogedge', 'fogdesat', 'fogair', 'fogkept', 'nobouncewalls', 'noreflwalls', 'savepic', 'findtuned'];   // (nobouncewalls: the picture's walled bounce read off — render/frame.ts bounceWallsConfig — so a page tool can play one replay both ways)
export function engineUrl(id: number, file: ReplayFile): string | null {
  const T = file.rerun; if (!T || 'dead' in T) return null;
  const r0 = lastRun(file), seen = r0 > 0 ? file.samples.find(s => s.r >= r0)?.n ?? 0 : 0;
  const taped = T.x.reduce((a, row) => row[1] === 'restart' && row[0] > 0 && row[0] + 1 > a ? row[0] + 1 : a, 0);
  const at = Math.min(T.ticks, Math.max(seen, taped));
  const now = new URLSearchParams(location.search), visit = VISIT_FLAGS.filter(k => k !== 'paused' && now.has(k)).map(k => `&${k}=${encodeURIComponent(now.get(k) ?? '')}`).join('');
  return new URL(`index.html?playtape=${id}${at > 0 ? `&at=${at}` : ''}${visit}`, document.baseURI).href;
}
/** a name for this page visit: when it began, and enough dice that two tabs opened in one second differ */
function sessionId(): string {
  let r = ''; try { const a = new Uint32Array(1); crypto.getRandomValues(a); r = a[0].toString(36); } catch { r = Math.floor(Math.random() * 0xffffffff).toString(36); }
  return `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${r}`;
}
