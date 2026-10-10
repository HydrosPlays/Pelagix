import type { Messages } from '../types'

/**
 * English text of the "homedex" namespace (the HOME Dex page). Full key: "homedex.<key>". See ../README.md.
 * "HOME" is Pokémon HOME. {game} is always a short game name ("Sword").
 */
const messages = {
  // ---- Page header.
  'hero.title': 'HOME Dex',
  'hero.titleShiny': 'Shiny HOME Dex',
  'hero.ring': 'HOME Dex completion',
  'hero.ringShiny': 'Shiny HOME Dex completion',
  // Read out for the ring and the count. {count} is the number of slots.
  'hero.count': { one: '{inHome} of {count} in HOME', other: '{inHome} of {count} in HOME' },
  'hero.countShiny': { one: '{inHome} of {count} shiny in HOME', other: '{inHome} of {count} shiny in HOME' },
  'hero.countGame': { one: '{inHome} of {count} from {game} in HOME', other: '{inHome} of {count} from {game} in HOME' },
  'hero.countShinyGame': { one: '{inHome} of {count} shiny from {game} in HOME', other: '{inHome} of {count} shiny from {game} in HOME' },
  // Printed after the two large numbers "12 / 1,367".
  'hero.unit': 'in HOME',
  'hero.unitShiny': 'shiny in HOME',
  'hero.unitGame': 'from {game} in HOME',
  'hero.unitShinyGame': 'shiny from {game} in HOME',
  'hero.pending': { one: '<b>{count}</b> not sent yet', other: '<b>{count}</b> not sent yet' },
  'hero.missing': { one: '<b>{count}</b> not caught', other: '<b>{count}</b> not caught' },
  'hero.missingGame': { one: '<b>{count}</b> not caught in {game}', other: '<b>{count}</b> not caught in {game}' },
  'hero.missingShiny': { one: '<b>{count}</b> without a shiny', other: '<b>{count}</b> without a shiny' },
  'hero.missingShinyGame': { one: '<b>{count}</b> without a shiny in {game}', other: '<b>{count}</b> without a shiny in {game}' },
  'hero.mode': 'HOME Dex mode',
  'hero.mode.normal': 'HOME Dex',

  // ---- Filters.
  'filters.label': 'Show',
  // Stands in for "Not caught" in the Shiny HOME Dex.
  'filters.noShiny': 'No shiny',
  'hint': 'Click a caught Pokémon to mark it as in Pokémon HOME, and again to take the mark off.',

  // ---- Toasts. {box} is the name of a box ("Box 3").
  'saveFailed': 'That could not be saved',
  'box.marked': '{box} marked as in HOME',
  'box.marked.body': { one: '{count} Pokémon marked. Undo takes the mark off again.', other: '{count} Pokémon marked. Undo takes the mark off again.' },
  'box.undo': 'Undo',
  'box.unmarked': '{box} unmarked',
  'box.unmarked.body': { one: '{count} Pokémon no longer marked as in HOME.', other: '{count} Pokémon no longer marked as in HOME.' },

  // ---- Empty states.
  'empty.noSlots.title': 'No Pokémon to show',
  'empty.noSlots.description': 'The Pokédex data holds no Pokémon, so there are no slots to fill yet.',
  'empty.game.title': 'Nothing to collect in {game}',
  'empty.game.description': 'No Pokémon in your Living Dex can be obtained in this game without an event.',
  'empty.gameNothing.title': 'Nothing caught in {game} yet',
  'empty.gameNothing.description': 'Only Pokémon obtained in {game} are counted here. Log a catch from that game and it appears, ready to be marked as sent.',
  'empty.noShiny.title': 'No shiny Pokémon yet',
  'empty.noShiny.description': 'The Shiny HOME Dex counts shiny Pokémon only. Log a catch as shiny and it shows up here, ready to be marked as sent.',
  'empty.noShiny.action': 'Show the regular HOME Dex',
  'empty.nothing.title': 'Nothing to send yet',
  'empty.nothing.description': 'The HOME Dex shows which of your Pokémon you have sent to Pokémon HOME. Log a catch first; it then appears here, and one click marks it as sent.',
  'empty.nothing.action': 'Open the Pokédex',
  'empty.filter.home.title': 'Nothing in HOME yet',
  'empty.filter.home.description': 'Mark a caught Pokémon as sent and it is listed here.',
  'empty.filter.pending.title': 'Everything you caught is in HOME',
  'empty.filter.pending.description': 'There is nothing left to send.',
  'empty.filter.missing.title': 'Nothing is missing',
  'empty.filter.missing.description': 'Every slot is filled.',
  'empty.filter.action': 'Show every slot'
} satisfies Messages

export default messages
