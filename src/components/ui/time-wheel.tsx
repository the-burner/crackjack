// Duration picker: hour / minute / second wheels in a centred sheet, like the
// iOS Timer. Cancel, Escape or a tap outside leave the value alone.

import { useLayoutEffect, useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { durationColumns, joinDuration, splitDuration } from '@/drills/shared/duration';
import type { DurationColumn } from '@/drills/shared/duration';
import { cn } from '@/lib/utils';

/** Row height; five rows show, the middle one is the value. */
const ITEM_HEIGHT = 36;

const ACTION =
  'min-h-10 cursor-pointer border-0 bg-transparent px-2 text-title font-normal text-(--dialog-accent) outline-none rounded-(--radius-s) engaged:bg-(--separator)';

export function DurationPicker({
  title,
  value,
  min = 0,
  max,
  columns = durationColumns(max),
  open,
  onClose,
}: {
  title: string;
  value: number;
  min?: number;
  max: number;
  columns?: readonly DurationColumn[];
  open: boolean;
  /** With the picked value, or null when cancelled. */
  onClose: (value: number | null) => void;
}) {
  const wheels = useRef<(HTMLDivElement | null)[]>([]);
  const start = splitDuration(Math.min(max, value), columns);
  const done = () => {
    const values = columns.map((c, i) => indexOf(wheels.current[i], c.count));
    onClose(joinDuration(values, columns, { min, max }));
  };
  return (
    <Dialog.Root open={open} onOpenChange={next => !next && onClose(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[3000] animate-fade-in bg-(--overlay) transition-opacity duration-180 data-ending-style:opacity-0" />
        <Dialog.Popup
          aria-label={title}
          // The first wheel, so the arrow keys turn it.
          initialFocus={() => wheels.current[0]}
          className="fixed top-1/2 left-1/2 z-[3000] w-[calc(100%-40px)] max-w-[360px] -translate-1/2 transition-opacity duration-180 outline-none data-ending-style:opacity-0"
          onKeyDown={event => {
            if (event.key === 'Enter') done();
          }}
        >
          <div className="animate-dialog-in overflow-hidden rounded-[14px] bg-(--dialog-bg) pb-2 shadow-[0_10px_40px_var(--dialog-shadow)]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-(--dialog-divider) px-2 py-1.5">
              <button
                type="button"
                className={`${ACTION} justify-self-start`}
                onClick={() => onClose(null)}
                data-action="cancel"
              >
                Cancel
              </button>
              <Dialog.Title className="m-0 text-title font-semibold text-(--text)">{title}</Dialog.Title>
              <button
                type="button"
                className={`${ACTION} justify-self-end font-semibold`}
                onClick={done}
                data-action="done"
              >
                Done
              </button>
            </div>
            <div className="relative flex px-4 py-3">
              {/* The band that marks the value. */}
              <div className="pointer-events-none absolute top-[calc(12px+72px)] right-4 left-4 h-9 rounded-(--radius-s) bg-(--separator)" />
              {columns.map((column, i) => (
                <Wheel
                  key={column.label}
                  column={column}
                  start={start[i]}
                  // Side by side in the middle: the outer wheels' numbers sit at their inner edges.
                  align={
                    columns.length === 1 ? 'center' : i === 0 ? 'end' : i === columns.length - 1 ? 'start' : 'center'
                  }
                  wheelRef={el => {
                    wheels.current[i] = el;
                  }}
                />
              ))}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The number in a wheel's band. */
const indexOf = (el: HTMLDivElement | null, count: number) =>
  el ? Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT))) : 0;

/** Tilts a wheel's rows away from the band, like a drum, and reports the value in the band. */
function curveWheel(wheel: HTMLDivElement, count: number) {
  const centre = wheel.scrollTop / ITEM_HEIGHT;
  wheel.querySelectorAll<HTMLElement>('[data-item]').forEach((item, n) => {
    const offset = Math.max(-3, Math.min(3, n - centre));
    item.style.transform = `rotateX(${offset * -20}deg)`;
    item.style.opacity = String(1 - Math.min(1, Math.abs(offset) * 0.28));
  });
  wheel.setAttribute('aria-valuenow', String(indexOf(wheel, count)));
}

/** One scrolling wheel. */
/** Where in its share of the sheet a wheel's numbers and unit sit, 4px clear of a neighbour. */
const ALIGN = { start: 'justify-start pl-1', center: 'justify-center', end: 'justify-end pr-1' } as const;

function Wheel({
  column: { label, unit, count },
  start,
  align,
  wheelRef,
}: {
  column: DurationColumn;
  start: number;
  align: keyof typeof ALIGN;
  wheelRef: (el: HTMLDivElement | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const curve = () => el.current && curveWheel(el.current, count);
  const scrollTo = (n: number, behavior: 'smooth' | 'instant' = 'smooth') => {
    const wheel = el.current;
    if (!wheel) return;
    if (behavior === 'instant') wheel.scrollTop = n * ITEM_HEIGHT;
    else wheel.scrollTo({ top: n * ITEM_HEIGHT, behavior });
  };

  // Placed when the sheet opens.
  useLayoutEffect(() => {
    const wheel = el.current;
    if (!wheel) return;
    wheel.scrollTop = start * ITEM_HEIGHT;
    curveWheel(wheel, count);
    return () => cancelAnimationFrame(frame.current);
  }, [start, count]);

  return (
    // The wheel turns from anywhere in its share of the sheet, not only on its numbers.
    <div className="relative flex flex-1 items-center">
      <div
        ref={node => {
          el.current = node;
          wheelRef(node);
        }}
        tabIndex={0}
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={start}
        className="h-[180px] w-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] outline-none [mask-image:linear-gradient(transparent,#000_30%,#000_70%,transparent)] [perspective:600px] focus-visible:rounded-(--radius-s) focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(curve);
        }}
        onKeyDown={event => {
          const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
          if (!step) return;
          event.preventDefault();
          scrollTo(Math.min(count - 1, Math.max(0, indexOf(el.current, count) + step)), 'instant');
          curve();
        }}
      >
        <div className="py-[72px]">
          {Array.from({ length: count }, (_, n) => (
            <div
              key={n}
              data-item
              // Tapping a row picks it.
              onClick={() => scrollTo(n)}
              className={cn(
                'flex h-9 cursor-pointer snap-center text-[22px] leading-9 text-(--text) tabular-nums select-none',
                ALIGN[align],
              )}
            >
              <span className="w-16 pr-1.5 text-right">{n}</span>
              {/* Room for the unit. */}
              <span className="w-9" />
            </div>
          ))}
        </div>
      </div>
      {/* Laid out as a row is, the unit where the row leaves room for it. */}
      <div className={cn('pointer-events-none absolute inset-x-0 flex', ALIGN[align])}>
        <span className="w-16" />
        <span className="w-9 text-body font-semibold text-(--text)">{unit}</span>
      </div>
    </div>
  );
}
