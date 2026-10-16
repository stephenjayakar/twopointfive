// The office, loud, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): what no Training lesson makes a sound of. The OCP's dry click,
// furniture shoved, a door shut by hand, the corridor's tripwire, a locked door rattled and booted, the conference glazing shot out and walked over, the
// shift's own pistols, the lobby's toughened front, the steel stair door booted, a stun and a frag at his own feet, a smoke can, the breaker thrown and put
// back by hand, the response team's boots on the stairs, a pistol run dry, and the storm outside for as long as it all takes. Input only (the keys and the
// mouse a person has); he cannot be hurt, or the run would end at the first pistol. (The response team is shot as it comes: its carbines are heard in the
// 'Two pairs, two doors' replay.)
import type { Bot } from '../lesson-run';

export const query = '?solo', title = 'The office, loud';
export const mode = { god: true };

/** the left button HELD for `secs` with the cursor kept on a point */
const trigger = (B: Bot, at: () => number[], secs: number, stop?: () => boolean) => {
  B.aim(at()); B.step(); B.I.clicked |= 1;
  try { for (let i = 0; i < secs * 60; i++) { B.aim(at()); B.I.buttons |= 1; B.step(); if (stop && stop()) break; } } finally { B.I.buttons &= ~1; B.step(); }
};
const chest = (x: any): number[] => x.char.bones?.chest ?? [x.char.pos[0], 1.25, x.char.pos[2]];
const up = (x: any) => x.state !== 'dead';
const line = (B: Bot, x: any) => { const P = B.g.player.char, a = P.bones?.head ?? [P.pos[0], 1.5, P.pos[2]]; return !B.g.col.shotBlocked(a, chest(x)); };
const near = (B: Bot, x: any) => Math.hypot(x.char.pos[0] - B.pos()[0], x.char.pos[2] - B.pos()[2]);

/** the rifle on whoever is up with a line to him, for `secs` at most; `keep` = how many to leave standing */
function fight(B: Bot, secs: number, keep = 0): number {
  const g = B.g, P = g.player, t0 = B.t(); let n = 0;
  while (B.t() - t0 < secs && g.guards.filter(up).length > keep) {
    if (P.rifle.roundsReady === 0) { if (!P.rifle.reloading) B.press('KeyR'); else B.step(); continue; }
    const x = g.guards.filter((y: any) => up(y) && line(B, y)).sort((a: any, b: any) => near(B, a) - near(B, b))[0];
    if (!x) { B.step(); continue; }
    trigger(B, () => chest(x), 1.2, () => !up(x) || !line(B, x)); if (!up(x)) n++;
  }
  return n;
}

