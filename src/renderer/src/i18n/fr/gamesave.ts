import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': 'Ce fichier n’est pas une sauvegarde de jeu Pokémon lisible par Pelagix.',
  'failure.too-large': 'Ce fichier est trop volumineux pour être une sauvegarde de jeu.',
  'failure.unreadable': 'Impossible d’ouvrir ce fichier. Un autre programme l’utilise peut-être.',
  'failure.reader-missing': 'Le composant de Pelagix qui lit les sauvegardes de jeu est introuvable. Réinstallez Pelagix pour le rétablir.',
  'failure.reader-failed': 'Un problème est survenu pendant la lecture de cette sauvegarde.',
  'failure.timed-out': 'La lecture de cette sauvegarde a pris trop de temps et a été interrompue.',
  'shinydexFailure.not-shinydex': 'Ce fichier n’est ni un export ShinyDex ni une page History de ShinyDex enregistrée : aucun chromatique n’y a été trouvé.',
  'shinydexFailure.too-large': 'Ce fichier est trop volumineux pour être un export ShinyDex ou une page ShinyDex enregistrée.',
  'shinydexFailure.unreadable': 'Impossible d’ouvrir ce fichier. Un autre programme l’utilise peut-être.',
  'shinydexFailure.other': 'Un problème est survenu pendant la lecture de ce fichier.',

  'dialog.title': 'Importer ces Pokémon ?',
  'dialog.add': { one: 'Ajouter {count} entrée', many: 'Ajouter {count} entrées', other: 'Ajouter {count} entrées' },
  'dialog.complete': { one: 'Compléter {count} entrée existante', many: 'Compléter {count} entrées existantes', other: 'Compléter {count} entrées existantes' },
  'dialog.nothing': 'Rien à ajouter',
  'dialog.failed': 'Impossible d’ajouter les Pokémon',

  'counts.new': { one: '{count} nouveau', many: '{count} nouveaux', other: '{count} nouveaux' },
  'counts.fills': { one: '{count} remplit un emplacement vide du Living Dex', many: '{count} remplissent un emplacement vide du Living Dex', other: '{count} remplissent un emplacement vide du Living Dex' },
  'counts.imported': { one: '{count} déjà importé', many: '{count} déjà importés', other: '{count} déjà importés' },
  'counts.completes': { one: '{count} entrée existante reçoit les détails manquants', many: '{count} entrées existantes reçoivent les détails manquants', other: '{count} entrées existantes reçoivent les détails manquants' },
  'counts.egg': { one: '{count} Œuf ignoré', many: '{count} Œufs ignorés', other: '{count} Œufs ignorés' },
  'counts.unsupported': { one: '{count} non importable', many: '{count} non importables', other: '{count} non importables' },

  'ask.label': 'De quel jeu viennent-ils ?',
  'ask.hint': 'Cette sauvegarde n’indique pas le jeu exact de certains Pokémon. Votre réponse s’applique à ceux qui peuvent venir de ce jeu.',
  'ask.placeholder': 'Choisir un jeu…',

  'bar.chosen': 'Nouveaux sélectionnés : {chosen} sur {total}',
  'bar.allNew': 'Tous les nouveaux',
  'bar.onlyEmpty': 'Emplacements vides uniquement',

  'row.import': 'Importer {name}',
  'row.nickname': '« {nickname} »',
  'row.eggOf': 'Œuf de {species}',
  'row.egg': 'Œuf',
  'row.unknownPokemon': 'Pokémon inconnu',
  'status.new': 'Nouveau',
  'status.newSlot': 'Nouvel emplacement',
  'status.imported': 'Déjà importé',
  'status.completes': 'Ajoute les détails manquants',
  'status.egg': 'Œuf',
  'status.eggSkipped': 'Œuf, ignoré',
  'status.unsupported': 'Non importable',

  'reason.unreadable': 'Il n’a pas pu être lu.',
  'reason.unknownPokemon': 'Pelagix ne connaît pas ce Pokémon.',
  'reason.unknownForm': 'Pelagix ne connaît pas cette forme.',
  'reason.untrackedGame': 'Il vient d’un jeu que Pelagix ne suit pas.',
  'reason.wrongGame': 'Il ne peut pas venir du jeu que vous avez choisi.',
  'reason.askGame': 'La sauvegarde n’indique pas son jeu d’origine. Choisissez-en un ci-dessus.',
  'reason.gameNotRecognised': 'Jeu non reconnu.',
  'reason.gameNotRecognisedNamed': 'Jeu non reconnu ({game}).',
  'reason.noDate': 'Sa date n’a pas pu être lue.',

  'source.save.description': '{file} est une sauvegarde de {game}. Rien n’a encore été modifié, et le fichier de sauvegarde est seulement lu.',
  'source.save.descriptionTrainer': '{file} est une sauvegarde de {game}, Dresseur {trainer}. Rien n’a encore été modifié, et le fichier de sauvegarde est seulement lu.',
  'source.save.games': 'Pokémon {names}',
  'source.save.unknownGame': 'un jeu de la génération {generation}',
  'source.save.dropped': { one: '{count} Pokémon de cette sauvegarde n’a pas pu être lu et est laissé de côté.', many: '{count} Pokémon de cette sauvegarde n’ont pas pu être lus et sont laissés de côté.', other: '{count} Pokémon de cette sauvegarde n’ont pas pu être lus et sont laissés de côté.' },
  'source.save.empty': 'Cette sauvegarde ne contient aucun Pokémon.',
  'source.save.list': 'Pokémon de cette sauvegarde',

  'source.shinydex.export': { one: '{file} est un export ShinyDex contenant {count} Pokémon chromatique. Rien n’a encore été modifié, et le fichier est seulement lu. Seuls ses Pokémon sont lus : jeu, méthode, date et les détails qu’il contient. Vos règles, vos paramètres et vos succès restent inchangés.', many: '{file} est un export ShinyDex contenant {count} Pokémon chromatiques. Rien n’a encore été modifié, et le fichier est seulement lu. Seuls ses Pokémon sont lus : jeu, méthode, date et les détails qu’il contient. Vos règles, vos paramètres et vos succès restent inchangés.', other: '{file} est un export ShinyDex contenant {count} Pokémon chromatiques. Rien n’a encore été modifié, et le fichier est seulement lu. Seuls ses Pokémon sont lus : jeu, méthode, date et les détails qu’il contient. Vos règles, vos paramètres et vos succès restent inchangés.' },
  'source.shinydex.page': { one: '{file} est un historique ShinyDex enregistré contenant {count} Pokémon chromatique. Rien n’a encore été modifié, et le fichier est seulement lu. Le jeu, la méthode, la date et la Ball viennent de ShinyDex ; le reste, vous l’ajoutez à la main.', many: '{file} est un historique ShinyDex enregistré contenant {count} Pokémon chromatiques. Rien n’a encore été modifié, et le fichier est seulement lu. Le jeu, la méthode, la date et la Ball viennent de ShinyDex ; le reste, vous l’ajoutez à la main.', other: '{file} est un historique ShinyDex enregistré contenant {count} Pokémon chromatiques. Rien n’a encore été modifié, et le fichier est seulement lu. Le jeu, la méthode, la date et la Ball viennent de ShinyDex ; le reste, vous l’ajoutez à la main.' },
  'source.shinydex.dropped': { one: 'Ce fichier contient plus de chromatiques que Pelagix n’en lit en une fois. Le dernier ({count}) est laissé de côté.', many: 'Ce fichier contient plus de chromatiques que Pelagix n’en lit en une fois. Les {count} derniers sont laissés de côté.', other: 'Ce fichier contient plus de chromatiques que Pelagix n’en lit en une fois. Les {count} derniers sont laissés de côté.' },
  'source.shinydex.unusable': { one: '{count} entrée de ce fichier n’a pas pu être lue et est laissée de côté.', many: '{count} entrées de ce fichier n’ont pas pu être lues et sont laissées de côté.', other: '{count} entrées de ce fichier n’ont pas pu être lues et sont laissées de côté.' },
  'source.shinydex.empty': 'Ce fichier ne contient aucun chromatique.',
  'source.shinydex.list': 'Chromatiques de ce fichier'
}

export default messages
