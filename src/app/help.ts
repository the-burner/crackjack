// Help is a page over the current screen, opened as a history entry of its own
// (same URL, the topic in the entry's state), so Back or a swipe closes it.

import { useLocation, useNavigate } from 'react-router';

export type HelpPage = { topic: string; title: string };

/** The history state that opens help for `topic`. */
export const helpState = (topic: string, title = 'Help') => ({ help: { topic, title } });

const helpOf = (state: unknown): HelpPage | null =>
  typeof state === 'object' && state !== null && 'help' in state ? (state.help as HelpPage) : null;

/** The help page open over this screen, if any. */
export function useHelp(): HelpPage | null {
  return helpOf(useLocation().state);
}

/** Opens help for a topic over the current screen. */
export function useOpenHelp(): (topic: string, title?: string) => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return (topic, title) => void navigate({ pathname, search }, { state: helpState(topic, title) });
}

/** Closes the help page: back to the screen, or in place when the app was reloaded on it. */
export function useCloseHelp(): () => void {
  const navigate = useNavigate();
  const { pathname, search, key } = useLocation();
  return () => void (key === 'default' ? navigate({ pathname, search }, { replace: true }) : navigate(-1));
}
