// The detailed bet picker ("Allowed Bets"): a row
// of spot counts and a grid of chip counts, plus a custom amount.

import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useApp } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { ScreenLayout } from '@/components/screen-layout';
import { promptNumber } from '@/components/dialogs';
import { CHIP_CHOICES, HAND_CHOICES, MAX_CHIPS, maxChipsForHands } from '@/settings/bet-ramp';
import { useGoBack } from '@/app/navigation';
import { useTableContext } from '@/game/screens/table-screen';

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
  const goBack = useGoBack();
  const chipValue = chipParam ?? app.settings.get('betting.chipValue');
  const sideBet = mode === 'sideBet';
  const heading = title ?? (sideBet ? 'Side Bet' : 'Allowed Bets');
  const [hands, setHands] = useState(() => Math.min(Math.max(1, initialHands), HAND_CHOICES.length));
  const most = maxChipsForHands(hands);

  function pick(chips: number, amount: number) {
    const moved = onPick?.({ chips, hands: sideBet ? 1 : hands, amount });
    if (moved !== true) goBack();
  }

  async function custom() {
    const amount = await promptNumber('Amount to bet', chipValue, { min: 0, max: MAX_CHIPS * chipValue });
    if (amount === null) return;
    pick(amount / chipValue, amount);
  }

  const tile = 'h-11 text-base tabular-nums';
  return (
    <ScreenLayout title={heading} help="game.betSelect">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{HELP_TEXT}</p>
        {!sideBet && (
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Spots">
            {HAND_CHOICES.map(count => (
              <Button
                key={count}
                variant={count === hands ? 'default' : 'outline'}
                className={tile}
                aria-pressed={count === hands}
                onClick={() => setHands(count)}
                data-hands={String(count)}
              >
                {count === 1 ? '1' : `${count}x`}
              </Button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Chips">
          {CHIP_CHOICES.map(chips => (
            <Button
              key={chips}
              variant="secondary"
              className={tile}
              disabled={chips > most}
              onClick={() => pick(chips, chips * chipValue)}
              data-chips={String(chips)}
            >
              {String(chips)}
            </Button>
          ))}
        </div>
        <Button variant="secondary" size="lg" onClick={custom} data-action="custom">
          Custom Bet
        </Button>
        <p className="text-center text-sm text-muted-foreground">{`One chip is $${chipValue}. Chips x spots may not exceed ${MAX_CHIPS}.`}</p>
      </div>
    </ScreenLayout>
  );
}

/** A side-bet picker over the table (`side-bet/:spot`). */
export function SideBetRoute() {
  const { spot } = useParams();
  const params = useTableContext().sideBetParams(Number(spot));
  // A reload or a stale link has no picker to show: back to the table.
  return params ? <BetSelect params={params} /> : <Navigate to="../.." relative="path" replace />;
}
