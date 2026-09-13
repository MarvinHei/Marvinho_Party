import { useSyncExternalStore } from "react";
import { audio } from "./audio.js";

/** Floating mute + music/SFX volume control shown in a screen corner. */
export function MusicControl() {
  // Re-render whenever audio settings change (mute *or* either volume — the
  // volumes must be in the snapshot or a controlled slider snaps back stale).
  useSyncExternalStore(
    audio.subscribe,
    () => `${audio.muted}|${audio.musicVolume}|${audio.sfxVolume}`,
  );
  const muted = audio.muted;

  return (
    <div className="music-control" title="Audio">
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
      <div className="vol-stack">
        <label className="vol-row" title="Music volume">
          <span className="vol-ico" aria-hidden>🎵</span>
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
        </label>
        <label className="vol-row" title="Sound effects volume">
          <span className="vol-ico" aria-hidden>🔊</span>
          <input
            className="music-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(audio.sfxVolume * 100)}
            disabled={muted}
            onChange={(e) => audio.setSfxVolume(Number(e.target.value) / 100)}
            onPointerUp={() => audio.play("place")}
            onKeyUp={() => audio.play("place")}
            aria-label="SFX volume"
          />
        </label>
      </div>
    </div>
  );
}
