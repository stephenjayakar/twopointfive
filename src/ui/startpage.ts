// THE ONE STARTING PAGE (the maintainer, 10-09, a minute into playing the short list: 'how do i do the loadout? scenario goes straight to the game' … 'seems
// like we should just unify everything in the starting page'): what to play, how it is set and what the team carries are ONE page, and one button starts it.
// Nothing here is a new screen: it is the mission list (ui/missions.ts — the rows, the sheet, Defenders / Hour / Weather) with the loadout screen
// (ui/loadout.ts — the team's size, the squad kit row, the five slots, the picked member's kit card, Deploy) mounted INSIDE its sheet for the highlighted
// mission. THE ROWS ARE IN THE LIST'S GROUPS (scene/scenarios.ts MISSION_GROUPS; the maintainer, 10-11: 'can we also reorganize the missions into nicer
// groups?'), every mission under exactly one heading and listed once: all the headings are always drawn, each with how many it holds, and only the one the
// cursor is in shows its rows (ui/missions.ts `fold`) — W S walk every row, crossing a heading opens it, a click on a heading is its first row. Inside a
// group the short list's missions (scene/picks.ts PICKS) come first, in play order, each still that pick (below); a fresh visit opens on the short list's
// first. `?nogroups` = the list as it was before: the short list on top, 'Every other mission' under it, nothing folded. No way in skips another: there is
// no straight-in row, no separate Missions button and no separate Start.
//
// THE PAGE, left to right (the calm pass, 10-11): the rows (W S / ↑ ↓, or a click), words only · the highlighted mission — its title, what it is in one
// line, the level's plan, its words · the SETUP rail: Difficulty (A D) with its levers under it, Hour (H), Weather (J), Way in (K, where the level has
// two), each ONE row showing its value, then the team, then the one sentence of the row last touched · across the foot ONE filled block that leads on: 'Team & kit ›'
// here (Deploy a quiet word beside it — the maintainer, 10-12: "confusing that CTA is to deploy but that skips the kit selection screen"), DEPLOY on the second step. The
// LOADOUT (team size, squad kit, the members, the picked member's kit) is the page's second step, TEAM & KIT, on the same frame.
// THE KEYS are the two screens' own, with the highlight in one of two places: ON THE ROWS (the page opens there) W S choose, A D / H / J / K set, Enter or Space
// steps INTO THE LOADOUT, where W S A D are its rows, Enter deploys (on a row with a press of its own: that press) and Esc steps back to the rows. So from a
// row, Enter Enter is in the game with what the page shows; Esc on the rows is the card behind (the controls and the sandbox row). A click anywhere moves the
// keys to where it landed. No held keys, no digits.
// A ROW OF THE SHORT LIST KEEPS ITS SETTINGS: highlighted, it puts its own hour on the Hour row (the barracks by day) until an hour is picked by hand, and
// deployed with the short list's settings still on it the page it loads is that pick's own URL (scene/picks.ts pickHref) — so the pause card's 'Next' and
// the 'played' mark work as they did off the short list. Anything else is the mission list's own link for the row. Coming onto a short-list row puts ITS
// hour on the Hour row; leaving it puts the player's own back (an hour picked by hand on a row is the player's from then on).
// THE SWITCH: START_PAGE.on — on for a real page, `?cards` = off: the start card with its short list, the Missions button and the loadout as a screen of its
// own, as the build was. Off wherever there is no window to listen on (the harness's fake DOM): every older probe measures the cards as they were, and
// the page is looked at on the real build by tools/qa/startpage-look.cjs (its rows as data: picks-probes.ts picks-list). A page whose URL names a mission never opens it (that page is booting the mission).
// Plain DOM inside the mission list's own layer (#missions, which gets the class `one`), styles injected here once. Nothing at module level uses another
// module's exports.
import { PICKS, PICKS_UI, pickHref, pickEntry, pickSquad, pickOfQuery, namesMission, type Pick } from '../scene/picks';
import { MISSIONS, missionList, listedMissions, openMissions, currentMissions, GROUPS_UI, type Mission, type MissionsScreen } from './missions';
import { openLoadout, entryOfMission, type LoadoutScreen } from './loadout';
import { notePicked } from './picks';
import { difficultyNow, leversMixed, leversBase, leversHref } from '../game/difficulty';
import { quietFogAside } from '../game/quietfog';
import { quietGear } from './kitNoise';
import type { HourId } from '../game/hours';
import { WEATHER_PRESETS, snowLevel } from '../game/weatherKinds';
import { squadOfQuery, sizeWords, kitAsIssued, type SquadSize } from '../game/loadout';
import { menuTheme } from './theme';
import { mountKitFigure, type KitFigure } from './kitFigure';
import { KIT_VIEW, mountKitView, type KitViewFrame } from './kitView';
import { KIT_CLIP } from './kitCard';
import { LOOK, placeOfQuery } from '../scene/look';
import { mountKitBrief, type KitBrief } from './kitBrief';
import { mountKitGuide, type KitGuide } from './kitGuide';

export const START_PAGE = { on: typeof window !== 'undefined' && typeof window.addEventListener === 'function' };
try { if (new URLSearchParams(location.search).has('cards')) START_PAGE.on = false; } catch { /* no page (the harness) */ }

