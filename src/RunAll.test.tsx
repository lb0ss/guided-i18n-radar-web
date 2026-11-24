import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import RunAll from './RunAll'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('one click runs checks, then research, and sums up both', async () => {
  const order: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname
    order.push(path)
    const body = path === '/run/checks' ? { new_comments: 1, new_summary: '1 new GitHub issue', failed: [] } : { replies: 2, intel: 5, cost: 0.008, failed: [] }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  render(<QueryClientProvider client={new QueryClient()}><RunAll /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Run checks + research' }))
  expect(await screen.findByRole('status')).toHaveTextContent('1 new GitHub issue · 2 worth a reply, 5 intel · $0.008')
  expect(order).toEqual(['/run/checks', '/run/research'])
})
