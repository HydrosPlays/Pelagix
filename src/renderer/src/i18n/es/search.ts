import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': 'Búsqueda y comandos',
  'input': 'Busca Pokémon, páginas y acciones',
  'results': 'Resultados',
  'empty.title': 'Nada coincide con «{query}»',
  'empty.hint': 'Prueba con el nombre o el número de un Pokémon, o con una página como Diario.',
  'footer.move': '<keys/> Mover',
  'footer.open': '<keys/> Abrir',
  'footer.close': '<keys/> Cerrar',
  'status.none': 'Sin resultados',
  'status.count': { one: '{count} resultado', other: '{count} resultados' },

  'section.pokemon': 'Pokémon',
  'section.recent': 'Abiertos recientemente',
  'section.pages': 'Páginas',
  'section.actions': 'Acciones',

  'row.shiny': 'Variocolor registrado',
  'row.missing': 'Aún sin capturar',

  'action.log': 'Registrar una captura de {name}',
  'action.shiny.on': 'Activar la vista variocolor',
  'action.shiny.off': 'Desactivar la vista variocolor',
  'action.theme.light': 'Cambiar al tema claro',
  'action.theme.dark': 'Cambiar al tema oscuro',
  'action.motion.on': 'Activar la reducción de movimiento',
  'action.motion.off': 'Desactivar la reducción de movimiento',
  'hint.on': 'Sí',
  'hint.off': 'No',
  'hint.dark': 'Oscuro',
  'hint.light': 'Claro',

  'toast.shiny.on': 'Vista variocolor activada',
  'toast.shiny.on.body': 'Los Pokémon se muestran con sus colores variocolor.',
  'toast.shiny.off': 'Vista variocolor desactivada',
  'toast.motion.on': 'Reducción de movimiento activada',
  'toast.motion.off': 'Reducción de movimiento desactivada',

  'keywords.page.home': 'inicio panel resumen principal progreso',
  'keywords.page.dex': 'pokedex pokemon explorar especies lista',
  'keywords.page.living': 'cajas coleccion formas huecos pokedex viviente',
  'keywords.page.homedex': 'pokemon home enviado enviados transferido transferidos guardado banco cajas',
  'keywords.page.journal': 'diario entradas registro historial capturas',
  'keywords.page.achievements': 'logros trofeos medallas insignias objetivos',
  'keywords.page.settings': 'ajustes configuracion preferencias opciones reglas tema idioma importar exportar copia seguridad',
  'keywords.action.log': 'registrar captura capturar añadir anadir nueva entrada capturado',
  'keywords.action.shiny': 'alternar variocolor shiny vista sprites renders',
  'keywords.action.theme': 'alternar cambiar tema oscuro claro apariencia aspecto modo',
  'keywords.action.motion': 'alternar reducir reducido movimiento animacion animaciones',
  'keywords.logPhrase': 'registrar una captura'
}

export default messages
