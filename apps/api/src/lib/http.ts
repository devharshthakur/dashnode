import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { env } from '#env'
import { logger } from '#lib/logger'

type HttpErrorOptions = {
  cause: unknown
  status?: number
  code?: string
  data?: unknown
}

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

export const http: AxiosInstance = axios.create({
  baseURL: env.HTTP_BASE_URL,
  timeout: env.HTTP_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  logger.debug(
    { method: config.method, url: config.url },
    'Outbound HTTP request',
  )

  return config
})

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
