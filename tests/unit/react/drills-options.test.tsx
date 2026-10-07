import { describe, it, expect } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlashOptions, flashOptionsScreen } from '../../../src/drills/flash/options.tsx';
import { DepthOptions } from '../../../src/drills/depth/options.tsx';
import { CountOptions } from '../../../src/drills/count/options.tsx';
import { FullOptions } from '../../../src/drills/full/options.tsx';
import { FlashErrors } from '../../../src/drills/flash/errors.tsx';
import { SITUATIONS, SITUATION_LABELS } from '../../../src/drills/flash/logic.ts';
import { renderScreen } from '../../support/render.tsx';

// The option selects carry no label of their own (each option names the
// setting), so a select is found by one of its options.
const selectHolding = (option: string) => {
  const select = screen
    .getAllByRole('combobox', { hidden: true })
    .find(el => within(el).queryByRole('option', { name: option, hidden: true }));
  if (!select) throw new Error(`no select holding ${option}`);
  return select;
};

/** Picks `option` in the select holding it, as the user would. */
const choose = (user: ReturnType<typeof userEvent.setup>, option: string) =>
  user.selectOptions(selectHolding(option), option);

/** A checkbox or a duration button, hidden or not. */
const control = (label: string) => screen.getByLabelText(label);

// A hidden element has no accessible name, so hidden buttons are found by their text.
const button = (text: string) => screen.getByText(text, { selector: 'button' });

