import type { Messages } from '../types'

/** English text of the "gamesave" namespace (import from a game save, import from ShinyDex). Full key: "gamesave.<key>". See ../README.md. */
const messages = {
  // Why a game save could not be read (error toast body).
  'failure.not-a-save': 'That file is not a save of a Pokémon game that Pelagix can read.',
  'failure.too-large': 'That file is too large to be a game save.',
  'failure.unreadable': 'That file could not be opened. Another program may be using it.',
  'failure.reader-missing': 'The part of Pelagix that reads game saves is missing. Installing Pelagix again puts it back.',
  'failure.reader-failed': 'Something went wrong while reading that save.',
  'failure.timed-out': 'Reading that save took too long and was stopped.',
  // Why a ShinyDex file could not be read.
  'shinydexFailure.not-shinydex': 'That file is neither a ShinyDex export nor a saved ShinyDex History page: no shinies were found in it.',
  'shinydexFailure.too-large': 'That file is too large to be a ShinyDex export or a saved ShinyDex page.',
  'shinydexFailure.unreadable': 'That file could not be opened. Another program may be using it.',
  'shinydexFailure.other': 'Something went wrong while reading that file.',

  // The preview window.
  'dialog.title': 'Import these Pokémon?',
  'dialog.add': { one: 'Add {count} entry', other: 'Add {count} entries' },
  'dialog.complete': { one: 'Complete {count} earlier entry', other: 'Complete {count} earlier entries' },
  'dialog.nothing': 'Nothing to add',
  'dialog.failed': 'The Pokémon could not be added',

  // The chips that count what is in the file.
  'counts.new': { one: '{count} new', other: '{count} new' },
  'counts.fills': { one: '{count} fills an empty Living Dex slot', other: '{count} fill an empty Living Dex slot' },
  'counts.imported': { one: '{count} already imported', other: '{count} already imported' },
  'counts.completes': { one: '{count} earlier entry gets missing details added', other: '{count} earlier entries get missing details added' },
  'counts.egg': { one: '{count} egg skipped', other: '{count} eggs skipped' },
  'counts.unsupported': { one: '{count} cannot be imported', other: '{count} cannot be imported' },

  'ask.label': 'Which game are these from?',
  'ask.hint': 'This save does not record the exact game of some Pokémon. Your answer is used for the ones that can be from that game.',
  'ask.placeholder': 'Choose a game…',

  // {chosen} of the {total} new Pokémon are ticked.
  'bar.chosen': '{chosen} of {total} new chosen',
  'bar.allNew': 'All new',
  'bar.onlyEmpty': 'Only empty slots',

  // One row of the list.
  'row.import': 'Import {name}',
  'row.nickname': '“{nickname}”',
  // An egg in a save: {species} is the Pokémon inside.
  'row.eggOf': '{species} Egg',
  'row.egg': 'Egg',
  'row.unknownPokemon': 'Unknown Pokémon',
  'status.new': 'New',
  'status.newSlot': 'New slot',
  'status.imported': 'Already imported',
  'status.completes': 'Adds missing details',
  'status.egg': 'Egg',
  'status.eggSkipped': 'Egg, skipped',
  'status.unsupported': 'Cannot be imported',

  // Why a row cannot be imported.
  'reason.unreadable': 'It could not be read.',
  'reason.unknownPokemon': 'Pelagix does not know this Pokémon.',
  'reason.unknownForm': 'Pelagix does not know this form.',
  'reason.untrackedGame': 'It comes from a game that Pelagix does not track.',
  'reason.wrongGame': 'It cannot be from the game you chose.',
  'reason.askGame': 'The save does not say which game it is from. Choose one above.',
  'reason.gameNotRecognised': 'Game not recognised.',
  // {game} is the game as the ShinyDex file writes it.
  'reason.gameNotRecognisedNamed': 'Game not recognised ({game}).',
  'reason.noDate': 'Its date could not be read.',

  // A game save, under the window's title. {file} is the file's name, {game} a game's name, source.save.games or source.save.unknownGame.
  'source.save.description': '{file} is a save of {game}. Nothing has changed yet, and the save file is only read.',
  'source.save.descriptionTrainer': '{file} is a save of {game}, trainer {trainer}. Nothing has changed yet, and the save file is only read.',
  // A save shared by several versions: {names} is their short names joined with " / " ("Red / Green / Blue").
  'source.save.games': 'Pokémon {names}',
  // Goes into {game} above, mid-sentence: "… is a save of a Generation 8 game".
  'source.save.unknownGame': 'a Generation {generation} game',
  'source.save.dropped': { one: '{count} Pokémon in this save could not be read and is left out.', other: '{count} Pokémon in this save could not be read and are left out.' },
  'source.save.empty': 'There are no Pokémon in this save.',
  'source.save.list': 'Pokémon in this save',

  // A ShinyDex file. {count} is the number of shinies in it.
  'source.shinydex.export': {
    one: '{file} is a ShinyDex export with {count} shiny Pokémon. Nothing has changed yet, and the file is only read. Only its Pokémon are read: game, method, date and whatever details it holds. Your rules, settings and achievements stay as they are.',
    other: '{file} is a ShinyDex export with {count} shiny Pokémon. Nothing has changed yet, and the file is only read. Only its Pokémon are read: game, method, date and whatever details it holds. Your rules, settings and achievements stay as they are.'
  },
  'source.shinydex.page': {
    one: '{file} is a saved ShinyDex history with {count} shiny Pokémon. Nothing has changed yet, and the file is only read. Game, method, date and ball come from ShinyDex; anything else you add by hand.',
    other: '{file} is a saved ShinyDex history with {count} shiny Pokémon. Nothing has changed yet, and the file is only read. Game, method, date and ball come from ShinyDex; anything else you add by hand.'
  },
  'source.shinydex.dropped': { one: 'This file lists more shinies than Pelagix reads at once. The last {count} are left out.', other: 'This file lists more shinies than Pelagix reads at once. The last {count} are left out.' },
  'source.shinydex.unusable': { one: '{count} entry in this file could not be read and is left out.', other: '{count} entries in this file could not be read and are left out.' },
  'source.shinydex.empty': 'There are no shinies in this file.',
  'source.shinydex.list': 'Shinies in this file'
} satisfies Messages

export default messages
