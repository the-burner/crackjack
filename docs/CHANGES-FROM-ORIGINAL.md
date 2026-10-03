# Differences from the original apps

This app rebuilds QFIT's Blackjack Verité Drills (1.5.25) and Blackjack Verité
Games (2.0.6) as one app. It plays the same way unless something is listed here.

Entries marked **fix** correct behavior that was clearly broken in the
original. Entries marked **merge** come from combining the two apps. The rest
are deliberate changes, with the reason given.

## Settings

- **merge** The game and the drills share one set of rules, playing-strategy
  and true-count settings. The game's options were a superset of the drills'.
  Fresh-install defaults follow the game: double after split on, dealer hits
  soft 17 on, true-count rounding "Round". The drills used to default to off,
  off and "Floor".
- **merge** Each drill keeps its own options. Values the Drills app shared
  between all its drills (decks, timer mode, progressive speed, tray style,
  tests per drill, two counts, card thickness) are now stored per drill.
- **merge** Sound is one "Sound on" switch, off by default.
- Several fresh-install defaults were changed to suit this app's owner (all in
  `src/settings/schema.js`): Flash drills deal two-card hands with a random
  count and every hand selected for Custom; Depth drills ask for decks left;
  Count drills test about every 36 cards, exactly, with one or two cards per
  flash; Full table drills grade exactly; the table has four seats with a computer player on seat 1 and the player on
  the others; it shuffles with 65 cards
  behind the cut card, starts with a $30,000 bankroll, offers late surrender
  and shows burn cards; betting warns on bet errors with $25 chips and a
  six-row ramp (1, 2, 4, 6, 12, 16 chips); true counts use half-deck
  resolution, truncation and an allowed estimation error of 13 cards.
- The default playing strategy is "Ethans High-Low Strategy", a High-Low
  variant with custom indices (qfit.com strategy code 1028328893). It is built
  in as strategy 100 and listed first; the originals defaulted to High-Low.
- The error logs and the error-log viewer were removed. Errors are still tallied
  per strategy-table cell, which the Flash drill's "Drill Errors" hands and the
  table viewer's error shading use. The Flash options have a "Clear error
  history" action to reset them.
- Settings are saved as soon as they change. The original saved only when you
  left a screen with Back, so leaving any other way lost the edits.
- **fix** Rule constraints apply to every control. Some dropdowns skipped them,
  so turning on "No dealer hole card" left dealer peeking on.
- **fix** Choosing an Unusual Game no longer switches off a dozen unrelated
  rules (resplit aces, late surrender, double on any number of cards, the
  blackjack payout, and others). A game now changes only its own rules, and
  leaving it restores what it had changed.
- **fix** "Double after ace split" turns on "Double after split" straight away,
  rather than only when you left Common Rules.
- **fix** The second Bonuses list works on phones. It was shown there but did
  nothing.
- The game is started only from Play Blackjack on the home screen; the
  Settings screen has no Launch Game button. The drills' option screens no
  longer link to Playing Strategy and True Count Calcs: those are shared
  settings, set from Settings.
- Opening the table never changes the saved seat count. The original cut a
  portrait table to two seats and saved that; the table now fits up to four
  seats in portrait by itself. Seat 1 is still freed when every seat in play is
  a computer player.
- The dealing-bias option is kept, although it never had any effect in the
  original.

## Strategy and counting

- **fix** True-count "Truncate" truncates toward zero for every value. The game
  turned exact negative counts into the next integer up (-2 became -1).
- **fix** True-count "Round" rounds. The drills added 0.5 instead of rounding.
- **fix** The strategy code "stand with 3 or more cards" looks at the number of
  cards in the hand. The game looked at a card position, so it almost always
  said stand.
- **fix** Loading an extended strategy (Double Exposure, Hole Carding) no longer
  resets the saved index range; the range is simply not applied to them.
- Strategy file 35 ("Basic High-Low") was never selectable and was malformed, so
  it is not included.
- Imported strategies can be deleted (the original removed them only with Reset
  Defaults), their names display without stray quote marks, and a download that
  is not a valid strategy file is rejected instead of being added to the list.
- The index range and the initial-count adjustment are limited to -99..99 and
  -999..999.

## Strategy table viewer

- Switching tables redraws every cell. The original could leave text colours
  from the split or surrender table on another table.
- The insurance rule ("Never Insure", "Use Insurance Decks Table", and so on)
  is shown under the Insurance/Counts tables, as the original intended but
  never displayed. The decks table is hidden when the strategy has none, rather
  than showing the previous strategy's numbers.
- A card that counts only when red shows `*` in the Red row and its value in
  the Black row (the Black cell used to be blank).
- Extended strategies scroll sideways instead of squeezing 23 columns onto the
  screen, every row is reachable on a phone, and the ten column is always
  labelled "X".
- Error shading is a switch on the screen. The game's Error button opens the
  table that decided the play, with the cell marked.

## Betting and the casino database

