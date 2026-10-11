// Guess the Country (shape-guessing race).

/** One guess in Guess the Country, with the distance/direction hint. */
export interface GuessCountryGuess {
  code: string;
  name: string;
  correct: boolean;
  /** Distance in km from the guessed country to the answer (0 when correct). */
  distanceKm: number;
  /** True compass bearing (0=N,90=E,…) from the guess toward the answer. */
  bearingDeg: number;
  /** Proximity 0..1 (1 = correct) for a warmth bar. */
  proximity: number;
}

/** Per-player public standing during a Guess the Country round. */
export interface GeoStanding {
  playerId: string;
  nickname: string;
  color: string;
  solved: boolean;
  tries: number;
  rank: number | null;
}

// ---------------------------------------------------------------------------
// Travle (connect two countries by naming the ones in between)
// ---------------------------------------------------------------------------

/** Per-player public standing during a Travle round. */
export interface TravleStanding {
  playerId: string;
  nickname: string;
  color: string;
  connected: boolean;
  /** How many countries the player has named so far. */
  count: number;
  rank: number | null;
}
