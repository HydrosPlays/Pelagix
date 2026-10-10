import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { SaveFile } from '@shared/save-types'
import { BallIcon, GameBadge, GameIcon, ShinyMark, Sprite } from '@renderer/components/pokemon'
import { Button, Chip, Dialog, Icon, Select, VirtualGrid, cx, type SelectOption } from '@renderer/components/ui'
import { useDex } from '@renderer/lib/data'
import { errorMessage, formatCount, formatDate, plural, todayIso } from '@renderer/lib/format'
import { newId } from '@renderer/lib/id'
import { useEntries, useRules, useSaveStore } from '@renderer/store/save'
import { toast } from '@renderer/store/ui'
import { countChosen, entriesToComplete, entriesToImport, selectAllNew, selectFilling, STATUS_LABELS, type ImportSource, type Preview, type PreviewRow } from './model'
import './GameSaveDialog.css'

const ROW_HEIGHT = 56

export interface GameSaveDialogProps {
  /** What was read from the picked file; null keeps the window closed. */
  source: ImportSource | null
  onClose: () => void
  /**
   * The chosen Pokémon were added as entries, and `completed` earlier entries got the ability, PID, IVs or
   * EVs they lacked. `previous` is the save as it was just before.
   */
  onImported: (previous: SaveFile, added: number, fileName: string, completed: number) => void
}

/** What the user chose in the window, for one picked file. */
interface Choice {
  contents: ImportSource
  /** Null until a checkbox or a quick choice was used: every new Pokémon. */
  selected: ReadonlySet<number> | null
  /** Answer to "which game is this save from?". */
  game: string | null
}

function StatusChip({ row }: { row: PreviewRow }) {
  if (row.status === 'new') {
    return row.fills ? (
      <Chip size="sm" tone="catch" icon="plus">
        New slot
      </Chip>
    ) : (
      <Chip size="sm" tone="accent">
        {STATUS_LABELS.new}
      </Chip>
    )
  }
  if (row.status === 'imported') {
    return (
      <Chip size="sm" variant="outline" icon={row.completes === true ? 'plus' : 'check'}>
        {row.completes === true ? 'Adds missing details' : STATUS_LABELS.imported}
      </Chip>
    )
  }
  if (row.status === 'egg') {
    return (
      <Chip size="sm" variant="outline" icon="egg">
        Egg, skipped
      </Chip>
    )
  }
  return (
    <Chip size="sm" tone="warning" icon="warning">
      {STATUS_LABELS.unsupported}
    </Chip>
  )
}

function Row({ row, checked, columns }: { row: PreviewRow; checked: boolean; columns: ImportSource['columns'] }) {
  const { pokemon, entry } = row
  const pickable = row.status === 'new'
  const detail = entry?.nickname !== undefined ? `“${entry.nickname}”` : undefined
  const blank: ReactNode = (
    <span className="gamesave-row__blank" aria-hidden="true">
      –
    </span>
  )
  return (
    <div className={cx('gamesave-row', columns === 'hunt' && 'gamesave-row--hunt', !pickable && 'gamesave-row--off', pickable && checked && 'is-checked')}>
      <span className="ui-checkbox gamesave-row__check">
        {pickable && (
          <>
            {/* The row itself is the control (click, Enter, Space); the box mirrors it for assistive technology. */}
            <input type="checkbox" className="ui-checkbox__input" checked={checked} readOnly tabIndex={-1} aria-label={`Import ${row.name}`} />
            <span className="ui-checkbox__box" aria-hidden="true">
              <Icon name="check" size={13} strokeWidth={2.6} />
            </span>
          </>
        )}
      </span>
      <span className="gamesave-row__sprite">
        {row.status === 'egg' ? <Icon name="egg" size={22} /> : <Sprite species={pokemon.species} form={pokemon.form} shiny={pokemon.shiny === true} female={pokemon.gender === 'f'} size={40} />}
      </span>
      <span className="gamesave-row__name">
        <span className="gamesave-row__title">
          <span className="u-truncate">{row.name}</span>
          {pokemon.shiny === true && row.status !== 'egg' && <ShinyMark size={14} />}
        </span>
        {detail !== undefined && <span className="gamesave-row__detail u-truncate">{detail}</span>}
      </span>
      {row.reason !== undefined ? (
        <span className="gamesave-row__reason">{row.reason}</span>
      ) : (
        <>
          <span className="gamesave-row__game">{row.game ? <GameBadge game={row.game} size="sm" system={false} /> : blank}</span>
          <span className="gamesave-row__where">
            <span className="u-truncate">{(columns === 'hunt' ? entry?.method : entry?.location) ?? blank}</span>
          </span>
          <span className="gamesave-row__level">{columns === 'hunt' ? (entry?.date !== undefined ? formatDate(entry.date) : blank) : entry?.level !== undefined ? `Lv. ${entry.level}` : blank}</span>
          <span className="gamesave-row__ball">{entry?.ball !== undefined ? <BallIcon ball={entry.ball} size={22} /> : blank}</span>
        </>
      )}
      <span className="gamesave-row__status">
        <StatusChip row={row} />
      </span>
    </div>
  )
}

