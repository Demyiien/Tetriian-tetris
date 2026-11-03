# Afterglow

A polished, responsive Tetris game built with native JavaScript and Canvas. No installation or build step required. Requires Node.js 18 or later for the local server and tests.

## Play

Run `npm start` in this folder, then open http://localhost:5173. Click **Let’s play** or press **Enter**.

| Key | Action |
| --- | --- |
| Left / Right | Move (hold to repeat) |
| Up / X | Rotate clockwise |
| Z | Rotate counterclockwise |
| Down | Soft drop (hold to repeat) |
| C | Hold / swap, once per falling piece |
| Shift | Drop to the floor without locking; slide or rotate during the 650 ms lock delay |
| Space | Drop and lock immediately |
| P / Escape | Pause / resume |
| R | Restart confirmation |

Touch controls are available on narrow screens. The game automatically pauses when you switch tabs or windows.

## Features

- Seven-piece bags, wall kicks, ghost landing guide, five upcoming pieces, and hold.
- Delayed locking with up to 15 move/rotation resets.
- Line-clear scoring, combos, back-to-back bonuses, T-spin detection, and increasing speed every ten lines.
- Separate sound and effects toggles, with preferences and best score saved locally.
- Synthesized audio, drop trails, particles, line flashes, and reduced-motion support.
- Responsive layout, keyboard-accessible controls, and no runtime dependencies. Optional Google Fonts fall back to system sans-serif fonts offline.

Run `npm test` to exercise the game rules. Source files: `engine.js` contains the game rules; `app.js` handles input, rendering, audio, and persistence; `style.css` defines the layout and effects.
