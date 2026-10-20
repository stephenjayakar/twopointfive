// The 'he40' family (game/he40.ts — the FN2000 launcher's 40 mm high-explosive round: the launcher's second load beside the ring airfoil), run through probes.ts:
//   bun run tools/qa/probes.ts he40 | he40-keys | he40-burst | he40-dud | he40-preview | he40-quiet
// PASS / FAIL each, all headless (the Game of headless.ts, its staging borrowed from fn2000-probes.ts). No picture and no sound here: the round in the air, the
// burst, the stand-in thump, the reticle's word and the dud on the floor are untested by eye and ear.
//   he40-keys     a fresh rifle has the RING up (never nothing); 2 again with the rifle up flips RING ⇄ 40 MM and says so both ways; the kit column's row 2
//                 carries 'RING ×5' and '40MM ×3', the one that is up lit; the right button is press-then-release: no arc at rest, the press frame holds the
//                 arc and sends nothing (and no plain checkpoint while it is held), the next frame sends one and the count drops; a press inside the tube's
//                 reload is refused and begins nothing; held, the arc stays up and nothing goes; Esc (Game.escape, and the key inside a frame) drops it
//                 unsent and the button still down begins nothing; letting go of a held one sends one; with none left it says so (and where the other load
//                 is); a checkpoint keeps the count and the load, a file from when 'nothing' could be selected (attIdx −1) loads with the RING up, and none
//                 is written while a round is in the air; your kit card has the row and it sets the count
//   he40-burst    a man 14 m down the corridor: the arc on the press frame reads armed, one right click, the round is there in under half a second and he is
//                 dead — by frag.ts's blast (one report in FRAG_LOG named '40 mm grenade', one 'bang' event flagged frag, ONE call into the destruction lane),
//                 no gunfire event, the tube's thump a 'prop' at Sam; Sam, 14 m off, is not in the report
//   he40-dud      the same man 5 m off: no blast at all (no report, no bang, no destruction call) — he folds and is alert, alive; a 'shell' item lies there and
//                 stays inert; a wall 3 m off: a dud and a clack nobody made; a wall 9 m off: the burst — and Sam, standing where he fired from, untouched
//   he40-preview  the previewed arc IS the flight (three arcs, within 6 cm), and 'armed' read off the preview agrees with what the round then does
//   he40-quiet    with the 40 mm never put on the button (the RING is the load a fresh rifle has up) nothing of it runs: no round in the air, the digest's rifle word unchanged ('… r5', no 'g'), the ring still
//                 flies its own table (launcher.ts ringSolve ≡ arcSolve by RING)
import { ROOT } from './headless.ts';
import { stage, stageRing, family, hudText, eventTap, listen, distToSeg, rmbTap, rmbHold, rmbUp } from './fn2000-probes.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { HE40, HE40_LOG, HE40_STATS, he40StatsReset, fireShell, shellSolve, shellMan, shellBodies, arcArmed, arcLength, previewTooClose } = await import(`${ROOT}/src/game/he40.ts`);
const { RING, ringSolve, arcSolve } = await import(`${ROOT}/src/game/launcher.ts`);
const { gearText, ringTag, shellTag } = await import(`${ROOT}/src/game/gear.ts`);   // (the kit's words as issued: the old kit's on the frozen stand, the issue kit's under TPS_GEAR=1)
const { FRAG, FRAG_LOG, fragStatsReset } = await import(`${ROOT}/src/game/frag.ts`);
const { LAUNCHER, LAUNCHER40 } = await import(`${ROOT}/src/game/weapons.ts`);
const { KIT, SLOTS, kitRows, kitSet, kitPlayer, kitShow, kitReset, kitTreeOn } = await import(`${ROOT}/src/game/kit.ts`);
const { squad40Here } = await import(`${ROOT}/src/game/squad40.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { canSave } = await import(`${ROOT}/src/game/savestate.ts`);
const { aimGunOn } = await import(`${ROOT}/src/game/aimweight.ts`);   // (the player's aim has weight on the shipped stand: a tap waits for the gun to be on the cursor)

type Vec3 = [number, number, number];
const DT = 1 / 60;
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
/** count every call into the destruction lane a blast may make (the engine's entry point where the build has one, else the stun charge's hook) */
function destrTap(game: any) { const T = { n: 0 }; let depth = 0; for (const k of ['bang', 'blast']) { const f = game.destr[k]; if (typeof f === 'function') { const b = f.bind(game.destr); game.destr[k] = (...a: any[]) => { if (!depth) T.n++; depth++; try { return b(...a); } finally { depth--; } }; } } return T; }   // (calls from OUTSIDE the lane: the engine's blast() runs the lane's own bang() inside it)
function fresh() { he40StatsReset(); fragStatsReset(); }
/** the rifle is up (stage) with the RING on its button, as every fresh one: its digit once more = the 40 mm. True if that is what is up after it. */
function select40(W: any): boolean { const { input } = W; input.pressed.add('Digit2'); W.step(DT); return W.game.player.rifle.attachment === 'he40'; }

export async function he40Keys() {
  const F = family('he40-keys: 2 again flips RING ⇄ 40 MM (never nothing); the count on the kit column and the card; the right button\'s press-then-release, held, Esc, the tube\'s reload, the last round; a checkpoint keeps the count and the load');
  fresh(); const W = await stage(2301); const { game, input } = W; const pl = game.player, rf = pl.rifle;
  // What the stand DEALT him is held against his card ((a)'s last line); the keys below are asked of a tube with the rifle's own three in it
  // whatever the stand (the page's pouch rule issues one round: 3 → 2 → 1 → the last → dry needs three).
  const dealt = rf.shells, card0 = KIT.members[0].shells; rf.shells = LAUNCHER40.rounds;
  const msgs: string[] = []; const origMsg = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return origMsg(t); };
  const AHEAD: Vec3 = [35.5, 1.2, 11.5];
  const settle = (n = 4) => { for (let f = 0; f < n; f++) { W.cursorAt(AHEAD); W.step(DT); } };
  const press = (code: string) => { input.pressed.add(code); settle(); };
  { const fails: string[] = []; const tr: string[] = [];
    const h0 = hudText(game); if (rf.attachment !== 'ring' || rf.attIdx !== 0) fails.push(`fresh: the load up is ${rf.attachment} (attIdx ${rf.attIdx}) — want the RING, never nothing`);
    if (!h0.includes(`span.tag.rings.on{${ringTag()} ×5} span.tag.rings.shells{${shellTag()} ×3}`) || /tag\.rings\.shells\.on/.test(h0)) fails.push(`row 2 fresh: ${h0.split(' | ').find(x => /key\{2\}/.test(x))} (want the first load's tag lit and a dim 40MM ×3)`);
    for (const want of ['he40', 'ring', 'he40', 'ring', 'he40'] as const) {
      msgs.length = 0; press('Digit2'); tr.push(String(rf.attachment)); if (rf.attachment !== want) fails.push(`2 again: ${rf.attachment} (want ${want} — the two in turn, never nothing)`);
      if (want === 'he40' && !msgs.some(m => /40 mm grenade ×3 on the right button/.test(m) && m.includes(`arms ${HE40.armM} m`) && m.includes(gearText('2 again for the ring airfoil')))) fails.push(`the 40 mm put up said "${msgs.at(-1)}"`);
      if (want === 'ring' && !msgs.some(m => m.includes(gearText('ring airfoil ×5 on the right button')) && m.includes(gearText('2 again for the 40 mm')))) fails.push(`the ring put back up said "${msgs.at(-1)}"`);
    }
    const h1 = hudText(game);
    if (!h1.includes(`span.tag.rings{${ringTag()} ×5} span.tag.rings.shells.on{${shellTag()} ×3}`)) fails.push(   // (both tags follow the issue kit: RING and 40MM, or SPONGE and HE under gear.ts)
      `row 2 with the 40 mm up: ${h1.split(' | ').find(x => /key\{2\}/.test(x))}`);
    if (dealt !== card0 || rf.shells !== LAUNCHER40.rounds || LAUNCHER40.rounds !== 3 || (!SLOTS.on && card0 !== LAUNCHER40.rounds)) fails.push(`dealt ${dealt}, his card's ${card0} (LAUNCHER40.rounds ${LAUNCHER40.rounds}, the pouch rule ${SLOTS.on ? 'on' : 'off'})`);
    F.verdict(!fails.length, '(a) a fresh rifle has the RING up; its digit again: → 40 MM → RING → 40 MM → …, never nothing, each said with its count (the 40 mm with its arming distance) and the way back; row 2 reads RING ×5 then 40MM ×3, the one that is up lit', fails.join('; ') || `${tr.join(' → ')} · ${h1.split(' | ').find(x => /key\{2\}/.test(x))?.slice(-120)}`); }
  { const fails: string[] = [];
    const at = (): Vec3 => AHEAD;
    settle(4); const restArc = !!pl.throwPreview, restHeld = pl.launchHeld, restShort = previewTooClose(game); const why0 = canSave(game, false);
    // one click: the press frame holds the arc and sends nothing (and is no moment for a plain checkpoint); the next frame — the button up — sends it
    let pts = 0, heldP: any = null, airP = -1, leftP = -1, whyP: string | null = null;
    rmbTap(W, at, () => { pts = pl.throwPreview?.points.length ?? 0; heldP = pl.launchHeld; airP = game.shells.length; leftP = rf.shells; whyP = canSave(game, false); });
    const air1 = game.shells.length, left1 = rf.shells, cd1 = rf.ringCd, held1 = pl.launchHeld;
    if (restArc || restHeld !== null || restShort) fails.push(`at rest with the 40 mm up: arc ${restArc ? 'drawn' : 'none'}, launchHeld ${restHeld}, previewTooClose ${restShort} (want no arc and nothing held until the button goes down)`);
    if (pts < 2 || heldP !== 'he40') fails.push(`the press frame: ${pts} arc points, launchHeld ${heldP} (want the arc up and 'he40' held)`);
    if (airP !== 0 || leftP !== 3) fails.push(`the press frame: ${airP} in the air, ${leftP} left (want nothing sent yet: 0, 3)`);
    if (why0 ? !whyP : !/lining up the launcher/.test(whyP ?? '')) fails.push(`a plain checkpoint with the button down: ${whyP ? `refused for "${whyP}"` : 'allowed'} (before the press: ${why0 ?? 'allowed'}; want 'lining up the launcher')`);
    if (air1 !== 1 || left1 !== 2 || held1 !== null) fails.push(`the frame after the click: ${air1} in the air, ${left1} left, launchHeld ${held1} (want 1, 2, nothing held)`);
    if (!(cd1 > LAUNCHER40.cd - 0.1)) fails.push(`the tube's clock ${f2(cd1)} (want ${LAUNCHER40.cd})`);
    { const why = canSave(game, false); if (why0 ? !why : !/40 mm/.test(why ?? '')) fails.push(`a plain checkpoint with a round in the air: ${why ? `refused for "${why}"` : 'allowed'} (before the click: ${why0 ?? 'allowed'})`); }
    W.cursorAt(AHEAD); W.step(DT); if (pl.throwPreview) fails.push('the arc is still drawn the frame after the round left');
    // a press inside the tube's reload: refused on the press frame, said so, and no gesture begun (nothing goes on the release either)
    msgs.length = 0; let heldR: any = 'unset'; rmbTap(W, at, () => { heldR = pl.launchHeld; });
    if (rf.shells !== 2 || heldR !== null || pl.throwPreview || !msgs.some(m => /loading the launcher/.test(m))) fails.push(`a second click inside the reload: ${rf.shells} left, launchHeld ${heldR} on its press frame, "${msgs.at(-1)}" (want 2, nothing begun, 'loading the launcher…')`);
    for (let f = 0; f < 60 * 3; f++) settle(1);
    if (game.shells.length) fails.push('the round never landed');
    if (rf.ringCd > 0) fails.push(`the tube still closing three seconds on (${f2(rf.ringCd)})`);
    // held: the arc stays up and nothing goes; Esc lets go of it unsent and the button still down begins nothing
    { let heldAll = true, arcAll = true, gone = 0; rmbHold(W, at, 9, () => { heldAll &&= pl.launchHeld === 'he40'; arcAll &&= (pl.throwPreview?.points.length ?? 0) >= 2; gone = Math.max(gone, 2 - rf.shells + game.shells.length); });
      if (!heldAll || !arcAll || gone) fails.push(`the right button held 9 frames: launchHeld 'he40' throughout ${heldAll}, the arc up throughout ${arcAll}, ${gone} gone (want the arc and nothing gone)`);
      const esc = game.escape(); const heldE = pl.launchHeld, arcE = !!pl.throwPreview; const esc2 = game.escape();
      if (!esc || heldE !== null || arcE) fails.push(`Game.escape() with the button down: used ${esc}, launchHeld ${heldE}, arc ${arcE ? 'still up' : 'gone'} (want it taken — no pause menu on that press — and the gesture and its arc dropped)`);
      if (esc2) fails.push('Game.escape() a second time, nothing held any more, was still taken');
      let begun = false; for (let f = 0; f < 5; f++) { W.cursorAt(AHEAD); input.buttons |= 4; W.step(DT); begun ||= pl.launchHeld !== null || !!pl.throwPreview; }
      rmbUp(W, at); settle(3);
      if (begun) fails.push('the button still down after Esc began a gesture again (only a fresh press may)');
      if (rf.shells !== 2 || game.shells.length) fails.push(`after Esc and letting go: ${rf.shells} left, ${game.shells.length} in the air (want 2, 0: unsent)`); }
    // … the Esc KEY inside a frame does the same (the page's handler asks Game.escape first; a frame that sees the key drops it too), and so does the window losing focus
    for (const key of ['Escape', 'Blur']) { rmbHold(W, at, 4); const before = pl.launchHeld; W.cursorAt(AHEAD); input.buttons |= 4; input.pressed.add(key); W.step(DT); const heldK = pl.launchHeld; let begun = false; for (let f = 0; f < 3; f++) { W.cursorAt(AHEAD); input.buttons |= 4; W.step(DT); begun ||= pl.launchHeld !== null; } rmbUp(W, at); settle(3);
      if (before !== 'he40' || heldK !== null || begun || rf.shells !== 2 || game.shells.length) fails.push(`'${key}' inside a frame with the button down: held before ${before}, after ${heldK}, begun again ${begun}, ${rf.shells} left, ${game.shells.length} in the air (want it dropped unsent)`); }
    // … and a held one let go of sends ONE
    { let gone = 0; rmbHold(W, at, 8, () => { gone = Math.max(gone, 2 - rf.shells); }); rmbUp(W, at); const airU = game.shells.length, leftU = rf.shells, heldU = pl.launchHeld; settle(8);
      if (gone || airU !== 1 || leftU !== 1 || heldU !== null || rf.shells !== 1) fails.push(`held 8 frames then let go: ${gone} gone while held, then ${airU} in the air, ${leftU} left, launchHeld ${heldU}, ${rf.shells} left 8 frames on (want 0, then 1, 1, nothing held, 1)`); }
    for (let f = 0; f < 60 * 3; f++) settle(1);
    if (game.shells.length) fails.push('the second round never landed');
    // the count and the load through a checkpoint
    const snap = W.snapshot('he40', true); rf.shells = 0; rf.attIdx = 0; W.restore(snap); const rf2 = game.player.rifle;
    if (rf2.shells !== 1 || rf2.attachment !== 'he40') fails.push(`after a load: ${rf2.shells} left, the load up ${rf2.attachment} (want 1, he40)`);
    if (snap.player.rifle.attIdx !== rf2.attachments.indexOf('he40')) fails.push(`the file's attIdx is ${snap.player.rifle.attIdx} (want the 40 mm's, ${rf2.attachments.indexOf('he40')})`);
    { const old = JSON.parse(JSON.stringify(snap)); delete old.player.rifle.shells; game.player.rifle.shells = 2; W.restore(old); if (game.player.rifle.shells !== dealt) fails.push(`a file from before the 40 mm loaded ${game.player.rifle.shells} (want what the stand deals him, ${dealt})`); }   // (2: neither stand's deal)
    { const old = JSON.parse(JSON.stringify(snap)); old.player.rifle.attIdx = -1; W.restore(old); const r = game.player.rifle; if (r.attIdx !== 0 || r.attachment !== 'ring') fails.push(`a file from when nothing could be selected (attIdx −1) loaded attIdx ${r.attIdx}, ${r.attachment} (want 0: the RING up)`); if (r.shells !== 1) fails.push(`… and ${r.shells} rounds (want the file's 1)`); W.restore(snap); }
    F.verdict(!fails.length, '(b) the right button with the 40 mm up: no arc at rest; the press frame holds the arc and fires nothing (no plain checkpoint: lining up the launcher), the next frame sends one, 3 → 2, the tube reloading (a press inside it is refused, says so and begins nothing); held 9 frames nothing goes, Esc (the call, the key, the window\'s blur) drops it unsent and the button still down begins nothing; held then let go sends one, 2 → 1; no plain checkpoint while a round flies; a load brings back the count and the load, an older file the issue, an attIdx −1 file the RING', fails.join('; ') || `cd ${f2(cd1)} s · after load ${rf2.shells} left`); }
  { const fails: string[] = []; const pl2 = game.player, r2 = pl2.rifle; game.msg = (t: string) => { msgs.push(t); return origMsg(t); };
    for (let f = 0; f < 50; f++) settle(1);   // (a load is a fresh Player: the rifle back up, the equip beat out)
    if (!pl2.rifleUp) { input.pressed.add('Digit2'); for (let f = 0; f < 40; f++) settle(1); }
    r2.shells = 1; r2.ringCd = 0; r2.attIdx = r2.attachments.indexOf('he40'); settle(2);
    const at = (): Vec3 => AHEAD; const audio = listen(W);
    msgs.length = 0; let leftP = -1; rmbTap(W, at, () => { leftP = r2.shells; });
    if (leftP !== 1 || r2.shells !== 0 || !msgs.some(m => /last 40 mm/.test(m))) fails.push(`the last one: ${leftP} left on the press frame, ${r2.shells} after it, "${msgs.at(-1)}" (want 1, 0, said so)`);
    for (let f = 0; f < 60 * 3; f++) settle(1);
    msgs.length = 0; const air0 = game.shells.length; const a0 = audio.length; let heldD: any = 'unset', arcD = false;
    rmbTap(W, at, () => { heldD = pl2.launchHeld; arcD = !!pl2.throwPreview; });
    if (game.shells.length !== air0 || heldD !== null || !msgs.some(m => m.includes(gearText('no 40 mm grenades left (2 again for the ring airfoil)'))) || !audio.slice(a0).some((a: any) => a.name === 'dryFire')) fails.push(`a click with none left: ${game.shells.length} in the air, launchHeld ${heldD} on the press frame, "${msgs.at(-1)}", dry click ${audio.slice(a0).some((a: any) => a.name === 'dryFire')} (want nothing sent, nothing begun, the dry click, and the word with where the other load is)`);
    if (arcD || pl2.throwPreview) fails.push('an arc is still previewed with none left');
    { const keep = r2.rings; r2.rings = 0; settle(2); msgs.length = 0; rmbTap(W, at); if (!msgs.some(m => /no 40 mm grenades left$/.test(m))) fails.push(`none of either load left: "${msgs.at(-1)}" (want 'no 40 mm grenades left' with no way to another load)`);
      r2.attIdx = r2.attachments.indexOf('ring'); r2.shells = 1; settle(2); msgs.length = 0; let heldG: any = 'unset'; rmbTap(W, at, () => { heldG = pl2.launchHeld; }); if (heldG !== null || game.rings.length || !msgs.some(m => m.includes(gearText('no ring airfoils left — they are not coming back (2 again for the 40 mm)')))) fails.push(`the RING up with no rings and a 40 mm left: launchHeld ${heldG}, ${game.rings.length} in the air, "${msgs.at(-1)}" (want the dry click and the way to the 40 mm)`);
      r2.rings = keep; r2.shells = 0; r2.attIdx = r2.attachments.indexOf('he40'); settle(2); }
    game.infiniteAmmo = true; r2.shells = 1; r2.ringCd = 0; settle(2); const airI = game.shells.length; rmbTap(W, at); if (r2.shells !== 1 || game.shells.length !== airI + 1) fails.push(`unlimited ammo: ${r2.shells} left after a round, ${game.shells.length - airI} sent (want 1 left, 1 sent)`); game.infiniteAmmo = false;
    W.audioLog = null;
    F.verdict(!fails.length, '(c) the last round says so (on the frame it leaves, the one after the press); with none left the press clicks dry, says so with where the other load is (and without, when that is out too; the ring likewise), begins nothing, and no arc is drawn; unlimited ammo (the sandbox row) does not count them down', fails.join('; ') || `"${msgs.at(-1)}"`); }
  { const fails: string[] = []; const was = KIT.on; KIT.on = true; kitReset();
    const row = kitRows(0).find((r: any) => r.field === 'shells');
    // the card's issue: the rifle's own three — or, under the pouch rule (the page), what the issued card has room for; a card that is not the rifle's three is WRITTEN at every staging
    const issue = KIT.members[0].shells, asIssued = issue, other = issue === 1 ? 0 : 1;
    if (!row || row.values.join(',') !== '0,1,2,3,4' || (SLOTS.on ? issue < 1 || issue > LAUNCHER40.rounds : issue !== LAUNCHER40.rounds)) fails.push(`your card's row: ${row ? row.values.join(',') : 'missing'}, issued ${issue}`);
    // (a teammate's card has the row only where his round can be fired on your order — the card as a tree and squad40.ts in the build; kittree-check.ts holds it)
    { const his = kitRows(1).find((r: any) => r.field === 'shells'), may = kitTreeOn() && squad40Here();
      if (!!his !== may || (his && his.values.join(',') !== '0,1')) fails.push(`a teammate's card ${his ? `has the row (${his.values.join(',')})` : 'has no row'} where his round ${may ? 'can' : 'cannot'} be fired on your order`); }
    const pl3 = game.player; pl3.rifle.shells = LAUNCHER40.rounds;
    kitPlayer(game); if (pl3.rifle.shells !== asIssued) fails.push(`as issued wrote ${pl3.rifle.shells}`);
    const took = kitSet(0, 'shells', other); kitPlayer(game); const got = pl3.rifle.shells; kitShow(game); const back = pl3.rifle.shells;
    if (!took || got !== other || back !== LAUNCHER40.rounds) fails.push(`card at ${other}${took ? '' : ' (the card refused it)'}: the rifle has ${got}; the card off: ${back}`);
    if (kitSet(0, 'shells', 5)) fails.push('the card took 5');
    kitReset(); KIT.on = was;
    if (KIT.members[0].shells !== issue || (!SLOTS.on && issue !== LAUNCHER40.rounds)) fails.push(`the card's issue is ${KIT.members[0].shells} (it was ${issue}), the rifle's ${LAUNCHER40.rounds}`);   // (kit.ts writes the number as a literal: the import cycle)
    if (!String(row.note(KIT.members[0])).includes(`${HE40.armM} m`)) fails.push(`the row's note does not say the ${HE40.armM} m it arms at`);
    if (HE40.armM < FRAG.woundM) fails.push(`it arms at ${HE40.armM} m, inside the blast's ${FRAG.woundM} m`);
    F.verdict(!fails.length, '(d) your kit card has a "40 mm grenades" row, 0 to 4, issued the rifle\'s three (under the pouch rule, what the issued card has room for): the card as issued leaves the rifle\'s three alone, another count is put in the tube, the card coming off gives the rifle\'s own back; a teammate has the row only where his one round can be fired on your order', fails.join('; ') || `issued ${issue} · row "${row.label}" · note "${row.note(KIT.members[0])}"`); }
  game.msg = origMsg;
  return F.done();
}

