// THE LOADOUT SCREEN (sortie prep, after a mission is picked and before the page load that starts it — the maintainer, 10-07: "a "loadout" screen or something like that
// for picking how many squad members you want … think like mgsv did!"): you and a slot per teammate, how many come — none to four — and DEPLOY, which loads the
// mission's own URL with the size on it (game/loadout.ts squadSearch: at the mission's own size it is the URL its row always loaded). The size, its rules, its
// words and its store are game/loadout.ts's; this file is the DOM and the keys. Plain DOM in an overlay of its own (#loadout, over the start card's #menu), its
// styles injected here, so nothing of the card is re-rendered under it and index.html is not touched.
//
// THE FLOW (wireMissions below, called once by main.ts): start card ▸ Missions (ui/missions.ts) ▸ a pick opens THIS screen for that mission (the list closes
// first; MISSIONS.onPick) ▸ Deploy loads the mission's URL — the list's own href, so the sheet's Standard | Hard rides along — with the size on it. Back / Esc
// reopens the list on the same row; Esc there is the start card. Also reached by URL: `?loadout=<mission id>` (main.ts, once the start card is up;
// `&squad=N` beside it preselects). THE SOLO NIGHT comes through here too (kind 'solo': the team row is greyed at solo, your own card is the only one) and
// Deploy loads `?solo`, where main.ts puts your card on the plain night's player (game/kit.ts kitSolo).
//
// WHAT IS ON IT, top to bottom: the mission · TEAM (the size) · the five member slots, each with its man's kit in a line — one of those who come is PICKED ·
// the picked member's KIT AND UNIFORM CARD (src/ui/kitCard.ts memberCard, the table is src/game/kit.ts), mounted in the one `[data-member="i"]` host under the
// slots (0 = you, 1‥4 = the teammates in staging order — game/loadout.ts rosterOf — which is KIT.members' order) · what the squad carries between them (stun
// canisters and door charges: kit.ts kitPool(size), the very number the run's staging sets) · Back and Deploy.
//
// CONTROLS (his rules: no held keys, no digit above 5): the mouse for everything (a click on a filled slot picks that man, on an empty one brings the team up
// to him, on a card's arrows and sets as the card says) · W S / ↑ ↓ move between rows: team → members → down through the picked man's card → the buttons ·
// A D / ← → change the highlighted row (the team size; which member; a card row's value; which button) · Enter / Space press (on the members row: into his
// card; in the card: the row's next value, or the picked set; elsewhere Deploy, unless Back is the highlighted button) · Esc back one screen, from anywhere.
// C copies the picked man's kit and V pastes the copied kit onto him, from any row (ui/kitCard.ts KIT_CLIP; Ctrl / Cmd with either is the same press while
// no text on the page is selected and no text field has the keys): pick a man, C, step along the roster, V on each. A man who wears the copied kit
// carries its mark on his chip. The two go by the letter on the key (kitCard.ts clipKey), the rest of the screen's keys by their place.
// While it is open every key is this screen's: the listener below is registered when this module loads — before main.ts's own — so Esc backs out of the screen
// instead of closing the start card under it; the card never listens for itself here (it is handed its keys: card.key).
//
// SEAMS: `loadoutHooks.memberCard` is the card's maker (the real one unless a probe swaps it; null = no cards, as under ?nokit); a SQUAD-WIDE ROW (one more
// thing the whole squad starts with — the silent order's 'start silent', say) appends its `.lo-row` to `screen.squadRows` (the empty box under the team row),
// splices a LoadoutRow into `screen.rows` after the squad-wide rows already there (index 1, or 2 under the Squad kit row) and calls `screen.paint()`. The screen's own first squad-wide row is the SQUAD KIT (under the
// pouches rule, kit.ts): a button for the issued kit and one for each of the cost table's named loadouts this build can carry — one press puts it on all
// five cards, colours kept (by the keys: A D move the pick along the row, Enter puts it on); the lit one is what the cards are now (none: a mix of your own).
import type { ScenarioEntry } from '../scene/scenarios';
import { pickSearch, levelWords, SCENARIO_KEYS } from '../scene/scenarioList';
import { MISSIONS, SOLO_NIGHT, SOLO_KEY, unplayed, missionList, missionHref, openMissions, closeMissions, issuedWalls, issuedKit, type IssuedKit, type Mission } from './missions';
import { difficultyHref, leversHref, leversMixed, leversLine, structureOfLevel } from '../game/difficulty';
import { leverRows, leversOpenOn, type LeverRowsUi } from './levers';
import { fogOfQuery, quietCamsOfLink, sameFog } from '../game/scenarioRun';
import { QUIETFOG, quietFogHref, quietFogRow, quietFogAside, soloFogRow } from '../game/quietfog';
import { STICKY } from '../game/stickycam';   // (read inside the screen only: what a quiet mission hands you — lentNow)
import { WAND } from '../game/wand';         // (likewise)
import { hourLive, hourIdOf } from '../game/hours';
import { weatherOfSearch } from '../game/weatherKinds';
import { squadChoices, squadSearch, squadOfQuery, startSize, storeSquad, rosterOf, sizeWords, kitAsIssued, lessonNote, issueNote, type SquadSize, type SquadChoice, type LoadoutKind } from '../game/loadout';
import { KIT, KIT_SOLO, SLOTS, SUITS, bigOf, kitDefault, type MemberKit, kitGun, kitRowCan, kitChanged, kitCost, kitLoadout, kitLoadoutOf, kitLoadouts, kitMission, kitIssueWhole, kitPool, kitRingsLent, kitStealthHand, kitStealthOn, kitRows, kitShown, kitSmokes, kitTeam, kitTreeOn, kitWalls, kitWords, kitWorn, squadCost } from '../game/kit';
import { memberCard, tintCss, clipWorn, clipKey, gunCanOf, KIT_CAN, KIT_CLIP, KIT_LENT, type MemberCard, type MemberCardOpts } from './kitCard';
import { menuTheme } from './theme';
import { KITDENSE } from './kitDense';
import { gunIcon, kitIcon } from './kitIcons';
import { WEAPONS, type WeaponId } from '../game/weapons';
/** the roster card's silhouette for the gun a man's card puts in his hands (kit.ts kitGun: a sidearm, the shotgun, else the rifle) */
const gunIconOf = (id: WeaponId): string => { const c = WEAPONS[id].cls; return c === 'pistol' ? 'pistol' : c === 'shotgun' ? 'shotgun' : 'rifle'; };   // (by its row's class: a row added to the table needs nothing here)
/** a roster chip's drawings (the one page): beside whatever he carries a COUNT of, these rows; and the rows whose drawing is a narrow thing, cut to a square board so a line of them starts flush */
/** a roster gun wears its can: the card's one answer (kitCard gunCanOf) — or, where the card has the two gun rows, that row's own (a pick that cannot take one is drawn bare) */
const rowCan = (i: number, m: MemberKit, f: string): boolean => (kitRows(i).some(r => r.field === 'primary') ? KIT_CAN.on && kitRowCan(i, m, f) : gunCanOf(i, m));
const CHIP_SHOWS = new Set(['weapon', 'primary', 'wand', 'big']), CHIP_NARROW = new Set(['smoke', 'bangs', 'frags', 'shells']);
const CHIP_GAP = 0.65, CHIP_IN = 0.18, CHIP_DIGIT = 0.46;   // a chip's icon row in icon heights: between two things, between a drawing and its count, one digit (startpage.ts's em values for the same)

/** what the screen preps: a scenario's row (scene/scenarios.ts ScenarioEntry fits as it is), or the solo night (`kind: 'solo'`, squad 0) */
export interface LoadoutEntry { id: string; title: string; kind: LoadoutKind; squad: number; level?: string; blurb?: string; untuned?: boolean; group?: string }
export interface LoadoutOpts {
  /** Esc / Back (after the screen has closed itself) */
  back?: () => void;
  /** Deploy, instead of the page load: the query string to load and the size (the probes; a host that loads its own way) */
  deploy?: (search: string, n: SquadSize) => void;
  /** the mission's own query string, with whatever else should ride along (absent: pickSearch(entry, location.search) at this machine's difficulty) */
  search?: string;
  /** the size to open on (absent: `?squad=N` on the page, else what was deployed last on this mission, else its own) */
  squad?: SquadSize;
  /** where the overlay is put (absent: document.body) */
  host?: HTMLElement;
  /** MOUNTED INSIDE ANOTHER SCREEN (ui/startpage.ts: in the mission list's sheet; needs `host`): the list under it is not closed, the focus is not taken
   *  or given back, and the screen takes a key only while `keys()` says the keys are its own */
  embedded?: { keys(): boolean; /** a key, before any row of the screen has it: true = it was the host's (the one starting page's map sheet — ui/kitBrief.ts) */ key?(code: string, repeat: boolean): boolean;
    /** a key the highlighted row did not take, before the screen's own Enter / Esc / W A S D: true = it was the host's (the one starting page's walkthrough — ui/kitGuide.ts: an open pop-up's Esc is the card's first) */ rest?(code: string, repeat: boolean): boolean };
  /** Deploy is about to load `search` with `n` teammates (told before the load or `deploy`; nothing is replaced) */
  onDeploy?: (search: string, n: SquadSize) => void;
  /** told at the end of every paint (the one starting page draws the picked man from it: ui/kitFigure.ts) */
  onPaint?: (s: LoadoutScreen) => void;
}
/** one keyboard row of the screen: the element that takes the highlight, and what A D and Enter do on it (absent: nothing / Deploy). A row with keys of its
 *  own (the kit card) takes them first — `key`: true = taken, false = the screen's (W / S off its edge walk on) — and is told when the highlight walks onto
 *  it (`enter`: +1 from above, −1 from below). */
