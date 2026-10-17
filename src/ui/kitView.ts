// THE TEAM AT THE DOOR, on the start page's Team & kit step (the maintainer's pick, 10-13): where the standing man was (ui/kitFigure.ts), the REAL renderer's
// top-down picture of the team as picked, stood at the mission's own way-in door. The Game behind the start page is not the picked mission's level — that
// exists only after Deploy's page load — so the picture is a SECOND instance of the page in an iframe: the same origin, the very query Deploy would load plus
// `&kitview&mute&noreplay` (src/host/kitView.ts: staged, lit, and from then on LIVE — the game runs and the open card's man uses what he carries at the door,
// a beat at a time; `&stillkit` on it = drawn for a warm window, then held; read-only on this origin's storage). It is thrown away when the page closes or
// Deploy fires, so its GPU device goes with it.
//
// WHEN: the switch on (KIT_VIEW.on; `?oldfigure` = off), the Team & kit step, a room clear whose level file says where the team stands for the way in picked
// (`scenarios.kitView.ways` — ui/missions.ts kitViewWays, the plan's own fetch), and a window the figure's column is drawn in (over 720 px wide). Anything
// else is the standing man exactly as before: this module then makes no element and puts no class on the page.
//
// WHAT GOES OVER: ONE iframe ELEMENT PER QUERY — when the mission's own query changes (its level, way in, hour, weather … — everything but the team's size) the
// old element is dropped and a new one made (no entry in the tab's history, and a message is from THIS element's window or it is nobody's). A kit tile or the
// team's size is a message, `{ kv: 'kit', members, squad }`, sent AT ONCE (the owner, 10-14: "after selecting something, it should start the demo animation
// immediately" — the leading edge; further changes inside KIT_VIEW.kitMs of it are folded into one more message when it has run out). The child works out
// for itself what moved: what the game can take is written on the live men, the rest is a restage under the child's own dissolve; whose card is open and
// which tile the highlight is on, `{ kv: 'sel', who, field }`, on every move of either (the child's director plays that man, and that tile's thing NOW); off the step, `{ kv: 'pause', on }`
// (the child neither steps nor draws until the step shows again); where the men should sit,
// `{ kv: 'frame', cx, cy, h, w, man }`, from the figure column's rectangle (the child frames the way's FIVE places by it, whatever the team's size). The child says `boot` (its listener is up: it is told the frame and, if the tiles
// moved since its query, the kit, the open card and the pause — again on every boot, so a child that loads itself again is told again), `ready` (the picture is fit to show), `held`,
// or `none` (nothing to stage there). The iframe is NEVER faded out once shown (the owner, 10-14: "i don't like the fade to black animations"): a child of
// an older build that still says `dip` / `undip` is heard and nothing is done. THE SWITCH for all of the acting is KIT_VIEW.acts (`?stillkit` = off: the
// child is opened `&stillkit` — the still picture, a plain restage on every change, no `sel`).
//
// THE STANDING MAN STAYS until the child's first `ready`: show() answers false until then, and for good — the element dropped, the query marked for this
// page's life — when the child says `none`, its load errors, or no `ready` comes within KIT_VIEW.wait seconds (a refused device, a failed fetch, a fatal
// card nobody can see in there). The second game lives only while it can show: it is dropped too when the mission picked has no block, the way in is dealt
// (the child's die would deal another door than Deploy's: the query carries no seed), or the window goes under 720 px; it is kept across the Mission step.
//
// LAYOUT: every rule is in the one block below; ONE root class, `kv-on`, is on #missions only while the picture is shown (the iframe's own rules stand
// without it: it must be laid out, though unseen, for its page to draw at all). The iframe is the LAST child of `.mbody`, absolutely placed behind the sheet
// and anchored left, KIT_VIEW_PLACE.wide columns wide; the figure's column is the clear window onto it — the men in its left two thirds, the door's line about six tenths across, the first metre of the room behind the door in the rest; past the
// column it fades out under the tiles by the mask alone (the card's own ground shows: a third of its strength at the first tile's left edge, gone one
// column's width on; no rule of a tile is touched) and runs on further right below them. It never takes a click or the keys. No
// words, no colours of its own.
import { KIT, kitRows } from '../game/kit';
import { kitViewWays } from './missions';
import { kitViewQuietKind } from '../host/kitViewSet';   // (pure: the mission's kind, read off its link — the quiet picture's)

