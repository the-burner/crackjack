// Where each seat sits on a drawing of the table: along the arc below the dealer, seat 1 at the right as
// at the game's table, spread wider the more seats there are. Seats move along the arc, by angle: new
// ones flow in from its top-left end and push the others along; removed ones flow back out there.

/** A point, as fractions of the drawing's width and height. */
export interface Point {
  x: number;
  y: number;
}

export interface SeatPosition extends Point {
  seat: number;
}

/** The arc's centre (the dealer) and radii, as fractions of the drawing. */
const CENTRE = { x: 0.5, y: 0.08 };
const RADIUS = { x: 0.4, y: 0.7 };
/** The angle between neighbouring seats, and the widest the seats may spread. */
const STEP = Math.PI / 6;
const MAX_SPAN = Math.PI * 0.7;
/** Where seats come in and go out: the arc's top-left end, beside the dealer. */
export const ENTRY_ANGLE = Math.PI;

/** Each seat's angle on the arc (0 is the right, π/2 the bottom), seat 1 first. */
export function seatAngles(seatCount: number): number[] {
  const span = Math.min(MAX_SPAN, (seatCount - 1) * STEP);
  return Array.from(
    { length: seatCount },
    (_, i) => Math.PI / 2 - span / 2 + (seatCount > 1 ? (span * i) / (seatCount - 1) : 0),
  );
}

export const pointAt = (angle: number): Point => ({
  x: CENTRE.x + RADIUS.x * Math.cos(angle),
  y: CENTRE.y + RADIUS.y * Math.sin(angle),
});

export function seatPositions(seatCount: number): SeatPosition[] {
  return seatAngles(seatCount).map((angle, i) => ({ seat: i + 1, ...pointAt(angle) }));
}

/** One seat in a frame of the animation. */
export interface ArcSeat {
  seat: number;
  angle: number;
  opacity: number;
}

/** How long one seat takes to move, and how far behind each other new or leaving seats start. */
export const MOVE_MS = 450;
export const STAGGER_MS = 70;

/** The seats at rest, `seatCount` of them. */
export const arcAtRest = (seatCount: number): ArcSeat[] =>
  seatAngles(seatCount).map((angle, i) => ({ seat: i + 1, angle, opacity: 1 }));

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The seats `elapsed` ms into moving from `from` (a frame, perhaps one caught mid-move) to `seatCount`
 * seats. Seats that stay slide to their places; new ones come in from the entry one after another, the
 * nearest seat 1 first; removed ones leave the same way, the nearest the entry first.
 */
export function arcFrame(
  from: readonly ArcSeat[],
  seatCount: number,
  elapsed: number,
): { seats: ArcSeat[]; done: boolean } {
  const target = seatAngles(seatCount);
  const was = new Map(from.map(seat => [seat.seat, seat]));
  const last = Math.max(seatCount, ...from.map(seat => seat.seat));
  const entering = Array.from({ length: last }, (_, i) => i + 1).filter(seat => seat <= seatCount && !was.has(seat));
  const leaving = from.filter(seat => seat.seat > seatCount).map(seat => seat.seat);
  let done = true;
  const seats: ArcSeat[] = [];
  for (let seat = 1; seat <= last; seat++) {
    const start = was.get(seat) ?? { seat, angle: ENTRY_ANGLE, opacity: 0 };
    const stays = seat <= seatCount;
    // Removing is arriving played backwards: the seats that stay move last, once the leaving ones clear them.
    const delay =
      (stays
        ? leaving.length
          ? leaving.length - 1
          : Math.max(0, entering.indexOf(seat))
        : Math.max(...leaving) - seat) * STAGGER_MS;
    const t = Math.min(1, Math.max(0, (elapsed - delay) / MOVE_MS));
    if (t < 1) done = false;
    if (!stays && t === 1) continue;
    const e = ease(t);
    const end = stays ? { angle: target[seat - 1], opacity: 1 } : { angle: ENTRY_ANGLE, opacity: 0 };
    if (t === 1) {
      seats.push({ seat, ...end });
      continue;
    }
    seats.push({
      seat,
      angle: start.angle + (end.angle - start.angle) * e,
      opacity: start.opacity + (end.opacity - start.opacity) * e,
    });
  }
  return { seats, done };
}
