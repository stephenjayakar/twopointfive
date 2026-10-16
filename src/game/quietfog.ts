// QUIET MISSIONS UNDER THE FOG OF WAR — the fog lever's own rungs on a quiet mission's row, 'off' (every guard shown) the bottom one.
//
// The maintainer, 10-11: "stealth missions don't have fog of war" · "i think we should make it part of the fog of war difficulty slider" · "will need to
// playtest a bunch". A quiet mission (alone, or as two) never ran under the fog: scenarioRun.ts fogOfQuery raised it for a room clear and a rescue only, and
// the mission sheet greyed the fog lever on a quiet row. Now the lever is live there and has one more rung at the bottom, OFF — every guard shown,
// the quiet missions as they were, and where they all started until 10-13 (WHERE A QUIET MISSION STARTS, below) — and the three rungs above it are the squad lever's own (difficulty.ts FogRung): all round, cones, own
// eyes. Moved up, that quiet mission's link carries `quietfog=<rung>` and the mission is played under the fog at that rung.
//
// ITS OWN PICK, NOT THE SQUAD LEVER'S: what this machine keeps for the squad missions (difficulty.ts SET.fog — 'own eyes', say) is not put on a quiet mission
// by itself, and the quiet pick is not put on a squad mission. Kept per machine under its own key; one pick for every quiet mission. A Training lesson is
// taught on the level as it is: no rung there.
//
// WHAT THE RUNG WRITES: nothing of the fog's own files. At the mission's start the rung is laid on the fog's two rows for the visit (FOG.cone through
// difficulty.ts setConeVisit, FOG.own directly) and let go of when the scenario is quit; `?fogcone` / `?fogown` on the same URL speak over it, as they speak
// over the squad lever. The fog's eyes are the ones it always had: the player, and a partner where there is one.
//
// THE SWITCH: `QUIETFOG.on` — ON in the page (`?quietfog=0` = the lever greyed on a quiet row and no rung read, as it was), OFF in the module and on the
// frozen harness stand (`TPS_QUIETFOG=1`). Off, or the rung 'off', is the build as it was: every guard shown, nothing of the fog's written.
//
// WHERE A QUIET MISSION STARTS (`QUIETFOG.def`; the maintainer's pick, 10-13: "i think it should be fog + teammate (maybe they have some way to see each
// other's headset camera, like the sticky cams) + we find a way to balance sticky cams"): the rung a quiet mission is played on when this machine keeps no
// pick and its link names none. 'team' in the page — the fog, lifted round you and round your partner, with the mission's sticky cameras handed out
// (`?quietdef=off` = every quiet mission starts with all guards shown, as before the pick) — 'off' in the module and on the frozen stand
// (`TPS_QUIETDEF=team`). A LINK SAYS ONLY WHAT DIFFERS FROM THE DEFAULT: at 'team' a bare quiet link is the fog with cameras, `quietfog=off` is all shown,
// `cams=0` the fog with none; at 'off' the links are the ones this file always wrote. The store likewise keeps a pick only where it differs. A Training
// lesson is on 'off' whatever the default. A recording from before the key replays with 'off' (journal.ts).
import { setConeVisit, coneVisitNow } from './difficulty';
import type { FogRung } from './difficulty';
import { FOG } from './fogofwar';
import { STICKY, stickyVisit } from './stickycam';   // (read inside functions only)
import type { Game } from './game';

export const QUIETFOG: { on: boolean; def: QuietRung; wand: boolean } = { on: false, def: 'off', wand: false };
/** THE MISSION'S OWN WAND (`QUIETFOG.wand`; OFF here and on the frozen stand, ON in the page — ?quietwand=0): a quiet mission that hands out its cameras (started
 *  under the fog, not the fog alone, not a lesson: stickyVisit, set where the mission starts and let go of where it ends) hands Sam an optical wand as well,
 *  whatever his card carries — kit.ts kitPlayer reads this beside the wand's own switch. Measured 10-16 (tools/qa/sticky-cover.ts --all-quiet): the look
 *  under a door is what takes the most first meetings at close range off a walk under the fog. No state of its own: the cameras' visit is the mission's. */
