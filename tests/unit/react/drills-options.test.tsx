import { describe, it, expect } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from '@/components/ui/toast';
import { FlashOptions } from '@/drills/flash/options';
import { DepthOptions } from '@/drills/depth/options';
import { CountOptions } from '@/drills/count/options';
import { FullOptions } from '@/drills/full/options';
import { FlashErrors } from '@/drills/flash/errors';
import { SITUATIONS, SITUATION_LABELS } from '@/drills/flash/logic';
import { renderScreen } from '../../support/render';

type User = ReturnType<typeof userEvent.setup>;

// A control a screen hides is either left out or hidden, so the finders return null for one left out.

/** A select by its label. */
const select = (label: string) => screen.queryByRole('combobox', { name: label, hidden: true });

/** Picks `option` in the select labelled `label`, as the user would. */
async function choose(user: User, label: string, option: string) {
  await user.selectOptions(screen.getByRole('combobox', { name: label }), option);
}

const toggle = (label: string) => screen.queryByRole('switch', { name: label, hidden: true });
/** A duration button. */
const duration = (label: string) => screen.queryByRole('button', { name: label, hidden: true });
const numberButton = (label: string) => screen.queryByRole('button', { name: new RegExp(`^${label}: `), hidden: true });

/** Not shown: left out, or there but hidden. */
const expectHidden = (el: HTMLElement | null) => {
  if (el) expect(el).not.toBeVisible();
};

/** The number in a duration wheel's band. */
const wheelValue = (wheel: HTMLElement) => wheel.getAttribute('aria-valuenow');

/** Turns a duration wheel `steps` rows down (up when negative), as the arrow keys do. */
async function turn(user: User, wheel: HTMLElement, steps: number) {
  wheel.focus();
  for (let i = 0; i < Math.abs(steps); i++) await user.keyboard(steps > 0 ? '{ArrowDown}' : '{ArrowUp}');
}

