// A button showing a number; tapping it asks for a new one within [min, max].
// In a settings row it is the plain accent-coloured value at the row's end.

import { cn } from '@/lib/utils';
import { promptNumber } from '@/components/dialogs';
import { Button } from './button';

export function ValueButton({
  value,
  onChange,
  prompt = 'Value',
  min = -Infinity,
  max = Infinity,
  format = String,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  prompt?: string;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  /** The accessible name, before the value. */
  label?: string;
  className?: string;
}) {
  return (
    <Button
      aria-label={label ? `${label.replace(/:$/, '')}: ${format(value)}` : undefined}
      className={cn(
        'min-w-16 text-body tabular-nums',
        'in-data-[slot=settings-row]:my-2 in-data-[slot=settings-row]:min-h-7 in-data-[slot=settings-row]:flex-[0_0_96px] in-data-[slot=settings-row]:rounded-none',
        'in-data-[slot=settings-row]:border-l in-data-[slot=settings-row]:border-(--separator) in-data-[slot=settings-row]:bg-transparent in-data-[slot=settings-row]:px-3.5 in-data-[slot=settings-row]:py-0',
        'in-data-[slot=settings-row]:font-medium in-data-[slot=settings-row]:text-(--accent)',
        'in-data-[slot=settings-row]:active:scale-100 in-data-[slot=settings-row]:active:bg-transparent in-data-[slot=settings-row]:active:opacity-50',
        className,
      )}
      onClick={async () => {
        const n = await promptNumber(prompt, value, { min, max });
        if (n !== null) onChange(n);
      }}
    >
      {format(value)}
    </Button>
  );
}
