import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': 'Accueil',
  'route.dex': 'Pokédex',
  'route.species': 'Pokémon',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME Dex',
  'route.journal': 'Journal',
  'route.achievements': 'Succès',
  'route.settings': 'Paramètres',
  'route.kit': 'Kit de composants',
  'route.notFound': 'Introuvable',

  'nav.label': 'Navigation principale',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '{caught} sur {total} capturés',
  'nav.progress.tooltip': 'Living Dex : {count} ({percent})',
  'nav.progress.label': 'Progression du Living Dex : {count}',
  'nav.progress.ring': 'Progression du Living Dex',

  'topbar.fixture': 'Données de test',
  'topbar.fixtureHint': 'Les vrais jeux de données sont introuvables : un petit échantillon de développement est chargé. Exécutez npm run data.',
  'topbar.notSaved': 'Non enregistré',
  'topbar.search': 'Rechercher un Pokémon…',
  'topbar.shiny.on': 'Vue chromatique activée',
  'topbar.shiny.off': 'Vue chromatique désactivée',
  'topbar.shiny.showing': 'Sprites chromatiques affichés',
  'topbar.shiny.show': 'Afficher les sprites chromatiques',

  'skipToContent': 'Aller au contenu',
  'pageError': 'Cette page a rencontré un problème',
  'appError': 'Pelagix a rencontré un problème',
  'notFound.title': 'Eaux inexplorées',
  'notFound.description': 'Il n’y a aucune page à cette adresse.',
  'notFound.back': 'Retour à l’accueil',

  'boot.step.save': 'Chargement de votre sauvegarde',
  'boot.step.dex': 'Remontée des données du Pokédex',
  'boot.retry': 'Réessayer',
  'boot.reload': 'Recharger l’application',
  'boot.dataMissing.title': 'Les données du Pokédex sont introuvables',
  'boot.dataMissing.hint': 'Exécutez <code>npm run data</code> pour générer les données, puis réessayez.',
  'boot.dataMissing.detail': 'Le jeu de données n’a pas pu être chargé.',
  'boot.saveFailed.title': 'Votre sauvegarde n’a pas pu être chargée',
  'boot.saveFailed.hint': 'Rien n’a été écrasé. Vérifiez que le fichier de sauvegarde est lisible, puis réessayez.',

  'loadReport.newer': 'Cette sauvegarde vient d’une version plus récente de Pelagix',
  'loadReport.repaired': 'Votre sauvegarde a été réparée au chargement',

  'language.title': 'Choisissez votre langue',
  'language.description': 'Pelagix et les noms des Pokémon, des jeux et des lieux seront affichés dans cette langue. Vous pourrez la changer plus tard dans les Paramètres.',
  'language.list': 'Langue',
  'language.confirm': 'Continuer'
}

export default messages
