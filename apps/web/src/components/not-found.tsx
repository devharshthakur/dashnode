import { Link } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you were looking for does not exist or has moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/" />} nativeButton={false}>
            Back to DashNode
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
