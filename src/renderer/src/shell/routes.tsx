import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from '@renderer/components/ui'
import { t, type MessageKey } from '@renderer/i18n'
import AchievementsPage from '@renderer/features/achievements/AchievementsPage'
import HomePage from '@renderer/features/home/HomePage'
import HomeDexPage from '@renderer/features/homedex/HomeDexPage'
import JournalPage from '@renderer/features/journal/JournalPage'
import LivingDexPage from '@renderer/features/living/LivingDexPage'
import PokedexPage from '@renderer/features/pokedex/PokedexPage'
import SettingsPage from '@renderer/features/settings/SettingsPage'
import SpeciesPage from '@renderer/features/species/SpeciesPage'
import { paths } from './router'

export type RouteId = 'home' | 'dex' | 'species' | 'living' | 'homedex' | 'journal' | 'achievements' | 'settings' | 'kit'

export interface RouteDef {
  id: RouteId
  /** wouter pattern. */
  path: string
  /** In the active language: read it when it is shown, do not keep it. */
  readonly title: string
  component: ComponentType | LazyExoticComponent<ComponentType>
  /** Route shown as the parent crumb in the top bar. */
  parent?: RouteId
  /** Nav rail entry this route lights up. */
  nav: RouteId
}

// The component gallery only exists in development builds.
const KitPage = import.meta.env.DEV ? lazy(() => import('@renderer/features/kit/KitPage')) : null

const ROUTE_TITLES: Readonly<Record<RouteId, MessageKey>> = {
  home: 'shell.route.home',
  dex: 'shell.route.dex',
  species: 'shell.route.species',
  living: 'shell.route.living',
  homedex: 'shell.route.homedex',
  journal: 'shell.route.journal',
  achievements: 'shell.route.achievements',
  settings: 'shell.route.settings',
  kit: 'shell.route.kit'
}

/**
 * The name of a route in the active language. The tables below are built once, at module top
 * level, where no text may be resolved (it would stay English for good): so `title` and `label`
 * are getters that look the text up each time they are read.
 */
export function routeTitle(id: RouteId): string {
  return t(ROUTE_TITLES[id])
}

const route = (def: Omit<RouteDef, 'title'>): RouteDef => ({
  ...def,
  get title() {
    return routeTitle(def.id)
  }
})

export const ROUTES: readonly RouteDef[] = [
  route({ id: 'home', path: '/', component: HomePage, nav: 'home' }),
  route({ id: 'dex', path: '/dex', component: PokedexPage, nav: 'dex' }),
  route({ id: 'species', path: '/dex/:id', component: SpeciesPage, parent: 'dex', nav: 'dex' }),
  route({ id: 'living', path: '/living', component: LivingDexPage, nav: 'living' }),
  route({ id: 'homedex', path: '/home-dex', component: HomeDexPage, nav: 'homedex' }),
  route({ id: 'journal', path: '/journal', component: JournalPage, nav: 'journal' }),
  route({ id: 'achievements', path: '/achievements', component: AchievementsPage, nav: 'achievements' }),
  route({ id: 'settings', path: '/settings', component: SettingsPage, nav: 'settings' }),
  ...(KitPage ? [route({ id: 'kit', path: '/_kit', component: KitPage, nav: 'kit' })] : [])
]

export const ROUTE_BY_ID: ReadonlyMap<RouteId, RouteDef> = new Map(ROUTES.map((r) => [r.id, r]))

export interface NavItem {
  id: RouteId
  /** In the active language: read it when it is shown, do not keep it. */
  readonly label: string
  icon: IconName
  href: string
}

const navItem = (def: Omit<NavItem, 'label'>): NavItem => ({
  ...def,
  get label() {
    return routeTitle(def.id)
  }
})

export const NAV_ITEMS: readonly NavItem[] = [
  navItem({ id: 'home', icon: 'home', href: paths.home() }),
  navItem({ id: 'dex', icon: 'dex', href: paths.dex() }),
  navItem({ id: 'living', icon: 'grid', href: paths.living() }),
  navItem({ id: 'homedex', icon: 'box', href: paths.homeDex() }),
  navItem({ id: 'journal', icon: 'journal', href: paths.journal() }),
  navItem({ id: 'achievements', icon: 'trophy', href: paths.achievements() }),
  navItem({ id: 'settings', icon: 'settings', href: paths.settings() })
]

/** The route a path belongs to, or null for an unknown path. */
export function matchRoute(path: string): RouteDef | null {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return ROUTE_BY_ID.get('home') ?? null
  if (segments[0] === 'dex') return segments.length === 1 ? (ROUTE_BY_ID.get('dex') ?? null) : segments.length === 2 ? (ROUTE_BY_ID.get('species') ?? null) : null
  if (segments.length !== 1) return null
  return ROUTES.find((r) => r.path === `/${segments[0]}`) ?? null
}
