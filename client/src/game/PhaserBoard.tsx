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
    const host = hostRef.current;
    if (!host) return;
    const scene = new BoardScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: "#12102b",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene,
      render: { pixelArt: true, antialias: false },
    });
    gameRef.current = game;

    // Scale.RESIZE only tracks WINDOW resizes, so if the board mounts while its
    // flex parent is still 0-sized (a layout race), Phaser boots with a 0×0
    // drawing buffer — a black board + "Framebuffer Incomplete Attachment".
    // Observe the parent directly and push its real size into Phaser.
    const applySize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0 && (game.scale.width !== w || game.scale.height !== h)) {
        game.scale.resize(w, h);
      }
    };
    game.events.once("ready", applySize);
    const ro = new ResizeObserver(applySize);
    ro.observe(host);

    return () => {
      ro.disconnect();
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
