import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, must } from '../api/client'
import { Card, ErrorNote } from '../ui'
import { changeText, dayLabel, when } from '../format'

type Change = { delta: number; hours: number; since: string; per_day: number | null; pct: number | null }
type Point = { at: string; openvsx: number; marketplace: number; openvsx_change: number | null; marketplace_change: number | null }
type Event = { day: string; kind: 'release' | 'post'; label: string }
type Store = { source: 'openvsx' | 'marketplace'; name: string; value: number | null; change: Change | null; since_first: Change | null }
type Reach = {
  checked_at: string | null
  first_at: string | null
  total: { value: number; change: Change | null; since_first: Change | null }
  stores: Store[]
  points: Point[]
  events: Event[]
}

const COLOR = { openvsx: 'var(--color-series-1)', marketplace: 'var(--color-series-2)' } as const
const HOUR = 3600e3

/** Downloads as real readings: one point per check, exactly what each store reported. Every number on
 * this card is a reading or the difference between two, so it all adds up and matches the notification. */
export default function Reach() {
  const q = useQuery({ queryKey: ['reach'], queryFn: () => must<Reach>(api.GET('/reach')) })
  if (q.error) return <ErrorNote error={q.error} />
  if (!q.data) return null
  const r = q.data
  const before = r.first_at ? r.events.filter((e) => e.day < localDay(r.first_at!)) : []
  return (
    <Card className="grid gap-5">
      <div className="grid gap-1">
        <span className="text-sm text-muted">Downloads, both stores</span>
        <span className="font-mono text-4xl font-semibold tabular-nums">{r.total.value.toLocaleString()}</span>
        <Changes change={r.total.change} sinceFirst={r.total.since_first} />
      </div>
      {r.points.length < 2 ? (
        <p className="text-sm text-muted">The charts appear after the second check.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Downloads over time</h3>
            <span className="flex flex-wrap gap-x-4 text-xs text-muted"><span>● a check</span><span>▲ release</span><span>◆ your post</span></span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {r.stores.map((s) => <StoreChart key={s.source} store={s} points={r.points} events={r.events} />)}
          </div>
          <p className="text-xs text-muted">
            Each dot is a check: the store's download count at that moment. The change between two dots is what the notification reports.
            Downloads, not people: they include updates and mirrors. Each chart has its own scale and doesn't start at zero.
            {before.length > 0 && <> Before Radar started ({dayLabel(localDay(r.first_at!))}): {summarize(before)}.</>}
          </p>
          <ReadingsTable points={r.points} />
        </>
      )}
    </Card>
  )
}

/** "+42 in 2 days … since the last check (Mon 6:32 PM)" and "+129 since the first check": both from real readings. */
function Changes({ change, sinceFirst }: { change: Change | null; sinceFirst: Change | null }) {
  if (!change) return <span className="text-sm text-muted">First reading</span>
  return (
    <span className="grid gap-0.5 text-sm">
      <span><span className={change.delta > 0 ? 'text-good' : ''}>{changeText(change)}</span>
        <span className="text-muted"> since the last check ({when(change.since)})</span></span>
      {sinceFirst && sinceFirst.since !== change.since && (
        <span><span>{sinceFirst.delta >= 0 ? '+' : ''}{sinceFirst.delta.toLocaleString()}</span>
          <span className="text-muted"> since the first check ({dayLabel(localDay(sinceFirst.since))}, {when(sinceFirst.since)})</span></span>
      )}
    </span>
  )
}

type Datum = { t: number; value: number; change: number | null; at: string }
type Mark = Event & { t: number }

