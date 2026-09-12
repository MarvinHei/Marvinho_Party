import { useSyncExternalStore } from "react";
import { audio } from "./audio.js";

/** Floating mute / music-volume control shown in a screen corner. */
export function MusicControl() {
  // Re-render whenever audio settings change (mute *or* volume — the volume
  // must be in the snapshot or the controlled slider snaps back to a stale value).
  useSyncExternalStore(audio.subscribe, () => `${audio.muted}|${audio.musicVolume}`);
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
