import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, must, type Comment, type Opportunity, type Run, type StatRow } from '../api/client'
import { Badge, Button, Card, ErrorNote, Section, Sparkline } from '../ui'
import { ago } from '../format'

const SOURCE = { openvsx: 'Open VSX', marketplace: 'VS Code Marketplace', github: 'GitHub', devto: 'dev.to' } as Record<string, string>

export default function Digest({ go }: { go: (s: 'review') => void }) {
  const qc = useQueryClient()
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => must<{ stats: StatRow[] }>(api.GET('/stats')) })
  const comments = useQuery({ queryKey: ['comments', 'new'], queryFn: () => must<Comment[]>(api.GET('/comments', { params: { query: { state: 'new' } } })) })
  const opps = useQuery({ queryKey: ['opportunities', 'new'], queryFn: () => must<Opportunity[]>(api.GET('/opportunities', { params: { query: { state: 'new' } } })) })
  const intel = useQuery({ queryKey: ['opportunities', 'intel'], queryFn: () => must<Opportunity[]>(api.GET('/opportunities', { params: { query: { state: 'intel' } } })) })
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => must<Run[]>(api.GET('/runs', { params: { query: { limit: 10 } } })) })
  const runNow = useMutation({
    mutationFn: (job: 'checks' | 'research') => must(api.POST('/run/{job}', { params: { path: { job } } })),
    onSettled: () => qc.invalidateQueries(),
  })

  const lastOf = (job: string) => runs.data?.find((r) => r.job === job)
  const bySource = new Map<string, StatRow[]>()
  for (const s of stats.data?.stats ?? []) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s])

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="New comments on your posts" value={comments.data?.length} onClick={() => go('review')} />
        <Tile label="Threads worth a reply" value={opps.data?.length} onClick={() => go('review')} />
        <Tile label="Intel" value={intel.data?.length} onClick={() => go('review')} />
      </div>
      <ErrorNote error={stats.error ?? comments.error ?? runs.error} />

      <Section
        title="Stats"
        aside={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Checked {ago(lastOf('checks')?.started_at)}</span>
            <Button disabled={runNow.isPending} onClick={() => runNow.mutate('checks')}>
              {runNow.isPending && runNow.variables === 'checks' ? 'Checking…' : 'Check now'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[...bySource.entries()].map(([source, rows]) => (
            <Card key={source}>
              <h3 className="mb-2 text-sm font-semibold">{SOURCE[source] ?? source}</h3>
              <dl className="grid gap-2">
                {rows.map((r) => (
                  <div key={r.metric} className="grid grid-cols-[1fr_auto_5rem] items-center gap-3">
                    <dt className="text-sm text-muted">{r.metric.replace('_', ' ')}</dt>
                    <dd className="text-right font-mono text-sm tabular-nums">
                      {r.value.toLocaleString()}
                      {r.change ? <span className={r.change > 0 ? 'text-good' : 'text-bad'}> {r.change > 0 ? '+' : ''}{r.change}</span> : null}
                    </dd>
                    <Sparkline className="h-5 w-20" values={r.history.map((h) => h.value)} />
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Research"
        aside={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Last run {ago(lastOf('research')?.started_at)}</span>
            <Button disabled={runNow.isPending} onClick={() => runNow.mutate('research')}>
              {runNow.isPending && runNow.variables === 'research' ? 'Researching… (about a minute)' : 'Research now (~1¢)'}
            </Button>
          </div>
        }
      >
        <ErrorNote error={runNow.error} />
        <p className="text-sm text-muted">
          Runs every 3 days. Threads worth a reply and intel are listed under <button className="underline" onClick={() => go('review')}>Review</button>.
        </p>
      </Section>
    </>
  )
}

function Tile({ label, value, onClick }: { label: string; value: number | undefined; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-line bg-surface p-4 text-left hover:border-accent">
      <div className="font-mono text-3xl tabular-nums">{value ?? '–'}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
      {value ? <Badge tone="accent">open Review</Badge> : null}
    </button>
  )
}
