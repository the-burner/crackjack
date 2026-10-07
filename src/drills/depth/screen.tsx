// Depth drills: a photo of a discard tray, and a grid of depths to pick from.

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/react/app-context';
import { ANSWER_AREA, AnswerGridArea, DrillScreen } from '@/components/drills/drill-screen';
import { createDepthDrill } from './controller';

export function DepthDrill() {
  const app = useApp();
  const [drill] = useState(() => createDepthDrill(app));
  const view = useSyncExternalStore(drill.subscribe, drill.getSnapshot);
  const display = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const gridCanvas = useRef<HTMLCanvasElement>(null);
  const gridWrap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!display.current || !tray.current || !panel.current || !gridCanvas.current || !gridWrap.current) return;
    return drill.attach({
      display: display.current,
      tray: tray.current,
      panel: panel.current,
      gridCanvas: gridCanvas.current,
      gridWrap: gridWrap.current,
    });
  }, [drill]);
  // Every change re-renders, then the canvases are drawn to match.
  useLayoutEffect(() => drill.draw());

  return (
    <DrillScreen
      shell={drill.shell}
      title="Depth Drills"
      help="drills.depth"
      layout="grid"
      displayRef={display}
      onLayout={drill.draw}
      display={
        <>
          <canvas ref={tray} role="img" aria-label="Discard tray" className="absolute inset-0 block" />
          <div
            ref={panel}
            className="pointer-events-none absolute inset-x-0 top-0 text-center text-[16px] leading-[normal] font-semibold text-(--felt-text)"
          >
            {view.panel}
          </div>
        </>
      }
    >
      <AnswerGridArea wrapRef={gridWrap} canvasRef={gridCanvas} className={ANSWER_AREA.grid} onClick={drill.tap} />
    </DrillScreen>
  );
}
