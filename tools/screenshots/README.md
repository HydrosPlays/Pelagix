# README screenshots

```
npm run screenshots
```

builds the app (`electron-vite build`), starts it from `out/` on a demo save and writes the
pictures to `docs/screenshots/` (1440 x 900 PNG, about a minute, needs a network connection for
the sprites). Your own save is never touched: the run uses a scratch profile in
`%TEMP%\pelagix-screenshots`, of which only the downloaded sprites are kept between runs.

Options go after `--`: `--only 04,05` (shots whose file name starts with one of these),
`--no-build`, `--fresh` (download every sprite again), `--visible` (leave the window on screen),
`--out <folder>`.

## How it works

- `shots.mjs` says, per file, how to reach the state it shows: addresses, real clicks and key
  presses, sent over the DevTools protocol by `stage.mjs` and `cdp.mjs`.
- `app.mjs` starts Electron with the app's own main process and preload. From outside it sets
  only the profile folder, the window size (through the app's `window.json`), a display scale of
  1, and the page clock: pinned to the demo save's "today" (9 October 2026, 19:30), so dates,
  streaks and the greeting do not depend on the day you run it. `main-hook.cjs` keeps the window
  unfocused and parked outside the displays.
- The app is started on an empty profile; the demo save is then put in place and the page loaded
  again, so the app itself validates the save on that load. The run stops if the app reports
  anything about it (an entry it had to repair or drop, an achievement the save should already
  hold), checks that the Journal counts every entry, and at the end checks that the app left the
  entries and the achievements in the save file as they were given.
- Before each picture `stage.mjs` waits for fonts, for every visible sprite (a failed download is
  retried by entering the page again), for loading placeholders to go, and for animations,
  count-ups and scrolling to finish. It refuses to take a picture with a warning in the title bar
  or a notification on screen, and notes any text that is cut short with an ellipsis.
- `png.mjs` re-compresses the pictures without changing a pixel.

The system's minimise / maximise / close buttons are drawn over the top right corner by Windows
and are not part of a page capture; the space the app keeps free for them is. Two runs give the
same pictures to the eye, not to the byte: the logo on Home floats, and a few icons land half a
pixel differently.

## The demo save

`demo-save.mjs` builds it from the datasets in `src/renderer/public/data`, the same way every time
(`node tools/screenshots/demo-save.mjs [out.json]` prints its figures and optionally writes it).
Trainer "Hydro", default Living Dex rules, a year of collecting (1 November 2025 to 9 October
2026, ending on a nine-day streak):

- 389 entries of 310 species from 45 games on nine systems, in 30 kinds of ball;
- boxes 1 to 4 of the Living Dex nearly full, boxes 5 to 7 partly, then a spread over all nine
  generations;
- 20 shinies, 30 regional-form entries, 10 Unown letters, 9 Vivillon patterns, 5 Alcremie (cream
  and sweet), both genders of several Pokémon, 2 Gigantamax and 7 Alpha entries;
- Pikachu from six games, Eevee from four; 14 nicknames and 13 notes;
- 93 achievements, unlocked between 1 November 2025 and 26 September 2026.

Every entry stands on a record of the datasets (an encounter row, an evolution or a breeding
record of that form in that game): game, method, location, level range, fixed ball, fixed gender
and shiny lock come from it, and a ball that is not fixed is one the datasets list for that game.
Every entry is also logged in a game where the app itself calls that form obtainable: nothing is
evolved or hatched in a game where it, or what it evolves from, is event only or transfer only.
The hand-picked entries at the top of the file name such a record, and the script stops when the
datasets no longer contain it or no longer call it obtainable. Three gifts (Psyduck, Gligar,
Squirtle) are the exception: they are logged under the side game their record names as the
source, Pokémon Stadium, Stadium 2 and HOME, which have no Pokémon of their own. Made up:
nicknames, notes, dates, the choice among possible balls and genders, and the level of evolved
Pokémon. The figures above change when the datasets are rebuilt.

The achievements are not made up. `unlock-history.mjs` replays the collection, catch by catch in
the order it was logged, through the app's own achievement engine
(`src/renderer/src/domain/achievements`, loaded through Vite as the unit tests load it), and dates
each achievement to the catch that earned it. A save without them would be given all of them on
its first load, dated to the day the pictures are taken.

Timestamps in the save are local wall-clock times, so the dates and times in the pictures do not
depend on the time zone of the computer that takes them.
