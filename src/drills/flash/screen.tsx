// Flash drills: a hand and a count are flashed and the player picks the play.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import { useApp } from '@/react/app-context';
import { ANSWER_AREA, AnswerGridArea, DrillScreen } from '@/components/drills/drill-screen';
import { ACTION } from '@/core/strategy/advisor';
import type { Action } from '@/core/strategy/advisor';
import { createFlashDrill } from './controller';
import { useNavigate, useOutlet } from 'react-router';
import { tablesSearch } from '@/app/paths';

/** The answer buttons, in two rows, with their swipe hints. */
const ANSWER_BUTTONS: readonly (readonly { action: Action; label: string; icon: IconName }[])[] = [
  [
    { action: ACTION.double, label: 'Double', icon: 'arrow-u' },
    { action: ACTION.split, label: 'Split', icon: 'arrow-r' },
    { action: ACTION.surrender, label: 'Surrender', icon: 'delete' },
  ],
  [
    { action: ACTION.hit, label: 'Hit', icon: 'arrow-d' },
    { action: ACTION.stand, label: 'Stand', icon: 'arrow-l' },
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
              className="pointer-events-none absolute right-0 bottom-0 flex h-12 w-[34%] items-center justify-center text-[20px] leading-[normal] font-semibold text-(--felt-accent) tabular-nums"
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
              {row.map(({ action, label, icon }) => (
                <Button
                  key={action}
                  icon={icon}
                  iconPos="bottom"
                  className="min-h-14 flex-1 data-correct:text-(--answer-correct) data-correct:underline"
                  hidden={!view.visible[action]}
                  data-action={label.toLowerCase()}
                  data-correct={view.correct === action || undefined}
                  onClick={() => drill.answer(action)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}
    </DrillScreen>
  );
}
