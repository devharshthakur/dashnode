import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'

import { SessionVerificationError } from '#/components/session-error'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Spinner } from '#/components/ui/spinner'
import { useLogout } from '#/lib/session'
import { requireAuth } from '#/lib/session-guard'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: requireAuth,
  // The page is rendered from the session cookie, so no shared cache may keep a
  // copy of it.
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Dashboard — DashNode' }] }),
})

function DashboardPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const logout = useLogout()
  // The guard verified this user before the page rendered, so there is nothing
  // to wait for and no signed-out state to recover from here.
  const { user } = Route.useRouteContext()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome back, {user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your drafts and published posts will appear here as DashNode grows.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: async () => {
                  // Navigating first, then invalidating, is what keeps the two
                  // from racing: the guest guard on the way out would otherwise
                  // see the cleared session and redirect before this finishes.
                  await navigate({ to: '/', replace: true })
                  await router.invalidate()
                },
              })
            }}
          >
            {logout.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <LogOutIcon data-icon="inline-start" />
            )}
            Log out
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
