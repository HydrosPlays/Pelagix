import { useEffect, useRef, type ReactNode } from 'react'
import { setToastMedalRenderer } from '@renderer/components/ui'
import { ACHIEVEMENT_BY_ID, evaluateFor, newlyDone, TIER_ORDER, type AchievementDef, type AchievementTier } from '@renderer/domain/achievements'
import { useDexStore, type Dex } from '@renderer/lib/data'
import { formatCount, listText } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useEntries, useRules, useSaveStore } from '@renderer/store/save'
import { toast, useUiStore, type Toast } from '@renderer/store/ui'
import { Medal } from './Medal'

/** More unlocks than this at once are announced as one summary instead of one toast each. */
const ANNOUNCE_LIMIT = 3
/** Quiet period after the entries change, so a burst of edits is evaluated once. */
const SETTLE_MS = 450
/** The first check waits for the app to finish arriving on screen. */
const FIRST_CHECK_MS = 900
/** Toast `icon` hint of the summary toast, followed by the tier of its medal. */
const SUMMARY_ICON = 'achievements-summary:'

const isTier = (value: string): value is AchievementTier => (TIER_ORDER as readonly string[]).includes(value)
const tierRank = (def: AchievementDef): number => TIER_ORDER.indexOf(def.tier)

/** Medal art for achievement toasts: the toast's `icon` is an achievement id (or the summary marker). */
function renderToastMedal(item: Toast): ReactNode {
  const hint = item.icon ?? ''
  const def = ACHIEVEMENT_BY_ID.get(hint)
  if (def) return <Medal tier={def.tier} glyph={def.glyph} accent={def.accent} size={48} />
  if (hint.startsWith(SUMMARY_ICON)) {
    const tier = hint.slice(SUMMARY_ICON.length)
    return <Medal tier={isTier(tier) ? tier : 'gold'} glyph="trophy" size={48} />
  }
  return null
}

function announce(ids: readonly string[]): void {
  const defs = ids.map((id) => ACHIEVEMENT_BY_ID.get(id)).filter((def): def is AchievementDef => def !== undefined)
  if (defs.length === 0) return

  if (defs.length <= ANNOUNCE_LIMIT) {
    // Lowest tier first: the best medal lands last, at the bottom of the stack where the eye rests.
    for (const def of [...defs].sort((a, b) => tierRank(a) - tierRank(b))) {
      toast({ kind: 'achievement', title: def.title, body: def.description, icon: def.id })
    }
    return
  }

  const best = [...defs].sort((a, b) => tierRank(b) - tierRank(a))
  const named = best.slice(0, 2).map((def) => def.title)
  const rest = defs.length - named.length
  toast({
    kind: 'achievement',
    title: `${formatCount(defs.length)} achievements unlocked`,
    body: `${listText([...named, `${formatCount(rest)} more`])}.`,
    icon: `${SUMMARY_ICON}${best[0]?.tier ?? 'gold'}`,
    durationMs: 12_000,
    action: { label: 'View', onSelect: () => navigate(paths.achievements()) }
  })
}

/**
 * Evaluates the save and records whatever is newly done. The save is the only memory: an id is
 * announced when `unlockAchievements` reports it as new, which happens once per save, so a reload
 * (everything already recorded) announces nothing.
 */
function check(dex: Dex): void {
  try {
    const store = useSaveStore.getState()
    if (store.status !== 'ready') return
    const { entries, settings, achievements } = store.save
    const fresh = newlyDone(evaluateFor(dex, entries, settings.rules).states, achievements)
    if (fresh.length > 0) announce(store.unlockAchievements(fresh))
  } catch (err) {
    // Achievements are a bonus: a failure here must never get in the way of logging catches.
    console.error('Achievements could not be checked.', err)
  }
}

/**
 * Watches the save and unlocks achievements as their conditions come true. Mounted once by the
 * app shell; renders nothing. Also supplies the medal artwork of achievement toasts.
 */
export default function AchievementWatcher() {
  const dex = useDexStore((s) => s.dex)
  const ready = useSaveStore((s) => s.status === 'ready')
  const entries = useEntries()
  const rules = useRules()
  const editorOpen = useUiStore((s) => s.entryEditor.open)
  const checkedOnce = useRef(false)

  useEffect(() => {
    setToastMedalRenderer(renderToastMedal)
    return () => setToastMedalRenderer(null)
  }, [])

  // Runs after hydration and again whenever the entries or the rules change, debounced. While the
  // entry editor is up the medals wait: they are announced once it has closed, after the catch
  // itself has had its moment, instead of landing on top of the form.
  useEffect(() => {
    if (!dex || !ready || editorOpen) return
    const timer = setTimeout(
      () => {
        checkedOnce.current = true
        check(dex)
      },
      checkedOnce.current ? SETTLE_MS : FIRST_CHECK_MS
    )
    return () => clearTimeout(timer)
  }, [dex, ready, entries, rules, editorOpen])

  return null
}
