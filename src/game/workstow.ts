// THE GUN IS PUT AWAY FOR A TWO-HANDED JOB (the maintainer, 10-23: "characters should fully unequip their weapon when planting door charges, etc. -- they can
// reequip after they're done"). A charge went on with the gun still in the man's hands: you set one with your left while the pistol stayed in your right (the
// rifle hung low in both and a hand left it), and a teammate pressed his on with one hand, the carbine in the other, free to fire the whole two seconds.
//
//   YOU      (door charge by hand, wall charge by hand — doortools.ts / wallcharge.ts samTick): what is in your hand is put away first (the pistol to its
//            holster, the rifle onto its sling, a can to its pouch — player.ts setHolstered, carried there by kit handling's own errand where that is on), the
//            job's clock starts once your hands are free of it, BOTH hands go on the charge, and when it is set — or you let go of it — it is brought back up.
//            No round leaves the gun until it is up again: that is the kit's own draw (Player.equipT), nothing added here. Hands that were already empty stay
//            empty. Something that wants your hands empty and took you off the job (a man in your arm, a lock, a wall you are pressed to) leaves it away.
//   THE TEAM (the 'place' stage of a door charge and of a wall charge on order): the setter's gun leaves his hands as he comes onto the job — a long gun hangs
//            down his front on its sling, a sidearm goes to his thigh (combat.ts guardKit's `hang`, as for the hammer) — both hands go on the charge `mateDown`
//            later, and it is back in his hands `mateUp` after the job ends. NO ROUND LEAVES IT from the moment it is let go until it is back up (gunslots.ts
//            sideLocked, the one lock every trigger a teammate has asks; his fire clock is held as well). A man the fight has (his order yielded to it, he is
//            blind or doubled over, the room fight has his gun on a man) DROPS the job: nothing is spent, the gun comes up, and he starts over when the fight
//            lets him go — or after `fightCap` of it at a stretch, with it still on him.
//
// WHAT IT COSTS: the plant is longer by the time the gun takes to put away, and the first round after one waits for the draw — a man planting cannot shoot.
// NOT HERE (other two-handed jobs, their owners'): a timed charge on its bench, the drive in its rack, the optical wand, a lock, a thing a teammate works.
//
// SWITCH: WORKSTOW.on — ON in the page (`?noworkstow` off), OFF in the module and on the frozen stand (`TPS_WORKSTOW=1`): off — or with the hands that
// do the work off (HANDWORK) — nothing here is called and every plant is what it was. State: Player.workStow, Guard.workStow (on the men: a rollback snapshot holds them; a checkpoint does not — no save is written while a
// charge goes on, his gun is away for one or a kit errand runs (savestate.ts playerBusy), and a teammate loaded mid-job has his gun in his hands). No dice, no clock of its own.
import type { Game, Guard } from './game';
import { HANDWORK } from './handwork';   // (asked inside the functions below only)

export const WORKSTOW = {
  /** THE switch (see the head) */
  on: false,
  /** a teammate: s from his gun let go of to both hands on the job · s from the job's end to the gun back up (no round inside either) · the share of `mateUp`
   *  after which the gun is drawn in his hands again */
  mateDown: 0.3, mateUp: 0.45, show: 0.6,
  /** you: s at most the job's clock waits for your hand to put the thing away (kit handling's errand; an errand something else took the arm from waits no longer) ·
   *  s at least before a round leaves what comes back into your hand (kit handling's own draw is longer and is the lock where it is on; the rifle's own beat too) */
  downMax: 1.6, samUp: 0.3,
  /** a teammate the fight has: s at most, at a stretch, his charge waits on it — then he sets it anyway (door tools' own cap for a lock under fire: kickCap + 3) */
  fightCap: 8,
};
/** the rule is live: its own switch, and the hands that do the work (handwork.ts — with those off there is no two-handed job to put a gun away for) */
const live = (): boolean => WORKSTOW.on && HANDWORK.on;
/** QA: how often each happened (the check reads them; nothing else does) */
export const WORKSTOW_STATS = { samDown: 0, samUp: 0, samKept: 0, mateDown: 0, mateUp: 0, mateFired: 0 };

// ---------------------------------------------------------------- you
/** is a charge going on by your own hands (the two jobs this module covers) */
const samJob = (g: Game): boolean => !!g.doorTools?.samJob || !!g.wallCharge?.samJob;
/** player.ts, at the head of his every frame (and again on the frame the trigger lets go of the job): a job begun puts away what is in his hand, a job over
 *  brings it back (`holster`: player.ts setHolstered, quiet) */
