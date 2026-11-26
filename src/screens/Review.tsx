import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, must, type Comment, type DraftRequest, type Opportunity, type Post, type Schedule } from '../api/client'
import { Badge, Button, Card, Empty, ErrorNote, PlatformHead, Section } from '../ui'
import { ago, shortKind, SOURCE_NAME } from '../format'
import { DraftFlow } from '../drafting'

const TABS = { reply: 'Worth a reply', comments: 'Comments on your posts', paste: 'Paste a thread', intel: 'Intel' } as const
type Tab = keyof typeof TABS
const CHANNELS = ['reddit-reply', 'reddit-post', 'github-comment', 'devto-comment', 'hn-comment', 'so-answer', 'x-post']

export default function Review() {
  const [tab, setTab] = useState<Tab>('reply')
  const opps = useQuery({ queryKey: ['opportunities', 'new'], queryFn: () => must<Opportunity[]>(api.GET('/opportunities', { params: { query: { state: 'new' } } })) })
  const intel = useQuery({ queryKey: ['opportunities', 'intel'], queryFn: () => must<Opportunity[]>(api.GET('/opportunities', { params: { query: { state: 'intel' } } })) })
  const comments = useQuery({ queryKey: ['comments', 'new'], queryFn: () => must<Comment[]>(api.GET('/comments', { params: { query: { state: 'new' } } })) })
  const count: Partial<Record<Tab, number | undefined>> = { reply: opps.data?.length, comments: comments.data?.length, intel: intel.data?.length }

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-line">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${t === tab ? 'border-accent font-medium' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {TABS[t]} {count[t] ? <Badge tone="accent">{count[t]}</Badge> : null}
          </button>
        ))}
      </div>
      <ErrorNote error={opps.error ?? comments.error} />
      {tab === 'reply' && (
        <Section title="Threads worth a reply">
          <p className="text-sm text-muted">Found by research. Answer the person first; mention guided-i18n only where it truly helps, and say you built it.</p>
          {opps.data?.length === 0 && <Empty>Nothing right now. Research runs every 3 days.</Empty>}
          {opps.data?.map((o) => <OpportunityCard key={o.id} o={o} />)}
        </Section>
      )}
      {tab === 'comments' && <OnYourPosts comments={comments.data ?? []} />}
      {tab === 'paste' && <PasteForm />}
      {tab === 'intel' && (
        <Section title="Intel: read, don't reply">
          <p className="text-sm text-muted">Competitors' trackers, maintainers' own to-dos, roadmap signals.</p>
          {intel.data?.length === 0 && <Empty>No intel right now.</Empty>}
          {intel.data?.map((o) => <OpportunityCard key={o.id} o={o} intel />)}
        </Section>
      )}
    </>
  )
}

