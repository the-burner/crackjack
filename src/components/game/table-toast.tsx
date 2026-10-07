// The table's pop-ups: one at a time, below the table's title bar so Back and
// Help stay clear, and letting taps through to the felt.

import { toast } from 'sonner';
import type { ExternalToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useSetting } from '@/react/app-context';

const TOASTER_ID = 'table';
const OFFSET = { top: 'calc(56px + var(--safe-top))' };

export type TableToastTone = 'plain' | 'good' | 'error';

let current: string | number | null = null;

/** Shows `text` in place of the table's pop-up, if one is up; `onGone` runs once it has gone or been replaced. */
export function tableToast(
  text: string,
  { tone = 'plain', ms = 1800, onGone }: { tone?: TableToastTone; ms?: number; onGone?: () => void } = {},
): string | number {
  if (current !== null) toast.dismiss(current);
  const options: ExternalToast = {
    toasterId: TOASTER_ID,
    duration: ms,
    onAutoClose: onGone,
    onDismiss: onGone,
    // Taps go straight through, as they do over the felt; the type is the app's.
    style: { pointerEvents: 'none', fontFamily: 'var(--font)' },
  };
  current =
    tone === 'good'
      ? toast.success(text, options)
      : tone === 'error'
        ? toast.error(text, options)
        : toast(text, options);
  return current;
}

/** Where the table's pop-ups show; mounted by the table screen. */
export function TableToaster() {
  const theme = useSetting('display.theme');
  return (
    <Toaster id={TOASTER_ID} dark={theme === 'mocha'} position="top-center" offset={OFFSET} mobileOffset={OFFSET} />
  );
}
