// The detailed bet picker ("Allowed Bets"): a row
// of spot counts and a grid of chip counts, plus a custom amount.

import { useState } from 'react';
import { useApp } from '../../react/app-context.ts';
import { Button, StandardScreen } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';
import { CHIP_CHOICES, HAND_CHOICES, MAX_CHIPS, maxChipsForHands } from '../../settings/bet-ramp.ts';
import { promptNumber } from '../../ui/dialogs.ts';

const HELP_TEXT =
  'Tap the number of chips to bet. To play more than one spot, ' +
  'tap the number of spots first. You can also enter a custom amount.';

export type BetPick = { chips: number; hands: number; amount: number };

export type BetSelectParams = {
  /** Side bets are for one spot only. Default 'main'. */
  mode?: 'main' | 'sideBet';
  /** Names the spot where a game has two. */
  title?: string;
  chipValue?: number;
  hands?: number;
  /** Returning true means the handler moved to another screen itself. */
  onPick?: (bet: BetPick) => boolean | void;
};

export function BetSelect({
  params: { mode = 'main', title, chipValue: chipParam, hands: initialHands = 1, onPick },
}: {
  params: BetSelectParams;
}) {
  const app = useApp();
  const chipValue = chipParam ?? app.settings.get('betting.chipValue');
  const sideBet = mode === 'sideBet';
  const heading = title ?? (sideBet ? 'Side Bet' : 'Allowed Bets');
  const [hands, setHands] = useState(() => Math.min(Math.max(1, initialHands), HAND_CHOICES.length));
  const most = maxChipsForHands(hands);

  function pick(chips: number, amount: number) {
    const moved = onPick?.({ chips, hands: sideBet ? 1 : hands, amount });
    if (moved !== true) app.back();
  }

  async function custom() {
    const amount = await promptNumber('Amount to bet', chipValue, { min: 0, max: MAX_CHIPS * chipValue });
    if (amount === null) return;
    pick(amount / chipValue, amount);
  }

  return (
    <StandardScreen title={heading} help="game.betSelect">
      <div className="column bet-select__body">
        <p className="note">{HELP_TEXT}</p>
        {!sideBet && (
          <div className="bet-select__hands" role="group" aria-label="Spots">
            {HAND_CHOICES.map(count => (
              <Button
                key={count}
                className={`tile tile--hands${count === hands ? ' is-on' : ''}`}
                onClick={() => setHands(count)}
                data-hands={String(count)}
              >
                {count === 1 ? '1' : `${count}x`}
              </Button>
            ))}
          </div>
        )}
        <div className="bet-select__chips" role="group" aria-label="Chips">
          {CHIP_CHOICES.map(chips => (
            <Button
              key={chips}
              className="tile tile--chips"
              disabled={chips > most}
              onClick={() => pick(chips, chips * chipValue)}
              data-chips={String(chips)}
            >
              {String(chips)}
            </Button>
          ))}
        </div>
        <Button block onClick={custom} data-action="custom">
          Custom Bet
        </Button>
        <p className="note">{`One chip is $${chipValue}. Chips x spots may not exceed ${MAX_CHIPS}.`}</p>
      </div>
    </StandardScreen>
  );
}

export const betSelectScreen = reactScreen(BetSelect, { className: 'bet-select' });
