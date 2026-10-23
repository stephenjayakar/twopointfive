// A DRY GUN RELOADS ITSELF — the check behind src/game/autoreload.ts (RELOAD.auto: on in the page, ?noautoreload; off on the frozen stand, TPS_AUTORELOAD=1).
//   bun run tools/qa/autoreload-check.ts        (also `probes.ts autoreload`)
// One stood-up game (Sam alone in the corridor, the rifle up: fn2000-probes.ts stage), the switch thrown by hand, every trigger pull a real click:
//   (1) the rifle fired dry with a magazine left: no R pressed, the reload starts a beat after the last round, runs the row's own beat (the empty box dropped, the
//       fullest spare in, the handle racked) and ends with a round up; nobody was told to press R;
//   (2) the pistol the same;
//   (3) a magazine only part spent is left alone (R is still his);
//   (4) nothing to seat: no reload, and the line is the old one;
//   (5) a sprint takes the reload out of his hands; it starts again by itself when he stops — also when it was broken off between 'magazine in' and the rack;
//       an ankle in each hand (dragging a body): nothing starts by itself;
//   (6) a gun drawn dry is reloaded once it is up;
//   (7) unlimited ammo: the gun never runs dry and nothing starts;
//   (8) the switch off: the dry gun waits, the line asks for R, and R reloads it — the build as it was.
//   (5c) the same break on the LAST magazine (RELOAD.lastMag: on in the page, ?nolastmag; off on the frozen stand, TPS_LASTMAG=1): it restarts and R takes it;
//   (5d) with that switch off the gun is as it was: R refused, nothing restarts.
// AUTORELOAD_BREAK=1 = the rule left on for the 'off' lines: (8) must fail. LASTMAG_BREAK=1 = the last-magazine rule left off for (5c): it must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function autoreloadCheck(): Promise<boolean> {
  const { stage } = await import('./fn2000-probes.ts');
  const { RELOAD } = await import(`${ROOT}/src/game/autoreload.ts`);
  const DT = 1 / 60; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== autoreload: a dry gun in the player\'s hands starts its own reload ===');
  const W: any = await stage(4101); const { game, input } = W; const pl = game.player, rf = pl.rifle, gun = pl.pistol;
  const was = { ...RELOAD }; RELOAD.auto = true;
  const msgs: string[] = []; const orig = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return orig(t); };
  const AIM = [27.5, 1.2, 11.5];
  const kit = (f: any) => `chamber ${f.chamber} mag ${f.mag} spare [${f.spare.join(',')}]`;
  const idle = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt(AIM); W.step(DT); } };
  /** click every frame until the gun in hand is dry (or `cap` frames): the frame count of the last round */
  const dry = (f: any, cap = 400) => { let last = -1; for (let i = 0; i < cap && f.roundsReady > 0; i++) { const n = f.shotsFired; W.cursorAt(AIM); input.clicked |= 1; W.step(DT); if (f.shotsFired > n) last = i; } return last; };
  /** frames until `f` is reloading (−1 = never inside n), nothing pressed */
  const waitReload = (f: any, n: number) => { for (let i = 0; i < n; i++) { if (f.reloading) return i; W.cursorAt(AIM); W.step(DT); } return f.reloading ? n : -1; };
  const pressedR = () => input.pressed.has('KeyR');
  try {
    // (1) the rifle
    { rf.cancelReload(); rf.chamber = 1; rf.mag = 2; rf.spare = [30, 25]; msgs.length = 0; const items0 = new Set(game.items.items);
      const shot = dry(rf); const at = waitReload(rf, 60); const anim = pl.char.anim.reloading; idle(170);
      const box = game.items.items.filter((it: any) => !items0.has(it) && it.kind === 'mag');
      const ok = shot >= 0 && at >= 10 && at <= 20 && anim && !rf.reloading && kit(rf) === 'chamber 1 mag 29 spare [25]' && box.length === 1 && !msgs.some(m => /press R|\(R\)/.test(m)) && msgs.some(m => /^reloading the /.test(m)) && !pressedR();
      line(ok, 'the rifle fired dry with a magazine left: its reload starts by itself a beat after the last round, the empty box drops, the fullest spare goes in, a round is racked; no line asks for R',
        `reload began ${at} frames after the gun went dry (want 10‥20: ${RELOAD.delay} s) · animator ${anim} · ${kit(rf)} · ${box.length} box dropped · ${JSON.stringify(msgs)}`); }
    // (3) part spent: left alone
    { rf.cancelReload(); rf.chamber = 1; rf.mag = 5; rf.spare = [30]; idle(90);
      line(!rf.reloading && kit(rf) === 'chamber 1 mag 5 spare [30]', 'a magazine only part spent is left alone for a second and a half (R is still the player\'s)', kit(rf)); }
    // (4) nothing to seat
    { rf.cancelReload(); rf.chamber = 1; rf.mag = 1; rf.spare = []; msgs.length = 0; dry(rf); const at = waitReload(rf, 90);
      W.cursorAt(AIM); input.clicked |= 1; W.step(DT);
      line(at === -1 && msgs.some(m => /empty\. press R to reload/.test(m)) && msgs.some(m => /is empty \(R\)/.test(m)), 'no magazine left: nothing starts, and the lines are the old ones', `${kit(rf)} · ${JSON.stringify(msgs)}`); }
    // (5) a sprint breaks it; it starts again
    { rf.cancelReload(); rf.chamber = 0; rf.mag = 0; rf.spare = [30]; const a = waitReload(rf, 60); idle(5);
      input.keys.add('ShiftLeft'); input.keys.add('KeyD'); idle(25); const broken = !rf.reloading; input.keys.delete('ShiftLeft'); input.keys.delete('KeyD');
      const b = waitReload(rf, 90); idle(170);
      line(a >= 0 && broken && b >= 0 && kit(rf) === 'chamber 1 mag 29 spare []', 'a sprint takes the reload out of his hands, and it starts again by itself once he stops', `first at +${a} · broken off ${broken} · again at +${b} after the keys came up · ${kit(rf)}`); }
    // (5b) broken off after the magazine went in and before the rack: a full magazine under an empty chamber is still a dry gun
    { rf.cancelReload(); rf.chamber = 0; rf.mag = 0; rf.spare = [30, 30]; const a = waitReload(rf, 60); let n = 0; while (rf.reloading && rf.stage < 2 && n++ < 400) idle(1);   // (stage 2 = the magazine is in, the handle not yet racked)
      const mid = rf.reloading && rf.chamber === 0 && (rf.mag ?? 0) > 0;
      input.keys.add('ShiftLeft'); input.keys.add('KeyD'); idle(20); const st = `${kit(rf)} reloading ${rf.reloading} canFire ${rf.canFire()}`; input.keys.delete('ShiftLeft'); input.keys.delete('KeyD');
      const b = waitReload(rf, 90); idle(190);
      line(a >= 0 && mid && b >= 0 && rf.chamber === 1 && rf.canFire(), 'a sprint between the magazine going in and the rack leaves a full magazine under an empty chamber: that reload starts again by itself too, and ends with a round up', `first at +${a} · caught between in and rack ${mid} · after the sprint: ${st} · again at +${b} · ${kit(rf)}`); }
    // (5c) the same break on the LAST magazine: nothing is left to seat, and the full magazine under the empty chamber is still reloaded (RELOAD.lastMag)
    { RELOAD.lastMag = process.env.LASTMAG_BREAK !== '1';
      rf.cancelReload(); rf.chamber = 0; rf.mag = 0; rf.spare = [30]; const a = waitReload(rf, 60); let n = 0; while (rf.reloading && rf.stage < 2 && n++ < 400) idle(1);
      const mid = rf.reloading && rf.chamber === 0 && (rf.mag ?? 0) > 0 && rf.spare.length === 0;
      input.keys.add('ShiftLeft'); input.keys.add('KeyD'); idle(20); const st = `${kit(rf)} reloading ${rf.reloading} canFire ${rf.canFire()}`; input.keys.delete('ShiftLeft'); input.keys.delete('KeyD');
      const b = waitReload(rf, 90); idle(190); const auto = `${kit(rf)} canFire ${rf.canFire()}`, autoOk = b >= 0 && kit(rf) === 'chamber 1 mag 29 spare []' && rf.canFire();
      RELOAD.auto = false; rf.cancelReload(); rf.chamber = 0; rf.mag = 30; rf.spare = []; msgs.length = 0; idle(5); input.pressed.add('KeyR'); W.step(DT); const byR = rf.reloading; idle(190); RELOAD.auto = true;
      line(a >= 0 && mid && autoOk && byR && kit(rf) === 'chamber 1 mag 29 spare []' && !msgs.some(m => /no spare/.test(m)), 'the last magazine, in and not racked when a sprint broke the reload: it starts again by itself and ends with a round up, and with the rule off R takes it too',
        `first at +${a} · caught between in and rack with nothing spare ${mid} · after the sprint: ${st} · again at +${b}: ${auto} · by R alone: took ${byR}, ${kit(rf)} · ${JSON.stringify(msgs)}`); }
    // (5d) the switch off: that gun is the build as it was — R is refused and nothing restarts
    { RELOAD.lastMag = false; rf.cancelReload(); rf.chamber = 0; rf.mag = 30; rf.spare = []; msgs.length = 0; const b = waitReload(rf, 90); input.pressed.add('KeyR'); W.step(DT); const byR = rf.reloading; idle(30);
      line(b === -1 && !byR && !rf.canFire() && kit(rf) === 'chamber 0 mag 30 spare []', 'the last-magazine switch off: nothing restarts and R is refused, as it was', `auto ${b} · R took ${byR} · ${kit(rf)} canFire ${rf.canFire()} · ${JSON.stringify(msgs)}`);
      RELOAD.lastMag = was.lastMag; rf.cancelReload(); rf.chamber = 1; rf.mag = 30; rf.spare = [30]; }
    // (3b) dragging a body with the dry pistol selected: nothing starts by itself
    { gun.cancelReload(); const was2 = { slot: pl.slot, hol: pl.holstered, drag: pl.dragging }; gun.chamber = 0; gun.mag = 0; gun.spare = [10];
      const { autoReloadDue } = await import(`${ROOT}/src/game/autoreload.ts`); pl.dragging = {} as any; const due = autoReloadDue(game, pl, gun); pl.dragging = was2.drag; const free = autoReloadDue(game, pl, gun);
      line(!due && free, 'an ankle in each hand: the rule does not start a reload while he drags a body, and does once his hands are free', `due while dragging ${due} · due with free hands ${free}`); gun.chamber = 1; gun.mag = 10; }
    // (7) unlimited ammo
    { rf.cancelReload(); rf.chamber = 1; rf.mag = 1; rf.spare = [30]; game.infiniteAmmo = true; idle(2); const n0 = rf.shotsFired; for (let i = 0; i < 90; i++) { W.cursorAt(AIM); input.clicked |= 1; W.step(DT); }
      const fired = rf.shotsFired - n0, rel = rf.reloading; game.infiniteAmmo = false; idle(2);
      line(fired >= 5 && !rel && rf.spare.length === 1, 'unlimited ammo: the gun fires on and nothing is reloaded', `${fired} rounds in a second and a half · reloading ${rel} · ${kit(rf)}`); }
    // (2) + (6) the pistol: emptied while it is on his thigh, then drawn dry
    { rf.cancelReload(); rf.chamber = 1; rf.mag = 30; rf.spare = [30]; gun.cancelReload(); gun.chamber = 0; gun.mag = 0; gun.spare = [10, 10]; msgs.length = 0;
      input.pressed.add('Digit1'); W.step(DT); const up0 = pl.pistolUp; const at = waitReload(gun, 120); const eq = pl.equipT; idle(140);
      line(up0 !== undefined && at >= 0 && eq <= 0 && !gun.reloading && gun.chamber === 1 && gun.spare.length === 1 && msgs.includes('reloading'), 'the pistol drawn dry: once it is up its reload starts by itself and ends with a round chambered', `began ${at} frames after the 1 key (the equip beat over: ${eq <= 0}) · ${kit(gun)} · ${JSON.stringify(msgs)}`);
      gun.cancelReload(); gun.chamber = 1; gun.mag = 1; gun.spare = [10]; msgs.length = 0; idle(20); const shot = dry(gun); const at2 = waitReload(gun, 60); idle(140);
      line(shot >= 0 && at2 >= 10 && at2 <= 20 && gun.chamber === 1 && gun.spare.length === 0 && !msgs.some(m => /press R|R to reload/.test(m)), 'the pistol fired dry: the same — a beat, then the reload, no line asking for R', `began +${at2} · ${kit(gun)} · ${JSON.stringify(msgs)}`); }
    // (8) off = as it was
    { RELOAD.auto = process.env.AUTORELOAD_BREAK === '1';
      gun.cancelReload(); gun.chamber = 1; gun.mag = 1; gun.spare = [10]; msgs.length = 0; idle(20); dry(gun); const at = waitReload(gun, 120);
      W.cursorAt(AIM); input.clicked |= 1; W.step(DT); const waited = [...msgs]; input.pressed.add('KeyR'); W.step(DT); const byR = gun.reloading; idle(140);
      line(at === -1 && waited.includes("you're empty. press R to reload") && waited.includes('click — empty (R to reload)') && byR && gun.chamber === 1, 'the switch off: the dry pistol waits two seconds, both old lines are said, and R reloads it', `auto ${at} · ${JSON.stringify(waited)} · R took ${byR} · ${kit(gun)}`); }
  } finally { Object.assign(RELOAD, was); game.msg = orig; }
  console.log(`=== autoreload: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await autoreloadCheck()) ? 0 : 1);
