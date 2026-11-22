import { useEffect, useState } from 'react'
import Brief from './screens/Brief'
import Digest from './screens/Digest'
import Review from './screens/Review'
import Runs from './screens/Runs'

const SCREENS = { digest: 'Digest', review: 'Review', runs: 'Run history', brief: 'Brief & schedule' } as const
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
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6">
        {screen === 'digest' && <Digest go={go} />}
        {screen === 'review' && <Review />}
        {screen === 'runs' && <Runs />}
        {screen === 'brief' && <Brief />}
      </main>
    </div>
  )
}
