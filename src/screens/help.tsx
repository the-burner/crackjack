// Help text for a screen, shown as a screen over it.

import { useEffect, useMemo } from 'react';
import { HELP } from '@/data/help';
import { TopBar } from '@/components/ui/top-bar';
import { useCloseHelp, useHelp } from '@/app/help';

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
    // The bundled text, styled by element as a browser would.
    <div
      className="text-body leading-normal [&_a]:text-(--help-link) [&_a]:underline [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-heading [&_h2]:leading-normal [&_h2]:[font-weight:revert] [&_h3]:mt-[18px] [&_h3]:mb-1.5 [&_h3]:text-title [&_h3]:leading-normal [&_h3]:[font-weight:revert] [&_li]:list-item [&_ol]:my-[1em] [&_ol]:list-decimal [&_ol]:pl-10 [&_p]:my-[1em] [&_ul]:my-[1em] [&_ul]:list-disc [&_ul]:pl-10"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The help page, when the history entry asks for one (useOpenHelp). Back, a swipe or Escape closes it. */
export function HelpSheet() {
  const open = useHelp();
  const closeHelp = useCloseHelp();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHelp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeHelp]);
  if (!open) return null;
  return (
    <section
      data-screen="help"
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-(--help-bg) pt-(--safe-top) pr-(--safe-right) pb-(--safe-bottom) pl-(--safe-left) text-(--text)"
    >
      <TopBar title={open.title} onBack={closeHelp} />
      <main className="flex-1 animate-fade-in overflow-y-auto overscroll-contain px-5 pt-1 pb-8">
        <HelpText topic={open.topic} />
      </main>
    </section>
  );
}
