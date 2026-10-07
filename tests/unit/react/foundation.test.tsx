// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { reactScreen, useOnBack, useOnShow } from '../../../src/react/screen.tsx';
import { useSettings } from '../../../src/react/app-context.ts';
import { Select } from '../../../src/react/components.tsx';
import { SettingChecks, SettingSlider } from '../../../src/react/settings-form.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

describe('reactScreen', () => {
  it('renders before the factory returns, with the section class', () => {
    const screen = reactScreen(() => <p>hello</p>, { className: 'settings' })(makeApp(), {});
    expect(screen.el.tagName).toBe('SECTION');
    expect(screen.el.className).toBe('settings');
    expect(screen.el.textContent).toBe('hello');
  });

  it('passes the router lifecycle to the hooks', () => {
    const shown = vi.fn();
    let handleBack = false;
    function Screen() {
      useOnShow(shown);
      useOnBack(() => handleBack);
      return null;
    }
    const screen = reactScreen(Screen)(makeApp(), {});
    screen.onShow?.();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(screen.onBack?.()).toBe(false);
    handleBack = true;
    expect(screen.onBack?.()).toBe(true);
  });
});

describe('useSettings', () => {
  it('re-renders when a setting changes, json values included', () => {
    const app = makeApp();
    function Screen() {
      const settings = useSettings();
      return <p>{settings.get('table.decks')}</p>;
    }
    const screen = reactScreen(Screen)(app, {});
    act(() => app.settings.set('table.decks', 2));
    expect(screen.el.textContent).toBe('2');
  });
});

describe('controls', () => {
  it('a select shows no option for a value none of them has', () => {
    const options = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ];
    const screen = reactScreen(() => <Select options={options} value={3} onChange={() => {}} />)(makeApp(), {});
    expect(screen.el.querySelector('select')?.selectedIndex).toBe(-1);
  });

  it('setting checkboxes write the setting and show it', () => {
    const app = makeApp();
    const screen = reactScreen(() => <SettingChecks items={[{ label: 'Sound on', key: 'display.sound' }]} />)(app, {});
    const before = app.settings.get('display.sound');
    act(() => screen.el.querySelector('input')?.click());
    expect(app.settings.get('display.sound')).toBe(!before);
    expect(screen.el.querySelector('label')?.classList.contains('is-on')).toBe(!before);
  });

  it('a slider commits on change, clamped and stepped', () => {
    const app = makeApp();
    const screen = reactScreen(() => <SettingSlider label="Dealer Speed" setting="mechanics.dealerSpeed" />)(app, {});
    const box = screen.el.querySelector<HTMLInputElement>('input[type="number"]');
    if (!box) throw new Error('no box');
    act(() => {
      box.value = '1000';
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const { max } = app.settings.schema['mechanics.dealerSpeed'];
    expect(app.settings.get('mechanics.dealerSpeed')).toBe(max);
    expect(box.value).toBe(String(max));
  });
});
