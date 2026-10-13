// A button showing a key; tapping it waits for the next key pressed, which becomes the new one.
// Escape (or a tap elsewhere) keeps the old. In a settings row it is the value cell at the row's end.

import { useEffect, useState } from 'react';
import { MODIFIER_KEYS, keyLabel, normalKey } from '@/core/keys';
import { Button } from './button';

export function KeyButton({
  value,
  onChange,
  label,
}: {
  /** A KeyboardEvent.key name. */
  value: string;
  onChange: (key: string) => void;
  /** The accessible name, before the key. */
  label: string;
}) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!listening) return;
    const down = (event: KeyboardEvent) => {
      if (MODIFIER_KEYS.has(event.key)) return;
      // The key is this button's: nothing else hears it.
      event.preventDefault();
      event.stopPropagation();
      setListening(false);
      if (event.key === 'Escape' || event.key === 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
      onChange(normalKey(event.key));
    };
    window.addEventListener('keydown', down, { capture: true });
    return () => window.removeEventListener('keydown', down, { capture: true });
  }, [listening, onChange]);
  return (
    <Button
      aria-label={`${label}: ${listening ? 'Press a key' : keyLabel(value)}`}
      aria-pressed={listening}
      className="min-w-16 text-body"
      onClick={() => setListening(on => !on)}
      onBlur={() => setListening(false)}
    >
      {listening ? 'Press…' : keyLabel(value)}
    </Button>
  );
}
