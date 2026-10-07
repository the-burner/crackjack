import { describe, it, expect, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from '@/screens/home';
import { installHintWanted } from '@/ui/install-hint';
import { renderScreen } from '../../support/render';

/** iOS Safari's navigator.standalone; undefined everywhere else. */
function setStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator, 'standalone', { value, configurable: true });
}

afterEach(() => setStandalone(undefined));

const hint = () => screen.queryByRole('note');

describe('the install hint', () => {
  it('is wanted only in iOS Safari, not installed and not dismissed', () => {
    expect(installHintWanted({ standalone: false }, false)).toBe(true);
    expect(installHintWanted({ standalone: true }, false)).toBe(false);
    expect(installHintWanted({ standalone: false }, true)).toBe(false);
    expect(installHintWanted({}, false)).toBe(false);
  });

  it('shows on the home screen until it is dismissed, for good', async () => {
    const user = userEvent.setup();
    setStandalone(false);
    const { app, unmount } = renderScreen(<Home />);
    expect(hint()).toHaveTextContent('To use Crackjack offline, install it');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(hint()).not.toBeInTheDocument();
    expect(app.installHintDismissed.getState().value).toBe(true);
    unmount();
    renderScreen(<Home />, { app });
    expect(hint()).not.toBeInTheDocument();
  });

  it('is not shown outside iOS Safari', () => {
    renderScreen(<Home />);
    expect(hint()).not.toBeInTheDocument();
  });
});
