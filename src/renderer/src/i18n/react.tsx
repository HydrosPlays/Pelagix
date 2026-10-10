import { Fragment, useSyncExternalStore, type ReactNode } from 'react'
import type { LanguageId } from '@shared/languages'
import { activeLanguage, fillPlaceholders, languageVersion, messageText, subscribeLanguage, t, type MessageKey, type MessageParams } from './runtime'

/**
 * `t` for a component: the component renders again when the language changes or more of its
 * text arrives. `const t = useT()`, then `t('shell.nav.home')`.
 */
export function useT(): typeof t {
  useSyncExternalStore(subscribeLanguage, languageVersion, languageVersion)
  return t
}

/** The active language, as a hook. */
export function useLanguage(): LanguageId {
  useSyncExternalStore(subscribeLanguage, languageVersion, languageVersion)
  return activeLanguage()
}

/** What stands for a `<name>…</name>` (or `<name/>`) in a message: gets the translated inside, returns the element. */
export type RichTags = Readonly<Record<string, (children: ReactNode) => ReactNode>>

const TAG = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\/>/g

function renderRich(text: string, tags: RichTags, fill: (text: string) => string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(TAG)) {
    if (match.index > last) out.push(fill(text.slice(last, match.index)))
    const name = match[1] ?? match[3]!
    const inner = match[1] !== undefined ? renderRich(match[2]!, tags, fill) : null
    const render = tags[name]
    out.push(<Fragment key={index++}>{render ? render(inner) : inner}</Fragment>)
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(fill(text.slice(last)))
  return out
}

/**
 * A message with markup inside the sentence, so the sentence stays one message and a translator
 * can move the marked words around:
 *
 *   'boot.dataHint': 'Run <code>npm run data</code> to build the datasets, then try again.'
 *   rich('shell.boot.dataHint', { code: (c) => <code>{c}</code> })
 *
 * `<name/>` stands for an element without text of its own (`<kbd/>`). Placeholders are filled as
 * in `t()`, after the tags are found, so a value is never read as markup.
 */
export function rich(key: MessageKey, tags: RichTags, params?: MessageParams): ReactNode {
  const language = activeLanguage()
  const count = params?.['count']
  const text = messageText(language, key, typeof count === 'number' ? count : undefined)
  return renderRich(text, tags, (part) => fillPlaceholders(part, params, language))
}
