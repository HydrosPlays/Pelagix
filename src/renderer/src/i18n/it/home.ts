import type { Translation } from '../en'

const messages: Translation<'home'> = {
  'region.1': 'Kanto',
  'region.2': 'Johto',
  'region.3': 'Hoenn',
  'region.4': 'Sinnoh',
  'region.5': 'Unima',
  'region.6': 'Kalos',
  'region.7': 'Alola',
  'region.8': 'Galar',
  'region.9': 'Paldea',
  'region.unknown': 'Generazione {gen}',

  'greeting.morning': 'Buongiorno, {name}',
  'greeting.afternoon': 'Buon pomeriggio, {name}',
  'greeting.evening': 'Buonasera, {name}',
  'greeting.trainer': 'Allenatore',

  'next.complete': 'Ogni slot è pieno. Il tuo Living Dex è completo!',
  'next.streak': {
    one: 'Sei a {count} giorno di fila. Registra una cattura oggi per continuare la serie.',
    many: 'Sei a {count} giorni di fila. Registra una cattura oggi per continuare la serie.',
    other: 'Sei a {count} giorni di fila. Registra una cattura oggi per continuare la serie.'
  },
  'next.left': 'Ancora da catturare: {left}.',
  'next.leftClosest': 'Ancora da catturare: {left}. {region} è la più vicina: ne mancano {missing} per finirla.',

  'rules.species': 'Regole Specie',
  'rules.forms': 'Regole Forme',
  'rules.completionist': 'Regole Completista',
  'rules.custom': 'Regole personalizzate',

  'action.logCatch': 'Registra una cattura',
  'action.browse': 'Sfoglia il Pokédex',
  'action.openLiving': 'Apri il Living Dex',

  'hero.eyebrow': 'Il tuo Living Dex',
  'hero.ring.label': 'Completamento del Living Dex',
  'hero.ring.value': '{caught} su {total} catturati ({percent})',
  'hero.of': 'su',
  'hero.caught': 'catturati',
  'hero.stat.species': 'Specie',
  'hero.stat.entries': 'Voci registrate',
  'hero.hint': '<keys/><text>trova qualsiasi Pokémon</text>',
  'hero.rulesHint': 'Scegli quali forme hanno uno slot a parte',
  'hero.slots': { one: '{count} slot · {rules}', many: '{count} slot · {rules}', other: '{count} slot · {rules}' },

  'hunt.title': 'Continua la caccia',
  'hunt.missing': 'Ne mancano ancora {count}',
  'hunt.tile': '{name}, {number}, non ancora catturato. Apri la sua pagina del Pokédex',
  'hunt.done.title': 'Più niente da cacciare',
  'hunt.done.text': 'Ogni slot del tuo Living Dex è pieno. Ci sono ancora i cromatici e gli altri giochi.',

  'welcome.eyebrow': 'Ti diamo il benvenuto',
  'welcome.eyebrowNamed': 'Ti diamo il benvenuto, {name}',
  'welcome.title': 'Il tuo Living Dex comincia qui',
  'welcome.lead': "Pelagix tiene traccia di ogni Pokémon che catturi, in ogni gioco: dove l'hai trovato, la Ball che hai usato, la sua forma e se è cromatico. Una cattura alla volta, il tuo Living Dex si riempie.",
  'welcome.name.label': 'Come ti chiami?',
  'welcome.name.placeholder': 'Nome Allenatore',
  'welcome.name.hint': 'Usato nei saluti e inserito come Allenatore originale quando registri una cattura.',
  'welcome.name.saved': 'Salvato. Piacere di conoscerti, {name}.',
  'welcome.find': 'Trova un Pokémon',
  'welcome.steps.title': 'Come funziona',
  'welcome.step.number': 'Passo {number}:',
  'welcome.step.find.title': 'Trova un Pokémon',
  'welcome.step.find.text': 'Sfoglia il Pokédex o cerca per nome o numero. Ci sono tutte le forme, le differenze di genere e i cromatici.',
  'welcome.step.pick.title': 'Scegli gioco e luogo',
  'welcome.step.pick.text': 'La sua pagina elenca tutti i giochi in cui si trova e come: cattura, scambio, dono, evoluzione, Uovo o evento.',
  'welcome.step.log.title': 'Registralo',
  'welcome.step.log.text': 'Scegli la Ball, aggiungi i dettagli che ti interessano e spuntalo. Registra di nuovo lo stesso Pokémon per collezionarlo in più giochi.',
  'welcome.foot.species': {
    one: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Specie.',
    many: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Specie.',
    other: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Specie.'
  },
  'welcome.foot.forms': {
    one: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Forme.',
    many: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Forme.',
    other: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Forme.'
  },
  'welcome.foot.completionist': {
    one: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Completista.',
    many: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Completista.',
    other: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole Completista.'
  },
  'welcome.foot.custom': {
    one: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole personalizzate.',
    many: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole personalizzate.',
    other: 'Il tuo Living Dex ha <b>{count} slot</b> con le regole personalizzate.'
  },
  'welcome.foot.link': 'Scegli quali forme contano',

  'entries': { one: '{count} voce', many: '{count} voci', other: '{count} voci' },
  'shiny': 'Cromatici: {count}',

  'gens.title': 'Progressi per generazione',
  'gens.eyebrow': 'Regione per regione',
  'gens.more': 'Pokédex',
  'gens.row': '{region}, {generation}: {caught} su {total} catturati ({percent}). Mostra questa generazione nel Pokédex',

  'recent.title': 'Catture recenti',
  'recent.more': 'Diario',
  'recent.all': 'Vedi tutte le {count} voci nel diario',

  'games.title': 'I tuoi giochi',
  'games.eyebrow.none': 'Dove catturi',
  'games.eyebrow': { one: '{count} gioco su {systems}', many: '{count} giochi su {systems}', other: '{count} giochi su {systems}' },
  'games.systemCount': { one: '{count} console', many: '{count} console', other: '{count} console' },
  'games.none': 'Nessuna delle tue voci proviene ancora da un gioco che Pelagix conosce.',
  'games.species': { one: '{count} specie', many: '{count} specie', other: '{count} specie' },
  'games.share': 'Quota di voci da {game}',
  'games.entriesWord': { one: 'voce', many: 'voci', other: 'voci' },
  'games.also': 'Inoltre',
  'games.game': { one: '{game}: {count} voce', many: '{game}: {count} voci', other: '{game}: {count} voci' },
  'games.systems': 'Console',
  'games.system': {
    one: '{system}: {count} voce da {games}',
    many: '{system}: {count} voci da {games}',
    other: '{system}: {count} voci da {games}'
  },
  'games.gameCount': { one: '{count} gioco', many: '{count} giochi', other: '{count} giochi' },
  'games.unknown': {
    one: '{count} voce proviene da un gioco che questa versione di Pelagix non conosce. Conta comunque per il tuo Living Dex.',
    many: '{count} voci provengono da un gioco che questa versione di Pelagix non conosce. Contano comunque per il tuo Living Dex.',
    other: '{count} voci provengono da un gioco che questa versione di Pelagix non conosce. Contano comunque per il tuo Living Dex.'
  },

  'activity.title': 'Attività',
  'activity.range': '{from} – {to}',
  'activity.days': { one: '{count} giorno', many: '{count} giorni', other: '{count} giorni' },
  'activity.streak.current': 'Serie attuale',
  'activity.streak.caughtToday': 'Cattura fatta oggi',
  'activity.streak.logToday': 'Registrane una oggi',
  'activity.streak.starts': 'Inizia con una cattura',
  'activity.streak.best': 'Serie migliore',
  'activity.streak.stillGoing': 'Ancora in corso',
  'activity.streak.ended': 'Finita il {date}',
  'activity.activeDays': 'Giorni con una cattura',
  'activity.since': 'Dal {date}',
  'activity.chart': 'Catture al mese, {range}',
  'activity.month.none': '{month}: nessuna cattura',
  'activity.month.short': { one: '{month}: {count} cattura', many: '{month}: {count} catture', other: '{month}: {count} catture' },
  'activity.month.full': {
    one: '{month}: {count} cattura, nuovi nel Living Dex: {fresh}',
    many: '{month}: {count} catture, nuovi nel Living Dex: {fresh}',
    other: '{month}: {count} catture, nuovi nel Living Dex: {fresh}'
  },
  'activity.month.fullShiny': {
    one: '{month}: {count} cattura, nuovi nel Living Dex: {fresh}, cromatici: {shiny}',
    many: '{month}: {count} catture, nuovi nel Living Dex: {fresh}, cromatici: {shiny}',
    other: '{month}: {count} catture, nuovi nel Living Dex: {fresh}, cromatici: {shiny}'
  },
  'activity.summary.none': 'Nessuna cattura in questi mesi.',
  'activity.summary.busiest': {
    one: '{count} cattura. Mese più intenso: {month} ({entries}).',
    many: '{count} catture. Mese più intenso: {month} ({entries}).',
    other: '{count} catture. Mese più intenso: {month} ({entries}).'
  },
  'activity.summary.single': {
    one: '{count} cattura, a {month}.',
    many: '{count} catture, tutte a {month}.',
    other: '{count} catture, tutte a {month}.'
  },

  'types.title': 'Copertura dei tipi',
  'types.eyebrow': { one: '{count} tipo', many: '{count} tipi', other: '{count} tipi' },
  'types.row': '{type}: {caught} su {total} catturati ({percent})',
  'types.meter': 'Tipo {type}',
  'types.meterValue': '{caught} su {total} catturati',
  'types.note': 'Un Pokémon con due tipi conta per entrambi.',

  'balls.title': 'Ball usate',
  'balls.eyebrow.none': 'Con cosa catturi',
  'balls.eyebrow': { one: '{count} tipo di Ball', many: '{count} tipi di Ball', other: '{count} tipi di Ball' },
  'balls.none': 'Nessuna Ball registrata per ora. Scegli la Ball quando registri una cattura e comparirà qui.',
  'balls.favourite': 'Preferita',
  'balls.share': {
    one: '{used} su {count} cattura ({percent})',
    many: '{used} su {count} catture ({percent})',
    other: '{used} su {count} catture ({percent})'
  },
  'balls.ball': { one: '{ball}: {count} cattura', many: '{ball}: {count} catture', other: '{ball}: {count} catture' },
  'balls.ballShiny': {
    one: '{ball}: {count} cattura, cromatici: {shiny}',
    many: '{ball}: {count} catture, cromatici: {shiny}',
    other: '{ball}: {count} catture, cromatici: {shiny}'
  },
  'balls.noBall': {
    one: '{count} voce non ha una Ball registrata.',
    many: '{count} voci non hanno una Ball registrata.',
    other: '{count} voci non hanno una Ball registrata.'
  },

  'achievements.title': 'Obiettivi',
  'achievements.failed': 'Impossibile mostrare qui i tuoi obiettivi. Sono al sicuro: apri la pagina Obiettivi per vederli.'
}

export default messages
