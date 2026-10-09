import { useMemo } from 'react'
import type { FormCategory, FormSummary, RegionalVariant, SpeciesSummary } from '@shared/dex-types'
import { FormCategoryTag, Sprite } from '@renderer/components/pokemon'
import { cx, Icon, Panel } from '@renderer/components/ui'
import { plural } from '@renderer/lib/format'
import { rovingRadioKeyDown } from './hooks'

const CATEGORY_ORDER: readonly FormCategory[] = ['base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle', 'hidden']

interface FormGroup {
  key: string
  cat: FormCategory
  region: RegionalVariant | undefined
  forms: FormSummary[]
}

function groupForms(forms: readonly FormSummary[]): FormGroup[] {
  const groups = new Map<string, FormGroup>()
  for (const form of forms) {
    const key = `${form.cat}:${form.region ?? ''}`
    const group = groups.get(key)
    if (group) group.forms.push(form)
    else groups.set(key, { key, cat: form.cat, region: form.region, forms: [form] })
  }
  return [...groups.values()].sort((a, b) => CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat))
}

export interface FormPickerProps {
  species: SpeciesSummary
  /** The forms on offer (hidden ones already left out). */
  forms: readonly FormSummary[]
  selected: FormSummary
  /** Logged entries per form index. */
  counts: ReadonlyMap<number, number>
  shiny: boolean
  onSelect: (form: FormSummary) => void
}

/** Every form of the species as a tile, grouped by what kind of form it is. */
export function FormPicker({ species, forms, selected, counts, shiny, onSelect }: FormPickerProps) {
  const groups = useMemo(() => groupForms(forms), [forms])
  const dense = forms.length > 6
  const caught = forms.filter((f) => (counts.get(f.f) ?? 0) > 0).length
  const spriteSize = dense ? 48 : 64

  return (
    <Panel as="section" className="sp-forms" aria-labelledby="sp-forms-title">
      <header className="sp-forms__head">
        <h2 id="sp-forms-title" className="section-title">
          Forms
        </h2>
        <span className="sp-forms__summary">
          {plural(forms.length, 'form')}
          {caught > 0 ? ` · ${caught} logged` : ''}
        </span>
      </header>
      <div className={cx('sp-forms__groups', dense && 'sp-forms__groups--dense')} role="radiogroup" aria-label={`Forms of ${species.name}`} onKeyDown={rovingRadioKeyDown}>
        {groups.map((group) => (
          <div key={group.key} className="sp-forms__group" role="presentation">
            <div className="sp-forms__label">
              <FormCategoryTag cat={group.cat} region={group.region} />
              {group.forms.length > 1 && <span className="sp-forms__count">{group.forms.length}</span>}
            </div>
            <div className="sp-forms__tiles" role="presentation">
              {group.forms.map((form) => {
                const isSelected = form.f === selected.f
                const count = counts.get(form.f) ?? 0
                const label = form.name !== '' ? form.name : species.name
                return (
                  <button
                    key={form.f}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${form.full}${count > 0 ? `, ${plural(count, 'entry', 'entries')} logged` : ''}`}
                    title={form.full}
                    tabIndex={isSelected ? 0 : -1}
                    className={cx('sp-form', isSelected && 'is-selected', count > 0 && 'is-caught')}
                    onClick={() => !isSelected && onSelect(form)}
                  >
                    {count > 0 && (
                      <span className="sp-form__caught" aria-hidden="true">
                        <Icon name="check" size={11} strokeWidth={3} />
                        {count > 1 && <span>{count}</span>}
                      </span>
                    )}
                    <Sprite species={species} form={form} shiny={shiny} size={spriteSize} />
                    <span className="sp-form__name">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
