import { useEffect, useState } from 'react'
import { ErrorBoundary } from '@renderer/components/ui'
import { t } from '@renderer/i18n'
import { useDexStore } from '@renderer/lib/data'
import { useSaveStore } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import { EntryEditor, type EditorRequest } from './EntryEditor'

/** Shown in place of an editor that threw: says so once, and closes the request so the app carries on. */
function EditorFailed() {
  useEffect(() => {
    toast({ kind: 'error', title: t('entry.toast.crashed.title'), body: t('entry.toast.crashed.body') })
    useUiStore.getState().closeEditor()
  }, [])
  return null
}

/**
 * Renders the entry editor for `useUiStore().entryEditor`. Mounted once by the app shell.
 *
 * Every request (a new catch with its preset, or an entry to edit) gets a fresh editor, so no
 * state leaks from one to the next; the last one stays mounted while its dialog plays its exit.
 */
export default function EntryEditorHost() {
  const request = useUiStore((s) => s.entryEditor)
  const dex = useDexStore((s) => s.dex)
  const ready = useSaveStore((s) => s.status === 'ready')
  const [session, setSession] = useState<{ key: number; request: EditorRequest } | null>(null)

  if (request.open && session?.request !== request) setSession({ key: (session?.key ?? 0) + 1, request })

  if (!session || !dex || !ready) return null
  return (
    // Keyed by request, so a failure in one editor never takes the next one down with it.
    <ErrorBoundary resetKeys={[session.key]} fallback={() => <EditorFailed />}>
      <EntryEditor key={session.key} dex={dex} request={session.request} open={request.open && request === session.request} />
    </ErrorBoundary>
  )
}
