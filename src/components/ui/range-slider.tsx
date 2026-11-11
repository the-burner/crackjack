// A two-handled slider for a low and a high value that may meet but never cross, each also typed in its
// own box. The handles stop at `steps`; a typed value may be any whole number from the first step to the
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
  'pointer-events-none absolute inset-0 m-0 h-full w-full appearance-none bg-transparent outline-none ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--group-bg) [&::-webkit-slider-thumb]:bg-(--accent) ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--group-bg) [&::-moz-range-thumb]:bg-(--accent) ' +
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
  const percent = (index: number) => (index / (steps.length - 1)) * 100;

  /** Commits the dragged handle; the other keeps its value even if it lies between steps. */
  const commitDrag = (end: keyof Range) => {
    const next = { ...value, [end]: steps[drag[end]] };
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
        // The handles may meet but not cross.
        setDrag(end === 'low' ? { ...drag, low: Math.min(at, drag.high) } : { ...drag, high: Math.max(at, drag.low) });
      }}
      onPointerUp={() => commitDrag(end)}
      onKeyUp={() => commitDrag(end)}
      className={cn(
        THUMB,
        // Met at the top end, the low handle must be the one on top, or it could never be moved back down.
        end === 'low' && drag.low === drag.high && drag.low > (steps.length - 1) / 2 && 'z-10',
      )}
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
      <div className="relative h-7">
        <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-(--toggle-off)">
          <div
            className="absolute inset-y-0 rounded-full bg-(--accent)"
            style={{ left: `${percent(drag.low)}%`, right: `${100 - percent(drag.high)}%` }}
          />
        </div>
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
