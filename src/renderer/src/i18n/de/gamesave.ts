import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': 'Diese Datei ist kein Spielstand eines Pokémon-Spiels, den Pelagix lesen kann.',
  'failure.too-large': 'Diese Datei ist zu groß für einen Spielstand.',
  'failure.unreadable': 'Diese Datei konnte nicht geöffnet werden. Vielleicht wird sie von einem anderen Programm verwendet.',
  'failure.reader-missing': 'Der Teil von Pelagix, der Spielstände liest, fehlt. Eine Neuinstallation von Pelagix stellt ihn wieder her.',
  'failure.reader-failed': 'Beim Lesen dieses Spielstands ist etwas schiefgelaufen.',
  'failure.timed-out': 'Das Lesen dieses Spielstands hat zu lange gedauert und wurde abgebrochen.',
  'shinydexFailure.not-shinydex': 'Diese Datei ist weder ein ShinyDex-Export noch eine gespeicherte ShinyDex-History-Seite: Darin wurden keine Schillernden gefunden.',
  'shinydexFailure.too-large': 'Diese Datei ist zu groß für einen ShinyDex-Export oder eine gespeicherte ShinyDex-Seite.',
  'shinydexFailure.unreadable': 'Diese Datei konnte nicht geöffnet werden. Vielleicht wird sie von einem anderen Programm verwendet.',
  'shinydexFailure.other': 'Beim Lesen dieser Datei ist etwas schiefgelaufen.',

  'dialog.title': 'Diese Pokémon importieren?',
  'dialog.add': { one: '{count} Eintrag hinzufügen', other: '{count} Einträge hinzufügen' },
  'dialog.complete': { one: '{count} früheren Eintrag ergänzen', other: '{count} frühere Einträge ergänzen' },
  'dialog.nothing': 'Nichts hinzuzufügen',
  'dialog.failed': 'Die Pokémon konnten nicht hinzugefügt werden',

  'counts.new': { one: '{count} neu', other: '{count} neu' },
  'counts.fills': { one: '{count} füllt einen leeren Living-Dex-Platz', other: '{count} füllen einen leeren Living-Dex-Platz' },
  'counts.imported': { one: '{count} bereits importiert', other: '{count} bereits importiert' },
  'counts.completes': { one: '{count} früherer Eintrag erhält fehlende Details', other: '{count} frühere Einträge erhalten fehlende Details' },
  'counts.egg': { one: '{count} Ei übersprungen', other: '{count} Eier übersprungen' },
  'counts.unsupported': { one: '{count} nicht importierbar', other: '{count} nicht importierbar' },

  'ask.label': 'Aus welchem Spiel stammen sie?',
  'ask.hint': 'Dieser Spielstand hält bei manchen Pokémon nicht das genaue Spiel fest. Deine Antwort gilt für alle, die aus diesem Spiel stammen können.',
  'ask.placeholder': 'Spiel wählen…',

  'bar.chosen': '{chosen} von {total} neuen gewählt',
  'bar.allNew': 'Alle neuen',
  'bar.onlyEmpty': 'Nur leere Plätze',

  'row.import': '{name} importieren',
  'row.nickname': '„{nickname}“',
  'row.eggOf': '{species}-Ei',
  'row.egg': 'Ei',
  'row.unknownPokemon': 'Unbekanntes Pokémon',
  'status.new': 'Neu',
  'status.newSlot': 'Neuer Platz',
  'status.imported': 'Bereits importiert',
  'status.completes': 'Ergänzt fehlende Details',
  'status.egg': 'Ei',
  'status.eggSkipped': 'Ei, übersprungen',
  'status.unsupported': 'Nicht importierbar',

  'reason.unreadable': 'Es konnte nicht gelesen werden.',
  'reason.unknownPokemon': 'Pelagix kennt dieses Pokémon nicht.',
  'reason.unknownForm': 'Pelagix kennt diese Form nicht.',
  'reason.untrackedGame': 'Es stammt aus einem Spiel, das Pelagix nicht erfasst.',
  'reason.wrongGame': 'Es kann nicht aus dem gewählten Spiel stammen.',
  'reason.askGame': 'Der Spielstand verrät nicht, aus welchem Spiel es stammt. Wähle oben eines aus.',
  'reason.gameNotRecognised': 'Spiel nicht erkannt.',
  'reason.gameNotRecognisedNamed': 'Spiel nicht erkannt ({game}).',
  'reason.noDate': 'Das Datum konnte nicht gelesen werden.',

  'source.save.description': '{file} ist ein Spielstand von {game}. Noch wurde nichts geändert, und der Spielstand wird nur gelesen.',
  'source.save.descriptionTrainer': '{file} ist ein Spielstand von {game}, Trainer {trainer}. Noch wurde nichts geändert, und der Spielstand wird nur gelesen.',
  'source.save.games': 'Pokémon {names}',
  'source.save.unknownGame': 'einem Spiel der Generation {generation}',
  'source.save.dropped': { one: '{count} Pokémon in diesem Spielstand konnte nicht gelesen werden und wird ausgelassen.', other: '{count} Pokémon in diesem Spielstand konnten nicht gelesen werden und werden ausgelassen.' },
  'source.save.empty': 'In diesem Spielstand sind keine Pokémon.',
  'source.save.list': 'Pokémon in diesem Spielstand',

  'source.shinydex.export': {
    one: '{file} ist ein ShinyDex-Export mit {count} Schillernden Pokémon. Noch wurde nichts geändert, und die Datei wird nur gelesen. Gelesen werden nur die Pokémon: Spiel, Methode, Datum und alle enthaltenen Details. Deine Regeln, Einstellungen und Erfolge bleiben, wie sie sind.',
    other: '{file} ist ein ShinyDex-Export mit {count} Schillernden Pokémon. Noch wurde nichts geändert, und die Datei wird nur gelesen. Gelesen werden nur die Pokémon: Spiel, Methode, Datum und alle enthaltenen Details. Deine Regeln, Einstellungen und Erfolge bleiben, wie sie sind.'
  },
  'source.shinydex.page': {
    one: '{file} ist eine gespeicherte ShinyDex-History mit {count} Schillernden Pokémon. Noch wurde nichts geändert, und die Datei wird nur gelesen. Spiel, Methode, Datum und Ball kommen von ShinyDex; alles andere ergänzt du von Hand.',
    other: '{file} ist eine gespeicherte ShinyDex-History mit {count} Schillernden Pokémon. Noch wurde nichts geändert, und die Datei wird nur gelesen. Spiel, Methode, Datum und Ball kommen von ShinyDex; alles andere ergänzt du von Hand.'
  },
  'source.shinydex.dropped': { one: 'Diese Datei führt mehr Schillernde auf, als Pelagix auf einmal liest. Das letzte ({count}) wird ausgelassen.', other: 'Diese Datei führt mehr Schillernde auf, als Pelagix auf einmal liest. Die letzten {count} werden ausgelassen.' },
  'source.shinydex.unusable': { one: '{count} Eintrag in dieser Datei konnte nicht gelesen werden und wird ausgelassen.', other: '{count} Einträge in dieser Datei konnten nicht gelesen werden und werden ausgelassen.' },
  'source.shinydex.empty': 'In dieser Datei sind keine Schillernden.',
  'source.shinydex.list': 'Schillernde in dieser Datei'
}

export default messages
