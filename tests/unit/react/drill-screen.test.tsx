import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Clicks are fired directly: user-event's own waits do not mix with fake timers.
import { act, fireEvent, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { DrillScreen } from '@/components/drills/drill-screen';
import { DrillShell, drillClockFor } from '@/drills/shared/drill-shell';
import type { DrillShellOptions } from '@/drills/shared/drill-shell';
import type { App } from '@/app/app';
import { createTestApp, renderScreen } from '../../support/render';

/** A drill with nothing of its own: a clock that counts up, and spies on the shell's callbacks. */
function drillHooks() {
  return {
    onStart: vi.fn((shell: DrillShell) => {
      drillClockFor(shell, { mode: 'countUp', limit: 600 }).start();
      shell.score.beginTest();
    }),
    onStop: vi.fn((shell: DrillShell) => shell.clock?.stop()),
    onPause: vi.fn((shell: DrillShell) => shell.clock?.pause()),
    onResume: vi.fn((shell: DrillShell) => shell.clock?.resume()),
  } satisfies Partial<DrillShellOptions>;
}

function TestDrill({ app, hooks }: { app: App; hooks: ReturnType<typeof drillHooks> }) {
  const [shell] = useState(() => new DrillShell(app, { countLabel: 'Tests', pausable: true, ...hooks }));
  const display = useRef<HTMLDivElement>(null);
  return (
    <DrillScreen
      shell={shell}
      title="Test Drill"
      help="drills.count"
      layout="grid"
      displayRef={display}
      onLayout={() => {}}
      display={null}
    />
  );
}

function setup() {
  const app = createTestApp();
  const hooks = drillHooks();
  const hold = vi.spyOn(app.wakeLock, 'hold');
  const utils = renderScreen(<TestDrill app={app} hooks={hooks} />, { app });
  // Another screen (the help sheet here) covers it, then goes.
  const hide = utils.cover;
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  return { ...utils, hooks, hold, hide, wait };
}

const countdown = () => screen.queryByRole('timer', { name: 'Countdown' });
const pauseButton = () => screen.getByRole('button', { name: /^(Pause|Continue)$/ });
const stat = (name: RegExp) => screen.getByRole('cell', { name });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DrillScreen', () => {
  it('counts down "2, 1" before the run starts, with Pause off until then', async () => {
    const { hooks, wait } = setup();
    // Shown as it opens.
    expect(countdown()).toHaveTextContent('2');
    expect(pauseButton()).toBeDisabled();
    await wait(1000);
    expect(countdown()).toHaveTextContent('1');
    expect(hooks.onStart).not.toHaveBeenCalled();
    await wait(1000);
    expect(countdown()).not.toBeInTheDocument();
    expect(hooks.onStart).toHaveBeenCalledTimes(1);
    expect(pauseButton()).toBeEnabled();
  });

  it('shows the stats and keeps the time ticking', async () => {
    const { show, wait } = setup();
    show();
    await wait(2000);
    expect(stat(/^Tests: /)).toHaveTextContent('Tests: 1');
    expect(stat(/^Accuracy: /)).toHaveTextContent('Accuracy: 100%');
    expect(stat(/^Time: /)).toHaveTextContent('Time: 00:00:00');
    await wait(3000);
    expect(stat(/^Time: /)).toHaveTextContent('Time: 00:00:03');
    expect(stat(/^Tests\/Min: /)).toHaveTextContent('Tests/Min: 20');
  });

  it('pauses, and continues after the countdown', async () => {
    const { show, hooks, wait } = setup();
    show();
    await wait(2000);
    fireEvent.click(pauseButton());
    expect(hooks.onPause).toHaveBeenCalledTimes(1);
    expect(pauseButton()).toHaveTextContent('Continue');
    await wait(5000);
    expect(stat(/^Time: /)).toHaveTextContent('Time: 00:00:00');

    fireEvent.click(pauseButton());
    expect(countdown()).toHaveTextContent('2');
    expect(pauseButton()).toBeDisabled();
    await wait(2000);
    expect(hooks.onResume).toHaveBeenCalledTimes(1);
    expect(pauseButton()).toHaveTextContent('Pause');
    expect(pauseButton()).toBeEnabled();
  });

  it('restarts with a fresh countdown and a fresh run', async () => {
    const { show, hooks, wait } = setup();
    show();
    await wait(2000);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(hooks.onStop).toHaveBeenCalledTimes(1);
    expect(countdown()).toHaveTextContent('2');
    expect(pauseButton()).toBeDisabled();
    await wait(2000);
    expect(hooks.onStart).toHaveBeenCalledTimes(2);
    expect(pauseButton()).toBeEnabled();
  });

  it('stops while another screen covers it, and counts down on return', async () => {
    const { show, hide, hooks, hold, wait } = setup();
    show();
    expect(hold).toHaveBeenCalledTimes(1);
    await wait(2000);
    hide();
    expect(hooks.onPause).toHaveBeenCalledTimes(1);
    await wait(5000);
    expect(stat(/^Time: /)).toHaveTextContent('Time: 00:00:00');

    show();
    expect(hold).toHaveBeenCalledTimes(2);
    expect(countdown()).toHaveTextContent('2');
    await wait(2000);
    expect(hooks.onResume).toHaveBeenCalledTimes(1);
    expect(pauseButton()).toHaveTextContent('Pause');
  });

  it('a countdown covered by another screen starts over on return', async () => {
    const { show, hide, hooks, wait } = setup();
    show();
    await wait(1000);
    hide();
    expect(countdown()).not.toBeInTheDocument();
    await wait(5000);
    expect(hooks.onStart).not.toHaveBeenCalled();
    show();
    expect(countdown()).toHaveTextContent('2');
    await wait(2000);
    expect(hooks.onStart).toHaveBeenCalledTimes(1);
  });

  it('a drill the player paused stays paused behind another screen', async () => {
    const { show, hide, hooks, wait } = setup();
    show();
    await wait(2000);
    fireEvent.click(pauseButton());
    hide();
    show();
    expect(countdown()).not.toBeInTheDocument();
    expect(pauseButton()).toHaveTextContent('Continue');
    expect(hooks.onResume).not.toHaveBeenCalled();
  });

  it('leaves no timer running once it closes', async () => {
    const { show, hooks, unmount, wait } = setup();
    show();
    await wait(2000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(hooks.onStop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('goes back and opens its help from the title bar', () => {
    const { location, help, show } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(help()).toEqual({ topic: 'drills.count', title: 'Test Drill' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(location().pathname).toBe('/');
  });
});
