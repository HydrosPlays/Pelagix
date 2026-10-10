import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { SpriteCacheInfo } from '@shared/api'
import { Button, Dialog, Icon, SegmentedControl, Select, Skeleton, Switch, TextField } from '@renderer/components/ui'
import { greeting } from '@renderer/features/home/home-model'
import { rich, useT } from '@renderer/i18n'
import { errorMessage, formatCount } from '@renderer/lib/format'
import { useSaveStore, useSettings } from '@renderer/store/save'
import { toast, useUiStore, type DexDensity } from '@renderer/store/ui'
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageId } from '@shared/languages'
import type { ThemeId } from '@shared/save-types'
import { ExternalLink, SavedMark, SettingRow, SettingsSection } from './parts'
import { formatBytes } from './settings-model'
import { TRAINER_NAME_MAX, useTrainerName } from './useTrainerName'

// ---------------------------------------------------------------- trainer

export function TrainerSection() {
  const trainer = useTrainerName()
  const name = trainer.stored
  const t = useT()
  return (
    <SettingsSection id="trainer" description={t('settings.trainer.description')}>
      <div className="settings-trainer">
        <TextField
          label={t('settings.trainer.name.label')}
          placeholder={t('settings.trainer.name.placeholder')}
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
            <span>{rich('settings.trainer.greets', { b: (c) => <b>{c}</b> }, { greeting: greeting(name) })}</span>
          </li>
          <li>
            <Icon name="edit" size={15} />
            <span>{name === '' ? t('settings.trainer.otEmpty') : rich('settings.trainer.otNamed', { b: (c) => <b>{c}</b> }, { name })}</span>
          </li>
        </ul>
      </div>
    </SettingsSection>
  )
}

// ---------------------------------------------------------------- appearance

/** Each language under its own name, in the order of the games' language menu. Not translated. */
const LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({ value: language.id, label: language.autonym }))

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
  const t = useT()
  const themeOptions = [
    { value: 'dark', label: t('settings.theme.dark'), icon: 'moon' },
    { value: 'light', label: t('settings.theme.light'), icon: 'sun' }
  ] as const
  const densityOptions = [
    { value: 'comfortable', label: t('settings.density.comfortable') },
    { value: 'compact', label: t('settings.density.compact') }
  ] as const

  return (
    <SettingsSection id="appearance" description={t('settings.appearance.description')}>
      <div className="settings-list">
        <SettingRow label={t('settings.theme.label')} description={t('settings.theme.description')}>
          <SegmentedControl<ThemeId> label={t('settings.theme.label')} options={themeOptions} value={settings.theme} onChange={(theme) => setSettings({ theme })} />
        </SettingRow>
        <SettingRow label={t('settings.language.label')} description={t('settings.language.description')}>
          <Select<LanguageId>
            ariaLabel={t('settings.language.label')}
            options={LANGUAGE_OPTIONS}
            value={settings.language ?? DEFAULT_LANGUAGE}
            onChange={(language) => useSaveStore.getState().setLanguage(language)}
            icon="globe"
            maxHeight={420}
            wrapperClassName="settings-language"
          />
        </SettingRow>
        <Switch
          reverse
          className="settings-switch-row"
          checked={settings.reduceMotion}
          onChange={(reduceMotion) => setSettings({ reduceMotion })}
          label={t('settings.reduceMotion.label')}
          description={systemReduced ? t('settings.reduceMotion.system') : t('settings.reduceMotion.description')}
        />
        <SettingRow label={t('settings.density.label')} description={t('settings.density.description')}>
          <SegmentedControl<DexDensity> label={t('settings.density.label')} options={densityOptions} value={density} onChange={(next) => setDexView({ density: next })} />
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
  const t = useT()
  const spritesLink = { link: (c: ReactNode) => <ExternalLink href={SPRITES_REPOSITORY}>{c}</ExternalLink> }

  const load = useCallback(async (): Promise<void> => {
    if (!api) return
    try {
      setCache({ status: 'ready', info: await api.spriteCacheInfo() })
    } catch (err) {
      setCache({ status: 'error', message: errorMessage(err, t('settings.sprites.readFailed')) })
    }
  }, [api, t])

  useEffect(() => {
    void load()
  }, [load])

  if (!api) {
    return (
      <SettingsSection id="sprites" description={t('settings.sprites.browser.description')}>
        <p className="settings-text">{rich('settings.sprites.browser.text', spritesLink)}</p>
      </SettingsSection>
    )
  }

  const info = cache.status === 'ready' ? cache.info : null
  const empty = info !== null && info.files === 0

  const clear = async (): Promise<void> => {
    setClearing(true)
    try {
      await api.clearSpriteCache()
      toast({ kind: 'success', title: t('settings.sprites.cleared.title'), body: info ? t('settings.sprites.cleared.body', { count: info.files, size: formatBytes(info.bytes) }) : undefined, icon: 'image' })
      setConfirming(false)
      await load()
    } catch (err) {
      toast({ kind: 'error', title: t('settings.sprites.clearFailed'), body: errorMessage(err) })
    } finally {
      setClearing(false)
    }
  }

  return (
    <SettingsSection id="sprites" description={t('settings.sprites.description')}>
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
                <span className="u-eyebrow">{t('settings.sprites.onDisk')}</span>
              </div>
              <div className="settings-cache__figure">
                <span className="settings-cache__value">{formatCount(info.files)}</span>
                <span className="u-eyebrow">{t('settings.sprites.renders', { count: info.files })}</span>
              </div>
            </>
          )}
        </div>
        <div className="settings-cache__actions">
          <Button variant="ghost" icon="refresh" onClick={() => void load()}>
            {t('settings.sprites.refresh')}
          </Button>
          <Button icon="trash" disabled={info === null || empty} onClick={() => setConfirming(true)}>
            {t('settings.sprites.clear')}
          </Button>
        </div>
      </div>
      <p className="settings-footnote">{rich('settings.sprites.footnote', spritesLink)}</p>

      <Dialog
        open={confirming}
        onClose={() => !clearing && setConfirming(false)}
        size="sm"
        title={t('settings.sprites.confirm.title')}
        description={info ? t('settings.sprites.confirm.description', { count: info.files, size: formatBytes(info.bytes) }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={clearing} data-autofocus>
              {t('settings.sprites.confirm.keep')}
            </Button>
            <Button variant="danger" icon="trash" loading={clearing} onClick={() => void clear()}>
              {t('settings.sprites.clear')}
            </Button>
          </>
        }
      />
    </SettingsSection>
  )
}
