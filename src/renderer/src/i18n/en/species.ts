import type { Messages } from '../types'

/**
 * English text of the "species" namespace (the page of one Pokémon). Full key: "species.<key>". See ../README.md.
 * In these messages {name} is always the name of a Pokémon or form, and {game} the name of a game, both already in this language.
 */
const messages = {
  // ---- Top of the page.
  'nav.label': 'Pokédex navigation',
  'nav.back': 'Pokédex',
  // {number} is written like #0025.
  'nav.previous': 'Previous: {number} {name}',
  'nav.next': 'Next: {number} {name}',
  'unknown.title': 'No Pokémon with that number',
  // {id} is what the address held.
  'unknown.description': '“{id}” is not in the Pokédex data.',
  'unknown.noId': 'This address does not point at a Pokémon.',
  'unknown.open': 'Open the Pokédex',
  'retry': 'Try again',
  'showFewer': 'Show fewer',

  // ---- The large render and its switches.
  // What the picture shows, for a screen reader. Each of these wraps the name built so far: "Shiny Alcremie with Star Sweet (female)".
  'hero.alt.shiny': 'Shiny {name}',
  'hero.alt.variant': '{name} with {variant}',
  'hero.alt.female': '{name} (female)',
  'hero.approx': 'Closest render',
  'hero.approx.hint': 'Pokémon HOME has no render of this exact form, so the closest one is shown.',
  'hero.registered': 'Registered',
  'hero.options': 'Render options',
  'hero.gmax': 'Gigantamax',
  'hero.noShiny.form': 'There is no shiny render of this form.',
  'hero.noShiny.sweet': 'There is no shiny render of this sweet.',
  // Heading of the picker of Alcremie's sweets, and of any other set of variants.
  'hero.sweet': 'Sweet',
  'hero.variant': 'Variant',

  // ---- About.
  'about.flavorError': 'The Pokédex entry could not be loaded.',
  'about.height': 'Height',
  'about.weight': 'Weight',
  'about.gender': 'Gender',
  'about.gender.male': 'Always male',
  'about.gender.female': 'Always female',
  // {male} and {female} are percentages ("87.5%").
  'about.gender.split': '{male} male, {female} female',
  'about.regional': 'Regional Pokédex',
  'about.regional.more': { one: '+{count} more', other: '+{count} more' },
  'about.family': 'Evolution family',
  'about.family.error': 'Not available right now.',
  // Regional Pokédexes in the list of numbers, by the id used in the datasets. In brackets: the games of a remake's list.
  'regionalDex.kanto': 'Kanto',
  'regionalDex.original-johto': 'Johto',
  'regionalDex.updated-johto': 'Johto (HGSS)',
  'regionalDex.hoenn': 'Hoenn',
  'regionalDex.updated-hoenn': 'Hoenn (ORAS)',
  'regionalDex.original-sinnoh': 'Sinnoh',
  'regionalDex.extended-sinnoh': 'Sinnoh (Platinum)',
  'regionalDex.original-unova': 'Unova',
  'regionalDex.updated-unova': 'Unova (B2W2)',
  'regionalDex.kalos-central': 'Central Kalos',
  'regionalDex.kalos-coastal': 'Coastal Kalos',
  'regionalDex.kalos-mountain': 'Mountain Kalos',
  'regionalDex.original-alola': 'Alola',
  'regionalDex.updated-alola': 'Alola (USUM)',
  'regionalDex.letsgo-kanto': "Kanto (Let's Go)",
  'regionalDex.galar': 'Galar',
  'regionalDex.isle-of-armor': 'Isle of Armor',
  'regionalDex.crown-tundra': 'Crown Tundra',
  'regionalDex.hisui': 'Hisui',
  'regionalDex.paldea': 'Paldea',
  'regionalDex.kitakami': 'Kitakami',
  'regionalDex.blueberry': 'Blueberry',
  'regionalDex.lumiose-city': 'Lumiose',
  'regionalDex.hyperspace': 'Hyperspace',

  // ---- Evolution family.
  'family.alone': 'This Pokémon does not evolve.',
  'family.current': '{name} (shown now)',
  'family.open': 'Open {name}',
  // Several forms of one species folded into one node.
  'family.forms': { one: '{count} form', other: '{count} forms' },
  // Between two stages when the data does not say how.
  'family.evolves': 'Evolves',

  // ---- Form picker.
  'forms.title': 'Forms',
  'forms.summary': { one: '{count} form', other: '{count} forms' },
  // {logged} is how many of them have an entry.
  'forms.summaryLogged': { one: '{count} form · {logged} logged', other: '{count} forms · {logged} logged' },
  'forms.label': 'Forms of {name}',
  // One form that has entries, for a screen reader.
  'forms.optionLogged': { one: '{name}, {count} entry logged', other: '{name}, {count} entries logged' },

  // ---- Your entries.
  'entries.title': 'Your entries',
  'entries.logged': { one: '{count} logged', other: '{count} logged' },
  // {ofForm} entries are of the form shown, {others} of other forms of the species.
  'entries.summary': '{ofForm} of {name}, {others} of other forms',
  'entries.logAnother': 'Log another',
  'entries.empty.title': 'No {name} in your Living Dex yet',
  'entries.empty.description': 'Pick the game you caught it in below, find the way you got it and press Log.',
  'entries.empty.find': 'Where to find it',
  'entries.showAll': { one: 'Show all {count} entries', other: 'Show all {count} entries' },

  // ---- Where to find it.
  'where.title': 'Where to find it',
  'where.titleForm': 'Where to find {name}',
  'where.logManually': 'Log manually',
  'where.noGames': 'This form is not in any game yet.',
  'where.showUnavailable': 'Show unavailable',
  // Group of the game list for Pokémon GO and Pokémon HOME.
  'where.otherGames': 'Other',
  // The line under the heading. The parts that apply are joined with " · ": "Obtainable in 12 games · event only in 2 · transfer only in 5".
  'where.summary.obtainable': { one: 'Obtainable in {count} game', other: 'Obtainable in {count} games' },
  // ".first" when the part starts the line, ".next" when it follows another part. {count} is a number of games.
  'where.summary.event.first': { one: 'Event only in {count}', other: 'Event only in {count}' },
  'where.summary.event.next': { one: 'event only in {count}', other: 'event only in {count}' },
  'where.summary.transfer.first': { one: 'Transfer only in {count}', other: 'Transfer only in {count}' },
  'where.summary.transfer.next': { one: 'transfer only in {count}', other: 'transfer only in {count}' },
  'where.summary.none': 'Not obtainable in any game',
  'where.summary.battle': { one: 'Seen in battle in {count} game', other: 'Seen in battle in {count} games' },
  'where.summary.battleNone': 'Not in any game',
  // How a game relates to the form.
  'where.state.obtainable': 'Obtainable',
  'where.state.event': 'Event only',
  'where.state.transfer': 'Transfer only',
  'where.state.absent': 'Not in this game',
  'where.state.absentShort': 'Not in game',
  'where.state.battle': 'Battle only',
  // One game of the list, for a screen reader; {state} is one of the states above.
  'where.game.option': '{game}: {state}',
  'where.game.optionLogged': '{game}: {state}, logged',
  'where.game.logged': 'You have logged this form in this game',
  'where.loading': 'Loading where to find {name}',
  'where.error.title': 'The details could not be loaded',
  'where.error.description': 'The data file for this Pokémon is missing or unreadable.',
  'where.noDetails': '{name} can be obtained in {game}, but Pelagix has no details on how. You can still log yours by hand.',
  'where.noDetailsNoGame': '{name} can be obtained in this game, but Pelagix has no details on how. You can still log yours by hand.',
  'where.else.battle': '{name} only exists during a battle, so there is nothing to catch or keep in a box.',
  'where.else.noSource': '{name} has no known source in any game.',
  'where.else.transfer': '{name} cannot be obtained in {game}. It exists there, but has to be traded or transferred in.',
  'where.else.absent': '{name} is not in {game}.',
  'where.else.obtainable': 'Where you can get it',
  'where.else.event': 'Event only',
  'where.else.onlyTransfer': 'In practice it is only available by transfer or from a past event. You can still log yours by hand.',
  'where.else.battleNote': 'If you track these anyway, log one by hand.',
  'where.filter.placeholder': 'Filter by place or method',
  'where.filter.label': 'Filter the sources in {game}',
  'where.filter.only': 'Show only',
  // {query} is what the user typed.
  'where.filter.noMatch': 'Nothing here matches “{query}”.',
  'where.filter.noMatchFilter': 'Nothing here matches that filter.',
  'where.filter.clear': 'Clear the filter',

  // ---- The kinds of sources: heading, filter chip, and what the number beside the heading counts.
  'section.wild.title': 'Catch in the wild',
  'section.wild.chip': 'Wild',
  'section.wild.count': { one: '{count} place', other: '{count} places' },
  'section.static.title': 'Static encounters',
  'section.static.chip': 'Static',
  'section.static.count': { one: '{count} encounter', other: '{count} encounters' },
  'section.gift.title': 'Gifts and eggs',
  'section.gift.chip': 'Gifts',
  'section.gift.count': { one: '{count} gift', other: '{count} gifts' },
  'section.trade.title': 'In-game trades',
  'section.trade.chip': 'Trades',
  'section.trade.count': { one: '{count} trade', other: '{count} trades' },
  'section.raid.title': 'Raids and outbreaks',
  'section.raid.chip': 'Raids',
  'section.raid.count': { one: '{count} source', other: '{count} sources' },
  'section.shadow.title': 'Shadow Pokémon',
  'section.shadow.chip': 'Shadow',
  'section.shadow.count': { one: '{count} encounter', other: '{count} encounters' },
  'section.walker.title': 'Pokéwalker',
  'section.walker.chip': 'Pokéwalker',
  'section.walker.count': { one: '{count} course', other: '{count} courses' },
  'section.dream.title': 'Dream World',
  'section.dream.chip': 'Dream World',
  'section.dream.count': { one: '{count} source', other: '{count} sources' },
  'section.evolve.title': 'Evolve',
  'section.evolve.chip': 'Evolve',
  'section.evolve.count': { one: '{count} way', other: '{count} ways' },
  'section.change.title': 'Change form',
  'section.change.chip': 'Change form',
  'section.change.count': { one: '{count} way', other: '{count} ways' },
  'section.breed.title': 'Breed',
  'section.breed.chip': 'Breed',
  'section.breed.count': { one: '{count} way', other: '{count} ways' },
  'section.event.title': 'Events',
  'section.event.chip': 'Events',
  'section.event.count': { one: '{count} event', other: '{count} events' },

  // ---- One source.
  'source.log': 'Log',
  // What a Log button does, for a screen reader. {source} is the method or the event's name, {place} a location,
  // {origin} the earlier stage it was caught as.
  'source.logRow': 'Log {name}: {source} in {game}',
  'source.logRowAt': 'Log {name}: {source} at {place} in {game}',
  'source.logRowAs': 'Log {name}, caught as {origin}: {source} in {game}',
  'source.logRowAsAt': 'Log {name}, caught as {origin}: {source} at {place} in {game}',
  // {from} is the Pokémon it evolved or changed from.
  'source.logEvolved': 'Log {name}: evolved from {from} in {game}',
  'source.logChanged': 'Log {name}: changed from {from} in {game}',
  'source.logHatched': 'Log {name}: hatched from an Egg in {game}',
  'source.logHatchedAs': 'Log {name}: hatched as {origin} from an Egg in {game}',
  'source.showMore': { one: 'Show {count} more', other: 'Show {count} more' },
  'source.alpha': 'Alpha',
  'source.alpha.hint': 'An Alpha Pokémon',
  'source.shinyLocked': 'Shiny locked',
  'source.shinyLocked.hint': 'This one can never be shiny',
  'source.shinyForced': 'Always shiny',
  'source.shinyForced.hint': 'This one is always shiny',
  'source.ball.hint': 'Always comes in this ball',
  // Shown when the ball is one the app has no name for.
  'source.ball.unknown': 'Fixed ball',
  'source.gender.male': 'Male only',
  'source.gender.female': 'Female only',
  'source.gender.hint': 'Its gender is fixed',
  'source.randomForm': 'Random form',
  'source.randomForm.hint': "The game picks the form at random or by your save's region",
  // {product} is a side game or service (see "via." below).
  'source.via': 'via {product}',
  'source.via.hint': 'Delivered through {product}',
  // "OT" is the abbreviation of Original Trainer; {trainer} is a trainer name.
  'source.ot': 'OT {trainer}',
  'source.ot.hint': 'Original Trainer',
  // When an event ran.
  'source.dates.range': '{from} – {to}',
  'source.dates.from': 'From {date}',
  'source.dates.until': 'Until {date}',
  'source.nested.error': 'The details of {name} could not be loaded.',
  'source.nested.none': '{name} cannot be obtained in {game} either, so it has to be brought in from another game.',
  'source.nested.title': '{name} in {game}',
  'source.nested.open': 'Open its page',
  'source.open': 'Open {name}',
  'source.evolve': 'Evolve {name}',
  'source.change': 'Change from {name}',
  // Opens the sources of the earlier stage; {game} is a short game name.
  'source.whereFrom': 'Where to find {name} in {game}',
  'source.breed.title': 'Hatch from an Egg',
  // {parents} is a list of Pokémon joined with "or".
  'source.breed.parents': 'Breed {parents}. A Ditto works as the partner.',
  'source.breed.family': 'Breed a member of its family.',
  // Last item of that list when it is cut short: "Pichu, Pikachu, Raichu or 2 more".
  'source.breed.more': { one: '{count} more', other: '{count} more' },

  // Side games and services a Pokémon is delivered through.
  'via.stadium': 'Pokémon Stadium',
  'via.stadium2': 'Pokémon Stadium 2',
  'via.boxrubysapphire': 'Pokémon Box',
  'via.colosseum': 'Colosseum Bonus Disc',
  'via.xd': 'Pokémon XD',
  'via.ranch': 'My Pokémon Ranch',
  'via.ereader': 'e-Reader',
  'via.ranger': 'Pokémon Ranger',
  'via.home': 'Pokémon HOME',
  'via.go': 'Pokémon GO',
  'via.other': 'Another game'
} satisfies Messages

export default messages
