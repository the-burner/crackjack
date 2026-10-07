// Help text for a screen, in a sheet over it.

import { useMemo } from 'react';
import { HELP } from '@/data/help';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { closeHelp, useHelpStore } from '@/app/help';

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

/** The bundled help page for `topic`. */
export function HelpText({ topic }: { topic: string }) {
  const html = useMemo(() => withExternalLinks(HELP[topic] ?? '<p>No help is available for this screen.</p>'), [topic]);
  return (
    // The bundled text, styled by element.
    <div
      className="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The help sheet; open with openHelp(topic, title). */
export function HelpSheet() {
  const open = useHelpStore(state => state.open);
  return (
    <Sheet open={open !== null} onOpenChange={next => !next && closeHelp()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg" data-screen="help">
        <SheetHeader className="border-b">
          <SheetTitle>{open?.title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{open && <HelpText topic={open.topic} />}</div>
      </SheetContent>
    </Sheet>
  );
}
