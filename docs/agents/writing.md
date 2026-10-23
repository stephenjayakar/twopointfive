# Writing for the player

One of the area files CLAUDE.md indexes. CLAUDE.md carries the rules; this file is the same rules at length, with before and after
pairs from the game's own text. New notes about player text go at the foot of this file.

## Who this is for

Every word a player reads or hears: the tutorial's big line and its cards, a mission's opening scene and "You will learn" list,
mission blurbs, menus, HUD rows and hints, the end card, and what a teammate, a guard or a hostage says. It is not for notes to
agents, commit messages or debugger rows.

## The test

Say the line out loud, as if you were sitting next to a friend who is playing and you wanted to help. If you wouldn't say it that
way, rewrite it until you would. The maintainer's model (2026-10-22, on the stealth tutorial's whistle card):

> Before: "Where the sound was he stops, his back to you."\
> After: "He'll check out the sound and then stop, with his back to you."

What changed is the whole guide in one sentence. The subject comes first ("He"). There is a contraction ("He'll"). It says what
is about to happen with "will". It uses the words you would use ("check out"). The two halves are joined with ordinary words
("and then", "with") in place of a comma and a phrase with no verb.

## Why the old text read oddly

The repo had rules for what a line must not contain (compass words, digits above 5) and how long it could be (eight words for a
tutorial line, character caps on scenes, list rows and spoken lines), and nothing about how a sentence should sound. Lines were
squeezed under the caps by dropping "you", "press" and "the" and by putting a colon where a verb belonged. The cards borrowed the
voice of the notes in this folder: noun first, timeless present tense, no contractions. Don't copy the voice of these notes into the
game.

## The rules, with pairs

**1. Who, then what they do, then the rest.** Subject, verb, object, and only then where, when or how. Don't open on a place or a
participle, and don't tack a verbless phrase on the end. A plain "when", "if" or "once" clause in front is normal speech and is fine.

| Before | After |
| --- | --- |
| Where the sound was he stops, his back to you. | He'll check out the sound and then stop, with his back to you. |
| Stacked on a door, they wait for your word. | Once they're stacked on a door, they'll wait until you say go. |
| Kept down, the same key opens a ring with the rest of them. | Hold the same key down to open a ring with the rest of the orders. |
| There they wait for your word. | They'll wait there until you say go. |

**2. Talk to "you", and you press the key.** The player is the one doing things. A key never does anything by itself, and a key
followed by a colon is not a sentence. (The pairs show a key as the player sees it; in a level file it is the key's code,
`[B]` for the squad's key and `[Space]` for the hand's.)

| Before | After |
| --- | --- |
| Go round the wall, come up behind him, and [E] takes hold of him. | Go around the wall, come up behind him, and press [E] to grab him. |
| [Q] on the door: stack up | Press [Q] on the door to stack up |
| [N]: night vision | Press [N] to turn on night vision |
| Right button: out cold. Left: the knife | Right-click to knock him out, or left-click to use the knife |

**3. Contractions, "will", and plain orders.** Use he'll, you'll, don't, it's, they're. Say what is about to happen with "will".
Say what to do as an order. Don't write sayings in the timeless present: they read like proverbs.

