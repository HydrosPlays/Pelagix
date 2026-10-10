import type { ReactNode } from 'react'

/** One titled block of the gallery; the chips at the top of the page jump to its id. */
export function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={`kit-${id}`} className="section kit-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {note && <span className="u-muted kit-note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** A labelled line of samples. */
export function Row({ label, children, wrap = true }: { label?: string; children: ReactNode; wrap?: boolean }) {
  return (
    <div className="kit-row">
      {label && <div className="u-eyebrow kit-row__label">{label}</div>}
      <div className="kit-row__items" style={{ flexWrap: wrap ? 'wrap' : 'nowrap' }}>
        {children}
      </div>
    </div>
  )
}
