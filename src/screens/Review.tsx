import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, must, type Comment, type DraftJob, type DraftRequest, type Estimate, type Opportunity, type Post } from '../api/client'
import { Badge, Button, Card, CopyButton, Empty, ErrorNote, Section } from '../ui'
import { ago, commentKind, money, SOURCE_NAME } from '../format'

const TABS = { reply: 'Worth a reply', comments: 'Comments on your posts', paste: 'Draft a Reply', intel: 'Intel', drafts: 'Drafts' } as const
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
      {tab === 'comments' && (
        <Section title="New comments on your posts">
          <p className="text-sm text-muted">New GitHub issues and issue comments, dev.to comments, and replies to or mentions of you on X are checked daily. For Reddit, paste the comment under Draft a Reply.</p>
          {comments.data?.length === 0 && <Empty>No new comments.</Empty>}
          {comments.data?.map((c) => <CommentCard key={c.id} c={c} />)}
        </Section>
      )}
      {tab === 'paste' && <PasteForm />}
      {tab === 'intel' && (
        <Section title="Intel: read, don't reply">
          <p className="text-sm text-muted">Competitors' trackers, maintainers' own to-dos, roadmap signals.</p>
          {intel.data?.length === 0 && <Empty>No intel right now.</Empty>}
          {intel.data?.map((o) => <OpportunityCard key={o.id} o={o} intel />)}
        </Section>
      )}
      {tab === 'drafts' && <DraftList />}
    </>
  )
}

/** Ask for the estimate, then draft only after the user confirms it. */
function useDraft(req: DraftRequest) {
  const qc = useQueryClient()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const ask = useMutation({
    mutationFn: () => must<Estimate>(api.POST('/drafts', { body: { ...req, confirm: false } })),
    onSuccess: setEstimate,
  })
  const confirm = useMutation({
    mutationFn: () => must<DraftJob>(api.POST('/drafts', { body: { ...req, confirm: true } })),
    onSuccess: () => { setEstimate(null); qc.invalidateQueries() },
  })
  return { estimate, ask, confirm, cancel: () => setEstimate(null) }
}

