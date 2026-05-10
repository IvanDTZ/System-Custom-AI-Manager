import type { ChatMessage } from '../../types'
import { Markdown } from './Markdown'

export function Message({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] flex-col gap-2 rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] leading-relaxed">
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.images.map((b64, i) => (
                <a
                  key={i}
                  href={`data:image/*;base64,${b64}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-white/10"
                >
                  <img
                    src={`data:image/*;base64,${b64}`}
                    alt={`attachment ${i + 1}`}
                    className="max-h-64 max-w-full object-contain"
                  />
                </a>
              ))}
            </div>
          )}
          {message.content && <span className="whitespace-pre-wrap break-words">{message.content}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex w-full">
      <div className="flex w-full max-w-3xl flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] text-text-subtle">
          <span className="size-1.5 rounded-full bg-emerald-400/80" />
          <span className="uppercase tracking-wider">Assistant{message.model_name ? ` · ${message.model_name}` : ''}</span>
        </div>
        <Markdown content={message.content} />
        {streaming && (
          <span className="inline-block h-4 w-1.5 animate-pulse bg-white/60 align-middle" />
        )}
      </div>
    </div>
  )
}
