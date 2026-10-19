// THE KIT'S SILHOUETTES: one small flat drawing per row of a member's card (ui/kitCard.ts) — the gun, a canister, a charge, the goggles — so a card reads as
// kit laid out on a table and not as a list of words. Each is an inline SVG in the page's own colour (`currentColor`), drawn here from plain shapes on a
// 64 × 32 board: the game has no art files and these are no more than a sign for the thing. Keyed by the card's field (game/kit.ts KitField) and, for the
// gun, its value. Pure strings: nothing at module level uses another module's exports.
import { pickIcon } from '../game/gunslots';   // (called inside kitIcon only: a slot's pick → which gun drawing)
import { gunLookOn } from '../game/gunlook';   // (called inside kitIcon / gunIcon only: a gun with a look of its own has a drawing of its own)
const BOARD = (body: string) => `<svg viewBox="0 0 64 32" aria-hidden="true" focusable="false" fill="currentColor" stroke="none">${body}</svg>`;
const line = (d: string, w = 1.6) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const RIFLE = '<path d="M2 13l9-1h4v-1h3v-1h17v2h13v1.6h10v-1h3v4h-3v-1H48v1.4H35v1h-3l2.4 9.4-4.6 1L27.6 19H24l-1.6 7h-4.6l1.8-7H18v-3h-3v2l-13 4z"/><path d="M21 6h10v3H21z"/><path d="M50 9h1.6v4H50z"/>';
const PISTOL = '<path d="M14 9h35v2h2v4h-2v1H36v1.2c0 2.6-1.8 3.8-4.6 3.8H28l-2.4 8.6h-9.4L19 17h-5z"/>' + line('M36 17.6c0 3.2-1.6 4.6-4.4 4.6', 1.2);
const SHOTGUN = '<path d="M2 14l12-2h15v1h33v2.4H29V16h28v2.6H47v1.6H35v-1.6h-6V19h-3.4l-1.8 6.4h-4.4L21 19h-7l-12 4z"/>';
const SHELL = '<path d="M21 9h15c4.6 0 8 3.2 8 7s-3.4 7-8 7H21z"/><path d="M17 8h3v16h-3z" opacity="0.6"/>';
const can = (x: number) => `<path d="M${x} 9h12a1.6 1.6 0 0 1 1.6 1.6v16.8A1.6 1.6 0 0 1 ${x + 12} 29H${x}a1.6 1.6 0 0 1-1.6-1.6V10.6A1.6 1.6 0 0 1 ${x} 9z"/><path d="M${x + 3} 4h6v4h-6z"/>` + line(`M${x + 9} 5.4l6 2.2v11`, 1.4);
const SMOKE = can(25) + '<path d="M23.4 14h15.2v2.4H23.4z" fill="#0c0b09" opacity="0.55"/>';
const STUN = can(25) + [13, 18, 23].map(y => [27, 31, 35].map(x => `<circle cx="${x}" cy="${y}" r="1.25" fill="#0c0b09" opacity="0.6"/>`).join('')).join('');
const FRAG = '<circle cx="31" cy="19.5" r="9.5"/><path d="M27.6 5h6.8v5.4h-6.8z"/>' + line('M34.4 6.4l7 2.4v10', 1.4) + '<circle cx="22.4" cy="7.6" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/>';
const CANS = can(16) + can(36);
const SUPPRESSOR = '<path d="M14 11h40a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/><path d="M6 13.6h6v4.8H6z" opacity="0.7"/>' + [22, 30, 38, 46].map(x => `<path d="M${x} 11h1.4v10H${x}z" fill="#0c0b09" opacity="0.5"/>`).join('');
const LIGHT = '<path d="M10 12h24l8-3h3v14h-3l-8-3H10z"/><path d="M14 20h8v4h-8z" opacity="0.7"/>' + line('M49 11l6-3M50 16h8M49 21l6 3', 1.5);
const NVG = '<path d="M11 10h15a2 2 0 0 1 2 2v2h8v-2a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H38a2 2 0 0 1-2-2v-3h-8v3a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"/><path d="M28.6 3h6.8v8h-6.8z" opacity="0.7"/><circle cx="18.5" cy="17" r="3.6" fill="#0c0b09" opacity="0.55"/><circle cx="45.5" cy="17" r="3.6" fill="#0c0b09" opacity="0.55"/>';
const CHARGE = '<path d="M18 4h10v24H18z"/><path d="M18 10h10v1.6H18zM18 20h10v1.6H18z" fill="#0c0b09" opacity="0.5"/>' + line('M28 16c8 0 6 9 14 9', 1.4) + '<path d="M42 21.6h10v6.8H42z"/>';
const WALL = '<path d="M12 3h26v26H12zM17 8v16h16V8z" fill-rule="evenodd"/>' + line('M38 16c7 0 4 9 10 9', 1.4) + '<path d="M48 21.6h9v6.8h-9z"/>';
const SUIT = '<path d="M22 3h5.6l1.6 4h5.6l1.6-4H42l3 9-2 4v13H21V16l-2-4zm3 15v6h5.6v-6zm8.4 0v6H39v-6z" fill-rule="evenodd"/>';
const TRIM = '<path d="M20 6l12 6.6L44 6v5.4L32 18l-12-6.6zM20 15l12 6.6L44 15v5.4L32 27l-12-6.6z"/>';

