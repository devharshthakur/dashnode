import { createFileRoute } from '@tanstack/react-router'
import { CompassIcon, PenLineIcon, TagsIcon } from 'lucide-react'

import { AuthActions } from '#/components/auth-actions'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: 'DashNode — a Markdown-first home for developer writing' },
      {
        name: 'description',
        content:
          'DashNode is a Markdown-first blogging platform for developers: draft technical stories, organise them with tags, and publish them to a public developer feed.',
      },
    ],
  }),
})

const features = [
  {
    icon: PenLineIcon,
    title: 'Write in Markdown',
    description:
      'Draft and publish in plain Markdown. Headings, lists, links, and code blocks are stored exactly as you wrote them.',
  },
  {
    icon: TagsIcon,
    title: 'Organise with tags',
    description:
      'Tag each post by technology and browse a directory that lists only the tags published posts actually use.',
  },
  {
    icon: CompassIcon,
    title: 'Publish when you are ready',
    description:
      'Keep work as a private draft for as long as it needs, then publish it to the public feed, newest first.',
  },
]

function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      <section className="py-16 md:py-24">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            A home for developer writing
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Write, publish, and grow your developer blog.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            DashNode is a Markdown-first blogging platform for developers. Draft
            technical stories, tag them by technology, and share them on a
            public developer feed.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <AuthActions size="lg" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 pb-20 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="size-5 text-muted-foreground" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  )
}
