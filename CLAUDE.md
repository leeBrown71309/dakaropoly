# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Dakaropoly** — a full 3D Monopoly played in the browser, with a Dakar (Senegal) board. Hot-seat only: 2–8 players share one screen, one turn at a time. Official Monopoly rules (mandatory auctions, even building, limited bank stock, mortgages, jail, trades, bankruptcy). Personal project, not commercial.

`README.md` and `HANDOFF.md` (both in French) describe the board, the rules covered, what is done, and what remains. Read `HANDOFF.md` before picking up unfinished work.

## Commands

Package manager is **bun**.

```bash
bun install
bun run dev        # http://localhost:5173
bun run typecheck  # tsc --noEmit
bun run test       # vitest run (engine tests)
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

Adding an action: extend the `Action` union in `types.ts`, add a `case` in `applyAction`, dispatch it from the HUD.
Adding an event: extend `GameEvent` in `types.ts` **and** add a `case` in `handleEvent` — the `default` branch drops unknown events silently.

### 3. Presentation — `src/three/` and `src/ui/`

- `src/three/Scene.tsx` is the R3F canvas (lights, ocean plane, fog, orbit controls). `BoardMesh` / `PawnMesh` / `DiceMesh` subscribe to the store.
- `geometry.ts` maps board index 0–39 to world coordinates via `tileCenter(pos)` plus `SIDE_LAYOUT` per side (tile dims, color band, label offset, pawn anchor, house row). **Labels are upright on all four sides on purpose** (single fixed camera) — do not reintroduce per-side text rotation.
- **Zero external assets.** Every label, logo, deck face and die face is a canvas-generated `THREE.CanvasTexture` in `textures.ts`; every sound is synthesized WebAudio in `src/audio/sounds.ts`. Do not add image, font or audio files.
- `src/ui/screens/` = Home, Setup, GameScreen, GameOver (routed by `screen` in `App.tsx`). `src/ui/hud/` = the in-game panels.
- Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config`; the theme lives in the `@theme` block of `src/index.css`. Styling is utility classes in JSX.

## Conventions

- **TypeScript is strict, including `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.** Indexed access into `players` / `tiles` / `rents` yields `T | undefined`; the codebase handles this with `?? 0`, `as Player` after a verified invariant, and early returns. Follow the local pattern rather than loosening the config.
- Identifiers, types and comments are in **English**; all player-facing strings (toasts, log lines, thrown error messages, HUD labels) are **French, inline**. There is no i18n library — do not add one or externalize strings unless asked. Money is formatted with `formatMoney` (`types.ts`), producing `1 500 F`.
- `src/` files are plain UTF-8. `tests/engine.test.ts` is currently double-encoded (accents in test *titles* are mojibake) and has a BOM — when editing it, prefer ASCII test names rather than adding more accented characters.

## Gotchas

- The Zustand store survives Vite HMR: an in-progress game can appear to reset to the setup screen after an edit. That is HMR, not a bug — do a full page reload to start clean.
- `queue` is module-level and is cleared in `goHome` / `startGame`; if you add a new way to leave a game, clear it there too.
