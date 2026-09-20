import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { logger } from '#config/logger'
import { env } from '#env'

/**
 * Extra context attached to an {@link HttpError}.
 * All fields are optional because a request can fail before it ever
 * reaches the server (e.g. DNS failure or timeout), in which case there
 * is no status or response body to report.
 */
type HttpErrorOptions = {
  /** The original error thrown by Axios, kept for debugging. */
  cause: unknown
  /** HTTP response status, when the server responded. */
  status?: number
  /** Axios error code, e.g. `ECONNABORTED` (timeout) or `ENOTFOUND` (DNS). */
  code?: string
  /** Parsed response body, when the server responded. */
  data?: unknown
}

/**
 * Normalized error for every outbound request made with {@link http}.
 *
 * Interceptors convert Axios failures into this type so consumers never
 * need to import or type against Axios directly. Use `error.cause` to
 * reach the underlying `AxiosError` when you need the raw details.
 */
export class HttpError extends Error {
  readonly status?: number
  readonly code?: string
  readonly data?: unknown

  constructor(message: string, options: HttpErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'HttpError'
    this.status = options.status
    this.code = options.code
    this.data = options.data
  }
}

/**
 * Builds a human-readable message for an Axios failure.
 *
 * Preference order:
 * 1. A `message` string supplied by the server in the response body.
 * 2. A timeout message (Axios aborts with the `ECONNABORTED` code).
 * 3. A generic status message when the server responded with an error.
 * 4. The raw Axios message (network/DNS failures and anything else).
 */
function getErrorMessage(error: AxiosError) {
  const data = error.response?.data

  if (typeof data === 'object' && data !== null && 'message' in data) {
    const { message } = data as { message?: unknown }

    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }

  if (error.code === 'ECONNABORTED') {
    return `Request timed out after ${env.HTTP_TIMEOUT_MS}ms`
  }

  if (error.response) {
    return `Request failed with status ${error.response.status}`
  }

  return error.message
}

/**
 * Shared Axios instance for outbound HTTP calls.
 *
 * Pre-configured with the base URL and timeout from validated env, plus
 * request/response interceptors (below) that add debug logging and turn
 * failures into {@link HttpError}.
 */
export const http: AxiosInstance = axios.create({
  baseURL: env.HTTP_BASE_URL,
  timeout: env.HTTP_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

// Log every outbound request at debug level before it is sent.
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  logger.debug(
    { method: config.method, url: config.url },
    'Outbound HTTP request',
  )

  return config
})

// Log successful responses, and convert Axios failures into HttpError.
http.interceptors.response.use(
  (response) => {
    logger.debug(
      {
        method: response.config.method,
        url: response.config.url,
        status: response.status,
      },
      'Outbound HTTP response',
    )

    return response
  },
  (error: unknown) => {
    if (!(error instanceof AxiosError)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const code = error.code

    logger.error(
      {
        err: error,
        method: error.config?.method,
        url: error.config?.url,
        status,
        code,
      },
      'Outbound HTTP request failed',
    )

    return Promise.reject(
      new HttpError(getErrorMessage(error), {
        cause: error,
        status,
        code,
        data: error.response?.data,
      }),
    )
  },
)
