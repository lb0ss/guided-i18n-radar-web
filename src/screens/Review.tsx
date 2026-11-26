import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api, must, type Comment, type DraftJob, type DraftRequest, type Estimate, type Opportunity, type Post, type PostTopic, type Schedule } from '../api/client'
import { Badge, Button, Card, CopyButton, Empty, ErrorNote, Section } from '../ui'
import { ago, money, shortKind, SOURCE_NAME } from '../format'

const TABS = { reply: 'Worth a reply', comments: 'Comments on your posts', paste: 'Draft a Reply', post: 'New X post', intel: 'Intel', drafts: 'Drafts' } as const
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
      {tab === 'post' && <NewPost />}
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

/** What's watched on each platform, in a fixed order. Reddit isn't watched: it points to Draft a Reply. */
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

function PlatformHead({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <span className="font-semibold">{name}</span> <span className="text-sm text-muted">{note}</span>
      </div>
      {children}
    </div>
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
    <Section title="Draft a Reply">
      <p className="text-sm text-muted">
        Paste the comment you're answering (and the lines it replies to, if any). For a comment on one of your posts, pick the post: Radar adds its text, so you
        only paste the new comment.
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

const SOURCE_LABEL: Record<string, string> = {
  feedback: 'user feedback', release: 'release', question: 'a real question', intel: 'intel', candidate: 'from the X brief', stats: 'stats',
}

/** Your own X post: pick a suggested topic (with its evidence) or write one; the same write ⇄ evaluate loop drafts it. */
function NewPost() {
  const qc = useQueryClient()
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => must<PostTopic[]>(api.GET('/posts/topics', { params: { query: { status: 'new' } } })) })
  const suggest = useMutation({ mutationFn: () => must<PostTopic[]>(api.POST('/posts/topics')), onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }) })
  const [own, setOwn] = useState('')
  return (
    <Section
      title="New X post"
      aside={<Button disabled={suggest.isPending} onClick={() => suggest.mutate()}>{suggest.isPending ? 'Suggesting…' : 'Suggest 3 topics (<1¢)'}</Button>}
    >
      <p className="text-sm text-muted">
        Topics come from Radar's data: new releases, real questions in comments and replies, intel, and the X brief's candidates. The draft follows the X
        brief (docs/launch/x.md) and FACTS.md, and is checked like a reply. Radar also drafts one by itself on the schedule. Nothing is posted for you.
      </p>
      <ErrorNote error={topics.error ?? suggest.error} />
      {topics.data?.length === 0 && <Empty>No topics yet. Suggest some, or write your own below.</Empty>}
      {topics.data?.map((t) => <TopicCard key={t.id} t={t} />)}
      <Card className="grid gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Or your own topic</span>
          <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="e.g. why the extension never sends whole files"
            className="rounded-md border border-line bg-surface px-2 py-1.5" />
        </label>
        <DraftFlow key={own.trim().length > 0 ? 'own' : 'none'} req={{ kind: 'post', text: own, confirm: false }} label="Draft this post" disabled={!own.trim()} />
      </Card>
    </Section>
  )
}

function TopicCard({ t }: { t: PostTopic }) {
  const qc = useQueryClient()
  const dismiss = useMutation({
    mutationFn: () => must(api.POST('/posts/topics/{topic_id}/dismiss', { params: { path: { topic_id: t.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  })
  return (
    <Card className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="accent">{SOURCE_LABEL[t.source] ?? t.source}</Badge><span>{ago(t.created_at)}</span>
      </div>
      <h3 className="font-semibold">{t.title}</h3>
      <p className="text-sm">{t.angle}</p>
      <p className="text-sm text-muted">Evidence: {t.evidence}</p>
      <div className="flex flex-wrap items-start gap-2">
        <DraftFlow req={{ kind: 'post', id: t.id, confirm: false }} label="Draft this post" />
        <Button variant="quiet" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>Not this one</Button>
      </div>
    </Card>
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

function PlanItem({ label, text, copy }: { label: string; text: string; copy?: boolean }) {
  if (!text) return null
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted">{label}</span>{copy && <CopyButton text={text} />}</div>
      <p className="whitespace-pre-line">{text}</p>
    </div>
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
      {job.plan && <div className="text-sm"><span className="text-muted">New X post on: </span><b>{job.plan.topic}</b></div>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{job.plan ? 'What the writer was given (topic and X brief)' : `What it answers (${job.thread.length} message${job.thread.length === 1 ? '' : 's'})`}</summary>
        <div className="mt-2 grid max-h-64 gap-2 overflow-auto">
          {job.thread.map((m, i) => <p key={i} className="whitespace-pre-line rounded-md bg-sunk p-2">{m}</p>)}
        </div>
      </details>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 rounded-md border border-line bg-surface p-3 text-[15px] leading-6" />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} />
        <span className={`text-xs ${job.channel === 'x-post' && text.length > 280 ? 'text-bad' : 'text-muted'}`}>
          {text.length}{job.channel === 'x-post' ? ' / 280' : ''} characters · edit freely: your final text is kept when you mark it posted
        </span>
      </div>
      {job.plan && (
        <div className="grid gap-3 rounded-md bg-sunk p-3 text-sm">
          <PlanItem label="Image idea" text={job.plan.visual} />
          <PlanItem label="Alt text (Add description, before posting)" text={job.plan.alt_text} copy />
          <PlanItem label="First reply (the links, posted under your post)" text={job.plan.first_reply} copy />
        </div>
      )}
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
