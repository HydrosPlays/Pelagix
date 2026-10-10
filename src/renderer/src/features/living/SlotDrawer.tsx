import { useEffect, useRef } from 'react'
import { EntryCard, FormCategoryTag, GenderIcon, ShinyMark, Sprite, SpriteStage, TypeBadges, typeColor } from '@renderer/components/pokemon'
import type { CatchEntry } from '@shared/save-types'
import { Button, Chip, Drawer, Icon, IconButton, Switch } from '@renderer/components/ui'
import type { Collection, LivingSlot } from '@renderer/domain/slots'
import { useDex } from '@renderer/lib/data'
import { editEntry } from '@renderer/lib/entry-actions'
import { dexNo, plural } from '@renderer/lib/format'
import { BOX_COLS, boxIndexAt, boxName, buildBoxes, slotEntries, slotInfo, slotStatus, type LivingMode } from './model'

export interface SlotDrawerProps {
  /** The slot to show; null closes the drawer. */
  slot: LivingSlot | null
  /** Its index in `collection.slots`. */
  index: number
  collection: Collection
  mode: LivingMode
  onClose: () => void
  /** Go to the neighbouring slot; undefined at either end. */
  onPrevious?: () => void
  onNext?: () => void
  /** Open the entry editor aimed at exactly this slot. */
  onLog: (slot: LivingSlot) => void
  /** Go to the Pokédex page of this Pokémon and form. */
  onFind: (slot: LivingSlot) => void
  /** HOME Dex only: every entry gets its own "In Pokémon HOME" switch. */
  onHome?: (entry: CatchEntry, on: boolean) => void
}

/**
 * A deleted entry takes its card, and the focused menu button on it, out of the drawer: the
 * keyboard goes to the drawer itself, so Left / Right, Tab and Escape carry on working.
 */
const ENTRY_MENU = {
  onDeleted: (): void => {
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active === null || active === document.body || !active.isConnected) document.querySelector<HTMLElement>('.living-drawer[role="dialog"]')?.focus({ preventScroll: true })
    })
  }
}

/** "Box 3 · Row 2, Column 4": where the slot sits, which is also where it goes in the game's boxes. */
function placeText(slots: readonly LivingSlot[], index: number): string {
  const boxes = buildBoxes(slots)
  const box = boxes[boxIndexAt(boxes, index)]
  if (!box) return ''
  const local = index - box.start
  return `${boxName(box)} · Row ${Math.floor(local / BOX_COLS) + 1}, Column ${(local % BOX_COLS) + 1}`
}

/**
 * Everything about one slot: its render, where it stands, the entries in it, and the two ways
 * forward (log a catch into it, or look up where to find it). Left / Right step through slots.
 */
