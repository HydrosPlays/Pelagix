import type { Messages } from '../types'

/** English text of the "home" namespace. Full key: "home.<key>". See ../README.md. */
const messages = {
  // The region each generation introduced.
  'region.1': 'Kanto',
  'region.2': 'Johto',
  'region.3': 'Hoenn',
  'region.4': 'Sinnoh',
  'region.5': 'Unova',
  'region.6': 'Kalos',
  'region.7': 'Alola',
  'region.8': 'Galar',
  'region.9': 'Paldea',
  'region.unknown': 'Generation {gen}',

  // The greeting by time of day. Without a trainer name, {name} is "greeting.trainer".
  'greeting.morning': 'Good morning, {name}',
  'greeting.afternoon': 'Good afternoon, {name}',
  'greeting.evening': 'Good evening, {name}',
  'greeting.trainer': 'Trainer',

  // One or two sentences under the greeting.
  'next.complete': 'Every slot is filled. Your Living Dex is complete!',
  'next.streak': { one: 'You are on a {count}-day streak. Log a catch today to keep it going.', other: 'You are on a {count}-day streak. Log a catch today to keep it going.' },
  'next.left': '{left} still to catch.',
  // {region} is a region name ("Johto"), {missing} a number of Pokémon.
  'next.leftClosest': '{left} still to catch. {region} is closest: {missing} more to finish it.',

  // Which Living Dex rules are on, as a short label.
  'rules.species': 'Species rules',
  'rules.forms': 'Forms rules',
  'rules.completionist': 'Completionist rules',
  'rules.custom': 'Custom rules',

  'action.logCatch': 'Log a catch',
  'action.browse': 'Browse the Pokédex',
  'action.openLiving': 'Open Living Dex',

  // The band at the top of the dashboard
  'hero.eyebrow': 'Your Living Dex',
  'hero.ring.label': 'Living Dex completion',
  'hero.ring.value': '{caught} of {total} caught ({percent})',
  // Read by screen readers between two numbers, where the eye sees "433 / 1,365".
  'hero.of': 'of',
  // The label under "433 / 1,365".
  'hero.caught': 'caught',
  'hero.stat.species': 'Species',
  'hero.stat.entries': 'Entries logged',
  // <keys/> is the keyboard shortcut, shown as key caps.
  'hero.hint': '<keys/><text>finds any Pokémon</text>',
  'hero.rulesHint': 'Choose which forms get their own slot',
  // {rules} is one of the "rules.*" labels above.
  'hero.slots': { one: '{count} slot · {rules}', other: '{count} slots · {rules}' },

  // "Continue the hunt"
  'hunt.title': 'Continue the hunt',
  'hunt.missing': '{count} still missing',
  // {name} is a Pokémon, {number} its Pokédex number ("#0025").
  'hunt.tile': '{name}, {number}, not caught yet. Open its Pokédex page',
  'hunt.done.title': 'Nothing left to hunt',
  'hunt.done.text': 'Every slot of your Living Dex is filled. Shinies and other games are still out there.',

  // First run
  'welcome.eyebrow': 'Welcome',
  'welcome.eyebrowNamed': 'Welcome, {name}',
  'welcome.title': 'Your Living Dex starts here',
  'welcome.lead': 'Pelagix keeps track of every Pokémon you catch, in every game: where you found it, the ball you used, its form, and whether it is shiny. One catch at a time, your Living Dex fills up.',
  'welcome.name.label': 'What should we call you?',
  'welcome.name.placeholder': 'Trainer name',
  'welcome.name.hint': 'Used in greetings and filled in as the Original Trainer when you log a catch.',
  'welcome.name.saved': 'Saved. Nice to meet you, {name}.',
  'welcome.find': 'Find a Pokémon',
  'welcome.steps.title': 'How it works',
  // Read by screen readers before the title of a step.
  'welcome.step.number': 'Step {number}:',
  'welcome.step.find.title': 'Find a Pokémon',
  'welcome.step.find.text': 'Look through the Pokédex or search by name or number. Every form, gender difference and shiny is in there.',
  'welcome.step.pick.title': 'Pick the game and location',
  'welcome.step.pick.text': 'Its page lists every game it can be found in and how: caught, traded, gifted, evolved, bred or from an event.',
  'welcome.step.log.title': 'Log it',
  'welcome.step.log.text': 'Choose the ball, add the details you care about, and check it off. Log the same Pokémon again to collect it across games.',
  'welcome.foot.species': { one: 'Your Living Dex has <b>{count} slot</b> under the Species rules.', other: 'Your Living Dex has <b>{count} slots</b> under the Species rules.' },
  'welcome.foot.forms': { one: 'Your Living Dex has <b>{count} slot</b> under the Forms rules.', other: 'Your Living Dex has <b>{count} slots</b> under the Forms rules.' },
  'welcome.foot.completionist': { one: 'Your Living Dex has <b>{count} slot</b> under the Completionist rules.', other: 'Your Living Dex has <b>{count} slots</b> under the Completionist rules.' },
  'welcome.foot.custom': { one: 'Your Living Dex has <b>{count} slot</b> under the custom rules.', other: 'Your Living Dex has <b>{count} slots</b> under the custom rules.' },
  'welcome.foot.link': 'Choose which forms count',

  // Counts used in several panels
  'entries': { one: '{count} entry', other: '{count} entries' },
  'shiny': '{count} shiny',

  // Generation progress
  'gens.title': 'Generation progress',
  'gens.eyebrow': 'Region by region',
  'gens.more': 'Pokédex',
  // {region} "Kanto", {generation} "Generation I".
  'gens.row': '{region}, {generation}: {caught} of {total} caught ({percent}). Show this generation in the Pokédex',

  // Recent catches
  'recent.title': 'Recent catches',
  'recent.more': 'Journal',
  'recent.all': 'See all {count} entries in the journal',

  // Your games
  'games.title': 'Your games',
  'games.eyebrow.none': 'Where you catch',
  // {systems} is the message "games.systemCount", which has a count of its own.
  'games.eyebrow': { one: '{count} game on {systems}', other: '{count} games on {systems}' },
  'games.systemCount': { one: '{count} system', other: '{count} systems' },
  'games.none': 'None of your entries come from a game Pelagix knows yet.',
  'games.species': { one: '{count} species', other: '{count} species' },
  'games.share': 'Share of entries from {game}',
  // The word under the number of entries of a game; the number is not part of this text.
  'games.entriesWord': { one: 'entry', other: 'entries' },
  'games.also': 'Also',
  'games.game': { one: '{game}: {count} entry', other: '{game}: {count} entries' },
  'games.systems': 'Systems',
  // {system} is a console; {games} is the message "games.gameCount", which has a count of its own.
  'games.system': { one: '{system}: {count} entry from {games}', other: '{system}: {count} entries from {games}' },
  'games.gameCount': { one: '{count} game', other: '{count} games' },
  'games.unknown': {
    one: '{count} entry comes from a game this version of Pelagix does not know. It still counts toward your Living Dex.',
    other: '{count} entries come from a game this version of Pelagix does not know. They still count toward your Living Dex.'
  },

  // Activity
  'activity.title': 'Activity',
  // A span of months: "Nov 2025 – Oct 2026".
  'activity.range': '{from} – {to}',
  'activity.days': { one: '{count} day', other: '{count} days' },
  'activity.streak.current': 'Current streak',
  'activity.streak.caughtToday': 'Caught today',
  'activity.streak.logToday': 'Log one today',
  'activity.streak.starts': 'Starts with a catch',
  'activity.streak.best': 'Best streak',
  'activity.streak.stillGoing': 'Still going',
  'activity.streak.ended': 'Ended {date}',
  'activity.activeDays': 'Days with a catch',
  'activity.since': 'Since {date}',
  'activity.chart': 'Catches per month, {range}',
  // {month} is a month with its year: "October 2026".
  'activity.month.none': '{month}: no catches',
  'activity.month.short': { one: '{month}: {count} catch', other: '{month}: {count} catches' },
  'activity.month.full': { one: '{month}: {count} catch, {fresh} new for your Living Dex', other: '{month}: {count} catches, {fresh} new for your Living Dex' },
  'activity.month.fullShiny': {
    one: '{month}: {count} catch, {fresh} new for your Living Dex, {shiny} shiny',
    other: '{month}: {count} catches, {fresh} new for your Living Dex, {shiny} shiny'
  },
  'activity.summary.none': 'No catches in these months.',
  // {entries} is the number of catches of that busiest month.
  'activity.summary.busiest': { one: '{count} catch. Busiest month: {month} ({entries}).', other: '{count} catches. Busiest month: {month} ({entries}).' },
  'activity.summary.single': { one: '{count} catch, all in {month}.', other: '{count} catches, all in {month}.' },

  // Type coverage
  'types.title': 'Type coverage',
  'types.eyebrow': { one: '{count} type', other: '{count} types' },
  'types.row': '{type}: {caught} of {total} caught ({percent})',
  'types.meter': '{type} type',
  'types.meterValue': '{caught} of {total} caught',
  'types.note': 'A Pokémon with two types counts toward both.',

  // Balls used
  'balls.title': 'Balls used',
  'balls.eyebrow.none': 'What you catch with',
  'balls.eyebrow': { one: '{count} kind of ball', other: '{count} kinds of ball' },
  'balls.none': 'No balls recorded yet. Pick the ball when you log a catch and it shows up here.',
  'balls.favourite': 'Favourite',
  // {used} catches with the favourite ball, out of {count} catches with a ball.
  'balls.share': { one: '{used} of {count} catch ({percent})', other: '{used} of {count} catches ({percent})' },
  'balls.ball': { one: '{ball}: {count} catch', other: '{ball}: {count} catches' },
  'balls.ballShiny': { one: '{ball}: {count} catch, {shiny} shiny', other: '{ball}: {count} catches, {shiny} shiny' },
  'balls.noBall': { one: '{count} entry has no ball recorded.', other: '{count} entries have no ball recorded.' },

  // The achievements card, when it cannot be drawn
  'achievements.title': 'Achievements',
  'achievements.failed': 'Your achievements could not be shown here. They are safe; open the Achievements page to see them.'
} satisfies Messages

export default messages
