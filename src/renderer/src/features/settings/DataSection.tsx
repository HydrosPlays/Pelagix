import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { SaveFile } from '@shared/save-types'
import { Button, Checkbox, Dialog, Icon, TextField } from '@renderer/components/ui'
import { GameSaveDialog } from '@renderer/features/gamesave/GameSaveDialog'
import { failureText, gameSaveSource, type ImportSource } from '@renderer/features/gamesave/model'
import { shinyDexFailureText, shinyDexSource } from '@renderer/features/gamesave/shinydex'
import { rich, t, useT } from '@renderer/i18n'
import { shake } from '@renderer/lib/anim'
import { errorMessage, formatCount, formatDateTime } from '@renderer/lib/format'
import { exportSaveToFile, importSaveFromFile, type SaveParseReport } from '@renderer/lib/storage'
import { useSaveStore } from '@renderer/store/save'
import { toast } from '@renderer/store/ui'
import { Fact, SettingsSection, type AppInfoState } from './parts'
import { saveFilePath, summarizeImport } from './settings-model'

/** How long the "Undo" of a replaced or reset save stays on screen. */
const UNDO_MS = 15_000

/** Saves a copy of the current save and says where it went. Shared by the section and both dialogs. */
async function exportCurrentSave(): Promise<void> {
  try {
    const result = await exportSaveToFile(useSaveStore.getState().save)
    if (result.canceled) return
    if (window.api) toast({ kind: 'success', title: t('settings.export.done'), body: result.path, icon: 'download' })
    else toast({ kind: 'success', title: t('settings.export.downloaded'), body: result.path ? t('settings.export.downloadedBody', { file: result.path }) : undefined, icon: 'download' })
  } catch (err) {
    toast({ kind: 'error', title: t('settings.export.failed'), body: errorMessage(err) })
  }
}

/** Offers to put the previous save back after something replaced it. */
function undoToast(title: string, body: string, previous: SaveFile, onUndone: () => void): void {
  toast({
    kind: 'info',
    title,
    body,
    icon: 'database',
    durationMs: UNDO_MS,
    action: {
      label: t('settings.undo.action'),
      onSelect: () => {
        try {
          useSaveStore.getState().replaceSave(previous)
          onUndone()
          toast({ kind: 'success', title: t('settings.undo.done.title'), body: t('settings.undo.done.body', { count: previous.entries.length }), icon: 'undo' })
        } catch (err) {
          toast({ kind: 'error', title: t('settings.undo.failed'), body: errorMessage(err) })
        }
      }
    }
  })
}

// ---------------------------------------------------------------- import

const bold = { b: (children: ReactNode) => <b>{children}</b> }

interface ImportDialogProps {
  report: SaveParseReport | null
  onClose: () => void
  /** The save was swapped for another one (replace, or the undo of it). */
  onReplaced: () => void
}