export function SlotDrawer({ slot, index, collection, mode, onClose, onPrevious, onNext, onLog, onFind, onHome }: SlotDrawerProps) {
  const dex = useDex()
  // The panel keeps showing the last slot while it slides out.
  const last = useRef<{ slot: LivingSlot; index: number } | null>(null)
  if (slot) last.current = { slot, index }
  const shown = slot ?? last.current?.slot ?? null
  const shownIndex = slot ? index : (last.current?.index ?? 0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const open = slot !== null

  const step = useRef({ onPrevious, onNext })
  step.current = { onPrevious, onNext }

  // Left / Right walk the slots while focus is in the drawer and not in something that uses the arrows itself.
  useEffect(() => {
    if (!open) return
    const panel = bodyRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (!panel) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if ((event.target as HTMLElement).closest('input, textarea, select, [role="radio"], [role="tab"], [role="menu"], [role="listbox"]')) return
      const go = event.key === 'ArrowLeft' ? step.current.onPrevious : step.current.onNext
      if (!go) return
      event.preventDefault()
      go()
    }
    panel.addEventListener('keydown', onKey)
    return () => panel.removeEventListener('keydown', onKey)
  }, [open])

  if (!shown) return null

  const shiny = mode === 'shiny'
  const info = slotInfo(collection, shown.key, mode)
  const entries = slotEntries(collection, shown.key, mode)
  const form = dex.form(shown.species, shown.form)
  const types = form?.types ?? []
  const glow = shiny ? 'var(--gold)' : types[0] ? typeColor(types[0]) : undefined
  const glow2 = shiny ? 'var(--gold)' : types[1] ? typeColor(types[1]) : undefined
  const idle = !shiny && info.total === 0

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      className="living-drawer"
      title={shown.label}
      description={
        <span className="living-drawer__meta">
          <span className="living-drawer__no">{dexNo(shown.species)}</span>
          <span>{placeText(collection.slots, shownIndex)}</span>
        </span>
      }
      footer={
        <>
          <span className="living-drawer__nav">
            <IconButton icon="chevron-left" variant="subtle" label="Previous slot" disabled={!onPrevious} onClick={onPrevious} />
            <IconButton icon="chevron-right" variant="subtle" label="Next slot" disabled={!onNext} onClick={onNext} />
          </span>
          <Button variant="subtle" icon="map-pin" onClick={() => onFind(shown)}>
            Where to find it
          </Button>
          <Button variant="catch" icon={shiny ? 'sparkle' : 'plus'} data-autofocus onClick={() => onLog(shown)}>
            Log this Pokémon
          </Button>
        </>
      }
    >
      <div ref={bodyRef} className="living-drawer__body">
        <SpriteStage className={`living-drawer__stage${info.filled ? ' is-filled' : ''}`} dexNumber={shown.species} glow={info.filled ? glow : undefined} glow2={info.filled ? glow2 : undefined}>
          <Sprite key={shown.key} path={shown.spritePath(shiny)} size={184} lazy={false} silhouette={!info.filled} alt="" />
          <span className="living-drawer__status">
            {info.filled ? (
              <Chip tone={shiny ? 'gold' : 'success'} variant="solid" icon={shiny ? 'sparkle' : 'check'}>
                {shiny ? 'Shiny caught' : 'Caught'}
              </Chip>
            ) : (
              <Chip tone="neutral" variant="outline">
                {shiny ? 'No shiny yet' : 'Not caught yet'}
              </Chip>
            )}
          </span>
        </SpriteStage>

        <div className="living-drawer__facts">
          {types.length > 0 && <TypeBadges types={types} />}
          {form && shown.cat !== 'base' && <FormCategoryTag cat={shown.cat} region={form.region} />}
          {shown.gmax && (
            <Chip size="sm" tone="catch">
              Gigantamax
            </Chip>
          )}
          {shown.gender && (
            <span className="living-drawer__gender">
              <GenderIcon gender={shown.gender} size={14} />
              {shown.gender === 'm' ? 'Male' : 'Female'}
            </span>
          )}
          {!shiny && info.hasShiny && (
            <span className="living-drawer__gender">
              <ShinyMark size={14} label="" />
              Shiny owned
            </span>
          )}
        </div>

        <section className="living-drawer__entries" aria-label="Entries in this slot">
          <header className="living-drawer__entries-head">
            <h3 className="u-eyebrow">Entries in this slot</h3>
            <span className="living-drawer__entries-count">{slotStatus(info, mode)}</span>
          </header>
          {entries.length === 0 ? (
            <div className="living-drawer__empty">
              <Icon name="pokeball" size={22} />
              <p>
                {idle ? 'Nothing logged here yet.' : 'No entries in this slot.'} Caught one? <b>Log this Pokémon</b> and it lands right in this slot.
              </p>
            </div>
          ) : (
            <>
              {shiny && !info.filled && <p className="living-drawer__note">You have {plural(entries.length, 'regular entry', 'regular entries')} here. Only a shiny one fills this slot in the Shiny Living Dex.</p>}
              <div className="living-drawer__list">
                {entries.map((entry) =>
                  onHome ? (
                    <div key={entry.id} className="living-drawer__entry">
                      <EntryCard entry={entry} variant="card" showSpecies={false} onOpen={(e) => void editEntry(e.id)} menu={ENTRY_MENU} />
                      <Switch reverse className="living-drawer__home" checked={entry.inHome === true} onChange={(on) => onHome(entry, on)} label="In Pokémon HOME" />
                    </div>
                  ) : (
                    <EntryCard key={entry.id} entry={entry} variant="card" showSpecies={false} onOpen={(e) => void editEntry(e.id)} menu={ENTRY_MENU} />
                  )
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </Drawer>
  )
}
