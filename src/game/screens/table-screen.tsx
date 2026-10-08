// The playing table: the felt canvas with its labels, the play buttons and the
// betting overlay. The play itself is the table controller's; this only shows
// its snapshot and passes input on.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useOutlet, useOutletContext } from 'react-router';
import type { GameSession } from '@/game/session';
import type { BetSelectParams } from '@/game/screens/bet-select';
import { useOpenHelp } from '@/app/help';
import { useGoBack } from '@/app/navigation';
import { tablesSearch } from '@/app/paths';
import { confirm } from '@/components/dialogs';
import { tableToast } from '@/components/game/table-toast';
import { useApp } from '@/react/app-context';
import { useOnHide, useOnShow } from '@/react/screen';
import { createTableController } from '@/game/table/controller';
import { TableActions, TableBar } from '@/game/table/table-controls';
import { BetOverlay } from '@/game/table/bet-overlay';
import { Bankroll, Counts, SeatChip } from '@/game/table/felt-labels';

/** What the screens opened over the table (its child routes) read from it. */
export type TableOutletContext = {
  session: GameSession;
  sideBetParams: (index: number) => BetSelectParams | null;
};

export const useTableContext = () => useOutletContext<TableOutletContext>();

export function TableScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const openHelp = useOpenHelp();
  const [table] = useState(() =>
    createTableController(app, {
      notify: tableToast,
      confirm: message => confirm(message),
      // Child routes, so the table stays as it is underneath them.
      nav: {
        stats: () => void navigate('stats'),
        lastError: params => void navigate(`error${tablesSearch(params)}`),
        customize: () => void navigate('customize'),
        sideBet: (index, replace) => void navigate(`side-bet/${index}`, { replace }),
        back: () => goBack(),
        help: () => openHelp('game.table', 'Blackjack'),
      },
    }),
  );
  const view = useSyncExternalStore(table.subscribe, table.getSnapshot);
  // The table exists once it has its felt; the screens over it come after.
  const cover = useOutlet(
    view ? ({ session: table.session, sideBetParams: table.sideBetParams } satisfies TableOutletContext) : null,
  );
  const felt = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (felt.current && canvas.current) table.attach(felt.current, canvas.current);
    return () => table.destroy();
  }, [table]);
  useOnShow(() => table.onShow());
  // An effect, so StrictMode's rehearsal mount calls the opening off before it starts.
  useEffect(() => table.open(), [table]);
  useOnHide(() => table.onHide());

  return (
    // The felt and rail fill the window edge to edge; the table laid out on them
    // (the felt element) stays inside the safe area, below the bar in portrait.
    <div className="relative min-h-0 flex-1 overflow-hidden bg-(--table-bg)">
      <canvas ref={canvas} className="absolute top-0 left-0" data-testid="table-canvas" aria-label="Table" role="img" />
      <div
        ref={felt}
        className="absolute top-[calc(var(--safe-top)+3rem)] right-(--safe-right) bottom-(--safe-bottom) left-(--safe-left) touch-none overflow-hidden landscape:top-(--safe-top)"
        data-testid="felt"
      >
        {view && (
          <>
            <Bankroll box={view.layout?.bankroll} amount={view.bankroll} />
            <Counts box={view.layout?.status} text={view.counts} />
            {view.seats.map(seat => (
              <SeatChip key={seat.seat} {...seat} />
            ))}
            <TableActions controls={view.controls} onAction={table.play} onInsurance={table.answerInsurance} />
            <BetOverlay
              view={view.overlay}
              onBet={table.placeBet}
              onSideBet={table.chooseSideBet}
              onCustomize={table.customize}
              onShuffle={table.shuffleNow}
              onResetBank={table.resetBank}
              onFoul={table.claimDealerError}
              onLastError={table.openLastError}
            />
          </>
        )}
      </div>
      <TableBar onBack={table.back} onStats={table.openStats} onError={table.openLastError} onHelp={table.help} />
      {view && cover && <div className="absolute inset-0 z-20 flex flex-col bg-(--page-bg)">{cover}</div>}
    </div>
  );
}
