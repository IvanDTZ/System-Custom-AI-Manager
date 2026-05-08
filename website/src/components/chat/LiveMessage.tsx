import { memo } from 'react'
import { Markdown } from './Markdown'

/**
 * LiveMessage renders the assistant message that is currently being streamed.
 * It is isolated from the rest of the message list so React only re-renders
 * this subtree when tokens arrive (the static history above never re-renders).
 */
export const LiveMessage = memo(function LiveMessage({
  text,
  modelName,
  hint,
}: {
  text: string
  modelName?: string
  hint?: string
}) {
  return (
    <div className="flex w-full">
      <div className="flex w-full max-w-3xl flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] text-text-subtle">
          <span className="size-1.5 rounded-full bg-emerald-400/80" />
          <span className="uppercase tracking-wider">
            Assistant{modelName ? ` · ${modelName}` : ''}
          </span>
          {hint && <span className="text-text-muted">· {hint}</span>}
        </div>
        {text ? (
          <>
            <Markdown content={text} />
            <span className="inline-block h-4 w-1.5 animate-pulse bg-white/60 align-middle" />
          </>
        ) : (
          <div className="flex items-center gap-2 py-1 text-sm text-text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-white/40" />
            <span className="size-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:120ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:240ms]" />
          </div>
        )}
      </div>
    </div>
  )
})
