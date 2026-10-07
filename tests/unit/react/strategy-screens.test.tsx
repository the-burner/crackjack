// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { bettingScreen, betSelectScreen } from '../../../src/screens/strategy/betting.tsx';
import { strategyTablesScreen } from '../../../src/screens/strategy/tables.tsx';
import { trueCountScreen } from '../../../src/screens/strategy/true-count.tsx';
import { playingStrategyScreen } from '../../../src/screens/strategy/playing-strategy.tsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

const $ = (el: HTMLElement, selector: string) => {
  const found = el.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`no ${selector}`);
  return found;
};

const chooseOption = (el: HTMLElement, index: number, label: string) =>
  act(() => {
    const select = el.querySelectorAll<HTMLSelectElement>('select')[index];
    select.selectedIndex = [...select.options].findIndex(o => o.text === label);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

describe('Allowed Bets', () => {
  it('shows counts and the minimum count row only when betting errors are flagged', () => {
    const app = makeApp();
    const { el } = bettingScreen(app, {});
    expect($(el, '.bet-table tbody td').textContent).toBe('<=0');
    expect(el.querySelectorAll('.tc-row')[2].hidden).toBe(false);
    act(() => $(el, 'input[type="checkbox"]').click());
    expect(app.settings.get('betting.warnOnError')).toBe(false);
    expect($(el, '.bet-table tbody td').textContent).toBe('-');
    expect(el.querySelectorAll('.tc-row')[2].hidden).toBe(true);
  });

  it('follows ramp changes and opens the picker for a row', () => {
    const app = makeApp();
    const { el } = bettingScreen(app, {});
    expect(el.querySelectorAll('.bet-table tbody tr')).toHaveLength(6);
    act(() => app.settings.set('betting.ramp', { minCount: 0, rows: [{ chips: 3, hands: 2 }] }));
    expect(el.querySelectorAll('.bet-table tbody tr')).toHaveLength(1);
    expect(el.querySelectorAll('.bet-table tbody td')[1].textContent).toBe('2x3');
    act(() => $(el, '.bet-table tbody tr').click());
    expect(app.open).toHaveBeenCalledWith('settings.betting.select', { row: 0 });
  });

  it('writes the chip value', () => {
    const app = makeApp();
    const { el } = bettingScreen(app, {});
    chooseOption(el, 0, '$100');
    expect(app.settings.get('betting.chipValue')).toBe(100);
  });
});

describe('bet picker', () => {
  it('limits chips to the hands chosen and writes the row', () => {
    const app = makeApp();
    const { el } = betSelectScreen(app, { row: 1 });
    expect($(el, '[data-hands="1"]').classList.contains('is-on')).toBe(true);
    act(() => $(el, '[data-hands="3"]').click());
    expect($(el, '[data-hands="3"]').classList.contains('is-on')).toBe(true);
    expect($(el, '[data-hands="1"]').classList.contains('is-on')).toBe(false);
    expect(($(el, '[data-chips="200"]') as HTMLButtonElement).disabled).toBe(true);
    expect(($(el, '[data-chips="25"]') as HTMLButtonElement).disabled).toBe(false);
    act(() => $(el, '[data-chips="25"]').click());
    expect(app.settings.get('betting.ramp').rows[1]).toEqual({ chips: 25, hands: 3 });
    expect(app.back).toHaveBeenCalled();
  });
});

describe('strategy tables', () => {
  it('toggles mask cells and counts them', () => {
    const app = makeApp();
    const { el } = strategyTablesScreen(app, { mode: 'editMask', maskKey: 'strategy.customIndexMask' });
    expect($(el, '.tables__hint').textContent).toBe('0 of 80 cells selected');
    expect($(el, '.tables__grid').classList.contains('tables__grid--editable')).toBe(true);
    act(() => $(el, 'td[data-row="1"][data-col="8"]').click());
    expect($(el, '.tables__hint').textContent).toBe('1 of 80 cells selected');
    expect(app.settings.get('strategy.customIndexMask').hardStand[1][8]).toBe(true);
    act(() => $(el, 'td[data-row="1"][data-col="8"]').click());
    expect(app.settings.get('strategy.customIndexMask').hardStand[1][8]).toBe(false);
  });

  it('ignores taps outside mask editing', () => {
    const app = makeApp();
    const { el } = strategyTablesScreen(app, {});
    const before = app.settings.get('strategy.customIndexMask');
    act(() => $(el, 'td[data-row="1"][data-col="8"]').click());
    expect(app.settings.get('strategy.customIndexMask')).toEqual(before);
    expect($(el, '.tables__hint').textContent).toBe('');
  });

  it('opens a named view with a marked cell', () => {
    const app = makeApp();
    const { el } = strategyTablesScreen(app, { view: 'split', highlight: { row: 2, column: 3 }, title: 'Last Error' });
    expect($(el, '.topbar__title').textContent).toBe('Last Error');
    expect(el.querySelectorAll('.tables__grid tbody tr')).toHaveLength(10);
    const marked = el.querySelectorAll('.grid__cell--marked');
    expect(marked).toHaveLength(1);
    expect(el.querySelectorAll('.tables__grid tbody tr')[2].querySelectorAll('td')[4]).toBe(marked[0]);
    expect([...el.querySelectorAll('.tables__legend-box')].map(b => b.textContent)).toEqual([
      'Split',
      'No Split',
      'Split >= Value',
      'Split < Value',
    ]);
  });

  it('shades error counts and hides the legend', () => {
    const app = makeApp();
    app.errorTallies.record('hardStand', 1, 8);
    const { el } = strategyTablesScreen(app, {});
    act(() => $(el, '.checklist input').click());
    expect($(el, 'td[data-row="1"][data-col="8"]').textContent).toBe('1');
    expect($(el, 'td[data-row="1"][data-col="7"]').textContent).toBe('');
    expect($(el, '.tables__legend').hidden).toBe(true);
  });

  it('switches to the counts view', () => {
    const app = makeApp();
    const { el } = strategyTablesScreen(app, {});
    chooseOption(el, 0, 'Insurance/Counts');
    expect($(el, '.tables__counts').textContent).toContain('Card Point Values');
    expect($(el, '.tables__below').hidden).toBe(true);
    expect(el.querySelector('.tables__grid')).toBeNull();
  });
});

describe('TC Calcs', () => {
  it('writes the selects and side counts', () => {
    const app = makeApp();
    const { el } = trueCountScreen(app, {});
    chooseOption(el, 0, 'Quarter Deck');
    chooseOption(el, 3, 'Cards dealt');
    act(() => el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click());
    expect(app.settings.get('trueCount.resolution')).toBe('quarter');
    expect(app.settings.get('trueCount.remainingCards')).toBe('dealt');
    expect(app.settings.get('trueCount.tenSideCount')).toBe(true);
  });
});

describe('Playing Strategy', () => {
  it('writes rules through their constraints and shows changes made elsewhere', () => {
    const app = makeApp();
    app.settings.set('rules.dealerPeeksAce', true);
    const { el } = playingStrategyScreen(app, {});
    const noHoleCard = [...el.querySelectorAll('label')].find(l => l.textContent === 'No hole card');
    act(() => noHoleCard?.querySelector('input')?.click());
    expect(app.settings.get('rules.noHoleCard')).toBe(true);
    expect(app.settings.get('rules.dealerPeeksAce')).toBe(false);
    act(() => app.settings.set('strategy.indexRangeMin', -4));
    expect(el.querySelectorAll('.value-btn')[0].textContent).toBe('-4');
  });
});