export const quietWand = (g: Game): boolean => QUIETFOG.wand && stickyVisit(g) > 0;
export type QuietRung = 'off' | FogRung;
/** the rungs of the lever on a quiet mission's row, from the bottom up: the words beside each say what it does THERE (a man alone, or with one partner) */
export const QUIET_RUNGS: { id: QuietRung; label: string; words: string }[] = [
  { id: 'off', label: 'off', words: 'no fog of war: the whole floor and every guard on it is drawn' },
  { id: 'team', label: 'all round', words: 'you see all round you, and round your partner where you have one: the rest of the floor is drawn as you last saw it' },
  { id: 'cones', label: 'cones', words: 'you see only the cone you look down, and your partner\'s where you have one: the floor behind your back is dark' },
  { id: 'own', label: 'own eyes', words: 'only the cone you look down yourself lifts the fog: what a partner sees he calls to you' },
];
const isRung = (v: unknown): v is QuietRung => typeof v === 'string' && QUIET_RUNGS.some(r => r.id === v);
/** the line beside the lever for a rung ('' = none) */
export const quietFogWords = (rung: string | null): string => QUIET_RUNGS.find(r => r.id === rung)?.words ?? '';

const LS = 'twopointsix.quietfog', PARAM = 'quietfog';
let PICK: QuietRung | null = null;   // (null: not read from this machine's store yet)
let PICK_DEF: QuietRung = 'off';   // (the default PICK was read under: a default moved since — the page's boot, a check — is read again)
/** where a quiet mission starts with nothing kept and nothing on its link (never anything but a rung) */
export const quietFogDefault = (): QuietRung => (isRung(QUIETFOG.def) ? QUIETFOG.def : 'off');
/** the rung this machine keeps for its quiet missions (the default with nothing kept; 'off' always with the switch off) */
export function quietFog(): QuietRung {
  if (!QUIETFOG.on) return 'off';
  const def = quietFogDefault();
  if (PICK === null || (PICK_DEF !== def && !KEPT)) { PICK = def; PICK_DEF = def; KEPT = false; try { const v = globalThis.localStorage?.getItem(LS); if (isRung(v)) { PICK = v; KEPT = true; } } catch { /* no store */ } }
  return PICK;
}
let KEPT = false;   // (PICK is a pick somebody made — read from the store or pressed — not the default standing in)
/** …AND WITH CAMERAS (stickycam.ts; the maintainer, 10-12: "maybe a limited number of sticky cameras or something like that would work"): beside the rungs on a
 *  quiet row, one more button — the mission hands you STICKY.issue sticky cameras for the launcher, over whatever your card carries. Only ever with a rung
 *  of the fog up (a camera is one more eye for the fog: with no fog it shows nothing new): pressed on 'off' it moves the lever to 'all round', and the lever
 *  put back to 'off' lets it go. Kept per machine like the rung; on the link as `cams=N`. */
const LS_CAMS = 'twopointsix.quietcams', PARAM_CAMS = 'cams';
let CAMS: boolean | null = null;   // (null: no pick made or kept — the default's)
let CAMS_READ = false;
/** the cameras come with the fog unasked where a quiet mission STARTS under the fog (QUIETFOG.def); where it starts with all shown they are a button to press */
export const quietCamsDefault = (): boolean => quietFogDefault() !== 'off';
export function quietCams(): boolean {
  if (!QUIETFOG.on || !STICKY.on) return false;
  if (!CAMS_READ) { CAMS_READ = true; try { const v = globalThis.localStorage?.getItem(LS_CAMS); if (v === '1') CAMS = true; else if (v === '0') CAMS = false; } catch { /* no store */ } }
  return (CAMS ?? quietCamsDefault()) && quietFog() !== 'off';
}
export function setQuietCams(on: boolean, keep = true) {
  CAMS = on; CAMS_READ = true;
  if (keep) try { const ls = globalThis.localStorage; if (on !== quietCamsDefault()) ls?.setItem(LS_CAMS, on ? '1' : '0'); else if (on || ls?.getItem(LS_CAMS) !== '0') ls?.removeItem(LS_CAMS); } catch { /* no store */ }   // (the default's own stores nothing — but a 'None' kept where the cameras come with the fog is not taken by a None pressed where they are a button)
  if (on && quietFog() === 'off') setQuietFog(quietCamsDefault() ? quietFogDefault() : 'team', keep);
}
/** the cameras a quiet mission's query asks to be handed (0: not a quiet mission, a lesson, no fog, either switch off — and none named where the cameras
 *  are a button to press; where they come with the fog, none named is STICKY.issue and `cams=0` is none) */