const CSS = `
/* THE CALM PASS (the maintainer, 10-11: 'this is still really busy'). Two steps on one frame that each fit the window: MISSION (the rows · the plan · the
   setup) and TEAM & KIT. A setting shows its VALUE, never its choices; no sentence explains one (show, not tell: the value, the plan and the way in's mark on it say it; a row's tooltip has the words) — the old readout is a live region for a screen reader only, for the row last
   touched. The accent is the cursor's bar and the Deploy block, nothing else; everything is flat, square and sits on the ground with no frame. */
#missions.one { --pg: 24px; --line: rgba(var(--m-edge),0.14); background: var(--m-base); }
#missions.one .mcard { width: 100%; height: 100%; background: var(--m-base); border: 0; border-radius: 0; box-shadow: none; font-family: var(--m-font); }
#missions.one .mhead { height: 48px; box-sizing: border-box; padding: 0 var(--pg); gap: 0; align-items: center; border-bottom: 1px solid var(--line); }
#missions.one .mback { order: 3; margin-left: auto; padding: 8px 0 7px; font: 600 12px/1 var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; border-radius: 0; }
#missions.one .mback:hover { color: var(--m-bright); background: none; }
#missions.one .mt { flex: 0 0 auto; width: clamp(250px, 25vw / var(--tz, 1), 330px); margin-left: calc(-1 * var(--pg)); padding-left: var(--pg); box-sizing: border-box; font: 700 13px/1 var(--m-head); letter-spacing: 0.34em; color: var(--m-dim); text-shadow: none; }
#missions.one .mcount { margin-left: 16px; color: var(--m-dim); font: 600 11px var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; }
#missions.one .msteps { display: flex; align-items: center; gap: 12px; padding-left: var(--pg); font: 600 13px/1 var(--m-head); letter-spacing: 0.22em; text-transform: uppercase; color: var(--m-faint); }
#missions.one .mstep { padding: 8px 0 7px; font: inherit; letter-spacing: inherit; text-transform: inherit; color: var(--m-dim); background: none; border: 0; border-radius: 0; cursor: pointer; }
#missions.one .mstep:hover { color: var(--m-text); }
#missions.one .mstep.on { color: var(--m-bright); cursor: default; }
#missions.one .mbody { grid-template-columns: clamp(250px, 25vw / var(--tz, 1), 330px) minmax(0, 1fr); }
/* the rows: words only, one line each; the highlighted one bright with the bar (the last 14 px track of a row is kept EMPTY: room at its right end) */
#missions.one .mlist { display: flex; flex-direction: column; padding: 4px 0 30px; background: none; border-right: 1px solid var(--line); scrollbar-width: none; -webkit-mask-image: linear-gradient(#000 calc(100% - 30px), transparent); mask-image: linear-gradient(#000 calc(100% - 30px), transparent); }
#missions.one .mlist::-webkit-scrollbar { display: none; }
#missions.one .msec { position: static; margin: 0; padding: 18px var(--pg) 8px; font: 600 11px/1 var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; color: var(--m-dim); background: none; border: 0; }
#missions.one .msec.rest { margin-top: 0; color: var(--m-dim); background: none; border: 0; }
/* …in their groups, folded: every heading a bar with its count, the one the cursor is in open over its rows (sand and dim: the orange is the cursor's alone) */
#missions.one .mlist.fold { padding-top: 0; }
#missions.one .mlist.fold .msec, #missions.one .mlist.fold .msec.rest { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 15px 14px 12px var(--pg); font: 700 12px/1 var(--m-head); letter-spacing: 0.2em; color: var(--m-dim); border-top: 1px solid var(--line); cursor: pointer; user-select: none; -webkit-user-select: none; }
#missions.one .mlist.fold .msec:first-child { border-top-color: transparent; }
#missions.one .mlist.fold .msec::after { content: attr(data-count); font: 10px/1 var(--m-mono); letter-spacing: 0.06em; color: var(--m-dim); }
#missions.one .mlist.fold .msec:hover { color: var(--m-text); }
#missions.one .mlist.fold .msec.open { padding-bottom: 9px; color: var(--m-bright); cursor: default; }
#missions.one .mlist.fold .mrow.shut { display: none; }
#missions.one .mlist.fold .mrow:not(.shut) + .msec { margin-top: 10px; }
#missions.one .mrow { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) auto auto 14px; grid-template-rows: auto; align-items: start; column-gap: 7px; row-gap: 0; min-height: 32px; box-sizing: border-box; margin: 0; padding: 8px 14px 6px calc(var(--pg) - 3px); background: none; border: 0; border-left: 3px solid transparent; border-radius: 0; color: var(--m-text); }
#missions.one .mrow:hover { background: rgba(var(--m-edge),0.035); border-color: transparent; color: var(--m-bright); }
#missions.one .mrow.sel { background: rgba(var(--m-accent-rgb),0.1); border-color: transparent; border-left-color: var(--m-accent); color: var(--m-bright); }
#missions.one .mthumb, #missions.one .mn { display: none; }
#missions.one .mtitle { grid-column: 1; grid-row: 1; overflow-wrap: anywhere; font: 600 16px/1.15 var(--m-head); letter-spacing: 0.04em; text-transform: uppercase; color: inherit; }
#missions.one .mrow .tag, #missions.one .mrow .tag.team { grid-column: 2; grid-row: 1; justify-self: end; align-self: start; margin: 0; padding: 0; background: none; border: 0; border-radius: 0; font: 10px/20px var(--m-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--m-dim); }
#missions.one .mlean { grid-column: 3; grid-row: 1; align-self: start; margin: 0; display: block; flex: none; width: auto; height: auto; border-radius: 0; background: none !important; font: 10px/20px var(--m-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--m-dim); }
#missions.one .mlean.quiet::after { content: 'quiet'; } #missions.one .mlean.loud::after { content: 'loud'; } #missions.one .mlean.either::after { content: 'either'; }
#missions.one .mrow.sel .tag, #missions.one .mrow.sel .mlean, #missions.one .mrow:hover .tag, #missions.one .mrow:hover .mlean { color: var(--m-soft); }
/* the frame: the mission in the middle, its setup down the right, Deploy across the foot */
#missions.one .msheet { --m-pad: var(--pg); display: grid; grid-template-columns: minmax(0, 1fr) 272px; grid-template-rows: 1fr auto; column-gap: 32px; row-gap: 0; padding: 22px var(--pg) 0; }
#missions.one .mbrief { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: 0; min-width: 0; max-width: 860px; }
#missions.one .mtop { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
#missions.one .mst { font: 700 clamp(30px, 3.2vw / var(--tz, 1), 42px)/1 var(--m-head); letter-spacing: 0.03em; text-transform: uppercase; color: var(--m-bright); }
#missions.one .mtop .tag.untuned { padding: 0; border: 0; background: none; font: 10px/1 var(--m-mono); letter-spacing: 0.06em; color: var(--m-dim); }
#missions.one .mcsum { display: none; font: 600 11px/1 var(--m-head); letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-dim); }
#missions.one .mfacts { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 9px 0 0; }
#missions.one .mfact { display: flex; align-items: baseline; gap: 8px; padding: 0; border: 0; border-radius: 0; background: none; }
#missions.one .mfact i { font: 600 11px/1 var(--m-head); letter-spacing: 0.18em; color: var(--m-dim); }
#missions.one .mfact b { margin: 0; font: 600 11px/1 var(--m-head); letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-text); }
#missions.one:not(.pane-loadout) .mfacts.nodef { display: none; }   /* (the Defenders cell was this step's only one: with the count a mystery — ui/missions.ts MYSTERY — the row is not drawn) */
#missions.one .mfact[data-fact="level"], #missions.one .mfact[data-fact="team"], #missions.one .mfact[data-fact="approach"] { display: none; }   /* (the name over it says where, the rail's Team row says who, the list's own tag says how) */
/* the plan: a map sheet. Crop ticks at its corners, the place's own line and a scale at its foot (the canvas draws the grid and the scale) */
#missions.one .mmap { --tick: rgba(var(--m-edge),0.34); position: relative; margin: 14px 0 0; padding: 0;
  background: linear-gradient(var(--tick),var(--tick)) 0 0 / 12px 1px no-repeat, linear-gradient(var(--tick),var(--tick)) 0 0 / 1px 12px no-repeat, linear-gradient(var(--tick),var(--tick)) 100% 0 / 12px 1px no-repeat, linear-gradient(var(--tick),var(--tick)) 100% 0 / 1px 12px no-repeat,
    linear-gradient(var(--tick),var(--tick)) 0 100% / 12px 1px no-repeat, linear-gradient(var(--tick),var(--tick)) 0 100% / 1px 12px no-repeat, linear-gradient(var(--tick),var(--tick)) 100% 100% / 12px 1px no-repeat, linear-gradient(var(--tick),var(--tick)) 100% 100% / 1px 12px no-repeat, rgb(var(--m-panel-rgb)); }
#missions.one .mmap:has(.mplan[style*="none"]) { background: none; }
#missions.one .mmap:has(.mplan[style*="none"]) .mplace { display: block; position: static; }
#missions.one .msheet .mbrief .mmap .mplan { display: block; box-sizing: border-box; width: 100%; height: auto; aspect-ratio: 40 / 28; max-width: none; max-height: max(180px, calc(100vh / var(--tz, 1) - 372px)); object-fit: contain; margin: 0; padding: 10px 10px 22px; background: none; border: 0; }   /* (outranks the old sheet's height rules in index.html, which squeezed the plan for a mission with a Way in row) */
#missions.one .mplace { display: none; position: absolute; left: 12px; right: 96px; bottom: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px/1 var(--m-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--m-soft); }
#missions.one .mblurb { max-width: 62ch; margin: 14px 0 0; font-size: 14px; line-height: 1.5; color: var(--m-text); }
#missions.one .mtip { display: none; }
#missions.one .mstore, #missions.one .mgo, #missions.one .mfoot { display: none; }
/* THE RAIL: one row a setting, its value at the right; a click steps it, its key steps it; the three levers hang under Difficulty */
#missions.one .mrail { grid-column: 2; grid-row: 1; display: flex; flex-direction: column; min-width: 0; padding: 4px 0 14px; }
#missions.one .mrl { margin: 0 0 8px; font: 600 11px/1 var(--m-head); letter-spacing: 0.2em; text-transform: uppercase; color: var(--m-dim); }
#missions.one .mval { flex: 0 0 auto; display: flex; align-items: center; gap: 0; box-sizing: border-box; width: 100%; min-height: 34px; margin: 0; padding: 4px 4px 3px 10px; text-align: left; color: var(--m-text); font: inherit; background: none; border: 0; border-radius: 0; cursor: pointer; }
#missions.one .mval[hidden] { display: none; }
#missions.one .mval:hover { background: rgba(var(--m-edge),0.08); }
#missions.one .mval:focus-visible, #missions.one .mstep:focus-visible, #missions.one .mback:focus-visible { outline: 0; box-shadow: inset 3px 0 0 var(--m-accent); }
#missions.one .mval i { flex: 0 0 auto; font: 600 11px/1 var(--m-head); font-style: normal; letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-soft); }
#missions.one .mval kbd { flex: 0 0 auto; margin-left: 8px; padding: 2px 4px 1px; border: 1px solid rgba(var(--m-edge),0.26); border-radius: 2px; font: 10px/1 var(--m-mono); color: var(--m-soft); background: none; }
#missions.one .mval kbd:empty, #missions.one .mval.custom kbd { display: none; }
#missions.one .mval b { flex: 0 1 auto; min-width: 0; padding: 0 2px; text-align: right; font: 600 16px/1.1 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; color: var(--m-text); }
#missions.one .mval .chev { flex: 0 0 14px; text-align: center; font: 14px/1 var(--m-head); color: var(--m-soft); visibility: hidden; }
#missions.one .mval .chev.prev, #missions.one .mval.mteam b { margin-left: auto; }
#missions.one .mval:hover .chev, #missions.one .mval.touched .chev { visibility: visible; }
#missions.one .mval .chev:hover { color: var(--m-bright); }
#missions.one .mval.touched b { color: var(--m-bright); }
#missions.one .mval.lever { width: auto; min-height: 28px; margin-left: 14px; border-left: 1px solid var(--line); }
#missions.one .mval.lever.solo { width: 100%; min-height: 34px; margin-left: 0; border-left: 0; }
#missions.one .mval.lever i { color: var(--m-soft); }
#missions.one .mval.lever b { font-size: 14px; color: var(--m-soft); }
#missions.one .mval.lever.moved b, #missions.one .mval.lever.solo b, #missions.one .mval.lever.touched b { color: var(--m-bright); }
#missions.one .mval.lever.solo b { font-size: 16px; }
#missions.one .mval.long b { font-size: 13px; line-height: 1.15; letter-spacing: 0.04em; }
#missions.one .mrule { flex: 0 0 auto; height: 1px; margin: 10px 0; background: var(--line); }
#missions.one .mval.mteam .chev { visibility: visible; }
/* SHOW, NOT TELL: no sentence stands on the page for a setting. What a row's value does is in its tooltip and, for a screen reader, in this live region nobody sees */
#missions.one .mread { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
#missions.one .mval.armed b { color: var(--m-bright); font-size: 12px; letter-spacing: 0.04em; white-space: nowrap; }
/* the loadout in the sheet: on MISSION only its foot bar; on TEAM & KIT all of it */
#missions.one .onehost { grid-column: 1 / -1; grid-row: 2; display: flex; flex-direction: column; min-width: 0; margin: 0; border: 0; }
#missions.one #loadout { position: static; z-index: auto; flex: 1 0 auto; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; background: none; outline: none; }
#missions.one #loadout .lo-card { flex: 1 0 auto; width: auto; max-height: none; overflow: visible; padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none; }
#missions.one #loadout .lo-body { flex: 1 0 auto; overflow: visible; padding: 0; border: 0; }   /* (a Loadout whose rows sit in an inner scroller of their own: here the page scrolls, not the rows) */
#missions.one.pane-list #loadout .lo-body { display: none; }
#missions.one #loadout .lo-head, #missions.one #loadout .lo-foot, #missions.one #loadout [data-act="back"], #missions.one #loadout .lo-team .lo-label, #missions.one #loadout .lo-step, #missions.one #loadout .lo-words, #missions.one #loadout .lo-fig, #missions.one #loadout .lo-gun { display: none; }
#missions.one #loadout .lo-row { margin: 0; padding: 0; border: 0; border-radius: 0; background: none; gap: 6px; }
#missions.one #loadout .lo-row.sel, #missions.one #loadout .lo-slots.sel { border-color: transparent; background: none; }
#missions.one.pane-loadout #loadout .lo-team.sel::before, #missions.one.pane-loadout #loadout .lo-kits.sel .lo-label { color: var(--m-bright); border-left-color: var(--m-accent); }
#missions.one #loadout .lo-team, #missions.one #loadout .lo-kits { display: flex; align-items: center; }
#missions.one #loadout .lo-team::before { content: 'Team'; }
#missions.one #loadout .lo-team::before, #missions.one #loadout .lo-kits .lo-label { flex: 0 0 100px; box-sizing: border-box; margin: 0; padding: 3px 0 2px 9px; border-left: 3px solid transparent; font: 600 11px/1 var(--m-head); letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-soft); }
#missions.one #loadout .lo-sizes { margin: 0; gap: 2px; }
#missions.one #loadout .lo-size, #missions.one #loadout .lo-set, #missions.one #loadout .kc-set { min-width: 0; padding: 7px 13px 6px; font: 600 12px/1.3 var(--m-head); letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-soft); background: none; border: 0; border-radius: 0; box-shadow: none; }
#missions.one #loadout .lo-size.own { border: 0; padding: 7px 13px 6px; }
#missions.one #loadout .lo-size.off, #missions.one #loadout .lo-set:disabled { display: none; }   /* (only the sizes this mission can be played at; alone there is no squad to kit, and the row's own line says so) */
#missions.one #loadout .lo-sizes:not(:has(.lo-size:not(.off):not(.on))) .lo-size.on { padding-left: 0; color: var(--m-text); box-shadow: none !important; cursor: default; }   /* (one size only: a fact, not a control) */
#missions.one #loadout .lo-size:hover:not(.on):not(.off), #missions.one #loadout .lo-set:hover:not(.on):not(:disabled), #missions.one #loadout .kc-set:hover:not(.on):not(.off) { color: var(--m-bright); background: rgba(var(--m-edge),0.1); border: 0; }
#missions.one #loadout .lo-size.on, #missions.one #loadout .lo-set.on, #missions.one #loadout .kc-set.on { color: var(--m-bright); background: none; box-shadow: inset 0 -2px 0 var(--m-soft); }
#missions.one.pane-loadout #loadout .lo-team.sel .lo-size.on, #missions.one.pane-loadout #loadout .lo-kits.sel .lo-set.pick, #missions.one.pane-loadout #loadout .kc.focus .kc-sets.sel .kc-set.pick { outline: 0; box-shadow: inset 0 -3px 0 var(--m-accent); }
#missions.one #loadout .lo-kits { margin-top: 6px; row-gap: 4px; gap: 2px; }
#missions.one #loadout .lo-kits-own { margin-left: 10px; font-style: normal; }
#missions.one #loadout .lo-kits:has(.lo-set:disabled) { display: none; }   /* (alone: no squad to kit; the keys step over a row that is not drawn — loadout.ts move) */
#missions.one #loadout .lo-noteline { flex-wrap: wrap; gap: 3px 22px; margin: 8px 0 0; padding-left: 113px; }   /* (a narrow window: what the squad carries drops under the note, nothing runs off the sheet) */
#missions.one #loadout .lo-note { flex: 0 1 auto; min-height: 0; font-size: 12px; color: var(--m-soft); }
#missions.one #loadout .lo-note:empty, #missions.one #loadout .lo-note:not(.off) { display: none; }   /* (only a refused step is said) */
#missions.one #loadout .lo-pool, #missions.one #loadout .lo-squadp { margin: 0; white-space: normal; font: 12px/1.45 var(--m-font); letter-spacing: 0; color: var(--m-dim); }
#missions.one #loadout .lo-slots { gap: 8px; margin: 16px 0 0; padding: 0; border: 0; border-radius: 0; }
#missions.one #loadout .lo-slot { grid-template-columns: minmax(0, 1fr); column-gap: 0; padding: 9px 11px 9px 12px; border: 0; border-left: 3px solid rgba(var(--m-edge),0.4); border-radius: 0; background: rgba(var(--m-edge),0.06); box-shadow: none; color: var(--m-dim); }
#missions.one #loadout .lo-slot.p-you { border-left-color: var(--m-text); color: var(--m-dim); }
#missions.one #loadout .lo-slot.p-red { border-left-color: #c9655b; color: var(--m-dim); }
#missions.one #loadout .lo-slot.p-blue { border-left-color: #5b8fc9; color: var(--m-dim); }
#missions.one #loadout .lo-slot.out { display: none; }   /* (who comes is the Team row's; a place nobody has is not drawn) */
#missions.one #loadout .lo-slot.in:hover { background: rgba(var(--m-edge),0.12); }
#missions.one #loadout .lo-name { font: 600 16px/1.1 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; overflow: visible; }
#missions.one #loadout .lo-name.changed::after { color: var(--m-soft); }
#missions.one #loadout .lo-role { display: none; }   /* (the chip's colour bar says the pair, its name the man) */
#missions.one #loadout .lo-sum, #missions.one #loadout .lo-pouch { grid-column: 1; }
#missions.one #loadout .lo-sum { margin-top: 8px; min-height: 0; font: 11.5px/1.4 var(--m-font); color: var(--m-soft); }
#missions.one #loadout .lo-pouch, #missions.one #loadout .lo-slot:has(.lo-ics) .lo-sum { display: none; }
/* a man's kit holds ONE line on his chip however full his card is: each thing is sized in ems of the icon's height, 17 px where the chip has the room and
   else the chip's own width over the FULLEST man's row in icon heights (--u on .lo-slots, loadout.ts drawSlots) — so the rows shrink together to fit and never wrap */
#missions.one #loadout .lo-ics { grid-column: 1; container-type: inline-size; display: flex; flex-wrap: nowrap; align-items: center; height: 17px; margin-top: 9px; color: var(--m-soft); }
#missions.one #loadout .lo-ic { flex: none; display: inline-flex; align-items: center; gap: 0.18em; font-size: min(17px, calc(100cqw / var(--u, 1))); }
#missions.one #loadout .lo-ic + .lo-ic { margin-left: 0.65em; }
#missions.one #loadout .lo-ic svg { width: 2em; height: 1em; display: block; }
#missions.one #loadout .lo-ic.n svg { width: 1em; }
#missions.one #loadout .lo-ic b { font: 600 0.706em/1 var(--m-mono); color: var(--m-text); }
#missions.one #loadout .lo-slot.pick .lo-ics { color: var(--m-text); }   /* (a man's pouches are on his kit card, when he is the one picked) */
/* in the kit (pane-loadout) the briefing folds to the mission's name and what is set, and the picked man stands where the list was */
#missions.one .onefig { display: none; }
#missions.one.pane-loadout .mlist { display: none; }
#missions.one.pane-loadout .onefig { display: block; grid-column: 1; grid-row: 1; min-height: 0; overflow: hidden; border-right: 1px solid rgba(var(--m-edge),0.12); }
#missions.one .onefig canvas { display: block; width: 100%; height: 100%; cursor: ew-resize; touch-action: none; }
#missions.one.pane-loadout .msheet { grid-template-rows: auto 1fr; padding-top: 20px; }
#missions.one.pane-loadout .mbrief { grid-column: 1 / -1; max-width: none; flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; margin-bottom: 16px; }
#missions.one.pane-loadout .mfacts, #missions.one.pane-loadout .mmap, #missions.one.pane-loadout .mblurb, #missions.one.pane-loadout .mrail, #missions.one.pane-loadout .mtop .tag { display: none; }
#missions.one.pane-loadout .mst { font-size: 24px; }
#missions.one.pane-loadout .mrow:not(:hover) { color: var(--m-dim); }
#missions.one.pane-loadout .mrow.sel { background: none; border-left-color: var(--m-soft); color: var(--m-text); }
#missions.one.pane-loadout #loadout .lo-slot.pick { background: rgba(var(--m-edge),0.14); }
#missions.one.pane-loadout #loadout .lo-slots.sel .lo-slot.pick { background: rgba(var(--m-accent-rgb),0.1); box-shadow: inset 0 -3px 0 var(--m-accent); }
#missions.one.pane-loadout #loadout .lo-slot.pick .lo-name { color: var(--m-bright); }
/* the picked member's kit: its sets first, then flat tiles four across; what a tile's choice does is ONE line at the card's foot, for the tile the keys or the mouse are on */
#missions.one #loadout .lo-kit { margin-top: 18px; }
#missions.one #loadout .lo-kit .kc { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; grid-template-rows: none !important; grid-auto-flow: row; grid-auto-rows: auto; column-gap: 8px; row-gap: 6px; padding: 0 0 30px; background: none; border: 0; border-radius: 0; box-shadow: none; }
#missions.one #loadout .lo-kit .kc-head { grid-column: 3; grid-row: 1; justify-content: flex-end; align-items: center; gap: 14px; margin: 0 0 4px; padding: 0; border: 0; }
#missions.one #loadout .lo-kit .kc-fig, #missions.one #loadout .lo-kit .kc-title, #missions.one #loadout .lo-kit .kc-sub { display: none; }   /* (the picked roster chip over the card names him) */
#missions.one #loadout .lo-kit .kc-title { font: 700 20px/1.1 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; color: var(--m-bright); }
#missions.one #loadout .lo-kit .kc-sub { font: 600 10px/1.3 var(--m-head); letter-spacing: 0.18em; text-transform: uppercase; color: var(--m-dim); }
#missions.one #loadout .lo-kit .kc-pouch { flex-wrap: nowrap; gap: 8px; margin-top: 0; color: var(--m-soft); }
#missions.one #loadout .lo-kit .kc-pips { flex: 0 0 auto; order: 9; }
#missions.one #loadout .lo-kit .kc-pips i { border-radius: 0; }
#missions.one #loadout .lo-kit .kc-pips i.on { background: var(--m-text); }
/* what the card weighs (game/kitload.ts): its two bars on two lines of their own under the pouches, one track under the other, in the head's own column */
#missions.one #loadout .lo-kit .kc-pouch:has(.kc-load:not(.off)) { flex-wrap: wrap; justify-content: flex-end; row-gap: 4px; }
#missions.one #loadout .lo-kit .kc-load { flex: 0 0 100%; gap: 3px; margin: 0; }
#missions.one #loadout .lo-kit .kc-bar { justify-content: flex-end; gap: 8px; line-height: 9px; }
#missions.one #loadout .lo-kit .kc-head { min-width: 0; }
#missions.one #loadout .lo-kit .kc-bar-t { flex: 0 1 176px; min-width: 40px; height: 6px; }   /* (the track gives way in a narrow window: its label stays in the head's own column, clear of the sets' row beside it) */
#missions.one #loadout .lo-kit .kc-words { display: none; }
#missions.one #loadout .lo-kit .kc-words.refused, #missions.one #loadout .lo-kit .kc-note { display: none; grid-column: auto; grid-row: auto; position: absolute; left: 0; right: 0; bottom: 4px; margin: 0; padding: 0; border: 0; min-height: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; color: var(--m-soft); }
#missions.one #loadout .lo-kit .kc-words.refused { display: block; color: #e8c15a; background: var(--m-base); z-index: 1; }
#missions.one #loadout .lo-kit .kc-row { position: static; grid-column: auto; grid-row: auto; grid-template-columns: 48px minmax(0, 1fr); margin: 0; padding: 8px 8px 8px 10px; background: rgba(var(--m-edge),0.06); border: 0; border-left: 3px solid transparent; border-radius: 0; }
#missions.one #loadout .lo-kit .kc-row[data-field="big"] { grid-column: 1 / -1; grid-template-columns: 112px minmax(0, 1fr); padding-top: 10px; padding-bottom: 10px; }   /* (the big slot — game/kit.ts BIGSLOT: the card's last tile, as wide as the card, under the pouches' tiles) */
#missions.one #loadout .lo-kit .kc-row[data-field="big"] .kc-ico { height: 44px; }
#missions.one #loadout .lo-kit .kc-row:hover { background: rgba(var(--m-edge),0.12); }
#missions.one.pane-loadout #loadout .lo-kit .kc.focus .kc-row.sel { background: rgba(var(--m-accent-rgb),0.1); border-left-color: var(--m-accent); }
#missions.one #loadout .lo-kit .kc-label { font: 600 10px/1 var(--m-head); letter-spacing: 0.18em; color: var(--m-soft); }
#missions.one #loadout .lo-kit .kc-val { font: 600 16px/1.2 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; color: var(--m-text); }
#missions.one #loadout .lo-kit .kc-step { background: none; border: 0; border-radius: 0; color: var(--m-soft); visibility: hidden; }
#missions.one #loadout .lo-kit .kc-row:hover .kc-step, #missions.one.pane-loadout #loadout .lo-kit .kc.focus .kc-row.sel .kc-step { visibility: visible; }
#missions.one #loadout .lo-kit .kc-step:hover { color: var(--m-bright); background: rgba(var(--m-edge),0.2); }
#missions.one #loadout .lo-kit .kc-row.refused > .kc-note { display: block; }   /* (a tile's own sentence is its tooltip; only a refusal's reason is on the page) */
#missions.one #loadout .lo-kit .kc-row.refused > .kc-note { color: #e8c15a; }
#missions.one #loadout .lo-kit .kc:has(.kc-row:hover) .kc-row:not(:hover):not(.refused) > .kc-note { display: none; }
#missions.one #loadout .lo-kit .kc:has(.kc-row.refused) .kc-row:not(.refused) > .kc-note { display: none !important; }   /* (a refusal's reason outranks the row pointed at, which outranks the row the keys are on) */
#missions.one #loadout .lo-kit .kc-sets { grid-column: 1 / 3; grid-row: 1; justify-content: flex-start; align-self: end; margin: 0 0 4px; padding: 0; border: 0; background: none; gap: 2px; }
#missions.one #loadout .lo-kit .kc.focus .kc-sets.sel { background: none; }
/* THE CARD AS A TREE (game/kittree.ts): each gun is a tile with what it is good at drawn beside its name (ui/gunStats.ts), and what rides on that gun hangs under it as smaller tiles off one rule: the primary two columns wide, the secondary the third */
#missions.one #loadout .lo-kit .kc-tree .kc-gun { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="primary"] { grid-column: 1 / 3; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun > .kc-row { flex: 0 0 auto; grid-template-columns: 96px minmax(0, 1fr) minmax(0, 40%); align-items: center; min-height: 76px; box-sizing: border-box; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun > .kc-row .kc-ico { height: 44px; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun > .kc-row .kc-val { font-size: 20px; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] > .kc-row { grid-template-columns: 48px minmax(0, 1fr); }
#missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] > .kc-row .kc-ico { height: 32px; }
#missions.one #loadout .lo-kit .kc-tree .kc-stats { grid-column: 3; grid-row: 1 / span 2; display: flex; flex-direction: column; gap: 4px; margin: 0; }
#missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] .kc-stats { grid-column: 1 / -1; grid-row: auto; margin-top: 6px; }
#missions.one #loadout .lo-kit .kc-tree .kc-stats.off { display: none; }
#missions.one #loadout .lo-kit .kc-tree .kc-stats .kc-stat { display: flex; align-items: center; justify-content: space-between; gap: 10px; font: 600 9px/9px var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-soft); }
#missions.one #loadout .lo-kit .kc-tree .kc-stats .kc-bar-l { flex: 0 0 76px; }
#missions.one #loadout .lo-kit .kc-tree .kc-stats .kc-bar-t { flex: 1 1 auto; height: 5px; box-shadow: none; background: rgba(var(--m-edge),0.16); }
#missions.one #loadout .lo-kit .kc-tree .kc-stats .kc-bar-t .fill { background: var(--m-text); }
#missions.one #loadout .lo-kit .kc-tree .kc-kids { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 6px; margin: 0 0 0 13px; padding: 0 0 0 9px; border: 0; border-left: 2px solid rgba(var(--m-edge),0.28); }
#missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] .kc-kids { grid-template-columns: minmax(0, 1fr); }
#missions.one #loadout .lo-kit .kc-tree .kc-kids:empty { display: none; }
#missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-row { grid-template-columns: 30px minmax(0, 1fr); column-gap: 8px; padding: 5px 6px 5px 8px; }
#missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-ico { height: 22px; }
#missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-label { font-size: 9px; letter-spacing: 0.14em; }
#missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-val { font-size: 13px; }
#missions.one #loadout .lo-kit .kc-tree .kc-row.none:not(.lent) .kc-val { color: var(--m-dim); }
#missions.one #loadout .lo-kit .kc-tree .kc-row.fixed .kc-val { color: var(--m-soft); }
@media (max-width: 1480px) { #missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="primary"] .kc-kids { grid-template-columns: repeat(2, minmax(0, 1fr)); } }   /* (three across cuts '40 MM GRENADES' short under about 1400) */
@media (max-width: 1180px) { #missions.one #loadout .lo-kit .kc-tree .kc-gun > .kc-row { grid-template-columns: minmax(0, 1fr) minmax(0, 44%); } #missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] > .kc-row, #missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-row { grid-template-columns: minmax(0, 1fr); } #missions.one #loadout .lo-kit .kc-tree .kc-stats { grid-column: 2; } #missions.one #loadout .lo-kit .kc-tree .kc-gun[data-gun="secondary"] .kc-stats { grid-column: 1; } #missions.one #loadout .lo-kit .kc-tree .kc-kids { margin-left: 6px; padding-left: 6px; } #missions.one #loadout .lo-kit .kc-tree .kc-stats .kc-bar-l { flex-basis: 64px; } }
/* DEPLOY: the one filled block on the page */
#missions.one #loadout .lo-actions { position: sticky; bottom: 0; z-index: 4; margin: 14px calc(-1 * var(--pg)) 0; padding: 10px var(--pg); border: 0; border-top: 1px solid var(--line); border-radius: 0; background: var(--m-base); }
#missions.one #loadout .lo-actions::before { content: attr(data-what); margin-right: auto; font: 11px/1.4 var(--m-mono); letter-spacing: 0.04em; color: var(--m-dim); }
#missions.one #loadout .lo-btn.primary, #missions.one #loadout .lo-btn.sp-next { min-width: 260px; padding: 15px 22px 13px; font: 700 18px/1 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-on-accent); background: var(--m-accent); border: 0; border-radius: 0; box-shadow: none; }
#missions.one #loadout .lo-btn.primary:hover, #missions.one #loadout .lo-btn.sp-next:hover { background: var(--m-accent-hi); }
/* THE BLOCK LEADS THROUGH BOTH STEPS: on MISSION it is 'Team & kit ›' (the page's own button, hung on the loadout's bar) and Deploy is a quiet word beside it;
   on TEAM & KIT it is Deploy. A mission played with the kit as issued (.nokit: a Training lesson) has no kit to pick, so Deploy is the block on both. */
#missions.one #loadout .lo-btn.sp-next { display: none; }
#missions.one.pane-list:not(.nokit) #loadout .lo-btn.sp-next { display: inline-block; }
#missions.one.pane-list:not(.nokit) #loadout .lo-btn.primary, #missions.one.tiles.pane-list:not(.nokit) #loadout .lo-btn.primary { min-width: 0; padding: 15px 4px 13px; font-size: 13px; letter-spacing: 0.12em; color: var(--m-dim); background: none; }
#missions.one.pane-list:not(.nokit) #loadout .lo-btn.primary:hover { color: var(--m-bright); background: none; }
#missions.one #loadout .lo-btn.sel { outline: none; }
#missions.one.pane-loadout #loadout .lo-btn.primary.sel { box-shadow: 0 0 0 2px var(--m-base), 0 0 0 4px var(--m-bright); }   /* (the keys are on Deploy) */
/* THE GROUPS AS TILES, THEIR MISSIONS AS CARDS (root class 'tiles', the Mission step): a rail of six pictures down the left, the open group's missions as cards with
   their own place drawn on each, and the mission's sheet — name, setup, Deploy — down the right. The orange is still the cursor's alone: the picked card's frame. */
#missions.one.tiles.pane-list .mbody { grid-template-columns: minmax(0, 1fr) clamp(292px, 26vw / var(--tz, 1), 340px); }
#missions.one.pane-list .mlist.tiles { display: grid; grid-template-columns: clamp(118px, 12.5vw / var(--tz, 1), 164px) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); padding: 0; overflow: hidden; -webkit-mask-image: none; mask-image: none; }
#missions.one .mgroups { display: flex; flex-direction: column; gap: 8px; min-height: 0; padding: 14px 0 14px var(--pg); overflow-y: auto; scrollbar-width: none; }
#missions.one .mgroups::-webkit-scrollbar, #missions.one .mgrid::-webkit-scrollbar { display: none; }
#missions.one .mgroups .msec, #missions.one .mgroups .msec.rest { position: relative; flex: 1 1 0; min-height: 58px; max-height: 112px; margin: 0; padding: 0; overflow: hidden; background: rgb(var(--m-panel-rgb)); border: 1px solid rgba(var(--m-edge),0.14); color: var(--m-dim); cursor: pointer; user-select: none; -webkit-user-select: none; }
#missions.one .mgart { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0.42; }
#missions.one .mgname { position: absolute; left: 0; right: 0; bottom: 0; padding: 7px 8px 5px 8px; font: 700 11px/1.1 var(--m-head); letter-spacing: 0.16em; text-transform: uppercase; color: inherit; background: rgba(var(--m-base-rgb, 16,14,12),0.84); }
#missions.one .mgroups .msec::after { content: attr(data-count); position: absolute; right: 0; top: 0; padding: 4px 6px 3px; font: 10px/1 var(--m-mono); letter-spacing: 0.04em; color: var(--m-dim); background: rgba(var(--m-base-rgb, 16,14,12),0.84); }
#missions.one .mgroups .msec:hover { color: var(--m-text); } #missions.one .mgroups .msec:hover .mgart { opacity: 0.7; }
#missions.one .mgroups .msec.open { border-color: var(--m-soft); color: var(--m-bright); cursor: default; } #missions.one .mgroups .msec.open .mgart { opacity: 1; }
#missions.one .mgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-content: start; min-height: 0; padding: 14px 16px 30px 14px; overflow-y: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(#000 calc(100% - 26px), transparent); mask-image: linear-gradient(#000 calc(100% - 26px), transparent); }
#missions.one .mgrid .mrow.shut { display: none; }
#missions.one .mgrid .mrow { grid-template-columns: auto auto minmax(0, 1fr); grid-template-rows: auto 1fr auto; column-gap: 8px; min-height: 0; padding: 0 0 7px; background: rgb(var(--m-panel-rgb)); border: 1px solid rgba(var(--m-edge),0.14); }
#missions.one .mgrid .mrow:hover { background: rgb(var(--m-panel-rgb)); border-color: rgba(var(--m-edge),0.4); }
#missions.one .mgrid .mrow.sel { background: rgb(var(--m-panel-rgb)); border-color: var(--m-accent); box-shadow: 0 0 0 1px var(--m-accent); }
#missions.one .mgrid .mthumb { display: block; grid-column: 1 / -1; grid-row: 1; width: 100%; height: auto; aspect-ratio: 8 / 5; opacity: 0.9; border-bottom: 1px solid rgba(var(--m-edge),0.1); }
#missions.one .mgrid .mrow:hover .mthumb, #missions.one .mgrid .mrow.sel .mthumb { opacity: 1; }
#missions.one .mgrid .mrow.unplayed:not(.sel):not(:hover) .mthumb { opacity: 0.45; }   /* (THE UNPLAYED CARDS — ui/missions.ts unplayedClass, the rest of the card by index.html's rule: quieter, full again under the cursor. They stand last in their group and NO line is broken for them: a line of their own squeezed every card of a group at laptop heights) */
#missions.one .mgrid .mtitle { grid-column: 1 / -1; grid-row: 2; padding: 8px 9px 0; font-size: 14px; line-height: 1.12; }
#missions.one .mgrid .mrow .tag, #missions.one .mgrid .mrow .tag.team { grid-column: 1; grid-row: 3; justify-self: start; padding-left: 9px; line-height: 17px; }
#missions.one .mgrid .mlean { grid-column: 2; grid-row: 3; line-height: 17px; }   /* (the rest of this line is kept EMPTY: room for what a mission has earned) */
/* A GROUP OF THREE LINES IN A WINDOW TOO SHORT FOR THEM (ui/textsize.ts, its switch: the root's class): the lines shared the grid's height and each card's name and
   tags hung out under the next line's picture (a 3840 x 2160 window showed no name at all; 1920 x 1080 cut the tags). Now the PICTURE gives: a card is never
   under a picture cropped to 8 : 4 with its name and tags whole, and a group that still does not fit scrolls. */
html.tsz #missions.one .mgrid { container-type: inline-size; }
html.tsz #missions.one .mgrid .mrow { grid-template-rows: minmax(0, 1fr) auto auto; min-height: calc((100cqw - 24px) / 6 + 48px); }
html.tsz #missions.one .mgrid .mthumb { height: 100%; min-height: 0; object-fit: cover; }
#missions.one.tiles.pane-list .msheet { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto 1fr; padding: 18px 22px 0 20px; overflow-y: auto; scrollbar-width: none; }
#missions.one.tiles.pane-list .msheet:has(> .mmap) { grid-template-rows: auto auto minmax(0, 1fr) auto; }
#missions.one.tiles.pane-list .msheet > .mmap { grid-column: 1; grid-row: 3; min-height: 0; margin: 14px 0 0; overflow: hidden; }   /* (the cards carry pictures: the MAP, with the way in on it, is here, in what the rail leaves) */
#missions.one.tiles.pane-list .msheet > .mmap .mplan { display: block; box-sizing: border-box; width: 100%; height: 100%; max-width: none; max-height: none; aspect-ratio: auto; object-fit: contain; margin: 0; padding: 8px; background: none; border: 0; }
#missions.one.tiles.pane-list .msheet > .mmap:has(.mplan[style*="none"]) { display: none; }
#missions.one.tiles.pane-list .msheet:has(> .mmap) .onehost { grid-row: 4; }
@media (max-height: 730px) { #missions.one.tiles.pane-list .msheet > .mmap { display: none; } }
#missions.one.tiles.pane-list .mst { font-size: clamp(24px, 2.3vw / var(--tz, 1), 30px); }
#missions.one.tiles.pane-list .mblurb { margin-top: 10px; font-size: 13px; line-height: 1.45; }
#missions.one.tiles.pane-list .mrail { grid-column: 1; grid-row: 2; padding-top: 16px; }
#missions.one.tiles.pane-list .onehost { grid-row: 3; justify-content: flex-end; }
#missions.one.tiles.pane-list #loadout .lo-btn.primary, #missions.one.tiles.pane-list #loadout .lo-btn.sp-next { min-width: 0; padding-left: 12px; padding-right: 12px; font-size: 16px; letter-spacing: 0.1em; white-space: nowrap; }
#missions.one.tiles.pane-list #loadout .lo-actions { margin: auto -22px 0 -20px; padding: 10px 22px 16px 20px; }
#missions.one.tiles.pane-list:not(.nokit) #loadout .lo-actions::before { flex-basis: 100%; }   /* (the keys on a line of their own; under it the quiet Deploy at the left, the block at the right) */
#missions.one.tiles.pane-list:not(.nokit) #loadout .lo-btn.primary { margin-right: auto; padding-left: 0; padding-right: 0; font-size: 11px; letter-spacing: 0.06em; }
@media (max-width: 1100px) { #missions.one .mgname { font-size: 10px; letter-spacing: 0.05em; } #missions.one.tiles.pane-list #loadout .lo-btn.primary, #missions.one.tiles.pane-list #loadout .lo-btn.sp-next { font-size: 14px; letter-spacing: 0.06em; } }
@media (max-width: 1180px) { #missions.one .msheet { grid-template-columns: minmax(0, 1fr) 236px; column-gap: 22px; } #missions.one #loadout .lo-kit .kc-ico { display: none; } #missions.one #loadout .lo-kit .kc-row { grid-template-columns: minmax(0, 1fr); } #missions.one #loadout .lo-name { font-size: 13px; letter-spacing: 0.04em; } #missions.one #loadout .lo-slot { padding-left: 8px; padding-right: 8px; } #missions.one .mtitle { font-size: 14px; } #missions.one .mrow { grid-template-columns: minmax(0, 1fr) auto auto 4px; } }
@media (max-width: 900px) { #missions.one.pane-list .msheet { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto; } #missions.one .mrail { grid-column: 1; grid-row: 2; padding-top: 18px; } #missions.one .onehost { grid-row: 3; } #missions.one.pane-loadout .onehost { grid-row: 2; } #missions.one .mmap { display: none; } #missions.one .mbody { grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); } #missions.one .mt { width: auto; margin: 0; padding: 0; } #missions.one #loadout .lo-kit .kc { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } #missions.one #loadout .lo-kit .kc-head, #missions.one #loadout .lo-kit .kc-sets { grid-column: 1 / -1; grid-row: auto; justify-content: flex-start; } #missions.one #loadout .lo-kit .kc-sets { order: -1; } }
@media (max-height: 920px) { #missions.one #loadout .lo-kit .kc-tree { padding-bottom: 12px; } #missions.one #loadout .lo-kit .kc-tree .kc-row { padding-top: 5px; padding-bottom: 5px; } #missions.one #loadout .lo-kit .kc-tree .kc-gun > .kc-row { min-height: 64px; } #missions.one #loadout .lo-kit .kc-tree .kc-kids .kc-row { padding-top: 3px; padding-bottom: 3px; } }   /* (the tree is three rows of tiles taller than the card before it: on a laptop's window its last tile, the big slot, sat under the footer until the sheet was scrolled) */
@media (max-height: 740px) { #missions.one #loadout .lo-kit .kc-row { padding-top: 6px; padding-bottom: 6px; } #missions.one #loadout .lo-slots { margin-top: 12px; } #missions.one #loadout .lo-kit { margin-top: 14px; } }
@media (max-width: 720px) { #missions.one.pane-loadout .onefig { display: none; } #missions.one .mbody { grid-template-columns: minmax(0, 1fr); } #missions.one .mlist { border-right: 0; } #missions.one .mt { display: none; } }
@media (max-width: 900px) { #missions.one.tiles.pane-list .mbody { grid-template-columns: minmax(0, 1fr) 250px; } #missions.one .mgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-left: 10px; padding-right: 10px; } html.tsz #missions.one .mgrid .mrow { min-height: calc((100cqw - 10px) / 4 + 48px); } }
@media (max-width: 720px) { #missions.one.tiles.pane-list .mbody { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 46%) minmax(0, 1fr); } }
`;
/** The sound mark on a tile of a quiet mission's gear screen: a source and one, two or three arcs (ui/kitNoise.ts says which), as a mask the rule fills with its own colour. */
const arcs = (n: number): string => { const w = [0, 7, 10, 13][n], d = ['M4.7 1.9 A4 4 0 0 1 4.7 7.1', 'M7.3 0.6 A7 7 0 0 1 7.3 8.4', 'M10.7 0.5 A10 10 0 0 1 10.7 8.5'].slice(0, n).join(' ');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 9"><circle cx="1.6" cy="4.5" r="1.3"/><path d="${d}" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round"/></svg>`)}")`; };
const Q = '#missions.one.quiet.pane-loadout', QK = `${Q} #loadout .lo-kit`;
const QUIET_CSS = `
/* A QUIET MISSION'S GEAR SCREEN (root class 'quiet' on the Team & kit step: a quiet mission and the solo night — ui/kitNoise.ts quietGear; 'kitloud' on the
   address = the screen as it was; the maintainer, 10-17: "quiet missions should have different gear screen stuff"). THE LIGHTS ARE OUT: nothing on it is
   orange — the cursor is bright sand, Deploy is a hollow block — so the night picture beside it is the brightest thing in the window; the tiles are solid
   plates, so the room does not show through them. AND THE KIT READS BY NOISE, with no word added: a tile whose thing makes a sound when it is used wears a
   sound mark by its value — one arc in the ink for what is heard nearby, two in the alarm's amber for what the floor hears, three in its red for the blast (index.html #alarm.l1 / .l2)
   (the game's own steps, kitNoise.ts) — and a thing he carries none of sinks, so the quiet kit he has stands forward. An empty big slot is a tile like the rest. */
${Q} { --m-accent: var(--m-bright); --m-accent-hi: var(--m-bright); --m-accent-rgb: var(--m-bright-rgb); }
/* (the cursor with no orange: a 4 px bright bar where 'on' is 2 px of the soft ink, and the roster's standing bars a step dimmer, so only the cursor is bright) */
${Q} #loadout .lo-team.sel .lo-size.on, ${Q} #loadout .lo-kits.sel .lo-set.pick, ${Q} #loadout .kc.focus .kc-sets.sel .kc-set.pick { box-shadow: inset 0 -4px 0 var(--m-bright); }
${Q} #loadout .lo-slots.sel .lo-slot.pick { box-shadow: inset 0 -4px 0 var(--m-bright); }
${Q} #loadout .lo-slot.p-you { border-left-color: var(--m-soft); }
${Q} #loadout .lo-btn.primary { color: var(--m-bright); background: rgba(var(--m-edge),0.08); box-shadow: inset 0 0 0 2px var(--m-bright); }
${Q} #loadout .lo-btn.primary:hover { background: rgba(var(--m-edge),0.18); }
${Q} #loadout .lo-btn.primary.sel { box-shadow: inset 0 0 0 2px var(--m-bright), 0 0 0 2px var(--m-base), 0 0 0 4px var(--m-bright); }
${Q} #loadout .lo-slot { background: rgba(var(--m-panel-rgb),0.94); }
${Q} #loadout .lo-slot.pick, ${Q} #loadout .lo-slots.sel .lo-slot.pick, ${Q} #loadout .lo-slot.in:hover { background: rgba(var(--m-panel2-rgb),0.97); }
${QK} .kc-row { background: rgba(var(--m-panel-rgb),0.94); }
${QK} .kc-row.zero { background: rgba(var(--m-base-rgb),0.9); }
${QK} .kc-row:hover, ${QK} .kc.focus .kc-row.sel { background: rgba(var(--m-panel2-rgb),0.97); }
${QK} .kc.focus .kc-row.sel { border-left-width: 4px; padding-left: 9px; }
${QK} .kc-row.zero .kc-label, ${QK} .kc-row.zero .kc-val { opacity: 0.65; }
${QK} .kc-row.zero:hover .kc-label, ${QK} .kc-row.zero:hover .kc-val, ${QK} .kc.focus .kc-row.zero.sel .kc-label, ${QK} .kc.focus .kc-row.zero.sel .kc-val { opacity: 0.9; }
@media (min-width: 1181px) { ${QK} .kc-row[data-field="big"].zero { grid-column: auto; grid-template-columns: 48px minmax(0, 1fr); padding-top: 8px; padding-bottom: 8px; } ${QK} .kc-row[data-field="big"].zero .kc-ico { height: 32px; } }
@media (max-width: 1180px) { ${QK} .kc-row[data-field="big"].zero { grid-column: auto; } }
/* the sound mark stands after the VALUE (the name's line is cut with an ellipsis in a narrow tile and holds the arrows; the value's is the tile's own and its type is the larger) */
${QK} .kc-row:not([data-noise="0"]) .kc-val::after { content: ''; display: inline-block; height: 14px; margin-left: 10px; vertical-align: -1px; background: var(--m-soft); -webkit-mask: var(--arcs) no-repeat 0 0 / 100% 100%; mask: var(--arcs) no-repeat 0 0 / 100% 100%; }
${QK} .kc-row[data-noise="1"] .kc-val::after { width: 10.9px; --arcs: ${arcs(1)}; }
${QK} .kc-row[data-noise="2"] .kc-val::after { width: 15.6px; --arcs: ${arcs(2)}; }
${QK} .kc-row[data-noise="3"] .kc-val::after { width: 20.2px; --arcs: ${arcs(3)}; }
${QK} .kc-row[data-noise="2"]:not(.zero) .kc-val::after { background: #f3c86a; }   /* (the colour is spent on what he CARRIES: a thing he has none of keeps its arcs in the ink) */
${QK} .kc-row[data-noise="3"]:not(.zero) .kc-val::after { background: #ff7a5c; }
`;
function styles() { menuTheme(); if (document.getElementById?.('startpage-css')) return; const s = document.createElement('style'); s.id = 'startpage-css'; s.textContent = CSS + QUIET_CSS; (document.head ?? document.body)?.appendChild?.(s); }
function el(tag: string, cls?: string, text?: string) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

