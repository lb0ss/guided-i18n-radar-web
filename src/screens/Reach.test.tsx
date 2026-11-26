import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import Reach from './Reach'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const change = (delta: number, since: string, hours: number, pct: number) => ({ delta, hours, since, per_day: (delta / hours) * 24, pct })
const MON = '2026-11-23T18:32:50-08:00', SUN = '2026-11-22T12:51:32-08:00'

test('every number is a real reading or the difference between two, and they add up', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    checked_at: '2026-11-25T18:37:30-08:00', first_at: SUN,
    total: { value: 1165, change: change(53, MON, 48.1, 4.8), since_first: change(160, SUN, 77.8, 15.9) },
    stores: [
      { source: 'openvsx', name: 'Open VSX', value: 986, change: change(42, MON, 48.1, 4.4), since_first: change(129, SUN, 77.8, 15.1) },
      { source: 'marketplace', name: 'VS Code Marketplace', value: 179, change: change(11, MON, 48.1, 6.5), since_first: change(31, SUN, 77.8, 20.9) },
    ],
    points: [
      { at: SUN, openvsx: 857, marketplace: 148, openvsx_change: null, marketplace_change: null },
      { at: MON, openvsx: 944, marketplace: 168, openvsx_change: 87, marketplace_change: 20 },
      { at: '2026-11-25T18:37:30-08:00', openvsx: 986, marketplace: 179, openvsx_change: 42, marketplace_change: 11 },
    ],
    events: [{ day: '2026-11-17', kind: 'release', label: '0.1.3' }, { day: '2026-11-22', kind: 'post', label: 'r/localization' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  render(<QueryClientProvider client={new QueryClient()}><Reach /></QueryClientProvider>)
  expect(await screen.findByText('1,165', { selector: 'span.text-4xl' })).toBeInTheDocument()
  expect(screen.getByText('+42 in 2 days · ~21/day · +4.4%')).toBeInTheDocument()  // the same +42 as the notification
  expect(screen.getByText('+129')).toBeInTheDocument()  // since the first check: 857 → 986
  expect(screen.getByText(/Before Radar started \(Nov 22\): released 0\.1\.3/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Show as table'))
  const rows = screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')
  expect(rows).toHaveLength(3)
  expect(rows[2]).toContain('986 (+42)')  // the table is the readings themselves
  expect(rows[2]).toContain('179 (+11)')
  expect(rows[2]).toContain('1,165')
})
