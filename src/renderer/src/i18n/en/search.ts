import type { Messages } from '../types'

/** English text of the "search" namespace (the Ctrl+K command palette). Full key: "search.<key>". See ../README.md. */
const messages = {
  'label': 'Search and commands',
  'input': 'Search Pokémon, pages and actions',
  'results': 'Results',
  'empty.title': 'Nothing matches “{query}”',
  'empty.hint': 'Try a Pokémon’s name or dex number, or a page such as Journal.',
  // Footer: <keys/> is the key to press.
  'footer.move': '<keys/> Move',
  'footer.open': '<keys/> Open',
  'footer.close': '<keys/> Close',
  // Announced while typing.
  'status.none': 'No results',
  'status.count': { one: '{count} result', other: '{count} results' },

  'section.pokemon': 'Pokémon',
  'section.recent': 'Recently opened',
  'section.pages': 'Pages',
  'section.actions': 'Actions',

  'row.shiny': 'Shiny logged',
  'row.missing': 'Not caught yet',

  // Actions. {name} is a Pokémon.
  'action.log': 'Log a catch for {name}',
  'action.shiny.on': 'Turn shiny view on',
  'action.shiny.off': 'Turn shiny view off',
  'action.theme.light': 'Switch to the light theme',
  'action.theme.dark': 'Switch to the dark theme',
  'action.motion.on': 'Turn reduced motion on',
  'action.motion.off': 'Turn reduced motion off',
  // The current state, printed at the end of the row.
  'hint.on': 'On',
  'hint.off': 'Off',
  'hint.dark': 'Dark',
  'hint.light': 'Light',

  'toast.shiny.on': 'Shiny view is on',
  'toast.shiny.on.body': 'Pokémon are shown in their shiny colours.',
  'toast.shiny.off': 'Shiny view is off',
  'toast.motion.on': 'Reduced motion is on',
  'toast.motion.off': 'Reduced motion is off',

  // Extra words a page or an action is found by, separated by spaces: lower case, no punctuation. Never shown.
  // The English words keep working in every language, so list the words a user of this language would type.
  'keywords.page.home': 'dashboard overview start progress',
  'keywords.page.dex': 'pokedex pokemon browse species list',
  'keywords.page.living': 'boxes collection forms slots',
  'keywords.page.homedex': 'pokemon home sent transferred stored bank boxes',
  'keywords.page.journal': 'entries log history catches diary',
  'keywords.page.achievements': 'trophies medals badges goals',
  'keywords.page.settings': 'preferences options rules theme import export backup',
  'keywords.action.log': 'log catch add new entry caught',
  'keywords.action.shiny': 'toggle shiny view sprites renders',
  'keywords.action.theme': 'toggle switch theme dark light appearance mode',
  'keywords.action.motion': 'toggle reduce reduced motion animation animations',
  // What "Log a catch" is found by when no Pokémon is named.
  'keywords.logPhrase': 'log a catch'
} satisfies Messages

export default messages
