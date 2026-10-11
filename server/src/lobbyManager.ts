import type { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import type { Appearance, ClientToServerEvents, ServerToClientEvents } from "@marvinho/shared";
import { Lobby } from "./lobby.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

// Unambiguous, uppercase, human-shareable lobby codes.
const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);
const makePlayerId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();
  /** Set on shutdown: no new lobbies or joins. */
  private closed = false;

  constructor(private io: IO) {}

  createLobby(host: { socketId: string; nickname: string; appearance?: Appearance }): {
    lobby: Lobby;
    playerId: string;
  } {
    this.assertOpen();
    let code = makeCode();
    while (this.lobbies.has(code)) code = makeCode();

    const playerId = makePlayerId();
    const lobby = new Lobby(this.io, code, {
      id: playerId,
      socketId: host.socketId,
      nickname: host.nickname,
      appearance: host.appearance,
    });
    lobby.onEmpty = () => this.lobbies.delete(code);
    this.lobbies.set(code, lobby);
    return { lobby, playerId };
  }

  getLobby(code: string): Lobby | undefined {
    return this.lobbies.get(code.toUpperCase());
  }

  joinLobby(
    code: string,
    player: { socketId: string; nickname: string; appearance?: Appearance },
  ): { lobby: Lobby; playerId: string } {
    this.assertOpen();
    const lobby = this.getLobby(code);
    if (!lobby) throw new Error("Lobby not found.");
    const playerId = makePlayerId();
    lobby.addPlayer({
      id: playerId,
      socketId: player.socketId,
      nickname: player.nickname,
      appearance: player.appearance,
    });
    return { lobby, playerId };
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("The server is restarting — try again in a moment.");
  }

  /** Stop accepting lobbies and tear down every running one (timers included). */
  close(): void {
    this.closed = true;
    for (const lobby of this.lobbies.values()) lobby.dispose();
    this.lobbies.clear();
  }

  get size(): number {
    return this.lobbies.size;
  }
}
