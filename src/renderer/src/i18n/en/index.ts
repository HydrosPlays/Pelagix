// Registers every English namespace once. To add text, edit the namespace's own file; this file only changes when a namespace is added.
import common from './common'
import shell from './shell'
import settings from './settings'
import home from './home'
import updates from './updates'
import achievements from './achievements'
import pokedex from './pokedex'
import species from './species'
import living from './living'
import homedex from './homedex'
import search from './search'
import entry from './entry'
import gamesave from './gamesave'
import journal from './journal'
import components from './components'
import domain from './domain'
import lib from './lib'
import data from './data'
import type { Message } from '../types'

/** Every namespace, in one place. The other languages mirror these files as i18n/<language>/<namespace>.ts. */
export const NAMESPACES = { common, shell, settings, home, updates, achievements, pokedex, species, living, homedex, search, entry, gamesave, journal, components, domain, lib, data }

export type Namespace = keyof typeof NAMESPACES
export type NamespaceKey<N extends Namespace> = keyof (typeof NAMESPACES)[N] & string

/** Every message key, "<namespace>.<key>". A key that does not exist is a compile error. */
export type MessageKey = { [N in Namespace]: `${N}.${NamespaceKey<N>}` }[Namespace]

/** What a file of another language holds: any part of the English namespace, under the same keys. */
export type Translation<N extends Namespace> = { readonly [K in NamespaceKey<N>]?: Message }
