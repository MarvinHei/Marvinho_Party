import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import {
  WHEEL_SPIN_MS,
  defaultLobbySettings,
  type ClientToServerEvents,
  type GameEventMsg,
  type MinigameResult,
  type MinigameType,
  type ServerToClientEvents,
} from "@marvinho/shared";
import { Lobby } from "../src/lobby.js";
import { LobbyManager } from "../src/lobbyManager.js";
import { randomWord } from "../src/minigames/words.js";
import type { GameEnv } from "../src/minigames/env.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
interface Sent {
  to: string[];
  except: string[];
  event: string;
  args: unknown[];
}

/** A stand-in for socket.io that records every emit and who it targeted. */
function fakeIO() {
  const sent: Sent[] = [];
  const target = (to: string[], except: string[] = []): unknown => ({
    emit: (event: string, ...args: unknown[]) => sent.push({ to, except, event, args }),
    to: (id: string) => target([...to, id], except),
    except: (id: string) => target(to, [...except, id]),
  });
  const io = { to: (id: string) => target([id]), sockets: { sockets: new Map() } } as unknown as IO;
  return { io, sent };
}

const COUNTDOWN = 5100;

/** Real (faked) time, but a fixed RNG: every pick takes the first option. */
const env: GameEnv = { now: () => Date.now(), random: () => 0 };
const answer = () => randomWord(env.random);

function setup(game: MinigameType) {
  const { io, sent } = fakeIO();
  const lobby = new Lobby(io, "ROOM", { id: "p1", socketId: "s1", nickname: "Ana" }, env);
  lobby.addPlayer({ id: "p2", socketId: "s2", nickname: "Ben" });
  const settings = defaultLobbySettings();
  for (const g of Object.keys(settings.games) as MinigameType[]) settings.games[g].enabled = g === game;
  lobby.updateSettings("p1", settings);
  return { lobby, sent };
}

/** Drive the lobby from Start through the wheel, explanation and countdown. */
function startRound(lobby: Lobby) {
  lobby.start("p1");
  vi.advanceTimersByTime(WHEEL_SPIN_MS + 300);
  expect(lobby.phase).toBe("explaining");
  lobby.setReady("p1", true);
  lobby.setReady("p2", true);
  expect(lobby.phase).toBe("countdown");
  vi.advanceTimersByTime(COUNTDOWN);
  expect(lobby.phase).toBe("minigame");
}

const gameEvents = (sent: Sent[]) =>
  sent.filter((s) => s.event === "game:event").map((s) => ({ to: s.to, msg: s.args[0] as GameEventMsg }));
