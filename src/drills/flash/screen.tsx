// Flash drills: a hand and a count are flashed and the player picks the play.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, DeleteIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { useApp } from '@/react/app-context';
import { ANSWER_AREA, AnswerGridArea, DrillScreen } from '@/components/drills/drill-screen';
import { ACTION } from '@/core/strategy/advisor';
import type { Action } from '@/core/strategy/advisor';
import { createFlashDrill } from './controller';
import { useNavigate, useOutlet } from 'react-router';
import { tablesSearch } from '@/app/paths';

/** The answer buttons, in two rows, with their swipe hints. */
const ANSWER_BUTTONS: readonly (readonly { action: Action; label: string; Icon: LucideIcon }[])[] = [
  [
    { action: ACTION.double, label: 'Double', Icon: ArrowUpIcon },
    { action: ACTION.split, label: 'Split', Icon: ArrowRightIcon },
    { action: ACTION.surrender, label: 'Surrender', Icon: DeleteIcon },
  ],
  [
    { action: ACTION.hit, label: 'Hit', Icon: ArrowDownIcon },
    { action: ACTION.stand, label: 'Stand', Icon: ArrowLeftIcon },
  ],
];

/** The 2:1 index-test grid; a short landscape screen has no room for a fixed ratio, so it shrinks. */
const INDEX_GRID =
  'aspect-[2/1] max-h-full [@media(orientation:landscape)_and_(max-height:400px)]:aspect-auto [@media(orientation:landscape)_and_(max-height:400px)]:flex-[1_1_0]';

export function FlashDrill() {
  const app = useApp();
  const navigate = useNavigate();
  // The table opens over the drill (a child route), which stays as it is underneath.
  const [drill] = useState(() =>
    createFlashDrill(app, { openTable: params => void navigate(`table${tablesSearch(params)}`) }),
  );
  const above = useOutlet();
  const view = useSyncExternalStore(drill.subscribe, drill.getSnapshot);
  const display = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gridCanvas = useRef<HTMLCanvasElement>(null);
  const gridWrap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!display.current || !canvas.current) return;
    const grid = gridCanvas.current && gridWrap.current ? { canvas: gridCanvas.current, wrap: gridWrap.current } : null;
    return drill.attach({ display: display.current, canvas: canvas.current, grid });
  }, [drill]);
  // Every change re-renders, then the canvases are drawn to match.
  useLayoutEffect(() => drill.draw());

  return (
    <DrillScreen
      shell={drill.shell}
      above={above}
      title="Flash Drills"
      help="drills.flash"
      layout="flash"
      displayRef={display}
      onLayout={drill.draw}
      display={
        <>
          <canvas
            ref={canvas}
            role="img"
            aria-label="Cards"
            className="absolute inset-0 block"
            onPointerDown={drill.pointerDown}
            onPointerUp={drill.pointerUp}
          />
          {view.countPanel !== null && (
            <div
              data-slot="count-panel"
              className="pointer-events-none absolute right-0 bottom-0 flex h-12 w-[34%] items-center justify-center text-xl font-semibold text-(--felt-accent) tabular-nums"
            >
              {view.countPanel}
            </div>
          )}
        </>
      }
    >
      {view.indexTest && (
        <AnswerGridArea
          wrapRef={gridWrap}
          canvasRef={gridCanvas}
          className={cn(ANSWER_AREA.flash, INDEX_GRID)}
          onClick={drill.gridTap}
        />
      )}
      {view.buttonsShown && (
        <div className={cn('flex flex-col gap-1.5', ANSWER_AREA.flash)}>
          {ANSWER_BUTTONS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map(({ action, label, Icon }) => (
                <Button
                  key={action}
                  variant="secondary"
                  className="h-auto min-h-14 flex-1 flex-col gap-0.5 data-correct:text-(--answer-correct) data-correct:underline"
                  hidden={!view.visible[action]}
                  data-correct={view.correct === action || undefined}
                  onClick={() => drill.answer(action)}
                >
                  {label}
                  <Icon />
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}
    </DrillScreen>
  );
}
