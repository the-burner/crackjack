// The frame of a drill play screen: the felt, a title bar (Back, Help), the
// drill's display area with the "2, 1" countdown over it, the message line,
// the stats panel and the Pause / Restart buttons. The drill adds its answer
// area as children. The run itself is the drill's `DrillShell`.

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { ChevronLeftIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { useApp } from '@/react/app-context';
import { useOnHide, useOnShow } from '@/react/screen';
import type { DrillShell } from '@/drills/shared/drill-shell';
import { DrillStats } from './drill-stats';

/**
 * How the parts sit: `grid` (Depth, Count) gives the display half the height
 * and the answer grid the rest; `flash` gives the cards what the buttons
 * leave; `full` puts the table on top, stats and grid side by side below.
 * Except in `full`, landscape puts the display on the left, the rest right.
 */
export type DrillLayout = 'grid' | 'flash' | 'full';

const SIDE = 'landscape:col-start-2';

const LAYOUTS: Record<DrillLayout, Record<'body' | 'display' | 'message' | 'stats' | 'controls', string>> = {
  grid: {
    body: 'flex flex-col landscape:grid landscape:grid-cols-2 landscape:grid-rows-[repeat(5,min-content)_1fr] landscape:gap-x-2 gap-y-1.5',
    display: 'flex-[0_0_50%] landscape:col-start-1 landscape:row-[1/-1]',
    message: SIDE,
    stats: SIDE,
    controls: SIDE,
  },
  flash: {
    body: 'flex flex-col landscape:grid landscape:grid-cols-2 landscape:grid-rows-[repeat(5,min-content)_1fr] landscape:gap-x-2 gap-y-1.5',
    display:
      'min-h-[140px] flex-1 landscape:col-start-1 landscape:row-[1/-1] [@media(orientation:landscape)_and_(max-height:400px)]:min-h-[90px]',
    message: SIDE,
    stats: SIDE,
    controls: SIDE,
  },
  full: {
    body: 'grid grid-cols-2 grid-rows-[1fr_min-content_min-content_min-content] gap-x-2 gap-y-1',
    display: 'col-span-full row-start-1',
    message: 'col-start-1 row-start-2',
    stats: 'col-start-1 row-start-3',
    controls: 'col-start-1 row-start-4 self-start',
  },
};

/** Where an answer area sits in each layout. */
export const ANSWER_AREA: Record<DrillLayout, string> = {
  grid: 'min-h-[120px] flex-[1_1_0] landscape:col-start-2',
  flash: 'landscape:col-start-2',
  full: 'col-start-2 row-[2/-1]',
};

export type DrillScreenProps = {
  shell: DrillShell;
  title: string;
  /** Help topic. */
  help: string;
  layout: DrillLayout;
  /** The drill's own area; its size is the canvases'. */
  displayRef: RefObject<HTMLDivElement | null>;
  /** The whole screen, for drills that care about its shape. */
  rootRef?: RefObject<HTMLDivElement | null>;
  /** Called when the display area changes size. */
  onLayout: () => void;
  /** What goes in the display area (canvases, panels). */
  display: ReactNode;
  /** Buttons after Restart. */
  controls?: ReactNode;
  /** Over the whole screen below the title bar. */
  cover?: ReactNode;
  /** The answer area. */
  children?: ReactNode;
};

export function DrillScreen({
  shell,
  title,
  help,
  layout,
  displayRef,
  rootRef,
  onLayout,
  display,
  controls,
  cover,
  children,
}: DrillScreenProps) {
  const app = useApp();
  const view = useSyncExternalStore(shell.subscribe, shell.getSnapshot);
  const parts = LAYOUTS[layout];

  const releaseWakeLock = useRef<(() => void) | null>(null);
  useOnShow(() => {
    releaseWakeLock.current ??= app.wakeLock.hold();
    shell.show();
  });
  useOnHide(() => {
    releaseWakeLock.current?.();
    releaseWakeLock.current = null;
    shell.hide();
  });
  useEffect(() => () => shell.destroy(), [shell]);

  useLayoutEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onLayout());
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayRef, onLayout]);

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col bg-(--felt) text-(--felt-text)">
      <header className="relative z-6 grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-1">
        <div>
          <FeltButton onClick={() => app.back()} data-action="back">
            <ChevronLeftIcon />
            Back
          </FeltButton>
        </div>
        <h1 className="truncate text-base font-semibold">{title}</h1>
        <div className="flex justify-end">
          <FeltButton onClick={() => app.help(help, title)} data-action="help">
            Help
          </FeltButton>
        </div>
      </header>
      <div className={cn('min-h-0 flex-1 px-1 pb-1.5', parts.body)}>
        <div ref={displayRef} data-slot="drill-display" className={cn('relative min-h-0', parts.display)}>
          {display}
          {view.countdown !== null && (
            <div
              role="timer"
              aria-label="Countdown"
              className="pointer-events-none absolute inset-0 z-5 flex items-center justify-center text-[120px] leading-none font-semibold text-(--felt-text)"
            >
              {view.countdown}
            </div>
          )}
        </div>
        <p role="status" className={cn('min-h-5 text-center font-semibold text-(--felt-accent)', parts.message)}>
          {view.message}
        </p>
        <DrillStats stats={view.stats} className={parts.stats} />
        <div className={cn('flex gap-2', parts.controls)}>
          {view.pausable && (
            <Button
              variant="secondary"
              className="h-11 flex-1"
              disabled={view.pauseDisabled}
              onClick={() => shell.togglePause()}
            >
              {view.pauseLabel === 'Pause' ? <PauseIcon /> : <PlayIcon />}
              {view.pauseLabel}
            </Button>
          )}
          <Button variant="secondary" className="h-11 flex-1" onClick={() => shell.restart()}>
            <RotateCcwIcon />
            Restart
          </Button>
          {controls}
        </div>
        {children}
      </div>
      {cover}
    </div>
  );
}

/** A title-bar button on the felt. */
function FeltButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-10 text-[17px] font-normal text-(--felt-text) hover:bg-transparent active:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/** A canvas answer grid that fills its box; the canvas is out of the flow, so its size never feeds back. */
export function AnswerGridArea({
  wrapRef,
  canvasRef,
  className,
  hidden,
  ...props
}: {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
} & Omit<ComponentProps<'canvas'>, 'ref'>) {
  return (
    <div ref={wrapRef} data-slot="answer-grid" className={cn('relative min-h-0 w-full', className)} hidden={hidden}>
      <canvas ref={canvasRef} role="img" aria-label="Answer grid" className="absolute inset-0 block" {...props} />
    </div>
  );
}
