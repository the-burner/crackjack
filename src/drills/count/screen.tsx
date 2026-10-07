// Count drills: cards are flashed, then a discard tray and a grid of counts.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StepForwardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/react/app-context';
import { reactScreen } from '@/react/screen';
import { ANSWER_AREA, AnswerGridArea, DrillScreen } from '@/components/drills/drill-screen';
import { createCountDrill } from './controller';

export function CountDrill() {
  const app = useApp();
  const [drill] = useState(() => createCountDrill(app));
  const view = useSyncExternalStore(drill.subscribe, drill.getSnapshot);
  const display = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gridCanvas = useRef<HTMLCanvasElement>(null);
  const gridWrap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!display.current || !canvas.current || !gridCanvas.current || !gridWrap.current) return;
    return drill.attach({
      display: display.current,
      canvas: canvas.current,
      gridCanvas: gridCanvas.current,
      gridWrap: gridWrap.current,
    });
  }, [drill]);
  // Every change re-renders, then the canvases are drawn to match.
  useLayoutEffect(() => drill.draw());

  return (
    <DrillScreen
      shell={drill.shell}
      title="Count Drills"
      help="drills.count"
      layout="grid"
      displayRef={display}
      onLayout={drill.draw}
      display={
        <canvas
          ref={canvas}
          role="img"
          aria-label="Cards"
          className="absolute inset-0 block"
          onClick={drill.tapCards}
        />
      }
      controls={
        <Button variant="secondary" className="h-11 flex-1" hidden={!view.nextShown} onClick={drill.next}>
          <StepForwardIcon />
          Next
        </Button>
      }
    >
      <AnswerGridArea
        wrapRef={gridWrap}
        canvasRef={gridCanvas}
        className={ANSWER_AREA.grid}
        hidden={!view.gridShown}
        onClick={drill.tap}
      />
    </DrillScreen>
  );
}

export const countScreen = reactScreen(CountDrill, { className: 'bg-(--felt)' });
