import { useQuery } from '@tanstack/react-query'
import { api, must, type Run } from '../api/client'
import { Badge, Card, Empty, ErrorNote, Section } from '../ui'
import { ago, money } from '../format'

export default function Runs() {
  const runs = useQuery({ queryKey: ['runs', 50], queryFn: () => must<Run[]>(api.GET('/runs', { params: { query: { limit: 50 } } })) })
  return (
    <Section title="Run history">
      <ErrorNote error={runs.error} />
      {runs.data?.length === 0 && <Empty>No runs yet.</Empty>}
      <div className="grid gap-2">
        {runs.data?.map((r) => (
          <Card key={r.id} className="py-3">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-muted">#{r.id}</span>
                <span className="font-medium">{r.job}</span>
                <Badge tone={r.status === 'ok' ? 'good' : r.status === 'running' ? 'accent' : r.status === 'partial' ? 'warn' : 'bad'}>{r.status}</Badge>
                <span className="text-muted">{ago(r.started_at)}</span>
                {r.cost > 0 && <span className="font-mono text-muted">{money(r.cost)}</span>}
                <span className="text-muted">{r.steps.length} steps</span>
              </summary>
              <ul className="mt-3 grid gap-1 font-mono text-xs">
                {r.steps.map((s, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr_auto] gap-3">
                    <span className={s.status === 'ok' ? 'text-good' : 'text-bad'}>{s.status === 'ok' ? '✓' : '✗'}</span>
                    <span className="min-w-0 break-words">
                      {s.name}
                      {s.detail && <span className="block text-bad">{s.detail}</span>}
                    </span>
                    <span className="text-muted">{s.seconds}s</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>
    </Section>
  )
}