/**
 * The preview of "Import from a game save" and "Import from ShinyDex": what is in the picked file,
 * which Pokémon are new, and a confirm button that adds the chosen ones as entries in one step.
 * Until that button is pressed nothing changes; the picked file itself is never written to.
 */
export function GameSaveDialog({ source: contents, onClose, onImported }: GameSaveDialogProps) {
  const dex = useDex()
  const entries = useEntries()
  const rules = useRules()
  const [choice, setChoice] = useState<Choice | null>(null)
  /** The file whose import already went through, so a second press of the button adds nothing. */
  const done = useRef<ImportSource | null>(null)

  const fresh = useMemo(() => {
    if (!contents) return null
    const mine = choice?.contents === contents ? choice : { contents, selected: null, game: null }
    let preview: Preview
    try {
      preview = contents.preview(dex, entries, rules, { today: todayIso(), game: mine.game })
    } catch {
      preview = { rows: [], counts: { new: 0, imported: 0, egg: 0, unsupported: 0, fills: 0, completes: 0 }, askGames: [] }
    }
    const selected = mine.selected ?? selectAllNew(preview.rows)
    return { contents, preview, selected, game: mine.game, chosen: countChosen(preview.rows, selected), completes: preview.counts.completes }
  }, [contents, choice, dex, entries, rules])
  // Frozen while the dialog plays its exit, so the list neither empties nor changes under the fade.
  const last = useRef(fresh)
  if (fresh) last.current = fresh
  const view = last.current

  const select = (selected: ReadonlySet<number>): void => {
    if (fresh) setChoice({ contents: fresh.contents, selected, game: fresh.game })
  }
  const toggle = (row: PreviewRow): void => {
    if (!fresh || row.status !== 'new') return
    const { contents: file, preview, game } = fresh
    // From the latest choice, not this render's: two toggles in one tick must both count.
    setChoice((old) => {
      const mine = old?.contents === file ? old : null
      const next = new Set(mine?.selected ?? selectAllNew(preview.rows))
      if (!next.delete(row.index)) next.add(row.index)
      return { contents: file, selected: next, game: mine ? mine.game : game }
    })
  }

  const confirm = (): void => {
    if (!fresh || done.current === fresh.contents) return
    const store = useSaveStore.getState()
    const previous = store.save
    try {
      const adding = entriesToImport(fresh.preview.rows, fresh.selected, previous.entries, new Date().toISOString(), newId)
      const completing = entriesToComplete(fresh.preview.rows, previous.entries)
      done.current = fresh.contents
      const completed = completing.length > 0 ? store.patchEntries(completing) : 0
      const added = adding.length > 0 ? store.mergeEntries(adding).added : 0
      onClose()
      onImported(previous, added, fresh.contents.fileName, completed)
    } catch (err) {
      done.current = null
      toast({ kind: 'error', title: 'The Pokémon could not be added', body: errorMessage(err) })
    }
  }

  const gameOptions = useMemo<SelectOption<string>[]>(() => (view?.preview.askGames ?? []).map((g) => ({ value: g.id, label: g.name, icon: <GameIcon game={g} size={20} tooltip={false} alt="" /> })), [view?.preview.askGames])
  const counts = view?.preview.counts

  return (
    <Dialog
      open={contents !== null}
      onClose={onClose}
      size="xl"
      title="Import these Pokémon?"
      description={view?.contents.description}
      media={
        <span className="settings-dialog-icon">
          <Icon name={view?.contents.icon ?? 'gamepad'} size={22} />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={view && view.chosen === 0 && view.completes > 0 ? 'check' : 'plus'} disabled={!view || (view.chosen === 0 && view.completes === 0)} onClick={confirm} data-autofocus>
            {view && view.chosen > 0 ? `Add ${plural(view.chosen, 'entry', 'entries')}` : view && view.completes > 0 ? `Complete ${plural(view.completes, 'earlier entry', 'earlier entries')}` : 'Nothing to add'}
          </Button>
        </>
      }
    >
      {view && counts && (
        <div className="gamesave">
          <div className="gamesave__counts" role="status">
            <Chip tone="accent">{formatCount(counts.new)} new</Chip>
            <Chip tone="catch">
              {formatCount(counts.fills)} {counts.fills === 1 ? 'fills' : 'fill'} an empty Living Dex slot
            </Chip>
            {counts.imported > 0 && <Chip variant="outline">{formatCount(counts.imported)} already imported</Chip>}
            {counts.completes > 0 && (
              <Chip tone="accent" variant="outline">
                {plural(counts.completes, 'earlier entry gets', 'earlier entries get')} missing details added
              </Chip>
            )}
            {counts.egg > 0 && <Chip variant="outline">{plural(counts.egg, 'egg')} skipped</Chip>}
            {counts.unsupported > 0 && <Chip tone="warning">{formatCount(counts.unsupported)} cannot be imported</Chip>}
          </div>

          {view.contents.note !== undefined && (
            <p className="gamesave__note">
              <Icon name="warning" size={16} />
              {view.contents.note}
            </p>
          )}

          {gameOptions.length > 0 && (
            <Select
              label="Which game are these from?"
              hint="This save does not record the exact game of some Pokémon. Your answer is used for the ones that can be from that game."
              placeholder="Choose a game…"
              options={gameOptions}
              value={view.game}
              onChange={(game) => setChoice({ contents: view.contents, selected: null, game })}
            />
          )}

          {view.preview.rows.length === 0 ? (
            <p className="gamesave__empty">{view.contents.empty}</p>
          ) : (
            <>
              <div className="gamesave__bar">
                <span className="gamesave__picked">
                  {formatCount(view.chosen)} of {formatCount(counts.new)} new chosen
                </span>
                <Button size="sm" disabled={counts.new === 0} onClick={() => select(selectAllNew(view.preview.rows))}>
                  All new
                </Button>
                <Button size="sm" disabled={counts.fills === 0} onClick={() => select(selectFilling(view.preview.rows))}>
                  Only empty slots
                </Button>
              </div>
              <div className="gamesave__list">
                <VirtualGrid
                  items={view.preview.rows}
                  itemKey={(row) => row.index}
                  renderItem={(row) => <Row row={row} checked={view.selected.has(row.index)} columns={view.contents.columns} />}
                  minColumnWidth={320}
                  maxColumns={1}
                  itemHeight={ROW_HEIGHT}
                  gap={0}
                  overscan={6}
                  scroll="self"
                  label={view.contents.listLabel}
                  onActivate={toggle}
                />
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  )
}
