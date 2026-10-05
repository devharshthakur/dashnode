import { Link } from '@tanstack/react-router'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

import type { PostCardDto } from '@packages/shared'

// A fixed locale, because the server and the browser can disagree on the
// default one and a differently formatted date is a hydration mismatch.
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

/** First character of a name, for the avatar placeholder. */
function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

export function PostCard({ post }: { post: PostCardDto }) {
  const date = post.publishedAt ?? post.createdAt

  return (
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
          <CardTitle>
            <Link
              to="/posts/$slug"
              params={{ slug: post.slug }}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {post.title}
            </Link>
          </CardTitle>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="size-6">
              {post.author.avatarUrl === '' ? null : (
                <AvatarImage src={post.author.avatarUrl} alt="" />
              )}
              <AvatarFallback>{initial(post.author.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{post.author.name}</span>
            <span aria-hidden="true">&middot;</span>
            <time dateTime={date} className="shrink-0">
              {dateFormat.format(new Date(date))}
            </time>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {post.excerpt === '' ? null : (
              <p className="text-muted-foreground">{post.excerpt}</p>
            )}
            {post.tags.length === 0 ? null : (
              <ul className="flex flex-wrap gap-2">
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
          </div>
        </CardContent>
      </Card>
    </article>
  )
}
