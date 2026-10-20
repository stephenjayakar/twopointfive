// A STEALTH MISSION'S KIT IS WHAT YOUR CARD STARTS AT THERE (src/game/kit.ts KITDEAL.stealth; ?nokitstealth, TPS_KITSTEALTH=1).
//   bun run tools/qa/probes.ts kitstealth                     (frozen: the rule is held off; every line raises it by hand)
//   TPS_PROFILE=shipped bun run tools/qa/probes.ts kitstealth  (the page's stand)
//   KITSTEALTH_BREAK=1 … on either: the rule's broken path (the build before: the mission hands its kit over your card) — MUST FAIL.
// What it holds: off, a quiet run is handed the launcher's five, the link's cameras and the wand over the card, and a sponge round is a pouch each (the
// build before, to the count). On: nothing is handed over a card; a stealth mission puts a stealth card of your own first in the table, issued as the
// mission's kit and a legal fill of your pouches (five sponge rounds to one pouch); the loud card is parked and comes back untouched; a stealth card as
// issued follows the mission and one changed by hand does not; the store keeps the two apart; 'As issued' there is the mission's kit; the Quiet kit's
// card for you is that kit and no pistol alone; and the staging wears the stealth card on a quiet run and the loud one on a loud run.
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { KITTREE } = await import(`${ROOT}/src/game/kittree.ts`);
const { GUNSLOTS } = await import(`${ROOT}/src/game/gunslots.ts`);
const { STICKY, stickyVisitSet } = await import(`${ROOT}/src/game/stickycam.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { QUIETFOG } = await import(`${ROOT}/src/game/quietfog.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);

type Card = Record<string, any>;
const J = (x: unknown) => JSON.stringify(x);
const STAND = harnessProfile() as string, BROKEN = process.env.KITSTEALTH_BREAK === '1';
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const memStore = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); } }; };
const you = (): Card => ({ ...K.KIT.members[0] });
const words = (m: Card) => `${m.weapon}${m.rings ? ` · ${m.rings} sponge` : ''}${m.cams ? ` · ${m.cams} cam` : ''}${m.wand ? ' · wand' : ''}${m.smoke ? ` · ${m.smoke} smoke` : ''}${m.bangs ? ` · ${m.bangs} stun` : ''}${m.frags ? ` · ${m.frags} frag` : ''}${m.shells ? ` · ${m.shells} HE` : ''}`;
const cost = (m?: Card) => { const c = m ? K.kitCost(0, m) : K.kitCost(0); return `${c.used}/${c.total}`; };
const FULL = { rings: 5, cams: 2, wand: true }, BARE = { rings: 5, cams: 0, wand: false };

