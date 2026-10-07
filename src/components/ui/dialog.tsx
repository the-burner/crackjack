// A centred modal card over a dimmed screen. Base UI's dialog handles focus,
// Escape and the screen reader; the look is the app's own.

import type { ComponentProps, ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  /** Escape (or Back) asks the modal to close. */
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={next => !next && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[3000] animate-fade-in bg-(--overlay)" />
        <AlertDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-[3000] max-w-[calc(100%-40px)] -translate-1/2 overflow-hidden rounded-[14px] bg-(--dialog-bg) text-center shadow-[0_10px_40px_var(--dialog-shadow)] outline-none',
            className,
          )}
        >
          {/* The pop-in, on an inner box so it does not fight the centring transform. */}
          <div className="animate-dialog-in">{children}</div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <AlertDialog.Title
      className={cn('m-0 px-4 pt-[18px] pb-0.5 text-title font-semibold text-(--text)', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <AlertDialog.Description
      render={<div />}
      className={cn('px-4 pt-1 pb-[18px] text-[14px] leading-[1.4] break-words text-(--dialog-text)', className)}
      {...props}
    />
  );
}

/** The row of buttons along the bottom, split by hairlines; the first is the bold one. */
export function DialogButtons({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex border-t border-(--dialog-divider)', className)} {...props} />;
}

export function DialogButton({ className, type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'h-[46px] flex-1 cursor-pointer border-0 border-l border-(--dialog-divider) bg-transparent text-title font-normal text-(--dialog-accent) first:border-l-0 first:font-semibold active:bg-(--separator)',
        className,
      )}
      {...props}
    />
  );
}

/** The text box of a prompt. */
export function DialogInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'mt-3 w-full rounded-(--radius-s) border border-(--dialog-input-border) bg-(--input-bg) px-2.5 py-2 text-[16px] text-(--dialog-input-text)',
        className,
      )}
      {...props}
    />
  );
}
