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

## Strategy, true count, betting and casino screens

Playing Strategy (legacy `frmStrats`)

- An imported strategy can be deleted: the Playing Strategy screen shows a
  "Delete Imported Strategy" button while an imported strategy is selected, and
  deleting one falls back to High-Low. The legacy app could only remove imports
  with Reset Defaults.
- Imported strategy names are shown as text. The legacy app stored the name
  JSON-encoded and displayed it raw, so the list showed `"My Strategy"` with the
  quote characters.
- Settings are saved as they change. The legacy screens only wrote on Back, so
  leaving any other way lost the edits.
- The index range and "Adjust IRC" value are clamped to the schema's range
  (-99..99 and -999..999). The legacy prompts accepted any number.

Strategy table viewer (legacy `frmtabhn`)

- Switching tables resets every cell's colour. The legacy app only reset five
  specific cells, so white text left over from the split or surrender table
  could stay on another table's cells.
- The insurance rule ("Use Insurance Decks Table", "Never Insure", "Red Seven
  Rule", "Use Insurance Hand Table") is shown under the Insurance/Counts
  tables. The legacy app built that label and then always hid it.
- The "Insurance Decks Table" is hidden when the strategy does not use one. The
  legacy app skipped filling it in but left the previous strategy's numbers on
  screen.
- In the Card Point Values table, a card that only counts when it is red shows
  `*` in the Red row and its real value in the Black row. The legacy app wrote
  `*` and left the Black cell blank.
- Specialty plays are collected from the rows the table actually shows. The
  legacy `putspec` scanned all ten rows of every table and wrote symbols into
  rows it had just blanked (no built-in strategy is affected; verified against
  the recorded reference data).
- The grid scrolls sideways for "extended" strategies (Double Exposure, Spanish
  21 style) instead of squeezing 23 columns into the screen, and every row is
  reachable: the legacy grid had a fixed height that cut off the last split row
  on a phone.
- Column headers are rebuilt per strategy. After viewing an extended strategy
  the legacy app relabelled the ten-card column "10" instead of "X" for every
  strategy shown afterwards.
- Shading cells by error count (the legacy's `defineit2 == 3` mode) is a
  "Shade error counts" switch on the screen rather than a separate entry point.
- The screen takes the mask to edit as a parameter, so the same screen serves
  the Custom index set (`strategy.customIndexMask`) and the Flash drill's hand
  picker (`drills.flash.customHands`). Only the custom-index mask ignores the
  index limits while it is edited, which is what the legacy Select button did.

Import Strategy (legacy `frmImport`)

- The downloaded text is checked: it must parse as a strategy file before it is
  stored. The game stored any non-empty response, so a server error page became
  an unusable entry in the strategy list.
- The entered code is shown on the button (as in the game; the drill's version
  wrote to a `<button>`'s `value` and kept showing "Enter text here").
- The download is a normal asynchronous request. The legacy app used a
  synchronous XHR and an `http://qfit.com` retry that is blocked as mixed
  content; the retry is dropped.

True Count Calcs (legacy `frmTC`)

- Nothing beyond the shared true-count fixes listed above; the game's version of
  the screen (with Remaining Cards, allowed estimation error and the two side
  counts) is the one that is kept.

Betting (legacy `frmBet`, `frmBetSelect`)

- The bet table is stored as `betting.ramp` = `{minCount, rows: [{chips, hands}]}`.
  The legacy spread it over `sscntstart`, `bbscntcheat`, `sscntstop`, `scbt[22]`
  and `schd[22]`, plus a derived 21x200 `bbvals` lookup that was persisted; the
  lookup is now computed from the ramp (`settings/bet-ramp.js`).
- Growing the table repeats the last row instead of leaving new rows empty (the
  legacy filled empty rows with one chip the next time the table was drawn).
- The bet-select screen starts on the row's current number of hands; the legacy
  always reset it to one.
- "Minimum bet count" is clamped to -99..99.

Casino Database (legacy `frmDB`, `frmDBDetail`)

- **fix** Load Rules no longer wipes the rules it just set. The legacy handler
  set its defaults and then cleared option indices 1..99, so dealer peeking on a
  ten and on an ace, "Insure then Surrender allowed" and soft 19/20 doubles
  always ended up off. They are now on, as the handler intended.
- **fix** Double after split follows the casino's `ds` code. The legacy handler
  forced it on for every casino, because index 0 was the one index its clearing
  loop missed.
- **fix** `d3` ("double down on the first three cards") maps to "Double down on
  3 cards". The legacy mapped it to "Double any number of cards".
- Dealer hits soft 17 follows the `h17`/`s17` code and is off when neither is
  listed (4 of 1089 live records). This matches what the legacy did in practice.
- Load Rules writes every rule it understands, including the ones it turns off,
  so loading a casino never leaves part of the previous one behind. It then
  reports which casino was loaded; the legacy jumped back to the options hub
  without a word.
- The penetration field is kept as the legacy read it: `cardsBehindCutCard =
  52 x (field / 10)`. The settings spec lists this as a bug ("the number of
  cards dealt, not the number behind the cut card"), but the live CBJN data says
  otherwise - the median value is 1.5 for six decks and 0.8 for two, which is
  only sensible as decks cut off - so the legacy mapping is correct.
- The CBJN id is remembered and shown on its button. The legacy stored it but
  never read it back, so the button reverted to "Enter CBJN id" after a reload.
- Table limits are not loaded from the casino record (as in the legacy); the
  limits setting is a fixed list of ranges that the records do not map onto.
- Rule codes are matched exactly after trimming, so the handful of malformed
  entries in the live data (`rs3.pv`, `h17.ds`, `ds weekends only`) are ignored,
  as they were before.
- A search with no hits says "No games found" instead of showing only the
  "click a game" header (the legacy's no-hits branch was unreachable).
- The database is cached under the `casinoDatabase` storage key as
  `{date, records}` instead of an array whose first element was the date.
