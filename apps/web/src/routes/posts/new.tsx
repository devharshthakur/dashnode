import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

import { AppSidebar } from '#/components/dashboard/sidebar'
import { CreatePostForm } from '#/components/dashboard/create-post-form'
import { SessionVerificationError } from '#/components/session-error'
import { buttonVariants } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { authGaurd } from '#lib/auth-gaurd'

export const Route = createFileRoute('/posts/new')({
  beforeLoad: () => authGaurd('auth'),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: NewPostPage,
  head: () => ({ meta: [{ title: 'Create a post — DashNode' }] }),
})

function NewPostPage() {
  const { user } = Route.useRouteContext()

  if (!user) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="font-heading text-base font-medium">New post</h1>
        </header>
        <main className="flex flex-1 flex-col px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <div className="flex flex-col gap-3">
              <Link
                to="/dashboard"
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: '-ml-2 w-fit',
                })}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back to feed
              </Link>
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-3xl font-semibold tracking-tight">
                  Create a post
                </h2>
                <p className="text-muted-foreground">
                  Write in Markdown, save a draft, or publish it to the feed.
                </p>
              </div>
            </div>
            <CreatePostForm />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
