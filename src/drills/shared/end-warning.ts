// The "cards left" warning the Count and Full table drills give near the end
// of the shoe.

export type EndWarning = 'none' | 'oneCardLeft' | 'twoCardsLeft';

/** How long the deal waits after the warning. */
export const END_WARNING_SECONDS = 3;
export const WARNING_TEXT: Readonly<Partial<Record<EndWarning, string>>> = {
  oneCardLeft: 'One card left',
  twoCardsLeft: 'Two cards left',
};
/** Cards left in the shoe when the warning shows. */
export const WARNING_REMAINING: Readonly<Partial<Record<EndWarning, number>>> = { oneCardLeft: 1, twoCardsLeft: 2 };
