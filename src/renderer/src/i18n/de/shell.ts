import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': 'Start',
  'route.dex': 'Pokédex',
  'route.species': 'Pokémon',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME Dex',
  'route.journal': 'Journal',
  'route.achievements': 'Erfolge',
  'route.settings': 'Einstellungen',
  'route.kit': 'Komponenten',
  'route.notFound': 'Nicht gefunden',

  'nav.label': 'Hauptnavigation',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '{caught} von {total} gefangen',
  'nav.progress.tooltip': 'Living Dex: {count} ({percent})',
  'nav.progress.label': 'Fortschritt im Living Dex: {count}',
  'nav.progress.ring': 'Fortschritt im Living Dex',

  'topbar.fixture': 'Testdaten',
  'topbar.fixtureHint': 'Die echten Daten wurden nicht gefunden, daher sind kleine Entwicklungsdaten geladen. Führe npm run data aus.',
  'topbar.notSaved': 'Nicht gespeichert',
  'topbar.search': 'Pokémon suchen…',
  'topbar.shiny.on': 'Schillernd-Ansicht ist an',
  'topbar.shiny.off': 'Schillernd-Ansicht ist aus',
  'topbar.shiny.showing': 'Schillernde Sprites werden gezeigt',
  'topbar.shiny.show': 'Schillernde Sprites zeigen',

  'skipToContent': 'Zum Inhalt springen',
  'pageError': 'Auf dieser Seite ist ein Problem aufgetreten',
  'appError': 'In Pelagix ist ein Problem aufgetreten',
  'notFound.title': 'Unerforschte Gewässer',
  'notFound.description': 'Unter dieser Adresse gibt es keine Seite.',
  'notFound.back': 'Zurück zum Start',

  'boot.step.save': 'Dein Speicherstand wird geladen',
  'boot.step.dex': 'Pokédex-Daten tauchen auf',
  'boot.retry': 'Erneut versuchen',
  'boot.reload': 'App neu laden',
  'boot.dataMissing.title': 'Die Pokédex-Daten fehlen',
  'boot.dataMissing.hint': 'Führe <code>npm run data</code> aus, um die Daten zu erstellen, und versuche es dann noch einmal.',
  'boot.dataMissing.detail': 'Die Daten konnten nicht geladen werden.',
  'boot.saveFailed.title': 'Dein Speicherstand konnte nicht geladen werden',
  'boot.saveFailed.hint': 'Nichts wurde überschrieben. Stelle sicher, dass die Speicherdatei lesbar ist, und versuche es dann noch einmal.',

  'loadReport.newer': 'Dieser Speicherstand stammt aus einem neueren Pelagix',
  'loadReport.repaired': 'Dein Speicherstand wurde beim Laden repariert',

  'language.title': 'Wähle deine Sprache',
  'language.description': 'Pelagix und die Namen von Pokémon, Spielen und Orten werden in dieser Sprache angezeigt. Du kannst sie später in den Einstellungen ändern.',
  'language.list': 'Sprache',
  'language.confirm': 'Weiter'
}

export default messages
