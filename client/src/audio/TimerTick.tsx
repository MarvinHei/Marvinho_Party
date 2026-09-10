import { useEffect, useRef } from "react";
import { sfx } from "./audio.js";

/**
 * Plays a "tick" sound each time the whole-second value changes while `active`.
 * Renders nothing. Drop it into any timed screen and feed it the current
 * seconds-remaining value.
 */
export function TimerTick({ seconds, active }: { seconds: number; active: boolean }) {
  const last = useRef<number>(-1);
  useEffect(() => {
    if (!active) {
      last.current = -1;
      return;
    }
    if (seconds !== last.current) {
      last.current = seconds;
      sfx("tick");
    }
  }, [seconds, active]);
  return null;
}