export interface LoadoutRow { el: HTMLElement; change?: (dir: 1 | -1) => void; confirm?: () => void; key?: (code: string, repeat: boolean) => boolean; enter?: (dir: 1 | -1) => void }
export interface LoadoutScreen { readonly entry: LoadoutEntry; readonly root: HTMLElement; readonly squad: SquadSize; readonly open: boolean; rows: LoadoutRow[]; sel: number;
  /** the picked member (0 = you, 1‥squad), his card (null: no cards), and the box a squad-wide row is appended to */
  readonly member: number; readonly card: MemberCard | null; readonly squadRows: HTMLElement;
  /** the kit the picked member will be staged with: his kept card, or the issue card (with a mission's own fields over it) where the mission hands the kit out */
  worn(): MemberKit;
  /** the NAMED kit that is on (the Kit row's lit one — kit.ts kitLoadoutOf): '' = a mix of the player's own, or a screen with no such row */
  readonly kitName: string;
  setSquad(n: SquadSize): boolean; /** gone, with no word to anybody (Back's callback not called) */ close(): void; step(dir: 1 | -1): void; move(dir: 1 | -1): void; pick(i: number): void; pool(): { bangs: number; charges: number }; deploy(): void; back(): void; paint(): void; search(): string; key(code: string, repeat?: boolean): boolean }
/** the rows of a card whose thing only looks into the fog of war: the optical wand (game/wand.ts) and the sticky cameras (game/stickycam.ts) */
const FOG_KIT: readonly string[] = ['wand', 'cams'];
/** the member card's maker (ui/kitCard.ts memberCard; a probe may swap it, null = no cards): fills the `[data-member]` host with member i's card */
export const loadoutHooks: { memberCard: ((host: HTMLElement, i: number, opts?: MemberCardOpts) => MemberCard | void) | null } = { memberCard };

const KIND_WORDS: Record<LoadoutKind, string> = { nightbreach: 'night breach', roomclear: 'room clear', rescue: 'hostage rescue', quiet: 'quiet mission', solo: 'solo night' };
const PAIR_WORDS: Record<string, string> = { red: 'red pair', blue: 'blue pair' };
let current: LoadoutScreen | null = null;
/** the screen up is mounted inside another (LoadoutOpts.embedded): whether the keys are its own right now (null: a screen of its own — always) */
let currentKeys: (() => boolean) | null = null;
/** the screen that is up (null: none) */
export function loadoutOpen(): LoadoutScreen | null { return current; }
/** the screen that is up goes, silently: nobody's Back is called (the mission list opening over it, the boot card going, the start card closing) */
export function closeLoadout() { current?.close(); }

function el(tag: string, cls?: string, text?: string) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

