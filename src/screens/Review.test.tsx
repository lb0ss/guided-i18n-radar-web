import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import Review from './Review'

const opp = { id: 7, url: 'https://github.com/a/b/issues/1', source: 'github', title: 'How do I extract hardcoded strings?', excerpt: '',
  created_at: '2026-11-22T10:00:00Z', replies: 0, relevance: 5, category: 'problem', angle: 'Answer first.', reason: '', state: 'new' }
const job = { id: 1, created_at: '2026-11-22T10:00:00Z', kind: 'opportunity', source_id: 7, post_id: null, channel: 'github-comment',
  thread: ['the issue'], status: 'pass', final_draft_id: 11, cost: 0.012, posted_url: null, posted_text: null,
  attempts: [{ id: 11, attempt: 1, text: 'Wrap them in t().', verdict: 'pass', cost: 0.012, rule_failures: [], rule_warnings: [], problems: [], unsupported: [], scores: {} }] }

function mockApi() {
  const posts: { url: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const url = new URL(req.url)
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.pathname === '/opportunities') return json(url.searchParams.get('state') === 'new' ? [opp] : [])
    if (url.pathname === '/comments') return json([])
    if (url.pathname === '/drafts' && req.method === 'POST') {
      const body = await req.json()
      posts.push({ url: url.pathname, body })
      return json(body.confirm ? job : { needs_confirmation: true, estimate: 0.026, worst_case: 0.077 })
    }
    return json([])
  }))
  return posts
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('a draft is only requested after confirming the estimate', async () => {
  const calls = mockApi()
  render(<QueryClientProvider client={new QueryClient()}><Review /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: /^Draft a reply$/ }))
  expect(await screen.findByText(/Drafting costs about/)).toHaveTextContent('$0.026')
  expect(calls).toEqual([{ url: '/drafts', body: { kind: 'opportunity', id: 7, confirm: false } }])
  fireEvent.click(screen.getByRole('button', { name: 'Draft it' }))
  expect(await screen.findByDisplayValue('Wrap them in t().')).toBeInTheDocument()
  await waitFor(() => expect(calls.at(-1)?.body).toMatchObject({ confirm: true }))
  expect(screen.getByText('ready to post')).toBeInTheDocument()
})

test('cancel spends nothing', async () => {
  const calls = mockApi()
  render(<QueryClientProvider client={new QueryClient()}><Review /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: /^Draft a reply$/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText(/Drafting costs/)).not.toBeInTheDocument()
  expect(calls.every((c) => (c.body as { confirm: boolean }).confirm === false)).toBe(true)
})
