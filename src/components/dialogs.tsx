// Message, confirmation and input dialogs, asked for with a promise from
// anywhere (alert(), confirm(), prompt(), promptNumber()) and shown by the
// <DialogHost /> mounted once at the root.

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { create } from 'zustand';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

const APP_TITLE = 'Crackjack';

type Request = {
  title: string;
  message: string;
  /** The confirming button, and the cancelling one when there is a choice. */
  ok: string;
  cancel?: string;
  input?: { value: string; type: string; inputMode?: 'numeric' | 'decimal' | 'text' };
  /** Called once: with the entered text (or true) on OK, null (or false) on cancel. */
  resolve: (result: string | boolean | null) => void;
};

const useDialogs = create<{ queue: Request[] }>(() => ({ queue: [] }));

function ask(request: Omit<Request, 'resolve'>): Promise<string | boolean | null> {
  return new Promise(resolve => {
    useDialogs.setState(state => ({ queue: [...state.queue, { ...request, resolve }] }));
  });
}

/** Shows a message with an OK button. */
export const alert = (message: string, { title = APP_TITLE }: { title?: string } = {}): Promise<true> =>
  ask({ title, message, ok: 'OK' }).then(() => true);

/** Asks a yes/no question; resolves to true for Yes. */
export const confirm = (
  message: string,
  { title = APP_TITLE, yes = 'Yes', no = 'No' }: { title?: string; yes?: string; no?: string } = {},
): Promise<boolean> => ask({ title, message, ok: yes, cancel: no }).then(result => result === true);

/** Asks for text; resolves to the entered string, or null when cancelled. */
export const prompt = (
  message: string,
  value = '',
  {
    title = APP_TITLE,
    type = 'text',
    inputMode,
  }: { title?: string; type?: string; inputMode?: 'numeric' | 'decimal' | 'text' } = {},
): Promise<string | null> =>
  ask({ title, message, ok: 'OK', cancel: 'Cancel', input: { value, type, inputMode } }).then(result =>
    typeof result === 'string' ? result : null,
  );

/** Asks for a whole number and clamps it to [min, max]; resolves to null when cancelled or invalid. */
export async function promptNumber(
  message: string,
  value: number,
  { min = -Infinity, max = Infinity, title }: { min?: number; max?: number; title?: string } = {},
): Promise<number | null> {
  const text = await prompt(message, String(value), { title, type: 'number', inputMode: 'numeric' });
  if (text === null || text.trim() === '') return null;
  const n = Math.round(Number(text));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Shows the dialogs asked for, one at a time. Leaving the screen (Back) cancels them. */
export function DialogHost() {
  const request = useDialogs(state => state.queue[0]);
  const { key } = useLocation();
  const shownAt = useRef(key);
  useEffect(() => {
    if (shownAt.current === key) return;
    shownAt.current = key;
    const { queue } = useDialogs.getState();
    useDialogs.setState({ queue: [] });
    for (const asked of queue) asked.resolve(asked.input ? null : false);
  }, [key]);
  return request ? <RequestDialog key={useDialogs.getState().queue.length} request={request} /> : null;
}

function RequestDialog({ request }: { request: Request }) {
  const [text, setText] = useState(request.input?.value ?? '');
  const closed = useRef(false);
  function close(ok: boolean) {
    if (closed.current) return;
    closed.current = true;
    useDialogs.setState(state => ({ queue: state.queue.slice(1) }));
    if (request.input) request.resolve(ok ? text : null);
    else request.resolve(ok);
  }
  return (
    <AlertDialog open onOpenChange={open => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{request.message}</AlertDialogDescription>
        </AlertDialogHeader>
        {request.input && (
          <Input
            autoFocus
            type={request.input.type}
            inputMode={request.input.inputMode}
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            onFocus={event => event.currentTarget.select()}
            onKeyDown={event => {
              if (event.key === 'Enter') close(true);
            }}
          />
        )}
        <AlertDialogFooter>
          {request.cancel && <AlertDialogCancel onClick={() => close(false)}>{request.cancel}</AlertDialogCancel>}
          <AlertDialogAction onClick={() => close(true)}>{request.ok}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
