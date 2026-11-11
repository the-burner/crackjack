// A two-handled slider for a low and a high value that may meet but never cross (pushed into each other,
// the handles move together), each also typed in its own box. The handles stop at `steps`; a typed value may be any whole number from the first step to the
// last, and one that would cross the other value, or fall outside them, is refused and the box put back.
// Values are committed when a drag ends or a box is left.

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from './toast';

export interface Range {
  low: number;
  high: number;
}

/** The step nearest `value`. */
const nearest = (steps: readonly number[], value: number) =>
  steps.reduce((best, step, i) => (Math.abs(step - value) < Math.abs(steps[best] - value) ? i : best), 0);

const THUMB =
  'pointer-events-none absolute inset-y-0 m-0 h-full w-[calc(100%-var(--thumb))] appearance-none bg-transparent outline-none ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-(--thumb) [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--group-bg) [&::-webkit-slider-thumb]:bg-(--accent) ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-(--thumb) [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--group-bg) [&::-moz-range-thumb]:bg-(--accent) ' +
  'focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-(--focus)';

const BOX = cn(
  'h-8 w-24 appearance-none rounded-(--radius-s) border-0 bg-(--input-bg) px-1 text-center text-body font-semibold text-(--input-text) tabular-nums',
  'shadow-[inset_0_0_0_1px_var(--input-border)] focus:outline-2 focus:outline-offset-0 focus:outline-(--focus)',
  '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
);

export function RangeSlider({
  label,
  lowLabel,
  highLabel,
  value,
  steps,
  format,
  onChange,
}: {
  label: string;
  /** Names of the low and high handles, and of their boxes. */
  lowLabel: string;
  highLabel: string;
  value: Range;
  /** Where the handles stop, smallest first. */
  steps: readonly number[];
  /** How a value is read out ("$25"). */
  format: (value: number) => string;
  onChange: (value: Range) => void;
}) {
  // Handle positions (step indexes) while dragging, and the boxes' text while typing.
  const [drag, setDrag] = useState({ low: nearest(steps, value.low), high: nearest(steps, value.high) });
  const [typed, setTyped] = useState({ low: String(value.low), high: String(value.high) });
  // A new value from outside (a configuration loaded, say) replaces what is shown.
  const [prop, setProp] = useState(value);
  if (prop.low !== value.low || prop.high !== value.high) {
    setProp(value);
    setDrag({ low: nearest(steps, value.low), high: nearest(steps, value.high) });
    setTyped({ low: String(value.low), high: String(value.high) });
  }
  const first = steps[0];
  const last = steps[steps.length - 1];
  /** Where a value's mark sits on the track: a handle's width in, then along the rest less another. */
  const mark = (index: number) => `calc(var(--thumb) + ${index / (steps.length - 1)} * (100% - 2 * var(--thumb)))`;

  /** Commits where the handles were let go; one that did not move keeps its value even if it lies between steps. */
  const commitDrag = () => {
    const at = (end: keyof Range) => (drag[end] === nearest(steps, value[end]) ? value[end] : steps[drag[end]]);
    const next = { low: at('low'), high: at('high') };
    if (next.low !== value.low || next.high !== value.high) onChange(next);
  };

  const commitTyped = (end: keyof Range) => {
    const text = typed[end].trim();
    const amount = Number(text);
    const refuse = (message: string) => {
      setTyped({ ...typed, [end]: String(value[end]) });
      toast(message, { tone: 'error' });
    };
    if (text === String(value[end])) return;
    if (text === '' || !Number.isInteger(amount) || amount < first || amount > last)
      return refuse(`Enter a whole amount from ${format(first)} to ${format(last)}.`);
    if (end === 'low' && amount > value.high)
      return refuse(
        `The ${lowLabel.toLowerCase()} can't be above the ${highLabel.toLowerCase()} (${format(value.high)}).`,
      );
    if (end === 'high' && amount < value.low)
      return refuse(
        `The ${highLabel.toLowerCase()} can't be below the ${lowLabel.toLowerCase()} (${format(value.low)}).`,
      );
    onChange({ ...value, [end]: amount });
  };

  const handle = (end: keyof Range, name: string) => (
    <input
      type="range"
      aria-label={name}
      aria-valuetext={format(end === 'low' ? steps[drag.low] : steps[drag.high])}
      min={0}
      max={steps.length - 1}
      step={1}
      value={drag[end]}
      onChange={event => {
        const at = Number(event.currentTarget.value);
        // A handle pushed into the other pushes it along; the boxes follow the handles as they move.
        const next =
          end === 'low' ? { low: at, high: Math.max(at, drag.high) } : { low: Math.min(at, drag.low), high: at };
        setDrag(next);
        setTyped({
          low: next.low === drag.low ? typed.low : String(steps[next.low]),
          high: next.high === drag.high ? typed.high : String(steps[next.high]),
        });
      }}
      onPointerUp={commitDrag}
      onKeyUp={commitDrag}
      // Each handle has its own lane, a handle's width apart: the low one's right edge and the high one's
      // left edge mark their values, so at the same value they touch side by side and never overlap.
      className={cn(THUMB, end === 'low' ? 'left-0' : 'left-(--thumb)')}
    />
  );

  const id = useId();
  const box = (end: keyof Range, name: string) => (
    <>
      <label htmlFor={`${id}-${end}`} className="text-body text-(--text)">
        {name}
      </label>
      <input
        id={`${id}-${end}`}
        type="number"
        inputMode="numeric"
        aria-label={name}
        min={first}
        max={last}
        step={1}
        value={typed[end]}
        onChange={event => setTyped({ ...typed, [end]: event.currentTarget.value })}
        onBlur={() => commitTyped(end)}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onFocus={event => event.currentTarget.select()}
        className={BOX}
      />
    </>
  );

  return (
    <div data-slot="slider" role="group" aria-label={label} className="flex flex-col gap-2.5">
      <div className="text-body font-medium">{label}</div>
      <div className="relative h-7 [--thumb:24px]">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-(--toggle-off)" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-(--accent)"
          style={{ left: mark(drag.low), right: `calc(100% - ${mark(drag.high)})` }}
        />
        {handle('low', lowLabel)}
        {handle('high', highLabel)}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
        {box('low', lowLabel)}
        {box('high', highLabel)}
      </div>
    </div>
  );
}