export type Pane = 'list' | 'loadout';
export interface StartPage { readonly missions: MissionsScreen; readonly loadout: LoadoutScreen | null; readonly pane: Pane; /** how many rows on top are the short list's, outside every group (0 in the groups; the short list's length under ?nogroups) */ readonly first: number;
  setPane(p: Pane): void; /** the query string Deploy loads the highlighted mission's own team with (the loadout puts the size on it) */ baseOf(m: Mission): string; close(): void }
let page: StartPage | null = null;
/** the one page, while it is up */
export function startPage(): StartPage | null { return page && currentMissions() === page.missions ? page : null; }
/** the page is this build's way in on this URL: the switch is on and the URL names nothing to play */
export function startPageWanted(search: string = typeof location !== 'undefined' ? location.search ?? '' : ''): boolean { return START_PAGE.on && !namesMission(search); }

/** the rows in the page's order: the list's groups in their order, each mission once, and INSIDE a group the short list's missions first, in play order,
 *  then the rest in the list's own (`first` 0: no row stands outside a group). ?nogroups (GROUPS_UI.on false): the short list's missions on top, in play
 *  order, then every other mission in the list's own order — `first` = how many are on top */
export function startPageList(all: Mission[] = listedMissions(), picks: Pick[] = PICKS): { list: Mission[]; first: number } {
  if (!PICKS_UI.on) return { list: all, first: 0 };
  const ids = [...new Set(picks.map(p => p.mission))];
  if (GROUPS_UI.on) { const at = (m: Mission) => all.findIndex(x => x.group === m.group), rank = (m: Mission) => { const k = ids.indexOf(m.id); return k < 0 ? ids.length : k; };   // (a group's place = where its first row stands in `all`, which is in group order)
    return { list: all.map((m, i) => ({ m, i })).sort((a, b) => at(a.m) - at(b.m) || rank(a.m) - rank(b.m) || a.i - b.i).map(x => x.m), first: 0 }; }   // (`all` comes with each group's unplayed rows already last — ui/missions.ts missionList; the short list's rows go in front of both halves)
  const top = ids.flatMap(id => all.filter(m => m.id === id));
  return { list: [...top, ...all.filter(m => !top.includes(m))], first: top.length };
}
/** the short list's row for a mission (its first, where two rows start the same mission) */
export function pickOfMission(id: string, picks: Pick[] = PICKS): Pick | null { return PICKS_UI.on ? picks.find(p => p.mission === id) ?? null : null; }

