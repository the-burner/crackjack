// The table's buttons: the plays down the sides of the felt, Insure and Pass
// while insurance is offered, and the bar above the felt.

import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import { BarButton } from '@/components/ui/top-bar';
import { ACTION } from '@/game/engine/game';
import type { GameAction } from '@/game/engine/game';
import type { ControlsView } from './controller';

/** The icons hint at the swipe for each play. */
const ACTION_BUTTONS: [action: GameAction, label: string, icon: IconName, side: 'left' | 'right'][] = [
  [ACTION.stand, 'Stand', 'arrow-l', 'left'],
  [ACTION.hit, 'Hit', 'arrow-d', 'left'],
  [ACTION.double, 'Double', 'arrow-u', 'right'],
  [ACTION.split, 'Split', 'arrow-r', 'right'],
  [ACTION.surrender, 'Surrender', 'delete', 'right'],
];

const PLAY_BUTTON =
  'min-h-[46px] w-[140px] text-[14px] max-[420px]:min-h-[42px] max-[420px]:w-[118px] max-[420px]:text-caption';

function PlayButton({
  label,
  icon,
  action,
  onClick,
  hidden,
  disabled,
}: {
  label: string;
  icon: IconName;
  action: string;
  onClick: () => void;
  hidden: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      icon={icon}
      className={PLAY_BUTTON}
      onClick={onClick}
      hidden={hidden}
      disabled={disabled}
      data-action={action}
    >
      {label}
    </Button>
  );
}

/** The two stacks of play buttons at the felt's bottom corners. */
export function TableActions({
  controls: { hidden, busy, actions, insurance, canInsure },
  onAction,
  onInsurance,
}: {
  controls: ControlsView;
  onAction: (action: GameAction) => void;
  /** True to take insurance, false to pass. */
  onInsurance: (take: boolean) => void;
}) {
  const offering = !busy && insurance;
  // Every button stays in place, shown or hidden, as the plays come and go.
  const side = (which: 'left' | 'right') =>
    ACTION_BUTTONS.filter(([, , , at]) => at === which).map(([action, label, icon]) => (
      <PlayButton
        key={action}
        label={label}
        icon={icon}
        action={action}
        onClick={() => onAction(action)}
        hidden={hidden || busy || !actions[action]}
      />
    ));
  const stack = 'absolute bottom-1 z-[7] flex flex-col-reverse gap-1.5';
  return (
    <>
      <div className={`${stack} left-0.5 items-start`} role="group" aria-label="Plays" data-testid="table-actions">
        {side('left')}
        <PlayButton
          label="Insure"
          icon="arrow-d"
          action="insure"
          onClick={() => onInsurance(true)}
          hidden={hidden || !offering}
          disabled={!canInsure}
        />
        <PlayButton
          label="Pass"
          icon="arrow-l"
          action="pass"
          onClick={() => onInsurance(false)}
          hidden={hidden || !offering}
        />
      </div>
      <div className={`${stack} right-0.5 items-end`} role="group" aria-label="More plays" data-testid="table-actions">
        {side('right')}
      </div>
    </>
  );
}

/** The bar floats over the felt, so only its buttons take taps. */
const BAR_BUTTON = 'pointer-events-auto';

/** The bar over the top of the felt, inside the safe area: Back, and the Stats, Error and Help buttons. */
export function TableBar({
  onBack,
  onStats,
  onError,
  onHelp,
}: {
  onBack: () => void;
  onStats: () => void;
  onError: () => void;
  onHelp: () => void;
}) {
  return (
    <header className="pointer-events-none absolute top-(--safe-top) right-[calc(var(--safe-right)+0.5rem)] left-[calc(var(--safe-left)+0.5rem)] z-[9] flex min-h-12 items-center justify-between gap-0.5 py-0.5">
      <BarButton back className={BAR_BUTTON} onClick={onBack} data-action="back">
        Back
      </BarButton>
      <div className="flex gap-0.5">
        <BarButton icon="grid" className={BAR_BUTTON} onClick={onStats} data-action="stats">
          Stats
        </BarButton>
        <BarButton icon="info" className={BAR_BUTTON} onClick={onError} data-action="error">
          Error
        </BarButton>
        <BarButton className={BAR_BUTTON} onClick={onHelp} data-action="help">
          Help
        </BarButton>
      </div>
    </header>
  );
}
