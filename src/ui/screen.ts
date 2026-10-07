// Standard screen layout: title bar plus a scrolling body.

import { h } from './dom.ts';
import { topBar } from './components.ts';
import type { Children } from './dom.ts';

/** What a standard screen needs of the app. */
export type ScreenApp = {
  back: () => void;
  help: (topic: string, title: string) => void;
};

export type StandardScreenOptions = {
  title: string;
  /** Help topic for the Help button. */
  help?: string;
  /** Default true. */
  back?: boolean;
  className?: string;
  end?: readonly Children[];
};

export function standardScreen(
  app: ScreenApp,
  { title, help, back = true, className = '', end = [] }: StandardScreenOptions,
): { el: HTMLElement; body: HTMLDivElement } {
  const body = h('div', { class: 'screen__body' });
  const el = h(
    'section',
    { class: className },
    topBar(title, {
      onBack: back ? () => app.back() : null,
      onHelp: help ? () => app.help(help, title || 'Crackjack') : null,
      end,
    }),
    body,
  );
  return { el, body };
}
