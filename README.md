
# Single-Player Casino — Game Suite

This workspace contains a small, local, single-player gambling simulator with a game selector and individual game pages. All data is stored locally in the browser's `localStorage`.

Files of interest:

- `index.html` — game selector (choose which game to play)
- `slots.html` — slots machine (original implementation)
- `blackjack.html`, `roulette.html`, `plinko.html`, `crash.html`, `mines.html` — game pages (placeholders included)
- `style.css` — shared styles
- `script.js` — slots game logic
- `*.js` — placeholder scripts for each game (e.g., `blackjack.js`)

How to run:

Open the main menu in your browser. From PowerShell:

```powershell
start 'c:\Users\JA\Desktop\test\casino\index.html'
```

Default bankroll is $1000 and is stored in `localStorage` under the key `casino_bankroll`.

Next steps you can ask for:

- Implement full game logic for any of the placeholder games (Blackjack, Roulette, Plinko, Crash, Mines).
- Add sound effects, animations, and richer UI for each game.
- Add session stats, RTP estimation, and a save/load export feature.

Project layout (reorganized):

- `index.html` — main menu
- `assets/style.css` — shared styles
- `games/slots/` — slots UI and `script.js`
- `games/blackjack/` — `index.html` + `main.js` (placeholder)
- `games/roulette/` — `index.html` + `main.js` (placeholder)
- `games/plinko/` — `index.html` + `main.js` (placeholder)
- `games/crash/` — `index.html` + `main.js` (placeholder)
- `games/mines/` — `index.html` + `main.js` (placeholder)
 - `games/dice/` — `index.html` + `main.js` (new)

To open the menu:

```powershell
start 'c:\Users\JA\Desktop\test\casino\index.html'
```

If you'd like, I can now implement one full game into its folder (Blackjack, Roulette, Plinko, Crash, or Mines). Tell me which one to prioritize.

