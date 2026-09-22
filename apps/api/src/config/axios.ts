import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { logger } from '#config/logger'
import { env } from '#env'

/**
 * Shared Axios instance for outbound HTTP calls.
 *
 * Pre-configured with the base URL and timeout from validated env, plus
 * request/response interceptors (below) that add debug logging.
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

// Log successful responses before they are returned to the caller.
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
  // Log failed responses before rethrowing.
  (error: unknown) => {
    logger.error({ err: error }, 'Outbound HTTP request failed')
    return Promise.reject(error)
  },
)
