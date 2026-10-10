import type { Messages } from '../types'

/** English text of the "shell" namespace. Full key: "shell.<key>". See ../README.md. */
const messages = {
  // Page titles (title bar) and the navigation rail, which share their names.
  'route.home': 'Home',
  'route.dex': 'Pokédex',
  'route.species': 'Pokémon',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME Dex',
  'route.journal': 'Journal',
  'route.achievements': 'Achievements',
  'route.settings': 'Settings',
  'route.kit': 'Component kit',
  'route.notFound': 'Not found',

  'nav.label': 'Main',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '{caught} of {total} caught',
  'nav.progress.tooltip': 'Living Dex: {count} ({percent})',
  'nav.progress.label': 'Living Dex progress: {count}',
  'nav.progress.ring': 'Living Dex completion',

  'topbar.fixture': 'Fixture data',
  'topbar.fixtureHint': 'The real datasets were not found, so a small development fixture is loaded. Run npm run data.',
  'topbar.notSaved': 'Not saved',
  'topbar.search': 'Search Pokémon…',
  'topbar.shiny.on': 'Shiny view is on',
  'topbar.shiny.off': 'Shiny view is off',
  'topbar.shiny.showing': 'Showing shiny sprites',
  'topbar.shiny.show': 'Show shiny sprites',

  'skipToContent': 'Skip to content',
  'pageError': 'This page ran into a problem',
  'appError': 'Pelagix ran into a problem',
  'notFound.title': 'Uncharted waters',
  'notFound.description': 'There is no page at this address.',
  'notFound.back': 'Back to Home',

  'boot.step.save': 'Loading your save',
  'boot.step.dex': 'Surfacing Pokédex data',
  'boot.retry': 'Try again',
  'boot.reload': 'Reload app',
  'boot.dataMissing.title': 'The Pokédex datasets are missing',
  'boot.dataMissing.hint': 'Run <code>npm run data</code> to build the datasets, then try again.',
  'boot.dataMissing.detail': 'The dataset could not be loaded.',
  'boot.saveFailed.title': 'Your save could not be loaded',
  'boot.saveFailed.hint': 'Nothing has been overwritten. Make sure the save file is readable, then try again.',

  'loadReport.newer': 'This save comes from a newer Pelagix',
  'loadReport.repaired': 'Your save was repaired while loading',

  // The pop-up that asks for the language once. Shown in the language that is highlighted.
  'language.title': 'Choose your language',
  'language.description': 'Pelagix and the names of Pokémon, games and places will be shown in this language. You can change it later in Settings.',
  'language.list': 'Language',
  'language.confirm': 'Continue'
} satisfies Messages

export default messages
