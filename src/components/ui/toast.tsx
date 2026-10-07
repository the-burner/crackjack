// A short message that appears briefly at the bottom (or top) of the screen,
// without stopping anything: taps go straight through it. One at a time.

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

export type ToastTone = 'plain' | 'good' | 'error';

type Shown = {
  id: number;
  message: string;
  position: 'bottom' | 'top';
  tone: ToastTone;
  ms: number;
  onGone?: () => void;
};

const useToast = create<{ current: Shown | null }>(() => ({ current: null }));
let nextId = 1;

/** Shows `message` in place of any toast already up; `onGone` runs once it has gone or been replaced. */
export function toast(
  message: string,
  {
    position = 'bottom',
    tone = 'plain',
    ms = 1800,
    onGone,
  }: { position?: 'bottom' | 'top'; tone?: ToastTone; ms?: number; onGone?: () => void } = {},
): number {
  useToast.getState().current?.onGone?.();
  const id = nextId++;
  useToast.setState({ current: { id, message, position, tone, ms, onGone } });
  return id;
}

const LEAVE_MS = 200;

/** Where toasts show; mounted once above every screen. */
export function Toaster() {
  const current = useToast(state => state.current);
  return current ? <ToastView key={current.id} toast={current} /> : null;
}

function ToastView({ toast: shown }: { toast: Shown }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), shown.ms);
    const gone = setTimeout(() => {
      if (useToast.getState().current?.id !== shown.id) return;
      useToast.setState({ current: null });
      shown.onGone?.();
    }, shown.ms + LEAVE_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, [shown]);
  return (
    <div
      role="status"
      data-slot="toast"
      data-tone={shown.tone}
      data-position={shown.position}
      data-leaving={leaving || undefined}
      className={cn(
        'pointer-events-none fixed left-1/2 z-[4000] w-max max-w-[calc(100vw-40px)] -translate-x-1/2 rounded-full px-[18px] py-2.5 text-center text-[14px] font-medium shadow-[0_6px_24px_var(--dialog-shadow)] transition-opacity duration-200',
        shown.position === 'top'
          ? // Below the title bar, clear of the buttons a drill is answered with.
            'top-[calc(56px+var(--safe-top))] animate-toast-in-top'
          : 'bottom-[calc(24px+var(--safe-bottom))] animate-toast-in',
        shown.tone === 'good'
          ? 'bg-(--tile-good) text-(--tile-mark-text)'
          : shown.tone === 'error'
            ? 'bg-(--tile-bad) text-(--toast-error-text)'
            : 'bg-(--text) text-(--page-bg)',
        leaving && 'opacity-0',
      )}
    >
      {shown.message}
    </div>
  );
}
