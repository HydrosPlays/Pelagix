import { useEffect, useMemo, useRef, useState } from 'react'
import type { DexRules } from '@shared/save-types'
import { Button, Chip, NumberTicker, SegmentedControl, Switch, cx, type SegmentOption } from '@renderer/components/ui'
import { RULE_INFO, RULE_PRESETS, useCollection, type RulePresetId } from '@renderer/domain/slots'
import { pulse } from '@renderer/lib/anim'
import { useDex } from '@renderer/lib/data'
import { useT, type MessageKey } from '@renderer/i18n'
import { percent } from '@renderer/lib/format'
import { useRules, useSaveStore } from '@renderer/store/save'
import { SettingsSection } from './parts'
import { countSlots, presetChoice, RULE_GROUPS, ruleImpact, sameRules, signed, type PresetChoice, type RuleKey } from './settings-model'

const PRESET_IDS: readonly RulePresetId[] = ['species', 'forms', 'completionist']
/** Wording for the picker where the preset's own label ("Species") would be too terse next to "Forms". */
const PRESET_LABELS: Readonly<Partial<Record<RulePresetId, MessageKey>>> = { species: 'settings.rules.preset.speciesOnly' }

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
  const t = useT()

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
    ...PRESET_IDS.map((id) => {
      const own = PRESET_LABELS[id]
      return { value: id, label: own ? t(own) : RULE_PRESETS[id].label }
    }),
    // "Custom" describes a state rather than something to pick: it lights up when the switches match no preset.
    { value: 'custom', label: t('settings.rules.preset.custom'), disabled: choice !== 'custom' }
  ]

  const toggle = (key: RuleKey, on: boolean): void => setRules({ [key]: on })

  return (
    <SettingsSection id="rules" description={t('settings.rules.description')}>
      <div className="settings-impact" aria-live="polite" aria-atomic="true">
        <div className="settings-impact__total">
          <span className="settings-impact__number">
            <NumberTicker value={totals.slots} animateOnMount={false} />
          </span>
          <span className="settings-impact__unit">{t('settings.rules.total', { count: totals.slots })}</span>
          {changed && (
            <span ref={deltaRef} className="settings-impact__delta">
              <Chip tone={delta > 0 ? 'accent' : delta < 0 ? 'warning' : 'neutral'} variant="soft" title={t('settings.rules.before', { count: before })}>
                {delta === 0 ? t('settings.rules.sameSize') : signed(delta)}
              </Chip>
            </span>
          )}
        </div>
        <div className="settings-impact__detail">
          <span>{t('settings.rules.caught', { caught: totals.caught, percent: percent(totals.caught, totals.slots) })}</span>
          {changed && <span>{t('settings.rules.before', { count: before })}</span>}
        </div>
        {changed && (
          <Button size="sm" variant="ghost" icon="undo" className="settings-impact__undo" onClick={() => setRules(baseline)}>
            {t('settings.rules.undo')}
          </Button>
        )}
      </div>

      <div className="settings-presets">
        <SegmentedControl label={t('settings.rules.preset.label')} fill options={options} value={choice} onChange={(value) => value !== 'custom' && setRules(RULE_PRESETS[value].rules)} />
        <p className="settings-presets__desc">{choice === 'custom' ? t('settings.rules.preset.customDescription') : RULE_PRESETS[choice].description}</p>
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
                  <span className="settings-rule__impact" title={on ? t('settings.rules.impact.removes', { count: slots }) : t('settings.rules.impact.adds', { count: slots })}>
                    {slots === 0 ? t('settings.rules.impact.none') : on ? t('settings.rules.impact.slots', { count: slots }) : signed(slots)}
                  </span>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      <p className="settings-footnote">{t('settings.rules.footnote')}</p>
    </SettingsSection>
  )
}