function DraftFlow({ req, label = 'Draft a reply', disabled }: { req: DraftRequest; label?: string; disabled?: boolean }) {
  const d = useDraft(req)
  if (d.confirm.data) return <DraftView job={d.confirm.data} />
  return (
    <div className="grid gap-2">
      {!d.estimate ? (
        <div><Button disabled={disabled || d.ask.isPending} onClick={() => d.ask.mutate()}>{label}</Button></div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-sunk p-3 text-sm">
          <span>
            Drafting costs about <b>{money(d.estimate.estimate)}</b>, up to {money(d.estimate.worst_case)} with retries. Nothing is posted.
          </span>
          <Button variant="primary" disabled={d.confirm.isPending} onClick={() => d.confirm.mutate()}>
            {d.confirm.isPending ? 'Drafting… (up to a minute)' : 'Draft it'}
          </Button>
          <Button variant="quiet" disabled={d.confirm.isPending} onClick={d.cancel}>Cancel</Button>
        </div>
      )}
      <ErrorNote error={d.ask.error ?? d.confirm.error} />
    </div>
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

function CommentCard({ c }: { c: Comment }) {
  const qc = useQueryClient()
  const dismiss = useMutation({
    mutationFn: () => must(api.POST('/comments/{comment_id}/dismiss', { params: { path: { comment_id: c.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  })
  return (
    <Card className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge>{commentKind(c)}</Badge><span>{c.author}</span><span>· {ago(c.created_at)}</span>
        <a className="underline" href={c.url} target="_blank" rel="noreferrer">open</a>
      </div>
      <p className="whitespace-pre-line text-sm">{c.body}</p>
      <div className="flex flex-wrap items-start gap-2">
        <DraftFlow req={{ kind: 'comment', id: c.id, confirm: false }} />
        <Button variant="quiet" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>No reply needed</Button>
      </div>
    </Card>
  )
}

function PasteForm() {
  const posts = useQuery({ queryKey: ['posts'], queryFn: () => must<Post[]>(api.GET('/posts')) })
  const [text, setText] = useState('')
  const [channel, setChannel] = useState('reddit-reply')
  const [post, setPost] = useState<string>('')
  const req: DraftRequest = { kind: 'pasted', text, channel, post_id: post ? Number(post) : null, confirm: false }
  return (
    <Section title="Draft a Reply">
      <p className="text-sm text-muted">
        Paste the comment you're answering (and the lines it replies to, if any). For a comment on one of your posts, pick the post: Radar adds its text, so you
        only paste the new comment.
      </p>
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="grid gap-1">
            <span className="text-muted">Where you'll post it</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1.5">
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="text-muted">Reply on which post?</span>
            <select value={post} onChange={(e) => setPost(e.target.value)} className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5">
              <option value="">Not one of my posts</option>
              {posts.data?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="u/someone: Does it handle plurals for Polish?"
          className="min-h-40 rounded-md border border-line bg-surface p-3 text-sm"
        />
        <DraftFlow key={`${channel}-${post}-${text.length > 0}`} req={req} label="Draft a reply" disabled={!text.trim()} />
      </Card>
    </Section>
  )
}

function DraftList() {
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: () => must<DraftJob[]>(api.GET('/drafts', { params: { query: { limit: 30 } } })) })
  return (
    <Section title="Drafts">
      <ErrorNote error={drafts.error} />
      {drafts.data?.length === 0 && <Empty>No drafts yet.</Empty>}
      {drafts.data?.map((j) => <DraftView key={j.id} job={j} />)}
    </Section>
  )
}

function DraftView({ job }: { job: DraftJob }) {
  const qc = useQueryClient()
  const final = job.attempts.find((a) => a.id === job.final_draft_id)
  const [text, setText] = useState(job.posted_text ?? final?.text ?? '')
  const [url, setUrl] = useState(job.posted_url ?? '')
  const posted = useMutation({
    mutationFn: () => must(api.POST('/drafts/{job_id}/posted', { params: { path: { job_id: job.id } }, body: { url, text } })),
    onSuccess: () => qc.invalidateQueries(),
  })
  const tone = job.status === 'pass' ? 'good' : job.status === 'skip' ? 'neutral' : job.status === 'failed' ? 'bad' : 'warn'
  return (
    <Card className="grid gap-3 border-accent/40">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tone}>{job.status === 'pass' ? 'ready to post' : job.status}</Badge>
        <span className="text-muted">{job.channel} · {job.attempts.length} attempt{job.attempts.length === 1 ? '' : 's'} · {money(job.cost)} · {ago(job.created_at)}</span>
        {job.posted_url && <Badge tone="accent">posted</Badge>}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">What it answers ({job.thread.length} message{job.thread.length === 1 ? '' : 's'})</summary>
        <div className="mt-2 grid max-h-64 gap-2 overflow-auto">
          {job.thread.map((m, i) => <p key={i} className="whitespace-pre-line rounded-md bg-sunk p-2">{m}</p>)}
        </div>
      </details>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 rounded-md border border-line bg-surface p-3 text-[15px] leading-6" />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} />
        <span className="text-xs text-muted">{text.length} characters · edit freely: your final text is kept when you mark it posted</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">How it was checked</summary>
        <ol className="mt-2 grid gap-2">
          {job.attempts.map((a) => (
            <li key={a.id} className="rounded-md bg-sunk p-2">
              <div className="mb-1 flex flex-wrap gap-2">
                <b>Attempt {a.attempt}</b>
                <Badge tone={a.verdict === 'pass' ? 'good' : a.verdict ? 'warn' : 'bad'}>{a.verdict || 'rule checks failed'}</Badge>
                {Object.entries(a.scores).map(([k, v]) => <span key={k} className="font-mono text-xs text-muted">{k.replace('_', ' ')} {v}</span>)}
              </div>
              {a.rule_failures.map((f, i) => <div key={i} className="text-bad">rule: {f}</div>)}
              {a.problems.map((p, i) => <div key={i}><span className="text-warn">{p.criterion}</span>: “{p.quote}” → {p.fix}</div>)}
              {a.unsupported.map((u, i) => <div key={i} className="text-bad">unsupported: {u}</div>)}
              {a.rule_warnings.map((w, i) => <div key={i} className="text-muted">warning: {w}</div>)}
            </li>
          ))}
        </ol>
      </details>
      <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          <span className="text-muted">After you post it yourself: its link</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="rounded-md border border-line bg-surface px-2 py-1.5" />
        </label>
        <Button variant="primary" disabled={!url.trim() || posted.isPending} onClick={() => posted.mutate()}>Mark as posted</Button>
      </div>
      <ErrorNote error={posted.error} />
    </Card>
  )
}
