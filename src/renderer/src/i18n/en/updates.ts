import type { Messages } from '../types'

/** English text of the "updates" namespace. Full key: "updates.<key>". See ../README.md. */
const messages = {
  // The changelog window of a newer version. {version} is a version number such as "0.7.0".
  'offer.title.available': 'Pelagix {version} is available',
  'offer.title.ready': 'Pelagix {version} is ready to install',
  'offer.title.installing': 'Installing Pelagix {version}',
  // Read out by a screen reader when the download finishes.
  'offer.readySpoken': 'Pelagix {version} is ready to install.',
  'offer.description': 'You have version {version}.',
  // {count} releases, always more than one.
  'offer.descriptionMany': {
    one: 'You have version {version}. The notes below cover {count} release, newest first.',
    other: 'You have version {version}. The notes below cover {count} releases, newest first.'
  },
  'offer.note.downloading': 'You can close this window. The download carries on.',
  'offer.note.ready': 'Pelagix closes and reopens by itself, in a few seconds. Closing it yourself does not install the update.',
  'offer.note.installing': 'Pelagix closes now and reopens by itself in a few seconds.',
  'offer.note.manual': 'This is a portable copy, so it is replaced by hand: download the new version from GitHub and use it instead of this one.',
  'offer.note.overdue': 'Pelagix should have closed by now. Close this window and try again, or get the installer from the release page.',
  'offer.later': 'Later',
  'offer.restarting': 'Restarting Pelagix…',
  'action.release': 'Open the release page',
  'action.retry': 'Try again',
  'action.restart': 'Restart and update',
  'action.download': 'Download and install',
  'problem.editorOpen': 'Finish or close the entry you are editing first. It has not been saved yet, and the restart would lose it.',
  'problem.notSaved': 'Your latest changes are not on disk yet, so Pelagix did not restart. Nothing is lost while it stays open. Settings shows what is wrong; try again once they are saved.',

  // The download. {percent} is "42%", {done} and {total} are sizes such as "12.4 MB".
  'progress.label': 'Downloading <b>{percent}</b>',
  'progress.bar': 'Downloading version {version}',
  'progress.amount': '{done} of {total}',
  // A download speed: {size} per second.
  'progress.speed': '{size}/s',

  // "What's new", shown once after an update
  'whatsNew.title': 'What’s new in {version}',
  'whatsNew.updated': 'Pelagix was updated.',
  'whatsNew.updatedFrom': 'Pelagix was updated from version {from}.',
  // {count} releases, always more than one.
  'whatsNew.updatedMany': {
    one: 'Pelagix was updated. The notes below cover {count} release, newest first.',
    other: 'Pelagix was updated. The notes below cover {count} releases, newest first.'
  },
  'whatsNew.updatedFromMany': {
    one: 'Pelagix was updated from version {from}. The notes below cover {count} release, newest first.',
    other: 'Pelagix was updated from version {from}. The notes below cover {count} releases, newest first.'
  },
  'whatsNew.release': 'This release on GitHub',

  // The release notes. Their own text comes from GitHub as it was written; this is what stands around it.
  'notes.version': 'Version {version}',
  'notes.skipped': 'These notes are left out to keep this window quick. <link>Read them on GitHub</link>',
  'notes.empty': 'This release has no description.',
  'notes.truncated': 'These notes are longer than this window shows. <link>Read the rest on GitHub</link>',
  'notes.missing': 'The notes for this version could not be loaded. <link>Read what changed on GitHub</link>',
  // The text of a link that stands in for a picture without a description.
  'notes.image': 'image',
  // A ticked and an unticked box of a task list.
  'notes.task.done': 'Done',
  'notes.task.notDone': 'Not done',
  // The label on a highlighted block.
  'notes.alert.note': 'Note',
  'notes.alert.tip': 'Tip',
  'notes.alert.important': 'Important',
  'notes.alert.warning': 'Warning',
  'notes.alert.caution': 'Caution',
  'window.failed.title': 'The release notes could not be shown',
  'window.failed.body': 'They are on the release page.',
  'link.failed': 'That link could not be opened',
  'link.opens': '(opens in your browser)',

  // The marker in the navigation rail, and the line on the screens that have no rail
  'indicator.downloading': 'Downloading {percent}',
  'indicator.ready': 'Update ready',
  'indicator.restarting': 'Restarting…',
  'indicator.available': 'Update available',
  'notice.downloading': 'Downloading Pelagix {version}: {percent}',
  // The button that opens the changelog window.
  'button.showDownload': 'Show the download',
  'button.install': 'Install the update',
  'button.showRestart': 'Show the restart',
  'button.whatsNew': 'See what’s new',

  // The status at the top of Settings > Updates
  'status.off.title': 'Update checks run in the packaged app',
  'status.off.detail': 'This is a development build, so nothing is checked or downloaded.',
  'status.checking': 'Checking for updates…',
  'status.installing.title': 'Installing version {version}…',
  'status.installing.detail': 'Pelagix closes and reopens by itself.',
  'status.downloading': 'Downloading version {version}',
  'status.ready.title': 'Version {version} is ready to install',
  // "Restart and update" is the button "action.restart".
  'status.ready.detail': 'Choose “Restart and update” to install it. Closing Pelagix yourself does not.',
  'status.available.title': 'Version {version} is available',
  'status.available.manual': 'Download it from GitHub to replace this copy.',
  'status.checkFailed': 'The last check did not work',
  'status.notChecked': 'Not checked yet',
  'status.notChecked.auto': 'Pelagix checks by itself a few seconds after it starts.',
  'status.notChecked.manual': 'Automatic checks are off. Check whenever you like.',
  'status.upToDate': 'Pelagix is up to date',
  // {when} is a time ago in words: "just now", "5 min ago", "yesterday". {date} is a date.
  'status.lastChecked': 'Last checked {when}',
  'status.lastCheckedOn': 'Last checked on {date}',
  'check.available': 'Version {version} is available.',
  'check.newest': 'You have the newest version.',

  // Why a check, a download or an install failed
  'error.check.offline': 'GitHub could not be reached. Check your internet connection, then try again.',
  'error.check.notReady': 'The newest release is not ready yet: its update files are still missing. Try again later.',
  'error.check.rateLimited': 'GitHub is turning away requests from your network at the moment. That usually clears within an hour.',
  'error.check.corrupt': 'GitHub sent an answer Pelagix could not read. Try again later.',
  'error.check.disk': 'Pelagix could not write to its data folder, so the check was not finished.',
  'error.check.unknown': 'The check did not work. Try again later.',
  'error.download.offline': 'The download stopped because GitHub could not be reached. Check your internet connection, then try again.',
  'error.download.notReady': 'The files for this update are not on GitHub yet. Try again later.',
  'error.download.rateLimited': 'GitHub is turning away downloads from your network at the moment. That usually clears within an hour.',
  'error.download.corrupt': 'The download arrived damaged and was thrown away. Download it again.',
  'error.download.disk': 'The update could not be saved on this computer. Free up some disk space, then try again.',
  'error.download.unknown': 'The download did not work. Try again, or get the new version from the release page.',
  'error.install.corrupt': 'The downloaded update turned out to be damaged, so it was not installed. Download it again.',
  'error.install.disk': 'Windows would not start the installer. Try again, or get the installer from the release page.',
  'error.install.unknown': 'The update could not be started. Try again, or get the installer from the release page.',

  // Toasts
  'toast.updated.title': 'Pelagix was updated to version {version}',
  'toast.updated.body': 'What changed is on the release page.',
  'toast.open': 'Open it',
  // "Restart" is the button of this toast, "toast.ready.action".
  'toast.ready.body': 'Choose Restart to install it: Pelagix closes and reopens by itself.',
  'toast.ready.action': 'Restart',
  'toast.failed.title': 'Pelagix {version} could not be downloaded',
  'toast.failed.action': 'Show'
} satisfies Messages

export default messages
