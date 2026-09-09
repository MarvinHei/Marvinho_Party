import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BoardScene, type BoardPlayer } from "./BoardScene.js";

interface Props {
  boardLength: number;
  players: BoardPlayer[];
  meId: string | null;
}

export function PhaserBoard({ boardLength, players, meId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BoardScene | null>(null);

  // Create the game once.
  useEffect(() => {
    if (!hostRef.current) return;
    const scene = new BoardScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      backgroundColor: "#12102b",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene,
      render: { pixelArt: true, antialias: false },
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Push state on every change. `players` is re-created each render, so depend
  // on a stable signature instead to avoid redundant scene updates.
  const sig = players
    .map((p) => `${p.id}:${p.position}:${p.ready ? 1 : 0}:${p.color}`)
    .join("|");
  useEffect(() => {
    sceneRef.current?.setBoard({ boardLength, players, meId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardLength, meId, sig]);

  return <div className="board-host" ref={hostRef} />;
}
