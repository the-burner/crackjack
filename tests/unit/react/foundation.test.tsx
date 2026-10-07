import { describe, it, expect, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reactScreen, useOnBack, useOnShow } from '@/react/screen';
import { useSettings } from '@/react/app-context';
import { Select } from '@/react/components';
import { SettingChecks, SettingSlider } from '@/react/settings-form';
import { createTestApp, renderScreen } from '../../support/render';

describe('reactScreen', () => {
  it('renders before the factory returns, with the section class', () => {
    const { el } = reactScreen(() => <p>hello</p>, { className: 'settings' })(createTestApp(), {});
    expect(el.tagName).toBe('SECTION');
    expect(el).toHaveClass('settings', { exact: true });
    expect(el).toHaveTextContent(/^hello$/);
  });

  it('passes the router lifecycle to the hooks', () => {
    const shown = vi.fn();
    let handleBack = false;
    function Screen() {
      useOnShow(shown);
      useOnBack(() => handleBack);
      return null;
    }
    const factoryScreen = reactScreen(Screen)(createTestApp(), {});
    factoryScreen.onShow?.();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(factoryScreen.onBack?.()).toBe(false);
    handleBack = true;
    expect(factoryScreen.onBack?.()).toBe(true);
  });
});

describe('useSettings', () => {
  it('re-renders when a setting changes, json values included', () => {
    function Decks() {
      const settings = useSettings();
      return <p>{settings.get('table.decks')}</p>;
    }
    const { app } = renderScreen(<Decks />);
    act(() => app.settings.set('table.decks', 2));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('controls', () => {
  it('a select shows no option for a value none of them has', () => {
    const options = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ];
    renderScreen(<Select options={options} value={3} onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
  });

  it('setting checkboxes write the setting and show it', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<SettingChecks items={[{ label: 'Sound on', key: 'display.sound' }]} />);
    const box = screen.getByRole('checkbox', { name: 'Sound on' });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(app.settings.get('display.sound')).toBe(true);
    expect(box).toBeChecked();
    // eslint-disable-next-line testing-library/no-node-access -- the row's look comes from its class
    expect(box.closest('label')).toHaveClass('is-on');
  });

  it('a slider commits on change, clamped and stepped', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<SettingSlider label="Dealer Speed" setting="mechanics.dealerSpeed" />);
    const box = screen.getByRole('spinbutton', { name: 'Dealer Speed' });
    await user.clear(box);
    await user.type(box, '1000{Enter}');
    const { max } = app.settings.schema['mechanics.dealerSpeed'];
    expect(app.settings.get('mechanics.dealerSpeed')).toBe(max);
    expect(box).toHaveValue(max);
  });
});
