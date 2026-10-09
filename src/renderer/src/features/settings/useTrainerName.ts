import { useCallback, useState } from 'react'
import { useSaveStore } from '@renderer/store/save'

/** Longest trainer name the save keeps. */
export const TRAINER_NAME_MAX = 40

export interface TrainerNameField {
  /** What the text box shows: exactly what was typed, spaces included. */
  value: string
  /** Stores the trimmed name at once (the save store debounces the write). */
  onChange: (text: string) => void
  /** The name as stored (trimmed). */
  stored: string
}

/**
 * Trainer name as an auto-saving text field. The store trims what it keeps, so the field holds its
 * own text: binding the box straight to the store would swallow a space the moment it is typed.
 * A change from elsewhere (import, reset) replaces the text.
 */
export function useTrainerName(): TrainerNameField {
  const stored = useSaveStore((s) => s.save.settings.trainerName)
  const [draft, setDraft] = useState(stored)
  const [seen, setSeen] = useState(stored)

  if (stored !== seen) {
    setSeen(stored)
    if (draft.trim() !== stored) setDraft(stored)
  }

  const onChange = useCallback((text: string) => {
    const next = text.slice(0, TRAINER_NAME_MAX)
    setDraft(next)
    useSaveStore.getState().setSettings({ trainerName: next })
  }, [])

  return { value: draft, onChange, stored }
}
