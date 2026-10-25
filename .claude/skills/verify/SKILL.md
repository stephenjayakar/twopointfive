---
name: verify
description: Build/launch/drive recipe for verifying changes to the twopointsix WebGPU game (a page in the browser) in a real browser.
---

# Verifying twopointsix

Surface: a WebGPU canvas app (GUI). Verification = load it in a WebGPU-capable browser, drive input, look at pixels + HUD.

## Launch
- `bun run dev` (or the `dev` entry in `.claude/launch.json` via preview_start) → http://localhost:5173
- If :5173 is already up it is the maintainer's own play server (it bundles once at start-up, so it serves the code it started
  with): leave it alone and boot your checkout on the `lead` entry (`preview_start name: "lead"` → :5199, or
  `PORT=5199 bun run tools/serve.ts`; binding a port needs the sandbox off). A lane in a worktree uses its own :52xx port the same
  way. Restart :5173 only after a merge to main (kill the pid on the port, `PORT=5173 bun run tools/serve.ts` from the main checkout).
- Needs real WebGPU (Chrome/Edge stable on macOS works; the in-app Browser pane works). No npm install step.
- `bun run typecheck` uses the vendored compiler in `vendor/typescript` (not a verification step, just FYI). That folder is
  gitignored, so a cloud checkout does not have it: a system `tsc --noEmit -p tsconfig.json` does the same job there (tsc 6.0.2
  passes on `src/`; `tsconfig.json` covers `src/` only, not `tools/`).
- The build is the browser page. There is no other verification surface (the Mac app was removed 2026-10-11).

## Boot recipe (the boot is asynchronous)
- Navigate to `http://localhost:<port>/?paused&quality=medium&mute` (`?paused` = deterministic, nothing runs until stepped;
  `?mute` keeps the test page silent — the maintainer is listening to their own tab).
- `await window.__ready` — the pipelines compile through `createComputePipelineAsync` behind a start card; every `__hook` below is
  assigned only when that Promise resolves (it rejects if the boot dies; `window.__boot.pipelines` = {done,total,failed}).
- Wait for `document.getElementById('view').clientWidth > 0` (a hidden pane gives a 0×0 canvas), then `__menu.close()`, then step
  with `__runFrames`. (`__menu.close()` on the start card is its Start button: the plain solo night on the office. A squad
  mission is a page load of its own URL — see *Squad flows* below — and needs no `__menu.close()`.) Set `window.__testVisible = true` before anything that samples quality/timings, or it waits forever hidden.
- Stage captures with `__stage(pin, {park, guards, player})` (pins the camera verbatim) rather than the follow camera, and pass
  `tabId` on every Browser-pane call — the pane is shared with other lanes' tabs.