- The bet ramp is stored as a list of rows (`{minCount, rows: [{chips, hands}]}`)
  and the lookup used for bet checking is computed from it. Growing the table
  repeats the last row; the bet picker starts on the row's current number of
  hands.
- **fix** Load Rules no longer switches off the rules it has just set. Dealer
  peeking, "Insure then Surrender allowed" and soft 19/20 doubles always ended
  up off before.
- **fix** Double after split follows the casino's rules instead of always being
  on, and the `d3` rule means "double on 3 cards" (it was mapped to "double any
  number of cards").
- Load Rules sets every rule it understands, including the ones it turns off, so
  nothing from the previous casino is left behind, and it says which casino was
  loaded.
- The CBJN id is remembered between sessions. A search with no results says so.

## The game

- **fix** A blackjack is always paid at the table's blackjack payout. In the
  original, a blackjack in the early rounds of a session was paid only even
  money (an uninitialised variable).
- **fix** "Early surrender vs 10" keeps the half bet against a dealer blackjack.
  The original returned it and then took the whole bet.
- **fix** Insurance is settled on hands that win through a bonus. The original
  skipped it there and left the stake on the table.
- **fix** Input waits for the animation. The original enabled the action buttons
  before the cards had finished appearing, and a tap then started a second round
  of drawing over the first. The bankroll and count readouts also follow the
  cards as they appear instead of jumping to the end of the round.
- **fix** Leaving the table in the middle of a round gives the chips back. The
  original kept them.
- **fix** Catching a dealer mistake with Foul refunds exactly what you were
  short. The original overpaid by 2-4 times for most mistakes. A missed mistake
  is reported with the same amount.
- **fix** The bankroll low, high and average are measured after the round's
  chips are returned.
- **fix** A swipe is measured by its length. The mouse version compared the
  horizontal and vertical positions with each other, so short swipes were
  misread.
- All three speed settings use the same scale.
- The table works in both orientations on any screen. Portrait shows up to four
  seats, keeping your own, with smaller cards; the original refused to play in
  some orientations and asked you to rotate back.
- The table is drawn at the screen's full resolution, cards in a hand are spaced
  so every rank shows, and the discard tray and shoe photos are cut out cleanly.
- Side Bet opens the bet picker; the side bet chosen shows on the betting
  overlay until the round is dealt. Stats is in the title bar so it is available
  during play.
- A bet the bankroll cannot cover is refused.
- The statistics screen shows the counts, bankroll and bet history, and play and
  bet accuracy. The per-category error counts, side-bet accuracy and the
  tray/shoe card breakdowns are not shown.

## Drills

All drills:

- **fix** The Hands/Tests counter shows the number given so far. It used to lag
  one behind.
- **fix** Progressive speed also applies to a run started with Restart, as the
  help said.
- **fix** Timeouts are scored in every drill: the answer is shown, the buzzer
  sounds and one error is counted. In Depth a timeout did nothing at all; in
  Count and Full it was never counted.
- **fix** The ace-adjusted bet, play and insurance counts are rounded like the
  true count. Unrounded, the answer fell between two buttons and could not be
  tapped.
- The drill screens resize when the device rotates instead of reloading.

Flash:

- **fix** The Default hand list is right from the first drill. On the first drill
  of a session the original dealt its hard hit/stand hands as soft hands.
- **fix** Face cards appear in every suit, not only spades.
- **fix** A hand times out only in Auto timer mode, where the seconds setting is
  per hand. The other modes time the whole drill.
- **fix** "No tests (quick drill)" does not count every hand as an error.
- **fix** An index-test error is tallied against the hand's own table cell.
- A wrong answer in "Warn on error" mode is explained in a dialog, with a button
  that opens the strategy table on the deciding cell.
- A tap on the cards must move at least 10 pixels to count as a swipe (a plain
  tap used to read as Hit).
- The two "Reserved" options, which only relabelled a button, are gone.

Depth:

- **fix** One deck at Full resolution is changed to Half at launch. There was
  only one possible answer, and the original then left the answer grid empty.
- **fix** Two tests in a row may share an answer when only one answer exists.
  The original kept rejecting the only test it could show.
- A finished drill reports its accuracy.
- A count range that contains no running count is refused at launch instead of
  hanging. Depths are written as mixed numbers (`1¼`, `½`).

Count:

- **fix** The ace-count drills are offered only with a counting system they
  suit, as the help described.
- The deal-speed default is two seconds, the value the original's slider showed.
- Card thickness is a Count setting of its own; the original borrowed the Depth
  drill's.

Full table:

- **fix** The drill runs on a phone held sideways. The original required a screen
  at least 410 pixels tall, which an iPhone in landscape is not. Held upright it
  asks you to turn the device.
- **fix** Two Tables counts each card once, deals every seat the Players option
  asks for (it skipped the first), and ends reliably when a shoe runs low.
- Two Tables shows both tables the same way within a cycle, and draws the second
  table on blue felt as the original intended. Scattered cards keep their
  positions when the screen is redrawn.
