import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'

/**
 * Base path of the API, which this application serves for itself at `/api/*` by
 * forwarding each request to the API over the server. The browser therefore
 * never learns the API's address and always stays on its own origin, so the
 * session cookie is sent without any credentialed cross-origin request.
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
