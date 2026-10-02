import { CircleAlertIcon, NewspaperIcon } from 'lucide-react'

import { PostCard } from '#/components/dashboard/post-card'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { ApiError } from '#/lib/config/axios'
import { useFeedPosts } from '#/lib/posts'

/** Placeholders in the shape of a card, so the feed does not jump when it lands. */
function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  )
}

/**
 * The published posts, newest first, with the API's cursor deciding where the
 * list ends. An unreachable API is reported rather than shown as an empty feed,
 * because "nobody has written anything" and "we could not ask" are not the same
 * answer.
 */
export function PostFeed() {
  const feed = useFeedPosts()
  const posts = feed.data?.pages.flatMap((page) => page.posts) ?? []

  if (feed.isPending) {
    return <FeedSkeleton />
  }

  if (feed.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>We could not load the feed</AlertTitle>
        <AlertDescription>
          {feed.error instanceof ApiError
            ? feed.error.message
            : 'The API could not be reached. Please try again.'}
        </AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void feed.refetch()
          }}
        >
          Try again
        </Button>
      </Alert>
    )
  }

  if (posts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NewspaperIcon />
          </EmptyMedia>
          <EmptyTitle>No published posts yet</EmptyTitle>
          <EmptyDescription>
            Posts appear here as soon as anyone on DashNode publishes one.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {feed.hasNextPage ? (
        <Button
          variant="outline"
          disabled={feed.isFetchingNextPage}
          onClick={() => {
            void feed.fetchNextPage()
          }}
        >
          {feed.isFetchingNextPage ? (
            <Spinner data-icon="inline-start" />
          ) : null}
          Load more
        </Button>
      ) : null}
    </div>
  )
}
