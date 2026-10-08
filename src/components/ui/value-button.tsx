// A button showing a number; tapping it asks for a new one within [min, max].
// In a settings row it is the value cell at the row's end (SettingsRow).

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
      className={cn('min-w-16 text-body tabular-nums', className)}
      onClick={async () => {
        const n = await promptNumber(prompt, value, { min, max });
        if (n !== null) onChange(n);
      }}
    >
      {format(value)}
    </Button>
  );
}
