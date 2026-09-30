import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

import { corsOrigins } from '#config/cors'
import { requireTrustedOrigin } from '#middlewares/origin'

const FORBIDDEN = { error: 'Forbidden' }

function trusted(): string {
  const [origin] = corsOrigins

  if (origin === undefined) {
    throw new Error('CORS_ORIGIN lists no origin to trust')
  }

  return origin
}

/** Drives the middleware with the given headers, without an HTTP layer. */
function drive(headers: Record<string, string | undefined>) {
  const answered: { status: number; body: unknown } = {
    status: 0,
    body: undefined,
  }
  const next = vi.fn()
  const res = {
    status(code: number) {
      answered.status = code

      return res
    },
    json(body: unknown) {
      answered.body = body

      return res
    },
  } as unknown as Response
  const req = {
    get: (name: string) => headers[name.toLowerCase()],
    log: { warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  } as unknown as Request

  requireTrustedOrigin(req, res, next as unknown as NextFunction)

  return { answered, next }
}

// Every route that writes on behalf of the signed-in user mounts this guard; the
// guard's own policy is tested here directly, and the route suites check that
// each write endpoint actually wires it in.
describe('requireTrustedOrigin', () => {
  it('lets a request from a trusted origin through', () => {
    const { answered, next } = drive({ origin: trusted() })

    expect(next).toHaveBeenCalled()
    expect(answered.status).toBe(0)
  })

  it('refuses a request from a foreign origin', () => {
    const { answered, next } = drive({ origin: 'https://evil.example.com' })

    expect(next).not.toHaveBeenCalled()
    expect(answered).toEqual({ status: 403, body: FORBIDDEN })
  })

  // Sandboxed frames and local files send the opaque value, and no legitimate
  // page in this app has it.
  it('refuses the opaque origin', () => {
    const { answered, next } = drive({ origin: 'null' })

    expect(next).not.toHaveBeenCalled()
    expect(answered).toEqual({ status: 403, body: FORBIDDEN })
  })

  // Browsers always send `Origin` on POST, PUT and DELETE, so its absence means
  // a non-browser client holding a browser-only cookie.
  it('refuses a request that declares no origin at all', () => {
    const { answered, next } = drive({})

    expect(next).not.toHaveBeenCalled()
    expect(answered).toEqual({ status: 403, body: FORBIDDEN })
  })

  it('accepts a trusted referer when no origin is sent', () => {
    const { answered, next } = drive({ referer: `${trusted()}/write` })

    expect(next).toHaveBeenCalled()
    expect(answered.status).toBe(0)
  })

  it('refuses an unparsable referer', () => {
    const { answered, next } = drive({ referer: 'not a url' })

    expect(next).not.toHaveBeenCalled()
    expect(answered).toEqual({ status: 403, body: FORBIDDEN })
  })

  // `Origin` is authoritative; a `Referer` cannot rescue a foreign one.
  it('lets a trusted origin win over a foreign referer', () => {
    const { answered, next } = drive({
      origin: trusted(),
      referer: 'https://evil.example.com/page',
    })

    expect(next).toHaveBeenCalled()
    expect(answered.status).toBe(0)
  })

  it('refuses a foreign origin even with a trusted referer', () => {
    const { answered, next } = drive({
      origin: 'https://evil.example.com',
      referer: `${trusted()}/write`,
    })

    expect(next).not.toHaveBeenCalled()
    expect(answered).toEqual({ status: 403, body: FORBIDDEN })
  })
})
