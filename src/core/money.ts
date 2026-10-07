// Dollar amounts as the app shows them.

/** Whole dollars without cents, otherwise to the cent: "$1,234", "$12.50". */
export const money = (amount: number): string =>
  `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/** Always to the cent, as the bankroll is shown: "$1,234.00". */
export const dollars = (amount: number): string =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
