// The URL of every screen. Screens are named as the tests and data-screen
// attributes know them.

import { SCOPES } from '@/settings/scopes';
import type { ScopeName } from '@/settings/scopes';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { MaskKey, TablesParams } from '@/screens/strategy/tables';

/** Whether `key` names a mask of boolean grids: a module's index mask, or the flash drill's hands. */
const isMaskKey = (key: string | null): key is MaskKey =>
  key !== null && key in SETTINGS_SCHEMA && (key.endsWith('.strategy.customIndexMask') || key.endsWith('customHands'));

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
  'game.strategy': '/game/strategy',
  'game.trueCount': '/game/true-count',
  'game.betting': '/game/betting',
  'drills.flash.strategy': '/drills/flash/strategy',
  'drills.flash.trueCount': '/drills/flash/true-count',
  'drills.depth.strategy': '/drills/depth/strategy',
  'drills.depth.trueCount': '/drills/depth/true-count',
  'drills.count.strategy': '/drills/count/strategy',
  'drills.count.trueCount': '/drills/count/true-count',
  'drills.full.strategy': '/drills/full/strategy',
  'drills.full.trueCount': '/drills/full/true-count',
  'settings.gestures': '/settings/gestures',
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
export function tablesSearch({
  mode,
  scope,
  pick,
  maskKey,
  decks,
  system,
  title,
  view,
  highlight,
}: TablesParams): string {
  const search = new URLSearchParams();
  if (mode) search.set('mode', mode);
  if (scope) search.set('scope', scope);
  if (pick) search.set('pick', '1');
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
  const scope = search.get('scope');
  const mask = search.get('mask');
  const row = number('row');
  const column = number('column');
  return {
    mode: mode === 'editMask' || mode === 'view' ? mode : undefined,
    scope: scope !== null && scope in SCOPES ? (scope as ScopeName) : undefined,
    pick: search.get('pick') === '1',
    maskKey: isMaskKey(mask) ? mask : null,
    decks: number('decks'),
    system: number('system'),
    title: search.get('title') ?? undefined,
    view: search.get('view'),
    highlight: row !== undefined && column !== undefined ? { row, column } : null,
  };
}
