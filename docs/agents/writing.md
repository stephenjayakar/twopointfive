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
lesson, and a pronoun with its verb left uncontracted. It also reads the sentences this guide was written from and must catch every one of them and pass
their rewrites; `WRITING_BREAK=1` reads the old sentences as a level's and must fail. It cannot read text built in code (menus, HUD rows, spoken lines):
those rest on the review below.

## Review

Whoever writes or changes player text reads every changed line aloud, and a second reader who did not write it does the same
before the change is called final. A pattern check can catch a colon after a key or a missing contraction; only a reader catches
a sentence nobody would say.
