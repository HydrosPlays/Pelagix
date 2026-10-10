import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': 'Questo file non è un salvataggio di un gioco Pokémon che Pelagix sa leggere.',
  'failure.too-large': 'Questo file è troppo grande per essere un salvataggio di gioco.',
  'failure.unreadable': 'Impossibile aprire il file. Forse è in uso da un altro programma.',
  'failure.reader-missing': 'Manca la parte di Pelagix che legge i salvataggi di gioco. Reinstalla Pelagix per ripristinarla.',
  'failure.reader-failed': 'Qualcosa è andato storto durante la lettura del salvataggio.',
  'failure.timed-out': 'La lettura del salvataggio ha richiesto troppo tempo ed è stata interrotta.',
  'shinydexFailure.not-shinydex': "Questo file non è né un'esportazione di ShinyDex né una pagina History di ShinyDex salvata: non contiene nessun cromatico.",
  'shinydexFailure.too-large': "Questo file è troppo grande per essere un'esportazione di ShinyDex o una pagina di ShinyDex salvata.",
  'shinydexFailure.unreadable': 'Impossibile aprire il file. Forse è in uso da un altro programma.',
  'shinydexFailure.other': 'Qualcosa è andato storto durante la lettura del file.',

  'dialog.title': 'Importare questi Pokémon?',
  'dialog.add': { one: 'Aggiungi {count} voce', many: 'Aggiungi {count} voci', other: 'Aggiungi {count} voci' },
  'dialog.complete': {
    one: 'Completa {count} voce precedente',
    many: 'Completa {count} voci precedenti',
    other: 'Completa {count} voci precedenti'
  },
  'dialog.nothing': 'Niente da aggiungere',
  'dialog.failed': 'Impossibile aggiungere i Pokémon',

  'counts.new': { one: '{count} nuovo', many: '{count} nuovi', other: '{count} nuovi' },
  'counts.fills': {
    one: '{count} riempie uno slot vuoto del Living Dex',
    many: '{count} riempiono uno slot vuoto del Living Dex',
    other: '{count} riempiono uno slot vuoto del Living Dex'
  },
  'counts.imported': { one: '{count} già importato', many: '{count} già importati', other: '{count} già importati' },
  'counts.completes': {
    one: '{count} voce precedente riceve i dettagli mancanti',
    many: '{count} voci precedenti ricevono i dettagli mancanti',
    other: '{count} voci precedenti ricevono i dettagli mancanti'
  },
  'counts.egg': { one: '{count} Uovo ignorato', many: '{count} Uova ignorate', other: '{count} Uova ignorate' },
  'counts.unsupported': {
    one: '{count} non importabile',
    many: '{count} non importabili',
    other: '{count} non importabili'
  },

  'ask.label': 'Da quale gioco provengono?',
  'ask.hint': 'Questo salvataggio non registra il gioco esatto di alcuni Pokémon. La tua risposta vale per quelli che possono provenire da quel gioco.',
  'ask.placeholder': 'Scegli un gioco…',

  'bar.chosen': '{chosen} su {total} nuovi selezionati',
  'bar.allNew': 'Tutti i nuovi',
  'bar.onlyEmpty': 'Solo slot vuoti',

  'row.import': 'Importa {name}',
  'row.nickname': '“{nickname}”',
  'row.eggOf': 'Uovo di {species}',
  'row.egg': 'Uovo',
  'row.unknownPokemon': 'Pokémon sconosciuto',
  'status.new': 'Nuovo',
  'status.newSlot': 'Nuovo slot',
  'status.imported': 'Già importato',
  'status.completes': 'Aggiunge dettagli mancanti',
  'status.egg': 'Uovo',
  'status.eggSkipped': 'Uovo, ignorato',
  'status.unsupported': 'Non importabile',

  'reason.unreadable': 'Non è stato possibile leggerlo.',
  'reason.unknownPokemon': 'Pelagix non conosce questo Pokémon.',
  'reason.unknownForm': 'Pelagix non conosce questa forma.',
  'reason.untrackedGame': 'Proviene da un gioco che Pelagix non segue.',
  'reason.wrongGame': 'Non può provenire dal gioco che hai scelto.',
  'reason.askGame': 'Il salvataggio non indica da quale gioco proviene. Scegline uno qui sopra.',
  'reason.gameNotRecognised': 'Gioco non riconosciuto.',
  'reason.gameNotRecognisedNamed': 'Gioco non riconosciuto ({game}).',
  'reason.noDate': 'Non è stato possibile leggerne la data.',

  'source.save.description': '{file} è un salvataggio di {game}. Non è ancora cambiato nulla e il file di salvataggio viene solo letto.',
  'source.save.descriptionTrainer': '{file} è un salvataggio di {game}, Allenatore {trainer}. Non è ancora cambiato nulla e il file di salvataggio viene solo letto.',
  'source.save.games': 'Pokémon {names}',
  'source.save.unknownGame': 'un gioco di generazione {generation}',
  'source.save.dropped': {
    one: '{count} Pokémon di questo salvataggio non è stato letto ed è escluso.',
    many: '{count} Pokémon di questo salvataggio non sono stati letti e sono esclusi.',
    other: '{count} Pokémon di questo salvataggio non sono stati letti e sono esclusi.'
  },
  'source.save.empty': 'Non ci sono Pokémon in questo salvataggio.',
  'source.save.list': 'Pokémon in questo salvataggio',

  'source.shinydex.export': {
    one: "{file} è un'esportazione di ShinyDex con {count} Pokémon cromatico. Non è ancora cambiato nulla e il file viene solo letto. Vengono letti solo i Pokémon: gioco, metodo, data e gli altri dettagli presenti. Regole, impostazioni e obiettivi restano come sono.",
    many: "{file} è un'esportazione di ShinyDex con {count} Pokémon cromatici. Non è ancora cambiato nulla e il file viene solo letto. Vengono letti solo i Pokémon: gioco, metodo, data e gli altri dettagli presenti. Regole, impostazioni e obiettivi restano come sono.",
    other: "{file} è un'esportazione di ShinyDex con {count} Pokémon cromatici. Non è ancora cambiato nulla e il file viene solo letto. Vengono letti solo i Pokémon: gioco, metodo, data e gli altri dettagli presenti. Regole, impostazioni e obiettivi restano come sono."
  },
  'source.shinydex.page': {
    one: '{file} è una cronologia di ShinyDex salvata con {count} Pokémon cromatico. Non è ancora cambiato nulla e il file viene solo letto. Gioco, metodo, data e Ball arrivano da ShinyDex; tutto il resto lo aggiungi a mano.',
    many: '{file} è una cronologia di ShinyDex salvata con {count} Pokémon cromatici. Non è ancora cambiato nulla e il file viene solo letto. Gioco, metodo, data e Ball arrivano da ShinyDex; tutto il resto lo aggiungi a mano.',
    other: '{file} è una cronologia di ShinyDex salvata con {count} Pokémon cromatici. Non è ancora cambiato nulla e il file viene solo letto. Gioco, metodo, data e Ball arrivano da ShinyDex; tutto il resto lo aggiungi a mano.'
  },
  'source.shinydex.dropped': {
    one: "Questo file elenca più cromatici di quanti Pelagix ne legga in una volta. L'ultimo ({count}) è escluso.",
    many: 'Questo file elenca più cromatici di quanti Pelagix ne legga in una volta. Gli ultimi {count} sono esclusi.',
    other: 'Questo file elenca più cromatici di quanti Pelagix ne legga in una volta. Gli ultimi {count} sono esclusi.'
  },
  'source.shinydex.unusable': {
    one: '{count} voce di questo file non è stata letta ed è esclusa.',
    many: '{count} voci di questo file non sono state lette e sono escluse.',
    other: '{count} voci di questo file non sono state lette e sono escluse.'
  },
  'source.shinydex.empty': 'Non ci sono cromatici in questo file.',
  'source.shinydex.list': 'Cromatici in questo file'
}

export default messages
