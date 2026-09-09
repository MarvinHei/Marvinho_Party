import type { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import type { ClientToServerEvents, ServerToClientEvents } from "@marvinho/shared";
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

  constructor(private io: IO) {}

  createLobby(host: { socketId: string; nickname: string }): {
    lobby: Lobby;
    playerId: string;
  } {
    let code = makeCode();
    while (this.lobbies.has(code)) code = makeCode();

    const playerId = makePlayerId();
    const lobby = new Lobby(this.io, code, {
      id: playerId,
      socketId: host.socketId,
      nickname: host.nickname,
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
    player: { socketId: string; nickname: string },
  ): { lobby: Lobby; playerId: string } {
    const lobby = this.getLobby(code);
    if (!lobby) throw new Error("Lobby not found.");
    const playerId = makePlayerId();
    lobby.addPlayer({ id: playerId, socketId: player.socketId, nickname: player.nickname });
    return { lobby, playerId };
  }

  get size(): number {
    return this.lobbies.size;
  }
}
