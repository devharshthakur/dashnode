import { Markdown } from '@tanstack/markdown/react'

import { highlightMarkdownCode, markdownThemeCss } from '#lib/markdown'

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-renderer prose max-w-none dark:prose-invert">
      <style>{markdownThemeCss}</style>
      <Markdown highlighter={highlightMarkdownCode}>{source}</Markdown>
    </div>
  )
}
