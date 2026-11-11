// A table's rules in the shorthand players and casino guides use ("6D H17 DAS LS RSA"), and its limits:
// the line under each table's name in the picker, which its search reads too.

import { money } from '@/core/money';
import { BUILTIN_SIDE_BET_GAMES } from '@/data/side-bet-games';
import type { SettingKey, SettingValues } from './schema';

type Read = <K extends SettingKey>(key: K) => SettingValues[K];

const SURRENDER: Record<SettingValues['rules.surrender'], string | null> = {
  none: null,
  late: 'LS',
  early: 'ES',
  earlyVsTen: 'ES10',
  macao: 'Macao surrender',
  earlyExceptAce: 'ESXA',
  lateExceptAce: 'LSXA',
};

const DOUBLES: Record<SettingValues['rules.hardDoubles'], string | null> = {
  any: null,
  '8-11': 'D8',
  '9-11': 'D9',
  '10-11': 'D10',
  none: 'No doubles',
};

/** "6D H17 DAS LS RSA · $15–$500", or with the unusual game first ("Spanish 21 · 6D H17 …"). */
export function tableSummary(get: Read): string {
  const game = get('bonuses.game');
  const rules = [
    `${get('table.decks')}D`,
    get('rules.dealerHitsSoft17') ? 'H17' : 'S17',
    get('rules.noHoleCard') && (get('rules.dealerBlackjackWinsAll') ? 'ENHC' : 'NHC'),
    get('rules.doubleAfterSplit') && 'DAS',
    DOUBLES[get('rules.hardDoubles')],
    get('rules.hardDoubles') === 'any' && get('rules.softDoubles') === 'none' && 'No soft doubles',
    get('rules.doubleOnThreeCards') && 'D3',
    SURRENDER[get('rules.surrender')],
    get('rules.resplitAces') && (get('rules.resplitAcesOnce') ? 'RSA3' : 'RSA'),
    { 2: 'NRS', 3: 'RS3', 4: null, 8: 'UR' }[get('rules.maxSplitHands')],
    get('rules.insurance') === 'none' && 'No insurance',
    get('rules.blackjackPayout') !== '3:2' && `BJ ${get('rules.blackjackPayout')}`,
    get('rules.noTenSplits') && 'NS10',
    get('table.noMidShoeEntry') ? 'NM' : get('table.newPlayersWaitForShuffle') && 'NMO',
    get('table.noSpreadingMidShoe') && 'NSO',
    get('table.oneSpot') && '1 spot',
    get('table.cardsFaceDown') && get('table.showCardsOnlyWhenNeeded') && 'Hide',
    get('table.cutCardVaries') > 0 && 'PV',
  ].filter(Boolean);
  const limits = `${money(get('table.minBet'))}–${money(get('table.maxBet'))}`;
  const name = game ? BUILTIN_SIDE_BET_GAMES.find(g => g.id === game)?.name : undefined;
  return [name, rules.join(' '), limits].filter(Boolean).join(' · ');
}