export function quietCamsOfQuery(q: URLSearchParams, lesson = false): number {
  if (!QUIETFOG.on || !STICKY.on || lesson || !q.has('quiet')) return 0;
  if (quietFogOfQuery(q, lesson) === 'off') return 0;   // (only ever with a rung up: with no fog a camera shows nothing)
  if (!q.has(PARAM_CAMS)) return quietCamsDefault() ? STICKY.issue : 0;
  const n = Number(q.get(PARAM_CAMS)); return Number.isFinite(n) ? Math.max(0, Math.min(STICKY.carry, Math.floor(n))) : 0;
}
/** move the lever on a quiet row. `keep` (the screens) stores it on this machine (the default's own rung stores nothing: a fresh machine and one put back are the same) */
export function setQuietFog(rung: QuietRung, keep = true) {
  if (!isRung(rung)) return;
  const def = quietFogDefault();
  PICK = rung; PICK_DEF = def; KEPT = rung !== def;
  if (keep) try { if (rung === def) globalThis.localStorage?.removeItem(LS); else globalThis.localStorage?.setItem(LS, rung); } catch { /* no store */ }
  if (rung === 'off' && !quietCamsDefault()) {   // (no fog, nothing for a camera to show: where the cameras are a button, the kept press goes too, read or not; a 'None' kept where they come with the fog stays — here too — for when that default and the fog are back)
    let none = false; try { none = globalThis.localStorage?.getItem(LS_CAMS) === '0'; } catch { /* no store */ }
    CAMS = none ? false : null; CAMS_READ = true; if (keep && !none) try { globalThis.localStorage?.removeItem(LS_CAMS); } catch { /* no store */ }
  }
}
/** the pick forgotten, to be read from the store again (the checks; a page never needs it) */
export function quietFogForget() { PICK = null; KEPT = false; CAMS = null; CAMS_READ = false; }

/** a mission's row is one the lever is live on: a quiet mission that is not a Training lesson, while the rule is on */
export const quietFogRow = (e: { kind: string; group?: string } | null | undefined): boolean => QUIETFOG.on && !!e && e.kind === 'quiet' && e.group !== 'training';
/** A mission link with the quiet pick put right on it: whatever rung it carried is dropped (the visitor's own flags ride on every link — a rung is one
 *  mission's), and `quiet` — the link is a quiet mission's, not a Training lesson's — puts this machine's pick on it where that is not the default's
 *  (QUIETFOG.def: a bare quiet link IS the default). The switch's own `quietfog=0` is left where it is; with the switch off the link is returned as it came. */
