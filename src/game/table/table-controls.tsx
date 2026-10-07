// The table's buttons: the plays down the sides of the felt, Insure and Pass
// while insurance is offered, and the bar above the felt.

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChartColumnIcon,
  ChevronLeftIcon,
  InfoIcon,
  XIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACTION } from '@/game/engine/game';
import type { GameAction } from '@/game/engine/game';
import type { ControlsView } from './controller';

/** The icons hint at the swipe for each play. */
const ACTION_BUTTONS: [action: GameAction, label: string, Icon: LucideIcon, side: 'left' | 'right'][] = [
  [ACTION.stand, 'Stand', ArrowLeftIcon, 'left'],
  [ACTION.hit, 'Hit', ArrowDownIcon, 'left'],
  [ACTION.double, 'Double', ArrowUpIcon, 'right'],
  [ACTION.split, 'Split', ArrowRightIcon, 'right'],
  [ACTION.surrender, 'Surrender', XIcon, 'right'],
];

const PLAY_BUTTON =
  'h-auto min-h-[46px] w-[140px] text-sm max-[420px]:min-h-[42px] max-[420px]:w-[118px] max-[420px]:text-[13px]';

function PlayButton({
  label,
  Icon,
  action,
  onClick,
  hidden,
  disabled,
}: {
  label: string;
  Icon: LucideIcon;
  action: string;
  onClick: () => void;
  hidden: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      size="lg"
      className={PLAY_BUTTON}
      onClick={onClick}
      hidden={hidden}
      disabled={disabled}
      data-action={action}
    >
      {label}
      <Icon data-icon="inline-end" />
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
    ACTION_BUTTONS.filter(([, , , at]) => at === which).map(([action, label, Icon]) => (
      <PlayButton
        key={action}
        label={label}
        Icon={Icon}
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
          Icon={ArrowDownIcon}
          action="insure"
          onClick={() => onInsurance(true)}
          hidden={hidden || !offering}
          disabled={!canInsure}
        />
        <PlayButton
          label="Pass"
          Icon={ArrowLeftIcon}
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

const BAR_BUTTON =
  'h-10 px-2 text-[17px] font-normal text-(--bar-text) hover:bg-transparent hover:text-(--bar-text) active:opacity-50 pointer-events-auto';

/** The bar above the felt: Back, and the Stats, Error and Help buttons. In landscape it floats over the felt. */
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
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-0.5 bg-(--table-strip) px-2 py-0.5 landscape:pointer-events-none landscape:absolute landscape:inset-x-0 landscape:top-0 landscape:z-[9] landscape:bg-transparent">
      <Button variant="ghost" className={BAR_BUTTON} onClick={onBack} data-action="back">
        <ChevronLeftIcon data-icon="inline-start" />
        Back
      </Button>
      <div className="flex gap-0.5">
        <Button variant="ghost" className={BAR_BUTTON} onClick={onStats} data-action="stats">
          Stats
          <ChartColumnIcon data-icon="inline-end" />
        </Button>
        <Button variant="ghost" className={BAR_BUTTON} onClick={onError} data-action="error">
          Error
          <InfoIcon data-icon="inline-end" />
        </Button>
        <Button variant="ghost" className={BAR_BUTTON} onClick={onHelp} data-action="help">
          Help
        </Button>
      </div>
    </header>
  );
}
