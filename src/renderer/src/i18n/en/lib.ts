import type { Messages } from '../types'

/** English text of the "lib" namespace (src/renderer/src/lib and src/renderer/src/store). Full key: "lib.<key>". See ../README.md. */
const messages = {
  // lib/format.ts: relative time in activity feeds. {count} is always 1-59 (minutes), 1-23 (hours), 2-29 (days).
  'format.justNow': 'just now',
  'format.minutesAgo': { one: '{count} min ago', other: '{count} min ago' },
  'format.hoursAgo': { one: '{count} h ago', other: '{count} h ago' },
  'format.yesterday': 'yesterday',
  'format.daysAgo': { one: '{count} day ago', other: '{count} days ago' },
  // Level of an encounter: one level, or a range.
  'format.level': 'Lv. {level}',
  'format.levelRange': 'Lv. {min}–{max}',

  // How a Pokémon was obtained or logged (EntryKind).
  'kind.wild': 'Wild',
  'kind.static': 'Static encounter',
  'kind.gift': 'Gift',
  'kind.egg': 'Gift Egg',
  'kind.trade': 'In-game trade',
  'kind.raid': 'Max Raid',
  'kind.tera': 'Tera Raid',
  'kind.outbreak': 'Mass Outbreak',
  'kind.shadow': 'Shadow Pokémon',
  'kind.walker': 'Pokéwalker',
  'kind.dream': 'Dream World',
  'kind.event': 'Event',
  'kind.evolved': 'Evolved',
  'kind.bred': 'Bred',
  'kind.transfer': 'Transferred',
  'kind.other': 'Other',

  // Fallback body of an error toast when the failure carries no text of its own.
  'error.generic': 'Something went wrong.',

  // The ability / PID / IV / EV lines of an entry card. The *Title texts are tooltips.
  'values.ability': 'Ability',
  'values.pid': 'PID',
  'values.ivs': 'IVs',
  'values.evs': 'EVs',
  'values.hidden': 'Hidden',
  'values.abilityTitle': 'Ability: {ability}',
  'values.hiddenAbilityTitle': 'Hidden Ability: {ability}',
  'values.pidTitle': 'PID {pid}',
  'values.ivsTitle': 'IVs: HP / Attack / Defense / Sp. Atk / Sp. Def / Speed',
  'values.evsTitle': 'EVs: HP / Attack / Defense / Sp. Atk / Sp. Def / Speed',

  // lib/storage.ts: notes about a save that had to be repaired while loading or importing.
  'storage.warn.newer': 'This save was written by a newer version of Pelagix (format {version}); anything this version does not understand was left out.',
  'storage.warn.upgraded': 'Save upgraded from format {from} to {to}.',
  'storage.warn.dropped': { one: '{count} invalid or duplicate entry was skipped.', other: '{count} invalid or duplicate entries were skipped.' },
  'storage.warn.repaired': { one: '{count} entry had invalid details removed.', other: '{count} entries had invalid details removed.' },
  // Why an entry was refused; goes into {reason} of store.entryInvalid, mid-sentence, hence lower case.
  'storage.reason.notObject': 'not an object',
  'storage.reason.species': 'invalid species',
  'storage.reason.form': 'invalid form',
  'storage.reason.game': 'invalid game',
  'storage.reason.data': 'invalid data',
  // Only when the app runs in a browser tab (development): {reason} is the browser's own error text.
  'storage.browser.readFailed': 'Could not read the save from browser storage: {reason}',
  'storage.browser.writeFailed': 'Could not write the save to browser storage: {reason}',
  'storage.browser.full': 'Browser storage is full; the save could not be written.',
  'storage.import.tooLarge': 'That file is too large to be a Pelagix save.',
  'storage.import.notJson': 'That file is not valid JSON.',
  'storage.import.notSave': 'That file is not a Pelagix save.',

  // store/save.ts: {reason} is the system's error text (often English), or store.unknownError.
  'store.saveFailed': 'Your changes could not be saved: {reason}',
  'store.loadFailed': 'Your save could not be loaded: {reason}',
  'store.unknownError': 'unknown error',
  // {reason} is one of storage.reason.*
  'store.entryInvalid': 'This entry cannot be saved: {reason}.',

  // lib/entry-actions.ts: one line that names an entry in toasts and accessible names.
  'entry.unknownPokemon': 'Pokémon #{number}',
  'entry.unknownGame': 'Unknown game',
  'entry.shinyName': 'Shiny {name}',
  // "Sparky (Pikachu)": {name} may already be entry.shinyName.
  'entry.nicknamed': '{nickname} ({name})',
  // {who} is the Pokémon (entry.nicknamed or its name), {game} the game's name.
  'entry.summary': '{who} · {game}',
  'entry.changedFrom': 'Changed from {name}',
  'entry.evolvedFrom': 'Evolved from {name}',

  'actions.gone.title': 'That entry no longer exists',
  'actions.gone.body': 'It may have been deleted already.',
  'actions.duplicateFailed': 'The entry could not be duplicated',
  'actions.duplicated': 'Entry duplicated',
  'actions.deleteFailed': 'The entry could not be deleted',
  'actions.deleted': 'Entry deleted',
  'actions.restoreFailed': 'The entry could not be restored',
  'actions.nothingToRestore.title': 'Nothing to restore',
  'actions.nothingToRestore.body': 'That entry is already in your Living Dex.',
  'actions.restored': 'Entry restored',
  'actions.menu.openSpecies': 'Open Pokédex page'
} satisfies Messages

export default messages