export async function kitStealth(): Promise<boolean> {
  console.log(`\n=== kitstealth: a stealth mission's kit is what your card starts at there [${STAND}${BROKEN ? ' · KITSTEALTH_BREAK=1' : ''}] ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { stealth: K.KITDEAL.stealth, deal: K.KITDEAL.on, tree: KITTREE.on, guns: GUNSLOTS.on, big: K.BIGSLOT.on, on: K.KIT.on, slots: K.SLOTS.on, sticky: STICKY.on, wand: WAND.on, qwand: QUIETFOG.wand, solo: K.KIT_SOLO.on };
  const raise = (on: boolean) => { K.kitMission(null); KITTREE.on = true; GUNSLOTS.on = true; K.BIGSLOT.on = true; K.KIT.on = true; K.SLOTS.on = true; STICKY.on = true; WAND.on = true; QUIETFOG.wand = true; K.KITDEAL.on = false; K.KITDEAL.stealth = on; };
  let game: any = null;
  try {
    { const env = process.env.TPS_KITSTEALTH, want = STAND === 'frozen' ? env === '1' : env === undefined ? true : env === '1';
      verdict(was.stealth === want && String(FROZEN_HOLDS['KITDEAL.stealth']).startsWith('TPS_KITSTEALTH=1'), `the switch as this stand has it: ${want ? 'on' : 'off'}`, `KITDEAL.stealth ${was.stealth} · the hold's word: ${FROZEN_HOLDS['KITDEAL.stealth']}`); }

    // ── off: the build before
    { raise(false); K.kitLoad(null, ''); const loud = J(you()), card = K.KIT.members[0]; K.kitMission(FULL);
      verdict(K.KIT.members[0] === card && J(you()) === loud && K.slotCost('rings', 5) === 5 && K.kitRingsLent(true) === KITTREE.lend && !K.kitStealthOn(), 'OFF: a stealth mission changes no card, a sponge round is a pouch each and the mission\'s five are handed over the card', `card ${J(you()) === loud ? 'as it was' : 'CHANGED'} · five sponge rounds = ${K.slotCost('rings', 5)} pouches · handed ${K.kitRingsLent(true)}`); }

    // ── on: the card
    raise(true); K.kitLoad(null, '');
    { const loud = you(); K.kitMission(FULL); const m = you(), c = K.kitCost(0), d = K.kitDefault(0);
      verdict(m.rings === 5 && m.cams === 2 && m.wand === true && !m.frags && !m.shells && m.weapon === 'rifle' && c.used <= c.total && c.used === 4 && K.slotCost('rings', 5) === 1 && K.slotCost('rings', 1) === 1 && K.slotCost('rings', 0) === 0 && !K.kitChanged(0) && J(d) === J({ ...m, suit: d.suit, trim: d.trim }) && K.kitRingsLent(true) === 0,
        'ON: a stealth mission under the fog puts a stealth card first in the table: five sponge rounds in one pouch, the link\'s two cameras, the wand, nothing loud; it is what you are issued there, and nothing is handed over it', `${words(m)} · pouches ${cost()} · changed ${K.kitChanged(0)} · handed over ${K.kitRingsLent(true)}`);
      K.kitMission(null); verdict(J(you()) === J(loud), '… and the loud card is back as it was when the mission is a loud one', `${words(you())} · pouches ${cost()}`);
      K.kitMission(BARE); const b = you(); K.kitMission({ rings: 5, cams: 3, wand: true }); const t = you(); K.kitMission(null);
      verdict(b.rings === 5 && !b.cams && !b.wand && b.smoke + b.bangs === 3 && K.kitCost(0, b).used === 4 && t.cams === 2 && t.wand && K.kitCost(0, t).used === 4, 'with no fog (no cameras, no wand) the free pouches carry canisters; three cameras and a wand are held to what four pouches carry', `no fog: ${words(b)} (${cost(b)}) · three cameras: ${words(t)} (${cost(t)})`); }

    // ── on: it follows the mission until a row is changed; the store keeps the two apart
    { const st = memStore(); K.kitLoad(st, ''); const loud = J(you());
      K.kitMission(BARE); K.kitMission(FULL); const followed = you();
      const set = K.kitSet(0, 'cams', 1); const own = you(), kept = JSON.parse(st.m.get([...st.m.keys()][0]) ?? '{}');
      K.kitMission(BARE); const stays = you(); K.kitMission(null); const back = J(you()); K.kitMission(FULL); const again = you(); K.kitMission(null);
      K.kitLoad(st, ''); const loaded = J(you()); K.kitMission(FULL); const reread = you();
      verdict(set && followed.cams === 2 && followed.wand && own.cams === 1 && stays.cams === 1 && again.cams === 1 && reread.cams === 1 && back === loud && loaded === loud && kept.stealth?.cams === 1 && J({ ...kept.members[0], cans: undefined }) === J({ ...JSON.parse(loud), cans: undefined }),
        'a stealth card as issued follows the mission (the fog lever up: the cameras and the wand come); one camera put back by hand is YOURS: it stays through another mission\'s kit, through a loud mission between, and through the store, which keeps the loud card where it was and the stealth one beside it', `followed: ${words(followed)} · own: ${words(own)} · on a mission with no fog: ${words(stays)} · after a loud one: ${words(again)} · reread: ${words(reread)} · store: members[0] ${words(kept.members?.[0] ?? {})} | stealth ${kept.stealth ? words(kept.stealth) : 'none'}`);
      const why = K.kitLoadout('issued', 0), issued = you(), kept2 = JSON.parse(st.m.get([...st.m.keys()][0]) ?? '{}'); K.kitMission(null);
      verdict(why === null && issued.cams === 2 && issued.wand && kept2.stealth === undefined && J(you()) === loud, '\'As issued\' on that screen is the mission\'s kit again, nothing of a stealth card is left in the store, and the loud card never moved', `${words(issued)} · store stealth ${kept2.stealth ? words(kept2.stealth) : 'none'}`); }

    // ── on: the Quiet kit's card for you
    { K.kitLoad(null, ''); const why = K.kitLoadout('quiet'), q = you(); K.kitLoad(null, ''); K.kitMission(FULL); const list = (K.kitLoadouts(0) as { id: string }[]).map(l => l.id); K.kitMission(null);
      K.KITDEAL.stealth = false; K.kitLoad(null, ''); const whyOff = K.kitLoadout('quiet'), qOff = you(); K.KITDEAL.stealth = true; K.kitLoad(null, '');
      verdict(why === null && q.weapon === 'rifle' && q.rings === 5 && q.cams === 2 && q.wand && !q.frags && K.kitCost(0, q).used === 4 && !list.includes('quiet') && list[0] === 'issued' && whyOff === null && qOff.weapon === 'pistol' && qOff.smoke === 3 && qOff.frags === 1,
        'the Quiet kit\'s card for you is a stealth mission\'s kit (the long gun kept, no frag), a stealth mission\'s row of kits does not list it beside the same card as issued, and with the switch off it is the table\'s pistol alone with three smoke and a frag', `on: ${words(q)} (${cost(q)}) · a stealth screen lists ${list.join(', ')} · off: ${words(qOff)}`); }

    // ── the staging
    { K.kitLoad(null, ''); const R: any = await hushed(() => rig(17, { stage: false })); raise(true); K.kitLoad(null, ''); const g = R.game, pl = () => g.player; game = g;
      const ops = g.guards.filter((gd: any) => gd.unit && gd.team === 'operative'), others = g.guards.filter((gd: any) => !(gd.unit && gd.team === 'operative'));
      const run = (quiet: boolean, cams: number) => { K.KIT_SOLO.on = quiet; g.guards = quiet ? others : [...others, ...ops]; stickyVisitSet(g, cams); K.kitPlayer(g); return { rings: pl().rifle.rings, cams: pl().rifle.attachments.includes('cam') ? pl().rifle.cams : 0, wand: !!pl().wand, smoke: pl().canisters, stun: pl().flashbangs, frags: pl().frags, shells: pl().rifle.shells }; };
      const loud = run(false, 0), quiet = run(true, 2), dark = run(true, 0), loud2 = run(false, 0);
      K.kitMission(FULL); K.kitSet(0, 'rings', 0); K.kitMission(null); const none = run(true, 2); K.kitMission(FULL); K.kitLoadout('issued', 0); K.kitMission(null); run(false, 0);
      verdict(loud.rings === 0 && !loud.wand && loud.frags === 1 && quiet.rings === 5 && quiet.cams === 2 && quiet.wand && quiet.frags === 0 && quiet.shells === 0 && dark.rings === 5 && dark.cams === 0 && !dark.wand && dark.smoke + dark.stun === 3 && J(loud2) === J(loud) && none.rings === 0 && none.cams === 2,
        'STAGED: a loud run wears the loud card and a quiet run alone the stealth card (five rounds, the link\'s cameras, the wand, no frag, no HE); with no fog its canisters; the next loud run is the first again; and sponge rounds taken off the stealth card by hand are NOT handed back', `loud ${J(loud)} · quiet ${J(quiet)} · quiet, no fog ${J(dark)} · loud again ${J(loud2) === J(loud) ? 'the same' : J(loud2)} · sponge row at none: ${none.rings} rounds, ${none.cams} cameras`);
      K.KITDEAL.stealth = false; K.kitLoad(null, ''); const off = run(true, 2), card = you(); run(false, 0);
      verdict(off.rings === KITTREE.lend && off.cams === 2 && off.wand && off.frags === 1 && card.rings === 0 && !card.cams && !card.wand, 'OFF, staged: the mission hands its five, its cameras and its wand over a card that carries none (the build before)', `quiet ${J(off)} · the card: ${words(card)}`); }

    // ── a recording from before the key replays with it off
    { raise(true); const snap = knobsSnapshot(game) as { tables: Record<string, Record<string, unknown>> }; const old = JSON.parse(J(snap)); if (old.tables.KITDEAL) delete old.tables.KITDEAL.stealth; let ok = false, why = '';
      try { applyKnobs(game, old); ok = K.KITDEAL.stealth === false; applyKnobs(game, snap); ok &&= K.KITDEAL.stealth === true; } catch (e: any) { why = String(e?.message ?? e); }
      verdict(ok, 'the session journal carries the key, and a recording from before it replays with it off', why || `a journal without the key → off · with it → ${K.KITDEAL.stealth}`); }
  } finally { K.kitMission(null); K.KITDEAL.stealth = was.stealth; K.KITDEAL.on = was.deal; KITTREE.on = was.tree; GUNSLOTS.on = was.guns; K.BIGSLOT.on = was.big; K.KIT.on = was.on; K.SLOTS.on = was.slots; STICKY.on = was.sticky; WAND.on = was.wand; QUIETFOG.wand = was.qwand; K.KIT_SOLO.on = was.solo; K.kitLoad(null, ''); K.SLOTS.on = was.slots; K.KIT.on = was.on; }
  console.log(`=== kitstealth: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
