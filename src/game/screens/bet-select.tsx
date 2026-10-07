// The detailed bet picker ("Allowed Bets"): a row
// of spot counts and a grid of chip counts, plus a custom amount.

import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useApp } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { Note } from '@/components/ui/text';
import { Tile } from '@/components/ui/tile';
import { Column, ScreenLayout } from '@/components/screen-layout';
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

  return (
    <ScreenLayout title={heading} help="game.betSelect">
      <Column>
        <Note>{HELP_TEXT}</Note>
        {!sideBet && (
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Spots">
            {HAND_CHOICES.map(count => (
              <Tile
                key={count}
                kind="hands"
                on={count === hands}
                aria-pressed={count === hands}
                onClick={() => setHands(count)}
                data-hands={String(count)}
              >
                {count === 1 ? '1' : `${count}x`}
              </Tile>
            ))}
          </div>
        )}
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Chips">
          {CHIP_CHOICES.map(chips => (
            <Tile
              key={chips}
              kind="chips"
              disabled={chips > most}
              onClick={() => pick(chips, chips * chipValue)}
              data-chips={String(chips)}
            >
              {String(chips)}
            </Tile>
          ))}
        </div>
        <Button block onClick={custom} data-action="custom">
          Custom Bet
        </Button>
        <Note>{`One chip is $${chipValue}. Chips x spots may not exceed ${MAX_CHIPS}.`}</Note>
      </Column>
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
