# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Dakaropoly** — a full 3D Monopoly played in the browser, with a Dakar (Senegal) board. 2–8 players, either hot-seat on one screen or online with a room code, one turn at a time. Official Monopoly rules (mandatory auctions, even building, limited bank stock, mortgages, jail, trades, bankruptcy). Personal project, not commercial.

`README.md` and `HANDOFF.md` (both in French) describe the board, the rules covered, what is done, and what remains. Read `HANDOFF.md` before picking up unfinished work.

## Commands

Package manager is **bun**.

```bash
bun install
cp .env.example .env.local   # online mode; the game runs fine without it
bun run dev        # http://localhost:5173
bun run typecheck  # tsc --noEmit
bun run test       # vitest run (engine + dice physics)
bun run build      # typecheck + vite build
bun run preview
```

Run a single test file or a single test by name:

```bash
bun x vitest run tests/engine.test.ts
bun x vitest run -t "loyer"
```

Required after every change: `bun x tsc -p tsconfig.json --noEmit` and `bun run test`. Run `bun run build` before delivering a feature.

## Architecture

Three layers, strictly separated. **All game logic belongs in the engine**; 3D and HUD only read state and replay events.

### 1. Engine — `src/game/engine.ts` (pure, no React)

`applyAction(state, action) → { state, events }` is the single entry point for every player action. It is a state machine over `PhaseKind`:

`turn-start → resolving → (card | buy-decision | auction | debt) → post-roll → turn-start | game-over`

Conventions inside the engine:

- `applyAction` clones `prev` into a local `s` at the top, then every helper (`payOrDebt`, `walkAndResolve`, `resolveTile`, `endTurn`, …) **mutates `s` in place** and pushes into `events`. Do not reintroduce immutable updates inside helpers — match the surrounding style, and never mutate `prev`.
- Illegal actions `throw new Error("<French message>")`. The store catches and surfaces them as a toast; the engine never fails silently and never returns an error state.
- Randomness is **state-owned and deterministic**: `s.rng` is seeded in `createGame(defs, seed?)` and advanced by `nextRng`. Never call `Math.random()` inside the engine — it would break test reproducibility.
- `{ t: "roll", forced: { a, b } }` exists **only for tests**. Do not expose it in the UI.
- `selectors.ts` holds all rule *queries* (rent, buildability, mortgage value, net worth). `can*` functions return `null` when allowed or a French reason string when not — the HUD renders that string directly as the disabled reason. Keep new rule math there, not in components.
- Board and card data live in `src/game/data/` (`board.ts` = 40 tiles with official prices/rents, `cards.ts` = 16 "Baraka" + 16 "Teranga" cards as typed `CardEffect`s).

### 2. Store + animation queue — `src/game/store.ts`

Zustand store holding `screen`, `game` (the engine state), and view-only state. `dispatch(action)` calls `applyAction`, commits the new state immediately, and **enqueues the returned events** into a module-level sequential pump (`enqueue` / `pump` / `handleEvent`), which plays them one at a time with `await sleep(...)`, sounds, and 3D side effects.

Two consequences to keep in mind:

- **`player.position` (logical, instantly correct) and `visPos[playerId]` (visual, animated) are different.** 3D components read `visPos`; rules read `player.position`. Never wire a pawn to `player.position`.
- The `show-card` event **blocks the queue** on a promise stored in `cardResolve`, released by `ackCard()` from `CardModal`. Any new blocking event must resolve the same way or the queue stalls.
- **Every event the engine emits must be handled.** `toast` and `sound` were once dropped by the `default` branch, which silently hid 27 messages (tax, rent, salary, three-doubles) for the whole game. `tests/events.test.ts` guards the announcements; keep it that way when adding events.

Adding an action: extend the `Action` union in `types.ts`, add a `case` in `applyAction`, dispatch it from the HUD.
Adding an event: extend `GameEvent` in `types.ts` **and** add a `case` in `handleEvent` — the `default` branch drops unknown events silently.

### 3. Presentation — `src/three/`, `src/ui/`, `src/animation/`

