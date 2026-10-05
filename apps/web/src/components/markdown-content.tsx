import { Markdown } from '@tanstack/markdown/react'

import { highlightMarkdownCode, markdownThemeCss } from '#lib/markdown'

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-renderer prose max-w-none min-w-0 wrap-anywhere dark:prose-invert [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
      <style>{markdownThemeCss}</style>
      <Markdown highlighter={highlightMarkdownCode}>{source}</Markdown>
    </div>
  )
}
