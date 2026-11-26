import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, must, type DraftJob, type PostTopic } from '../api/client'
import { Badge, Button, Card, Empty, ErrorNote, PlatformHead, Section } from '../ui'
import { ago } from '../format'
import { DraftFlow, DraftView } from '../drafting'

/** Everything you're about to post: drafts grouped by where they go, and new X posts. */
const SOURCE_LABEL: Record<string, string> = {
  feedback: 'user feedback', release: 'release', question: 'a real question', intel: 'intel', candidate: 'from the X brief', stats: 'stats',
}

/** Your own X post: pick a suggested topic (with its evidence) or write one; the same write ⇄ evaluate loop drafts it. */
function NewPostPanel() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => setOpen(true)}>New X post</Button>
        <span className="text-sm text-muted">Radar also drafts one by itself on the schedule; it lands under New X posts below.</span>
      </div>
    )
  }
  return <NewPost onClose={() => setOpen(false)} />
}

function NewPost({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => must<PostTopic[]>(api.GET('/posts/topics', { params: { query: { status: 'new' } } })) })
  const suggest = useMutation({ mutationFn: () => must<PostTopic[]>(api.POST('/posts/topics')), onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }) })
  const [own, setOwn] = useState('')
  return (
    <Card className="grid gap-3 border-accent/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">New X post</h3>
        <div className="flex gap-2">
          <Button disabled={suggest.isPending} onClick={() => suggest.mutate()}>{suggest.isPending ? 'Suggesting…' : 'Suggest 3 topics (<1¢)'}</Button>
          <Button variant="quiet" onClick={onClose}>Close</Button>
        </div>
      </div>
      <p className="text-sm text-muted">
        Topics come from Radar's data: new releases, real questions in comments and replies, intel, and the X brief's candidates. The draft follows the X
        brief (docs/launch/x.md) and FACTS.md, and is checked like a reply. Nothing is posted for you.
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
    </Card>
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

/** Drafts by where they'll be posted, in a fixed order; each group says what it holds and how many are waiting. */
const DRAFT_GROUPS = [
  { key: 'x-post', name: 'New X posts', note: 'your own posts, for the Build in Public community' },
  { key: 'github', name: 'GitHub', note: 'replies on issues' },
  { key: 'reddit', name: 'Reddit', note: 'replies and posts' },
  { key: 'x-reply', name: 'X replies', note: 'replies to people on X' },
  { key: 'devto', name: 'dev.to', note: 'replies on articles' },
  { key: 'hn', name: 'Hacker News', note: 'comments' },
  { key: 'so', name: 'Stack Overflow', note: 'answers' },
] as const

function draftGroup(j: DraftJob): string {
  if (j.kind === 'post') return 'x-post'
  if (j.channel === 'x-post') return 'x-reply'  // a reply to someone on X uses the X format too
  return j.channel.split('-')[0]
}

export default function Drafts() {
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: () => must<DraftJob[]>(api.GET('/drafts', { params: { query: { limit: 50 } } })) })
  const all = drafts.data ?? []
  const known = new Set<string>(DRAFT_GROUPS.map((g) => g.key))
  const groups = [...DRAFT_GROUPS, ...[...new Set(all.map(draftGroup))].filter((k) => !known.has(k)).map((k) => ({ key: k, name: k, note: '' }))]
  return (
    <Section title="Drafts">
      <NewPostPanel />
      <p className="text-sm text-muted">Newest first in each group. Waiting drafts come before ones you've marked as posted.</p>
      <ErrorNote error={drafts.error} />
      {drafts.data && (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {groups.map((g) => {
            const items = all.filter((j) => draftGroup(j) === g.key).sort((a, b) => Number(!!a.posted_url) - Number(!!b.posted_url))
            const waiting = items.filter((j) => !j.posted_url).length
            return (
              <div key={g.key} className="grid gap-3 p-4">
                <PlatformHead name={g.name} note={g.note}>
                  {items.length === 0 ? <span className="text-sm text-muted">Nothing yet</span>
                    : <span className="flex gap-2">{waiting > 0 && <Badge tone="accent">{waiting} waiting</Badge>}
                      {items.length - waiting > 0 && <Badge>{items.length - waiting} posted</Badge>}</span>}
                </PlatformHead>
                {items.map((j) => <DraftView key={j.id} job={j} />)}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

