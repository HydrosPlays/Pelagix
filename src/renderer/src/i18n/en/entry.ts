import type { Messages } from '../types'

/** English text of the "entry" namespace (the entry editor). Full key: "entry.<key>". See ../README.md. */
const messages = {
  // The window.
  'title.edit': 'Edit entry',
  'title.create': 'Log a catch',
  'title.another': 'Log another catch',
  // {date} is a long date ("9 October 2026").
  'description.logged': 'Logged {date}',
  // {name} is the Pokémon, with its form ("Alolan Raichu").
  'description.add': 'Add {name} to your Living Dex.',
  'description.addAny': 'Add a Pokémon to your Living Dex.',
  'preview.eyebrow': 'Preview',
  'preview.label': 'Preview of the entry',

  // Footer.
  // <keys/> is the keyboard shortcut, drawn as key caps (Ctrl Enter).
  'footer.shortcut': '<keys/> saves',
  'footer.saveAnother': 'Save and log another game',
  'footer.saveChanges': 'Save changes',

  // Leaving with unsaved changes.
  'discard.titleEdit': 'Discard your changes?',
  'discard.titleCreate': 'Discard this entry?',
  'discard.descriptionEdit': 'The entry stays as it was saved.',
  'discard.descriptionCreate': 'What you filled in will not be saved.',
  'discard.keep': 'Keep editing',
  'discard.confirm': 'Discard',

  // Section headings.
  'group.pokemon': 'Pokémon',
  'group.where': 'Where and how',
  'group.catch': 'The catch',
  'group.details': 'Details',
  'group.values': 'PID, IVs and EVs',
  'values.hide': 'Hide',
  'values.show': 'Show',
  'values.add': 'Add',

  // Pokémon, form, variant.
  'pokemon.label': 'Pokémon',
  // Read by screen readers just before the Pokémon's name, when the Pokémon is a given.
  'pokemon.prefix': 'Pokémon: ',
  'pokemon.placeholder': 'Search by name or number',
  // The entry holds a Pokémon this version's data does not have: {number} is "#1234".
  'pokemon.missing': 'Pokémon {number} (not in the data)',
  'pokemon.noMatch': 'No Pokémon matches',
  'form.label': 'Form',
  'form.placeholder': 'Choose a form',
  // A base form that has a name of its own: {name} "Burmy", {form} "Plant Cloak".
  'form.named': '{name} ({form})',
  'variant.label': 'Variant',
  'variant.sweet': 'Sweet',

  // Game.
  'game.label': 'Game',
  'game.placeholder': 'Which game did you get it in?',
  'game.noMatch': 'No game matches',
  'game.groupHere': 'Where you can get it',
  'game.groupOther': 'Other',
  'game.eventOnly': 'Event only',
  'game.obtainable': 'Obtainable',
  'game.transferOnly': 'Transfer only',

  // How, method, location.
  'kind.label': 'How you got it',
  'method.label': 'Method',
  'method.placeholder': 'Tall grass, Gift, Max Raid…',
  // Groups of the method list once a location is typed: {place} is that location.
  'method.groupHere': 'At {place}',
  'method.groupElsewhere': 'Elsewhere in this game',
  'method.places': { one: '{count} place', other: '{count} places' },
  'location.label': 'Location',
  'location.placeholder': 'Where was it?',
  // Groups of the location list: {method} is the method chosen, or the way it was obtained ("Wild").
  'location.groupFits': 'With {method}',
  'location.groupOther': 'Other places',
  // The methods available at a place, when there are two.
  'location.twoMethods': '{first}, {second}',
  'location.ways': { one: '{count} way', other: '{count} ways' },

  // The line under method and location.
  'hint.chooseGame': 'Choose a game to see the ways it offers this Pokémon.',
  'hint.failed': 'Suggestions could not be loaded. <retry>Try again</retry>',
  'hint.loading': 'Loading suggestions…',
  // {levels} is lib.format.level or lib.format.levelRange ("Lv. 15–20").
  'hint.known': 'A known way to get it in {game}',
  'hint.knownLevels': 'A known way to get it in {game} · {levels}',
  'hint.knownHere': 'A known way to get it in this game',
  'hint.knownHereLevels': 'A known way to get it in this game · {levels}',
  'hint.transferOnly': 'It cannot be obtained in this game, so describe how you got it in your own words.',
  'hint.noSources': 'No known sources here. Describe it in your own words.',
  'hint.pick': 'Pick a suggestion or type your own.',
  'hint.useSource': "Use this source's ball and details",

  'origin.label': 'Caught as',
  'origin.hint': 'The Pokémon it was when you got it.',
  'notSet': 'Not set',

  // Ball.
  'ball.label': 'Ball',
  // {ball} is a ball's name ("Poké Ball"), {game} a game's name.
  'ball.forced': 'This source always comes in a {ball}.',
  'ball.legal': 'Showing the balls you can use in {game}.',
  'ball.showAll': 'Show all balls',
  'ball.showFewer': 'Show fewer balls',

  // Gender.
  'gender.label': 'Gender',
  'gender.alwaysMale': 'Always male',
  'gender.alwaysFemale': 'Always female',
  'gender.sourceMale': 'This source is always male.',
  'gender.sourceFemale': 'This source is always female.',
  'gender.sourceGenderless': 'This source is always genderless.',

  // Level and date.
  'level.outside': 'Lower than this source gives ({levels}).',
  'level.source': 'This source gives {levels}.',
  'date.label': 'Date caught',

  // Switches.
  'shiny.label': 'Shiny <mark/>',
  'shiny.forced': 'Always shiny from this source.',
  'shiny.locked': 'This one is shiny-locked in the game, so it normally cannot be shiny. It is your record: keep it on if yours really is.',
  'gmax.label': 'Gigantamax',
  'gmax.description': 'It has the Gigantamax Factor.',
  'alpha.label': 'Alpha',
  'alpha.description': 'A larger, red-eyed Alpha Pokémon.',
  'home.label': 'In Pokémon HOME',
  'home.description': 'You have sent this Pokémon to Pokémon HOME.',

  // Details.
  'nickname.label': 'Nickname',
  'nickname.placeholder': 'None',
  'ot.label': 'Original Trainer',
  'ot.placeholder': 'OT name',
  'ability.label': 'Ability',
  'ability.placeholder': 'Type to search',
  'ability.noMatch': 'No ability matches',
  'ability.hidden': 'Hidden Ability',
  'notes.label': 'Notes',
  'notes.placeholder': 'Anything worth remembering about this catch',

  // PID, IVs, EVs.
  'pid.label': 'PID',
  'pid.placeholder': '8 hex digits',
  'pid.hint': 'The personality value, as PKHeX shows it.',
  'stat.hp': 'HP',
  'stat.attack': 'Attack',
  'stat.defense': 'Defense',
  'stat.spAtk': 'Sp. Atk',
  'stat.spDef': 'Sp. Def',
  'stat.speed': 'Speed',
  // The label over each of the six small boxes.
  'stat.short.hp': 'HP',
  'stat.short.attack': 'Atk',
  'stat.short.defense': 'Def',
  'stat.short.spAtk': 'SpA',
  'stat.short.spDef': 'SpD',
  'stat.short.speed': 'Spe',
  // Accessible name of one box: {group} is "IVs" or "EVs", {stat} one of stat.*.
  'stat.box': '{group}: {stat}',
  // The allowed values, printed beside "IVs" / "EVs".
  'stat.range': '0–{max}',

  // What is wrong with the form.
  'error.species': 'Choose a Pokémon.',
  'error.form': 'Choose a form.',
  'error.game': 'Choose the game you got it in.',
  'error.gameList': 'Choose a game from the list.',
  'error.level': 'Use a whole number from 1 to 100.',
  'error.date': 'Enter a real date.',
  'error.dateFuture': 'The date cannot be in the future.',
  'error.pid': 'Use 1 to 8 hex digits (0–9, A–F).',
  'error.ivsPartial': 'Fill in all six IVs, or leave all six empty.',
  'error.ivsRange': 'Use whole numbers from 0 to {max} for the IVs.',
  'error.evsPartial': 'Fill in all six EVs, or leave all six empty.',
  'error.evsRange': 'Use whole numbers from 0 to {max} for the EVs.',

  // Toasts and notes.
  'toast.gone.title': 'That entry no longer exists',
  'toast.gone.body': 'It may have been deleted already.',
  'toast.gone.bodySaving': 'Your changes could not be saved because it was deleted.',
  'toast.saved': 'Changes saved',
  'toast.failed': 'This entry could not be saved',
  // {name} is the Pokémon, "Shiny …" included (lib.entry.shinyName).
  'toast.registered': '{name} registered in your Living Dex',
  // Body of that toast when both the game and the location are known.
  'toast.where': '{game} · {location}',
  'toast.view': 'View',
  'toast.crashed.title': 'The entry editor ran into a problem',
  'toast.crashed.body': 'Nothing was changed. Please try again.',
  // After "Save and log another game".
  'saved.note': '{name} saved in {game}. Pick the next game.',
  'saved.noteUnknownGame': '{name} saved in that game. Pick the next game.'
} satisfies Messages

export default messages
