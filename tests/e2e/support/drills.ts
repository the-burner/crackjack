import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export interface Drill {
  /** The home screen button. */
  button: string;
  options: string;
  play: string;
  title: string;
}

export const DRILLS = {
  flash: { button: 'Flash Drills', options: 'drills.flash.options', play: 'drills.flash', title: 'Flash Options' },
  depth: { button: 'Depth Drills', options: 'drills.depth.options', play: 'drills.depth', title: 'Depth Options' },
  count: { button: 'Count Drills', options: 'drills.count.options', play: 'drills.count', title: 'Count Options' },
  full: {
    button: 'Full Table Drills',
    options: 'drills.full.options',
    play: 'drills.full',
    title: 'Full Table Options',
  },
} satisfies Record<string, Drill>;

/** Launches a drill from the home screen and waits out the "2, 1" countdown. */
export async function launchDrill(page: Page, drill: Drill): Promise<Locator> {
  await page.getByRole('button', { name: drill.button }).click();
  const options = page.locator(`[data-screen="${drill.options}"]`);
  await expect(options).toBeVisible();
  await options.locator('[data-action="launch"]').click();
  const screen = page.locator(`[data-screen="${drill.play}"]`);
  await expect(screen).toBeVisible();
  // The opening countdown starts as the screen shows; seen first, so its end is not mistaken for not having begun.
  await expect(countdownOf(screen)).toBeVisible();
  await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
  return screen;
}

export const statsText = (screen: Locator): Promise<string> => statsOf(screen).innerText();

/** A play screen's stats panel. */
export const statsOf = (screen: Locator): Locator => screen.getByRole('table', { name: 'Stats' });

/** The "2, 1" countdown over a play screen. */
export const countdownOf = (screen: Locator): Locator => screen.getByRole('timer', { name: 'Countdown' });

/** How many near-white pixels a canvas holds, i.e. whether cards are on it. */
export const whitePixels = (canvas: Locator): Promise<number> =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
    let white = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
    }
    return white;
  });

/** Boolean grids shaped like the strategy tables. */
export const emptyMask = (): Record<string, boolean[][]> =>
  Object.fromEntries(
    ['split', 'hardStand', 'softDouble', 'hardDouble', 'softStand', 'surrender'].map(name => [
      name,
      Array.from({ length: 10 }, () => new Array<boolean>(10).fill(false)),
    ]),
  );
