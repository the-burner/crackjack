// Table Rules and Conditions: everything about the table the player does not control (settings/table-settings.ts).

import { useNavigate } from 'react-router';
import { useSettings } from '@/react/app-context';
import { CheckList } from '@/components/ui/check-list';
import { ListRow, Section, SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { SettingChecks, SettingNumber, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import type { Option, SettingCheck } from '@/components/settings-controls';
import { DECKS, TABLE_LIMITS } from '@/settings/schema';
import type { SettingValues } from '@/settings/schema';
import { PATHS } from '@/app/paths';

const SEAT_COUNTS: readonly Option<SettingValues['table.seatCount']>[] = [
  { value: 1, label: 'One Seat' },
  { value: 2, label: 'Two Seats' },
  { value: 4, label: 'Four Seats' },
  { value: 6, label: 'Six Seats' },
];

const DECK_LABELS = [
  'Single Deck',
  'Double Deck',
  'Three Decks',
  'Four Decks',
  'Five Decks',
  'Six Decks',
  'Seven Decks',
  'Eight Decks',
];

const DECK_OPTIONS = DECKS.map((decks, i) => ({ value: decks, label: DECK_LABELS[i] }));

const SHUFFLE_MODES: readonly Option<SettingValues['table.shuffleMode']>[] = [
  { value: 'cutCard', label: 'Shuffle after a Cut Card' },
  { value: 'rounds', label: 'Shuffle after Fixed Rounds' },
];

const LIMITS = TABLE_LIMITS.map(([min, max], value) => ({ value, label: `Limits: $${min} to $${max}` }));

const DEALING: readonly SettingCheck[] = [
  { label: 'Dealer shows burn cards', key: 'table.showBurnCards' },
  { label: 'Cards dealt face down', key: 'table.cardsFaceDown' },
  { label: 'DD card dealt face up', key: 'table.doubleDownCardFaceUp' },
];

const DEALER: readonly SettingCheck[] = [
  { label: 'Hit soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', key: 'rules.noHoleCard' },
  { label: 'Dealer peeks on ten', key: 'rules.dealerPeeksTen' },
  { label: 'Dealer peeks on ace', key: 'rules.dealerPeeksAce' },
  { label: 'Dealer BJ wins all', key: 'rules.dealerBlackjackWinsAll' },
];

const HARD_DOUBLES: readonly Option<SettingValues['rules.hardDoubles']>[] = [
  { value: 'none', label: 'No hard doubles' },
  { value: '10-11', label: 'Double 10-11' },
  { value: '9-11', label: 'Double 9-11' },
  { value: '8-11', label: 'Double 8-11' },
  { value: 'any', label: 'Any hard doubles' },
];

const SOFT_DOUBLES: readonly Option<SettingValues['rules.softDoubles']>[] = [
  { value: 'none', label: 'No soft doubles' },
  { value: 'a8a9', label: 'Soft double A8 or A9 only' },
  { value: 'any', label: 'Any soft doubles' },
];

const DOUBLING: readonly SettingCheck[] = [
  { label: 'Double after split', key: 'rules.doubleAfterSplit' },
  { label: 'Double down on 3 cards', key: 'rules.doubleOnThreeCards' },
  { label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' },
  { label: 'ReDouble', key: 'rules.redouble' },
  { label: 'Triple Down', key: 'rules.tripleDown' },
  { label: 'Hit after Double Down', key: 'rules.hitAfterDouble' },
  { label: 'Double Down Rescue', key: 'rules.doubleDownRescue' },
];

// The two resplit limits are one setting; clearing both allows no resplits.
const SPLITTING: readonly SettingCheck[] = [
  { label: 'Resplit to 3 hands', key: 'rules.maxSplitHands', value: 3, off: 2 },
  { label: 'Resplit to 4 hands', key: 'rules.maxSplitHands', value: 4, off: 2 },
  { label: 'Double after ace split', key: 'rules.doubleAfterSplitAces' },
  { label: 'Resplit aces', key: 'rules.resplitAces' },
  { label: 'Multiple draw after ace split', key: 'rules.hitSplitAces' },
  { label: 'Split tens must same value', key: 'rules.splitTensSameRankOnly' },
  { label: 'No ace splits', key: 'rules.noAceSplits' },
  { label: 'No 4, 5, or ten splits', key: 'rules.noSplit4s5s10s' },
];

const INSURANCE: readonly Option<SettingValues['rules.insurance']>[] = [
  { value: 'none', label: 'No Insurance' },
  { value: 'normal', label: 'Insurance' },
  { value: 'blackjackOnly', label: 'Insure BJ only' },
];

const SURRENDER: readonly Option<SettingValues['rules.surrender']>[] = [
  { value: 'none', label: 'No Surrender' },
  { value: 'late', label: 'Late Surrender (common)' },
  { value: 'early', label: 'Early Surrender (rare)' },
  { value: 'earlyVsTen', label: 'Early Surrender vs. 10' },
  { value: 'macao', label: 'Macao Surrender' },
];

const WINS_AND_TIES: readonly SettingCheck[] = [
  { label: 'Dealer wins tied 17', key: 'rules.dealerWinsTied17' },
  { label: 'Dealer wins ties', key: 'rules.dealerWinsTies' },
  { label: 'Dealer ties 17, 18 and 19', key: 'rules.dealerWinsTies17to19' },
  { label: 'Five unbusted cards wins', key: 'rules.autoWinFiveCards' },
  { label: 'Six unbusted cards wins', key: 'rules.autoWinSixCards' },
  { label: 'Seven unbusted cards wins', key: 'rules.autoWinSevenCards' },
  { label: 'Player 22 counts as 21', key: 'rules.player22CountsAs21' },
];

// The three payout rows are one setting; clearing them all pays the usual 3:2.
const BLACKJACK_PAYOUT: readonly SettingCheck[] = [
  { label: 'Player BJ always wins', key: 'rules.playerBlackjackAlwaysWins' },
  { label: 'Blackjack pays 2:1', key: 'rules.blackjackPayout', value: '2:1', off: '3:2' },
  { label: 'No Blackjack bonus', key: 'rules.blackjackPayout', value: '1:1', off: '3:2' },
  { label: 'Blackjack pays 6:5', key: 'rules.blackjackPayout', value: '6:5', off: '3:2' },
  { label: 'Diamond BJ pays 2:1', key: 'bonuses.diamondBlackjack' },
  { label: 'Ace/Jack of Hearts pays 2:1', key: 'bonuses.heartsAceJack' },
  { label: 'Suited Ace/Jack pays 2:1', key: 'bonuses.suitedAceJack' },
  { label: 'Blackjack rounded up', key: 'rules.blackjackRoundUp' },
];

const BONUS_HANDS: readonly SettingCheck[] = [
  { label: '777 pays 2:1', key: 'bonuses.sevens777', value: '2:1', off: 'none' },
  { label: '777 pays 3:2', key: 'bonuses.sevens777', value: '3:2', off: 'none' },
  { label: 'Suited 777 pays 10:1', key: 'bonuses.sevens777', value: 'suited10:1', off: 'none' },
  { label: 'Five card 21 pays 2:1', key: 'bonuses.fiveCard21' },
  { label: 'Six card 21 pays 2:1', key: 'bonuses.sixCard21' },
  { label: 'Five or more card 21 pays 2:1', key: 'bonuses.fivePlusCard21' },
  { label: 'Suited 678 pays 2:1', key: 'bonuses.suited678' },
  { label: 'Suited 678 pays 2:1 if wins', key: 'bonuses.suited678IfWins' },
  { label: 'Split tens then draw ace is BJ', key: 'bonuses.splitTenAceIsBlackjack' },
];

const MAX_SEATS = 6;

/** The cut card cannot sit beyond the shoe. */
const maxCardsBehindCutCard = (decks: number) => 52 * decks - 1;

export function TableRules() {
  const navigate = useNavigate();
  const settings = useSettings();
  const decks = settings.get('table.decks');
  // The shuffle point and the number of rounds share one row: which one is shown depends on the shuffle mode.
  const byCutCard = settings.get('table.shuffleMode') === 'cutCard';
  return (
    <SettingsScreen title="Table Rules and Conditions" help="game.tableRules">
      <Section title="Seats">
        <SettingsGroup>
          <SettingSelect label="Seats" setting="table.seatCount" options={SEAT_COUNTS} />
          <SettingsNote>Below, highlighted seats are computer players. Click to change.</SettingsNote>
          <SeatPicker />
          <SettingChecks items={[{ label: 'Players come and go', key: 'table.playersComeAndGo' }]} />
          <SettingSelect label="Table limits" setting="table.limits" options={LIMITS} />
        </SettingsGroup>
      </Section>
      <Section title="Shoe">
        <SettingsGroup>
          <SettingSelect
            label="Decks"
            setting="table.decks"
            options={DECK_OPTIONS}
            onChange={value => {
              settings.set('table.decks', value);
              settings.set(
                'table.cardsBehindCutCard',
                Math.min(settings.get('table.cardsBehindCutCard'), maxCardsBehindCutCard(value)),
              );
            }}
          />
          <SettingSelect
            label="Shuffle"
            setting="table.shuffleMode"
            options={SHUFFLE_MODES}
            onChange={value => settings.set('table.shuffleMode', value)}
          />
          <SettingNumber
            label="Shuffle Point/Cards"
            setting="table.cardsBehindCutCard"
            prompt="Cards after the cut card"
            clamp={value => Math.min(value, maxCardsBehindCutCard(decks))}
            hidden={!byCutCard}
          />
          <SettingNumber label="Rounds" setting="table.roundsPerShoe" prompt="Rounds" hidden={byCutCard} />
          <SettingNumber label="Burn Cards" setting="table.burnCards" prompt="Burn Cards" />
          <SettingChecks items={DEALING} />
        </SettingsGroup>
      </Section>
      <Section title="Dealer">
        <SettingsGroup>
          <SettingChecks items={DEALER} />
        </SettingsGroup>
      </Section>
      <Section title="Doubling">
        <SettingsGroup>
          <SettingSelect label="Hard doubles" setting="rules.hardDoubles" options={HARD_DOUBLES} />
          <SettingSelect label="Soft doubles" setting="rules.softDoubles" options={SOFT_DOUBLES} />
          <SettingChecks items={DOUBLING} />
        </SettingsGroup>
      </Section>
      <Section title="Splitting">
        <SettingsGroup>
          <SettingChecks items={SPLITTING} />
        </SettingsGroup>
      </Section>
      <Section title="Insurance and Surrender">
        <SettingsGroup>
          <SettingSelect label="Insurance" setting="rules.insurance" options={INSURANCE} />
          <SettingSelect label="Surrender" setting="rules.surrender" options={SURRENDER} />
          <SettingChecks items={[{ label: 'Insure then Surrender allowed', key: 'rules.surrenderAfterInsurance' }]} />
        </SettingsGroup>
      </Section>
      <Section title="Wins and Ties">
        <SettingsGroup>
          <SettingChecks items={WINS_AND_TIES} />
        </SettingsGroup>
      </Section>
      <Section title="Blackjack Payout">
        <SettingsGroup>
          <SettingChecks items={BLACKJACK_PAYOUT} />
        </SettingsGroup>
      </Section>
      <Section title="Bonus Hands">
        <SettingsGroup>
          <SettingChecks items={BONUS_HANDS} />
        </SettingsGroup>
      </Section>
      <Section title="Unusual Games">
        <SettingsGroup>
          <ListRow block onClick={() => navigate(PATHS['game.unusualGames'])}>
            Unusual Games
          </ListRow>
        </SettingsGroup>
      </Section>
    </SettingsScreen>
  );
}

/** Segmented control showing seats 6..1; a highlighted seat is a computer player. */
function SeatPicker() {
  const settings = useSettings();
  const seats = settings.get('table.computerSeats');
  const order = Array.from({ length: MAX_SEATS }, (_, i) => MAX_SEATS - i);
  return (
    <CheckList
      layout="horizontal"
      aria-label="Computer players"
      items={order.map(seat => ({
        label: `#${seat}`,
        checked: seats[seat - 1],
        onChange: computer => {
          const next = settings.get('table.computerSeats').slice();
          next[seat - 1] = computer;
          settings.set('table.computerSeats', next);
        },
      }))}
    />
  );
}
