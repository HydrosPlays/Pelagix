import { useEffect, useState, type ReactNode } from 'react'
import { Router } from 'wouter'
import { ErrorBoundary, Toaster } from '@renderer/components/ui'
import { UpdateNotice } from '@renderer/features/updates/UpdateNotice'
import UpdateWatcher from '@renderer/features/updates/UpdateWatcher'
import UpdateWindows from '@renderer/features/updates/UpdateWindows'
import { initMotion } from '@renderer/lib/anim'
import { useDexStore } from '@renderer/lib/data'
import { isElectron } from '@renderer/lib/env'
import { errorMessage } from '@renderer/lib/format'
import { AppShell } from '@renderer/shell/AppShell'
import { BootError, BootScreen, type BootStep } from '@renderer/shell/BootScreen'
import { useHashLocation } from '@renderer/shell/router'
import { applyTheme } from '@renderer/shell/theme'
import { useSaveStore } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'

function startLoading(): void {
  void useSaveStore.getState().hydrate()
  void useDexStore
    .getState()
    .ensure()
    .catch(() => {
      // Reported through the store's `error`.
    })
}

let loadReportShown = false

const stepState = (status: 'idle' | 'loading' | 'ready' | 'error'): BootStep['state'] => (status === 'ready' ? 'done' : status === 'error' ? 'error' : status === 'loading' ? 'active' : 'pending')

/**
 * The shell has crashed, and whatever it had open went with it. The flags that say "the entry
 * editor is open" and "the palette is open" must not outlive it: an update window would wait
 * for them for ever, and "Restart and update" would refuse because of a draft that is gone.
 */
function forgetWhatWasOpen(): void {
  const ui = useUiStore.getState()
  ui.closeEditor()
  ui.setCommandPalette(false)
}

/**
 * Boot sequence: load the save and the Pokédex index side by side, apply the theme, then mount the
 * shell. Until both are ready the branded loading screen shows; a failure gets a full-window
 * explanation with a retry.
 *
 * The toasts and, in the desktop app, the update watcher with its windows are mounted here and
 * not by the shell: a version whose shell cannot start, or has crashed, must still be able to
 * offer the version that fixes it.
 */
export default function App() {
  const saveStatus = useSaveStore((s) => s.status)
  const saveError = useSaveStore((s) => s.lastError)
  const theme = useSaveStore((s) => s.save.settings.theme)
  const dexStatus = useDexStore((s) => s.status)
  const dexError = useDexStore((s) => s.error)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => initMotion(), [])
  useEffect(startLoading, [])

  useEffect(() => {
    if (saveStatus === 'ready') applyTheme(theme)
  }, [saveStatus, theme])

  // Tell the user once when their save had to be repaired on the way in.
  useEffect(() => {
    if (saveStatus !== 'ready' || loadReportShown) return
    loadReportShown = true
    const report = useSaveStore.getState().loadReport
    if (!report || report.warnings.length === 0) return
    toast({
      kind: report.dropped > 0 || report.newer ? 'error' : 'info',
      title: report.newer ? 'This save comes from a newer Pelagix' : 'Your save was repaired while loading',
      body: report.warnings.slice(0, 2).join(' ')
    })
  }, [saveStatus])

  const retry = (): void => {
    setRetrying(true)
    startLoading()
    // Both stores flip to "loading" synchronously, which swaps this screen for the loader.
    setTimeout(() => setRetrying(false), 300)
  }

  const failed = dexStatus === 'error' || saveStatus === 'error'
  const loading = !failed && (saveStatus !== 'ready' || dexStatus !== 'ready')
  // The screens without a navigation rail show the update marker themselves. Desktop app only:
  // a browser has nothing to check or install.
  const updateNotice = isElectron ? <UpdateNotice /> : undefined

  let screen: ReactNode
  if (dexStatus === 'error') {
    screen = (
      <BootError
        title="The Pokédex datasets are missing"
        hint={
          <>
            Run <code>npm run data</code> to build the datasets, then try again.
          </>
        }
        detail={errorMessage(dexError, 'The dataset could not be loaded.')}
        onRetry={retry}
        retrying={retrying}
        notice={updateNotice}
      />
    )
  } else if (saveStatus === 'error') {
    screen = (
      <BootError
        title="Your save could not be loaded"
        hint="Nothing has been overwritten. Make sure the save file is readable, then try again."
        detail={saveError ?? undefined}
        onRetry={retry}
        retrying={retrying}
        notice={updateNotice}
      />
    )
  } else if (loading) {
    screen = (
      <BootScreen
        steps={[
          { label: 'Loading your save', state: stepState(saveStatus) },
          { label: 'Surfacing Pokédex data', state: stepState(dexStatus) }
        ]}
      />
    )
  } else {
    screen = (
      <ErrorBoundary title="Pelagix ran into a problem" extra={updateNotice} onError={forgetWhatWasOpen}>
        <Router hook={useHashLocation}>
          <AppShell />
        </Router>
      </ErrorBoundary>
    )
  }

  return (
    <>
      {screen}
      {isElectron && (
        <ErrorBoundary fallback={() => null}>
          {/* Nothing comes up over the loading screen; once that is over, with or without a shell, it may. */}
          <UpdateWatcher hold={loading} />
        </ErrorBoundary>
      )}
      {isElectron && (
        <ErrorBoundary fallback={() => null}>
          <UpdateWindows />
        </ErrorBoundary>
      )}
      <ErrorBoundary fallback={() => null}>
        <Toaster />
      </ErrorBoundary>
    </>
  )
}
