// The table's buttons: the plays down the sides of the felt, Insure
// and Pass while insurance is offered, and the bar above the felt.

import { h } from '../../ui/dom.ts';
import { button } from '../../ui/components.ts';
import { ACTION } from '../engine/game.ts';
import type { AvailableActions, GameAction } from '../engine/game.ts';

const ACTION_LABELS: [action: GameAction, label: string, icon: string, side: 'left' | 'right'][] = [
  [ACTION.stand, 'Stand', 'arrow-l', 'left'],
  [ACTION.hit, 'Hit', 'arrow-d', 'left'],
  [ACTION.double, 'Double', 'arrow-u', 'right'],
  [ACTION.split, 'Split', 'arrow-r', 'right'],
  [ACTION.surrender, 'Surrender', 'delete', 'right'],
];

export function createTableControls({
  onAction,
  onInsurance,
}: {
  onAction: (action: GameAction) => void;
  /** True to take insurance, false to pass. */
  onInsurance: (take: boolean) => void;
}) {
  const actionButtons = new Map<GameAction, HTMLButtonElement>();
  const sides = {
    left: h('div', { class: 'table__actions table__actions--left' }),
    right: h('div', { class: 'table__actions table__actions--right' }),
  };
  for (const [action, label, icon, side] of ACTION_LABELS) {
    const btn = button(label, { icon, onClick: () => onAction(action), hidden: true, 'data-action': action });
    actionButtons.set(action, btn);
    sides[side].append(btn);
  }
  const insureButton = button('Insure', {
    icon: 'arrow-d',
    onClick: () => onInsurance(true),
    hidden: true,
    'data-action': 'insure',
  });
  const passButton = button('Pass', {
    icon: 'arrow-l',
    onClick: () => onInsurance(false),
    hidden: true,
    'data-action': 'pass',
  });
  sides.left.append(insureButton, passButton);

  return {
    left: sides.left,
    right: sides.right,

    /**
     * Shows the buttons that apply.
     * @param hidden  The player plays by gesture (`display.hideActionButtons`).
     * @param busy  A timeline is playing.
     */
    update({
      hidden,
      busy,
      actions,
      insurance,
      canInsure,
    }: {
      hidden: boolean;
      busy: boolean;
      actions: AvailableActions;
      /** The insurance offer is up. */
      insurance: boolean;
      canInsure: boolean;
    }) {
      for (const [action, btn] of actionButtons) btn.hidden = hidden || busy || !actions[action];
      const offering = !busy && insurance;
      insureButton.disabled = !canInsure;
      insureButton.hidden = hidden || !offering;
      passButton.hidden = hidden || !offering;
    },
  };
}

/** The bar above the felt: Back, and the Stats, Error and Help buttons. */
export function createTableBar({
  onBack,
  onStats,
  onError,
  onHelp,
}: {
  onBack: () => void;
  onStats: () => void;
  onError: () => void;
  onHelp: () => void;
}): HTMLElement {
  return h(
    'header',
    { class: 'table__bar' },
    button('Back', { variant: 'nav', onClick: onBack, 'data-action': 'back' }),
    h(
      'div',
      { class: 'table__bar-end' },
      button('Stats', { variant: 'nav', icon: 'grid', onClick: onStats, 'data-action': 'stats' }),
      button('Error', { variant: 'nav', icon: 'info', onClick: onError, 'data-action': 'error' }),
      button('Help', { variant: 'nav', onClick: onHelp, 'data-action': 'help' }),
    ),
  );
}
