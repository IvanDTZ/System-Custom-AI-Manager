import { useState, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && 'props' in node && (node as { props?: { children?: ReactNode } }).props) {
    return extractText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

export function CodeBlock({
  language,
  children,
  className,
}: {
  language?: string
  children: ReactNode
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const text = extractText(children)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* noop */ }
  }

  return (
    <div className={cn('group my-3 overflow-hidden rounded-xl border border-white/10 bg-black/40', className)}>
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-[11px]">
        <span className="font-mono uppercase tracking-wider text-text-muted">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-white/[0.10] hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-6">
        <code className={cn('font-mono', language ? `language-${language}` : '')}>{children}</code>
      </pre>
    </div>
  )
}
