import { createFileRoute } from '@tanstack/react-router'

import { AppSidebar } from '#/components/dashboard/app-sidebar'
import { CreatePostCard } from '#/components/dashboard/create-post-card'
import { PostFeed } from '#/components/dashboard/post-feed'
import { SessionVerificationError } from '#/components/session-error'
import { Separator } from '#/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { authGaurd } from '#lib/auth-gaurd'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => authGaurd('auth'),
  // Rendered from the session cookie, so shared caches must not keep a copy.
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Dashboard — DashNode' }] }),
})

function DashboardPage() {
  // Verified by the guard before render, so there is no signed-out state here.
  const { user } = Route.useRouteContext()

  if (!user) {
    // Unreachable: the guard redirects anyone without a session. The type is
    // nullable because the same guard also serves guest-only routes.
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="font-heading text-base font-medium">Dashboard</h1>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4">
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <section className="flex flex-col gap-4 lg:col-span-2">
              <h2 className="font-heading text-sm font-medium text-muted-foreground">
                Latest posts
              </h2>
              <PostFeed />
            </section>
            <aside className="flex flex-col gap-4">
              <CreatePostCard />
            </aside>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