export function samStowTick(g: Game, holster: (g: Game, on: boolean) => void) {
  const pl = g.player, job = live() && !g.puppet && samJob(g), s = pl.workStow;
  if (!s) { if (!job) return;
    const w = pl.wall, owed = !!w?.drawn; if (w) w.drawn = false;   // (pressed to a wall: what the hold owed back to his hand is this job's to bring back — player.ts releaseWall hands nothing over as he comes off the wall onto it)
    const drew = !pl.holstered; pl.workStow = { drew: drew || owed, t: g.time, down: !drew };
    if (drew) { holster(g, true); g.audio.play('equip', null, 0.35); WORKSTOW_STATS.samDown++; }
    return; }
  if (job) { if (!s.down && g.time > s.t && (!pl.char.anim.kitBusy || g.time - s.t > WORKSTOW.downMax)) s.down = true; return; }
  pl.workStow = null;
  if (!s.drew || !pl.holstered) return;   // (nothing was put away — or he has drawn it himself since)
  if (pl.down || pl.holding || pl.takedown || pl.dragging || pl.picking || pl.wanding) { WORKSTOW_STATS.samKept++; return; }   // (his hands went to something that wants them empty: it stays where it is)
  if (pl.wall && pl.wall.kind !== 'stack') { pl.wall.drawn = true; WORKSTOW_STATS.samKept++; return; }   // (pressed to a wall: it comes back into his hand as he steps off — player.ts releaseWall)
  holster(g, false); pl.equipT = Math.max(pl.equipT, WORKSTOW.samUp); g.audio.play('equip', null, 0.35); WORKSTOW_STATS.samUp++;
}
/** the thing is still on its way out of his hand: the job's clock has not started (doortools.ts / wallcharge.ts samTick), and kit handling still has the arm (kitanim.ts) */
export const samStowing = (g: Game): boolean => { const s = g.player.workStow; return !!s && !s.down; };

// ---------------------------------------------------------------- the team
/** s a teammate's job waits, from the frame he is on it, for his hands to be free of his gun (0 with the switch off: its clock is what it was) */
export const mateStowLead = (): number => live() ? WORKSTOW.mateDown : 0;
/** once a frame of a teammate's two-handed job, by its owner: his gun is out of his hands (nothing with the switch off) */
export function mateStow(g: Game, gd: Guard) {
  if (!live() || gd.state === 'dead') return;
  const s = gd.workStow;
  if (!s || s.upT >= 0) { gd.workStow = { upT: -1, fed: true }; WORKSTOW_STATS.mateDown++; } else s.fed = true;
}
/** game.ts, once a frame for a man with one: a job that stopped being fed starts the gun back up, and it is his again `mateUp` later; his fire clock is held meanwhile */
export function mateStowTick(g: Game, gd: Guard) {
  const s = gd.workStow; if (!s) return;
  const an = gd.char.anim, K = WORKSTOW;
  if (gd.state === 'dead' || !live()) { gd.workStow = null; an.stowed = false; return; }
  if (s.upT < 0 && !s.fed) { s.upT = g.time + K.mateUp; WORKSTOW_STATS.mateUp++; }
  s.fed = false;
  if (s.upT >= 0 && g.time >= s.upT) { gd.workStow = null; an.stowed = false; return; }
  an.stowed = stowHang(g, gd);
  gd.fireCd = Math.max(gd.fireCd, s.upT < 0 ? K.mateUp : s.upT - g.time);
}
/** combat.ts guardProps: his gun is drawn out of his hands this frame (hung on its sling, or on his thigh) */
export const stowHang = (g: Game, gd: Guard): boolean => { const s = gd.workStow; return !!s && gd.state !== 'dead' && (s.upT < 0 || s.upT - g.time > WORKSTOW.mateUp * (1 - WORKSTOW.show)); };
/** combat.ts fireWeapon, the net under every other fire site: a round that leaves a gun this module has out of his hands puts it in them at once */
export function stowFired(gd: Guard) { gd.workStow = null; gd.char.anim.stowed = false; WORKSTOW_STATS.mateFired++; }
/** doortools.ts / wallcharge.ts 'place': THE FIGHT HAS HIM — his order yielded to it, he is blind or doubled over, or the room fight has brought his gun onto a
 *  man — so the job is dropped and waits (`op.stowOffT`: since when, this stretch: no such wait outlasts `fightCap`, and then he sets it with the fight on him) */
export function stowFight(g: Game, gd: Guard, A: { yieldT: number } | undefined, op: { stowOffT?: number }): boolean {
  const has = live() && ((!!A && A.yieldT >= 0) || g.time < gd.dazzledUntil || g.time < gd.staggerUntil || !!gd.script?.over);
  if (!has) { if (op.stowOffT !== undefined) op.stowOffT = undefined; return false; }
  return g.time - (op.stowOffT ??= g.time) < WORKSTOW.fightCap;
}
