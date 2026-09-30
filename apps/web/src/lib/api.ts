// Base URL of the Express API. Defaults to the local development server; set
// `VITE_API_URL` (for example in `apps/web/.env`) to point at another API.
const configuredApiUrl: unknown = import.meta.env.VITE_API_URL

export const API_BASE_URL =
  typeof configuredApiUrl === 'string' && configuredApiUrl.length > 0
    ? configuredApiUrl
    : 'http://localhost:3001/api'

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

// The API answers failures with `{ error: string }`, but a proxy or a crashed
// server may answer with HTML, so a body that cannot be read falls back to the
// status instead of throwing from inside the error path.
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody

    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error
    }
  } catch {
    // Not JSON; the status-based message below is more useful than a parse error.
  }

  return `Request failed with status ${response.status}`
}

// JSON is the only body shape the API accepts, so the caller sends an object
// and this keeps the content type consistent.
export interface ApiRequest {
  method?: string
  body?: string
  headers?: Record<string, string>
}

/**
 * Calls the API with the session cookie attached. Every non-2xx answer becomes
 * an {@link ApiError}, so callers branch on `status` rather than inspecting the
 * response themselves.
 */
export async function apiFetch<T>(
  path: string,
  request: ApiRequest = {},
): Promise<T> {
  const { body, headers, ...rest } = request

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...rest,
    body,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
