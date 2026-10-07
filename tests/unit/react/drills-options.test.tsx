import { describe, it, expect } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { FlashOptions } from '@/drills/flash/options';
import { DepthOptions } from '@/drills/depth/options';
import { CountOptions } from '@/drills/count/options';
import { FullOptions } from '@/drills/full/options';
import { FlashErrors } from '@/drills/flash/errors';
import { SITUATIONS, SITUATION_LABELS } from '@/drills/flash/logic';
import { renderScreen } from '../../support/render';

type User = ReturnType<typeof userEvent.setup>;

/** A select by its label; hidden ones too. */
const select = (label: string) => screen.getByRole('combobox', { name: label, hidden: true });

/** Picks `option` in the select labelled `label`, as the user would. */
async function choose(user: User, label: string, option: string) {
  await user.click(select(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** A switch, hidden or not. */
const toggle = (label: string) => screen.getByRole('switch', { name: label, hidden: true });
/** A duration button, hidden or not. */
const duration = (label: string) => screen.getByRole('button', { name: label, hidden: true });
const numberButton = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}: `), hidden: true });

describe('drill options screens', () => {
  it('share the shell: title bar, sections and the launch button last', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FullOptions />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Full Table Options');
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Drill', 'Timer']);
    const launch = screen.getByRole('button', { name: 'Launch the Drill' });
    expect(screen.getAllByRole('button').at(-1)).toBe(launch);
    await user.click(launch);
    expect(app.open).toHaveBeenCalledWith('drills.full');
  });

  it('flash shows the set count, custom hands and the per-hand timer only where they apply', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    expect(toggle('Non-blocking error pop-ups')).toBeVisible();
    await choose(user, 'Test mode', 'Number of errors only at end');
    expect(toggle('Non-blocking error pop-ups')).not.toBeVisible();

    // The set count, after the count select.
    expect(numberButton('Set count to')).not.toBeVisible();
    await choose(user, 'Count', 'Set Count');
    expect(numberButton('Set count to')).toHaveTextContent('0');
    expect(numberButton('Set count to')).toBeVisible();

    // A hidden element has no accessible name, so this one is found by its text.
    expect(screen.getByText('Select custom hands')).not.toBeVisible();
    await choose(user, 'Hands', 'Custom');
    await user.click(screen.getByRole('button', { name: 'Select custom hands' }));
    expect(app.open).toHaveBeenCalledWith('strategy.tables', expect.objectContaining({ mode: 'editMask' }));

    // Count Down & Halt is the default.
    expect(toggle('Time limit per hand')).not.toBeVisible();
    expect(duration('Drill time')).toBeVisible();
    await choose(user, 'Timer mode', 'Infinite');
    expect(toggle('Time limit per hand')).toBeVisible();
    expect(duration('Time per hand')).toBeVisible();
    expect(duration('Drill time')).not.toBeVisible();
    // The number of rounds.
    expect(numberButton('Rounds')).not.toBeVisible();
    await choose(user, 'Timer mode', 'Rounds');
    expect(numberButton('Rounds')).toHaveTextContent('50');
    expect(numberButton('Rounds')).toBeVisible();
    await user.click(toggle('Time limit per hand'));
    expect(app.settings.get('drills.flash.timePerHand')).toBe(false);
    expect(duration('Time per hand')).not.toBeVisible();
    expect(toggle('Progressive Speed')).not.toBeVisible();
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
    expect(select('Decks')).toHaveTextContent('Double Decks');
  });

  it('flash situations are toggles writing one flag each', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    const group = screen.getByRole('group', { name: 'Situations' });
    const chips = SITUATIONS.map(flag => within(group).getByRole('button', { name: SITUATION_LABELS[flag] }));
    expect(chips).toHaveLength(6);
    chips.forEach(chip => expect(chip).toHaveAttribute('aria-pressed', 'true'));
    await user.click(chips[0]);
    const situations = app.settings.get('drills.flash.situations');
    expect(situations[SITUATIONS[0]]).toBe(false);
    expect(Object.values(situations).filter(on => !on)).toHaveLength(1);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('flash shows a summary when Drill Errors is chosen', async () => {
    const user = userEvent.setup();
    renderScreen(
      <>
        <FlashOptions />
        <Toaster />
      </>,
    );
    await choose(user, 'Hands', 'Drill Errors');
    expect(await screen.findByText('No errors have been recorded yet.')).toBeInTheDocument();
  });

  it('flash refuses to launch without a situation', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    act(() =>
      app.settings.set('drills.flash.situations', {
        ...app.settings.get('drills.flash.situations'),
        ...Object.fromEntries(SITUATIONS.map(flag => [flag, false])),
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Launch the Drill' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No situations have been selected.');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(app.open).not.toHaveBeenCalled();
  });

  it('flash clears the error history after confirming', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<FlashOptions />);
    app.errorTallies.record('hardStand', 6, 8);
    await user.click(screen.getByRole('button', { name: 'Clear error history' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(app.errorTallies.cells()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Error history' }));
    expect(app.open).toHaveBeenCalledWith('drills.flash.errors');
  });

  it('flash follows settings written by other screens', () => {
    const { app } = renderScreen(<FlashOptions />);
    act(() => app.settings.set('drills.flash.maxCards', 4));
    expect(select('Cards')).toHaveTextContent('Two to Four');
  });

  it('depth swaps the answers group for the count range on the TC drills', async () => {
    const user = userEvent.setup();
    renderScreen(<DepthOptions />);
    const titles = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(titles()).toEqual(['Drill', 'Answers', 'Timer']);
    expect(screen.getByText('Minimum count')).not.toBeVisible();
    expect(toggle('Decks or Aces in Tray')).toBeVisible();
    await choose(user, 'Drill', 'TC Conversion');
    expect(titles()).toEqual(['Drill', 'Count Range', 'Timer']);
    expect(numberButton('Minimum count')).toBeVisible();
    expect(numberButton('Maximum count')).toBeVisible();
    expect(toggle('Decks or Aces in Tray')).not.toBeVisible();

    expect(duration('Time per test')).not.toBeVisible();
    await choose(user, 'Timer mode', 'Rounds');
    expect(duration('Time per test')).toBeVisible();
    expect(toggle('Progressive Speed')).toBeVisible();
    expect(duration('Drill time')).not.toBeVisible();
  });

  it('depth corrects the tray style at launch', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<DepthOptions />);
    act(() => app.settings.update({ 'drills.depth.decks': 6, 'drills.depth.trayStyle': 'doubleDeckFront' }));
    await user.click(screen.getByRole('button', { name: 'Launch the Drill' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('only holds 2 decks');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(select('Tray style')).toHaveTextContent('Six-deck tray, front');
    expect(app.open).not.toHaveBeenCalled();
  });

  it('count hides what no tests, dealing by hand or a single card leave unused', async () => {
    const user = userEvent.setup();
    renderScreen(<CountOptions />);
    expect(duration('Time per test')).not.toBeVisible();
    expect(duration('Drill time')).toBeVisible();
    await choose(user, 'Timer mode', 'Shoe');
    expect(duration('Time per test')).toBeVisible();
    expect(duration('Drill time')).not.toBeVisible();

    await user.click(toggle('Deal by hand'));
    expect(duration('Deal speed')).not.toBeVisible();
    expect(toggle('Progressive Speed')).not.toBeVisible();

    await choose(user, 'Test', 'No Tests');
    expect(select('Accuracy')).not.toBeVisible();
    expect(select('Tray style')).not.toBeVisible();
    expect(screen.getByText('Thickness')).not.toBeVisible();
    expect(toggle('Two Counts')).not.toBeVisible();
    expect(duration('Time per test')).not.toBeVisible();

    expect(select('Positions')).toBeVisible();
    await choose(user, 'Cards', 'One');
    expect(select('Positions')).not.toBeVisible();
  });

  it('count shows the deal speed in tenths of a second', () => {
    renderScreen(<CountOptions />);
    expect(duration('Deal speed')).toHaveTextContent(/^0\.8 s$/);
    expect(duration('Drill time')).toHaveTextContent(/^00:03:00$/);
  });

  it('sets a duration in the dialog, and Cancel leaves it alone', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<CountOptions />);
    await user.click(duration('Drill time'));
    let dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    const minutes = within(dialog).getByRole('spinbutton', { name: 'Minutes' });
    expect(minutes).toHaveValue(3);
    await user.clear(minutes);
    await user.type(minutes, '5');
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Seconds' }), '{Backspace}1');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(301);
    expect(duration('Drill time')).toHaveTextContent('00:05:01');

    // Kept within the setting's range (10 s to 29:59).
    await user.click(duration('Drill time'));
    dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Minutes' }));
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Seconds' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(10);

    await user.click(duration('Drill time'));
    dialog = await screen.findByRole('dialog', { name: 'Drill time' });
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Minutes' }), '9');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(app.settings.get('drills.count.alarmSeconds')).toBe(10);
  });

  it('picks tenths of a second for the deal speed', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<CountOptions />);
    await user.click(duration('Deal speed'));
    const dialog = await screen.findByRole('dialog', { name: 'Deal speed' });
    expect(within(dialog).getByRole('spinbutton', { name: 'Seconds' })).toHaveValue(0);
    const tenths = within(dialog).getByRole('spinbutton', { name: 'Tenths' });
    expect(tenths).toHaveValue(8);
    await user.clear(tenths);
    await user.type(tenths, '5{Enter}');
    expect(app.settings.get('drills.count.dealTenths')).toBe(5);
    expect(duration('Deal speed')).toHaveTextContent('0.5 s');
  });

  it('full hides what Two Tables and Running Count do not use', async () => {
    const user = userEvent.setup();
    renderScreen(<FullOptions />);
    expect(toggle('Two Counts')).not.toBeVisible();
    await choose(user, 'Drill', 'Aces Left');
    expect(toggle('Two Counts')).toBeVisible();
    expect(select('End warning')).not.toBeVisible();
    await choose(user, 'Timer mode', 'Shoe');
    expect(select('End warning')).toBeVisible();
    await choose(user, 'Drill', 'Two Tables');
    expect(select('Hands')).not.toBeVisible();
    expect(select('End warning')).not.toBeVisible();
    expect(toggle('Two Counts')).not.toBeVisible();
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
