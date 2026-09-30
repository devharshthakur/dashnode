import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '#/lib/api'

/** The signed-in account, as `GET /api/auth/me` returns it. */
export interface SessionUser {
  id: string
  name: string
  email: string
  bio: string
  avatarUrl: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  name: string
}

interface UserEnvelope {
  user: SessionUser
}

export const sessionQueryKey = ['session'] as const

// A `401` is the API's way of saying "no session", which is an answer rather
// than a failure. Anything else — a network fault, a `500` — is left to throw
// so the query keeps an error state to show instead of a false "signed out".
async function fetchSession(): Promise<SessionUser | null> {
  try {
    const { user } = await apiFetch<UserEnvelope>('/auth/me')
    return user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }

    throw error
  }
}

/** Reads the current session: the signed-in user, or `null` when signed out. */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    retry: false,
    staleTime: 30_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<UserEnvelope>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionQueryKey, user)
    },
  })
}

export function useSignup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SignupInput) =>
      apiFetch<UserEnvelope>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(sessionQueryKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}