function ImportDialog({ report, onClose, onReplaced }: ImportDialogProps) {
  const t = useT()
  const currentEntries = useSaveStore((s) => s.save.entries)
  const fresh = useMemo(() => (report ? { report, summary: summarizeImport(report, currentEntries), current: currentEntries.length } : null), [report, currentEntries])
  // Frozen while the dialog plays its exit, so its text neither blanks out nor changes under the fade.
  const last = useRef(fresh)
  if (fresh) last.current = fresh
  const shown = last.current?.report ?? null
  const summary = last.current?.summary ?? null
  const currentCount = last.current?.current ?? 0

  const merge = (): void => {
    if (!shown) return
    const store = useSaveStore.getState()
    const previous = store.save
    try {
      const { added, skipped } = store.mergeEntries(shown.save.entries)
      onClose()
      if (added === 0) {
        toast({ kind: 'info', title: t('settings.import.nothingNew.title'), body: t('settings.import.nothingNew.body') })
        return
      }
      undoToast(t('settings.import.added.title', { count: added }), skipped > 0 ? t('settings.import.added.skipped', { count: skipped }) : t('settings.import.added.untouched'), previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: t('settings.import.mergeFailed'), body: errorMessage(err) })
    }
  }

  const replace = (): void => {
    if (!shown) return
    const store = useSaveStore.getState()
    const previous = store.save
    try {
      store.replaceSave(shown.save)
      onClose()
      onReplaced()
      undoToast(t('settings.import.replaced.title'), t('settings.import.replaced.body', { count: shown.save.entries.length }), previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: t('settings.import.replaceFailed'), body: errorMessage(err) })
    }
  }

  return (
    <Dialog
      open={report !== null}
      onClose={onClose}
      size="lg"
      title={t('settings.import.title')}
      description={t('settings.import.description')}
      media={
        <span className="settings-dialog-icon">
          <Icon name="upload" size={22} />
        </span>
      }
      footer={
        <Button variant="ghost" onClick={onClose} data-autofocus>
          {t('common.cancel')}
        </Button>
      }
    >
      {summary && shown && (
        <div className="settings-import">
          <dl className="settings-facts">
            <Fact label={t('settings.data.entries')}>
              {formatCount(summary.entries)}
              {summary.shiny > 0 && <span className="settings-fact__extra">{t('settings.import.shiny', { count: summary.shiny })}</span>}
            </Fact>
            <Fact label={t('settings.import.lastSaved')}>{formatDateTime(summary.savedAt) || t('common.unknown')}</Fact>
            <Fact label={t('settings.import.trainer')}>{summary.trainerName === '' ? t('settings.import.trainerNotSet') : summary.trainerName}</Fact>
            <Fact label={t('settings.data.achievements')}>{formatCount(summary.achievements)}</Fact>
          </dl>

          {(summary.dropped > 0 || summary.repaired > 0 || summary.newer) && (
            <ul className="settings-import__warnings" role="status">
              {summary.newer && (
                <li>
                  <Icon name="warning" size={16} />
                  <span>{t('settings.import.warning.newer')}</span>
                </li>
              )}
              {summary.dropped > 0 && (
                <li>
                  <Icon name="warning" size={16} />
                  <span>{t('settings.import.warning.dropped', { count: summary.dropped })}</span>
                </li>
              )}
              {summary.repaired > 0 && (
                <li>
                  <Icon name="info" size={16} />
                  <span>{t('settings.import.warning.repaired', { count: summary.repaired })}</span>
                </li>
              )}
            </ul>
          )}

          <div className="settings-import__choices">
            <div className="settings-choice">
              <h3 className="settings-choice__title">
                <Icon name="plus" size={16} />
                {t('settings.import.merge.title')}
              </h3>
              <p className="settings-choice__text">
                {summary.fresh === 0
                  ? t('settings.import.merge.nothing')
                  : summary.known > 0
                    ? rich('settings.import.merge.textKnown', bold, { count: summary.fresh, known: t('settings.import.merge.known', { count: summary.known }) })
                    : rich('settings.import.merge.text', bold, { count: summary.fresh })}
              </p>
              <Button variant="primary" icon="plus" block disabled={summary.fresh === 0} onClick={merge}>
                {t('settings.import.merge.title')}
              </Button>
            </div>
            <div className="settings-choice settings-choice--danger">
              <h3 className="settings-choice__title">
                <Icon name="swap" size={16} />
                {t('settings.import.replace.title')}
              </h3>
              <p className="settings-choice__text">
                {rich('settings.import.replace.text', bold, { count: currentCount })}{' '}
                {currentCount > 0 && (
                  <button type="button" className="settings-inline-button" onClick={() => void exportCurrentSave()}>
                    {t('settings.import.replace.exportFirst')}
                  </button>
                )}
              </p>
              <Button variant="danger" icon="swap" block onClick={replace}>
                {t('settings.import.replace.title')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------- reset

const RESET_WORD = 'RESET'

function ResetDialog({ open, onClose, onReplaced }: { open: boolean; onClose: () => void; onReplaced: () => void }) {
  const entryCount = useSaveStore((s) => s.save.entries.length)
  const achievementCount = useSaveStore((s) => Object.keys(s.save.achievements).length)
  const [typed, setTyped] = useState('')
  const [keepSettings, setKeepSettings] = useState(true)
  const [nudged, setNudged] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)
  const armed = typed.trim() === RESET_WORD
  const t = useT()

  const close = (): void => {
    onClose()
    setTyped('')
    setNudged(false)
    setKeepSettings(true)
  }

  const reset = (): void => {
    if (!armed) {
      setNudged(true)
      shake(fieldRef.current)
      return
    }
    const store = useSaveStore.getState()
    const previous = store.save
    try {
      store.resetAll({ keepSettings })
      close()
      onReplaced()
      undoToast(t('settings.reset.done.title'), t(keepSettings ? 'settings.reset.done.bodyKept' : 'settings.reset.done.body', { count: previous.entries.length }), previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: t('settings.reset.failed'), body: errorMessage(err) })
    }
  }

  const achievements = t('settings.reset.achievements', { count: achievementCount })
  const description =
    achievementCount > 0
      ? entryCount === 0
        ? t('settings.reset.description.nothingAnd', { achievements })
        : t('settings.reset.description.entriesAnd', { count: entryCount, achievements })
      : entryCount === 0
        ? t('settings.reset.description.nothing')
        : t('settings.reset.description.entries', { count: entryCount })

  return (
    <Dialog
      open={open}
      onClose={close}
      size="md"
      title={t('settings.reset.title')}
      description={description}
      media={
        <span className="settings-dialog-icon settings-dialog-icon--danger">
          <Icon name="warning" size={22} />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" icon="trash" aria-disabled={!armed} className={armed ? undefined : 'settings-reset__confirm--waiting'} onClick={reset}>
            {t('settings.reset.confirm')}
          </Button>
        </>
      }
    >
      <form
        className="settings-reset"
        onSubmit={(event) => {
          event.preventDefault()
          reset()
        }}
      >
        <Checkbox checked={keepSettings} onChange={setKeepSettings} label={t('settings.reset.keep.label')} description={t('settings.reset.keep.description')} />
        <div ref={fieldRef}>
          <TextField
            label={rich('settings.reset.type', { word: () => <b className="settings-reset__word">{RESET_WORD}</b> })}
            value={typed}
            onChange={(text) => {
              setTyped(text)
              setNudged(false)
            }}
            autoCapitalize="characters"
            error={nudged && !armed ? t('settings.reset.typeError', { word: RESET_WORD }) : undefined}
            data-autofocus
          />
        </div>
        {entryCount > 0 && (
          <p className="settings-text">
            {t('settings.reset.wayBack')}{' '}
            <button type="button" className="settings-inline-button" onClick={() => void exportCurrentSave()}>
              {t('settings.reset.exportFirst')}
            </button>
          </p>
        )}
      </form>
    </Dialog>
  )
}

// ---------------------------------------------------------------- section

export interface DataSectionProps {
  app: AppInfoState
  /** The whole save was swapped (import, reset or their undo): sections holding a "before" start over. */
  onReplaced: () => void
}

export function DataSection({ app, onReplaced }: DataSectionProps) {
  const entryCount = useSaveStore((s) => s.save.entries.length)
  const achievementCount = useSaveStore((s) => Object.keys(s.save.achievements).length)
  const updatedAt = useSaveStore((s) => s.save.updatedAt)
  const createdAt = useSaveStore((s) => s.save.createdAt)
  const [busy, setBusy] = useState<'export' | 'import' | 'game' | 'shinydex' | null>(null)
  const [report, setReport] = useState<SaveParseReport | null>(null)
  const [gameSave, setGameSave] = useState<ImportSource | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const t = useT()

  const exportSave = async (): Promise<void> => {
    setBusy('export')
    await exportCurrentSave()
    setBusy(null)
  }

  const importSave = async (): Promise<void> => {
    setBusy('import')
    try {
      const picked = await importSaveFromFile()
      if (picked) setReport(picked)
    } catch (err) {
      toast({ kind: 'error', title: t('settings.data.importFailed'), body: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  /** Lets the user pick a save file of a Pokémon game and shows what is in it. The file is only read. */
  const importGameSave = async (): Promise<void> => {
    if (!window.api) return
    setBusy('game')
    try {
      const result = await window.api.readGameSave()
      if (result === null) return
      // The main process has checked the reader's answer; this only keeps a malformed one away from the preview.
      const contents = result.ok === true ? result.contents : null
      if (contents && Array.isArray(contents.pokemon) && typeof contents.fileName === 'string' && typeof contents.save?.trainer === 'string' && typeof contents.save.version?.name === 'string') setGameSave(gameSaveSource(contents))
      else toast({ kind: 'error', title: t('settings.data.importFailed'), body: failureText(result.ok === false ? result.reason : undefined) })
    } catch (err) {
      toast({ kind: 'error', title: t('settings.data.importFailed'), body: errorMessage(err, failureText(undefined)) })
    } finally {
      setBusy(null)
    }
  }

  /** Lets the user pick a ShinyDex export, or a History page saved from shinydex.com, and shows the shinies in it. The file is only read. */
  const importShinyDex = async (): Promise<void> => {
    if (!window.api) return
    setBusy('shinydex')
    try {
      const result = await window.api.readShinyDex()
      if (result === null) return
      const history = result.ok === true ? result.history : null
      if (history && Array.isArray(history.rows) && typeof history.fileName === 'string' && typeof history.dropped === 'number' && typeof history.unusable === 'number') setGameSave(shinyDexSource(history))
      else toast({ kind: 'error', title: t('settings.data.importFailed'), body: shinyDexFailureText(result.ok === false ? result.reason : undefined) })
    } catch (err) {
      toast({ kind: 'error', title: t('settings.data.importFailed'), body: errorMessage(err, shinyDexFailureText(undefined)) })
    } finally {
      setBusy(null)
    }
  }

  const gameSaveImported = (previous: SaveFile, added: number, fileName: string, completed: number): void => {
    if (added === 0 && completed > 0) {
      undoToast(t('settings.gameSave.completed.title', { count: completed }), t('settings.gameSave.completed.body', { count: completed, file: fileName }), previous, onReplaced)
      return
    }
    if (added === 0) {
      toast({ kind: 'info', title: t('settings.import.nothingNew.title'), body: t('settings.gameSave.nothingNew.body') })
      return
    }
    undoToast(
      t('settings.import.added.title', { count: added }),
      completed > 0 ? t('settings.gameSave.added.bodyCompleted', { count: completed, file: fileName }) : t('settings.gameSave.added.body', { file: fileName }),
      previous,
      onReplaced
    )
  }

  return (
    <SettingsSection id="data" description={t('settings.data.description')}>
      <dl className="settings-facts">
        <Fact label={t('settings.data.entries')}>{formatCount(entryCount)}</Fact>
        <Fact label={t('settings.data.achievements')}>{formatCount(achievementCount)}</Fact>
        <Fact label={t('settings.data.lastChange')}>{formatDateTime(updatedAt) || t('settings.data.never')}</Fact>
        <Fact label={t('settings.data.started')}>{formatDateTime(createdAt) || t('common.unknown')}</Fact>
      </dl>

      <div className="settings-where">
        <Icon name="database" size={18} />
        <div className="settings-where__text">
          <span className="settings-row__label">{t('settings.data.where.title')}</span>
          {app.desktop ? (
            app.info ? (
              <>
                <code className="settings-path u-selectable">{saveFilePath(app.info.userData)}</code>
                <span className="settings-row__desc">{t('settings.data.where.file')}</span>
              </>
            ) : (
              <span className="settings-row__desc">{app.error ?? t('settings.data.where.folder')}</span>
            )
          ) : (
            <span className="settings-row__desc">{t('settings.data.where.browser')}</span>
          )}
        </div>
      </div>

      <div className="settings-actions">
        <div className="settings-action">
          <div className="settings-row__text">
            <span className="settings-row__label">{t('settings.data.export.label')}</span>
            <span className="settings-row__desc">{t('settings.data.export.description')}</span>
          </div>
          <Button icon="download" loading={busy === 'export'} onClick={() => void exportSave()}>
            {t('settings.data.export.label')}
          </Button>
        </div>
        <div className="settings-action">
          <div className="settings-row__text">
            <span className="settings-row__label">{t('settings.data.import.label')}</span>
            <span className="settings-row__desc">{t('settings.data.import.description')}</span>
          </div>
          <Button icon="upload" loading={busy === 'import'} onClick={() => void importSave()}>
            {t('settings.data.import.label')}
          </Button>
        </div>
        {app.desktop && (
          <div className="settings-action">
            <div className="settings-row__text">
              <span className="settings-row__label">{t('settings.data.gameSave.label')}</span>
              <span className="settings-row__desc">{t('settings.data.gameSave.description')}</span>
            </div>
            <Button icon="gamepad" loading={busy === 'game'} disabled={busy !== null && busy !== 'game'} onClick={() => void importGameSave()}>
              {busy === 'game' ? t('settings.data.reading') : t('settings.data.gameSave.label')}
            </Button>
          </div>
        )}
        {app.desktop && (
          <div className="settings-action">
            <div className="settings-row__text">
              <span className="settings-row__label">{t('settings.data.shinyDex.label')}</span>
              <span className="settings-row__desc">{t('settings.data.shinyDex.description')}</span>
            </div>
            <Button icon="sparkle" loading={busy === 'shinydex'} disabled={busy !== null && busy !== 'shinydex'} onClick={() => void importShinyDex()}>
              {busy === 'shinydex' ? t('settings.data.reading') : t('settings.data.shinyDex.label')}
            </Button>
          </div>
        )}
      </div>

      <div className="settings-danger">
        <div className="settings-row__text">
          <span className="settings-danger__title">
            <Icon name="warning" size={16} />
            {t('settings.data.danger.title')}
          </span>
          <span className="settings-row__desc">{t('settings.data.danger.description')}</span>
        </div>
        <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>
          {t('settings.data.danger.reset')}
        </Button>
      </div>

      <ImportDialog report={report} onClose={() => setReport(null)} onReplaced={onReplaced} />
      <GameSaveDialog source={gameSave} onClose={() => setGameSave(null)} onImported={gameSaveImported} />
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onReplaced={onReplaced} />
    </SettingsSection>
  )
}