export interface StartPageOpts { /** the row to open on */ select?: string; /** the words on the button back to the card behind (absent: the start card's — its controls and sandbox row) */ backLabel?: string; /** where the keys start */ pane?: Pane; /** the team size the loadout opens on for that row */ squad?: SquadSize; root?: HTMLElement }
/** THE PAGE, up (again: the one already up is closed first). Null where the layer is not on the page. */
export function openStartPage(opts: StartPageOpts = {}): StartPage | null {
  page?.close();
  const root = opts.root ?? document.getElementById('missions'); if (!root) return null;
  styles();
  const search = typeof location !== 'undefined' ? location.search ?? '' : '';
  const { list, first } = startPageList(listedMissions(undefined, opts.select));   // (a cut row the visit names — ?loadout=<id> — is drawn this once: ui/missions.ts listedMissions)
  const squads = new Map<string, SquadSize>(); if (opts.select && opts.squad !== undefined) squads.set(opts.select, opts.squad);
  let pane: Pane = 'list', L: LoadoutScreen | null = null, mounted = '', shut = false, ready = false;
  let M!: MissionsScreen;   // (set by the call below; nothing here reads it before `ready`)
  let lastId: string | null = null, lastHour: HourId | null = null, settling = false;
  let playerHour: HourId | null = null;   // (the hour the page stood at before a short-list row put its own on — null: the hour on the row IS the player's)
  const host = el('div', 'onehost'), tip = el('div', 'mtip');
  // THE COLUMN WHERE THE MISSION LIST WAS, on the Team & kit step: the team at the mission's own door, the real renderer's picture (ui/kitView.ts) — and nothing
  // else. The standing man (ui/kitFigure.ts) is not on the page any more (the maintainer, 10-20: "we show the original gear screen before the new one fades
  // in. let's just remove the old one with the figure?" — he stood in while the picture booted, and wherever a level stages none): the column waits EMPTY
  // for the picture and stays empty where there is none. He is mounted, and drawn, only under `?oldfigure` (KIT_VIEW.on off: no picture, the page as it was).
  const figHost = el('div', 'onefig'); let fig: KitFigure | null = null, kview: KitViewFrame | null = null;
  // THE KIT STEP'S BRIEF AND ITS WALKTHROUGH (ui/kitBrief.ts `?kitbrief=0`, ui/kitGuide.ts `?kitguide=0`): the job, the map and what the place asks stay in
  // sight over the kit, and a first visit is walked through the step row by row. Both are this page's alone; each is null with its switch off.
  let kbrief: KitBrief | null = null, kguide: KitGuide | null = null;
  const guideOn = () => (pane === 'loadout' && L?.open ? L : null);
  const paintFigure = (s: LoadoutScreen) => { if (shut || !kview) return; if (pane !== 'loadout' || s !== L) { kview.show(null); fig?.show(null); return; }
    if (kview.show({ search: s.search(), kind: s.entry.kind, level: s.entry.level, way: ready ? M.way : 0, squad: s.squad, member: s.member, row: s.card?.at() ?? -1 }) || !fig) { fig?.show(null); return; }   // (where the mission's level stages it: the team at its way-in door, the real renderer's picture — ui/kitView.ts; `?oldfigure` = the standing man everywhere)
    const k = s.entry.kind; fig.show({ member: s.member, squad: s.squad, suit: LOOK.on && LOOK.suit && (k === 'quiet' || k === 'solo'), look: LOOK.on && placeOfQuery(new URLSearchParams(s.search().replace(/^[^?]*\?/, ''))), card: s.worn(), hour: ready ? M.startHour : undefined, cloud: !ready ? 0 : snowLevel(s.entry.level?.replace(/\.json$/, '')) ? WEATHER_PRESETS.snow.cloud : M.startWeather ? WEATHER_PRESETS[M.startWeather].cloud : 0 }); };   // (he stands in the light of the hour the mission is set for, under the cloud of its weather: a snow level's own, whatever the hidden pick remembers)

  /** the short list's settings are what the page shows for `m`: its pick, else null */
  const asPick = (m: Mission): Pick | null => { const p = pickOfMission(m.id); if (!p) return null; const d = quietFogAside(() => leversMixed() ? leversBase() : difficultyNow());   // (levers moved to a mix of their own: the level they stand over)
    return (!pickEntry(p) || d === (p.difficulty ?? 'standard') || (!p.oneDifficulty && (d === 'standard' || d === 'hard'))) && M.hourNow === (p.hour ?? 'night') && M.weather === (p.weather ?? null) && !/[?&]way=/.test(M.hrefOf(m)) ? p : null; };   // (a way in picked on the sheet is not the short list's: the row's own link carries it)
  const baseOf = (m: Mission): string => { const p = asPick(m), d = quietFogAside(() => leversMixed() ? leversBase() : difficultyNow()), h = p && pickHref(p, search, undefined, undefined, pickEntry(p) && (d === 'standard' || d === 'hard') ? d : undefined); return h ? quietFogAside(() => leversHref(h)) : M.hrefOf(m); };
  const WHAT: Record<Pane, string> = { list: 'W S mission · Enter team and kit · Esc back', loadout: 'W S A D change · Enter deploy · Esc back' };
  // the Mission step's own block, on the loadout's bar after its Deploy: the way the page draws him is mission, then team and kit, then Deploy
  const next = el('button', 'lo-btn sp-next', 'Team & kit ›'); next.setAttribute('type', 'button'); next.setAttribute('data-act', 'kit');
  next.addEventListener('click', () => { setPane('loadout'); mount(); });
  const say = () => { const bar = host.querySelector?.('[data-row="actions"]') as HTMLElement | null; if (!bar) return;
    bar.setAttribute('data-what', (pane === 'loadout' && KIT_CLIP.on && L?.card ? WHAT.loadout.replace('change', 'change · C copy · V paste') : WHAT[pane]).replace('Esc back', pane === 'loadout' && kbrief?.map ? 'M map · Esc back' : 'Esc back')); if (next.parentElement !== bar) bar.appendChild(next);   // (copy and paste of a man's kit — ui/kitCard.ts KIT_CLIP — where there are cards to copy)
    root.classList.toggle('nokit', !!L && kitAsIssued(L.entry)); root.classList.toggle('quiet', !!L && quietGear(L.entry.kind, search)); };
  const steps: [Pane, HTMLElement][] = [];
  const setPane = (p: Pane) => { const was = pane; pane = p; root.classList.toggle('pane-loadout', p === 'loadout'); root.classList.toggle('pane-list', p === 'list');
    for (const [k, b] of steps) { b.classList.toggle('on', k === p); if (k === p) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }
    if (was !== p) kbrief?.setBig(false);
    if (was !== p && sheetEl) sheetEl.scrollTop = 0;   // (the sheet folds or unfolds under the keys: it is read from its top again)
    L?.paint(); say(); paintTeam(); };
  // SETUP (the calm pass): the list's own setting rows — Difficulty with its three levers, Hour, Weather, Way in — stay the list's (it paints them, its keys
  // step them) but are parked out of sight; the rail shows each as ONE row with its value. A click on a row is the next value (on its ‹, the one before),
  // done by pressing the list's own button, so every rule about what a setting may be is still the list's. The sentence of the row last changed or pointed
  // at is the one line at the rail's foot; a mission just come up says the short list's line there.
  interface Val { src: HTMLElement; label: string; hint: string; lever: boolean; btn: HTMLElement; lab: HTMLElement; kb: HTMLElement; val: HTMLElement; sig: string; lit: ReturnType<typeof setTimeout> | null }
  const vals: Val[] = []; let sheetEl: HTMLElement | null = null, acting: Val | null = null, armed: Val | null = null, base: [string, string] = ['', ''];
  const csum = el('span', 'mcsum'), railHead = el('div', 'mrl', 'Setup'), rule = el('div', 'mrule'), read = el('div', 'mread'), readLab = el('i'), readBody = el('p'); read.append(readLab, readBody); read.setAttribute('aria-live', 'polite');
  const team = el('button', 'mval mteam'), teamVal = el('b'); team.setAttribute('type', 'button'); team.append(el('i', undefined, 'Team & kit'), teamVal, el('span', 'chev', '›'));
  const rowLive = (r: HTMLElement) => !r.classList.contains('na') && r.style.display !== 'none';
  const rowLit = (r: HTMLElement) => r.querySelector?.('.dbtn.on')?.textContent ?? '';
  const rowNote = (r: HTMLElement | null) => r?.querySelector?.('.dn')?.textContent ?? '';
  const tell = (label: string, text: string) => { readLab.textContent = text ? label : ''; readBody.textContent = text; };
  /** the readout's own line (the mission's note, or the row last changed): what it goes back to when the pointer leaves a row */
  const rest = (label: string, text: string) => { base = [label, text]; tell(label, text); };
  const choices = (r: HTMLElement) => (Array.from(r.querySelectorAll?.('.dbtn') ?? []) as HTMLButtonElement[]).filter(b => b.style.display !== 'none' && !b.disabled);
  const stepVal = (v: Val, dir: number) => { const bs = choices(v.src); if (bs.length < 2 && bs[0]?.classList.contains('on')) return;
    const i = bs.findIndex(b => b.classList.contains('on')), n = i < 0 ? (dir > 0 ? 0 : bs.length - 1) : (i + dir + bs.length) % bs.length;
    if (i < 0 && !v.lever && armed !== v && bs[n]) { armed = v; const to = bs[n].textContent ?? ''; v.val.textContent = `Custom → ${to}`; v.btn.classList.add('armed'); tell(v.label, `Press again for ${to}`); return; }   // (a level over levers moved by hand: one press would throw the mix away, so the first only says so)
    armed = null; acting = v; try { bs[n]?.click(); } finally { acting = null; } };
  const paintTeam = () => { teamVal.textContent = L ? sizeWords(L.squad) : ''; };
  /** the rail read off the rows as the list just painted them (`fresh`: another mission came up — nothing was 'last changed') */
  const paintVals = (fresh: boolean) => {
    const said: string[] = [], changed: Val[] = [], level = vals.some(v => !v.lever && v.hint === 'A D' && rowLive(v.src));
    for (const v of vals) {
      const live = rowLive(v.src); v.btn.hidden = !live;
      if (fresh && v.lit) { clearTimeout(v.lit); v.lit = null; v.btn.classList.remove('touched'); }
      if (fresh) armed = null;
      if (!live) { v.sig = ''; continue; }
      const lit = rowLit(v.src), text = lit || 'Custom', moved = v.src.classList.contains('moved'), own = !v.lever || !level;   // (a mission whose level row does nothing but one lever does: that lever stands as a row of its own)
      v.lab.textContent = v.lever ? v.src.querySelector?.('.dl')?.textContent ?? v.label : v.label; v.kb.textContent = v.lever ? '' : v.hint;
      v.val.textContent = text; v.btn.classList.toggle('moved', moved); v.btn.classList.toggle('solo', v.lever && !level); v.btn.classList.toggle('long', text.length > 13); v.btn.classList.toggle('custom', !lit && !v.lever); v.btn.classList.remove('armed'); v.btn.title = rowNote(v.src);
      v.btn.setAttribute('aria-label', `${v.lab.textContent}: ${text}`);
      if (!fresh && v.sig && v.sig !== `=${lit}`) changed.push(v);
      v.sig = `=${lit}`; if (own || moved) said.push(v.lever ? `${v.lab.textContent} ${text}` : text);
    }
    const who = acting && changed.includes(acting) ? acting : changed.find(v => !v.lever) ?? changed[0];   // (a level picked moves its levers with it, a lever moved turns the level to Custom: the row the hand was on speaks)
    if (who) { for (const v of vals) if (v !== who && v.lit) { clearTimeout(v.lit); v.lit = null; v.btn.classList.remove('touched'); }   // (one row at a time is 'just changed')
      rest(who.lab.textContent ?? '', rowNote(who.src)); who.btn.classList.add('touched'); if (who.lit) clearTimeout(who.lit); who.lit = setTimeout(() => { who.lit = null; who.btn.classList.remove('touched'); }, 1500); }
    const any = vals.some(v => !v.btn.hidden); railHead.hidden = !any; rule.hidden = !any;
    csum.textContent = said.join(' · ');
  };
  /** the highlighted mission's loadout, in the sheet (again when the mission or what its link carries changed; the size picked for a mission is kept while the page is up) */
  const mount = () => {
    if (shut) return;
    const m = M.selected, base = baseOf(m), key = `${m.id}|${base}`;
    if (L?.open && mounted === key) return;
    if (L) { squads.set(L.entry.id, L.squad); L.close(); }
    mounted = key;
    const p = asPick(m), row = pickOfMission(m.id);   // (a short-list row opens at the ROW's team size — 'you + four' — until a size is picked on the page)
    L = openLoadout(entryOfMission(m), { host, embedded: { keys: () => !shut && pane === 'loadout', key: (code, repeat) => !!kbrief?.key(code, repeat), rest: (code, repeat) => !!kguide?.key(code, repeat) }, search: base, squad: squads.get(m.id) ?? (row && pickEntry(row) ? pickSquad(row) as SquadSize : undefined),
      back: toList, onPaint: s => { paintFigure(s); if (s === L) { say(); kguide?.paint(guideOn()); } },   // (embedded.key: the map's M, and the keys that put it back while it is large; embedded.rest: the walkthrough's Esc and Enter, after the highlighted row has had its say · say: the key line names copy and paste only while there are cards — a mission's own issue takes them away after the screen is up)
      onDeploy: to => { kguide?.deployed(); kview?.close(); kview = null; try { globalThis.localStorage?.setItem('twopointsix.mission', m.id); } catch { /* no store */ }   // (the row the page opens on next time, however it was deployed)
        if (p && pickOfQuery(to)) notePicked(p); count.textContent = 'loading…'; } });   // (played = started AS the short list's row: a team size of the player's own is not it)
    say(); paintTeam(); paintFigure(L); kguide?.paint(guideOn());
  };
  /** out of the kit, back on the rows (Esc there, the Mission step): the size picked is kept for the mission */
  const toList = () => { if (L) squads.set(L.entry.id, L.squad); setPane('list'); mount(); };
  const onPaint = () => {
    if (settling || shut) return;
    const m = M.selected, p = pickOfMission(m.id), fresh = m.id !== lastId;
    if (m.id === lastId) { if (lastHour !== null && M.hourNow !== lastHour) playerHour = null; }   // (H, or a click on the Hour row, on the same mission: that hour is the player's from here on)
    else { const mine = playerHour ?? M.hourNow, own = p ? p.hour ?? 'night' : null, want = own ?? mine;   // (onto a short-list row: its own hour; off it: the player's back)
      playerHour = own !== null && own !== mine ? mine : null;
      if (M.hourNow !== want) { settling = true; M.hour(want); settling = false; } }
    lastId = m.id; lastHour = M.hourNow;
    tip.textContent = p ? p.line : '';
    if (fresh) rest('', '');
    kbrief?.show(m);
    paintVals(fresh);
    mount();
  };

  M = openMissions({ root: opts.root, list, keep: true, planPx: GROUPS_UI.on ? 640 : 1320, select: opts.select, first: PICKS_UI.on ? PICKS[0]?.mission : undefined, fold: GROUPS_UI.on, tiles: GROUPS_UI.on, heads: GROUPS_UI.on ? undefined : first > 0 && first < list.length ? { [first]: 'Every other mission' } : {},   // (the groups, folded — ui/missions.ts groupHeads / `fold`; a visit that names no row opens on the short list's first, wherever its group stands; ?nogroups = the short list on top and the one heading it had)
    onPick: () => { setPane('loadout'); mount(); },
    onPaint: () => { if (ready) onPaint(); },
    onClose: () => { shut = true; if (L?.open) L.close(); L = null; fig?.close(); fig = null; kview?.close(); kview = null; kguide?.close(); kguide = null; kbrief?.close(); kbrief = null; figHost.remove?.(); root.classList.remove('one', 'tiles', 'pane-list', 'pane-loadout', 'quiet'); MISSIONS.keysAway = null; if (page === P) page = null;
      root.removeEventListener?.('click', onClick, true); for (const v of vals) if (v.lit) clearTimeout(v.lit);
      if (playerHour !== null) try { M.hour(playerHour); } catch { /* the list is gone */ }   // (the list remembers the PLAYER's hour, not one a short-list row put on)
      setTimeout(() => { const m = document.getElementById?.('menu'), b = m?.classList.contains('on') && !m.hasAttribute('inert') ? m.querySelector?.('.actions button.primary') as HTMLElement | null : null; if (b && !currentMissions()) b.focus?.(); }, 0); } });   // (the card behind has the keys again: Enter is its 'Play ›')
  root.classList.add('one'); root.classList.toggle('tiles', GROUPS_UI.on);
  // the page's own places in the list's layer: the plan in the briefing beside the blurb, the short list's line under the blurb, the loadout at the foot of the sheet, its words on the head and the foot
  const q = <T extends HTMLElement>(sel: string) => root.querySelector?.(sel) as T | null;
  const sheet = q('.msheet'), plan = q('.mplan'), blurb = q('.mblurb'), back = q('.mback'), title = q('.mt'), foot = q('.mfoot');
  const count = q('.mcount') ?? el('div');
  if (!sheet && blurb?.parentElement) blurb.parentElement.insertBefore(tip, blurb.nextSibling);   // (with a sheet the briefing below takes it)
  // THE FRAME: the mission in the middle (its name, what it is in one line, the level's plan as a map sheet with the place's own line at its foot, its words),
  // the rail down the right (Setup, the team, the readout), the loadout across the foot. The list's setting rows are parked in a store nobody sees.
  if (sheet) {
    sheetEl = sheet;
    if (sheet.parentElement) { sheet.parentElement.insertBefore(figHost, sheet); fig = KIT_VIEW.on ? null : mountKitFigure(figHost); kview = mountKitView(root, sheet.parentElement, figHost, () => { if (L) paintFigure(L); }); }
    const brief = el('div', 'mbrief'), map = el('div', 'mmap'), rail = el('div', 'mrail'), store = el('div', 'mstore');
    const top = q('.mtop'), facts = q('.mfacts'), place = q('.mplace');
    if (top) brief.append(top, csum); if (facts) brief.appendChild(facts);
    if (plan) map.appendChild(plan); if (place) map.appendChild(place); brief.appendChild(map);
    if (blurb) brief.appendChild(blurb); brief.appendChild(tip);
    const all = Array.from(sheet.querySelectorAll?.('.mdiff') ?? []) as HTMLElement[], is = (r: HTMLElement, c: string) => r.classList.contains(c);
    rail.appendChild(railHead);
    for (const r of all) {
      const [label, hint] = is(r, 'mhour') ? ['Hour', 'H'] : is(r, 'mwx') ? ['Weather', 'J'] : is(r, 'mway') ? ['Way in', 'K'] : is(r, 'mlever') ? ['', ''] : ['Difficulty', 'A D'];
      const btn = el('button', is(r, 'mlever') ? 'mval lever' : 'mval'), lab = el('i', undefined, label), kb = el('kbd', undefined, hint), val = el('b');
      const prev = el('span', 'chev prev', '‹'), next = el('span', 'chev', '›'); for (const d of [kb, prev, next]) d.setAttribute('aria-hidden', 'true');
      btn.setAttribute('type', 'button'); btn.append(lab, kb, prev, val, next);
      const v: Val = { src: r, label, hint, lever: is(r, 'mlever'), btn, lab, kb, val, sig: '', lit: null }; vals.push(v);
      btn.addEventListener('click', e => stepVal(v, (e.target as HTMLElement | null)?.closest?.('.chev.prev') ? -1 : 1));
      const point = () => tell(v.lab.textContent ?? '', rowNote(v.src)), away = () => { if (armed === v) { armed = null; v.val.textContent = 'Custom'; v.btn.classList.remove('armed'); } tell(base[0], base[1]); };
      btn.addEventListener('mouseenter', point); btn.addEventListener('focus', point); btn.addEventListener('mouseleave', away); btn.addEventListener('blur', away);
      rail.appendChild(btn); store.appendChild(r); }
    team.addEventListener('click', () => { setPane('loadout'); mount(); });
    rail.append(rule, team, read);
    sheet.insertBefore(brief, sheet.firstChild); sheet.insertBefore(rail, brief.nextSibling); sheet.appendChild(store);
    if (GROUPS_UI.on) sheet.insertBefore(map, rail.nextSibling);   // (the tiles' cards are pictures: the map sheet stands under the rail, in the room it leaves)
    kbrief = mountKitBrief(root, sheet);
  }
  sheet?.appendChild(host);
  if (back) back.textContent = opts.backLabel ?? '‹ Main menu'; if (title) title.textContent = 'Play'; count.textContent = '';
  // the two steps, named on the head: where the keys are is the bright one, and a click on the other goes there
  let stepsBar: HTMLElement | null = null;
  if (title?.parentElement) { const bar = stepsBar = el('div', 'msteps');
    for (const [k, words] of [['list', 'Mission'], ['loadout', 'Team & kit']] as [Pane, string][]) { const b = el('button', 'mstep', words); b.setAttribute('type', 'button'); b.setAttribute('data-step', k);
      b.addEventListener('click', () => { if (pane === k) return; if (k === 'list') toList(); else { setPane('loadout'); mount(); } });
      if (steps.length) bar.appendChild(el('span', undefined, '›')); bar.appendChild(b); steps.push([k, b]); }
    title.parentElement.insertBefore(bar, title.nextSibling); }
  if (foot) foot.textContent = '';   // (the keys are on the rail's rows and on the Deploy bar now)
  kguide = mountKitGuide(root, kbrief, stepsBar);
  if (kbrief) kbrief.onChange = () => { if (shut) return; say(); kguide?.paint(guideOn()); };   // (say: the key line names M only where there is a map to open)
  MISSIONS.keysAway = () => !shut && pane === 'loadout' && !!L?.open;
  // THE MOUSE AND THE TWO STEPS. The rail's Team & kit row and the head's step marker step INTO the kit; a click on a mission row steps back out to its
  // briefing; Deploy clicked from the rows is done there and the keys stay where they were. The step is taken AFTER the click has been delivered: the sheet folds when the
  // step changes, and a fold between the press and the release would move the button out from under the cursor.
  const inHost = (t: Node | null) => !!t && !!(host as unknown as { contains?: (n: Node) => boolean }).contains?.(t);
  // a button of the sheet pressed BY THE MOUSE (a setup row, a step) does not keep the keys: Enter after it is the page's — into the kit, then Deploy — not
  // that button again. A button reached with Tab keeps its Enter (ui/missions.ts onButton), and the loadout's buttons are its own.
  const onClick = (e: Event) => { if (shut || page !== P || !((e as MouseEvent).detail > 0)) return;   // (detail 0 = pressed with a key)
    const t = e.target as HTMLElement | null, b = t?.closest?.('button') as HTMLElement | null; if (b && !inHost(b)) b.blur?.();
    const to: Pane | null = !inHost(t) && t?.closest?.('.mrow, .msec') ? 'list' : null;
    if (to && to !== pane) setTimeout(() => { if (!shut && page === P && pane !== to) toList(); }, 0); };
  root.addEventListener?.('click', onClick, true);

  const P: StartPage = { missions: M, get loadout() { return L; }, get pane() { return pane; }, first, setPane, baseOf, close() { M.close(); } };
  page = P;
  ready = true; onPaint();   // (the list's first paint ran before its screen was handed back: the loadout and the row's own hour are put on now)
  setPane(opts.pane ?? 'list');
  return P;
}
/** `?loadout=<mission id>` (`&squad=N`) while the page is the way in: the page on that mission, the keys in its loadout. Null: no flag, no such mission. */
export function startPageFromQuery(search: string | URLSearchParams): StartPage | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search, id = q.get('loadout');
  return id && missionList().some(m => m.id === id) ? openStartPage({ select: id, pane: 'loadout', squad: squadOfQuery(q, false) ?? undefined }) : null;
}
/** THE LIST, whichever this build's is: the one page, else the mission list as a screen of its own (the pause card's Missions button, 'to scenarios') */
export function openList(opts: StartPageOpts = {}) { if (START_PAGE.on) openStartPage(opts); else openMissions(); }
