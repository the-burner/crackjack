// The table's pop-ups: below the table's title bar, so Back and Help stay clear.

import { toast } from '@/components/ui/toast';
import type { ToastTone } from '@/components/ui/toast';

export type TableToastTone = ToastTone;

/** Shows `text` in place of any pop-up already up; `onGone` runs once it has gone or been replaced. */
export function tableToast(
  text: string,
  { tone = 'plain', ms = 1800, onGone }: { tone?: TableToastTone; ms?: number; onGone?: () => void } = {},
): number {
  return toast(text, { position: 'top', tone, ms, onGone });
}
