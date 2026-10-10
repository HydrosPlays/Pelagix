import type { Messages } from '../types'

/** English text of the "journal" namespace. Full key: "journal.<key>". See ../README.md. */
const messages = {
  'page.title': 'Journal',
  'page.subtitle': 'Every catch you have logged, across all your games.',
  'page.subtitleEmpty': 'Every catch you log, across all your games.',

  'empty.title': 'Your Journal is empty',
  'empty.description': 'Log a catch and it shows up here with its game, place, ball and date. Find a Pokémon to get started.',
  'empty.openDex': 'Open the Pokédex',
  // <key/> is the keyboard shortcut, drawn as key caps (Ctrl K).
  'empty.search': 'Search for a Pokémon <key/>',

  // Sorting. The sort also names the groups of the list.
  'sort.label': 'Sort and group by',
  'sort.caught': 'Date caught',
  'sort.logged': 'Date logged',
  'sort.dex': 'Pokédex number',
  'sort.game': 'Game',
  'direction.caught.desc': 'Newest catch first',
  'direction.caught.asc': 'Oldest catch first',
  'direction.logged.desc': 'Last logged first',
  'direction.logged.asc': 'First logged first',
  'direction.dex.asc': 'Lowest number first',
  'direction.dex.desc': 'Highest number first',
  'direction.game.asc': 'Oldest game first',
  'direction.game.desc': 'Newest game first',
  // Accessible name of the direction button: {order} is one of the direction.* texts above, a sentence of its own.
  'direction.reverse': '{order}. Reverse the order',

  'select.start': 'Select',
  'select.toolbar': 'Selection',
  'select.all': 'Select all {count}',
  'select.none': 'Deselect all',
  'select.picked': { one: '<b>{count}</b> selected', other: '<b>{count}</b> selected' },
  'select.hint': 'Shift-click selects a range',
  'select.keep': 'Keep them',
  // Accessible names of a row's checkbox and of the row itself in selection mode; {name} is the Pokémon.
  'select.row': 'Select {name}',
  'select.rowOff': 'Deselect {name}',

  // The summary strip.
  'summary.label': 'Journal summary',
  'summary.entries': 'Entries',
  'summary.pokemon': 'Pokémon',
  'summary.games': { one: '{count} game', other: '{count} games' },
  // {games} is summary.games; {count} entries come from a game this version does not know.
  'summary.gamesUnknown': { one: '{games} · {count} from an unknown game', other: '{games} · {count} from an unknown game' },
  'summary.systems': { one: '{count} system', other: '{count} systems' },
  // Tooltip and accessible name of a game or console icon: {name} is the game or the console.
  'summary.iconTip': { one: '{name} · {count} entry', other: '{name} · {count} entries' },
  'summary.filterBy': { one: 'Filter by {name}, {count} entry', other: 'Filter by {name}, {count} entries' },
  // The games that did not fit in the strip: {names} is their short names joined with summary.separator.
  'summary.moreGames': { one: '{count} more game: {names}', other: '{count} more games: {names}' },
  'summary.separator': ', ',

  // The filter bar.
  'filter.label': 'Filter the Journal',
  'filter.text.placeholder': 'Name, nickname, place, notes, OT…',
  'filter.text.label': 'Search entries',
  'filter.game': 'Game',
  'filter.game.search': 'Search game',
  'filter.game.other': 'Other',
  'filter.generation': 'Generation',
  'filter.system': 'System',
  'filter.ball': 'Ball',
  'filter.ball.search': 'Search ball',
  'filter.kind': 'Obtained',
  'filter.date': 'Date',
  'filter.shiny': 'Shiny',
  'filter.selected': { one: '{count} selected', other: '{count} selected' },
  'filter.nothing': 'Nothing matches',
  'filter.date.group': 'Date caught',
  'filter.date.from': 'From',
  'filter.date.to': 'To',
  'filter.date.last7': 'Last 7 days',
  'filter.date.last30': 'Last 30 days',
  'filter.date.thisYear': 'This year',
  'filter.date.lastYear': 'Last year',
  'filter.date.hint': 'Filters by the day it was caught',
  // Group of games in the Game filter and label of the Generation filter for Pokémon GO and Pokémon HOME.
  'gen.services': 'Pokémon GO & HOME',

  // The chips of the active filters.
  'chips.text': '“{text}”',
  'chips.shinyOnly': 'Shiny only',
  'chips.clearAll': 'Clear all',
  // Accessible name of a chip's remove button: {name} is a game, generation, console, ball or way of obtaining.
  'chips.remove': 'Remove {name}',
  'chips.removeText': 'Remove the text filter',
  'chips.removeDates': 'Remove the date range',
  'chips.removeShiny': 'Remove the shiny filter',
  'range.between': '{from} – {to}',
  'range.from': 'From {date}',
  'range.until': 'Until {date}',

  // "128 entries · 9 shiny · 14 games": each part has its own count, so the line is put together from three messages.
  'counts.entries': { one: '{count} entry', other: '{count} entries' },
  'counts.shiny': { one: '{count} shiny', other: '{count} shiny' },
  'counts.games': { one: '{count} game', other: '{count} games' },
  'counts.line': '{entries} · {shiny}',
  'counts.lineGames': '{entries} · {shiny} · {games}',
  // With a filter on: {counts} is the line above, {total} every entry of the Journal. The <of> part is printed fainter.
  'counts.of': '{counts}<of> of {total}</of>',

  // Group headings of the list.
  'group.undated': 'Undated',
  'group.unknownPokemon': 'Unknown Pokémon',

  'noMatch.title': 'No entries match',
  'noMatch.description': 'Nothing in your Journal fits these filters. Loosen one of them, or start over.',
  'noMatch.clear': 'Clear all filters',

  // Deleting several entries at once.
  'delete.title': { one: 'Delete {count} entry?', other: 'Delete {count} entries?' },
  'delete.description': 'They leave your Journal and your Living Dex. You can undo this right afterwards.',
  'delete.failed': 'Some entries could not be deleted',
  'delete.done': { one: '{count} entry deleted', other: '{count} entries deleted' },
  'delete.doneBody': 'Undo puts every one of them back.',
  'restore.done': { one: '{count} entry restored', other: '{count} entries restored' },
  'restore.nothing.title': 'Nothing to restore',
  'restore.nothing.body': 'Those entries are already in your Journal.',
  'restore.failed': 'The entries could not be restored'
} satisfies Messages

export default messages
