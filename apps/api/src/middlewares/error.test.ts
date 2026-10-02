import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

import { logger } from '#config/logger'
import { RevokedToken } from '#models/revoked-token'
import { errorHandler } from '#middlewares/error'
import { api, registeredSession, trustedOrigin } from '#test/app'

const SERVER_FAULT = { error: 'Internal Server Error' }

/** Records what the handler answered, without an HTTP layer. */
function fakeResponse() {
  const answered: { status: number; body: unknown } = {
    status: 0,
    body: undefined,
  }
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

  return { res, answered }
}

function handle(error: Error) {
  const { res, answered } = fakeResponse()
  const next = vi.fn()

  errorHandler(error, {} as Request, res, next as unknown as NextFunction)

  return { answered, next }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errorHandler with a body the parser refused', () => {
  it('answers 400 for a body that will not parse, without logging it', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    const response = await api()
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"password":"hunter2"')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'Bad Request' })

    // A parse failure carries the raw body on the error — a login's password
    // included — so nothing of it may reach the response or the log. The
    // handler logs only the status and the error kind.
    expect(JSON.stringify(response.body)).not.toContain('hunter2')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[1]).toBe('Request rejected: unreadable body')
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ status: 400 })
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain('hunter2')
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain('password')
  })

  it('answers 413 for a body over the one megabyte limit', async () => {
    const response = await api()
      .post('/auth/login')
      .send({ password: 'x'.repeat(1_100_000) })

    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: 'Payload Too Large' })
  })

  it('answers 415 for an unsupported charset', async () => {
    const response = await api()
      .post('/auth/login')
      .set('Content-Type', 'application/json; charset=ibm500')
      .send('{}')

    expect(response.status).toBe(415)
    expect(response.body).toEqual({ error: 'Unsupported Media Type' })
  })
})

describe('errorHandler with anything else', () => {
  it('answers a generic 500 and leaves the session cookie in place', async () => {
    const session = await registeredSession({ email: 'fault@example.com' })
    vi.spyOn(RevokedToken, 'updateOne').mockRejectedValueOnce(
      new Error('mongodb://secret-host:27017 refused the connection'),
    )

    const response = await session.agent
      .post('/auth/logout')
      .set('Origin', trustedOrigin())

    expect(response.status).toBe(500)
    expect(response.body).toEqual(SERVER_FAULT)

    // A 500 is a fault, not a logout: no clearing cookie may be sent, and the
    // original session has to keep working so a client does not throw it away.
    expect(response.headers['set-cookie']).toBeUndefined()
    const after = await session.agent.get('/auth/me')

    expect(after.status).toBe(200)
    expect(after.body.user.id).toBe(session.user.id)
  })

  it('leaks neither the message nor a stack trace', () => {
    const { answered } = handle(
      new Error('mongodb://secret-host:27017 refused the connection'),
    )

    expect(answered).toEqual({ status: 500, body: SERVER_FAULT })
  })

  // `http-errors` sets `expose` to say the message is safe to show; without it
  // a 4xx is still this service's own fault.
  it('treats a 4xx without expose as a server fault', () => {
    const error = Object.assign(new Error('internal detail'), { status: 400 })

    expect(handle(error).answered).toEqual({
      status: 500,
      body: SERVER_FAULT,
    })
  })

  it('treats a 5xx with expose as a server fault', () => {
    const error = Object.assign(new Error('boom'), {
      status: 503,
      expose: true,
    })

    expect(handle(error).answered).toEqual({
      status: 500,
      body: SERVER_FAULT,
    })
  })

  it('answers the status the parser set when it also exposed the message', () => {
    const error = Object.assign(new Error('Bad Request'), {
      status: 400,
      expose: true,
      type: 'entity.parse.failed',
    })

    expect(handle(error).answered).toEqual({
      status: 400,
      body: { error: 'Bad Request' },
    })
  })
})

describe('notFoundHandler', () => {
  it('answers an unknown path with the path it did not find', async () => {
    const response = await api().get('/nope')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Not Found', path: '/nope' })
  })

  it('answers an unknown path with JSON, not an HTML page', async () => {
    const response = await api().get('/totally/unknown')

    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({
      error: 'Not Found',
      path: '/totally/unknown',
    })
  })
})
