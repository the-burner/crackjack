// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App, Screen } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { flashOptionsScreen } from '../../../src/drills/flash/options.tsx';
import { depthOptionsScreen } from '../../../src/drills/depth/options.tsx';
import { countOptionsScreen } from '../../../src/drills/count/options.tsx';
import { fullOptionsScreen } from '../../../src/drills/full/options.tsx';
import { flashErrorsScreen } from '../../../src/drills/flash/errors.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

const selectOf = (screen: Screen, name: string) => {
  const el = screen.el.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!el) throw new Error(`no select ${name}`);
  return el;
};

/** Picks the option with `label`, as the user would. */
function choose(screen: Screen, name: string, label: string) {
  const el = selectOf(screen, name);
  const index = [...el.options].findIndex(o => o.text === label);
  if (index < 0) throw new Error(`no option ${label}`);
  act(() => {
    el.selectedIndex = index;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const selectHidden = (screen: Screen, name: string) =>
  selectOf(screen, name).closest('.select')?.hasAttribute('hidden');

/** Whether the control labelled `label` (a checkbox, a duration row or a field) is hidden. */
function hidden(screen: Screen, label: string): boolean {
  const owner = [...screen.el.querySelectorAll('label.check, .settings-row, .field')].find(
    el => el.querySelector(':scope > span')?.textContent === label,
  );
  if (!owner) throw new Error(`no control ${label}`);
  const wrapper = owner.closest('.checklist') ?? owner;
  return wrapper.hasAttribute('hidden');
}

const button = (screen: Screen, text: string) => {
  const el = [...screen.el.querySelectorAll('button')].find(b => b.textContent === text);
  if (!el) throw new Error(`no button ${text}`);
  return el;
};

describe('drill options screens', () => {
  it('share the shell: title bar, sections and the launch button last', () => {
    const app = makeApp();
    const screen = fullOptionsScreen(app, {});
    expect(screen.el.className).toBe('drill-options');
    expect(screen.el.querySelector('.topbar__title')?.textContent).toBe('Full Table Options');
    const column = screen.el.querySelector('.screen__body > .column');
    expect(
      [...(column?.querySelectorAll(':scope > .section > .section__title') ?? [])].map(h => h.textContent),
    ).toEqual(['Drill', 'Timer']);
    const launch = column?.lastElementChild;
    expect(launch?.getAttribute('data-action')).toBe('launch');
    act(() => (launch as HTMLButtonElement).click());
    expect(app.open).toHaveBeenCalledWith('drills.full');
  });

  it('flash shows the set count, Select and the per-hand timer only where they apply', () => {
    const app = makeApp();
    const screen = flashOptionsScreen(app, {});
    expect(hidden(screen, 'Non-blocking error pop-ups')).toBe(false);
    choose(screen, 'drills.flash.testMode', 'Test Mode: Number of errors only at end');
    expect(hidden(screen, 'Non-blocking error pop-ups')).toBe(true);

    const countButton = selectOf(screen, 'drills.flash.countMode').closest('.drill-options__pair')?.lastElementChild;
    expect(countButton?.hasAttribute('hidden')).toBe(true);
    choose(screen, 'drills.flash.countMode', 'Count: Set Count to:');
    expect(countButton?.hasAttribute('hidden')).toBe(false);

    expect(button(screen, 'Select').hidden).toBe(true);
    choose(screen, 'drills.flash.hands', 'Hands: Custom');
    expect(button(screen, 'Select').hidden).toBe(false);

    // Count Down & Halt is the default.
    expect(hidden(screen, 'Time limit per hand')).toBe(true);
    expect(hidden(screen, 'Drill time')).toBe(false);
    choose(screen, 'drills.flash.timerMode', 'Timer Mode: Infinite');
    expect(hidden(screen, 'Time limit per hand')).toBe(false);
    expect(hidden(screen, 'Time per hand')).toBe(false);
    expect(hidden(screen, 'Drill time')).toBe(true);
    expect(button(screen, '50').hidden).toBe(true);
    choose(screen, 'drills.flash.timerMode', 'Timer Mode: Rounds');
    expect(button(screen, '50').hidden).toBe(false);
    act(() => app.settings.set('drills.flash.timePerHand', false));
    expect(hidden(screen, 'Time per hand')).toBe(true);
    expect(hidden(screen, 'Progressive Speed')).toBe(true);
  });

  it('flash writes the deck count and Spanish decks from one select', () => {
    const app = makeApp();
    const screen = flashOptionsScreen(app, {});
    choose(screen, 'drills.flash.decks', 'Four Spanish Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(4);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(true);
    choose(screen, 'drills.flash.decks', 'Double Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(2);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(false);
    expect(selectOf(screen, 'drills.flash.decks').selectedIndex).toBe(1);
  });

  it('flash situations are chips writing one flag each', () => {
    const app = makeApp();
    const screen = flashOptionsScreen(app, {});
    const chips = screen.el.querySelectorAll<HTMLInputElement>('.checklist--chips input');
    expect(chips).toHaveLength(6);
    act(() => chips[0].click());
    const situations = app.settings.get('drills.flash.situations');
    expect(Object.values(situations).filter(on => !on)).toHaveLength(1);
  });

  it('flash shows a summary when Drill Errors is chosen', () => {
    const screen = flashOptionsScreen(makeApp(), {});
    choose(screen, 'drills.flash.hands', 'Hands: Drill Errors');
    expect(document.body.querySelector('.toast')?.textContent).toBe('No errors have been recorded yet.');
  });

  it('flash follows settings written by other screens', () => {
    const app = makeApp();
    const screen = flashOptionsScreen(app, {});
    act(() => app.settings.set('drills.flash.maxCards', 4));
    expect(selectOf(screen, 'drills.flash.maxCards').selectedIndex).toBe(2);
  });

  it('depth swaps the answers card for the count range on the TC drills', () => {
    const screen = depthOptionsScreen(makeApp(), {});
    const titles = () => [...screen.el.querySelectorAll('.section__title')].map(h => h.textContent);
    expect(titles()).toEqual(['Drill', 'Answers', 'Timer']);
    expect(hidden(screen, 'Minimum count')).toBe(true);
    expect(hidden(screen, 'Decks or Aces in Tray')).toBe(false);
    choose(screen, 'drills.depth.drill', 'Drill: TC Conversion');
    expect(titles()).toEqual(['Drill', 'Count Range', 'Timer']);
    expect(hidden(screen, 'Minimum count')).toBe(false);
    expect(hidden(screen, 'Maximum count')).toBe(false);
    expect(hidden(screen, 'Decks or Aces in Tray')).toBe(true);

    expect(hidden(screen, 'Time per test')).toBe(true);
    choose(screen, 'drills.depth.timerMode', 'Timer Mode: Rounds');
    expect(hidden(screen, 'Time per test')).toBe(false);
    expect(hidden(screen, 'Progressive Speed')).toBe(false);
    expect(hidden(screen, 'Drill time')).toBe(true);
  });

  it('count hides what no tests, dealing by hand or a single card leave unused', () => {
    const app = makeApp();
    const screen = countOptionsScreen(app, {});
    expect(hidden(screen, 'Time per test')).toBe(true);
    expect(hidden(screen, 'Drill time')).toBe(false);
    choose(screen, 'drills.count.timerMode', 'Timer Mode: Shoe');
    expect(hidden(screen, 'Time per test')).toBe(false);
    expect(hidden(screen, 'Drill time')).toBe(true);

    act(() => app.settings.set('drills.count.dealByHand', true));
    expect(hidden(screen, 'Deal speed')).toBe(true);
    expect(hidden(screen, 'Progressive Speed')).toBe(true);

    choose(screen, 'drills.count.testEvery', 'Test: No Tests');
    expect(selectHidden(screen, 'drills.count.accuracy')).toBe(true);
    expect(selectHidden(screen, 'drills.count.trayStyle')).toBe(true);
    expect(hidden(screen, 'Thickness:')).toBe(true);
    expect(hidden(screen, 'Two Counts')).toBe(true);
    expect(hidden(screen, 'Time per test')).toBe(true);

    expect(selectHidden(screen, 'drills.count.positions')).toBe(false);
    choose(screen, 'drills.count.cardsPerFlash', 'Cards: One');
    expect(selectHidden(screen, 'drills.count.positions')).toBe(true);
  });

  it('count shows the deal speed in tenths of a second', () => {
    const screen = countOptionsScreen(makeApp(), {});
    expect(screen.el.querySelector('[aria-label="Deal speed"]')?.textContent).toBe('0.8 s');
    expect(screen.el.querySelector('[aria-label="Drill time"]')?.textContent).toBe('00:03:00');
  });

  it('full hides what Two Tables and Running Count do not use', () => {
    const screen = fullOptionsScreen(makeApp(), {});
    expect(hidden(screen, 'Two Counts')).toBe(true);
    choose(screen, 'drills.full.drill', 'Drill: Aces Left');
    expect(hidden(screen, 'Two Counts')).toBe(false);
    expect(selectHidden(screen, 'drills.full.endWarning')).toBe(true);
    choose(screen, 'drills.full.timerMode', 'Timer Mode: Shoe');
    expect(selectHidden(screen, 'drills.full.endWarning')).toBe(false);
    choose(screen, 'drills.full.drill', 'Drill: Two Tables');
    expect(selectHidden(screen, 'drills.full.handStyle')).toBe(true);
    expect(selectHidden(screen, 'drills.full.endWarning')).toBe(true);
    expect(hidden(screen, 'Two Counts')).toBe(true);
  });
});

describe('flash error history', () => {
  it('says when nothing has been recorded, and re-reads the tallies when shown', () => {
    const app = makeApp();
    const screen = flashErrorsScreen(app, {});
    expect(screen.el.querySelector('.column')?.innerHTML).toBe('<p class="note">No errors have been recorded yet.</p>');
    act(() => {
      app.errorTallies.record('hardStand', 6, 8);
      screen.onShow?.();
    });
    expect(screen.el.querySelector('.stat-summary')?.textContent).toBe('Total errors1');
    expect(screen.el.querySelectorAll('.stat-row').length).toBeGreaterThan(0);
  });
});
