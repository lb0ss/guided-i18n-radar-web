export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const t = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export const money = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`

/** Where a research result came from. */
export const SOURCE_NAME: Record<string, string> = {
  github: 'GitHub', devto: 'dev.to', stackoverflow: 'Stack Overflow', hackernews: 'Hacker News', x: 'X', reddit: 'Reddit',
}

/** What a watched item is, in the same words as the notifications: "GitHub issue", "X reply"… */
export function commentKind(c: { platform: string; external_id?: string }): string {
  if (c.external_id?.startsWith('github:issue:')) return 'GitHub issue'
  if (c.platform === 'github') return 'GitHub issue comment'
  if (c.platform === 'x') return 'X reply'
  return `${SOURCE_NAME[c.platform] ?? c.platform} comment`
}

/** The kind within its platform's section: "Issue", "Issue comment", "Reply", "Mention", "Comment". */
export function shortKind(c: { platform: string; external_id?: string; post_url?: string; url?: string }): string {
  if (c.platform === 'github') return c.external_id?.startsWith('github:issue:') ? 'Issue' : 'Issue comment'
  if (c.platform === 'x') return c.post_url && c.post_url === c.url ? 'Mention' : 'Reply'
  return 'Comment'
}
