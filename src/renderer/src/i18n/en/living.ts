import type { Messages } from '../types'

/**
 * English text of the "living" namespace (the Living Dex page; its grid, boxes and slot drawer are also used by the HOME Dex).
 * Full key: "living.<key>". See ../README.md. {game} is always a short game name ("Sword").
 */
const messages = {
  // ---- Boxes. {number} is the number of the box; {dex} the name of a regional Pokédex ("Paldea Pokédex").
  'box.name': 'Box {number}',
  'box.nameOfDex': 'Box {number} of the {dex}',
  'box.nameOfOther': 'Box {number} of the other Pokémon obtainable in {game}',
  // The button that marks a whole box (HOME Dex), for a screen reader, and what it shows.
  'box.mark': 'Mark box {number} as in HOME',
  'box.markOfDex': 'Mark box {number} of the {dex} as in HOME',
  'box.markOfOther': 'Mark box {number} of the other Pokémon obtainable in {game} as in HOME',
  'box.markHint': 'Mark box as in HOME',
  'box.markShort': 'Mark box',
  'box.status.complete': 'Complete',
  // A toast. {box} is one of the box names above.
  'box.complete': '{box} complete',
  'box.completeUnnamed': 'Box complete',
  'box.complete.body': { one: 'All {count} slots are filled.', other: 'All {count} slots are filled.' },

  // ---- Where a slot stands.
  'status.caught': 'Caught',
  'status.caughtCount': { one: 'Caught · {count} entry', other: 'Caught · {count} entries' },
  'status.missing': 'Not caught yet',
  'status.shinyCaught': 'Shiny caught',
  'status.shinyCaughtCount': { one: 'Shiny caught · {count} shiny entry', other: 'Shiny caught · {count} shiny entries' },
  'status.noShiny': 'No shiny yet',
  'status.noShinyRegular': { one: 'No shiny yet · {count} regular entry', other: 'No shiny yet · {count} regular entries' },
  // HOME Dex: {status} is a line such as "In Pokémon HOME".
  'status.withEntries': { one: '{status} · {count} entries', other: '{status} · {count} entries' },
  // A slot, for a screen reader: {slot} is "#0025 Pikachu", {status} one of the lines above.
  'slot.label': '{slot}, {status}',

  // ---- The rules in force.
  // {preset} is the name of a rule preset ("Forms").
  'rules.preset': '{preset} preset',
  'rules.custom': 'Custom rules',
  // {rules} is one of the two above.
  'rules.line': { one: '{rules} · {count} slot', other: '{rules} · {count} slots' },
  'rules.lineInGame': { one: '{rules} · {count} slot obtainable in {game}', other: '{rules} · {count} slots obtainable in {game}' },
  'rules.change': 'Change rules',

  // ---- Page header.
  'hero.title': 'Living Dex',
  'hero.titleShiny': 'Shiny Living Dex',
  'hero.ring': 'Living Dex completion',
  'hero.ringShiny': 'Shiny Living Dex completion',
  // Read out for the ring. {count} is the number of slots.
  'hero.count': { one: '{filled} of {count} caught', other: '{filled} of {count} caught' },
  'hero.countShiny': { one: '{filled} of {count} shiny caught', other: '{filled} of {count} shiny caught' },
  'hero.countGame': { one: '{filled} of {count} caught in {game}', other: '{filled} of {count} caught in {game}' },
  'hero.countShinyGame': { one: '{filled} of {count} shiny caught in {game}', other: '{filled} of {count} shiny caught in {game}' },
  // Printed after the two large numbers "12 / 1,367".
  'hero.unit': 'caught',
  'hero.unitShiny': 'shiny caught',
  'hero.unitGame': 'caught in {game}',
  'hero.unitShinyGame': 'shiny caught in {game}',
  'hero.anyColour': { one: '<b>{count}</b> caught in any colour', other: '<b>{count}</b> caught in any colour' },
  'hero.shiny': { one: '<b>{count}</b> shiny', other: '<b>{count}</b> shiny' },
  'hero.toGo': { one: '{count} to go', other: '{count} to go' },
  'hero.done': 'Nothing left to catch',
  'hero.mode': 'Living Dex mode',
  'hero.mode.normal': 'Living Dex',
  'hero.boxesComplete': 'Boxes complete',
  'hero.species': 'Species',
  'hero.speciesShiny': 'Shiny species',

  // ---- Banners.
  // {count} is the number of slots now, {before} what it was.
  'notice.rules': {
    one: '<b>Your Living Dex rules changed.</b> There are now {count} slots to fill ({before} before). Nothing you logged was lost.',
    other: '<b>Your Living Dex rules changed.</b> There are now {count} slots to fill ({before} before). Nothing you logged was lost.'
  },
  'notice.data': {
    one: '<b>The Pokédex data was updated.</b> There are now {count} slots to fill ({before} before). Nothing you logged was lost.',
    other: '<b>The Pokédex data was updated.</b> There are now {count} slots to fill ({before} before). Nothing you logged was lost.'
  },
  'notice.review': 'Review rules',
  'notice.dismiss': 'Dismiss',
  'complete.all': {
    one: '<b>Living Dex complete!</b> Every one of the {count} slots is filled. That is the whole collection.',
    other: '<b>Living Dex complete!</b> Every one of the {count} slots is filled. That is the whole collection.'
  },
  'complete.game': {
    one: '<b>Living Dex complete!</b> Every one of the {count} slots is filled. That is everything obtainable in {game}.',
    other: '<b>Living Dex complete!</b> Every one of the {count} slots is filled. That is everything obtainable in {game}.'
  },
  'complete.shinyAll': {
    one: '<b>Shiny Living Dex complete!</b> Every one of the {count} slots is filled with a shiny. That is the whole collection.',
    other: '<b>Shiny Living Dex complete!</b> Every one of the {count} slots is filled with a shiny. That is the whole collection.'
  },
  'complete.shinyGame': {
    one: '<b>Shiny Living Dex complete!</b> Every one of the {count} slots is filled with a shiny. That is everything obtainable in {game}.',
    other: '<b>Shiny Living Dex complete!</b> Every one of the {count} slots is filled with a shiny. That is everything obtainable in {game}.'
  },
  'waiting': '<b>Your Living Dex is waiting.</b> Find a Pokémon in the Pokédex, pick the game and the place you caught it, and it lands in its slot here.',
  'openPokedex': 'Open the Pokédex',
  'gameEmpty': '<b>Nothing caught in {game} yet.</b> Only Pokémon obtained in {game} fill a slot here; what you caught in other games stays in the full Living Dex.',
  'gameEmptyShiny': '<b>No shiny Pokémon from {game} yet.</b> Only Pokémon obtained in {game} fill a slot here; what you caught in other games stays in the full Living Dex.',
  // {count} is the number of caught slots.
  'noShiny': {
    one: '<b>No shiny Pokémon yet.</b> Log a catch as shiny and its slot lights up here. Your {count} caught slot stay in the regular Living Dex.',
    other: '<b>No shiny Pokémon yet.</b> Log a catch as shiny and its slot lights up here. Your {count} caught slots stay in the regular Living Dex.'
  },
  'logShiny': 'Log a shiny',
  // <link>…</link> opens the Journal page.
  'unplaced': {
    one: '{count} entry is for Pokémon this version does not know yet. It stays safe in your <link>Journal</link>.',
    other: '{count} entries are for Pokémon this version does not know yet. They stay safe in your <link>Journal</link>.'
  },

  // ---- Empty states.
  'empty.noSlots.title': 'No Pokémon to show',
  'empty.noSlots.description': 'The Pokédex data holds no Pokémon, so there are no slots to fill yet.',
  'empty.game.title': 'Nothing to collect in {game}',
  'empty.game.titleUnknown': 'Nothing to collect in this game',
  'empty.game.description': 'No Pokémon in your Living Dex can be obtained in this game without an event.',
  'empty.nothingMissing.title': 'Nothing is missing',
  'empty.nothingMissing.description': 'Every slot is filled. There is nothing left to catch.',
  'empty.nothingMissing.descriptionShiny': 'Every slot holds a shiny. There is nothing left to hunt.',
  'empty.showEverySlot': 'Show every slot',
  // A toast: the search found a slot that "Missing only" was hiding. {name} is a Pokémon.
  'find.title': 'Showing every slot',
  'find.body': '{name} is already caught, so “Missing only” was switched off.',
  'find.bodyUnnamed': 'That Pokémon is already caught, so “Missing only” was switched off.',

  // ---- Toolbar.
  'toolbar.view': 'View',
  'toolbar.view.boxes': 'Boxes',
  'toolbar.view.list': 'List',
  // A switch; the number of missing slots is printed after it.
  'toolbar.missingOnly': 'Missing only',
  'toolbar.jumpDex': 'Jump to a Pokédex',
  'toolbar.jumpGeneration': 'Jump to a generation',
  // One generation tab, for a screen reader. {count} is the number of slots.
  'toolbar.generation': { one: '{generation}, {filled} of {count} caught', other: '{generation}, {filled} of {count} caught' },
  'toolbar.find.label': 'Find a Pokémon in your Living Dex',
  'toolbar.find.placeholder': 'Find a Pokémon…',
  'toolbar.find.empty': 'No Pokémon by that name',
  'toolbar.boxIndex': 'Box index',
  // One cell of the box index, for a screen reader. {box} is a box name, {range} the numbers it holds ("#0001 – #0030").
  'toolbar.box': { one: '{box}, {range}, {filled} of {count} caught', other: '{box}, {range}, {filled} of {count} caught' },
  'toolbar.boxComplete': '{box}, {range}, complete',
  // Its tooltip.
  'toolbar.tip.complete': 'Complete',
  'toolbar.tip.caught': { one: '{filled} / {count} caught', other: '{filled} / {count} caught' },
  'toolbar.tip.shinyCaught': { one: '{filled} / {count} shiny caught', other: '{filled} / {count} shiny caught' },

  // ---- The grid.
  'grid.label': 'Living Dex slots',
  'grid.labelShiny': 'Shiny Living Dex slots',
  'grid.labelHome': 'HOME Dex slots',
  'grid.labelHomeShiny': 'Shiny HOME Dex slots',
  'grid.hint': 'Use the arrow keys to move between slots and Enter to open one.',
  'grid.hintHome': 'Use the arrow keys to move between slots. Enter marks a caught Pokémon as in Pokémon HOME, or opens the slot when it holds several entries or none.',
  // Heading of the slots that belong to no generation.
  'grid.otherPokemon': 'Other Pokémon',
  'grid.missing': { one: '{count} missing', other: '{count} missing' },

  // ---- The drawer of one slot.
  // {box} is a box name.
  'drawer.place': '{box} · Row {row}, Column {column}',
  'drawer.previous': 'Previous slot',
  'drawer.next': 'Next slot',
  'drawer.find': 'Where to find it',
  'drawer.log': 'Log this Pokémon',
  'drawer.gmax': 'Gigantamax',
  'drawer.shinyOwned': 'Shiny owned',
  'drawer.entries': 'Entries in this slot',
  'drawer.empty': 'No entries in this slot. Caught one? <b>Log this Pokémon</b> and it lands right in this slot.',
  'drawer.emptyIdle': 'Nothing logged here yet. Caught one? <b>Log this Pokémon</b> and it lands right in this slot.',
  'drawer.regularOnly': {
    one: 'You have {count} regular entry here. Only a shiny one fills this slot in the Shiny Living Dex.',
    other: 'You have {count} regular entries here. Only a shiny one fills this slot in the Shiny Living Dex.'
  },
  'drawer.inHome': 'In Pokémon HOME'
} satisfies Messages

export default messages
