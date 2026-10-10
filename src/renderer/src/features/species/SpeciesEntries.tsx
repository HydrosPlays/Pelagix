import { useMemo, useState } from 'react'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { CatchEntry } from '@shared/save-types'
import { EntryCard } from '@renderer/components/pokemon'
import { Badge, Button, Icon } from '@renderer/components/ui'
import { sortEntries } from '@renderer/domain/entries'
import { useT } from '@renderer/i18n'
import { formFullName, speciesName } from '@renderer/i18n/terms'
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
  const t = useT()
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
            {t('species.entries.title')}
            {entries.length > 0 && <Badge count={entries.length} max={999} tone="neutral" label={t('species.entries.logged', { count: entries.length })} />}
          </h2>
          {entries.length > 0 && otherForms > 0 && (
            <p className="sp-entries__summary">{t('species.entries.summary', { ofForm, name: formFullName(species, form), others: otherForms })}</p>
          )}
        </div>
        {entries.length > 0 && (
          <Button variant="catch" icon="plus" onClick={onLogAnother}>
            {t('species.entries.logAnother')}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="sp-entries__empty">
          <span className="sp-entries__ball" aria-hidden="true">
            <Icon name="pokeball" size={24} />
          </span>
          <div className="sp-entries__emptytext">
            <h3>{t('species.entries.empty.title', { name: speciesName(species) })}</h3>
            <p>{t('species.entries.empty.description')}</p>
          </div>
          <div className="sp-entries__emptyactions">
            <Button variant="primary" iconEnd="arrow-down" onClick={onFindIt}>
              {t('species.entries.empty.find')}
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
                {all ? t('species.showFewer') : t('species.entries.showAll', { count: ordered.length })}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
