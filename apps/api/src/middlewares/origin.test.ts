import { describe, expect, it } from 'vitest'

import { api, registeredSession, trustedOrigin } from '#test/app'

// Every route that writes on behalf of the signed-in user mounts the guard.
// `POST /api/posts` is the one used here, and it mounts `requireTrustedOrigin`
// before `requireAuth`, so a `403` means the guard answered.
const WRITE = '/api/posts'
const FORBIDDEN = { error: 'Forbidden' }
const NEW_POST = {
  title: 'Origin check',
  content: 'A body.',
  tags: ['node'],
}

let email = 0

/** A signed-in write carrying exactly the headers it was given. */
async function write(headers: Record<string, string> = {}) {
  email += 1
  const session = await registeredSession({ email: `origin-${email}@x.com` })
  const request = session.agent.post(WRITE).send(NEW_POST)

  for (const [name, value] of Object.entries(headers)) {
    request.set(name, value)
  }

  return request
}

describe('requireTrustedOrigin', () => {
  it('lets a request from a trusted origin through', async () => {
    const response = await write({ Origin: trustedOrigin() })

    expect(response.status).toBe(201)
  })

  it('refuses a request from a foreign origin', async () => {
    const response = await write({ Origin: 'https://evil.example.com' })

    expect(response.status).toBe(403)
    expect(response.body).toEqual(FORBIDDEN)
  })

  // Sandboxed frames and local files send the opaque value, and no legitimate
  // page in this app has it.
  it('refuses the opaque origin', async () => {
    const response = await write({ Origin: 'null' })

    expect(response.status).toBe(403)
  })

  // Browsers always send `Origin` on POST, PUT and DELETE, so its absence means
  // a non-browser client holding a browser-only cookie.
  it('refuses a request that declares no origin at all', async () => {
    const response = await write()

    expect(response.status).toBe(403)
    expect(response.body).toEqual(FORBIDDEN)
  })

  it('accepts a trusted referer when no origin is sent', async () => {
    const response = await write({ Referer: `${trustedOrigin()}/write` })

    expect(response.status).toBe(201)
  })

  it('refuses an unparsable referer', async () => {
    const response = await write({ Referer: 'not a url' })

    expect(response.status).toBe(403)
  })

  // `Origin` is authoritative; a `Referer` cannot rescue a foreign one.
  it('lets a trusted origin win over a foreign referer', async () => {
    const response = await write({
      Origin: trustedOrigin(),
      Referer: 'https://evil.example.com/page',
    })

    expect(response.status).toBe(201)
  })

  it('refuses a foreign origin even with a trusted referer', async () => {
    const response = await write({
      Origin: 'https://evil.example.com',
      Referer: `${trustedOrigin()}/write`,
    })

    expect(response.status).toBe(403)
  })
})

describe('read-only routes', () => {
  it('answer without an origin header', async () => {
    const response = await api().get(WRITE)

    expect(response.status).toBe(200)
  })
})
