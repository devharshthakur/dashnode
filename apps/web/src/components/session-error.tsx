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
 * Shown when a guard could not verify the session. Reaching this means the check
 * failed, not that the visitor is signed out, so a login form would be a second
 * wrong answer — protected content stays unrendered and `Try again` repeats the
 * check.
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
