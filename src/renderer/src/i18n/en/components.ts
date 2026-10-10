import type { Messages } from '../types'

/** English text of the "components" namespace. Full key: "components.<key>". See ../README.md. */
const messages = {
  // components/ui: the built-in labels of the shared controls.
  'field.optional': 'optional',
  'field.decrease': 'Decrease',
  'field.increase': 'Increase',
  'field.openCalendar': 'Open calendar',
  'select.placeholder': 'Select…',
  'select.noOptions': 'No options',
  'select.searchPlaceholder': 'Search…',
  'select.noMatches': 'No matches',
  'select.openList': 'Open list',
  'select.closeList': 'Close list',
  // Under a long list: {count} more options match and are not shown.
  'select.more': { one: '{count} more - keep typing to narrow down', other: '{count} more - keep typing to narrow down' },
  'toast.achievement': 'Achievement unlocked',
  'toast.dismiss': 'Dismiss notification',
  'toast.region': 'Notifications',
  'error.title': 'Something went wrong here',
  'error.unexpected': 'An unexpected error occurred.',
  'error.tryAgain': 'Try again',
  'error.reload': 'Reload app',

  // components/pokemon
  'home.mark': 'In Pokémon HOME',
  // Accessible name of a type shown as a colour dot: {type} is the type's name ("Fire type").
  'type.label': '{type} type',
  'game.unknown': 'Unknown game',
  'ball.unknown': 'Unknown ball',

  // What kind of form a form is (small tag).
  'formCategory.base': 'Base',
  'formCategory.regional': 'Regional',
  'formCategory.gender': 'Gender form',
  'formCategory.cosmetic': 'Cosmetic',
  'formCategory.changeable': 'Changeable',
  'formCategory.fusion': 'Fusion',
  'formCategory.event': 'Event',
  'formCategory.partner': 'Partner',
  'formCategory.mega': 'Mega',
  'formCategory.battle': 'Battle only',
  'formCategory.hidden': 'Hidden',
  'region.alola': 'Alolan',
  'region.galar': 'Galarian',
  'region.hisui': 'Hisuian',
  'region.paldea': 'Paldean',

  // The entry card. {summary} is lib.entry.summary ("Shiny Alolan Raichu · Pokémon Sun").
  'entry.actions': 'Entry actions',
  'entry.actionsFor': 'Entry actions: {summary}',
  'entry.open': 'Open entry: {summary}',
  // Tooltip on an entry whose game this version does not know: {id} is the internal id in the save.
  'entry.savedAs': 'Saved as “{id}”',
  // Tooltips on the date: {date} is a long date ("9 October 2026").
  'entry.caughtOn': 'Caught {date}',
  'entry.loggedOn': 'Logged {date}',
  // The line under a location when both are known: how it was obtained and what it evolved from, either order.
  'entry.howBoth': '{first} · {second}',
  'entry.alpha': 'Alpha',
  'entry.alphaTitle': 'Alpha Pokémon',
  'entry.gmax': 'G-Max',
  'entry.gmaxTitle': 'Can Gigantamax',
  'entry.nicknameQuoted': '“{nickname}”',
  'entry.nicknameTitle': 'Nickname: {nickname}',
  // OT = Original Trainer; {name} is the trainer name as typed.
  'entry.ot': 'OT',
  'entry.otShort': 'OT {name}',
  'entry.otTitle': 'Original Trainer: {name}',
  'entry.notesLabel': 'Notes: {notes}',
  // One ability / PID / IV / EV line read out: {label} is lib.values.*, {mark} is lib.values.hidden.
  'entry.value': '{label} {text}',
  'entry.valueMarked': '{label} {text} ({mark})',
  // Column headers of the entry list (with common.level).
  'entry.col.pokemon': 'Pokémon',
  'entry.col.game': 'Game',
  'entry.col.location': 'Location',
  'entry.col.ball': 'Ball',
  'entry.col.date': 'Date'
} satisfies Messages

export default messages
