import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import {
  sanitizeAppearance,
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
let shuttingDown = false;

app.get("/health", (_req, res) => {
  res.status(shuttingDown ? 503 : 200).json({ ok: !shuttingDown, lobbies: manager.size });
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

  socket.on("lobby:create", ({ nickname, appearance }, ack) => {
    try {
      const name = sanitizeNickname(nickname);
      if (!name) throw new Error("Please pick a nickname (1-16 characters).");
      const { lobby, playerId } = manager.createLobby({
        socketId: socket.id,
        nickname: name,
        appearance: appearance ? sanitizeAppearance(appearance) : undefined,
      });
      session = { lobbyId: lobby.id, playerId };
      socket.join(lobby.id);
      ack({ ok: true, data: { lobbyId: lobby.id, playerId, lobby: lobby.toView() } });
      lobby.broadcastLobby();
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:join", ({ lobbyId, nickname, appearance }, ack) => {
    try {
      const name = sanitizeNickname(nickname);
      if (!name) throw new Error("Please pick a nickname (1-16 characters).");
      const { lobby, playerId } = manager.joinLobby(lobbyId, {
        socketId: socket.id,
        nickname: name,
        appearance: appearance ? sanitizeAppearance(appearance) : undefined,
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

  socket.on("lobby:confirmResults", (ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.confirmResults(session.playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("lobby:forfeit", (ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.forfeitMinigame(session.playerId);
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

  socket.on("lobby:resume", ({ lobbyId, playerId }, ack) => {
    try {
      const lobby = manager.getLobby(lobbyId);
      if (!lobby) throw new Error("That match is no longer available.");
      lobby.resume(playerId, socket.id);
      session = { lobbyId: lobby.id, playerId };
      socket.join(lobby.id);
      ack({ ok: true, data: { lobbyId: lobby.id, playerId, lobby: lobby.toView() } });
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

  socket.on("lobby:setAppearance", ({ appearance }, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      lobby.setAppearance(session.playerId, sanitizeAppearance(appearance));
      ack({ ok: true, data: null });
    } catch (err) {
      fail(ack, err);
    }
  });

  // Every minigame input arrives on one of these two channels and is routed by
  // the lobby to the running game (which validates the payload).
  socket.on("game:send", (msg) => {
    if (!session) return;
    try {
      manager.getLobby(session.lobbyId)?.handleInput(session.playerId, msg);
    } catch {
      // Fire-and-forget: stale or invalid inputs are dropped silently.
    }
  });

  socket.on("game:request", (msg, ack) => {
    try {
      if (!session) throw new Error("Not in a lobby.");
      const lobby = manager.getLobby(session.lobbyId);
      if (!lobby) throw new Error("Lobby not found.");
      ack({ ok: true, data: lobby.handleInput(session.playerId, msg) });
    } catch (err) {
      fail(ack, err);
    }
  });

  socket.on("spectate:push", ({ data }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSpectatePush(session.playerId, data);
  });

  socket.on("spectate:watch", ({ targetId }) => {
    if (!session) return;
    manager.getLobby(session.lobbyId)?.handleSpectateWatch(session.playerId, targetId);
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

  socket.on("lobby:leave", () => {
    if (session) {
      // Intentional leave: drop the seat immediately (no grace/reconnect).
      manager.getLobby(session.lobbyId)?.quit(session.playerId);
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

/** Grace period for clients to receive the restart notice before sockets close. */
const SHUTDOWN_NOTICE_MS = 1500;
/** Hard stop if connections refuse to close. */
const SHUTDOWN_TIMEOUT_MS = 8000;

/**
 * Deploys and restarts send SIGTERM. Lobbies live in memory, so tell every
 * client the match is ending (they return to the home screen instead of hanging
 * on a dead socket), stop the game timers, then close cleanly.
 */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down (${manager.size} lobbies)`);
  io.emit("server:restarting", {
    message: "The server restarted for an update, so the match ended. Start a new lobby to play again.",
  });
  manager.close();
  setTimeout(() => {
    io.close(() => process.exit(0));
  }, SHUTDOWN_NOTICE_MS);
  setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

httpServer.listen(PORT, () => {
  console.log(`🎉 Marvinho Party server listening on :${PORT} (prod=${IS_PROD})`);
});