function StoreChart({ store, points, events }: { store: Store; points: Point[]; events: Event[] }) {
  const key = store.source
  const data: Datum[] = points.map((p) => ({ t: Date.parse(p.at), value: p[key], change: p[`${key}_change`], at: p.at }))
  const t0 = data[0].t, t1 = data[data.length - 1].t
  const pad = Math.max(3 * HOUR, (t1 - t0) * 0.04)
  const ticks = dayTicks(t0 - pad, t1 + pad)
  const marks: Mark[] = events.map((e) => ({ ...e, t: noon(e.day) })).filter((e) => e.t >= t0 - pad && e.t <= t1 + pad)
  const markDays = [...new Set(marks.map((m) => m.t))].map((t) => {
    const on = marks.filter((m) => m.t === t)
    return { t, label: `${on.some((m) => m.kind === 'release') ? '▲' : ''}${on.some((m) => m.kind === 'post') ? '◆' : ''}` }
  })
  const [lo, hi] = niceRange(Math.min(...data.map((d) => d.value)), Math.max(...data.map((d) => d.value)))
  const axisText = { fill: 'var(--color-muted)', fontSize: 11 }
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <i className="inline-block size-2.5 rounded-full" style={{ background: COLOR[key] }} />
          {store.name}
        </span>
        <span className="font-mono text-sm tabular-nums">{store.value?.toLocaleString() ?? '–'}</span>
      </div>
      <Changes change={store.change} sinceFirst={store.since_first} />
      <div className="h-52" role="img" aria-label={`${store.name}: downloads at each check`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="t" type="number" scale="time" domain={[t0 - pad, t1 + pad]} ticks={ticks} tick={axisText} tickLine={false}
              axisLine={{ stroke: 'var(--color-muted)' }} tickFormatter={(t: number) => dayLabel(localDay(new Date(t).toISOString()))} />
            <YAxis tick={axisText} tickLine={false} axisLine={false} allowDecimals={false} width={48} domain={[lo, hi]} ticks={yTicks(lo, hi)} />
            {markDays.map((m) => (
              <ReferenceLine key={m.t} x={m.t} stroke="var(--color-muted)" strokeDasharray="2 3"
                label={{ value: m.label, position: 'top', fill: 'var(--color-ink)', fontSize: 11 }} />
            ))}
            <Tooltip cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '2 3' }}
              content={({ active, payload }) => (active && payload?.length ? <Tip p={payload[0].payload as Datum} name={store.name} data={data} marks={marks} /> : null)} />
            <Line type="linear" dataKey="value" stroke={COLOR[key]} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 4, fill: COLOR[key], stroke: 'var(--color-surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLOR[key], stroke: 'var(--color-surface)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Tip({ p, name, data, marks }: { p: Datum; name: string; data: Datum[]; marks: Mark[] }) {
  const i = data.findIndex((d) => d.t === p.t)
  const before = i > 0 ? data[i - 1] : null
  const sameDay = marks.filter((m) => localDay(new Date(m.t).toISOString()) === localDay(p.at))
  return (
    <div className="grid w-64 gap-1 rounded-md border border-line bg-surface p-2 text-xs shadow-lg">
      <div className="font-semibold">Check on {dayLabel(localDay(p.at))}, {when(p.at)}</div>
      <div className="flex justify-between gap-3"><span className="text-muted">{name}</span><span className="font-mono tabular-nums">{p.value.toLocaleString()}</span></div>
      {before && p.change != null && (
        <div className="text-muted">
          <span className="font-mono text-ink">{p.change >= 0 ? '+' : ''}{p.change}</span> since the check before ({when(before.at)}, {Math.round((p.t - before.t) / HOUR)} h earlier)
        </div>
      )}
      {sameDay.map((m) => <div key={m.label} className="text-muted">{m.kind === 'release' ? `▲ released ${m.label}` : `◆ posted ${m.label}`} that day</div>)}
    </div>
  )
}

function ReadingsTable({ points }: { points: Point[] }) {
  const ch = (c: number | null) => (c == null ? '' : ` (${c >= 0 ? '+' : ''}${c})`)
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr><th className="py-1 pr-4 font-medium">Check</th><th className="pr-4 text-right font-medium">Open VSX</th><th className="pr-4 text-right font-medium">Marketplace</th><th className="text-right font-medium">Total</th></tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {points.map((p) => (
              <tr key={p.at} className="border-t border-line">
                <td className="py-1 pr-4 font-sans">{dayLabel(localDay(p.at))}, {when(p.at)}</td>
                <td className="pr-4 text-right">{p.openvsx.toLocaleString()}<span className="text-muted">{ch(p.openvsx_change)}</span></td>
                <td className="pr-4 text-right">{p.marketplace.toLocaleString()}<span className="text-muted">{ch(p.marketplace_change)}</span></td>
                <td className="text-right">{(p.openvsx + p.marketplace).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** YYYY-MM-DD in local time. */
function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function noon(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

/** Noon of every day in the range: one axis label per day, centered on it. */
function dayTicks(from: number, to: number): number[] {
  const out = []
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  if (d.getTime() < from) d.setDate(d.getDate() + 1)
  for (; d.getTime() <= to; d.setDate(d.getDate() + 1)) out.push(d.getTime())
  return out
}

/** A y range on round numbers with a little room above and below: 857–986 → 840–1000. */
function niceRange(min: number, max: number): [number, number] {
  const step = niceStep(Math.max(max - min, 1) / 4)
  return [Math.max(0, Math.floor(min / step) * step - step), Math.ceil(max / step) * step + step]
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw
}

function yTicks(lo: number, hi: number): number[] {
  const step = niceStep((hi - lo) / 4)
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
}

function summarize(ev: Event[]): string {
  const rel = ev.filter((e) => e.kind === 'release').map((e) => e.label)
  const posts = ev.filter((e) => e.kind === 'post').map((e) => e.label)
  return [rel.length ? `released ${rel.join(', ')}` : '', posts.length ? `posted ${posts.join(', ')}` : ''].filter(Boolean).join('; ')
}