export async function he40Burst() {
  const F = family('he40-burst: a man 14 m off, the 40 mm up (2 again), one right click — the arc on the press, the round on the release — the round arms on the way and he dies by the frag\'s own blast, once');
  fresh(); const { W, A } = await stageRing(2302, 14, -Math.PI / 2); const { game, input } = W; const pl = game.player, rf = pl.rifle;
  const audio = listen(W); const tap = eventTap(game); const D = destrTap(game);
  select40(W); const chest = () => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.2, 0]);
  for (let f = 0; f < 3 || (f < 90 && !aimGunOn(game)); f++) { W.cursorAt(chest()); W.step(DT); }   // (three frames as ever where the aim has no weight; with it, until the swing onto him is over — a load let go of mid-swing waits for the gun, and this asks about the frame after the click)
  const snapped = game.aimGuard === A; const restArc = !!pl.throwPreview;
  const items0 = new Set(game.items.items); const shells0 = rf.shells;   // (the tube's count as staged: LAUNCHER40.rounds on the frozen stand, the kit card's one round on the page's)
  let pre: any = null, heldP: any = null, airP = -1;
  rmbTap(W, chest, () => { tap.pump(); pre = pl.throwPreview; heldP = pl.launchHeld; airP = game.shells.length; });   // (the press frame: the arc; the frame after: the round)
  const preArmed = pre ? arcArmed(pre) : false, preLen = pre ? arcLength(pre) : 0;
  tap.pump(); const inAir = game.shells.length;
  let resolvedAt = -1; for (let f = 0; f < 90; f++) { W.cursorAt(chest()); W.step(DT); tap.pump(); if (resolvedAt < 0 && !game.shells.length) resolvedAt = f; }
  const fails: string[] = [];
  if (rf.attachment !== 'he40') fails.push(`attachment ${rf.attachment}`);
  if (restArc) fails.push('an arc drawn before the button went down');
  if (!snapped) fails.push('the reticle did not snap to him'); if (!pre || pre.points.length < 2) fails.push('no arc on the press frame'); else if (!preArmed) fails.push(`the preview (${f2(preLen)} m) read too close to arm`);
  if (heldP !== 'he40' || airP !== 0) fails.push(`the press frame: launchHeld ${heldP}, ${airP} in the air (want 'he40' held, nothing sent yet)`);
  if (inAir !== 1 || shells0 < 1 || rf.shells !== shells0 - 1 || pl.launchHeld !== null) fails.push(`the frame after the click: ${inAir} in the air, ${rf.shells} left, launchHeld ${pl.launchHeld}`);
  if (resolvedAt < 0 || resolvedAt > 30) fails.push(`the round took ${resolvedAt} frames over 14 m (want under half a second at ${HE40.speed} m/s)`);
  if (A.state !== 'dead' || A.downKind !== 'shot' || A.downBy !== 'player') fails.push(`him: ${A.state} ${A.downKind}/${A.downBy} (want dead, shot, by the player)`);
  const rep = FRAG_LOG[0];
  if (FRAG_LOG.length !== 1 || !rep) fails.push(`${FRAG_LOG.length} blast reports (want 1)`);
  else { if (rep.who !== pl.char.id) fails.push(`the blast is ${rep.who}'s`); if (!rep.hits.some((h: any) => h.id === A.char.id && h.result === 'killed')) fails.push(`report ${JSON.stringify(rep.hits.map((h: any) => `${h.name} ${f2(h.d)} ${h.result}`))}`); if (rep.player) fails.push(`Sam is in the report: ${rep.player}`); }
  const bangs = tap.evs.filter((e: any) => e.kind === 'bang'), shots = tap.evs.filter((e: any) => e.kind === 'shot' || e.kind === 'guardShot'), props = tap.evs.filter((e: any) => e.kind === 'prop');
  if (bangs.length !== 1) fails.push(`${bangs.length} bang events (want 1)`);
  if (D.n !== 1) fails.push(`${D.n} calls into the destruction lane (want exactly 1: the blast's own)`);
  if (shots.length) fails.push(`${shots.length} gunfire event(s) off the launcher`);
  if (!props.some((e: any) => Math.abs(e.level - HE40.launchNoise) < 1e-6 && e.who === pl.char.id)) fails.push(`no launch noise at Sam (props ${JSON.stringify(props.map((e: any) => `${e.level}@${e.who}`))})`);
  if (!audio.some((a: any) => a.name === 'launcher')) fails.push('no launcher voice'); if (audio.some((a: any) => a.name === 'rifleSuppressed')) fails.push('a rifle report played');
  const end = HE40_LOG[0];
  if (!end || !end.armed || end.flown < HE40.armM || Math.abs(end.flown - 14) > 1.2) fails.push(`the round's end: ${end ? `${end.armed ? 'armed' : 'unarmed'} after ${f2(end.flown)} m, met ${end.met}` : 'none logged'}`);
  if (game.items.items.some((it: any) => !items0.has(it) && it.kind === 'shell')) fails.push('a dud lies there after a burst');
  if (pl.down) fails.push('Sam went down 14 m from it');
  if (!game.messages.some((m: any) => /40 mm grenade — 1 down/.test(m.text))) fails.push(`the log: "${game.messages.at(-1)?.text}"`);
  F.verdict(!fails.length, `snapped, the press frame's arc to him (${f2(preLen)} m: armed), one round on the next (${shells0} → ${shells0 - 1}): there in ${resolvedAt} frames, he is down by the player's hand through ONE blast report, one bang, one destruction call; the tube is a ${HE40.launchNoise} 'prop' at Sam and no gunfire; Sam is out of it`,
    fails.join('; ') || `flown ${f2(end.flown)} m, met ${end.met} · report ${JSON.stringify(rep.hits.map((h: any) => `${h.name} ${f2(h.d)}m ${h.result}`))} · "${game.messages.at(-1)?.text}"`);
  return F.done();
}

