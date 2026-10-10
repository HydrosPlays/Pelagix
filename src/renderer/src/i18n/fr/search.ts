import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': 'Recherche et commandes',
  'input': 'Rechercher des Pokémon, des pages et des actions',
  'results': 'Résultats',
  'empty.title': 'Aucun résultat pour « {query} »',
  'empty.hint': 'Essayez le nom ou le numéro d’un Pokémon, ou une page comme Journal.',
  'footer.move': '<keys/> Naviguer',
  'footer.open': '<keys/> Ouvrir',
  'footer.close': '<keys/> Fermer',
  'status.none': 'Aucun résultat',
  'status.count': { one: '{count} résultat', many: '{count} résultats', other: '{count} résultats' },

  'section.pokemon': 'Pokémon',
  'section.recent': 'Ouverts récemment',
  'section.pages': 'Pages',
  'section.actions': 'Actions',

  'row.shiny': 'Chromatique enregistré',
  'row.missing': 'Pas encore capturé',

  'action.log': 'Enregistrer une capture de {name}',
  'action.shiny.on': 'Activer la vue chromatique',
  'action.shiny.off': 'Désactiver la vue chromatique',
  'action.theme.light': 'Passer au thème clair',
  'action.theme.dark': 'Passer au thème sombre',
  'action.motion.on': 'Activer la réduction des animations',
  'action.motion.off': 'Désactiver la réduction des animations',
  'hint.on': 'Activé',
  'hint.off': 'Désactivé',
  'hint.dark': 'Sombre',
  'hint.light': 'Clair',

  'toast.shiny.on': 'Vue chromatique activée',
  'toast.shiny.on.body': 'Les Pokémon sont affichés dans leurs couleurs chromatiques.',
  'toast.shiny.off': 'Vue chromatique désactivée',
  'toast.motion.on': 'Réduction des animations activée',
  'toast.motion.off': 'Réduction des animations désactivée',

  'keywords.page.home': 'accueil tableau de bord aperçu apercu début debut progression résumé resume',
  'keywords.page.dex': 'pokedex pokédex pokemon pokémon parcourir espèces especes liste',
  'keywords.page.living': 'boîtes boites collection formes emplacements',
  'keywords.page.homedex': 'pokemon pokémon home envoyé envoye transféré transfere stocké stocke banque boîtes boites',
  'keywords.page.journal': 'entrées entrees journal historique captures registre',
  'keywords.page.achievements': 'succès succes trophées trophees médailles medailles badges objectifs',
  'keywords.page.settings': 'paramètres parametres réglages reglages préférences preferences options règles regles thème theme importer exporter sauvegarde langue',
  'keywords.action.log': 'enregistrer capture ajouter nouvelle entrée entree capturé capture attrapé attrape',
  'keywords.action.shiny': 'basculer chromatique shiny vue sprites rendus',
  'keywords.action.theme': 'basculer changer thème theme sombre clair apparence mode',
  'keywords.action.motion': 'basculer réduire reduire animation animations mouvement mouvements',
  'keywords.logPhrase': 'enregistrer une capture'
}

export default messages
