// Wonging: sitting out the rounds a count says are not worth a bet.

/** The counts at which the player comes back in and sits out. */
export interface WongRule {
  wongIn: number;
  wongOut: number;
}

/** Whether the player should be playing at `count`, having been in (or out) the round before. */
export function wongedIn(wasIn: boolean, count: number, { wongIn, wongOut }: WongRule): boolean {
  return wasIn ? count > wongOut : count >= wongIn;
}

/** Whether a fresh shoe begins with the player in: unless told to begin it out, while Wong In is above 0. */
export function shoeStartsIn({ wongIn }: WongRule, startOut: boolean): boolean {
  return !(startOut && wongIn > 0);
}