/** Open the loadout screen for a mission. One at a time: a screen already up is closed first. */
export function openLoadout(entry: LoadoutEntry, opts: LoadoutOpts = {}): LoadoutScreen {
  closeLoadout(); if (!opts.embedded) closeMissions();   // (one screen at a time over the card: this one. Silently — the old screen's Back would reopen the list under the new one)
  injectStyle();
  const choices = squadChoices(entry);
  const own = choices.find(c => c.own)?.n ?? 2;
  const pageSearch = typeof location !== 'undefined' ? location.search ?? '' : '';
  const base = opts.search ?? (entry.kind === 'solo' ? missionHref(SOLO_NIGHT, pageSearch) : quietFogAside(() => difficultyHref(pickSearch(entry as ScenarioEntry, pageSearch))));
  const asked = opts.squad;   // (a row's click opens on what this machine deployed that mission with last, else its own size: the page's own ?squad=N is another run's)
  let squad: SquadSize = asked !== null && asked !== undefined && choices[asked].ok ? asked : startSize(entry);
  if (!choices[squad].ok) squad = (choices.find(c => c.ok)?.n ?? own) as SquadSize;
  let open = true;

  const root = el('div', 'lo'); root.id = 'loadout'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', `Loadout: ${entry.title}`);
  const shell = el('div', 'lo-card'); root.appendChild(shell);
  const card = el('div', 'lo-body'); shell.appendChild(card);   // (the rows: on a window too short for them THEY scroll — Back, Deploy and the key line under them never do)
  // the mission
  const head = el('div', 'lo-head');
  head.appendChild(el('div', 'lo-eyebrow', 'Sortie prep'));
  const title = el('div', 'lo-title', entry.title); head.appendChild(title);
  const tags = el('div', 'lo-tags');
  tags.appendChild(el('span', 'lo-tag', KIND_WORDS[entry.kind])); tags.appendChild(el('span', 'lo-tag level', levelWords(entry)));
  if (unplayed(entry)) tags.appendChild(el('span', 'lo-tag untuned', 'untuned'));   // (not on a mission the short list names — scene/picks.ts; ?nopicks = as it was)
  head.appendChild(tags);
  if (entry.blurb) head.appendChild(el('div', 'lo-blurb', entry.blurb));
  card.appendChild(head);
  // the team size: a stepper and a button per size
  const teamRow = el('div', 'lo-row lo-team'); teamRow.setAttribute('data-row', 'squad');
  teamRow.appendChild(el('div', 'lo-label', 'Team'));
  const less = el('button', 'lo-step', '◀') as HTMLButtonElement; less.type = 'button'; less.title = 'one fewer (A / ←)'; less.setAttribute('data-step', '-1');
  const words = el('div', 'lo-words');
  const more = el('button', 'lo-step', '▶') as HTMLButtonElement; more.type = 'button'; more.title = 'one more (D / →)'; more.setAttribute('data-step', '1');
  teamRow.append(less, words, more);
  const sizes = el('div', 'lo-sizes'); const sizeBtns: HTMLButtonElement[] = [];
  for (const c of choices) {
    const b = el('button', 'lo-size', c.n === 0 ? 'solo' : `+${c.n}`) as HTMLButtonElement; b.type = 'button'; b.setAttribute('data-squad', String(c.n));
    b.title = c.ok ? `${sizeWords(c.n)}${c.own ? ' — this mission\'s own' : ''}` : c.note;
    if (!c.ok) { b.setAttribute('aria-disabled', 'true'); b.classList.add('off'); }
    b.onclick = () => { S.sel = 0; S.paint(); S.setSquad(c.n); };   // (painted first: a refused size leaves its reason on the note line)
    sizeBtns.push(b); sizes.appendChild(b);
  }
  teamRow.appendChild(sizes);
  card.appendChild(teamRow);
  // THE DIFFICULTY LEVERS (ui/levers.ts, game/difficulty.ts LEVERS — the maintainer, 10-10: 'let's actually unbundle difficulty a bit'): what standard / hard
  // is made of, each its own to move before the run — fog of war (three rungs), the enemy's AI, the enemy's kit. One line of buttons under the mission's head,
  // by the mouse (the keys' rows are the team's and the kit's, as they were); the level the screen was opened on stands under them (leversOpenOn) and a
  // moved lever is kept on this machine. Not on a Training lesson (played as issued); on the solo night only the fog's, and only where it has one (QUIETFOG.solo).
  let levers: LeverRowsUi | null = null, leversBack: (touched: boolean) => void = () => { /* nothing to put back */ };
  const leverNote = el('div', 'lo-levnote');
  const quietRow = entry.kind === 'solo' ? soloFogRow() : quietFogRow(entry as ScenarioEntry);   // (a quiet mission may be played under the fog — game/quietfog.ts: the fog lever is live on its screen with a bottom rung of its own, off, and lit where a quiet mission starts — QUIETFOG.def — until it is moved; the solo night with it where QUIETFOG.solo is up: its link is read as a quiet row's)
  // NO FOG OF WAR ON THIS MISSION AS IT WOULD DEPLOY NOW (a quiet mission or the solo night with the fog lever at its bottom rung; the solo night always with QUIETFOG.solo down): the kit that only looks into
  // the fog — FOG_KIT — does nothing there, and a tile that carries one says so itself (ui/kitCard.ts `idle`). Asked live: the lever is on this screen.
  const noFog = () => !fogOfQuery(new URLSearchParams(quietFogHref(base, quietRow).replace(/^[^?]*\?/, '')));
  // WHAT THIS MISSION HANDS YOU OVER YOUR CARD, AS IT WOULD DEPLOY NOW (a quiet mission under the fog: scenarioRun.ts hands its link's sticky cameras for
  // the visit — quietCamsOfLink, the staging's own rule — to a card with the rifle, kit.ts kitPlayer; and, where quietfog.ts QUIETFOG.wand is up, an optical
  // wand with them — quietWand). Your card's tile shows it
  // (ui/kitCard.ts `lent`), where it read 'none' beside a thing you were about to be handed, and so does the kit you are drawn in (worn()). Asked live: the
  // fog lever and the Cameras row are on this screen — read once for a link and a gun, not once a tile.
  let lentKey = '', lentIs = { fog: false, n: 0, cams: 0, wand: 0 };
  const lentOf = () => { const href = quietFogHref(base, quietRow), gun = KIT.members[0]?.weapon, key = `${href}|${gun}|${STICKY.on}|${WAND.on}|${QUIETFOG.wand}`;
    if (key !== lentKey) { lentKey = key; const q = new URLSearchParams(href.replace(/^[^?]*\?/, '')), fog = fogOfQuery(q), n = fog && STICKY.on ? quietCamsOfLink(q) : 0;
      lentIs = { fog, n, cams: gun === 'rifle' ? n : 0, wand: n > 0 && WAND.on && QUIETFOG.wand ? 1 : 0 }; }
    return lentIs; };
  // (… and under the card as a tree — game/kittree.ts — its sponge rounds: a quiet mission and the solo night hand you the launcher's five over a card that carries none)
  const stealthKind = entry.kind === 'quiet' || entry.kind === 'solo';
  // (game/kit.ts KITDEAL.stealth: nothing is handed over a card — a stealth mission's kit is what your stealth card is issued as, so no tile is the mission's; the
  // screen tells the kit which mission the cards are for, as it opens and as the fog lever moves: syncHand)
  const syncHand = () => kitMission(stealthKind && kitStealthOn() ? kitStealthHand(lentOf().n, lentOf().wand > 0) : null);
  const lentNow = (f: string): number => (member !== 0 || (kitStealthOn() && cardsOn()) || kitIssueWhole(missionKit) /* (a mission's own card for you: nothing is handed over it — kit.ts ISSUE.whole) */ ? 0 : f === 'rings' ? kitRingsLent(stealthKind, KIT.members[0]) : !FOG_KIT.includes(f) ? 0 : f === 'cams' ? lentOf().cams : lentOf().wand);
  const lookSig = () => `${noFog()}|${lentNow('cams')}|${lentNow('wand')}|${lentNow('rings')}|${stealthKind && kitStealthOn() ? `${lentOf().n}|${lentOf().wand}` : ''}`;
  let fogWas = '';   // (set where the first card is mounted: `member` is not there yet)
  const paintLevers = () => { if (!levers) return; levers.paint(key => (key === 'fog' ? quietRow || fogOfQuery(new URLSearchParams(base.replace(/^[^?]*\?/, ''))) : entry.kind !== 'quiet' && entry.kind !== 'solo'), entry.kind === 'roomclear' ? structureOfLevel(entry.level) : '', quietRow);   // (the fog lever where the mission has a fog of war — game/scenarioRun.ts; the defenders' two not on a quiet mission, whose shift is the level's own)
    leverNote.textContent = entry.kind === 'quiet' || entry.kind === 'solo' ? '' : quietFogAside(() => leversMixed() ? `Your own mix, kept on this machine: ${leversLine()}.` : ''); };   // (the kept mix is the squad levers': none of it acts on a quiet mission or the solo night, and its fog word would read against the quiet fog's row just above)
  if ((entry.kind !== 'solo' || quietRow) && !kitAsIssued(entry) && !opts.embedded) {   // (mounted inside the one starting page — ui/startpage.ts — the sheet over it carries the rows: ui/missions.ts; the solo night under the fog has the fog's lever, its other two stay greyed: the shift is the level's own)
    leversBack = leversOpenOn(base);
    const box = el('div', 'lo-levers'); box.setAttribute('data-row', 'levers');
    levers = leverRows(box, { row: 'lo-lever', label: 'lo-levl', btn: 'lo-levb', note: 'lo-levn' }, () => S.paint());
    card.appendChild(box); card.appendChild(leverNote);
  }
  const squadRows = el('div', 'lo-squadrows'); card.appendChild(squadRows);   // (EMPTY: where a squad-wide row goes — the head comment's SEAMS)
  // the squad kit: one press puts a whole loadout of the cost table on the cards (kit.ts kitLoadouts — as issued first)
  const kitsRow = el('div', 'lo-row lo-kits'); kitsRow.setAttribute('data-row', 'squadkit'); const oneList = kitTreeOn();   // (game/kittree.ts: the one list of named kits — shown, and live, for a man alone too: a card has no sets of its own but the reset)
  kitsRow.appendChild(el('div', 'lo-label', oneList ? 'Kit' : 'Squad kit')); if (oneList) kitsRow.classList.add('lo-kits-one');
  const kitBtns: { id: string; b: HTMLButtonElement }[] = []; let kitPick = 0;   // (by the keys: A D move the pick along the row, Enter puts it on — a whole squad's kit is not changed by a stray D)
  let issuedOnly = kitAsIssued(entry);   // (a Training row: played with the kit as issued whatever this machine keeps — no cards, no squad kit row, and a line saying so; game/loadout.ts)
  // …and a mission whose LEVEL FILE issues its own kit (scenarios.issue → game/kit.ts kitIssue: the run wears the issue cards with the mission's fields over them, whatever
  // this machine keeps) gets the same treatment once its file has come (the plan's own fetch — ui/missions.ts issuedKit): no cards to change, no squad kit row, the note
  // says so and each man who comes shows what the mission hands him. Not when the link this screen deploys carries ?noissue (the run then wears the kept cards)
  let missionKit: IssuedKit | null = null;
  const issueOf = (i: number) => { const c = missionKit?.[String(i)]; if (!c) return ''; const n = (k: string) => (typeof c[k] === 'number' && (c[k] as number) > 0 ? c[k] as number : 0), pl = (k: number, w: string) => (k ? `${k} ${w}${k === 1 ? '' : 's'}` : '');
    return [typeof c.weapon === 'string' ? c.weapon : '', n('bangs') ? `${n('bangs')} stun` : '', pl(n('charges'), 'charge'), pl(n('frags'), 'frag'), n('smoke') ? `${n('smoke')} smoke` : '', pl(n('walls'), 'wall charge'), pl(n('shells'), 'shell'), pl(n('rings'), 'sponge round'), pl(n('cams'), 'sticky camera'), c.wand === true ? 'optical wand' : ''].filter(Boolean).join(' · '); };
  const issueWho = () => { const R = rosterOf(squad), who: string[] = []; for (let i = 0; i <= squad; i++) { const c = missionKit?.[String(i)]; if (!c) continue; const what = c.weapon === 'shotgun' ? 'the shotgun' : ''; if (what) who.push(`${i === 0 ? 'you carry' : `${R[i - 1].name} carries`} ${what}`); } return who.join(', '); };
  const squadKits = () => (loadoutHooks.memberCard && KIT.on && SLOTS.on && (entry.kind !== 'solo' || oneList) && !issuedOnly ? kitLoadouts() : []);
  const alone = () => (oneList && !squad ? 0 : undefined);   // (a man going alone: the row is HIS kit — the kits that differ on his card, put on his card alone; kit.ts)
  const putKit = (id: string) => { const why = kitLoadout(id, alone()); mountCard(true); drawSlots(); S.paint(); if (why) { note.textContent = why; note.className = 'lo-note off'; } };
  for (const L of squadKits()) {
    const b = el('button', 'lo-set', L.name) as HTMLButtonElement; b.type = 'button'; b.setAttribute('data-kit', L.id); b.title = L.id === 'issued' ? 'give everyone their issued kit (colors kept)' : `put the ${L.name} loadout on all five cards (colors kept)`;
    b.onclick = () => { if (!squad && !oneList) return; S.sel = Math.max(0, S.rows.findIndex(r => r.el === kitsRow)); kitPick = kitBtns.findIndex(k => k.id === L.id); putKit(L.id); };
    kitBtns.push({ id: L.id, b }); kitsRow.appendChild(b);
  }
  const kitsOwn = el('div', 'lo-kits-own'); kitsRow.appendChild(kitsOwn);
  if (kitBtns.length > 1) squadRows.appendChild(kitsRow);
  const noteLine = el('div', 'lo-noteline'), note = el('div', 'lo-note'), pool = el('div', 'lo-pool'); pool.title = 'the stun canisters and door charges that the door tools use up, counted from what your teammates carry (see their cards)';
  // a mission that ISSUES its own wall charges (the level file's scenarios.roomClear.wallCharges → game/issue.ts: the bag raised to that count at every staging, whatever
  // the cards carry): the line says the larger of the two and that it is the mission's. Read off the level file the plan is drawn from; until it has come, the cards' own
  let issued = 0;
  if (entry.kind === 'roomclear' && entry.level && !issuedOnly) void issuedWalls(entry.level).then(n => { if (!n || !open) return; issued = n; pool.title += ' · this mission issues wall charges of its own, whatever the cards carry'; S.paint(); });
  const squadP = el('div', 'lo-squadp'); squadP.title = 'the pouches the teammates who come fill between them (kit.ts: the squad\'s budget; blank while the table sets none)';
  noteLine.append(note, squadP, pool); card.appendChild(noteLine);
  // the members: you and four slots; under them the picked member's kit and uniform card
  const slots = el('div', 'lo-slots'); slots.setAttribute('data-row', 'members'); card.appendChild(slots);
  const kitHost = el('div', 'lo-kit'); kitHost.setAttribute('data-row', 'kit'); card.appendChild(kitHost);
  const cardsOn = () => !!loadoutHooks.memberCard && KIT.on && !issuedOnly;
  let member = 0, kitCard: MemberCard | null = null;
  // the buttons
  const btnRow = el('div', 'lo-row lo-actions'); btnRow.setAttribute('data-row', 'actions');
  const backBtn = el('button', 'lo-btn', 'Back') as HTMLButtonElement; backBtn.type = 'button'; backBtn.setAttribute('data-act', 'back');
  const goBtn = el('button', 'lo-btn primary', 'Deploy') as HTMLButtonElement; goBtn.type = 'button'; goBtn.setAttribute('data-act', 'deploy');
  btnRow.append(backBtn, goBtn); shell.appendChild(btnRow);
  const footWords = () => (cardsOn() ? `W S move · A D change · Enter press (in a card) or deploy · ${KIT_CLIP.on ? 'C copy a kit · V paste · ' : ''}Esc back · kit is kept on this machine${SLOTS.on ? '' : (SLOTS.ok ? ' · pouches rule off (?noslots): every row is free' : ' · pouches rule off (the cost table was refused — see the console): every row is free')}` : 'W S move · A D change · Enter deploy · Esc back');
  const foot = el('div', 'lo-foot', footWords()); shell.appendChild(foot);
  let onBack = false;   // which button the buttons row's highlight is on
  let keyed = false;    // inside a key press (paint scrolls the highlighted row into sight only then)

  const nameOf = (i: number) => { const man = i === 0 ? null : rosterOf(squad)[i - 1]; return { title: i === 0 ? 'You' : man?.name ?? 'Empty', sub: i === 0 ? 'point man' : man ? (squad > 2 ? PAIR_WORDS[man.pair] : squad === 2 ? 'the pair' : 'with you') : 'stays behind' }; };
  const drawSlots = () => {
    slots.innerHTML = '';
    const R = rosterOf(squad), all = rosterOf(4);
    let widest = 1;   // (the fullest man's kit row, in icon heights: every chip draws its things at the ONE size at which that row fits — startpage.ts '.lo-ics')
    for (let i = 0; i <= 4; i++) {
      const man = i === 0 ? null : R[i - 1] ?? null, here = i === 0 || !!man, pair = man?.pair ?? (i === 0 ? 'you' : all[i - 1].pair), N = nameOf(i);
      const s = el('div', `lo-slot ${here ? 'in' : 'out'} p-${here ? pair : 'none'}`); s.setAttribute('data-slot', String(i));
      const fig = el('div', 'lo-fig'); fig.innerHTML = FIGURE; s.appendChild(fig);
      const name = el('div', 'lo-name', N.title); s.appendChild(name);
      s.appendChild(el('div', 'lo-role', N.sub));
      if (here && cardsOn()) {   // his kit in a line, and his suit on the figure (kit.ts: the table the card under the slots changes)
        const m = kitShown(i); if (m.suit !== 'issued') fig.style.color = tintCss(SUITS[m.suit].tint);
        name.classList.toggle('changed', kitChanged(i)); { const g = el('div', 'lo-gun'); g.innerHTML = gunIcon(gunIconOf(kitGun(m)), rowCan(i, m, m.weapon === 'pistol' ? 'secondary' : 'primary'), kitGun(m)); s.appendChild(g); } s.appendChild(el('div', 'lo-sum', kitWords(i)));
        { const ics = el('div', 'lo-ics'), K = m as unknown as Record<string, unknown>;   // (the same kit as drawings: the one page shows these in place of the words)
          let wide = 0;
          for (const r of kitRows(i)) { const f = r.field === 'primary' && m.weapon === 'pistol' ? 'secondary' : r.field;   // (no long gun brought: his sidearm is the gun the chip draws)
            const v = r.field === 'big' ? (bigOf(m) === 'none' ? null : bigOf(m)) : K[f]; if (v === 0 || v === false || v == null || v === 'none' || !(typeof v === 'number' || CHIP_SHOWS.has(r.field))) continue; const I = kitIcon(f, v, (f === 'weapon' || f === 'primary' || f === 'secondary') && rowCan(i, m, f)); if (!I.svg) continue;   // (what differs from man to man: his gun, what he carries a count of, the wand)
            const narrow = CHIP_NARROW.has(r.field), c = el('span', narrow ? 'lo-ic n' : 'lo-ic'); c.innerHTML = narrow ? I.svg.replace('viewBox="0 0 64 32"', 'viewBox="16 0 32 32"') : I.svg; c.title = r.label; if (typeof v === 'number') c.appendChild(el('b', undefined, String(v)));
            wide += (ics.childElementCount ? CHIP_GAP : 0) + (narrow ? 1 : 2) + (typeof v === 'number' ? CHIP_IN + CHIP_DIGIT * String(v).length : 0); ics.appendChild(c); }
          widest = Math.max(widest, wide); s.appendChild(ics); }
        if (SLOTS.on) { const c = kitCost(i); s.appendChild(el('div', 'lo-pouch', `pouches ${c.used} / ${c.total}`)); }   // (kit.ts: what he carries of the tools and the throwables comes out of his pouches)
        if (clipWorn(i)) { s.classList.add('clip'); const c = el('span', 'lo-clip'); c.innerHTML = CLIP_MARK; c.title = 'wears the copied kit'; s.appendChild(c); }   // (the man copied from, and each man it was pasted onto — or who wears the same anyway)
        s.classList.toggle('pick', i === member); s.title = `${N.title}: kit and uniform`;
        s.onclick = () => { S.sel = Math.max(0, S.rows.findIndex(r => r.el === slots)); S.pick(i); };
      } else if (here && i > 0) {   // (no cards — ?nokit, a lesson, a mission's own issue: a click on a man who comes sends him, and those after him, home)
        s.title = `fewer: ${sizeWords(i - 1)}`; s.onclick = () => { S.sel = 0; S.paint(); S.setSquad((i - 1) as SquadSize); };
        if (missionKit) s.appendChild(el('div', 'lo-sum', issueOf(i) || 'as issued'));
      } else if (here && missionKit) { s.appendChild(el('div', 'lo-sum', issueOf(i) || 'as issued'));   // (you, on a mission that issues its own kit)
      } else if (!here) {
        s.title = choices[i].ok ? `more: ${sizeWords(i)}` : choices[i].note;   // (a size, not a man: the roster of two is the blue pair, of three or four the red pair first)
        s.onclick = () => { S.sel = 0; S.paint(); S.setSquad(i as SquadSize); };
      }
      slots.appendChild(s);
    }
    slots.style.setProperty?.('--u', (widest * 1.03).toFixed(2));   // (?.: the headless probes' fake DOM has a bare style object)
  };
  /** the picked member's card, made afresh (his name is the size's: 'Blue One' of a pair is 'Red One' of a four); the highlighted row is kept */
  const mountCard = (keep = false) => {   // (`keep`: the same man's card made again — its highlighted row stays; another man's card opens on its first row: the two kinds of card have different rows)
    const at = keep ? kitCard?.at() ?? 0 : 0; kitCard?.destroy(); kitCard = null; kitHost.innerHTML = ''; kitHost.setAttribute('data-member', String(member));
    if (!cardsOn()) { kitMission(null); return; }   // (no card to change: the staging wears the issue with the mission's kit handed over it, as it was)
    try {
      syncHand(); fogWas = lookSig();
      kitCard = loadoutHooks.memberCard!(kitHost, member, { name: nameOf(member), idle: f => FOG_KIT.includes(f) && noFog(), lent: lentNow, dense: KITDENSE.on && !!opts.embedded, floor: () => btnRow.getBoundingClientRect?.().top ?? 0,   // (the dense card — ui/kitDense.ts — is the one starting page's: the older screen of its own keeps its list; its pop-ups end over this screen's foot)
        onChange: () => { fogWas = lookSig(); drawSlots(); S.paint(); },   // (the card has just drawn itself with what the change moved — his gun, say, and with it the cameras he is handed: no second draw for it)
        onCopy: () => drawSlots(),   // (the roster's marks move to whoever wears the copied kit; no card changed, so nothing is painted or told on)
        onSelect: () => opts.onPaint?.(S),   // (ui/kitView.ts: the picture plays the highlighted tile's thing — told of a move, which changes no value)
        onFocus: () => { const k = S.rows.findIndex(r => r.el === kitHost); if (k >= 0 && S.sel !== k) { S.sel = k; S.paint(); } } }) ?? null;
      kitCard?.go(at);
    } catch (e) { console.error('loadout: memberCard', e); }
  };
  const stepTo = (dir: 1 | -1): SquadSize | null => { for (let n = squad + dir; n >= 0 && n <= 4; n += dir) if (choices[n].ok) return n as SquadSize; return null; };

  const S: LoadoutScreen = {
    entry, root, rows: [], sel: 0, squadRows,
    get squad() { return squad; }, get open() { return open; }, get member() { return member; }, get card() { return kitCard; }, get kitName() { return kitBtns.length > 1 ? kitLoadoutOf(alone()) ?? '' : ''; },
    worn() { const card = (j: number) => { const k = missionKit?.[String(j)]; return k ? { ...kitDefault(j), ...k } as MemberKit : issuedOnly || !KIT.on || !KIT.members[j] ? kitDefault(j) : KIT.members[j]; }, w = (missionKit || issuedOnly || !KIT.on ? kitWorn(squad, KIT.members.map((_c, j) => card(j))) : kitWorn(squad))[member];   // (as the staging will have him: kit.ts KITDEAL shares a named kit out over three or four)
      const cams = KIT_LENT.on ? lentNow('cams') : 0, wand = KIT_LENT.on && lentNow('wand') > 0;   // (… and what the mission hands him over it: the man drawn beside the card carries what the tile says he will have)
      return cams > w.cams || (wand && !w.wand) ? { ...w, cams: Math.max(w.cams, cams), wand: w.wand || wand } : w; },
    setSquad(n) { const c: SquadChoice | undefined = choices[n]; if (!c || !c.ok) { note.textContent = c?.note ?? ''; note.className = 'lo-note off'; return false; } const was = squad; squad = n; if (was !== n) { kitTeam(n); const same = member <= n; member = Math.min(member, n); mountCard(same); drawSlots(); } S.paint(); return true; },
    step(dir) { const n = stepTo(dir); if (n !== null) S.setSquad(n); },
    move(dir) { const n = S.rows.length, drawn = (k: number) => (S.rows[k].el as unknown as { offsetParent?: unknown }).offsetParent !== null;   // (a row the page it sits in does not draw — the one starting page hides Squad kit for a man alone — is stepped over)
      let k = S.sel; for (let i = 0; i < n; i++) { k = (k + dir + n) % n; if (drawn(k)) break; }
      S.sel = k; S.rows[S.sel].enter?.(dir); S.paint(); },
    pick(i) { const to = Math.min(squad, Math.max(0, Math.round(i))); if (to !== member) { member = to; mountCard(); drawSlots(); } S.paint(); },
    pool: () => kitPool(squad),
    close,
    search: () => squadSearch(quietFogHref(quietFogAside(() => leversHref(base)), quietRow), squad, own),   // (a lever moved by hand: the link carries it only where this machine could not keep it — game/difficulty.ts)
    deploy() {
      if (!open || !choices[squad].ok) return;
      storeSquad(entry.id, squad);
      const to = S.search(); close(); opts.onDeploy?.(to, squad);
      if (opts.deploy) { opts.deploy(to, squad); return; }
      // the solo night off the real start card over the plain night: Start, as it has always been — no load (ui/missions.ts's own shortcut, taken here now that
      // this screen stands between the list and the run); the card's Start puts your kit on the player (main.ts onStart → kitFresh)
      if (entry.kind === 'solo' && MISSIONS.startSolo && hourIdOf(new URLSearchParams(to).get('hour')) === hourLive() && weatherOfSearch(to) === weatherOfSearch(pageSearch) && !SCENARIO_KEYS.some(k => k !== SOLO_KEY && new URLSearchParams(pageSearch).has(k)) && sameFog(to, pageSearch)) { KIT_SOLO.on = true; MISSIONS.startSolo(); return; }   // (…at the hour and in the weather the page stands at — game/hours.ts, game/weatherKinds.ts: another of either is a load — and in the fog it stands in: the solo night under the fog off a plain page is a load of its own link, game/quietfog.ts QUIETFOG.solo)
      const url = location.pathname + to + location.hash;
      if (url === location.pathname + location.search + location.hash) location.reload(); else location.assign(url);
    },
    back() {
      if (!open) return; close();
      try { const q = new URLSearchParams(location.search); if (q.has('loadout')) { q.delete('loadout'); const s = q.toString().replace(/=(?=&|$)/g, ''); history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } } catch { /* no history here (a probe, a sandboxed frame): the flag stays */ }
      opts.back?.();
    },
    paint() {
      const c = choices[squad];
      words.textContent = sizeWords(squad);
      const said = c.note || (c.own ? 'This mission\'s own team.' : ''); note.textContent = missionKit ? issueNote(said, issueWho()) : issuedOnly ? lessonNote(said) : said; note.className = 'lo-note';
      sizeBtns.forEach((b, n) => { b.classList.toggle('on', n === squad); b.classList.toggle('own', choices[n].own); b.setAttribute('aria-pressed', n === squad ? 'true' : 'false'); });
      less.disabled = stepTo(-1) === null; more.disabled = stepTo(1) === null;
      const sq = cardsOn() ? squadCost() : null; squadP.textContent = squad && sq ? `Squad pouches ${sq.used} / ${sq.total}` : '';
      const P = kitPool(squad), own = kitWalls(squad), W = Math.max(own, issued), sm = kitSmokes(squad), walls = W ? `${W} wall charge${W === 1 ? '' : 's'}${issued > own ? ' (issued for this mission)' : ''}` : '';
      pool.textContent = issuedOnly ? (missionKit && issued ? `${squad ? 'Squad carries' : 'You carry'} · ${issued} wall charge${issued === 1 ? '' : 's'} (issued for this mission)` : '') : squad ? `Squad carries · ${P.bangs} stun · ${P.charges} charge${P.charges === 1 ? '' : 's'} · ${P.frags} frag${P.frags === 1 ? '' : 's'}${walls ? ` · ${walls}` : ''}${sm ? ` · ${sm} smoke` : ''}` : issued ? `You carry · ${walls}` : '';   // (smoke: named only when a card carries one — squadsmoke.ts)
      if (kitBtns.length > 1) { const now = kitLoadoutOf(alone()), mine = alone() === undefined ? null : new Set(kitLoadouts(0).map(l => l.id)); if (mine && !mine.has(kitBtns[kitPick].id)) kitPick = 0;
        kitBtns.forEach((k, n) => { k.b.style.display = mine && !mine.has(k.id) ? 'none' : ''; k.b.classList.toggle('on', k.id === now); k.b.classList.toggle('pick', n === kitPick && (squad > 0 || oneList)); k.b.setAttribute('aria-pressed', k.id === now ? 'true' : 'false'); k.b.disabled = !squad && !oneList; }); kitsOwn.textContent = !squad && !oneList ? 'you\'re going alone, so there\'s no squad to equip' : now ? '' : 'a mix of your own'; }
      paintLevers();
      { const nf = lookSig(); if (nf !== fogWas) { fogWas = nf; if (cardsOn()) { syncHand(); drawSlots(); } kitCard?.refresh(); } }   // (the optical wand and the sticky cameras look into the fog of war: on a mission without one a tile that carries one says 'no use here' — the card's own `idle` — and it can still be carried; the fog lever moved = the card drawn again)
      S.rows.forEach((r, i) => r.el.classList.toggle('sel', i === S.sel));
      if (keyed) { if (S.sel === 0) (card as unknown as { scrollTop: number }).scrollTop = 0; (S.rows[S.sel]?.el as unknown as { scrollIntoView?: (o: unknown) => void } | undefined)?.scrollIntoView?.({ block: 'nearest' }); }   // (a short window scrolls the rows: the highlighted row is kept in sight, the first row with the mission's head over it — by the KEYS only: a click's focus that scrolled the rows moved the button from under the cursor and lost the click)
      if (kitCard) { if (S.rows[S.sel]?.el === kitHost) kitCard.focus(); else kitCard.blur(); }   // (the card's own highlight shows only while the keys are in it)
      backBtn.classList.toggle('sel', S.rows[S.sel]?.el === btnRow && onBack); goBtn.classList.toggle('sel', S.rows[S.sel]?.el === btnRow && !onBack);
      goBtn.textContent = `Deploy · ${sizeWords(squad)}`;
      opts.onPaint?.(S);
    },
    key(code, repeat = false) { if (!open) return false; keyed = true; try { return keys(code, repeat); } finally { keyed = false; } },
  };
  const keys = (code: string, repeat: boolean): boolean => {
      if (code && opts.embedded?.key?.(code, repeat)) return true;
      const row = S.rows[S.sel];
      if (row?.key?.(code, repeat)) return true;
      if (code && opts.embedded?.rest?.(code, repeat)) return true;
      if (repeat && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'Escape')) return true;   // (a held Enter or Esc acts once)
      switch (code) {
        case 'KeyW': case 'ArrowUp': S.move(-1); return true;
        case 'KeyS': case 'ArrowDown': S.move(1); return true;
        case 'KeyA': case 'ArrowLeft': row?.change?.(-1); return true;
        case 'KeyD': case 'ArrowRight': row?.change?.(1); return true;
        case 'Enter': case 'NumpadEnter': case 'Space': if (row?.confirm) row.confirm(); else S.deploy(); return true;
        case 'Escape': S.back(); return true;
        case 'KeyC': if (KIT_CLIP.on && !repeat) kitCard?.copy?.(); return true;    // (copy / paste the picked man's kit from any row: ui/kitCard.ts — ?.: a probe's own card has neither)
        case 'KeyV': if (KIT_CLIP.on && !repeat) kitCard?.paste?.(); return true;
      }
      return false;
  };
  const rowsNow = (): LoadoutRow[] => [
    { el: teamRow, change: dir => S.step(dir) },
    ...(kitBtns.length > 1 && !missionKit ? [{ el: kitsRow, change: (dir: 1 | -1) => { if (!squad && !oneList) return; const mine = alone() === undefined ? null : new Set(kitLoadouts(0).map(l => l.id)); for (let k = kitPick + dir; k >= 0 && k < kitBtns.length; k += dir) if (!mine || mine.has(kitBtns[k].id)) { kitPick = k; break; } S.paint(); }, confirm: () => { if (squad || oneList) putKit(kitBtns[kitPick].id); },
      enter: () => { const at = kitBtns.findIndex(k => k.id === kitLoadoutOf(alone())); if (at >= 0) kitPick = at; } }] as LoadoutRow[] : []),
    ...(cardsOn() ? [
      { el: slots, change: (dir: 1 | -1) => S.pick(member + dir), confirm: () => S.move(1) },
      { el: kitHost, key: (code: string, repeat: boolean) => kitCard?.key({ key: code, code, repeat }) ?? false, enter: (dir: 1 | -1) => kitCard?.go(dir > 0 ? 0 : 99) },
    ] as LoadoutRow[] : []),
    { el: btnRow, change: dir => { onBack = dir < 0 && !opts.embedded; S.paint(); },   // (mounted inside another screen there is no Back button to step onto: Esc is the way back)
      confirm: () => (onBack ? S.back() : S.deploy()) },
  ];
  S.rows = rowsNow();
  if (!issuedOnly && entry.level) void issuedKit(entry.level).then(K => {
    if (!K || !open || new URLSearchParams(S.search().replace(/^[^?]*\?/, '')).has('noissue')) return;
    const at = S.rows[S.sel]?.el; missionKit = K; issuedOnly = true;   // (the cards a staging will put on)
    (kitsRow as unknown as { remove?: () => void }).remove?.();
    S.rows = rowsNow(); S.sel = Math.max(0, S.rows.findIndex(r => r.el === at));
    foot.textContent = footWords(); mountCard(); drawSlots(); S.paint();
  });
  less.onclick = () => { S.sel = 0; S.step(-1); }; more.onclick = () => { S.sel = 0; S.step(1); };
  backBtn.onclick = () => S.back(); goBtn.onclick = () => S.deploy();
  function close() {
    if (!open) return; open = false; if (current === S) current = null; kitCard?.destroy(); kitCard = null; kitMission(null);   // (…and the table's first card is the loud one again: a staging asks for itself)
    leversBack(!!levers?.touched);   // (a screen opened on a link's own level and closed with no lever pressed leaves this machine's level as it found it)
    const p = root.parentElement as any; if (p?.removeChild) p.removeChild(root); else if (p?.children) { const k = p.children.indexOf(root); if (k >= 0) p.children.splice(k, 1); }
    under?.removeAttribute?.('inert'); if (!opts.embedded) try { had?.focus?.(); } catch { /* gone */ }   // (the focus goes back where it was — the card's Missions button — BEFORE Back reopens the list, which remembers it in turn)
  }
  // the card under the screen is inert while it is up (Tab, Space and Enter cannot reach its buttons), and the focus is the screen's
  const had = typeof document !== 'undefined' ? (document as { activeElement?: Element | null }).activeElement as HTMLElement | null | undefined : null;
  const under = opts.host || typeof document === 'undefined' ? null : document.getElementById('menu') as HTMLElement | null;
  root.addEventListener?.('mousedown', (e: Event) => { e.stopPropagation(); const t = e.target as HTMLElement | null; if (!t?.closest?.('button, .kc')) e.preventDefault(); });   // (never the game canvas's click; and a click on bare card keeps the keys where they were — in a kit card, say)
  root.addEventListener?.('contextmenu', (e: Event) => e.preventDefault());

  kitTeam(squad);   // (kit.ts: the squad's pouches are counted over the teammates who come — and a team bigger than the cards were cut for is brought back inside them)
  mountCard(); drawSlots(); S.paint();
  (opts.host ?? document.body).appendChild(root);
  current = S; currentKeys = opts.embedded?.keys ?? null;
  under?.setAttribute?.('inert', ''); root.setAttribute('tabindex', '-1'); if (!opts.embedded) if (!kitCard || S.rows[S.sel]?.el !== kitHost) try { (root as { focus?: (o?: unknown) => void }).focus?.({ preventScroll: true }); } catch { /* a fake element */ }
  return S;
}

