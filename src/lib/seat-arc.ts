// Where each seat sits on a drawing of the table: along the arc below the dealer, seat 1 at the right as
// at the game's table, spread wider the more seats there are.

/** A seat's centre, as fractions of the drawing's width and height. */
export interface SeatPosition {
  seat: number;
  x: number;
  y: number;
}

/** The arc's centre (the dealer) and radii, as fractions of the drawing. */
const CENTRE = { x: 0.5, y: 0.08 };
const RADIUS = { x: 0.4, y: 0.7 };
/** The angle between neighbouring seats, and the widest the seats may spread. */
const STEP = Math.PI / 6;
const MAX_SPAN = Math.PI * 0.7;

export function seatPositions(seatCount: number): SeatPosition[] {
  const span = Math.min(MAX_SPAN, (seatCount - 1) * STEP);
  return Array.from({ length: seatCount }, (_, i) => {
    // Seat 1 at the right end (the smallest angle), the last at the left; one seat sits at the bottom.
    const angle = Math.PI / 2 - span / 2 + (seatCount > 1 ? (span * i) / (seatCount - 1) : 0);
    return { seat: i + 1, x: CENTRE.x + RADIUS.x * Math.cos(angle), y: CENTRE.y + RADIUS.y * Math.sin(angle) };
  });
}
