import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  location.hash = ''
})

test('the top bar reads Brief & schedule, Dashboard, Review, Drafts (waiting), Run history; old #digest links open the Dashboard', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const draft = (id: number, posted: string | null, status = 'pass') => ({ id, posted_url: posted, status, kind: 'post', channel: 'x-post', attempts: [], thread: [] })
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (path === '/drafts') return json([draft(1, null), draft(2, null), draft(3, 'https://x.com/1'), draft(4, null, 'failed')])
    if (path === '/stats') return json({ stats: [] })
    if (path === '/reach') return json({ checked_at: null, first_at: null, total: { value: 0, change: null, since_first: null }, stores: [], points: [], events: [] })
    return json([])
  }))
  location.hash = '#digest'
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>)
  const nav = screen.getByRole('navigation')
  expect([...nav.querySelectorAll('button')].map((b) => b.childNodes[0].textContent)).toEqual(['Brief & schedule', 'Dashboard', 'Review', 'Drafts', 'Run history'])
  expect(await screen.findByLabelText('2 waiting')).toBeInTheDocument()  // not the posted one, not the failed one
  expect(screen.getByRole('button', { name: /^Dashboard/ }).className).toContain('font-medium')  // #digest → Dashboard
})
