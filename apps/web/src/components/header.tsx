import { Link } from '@tanstack/react-router'
import { FeatherIcon } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <FeatherIcon className="size-5" />
          <span className="font-heading text-base font-semibold">DashNode</span>
        </Link>
      </div>
    </header>
  )
}
