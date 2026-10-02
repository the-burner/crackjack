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
