import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from '@renderer/components/ui'
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
  title: string
  component: ComponentType | LazyExoticComponent<ComponentType>
  /** Route shown as the parent crumb in the top bar. */
  parent?: RouteId
  /** Nav rail entry this route lights up. */
  nav: RouteId
}

// The component gallery only exists in development builds.
const KitPage = import.meta.env.DEV ? lazy(() => import('@renderer/features/kit/KitPage')) : null

export const ROUTES: readonly RouteDef[] = [
  { id: 'home', path: '/', title: 'Home', component: HomePage, nav: 'home' },
  { id: 'dex', path: '/dex', title: 'Pokédex', component: PokedexPage, nav: 'dex' },
  { id: 'species', path: '/dex/:id', title: 'Pokémon', component: SpeciesPage, parent: 'dex', nav: 'dex' },
  { id: 'living', path: '/living', title: 'Living Dex', component: LivingDexPage, nav: 'living' },
  { id: 'homedex', path: '/home-dex', title: 'HOME Dex', component: HomeDexPage, nav: 'homedex' },
  { id: 'journal', path: '/journal', title: 'Journal', component: JournalPage, nav: 'journal' },
  { id: 'achievements', path: '/achievements', title: 'Achievements', component: AchievementsPage, nav: 'achievements' },
  { id: 'settings', path: '/settings', title: 'Settings', component: SettingsPage, nav: 'settings' },
  ...(KitPage ? [{ id: 'kit', path: '/_kit', title: 'Component kit', component: KitPage, nav: 'kit' } satisfies RouteDef] : [])
]

export const ROUTE_BY_ID: ReadonlyMap<RouteId, RouteDef> = new Map(ROUTES.map((r) => [r.id, r]))

export interface NavItem {
  id: RouteId
  label: string
  icon: IconName
  href: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: paths.home() },
  { id: 'dex', label: 'Pokédex', icon: 'dex', href: paths.dex() },
  { id: 'living', label: 'Living Dex', icon: 'grid', href: paths.living() },
  { id: 'homedex', label: 'HOME Dex', icon: 'box', href: paths.homeDex() },
  { id: 'journal', label: 'Journal', icon: 'journal', href: paths.journal() },
  { id: 'achievements', label: 'Achievements', icon: 'trophy', href: paths.achievements() },
  { id: 'settings', label: 'Settings', icon: 'settings', href: paths.settings() }
]

/** The route a path belongs to, or null for an unknown path. */
export function matchRoute(path: string): RouteDef | null {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return ROUTE_BY_ID.get('home') ?? null
  if (segments[0] === 'dex') return segments.length === 1 ? (ROUTE_BY_ID.get('dex') ?? null) : segments.length === 2 ? (ROUTE_BY_ID.get('species') ?? null) : null
  if (segments.length !== 1) return null
  return ROUTES.find((r) => r.path === `/${segments[0]}`) ?? null
}
