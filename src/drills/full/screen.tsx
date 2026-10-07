// Full table drills: a whole table of hands at once, then a count to give.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/react/app-context';
import { ANSWER_AREA, AnswerGridArea, DrillScreen } from '@/components/drills/drill-screen';
import { createFullDrill, ROTATE_MESSAGE } from './controller';

export function FullDrill() {
  const app = useApp();
  const [drill] = useState(() => createFullDrill(app));
  const view = useSyncExternalStore(drill.subscribe, drill.getSnapshot);
  const root = useRef<HTMLDivElement>(null);
  const display = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gridCanvas = useRef<HTMLCanvasElement>(null);
  const gridWrap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current || !display.current || !canvas.current || !gridCanvas.current || !gridWrap.current) return;
    return drill.attach({
      root: root.current,
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
      title="Full Table Drills"
      help="drills.full"
      layout="full"
      rootRef={root}
      displayRef={display}
      onLayout={drill.layout}
      display={<canvas ref={canvas} role="img" aria-label="Cards" className="absolute inset-0 block" />}
      cover={
        view.covered && (
          // Below the title bar, which stays usable.
          <div
            role="alert"
            className="absolute inset-0 z-5 flex items-center justify-center bg-(--felt) p-6 text-center text-[18px] leading-[normal] font-semibold text-(--felt-text)"
          >
            {ROTATE_MESSAGE}
          </div>
        )
      }
    >
      <AnswerGridArea
        wrapRef={gridWrap}
        canvasRef={gridCanvas}
        className={ANSWER_AREA.full}
        hidden={!view.gridShown}
        onClick={drill.tap}
      />
    </DrillScreen>
  );
}
