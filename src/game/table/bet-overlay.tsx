// The betting overlay shown between rounds: a dark panel over the felt with one
// tile per bet the player's ramp allows (drawn on a canvas), and the buttons for
// side bets, the bet editor, shuffling, the bankroll, a Foul claim and the last
// strategy error.

import { useLayoutEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import { cssVar } from '@/lib/theme';
import { setupCanvas } from '@/lib/card-sprites';
import { gridGeometry, cellIndexAt, drawTile, TILE, TILE_GAP, COLUMNS, ROWS } from './bet-grid';
import type { BetCell, GridGeometry } from './bet-grid';
import type { TableLayout } from './layout';
import type { BetOverlayView } from './controller';

const MIN_TILE_HEIGHT = 38;
const MAX_TILE_HEIGHT = 62;

export interface BetOverlayHandlers {
  onBet: (bet: BetCell) => void;
  onSideBet: () => void;
  onCustomize: () => void;
  onShuffle: () => void;
  onResetBank: () => void;
  onFoul: () => void;
  onLastError: () => void;
}

function OverlayButton({
  label,
  icon,
  action,
  onClick,
  hidden,
}: {
  label: string;
  icon: IconName;
  action: string;
  onClick: () => void;
  hidden?: boolean;
}) {
  return (
    <Button
      variant="nav"
      icon={icon}
      // Three a row; a shorter last row is centred.
      className="min-h-10 flex-[0_0_calc((100%-8px)/3)] py-1 pr-[26px] pl-1.5 text-caption [&>[data-slot=icon]]:right-2 [&>[data-slot=icon]]:size-3.5"
      onClick={onClick}
      hidden={hidden}
      data-action={action}
    >
      {label}
    </Button>
  );
}

/**
 * @param layout  The table's layout: the tiles are laid out again when it changes.
 */
export function BetOverlay({
  view: { visible, title, cells, previous, foul },
  layout,
  ...handlers
}: { view: BetOverlayView; layout: TableLayout | null } & BetOverlayHandlers) {
  const panel = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The tile layout drawn last, and how far it is shifted right to centre it. */
  const drawn = useRef<{ geometry: GridGeometry; offsetX: number } | null>(null);

  // Lays the tiles out for the panel's inner width and draws them.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!visible || !el || !canvas.current) return;
    // The tiles are inset by TILE_GAP inside their cells, so the canvas reaches
    // that far into the panel's padding and the tile edges line up with the
    // buttons below.
    const style = getComputedStyle(el);
    const inner = (el.clientWidth || 320) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const width = Math.max(140, Math.floor(inner) + 2 * TILE_GAP);
    const tileWidth = Math.floor((width - 1) / COLUMNS);
    const tileHeight = Math.min(MAX_TILE_HEIGHT, Math.max(MIN_TILE_HEIGHT, Math.round(tileWidth * 0.85)));
    const geometry = gridGeometry({ width, height: tileHeight * ROWS, count: cells.length });
    const height = geometry.rows * tileHeight + 1;
    const ctx = setupCanvas(canvas.current, width, height);
    ctx.clearRect(0, 0, width, height);
    const offsetX = Math.floor((width - 1 - tileWidth * COLUMNS) / 2);
    ctx.translate(offsetX, 0);
    const font = `600 ${width < 420 ? 15 : 20}px ${cssVar('--font', 'sans-serif')}`;
    geometry.rects.forEach((rect, i) => {
      const highlight = previous !== null && cells[i].label === previous;
      drawTile(ctx, { ...rect, label: cells[i].label, color: highlight ? TILE.previous : TILE.normal, font });
    });
    drawn.current = { geometry, offsetX };
  }, [visible, cells, previous, layout]);

  function tap(event: MouseEvent<HTMLCanvasElement>) {
    if (!drawn.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const { geometry, offsetX } = drawn.current;
    const index = cellIndexAt({ x: event.clientX - box.left - offsetX, y: event.clientY - box.top }, geometry);
    if (index < 0 || index >= cells.length) return;
    handlers.onBet(cells[index]);
  }

  return (
    <section
      ref={panel}
      hidden={!visible}
      aria-label="Bets"
      data-slot="bet-overlay"
      className="absolute bottom-1.5 left-1/2 z-10 w-[min(598px,calc(100%-8px))] -translate-x-1/2 rounded-(--radius) bg-(--bet-overlay-bg) p-1.5"
    >
      <h2 className="m-0 pt-0.5 pb-1 text-center text-title font-semibold text-(--felt-accent)">{title}</h2>
      <canvas ref={canvas} className="-mx-0.5 block" onClick={tap} data-testid="bet-grid" aria-hidden="true" />
      {/* The tiles, for keyboards and screen readers. */}
      <div role="group" aria-label="Bet amounts">
        {cells.map((cell, i) => (
          <button key={i} type="button" className="sr-only" onClick={() => handlers.onBet(cell)}>
            {`Bet ${cell.label}`}
          </button>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        <OverlayButton label="Side Bet" icon="plus" action="side-bet" onClick={handlers.onSideBet} />
        <OverlayButton label="Reset Bank" icon="refresh" action="reset-bank" onClick={handlers.onResetBank} />
        <OverlayButton label="Shuffle" icon="arrow-r" action="shuffle" onClick={handlers.onShuffle} />
        <OverlayButton label="Customize" icon="grid" action="customize" onClick={handlers.onCustomize} />
        <OverlayButton label="Last Error" icon="info" action="last-error" onClick={handlers.onLastError} />
        <OverlayButton label="Foul" icon="minus" action="foul" onClick={handlers.onFoul} hidden={!foul} />
      </div>
    </section>
  );
}