export function quietFogHref(href: string, quiet: boolean): string {
  if (!QUIETFOG.on) return href;
  const [path, query = ''] = href.split('?'), all = query.split('&').filter(k => k);
  const keys = all.filter(k => { const [n, v] = k.split('='); return n !== PARAM_CAMS && (n !== PARAM || v === '0'); });   // (`cams`: the cameras handed with the rung — one mission's, like it)
  const kept = keys.length;
  if (quiet) {
    const rung = quietFog(), cams = quietCams();
    if (rung !== quietFogDefault()) keys.push(`${PARAM}=${rung}`);
    if (rung !== 'off' && STICKY.on && cams !== quietCamsDefault()) keys.push(`${PARAM_CAMS}=${cams ? STICKY.issue : 0}`);
  }
  if (keys.length === kept && kept === all.length) return href;
  return keys.length ? `${path}?${keys.join('&')}` : path;
}
/** the rung a query asks its quiet mission to be played under (none named: the default's; 'off': not a quiet mission, a lesson, or the switch off) */
export function quietFogOfQuery(q: URLSearchParams, lesson = false): QuietRung {
  if (!QUIETFOG.on || lesson || !q.has('quiet')) return 'off';
  const v = q.get(PARAM); return isRung(v) ? v : quietFogDefault();
}

/** what the rung laid on the fog's rows at the start, and what stood there before, to be put back at the quit (null: nothing held) */
interface Held { cone: { was: boolean | null; put: boolean } | null; own: { was: boolean; put: boolean } | null }
let HELD: Held | null = null;
/** the rung's hand off the rows: each as it stood before — unless it was moved by hand since (it no longer reads what the rung put), which stays and is the rung's no more */
function lift(h: Held) {
  if (h.cone) { if (FOG.cone === h.cone.put && coneVisitNow() === h.cone.put) setConeVisit(h.cone.was); else h.cone = null; }
  if (h.own) { if (FOG.own === h.own.put) FOG.own = h.own.was; else h.own = null; }
}
/** THE MISSION'S START (scenarioRun.ts): the rung on the fog's two rows for the visit — the cone for every rung but 'all round', the player's eyes alone on
 *  'own eyes'. 'off' lets go of whatever an earlier start on this page held. */
export function quietFogStart(q: URLSearchParams, rung: QuietRung) {
  quietFogEnd();
  if (rung === 'off') return;
  HELD = { cone: null, own: null };
  if (!q.has('fogcone')) { const put = rung !== 'team'; HELD.cone = { was: coneVisitNow(), put }; setConeVisit(put); }
  if (!q.has('fogown')) { const put = rung === 'own'; HELD.own = { was: FOG.own, put }; FOG.own = put; }
}
/** the scenario quit, or another started over it: the rows as they stood (a row moved by hand since stays where it was moved to) */
export function quietFogEnd() {
  if (!HELD) return;
  lift(HELD); HELD = null;
}
/** THE SQUAD'S LEVER WHILE A RUNG IS HELD (the mission sheet opened from the pause card of a quiet mission under the fog): `fn` — a read of the squad
 *  lever off the fog's rows, or a press that writes them (ui/levers.ts, ui/missions.ts) — runs with the rung's hand off the rows, and the rung is laid on
 *  what it left: the squad rows light as this machine keeps them, a press there moves the squad's lever and not the mission being played, and the quit
 *  puts back what the press wrote. EVERY read of the squad's level off the rows on a screen goes through it too (difficultyNow, leversMixed, leversLine,
 *  difficultyHref, leversHref: Standard | Hard lit, the A / D keys, 'your own mix', a squad row's link) — unwrapped, a kept AI lever beside a held rung read
 *  as a whole level and D then dropped the kept levers (the levers thread's read, 10-11). Nothing held: `fn` alone. */
let ASIDE = false;   // (inside an aside already: the hand is off, a second lift would read the rows as moved by hand and let go of them)
export function quietFogAside<T>(fn: () => T): T {
  const h = HELD; if (!h || ASIDE) return fn();
  lift(h); ASIDE = true;
  try { return fn(); }
  finally { ASIDE = false; if (HELD === h) {
    if (h.cone) { h.cone.was = coneVisitNow(); setConeVisit(h.cone.put); }
    if (h.own) { h.own.was = FOG.own; FOG.own = h.own.put; } } }
}
/** is a quiet mission's rung on the fog's rows now? (the panel's summary, the checks) */
export const quietFogHeld = (): boolean => !!HELD;
