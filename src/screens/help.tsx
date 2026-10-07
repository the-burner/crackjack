// Help text for a screen.

import { useMemo } from 'react';
import { useApp } from '../react/app-context.ts';
import { TopBar } from '../react/components.tsx';
import { reactScreen } from '../react/screen.tsx';
import type { ScreenProps } from '../react/screen.tsx';
import { HELP } from '../data/help.ts';

export type HelpParams = { topic: string; title?: string };

/** `html` with its links opening outside the app. */
function withExternalLinks(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('a[href]').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
  return template.innerHTML;
}

export function Help({ params: { topic, title = 'Help' } }: ScreenProps<HelpParams>) {
  const app = useApp();
  const html = useMemo(() => withExternalLinks(HELP[topic] ?? '<p>No help is available for this screen.</p>'), [topic]);
  // The body holds the bundled text, so it is laid out here rather than by StandardScreen.
  return (
    <>
      <TopBar title={title} onBack={() => app.back()} />
      <div className="screen__body" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

export const helpScreen = reactScreen(Help, { className: 'help' });
