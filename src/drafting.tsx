import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, must, type DraftJob, type DraftRequest, type Estimate } from './api/client'
import { Badge, Button, Card, CopyButton, ErrorNote } from './ui'
import { ago, money } from './format'

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

export function DraftFlow({ req, label = 'Draft a reply', disabled }: { req: DraftRequest; label?: string; disabled?: boolean }) {
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

function PlanItem({ label, text, copy }: { label: string; text: string; copy?: boolean }) {
  if (!text) return null
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted">{label}</span>{copy && <CopyButton text={text} />}</div>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  )
}

export function DraftView({ job }: { job: DraftJob }) {
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
