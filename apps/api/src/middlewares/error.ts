import { STATUS_CODES } from 'node:http'

import type { NextFunction, Request, Response } from 'express'

import { logger } from '#config/logger'

/** An error tagged with the HTTP status the request that caused it deserves. */
type HttpError = Error & { expose?: unknown; status?: unknown; type?: unknown }

// `bodyParser.json()` reports a body it refuses through `http-errors`, which
// stamps the error with the status it means: `400` for a body that will not
// parse, `413` for one over the configured limit, `415` for an unsupported
// charset or content encoding. That is the same field Express's own default
// handler reads before answering with a status instead of a blanket failure, so
// honoring it keeps this middleware in step with the parser rather than
// restating its error types.
//
// Only a `4xx` counts, and only an error that sets `expose` — the `http-errors`
// flag for a message safe to show a client. Nothing else in this service sets
// either field, so every other failure stays on the generic `500` below.

/**
 * The status the body parser set for an unreadable body, or `null` when the
 * failure is not a client error.
 */
function clientErrorStatus(err: Error): number | null {
  const { expose, status } = err as HttpError

  if (
    expose !== true ||
    typeof status !== 'number' ||
    status < 400 ||
    status >= 500
  ) {
    return null
  }

  return status
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl })
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = clientErrorStatus(err)

  if (status !== null) {
    // A parse failure carries the raw body on the error, which for a login or
    // registration attempt holds the submitted password. Log the status and the
    // kind of failure only, never the error object or its message.
    logger.warn(
      { status, type: (err as HttpError).type },
      'Request rejected: unreadable body',
    )
    res.status(status).json({ error: STATUS_CODES[status] })
    return
  }

  logger.error({ err }, 'Unhandled request error')
  res.status(500).json({ error: 'Internal Server Error' })
}
