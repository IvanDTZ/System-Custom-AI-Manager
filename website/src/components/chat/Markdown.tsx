import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { CodeBlock } from './CodeBlock'

export function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={{
          pre({ children }) {
            // Pull language from the inner <code className="hljs language-…">
            let language: string | undefined
            const child = Array.isArray(children) ? children[0] : children
            if (child && typeof child === 'object' && 'props' in child) {
              const props = (child as { props?: { className?: string } }).props
              const cls = props?.className ?? ''
              const m = /(?:^|\s)language-([\w-]+)/.exec(cls)
              if (m) language = m[1]
            }
            return <CodeBlock language={language}>{children}</CodeBlock>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
