import { createFileRoute, Link } from '@tanstack/react-router'
import { PenLineIcon } from 'lucide-react'

import { AppSidebar } from '#/components/dashboard/sidebar'
import { PostFeed } from '#/components/dashboard/post-feed'
import { SessionVerificationError } from '#/components/session-error'
import { buttonVariants } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { authGaurd } from '#lib/auth-gaurd'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => authGaurd('auth'),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Dashboard — DashNode' }] }),
})

function DashboardPage() {
  const { user } = Route.useRouteContext()

  if (!user) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 h-4 data-vertical:self-center"
          />
          <h1 className="font-heading text-base font-medium">Dashboard</h1>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4">
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <section className="flex min-w-0 flex-col gap-4 lg:col-span-2">
              <h2 className="font-heading text-sm font-medium text-muted-foreground">
                Latest posts
              </h2>
              <PostFeed />
            </section>
            <aside className="flex flex-col items-start gap-3 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <h2 className="font-heading text-sm font-medium">
                Start writing
              </h2>
              <p className="text-sm text-muted-foreground">
                Share an idea with the DashNode community.
              </p>
              <Link to="/posts/new" className={buttonVariants()}>
                <PenLineIcon data-icon="inline-start" />
                Create post
              </Link>
            </aside>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