/** a mission of the list as this screen takes it: its scenario's row, or the solo night's stand-in */
export function entryOfMission(m: Mission): LoadoutEntry { return m.scenario ?? { id: m.id, title: m.title, kind: 'solo', squad: 0, blurb: m.blurb }; }
/** the loadout screen for a mission of the list. `href`: the list's own link for it (absent: worked out from the page). Back reopens the list on its row. */
export function loadoutForMission(m: Mission, href?: string, opts: LoadoutOpts = {}): LoadoutScreen {
  return openLoadout(entryOfMission(m), { search: href, back: () => { openMissions({ select: m.id, ...(href !== undefined ? { hour: hourIdOf(new URLSearchParams(href).get('hour')) } : {}) }); }, ...opts });
}
/** ONE FLOW (main.ts, once): a pick on the mission list opens this screen instead of loading the row; the list's button says so. */
export function wireMissions() { MISSIONS.onPick = (m, href) => { loadoutForMission(m, href); }; MISSIONS.pickLabel = 'Loadout ›'; MISSIONS.next = { isOpen: () => !!current, close: closeLoadout }; }
/** the page's `?loadout=<mission id>` (main.ts, once the start card is up): that mission's loadout screen. Returns it, or null (no flag, no such mission). */
export function loadoutFromQuery(search: string | URLSearchParams, list: Mission[] = missionList()): LoadoutScreen | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search, id = q.get('loadout');
  const m = id ? list.find(x => x.id === id) : undefined;
  return m ? loadoutForMission(m, undefined, { squad: squadOfQuery(q, false) ?? undefined }) : null;   // (`?loadout=<id>&squad=N` opens on N)
}

