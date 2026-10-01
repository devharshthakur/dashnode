import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'

import { env } from '#/env'

// Base URL of the Express API, validated at startup by `src/env.ts`. Set
// `VITE_API_URL` (for example in `apps/web/.env`) to point at another API.
export const API_BASE_URL = env.VITE_API_URL

interface ApiErrorBody {
  error?: unknown
}

/** A non-2xx answer from the API, carrying its status and `error` message. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// The session is an HttpOnly cookie that belongs to the API origin, so every
// request opts into sending credentials.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

// The API answers failures with `{ error: string }`, but a proxy or a crashed
// server may answer with HTML, so a body without that shape falls back to the
// status instead of surfacing an unrelated message.
function readErrorMessage(error: AxiosError<ApiErrorBody>): string {
  const body: ApiErrorBody | null | undefined = error.response?.data
  const message = body?.error

  if (typeof message === 'string' && message.length > 0) {
    return message
  }

  if (error.response) {
    return `Request failed with status ${error.response.status}`
  }

  return error.message
}

/**
 * Calls the API with the session cookie attached. Every non-2xx answer becomes
 * an {@link ApiError}, so callers branch on `status` rather than inspecting the
 * response themselves. A request that never reached the API keeps its original
 * error, which lets a query keep an error state instead of a false answer.
 */
export async function apiRequest<T>(
  path: string,
  config: AxiosRequestConfig = {},
): Promise<T> {
  try {
    const response = await apiClient.request<T>({ url: path, ...config })

    return response.status === 204 ? (undefined as T) : response.data
  } catch (error) {
    if (axios.isAxiosError<ApiErrorBody>(error) && error.response) {
      throw new ApiError(error.response.status, readErrorMessage(error))
    }

    throw error
  }
}
