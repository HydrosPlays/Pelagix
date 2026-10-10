import { DEFAULT_LANGUAGE, isLanguageId, languageTag, type LanguageId } from '@shared/languages'
import { loadLanguage, setActiveLanguage } from '@renderer/i18n'
import { loadTerms } from '@renderer/i18n/terms'

/** Remembered per device so the loading screen is already in the right language, before the save has loaded. */
export const LANGUAGE_STORAGE_KEY = 'pelagix.language'

/** Language used on the last run, for the first paint; null when none was chosen on this device yet. */
export function storedLanguage(): LanguageId | null {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguageId(stored) ? stored : null
  } catch {
    return null
  }
}

let wanted: LanguageId = DEFAULT_LANGUAGE

/**
 * Puts a language on screen: `<html lang>` (which the per-language font stacks key on), the
 * native file dialogs of the main process, then the text and the Pokémon terms, which are
 * loaded first so the switch happens in one step. The app calls this whenever
 * `settings.language` changes; features only need `setLanguage(language)` on the save store.
 */
export async function applyLanguage(language: LanguageId): Promise<void> {
  wanted = language
  document.documentElement.lang = languageTag(language)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Only a convenience for the next start.
  }
  void window.api?.setLanguage(language).catch(() => {})
  await Promise.all([loadLanguage(language), loadTerms(language).catch(() => {})])
  // A later call may have overtaken this one while it was loading.
  if (wanted === language) setActiveLanguage(language)
}
