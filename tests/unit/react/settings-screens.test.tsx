// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App, Screen } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { setupScreen } from '../../../src/screens/settings/setup.tsx';
import { commonRulesScreen } from '../../../src/screens/settings/common-rules.tsx';
import { playVariationsScreen } from '../../../src/screens/settings/play-variations.tsx';
import { bonusesScreen } from '../../../src/screens/settings/bonuses.tsx';
import { unusualGamesScreen } from '../../../src/screens/settings/unusual-games.tsx';
import { settingsHubScreen } from '../../../src/screens/settings/hub.tsx';
import { homeScreen } from '../../../src/screens/home.tsx';
import { helpScreen } from '../../../src/screens/help.tsx';

vi.mock('../../../src/ui/dialogs.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../src/ui/dialogs.ts')>()),
  confirm: vi.fn(async () => true),
}));

vi.mock('../../../src/data/help.ts', async importOriginal => {
  const { HELP } = await importOriginal<typeof import('../../../src/data/help.ts')>();
  return { HELP: { ...HELP, 'test.links': '<p><a href="https://example.com">site</a></p>' } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

const checkbox = (screen: Screen, label: string) => {
  const row = [...screen.el.querySelectorAll('label.check')].find(l => l.textContent === label);
  const input = row?.querySelector('input');
  if (!row || !input) throw new Error(`no checkbox ${label}`);
  return { row, input };
};

const selectFor = (screen: Screen, name: string) => {
  const el = screen.el.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!el) throw new Error(`no select ${name}`);
  return el;
};

function choose(select: HTMLSelectElement, label: string) {
  act(() => {
    select.selectedIndex = [...select.options].findIndex(o => o.text === label);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const buttonNamed = (root: ParentNode, text: string) => {
  const button = [...root.querySelectorAll('button')].find(b => b.textContent === text);
  if (!button) throw new Error(`no button ${text}`);
  return button;
};

const rowFor = (screen: Screen, label: string) =>
  [...screen.el.querySelectorAll<HTMLElement>('.settings-row')].find(
    row => row.querySelector('.label')?.textContent === label,
  );

describe('Basic Setup', () => {
  it('fewer decks pull the cut card back inside the shoe', () => {
    const app = makeApp();
    app.settings.set('table.cardsBehindCutCard', 300);
    const screen = setupScreen(app, {});
    choose(selectFor(screen, 'table.decks'), 'Double Deck');
    expect(app.settings.get('table.decks')).toBe(2);
    expect(app.settings.get('table.cardsBehindCutCard')).toBe(103);
    expect(rowFor(screen, 'Shuffle Point/Cards:')?.querySelector('.value-btn')?.textContent).toBe('103');
  });

  it('shows the cut card row or the rounds row by shuffle mode', () => {
    const app = makeApp();
    const screen = setupScreen(app, {});
    expect(rowFor(screen, 'Shuffle Point/Cards:')?.hidden).toBe(false);
    expect(rowFor(screen, 'Rounds:')?.hidden).toBe(true);
    choose(selectFor(screen, 'table.shuffleMode'), 'Shuffle after Fixed Rounds');
    expect(rowFor(screen, 'Shuffle Point/Cards:')?.hidden).toBe(true);
    expect(rowFor(screen, 'Rounds:')?.hidden).toBe(false);
  });

  it('seats run 6..1 and toggle computer players', () => {
    const app = makeApp();
    const screen = setupScreen(app, {});
    const labels = [...screen.el.querySelectorAll('.checklist--horizontal .check')].map(l => l.textContent);
    expect(labels).toEqual(['#6', '#5', '#4', '#3', '#2', '#1']);
    act(() => checkbox(screen, '#3').input.click());
    expect(app.settings.get('table.computerSeats')).toEqual([true, false, true, false, false, false]);
    expect(checkbox(screen, '#3').row.classList.contains('is-on')).toBe(true);
  });

  it('Refresh Bankroll stores the starting bankroll', () => {
    const app = makeApp();
    app.settings.set('table.startingBankroll', 500);
    const screen = setupScreen(app, {});
    act(() => buttonNamed(screen.el, 'Refresh Bankroll').click());
    expect(app.storage.get('bankroll')).toBe(500);
  });
});

describe('rule interactions', () => {
  it('unchecking peek on ace unchecks peek on ten', () => {
    const app = makeApp();
    const screen = playVariationsScreen(app, {});
    expect(checkbox(screen, 'Dealer peeks on ten').input.checked).toBe(true);
    act(() => checkbox(screen, 'Dealer peeks on ace').input.click());
    expect(checkbox(screen, 'Dealer peeks on ten').input.checked).toBe(false);
    expect(checkbox(screen, 'Dealer peeks on ten').row.classList.contains('is-on')).toBe(false);
  });

  it('the blackjack payout rows are one setting', () => {
    const app = makeApp();
    const screen = bonusesScreen(app, {});
    act(() => checkbox(screen, 'Blackjack pays 2:1').input.click());
    act(() => checkbox(screen, 'No Blackjack bonus').input.click());
    expect(app.settings.get('rules.blackjackPayout')).toBe('1:1');
    expect(checkbox(screen, 'Blackjack pays 2:1').input.checked).toBe(false);
    act(() => checkbox(screen, 'No Blackjack bonus').input.click());
    expect(app.settings.get('rules.blackjackPayout')).toBe('3:2');
  });

  it('a game applies its rules, and a select keeps a value the game forbids', () => {
    const app = makeApp();
    choose(selectFor(unusualGamesScreen(app, {}), 'bonuses.game'), 'Double Exposure');
    expect(app.settings.get('rules.insurance')).toBe('none');
    const rules = commonRulesScreen(app, {});
    const insurance = selectFor(rules, 'rules.insurance');
    expect(insurance.options[insurance.selectedIndex].text).toBe('No Insurance');
    choose(insurance, 'Insurance');
    expect(app.settings.get('rules.insurance')).toBe('none');
    expect(insurance.options[insurance.selectedIndex].text).toBe('No Insurance');
  });
});

describe('navigation screens', () => {
  it('the hub opens each option screen', () => {
    const app = makeApp();
    const screen = settingsHubScreen(app, {});
    expect(screen.el.querySelectorAll('.settings-hub .section')).toHaveLength(3);
    act(() => buttonNamed(screen.el, 'Common Rules').click());
    expect(app.open).toHaveBeenCalledWith('settings.commonRules');
  });

  it('Reset Defaults asks, then resets', async () => {
    const app = makeApp();
    app.settings.set('table.decks', 2);
    const screen = homeScreen(app, {});
    expect(screen.el.querySelector('.home__name svg')).not.toBeNull();
    await act(async () => buttonNamed(screen.el, 'Reset Defaults').click());
    expect(app.settings.get('table.decks')).toBe(6);
  });

  it('help opens its links outside the app, and says when there is none', () => {
    const app = makeApp();
    const screen = helpScreen(app, { topic: 'test.links', title: 'Links' });
    const link = screen.el.querySelector('.screen__body a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(screen.el.querySelector('[data-action="help"]')).toBeNull();
    expect(helpScreen(app, { topic: 'nothing' }).el.textContent).toContain('No help is available');
  });
});