## Driving it without a human
`src/main.ts` exposes test hooks on `window` (kept in prod builds on purpose — it's a sandbox):
- `__runFrames(n, dt=1/60, keys=[])` — steps the whole app (game + sim + render) n fixed frames with the given
  `KeyboardEvent.code`s held. **Use this instead of waiting on rAF**: the Browser pane throttles rAF to zero while
  it is not visible, so wall-clock waits observe nothing. Screenshots do render the latest presented frame.
- `__mouse(x, y)` sets the aim cursor in CSS px; `__click(button)` queues a click edge (`MouseEvent.button`: 0 = left / fire,
  1 = middle / the orders menu, 2 = right / OCP or the rifle's attachment);
  `__input` is the live Input object (e.g. `__input.buttons |= 4` holds RMB / aim).
- `__game`, `__engine`, `__smoke`, `__cam` for state inspection; `__game.teleportPlayer([x,0,z])`,
  `__game.spectate = i` (camera follows guard i), `__game.aiEnabled = false` to freeze perception.
- Real DOM events also work: `window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))`, mouse events on `#view`.
- Between tool calls real frames may run (pane visible during screenshots), so stage state and step frames in
  the same JS call, then screenshot immediately. `window.__timeScale = 0` freezes game time for the real frames
  (handy to screenshot a muzzle flash a few fixed steps after `__click(0)`); set it back to 1.
- While the pane is hidden, scripted frames render offscreen (no swap-chain stall) so `__runFrames` is ~1 ms per
  frame on the CPU — the GPU lags behind. Before reading anything that comes from a GPU readback (light meter
  `player.visibility`, `guard.smokeTrans`, `__smoke.stats`) `await __engine.device.queue.onSubmittedWorkDone()`
  and then yield a macrotask. **Do not use `setTimeout` to yield in the hidden pane** — background timer
  throttling clamps it to ≥1 s and a 100-iteration loop silently takes minutes (and keeps running after the tool
  call times out, corrupting later calls; navigate to reload if that happens). Yield with a MessageChannel:
  `await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); })`.
- Keep a single javascript_tool call under ~25 s: a few hundred frames plus GPU syncs is fine, thousands are not.

- Long soaks: kick off an `async` IIFE that loops `__runFrames(60)` + MessageChannel yields and stores its result on
  `window.__res`, return immediately, then poll `window.__res` in a second call (a `setTimeout` poll is fine there).
- `__demo` (the OLD showcase tour, no longer on any card: `.start()/.stop()`, jump with `__demo.shotI = k-1; __demo.shotT = 999`),
  `__quality`
  (`.apply('verylow'|'low'|'medium'|'high'|'ultra')`, `.sample(dt)`), `__audio` (`.stats`).
- Squad hooks: `__orders` (`.open(target?)`, `.pick(i?)`, `.give(id, target?, who?)`, `.close()`, `.menu`, `.who`, `.cycleWho()`,
  `.log`, `.summary()`), `__roomclear` / `__nightbreach` / `__rescue` (`.start()`, `.stop()`, `.restage()`, `.state`,
  `.summary()`, `.log`), `__scenarios` (`.list`, `.current()`, `.pick(id)`, `.quit()`), `__picks` (`.list`, `.current()`, `.href(id)`).
- Clean captures without the HUD: run `bun run tools/shot-server.ts` (needs to bind :5174 → outside the sandbox), then
  `await __shot('name', jpegQuality=0.86, scale=1)` renders one offscreen frame, reads it back and POSTs it to
  `docs/shots/name.jpg`. Works while the pane is hidden. Resize the pane first (`resize_window` 1440×900) for 16:10.

## Flows worth driving
- Spawn → WASD/crouch/run → aim + LMB (muzzle flash light count goes up by 2, smoke goes live: `__smoke.stats.pool` > 0 a read-back later).
- Pistol up (key `1` draws it; backtick empties the hands, `E` does nothing on the page's board) + RMB with the reticle snapped on a fixture (the ring is on the light; no word is drawn beside it any more) → the light goes dark, restrikes
  after `tune.ocpDuration`; RMB on a guard's lit torch works too; nothing lit under the reticle → nothing happens.
- Stand in a guard's flashlight (`__game.guards[i]`, put the player 3–4 m along its `bodyYaw`) → suspicious → alert → guards fire.
- Key `3` (smoke) / `4` (stun) + LMB → billowing plume within ~3 s (debug view 5 shows volumetrics only). `G` throws nothing in the page
  (`?quickthrow` = the old quick throw for the visit). `5` + LMB throws a frag (it kills Sam too). Debug / sandbox actions are buttons in the debugger (the tweak panel, on the backslash key; Tab is the game's key and opens nothing).
  `X`, `T`, `Q` and `F` ARE keys again, with a squad on the floor (`src/game/orders.ts`): `X` (or the middle mouse button)
  opens the orders menu on what the cursor is on, `T` steps who takes the order, `Q` is the squad's command: the target's first row with no menu,
  or, on a door the men stand at or wait on, in they go by the entry they pick (`?noautopilot` = the first row always). The `B` KEY gives nothing
  in the page (`src/host/keymap.ts`; `?bkey` = the command on B for the visit), but the command's CODE is still `'KeyB'`: a real key press is Q,
  a scripted frame is `__runFrames(..., ['KeyB'])`.
  `F` is the go word for an order that waits on Sam's mark. With no operative on the floor X / T / the middle button do nothing.
- The debugger (the backslash key; `__panel.toggle()`): "rebuild cache" with other presets must not throw; debug views 0–17 are the
  'debug view' list on its Frame page (`__engine.settings.debugView = n`) — no key steps them. Its keys pressed for real:
  `PORT=<port> node tools/qa/panel-keys.cjs` (headless Chromium on the software adapter, ~3 min).
- `Space` at a door / walk or sprint into it (`__game.doors.byName('server')` → `.angle`, events via `onDoorEvent`);
  `__game.setBlackout(30,'debug')` / `.endBlackout()` (watch `targets.filter(t=>t.factor>0).length` restrike);
  `__demo.start()` tour end-to-end must leave `__demo.active === false` with camera yaw/dist restored and no `#fatal` text
  (`P` starts nothing from the page: the night and day showcases were removed — it only stops a tour that is running).
- Console: filter for `error:` / `Invalid` — WGSL reserved words and storage-texture aliasing show up there, not as exceptions.

## Squad flows (the game as it is played now)
- **The page opens on the title**: Play › · Options · Controls (`src/ui/menu.ts`; W S walk the buttons, Enter = Play). Play
  opens the one starting page (`src/ui/startpage.ts`, two steps that each fit the window: MISSION = the missions as a text list, the
  briefing with its plan, a Setup rail of one row a setting; Enter → TEAM & KIT = who comes and what each carries; Enter = Deploy, Esc back). Options is its own screen (`src/ui/options.ts`: Graphics · Audio · Game · Controls; keys 1–4, Esc back),
  also from the pause card. `?cards` = the older start card, which opens on the short list: six rows
  (`src/scene/picks.ts PICKS`: compound, registry, warehouse, depot, barracks-day, solo), each a link that deploys
  straight in with the kit as issued, and a **Missions** button for the mission list (`?cards&nopicks` = the card before the
  short list). `?pick=<id>` redirects to that row's own URL.
- **Missions list → Loadout → Deploy**: Missions (`src/ui/missions.ts`: the solo night + one row per `src/scene/scenarioList.ts
  SCENARIOS` entry; `H` / `J` step the sheet's Hour / Weather rows) → a pick opens the Loadout screen (`src/ui/loadout.ts`: how
  many teammates, none to four, each man's kit card, the Squad kit row) → Deploy is a PAGE LOAD of the mission's URL.
  `?loadout=<mission id>` lands on that screen directly.
- **Straight in by URL** (what a row loads; one config per fresh boot): `?roomclear` (the pair), `?roomclear&squad4` or
  `?squad=N` (0‥4 teammates), `?nightbreach`, `?rescue`, plus `&levelFile=<name>.json` for a level of its own (records, depot,
  block, block-squads, warehouse, compound, barracks, registry). After `await __ready` check `__scenarios.current()`,
  `__roomclear.state` / `__nightbreach.state` / `__rescue.state`, and that the team stands (`__roomclear.team`).
- **Orders menu**: aim the cursor at a door / a spot on the floor (`__mouse`), press `X` (one-frame `__input.pressed.add('KeyX')`
  inside a `__runFrames` step, or `__orders.open()`), read `__orders.menu` (rows listed for that target; greyed rows carry the
  reason), give a row with its digit (1 = the target's own order: move there / stack up, 2 = cover, 3 = fall in, 4 = hold,
  5 on a door = 'door tools ▸', a page of its own) or `__orders.pick(i)`; then step frames and watch `__orders.log` and the men
  walk. No row is ever on a digit above 5. While the menu is up the digits are not Sam's weapon slots.
- **Off switches worth knowing when a boot fails or a run looks different**: `?nodestruction`, `?glassfx=0`, `?mannequin`,
  `?noslots`, `?nodoorpath`, `?radiocheck=0` (each takes one shipped-on feature back out). A headless tool stands the game up
  FROZEN by default (the newer rules held off, as every frozen digest was recorded); `TPS_PROFILE=shipped` in front of it stands
  it up as the page opens (`src/host/profile.ts`; `bun run tools/qa/probes.ts shipped`, and against the real page
  `PORT=<port> node tools/qa/shipped-page.cjs`).

## Gotchas
- HUD GPU timings for render passes (composite/fxaa) are unreliable on Metal TBDR; compute pass timings are fine.
- Probe/light-meter and smoke-stats readbacks resolve on the event loop, so they stay stale inside a single `__runFrames` burst.
