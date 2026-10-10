import { useMemo, useRef, useState } from 'react'
import type { GameSaveContents } from '@shared/game-save-types'
import type { SaveFile } from '@shared/save-types'
import { Button, Checkbox, Dialog, Icon, TextField } from '@renderer/components/ui'
import { GameSaveDialog } from '@renderer/features/gamesave/GameSaveDialog'
import { failureText } from '@renderer/features/gamesave/model'
import { shake } from '@renderer/lib/anim'
import { errorMessage, formatCount, formatDateTime, plural } from '@renderer/lib/format'
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
    if (window.api) toast({ kind: 'success', title: 'Save exported', body: result.path, icon: 'download' })
    else toast({ kind: 'success', title: 'Save downloaded', body: result.path ? `Look for ${result.path} in your downloads.` : undefined, icon: 'download' })
  } catch (err) {
    toast({ kind: 'error', title: 'The save could not be exported', body: errorMessage(err) })
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
      label: 'Undo',
      onSelect: () => {
        try {
          useSaveStore.getState().replaceSave(previous)
          onUndone()
          toast({ kind: 'success', title: 'Your previous save is back', body: plural(previous.entries.length, 'entry', 'entries'), icon: 'undo' })
        } catch (err) {
          toast({ kind: 'error', title: 'The previous save could not be restored', body: errorMessage(err) })
        }
      }
    }
  })
}

// ---------------------------------------------------------------- import

interface ImportDialogProps {
  report: SaveParseReport | null
  onClose: () => void
  /** The save was swapped for another one (replace, or the undo of it). */
  onReplaced: () => void
}

