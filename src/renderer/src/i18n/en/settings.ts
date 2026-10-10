import type { Messages } from '../types'

/** English text of the "settings" namespace. Full key: "settings.<key>". See ../README.md. */
const messages = {
  'language.label': 'Language',
  'language.description': 'For Pelagix itself and for the names of Pokémon, games and places. Nicknames, trainer names and notes stay as you wrote them.',

  // The page, its index and the "is it saved" status.
  'page.title': 'Settings',
  'page.subtitle': 'Everything here is saved the moment you change it.',
  'page.index': 'Settings sections',
  'section.trainer': 'Trainer',
  'section.rules': 'Living Dex rules',
  'section.appearance': 'Appearance',
  'section.data': 'Your data',
  'section.sprites': 'Sprite cache',
  'section.updates': 'Updates',
  'section.about': 'About',
  'status.saved': 'All changes saved',
  'status.saving': 'Saving…',
  'status.failing': 'Not saved',
  'status.failingNote': 'Pelagix keeps trying.',
  // {when} is a date and time, already written in the language.
  'status.note': 'Settings save automatically. Last change {when}.',
  'mark.saved': 'Saved',
  'mark.saving': 'Saving…',
  'mark.failing': 'Not saved',
  'alert.title': 'Your changes are not being saved',
  'alert.safe': 'Everything is still here while Pelagix stays open. Export a copy to be safe.',
  'alert.retry': 'Try again',
  'alert.export': 'Export a copy',
  'alert.saved.title': 'Saved',
  'alert.saved.body': 'Your changes are stored again.',
  'alert.stillFailing': 'Still not saved',
  'export.done': 'Save exported',
  'export.downloaded': 'Save downloaded',
  'export.downloadedBody': 'Look for {file} in your downloads.',
  'export.failed': 'The save could not be exported',
  'link.failed': 'That link could not be opened',
  'link.opens': '(opens in your browser)',

  // Trainer
  'trainer.description': 'Who these Pokémon belong to.',
  'trainer.name.label': 'Trainer name',
  'trainer.name.placeholder': 'Your name in the games',
  // {greeting} is the greeting of the Home page, for example "Good morning, Hydro".
  'trainer.greets': 'Home greets you with <b>“{greeting}”</b>',
  'trainer.otEmpty': 'The Original Trainer of a new entry starts empty',
  'trainer.otNamed': 'New entries start with <b>{name}</b> as the Original Trainer (OT), and you can change it for each catch',

  // Living Dex rules
  'rules.description': 'Decide which forms get a slot of their own. Base forms always do.',
  // Stands right after the big number of slots, which is not part of this text.
  'rules.total': { one: 'slot in your Living Dex', other: 'slots in your Living Dex' },
  'rules.before': '{count} before your changes',
  'rules.sameSize': 'same size',
  'rules.caught': '{caught} caught ({percent})',
  'rules.undo': 'Undo changes',
  'rules.preset.label': 'Rule preset',
  'rules.preset.speciesOnly': 'Species only',
  'rules.preset.custom': 'Custom',
  'rules.preset.customDescription': 'Your own mix of the switches below.',
  'rules.group.box.title': 'Forms you can keep in a box',
  'rules.group.box.description': 'Switch a kind of form on and every one of them gets a slot of its own.',
  'rules.group.battle.title': 'Forms that only exist in battle',
  'rules.group.battle.description': 'They cannot be stored, so most Living Dexes leave them out. Switch them on if you want a slot for each one anyway.',
  'rules.impact.removes': { one: 'Switching this off removes {count} slot', other: 'Switching this off removes {count} slots' },
  'rules.impact.adds': { one: 'Switching this on adds {count} slot', other: 'Switching this on adds {count} slots' },
  'rules.impact.none': 'no change',
  'rules.impact.slots': { one: '{count} slot', other: '{count} slots' },
  'rules.footnote': "Changing the rules never deletes an entry. A catch whose form loses its slot simply counts toward that Pokémon's base slot, and gets its own slot back when you switch the rule on again.",

  // Appearance
  'appearance.description': 'How Pelagix looks and moves.',
  'theme.label': 'Theme',
  'theme.description': 'Dark is easy on the eyes at night. Light works better in a bright room.',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'reduceMotion.label': 'Reduce motion',
  'reduceMotion.description': 'Turns off animations and transitions. Pelagix also follows the reduced-motion setting of your system.',
  'reduceMotion.system': 'Your system already asks for reduced motion, so animations are off either way.',
  'density.label': 'Pokédex density',
  'density.description': 'How tightly the Pokédex grid is packed. Remembered on this device.',
  'density.comfortable': 'Comfortable',
  'density.compact': 'Compact',

  // Your data
  'data.description': 'Your save holds every entry, your settings and your achievements. Keep a copy somewhere safe.',
  'data.entries': 'Entries',
  'data.achievements': 'Achievements',
  'data.lastChange': 'Last change',
  'data.never': 'Never',
  'data.started': 'Started',
  'data.where.title': 'Where your save lives',
  'data.where.file': 'Pelagix writes this file after every change and keeps backups in the same folder.',
  'data.where.folder': 'In the Pelagix data folder on this computer.',
  'data.where.browser': "In this browser's storage, on this device only. Clearing the site data of this page erases it, so export a copy now and then.",
  'data.export.label': 'Export save',
  'data.export.description': 'A single file with everything in it. Use it as a backup or to move to another computer.',
  'data.import.label': 'Import save',
  'data.import.description': 'Open a save file. You see what is in it before anything changes, and choose to merge or replace.',
  'data.gameSave.label': 'Import from a game save',
  'data.gameSave.description': 'Open a save file of a Pokémon game and add the Pokémon in it as entries. You choose which ones first. The save file is only read, never changed.',
  'data.shinyDex.label': 'Import from ShinyDex',
  'data.shinyDex.description':
    'Choose your ShinyDex export, a .json file. A saved copy of your History page on shinydex.com works too: scroll to the end so that every shiny is listed, save the page from the browser and choose the .html file. You choose which shinies to add first, and your rules and settings stay as they are.',
  'data.reading': 'Reading…',
  'data.importFailed': 'That file could not be imported',
  'data.danger.title': 'Danger zone',
  'data.danger.description': 'Reset deletes every entry and achievement. You are asked to confirm, and you can keep your settings.',
  'data.danger.reset': 'Reset…',

  // The "Undo" offered after the save was replaced, merged into or reset.
  'undo.action': 'Undo',
  'undo.done.title': 'Your previous save is back',
  'undo.done.body': { one: '{count} entry', other: '{count} entries' },
  'undo.failed': 'The previous save could not be restored',

  // Import of a Pelagix save
  'import.title': 'Import this save?',
  'import.description': 'Nothing has changed yet. Check the file, then choose what to do with it.',
  'import.shiny': '{count} shiny',
  'import.lastSaved': 'Last saved',
  'import.trainer': 'Trainer',
  'import.trainerNotSet': 'Not set',
  'import.warning.newer': 'This file was written by a newer version of Pelagix. Anything this version does not understand is left out.',
  'import.warning.dropped': {
    one: '{count} entry could not be read (damaged or repeated) and is left out.',
    other: '{count} entries could not be read (damaged or repeated) and are left out.'
  },
  'import.warning.repaired': {
    one: '{count} entry had a detail that made no sense; it is kept without it.',
    other: '{count} entries had a detail that made no sense; they are kept without it.'
  },
  'import.merge.title': 'Merge entries',
  'import.merge.nothing': 'Every entry in this file is already in your save, so there is nothing to add.',
  'import.merge.text': {
    one: 'Adds the <b>{count} entry</b> you do not have yet. Your settings and achievements stay as they are.',
    other: 'Adds the <b>{count} entries</b> you do not have yet. Your settings and achievements stay as they are.'
  },
  // {known} is the message "import.merge.known", which has a count of its own.
  'import.merge.textKnown': {
    one: 'Adds the <b>{count} entry</b> you do not have yet ({known}). Your settings and achievements stay as they are.',
    other: 'Adds the <b>{count} entries</b> you do not have yet ({known}). Your settings and achievements stay as they are.'
  },
  'import.merge.known': { one: '{count} is already here', other: '{count} are already here' },
  'import.replace.title': 'Replace everything',
  'import.replace.text': {
    one: 'Swaps your current save (<b>{count} entry</b>, its settings and achievements) for this file.',
    other: 'Swaps your current save (<b>{count} entries</b>, its settings and achievements) for this file.'
  },
  'import.replace.exportFirst': 'Export what you have first',
  'import.nothingNew.title': 'Nothing new to add',
  'import.nothingNew.body': 'Every entry in that file is already in your save.',
  'import.added.title': { one: '{count} entry added', other: '{count} entries added' },
  'import.added.skipped': { one: '{count} entry was already in your save.', other: '{count} entries were already in your save.' },
  'import.added.untouched': 'Your settings and achievements stayed as they were.',
  'import.mergeFailed': 'The entries could not be merged',
  'import.replaced.title': 'Save replaced',
  'import.replaced.body': { one: '{count} entry loaded from the file.', other: '{count} entries loaded from the file.' },
  'import.replaceFailed': 'The save could not be replaced',

  // Import from a game save or from ShinyDex: the toasts once the dialog is done. {file} is a file name.
  'gameSave.completed.title': { one: '{count} entry completed', other: '{count} entries completed' },
  'gameSave.completed.body': {
    one: 'From {file}: {count} earlier entry got the ability, PID, IVs or EVs it lacked.',
    other: 'From {file}: {count} earlier entries got the ability, PID, IVs or EVs they lacked.'
  },
  'gameSave.nothingNew.body': 'Every Pokémon you chose is already in your save.',
  'gameSave.added.body': 'Imported from {file}. You can edit them like any other entry.',
  // {count} is the number of earlier entries that were completed, not the number added.
  'gameSave.added.bodyCompleted': {
    one: 'Imported from {file}. You can edit them like any other entry. {count} earlier entry got the ability, PID, IVs or EVs it lacked.',
    other: 'Imported from {file}. You can edit them like any other entry. {count} earlier entries got the ability, PID, IVs or EVs they lacked.'
  },

  // Reset
  'reset.title': 'Reset your Living Dex?',
  'reset.description.nothing': 'This deletes everything you have logged.',
  'reset.description.entries': { one: 'This deletes all {count} entry.', other: 'This deletes all {count} entries.' },
  // {achievements} is the message "reset.achievements", which has a count of its own.
  'reset.description.nothingAnd': 'This deletes everything you have logged and {achievements}.',
  'reset.description.entriesAnd': { one: 'This deletes all {count} entry and {achievements}.', other: 'This deletes all {count} entries and {achievements}.' },
  'reset.achievements': { one: '{count} unlocked achievement', other: '{count} unlocked achievements' },
  'reset.confirm': 'Delete everything',
  'reset.keep.label': 'Keep my settings',
  'reset.keep.description': 'Trainer name, Living Dex rules and theme stay as they are. Untick to start completely fresh.',
  // <word/> and {word} are the word to type, RESET, which is the same in every language.
  'reset.type': 'Type <word/> to confirm',
  'reset.typeError': 'Type {word} in capital letters to go ahead.',
  'reset.wayBack': 'Want a way back?',
  'reset.exportFirst': 'Export your save first',
  'reset.done.title': 'Your Living Dex was reset',
  'reset.done.body': { one: '{count} entry deleted.', other: '{count} entries deleted.' },
  'reset.done.bodyKept': { one: '{count} entry deleted; your settings were kept.', other: '{count} entries deleted; your settings were kept.' },
  'reset.failed': 'The reset did not go through',

  // File sizes: {value} is the number, already written the way the language writes decimals.
  'size.kb': '{value} KB',
  'size.mb': '{value} MB',
  'size.gb': '{value} GB',

  // Sprite cache. {size} is a file size such as "38.2 MB".
  'sprites.description': 'Renders Pelagix has already downloaded, kept on this computer so they appear instantly and work offline.',
  'sprites.browser.description': 'Where the Pokémon renders come from.',
  'sprites.browser.text':
    'In a browser, Pokémon HOME renders load straight from the <link>PokeAPI sprites</link> repository each time, so nothing is stored here and there is nothing to clear. The desktop app keeps a copy of every render it has shown, which makes them appear instantly and work offline.',
  'sprites.readFailed': 'The cache could not be read.',
  'sprites.onDisk': 'On disk',
  // The label under the number of renders, which is not part of this text.
  'sprites.renders': { one: 'Render', other: 'Renders' },
  'sprites.refresh': 'Refresh',
  'sprites.clear': 'Clear cache',
  'sprites.footnote': 'Renders come from the <link>PokeAPI sprites</link> repository. Clearing the cache only frees space: they download again as you browse.',
  'sprites.confirm.title': 'Clear the sprite cache?',
  'sprites.confirm.description': {
    one: '{count} render ({size}) will be removed from this computer. They download again as you browse, so you need to be online for that.',
    other: '{count} renders ({size}) will be removed from this computer. They download again as you browse, so you need to be online for that.'
  },
  'sprites.confirm.keep': 'Keep it',
  'sprites.cleared.title': 'Sprite cache cleared',
  'sprites.cleared.body': { one: '{count} file removed, {size} freed.', other: '{count} files removed, {size} freed.' },
  'sprites.clearFailed': 'The sprite cache could not be cleared',

  // Updates (the wording of the update states themselves is in the "updates" namespace)
  'updates.description': 'New versions of Pelagix, from its releases on GitHub.',
  'updates.version': 'Version {version}',
  'updates.releases': 'Every version, with its notes and downloads: <link>all releases on GitHub</link>',
  'updates.check': 'Check for updates',
  'updates.downloading': 'Downloading version {version}',
  'updates.auto.label': 'Check for updates automatically',
  'updates.auto.description': 'A few seconds after Pelagix starts, and every six hours while it stays open, it asks GitHub whether a newer version exists. Nothing about you or your collection is sent.',
  'updates.portable': 'This is a portable copy of Pelagix. It tells you when a new version is out and shows what changed; you download the new version from GitHub yourself and use it in place of this one.',
  'updates.unavailable': 'Update information is not available yet.',
  'updates.notSaved.title': 'That setting could not be saved',
  'updates.notSaved.body': 'It holds until you close Pelagix, and is then forgotten. Try the switch again in a moment.',
  'updates.notChanged.title': 'That setting could not be changed',
  'updates.notChanged.body': 'Try again in a moment.',

  // About
  'about.description': 'The app, the data behind it, and the people whose work it stands on.',
  'about.version': 'Version {version}',
  'about.browser': 'Running in a browser',
  'about.tagline': 'A Living Dex tracker for every Pokémon game: find a Pokémon, see where it can be obtained, and log each one you catch.',
  'about.data.title': 'Pokédex data',
  'about.data.fixture': 'A small development sample is loaded, not the full dataset.',
  'about.data.pokemon': 'Pokémon',
  'about.data.forms': 'Forms',
  'about.data.ways': 'Ways to obtain',
  'about.data.games': 'Games',
  'about.data.built': 'Data built',
  'about.data.sprites': 'Sprites',
  'about.shortcuts.title': 'Keyboard shortcuts',
  // Between two keys that do the same thing: "← or →".
  'about.shortcuts.or': 'or',
  'about.shortcut.search': 'Search for any Pokémon',
  'about.shortcut.searchBox': 'Jump to the search box',
  'about.shortcut.neighbours': 'Previous or next Pokémon',
  'about.shortcut.saveEntry': 'Save the entry',
  'about.shortcut.notification': 'Jump to the newest notification and back',
  'about.shortcut.close': 'Close a dialog, menu or search',
  'about.where.anywhere': 'Anywhere',
  'about.where.pokedex': 'Pokédex',
  'about.where.species': 'Pokémon page',
  'about.where.editor': 'Entry editor',
  'about.credits.title': 'Credits and licences',
  'about.credit.encounters.title': 'Encounters and forms',
  'about.credit.encounters.text':
    'Where each Pokémon can be obtained, and the list of forms, are derived from <pkhex>PKHeX</pkhex>, which is published under the <gpl>GNU General Public License v3</gpl>.',
  'about.credit.names.title': 'Names and details',
  'about.credit.names.text': 'Names, types, Pokédex text and other details come from <link>PokeAPI</link>.',
  'about.credit.renders.title': 'Renders',
  'about.credit.renders.text': 'Pokémon HOME renders are loaded from the <link>PokeAPI sprites</link> repository. They are not part of Pelagix.',
  'about.legal':
    'Pokémon and all related names and images are trademarks and copyright of Nintendo, Game Freak, Creatures and The Pokémon Company. Pelagix is an unofficial, fan-made tool. It is not affiliated with, sponsored by or endorsed by any of them.'
} satisfies Messages

export default messages
