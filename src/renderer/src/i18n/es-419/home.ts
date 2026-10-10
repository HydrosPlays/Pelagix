import type { Translation } from '../en'

const messages: Translation<'home'> = {
  'welcome.lead': 'Pelagix lleva la cuenta de cada Pokémon que capturas, en cada juego: dónde lo encontraste, la Pokébola que usaste, su forma y si es variocolor. Captura a captura, tu Living Dex se va llenando.',
  'welcome.name.hint': 'Se usa en los saludos y se completa como Entrenador original al registrar una captura.',
  'welcome.step.log.text': 'Elige la Pokébola, añade los datos que te interesen y márcalo. Registra el mismo Pokémon otra vez para coleccionarlo en varios juegos.',
  'balls.title': 'Pokébolas usadas',
  'balls.eyebrow': { one: '{count} tipo de Pokébola', other: '{count} tipos de Pokébola' },
  'balls.none': 'Aún no hay Pokébolas registradas. Elige la Pokébola al registrar una captura y aparecerá aquí.',
  'balls.noBall': { one: '{count} entrada no tiene Pokébola registrada.', other: '{count} entradas no tienen Pokébola registrada.' }
}

export default messages