const WAND = line('M6 25h18c8 0 8-14 16-14h6', 2) + '<path d="M46 7.6h9a1.6 1.6 0 0 1 1.6 1.6v3.6A1.6 1.6 0 0 1 55 14.4h-9z"/><circle cx="58.6" cy="11" r="1.8"/>' + '<path d="M3 20h7a1.6 1.6 0 0 1 1.6 1.6v6.8A1.6 1.6 0 0 1 10 30H3z"/><path d="M4.6 22h4.8v3.4H4.6z" fill="#0a0c0f" opacity="0.55"/>';   // (a cable from a small screen to a lens head)
const CAM = '<path d="M12 6h4v20h-4z" opacity="0.6"/><path d="M16 9h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H16z"/><circle cx="28" cy="16" r="3.4" fill="#0a0c0f" opacity="0.55"/>' + line('M39 12l11-6M40 16h13M39 20l11 6', 1.5);   // (a puck on a wall, its lens, what it watches)

const BY_FIELD: Record<string, string> = { cams: CAM, wand: WAND, shells: SHELL, smoke: SMOKE, bangs: STUN, frags: FRAG, cans: CANS, suppressed: SUPPRESSOR, light: LIGHT, nvg: NVG, charges: CHARGE, walls: WALL, suit: SUIT, trim: TRIM };
const BY_GUN: Record<string, string> = { rifle: RIFLE, pistol: PISTOL, shotgun: SHOTGUN };
// THE GUNS WITH A LOOK OF THEIR OWN (game/gunlook.ts GUNLOOK; keyed by the pick's id — game/gunslots.ts PICKS — which is also its row's id): each drawn as itself, the
// suppressor it always wears already on it. With that switch off each is its class's drawing above, as it was.
const dark = (d: string, o = 0.5) => `<path d="${d}" fill="#0c0b09" opacity="${o}"/>`;
const OWN_GUN: Record<string, string> = {
  // Mk 12: a fixed stock, a short magazine, a long tube with the bipod folded under it, a scope the length of the receiver, the can at the end of a long barrel
  mk12: '<path d="M1 12.2l11-1.2h2v6.4L1 20.6z"/><path d="M14 10.6h14v7.2H14z"/><path d="M16.4 17.8h4.2l-2.2 7.8H14z"/><path d="M22.6 17.8h4l-0.5 5.2h-4z"/><path d="M28 11.2h17v5.4H28z"/><path d="M45 12.8h5v2H45z"/>'
    + '<path d="M50 11.4h11.4a1.2 1.2 0 0 1 1.2 1.2v2.4a1.2 1.2 0 0 1-1.2 1.2H50z"/>' + dark('M51.6 11.4h1.2v4.8h-1.2z')
    + '<path d="M13 5.4h3.4v3.8H13z"/><path d="M16 6.2h18v2.4H16z"/><path d="M33.4 5h5.2v4.8h-5.2z"/><path d="M23.4 3.6h3.2v2.6h-3.2z"/><path d="M19 8.6h1.6v2H19zM29 8.6h1.6v2H29z"/><path d="M35 17.2h11.4v1.3H35z"/>',
  // MP7: all of it short — a two-rod stock, the magazine out of the foot of the pistol grip, a folding grip under the nose, a dot sight, the can
  mp7: '<path d="M6 8.6h2.2v10H6z"/><path d="M8.2 10.2H22v1.5H8.2z"/><path d="M22 9h19v8.2H22z"/><path d="M26.4 17.2h5.6l-2.2 13.2h-5.6z"/><path d="M35.6 17.2h3.4v7.2h-3.4z"/>'
    + '<path d="M41 10.2h13.4a1.2 1.2 0 0 1 1.2 1.2v3a1.2 1.2 0 0 1-1.2 1.2H41z"/>' + dark('M42.8 10.2H44v5.4h-1.2z') + '<path d="M24 7.6h15V9H24z"/><path d="M28.4 3.8h5v3.8h-5z"/>' + dark('M25.2 24.6l5.4 0-0.3 1.3h-5.3z', 0.45),
  // Mk 46: a deep receiver under a feed cover, the belt box hanging under it, the bipod folded under the handguard, a long bare barrel
  mk46: '<path d="M1 11h11l2-0.8v7.2l-6 4.2H1z"/><path d="M14 9.6h19v8.6H14z"/><path d="M15.4 8h15.2v1.6H15.4z"/><path d="M19 4.8h7.4V8H19z"/><path d="M16.2 18.2h4.2l-2 7.6H14z"/><path d="M22.4 18.2h11.4V29H22.4z"/>' + dark('M22.4 20.4h11.4v1.3H22.4z', 0.45)
    + '<path d="M33 11.4h12.4v5.8H33z"/><path d="M45.4 12.6H59v2.1H45.4z"/><path d="M45.4 15.4h7v1.3h-7z"/><path d="M59 11.9h3.4v3.5H59z"/><path d="M36 17.8h12v1.3H36z"/><path d="M36 17.8h1.3v4H36z"/>',
  // M1014: one long barrel over a tube nearly as long, a fore-end round both, a pistol grip under a thin stock with a tall pad, spare shells on the receiver
  m1014: '<path d="M1 10h2.4v9.6H1z"/><path d="M3.4 12h11v2.8h-11z"/><path d="M14 10.4h16v7.4H14z"/><path d="M15.6 17.8h4.2l-2 7.8h-4.4z"/><path d="M30 11.2h33v2.2H30z"/><path d="M30 14.2h25v2.3H30z"/><path d="M30 10.6h14.4v7H30z"/>'
    + '<path d="M16 8.4h2v2h-2z"/><path d="M59.4 9.2h1.5v2h-1.5z"/>' + [18.4, 20.8, 23.2, 25.6].map(x => dark(`M${x} 12h1.5v3.8h-1.5z`, 0.55)).join(''),
  // HK45: the pistol with the longest, fattest can there is
  hk45: '<path d="M9 9h33v2h2v4h-2v1H31v1.2c0 2.6-1.8 3.8-4.6 3.8H23l-2.4 8.6h-9.4L14 17H9z"/>' + line('M31 17.6c0 3.2-1.6 4.6-4.4 4.6', 1.2)
    + '<path d="M44 8h18.4a1.4 1.4 0 0 1 1.4 1.4v7.2a1.4 1.4 0 0 1-1.4 1.4H44z"/>' + dark('M46 8h1.3v10H46z'),
  // Glock 18: the pistol, bare, with the long magazine standing out of the foot of its grip
  g18: '<g transform="translate(0 -5)">' + PISTOL + '</g><path d="M16.9 24.6h8l-1.9 6.8h-8z"/>' + dark('M16.6 24.6h8.3l-0.3 1.2h-8.3z', 0.45),
};
// (a gun that wears a suppressor is drawn with it — ui/kitCard.ts KIT_CAN: the can on the muzzle, one dark band where it screws on; no can fits the shotgun)
const GUN_CAN: Record<string, string> = {
  rifle: '<path d="M52.4 11.6h10a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-1.2 1.2H52.4z"/><path d="M54.2 11.6h1.2v6h-1.2z" fill="#0c0b09" opacity="0.5"/>',
  pistol: '<path d="M51 9.4h11.4a1.2 1.2 0 0 1 1.2 1.2v4.8a1.2 1.2 0 0 1-1.2 1.2H51z"/><path d="M52.8 9.4h1.2v7.2h-1.2z" fill="#0c0b09" opacity="0.5"/>',
};
// (the big slot's row — game/kit.ts BIGSLOT — is drawn by what is in it: a breaching hammer is a head with a spike behind it on a long shaft, a pry claw at its foot)
const HAMMER = '<path d="M5 7h9v4h2.4v3H14v4H5l-1.4-2.2V9.2z"/><path d="M16 11h3.6l1.4 1.5-1.4 1.5H16z" opacity="0.7"/><path d="M9 18h2.6v-1H52v1c3 0 5.4.8 8 2.6l-1 1.8c-2.4-1.2-4.4-1.8-7-1.8H9z"/><path d="M26 16.4h14v3.6H26z" fill="#0c0b09" opacity="0.4"/>';
const EMPTY = '<path d="M6 6h52v20H6zM8 8v16h48V8z" fill-rule="evenodd" opacity="0.5"/>';
const BY_BIG: Record<string, string> = { none: EMPTY, shotgun: SHOTGUN, hammer: HAMMER, wall: WALL };

