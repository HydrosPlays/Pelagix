import type { Messages } from '../types'

/** English text of the "common" namespace. Full key: "common.<key>". See ../README.md. */
const messages = {
  // Single words many features share. A word that is part of a sentence belongs in that sentence's message instead.
  'cancel': 'Cancel',
  'close': 'Close',
  'save': 'Save',
  'delete': 'Delete',
  'remove': 'Remove',
  'edit': 'Edit',
  'done': 'Done',
  'retry': 'Retry',
  'reset': 'Reset',
  'clear': 'Clear',
  'search': 'Search',
  'all': 'All',
  'none': 'None',
  'unknown': 'Unknown',
  'shiny': 'Shiny',
  'male': 'Male',
  'female': 'Female',
  'genderless': 'Genderless',
  'level': 'Level',
  'undo': 'Undo',
  'duplicate': 'Duplicate'
} satisfies Messages

export default messages
