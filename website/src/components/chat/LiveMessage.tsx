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
    <div className="flex w-full animate-[message-rise_280ms_ease-out]">
      <div className="flex w-full max-w-3xl flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] text-text-subtle">
          <span className="size-1.5 rounded-full bg-emerald-400/80" />
          <span className="uppercase tracking-wider">
            Assistant{modelName ? ` · ${modelName}` : ''}
          </span>
          {hint && <span className="text-text-muted">· {hint}</span>}
        </div>
        {text ? (
          <div className="relative">
            <Markdown content={text} />
            {/* Inline caret right after the last character. transform-gpu
                avoids subpixel rendering wobble while the text shifts under
                it. */}
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] transform-gpu animate-[caret-blink_900ms_ease-in-out_infinite] bg-white/80 align-middle"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1 text-sm text-text-muted">
            <span className="size-1.5 animate-[caret-blink_900ms_ease-in-out_infinite] rounded-full bg-white/40" />
            <span className="size-1.5 animate-[caret-blink_900ms_ease-in-out_infinite] rounded-full bg-white/40 [animation-delay:140ms]" />
            <span className="size-1.5 animate-[caret-blink_900ms_ease-in-out_infinite] rounded-full bg-white/40 [animation-delay:280ms]" />
          </div>
        )}
      </div>
    </div>
  )
})
