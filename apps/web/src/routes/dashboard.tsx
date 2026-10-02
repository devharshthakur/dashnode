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
import { authGaurd } from '#/lib/auth-gaurd'
import { useLogout } from '#/lib/session'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => authGaurd('auth'),
  // Rendered from the session cookie, so shared caches must not keep a copy.
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  errorComponent: SessionVerificationError,
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Dashboard — DashNode' }] }),
})

function DashboardPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const logout = useLogout()
  // Verified by the guard before render, so there is no signed-out state here.
  const { user } = Route.useRouteContext()

  if (!user) {
    // Unreachable: the guard redirects anyone without a session. The type is
    // nullable because the same guard also serves guest-only routes.
    return null
  }

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
                  // Navigate before invalidating so the two do not race: the
                  // guest guard would otherwise see the cleared session and
                  // redirect mid-navigation.
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
