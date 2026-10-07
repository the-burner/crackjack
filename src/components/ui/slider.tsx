// A labelled range slider with a number box. The number can be typed as well
// as dragged; a typed value is rounded to the step and kept within [min, max].
// The value is committed when the drag ends or the box is left.

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(String(value));
  // A new value from outside (a reset, another control) replaces what is shown.
  const [prop, setProp] = useState(value);
  if (prop !== value) {
    setProp(value);
    setShown(String(value));
  }
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round((n - min) / step) * step + min));
  const commitTyped = () => {
    const typed = Number(shown);
    if (shown.trim() === '' || !Number.isFinite(typed)) setShown(String(value));
    else {
      setShown(String(clamp(typed)));
      onChange(clamp(typed));
    }
  };
  return (
    <div data-slot="slider" className={cn('flex flex-col gap-1.5', className)}>
      {label && <div className="text-body font-medium">{label}</div>}
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          aria-label={label || 'Value'}
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={event => setShown(event.currentTarget.value)}
          onBlur={commitTyped}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onFocus={event => event.currentTarget.select()}
          className={cn(
            'h-8 w-14 flex-[0_0_56px] appearance-none rounded-(--radius-s) border-0 bg-(--input-bg) px-1 text-center text-body font-semibold text-(--input-text) tabular-nums',
            'shadow-[inset_0_0_0_1px_var(--input-border)] focus:outline-2 focus:outline-offset-0 focus:outline-(--focus)',
            '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />
        <input
          type="range"
          aria-label={label || 'Value'}
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={event => setShown(event.currentTarget.value)}
          // Written once the drag ends (a key press or a tap ends at once).
          onPointerUp={event => onChange(Number(event.currentTarget.value))}
          onKeyUp={event => onChange(Number(event.currentTarget.value))}
          className="min-w-0 flex-1 accent-(--accent)"
        />
      </div>
    </div>
  );
}
