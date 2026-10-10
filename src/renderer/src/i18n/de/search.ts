import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': 'Suche und Befehle',
  'input': 'Pokémon, Seiten und Aktionen suchen',
  'results': 'Ergebnisse',
  'empty.title': 'Keine Treffer für „{query}“',
  'empty.hint': 'Versuche den Namen oder die Dex-Nummer eines Pokémon oder eine Seite wie „Journal“.',
  'footer.move': '<keys/> Bewegen',
  'footer.open': '<keys/> Öffnen',
  'footer.close': '<keys/> Schließen',
  'status.none': 'Keine Ergebnisse',
  'status.count': { one: '{count} Ergebnis', other: '{count} Ergebnisse' },

  'section.pokemon': 'Pokémon',
  'section.recent': 'Zuletzt geöffnet',
  'section.pages': 'Seiten',
  'section.actions': 'Aktionen',

  'row.shiny': 'Schillerndes eingetragen',
  'row.missing': 'Noch nicht gefangen',

  'action.log': 'Fang für {name} eintragen',
  'action.shiny.on': 'Schillernd-Ansicht einschalten',
  'action.shiny.off': 'Schillernd-Ansicht ausschalten',
  'action.theme.light': 'Zum hellen Design wechseln',
  'action.theme.dark': 'Zum dunklen Design wechseln',
  'action.motion.on': 'Reduzierte Bewegung einschalten',
  'action.motion.off': 'Reduzierte Bewegung ausschalten',
  'hint.on': 'An',
  'hint.off': 'Aus',
  'hint.dark': 'Dunkel',
  'hint.light': 'Hell',

  'toast.shiny.on': 'Schillernd-Ansicht ist an',
  'toast.shiny.on.body': 'Pokémon werden in ihren schillernden Farben gezeigt.',
  'toast.shiny.off': 'Schillernd-Ansicht ist aus',
  'toast.motion.on': 'Reduzierte Bewegung ist an',
  'toast.motion.off': 'Reduzierte Bewegung ist aus',

  'keywords.page.home': 'start startseite übersicht dashboard fortschritt',
  'keywords.page.dex': 'pokedex pokémon pokemon stöbern arten liste',
  'keywords.page.living': 'boxen sammlung formen plätze',
  'keywords.page.homedex': 'pokemon pokémon home gesendet übertragen gelagert bank boxen',
  'keywords.page.journal': 'einträge tagebuch verlauf fänge protokoll logbuch',
  'keywords.page.achievements': 'erfolge trophäen medaillen orden abzeichen ziele',
  'keywords.page.settings': 'einstellungen optionen regeln design sprache import export backup sicherung',
  'keywords.action.log': 'eintragen fang fangen hinzufügen neu neuer eintrag gefangen',
  'keywords.action.shiny': 'umschalten schillernd shiny ansicht sprites bilder',
  'keywords.action.theme': 'umschalten wechseln design thema dunkel hell aussehen modus',
  'keywords.action.motion': 'umschalten reduzieren reduzierte bewegung animation animationen',
  'keywords.logPhrase': 'fang eintragen'
}

export default messages
