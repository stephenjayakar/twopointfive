// The start card's SANDBOX row (the maintainer's ask, 08-12): god mode · no AI · unlimited ammo — three Game flags kept PER MACHINE.
// One store (`SANDBOX_LS`), written one key at a time by whichever UI flipped it (start card, pause card ▸ Settings ▸ Game, Tab ▸ Sandbox), read at
// boot (main.ts) and re-applied after a checkpoint load (savestate.ts: the file's flags round-trip, then this machine's preference wins — a load from an
// earlier run must not silently switch the guards back on under a 'no AI' session). Headless (no localStorage) every function here is a no-op.
type SandboxFlags = { godMode: boolean; aiEnabled: boolean; infiniteAmmo: boolean };
export const SANDBOX_LS = 'twopointsix.sandbox';
/** persist ONE of the three (read-modify-write: a show that forces god mode / AI on for its length must not leak into the preference when another box is flipped meanwhile) */
export function saveSandbox(game: SandboxFlags, key: 'god' | 'noAi' | 'ammo') {
  try { let j: any = null; try { j = JSON.parse(localStorage.getItem(SANDBOX_LS) ?? 'null'); } catch { /* junk */ } const o: Record<string, boolean> = (j && typeof j === 'object') ? j : {};
    o[key] = key === 'god' ? game.godMode : key === 'noAi' ? !game.aiEnabled : game.infiniteAmmo; localStorage.setItem(SANDBOX_LS, JSON.stringify(o)); } catch { /* private mode / headless */ }
}
/** apply what this machine last chose (absent / unreadable = leave the flags as they are); one console line when anything is non-default so no page runs 'no AI' silently */
export function loadSandbox(game: SandboxFlags, announce = true) {
  try { if (typeof localStorage === 'undefined') return; const j = JSON.parse(localStorage.getItem(SANDBOX_LS) ?? 'null'); if (!j || typeof j !== 'object') return;
    if (typeof j.god === 'boolean') game.godMode = j.god; if (typeof j.noAi === 'boolean') game.aiEnabled = !j.noAi; if (typeof j.ammo === 'boolean') game.infiniteAmmo = j.ammo;
    if (announce && (j.god || j.noAi || j.ammo)) console.log(`sandbox (start card, this machine): ${[j.god && 'god mode', j.noAi && 'NO AI', j.ammo && 'unlimited ammo'].filter(Boolean).join(' · ')}`);
  } catch { /* */ }
}
