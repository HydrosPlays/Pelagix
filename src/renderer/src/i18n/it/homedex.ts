import type { Translation } from '../en'

const messages: Translation<'homedex'> = {
  'hero.title': 'HOME Dex',
  'hero.titleShiny': 'HOME Dex cromatico',
  'hero.ring': 'Completamento dello HOME Dex',
  'hero.ringShiny': 'Completamento dello HOME Dex cromatico',
  'hero.count': { one: '{inHome} su {count} in HOME', many: '{inHome} su {count} in HOME', other: '{inHome} su {count} in HOME' },
  'hero.countShiny': {
    one: '{inHome} su {count} cromatico in HOME',
    many: '{inHome} su {count} cromatici in HOME',
    other: '{inHome} su {count} cromatici in HOME'
  },
  'hero.countGame': {
    one: '{inHome} su {count} da {game} in HOME',
    many: '{inHome} su {count} da {game} in HOME',
    other: '{inHome} su {count} da {game} in HOME'
  },
  'hero.countShinyGame': {
    one: '{inHome} su {count} cromatico da {game} in HOME',
    many: '{inHome} su {count} cromatici da {game} in HOME',
    other: '{inHome} su {count} cromatici da {game} in HOME'
  },
  'hero.unit': 'in HOME',
  'hero.unitShiny': 'cromatici in HOME',
  'hero.unitGame': 'da {game} in HOME',
  'hero.unitShinyGame': 'cromatici da {game} in HOME',
  'hero.pending': {
    one: '<b>{count}</b> da inviare',
    many: '<b>{count}</b> da inviare',
    other: '<b>{count}</b> da inviare'
  },
  'hero.missing': {
    one: '<b>{count}</b> non catturato',
    many: '<b>{count}</b> non catturati',
    other: '<b>{count}</b> non catturati'
  },
  'hero.missingGame': {
    one: '<b>{count}</b> non catturato in {game}',
    many: '<b>{count}</b> non catturati in {game}',
    other: '<b>{count}</b> non catturati in {game}'
  },
  'hero.missingShiny': {
    one: '<b>{count}</b> senza cromatico',
    many: '<b>{count}</b> senza cromatico',
    other: '<b>{count}</b> senza cromatico'
  },
  'hero.missingShinyGame': {
    one: '<b>{count}</b> senza cromatico in {game}',
    many: '<b>{count}</b> senza cromatico in {game}',
    other: '<b>{count}</b> senza cromatico in {game}'
  },
  'hero.mode': 'Modalità dello HOME Dex',
  'hero.mode.normal': 'HOME Dex',

  'filters.label': 'Mostra',
  'filters.noShiny': 'Senza cromatico',
  'hint': 'Fai clic su un Pokémon catturato per segnarlo come presente in Pokémon HOME, e di nuovo per togliere il segno.',

  'saveFailed': 'Impossibile salvare',
  'box.marked': '{box} segnato come in HOME',
  'box.marked.body': {
    one: '{count} Pokémon segnato. Annulla toglie di nuovo il segno.',
    many: '{count} Pokémon segnati. Annulla toglie di nuovo il segno.',
    other: '{count} Pokémon segnati. Annulla toglie di nuovo il segno.'
  },
  'box.undo': 'Annulla',
  'box.unmarked': 'Segno tolto: {box}',
  'box.unmarked.body': {
    one: '{count} Pokémon non è più segnato come in HOME.',
    many: '{count} Pokémon non sono più segnati come in HOME.',
    other: '{count} Pokémon non sono più segnati come in HOME.'
  },

  'empty.noSlots.title': 'Nessun Pokémon da mostrare',
  'empty.noSlots.description': 'I dati del Pokédex non contengono Pokémon, quindi non ci sono ancora slot da riempire.',
  'empty.game.title': 'Niente da collezionare in {game}',
  'empty.game.description': 'Nessun Pokémon del tuo Living Dex si può ottenere in questo gioco senza un evento.',
  'empty.gameNothing.title': 'Ancora nessuna cattura in {game}',
  'empty.gameNothing.description': 'Qui contano solo i Pokémon ottenuti in {game}. Registra una cattura di quel gioco e comparirà, pronta per essere segnata come inviata.',
  'empty.noShiny.title': 'Ancora nessun Pokémon cromatico',
  'empty.noShiny.description': 'Lo HOME Dex cromatico conta solo i Pokémon cromatici. Registra una cattura come cromatica e comparirà qui, pronta per essere segnata come inviata.',
  'empty.noShiny.action': 'Mostra lo HOME Dex normale',
  'empty.nothing.title': 'Ancora niente da inviare',
  'empty.nothing.description': 'Lo HOME Dex mostra quali dei tuoi Pokémon hai inviato a Pokémon HOME. Registra prima una cattura: comparirà qui e con un clic la segni come inviata.',
  'empty.nothing.action': 'Apri il Pokédex',
  'empty.filter.home.title': 'Ancora niente in HOME',
  'empty.filter.home.description': 'Segna un Pokémon catturato come inviato e sarà elencato qui.',
  'empty.filter.pending.title': 'Tutto ciò che hai catturato è in HOME',
  'empty.filter.pending.description': 'Non resta niente da inviare.',
  'empty.filter.missing.title': 'Non manca niente',
  'empty.filter.missing.description': 'Ogni slot è pieno.',
  'empty.filter.action': 'Mostra tutti gli slot'
}

export default messages
