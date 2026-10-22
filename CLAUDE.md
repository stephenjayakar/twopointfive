# twopointsix — context for agents

**THIS FILE IS AN INDEX. NEW BULLETS GO INTO THE MATCHING `docs/agents/` FILE, NEVER INTO CLAUDE.md. A SESSION READS ONLY THE AREA
FILES ITS WORK NEEDS** — and inside one, the bullet it needs, not the file: `grep -n '<module or switch>' docs/agents/*.md`, then read
those lines. This file is loaded into every session; it was 640 KB and sessions died of it. `bun run tools/qa/claude-md-check.ts`
fails when it is over 14 KB or 150 lines, or when an area file is missing from the index below.

## What this is

A 2.5D top-down **squad game** on raw WebGPU / WGSL: Sam (the player) + up to four AI teammates under an orders menu, box-only levels
where every photon is dynamic, guards that see and hear through the same light meter and sound propagation the player is shown. It grew
out of a solo stealth demo (touchstone: Splinter Cell: Chaos Theory), which is still one mission. Bun toolchain, **no npm dependencies**
(TypeScript vendored under `vendor/typescript`, gitignored). The build is the page in the browser.

## Run · build · check

```bash
bun run dev            # tools/serve.ts → http://localhost:5173 (game at /, workbench at /workbench, replay viewer at /replay, /sounds, /music)
bun run build          # tools/build.ts → dist/
bun run build:one      # tools/build-one.ts → dist/one/twopointsix.html, the whole game page as ONE file (docs/agents/workflow.md)
bun run typecheck      # src/      ← before every commit (no vendor/typescript in a cloud checkout: a system `tsc --noEmit -p tsconfig.json`)
bun run typecheck:qa   # tools/qa (its own tsconfig)
bun run tools/qa/probes.ts <name|family|all-quick|list>   # exit 0 pass · 1 a probe failed · 2 unknown name
sh tools/qa/gate.sh <family …>                            # the families a change touched; red on any FAIL or silent probe
bun run tools/qa/knobs-check.ts                           # after adding a knob table
bun run tools/qa/rollback-check.ts --static               # after adding module state (a side table, a module `let`, a written container)
bun run tools/qa/tour.ts --runs 3 --quiet                 # + soak.ts --seeds 1,2,3 --minutes 12 --quiet after gameplay changes
```
Detail, exit codes, the page's `window` hooks and URL flags: `docs/agents/qa.md`.

## Rules every session needs

- **No GPU in the cloud.** The headless harness (`tools/qa/`, the whole Game over a Proxy GPU device) cannot see rendering, the GPU
  light meter, smoke sight lines or audio; a page check there runs on the software adapter. Say what was checked and how, and say
  "never seen on a GPU" of anything that was not. "Verified" in full also means driven in a real browser with no console / GPU errors.
- **Two stands** (`src/host/profile.ts`). FROZEN (the harness default) = the stand every frozen digest, tally and fixture was recorded
  on: newer rules are held off. SHIPPED (`TPS_PROFILE=shipped` in front of any headless tool) = the page as it opens. `FROZEN_HOLDS`
  lists every row they differ in, with the word that raises each on a frozen run (`TPS_<NAME>=1`).
- **A new rule is a switch.** ON in the page (a URL flag puts it off), OFF in the module and on the frozen stand; a `FROZEN_HOLDS` row;
  its table registered in `src/game/knobs.ts` (`knobs-check` is red otherwise) and carried by the session journal so that a recording
  from before the key replays with it off (`journal.ts applyKnobs`). Off = the build as it was, by run digest. It ships with a check
  whose `<NAME>_BREAK=1` path must fail, run on BOTH stands. A new default-on rule joins the frozen-digest pin lists.
- **No `Math.random` in `src/game`** — `simRandom()` (`src/math/dice.ts`); `bun run tools/qa/dice-check.ts` is red on one. No wall
  clock inside the update either.