- `src/three/Scene.tsx` is the R3F canvas (lights, ocean, fog, contact shadow) and owns the orbit controls. The camera is driven from the HUD through `three/cameraRig.ts`, a tiny façade the Scene registers into — neither side imports the other.
- **`geometry.ts` is the only source of board coordinates.** The board is a 13×13 grid: 2×2 corners at ±5.5, 1×2 tiles between them, a 9×9 centre field inside ±4.5. `tileCell(pos)` gives the cell, `bandCenter(pos)` the colour strip, `pawnWorldPos` where tokens stand, and `BOARD_SURFACE_Y` the height everything rests on. Do not recompute any of this locally.
- **The board is printed, not assembled.** `boardTexture.ts` draws the whole playing surface — tile fields, colour bands, names, prices, icons, corners, centre wordmark — into one 2048² canvas mapped over a single box. Only state-dependent things (owner marks, houses, mortgage marks, decks) are meshes, in `BoardMesh.tsx`. Text is drawn **upright on all four sides** on purpose (one screen, one seat); do not reintroduce per-side rotation.
- **Tokens are extruded from their own HUD glyph.** `PAWN_SILHOUETTES` in `game/data/pawns.ts` holds one set of path data, rendered flat by `ui/icons/PawnGlyph.tsx` and extruded with a bevel by `PawnMesh.tsx`. Change the path once and both follow.
- Icons shared between the HUD and the printed board live as path strings in `ui/icons/paths.ts`, consumed as SVG by `Icon.tsx` and as `Path2D` by `boardTexture.ts`.
- `src/ui/kit/` holds the shared primitives (`Button`, `Surface`, `Money`, `TitleDeed`); build new panels from these rather than restyling divs.
- **Zero external assets** beyond the two self-hosted webfonts (`@fontsource-variable/*`): every board mark, deck face and die face is canvas-drawn, every sound is synthesized WebAudio in `src/audio/sounds.ts`. Do not add image or audio files.
- Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config`; tokens live in the `@theme` block of `src/index.css`.

### Telling the players what happened

Money must never move without something the interface can show. Two channels: `toast` events for the running commentary, and `announce` events for things that happen *to* a player (tax, rent, jail, bankruptcy), which interrupt the queue with a card for 1.8 s. `recordLog` in the engine derives the journal from those same events, so a new announcement is logged automatically rather than depending on each call site remembering.

### Settings

`Settings` in the store holds the tunables the player can reach from the cog in the rail (toast and announcement durations, token speed, volume). Read them through `useGame.getState().settings` at the moment they are used — never capture a duration in a module constant, or the slider stops having any effect. They persist with the save; `onRehydrateStorage` merges over `DEFAULT_SETTINGS` so a save written before a setting existed does not leave it `undefined`.

### Waiting for the board

`applyAction` commits the new state synchronously, so the rules are already several steps ahead of the animation. Anything that describes where a token *is* — the buy, auction and debt panels, and the rail's primary action — must gate on `animating` (true while the event pump is draining), otherwise a property card appears before its token has finished moving.

### Saved games

The store is wrapped in zustand's `persist` (key `dakaropoly/save`). Only `screen`, `game` and `soundOn` are written — everything mid-animation is transient. On rehydrate, `visPos` is snapped to each player's logical position (the animation queue did not survive), a card left awaiting acknowledgement is reopened (its phase blocks every action until dismissed), and a save that fails `isRestorable` drops the player back to the home screen rather than into a broken board. Bump `version` whenever `GameState` changes shape.

### Phones, and why the game is landscape-only

A phone held in landscape is the smallest board the game supports: roughly 740×390 CSS pixels once the notch is taken out. Held upright it is not supported at all — `RotateGate` (mounted above every screen in `App.tsx`) covers the page and asks for the device to be turned.

- **`useCompact()` in `src/ui/useViewport.ts` is the single switch.** Every HUD piece has a dense variant behind it, chosen in the component rather than in CSS, because most of what has to change are numbers passed as props (`PawnGlyph size`, `Button size`, `TitleDeed dense`). Keep new panels on the same switch; do not add a second breakpoint.
- The rotate gate is deliberately limited to `(pointer: coarse)`. A narrow desktop window must get the compact layout, never a wall it cannot obey. To test it, use a browser's device emulation — resizing a desktop window will not trigger it.
- **Safe areas are handled once.** `GameScreen` mounts every edge-anchored control inside a `.p-safe` wrapper; absolutely positioned children resolve against its padding box, so they clear a notch without knowing it exists. That wrapper is `pointer-events-none`, so anything mounted in it that the player touches needs `pointer-events-auto`. Full-bleed overlays — the card, the announcement, the modals, the money rain — stay outside it and run to the glass.
- Never put Tailwind padding utilities on a `.p-safe` element: utilities sit in a later cascade layer and would win.
- Compact is not only smaller type. The camera pulls back (`COMPACT_VIEW`), the zoom buttons fold into the rail as a single recentre because pinching already zooms, the decision panels hang from the top and scroll instead of centring (`decisionAnchor`), the roster becomes two columns, and the renderer drops to a 1024 shadow map with no MSAA.
- `installAudioUnlock()` in `main.tsx` opens the audio context on the first gesture. Without it iOS plays the whole game in silence, because sounds are fired from the event queue long after the tap that caused them.

### Online play — `src/net/`

A room is a code, a Supabase Realtime channel and one row holding the state.

- **Actions are relayed, not states.** Every client runs the same pure engine
  over the same seeded randomness, so replaying the sequence lands them all on
  the same board *and* regenerates the events that animate it — which shipping
  a snapshot could never do. Dice cost nothing extra: the physics seed is
  derived from `(a, b, turnCount)`.
- **Nothing is applied where it is played.** `dispatch` hands the action to
  the relay and the channel echoes it back (`broadcast: { self: true }`), so
  every device — the one that played included — applies from the same place in
  the same order. With no relay installed, `dispatch` is the hot-seat path,
  untouched. That seam is the whole integration: `applyLocally` is the old
  body of `dispatch`.
- `ackCard` goes over the wire too. A card blocks each client's animation
  queue, so if only the drawer dismissed it, everyone else would sit at
  `animating === true` for ever.
- **`actorFor(state)` decides who may act** — not `game.current`, since an
  auction belongs to the head of the bidding queue. The HUD reads it through
  `useIsMyTurn` / `useMySeat` in `src/ui/useTurn.ts`; never paste
  `=== localPlayerId` into a component.
- **Seat = pawn.** One unique index keeps both unique, and turn order follows
  the pawn table. `rooms.seat_order` freezes the mapping at kickoff, because
  the engine numbers players by their position in the array given to
  `createGame` — recomputing it later would renumber everyone the moment
  somebody left.
- **Identity is per tab** (`sessionStorage`), not per browser. Two tabs of one
  browser sharing an id meant the second player silently took over the first
  one's seat — and two tabs is how anyone tries this before a real game.
- Anonymous sign-ins may be switched off on a Supabase project. When they are,
  `ensureSession` generates the id locally and the `anon` policies apply: the
  game still works, but seat ownership is a convention rather than a rule.
  Trades are **disabled online** until they become propose-then-accept: the
  engine still executes an offer on the spot, with no consent from the other
  side.

### Dice

`src/animation/diceRoll.ts` is pure and has no DOM or three.js dependency, so it is unit-tested. The engine draws the result first, so the throw cannot be random: `simulateThrow(a, b, seed)` runs a real cannon-es rigid-body simulation, records the poses, and only **once the dice have settled** paints the pip values onto the faces — the face that ended up pointing at the sky gets the engine's value, with opposite faces still summing to seven. The store computes the recording and sleeps for its real duration; `DiceMesh.tsx` only replays the track.

## Conventions

- **TypeScript is strict, including `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.** Indexed access into `players` / `tiles` / `rents` yields `T | undefined`; the codebase handles this with `?? 0`, `as Player` after a verified invariant, and early returns. Follow the local pattern rather than loosening the config.
- Identifiers, types and comments are in **English**; all player-facing strings (toasts, log lines, thrown error messages, HUD labels) are **French, inline**. There is no i18n library — do not add one or externalize strings unless asked. Money is formatted with `formatMoney` (`types.ts`), producing `1 500 F`.
- **Custom CSS classes must sit in `@layer components` (or `@layer base`).** Unlayered rules beat every Tailwind utility, so a stray `.mat-card { border-radius }` silently defeats `rounded-l-none` and `.mat-wood { position: relative }` defeats `absolute`. `src/index.css` is already laid out this way — keep new rules inside a layer.
- **No emoji in the interface.** The icon family in `ui/icons/Icon.tsx` covers the HUD; add a new outline there rather than reaching for a character.
- `src/` files are plain UTF-8. `tests/engine.test.ts` is currently double-encoded (accents in test *titles* are mojibake) and has a BOM — when editing it, prefer ASCII test names rather than adding more accented characters.

## Gotchas

- The Zustand store survives Vite HMR: an in-progress game can appear to reset to the setup screen after an edit. That is HMR, not a bug — do a full page reload to start clean.
- `queue` is module-level and is cleared in `goHome` / `startGame`; if you add a new way to leave a game, clear it there too.
- cannon-es `world.fixedStep()` paces itself against the wall clock and barely advances inside a synchronous loop. The dice simulation uses `world.step()`; keep it that way or the dice never land.
- Vite must dedupe `three` (see `vite.config.ts`): drei pulls in `three-stdlib`, and two copies of three break the `instanceof` checks React Three Fiber relies on.
- A headless preview pane that is not painting runs neither `requestAnimationFrame` nor `ResizeObserver`, so R3F never measures its container and the canvas stays 300×150 and blank. That is the harness, not the app — check `document.querySelector('canvas').width` before debugging the scene.