export async function he40Dud() {
  const F = family('he40-dud: short of its arming distance it is a slug — no blast, a clatter; past it, the burst; and the man who fired it from where he stands is outside his own round');
  { fresh(); const { W, A } = await stageRing(2303, 5, -Math.PI / 2); const { game, input } = W; const pl = game.player;
    const tap = eventTap(game); const D = destrTap(game);
    const is40 = select40(W); const chest = () => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.2, 0]);
    for (let f = 0; f < 3; f++) { W.cursorAt(chest()); W.step(DT); }
    const shortRest = previewTooClose(game); let preArmed = true, shortP = false, airP = -1;
    rmbTap(W, chest, () => { tap.pump(); preArmed = pl.throwPreview ? arcArmed(pl.throwPreview) : true; shortP = previewTooClose(game); airP = game.shells.length; });   // (the press frame's arc is the one the reticle words; the round goes on the next)
    tap.pump(); const shortSent = previewTooClose(game);
    let staggered = false; for (let f = 0; f < 60; f++) { W.step(DT); tap.pump(); staggered ||= A.staggerUntil > game.time; }
    const fails: string[] = [];
    if (!is40) fails.push(`2 again did not put the 40 mm up (${pl.rifle.attachment})`);
    if (preArmed) fails.push('the preview read armed at 5 m');
    if (shortRest || !shortP || shortSent) fails.push(`previewTooClose: ${shortRest} at rest, ${shortP} on the press frame, ${shortSent} on the frame the round left (want it true only while the 40 mm's arc is up: false, true, false)`);
    if (airP !== 0 || HE40_STATS.fired !== 1) fails.push(`${airP} in the air on the press frame, ${HE40_STATS.fired} fired in all (want 0, then exactly 1)`);
    if (FRAG_LOG.length || D.n || tap.evs.some((e: any) => e.kind === 'bang')) fails.push(`a blast happened: ${FRAG_LOG.length} report(s), ${D.n} destruction call(s)`);
    if (A.state === 'dead' || !A.char.alive) fails.push(`he is ${A.state} — a dud does no damage`);
    if (!staggered) fails.push('he did not fold'); { const props = tap.evs.filter((e: any) => e.kind === 'prop'); if (props.length !== 2) fails.push(`${props.length} noises for one round (want two: the tube, his fold): ${props.map((e: any) => e.level).join(', ')}`); } if (!(A.awareness >= 0.8 || A.state === 'alert')) fails.push(`his awareness ${f2(A.awareness)}, ${A.state} (want alert, or all but)`);
    const duds = game.items.items.filter((it: any) => it.kind === 'shell');
    if (duds.length !== 1 || v3.distXZ(duds[0].pos, A.char.pos) > 2.5) fails.push(`${duds.length} dud(s) on the floor${duds[0] ? `, ${f2(v3.distXZ(duds[0].pos, A.char.pos))} m from him` : ''}`);
    const end = HE40_LOG[0]; if (!end || end.armed || end.met !== 'man' || end.flown >= HE40.armM) fails.push(`the round's end: ${JSON.stringify(end && { armed: end.armed, met: end.met, flown: f2(end.flown) })}`);
    if (!game.messages.some((m: any) => /a dud/.test(m.text))) fails.push('the log does not say dud');
    for (let f = 0; f < 60 * 6; f++) W.step(DT);   // … and it stays a lump of aluminium
    if (FRAG_LOG.length || game.items.items.filter((it: any) => it.kind === 'shell').length !== 1) fails.push('the dud did not stay inert on the floor');
    F.verdict(!fails.length, `(a) a man 5 m off (under the ${HE40.armM} m it arms at): the press frame's arc says too close (and only it: nothing at rest); let go anyway — no report, no bang, no destruction call; he folds and is alert, alive; one inert 'shell' item by him six seconds later`, fails.join('; ') || `flown ${f2(end.flown)} m · awareness ${f2(A.awareness)} · "${game.messages.find((m: any) => /a dud/.test(m.text))?.text}"`); }
  { fresh(); const W = await stage(2304, true, [16.0, 0, 11.4]); const { game } = W; const pl = game.player; const tap = eventTap(game); const D = destrTap(game);
    const from = v3.add(pl.char.pos, [0.4, 1.3, 0]); const fails: string[] = [];
    // the corridor's north wall three metres up the corridor: a dud
    fireShell(game, pl.char, from, [18.5, 1.2, 10.05]); for (let f = 0; f < 60; f++) { W.step(DT); tap.pump(); }
    const e1 = HE40_LOG[0]; const clack = tap.evs.find((e: any) => e.kind === 'prop' && e.who === 0 && Math.abs(e.level - HE40.dudNoise) < 1e-6);
    if (!e1 || e1.armed || e1.met !== 'static' || FRAG_LOG.length || D.n) fails.push(`near wall: ${JSON.stringify(e1 && { armed: e1.armed, met: e1.met, flown: f2(e1.flown) })}, ${FRAG_LOG.length} report(s)`);
    if (!clack) fails.push('near wall: no clack event with nobody behind it');
    if (!game.items.items.some((it: any) => it.kind === 'shell')) fails.push('near wall: no dud on the floor');
    // the same wall nine metres up it: the burst, and Sam where he stands is outside it
    tap.evs.length = 0; fireShell(game, pl.char, from, [24.9, 1.2, 10.05]); for (let f = 0; f < 60; f++) { W.step(DT); tap.pump(); }
    const e2 = HE40_LOG[1]; const rep = FRAG_LOG[0];
    if (!e2 || !e2.armed || e2.met !== 'static' || FRAG_LOG.length !== 1 || D.n !== 1) fails.push(`far wall: ${JSON.stringify(e2 && { armed: e2.armed, met: e2.met, flown: f2(e2.flown) })}, ${FRAG_LOG.length} report(s), ${D.n} destruction call(s)`);
    else { if (rep.player) fails.push(`far wall: Sam, ${f2(v3.dist(rep.at, pl.char.pos))} m from his own burst, is in the report (${rep.player})`); if (v3.dist(e2.at, [24.9, 1.2, 10.05]) > 0.6) fails.push(`far wall: burst ${f2(v3.dist(e2.at, [24.9, 1.2, 10.05]))} m from the mark`); if (game.col.nav.isBlocked(e2.at[0], e2.at[2]) && e2.at[2] < 10.05) fails.push('far wall: the burst point is inside the wall'); }
    if (pl.down) fails.push('Sam is down');
    F.verdict(!fails.length, `(b) a wall 3 m off: a dud, a ${HE40.dudNoise} clack with nobody behind it, the slug on the floor; the same wall 9 m off: one burst a hand's width off the plaster — and Sam, who has not moved, is not in its report (it arms at ${HE40.armM} m, the blast reaches ${FRAG.woundM})`, fails.join('; ') || `near: flown ${f2(e1.flown)} m · far: flown ${f2(e2.flown)} m, burst at (${f2(e2.at[0])}, ${f2(e2.at[1])}, ${f2(e2.at[2])})`); }
  return F.done();
}

