import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { apiRequest } from '#lib/config/axios'
import { getCurrentUser } from '#lib/auth-gaurd'

/** The signed-in account, as `GET /auth/me` returns it. */
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

// Read through the server on both sides of hydration. A 401 is the API's "no
// session" and becomes `null`; anything else throws, so the query keeps an
// error state instead of showing a false "signed out".
export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: getCurrentUser,
  retry: false,
  staleTime: 30_000,
})

/** Reads the current session: the signed-in user, or `null` when signed out. */
export function useSession() {
  return useQuery(sessionQueryOptions)
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest<UserEnvelope>('/auth/login', {
        method: 'POST',
        data: input,
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
      apiRequest<UserEnvelope>('/auth/register', {
        method: 'POST',
        data: input,
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
      apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}
