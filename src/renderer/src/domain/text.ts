/** Top-level tables of interface text that follow the language. */

import { t, type MessageKey } from '@renderer/i18n/runtime'

/**
 * A table of texts by id, for a top-level constant: each value is read from the text table when
 * it is used, never when the module loads. `messageTable({ a: 'pokedex.sort.a' }).a` is `t('pokedex.sort.a')`.
 */
export function messageTable<K extends string | number>(keys: Readonly<Record<K, MessageKey>>): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>
  for (const id of Object.keys(keys) as Array<K & string>) {
    Object.defineProperty(out, id, { enumerable: true, get: () => t(keys[id]) })
  }
  return out
}
