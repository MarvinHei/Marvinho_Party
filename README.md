# 🎉 Marvinho Party

A session-based multiplayer party game. Players live on a pixel-art board and
race to the finish line by winning minigames: lobby → animated board → a
**game-selection wheel** → a minigame → advance → win.

**Minigames:** **Wordle Race** (same word — fewest guesses wins, ties by time),
**Codenames** (two-team hidden-word game, even count of ≥ 4), **Skribbl**
(real-time draw & guess — each player draws once), and four LinkedIn-style
puzzle races — **Zip**, **Queens**, **Mini-Sudoku** and **Tango** (everyone
solves the same generated puzzle; fastest solver wins).

## Tech stack

| Part      | Tech                                                        |
| --------- | ---------------------------------------------------------- |
| Server    | Node + TypeScript, Express, **Socket.IO** (realtime)       |
| Client    | React + Vite, **Phaser 3** (pixel board, particles, tweens)|
| Shared    | A TypeScript package holding the client/server protocol     |
| Deploy    | Docker → **Railway** (single service serves client + WS)   |

```
shared/   # protocol & domain types (single source of truth)
server/   # lobby manager, minigame loop, socket wiring
client/   # React UI + Phaser board
```

## Run locally

Requires **Node 20+**.

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001 (health check at `/health`)

`npm run dev` starts both with hot reload.

### Play a full loop
1. Enter a nickname → **Create Lobby**. You get a 4-letter code.
2. Open a second tab, enter the code → **Join** (or use **debug mode**, below).
3. Host clicks **Start Game** (needs ≥ 2 players).
4. On the board, each player hits **I'm Ready!** (a vote — no countdown). Once
   everyone is ready a **wheel spins** to pick the next game (the host can also
   **Start now**), then a **5→0 countdown** kicks it off.
5. Play the chosen minigame:
   - **Wordle Race** — everyone solves the same word; fewest guesses wins, ties
     broken by time. Accepts a large dictionary (plurals, verb forms, …).
   - **Codenames** — a **team/role draft** animates players into Red/Blue teams
     each with a spymaster; give clues (guess up to the clue number **+1**),
     avoid the assassin. *Only offered for an **even count of ≥ 4** players.*
   - **Skribbl** — each player draws once (90 s); everyone else guesses in a
     live chat on the right. Guess points **scale with speed** (a much later
     guess scores proportionally lower); the drawer scores by how many guessed.
   - **Zip / Queens / Mini-Sudoku / Tango** — single-player puzzle *races*:
     everyone gets the same generated puzzle and solves it independently; the
     board auto-submits the moment it's valid, and players are ranked by solve
     time. Puzzles are generated server-side (always solvable) and checked by
     shared rule validators.
6. Results: **Wordle** shows a podium (who placed where); **Codenames** shows a
   **team scoreboard** (both winners, points, names). Then tokens hop forward
   with a particle burst. First to the finish wins.

## 🐛 Debug mode

Built for testing multiplayer solo. Click **Enable debug mode** in the top bar.

- **+ Add player** spawns another *real* player seat (its own socket) that joins
  the current lobby — control as many as you like from one browser.
- Each seat chip switches the **POV** to that player.
- **Turn off debug** collapses back to just the active seat.
- **🐛 Practice a minigame** (home screen, debug on) launches any single minigame
  **standalone** — no board, no scoreboard — spawning the bots it needs. After a
  round you get a practice menu to replay or switch games. Great for testing a
  minigame in isolation.

Because each seat is a genuine connection, the server treats them exactly like
separate people — no special-casing.

## Build & deploy (Railway)

The repo is Railway-ready via the `Dockerfile` and `railway.json`.

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and pick it.
3. Railway detects the `Dockerfile` and builds. No env vars are required
   (`PORT` is injected automatically; `NODE_ENV=production` is set in the image).
4. Once deployed, the same URL serves the web client **and** the websocket
   server. Open it, create a lobby, and share the invite link.

Health check: `GET /health` → `{ "ok": true }`.

To build/run the production image locally:

```bash
docker build -t marvinho-party .
docker run -p 3001:3001 marvinho-party
# open http://localhost:3001
```

## Roadmap (next slices)

- More minigames (add a `MinigameType`, a round class, and a panel — the wheel
  picks it up automatically).
- Board tile effects (bonus/penalty tiles), spectator view, reconnection.
- Sound + music, richer particle themes per minigame.
