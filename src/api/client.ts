import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

// fetch is looked up per call (not captured once), so tests can replace it.
export const api = createClient<paths>({
  baseUrl: import.meta.env.DEV ? 'http://127.0.0.1:8000' : '',
  fetch: (req) => globalThis.fetch(req),
})

// The API's dict responses are untyped in its schema; these are the shapes the screens use.
export type Schedule = { job: string; interval_hours: number; enabled: boolean; last_run_at: string | null; built: boolean; has_run?: boolean }
export type StatRow = { source: string; metric: string; value: number; at: string; change: number | null; history: { at: string; value: number }[] }
export type Opportunity = {
  id: number; url: string; source: string; title: string; excerpt: string; created_at: string; replies: number
  relevance: number; category: string; angle: string; reason: string; state: string
}
export type Comment = { id: number; platform: string; external_id: string; post_url: string; url: string; author: string; body: string; created_at: string; state: string }
export type Post = { id: number; platform: string; url: string; title: string }
export type Attempt = {
  id: number; attempt: number; text: string; verdict: string; cost: number
  rule_failures: string[]; rule_warnings: string[]; problems: { criterion: string; quote: string; fix: string }[]
  unsupported: string[]; scores: Record<string, number>
}
export type DraftJob = {
  id: number; created_at: string; kind: string; source_id: number | null; post_id: number | null; channel: string
  thread: string[]; status: string; final_draft_id: number | null; cost: number; posted_url: string | null
  posted_text: string | null; attempts: Attempt[]
  plan: { topic: string; visual: string; alt_text: string; first_reply: string } | null  // only for a new post
}
export type PostTopic = { id: number; created_at: string; title: string; angle: string; evidence: string; source: string; status: string; cost: number }
export type Run = { id: number; job: string; started_at: string; finished_at: string | null; status: string; cost: number
  steps: { name: string; status: string; seconds: number; detail: string }[] }
export type Estimate = { needs_confirmation: true; estimate: number; worst_case: number }
export type DraftRequest = components['schemas']['DraftRequest']

/** Throws the API's error message, so screens can show it. */
export async function must<T>(p: Promise<{ data?: unknown; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await p
  if (error || !response.ok) {
    const detail = (error as { detail?: unknown } | undefined)?.detail
    throw new Error(typeof detail === 'string' ? detail : `${response.status} ${response.statusText}`)
  }
  return data as T
}