function OpportunityCard({ o, intel }: { o: Opportunity; intel?: boolean }) {
  const qc = useQueryClient()
  const skip = useMutation({
    mutationFn: () => must(api.POST('/opportunities/{opp_id}/skip', { params: { path: { opp_id: o.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  })
  return (
    <Card className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="accent">{o.category}</Badge>
        <span>{SOURCE_NAME[o.source] ?? o.source}</span>
        <span>· {ago(o.created_at)}</span>
        <span>· {o.replies} replies</span>
        <span>· relevance {o.relevance}/5</span>
      </div>
      <a href={o.url} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">{o.title}</a>
      {o.excerpt && <p className="line-clamp-3 whitespace-pre-line text-sm text-muted">{o.excerpt}</p>}
      <p className="text-sm"><span className="text-muted">{intel ? 'Why it matters: ' : 'Angle: '}</span>{o.angle}</p>
      <div className="flex flex-wrap items-start gap-2">
        {!intel && <DraftFlow req={{ kind: 'opportunity', id: o.id, confirm: false }} />}
        <Button variant="quiet" disabled={skip.isPending} onClick={() => skip.mutate()}>{intel ? 'Done' : 'Skip'}</Button>
      </div>
    </Card>
  )
}

/** What's watched on each platform, in a fixed order. Reddit isn't watched: its row opens the paste form in place. */
const PLATFORMS = [
  { key: 'github', name: 'GitHub', watches: 'new issues and issue comments on your repo' },
  { key: 'devto', name: 'dev.to', watches: 'comments on your articles' },
  { key: 'x', name: 'X', watches: 'replies to and mentions of you' },
] as const

function OnYourPosts({ comments }: { comments: Comment[] }) {
  const [pasting, setPasting] = useState(false)
  const schedule = useQuery({ queryKey: ['schedule'], queryFn: () => must<Schedule[]>(api.GET('/schedule')) })
  const checked = schedule.data?.find((s) => s.job === 'checks')?.last_run_at
  return (
    <Section title="New on your posts" aside={<span className="text-sm text-muted">Checked {ago(checked)} · daily</span>}>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {PLATFORMS.map((p) => {
          const items = comments.filter((c) => c.platform === p.key)
          return (
            <div key={p.key} className="grid gap-3 p-4">
              <PlatformHead name={p.name} note={p.watches}>
                {items.length ? <Badge tone="accent">{items.length} new</Badge> : <span className="text-sm text-muted">Nothing new</span>}
              </PlatformHead>
              {items.map((c) => <CommentCard key={c.id} c={c} />)}
            </div>
          )
        })}
        <div className="grid gap-3 p-4">
          <PlatformHead name="Reddit" note="not watched (no API): paste a comment to draft a reply">
            {!pasting && <Button variant="plain" onClick={() => setPasting(true)}>Paste a Reddit comment</Button>}
          </PlatformHead>
          {pasting && <PasteFields platform="reddit" onCancel={() => setPasting(false)} />}
        </div>
      </div>
    </Section>
  )
}

function CommentCard({ c }: { c: Comment }) {
  const qc = useQueryClient()
  const dismiss = useMutation({
    mutationFn: () => must(api.POST('/comments/{comment_id}/dismiss', { params: { path: { comment_id: c.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  })
  return (
    <div className="grid gap-2 rounded-md border border-line bg-bg/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge>{shortKind(c)}</Badge><span className="font-medium text-ink">{c.author}</span><span>· {ago(c.created_at)}</span>
        <a className="underline" href={c.url} target="_blank" rel="noreferrer">open</a>
      </div>
      <p className="whitespace-pre-line text-sm">{c.body}</p>
      <div className="flex flex-wrap items-start gap-2">
        <DraftFlow req={{ kind: 'comment', id: c.id, confirm: false }} />
        <Button variant="quiet" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>No reply needed</Button>
      </div>
    </div>
  )
}

function PasteForm() {
  return (
    <Section title="Paste a thread">
      <p className="text-sm text-muted">
        For a thread Radar didn't bring you: a Reddit comment, an HN or Stack Overflow thread, a tweet. Paste the comment you're answering (and the lines it
        replies to, if any) and pick where you'll post the reply. For a comment on one of your posts, pick the post: Radar adds its text, so you only paste
        the new comment. The draft appears under Drafts.
      </p>
      <Card className="grid gap-3">
        <PasteFields />
      </Card>
    </Section>
  )
}

/** The paste-and-draft fields. With `platform` (inside that platform's row on "Comments on your posts"),
 * the channel is fixed and only that platform's posts are offered; onCancel closes it. */
function PasteFields({ platform, onCancel }: { platform?: 'reddit'; onCancel?: () => void }) {
  const posts = useQuery({ queryKey: ['posts'], queryFn: () => must<Post[]>(api.GET('/posts')) })
  const [text, setText] = useState('')
  const [channel, setChannel] = useState('reddit-reply')
  const [post, setPost] = useState<string>('')
  const req: DraftRequest = { kind: 'pasted', text, channel, post_id: post ? Number(post) : null, confirm: false }
  const choices = posts.data?.filter((p) => !platform || p.platform === platform)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-4 text-sm">
        {!platform && (
          <label className="grid gap-1">
            <span className="text-muted">Where you'll post it</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1.5">
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        )}
        <label className="grid min-w-0 flex-1 gap-1">
          <span className="text-muted">{platform ? 'Which of your Reddit posts?' : 'Reply on which post?'}</span>
          <select value={post} onChange={(e) => setPost(e.target.value)} className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5">
            <option value="">Not one of my posts</option>
            {choices?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
      </div>
      <textarea
        autoFocus={!!platform}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="u/someone: Does it handle plurals for Polish?"
        className="min-h-32 rounded-md border border-line bg-surface p-3 text-sm"
      />
      <div className="flex flex-wrap items-start gap-2">
        <DraftFlow key={`${channel}-${post}-${text.length > 0}`} req={req} label="Draft a reply" disabled={!text.trim()} />
        {onCancel && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  )
}
