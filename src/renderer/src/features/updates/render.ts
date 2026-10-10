/**
 * Release-notes Markdown, AST -> React elements. Written with createElement (no JSX) so the
 * tests can run it in the node environment exactly as the app does.
 *
 * There is no dangerouslySetInnerHTML and no element whose tag name, attribute name or URL comes
 * from the document: tags are picked from the fixed switch below, text goes in as React text
 * children (React escapes it), and the only attribute fed from the document is `href`, which is
 * re-checked with safeHref at the moment it is rendered.
 */

import { createElement as h, type MouseEvent, type ReactNode } from 'react'
import { t } from '@renderer/i18n/runtime'
import { safeHref, type Align, type Block, type Inline, type MdDoc } from './markdown'

export interface RenderOptions {
  /**
   * Desktop app: `(href) => window.api.openExternal(href)`. When given, a click never navigates.
   * Browser fallback (no window.api): leave undefined; the link opens in a new tab.
   */
  onOpenLink?: (href: string) => void
  /** Added to heading levels so the notes sit under the headings around them. Default 2: "#" renders as h3. */
  headingOffset?: number
}

const ALIGN_CLASS: Record<Exclude<Align, null>, string> = { left: 'upd-md-left', center: 'upd-md-center', right: 'upd-md-right' }

export function renderMarkdown(doc: MdDoc, options: RenderOptions = {}): ReactNode {
  const offset = options.headingOffset ?? 2
  const onOpenLink = options.onOpenLink

  function link(href: string, key: number, className: string, children: ReactNode): ReactNode {
    const safe = safeHref(href)
    if (safe === null) return h('span', { key }, children)
    return h(
      'a',
      {
        key,
        className,
        href: safe,
        // The real destination is always visible, whatever the label says.
        title: safe,
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick: onOpenLink
          ? (event: MouseEvent) => {
              event.preventDefault()
              onOpenLink(safe)
            }
          : undefined
      },
      children
    )
  }

  function inlines(nodes: readonly Inline[]): ReactNode[] {
    return nodes.map((node, key) => {
      switch (node.t) {
        case 'text':
          return node.v
        case 'code':
          return h('code', { key, className: 'upd-md-code' }, node.v)
        case 'strong':
          return h('strong', { key }, inlines(node.c))
        case 'em':
          return h('em', { key }, inlines(node.c))
        case 'del':
          return h('del', { key }, inlines(node.c))
        case 'br':
          return h('br', { key })
        case 'link':
          return link(node.href, key, 'upd-md-link', inlines(node.c))
        case 'image':
          // Never an <img>: a remote image is a request to a third party the reader did not choose.
          return link(node.href, key, 'upd-md-link upd-md-image', node.alt === '' ? t('updates.notes.image') : node.alt)
      }
    })
  }

  function blocks(list: readonly Block[], tight: boolean): ReactNode[] {
    return list.map((block, key) => {
      switch (block.t) {
        case 'heading':
          return h(`h${Math.min(6, Math.max(1, block.level + offset))}`, { key, className: `upd-md-h upd-md-h${block.level}` }, inlines(block.c))
        case 'paragraph':
          // In a tight list the item text is not wrapped in <p>.
          return tight ? h('span', { key, className: 'upd-md-item-text' }, inlines(block.c)) : h('p', { key }, inlines(block.c))
        case 'code':
          return h('pre', { key, className: 'upd-md-pre' }, h('code', null, block.v))
        case 'rule':
          return h('hr', { key })
        case 'quote':
          return h('blockquote', { key, className: block.kind ? `upd-md-alert upd-md-alert-${block.kind}` : 'upd-md-quote' }, blocks(block.c, false))
        case 'list': {
          const items = block.items.map((item, i) =>
            h(
              'li',
              { key: i, className: item.checked === null ? undefined : 'upd-md-task' },
              item.checked === null ? null : h('input', { type: 'checkbox', checked: item.checked, disabled: true, readOnly: true, 'aria-label': item.checked ? t('updates.notes.task.done') : t('updates.notes.task.notDone') }),
              blocks(item.c, block.tight)
            )
          )
          return block.ordered ? h('ol', { key, start: block.start === 1 ? undefined : block.start }, items) : h('ul', { key }, items)
        }
        case 'table': {
          const cell = (tag: 'th' | 'td', c: readonly Inline[], i: number): ReactNode => {
            const align = block.align[i] ?? null
            return h(tag, { key: i, className: align === null ? undefined : ALIGN_CLASS[align], scope: tag === 'th' ? 'col' : undefined }, inlines(c))
          }
          return h(
            'div',
            { key, className: 'upd-md-table-wrap' },
            h(
              'table',
              null,
              h('thead', null, h('tr', null, block.head.map((c, i) => cell('th', c, i)))),
              h(
                'tbody',
                null,
                block.rows.map((row, r) => h('tr', { key: r }, row.map((c, i) => cell('td', c, i))))
              )
            )
          )
        }
      }
    })
  }

  // The text can be selected and copied, unlike the rest of the app's chrome.
  return h('div', { className: 'upd-md u-selectable' }, blocks(doc.blocks, false))
}
