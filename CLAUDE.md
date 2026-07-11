# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla-JS Tetris. HTML5 Canvas + CSS, **no dependencies, no build step, no tests**. Three source files: `index.html`, `style.css`, `game.js`. All game logic lives in `game.js` (~340 lines).

## Running

No install/build. Either open `index.html` directly (`open index.html`) or serve statically (`python3 -m http.server 8000`, then open `http://localhost:8000`). Prefer a local server to avoid file:// quirks.

There is no lint, no test runner, no package.json. Verify changes by playing in the browser.

## Architecture

Single game loop driven by `requestAnimationFrame` (`loop`), accumulating `dt` and dropping the piece once `dropAccum >= dropInterval`. Entry point at bottom of `game.js`: `initTheme(); init();`.

### The color-index convention (critical)

`COLORS` and `PIECES` are **1-indexed, parallel arrays** (index 0 is `null`). A piece matrix is filled with a single number that is simultaneously:
- the cell marker (nonzero = occupied), and
- the index into `COLORS` used to draw it, and
- the piece's `type` id.

So piece N's matrix must be filled with the number `N`, and `COLORS[N]` is its color. `drawBlock`, `merge`, `collide`, ghost and preview all read this number generically.

### Adding a piece (established pattern)

Three edits, all in `game.js` (see git history: commit `2fbecea` added "H", the U piece followed the same):
1. Append a color to `COLORS`.
2. Append a matrix to `PIECES`, filled with the new index.
3. Bump the multiplier in `randomPiece()` — `Math.floor(Math.random() * N) + 1` — so the new type can spawn. **This count must equal the number of real pieces**; forgetting it means the new piece never appears. An extra `COLORS` entry without a matching `PIECES` entry (and without bumping the multiplier) is dead/latent.

Rotation, collision, wall kicks, rendering are fully generic — a new square matrix rotates correctly with no extra code. Keep matrices square (3×3 like T/S/Z/J/L) so `rotateCW` stays centered.

### Rotation

`rotateCW` = transpose + row-reverse, works on any rectangular matrix. `tryRotate` applies wall kicks with column offsets `[0, -1, 1, -2, 2]`, taking the first non-colliding one.

### Randomizer

Pure uniform random (`randomPiece`) — **no 7-bag**.

### Theming

Light/dark toggle persisted in `localStorage` under `tetris-theme`. CSS custom properties (`--grid-color`, `--block-highlight`) are read into JS globals by `updateThemeColors()`; `applyTheme` sets `data-theme` on `<body>`.

### Board sizing

Board dims come from `COLS`, `ROWS`, `BLOCK` in `game.js`. If you change them, also update `width`/`height` of `<canvas id="board">` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`).

## CI

`.github/workflows/` holds Claude GitHub Actions only (code review, issue triage, PR auto-description, `@claude` mentions) — no build/test CI.
