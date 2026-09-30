import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'
import { useEffect } from 'react'

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
import { useLogout, useSession } from '#/lib/session'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Dashboard — DashNode' }] }),
})

function DashboardPage() {
  const navigate = useNavigate()
  const session = useSession()
  const logout = useLogout()
  const user = session.data

  // A route guard is a user-experience aid, not an authorization boundary:
  // every protected API request still verifies the session cookie on the
  // server, so a bypassed redirect reveals nothing.
  useEffect(() => {
    if (session.isSuccess && !user) {
      void navigate({ to: '/login', replace: true })
    }
  }, [navigate, session.isSuccess, user])

  if (session.isError) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>DashNode is unavailable</CardTitle>
            <CardDescription>
              We could not reach the API to check your session. Please try
              again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void session.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
        <Spinner />
      </main>
    )
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
                onSuccess: () => void navigate({ to: '/', replace: true }),
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