// every key is the screen's while it is up (registered at module load: ahead of main.ts's Esc — which would close the start card under it — and of the game's Input)
const eaten = new Set<string>();
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', e => {
    const S = current; if (!S || !S.open || (currentKeys && !currentKeys())) return;
    const chord = e.ctrlKey || e.metaKey, clip = e.altKey || (chord && e.shiftKey) || !S.card ? null : clipKey(e);   // (C or V by the letter on the key — kitCard.ts — bare or with Ctrl / Cmd: the kit's copy and paste)
    if (chord && clip) { const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;   // (… the chord only while it is not the browser's own: no text field has the keys, no text on the page is selected)
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '') || t?.isContentEditable || String(window.getSelection?.() ?? '')) return; }
    else if (e.ctrlKey || e.metaKey || e.altKey) return;   // (the browser's own: reload, devtools)
    if (/^F\d+$/.test(e.code)) return;   // (the recorders' keys and the browser's stay theirs, and BEFORE the stop below: F7 to F10 never reached their listeners behind this one)
    e.stopImmediatePropagation(); if (!chord) eaten.add(e.code);   // (a chord's release is not waited for: macOS sends no keyup for a key let go under Cmd, and one left here would eat the game's next release of that key)
    (window as unknown as { __attract?: { poke?: () => void } }).__attract?.poke?.();   // (main.ts's own idle listener is behind this one: somebody is here)
    e.preventDefault();
    S.key(clip === 'copy' ? 'KeyC' : clip === 'paste' ? 'KeyV' : e.code === 'KeyC' || e.code === 'KeyV' ? '' : e.code, e.repeat);   // (a held Enter or Esc acts once, and nothing in a kit card repeats: key() and the card see to it; copy and paste by their letter, so the two places are nothing on a layout that types another letter there)
  }, { capture: true });
  window.addEventListener('keyup', e => { if (eaten.delete(e.code)) { e.stopImmediatePropagation(); if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault(); } }, { capture: true });   // (only the releases of presses taken above: a key held since before the screen opened is let go of in the game's Input too)
}

