// The issue kit: 2010s GWOT in place of the first Splinter Cell clone (the maintainer, 10-10: "and maybe start reworking to gwot 2010s? we can move away from the
// first SC clone for equipment. bifocal nvg, more standard rifles and handguns, etc." · "we can keep OCP tho" · "and i don't think we need the NVG to glow in
// the dark"). ONE switch, `GEAR.on` — ON in the page (`?oldgear` = the Splinter Cell kit as it was), OFF in the module and on the frozen harness stand
// (`TPS_GEAR=1`; src/host/profile.ts pageSwitches + FROZEN_HOLDS, src/host/standup.ts). What it changes is WHAT THE KIT IS CALLED AND HOW IT IS DRAWN, nothing a
// round, an eye, an ear or a hand reads — with ONE exception, the maintainer's own balance call (10-10: "yeah switch to 15 rounds for the glock, 40mm sponge
// round sgtm (and redo the assets), and just call it the mk18"): the Glock's magazines hold fifteen (GEAR_MAG):
//   · the rifle row reads Mk 18 (weapons.ts fn2000: name / short), drawn as a carbine with a stock, a box magazine AHEAD of the grip, a railed handguard and a
//     laser box on it (rigProps.ts RIG.m4) — on the SAME grip, support hand, muzzle, light and sling points as the bullpup, which the animator, the rounds, the
//     light and the launcher keep reading off RIG.sc20k: the simulation cannot tell the two apart;
//   · the pistol row reads Glock 19, 9×19 mm (weapons.ts fiveseven: name / short / calibre) and its magazines hold 15, in the gun and in the pouches (the
//     row's magCapacity getter; 10 without the kit) — cadence, reload, spread and report are untouched. A gun is LOADED when it is made (a fresh encounter)
//     and a magazine keeps the rounds it was loaded with: thrown on a running game, the switch changes what a magazine may hold from the next reload on
//     (Firearm.fit, which the Tab row calls, puts away what no longer fits when the kit comes off); a checkpoint's counts are kept, clamped to the row's;
//   · the goggles are two tubes on a bridge (rigProps.ts gogglesBoxes) whose lenses are dark glass, up or down: nothing on a man lights up;
//   · the rifle's first attachment is worded AND DRAWN a 40 mm sponge round — a blunt slug, blue foam nose on a dark body, nose first in the air and on its
//     side where it stops (throwables.ts SPONGE_ITEM / spongeBoxes: three boxes, as the ring's three slats, under the ring's own flags) — on the ring airfoil's
//     rule, flight, item and numbers exactly; the kit column's second launcher tag reads HE (shellTag);
//   · the OCP stays on the pistol, in name and in deed.
// KNOWN, LEFT: the empty magazine a reload drops still leaves from behind the trigger hand (player.ts: where an item is born is simulation state, and the
// same-digest claim wins over the picture); the support hand itself works the carbine's marks (anim.reloadBack false: arms only).
// Off = the build as it was: the words, the boxes and the magazine's size are picked where they are read, so a table put back (knobs.ts knobsBack) needs nothing re-applied.
// A LEAF: nothing of the game is imported here (src/game is one import cycle; weapons.ts, itself a leaf, reads this at call time).

export const GEAR = { on: false };

/** the two rows' names under the switch (weapons.ts reads them in the rows' own getters) */
export const GEAR_NAMES = { rifle: 'Mk 18', rifleLong: 'Mk 18 (suppressed)', pistol: 'Glock 19', pistolLong: 'Glock 19 (suppressed)', pistolCalibre: '9×19 mm' } as const;
/** rounds a magazine of the issue kit's pistol holds (weapons.ts fiveseven's magCapacity getter; the row's own ten without the kit) */
export const GEAR_MAG = { pistol: 15 } as const;
/** …and the names they had before it: what is WRITTEN DOWN (a chronicle row, so a save and a recording) whichever kit is issued — worded by gearText where it is shown */
export const OLD_NAMES = { rifle: 'FN2000', rifleLong: 'FN2000 (suppressed)', pistol: 'Five-seveN', pistolLong: 'FN Five-seveN (suppressed)', pistolCalibre: '5.7×28 mm' } as const;
/** a weapon row's short name as it is written down: the same string on and off (the two renamed rows by their old names, every other row its own) */
export function plainShort(def: { id: string; short: string }): string { return def.id === 'fn2000' ? OLD_NAMES.rifle : def.id === 'fiveseven' ? OLD_NAMES.pistol : def.short; }
/** the page's (and the workbench's) one rule for the switch: on unless the address says `?oldgear` */
export function gearFromQuery(q: URLSearchParams) { GEAR.on = !q.has('oldgear'); }
/** the HUD tag of the rifle's first attachment (the kit column, the reticle's right-button word, the draw line) */
export function ringTag(): string { return GEAR.on ? 'SPONGE' : 'RING'; }
/** …and of its second, the 40 mm high-explosive round, in the kit column (beside SPONGE, '40MM' said nothing: both are 40 mm) */
export function shellTag(): string { return GEAR.on ? 'HE' : '40MM'; }
/** a line written in the old kit's words, in the kit's words as issued: every player-facing string that names the kit goes through here where it is SHOWN (never
 *  as a module loads), so off is the string as written, character for character */
export function gearText(s: string): string {
  if (!GEAR.on) return s;
  return s.replace(/FN2000/g, GEAR_NAMES.rifle).replace(/Five-seveN/g, GEAR_NAMES.pistol)
    .replace(/2 again for the 40 mm(?! HE)/g, '2 again for the 40 mm HE')
    .replace(/ring airfoils/g, '40 mm sponge rounds').replace(/ring airfoil/g, '40 mm sponge round').replace(/ring launcher/g, '40 mm launcher')
    .replace(/\bring to the head/g, 'sponge round to the head').replace(/rings only/g, 'sponge rounds only').replace(/\bRING\b/g, 'SPONGE');
}
