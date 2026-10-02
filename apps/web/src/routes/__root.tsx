import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { NotFound } from '#/components/not-found'
import { SiteFooter } from '#/components/site-footer'
import { SiteHeader } from '#/components/site-header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'DashNode',
      },
      {
        name: 'description',
        content:
          'DashNode is a Markdown-first blogging platform for developers.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // The dashboard brings its own chrome — a sidebar beside the content, filling
  // the viewport — so the marketing header and footer step aside for it.
  const isDashboard = useRouterState({
    select: (state) => state.location.pathname.startsWith('/dashboard'),
  })

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {isDashboard ? (
          children
        ) : (
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
        )}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
