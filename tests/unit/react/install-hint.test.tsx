// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { homeScreen } from '../../../src/screens/home.tsx';
import { installHintWanted, INSTALL_HINT_KEY } from '../../../src/ui/install-hint.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

/** iOS Safari's navigator.standalone; undefined everywhere else. */
function setStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator, 'standalone', { value, configurable: true });
}

afterEach(() => setStandalone(undefined));

describe('the install hint', () => {
  it('is wanted only in iOS Safari, not installed and not dismissed', () => {
    expect(installHintWanted({ standalone: false }, false)).toBe(true);
    expect(installHintWanted({ standalone: true }, false)).toBe(false);
    expect(installHintWanted({ standalone: false }, true)).toBe(false);
    expect(installHintWanted({}, false)).toBe(false);
  });

  it('shows on the home screen until it is dismissed, for good', () => {
    setStandalone(false);
    const app = makeApp();
    const screen = homeScreen(app, {});
    expect(screen.el.querySelector('.install-hint')).not.toBeNull();
    act(() => screen.el.querySelector<HTMLButtonElement>('[data-action="dismiss-install"]')?.click());
    expect(screen.el.querySelector('.install-hint')).toBeNull();
    expect(app.storage.get(INSTALL_HINT_KEY)).toBe(true);
    expect(homeScreen(app, {}).el.querySelector('.install-hint')).toBeNull();
  });

  it('is not shown outside iOS Safari', () => {
    expect(homeScreen(makeApp(), {}).el.querySelector('.install-hint')).toBeNull();
  });
});
