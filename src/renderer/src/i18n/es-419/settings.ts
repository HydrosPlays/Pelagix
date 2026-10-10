import type { Translation } from '../en'

const messages: Translation<'settings'> = {
  'data.where.folder': 'En la carpeta de datos de Pelagix de esta computadora.',
  'data.export.description': 'Un único archivo con todo dentro. Úsalo como copia de seguridad o para pasarte a otra computadora.',
  'sprites.description': 'Renders que Pelagix ya ha descargado y guarda en esta computadora para que aparezcan al instante y funcionen sin conexión.',
  'sprites.confirm.description': {
    one: 'Se quitará {count} render ({size}) de esta computadora. Se vuelven a descargar mientras navegas, así que necesitarás conexión para ello.',
    other: 'Se quitarán {count} renders ({size}) de esta computadora. Se vuelven a descargar mientras navegas, así que necesitarás conexión para ello.'
  }
}

export default messages