| Before | After |
| --- | --- |
| He heard that, and he is coming to look. | He heard that, and he's coming to take a look. |
| Men fight by what they can see. In the dark they are slow, and they come with torches. | Enemies can only fight what they can see. In the dark they'll slow down and turn on flashlights. |
| A man who holds a doorway shoots whoever shows in it. | An enemy who's watching a doorway will shoot anyone who steps into it. |
| A whistle brings one man (a card's title) | Whistle to lure a guard |

**4. Join ideas with words.** Use and, then, so, because, with, to. A colon, a dash or a bare comma between two ideas makes the
reader work out how they connect. Pick the joining word for what the two ideas have to do with each other: "so" and "because" are for a
real reason, and two things that are simply both true are two sentences.

| Before | After |
| --- | --- |
| When he stops: up behind him. [E] grabs him | When he stops, sneak up behind him and press [E] to grab him |
| They come with torches: the light gives them away | They're using flashlights, so you can see where they are |
| It does to you what it does to them: throw it from cover, and not close. | A grenade hurts you as much as it hurts them, so throw it from cover and not too close. |
| Hide. When he works at the box: strike | Hide, then take him down while he's busy at the breaker box |

**5. Everyday American words.** Use the word the player would use and the word the maintainer uses when he talks about the game.

| Not | But |
| --- | --- |
| take hold of, strike, drop (a man) | grab, take down |
| torch | flashlight |
| mains box, fuse box | breaker box |
| round, towards, whilst | around, toward, while |
| a man, men, a man of theirs | an enemy, a guard, enemies |
| your word, the word | "say go", "until you say go" |
| out cold (as a verb) | knock him out |
| the lamp, the right button | the light, right-click |
| covered, held (a doorway) | an enemy is watching it |

One word for one thing, every time. The squad "stacks up on" a door and goes when you "say go". You "pick" a pair or a row. It is
"your squad", an enemy is "watching" a doorway, and the enemy at a machine gun is "the gunner". A line that stands alone on the screen
names who it is about ("the gunner", "your partner"), because a bare "him" has nothing to point at.

Call a thing what the rest of the screen calls it. If the menu row says "Fall in", the line that teaches it says "fall in". The end card's
verdict words and its "defenders" and "hostages" rows are settled (dialogue.md) and are not changed by this guide.

**6. Short is good, clipped is not.** Cut ideas, never the small words (the, a, to, you, press). "Show, not tell" means fewer
screens of text and fewer explanations, not telegrams. If a line is too long, teach less in it or split the step.

| Before | After |
| --- | --- |
| In. Stay in the dark | Go in and stay in the dark |
| On, past the wall | Keep going past the wall |
| To the back door | Go to the back door |
| Lights out: what the dark does to men (a list row) | Cut the lights and fight in the dark |

**7. A voice keeps its brevity, not odd grammar.** Radio calls are short because people on a radio are short: "Stacked up.",
"Room clear.", "Moving." are right. A frightened guard can stammer. But the words still come in the order a person would say them,
and a teammate sounds like a present-day American soldier, not a narrator.

## By kind of text

- **The tutorial's big line**: one short sentence that starts with a verb or with "Press" / "Hold" and the key. About twelve words
  at most, because it is read at a glance in the middle of a fight. It says what to do; the card says why.
- **A move the keys can change is named by a token, not by its key** (`game/lesson.ts TOKENS`): `{grab him}`, `{grab him from behind}`,
  `{knock him out}`, `{take him out}`, with any words for "him" (`{grab the near guard}`). The build writes the token out by the keys it has
  ("press [Space] to grab him" or "hold left click on him to grab him"; "right click to knock him out", with or without the knife), and
  `lesson-check` refuses a line that spells the grab's key out. So write the sentence around the token and read it aloud each way it can
  come out: "When he stops, sneak up behind him and {grab him}". A capital inside the braces begins a sentence (`{Knock him out}`).
- **A card**: a title that says what the card is about ("Picking a lock", "Whistle to lure a guard") and two or three sentences. Say
  what is about to happen, what to do about it, and which key does it.
- **An opening scene**: two sentences, written like someone briefing you: where you are and what you're there to do.
- **A "You will learn" row**: it finishes the sentence "You will learn to …" or names the thing in a few words ("Plan mode").
- **A mission blurb or a menu hint**: one or two full sentences.
- **A menu row, a HUD row, a button**: a label is not a sentence, and labels stay labels ("Team & kit", "Deploy"). The rules above
  bite as soon as a row has a verb in it.
- **A spoken or radio line**: rule 7. The dialogue pass's rules (dialogue.md) still hold.

## Caps and bans that still stand

No compass words on the HUD or in a door's name. No digit above 5 on a menu. A key is written as its code in brackets (`[B]`) and
the page draws the player's own key. A character cap is there for layout: when a natural sentence doesn't fit one, say less, or
raise the cap in the open and say that you did. Never squeeze the sentence.

## The check

`bun run tools/qa/writing-check.ts` (`probes.ts writing`, in the quick set; `--list` prints every fault). It reads what is data: every level's lesson
block (the big line and its other lines, the after lines, the cards) and every mission row (blurb, opening scene, the "You will learn" rows). It is red on
a key cap followed by a colon, a sentence that opens on a key cap, a colon in a lesson's line or card, a line that opens on a bare "In." / "To the …" /
"Out by …" / "Where …" or on a participle, a verbless phrase after a comma, the British and stiff words of rule 5, "a man" / "men" for an enemy in a
lesson, and a pronoun with its verb left uncontracted. (The seven Training lessons it once counted apart were removed on 10-23.) It also reads the sentences this guide was written from and must catch every one of them and pass
their rewrites; `WRITING_BREAK=1` reads the old sentences as a level's and must fail. A LESSON'S LINE OR CARD IS READ AS THE PAGE WRITES IT OUT (since
10-23): each goes through `lessonLine` on the four ways the held click and the knife can stand, so a token is checked as the sentence the player reads
and never as its name, and the four tokens are written out of "him" on their own too (a token changed to "[Space]: grab him" is red with no level using
it; the break word writes the grab out that way and must fail on it). It cannot read text built in code (menus, HUD rows, spoken lines): those rest on
the review below.

## Review

Whoever writes or changes player text reads every changed line aloud, and a second reader who did not write it does the same
before the change is called final. A pattern check can catch a colon after a key or a missing contraction; only a reader catches
a sentence nobody would say.

## The Training lessons' sweep (10-22)

- **The seven Training lessons' lines are rewritten by this guide** (`tools/levels/train-*.ts` and their level files; 91 steps of 115). NO SWITCH: a
  lesson's line is in no run digest (the lesson on and off give the same word on all seven, and the frozen words did not move). THE KEYS stay bare
  letters, because the objective row draws a lesson's line through `keyText` and a code in brackets is stripped to the same bare letter first
  (`lesson.ts`, the row's text): what has to read well is the DRAWN line, so each was read as the page draws it (the orders key X as "hold Q", B as Q,
  Space as E, E as backtick). X opens a sentence or follows a comma, never "Press X". THREE STEPS CARRY A `ringLine` now (train-hands `whistle` and
  `lure`, train-lights `kick`): their old words were swapped in code by a pattern (`lesson.ts WHISTLE_LINE`, `WHEEL_LINE`: "V whistles", "Hold Space,
  wheel to kick, let go"), which the new words no longer match, so the page's way is written out in the level ("Hold Space and press 5 to whistle
  …", "Hold Space and press 2 to kick it"). Those two patterns now match no level. LEFT AS IT WAS: "armoury" (the room's name in train-orders is in
  the frozen digest: changing it moved the word 7a34000a, so the room, its door's name and the line keep it; `writing-check` counts that one line),
  "grain store" (the room's name on the row), the lesson title "Two pairs, two doors, one word". STALE ON THE PAGE, as before the sweep: the three
  train-pairs steps that name T (`red`, `blue`, `gold`): the who row has no key there (squad.md, the squad's only keys), and no line of this level says
  the ring's way of picking who. CHECKS: `lesson-check` on the seven, both stands; `writing-check` and its break word; `lesson-gate` (train-orders'
  shipped run fails "the kitchen was not cleared after the word" on dice 1, 3 and 4, before this change as after). Nobody has played a lesson with
  these lines; never seen on a GPU, and not read off the real page (the drawn lines come from `keyText` under the page's key map, staged in a script).

## The second reader's pass (10-23)

- **A second reader read every reworded line aloud and 117 were changed again** (the Training lessons, the menus, the HUD's toasts and rows, the
  spoken lines). What it was for: a line that stands alone names who it is about ("the cook", "the guard", "your partner", "the pistol", never a
  bare "he" or "it"); "stay still", "through" a door or a gate (not "by" it), gray, colors, readout, keyhole, "pick" and "switch" for the one act
  each; a key never acts by itself ("press Esc to keep the old one"); two things that are both true are two sentences, not one with a "so" or a
  "because" bolted on ("it's locked. pick it (quiet, slow) or kick it in (loud)"); one wording for "press Enter to restart". THREE MEANINGS PUT
  BACK: train-move's crouch says "slower" again; the rim in the dark is around whoever of the team stands in the dark; the rescue's one flashbang
  goes in through one door "and the teammates at the other door will go in after it". THE FLASHBANG: a sentence a player reads says "flashbang"
  (the lessons, the rescue's and the night breach's toasts, "flashbang went off", "a flashbang blinded you", "no flashbangs left", hard's words).
  NOT RENAMED, the maintainer's call: the kit rows ("Stun canisters", "stun"), the HUD's item name ("stun canister ×2 — goes off …"), the kit
  page's tooltips and notes, the order rows and their refusals ("bang and clear", "no bangs left."), the defenders' "stun charge". So key 4 still
  reads "stun canister ×2" with some in the pouch and "no flashbangs left" with none. SWITCHES: none for the lessons, menus and HUD (no line of
  them is in a run digest); the spoken lines sit behind their own key (`WORDS.guide`, words.ts `wg(now, was)`; `?noguide` off in the page, off on the frozen stand,
  `TPS_GUIDEWORDS=1` raises it; `guidewords-check`, `GUIDEWORDS_BREAK=1`), so with the key off every line is the line it was and a recording from
  before the key replays with it off. `cues.ts` classes the lockdown reply by its new words ("locked down. box him in", row 1, as "get around him" was). ALSO LEFT: the
  door notes' "… on your word" (several checks read it), "boot" in the frame rule's spoken lines, the objective row's "player down — press enter
  to restart" (the verdict's word), train-orders' "armoury" (as above). CHECKS: `writing-check`, `lesson-check` on the seven, `export --check`
  on the five regenerated levels and `words-lint`, both stands, green; the probes that name a changed string were moved with it and not run
  here (the full queue is run on the commit). Nobody has played with these lines; never seen on a GPU or in a browser.
