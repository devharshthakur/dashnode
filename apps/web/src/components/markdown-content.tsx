import { Markdown } from '@tanstack/markdown/react'

export function MarkdownContent({ source }: { source: string }) {
  return (
    <article className="prose max-w-none">
      <Markdown>{source}</Markdown>
    </article>
  )
}