function ImportDialog({ report, onClose, onReplaced }: ImportDialogProps) {
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
        toast({ kind: 'info', title: 'Nothing new to add', body: 'Every entry in that file is already in your save.' })
        return
      }
      undoToast(`${plural(added, 'entry', 'entries')} added`, skipped > 0 ? `${plural(skipped, 'entry was', 'entries were')} already in your save.` : 'Your settings and achievements stayed as they were.', previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: 'The entries could not be merged', body: errorMessage(err) })
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
      undoToast('Save replaced', `${plural(shown.save.entries.length, 'entry', 'entries')} loaded from the file.`, previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: 'The save could not be replaced', body: errorMessage(err) })
    }
  }

  return (
    <Dialog
      open={report !== null}
      onClose={onClose}
      size="lg"
      title="Import this save?"
      description="Nothing has changed yet. Check the file, then choose what to do with it."
      media={
        <span className="settings-dialog-icon">
          <Icon name="upload" size={22} />
        </span>
      }
      footer={
        <Button variant="ghost" onClick={onClose} data-autofocus>
          Cancel
        </Button>
      }
    >
      {summary && shown && (
        <div className="settings-import">
          <dl className="settings-facts">
            <Fact label="Entries">
              {formatCount(summary.entries)}
              {summary.shiny > 0 && <span className="settings-fact__extra">{formatCount(summary.shiny)} shiny</span>}
            </Fact>
            <Fact label="Last saved">{formatDateTime(summary.savedAt) || 'Unknown'}</Fact>
            <Fact label="Trainer">{summary.trainerName === '' ? 'Not set' : summary.trainerName}</Fact>
            <Fact label="Achievements">{formatCount(summary.achievements)}</Fact>
          </dl>

          {(summary.dropped > 0 || summary.repaired > 0 || summary.newer) && (
            <ul className="settings-import__warnings" role="status">
              {summary.newer && (
                <li>
                  <Icon name="warning" size={16} />
                  <span>This file was written by a newer version of Pelagix. Anything this version does not understand is left out.</span>
                </li>
              )}
              {summary.dropped > 0 && (
                <li>
                  <Icon name="warning" size={16} />
                  <span>
                    {plural(summary.dropped, 'entry', 'entries')} could not be read (damaged or repeated) and {summary.dropped === 1 ? 'is' : 'are'} left out.
                  </span>
                </li>
              )}
              {summary.repaired > 0 && (
                <li>
                  <Icon name="info" size={16} />
                  <span>
                    {plural(summary.repaired, 'entry', 'entries')} had a detail that made no sense; {summary.repaired === 1 ? 'it is' : 'they are'} kept without it.
                  </span>
                </li>
              )}
            </ul>
          )}

          <div className="settings-import__choices">
            <div className="settings-choice">
              <h3 className="settings-choice__title">
                <Icon name="plus" size={16} />
                Merge entries
              </h3>
              <p className="settings-choice__text">
                {summary.fresh === 0 ? (
                  'Every entry in this file is already in your save, so there is nothing to add.'
                ) : (
                  <>
                    Adds the <b>{plural(summary.fresh, 'entry', 'entries')}</b> you do not have yet{summary.known > 0 ? ` (${formatCount(summary.known)} ${summary.known === 1 ? 'is' : 'are'} already here)` : ''}. Your settings and achievements stay as they are.
                  </>
                )}
              </p>
              <Button variant="primary" icon="plus" block disabled={summary.fresh === 0} onClick={merge}>
                Merge entries
              </Button>
            </div>
            <div className="settings-choice settings-choice--danger">
              <h3 className="settings-choice__title">
                <Icon name="swap" size={16} />
                Replace everything
              </h3>
              <p className="settings-choice__text">
                Swaps your current save (<b>{plural(currentCount, 'entry', 'entries')}</b>, its settings and achievements) for this file.{' '}
                {currentCount > 0 && (
                  <button type="button" className="settings-inline-button" onClick={() => void exportCurrentSave()}>
                    Export what you have first
                  </button>
                )}
              </p>
              <Button variant="danger" icon="swap" block onClick={replace}>
                Replace everything
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
      undoToast('Your Living Dex was reset', `${plural(previous.entries.length, 'entry', 'entries')} deleted${keepSettings ? '; your settings were kept' : ''}.`, previous, onReplaced)
    } catch (err) {
      toast({ kind: 'error', title: 'The reset did not go through', body: errorMessage(err) })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="md"
      title="Reset your Living Dex?"
      description={`This deletes ${entryCount === 0 ? 'everything you have logged' : `all ${plural(entryCount, 'entry', 'entries')}`}${achievementCount > 0 ? ` and ${plural(achievementCount, 'unlocked achievement')}` : ''}.`}
      media={
        <span className="settings-dialog-icon settings-dialog-icon--danger">
          <Icon name="warning" size={22} />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" icon="trash" aria-disabled={!armed} className={armed ? undefined : 'settings-reset__confirm--waiting'} onClick={reset}>
            Delete everything
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
        <Checkbox checked={keepSettings} onChange={setKeepSettings} label="Keep my settings" description="Trainer name, Living Dex rules and theme stay as they are. Untick to start completely fresh." />
        <div ref={fieldRef}>
          <TextField
            label={
              <>
                Type <b className="settings-reset__word">{RESET_WORD}</b> to confirm
              </>
            }
            value={typed}
            onChange={(text) => {
              setTyped(text)
              setNudged(false)
            }}
            autoCapitalize="characters"
            error={nudged && !armed ? `Type ${RESET_WORD} in capital letters to go ahead.` : undefined}
            data-autofocus
          />
        </div>
        {entryCount > 0 && (
          <p className="settings-text">
            Want a way back?{' '}
            <button type="button" className="settings-inline-button" onClick={() => void exportCurrentSave()}>
              Export your save first
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
  const [busy, setBusy] = useState<'export' | 'import' | 'game' | null>(null)
  const [report, setReport] = useState<SaveParseReport | null>(null)
  const [gameSave, setGameSave] = useState<GameSaveContents | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

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
      toast({ kind: 'error', title: 'That file could not be imported', body: errorMessage(err) })
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
      if (contents && Array.isArray(contents.pokemon) && typeof contents.fileName === 'string' && typeof contents.save?.trainer === 'string' && typeof contents.save.version?.name === 'string') setGameSave(contents)
      else toast({ kind: 'error', title: 'That file could not be imported', body: failureText(result.ok === false ? result.reason : undefined) })
    } catch (err) {
      toast({ kind: 'error', title: 'That file could not be imported', body: errorMessage(err, failureText(undefined)) })
    } finally {
      setBusy(null)
    }
  }

  const gameSaveImported = (previous: SaveFile, added: number, fileName: string, completed: number): void => {
    const filled = `${plural(completed, 'earlier entry', 'earlier entries')} got the ability, PID, IVs or EVs ${completed === 1 ? 'it' : 'they'} lacked.`
    if (added === 0 && completed > 0) {
      undoToast(`${plural(completed, 'entry', 'entries')} completed`, `From ${fileName}: ${filled}`, previous, onReplaced)
      return
    }
    if (added === 0) {
      toast({ kind: 'info', title: 'Nothing new to add', body: 'Every Pokémon you chose is already in your save.' })
      return
    }
    undoToast(`${plural(added, 'entry', 'entries')} added`, `Imported from ${fileName}. You can edit them like any other entry.${completed > 0 ? ` ${filled}` : ''}`, previous, onReplaced)
  }

  return (
    <SettingsSection id="data" description="Your save holds every entry, your settings and your achievements. Keep a copy somewhere safe.">
      <dl className="settings-facts">
        <Fact label="Entries">{formatCount(entryCount)}</Fact>
        <Fact label="Achievements">{formatCount(achievementCount)}</Fact>
        <Fact label="Last change">{formatDateTime(updatedAt) || 'Never'}</Fact>
        <Fact label="Started">{formatDateTime(createdAt) || 'Unknown'}</Fact>
      </dl>

      <div className="settings-where">
        <Icon name="database" size={18} />
        <div className="settings-where__text">
          <span className="settings-row__label">Where your save lives</span>
          {app.desktop ? (
            app.info ? (
              <>
                <code className="settings-path u-selectable">{saveFilePath(app.info.userData)}</code>
                <span className="settings-row__desc">Pelagix writes this file after every change and keeps backups in the same folder.</span>
              </>
            ) : (
              <span className="settings-row__desc">{app.error ?? 'In the Pelagix data folder on this computer.'}</span>
            )
          ) : (
            <span className="settings-row__desc">In this browser's storage, on this device only. Clearing the site data of this page erases it, so export a copy now and then.</span>
          )}
        </div>
      </div>

      <div className="settings-actions">
        <div className="settings-action">
          <div className="settings-row__text">
            <span className="settings-row__label">Export save</span>
            <span className="settings-row__desc">A single file with everything in it. Use it as a backup or to move to another computer.</span>
          </div>
          <Button icon="download" loading={busy === 'export'} onClick={() => void exportSave()}>
            Export save
          </Button>
        </div>
        <div className="settings-action">
          <div className="settings-row__text">
            <span className="settings-row__label">Import save</span>
            <span className="settings-row__desc">Open a save file. You see what is in it before anything changes, and choose to merge or replace.</span>
          </div>
          <Button icon="upload" loading={busy === 'import'} onClick={() => void importSave()}>
            Import save
          </Button>
        </div>
        {app.desktop && (
          <div className="settings-action">
            <div className="settings-row__text">
              <span className="settings-row__label">Import from a game save</span>
              <span className="settings-row__desc">Open a save file of a Pokémon game and add the Pokémon in it as entries. You choose which ones first. The save file is only read, never changed.</span>
            </div>
            <Button icon="gamepad" loading={busy === 'game'} disabled={busy !== null && busy !== 'game'} onClick={() => void importGameSave()}>
              {busy === 'game' ? 'Reading…' : 'Import from a game save'}
            </Button>
          </div>
        )}
      </div>

      <div className="settings-danger">
        <div className="settings-row__text">
          <span className="settings-danger__title">
            <Icon name="warning" size={16} />
            Danger zone
          </span>
          <span className="settings-row__desc">Reset deletes every entry and achievement. You are asked to confirm, and you can keep your settings.</span>
        </div>
        <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>
          Reset…
        </Button>
      </div>

      <ImportDialog report={report} onClose={() => setReport(null)} onReplaced={onReplaced} />
      <GameSaveDialog contents={gameSave} onClose={() => setGameSave(null)} onImported={gameSaveImported} />
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onReplaced={onReplaced} />
    </SettingsSection>
  )
}
