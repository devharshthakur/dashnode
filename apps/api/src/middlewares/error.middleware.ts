import type { NextFunction, Request, Response } from 'express'

import { logger } from '#lib/logger'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl })
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error(err.message)
  res.status(500).json({ error: 'Internal Server Error' })
}