const ended = (sent: Sent[]) => {
  const e = sent.filter((s) => s.event === "minigame:ended");
  return e.length ? (e[e.length - 1].args[0] as { result: MinigameResult }).result : null;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Lobby with a registry minigame (Wordle)", () => {
  it("runs a round end to end and advances the board by rank", () => {
    const { lobby, sent } = setup("wordle");
    startRound(lobby);
    expect(sent.some((s) => s.event === "minigame:start" && (s.args[0] as { type: string }).type === "wordle")).toBe(true);
    expect(gameEvents(sent).some((e) => e.msg.game === "wordle" && e.msg.kind === "init")).toBe(true);

    const word = answer();
    const first = lobby.handleInput("p1", { game: "wordle", kind: "guess", payload: { guess: word } });
    expect(first).toMatchObject({ solved: true });
    // A solve shrinks the shared clock and tells clients.
    expect(sent.some((s) => s.event === "minigame:timer")).toBe(true);

    lobby.handleInput("p2", { game: "wordle", kind: "guess", payload: { guess: word } });
    const result = ended(sent);
    expect(result?.type).toBe("wordle");
    expect(result?.ranking).toEqual(["p1", "p2"]);
    expect(result?.rewards).toEqual({ p1: 3, p2: 2 });
    expect(result?.reveal).toBe(word);
    const positions = Object.fromEntries(lobby.toView().players.map((p) => [p.id, p.position]));
    expect(positions).toEqual({ p1: 3, p2: 2 });
  });

  it("rejects inputs for another game, unknown kinds and bad payloads", () => {
    const { lobby } = setup("wordle");
    startRound(lobby);
    expect(() => lobby.handleInput("p1", { game: "pong", kind: "move", payload: { y: 0.5 } })).toThrow("No active round.");
    expect(() =>
      lobby.handleInput("p1", { game: "wordle", kind: "nope", payload: {} } as never),
    ).toThrow("Unknown input.");
    expect(() =>
      lobby.handleInput("p1", { game: "wordle", kind: "guess", payload: { guess: 42 } } as never),
    ).toThrow("Invalid input.");
    expect(() =>
      lobby.handleInput("p1", { game: "wordle", kind: "toString", payload: {} } as never),
    ).toThrow("Unknown input.");
  });

  it("ends the round on the timer when nobody solves", () => {
    const { lobby, sent } = setup("wordle");
    startRound(lobby);
    vi.advanceTimersByTime(defaultLobbySettings().games.wordle.timerSeconds * 1000);
    const result = ended(sent);
    expect(result?.rewards).toEqual({ p1: 0, p2: 0 });
    expect(lobby.phase).toBe("intermission");
  });

  it("gives a forfeiter nothing", () => {
    const { lobby, sent } = setup("wordle");
    startRound(lobby);
    lobby.forfeitMinigame("p2");
    lobby.handleInput("p1", { game: "wordle", kind: "guess", payload: { guess: answer() } });
    const result = ended(sent);
    expect(result?.rewards.p2).toBe(0);
    expect(result?.scoreboard.find((r) => r.playerId === "p2")?.detail).toBe("forfeited");
  });

  it("re-sends the running game to a resuming socket", () => {
    const { lobby, sent } = setup("wordle");
    startRound(lobby);
    lobby.removePlayer("p2");
    sent.length = 0;
    lobby.resume("p2", "s9");
    expect(sent.some((s) => s.event === "minigame:start" && s.to.includes("s9"))).toBe(true);
    expect(gameEvents(sent).some((e) => e.to.includes("s9") && e.msg.kind === "init")).toBe(true);
  });
});

describe("Lobby with a real-time minigame (Pong, practice mode)", () => {
  it("ticks the shared loop, sends per-player state, and leaves no timers behind", () => {
    const { lobby, sent } = setup("pong");
    lobby.debugStart("p1", "pong");
    vi.advanceTimersByTime(COUNTDOWN);
    expect(lobby.phase).toBe("minigame");

    sent.length = 0;
    vi.advanceTimersByTime(100);
    const states = gameEvents(sent).filter((e) => e.msg.game === "pong" && e.msg.kind === "state");
    expect(new Set(states.map((e) => e.to[0]))).toEqual(new Set(["s1", "s2"]));

    lobby.handleInput("p1", { game: "pong", kind: "move", payload: { y: 0.2 } });
    lobby.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not move tokens in practice mode", () => {
    const { lobby, sent } = setup("wordle");
    lobby.debugStart("p1", "wordle");
    vi.advanceTimersByTime(COUNTDOWN);
    lobby.handleInput("p1", { game: "wordle", kind: "guess", payload: { guess: answer() } });
    lobby.handleInput("p2", { game: "wordle", kind: "guess", payload: { guess: answer() } });
    expect(ended(sent)?.rewards).toEqual({ p1: 3, p2: 2 });
    expect(lobby.toView().players.every((p) => p.position === 0)).toBe(true);
  });
});

describe("LobbyManager shutdown", () => {
  it("stops all lobby timers and refuses new lobbies", () => {
    const { io } = fakeIO();
    const manager = new LobbyManager(io);
    const { lobby } = manager.createLobby({ socketId: "s1", nickname: "Ana" });
    manager.joinLobby(lobby.id, { socketId: "s2", nickname: "Ben" });
    lobby.debugStart(lobby.toView().hostId, "pong");
    vi.advanceTimersByTime(COUNTDOWN);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    manager.close();
    expect(vi.getTimerCount()).toBe(0);
    expect(manager.size).toBe(0);
    expect(() => manager.createLobby({ socketId: "s3", nickname: "Cy" })).toThrow("restarting");
  });
});
