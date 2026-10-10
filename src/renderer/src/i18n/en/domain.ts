import type { Messages } from '../types'

/** English text of the "domain" namespace. Full key: "domain.<key>". See ../README.md. */
const messages = {
  // The Living Dex rules (Settings > Living Dex rules): a switch label and one line of explanation each.
  'rule.regional.label': 'Regional forms',
  'rule.regional.description': 'Alolan, Galarian, Hisuian and Paldean forms get their own slot.',
  'rule.genderForms.label': 'Gender forms',
  'rule.genderForms.description': 'Meowstic, Indeedee, Basculegion and Oinkologne ♂ / ♀ are separate slots.',
  'rule.genderDiffs.label': 'Gender differences',
  'rule.genderDiffs.description': 'Separate ♂ and ♀ slots for species whose genders look different.',
  'rule.cosmetic.label': 'Cosmetic forms',
  'rule.cosmetic.description': 'Unown letters, Vivillon patterns, Alcremie creams and other permanent looks.',
  'rule.changeable.label': 'Changeable forms',
  'rule.changeable.description': 'Forms you can switch freely: Rotom appliances, Deoxys, Shaymin, Oricorio and more.',
  'rule.heldItem.label': 'Held-item forms',
  'rule.heldItem.description': 'Forms kept only while holding an item: Arceus plates, Silvally memories, Genesect drives, Ogerpon masks and Origin Forme Dialga, Palkia and Giratina.',
  'rule.fusion.label': 'Fusions',
  'rule.fusion.description': 'Kyurem, Necrozma and Calyrex fusions.',
  'rule.event.label': 'Event forms',
  'rule.event.description': 'Distribution-only forms such as cap Pikachu or Poké Ball Vivillon.',
  'rule.partner.label': 'Partner forms',
  'rule.partner.description': "Let's Go partner Pikachu and Eevee, which never leave their game.",
  'rule.alcremieSweets.label': 'Alcremie sweets',
  'rule.alcremieSweets.description': 'All 63 cream and sweet combinations instead of the 9 creams.',
  'rule.mega.label': 'Mega Evolutions',
  'rule.mega.description': 'Mega Evolutions and Primal Reversions (they cannot sit in a box).',
  'rule.battle.label': 'Battle forms',
  'rule.battle.description': 'Other battle-only states and totems (they cannot sit in a box).',
  'rule.gmax.label': 'Gigantamax',
  'rule.gmax.description': 'An extra slot for every form that can Gigantamax.',

  // The three rule presets.
  'preset.species.label': 'Species',
  'preset.species.description': 'One slot per species. Any form of a Pokémon fills it.',
  'preset.forms.label': 'Forms',
  'preset.forms.description': 'Every form you can keep in a box: regional, gender, cosmetic and changeable forms.',
  'preset.completionist.label': 'Completionist',
  'preset.completionist.description': 'Everything: event and partner forms, fusions, Mega Evolutions, battle forms, Gigantamax and all 63 Alcremie.',

  // Name of a Living Dex slot or of a logged Pokémon. {name} is the Pokémon's name, already in this language.
  'slot.gmax': 'Gigantamax {name}',
  'slot.male': '{name} ♂',
  'slot.female': '{name} ♀',
  // {variant} is the name of an Alcremie sweet ("Star Sweet").
  'slot.variant': '{name} · {variant}',
  // A logged Pokémon whose species this version does not know; {number} is its National Pokédex number.
  'entry.unknownSpecies': 'Pokémon #{number}',

  // Heading of what a game has outside its own Pokédexes; {game} is a short game name ("Sword").
  'dex.other': 'Other Pokémon obtainable in {game}',
  'dex.otherUnknownGame': 'Other Pokémon obtainable in this game',

  'generation.1': 'Generation I',
  'generation.2': 'Generation II',
  'generation.3': 'Generation III',
  'generation.4': 'Generation IV',
  'generation.5': 'Generation V',
  'generation.6': 'Generation VI',
  'generation.7': 'Generation VII',
  'generation.8': 'Generation VIII',
  'generation.9': 'Generation IX',
  // A generation newer than the app knows; {number} is its number in digits.
  'generation.other': 'Generation {number}',

  // HOME Dex: where a slot stands (tooltip and screen reader), and the filter names.
  'home.status.home': 'In Pokémon HOME',
  'home.status.homeShiny': 'Shiny in Pokémon HOME',
  'home.status.pending': 'Caught · not sent to HOME yet',
  'home.status.pendingShiny': 'Shiny caught · not sent to HOME yet',
  'home.status.missing': 'Not caught yet',
  'home.status.missingShiny': 'No shiny yet',
  'home.filter.home': 'In HOME',
  'home.filter.pending': 'Not sent yet',
  'home.filter.missing': 'Not caught'
} satisfies Messages

export default messages
