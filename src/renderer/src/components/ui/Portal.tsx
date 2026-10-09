import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renders children at the end of <body>, outside the app root (so a modal can make the root inert). */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
