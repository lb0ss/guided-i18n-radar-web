import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, must, type Schedule } from '../api/client'
import { Badge, Button, Card, ErrorNote, Section } from '../ui'
import { ago } from '../format'

const LABEL: Record<string, string> = {
  checks: 'Stats and comments on your posts',
  research: 'Research (finds threads, ~1¢ a run)',
  posts: 'X post drafts (suggests topics, drafts the best one, ~4¢ a run; never posts)',
}

export default function Brief() {
  return (
    <>
      <ScheduleEditor />
      <BriefEditor />
    </>
  )
}

function ScheduleEditor() {
  const sched = useQuery({ queryKey: ['schedule'], queryFn: () => must<Schedule[]>(api.GET('/schedule')) })
  return (
    <Section title="Schedule">
      <p className="text-sm text-muted">Jobs run while your Mac is awake; a run missed during sleep happens once when it wakes.</p>
      <ErrorNote error={sched.error} />
      <div className="grid gap-3">{sched.data?.map((s) => <JobRow key={s.job} s={s} />)}</div>
    </Section>
  )
}

function JobRow({ s }: { s: Schedule }) {
  const qc = useQueryClient()
  const [hours, setHours] = useState(String(s.interval_hours))
  const [enabled, setEnabled] = useState(s.enabled)
  const save = useMutation({
    mutationFn: () => must(api.PUT('/schedule/{job}', { params: { path: { job: s.job } }, body: { interval_hours: Number(hours), enabled } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })
  const run = useMutation({ mutationFn: () => must(api.POST('/run/{job}', { params: { path: { job: s.job } } })), onSettled: () => qc.invalidateQueries() })
  const dirty = Number(hours) !== s.interval_hours || enabled !== s.enabled
  const next = s.last_run_at && s.enabled ? new Date(new Date(`${s.last_run_at.replace(/Z?$/, 'Z')}`).getTime() + s.interval_hours * 3600e3) : null
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-48 flex-1">
          <div className="font-medium">{LABEL[s.job] ?? s.job}</div>
          <div className="text-sm text-muted">
            {s.has_run === false ? 'Not run yet' : `Last run ${ago(s.last_run_at)}`}
            {next && ` · ${s.has_run === false ? 'first run' : 'next'} around ${next.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Every
          <select value={hours} onChange={(e) => setHours(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1">
            {[6, 12, 24, 48, 72, 96, 168].map((h) => (
              <option key={h} value={h}>{h < 24 ? `${h} hours` : h === 168 ? 'week' : `${h / 24} day${h > 24 ? 's' : ''}`}</option>
            ))}
            {![6, 12, 24, 48, 72, 96, 168].includes(Number(hours)) && <option value={hours}>{hours} hours</option>}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} disabled={!s.built} onChange={(e) => setEnabled(e.target.checked)} /> On
          {!s.built && <Badge tone="warn">not built</Badge>}
        </label>
        <div className="flex gap-2">
          <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</Button>
          <Button disabled={!s.built || run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Running…' : 'Run now'}</Button>
        </div>
      </div>
      <ErrorNote error={save.error ?? run.error} />
    </Card>
  )
}

function BriefEditor() {
  const qc = useQueryClient()
  const brief = useQuery({ queryKey: ['brief'], queryFn: () => must<{ text: string }>(api.GET('/brief')) })
  const [text, setText] = useState('')
  useEffect(() => { if (brief.data) setText(brief.data.text) }, [brief.data])
  const save = useMutation({
    mutationFn: () => must(api.PUT('/brief', { body: { text } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brief'] }),
  })
  return (
    <Section title="Research brief" aside={<span className="font-mono text-xs text-muted">projects/guided-i18n/brief.yaml</span>}>
      <p className="text-sm text-muted">What research looks for, what to ignore, and its limits. Read by the planner and the scorer on every run.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="min-h-96 w-full rounded-lg border border-line bg-surface p-3 font-mono text-[13px] leading-5"
      />
      <ErrorNote error={brief.error ?? save.error} />
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending || text === brief.data?.text} onClick={() => save.mutate()}>Save brief</Button>
        {save.isSuccess && text === brief.data?.text && <span className="text-sm text-good">Saved</span>}
      </div>
    </Section>
  )
}
