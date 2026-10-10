import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': 'Inicio',
  'route.dex': 'Pokédex',
  'route.species': 'Pokémon',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME Dex',
  'route.journal': 'Diario',
  'route.achievements': 'Logros',
  'route.settings': 'Ajustes',
  'route.kit': 'Kit de componentes',
  'route.notFound': 'No encontrado',

  'nav.label': 'Principal',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '{caught} de {total} capturados',
  'nav.progress.tooltip': 'Living Dex: {count} ({percent})',
  'nav.progress.label': 'Progreso de la Living Dex: {count}',
  'nav.progress.ring': 'Living Dex completada',

  'topbar.fixture': 'Datos de prueba',
  'topbar.fixtureHint': 'No se han encontrado los datos reales, así que se ha cargado un pequeño conjunto de desarrollo. Ejecuta npm run data.',
  'topbar.notSaved': 'Sin guardar',
  'topbar.search': 'Buscar Pokémon…',
  'topbar.shiny.on': 'Vista variocolor activada',
  'topbar.shiny.off': 'Vista variocolor desactivada',
  'topbar.shiny.showing': 'Mostrando sprites variocolor',
  'topbar.shiny.show': 'Mostrar sprites variocolor',

  'skipToContent': 'Saltar al contenido',
  'pageError': 'Esta página ha tenido un problema',
  'appError': 'Pelagix ha tenido un problema',
  'notFound.title': 'Aguas inexploradas',
  'notFound.description': 'No hay ninguna página en esta dirección.',
  'notFound.back': 'Volver a Inicio',

  'boot.step.save': 'Cargando tu guardado',
  'boot.step.dex': 'Sacando a flote los datos de la Pokédex',
  'boot.retry': 'Reintentar',
  'boot.reload': 'Recargar la aplicación',
  'boot.dataMissing.title': 'Faltan los datos de la Pokédex',
  'boot.dataMissing.hint': 'Ejecuta <code>npm run data</code> para generar los datos y vuelve a intentarlo.',
  'boot.dataMissing.detail': 'No se han podido cargar los datos.',
  'boot.saveFailed.title': 'No se ha podido cargar tu guardado',
  'boot.saveFailed.hint': 'No se ha sobrescrito nada. Comprueba que el archivo de guardado se puede leer y vuelve a intentarlo.',

  'loadReport.newer': 'Este guardado procede de un Pelagix más reciente',
  'loadReport.repaired': 'Tu guardado se ha reparado al cargarlo',

  'language.title': 'Elige tu idioma',
  'language.description': 'Pelagix y los nombres de los Pokémon, los juegos y los lugares se mostrarán en este idioma. Puedes cambiarlo más adelante en Ajustes.',
  'language.list': 'Idioma',
  'language.confirm': 'Continuar'
}

export default messages
