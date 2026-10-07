// The betting overlay shown between rounds: a dark
// panel over the felt with one tile per bet the player's ramp allows, and the
// side buttons for side bets, the bet editor, shuffling, the bankroll, a Foul
// claim and the last strategy error.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { cssVar } from '../../ui/theme.js';
import { betCells, gridGeometry, cellIndexAt, drawTile, TILE, TILE_GAP, COLUMNS, ROWS } from './bet-grid.js';
import { setupCanvas } from '../../ui/card-sprites.js';

const MIN_TILE_HEIGHT = 38;
const MAX_TILE_HEIGHT = 62;

/**
 * @param {object} handlers
 * @param {(bet: {amount: number, hands: number, label: string}) => void} handlers.onBet
 * @param {() => void} handlers.onSideBet          Open the side-bet picker.
 * @param {() => boolean} handlers.sideBetsAvailable
 * @param {() => void} [handlers.onNoSideBet]      No side bet is configured.
 * @param {() => void} handlers.onCustomize
 * @param {() => void} handlers.onShuffle
 * @param {() => void} handlers.onResetBank
 * @param {() => void} handlers.onFoul
 * @param {() => void} handlers.onLastError
 */
export function createBetOverlay(handlers) {
  let source = { ramp: { minCount: 0, rows: [{ chips: 1, hands: 1 }] }, chipValue: 1 };
  let cells = [];
  let previousLabel = null;
  let heading = 'Place your bets.';
  let foulOffered = false;
  /** Label of the side bet chosen for the next round, if any. */
  let sideBetLabel = '';
  /** A one-off message shown instead of the heading. */
  let message = '';
  let geometry = null;

  const title = h('div', { class: 'bet-overlay__title' });
  const canvas = h('canvas', { class: 'bet-overlay__grid' });
  const tile = (label, icon, onClick, action) => button(label, { variant: 'nav', icon, onClick, 'data-action': action });
  const foulButton = tile('Foul', 'minus', handlers.onFoul, 'foul');
  const buttons = h('div', { class: 'bet-overlay__buttons' },
    tile('Side Bet', 'plus', sideBet, 'side-bet'),
    tile('Reset Bank', 'refresh', handlers.onResetBank, 'reset-bank'),
    tile('Shuffle', 'arrow-r', handlers.onShuffle, 'shuffle'),
    tile('Customize', 'grid', handlers.onCustomize, 'customize'),
    tile('Last Error', 'info', handlers.onLastError, 'last-error'),
    foulButton);
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
     * @param {object} o
     * @param {object} o.ramp             A betting.ramp value.
     * @param {number} o.chipValue
     * @param {string|null} [o.previous]  Label of the last bet, highlighted.
     * @param {number} [o.change]         Won or lost since the last round.
     * @param {boolean} [o.foul]          Whether a Foul claim is possible.
     */
    show({ ramp, chipValue, previous = null, change = 0, foul = false }) {
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

    /** Shows a message in place of the heading (a rejected bet, a Foul result). */
    setMessage(text) {
      message = text;
      title.textContent = titleText();
    },

    /** Notes the side bet waiting for the next round, so redraws keep showing it. */
    setSideBet(label) {
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

const money = amount => `$${Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2)}`;
