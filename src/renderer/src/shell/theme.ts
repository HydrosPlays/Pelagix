import type { ThemeId } from '@shared/save-types'

/** Remembered per device so the right theme is painted before the save has loaded. */
export const THEME_STORAGE_KEY = 'pelagix.theme'

/** Theme used on the last run, for the first paint. */
export function storedTheme(): ThemeId {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Puts a theme on screen: `data-theme` on <html> (which every colour token keys on) and, in
 * Electron, the native title-bar buttons and window background. The app calls this whenever
 * `settings.theme` changes; features only need `setSettings({ theme })`.
 */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Only a convenience for the next start.
  }
  void window.api?.setTheme(theme).catch(() => {})
}
