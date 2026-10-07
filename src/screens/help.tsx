// Help text for a screen.

import { useMemo } from 'react';
import { reactScreen } from '@/react/screen';
import type { ScreenProps } from '@/react/screen';
import { HELP } from '@/data/help';
import { ScreenLayout } from '@/components/screen-layout';

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
  const html = useMemo(() => withExternalLinks(HELP[topic] ?? '<p>No help is available for this screen.</p>'), [topic]);
  return (
    <ScreenLayout title={title}>
      {/* The bundled text, styled by element. */}
      <div
        className="mx-auto max-w-2xl space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScreenLayout>
  );
}

export const helpScreen = reactScreen(Help);
