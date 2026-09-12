import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import {
  sanitizeNickname,
  sanitizeSettings,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@marvinho/shared";
import { LobbyManager } from "./lobbyManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === "production";
// Debug mode (standalone minigame practice via lobby:debugStart) is a developer
// tool gated behind a feature flag: on outside production, and in production
// only when ENABLE_DEBUG=true. Keeps the sandbox path unreachable in prod.
const DEBUG_ENABLED = !IS_PROD || process.env.ENABLE_DEBUG === "true";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: IS_PROD ? undefined : { origin: true, credentials: true },
});

const manager = new LobbyManager(io);

app.get("/health", (_req, res) => {
  res.json({ ok: true, lobbies: manager.size });
});

// In production the built client is served from the same origin.
if (IS_PROD) {
  const clientDir = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

// Per-connection association so we can clean up on disconnect.
interface SocketSession {
  lobbyId: string;
  playerId: string;
}

io.on("connection", (socket) => {
  let session: SocketSession | null = null;

  const fail = (ack: (r: { ok: false; error: string }) => void, err: unknown) => {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    ack({ ok: false, error: message });
  };

  socket.on("lobby:create", ({ nickname }, ack) => {
    try {
      const name = sanitizeNickname(nickname);
      if (!name) throw new Error("Please pick a nickname (1-16 characters).");
      const { lobby, playerId } = manager.createLobby({
        socketId: socket.id,
        nickname: name,
      });
      session = { lobbyId: lobby.id, playerId };
      socket.join(lobby.id);
      ack({ ok: true, data: { lobbyId: lobby.id, playerId, lobby: lobby.toView() } });
      lobby.broadcastLobby();
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:join", ({ lobbyId, nickname }, ack) => {
    try {
      const name = sanitizeNickname(nickname);
      if (!name) throw new Error("Please pick a nickname (1-16 characters).");
      const { lobby, playerId } = manager.joinLobby(lobbyId, {
        socketId: socket.id,
        nickname: name,
      });
      session = { lobbyId: lobby.id, playerId };
      socket.join(lobby.id);
      ack({ ok: true, data: { lobbyId: lobby.id, playerId, lobby: lobby.toView() } });
      // Re-broadcast now that this socket is in the room, so it (and everyone
      // else) receives the up-to-date roster.
      lobby.broadcastLobby();
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:start", (ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.start(session.playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:ready", ({ ready }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.setReady(session.playerId, ready);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:forceStart", (ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.forceStart(session.playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:kick", ({ playerId }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.kickPlayer(session.playerId, playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:updateSettings", ({ settings }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.updateSettings(session.playerId, sanitizeSettings(settings));
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("wordle:guess", ({ guess }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const outcome = lobby.handleWordleGuess(session.playerId, guess);
      ack({ ok: true, data: outcome });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("codenames:clue", ({ word, count }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.handleCodenamesClue(session.playerId, word, count);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("codenames:guess", ({ index }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.handleCodenamesGuess(session.playerId, index);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("codenames:endTurn", (ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.handleCodenamesEndTurn(session.playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("skribbl:draw", ({ seg }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSkribblDraw(session.playerId, seg);
  });

  socket.on("skribbl:clear", () => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSkribblClear(session.playerId);
  });

  socket.on("skribbl:guess", ({ text }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handleSkribblGuess(session.playerId, text);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("skribblteams:draw", ({ seg }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSkribblTeamsDraw(session.playerId, seg);
  });

  socket.on("skribblteams:clear", () => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSkribblTeamsClear(session.playerId);
  });

  socket.on("skribblteams:guess", ({ text }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handleSkribblTeamsGuess(session.playerId, text);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("findword:submit", ({ word }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handleFindwordSubmit(session.playerId, word);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("tetris:board", ({ cells, lines }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleTetrisBoard(session.playerId, cells, lines);
  });

  socket.on("tetris:lines", ({ lines }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleTetrisLines(session.playerId, lines);
  });

  socket.on("tetris:target", ({ targetId }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleTetrisTarget(session.playerId, targetId);
  });

  socket.on("tetris:dead", () => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleTetrisDead(session.playerId);
  });

  socket.on("lobby:debugStart", ({ game }, ack) => {
    try {
      if (!DEBUG_ENABLED) throw new Error("Debug mode is disabled.");
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.debugStart(session.playerId, game);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("puzzle:submit", ({ solution }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handlePuzzleSubmit(session.playerId, solution);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("guesscountry:guess", ({ name }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handleGuessCountryGuess(session.playerId, name);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("travle:guess", ({ name }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      const res = lobby.handleTravleGuess(session.playerId, name);
      ack({ ok: true, data: res });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:leave", () => {
    if (session) {
      manager.getLobby(session.lobbyId)?.removePlayer(session.playerId);
      socket.leave(session.lobbyId);
      session = null;
    }
  });

  socket.on("disconnect", () => {
    if (session) {
      manager.getLobby(session.lobbyId)?.removePlayer(session.playerId);
      session = null;
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎉 Marvinho Party server listening on :${PORT} (prod=${IS_PROD})`);
});
