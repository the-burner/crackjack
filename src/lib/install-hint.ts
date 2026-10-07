// iOS has no install prompt: Safari users have to be told about Add to Home Screen.

/** Safari on iOS and iPadOS says whether the page runs installed; other browsers don't. */
type IosNavigator = Navigator & { standalone?: boolean };

export const INSTALL_HINT_KEY = 'installHintDismissed';

/** Whether to suggest installing: in iOS Safari, not installed, and not dismissed before. */
export const installHintWanted = (nav: Pick<IosNavigator, 'standalone'> | undefined, dismissed: boolean): boolean =>
  nav?.standalone === false && !dismissed;

export const currentNavigator = (): IosNavigator | undefined => globalThis.navigator;
