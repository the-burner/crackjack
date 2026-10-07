// Duration picker: a dialog with a number box per unit (hours, minutes,
// seconds, or seconds and tenths), kept within the setting's range.

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerOverlay } from '@/ui/overlays';
import { durationColumns, joinDuration, splitDuration } from '@/ui/time-wheel';
import type { DurationColumn } from '@/ui/time-wheel';

export function DurationDialog({
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
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose(null)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        {open && <DurationForm title={title} value={value} min={min} max={max} columns={columns} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DurationForm({
  title,
  value,
  min,
  max,
  columns,
  onClose,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  columns: readonly DurationColumn[];
  onClose: (value: number | null) => void;
}) {
  const id = useId();
  const [fields, setFields] = useState(() => splitDuration(Math.min(max, value), columns).map(String));
  const cancel = useRef(() => onClose(null));
  useEffect(() => {
    cancel.current = () => onClose(null);
  });
  // A back request cancels, as with the other dialogs.
  useEffect(() => registerOverlay(() => cancel.current()), []);
  const done = () => {
    const values = fields.map((text, i) => {
      const n = Math.round(Number(text));
      return Number.isFinite(n) ? Math.min(columns[i].count - 1, Math.max(0, n)) : 0;
    });
    onClose(joinDuration(values, columns, { min, max }));
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={event => {
        event.preventDefault();
        done();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex justify-center gap-3">
        {columns.map((column, i) => (
          <div key={column.label} className="grid w-20 gap-1.5">
            <Label htmlFor={`${id}-${i}`} className="justify-center text-muted-foreground">
              {column.label}
            </Label>
            <Input
              id={`${id}-${i}`}
              type="number"
              inputMode="numeric"
              autoFocus={i === 0}
              className="h-12 text-center text-lg tabular-nums"
              min={0}
              max={column.count - 1}
              value={fields[i]}
              onChange={event => {
                const text = event.currentTarget.value;
                setFields(current => current.map((f, j) => (j === i ? text : f)));
              }}
              onFocus={event => event.currentTarget.select()}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onClose(null)} data-action="cancel">
          Cancel
        </Button>
        <Button type="submit" data-action="done">
          Done
        </Button>
      </DialogFooter>
    </form>
  );
}
