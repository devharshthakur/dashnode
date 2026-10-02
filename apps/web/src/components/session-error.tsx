import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * Shown when a guard could not decide who the visitor is.
 *
 * A guarded route reaches its component only after the session was verified, so
 * reaching this component at all means the check failed rather than that the
 * visitor is signed out — showing a login form here would be a second wrong
 * answer on top of the first. Protected content stays unrendered either way, and
 * `Try again` repeats the check.
 */
export function SessionVerificationError({ reset }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>DashNode is unavailable</CardTitle>
          <CardDescription>
            We could not reach the API to check your session. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
