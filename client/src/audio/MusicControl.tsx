import { useSyncExternalStore } from "react";
import { audio } from "./audio.js";

/** Floating mute / music-volume control shown in a screen corner. */
export function MusicControl() {
  // Re-render whenever audio settings change.
  useSyncExternalStore(audio.subscribe, () => audio.muted);
  const muted = audio.muted;

  return (
    <div className="music-control" title="Background music">
      <button
        className={`music-btn${muted ? " muted" : ""}`}
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={() => audio.toggleMute()}
      >
        <span className="music-icon" aria-hidden>
          {muted ? "🔇" : "🎵"}
        </span>
        {!muted && (
          <span className="music-bars" aria-hidden>
            <i /><i /><i /><i />
          </span>
        )}
      </button>
      <input
        className="music-slider"
        type="range"
        min={0}
        max={100}
        value={Math.round(audio.musicVolume * 100)}
        disabled={muted}
        onChange={(e) => audio.setMusicVolume(Number(e.target.value) / 100)}
        aria-label="Music volume"
      />
    </div>
  );
}
