import { useMemo, useState } from 'react'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { CatchEntry } from '@shared/save-types'
import { EntryCard } from '@renderer/components/pokemon'
import { Badge, Button, Icon } from '@renderer/components/ui'
import { sortEntries } from '@renderer/domain/entries'
import { editEntry } from '@renderer/lib/entry-actions'

/** Cards shown before "Show all": two rows on a wide window. */
const INITIAL = 6

export interface SpeciesEntriesProps {
  species: SpeciesSummary
  form: FormSummary
  entries: readonly CatchEntry[]
  /** The entry that was just logged, to ring in gold. */
  highlightId: string | null
  onLogAnother: () => void
  onFindIt: () => void
}

/** The user's logged catches of this Pokémon, the selected form first. */
export function SpeciesEntries({ species, form, entries, highlightId, onLogAnother, onFindIt }: SpeciesEntriesProps) {
  const [all, setAll] = useState(false)
  const ordered = useMemo(() => {
    const newest = sortEntries(entries, 'newest')
    return [...newest.filter((e) => e.form === form.f), ...newest.filter((e) => e.form !== form.f)]
  }, [entries, form.f])
  // The entry being celebrated is always on screen, even beyond the first rows.
  const cut = all ? ordered.length : Math.max(INITIAL, highlightId !== null ? ordered.findIndex((e) => e.id === highlightId) + 1 : 0)
  const shown = ordered.slice(0, cut)
  const ofForm = entries.filter((e) => e.form === form.f).length
  const otherForms = entries.length - ofForm

  return (
    <section className="section sp-entries" aria-labelledby="sp-entries-title">
      <div className="section-header">
        <div>
          <h2 id="sp-entries-title" className="section-title">
            Your entries
            {entries.length > 0 && <Badge count={entries.length} max={999} tone="neutral" label={`${entries.length} logged`} />}
          </h2>
          {entries.length > 0 && otherForms > 0 && (
            <p className="sp-entries__summary">
              {ofForm} of {form.full}, {otherForms} of other forms
            </p>
          )}
        </div>
        {entries.length > 0 && (
          <Button variant="catch" icon="plus" onClick={onLogAnother}>
            Log another
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="sp-entries__empty">
          <span className="sp-entries__ball" aria-hidden="true">
            <Icon name="pokeball" size={24} />
          </span>
          <div className="sp-entries__emptytext">
            <h3>No {species.name} in your Living Dex yet</h3>
            <p>Pick the game you caught it in below, find the way you got it and press Log.</p>
          </div>
          <div className="sp-entries__emptyactions">
            <Button variant="primary" iconEnd="arrow-down" onClick={onFindIt}>
              Where to find it
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="sp-entries__grid">
            {shown.map((entry) => (
              <EntryCard key={entry.id} entry={entry} variant="card" showSpecies={false} highlight={entry.id === highlightId} onOpen={(e) => editEntry(e.id)} />
            ))}
          </div>
          {ordered.length > INITIAL && (
            <div className="sp-entries__more">
              <Button size="sm" variant="ghost" icon={all ? 'chevron-up' : 'chevron-down'} aria-expanded={all} onClick={() => setAll(!all)}>
                {all ? 'Show fewer' : `Show all ${ordered.length} entries`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
