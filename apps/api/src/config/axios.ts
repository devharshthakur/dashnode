import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { logger } from '#config/logger'
import { env } from '#env'

// Shared outbound client: base URL and timeout come from validated env, and the
// interceptors below log both directions at debug level.
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
    logger.error({ err: error }, 'Outbound HTTP request failed')
    return Promise.reject(error)
  },
)
