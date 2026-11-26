import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import Drafts from './Drafts'

const job = { id: 1, created_at: '2026-11-22T10:00:00Z', kind: 'opportunity', source_id: 7, post_id: null, channel: 'github-comment',
  thread: ['the issue'], status: 'pass', final_draft_id: 11, cost: 0.012, posted_url: null, posted_text: null,
  attempts: [{ id: 11, attempt: 1, text: 'Wrap them in t().', verdict: 'pass', cost: 0.012, rule_failures: [], rule_warnings: [], problems: [], unsupported: [], scores: {} }] }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})


test('a new X post is drafted from a suggested topic, and the draft shows its image idea, alt text and links', async () => {
  const bodies: unknown[] = []
  const topic = { id: 3, created_at: '2026-11-25T10:00:00Z', title: 'Undo that keeps your edits', angle: 'Undo checks first.',
    evidence: 'r/SideProject comment', source: 'feedback', status: 'new', cost: 0.002 }
  const postJob = { ...job, id: 9, kind: 'post', channel: 'x-post', source_id: 3,
    attempts: [{ ...job.attempts[0], id: 21, text: 'Undo used to wipe your edits. Since 0.1.3 it checks first.' }], final_draft_id: 21,
    plan: { topic: 'Undo that keeps your edits', visual: 'The Undo prompt in VS Code', alt_text: 'A prompt offering Undo',
            first_reply: 'VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=BosiTerryLin.guided-i18n' } }
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (path === '/posts/topics' && req.method === 'GET') return json([topic])
    if (path === '/drafts' && req.method === 'POST') {
      const body = await req.json()
      bodies.push(body)
      return json(body.confirm ? postJob : { needs_confirmation: true, estimate: 0.03, worst_case: 0.09 })
    }
    return json([])
  }))
  render(<QueryClientProvider client={new QueryClient()}><Drafts /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'New X post' }))  // opens the panel in place
  expect(await screen.findByText('Undo that keeps your edits')).toBeInTheDocument()
  expect(screen.getByText('user feedback')).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Draft this post' })[0])
  fireEvent.click(await screen.findByRole('button', { name: 'Draft it' }))
  expect(await screen.findByText('The Undo prompt in VS Code')).toBeInTheDocument()
  expect(screen.getByText('A prompt offering Undo')).toBeInTheDocument()
  expect(screen.getByText(/itemName=BosiTerryLin\.guided-i18n/)).toBeInTheDocument()
  expect(screen.getByText(/\/ 280 characters/)).toBeInTheDocument()
  expect(bodies).toEqual([{ kind: 'post', id: 3, confirm: false }, { kind: 'post', id: 3, confirm: true }])
})

test('drafts are grouped by where they will be posted', async () => {
  const xPost = { ...job, id: 9, kind: 'post', channel: 'x-post', plan: { topic: 'Undo', visual: '', alt_text: '', first_reply: '' },
    attempts: [{ ...job.attempts[0], id: 31, text: 'An X post draft' }], final_draft_id: 31 }
  const xReply = { ...job, id: 8, kind: 'comment', channel: 'x-post', plan: null,
    attempts: [{ ...job.attempts[0], id: 32, text: 'A reply on X' }], final_draft_id: 32 }
  const gh = { ...job, id: 7, plan: null, posted_url: 'https://github.com/a/b/issues/1#c', posted_text: 'Posted reply' }
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
    return json(path === '/drafts' ? [xPost, xReply, gh] : [])
  }))
  render(<QueryClientProvider client={new QueryClient()}><Drafts /></QueryClientProvider>)
  await screen.findByDisplayValue('An X post draft')
  const group = (name: string) => screen.getByText(name, { selector: 'span.font-semibold' }).closest('div.grid') as HTMLElement
  expect(within(group('New X posts')).getByDisplayValue('An X post draft')).toBeInTheDocument()
  expect(within(group('X replies')).getByDisplayValue('A reply on X')).toBeInTheDocument()
  expect(within(group('GitHub')).getByText('1 posted')).toBeInTheDocument()
  expect(group('Reddit')).toHaveTextContent('Nothing yet')
})
