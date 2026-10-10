/** Names of the generations in the active language. */

import { t, type MessageKey } from '@renderer/i18n/runtime'

/** "Generation I" ... "Generation IX" (messages `domain.generation.1` to `.9`); a later one reads "Generation 10". */
export function generationName(gen: number): string {
  const key = `domain.generation.${gen}`
  const text = t(key as MessageKey)
  return text === key ? t('domain.generation.other', { number: String(gen) }) : text
}