export async function he40Preview() {
  const F = family('he40-preview: the previewed arc IS the flight, and "armed" read off the preview is what the round does');
  fresh(); const W = await stage(2305, true, [16.0, 0, 11.4]); const { game } = W; const pl = game.player; game.godMode = true;
  const results: string[] = []; const fails: string[] = [];
  for (const [label, target] of [['level, 14 m down the corridor', [30.0, 1.3, 11.4]], ['at the far floor', [29.0, 0.05, 11.6]], ['up at the ceiling line 10 m off', [26.0, 2.7, 11.2]], ['the floor four metres ahead', [20.0, 0.05, 11.4]], ['the wall beside him', [17.5, 1.2, 10.05]]] as [string, Vec3][]) {
    const from = v3.add(pl.char.pos, [0.4, 1.3, 0]);
    const sol = shellSolve(game, from, target); const n0 = HE40_LOG.length;
    const sh = fireShell(game, pl.char, from, target); let worst = 0;
    for (let f = 0; f < 200 && game.shells.includes(sh); f++) {
      W.step(DT);
      if (game.shells.includes(sh)) { let best = Infinity; for (let i = 0; i + 1 < sol.points.length; i++) best = Math.min(best, distToSeg(sh.pos, sol.points[i], sol.points[i + 1])); if (Number.isFinite(best)) worst = Math.max(worst, best); }
    }
    const end = HE40_LOG[n0]; const endOff = end ? v3.dist(end.at, sol.land) : Infinity;
    results.push(`${label}: ${f2(arcLength(sol))} m previewed (${arcArmed(sol) ? 'armed' : 'too close'}), worst ${worst.toFixed(3)} m off it, ended ${f2(endOff)} m from its landing ${end ? (end.armed ? 'as a burst' : 'as a dud') : '—'}`);
    if (worst > 0.06) fails.push(`${label}: ${worst.toFixed(3)} m off the arc`);
    if (!end) fails.push(`${label}: the round never ended`); else { if (endOff > 0.45) fails.push(`${label}: ended ${f2(endOff)} m from the previewed landing`); if (end.armed !== arcArmed(sol)) fails.push(`${label}: previewed ${arcArmed(sol) ? 'armed' : 'too close'}, was ${end.armed ? 'a burst' : 'a dud'}`); }
    for (let f = 0; f < 20; f++) W.step(DT);
  }
  // … and with a MAN under the reticle either side of the arming distance: the reticle's word is what the round then does
  const men: string[] = [];
  for (const d of [8.3, 8.6, 8.75, 9.0]) {
    fresh(); const { W: W2, A } = await stageRing(2310, d, -Math.PI / 2); const g2 = W2.game, pl2 = g2.player; if (!select40(W2)) fails.push(`a man ${d} m off: 2 again did not put the 40 mm up (${pl2.rifle.attachment})`);
    const chest = () => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.2, 0]);
    for (let f = 0; f < 3 || (f < 90 && !aimGunOn(g2)); f++) { W2.cursorAt(chest()); W2.step(DT); }   // (three frames as ever where the aim has no weight; with it, until the swing onto him is over — the tap asks about the arc, not about a shot sent mid-swing)
    if (pl2.throwPreview) fails.push(`a man ${d} m off: an arc drawn before the button went down`);
    let said: boolean | null = null, len = NaN, tooClose: boolean | null = null;
    rmbTap(W2, chest, () => { said = pl2.throwPreview ? arcArmed(pl2.throwPreview) : null; len = pl2.throwPreview ? arcLength(pl2.throwPreview) : NaN; tooClose = previewTooClose(g2); });   // (the press frame's arc — what the reticle words — then the round on the next)
    if (said === null) fails.push(`a man ${d} m off: no arc on the press frame`); else if (tooClose !== !said) fails.push(`a man ${d} m off: the arc reads ${said ? 'armed' : 'too close'} but previewTooClose is ${tooClose}`);
    for (let f = 0; f < 60 && !HE40_LOG.length; f++) W2.step(DT);
    const end = HE40_LOG[0]; men.push(`${d} m: ${f2(len)} m previewed, ${said ? 'armed' : 'too close'} → ${end ? `${end.armed ? 'a burst' : 'a dud'} on the ${end.met} at ${f2(end.flown)} m` : 'never ended'}`);
    if (!end || end.met !== 'man') fails.push(`a man ${d} m off: ${end ? `it met the ${end.met}` : 'the round never ended'}`);
    else { if (end.armed !== said) fails.push(`a man ${d} m off: the reticle said ${said ? 'armed' : 'too close'}, it was ${end.armed ? 'a burst' : 'a dud'}`); if (Math.abs(end.flown - len) > 0.12) fails.push(`a man ${d} m off: previewed ${f2(len)} m of path, flew ${f2(end.flown)}`); }
    if (d === 8.6) {   // … a man standing in the line of a round aimed PAST him cuts the arc too (he is not under the reticle: the point is 5 m beyond him); a teammate never does
      const from = v3.add(pl2.char.pos, [0, 1.3, 0]), to = A.char.pos, u = v3.normalize([to[0] - from[0], 0, to[2] - from[2]]), past: Vec3 = [to[0] + u[0] * 5, 1.2, to[2] + u[2] * 5];
      const open = arcLength(shellSolve(g2, from, past)), cut = arcLength(shellSolve(g2, from, past, shellBodies(g2))), toHim = v3.distXZ(from, to);
      if (!(cut < toHim && cut > toHim - 0.6 && open > cut + 1)) fails.push(`a man in the line: the arc is ${f2(cut)} m with him in it, ${f2(open)} m without, he is ${f2(toHim)} m off`);
      men.push(`a man in the line of a round aimed 5 m past him: the arc stops at ${f2(cut)} m (he is ${f2(toHim)} m off; ${f2(open)} m with nobody there)`);
      A.team = 'operative'; g2.aimGuard = A; if (shellMan(g2) || shellBodies(g2).includes(A.char)) fails.push('a teammate is taken for a man the round meets'); A.team = 'guard'; g2.aimGuard = null;
    }
  }
  results.push(...men);
  F.verdict(!fails.length, 'five arcs (level, low, high, short, a wall at arm\'s length): the round flies the line the overlay drew and ends as the preview said it would; four men either side of the arming distance: the reticle\'s word is what the round does; a teammate under the reticle is not its man', (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + results.join('\n    '));
  return F.done();
}

