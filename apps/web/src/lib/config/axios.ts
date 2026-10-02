import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'

/**
 * Base path of the API, which this app serves itself at `/api/*` by forwarding
 * to the API. The browser stays on its own origin and never learns the API's
 * address, so no credentialed cross-origin request is needed.
 */
export const API_BASE_PATH = '/api'

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

export const apiClient = axios.create({ baseURL: API_BASE_PATH })

// The API answers failures with `{ error }`, but a proxy or crashed server may
// answer HTML, so fall back to the status rather than surface a stray message.
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
 * Calls the API with the session cookie attached. Non-2xx answers become
 * {@link ApiError} so callers branch on `status`. A request that never reached
 * the API keeps its original error, preserving a query's error state.
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
