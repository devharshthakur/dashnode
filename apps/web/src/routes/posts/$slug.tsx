import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftIcon, CircleAlertIcon } from 'lucide-react'

import { MarkdownContent } from '#/components/markdown-content'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { ApiError } from '#lib/config/axios'
import { usePostBySlug } from '#lib/posts'

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

export const Route = createFileRoute('/posts/$slug')({
  component: PostPage,
  head: () => ({ meta: [{ title: 'Post — DashNode' }] }),
})

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

function PostSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Skeleton className="h-8 w-28" />
        <Card>
          <CardHeader>
            <div className="flex w-full flex-col gap-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full max-w-2xl" />
              <Skeleton className="h-5 w-full max-w-xl" />
              <Skeleton className="h-8 w-48" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 pb-6">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="mt-4 h-48 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function PostLoadError({ error, retry }: { error: Error; retry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          to="/dashboard"
          className={buttonVariants({ variant: 'ghost', className: 'w-fit' })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to posts
        </Link>
        <Alert variant={notFound ? 'default' : 'destructive'}>
          <CircleAlertIcon />
          <AlertTitle>
            {notFound
              ? 'This post is not available'
              : 'We could not load this post'}
          </AlertTitle>
          <AlertDescription>
            {notFound
              ? 'It may have been removed or is no longer published.'
              : error instanceof ApiError
                ? error.message
                : 'The API could not be reached. Please try again.'}
          </AlertDescription>
          {notFound ? null : (
            <Button variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          )}
        </Alert>
      </div>
    </main>
  )
}

function PostPage() {
  const { slug } = Route.useParams()
  const postQuery = usePostBySlug(slug)

  if (postQuery.isPending) {
    return <PostSkeleton />
  }

  if (postQuery.isError) {
    return (
      <PostLoadError
        error={postQuery.error}
        retry={() => {
          void postQuery.refetch()
        }}
      />
    )
  }

  const { post } = postQuery.data
  const publishedAt = post.publishedAt ?? post.createdAt

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 md:gap-8">
        <Link
          to="/dashboard"
          className={buttonVariants({ variant: 'ghost', className: 'w-fit' })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to posts
        </Link>
        <article>
          <Card className="wrap-anywhere">
            {post.coverImage === '' ? null : (
              <img
                src={post.coverImage}
                alt=""
                className="aspect-video w-full object-cover"
              />
            )}
            <CardHeader className="min-w-0">
              <div className="flex w-full min-w-0 flex-col gap-5">
                {post.tags.length === 0 ? null : (
                  <ul className="flex flex-wrap gap-2" aria-label="Post tags">
                    {post.tags.map((tag) => (
                      <li key={tag.id} className="max-w-full">
                        <Badge variant="secondary" className="max-w-full">
                          <span className="truncate" title={tag.name}>
                            {tag.name}
                          </span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <CardTitle>
                  <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                    {post.title}
                  </h1>
                </CardTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Avatar>
                    {post.author.avatarUrl === '' ? null : (
                      <AvatarImage src={post.author.avatarUrl} alt="" />
                    )}
                    <AvatarFallback>{initial(post.author.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {post.author.name}
                    </span>
                    <time dateTime={publishedAt}>
                      {dateFormat.format(new Date(publishedAt))}
                    </time>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="pb-6 sm:px-6">
                <MarkdownContent source={post.content} />
              </div>
            </CardContent>
          </Card>
        </article>
      </div>
    </main>
  )
}
