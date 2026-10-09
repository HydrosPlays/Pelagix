import { useLayoutEffect, useRef } from 'react'
import { ErrorBoundary, Panel } from '@renderer/components/ui'
import { useProgress } from '@renderer/domain/progress'
import { useCollection } from '@renderer/domain/slots'
import AchievementsSummaryCard from '@renderer/features/achievements/AchievementsSummaryCard'
import { enterStagger } from '@renderer/lib/anim'
import { useEntries, useSettings } from '@renderer/store/save'
import { ContinueHunt } from './ContinueHunt'
import { Hero } from './Hero'
import { ActivityPanel, BallsPanel, GamesPanel, GenerationPanel, RecentPanel, TypesPanel } from './panels'
import { Welcome } from './Welcome'
import './HomePage.css'

/** Where the user stands and what to do next. */
function Dashboard() {
  const collection = useCollection()
  const progress = useProgress()
  const settings = useSettings()
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    enterStagger(gridRef.current?.children, { delay: 140, step: 60, y: 14 })
  }, [])

  return (
    <div className="page home">
      <Hero progress={progress} trainerName={settings.trainerName} rules={collection.rules} />
      <ContinueHunt slots={progress.nextUncaught} missing={collection.totals.slots - collection.totals.caught} />
      <div ref={gridRef} className="home-grid">
        <GenerationPanel progress={progress} className="home-grid__wide" />
        <RecentPanel progress={progress} className="home-grid__narrow" />
        <GamesPanel progress={progress} className="home-grid__wide" />
        <ActivityPanel progress={progress} className="home-grid__narrow" />
        <TypesPanel progress={progress} className="home-grid__wide" />
        {/* Built by the achievements feature: if it ever fails, the rest of the dashboard stays up. */}
        <ErrorBoundary
          fallback={() => (
            <Panel title="Achievements" className="home-grid__narrow">
              <p className="home-note">Your achievements could not be shown here. They are safe; open the Achievements page to see them.</p>
            </Panel>
          )}
        >
          <AchievementsSummaryCard className="home-grid__narrow" />
        </ErrorBoundary>
        <BallsPanel progress={progress} className="home-grid__full" />
      </div>
    </div>
  )
}

/** Home: the dashboard, or a welcome while nothing has been logged yet. */
export default function HomePage() {
  const hasEntries = useEntries().length > 0
  return hasEntries ? <Dashboard /> : <Welcome />
}
