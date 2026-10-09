import { useEffect, useMemo, useRef, useState } from 'react'
import type { DexRules } from '@shared/save-types'
import { Button, Chip, NumberTicker, SegmentedControl, Switch, cx, type SegmentOption } from '@renderer/components/ui'
import { RULE_INFO, RULE_PRESETS, useCollection, type RulePresetId } from '@renderer/domain/slots'
import { pulse } from '@renderer/lib/anim'
import { useDex } from '@renderer/lib/data'
import { formatCount, percent, pluralWord } from '@renderer/lib/format'
import { useRules, useSaveStore } from '@renderer/store/save'
import { SettingsSection } from './parts'
import { countSlots, presetChoice, RULE_GROUPS, ruleImpact, sameRules, signed, type PresetChoice, type RuleKey } from './settings-model'

const PRESET_IDS: readonly RulePresetId[] = ['species', 'forms', 'completionist']
/** Wording for the picker where the preset's own label ("Species") would be too terse next to "Forms". */
const PRESET_LABELS: Readonly<Partial<Record<RulePresetId, string>>> = { species: 'Species only' }

/**
 * Which forms get their own slot. Every change is applied (and saved) at once, and the header
 * shows what it does to the size of the Living Dex compared with the rules the page opened with.
 */
export function RulesSection() {
  const dex = useDex()
  const rules = useRules()
  const { totals } = useCollection()
  const setRules = useSaveStore((s) => s.setRules)
  // The rules as they were when the user arrived: what "before" means until they leave the page.
  const [baseline] = useState<DexRules>(rules)
  const deltaRef = useRef<HTMLSpanElement>(null)

  const species = dex.speciesList
  const before = useMemo(() => countSlots(species, baseline), [species, baseline])
  const impact = useMemo(() => ruleImpact(species, rules), [species, rules])
  const delta = totals.slots - before
  const changed = !sameRules(rules, baseline)
  const choice = presetChoice(rules)

  useEffect(() => {
    if (delta !== 0) pulse(deltaRef.current)
  }, [delta])

  const options: Array<SegmentOption<PresetChoice>> = [
    ...PRESET_IDS.map((id) => ({ value: id, label: PRESET_LABELS[id] ?? RULE_PRESETS[id].label })),
    // "Custom" describes a state rather than something to pick: it lights up when the switches match no preset.
    { value: 'custom', label: 'Custom', disabled: choice !== 'custom' }
  ]

  const toggle = (key: RuleKey, on: boolean): void => setRules({ [key]: on })

  return (
    <SettingsSection id="rules" description="Decide which forms get a slot of their own. Base forms always do.">
      <div className="settings-impact" aria-live="polite" aria-atomic="true">
        <div className="settings-impact__total">
          <span className="settings-impact__number">
            <NumberTicker value={totals.slots} animateOnMount={false} />
          </span>
          <span className="settings-impact__unit">{pluralWord(totals.slots, 'slot')} in your Living Dex</span>
          {changed && (
            <span ref={deltaRef} className="settings-impact__delta">
              <Chip tone={delta > 0 ? 'accent' : delta < 0 ? 'warning' : 'neutral'} variant="soft" title={`${formatCount(before)} before your changes`}>
                {delta === 0 ? 'same size' : signed(delta)}
              </Chip>
            </span>
          )}
        </div>
        <div className="settings-impact__detail">
          <span>
            {formatCount(totals.caught)} caught ({percent(totals.caught, totals.slots)})
          </span>
          {changed && <span>{formatCount(before)} before your changes</span>}
        </div>
        {changed && (
          <Button size="sm" variant="ghost" icon="undo" className="settings-impact__undo" onClick={() => setRules(baseline)}>
            Undo changes
          </Button>
        )}
      </div>

      <div className="settings-presets">
        <SegmentedControl label="Rule preset" fill options={options} value={choice} onChange={(value) => value !== 'custom' && setRules(RULE_PRESETS[value].rules)} />
        <p className="settings-presets__desc">{choice === 'custom' ? 'Your own mix of the switches below.' : RULE_PRESETS[choice].description}</p>
      </div>

      {RULE_GROUPS.map((group) => (
        <fieldset key={group.id} className="settings-rules">
          <legend className="settings-rules__legend">
            <span className="settings-rules__title">{group.title}</span>
            <span className="settings-rules__desc">{group.description}</span>
          </legend>
          <ul className="settings-rules__list">
            {group.keys.map((key) => {
              const on = rules[key]
              const slots = impact[key]
              return (
                <li key={key} className={cx('settings-rule', on && 'is-on')}>
                  <Switch checked={on} onChange={(value) => toggle(key, value)} label={RULE_INFO[key].label} description={RULE_INFO[key].description} className="settings-rule__switch" />
                  <span className="settings-rule__impact" title={on ? `Switching this off removes ${formatCount(slots)} ${pluralWord(slots, 'slot')}` : `Switching this on adds ${formatCount(slots)} ${pluralWord(slots, 'slot')}`}>
                    {slots === 0 ? 'no change' : on ? `${formatCount(slots)} ${pluralWord(slots, 'slot')}` : signed(slots)}
                  </span>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      <p className="settings-footnote">Changing the rules never deletes an entry. A catch whose form loses its slot simply counts toward that Pokémon's base slot, and gets its own slot back when you switch the rule on again.</p>
    </SettingsSection>
  )
}