/** the drawing for a card's row at its value ('' where the row has none), and whether the value means he carries none of it (drawn faint); `can` = the gun
 *  of the weapon row wears a suppressor */
export function kitIcon(field: string, value: unknown, can = false): { svg: string; none: boolean } {
  if ((field === 'primary' || field === 'secondary') && gunLookOn() && Object.hasOwn(OWN_GUN, String(value))) return { svg: BOARD(OWN_GUN[String(value)]), none: false };
  if (field === 'primary' || field === 'secondary') { const k = pickIcon(value); return { svg: BOARD(k ? gunBody(k, can) : EMPTY), none: !k }; }   // (game/gunslots.ts: a slot's pick, drawn as its class of gun — an empty board for no long gun)
  const body = field === 'weapon' ? gunBody(String(value), can) : field === 'big' ? BY_BIG[String(value)] ?? EMPTY : BY_FIELD[field];
  return { svg: body ? BOARD(body) : '', none: value === 0 || value === false || value === 'none' };
}
const gunBody = (weapon: string, can: boolean) => { const w = Object.hasOwn(BY_GUN, weapon) ? weapon : 'rifle'; return BY_GUN[w] + (can && Object.hasOwn(GUN_CAN, w) ? GUN_CAN[w] : ''); };
/** a gun's drawing by itself (the roster's cards), with its suppressor where it wears one */
export function gunIcon(weapon: string, can = false, row = ''): string { return BOARD(gunLookOn() && Object.hasOwn(OWN_GUN, row) ? OWN_GUN[row] : gunBody(weapon, can)); }   // (`row`: its weapons.ts row's id — a gun with a look of its own is drawn as itself)
