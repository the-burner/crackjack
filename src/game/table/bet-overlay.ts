// The betting overlay shown between rounds: a dark
// panel over the felt with one tile per bet the player's ramp allows, and the
// side buttons for side bets, the bet editor, shuffling, the bankroll, a Foul
// claim and the last strategy error.

import { h } from '@/ui/dom';
import { button } from '@/ui/components';
import { cssVar } from '@/ui/theme';
import { betCells, gridGeometry, cellIndexAt, drawTile, TILE, TILE_GAP, COLUMNS, ROWS } from './bet-grid';
import type { BetCell, GridGeometry } from './bet-grid';
import { setupCanvas } from '@/ui/card-sprites';
import { money } from '@/core/money';
import type { Ramp } from '@/settings/bet-ramp';

const MIN_TILE_HEIGHT = 38;
const MAX_TILE_HEIGHT = 62;

export interface BetOverlayHandlers {
  onBet: (bet: BetCell) => void;
  /** Open the side-bet picker. */
  onSideBet: () => void;
  sideBetsAvailable: () => boolean;
  /** No side bet is configured. */
  onNoSideBet?: () => void;
  onCustomize: () => void;
  onShuffle: () => void;
  onResetBank: () => void;
  onFoul: () => void;
  onLastError: () => void;
}

/** Where the tiles come from: a betting.ramp value and the chip value. */
interface BetSource {
  ramp: Ramp;
  chipValue: number;
}

export type BetOverlay = ReturnType<typeof createBetOverlay>;

export function createBetOverlay(handlers: BetOverlayHandlers) {
  let source: BetSource = { ramp: { minCount: 0, rows: [{ chips: 1, hands: 1 }] }, chipValue: 1 };
  let cells: BetCell[] = [];
  let previousLabel: string | null = null;
  let heading = 'Place your bets.';
  let foulOffered = false;
  /** Label of the side bet chosen for the next round, if any. */
  let sideBetLabel = '';
  /** A one-off message shown instead of the heading. */
  let message = '';
  let geometry: GridGeometry | null = null;

  const title = h('div', { class: 'bet-overlay__title' });
  const canvas = h('canvas', { class: 'bet-overlay__grid' });
  const tile = (label: string, icon: string, onClick: () => void, action: string) =>
    button(label, { variant: 'nav', icon, onClick, 'data-action': action });
  const foulButton = tile('Foul', 'minus', handlers.onFoul, 'foul');
  const buttons = h(
    'div',
    { class: 'bet-overlay__buttons' },
    tile('Side Bet', 'plus', sideBet, 'side-bet'),
    tile('Reset Bank', 'refresh', handlers.onResetBank, 'reset-bank'),
    tile('Shuffle', 'arrow-r', handlers.onShuffle, 'shuffle'),
    tile('Customize', 'grid', handlers.onCustomize, 'customize'),
    tile('Last Error', 'info', handlers.onLastError, 'last-error'),
    foulButton,
  );
  const el = h('div', { class: 'bet-overlay', hidden: true }, title, canvas, buttons);

  function sideBet() {
    if (!handlers.sideBetsAvailable()) {
      handlers.onNoSideBet?.();
      return;
    }
    handlers.onSideBet();
  }

  /**
   * The heading to show: a transient message if there is one, otherwise the
   * standing heading plus the side bet waiting for the next round.
   */
  function titleText() {
    if (message) return message;
    return sideBetLabel ? `${heading} · ${sideBetLabel}` : heading;
  }

  /** Pixels the tiles are shifted right so the grid is centred. */
  let offsetX = 0;

  /** Lays the tiles out for the panel's inner width and draws them. */
  function draw() {
    // The tiles are inset by TILE_GAP inside their cells, so the canvas reaches
    // that far into the panel's padding (see .bet-overlay__grid) and the tile
    // edges line up with the buttons below.
    const style = getComputedStyle(el);
    const inner = (el.clientWidth || 320) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const width = Math.max(140, Math.floor(inner) + 2 * TILE_GAP);
    const tileWidth = Math.floor((width - 1) / COLUMNS);
    const tileHeight = Math.min(MAX_TILE_HEIGHT, Math.max(MIN_TILE_HEIGHT, Math.round(tileWidth * 0.85)));
    geometry = gridGeometry({ width, height: tileHeight * ROWS, count: cells.length });
    const height = geometry.rows * tileHeight + 1;
    const ctx = setupCanvas(canvas, width, height);
    ctx.clearRect(0, 0, width, height);
    offsetX = Math.floor((width - 1 - tileWidth * COLUMNS) / 2);
    ctx.translate(offsetX, 0);
    const font = `600 ${width < 420 ? 15 : 20}px ${cssVar('--font', 'sans-serif')}`;
    geometry.rects.forEach((rect, i) => {
      const highlight = previousLabel !== null && cells[i].label === previousLabel;
      drawTile(ctx, { ...rect, label: cells[i].label, color: highlight ? TILE.previous : TILE.normal, font });
    });
    title.textContent = titleText();
    foulButton.hidden = !foulOffered;
  }

  canvas.addEventListener('click', event => {
    if (!geometry) return;
    const box = canvas.getBoundingClientRect();
    const index = cellIndexAt({ x: event.clientX - box.left - offsetX, y: event.clientY - box.top }, geometry);
    if (index < 0 || index >= cells.length) return;
    handlers.onBet(cells[index]);
  });

  return {
    el,

    get visible() {
      return !el.hidden;
    },

    /**
     * Shows the overlay between rounds.
     * @param previous  Label of the last bet, highlighted.
     * @param change  Won or lost since the last round.
     * @param foul  Whether a Foul claim is possible.
     */
    show({
      ramp,
      chipValue,
      previous = null,
      change = 0,
      foul = false,
    }: BetSource & { previous?: string | null; change?: number; foul?: boolean }) {
      source = { ramp, chipValue };
      cells = betCells(source);
      previousLabel = previous;
      foulOffered = foul;
      heading = 'Place your bets.';
      if (change > 0) heading += ` You won ${money(change)}`;
      if (change < 0) heading += ` You lost ${money(-change)}`;
      message = '';
      el.hidden = false;
      draw();
    },

    /** Rebuilds the tiles from a changed ramp or chip value. */
    setSource({ ramp, chipValue }: BetSource) {
      source = { ramp, chipValue };
      cells = betCells(source);
      if (!el.hidden) draw();
    },

    /** Shows a message in place of the heading (a rejected bet, a Foul result). */
    setMessage(text: string) {
      message = text;
      title.textContent = titleText();
    },

    /** Notes the side bet waiting for the next round, so redraws keep showing it. */
    setSideBet(label: string) {
      sideBetLabel = label;
      message = '';
      title.textContent = titleText();
    },

    hide() {
      el.hidden = true;
    },

    /** Re-lays the tiles after the table has been resized. */
    layout() {
      if (!el.hidden) draw();
    },
  };
}
