import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': 'Ese archivo no es una partida guardada de un juego de Pokémon que Pelagix pueda leer.',
  'failure.too-large': 'Ese archivo es demasiado grande para ser una partida guardada.',
  'failure.unreadable': 'No se ha podido abrir ese archivo. Puede que otro programa lo esté usando.',
  'failure.reader-missing': 'Falta la parte de Pelagix que lee las partidas guardadas. Se recupera al volver a instalar Pelagix.',
  'failure.reader-failed': 'Algo ha fallado al leer esa partida.',
  'failure.timed-out': 'La lectura de esa partida ha tardado demasiado y se ha detenido.',
  'shinydexFailure.not-shinydex': 'Ese archivo no es una exportación de ShinyDex ni una página History de ShinyDex guardada: no se ha encontrado ningún variocolor en él.',
  'shinydexFailure.too-large': 'Ese archivo es demasiado grande para ser una exportación de ShinyDex o una página de ShinyDex guardada.',
  'shinydexFailure.unreadable': 'No se ha podido abrir ese archivo. Puede que otro programa lo esté usando.',
  'shinydexFailure.other': 'Algo ha fallado al leer ese archivo.',

  'dialog.title': '¿Importar estos Pokémon?',
  'dialog.add': { one: 'Añadir {count} entrada', other: 'Añadir {count} entradas' },
  'dialog.complete': { one: 'Completar {count} entrada anterior', other: 'Completar {count} entradas anteriores' },
  'dialog.nothing': 'Nada que añadir',
  'dialog.failed': 'No se han podido añadir los Pokémon',

  'counts.new': { one: '{count} nuevo', other: '{count} nuevos' },
  'counts.fills': { one: '{count} ocupa un hueco vacío de la Living Dex', other: '{count} ocupan un hueco vacío de la Living Dex' },
  'counts.imported': { one: '{count} ya importado', other: '{count} ya importados' },
  'counts.completes': { one: '{count} entrada anterior recibe los datos que le faltaban', other: '{count} entradas anteriores reciben los datos que les faltaban' },
  'counts.egg': { one: '{count} Huevo omitido', other: '{count} Huevos omitidos' },
  'counts.unsupported': { one: '{count} no se puede importar', other: '{count} no se pueden importar' },

  'ask.label': '¿De qué juego son?',
  'ask.hint': 'Esta partida no registra el juego exacto de algunos Pokémon. Tu respuesta se usa para los que pueden ser de ese juego.',
  'ask.placeholder': 'Elige un juego…',

  'bar.chosen': '{chosen} de {total} nuevos elegidos',
  'bar.allNew': 'Todos los nuevos',
  'bar.onlyEmpty': 'Solo huecos vacíos',

  'row.import': 'Importar a {name}',
  'row.nickname': '«{nickname}»',
  'row.eggOf': 'Huevo de {species}',
  'row.egg': 'Huevo',
  'row.unknownPokemon': 'Pokémon desconocido',
  'status.new': 'Nuevo',
  'status.newSlot': 'Hueco nuevo',
  'status.imported': 'Ya importado',
  'status.completes': 'Añade datos que faltaban',
  'status.egg': 'Huevo',
  'status.eggSkipped': 'Huevo, omitido',
  'status.unsupported': 'No se puede importar',

  'reason.unreadable': 'No se ha podido leer.',
  'reason.unknownPokemon': 'Pelagix no conoce este Pokémon.',
  'reason.unknownForm': 'Pelagix no conoce esta forma.',
  'reason.untrackedGame': 'Viene de un juego que Pelagix no sigue.',
  'reason.wrongGame': 'No puede ser del juego que has elegido.',
  'reason.askGame': 'La partida no indica de qué juego es. Elige uno arriba.',
  'reason.gameNotRecognised': 'Juego no reconocido.',
  'reason.gameNotRecognisedNamed': 'Juego no reconocido ({game}).',
  'reason.noDate': 'No se ha podido leer su fecha.',

  'source.save.description': '{file} es una partida guardada de {game}. Todavía no ha cambiado nada, y el archivo de la partida solo se lee.',
  'source.save.descriptionTrainer': '{file} es una partida guardada de {game}, de {trainer}. Todavía no ha cambiado nada, y el archivo de la partida solo se lee.',
  'source.save.games': 'Pokémon {names}',
  'source.save.unknownGame': 'un juego de la generación {generation}',
  'source.save.dropped': { one: '{count} Pokémon de esta partida no se ha podido leer y se ha omitido.', other: '{count} Pokémon de esta partida no se han podido leer y se han omitido.' },
  'source.save.empty': 'No hay ningún Pokémon en esta partida.',
  'source.save.list': 'Pokémon de esta partida',

  'source.shinydex.export': {
    one: '{file} es una exportación de ShinyDex con {count} Pokémon variocolor. Todavía no ha cambiado nada, y el archivo solo se lee. Solo se leen sus Pokémon: juego, método, fecha y los datos que incluya. Tus reglas, ajustes y logros se quedan como están.',
    other: '{file} es una exportación de ShinyDex con {count} Pokémon variocolor. Todavía no ha cambiado nada, y el archivo solo se lee. Solo se leen sus Pokémon: juego, método, fecha y los datos que incluya. Tus reglas, ajustes y logros se quedan como están.'
  },
  'source.shinydex.page': {
    one: '{file} es un historial de ShinyDex guardado con {count} Pokémon variocolor. Todavía no ha cambiado nada, y el archivo solo se lee. El juego, el método, la fecha y la Ball vienen de ShinyDex; lo demás lo añades tú a mano.',
    other: '{file} es un historial de ShinyDex guardado con {count} Pokémon variocolor. Todavía no ha cambiado nada, y el archivo solo se lee. El juego, el método, la fecha y la Ball vienen de ShinyDex; lo demás lo añades tú a mano.'
  },
  'source.shinydex.dropped': { one: 'Este archivo contiene más variocolores de los que Pelagix lee de una vez. Se ha omitido el último.', other: 'Este archivo contiene más variocolores de los que Pelagix lee de una vez. Se han omitido los últimos {count}.' },
  'source.shinydex.unusable': { one: '{count} entrada de este archivo no se ha podido leer y se ha omitido.', other: '{count} entradas de este archivo no se han podido leer y se han omitido.' },
  'source.shinydex.empty': 'No hay ningún variocolor en este archivo.',
  'source.shinydex.list': 'Variocolores de este archivo'
}

export default messages