- **Module state is registered** (`src/math/side.ts`; `docs/agents/replays.md`, the rollback snapshot). In the simulation's folders: `SideMap` /
  `SideSet`, never `new WeakMap` / `WeakSet`; a module `let` or written container is `rollbackVar` / `rollbackRoot` or has its row in
  `tools/qa/rollback-exempt.ts`; a die kept in state is a `Die` (`math/dice.ts`), never a closure. The static pass is red otherwise.
- **`src/game` is one runtime import cycle.** No top-level statement may USE another game module's export (a module-level table or
  `new X()` built from one breaks only in the page's bundle). Build such tables lazily; boot a new module once in the page.
- **One model for presentation and AI.** What the AI senses is what the picture shows (light, smoke, sound paths). A GPU value reaches
  game code only through a named `Game.sensors` query with a headless stand-in.
- **Player-facing rules.** Show, not tell. No digit above 5 on a menu. No compass words on the HUD or in a door's name. Never harder
  by hit points. Teammates walk slower than the player and run only for a reason (`teampace.ts`). Level and effects numbers tuned in the viewer are authored data.
- **Git.** Work on your own branch; never push to `main` (it moves only by a PR the maintainer merges); no force-push; never
  `git stash`; never `cd` into `.worktrees/*` (`git -C`). Unsigned commits are fine (`git -c commit.gpgsign=false commit`). Human-style
  messages only: no attribution lines, no tool trailers, no model names anywhere in the repo. This repo is PUBLIC: nothing from
  outside the game goes into a file or a commit message (no private links or ids, no names, no machine paths). The build to play is
  the head of branch `twopointsix`.
- **Servers.** Never `pkill -f tools/serve.ts`; stop a server by pid or port. Do not edit `src/` under a running measurement: every
  run is a fresh bun that imports the tree as it is.
- **A change that players read or that moves a tally** says, in its area file: the switch, both stands' words, the check, what was
  measured and on how many seeds, and what nobody has seen or played.

## Writing for the player

Every word a player reads or hears (tutorial lines and cards, mission blurbs, menus, HUD rows, radio lines) is written the way you'd
say it out loud to a friend who is playing next to you. Read each line aloud before you commit it: if you wouldn't say it, rewrite it.
The maintainer's model, from a tutorial card:

> Before: "Where the sound was he stops, his back to you."\
> After: "He'll check out the sound and then stop, with his back to you."

- **Who, then what they do, then the rest.** Subject, verb, object, and only then where, when or how. Don't open on a place or a
  participle ("Stacked on a door, they wait") and don't tack on a verbless phrase ("his back to you"). A plain "when" or "if"
  clause in front is fine: "When he stops, sneak up behind him."
