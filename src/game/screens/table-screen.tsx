// The playing table: the felt canvas with its labels, the play buttons and the
// betting overlay. The play itself is the table controller's; this only shows
// its snapshot and passes input on.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { confirm } from '@/components/dialogs';
import { TableToaster, tableToast } from '@/components/game/table-toast';
import { useApp } from '@/react/app-context';
import { useOnHide, useOnShow } from '@/react/screen';
import { createTableController } from '@/game/table/controller';
import { TableActions, TableBar } from '@/game/table/table-controls';
import { BetOverlay } from '@/game/table/bet-overlay';
import { Bankroll, Counts, SeatChip } from '@/game/table/felt-labels';

export function TableScreen() {
  const app = useApp();
  const [table] = useState(() =>
    createTableController(app, { notify: tableToast, confirm: message => confirm(message) }),
  );
  const view = useSyncExternalStore(table.subscribe, table.getSnapshot);
  const felt = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (felt.current && canvas.current) table.attach(felt.current, canvas.current);
    return () => table.destroy();
  }, [table]);
  useOnShow(() => table.onShow());
  useOnHide(() => table.onHide());

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--table-bg)">
      <TableBar onBack={table.back} onStats={table.openStats} onError={table.openLastError} onHelp={table.help} />
      <div ref={felt} className="relative min-h-0 flex-1 touch-none overflow-hidden" data-testid="felt">
        <canvas
          ref={canvas}
          className="absolute top-0 left-0"
          data-testid="table-canvas"
          aria-label="Table"
          role="img"
        />
        <Bankroll box={view.layout?.bankroll} amount={view.bankroll} />
        <Counts box={view.layout?.status} text={view.counts} />
        {view.seats.map(seat => (
          <SeatChip key={seat.seat} {...seat} />
        ))}
        <TableActions controls={view.controls} onAction={table.play} onInsurance={table.answerInsurance} />
        <BetOverlay
          view={view.overlay}
          layout={view.layout}
          onBet={table.placeBet}
          onSideBet={table.chooseSideBet}
          onCustomize={table.customize}
          onShuffle={table.shuffleNow}
          onResetBank={table.resetBank}
          onFoul={table.claimDealerError}
          onLastError={table.openLastError}
        />
      </div>
      <TableToaster />
    </div>
  );
}
