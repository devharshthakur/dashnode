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

/** Root query key for the published feed, so mutations can invalidate it. */
export const feedQueryKey = ['posts', 'feed'] as const

/**
 * Builds the query options for a single post.
 *
 * @param slug - URL slug of the post to read.
 * @returns TanStack Query options that read `GET /posts/:slug`.
 */
export function postQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['posts', 'detail', slug] as const,
    queryFn: () =>
      apiRequest<PostDetailResponse>(`/posts/${encodeURIComponent(slug)}`),
  })
}

/**
 * Reads a single post by its slug.
 *
 * @param slug - URL slug of the post to read.
 * @returns The query for the requested post.
 */
export function usePostBySlug(slug: string) {
  return useQuery(postQueryOptions(slug))
}

/**
 * Reads the published feed a page at a time. `pageParam` is the API's opaque
 * cursor, passed back untouched; it is `undefined` for the first page and the
 * feed ends when the API answers with no cursor.
 *
 * @returns An infinite query over `GET /posts`.
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

/**
 * Publishes a new post.
 *
 * On success the feed is invalidated: a published post joins it, while a draft
 * changes nothing the feed can show.
 *
 * @returns The create-post mutation for `POST /posts`.
 */
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      apiRequest<PostResponse>('/posts', { method: 'POST', data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey })
    },
  })
}