describe('drill options screens', () => {
  it('share the shell: title bar, sections and the launch button last', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<FullOptions />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Full Table Options');
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Drill', 'Timer']);
    const launch = screen.getByRole('button', { name: 'Launch the Drill' });
    expect(screen.getAllByRole('button').at(-1)).toBe(launch);
    await user.click(launch);
    expect(location().pathname).toBe('/drills/full/play');
  });

  it('flash shows the set count, custom hands and the per-hand timer only where they apply', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<FlashOptions />);
    expect(toggle('Non-blocking error pop-ups')).toBeVisible();
    await choose(user, 'Test mode', 'Test Mode: Number of errors only at end');
    expectHidden(toggle('Non-blocking error pop-ups'));

    // The set count, beside the count select.
    expectHidden(numberButton('Count'));
    await choose(user, 'Count', 'Count: Set Count to:');
    expect(numberButton('Count')).toHaveTextContent('0');
    expect(numberButton('Count')).toBeVisible();

    // Select, beside the hands select, picks the custom hands.
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    await choose(user, 'Hands', 'Hands: Custom');
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(location().pathname).toBe('/strategy/tables');
    expect(location().search).toContain('mode=editMask');

    // Count Down & Halt is the default.
    expectHidden(toggle('Time limit per hand'));
    expect(duration('Drill time')).toBeVisible();
    await choose(user, 'Timer mode', 'Timer Mode: Infinite');
    expect(toggle('Time limit per hand')).toBeVisible();
    expect(duration('Time per hand')).toBeVisible();
    expectHidden(duration('Drill time'));
    // The number of rounds.
    expectHidden(numberButton('Rounds'));
    await choose(user, 'Timer mode', 'Timer Mode: Rounds');
    expect(numberButton('Rounds')).toHaveTextContent('50');
    expect(numberButton('Rounds')).toBeVisible();
    await user.click(screen.getByRole('switch', { name: 'Time limit per hand' }));
    expect(app.settings.get('drills.flash.timePerHand')).toBe(false);
    expectHidden(duration('Time per hand'));
    expectHidden(toggle('Progressive Speed'));
  });

  it('flash writes the deck count and Spanish decks from one select', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    await choose(user, 'Decks', 'Four Spanish Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(4);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(true);
    await choose(user, 'Decks', 'Double Decks');
    expect(app.settings.get('drills.flash.decks')).toBe(2);
    expect(app.settings.get('drills.flash.spanishDecks')).toBe(false);
    expect(select('Decks')).toHaveDisplayValue('Double Decks');
  });

  it('flash situations are toggles writing one flag each', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    const chips = SITUATIONS.map(flag => screen.getByRole('checkbox', { name: SITUATION_LABELS[flag] }));
    expect(chips).toHaveLength(6);
    chips.forEach(chip => expect(chip).toBeChecked());
    await user.click(chips[0]);
    const situations = app.settings.get('drills.flash.situations');
    expect(situations[SITUATIONS[0]]).toBe(false);
    expect(Object.values(situations).filter(on => !on)).toHaveLength(1);
    expect(chips[0]).not.toBeChecked();
  });

  it('flash shows a summary when Drill Errors is chosen', async () => {
    const user = userEvent.setup();
    renderScreen(
      <>
        <FlashOptions />
        <Toaster />
      </>,
    );
    await choose(user, 'Hands', 'Hands: Drill Errors');
    expect(await screen.findByText('No errors have been recorded yet.')).toBeInTheDocument();
  });

  it('flash refuses to launch without a situation', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<FlashOptions />);
    act(() =>
      app.settings.set('drills.flash.situations', {
        ...app.settings.get('drills.flash.situations'),
        ...Object.fromEntries(SITUATIONS.map(flag => [flag, false])),
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Launch the Drill' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No situations have been selected.');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(location().pathname).toBe('/screen');
  });

  it('flash clears the error history after confirming', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<FlashOptions />);
    app.errorTallies.record('hardStand', 6, 8);
    await user.click(screen.getByRole('button', { name: 'Clear error history' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(app.errorTallies.cells()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Error history' }));
    expect(location().pathname).toBe('/drills/flash/errors');
  });

  it('flash follows settings written by other screens', () => {
    const { app } = renderScreen(<FlashOptions />);
    act(() => app.settings.set('drills.flash.maxCards', 4));
    expect(select('Cards')).toHaveDisplayValue('Cards: Two to Four');
  });

  it('depth swaps the answers group for the count range on the TC drills', async () => {
    const user = userEvent.setup();
    renderScreen(<DepthOptions />);
    const titles = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(titles()).toEqual(['Drill', 'Answers', 'Timer']);
    expect(screen.getByText('Minimum count')).not.toBeVisible();
    expect(toggle('Decks or Aces in Tray')).toBeVisible();
    await choose(user, 'Drill', 'Drill: TC Conversion');
    expect(titles()).toEqual(['Drill', 'Count Range', 'Timer']);
    expect(numberButton('Minimum count')).toBeVisible();
    expect(numberButton('Maximum count')).toBeVisible();
    expectHidden(toggle('Decks or Aces in Tray'));

    expectHidden(duration('Time per test'));
    await choose(user, 'Timer mode', 'Timer Mode: Rounds');
    expect(duration('Time per test')).toBeVisible();
    expect(toggle('Progressive Speed')).toBeVisible();
    expectHidden(duration('Drill time'));
  });

  it('depth corrects the tray style at launch', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<DepthOptions />);
    act(() => app.settings.update({ 'drills.depth.decks': 6, 'drills.depth.trayStyle': 'doubleDeckFront' }));
    await user.click(screen.getByRole('button', { name: 'Launch the Drill' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('only holds 2 decks');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(select('Tray style')).toHaveDisplayValue('Six-deck tray, front');
    expect(location().pathname).toBe('/screen');
  });

  it('count hides what no tests, dealing by hand or a single card leave unused', async () => {
    const user = userEvent.setup();
    renderScreen(<CountOptions />);
    expectHidden(duration('Time per test'));
    expect(duration('Drill time')).toBeVisible();
    await choose(user, 'Timer mode', 'Timer Mode: Shoe');
    expect(duration('Time per test')).toBeVisible();
    expectHidden(duration('Drill time'));

    await user.click(screen.getByRole('switch', { name: 'Deal by hand' }));
    expectHidden(duration('Deal speed'));
    expectHidden(toggle('Progressive Speed'));

    await choose(user, 'Test', 'Test: No Tests');
    expectHidden(select('Accuracy'));
    expectHidden(select('Tray style'));
    expect(screen.queryByText('Thickness:')).not.toBeInTheDocument();
    expectHidden(toggle('Two Counts'));
    expectHidden(duration('Time per test'));

    expect(select('Positions')).toBeVisible();
    await choose(user, 'Cards', 'Cards: One');
    expectHidden(select('Positions'));
  });

  it('count shows the deal speed in tenths of a second', () => {
    renderScreen(<CountOptions />);
    expect(duration('Deal speed')).toHaveTextContent(/^0\.8 s$/);
    expect(duration('Drill time')).toHaveTextContent(/^00:03:00$/);
  });

  it('sets a duration with the wheels, and Cancel leaves it alone', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<CountOptions />);
    const drillTime = () => screen.getByRole('button', { name: 'Drill time' });
    await user.click(drillTime());
    let dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    const minutes = within(dialog).getByRole('spinbutton', { name: 'Minutes' });
    expect(wheelValue(minutes)).toBe('3');
    await turn(user, minutes, 2);
    await turn(user, within(dialog).getByRole('spinbutton', { name: 'Seconds' }), 1);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(301);
    expect(drillTime()).toHaveTextContent('00:05:01');

    // Kept within the setting's range (10 s to 29:59).
    await user.click(drillTime());
    dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    await turn(user, within(dialog).getByRole('spinbutton', { name: 'Minutes' }), -5);
    await turn(user, within(dialog).getByRole('spinbutton', { name: 'Seconds' }), -1);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(10);

    await user.click(drillTime());
    dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    await turn(user, within(dialog).getByRole('spinbutton', { name: 'Minutes' }), 9);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(10);
  });

  it('picks tenths of a second for the deal speed', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<CountOptions />);
    await user.click(screen.getByRole('button', { name: 'Deal speed' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deal speed' });
    expect(wheelValue(within(dialog).getByRole('spinbutton', { name: 'Seconds' }))).toBe('0');
    const tenths = within(dialog).getByRole('spinbutton', { name: 'Tenths' });
    expect(wheelValue(tenths)).toBe('8');
    await turn(user, tenths, -3);
    await user.keyboard('{Enter}');
    expect(app.settings.get('drills.count.dealTenths')).toBe(5);
    expect(duration('Deal speed')).toHaveTextContent('0.5 s');
  });

  it('full hides what Two Tables and Running Count do not use', async () => {
    const user = userEvent.setup();
    renderScreen(<FullOptions />);
    expectHidden(toggle('Two Counts'));
    await choose(user, 'Drill', 'Drill: Aces Left');
    expect(toggle('Two Counts')).toBeVisible();
    expectHidden(select('End warning'));
    await choose(user, 'Timer mode', 'Timer Mode: Shoe');
    expect(select('End warning')).toBeVisible();
    await choose(user, 'Drill', 'Drill: Two Tables');
    expectHidden(select('Hands'));
    expectHidden(select('End warning'));
    expectHidden(toggle('Two Counts'));
  });
});

describe('flash error history', () => {
  it('says when nothing has been recorded, and follows the tallies as they change', () => {
    const { app } = renderScreen(<FlashErrors />);
    expect(screen.getByText('No errors have been recorded yet.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    act(() => app.errorTallies.record('hardStand', 6, 8));
    expect(screen.getByText('Total errors')).toBeInTheDocument();
    // The one error is all of its situation's and its hand's.
    expect(screen.getByText('Hard H/S')).toBeInTheDocument();
    expect(screen.getAllByText('1 · 100%')).toHaveLength(2);
  });
});
