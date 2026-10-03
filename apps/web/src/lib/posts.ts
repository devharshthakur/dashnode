import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { apiRequest } from '#lib/config/axios'

import type {
  CreatePostInput,
  PostDetailResponse,
  PostListResponse,
  PostResponse,
} from '@packages/shared'

/** Posts per page, as the API's own default page size. */
const FEED_PAGE_SIZE = 10

export const feedQueryKey = ['posts', 'feed'] as const

export function postQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['posts', 'detail', slug] as const,
    queryFn: () =>
      apiRequest<PostDetailResponse>(`/posts/${encodeURIComponent(slug)}`),
  })
}

export function usePostBySlug(slug: string) {
  return useQuery(postQueryOptions(slug))
}

/**
 * The published feed, read a page at a time. `pageParam` is the API's opaque
 * cursor, passed back untouched; it is `undefined` for the first page and the
 * feed ends when the API answers with no cursor.
 */
export function useFeedPosts() {
  return useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) =>
      apiRequest<PostListResponse>('/posts', {
        params: { limit: FEED_PAGE_SIZE, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      apiRequest<PostResponse>('/posts', { method: 'POST', data: input }),
    onSuccess: () => {
      // A published post joins the feed, so the page it was written on has to
      // read it again. A draft changes nothing the feed can show.
      void queryClient.invalidateQueries({ queryKey: feedQueryKey })
    },
  })
}
