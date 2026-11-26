import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

test('comments on your posts are grouped by platform, and Reddit points to Draft a Reply', async () => {
  const comment = (id: number, platform: string, external_id: string, author: string, body: string, url = `https://x.com/i/web/status/${id}`) =>
    ({ id, platform, external_id, post_url: platform === 'x' ? 'https://x.com/i/web/status/200' : 'https://github.com/lb0ss/guided-i18n/issues/8',
       url, author, body, created_at: '2026-11-23T10:00:00Z', state: 'new' })
  vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (path === '/comments') return json([comment(1, 'github', 'github:issue:71', 'asker', 'Any plans for Vue?'),
                                            comment(2, 'x', 'x:222', 'dev_ana', 'Does it work with Next.js?')])
    if (path === '/schedule') return json([{ job: 'checks', interval_hours: 24, enabled: true, last_run_at: '2026-11-23T10:00:00Z', built: true }])
    return json([])
  }))
  render(<QueryClientProvider client={new QueryClient()}><Review /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Comments on your posts/ }))
  const block = async (name: string) => (await screen.findByText(name, { selector: 'span.font-semibold' })).closest('div.grid, div.p-4') as HTMLElement
  await screen.findByText('dev_ana')  // wait for the comments to load
  expect(await block('GitHub')).toHaveTextContent('1 new')
  expect(await block('GitHub')).toHaveTextContent('Issue')
  expect(await block('X')).toHaveTextContent('Reply')
  expect(await block('X')).toHaveTextContent('dev_ana')
  expect(await block('dev.to')).toHaveTextContent('Nothing new')
  // Reddit: the paste form opens in place (no tab switch), and Cancel closes it again
  fireEvent.click(screen.getByRole('button', { name: 'Paste a Reddit comment' }))
  expect(await screen.findByText('Which of your Reddit posts?')).toBeInTheDocument()
  expect(screen.getByText('New on your posts')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Which of your Reddit posts?')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Paste a Reddit comment' })).toBeInTheDocument()
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
  render(<QueryClientProvider client={new QueryClient()}><Review /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'New X post' }))
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
  render(<QueryClientProvider client={new QueryClient()}><Review /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: /^Drafts/ }))
  await screen.findByDisplayValue('An X post draft')
  const group = (name: string) => screen.getByText(name, { selector: 'span.font-semibold' }).closest('div.grid') as HTMLElement
  expect(within(group('New X posts')).getByDisplayValue('An X post draft')).toBeInTheDocument()
  expect(within(group('X replies')).getByDisplayValue('A reply on X')).toBeInTheDocument()
  expect(within(group('GitHub')).getByText('1 posted')).toBeInTheDocument()
  expect(group('Reddit')).toHaveTextContent('Nothing yet')
})
