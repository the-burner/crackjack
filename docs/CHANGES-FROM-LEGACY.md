# Behavior changes from the original apps

The merged app reproduces the original Drills and Games apps unless listed
here. Each entry says what changed and why. Entries marked **fix** correct
behavior that was clearly broken in the original; **merge** entries come from
combining the two apps into one.

## Settings

- **merge** One set of rules, playing-strategy and true-count settings is
  shared by the game and the drills (the game's options were a superset).
  Fresh-install defaults follow the game: double after split on, dealer hits
  soft 17 on, true count rounding "Round". The drills previously defaulted
  to off / off / Floor.
- **merge** Each drill keeps its own options. Values the old Drills app shared
  between drills (decks, timer mode, progressive speed, tray style, tests per
  drill, two counts) are now stored per drill.
- **merge** Sound is a single "Sound" switch, off by default.
- Error logs (the "Log errors", "Auto-delete logs", "Do not keep error logs"
  options and the error log viewer) were removed. The per-hand error tallies
  used by "Drill Errors" hands are kept.

## Strategy and counting

- **fix** True count "Truncate" now truncates toward zero for every value. The
  game turned exact negative counts into the next integer up (-2 became -1).
- **fix** True count "Round" rounds. The drills added 0.5 instead of rounding.
- Strategy file 35 ("Basic High-Low") was never selectable and its file was
  malformed; it is not included.
- **fix** Strategy code *D ("stand with 3 or more cards") checks the number of
  cards in the hand. The game checked a card slot number, so in the game it
  almost always said stand.
- **fix** Loading an "extended" strategy (Double Exposure, Hole Carding) no
  longer resets the saved index range setting; the range is simply not applied
  to those strategies.

## Settings screens

- **fix** Rule constraints now run for every control. The legacy selects on
  Common Rules (and the Playing Strategy rule list) wrote their options
  directly, skipping `DoOpt`, so e.g. turning on "No dealer hole card" left
  dealer peeking on and "Early Surrender vs. 10" left the ten peek on.
- **fix** Choosing something in Unusual Games no longer clears unrelated rules.
  The legacy screen replayed the "off" branches of Double Exposure, Super Fun 21
  and Spanish 21 for every selection, which silently turned off resplit aces,
  multiple draw to split aces, double on any number of cards, double on 3 cards,
  Double Down Rescue, late surrender, the blackjack payout, Diamond BJ 2:1,
  five-or-more-card 21, dealer wins ties and "Player BJ always wins". Selecting a
  game now applies only that game's own rule bundle; leaving a variant restores
  the rules that variant had forced to their defaults.
- **fix** "Double after ace split" turns on "Double down after split"
  immediately. The legacy app only did it when leaving Common Rules, so the
  setting could be left in an impossible state.
- **fix** The second Bonuses list (777 payouts, 5-, 6- and 5-or-more-card 21,
  suited 678, split-ten-plus-ace) works on phones and shows all nine rows. The
  legacy phone layout drew six of them but never bound them, so tapping did
  nothing.
- The dealing-bias selector (Dealer Errs/Biases) is kept as a setting. It had no
  effect in the legacy game because its strength variable was always 0.
- Launch Game no longer refuses to start in landscape on small screens; the new
  table layout is not fixed to portrait. It still reduces the table to two seats
  in portrait and frees seat 1 when every seat in play is a computer player.
- Unusual Games asks for the import code in a dialog instead of a text box on
  the screen, which is how the rest of the app prompts for values.
- Imported side-bet games are stored as `{id, name, definition}` under the
  `customSideBetGames` key instead of one `BStrat<id>` key per game, and the
  decoded `BONC*` arrays are no longer persisted: they are derived from the
  definition when needed.