- **Talk to "you", and you press the key.** "Press [E] to grab him", not "[E] takes hold of him" and not "[E]: grab".
- **Use contractions** (he'll, you'll, don't, it's, they're), "will" for what is about to happen, and an order for what to do.
  No sayings: "Men fight by what they can see" is "Enemies can only fight what they can see."
- **Join ideas with words** (and, then, so, because, with, to), not with a colon, a dash or a bare comma.
- **Everyday American words**: grab, flashlight, breaker box, around, enemy, guard. Not "take hold of", "torch", "mains box",
  "round", "a man", "your word".
- **Short is good, clipped is not.** Cut ideas, never the small words (the, a, to, you, press). "Show, not tell" means fewer
  screens of text, not telegrams. A character cap is there for layout: if a natural sentence doesn't fit, say less or raise the
  cap openly. Never squeeze the sentence.
- **A voice keeps its brevity, not odd grammar.** A radio call can be "Stacked up." or "Room clear."; it still runs in the order a
  person would say it.

The banned words stand (no compass words, no digit above 5) and a key is still written as its code in brackets (`[B]`). Longer
notes and before and after pairs from the game's own text: `docs/agents/writing.md`.

## The area files (`docs/agents/`)

Each is the old CLAUDE.md's bullets for that area, word for word (moved 2026-10-13). The git log is the newest in-repo record of what
happened when; the live queue is outside the repo.

- `overview.md` — what the game is, one model for picture and AI, where the module families live, a line per small module, the
  architecture map (files, frame flags, box flags, the Frame layout), the removed Mac app, the import cycle.
- `qa.md` — run / build / check in full, the two stands, the knob registry, the gates, driving the page headlessly (hooks, URL flags,
  `__stage`, `__ready`), checkpoints + autosave.
- `missions.md` — scenario kinds, fresh deals and ways in, Training lessons, the par clock, the snatch, timed charges, Mousehole, the
  long hall, the vault, quiet missions, lights-out, the glasshouse, the solo night's opening.
- `menus.md` — title, start page, Team & kit, the kit figure, key art, the debrief, the sandbox row, the debugger panel (backtick).
- `squad.md` — the orders menu and its keys, every squad order, move-there, four in two pairs and the word, fall in, rear men, throws
  on order, a teammate works a thing, log lines.
- `door-tools.md` — open / bang / charge / outside, the threshold, the whole-room rule, doors found shut, entry paths, cans and leaves.
- `team-feel.md` — the room fight's feel rules and Team feel rows, cleared rooms, corners and lead, night vision, IR lasers, silent or
  loud, sneaking with Sam.
- `enemies.md` — difficulty and Hard, defender cues, defender squads and the radio check, covered lanes, QRF, pursuit tactics, the
  gun-in-a-hold rule, needs, civilians, the calm torch.
- `dialogue.md` — the dialogue pass (`WORDS`): who says what where, hostages, defenders, door names, the lint.
- `stealth.md` — fog of war (cone, squad doors, squad fire, nothing live in the fog), sticky cameras, interaction rows, devices, the
  wall hold, the whistle, the close-in mode, takedowns, stealth poses, the optical wand.
- `player.md` — guns at walls, small player rules, friends in the line, blasts on the player, the kit and the FN2000 / issue kit, aim
  weight, kit handling, hands, hands at work, the player's own charges.
- `doors.md` — locks and keys, one-way doors, frames that hold a boot, doors stay where left, rolling chairs, real-size doors, the
  second-way-in level rule.
- `destruction.md` — wall charges (outer walls, furniture, the safety radius), glass (panes, refraction, fracture, rounds through),
  decals, GPU particles, destruction under fire, the paced blast frame, cut boxes.
- `weather.md` — the hour, weather kinds, cloud over the hour, the level's own roofs, the dust volume, wet characters, wind.
- `levels.md` — the level is data, scenario data in the level file, the GWOT look and its look files, lived-in rooms, the roof rule.
- `showcases.md` — the old tour, the breach drill and the daylight variant, the Director (level scripting, no program today), the removed
  night and day showcases.
- `anim.md` — MOVES and TURN, the second MOVES pass, wounds, character materials.
- `render.md` — judging renderer output, GPU timing traps, quality presets and the ladder, caps, froxels, ReSTIR, TAAU, sharp direct,
  the gather, the denoiser, the smoke solver, effects numbers, prototype branches (longer renderer bullets:
  `docs/internal/claude-md-renderer-systems.md`).
- `replays.md` — the F10 session journal and the `Sensors` seam, the game's own die, the fixed step, the input record, F7 replays, the
  engine replay player, kept runs and the dump.
- `sounds.md` — the game's sound table, sound lanes on the engine replay, takes, tuning, the score and its pieces.
- `writing.md` — how player text is written: the rules above at length, by kind of text (prompt, card, list row, menu, radio line),
  with before and after pairs from the game.
- `workflow.md` — the fast loop, reviews, lanes and their deliverables, commits, the maintainer's taste, where the repo lives, the
  playable Artifact.

Other maps: `STYLE.md` (the look as rules), `docs/level-format.md`, `VIEWER.md`, `docs/internal/<topic>.md` (notebooks),
`STATUS.md`. `handoff.md` and a few old logs are not in this repo: see `docs/agents/workflow.md`.
