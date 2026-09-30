import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useSession } from '#/lib/session'

type AuthActionsProps = {
  size?: 'sm' | 'default' | 'lg'
}

/**
 * The landing page's account actions. Signed-out visitors get Login and
 * Sign up; a visitor with a session gets a single route into the dashboard.
 * While the session is still loading the signed-out actions are shown, which
 * is also the correct answer when the API cannot be reached.
 */
export function AuthActions({ size = 'default' }: AuthActionsProps) {
  const { data: user } = useSession()

  if (user) {
    return (
      <Button
        size={size}
        render={<Link to="/dashboard" />}
        nativeButton={false}
      >
        Go to dashboard
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    )
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        render={<Link to="/login" />}
        nativeButton={false}
      >
        Login
      </Button>
      <Button size={size} render={<Link to="/signup" />} nativeButton={false}>
        Sign up
      </Button>
    </>
  )
}