/** the switch (UI only: nothing in the game reads it) · the picture is LIVE and the open card's man acts in it (`?stillkit` = off: the still picture, every change a plain restage) · seconds a child is given to say `ready` (`?kitwait=N`: a slow adapter's) · ms after a kit message in which further changes are folded into ONE more */
export const KIT_VIEW = { on: true, acts: true, wait: 10, kitMs: 150, grace: 2.5, quiet: true };   // (grace: seconds the column stays EMPTY while the picture boots — the standing man stands in only for a child slower than this, never for a moment before the picture: `?kitgrace=N`)
try { const q = new URLSearchParams(location.search); if (q.has('oldfigure')) KIT_VIEW.on = false; if (q.has('stillkit')) KIT_VIEW.acts = false; if (q.has('kitloud')) KIT_VIEW.quiet = false; const g = Number(q.get('kitgrace')); if (q.has('kitgrace') && g >= 0) KIT_VIEW.grace = g; const w = Number(q.get('kitwait')); if (w > 0) KIT_VIEW.wait = w; } catch { /* no page (the harness) */ }
/** where things sit, in the figure column's own widths and heights (the page's 330 px column: the picture is hung on the DOOR — its line about six tenths
 *  of the way across, the first metre of the room behind it clear to the column's right edge, where a can thrown through the door comes to rest — and the
 *  five places left of it with 16 px of margin) */
const KIT_VIEW_PLACE = {
  /** the iframe's width · the five places' middle from the column's left edge · the width they may take (feet, heads and reach): a child told no door */
  wide: 2.75, cx: 0.62, w: 0.88,
  /** the DOOR's line (its middle, a metre up) from the column's left edge · the margin kept clear left and right of the five places' reach · the men no
   *  smaller for the door than this share of the size they had framed on their own middle (`cx`, `w`): past it the places keep their margin and the door sits further right */
  door: 0.62, left: 0.05, right: 0.03, keep: 0.85,
  /** their middle down the column · the height they may take · a standing man's height at most */
  cy: 0.55, h: 0.76, man: 0.19,
  /** from the column's right edge: the picture whole up to here (the edge itself: the room behind the door is in the column's last third) · three tenths
   *  of it here (the first tile's left edge — or at that edge itself if it is nearer: no tile has more of the picture under it than it had) · gone here (on the tile rows) */
  fade0: 0, fadeA: 0.07, fade1: 1,
  /** THE QUIET PICTURE (a quiet kind's link, `KIT_VIEW.quiet` on — `?kitloud` = off, the same word that puts the picture itself back: host/kitView.ts
   *  KIT_VIEW_QUIET): a dark stage shows through the gaps between the tiles and under the empty lower panel as noise, so there the picture is GONE from
   *  this share of the WINDOW's width on (never left of two points past the three-tenths stop: the clear column and the stops before it are as they
   *  are; never right of where it ends on a loud kind), and the pool of picture under the last row of tiles is not laid at all */
  quietEnd: 0.4,
};

const ROOT_CLASS = 'kv-on';
const FADE = 'linear-gradient(to right, #000 0, #000 var(--kv-clear, 35%), rgba(0,0,0,0.3) var(--kv-a, 39%), rgba(0,0,0,0.11) calc(var(--kv-a, 39%) * 0.55 + var(--kv-end, 73%) * 0.45), rgba(0,0,0,0.035) calc(var(--kv-a, 39%) * 0.15 + var(--kv-end, 73%) * 0.85), transparent var(--kv-end, 73%)), radial-gradient(ellipse 100% var(--kv-low, 40%) at 0 100%, #000 0, #000 var(--kv-core, 35%), transparent 100%)';
const FADE_QUIET = FADE.slice(0, FADE.indexOf(', radial-gradient('));   // (the fade across alone: no pool of picture under the tiles)
const CSS = `
#missions .mbody:has(> iframe.kv) { position: relative; }
#missions .mbody > iframe.kv { display: block; position: absolute; left: 0; top: 0; z-index: 0; width: var(--kv-w, min(100%, 56vw)); max-width: 100%; height: 100%; border: 0; pointer-events: none; background: var(--m-base); opacity: 0; transition: opacity 0.6s ease;
  -webkit-mask-image: ${FADE}; mask-image: ${FADE}; }
#missions.kv-quiet .mbody > iframe.kv { -webkit-mask-image: ${FADE_QUIET}; mask-image: ${FADE_QUIET}; }
#missions.kv-on .mbody > iframe.kv { opacity: 1; }
#missions.kv-on .mbody > .onefig, #missions.kv-on .mbody > .msheet { position: relative; z-index: 1; }
#missions.kv-on .mbody > .onefig { border-right-color: transparent; }
#missions.kv-on .mbody > .onefig canvas { display: none; }
`;
function styles() { if (document.getElementById?.('kitview-css')) return; const s = document.createElement('style'); s.id = 'kitview-css'; s.textContent = CSS; (document.head ?? document.body)?.appendChild?.(s); }

