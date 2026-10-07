// The URL of every screen. Screens are named as the tests and data-screen
// attributes know them.

import type { TablesParams } from '@/screens/strategy/tables';

export const PATHS = {
  home: '/',
  settings: '/settings',
  'game.setup': '/game/setup',
  'game.commonRules': '/game/common-rules',
  'game.ruleVariations': '/game/rule-variations',
  'game.mechanics': '/game/mechanics',
  'game.bonuses': '/game/bonuses',
  'game.playVariations': '/game/play-variations',
  'game.unusualGames': '/game/unusual-games',
  'game.dealerErrors': '/game/dealer-errors',
  'game.peeking': '/game/peeking',
  'settings.appearance': '/settings/appearance',
  'settings.strategy': '/settings/strategy',
  'settings.trueCount': '/settings/true-count',
  'game.betting': '/game/betting',
  'strategy.tables': '/strategy/tables',
  'drills.flash.options': '/drills/flash',
  'drills.flash': '/drills/flash/play',
  'drills.flash.errors': '/drills/flash/errors',
  'drills.depth.options': '/drills/depth',
  'drills.depth': '/drills/depth/play',
  'drills.count.options': '/drills/count',
  'drills.count': '/drills/count/play',
  'drills.full.options': '/drills/full',
  'drills.full': '/drills/full/play',
  'game.options': '/game',
  'game.table': '/game/play',
} as const;

export type ScreenName = keyof typeof PATHS;

/** The strategy table viewer's options, as search params. */
export function tablesSearch({ mode, maskKey, decks, system, title, view, highlight }: TablesParams): string {
  const search = new URLSearchParams();
  if (mode) search.set('mode', mode);
  if (maskKey) search.set('mask', maskKey);
  if (decks !== undefined) search.set('decks', String(decks));
  if (system !== undefined) search.set('system', String(system));
  if (title) search.set('title', title);
  if (view) search.set('view', view);
  if (highlight) {
    search.set('row', String(highlight.row));
    search.set('column', String(highlight.column));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** The options back from tablesSearch(). */
export function tablesParams(search: URLSearchParams): TablesParams {
  const number = (key: string) => {
    const value = search.get(key);
    return value === null || !Number.isFinite(Number(value)) ? undefined : Number(value);
  };
  const mode = search.get('mode');
  const mask = search.get('mask');
  const row = number('row');
  const column = number('column');
  return {
    mode: mode === 'editMask' || mode === 'view' ? mode : undefined,
    maskKey: mask === 'strategy.customIndexMask' || mask === 'drills.flash.customHands' ? mask : null,
    decks: number('decks'),
    system: number('system'),
    title: search.get('title') ?? undefined,
    view: search.get('view'),
    highlight: row !== undefined && column !== undefined ? { row, column } : null,
  };
}
