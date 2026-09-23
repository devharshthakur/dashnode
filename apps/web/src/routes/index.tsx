import { createFileRoute } from '@tanstack/react-router'

import { MarkdownContent } from '../components/markdown-content'

export const Route = createFileRoute('/')({ component: Home })

const article = `# Write technical stories in Markdown

TanStack Markdown renders your post body as semantic React content.

## Code stays readable

\`\`\`ts
const answer = 42
\`\`\`

- **Rich formatting** for ideas
- \`code\` inline for APIs
`

function Home() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-4xl font-bold">TanStack Markdown</h1>
      <MarkdownContent source={article} />
    </div>
  )
}
