import { useEffect, useRef, useState } from "react";
import {
  HAIR_STYLES,
  MOUTH_STYLES,
  PLAYER_COLORS,
  type Appearance,
} from "@marvinho/shared";
import { drawToken } from "./pixelChar.js";
import { randomAppearance } from "../state/appearance.js";
import { sfx } from "../audio/audio.js";

const HAIR_NAMES = ["Bald", "Short", "Spiky", "Bowl", "Mohawk", "Afro", "Swoop"];
const MOUTH_NAMES = ["Neutral", "Smile", "Open", "Grin", "Small"];

/** Live character preview + look pickers (colour, hair, hair colour, mouth). */
export function CharacterCreator({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (a: Appearance) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawToken(ctx, c.width / 2, c.height / 2 - 3, 82, value.color, {
      hair: value.hair,
      hairColor: value.hairColor,
      mouth: value.mouth,
    });
  }, [value]);

  const set = (patch: Partial<Appearance>) => {
    sfx("click");
    onChange({ ...value, ...patch });
  };
  const cycle = (cur: number, n: number, dir: number) => (cur + dir + n) % n;

  return (
    <div className="charcreator">
      <div className="cc-head">
        <canvas ref={canvasRef} width={124} height={124} className="cc-preview" aria-label="Character preview" />
        <div className="cc-head-actions">
          <button
            type="button"
            className="cc-btn"
            onClick={() => { sfx("place"); onChange(randomAppearance()); }}
          >
            🎲 Randomize
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={() => { sfx("click"); setExpanded((v) => !v); }}
            aria-expanded={expanded}
          >
            {expanded ? "Done ▲" : "Customize ▾"}
          </button>
          {!expanded && <span className="cc-hint">Random look — customize if you like</span>}
        </div>
      </div>

      {expanded && (
      <div className="cc-controls">
        <div className="cc-row">
          <span className="cc-label">Colour</span>
          <div className="cc-swatches">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`cc-swatch${value.color === c ? " on" : ""}`}
                style={{ background: c }}
                onClick={() => set({ color: c })}
                aria-label={`Body colour ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="cc-row">
          <span className="cc-label">Hair</span>
          <div className="cc-cycler">
            <button type="button" onClick={() => set({ hair: cycle(value.hair, HAIR_STYLES, -1) })} aria-label="Previous hair">◀</button>
            <span className="cc-value">{HAIR_NAMES[value.hair] ?? `#${value.hair}`}</span>
            <button type="button" onClick={() => set({ hair: cycle(value.hair, HAIR_STYLES, 1) })} aria-label="Next hair">▶</button>
          </div>
        </div>

        <div className="cc-row">
          <span className="cc-label">Mouth</span>
          <div className="cc-cycler">
            <button type="button" onClick={() => set({ mouth: cycle(value.mouth, MOUTH_STYLES, -1) })} aria-label="Previous mouth">◀</button>
            <span className="cc-value">{MOUTH_NAMES[value.mouth] ?? `#${value.mouth}`}</span>
            <button type="button" onClick={() => set({ mouth: cycle(value.mouth, MOUTH_STYLES, 1) })} aria-label="Next mouth">▶</button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