/** a roster chip's mark for a man who wears the copied kit (ui/kitCard.ts clipWorn): two sheets, one over the other */
const CLIP_MARK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5.5 5.5V2.8h7.7v7.7h-2.7"/><rect x="2.8" y="5.5" width="7.7" height="7.7"/></svg>';
/** a standing figure for a slot: head, shoulders, long gun — one path, coloured by the slot's pair (currentColor) */
const FIGURE = '<svg viewBox="0 0 40 64" width="40" height="64" aria-hidden="true"><circle cx="20" cy="9" r="6.5" fill="currentColor"/><path d="M8 26c0-6 5-9 12-9s12 3 12 9v16h-5v20h-5V44h-4v18h-5V42H8z" fill="currentColor"/><rect x="4" y="30" width="26" height="3" rx="1" fill="currentColor" opacity=".55" transform="rotate(-24 17 31)"/></svg>';

const STYLE = `
#loadout { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 45%, rgba(var(--m-base-rgb),0.86), rgba(var(--m-base-rgb),0.96) 75%); color: var(--m-text); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif; }
#loadout .lo-card { box-sizing: border-box; width: min(1040px, calc(100% - 32px)); max-height: calc(100% - 16px); display: flex; flex-direction: column; overflow: hidden; padding: 14px 0 10px; background: rgba(var(--m-panel-rgb),0.9); border: 1px solid rgba(var(--m-edge),0.35); border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
#loadout .lo-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 28px 8px; border-bottom: 1px solid rgba(var(--m-edge),0.14); }   /* the rows scroll here on a short window; Back, Deploy and the key line sit under it and never scroll */
#loadout .lo-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--m-accent); }
#loadout .lo-title { font: 300 30px/1.1 ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif; letter-spacing: 0.04em; color: var(--m-bright); margin: 4px 0 6px; }
#loadout .lo-tags { display: flex; gap: 6px; flex-wrap: wrap; }
#loadout .lo-tag { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; padding: 1px 6px; border-radius: 2px; border: 1px solid rgba(var(--m-edge),0.45); color: var(--m-btn-text); white-space: nowrap; }
#loadout .lo-tag.level { border-color: rgba(150,190,240,0.55); color: #b9d2f3; }
#loadout .lo-tag.untuned { border-style: dashed; border-color: rgba(200,200,200,0.4); color: var(--m-soft); }
#loadout .lo-blurb { margin-top: 6px; color: var(--m-soft); max-width: 64ch; }
#loadout .lo-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; padding: 7px 10px; border: 1px solid transparent; border-radius: 4px; }
#loadout .lo-row.sel { border-color: rgba(var(--m-accent-rgb),0.55); background: rgba(var(--m-btn-rgb),0.45); }
#loadout .lo-label { flex: 0 0 auto; font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--m-accent); margin-right: 6px; }
#loadout .lo-words { flex: 0 0 148px; text-align: center; font-size: 18px; letter-spacing: 0.04em; color: var(--m-bright); }
#loadout button { font: inherit; cursor: pointer; }
#loadout .lo-step { width: 30px; height: 30px; padding: 0; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.7); border: 1px solid rgba(var(--m-edge),0.45); border-radius: 3px; }
#loadout .lo-step:disabled { opacity: 0.3; cursor: default; }
#loadout .lo-sizes { display: flex; gap: 6px; margin-left: auto; }
#loadout .lo-size { min-width: 46px; padding: 5px 8px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.55); border: 1px solid rgba(var(--m-edge),0.3); border-radius: 2px; }
#loadout .lo-size.own { border-style: double; border-width: 3px; padding: 3px 6px; }
#loadout .lo-kits { row-gap: 6px; }
#loadout .lo-set { padding: 5px 8px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.55); border: 1px solid rgba(var(--m-edge),0.3); border-radius: 2px; }
#loadout .lo-set.on { color: var(--m-on-accent); background: var(--m-accent-hi); border-color: var(--m-accent-hi); }
#loadout .lo-kits.sel .lo-set.pick { box-shadow: 0 0 0 1px var(--m-bright); }
#loadout .lo-set:disabled { opacity: 0.4; cursor: default; }
#loadout .lo-set:hover:not(.on):not(:disabled) { border-color: var(--m-accent-hi); background: rgba(var(--m-hover-rgb),0.8); }
#loadout .lo-kits-own { font-size: 11px; color: var(--m-soft); font-style: italic; }
#loadout .lo-kits-own:empty { display: none; }
#loadout .lo-levers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; margin: 8px 10px 0; }   /* the difficulty levers (ui/levers.ts): one line under the head */
#loadout .lo-lever { display: flex; align-items: center; gap: 6px; }
#loadout .lo-levl { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--m-dim); margin-right: 2px; }
#loadout .lo-lever.moved .lo-levl { color: #f3d79a; }   /* moved off its level's rung by hand */
#loadout .lo-lever.na { opacity: 0.45; }
#loadout .lo-levb { padding: 5px 8px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-btn-text); background: rgba(var(--m-btn-rgb),0.55); border: 1px solid rgba(var(--m-edge),0.3); border-radius: 2px; }   /* (the Squad kit buttons' look under a class of its own: .lo-set is how the kit row's buttons are found) */
#loadout .lo-levb.on { color: var(--m-on-accent); background: var(--m-accent-hi); border-color: var(--m-accent-hi); }
#loadout .lo-levb:hover:not(.on) { border-color: var(--m-accent-hi); background: rgba(var(--m-hover-rgb),0.8); }
#loadout .lo-levn { display: none; }   /* (what a rung does is its button's title here: the mission sheet has the room for the words) */
#loadout .lo-levnote { margin: 4px 10px 0; font-size: 11px; color: #c9b98a; font-style: italic; }
#loadout .lo-levnote:empty { display: none; }
#loadout .lo-size.on { color: var(--m-on-accent); background: var(--m-accent-hi); border-color: var(--m-accent-hi); }
#loadout .lo-size.off { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
#loadout .lo-step:hover:not(:disabled), #loadout .lo-size:hover:not(.on):not(.off), #loadout .lo-btn:hover { border-color: var(--m-accent-hi); background: rgba(var(--m-hover-rgb),0.8); }
#loadout .lo-noteline { display: flex; align-items: baseline; gap: 16px; margin: 6px 10px 0; }
#loadout .lo-note { flex: 1 1 auto; min-height: 1.45em; font-size: 12px; color: var(--m-soft); }
#loadout .lo-note.off { color: #e8b46a; }
#loadout .lo-ics { display: none; }
#loadout .lo-kit .kc-row.idle .kc-ico { opacity: 0.28; }   /* (carried, and of no use on this mission — the wand and the cameras with no fog of war: the thing drawn as faint as one not carried, its value 'no use here' in the note's grey; the label stays lit and the arrows work. It was the whole tile at 40 %, still reading 'carried': it looked broken) */
#loadout .lo-kit .kc-row.idle .kc-val, #missions.one #loadout .lo-kit .kc-row.idle .kc-val { color: var(--m-dim, #8f887a); }   /* (the second selector: the one start page colours a value under two ids — ui/startpage.ts) */
#loadout .lo-squadp { flex: 0 0 auto; margin-right: 14px; font: 11px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; color: var(--m-btn-text); white-space: nowrap; }
#loadout .lo-squadp:empty { display: none; }
#loadout .lo-pool { flex: 0 0 auto; font: 11px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; color: var(--m-text); white-space: nowrap; }
#loadout .lo-slots { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 6px; padding: 4px; border: 1px solid transparent; border-radius: 6px; }
#loadout .lo-slots.sel { border-color: rgba(var(--m-accent-rgb),0.55); background: rgba(var(--m-btn-rgb),0.45); }
#loadout .lo-slot { display: grid; grid-template-columns: 30px minmax(0, 1fr); column-gap: 8px; align-content: start; padding: 8px 9px 8px; border: 1px solid rgba(var(--m-edge),0.3); border-top-width: 3px; border-radius: 4px; background: rgba(var(--m-panel2-rgb),0.7); color: var(--m-accent-hi); cursor: pointer; }
#loadout .lo-slot.p-you { border-top-color: var(--m-accent-hi); color: var(--m-accent-hi); }
#loadout .lo-slot.p-red { border-top-color: #e2685c; color: #f0958b; }
#loadout .lo-slot.p-blue { border-top-color: #5c9be2; color: #8fbdf2; }
#loadout .lo-slot.out { border-style: dashed; border-top-width: 1px; background: none; color: var(--m-faint); }
#loadout .lo-slot.out:hover, #loadout .lo-slot.in:hover { border-color: rgba(var(--m-accent-rgb),0.6); }
#loadout .lo-slot.out:hover { color: var(--m-dim); }
#loadout .lo-slot.pick { border-color: var(--m-accent-hi); background: rgba(var(--m-sel-rgb),0.8); box-shadow: 0 0 0 1px rgba(var(--m-accent-rgb),0.25); }
#loadout .lo-fig { grid-row: 1 / span 2; height: 38px; }
#loadout .lo-fig svg { width: 24px; height: 38px; }
#loadout .lo-slot.out .lo-fig { opacity: 0.45; }
#loadout .lo-name { align-self: end; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; color: var(--m-bright); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#loadout .lo-name.changed::after { content: ' •'; color: #f3d79a; }
#loadout .lo-slot.out .lo-name { color: var(--m-faint); font-weight: 400; }
#loadout .lo-role { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: inherit; }
#loadout .lo-sum { grid-column: 1 / span 2; margin-top: 6px; min-height: 2.6em; font: 10.5px/1.3 ui-monospace, Menlo, monospace; color: var(--m-soft); }
#loadout .lo-pouch { grid-column: 1 / span 2; margin-top: 3px; font: 10px/1.3 ui-monospace, Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m-btn-text); }
#loadout .lo-slot.clip { position: relative; }
#loadout .lo-clip { position: absolute; top: 8px; right: 9px; line-height: 0; color: var(--m-soft); }
#loadout .lo-slot.pick .lo-clip { color: var(--m-text); }
#loadout .lo-kit { margin-top: 8px; }
#loadout .lo-kit:empty { display: none; }
#loadout .lo-kit .kc { width: 100%; display: grid; grid-template-columns: 200px repeat(3, minmax(0, 1fr)); grid-auto-columns: minmax(0, 1fr); grid-template-rows: repeat(4, auto) auto; grid-auto-flow: column; column-gap: 22px; padding: 12px 16px 10px; }   /* (three columns of rows, each a share of the width: a ninth row's note is as long as it likes and squeezes nobody) */
#loadout .lo-kit .kc-head { grid-column: 1; grid-row: 1 / span 2; margin: 0; align-self: start; }
#loadout .lo-kit .kc-words { grid-column: 1; grid-row: 3 / span 3; margin: 0; padding-top: 8px; align-self: start; }
#loadout .lo-kit .kc-row { margin: 0; }
#loadout .lo-kit .kc-sets { grid-column: 2 / -1; grid-row: 5; margin: 6px 0 0; }
#loadout .lo-kit .kc-set { flex: 0 1 150px; padding: 5px 2px; }
#loadout .lo-kit .kc-sets { flex-wrap: nowrap; }
#loadout .lo-kit .kc-clip { padding: 5px 12px; }   /* (copy and paste — ui/kitCard.ts: the pair at the far end of the sets' line, in the sets' own look on either page) */
#loadout .lo-actions { flex: 0 0 auto; justify-content: flex-end; margin: 6px 28px 0; }
#loadout .lo-btn { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 14px; background: rgba(var(--m-btn-rgb),0.7); color: var(--m-btn-text); border: 1px solid rgba(var(--m-edge),0.45); border-radius: 3px; }
#loadout .lo-btn.primary { min-width: 220px; background: var(--m-accent); color: var(--m-on-accent); border-color: var(--m-accent); font-weight: 600; }
#loadout .lo-btn.primary:hover { background: var(--m-accent-hi); }
#loadout .lo-btn.sel { outline: 2px solid var(--m-bright); outline-offset: 2px; }
#loadout .lo-foot { flex: 0 0 auto; margin: 4px 28px 0; font: 11px ui-monospace, Menlo, monospace; color: var(--m-faint); letter-spacing: 0.06em; }
/* THE ROSTER AND THE KIT TABLE: each man a card with his gun on it, the picked man's kit as tiles — a silhouette, the thing's name, how many — in columns */
#loadout .lo-label { font: 700 12px/1 var(--m-head); letter-spacing: 0.22em; }
#loadout .lo-words { font: 700 20px/1 var(--m-head); letter-spacing: 0.08em; text-transform: uppercase; }
#loadout .lo-set, #loadout .lo-levb, #loadout .lo-size { font: 600 12px/1.4 var(--m-head); letter-spacing: 0.12em; border-radius: 0; }
#loadout .lo-set.on { background: var(--m-accent); border-color: var(--m-accent); }
#loadout .lo-slots { gap: 8px; }
#loadout .lo-slot { padding: 8px 10px 9px; border-radius: 0; border-top-width: 5px; background: rgba(var(--m-panel2-rgb),0.8); }
#loadout .lo-slot.out { border-top-width: 1px; background: none; }
#loadout .lo-slot.pick { background: rgba(var(--m-sel-rgb),0.95); border-left-color: var(--m-accent); border-right-color: var(--m-accent); border-bottom-color: var(--m-accent); box-shadow: 0 0 0 1px var(--m-accent); }
#loadout .lo-name { font: 700 17px/1.05 var(--m-head); letter-spacing: 0.07em; text-transform: uppercase; }
#loadout .lo-role { font: 600 10.5px/1.3 var(--m-head); letter-spacing: 0.18em; }
#loadout .lo-gun { grid-column: 1 / span 2; height: 34px; margin: 7px 0 0; color: var(--m-btn-text); opacity: 0.9; }
#loadout .lo-gun svg { display: block; height: 100%; width: auto; max-width: 100%; }
#loadout .lo-sum { margin-top: 5px; font: 11px/1.35 var(--m-font); }
#loadout .lo-pouch { font: 600 10.5px/1.3 var(--m-head); letter-spacing: 0.16em; color: var(--m-soft); }
#loadout .lo-kit .kc { grid-template-columns: 190px repeat(3, minmax(0, 1fr)); column-gap: 8px; row-gap: 8px; padding: 12px; font-family: var(--m-font); border-radius: 0; background: rgba(var(--m-base-rgb),0.6); }
#loadout .lo-kit .kc-head { padding: 2px 4px 0; }
#loadout .lo-kit .kc:not(:has(.kc-row ~ .kc-row ~ .kc-row ~ .kc-row ~ .kc-row ~ .kc-row ~ .kc-row ~ .kc-row ~ .kc-row)) { grid-template-columns: 190px repeat(2, minmax(0, 1fr)); }   /* (eight rows or fewer fill two columns of four: no empty third) */
#loadout .lo-kit .kc-title { font: 700 22px/1 var(--m-head); letter-spacing: 0.06em; text-transform: uppercase; }
#loadout .lo-kit .kc-sub, #loadout .lo-kit .kc-pouch { font-family: var(--m-head); font-weight: 600; font-size: 11px; letter-spacing: 0.16em; }
#loadout .lo-kit .kc-pips i { width: 12px; height: 12px; border-radius: 0; }
#loadout .lo-kit .kc-pips i.on { background: var(--m-accent); }
#loadout .lo-kit .kc-pips i.big { width: 30px; margin-left: 5px; }   /* (the big slot: game/kit.ts BIGSLOT) */
#loadout .lo-kit .kc-words { padding: 8px 4px 0; font-size: 11.5px; line-height: 1.4; border-top: 0; }
#loadout .lo-kit .kc-row { display: grid; grid-template-columns: 64px minmax(0, 1fr); column-gap: 10px; align-content: start; padding: 7px 8px 7px 9px; background: rgba(var(--m-panel2-rgb),0.85); border: 1px solid rgba(var(--m-edge),0.16); border-left: 3px solid rgba(var(--m-edge),0.3); border-radius: 0; }
#loadout .lo-kit .kc.focus .kc-row.sel { background: rgba(var(--m-sel-rgb),0.95); border-color: var(--m-accent); border-left-color: var(--m-accent); }
#loadout .lo-kit .kc-ico { display: block; grid-column: 1; grid-row: 1 / span 2; align-self: center; height: 32px; color: var(--m-btn-text); }
#loadout .lo-kit .kc-ico svg { display: block; width: 100%; height: 100%; }
#loadout .lo-kit .kc-ico.none { opacity: 0.28; }
#loadout .lo-kit .kc-row.changed .kc-ico { color: #f3d79a; }
#loadout .lo-kit .kc-line { grid-column: 2; gap: 3px 5px; flex-wrap: wrap; }
#loadout .lo-kit .kc-label { order: 1; flex: 1 1 0; min-width: 0; font: 600 11px/1.2 var(--m-head); letter-spacing: 0.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#loadout .lo-kit .kc-val, #loadout .lo-kit .kc-val.num { order: 4; flex: 1 0 100%; min-width: 0; text-align: left; font: 700 16px/1.1 var(--m-head); letter-spacing: 0.05em; text-transform: uppercase; }
#loadout .lo-kit .kc-line .kc-step { order: 2; }
#loadout .lo-kit .kc-step { width: 22px; height: 22px; border-radius: 0; font-family: var(--m-font); }
#loadout .lo-kit .kc-note { grid-column: 2; margin-top: 3px; font-size: 11px; line-height: 1.3; min-height: 0; }
#loadout .lo-kit .kc-sets { margin: 0; padding: 0; gap: 6px; }
#loadout .lo-kit .kc-set, #loadout .lo-kit .kc-clip { font: 600 12px/1.4 var(--m-head); letter-spacing: 0.12em; border-radius: 0; }
#loadout .lo-kit .kc-set.on, #loadout .lo-kit .kc-clip.on { background: var(--m-accent); border-color: var(--m-accent); }
#missions.one #loadout .lo-kit .kc-clip { min-width: 0; padding: 7px 13px 6px; font: 600 12px/1.3 var(--m-head); letter-spacing: 0.12em; text-transform: uppercase; color: var(--m-soft); background: none; border: 0; border-radius: 0; box-shadow: none; }
#missions.one #loadout .lo-kit .kc-clip:hover:not(.on):not(.off) { color: var(--m-bright); background: rgba(var(--m-edge),0.1); border: 0; }
#missions.one #loadout .lo-kit .kc-clip.on { color: var(--m-bright); background: none; box-shadow: inset 0 -2px 0 var(--m-soft); }
/* the card as a tree (game/kittree.ts; the one start page lays it out in full — ui/startpage.ts): a gun's tile over what rides on it */
#loadout .lo-kit .kc-tree .kc-gun { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
#loadout .lo-kit .kc-tree .kc-kids { display: flex; flex-direction: column; gap: 4px; margin: 0 0 0 12px; padding: 0 0 0 8px; border-left: 2px solid rgba(var(--m-edge),0.28); }
#loadout .lo-kit .kc-tree .kc-kids:empty { display: none; }
#loadout .lo-kit .kc-tree .kc-stats { grid-column: 1 / -1; }
#loadout .lo-btn { font: 700 14px/1 var(--m-head); letter-spacing: 0.16em; padding: 11px 20px 10px; border-radius: 0; }
#loadout .lo-btn.primary { font-size: 17px; }
@media (max-width: 1150px) { #loadout .lo-kit .kc { grid-template-columns: 170px repeat(3, minmax(0, 1fr)); } #loadout .lo-kit .kc-row { grid-template-columns: minmax(0, 1fr); } #loadout .lo-kit .kc-ico { display: none; } #loadout .lo-kit .kc-line, #loadout .lo-kit .kc-note { grid-column: 1; } }
@media (max-width: 700px) { #loadout .lo-slots { grid-template-columns: repeat(2, minmax(0, 1fr)); } #loadout .lo-sizes { margin-left: 0; } #loadout .lo-kit .kc { display: block; } }
`;
function injectStyle() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('loadout-style')) return;
  menuTheme(); const s = document.createElement('style'); s.id = 'loadout-style'; s.textContent = STYLE; document.head.appendChild(s);
}
