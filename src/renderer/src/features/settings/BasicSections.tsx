import { useCallback, useEffect, useState } from 'react'
import type { SpriteCacheInfo } from '@shared/api'
import { Button, Dialog, Icon, SegmentedControl, Skeleton, Switch, TextField } from '@renderer/components/ui'
import { greeting } from '@renderer/features/home/home-model'
import { errorMessage, formatCount, plural } from '@renderer/lib/format'
import { useSaveStore, useSettings } from '@renderer/store/save'
import { toast, useUiStore, type DexDensity } from '@renderer/store/ui'
import type { ThemeId } from '@shared/save-types'
import { ExternalLink, SavedMark, SettingRow, SettingsSection } from './parts'
import { formatBytes } from './settings-model'
import { TRAINER_NAME_MAX, useTrainerName } from './useTrainerName'

// ---------------------------------------------------------------- trainer

export function TrainerSection() {
  const trainer = useTrainerName()
  const name = trainer.stored
  return (
    <SettingsSection id="trainer" description="Who these Pokémon belong to.">
      <div className="settings-trainer">
        <TextField
          label="Trainer name"
          placeholder="Your name in the games"
          icon="user"
          value={trainer.value}
          onChange={trainer.onChange}
          maxLength={TRAINER_NAME_MAX}
          optional
          clearable
          wrapperClassName="settings-trainer__field"
          suffix={name !== '' ? <SavedMark /> : undefined}
        />
        <ul className="settings-trainer__uses">
          <li>
            <Icon name="home" size={15} />
            <span>
              Home greets you with <b>“{greeting(name)}”</b>
            </span>
          </li>
          <li>
            <Icon name="edit" size={15} />
            <span>{name === '' ? 'The Original Trainer of a new entry starts empty' : <>New entries start with <b>{name}</b> as the Original Trainer (OT), and you can change it for each catch</>}</span>
          </li>
        </ul>
      </div>
    </SettingsSection>
  )
}

// ---------------------------------------------------------------- appearance

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'light', label: 'Light', icon: 'sun' }
] as const

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
] as const

function useSystemReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const onChange = (): void => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function AppearanceSection() {
  const settings = useSettings()
  const setSettings = useSaveStore((s) => s.setSettings)
  const density = useUiStore((s) => s.dexView.density)
  const setDexView = useUiStore((s) => s.setDexView)
  const systemReduced = useSystemReducedMotion()

  return (
    <SettingsSection id="appearance" description="How Pelagix looks and moves.">
      <div className="settings-list">
        <SettingRow label="Theme" description="Dark is easy on the eyes at night. Light works better in a bright room.">
          <SegmentedControl<ThemeId> label="Theme" options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => setSettings({ theme })} />
        </SettingRow>
        <Switch
          reverse
          className="settings-switch-row"
          checked={settings.reduceMotion}
          onChange={(reduceMotion) => setSettings({ reduceMotion })}
          label="Reduce motion"
          description={systemReduced ? 'Your system already asks for reduced motion, so animations are off either way.' : 'Turns off animations and transitions. Pelagix also follows the reduced-motion setting of your system.'}
        />
        <SettingRow label="Pokédex density" description="How tightly the Pokédex grid is packed. Remembered on this device.">
          <SegmentedControl<DexDensity> label="Pokédex density" options={DENSITY_OPTIONS} value={density} onChange={(next) => setDexView({ density: next })} />
        </SettingRow>
      </div>
    </SettingsSection>
  )
}

// ---------------------------------------------------------------- sprite cache

const SPRITES_REPOSITORY = 'https://github.com/PokeAPI/sprites'

type CacheState = { status: 'loading' } | { status: 'ready'; info: SpriteCacheInfo } | { status: 'error'; message: string }

export function SpriteCacheSection() {
  const api = window.api
  const [cache, setCache] = useState<CacheState>({ status: 'loading' })
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (!api) return
    try {
      setCache({ status: 'ready', info: await api.spriteCacheInfo() })
    } catch (err) {
      setCache({ status: 'error', message: errorMessage(err, 'The cache could not be read.') })
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  if (!api) {
    return (
      <SettingsSection id="sprites" description="Where the Pokémon renders come from.">
        <p className="settings-text">
          In a browser, Pokémon HOME renders load straight from the <ExternalLink href={SPRITES_REPOSITORY}>PokeAPI sprites</ExternalLink> repository each time, so nothing is stored here and there is nothing to clear. The desktop app keeps a copy of every render it has shown, which makes them appear instantly and work offline.
        </p>
      </SettingsSection>
    )
  }

  const info = cache.status === 'ready' ? cache.info : null
  const empty = info !== null && info.files === 0

  const clear = async (): Promise<void> => {
    setClearing(true)
    try {
      await api.clearSpriteCache()
      toast({ kind: 'success', title: 'Sprite cache cleared', body: info ? `${plural(info.files, 'file')} removed, ${formatBytes(info.bytes)} freed.` : undefined, icon: 'image' })
      setConfirming(false)
      await load()
    } catch (err) {
      toast({ kind: 'error', title: 'The sprite cache could not be cleared', body: errorMessage(err) })
    } finally {
      setClearing(false)
    }
  }

  return (
    <SettingsSection id="sprites" description="Renders Pelagix has already downloaded, kept on this computer so they appear instantly and work offline.">
      <div className="settings-cache">
        <div className="settings-cache__figures" aria-live="polite">
          {cache.status === 'loading' && <Skeleton width={220} height={44} radius={10} />}
          {cache.status === 'error' && (
            <p className="settings-text settings-text--danger" role="alert">
              {cache.message}
            </p>
          )}
          {info !== null && (
            <>
              <div className="settings-cache__figure">
                <span className="settings-cache__value">{formatBytes(info.bytes)}</span>
                <span className="u-eyebrow">On disk</span>
              </div>
              <div className="settings-cache__figure">
                <span className="settings-cache__value">{formatCount(info.files)}</span>
                <span className="u-eyebrow">{info.files === 1 ? 'Render' : 'Renders'}</span>
              </div>
            </>
          )}
        </div>
        <div className="settings-cache__actions">
          <Button variant="ghost" icon="refresh" onClick={() => void load()}>
            Refresh
          </Button>
          <Button icon="trash" disabled={info === null || empty} onClick={() => setConfirming(true)}>
            Clear cache
          </Button>
        </div>
      </div>
      <p className="settings-footnote">
        Renders come from the <ExternalLink href={SPRITES_REPOSITORY}>PokeAPI sprites</ExternalLink> repository. Clearing the cache only frees space: they download again as you browse.
      </p>

      <Dialog
        open={confirming}
        onClose={() => !clearing && setConfirming(false)}
        size="sm"
        title="Clear the sprite cache?"
        description={info ? `${plural(info.files, 'render')} (${formatBytes(info.bytes)}) will be removed from this computer. They download again as you browse, so you need to be online for that.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={clearing} data-autofocus>
              Keep it
            </Button>
            <Button variant="danger" icon="trash" loading={clearing} onClick={() => void clear()}>
              Clear cache
            </Button>
          </>
        }
      />
    </SettingsSection>
  )
}
