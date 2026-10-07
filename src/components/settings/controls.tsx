// Rows for the settings and strategy screens: switches and number buttons
// that write through their own callbacks.

import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { promptNumber } from '@/components/dialogs';
import { SettingRow } from '@/components/settings-controls';

/** A labelled switch, with any extra control after it. */
export function SwitchRow({
  label,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <SettingRow label={label} htmlFor={id}>
      {/* Named directly: Base UI names its switch from the label only once it is in the document. */}
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={on => onCheckedChange(on)} />
      {children}
    </SettingRow>
  );
}

/** A button showing a number; tapping it asks for a new one within [min, max]. */
export function NumberButton({
  label,
  value,
  onChange,
  prompt,
  min = -Infinity,
  max = Infinity,
}: {
  /** The accessible name, before the value. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  prompt: string;
  min?: number;
  max?: number;
}) {
  return (
    <Button
      variant="outline"
      className="min-w-16 tabular-nums"
      aria-label={`${label}: ${value}`}
      onClick={async () => {
        const n = await promptNumber(prompt, value, { min, max });
        if (n !== null) onChange(n);
      }}
    >
      {String(value)}
    </Button>
  );
}

/** A label and a NumberButton. */
export function NumberRow({ hidden, ...props }: Parameters<typeof NumberButton>[0] & { hidden?: boolean }) {
  return (
    <SettingRow label={props.label} hidden={hidden}>
      <NumberButton {...props} />
    </SettingRow>
  );
}
