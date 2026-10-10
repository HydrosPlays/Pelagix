import type { Translation } from '../en'

const messages: Translation<'living'> = {
  'box.name': 'Box {number}',
  'box.nameOfDex': 'Box {number} im {dex}',
  'box.nameOfOther': 'Box {number} der weiteren Pokémon in {game}',
  'box.mark': 'Box {number} als in HOME markieren',
  'box.markOfDex': 'Box {number} im {dex} als in HOME markieren',
  'box.markOfOther': 'Box {number} der weiteren Pokémon in {game} als in HOME markieren',
  'box.markHint': 'Box als in HOME markieren',
  'box.markShort': 'Box markieren',
  'box.status.complete': 'Vollständig',
  'box.complete': '{box} vollständig',
  'box.completeUnnamed': 'Box vollständig',
  'box.complete.body': { one: 'Der einzige Platz ist gefüllt ({count}).', other: 'Alle {count} Plätze sind gefüllt.' },

  'status.caught': 'Gefangen',
  'status.caughtCount': { one: 'Gefangen · {count} Eintrag', other: 'Gefangen · {count} Einträge' },
  'status.missing': 'Noch nicht gefangen',
  'status.shinyCaught': 'Schillernd gefangen',
  'status.shinyCaughtCount': { one: 'Schillernd gefangen · {count} schillernder Eintrag', other: 'Schillernd gefangen · {count} schillernde Einträge' },
  'status.noShiny': 'Noch kein Schillerndes',
  'status.noShinyRegular': { one: 'Noch kein Schillerndes · {count} normaler Eintrag', other: 'Noch kein Schillerndes · {count} normale Einträge' },
  'status.withEntries': { one: '{status} · {count} Eintrag', other: '{status} · {count} Einträge' },
  'slot.label': '{slot}, {status}',

  'rules.preset': 'Vorgabe „{preset}“',
  'rules.custom': 'Eigene Regeln',
  'rules.line': { one: '{rules} · {count} Platz', other: '{rules} · {count} Plätze' },
  'rules.lineInGame': { one: '{rules} · {count} Platz in {game} erhältlich', other: '{rules} · {count} Plätze in {game} erhältlich' },
  'rules.change': 'Regeln ändern',

  'hero.title': 'Living Dex',
  'hero.titleShiny': 'Schillernder Living Dex',
  'hero.ring': 'Fortschritt im Living Dex',
  'hero.ringShiny': 'Fortschritt im Schillernden Living Dex',
  'hero.count': { one: '{filled} von {count} gefangen', other: '{filled} von {count} gefangen' },
  'hero.countShiny': { one: '{filled} von {count} schillernd gefangen', other: '{filled} von {count} schillernd gefangen' },
  'hero.countGame': { one: '{filled} von {count} in {game} gefangen', other: '{filled} von {count} in {game} gefangen' },
  'hero.countShinyGame': { one: '{filled} von {count} schillernd in {game} gefangen', other: '{filled} von {count} schillernd in {game} gefangen' },
  'hero.unit': 'gefangen',
  'hero.unitShiny': 'schillernd gefangen',
  'hero.unitGame': 'in {game} gefangen',
  'hero.unitShinyGame': 'schillernd in {game} gefangen',
  'hero.anyColour': { one: '<b>{count}</b> in beliebiger Farbe gefangen', other: '<b>{count}</b> in beliebiger Farbe gefangen' },
  'hero.shiny': { one: '<b>{count}</b> schillernd', other: '<b>{count}</b> schillernd' },
  'hero.toGo': { one: 'Noch {count} offen', other: 'Noch {count} offen' },
  'hero.done': 'Nichts mehr zu fangen',
  'hero.mode': 'Modus des Living Dex',
  'hero.mode.normal': 'Living Dex',
  'hero.boxesComplete': 'Vollständige Boxen',
  'hero.species': 'Arten',
  'hero.speciesShiny': 'Schillernde Arten',

  'notice.rules': {
    one: '<b>Deine Living-Dex-Regeln haben sich geändert.</b> Es ist jetzt {count} Platz zu füllen (vorher {before}). Nichts von dem, was du eingetragen hast, ging verloren.',
    other: '<b>Deine Living-Dex-Regeln haben sich geändert.</b> Es sind jetzt {count} Plätze zu füllen (vorher {before}). Nichts von dem, was du eingetragen hast, ging verloren.'
  },
  'notice.data': {
    one: '<b>Die Pokédex-Daten wurden aktualisiert.</b> Es ist jetzt {count} Platz zu füllen (vorher {before}). Nichts von dem, was du eingetragen hast, ging verloren.',
    other: '<b>Die Pokédex-Daten wurden aktualisiert.</b> Es sind jetzt {count} Plätze zu füllen (vorher {before}). Nichts von dem, was du eingetragen hast, ging verloren.'
  },
  'notice.review': 'Regeln prüfen',
  'notice.dismiss': 'Ausblenden',
  'complete.all': {
    one: '<b>Living Dex vollständig!</b> Der einzige Platz ({count}) ist gefüllt. Das ist die ganze Sammlung.',
    other: '<b>Living Dex vollständig!</b> Jeder der {count} Plätze ist gefüllt. Das ist die ganze Sammlung.'
  },
  'complete.game': {
    one: '<b>Living Dex vollständig!</b> Der einzige Platz ({count}) ist gefüllt. Das ist alles, was in {game} erhältlich ist.',
    other: '<b>Living Dex vollständig!</b> Jeder der {count} Plätze ist gefüllt. Das ist alles, was in {game} erhältlich ist.'
  },
  'complete.shinyAll': {
    one: '<b>Schillernder Living Dex vollständig!</b> Der einzige Platz ({count}) ist mit einem Schillernden gefüllt. Das ist die ganze Sammlung.',
    other: '<b>Schillernder Living Dex vollständig!</b> Jeder der {count} Plätze ist mit einem Schillernden gefüllt. Das ist die ganze Sammlung.'
  },
  'complete.shinyGame': {
    one: '<b>Schillernder Living Dex vollständig!</b> Der einzige Platz ({count}) ist mit einem Schillernden gefüllt. Das ist alles, was in {game} erhältlich ist.',
    other: '<b>Schillernder Living Dex vollständig!</b> Jeder der {count} Plätze ist mit einem Schillernden gefüllt. Das ist alles, was in {game} erhältlich ist.'
  },
  'waiting': '<b>Dein Living Dex wartet.</b> Suche ein Pokémon im Pokédex, wähle das Spiel und den Ort, an dem du es gefangen hast, und es landet hier auf seinem Platz.',
  'openPokedex': 'Pokédex öffnen',
  'gameEmpty': '<b>Noch nichts in {game} gefangen.</b> Nur Pokémon, die du in {game} erhalten hast, füllen hier einen Platz; was du in anderen Spielen gefangen hast, bleibt im gesamten Living Dex.',
  'gameEmptyShiny': '<b>Noch keine Schillernden Pokémon aus {game}.</b> Nur Pokémon, die du in {game} erhalten hast, füllen hier einen Platz; was du in anderen Spielen gefangen hast, bleibt im gesamten Living Dex.',
  'noShiny': {
    one: '<b>Noch keine Schillernden Pokémon.</b> Trage einen Fang als schillernd ein, dann leuchtet sein Platz hier auf. Dein {count} gefüllter Platz bleibt im normalen Living Dex.',
    other: '<b>Noch keine Schillernden Pokémon.</b> Trage einen Fang als schillernd ein, dann leuchtet sein Platz hier auf. Deine {count} gefüllten Plätze bleiben im normalen Living Dex.'
  },
  'logShiny': 'Schillerndes eintragen',
  'unplaced': {
    one: '{count} Eintrag gehört zu einem Pokémon, das diese Version noch nicht kennt. Er bleibt sicher in deinem <link>Journal</link>.',
    other: '{count} Einträge gehören zu Pokémon, die diese Version noch nicht kennt. Sie bleiben sicher in deinem <link>Journal</link>.'
  },

  'empty.noSlots.title': 'Keine Pokémon vorhanden',
  'empty.noSlots.description': 'Die Pokédex-Daten enthalten keine Pokémon, also gibt es noch keine Plätze zu füllen.',
  'empty.game.title': 'In {game} gibt es nichts zu sammeln',
  'empty.game.titleUnknown': 'In diesem Spiel gibt es nichts zu sammeln',
  'empty.game.description': 'Kein Pokémon deines Living Dex ist in diesem Spiel ohne Event erhältlich.',
  'empty.nothingMissing.title': 'Es fehlt nichts',
  'empty.nothingMissing.description': 'Jeder Platz ist gefüllt. Es gibt nichts mehr zu fangen.',
  'empty.nothingMissing.descriptionShiny': 'Auf jedem Platz sitzt ein Schillerndes. Es gibt nichts mehr zu jagen.',
  'empty.showEverySlot': 'Alle Plätze zeigen',
  'find.title': 'Alle Plätze werden gezeigt',
  'find.body': '{name} ist bereits gefangen, daher wurde „Nur fehlende“ ausgeschaltet.',
  'find.bodyUnnamed': 'Dieses Pokémon ist bereits gefangen, daher wurde „Nur fehlende“ ausgeschaltet.',

  'toolbar.view': 'Ansicht',
  'toolbar.view.boxes': 'Boxen',
  'toolbar.view.list': 'Liste',
  'toolbar.missingOnly': 'Nur fehlende',
  'toolbar.jumpDex': 'Zu einem Pokédex springen',
  'toolbar.jumpGeneration': 'Zu einer Generation springen',
  'toolbar.generation': { one: '{generation}, {filled} von {count} gefangen', other: '{generation}, {filled} von {count} gefangen' },
  'toolbar.find.label': 'Pokémon in deinem Living Dex finden',
  'toolbar.find.placeholder': 'Pokémon finden…',
  'toolbar.find.empty': 'Kein Pokémon mit diesem Namen',
  'toolbar.boxIndex': 'Box-Übersicht',
  'toolbar.box': { one: '{box}, {range}, {filled} von {count} gefangen', other: '{box}, {range}, {filled} von {count} gefangen' },
  'toolbar.boxComplete': '{box}, {range}, vollständig',
  'toolbar.tip.complete': 'Vollständig',
  'toolbar.tip.caught': { one: '{filled} / {count} gefangen', other: '{filled} / {count} gefangen' },
  'toolbar.tip.shinyCaught': { one: '{filled} / {count} schillernd gefangen', other: '{filled} / {count} schillernd gefangen' },

  'grid.label': 'Plätze im Living Dex',
  'grid.labelShiny': 'Plätze im Schillernden Living Dex',
  'grid.labelHome': 'Plätze im HOME Dex',
  'grid.labelHomeShiny': 'Plätze im Schillernden HOME Dex',
  'grid.hint': 'Mit den Pfeiltasten wechselst du zwischen den Plätzen, mit Enter öffnest du einen.',
  'grid.hintHome': 'Mit den Pfeiltasten wechselst du zwischen den Plätzen. Enter markiert ein gefangenes Pokémon als in Pokémon HOME oder öffnet den Platz, wenn er mehrere oder keine Einträge enthält.',
  'grid.otherPokemon': 'Weitere Pokémon',
  'grid.missing': { one: '{count} fehlt', other: '{count} fehlen' },

  'drawer.place': '{box} · Reihe {row}, Spalte {column}',
  'drawer.previous': 'Vorheriger Platz',
  'drawer.next': 'Nächster Platz',
  'drawer.find': 'Wo du es findest',
  'drawer.log': 'Dieses Pokémon eintragen',
  'drawer.gmax': 'Gigadynamax',
  'drawer.shinyOwned': 'Schillerndes im Besitz',
  'drawer.entries': 'Einträge auf diesem Platz',
  'drawer.empty': 'Keine Einträge auf diesem Platz. Eines gefangen? Wähle <b>Dieses Pokémon eintragen</b>, und es landet direkt auf diesem Platz.',
  'drawer.emptyIdle': 'Hier ist noch nichts eingetragen. Eines gefangen? Wähle <b>Dieses Pokémon eintragen</b>, und es landet direkt auf diesem Platz.',
  'drawer.regularOnly': {
    one: 'Du hast hier {count} normalen Eintrag. Im Schillernden Living Dex füllt nur ein schillernder diesen Platz.',
    other: 'Du hast hier {count} normale Einträge. Im Schillernden Living Dex füllt nur ein schillernder diesen Platz.'
  },
  'drawer.inHome': 'In Pokémon HOME'
}

export default messages
