import { useEffect, useState } from 'react'
import Brief from './screens/Brief'
import { useQuery } from '@tanstack/react-query'
import { api, must, type DraftJob } from './api/client'
import Digest from './screens/Digest'
import Drafts from './screens/Drafts'
import Review from './screens/Review'
import Runs from './screens/Runs'
import RunAll from './RunAll'

const SCREENS = { brief: 'Brief & schedule', digest: 'Digest', review: 'Review', drafts: 'Drafts', runs: 'Run history' } as const
type Screen = keyof typeof SCREENS

function useHashScreen(): [Screen, (s: Screen) => void] {
  const read = () => (location.hash.slice(1) in SCREENS ? location.hash.slice(1) : 'digest') as Screen
  const [screen, setScreen] = useState<Screen>(read)
  useEffect(() => {
    const on = () => setScreen(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return [screen, (s) => (location.hash = s)]
}

export default function App() {
  const [screen, go] = useHashScreen()
  // drafts waiting to be posted, shown on the Drafts tab (scheduled X posts land there without you starting them)
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: () => must<DraftJob[]>(api.GET('/drafts', { params: { query: { limit: 50 } } })) })
  const waiting = drafts.data?.filter((j) => !j.posted_url && j.status !== 'failed').length ?? 0
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">
            guided-i18n <span className="text-accent">Radar</span>
          </span>
          <nav className="flex flex-wrap gap-1">
            {(Object.keys(SCREENS) as Screen[]).map((s) => (
              <button
                key={s}
                onClick={() => go(s)}
                className={`rounded-md px-3 py-1.5 text-sm ${s === screen ? 'bg-surface font-medium shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`}
              >
                {SCREENS[s]}
                {s === 'drafts' && waiting > 0 && (
                  <span className="ml-1.5 rounded-full border border-accent/40 px-1.5 font-mono text-[11px] text-accent" aria-label={`${waiting} waiting`}>{waiting}</span>
                )}
              </button>
            ))}
          </nav>
          <RunAll />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6">
        {screen === 'digest' && <Digest go={go} />}
        {screen === 'review' && <Review />}
        {screen === 'drafts' && <Drafts />}
        {screen === 'runs' && <Runs />}
        {screen === 'brief' && <Brief />}
      </main>
    </div>
  )
}
