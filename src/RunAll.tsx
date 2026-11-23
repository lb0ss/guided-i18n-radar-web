import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, must } from './api/client'
import { Button } from './ui'
import { money } from './format'

type Result = {
  skipped?: string; new_comments?: number; replies?: number; intel?: number; cost?: number; failed?: string[]
}

const run = (job: 'checks' | 'research') => must<Result>(api.POST('/run/{job}', { params: { path: { job } } }))

/** One click: checks, then research. The schedule keeps running as before. */
export default function RunAll() {
  const qc = useQueryClient()
  const [step, setStep] = useState<'idle' | 'checks' | 'research'>('idle')
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)

  async function go() {
    setNote(null)
    try {
      setStep('checks')
      const c = await run('checks')
      qc.invalidateQueries()
      setStep('research')
      const r = await run('research')
      const parts = [
        c.skipped ?? `${c.new_comments ?? 0} new comment${c.new_comments === 1 ? '' : 's'}`,
        r.skipped ?? `${r.replies ?? 0} worth a reply, ${r.intel ?? 0} intel`,
      ]
      if (r.cost) parts.push(money(r.cost))
      const failed = [...(c.failed ?? []), ...(r.failed ?? [])]
      if (failed.length) parts.push(`failed: ${failed.join(', ')}`)
      setNote({ text: parts.join(' · '), bad: failed.length > 0 })
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), bad: true })
    } finally {
      setStep('idle')
      qc.invalidateQueries()
    }
  }

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
      {note && <span role="status" className={note.bad ? 'text-bad' : 'text-muted'}>{note.text}</span>}
      <Button variant="primary" disabled={step !== 'idle'} onClick={go} title="Run checks, then research, now. The schedule is unchanged.">
        {step === 'checks' ? 'Checking…' : step === 'research' ? 'Researching…' : 'Run checks + research'}
      </Button>
    </div>
  )
}