/** what the page asks to be shown: the loadout's own query (what Deploy would load), the mission's kind and level file, the way in as the PAGE has it
 *  (ui/missions.ts MissionsScreen.way: 0 = the level's own, N = the Nth, −1 = dealt), the team's size */
export interface KitViewAsk { search: string; kind: string; level?: string; way: number; squad: number;
  /** whose card is open (0 = you) and the row its highlight is on (ui/kitCard.ts MemberCard.at: past the last row = the sets) — absent: you, no tile */
  member?: number; row?: number }
export interface KitViewFrame {
  /** show the picture for `ask` (null: off the step — put away, the instance kept). True = it is what the column shows, or will in a moment (the column waits empty: KIT_VIEW.grace); false = the standing man's turn */
  show(ask: KitViewAsk | null): boolean;
  /** the instance gone for good (the page closed, Deploy fired) */
  close(): void;
  readonly frame: HTMLIFrameElement | null;
}

/** the query with the team's size off it: what an iframe stands for (the size goes over as a message) */
function keyOf(q: URLSearchParams): string { const k = new URLSearchParams(q); k.delete('squad'); k.delete('squad4'); return k.toString(); }

/** `root` = #missions, `body` = its .mbody (the iframe's parent), `column` = the figure's column (.onefig); `again` = paint the figure again (an answer came) */
export function mountKitView(root: HTMLElement, body: HTMLElement, column: HTMLElement, again: () => void): KitViewFrame {
  let frame: HTMLIFrameElement | null = null, key = '', live = false, shown = false, was = false, up = false, born = '';   // (up: the child's listener is — a message before its `boot` is lost; born: the kit its query stood for)
  let sent = '', want = '', due: ReturnType<typeof setTimeout> | 0 = 0, patience: ReturnType<typeof setTimeout> | 0 = 0, squadNow = 0;
  let sel = '', selSent = '', paused = false, pauseSent = false, bornT = 0, graceT: ReturnType<typeof setTimeout> | 0 = 0;   // (bornT / graceT: when this element was made, and the paint owed when its grace runs out)   // (the open card and tile as asked / as the child has them · off the step, as asked / as told)
  const ways = new Map<string, boolean[] | null>();   // per level file: the ways with a picture (null: asked, not yet answered)
  const failed = new Set<string>();                   // the queries whose instance had nothing to stage, or never came up: the standing man for this page's life
  const narrow = () => { try { return window.matchMedia('(max-width: 720px)').matches; } catch { return false; } };
  // a page opened from disk has no origin to name: a message goes anywhere and arrives as 'null' (host/kitView.ts kitViewOnDisk, the child's half)
  const onDisk = () => location.protocol === 'file:' || location.origin === 'null', postTo = () => (onDisk() ? '*' : location.origin);
  const from = (origin: string) => origin === location.origin || (onDisk() && origin === 'null');
  const tell = (m: object) => { try { frame?.contentWindow?.postMessage(m, postTo()); } catch { /* */ } };
  const kitNow = (squad: number) => JSON.stringify({ members: KIT.members, squad });
  /** the kit and the size, when they are not what the instance last had */
  const kit = () => { want = ''; if (!frame || !up) return; const now = kitNow(squadNow); if (now === sent) return; sent = now; tell({ kv: 'kit', members: KIT.members, squad: squadNow }); };
  /** whose card is open and the tile under the highlight · off the step or on it — each told when it is not what the child last had */
  const says = () => { if (!frame || !up) return;
    if (KIT_VIEW.acts && sel && sel !== selSent) { selSent = sel; tell({ kv: 'sel', ...JSON.parse(sel) as object }); }
    if (paused !== pauseSent) { pauseSent = paused; tell({ kv: 'pause', on: paused }); } };
  let quietAsk = false;   // the picture asked for is a quiet kind's, the switch on: its fade (KIT_VIEW_PLACE.quietEnd)
  /** the iframe's size and fade, and where the men should sit, all off the column's rectangle */
  const place = () => {
    if (!frame) return;
    const P = KIT_VIEW_PLACE, c = column.getBoundingClientRect(); if (!(c.width > 0 && c.height > 0)) return;
    root.style.setProperty('--kv-w', `${Math.round(c.width * P.wide)}px`);
    const f = frame.getBoundingClientRect(); if (!(f.width > 0 && f.height > 0)) return;
    const share = (x: number) => Math.min(100, Math.max(5, (x - f.left) / f.width * 100)), pct = (x: number) => `${Math.round(share(x))}%`;
    const tiles = body.querySelector?.('#loadout .lo-kit')?.getBoundingClientRect?.(), low = tiles && tiles.height > 0 ? (f.bottom - tiles.bottom) / f.height : 0.4;   // the room under the last row of tiles
    const a = Math.min(Math.round(share(c.right + c.width * P.fadeA)), tiles && tiles.width > 0 && tiles.left > c.right ? share(tiles.left) : 100), clear = Math.min(share(c.right + c.width * P.fade0), a - 1);   // (the whole percent as before, or the tiles' own left edge if that is nearer)
    root.style.setProperty('--kv-clear', `${clear.toFixed(2)}%`); root.style.setProperty('--kv-a', `${+a.toFixed(2)}%`); root.style.setProperty('--kv-end', pct(c.right + c.width * P.fade1));
    root.classList.toggle('kv-quiet', quietAsk);
    if (quietAsk) root.style.setProperty('--kv-end', `${Math.round(Math.min(share(c.right + c.width * P.fade1), Math.max(a + 2, share(window.innerWidth * P.quietEnd))))}%`);   // (the quiet picture: gone from four tenths of the window on)
    root.style.setProperty('--kv-core', pct(c.right - c.width * 0.03));   // (…and the pool of picture under the last row of tiles as it was)
    root.style.setProperty('--kv-low', `${Math.round(Math.min(60, Math.max(12, low * 100)))}%`);
    const nx = (x: number) => ((x - f.left) / f.width) * 2 - 1;
    tell({ kv: 'frame', cx: nx(c.left + c.width * P.cx), cy: 1 - ((c.top + c.height * P.cy - f.top) / f.height) * 2, h: Math.min(0.9, c.height * P.h / f.height), w: Math.min(0.9, c.width * P.w / f.width), man: Math.min(0.9, c.height * P.man / f.height),
      door: nx(c.left + c.width * P.door), left: nx(c.left + c.width * P.left), right: nx(c.right - c.width * P.right), keep: P.keep });
  };
  const hide = () => { if (shown) { shown = false; root.classList.remove(ROOT_CLASS); } };
  const drop = () => { if (due) clearTimeout(due); if (patience) clearTimeout(patience); if (graceT) clearTimeout(graceT); due = patience = graceT = 0; want = ''; if (!frame) return; frame.remove(); frame = null; key = ''; live = false; up = false; sent = born = ''; selSent = ''; pauseSent = false; };
  /** this query's instance is no picture: gone, and not tried again on this page */
  const fail = (k: string) => { if (!k || k !== key) return; failed.add(k); hide(); drop(); again(); };
  const onMsg = (e: MessageEvent) => {
    if (!frame || !from(e.origin) || e.source !== frame.contentWindow) return;   // (this element's own window: a document on its way out with another element is nobody)
    const kv = (e.data as { kv?: unknown } | null)?.kv;
    if (kv === 'none') { fail(key); return; }
    if (kv === 'boot') { up = true; sent = born; selSent = ''; pauseSent = false; place(); if (kitNow(squadNow) !== sent) kit(); says(); return; }   // (its listener is up — on every load of its page: the frame, the kit where the tiles moved since its query, the open card, the pause)
    if (kv === 'dip' || kv === 'undip') return;   // (an older child's: the picture is never faded out — its restage is its own dissolve now)
    if (kv !== 'ready' && kv !== 'held') return;
    if (patience) { clearTimeout(patience); patience = 0; }
    if (!live) { live = true; again(); }
  };
  window.addEventListener('message', onMsg);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { place(); const n = narrow(); if (n !== was) { was = n; again(); } }) : null;   // (across the 720 px line while shown: the paint decides again)
  ro?.observe(column); ro?.observe(body);

  return {
    get frame() { return frame; },
    show(ask) {
      root.removeAttribute('data-kv-wait');   // (set below while the column waits empty for a picture: what a check — or a rule — can see of it)
      if (!ask) { hide(); paused = true; says(); return false; }   // (off the step: the second game rests — it neither steps nor draws until the step shows again)
      was = narrow();
      // (ANY KIND of mission whose level file has a block: the child stages the kind's own team at the way — or, on a bespoke set, a room clear of the set — and says
      //  'none' where that kind has no team at a way in, which is no picture and not tried again)
      if (!KIT_VIEW.on || was) { hide(); drop(); return false; }
      // (a mission with NO level file is on the bundled office: its block is the office's own data — levels/office.scenarios.ts, through ui/missions.ts — and the
      //  child is asked with the mission's own query, no `levelFile` in it: main.ts builds the office and stages from that same block)
      const lv = ask.level ?? '', q = new URLSearchParams(ask.search.replace(/^[^?]*\?/, '')), k = keyOf(q), W = ways.get(lv);
      quietAsk = KIT_VIEW.quiet && !q.has('kitloud') && kitViewQuietKind(q) !== null;
      if (W === undefined) { ways.set(lv, null); void kitViewWays(ask.level).then(w => w, () => [] as boolean[]).then(w => { ways.set(lv, w); again(); }); }
      if (W == null) { hide(); drop(); root.setAttribute('data-kv-wait', ''); return true; }   // (asked, not yet answered — the plan's own fetch, a moment: the column waits empty rather than flash the standing man before a picture)
      // the way in as the page's own row has it; one past the level's ways is the game's to fold (any of them must then have a picture); a dealt one is no picture
      const way = ask.way < 0 ? -1 : ask.way ? ask.way - 1 : 0;
      if (!W || failed.has(k) || way < 0 || !(way < W.length ? W[way] : W.length > 0 && W.every(Boolean))) { hide(); drop(); return false; }
      squadNow = ask.squad; paused = false;
      { const who = ask.member ?? 0; sel = JSON.stringify({ who, field: kitRows(who)[ask.row ?? -1]?.field ?? null }); }
      if (!frame || k !== key) {   // another mission, way in, hour …: a new element, on exactly what Deploy would load
        hide(); drop(); styles();
        const f = frame = document.createElement('iframe'); f.className = 'kv'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
        key = k; sent = born = kitNow(ask.squad);
        const tier = (window as unknown as { __quality?: { current?: unknown } }).__quality?.current;   // (drawn at the tier this page stands at: no calibration of its own beside this one)
        const raw = ask.search.replace(/^[^?]*\?/, '');
        f.addEventListener('error', () => { if (frame === f) fail(k); });
        f.src = `${location.pathname}?${raw ? raw + '&' : ''}kitview&mute&noreplay${KIT_VIEW.acts ? '' : '&stillkit'}${KIT_VIEW.quiet || q.has('kitloud') ? '' : '&kitloud'}${typeof tier === 'string' && !q.has('quality') ? '&quality=' + encodeURIComponent(tier) : ''}`;
        body.appendChild(f); place();
        patience = setTimeout(() => { patience = 0; if (frame === f && !live) fail(k); }, KIT_VIEW.wait * 1000);
        bornT = performance.now(); graceT = setTimeout(() => { graceT = 0; if (frame === f && !live) again(); }, KIT_VIEW.grace * 1000 + 30);
      } else { const now = kitNow(ask.squad);   // (the LEADING edge: the first change goes now; what follows inside kitMs is one more message at its end)
        if (now !== sent && now !== want) { if (due) want = now; else { kit(); due = setTimeout(() => { due = 0; if (want) kit(); }, KIT_VIEW.kitMs); } } }
      says();
      if (!live) { hide(); const wait = performance.now() - bornT < KIT_VIEW.grace * 1000; if (wait) root.setAttribute('data-kv-wait', ''); return wait; }   // (booting: the column stays empty for the grace — true, the standing man is not drawn — and he stands in after it until the picture says `ready`)
      if (!shown) { shown = true; root.classList.add(ROOT_CLASS); place(); }
      return true;
    },
    close() { hide(); drop(); ro?.disconnect(); window.removeEventListener('message', onMsg); },
  };
}