describe('drill options screens', () => {
  it('share the shell: title bar, sections and the launch button last', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FullOptions />);
    expect(flashOptionsScreen(app, {}).el).toHaveClass('drill-options');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Full Table Options');
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Drill', 'Timer']);
    const launch = screen.getByRole('button', { name: 'Launch the Drill' });
    expect(screen.getAllByRole('button').at(-1)).toBe(launch);
    await user.click(launch);
    expect(app.open).toHaveBeenCalledWith('drills.full');
  });

  it('flash shows the set count, Select and the per-hand timer only where they apply', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    expect(control('Non-blocking error pop-ups')).toBeVisible();
    await choose(user, 'Test Mode: Number of errors only at end');
    expect(control('Non-blocking error pop-ups')).not.toBeVisible();

    // The set count, next to the count select.
    expect(button('0')).not.toBeVisible();
    await choose(user, 'Count: Set Count to:');
    expect(button('0')).toBeVisible();

    expect(button('Select')).not.toBeVisible();
    await choose(user, 'Hands: Custom');
    expect(button('Select')).toBeVisible();

    // Count Down & Halt is the default.
    expect(control('Time limit per hand')).not.toBeVisible();
    expect(control('Drill time')).toBeVisible();
    await choose(user, 'Timer Mode: Infinite');
    expect(control('Time limit per hand')).toBeVisible();
    expect(control('Time per hand')).toBeVisible();
    expect(control('Drill time')).not.toBeVisible();
    // The number of rounds.
    expect(button('50')).not.toBeVisible();
    await choose(user, 'Timer Mode: Rounds');
    expect(button('50')).toBeVisible();
    act(() => app.settings.set('drills.flash.timePerHand', false));
    expect(control('Time per hand')).not.toBeVisible();
    expect(control('Progressive Speed')).not.toBeVisible();
  });

  it('flash writes the deck count and Spanish decks from one select', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    await choose(user, 'Four Spanish Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(4);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(true);
    await choose(user, 'Double Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(2);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(false);
    expect(selectHolding('Double Decks')).toHaveDisplayValue('Double Decks');
  });

  it('flash situations are chips writing one flag each', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    const chips = SITUATIONS.map(flag => screen.getByRole('checkbox', { name: SITUATION_LABELS[flag] }));
    expect(chips).toHaveLength(6);
    await user.click(chips[0]);
    const situations = app.settings.get('drills.flash.situations');
    expect(Object.values(situations).filter(on => !on)).toHaveLength(1);
  });

  it('flash shows a summary when Drill Errors is chosen', async () => {
    const user = userEvent.setup();
    renderScreen(<FlashOptions />);
    await choose(user, 'Hands: Drill Errors');
    expect(screen.getByRole('status')).toHaveTextContent('No errors have been recorded yet.');
  });

  it('flash follows settings written by other screens', () => {
    const { app } = renderScreen(<FlashOptions />);
    act(() => app.settings.set('drills.flash.maxCards', 4));
    expect(selectHolding('Cards: Two to Four')).toHaveDisplayValue('Cards: Two to Four');
  });

  it('depth swaps the answers card for the count range on the TC drills', async () => {
    const user = userEvent.setup();
    renderScreen(<DepthOptions />);
    const titles = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(titles()).toEqual(['Drill', 'Answers', 'Timer']);
    expect(screen.getByText('Minimum count')).not.toBeVisible();
    expect(control('Decks or Aces in Tray')).toBeVisible();
    await choose(user, 'Drill: TC Conversion');
    expect(titles()).toEqual(['Drill', 'Count Range', 'Timer']);
    expect(screen.getByText('Minimum count')).toBeVisible();
    expect(screen.getByText('Maximum count')).toBeVisible();
    expect(control('Decks or Aces in Tray')).not.toBeVisible();

    expect(control('Time per test')).not.toBeVisible();
    await choose(user, 'Timer Mode: Rounds');
    expect(control('Time per test')).toBeVisible();
    expect(control('Progressive Speed')).toBeVisible();
    expect(control('Drill time')).not.toBeVisible();
  });

  it('count hides what no tests, dealing by hand or a single card leave unused', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<CountOptions />);
    expect(control('Time per test')).not.toBeVisible();
    expect(control('Drill time')).toBeVisible();
    await choose(user, 'Timer Mode: Shoe');
    expect(control('Time per test')).toBeVisible();
    expect(control('Drill time')).not.toBeVisible();

    act(() => app.settings.set('drills.count.dealByHand', true));
    expect(control('Deal speed')).not.toBeVisible();
    expect(control('Progressive Speed')).not.toBeVisible();

    await choose(user, 'Test: No Tests');
    expect(selectHolding('Accuracy: Exact')).not.toBeVisible();
    expect(selectHolding('Six-deck tray, front')).not.toBeVisible();
    expect(screen.getByText('Thickness:')).not.toBeVisible();
    expect(control('Two Counts')).not.toBeVisible();
    expect(control('Time per test')).not.toBeVisible();

    const positions = selectHolding('Positions: Diagonal');
    expect(positions).toBeVisible();
    await choose(user, 'Cards: One');
    expect(positions).not.toBeVisible();
  });

  it('count shows the deal speed in tenths of a second', () => {
    renderScreen(<CountOptions />);
    expect(control('Deal speed')).toHaveTextContent(/^0\.8 s$/);
    expect(control('Drill time')).toHaveTextContent(/^00:03:00$/);
  });

  it('full hides what Two Tables and Running Count do not use', async () => {
    const user = userEvent.setup();
    renderScreen(<FullOptions />);
    expect(control('Two Counts')).not.toBeVisible();
    await choose(user, 'Drill: Aces Left');
    expect(control('Two Counts')).toBeVisible();
    const endWarning = selectHolding('End warning: None');
    expect(endWarning).not.toBeVisible();
    await choose(user, 'Timer Mode: Shoe');
    expect(endWarning).toBeVisible();
    await choose(user, 'Drill: Two Tables');
    expect(selectHolding('Hands: First Two Cards')).not.toBeVisible();
    expect(endWarning).not.toBeVisible();
    expect(control('Two Counts')).not.toBeVisible();
  });
});

describe('flash error history', () => {
  it('says when nothing has been recorded, and re-reads the tallies when shown', () => {
    const { app, show } = renderScreen(<FlashErrors />);
    expect(screen.getByText('No errors have been recorded yet.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    app.errorTallies.record('hardStand', 6, 8);
    show();
    expect(screen.getByText('Total errors')).toBeInTheDocument();
    // The one error is all of its situation's and its hand's.
    expect(screen.getByText('Hard H/S')).toBeInTheDocument();
    expect(screen.getAllByText('1 · 100%')).toHaveLength(2);
  });
});
