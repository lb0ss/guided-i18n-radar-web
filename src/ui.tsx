import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({ variant = 'plain', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'plain' | 'quiet' }) {
  const look = {
    primary: 'bg-accent text-accent-ink border-accent hover:opacity-90',
    plain: 'bg-surface text-ink border-line hover:border-accent',
    quiet: 'bg-transparent text-muted border-transparent hover:text-ink',
  }[variant]
  return (
    <button
      {...p}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  )
}

const TONES = { neutral: 'text-muted border-line', good: 'text-good border-good/40', warn: 'text-warn border-warn/40', bad: 'text-bad border-bad/40', accent: 'text-accent border-accent/40' }
export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] leading-4 ${TONES[tone]}`}>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-lg border border-line bg-surface p-4 ${className}`}>{children}</div>
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{children}</p>
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  const offline = /fetch|network/i.test(msg)
  return (
    <p className="rounded-md border border-bad/40 p-3 text-sm text-bad">
      {offline ? 'Radar API not reachable on http://127.0.0.1:8000. Is it running? (scripts/launch-agent.sh status)' : msg}
    </p>
  )
}

export function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  if (values.length < 2) return <svg className={className} viewBox="0 0 100 24" aria-hidden />
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${22 - ((v - min) / span) * 20}`).join(' ')
  return (
    <svg className={className} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function CopyButton({ text }: { text: string }) {
  return (
    <Button
      onClick={async (e) => {
        const b = e.currentTarget
        try {
          await navigator.clipboard.writeText(text)
          b.textContent = 'Copied'
        } catch {
          b.textContent = 'Copy failed: select the text'
        }
        setTimeout(() => (b.textContent = 'Copy'), 1500)
      }}
    >
      Copy
    </Button>
  )
}

export function PlatformHead({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <span className="font-semibold">{name}</span> <span className="text-sm text-muted">{note}</span>
      </div>
      {children}
    </div>
  )
}

