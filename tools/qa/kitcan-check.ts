// A SUPPRESSED GUN IS DRAWN AND NAMED AS ONE ON THE KIT CARD (src/ui/kitCard.ts KIT_CAN, gunCanOf, `?nokitcan`; src/ui/kitIcons.ts GUN_CAN; src/game/kit.ts kitGunCan, youGunsCan).
//
//   bun run tools/qa/kitcan-check.ts          (KITCAN_BREAK=1 = the switch put off under the check: every 'the can is drawn' line must fail)
//
// The quiet set's guns tile read 'Glock 19 only' beside a bare pistol, though the gun you deploy with wears its suppressor (weapons.ts: both of yours do).
// This check opens the loadout screen on a headless DOM (as kitlent-check does) and reads the guns tile and the roster's card: your pistol alone reads
// 'Suppressed Glock 19' and is drawn with the can; your rifle keeps its words and gains the can; a teammate's drawing follows his Suppressor row; no can is
// ever drawn on the shotgun; none of it writes the card or the words the rest of the game reads (kitWords); and with the switch off the tile and the roster
// are the build before. It sets the switches it needs itself, so it asks the same on either stand. Looks at no picture: never seen on a GPU.
import { ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const IC = await import(`${ROOT}/src/ui/kitIcons.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const STAND = harnessProfile() as string, BROKEN = process.env.KITCAN_BREAK === '1';
const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
type Gun = { val: string; ico: string; chip: string; ic: string };

export async function canTiles(): Promise<boolean> {
  const F = family('kitcan-tiles: a suppressed gun is drawn with its can on the kit card, and your pistol alone is named for it');
  const G = globalThis as any, hadLS = 'localStorage' in G, prevLS = G.localStorage;
  const was = { cards: K.KIT.members.map((m: any) => ({ ...m })), on: K.KIT.on, slots: K.SLOTS.on, team: K.kitTeam() };
  let KC: any = null, canWas = true;
  try {
    await withDom('?quality=high&mute', async () => {
      G.localStorage = memStore(); G.location.pathname = '/'; G.location.hash = ''; G.location.assign = () => { }; G.location.reload = () => { };
      const M = await import(`${ROOT}/src/ui/missions.ts`), UI = await import(`${ROOT}/src/ui/loadout.ts`); KC = await import(`${ROOT}/src/ui/kitCard.ts`);
      canWas = KC.KIT_CAN.on; KC.KIT_CAN.on = !BROKEN;
      K.KIT.on = true; K.SLOTS.on = true; K.kitLoad(null, ''); K.kitReset();
      const SEARCH = '?quality=high&mute', list: any[] = M.missionList(), pickWas = M.MISSIONS.onPick, up: any[] = []; M.MISSIONS.onPick = null;
      try {
        // the guns tile and the roster's drawing of member `who`, on a screen opened fresh on the cards as they stand
        const read = (id: string, who = 0): Gun => {
          const m = list.find(x => x.id === id); if (!m) throw new Error(`no mission '${id}' on the list`);
          const host = new El('DIV') as any, L = UI.openLoadout(UI.entryOfMission(m), { host, search: M.missionHref(m, SEARCH), deploy: () => { }, back: () => { } }); up.push(L);
          if (who) L.pick(who); const root = L.root as unknown as El;
          const row = root.all(e => e.cls.has('kc-row')).find(r => r.attrs['data-field'] === 'weapon'), slot = root.all(e => e.cls.has('lo-slot')).find(s => s.attrs['data-slot'] === String(who));
          return { val: row?.all(e => e.cls.has('kc-val'))[0]?.textContent ?? '', ico: row?.all(e => e.cls.has('kc-ico'))[0]?.innerHTML ?? '', chip: slot?.all(e => e.cls.has('lo-gun'))[0]?.innerHTML ?? '',
            ic: slot?.all(e => e.cls.has('lo-ic')).find(c => /^(Guns|Weapon)$/.test(c.title))?.innerHTML ?? '' };   // (the roster's chip: the drawing the one start page shows, where it hides the gun over the words)
        };
        const svg = (w: string, can: boolean) => IC.kitIcon('weapon', w, can).svg as string, chip = (w: string, can: boolean) => IC.gunIcon(w, can) as string;
        const drawn = (g: Gun, w: string) => g.ico === svg(w, true) ? 'with the can' : g.ico === svg(w, false) ? 'bare' : 'something else';
        const chipDrawn = (g: Gun, w: string) => { const a = g.chip === chip(w, true) ? 'with the can' : g.chip === chip(w, false) ? 'bare' : 'something else', b = g.ic.startsWith(svg(w, true)) ? 'with the can' : g.ic.startsWith(svg(w, false)) ? 'bare' : 'something else'; return a === b ? a : `gun ${a}, chip ${b}`; };   // (both of the roster's drawings: the gun over the words, and the chip the one page shows in its place)
        const say = (g: Gun, w: string) => `tile '${g.val}', drawn ${drawn(g, w)} · roster ${chipDrawn(g, w)}`;
        const BRK = BROKEN ? ' · KITCAN_BREAK=1' : '';
        const NAMED = K.youGunsCan('pistol') as string, rowWord = (v: string) => (K.kitRows(0).find((r: any) => r.field === 'weapon').word(v)) as string;

        // the drawings themselves: the can is a thing added to the pistol and the rifle, and to nothing else
        F.verdict(svg('pistol', true) !== svg('pistol', false) && svg('rifle', true) !== svg('rifle', false) && ['pistol', 'rifle'].every(w => svg(w, true).startsWith(svg(w, false).replace(/<\/svg>\s*$/, ''))) && svg('nothing', true) === svg('rifle', true) && svg('toString', true) === svg('rifle', true) && svg('shotgun', true) === svg('shotgun', false)
          && IC.kitIcon('smoke', 1, true).svg === IC.kitIcon('smoke', 1, false).svg && !K.kitGunCan(1, { ...K.KIT.members[1], weapon: 'shotgun', suppressed: true, shield: false }) && !K.kitGunCan(0, { ...K.KIT.members[0], weapon: 'shotgun' }),
          'THE DRAWINGS: the can is added to the pistol and to the rifle (the gun under it is the same drawing; a gun the board does not know is the rifle); the shotgun has none to draw, nor has any tile that is not a gun; a shotgun in the hands is never a suppressed gun',
          `pistol ${svg('pistol', false).length} → ${svg('pistol', true).length} chars · rifle ${svg('rifle', false).length} → ${svg('rifle', true).length} · shotgun ${svg('shotgun', false).length} → ${svg('shotgun', true).length}`);

        // the quiet set on your card, on a quiet mission: the pistol alone, named and drawn for what it is
        const words0 = (() => { K.kitPreset(0, 'quiet'); return K.kitWords(0) as string; })(), card0 = JSON.stringify(K.KIT.members[0]);
        const q = read('bazaar-quiet');
        F.verdict(K.KIT.members[0].weapon === 'pistol' && /suppressed/i.test(NAMED) && q.val === NAMED && q.val !== rowWord('pistol') && drawn(q, 'pistol') === 'with the can' && chipDrawn(q, 'pistol') === 'with the can',
          `THE QUIET SET ON YOUR CARD: the guns tile reads '${NAMED}' (it read '${rowWord('pistol')}') and the pistol is drawn with its can, on the tile and on the roster's card`, say(q, 'pistol') + BRK);
        F.verdict(JSON.stringify(K.KIT.members[0]) === card0 && K.kitWords(0) === words0 && !/suppressed/i.test(words0), '… and neither the card nor the line the rest of the game reads of it (kitWords) is written by it', `card unchanged ${JSON.stringify(K.KIT.members[0]) === card0} · kitWords '${words0.split(' · ')[0]}…'`);

        // the rifle: suppressed too, heard as gunfire all the same — its words stay, the can is drawn
        K.kitReset(); const r = read('bazaar-quiet');
        F.verdict(K.KIT.members[0].weapon === 'rifle' && r.val === rowWord('rifle') && !/suppressed/i.test(r.val) && drawn(r, 'rifle') === 'with the can' && chipDrawn(r, 'rifle') === 'with the can',
          'THE RIFLE ON YOUR CARD: its words are the words it had (two guns on one tile: no room, and the floor hears it as gunfire anyway), the can is on its drawing', say(r, 'rifle') + BRK);

        // your card's own `suppressed` field is no row of yours and the game never reads it for you: whatever it holds, yours are drawn as they are carried
        { K.kitPreset(0, 'quiet'); const keep = K.KIT.members[0].suppressed; K.KIT.members[0].suppressed = false; const y = read('bazaar-quiet'); K.KIT.members[0].suppressed = keep; K.kitReset();
          F.verdict(y.val === NAMED && drawn(y, 'pistol') === 'with the can' && chipDrawn(y, 'pistol') === 'with the can', 'YOUR CARD\'S Suppressor FIELD IS NOT ASKED (no row of yours writes it; the game hands you the suppressed pair whatever it holds): put false by hand, the tile and the roster are the same', say(y, 'pistol') + BRK); }

        // a teammate: the drawing follows his Suppressor row; his tile's word is his row's word
        const squad = list.find(x => x.id === 'room-clear-four') ?? list.find(x => /four|squad/.test(x.id));
        if (!squad) throw new Error('no squad mission on the list');
        K.kitSet(1, 'weapon', 'rifle'); K.kitSet(1, 'suppressed', true); const on = read(squad.id, 1);
        K.kitSet(1, 'suppressed', false); const off = read(squad.id, 1);
        K.kitSet(1, 'weapon', 'pistol'); K.kitSet(1, 'suppressed', true); const pOn = read(squad.id, 1); K.kitReset();
        F.verdict(drawn(on, 'rifle') === 'with the can' && chipDrawn(on, 'rifle') === 'with the can' && drawn(off, 'rifle') === 'bare' && chipDrawn(off, 'rifle') === 'bare' && drawn(pOn, 'pistol') === 'with the can' && chipDrawn(pOn, 'pistol') === 'with the can' && on.val === off.val && !/suppressed/i.test(on.val + pOn.val),
          'A TEAMMATE: his Suppressor row on and his rifle is drawn with the can, off and it is bare (tile and roster both), a suppressed pistol the same; his tile\'s word is his row\'s own (the Suppressor row beside it says the rest)',
          `rifle, suppressor on: ${say(on, 'rifle')}\n    rifle, suppressor off: ${say(off, 'rifle')}\n    pistol, suppressor on: ${say(pOn, 'pistol')}${BRK}`);

        // the switch off: the build before
        { const sw = KC.KIT_CAN.on; KC.KIT_CAN.on = false; K.kitPreset(0, 'quiet'); const p = read('bazaar-quiet'); K.kitReset(); const rf = read('bazaar-quiet'); KC.KIT_CAN.on = sw;
          F.verdict(p.val === rowWord('pistol') && drawn(p, 'pistol') === 'bare' && chipDrawn(p, 'pistol') === 'bare' && rf.val === rowWord('rifle') && drawn(rf, 'rifle') === 'bare' && chipDrawn(rf, 'rifle') === 'bare',
            'THE SWITCH OFF (?nokitcan): the same cards, and the tile and the roster are the bare drawings and the words of the build before', `pistol: ${say(p, 'pistol')} · rifle: ${say(rf, 'rifle')}`); }
      } finally { for (const L of up) L.close?.(); M.MISSIONS.onPick = pickWas; }
    });
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally {
    if (KC) KC.KIT_CAN.on = canWas;
    K.kitLoad(null, ''); K.SLOTS.on = was.slots; K.KIT.on = was.on; K.kitTeam(was.team);
    for (let i = 0; i < was.cards.length; i++) K.KIT.members[i] = was.cards[i];
    if (hadLS) G.localStorage = prevLS; else delete G.localStorage;
  }
  return F.done();
}

export async function kitcanCheck(): Promise<boolean> {
  console.log(`kitcan-check on the ${STAND.toUpperCase()} stand (it sets the switches it needs itself)${BROKEN ? ' — KITCAN_BREAK=1: the switch is put off under it, the lines that ask for a can must FAIL' : ''}`);
  const ok = await canTiles();
  console.log(`\nkitcan-check (${STAND} stand): ${ok ? 'ALL PASS' : 'FAILED'}`);
  return ok;
}
if (import.meta.main) { const ok = await kitcanCheck(); process.exit(ok ? 0 : 1); }