export async function he40Quiet() {
  const F = family('he40-quiet: never put on the button, nothing of it runs — and the ring flies exactly as it did');
  fresh(); const W = await stage(2306, true, [16.0, 0, 11.4]); const { game, input } = W; const pl = game.player;
  const fails: string[] = [];
  const word = () => (digestGame(game).player as any).rifle as string;
  // (the stand deals the tube: the rifle's own three, or the page's one — and the word names the count only when it is not the rifle's three)
  const tube0 = pl.rifle.shells, g0 = tube0 === LAUNCHER40.rounds ? '' : ` g${tube0}`;
  const w0 = word(); if (!w0.endsWith(` r5${g0}`)) fails.push(`the digest's rifle word "${w0}" (want it to end " r5${g0}": no 40 mm term while the tube holds the rifle's own ${LAUNCHER40.rounds})`);
  // the RING is up on a fresh rifle (no second 2: that would flip to the 40 mm); three rings by the button — a one-frame click each, sent on the frame after; never the 40 mm
  if (pl.rifle.attachment !== 'ring') fails.push(`a fresh rifle has ${pl.rifle.attachment} up (want the RING)`);
  for (let k = 0; k < 3; k++) { for (let f = 0; f < 70; f++) { W.cursorAt([27 + k, 1.2, 11.4]); if (f === 2) input.clicked |= 4; W.step(DT); if (game.shells.length) fails.push('a 40 mm round in the air'); } }
  if (pl.rifle.rings !== LAUNCHER.rings - 3) fails.push(`rings ${pl.rifle.rings} after three`);
  if (HE40_STATS.fired || HE40_LOG.length || FRAG_LOG.length) fails.push(`he40 ran: ${JSON.stringify(HE40_STATS)}`);
  if (pl.rifle.shells !== tube0) fails.push(`${pl.rifle.shells} rounds left of ${tube0} with none fired`);
  const w1 = word(); if (!w1.endsWith(` r2${g0}`)) fails.push(`the digest's rifle word after three rings "${w1}"`);
  pl.rifle.shells = LAUNCHER40.rounds; const w3 = word(); if (!/ r2$/.test(w3)) fails.push(`with the rifle's own ${LAUNCHER40.rounds} in the tube the word is "${w3}" (want it to end " r2")`);
  pl.rifle.shells = 2; const w2 = word(); pl.rifle.shells = tube0; if (!/ r2 g2$/.test(w2)) fails.push(`with a round spent the word is "${w2}" (want " r2 g2")`);
  // the ring's solver is the shared one by the ring's own table, to the bit
  { const from = v3.add(pl.char.pos, [0.4, 1.3, 0]); for (const t of [[30, 1.3, 11.4], [22, 0.1, 11.6], [26, 2.7, 11.2]] as Vec3[]) { const a = ringSolve(game, from, t), b = arcSolve(game, from, t, RING); if (JSON.stringify(a) !== JSON.stringify(b)) fails.push('ringSolve differs from arcSolve by RING'); } }
  F.verdict(!fails.length, 'three rings by the button with the 40 mm never put on it: no round of it in the air, nothing logged, the tube as dealt; the digest\'s rifle word is the old one ("… r5", "… r2") and gains " g2" only once a round is spent; ringSolve is arcSolve by the ring\'s own table', fails.join('; ') || `"${w0}" → "${w1}"`);
  return F.done();
}
