import type { Translation } from '../en'

const messages: Translation<'living'> = {
  'box.name': 'Box {number}',
  'box.nameOfDex': 'Box {number} del {dex}',
  'box.nameOfOther': 'Box {number} degli altri Pokémon ottenibili in {game}',
  'box.mark': 'Segna il Box {number} come in HOME',
  'box.markOfDex': 'Segna il Box {number} del {dex} come in HOME',
  'box.markOfOther': 'Segna il Box {number} degli altri Pokémon ottenibili in {game} come in HOME',
  'box.markHint': 'Segna il Box come in HOME',
  'box.markShort': 'Segna Box',
  'box.status.complete': 'Completo',
  'box.complete': '{box} completo',
  'box.completeUnnamed': 'Box completo',
  'box.complete.body': {
    one: 'Lo slot ({count}) è pieno.',
    many: 'Tutti i {count} slot sono pieni.',
    other: 'Tutti i {count} slot sono pieni.'
  },
  'status.caught': 'Catturato',
  'status.caughtCount': {
    one: 'Catturato · {count} voce',
    many: 'Catturato · {count} voci',
    other: 'Catturato · {count} voci'
  },
  'status.missing': 'Non ancora catturato',
  'status.shinyCaught': 'Cromatico catturato',
  'status.shinyCaughtCount': {
    one: 'Cromatico catturato · {count} voce cromatica',
    many: 'Cromatico catturato · {count} voci cromatiche',
    other: 'Cromatico catturato · {count} voci cromatiche'
  },
  'status.noShiny': 'Nessun cromatico per ora',
  'status.noShinyRegular': {
    one: 'Nessun cromatico per ora · {count} voce normale',
    many: 'Nessun cromatico per ora · {count} voci normali',
    other: 'Nessun cromatico per ora · {count} voci normali'
  },
  'status.withEntries': {
    one: '{status} · {count} voce',
    many: '{status} · {count} voci',
    other: '{status} · {count} voci'
  },
  'slot.label': '{slot}, {status}',
  'rules.preset': 'Preset {preset}',
  'rules.custom': 'Regole personalizzate',
  'rules.line': { one: '{rules} · {count} slot', many: '{rules} · {count} slot', other: '{rules} · {count} slot' },
  'rules.lineInGame': {
    one: '{rules} · {count} slot ottenibile in {game}',
    many: '{rules} · {count} slot ottenibili in {game}',
    other: '{rules} · {count} slot ottenibili in {game}'
  },
  'rules.change': 'Cambia regole',
  'hero.title': 'Living Dex',
  'hero.titleShiny': 'Living Dex cromatico',
  'hero.ring': 'Completamento del Living Dex',
  'hero.ringShiny': 'Completamento del Living Dex cromatico',
  'hero.count': {
    one: '{filled} su {count} catturato',
    many: '{filled} su {count} catturati',
    other: '{filled} su {count} catturati'
  },
  'hero.countShiny': {
    one: '{filled} su {count} cromatico catturato',
    many: '{filled} su {count} cromatici catturati',
    other: '{filled} su {count} cromatici catturati'
  },
  'hero.countGame': {
    one: '{filled} su {count} catturato in {game}',
    many: '{filled} su {count} catturati in {game}',
    other: '{filled} su {count} catturati in {game}'
  },
  'hero.countShinyGame': {
    one: '{filled} su {count} cromatico catturato in {game}',
    many: '{filled} su {count} cromatici catturati in {game}',
    other: '{filled} su {count} cromatici catturati in {game}'
  },
  'hero.unit': 'catturati',
  'hero.unitShiny': 'cromatici catturati',
  'hero.unitGame': 'catturati in {game}',
  'hero.unitShinyGame': 'cromatici catturati in {game}',
  'hero.anyColour': {
    one: '<b>{count}</b> catturato in qualsiasi colorazione',
    many: '<b>{count}</b> catturati in qualsiasi colorazione',
    other: '<b>{count}</b> catturati in qualsiasi colorazione'
  },
  'hero.shiny': {
    one: '<b>{count}</b> cromatico',
    many: '<b>{count}</b> cromatici',
    other: '<b>{count}</b> cromatici'
  },
  'hero.toGo': { one: 'Ne manca {count}', many: 'Ne mancano {count}', other: 'Ne mancano {count}' },
  'hero.done': 'Più niente da catturare',
  'hero.mode': 'Modalità del Living Dex',
  'hero.mode.normal': 'Living Dex',
  'hero.boxesComplete': 'Box completi',
  'hero.species': 'Specie',
  'hero.speciesShiny': 'Specie cromatiche',
  'notice.rules': {
    one: '<b>Le regole del tuo Living Dex sono cambiate.</b> Ora c’è {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.',
    many: '<b>Le regole del tuo Living Dex sono cambiate.</b> Ora ci sono {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.',
    other: '<b>Le regole del tuo Living Dex sono cambiate.</b> Ora ci sono {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.'
  },
  'notice.data': {
    one: '<b>I dati del Pokédex sono stati aggiornati.</b> Ora c’è {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.',
    many: '<b>I dati del Pokédex sono stati aggiornati.</b> Ora ci sono {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.',
    other: '<b>I dati del Pokédex sono stati aggiornati.</b> Ora ci sono {count} slot da riempire (prima {before}). Niente di ciò che hai registrato è andato perso.'
  },
  'notice.review': 'Rivedi le regole',
  'notice.dismiss': 'Chiudi',
  'complete.all': {
    one: '<b>Living Dex completo!</b> Lo slot ({count}) è pieno. È tutta la collezione.',
    many: '<b>Living Dex completo!</b> Tutti i {count} slot sono pieni. È tutta la collezione.',
    other: '<b>Living Dex completo!</b> Tutti i {count} slot sono pieni. È tutta la collezione.'
  },
  'complete.game': {
    one: '<b>Living Dex completo!</b> Lo slot ({count}) è pieno. È tutto ciò che si può ottenere in {game}.',
    many: '<b>Living Dex completo!</b> Tutti i {count} slot sono pieni. È tutto ciò che si può ottenere in {game}.',
    other: '<b>Living Dex completo!</b> Tutti i {count} slot sono pieni. È tutto ciò che si può ottenere in {game}.'
  },
  'complete.shinyAll': {
    one: '<b>Living Dex cromatico completo!</b> Lo slot ({count}) contiene un cromatico. È tutta la collezione.',
    many: '<b>Living Dex cromatico completo!</b> Tutti i {count} slot contengono un cromatico. È tutta la collezione.',
    other: '<b>Living Dex cromatico completo!</b> Tutti i {count} slot contengono un cromatico. È tutta la collezione.'
  },
  'complete.shinyGame': {
    one: '<b>Living Dex cromatico completo!</b> Lo slot ({count}) contiene un cromatico. È tutto ciò che si può ottenere in {game}.',
    many: '<b>Living Dex cromatico completo!</b> Tutti i {count} slot contengono un cromatico. È tutto ciò che si può ottenere in {game}.',
    other: '<b>Living Dex cromatico completo!</b> Tutti i {count} slot contengono un cromatico. È tutto ciò che si può ottenere in {game}.'
  },
  'waiting': "<b>Il tuo Living Dex ti aspetta.</b> Trova un Pokémon nel Pokédex, scegli il gioco e il luogo in cui l'hai catturato e finirà nel suo slot qui.",
  'openPokedex': 'Apri il Pokédex',
  'gameEmpty': '<b>Ancora nessuna cattura in {game}.</b> Qui uno slot si riempie solo con i Pokémon ottenuti in {game}; ciò che hai catturato in altri giochi resta nel Living Dex completo.',
  'gameEmptyShiny': '<b>Ancora nessun Pokémon cromatico da {game}.</b> Qui uno slot si riempie solo con i Pokémon ottenuti in {game}; ciò che hai catturato in altri giochi resta nel Living Dex completo.',
  'noShiny': {
    one: '<b>Ancora nessun Pokémon cromatico.</b> Registra una cattura come cromatica e il suo slot si accenderà qui. Il tuo slot catturato ({count}) resta nel Living Dex normale.',
    many: '<b>Ancora nessun Pokémon cromatico.</b> Registra una cattura come cromatica e il suo slot si accenderà qui. I tuoi {count} slot catturati restano nel Living Dex normale.',
    other: '<b>Ancora nessun Pokémon cromatico.</b> Registra una cattura come cromatica e il suo slot si accenderà qui. I tuoi {count} slot catturati restano nel Living Dex normale.'
  },
  'logShiny': 'Registra un cromatico',
  'unplaced': {
    one: '{count} voce riguarda un Pokémon che questa versione non conosce ancora. Resta al sicuro nel tuo <link>Diario</link>.',
    many: '{count} voci riguardano Pokémon che questa versione non conosce ancora. Restano al sicuro nel tuo <link>Diario</link>.',
    other: '{count} voci riguardano Pokémon che questa versione non conosce ancora. Restano al sicuro nel tuo <link>Diario</link>.'
  },
  'empty.noSlots.title': 'Nessun Pokémon da mostrare',
  'empty.noSlots.description': 'I dati del Pokédex non contengono Pokémon, quindi non ci sono ancora slot da riempire.',
  'empty.game.title': 'Niente da collezionare in {game}',
  'empty.game.titleUnknown': 'Niente da collezionare in questo gioco',
  'empty.game.description': 'Nessun Pokémon del tuo Living Dex si può ottenere in questo gioco senza un evento.',
  'empty.nothingMissing.title': 'Non manca niente',
  'empty.nothingMissing.description': 'Ogni slot è pieno. Non resta niente da catturare.',
  'empty.nothingMissing.descriptionShiny': 'Ogni slot contiene un cromatico. Non resta niente da cacciare.',
  'empty.showEverySlot': 'Mostra tutti gli slot',
  'find.title': 'Sono mostrati tutti gli slot',
  'find.body': '{name} è già catturato, quindi “Solo mancanti” è stato disattivato.',
  'find.bodyUnnamed': 'Quel Pokémon è già catturato, quindi “Solo mancanti” è stato disattivato.',
  'toolbar.view': 'Vista',
  'toolbar.view.boxes': 'Box',
  'toolbar.view.list': 'Elenco',
  'toolbar.missingOnly': 'Solo mancanti',
  'toolbar.jumpDex': 'Vai a un Pokédex',
  'toolbar.jumpGeneration': 'Vai a una generazione',
  'toolbar.generation': {
    one: '{generation}, {filled} su {count} catturato',
    many: '{generation}, {filled} su {count} catturati',
    other: '{generation}, {filled} su {count} catturati'
  },
  'toolbar.find.label': 'Trova un Pokémon nel tuo Living Dex',
  'toolbar.find.placeholder': 'Trova un Pokémon…',
  'toolbar.find.empty': 'Nessun Pokémon con questo nome',
  'toolbar.boxIndex': 'Indice dei Box',
  'toolbar.box': {
    one: '{box}, {range}, {filled} su {count} catturato',
    many: '{box}, {range}, {filled} su {count} catturati',
    other: '{box}, {range}, {filled} su {count} catturati'
  },
  'toolbar.boxComplete': '{box}, {range}, completo',
  'toolbar.tip.complete': 'Completo',
  'toolbar.tip.caught': {
    one: '{filled} / {count} catturato',
    many: '{filled} / {count} catturati',
    other: '{filled} / {count} catturati'
  },
  'toolbar.tip.shinyCaught': {
    one: '{filled} / {count} cromatico catturato',
    many: '{filled} / {count} cromatici catturati',
    other: '{filled} / {count} cromatici catturati'
  },
  'grid.label': 'Slot del Living Dex',
  'grid.labelShiny': 'Slot del Living Dex cromatico',
  'grid.labelHome': 'Slot dello HOME Dex',
  'grid.labelHomeShiny': 'Slot dello HOME Dex cromatico',
  'grid.hint': 'Usa i tasti freccia per spostarti tra gli slot e Invio per aprirne uno.',
  'grid.hintHome': 'Usa i tasti freccia per spostarti tra gli slot. Invio segna un Pokémon catturato come presente in Pokémon HOME, oppure apre lo slot quando contiene più voci o nessuna.',
  'grid.otherPokemon': 'Altri Pokémon',
  'grid.missing': { one: '{count} mancante', many: '{count} mancanti', other: '{count} mancanti' },
  'drawer.place': '{box} · Riga {row}, colonna {column}',
  'drawer.previous': 'Slot precedente',
  'drawer.next': 'Slot successivo',
  'drawer.find': 'Dove trovarlo',
  'drawer.log': 'Registra questo Pokémon',
  'drawer.gmax': 'Gigamax',
  'drawer.shinyOwned': 'Cromatico posseduto',
  'drawer.entries': 'Voci in questo slot',
  'drawer.empty': 'Nessuna voce in questo slot. Ne hai catturato uno? <b>Registra questo Pokémon</b> e finirà proprio in questo slot.',
  'drawer.emptyIdle': 'Ancora niente di registrato qui. Ne hai catturato uno? <b>Registra questo Pokémon</b> e finirà proprio in questo slot.',
  'drawer.regularOnly': {
    one: 'Qui hai {count} voce normale. Nel Living Dex cromatico questo slot si riempie solo con una cromatica.',
    many: 'Qui hai {count} voci normali. Nel Living Dex cromatico questo slot si riempie solo con una cromatica.',
    other: 'Qui hai {count} voci normali. Nel Living Dex cromatico questo slot si riempie solo con una cromatica.'
  },
  'drawer.inHome': 'In Pokémon HOME'
}

export default messages
