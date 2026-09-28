import { describe, expect, it } from 'vitest'

import { getHealthStatus } from '#services/health'

describe('getHealthStatus', () => {
  it('reports the service as up', () => {
    expect(getHealthStatus().status).toBe('ok')
  })

  it('reports a numeric uptime', () => {
    expect(typeof getHealthStatus().uptime).toBe('number')
  })

  it('reports a timestamp a client can parse', () => {
    const { timestamp } = getHealthStatus()

    expect(Number.isNaN(Date.parse(timestamp))).toBe(false)
    expect(timestamp).toBe(new Date(timestamp).toISOString())
  })
})
