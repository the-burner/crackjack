// The detailed bet picker ("Allowed Bets"): a row
// of spot counts and a grid of chip counts, plus a custom amount.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { promptNumber } from '../../ui/dialogs.js';
import { CHIP_CHOICES, HAND_CHOICES, MAX_CHIPS, maxChipsForHands } from '../../settings/bet-ramp.js';

const HELP_TEXT = 'Tap the number of chips to bet. To play more than one spot, '
  + 'tap the number of spots first. You can also enter a custom amount.';

/**
 * @param {object} app
 * @param {object} params
 * @param {'main'|'sideBet'} [params.mode='main']  Side bets are for one spot only.
 * @param {number} [params.chipValue]
 * @param {number} [params.hands]
 * @param {(bet: {chips: number, hands: number, amount: number}) => void} params.onPick
 */
export function betSelectScreen(app, { mode = 'main', chipValue = app.settings.get('betting.chipValue'), hands: initialHands = 1, onPick } = {}) {
  const sideBet = mode === 'sideBet';
  const { el, body } = standardScreen(app, { title: sideBet ? 'Side Bet' : 'Allowed Bets', help: 'game.betSelect', className: 'bet-select' });
  let hands = Math.min(Math.max(1, initialHands), HAND_CHOICES.length);

  const handButtons = HAND_CHOICES.map(count => button(count === 1 ? '1' : `${count}x`, {
    className: 'tile tile--hands',
    onClick: () => { hands = count; refresh(); },
    'data-hands': String(count),
  }));
  const chipButtons = CHIP_CHOICES.map(chips => button(String(chips), {
    className: 'tile tile--chips',
    onClick: () => pick(chips),
    'data-chips': String(chips),
  }));

  function refresh() {
    handButtons.forEach((btn, i) => btn.classList.toggle('is-on', HAND_CHOICES[i] === hands));
    const most = maxChipsForHands(hands);
    chipButtons.forEach((btn, i) => { btn.disabled = CHIP_CHOICES[i] > most; });
  }

  function pick(chips) {
    onPick?.({ chips, hands: sideBet ? 1 : hands, amount: chips * chipValue });
    app.back();
  }

  async function custom() {
    const amount = await promptNumber('Amount to bet', chipValue, { min: 0, max: MAX_CHIPS * chipValue });
    if (amount === null) return;
    onPick?.({ chips: amount / chipValue, hands: sideBet ? 1 : hands, amount });
    app.back();
  }

  body.append(h('div', { class: 'column bet-select__body' },
    h('p', { class: 'note' }, HELP_TEXT),
    sideBet ? null : h('div', { class: 'bet-select__hands' }, ...handButtons),
    h('div', { class: 'bet-select__chips' }, ...chipButtons),
    button('Custom Bet', { block: true, onClick: custom, 'data-action': 'custom' }),
    h('p', { class: 'note' }, `One chip is $${chipValue}. Chips x spots may not exceed ${MAX_CHIPS}.`)));

  refresh();
  return { el };
}