export function free(B: Bot) {
  const g = B.g, P = g.player;
  B.wait(1);
  // night vision down and up, and a whistle nobody is near enough to answer
  B.press('KeyN', 50); B.press('KeyN', 50); B.press('KeyV', 40);
  // the pistol's right button with no light under the cursor: the OCP's dry click
  B.press('Digit1', 30); if (!P.pistolUp) B.press('KeyE', 30); B.until(() => P.equipT <= 0, 3);
  B.click(2, [7.5, 0.05, 16.5]); B.wait(0.8);
  if (g.aimTarget || g.aimGuard) B.say('  the right click had something under it');

  // furniture: through the chair and the bin by the lobby's desk, at a walk and then at a run
  B.go([7.0, 0, 14.3], 10); B.nudge([9.6, 0, 14.0], 2.5);
  B.go([10.2, 0, 13.4], 6); B.go([12.2, 0, 12.6], 4, { sprint: true });

  // the conference room's door, which stands open: pulled shut by hand, so it latches (shut already: opened first)
  B.go([9.75, 0, 10.8], 15);
  if (B.g.nearby.some((r: any) => r.kind === 'door' && r.verb === 'push') && B.verb('door', 'push', [9.75, 1.0, 10.0])) B.wait(1.6);
  if (!B.verb('door', 'pull', [9.75, 1.0, 10.0])) B.say('  no row to shut the conference door'); B.wait(2.5);

  // down the corridor through its tripwire to the server room's locked door: the handle tried from a crouch, then the boot (which the whole floor hears)
  B.go([17.9, 0, 10.95], 20);
  const srv = g.doors.byName('server');
  if (srv?.isClosed()) {
    B.crouch(true); if (!B.verb('door', 'rattle', [17.9, 1.0, 10.0])) B.say('  no rattle row'); B.wait(1.2); B.crouch(false);
    if (!B.verb('door', 'kick', [17.9, 1.0, 10.0])) B.say('  no kick row'); B.wait(2);
  }

  // back to the conference room's glass wall with the rifle: rounds into two panes until they come down
  B.go([8.0, 0, 11.75], 30);
  B.press('Digit2', 5); B.until(() => P.equipT <= 0, 3);
  for (const x of [7.5, 8.5]) for (let i = 0; i < 5; i++) { B.click(1, [x, 1.4 + 0.1 * (i % 3), 10]); B.wait(0.3); }
  B.say(`  conference glass shot from ${B.pos()[0].toFixed(1)}, ${B.pos()[2].toFixed(1)} · shift up ${g.guards.filter(up).length}`);
  // over what fell, where it lies thickest (most of it is thrown into the room: its door is opened again for that), until it has crunched underfoot
  B.wait(2);
  { const S = g.shards as any, crunched = () => S.crunchN as number, n0 = crunched();
    // (only what lies in the conference room, x 4.12‥13.94 · z 4.12‥9.94, and on the corridor's width in front of its glazing: a round that went on through
    // a window leaves litter outside the building, where no path leads)
    const here = (c: number[]) => c[0] > 4.2 && c[0] < 13.9 && c[2] > 4.2 && c[2] < 12.1;
    const cells = [...(S.litter as Map<number, number>)].filter(([, a]) => a >= 0.004).sort((p, q) => q[1] - p[1])
      .map(([k]) => [(Math.floor(k / 4096) - 512 + 0.5) * 0.5, 0, (k % 4096 - 512 + 0.5) * 0.5]).filter(here).slice(0, 8);
    B.say(`  glass lies on ${S.litter.size} cells, ${cells.length} walked, thickest first: ${cells.map(c => `(${c[0]}, ${c[2]})`).join(' ')}`);
    if (cells.some(c => c[2] < 10) && g.doors.byName('conference')?.isClosed()) { B.go([9.75, 0, 10.8], 10); if (B.verb('door', 'push', [9.75, 1.0, 10.0])) B.wait(1.6); }
    const enough = () => crunched() >= n0 + 3;
    for (let pass = 0; pass < 3 && !enough(); pass++) { for (const c of cells) { if (enough()) break; B.go(c, 8, { near: 0.15, stop: enough }); }
      B.say(`  pass ${pass + 1}: at ${B.pos()[0].toFixed(1)}, ${B.pos()[2].toFixed(1)} · ${crunched() - n0} footfalls on glass`); }
    B.say(`  ${crunched() - n0} footfalls on glass`);
    B.go([8.0, 0, 11.4], 12); }

  // the shift has come to the noise with pistols: let them shoot for a few seconds, then the rifle on AUTO
  if (P.rifle.mode !== 'auto') B.press('KeyZ', 3);
  B.until(() => g.guards.some((x: any) => up(x) && x.state === 'alert' && line(B, x)), 12); B.wait(4);
  B.say(`  rifle on the shift · dropped ${fight(B, 25)} · qrf ${g.qrf.state}`);

  // the lobby's toughened front: one pane, three rounds
  B.go([6.5, 0, 19.3], 15); if (P.rifle.mode === 'auto') B.press('KeyZ', 3);
  for (let i = 0; i < 3; i++) { B.click(1, [4.0, 1.5, 19.25]); B.wait(0.3); }
  B.nudge([4.6, 0, 19.3], 2);

  // the steel door to the stairs takes a boot and rings
  B.go([5.0, 0, 11.0], 20);
  if (!B.verb('door', 'kick', [4.0, 1.0, 11.3])) B.say('  no kick row on the stair door'); B.wait(2);

  // up the corridor: a stun and a frag at his own feet on the way (god mode: he is stunned, not hurt), then a smoke can on ahead (it pops and hisses)
  B.go([9.0, 0, 11.1], 20);
  B.press('Digit4', 10); B.click(1, [10.6, 0.1, 11.1]); B.wait(3.5);
  B.press('Digit5', 10); B.click(1, [12.5, 0.1, 11.1]); B.wait(5.5);
  B.press('Digit3', 20); B.click(1, [22.0, 0.1, 11.1]); B.wait(3.5);

  // while the response team is on its way: the storage room at the corridor's far end — its lock booted, the breaker thrown by hand and the mains put
  // back the same way
  B.go([32.75, 0, 10.9], 45);
  if (g.doors.byName('storage')?.isClosed()) { if (!B.verb('door', 'kick', [32.75, 1.0, 10.0])) B.say('  no kick row on the storage door'); B.wait(2); }
  B.go([34.3, 0, 9.1], 15);
  if (B.verb('breaker', 'breakerOff', [34.3, 1.35, 9.86])) { B.until(() => g.blackout.active, 5); B.wait(3);
    if (!B.verb('breaker', 'breakerOn', [34.3, 1.35, 9.86])) B.say('  no row to re-arm the mains'); B.until(() => !g.blackout.active, 5); B.wait(2.5); }
  B.say(`  breaker worked · mains ${g.blackout.active ? 'OFF' : 'on'} · shift up ${g.guards.filter(up).length} · qrf ${g.qrf.state}`);

  // back out into the corridor to meet them
  B.go([30.0, 0, 11.1], 20);
  B.press('Digit2', 5); B.until(() => P.equipT <= 0, 3); if (P.rifle.mode !== 'auto') B.press('KeyZ', 3);
  B.say(`  waiting for the stairs · qrf ${g.qrf.state}`);
  B.until(() => g.qrf.state === 'deployed', 110);
  B.say(`  qrf ${g.qrf.state} at ${B.t().toFixed(1)} s · men up ${g.guards.filter(up).length}`);
  // their carbines for a while (they come to him), then the rifle again; an empty magazine clicked on once at the end
  B.until(() => g.guards.some((x: any) => up(x) && line(B, x)), 40); B.wait(8);
  fight(B, 30);
  B.press('Digit1', 20); B.until(() => P.equipT <= 0, 3);
  { const f = P.char.forward?.() ?? [-1, 0, 0], a = [B.pos()[0] + f[0] * 4, 1.2, B.pos()[2] + f[2] * 4];
    for (let i = 0; i < 40 && P.pistol.roundsReady > 0; i++) { B.click(1, a); B.wait(0.12); }
    B.click(1, a); B.wait(0.1); B.click(1, a); }
  B.wait(4);
}
